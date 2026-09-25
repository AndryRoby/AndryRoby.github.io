/* Puzzle Village: isometric geometry, houses, trees and the animals.
   The world is a grid of tiles (i, j). One tile is 64 by 32 world units on the
   plate, h lifts a point straight up. Everything here draws through the Pen
   from riso.js, so it prints in inks. */

export const TW = 64, TH = 32;
export function iso(i, j, h = 0) { return [(i - j) * TW / 2, (i + j) * TH / 2 - h]; }
/* radius r (in tiles) of a flat circle seen from above, as an ellipse on the plate */
export const RX = 45.2548, RY = 22.6274;

/* ── Boxes and houses ─────────────────────────────────────────────────── */
export function box(p, i, j, w, d, h, top, left, right, h0 = 0) {
  const A = iso(i, j, h0 + h), B = iso(i + w, j, h0 + h), C = iso(i + w, j + d, h0 + h), D = iso(i, j + d, h0 + h);
  const C0 = iso(i + w, j + d, h0), D0 = iso(i, j + d, h0), B0 = iso(i + w, j, h0);
  if (right) p.poly(right[0], right[1], [B, C, C0, B0]);
  if (left) p.poly(left[0], left[1], [D, C, C0, D0]);
  if (top) p.poly(top[0], top[1], [A, B, C, D]);
}
/* a quad on the +j face (facing lower left) of a box at j = jf, u along i, v up */
export function faceJ(p, ink, a, i0, jf, u0, u1, v0, v1) {
  p.poly(ink, a, [iso(i0 + u0, jf, v0), iso(i0 + u1, jf, v0), iso(i0 + u1, jf, v1), iso(i0 + u0, jf, v1)]);
}
/* a quad on the +i face (facing lower right) at i = if_, u along j */
export function faceI(p, ink, a, if_, j0, u0, u1, v0, v1) {
  p.poly(ink, a, [iso(if_, j0 + u0, v0), iso(if_, j0 + u1, v0), iso(if_, j0 + u1, v1), iso(if_, j0 + u0, v1)]);
}

/* Where a cottage chimney stands: always inside the walls, behind the ridge. */
export function chimneyBase(i, j, w, d, h, rh) { rh = rh || h * 0.75; return [i + Math.min(w * 0.72, w - 0.44), j + d * 0.22, h + rh * 0.45]; }
export function chimneyTop(i, j, w, d, h, rh) { rh = rh || h * 0.75; const [ci, cj, hb] = chimneyBase(i, j, w, d, h, rh); return iso(ci + 0.16, cj + 0.16, hb + rh * 0.75 + 2); }

/* A cottage. Ridge runs along i. Returns the points smoke and windows need. */
export function cottage(p, i, j, w, d, h, roof, wall = 'sun', opt = {}) {
  const rh = opt.rh || h * 0.75, e = 0.14;
  // shadow on the ground, a halftone patch to the lower right
  p.poly('dots', 0.55, [iso(i + w, j - 0.1), iso(i + w + 0.9, j + 0.3), iso(i + w + 0.9, j + d + 0.5), iso(i + 0.4, j + d + 0.5), iso(i, j + d)]);
  // back roof slope, just its top edge shows. Its eave ends at the back wall:
  // with an overhang its far corner stuck out past the gable as a thin loose
  // wedge over the grass
  p.poly(roof, 0.95, [iso(i - e, j, h), iso(i + w, j, h), iso(i + w, j + d / 2, h + rh), iso(i - e, j + d / 2, h + rh)]);
  p.poly('night', 0.14, [iso(i - e, j, h), iso(i + w, j, h), iso(i + w, j + d / 2, h + rh), iso(i - e, j + d / 2, h + rh)]);
  // walls
  box(p, i, j, w, d, h, null, ['paper', 1], ['paper', 1]);
  faceJ(p, wall, 0.32, i, j + d, 0, w, 0, h);
  faceI(p, wall, 0.32, i + w, j, 0, d, 0, h);
  faceI(p, 'blue', 0.22, i + w, j, 0, d, 0, h);
  // gable end on the +i side
  p.poly('paper', 1, [iso(i + w, j, h), iso(i + w, j + d, h), iso(i + w, j + d / 2, h + rh)]);
  p.poly(wall, 0.32, [iso(i + w, j, h), iso(i + w, j + d, h), iso(i + w, j + d / 2, h + rh)]);
  p.poly('blue', 0.22, [iso(i + w, j, h), iso(i + w, j + d, h), iso(i + w, j + d / 2, h + rh)]);
  // a round window in the gable
  const g = iso(i + w, j + d / 2, h + rh * 0.42);
  p.ellipse('night', 0.7, g[0], g[1], 3.2, 3.8);
  // skirting
  faceJ(p, 'orange', 0.35, i, j + d, 0, w, 0, 3);
  faceI(p, 'orange', 0.45, i + w, j, 0, d, 0, 3);
  // door on the +j face
  const dx = opt.door ?? w * 0.5;
  faceJ(p, opt.doorInk || roof, 0.85, i + dx - 0.18, j + d, 0, 0.36, 0, h * 0.62);
  faceJ(p, 'night', 0.35, i + dx - 0.18, j + d, 0, 0.36, 0, h * 0.62);
  const kn = iso(i + dx + 0.1, j + d, h * 0.3);
  p.circle('sun', 1, kn[0], kn[1], 0.9);
  // windows
  const wins = [];
  const wj = opt.winsJ || [w * 0.2, w * 0.8];
  for (const u of wj) {
    if (Math.abs(u - dx) < 0.35) continue;
    faceJ(p, 'night', 0.72, i + u - 0.15, j + d, 0, 0.3, h * 0.36, h * 0.72);
    faceJ(p, 'paper', 1, i + u - 0.15, j + d, 0.135, 0.165, h * 0.36, h * 0.72);
    faceJ(p, roof, 0.7, i + u - 0.2, j + d, 0, 0.4, h * 0.3, h * 0.36);
    if (p.glow) p.glow.push([iso(i + u - 0.15, j + d, h * 0.36), iso(i + u + 0.15, j + d, h * 0.36), iso(i + u + 0.15, j + d, h * 0.72), iso(i + u - 0.15, j + d, h * 0.72)]);
    wins.push({ face: 'j', i: i + u - 0.15, j: j + d, u0: 0, u1: 0.3, v0: h * 0.36, v1: h * 0.72 });
  }
  const wi = opt.winsI || [d * 0.5];
  for (const u of wi) {
    faceI(p, 'night', 0.72, i + w, j + u - 0.15, 0, 0.3, h * 0.36, h * 0.72);
    faceI(p, 'paper', 1, i + w, j + u - 0.15, 0.135, 0.165, h * 0.36, h * 0.72);
    if (p.glow) p.glow.push([iso(i + w, j + u - 0.15, h * 0.36), iso(i + w, j + u + 0.15, h * 0.36), iso(i + w, j + u + 0.15, h * 0.72), iso(i + w, j + u - 0.15, h * 0.72)]);
    wins.push({ face: 'i', i: i + w, j: j + u - 0.15, u0: 0, u1: 0.3, v0: h * 0.36, v1: h * 0.72 });
  }
  // chimney behind the ridge
  let chim = null;
  if (opt.chimney !== false) {
    const [ci, cj, hb] = chimneyBase(i, j, w, d, h, rh);
    box(p, ci, cj, 0.32, 0.32, rh * 0.75, ['orange', 0.9], ['orange', 0.75], ['orange', 1], hb);
    faceI(p, 'night', 0.25, ci + 0.32, cj, 0, 0.32, hb, hb + rh * 0.75);
    chim = iso(ci + 0.16, cj + 0.16, hb + rh * 0.75 + 2);
  }
  // front roof slope with a darker eave line and tile stripes
  const R = [iso(i - e, j + d + e, h - 1), iso(i + w + e, j + d + e, h - 1), iso(i + w + e, j + d / 2, h + rh), iso(i - e, j + d / 2, h + rh)];
  p.poly('paper', 1, R);
  p.poly(roof, 0.92, R);
  for (let k = 1; k < 4; k++) {
    const f = k / 4;
    const a = iso(i - e, j + d + e - (d / 2 + e) * f, h - 1 + (rh + 1) * f), b = iso(i + w + e, j + d + e - (d / 2 + e) * f, h - 1 + (rh + 1) * f);
    p.line(roof, 0.5, 1.2, [a, b]);
  }
  p.line('night', 0.35, 1.6, [R[0], R[1]]);
  p.line('paper', 0.9, 1.4, [R[3], R[2]]);
  return { chim, wins, top: iso(i + w / 2, j + d / 2, h + rh) };
}

