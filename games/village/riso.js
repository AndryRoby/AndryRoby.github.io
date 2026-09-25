/* Puzzle Village: risograph inks.
   Every colour on the plate is one "drum" of ink printed over the others with
   multiply, so where two inks cross they mix like on a real riso print. Each ink
   has a grainy texture (starved ink, paper tooth) and sits a hair off register,
   the way a second pass never lands exactly on the first. All made in code. */

export const INK = {
  paper: [244, 236, 217],
  blue: [52, 96, 178],
  pink: [255, 104, 150],
  orange: [242, 100, 60],   // the hub accent, printed as an ink
  sun: [255, 184, 38],
  green: [44, 158, 96],
  teal: [0, 131, 138],
  plum: [118, 84, 160],
  night: [40, 48, 70]
};

/* Where each drum lands, in world units. Small, but always there. */
const REG = {
  paper: [0, 0], blue: [0.55, -0.35], pink: [-0.5, 0.3], orange: [0.25, 0.45],
  sun: [-0.3, -0.45], green: [0.35, 0.3], teal: [-0.4, -0.2], plum: [0.3, -0.4], night: [0, 0]
};

/* Tiny deterministic noise, so every visit prints the same village. */
export function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function smooth(x, y, cell, seed) {
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
  const fx = x / cell - gx, fy = y / cell - gy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const S = 128 / cell;
  const n = (a, b) => hash(((a % S) + S) % S + seed, ((b % S) + S) % S - seed);
  const a = n(gx, gy), b = n(gx + 1, gy), c = n(gx, gy + 1), d = n(gx + 1, gy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/* One 128 px tile of grainy ink. Tiles because the pattern repeats seamlessly. */
function inkTile(rgb, seed, halftone) {
  const N = 128, cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const img = g.createImageData(N, N), d = img.data;
  const r = rng(seed * 7919 + 17);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = (y * N + x) * 4;
    let a;
    if (halftone) {
      // A 45 degree dot screen, the dots a little ragged.
      const u = (x + y) / 5.656854, v = (x - y) / 5.656854;
      const du = u - Math.round(u), dv = v - Math.round(v);
      const dist = Math.sqrt(du * du + dv * dv);
      a = dist < 0.34 + (r() - 0.5) * 0.08 ? 0.95 : 0;
    } else {
      const blot = smooth(x, y, 32, seed) * 0.55 + smooth(x, y, 8, seed + 3) * 0.45;
      a = 0.84 + blot * 0.16;
      const s = r();
      if (s < 0.05) a *= 0.45;            // starved ink specks
      else if (s < 0.09) a *= 0.72;
      else if (s > 0.992) a = 1;
    }
    d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2]; d[k + 3] = Math.round(a * 255);
  }
  g.putImageData(img, 0, 0);
  return cv;
}

