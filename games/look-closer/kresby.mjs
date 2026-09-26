/* Look Closer: the new things of Orchard Lane, drawn in code with the Puzzle
   Village pen (riso.js): barrels, crates, a well, beehives, a bench, washing on a
   line, and the new things to find (a cat, a watering can, a kite).
   Every drawing stands at (x, y) = where it touches the ground, in world units;
   s is its size. Paper is printed first where a colour must stay clean, the way
   the village does it; shadows are halftone dots. Only pen calls and transforms,
   so the same drawing can be measured in node (silueta.mjs). */

const TAU = Math.PI * 2;
const { sin, cos, min, max, abs, PI } = Math;

/* a path fn that honours the pen's register offset */
const R = fn => (c, ox, oy) => { c.save(); c.translate(ox, oy); fn(c); c.restore(); };
/* the two ground directions of the isometric grid, per tile */
const I = [32, 16], J = [-32, 16];
export function naZemi(x, y, u, v, z = 0) { return [x + I[0] * u + J[0] * v, y + I[1] * u + J[1] * v - z]; }

/* a small upright box standing on the ground, centred at (x, y); hi, hd are half
   sizes along i and j in tiles, h its height. Faces as in iso.js box(). */
export function kocka(p, x, y, hi, hd, h, top, left, right, h0 = 0) {
  const q = (u, v, z) => naZemi(x, y, u * hi, v * hd, z);
  const A = q(-1, -1, h0 + h), B = q(1, -1, h0 + h), C = q(1, 1, h0 + h), D = q(-1, 1, h0 + h);
  const C0 = q(1, 1, h0), D0 = q(-1, 1, h0), B0 = q(1, -1, h0);
  if (right) p.poly(right[0], right[1], [B, C, C0, B0]);
  if (left) p.poly(left[0], left[1], [D, C, C0, D0]);
  if (top) p.poly(top[0], top[1], [A, B, C, D]);
  return { A, B, C, D, C0, D0, B0 };
}

/* ── Barrel ─────────────────────────────────────────────────────────────── */
export function sud(p, x, y, s = 1, ink = 'orange') {
  const w = 6.2 * s, h = 15 * s, e = 2.3 * s, bul = 1.5 * s;
  p.ellipse('dots', 0.5, x + 5 * s, y + 0.4 * s, 10.5 * s, 3.2 * s);
  const telo = R(c => {
    c.moveTo(x - w, y - e * 0.2);
    c.quadraticCurveTo(x - w - bul, y - h / 2, x - w, y - h);
    c.lineTo(x + w, y - h);
    c.quadraticCurveTo(x + w + bul, y - h / 2, x + w, y - e * 0.2);
    c.ellipse(x, y - e * 0.2, w, e, 0, 0, PI);
    c.closePath();
  });
  p.path('paper', 1, telo);
  p.path(ink, 0.85, telo);
  // shade on the right half, light on the left
  p.path('night', 0.2, R(c => { c.moveTo(x + w * 0.25, y - h); c.lineTo(x + w, y - h); c.quadraticCurveTo(x + w + bul, y - h / 2, x + w, y - e * 0.2); c.ellipse(x, y - e * 0.2, w, e, 0, 0, PI * 0.42); c.closePath(); }));
  p.path('sun', 0.35, R(c => { c.moveTo(x - w * 0.55, y - h + 1.5 * s); c.lineTo(x - w * 0.2, y - h + 1.5 * s); c.lineTo(x - w * 0.2, y - 1.5 * s); c.lineTo(x - w * 0.55, y - 1.8 * s); c.closePath(); }));
  // hoops follow the round of the barrel
  for (const f of [0.18, 0.78]) {
    const yy = y - e * 0.2 - (h - e * 0.2) * f, ww = w + bul * sin(PI * f) * 0.9;
    p.path('night', 0.6, R(c => c.ellipse(x, yy, ww, e, 0, 0.05, PI - 0.05)), 1.2 * s);
  }
  // the lid
  p.ellipse('paper', 1, x, y - h, w, e);
  p.ellipse(ink, 0.6, x, y - h, w, e);
  p.ellipse('night', 0.22, x, y - h, w * 0.78, e * 0.7);
  p.line('night', 0.3, 0.6 * s, [[x - w * 0.6, y - h - 0.4 * s], [x + w * 0.6, y - h + 0.4 * s]]);
}

/* ── A crate of apples ──────────────────────────────────────────────────── */
export function bedna(p, x, y, s = 1, ovocie = 'pink', seed = 1) {
  p.poly('dots', 0.5, [naZemi(x, y, 0.3 * s, -0.24 * s), naZemi(x, y, 0.62 * s, 0.05 * s), naZemi(x, y, 0.5 * s, 0.4 * s), naZemi(x, y, -0.3 * s, 0.24 * s)]);
  const h = 8 * s, hi = 0.27 * s, hd = 0.2 * s;
  const k = kocka(p, x, y, hi, hd, h, null, ['paper', 1], ['paper', 1]);
  kocka(p, x, y, hi, hd, h, null, ['orange', 0.8], ['orange', 0.95]);
  kocka(p, x, y, hi, hd, h, null, null, ['night', 0.22]);
  // slats: gaps between the boards
  for (const f of [0.36, 0.68]) {
    p.line('night', 0.45, 0.7 * s, [[k.D0[0] + (k.D[0] - k.D0[0]) * f, k.D0[1] + (k.D[1] - k.D0[1]) * f], [k.C0[0] + (k.C[0] - k.C0[0]) * f, k.C0[1] + (k.C[1] - k.C0[1]) * f]]);
    p.line('night', 0.45, 0.7 * s, [[k.C0[0] + (k.C[0] - k.C0[0]) * f, k.C0[1] + (k.C[1] - k.C0[1]) * f], [k.B0[0] + (k.B[0] - k.B0[0]) * f, k.B0[1] + (k.B[1] - k.B0[1]) * f]]);
  }
  // the heap of fruit over the rim, back to front
  const ov = [];
  for (let n = 0; n < 9; n++) { const u = (hash2(seed, n) - 0.5) * 1.5, v = (hash2(n, seed + 3) - 0.5) * 1.5; ov.push(naZemi(x, y, u * hi, v * hd, h + 1.6 * s + (1 - abs(u)) * 1.4 * s)); }
  ov.sort((a, b) => a[1] - b[1]);
  for (const [n, q] of ov.entries()) {
    p.circle('paper', 1, q[0], q[1], 2.3 * s);
    p.circle(n % 3 === 2 ? 'sun' : ovocie, 0.95, q[0], q[1], 2.3 * s);
    p.circle('sun', 0.5, q[0] - 0.7 * s, q[1] - 0.8 * s, 0.8 * s);
  }
  p.line('orange', 0.9, 0.9 * s, [k.D, k.C, k.B]);
}
function hash2(a, b) { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); }

