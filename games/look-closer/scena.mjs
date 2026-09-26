/* Look Closer: a corner of Puzzle Village where animals and things hide.
   A scene is a hand-composed template (where the cottages, trees, paths and the
   yard stand) filled in from a seed: colours, which props, which animals hide
   where. Every hiding place is measured before a scene is used (silueta.mjs):
   what the player can see of each thing, how big it is on a 390 px phone and
   where a tap finds it. A scene that fails is thrown away and the next seed of
   the same day is tried. No DOM and no Math.random: the browser and node build
   the same scene from the same seed. */
import {
  iso, cottage, tree, bush, flowers, stone, fence, chimneyTop,
  hedgehog, magpie, squirrel, badger, dormouse, hare, fox, owl, vole, otter, swan, heron, beaver
} from '../village/iso.js?v=3';
import { hash, rng } from '../village/riso.js?v=3';
import * as K from './kresby.mjs?v=1';
import { hranice, viditelnost, zasah } from './silueta.mjs?v=1';

const TAU = Math.PI * 2;
const { sin, cos, min, max, abs, hypot, floor, round, PI } = Math;

export const VERZIA = 1;
/* the print, in world units of the village (a tile is 64 by 32) */
export const SW = 340, SH = 425;
export const RECT = { x0: -170, y0: 55, x1: 170, y1: 480 };
/* the reference phone: 390 CSS px wide, the print 8 px from each side */
export const REF = { sirka: 390, okraj: 8 };
export const REF_MIERKA = (REF.sirka - 2 * REF.okraj) / SW;
/* how far from a drawing a finger may land, in CSS px */
export const TOL_DOTYK = 10, TOL_MYS = 6;

/* ── What can hide: the things to find ──────────────────────────────────── */
/* kde: where it may sit. zem = on the ground, strecha = on a roof, koruna = in a
   tree, na = on something (a bench, a barrel), voda = on the pond, breh = at its edge.
   kresli(p, x, y, s, f, g, poza, farba): g is a small gesture 0..1 (found, alive) */
export const DRUHY = {
  hedgehog: { meno: 'hedgehog', kde: ['zem'], s: 1.75, kresli: (p, x, y, s, f, g) => hedgehog(p, x, y - g * 4 * s, s, f, 0.5, false) },
  hare: { meno: 'hare', kde: ['zem'], s: 1.55, kresli: (p, x, y, s, f, g) => hare(p, x, y, s, f, 0.5, false, g) },
  badger: { meno: 'badger', kde: ['zem'], s: 1.45, kresli: (p, x, y, s, f, g) => badger(p, x, y - g * 3 * s, s, f, 0.5, false) },
  fox: { meno: 'fox', kde: ['zem'], s: 1.6, kresli: (p, x, y, s, f, g) => fox(p, x, y, s, f, 0.5, false, g * 0.9 - 0.2, false) },
  dormouse: { meno: 'dormouse', kde: ['zem', 'na'], s: 2.1, kresli: (p, x, y, s, f, g) => dormouse(p, x, y - g * 2 * s, s, f, 0.5, false, g < 0.12) },
  vole: {
    meno: 'vole', kde: ['zem'], s: 2.4, kresli: (p, x, y, s, f, g) => {
      p.ellipse('orange', 0.4, x, y + 0.2 * s, 5.8 * s, 2.2 * s, 0, 0, PI);
      p.ellipse('night', 0.55, x, y, 4.4 * s, 1.6 * s);
      vole(p, x, y - 0.3 * s, s, f, 0.5, false, 1 - g * 0.7);
    }
  },
  cat: { meno: 'cat', kde: ['zem', 'strecha', 'na'], s: 1.6, farby: ['ginger', 'grey'], kresli: (p, x, y, s, f, g, poza, farba) => K.macka(p, x, y, s, f, 0.5, false, g, poza, farba) },
  wateringcan: { meno: 'watering can', kde: ['zem'], s: 1.3, farby: ['teal', 'green', 'blue', 'pink'], kresli: (p, x, y, s, f, g, poza, farba) => K.krhla(p, x, y, s, f, farba, g) },
  magpie: { meno: 'magpie', kde: ['strecha', 'koruna', 'na'], s: 1.45, kresli: (p, x, y, s, f, g) => magpie(p, x, y - g * 3 * s, s, f, 0.5, false, g) },
  squirrel: { meno: 'squirrel', kde: ['koruna', 'strecha', 'na'], s: 1.5, kresli: (p, x, y, s, f, g) => squirrel(p, x, y, s, f, 0.5, false, g) },
  owl: { meno: 'owl', kde: ['koruna', 'strecha'], s: 2.0, kresli: (p, x, y, s, f, g) => owl(p, x, y - g * 2 * s, s, f, 0.5, g > 0.3 && g < 0.7, false) },
  kite: { meno: 'kite', kde: ['koruna'], s: 1.3, farby: ['pink', 'blue', 'teal'], kresli: (p, x, y, s, f, g, poza, farba) => K.drak(p, x, y, s, g, drakFarby(farba)) },
  otter: { meno: 'otter', kde: ['voda', 'breh'], s: 1.3, kresli: (p, x, y, s, f, g, poza) => otter(p, x, y - g * 3 * s, s, f, 0.5, false, poza === 'voda') },
  swan: { meno: 'swan', kde: ['voda'], s: 1.7, kresli: (p, x, y, s, f, g) => swan(p, x, y - g * 2 * s, s, f, 0.5, false, false) },
  heron: { meno: 'heron', kde: ['breh'], s: 1.15, kresli: (p, x, y, s, f, g) => heron(p, x, y, s, f, 0.5, false, g) },
  beaver: { meno: 'beaver', kde: ['breh'], s: 1.5, kresli: (p, x, y, s, f, g) => beaver(p, x, y, s, f, 0.5, false, g) }
};
function drakFarby(f) { return f === 'blue' ? ['blue', 'sun', 'teal', 'paper'] : f === 'teal' ? ['teal', 'paper', 'orange', 'sun'] : ['pink', 'sun', 'blue', 'paper']; }
/* the icon for the list below the scene: the same thing, the same colours */
export function kresliIkonu(p, c, s) {
  DRUHY[c.kluc].kresli(p, 0, 0, s, c.obj ? c.obj.f : 1, 0, c.poza, c.farba);
}

/* ── Seeds and days ─────────────────────────────────────────────────────── */
export function semienko(str) {
  let h = 2166136261;
  for (let k = 0; k < str.length; k++) { h ^= str.charCodeAt(k); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
  return h >>> 0 || 1;
}
export const semienkoDna = d => semienko(`look-closer|${VERZIA}|day|${d}`);
export const semienkoNekonecne = n => semienko(`look-closer|${VERZIA}|endless|${n}`);
/* the day in Bratislava, the same for everyone, like the daily puzzles */
export function dnesBratislava(now = new Date()) {
  try {
    const s = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  } catch (e) { /* local time below */ }
  const p = x => String(x).padStart(2, '0');
  return now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate());
}

/* ── Levels ─────────────────────────────────────────────────────────────── */
/* n things to find; the least share of each that shows; its visible size on the
   reference phone (long side, short side in CSS px, area in CSS px squared);
   decoys = other animals that are not on the list */
