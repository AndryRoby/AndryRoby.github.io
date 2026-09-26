/*
 * ARLing Motion: Tooltip.
 * One bubble for a group of triggers. The first tooltip waits for the delay and enters;
 * while it is open (or shortly after), moving to the next trigger slides the same bubble
 * over and changes its width, and the text inside has its own exit and entrance.
 *
 * Markup: any triggers with data-tooltip inside a group element.
 *   <div class="am-tooltip-group">
 *     <button aria-label="Bold" data-tooltip="Bold">B</button>
 *     <button aria-label="Italic" data-tooltip="Italic">I</button>
 *   </div>
 *
 * Accessibility (WAI-ARIA APG, tooltip): role="tooltip", the trigger points to it with
 * aria-describedby (or aria-labelledby when the trigger has no name of its own). Shows on
 * hover after a delay and at once on keyboard focus, hides on blur, pointer down and
 * Escape (focus stays), and stays while the pointer is over the bubble (WCAG 1.4.13).
 * MIT licence.
 */
import { track, presence, applyPresence, driver, spring, PRESETS } from '../../src/core.js';

// ------------------------------------------------------------------ shared helpers

const JUMP = spring(0.001, 1); // a change that lands within one frame, still a pure function of time
const px = (v) => `${Math.round(v * 100) / 100}px`;
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

let uid = 0;
const ensureId = (el, prefix) => el.id || (el.id = `${prefix}-${++uid}`);

// ------------------------------------------------------------------ tooltip

/**
 * createTooltip({ root, triggers, delay, skipDelay, gap, clock, reduced })
 * delay: seconds before the first tooltip shows on hover (default 0.5);
 * skipDelay: after hiding, a new trigger within this time shows at once (default 0.3).
 * Returns { show, hide, active, seek, settled, destroy, driver, bubble, tips, triggers, keep }.
 */