/* ── A straw beehive (skep) on a little stand ─────────────────────────── */
export function ul(p, x, y, s = 1) {
  p.ellipse('dots', 0.5, x + 5 * s, y + 0.5 * s, 11 * s, 3.2 * s);
  // stand: a plank on two legs
  for (const dx of [-5, 5]) p.line('orange', 0.9, 1.4 * s, [[x + dx * s, y], [x + dx * s, y - 6 * s]], 'butt');
  p.poly('orange', 0.9, [[x - 8 * s, y - 6 * s], [x + 8 * s, y - 6 * s], [x + 8 * s, y - 7.6 * s], [x - 8 * s, y - 7.6 * s]]);
  p.poly('night', 0.25, [[x - 8 * s, y - 6 * s], [x + 8 * s, y - 6 * s], [x + 8 * s, y - 6.6 * s], [x - 8 * s, y - 6.6 * s]]);
  const b = y - 7.6 * s, w = 7.4 * s, h = 13 * s;
  const kupola = R(c => {
    c.moveTo(x - w, b);
    c.bezierCurveTo(x - w - 0.4 * s, b - h * 0.62, x - w * 0.5, b - h, x, b - h);
    c.bezierCurveTo(x + w * 0.5, b - h, x + w + 0.4 * s, b - h * 0.62, x + w, b);
    c.closePath();
  });
  p.path('paper', 1, kupola);
  p.path('sun', 0.95, kupola);
  p.path('orange', 0.3, R(c => { c.moveTo(x + w * 0.1, b - h); c.bezierCurveTo(x + w * 0.5, b - h, x + w + 0.4 * s, b - h * 0.62, x + w, b); c.lineTo(x + w * 0.2, b); c.closePath(); }));
  // the coils of straw
  for (let k = 1; k <= 4; k++) {
    const f = k / 5, yy = b - h * f, ww = w * Math.sqrt(1 - f * f * 0.92) * 0.98;
    p.path('orange', 0.75, R(c => c.ellipse(x, yy + 1.1 * s, ww, 1.6 * s, 0, 0.12, PI - 0.12)), 0.9 * s);
  }
  // the door
  p.path('night', 0.85, R(c => { c.ellipse(x, b, 2.2 * s, 2.6 * s, 0, PI, TAU); c.closePath(); }));
  p.circle('paper', 0.7, x - w * 0.45, b - h * 0.62, 1.2 * s);
}

/* ── A bench along i (dir = 1) or along j (dir = -1) ──────────────────── */
export function lavicka(p, x, y, s = 1, dir = 1, ink = 'orange') {
  const L = 0.38 * s, D = 0.13 * s, hs = 6.5 * s;
  const q = (u, v, z) => dir > 0 ? naZemi(x, y, u, v, z) : naZemi(x, y, v, u, z);
  p.poly('dots', 0.45, [q(-L, -D * 1.5, 0), q(L + 0.1, -D * 1.5, 0), q(L + 0.1, D * 3, 0), q(-L, D * 3, 0)]);
  // legs
  for (const u of [-L * 0.8, L * 0.8]) for (const v of [-D * 0.7, D * 0.7]) p.line('night', 0.7, 1.1 * s, [q(u, v, 0), q(u, v, hs)], 'butt');
  // back rest, two planks, behind the seat
  for (const z of [hs + 3.2 * s, hs + 6.4 * s]) {
    const pl = [q(-L, -D, z), q(L, -D, z), q(L, -D, z + 2.2 * s), q(-L, -D, z + 2.2 * s)];
    p.poly('paper', 1, pl); p.poly(ink, 0.9, pl); p.poly('night', 0.15, pl);
  }
  for (const u of [-L * 0.8, L * 0.8]) p.line('night', 0.6, 1.1 * s, [q(u, -D, hs), q(u, -D, hs + 8.8 * s)], 'butt');
  // seat
  const seat = [q(-L, -D, hs), q(L, -D, hs), q(L, D, hs), q(-L, D, hs)];
  p.poly('paper', 1, seat); p.poly(ink, 0.9, seat);
  const edge = [q(-L, D, hs), q(L, D, hs), q(L, D, hs - 1.5 * s), q(-L, D, hs - 1.5 * s)];
  p.poly(ink, 0.95, edge); p.poly('night', 0.3, edge);
  p.line('night', 0.3, 0.5 * s, [q(-L, 0, hs), q(L, 0, hs)]);
}

/* ── Washing on a line between two posts (a to b, points on the ground) ── */
export function snura(p, a, b, s = 1, veci = []) {
  const H = 30 * s;
  for (const q of [a, b]) {
    p.ellipse('dots', 0.4, q[0] + 2 * s, q[1] + 0.6 * s, 4 * s, 1.4 * s);
    p.line('orange', 0.95, 2 * s, [q, [q[0], q[1] - H]], 'butt');
    p.line('night', 0.3, 2 * s, [[q[0] + 0.6 * s, q[1]], [q[0] + 0.6 * s, q[1] - H]], 'butt');
  }
  const A = [a[0], a[1] - H + 1.5 * s], B = [b[0], b[1] - H + 1.5 * s];
  const sag = 5 * s, C = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + sag * 2];
  const at = t => [(1 - t) * (1 - t) * A[0] + 2 * (1 - t) * t * C[0] + t * t * B[0], (1 - t) * (1 - t) * A[1] + 2 * (1 - t) * t * C[1] + t * t * B[1]];
  const pts = []; for (let k = 0; k <= 16; k++) pts.push(at(k / 16));
  p.line('night', 0.6, 0.6 * s, pts);
  for (const v of veci) {
    const q = at(v.t), ink = v.ink;
    if (v.druh === 'sheet') {
      const w = 7 * s, h = 13 * s;
      const sh = R(c => { c.moveTo(q[0] - w, q[1] - 0.6 * s); c.lineTo(q[0] + w, q[1] + 0.6 * s); c.lineTo(q[0] + w + 0.6 * s, q[1] + h + 0.6 * s); c.quadraticCurveTo(q[0], q[1] + h + 2.2 * s, q[0] - w + 0.4 * s, q[1] + h - 0.4 * s); c.closePath(); });
      p.path('paper', 1, sh); p.path(ink, ink === 'paper' ? 1 : 0.7, sh);
      p.path('blue', 0.14, R(c => { c.moveTo(q[0] + w * 0.2, q[1]); c.lineTo(q[0] + w, q[1] + 0.6 * s); c.lineTo(q[0] + w + 0.6 * s, q[1] + h + 0.6 * s); c.quadraticCurveTo(q[0] + w * 0.4, q[1] + h + 1.6 * s, q[0] + w * 0.25, q[1] + h + 1.2 * s); c.closePath(); }));
    } else if (v.druh === 'shirt') {
      const w = 5 * s, h = 9 * s;
      const sh = R(c => { c.moveTo(q[0] - w, q[1]); c.lineTo(q[0] - w - 3 * s, q[1] + 3.5 * s); c.lineTo(q[0] - w - 1 * s, q[1] + 5 * s); c.lineTo(q[0] - w + 0.6 * s, q[1] + 3.4 * s); c.lineTo(q[0] - w + 0.8 * s, q[1] + h); c.lineTo(q[0] + w - 0.8 * s, q[1] + h + 0.4 * s); c.lineTo(q[0] + w - 0.6 * s, q[1] + 3.6 * s); c.lineTo(q[0] + w + 1 * s, q[1] + 5.2 * s); c.lineTo(q[0] + w + 3 * s, q[1] + 3.8 * s); c.lineTo(q[0] + w, q[1] + 0.3 * s); c.closePath(); });
      p.path('paper', 1, sh); p.path(ink, 0.85, sh);
      p.path('night', 0.18, R(c => { c.moveTo(q[0] + 0.5 * s, q[1] + 0.2 * s); c.lineTo(q[0] + w, q[1] + 0.3 * s); c.lineTo(q[0] + w - 0.6 * s, q[1] + h + 0.4 * s); c.lineTo(q[0] + 0.5 * s, q[1] + h + 0.2 * s); c.closePath(); }));
    } else {
      // a pair of socks
      for (const d of [-1.6, 1.6]) {
        const sk = R(c => { c.moveTo(q[0] + d * s - 1 * s, q[1]); c.lineTo(q[0] + d * s + 1 * s, q[1]); c.lineTo(q[0] + d * s + 1 * s, q[1] + 5 * s); c.lineTo(q[0] + d * s + 2.6 * s, q[1] + 6 * s); c.lineTo(q[0] + d * s + 2.2 * s, q[1] + 7.4 * s); c.lineTo(q[0] + d * s - 1 * s, q[1] + 6.6 * s); c.closePath(); });
        p.path('paper', 1, sk); p.path(ink, 0.9, sk);
      }
    }
    p.line('orange', 1, 1 * s, [[q[0] - 0.6 * s, q[1] - 1.2 * s], [q[0] - 0.6 * s, q[1] + 1.4 * s]], 'butt');
  }
}