function paperTile() {
  const N = 128, cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const img = g.createImageData(N, N), d = img.data;
  const r = rng(4242);
  const P = INK.paper;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = (y * N + x) * 4;
    let m = 1 - smooth(x, y, 16, 91) * 0.035 - smooth(x, y, 4, 17) * 0.02;
    const s = r();
    if (s < 0.012) m -= 0.1;               // paper tooth
    d[k] = P[0] * m; d[k + 1] = P[1] * m; d[k + 2] = P[2] * m; d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // a few fibres
  g.globalAlpha = 0.12; g.strokeStyle = '#8a7a5c'; g.lineWidth = 0.6;
  for (let i = 0; i < 9; i++) {
    const x = r() * N, y = r() * N, a = r() * 6.28, l = 3 + r() * 7;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.6 + 1, y + Math.sin(a) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  return cv;
}

/* Early evening is two extra drums over the whole print (see svet.js). Things
   printed later on top of it, the animals, need paper that already carries them. */
export const DUSK = [['plum', 0.3], ['blue', 0.3]];

let TILES = null;
/* When the GPU loses its context (its process restarts: a phone folding or unfolding,
   coming back from the background, memory pressure, a driver fault) the browser gives
   every 2D canvas back empty, the 128 px ink tiles too, and a pattern made from an
   emptied tile prints black or garbage. inksLost() forgets them, so the next Pen prints
   them again; OPT.lost is the engine's call when a canvas of this module lost its pixels. */
export function inksLost() { TILES = null; SCR = null; }
function watch(cv) {
  const f = () => { if (OPT.lost) OPT.lost(); };
  cv.addEventListener('contextlost', f); cv.addEventListener('contextrestored', f);
  return cv;
}
function tiles() {
  if (TILES) return TILES;
  TILES = {};
  let seed = 1;
  for (const k of Object.keys(INK)) {
    TILES[k] = k === 'paper' ? paperTile() : inkTile(INK[k], seed++, false);
  }
  const eve = document.createElement('canvas');
  eve.width = eve.height = 128;
  const g = eve.getContext('2d');
  g.drawImage(TILES.paper, 0, 0);
  g.globalCompositeOperation = 'multiply';
  for (const [k, a] of DUSK) { g.globalAlpha = a; g.drawImage(TILES[k], 0, 0); }
  TILES.paperEve = eve;
  TILES.dots = inkTile(INK.blue, 99, true);
  TILES.nightdots = inkTile(INK.night, 98, true);
  TILES.pinkdots = inkTile(INK.pink, 97, true);
  for (const k in TILES) watch(TILES[k]);
  return TILES;
}

export function rgbStr(rgb, a = 1) { return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`; }

/* Strokes as fills. 25 Sep 2026: Firefox inks a stroke with a pattern about a hundred
   times slower than a fill (60 µs a line), and one such stroke moves the whole plate off
   the GPU for good (see village.js). There (OPT.fillStrokes) every line is printed as the
   very shape the stroke would cover: its outline, both edges with round (or mitred)
   corners and caps, curves flattened to 0.08 device px, dashes cut as the canvas cuts
   them, all in one nonzero fill. The same area, the same grain, one fast fill.
   Checked against the distance-to-line definition on 449 000 random points: no miss. */
export const OPT = { fillStrokes: false };
let SCR = null;                            // the scratch plate for letters (Pen.textAside)
const TAU_ = 6.283185307179586;
const TOL = 0.08;                          // how far a flattened curve may stray, in device px

/* A piece is one closed contour as a flat list of ops: 0 x y = move, 1 x y = line,
   2 cx cy r a0 a1 ccw = arc, 3 = close. Every piece winds the positive way (the way
   arc(0, 2π) runs), so a nonzero fill of all of them is exactly their union. */
function polyPiece(out, q) {
  let a = 0; const n = q.length;
  for (let i = 0; i < n; i += 2) { const j = (i + 2) % n; a += q[i] * q[j + 1] - q[j] * q[i + 1]; }
  const r = [];
  if (a >= 0) for (let i = 0; i < n; i += 2) r.push(i ? 1 : 0, q[i], q[i + 1]);
  else for (let i = n - 2, f = 1; i >= 0; i -= 2, f = 0) r.push(f ? 0 : 1, q[i], q[i + 1]);
  r.push(3); out.push(r);
}
function diskPiece(out, x, y, h) { out.push([0, x + h, y, 2, x, y, h, 0, TAU_, 0, 3]); }

/* One side of a stroked polyline, walked forward: the edge at the right-hand normal
   (dy, -dx) of every segment, joined at every corner. On the outer side of a turn the
   join is the round (or mitred, or bevelled) corner; on the inner side the edge goes
   through the corner point itself, the way Skia's own stroker does it, so the overlap
   there keeps the same winding. Emits from the first segment's start to the last one's end. */
function side(ops, P, closed, h, join, miter, start) {
  const n = P.length, segs = closed ? n : n - 1;
  const d = [];
  for (let i = 0; i < segs; i++) { const a = P[i], b = P[(i + 1) % n]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); d.push([(b[0] - a[0]) / L, (b[1] - a[1]) / L]); }
  const nx = i => d[i][1] * h, ny = i => -d[i][0] * h;
  const pt = (op, x, y) => ops.push(op, x, y);
  if (!closed) pt(start ? 0 : 1, P[0][0] + nx(0), P[0][1] + ny(0));
  let first = closed;
  for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) {
    const v = P[i], i1 = (i - 1 + segs) % segs, i2 = i % segs;
    const cr = d[i1][0] * d[i2][1] - d[i1][1] * d[i2][0], dt = d[i1][0] * d[i2][0] + d[i1][1] * d[i2][1];
    const ax = v[0] + nx(i1), ay = v[1] + ny(i1), bx = v[0] + nx(i2), by = v[1] + ny(i2);
    pt(first ? 0 : 1, ax, ay); first = false;
    if (Math.abs(cr) < 1e-12 && dt > 0) continue;        // straight on
    if (cr < 0 || (Math.abs(cr) < 1e-12 && dt < 0 && join !== 'round')) {
      // inner side of the turn (or a full reversal with a flat join): through the corner
      pt(1, v[0], v[1]); pt(1, bx, by); continue;
    }
    if (join === 'round') {
      const a0 = Math.atan2(ny(i1), nx(i1));
      // the outer arc spans the turn; a full reversal goes round the front of the line
      const sw = Math.abs(cr) < 1e-12 ? Math.PI : Math.atan2(cr, dt);
      ops.push(2, v[0], v[1], h, a0, a0 + sw, 0);
    } else if (join === 'miter') {
      const c = Math.cos(Math.atan2(Math.abs(cr), dt) / 2);
      if (c > 1e-9 && 1 / c <= miter) { const mx = nx(i1) + nx(i2), my = ny(i1) + ny(i2), ml = Math.hypot(mx, my); pt(1, v[0] + mx / ml * h / c, v[1] + my / ml * h / c); }
    }
    pt(1, bx, by);
  }
  if (!closed) { const e = P[n - 1], k = segs - 1; pt(1, e[0] + nx(k), e[1] + ny(k)); }
  return d;
}
function capAt(ops, e, dx, dy, h, cap) {
  // from the right-hand edge of a line ending at e (heading dx, dy) round its end to the other edge
  if (cap === 'round') { const a0 = Math.atan2(-dx * h, dy * h); ops.push(2, e[0], e[1], h, a0, a0 + Math.PI, 0); }
  else if (cap === 'square') { ops.push(1, e[0] + dy * h + dx * h, e[1] - dx * h + dy * h, 1, e[0] - dy * h + dx * h, e[1] + dx * h + dy * h); }
}
function outlineLine(out, P, closed, h, cap, join, miter) {
  if (closed) {
    // a ring: the outer edge one way round, the inner edge the other way, so the hole
    // stays empty; the line is first turned so its outer edge winds the positive way
    let a = 0; const n = P.length;
    for (let i = 0; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; }
    const F = a >= 0 ? P : P.slice().reverse();
    const o1 = []; side(o1, F, true, h, join, miter, true); o1.push(3); out.push(o1);
    const o2 = []; side(o2, F.slice().reverse(), true, h, join, miter, true); o2.push(3); out.push(o2);
    return;
  }
  const ops = [];
  const d = side(ops, P, false, h, join, miter, true);
  const n = P.length, dl = d[d.length - 1];
  capAt(ops, P[n - 1], dl[0], dl[1], h, cap);
  const R = P.slice().reverse();
  side(ops, R, false, h, join, miter, false);
  capAt(ops, P[0], -d[0][0], -d[0][1], h, cap);
  ops.push(3);
  out.push(ops);
}
/* split a polyline into its dashes, the pattern starting again on every subpath */
function dashes(P, closed, D, off) {
  const tot = D.reduce((s, x) => s + x, 0), res = [];
  if (!(tot > 0)) return [{ pts: P, closed }];
  let k = 0, rem = D[0], pos = ((off % tot) + tot) % tot;
  while (pos > 0) { if (pos >= rem) { pos -= rem; k = (k + 1) % D.length; rem = D[k]; } else { rem -= pos; pos = 0; } }
  let cur = k % 2 === 0 ? [P[0]] : null;
  const n = P.length, segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = P[i], b = P[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let at = 0;
    while (L - at > rem) {
      at += rem;
      const q = [a[0] + (b[0] - a[0]) * at / L, a[1] + (b[1] - a[1]) * at / L];
      if (cur) { cur.push(q); res.push({ pts: cur, closed: false }); cur = null; } else cur = [q];
      k = (k + 1) % D.length; rem = D[k];
    }
    rem -= L - at;
    if (cur) cur.push(b);
  }
  if (cur && cur.length > 1) res.push({ pts: cur, closed: false });
  return res;
}
/* the outline of a stroke over subpaths [{pts, closed}], as pieces for emitPieces */
function outlineStroke(out, subs, w, cap, join, miter, dash, dashOff, tol) {
  const h = w / 2;
  if (!(h > 0)) return out;
  const D = dash && dash.length ? (dash.length % 2 ? dash.concat(dash) : dash) : null;
  for (const sp of subs) {
    const P = [];
    for (const q of sp.pts) { const l = P[P.length - 1]; if (!l || Math.abs(q[0] - l[0]) > 1e-9 || Math.abs(q[1] - l[1]) > 1e-9) P.push(q); }
    if (sp.closed && P.length > 1) { const f = P[0], l = P[P.length - 1]; if (Math.abs(f[0] - l[0]) <= 1e-9 && Math.abs(f[1] - l[1]) <= 1e-9) P.pop(); }
    if (P.length < 2) {
      // a line of no length still shows its round caps, as a dot
      if (P.length === 1 && sp.pts.length > 1 && !sp.closed && cap === 'round' && !D) diskPiece(out, P[0][0], P[0][1], h);
      continue;
    }
    const closed = sp.closed && P.length > 2;
    if (D) {
      for (const d of dashes(P, closed, D, dashOff)) {
        const Q = [];
        for (const q of d.pts) { const l = Q[Q.length - 1]; if (!l || Math.abs(q[0] - l[0]) > 1e-9 || Math.abs(q[1] - l[1]) > 1e-9) Q.push(q); }
        if (Q.length > 1) outlineLine(out, Q, false, h, cap, join, miter, tol);
      }
    } else outlineLine(out, P, closed, h, cap, join, miter, tol);
  }
  return out;
}
function emitPieces(d, pieces, ox = 0, oy = 0) {
  for (const q of pieces) {
    for (let i = 0; i < q.length;) {
      const op = q[i];
      if (op === 0) { d.moveTo(q[i + 1] + ox, q[i + 2] + oy); i += 3; }
      else if (op === 1) { d.lineTo(q[i + 1] + ox, q[i + 2] + oy); i += 3; }
      else if (op === 2) { d.arc(q[i + 1] + ox, q[i + 2] + oy, q[i + 3], q[i + 4], q[i + 5], !!q[i + 6]); i += 7; }
      else { d.closePath(); i += 1; }
    }
  }
}
/* A stand-in for the canvas while a path is built: it keeps the path as flattened
   subpaths in the caller's space, so the path can be stroked as a fill. */
class Rec {
  constructor(c, s) {
    this.c = c; this.tol = TOL / (s || 1);
    this.m = [1, 0, 0, 1, 0, 0]; this.st = [];
    this.subs = []; this.cur = null; this.pieces = [];
    this.lineWidth = 1; this.lineCap = 'butt'; this.lineJoin = 'miter'; this.miterLimit = 10;
  }
  _p(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  _k() { const m = this.m; return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1; }
  save() { this.st.push(this.m.slice()); }
  restore() { if (this.st.length) this.m = this.st.pop(); }
  transform(a, b, c, d, e, f) { const m = this.m; this.m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]]; }
  translate(x, y) { this.transform(1, 0, 0, 1, x, y); }
  scale(x, y) { this.transform(x, 0, 0, y, 0, 0); }
  rotate(r) { const c = Math.cos(r), s = Math.sin(r); this.transform(c, s, -s, c, 0, 0); }
  setLineDash(d) { this.c.setLineDash(d); }
  getLineDash() { return this.c.getLineDash(); }
  beginPath() { this.subs = []; this.cur = null; }
  moveTo(x, y) { this.cur = { pts: [this._p(x, y)], closed: false }; this.subs.push(this.cur); }
  lineTo(x, y) { if (!this.cur) this.moveTo(x, y); else this.cur.pts.push(this._p(x, y)); }
  closePath() {
    if (!this.cur) return;
    this.cur.closed = true;
    this.cur = { pts: [this.cur.pts[0].slice()], closed: false }; this.subs.push(this.cur);
  }
  rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
  quadraticCurveTo(cx, cy, x, y) {
    if (!this.cur) this.moveTo(cx, cy);
    const P = this.cur.pts, a = P[P.length - 1], b = this._p(cx, cy), e = this._p(x, y);
    const dd = Math.hypot(a[0] - 2 * b[0] + e[0], a[1] - 2 * b[1] + e[1]);
    const n = Math.max(1, Math.ceil(Math.sqrt(dd / (4 * this.tol))));
    for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; P.push([u * u * a[0] + 2 * u * t * b[0] + t * t * e[0], u * u * a[1] + 2 * u * t * b[1] + t * t * e[1]]); }
  }
  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
    if (!this.cur) this.moveTo(c1x, c1y);
    const P = this.cur.pts, a = P[P.length - 1], b = this._p(c1x, c1y), c = this._p(c2x, c2y), e = this._p(x, y);
    const dd = Math.max(Math.hypot(a[0] - 2 * b[0] + c[0], a[1] - 2 * b[1] + c[1]), Math.hypot(b[0] - 2 * c[0] + e[0], b[1] - 2 * c[1] + e[1]));
    const n = Math.max(1, Math.ceil(Math.sqrt(0.75 * dd / this.tol)));
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t, A = u * u * u, B = 3 * u * u * t, C = 3 * u * t * t, E = t * t * t;
      P.push([A * a[0] + B * b[0] + C * c[0] + E * e[0], A * a[1] + B * b[1] + C * c[1] + E * e[1]]);
    }
  }
  ellipse(x, y, rx, ry, rot, a0, a1, ccw = false) {
    let sw;
    if (!ccw && a1 - a0 >= TAU_) sw = TAU_;
    else if (ccw && a0 - a1 >= TAU_) sw = -TAU_;
    else if (!ccw) sw = (((a1 - a0) % TAU_) + TAU_) % TAU_;
    else sw = -((((a0 - a1) % TAU_) + TAU_) % TAU_);
    const r = Math.max(rx, ry) * this._k();
    const step = r > this.tol ? 2 * Math.acos(Math.max(-1, 1 - this.tol / r)) : Math.PI / 2;
    const n = Math.max(1, Math.ceil(Math.abs(sw) / step));
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const pt = th => { const ex = rx * Math.cos(th), ey = ry * Math.sin(th); return [x + ex * cr - ey * sr, y + ex * sr + ey * cr]; };
    const s0 = pt(a0);
    if (this.cur) this.lineTo(s0[0], s0[1]); else this.moveTo(s0[0], s0[1]);
    for (let k = 1; k <= n; k++) { const q = pt(a0 + sw * k / n); this.cur.pts.push(this._p(q[0], q[1])); }
  }
  arc(x, y, r, a0, a1, ccw = false) { this.ellipse(x, y, r, r, 0, a0, a1, ccw); }
  // what the stand-in was asked to paint is kept as pieces of one union
  stroke() { outlineStroke(this.pieces, this.subs, this.lineWidth, this.lineCap, this.lineJoin, this.miterLimit, this.c.getLineDash(), this.c.lineDashOffset, this.tol); }
  fill() {
    for (const sp of this.subs) {
      if (sp.pts.length < 3) continue;
      const q = []; for (const p of sp.pts) q.push(p[0], p[1]);
      polyPiece(this.pieces, q);
    }
  }
}

/* The pen: every drawing call in the village goes through it. It keeps a
   pattern per ink for one canvas context and knows the current print scale,
   so the grain stays the size of paper tooth at any zoom. */
export class Pen {
  constructor(ctx) {
    this.c = ctx;
    this.pat = {};
    const t = tiles();
    for (const k of Object.keys(t)) this.pat[k] = ctx.createPattern(t[k], 'repeat');
    this.s = 0;
    this.ox = 0; this.oy = 0;
    this.reg = 1;
  }
  scale(s) {
    if (Math.abs(s - this.s) < 1e-6) return;
    this.s = s;
    const m = new DOMMatrix([1 / s, 0, 0, 1 / s, 0, 0]);
    for (const k in this.pat) { try { this.pat[k].setTransform(m); } catch (e) {} }
  }
  ink(name, a = 1) {
    const c = this.c;
    c.globalCompositeOperation = name === 'paper' ? 'source-over' : 'multiply';
    c.globalAlpha = a;
    c.fillStyle = c.strokeStyle = (this.eve && name === 'paper') ? this.pat.paperEve : (this.pat[name] || this.pat.night);
    const o = REG[name] || REG.night;
    this.ox = o[0] * this.reg; this.oy = o[1] * this.reg;
    return c;
  }
  poly(name, a, pts) {
    const c = this.ink(name, a), ox = this.ox, oy = this.oy;
    c.beginPath();
    c.moveTo(pts[0][0] + ox, pts[0][1] + oy);
    for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0] + ox, pts[k][1] + oy);
    c.closePath(); c.fill();
  }
  circle(name, a, x, y, r) {
    const c = this.ink(name, a);
    c.beginPath(); c.arc(x + this.ox, y + this.oy, Math.max(r, 0.01), 0, 6.2832); c.fill();
  }
  ellipse(name, a, x, y, rx, ry, rot = 0, a0 = 0, a1 = 6.2832) {
    const c = this.ink(name, a);
    c.beginPath(); c.ellipse(x + this.ox, y + this.oy, Math.max(rx, 0.01), Math.max(ry, 0.01), rot, a0, a1); c.fill();
  }
  line(name, a, w, pts, cap = 'round') {
    const c = this.ink(name, a), ox = this.ox, oy = this.oy;
    c.lineWidth = w; c.lineCap = cap; c.lineJoin = 'round';
    if (OPT.fillStrokes) {
      const P = []; for (const q of pts) P.push([q[0] + ox, q[1] + oy]);
      this.fillOutline([{ pts: P, closed: false }], w, cap, 'round');
      return;
    }
    c.beginPath();
    c.moveTo(pts[0][0] + ox, pts[0][1] + oy);
    for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0] + ox, pts[k][1] + oy);
    c.stroke();
  }
  /* free path: fn gets the context and the register offset */
  path(name, a, fn, stroke = 0) {
    const c = this.ink(name, a);
    if (stroke && OPT.fillStrokes) {
      const r = new Rec(c, this.s); fn(r, this.ox, this.oy);
      c.lineWidth = stroke; c.lineCap = 'round'; c.lineJoin = 'round';
      this.fillOutline(r.subs, stroke, 'round', 'round', r.tol);
      return;
    }
    c.beginPath(); fn(c, this.ox, this.oy);
    if (stroke) { c.lineWidth = stroke; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); } else c.fill();
  }
  text(name, a, str, x, y, size, weight = 700) {
    const c = this.ink(name, a);
    c.font = `${weight} ${size}px "ARLing Sans", system-ui, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (OPT.fillStrokes) { this.textAside(str, x + this.ox, y + this.oy); return; }
    c.fillText(str, x + this.ox, y + this.oy);
  }
  /* Firefox (25 Sep 2026): a single text filled with a pattern moves the whole plate off
     the GPU for good (every later copy of a tile then costs 7 ms instead of 0.1). So the
     letters are inked on a small opaque scratch plate, in the same place to the device
     pixel (opaque like the real plate, so they keep the same antialiasing), and laid on:
     an ink printed with multiply over white is exactly the factor it multiplies the plate
     by; paper (printed over) is a factor, 1 - alpha, and an added part, alpha x paper. */
  textAside(str, x, y) {
    const c = this.c, m = c.measureText(str), T = c.getTransform();
    const xs = [x - m.actualBoundingBoxLeft, x + m.actualBoundingBoxRight], ys = [y - m.actualBoundingBoxAscent, y + m.actualBoundingBoxDescent];
    let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity;
    for (const u of xs) for (const v of ys) {
      const px = T.a * u + T.c * v + T.e, py = T.b * u + T.d * v + T.f;
      X0 = Math.min(X0, px); X1 = Math.max(X1, px); Y0 = Math.min(Y0, py); Y1 = Math.max(Y1, py);
    }
    X0 = Math.floor(X0) - 3; Y0 = Math.floor(Y0) - 3; X1 = Math.ceil(X1) + 3; Y1 = Math.ceil(Y1) + 3;
    const w = X1 - X0, h = Y1 - Y0;
    if (!(w > 0 && h > 0) || w > 4096 || h > 4096) return;
    if (!SCR) SCR = watch(document.createElement('canvas'));
    if (SCR.width < w || SCR.height < h) { SCR.width = Math.max(SCR.width, w); SCR.height = Math.max(SCR.height, h); }
    const g = SCR.getContext('2d', { alpha: false });
    const a = c.globalAlpha, mult = c.globalCompositeOperation === 'multiply', ink = c.fillStyle;
    const pass = (ground, style, op, onto) => {
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = ground; g.fillRect(0, 0, w, h);
      g.setTransform(T.a, T.b, T.c, T.d, T.e - X0, T.f - Y0);
      g.font = c.font; g.textAlign = c.textAlign; g.textBaseline = c.textBaseline;
      g.globalAlpha = a; g.globalCompositeOperation = op; g.fillStyle = style;
      g.fillText(str, x, y);
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = onto;
      c.drawImage(SCR, 0, 0, w, h, X0, Y0, w, h);
      c.restore();
    };
    if (mult) pass('#fff', ink, 'multiply', 'multiply');
    else { pass('#fff', '#000', 'source-over', 'multiply'); pass('#000', ink, 'source-over', 'lighter'); }
  }
  reset() { const c = this.c; c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
  get fs() { return OPT.fillStrokes; }
  /* the area a stroke over these subpaths covers, filled with the current ink */
  fillOutline(subs, w, cap, join, tol) {
    const c = this.c;
    const out = outlineStroke([], subs, w, cap, join, c.miterLimit, c.getLineDash(), c.lineDashOffset, tol || TOL / (this.s || 1));
    c.beginPath(); emitPieces(c, out); c.fill();
  }
  /* a stroke of these points with the context's own line settings (fast either way) */
  strokePts(pts, w) {
    const c = this.c;
    c.lineWidth = w;
    if (OPT.fillStrokes) { this.fillOutline([{ pts, closed: false }], w, c.lineCap, c.lineJoin); return; }
    c.beginPath();
    pts.forEach((q, k) => k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]));
    c.stroke();
  }
  /* shape(cc) drawn on a stand-in: the union of what it stroked and filled, as a Path2D
     maker that places the union at a register offset */
  union(shape) {
    const r = new Rec(this.c, this.s); shape(r);
    const pieces = r.pieces, made = new Map();
    return (ox, oy) => {
      const k = ox + ',' + oy;
      let d = made.get(k);
      if (!d) { d = new Path2D(); emitPieces(d, pieces, ox, oy); made.set(k, d); }
      return d;
    };
  }
}