/* skryt: at least this many are partly hidden (a tenth or more covered) or sit up on something */
export const UROVNE = [
  { n: 5, minPodiel: 0.72, minDlhsia: 32, minKratsia: 14, minPlocha: 260, navnady: 0, zvacsenie: 1.12, skryt: 0 },
  { n: 6, minPodiel: 0.6, minDlhsia: 30, minKratsia: 13, minPlocha: 220, navnady: 1, zvacsenie: 1.05, skryt: 2 },
  { n: 6, minPodiel: 0.5, minDlhsia: 28, minKratsia: 12, minPlocha: 180, navnady: 2, zvacsenie: 1, skryt: 3 },
  { n: 7, minPodiel: 0.5, minDlhsia: 28, minKratsia: 12, minPlocha: 180, navnady: 2, zvacsenie: 1, skryt: 4 }
];
export const UROVEN_DNA = 2;
export function urovenNekonecna(n) { return n <= 3 ? 0 : n <= 10 ? 1 : n <= 30 ? 2 : 3; }
/* the centres of two things to find stand at least this far apart (CSS px, reference phone) */
export const MIN_ROZOSTUP = 52;

/* ── Small helpers ──────────────────────────────────────────────────────── */
export function naDlazdicu(x, y) { return [y / 32 + x / 64, y / 32 - x / 64]; }
function zamiesaj(r, a) { const b = a.slice(); for (let k = b.length - 1; k > 0; k--) { const q = floor(r() * (k + 1)); [b[k], b[q]] = [b[q], b[k]]; } return b; }
function vyber(r, a) { return a[floor(r() * a.length)]; }
function kriva(c, pts) {
  c.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length - 1; k++) {
    const mx = (pts[k][0] + pts[k + 1][0]) / 2, my = (pts[k][1] + pts[k + 1][1]) / 2;
    c.quadraticCurveTo(pts[k][0], pts[k][1], mx, my);
  }
  const L = pts[pts.length - 1]; c.lineTo(L[0], L[1]);
}
const Rg = fn => (c, ox, oy) => { c.save(); c.translate(ox, oy); fn(c); c.restore(); };
function vzdialenostOdCiest(x, y, cesty) {
  let d = Infinity;
  for (const P of cesty) for (let k = 0; k < P.length - 1; k++) {
    const a = P[k], b = P[k + 1], vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy;
    const t = L ? max(0, min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / L)) : 0;
    d = min(d, hypot(x - a[0] - vx * t, y - a[1] - vy * t));
  }
  return d;
}

/* ── Scene objects ──────────────────────────────────────────────────────── */
let PORADIE = 0;
function obj(druh, meno, x, y, kresli, extra = {}) {
  const [pi, pj] = naDlazdicu(x, y);
  return Object.assign({ druh, meno, x, y, pi, pj, key: y, kresli, miesta: [], n: PORADIE++ }, extra);
}
/* a cottage: tile corner (i, j), size w by d tiles, h high */
function chalupa(i, j, w, d, h, roof, wall, opt, meno = 'cottage') {
  const rh = opt.rh || h * 0.75;
  const [cx, cy] = iso(i + w / 2, j + d / 2);
  const o = obj('chalupa', meno, cx, cy, p => { cottage(p, i, j, w, d, h, roof, wall, opt); }, { fp: [i, j, i + w, j + d], rozmer: { i, j, w, d, h, rh } });
  o.dvere = iso(i + (opt.door ?? w * 0.5), j + d);
  // the ridge: things sit on it at two places; the chimney top for a bird
  const e = 0.14;
  for (const t of [0.26, 0.7]) {
    const [x, y] = iso(i - e + (w + 2 * e) * t, j + d / 2, h + rh);
    o.miesta.push({ x, y: y + 0.6, typ: 'strecha', rel: 'na', host: o, veta: 'on the roof' });
  }
  if (opt.chimney !== false) { const [x, y] = chimneyTop(i, j, w, d, h, rh); o.miesta.push({ x, y: y - 1.5, typ: 'strecha', rel: 'na', host: o, veta: 'on the chimney', lenPtak: true }); }
  return o;
}
function strom(x, y, s, kind, seed, meno) {
  const o = obj('strom', meno || (kind === 'fruit' ? 'apple tree' : kind === 'pine' ? 'pine' : 'tree'), x, y, p => tree(p, x, y, s, kind, seed), { s, kind });
  if (kind !== 'pine') {
    const cy = y - 17 * s;
    o.miesta.push({ x: x - 4 * s, y: cy + 3 * s, typ: 'koruna', rel: 'na', host: o, veta: 'in the ' + o.meno });
    o.miesta.push({ x: x + 5 * s, y: cy + 1 * s, typ: 'koruna', rel: 'na', host: o, veta: 'in the ' + o.meno });
    o.miesta.push({ x: x - 12 * s, y: cy - 1 * s, typ: 'koruna', rel: 'za', host: o });
    o.miesta.push({ x: x + 12.5 * s, y: cy + 2 * s, typ: 'koruna', rel: 'za', host: o });
  } else {
    // only a kite looks right caught at the side of a pine; a bird there floats
    o.miesta.push({ x: x + 10 * s, y: y - 8 * s, typ: 'koruna', rel: 'za', host: o, lenDrak: true });
  }
  o.miesta.push({ x: x + 3 * s, y: y - 2.5, typ: 'zem', rel: 'za', host: o });
  return o;
}
function ker(x, y, s, ink) {
  const o = obj('ker', 'bush', x, y, p => bush(p, x, y, s, ink), { s });
  o.miesta.push({ x: x - 10 * s, y: y - 3.2 * s, typ: 'zem', rel: 'za', host: o });
  o.miesta.push({ x: x + 10 * s, y: y - 3.4 * s, typ: 'zem', rel: 'za', host: o });
  o.miesta.push({ x: x + 2 * s, y: y - 5 * s, typ: 'zem', rel: 'za', host: o });
  return o;
}
function okolo(o, dx, dy, typy = ['zem']) {
  for (const [a, b] of [[-dx, -dy], [dx, -dy]]) for (const typ of typy) o.miesta.push({ x: o.x + a, y: o.y + b, typ, rel: 'za', host: o });
}
/* a vegetable bed: the soil (ground layer) and rows of cabbages along i */
function zahon(O, zahony, x0, y0, n, m, seed) {
  const q = (u, v) => K.naZemi(x0, y0, u, v);
  zahony.push({ poly: [q(-0.32, -0.26), q((n - 1) * 0.36 + 0.32, -0.26), q((n - 1) * 0.36 + 0.32, (m - 1) * 0.42 + 0.26), q(-0.32, (m - 1) * 0.42 + 0.26)], rady: m, n, x0, y0 });
  for (let k = 0; k < m; k++) {
    const [x, y] = q(0, k * 0.42);
    const o = obj('rad', 'cabbages', x, y, p => K.kapusty(p, x, y, n, 1.05, seed + k));
    const [i0, j0] = naDlazdicu(x, y);
    o.fp = [i0 - 0.18, j0 - 0.12, i0 + (n - 1) * 0.36 + 0.18, j0 + 0.12];
    o.key = K.naZemi(x, y, (n - 1) * 0.18, 0)[1];
    for (let t = 0; t < n - 1; t++) { const [hx, hy] = K.naZemi(x, y, t * 0.36 + 0.18, -0.21); o.miesta.push({ x: hx, y: hy, typ: 'zem', rel: 'za', host: o }); }
    O.push(o);
  }
}
function slnecnica(x, y, s, h, nak) {
  const o = obj('slnecnica', 'sunflower', x, y, p => K.slnecnica(p, x, y, s, h, nak));
  o.miesta.push({ x: x + 6, y: y - 3, typ: 'zem', rel: 'za', host: o });
  return o;
}
function travy(r, O, cesty, body, n) {
  for (const [x, y] of zamiesaj(r, body)) {
    if (n <= 0) break;
    if (vzdialenostOdCiest(x, y, cesty) < 16) continue;
    const s = 1.2 + r() * 0.35, seed = floor(r() * 1000);
    const o = obj('trava', 'tall grass', x, y, p => K.trava(p, x, y, s, seed));
    o.miesta.push({ x: x - 2, y: y - 3.5, typ: 'zem', rel: 'za', host: o });
    O.push(o); n--;
  }
}
function kamene(r, O, cesty, n) {
  for (let k = 0; k < n * 3 && n > 0; k++) {
    const x = RECT.x0 + 20 + r() * (SW - 40), y = RECT.y0 + 90 + r() * (SH - 110), d = vzdialenostOdCiest(x, y, cesty);
    if (d > 13 && d < 30) { const s = 1 + r() * 0.5; O.push(obj('kamen', 'stone', x, y, p => stone(p, x, y, s))); n--; }
  }
}

