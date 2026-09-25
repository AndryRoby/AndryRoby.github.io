/* Sky, sea and the ships of the book: the three-master Pharaon, the Genoese
 * tartan with its lateen sail, rowing boats and the count's yacht.
 * Everything takes the kit `k` from ink.js and ink mixes from parts.js. */
import { C, waves } from './parts.js';

/* A sky as a vertical ramp of ink densities. stops: [[t, spec], ...] where
   spec is { y, r, b } numbers; t runs 0 (top) to 1 (y1). */
export function sky(k, y0, y1, stops, x0, x1) {
  x0 = x0 || 0; x1 = x1 == null ? k.W : x1;
  const spec = {};
  for (const key of ['y', 'r', 'b']) {
    if (!stops.some(([, s]) => s[key])) continue;
    spec[key] = k.lin(0, y0, 0, y1, ...stops.map(([t, s]) => [t, s[key] || 0]));
  }
  k.fill(spec, k.rect(x0, y0, x1 - x0, y1 - y0));
}

/* A sun or moon disc with a soft halo knocked out of the sky or laid on it. */
export function disc(k, x, y, r, spec, halo) {
  if (halo) k.cut(k.circ(x, y, r * halo), k.rad(x, y, r, r * halo, [0, 0.55], [1, 0]));
  k.fill(spec, k.circ(x, y, r));
}

/* Flat sea from y0 to y1 with a gradient and rows of swell. */
export function sea(k, y0, y1, o) {
  o = o || {};
  const top = o.top || { b: 0.45 }, bot = o.bottom || { b: 0.8, r: 0.25 };
  const spec = {};
  for (const key of ['y', 'r', 'b']) {
    if (!(top[key] || bot[key])) continue;
    spec[key] = k.lin(0, y0, 0, y1, [0, top[key] || 0], [1, bot[key] || 0]);
  }
  k.fill(spec, k.rect(o.x0 || 0, y0, (o.x1 == null ? k.W : o.x1) - (o.x0 || 0), y1 - y0));
  if (o.swell !== false) waves(k, { y0: y0 + 4, y1, rows: o.rows || 18, len: o.len || 70, amp: o.amp || 3, lw: o.lw || 2.2, spec: o.swellSpec || { b: 0.35 }, dens: o.dens || 0.55, x0: o.x0, x1: o.x1 });
  if (o.glints) waves(k, { y0: y0 + 2, y1, rows: o.glints, len: 40, amp: 2, lw: 1.6, cut: true, amount: 0.7, dens: 0.25, x0: o.x0, x1: o.x1 });
}

/* A path of light on water under a sun or moon at x: short cut strokes. */
export function lightPath(k, x, y0, y1, width, amount) {
  for (let y = y0; y < y1; y += k.R(5, 11)) {
    const t = (y - y0) / (y1 - y0);
    const hw = width * (0.25 + t * 0.9);
    const n = 1 + Math.floor(k.rnd() * 3);
    for (let i = 0; i < n; i++) {
      const cx = x + k.R(-hw, hw), l = k.R(8, 26) * (0.4 + t);
      const p = k.P(); p.moveTo(cx - l / 2, y); p.lineTo(cx + l / 2, y);
      k.cut(p, amount == null ? 0.9 : amount, 1.2 + t * 2.4);
    }
  }
}

/* A three-masted ship seen from the side, bow to the right (dir 1) or left.
   (x, y) is the waterline at mid hull, L the hull length.
   o.sails: 'topsails' (as the Pharaon came in: topsails, jib and spanker),
   'full', or 'furled'. o.hull, o.sail colours; o.name writes on the stern. */
