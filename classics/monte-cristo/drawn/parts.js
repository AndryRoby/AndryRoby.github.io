/* Shared pieces for the scenes: the ink mixes and small things drawn many
 * times (people, waves, crowds, stars, stone). Every scene draws in its own
 * virtual units; these helpers take the kit `k` from ink.js. */

/* Ink mixes. y = sunflower yellow, r = bright red, b = medium blue. */
export const C = {
  gold: { y: 0.95, r: 0.16 },
  orange: { y: 0.85, r: 0.62 },
  red: { r: 0.92 },
  rose: { r: 0.42 },
  pale: { y: 0.14 },
  lblue: { b: 0.28 },
  blue: { b: 0.62 },
  navy: { b: 0.95, r: 0.5 },
  ink: { b: 1, r: 0.92, y: 0.45 },
  dark: { b: 0.9, r: 0.7, y: 0.25 },
  green: { b: 0.62, y: 0.85, r: 0.05 },
  leaf: { b: 0.85, y: 0.7, r: 0.25 },
  wood: { y: 0.65, r: 0.52, b: 0.4 },
  dwood: { y: 0.6, r: 0.62, b: 0.62 },
  stone: { y: 0.34, r: 0.16, b: 0.24 },
  skin: { y: 0.36, r: 0.3 },
  heath: { r: 0.62, b: 0.36 },
  cream: { y: 0.22, r: 0.04 },
  plum: { r: 0.8, b: 0.6 },
};

/* A standing person, feet at (x, y), height h. o.dir = 1 faces right, -1 left.
   Parts: legs, coat or dress, arms, head, hat. Each takes a colour. */