/* ── A well with a little roof ────────────────────────────────────────── */
export function studna(p, x, y, s = 1, strecha = 'blue') {
  const r = 11 * s, e = 5.2 * s, hs = 10 * s;
  p.ellipse('dots', 0.5, x + 6 * s, y + 1 * s, r + 5 * s, e + 1.5 * s);
  // stone drum
  const drum = R(c => { c.moveTo(x - r, y - hs); c.lineTo(x - r, y); c.ellipse(x, y, r, e, 0, PI, 0, true); c.lineTo(x + r, y - hs); c.ellipse(x, y - hs, r, e, 0, 0, PI); c.closePath(); });
  p.path('paper', 1, drum);
  p.path('night', 0.12, drum);
  p.path('blue', 0.22, R(c => { c.moveTo(x + r * 0.35, y - hs + e * 0.94); c.lineTo(x + r * 0.35, y + e * 0.94); c.ellipse(x, y, r, e, 0, PI * 0.39, 0, true); c.lineTo(x + r, y - hs); c.ellipse(x, y - hs, r, e, 0, 0, PI * 0.39); c.closePath(); }));
  // stones
  for (let row = 0; row < 3; row++) for (let k = 0; k < 5; k++) {
    const a = PI * (0.12 + (k + (row % 2) * 0.5) / 5.4), cx = x + cos(a) * r * 0.98, cy = y - hs * (row + 0.5) / 3 + sin(a) * e;
    p.ellipse('night', 0.16, cx, cy, 2.6 * s * abs(sin(a)) + 0.4 * s, 1.2 * s);
  }
  // rim and water
  p.ellipse('paper', 1, x, y - hs, r, e);
  p.ellipse('night', 0.2, x, y - hs, r, e);
  p.ellipse('blue', 0.75, x, y - hs, r * 0.78, e * 0.72);
  p.ellipse('night', 0.3, x, y - hs, r * 0.78, e * 0.72);
  p.path('paper', 0.6, R(c => c.ellipse(x - 2 * s, y - hs - 0.8 * s, r * 0.4, e * 0.25, 0, 0.3, 2.6)), 0.6 * s);
  // posts, roof, crank
  const top = y - hs - 26 * s;
  for (const dx of [-r * 0.82, r * 0.82]) { p.line('orange', 0.95, 1.8 * s, [[x + dx, y - hs + 1 * s], [x + dx, top + 4 * s]], 'butt'); p.line('night', 0.25, 1.8 * s, [[x + dx + 0.5 * s, y - hs + 1 * s], [x + dx + 0.5 * s, top + 4 * s]], 'butt'); }
  p.line('night', 0.6, 1 * s, [[x - r * 0.82, top + 9 * s], [x + r * 0.82, top + 9 * s]]);
  p.line('night', 0.5, 0.5 * s, [[x + 1 * s, top + 9 * s], [x + 1 * s, y - hs - 9 * s]]);
  const w = r * 1.12;
  const lf = [[x - w, top + 6 * s], [x, top - 3 * s], [x, top + 1 * s], [x - w + 1 * s, top + 8.5 * s]];
  const rt = [[x + w, top + 6 * s], [x, top - 3 * s], [x, top + 1 * s], [x + w - 1 * s, top + 8.5 * s]];
  p.poly('paper', 1, lf); p.poly(strecha, 0.9, lf);
  p.poly('paper', 1, rt); p.poly(strecha, 0.9, rt); p.poly('night', 0.22, rt);
  p.line('night', 0.35, 1 * s, [[x - w, top + 6 * s], [x, top - 3 * s], [x + w, top + 6 * s]]);
  // the bucket
  const bx = x + 1 * s, by = y - hs - 5 * s;
  p.poly('paper', 1, [[bx - 2.6 * s, by - 4 * s], [bx + 2.6 * s, by - 4 * s], [bx + 2 * s, by], [bx - 2 * s, by]]);
  p.poly('teal', 0.75, [[bx - 2.6 * s, by - 4 * s], [bx + 2.6 * s, by - 4 * s], [bx + 2 * s, by], [bx - 2 * s, by]]);
  p.line('night', 0.4, 0.5 * s, [[bx - 2.6 * s, by - 4 * s], [bx + 2.6 * s, by - 4 * s]]);
}