export function ship(k, x, y, L, o) {
  o = o || {};
  const d = o.dir || 1, s = L / 100;
  const X = (dx) => x + dx * s * d, Y = (dy) => y - dy * s;
  const pts = (arr) => { const out = []; for (let i = 0; i < arr.length; i += 2) out.push(X(arr[i]), Y(arr[i + 1])); return out; };
  const hull = o.hull || C.dark, sail = o.sail || C.cream, rig = o.rig || C.dark;
  /* hull with a sheer line and a raised stern */
  k.fill(hull, k.blob(pts([-50, 11, -46, 1, -30, -4, 20, -4, 40, 0, 52, 9, 56, 12, 20, 8, -20, 8, -48, 12]), false));
  k.fill(hull, k.poly(pts([-50, 11, -48, 17, -38, 17, -36, 9])));
  /* a painted band with gun ports along the hull */
  k.fill(o.band || C.cream, k.poly(pts([-47, 6, 48, 6, 50, 3.6, -46, 3.4])));
  for (let i = -40; i < 44; i += 7) k.fill(hull, k.rect(X(i) - 1.3 * s, Y(5.6), 2.6 * s, 1.8 * s));
  /* bowsprit */
  k.stroke(rig, k.poly(pts([46, 10, 74, 22]), true), 1.4 * s);
  const masts = [[-24, 62], [4, 78], [30, 66]];
  for (const [mx, mh] of masts) k.stroke(rig, k.poly(pts([mx, 8, mx, mh]), true), 1.5 * s);
  /* stays and shrouds as hairlines */
  const stays = k.P();
  const S = (a, b) => { const p = pts([...a, ...b]); stays.moveTo(p[0], p[1]); stays.lineTo(p[2], p[3]); };
  S([4, 78], [30, 66]); S([30, 66], [72, 21]); S([-24, 62], [4, 78]); S([-24, 62], [-50, 16]);
  for (const [mx, mh] of masts) { S([mx, mh * 0.8], [mx - 7, 9]); S([mx, mh * 0.8], [mx + 7, 9]); }
  k.stroke(rig, stays, 0.45 * s);
  const mode = o.sails || 'full';
  const sq = (mx, yb, yt, wb, wt, bulge) => {
    const p = k.P();
    const a = pts([mx - wt, yt, mx + wt, yt, mx + wb, yb, mx - wb, yb]);
    p.moveTo(a[0], a[1]); p.lineTo(a[2], a[3]);
    p.quadraticCurveTo(X(mx + wb + bulge), Y((yt + yb) / 2), a[4], a[5]);
    p.quadraticCurveTo(X(mx), Y(yb - bulge * 0.6), a[6], a[7]);
    p.quadraticCurveTo(X(mx - wb + bulge * 0.4), Y((yt + yb) / 2), a[0], a[1]);
    k.fill(sail, p);
    /* shade on the leeward half, seams */
    k.add(o.shade || { b: 0.16, r: 0.05 }, k.poly(pts([mx, yt, mx + wt, yt, mx + wb, yb, mx, yb])));
    const seam = k.P();
    for (let t = 1; t < 4; t++) { seam.moveTo(X(mx - wt + (2 * wt) * t / 4), Y(yt)); seam.lineTo(X(mx - wb + (2 * wb) * t / 4), Y(yb)); }
    k.addStroke({ b: 0.18 }, seam, 0.35 * s);
    k.stroke(rig, k.poly(pts([mx - wt - 2, yt, mx + wt + 2, yt]), true), 0.9 * s);
  };
  if (mode === 'full' || mode === 'topsails') {
    for (const [mx, mh] of masts) {
      const w = mh / 5.2;
      if (mode === 'full') sq(mx, 18, 36, w * 1.15, w * 1.0, 3);
      sq(mx, 37, mh * 0.72, w * 0.98, w * 0.8, 2.4);
      sq(mx, mh * 0.73, mh * 0.93, w * 0.74, w * 0.56, 1.6);
    }
    /* jib and spanker */
    k.fill(sail, k.poly(pts([33, 60, 70, 22, 48, 16])));
    k.add({ b: 0.14 }, k.poly(pts([33, 60, 50, 40, 48, 16])));
    k.fill(sail, k.poly(pts([-25, 50, -25, 14, -50, 14, -44, 44])));
    k.add({ b: 0.12 }, k.poly(pts([-25, 50, -25, 14, -36, 14])));
  } else {
    for (const [mx, mh] of masts) {
      for (const f of [0.45, 0.72, 0.9]) k.stroke(sail, k.poly(pts([mx - mh / 6, mh * f, mx + mh / 6, mh * f]), true), 2.4 * s);
    }
  }
  /* pennant */
  if (o.flag) {
    const [mx, mh] = masts[1];
    k.fill(o.flag, k.poly(pts([mx, mh, mx - 14, mh - 1.5, mx, mh - 3.2])));
  }
  if (o.name) {
    /* the name printed in white letters on the stern */
    k.fill(hull, k.poly(pts([-51, 20, -36, 18, -36, 6, -50, 6])));
    k.text({}, o.name, X(-43.5), Y(o.nameY || 9.5), 'italic 700 ' + (o.nameSize || 3.4) * s + 'px Georgia, serif', 'center', true);
  }
  return { X, Y };
}

