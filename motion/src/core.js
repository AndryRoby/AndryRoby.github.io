/*
 * ARLing Motion core: springs for product UI that also render as video.
 *
 * One idea runs through everything: a value is a pure function of time. A track keeps a
 * list of target changes; its value at time t is the sum of one closed-form spring per
 * change. The same component can therefore be driven live by requestAnimationFrame
 * (driver below) or seeked to any time for a demo or an MP4 frame (seek(t)).
 *
 * No dependencies. ES module. MIT licence (LICENSE).
 * Ported from the ARLing video engine (ops/video/pohyb/lib/pohyb.js, 26. 9. 2026).
 */

// ------------------------------------------------------------------ springs

/** response: period of the undamped oscillation in seconds; damping: ratio, 1 = no overshoot. */
export function spring(response, damping = 0.86) {
  return { response, damping };
}

/** The same springs as our videos. Every preset overshoots by 3 % at most (tested). */
export const PRESETS = {
  press: spring(0.16, 0.9),
  release: spring(0.34, 0.8),
  snappy: spring(0.32, 0.86),
  smooth: spring(0.5, 0.86),
  morph: spring(0.56, 0.8),
  gentle: spring(0.7, 0.95),
  enter: spring(0.38, 0.9),
  exit: spring(0.2, 1),
  camera: spring(0.62, 1),
};

// A spring is home when its displacement bound falls below SETTLE times the jump:
// 5e-5 of a 500 px move is 0.025 px, invisible, and it makes the last frame of a loop
// byte-identical to the first.
export const SETTLE = 5e-5;

/** Displacement from the target after tau seconds, for start displacement d0 and velocity v0. */
export function springDisp(sp, tau, d0, v0 = 0) {
  if (tau <= 0) return d0;
  const w = (2 * Math.PI) / sp.response;
  const z = sp.damping;
  const scale = Math.abs(d0) + Math.abs(v0) / w;
  let bound;
  let val;
  if (Math.abs(z - 1) < 1e-6) {
    const ec = Math.exp(-w * tau);
    bound = ec * (Math.abs(d0) + Math.abs(v0 + w * d0) * tau);
    val = ec * (d0 + (v0 + w * d0) * tau);
  } else if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    const e = Math.exp(-z * w * tau);
    const c2 = (v0 + z * w * d0) / wd;
    bound = e * (Math.abs(d0) + Math.abs(c2));
    val = e * (d0 * Math.cos(wd * tau) + c2 * Math.sin(wd * tau));
  } else {
    const s = Math.sqrt(z * z - 1);
    const r1 = -w * (z - s);
    const r2 = -w * (z + s);
    const A = (v0 - r2 * d0) / (r1 - r2);
    const B = d0 - A;
    bound = Math.abs(A) * Math.exp(r1 * tau) + Math.abs(B) * Math.exp(r2 * tau);
    val = A * Math.exp(r1 * tau) + B * Math.exp(r2 * tau);
  }
  return bound < SETTLE * scale ? 0 : val;
}

/** Unit step response: 0 before the change, then 0 to 1 along the spring. */
export function springStep(sp, tau) {
  return tau <= 0 ? 0 : 1 - springDisp(sp, tau, 1, 0);
}

const settleCache = new Map();
/** Seconds until a unit step of this spring is home (displacement exactly 0 by springDisp). */
export function settleTime(sp) {
  const key = sp.response + ':' + sp.damping;
  if (settleCache.has(key)) return settleCache.get(key);
  let lo = 0;
  let hi = sp.response;
  while (springDisp(sp, hi, 1, 0) !== 0) hi *= 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (springDisp(sp, mid, 1, 0) === 0) hi = mid; else lo = mid;
  }
  settleCache.set(key, hi);
  return hi;
}

