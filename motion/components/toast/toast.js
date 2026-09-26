/*
 * ARLing Motion: Toast.
 * A new toast grows out of the point that was clicked: it starts as a small circle there,
 * flies to its place and opens into the toast, then its text enters. Toasts fold into a
 * stack (older ones peek out behind, a little smaller); hover or keyboard focus unfolds
 * the stack into a list and pauses the timers.
 *
 * Markup: none needed. createToaster() adds a labelled region to the page, or use yours:
 *   <section class="am-toaster" aria-label="Notifications"><ol class="am-toaster-list"></ol></section>
 *
 * Accessibility: the list is a polite live region, so each new toast is read out once.
 * Alt+T moves focus to the newest toast (and unfolds the stack), Escape dismisses the
 * focused toast, each toast has a Dismiss button, timers pause while the stack is open.
 * MIT licence.
 */
import { track, presence, applyPresence, driver, PRESETS } from '../../src/core.js';

// ------------------------------------------------------------------ shared helpers

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const px = (v) => `${Math.round(v * 100) / 100}px`;
const num = (v) => String(Math.round(v * 10000) / 10000);
const SHOWN = { opacity: 1, blur: 0, y: 0, scale: 1, visible: true };
const GONE = { opacity: 0, blur: 0, y: 0, scale: 1, visible: false };

function steps(initial) {
  return {
    initial,
    ev: [],
    set(t, v) { this.ev.push([t, v]); this.ev.sort((a, b) => a[0] - b[0]); return this; },
    at(t) { let v = this.initial; for (const [et, x] of this.ev) { if (et > t) break; v = x; } return v; },
    get last() { return this.ev.length ? this.ev[this.ev.length - 1][1] : this.initial; },
    compact() { this.initial = this.last; this.ev = []; },
  };
}

function attr(el, name, value) {
  if (value === null || value === undefined || value === false) {
    if (el.hasAttribute(name)) el.removeAttribute(name);
  } else {
    const v = value === true ? '' : String(value);
    if (el.getAttribute(name) !== v) el.setAttribute(name, v);
  }
}

