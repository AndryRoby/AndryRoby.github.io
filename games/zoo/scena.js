/* Little Island Zoo: the island, its seven habitats, the animals and the visitors.
   Drawn in code with the Puzzle Village pen (risograph inks, multiply, a hair off
   register) and its animals. No images, no randomness: every leaf and every walk
   comes from a seeded hash, so the same park prints the same way on every screen. */
import { iso, RX, RY, box, faceJ, faceI, cottage, tree, bush, flowers, stone, signpost,
  hedgehog, otter, magpie, crane, squirrel, badger, dormouse, hare, heron, swan, vole, beaver, owl, fox } from '../village/iso.js?v=3';
import { hash } from '../village/riso.js?v=3';

const TAU = Math.PI * 2;
const { sin, cos, min, max, abs, hypot, floor, atan2, exp, sqrt } = Math;

/* ── The island in tiles ─────────────────────────────────────────────────── */
export const C = [6, 6];
export const RING = 1.8;                    // the path round the visitor hut
export const PLOT_R = 3.7;                  // how far the habitats stand from the middle
export const PLOT_W = 2.1;                  // a habitat is a square this many tiles wide
export const DEPTH = 58;                    // the island's soil side, in world units
/* where each habitat stands, by tier: the cheap ones nearest the gate, in front */
const ANGLES = [90, 0, 135, 315, 180, 270, 225].map(d => d * Math.PI / 180);
const GATE = Math.PI / 4;                   // the gate faces the viewer

export function plotCenter(k) { return [C[0] + cos(ANGLES[k]) * PLOT_R, C[1] + sin(ANGLES[k]) * PLOT_R]; }
/* the donation box stands at the habitat's edge that faces the path */
export function boxAt(k) {
  const a = ANGLES[k], r = PLOT_R - PLOT_W * 0.5 - 0.15;
  return [C[0] + cos(a) * r - sin(a) * 0.45, C[1] + sin(a) * r + cos(a) * 0.45];
}

export function edgeR(th, seed) {
  const a = hash(seed, 1) * TAU, b = hash(seed, 2) * TAU, c = hash(seed, 3) * TAU;
  return 5.95 + 0.26 * sin(3 * th + a) + 0.17 * sin(5 * th + b) + 0.1 * sin(9 * th + c);
}
function onIsland(i, j, seed, m = 0) { const di = i - C[0], dj = j - C[1]; return hypot(di, dj) < edgeR(atan2(dj, di), seed) - m; }

/* ── Habitat kinds: what the ground looks like and how its animals are drawn ── */
const WATER = new Set(['otters', 'beavers', 'swans', 'herons', 'cranes']);
export const DRUH = {
  hedgehogs: { s: 1.45, kresli: (p, x, y, s, f, b, k, g) => hedgehog(p, x, y - g * 5, s, f, b, k) },
  voles:     { s: 1.6,  kresli: (p, x, y, s, f, b, k, g, t, n) => vole(p, x, y, s, f, b, k, max(g, 0.55 + 0.45 * sin(t * 0.9 + n * 2.1))) },
  hares:     { s: 1.35, kresli: (p, x, y, s, f, b, k, g) => hare(p, x, y, s, f, b, k, g) },
  squirrels: { s: 1.3,  kresli: (p, x, y, s, f, b, k, g, t, n) => squirrel(p, x, y, s, f, b, k, max(g, 0.5 + 0.5 * sin(t * 2.3 + n))) },
  dormice:   { s: 1.5,  kresli: (p, x, y, s, f, b, k, g, t, n) => dormouse(p, x, y, s, f, b, k, g < 0.05 && ((t * 0.07 + n * 0.31) % 1) < 0.45) },
  badgers:   { s: 1.2,  kresli: (p, x, y, s, f, b, k, g) => badger(p, x, y - g * 3, s, f, b, k) },
  foxes:     { s: 1.25, kresli: (p, x, y, s, f, b, k, g, t, n) => fox(p, x, y, s, f, b, k, sin(t * 1.6 + n) * 0.8 + g * 0.2, g < 0.05 && n === 1) },
  magpies:   { s: 1.3,  kresli: (p, x, y, s, f, b, k, g, t, n) => magpie(p, x, y - g * 8, s, f, b, k, sin(t * 3 + n) * 0.5 + g) },
  otters:    { s: 1.2,  kresli: (p, x, y, s, f, b, k, g, t, n, voda) => otter(p, x, y - g * 4, s, f, b, k, voda) },
  herons:    { s: 1.05, kresli: (p, x, y, s, f, b, k, g) => heron(p, x, y, s, f, b, k, g) },
  beavers:   { s: 1.2,  kresli: (p, x, y, s, f, b, k, g, t, n) => beaver(p, x, y, s, f, b, k, max(g, ((t * 0.3 + n * 0.37) % 1) < 0.08 ? 1 : 0)) },
  cranes:    { s: 1.0,  kresli: (p, x, y, s, f, b, k, g, t, n) => crane(p, x, y, s, f, b, k, max(g, 0.5 + 0.5 * sin(t * 1.1 + n * 1.7))) },
  swans:     { s: 1.2,  kresli: (p, x, y, s, f, b, k, g, t, n) => swan(p, x, y, s, f, b, k, n === 2) },
  owls:      { s: 1.35, kresli: (p, x, y, s, f, b, k, g) => owl(p, x, y - g * 4, s, f, b, k, false) }
};
export function jeVoda(id) { return WATER.has(id); }