/* ── A haystack ───────────────────────────────────────────────────────── */
export function kopa(p, x, y, s = 1, seed = 1) {
  const w = 15 * s, h = 20 * s;
  p.ellipse('dots', 0.5, x + 7 * s, y + 1 * s, w + 5 * s, 4.5 * s);
  const tvar = R(c => {
    c.moveTo(x - w, y);
    c.bezierCurveTo(x - w * 1.02, y - h * 0.7, x - w * 0.45, y - h * 1.05, x + w * 0.05, y - h);
    c.bezierCurveTo(x + w * 0.6, y - h * 0.95, x + w * 1.05, y - h * 0.55, x + w, y);
    c.quadraticCurveTo(x, y + 4 * s, x - w, y);
  });
  p.path('paper', 1, tvar);
  p.path('sun', 0.95, tvar);
  p.path('orange', 0.28, R(c => { c.moveTo(x + w * 0.05, y - h); c.bezierCurveTo(x + w * 0.6, y - h * 0.95, x + w * 1.05, y - h * 0.55, x + w, y); c.quadraticCurveTo(x + w * 0.5, y + 2.6 * s, x + w * 0.1, y + 2 * s); c.closePath(); }));
  for (let k = 0; k < 16; k++) {
    const u = hash2(seed, k) * 1.6 - 0.8, v = hash2(k, seed) * 0.8 + 0.1;
    const px = x + u * w * (1 - v * 0.5), py = y - v * h;
    const a = -PI / 2 + u * 0.9;
    p.line('orange', 0.55, 0.6 * s, [[px, py], [px + cos(a) * 3.4 * s, py + sin(a) * 3.4 * s]]);
  }
  // a band of twine round its waist
  p.path('orange', 0.7, R(c => c.ellipse(x, y - h * 0.34, w * 0.97, 3 * s, 0, 0.1, PI - 0.1)), 1 * s);
}

/* ── A sunflower ───────────────────────────────────────────────────────── */
export function slnecnica(p, x, y, s = 1, h = 34, nak = 0) {
  const hy = y - h * s, hx = x + nak * 3 * s;
  p.ellipse('dots', 0.4, x + 3 * s, y + 0.5 * s, 5 * s, 1.6 * s);
  p.path('green', 0.9, R(c => { c.moveTo(x, y); c.quadraticCurveTo(x + nak * 1 * s, y - h * s * 0.5, hx, hy + 3 * s); }), 1.4 * s);
  for (const [f, d] of [[0.35, -1], [0.58, 1]]) {
    const ly = y - h * s * f, lx = x + nak * f * 1.5 * s;
    p.ellipse('green', 0.85, lx + d * 4 * s, ly - 1.2 * s, 4.4 * s, 1.9 * s, d * -0.5);
    p.ellipse('teal', 0.25, lx + d * 4.6 * s, ly - 0.8 * s, 3 * s, 1 * s, d * -0.5);
  }
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * TAU + 0.13;
    p.ellipse('paper', 1, hx + cos(a) * 4.6 * s, hy + sin(a) * 4.2 * s, 2.7 * s, 1.2 * s, a);
    p.ellipse('sun', 0.95, hx + cos(a) * 4.6 * s, hy + sin(a) * 4.2 * s, 2.7 * s, 1.2 * s, a);
  }
  p.circle('orange', 0.85, hx, hy, 3.1 * s);
  p.circle('night', 0.45, hx + 0.4 * s, hy + 0.4 * s, 2.4 * s);
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; p.circle('sun', 0.6, hx + cos(a) * 1.4 * s, hy + sin(a) * 1.4 * s, 0.45 * s); }
}

/* ── A clump of tall grass ─────────────────────────────────────────────── */
export function trava(p, x, y, s = 1, seed = 1) {
  p.ellipse('dots', 0.35, x + 3 * s, y + 0.5 * s, 8 * s, 2 * s);
  for (let k = 0; k < 13; k++) {
    const u = (k - 6) / 6, h = (8 + hash2(seed, k) * 8 - abs(u) * 3) * s, lean = u * 5 * s + (hash2(k, seed) - 0.5) * 3 * s;
    const ink = k % 4 === 0 ? 'teal' : k % 5 === 1 ? 'sun' : 'green', a = ink === 'sun' ? 0.7 : 0.85;
    p.path(ink, a, R(c => { c.moveTo(x + u * 4 * s - 0.9 * s, y); c.quadraticCurveTo(x + u * 4.5 * s + lean * 0.3, y - h * 0.6, x + u * 4 * s + lean, y - h); c.quadraticCurveTo(x + u * 4.5 * s + lean * 0.3 + 0.6 * s, y - h * 0.55, x + u * 4 * s + 0.9 * s, y); c.closePath(); }));
  }
}

/* ── A row of cabbages along i, from (x, y), n heads ───────────────────── */
export function kapusty(p, x, y, n, s = 1, seed = 1) {
  for (let k = 0; k < n; k++) {
    const [cx, cy] = naZemi(x, y, k * 0.36, 0);
    const r = (4.6 + hash2(seed, k) * 0.8) * s;
    p.ellipse('dots', 0.4, cx + 2 * s, cy + 0.5 * s, r * 1.2, r * 0.4);
    const list = R(c => { for (let q = 0; q < 6; q++) { const a = PI + q / 5 * PI; c.moveTo(cx + cos(a) * r * 0.8 + r * 0.55, cy - r * 0.35 + sin(a) * r * 0.5); c.ellipse(cx + cos(a) * r * 0.8, cy - r * 0.35 + sin(a) * r * 0.5, r * 0.55, r * 0.42, a, 0, TAU); } });
    p.path('paper', 1, list); p.path('green', 0.8, list); p.path('teal', 0.25, list);
    p.circle('paper', 1, cx, cy - r * 0.55, r * 0.62);
    p.circle('green', 0.55, cx, cy - r * 0.55, r * 0.62);
    p.circle('sun', 0.35, cx - r * 0.18, cy - r * 0.72, r * 0.3);
    p.path('green', 0.7, R(c => { c.moveTo(cx - r * 0.3, cy - r * 0.2); c.quadraticCurveTo(cx, cy - r * 0.9, cx + r * 0.35, cy - r * 0.25); }), 0.5 * s);
  }
}