/* ═══ Templates of Orchard Lane ═════════════════════════════════════════
   Each returns { zem, objekty, volne, druhy }. Composed by hand: the cottages,
   the path to their doors, the orchard, the yard. The seed picks colours and
   which props stand in which of their places. */
const STRECHY = ['blue', 'pink', 'plum', 'teal', 'orange'];
const STENY = ['sun', 'pink', 'blue', 'orange'];

function farbyChalup(r, n) {
  const s = zamiesaj(r, STRECHY), w = [];
  for (let k = 0; k < n; k++) { let x = vyber(r, STENY); if (x === s[k]) x = 'sun'; w.push(x); }
  return s.slice(0, n).map((roof, k) => ({ roof, wall: w[k] }));
}

/* A: two cottages, the lane between them, the orchard behind a fence */
function sablonaSad(r) {
  const O = [], volne = [];
  const j1 = () => (r() - 0.5) * 6;
  const F = farbyChalup(r, 2);
  // cottage at the back, right
  const A = chalupa(4.96, 2.41, 2.2, 1.8, 28, F[0].roof, F[0].wall, { rh: 21, winsJ: r() < 0.5 ? [0.45, 1.75] : [0.5], winsI: [0.9], chimney: true, door: r() < 0.5 ? 1.1 : 1.45 });
  // cottage in the middle, left
  const B = chalupa(6.48, 9.65, 2.2, 1.8, 26, F[1].roof, F[1].wall, { rh: 19, winsJ: r() < 0.5 ? [0.4, 1.8] : [1.75], winsI: [0.9], chimney: r() < 0.75, door: r() < 0.5 ? 1.1 : 0.8 });
  O.push(A, B);
  const dA = A.dvere, dB = B.dvere;
  const hlavna = [[-5 + j1(), 495], [8, 440], [28, 385], [38, 330], [20, 268], [34, 214], [dA[0] - 4, dA[1] + 10], [dA[0], dA[1] + 3]];
  const odbocka = [[30, 373], [-18, 356], [-74, dB[1] + 26], [dB[0] + 4, dB[1] + 10], [dB[0], dB[1] + 3]];
  const cesty = [hlavna, odbocka];

  // trees: a pine and a round tree at the back, the orchard on the right
  const druhSadu = () => (r() < 0.62 ? 'fruit' : r() < 0.5 ? 'round' : 'autumn');
  O.push(strom(160 + j1() * 0.5, 104, 2.5, r() < 0.5 ? 'round' : 'autumn', 11));
  O.push(strom(-152, 148 + j1(), 2.3, 'pine', 12));
  if (r() < 0.7) O.push(strom(-100 + j1(), 110, 2.2, r() < 0.5 ? 'round' : 'pine', 13));
  const sad = [[100, 250], [152, 302], [94, 338], [150, 226]];
  for (const [k, [x, y]] of sad.entries()) if (k < 3 || r() < 0.55) O.push(strom(x + j1(), y + j1() * 0.5, 2.2 + r() * 0.3, druhSadu(), 20 + k));

  // bushes in some of their places
  const kery = [[-150, 458], [-62, 470], [-18, 252], [172, 246], [-158, 345], [-44, 402], [8, 150], [125, 470]];
  for (const [x, y] of kery) if (r() < 0.6) O.push(ker(x + j1(), y + j1() * 0.5, 2.1 + r() * 0.5, r() < 0.3 ? 'teal' : 'green'));

  // the yard
  if (r() < 0.8) {
    const w = obj('studna', 'well', -52 + j1(), 182, null);
    const s = 1.05, st = vyber(r, ['blue', 'teal', 'plum', 'pink']);
    w.kresli = p => K.studna(p, w.x, w.y, s, st);
    w.miesta.push({ x: w.x - 7 * s, y: w.y - 10 * s - 3 * s, typ: 'na', rel: 'na', host: w, veta: 'on the well' });
    okolo(w, 15, 5);
    O.push(w);
  }
  if (r() < 0.8) {
    const b = obj('lavicka', 'bench', 68, 294 + j1() * 0.5, null, {});
    b.kresli = p => K.lavicka(p, b.x, b.y, 1.15, -1, vyber(r, ['orange', 'teal', 'blue']));
    const [bi, bj] = naDlazdicu(b.x, b.y); b.fp = [bi - 0.1, bj - 0.6, bi + 0.1, bj + 0.6];
    b.miesta.push({ x: b.x - 4, y: b.y - 7.5 * 1.15 + 2, typ: 'na', rel: 'na', host: b, veta: 'on the bench' });
    b.miesta.push({ x: b.x + 6, y: b.y + 1, typ: 'zem', rel: 'za', host: b });
    O.push(b);
  }
  const sudov = floor(r() * 3);
  for (let k = 0; k < sudov; k++) {
    const o = obj('sud', 'barrel', -30 + k * 15, 320 + k * 9, null);
    const ink = vyber(r, ['orange', 'orange', 'teal']);
    o.kresli = p => K.sud(p, o.x, o.y, 1.15, ink);
    o.miesta.push({ x: o.x - 4, y: o.y - 17 * 1.15 - 1, typ: 'na', rel: 'na', host: o, veta: 'on the barrel' });
    okolo(o, 9, 4);
    O.push(o);
  }
  // the bed in front of the left cottage is decided first: with it, the washing hangs lower
  const maZahon = r() < 0.75;
  if (r() < 0.85) {
    const a = [-162 + j1() * 0.5, maZahon ? 412 : 385], b = [a[0] + 78, a[1] + 39];
    const veci = [];
    const n = 3 + floor(r() * 2);
    for (let k = 0; k < n; k++) veci.push({ t: 0.16 + k * (0.68 / (n - 1)), druh: vyber(r, ['sheet', 'shirt', 'shirt', 'socks']), ink: vyber(r, ['paper', 'pink', 'blue', 'sun', 'teal', 'plum']) });
    const o = obj('snura', 'washing', (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, p => K.snura(p, a, b, 1.05, veci));
    const [ai, aj] = naDlazdicu(...a), [bi, bj] = naDlazdicu(...b);
    o.fp = [min(ai, bi), min(aj, bj) - 0.06, max(ai, bi), max(aj, bj) + 0.06];
    for (const v of veci) if (v.druh !== 'socks') { const x = a[0] + (b[0] - a[0]) * v.t, y = a[1] + (b[1] - a[1]) * v.t; o.miesta.push({ x: x + 2, y: y - 7, typ: 'zem', rel: 'za', host: o }); }
    O.push(o);
  }
  if (r() < 0.7) {
    const o = obj('drevo', 'log pile', 150, 194, null);
    o.kresli = p => K.drevo(p, o.x, o.y, 1.25);
    o.miesta.push({ x: o.x - 1, y: o.y - 17, typ: 'na', rel: 'na', host: o, veta: 'on the log pile' });
    okolo(o, 13, 4);
    O.push(o);
  }
  if (r() < 0.75) {
    const o = obj('bedna', 'crate', 60 + j1(), 398, null);
    const ov = vyber(r, ['pink', 'orange', 'sun']);
    o.kresli = p => K.bedna(p, o.x, o.y, 1.25, ov, 7);
    okolo(o, 10, 5);
    O.push(o);
  }
  if (r() < 0.6) {
    const o = obj('kosik', 'basket', 84, 414, null);
    o.kresli = p => K.kosik(p, o.x, o.y, 1.2, vyber(r, ['pink', 'orange']));
    O.push(o);
  }
  if (r() < 0.6) {
    const o = obj('furik', 'wheelbarrow', 116, 420, null);
    const ink = vyber(r, ['green', 'blue', 'teal', 'pink']), f = r() < 0.5 ? 1 : -1;
    o.kresli = p => K.furik(p, o.x, o.y, 1.2, ink, f);
    okolo(o, 13, 4);
    O.push(o);
  }
  const ulov = 1 + floor(r() * 3);
  for (let k = 0; k < ulov; k++) {
    const o = obj('ul', 'beehive', [128, 160, 104][k], [362, 380, 380][k], null);
    o.kresli = p => K.ul(p, o.x, o.y, 1.15);
    okolo(o, 10, 4);
    O.push(o);
  }
  if (r() < 0.7) { const o = obj('lampa', 'lamp', -22, 432, null); o.kresli = p => K.lampa(p, o.x, o.y, 1.05); O.push(o); }
  if (r() < 0.5) { const o = obj('budka', 'birdhouse', -8, 232, null); const ink = vyber(r, ['teal', 'pink', 'blue']); o.kresli = p => K.budka(p, o.x, o.y, 1.05, ink); O.push(o); }
  for (const [x, y] of [[-146, 302], [-104, 322]]) if (r() < 0.65) { const o = obj('crepnik', 'flower pot', x, y, null); const kv = vyber(r, ['pink', 'plum', 'paper']); o.kresli = p => K.crepnik(p, o.x, o.y, 1.1, kv); O.push(o); }
  // the vegetable bed in front of the left cottage
  const zahony = [];
  if (maZahon) zahon(O, zahony, -138 + j1() * 0.4, 340, 4, 3, floor(r() * 100));
  // the orchard fence along the front, right, sunflowers behind it
  {
    const a = naDlazdicu(170, 408), b = naDlazdicu(46, 470);
    const o = obj('plot', 'fence', 108, 439, p => fence(p, a, b, 7, 10));
    o.fp = [a[0] - 0.02, min(a[1], b[1]), a[0] + 0.02, max(a[1], b[1])];
    for (const t of [0.2, 0.5, 0.8]) { const x = 170 + (46 - 170) * t, y = 408 + (470 - 408) * t; o.miesta.push({ x: x + 4, y: y - 6, typ: 'zem', rel: 'za', host: o }); }
    O.push(o);
    for (const t of [0.07, 0.2, 0.76, 0.9]) if (r() < 0.55) O.push(slnecnica(170 + (46 - 170) * t + 4, 408 + (470 - 408) * t - 9, 0.9 + r() * 0.1, 27 + r() * 6, (r() - 0.5) * 1.4));
  }
  travy(r, O, cesty, [[-166, 252], [134, 462], [-92, 472], [172, 160], [-24, 192], [62, 352], [-128, 150], [166, 404], [-70, 410], [110, 195]], 3 + floor(r() * 3));
  kamene(r, O, cesty, 4 + floor(r() * 3));

  // open ground where something can simply sit in the grass
  for (const [x, y] of [[-128, 202], [4, 196], [-72, 384], [-118, 446], [104, 386], [-4, 472], [142, 332], [-58, 292], [60, 450], [-150, 395], [120, 190], [-30, 140]]) volne.push({ x: x + j1(), y: y + j1() * 0.5, typ: 'zem', rel: 'volne', host: null });

  return {
    id: 'orchard-a', meno: 'Orchard Lane', O, volne, cesty,
    druhy: ['hedgehog', 'hare', 'badger', 'fox', 'dormouse', 'vole', 'cat', 'wateringcan', 'magpie', 'squirrel', 'owl', 'kite'],
    zem: { cesty, jazierko: null, zahony }
  };
}

/* B: the mill pond. A cottage at the back, the pond in the middle with a boat and
   reeds, a haystack and the orchard corner in front. */
function sablonaJazierko(r) {
  const O = [], volne = [];
  const j1 = () => (r() - 0.5) * 6;
  const F = farbyChalup(r, 1);
  const A = chalupa(3.3, 3.6, 2.4, 1.8, 28, F[0].roof, F[0].wall, { rh: 21, winsJ: [0.5, 1.9], winsI: [0.9], chimney: true, door: r() < 0.5 ? 1.2 : 1.6 });
  O.push(A);
  const dA = A.dvere;
  // the pond, in tiles: centre and radii
  const pond = { ci: 10.3 + (r() - 0.5) * 0.4, cj: 9.0 + (r() - 0.5) * 0.4, ri: 2.6, rj: 1.9 };
  const [px, py] = iso(pond.ci, pond.cj);
  const cesta = [[-120 + j1(), 495], [-110, 440], [-120, 380], [-80, 300], [-60, 250], [-30, 215], [dA[0] - 2, dA[1] + 12], [dA[0], dA[1] + 3]];
  const cesty = [cesta];

  O.push(strom(150, 110, 2.5, r() < 0.5 ? 'round' : 'autumn', 31));
  O.push(strom(-150, 150, 2.3, 'pine', 32));
  if (r() < 0.7) O.push(strom(-108, 120, 2.1, 'pine', 33));
  O.push(strom(152, 250 + j1(), 2.3, r() < 0.5 ? 'fruit' : 'round', 34));
  if (r() < 0.6) O.push(strom(-150, 300 + j1(), 2.2, r() < 0.5 ? 'fruit' : 'autumn', 35));
  O.push(strom(130, 430 + j1(), 2.4, r() < 0.6 ? 'fruit' : 'round', 36));
  const kery = [[-40, 470], [-160, 460], [60, 170], [172, 350], [-100, 262], [100, 470], [-160, 220]];
  for (const [x, y] of kery) if (r() < 0.6) O.push(ker(x + j1(), y + j1() * 0.5, 2.1 + r() * 0.5, r() < 0.3 ? 'teal' : 'green'));

  // reeds round the pond, the boat on it
  const trst = [];
  for (let k = 0; k < 6; k++) {
    const a = 0.4 + k * 0.62 + (r() - 0.5) * 0.3;
    const x = px + cos(a) * (pond.ri * 45.25 + 3), y = py + sin(a) * (pond.rj * 22.63 + 2);
    if (r() < 0.8) { const o = obj('trstie', 'reeds', x, y, p => K.trstie(p, x, y, 1.3)); okolo(o, 8, 3, ['breh', 'zem']); trst.push(o); O.push(o); }
  }
  if (r() < 0.85) { const x = px - 20, y = py + 6; const ink = vyber(r, ['pink', 'orange', 'teal']); const o = obj('lodka', 'boat', x, y, p => K.lodka(p, x, y, 1.1, ink)); o.miesta.push({ x: x - 4, y: y - 5, typ: 'na', rel: 'na', host: o, veta: 'in the boat' }); O.push(o); }
  // swimmers and waders
  for (const [dx, dy] of [[34, -8], [-44, -10], [10, 14], [52, 10]]) volne.push({ x: px + dx, y: py + dy, typ: 'voda', rel: 'volne', host: null, veta: 'on the pond' });
  for (const a of [3.5, 5.2, 0.2, 1.4, 2.4]) volne.push({ x: px + cos(a) * (pond.ri * 45.25 + 8), y: py + sin(a) * (pond.rj * 22.63 + 5), typ: 'breh', rel: 'volne', host: null, veta: 'by the pond' });

  if (r() < 0.85) {
    const o = obj('kopa', 'haystack', -110 + j1(), 410, null);
    o.kresli = p => K.kopa(p, o.x, o.y, 1.35, 9);
    o.miesta.push({ x: o.x + 2, y: o.y - 25, typ: 'na', rel: 'na', host: o, veta: 'on the haystack' });
    okolo(o, 18, 4);
    O.push(o);
  }
  if (r() < 0.7) {
    const o = obj('studna', 'well', 40 + j1(), 200, null);
    const s = 1.05, st = vyber(r, ['blue', 'teal', 'plum', 'pink']);
    o.kresli = p => K.studna(p, o.x, o.y, s, st);
    o.miesta.push({ x: o.x - 7 * s, y: o.y - 13 * s, typ: 'na', rel: 'na', host: o, veta: 'on the well' });
    okolo(o, 15, 5);
    O.push(o);
  }
  if (r() < 0.75) {
    const o = obj('lavicka', 'bench', 6, 404, null);
    o.kresli = p => K.lavicka(p, o.x, o.y, 1.15, 1, vyber(r, ['orange', 'teal', 'blue']));
    const [bi, bj] = naDlazdicu(o.x, o.y); o.fp = [bi - 0.45, bj - 0.1, bi + 0.45, bj + 0.1];
    o.miesta.push({ x: o.x - 5, y: o.y - 7.5 * 1.15 + 2, typ: 'na', rel: 'na', host: o, veta: 'on the bench' });
    O.push(o);
  }
  const ulov = floor(r() * 3);
  for (let k = 0; k < ulov; k++) { const o = obj('ul', 'beehive', [100, 70][k], [470, 455][k], null); o.kresli = p => K.ul(p, o.x, o.y, 1.15); okolo(o, 10, 4); O.push(o); }
  if (r() < 0.7) { const o = obj('drevo', 'log pile', -40, 190, null); o.kresli = p => K.drevo(p, o.x, o.y, 1.25); o.miesta.push({ x: o.x - 1, y: o.y - 17, typ: 'na', rel: 'na', host: o, veta: 'on the log pile' }); okolo(o, 13, 4); O.push(o); }
  if (r() < 0.6) { const o = obj('bedna', 'crate', 20, 455, null); const ov = vyber(r, ['pink', 'orange', 'sun']); o.kresli = p => K.bedna(p, o.x, o.y, 1.25, ov, 3); okolo(o, 10, 5); O.push(o); }
  if (r() < 0.6) { const o = obj('lampa', 'lamp', -86, 330, null); o.kresli = p => K.lampa(p, o.x, o.y, 1.05); O.push(o); }
  if (r() < 0.5) { const o = obj('budka', 'birdhouse', 100, 190, null); const ink = vyber(r, ['teal', 'pink', 'blue']); o.kresli = p => K.budka(p, o.x, o.y, 1.05, ink); O.push(o); }
  for (const [x, y] of [[dA[0] - 22, dA[1] + 8], [dA[0] + 20, dA[1] + 16]]) if (r() < 0.6) { const o = obj('crepnik', 'flower pot', x, y, null); const kv = vyber(r, ['pink', 'plum', 'paper']); o.kresli = p => K.crepnik(p, o.x, o.y, 1.1, kv); O.push(o); }
  {
    const a = naDlazdicu(-170, 250), b = naDlazdicu(-90, 210);
    const o = obj('plot', 'fence', -130, 230, p => fence(p, a, b, 5, 10));
    o.fp = [a[0] - 0.02, min(a[1], b[1]), a[0] + 0.02, max(a[1], b[1])];
    o.miesta.push({ x: -125, y: 222, typ: 'zem', rel: 'za', host: o });
    O.push(o);
  }
  const zahony = [];
  if (r() < 0.7) zahon(O, zahony, 96 + j1() * 0.4, 386, 3, 3, floor(r() * 100));
  for (const [dx, dy] of [[62, -6], [76, 2], [-58, -8]]) if (r() < 0.5) O.push(slnecnica(dA[0] + dx, dA[1] + dy, 0.9 + r() * 0.1, 27 + r() * 6, (r() - 0.5) * 1.4));
  // a little jetty on the right bank
  if (r() < 0.7) {
    const bx = px + cos(0.62) * (pond.ri * 45.25 + 4), by = py + sin(0.62) * (pond.rj * 22.63 + 2);
    const o = obj('mola', 'jetty', bx, by, p => K.mola(p, bx, by, 1));
    const [mi, mj] = naDlazdicu(bx, by); o.fp = [mi - 1.15, mj - 0.24, mi + 0.1, mj + 0.24];
    const [sx, sy] = K.naZemi(bx, by, -0.75, 0, 4.5);
    o.miesta.push({ x: sx, y: sy, typ: 'na', rel: 'na', host: o, veta: 'on the jetty' });
    O.push(o);
  }
  travy(r, O, cesty, [[-10, 470], [160, 470], [-160, 400], [-40, 300], [168, 200], [60, 470], [-150, 260], [170, 330]], 3 + floor(r() * 3));
  kamene(r, O, cesty, 3 + floor(r() * 3));
  for (const [x, y] of [[-60, 470], [0, 400], [150, 180], [-140, 360], [80, 250], [-100, 250], [70, 400], [-90, 180], [140, 360]]) volne.push({ x: x + j1(), y: y + j1() * 0.5, typ: 'zem', rel: 'volne', host: null });
  // nothing that stands on land may stand in the water
  const mokre = (x, y) => ((x - px) / (pond.ri * 45.25 + 10)) ** 2 + ((y - py) / (pond.rj * 22.63 + 6)) ** 2 < 1;
  for (let k = O.length - 1; k >= 0; k--) { const o = O[k]; if (['ker', 'trava', 'kamen', 'slnecnica', 'ul', 'bedna', 'lampa', 'budka', 'kopa', 'lavicka', 'drevo', 'studna', 'strom'].includes(o.druh) && mokre(o.x, o.y)) O.splice(k, 1); }
  for (let k = volne.length - 1; k >= 0; k--) if (volne[k].typ === 'zem' && mokre(volne[k].x, volne[k].y)) volne.splice(k, 1);
  for (const o of O) o.miesta = o.miesta.filter(m => m.typ !== 'zem' || !mokre(m.x, m.y));

  return {
    id: 'pond-a', meno: 'Mill Pond', O, volne, cesty,
    druhy: ['hedgehog', 'hare', 'fox', 'dormouse', 'cat', 'wateringcan', 'magpie', 'squirrel', 'owl', 'kite', 'otter', 'swan', 'heron', 'beaver'],
    zem: { cesty, jazierko: pond, zahony }
  };
}

export const SABLONY = [sablonaSad, sablonaJazierko];

/* ── Drawing order ──────────────────────────────────────────────────────── */
/* Things stand on a grid. A box (a cottage) is behind a thing that stands in
   front of either of its faces; things sitting on something follow it; a thing
   put behind something comes before it. Everything else goes back to front. */
function priestor(A, B) {
  const fa = A.fp, fb = B.fp;
  if (fa && fb) {
    if (fa[2] <= fb[0] + 1e-6 || fa[3] <= fb[1] + 1e-6) return -1;
    if (fb[2] <= fa[0] + 1e-6 || fb[3] <= fa[1] + 1e-6) return 1;
    return 0;
  }
  if (fa) { const i = B.pi, j = B.pj; if (i >= fa[2] || j >= fa[3]) return -1; if (i <= fa[0] || j <= fa[1]) return 1; return 0; }
  if (fb) { const i = A.pi, j = A.pj; if (i >= fb[2] || j >= fb[3]) return 1; if (i <= fb[0] || j <= fb[1]) return -1; return 0; }
  return 0;
}
export function poradie(a, b) {
  if ((a.pred && a.pred.includes(b)) || (b.po && b.po.includes(a))) return -1;
  if ((b.pred && b.pred.includes(a)) || (a.po && a.po.includes(b))) return 1;
  const A = a.nosic || a, B = b.nosic || b;
  if (A !== B) {
    if (A === b) return 1;
    if (B === a) return -1;
    const s = priestor(A, B);
    if (s) return s;
    if (A !== a || B !== b) { const d = A.key - B.key; if (d) return d < 0 ? -1 : 1; }
  }
  return (a.key - b.key) || (a.n - b.n);
}
function prekryvaju(a, b) { const p = a.bb, q = b.bb; return p && q && !(p[2] < q[0] || p[0] > q[2] || p[3] < q[1] || p[1] > q[3]); }
function viazane(a, b) { return (a.pred && a.pred.includes(b)) || (a.po && a.po.includes(b)) || (b.pred && b.pred.includes(a)) || (b.po && b.po.includes(a)); }
export function zorad(O) {
  const n = O.length, vst = new Array(n).fill(0), hrany = O.map(() => []);
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    if (!prekryvaju(O[a], O[b]) && !viazane(O[a], O[b])) continue;
    if (poradie(O[a], O[b]) < 0) { hrany[a].push(b); vst[b]++; } else { hrany[b].push(a); vst[a]++; }
  }
  const hotove = new Array(n).fill(false), out = [];
  for (let krok = 0; krok < n; krok++) {
    let best = -1;
    for (let k = 0; k < n; k++) if (!hotove[k] && vst[k] === 0 && (best < 0 || O[k].key < O[best].key || (O[k].key === O[best].key && O[k].n < O[best].n))) best = k;
    if (best < 0) { for (let k = 0; k < n; k++) if (!hotove[k] && (best < 0 || O[k].key < O[best].key)) best = k; }
    hotove[best] = true; out.push(O[best]);
    for (const q of hrany[best]) vst[q]--;
  }
  return out;
}

