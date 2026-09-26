/*
 * ARLing Motion: Carousel with drag and snap.
 * The strip of slides follows your pointer 1:1 (past the first or last slide it resists).
 * When you let go, the spring starts from where the strip is and how fast it moved, and it
 * lands on the slide the throw points to, so a quick flick can pass more than one slide.
 * The buttons and arrow keys glide to the neighbour on the same spring.
 *
 * Markup (WAI-ARIA APG, carousel without auto rotation):
 *   <section class="am-carousel" aria-roledescription="carousel" aria-label="Featured">
 *     <div class="am-carousel-viewport">
 *       <div class="am-carousel-track">
 *         <div class="am-carousel-slide">...</div>
 *       </div>
 *     </div>
 *     <div class="am-carousel-controls">
 *       <button class="am-carousel-prev" aria-label="Previous slide"></button>
 *       <button class="am-carousel-next" aria-label="Next slide"></button>
 *     </div>
 *   </section>
 * Slides get role="group", aria-roledescription="slide" and "3 of 5" as their name; slides
 * out of view are inert. The track is a polite live region (there is no auto rotation).
 *
 * Keyboard: the Previous and Next buttons (Enter or Space); Left and Right, Home and End
 * anywhere inside the carousel except in a text field. At the ends the button gets
 * aria-disabled="true" and stays focusable.
 * MIT licence.
 */
import { track, driver, steps, attr, JUMP, PRESETS } from '../../src/core.js';

// ------------------------------------------------------------------ helpers

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const px = (v) => `${Math.round(v * 100) / 100}px`;

let uid = 0;
const ensureId = (el, prefix) => el.id || (el.id = `${prefix}-${++uid}`);

/** Easing of a scheduled pointer path, with its slope (for the release velocity). */
export const EASE = {
  linear: [(u) => u, () => 1],
  in: [(u) => u * u, (u) => 2 * u],
  out: [(u) => 1 - (1 - u) * (1 - u), (u) => 2 * (1 - u)],
  inOut: [(u) => u * u * (3 - 2 * u), (u) => 6 * u * (1 - u)],
};

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

/** Pointer velocity over the last 0.1 s of samples, units per second. */
function releaseVelocity(samples, window = 0.1) {
  if (samples.length < 2) return 0;
  const [t1, end] = samples[samples.length - 1];
  let j = samples.length - 2;
  while (j > 0 && t1 - samples[j][0] < window) j--;
  const [t0, start] = samples[j];
  return t1 > t0 ? (end - start) / (t1 - t0) : 0;
}

// ------------------------------------------------------------------ carousel

/** Seconds of the throw added to the release position before choosing a slide. */
export const THROW = 0.2;
/** How far the strip may be pulled past either end, px (it approaches this). */
export const RUBBER = 64;
/** A pointer must move this far sideways before a drag starts, px. */
const SLOP = 4;
const SNAP = PRESETS.morph;

/**
 * createCarousel({ root, index, onChange, clock, reduced })
 * drag(dx, { t, duration, ease }) schedules a pointer drag for demos.
 * Returns { go, next, prev, drag, index, count, measure, seek, settled, destroy, driver,
 * root, viewport, track, slides, prevButton, nextButton, keep }.
 */