/* ── A pile of logs, ends showing ─────────────────────────────────────── */
export function drevo(p, x, y, s = 1) {
  p.ellipse('dots', 0.5, x + 6 * s, y + 0.5 * s, 14 * s, 3.5 * s);
  const r = 3.2 * s;
  const kusy = [[-7.4, 0], [-1, 0.3], [5.4, 0], [-4.2, -5.6], [2.2, -5.4], [-1, -10.9]];
  // the bark along the pile, seen from the side, behind the ends
  p.poly('orange', 0.7, [[x - 10.6 * s, y - 1 * s], [x - 4.2 * s - r, y - 14 * s], [x - 1 * s + r + 7 * s, y - 16 * s], [x + 5.4 * s + r + 7 * s, y - 4.5 * s], [x + 5.4 * s + r, y - 0.2 * s]]);
  p.poly('night', 0.3, [[x - 10.6 * s, y - 1 * s], [x - 4.2 * s - r, y - 14 * s], [x - 1 * s + r + 7 * s, y - 16 * s], [x + 5.4 * s + r + 7 * s, y - 4.5 * s], [x + 5.4 * s + r, y - 0.2 * s]]);
  for (const [dx, dy] of kusy) {
    const cx = x + dx * s, cy = y - r + dy * s;
    p.circle('paper', 1, cx, cy, r);
    p.circle('sun', 0.75, cx, cy, r);
    p.circle('orange', 0.35, cx, cy, r);
    p.path('orange', 0.8, R(c => c.arc(cx, cy, r * 0.55, 0, TAU)), 0.5 * s);
    p.path('night', 0.45, R(c => c.arc(cx, cy, r, 0, TAU)), 0.7 * s);
  }
}

/* ── Flower pots by a door ─────────────────────────────────────────────── */
export function crepnik(p, x, y, s = 1, kvet = 'pink') {
  p.ellipse('dots', 0.45, x + 3 * s, y + 0.4 * s, 6 * s, 2 * s);
  const w = 3.6 * s, h = 6 * s;
  const pot = [[x - w, y - h], [x + w, y - h], [x + w * 0.72, y], [x - w * 0.72, y]];
  p.poly('paper', 1, pot); p.poly('orange', 0.9, pot); p.poly('pink', 0.25, pot);
  p.poly('night', 0.2, [[x + w * 0.2, y - h], [x + w, y - h], [x + w * 0.72, y], [x + w * 0.1, y]]);
  p.poly('orange', 1, [[x - w - 0.6 * s, y - h - 1.6 * s], [x + w + 0.6 * s, y - h - 1.6 * s], [x + w + 0.6 * s, y - h], [x - w - 0.6 * s, y - h]]);
  for (let k = 0; k < 5; k++) {
    const a = -PI / 2 + (k - 2) * 0.42, L = (6 + (k % 2) * 2.5) * s;
    const ex = x + cos(a) * L * 0.8, ey = y - h - 1.6 * s + sin(a) * L;
    p.line('green', 0.85, 0.8 * s, [[x + (k - 2) * 0.8 * s, y - h - 1 * s], [ex, ey]]);
    p.ellipse('green', 0.8, (x + ex) / 2 + (k - 2) * 1.2 * s, (y - h + ey) / 2, 1.6 * s, 0.8 * s, a + 0.8);
    p.circle('paper', 1, ex, ey, 1.9 * s);
    p.circle(k % 2 ? kvet : 'sun', 0.95, ex, ey, 1.9 * s);
    p.circle('sun', 0.9, ex, ey, 0.6 * s);
  }
}

/* ── A lamp on a post (from the village paths) ─────────────────────────── */
export function lampa(p, x, y, s = 1) {
  p.ellipse('dots', 0.4, x + 2 * s, y + 1 * s, 4 * s, 1.5 * s);
  p.line('night', 0.75, 1.6 * s, [[x, y], [x, y - 30 * s]], 'butt');
  p.poly('night', 0.8, [[x - 3.4 * s, y - 30 * s], [x + 3.4 * s, y - 30 * s], [x + 2.2 * s, y - 39 * s], [x - 2.2 * s, y - 39 * s]]);
  p.poly('sun', 0.9, [[x - 2.3 * s, y - 31 * s], [x + 2.3 * s, y - 31 * s], [x + 1.5 * s, y - 37.5 * s], [x - 1.5 * s, y - 37.5 * s]]);
  p.poly('night', 0.85, [[x - 3 * s, y - 39 * s], [x + 3 * s, y - 39 * s], [x, y - 42 * s]]);
}

/* ── A birdhouse on a post ─────────────────────────────────────────────── */
export function budka(p, x, y, s = 1, ink = 'teal') {
  p.ellipse('dots', 0.4, x + 2 * s, y + 0.8 * s, 4 * s, 1.4 * s);
  p.line('orange', 0.95, 1.8 * s, [[x, y], [x, y - 26 * s]], 'butt');
  p.line('night', 0.3, 1.8 * s, [[x + 0.5 * s, y], [x + 0.5 * s, y - 26 * s]], 'butt');
  const b = y - 26 * s, w = 5 * s, h = 7 * s;
  const box = [[x - w, b], [x + w, b], [x + w, b - h], [x, b - h - 4.5 * s], [x - w, b - h]];
  p.poly('paper', 1, box); p.poly(ink, 0.8, box);
  p.poly('night', 0.2, [[x + 1 * s, b], [x + w, b], [x + w, b - h], [x + 1 * s, b - h - 3.6 * s]]);
  p.circle('night', 0.9, x - 0.4 * s, b - h * 0.55, 1.5 * s);
  p.line('orange', 0.95, 1.4 * s, [[x - w - 1.2 * s, b - h + 0.6 * s], [x, b - h - 5 * s], [x + w + 1.2 * s, b - h + 0.6 * s]]);
  p.line('orange', 0.9, 0.8 * s, [[x - 0.4 * s, b - h * 0.2], [x - 0.4 * s, b + 1.4 * s]]);
}

/* ── A wheelbarrow ─────────────────────────────────────────────────────── */
export function furik(p, x, y, s = 1, ink = 'green', f = 1) {
  const c = p.c; c.save(); c.translate(x, y); c.scale(f, 1);
  p.ellipse('dots', 0.45, 3 * s, 0.6 * s, 13 * s, 3 * s);
  // handles and legs
  p.line('orange', 0.95, 1.3 * s, [[-12 * s, -8 * s], [-3 * s, -8 * s]]);
  p.line('orange', 0.95, 1.3 * s, [[-11 * s, -6.4 * s], [-2 * s, -6.8 * s]]);
  p.line('orange', 0.9, 1.2 * s, [[-5 * s, -7 * s], [-6 * s, 0]], 'butt');
  // tray
  const tray = [[-6 * s, -13.5 * s], [8.5 * s, -13.5 * s], [6 * s, -6 * s], [-3.4 * s, -5.6 * s]];
  p.poly('paper', 1, tray); p.poly(ink, 0.85, tray);
  p.poly('night', 0.22, [[2 * s, -13.5 * s], [8.5 * s, -13.5 * s], [6 * s, -6 * s], [2 * s, -5.8 * s]]);
  p.ellipse('night', 0.55, 1.2 * s, -13.5 * s, 7.4 * s, 1.6 * s);
  p.ellipse('orange', 0.5, 1.2 * s, -13.9 * s, 6.6 * s, 1.2 * s);
  // wheel
  p.circle('paper', 1, 8 * s, -3.6 * s, 3.6 * s);
  p.circle('night', 0.75, 8 * s, -3.6 * s, 3.6 * s);
  p.circle('paper', 1, 8 * s, -3.6 * s, 2.2 * s);
  p.circle('orange', 0.9, 8 * s, -3.6 * s, 2.2 * s);
  p.circle('night', 0.8, 8 * s, -3.6 * s, 0.7 * s);
  c.restore();
}

