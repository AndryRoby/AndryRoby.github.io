/*
 * ARLing Motion: Slider.
 * A slider whose thumb grows a little while you hold it and springs back to its size when you
 * let go. While you drag, the thumb follows the pointer through a very short spring without
 * overshoot; on release it settles on the nearest step and keeps the speed it had. A press on
 * the track glides the thumb there, and the keys glide it on the same spring. A bubble above
 * the thumb shows the value through your formatter ("400 conversations", "19 €"); near the ends
 * it stays inside the slider and its tail keeps pointing at the thumb. Every position is a pure
 * function of time, so seek(t) paints any moment of a scheduled drag.
 *
 * Markup:
 *   <div class="am-slider" aria-label="Conversations per month"
 *        data-min="0" data-max="2000" data-step="50" data-value="400"></div>
 * The component adds the parts that are missing: the track (.am-slider-track) with its range
 * (.am-slider-range), the thumb (.am-slider-thumb, role="slider", the one focusable part) and
 * the bubble (.am-slider-bubble). A name on the root (aria-label or aria-labelledby) moves to
 * the thumb. Horizontal, left to right.
 *
 * Keyboard (WAI-ARIA APG, slider): Right and Up add one step, Left and Down take one away,
 * Page Up and Page Down move by a big step (a tenth of the range by default), Home and End go
 * to the minimum and the maximum. The thumb carries aria-valuemin, aria-valuemax,
 * aria-valuenow and aria-valuetext (the formatted value). The bubble is aria-hidden.
 * Pointer: mouse, pen and touch through pointer events with pointer capture; the root has
 * touch-action: none.
 * MIT licence.
 */
import { track, presence, driver, steps, attr, spring, PRESETS } from '../../src/core.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const round2 = (v) => Math.round(v * 100) / 100;
const round4 = (v) => Math.round(v * 1e4) / 1e4;
const px = (v) => `${round2(v)}px`;

/** While you drag, the thumb follows the pointer through this spring: quick, no overshoot. */
export const FOLLOW = spring(0.1, 1);
/** Scale of the thumb while it is held. */
export const HOLD_SCALE = 1.2;
/** The bubble grows by this share while the thumb is held. */
export const BUBBLE_GROW = 0.06;
/** When the bubble shows: while the thumb is held or has keyboard focus, always, or never. */
export const BUBBLE_MODES = ['active', 'always', 'none'];
/** Samples per second of a scheduled drag (demos and video). */
export const DRAG_RATE = 120;
/** Easing of a scheduled pointer path. */
export const EASE = {
  linear: (u) => u,
  in: (u) => u * u,
  out: (u) => 1 - (1 - u) * (1 - u),
  inOut: (u) => u * u * (3 - 2 * u),
};
/** The bubble's tail keeps this far from its rounded ends, px. */
const TAIL_INSET = 10;
const BUBBLE_MOTION = { dyIn: 6, dyOut: 4, blur: 3, scaleFrom: 0.85 };
const SHOWN = { opacity: 1, blur: 0, y: 0, scale: 1, visible: true };

const decimalsOf = (n) => {
  const s = String(n);
  const i = s.indexOf('.');
  return i < 0 || /e/i.test(s) ? 0 : s.length - i - 1;
};

/** The value on the grid min + k * step nearest to v, kept inside [min, max]. */
export function snapValue(v, min, max, step) {
  if (!(max > min)) return min;
  const s = step > 0 ? step : 1;
  const dec = Math.max(decimalsOf(s), decimalsOf(min));
  const r = Number((min + Math.round((v - min) / s) * s).toFixed(dec));
  return r < min ? min : r > max ? max : r;
}

/**
 * createSlider({ root, min, max, step, bigStep, value, format, locale, prefix, suffix, bubble,
 *   label, disabled, onChange, onCommit, clock, reduced })
 * format(value) returns the text of the bubble and of aria-valuetext (default: the number in
 * the locale with prefix and suffix). onChange(value) runs whenever user input changes the
 * value, onCommit(value) when a drag, a press on the track or a key ends with a new value.
 * drag(value, { t, duration, ease }), tap(value, { t }) and key(name, { t }) schedule input for
 * demos. Returns { set, value, text, key, drag, tap, offsetOf, measure, seek, settled, destroy,
 * driver, bounds, root, thumb, track, range, bubble, keep }.
 */