export function createCarousel(o) {
  const root = o.root;
  const doc = root.ownerDocument || document;
  const viewport = root.querySelector('.am-carousel-viewport');
  const strip = root.querySelector('.am-carousel-track');
  const slides = [...strip.querySelectorAll('.am-carousel-slide')];
  const prevButton = root.querySelector('.am-carousel-prev');
  const nextButton = root.querySelector('.am-carousel-next');
  if (!slides.length) throw new Error('createCarousel: no .am-carousel-slide');

  attr(root, 'aria-roledescription', 'carousel');
  if (root.tagName !== 'SECTION' && !root.hasAttribute('role')) attr(root, 'role', 'region');
  attr(strip, 'aria-live', 'polite');
  ensureId(strip, 'am-carousel-track');
  slides.forEach((s, i) => {
    attr(s, 'role', 'group');
    attr(s, 'aria-roledescription', 'slide');
    if (!s.hasAttribute('aria-label') && !s.hasAttribute('aria-labelledby')) attr(s, 'aria-label', `${i + 1} of ${slides.length}`);
  });
  for (const b of [prevButton, nextButton]) {
    if (!b) continue;
    if (b.tagName === 'BUTTON' && !b.hasAttribute('type')) attr(b, 'type', 'button');
    attr(b, 'aria-controls', strip.id);
  }
  if (prevButton && !prevButton.hasAttribute('aria-label') && !prevButton.textContent.trim()) attr(prevButton, 'aria-label', 'Previous slide');
  if (nextButton && !nextButton.hasAttribute('aria-label') && !nextButton.textContent.trim()) attr(nextButton, 'aria-label', 'Next slide');

  // ---------------------------------------------------------------- geometry
  let geo;
  function measureGeo() {
    const vr = viewport.getBoundingClientRect();
    const r0 = slides[0].getBoundingClientRect();
    const boxes = slides.map((s) => {
      const r = s.getBoundingClientRect();
      return { left: r.left - r0.left, width: r.width };
    });
    const last = boxes[boxes.length - 1];
    const content = last.left + last.width;
    const max = Math.max(0, content - vr.width);
    // one snap per distinct resting place: the last slides share the end of the strip
    const snaps = [];
    for (const b of boxes) {
      const s = Math.min(b.left, max);
      if (!snaps.length || s - snaps[snaps.length - 1] > 0.5) snaps.push(s);
    }
    return { vw: vr.width, boxes, max, snaps };
  }
  geo = measureGeo();

  const clampIndex = (i) => Math.max(0, Math.min(geo.snaps.length - 1, i));
  const first = clampIndex(o.index ?? 0);
  const idx = steps(first);
  let x = track(-geo.snaps[first], SNAP);
  // Every change since the last compaction, kept so measure() can plan them again on a new
  // layout without touching the timeline of a scheduled demo (api.keep).
  let plan = [];
  let live = null; // a drag in progress: { t0, grab, startX, startY, samples, active }
  let moved = false;
  let endT = -Infinity;
  const mark = (t) => { if (t > endT) endT = t; };
  const settledAll = (t) => x.settled(t);

  /** Past either end the strip resists: it approaches RUBBER px. */
  const shape = (v) => {
    const lo = -geo.max;
    if (v > 0) return RUBBER * (1 - 1 / (1 + v / RUBBER));
    if (v < lo) return lo - RUBBER * (1 - 1 / (1 + (lo - v) / RUBBER));
    return v;
  };

  function xAt(t, reduced) {
    if (reduced) return x.target(t);
    if (live && live.active && t >= live.t0) return shape(live.grab + live.samples[live.samples.length - 1][1]);
    return x.at(t);
  }

  function paint(t, { reduced }) {
    const i = idx.at(t);
    strip.style.transform = `translateX(${px(xAt(t, reduced))})`;
    const view = geo.snaps[i];
    slides.forEach((s, j) => {
      const b = geo.boxes[j];
      const inView = b.left >= view - 1 && b.left + b.width <= view + geo.vw + 1;
      attr(s, 'inert', inView ? null : true);
      attr(s, 'aria-hidden', inView ? null : 'true');
      attr(s, 'data-state', inView ? 'active' : 'inactive');
    });
    if (prevButton) attr(prevButton, 'aria-disabled', i === 0 ? 'true' : null);
    if (nextButton) attr(nextButton, 'aria-disabled', i === geo.snaps.length - 1 ? 'true' : null);
    attr(root, 'data-index', String(i));
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

  /** Applies one change on the current geometry; returns the new slide or -1. */
  function apply(op) {
    if (op.k === 'drag') {
      x.drag(op.t0, op.t1, (t, grab) => shape(grab + op.offset(t)), SNAP);
      const to = landing(x.at(op.t1), op.v);
      const changed = to !== idx.last;
      idx.set(op.t1, to);
      x.to(op.t1, -geo.snaps[to], SNAP);
      mark(op.t1);
      return changed ? to : -1;
    }
    const to = clampIndex(op.i);
    if (op.k === 'go' && to === idx.last) return -1;
    if (to !== idx.last) idx.set(op.t, to);
    x.to(op.t, -geo.snaps[to], op.k === 'jump' ? JUMP : SNAP);
    mark(op.t);
    return to;
  }

  const run = (op) => { plan.push(op); return apply(op); };

  function go(i, opt = {}) {
    const { t, live: now } = when(opt);
    const to = run({ k: 'go', t, i });
    if (to < 0) return api;
    commit();
    if (now && o.onChange) o.onChange(to);
    return api;
  }

  /** The slide a throw lands on: nearest resting place to where the velocity points. */
  function landing(pos, v) {
    const aim = -(pos + v * THROW);
    let best = 0;
    geo.snaps.forEach((s, i) => { if (Math.abs(s - aim) < Math.abs(geo.snaps[best] - aim)) best = i; });
    return best;
  }

  /** Commits a drag from t0 to t1: offset(t) is the pointer's travel in px, v its velocity. */
  function commitDrag(t0, t1, offset, v) {
    return run({ k: 'drag', t0, t1, offset, v });
  }

  /** Scheduled drag for demos: the pointer travels dx px from t over duration s. */
  function drag(dx, opt = {}) {
    const t0 = opt.t ?? d.now();
    const dur = opt.duration ?? 0.4;
    const [e, slope] = EASE[opt.ease || 'inOut'];
    commitDrag(t0, t0 + dur, (t) => dx * e(clamp01((t - t0) / dur)), (dx * slope(1)) / dur);
    commit();
    return api;
  }

  const near = (a, b) => Math.abs(a - b) < 0.5;
  const sameGeo = (a, b) => near(a.vw, b.vw) && a.snaps.length === b.snaps.length && a.snaps.every((s, k) => near(s, b.snaps[k]))
    && a.boxes.length === b.boxes.length && a.boxes.every((bx, k) => near(bx.left, b.boxes[k].left) && near(bx.width, b.boxes[k].width));

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
      x = track(-geo.snaps[start], SNAP);
      endT = -Infinity;
      plan = [];
      for (const op of ops) run(op);
      commit();
      return api;
    }
    run({ k: 'jump', t: d.now(), i: idx.last });
    commit();
    return api;
  }

  // ---------------------------------------------------------------- live input
  const listeners = [];
  const on = (target, type, fn, capture) => { target.addEventListener(type, fn, capture); listeners.push([target, type, fn, capture]); };

  if (prevButton) on(prevButton, 'click', () => go(idx.last - 1));
  if (nextButton) on(nextButton, 'click', () => go(idx.last + 1));
  on(root, 'keydown', (e) => {
    const target = e.target;
    if (target && target.closest && target.closest('input, textarea, select, [contenteditable]')) return;
    let to = null;
    if (e.key === 'ArrowLeft') to = idx.last - 1;
    else if (e.key === 'ArrowRight') to = idx.last + 1;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = geo.snaps.length - 1;
    if (to === null) return;
    e.preventDefault();
    go(to);
  });

  on(viewport, 'pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target && e.target.closest && e.target.closest('input, textarea, select, [data-am-no-drag]')) return;
    const t0 = d.now();
    live = { t0, grab: x.at(t0), startX: e.clientX, startY: e.clientY, samples: [[t0, 0]], active: false, id: e.pointerId };
    moved = false;
  });
  on(viewport, 'pointermove', (e) => {
    if (!live) return;
    const dx = e.clientX - live.startX;
    if (!live.active) {
      if (Math.abs(dx) < SLOP) return;
      if (Math.abs(e.clientY - live.startY) > Math.abs(dx)) { live = null; return; } // a vertical scroll
      live.active = true;
      moved = true;
      if (viewport.setPointerCapture && e.pointerId !== undefined) { try { viewport.setPointerCapture(e.pointerId); } catch { /* not captured */ } }
    }
    live.samples.push([d.now(), dx]);
    commit();
  });
  const finish = (e) => {
    if (!live) return;
    const cur = live;
    live = null;
    if (!cur.active) return;
    const t1 = Math.max(d.now(), cur.t0 + 1e-6);
    const dx = e && e.type !== 'pointercancel' && e.clientX !== undefined ? e.clientX - cur.startX : cur.samples[cur.samples.length - 1][1];
    const samples = cur.samples.concat([[t1, dx]]);
    const v = releaseVelocity(samples);
    const to = commitDrag(cur.t0, t1, pathFn(samples, v), v);
    commit();
    if (to >= 0 && o.onChange) o.onChange(to);
  };
  on(viewport, 'pointerup', finish);
  on(viewport, 'pointercancel', finish);
  // the click at the end of a drag must not follow a link or press a button in a slide
  on(viewport, 'click', (e) => {
    if (!moved) return;
    moved = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);

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
    driver: d,
    keep: false,
    go,
    next: (opt) => go(idx.last + 1, opt),
    prev: (opt) => go(idx.last - 1, opt),
    drag,
    measure,
    index: (t) => (t === undefined ? idx.last : idx.at(t)),
    count: () => geo.snaps.length,
    /** Distance between the first two slides, px (one step of the strip). */
    step: () => (geo.boxes[1] ? geo.boxes[1].left : geo.boxes[0].width),
    seek: (t) => paint(t, { reduced: d.reduced }),
    settled: (t) => !live && t >= endT && settledAll(t),
    destroy() {
      d.stop();
      if (ro) ro.disconnect();
      for (const [target, type, fn, capture] of listeners) target.removeEventListener(type, fn, capture);
    },
  };
  paint(d.now(), { reduced: d.reduced });
  return api;
}