/* ── Small drawing helpers ───────────────────────────────────────────────── */
function quad(i0, j0, w, d, h = 0) { return [iso(i0, j0, h), iso(i0 + w, j0, h), iso(i0 + w, j0 + d, h), iso(i0, j0 + d, h)]; }
function curve(c, pts, ox, oy) {
  c.moveTo(pts[0][0] + ox, pts[0][1] + oy);
  for (let k = 1; k < pts.length - 1; k++) {
    const mx = (pts[k][0] + pts[k + 1][0]) / 2, my = (pts[k][1] + pts[k + 1][1]) / 2;
    c.quadraticCurveTo(pts[k][0] + ox, pts[k][1] + oy, mx + ox, my + oy);
  }
  const L = pts[pts.length - 1]; c.lineTo(L[0] + ox, L[1] + oy);
}
function ringPts(r, n = 48) { const out = []; for (let k = 0; k <= n; k++) { const a = k / n * TAU; out.push(iso(C[0] + cos(a) * r, C[1] + sin(a) * r)); } return out; }
function mound(p, X, Y, w, h, ink = 'green') {
  const shape = (c, ox, oy) => {
    c.moveTo(X - w + ox, Y + oy);
    c.bezierCurveTo(X - w * 0.9 + ox, Y - h * 0.8 + oy, X - w * 0.3 + ox, Y - h + oy, X + ox, Y - h + oy);
    c.bezierCurveTo(X + w * 0.45 + ox, Y - h + oy, X + w * 0.9 + ox, Y - h * 0.6 + oy, X + w + ox, Y + oy);
    c.quadraticCurveTo(X + ox, Y + h * 0.42 + oy, X - w + ox, Y + oy);
  };
  p.ellipse('dots', 0.5, X + w * 0.25, Y + h * 0.18, w * 1.05, h * 0.36);
  p.path('paper', 1, shape);
  p.path(ink, 0.7, shape);
  p.path('sun', 0.25, shape);
  p.ellipse('sun', 0.3, X - w * 0.35, Y - h * 0.7, w * 0.3, h * 0.16, -0.2);
}
function hole(p, x, y, r = 5) { p.ellipse('night', 0.8, x, y, r, r * 0.55); p.ellipse('orange', 0.4, x, y - r * 0.2, r * 1.25, r * 0.5); }
function pond(p, ci, cj, ri, rj, reeds = true, seed = 1) {
  const [x, y] = iso(ci, cj);
  p.ellipse('paper', 1, x, y, ri * RX + 5, rj * RY + 3);
  p.ellipse('sun', 0.45, x, y, ri * RX + 5, rj * RY + 3);
  p.ellipse('paper', 1, x, y, ri * RX, rj * RY);
  p.ellipse('blue', 0.58, x, y, ri * RX, rj * RY);
  p.ellipse('teal', 0.14, x, y, ri * RX, rj * RY);
  p.ellipse('blue', 0.2, x + 3, y + 2, ri * RX * 0.6, rj * RY * 0.55);
  p.path('paper', 0.7, (c, ox, oy) => c.ellipse(x - ri * RX * 0.3 + ox, y - rj * RY * 0.25 + oy, ri * RX * 0.25, rj * RY * 0.12, 0, 0.3, 2.6), 1);
  if (reeds) for (let k = 0; k < 5; k++) {
    const a = 2.2 + k * 0.5 + hash(seed, k) * 0.3, rx = x + cos(a) * (ri * RX + 2), ry = y + sin(a) * (rj * RY + 1);
    reedTuft(p, rx, ry);
  }
}
function reedTuft(p, x, y) {
  for (let k = 0; k < 4; k++) { const dx = (k - 1.5) * 2.4, h = 9 + (k % 2) * 4; p.line('green', 0.85, 1, [[x + dx, y], [x + dx + (k - 1.5) * 0.9, y - h]]); }
  p.ellipse('orange', 0.85, x + 1.4, y - 12, 1.1, 3);
}
function post(p, x, y, h, ink = 'orange') { p.line(ink, 0.9, 2, [[x, y], [x, y - h]], 'butt'); p.line('night', 0.3, 2, [[x + 0.7, y], [x + 0.7, y - h]], 'butt'); }