/**
 * CSS linear() easing sampled from a spring, for plain CSS transitions. With the default 13 stops the
 * curve is off by up to about 6 % of the distance near the start; 60 stops keep it under 0.6 %, which is
 * what springs.css uses (both measured in test/registry.test.mjs).
 */
export function cssEasing(sp, points = 13) {
  const T = settleTime(sp);
  const stops = [];
  for (let i = 0; i < points; i++) {
    const x = i / (points - 1);
    stops.push(`${+springStep(sp, x * T).toFixed(4)} ${Math.round(x * 1000) / 10}%`);
  }
  return { easing: `linear(${stops.join(', ')})`, duration: Math.round(T * 1000) };
}

// ------------------------------------------------------------------ tracks

/**
 * A number in time. to(t, target) adds one spring for the jump to the new target.
 * drag(t0, t1, fn): during [t0, t1) the value is fn(t, valueWhenGrabbed); after t1 a spring
 * runs from where the value was and how fast it moved, to the current target.
 */
export class Track {
  constructor(initial, sp = PRESETS.smooth) {
    this.initial = initial;
    this.sp = sp;
    this.ev = [];
  }

  _add(e) {
    e.i = this.ev.length;
    this.ev.push(e);
    this.ev.sort((a, b) => a.t - b.t || a.i - b.i);
    return this;
  }

  to(t, target, sp) {
    return this._add({ k: 'to', t, target, sp: sp || this.sp });
  }

  drag(t0, t1, fn, sp) {
    return this._add({ k: 'drag', t: t0, t1, fn, sp: sp || this.sp });
  }

  /** The target in force at time t (what reduced motion shows). */
  target(t) {
    let target = this.initial;
    for (const e of this.ev) {
      if (e.t > t) break;
      if (e.k === 'to') target = e.target;
    }
    return target;
  }

  at(t) {
    let base = { kind: 'rest', value: this.initial };
    let steps = [];
    let target = this.initial;
    for (const e of this.ev) {
      if (e.t > t) break;
      if (e.k === 'to') {
        steps.push({ t: e.t, delta: e.target - target, sp: e.sp });
        target = e.target;
      } else {
        const grab = evalParts(base, steps, e.t);
        if (t < e.t1) return e.fn(t, grab);
        const h = 1 / 960;
        const p = e.fn(e.t1, grab);
        const v = (p - e.fn(e.t1 - h, grab)) / h;
        base = { kind: 'release', t: e.t1, from: p, v, target, sp: e.sp };
        steps = [];
      }
    }
    return evalParts(base, steps, t);
  }

  vel(t) {
    const h = 1 / 2000;
    return (this.at(t + h) - this.at(t - h)) / (2 * h);
  }

  /** True when every change up to t has settled, so a live driver may stop drawing. */
  settled(t) {
    for (const e of this.ev) {
      if (e.t > t) break;
      const end = e.k === 'drag' ? e.t1 : e.t;
      if (t < end + settleTime(e.sp)) return false;
    }
    return true;
  }

  /** Forget changes that have fully settled before t (keeps long-lived live tracks small). */
  compact(t) {
    if (!this.settled(t)) return this;
    const v = this.target(t);
    this.initial = v;
    this.ev = [];
    return this;
  }
}

function evalParts(base, steps, t) {
  let v = base.kind === 'rest' ? base.value : base.target + springDisp(base.sp, t - base.t, base.from - base.target, base.v);
  for (const s of steps) v += s.delta * springStep(s.sp, t - s.t);
  return v;
}

export const track = (initial, sp) => new Track(initial, sp);

// ------------------------------------------------------------------ indicator

/**
 * Two edges on different springs. The leading edge (in the direction of travel) is faster,
 * so the indicator stretches first and the trailing edge catches up.
 */
export class Indicator {
  constructor(left, right, fast = spring(0.3, 0.9), slow = spring(0.55, 0.95)) {
    this.fast = fast;
    this.slow = slow;
    this.l = track(left, slow);
    this.r = track(right, slow);
    this.last = [left, right];
  }

