/* Puzzle Village: the island, its water, paths and trees.
   Built once from fixed numbers, so the village is the same for everyone. */
import { iso, RX, RY, tree, bush, flowers, stone, signpost } from './iso.js?v=2';
import { hash, DUSK } from './riso.js?v=2';

export const C0 = [14.5, 14.5];
export const DEPTH = 74;
/* the plate: the area of the world that is printed */
export const PLATE = { x0: -800, y0: -230, x1: 800, y1: 1010 };

/* island edge, in tiles from the centre, as a function of the angle */
export function edgeR(th) {
  return 13.9 + 0.55 * Math.sin(3 * th + 1) + 0.38 * Math.sin(5 * th + 2.2) + 0.22 * Math.sin(9 * th + 0.4);
}
export function onIsland(i, j, margin = 0) {
  const di = i - C0[0], dj = j - C0[1];
  return Math.hypot(di, dj) < edgeR(Math.atan2(dj, di)) - margin;
}

/* water: one river, the swans' lake, the cranes' pool, the beavers' pond */
export const RIVER = [[8.6, -1.5], [9.3, 2.5], [10.4, 5.8], [11.8, 8.8], [13.2, 11.6], [14, 13.5], [14.9, 16.2], [16.1, 18.8], [17, 21], [17.3, 23.4], [18.1, 26], [19.2, 29.5], [20, 32]];
export const RIVER_W = 0.62;
export const POOLS = [
  { i: 14, j: 13.4, r: 2.7, kluc: 'swans' },
  { i: 17.1, j: 20.9, r: 2.05, kluc: 'cranes' },
  { i: 18.4, j: 6.2, r: 1.45, kluc: 'beavers' }
];

