/* Puzzle Village: the fourteen places, one per daily puzzle, and the square.
   Each place has a static part, printed once into the cached plate, and a few
   small sprites that move. A sprite says how it looks at time t as a short list
   of numbers (st); the village redraws it only when those numbers change by at
   least half a screen pixel, so a slow breath at a far zoom costs nothing. */
import {
  iso, RX, RY, box, faceJ, faceI, cottage, tree, bush, flowers, stone, fence, eye, chimneyTop,
  hedgehog, otter, magpie, crane, squirrel, badger, dormouse, hare, heron, swan, vole, beaver, owl, fox
} from './iso.js?v=2';
import { hash } from './riso.js?v=2';

const TAU = Math.PI * 2;
const { sin, cos, min, max, abs, hypot, floor } = Math;
const wave = (t, per, ph = 0) => 0.5 + 0.5 * sin((t / per + ph) * TAU);
const blink = (t, seed) => { const per = 3.4 + (seed * 0.73) % 2.6; return ((t + seed * 1.37) % per) < 0.14; };
const B = v => (v ? 9 : 0);
const ease = x => x * x * (3 - 2 * x);
const clamp01 = x => max(0, min(1, x));
const step = t => floor(t * 12) / 12;       // secondary motion runs at 12 frames a second, a flip book

function quad(i0, j0, w, d, h = 0) { return [iso(i0, j0, h), iso(i0 + w, j0, h), iso(i0 + w, j0 + d, h), iso(i0, j0 + d, h)]; }
function ground(p, ink, a, i0, j0, w, d) { p.poly(ink, a, quad(i0, j0, w, d)); }

/* a number on a little round sign stuck in the ground */
function tag(p, x, y, n, ink = 'paper', size = 1) {
  p.line('orange', 0.9, 1, [[x, y], [x, y - 7 * size]]);
  p.circle(ink, 1, x, y - 10 * size, 4.4 * size);
  p.path('night', 0.7, (c, ox, oy) => c.arc(x + ox, y - 10 * size + oy, 4.4 * size, 0, TAU), 0.7);
  p.text('night', 0.95, String(n), x, y - 9.7 * size, 6 * size, 700);
}
/* an upright board on the +j face plane, with two legs */
function board(p, i0, jf, w, v0, v1, frame = 'orange') {
  p.line('orange', 0.9, 1.6, [iso(i0 + 0.12, jf, 0), iso(i0 + 0.12, jf, v0 + 2)], 'butt');
  p.line('orange', 0.9, 1.6, [iso(i0 + w - 0.12, jf, 0), iso(i0 + w - 0.12, jf, v0 + 2)], 'butt');
  faceJ(p, frame, 0.9, i0, jf, 0, w, v0, v1);
  faceJ(p, 'night', 0.2, i0, jf, 0, w, v0, v0 + 1.4);
  faceJ(p, 'paper', 1, i0, jf, 0.05, w - 0.05, v0 + 2, v1 - 2);
}
function mound(p, X, Y, w, h, lean = 0) {
  const shape = (c, ox, oy) => {
    c.moveTo(X - w + ox, Y + oy);
    c.bezierCurveTo(X - w * 0.9 + ox, Y - h * 0.8 + oy, X - w * 0.3 + lean + ox, Y - h + oy, X + lean + ox, Y - h + oy);
    c.bezierCurveTo(X + w * 0.45 + lean + ox, Y - h + oy, X + w * 0.9 + ox, Y - h * 0.6 + oy, X + w + ox, Y + oy);
    c.quadraticCurveTo(X + ox, Y + h * 0.42 + oy, X - w + ox, Y + oy);
  };
  p.ellipse('dots', 0.5, X + w * 0.25, Y + h * 0.18, w * 1.05, h * 0.36);
  p.path('paper', 1, shape);
  p.path('green', 0.78, shape);
  p.path('sun', 0.3, shape);
  p.path('blue', 0.22, (c, ox, oy) => { c.moveTo(X + lean * 0.5 + ox, Y - h + oy); c.bezierCurveTo(X + w * 0.45 + lean + ox, Y - h + oy, X + w * 0.9 + ox, Y - h * 0.6 + oy, X + w + ox, Y + oy); c.quadraticCurveTo(X + w * 0.5 + ox, Y + h * 0.36 + oy, X + ox, Y + h * 0.4 + oy); c.closePath(); });
  p.ellipse('sun', 0.35, X - w * 0.35, Y - h * 0.7, w * 0.3, h * 0.16, -0.2);
  for (let k = 0; k < 7; k++) {
    const gx = X - w * 0.7 + hash(k, X | 0) * w * 1.4, gy = Y - h * 0.15 - hash(k + 3, Y | 0) * h * 0.6;
    p.line('green', 0.8, 0.9, [[gx - 2, gy - 2.5], [gx - 0.8, gy + 0.4], [gx, gy - 3], [gx + 0.8, gy + 0.4], [gx + 2, gy - 2.5]]);
  }
}
function arch(p, x, y, w, h, frame = 'orange') {
  const a = (ww, hh) => (c, ox, oy) => { c.moveTo(x - ww + ox, y + oy); c.lineTo(x - ww + ox, y - hh + ww + oy); c.arc(x + ox, y - hh + ww + oy, ww, Math.PI, 0); c.lineTo(x + ww + ox, y + oy); c.closePath(); };
  p.path(frame, 0.9, a(w / 2 + 2, h + 2));
  p.path('night', 0.85, a(w / 2, h));
}
function lantern(p, x, y, hgt = 24) {
  p.line('night', 0.75, 1.5, [[x, y], [x, y - hgt]], 'butt');
  p.line('night', 0.75, 1.2, [[x, y - hgt], [x + 6, y - hgt]]);
  p.poly('night', 0.8, [[x + 3.4, y - hgt + 1], [x + 8.6, y - hgt + 1], [x + 8, y - hgt + 8], [x + 4, y - hgt + 8]]);
  const g = [[x + 4.3, y - hgt + 2], [x + 7.7, y - hgt + 2], [x + 7.3, y - hgt + 7], [x + 4.7, y - hgt + 7]];
  p.poly('sun', 0.95, g);
  if (p.glow) p.glow.push(g);
}
function ripple(x, y, rx, per, ph) {
  const r = t => ((step(t) / per + ph) % 1);
  return S([x - rx * 1.6, y - rx * 0.8, x + rx * 1.6, y + rx * 0.8], t => [floor(t * 12) * 9], (p, t) => {
    const f = r(t), a = (1 - f) * 0.6;
    p.path('paper', a, (c, ox, oy) => c.ellipse(x + ox, y + oy, rx * (0.4 + f * 1.1), rx * (0.2 + f * 0.55), 0, 0, TAU), 1);
  });
}
function smoke(pt, seed) {
  const [x, y] = pt, ph = hash(seed, 11);
  const puffs = t => [0, 1, 2].map(k => ((step(t) / 3.8 + k / 3 + ph) % 1));
  return S([x - 12, y - 40, x + 22, y + 4], t => [floor(t * 12) * 9], (p, t) => {
    for (const f of puffs(t)) {
      const px = x + f * 10 + sin(f * 6 + ph * 6) * 2.4, py = y - f * 32, r = 1.8 + f * 4.6;
      const a = (1 - f) * min(1, f * 5);
      p.circle('blue', a * 0.3, px, py, r);
      p.circle('paper', a * 0.55, px - r * 0.25, py - r * 0.3, r * 0.6);
    }
  });
}
/* walk along a closed or open polyline by distance d */
function track(pts, closed = true) {
  const segs = [];
  let L = 0;
  const n = closed ? pts.length : pts.length - 1;
  for (let k = 0; k < n; k++) {
    const a = pts[k], b = pts[(k + 1) % pts.length], l = hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, b, l, L }); L += l;
  }
  return { L, at(d) {
    d = ((d % L) + L) % L;
    for (const s of segs) if (d <= s.L + s.l) { const f = (d - s.L) / s.l; return [s.a[0] + (s.b[0] - s.a[0]) * f, s.a[1] + (s.b[1] - s.a[1]) * f, s.b[0] - s.a[0], s.b[1] - s.a[1]]; }
    const s = segs[segs.length - 1]; return [s.b[0], s.b[1], s.b[0] - s.a[0], s.b[1] - s.a[1]];
  } };
}
function S(box, st, draw) { return { box, st, draw }; }
/* a line drawn along a path once, when house k opens, then kept */
function trace(k, P, closed, ink, w, delay = 0.5, dur = 1.4) {
  const tr = track(P, closed);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const q of P) { x0 = min(x0, q[0]); y0 = min(y0, q[1]); x1 = max(x1, q[0]); y1 = max(y1, q[1]); }
  return S([x0 - 4, y0 - 4, x1 + 4, y1 + 4], t => [floor(act(k, t, dur, delay) * 40)], (p, t) => {
    const a = act(k, t, dur, delay); if (a <= 0) return;
    const L = tr.L * ease(a), pts = [P[0]];
    for (let d = 0; d < L; d += 3) { const q = tr.at(d); pts.push([q[0], q[1]]); }
    const q = tr.at(min(L, tr.L - 0.01)); pts.push([q[0], q[1]]);
    p.line(ink, 0.95, w, pts);
    if (a < 1) p.circle('sun', 1, q[0], q[1], w * 1.3);
  });
}
function still(x, y, w, h, st, draw) { return S([x - w * K, y - h * K, x + w * K, y + 4], st, draw); }

/* The animals at their puzzle, a size up from the rest of the village, so a
   house that opens shows a family you can actually see at work. */
const K = 1.35;

/* Only houses whose puzzle is out get a door that opens. The others stand in
   the village with a small "opening soon" board and no link. When a puzzle
   goes live (games/zoznam.json), add its key here and to the list in
   index.html. */
export const LIVE = new Set(['hedgehogs', 'dormice', 'badgers', 'hares', 'voles', 'swans', 'cranes', 'otters', 'magpies', 'squirrels', 'herons']);

/* The house that is open right now. Its family does one small thing when the
   card opens (a hedgehog wakes, a walkway is laid) and then stays like that. */
export const ACT = { k: null, t0: 0, done: new Set() };
function act(k, t, dur = 1.1, delay = 0.45) { return ACT.k === k ? clamp01((t - ACT.t0 - delay) / dur) : ACT.done.has(k) ? 1 : 0; }
/* the room is open only while its card is */
function actOpen(k, t, dur, delay) { return ACT.k === k ? clamp01((t - ACT.t0 - delay) / dur) : 0; }
const pop = x => (x <= 0 ? 0 : x >= 1 ? 1 : 1 + 2.2 * (x - 1) * (x - 1) * (x - 1) + 1.2 * (x - 1) * (x - 1));  // a small overshoot

/* A house seen from inside: the front wall sinks away and the room shows,
   like a doll's house. Everything is clipped to the front wall, so nothing
   leaks over the roof or the side. inside(p, a) draws what is in the room. */
