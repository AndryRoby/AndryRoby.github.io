/* Look Closer: the drawing, measured without a browser.
   The scene is drawn through a pen (riso.js in the browser). Here the same drawing
   calls go to a stand-in canvas that keeps every shape as flat polygons in world
   units and hands them to a sink: one sink only grows a bounding box, another
   paints the cells of a small grid. That is how a hidden thing is measured: its
   silhouette, minus every shape printed after it on top, is what a player can see.
   Shadows (the halftone inks) never hide anything. No DOM, no randomness: the
   browser and node read the same file. */

const TAU = Math.PI * 2;
/* the halftone inks are shadows on the ground: they neither make a shape nor hide one */
export const TIENE = new Set(['dots', 'nightdots', 'pinkdots']);

/* ── A stand-in 2D context: transform, paths, clip, as polygons ─────────── */
export class Kontext {
  constructor(sink, tol = 0.12) {
    this.sink = sink; this.tol = tol;
    this.m = [1, 0, 0, 1, 0, 0]; this.st = [];
    this.clipR = null; this.subs = []; this.cur = null;
    this.lineWidth = 1; this.lineCap = 'butt'; this.lineJoin = 'miter'; this.miterLimit = 10;
    this.globalAlpha = 1; this.globalCompositeOperation = 'source-over';
    this.fillStyle = null; this.strokeStyle = null; this._dash = []; this.lineDashOffset = 0;
    this.font = ''; this.textAlign = 'center'; this.textBaseline = 'middle'; this.imageSmoothingEnabled = true;
    this.canvas = { width: 0, height: 0 };
    this._ink = 'night'; this._a = 1;
  }
  _p(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  _k() { const m = this.m; return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1; }
  save() { this.st.push([this.m.slice(), this.clipR]); }
  restore() { const s = this.st.pop(); if (s) { this.m = s[0]; this.clipR = s[1]; } }
  transform(a, b, c, d, e, f) { const m = this.m; this.m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]]; }
  setTransform(a, b, c, d, e, f) { if (a && typeof a === 'object') this.m = [a.a, a.b, a.c, a.d, a.e, a.f]; else this.m = [a, b, c, d, e, f]; }
  resetTransform() { this.m = [1, 0, 0, 1, 0, 0]; }
  getTransform() { const m = this.m; return { a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }; }
  translate(x, y) { this.transform(1, 0, 0, 1, x, y); }
  scale(x, y) { this.transform(x, 0, 0, y, 0, 0); }
  rotate(r) { const c = Math.cos(r), s = Math.sin(r); this.transform(c, s, -s, c, 0, 0); }
  setLineDash(d) { this._dash = d; }
  getLineDash() { return this._dash; }
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
    const n = Math.max(1, Math.min(64, Math.ceil(Math.sqrt(dd / (4 * this.tol)))));
    for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; P.push([u * u * a[0] + 2 * u * t * b[0] + t * t * e[0], u * u * a[1] + 2 * u * t * b[1] + t * t * e[1]]); }
  }
  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
    if (!this.cur) this.moveTo(c1x, c1y);
    const P = this.cur.pts, a = P[P.length - 1], b = this._p(c1x, c1y), c = this._p(c2x, c2y), e = this._p(x, y);
    const dd = Math.max(Math.hypot(a[0] - 2 * b[0] + c[0], a[1] - 2 * b[1] + c[1]), Math.hypot(b[0] - 2 * c[0] + e[0], b[1] - 2 * c[1] + e[1]));
    const n = Math.max(1, Math.min(64, Math.ceil(Math.sqrt(0.75 * dd / this.tol))));
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t, A = u * u * u, B = 3 * u * u * t, C = 3 * u * t * t, E = t * t * t;
      P.push([A * a[0] + B * b[0] + C * c[0] + E * e[0], A * a[1] + B * b[1] + C * c[1] + E * e[1]]);
    }
  }
  ellipse(x, y, rx, ry, rot, a0, a1, ccw = false) {
    let sw;
    if (!ccw && a1 - a0 >= TAU) sw = TAU;
    else if (ccw && a0 - a1 >= TAU) sw = -TAU;
    else if (!ccw) sw = (((a1 - a0) % TAU) + TAU) % TAU;
    else sw = -((((a0 - a1) % TAU) + TAU) % TAU);
    const r = Math.max(Math.abs(rx), Math.abs(ry)) * this._k();
    const step = r > this.tol ? 2 * Math.acos(Math.max(-1, 1 - this.tol / r)) : Math.PI / 2;
    const n = Math.max(2, Math.min(96, Math.ceil(Math.abs(sw) / step)));
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const pt = th => { const ex = rx * Math.cos(th), ey = ry * Math.sin(th); return [x + ex * cr - ey * sr, y + ex * sr + ey * cr]; };
    const s0 = pt(a0);
    if (this.cur) this.lineTo(s0[0], s0[1]); else this.moveTo(s0[0], s0[1]);
    for (let k = 1; k <= n; k++) { const q = pt(a0 + sw * k / n); this.cur.pts.push(this._p(q[0], q[1])); }
  }
  arc(x, y, r, a0, a1, ccw = false) { this.ellipse(x, y, r, r, 0, a0, a1, ccw); }
  _polys() {
    const out = [];
    for (const sp of this.subs) if (sp.pts.length >= 3) out.push(sp.pts);
    return out;
  }
  fill() { const P = this._polys(); if (P.length) this.sink.fill(P, this._ink, this.globalAlpha, this.clipR); }
  stroke() {
    const w = this.lineWidth * this._k();
    const P = [];
    for (const sp of this.subs) obrysCiary(P, sp.pts, sp.closed, w / 2, this.lineCap, this.lineJoin);
    if (P.length) this.sink.fill(P, this._ink, this.globalAlpha, this.clipR);
  }
  clip() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const sp of this.subs) for (const q of sp.pts) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    if (!(x1 >= x0)) return;
    const c = this.clipR;
    this.clipR = c ? [Math.max(c[0], x0), Math.max(c[1], y0), Math.min(c[2], x1), Math.min(c[3], y1)] : [x0, y0, x1, y1];
  }
  fillRect(x, y, w, h) { const keep = this.subs, cur = this.cur; this.beginPath(); this.rect(x, y, w, h); this.fill(); this.subs = keep; this.cur = cur; }
  clearRect() {}
  fillText() {}
  strokeText() {}
  measureText(s) { const n = String(s).length * 5; return { width: n, actualBoundingBoxLeft: n / 2, actualBoundingBoxRight: n / 2, actualBoundingBoxAscent: 5, actualBoundingBoxDescent: 2 }; }
  drawImage() {}
  createPattern() { return { setTransform() {} }; }
}

