/* Paris, 1838: the people and the rooms of volumes three and four.
 * A lady in the dress of the time (bell skirt, wide sleeves, hair in bands
 * and a knot), Haydée in the Greek dress the book describes, and the
 * furniture of the count's Paris: parquet, curtains, chandeliers, gilt
 * frames, armchairs, books. Every function takes the kit `k` from ink.js. */
import { C } from './parts.js';

/* Pale skin for the count ("livid complexion", r. 21751) and the sick. */
export const PALE = { y: 0.2, r: 0.15 };

function frameOf(x, y, s, d) {
  const X = (dx) => x + dx * s * d, Y = (dy) => y - dy * s;
  const pts = (arr) => { const out = []; for (let i = 0; i < arr.length; i += 2) out.push(X(arr[i]), Y(arr[i + 1])); return out; };
  return { X, Y, pts };
}

/* Arms of a figure: shoulder, elbow and hand in figure units per pose.
   Right arm is +x (the side the figure faces). */
const POSES = {
  down: [[-9, 74, -11.5, 63, -10.5, 53], [9, 74, 11.5, 63, 10.5, 53]],
  clasp: [[-9, 74, -9, 63, 0, 67], [9, 74, 9, 63, 1.5, 66]],
  offer: [[-9, 74, -11.5, 63, -10.5, 53], [9, 74, 17, 71, 27, 75]],
  reach: [[-9, 74, -11.5, 63, -10.5, 53], [9, 74, 16, 84, 20, 95]],
  read: [[-9, 74, -6, 62, 9, 69], [9, 74, 12, 63, 17, 71]],
  plead: [[-9, 74, -2, 66, 8, 71], [9, 74, 13, 66, 10, 72]],
  veil: [[-9, 74, -14, 64, -19, 58], [9, 74, 11.5, 63, 10.5, 53]],
};

/* A lady of 1838, feet at (x, y), height h. o.dress, o.bodice, o.sleeve,
   o.hair, o.sash, o.scarf (gauze over the shoulders), o.flounce (hem bands),
   o.veilBack (a veil thrown back over the head), o.veil (a veil over all).
   o.arms picks a pose from POSES. Returns the hands in scene units. */