export function person(k, x, y, h, o) {
  o = o || {};
  const s = h / 100, d = o.dir || 1;
  const X = (dx) => x + dx * s * d, Y = (dy) => y - dy * s;
  const pts = (arr) => { const out = []; for (let i = 0; i < arr.length; i += 2) out.push(X(arr[i]), Y(arr[i + 1])); return out; };
  const coat = o.coat || C.navy, legs = o.legs || coat, skin = o.skin || C.skin;
  const lean = o.lean || 0;
  if (o.dress) {
    k.fill(o.dress, k.poly(pts([-5 + lean, 62, 6 + lean, 62, 17, 0, -16, 0])));
    if (o.stock) k.fill(o.stock, k.poly(pts([-6, 6, -2, 6, -2, 0, -7, 0])));
  } else {
    k.fill(legs, k.poly(pts([-8 + lean, 48, 0 + lean, 48, -3, 0, -9, 0])));
    k.fill(legs, k.poly(pts([0 + lean, 48, 8 + lean, 48, 8, 0, 2, 0])));
    if (o.boots) { k.fill(o.boots, k.poly(pts([-9.5, 14, -2.5, 14, -3, 0, -10, 0]))); k.fill(o.boots, k.poly(pts([1.5, 14, 8.5, 14, 9, 0, 1.5, 0]))); }
  }
  /* torso or coat */
  const hem = o.long ? 30 : 44;
  k.fill(coat, k.poly(pts([-10 + lean, 82, 10 + lean, 82, 11 + lean * 0.4, hem, -11 + lean * 0.4, hem])));
  if (o.shirt) k.fill(o.shirt, k.poly(pts([-3.5 + lean, 82, 3.5 + lean, 82, 1.5 + lean, 62, -1.5 + lean, 62])));
  if (o.stripes) { const st = k.P(); for (let yy = 80; yy > 64; yy -= 3.2) { const a = pts([-3 + lean, yy, 3 + lean, yy]); st.moveTo(a[0], a[1]); st.lineTo(a[2], a[3]); } k.addStroke(o.stripes, st, 1.1 * s); }
  if (o.buttons) for (let yy = 78; yy > 50; yy -= 7) { k.fill(o.buttons, k.circ(X(-5 + lean), Y(yy), 1.1 * s)); k.fill(o.buttons, k.circ(X(5 + lean), Y(yy), 1.1 * s)); }
  if (o.sash) k.fill(o.sash, k.poly(pts([-10.5 + lean * 0.6, 56, 10.5 + lean * 0.6, 56, 10.8 + lean * 0.5, 50, -10.8 + lean * 0.5, 50])));
  if (o.apron) k.fill(o.apron, k.poly(pts([-7 + lean * 0.5, 56, 7 + lean * 0.5, 56, 11, 12, -10, 12])));
  /* arms */
  const arm = (a, b) => k.stroke(o.sleeve || coat, k.poly(pts(a), true), 5.2 * s, { cap: 'round' }) || (b && k.fill(skin, k.circ(X(b[0]), Y(b[1]), 2.9 * s)));
  const A = o.arms || 'down';
  const L = [-8.5 + lean, 79], Rr = [8.5 + lean, 79];
  if (A === 'down') { arm([...L, -12, 58, -11.5, 45], [-11.5, 43]); arm([...Rr, 12, 58, 11.5, 45], [11.5, 43]); }
  if (A === 'up') { arm([...L, -12, 58, -11.5, 45], [-11.5, 43]); arm([...Rr, 20, 92, 22, 108], [22, 111]); }
  if (A === 'point') { arm([...L, -12, 58, -11.5, 45], [-11.5, 43]); arm([...Rr, 26, 78, 42, 80], [44.5, 80.5]); }
  if (A === 'hold') { arm([...L, -10, 60, 6, 58], [8, 58]); arm([...Rr, 11, 60, 16, 58], [18, 58]); }
  if (A === 'hat') { arm([...L, -12, 58, -11.5, 45], [-11.5, 43]); arm([...Rr, 16, 62, 22, 52], [22.5, 50]); k.fill(o.hatC || C.ink, k.ell(X(24), Y(47), 7 * s, 3 * s, 0.4)); }
  if (A === 'embrace') { arm([...L, -2, 70, 12, 74], null); arm([...Rr, 16, 70, 20, 66], null); }
  if (A === 'shake') { arm([...L, -12, 58, -11.5, 45], [-11.5, 43]); arm([...Rr, 17, 64, 29, 62], [31, 62]); }
  if (A === 'wave2') { arm([...L, -18, 92, -20, 107], [-20, 110]); arm([...Rr, 18, 92, 20, 107], [20, 110]); }
  /* a mantle or cloak over everything; with o.muffle one fold hides the lower face */
  if (o.mantle) {
    k.fill(o.mantle, k.blob(pts([-12 + lean, 84, -4 + lean, 88, 8 + lean, 86, 13 + lean, 76, 16, 40, 17, 22, 4, 20, -14, 22, -15, 44])));
    k.addStroke(o.mantleFold || { b: 0.25 }, k.poly(pts([4 + lean, 80, 7, 50, 6, 22]), true), 0.9 * s);
  }
  /* a monk's hood behind the head (o.hood), its brow drawn after the head */
  if (o.hood) k.fill(o.hood, k.blob(pts([-11 + lean, 80, -11.5 + lean, 94, -6 + lean, 103.5, 3 + lean, 104, 8.5 + lean, 99, 9 + lean, 86, 2 + lean, 80])));
  /* head and neck */
  k.fill(skin, k.rect(X(-2.2 + lean) - (d < 0 ? 4.4 * s : 0), Y(87), 4.4 * s, 6 * s));
  k.fill(skin, k.ell(X(lean + 0.6), Y(91.5), 6.6 * s, 7.8 * s));
  if (o.hair) k.fill(o.hair, k.poly(pts([-6.8 + lean, 92, -5 + lean, 99, 1 + lean, 100.5, 6 + lean, 97.5, 7.2 + lean, 92, 3 + lean, 95.5, -3 + lean, 94.5])));
  if (o.longHair) k.fill(o.hair || C.ink, k.poly(pts([-7 + lean, 94, -1 + lean, 100.5, 6.5 + lean, 96, 7.5 + lean, 90, 8.5 + lean, 76, 3 + lean, 80, 2 + lean, 88])));
  if (o.beard) k.fill(o.beard, k.poly(pts([-4 + lean, 88, 6 + lean, 88, 5 + lean, o.beardLen || 80, 0 + lean, (o.beardLen || 80) - 3])));
  if (o.muffle) k.fill(o.muffle, k.poly(pts([-8 + lean, 84, 8 + lean, 84, 8.5 + lean, 90.5, -2 + lean, 91.5, -8.5 + lean, 88])));
  const hat = o.hat;
  const hc = o.hatC || C.ink;
  if (hat === 'top') { k.fill(hc, k.rect(X(-9.5 + lean) - (d < 0 ? 19 * s : 0), Y(97.5), 19 * s, 2.4 * s)); k.fill(hc, k.poly(pts([-6 + lean, 97, 6 + lean, 97, 6.8 + lean, 113, -6.8 + lean, 113]))); }
  if (hat === 'bicorne') k.fill(hc, k.poly(pts([-14 + lean, 96, 14 + lean, 96, 9 + lean, 101, 0 + lean, 107, -9 + lean, 101])));
  if (hat === 'cap') k.fill(hc, k.poly(pts([-7 + lean, 95, 7 + lean, 95, 6 + lean, 101, -6 + lean, 101])));
  if (hat === 'bonnet') k.fill(hc, k.poly(pts([-7.5 + lean, 90, -6 + lean, 100, 1 + lean, 103, 7 + lean, 99, 5 + lean, 96, -1 + lean, 97])));
  /* broad-brimmed hat (the man in the Colosseum), three-cornered hat (the abbé),
     the red cap with a blue tassel (Sinbad), a sailor's varnished hat */
  if (hat === 'broad') { k.fill(hc, k.ell(X(lean + 0.6), Y(97.6), 14 * s, 2.3 * s)); k.fill(hc, k.poly(pts([-6.2 + lean, 97.5, 6.6 + lean, 97.5, 5.6 + lean, 105, -5.4 + lean, 105.5]))); }
  if (hat === 'tricorne') { k.fill(hc, k.poly(pts([-12 + lean, 96.5, 12.5 + lean, 96.5, 9 + lean, 100, 5 + lean, 104.5, -4 + lean, 104.5, -9 + lean, 100]))); k.addStroke({ y: 0.3 }, k.poly(pts([-11 + lean, 97.6, 11.5 + lean, 97.6]), true), 0.7 * s); }
  if (hat === 'fez') { k.fill(o.hatC || C.red, k.poly(pts([-6.4 + lean, 96, 6.8 + lean, 96, 5.6 + lean, 104, -5.2 + lean, 104]))); k.stroke(C.blue, k.poly(pts([0 + lean, 104, -6 + lean, 101, -8 + lean, 92]), true), 1.4 * s); }
  if (hat === 'varnished') { k.fill(hc, k.rect(X(-9 + lean) - (d < 0 ? 18 * s : 0), Y(98.2), 18 * s, 1.6 * s)); k.fill(hc, k.ell(X(lean + 0.6), Y(99.6), 6.8 * s, 4 * s)); k.cut(k.ell(X(lean + 2.4), Y(101), 2.2 * s, 0.9 * s), 0.7); }
  if (o.hood) k.fill(o.hood, k.poly(pts([-7.5 + lean, 95, -5 + lean, 100.5, 1 + lean, 102.5, 7 + lean, 100, 8 + lean, 95.5, 3 + lean, 98.5, -3 + lean, 98.5])));
}