/* The area a stroke covers, as pieces that all wind the same way: a quad per
   segment, a disk at every round join and cap. One nonzero fill of the pieces is
   their union, so a line prints (and hides) exactly once. */
function kruhPoly(x, y, r, n = 14) {
  const q = [];
  for (let k = 0; k < n; k++) { const a = k / n * TAU; q.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
  return q;
}
function kladne(q) {
  let a = 0;
  for (let i = 0; i < q.length; i++) { const p = q[i], r = q[(i + 1) % q.length]; a += p[0] * r[1] - r[0] * p[1]; }
  return a >= 0 ? q : q.slice().reverse();
}
export function obrysCiary(out, pts, closed, h, cap, join) {
  const P = [];
  for (const q of pts) { const l = P[P.length - 1]; if (!l || Math.abs(q[0] - l[0]) > 1e-9 || Math.abs(q[1] - l[1]) > 1e-9) P.push(q); }
  if (!(h > 0)) return out;
  if (P.length === 1) { if (cap === 'round' && pts.length > 1) out.push(kladne(kruhPoly(P[0][0], P[0][1], h))); return out; }
  if (P.length < 2) return out;
  const n = P.length, segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    let a = P[i], b = P[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-9) continue;
    const dx = (b[0] - a[0]) / L, dy = (b[1] - a[1]) / L;
    if (!closed && cap === 'square') {
      if (i === 0) a = [a[0] - dx * h, a[1] - dy * h];
      if (i === segs - 1) b = [b[0] + dx * h, b[1] + dy * h];
    }
    const nx = -dy * h, ny = dx * h;
    out.push(kladne([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]));
  }
  const nKr = h > 3 ? 18 : 12;
  for (let i = 0; i < n; i++) {
    const kraj = !closed && (i === 0 || i === n - 1);
    if (kraj ? cap === 'round' : true) out.push(kladne(kruhPoly(P[i][0], P[i][1], h, nKr)));
  }
  return out;
}