/* ── One habitat's ground and furniture (static, printed once) ───────────── */
function plotGround(p, k, ink, a) {
  const [ci, cj] = plotCenter(k), h = PLOT_W / 2;
  const q = quad(ci - h, cj - h, PLOT_W, PLOT_W);
  p.poly(ink, a, q);
  // a soft border of stones and tufts instead of a fence: nobody is locked in
  for (let n = 0; n < 10; n++) {
    const f = n / 10, side = n % 4;
    const e = [[ci - h + f * PLOT_W * 1.0, cj - h], [ci + h, cj - h + f * PLOT_W], [ci + h - f * PLOT_W, cj + h], [ci - h, cj + h - f * PLOT_W]][side];
    const [x, y] = iso(e[0], e[1]);
    if (hash(k * 31 + n, 7) < 0.5) stone(p, x, y, 0.55 + hash(k, n) * 0.35);
    else p.line('green', 0.7, 0.9, [[x - 2.5, y - 2.5], [x - 1, y + 0.5], [x, y - 3.2], [x + 1, y + 0.5], [x + 2.5, y - 2.5]]);
  }
}
const HABITAT = {
  hedgehogs(p, k, ci, cj) {
    plotGround(p, k, 'orange', 0.14);
    for (let n = 0; n < 14; n++) { const [x, y] = iso(ci - 0.8 + hash(k, n) * 1.6, cj - 0.8 + hash(n, k + 3) * 1.6); p.ellipse(n % 3 ? 'orange' : 'sun', 0.55, x, y, 2.2, 1.1, hash(n, 9) * 3); }
    const [bx, by] = iso(ci - 0.55, cj - 0.75); bush(p, bx, by, 1.1); const [cx2, cy2] = iso(ci - 0.9, cj - 0.2); bush(p, cx2, cy2, 0.9, 'teal');
    const [lx, ly] = iso(ci + 0.35, cj - 0.55); mound(p, lx, ly, 13, 7, 'orange');
  },
  voles(p, k, ci, cj) {
    plotGround(p, k, 'green', 0.18);
    const [x, y] = iso(ci - 0.35, cj - 0.45); mound(p, x, y, 26, 13);
    for (const [u, v] of [[-0.2, 0.2], [0.45, -0.1], [0.1, 0.55], [-0.55, -0.35]]) { const [hx, hy] = iso(ci + u, cj + v); hole(p, hx, hy, 3.6); }
    flowers(p, ...iso(ci + 0.6, cj + 0.6), k * 11, 4);
  },
  hares(p, k, ci, cj) {
    plotGround(p, k, 'green', 0.24);
    for (let n = 0; n < 26; n++) { const [x, y] = iso(ci - 0.9 + hash(k + 5, n) * 1.8, cj - 0.9 + hash(n, k + 8) * 1.8); p.circle(n % 4 ? 'paper' : 'pink', 0.95, x, y - 1, 1.2); p.circle('green', 0.6, x + 1.4, y, 1); }
    const [bx, by] = iso(ci - 0.75, cj - 0.8); bush(p, bx, by, 1);
  },
  squirrels(p, k, ci, cj) {
    plotGround(p, k, 'green', 0.16);
    for (let n = 0; n < 6; n++) { const [x, y] = iso(ci - 0.7 + hash(k, n + 20) * 1.4, cj - 0.7 + hash(n + 20, k) * 1.4); p.ellipse('sun', 1, x, y, 1.4, 1.7); p.ellipse('orange', 0.9, x, y - 1.4, 1.7, 0.8); }
    const [tx, ty] = iso(ci - 0.35, cj - 0.45); tree(p, tx, ty, 1.35, 'round', k * 7 + 3);
    p.ellipse('night', 0.75, tx, ty - 14, 2.2, 3);
    const [t2, u2] = iso(ci + 0.55, cj - 0.7); tree(p, t2, u2, 0.95, 'autumn', k * 7 + 5);
  },
  dormice(p, k, ci, cj) {
    plotGround(p, k, 'green', 0.2);
    for (const [u, v, s, ink] of [[-0.6, -0.6, 1.2, 'green'], [0.2, -0.8, 1.05, 'teal'], [-0.85, 0.15, 0.95, 'green'], [0.6, -0.2, 0.8, 'green']]) {
      const [x, y] = iso(ci + u, cj + v); bush(p, x, y, s, ink);
      for (let n = 0; n < 3; n++) p.circle('sun', 0.95, x - 4 + n * 4, y - 6 - (n % 2) * 3, 1.3);
    }
  },
  badgers(p, k, ci, cj) {
    plotGround(p, k, 'orange', 0.1);
    const [x, y] = iso(ci - 0.3, cj - 0.4); mound(p, x, y, 34, 17);
    for (const [u, v] of [[-0.45, 0.05], [0.25, -0.05]]) { const [hx, hy] = iso(ci + u, cj + v); hole(p, hx, hy - 2, 5.5); }
    const [bx, by] = iso(ci + 0.75, cj - 0.7); bush(p, bx, by, 0.9);
  },
  foxes(p, k, ci, cj) {
    plotGround(p, k, 'orange', 0.12);
    const [tx, ty] = iso(ci - 0.45, cj - 0.55); tree(p, tx, ty, 1.25, 'pine', k * 9);
    // roots over the den
    for (let n = 0; n < 4; n++) p.path('orange', 0.8, (c, ox, oy) => { c.moveTo(tx - 2 + ox, ty - 2 + oy); c.quadraticCurveTo(tx + 4 + n * 3 + ox, ty - 3 + oy, tx + 6 + n * 4 + ox, ty + 3 + n + oy); }, 1.6);
    hole(p, tx + 9, ty + 4, 6);
    flowers(p, ...iso(ci + 0.6, cj + 0.5), k * 5, 5, ['sun', 'paper', 'pink']);
  },
  magpies(p, k, ci, cj) {
    plotGround(p, k, 'green', 0.16);
    for (const [u, v, h] of [[-0.5, -0.5, 38], [0.4, -0.7, 30]]) {
      const [x, y] = iso(ci + u, cj + v); post(p, x, y, h);
      p.ellipse('orange', 0.85, x, y - h - 2, 7, 3.5); p.ellipse('night', 0.35, x, y - h - 2, 7, 3.5); p.ellipse('orange', 0.9, x, y - h - 4, 5, 2);
    }
    const [bx, by] = iso(ci + 0.7, cj + 0.2); bush(p, bx, by, 0.9);
  },
  otters(p, k, ci, cj) { plotGround(p, k, 'green', 0.14); pond(p, ci, cj, 0.95, 0.8, true, k); const [x, y] = iso(ci - 0.95, cj - 0.7); p.path('orange', 0.7, (c, ox, oy) => { c.moveTo(x - 6 + ox, y - 12 + oy); c.quadraticCurveTo(x + 6 + ox, y - 6 + oy, x + 14 + ox, y + 4 + oy); }, 4); },
  herons(p, k, ci, cj) { plotGround(p, k, 'green', 0.18); pond(p, ci + 0.1, cj + 0.1, 0.85, 0.7, true, k + 2); for (let n = 0; n < 3; n++) { const [x, y] = iso(ci - 0.9 + n * 0.3, cj - 0.85); reedTuft(p, x, y); } },
  beavers(p, k, ci, cj) {
    plotGround(p, k, 'green', 0.14); pond(p, ci, cj, 0.95, 0.85, false, k);
    const [x, y] = iso(ci - 0.3, cj - 0.35);
    for (let n = 0; n < 9; n++) p.line(n % 2 ? 'orange' : 'night', n % 2 ? 0.85 : 0.4, 2.2, [[x - 12 + hash(n, 3) * 6, y - hash(n, 4) * 10], [x + 6 + hash(n, 5) * 8, y - 3 - hash(n, 6) * 12]]);
  },
  cranes(p, k, ci, cj) { plotGround(p, k, 'green', 0.2); pond(p, ci + 0.2, cj - 0.1, 0.7, 0.6, true, k + 4); for (let n = 0; n < 5; n++) { const [x, y] = iso(ci - 0.85 + hash(n, k) * 0.5, cj + 0.3 + hash(k, n) * 0.5); reedTuft(p, x, y); } },
  swans(p, k, ci, cj) { plotGround(p, k, 'green', 0.12); pond(p, ci, cj, 1.0, 0.9, true, k + 6); },
  owls(p, k, ci, cj) {
    plotGround(p, k, 'green', 0.2);
    const [tx, ty] = iso(ci - 0.45, cj - 0.5); tree(p, tx, ty, 1.4, 'round', k * 3 + 1);
    const [t2, u2] = iso(ci + 0.5, cj - 0.6); tree(p, t2, u2, 1.1, 'pine', k * 3 + 2);
    p.ellipse('night', 0.8, tx + 2, ty - 16, 2.4, 3.2);
  }
};