export function createTooltip(o) {
  const root = o.root;
  const doc = root.ownerDocument || document;
  const triggers = o.triggers ? [...o.triggers] : [...root.querySelectorAll('[data-tooltip]')];
  const delay = o.delay ?? 0.5;
  const skipDelay = o.skipDelay ?? 0.3;
  const gap = o.gap ?? 6;
  const padX = o.padX ?? 10;
  const padY = o.padY ?? 6;

  let bubble = root.querySelector('.am-tooltip');
  if (!bubble) {
    bubble = doc.createElement('div');
    bubble.className = 'am-tooltip';
    root.appendChild(bubble);
  }
  const tips = triggers.map((tr) => {
    const tip = doc.createElement('div');
    tip.className = 'am-tooltip-text';
    attr(tip, 'role', 'tooltip');
    const label = doc.createElement('span');
    label.className = 'am-tooltip-label';
    label.textContent = tr.getAttribute('data-tooltip') || '';
    tip.appendChild(label);
    bubble.appendChild(tip);
    const id = ensureId(tip, 'am-tooltip');
    const named = tr.hasAttribute('aria-label') || tr.hasAttribute('aria-labelledby') || tr.textContent.trim();
    const rel = named ? 'aria-describedby' : 'aria-labelledby';
    const prev = tr.getAttribute(rel);
    attr(tr, rel, prev ? `${prev} ${id}` : id);
    return tip;
  });

  const active = steps(-1);
  const x = track(0, PRESETS.snappy);
  const y = track(0, PRESETS.snappy);
  const w = track(0, PRESETS.snappy);
  const hgt = track(0, PRESETS.snappy);
  const bub = presence(false, { dyIn: 4, dyOut: 2, blur: 4, scaleFrom: 0.96 });
  const tipP = tips.map(() => presence(false, { dyIn: 5, dyOut: -4, blur: 4, scaleFrom: 1 }));
  let lastHide = -Infinity;
  let endT = -Infinity;
  const mark = (t) => { if (t > endT) endT = t; };
  const all = () => [x, y, w, hgt, bub.p, ...tipP.map((p) => p.p)];
  const settledAll = (t) => all().every((tr) => tr.settled(t));

  function geometry(i) {
    const rr = root.getBoundingClientRect();
    const r = triggers[i].getBoundingClientRect();
    const lr = tips[i].firstElementChild.getBoundingClientRect();
    const bw = lr.width + 2 * padX;
    const bh = lr.height + 2 * padY;
    return { cx: r.left + r.width / 2 - rr.left, top: r.top - rr.top - gap - bh, w: bw, h: bh };
  }

  function paint(t, { reduced }) {
    const a = active.at(t);
    attr(bubble, 'data-state', a === -1 ? 'closed' : 'open');
    triggers.forEach((tr, i) => attr(tr, 'data-state', i === a ? 'open' : 'closed'));
    const b = reduced ? (a === -1 ? GONE : SHOWN) : bub.at(t);
    if (!b.visible) {
      bubble.style.visibility = 'hidden';
    } else {
      const X = reduced ? x.target(t) : x.at(t);
      const Y = reduced ? y.target(t) : y.at(t);
      const W = reduced ? w.target(t) : w.at(t);
      const H = reduced ? hgt.target(t) : hgt.at(t);
      bubble.style.visibility = 'visible'; // the stylesheet keeps it hidden until the core shows it
      bubble.style.width = px(W);
      bubble.style.height = px(H);
      bubble.style.opacity = String(Math.round(b.opacity * 10000) / 10000);
      bubble.style.filter = b.blur > 0.05 ? `blur(${b.blur.toFixed(2)}px)` : '';
      bubble.style.transform = `translate(${px(X - W / 2)}, ${px(Y + b.y)}) scale(${b.scale.toFixed(4)})`;
    }
    tips.forEach((tip, i) => {
      attr(tip, 'data-state', i === a ? 'open' : 'closed');
      applyPresence(tip, reduced ? (i === a ? SHOWN : GONE) : tipP[i].at(t));
    });
  }

  function draw(t, s) {
    paint(t, s);
    if (!api.keep && t >= endT && active.ev.length && settledAll(t)) {
      for (const tr of all()) tr.compact(t);
      bub.marks = [];
      for (const p of tipP) p.marks = [];
      active.compact();
    }
  }

  const d = driver(draw, { clock: o.clock, reduced: o.reduced });
  d.busy = (t) => t < endT || !settledAll(t);
  const commit = () => { paint(d.now(), { reduced: d.reduced }); d.kick(); };
  const when = (opt) => (opt && opt.t !== undefined ? { t: opt.t, live: false } : { t: d.now(), live: true });

  function show(i, opt = {}) {
    const { t } = when(opt);
    const cur = active.last;
    if (i === cur || i < 0 || i >= triggers.length) return api;
    const g = geometry(i);
    const open = cur !== -1;
    const warm = open || t - lastHide < skipDelay;
    const sp = warm ? PRESETS.snappy : JUMP;
    x.to(t, g.cx, sp);
    y.to(t, g.top, sp);
    w.to(t, g.w, sp);
    hgt.to(t, g.h, sp);
    if (open) {
      tipP[cur].exit(t);
      tipP[i].enter(t + 0.04);
    } else {
      bub.enter(t);
      tipP[i].enter(t, warm ? undefined : JUMP);
    }
    active.set(t, i);
    mark(t + 0.04);
    commit();
    return api;
  }

  function hide(opt = {}) {
    const { t } = when(opt);
    const cur = active.last;
    if (cur === -1) return api;
    active.set(t, -1);
    bub.exit(t);
    tipP[cur].exit(t);
    lastHide = t;
    mark(t);
    commit();
    return api;
  }

  // ---------------------------------------------------------------- live input
  const listeners = [];
  const on = (el, type, fn) => { el.addEventListener(type, fn); listeners.push([el, type, fn]); };
  let showTimer = 0;
  let hideTimer = 0;
  const clear = () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
  const hideSoon = () => { clearTimeout(hideTimer); hideTimer = setTimeout(() => hide(), 100); };

  triggers.forEach((tr, i) => {
    on(tr, 'pointerenter', (e) => {
      if (e.pointerType === 'touch') return;
      clear();
      if (active.last !== -1 || d.now() - lastHide < skipDelay) show(i);
      else showTimer = setTimeout(() => show(i), delay * 1000);
    });
    on(tr, 'pointerleave', () => { clearTimeout(showTimer); hideSoon(); });
    on(tr, 'pointerdown', () => { clear(); hide(); });
    on(tr, 'focus', () => {
      try {
        if (!tr.matches(':focus-visible')) return; // pointer focus does not open it
      } catch {
        // older engines without :focus-visible: show on every focus
      }
      clear();
      show(i);
    });
    on(tr, 'blur', () => { clear(); hide(); });
  });
  on(bubble, 'pointerenter', () => clearTimeout(hideTimer));
  on(bubble, 'pointerleave', hideSoon);
  on(doc, 'keydown', (e) => {
    if (e.key === 'Escape' && active.last !== -1) {
      clear();
      hide();
    }
  });

  const api = {
    root,
    bubble,
    tips,
    triggers,
    driver: d,
    keep: false,
    show,
    hide,
    active: (t) => (t === undefined ? active.last : active.at(t)),
    seek: (t) => paint(t, { reduced: d.reduced }),
    settled: (t) => t >= endT && settledAll(t),
    destroy() {
      clear();
      d.stop();
      for (const [el, type, fn] of listeners) el.removeEventListener(type, fn);
      // undo what this instance added, so it can be created again (React remounts)
      triggers.forEach((tr, i) => {
        for (const rel of ['aria-describedby', 'aria-labelledby']) {
          const ids = (tr.getAttribute(rel) || '').split(/\s+/).filter((x) => x && x !== tips[i].id);
          attr(tr, rel, ids.length ? ids.join(' ') : null);
        }
        attr(tr, 'data-state', null);
        tips[i].remove();
      });
    },
  };
  paint(d.now(), { reduced: d.reduced });
  return api;
}