  to(t, left, right) {
    const dir = left + right - (this.last[0] + this.last[1]);
    if (dir >= 0) { this.r.to(t, right, this.fast); this.l.to(t, left, this.slow); }
    else { this.l.to(t, left, this.fast); this.r.to(t, right, this.slow); }
    this.last = [left, right];
    return this;
  }

  at(t) { return { left: this.l.at(t), right: this.r.at(t) }; }
  target(t) { return { left: this.l.target(t), right: this.r.target(t) }; }
  settled(t) { return this.l.settled(t) && this.r.settled(t); }
}

export const indicator = (l, r, fast, slow) => new Indicator(l, r, fast, slow);

// ------------------------------------------------------------------ presence

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Content inside a morphing container has its own entrance and exit:
 * enter = blur, rise from below, slight scale; exit = quicker blur and lift.
 */
export class Presence {
  constructor(visible = false, o = {}) {
    this.blur = o.blur ?? 10;
    this.dyIn = o.dyIn ?? 14;
    this.dyOut = o.dyOut ?? -8;
    this.scaleFrom = o.scaleFrom ?? 0.94;
    this.enterSp = o.enter || PRESETS.enter;
    this.exitSp = o.exit || PRESETS.exit;
    this.p = track(visible ? 1 : 0);
    this.marks = [];
  }

  enter(t, sp) { this.p.to(t, 1, sp || this.enterSp); this.marks.push([t, 'in']); return this; }
  exit(t, sp) { this.p.to(t, 0, sp || this.exitSp); this.marks.push([t, 'out']); return this; }

  at(t) {
    let phase = 'in';
    for (const [mt, ph] of this.marks) if (mt <= t) phase = ph;
    const p = this.p.at(t);
    const q = clamp01(p);
    return {
      opacity: q,
      blur: (1 - q) * this.blur,
      y: (1 - p) * (phase === 'out' ? this.dyOut : this.dyIn),
      scale: this.scaleFrom + (1 - this.scaleFrom) * p,
      visible: q > 0.002,
    };
  }

  /** Reduced motion: no blur, no movement, only the final state. */
  still(t) {
    const q = this.p.target(t);
    return { opacity: q, blur: 0, y: 0, scale: 1, visible: q > 0.5 };
  }

  settled(t) { return this.p.settled(t); }
}

export const presence = (visible, o) => new Presence(visible, o);

/** Enter a list one after another, step seconds apart. Returns the start times. */
export function stagger(presences, t, step = 0.04, sp) {
  return presences.map((p, i) => { const ti = t + i * step; p.enter(ti, sp); return ti; });
}

/** Writes a presence state onto an element (inline style, no CSS transition needed). */
export function applyPresence(el, s) {
  el.style.opacity = String(s.opacity);
  el.style.filter = s.blur > 0.05 ? `blur(${s.blur.toFixed(2)}px)` : '';
  el.style.transform = `translateY(${s.y.toFixed(2)}px) scale(${s.scale.toFixed(4)})`;
  el.style.visibility = s.visible ? '' : 'hidden';
}

// ------------------------------------------------------------------ discrete steps, ink, DOM helpers

/** A change that lands within one frame and is still a pure function of time. */
export const JUMP = spring(0.001, 1);

/** A value that switches instantly at given times (open flags, active index, labels). */
export function steps(initial) {
  return {
    initial,
    ev: [],
    set(t, v) { this.ev.push([t, v]); this.ev.sort((a, b) => a[0] - b[0]); return this; },
    at(t) { let v = this.initial; for (const [et, x] of this.ev) { if (et > t) break; v = x; } return v; },
    get last() { return this.ev.length ? this.ev[this.ev.length - 1][1] : this.initial; },
    compact() { this.initial = this.last; this.ev = []; return this; },
  };
}