/* A Genoese tartan: one mast with a great lateen sail, a jib, low hull. */
export function tartan(k, x, y, L, o) {
  o = o || {};
  const d = o.dir || 1, s = L / 100;
  const X = (dx) => x + dx * s * d, Y = (dy) => y - dy * s;
  const pts = (arr) => { const out = []; for (let i = 0; i < arr.length; i += 2) out.push(X(arr[i]), Y(arr[i + 1])); return out; };
  const hull = o.hull || C.dark, sail = o.sail || C.cream;
  k.fill(hull, k.blob(pts([-48, 8, -40, -3, 0, -6, 38, -2, 54, 12, 20, 7, -20, 7]), false));
  k.fill(o.band || C.red, k.poly(pts([-44, 5, 46, 5, 49, 2.6, -42, 2.6])));
  k.stroke(hull, k.poly(pts([6, 6, 4, 70]), true), 1.4 * s);
  k.stroke(hull, k.poly(pts([44, 10, 70, 18]), true), 1.1 * s);
  /* the lateen yard and the sail hung from it, bellied by the wind */
  const p = k.P();
  const a = pts([-44, 12, 30, 104, 10, 10]);
  p.moveTo(a[0], a[1]);
  p.quadraticCurveTo(X(-10), Y(62), a[2], a[3]);
  p.quadraticCurveTo(X(34), Y(50), a[4], a[5]);
  p.quadraticCurveTo(X(-16), Y(6), a[0], a[1]);
  k.fill(sail, p);
  k.add(o.shade || { b: 0.16 }, k.poly(pts([30, 104, 10, 10, 2, 40])));
  k.stroke(hull, k.poly(pts([-46, 10, 32, 106]), true), 1.2 * s);
  k.fill(sail, k.poly(pts([12, 58, 68, 17, 42, 12])));
  if (o.flag) k.fill(o.flag, k.poly(pts([31, 106, 24, 110, 32, 112])));
}

/* A rowing boat with n people in it; (x, y) waterline centre. */
export function boat(k, x, y, L, o) {
  o = o || {};
  const s = L / 100, d = o.dir || 1;
  const X = (dx) => x + dx * s * d, Y = (dy) => y - dy * s;
  const pts = (arr) => { const out = []; for (let i = 0; i < arr.length; i += 2) out.push(X(arr[i]), Y(arr[i + 1])); return out; };
  const hull = o.hull || C.dark;
  k.fill(hull, k.blob(pts([-50, 14, -40, -2, 0, -6, 40, -2, 52, 16, 0, 10]), false));
  k.fill(o.band || C.stone, k.poly(pts([-46, 11, 48, 12, 49, 9, -45, 8.4])));
  return { X, Y, s };
}

/* A seated rower or passenger as a compact silhouette (for boats). */
export function sitter(k, x, y, h, coat, o) {
  o = o || {};
  const s = h / 100;
  k.fill(coat, k.blob([x - 16 * s, y, x - 13 * s, y - 55 * s, x, y - 68 * s, x + 13 * s, y - 55 * s, x + 16 * s, y]));
  k.fill(o.skin || C.skin, k.circ(x, y - 80 * s, 12 * s));
  if (o.hat === 'bicorne') k.fill(o.hatC || C.ink, k.poly([x - 22 * s, y - 86 * s, x + 22 * s, y - 86 * s, x + 10 * s, y - 96 * s, x, y - 104 * s, x - 10 * s, y - 96 * s]));
  if (o.hat === 'round') { k.fill(o.hatC || C.ink, k.rect(x - 17 * s, y - 90 * s, 34 * s, 4 * s)); k.fill(o.hatC || C.ink, k.ell(x, y - 92 * s, 11 * s, 8 * s)); }
  if (o.hat === 'cap') k.fill(o.hatC || C.red, k.ell(x, y - 90 * s, 12 * s, 6 * s));
  if (o.oar) k.stroke(C.wood, k.poly([x + 6 * s, y - 40 * s, x + o.oar * s, y + 38 * s], true), 3.2 * s);
}