function room(k, I, J, w, d, h, wall, inside) {
  const f = (u, v) => iso(I + u, J + d, v);
  const x0 = f(0, 0)[0], x1 = f(w, 0)[0], yt = f(0, h)[1], yb = f(w, 0)[1];
  const bx = [min(x0, x1) - 2, yt - 4, max(x0, x1) + 2, yb + 3];
  const s = S(bx, t => { const a = actOpen(k, t, 0.8, 0.25); return [floor(a * 24), a > 0 ? inside.st(t) : 0]; }, (p, t) => {
    const a = ease(actOpen(k, t, 0.8, 0.25));
    if (a <= 0) return;
    const top = h - 3.2, cut = top * (1 - a);       // the wall top sinks from top to 0
    const c = p.c;
    c.save();
    c.beginPath();
    const q = [f(0.04, cut), f(w - 0.04, cut), f(w - 0.04, top), f(0.04, top)];
    c.moveTo(q[0][0], q[0][1]); for (const r of q.slice(1)) c.lineTo(r[0], r[1]); c.closePath(); c.clip();
    // floor, back wall, left wall
    p.poly('paper', 1, [iso(I, J), iso(I + w, J), iso(I + w, J + d), iso(I, J + d)]);
    p.poly('orange', 0.3, [iso(I, J), iso(I + w, J), iso(I + w, J + d), iso(I, J + d)]);
    p.poly('sun', 0.25, [iso(I, J), iso(I + w, J), iso(I + w, J + d), iso(I, J + d)]);
    for (let n = 1; n < 5; n++) p.line('orange', 0.5, 0.6, [iso(I + w * n / 5, J), iso(I + w * n / 5, J + d)]);
    p.poly('paper', 1, [iso(I, J, 0), iso(I + w, J, 0), iso(I + w, J, h), iso(I, J, h)]);
    p.poly(wall, 0.22, [iso(I, J, 0), iso(I + w, J, 0), iso(I + w, J, h), iso(I, J, h)]);
    p.poly('paper', 1, [iso(I, J, 0), iso(I, J + d, 0), iso(I, J + d, h), iso(I, J, h)]);
    p.poly(wall, 0.3, [iso(I, J, 0), iso(I, J + d, 0), iso(I, J + d, h), iso(I, J, h)]);
    p.poly('night', 0.16, [iso(I, J, 0), iso(I, J + d, 0), iso(I, J + d, h), iso(I, J, h)]);
    p.line('orange', 0.6, 1.2, [iso(I, J + d, 1), iso(I, J, 1), iso(I + w, J, 1)]);
    // a warm lamp over the table, a rug
    const [lx, ly] = iso(I + w * 0.5, J + d * 0.5, h - 4);
    p.line('night', 0.6, 0.5, [[lx, ly - 6], [lx, ly]]);
    p.poly('night', 0.75, [[lx - 3, ly + 2.4], [lx + 3, ly + 2.4], [lx + 1.6, ly], [lx - 1.6, ly]]);
    p.circle('sun', 0.95, lx, ly + 3, 1.2);
    const [rx, ry] = iso(I + w * 0.5, J + d * 0.55);
    p.ellipse('pink', 0.28, rx, ry, w * 12, d * 5);
    inside.draw(p, t, a);
    // in the evening the room glows, lit by its lamp
    if (p.eve) {
      c.globalCompositeOperation = 'screen'; c.globalAlpha = 1;
      const g = c.createRadialGradient(lx, ly + 4, 0, lx, ly + 4, w * 30);
      g.addColorStop(0, 'rgba(255,200,120,0.55)'); g.addColorStop(1, 'rgba(255,200,120,0.08)');
      c.fillStyle = g; c.fillRect(x0 - 40, yt - 40, x1 - x0 + 80, yb - yt + 80);
      p.reset();
    }
    c.restore();
    // the sunk wall: plain boards with a lit top edge
    if (cut > 0.4) {
      const wq = [f(0, 0), f(w, 0), f(w, cut), f(0, cut)];
      p.poly('paper', 1, wq); p.poly(wall, 0.32, wq);
      p.line('paper', 1, 1, [f(0, cut), f(w, cut)]);
      p.line('night', 0.35, 0.6, [f(0, cut - 0.8), f(w, cut - 0.8)]);
    }
    faceJ(p, 'orange', 0.35, I, J + d, 0, w, 0, min(3, cut + 3));
  });
  s.focus = iso(I + w / 2, J + d / 2, h / 2);     // a phone camera looks here
  return s;
}
/* a little table with today's puzzle on it: a 3 x 3 grid, cells filling in */
function table(p, i, j, a, ink = 'pink') {
  for (const [u, v] of [[-0.12, 0.12], [0.12, 0.12], [0.12, -0.12]]) { const q = iso(i + u, j + v, 0), r = iso(i + u, j + v, 7); p.line('night', 0.7, 0.9, [q, r], 'butt'); }
  box(p, i - 0.16, j - 0.16, 0.32, 0.32, 1.2, ['orange', 0.85], ['orange', 0.7], ['orange', 0.95], 7);
  const g = 0.075;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const u = i - 0.11 + c * g, v = j - 0.11 + r * g;
    p.poly('paper', 1, [iso(u, v, 8.3), iso(u + g - 0.01, v, 8.3), iso(u + g - 0.01, v + g - 0.01, 8.3), iso(u, v + g - 0.01, 8.3)]);
    if ((r * 3 + c) % 4 === 0 || (r * 3 + c) / 9 < a * 0.9) p.poly(ink, 0.8, [iso(u, v, 8.3), iso(u + g - 0.01, v, 8.3), iso(u + g - 0.01, v + g - 0.01, 8.3), iso(u, v + g - 0.01, 8.3)]);
  }
}

/* ── The places ─────────────────────────────────────────────────────── */
export const PLACES = [];
function place(o) { o.x = iso(o.i, o.j)[0]; o.y = iso(o.i, o.j)[1]; o.soon = !o.square && !LIVE.has(o.kluc); PLACES.push(o); return o; }

/* 1. Hedgehogs: a cottage and a garden of flowerbeds */
{
  const i = 4.5, j = 7.5, I = i - 1.05, J = j - 1.55, cs = 0.36, gi = i + 0.5, gj = j - 1.5;
  const R = ['AABB', 'ACCB', 'DCCB', 'DDDB'], col = { A: 'pink', B: 'sun', C: 'green', D: 'plum' };
  const hogs = [[0, 1, 1], [2, 0, 1], [3, 2, -1]];
  const cell = (r, c) => iso(gi + (c + 0.5) * cs, gj + (r + 0.5) * cs);
  place({
    kluc: 'hedgehogs', name: 'Hedgehogs', i, j, clear: 2.2, bb: [-120, -105, 120, 70], hit: [0, -22, 92, 64],
    sign: [i - 0.35, j + 1.2, 'pink'],
    where: 'The hedgehogs’ garden',
    scene: ['Three hedgehogs are sunning in their flowerbeds and a fourth dozes under the leaves; indoors, grandma works out where everyone may sit.', 'Three hedgehogs are settling into their flowerbeds for the night and a fourth is already under the leaves; indoors, grandma works out where everyone may sleep.'],
    rule: 'Two hedgehogs in every row, column and flowerbed, and no two hedgehogs may touch.',
    static(p) {
      ground(p, 'orange', 0.16, gi - 0.08, gj - 0.08, 4 * cs + 0.16, 4 * cs + 0.16);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const k = R[r][c], a = gi + c * cs + 0.03, b = gj + r * cs + 0.03;
        ground(p, 'orange', 0.3, a, b, cs - 0.06, cs - 0.06);
        ground(p, col[k], k === 'B' ? 0.42 : 0.32, a, b, cs - 0.06, cs - 0.06);
        if (!hogs.some(h => h[0] === r && h[1] === c) && !(r === 1 && c === 3)) {
          const [x, y] = cell(r, c);
          flowers(p, x, y + 1, r * 9 + c, 3, k === 'A' ? ['sun', 'paper'] : ['pink', 'paper']);
        }
      }
      // a leaf pile: the fourth hedgehog is asleep under it
      { const [x, y] = cell(1, 3); p.ellipse('orange', 0.85, x, y - 2, 8, 4.2); p.ellipse('sun', 0.5, x - 2, y - 3.4, 4.6, 2.2); p.ellipse('night', 0.2, x + 2, y - 1, 5, 2.4); }
      cottage(p, I, J, 1.4, 1.1, 26, 'pink', 'sun', { door: 0.62, winsJ: [0.22, 1.12] });
      fence(p, [gi + 4 * cs + 0.06, gj - 0.05], [gi + 4 * cs + 0.06, gj + 4 * cs + 0.06], 5);
      fence(p, [gi - 0.05, gj + 4 * cs + 0.06], [gi + 4 * cs + 0.06, gj + 4 * cs + 0.06], 5);
    },
    sprites() {
      const out = hogs.map(([r, c, f], n) => {
        const [x, y] = cell(r, c);
        return still(x, y + 1, 10, 12, t => [wave(t, 3.1, n * 0.3) * 0.5, B(blink(t, n + 1))],
          (p, t) => hedgehog(p, x, y + 1, 0.68 * K, f, wave(t, 3.1, n * 0.3), blink(t, n + 1)));
      });
      // when the house opens, the fourth hedgehog wakes and climbs out of the leaves
      { const [x, y] = cell(1, 3);
        out.push(still(x, y, 12, 14, t => [floor(act('hedgehogs', t, 0.9, 0.9) * 20), B(blink(t, 5))], (p, t) => {
          const a = act('hedgehogs', t, 0.9, 0.9); if (a <= 0) return;
          const e = pop(a);
          for (let k = 0; k < 4; k++) p.ellipse(k % 2 ? 'orange' : 'sun', 0.8, x - 9 + k * 6 + e * (k - 1.5) * 3, y + 1.5 - e * (k % 2) * 1.2, 2.4, 1.1, k);
          hedgehog(p, x, y + 1 - e * 1.5, 0.68 * K * (0.6 + 0.4 * e), -1, 0.5, a < 1 || blink(t, 5));
        })); }
      // the walker: along the path in front of the cottage and back
      const A = iso(i - 0.9, j + 0.5), Bp = iso(i + 0.15, j + 0.95);
      const pos = t => { const c = (t % 16) / 16; const f = c < 0.4 ? ease(c / 0.4) : c < 0.5 ? 1 : c < 0.9 ? 1 - ease((c - 0.5) / 0.4) : 0; return [A[0] + (Bp[0] - A[0]) * f, A[1] + (Bp[1] - A[1]) * f, (c < 0.45 || c >= 0.95) ? 1 : -1, c < 0.4 || (c >= 0.5 && c < 0.9)]; };
      out.push(S(t => { const [x, y] = pos(t); return [x - 15, y - 15, x + 15, y + 4]; },
        t => { const [x, y, f, w] = pos(t); return [x, y, B(f > 0), w ? floor(t * 6) % 2 : 0]; },
        (p, t) => { const [x, y, f, w] = pos(t); hedgehog(p, x, y - (w && floor(t * 6) % 2 ? 0.6 : 0), 0.7 * 1.2, f, wave(t, 2.8), blink(t, 9)); }));
      out.push(smoke(chimneyTop(I, J, 1.4, 1.1, 26), 1));
      // inside: grandma hedgehog at the table, filling in today's garden
      out.push(room('hedgehogs', I, J, 1.4, 1.1, 26, 'sun', {
        st: t => floor(act('hedgehogs', t, 1.4, 1.0) * 9) + B(blink(t, 7)) * 0.1,
        draw(p, t) {
          const [px, py] = iso(I + 0.3, J, 17);
          p.poly('orange', 0.9, [[px - 6, py - 5], [px + 6, py - 2], [px + 6, py + 7], [px - 6, py + 4]]);
          p.poly('paper', 1, [[px - 4.6, py - 3.6], [px + 4.6, py - 1], [px + 4.6, py + 5.6], [px - 4.6, py + 3]]);
          flowers(p, px, py + 3, 4, 3);
          table(p, I + 0.85, J + 0.55, act('hedgehogs', t, 1.4, 1.0), 'green');
          const [hx, hy] = iso(I + 0.45, J + 0.8);
          hedgehog(p, hx, hy, 0.95, 1, 0.5, blink(t, 7));
          p.path('night', 0.8, (c, ox, oy) => c.ellipse(hx + 7.4 + ox, hy - 3.4 + oy, 1.6, 1.1, 0, 0, TAU), 0.5);
        }
      }));
      return out;
    },
    top: iso(I + 0.7, J + 0.55, 46)
  });
}

/* 2. Dormice: a copse, the stores, a board of ticks and crosses, a sleeper */
{
  const i = 4.2, j = 12.8;
  place({
    kluc: 'dormice', name: 'Dormice', i, j, clear: 2.1, bb: [-110, -110, 110, 60], hit: [0, -30, 86, 62],
    sign: [i - 0.1, j + 1.35, 'plum'],
    where: 'The dormice’s copse',
    scene: 'One dormouse sleeps in the nest while the other works out, clue by clue, whose store went missing.',
    rule: 'Every dormouse keeps one store in one tree; use the clues to match everyone up and find the store that went missing.',
    static(p) {
      ground(p, 'green', 0.18, i - 1.3, j - 1.3, 2.4, 1.9);
      tree(p, ...iso(i - 0.9, j - 0.9), 1.45, 'round', 7);
      tree(p, ...iso(i + 0.45, j - 1.1), 1.3, 'fruit', 8);
      tree(p, ...iso(i - 1.2, j + 0.2), 1.15, 'autumn', 9);
      // the stores at the foot of the trees
      { const [x, y] = iso(i - 0.55, j - 0.45); for (let k = 0; k < 6; k++) p.circle(k % 2 ? 'orange' : 'sun', 0.9, x - 4 + (k % 3) * 4, y - (k > 2 ? 4 : 1), 2.2); }
      { const [x, y] = iso(i + 0.55, j - 0.5); p.poly('orange', 0.85, [[x - 6, y - 7], [x + 6, y - 7], [x + 4.6, y], [x - 4.6, y]]); for (let k = 0; k < 4; k++) p.circle('pink', 1, x - 4 + k * 2.6, y - 8, 1.8); p.path('orange', 0.9, (c, ox, oy) => c.arc(x + ox, y - 7 + oy, 6, Math.PI, 0), 0.9); }
      // the nest, a woven cup
      { const [x, y] = iso(i - 0.15, j - 0.15); p.ellipse('dots', 0.45, x + 3, y + 2, 12, 4); p.ellipse('orange', 0.85, x, y - 1, 11, 5); p.ellipse('night', 0.3, x, y - 2.2, 8.4, 3); for (let k = 0; k < 6; k++) p.line('night', 0.35, 0.7, [[x - 10 + k * 3.6, y + 1], [x - 7 + k * 3.6, y - 3.4]]); }
      // the board: who keeps what where
      const i0 = i + 0.25, jf = j + 0.55;
      board(p, i0, jf, 0.95, 8, 36);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const u0 = 0.2 + c * 0.22, v1 = 32 - r * 7.2;
        faceJ(p, 'night', 0.25, i0 + u0, jf, 0, 0.2, v1 - 6.4, v1 - 6);
        const [x, y] = iso(i0 + u0 + 0.1, jf, v1 - 3.4);
        if ((r + c * 2) % 3 === 0) p.line('green', 0.95, 1.1, [[x - 2, y], [x - 0.6, y + 1.6], [x + 2.2, y - 2]]);
        else { p.line('pink', 0.95, 1, [[x - 1.7, y - 1.7], [x + 1.7, y + 1.7]]); p.line('pink', 0.95, 1, [[x + 1.7, y - 1.7], [x - 1.7, y + 1.7]]); }
      }
      faceJ(p, 'plum', 0.6, i0 + 0.04, jf, 0, 0.12, 12, 32);
    },
    sprites() {
      const [nx, ny] = iso(i - 0.15, j - 0.15), [rx, ry] = iso(i + 0.1, j + 0.95), [sx0, sy0] = iso(i - 0.55, j - 0.45);
      const zs = t => [0, 1, 2].map(k => ((step(t) / 4.2 + k / 3) % 1));
      return [
        still(nx, ny - 2, 10, 12, t => [wave(t, 4.4) * 0.7], (p, t) => dormouse(p, nx - 1, ny - 2, 0.8 * K, 1, wave(t, 4.4), false, true)),
        S([nx - 2, ny - 44, nx + 24, ny - 8], t => [floor(t * 12) * 9], (p, t) => {
          zs(t).forEach((f, k) => { const a = sin(f * Math.PI) * 0.9; p.text('plum', a, 'z', nx + 6 + f * 12 + sin(f * 5 + k) * 1.6, ny - 12 - f * 26, 5 + f * 5, 700); });
        }),
        still(rx, ry, 9, 13, t => [wave(t, 3.4, 0.4) * 0.4, B(blink(t, 21)), B(((t / 5) % 1) < 0.5 || act('dormice', t) > 0)],
          (p, t) => dormouse(p, rx, ry, 0.78 * K, ((t / 5) % 1) < 0.5 || act('dormice', t) > 0 ? 1 : -1, wave(t, 3.4, 0.4), blink(t, 21), false)),
        // when the house opens: the missing store turns up, an acorn hops from
        // under the leaves into the worker's paws, and the board gets its tick
        S([min(sx0, rx) - 10, min(sy0, ry) - 52, max(sx0, rx) + 16, max(sy0, ry) + 4],t => [floor(act('dormice', t, 1.2) * 24)], (p, t) => {
          const a = act('dormice', t, 1.2); if (a <= 0) return;
          const f = ease(min(1, a / 0.75)), x = sx0 + (rx + 6 - sx0) * f, y = sy0 + (ry - 13 - sy0) * f - sin(f * Math.PI) * 26;
          p.ellipse('sun', 1, x, y, 2.4, 2.8); p.ellipse('orange', 1, x, y - 2.6, 2.8, 1.3);
          if (a > 0.75) { const e = pop((a - 0.75) / 0.25); p.circle('paper', 1, rx + 6, ry - 30, 5 * e); p.line('green', 1, 1.6, [[rx + 3.4, ry - 30], [rx + 5.4, ry - 28], [rx + 8.8, ry - 32.6]].map(([u, v]) => [rx + 6 + (u - rx - 6) * e, ry - 30 + (v - ry + 30) * e])); }
        })
      ];
    },
    top: iso(i - 0.9, j - 0.9, 70)
  });
}