export function lady(k, x, y, h, o) {
  o = o || {};
  const s = h / 100, d = o.dir || 1;
  const { X, Y, pts } = frameOf(x, y, s, d);
  const dress = o.dress || C.cream, skin = o.skin || C.skin, hair = o.hair || C.ink;
  const bodice = o.bodice || dress, sleeve = o.sleeve || dress;
  const lean = o.lean || 0;
  if (o.veilBack) k.fill(o.veilBack, k.blob(pts([1 + lean, 101, -7 + lean, 99, -13, 74, -19, 34, -11, 30, -5, 62, 3 + lean, 94])));
  /* the bell skirt */
  const sk = k.P();
  const a = pts([-7.5 + lean * 0.5, 58, 7.5 + lean * 0.5, 58]);
  sk.moveTo(a[0], a[1]); sk.lineTo(a[2], a[3]);
  sk.bezierCurveTo(X(15), Y(44), X(22), Y(20), X(25), Y(0));
  sk.quadraticCurveTo(X(0), Y(-2.2), X(-25), Y(0));
  sk.bezierCurveTo(X(-22), Y(20), X(-15), Y(44), a[0], a[1]);
  sk.closePath();
  k.fill(dress, sk);
  k.clip(sk, () => {
    k.add(o.shade || { b: 0.2, r: 0.04 }, k.poly(pts([5, 60, 30, 60, 30, -4, 11, -4])));
    const fold = k.P();
    for (const fx of [-12, -4, 5]) { const f = pts([fx * 0.4, 56, fx, 2]); fold.moveTo(f[0], f[1]); fold.lineTo(f[2], f[3]); }
    k.addStroke(o.shade || { b: 0.2, r: 0.04 }, fold, 0.7 * s);
    if (o.flounce) {
      const fl = k.P();
      for (const fy of [4, 13, 22]) { const w = 25 - fy * 0.3; const f = pts([-w, fy, 0, fy - 2, w, fy]); fl.moveTo(f[0], f[1]); fl.quadraticCurveTo(f[2], f[3], f[4], f[5]); }
      k.addStroke(o.flounce, fl, 1.2 * s);
    }
  });
  /* bodice, sash, neckline */
  k.fill(bodice, k.poly(pts([-7 + lean, 58, 7 + lean, 58, 8.6 + lean, 80, -8.6 + lean, 80])));
  if (o.sash) {
    k.fill(o.sash, k.poly(pts([-7.6 + lean, 61, 7.6 + lean, 61, 7.3 + lean, 57, -7.3 + lean, 57])));
    k.fill(o.sash, k.poly(pts([-5 + lean, 58, -2 + lean, 58, -7, 30, -10, 32])));
    k.fill(o.sash, k.poly(pts([-3 + lean, 58, 0 + lean, 58, -1, 34, -4, 33])));
  }
  k.fill(skin, k.poly(pts([-7 + lean, 80, 7 + lean, 80, 3.2 + lean, 85, -3.2 + lean, 85])));
  if (o.necklace) k.stroke(o.necklace, k.poly(pts([-5 + lean, 81.5, 0 + lean, 79.8, 5 + lean, 81.5]), true), 0.9 * s);
  /* sleeves: wide at the shoulder, the fashion of the 1830s */
  const pose = POSES[o.arms || 'down'];
  const hands = [];
  pose.forEach(([sx, sy, ex, ey, hx, hy], i) => {
    k.stroke(o.bare ? skin : sleeve, k.poly(pts([sx * 0.9 + lean, sy - 4, ex, ey, hx, hy]), true), 3.4 * s);
    k.fill(sleeve, k.ell(X(sx + lean), Y(sy), 4.6 * s, 6.4 * s));
    k.fill(skin, k.circ(X(hx), Y(hy), 2.4 * s));
    hands.push([X(hx), Y(hy)]);
  });
  if (o.scarf) {
    const sc = k.poly(pts([-12 + lean, 79, 12 + lean, 79, 13.5 + lean, 72, 9 + lean, 70, 4 + lean, 75, -4 + lean, 75, -9 + lean, 70, -13.5 + lean, 72]));
    k.add(o.scarf, sc);
    k.add(o.scarf, k.poly(pts([-12, 72, -9, 72, -13, 38, -16, 40])));
  }
  /* head: hair smooth in two bands over the ears and a knot behind */
  k.fill(skin, k.rect(X(-2 + lean) - (d < 0 ? 4 * s : 0), Y(86), 4 * s, 5 * s));
  k.fill(skin, k.ell(X(0.6 + lean), Y(90.5), 6 * s, 7.4 * s));
  k.fill(hair, k.blob(pts([-6.4 + lean, 88, -6.6 + lean, 95, -2 + lean, 98.6, 4 + lean, 98, 6.8 + lean, 94, 5 + lean, 95, 0 + lean, 95.6, -3.5 + lean, 92])));
  k.fill(hair, k.ell(X(-5.6 + lean), Y(96.5), 3.6 * s, 3.4 * s));
  k.fill(hair, k.ell(X(-4.8 + lean), Y(88), 2.6 * s, 3.4 * s));
  if (o.flower) k.fill(o.flower, k.circ(X(-7 + lean), Y(99), 1.9 * s));
  k.fill(o.eye || C.ink, k.ell(X(3.4 + lean), Y(91), 0.7 * s, 0.55 * s));
  if (o.veil) {
    const v = k.blob(pts([0 + lean, 103, -9 + lean, 98, -16, 70, -24, 8, 0, 2, 24, 8, 16, 70, 9 + lean, 98]));
    k.fill(o.veil, v);
    const fold = k.P();
    for (const fx of [-14, -6, 3, 11]) { const f = pts([fx * 0.3 + lean, 96, fx, 8]); fold.moveTo(f[0], f[1]); fold.lineTo(f[2], f[3]); }
    k.addStroke({ b: 0.2, r: 0.1 }, fold, 0.8 * s);
  }
  return { X, Y, hands };
}