/* ── Measuring a thing to find ───────────────────────────────────────────── */
/* everything printed after o that could cover it */
function krytyPre(o, vsetky) {
  const out = [];
  for (const q of vsetky) if (q !== o && prekryvaju(o, q) && poradie(o, q) < 0) out.push(q);
  return out;
}
export function zmeraj(o, vsetky) { const kr = krytyPre(o, vsetky); const v = viditelnost(o, kr); v.kryt = v.hlavnyKryt >= 0 ? kr[v.hlavnyKryt] : null; return v; }
export function vRef(v) {
  const m = REF_MIERKA;
  if (!v.bb) return { dlhsia: 0, kratsia: 0, plocha: 0 };
  const w = (v.bb[2] - v.bb[0]) * m, h = (v.bb[3] - v.bb[1]) * m;
  return { dlhsia: max(w, h), kratsia: min(w, h), plocha: v.viditelna * m * m, sirka: w, vyska: h };
}
export function vyhovuje(v, U) {
  if (!v.bb) return false;
  const q = vRef(v);
  return v.podiel >= U.minPodiel && q.dlhsia >= U.minDlhsia && q.kratsia >= U.minKratsia && q.plocha >= U.minPlocha;
}
const VNUTRI = 3;
/* the bottom right corner belongs to the zoom button on a phone: nothing to find there */
export const ROH = 58 / REF_MIERKA;
function vnutri(bb) {
  if (!bb || bb[0] < RECT.x0 + VNUTRI || bb[1] < RECT.y0 + VNUTRI || bb[2] > RECT.x1 - VNUTRI || bb[3] > RECT.y1 - VNUTRI) return false;
  return !(bb[2] > RECT.x1 - ROH && bb[3] > RECT.y1 - ROH);
}
export function kvadrant(x, y) {
  const cx = (RECT.x0 + RECT.x1) / 2, cy = (RECT.y0 + RECT.y1) / 2;
  return (y < cy ? 0 : 2) + (x < cx ? 0 : 1);
}
export const KVADRANTY = ['top left', 'top right', 'bottom left', 'bottom right'];