/* where the animals of a water habitat swim, in tiles */
export function vodaPlochy(id, k) {
  const [ci, cj] = plotCenter(k);
  if (id === 'herons') return [ci + 0.1, cj + 0.1, 0.62, 0.5];
  if (id === 'cranes') return [ci + 0.2, cj - 0.1, 0.5, 0.42];
  return [ci, cj, 0.72, 0.62];
}

/* ── Build the world once per island ────────────────────────────────────── */
export function postav(ostrovIndex) {
  const seed = 7 + ostrovIndex * 13;
  const W = { seed };
  const N = 120, top = [];
  for (let k = 0; k < N; k++) { const th = k / N * TAU, r = edgeR(th, seed); top.push(iso(C[0] + cos(th) * r, C[1] + sin(th) * r)); }
  W.top = top;
  let L = 0, R = 0;
  top.forEach((q, k) => { if (q[0] < top[L][0]) L = k; if (q[0] > top[R][0]) R = k; });
  const chain = [];
  for (let k = R; ; k = (k + 1) % N) { chain.push(top[k]); if (k === L) break; }
  W.chain = chain;
  W.drip = chain.map((q, k) => [q[0], q[1] + DEPTH + (k % 3 === 0 ? 8 + hash(k, seed) * 16 : hash(k, 9) * 6)]);
  const xs = top.map(q => q[0]), ys = top.map(q => q[1]).concat(W.drip.map(q => q[1]));
  W.bb = { x0: min(...xs) - 30, y0: min(...ys) - 70, x1: max(...xs) + 30, y1: max(...ys) + 20 };
  // paths: the ring round the hut, a spoke to every habitat, one to the gate
  W.ring = ringPts(RING);
  W.spokes = ANGLES.map(a => [iso(C[0] + cos(a) * RING, C[1] + sin(a) * RING), iso(C[0] + cos(a) * (PLOT_R - PLOT_W * 0.55), C[1] + sin(a) * (PLOT_R - PLOT_W * 0.55))]);
  const ge = edgeR(GATE, seed) - 0.35;
  W.gatePath = [iso(C[0] + cos(GATE) * RING, C[1] + sin(GATE) * RING), iso(C[0] + cos(GATE) * ge, C[1] + sin(GATE) * ge)];
  W.gate = [C[0] + cos(GATE) * (ge - 0.55), C[1] + sin(GATE) * (ge - 0.55)];
  // trees and flowers wherever no habitat, path or hut stands
  const deco = [];
  for (let gi = 0; gi < 20; gi++) for (let gj = 0; gj < 20; gj++) {
    const i = gi * 0.68 - 0.6 + hash(gi + seed, gj) * 0.5, j = gj * 0.68 - 0.6 + hash(gj, gi + seed) * 0.5;
    if (!onIsland(i, j, seed, 0.55)) continue;
    const dc = hypot(i - C[0], j - C[1]);
    if (abs(dc - RING) < 0.55 || dc < RING + 0.2) continue;
    let near = 99;
    for (let k = 0; k < 7; k++) { const [pi, pj] = plotCenter(k); near = min(near, max(abs(i - pi), abs(j - pj)) - PLOT_W / 2); }
    if (near < 0.35) continue;
    const a = atan2(j - C[1], i - C[0]);
    let spoke = 99;
    for (const s of ANGLES.concat([GATE])) { const da = abs(((a - s + Math.PI * 3) % TAU) - Math.PI); spoke = min(spoke, da * dc); }
    if (spoke < 0.5) continue;
    const roll = hash(gi * 3 + seed, gj * 5 + 1), [x, y] = iso(i, j);
    const edge = !onIsland(i, j, seed, 1.4);
    if (roll < (edge ? 0.5 : 0.22)) deco.push({ y, draw: p => tree(p, x, y, 0.75 + hash(gi, gj + seed) * 0.35, hash(gi + 2, gj) < 0.3 ? 'pine' : hash(gi, gj + 4) < 0.15 ? 'fruit' : 'round', gi * 40 + gj) });
    else if (roll < 0.36) deco.push({ y, draw: p => bush(p, x, y, 0.7 + hash(gj, gi) * 0.35, hash(gi, gj) < 0.25 ? 'teal' : 'green') });
    else if (roll < 0.5) deco.push({ y, draw: p => flowers(p, x, y, gi * 30 + gj + seed, 4) });
  }
  W.deco = deco;
  W.hut = { i: C[0] - 0.55, j: C[1] - 0.55 };
  // the walk of the visitors: the ring, sampled
  W.walk = [];
  for (let k = 0; k < 96; k++) { const a = k / 96 * TAU; W.walk.push([C[0] + cos(a) * RING, C[1] + sin(a) * RING]); }
  return W;
}

