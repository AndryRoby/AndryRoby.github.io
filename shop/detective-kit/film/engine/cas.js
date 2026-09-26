// kodfilm/cas.js: čas, easing, náhoda so semienkom a časová os scén.
// Všetko je čistá funkcia času t (sekundy), aby window.__vykresli(t) dal pri rendri vždy ten istý obraz.

export const obmedz = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, p) => a + (b - a) * p;
export const mix = lerp;

/** Lokálny postup 0..1 okna [od, do] (mimo okna 0 alebo 1). */
export const okno = (t, od, dokedy) => obmedz((t - od) / (dokedy - od));
/** Je t v okne [od, do)? */
export const v = (t, od, dokedy) => t >= od && t < dokedy;
/** Nábeh a dobeh: 0 pred od, 1 medzi, 0 po do; hrany dlhé nabeh a dobeh sekúnd. */
export function obalka(t, od, dokedy, nabeh = 0.3, dobeh = 0.3) {
  if (t < od || t > dokedy) return 0;
  return Math.min(nabeh > 0 ? obmedz((t - od) / nabeh) : 1, dobeh > 0 ? obmedz((dokedy - t) / dobeh) : 1);
}

// Easing (p v 0..1). Mená sú anglické, lebo tak ich pozná každý animátor.
export const ease = {
  linear: (p) => p,
  inQuad: (p) => p * p,
  outQuad: (p) => 1 - (1 - p) * (1 - p),
  inOutQuad: (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
  inCubic: (p) => p * p * p,
  outCubic: (p) => 1 - Math.pow(1 - p, 3),
  inOutCubic: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  outQuart: (p) => 1 - Math.pow(1 - p, 4),
  outQuint: (p) => 1 - Math.pow(1 - p, 5),
  inExpo: (p) => (p === 0 ? 0 : Math.pow(2, 10 * p - 10)),
  outExpo: (p) => (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)),
  inOutSine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  outBack: (p, s = 1.70158) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2),
  /** Pružina: dopad s jemným dokmitaním (hodí sa na dopad predmetu). */
  pruzina: (p, tlmenie = 5.5, kmity = 2.2) => 1 - Math.exp(-tlmenie * p) * Math.cos(kmity * Math.PI * 2 * p * 0.5),
  /** Dopad s odrazom (klasický bounce). */
  outBounce(p) {
    const n = 7.5625, d = 2.75;
    if (p < 1 / d) return n * p * p;
    if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
    if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
    return n * (p -= 2.625 / d) * p + 0.984375;
  },
};

/** Kubický bezier ako v CSS (cubic-bezier(x1,y1,x2,y2)), vracia funkciu p -> hodnota. */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (u) => ((ax * u + bx) * u + cx) * u;
  const sy = (u) => ((ay * u + by) * u + cy) * u;
  const dx = (u) => (3 * ax * u + 2 * bx) * u + cx;
  return (p) => {
    let u = p;
    for (let i = 0; i < 6; i++) {
      const e = sx(u) - p, d = dx(u);
      if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break;
      u -= e / d;
    }
    return sy(obmedz(u));
  };
}

/** Náhoda so semienkom (mulberry32). Rovnaké semienko, rovnaká postupnosť. */
export function nahoda(semienko = 1) {
  let a = semienko >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash dvoch celých čísel na 0..1 (bez stavu, na častice počítané priamo z času). */
export function hash(a, b = 0) {
  let x = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/**
 * Časová os scén. sceny = [{ od, do, kresli(ctx, p, t, svet) }], p je lokálny postup 0..1.
 * Scény sa kreslia v poradí, v akom sú v zozname; prekrývanie okien = prechod.
 */
export function casovaOs(sceny) {
  return {
    sceny,
    aktivne: (t) => sceny.filter((s) => t >= s.od && t <= s.do),
    kresli(ctx, t, svet) {
      for (const s of sceny) if (t >= s.od && t <= s.do) s.kresli(ctx, okno(t, s.od, s.do), t, svet);
    },
  };
}

/** Prechody: vracajú alfa alebo posun pre starú (a) a novú (b) scénu podľa postupu p. */
export const prechod = {
  prelinanie: (p) => ({ a: 1 - p, b: p }),
  /** Nová scéna vyjde zdola s jemným spomalením. */
  vysun: (p, vyska) => ({ a: 1 - p, b: 1, posunB: (1 - ease.outCubic(p)) * vyska }),
};