/* ── Scanline fill, nonzero, over a grid of cells (cell centres sampled) ── */
export function vyplnBunky(polys, x0, y0, cell, w, h, clip, bunka) {
  let ya = Infinity, yb = -Infinity;
  for (const q of polys) for (const p of q) { if (p[1] < ya) ya = p[1]; if (p[1] > yb) yb = p[1]; }
  if (clip) { ya = Math.max(ya, clip[1]); yb = Math.min(yb, clip[3]); }
  let r0 = Math.max(0, Math.ceil((ya - y0) / cell - 0.5)), r1 = Math.min(h - 1, Math.floor((yb - y0) / cell - 0.5));
  if (r1 < r0) return;
  const edges = [];
  for (const q of polys) {
    for (let i = 0; i < q.length; i++) {
      const a = q[i], b = q[(i + 1) % q.length];
      if (a[1] === b[1]) continue;
      if (a[1] < b[1]) edges.push([a[1], b[1], a[0], (b[0] - a[0]) / (b[1] - a[1]), 1]);
      else edges.push([b[1], a[1], b[0], (a[0] - b[0]) / (a[1] - b[1]), -1]);
    }
  }
  const xs = [];
  const cx0 = clip ? clip[0] : -Infinity, cx1 = clip ? clip[2] : Infinity;
  for (let r = r0; r <= r1; r++) {
    const y = y0 + (r + 0.5) * cell;
    xs.length = 0;
    for (const e of edges) if (y >= e[0] && y < e[1]) xs.push([e[2] + (y - e[0]) * e[3], e[4]]);
    if (xs.length < 2) continue;
    xs.sort((p, q) => p[0] - q[0]);
    let wnd = 0;
    for (let k = 0; k < xs.length - 1; k++) {
      wnd += xs[k][1];
      if (wnd === 0) continue;
      const xa = Math.max(xs[k][0], cx0), xb = Math.min(xs[k + 1][0], cx1);
      if (xb <= xa) continue;
      let c0 = Math.max(0, Math.ceil((xa - x0) / cell - 0.5)), c1 = Math.min(w - 1, Math.ceil((xb - x0) / cell - 0.5) - 1);
      for (let c = c0; c <= c1; c++) bunka(r * w + c);
    }
  }
}

/* ── Sinks ─────────────────────────────────────────────────────────────── */
/* grows the box of every shape that is not a shadow */
export class Hranice {
  constructor() { this.bb = [Infinity, Infinity, -Infinity, -Infinity]; }
  fill(polys, ink, a, clip) {
    if (TIENE.has(ink) || !(a > 0)) return;
    const b = this.bb;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of polys) for (const p of q) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    if (clip) { x0 = Math.max(x0, clip[0]); y0 = Math.max(y0, clip[1]); x1 = Math.min(x1, clip[2]); y1 = Math.min(y1, clip[3]); }
    if (x1 < x0 || y1 < y0) return;
    b[0] = Math.min(b[0], x0); b[1] = Math.min(b[1], y0); b[2] = Math.max(b[2], x1); b[3] = Math.max(b[3], y1);
  }
}
/* paints the cells a shape covers with a callback per cell */
export class Mriezka {
  constructor(x0, y0, cell, w, h) { this.x0 = x0; this.y0 = y0; this.cell = cell; this.w = w; this.h = h; this.naBunku = null; }
  fill(polys, ink, a, clip) {
    if (TIENE.has(ink) || !(a > 0) || !this.naBunku) return;
    vyplnBunky(polys, this.x0, this.y0, this.cell, this.w, this.h, clip, this.naBunku);
  }
}

/* ── A pen with the riso.js Pen interface, over a sink ─────────────────── */
export class Pero {
  constructor(sink, tol) { this.k = new Kontext(sink, tol); this.c = this.k; this.s = 1; this.glow = null; this.ox = 0; this.oy = 0; }
  scale(s) { this.s = s; }
  ink(name, a = 1) {
    const c = this.k;
    c._ink = name; c._a = a; c.globalAlpha = a;
    c.globalCompositeOperation = name === 'paper' ? 'source-over' : 'multiply';
    return c;
  }
  poly(name, a, pts) {
    const c = this.ink(name, a);
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]);
    c.closePath(); c.fill();
  }
  circle(name, a, x, y, r) { const c = this.ink(name, a); c.beginPath(); c.arc(x, y, Math.max(r, 0.01), 0, 6.2832); c.fill(); }
  ellipse(name, a, x, y, rx, ry, rot = 0, a0 = 0, a1 = 6.2832) {
    const c = this.ink(name, a);
    c.beginPath(); c.ellipse(x, y, Math.max(rx, 0.01), Math.max(ry, 0.01), rot, a0, a1); c.fill();
  }
  line(name, a, w, pts, cap = 'round') {
    const c = this.ink(name, a);
    c.lineWidth = w; c.lineCap = cap; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]);
    c.stroke();
  }
  path(name, a, fn, stroke = 0) {
    const c = this.ink(name, a);
    c.beginPath(); fn(c, 0, 0);
    if (stroke) { c.lineWidth = stroke; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); } else c.fill();
  }
  text() {}
  reset() { const c = this.k; c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
  get fs() { return false; }
  strokePts(pts, w) { const c = this.k; c.lineWidth = w; c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke(); }
}

