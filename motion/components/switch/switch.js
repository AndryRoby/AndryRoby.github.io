/*
 * ARLing Motion: Switch.
 * The thumb travels on the release spring (one small overshoot, under 3 %) and stretches a
 * little while pressed. The new track colour never blends through grey: it grows as a
 * circle from the point that was pressed, and the base colour switches only once the
 * circle covers the track.
 *
 * Markup:
 *   <button class="am-switch" role="switch" aria-checked="false" aria-label="Wi-Fi"></button>
 * The component adds the thumb and ink parts if they are missing.
 *
 * Keyboard (WAI-ARIA APG, switch): Space toggles (Enter too, as on any button); on an
 * element that is not a button the component handles both keys itself.
 * MIT licence.
 */
import { track, driver, springStep, settleTime, PRESETS } from '../../src/core.js';

// ------------------------------------------------------------------ shared helpers

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const px = (v) => `${Math.round(v * 100) / 100}px`;

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

/** Radius that covers a w by h box from the point (x, y). */
const cover = (x, y, w, h) => Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));

/**
 * Ink: a new colour grows as a circle from a point; the base colour switches only when the
 * circle covers the shape. list holds { t, color, x, y, R, sp } in time order.
 */
function inkAt(ink, t, reduced, layers = 2) {
  let base = ink.base;
  let active = [];
  for (const e of ink.list) {
    if (e.t > t) break;
    const p = reduced ? 1 : springStep(e.sp, t - e.t);
    if (p >= 1) { base = e.color; active = []; } else active.push({ color: e.color, r: p * e.R, x: e.x, y: e.y });
  }
  while (active.length > layers) base = active.shift().color;
  return { base, layers: active };
}
const inkSettled = (ink, t) => ink.list.every((e) => e.t > t || t >= e.t + settleTime(e.sp));

function paintInk(state, surface, els) {
  surface.style.background = state.base;
  els.forEach((el, i) => {
    const L = state.layers[i];
    if (!L) { el.style.visibility = 'hidden'; el.style.clipPath = ''; el.style.background = ''; return; }
    el.style.visibility = 'visible';
    el.style.background = L.color;
    el.style.clipPath = `circle(${px(L.r)} at ${px(L.x)} ${px(L.y)})`;
  });
}

// ------------------------------------------------------------------ switch

/** How far the thumb stretches while pressed, px. */
export const PRESS_STRETCH = 4;

/**
 * createSwitch({ el, checked, on, off, onChange, clock, reduced })
 * on / off: track colours (default var(--primary) and var(--input)).
 * Returns { toggle, set, press, release, checked, seek, settled, destroy, driver, keep }.
 */