function segDist(i, j, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((i - a[0]) * vx + (j - a[1]) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(i - a[0] - vx * t, j - a[1] - vy * t);
}
export function waterDist(i, j) {
  let d = 99;
  for (let k = 0; k < RIVER.length - 1; k++) d = Math.min(d, segDist(i, j, RIVER[k], RIVER[k + 1]) - RIVER_W);
  for (const p of POOLS) d = Math.min(d, Math.hypot(i - p.i, j - p.j) - p.r);
  return d;
}

/* paths: little dirt roads between the places, and two bridges */
export const PATHS = [
  // west lane: from the hedgehogs down past the square to the owls and the south bridge
  [[5.3, 9.4], [6.4, 11.2], [7.6, 13.4], [8.4, 15.6], [8.9, 17.6], [9.2, 20], [9.6, 23.2], [11.6, 23.4], [14.4, 23.8], [16.2, 24.6]],
  [[6.4, 11.2], [8.6, 10.6], [10.9, 10.05]],
  [[4.6, 14.4], [6.2, 14.2], [7.6, 13.4]],
  [[5.4, 18.2], [7.4, 17.9], [8.9, 17.6]],
  [[6.9, 22.6], [8.2, 22.0], [9.4, 21.6]],
  [[8.4, 15.6], [10.2, 15.0], [11.2, 14.6]],
  [[11.6, 23.4], [12.6, 24.2]],
  // east lane: from the north bridge to the otters, beavers, magpies, squirrels, herons, foxes
  [[13.1, 9.4], [15.2, 9.0], [17.6, 10.6], [20.6, 10.6], [22.8, 11.6], [24.0, 13.0]],
  [[15.2, 9.0], [14.9, 7.2], [15.0, 5.6]],
  [[15.2, 9.0], [16.8, 8.2], [17.6, 7.9]],
  [[17.6, 10.6], [18.6, 12.2], [19.4, 13.4]],
  [[20.6, 10.6], [20.8, 13.8], [21.6, 16.6], [22.8, 17.2]],
  [[21.6, 16.6], [21.2, 19.4], [21.8, 22.2], [23.4, 22.2]],
  [[21.2, 19.4], [19.6, 20.6]],
  [[18.7, 24.35], [20.2, 23.2], [21.8, 22.2]]
];
export const BRIDGES = [
  { a: [10.9, 10.05], b: [13.1, 9.4] },
  { a: [16.2, 24.6], b: [18.7, 24.35] }
];
function pathDist(i, j) {
  let d = 99;
  for (const P of PATHS) for (let k = 0; k < P.length - 1; k++) d = Math.min(d, segDist(i, j, P[k], P[k + 1]));
  return d;
}

/* smooth curve through points (projected), used for the river and paths */
function curve(c, pts, ox, oy) {
  c.moveTo(pts[0][0] + ox, pts[0][1] + oy);
  for (let k = 1; k < pts.length - 1; k++) {
    const mx = (pts[k][0] + pts[k + 1][0]) / 2, my = (pts[k][1] + pts[k + 1][1]) / 2;
    c.quadraticCurveTo(pts[k][0] + ox, pts[k][1] + oy, mx + ox, my + oy);
  }
  const L = pts[pts.length - 1]; c.lineTo(L[0] + ox, L[1] + oy);
}

/* ── Build once ───────────────────────────────────────────────────────── */
export function build(places) {
  const W = {};
  // island outline
  const N = 160, top = [];
  for (let k = 0; k < N; k++) {
    const th = k / N * Math.PI * 2, r = edgeR(th);
    top.push(iso(C0[0] + Math.cos(th) * r, C0[1] + Math.sin(th) * r));
  }
  W.top = top;
  let L = 0, R = 0, B = 0;
  top.forEach((q, k) => { if (q[0] < top[L][0]) L = k; if (q[0] > top[R][0]) R = k; if (q[1] > top[B][1]) B = k; });
  // lower chain from R to L passing through B
  const chain = [];
  for (let k = R; ; k = (k + 1) % N) { chain.push(top[k]); if (k === L) break; }
  if (!chain.includes(top[B])) { chain.length = 0; for (let k = R; ; k = (k - 1 + N) % N) { chain.push(top[k]); if (k === L) break; } }
  W.chain = chain;
  W.bottomX = top[B][0];
  // the printed frame: the island with a margin, marks at its corners
  const xs = top.map(q => q[0]);
  const fx0 = Math.min(...xs) - 60, fx1 = Math.max(...xs) + 60;
  // a ragged rock bottom
  W.drip = chain.map((q, k) => [q[0], q[1] + DEPTH + (k % 3 === 0 ? 10 + hash(k, 5) * 22 : hash(k, 9) * 8)]);
  W.frame = { x0: fx0, x1: fx1, y0: -70, y1: Math.max(...W.drip.map(q => q[1])) + 70 };

  // river as plate points and a sampled centre line for moving glints
  W.river = RIVER.map(q => iso(q[0], q[1]));
  W.samples = [];
  for (let k = 0; k < RIVER.length - 1; k++) {
    const a = RIVER[k], b = RIVER[k + 1], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 3);
    for (let s = 0; s < n; s++) {
      const f = s / n, i = a[0] + (b[0] - a[0]) * f, j = a[1] + (b[1] - a[1]) * f;
      if (!onIsland(i, j, 0.3)) continue;
      if (POOLS.some(p => Math.hypot(i - p.i, j - p.j) < p.r - 0.3)) continue;
      const P = iso(i, j), Q = iso(b[0], b[1]), A = iso(a[0], a[1]);
      const dx = Q[0] - A[0], dy = Q[1] - A[1], l = Math.hypot(dx, dy);
      W.samples.push({ x: P[0], y: P[1], dx: dx / l, dy: dy / l, n: hash(k * 31 + s, 3) });
    }
  }
  // where the river leaves the island: the waterfall
  let prev = null;
  for (let k = 0; k < RIVER.length - 1 && !W.fall; k++) {
    const a = RIVER[k], b = RIVER[k + 1];
    for (let s = 0; s <= 40; s++) {
      const f = s / 40, i = a[0] + (b[0] - a[0]) * f, j = a[1] + (b[1] - a[1]) * f;
      const inside = onIsland(i, j);
      if (prev === true && !inside) { W.fall = iso(i, j); break; }
      prev = inside;
    }
  }
  W.paths = PATHS.map(P => P.map(q => iso(q[0], q[1])));
  // bounding boxes, so a tile that holds no water or path skips those passes
  const bbox = (pts, m) => [Math.min(...pts.map(q => q[0])) - m, Math.min(...pts.map(q => q[1])) - m, Math.max(...pts.map(q => q[0])) + m, Math.max(...pts.map(q => q[1])) + m];
  W.waterBox = bbox([...W.river, ...POOLS.flatMap(q => { const [x, y] = iso(q.i, q.j); return [[x - q.r * RX, y - q.r * RY], [x + q.r * RX, y + q.r * RY]]; })], 50);
  W.pathBox = bbox(W.paths.flat(), 16);

  // trees, bushes, stones, flowers
  const obj = [];
  const r = (a, b) => hash(a * 13 + 7, b * 17 + 3);
  for (let gi = 0; gi < 34; gi++) for (let gj = 0; gj < 34; gj++) {
    const i = gi * 0.92 - 1 + r(gi, gj) * 0.7, j = gj * 0.92 - 1 + r(gj + 50, gi) * 0.7;
    if (!onIsland(i, j, 0.9)) continue;
    const wd = waterDist(i, j), pd = pathDist(i, j);
    let near = 99;
    for (const pl of places) {
      near = Math.min(near, Math.hypot(i - pl.i, j - pl.j) - pl.clear);
      // keep every sign in the clear, no crown may grow through a name
      if (pl.sign) near = Math.min(near, Math.hypot(i - pl.sign[0], j - pl.sign[1] + 0.35) - 1.05);
    }
    if (near < 0 || wd < 0.55 || pd < 0.6) continue;
    const roll = r(gi + 99, gj + 99);
    const [x, y] = iso(i, j);
    const edge = !onIsland(i, j, 2.6);
    if (roll < (edge ? 0.55 : 0.32) && wd > 0.9) {
      const kind = r(gi, gj + 200) < 0.3 ? 'pine' : r(gi + 3, gj) < 0.12 ? 'fruit' : r(gi, gj + 9) < 0.1 ? 'autumn' : 'round';
      const s = 0.85 + r(gi + 7, gj + 7) * 0.45;
      obj.push({ y, bb: [x - 22 * s, y - 44 * s, x + 24 * s, y + 8], draw: p => tree(p, x, y, s, kind, gi * 50 + gj) });
    } else if (roll < 0.44) {
      obj.push({ y, bb: [x - 14, y - 16, x + 16, y + 6], draw: p => bush(p, x, y, 0.8 + r(gi, gj) * 0.4, r(gj, gi) < 0.2 ? 'teal' : 'green') });
    } else if (roll < 0.52) {
      obj.push({ y, bb: [x - 10, y - 10, x + 10, y + 5], draw: p => flowers(p, x, y, gi * 40 + gj, 5) });
    } else if (roll < 0.56 && wd < 1.6) {
      obj.push({ y, bb: [x - 6, y - 5, x + 6, y + 4], draw: p => stone(p, x, y, 0.8 + r(gi, gj) * 0.5) });
    }
  }
  // reeds along the water
  for (const s of W.samples) {
    if (s.n > 0.18) continue;
    const side = s.n < 0.09 ? 1 : -1;
    const x = s.x - s.dy * 30 * side, y = s.y + s.dx * 30 * side * 0.5;
    obj.push({ y, bb: [x - 8, y - 16, x + 8, y + 2], draw: p => reeds(p, x, y) });
  }
  for (const b of BRIDGES) {
    const A = iso(b.a[0], b.a[1]), B2 = iso(b.b[0], b.b[1]);
    const y = Math.max(A[1], B2[1]);
    obj.push({ y: y - 30, bb: [Math.min(A[0], B2[0]) - 10, Math.min(A[1], B2[1]) - 20, Math.max(A[0], B2[0]) + 10, y + 12], draw: p => bridge(p, A, B2) });
  }
  // lamp posts along the paths (they glow in the evening)
  W.lamps = [];
  const lampAt = [[7.1, 12.0], [9.6, 15.7], [9.7, 19.9], [15.6, 9.6], [20.1, 11.2], [21.1, 18.9], [12.8, 23.9], [20.0, 23.7]];
  for (const q of lampAt) {
    const [x, y] = iso(q[0], q[1]);
    W.lamps.push([x, y - 26]);
    obj.push({ y, bb: [x - 6, y - 32, x + 6, y + 3], draw: p => lamp(p, x, y) });
  }
  for (const pl of places) {
    const [x, y] = iso(pl.i, pl.j);
    const bb = pl.bb || [-190, -170, 190, 110];
    obj.push({ y: y + (pl.dy || 0), bb: [x + bb[0], y + bb[1], x + bb[2], y + bb[3]], draw: p => pl.static(p), place: pl });
    if (pl.sign) {
      const [sx, sy] = iso(pl.sign[0], pl.sign[1]);
      obj.push({ y: sy, bb: [sx - 40, sy - 34, sx + 40, sy + (pl.soon ? 14 : 3)], draw: p => sign(p, sx, sy, pl) });
    }
  }
  obj.sort((a, b) => a.y - b.y);
  W.obj = obj;
  return W;
}