/* ── Measuring ─────────────────────────────────────────────────────────── */
/* the box of everything a drawing prints (shadows left out) */
export function hranice(kresli) {
  const s = new Hranice(), p = new Pero(s, 0.3);
  kresli(p);
  const b = s.bb;
  return b[2] >= b[0] ? b : null;
}

/* What a player can see of an object: its cells in a grid of `cell` world units,
   minus the cells covered by the objects printed after it (kryty, in any order).
   Every object is { kresli(p), bb } with bb from hranice(). hlavnyKryt is the
   index in kryty of the one that hides the most. */
export function viditelnost(o, kryty, cell = 0.5) {
  const b = o.bb;
  const x0 = Math.floor(b[0] / cell) * cell - cell, y0 = Math.floor(b[1] / cell) * cell - cell;
  const w = Math.ceil((b[2] - x0) / cell) + 2, h = Math.ceil((b[3] - y0) / cell) + 2;
  const tvar = new Uint8Array(w * h), kryt = new Int16Array(w * h).fill(-1);
  const m = new Mriezka(x0, y0, cell, w, h);
  const pero = new Pero(m, cell * 0.25);
  m.naBunku = i => { tvar[i] = 1; };
  o.kresli(pero);
  let plocha = 0;
  for (let i = 0; i < tvar.length; i++) plocha += tvar[i];
  const pocty = new Map();
  for (let n = 0; n < kryty.length; n++) {
    const q = kryty[n], c = q.bb;
    if (!c || c[2] < b[0] || c[0] > b[2] || c[3] < b[1] || c[1] > b[3]) continue;
    m.naBunku = i => { if (tvar[i] && kryt[i] < 0) { kryt[i] = n; pocty.set(n, (pocty.get(n) || 0) + 1); } };
    q.kresli(new Pero(m, cell * 0.25));
  }
  const body = [];
  let vx0 = Infinity, vy0 = Infinity, vx1 = -Infinity, vy1 = -Infinity, sx = 0, sy = 0;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const i = r * w + c;
    if (!tvar[i] || kryt[i] >= 0) continue;
    const x = x0 + (c + 0.5) * cell, y = y0 + (r + 0.5) * cell;
    body.push(x, y); sx += x; sy += y;
    if (x < vx0) vx0 = x; if (x > vx1) vx1 = x; if (y < vy0) vy0 = y; if (y > vy1) vy1 = y;
  }
  const n = body.length / 2;
  let hlavny = -1, hlavnyN = 0;
  for (const [q, v] of pocty) if (v > hlavnyN) { hlavnyN = v; hlavny = q; }
  return {
    cell, plocha: plocha * cell * cell, viditelna: n * cell * cell,
    podiel: plocha ? n / plocha : 0,
    bb: n ? [vx0 - cell / 2, vy0 - cell / 2, vx1 + cell / 2, vy1 + cell / 2] : null,
    stred: n ? [sx / n, sy / n] : null,
    body: new Float32Array(body),
    hlavnyKryt: hlavny, hlavnyKrytPodiel: plocha ? hlavnyN / plocha : 0
  };
}

/* The thing a tap at (x, y) finds: the nearest visible cell of any target within
   tol world units. Ties go to the nearer one, so a tap right on a drawing always
   finds that drawing. Returns the index in `ciele` or -1. */
export function zasah(ciele, x, y, tol) {
  let best = -1, bd = Infinity;
  for (let k = 0; k < ciele.length; k++) {
    const v = ciele[k], b = v.bb;
    if (!b) continue;
    const pad = tol + v.cell;
    if (x < b[0] - pad || x > b[2] + pad || y < b[1] - pad || y > b[3] + pad) continue;
    const P = v.body, lim = (tol + v.cell * 0.5) * (tol + v.cell * 0.5);
    for (let i = 0; i < P.length; i += 2) {
      const dx = P[i] - x, dy = P[i + 1] - y, d = dx * dx + dy * dy;
      if (d <= lim && d < bd) { bd = d; best = k; }
    }
  }
  return best;
}