function novyCiel(kluc, spot, r, U) {
  const D = DRUHY[kluc];
  const s = D.s * U.zvacsenie * (0.96 + r() * 0.08);
  const f = r() < 0.5 ? -1 : 1;
  let poza = null;
  if (kluc === 'cat') poza = spot.typ === 'zem' ? (r() < 0.6 ? 'sit' : 'curl') : 'curl';
  if (kluc === 'otter') poza = spot.typ;
  const farba = D.farby ? vyber(r, D.farby) : null;
  const o = obj('ciel', D.meno, spot.x, spot.y, null, { kluc, s, f, poza, farba, spot });
  // up on a roof, a crown or a barrel the inks would darken on what is under them:
  // a paper knockout of the same shapes first, the way the village prints roofs
  const vyrez = spot.rel === 'na' || spot.typ === 'koruna';
  o.kresli = (p, g = 0) => { if (vyrez) D.kresli(papierom(p), o.x, o.y, o.s, o.f, g, o.poza, o.farba); D.kresli(p, o.x, o.y, o.s, o.f, g, o.poza, o.farba); };
  if (spot.rel === 'za') { o.pred = [spot.host]; }
  else if (spot.rel === 'na') { o.po = [spot.host]; o.nosic = spot.host; o.key = spot.host.key + 0.01; o.pi = spot.host.pi; o.pj = spot.host.pj; }
  return o;
}