/* A person sitting, facing o.dir. Hips at (x, y). */
export function seated(k, x, y, h, o) {
  o = o || {};
  const s = h / 100, d = o.dir || 1;
  const X = (dx) => x + dx * s * d, Y = (dy) => y - dy * s;
  const pts = (arr) => { const out = []; for (let i = 0; i < arr.length; i += 2) out.push(X(arr[i]), Y(arr[i + 1])); return out; };
  const coat = o.coat || C.navy, skin = o.skin || C.skin;
  const lean = o.lean || 0;
  k.fill(o.legs || coat, k.poly(pts([-6, 6, 22, 8, 24, 0, -8, -2])));
  k.fill(o.legs || coat, k.poly(pts([18, 8, 25, 8, 25, -34, 19, -34])));
  if (o.boots) k.fill(o.boots, k.poly(pts([18, -22, 25.5, -22, 30, -36, 17.5, -36])));
  k.fill(coat, k.poly(pts([-9 + lean, 42, 9 + lean, 42, 10, 0, -9, 0])));
  const arm = o.arm || 'lap';
  if (arm === 'lap') k.stroke(o.sleeve || coat, k.poly(pts([6 + lean, 38, 12, 18, 22, 12]), true), 5 * s);
  if (arm === 'up') k.stroke(o.sleeve || coat, k.poly(pts([6 + lean, 38, 18 + lean, 44, 26 + lean, 52]), true), 5 * s);
  if (arm === 'table') k.stroke(o.sleeve || coat, k.poly(pts([6 + lean, 38, 16 + lean, 26, 30 + lean, 24]), true), 5 * s);
  if (arm === 'head') { k.stroke(o.sleeve || coat, k.poly(pts([-6 + lean, 38, -4 + lean, 20, 2 + lean, 46]), true), 5 * s); }
  k.fill(skin, k.ell(X(0.8 + lean), Y(51), 6.4 * s, 7.6 * s));
  if (o.hair) k.fill(o.hair, k.poly(pts([-6.8 + lean, 51, -5 + lean, 58.5, 1 + lean, 60, 6 + lean, 57, 7.2 + lean, 51, 3 + lean, 55, -3 + lean, 54])));
}