/* 3. Badgers: a sett in a hill, and a block of sums in front of it */
{
  const i = 5, j = 16.5, gi = i - 0.4, gj = j + 0.45, cs = 0.42;
  const digits = ['276', '951', '438'], shown = ['2.6', '.5.', '4..'];
  place({
    kluc: 'badgers', name: 'Badgers', i, j, clear: 2.1, bb: [-110, -80, 110, 64], hit: [0, -14, 92, 60],
    sign: [i - 0.85, j + 1.75, 'plum'],
    where: 'The badgers’ sett',
    scene: ['A badger is sniffing along the dotted cages, adding up which burrow is whose.', 'A badger is sniffing along the dotted cages, adding up who sleeps where tonight.'],
    rule: 'Every row, column and block holds each number once, and each dotted cage adds up to its small sum.',
    static(p) {
      const [X, Y] = iso(i - 0.3, j - 0.75);
      mound(p, X, Y, 74, 52, 4);
      arch(p, X - 30, Y + 8, 14, 18);
      arch(p, X + 22, Y + 9, 12, 15);
      p.circle('paper', 1, X - 4, Y - 26, 5); p.circle('sun', 0.6, X - 4, Y - 26, 5);
      p.line('night', 0.6, 0.8, [[X - 9, Y - 26], [X + 1, Y - 26]]); p.line('night', 0.6, 0.8, [[X - 4, Y - 31], [X - 4, Y - 21]]);
      if (p.glow) p.glow.push([[X - 7, Y - 29], [X - 1, Y - 29], [X - 1, Y - 23], [X - 7, Y - 23]]);
      p.poly('paper', 1, [[X + 30, Y - 42], [X + 38, Y - 42], [X + 38, Y - 26], [X + 30, Y - 28]]);
      p.poly('orange', 0.85, [[X + 30, Y - 42], [X + 38, Y - 42], [X + 38, Y - 26], [X + 30, Y - 28]]);
      p.poly('night', 0.25, [[X + 34, Y - 42], [X + 38, Y - 42], [X + 38, Y - 26], [X + 34, Y - 27]]);
      p.poly('orange', 0.95, [[X + 29, Y - 45], [X + 39, Y - 45], [X + 39, Y - 42], [X + 29, Y - 42]]);
      // the block
      ground(p, 'orange', 0.22, gi - 0.06, gj - 0.06, 3 * cs + 0.12, 3 * cs + 0.12);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        ground(p, 'paper', 1, gi + c * cs + 0.02, gj + r * cs + 0.02, cs - 0.04, cs - 0.04);
        ground(p, 'sun', 0.22, gi + c * cs + 0.02, gj + r * cs + 0.02, cs - 0.04, cs - 0.04);
        if (shown[r][c] !== '.') { const [x, y] = iso(gi + (c + 0.5) * cs, gj + (r + 0.5) * cs); p.text('night', 0.85, digits[r][c], x, y - 0.5, 8, 700); }
      }
      // dotted cages, drawn a little inside the cells
      const cage = (pts) => p.path('night', 0.6, (c, ox, oy) => { c.setLineDash([2, 2]); pts.forEach((q, k) => { const [x, y] = iso(gi + q[0] * cs, gj + q[1] * cs); k ? c.lineTo(x + ox, y + oy) : c.moveTo(x + ox, y + oy); }); c.closePath(); }, 0.8);
      const e = 0.12, E = 1 - e;
      cage([[e, e], [2 - e, e], [2 - e, E], [e, E]]);
      cage([[e, 1 + e], [E, 1 + e], [E, 3 - e], [e, 3 - e]]);
      cage([[2 + e, e], [3 - e, e], [3 - e, 2 - e], [1 + e, 2 - e], [1 + e, 1 + e], [2 + e, 1 + e]]);
      cage([[1 + e, 2 + e], [3 - e, 2 + e], [3 - e, 3 - e], [1 + e, 3 - e]]);
      p.c.setLineDash([]);
      for (const [c0, r0, n] of [[0, 0, 9], [0, 1, 13], [2, 0, 12], [1, 2, 11]]) { const [x, y] = iso(gi + c0 * cs + 0.1, gj + r0 * cs + 0.2); p.text('night', 0.8, String(n), x - 3, y - 1, 4.2, 700); }
      lantern(p, ...iso(i + 1.2, j - 0.6));
    },
    sprites() {
      const [x, y] = iso(i + 1.05, j + 1.05);
      const [X, Y] = iso(i - 0.3, j - 0.75);
      return [
        still(x, y, 13, 14, t => [wave(t, 3.6) * 0.4, B(blink(t, 31)), B(((t / 2.2) % 1) < 0.2)],
          (p, t) => { const sn = ((t / 2.2) % 1) < 0.2 ? 0.6 : 0; badger(p, x, y + sn, 0.74 * K, -1, wave(t, 3.6), blink(t, 31)); }),
        // when the sett opens, the badger works out two empty cells: 7, then 9
        ...[[0, 1, 0], [1, 0, 0.5]].map(([r, c, dl]) => {
          const [cx, cy] = iso(gi + (c + 0.5) * cs, gj + (r + 0.5) * cs);
          return S([cx - 9, cy - 10, cx + 9, cy + 8], t => [floor(act('badgers', t, 0.5, 0.6 + dl) * 12)], (p, t) => {
            const a = act('badgers', t, 0.5, 0.6 + dl); if (a <= 0) return;
            const e = pop(a);
            p.text('blue', 0.95, digits[r][c], cx, cy - 0.5 - (1 - a) * 3, 8 * e, 700);
          });
        }),
        smoke([X + 34, Y - 46], 3)
      ];
    },
    top: iso(i - 0.3, j - 0.75, 56)
  });
}

/* 4. Hares: a windmill and a field of burrows, one hare leaping like a knight */
{
  const i = 6.2, j = 20.8, I = i - 0.95, J = j - 1.15, gi = i + 0.1, gj = j - 0.55, cs = 0.4;
  const hub = iso(I + 0.4, J + 0.92, 42);
  const nums = { '0,1': 3, '1,3': 1, '2,0': 4, '3,2': 2, '2,2': 3, '0,3': 4 };
  const hops = [[0, 0], [2, 1], [3, 3], [1, 2]];
  const cell = (r, c) => iso(gi + (c + 0.5) * cs, gj + (r + 0.5) * cs);
  place({
    kluc: 'hares', name: 'Hares', i, j, clear: 2.2, bb: [-120, -120, 110, 60], hit: [-10, -26, 92, 66],
    sign: [i + 0.55, j + 1.65, 'orange'],
    where: 'The hares’ mill field',
    scene: 'A hare leaps from burrow to burrow in knight’s moves, checking no two numbers see each other.',
    rule: 'Every row, column and block holds each number once, and no two burrows a knight’s leap apart hold the same number.',
    static(p) {
      ground(p, 'orange', 0.2, gi - 0.1, gj - 0.1, 4 * cs + 0.2, 4 * cs + 0.2);
      for (let k = 0; k <= 8; k++) p.line('orange', 0.4, 1.1, [iso(gi - 0.1, gj - 0.1 + k * 0.2), iso(gi + 4 * cs + 0.1, gj - 0.1 + k * 0.2)]);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const [x, y] = cell(r, c);
        p.ellipse('night', 0.72, x, y, 5.2, 2.5); p.ellipse('orange', 0.5, x, y + 1, 6.4, 2.4, 0, 0, Math.PI);
        const n = nums[r + ',' + c];
        if (n) { p.ellipse('paper', 1, x + 6, y - 3.2, 3.2, 1.9); p.text('night', 0.9, String(n), x + 6, y - 3.4, 4.4, 700); }
      }
      // the windmill
      p.poly('dots', 0.5, [iso(I + 0.8, J - 0.1), iso(I + 1.8, J + 0.3), iso(I + 1.8, J + 1.2), iso(I + 0.3, J + 1.2), iso(I, J + 0.8)]);
      box(p, I, J, 0.8, 0.8, 44, null, ['paper', 1], ['paper', 1]);
      faceJ(p, 'sun', 0.3, I, J + 0.8, 0, 0.8, 0, 44); faceI(p, 'sun', 0.3, I + 0.8, J, 0, 0.8, 0, 44); faceI(p, 'blue', 0.25, I + 0.8, J, 0, 0.8, 0, 44);
      for (let k = 1; k < 5; k++) { faceJ(p, 'orange', 0.22, I, J + 0.8, 0, 0.8, k * 9, k * 9 + 0.8); faceI(p, 'orange', 0.22, I + 0.8, J, 0, 0.8, k * 9, k * 9 + 0.8); }
      faceJ(p, 'orange', 0.9, I + 0.28, J + 0.8, 0, 0.24, 0, 15); faceJ(p, 'night', 0.35, I + 0.28, J + 0.8, 0, 0.24, 0, 15);
      faceI(p, 'night', 0.72, I + 0.8, J + 0.3, 0, 0.2, 22, 30);
      if (p.glow) p.glow.push([iso(I + 0.8, J + 0.3, 22), iso(I + 0.8, J + 0.5, 22), iso(I + 0.8, J + 0.5, 30), iso(I + 0.8, J + 0.3, 30)]);
      const ap = iso(I + 0.4, J + 0.4, 70), e = 0.1;
      p.poly('orange', 0.9, [iso(I - e, J + 0.8 + e, 44), iso(I + 0.8 + e, J + 0.8 + e, 44), ap]);
      p.poly('orange', 0.95, [iso(I + 0.8 + e, J - e, 44), iso(I + 0.8 + e, J + 0.8 + e, 44), ap]);
      p.poly('night', 0.3, [iso(I + 0.8 + e, J - e, 44), iso(I + 0.8 + e, J + 0.8 + e, 44), ap]);
      p.line('paper', 0.9, 1.2, [iso(I + 0.8 + e, J + 0.8 + e, 44), ap]);
    },
    sprites() {
      // four sails turning slowly in the plane of the front wall
      const R = 36, W = 6.5, ux = 0.894, uy = 0.447;
      const pt = (a, b) => [hub[0] + a * ux, hub[1] + a * uy - b];
      const sails = S([hub[0] - R - 4, hub[1] - R - 4, hub[0] + R + 4, hub[1] + R + 4], t => [t * TAU / 14 * R], (p, t) => {
        const th = t * TAU / 14;
        for (let k = 0; k < 4; k++) {
          const f = th + k * Math.PI / 2, dx = cos(f), dy = sin(f), nx = -dy, ny = dx;
          const q = (r, w) => pt(dx * r + nx * w, dy * r + ny * w);
          p.poly('paper', 1, [q(8, 0.5), q(R, 0.5), q(R, W), q(8, W)]);
          p.poly('sun', 0.35, [q(8, 0.5), q(R, 0.5), q(R, W), q(8, W)]);
          p.line('orange', 0.95, 1.3, [q(0, 0), q(R + 1, 0)]);
          p.line('orange', 0.8, 0.8, [q(R, 0), q(R, W), q(8, W)]);
          for (let r = 14; r < R; r += 6) p.line('orange', 0.55, 0.6, [q(r, 0), q(r, W)]);
        }
        p.circle('night', 0.85, hub[0], hub[1], 2.4);
      });
      // one hare leaps in knight moves from burrow to burrow
      const HOP = 0.7, REST = 1.6, CYC = HOP + REST;
      const pos = t => {
        const n = floor(t / CYC), f = clamp01((t - n * CYC) / HOP);
        const a = hops[n % 4], b = hops[(n + 1) % 4];
        const A = cell(a[0], a[1]), Bq = cell(b[0], b[1]), e = ease(f);
        return [A[0] + (Bq[0] - A[0]) * e, A[1] + (Bq[1] - A[1]) * e, Bq[0] >= A[0] ? 1 : -1, sin(Math.PI * f)];
      };
      const leaper = S(t => { const [x, y, , l] = pos(t); return [x - 19, y - 34 - l * 16, x + 19, y + 4]; },
        t => { const [x, y, f, l] = pos(t); return [x, y - l * 16, B(f > 0), l * 4]; },
        (p, t) => { const [x, y, f, l] = pos(t); p.ellipse('dots', 0.35 * (1 - l * 0.6), x, y + 0.5, 7, 2); hare(p, x, y - l * 16, 0.72 * K, f, wave(t, 2.6), blink(t, 41), l * 0.8); });
      const [sx, sy] = iso(I + 0.4, J + 1.3);
      const hopA = t => { const a = act('hares', t, 0.8, 0.5); return a > 0 && a < 1 ? sin(a * Math.PI) : 0; };
      const sitter = still(sx, sy, 12, 30, t => [wave(t, 3.2) * 0.4, B(blink(t, 43)), hopA(t) * 8], (p, t) => hare(p, sx, sy, 0.74 * K, 1, wave(t, 3.2), blink(t, 43), hopA(t)));
      // when the field opens, the sitter hops and fills in an empty burrow: 2
      const [bx, by] = cell(1, 1);
      const filled = S([bx - 2, by - 12, bx + 14, by + 4], t => [floor(act('hares', t, 0.45, 1.1) * 12)], (p, t) => {
        const a = act('hares', t, 0.45, 1.1); if (a <= 0) return;
        const e = pop(a);
        p.ellipse('paper', 1, bx + 6, by - 3.2, 3.2 * e, 1.9 * e); p.text('blue', 0.95, '2', bx + 6, by - 3.4, 4.8 * e, 700);
      });
      return [sails, leaper, sitter, filled];
    },
    top: iso(I + 0.4, J + 0.4, 70)
  });
}