/* ── Trees, bushes, flowers, stones ───────────────────────────────────── */
export function tree(p, x, y, s, kind, seed) {
  // shadow
  p.ellipse('dots', 0.5, x + 5 * s, y + 1.5 * s, 11 * s, 4.5 * s);
  if (kind === 'pine') {
    p.poly('orange', 0.6, [[x - 1.6 * s, y], [x + 1.6 * s, y], [x + 1.2 * s, y - 8 * s], [x - 1.2 * s, y - 8 * s]]);
    const tiers = (c, ox, oy) => {
      for (let k = 0; k < 3; k++) {
        const yy = y - 6 * s - k * 7.5 * s, ww = (11 - k * 2.6) * s;
        c.moveTo(x - ww + ox, yy + oy); c.lineTo(x + ww + ox, yy + oy); c.lineTo(x + ox, yy - 13 * s + oy); c.closePath();
      }
    };
    p.path('paper', 1, tiers);
    p.path('teal', 0.85, tiers);
    p.path('green', 0.25, tiers);
    for (let k = 0; k < 3; k++) {
      const yy = y - 6 * s - k * 7.5 * s, ww = (11 - k * 2.6) * s;
      p.poly('blue', 0.3, [[x, yy - 13 * s], [x + ww, yy], [x + 1 * s, yy]]);
    }
    return;
  }
  p.poly('orange', 0.65, [[x - 1.8 * s, y], [x + 1.8 * s, y], [x + 1.2 * s, y - 12 * s], [x - 1.2 * s, y - 12 * s]]);
  p.poly('night', 0.2, [[x, y], [x + 1.8 * s, y], [x + 1.2 * s, y - 12 * s], [x, y - 12 * s]]);
  const r = 9 * s;
  const cy = y - 17 * s;
  const ink = kind === 'autumn' ? 'orange' : 'green';
  const crown = (c, ox, oy) => {
    for (const [dx, dy, rr] of [[-4, 2, 0.8], [4.5, 1.5, 0.78], [0, -4, 0.9]]) { c.moveTo(x + dx * s + r * rr + ox, cy + dy * s + oy); c.arc(x + dx * s + ox, cy + dy * s + oy, r * rr, 0, 6.2832); }
  };
  p.path('paper', 1, crown);
  p.path(ink, 0.85, crown);
  // shade overprint on the lower right
  p.path('blue', 0.35, (c, ox, oy) => { c.ellipse(x + 4 * s + ox, cy + 3 * s + oy, r * 0.85, r * 0.7, 0.4, 0, 6.283); });
  // light on the upper left
  p.circle('sun', 0.55, x - 3.5 * s, cy - 5 * s, r * 0.42);
  if (kind === 'fruit') {
    for (let k = 0; k < 4; k++) p.circle('pink', 0.95, x - 6 * s + hashS(seed, k) * 12 * s, cy - 6 * s + hashS(seed + 1, k) * 10 * s, 1.3 * s);
  }
}
function hashS(a, b) { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); }