/* ── A basket of apples ───────────────────────────────────────────────── */
export function kosik(p, x, y, s = 1, ovocie = 'pink') {
  p.ellipse('dots', 0.45, x + 3 * s, y + 0.5 * s, 7 * s, 2.2 * s);
  const w = 5.4 * s, h = 6 * s;
  for (const [dx, dy] of [[-2.2, -1], [1.6, -1.4], [-0.2, -3], [3, -0.4], [-3.6, 0.2]]) {
    p.circle('paper', 1, x + dx * s, y - h + dy * s, 1.9 * s);
    p.circle(ovocie, 0.95, x + dx * s, y - h + dy * s, 1.9 * s);
    p.circle('sun', 0.5, x + dx * s - 0.6 * s, y - h + dy * s - 0.6 * s, 0.6 * s);
  }
  const b = [[x - w, y - h], [x + w, y - h], [x + w * 0.78, y], [x - w * 0.78, y]];
  p.poly('paper', 1, b); p.poly('sun', 0.85, b); p.poly('orange', 0.4, b);
  for (let k = 1; k < 3; k++) p.line('orange', 0.8, 0.6 * s, [[x - w + k * 0.05 * s, y - h + k * h / 3], [x + w - k * 0.07 * s, y - h + k * h / 3]]);
  for (let k = -2; k <= 2; k++) p.line('orange', 0.6, 0.5 * s, [[x + k * 2 * s, y - h], [x + k * 1.6 * s, y]]);
  p.path('orange', 0.9, R(c => c.ellipse(x, y - h, w, 5.4 * s, 0, PI, TAU)), 0.9 * s);
}

/* ── Reeds by water ───────────────────────────────────────────────────── */
export function trstie(p, x, y, s = 1) {
  for (let k = 0; k < 5; k++) {
    const dx = (k - 2) * 2.4 * s, h = (10 + (k % 2) * 5 + (k === 2 ? 3 : 0)) * s;
    p.line('green', 0.85, 1 * s, [[x + dx, y], [x + dx + (k - 2) * 1.1 * s, y - h]]);
  }
  p.ellipse('orange', 0.9, x + 1.4 * s, y - 15 * s, 1.2 * s, 3.2 * s);
  p.ellipse('orange', 0.9, x - 3.6 * s, y - 11 * s, 1.1 * s, 2.8 * s);
}

/* ── A rowing boat on water ───────────────────────────────────────────── */
export function lodka(p, x, y, s = 1, ink = 'pink') {
  p.ellipse('blue', 0.25, x + 1 * s, y + 1.4 * s, 19 * s, 4.6 * s);
  const trup = R(c => { c.moveTo(x - 18 * s, y - 6 * s); c.quadraticCurveTo(x - 12 * s, y + 2.4 * s, x, y + 2 * s); c.quadraticCurveTo(x + 13 * s, y + 1.4 * s, x + 18 * s, y - 6.5 * s); c.lineTo(x + 15 * s, y - 5 * s); c.lineTo(x - 15 * s, y - 4.6 * s); c.closePath(); });
  p.path('paper', 1, trup); p.path(ink, 0.85, trup);
  p.path('night', 0.22, R(c => { c.moveTo(x - 17 * s, y - 4.4 * s); c.quadraticCurveTo(x - 12 * s, y + 2.4 * s, x, y + 2 * s); c.quadraticCurveTo(x + 13 * s, y + 1.4 * s, x + 17 * s, y - 4.8 * s); c.quadraticCurveTo(x, y - 1.2 * s, x - 17 * s, y - 4.4 * s); }));
  const vnut = R(c => c.ellipse(x, y - 5 * s, 15 * s, 3 * s, 0, 0, TAU));
  p.path('paper', 1, vnut); p.path('orange', 0.55, vnut); p.path('night', 0.2, vnut);
  p.line('orange', 0.95, 1.6 * s, [[x - 4 * s, y - 7.6 * s], [x - 3 * s, y - 2.4 * s]]);
  p.line('orange', 0.95, 1.6 * s, [[x + 6 * s, y - 7.6 * s], [x + 7 * s, y - 2.4 * s]]);
  p.line('orange', 0.9, 1 * s, [[x + 2 * s, y - 6 * s], [x + 22 * s, y - 1 * s]]);
  p.ellipse('orange', 0.9, x + 23 * s, y - 0.8 * s, 2.6 * s, 1 * s, 0.25);
}

/* ── A little jetty: from the bank at (x, y) out over the water along -i ── */
export function mola(p, x, y, s = 1) {
  const L = 1.15 * s, D = 0.2 * s, z = 4.5 * s;
  const q = (u, v, h) => naZemi(x, y, u, v, h);
  // posts into the water, their reflections
  for (const u of [-L + 0.06, -L * 0.5]) for (const v of [-D, D]) {
    const a = q(u, v, 0), b = q(u, v, z);
    p.line('night', 0.7, 1.5 * s, [[a[0], a[1] + 3 * s], b], 'butt');
    p.line('blue', 0.35, 1.5 * s, [[a[0], a[1] + 3 * s], [a[0], a[1] + 7 * s]], 'butt');
  }
  const deck = [q(-L, -D, z), q(0.1, -D, z), q(0.1, D, z), q(-L, D, z)];
  p.poly('paper', 1, deck); p.poly('orange', 0.8, deck); p.poly('sun', 0.3, deck);
  const lic = [q(-L, D, z), q(0.1, D, z), q(0.1, D, z - 1.8 * s), q(-L, D, z - 1.8 * s)];
  p.poly('orange', 0.95, lic); p.poly('night', 0.35, lic);
  const koniec = [q(-L, -D, z), q(-L, D, z), q(-L, D, z - 1.8 * s), q(-L, -D, z - 1.8 * s)];
  p.poly('orange', 0.95, koniec); p.poly('night', 0.2, koniec);
  for (let u = -L + 0.13; u < 0.08; u += 0.13) p.line('night', 0.3, 0.5 * s, [q(u, -D, z), q(u, D, z)]);
}

/* ═══ Things to find ═══════════════════════════════════════════════════ */

/* A cat. pose 'sit' or 'curl'; f = facing; coat 'ginger' or 'grey'; b breath;
   k blink; g a gesture 0..1 (tail swish, ears up) */