/** Sets or removes an attribute only when it changes (ARIA state without layout churn). */
export function attr(el, name, value) {
  if (value === null || value === undefined || value === false) {
    if (el.hasAttribute(name)) el.removeAttribute(name);
  } else {
    const v = value === true ? '' : String(value);
    if (el.getAttribute(name) !== v) el.setAttribute(name, v);
  }
}

/** Radius that covers a w by h box from the point (x, y). */
export const cover = (x, y, w, h) =>
  Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));

/**
 * Ink: a new colour grows as a circle from the point of the click, and the base colour switches
 * only once the circle covers the shape, so a colour change never passes through a muddy mix.
 *   const k = ink('#fff'); k.to(t, '#111', x, y, cover(x, y, w, h));
 *   paintInk(k.at(t, reduced), surfaceEl, [layerEl1, layerEl2]);
 */
export function ink(base, sp = PRESETS.morph) {
  return {
    base,
    list: [],
    to(t, color, x, y, R, s = sp) { this.list.push({ t, color, x, y, R, sp: s }); this.list.sort((a, b) => a.t - b.t); return this; },
    at(t, reduced = false, layers = 2) {
      let b = this.base;
      let active = [];
      for (const e of this.list) {
        if (e.t > t) break;
        const p = reduced ? 1 : springStep(e.sp, t - e.t);
        if (p >= 1) { b = e.color; active = []; } else active.push({ color: e.color, r: p * e.R, x: e.x, y: e.y });
      }
      while (active.length > layers) b = active.shift().color;
      return { base: b, layers: active };
    },
    settled(t) { return this.list.every((e) => e.t > t || t >= e.t + settleTime(e.sp)); },
  };
}

/** Paints an ink state: base colour on the surface, growing circles on overlay elements via clip-path. */
export function paintInk(state, surface, layerEls) {
  const px = (v) => `${Math.round(v * 100) / 100}px`;
  surface.style.background = state.base;
  layerEls.forEach((el, i) => {
    const L = state.layers[i];
    if (!L) { el.style.visibility = 'hidden'; el.style.clipPath = ''; el.style.background = ''; return; }
    el.style.visibility = 'visible';
    el.style.background = L.color;
    el.style.clipPath = `circle(${px(L.r)} at ${px(L.x)} ${px(L.y)})`;
  });
}

// ------------------------------------------------------------------ live driver

const reducedQuery = () =>
  typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

/**
 * Drives live components with requestAnimationFrame, only while something moves.
 *   const d = driver(draw);   // draw(t, { reduced }) paints every frame from pure functions of t
 *   d.now();                  // seconds on the driver clock, use it for track.to(d.now(), ...)
 *   d.kick();                 // call after adding a change; drawing runs until busy() is false
 *   d.busy = (t) => !tab.settled(t);  // tell the driver when it may stop
 * With prefers-reduced-motion the driver draws once per change, and components read
 * target(t) or still(t) instead of at(t), so nothing moves but every state is shown.
 */
export function driver(draw, o = {}) {
  const q = o.reduced === undefined ? reducedQuery() : null;
  const clock = o.clock || (() => performance.now() / 1000);
  let frame = 0;
  const d = {
    get reduced() { return o.reduced !== undefined ? !!o.reduced : !!(q && q.matches); },
    now: clock,
    busy: () => false,
    kick() {
      if (frame) return;
      const tick = () => {
        frame = 0;
        const t = clock();
        draw(t, { reduced: d.reduced });
        if (!d.reduced && d.busy(t)) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    },
    stop() { if (frame) cancelAnimationFrame(frame); frame = 0; },
  };
  if (q && q.addEventListener) q.addEventListener('change', () => d.kick());
  return d;
}

/**
 * Demo timeline for the video: seek(t) paints the component at any time, the same way the
 * live driver does. Components export demo(tl) that schedules their changes on tl (in beats).
 */
export function beats(bpm = 120) {
  const b = 60 / bpm;
  return (n) => n * b;
}