function radiusOf(el, fallback) {
  try {
    const v = parseFloat(getComputedStyle(el).borderTopLeftRadius);
    return Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

/** Centre of an element in page coordinates, for toast(msg, { from }). */
export function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// ------------------------------------------------------------------ toaster

/**
 * createToaster({ root, trigger, duration, max, gap, peek, hotkey, label, clock, reduced })
 * duration: seconds before a toast leaves on its own (default 4, Infinity keeps it);
 * max: toasts visible in the folded stack (default 3); hotkey: KeyboardEvent.code with Alt
 * (default 'KeyT', false turns it off).
 * Returns { toast, dismiss, dismissAll, expand, collapse, expanded, seek, settled, destroy, driver, keep }.
 */
export function createToaster(o = {}) {
  const doc = (o.root && o.root.ownerDocument) || o.document || document;
  let root = o.root;
  if (!root) {
    root = doc.createElement('section');
    doc.body.appendChild(root);
  }
  root.classList.add('am-toaster');
  if (!root.hasAttribute('aria-label')) attr(root, 'aria-label', o.label || 'Notifications');
  if (!root.hasAttribute('tabindex')) attr(root, 'tabindex', '-1');
  let list = root.querySelector('.am-toaster-list');
  if (!list) {
    list = doc.createElement('ol');
    list.className = 'am-toaster-list';
    root.appendChild(list);
  }
  attr(list, 'aria-live', 'polite');

  const max = o.max ?? 3;
  const gap = o.gap ?? 8;
  const peek = o.peek ?? 10;
  const life = o.duration ?? 4;
  const hotkey = o.hotkey === undefined ? 'KeyT' : o.hotkey;
  const toasts = [];
  let alive = []; // oldest first, in the order changes were made
  let n = 0;
  const exp = steps(false);
  let endT = -Infinity;
  const mark = (t) => { if (t > endT) endT = t; };
  const tracksOf = (T) => [T.y, T.s, T.fade, T.ox, T.oy, T.g, T.body.p, T.gone.p];
  const settledAll = (t) => toasts.every((T) => tracksOf(T).every((tr) => tr.settled(t)));

  const setTo = (tr, t, v, sp) => { if (tr.target(Infinity) !== v) tr.to(t, v, sp); };

  function restack(t) {
    const open = exp.last;
    let acc = 0;
    [...alive].reverse().forEach((T, i) => {
      setTo(T.y, t, open ? -acc : -i * peek);
      setTo(T.s, t, open ? 1 : Math.max(0, 1 - i * 0.05));
      setTo(T.fade, t, i < max ? 1 : 0);
      acc += T.H + gap;
    });
  }

  function paint(t, { reduced }) {
    attr(root, 'data-expanded', String(exp.at(t)));
    for (const T of toasts) {
      const li = T.li;
      const gone = t >= T.dead;
      attr(li, 'data-state', t >= T.born && !gone ? 'open' : 'closed');
      if (t < T.born) { li.style.visibility = 'hidden'; continue; }
      const G = reduced ? (gone ? GONE : SHOWN) : T.gone.at(t);
      if (!G.visible) { li.style.visibility = 'hidden'; continue; }
      const y = reduced ? T.y.target(t) : T.y.at(t);
      const s = reduced ? T.s.target(t) : T.s.at(t);
      const fade = clamp01(reduced ? T.fade.target(t) : T.fade.at(t));
      const ox = reduced ? 0 : T.ox.at(t);
      const oy = reduced ? 0 : T.oy.at(t);
      const k = reduced ? 1 : clamp01(T.g.at(t));
      li.style.visibility = fade > 0.002 ? 'visible' : 'hidden'; // the stylesheet hides toasts until the core shows them
      li.style.zIndex = String(T.id);
      li.style.transform = `translate(${px(ox)}, ${px(y + oy + G.y)}) scale(${(s * G.scale).toFixed(4)})`;
      li.style.opacity = num(G.opacity * fade);
      li.style.filter = G.blur > 0.05 ? `blur(${G.blur.toFixed(2)}px)` : '';
      if (k >= 1) li.style.clipPath = '';
      else {
        // a small circle at the click point opens into the toast
        const d0 = Math.min(T.H, 20);
        const f = 1 - k;
        const r = d0 / 2 + (T.R - d0 / 2) * k;
        li.style.clipPath = `inset(${px(((T.H - d0) / 2) * f)} ${px(((T.W - d0) / 2) * f)} round ${px(r)})`;
      }
      applyPresence(T.content, reduced ? SHOWN : T.body.at(t));
    }
  }

  function draw(t, s) {
    paint(t, s);
    if (api.keep || t < endT) return;
    for (let i = toasts.length - 1; i >= 0; i--) {
      const T = toasts[i];
      if (t >= T.dead && T.gone.settled(t)) { T.li.remove(); toasts.splice(i, 1); }
    }
    if (settledAll(t)) {
      for (const T of toasts) { for (const tr of tracksOf(T)) tr.compact(t); T.body.marks = []; T.gone.marks = []; }
      exp.compact();
    }
  }

  const d = driver(draw, { clock: o.clock, reduced: o.reduced });
  d.busy = (t) => t < endT || !settledAll(t);
  const commit = () => { paint(d.now(), { reduced: d.reduced }); d.kick(); };
  const when = (opt) => (opt && opt.t !== undefined ? { t: opt.t, live: false } : { t: d.now(), live: true });

  // live timers, paused while the stack is open
  function startTimer(T) {
    if (!Number.isFinite(T.left) || exp.last || T.timer) return;
    T.started = d.now();
    T.timer = setTimeout(() => { T.timer = 0; dismiss(T.id); }, Math.max(0, T.left) * 1000);
  }
  function pauseTimer(T) {
    if (!T.timer) return;
    clearTimeout(T.timer);
    T.timer = 0;
    T.left -= d.now() - T.started;
  }

  /** Shows a toast. opt: { t, from: { x, y } page point it grows from, description, duration }. Returns its id. */
  function toast(message, opt = {}) {
    const { t, live } = when(opt);
    const li = doc.createElement('li');
    li.className = 'am-toast';
    attr(li, 'aria-atomic', 'true');
    const content = doc.createElement('div');
    content.className = 'am-toast-content';
    const title = doc.createElement('p');
    title.className = 'am-toast-title';
    title.textContent = message;
    content.appendChild(title);
    if (opt.description) {
      const desc = doc.createElement('p');
      desc.className = 'am-toast-description';
      desc.textContent = opt.description;
      content.appendChild(desc);
    }
    const close = doc.createElement('button');
    close.className = 'am-toast-close';
    attr(close, 'type', 'button');
    attr(close, 'aria-label', 'Dismiss notification');
    close.textContent = '×';
    content.appendChild(close);
    li.appendChild(content);
    list.insertBefore(li, list.firstElementChild);

    const r = li.getBoundingClientRect();
    const lr = list.getBoundingClientRect();
    const W = r.width || 356;
    const H = r.height || 56;
    const from = opt.from || null;
    const ox0 = from ? from.x - (lr.right - W / 2) : 0;
    const oy0 = from ? from.y - (lr.bottom - H / 2) : 0;
    const T = {
      id: ++n, li, content, close, W, H, R: radiusOf(li, 10),
      born: t, dead: Infinity,
      y: track(0, PRESETS.snappy), s: track(1, PRESETS.snappy), fade: track(1, PRESETS.snappy),
      ox: track(ox0, PRESETS.morph), oy: track(oy0, PRESETS.morph), g: track(0, PRESETS.morph),
      body: presence(false), gone: presence(true, { dyOut: 6, blur: 6 }),
      left: opt.duration ?? life, timer: 0, started: 0,
    };
    T.ox.to(t, 0);
    T.oy.to(t, 0);
    T.g.to(t, 1);
    T.body.enter(t + 0.12);
    toasts.push(T);
    alive.push(T);
    restack(t);
    mark(t + 0.12);
    close.addEventListener('click', () => dismiss(T.id));
    commit();
    if (live) startTimer(T);
    return T.id;
  }

  function leaveFocus(T) {
    if (!T.li.contains(doc.activeElement)) return;
    const next = [...alive].reverse()[0];
    if (next) next.close.focus();
    else if (lastFocus && lastFocus.focus) lastFocus.focus();
    else root.focus();
  }

  function dismiss(id, opt = {}) {
    const { t, live } = when(opt);
    const T = toasts.find((x) => x.id === id);
    if (!T || T.dead !== Infinity) return api;
    T.dead = t;
    T.gone.exit(t);
    alive = alive.filter((x) => x !== T);
    restack(t);
    mark(t);
    if (live) { pauseTimer(T); leaveFocus(T); }
    commit();
    return api;
  }

  /** Dismisses every toast at once, without restacking the ones that leave together. */
  function dismissAll(opt = {}) {
    const { t, live } = when(opt);
    const leaving = alive;
    alive = [];
    for (const T of leaving) {
      T.dead = t;
      T.gone.exit(t);
      if (live) { pauseTimer(T); leaveFocus(T); }
    }
    mark(t);
    commit();
    return api;
  }

  function setExpanded(v, opt = {}) {
    const { t, live } = when(opt);
    if (exp.last === v) return api;
    exp.set(t, v);
    restack(t);
    mark(t);
    if (live) for (const T of alive) (v ? pauseTimer(T) : startTimer(T));
    commit();
    return api;
  }

  // ---------------------------------------------------------------- live input
  const listeners = [];
  const on = (el, type, fn) => { el.addEventListener(type, fn); listeners.push([el, type, fn]); };
  let lastFocus = null;
  let hovered = false;
  const focusInside = () => root.contains(doc.activeElement) && doc.activeElement !== doc.body;

  on(root, 'pointerenter', () => { hovered = true; setExpanded(true); });
  on(root, 'pointerleave', () => { hovered = false; if (!focusInside()) setExpanded(false); });
  on(root, 'focusin', () => setExpanded(true));
  on(root, 'focusout', (e) => {
    const next = e.relatedTarget;
    if (next && root.contains(next)) return;
    if (!hovered) setExpanded(false);
  });
  on(root, 'keydown', (e) => {
    if (e.key !== 'Escape') return;
    const T = alive.find((x) => x.li.contains(doc.activeElement));
    e.preventDefault();
    if (T) dismiss(T.id);
    else if (lastFocus && lastFocus.focus) lastFocus.focus();
  });
  if (hotkey) {
    on(doc, 'keydown', (e) => {
      if (!e.altKey || !(e.code === hotkey || (e.key && `Key${e.key.toUpperCase()}` === hotkey))) return;
      e.preventDefault();
      if (!root.contains(doc.activeElement)) lastFocus = doc.activeElement;
      const newest = [...alive].reverse()[0];
      (newest ? newest.close : root).focus();
    });
  }

  const api = {
    root,
    list,
    trigger: o.trigger || null,
    driver: d,
    keep: false,
    toast,
    dismiss,
    dismissAll,
    expand: (opt) => setExpanded(true, opt),
    collapse: (opt) => setExpanded(false, opt),
    expanded: (t) => (t === undefined ? exp.last : exp.at(t)),
    toasts: () => alive.map((T) => T.id),
    element: (id) => (toasts.find((x) => x.id === id) || {}).li || null,
    seek: (t) => paint(t, { reduced: d.reduced }),
    settled: (t) => t >= endT && settledAll(t),
    destroy() {
      d.stop();
      for (const T of toasts) pauseTimer(T);
      for (const [el, type, fn] of listeners) el.removeEventListener(type, fn);
    },
  };
  paint(d.now(), { reduced: d.reduced });
  return api;
}