export function createSlider(o) {
  const root = o.root;
  const doc = root.ownerDocument || document;
  const data = (k) => (root.hasAttribute(`data-${k}`) ? root.getAttribute(`data-${k}`) : undefined);
  const num = (v, fallback) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? fallback : Number(v));

  const min = num(o.min ?? data('min'), 0);
  const max = Math.max(min, num(o.max ?? data('max'), 100));
  const stepIn = num(o.step ?? data('step'), 1);
  const step = stepIn > 0 ? stepIn : 1;
  const bigIn = num(o.bigStep ?? data('big-step'), 0);
  const bigStep = bigIn > 0 ? bigIn : Math.max(step, Math.round((max - min) / 10 / step) * step);
  const snap = (v) => snapValue(v, min, max, step);
  const frac = (v) => (max > min ? clamp01((v - min) / (max - min)) : 0);
  const fromFrac = (f) => snap(min + clamp01(f) * (max - min));

  const locale = o.locale ?? data('locale') ?? 'en-US';
  const prefix = o.prefix ?? data('prefix') ?? '';
  const suffix = o.suffix ?? data('suffix') ?? '';
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: Math.max(decimalsOf(step), decimalsOf(min)) });
  const format = (v) => {
    const s = o.format ? o.format(v) : undefined;
    return s === undefined || s === null ? `${prefix}${nf.format(v)}${suffix}` : String(s);
  };
  const asked = o.bubble === false ? 'none' : o.bubble ?? data('bubble');
  const mode = BUBBLE_MODES.includes(asked) ? asked : 'active';

  // ---------------------------------------------------------------- parts
  const make = (cls, parent) => {
    const s = doc.createElement('span');
    s.className = cls;
    parent.appendChild(s);
    return s;
  };
  root.classList.add('am-slider');
  const rail = root.querySelector('.am-slider-track') || make('am-slider-track', root);
  const range = rail.querySelector('.am-slider-range') || make('am-slider-range', rail);
  const thumb = root.querySelector('.am-slider-thumb') || make('am-slider-thumb', root);
  let bubble = root.querySelector('.am-slider-bubble');
  if (mode === 'none') {
    if (bubble) bubble.style.visibility = 'hidden';
    bubble = null;
  } else if (!bubble) bubble = make('am-slider-bubble', root);
  attr(rail, 'aria-hidden', 'true');
  if (bubble) attr(bubble, 'aria-hidden', 'true');

  attr(thumb, 'role', 'slider');
  for (const name of ['aria-label', 'aria-labelledby']) {
    if (!root.hasAttribute(name)) continue;
    if (!thumb.hasAttribute(name)) attr(thumb, name, root.getAttribute(name));
    root.removeAttribute(name);
  }
  if (o.label) attr(thumb, 'aria-label', o.label);
  attr(thumb, 'aria-valuemin', String(min));
  attr(thumb, 'aria-valuemax', String(max));
  if (o.disabled !== undefined) attr(root, 'data-disabled', o.disabled ? true : null);
  if (thumb.getAttribute('aria-disabled') === 'true') attr(root, 'data-disabled', true);
  const disabled = () => root.hasAttribute('data-disabled');

  // ---------------------------------------------------------------- geometry, measured per gesture and on resize
  function measureGeo() {
    const r = root.getBoundingClientRect();
    const W = root.offsetWidth || r.width || 0;
    const T = Math.min(thumb.offsetWidth || 0, W);
    // k: screen pixels per layout pixel, for a slider inside a scaled parent
    return { left: r.left, k: W > 0 && r.width > 0 ? r.width / W : 1, W, T };
  }
  let geo = measureGeo();
  const travel = () => Math.max(0, geo.W - geo.T);
  /** The fraction of the way under a page x (not clamped). */
  const fracAt = (clientX) => {
    const run = travel();
    return run > 0 ? ((clientX - geo.left) / geo.k - geo.T / 2) / run : 0;
  };
  /** Horizontal distance from the centre of the root to the centre of the thumb at value, px. */
  const offsetOf = (value) => geo.T / 2 + frac(value) * travel() - geo.W / 2;

  // ---------------------------------------------------------------- state as functions of time
  const v0 = snap(num(o.value ?? data('value'), min));
  const x = track(frac(v0), FOLLOW); // the thumb, as a fraction of the way
  const press = track(0, PRESETS.press);
  const held = steps(false);
  const pres = bubble && mode === 'active' ? presence(false, BUBBLE_MOTION) : null;
  let bubbleOn = false;
  let keyboard = false;
  let endT = -Infinity;
  const mark = (t) => { if (t > endT) endT = t; };
  const settledAll = (t) => x.settled(t) && press.settled(t) && (!pres || pres.settled(t));
  /** The value at time t: the step nearest to where the pointer or the last key aimed. */
  const valueAt = (t) => fromFrac(x.target(t));

  let shownText = null;
  let bw = 0;

  function paint(t, { reduced }) {
    const v = valueAt(t);
    const text = format(v);
    const off = disabled();
    attr(thumb, 'aria-valuenow', String(v));
    attr(thumb, 'aria-valuetext', text);
    attr(thumb, 'aria-disabled', off ? 'true' : null);
    attr(thumb, 'tabindex', off ? '-1' : '0');
    const on = held.at(t);
    attr(thumb, 'data-state', on ? 'active' : 'idle');
    attr(root, 'data-state', on ? 'active' : 'idle');

    const f = clamp01(reduced ? x.target(t) : x.at(t));
    const p = reduced ? 0 : press.at(t);
    const s = 1 + (HOLD_SCALE - 1) * p;
    const run = travel();
    const cx = geo.T / 2 + f * run;
    thumb.style.transform = `translateX(${px(f * run)}) scale(${round4(s)})`;
    // the range ends under the centre of the thumb; the track's rounded clip shapes its start
    range.style.transform = `scaleX(${round4(geo.W > 0 ? cx / geo.W : f)})`;
    if (!bubble) return;

    if (text !== shownText) {
      bubble.textContent = text;
      shownText = text;
      bw = bubble.offsetWidth || 0; // once per new text, never per frame
    }
    const st = pres ? (reduced ? pres.still(t) : pres.at(t)) : SHOWN;
    const lift = ((s - 1) * geo.T) / 2; // keeps the gap to the growing thumb
    let left = cx;
    let tail = 0;
    let centre = ' translateX(-50%)';
    if (bw > 0 && geo.W > 0) {
      left = bw >= geo.W ? (geo.W - bw) / 2 : Math.min(Math.max(cx - bw / 2, 0), geo.W - bw);
      const lim = Math.max(0, bw / 2 - TAIL_INSET);
      tail = Math.max(-lim, Math.min(lim, cx - left - bw / 2));
      centre = '';
    }
    bubble.style.transform = `translate(${px(left)}, ${px(st.y - lift)})${centre} scale(${round4(st.scale * (1 + BUBBLE_GROW * p))})`;
    bubble.style.transformOrigin = bw > 0 ? `${px(bw / 2 + tail)} 100%` : '50% 100%';
    bubble.style.setProperty('--am-slider-tail', px(tail));
    bubble.style.opacity = String(Math.round(st.opacity * 1000) / 1000);
    bubble.style.filter = st.blur > 0.05 ? `blur(${st.blur.toFixed(2)}px)` : '';
    bubble.style.visibility = st.visible ? 'visible' : 'hidden';
  }

  let live = null; // a pointer that holds the thumb: { id, offset, from }

  function draw(t, st) {
    paint(t, st);
    if (!api.keep && !live && t >= endT && settledAll(t)) {
      x.compact(t);
      press.compact(t);
      held.compact();
      if (pres) {
        pres.p.compact(t);
        pres.marks = pres.marks.slice(-1);
      }
    }
  }

  const d = driver(draw, { clock: o.clock, reduced: o.reduced });
  d.busy = (t) => !!live || t < endT || !settledAll(t);
  const commit = () => { paint(d.now(), { reduced: d.reduced }); d.kick(); };
  const when = (opt) => (opt && opt.t !== undefined ? { t: opt.t, live: false } : { t: d.now(), live: true });

  // ---------------------------------------------------------------- changes (in time order)
  function showBubble(t) {
    if (!pres) return;
    const want = held.last || keyboard;
    if (want === bubbleOn) return;
    bubbleOn = want;
    if (want) pres.enter(t);
    else pres.exit(t);
    mark(t);
  }

  /** Aims the thumb at fraction f from time t on spring sp. */
  function aim(t, f, sp) {
    const g = clamp01(f);
    if (Math.abs(g - x.target(Infinity)) < 1e-12) return;
    x.to(t, g, sp);
    mark(t);
  }

  /** The thumb is taken: it grows and the bubble shows. */
  function grab(t) {
    keyboard = false;
    held.set(t, true);
    press.to(t, 1, PRESETS.press);
    showBubble(t);
    mark(t);
  }

  /** The thumb is let go: it settles on the step from its speed and springs back to its size. */
  function letGo(t) {
    aim(t, frac(valueAt(Infinity)), PRESETS.snappy);
    held.set(t, false);
    press.to(t, 0, PRESETS.release);
    showBubble(t);
    mark(t);
  }

  let reported = v0;
  const emit = () => {
    const v = valueAt(Infinity);
    if (v === reported) return;
    reported = v;
    if (o.onChange) o.onChange(v);
  };
  const done = (from) => {
    const v = valueAt(Infinity);
    if (v !== from && o.onCommit) o.onCommit(v);
  };

  /** Moves to value (snapped to the step) on the snappy spring. No callbacks. opt: { t }. */
  function set(value, opt = {}) {
    const { t } = when(opt);
    const v = snap(num(value, valueAt(Infinity)));
    aim(t, frac(v), PRESETS.snappy);
    reported = v;
    commit();
    return api;
  }

  /** The value a key leads to from v, or null when the key does not move a slider. */
  function keyTarget(name, v) {
    switch (name) {
      case 'ArrowRight': case 'ArrowUp': return v + step;
      case 'ArrowLeft': case 'ArrowDown': return v - step;
      case 'PageUp': return v + bigStep;
      case 'PageDown': return v - bigStep;
      case 'Home': return min;
      case 'End': return max;
      default: return null;
    }
  }

  function applyKey(name, t, now) {
    const from = valueAt(Infinity);
    const to = keyTarget(name, from);
    if (to === null) return false;
    if (now && disabled()) return true;
    keyboard = true;
    showBubble(t);
    aim(t, frac(snap(to)), PRESETS.snappy);
    commit();
    if (now) {
      emit();
      done(from);
    }
    return true;
  }

  /** A key on the thumb (ArrowRight, PageUp, Home and so on). opt: { t } to schedule it. */
  function key(name, opt = {}) {
    const { t, live: now } = when(opt);
    applyKey(name, t, now);
    return api;
  }

  /** Scheduled drag for demos: the pointer takes the thumb where it is and moves it to value. */
  function drag(value, opt = {}) {
    const t0 = opt.t ?? d.now();
    const dur = Math.max(1 / DRAG_RATE, opt.duration ?? 0.5);
    const ease = EASE[opt.ease] || EASE.inOut;
    const f0 = x.target(t0);
    const f1 = frac(num(value, min));
    grab(t0);
    const n = Math.max(1, Math.ceil(dur * DRAG_RATE));
    for (let k = 1; k <= n; k++) x.to(t0 + (dur * k) / n, f0 + (f1 - f0) * ease(k / n), FOLLOW);
    letGo(t0 + dur);
    commit();
    return api;
  }

  /** Scheduled press on the track for demos: the thumb glides to value. opt: { t, hold }. */
  function tap(value, opt = {}) {
    const t = opt.t ?? d.now();
    const hold = opt.hold ?? 0.12;
    grab(t);
    aim(t, frac(num(value, min)), PRESETS.snappy);
    letGo(t + hold);
    commit();
    return api;
  }

  /** Re-measure after a layout change; positions are fractions, so nothing is planned again. */
  function measure() {
    geo = measureGeo();
    shownText = null; // measure the bubble again too
    commit();
    return api;
  }

  // ---------------------------------------------------------------- live input
  const listeners = [];
  const on = (el, type, fn) => { el.addEventListener(type, fn); listeners.push([el, type, fn]); };
  let pointerFocus = false;

  on(root, 'pointerdown', (e) => {
    if (live || disabled() || (e.button !== undefined && e.button !== 0)) return;
    e.preventDefault(); // no text selection, and no mouse down that would move focus away
    geo = measureGeo();
    const t = d.now();
    const f = fracAt(e.clientX);
    const onThumb = !!(e.target && thumb.contains(e.target));
    const shown = clamp01(d.reduced ? x.target(t) : x.at(t));
    live = { id: e.pointerId, offset: onThumb ? shown - f : 0, from: valueAt(Infinity) };
    pointerFocus = true;
    try { thumb.focus({ preventScroll: true }); } finally { pointerFocus = false; }
    grab(t);
    // on the thumb it stays under the pointer; on the track it glides to the pointer
    if (onThumb) aim(t, shown, FOLLOW);
    else aim(t, f, PRESETS.snappy);
    if (root.setPointerCapture && e.pointerId !== undefined) {
      try { root.setPointerCapture(e.pointerId); } catch { /* not captured */ }
    }
    commit();
    emit();
  });
  const mine = (e) => live && (live.id === undefined || e.pointerId === undefined || e.pointerId === live.id);
  on(root, 'pointermove', (e) => {
    if (!mine(e)) return;
    aim(d.now(), fracAt(e.clientX) + live.offset, FOLLOW);
    commit();
    emit();
  });
  const finish = (e) => {
    if (!mine(e)) return;
    const { id, from } = live;
    live = null;
    if (root.releasePointerCapture && id !== undefined) {
      try { root.releasePointerCapture(id); } catch { /* already released */ }
    }
    letGo(d.now());
    commit();
    emit();
    done(from);
  };
  on(root, 'pointerup', finish);
  on(root, 'pointercancel', finish);
  on(root, 'lostpointercapture', finish);
  on(thumb, 'keydown', (e) => {
    if (applyKey(e.key, d.now(), true)) e.preventDefault();
  });
  // keyboard focus shows the bubble (like :focus-visible); focus from a pointer does not
  on(thumb, 'focus', () => {
    if (pointerFocus || live) return;
    keyboard = true;
    showBubble(d.now());
    commit();
  });
  on(thumb, 'blur', () => {
    if (!keyboard) return;
    keyboard = false;
    showBubble(d.now());
    commit();
  });

  let ro = null;
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => measure());
    ro.observe(root);
  }

  const api = {
    root,
    thumb,
    track: rail,
    range,
    bubble,
    driver: d,
    keep: false,
    bounds: { min, max, step, bigStep },
    set,
    key,
    drag,
    tap,
    measure,
    offsetOf,
    /** The value now, or at time t of a scheduled timeline. */
    value: (t) => valueAt(t === undefined ? Infinity : t),
    text: (t) => format(valueAt(t === undefined ? Infinity : t)),
    seek: (t) => paint(t, { reduced: d.reduced }),
    settled: (t) => !live && t >= endT && settledAll(t),
    destroy() {
      d.stop();
      if (ro) ro.disconnect();
      for (const [el, type, fn] of listeners) el.removeEventListener(type, fn);
    },
  };
  paint(d.now(), { reduced: d.reduced });
  return api;
}