/* 5. Voles: a flooded meadow, islands with burrows, voles popping up */
{
  const i = 11.8, j = 19.2, gi = i - 0.95, gj = j - 0.9, cs = 0.45;
  const map = ['LWLL', 'LWWW', 'WWLW', 'WLLW'];
  const tags = [[0, 0, 2], [0, 3, 2], [3, 2, 3]], holes = [[1, 0], [0, 2], [3, 1]];
  const cell = (r, c) => iso(gi + (c + 0.5) * cs, gj + (r + 0.5) * cs);
  place({
    kluc: 'voles', name: 'Voles', i, j, clear: 2.0, bb: [-110, -90, 110, 60], hit: [0, -12, 90, 58],
    sign: [i - 1.25, j + 1.3, 'green'],
    where: 'The voles’ meadow',
    scene: 'The meadow is flooding, and every vole family pops up to count the dry cells of its island.',
    rule: 'Shade the water so every island has one number and that many cells, islands never touch, and all the water connects.',
    static(p) {
      ground(p, 'green', 0.2, gi - 0.1, gj - 0.1, 4 * cs + 0.2, 4 * cs + 0.2);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const a = gi + c * cs + 0.02, b = gj + r * cs + 0.02;
        if (map[r][c] === 'W') { ground(p, 'blue', 0.55, a, b, cs - 0.04, cs - 0.04); ground(p, 'teal', 0.2, a, b, cs - 0.04, cs - 0.04); const [x, y] = cell(r, c); p.line('paper', 0.7, 1, [[x - 4, y], [x + 1, y - 1]]); }
        else { ground(p, 'green', 0.42, a, b, cs - 0.04, cs - 0.04); ground(p, 'sun', 0.25, a, b, cs - 0.04, cs - 0.04); }
      }
      for (const [r, c] of holes) { const [x, y] = cell(r, c); p.ellipse('orange', 0.6, x, y + 0.6, 6.4, 3); p.ellipse('night', 0.8, x, y, 4.6, 2.2); }
      for (const [r, c, n] of tags) { const [x, y] = cell(r, c); tag(p, x + 4, y + 2, n, 'paper', 0.9); }
      cottage(p, i + 0.95, j - 1.95, 0.9, 0.8, 17, 'sun', 'orange', { rh: 16, winsJ: [0.2], door: 0.62 });
    },
    sprites() {
      const out = holes.map(([r, c], n) => {
        const [x, y] = cell(r, c);
        const pk = t => { const f = ((t / 5.2 + n * 0.37) % 1); return f < 0.12 ? ease(f / 0.12) : f < 0.55 ? 1 : f < 0.67 ? 1 - ease((f - 0.55) / 0.12) : 0; };
        const up = t => max(pk(t), ease(act('voles', t, 0.5, 0.5 + n * 0.25)));
        return still(x, y, 9, 14, t => [up(t) * 7, B(blink(t, 51 + n))], (p, t) => { const k = up(t); if (k > 0.02) vole(p, x, y + 0.4, 0.78 * K, n % 2 ? -1 : 1, wave(t, 2, n * 0.2), blink(t, 51 + n), k); });
      });
      out.push(smoke(chimneyTop(i + 0.95, j - 1.95, 0.9, 0.8, 17, 16), 5));
      // inside: the eldest vole with the map of the meadow, shading in the water
      { const I = i + 0.95, J = j - 1.95;
        out.push(room('voles', I, J, 0.9, 0.8, 17, 'orange', {
          st: t => floor(act('voles', t, 1.4, 1.0) * 9) + B(blink(t, 57)) * 0.1,
          draw(p, t) {
            table(p, I + 0.58, J + 0.4, act('voles', t, 1.4, 1.0), 'blue');
            const [vx, vy] = iso(I + 0.25, J + 0.62);
            vole(p, vx, vy, 1.05, 1, 0.5, blink(t, 57), 1);
          }
        })); }
      return out;
    },
    top: iso(i + 1.4, j - 1.55, 33)
  });
}

/* 6. Owls: a tall tree with two branches, day owls and night owls */
{
  const i = 13.2, j = 25.2;
  const rows = [['D', 'N', 'N', 'D'], ['N', 'D', 'D', 'N']], yb = [-82, -54];
  place({
    kluc: 'owls', name: 'Owls', i, j, clear: 1.8, bb: [-70, -160, 70, 30], hit: [0, -70, 56, 84],
    sign: [i - 0.4, j - 1.1, 'blue'],
    where: 'The owls’ tree',
    scene: 'Day owls and night owls share the branches, never three alike side by side.',
    rule: 'Fill every branch with a day owl or a night owl: as many of each in every row and column, and never three alike side by side.',
    static(p) {
      const [X, Y] = iso(i, j);
      p.ellipse('dots', 0.55, X + 10, Y + 3, 34, 9);
      p.poly('paper', 1, [[X - 8, Y], [X + 8, Y], [X + 5, Y - 118], [X - 5, Y - 118]]);
      p.poly('orange', 0.85, [[X - 8, Y], [X + 8, Y], [X + 5, Y - 118], [X - 5, Y - 118]]);
      p.poly('night', 0.3, [[X - 8, Y], [X + 8, Y], [X + 5, Y - 118], [X - 5, Y - 118]]);
      p.poly('night', 0.25, [[X, Y], [X + 8, Y], [X + 5, Y - 118], [X, Y - 118]]);
      for (let k = 0; k < 5; k++) p.line('night', 0.3, 0.7, [[X - 3 + k * 1.5, Y - 10 - k * 18], [X - 2 + k * 1.5, Y - 20 - k * 18]]);
      p.poly('orange', 0.8, [[X - 14, Y], [X - 7, Y - 8], [X - 4, Y]]); p.poly('orange', 0.8, [[X + 14, Y + 1], [X + 7, Y - 8], [X + 4, Y]]);
      // crown
      const crownO = (c, ox, oy) => { for (const [dx, dy, r] of [[-26, -128, 20], [22, -130, 19], [0, -146, 24]]) { c.moveTo(X + dx + r + ox, Y + dy + oy); c.arc(X + dx + ox, Y + dy + oy, r, 0, TAU); } };
      p.path('paper', 1, crownO); p.path('green', 0.85, crownO);
      for (const [dx, dy] of [[-40, -100], [40, -104]]) { p.circle('paper', 1, X + dx, Y + dy, 11); p.circle('teal', 0.85, X + dx, Y + dy, 11); }
      p.path('dots', 0.55, (c, ox, oy) => c.ellipse(X + 14 + ox, Y - 124 + oy, 24, 16, 0.3, 0, TAU));
      p.circle('sun', 0.5, X - 12, Y - 146, 10);
      // two branches
      for (const y of yb) {
        p.path('paper', 1, (c, ox, oy) => { c.moveTo(X - 42 + ox, Y + y + 2 + oy); c.quadraticCurveTo(X + ox, Y + y - 3 + oy, X + 42 + ox, Y + y + 1 + oy); }, 3.6);
        p.path('orange', 0.9, (c, ox, oy) => { c.moveTo(X - 42 + ox, Y + y + 2 + oy); c.quadraticCurveTo(X + ox, Y + y - 3 + oy, X + 42 + ox, Y + y + 1 + oy); }, 3.6);
        p.path('night', 0.3, (c, ox, oy) => { c.moveTo(X - 42 + ox, Y + y + 3.4 + oy); c.quadraticCurveTo(X + ox, Y + y - 1.6 + oy, X + 42 + ox, Y + y + 2.4 + oy); }, 1);
        p.circle('green', 0.8, X - 44, Y + y - 2, 5); p.circle('green', 0.8, X + 45, Y + y - 3, 5);
      }
      // a small lantern in the fork, for the night owls
      const g = [[X - 3, Y - 106], [X + 3, Y - 106], [X + 3, Y - 99], [X - 3, Y - 99]];
      p.poly('night', 0.7, [[X - 4, Y - 107], [X + 4, Y - 107], [X + 4, Y - 98], [X - 4, Y - 98]]); p.poly('sun', 0.95, g);
      if (p.glow) p.glow.push(g);
      for (let k = 0; k < 9; k++) p.ellipse(k % 2 ? 'orange' : 'sun', 0.7, X - 30 + hash(k, 5) * 60, Y - 2 + hash(k, 6) * 12, 2.4, 1.2, hash(k, 7) * 3);
    },
    sprites() {
      const [X, Y] = iso(i, j), out = [];
      rows.forEach((row, r) => row.forEach((o, c) => {
        const x = X - 27 + c * 18, y = Y + yb[r] - (c === 0 || c === 3 ? 0 : 1.6), n = r * 4 + c;
        out.push(still(x, y, 6, 15, t => [B(blink(t, 61 + n * 3))], (p, t) => owl(p, x, y, 0.64, 1, 0.5, blink(t, 61 + n * 3), o === 'N')));
      }));
      return out;
    },
    top: iso(i, j, 160)
  });
}

