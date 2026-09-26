/*
 * ARLing Motion: Popover and dropdown Menu.
 * The surface unfolds out of its trigger as one shape (it starts as a strip as wide as the
 * trigger and grows to its full size), the items enter one after another, and in the menu
 * a single highlight slides from item to item instead of jumping.
 *
 * Markup:
 *   <div class="am-popover-root">
 *     <button class="am-popover-trigger">Actions</button>
 *     <div class="am-menu" role="menu" hidden>
 *       <button role="menuitem">Duplicate</button>
 *       <button role="menuitem">Rename</button>
 *       <button role="menuitem">Archive</button>
 *     </div>
 *   </div>
 * The component wraps the surface in .am-popover-frame (it carries the shadow) if needed.
 * A popover is the same with <div class="am-popover" role="dialog"> and any content.
 *
 * Keyboard (WAI-ARIA APG, menu button): Enter, Space or Down on the trigger opens and
 * focuses the first item, Up focuses the last; Up and Down move and wrap, Home and End
 * jump, a letter jumps to the next item starting with it, Enter or Space picks, Escape
 * closes and returns focus, Tab closes. Popover: Escape closes and returns focus, focus
 * or a pointer leaving it closes it.
 * MIT licence.
 */
import { track, presence, applyPresence, driver, spring, PRESETS } from '../../src/core.js';

// ------------------------------------------------------------------ shared helpers

const JUMP = spring(0.001, 1);
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

let uid = 0;
const ensureId = (el, prefix) => el.id || (el.id = `${prefix}-${++uid}`);

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]';
function tabbables(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled && el.tabIndex >= 0 && !el.closest('[hidden], [inert]'));
}