/* The name of a house on its signpost. A house whose puzzle is not out yet
   gets a small board hung under the name. */
function sign(p, x, y, pl) {
  signpost(p, x, y, pl.name.toUpperCase(), pl.sign[2]);
  if (!pl.soon) return;
  const w = 44, y0 = y - 16, y1 = y - 8;
  p.line('night', 0.6, 0.6, [[x - w / 2 + 5, y - 20], [x - w / 2 + 5, y0]]);
  p.line('night', 0.6, 0.6, [[x + w / 2 - 5, y - 20], [x + w / 2 - 5, y0]]);
  const b = [[x - w / 2, y0], [x + w / 2, y0], [x + w / 2, y1], [x - w / 2, y1]];
  p.poly('paper', 1, b); p.poly('sun', 0.35, b);
  p.line('night', 0.5, 0.6, [...b, b[0]]);
  p.text('night', 0.9, 'OPENING SOON', x, (y0 + y1) / 2 + 0.2, 4.6, 700);
}

function reeds(p, x, y) {
  for (let k = 0; k < 4; k++) {
    const dx = (k - 1.5) * 2.6, h = 9 + (k % 2) * 4;
    p.line('green', 0.85, 1, [[x + dx, y], [x + dx + (k - 1.5) * 0.9, y - h]]);
  }
  p.ellipse('orange', 0.85, x + 1.4, y - 12, 1.1, 3);
}
function lamp(p, x, y) {
  p.ellipse('dots', 0.4, x + 2, y + 1, 4, 1.5);
  p.line('night', 0.75, 1.5, [[x, y], [x, y - 22]], 'butt');
  p.poly('night', 0.8, [[x - 3.2, y - 22], [x + 3.2, y - 22], [x + 2, y - 30], [x - 2, y - 30]]);
  p.poly('sun', 0.9, [[x - 2.2, y - 23], [x + 2.2, y - 23], [x + 1.4, y - 28.5], [x - 1.4, y - 28.5]]);
}
function bridge(p, A, B) {
  const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy);
  const nx = -dy / l, ny = dx / l;
  const w = 9, n = Math.round(l / 5);
  const lift = k => Math.sin(k / n * Math.PI) * 7;
  // shadow on the water
  p.poly('night', 0.2, [[A[0] + nx * w, A[1] + ny * w + 6], [B[0] + nx * w, B[1] + ny * w + 6], [B[0] - nx * w, B[1] - ny * w + 6], [A[0] - nx * w, A[1] - ny * w + 6]]);
  for (let k = 0; k <= n; k++) {
    const f = k / n, x = A[0] + dx * f, y = A[1] + dy * f - lift(k);
    p.line('orange', 0.85, 3.4, [[x + nx * w, y + ny * w * 0.5], [x - nx * w, y - ny * w * 0.5]], 'butt');
    if (k % 2) p.line('night', 0.22, 3.4, [[x + nx * w, y + ny * w * 0.5], [x - nx * w, y - ny * w * 0.5]], 'butt');
  }
  for (const sgn of [1, -1]) {
    const pts = [];
    for (let k = 0; k <= n; k++) { const f = k / n; pts.push([A[0] + dx * f + nx * w * sgn, A[1] + dy * f + ny * w * 0.5 * sgn - lift(k) - 8]); }
    p.line('orange', 0.9, 1.4, pts);
    for (let k = 0; k <= n; k += 3) p.line('orange', 0.9, 1.4, [[pts[k][0], pts[k][1]], [pts[k][0], pts[k][1] + 8]]);
  }
}