export function bush(p, x, y, s, ink = 'green') {
  p.ellipse('dots', 0.45, x + 3 * s, y + 1, 8 * s, 3 * s);
  const b = (c, ox, oy) => {
    for (const [dx, dy, rr] of [[-3, -3, 4], [3, -3.5, 4.2], [0, -6, 4.4]]) { c.moveTo(x + dx * s + rr * s + ox, y + dy * s + oy); c.arc(x + dx * s + ox, y + dy * s + oy, rr * s, 0, 6.2832); }
  };
  p.path('paper', 1, b);
  p.path(ink, 0.8, b);
  p.circle('blue', 0.25, x + 2.5 * s, y - 2.5 * s, 3.5 * s);
}
export function flowers(p, x, y, seed, n = 5, inks = ['pink', 'sun', 'paper']) {
  for (let k = 0; k < n; k++) {
    const fx = x + (hashS(seed, k) - 0.5) * 14, fy = y + (hashS(seed + 7, k) - 0.5) * 6;
    p.line('green', 0.8, 0.8, [[fx, fy], [fx, fy - 3]]);
    p.circle(inks[k % inks.length], 0.95, fx, fy - 3.5, 1.5);
  }
}
export function stone(p, x, y, s = 1) {
  p.ellipse('night', 0.25, x, y, 4 * s, 2.4 * s);
  p.ellipse('paper', 1, x - 0.6 * s, y - 0.8 * s, 3.4 * s, 1.9 * s);
  p.ellipse('night', 0.14, x - 0.6 * s, y - 0.8 * s, 3.4 * s, 1.9 * s);
}
export function fence(p, a, b, n, h = 7) {
  // posts from tile point a to tile point b, with two rails
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const f = k / n;
    pts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  const P0 = iso(a[0], a[1]), P1 = iso(b[0], b[1]);
  p.line('orange', 0.7, 1.2, [[P0[0], P0[1] - h * 0.45], [P1[0], P1[1] - h * 0.45]]);
  p.line('orange', 0.7, 1.2, [[P0[0], P0[1] - h * 0.85], [P1[0], P1[1] - h * 0.85]]);
  for (const q of pts) { const P = iso(q[0], q[1]); p.line('orange', 0.9, 1.8, [[P[0], P[1]], [P[0], P[1] - h]], 'butt'); }
}
export function signpost(p, x, y, text, ink) {
  p.line('orange', 0.9, 2, [[x, y], [x, y - 20]], 'butt');
  p.line('night', 0.3, 2, [[x + 0.6, y], [x + 0.6, y - 20]], 'butt');
  const w = Math.max(28, text.length * 5.6 + 8);
  p.poly(ink, 0.95, [[x - w / 2, y - 29], [x + w / 2 - 3, y - 29], [x + w / 2 + 2, y - 24.5], [x + w / 2 - 3, y - 20], [x - w / 2, y - 20]]);
  p.text('paper', 1, text, x, y - 24.4, 7.2, 700);
}

/* ── Animals ──────────────────────────────────────────────────────────
   Drawn upright at (x, y) = where the feet touch the ground. s = size,
   f = facing (1 right, -1 left), b = breath 0..1, k = blink (true = closed). */
export function eye(p, x, y, r, k) {
  if (k) p.line('night', 0.9, r * 0.7, [[x - r, y], [x + r, y]]);
  else { p.circle('night', 0.95, x, y, r); p.circle('paper', 1, x - r * 0.35, y - r * 0.35, r * 0.35); }
}
export function withFlip(p, x, y, f, fn) {
  const c = p.c; c.save(); c.translate(x, y); c.scale(f, 1); fn(); c.restore();
}

export function hedgehog(p, x, y, s, f, b, k) {
  withFlip(p, x, y, f, () => {
    const br = 1 + b * 0.04;
    p.ellipse('dots', 0.45, 1, 0.5, 9 * s, 2.4 * s);
    // spines
    p.path('orange', 0.8, (c, ox, oy) => {
      c.moveTo(-9 * s + ox, 0 + oy);
      for (let n = 0; n <= 9; n++) {
        const a = Math.PI + n / 9 * Math.PI * 0.82;
        const rr = (n % 2 ? 10.5 : 8) * s;
        c.lineTo(Math.cos(a) * rr + ox, Math.sin(a) * rr * 0.85 * br + oy);
      }
      c.lineTo(6 * s + ox, oy); c.closePath();
    });
    p.path('night', 0.4, (c, ox, oy) => {
      c.ellipse(-2 * s + ox, -2.5 * s + oy, 6.8 * s, 5.4 * s * br, 0, Math.PI, 0);
    });
    // face
    p.path('sun', 0.55, (c, ox, oy) => { c.moveTo(3 * s + ox, -5 * s * br + oy); c.quadraticCurveTo(10 * s + ox, -2 * s + oy, 11 * s + ox, -0.6 * s + oy); c.lineTo(4 * s + ox, 0 + oy); c.closePath(); });
    p.circle('night', 1, 11 * s, -0.8 * s, 1.1 * s);
    eye(p, 6.2 * s, -2.6 * s, 0.9 * s, k);
    p.circle('pink', 0.6, 7.2 * s, -1.2 * s, 1.1 * s);
    p.line('night', 0.7, 1 * s, [[-3 * s, 0], [-3 * s, 1.2 * s]]);
    p.line('night', 0.7, 1 * s, [[4 * s, 0], [4 * s, 1.2 * s]]);
  });
}