/* Waves as rows of short swells between y0 and y1, bigger towards the viewer.
   With cut: true they are knocked out to paper (foam, light on the water). */
export function waves(k, o) {
  const x0 = o.x0 || 0, x1 = o.x1 == null ? k.W : o.x1;
  const rows = o.rows || 16;
  for (let r = 0; r < rows; r++) {
    const t = r / Math.max(1, rows - 1);
    const y = o.y0 + (o.y1 - o.y0) * Math.pow(t, o.pow || 1.7);
    const len = (o.len || 60) * (0.35 + t * 1.3);
    const amp = (o.amp || 4) * (0.3 + t);
    const p = k.P();
    let x = x0 - k.rnd() * len;
    while (x < x1) {
      const l = len * (0.5 + k.rnd());
      if (k.rnd() < (o.dens || 0.6)) {
        const yy = y + (k.rnd() - 0.5) * amp;
        p.moveTo(x, yy);
        p.quadraticCurveTo(x + l * 0.25, yy - amp, x + l * 0.5, yy);
        p.quadraticCurveTo(x + l * 0.75, yy + amp * 0.5, x + l, yy - amp * 0.2);
      }
      x += l * (1 + k.rnd() * (o.gap || 0.8));
    }
    const lw = (o.lw || 2) * (0.4 + t * 1.1);
    if (o.cut) k.cut(p, o.amount == null ? 1 : o.amount, lw);
    else k.addStroke(o.spec, p, lw);
  }
}