/* 7. The square: a well and the notice board (it points to all puzzles) */
{
  const i = 9, j = 15;
  place({
    kluc: 'square', name: 'Village square', i, j, clear: 1.5, bb: [-80, -80, 80, 40], hit: [0, -20, 64, 46], square: true,
    where: 'The village square',
    scene: 'The notice board by the well lists every house and today’s puzzle in each.',
    rule: 'Fourteen houses, each with a new puzzle every day, easy on Monday and hardest on Sunday.',
    static(p) {
      const [X, Y] = iso(i, j);
      p.ellipse('sun', 0.35, X, Y, 60, 26); p.ellipse('orange', 0.12, X, Y, 60, 26);
      for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; p.ellipse('paper', 1, X + cos(a) * 52, Y + sin(a) * 22, 5, 2.6); p.ellipse('night', 0.16, X + cos(a) * 52, Y + sin(a) * 22, 5, 2.6); }
      // the well
      p.ellipse('dots', 0.5, X + 6, Y + 3, 18, 7);
      p.ellipse('paper', 1, X, Y - 4, 15, 7.5); p.ellipse('night', 0.2, X, Y - 4, 15, 7.5);
      p.poly('paper', 1, [[X - 15, Y - 4], [X + 15, Y - 4], [X + 15, Y - 12], [X - 15, Y - 12]]); p.poly('night', 0.16, [[X - 15, Y - 4], [X + 15, Y - 4], [X + 15, Y - 12], [X - 15, Y - 12]]);
      for (let k = 0; k < 5; k++) p.line('night', 0.25, 0.7, [[X - 12 + k * 6, Y - 4], [X - 12 + k * 6, Y - 12]]);
      p.ellipse('paper', 1, X, Y - 12, 15, 7.5); p.ellipse('night', 0.22, X, Y - 12, 15, 7.5);
      p.ellipse('blue', 0.8, X, Y - 12, 11.5, 5.4); p.ellipse('night', 0.3, X, Y - 13, 11.5, 4);
      p.line('orange', 0.95, 2, [[X - 13, Y - 10], [X - 13, Y - 38]], 'butt'); p.line('orange', 0.95, 2, [[X + 13, Y - 10], [X + 13, Y - 38]], 'butt');
      p.line('orange', 0.9, 1.4, [[X - 14, Y - 31], [X + 14, Y - 31]]);
      p.line('night', 0.6, 0.6, [[X + 2, Y - 31], [X + 2, Y - 20]]);
      p.poly('orange', 0.9, [[X - 1, Y - 20], [X + 5, Y - 20], [X + 4.4, Y - 15], [X - 0.4, Y - 15]]);
      p.poly('pink', 0.95, [[X - 20, Y - 36], [X + 20, Y - 36], [X + 12, Y - 48], [X - 12, Y - 48]]); p.poly('night', 0.2, [[X, Y - 36], [X + 20, Y - 36], [X + 12, Y - 48], [X, Y - 48]]);
      // the notice board
      const i0 = i - 1.25, jf = j + 0.55;
      board(p, i0, jf, 0.95, 10, 40, 'blue');
      const inks = ['pink', 'sun', 'green', 'teal', 'plum', 'orange'];
      for (let k = 0; k < 6; k++) { const u = 0.12 + (k % 3) * 0.26, v = 36 - floor(k / 3) * 12; faceJ(p, 'paper', 1, i0 + u, jf, 0, 0.2, v - 9, v); faceJ(p, inks[k], 0.35, i0 + u, jf, 0, 0.2, v - 9, v); faceJ(p, 'night', 0.45, i0 + u + 0.03, jf, 0, 0.12, v - 3.4, v - 2.6); faceJ(p, 'night', 0.3, i0 + u + 0.03, jf, 0, 0.14, v - 6, v - 5.4); const pin = iso(i0 + u + 0.1, jf, v - 1); p.circle('pink', 1, pin[0], pin[1], 1); }
      p.poly('pink', 0.9, [iso(i0 - 0.05, jf, 40), iso(i0 + 1, jf, 40), iso(i0 + 1, jf, 47), iso(i0 - 0.05, jf, 47)]);
      // a bench
      const b0 = iso(i + 0.8, j + 0.9), b1 = iso(i + 1.5, j + 0.5);
      p.line('orange', 0.9, 3, [[b0[0], b0[1] - 7], [b1[0], b1[1] - 7]], 'butt');
      p.line('orange', 0.9, 1.4, [[b0[0], b0[1] - 13], [b1[0], b1[1] - 13]]);
      for (const q of [b0, b1]) p.line('night', 0.6, 1.2, [[q[0], q[1]], [q[0], q[1] - 7]], 'butt');
      flowers(p, X - 44, Y + 8, 3, 6); flowers(p, X + 46, Y - 10, 4, 6);
    },
    sprites() { return []; },
    top: iso(i, j, 50)
  });
}

/* 8. Swans: the big lake, a loop of dashes across it, swans at the turns */
{
  const i = 14, j = 13.4, sp = 0.9, o = -1.35;
  const V = [[0, 0], [3, 0], [3, 2], [2, 2], [2, 3], [0, 3]];
  const P = V.map(([u, v]) => iso(i + o + u * sp, j + o + v * sp));
  const at = (u, v) => iso(i + o + u * sp, j + o + v * sp);
  place({
    kluc: 'swans', name: 'Swans', i, j, clear: 3.1, bb: [-150, -80, 150, 80], hit: [0, 0, 118, 60],
    sign: [12.4, 16.3, 'plum'],
    where: 'The swans’ lake',
    scene: 'One loop runs through every swan on the lake: straight on at the white ones, turning at the black.',
    rule: 'Draw one closed loop through every swan: go straight through a white swan and turn next to it, turn at a black swan and go straight on both sides.',
    static(p) {
      p.path('blue', 0.3, (c, ox, oy) => { P.forEach((q, k) => k ? c.lineTo(q[0] + ox, q[1] + oy) : c.moveTo(q[0] + ox, q[1] + oy)); c.closePath(); }, 5);
      p.path('paper', 0.95, (c, ox, oy) => { c.setLineDash([5, 4]); P.forEach((q, k) => k ? c.lineTo(q[0] + ox, q[1] + oy) : c.moveTo(q[0] + ox, q[1] + oy)); c.closePath(); }, 1.8);
      p.c.setLineDash([]);
      // lily pads
      for (let k = 0; k < 7; k++) { const [x, y] = at(0.5 + hash(k, 1) * 2.2, 0.4 + hash(k, 2) * 2.4); if (hash(k, 3) < 0.6) { p.ellipse('green', 0.75, x, y, 4, 2, 0, 0.4, 6); if (k % 3 === 0) p.circle('pink', 0.9, x + 1, y - 1, 1.3); } }
      // the jetty on the west shore, and a little boat
      const j0 = [11.05, 14.6], j1 = [12.2, 14.35];
      // a solid deck a little above the water: posts first, then the boards on
      // a paper knockout (like the paths), so no water shows through them
      { const di = j1[0] - j0[0], dj = j1[1] - j0[1], l = hypot(di, dj), ni = -dj / l * 0.2, nj = di / l * 0.2, H = 3;
        const at = (f, s, h) => iso(j0[0] + di * f + ni * s, j0[1] + dj * f + nj * s, h);
        for (const f of [0.5, 0.75, 1]) for (const s of [-1, 1]) {
          const top = at(f, s, H), bot = at(f, s, -5);
          p.line('night', 0.7, 1.7, [top, bot], 'butt');
          p.path('paper', 0.8, (c, ox, oy) => c.ellipse(bot[0] + ox, bot[1] + oy, 3.2, 1.3, 0, 0, TAU), 0.7);
        }
        const deck = [at(0, -1, H), at(1, -1, H), at(1, 1, H), at(0, 1, H)];
        p.poly('paper', 1, deck); p.poly('orange', 0.8, deck); p.poly('sun', 0.3, deck);
        for (let k = 1; k < 10; k++) p.line('night', 0.3, 0.6, [at(k / 10, -1, H), at(k / 10, 1, H)], 'butt');
        const front = [at(0, 1, H), at(1, 1, H), at(1, -1, H)];
        p.poly('orange', 0.9, [front[0], front[1], at(1, 1, H - 2), at(0, 1, H - 2)]);
        p.poly('night', 0.3, [front[0], front[1], at(1, 1, H - 2), at(0, 1, H - 2)]);
        p.poly('orange', 0.95, [front[1], front[2], at(1, -1, H - 2), at(1, 1, H - 2)]);
      }
      const [bx, by] = iso(12.3, 15.15);
      p.path('orange', 0.9, (c, ox, oy) => { c.moveTo(bx - 13 + ox, by - 6 + oy); c.lineTo(bx + 13 + ox, by - 1 + oy); c.quadraticCurveTo(bx + 7 + ox, by + 5 + oy, bx - 2 + ox, by + 3 + oy); c.quadraticCurveTo(bx - 11 + ox, by + 1 + oy, bx - 13 + ox, by - 6 + oy); });
      p.path('paper', 1, (c, ox, oy) => c.ellipse(bx + ox, by - 2.6 + oy, 10, 2.2, 0.2, 0, TAU));
      p.line('night', 0.5, 0.6, [[bx - 12, by - 5], [bx - 19, by - 9]]);
    },
    sprites() {
      const out = [];
      const [bx, by] = at(3, 0), [wx, wy] = at(0, 1.5);
      out.push(still(bx, by + 2, 11, 16, t => [wave(t, 3.4) * 1.2, B(blink(t, 71))], (p, t) => swan(p, bx, by + 2 - wave(t, 3.4) * 1.2, 0.8 * K, -1, wave(t, 3), blink(t, 71), true)));
      out.push(still(wx, wy + 2, 11, 16, t => [wave(t, 3.9, 0.4) * 1.2, B(blink(t, 72))], (p, t) => swan(p, wx, wy + 2 - wave(t, 3.9, 0.4) * 1.2, 0.8 * K, 1, wave(t, 3.1), blink(t, 72), false)));
      // a white swan gliding round the loop
      const tr = track(P);
      const pos = t => tr.at(t * 9 + tr.L * 0.45);
      out.push(S(t => { const [x, y] = pos(t); return [x - 14, y - 16, x + 14, y + 6]; },
        t => { const [x, y, dx] = pos(t); return [x, y, B(dx > 0)]; },
        (p, t) => { const [x, y, dx] = pos(t); p.path('paper', 0.6, (c, ox, oy) => { c.moveTo(x - (dx > 0 ? 9 : -9) + ox, y + 2 + oy); c.lineTo(x - (dx > 0 ? 18 : -18) + ox, y + 4 + oy); }, 0.8); swan(p, x, y + 2, 0.8 * 1.2, dx > 0 ? 1 : -1, wave(t, 3), blink(t, 73), false); }));
      out.push(ripple(...at(3, 0), 10, 3.4, 0), ripple(...at(0, 1.5), 10, 3.9, 0.5));
      out.push(trace('swans', P, true, 'paper', 2.4));
      return out;
    },
    top: at(1.5, 0, 0)
  });
}

/* 9. Cranes: four sandbanks in their pool, joined by walkways */
{
  const i = 17.1, j = 20.9;
  const banks = [[-1.05, -0.85, 2], [0.85, -0.85, 3], [0.85, 0.75, 2], [-1.05, 0.75, 1]];
  const at = k => iso(i + banks[k][0], j + banks[k][1]);
  /* a plank walkway from bank a to bank b, printed on a paper knockout so the
     water does not show through it; f0..f1 is how much of it is laid */
  const walkway = (p, a, b, off, f0, f1) => {
    const A0 = iso(i + banks[a][0] + off[0], j + banks[a][1] + off[1]), B0 = iso(i + banks[b][0] + off[0], j + banks[b][1] + off[1]);
    const L = f => [A0[0] + (B0[0] - A0[0]) * f, A0[1] + (B0[1] - A0[1]) * f];
    const A = L(f0), Bq = L(f1);
    p.line('paper', 1, 3.4, [[A[0], A[1] - 2], [Bq[0], Bq[1] - 2]], 'butt');
    p.line('orange', 0.9, 3.4, [[A[0], A[1] - 2], [Bq[0], Bq[1] - 2]], 'butt');
    p.line('sun', 0.3, 3.4, [[A[0], A[1] - 2], [Bq[0], Bq[1] - 2]], 'butt');
    p.line('night', 0.3, 0.8, [[A[0], A[1] - 0.6], [Bq[0], Bq[1] - 0.6]], 'butt');
    for (let k = 1; k < 7; k++) { const f = k / 7; if (f < f0 || f > f1) continue; const [x, y] = L(f); p.line('night', 0.22, 0.6, [[x - 1.4, y - 3.4], [x + 1.4, y - 0.6]]); }
  };
  place({
    kluc: 'cranes', name: 'Cranes', i, j, clear: 2.4, bb: [-120, -70, 120, 60], hit: [0, -6, 96, 52],
    sign: [i + 2.45, j - 0.55, 'teal'],
    where: 'The cranes’ pool',
    scene: 'The cranes rest on the sandbanks and count the walkways: each bank needs exactly as many as its number, and one is still missing.',
    rule: 'Join the sandbanks with straight walkways so every sandbank has as many as its number, with no crossings and every bank connected.',
    static(p) {
      const walk = (a, b, off) => walkway(p, a, b, off, 0, 1);
      walk(0, 1, [0, -0.09]); walk(0, 1, [0, 0.09]); walk(1, 2, [0, 0]);
      banks.forEach((b, k) => {
        const [x, y] = at(k);
        p.ellipse('orange', 0.3, x, y + 1.5, RX * 0.36, RY * 0.36);
        p.ellipse('sun', 0.85, x, y, RX * 0.34, RY * 0.32);
        p.ellipse('paper', 0.5, x - 3, y - 1.4, RX * 0.18, RY * 0.14);
        p.line('green', 0.8, 0.8, [[x + 7, y - 1], [x + 7.6, y - 6]]); p.line('green', 0.8, 0.8, [[x + 9, y], [x + 10, y - 5]]);
        tag(p, x - 9, y + 2.4, b[2]);
      });
      for (const [di, dj] of [[-1.9, 0.3], [1.7, -1.3], [0.2, 1.75], [1.9, 0.5]]) {
        const [x, y] = iso(i + di, j + dj);
        for (let k = 0; k < 4; k++) p.line('green', 0.85, 1, [[x + (k - 1.5) * 2.6, y], [x + (k - 1.5) * 3.4, y - 10 - (k % 2) * 4]]);
        p.ellipse('orange', 0.85, x + 1.4, y - 12, 1.1, 3);
      }
    },
    sprites() {
      const [ax, ay] = at(0), [cx, cy] = at(2);
      const peck = t => { const f = (t / 5.5) % 1; return f < 0.1 ? ease(f / 0.1) : f < 0.2 ? 1 : f < 0.3 ? 1 - ease((f - 0.2) / 0.1) : 0; };
      return [
        still(ax + 2, ay, 14, 32, t => [peck(t) * 16, wave(t, 3.5) * 0.4, B(blink(t, 81))], (p, t) => crane(p, ax + 2, ay, 0.8 * K, 1, wave(t, 3.5), blink(t, 81), peck(t))),
        still(cx + 2, cy, 14, 32, t => [B(((t / 6.5) % 1) < 0.5), wave(t, 4) * 0.4, B(blink(t, 82))], (p, t) => crane(p, cx + 2, cy, 0.78 * K, ((t / 6.5) % 1) < 0.5 ? -1 : 1, wave(t, 4), blink(t, 82), 0)),
        (() => { const A = at(2), Bq = at(3); return S([min(A[0], Bq[0]) - 6, min(A[1], Bq[1]) - 8, max(A[0], Bq[0]) + 6, max(A[1], Bq[1]) + 4], t => [floor(act('cranes', t, 1.1, 0.5) * 16)], (p, t) => { const a = act('cranes', t, 1.1, 0.5); if (a > 0) walkway(p, 2, 3, [0, 0], 0.2, 0.2 + 0.6 * a); }); })(),
        ripple(ax + 20, ay + 8, 8, 5.5, 0.12),
        ripple(...at(3), 14, 4.6, 0.3),
        ripple(...at(1), 14, 5.2, 0.7)
      ];
    },
    top: iso(i, j, 30)
  });
}

