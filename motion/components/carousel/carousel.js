/*
 * ARLing Motion: Carousel.
 * The active slide sits in the middle, whole, and its neighbours peek out on both sides under a
 * soft fade (mask-image), so a slide is never cut off in the middle of a sentence. Every slide
 * has one resting place and every step is the same length, the last one too.
 *
 * The strip follows your pointer 1:1 (mouse, pen and touch, with pointer capture) and resists
 * past the first and the last slide the way iOS does. A touch on a moving strip catches it where
 * it is. When you let go, one spring starts from where the strip is and how fast your hand moved
 * and lands on a slide without a wobble: a flick always moves on at least one slide in its
 * direction and never back against it, a strong flick several. At the ends a throw may run past
 * by at most BOUNCE px before it comes back. The buttons, the dots, the arrow keys and a sideways
 * trackpad swipe glide on the same spring, and a new change continues from the current speed.
 *
 * Only transform moves (translate3d on the track, whole pixels at rest). The dots indicator is a
 * pure function of where the strip is: it follows your drag and stretches across the dots on a
 * throw, like a caterpillar. Every state is a pure function of time, so seek(t) paints any
 * moment of a scheduled demo.
 *
 * Markup (WAI-ARIA APG, carousel without auto rotation):
 *   <section class="am-carousel" aria-roledescription="carousel" aria-label="Featured">
 *     <div class="am-carousel-viewport">
 *       <div class="am-carousel-track">
 *         <div class="am-carousel-slide">...</div>
 *       </div>
 *     </div>
 *     <div class="am-carousel-controls">
 *       <div class="am-carousel-dots"></div>
 *       <button class="am-carousel-prev" aria-label="Previous slide"></button>
 *       <button class="am-carousel-next" aria-label="Next slide"></button>
 *     </div>
 *   </section>
 * Slides get role="group", aria-roledescription="slide" and "3 of 5" as their name; slides not
 * wholly in view are inert. The component adds a visually hidden polite status
 * (.am-carousel-status) that says "Slide 3 of 5" after a change. The dots are optional: an empty
 * .am-carousel-dots gets one dot per slide and the indicator; they are a pointer shortcut and
 * aria-hidden, because the buttons and the keys do the same for everyone.
 *
 * Keyboard: the Previous and Next buttons (Enter or Space); Left and Right, Home and End
 * anywhere inside the carousel except in a text field. At the ends the button gets
 * aria-disabled="true" and stays focusable. When the slide that held the focus leaves the view,
 * the focus moves to the new slide. Left to right layouts only.
 * MIT licence.
 */
import { track, driver, steps, attr, spring, springDisp, JUMP } from '../../src/core.js';

// ------------------------------------------------------------------ helpers

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const px = (v) => `${Math.round(v * 100) / 100}px`;
const round4 = (v) => Math.round(v * 1e4) / 1e4;
const smooth = (u) => u * u * (3 - 2 * u);

let uid = 0;
const ensureId = (el, prefix) => el.id || (el.id = `${prefix}-${++uid}`);

/** Easing of a scheduled pointer path, with its slope (for the release velocity). */
export const EASE = {
  linear: [(u) => u, () => 1],
  in: [(u) => u * u, (u) => 2 * u],
  out: [(u) => 1 - (1 - u) * (1 - u), (u) => 2 * (1 - u)],
  inOut: [(u) => u * u * (3 - 2 * u), (u) => 6 * u * (1 - u)],
};

// ------------------------------------------------------------------ constants

/**
 * Every landing runs on this spring: no overshoot, a 292 px step is within 1 px after 0.43 s
 * and home after 0.76 s. (v1 used spring(0.56, 0.8): 4.4 px past the slide and 1.2 s to rest.)
 */
export const LAND = spring(0.4, 0.95);
/**
 * Seconds of the throw added to the release position before choosing a slide. It is where LAND
 * starts without any acceleration (2 * damping / omega = damping * response / pi = 0.121 s), so
 * at the release the spring neither surges ahead of the hand nor brakes it. (v1 used 0.2 s.)
 */
