/* Kópia products/arling-sk/games/village/riso.js (25. 9. 2026): atramenty cez multiply, zrno a posun registrácie. */
export const INK = {
  paper: [244, 236, 217], blue: [52, 96, 178], pink: [255, 104, 150], orange: [242, 100, 60], sun: [255, 184, 38],
  green: [44, 158, 96], teal: [0, 131, 138], plum: [118, 84, 160], night: [40, 48, 70]
};
const REG = {
  paper: [0, 0], blue: [0.55, -0.35], pink: [-0.5, 0.3], orange: [0.25, 0.45],
  sun: [-0.3, -0.45], green: [0.35, 0.3], teal: [-0.4, -0.2], plum: [0.3, -0.4], night: [0, 0]
};
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
function inkTile(rgb, seed) {
  const N = 128, cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const img = g.createImageData(N, N), d = img.data;
  const r = rng(seed * 7919 + 17);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = (y * N + x) * 4;
    const blot = smooth(x, y, 32, seed) * 0.55 + smooth(x, y, 8, seed + 3) * 0.45;
    let a = 0.84 + blot * 0.16;
    const s = r();
    if (s < 0.05) a *= 0.45;
    else if (s < 0.09) a *= 0.72;
    else if (s > 0.992) a = 1;
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
    if (r() < 0.012) m -= 0.1;
    d[k] = P[0] * m; d[k + 1] = P[1] * m; d[k + 2] = P[2] * m; d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.12; g.strokeStyle = '#8a7a5c'; g.lineWidth = 0.6;
  for (let i = 0; i < 9; i++) {
    const x = r() * N, y = r() * N, a = r() * 6.28, l = 3 + r() * 7;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.6 + 1, y + Math.sin(a) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  return cv;
}
let TILES = null;
function tiles() {
  if (TILES) return TILES;
  TILES = {};
  let seed = 1;
  for (const k of Object.keys(INK)) TILES[k] = k === 'paper' ? paperTile() : inkTile(INK[k], seed++);
  return TILES;
}
export class Pen {
  constructor(ctx) {
    this.c = ctx; this.pat = {};
    const t = tiles();
    for (const k of Object.keys(t)) this.pat[k] = ctx.createPattern(t[k], 'repeat');
    this.s = 0; this.ox = 0; this.oy = 0; this.reg = 1;
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
    c.fillStyle = c.strokeStyle = this.pat[name] || this.pat.night;
    const o = REG[name] || REG.night;
    this.ox = o[0] * this.reg; this.oy = o[1] * this.reg;
    return c;
  }
  poly(name, a, pts) {
    const c = this.ink(name, a), ox = this.ox, oy = this.oy;
    c.beginPath(); c.moveTo(pts[0][0] + ox, pts[0][1] + oy);
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
    c.beginPath(); c.moveTo(pts[0][0] + ox, pts[0][1] + oy);
    for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0] + ox, pts[k][1] + oy);
    c.stroke();
  }
  path(name, a, fn, stroke = 0) {
    const c = this.ink(name, a);
    c.beginPath(); fn(c, this.ox, this.oy);
    if (stroke) { c.lineWidth = stroke; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); } else c.fill();
  }
  reset() { const c = this.c; c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
}