export function otter(p, x, y, s, f, b, k, swim) {
  withFlip(p, x, y, f, () => {
    if (!swim) p.ellipse('dots', 0.45, 1, 0.5, 10 * s, 2.5 * s);
    const br = b * 0.6 * s;
    // tail
    p.path('orange', 0.85, (c, ox, oy) => { c.moveTo(-7 * s + ox, -2 * s + oy); c.quadraticCurveTo(-14 * s + ox, -1 * s + oy, -15 * s + ox, 1 * s + oy); c.quadraticCurveTo(-11 * s + ox, 0.5 * s + oy, -6 * s + ox, 0 + oy); c.closePath(); });
    // body
    p.path('orange', 0.85, (c, ox, oy) => { c.ellipse(-1 * s + ox, -4 * s + oy, 8 * s, 4.2 * s + br, -0.1, 0, 6.283); });
    p.path('night', 0.3, (c, ox, oy) => { c.ellipse(-1 * s + ox, -4 * s + oy, 8 * s, 4.2 * s + br, -0.1, 0, 6.283); });
    p.path('sun', 0.45, (c, ox, oy) => { c.ellipse(1 * s + ox, -2.4 * s + oy, 5 * s, 2 * s, -0.1, 0, 6.283); });
    // head
    p.circle('orange', 0.85, 7 * s, -8 * s, 4.2 * s);
    p.circle('night', 0.3, 7 * s, -8 * s, 4.2 * s);
    p.ellipse('sun', 0.55, 9 * s, -6.6 * s, 2.6 * s, 1.8 * s);
    p.circle('orange', 0.9, 4.8 * s, -11.6 * s, 1.2 * s);
    p.circle('night', 1, 11 * s, -7.3 * s, 0.9 * s);
    eye(p, 8 * s, -9 * s, 0.8 * s, k);
    p.line('night', 0.5, 0.35 * s, [[10 * s, -6.6 * s], [13.5 * s, -7.2 * s]]);
    p.line('night', 0.5, 0.35 * s, [[10 * s, -6.2 * s], [13.5 * s, -5.8 * s]]);
    if (!swim) { p.line('orange', 0.9, 1.6 * s, [[-4 * s, -1 * s], [-4 * s, 0.6 * s]]); p.line('orange', 0.9, 1.6 * s, [[3 * s, -1 * s], [3.5 * s, 0.6 * s]]); }
  });
}

export function magpie(p, x, y, s, f, b, k, tail = 0) {
  withFlip(p, x, y, f, () => {
    p.line('night', 0.8, 0.8 * s, [[-1 * s, 0], [-1 * s, -3 * s]]);
    p.line('night', 0.8, 0.8 * s, [[1 * s, 0], [1 * s, -3 * s]]);
    // tail with a blue sheen
    p.path('night', 0.85, (c, ox, oy) => { c.save(); c.translate(-4 * s + ox, -6 * s + oy); c.rotate(0.5 + tail * 0.25); c.moveTo(0, -1.2 * s); c.lineTo(-11 * s, -0.4 * s); c.lineTo(-11 * s, 1.4 * s); c.lineTo(0, 1.8 * s); c.restore(); });
    p.path('blue', 0.6, (c, ox, oy) => { c.save(); c.translate(-4 * s + ox, -6 * s + oy); c.rotate(0.5 + tail * 0.25); c.moveTo(-3 * s, -0.8 * s); c.lineTo(-11 * s, -0.3 * s); c.lineTo(-11 * s, 0.6 * s); c.lineTo(-3 * s, 0.6 * s); c.restore(); });
    p.ellipse('night', 0.85, 0, -7 * s, 5.2 * s, 3.6 * s * (1 + b * 0.04), -0.35);
    p.ellipse('paper', 1, 0.6 * s, -5.4 * s, 3 * s, 2 * s, -0.3);
    p.ellipse('blue', 0.55, -1.6 * s, -7.6 * s, 3 * s, 1.5 * s, -0.4);
    p.path('paper', 1, (c, ox, oy) => { c.ellipse(-1.8 * s + ox, -7.8 * s + oy, 2.4 * s, 1 * s, -0.4, 0, 6.283); });
    p.circle('night', 0.9, 4.2 * s, -10.4 * s, 2.8 * s);
    p.poly('night', 0.9, [[6.4 * s, -11 * s], [9.4 * s, -10.2 * s], [6.4 * s, -9.4 * s]]);
    if (k) p.line('paper', 1, 0.5 * s, [[4.4 * s, -11 * s], [5.8 * s, -11 * s]]);
    else p.circle('paper', 1, 5 * s, -11 * s, 0.7 * s);
  });
}

export function crane(p, x, y, s, f, b, k, peck = 0) {
  withFlip(p, x, y, f, () => {
    p.ellipse('dots', 0.4, 0, 0.5, 6 * s, 1.8 * s);
    p.line('night', 0.7, 0.8 * s, [[-1.2 * s, 0], [-0.6 * s, -12 * s]]);
    p.line('night', 0.7, 0.8 * s, [[1.2 * s, 0], [0.6 * s, -12 * s]]);
    p.ellipse('paper', 1, 0, -15 * s, 7 * s, 4 * s * (1 + b * 0.04), -0.15);
    p.ellipse('night', 0.13, 0, -15 * s, 7 * s, 4 * s, -0.15);
    // dark tail bustle
    p.path('night', 0.75, (c, ox, oy) => { c.moveTo(-3 * s + ox, -17 * s + oy); c.quadraticCurveTo(-10 * s + ox, -16 * s + oy, -9 * s + ox, -11 * s + oy); c.quadraticCurveTo(-6 * s + ox, -13 * s + oy, -2 * s + ox, -13 * s + oy); });
    // neck and head, pecking bends it down
    const hx = 6 * s + peck * 3 * s, hy = -30 * s + peck * 16 * s;
    p.line('night', 0.8, 1.9 * s, [[4 * s, -17 * s], [5 * s + peck * 2 * s, -24 * s + peck * 9 * s], [hx, hy]]);
    p.line('paper', 1, 0.8 * s, [[4.5 * s, -18 * s], [5.2 * s + peck * 2 * s, -22 * s + peck * 8 * s]]);
    p.circle('night', 0.8, hx, hy, 2.1 * s);
    p.circle('orange', 1, hx - 0.4 * s, hy - 1.6 * s, 1.2 * s);
    p.poly('sun', 0.9, [[hx + 1.5 * s, hy - 0.8 * s], [hx + 7 * s, hy + 0.6 * s], [hx + 1.5 * s, hy + 0.9 * s]]);
    if (!k) p.circle('paper', 1, hx + 0.6 * s, hy - 0.4 * s, 0.55 * s);
  });
}