/* the same pen, but every ink prints as paper and every shadow as nothing */
const TIENE_INK = new Set(['dots', 'nightdots', 'pinkdots']);
function papierom(p) {
  const k = Object.create(p);
  k.ink = (name, a) => (TIENE_INK.has(name) ? p.ink(name, 0) : p.ink('paper', 1));
  return k;
}

function mozeTu(kluc, spot) {
  const D = DRUHY[kluc];
  if (!D.kde.includes(spot.typ)) return false;
  if (spot.lenPtak && kluc !== 'magpie') return false;
  if (spot.lenDrak && kluc !== 'kite') return false;
  if (spot.typ === 'na' && spot.host && spot.host.druh === 'lodka' && !['cat', 'dormouse', 'magpie'].includes(kluc)) return false;
  return true;
}

/* one try at a scene from one stream of the seed */
function pokus(sem, U, cislo) {
  const r = rng((sem ^ Math.imul(cislo + 1, 0x9e3779b1)) >>> 0 || 1);
  PORADIE = 0;
  const S = SABLONY[sem % SABLONY.length](r);
  // nothing else stands in a vegetable bed but its cabbages
  for (const Z of S.zem.zahony || []) {
    const xs = Z.poly.map(q => q[0]), ys = Z.poly.map(q => q[1]);
    const v = (x, y) => x > min(...xs) - 4 && x < max(...xs) + 4 && y > min(...ys) - 3 && y < max(...ys) + 3;
    for (let k = S.O.length - 1; k >= 0; k--) { const o = S.O[k]; if (o.druh !== 'rad' && !o.fp && v(o.x, o.y)) S.O.splice(k, 1); }
    for (const o of S.O) if (o.druh !== 'rad') o.miesta = o.miesta.filter(m => m.typ !== 'zem' || !v(m.x, m.y));
    S.volne = S.volne.filter(m => !v(m.x, m.y));
  }
  const dekor = S.O;
  for (const o of dekor) o.bb = hranice(o.kresli);
  const miesta = [];
  for (const o of dekor) for (const m of o.miesta) miesta.push(m);
  for (const m of S.volne) miesta.push(m);
  const pouzite = new Set();
  const ciele = [], vsetky = dekor.slice();
  const minRoz = MIN_ROZOSTUP / REF_MIERKA;
  const druhy = zamiesaj(r, S.druhy);
  const vKvadrante = [0, 0, 0, 0];
  const maxKv = U.n <= 5 ? 2 : 2;
  const stredCiela = new Map();
  const skus = (kluc, spot, jeNavnada) => {
    const o = novyCiel(kluc, spot, r, U);
    o.bb = hranice(o.kresli);
    if (!vnutri(o.bb)) return null;
    // a thing never stands inside a cottage or another thing's footprint
    for (const q of vsetky) if (q.fp && !o.nosic && o.pred?.[0] !== q && o.pi > q.fp[0] && o.pi < q.fp[2] && o.pj > q.fp[1] && o.pj < q.fp[3]) return null;
    if (!jeNavnada) {
      const v = zmeraj(o, vsetky.concat([o]));
      if (!vyhovuje(v, U)) return null;
      const kv = kvadrant(v.stred[0], v.stred[1]);
      if (vKvadrante[kv] >= maxKv) return null;
      for (const c of ciele) { const s2 = stredCiela.get(c); if (hypot(s2[0] - v.stred[0], s2[1] - v.stred[1]) < minRoz) return null; }
      o.v = v; o.kv = kv;
    }
    // it must not hide the things already found a place
    const spolu = vsetky.concat([o]);
    for (const c of ciele) if (prekryvaju(c, o) && poradie(c, o) < 0) { const v2 = zmeraj(c, spolu); if (!vyhovuje(v2, U)) return null; }
    return o;
  };
  /* on the easy level things sit in the open first; later they prefer to be tucked
     behind something or up on something, and the grass is the last resort */
  const vaha = m => (U.skryt ? (m.rel === 'za' ? 0 : m.rel === 'na' ? 0.5 : 1.4) : (m.rel === 'volne' ? 0 : m.rel === 'na' ? 0.4 : 0.8)) + r() * 1.1;
  for (const kluc of druhy) {
    if (ciele.length >= U.n) break;
    const kandidati = miesta.filter(m => !pouzite.has(m) && mozeTu(kluc, m)).map(m => [vaha(m), m]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    let tried = 0;
    for (const m of kandidati) {
      if (tried++ > 8) break;
      const o = skus(kluc, m, false);
      if (!o) continue;
      pouzite.add(m); ciele.push(o); vsetky.push(o); vKvadrante[o.kv]++; stredCiela.set(o, o.v.stred);
      break;
    }
  }
  if (ciele.length < U.n) return null;
  // decoys: animals that are not on the list
  const navnady = [];
  if (U.navnady) {
    const zvierata = zamiesaj(r, S.druhy.filter(k => !ciele.some(c => c.kluc === k) && !['wateringcan', 'kite'].includes(k)));
    for (const kluc of zvierata) {
      if (navnady.length >= U.navnady) break;
      const kand = zamiesaj(r, miesta.filter(m => !pouzite.has(m) && mozeTu(kluc, m)));
      for (const m of kand.slice(0, 5)) {
        const o = skus(kluc, m, true);
        if (!o) continue;
        let blizko = false;
        for (const c of ciele) if (hypot(c.v.stred[0] - o.x, c.v.stred[1] - o.y) < minRoz * 0.7) blizko = true;
        if (blizko) continue;
        o.druh = 'navnada';
        pouzite.add(m); navnady.push(o); vsetky.push(o);
        break;
      }
    }
  }
  const objekty = zorad(vsetky);
  // the final measure, in the final order, and what the hint may say
  let skrytych = 0;
  for (const c of ciele) {
    c.v = zmeraj(c, vsetky);
    if (!vyhovuje(c.v, U)) return null;
    c.kv = kvadrant(c.v.stred[0], c.v.stred[1]);
    if (c.v.podiel <= 0.9 || c.spot.rel === 'na') skrytych++;
  }
  if (skrytych < U.skryt) return null;
  return { S, objekty, ciele, navnady, pokus: cislo };
}

/* A scene from a seed. Tries the next stream of the same seed until one passes
   (the number of tries is kept: the M0 gate wants 90 % on the first). */
export function vytvor(sem, uroven) {
  const U = UROVNE[uroven];
  let res = null;
  for (let k = 0; k < 40 && !res; k++) res = pokus(sem >>> 0, U, k);
  if (!res) throw new Error('no scene for seed ' + sem);
  const { S, objekty, ciele, navnady } = res;
  const zoznam = ciele.map(c => {
    const v = c.v, q = vRef(v);
    let veta = '';
    if (v.kryt && v.hlavnyKrytPodiel >= 0.1 && v.kryt.druh !== 'ciel' && v.kryt.druh !== 'navnada') veta = `partly behind ${clen(v.kryt)}`;
    else if (c.spot.veta) veta = c.spot.veta;
    const tazkost = (1 - v.podiel) * 2 + 300 / max(40, q.plocha);
    return { kluc: c.kluc, meno: DRUHY[c.kluc].meno, obj: c, v, kvadrant: c.kv, veta, tazkost, farba: c.farba, poza: c.poza };
  });
  const odtlacok = S.id + '|' + objekty.map(o => (o.druh === 'ciel' || o.druh === 'navnada' ? o.kluc + '@' + round(o.x) + ',' + round(o.y) : o.druh + round(o.x))).join(',');
  return { semienko: sem, uroven, sablona: S.id, meno: S.meno, zem: S.zem, objekty, ciele: zoznam, navnady, pokusy: res.pokus + 1, odtlacok };
}
/* "a bush", "an apple tree", but "the reeds", "the washing" */
const S_URCITYM = new Set(['reeds', 'washing', 'tall grass', 'cabbages', 'fence', 'log pile', 'haystack', 'jetty', 'well']);
function clen(o) {
  const meno = o.meno;
  if (S_URCITYM.has(meno)) return 'the ' + meno;
  if (o.druh === 'ciel' || o.druh === 'navnada') return 'the ' + meno;
  return (/^[aeiou]/.test(meno) ? 'an ' : 'a ') + meno;
}

export function dennaScena(datum) { return vytvor(semienkoDna(datum), UROVEN_DNA); }
export function nekonecnaScena(n) { return vytvor(semienkoNekonecne(n), urovenNekonecna(n)); }

/* the thing a tap at world point (x, y) finds, or -1; tol in world units */
export function zasahni(sc, x, y, tol) { return zasah(sc.ciele.map(c => c.v), x, y, tol); }

/* ── Drawing ────────────────────────────────────────────────────────────── */
function kresliZem(p, sc, rr) {
  const c = p.c, z = sc.zem, R0 = RECT;
  const mimo = (x, y, d) => rr && (x < rr[0] - d || x > rr[2] + d || y < rr[1] - d || y > rr[3] + d);
  p.ink('paper', 1); c.fillRect(R0.x0 - 1, R0.y0 - 1, SW + 2, SH + 2);
  p.ink('green', 0.5); c.fillRect(R0.x0, R0.y0, SW, SH);
  p.ink('sun', 0.28); c.fillRect(R0.x0, R0.y0, SW, SH);
  const sem = sc.semienko % 1000;
  // meadow patches
  for (let k = 0; k < 14; k++) {
    const x = R0.x0 + hash(k, sem + 5) * SW, y = R0.y0 + hash(sem + 7, k) * SH;
    p.ellipse(k % 3 ? 'green' : 'sun', 0.18, x, y, 26 + hash(k, 3) * 30, 11 + hash(k, 4) * 10);
  }
  // the pond
  const J = z.jazierko;
  if (J) {
    const [x, y] = iso(J.ci, J.cj), rx = J.ri * 45.25, ry = J.rj * 22.63;
    p.ellipse('paper', 1, x, y, rx + 7, ry + 4);
    p.ellipse('sun', 0.5, x, y, rx + 7, ry + 4);
    p.ellipse('orange', 0.12, x, y, rx + 7, ry + 4);
    p.ellipse('paper', 1, x, y, rx, ry);
    p.ellipse('blue', 0.6, x, y, rx, ry);
    p.ellipse('teal', 0.14, x, y, rx, ry);
    p.ellipse('blue', 0.22, x + 4, y + 2, rx * 0.62, ry * 0.55);
    p.path('paper', 0.7, Rg(cc => cc.ellipse(x - rx * 0.3, y - ry * 0.3, rx * 0.26, ry * 0.12, 0, 0.3, 2.6)), 1);
    p.path('paper', 0.5, Rg(cc => cc.ellipse(x + rx * 0.2, y + ry * 0.35, rx * 0.2, ry * 0.1, 0, 0.3, 2.6)), 1);
    for (let k = 0; k < 5; k++) {
      const a = hash(k, sem) * TAU, rr = 0.35 + hash(sem, k) * 0.45, lx = x + cos(a) * rx * rr, ly = y + sin(a) * ry * rr;
      p.path('green', 0.8, Rg(cc => { cc.moveTo(lx, ly); cc.ellipse(lx, ly, 4.2, 2, 0, 0.5, TAU - 0.2); cc.closePath(); }));
      if (k % 2) p.circle('pink', 0.9, lx + 1, ly - 1, 1.3);
    }
  }
  // paths: packed earth with a lighter middle, one shape each so nothing prints twice
  for (const [w, ink, a] of [[17, 'paper', 1], [17, 'sun', 0.5], [17, 'orange', 0.16], [6, 'paper', 0.45]]) {
    p.path(ink, a, Rg(cc => { for (const P of z.cesty) kriva(cc, P); }), w);
  }
  // vegetable beds: turned soil, a furrow along every row
  for (const Z of z.zahony || []) {
    p.poly('paper', 1, Z.poly); p.poly('orange', 0.5, Z.poly); p.poly('pink', 0.14, Z.poly);
    for (let k = 0; k < Z.rady; k++) {
      const a = K.naZemi(Z.x0, Z.y0, -0.24, k * 0.42 + 0.06), b = K.naZemi(Z.x0, Z.y0, (Z.n - 1) * 0.36 + 0.24, k * 0.42 + 0.06);
      p.line('night', 0.22, 2.4, [a, b]);
      const c2 = K.naZemi(Z.x0, Z.y0, -0.24, k * 0.42 + 0.22), d2 = K.naZemi(Z.x0, Z.y0, (Z.n - 1) * 0.36 + 0.24, k * 0.42 + 0.22);
      p.line('sun', 0.35, 1.6, [c2, d2]);
    }
  }
  const vZahone = (x, y) => (z.zahony || []).some(Z => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const q of Z.poly) { x0 = min(x0, q[0]); x1 = max(x1, q[0]); y0 = min(y0, q[1]); y1 = max(y1, q[1]); } return x > x0 && x < x1 && y > y0 && y < y1; });
  // tufts and flowers in the grass
  for (let k = 0; k < 150; k++) {
    const x = R0.x0 + hash(k, sem + 21) * SW, y = R0.y0 + hash(k, sem + 22) * SH;
    if (mimo(x, y, 12) || vzdialenostOdCiest(x, y, z.cesty) < 12 || vZahone(x, y)) continue;
    if (J) { const [px, py] = iso(J.ci, J.cj); if (((x - px) / (J.ri * 45.25 + 8)) ** 2 + ((y - py) / (J.rj * 22.63 + 5)) ** 2 < 1) continue; }
    if (k % 9 === 0) flowers(p, x, y, k + sem, 3);
    else p.line('green', 0.7, 0.9, [[x - 2.5, y - 2.5], [x - 1, y + 0.5], [x, y - 3.2], [x + 1, y + 0.5], [x + 2.5, y - 2.5]]);
  }
}