/* Haydée in the Greek dress of chapter 49 (r. 27010 to 27022): white satin
   trousers embroidered with roses, a vest of blue and white stripes with
   open sleeves, a bodice with diamond clasps, a sash of many colours,
   a small gold cap with pearls and a purple rose, hair black to blueness.
   o.burnous: the white cashmere cloak with pearls and coral (the Opera).
   o.veilHeld: the large veil she has just put aside (the Chamber). */
export function haydee(k, x, y, h, o) {
  o = o || {};
  const s = h / 100, d = o.dir || 1;
  const { X, Y, pts } = frameOf(x, y, s, d);
  const skin = { y: 0.34, r: 0.26, b: 0.04 };
  const hair = { b: 1, r: 0.72, y: 0.3 };
  /* hair falling down her back */
  k.fill(hair, k.blob(pts([-2, 99, -8, 94, -9.5, 76, -8, 58, -3, 60, -2, 80])));
  if (o.veilHeld) {
    const v = k.blob(pts([-6, 84, -18, 70, -24, 30, -22, 2, -8, 4, -12, 40, -4, 70]));
    k.fill(o.veilHeld, v);
    const f = k.P();
    for (const fx of [-20, -15, -11]) { const p = pts([fx + 8, 76, fx, 6]); f.moveTo(p[0], p[1]); f.lineTo(p[2], p[3]); }
    k.addStroke({ b: 0.22, r: 0.08 }, f, 0.7 * s);
  }
  /* trousers, wide and gathered at the ankle */
  const tr = k.blob(pts([-10, 44, 10, 44, 12.5, 22, 8.5, 4, 2, 4, 0.5, 18, -2, 4, -8.5, 4, -12.5, 22]));
  k.fill(o.trousers || { y: 0.06, b: 0.05 }, tr);
  k.clip(tr, () => {
    k.add({ b: 0.14 }, k.poly(pts([3, 46, 14, 46, 14, 0, 5, 0])));
    for (let i = 0; i < 26; i++) k.fill(C.rose, k.circ(X(k.R(-11, 11)), Y(k.R(6, 42)), k.R(0.7, 1.2) * s));
  });
  /* slippers with turned-up toes, gold and pearls */
  k.fill(C.gold, k.poly(pts([-9.5, 4.5, -2, 4.5, 0, 1, 2.5, 2.4, 0.5, -0.6, -10, 0])));
  k.fill(C.gold, k.poly(pts([1.5, 4.5, 9, 4.5, 11, 1, 13.5, 2.4, 11.5, -0.6, 1, 0])));
  /* the long striped vest */
  const vest = k.poly(pts([-9, 80, 9, 80, 13.5, 30, -13.5, 30]));
  k.fill({ y: 0.05 }, vest);
  k.clip(vest, () => {
    const st = k.P();
    for (let i = -16; i <= 16; i += 3) { const p = pts([i * 0.62, 82, i, 28]); st.moveTo(p[0], p[1]); st.lineTo(p[2], p[3]); }
    k.addStroke(C.blue, st, 1.25 * s);
  });
  /* bodice with three diamond clasps, and the sash */
  k.fill(o.bodice || { r: 0.5, b: 0.25, y: 0.2 }, k.poly(pts([-6.5, 80.5, 6.5, 80.5, 6.2, 62, -6.2, 62])));
  for (const cy of [76, 71, 66]) { k.fill({ b: 0.3 }, k.circ(X(0), Y(cy), 1.4 * s)); k.cut(k.circ(X(0), Y(cy), 0.8 * s), 1); }
  const sash = k.poly(pts([-8.4, 62, 8.4, 62, 9, 56.5, -9, 56.5]));
  k.fill(C.gold, sash);
  k.clip(sash, () => { for (let i = -9; i < 10; i += 2.4) k.fill(k.pick([C.red, C.blue, C.green]), k.rect(X(i) - (d < 0 ? 1.1 * s : 0), Y(62), 1.1 * s, 6 * s)); });
  k.fill(C.gold, k.poly(pts([6, 58, 9, 58, 11, 44, 8, 44])));
  /* open sleeves hanging from the shoulder, bare forearms */
  const pose = POSES[o.arms || 'down'];
  const hands = [];
  pose.forEach(([sx, sy, ex, ey, hx, hy]) => {
    k.stroke(skin, k.poly(pts([ex, ey, hx, hy]), true), 2.6 * s);
    const sl = k.blob(pts([sx * 0.8, sy + 4, sx * 1.35, sy - 2, ex + (ex > 0 ? 4 : -4), ey - 4, ex, ey - 3, sx * 0.8, sy - 6]));
    k.fill({ y: 0.05 }, sl);
    k.clip(sl, () => { const st = k.P(); for (let i = -20; i <= 20; i += 3) { const p = pts([i, 90, i, 50]); st.moveTo(p[0], p[1]); st.lineTo(p[2], p[3]); } k.addStroke(C.blue, st, 1.1 * s); });
    k.fill(skin, k.circ(X(hx), Y(hy), 2.3 * s));
    k.fill(C.gold, k.rect(X(hx) - 2 * s, Y(hy + 3), 4 * s, 1.2 * s));
    hands.push([X(hx), Y(hy)]);
  });
  /* neck, head, cap, rose */
  k.fill(skin, k.rect(X(-2) - (d < 0 ? 4 * s : 0), Y(86), 4 * s, 6 * s));
  k.fill(skin, k.ell(X(0.6), Y(90.5), 6 * s, 7.4 * s));
  k.fill(hair, k.blob(pts([-6.5, 86, -6.6, 95, -2, 98.8, 4, 98.4, 6.8, 94, 4, 95.4, -1, 95.8, -3.4, 91])));
  k.fill(C.gold, k.poly(pts([-5.5, 96.5, 3.5, 99, 2, 102.6, -5.5, 101])));
  for (const px of [-4.5, -2, 0.6]) k.cut(k.circ(X(px), Y(97.4 + (px + 5) * 0.28), 0.7 * s), 1);
  k.fill(C.plum, k.circ(X(-6.4), Y(97), 2 * s));
  k.fill(C.ink, k.ell(X(3.4), Y(91), 0.75 * s, 0.6 * s));
  if (o.burnous) {
    const b = k.blob(pts([-9, 84, 9, 84, 14, 70, 16, 34, 6, 30, 0, 64, -6, 30, -16, 34, -14, 70]));
    k.fill(o.burnous, b);
    k.clip(b, () => {
      k.add({ b: 0.12 }, k.poly(pts([4, 86, 18, 86, 18, 28, 8, 28])));
      for (let i = 0; i < 40; i++) { const px = X(k.R(-15, 15)), py = Y(k.R(32, 82)); if (k.rnd() < 0.5) k.fill(C.rose, k.circ(px, py, 0.8 * s)); else k.cut(k.circ(px, py, 0.9 * s), 1); }
    });
  }
  return { X, Y, hands };
}