export function squirrel(p, x, y, s, f, b, k, flick = 0) {
  withFlip(p, x, y, f, () => {
    // big tail
    p.path('orange', 0.9, (c, ox, oy) => {
      c.moveTo(-3 * s + ox, -1 * s + oy);
      c.bezierCurveTo(-13 * s + ox, -2 * s + oy, -13 * s + ox, -18 * s - flick * 2 * s + oy, -5 * s + ox, -19 * s - flick * 3 * s + oy);
      c.bezierCurveTo(-1 * s + ox, -19 * s + oy, -2 * s + ox, -14 * s + oy, -5 * s + ox, -13 * s + oy);
      c.bezierCurveTo(-8 * s + ox, -11 * s + oy, -5 * s + ox, -5 * s + oy, -1 * s + ox, -3 * s + oy); c.closePath();
    });
    p.path('pink', 0.3, (c, ox, oy) => { c.ellipse(-8 * s + ox, -12 * s + oy, 3 * s, 5 * s, -0.3, 0, 6.283); });
    p.ellipse('orange', 0.9, 0, -5 * s, 4.6 * s, 5.4 * s * (1 + b * 0.04));
    p.ellipse('sun', 0.6, 1.5 * s, -4 * s, 2.4 * s, 3.4 * s);
    p.circle('orange', 0.9, 2.6 * s, -11.6 * s, 3.6 * s);
    p.poly('orange', 0.95, [[0.6 * s, -14 * s], [1.4 * s, -18 * s], [3 * s, -14.4 * s]]);
    p.poly('night', 0.4, [[1.1 * s, -15 * s], [1.4 * s, -17 * s], [2.2 * s, -15 * s]]);
    eye(p, 4 * s, -12.4 * s, 0.8 * s, k);
    p.circle('night', 1, 6.1 * s, -11 * s, 0.6 * s);
    // acorn in paws
    p.ellipse('sun', 1, 4.6 * s, -6.8 * s, 1.5 * s, 1.8 * s);
    p.ellipse('orange', 0.9, 4.6 * s, -8.3 * s, 1.8 * s, 0.9 * s);
  });
}

export function badger(p, x, y, s, f, b, k) {
  withFlip(p, x, y, f, () => {
    p.ellipse('dots', 0.45, 0, 0.5, 11 * s, 2.6 * s);
    p.ellipse('night', 0.55, -1 * s, -5 * s, 9 * s, 5 * s * (1 + b * 0.04));
    p.ellipse('paper', 1, -1 * s, -3.4 * s, 6 * s, 2 * s);
    p.ellipse('night', 0.2, -1 * s, -3.4 * s, 6 * s, 2 * s);
    for (const lx of [-6, -2, 2.5, 5.5]) p.line('night', 0.85, 1.8 * s, [[lx * s, -2 * s], [lx * s, 0]]);
    // head: white with two dark stripes
    p.path('paper', 1, (c, ox, oy) => { c.moveTo(5 * s + ox, -9.5 * s + oy); c.quadraticCurveTo(13 * s + ox, -7 * s + oy, 14.5 * s + ox, -3.4 * s + oy); c.quadraticCurveTo(10 * s + ox, -2 * s + oy, 5 * s + ox, -3.6 * s + oy); c.closePath(); });
    p.path('night', 0.85, (c, ox, oy) => { c.moveTo(6 * s + ox, -8.8 * s + oy); c.quadraticCurveTo(10 * s + ox, -6.8 * s + oy, 12.6 * s + ox, -4.8 * s + oy); c.lineTo(12 * s + ox, -4.2 * s + oy); c.quadraticCurveTo(9 * s + ox, -5.6 * s + oy, 5.6 * s + ox, -6.6 * s + oy); c.closePath(); });
    p.circle('night', 1, 14.4 * s, -3.6 * s, 0.9 * s);
    p.circle('paper', 1, 5.6 * s, -9.4 * s, 1.2 * s);
    if (!k) p.circle('paper', 1, 9.9 * s, -5.9 * s, 0.4 * s);
  });
}