export const THROW = (LAND.damping * LAND.response) / Math.PI;
/** A release at least this fast (px per second) always moves on at least one slide in its direction. */
export const FLICK = 300;
/** Resistance past either end, as on iOS: x px of pull show d * (1 - 1 / (1 + RUBBER * x / d)), d the viewport width. */
export const RUBBER = 0.55;
/** A throw may run past the first or the last slide by at most this many px before it comes back. */
export const BOUNCE = 40;
/** The release speed is the pointer's average speed over this many last seconds. */
export const VELOCITY_WINDOW = 0.06;
/** A pointer must move this far sideways before a drag starts, px; the drag then starts from there. */
export const SLOP = 4;
/** A sideways wheel or trackpad swipe of this many px moves one slide, one slide per gesture. */
export const WHEEL_STEP = 40;
/** A pause this long between wheel events (seconds) starts a new gesture. */
const WHEEL_GAP = 0.18;
/** The stiffest landing a capped bounce may ask for, seconds of response. */
const MIN_RESPONSE = 0.12;

// ------------------------------------------------------------------ pointer path

/** A recorded pointer path [[t, offset]] as a pure function of time; ends at velocity v. */
function pathFn(samples, v) {
  const [t1, end] = samples[samples.length - 1];
  const tail = 1 / 480;
  return (t) => {
    if (t >= t1 - tail) return end + v * (t - t1);
    if (t <= samples[0][0]) return samples[0][1];
    for (let i = 1; i < samples.length; i++) {
      const [tb, b] = samples[i];
      if (t <= tb) {
        const [ta, a] = samples[i - 1];
        return tb === ta ? b : a + ((b - a) * (t - ta)) / (tb - ta);
      }
    }
    return end;
  };
}

/**
 * The pointer's speed at the release, px per second: its average over the last `window` seconds
 * of samples [[t, offset, eventTime?]]. The event times (e.timeStamp) are used when every sample
 * has one, because they do not jitter with the moment a handler happens to run. A pointer that
 * stood still for the whole window before the release has speed 0.
 */
export function releaseVelocity(samples, window = VELOCITY_WINDOW) {
  const n = samples.length;
  if (n < 2) return 0;
  const stamped = samples.every((s) => typeof s[2] === 'number');
  const T = (s) => (stamped ? s[2] : s[0]);
  const t1 = T(samples[n - 1]);
  const end = samples[n - 1][1];
  const from = t1 - window;
  if (T(samples[0]) >= from) {
    const dt = t1 - T(samples[0]);
    return dt > 0 ? (end - samples[0][1]) / dt : 0;
  }
  for (let i = n - 1; i > 0; i--) {
    const a = samples[i - 1];
    if (T(a) > from) continue;
    const b = samples[i];
    const ta = T(a);
    const tb = T(b);
    const p = tb > ta ? a[1] + ((b[1] - a[1]) * (from - ta)) / (tb - ta) : b[1];
    return (end - p) / window;
  }
  return 0;
}

/** The dots indicator at progress p (1.5 = halfway from the second slide to the third): its edges in dots. */
export function worm(p, count) {
  if (count < 2 || !(p > 0)) return { from: 0, to: 0 };
  if (p >= count - 1) return { from: count - 1, to: count - 1 };
  const k = Math.floor(p);
  const f = p - k;
  // the leading edge travels in the first half, the trailing edge catches up in the second
  return { from: k + smooth(clamp01(2 * f - 1)), to: k + smooth(clamp01(2 * f)) };
}

// ------------------------------------------------------------------ carousel

/**
 * createCarousel({ root, index, from, onChange, clock, reduced })
 * index: the slide shown first. from: { index, x, v } from handoff() of another instance on the
 * same markup (for example a demo); the strip then continues from that position and speed.
 * drag(dx, { t, duration, ease }) schedules a pointer drag for demos.
 * Returns { go, next, prev, drag, index, count, step, progress, handoff, measure, seek, settled,
 * destroy, driver, root, viewport, track, slides, prevButton, nextButton, dots, indicator,
 * status, keep }.
 */
