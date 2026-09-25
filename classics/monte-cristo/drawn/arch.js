/* Architecture and things: rock, the fortress of If, towers, Marseilles
 * houses, arcades, windows and the furniture of rooms and inns.
 * Every function takes the kit `k` from ink.js. */
import { C } from './parts.js';

const scale = (base, f) => { const s = {}; for (const key in base) s[key] = base[key] * f; return s; };

/* A rock mass through outline points, with a lit and a shadow side and a few
   cracks. light: -1 lit from the left, 1 from the right. */
export function rock(k, pts, base, o) {
  o = o || {};
  const p = k.blob(pts);
  k.fill(base, p);
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  for (let i = 0; i < pts.length; i += 2) { minx = Math.min(minx, pts[i]); maxx = Math.max(maxx, pts[i]); miny = Math.min(miny, pts[i + 1]); maxy = Math.max(maxy, pts[i + 1]); }
  const light = o.light || -1;
  k.clip(p, () => {
    /* shadow half */
    const sx = light < 0 ? (minx + maxx) / 2 : minx;
    k.add(o.shadow || { b: 0.35, r: 0.15 }, k.rect(sx, miny, (maxx - minx) / 2, maxy - miny));
    /* facets */
    for (let i = 0; i < (o.facets || 14); i++) {
      const x = k.R(minx, maxx), y = k.R(miny, maxy), w = k.R(20, 70) * (o.fs || 1), h = k.R(10, 40) * (o.fs || 1);
      k.add(scale(o.shadow || { b: 0.3, r: 0.12 }, k.R(0.2, 0.6)), k.poly([x, y, x + w, y + h * 0.3, x + w * 0.7, y + h, x - w * 0.2, y + h * 0.8]));
    }
    const cr = k.P();
    for (let i = 0; i < (o.cracks || 10); i++) {
      let x = k.R(minx, maxx), y = k.R(miny, maxy);
      cr.moveTo(x, y);
      for (let j = 0; j < 3; j++) { x += k.R(-14, 14); y += k.R(6, 18); cr.lineTo(x, y); }
    }
    k.addStroke(o.crack || C.dark, cr, o.crackW || 1.4);
  });
  return p;
}

/* Crenellated top edge from x to x+w at y. */
export function crenels(k, spec, x, y, w, m) {
  const p = k.P();
  const n = Math.max(2, Math.round(w / (m * 1.6)));
  const step = w / n;
  for (let i = 0; i < n; i++) p.rect(x + i * step + step * 0.2, y - m * 0.8, step * 0.6, m * 0.8 + 0.5);
  k.fill(spec, p);
}

/* A round tower drawn as a cylinder: body, shading, crenels, slits. */
export function tower(k, x, yb, w, h, base, o) {
  o = o || {};
  const top = yb - h;
  k.fill(base, k.rect(x - w / 2, top, w, h));
  k.fill(base, k.ell(x, yb, w / 2, w * 0.08));
  const lx = o.light === 1 ? 1 : -1;
  k.add(o.shade || { b: 0.35, r: 0.12 }, k.rect(lx < 0 ? x + w * 0.05 : x - w / 2, top, w * 0.45, h));
  k.add(scale(o.shade || { b: 0.35, r: 0.12 }, 0.5), k.rect(lx < 0 ? x - w * 0.18 : x - w * 0.05, top, w * 0.23, h));
  if (o.crenels !== false) crenels(k, base, x - w / 2, top, w, w / 7);
  if (o.band !== false) k.add(o.shade || { b: 0.3 }, k.rect(x - w / 2, top + w * 0.12, w, w * 0.05));
  const slits = o.slits || 2;
  for (let i = 0; i < slits; i++) {
    const sy = top + h * (0.3 + 0.45 * i / Math.max(1, slits - 1));
    const lit = o.lit && o.lit.includes(i);
    k.fill(lit ? C.gold : (o.dark || C.dark), k.rect(x - w * 0.04 + (i % 2 ? w * 0.12 : -w * 0.1), sy, w * 0.07, w * 0.18));
  }
}

/* A block wall with a crenellated top and a few windows. */
export function wall(k, x, yb, w, h, base, o) {
  o = o || {};
  k.fill(base, k.rect(x, yb - h, w, h));
  if (o.crenels !== false) crenels(k, base, x, yb - h, w, o.m || h / 8);
  if (o.shade) k.add(o.shade, k.rect(x, yb - h, w, h));
  const win = o.windows || [];
  for (const [fx, fy, lit] of win) {
    const wx = x + w * fx, wy = yb - h * fy;
    k.fill(lit ? C.gold : (o.dark || C.dark), k.rect(wx - (o.ww || 4) / 2, wy - (o.wh || 9) / 2, o.ww || 4, o.wh || 9));
    if (lit && o.glow) k.add({ y: k.rad(wx, wy, 1, o.glow, [0, 0.5], [1, 0]) }, k.circ(wx, wy, o.glow));
  }
}