export function dormouse(p, x, y, s, f, b, k, asleep) {
  withFlip(p, x, y, f, () => {
    p.ellipse('dots', 0.4, 0, 0.5, 6 * s, 1.8 * s);
    const br = 1 + b * (asleep ? 0.09 : 0.04);
    p.path('orange', 0.7, (c, ox, oy) => { c.moveTo(-3 * s + ox, -1 * s + oy); c.bezierCurveTo(-9 * s + ox, -1 * s + oy, -9 * s + ox, -8 * s + oy, -5 * s + ox, -9 * s + oy); c.lineTo(-4 * s + ox, -7 * s + oy); c.bezierCurveTo(-7 * s + ox, -6 * s + oy, -6 * s + ox, -2 * s + oy, -2 * s + ox, -3 * s + oy); c.closePath(); });
    p.ellipse('sun', 0.85, 0, -3.8 * s, 5 * s, 3.8 * s * br);
    p.ellipse('orange', 0.45, 0, -3.8 * s, 5 * s, 3.8 * s * br);
    p.ellipse('paper', 1, 1.5 * s, -2.2 * s, 2.6 * s, 1.4 * s);
    p.circle('sun', 0.85, 3.8 * s, -6.4 * s, 2.8 * s);
    p.circle('orange', 0.45, 3.8 * s, -6.4 * s, 2.8 * s);
    p.circle('pink', 0.55, 2.2 * s, -8.8 * s, 1.4 * s);
    p.circle('night', 1, 6.5 * s, -5.9 * s, 0.5 * s);
    if (asleep || k) p.path('night', 0.9, (c, ox, oy) => { c.arc(4.4 * s + ox, -6.9 * s + oy, 0.9 * s, 0.2, 2.9); }, 0.45 * s);
    else { p.circle('night', 1, 4.6 * s, -7 * s, 1.1 * s); p.circle('paper', 1, 4.3 * s, -7.3 * s, 0.35 * s); }
  });
}

export function hare(p, x, y, s, f, b, k, hop = 0) {
  withFlip(p, x, y, f, () => {
    const lift = hop * 8 * s;
    p.ellipse('dots', 0.45 * (1 - hop * 0.5), 0, 0.5, 8 * s * (1 - hop * 0.3), 2.2 * s);
    const c = p.c; c.save(); c.translate(0, -lift); c.rotate(-hop * 0.25);
    p.ellipse('orange', 0.6, -1 * s, -5 * s, 7 * s, 4.6 * s * (1 + b * 0.04));
    p.ellipse('night', 0.22, -1 * s, -5 * s, 7 * s, 4.6 * s);
    p.circle('paper', 1, -8 * s, -6 * s, 2 * s);
    p.ellipse('orange', 0.7, -3 * s, -1.2 * s, 4 * s, 1.4 * s);
    p.circle('orange', 0.6, 5 * s, -10 * s, 3.4 * s);
    p.circle('night', 0.2, 5 * s, -10 * s, 3.4 * s);
    // ears
    p.ellipse('orange', 0.6, 2.6 * s, -17 * s, 1.4 * s, 5 * s, -0.25);
    p.ellipse('night', 0.22, 2.6 * s, -17 * s, 1.4 * s, 5 * s, -0.25);
    p.ellipse('pink', 0.5, 2.7 * s, -17 * s, 0.6 * s, 3.6 * s, -0.25);
    p.ellipse('orange', 0.6, 4.8 * s, -16.4 * s, 1.3 * s, 4.8 * s, 0.15);
    p.ellipse('night', 0.22, 4.8 * s, -16.4 * s, 1.3 * s, 4.8 * s, 0.15);
    eye(p, 6 * s, -10.6 * s, 0.8 * s, k);
    p.circle('pink', 1, 8.2 * s, -9.4 * s, 0.6 * s);
    c.restore();
  });
}

export function heron(p, x, y, s, f, b, k, lift = 0) {
  withFlip(p, x, y, f, () => {
    p.ellipse('dots', 0.35, 0, 0.5, 5 * s, 1.5 * s);
    p.line('sun', 0.8, 0.8 * s, [[0, 0], [0, -13 * s]]);
    p.line('orange', 0.3, 0.8 * s, [[0, 0], [0, -13 * s]]);
    if (lift < 0.5) p.line('sun', 0.8, 0.8 * s, [[1.4 * s, -7 * s], [0.4 * s, -13 * s]]);
    else p.line('sun', 0.8, 0.8 * s, [[0.4 * s, -13 * s], [3 * s, -10 * s], [0.6 * s, -9 * s]]);
    p.ellipse('blue', 0.45, -1 * s, -16 * s, 6 * s, 3.6 * s * (1 + b * 0.04), 0.35);
    p.ellipse('night', 0.2, -2 * s, -15 * s, 5 * s, 2.4 * s, 0.35);
    p.path('blue', 0.45, (c, ox, oy) => { c.moveTo(3 * s + ox, -18 * s + oy); c.bezierCurveTo(0 * s + ox, -22 * s + oy, 6 * s + ox, -24 * s + oy, 3 * s + ox, -28 * s + oy); }, 1.8 * s);
    p.circle('paper', 1, 3.5 * s, -28.6 * s, 2 * s);
    p.circle('blue', 0.35, 3.5 * s, -28.6 * s, 2 * s);
    p.line('night', 0.8, 0.7 * s, [[2 * s, -29.4 * s], [-3.5 * s, -28.2 * s]]);
    p.poly('sun', 0.95, [[5 * s, -29.2 * s], [11 * s, -28.4 * s], [5 * s, -27.8 * s]]);
    if (!k) p.circle('night', 1, 4.2 * s, -29 * s, 0.5 * s);
  });
}