/* ── The static print: everything that does not move ─────────────────── */
export function drawStatic(p, W, rect, eve = false) {
  const c = p.c;
  p.glow = eve ? [] : null;
  // paper
  p.ink('paper', 1);
  c.fillRect(rect[0] - 2, rect[1] - 2, rect[2] - rect[0] + 4, rect[3] - rect[1] + 4);
  // printer's marks and the imprint, like on a poster
  marks(p, rect, W);

  // the island's side: soil, a grass lip, a ragged rock bottom
  const ch = W.chain, dr = W.drip;
  const band = new Path2D();
  band.moveTo(ch[0][0], ch[0][1]);
  for (const q of ch) band.lineTo(q[0], q[1]);
  for (let k = dr.length - 1; k >= 0; k--) band.lineTo(dr[k][0], dr[k][1]);
  band.closePath();
  if (boxHit(rect, [W.top.reduce((m, q) => Math.min(m, q[0]), 1e9), 0, W.top.reduce((m, q) => Math.max(m, q[0]), -1e9), 1200])) {
    c.save(); c.clip(band);
    p.ink('orange', 0.62); c.fill(band);
    p.ink('pink', 0.2); c.fill(band);
    // strata
    for (const [off, w, ink, a] of [[4, 8, 'green', 0.85], [24, 3, 'night', 0.14], [40, 7, 'orange', 0.3], [58, 30, 'nightdots', 0.55]]) {
      p.ink(ink, a); c.lineWidth = w; c.beginPath();
      ch.forEach((q, k) => k ? c.lineTo(q[0], q[1] + off) : c.moveTo(q[0], q[1] + off));
      c.stroke();
    }
    // the face turned to the lower right sits in shade
    p.ink('blue', 0.28); c.fillRect(W.bottomX, -400, 1400, 2000);
    // pebbles in the soil
    for (let k = 0; k < ch.length; k += 2) {
      const q = ch[k], h = hash(k, 77);
      if (h < 0.5) p.ellipse(h < 0.2 ? 'sun' : 'night', h < 0.2 ? 0.5 : 0.18, q[0] + h * 8, q[1] + 20 + hash(k, 3) * 40, 2 + h * 3, 1.3 + h * 2);
    }
    c.restore();
    // roots hanging below
    for (let k = 3; k < dr.length; k += 11) {
      const q = dr[k], l = 10 + hash(k, 1) * 22;
      p.line('orange', 0.55, 1, [[q[0], q[1] - 4], [q[0] + 3, q[1] + l * 0.5], [q[0] - 1, q[1] + l]]);
    }
  }

  // top: grass
  const topP = new Path2D();
  W.top.forEach((q, k) => k ? topP.lineTo(q[0], q[1]) : topP.moveTo(q[0], q[1]));
  topP.closePath();
  p.ink('green', 0.5); c.fill(topP);
  p.ink('sun', 0.28); c.fill(topP);
  c.save(); c.clip(topP);
  // a soft shading on the lower right half of the land
  p.ink('blue', 0.08); c.fillRect(W.bottomX + 200, -400, 1400, 2000);
  // meadow patches
  for (let k = 0; k < 26; k++) {
    const i = 2 + hash(k, 11) * 25, j = 2 + hash(k, 12) * 25;
    if (!onIsland(i, j, 1) || waterDist(i, j) < 0.8) continue;
    const [x, y] = iso(i, j);
    p.ellipse(k % 3 ? 'green' : 'sun', 0.2, x, y, 30 + hash(k, 13) * 40, 12 + hash(k, 14) * 14);
  }
  // grass tufts
  for (let k = 0; k < 240; k++) {
    const i = hash(k, 21) * 29, j = hash(k, 22) * 29;
    if (!onIsland(i, j, 0.6) || waterDist(i, j) < 0.3) continue;
    const [x, y] = iso(i, j);
    if (x < rect[0] - 10 || x > rect[2] + 10 || y < rect[1] - 10 || y > rect[3] + 10) continue;
    p.line('green', 0.7, 0.9, [[x - 2.5, y - 2.5], [x - 1, y + 0.5], [x, y - 3.2], [x + 1, y + 0.5], [x + 2.5, y - 2.5]]);
  }

  // water: sand banks, then the water in two inks, then the ripple rim
  // each pass is one merged shape, so an ink never prints twice over itself
  const riv = W.river;
  c.save();
  if (boxHit(rect, W.waterBox)) {
  unionPaint(p, (cc) => {
    cc.lineCap = 'round'; cc.lineJoin = 'round';
    cc.lineWidth = 66; cc.beginPath(); curve(cc, riv, 0, 0); cc.stroke();
    for (const q of POOLS) { const [x, y] = iso(q.i, q.j); cc.beginPath(); cc.ellipse(x, y, q.r * RX + 8, q.r * RY + 4, 0, 0, 6.2832); cc.fill(); }
  }, [['paper', 1], ['sun', 0.5], ['orange', 0.12]]);
  unionPaint(p, (cc) => {
    cc.lineCap = 'round'; cc.lineJoin = 'round';
    cc.lineWidth = 50; cc.beginPath(); curve(cc, riv, 0, 0); cc.stroke();
    for (const q of POOLS) { const [x, y] = iso(q.i, q.j); cc.beginPath(); cc.ellipse(x, y, q.r * RX, q.r * RY, 0, 0, 6.2832); cc.fill(); }
  }, [['paper', 1], ['blue', 0.6], ['teal', 0.14]]);
  unionPaint(p, (cc) => {
    cc.lineCap = 'round'; cc.lineJoin = 'round';
    cc.lineWidth = 22; cc.beginPath(); curve(cc, riv, 0, 0); cc.stroke();
    for (const q of POOLS) { const [x, y] = iso(q.i, q.j); cc.beginPath(); cc.ellipse(x, y, q.r * RX - 20, q.r * RY - 10, 0, 0, 6.2832); cc.fill(); }
  }, [['blue', 0.22]]);
  }
  c.restore();

  // paths: packed earth with a lighter middle
  if (boxHit(rect, W.pathBox)) for (const [w, ink, a] of [[15, 'paper', 1], [15, 'sun', 0.5], [15, 'orange', 0.16], [5, 'paper', 0.45]]) {
    unionPaint(p, (cc) => {
      cc.lineCap = 'round'; cc.lineJoin = 'round'; cc.lineWidth = w;
      for (const P of W.paths) { cc.beginPath(); curve(cc, P, 0, 0); cc.stroke(); }
    }, [[ink, a]]);
  }
  c.restore();

  // everything standing, back to front
  for (const o of W.obj) if (boxHit(rect, o.bb)) o.draw(p);
  p.reset();
  if (eve) dusk(p, W, rect);
}

