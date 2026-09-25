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
  return TILES;
}

export function rgbStr(rgb, a = 1) { return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`; }

/* Strokes as fills. 25 Sep 2026: Firefox inks a stroke with a pattern about a hundred
   times slower than a fill (60 µs a line; a fill, or a line in a plain colour, well under
   one), because such a stroke leaves its fast GPU path. Where the village's start-up probe
   finds that, every line is printed as the very shape the stroke would cover: a band
   along each segment, a disc at each round join and cap, and the union goes to the
   plate in one nonzero fill. The same area, the same grain, one fast fill. */
export const OPT = { fillStrokes: false };
const TAU_ = 6.283185307179586;
const TOL = 0.08;                          // how far a flattened curve may stray, in device px

function polyPiece(out, q) {
  // every piece winds the same way, so a nonzero fill is their union
  let a = 0; const n = q.length;
  for (let i = 0; i < n; i += 2) { const j = (i + 2) % n; a += q[i] * q[j + 1] - q[j] * q[i + 1]; }
  if (a < 0) { const r = []; for (let i = n - 2; i >= 0; i -= 2) r.push(q[i], q[i + 1]); q = r; }
  out.push(q);
}
function outlineLine(out, P, closed, h, cap, join, miter, tol) {
  const n = P.length;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = P[i], b = P[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    const nx = -dy / L * h, ny = dx / L * h;
    let ax = a[0], ay = a[1], bx = b[0], by = b[1];
    if (!closed && cap === 'square') {
      if (i === 0) { ax -= dx / L * h; ay -= dy / L * h; }
      if (i === segs - 1) { bx += dx / L * h; by += dy / L * h; }
    }
    polyPiece(out, [ax + nx, ay + ny, bx + nx, by + ny, bx - nx, by - ny, ax - nx, ay - ny]);
  }
  for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) {
    const v = P[i], a = P[(i - 1 + n) % n], b = P[(i + 1) % n];
    let d1x = v[0] - a[0], d1y = v[1] - a[1], d2x = b[0] - v[0], d2y = b[1] - v[1];
    const l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
    d1x /= l1; d1y /= l1; d2x /= l2; d2y /= l2;
    const cr = d1x * d2y - d1y * d2x, dt = d1x * d2x + d1y * d2y;
    if (Math.abs(cr) < 1e-12 && dt > 0) continue;
    const s = cr > 0 ? -h : h;             // towards the outer side of the turn
    const n1x = -d1y * s, n1y = d1x * s, n2x = -d2y * s, n2y = d2x * s;
    const half = Math.atan2(Math.abs(cr), dt) / 2;
    if (join === 'round') {
      // a wedge where the arc it stands for is within the tolerance, else the disc
      if (h * (1 - Math.cos(half)) < tol) polyPiece(out, [v[0], v[1], v[0] + n1x, v[1] + n1y, v[0] + n2x, v[1] + n2y]);
      else out.push([v[0], v[1], h]);
    } else {
      polyPiece(out, [v[0], v[1], v[0] + n1x, v[1] + n1y, v[0] + n2x, v[1] + n2y]);
      const c = Math.cos(half);
      if (join === 'miter' && c > 1e-9 && 1 / c <= miter) {
        const mx = n1x + n2x, my = n1y + n2y, ml = Math.hypot(mx, my);
        if (ml > 1e-12) polyPiece(out, [v[0] + n1x, v[1] + n1y, v[0] + mx / ml * h / c, v[1] + my / ml * h / c, v[0] + n2x, v[1] + n2y, v[0], v[1]]);
      }
    }
  }
  if (!closed && cap === 'round') { out.push([P[0][0], P[0][1], h]); out.push([P[n - 1][0], P[n - 1][1], h]); }
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
      if (P.length === 1 && sp.pts.length > 1 && !sp.closed && cap === 'round' && !D) out.push([P[0][0], P[0][1], h]);
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
    if (q.length === 3) { d.moveTo(q[0] + ox + q[2], q[1] + oy); d.arc(q[0] + ox, q[1] + oy, q[2], 0, TAU_); d.closePath(); continue; }
    d.moveTo(q[0] + ox, q[1] + oy);
    for (let i = 2; i < q.length; i += 2) d.lineTo(q[i] + ox, q[i + 1] + oy);
    d.closePath();
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
    c.fillText(str, x + this.ox, y + this.oy);
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
    const pieces = r.pieces;
    return (ox, oy) => { const d = new Path2D(); emitPieces(d, pieces, ox, oy); return d; };
  }
}