export function macka(p, x, y, s = 1, f = 1, b = 0, k = false, g = 0, pose = 'sit', coat = 'ginger') {
  const srst = coat === 'grey' ? 'blue' : 'orange', a1 = coat === 'grey' ? 0.5 : 0.95;
  const druha = coat === 'grey' ? 'night' : 'sun', a2 = coat === 'grey' ? 0.3 : 0.5;
  const c = p.c; c.save(); c.translate(x, y); c.scale(f, 1);
  p.ellipse('dots', 0.45, 1 * s, 0.5 * s, 10 * s, 2.4 * s);
  if (pose === 'curl') {
    const br = 1 + b * 0.06;
    const telo = R(cc => cc.ellipse(0, -4 * s * br, 9.5 * s, 4.6 * s * br, 0, 0, TAU));
    p.path('paper', 1, telo); p.path(srst, a1, telo); p.path(druha, a2, R(cc => cc.ellipse(-1 * s, -5.6 * s, 6 * s, 2.2 * s, -0.1, 0, TAU)));
    for (const dx of [-5, -1.5, 2]) p.path('night', coat === 'grey' ? 0.3 : 0.35, R(cc => { cc.moveTo(dx * s, -8.4 * s); cc.quadraticCurveTo((dx + 1.2) * s, -6 * s, (dx + 0.4) * s, -3.6 * s); }), 0.8 * s);
    // the tail wraps round the front
    p.path(srst, a1, R(cc => { cc.moveTo(-8.6 * s, -2.2 * s); cc.quadraticCurveTo(-4 * s, 1.4 * s, 4 * s, 0.4 * s); cc.quadraticCurveTo(8 * s, -0.4 * s, 9.2 * s, -2.4 * s); cc.quadraticCurveTo(6 * s, -1.2 * s, -6 * s, -1.4 * s); cc.closePath(); }));
    p.path('night', 0.2, R(cc => { cc.moveTo(4 * s, 0.4 * s); cc.quadraticCurveTo(8 * s, -0.4 * s, 9.2 * s, -2.4 * s); cc.lineTo(7.4 * s, -1.4 * s); cc.closePath(); }));
    // head resting
    const hx = 6 * s, hy = -5 * s;
    p.circle('paper', 1, hx, hy, 3.8 * s); p.circle(srst, a1, hx, hy, 3.8 * s);
    p.poly(srst, a1, [[hx - 3.4 * s, hy - 1.6 * s], [hx - 2.6 * s, hy - 6.2 * s], [hx - 0.4 * s, hy - 3.2 * s]]);
    p.poly(srst, a1, [[hx + 0.6 * s, hy - 3.4 * s], [hx + 2.6 * s, hy - 6.4 * s], [hx + 3.6 * s, hy - 1.8 * s]]);
    p.poly('pink', 0.55, [[hx - 2.7 * s, hy - 2.4 * s], [hx - 2.4 * s, hy - 4.8 * s], [hx - 1.2 * s, hy - 3.2 * s]]);
    p.path('night', 0.85, R(cc => cc.arc(hx - 1.2 * s, hy - 0.2 * s, 0.9 * s, 0.3, 2.8)), 0.45 * s);
    p.path('night', 0.85, R(cc => cc.arc(hx + 1.6 * s, hy - 0.2 * s, 0.9 * s, 0.3, 2.8)), 0.45 * s);
    p.circle('pink', 0.9, hx + 0.3 * s, hy + 1.3 * s, 0.6 * s);
    c.restore();
    return;
  }
  // sitting, seen from the side, head turned to us
  const sw = g * 0.8;
  p.path(srst, a1, R(cc => { cc.moveTo(-4 * s, -1 * s); cc.bezierCurveTo(-11 * s, -1 * s, -12 * s, -7 * s - sw * 4 * s, -9 * s - sw * 2 * s, -12 * s - sw * 3 * s); cc.bezierCurveTo(-10 * s - sw * 2 * s, -7 * s - sw * 2 * s, -8 * s, -2.8 * s, -3 * s, -3 * s); cc.closePath(); }));
  const telo = R(cc => { cc.moveTo(-5.5 * s, 0); cc.bezierCurveTo(-6.4 * s, -6 * s, -3.6 * s, -12.4 * s * (1 + b * 0.03), 0.4 * s, -12.6 * s); cc.bezierCurveTo(3.8 * s, -12.4 * s, 5.2 * s, -6 * s, 4.4 * s, 0); cc.closePath(); });
  p.path('paper', 1, telo); p.path(srst, a1, telo);
  p.path(druha, a2, R(cc => cc.ellipse(1.6 * s, -5.6 * s, 2.2 * s, 4.4 * s, 0.1, 0, TAU)));
  for (const yy of [-9, -6, -3]) p.path('night', coat === 'grey' ? 0.3 : 0.35, R(cc => { cc.moveTo(-5 * s, yy * s); cc.quadraticCurveTo(-3.4 * s, (yy + 0.6) * s, -2.6 * s, (yy + 1.8) * s); }), 0.8 * s);
  p.line('paper', 1, 1.6 * s, [[1 * s, -1.6 * s], [1.2 * s, 0]]);
  p.line('paper', 1, 1.6 * s, [[3 * s, -1.6 * s], [3.1 * s, 0]]);
  // head
  const hx = 1.2 * s, hy = -15.6 * s;
  p.circle('paper', 1, hx, hy, 4.4 * s); p.circle(srst, a1, hx, hy, 4.4 * s);
  const ucho = g * 0.5;
  p.poly('paper', 1, [[hx - 4.2 * s, hy - 1.4 * s], [hx - 3.4 * s - ucho * s, hy - 7.2 * s], [hx - 0.8 * s, hy - 3.8 * s]]);
  p.poly(srst, a1, [[hx - 4.2 * s, hy - 1.4 * s], [hx - 3.4 * s - ucho * s, hy - 7.2 * s], [hx - 0.8 * s, hy - 3.8 * s]]);
  p.poly('paper', 1, [[hx + 0.8 * s, hy - 3.8 * s], [hx + 3.4 * s + ucho * s, hy - 7.2 * s], [hx + 4.2 * s, hy - 1.4 * s]]);
  p.poly(srst, a1, [[hx + 0.8 * s, hy - 3.8 * s], [hx + 3.4 * s + ucho * s, hy - 7.2 * s], [hx + 4.2 * s, hy - 1.4 * s]]);
  p.poly('pink', 0.55, [[hx - 3.4 * s, hy - 2.4 * s], [hx - 3 * s, hy - 5.6 * s], [hx - 1.6 * s, hy - 3.6 * s]]);
  p.poly('pink', 0.55, [[hx + 1.6 * s, hy - 3.6 * s], [hx + 3 * s, hy - 5.6 * s], [hx + 3.4 * s, hy - 2.4 * s]]);
  p.ellipse('paper', 1, hx, hy + 1.8 * s, 2.6 * s, 1.8 * s);
  p.ellipse(druha, a2 * 0.6, hx, hy + 1.8 * s, 2.6 * s, 1.8 * s);
  if (k) { p.line('night', 0.9, 0.6 * s, [[hx - 2.4 * s, hy - 0.4 * s], [hx - 0.8 * s, hy - 0.4 * s]]); p.line('night', 0.9, 0.6 * s, [[hx + 0.8 * s, hy - 0.4 * s], [hx + 2.4 * s, hy - 0.4 * s]]); }
  else {
    p.ellipse('green', 0.9, hx - 1.6 * s, hy - 0.4 * s, 1.05 * s, 1.2 * s); p.ellipse('green', 0.9, hx + 1.6 * s, hy - 0.4 * s, 1.05 * s, 1.2 * s);
    p.ellipse('night', 1, hx - 1.6 * s, hy - 0.4 * s, 0.4 * s, 1 * s); p.ellipse('night', 1, hx + 1.6 * s, hy - 0.4 * s, 0.4 * s, 1 * s);
  }
  p.poly('pink', 1, [[hx - 0.7 * s, hy + 1.1 * s], [hx + 0.7 * s, hy + 1.1 * s], [hx, hy + 1.9 * s]]);
  for (const d of [-1, 1]) {
    p.line('night', 0.5, 0.3 * s, [[hx + d * 1.6 * s, hy + 2 * s], [hx + d * 5.4 * s, hy + 1.2 * s]]);
    p.line('night', 0.5, 0.3 * s, [[hx + d * 1.6 * s, hy + 2.4 * s], [hx + d * 5.2 * s, hy + 3 * s]]);
  }
  c.restore();
}