/* Tieňová strana ostrova vpravo: plynulý prechod okolo stredu (bez zvislého švu), vpravo plná sila. */
function tienVpravo(p, c, a, bb) {
  const w = bb.x1 - bb.x0, x0 = -w * 0.24, x1 = w * 0.24, n = 24, h = bb.y1 - bb.y0 + 200;
  for (let k = 0; k < n; k++) {
    const xa = x0 + ((x1 - x0) * k) / n, t = (k + 0.5) / n;
    p.ink('blue', a * t * t * (3 - 2 * t)); c.fillRect(xa, bb.y0, (x1 - x0) / n + 0.5, h);
  }
  p.ink('blue', a); c.fillRect(x1, bb.y0, bb.x1 + 200 - x1, h);
}

/* ── The static print ───────────────────────────────────────────────────── */
/* plots: [{ id, stav: 'built' | 'next' | 'empty' }] by tier; skip = a tier drawn as a sprite now */
export function kresliStaticke(p, W, plots, skip = -1) {
  const c = p.c, bb = W.bb;
  p.ink('paper', 1); c.fillRect(bb.x0 - 400, bb.y0 - 400, bb.x1 - bb.x0 + 800, bb.y1 - bb.y0 + 800);
  // soil side of the island
  const band = new Path2D();
  band.moveTo(W.chain[0][0], W.chain[0][1]);
  for (const q of W.chain) band.lineTo(q[0], q[1]);
  for (let k = W.drip.length - 1; k >= 0; k--) band.lineTo(W.drip[k][0], W.drip[k][1]);
  band.closePath();
  c.save(); c.clip(band);
  p.ink('orange', 0.6); c.fill(band);
  p.ink('pink', 0.18); c.fill(band);
  for (const [off, w, ink, a] of [[3, 7, 'green', 0.85], [20, 3, 'night', 0.14], [34, 6, 'orange', 0.3], [48, 26, 'nightdots', 0.5]]) { p.ink(ink, a); p.strokePts(W.chain.map(q => [q[0], q[1] + off]), w); }
  tienVpravo(p, c, 0.26, bb);
  c.restore();
  for (let k = 3; k < W.drip.length; k += 9) { const q = W.drip[k], l = 8 + hash(k, 1) * 18; p.line('orange', 0.55, 1, [[q[0], q[1] - 4], [q[0] + 3, q[1] + l * 0.5], [q[0] - 1, q[1] + l]]); }
  // grass
  const topP = new Path2D();
  W.top.forEach((q, k) => (k ? topP.lineTo(q[0], q[1]) : topP.moveTo(q[0], q[1])));
  topP.closePath();
  p.ink('green', 0.5); c.fill(topP);
  p.ink('sun', 0.28); c.fill(topP);
  c.save(); c.clip(topP);
  tienVpravo(p, c, 0.07, bb);
  for (let k = 0; k < 16; k++) { const i = 1 + hash(k, W.seed) * 10, j = 1 + hash(W.seed, k) * 10; const [x, y] = iso(i, j); p.ellipse(k % 3 ? 'green' : 'sun', 0.18, x, y, 24 + hash(k, 3) * 30, 10 + hash(k, 4) * 10); }
  for (let k = 0; k < 130; k++) {
    const i = hash(k, 21 + W.seed) * 12, j = hash(k, 22 + W.seed) * 12;
    if (!onIsland(i, j, W.seed, 0.5)) continue;
    const [x, y] = iso(i, j);
    p.line('green', 0.7, 0.9, [[x - 2.5, y - 2.5], [x - 1, y + 0.5], [x, y - 3.2], [x + 1, y + 0.5], [x + 2.5, y - 2.5]]);
  }
  c.restore();
  // paths, one merged shape so no ink prints twice over itself
  if (!W.pathU) W.pathU = {};
  for (const [w, ink, a] of [[16, 'paper', 1], [16, 'sun', 0.5], [16, 'orange', 0.16], [5, 'paper', 0.45]]) {
    const key = w + '|' + p.s;
    let u = W.pathU[key];
    if (!u) {
      u = p.union(cc => {
        cc.lineCap = 'round'; cc.lineJoin = 'round'; cc.lineWidth = w;
        cc.beginPath(); curve(cc, W.ring, 0, 0); cc.stroke();
        for (const s of W.spokes) { cc.beginPath(); cc.moveTo(s[0][0], s[0][1]); cc.lineTo(s[1][0], s[1][1]); cc.stroke(); }
        cc.beginPath(); cc.moveTo(W.gatePath[0][0], W.gatePath[0][1]); cc.lineTo(W.gatePath[1][0], W.gatePath[1][1]); cc.stroke();
      });
      W.pathU[key] = u;
    }
    p.ink(ink, a); c.fill(u(p.ox, p.oy));
  }
  // everything standing, back to front
  const obj = W.deco.slice();
  const hut = W.hut, [hx, hy] = iso(hut.i + 0.55, hut.j + 0.55);
  obj.push({ y: hy + 10, draw: q => cottage(q, hut.i, hut.j, 1.1, 1.1, 15, 'pink', 'sun', { winsJ: [0.25], winsI: [0.55], door: 0.72 }) });
  const [gx, gy] = iso(W.gate[0], W.gate[1]);
  obj.push({ y: gy, draw: q => gate(q, W.gate) });
  plots.forEach((pl, k) => {
    if (k === skip) return;
    const [ci, cj] = plotCenter(k), [x, y] = iso(ci, cj);
    obj.push({ y: y - 8, draw: q => kresliParcelu(q, k, pl) });
  });
  obj.sort((a, b) => a.y - b.y);
  for (const o of obj) o.draw(p);
  p.reset();
}