/* The Château d'If on its rock, as it is seen from the sea: a square keep
   flanked by three round towers inside a ring of ramparts. (x, y) is the
   waterline centre, s the scale (1 = about 520 units wide). */
export function chateauIf(k, x, y, s, o) {
  o = o || {};
  const stone = o.stone || C.stone, rockC = o.rock || { y: 0.35, r: 0.25, b: 0.4 };
  const X = (dx) => x + dx * s, Y = (dy) => y - dy * s;
  rock(k, [X(-270), Y(0), X(-240), Y(32), X(-190), Y(58), X(-120), Y(70), X(-40), Y(80), X(60), Y(78), X(150), Y(66), X(220), Y(46), X(262), Y(18), X(280), Y(0)], rockC, { shadow: o.rockShade || { b: 0.35, r: 0.2 }, fs: s * 1.2, facets: 18, crackW: 1.2 * s, crack: o.crack || C.dark });
  /* ramparts following the rock */
  const shade = o.shade || { b: 0.32, r: 0.12 };
  wall(k, X(-230), Y(58), 150 * s, 38 * s, stone, { shade: scale(shade, 0.2), m: 5 * s });
  wall(k, X(-80), Y(76), 260 * s, 40 * s, stone, { m: 5 * s });
  wall(k, X(170), Y(60), 70 * s, 32 * s, stone, { shade: scale(shade, 0.6), m: 5 * s });
  tower(k, X(-232), Y(56), 38 * s, 48 * s, stone, { shade, slits: 1, lit: o.lit ? [0] : null });
  tower(k, X(236), Y(58), 34 * s, 44 * s, stone, { shade, slits: 1 });
  /* the keep */
  const kx = X(-70), kw = 150 * s, kb = Y(110), kh = 118 * s;
  k.fill(stone, k.rect(kx, kb - kh, kw, kh));
  k.add(scale(shade, 0.35), k.rect(kx + kw * 0.55, kb - kh, kw * 0.45, kh));
  crenels(k, stone, kx, kb - kh, kw, 6 * s);
  const wins = o.windows || [[0.2, 0.3], [0.5, 0.3], [0.8, 0.3], [0.2, 0.62], [0.5, 0.62], [0.8, 0.62]];
  wins.forEach(([fx, fy], i) => {
    const lit = o.lit && o.lit.includes(i);
    k.fill(lit ? C.gold : C.dark, k.rect(kx + kw * fx - 3.5 * s, kb - kh * (1 - fy), 7 * s, 13 * s));
    if (lit && o.glow) k.add({ y: k.rad(kx + kw * fx, kb - kh * (1 - fy) + 6 * s, 2, 26 * s, [0, 0.5], [1, 0]) }, k.circ(kx + kw * fx, kb - kh * (1 - fy) + 6 * s, 26 * s));
  });
  /* three round towers of the keep, the big one on the left */
  tower(k, X(-78), Y(104), 60 * s, 132 * s, stone, { shade, slits: 3, lit: o.lit && o.lit.length ? [1] : null });
  tower(k, X(84), Y(104), 48 * s, 124 * s, stone, { shade, slits: 2 });
  tower(k, X(8), Y(186), 34 * s, 58 * s, stone, { shade, slits: 1, band: false });
  return { X, Y };
}

/* A row of Marseilles houses: flat fronts with tiled roofs and shutters. */
export function houses(k, x0, x1, yb, o) {
  o = o || {};
  const cols = o.cols || [C.cream, { y: 0.4, r: 0.12 }, { y: 0.28, r: 0.22 }, { y: 0.5, r: 0.2, b: 0.05 }, C.pale];
  let x = x0;
  while (x < x1) {
    const w = k.R(o.wmin || 40, o.wmax || 80), h = k.R(o.hmin || 60, o.hmax || 120);
    const col = k.pick(cols);
    k.fill(col, k.rect(x, yb - h, w + 1, h));
    k.fill(o.roof || { r: 0.7, y: 0.6, b: 0.1 }, k.poly([x - 2, yb - h, x + w + 3, yb - h, x + w - 4, yb - h - w * 0.16, x + 4, yb - h - w * 0.16]));
    k.add(o.shade || { b: 0.12 }, k.rect(x + w * 0.78, yb - h, w * 0.22, h));
    const rows = Math.max(1, Math.floor(h / (o.row || 22)));
    const nw = Math.max(1, Math.floor(w / 18));
    for (let r = 0; r < rows; r++) for (let c = 0; c < nw; c++) {
      const wx = x + (c + 0.5) * (w / nw), wy = yb - h + 10 + r * (h - 14) / rows;
      const lit = o.lit && k.rnd() < o.lit;
      k.fill(lit ? C.gold : (o.win || { b: 0.55, r: 0.2 }), k.rect(wx - 3, wy, 6, 9));
      if (o.shutters !== false && !lit) { k.fill(o.shut || { b: 0.5, y: 0.5 }, k.rect(wx - 7, wy, 3, 9)); k.fill(o.shut || { b: 0.5, y: 0.5 }, k.rect(wx + 4, wy, 3, 9)); }
    }
    x += w + (o.gap || 0);
  }
}

