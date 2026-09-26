/*
 * UNSCORED: pružiny v uzavretom tvare a krivky.
 * Skopírované z products/motion/src/core.js (ARLing Motion core, MIT, náš kód), len časť, ktorú hra potrebuje.
 * Hodnota je čistá funkcia času: Track drží zmeny cieľa, hodnota v čase t je súčet jednej pružiny na zmenu.
 */

export function spring(response, damping = 0.86) {
  return { response, damping };
}

export const PRESETS = {
  press: spring(0.16, 0.9),
  release: spring(0.34, 0.8),
  snappy: spring(0.32, 0.86),
  smooth: spring(0.5, 0.86),
  gentle: spring(0.7, 0.95),
  enter: spring(0.38, 0.9),
  camera: spring(0.62, 1),
  cameraFar: spring(0.9, 1),
  // Nitka po napnutí sa zachveje ako skutočná niť (jediná vedomá výnimka z limitu prekmitu 3 %).
  thread: spring(0.5, 0.55),
};

export const SETTLE = 5e-5;

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

export function springStep(sp, tau) {
  return tau <= 0 ? 0 : 1 - springDisp(sp, tau, 1, 0);
}

const settleCache = new Map();
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

export class Track {
  constructor(initial, sp = PRESETS.smooth) {
    this.initial = initial;
    this.sp = sp;
    this.ev = [];
  }

  to(t, target, sp) {
    this.ev.push({ t, target, sp: sp || this.sp });
    this.ev.sort((a, b) => a.t - b.t);
    return this;
  }

  /** Okamžitá zmena bez pohybu (znížený pohyb, prvé zarámovanie). */
  jump(target) {
    this.initial = target;
    this.ev = [];
    return this;
  }

  target(t = Infinity) {
    let target = this.initial;
    for (const e of this.ev) {
      if (e.t > t) break;
      target = e.target;
    }
    return target;
  }

  at(t) {
    let v = this.initial;
    let target = this.initial;
    for (const e of this.ev) {
      if (e.t > t) break;
      v += (e.target - target) * springStep(e.sp, t - e.t);
      target = e.target;
    }
    return v;
  }

  settled(t) {
    for (const e of this.ev) {
      if (e.t > t) break;
      if (t < e.t + settleTime(e.sp)) return false;
    }
    return true;
  }

  compact(t) {
    if (this.ev.length && this.settled(t)) {
      this.initial = this.target(t);
      this.ev = this.ev.filter((e) => e.t > t);
    }
    return this;
  }
}

export const track = (initial, sp) => new Track(initial, sp);

/** Kubická Bézierova krivka ako v CSS (x1, y1, x2, y2), vracia funkciu 0..1 na 0..1. */
export function cubic(x1, y1, x2, y2) {
  const bx = (t) => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3;
  const by = (t) => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 22; i++) {
      const m = (lo + hi) / 2;
      if (bx(m) < x) lo = m; else hi = m;
    }
    return by((lo + hi) / 2);
  };
}

export const KRIVKY = {
  prichod: cubic(0.2, 0, 0, 1),
  odchod: cubic(0.4, 0, 1, 1),
  nastup: cubic(0.34, 1.56, 0.64, 1),
  sinus: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * x)),
};