/* A watering can; ink its paint */
export function krhla(p, x, y, s = 1, f = 1, ink = 'teal', g = 0) {
  const c = p.c; c.save(); c.translate(x, y); c.scale(f, 1); c.rotate(-g * 0.12);
  p.ellipse('dots', 0.45, 2 * s, 0.5 * s, 9 * s, 2.4 * s);
  // spout
  p.path('paper', 1, R(cc => { cc.moveTo(4 * s, -3 * s); cc.lineTo(13 * s, -12 * s); cc.lineTo(14.2 * s, -10.8 * s); cc.lineTo(5 * s, -1.4 * s); cc.closePath(); }));
  p.path(ink, 0.85, R(cc => { cc.moveTo(4 * s, -3 * s); cc.lineTo(13 * s, -12 * s); cc.lineTo(14.2 * s, -10.8 * s); cc.lineTo(5 * s, -1.4 * s); cc.closePath(); }));
  p.path('paper', 1, R(cc => { cc.moveTo(12 * s, -12.6 * s); cc.lineTo(15.4 * s, -14.4 * s); cc.lineTo(16.6 * s, -10.2 * s); cc.lineTo(14.4 * s, -10.2 * s); cc.closePath(); }));
  p.path(ink, 0.95, R(cc => { cc.moveTo(12 * s, -12.6 * s); cc.lineTo(15.4 * s, -14.4 * s); cc.lineTo(16.6 * s, -10.2 * s); cc.lineTo(14.4 * s, -10.2 * s); cc.closePath(); }));
  p.path('night', 0.3, R(cc => { cc.moveTo(15.4 * s, -14.4 * s); cc.lineTo(16.6 * s, -10.2 * s); cc.lineTo(15.8 * s, -10.2 * s); cc.closePath(); }));
  // body
  const t = R(cc => { cc.moveTo(-6 * s, -0.6 * s); cc.lineTo(-6 * s, -10 * s); cc.ellipse(0, -10 * s, 6 * s, 2 * s, 0, PI, 0); cc.lineTo(6 * s, -0.6 * s); cc.ellipse(0, -0.6 * s, 6 * s, 2 * s, 0, 0, PI); cc.closePath(); });
  p.path('paper', 1, t); p.path(ink, 0.85, t);
  p.path('night', 0.22, R(cc => { cc.moveTo(1.6 * s, -11.9 * s); cc.ellipse(0, -10 * s, 6 * s, 2 * s, 0, -1.3, 0); cc.lineTo(6 * s, -0.6 * s); cc.ellipse(0, -0.6 * s, 6 * s, 2 * s, 0, 0, 1.3); cc.closePath(); }));
  p.path('sun', 0.4, R(cc => { cc.rect(-4.6 * s, -9.6 * s, 1.6 * s, 8 * s); }));
  p.ellipse('night', 0.55, 0, -10 * s, 4.6 * s, 1.3 * s);
  // handle over the top, back to the side
  p.path(ink, 0.95, R(cc => { cc.moveTo(-4.8 * s, -11 * s); cc.bezierCurveTo(-4 * s, -18.4 * s, 3.4 * s, -18.4 * s, 4.2 * s, -11.2 * s); }), 1.5 * s);
  p.path(ink, 0.95, R(cc => { cc.moveTo(-6 * s, -9 * s); cc.bezierCurveTo(-10.4 * s, -8.4 * s, -10 * s, -3.4 * s, -6 * s, -3 * s); }), 1.4 * s);
  c.restore();
}

/* A kite: a diamond of four inks on two sticks, and a tail of bows */
export function drak(p, x, y, s = 1, g = 0, farby = ['pink', 'sun', 'blue', 'paper']) {
  const c = p.c; c.save(); c.translate(x, y); c.rotate(0.35 + g * 0.18);
  const T = [0, -13 * s], Rr = [7.6 * s, -4 * s], B = [0, 7 * s], L = [-7.6 * s, -4 * s], M = [0, -4 * s];
  const kv = [[T, Rr, M], [Rr, B, M], [B, L, M], [L, T, M]];
  kv.forEach((q, n) => { p.poly('paper', 1, q); p.poly(farby[n], farby[n] === 'paper' ? 1 : 0.9, q); });
  p.poly('night', 0.16, [Rr, B, M]);
  p.line('orange', 0.9, 0.8 * s, [T, B]);
  p.line('orange', 0.9, 0.8 * s, [L, Rr]);
  p.line('night', 0.45, 0.7 * s, [T, Rr, B, L, T]);
  // tail
  const ch = [B, [2 * s, 12 * s], [-1 * s, 17 * s], [2.4 * s, 22 * s], [0, 27 * s]];
  p.line('night', 0.6, 0.5 * s, ch);
  for (let n = 1; n < ch.length; n++) {
    const q = ch[n], ink = n % 2 ? 'pink' : 'sun';
    p.poly(ink, 0.95, [[q[0] - 2.6 * s, q[1] - 1.4 * s], [q[0], q[1]], [q[0] - 2.6 * s, q[1] + 1.4 * s]]);
    p.poly(ink, 0.95, [[q[0] + 2.6 * s, q[1] - 1.4 * s], [q[0], q[1]], [q[0] + 2.6 * s, q[1] + 1.4 * s]]);
  }
  c.restore();
}
