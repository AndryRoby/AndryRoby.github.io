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
    c.beginPath();
    c.moveTo(pts[0][0] + ox, pts[0][1] + oy);
    for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0] + ox, pts[k][1] + oy);
    c.stroke();
  }
  /* free path: fn gets the context and the register offset */
  path(name, a, fn, stroke = 0) {
    const c = this.ink(name, a);
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
}