/* 10. Foxes: a den in a hillock, clue notes on a line, one fox thinking */
{
  const i = 24, j = 20.5;
  place({
    kluc: 'foxes', name: 'Foxes', i, j, clear: 2.0, bb: [-100, -80, 100, 50], hit: [0, -16, 82, 54],
    sign: [i - 0.9, j + 1.55, 'orange'],
    where: 'The foxes’ den',
    scene: 'Something has gone missing in the den; one fox studies the numbered notes while another naps.',
    rule: 'Use the numbered clues to place every fox in the lair; the fox left alone with the lost thing has it.',
    static(p) {
      const [X, Y] = iso(i - 0.15, j - 0.6);
      mound(p, X, Y, 60, 40, -6);
      arch(p, X - 6, Y + 8, 16, 18, 'orange');
      // the round door, open to one side
      p.ellipse('orange', 0.95, X + 12, Y + 1, 5, 8.4); p.ellipse('night', 0.3, X + 13, Y + 1, 4, 7.4); p.circle('sun', 1, X + 10.5, Y + 1, 0.9);
      p.circle('paper', 1, X - 30, Y - 14, 4); p.circle('sun', 0.7, X - 30, Y - 14, 4);
      if (p.glow) p.glow.push([[X - 33, Y - 17], [X - 27, Y - 17], [X - 27, Y - 11], [X - 33, Y - 11]]);
      // clue notes pegged on a string
      const a = iso(i + 0.5, j + 0.3), b = iso(i + 1.5, j - 0.2);
      p.line('orange', 0.9, 1.6, [[a[0], a[1]], [a[0], a[1] - 22]], 'butt'); p.line('orange', 0.9, 1.6, [[b[0], b[1]], [b[0], b[1] - 22]], 'butt');
      p.path('night', 0.6, (c, ox, oy) => { c.moveTo(a[0] + ox, a[1] - 20 + oy); c.quadraticCurveTo((a[0] + b[0]) / 2 + ox, (a[1] + b[1]) / 2 - 15 + oy, b[0] + ox, b[1] - 20 + oy); }, 0.6);
      [1, 2, 3].forEach((n, k) => {
        const f = (k + 1) / 4, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f - 20 + 5 * sin(f * Math.PI) - 5 * sin(f * Math.PI) * 0.4;
        p.poly('paper', 1, [[x - 4, y], [x + 4, y + 1], [x + 3.4, y + 10], [x - 4.4, y + 9]]); p.poly(['pink', 'sun', 'teal'][k], 0.3, [[x - 4, y], [x + 4, y + 1], [x + 3.4, y + 10], [x - 4.4, y + 9]]);
        p.text('night', 0.9, String(n), x, y + 5, 6, 700);
      });
      // the lost thing, a pink mitten, half under a bush
      const [mx, my] = iso(i + 1.2, j + 0.9);
      bush(p, mx - 7, my - 1, 0.9);
      p.path('pink', 0.95, (c, ox, oy) => { c.moveTo(mx - 2 + ox, my + oy); c.lineTo(mx - 2 + ox, my - 6 + oy); c.quadraticCurveTo(mx + 2 + ox, my - 10 + oy, mx + 5 + ox, my - 6 + oy); c.lineTo(mx + 5 + ox, my + oy); c.closePath(); });
      p.line('paper', 0.9, 1.2, [[mx - 2, my - 1.5], [mx + 5, my - 1.5]]);
      lantern(p, ...iso(i - 1.25, j + 0.6), 22);
    },
    sprites() {
      const [fx, fy] = iso(i + 0.3, j + 0.95), [cx, cy] = iso(i - 0.75, j + 0.5);
      return [
        still(fx, fy, 16, 22, t => [sin(t * 1.3) * 3, wave(t, 3.2) * 0.4, B(blink(t, 91))], (p, t) => fox(p, fx, fy, 0.78, 1, wave(t, 3.2), blink(t, 91), sin(t * 1.3))),
        still(cx, cy, 12, 10, t => [wave(t, 4.6) * 0.6], (p, t) => fox(p, cx, cy, 0.72, -1, wave(t, 4.6), true, 0, true))
      ];
    },
    top: iso(i - 0.15, j - 0.6, 44)
  });
}

/* 11. Herons: a marsh with nests in pairs, flight paths between, a lookout */
{
  const i = 23.5, j = 15.5, gi = i - 0.25, gj = j - 0.35, cs = 0.36;
  const paths = [['pink', [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]]], ['sun', [[1, 0], [1, 1], [1, 2], [2, 2], [2, 3], [3, 3]]], ['teal', [[2, 1], [2, 0], [3, 0], [3, 1], [3, 2]]]];
  const cell = (r, c) => iso(gi + (c + 0.5) * cs, gj + (r + 0.5) * cs);
  const I = i - 1.7, J = j - 1.55;
  place({
    kluc: 'herons', name: 'Herons', i, j, clear: 2.2, bb: [-110, -100, 110, 56], hit: [-4, -22, 90, 60],
    sign: [i - 0.75, j + 1.95, 'teal'],
    where: 'The herons’ marsh',
    scene: 'Each pair of herons flies between its two nests, and no two flight paths ever cross.',
    rule: 'Join every pair of matching nests with a path through neighbouring cells, never crossing, until every cell of the marsh is used.',
    static(p) {
      const [px, py] = iso(i - 1.05, j + 0.5);
      p.ellipse('paper', 1, px, py, 36, 17); p.ellipse('sun', 0.4, px, py, 36, 17); p.ellipse('paper', 1, px, py, 31, 14); p.ellipse('blue', 0.6, px, py, 31, 14); p.ellipse('teal', 0.2, px, py, 31, 14); p.ellipse('blue', 0.3, px + 3, py + 1, 18, 7);
      ground(p, 'green', 0.28, gi - 0.06, gj - 0.06, 4 * cs + 0.12, 4 * cs + 0.12);
      for (let r = 0; r <= 4; r++) { p.line('green', 0.5, 0.6, [iso(gi, gj + r * cs), iso(gi + 4 * cs, gj + r * cs)]); p.line('green', 0.5, 0.6, [iso(gi + r * cs, gj), iso(gi + r * cs, gj + 4 * cs)]); }
      for (const [ink, P] of paths) {
        p.line(ink, 0.9, 4.2, P.map(([r, c]) => cell(r, c)));
        for (const q of [P[0], P[P.length - 1]]) { const [x, y] = cell(q[0], q[1]); p.ellipse('orange', 0.95, x, y, 6.4, 3.4); p.ellipse('night', 0.4, x, y - 0.6, 4.2, 2); p.ellipse('paper', 1, x - 1, y - 1.6, 1.7, 1.2); p.ellipse('paper', 1, x + 1.4, y - 1.2, 1.6, 1.1); }
      }
      // the lookout on stilts
      for (const [a, b] of [[0, 0], [0.7, 0], [0.7, 0.7], [0, 0.7]]) { const q = iso(I + a, J + b), r = iso(I + a, J + b, 26); p.line('orange', 0.9, 1.8, [q, r], 'butt'); }
      p.line('orange', 0.6, 1, [iso(I, J + 0.7, 6), iso(I + 0.7, J + 0.7, 20)]); p.line('orange', 0.6, 1, [iso(I + 0.7, J, 6), iso(I + 0.7, J + 0.7, 20)]);
      box(p, I - 0.05, J - 0.05, 0.8, 0.8, 4, ['orange', 0.9], ['orange', 0.75], ['orange', 1], 26);
      faceI(p, 'night', 0.25, I + 0.75, J - 0.05, 0, 0.8, 26, 30);
      const ap = iso(I + 0.35, J + 0.35, 52), e = 0.14;
      for (const [a, b] of [[[I - e, J + 0.75 + e], [I + 0.75 + e, J + 0.75 + e]], [[I + 0.75 + e, J - e], [I + 0.75 + e, J + 0.75 + e]]]) { p.poly('paper', 1, [iso(a[0], a[1], 36), iso(b[0], b[1], 36), ap]); p.poly('teal', 0.9, [iso(a[0], a[1], 36), iso(b[0], b[1], 36), ap]); }
      p.poly('night', 0.25, [iso(I + 0.75 + e, J - e, 36), iso(I + 0.75 + e, J + 0.75 + e, 36), ap]);
      p.line('orange', 0.9, 1.2, [iso(I, J + 0.75, 30), iso(I, J + 0.75, 36)]); p.line('orange', 0.9, 1.2, [iso(I + 0.75, J + 0.75, 30), iso(I + 0.75, J + 0.75, 36)]);
      for (const [di, dj] of [[-1.9, 0.4], [-0.5, 1.3], [-1.6, 1.1], [1.4, -0.9]]) { const [x, y] = iso(i + di, j + dj); for (let k = 0; k < 4; k++) p.line('green', 0.85, 1, [[x + (k - 1.5) * 2.6, y], [x + (k - 1.5) * 3.4, y - 10 - (k % 2) * 4]]); p.ellipse('orange', 0.85, x + 1.4, y - 12, 1.1, 3); }
    },
    sprites() {
      const [hx, hy] = iso(i - 1.05, j + 0.55), [nx, ny] = cell(3, 3);
      const lift = t => { const f = (t / 6) % 1; return f < 0.1 ? ease(f / 0.1) : f < 0.45 ? 1 : f < 0.55 ? 1 - ease((f - 0.45) / 0.1) : 0; };
      return [
        still(hx, hy, 12, 34, t => [lift(t) * 6, wave(t, 3.8) * 0.4, B(blink(t, 101))], (p, t) => heron(p, hx, hy, 0.82 * K, -1, wave(t, 3.8), blink(t, 101), lift(t))),
        still(nx + 12, ny + 2, 12, 34, t => [wave(t, 4.2) * 0.4, B(blink(t, 102)), B(((t / 7) % 1) < 0.5)], (p, t) => heron(p, nx + 12, ny + 2, 0.72 * K, ((t / 7) % 1) < 0.5 ? -1 : 1, wave(t, 4.2), blink(t, 102), 0)),
        ripple(hx, hy + 1, 10, 4.2, 0.2),
        ...paths.map(([ink, Q], n) => trace('herons', Q.map(([r, c]) => cell(r, c)), false, 'paper', 1.3, 0.5 + n * 0.45, 0.8))
      ];
    },
    top: iso(I + 0.35, J + 0.35, 52)
  });
}