export function createCarousel(o) {
  const root = o.root;
  const doc = root.ownerDocument || document;
  const viewport = root.querySelector('.am-carousel-viewport');
  const strip = root.querySelector('.am-carousel-track');
  const slides = [...strip.querySelectorAll('.am-carousel-slide')];
  const prevButton = root.querySelector('.am-carousel-prev');
  const nextButton = root.querySelector('.am-carousel-next');
  const dotsBox = root.querySelector('.am-carousel-dots');
  if (!slides.length) throw new Error('createCarousel: no .am-carousel-slide');
  const n = slides.length;

  attr(root, 'aria-roledescription', 'carousel');
  if (root.tagName !== 'SECTION' && !root.hasAttribute('role')) attr(root, 'role', 'region');
  // the status below speaks for every change; a live strip as well would say it twice
  attr(strip, 'aria-live', null);
  ensureId(strip, 'am-carousel-track');
  slides.forEach((s, i) => {
    attr(s, 'role', 'group');
    attr(s, 'aria-roledescription', 'slide');
    if (!s.hasAttribute('aria-label') && !s.hasAttribute('aria-labelledby')) attr(s, 'aria-label', `${i + 1} of ${n}`);
  });
  for (const b of [prevButton, nextButton]) {
    if (!b) continue;
    if (b.tagName === 'BUTTON' && !b.hasAttribute('type')) attr(b, 'type', 'button');
    attr(b, 'aria-controls', strip.id);
  }
  if (prevButton && !prevButton.hasAttribute('aria-label') && !prevButton.textContent.trim()) attr(prevButton, 'aria-label', 'Previous slide');
  if (nextButton && !nextButton.hasAttribute('aria-label') && !nextButton.textContent.trim()) attr(nextButton, 'aria-label', 'Next slide');

  let status = root.querySelector('.am-carousel-status');
  if (!status) {
    status = doc.createElement('div');
    status.className = 'am-carousel-status';
    root.appendChild(status);
  }
  attr(status, 'aria-live', 'polite');
  attr(status, 'aria-atomic', 'true');

  let dots = [];
  let indicator = null;
  if (dotsBox) {
    attr(dotsBox, 'aria-hidden', 'true');
    dots = [...dotsBox.querySelectorAll('.am-carousel-dot')];
    indicator = dotsBox.querySelector('.am-carousel-indicator');
    if (dots.length !== n || !indicator) {
      dotsBox.textContent = '';
      dots = slides.map(() => {
        const dot = doc.createElement('span');
        dot.className = 'am-carousel-dot';
        dotsBox.appendChild(dot);
        return dot;
      });
      indicator = doc.createElement('span');
      indicator.className = 'am-carousel-indicator';
      dotsBox.appendChild(indicator);
    }
  }

  // ---------------------------------------------------------------- geometry
  // The translateX painted last. Boxes are read with getBoundingClientRect, which includes it,
  // so it is taken off again to find where slide 0 sits in the resting strip.
  let shown = 0;
  strip.style.transform = ''; // a previous instance may have left its transform
  function measureGeo() {
    const vr = viewport.getBoundingClientRect();
    const rects = slides.map((s) => s.getBoundingClientRect());
    const r0 = rects[0];
    const off = r0.left - vr.left - shown;
    const boxes = rects.map((r) => ({ left: r.left - r0.left, width: r.width }));
    // the translateX that puts the middle of slide i in the middle of the viewport, whole px
    const snaps = boxes.map((b) => Math.round(vr.width / 2 - off - b.left - b.width / 2));
    return { vw: vr.width, off, boxes, snaps };
  }
  let geo = measureGeo();

  const clampIndex = (i) => Math.max(0, Math.min(n - 1, i));
  const from = o.from && Number.isFinite(o.from.x) ? o.from : null;
  const first = clampIndex(Math.round(from && Number.isFinite(from.index) ? from.index : o.index ?? 0));
  const idx = steps(first);
  let x = track(geo.snaps[first], LAND);
  // Every change since the last compaction, kept so measure() can plan them again on a new
  // layout without touching the timeline of a scheduled demo (api.keep).
  let plan = [];
  let live = null; // a pointer on the strip: { id, t0, grab, startX, startY, ox, off, samples, active, caught }
  let moved = false;
  let endT = -Infinity;
  const mark = (t) => { if (t > endT) endT = t; };
  const settledAll = (t) => x.settled(t);

  // ---------------------------------------------------------------- rubber band past the ends
  const band = (over) => { const d = geo.vw || 1; return d * (1 - 1 / (1 + (RUBBER * over) / d)); };
  const unband = (y) => { const d = geo.vw || 1; const c = Math.min(y, d * 0.999); return (d / RUBBER) * (c / (d - c)); };
  /** Pull (where the pointer would put the strip) to what is shown: past an end it resists. */
  const shape = (v) => {
    const hi = geo.snaps[0];
    const lo = geo.snaps[n - 1];
    return v > hi ? hi + band(v - hi) : v < lo ? lo - band(lo - v) : v;
  };
  /** The inverse of shape: grabbing a strip that is past an end does not make it jump. */
  const unshape = (v) => {
    const hi = geo.snaps[0];
    const lo = geo.snaps[n - 1];
    return v > hi ? hi + unband(v - hi) : v < lo ? lo - unband(lo - v) : v;
  };
  /** How many px the strip moves per px of pull at pull v (1 between the ends, less past them). */
  const slope = (v) => {
    const hi = geo.snaps[0];
    const lo = geo.snaps[n - 1];
    const over = v > hi ? v - hi : v < lo ? lo - v : 0;
    if (!over) return 1;
    const q = 1 + (RUBBER * over) / (geo.vw || 1);
    return RUBBER / (q * q);
  };
  /**
   * The strip during a drag from grab along offset(t), released at t1 with pointer speed v.
   * In its last TAIL seconds it runs straight at the shown speed, so the speed the track reads
   * for its spring is exact even when the release is right at an end, where the rubber band
   * bends (read across the bend, a test throw gave the spring 4262 instead of 3264 px/s).
   */
  const TAIL = 1 / 480;
  const dragPath = (offset, t1, v) => (t, grab) => {
    const u = unshape(grab);
    if (t < t1 - TAIL) return shape(u + offset(t));
    const r = u + offset(t1);
    return shape(r) + slope(r) * v * (t - t1);
  };

  const holding = (t) => !!live && (live.active || live.caught) && t >= live.t0;
  function xAt(t, reduced) {
    if (holding(t)) return shape(unshape(live.grab) + live.off);
    return reduced ? x.target(t) : x.at(t);
  }

  /** Where the strip is, in slides: 1.5 is halfway from the second slide to the third. */
  function progressOf(v) {
    const s = geo.snaps;
    if (n < 2 || v >= s[0]) return 0;
    if (v <= s[n - 1]) return n - 1;
    let k = 0;
    while (k < n - 2 && v < s[k + 1]) k++;
    const span = s[k] - s[k + 1];
    return span > 0 ? k + (s[k] - v) / span : k;
  }

  // ---------------------------------------------------------------- paint
  function paint(t, { reduced }) {
    const i = idx.at(t);
    const xv = xAt(t, reduced);
    shown = xv;
    strip.style.transform = `translate3d(${px(xv)}, 0, 0)`;
    // slides wholly in view once the strip rests on slide i are live; the rest are inert
    const view = geo.snaps[i];
    slides.forEach((s, j) => {
      const b = geo.boxes[j];
      const left = geo.off + b.left + view;
      const inView = left >= -1 && left + b.width <= geo.vw + 1;
      attr(s, 'inert', inView ? null : true);
      attr(s, 'aria-hidden', inView ? null : 'true');
      attr(s, 'data-state', inView ? 'active' : 'inactive');
    });
    if (prevButton) attr(prevButton, 'aria-disabled', i === 0 ? 'true' : null);
    if (nextButton) attr(nextButton, 'aria-disabled', i === n - 1 ? 'true' : null);
    attr(root, 'data-index', String(i));
    const say = `Slide ${i + 1} of ${n}`;
    if (status.textContent !== say) status.textContent = say;
    if (indicator) {
      const w = worm(progressOf(xv), n);
      indicator.style.setProperty('--am-carousel-from', String(round4(w.from)));
      indicator.style.setProperty('--am-carousel-to', String(round4(w.to)));
    }
  }

  function draw(t, s) {
    paint(t, s);
    if (!api.keep && !live && t >= endT && idx.ev.length && settledAll(t)) {
      x.compact(t);
      idx.compact();
      plan = [];
    }
  }

  const d = driver(draw, { clock: o.clock, reduced: o.reduced });
  d.busy = (t) => !!live || t < endT || !settledAll(t);
  const commit = () => { paint(d.now(), { reduced: d.reduced }); d.kick(); };
  const when = (opt) => (opt && opt.t !== undefined ? { t: opt.t, live: false } : { t: d.now(), live: true });

  // ---------------------------------------------------------------- landing

  /** The slide a release at position p with velocity v (px per second) lands on. */
  function landing(p, v) {
    const s = geo.snaps;
    const aim = p + v * THROW;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(s[i] - aim) < Math.abs(s[best] - aim)) best = i;
    if (Math.abs(v) >= FLICK) {
      // a flick moves on from where the strip is, in the direction of the hand, never back
      if (v < 0) {
        let ahead = s.findIndex((sv) => sv < p - 1);
        if (ahead < 0) ahead = n - 1;
        best = Math.max(best, ahead);
      } else {
        let behind = 0;
        for (let i = n - 1; i >= 0; i--) if (s[i] > p + 1) { behind = i; break; }
        best = Math.min(best, behind);
      }
    }
    return best;
  }

  /**
   * The spring of one landing. Between the ends it is LAND. At an end a hard throw would run far
   * past the last slide, so the spring of that one landing is made stiffer until it runs at most
   * BOUNCE px further than where it was let go; it still starts with the speed of the hand.
   */
  function landSpring(d0, v0, to) {
    if (to !== 0 && to !== n - 1) return LAND;
    const past = (sp) => {
      let m = 0;
      for (let k = 1; k <= 360; k++) {
        const dd = springDisp(sp, k / 240, d0, v0);
        if (to === 0 && dd > m) m = dd;
        if (to === n - 1 && -dd > m) m = -dd;
      }
      return m;
    };
    const already = Math.max(0, to === 0 ? d0 : 0, to === n - 1 ? -d0 : 0);
    const limit = BOUNCE + already;
    let sp = LAND;
    for (let k = 0; k < 8; k++) {
      const m = past(sp);
      if (m <= limit + 0.5 || sp.response <= MIN_RESPONSE) break;
      sp = spring(Math.max(MIN_RESPONSE, Math.round(((sp.response * limit) / m) * 1000) / 1000), LAND.damping);
    }
    return sp;
  }

  /** Applies one change on the current geometry; returns the new slide or -1. */
  function apply(op) {
    if (op.k === 'drag') {
      const fn = dragPath(op.offset, op.t1, op.v);
      const g = x.at(op.t0);
      const h = 1 / 960; // the same step the track uses for the release velocity
      const p = fn(op.t1, g);
      const v = (p - fn(op.t1 - h, g)) / h;
      const to = landing(p, v);
      const sp = op.sp || landSpring(p - geo.snaps[to], v, to);
      x.drag(op.t0, op.t1, fn, sp);
      const changed = to !== idx.last;
      if (changed) idx.set(op.t1, to);
      x.to(op.t1, geo.snaps[to], sp);
      mark(op.t1);
      return changed ? to : -1;
    }
    const to = clampIndex(op.i);
    if (op.k === 'go' && to === idx.last) return -1;
    if (to !== idx.last) idx.set(op.t, to);
    x.to(op.t, geo.snaps[to], op.sp || LAND);
    mark(op.t);
    return to;
  }

  const run = (op) => { plan.push(op); return apply(op); };

  /** When the slide that holds the focus becomes inert, the focus moves to the new slide. */
  function rescueFocus() {
    const a = doc.activeElement;
    if (!a || a === doc.body || !strip.contains(a)) return;
    const holder = slides.find((s) => s.contains(a));
    if (!holder || !holder.hasAttribute('inert')) return;
    const target = slides[idx.last];
    if (!target.hasAttribute('tabindex')) attr(target, 'tabindex', '-1');
    try { target.focus({ preventScroll: true }); } catch { /* not focusable here */ }
  }

  function go(i, opt = {}) {
    const { t, live: now } = when(opt);
    if (now && holding(t)) return api; // the hand holds the strip
    const to = run({ k: 'go', t, i, sp: now && d.reduced ? JUMP : undefined });
    if (to < 0) return api;
    commit();
    if (now) {
      rescueFocus();
      if (o.onChange) o.onChange(to);
    }
    return api;
  }

  /** Scheduled drag for demos: the pointer travels dx px from t over duration s. */
  function drag(dx, opt = {}) {
    const t0 = opt.t ?? d.now();
    const dur = opt.duration ?? 0.4;
    const [e, slopeAt] = EASE[opt.ease] || EASE.inOut;
    run({ k: 'drag', t0, t1: t0 + dur, offset: (t) => dx * e(clamp01((t - t0) / dur)), v: (dx * slopeAt(1)) / dur });
    commit();
    return api;
  }

  const near = (a, b) => Math.abs(a - b) < 0.5;
  const sameGeo = (a, b) => near(a.vw, b.vw) && near(a.off, b.off) && a.snaps.every((s, k) => near(s, b.snaps[k]))
    && a.boxes.every((bx, k) => near(bx.left, b.boxes[k].left) && near(bx.width, b.boxes[k].width));

  /**
   * Re-measure after a layout change. Nothing happens when the geometry is the same. Live, the
   * strip jumps to the current slide without motion. With api.keep (a scheduled demo) the
   * timeline is not touched: every change since the start is planned again on the new layout.
   */
  function measure() {
    const prev = geo;
    geo = measureGeo();
    if (sameGeo(prev, geo)) return api;
    if (api.keep) {
      const ops = plan;
      const start = clampIndex(idx.initial);
      idx.initial = start;
      idx.ev = [];
      x = track(geo.snaps[start], LAND);
      endT = -Infinity;
      plan = [];
      for (const op of ops) run(op);
      commit();
      return api;
    }
    run({ k: 'jump', t: d.now(), i: idx.last, sp: JUMP });
    commit();
    return api;
  }

  // ---------------------------------------------------------------- live input
  const listeners = [];
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); listeners.push([target, type, fn, opts]); };
  const stamp = (e) => (e && typeof e.timeStamp === 'number' && e.timeStamp > 0 ? e.timeStamp / 1000 : undefined);
  const mine = (e) => !!live && (live.id === undefined || e.pointerId === undefined || e.pointerId === live.id);

  if (prevButton) on(prevButton, 'click', () => go(idx.last - 1));
  if (nextButton) on(nextButton, 'click', () => go(idx.last + 1));
  if (dotsBox) {
    on(dotsBox, 'click', (e) => {
      const dot = e.target && e.target.closest ? e.target.closest('.am-carousel-dot') : null;
      const i = dots.indexOf(dot);
      if (i >= 0) go(i);
    });
  }
  on(root, 'keydown', (e) => {
    const target = e.target;
    if (target && target.closest && target.closest('input, textarea, select, [contenteditable]')) return;
    let to = null;
    if (e.key === 'ArrowLeft') to = idx.last - 1;
    else if (e.key === 'ArrowRight') to = idx.last + 1;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = n - 1;
    if (to === null) return;
    e.preventDefault();
    go(to);
  });

  /** Ends the pointer on the strip: a drag or a caught strip lands from where it is. */
  function end(e) {
    const cur = live;
    if (!cur) return;
    live = null;
    if (cur.active && viewport.releasePointerCapture && cur.id !== undefined) {
      try { viewport.releasePointerCapture(cur.id); } catch { /* already released */ }
    }
    if (!cur.active && !cur.caught) return;
    const t1 = Math.max(d.now(), cur.t0 + 1e-6);
    const last = cur.samples[cur.samples.length - 1];
    let off = cur.off;
    if (cur.active && e && e.type === 'pointerup' && Number.isFinite(e.clientX)) off = e.clientX - cur.ox;
    const ts = stamp(e) ?? (typeof last[2] === 'number' ? last[2] + (t1 - last[0]) : undefined);
    const samples = cur.samples.concat([[t1, off, ts]]);
    const v = cur.active ? releaseVelocity(samples) : 0;
    const offset = cur.active ? pathFn(samples, v) : () => 0;
    const to = run({ k: 'drag', t0: cur.t0, t1, offset, v, sp: d.reduced ? JUMP : undefined });
    commit();
    if (to >= 0) {
      rescueFocus();
      if (o.onChange) o.onChange(to);
    }
  }

  on(viewport, 'pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    // a second finger while one drags is ignored; a pointer we lost track of is ended first
    if (live && live.active && live.id !== undefined && e.pointerId !== undefined && e.pointerId !== live.id) return;
    if (live) end(null);
    if (e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable], [data-am-no-drag]')) return;
    const t0 = d.now();
    // a strip still on its way is caught where it is, like a scroll view
    const moving = !d.reduced && (Math.abs(x.at(t0) - x.target(t0)) > 1 || Math.abs(x.vel(t0)) > 30);
    live = {
      id: e.pointerId,
      t0,
      grab: xAt(t0, d.reduced),
      startX: e.clientX,
      startY: e.clientY,
      ox: e.clientX,
      off: 0,
      samples: [[t0, 0, stamp(e)]],
      active: false,
      caught: moving,
    };
    moved = moving;
    if (moving) commit();
  });
  on(viewport, 'pointermove', (e) => {
    if (!mine(e)) return;
    const dx = e.clientX - live.startX;
    if (!live.active) {
      if (Math.abs(dx) < SLOP) return;
      if (Math.abs(e.clientY - live.startY) > Math.abs(dx)) { end(null); return; } // a vertical scroll
      live.active = true;
      moved = true;
      // the strip starts from here, so it does not jump by the slop
      live.ox = live.startX + Math.sign(dx) * SLOP;
      if (viewport.setPointerCapture && e.pointerId !== undefined) {
        try { viewport.setPointerCapture(e.pointerId); } catch { /* not captured */ }
      }
    }
    live.off = e.clientX - live.ox;
    live.samples.push([d.now(), live.off, stamp(e)]);
    commit();
  });
  const finish = (e) => { if (mine(e)) end(e); };
  on(viewport, 'pointerup', finish);
  on(viewport, 'pointercancel', finish);
  on(viewport, 'lostpointercapture', finish);
  // a press that never became a drag and left the strip is over
  on(viewport, 'pointerleave', (e) => { if (mine(e) && !live.active) end(null); });
  // the click at the end of a drag must not follow a link or press a button in a slide;
  // a click from the keyboard (detail 0) is never the end of a drag
  on(viewport, 'click', (e) => {
    if (!moved) return;
    moved = false;
    if (!e.detail) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);
  // no native drag of a link or an image out of a slide: it would cancel the pointer
  on(viewport, 'dragstart', (e) => e.preventDefault());
  // the viewport clips; a focus or a find in page must not scroll it under the transform
  on(viewport, 'scroll', () => { if (viewport.scrollLeft) viewport.scrollLeft = 0; });

  // a sideways wheel or trackpad swipe moves one slide per gesture; vertical wheels scroll the page
  let wheelAt = -Infinity;
  let wheelSum = 0;
  let wheelDone = false;
  on(viewport, 'wheel', (e) => {
    const ax = Math.abs(e.deltaX || 0);
    const ay = Math.abs(e.deltaY || 0);
    const delta = ax > ay ? e.deltaX : e.shiftKey && ay > 0 ? e.deltaY : 0;
    if (!delta) return;
    e.preventDefault();
    const now = stamp(e) ?? d.now();
    if (now - wheelAt > WHEEL_GAP) { wheelSum = 0; wheelDone = false; }
    wheelAt = now;
    if (wheelDone || live) return;
    wheelSum += delta * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? geo.vw : 1);
    if (Math.abs(wheelSum) < WHEEL_STEP) return;
    wheelDone = true;
    go(idx.last + Math.sign(wheelSum));
  }, { passive: false });

  let ro = null;
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => measure());
    ro.observe(viewport);
  }

  const api = {
    root,
    viewport,
    track: strip,
    slides,
    prevButton,
    nextButton,
    dots,
    indicator,
    status,
    driver: d,
    keep: false,
    go,
    next: (opt) => go(idx.last + 1, opt),
    prev: (opt) => go(idx.last - 1, opt),
    drag,
    measure,
    index: (t) => (t === undefined ? idx.last : idx.at(t)),
    count: () => n,
    /** Distance between the resting places of the first two slides, px (one step of the strip). */
    step: () => (n > 1 ? geo.snaps[0] - geo.snaps[1] : geo.boxes[0].width),
    /** Where the strip is at time t, in slides (1.5 is halfway from the second slide to the third). */
    progress: (t) => progressOf(xAt(t === undefined ? d.now() : t, d.reduced)),
    /** The state at time t that another instance can continue from: createCarousel({ from }). */
    handoff: (t) => {
      const tt = t === undefined ? d.now() : t;
      return { index: idx.at(tt), x: xAt(tt, d.reduced), v: d.reduced || holding(tt) ? 0 : x.vel(tt) };
    },
    seek: (t) => paint(t, { reduced: d.reduced }),
    settled: (t) => !live && t >= endT && settledAll(t),
    destroy() {
      d.stop();
      if (ro) ro.disconnect();
      for (const [target, type, fn, opts] of listeners) target.removeEventListener(type, fn, opts);
    },
  };

  // taking over from another instance: the strip continues from its position and speed
  if (from && !d.reduced) {
    const t0 = d.now();
    const x0 = from.x;
    const v0 = Number.isFinite(from.v) ? from.v : 0;
    if (Math.abs(x0 - geo.snaps[first]) > 0.01 || Math.abs(v0) > 0.01) {
      x.drag(t0 - 1 / 120, t0, (t) => x0 + v0 * (t - t0), landSpring(x0 - geo.snaps[first], v0, first));
      mark(t0);
    }
  }
  paint(d.now(), { reduced: d.reduced });
  if (from) d.kick();
  return api;
}