/* A parquet floor between y0 and y1 whose boards run to a vanishing point. */
export function parquet(k, x0, y0, x1, y1, vx, spec, o) {
  o = o || {};
  k.fill(spec, k.rect(x0, y0, x1 - x0, y1 - y0));
  const p = k.P();
  const n = o.boards || 24;
  for (let i = -n; i <= n * 2; i++) {
    const xb = x0 + (i / n) * (x1 - x0);
    p.moveTo(vx + (xb - vx) * 0.2, y0); p.lineTo(xb, y1);
  }
  for (let y = y0 + 6, g = 6; y < y1; g *= 1.28, y += g) { p.moveTo(x0, y); p.lineTo(x1, y); }
  k.addStroke(o.line || { b: 0.22, r: 0.1 }, p, o.lw || 1.4);
  if (o.shine) k.cut(k.ell(o.shine[0], o.shine[1], o.shine[2], o.shine[3]), k.rad(o.shine[0], o.shine[1], 0, o.shine[2], [0, 0.45], [1, 0]));
}

/* A curtain hanging from (x, y), w wide and h tall, with folds. */
export function drape(k, x, y, w, h, spec, o) {
  o = o || {};
  const p = k.P();
  p.moveTo(x, y); p.lineTo(x + w, y);
  const tie = o.tie;
  if (tie) { p.quadraticCurveTo(x + w * 0.2, y + h * tie, x + w * 0.45, y + h); p.lineTo(x, y + h); }
  else { p.lineTo(x + w, y + h); p.lineTo(x, y + h); }
  p.closePath();
  k.fill(spec, p);
  k.clip(p, () => {
    const f = k.P();
    const n = o.folds || Math.max(3, Math.round(w / 26));
    for (let i = 1; i < n; i++) { const fx = x + (w * i) / n; f.moveTo(fx, y); f.quadraticCurveTo(fx - (tie ? w * 0.25 : 0), y + h * 0.6, fx - (tie ? w * 0.45 : 0) * (i / n), y + h); }
    k.addStroke(o.fold || { b: 0.35, r: 0.2 }, f, o.lw || Math.max(3, w / 30));
    const hl = k.P();
    for (let i = 0; i < n; i++) { const fx = x + (w * (i + 0.5)) / n; hl.moveTo(fx, y + 6); hl.quadraticCurveTo(fx - (tie ? w * 0.22 : 0), y + h * 0.6, fx - (tie ? w * 0.4 : 0) * ((i + 0.5) / n), y + h); }
    k.cut(hl, 0.25, Math.max(1.5, w / 60));
  });
  if (o.fringe) { const fr = k.P(); for (let fx = x; fx < x + w; fx += 5) { fr.moveTo(fx, y + h); fr.lineTo(fx, y + h + 10); } k.stroke(o.fringe, fr, 2); }
}