/* 12. Magpies: a tall narrow house and a picture board being filled */
{
  const i = 19.6, j = 12.2, I = i - 0.35, J = j - 1.35, i0 = i - 1.35, jf = j + 0.3;
  const pic = ['01010', '11111', '11111', '01110', '00100'];
  const gu = 0.3, cw = 0.16, gv = 44, ch = 6.2;
  place({
    kluc: 'magpies', name: 'Magpies', i, j, clear: 2.1, bb: [-110, -130, 100, 56], hit: [-6, -40, 84, 70],
    sign: [i - 0.1, j + 1.5, 'blue'],
    where: 'The magpies’ tower',
    scene: 'A magpie follows the numbers along the board, filling in the picture of what it brought home.',
    rule: 'Follow the numbers by every row and column to fill the grid and reveal the picture the magpies brought home.',
    static(p) {
      cottage(p, I, J, 0.9, 0.85, 50, 'blue', 'plum', { rh: 30, door: 0.45, winsJ: [], winsI: [0.42] });
      faceJ(p, 'night', 0.7, I + 0.33, J + 0.85, 0, 0.24, 34, 42); faceJ(p, 'paper', 1, I + 0.44, J + 0.85, 0, 0.02, 34, 42);
      if (p.glow) p.glow.push([iso(I + 0.33, J + 0.85, 34), iso(I + 0.57, J + 0.85, 34), iso(I + 0.57, J + 0.85, 42), iso(I + 0.33, J + 0.85, 42)]);
      board(p, i0, jf, 1.15, 8, 56);
      // clues, as tiny ticks, and the grid
      for (let r = 0; r < 5; r++) { const n = pic[r].split('0').filter(Boolean).length; for (let k = 0; k < n; k++) faceJ(p, 'night', 0.7, i0 + 0.1 + k * 0.06, jf, 0, 0.03, gv - (r + 1) * ch + 2.4, gv - (r + 1) * ch + 3.6); }
      for (let c = 0; c < 5; c++) faceJ(p, 'night', 0.7, i0 + gu + c * cw + 0.06, jf, 0, 0.04, gv + 3, gv + 5);
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
        const u0 = gu + c * cw, v1 = gv - r * ch;
        faceJ(p, 'night', 0.14, i0 + u0, jf, 0.01, cw - 0.01, v1 - ch + 0.4, v1 - 0.4);
        if (pic[r][c] === '1' && !(r === 0 && c === 3)) { faceJ(p, 'night', 0.82, i0 + u0, jf, 0.015, cw - 0.015, v1 - ch + 0.6, v1 - 0.6); faceJ(p, 'pink', 0.4, i0 + u0, jf, 0.015, cw - 0.015, v1 - ch + 0.6, v1 - 0.6); }
      }
      // treasures on the ground
      const [tx, ty] = iso(i - 0.2, j + 0.95);
      p.ellipse('sun', 1, tx, ty, 3.4, 2); p.line('sun', 1, 1.2, [[tx + 3, ty], [tx + 11, ty - 3]]);
      p.path('sun', 1, (c, ox, oy) => c.ellipse(tx - 9 + ox, ty - 2 + oy, 3.2, 1.8, 0, 0, TAU), 1.2);
      p.circle('pink', 1, tx + 6, ty + 4, 1.8); p.circle('teal', 1, tx - 4, ty + 4, 1.4);
    },
    sprites() {
      const [cx, cy] = iso(i0 + gu + 3.5 * cw, jf, gv - 0.5 * ch);
      const perch = iso(i0 + 0.85, jf, 57);
      const [gx, gy] = iso(i + 0.4, j + 0.7);
      const hop = t => { const f = (t / 3.1) % 1; return f < 0.12 ? sin(f / 0.12 * Math.PI) : 0; };
      return [
        still(cx, cy + 6, 8, 12, t => [B(((t / 2.4) % 1) < 0.62 || act('magpies', t) > 0.3)], (p, t) => {
          if (((t / 2.4) % 1) < 0.62 || act('magpies', t) > 0.3) { faceJ(p, 'night', 0.82, i0 + gu + 3 * cw, jf, 0.015, cw - 0.015, gv - ch + 0.6, gv - 0.6); faceJ(p, 'pink', 0.4, i0 + gu + 3 * cw, jf, 0.015, cw - 0.015, gv - ch + 0.6, gv - 0.6); }
          else { p.line('sun', 1, 1, [[cx - 4, cy], [cx + 4, cy]]); p.line('sun', 1, 1, [[cx, cy - 4], [cx, cy + 4]]); }
        }),
        still(perch[0], perch[1], 14, 18, t => [wave(t, 1.4) * 2.2, B(blink(t, 111))], (p, t) => magpie(p, perch[0], perch[1], 0.78 * K, -1, wave(t, 3), blink(t, 111), wave(t, 1.4) - 0.5)),
        still(gx, gy, 14, 20, t => [hop(t) * 4, B(((t / 6.2) % 1) < 0.5), B(blink(t, 112))], (p, t) => magpie(p, gx, gy - hop(t) * 4, 0.74 * K, ((t / 6.2) % 1) < 0.5 ? 1 : -1, wave(t, 3), blink(t, 112), 0.2)),
        smoke(chimneyTop(I, J, 0.9, 0.85, 50, 30), 12),
        // inside the tower: shelves of finds, and a magpie checking the picture
        room('magpies', I, J, 0.9, 0.85, 50, 'plum', {
          st: t => floor(act('magpies', t, 1.4, 1.0) * 9) + B(blink(t, 117)) * 0.1,
          draw(p, t) {
            for (const v of [22, 34]) { p.line('orange', 0.9, 1.6, [iso(I + 0.08, J, v), iso(I + 0.82, J, v)]); for (let k = 0; k < 4; k++) { const q = iso(I + 0.16 + k * 0.18, J, v + 1.8); p.circle(['sun', 'pink', 'teal', 'sun'][(k + v) % 4], 1, q[0], q[1], 1.4); } }
            table(p, I + 0.55, J + 0.45, act('magpies', t, 1.4, 1.0), 'night');
            const [mx, my] = iso(I + 0.22, J + 0.62);
            magpie(p, mx, my, 1.0, 1, 0.5, blink(t, 117), 0.2);
          }
        }),
      ];
    },
    top: iso(I + 0.45, J + 0.42, 80)
  });
}

/* 13. Squirrels: the great oak with numbered hollows */
{
  const i = 25.2, j = 12.2;
  place({
    kluc: 'squirrels', name: 'Squirrels', i, j, clear: 2.2, bb: [-80, -175, 80, 36], hit: [0, -70, 62, 92],
    sign: [i - 0.95, j + 1.25, 'orange'],
    where: 'The squirrels’ oak',
    scene: 'The squirrels hide acorns in the hollows, and every little sign says how many acorns its run of hollows holds.',
    rule: 'Every sign says how many acorns hide in the run of hollows beside it, and no number repeats within a run.',
    static(p) {
      const [X, Y] = iso(i, j);
      p.ellipse('dots', 0.55, X + 16, Y + 4, 46, 12);
      p.poly('paper', 1, [[X - 13, Y], [X + 13, Y], [X + 9, Y - 70], [X - 9, Y - 70]]);
      p.poly('orange', 0.85, [[X - 13, Y], [X + 13, Y], [X + 9, Y - 70], [X - 9, Y - 70]]);
      p.poly('night', 0.3, [[X - 13, Y], [X + 13, Y], [X + 9, Y - 70], [X - 9, Y - 70]]);
      p.poly('night', 0.28, [[X + 1, Y], [X + 13, Y], [X + 9, Y - 70], [X + 1, Y - 70]]);
      p.poly('orange', 0.85, [[X - 22, Y + 2], [X - 11, Y - 10], [X - 6, Y]]); p.poly('orange', 0.85, [[X + 22, Y + 3], [X + 11, Y - 12], [X + 6, Y]]);
      for (let k = 0; k < 7; k++) p.line('night', 0.3, 0.7, [[X - 7 + (k % 4) * 4, Y - 6 - k * 9], [X - 6 + (k % 4) * 4, Y - 13 - k * 9]]);
      // branches
      p.path('orange', 0.9, (c, ox, oy) => { c.moveTo(X + 6 + ox, Y - 60 + oy); c.quadraticCurveTo(X + 24 + ox, Y - 66 + oy, X + 40 + ox, Y - 64 + oy); }, 4);
      p.path('orange', 0.9, (c, ox, oy) => { c.moveTo(X - 6 + ox, Y - 66 + oy); c.quadraticCurveTo(X - 24 + ox, Y - 76 + oy, X - 38 + ox, Y - 80 + oy); }, 4);
      // crown
      const crownS = (c, ox, oy) => { for (const [dx, dy, r] of [[-38, -104, 30], [36, -100, 30], [0, -128, 36], [-18, -88, 22], [20, -86, 22]]) { c.moveTo(X + dx + r + ox, Y + dy + oy); c.arc(X + dx + ox, Y + dy + oy, r, 0, TAU); } };
      p.path('paper', 1, crownS); p.path('green', 0.85, crownS);
      p.path('dots', 0.6, (c, ox, oy) => c.ellipse(X + 26 + ox, Y - 94 + oy, 34, 24, 0.3, 0, TAU));
      p.circle('sun', 0.5, X - 20, Y - 132, 16); p.circle('sun', 0.4, X - 44, Y - 110, 10);
      for (let k = 0; k < 12; k++) { const ax = X - 50 + hash(k, 21) * 100, ay = Y - 140 + hash(k, 22) * 60; p.ellipse('sun', 1, ax, ay, 1.8, 2.2); p.ellipse('orange', 1, ax, ay - 2, 2.2, 1.1); }
      // hollows and their signs
      for (const [dx, dy, n, side] of [[-2, -18, 4, 1], [3, -36, 7, -1], [-1, -52, 3, 1]]) {
        p.ellipse('night', 0.88, X + dx, Y + dy, 4, 5.6); p.ellipse('orange', 0.6, X + dx, Y + dy + 4.4, 4.6, 1.6, 0, 0, Math.PI);
        const sx = X + dx + side * 13, sy = Y + dy - 2;
        p.poly('paper', 1, [[sx - 5, sy - 5], [sx + 5, sy - 5], [sx + 5, sy + 5], [sx - 5, sy + 5]]); p.poly('night', 0.2, [[sx - 5, sy - 5], [sx + 5, sy - 5], [sx + 5, sy + 5], [sx - 5, sy + 5]]);
        p.line('night', 0.6, 0.6, [[sx - 5, sy - 5], [sx + 5, sy + 5]]);
        p.text('night', 0.95, String(n), sx + 2, sy - 1.6, 5, 700);
        p.line('orange', 0.9, 1, [[sx - side * 5, sy], [X + dx + side * 4, sy + 1]]);
      }
      p.ellipse('sun', 1, X - 2, Y - 18.5, 2, 2.4); p.ellipse('orange', 1, X - 2, Y - 21, 2.3, 1.1);
      // a ladder and a basket of acorns
      p.line('orange', 0.9, 1.1, [[X - 20, Y + 2], [X - 13, Y - 44]]); p.line('orange', 0.9, 1.1, [[X - 14, Y + 3], [X - 8, Y - 44]]);
      for (let k = 1; k < 7; k++) p.line('orange', 0.9, 1, [[X - 20 + k * 1.05, Y + 2 - k * 6.6], [X - 14 + k * 0.9, Y + 3 - k * 6.7]]);
      const [bx, by] = iso(i + 0.75, j + 0.25);
      p.poly('orange', 0.9, [[bx - 8, by - 8], [bx + 8, by - 8], [bx + 6, by + 1], [bx - 6, by + 1]]); p.poly('night', 0.2, [[bx, by - 8], [bx + 8, by - 8], [bx + 6, by + 1], [bx, by + 1]]);
      for (let k = 0; k < 5; k++) { p.ellipse('sun', 1, bx - 5 + k * 2.6, by - 9, 1.9, 2.2); p.ellipse('orange', 1, bx - 5 + k * 2.6, by - 11.2, 2.2, 1); }
    },
    sprites() {
      const [X, Y] = iso(i, j), [gx, gy] = iso(i - 0.45, j + 0.75);
      const flick = t => { const f = (t / 3.3) % 1; return f < 0.16 ? sin(f / 0.16 * TAU) : 0; };
      const drop = t => { const f = (t / 7) % 1; return f < 0.1 ? f / 0.1 : -1; };
      // when the oak opens, the squirrel on the ground tosses an acorn into the
      // middle hollow, and that sign gets its tick
      const hx = X + 3, hy = Y - 36;
      const toss = S([min(gx, hx) - 8, hy - 30, max(gx, hx) + 22, gy + 4], t => [floor(act('squirrels', t, 1.0, 0.5) * 24)], (p, t) => {
        const a = act('squirrels', t, 1.0, 0.5); if (a <= 0) return;
        const f = min(1, a / 0.7), e = ease(f), x = gx + 6 + (hx - gx - 6) * e, y = gy - 10 + (hy - gy + 10) * e - sin(f * Math.PI) * 22;
        if (f < 1) { p.ellipse('sun', 1, x, y, 1.9, 2.3); p.ellipse('orange', 1, x, y - 2.2, 2.3, 1.1); }
        else { p.ellipse('sun', 1, hx, hy + 0.6, 2, 2.4); p.ellipse('orange', 1, hx, hy - 1.8, 2.3, 1.1); }
        if (a > 0.7) { const g = pop((a - 0.7) / 0.3), sx = hx - 13 + 7, sy = hy - 2 - 7; p.circle('paper', 1, sx, sy, 3.6 * g); p.line('green', 1, 1.2, [[sx - 2 * g, sy], [sx - 0.6 * g, sy + 1.6 * g], [sx + 2.2 * g, sy - 1.8 * g]]); }
      });
      return [
        still(gx, gy, 16, 22, t => [flick(t) * 3, wave(t, 2.6) * 0.4, B(blink(t, 121))], (p, t) => squirrel(p, gx, gy, 0.8 * K, 1, wave(t, 2.6), blink(t, 121), flick(t))),
        still(X + 34, Y - 64, 14, 22, t => [flick(t + 1.4) * 3, B(blink(t, 122))], (p, t) => squirrel(p, X + 34, Y - 64, 0.72 * K, -1, wave(t, 2.9), blink(t, 122), flick(t + 1.4))),
        toss,
        S([X + 16, Y - 88, X + 34, Y + 6], t => [drop(t) * 90], (p, t) => { const f = drop(t); if (f < 0) return; const y = Y - 84 + f * f * 86, x = X + 22 + f * 4; p.ellipse('sun', 1, x, y, 1.9, 2.3); p.ellipse('orange', 1, x, y - 2.2, 2.3, 1.1); })
      ];
    },
    top: iso(i, j, 168)
  });
}