export function swan(p, x, y, s, f, b, k, black) {
  withFlip(p, x, y, f, () => {
    const body = black ? 'night' : 'paper', a = black ? 0.85 : 1;
    p.ellipse('blue', 0.25, 0, 0.6, 9 * s, 2 * s);
    p.path(body, a, (c, ox, oy) => {
      c.moveTo(-8 * s + ox, -4 * s + oy);
      c.quadraticCurveTo(-9 * s + ox, 0.5 * s + oy, -2 * s + ox, 0.5 * s + oy);
      c.lineTo(5 * s + ox, 0.5 * s + oy);
      c.quadraticCurveTo(8 * s + ox, -1 * s + oy, 6 * s + ox, -4 * s + oy);
      c.quadraticCurveTo(0 + ox, -6.5 * s * (1 + b * 0.04) + oy, -8 * s + ox, -4 * s + oy); c.closePath();
    });
    if (!black) p.path('blue', 0.2, (c, ox, oy) => { c.ellipse(-2 * s + ox, -2.6 * s + oy, 4.5 * s, 1.8 * s, -0.1, 0, 6.283); });
    p.path(body, a, (c, ox, oy) => { c.moveTo(4 * s + ox, -3 * s + oy); c.bezierCurveTo(8 * s + ox, -6 * s + oy, 2 * s + ox, -11 * s + oy, 5 * s + ox, -14 * s + oy); }, 2 * s);
    p.circle(body, a, 5.6 * s, -14 * s, 1.9 * s);
    p.poly(black ? 'pink' : 'orange', 1, [[7 * s, -14.8 * s], [10.4 * s, -13.2 * s], [7 * s, -12.8 * s]]);
    if (!black) p.circle('night', 0.8, 7.1 * s, -13.8 * s, 0.8 * s);
    if (!k) p.circle(black ? 'paper' : 'night', 1, 5.6 * s, -14.6 * s, 0.45 * s);
  });
}

export function vole(p, x, y, s, f, b, k, peek = 1) {
  withFlip(p, x, y, f, () => {
    const c = p.c; c.save(); c.beginPath(); c.rect(-10 * s, -20 * s, 20 * s, 20 * s); c.clip();
    c.translate(0, (1 - peek) * 9 * s);
    p.ellipse('orange', 0.55, 0, -3.5 * s, 4.2 * s, 4 * s * (1 + b * 0.05));
    p.ellipse('night', 0.3, 0, -3.5 * s, 4.2 * s, 4 * s);
    p.circle('orange', 0.55, 3 * s, -6.4 * s, 2.8 * s);
    p.circle('night', 0.3, 3 * s, -6.4 * s, 2.8 * s);
    p.circle('pink', 0.6, 1.4 * s, -8.6 * s, 1.1 * s);
    eye(p, 4 * s, -7 * s, 0.7 * s, k);
    p.circle('pink', 1, 5.8 * s, -6 * s, 0.55 * s);
    c.restore();
  });
}

export function beaver(p, x, y, s, f, b, k, slap = 0) {
  withFlip(p, x, y, f, () => {
    p.ellipse('dots', 0.45, 0, 0.5, 10 * s, 2.4 * s);
    // flat tail
    p.path('night', 0.65, (c, ox, oy) => { c.save(); c.translate(-6 * s + ox, -1.5 * s + oy); c.rotate(-slap * 0.5); c.ellipse(-5 * s, 0, 5 * s, 1.8 * s, 0, 0, 6.283); c.restore(); });
    p.ellipse('orange', 0.75, 0, -5.4 * s, 7.4 * s, 5.4 * s * (1 + b * 0.04));
    p.ellipse('night', 0.35, 0, -5.4 * s, 7.4 * s, 5.4 * s);
    p.circle('orange', 0.75, 6 * s, -9.4 * s, 3.8 * s);
    p.circle('night', 0.35, 6 * s, -9.4 * s, 3.8 * s);
    p.circle('orange', 0.9, 3.6 * s, -12.6 * s, 1.1 * s);
    p.ellipse('sun', 0.5, 8.6 * s, -8.2 * s, 2 * s, 1.6 * s);
    p.poly('paper', 1, [[8.2 * s, -6.9 * s], [9.6 * s, -6.9 * s], [9.4 * s, -5.2 * s], [8.4 * s, -5.2 * s]]);
    p.circle('night', 1, 10 * s, -9 * s, 0.8 * s);
    eye(p, 6.8 * s, -10.6 * s, 0.75 * s, k);
  });
}