export function kresliParcelu(p, k, pl) {
  const [ci, cj] = plotCenter(k);
  if (pl.stav === 'built') {
    HABITAT[pl.id](p, k, ci, cj);
    const [bx, by] = iso(...boxAt(k));
    post(p, bx, by, 9, 'orange');
  } else if (pl.stav === 'next') {
    // stakes and a name board: here the next habitat will be
    const h = PLOT_W / 2;
    for (const [u, v] of [[-h, -h], [h, -h], [h, h], [-h, h]]) { const [x, y] = iso(ci + u * 0.9, cj + v * 0.9); post(p, x, y, 8); }
    const q = quad(ci - h * 0.9, cj - h * 0.9, PLOT_W * 0.9, PLOT_W * 0.9);
    p.line('orange', 0.6, 0.8, [...q, q[0]]);
    const [sx, sy] = iso(ci + 0.3, cj + 0.3);
    signpost(p, sx, sy, pl.meno.toUpperCase(), 'blue');
  } else {
    const [x, y] = iso(ci, cj);
    flowers(p, x - 8, y, k * 17, 3);
    bush(p, x + 10, y - 4, 0.7);
  }
}

function gate(p, g) {
  const [i, j] = g;
  const A = iso(i - 0.55, j + 0.55), B = iso(i + 0.55, j - 0.55);
  for (const Q of [A, B]) { p.line('orange', 0.95, 3, [Q, [Q[0], Q[1] - 30]], 'butt'); p.line('night', 0.3, 3, [[Q[0] + 1, Q[1]], [Q[0] + 1, Q[1] - 30]], 'butt'); }
  const w = [[A[0] - 3, A[1] - 36], [B[0] + 3, B[1] - 36], [B[0] + 3, B[1] - 27], [A[0] - 3, A[1] - 27]];
  p.poly('paper', 1, w); p.poly('pink', 0.85, w);
  p.line('night', 0.4, 0.8, [...w, w[0]]);
  const m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - 31.5];
  const c = p.c; c.save(); c.translate(m[0], m[1]); c.transform(1, (B[1] - A[1]) / (B[0] - A[0]), 0, 1, 0, 0);
  p.text('paper', 1, 'ZOO', 0, 0, 7, 700);
  c.restore();
}