/* A tier of arches between x and x+w: piers of `base`, openings cut or filled. */
export function arcade(k, x, yb, w, h, n, base, o) {
  o = o || {};
  k.fill(base, k.rect(x, yb - h, w, h));
  const step = w / n;
  for (let i = 0; i < n; i++) {
    const ax = x + i * step + step * 0.18, aw = step * 0.64, ah = h * (o.open || 0.72);
    const p = k.P();
    p.moveTo(ax, yb - (o.sill || 0));
    p.lineTo(ax, yb - ah + aw / 2);
    p.arc(ax + aw / 2, yb - ah + aw / 2, aw / 2, Math.PI, 0);
    p.lineTo(ax + aw, yb - (o.sill || 0));
    p.closePath();
    if (o.through && o.through(i)) k.fill(o.through(i), p);
    else if (o.hole) k.fill(o.hole, p);
    else k.cut(p, 1);
  }
  /* cornice */
  k.fill(o.cornice || base, k.rect(x - 2, yb - h - h * 0.06, w + 4, h * 0.08));
}

export function candle(k, x, y, h, o) {
  o = o || {};
  const s = h / 100;
  if (o.glow !== false) {
    const R = (o.glow || 260) * s;
    k.cut(k.circ(x, y - h - 10 * s, R), k.rad(x, y - h - 10 * s, 0, R, [0, 0.9], [0.4, 0.45], [1, 0]));
    k.add({ y: k.rad(x, y - h - 10 * s, 0, R, [0, 0.8], [0.5, 0.35], [1, 0]) }, k.circ(x, y - h - 10 * s, R));
  }
  k.fill(o.body || C.cream, k.rect(x - 7 * s, y - h, 14 * s, h));
  k.fill(C.gold, k.ell(x, y - h - 12 * s, 5 * s, 12 * s));
  k.fill(C.orange, k.ell(x, y - h - 8 * s, 2.4 * s, 6 * s));
}

export function table(k, x, y, w, h, top, o) {
  o = o || {};
  k.fill(top, k.rect(x, y, w, (o.thick || 0.08) * h + 4));
  const legs = o.legs || top;
  k.fill(legs, k.rect(x + w * 0.06, y, w * 0.04, h));
  k.fill(legs, k.rect(x + w * 0.9, y, w * 0.04, h));
  if (o.cloth) k.fill(o.cloth, k.poly([x - 4, y, x + w + 4, y, x + w + 8, y + h * 0.45, x - 8, y + h * 0.45]));
}

export function bottle(k, x, y, h, spec) {
  const s = h / 100;
  k.fill(spec, k.blob([x - 13 * s, y, x - 14 * s, y - 55 * s, x - 5 * s, y - 70 * s, x - 4 * s, y - 100 * s, x + 4 * s, y - 100 * s, x + 5 * s, y - 70 * s, x + 14 * s, y - 55 * s, x + 13 * s, y]));
  k.cut(k.rect(x - 9 * s, y - 60 * s, 3 * s, 42 * s), 0.6);
}

export function glass(k, x, y, h, spec) {
  const s = h / 100;
  k.fill(spec, k.poly([x - 22 * s, y - 100 * s, x + 22 * s, y - 100 * s, x + 16 * s, y, x - 16 * s, y]));
  k.cut(k.rect(x - 14 * s, y - 90 * s, 5 * s, 70 * s), 0.55);
}

/* A lantern with a light around it. */
export function lantern(k, x, y, h, glowR, o) {
  o = o || {};
  const s = h / 100;
  if (glowR) {
    k.cut(k.circ(x, y, glowR), k.rad(x, y, 0, glowR, [0, 0.95], [0.35, 0.55], [1, 0]));
    k.add({ y: k.rad(x, y, 0, glowR, [0, 0.95], [0.45, 0.4], [1, 0]), r: k.rad(x, y, 0, glowR * 0.5, [0, 0.12], [1, 0]) }, k.circ(x, y, glowR));
  }
  k.fill(o.frame || C.dark, k.rect(x - 22 * s, y - 50 * s, 44 * s, 8 * s));
  k.fill(C.gold, k.rect(x - 18 * s, y - 42 * s, 36 * s, 72 * s));
  k.fill(o.frame || C.dark, k.rect(x - 22 * s, y + 30 * s, 44 * s, 8 * s));
  k.stroke(o.frame || C.dark, k.poly([x - 18 * s, y - 42 * s, x - 18 * s, y + 30 * s]), 3 * s);
  k.stroke(o.frame || C.dark, k.poly([x + 18 * s, y - 42 * s, x + 18 * s, y + 30 * s]), 3 * s);
  k.stroke(o.frame || C.dark, k.poly([x - 10 * s, y - 50 * s, x, y - 64 * s, x + 10 * s, y - 50 * s], true), 3 * s);
}