/* Early evening: two more drums, plum and blue, over the whole print, then the
   lit windows and lamps printed last in warm light, as a hand would add them. */
function dusk(p, W, rect) {
  const c = p.c;
  for (const [ink, a] of DUSK) { p.ink(ink, a); c.fillRect(rect[0] - 2, rect[1] - 2, rect[2] - rect[0] + 4, rect[3] - rect[1] + 4); }
  p.reset();
  c.globalCompositeOperation = 'screen';
  const halo = (x, y, r, a) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,196,110,${a})`); g.addColorStop(1, 'rgba(255,196,110,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
  };
  for (const [x, y] of W.lamps) if (boxHit(rect, [x - 40, y - 40, x + 40, y + 40])) halo(x, y, 34, 0.55);
  for (const w of p.glow) {
    let x = 0, y = 0; for (const q of w) { x += q[0]; y += q[1]; }
    halo(x / w.length, y / w.length, 16, 0.4);
  }
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = 'rgb(255,206,120)';
  for (const w of p.glow) { c.beginPath(); w.forEach((q, k) => k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath(); c.fill(); }
  c.fillStyle = 'rgb(255,236,190)';
  for (const [x, y] of W.lamps) { c.beginPath(); c.arc(x, y - 0.6, 2.2, 0, 6.2832); c.fill(); }
  p.reset();
}

/* Paint a union of overlapping shapes in one ink pass, so a riso ink never
   prints twice over itself: the shapes go to a mask, the mask is inked once. */
let MASK = null;
function unionPaint(p, shape, inks) {
  const c = p.c;
  const t = c.getTransform();
  const w = c.canvas.width, h = c.canvas.height;
  if (!MASK) MASK = document.createElement('canvas');
  if (MASK.width !== w || MASK.height !== h) { MASK.width = w; MASK.height = h; }
  const m = MASK.getContext('2d');
  for (const [ink, a] of inks) {
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalCompositeOperation = 'source-over';
    m.clearRect(0, 0, w, h);
    // the register offset moves the shape itself, in world units, so the
    // print carries on seamlessly across the edge of a tile
    p.ink(ink, 1);
    m.setTransform(t);
    m.translate(p.ox, p.oy);
    m.fillStyle = '#000'; m.strokeStyle = '#000';
    shape(m);
    m.setTransform(t);
    m.globalCompositeOperation = 'source-in';
    m.fillStyle = p.pat[ink];
    m.fillRect(-5000, -5000, 10000, 10000);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = a;
    c.globalCompositeOperation = ink === 'paper' ? 'source-over' : 'multiply';
    c.drawImage(MASK, 0, 0);
    c.restore();
  }
}

function boxHit(r, b) { return !(b[2] < r[0] || b[0] > r[2] || b[3] < r[1] || b[1] > r[3]); }

function marks(p, rect, W) {
  const F = W.frame;
  const pts = [[F.x0 + 18, F.y0 + 18], [F.x1 - 18, F.y0 + 18], [F.x0 + 18, F.y1 - 18], [F.x1 - 18, F.y1 - 18]];
  for (const [x, y] of pts) {
    if (!boxHit(rect, [x - 20, y - 20, x + 20, y + 20])) continue;
    for (const [ink, dx] of [['blue', 0], ['pink', 1.2], ['sun', -1]]) {
      p.line(ink, 0.8, 1, [[x - 14 + dx, y], [x + 14 + dx, y]]);
      p.line(ink, 0.8, 1, [[x + dx, y - 14], [x + dx, y + 14]]);
      p.path(ink, 0.8, (c, ox, oy) => c.arc(x + dx + ox, y + oy, 7, 0, 6.2832), 1);
    }
  }
  // the poster's title, printed twice a hair apart like two drums
  const tx = F.x0 + 60, ty = F.y0 + 92;
  if (boxHit(rect, [tx - 10, ty - 60, tx + 460, ty + 40])) {
    for (const [ink, a, dx, dy] of [['pink', 0.9, 1.8, 1.2], ['blue', 0.92, 0, 0]]) {
      const c = p.ink(ink, a);
      c.font = '700 54px "ARLing Sans", system-ui, sans-serif';
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.fillText('Puzzle Village', tx + dx, ty + dy);
    }
    const c = p.ink('night', 0.72);
    c.font = '600 13px "ARLing Sans", system-ui, sans-serif';
    c.fillText('A NEW PUZZLE IN EVERY OPEN HOUSE, EVERY DAY', tx + 2, ty + 28);
  }
  const by = F.y1 - 52;
  if (boxHit(rect, [F.x0, by - 30, F.x1, by + 30])) {
    const c = p.ink('night', 0.75);
    c.font = '600 15px "ARLing Sans", system-ui, sans-serif';
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText('ARLing Puzzle Village', F.x0 + 60, by);
    p.ink('night', 0.5);
    c.font = '500 12px "ARLing Sans", system-ui, sans-serif';
    c.fillText('Free daily puzzles, nine inks, all drawn in code. arling.sk/games', F.x0 + 60, by + 18);
    const inks = ['blue', 'pink', 'orange', 'sun', 'green', 'teal', 'plum', 'night'];
    inks.forEach((k, n) => { p.ink(k, 0.9); c.fillRect(F.x1 - 60 - (inks.length - n) * 18, by - 4, 14, 14); });
  }
}