/* ── Moving things ──────────────────────────────────────────────────────── */
/* A tiny person: feet at (x, y). ink = coat colour, hat for keepers. */
export function osoba(p, x, y, ink, phase, stoji, hat, seed) {
  const sw = stoji ? 0 : sin(phase) * 1.4, bob = stoji ? 0 : abs(sin(phase)) * 0.7;
  p.ellipse('dots', 0.4, x + 1, y + 0.6, 4.2, 1.5);
  p.line('night', 0.75, 1.3, [[x - 1, y], [x - 0.8 + sw * 0.5, y - 5]]);
  p.line('night', 0.75, 1.3, [[x + 1, y], [x + 0.8 - sw * 0.5, y - 5]]);
  p.ellipse('paper', 1, x, y - 8.6 - bob, 3.1, 4.2);
  p.ellipse(ink, 0.85, x, y - 8.6 - bob, 3.1, 4.2);
  p.line(ink, 0.9, 1.2, [[x + 2.6, y - 10 - bob], [x + 3.2 + sw * 0.4, y - 6.5 - bob]]);
  p.circle('paper', 1, x, y - 15 - bob, 2.5);
  p.circle('pink', 0.3, x, y - 15 - bob, 2.5);
  if (hat) { p.ellipse(hat, 0.95, x, y - 17 - bob, 3.4, 1.1); p.ellipse(hat, 0.95, x, y - 18 - bob, 2, 1.4); }
  else p.path(hash(seed, 3) < 0.5 ? 'night' : 'orange', 0.75, (c, ox, oy) => c.arc(x + ox, y - 15.3 - bob + oy, 2.6, Math.PI, 0));
}