/* A chandelier of candles hanging on a chain, with the glow knocked out
   of the room around it. */
export function chandelier(k, x, y, r, o) {
  o = o || {};
  const R = r * (o.glow || 4.5);
  if (o.glow !== 0) {
    k.cut(k.circ(x, y, R), k.rad(x, y, 0, R, [0, 0.9], [0.35, 0.5], [1, 0]));
    k.add({ y: k.rad(x, y, 0, R, [0, 0.85], [0.5, 0.35], [1, 0]), r: k.rad(x, y, 0, R * 0.6, [0, 0.15], [1, 0]) }, k.circ(x, y, R));
  }
  if (o.chain !== false) k.stroke(C.dark, k.poly([x, 0, x, y - r * 0.6], true), Math.max(1.5, r * 0.04));
  const gold = o.gold || { y: 0.9, r: 0.35, b: 0.2 };
  k.fill(gold, k.ell(x, y, r, r * 0.18));
  k.fill(gold, k.poly([x - r * 0.12, y - r * 0.55, x + r * 0.12, y - r * 0.55, x + r * 0.05, y + r * 0.45, x - r * 0.05, y + r * 0.45]));
  k.fill(gold, k.ell(x, y + r * 0.5, r * 0.18, r * 0.12));
  for (let i = 0; i < (o.n || 9); i++) {
    const a = (i / (o.n || 9)) * Math.PI * 2;
    const cx = x + Math.cos(a) * r, cy = y + Math.sin(a) * r * 0.18;
    k.fill(C.cream, k.rect(cx - r * 0.035, cy - r * 0.22, r * 0.07, r * 0.22));
    k.fill(C.gold, k.ell(cx, cy - r * 0.28, r * 0.04, r * 0.08));
  }
  /* drops of crystal */
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; k.cut(k.circ(x + Math.cos(a) * r * 0.7, y + r * 0.12 + Math.abs(Math.sin(a)) * r * 0.2, r * 0.035), 0.9); }
}

/* A gilt frame: a band of gold with a darker inner edge. */
export function frame(k, x, y, w, h, t, o) {
  o = o || {};
  const p = k.P(); p.rect(x, y, w, h); p.rect(x + t, y + t, w - 2 * t, h - 2 * t);
  k.fill(o.gold || { y: 0.9, r: 0.4, b: 0.18 }, p, { rule: 'evenodd' });
  const q = k.P(); q.rect(x + t * 0.35, y + t * 0.35, w - t * 0.7, h - t * 0.7);
  k.addStroke({ r: 0.35, b: 0.3 }, q, Math.max(1, t * 0.14));
  const e = k.P(); e.rect(x + t, y + t, w - 2 * t, h - 2 * t);
  k.addStroke({ b: 0.4, r: 0.3 }, e, Math.max(1, t * 0.2));
  const hl = k.P(); hl.moveTo(x + t * 0.6, y + h - t * 0.6); hl.lineTo(x + t * 0.6, y + t * 0.6); hl.lineTo(x + w - t * 0.6, y + t * 0.6);
  k.cut(hl, 0.5, Math.max(1, t * 0.12));
}