/* The print. opt.rect: only this world rectangle (clipped); opt.g: Map(object ->
   gesture 0..1) for things that move now; opt.bez: a Set of objects left out;
   opt.az: stop before this object (what lies under it). */
export function kresliScenu(p, sc, opt = {}) {
  const c = p.c, rr = opt.rect;
  c.save();
  c.beginPath();
  if (rr) c.rect(max(rr[0], RECT.x0), max(rr[1], RECT.y0), min(rr[2], RECT.x1) - max(rr[0], RECT.x0), min(rr[3], RECT.y1) - max(rr[1], RECT.y0));
  else c.rect(RECT.x0, RECT.y0, SW, SH);
  c.clip();
  kresliZem(p, sc, rr);
  for (const o of sc.objekty) {
    if (opt.az === o) break;
    if (opt.bez && opt.bez.has(o)) continue;
    if (rr && o.bb && (o.bb[2] < rr[0] - 4 || o.bb[0] > rr[2] + 4 || o.bb[3] < rr[1] - 4 || o.bb[1] > rr[3] + 4)) continue;
    const g = opt.g ? (opt.g.get(o) || 0) : 0;
    o.kresli(p, g);
  }
  c.restore();
  p.reset();
}
/* the thin frame round the print, drawn after it */
export function kresliRam(p) {
  p.line('night', 0.55, 1.2, [[RECT.x0, RECT.y0], [RECT.x1, RECT.y0], [RECT.x1, RECT.y1], [RECT.x0, RECT.y1], [RECT.x0, RECT.y0]], 'square');
  p.reset();
}
/* the chimneys that smoke: world points */
export function kominy(sc) {
  const out = [];
  for (const o of sc.objekty) if (o.druh === 'chalupa') for (const m of o.miesta) if (m.veta === 'on the chimney') out.push([m.x, m.y + 1.5]);
  return out;
}