/* the donation box: a little tin whose level rises */
export function schranka(p, x, y, f, plna) {
  const w = 3.6, h = 6, top = y - 9;
  p.ellipse('dots', 0.35, x + 1, y + 0.5, 4, 1.4);
  p.poly('paper', 1, [[x - w, top], [x + w, top], [x + w, top - h], [x - w, top - h]]);
  p.poly('blue', 0.35, [[x - w, top], [x + w, top], [x + w, top - h], [x - w, top - h]]);
  const l = h * min(1, f);
  if (l > 0.2) p.poly('sun', 0.95, [[x - w + 0.6, top], [x + w - 0.6, top], [x + w - 0.6, top - l], [x - w + 0.6, top - l]]);
  p.ellipse('paper', 1, x, top - h, w, 1.2); p.ellipse('blue', 0.45, x, top - h, w, 1.2);
  p.line('night', 0.7, 0.8, [[x - 1.4, top - h], [x + 1.4, top - h]]);
  if (plna) { p.circle('sun', 1, x - 1, top - h - 2.6, 1.6); p.circle('orange', 0.5, x - 1, top - h - 2.6, 1.6); p.circle('sun', 1, x + 1.6, top - h - 3.6, 1.4); }
}

/* a ring of halftone dots for a milestone, a = 0..1 */
export function kruh(p, x, y, a) {
  const r = 10 + a * 46, al = (1 - a) * 0.8;
  for (let k = 0; k < 18; k++) { const t = k / 18 * TAU; p.circle(k % 2 ? 'pink' : 'sun', al, x + cos(t) * r, y + sin(t) * r * 0.5, 2.2 * (1 - a * 0.5)); }
}

export { iso, hash };