/* A dense row of small people seen from afar: heads and shoulders. */
export function crowd(k, x0, x1, y, h, cols, o) {
  o = o || {};
  let x = x0;
  while (x < x1) {
    const hh = h * (0.82 + k.rnd() * 0.3);
    const col = k.pick(cols);
    const yy = y + (k.rnd() - 0.5) * (o.jit || 2);
    k.fill(col, k.poly([x - hh * 0.17, yy, x - hh * 0.14, yy - hh * 0.62, x + hh * 0.14, yy - hh * 0.62, x + hh * 0.17, yy]));
    k.fill(o.skin || C.skin, k.circ(x, yy - hh * 0.76, hh * 0.13));
    const hr = k.rnd();
    if (hr < 0.3) k.fill(C.ink, k.rect(x - hh * 0.11, yy - hh * 1.02, hh * 0.22, hh * 0.18));
    else if (hr < 0.5) k.fill(k.pick([C.red, C.cream, C.blue]), k.ell(x, yy - hh * 0.86, hh * 0.15, hh * 0.07));
    else if (hr < 0.62 && o.arms !== false) k.stroke(col, k.poly([x + hh * 0.12, yy - hh * 0.55, x + hh * 0.26, yy - hh * 0.95], true), hh * 0.08);
    x += hh * (o.step || 0.3) * (0.7 + k.rnd() * 0.6);
  }
}

export function stars(k, n, x0, y0, x1, y1, r) {
  for (let i = 0; i < n; i++) {
    const x = k.R(x0, x1), y = k.R(y0, y1), rr = (r || 1.6) * (0.5 + k.rnd() * k.rnd() * 1.6);
    k.cut(k.circ(x, y, rr), 0.95);
  }
}

export function sparkle(k, x, y, r, amount) {
  const p = k.P();
  p.moveTo(x, y - r); p.quadraticCurveTo(x, y, x + r, y); p.quadraticCurveTo(x, y, x, y + r);
  p.quadraticCurveTo(x, y, x - r, y); p.quadraticCurveTo(x, y, x, y - r); p.closePath();
  k.cut(p, amount == null ? 1 : amount);
}

/* Courses of stone blocks inside a rectangle, each block a slightly
   different density, mortar lines lighter. */
export function stonework(k, x, y, w, h, bh, base, o) {
  o = o || {};
  for (let yy = y, row = 0; yy < y + h; yy += bh, row++) {
    let xx = x - (row % 2 ? bh * 0.8 : 0) - k.rnd() * bh * 0.3;
    while (xx < x + w) {
      const bw = bh * (1.3 + k.rnd() * 1.4);
      const f = 0.75 + k.rnd() * 0.5;
      const spec = {};
      for (const key in base) spec[key] = base[key] * f;
      k.add(spec, k.rect(Math.max(x, xx + 1.2), yy + 1.2, Math.min(bw - 2.4, x + w - xx - 2.4), Math.min(bh - 2.4, y + h - yy - 2.4)));
      xx += bw;
    }
  }
  if (o.mortar !== false) {
    const p = k.P();
    for (let yy = y; yy < y + h; yy += bh) { p.moveTo(x, yy); p.lineTo(x + w, yy); }
    k.cut(p, o.mortar || 0.35, 1.4);
  }
}

/* A cloud or smoke band made of overlapping ellipses. */
export function cloud(k, spec, x, y, w, h, n) {
  const p = k.P();
  for (let i = 0; i < (n || 9); i++) {
    const cx = x + k.rnd() * w, cy = y + (k.rnd() - 0.3) * h * 0.6;
    p.ellipse(cx, cy, w * (0.12 + k.rnd() * 0.12), h * (0.35 + k.rnd() * 0.4), 0, 0, Math.PI * 2);
  }
  k.add(spec, p);
}

/* Gulls: a small bent stroke. */
export function gull(k, x, y, s, spec) {
  const p = k.P();
  p.moveTo(x - s, y - s * 0.1); p.quadraticCurveTo(x - s * 0.5, y - s * 0.55, x, y); p.quadraticCurveTo(x + s * 0.5, y - s * 0.55, x + s, y - s * 0.1);
  k.stroke(spec || C.navy, p, Math.max(1.2, s * 0.16));
}