/* 14. Beavers: lodges by the pond, a tree beside each, a tail slap */
{
  const i = 18.4, j = 6.2;
  const lodge = (p, X, Y, w, h) => {
    p.ellipse('dots', 0.45, X + 5, Y + 2, w * 1.1, h * 0.3);
    const dome = (c, ox, oy) => { c.moveTo(X - w + ox, Y + oy); c.quadraticCurveTo(X - w * 0.9 + ox, Y - h * 1.3 + oy, X + ox, Y - h + oy); c.quadraticCurveTo(X + w * 0.9 + ox, Y - h * 1.3 + oy, X + w + ox, Y + oy); c.quadraticCurveTo(X + ox, Y + h * 0.3 + oy, X - w + ox, Y + oy); };
    p.path('orange', 0.9, dome); p.path('night', 0.22, dome);
    for (let k = 0; k < 16; k++) { const a = -Math.PI * (0.08 + hash(k, X | 0) * 0.84), r0 = 0.3 + hash(k, 3) * 0.5; p.line(k % 3 ? 'orange' : 'night', 0.6, 1, [[X + cos(a) * w * r0, Y + sin(a) * h * r0], [X + cos(a) * w * (r0 + 0.35), Y + sin(a) * h * (r0 + 0.35)]]); }
    p.path('night', 0.8, (c, ox, oy) => { c.moveTo(X - 5 + ox, Y + 2 + oy); c.quadraticCurveTo(X + ox, Y - 9 + oy, X + 5 + ox, Y + 2 + oy); c.closePath(); });
  };
  place({
    kluc: 'beavers', name: 'Beavers', i, j, clear: 2.3, bb: [-120, -90, 110, 56], hit: [0, -12, 92, 56],
    sign: [i - 1.25, j + 2.1, 'orange'],
    where: 'The beavers’ pond',
    scene: 'Every tree by the pond has its own beaver lodge beside it, and no two lodges touch.',
    rule: 'Give every tree its own lodge next to it, keep the lodges apart and match the numbers by every row and column.',
    static(p) {
      const [ax, ay] = iso(i + 0.35, j - 0.25);
      lodge(p, ax, ay, 22, 17);
      tree(p, ...iso(i + 1.25, j - 1.55), 1.1, 'round', 31);
      const [bx, by] = iso(i - 2.0, j + 0.25);
      tree(p, ...iso(i - 2.2, j - 0.9), 1.05, 'pine', 32);
      lodge(p, bx, by, 18, 14);
      // a gnawed stump with chips
      const [sx0, sy0] = iso(i - 0.2, j + 2.1);
      p.poly('orange', 0.85, [[sx0 - 5, sy0], [sx0 + 5, sy0], [sx0 + 4, sy0 - 7], [sx0 - 4, sy0 - 7]]);
      p.ellipse('sun', 0.9, sx0, sy0 - 7, 4, 1.8); p.path('orange', 0.8, (c, ox, oy) => c.ellipse(sx0 + ox, sy0 - 7 + oy, 2.2, 0.9, 0, 0, TAU), 0.5);
      for (let k = 0; k < 5; k++) p.ellipse('sun', 0.9, sx0 - 10 + k * 5, sy0 + 2 + (k % 2) * 2, 1.4, 0.8, k);
      tag(p, ...iso(i + 1.55, j + 0.2), 1);
      tag(p, ...iso(i - 1.0, j + 1.5), 2);
    },
    sprites() {
      const [x, y] = iso(i + 0.45, j + 1.55);
      const slap = t => { const f = (t / 5) % 1; return f < 0.06 ? sin(f / 0.06 * Math.PI) : 0; };
      const [rx, ry] = [x + 14, y - 4];
      const ring = t => ((t / 5) % 1);
      return [
        still(x, y, 22, 18, t => [slap(t) * 6, wave(t, 3.4) * 0.4, B(blink(t, 131))], (p, t) => beaver(p, x, y, 0.8, -1, wave(t, 3.4), blink(t, 131), slap(t))),
        S([rx - 26, ry - 12, rx + 26, ry + 12], t => [ring(t) < 0.6 ? floor(t * 12) * 9 : -1], (p, t) => { const f = ring(step(t)); if (f >= 0.6) return; const g = f / 0.6; for (const d of [0, 0.25]) { const h = g - d; if (h <= 0) continue; p.path('paper', (1 - h) * 0.8, (c, ox, oy) => c.ellipse(rx + ox, ry + oy, 5 + h * 18, 2.5 + h * 8, 0, 0, TAU), 1); } })
      ];
    },
    top: iso(i + 0.35, j - 0.25, 30)
  });
}

/* 15. Otters: a holt on the bank and a river loop round the marsh */
{
  const i = 14.6, j = 3.9, M = [i - 1.75, j - 0.45], cs = 0.5;
  const V = [[0, 0], [2, 0], [2, 1], [3, 1], [3, 3], [1, 3], [1, 2], [0, 2]];
  const P = V.map(([u, v]) => iso(M[0] + u * cs, M[1] + v * cs));
  // the numbers: how many sides of each marsh patch the river runs along
  const E = new Set();
  V.forEach((a, k) => { const b = V[(k + 1) % V.length], du = Math.sign(b[0] - a[0]), dv = Math.sign(b[1] - a[1]); let u = a[0], v = a[1]; while (u !== b[0] || v !== b[1]) { const nu = u + du, nv = v + dv; E.add(du ? `h${min(u, nu)},${v}` : `v${u},${min(v, nv)}`); u = nu; v = nv; } });
  const count = (cu, cv) => [`h${cu},${cv}`, `h${cu},${cv + 1}`, `v${cu},${cv}`, `v${cu + 1},${cv}`].filter(k => E.has(k)).length;
  place({
    kluc: 'otters', name: 'Otters', i, j, clear: 2.2, bb: [-110, -80, 110, 60], hit: [0, -10, 90, 56],
    sign: [i + 0.1, j + 1.55, 'teal'],
    where: 'The otters’ holt',
    scene: 'An otter swims its one closed loop round the marsh, and every number says how many sides of its patch the river touches.',
    rule: 'Draw the river as one closed loop along the grid lines; a number in the marsh says how many of its sides the river runs along.',
    static(p) {
      ground(p, 'green', 0.3, M[0] - 0.15, M[1] - 0.15, 3 * cs + 0.3, 3 * cs + 0.3);
      ground(p, 'sun', 0.18, M[0] - 0.15, M[1] - 0.15, 3 * cs + 0.3, 3 * cs + 0.3);
      for (let u = 0; u <= 3; u++) for (let v = 0; v <= 3; v++) { const [x, y] = iso(M[0] + u * cs, M[1] + v * cs); p.circle('night', 0.5, x, y, 0.9); }
      p.line('sun', 0.45, 11, [...P, P[0]]);
      p.line('blue', 0.7, 7.5, [...P, P[0]]);
      p.line('teal', 0.25, 4, [...P, P[0]]);
      for (const [cu, cv] of [[0, 0], [1, 1], [2, 2], [1, 0], [2, 1], [0, 2]]) { const [x, y] = iso(M[0] + (cu + 0.5) * cs, M[1] + (cv + 0.5) * cs); p.ellipse('paper', 1, x, y - 0.5, 5, 2.8); p.text('night', 0.95, String(count(cu, cv)), x, y - 1, 5.5, 700); }
      cottage(p, i + 0.25, j - 1.35, 1.1, 0.95, 20, 'teal', 'sun', { rh: 16, door: 0.5, winsJ: [0.2, 0.9] });
      for (let k = 0; k < 5; k++) { const [x, y] = iso(i + 0.3 + k * 0.22, j + 0.1 + (k % 2) * 0.1); stone(p, x, y, 0.7 + (k % 3) * 0.2); }
    },
    sprites() {
      const tr = track(P);
      const pos = t => tr.at(t * 11);
      const [ox, oy] = iso(i + 0.85, j + 0.2);
      return [
        S(t => { const [x, y] = pos(t); return [x - 16, y - 16, x + 16, y + 6]; },
          t => { const [x, y, dx] = pos(t); return [x, y, B(dx > 0)]; },
          (p, t) => { const [x, y, dx] = pos(t); const f = dx > 0 ? 1 : -1; p.line('paper', 0.7, 0.8, [[x - f * 10, y + 1], [x - f * 17, y + 2.4]]); otter(p, x, y + 3, 0.62 * K, f, wave(t, 2), blink(t, 141), true); }),
        still(ox, oy, 16, 18, t => [wave(t, 3) * 0.4, B(blink(t, 142))], (p, t) => otter(p, ox, oy, 0.7 * K, -1, wave(t, 3), blink(t, 142), false)),
        smoke(chimneyTop(i + 0.25, j - 1.35, 1.1, 0.95, 20, 16), 15),
        // inside the holt: an otter drawing today's river on the table
        (() => { const I = i + 0.25, J = j - 1.35; return room('otters', I, J, 1.1, 0.95, 20, 'sun', {
          st: t => floor(act('otters', t, 1.4, 1.0) * 9) + B(blink(t, 147)) * 0.1,
          draw(p, t) {
            const [fx, fy] = iso(I + 0.3, J, 12);
            p.line('orange', 0.9, 1.2, [[fx - 7, fy - 2], [fx + 7, fy + 2]]);
            for (let k = 0; k < 3; k++) { p.ellipse('blue', 0.8, fx - 4 + k * 4, fy + k * 1.2 + 3, 2.2, 0.9, 0.3); p.poly('blue', 0.8, [[fx - 2 + k * 4, fy + k * 1.2 + 3], [fx - 0.6 + k * 4, fy + k * 1.2 + 1.8], [fx - 0.6 + k * 4, fy + k * 1.2 + 4.2]]); }
            table(p, I + 0.7, J + 0.45, act('otters', t, 1.4, 1.0), 'blue');
            const [ox2, oy2] = iso(I + 0.32, J + 0.7);
            otter(p, ox2, oy2, 0.95, 1, 0.5, blink(t, 147), false);
          }
        }); })(),
      ];
    },
    top: iso(i + 0.8, j - 0.9, 38)
  });
}

/* The order a keyboard walks the village in, west to east, top to bottom */
export const ORDER = ['square', 'hedgehogs', 'dormice', 'badgers', 'hares', 'voles', 'owls', 'swans', 'cranes', 'otters', 'beavers', 'magpies', 'squirrels', 'herons', 'foxes'];
PLACES.sort((a, b) => ORDER.indexOf(a.kluc) - ORDER.indexOf(b.kluc));
{ // the notice board counts the open houses itself
  const W = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'];
  const open = PLACES.filter(q => !q.square && !q.soon).length, soon = PLACES.filter(q => q.soon).length;
  const sq = PLACES.find(q => q.square);
  sq.rule = W[open][0].toUpperCase() + W[open].slice(1) + ' houses with a new puzzle every day, easy on Monday and hardest on Sunday' + (soon ? ', and ' + W[soon] + ' more opening soon.' : '.');
}

/* Life that belongs to no house: glints on the water, the waterfall, fireflies */
export function ambient(W, eve) {
  const out = [];
  // glints: small dashes that drift with the current, in clusters of five
  const pts = W.samples.filter((s, k) => k % 3 === 0);
  for (let g = 0; g < pts.length; g += 5) {
    const grp = pts.slice(g, g + 5);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const s of grp) { x0 = min(x0, s.x - 32); y0 = min(y0, s.y - 16); x1 = max(x1, s.x + 32); y1 = max(y1, s.y + 16); }
    const ph = grp.map(s => s.n * 7.3);
    const f = (t, k) => ((t / 2.6 + ph[k]) % 1);
    // they change four times a second, like a riso flip book, not every frame
    out.push(S([x0, y0, x1, y1], t => [floor(t * 4) * 9], (p, t) => {
      t = floor(t * 4) / 4;
      grp.forEach((s, k) => {
        const u = f(t, k), a = sin(u * Math.PI) * 0.85, d = (u - 0.5) * 9, side = (hash(k + g, 5) - 0.5) * 34;
        const x = s.x + s.dx * d + s.dy * side, y = s.y + s.dy * d - s.dx * side * 0.5, w = 2.6 + s.n * 2;
        p.path(eve ? 'sun' : 'paper', a, (c, ox, oy) => { c.moveTo(x - w * 2 + ox, y + oy); c.quadraticCurveTo(x - w + ox, y - 1.8 + oy, x + ox, y + oy); c.quadraticCurveTo(x + w + ox, y - 1.8 + oy, x + w * 2 + ox, y + oy); }, 1.1);
      });
    }));
  }
  // the waterfall where the river leaves the island
  if (W.fall) {
    const [x, y] = W.fall;
    out.push(S([x - 20, y - 4, x + 20, y + 110], t => [floor(t * 12) * 9], (p, t) => {
      t = floor(t * 12) / 12;
      p.path('blue', 0.55, (c, ox, oy) => { c.moveTo(x - 13 + ox, y + oy); c.lineTo(x + 13 + ox, y + oy); c.lineTo(x + 10 + ox, y + 100 + oy); c.lineTo(x - 10 + ox, y + 100 + oy); c.closePath(); });
      p.path('teal', 0.2, (c, ox, oy) => { c.rect(x - 11 + ox, y + oy, 22, 100); });
      const off = (t * 40) % 20;
      for (let k = -1; k < 6; k++) for (const dx of [-7, -1, 5]) {
        const yy = y + k * 20 + off + (dx + 7) * 0.9;
        if (yy < y || yy > y + 92) continue;
        p.line('paper', 0.85, 1.3, [[x + dx, yy], [x + dx, yy + 7]]);
      }
      for (let k = 0; k < 5; k++) p.circle('paper', 0.7, x - 12 + k * 6, y + 100 + sin(t * 3 + k) * 1.5, 3.4);
    }));
  }
  // fireflies in the evening, over the meadows and by the water
  if (eve) {
    const spots = [[9, 17.5], [12, 18], [15.5, 18.5], [19, 15], [7, 6], [16, 11.5], [21, 22], [11.5, 26], [20.5, 8.5], [3, 10]];
    spots.forEach(([i, j], n) => {
      const [cx, cy] = iso(i, j);
      const pos = t => [cx + sin(t * 0.37 + n) * 22 + sin(t * 0.91 + n * 2) * 6, cy - 14 + cos(t * 0.29 + n * 3) * 9 + sin(t * 1.3 + n) * 3, 0.5 + 0.5 * sin(t * 2.1 + n * 1.7)];
      out.push(S(t => { const [x, y] = pos(t); return [x - 6, y - 6, x + 6, y + 6]; }, t => { const [x, y, a] = pos(t); return [x, y, a * 3]; }, (p, t) => {
        const [x, y, a] = pos(t), c = p.c;
        c.globalCompositeOperation = 'screen'; c.globalAlpha = 1;
        const g = c.createRadialGradient(x, y, 0, x, y, 5);
        g.addColorStop(0, `rgba(255,230,140,${0.35 + a * 0.6})`); g.addColorStop(1, 'rgba(255,230,140,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fill();
        c.globalCompositeOperation = 'source-over';
      }));
    });
  }
  return out;
}