/* A fox. Sitting, the tail sweeps with swish (-1..1); curled, it sleeps. */
export function fox(p, x, y, s, f, b, k, swish = 0, curled = false) {
  withFlip(p, x, y, f, () => {
    p.ellipse('dots', 0.45, 0, 0.5, 10 * s, 2.4 * s);
    if (curled) {
      const br = 1 + b * 0.07;
      p.ellipse('orange', 0.95, -0.5 * s, -3.4 * s * br, 8 * s, 3.8 * s * br);
      p.ellipse('pink', 0.3, -0.5 * s, -3.4 * s * br, 8 * s, 3.8 * s * br);
      // the tail wraps round the front, its tip white
      p.path('orange', 0.95, (c, ox, oy) => { c.moveTo(-7 * s + ox, -2 * s + oy); c.quadraticCurveTo(-6 * s + ox, 1.2 * s + oy, 2 * s + ox, 0.6 * s + oy); c.quadraticCurveTo(7 * s + ox, 0.2 * s + oy, 8.5 * s + ox, -1.6 * s + oy); c.quadraticCurveTo(4 * s + ox, -0.8 * s + oy, -4 * s + ox, -1.4 * s + oy); c.closePath(); });
      p.ellipse('paper', 1, 7.4 * s, -1.2 * s, 1.8 * s, 1 * s, -0.3);
      // head resting on the tail
      p.circle('orange', 0.95, 4.6 * s, -3.4 * s, 3 * s);
      p.circle('pink', 0.3, 4.6 * s, -3.4 * s, 3 * s);
      p.poly('orange', 0.95, [[2.6 * s, -5.4 * s], [3.4 * s, -8.4 * s], [4.8 * s, -5.8 * s]]);
      p.poly('night', 0.5, [[3 * s, -6.8 * s], [3.4 * s, -8.4 * s], [3.9 * s, -7 * s]]);
      p.poly('paper', 1, [[5.6 * s, -2.4 * s], [9.6 * s, -2.2 * s], [6 * s, -1 * s]]);
      p.circle('night', 1, 9.6 * s, -2.3 * s, 0.6 * s);
      p.path('night', 0.9, (c, ox, oy) => { c.arc(5.4 * s + ox, -3.9 * s + oy, 0.9 * s, 0.3, 2.8); }, 0.45 * s);
      return;
    }
    // tail sweeping behind
    p.path('orange', 0.95, (c, ox, oy) => {
      c.moveTo(-3 * s + ox, -1.4 * s + oy);
      c.bezierCurveTo(-9 * s + ox, -0.5 * s + oy, -12 * s + ox, -4 * s + swish * 3 * s + oy, -11 * s + ox, -8 * s + swish * 4 * s + oy);
      c.bezierCurveTo(-9 * s + ox, -5 * s + swish * 2 * s + oy, -6 * s + ox, -3.6 * s + oy, -2 * s + ox, -4 * s + oy); c.closePath();
    });
    p.circle('paper', 1, -10.8 * s, -7.6 * s + swish * 4 * s, 1.5 * s);
    p.ellipse('orange', 0.95, 0, -5.6 * s, 4.4 * s, 5.8 * s * (1 + b * 0.04));
    p.ellipse('pink', 0.28, 0, -5.6 * s, 4.4 * s, 5.8 * s * (1 + b * 0.04));
    p.ellipse('paper', 1, 1.8 * s, -5.4 * s, 2 * s, 3.4 * s);
    p.line('orange', 0.95, 1.6 * s, [[1 * s, -1.2 * s], [1.2 * s, 0.2 * s]]);
    p.line('night', 0.8, 1.6 * s, [[1.2 * s, -0.2 * s], [1.3 * s, 0.4 * s]]);
    p.line('orange', 0.95, 1.6 * s, [[3 * s, -1.2 * s], [3.2 * s, 0.2 * s]]);
    p.line('night', 0.8, 1.6 * s, [[3.2 * s, -0.2 * s], [3.3 * s, 0.4 * s]]);
    // head
    p.circle('orange', 0.95, 2.6 * s, -12.4 * s, 3.4 * s);
    p.circle('pink', 0.28, 2.6 * s, -12.4 * s, 3.4 * s);
    p.poly('orange', 0.95, [[0.4 * s, -14.4 * s], [0.8 * s, -18.4 * s], [2.9 * s, -15.4 * s]]);
    p.poly('orange', 0.95, [[3 * s, -15.2 * s], [4.4 * s, -18.6 * s], [5.4 * s, -14.4 * s]]);
    p.poly('night', 0.5, [[0.7 * s, -16.4 * s], [0.8 * s, -18.4 * s], [1.8 * s, -16.8 * s]]);
    p.poly('night', 0.5, [[3.9 * s, -17 * s], [4.4 * s, -18.6 * s], [4.9 * s, -16.4 * s]]);
    p.poly('paper', 1, [[3.6 * s, -11.4 * s], [9 * s, -11.2 * s], [4.4 * s, -9.6 * s]]);
    p.poly('orange', 0.95, [[3.6 * s, -12.6 * s], [9 * s, -11.4 * s], [3.8 * s, -11 * s]]);
    p.circle('night', 1, 9 * s, -11.3 * s, 0.7 * s);
    eye(p, 4.2 * s, -13.2 * s, 0.75 * s, k);
  });
}

export function owl(p, x, y, s, f, b, k, night) {
  withFlip(p, x, y, f, () => {
    const body = night ? 'blue' : 'sun', a = night ? 0.8 : 0.95;
    p.ellipse(body, a, 0, -6 * s, 5 * s, 6.2 * s * (1 + b * 0.04));
    p.ellipse(night ? 'night' : 'orange', night ? 0.45 : 0.45, 0, -6 * s, 5 * s, 6.2 * s);
    p.ellipse('paper', 1, 0, -4 * s, 3 * s, 3.4 * s);
    p.ellipse(body, 0.35, 0, -4 * s, 3 * s, 3.4 * s);
    for (let n = 0; n < 3; n++) p.path(night ? 'night' : 'orange', 0.6, (c, ox, oy) => { c.arc(ox + (n - 1) * 1.4 * s, oy - (3 + (n % 2)) * s, 0.8 * s, 0.3, 2.8); }, 0.4 * s);
    p.poly(body, a, [[-4.6 * s, -9.6 * s], [-3 * s, -13.4 * s], [-1.6 * s, -10.2 * s]]);
    p.poly(body, a, [[4.6 * s, -9.6 * s], [3 * s, -13.4 * s], [1.6 * s, -10.2 * s]]);
    p.circle('paper', 1, -1.9 * s, -8.6 * s, 2 * s);
    p.circle('paper', 1, 1.9 * s, -8.6 * s, 2 * s);
    if (k) { p.line('night', 1, 0.7 * s, [[-3.2 * s, -8.6 * s], [-0.6 * s, -8.6 * s]]); p.line('night', 1, 0.7 * s, [[0.6 * s, -8.6 * s], [3.2 * s, -8.6 * s]]); }
    else { p.circle('night', 1, -1.7 * s, -8.5 * s, 1.1 * s); p.circle('night', 1, 1.7 * s, -8.5 * s, 1.1 * s); p.circle('paper', 1, -2 * s, -8.9 * s, 0.35 * s); p.circle('paper', 1, 1.4 * s, -8.9 * s, 0.35 * s); }
    p.poly('orange', 1, [[-0.7 * s, -7.4 * s], [0.7 * s, -7.4 * s], [0, -5.8 * s]]);
    p.line('orange', 1, 0.7 * s, [[-1.2 * s, 0], [-1.2 * s, -0.8 * s]]);
    p.line('orange', 1, 0.7 * s, [[1.2 * s, 0], [1.2 * s, -0.8 * s]]);
  });
}