export function createSwitch(o) {
  const el = o.el;
  const doc = el.ownerDocument || document;
  const isButton = el.tagName === 'BUTTON';
  attr(el, 'role', 'switch');
  if (isButton && !el.hasAttribute('type')) attr(el, 'type', 'button');
  if (!isButton && !el.hasAttribute('tabindex')) attr(el, 'tabindex', '0');
  const ON = o.on || 'var(--primary, #171717)';
  const OFF = o.off || 'var(--input, #e5e5e5)';

  const make = (cls) => { const s = doc.createElement('span'); s.className = cls; attr(s, 'aria-hidden', 'true'); el.appendChild(s); return s; };
  const inks = [...el.querySelectorAll('.am-switch-ink')];
  while (inks.length < 2) inks.push(make('am-switch-ink'));
  const thumb = el.querySelector('.am-switch-thumb') || make('am-switch-thumb');
  for (const part of [thumb, ...inks]) attr(part, 'aria-hidden', 'true');

  const initial = o.checked ?? el.getAttribute('aria-checked') === 'true';
  const state = steps(!!initial);
  const pos = track(initial ? 1 : 0, PRESETS.release);
  const press = track(0, PRESETS.press);
  const ink = { base: initial ? ON : OFF, list: [] };
  let endT = -Infinity;
  const mark = (t) => { if (t > endT) endT = t; };
  const settledAll = (t) => pos.settled(t) && press.settled(t) && inkSettled(ink, t);

  function measure() {
    const r = el.getBoundingClientRect();
    const W = r.width || 44;
    const H = r.height || 24;
    const T = Math.min(thumb.getBoundingClientRect().height || H - 4, H);
    const pad = (H - T) / 2;
    return { r, W, H, T, pad, travel: Math.max(0, W - T - 2 * pad) };
  }
  let g = measure();

  const disabled = () => el.disabled || el.getAttribute('aria-disabled') === 'true';

  function paint(t, { reduced }) {
    const c = state.at(t);
    attr(el, 'aria-checked', String(c));
    attr(el, 'data-state', c ? 'checked' : 'unchecked');
    const p = reduced ? pos.target(t) : pos.at(t);
    const s = reduced ? 0 : clamp01(press.at(t)) * PRESS_STRETCH;
    // pressed, the thumb widens toward the middle of the track
    thumb.style.width = px(g.T + s);
    thumb.style.transform = `translateX(${px(g.travel * p - s * clamp01(p))})`;
    paintInk(inkAt(ink, t, reduced), el, inks);
  }

  function draw(t, st) {
    paint(t, st);
    if (!api.keep && t >= endT && state.ev.length && settledAll(t)) {
      pos.compact(t);
      press.compact(t);
      state.compact();
      const lastInk = ink.list[ink.list.length - 1];
      if (lastInk) ink.base = lastInk.color;
      ink.list = [];
    }
  }

  const d = driver(draw, { clock: o.clock, reduced: o.reduced });
  d.busy = (t) => t < endT || !settledAll(t);
  const commit = () => { paint(d.now(), { reduced: d.reduced }); d.kick(); };
  const when = (opt) => (opt && opt.t !== undefined ? { t: opt.t, live: false } : { t: d.now(), live: true });

  /** Sets the state. opt: { t, x, y } where x, y is the page point the colour grows from. */
  function set(value, opt = {}) {
    const { t, live } = when(opt);
    const v = !!value;
    if (v === state.last || (live && disabled())) return api;
    g = measure();
    const p = state.last ? 1 : 0; // the thumb's resting place before this change
    const cx = opt.x !== undefined ? opt.x - g.r.left : g.pad + g.T / 2 + g.travel * p;
    const cy = opt.y !== undefined ? opt.y - g.r.top : g.H / 2;
    state.set(t, v);
    pos.to(t, v ? 1 : 0);
    ink.list.push({ t, color: v ? ON : OFF, x: cx, y: cy, R: cover(cx, cy, g.W, g.H), sp: PRESETS.snappy });
    ink.list.sort((a, b) => a.t - b.t);
    mark(t);
    commit();
    if (live && o.onChange) o.onChange(v);
    return api;
  }

  const toggle = (opt = {}) => set(!state.last, opt);
  function pressDown(opt = {}) {
    const { t } = when(opt);
    press.to(t, 1, PRESETS.press);
    mark(t);
    commit();
    return api;
  }
  function pressUp(opt = {}) {
    const { t } = when(opt);
    if (press.target(Infinity) === 0) return api;
    press.to(t, 0, PRESETS.release);
    mark(t);
    commit();
    return api;
  }

  // ---------------------------------------------------------------- live input
  const listeners = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); listeners.push([target, type, fn]); };
  on(el, 'pointerdown', () => { if (!disabled()) pressDown(); });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) on(el, type, () => pressUp());
  on(el, 'click', (e) => {
    if (disabled()) return;
    const pointer = e.detail > 0;
    toggle(pointer ? { x: e.clientX, y: e.clientY } : {});
  });
  if (!isButton) {
    on(el, 'keydown', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if (!disabled()) toggle();
    });
  }

  const api = {
    el,
    thumb,
    driver: d,
    keep: false,
    set,
    toggle,
    press: pressDown,
    release: pressUp,
    checked: (t) => (t === undefined ? state.last : state.at(t)),
    seek: (t) => paint(t, { reduced: d.reduced }),
    settled: (t) => t >= endT && settledAll(t),
    destroy() {
      d.stop();
      for (const [target, type, fn] of listeners) target.removeEventListener(type, fn);
    },
  };
  paint(d.now(), { reduced: d.reduced });
  return api;
}