function radiusOf(el, fallback) {
  try {
    const v = parseFloat(getComputedStyle(el).borderTopLeftRadius);
    return Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

// ------------------------------------------------------------------ popover and menu

/** Stagger between items entering, seconds. */
export const ITEM_STEP = 0.03;

function createFloating(o, kind) {
  const isMenu = kind === 'menu';
  const trigger = o.trigger;
  const el = o.menu || o.popover || o.el;
  const doc = el.ownerDocument || document;

  let frame = el.parentElement;
  if (!frame || !frame.classList.contains('am-popover-frame')) {
    frame = doc.createElement('div');
    frame.className = 'am-popover-frame';
    el.parentNode.insertBefore(frame, el);
    frame.appendChild(el);
  }
  if (!el.hasAttribute('role')) attr(el, 'role', isMenu ? 'menu' : 'dialog');
  ensureId(el, isMenu ? 'am-menu' : 'am-popover');
  ensureId(trigger, 'am-popover-trigger');
  if (trigger.tagName === 'BUTTON' && !trigger.hasAttribute('type')) attr(trigger, 'type', 'button');
  attr(trigger, 'aria-haspopup', isMenu ? 'menu' : 'dialog');
  attr(trigger, 'aria-controls', el.id);
  if (!el.hasAttribute('aria-labelledby') && !el.hasAttribute('aria-label')) attr(el, 'aria-labelledby', trigger.id);
  if (!el.hasAttribute('tabindex')) attr(el, 'tabindex', '-1');

  let bar = null;
  if (isMenu) {
    bar = el.querySelector('.am-menu-highlight');
    if (!bar) {
      bar = doc.createElement('div');
      bar.className = 'am-menu-highlight';
      el.insertBefore(bar, el.firstElementChild);
    }
    attr(bar, 'aria-hidden', 'true');
  }
  const items = isMenu
    ? [...el.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')]
    : [...el.children].filter((c) => c !== bar);
  if (isMenu) items.forEach((it) => { attr(it, 'tabindex', '-1'); if (it.tagName === 'BUTTON' && !it.hasAttribute('type')) attr(it, 'type', 'button'); });

  const openS = steps(false);
  const geo = steps(null);
  const k = track(0, PRESETS.snappy);
  const pres = items.map(() => presence(false, { dyIn: -6, dyOut: -4, blur: 4, scaleFrom: 1 }));
  const hl = steps(-1);
  const hy = track(0, PRESETS.snappy);
  const hh = track(0, PRESETS.snappy);
  const ho = track(0, PRESETS.snappy);
  let endT = -Infinity;
  const mark = (t) => { if (t > endT) endT = t; };
  const all = () => [k, hy, hh, ho, ...pres.map((p) => p.p)];
  const settledAll = (t) => all().every((tr) => tr.settled(t));

  function withShown(fn) {
    const was = el.hidden;
    const clip = el.style.clipPath;
    el.hidden = false;
    el.style.clipPath = '';
    const out = fn();
    el.style.clipPath = clip;
    el.hidden = was;
    return out;
  }

  // At k = 0 the surface is a strip as wide as the trigger on the trigger's side, with no
  // height; at k = 1 it is the whole surface.
  function measure() {
    return withShown(() => {
      const pr = el.getBoundingClientRect();
      const tr = trigger.getBoundingClientRect();
      const start = Math.abs(pr.left - tr.left) <= Math.abs(pr.right - tr.right);
      const up = pr.bottom <= tr.top + 1;
      const side = Math.max(0, pr.width - Math.min(tr.width, pr.width));
      return {
        top: up ? pr.height : 0,
        bottom: up ? 0 : pr.height,
        left: start ? 0 : side,
        right: start ? side : 0,
        r: radiusOf(el, 8),
      };
    });
  }

  function itemBox(i) {
    return withShown(() => {
      const pr = el.getBoundingClientRect();
      const r = items[i].getBoundingClientRect();
      return { y: r.top - pr.top, h: r.height };
    });
  }

  function paint(t, { reduced }) {
    const isOpen = openS.at(t);
    const visible = isOpen || (!reduced && !settledAll(t));
    attr(trigger, 'aria-expanded', String(isOpen));
    attr(trigger, 'data-state', isOpen ? 'open' : 'closed');
    attr(el, 'data-state', isOpen ? 'open' : 'closed');
    el.hidden = !visible;
    const h = hl.at(t);
    if (isMenu) items.forEach((it, i) => attr(it, 'data-highlighted', i === h ? true : null));
    if (!visible) return;
    const g = geo.at(t);
    const kk = reduced ? 1 : clamp01(k.at(t));
    if (kk >= 1 || !g) el.style.clipPath = '';
    else {
      const f = 1 - kk;
      el.style.clipPath = `inset(${px(g.top * f)} ${px(g.right * f)} ${px(g.bottom * f)} ${px(g.left * f)} round ${px(g.r)})`;
    }
    items.forEach((it, i) => applyPresence(it, reduced ? (isOpen ? SHOWN : GONE) : pres[i].at(t)));
    if (bar) {
      const op = reduced ? (h === -1 ? 0 : 1) : clamp01(ho.at(t));
      bar.style.opacity = num(op);
      bar.style.visibility = op > 0.002 ? '' : 'hidden';
      bar.style.transform = `translateY(${px(reduced ? hy.target(t) : hy.at(t))})`;
      bar.style.height = px(reduced ? hh.target(t) : hh.at(t));
    }
  }

  function draw(t, s) {
    paint(t, s);
    if (!api.keep && t >= endT && openS.ev.length && settledAll(t)) {
      for (const tr of all()) tr.compact(t);
      for (const p of pres) p.marks = [];
      openS.compact();
      geo.compact();
      hl.compact();
    }
  }

  const d = driver(draw, { clock: o.clock, reduced: o.reduced });
  d.busy = (t) => t < endT || !settledAll(t);
  const commit = () => { paint(d.now(), { reduced: d.reduced }); d.kick(); };
  const when = (opt) => (opt && opt.t !== undefined ? { t: opt.t, live: false } : { t: d.now(), live: true });

  function open(opt = {}) {
    const { t, live } = when(opt);
    if (openS.last) return api;
    openS.set(t, true);
    geo.set(t, measure());
    k.to(t, 1, PRESETS.snappy);
    pres.forEach((p, i) => p.enter(t + 0.04 + i * ITEM_STEP));
    mark(t + 0.04 + items.length * ITEM_STEP);
    commit();
    if (live) {
      if (!isMenu) (tabbables(el)[0] || el).focus();
      else if (opt.focus !== false) el.focus();
      if (o.onOpenChange) o.onOpenChange(true);
    }
    return api;
  }

  function close(opt = {}) {
    const { t, live } = when(opt);
    if (!openS.last) return api;
    openS.set(t, false);
    for (const p of pres) p.exit(t);
    k.to(t + 0.05, 0, PRESETS.exit);
    if (hl.last !== -1) {
      hl.set(t, -1);
      ho.to(t, 0, PRESETS.exit);
    }
    mark(t + 0.05);
    commit();
    if (live) {
      if (opt.returnFocus !== false) trigger.focus();
      if (o.onOpenChange) o.onOpenChange(false);
    }
    return api;
  }

  const disabled = (i) => items[i].disabled || items[i].getAttribute('aria-disabled') === 'true';

  /** Menu: move the one highlight to item i (focus follows when live). */
  function highlight(i, opt = {}) {
    const { t, live } = when(opt);
    if (!isMenu || i < 0 || i >= items.length) return api;
    if (i !== hl.last) {
      const box = itemBox(i);
      const fresh = hl.last === -1;
      hy.to(t, box.y, fresh ? JUMP : PRESETS.snappy);
      hh.to(t, box.h, fresh ? JUMP : PRESETS.snappy);
      if (fresh) ho.to(t, 1, PRESETS.snappy);
      hl.set(t, i);
      mark(t);
      commit();
    }
    if (live) items[i].focus();
    return api;
  }

  /** Menu: pick item i, report it, close and return focus to the trigger. */
  function select(i, opt = {}) {
    if (!isMenu || i < 0 || i >= items.length || disabled(i)) return api;
    const { t, live } = when(opt);
    highlight(i, live ? {} : { t });
    if (live && o.onSelect) o.onSelect(i, items[i]);
    close(live ? {} : { t });
    return api;
  }

  const enabled = () => items.map((_, i) => i).filter((i) => !disabled(i));
  const move = (dir) => {
    const list = enabled();
    if (!list.length) return;
    const cur = list.indexOf(hl.last);
    const next = cur === -1 ? (dir > 0 ? 0 : list.length - 1) : (cur + dir + list.length) % list.length;
    highlight(list[next]);
  };

  // ---------------------------------------------------------------- live input
  const listeners = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); listeners.push([target, type, fn]); };

  on(trigger, 'click', (e) => {
    if (openS.last) { close({ returnFocus: false }); return; }
    const keyboard = !(e.detail > 0);
    open({ focus: !keyboard });
    if (isMenu && keyboard) move(1);
  });
  on(trigger, 'keydown', (e) => {
    if (!isMenu || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    e.preventDefault();
    open({ focus: false });
    move(e.key === 'ArrowDown' ? 1 : -1);
  });
  on(el, 'keydown', (e) => {
    if (!openS.last) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (!isMenu) return;
    const list = enabled();
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Home') { e.preventDefault(); if (list.length) highlight(list[0]); }
    else if (e.key === 'End') { e.preventDefault(); if (list.length) highlight(list[list.length - 1]); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (hl.last !== -1) select(hl.last); }
    else if (e.key === 'Tab') close({ returnFocus: false });
    else if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const ch = e.key.toLowerCase();
      const start = Math.max(0, list.indexOf(hl.last) + 1);
      for (let n = 0; n < list.length; n++) {
        const i = list[(start + n) % list.length];
        if (items[i].textContent.trim().toLowerCase().startsWith(ch)) { highlight(i); break; }
      }
    }
  });
  if (isMenu) {
    items.forEach((it, i) => {
      on(it, 'pointermove', () => { if (openS.last && hl.last !== i && !disabled(i)) highlight(i); });
      on(it, 'click', () => select(i));
    });
  }
  on(el, 'focusout', (e) => {
    const next = e.relatedTarget;
    if (!openS.last || !next || el.contains(next) || next === trigger) return;
    close({ returnFocus: false });
  });
  on(doc, 'pointerdown', (e) => {
    if (!openS.last) return;
    const target = e.target;
    if (frame.contains(target) || trigger.contains(target)) return;
    close({ returnFocus: false });
  });

  const api = {
    trigger,
    el,
    frame,
    items,
    driver: d,
    keep: false,
    open,
    close,
    toggle: (opt) => (openS.last ? close(opt) : open(opt)),
    isOpen: (t) => (t === undefined ? openS.last : openS.at(t)),
    seek: (t) => paint(t, { reduced: d.reduced }),
    settled: (t) => t >= endT && settledAll(t),
    destroy() {
      d.stop();
      for (const [target, type, fn] of listeners) target.removeEventListener(type, fn);
    },
  };
  if (isMenu) {
    api.highlight = highlight;
    api.select = select;
    api.highlighted = (t) => (t === undefined ? hl.last : hl.at(t));
  }
  paint(d.now(), { reduced: d.reduced });
  return api;
}

/**
 * createMenu({ trigger, menu, onSelect(index, item), onOpenChange, clock, reduced })
 * Returns { open, close, toggle, highlight, select, isOpen, highlighted, seek, settled, destroy, driver, keep }.
 */
export const createMenu = (o) => createFloating(o, 'menu');

/**
 * createPopover({ trigger, popover, onOpenChange, clock, reduced })
 * A non modal dialog anchored to its trigger. Returns { open, close, toggle, isOpen, seek, settled, destroy, driver, keep }.
 */
export const createPopover = (o) => createFloating(o, 'popover');