/* A row of book spines on a shelf from x to x+w, bottoms at y. */
export function books(k, x, y, w, hmax, o) {
  o = o || {};
  const cols = o.cols || [C.red, C.dwood, C.navy, C.wood, { r: 0.7, b: 0.5 }, { y: 0.6, r: 0.5, b: 0.3 }];
  let xx = x;
  while (xx < x + w - 4) {
    const bw = k.R(o.min || 8, o.max || 18), bh = hmax * k.R(0.7, 1);
    const lean = k.rnd() < 0.06 ? k.R(4, 10) : 0;
    const col = k.pick(cols);
    k.fill(col, k.poly([xx, y, xx + bw, y, xx + bw + lean, y - bh, xx + lean, y - bh]));
    if (o.bands !== false) { k.fill(C.gold, k.rect(xx + lean * 0.8 + 1.5, y - bh * 0.84, bw - 3, 2)); k.fill(C.gold, k.rect(xx + lean * 0.2 + 1.5, y - bh * 0.2, bw - 3, 2)); }
    xx += bw + (lean ? 3 : 0.8);
  }
}

/* A frontal armchair on casters: back, arms, seat, legs. (x, y) is the
   floor under its middle, w its width. */
export function armchair(k, x, y, w, o) {
  o = o || {};
  const wood = o.wood || { y: 0.7, r: 0.55, b: 0.35 }, cloth = o.cloth || C.red;
  const h = w * 1.3;
  k.fill(wood, k.blob([x - w * 0.46, y - h * 0.45, x - w * 0.44, y - h * 0.95, x, y - h * 1.04, x + w * 0.44, y - h * 0.95, x + w * 0.46, y - h * 0.45]));
  k.fill(cloth, k.blob([x - w * 0.38, y - h * 0.47, x - w * 0.36, y - h * 0.9, x, y - h * 0.97, x + w * 0.36, y - h * 0.9, x + w * 0.38, y - h * 0.47]));
  k.fill(wood, k.rect(x - w * 0.5, y - h * 0.44, w, h * 0.1));
  k.fill(cloth, k.rect(x - w * 0.42, y - h * 0.47, w * 0.84, h * 0.09));
  for (const sx of [-1, 1]) {
    k.fill(wood, k.rect(x + sx * w * 0.5 - (sx > 0 ? w * 0.09 : 0), y - h * 0.62, w * 0.09, h * 0.3));
    k.fill(wood, k.ell(x + sx * w * 0.455, y - h * 0.62, w * 0.075, w * 0.04));
    k.fill(wood, k.poly([x + sx * w * 0.44, y - h * 0.34, x + sx * w * 0.36, y - h * 0.34, x + sx * w * 0.38, y - h * 0.04, x + sx * w * 0.43, y - h * 0.04]));
    if (o.casters) { k.fill(C.dark, k.circ(x + sx * w * 0.405, y - w * 0.035, w * 0.045)); k.cut(k.circ(x + sx * w * 0.405, y - w * 0.035, w * 0.015), 0.6); }
  }
  return { h };
}

/* A dark lamp shade throwing its light down and to one side: a tilted
   cone of cut light. */
export function lampCone(k, x, y, w, tilt, len, o) {
  o = o || {};
  const a = tilt;
  const lx = x + Math.cos(a) * len, ly = y + Math.sin(a) * len;
  const px = -Math.sin(a), py = Math.cos(a);
  const spread = len * (o.spread || 0.55);
  const cone = k.poly([x - px * w * 0.4, y - py * w * 0.4, x + px * w * 0.4, y + py * w * 0.4, lx + px * spread, ly + py * spread, lx - px * spread, ly - py * spread]);
  k.cut(cone, k.lin(x, y, lx, ly, [0, 0.95], [0.6, 0.55], [1, 0.1]));
  k.add({ y: k.lin(x, y, lx, ly, [0, 0.9], [1, 0.25]), r: k.lin(x, y, lx, ly, [0, 0.12], [1, 0]) }, cone);
  return cone;
}
