/* Scenes from volume five (chapters 96 to 117): the reckoning in Paris,
 * the way back to Marseilles, If and Rome, and the island at the end.
 * Same contract as v1.js: { w, h, seed, draw(k) }, pano 1400x700,
 * wide 1200x800, tall 1000x1250. Line numbers of every fact are in README.md.
 * Values: poison, prison, the court and the pardon are shown by a sign
 * (a glass held to a lamp, a patch of new stones, a head of white hair). */
import { C, person, seated, crowd, cloud, gull, waves, stars, sparkle, stonework } from '../parts.js';
import { sky, disc, sea, lightPath, ship, boat, sitter } from '../sea.js';
import { rock, chateauIf, candle } from '../arch.js';
import { PALE, lady, parquet, drape, frame, books } from '../salon.js';
import { horse, carriage } from './ride.js';

const scale = (base, f) => { const s = {}; for (const key in base) s[key] = base[key] * f; return s; };

/* A figure's frame: units of 1/100 of its height, x towards where it faces. */
function F(x, y, h, d) {
  const s = h / 100;
  d = d || 1;
  const X = (dx) => x + dx * s * d, Y = (dy) => y - dy * s;
  const pts = (a) => { const o = []; for (let i = 0; i < a.length; i += 2) o.push(X(a[i]), Y(a[i + 1])); return o; };
  return { s, X, Y, pts };
}

/* An arm with an outline, so a sleeve reads even against a coat of the same colour. */
function arm(k, f, spec, a, hand, o) {
  o = o || {};
  const p = k.poly(f.pts(a), true);
  if (o.edge !== false) k.stroke(o.edge || C.ink, p, (o.w || 5.2) * 1.3 * f.s);
  k.stroke(spec, p, (o.w || 5.2) * f.s);
  if (o.cuff) k.fill(o.cuff, k.circ(f.X(a[a.length - 2]), f.Y(a[a.length - 1]), 2.6 * f.s));
  if (hand) k.fill(o.skin || C.skin, k.circ(f.X(hand[0]), f.Y(hand[1]), (o.hr || 2.8) * f.s));
}

/* ── Chapter 97: Eugénie cuts her hair ────────────────────────────────── */
const eugenie = {
  w: 1000, h: 1250, seed: 52086,
  draw(k) {
    k.fill({ b: 0.8, r: 0.66, y: 0.36 }, k.rect(0, 0, 1000, 1250));
    const st = k.P(); for (let x = 14; x < 1000; x += 46) { st.moveTo(x, 0); st.lineTo(x, 870); }
    k.addStroke({ b: 0.14, r: 0.08 }, st, 7);
    k.fill({ y: 0.5, r: 0.46, b: 0.42 }, k.rect(0, 856, 1000, 30));
    parquet(k, 0, 886, 1000, 1250, 520, { y: 0.5, r: 0.44, b: 0.36 }, { boards: 16 });
    /* the candles on the chest of drawers light the room from the left */
    const lx = 200, ly = 560;
    k.cut(k.circ(lx, ly, 780), k.rad(lx, ly, 0, 780, [0, 0.95], [0.3, 0.62], [0.75, 0.16], [1, 0]));
    k.add({ y: k.rad(lx, ly, 0, 780, [0, 0.9], [0.5, 0.42], [1, 0.04]), r: k.rad(lx, ly, 0, 780, [0, 0.16], [1, 0]) }, k.circ(lx, ly, 780));
    /* a gilt frame on the wall (ours) with a sheet of music-paper in it */
    frame(k, 600, 170, 250, 320, 16, { gold: { y: 0.6, r: 0.36, b: 0.26 } });
    k.fill({ y: 0.14, b: 0.08 }, k.rect(616, 186, 218, 288));
    const staff = k.P(); for (let r = 0; r < 6; r++) for (let l = 0; l < 5; l++) { const y = 220 + r * 42 + l * 5; staff.moveTo(636, y); staff.lineTo(814, y); }
    k.addStroke({ b: 0.36, r: 0.2 }, staff, 1.2);
    for (let i = 0; i < 40; i++) { const r = Math.floor(k.rnd() * 6); k.fill({ b: 0.7, r: 0.4 }, k.ell(k.R(646, 806), 220 + r * 42 + k.R(0, 20), 3.4, 2.6, -0.4)); }
    /* the chest of drawers, the drawer she kept the man's costume in pulled out */
    const wood = { y: 0.62, r: 0.56, b: 0.42 };
    k.fill(wood, k.rect(40, 650, 290, 236));
    k.fill({ y: 0.66, r: 0.6, b: 0.48 }, k.rect(28, 636, 314, 18));
    k.add({ b: 0.2 }, k.rect(262, 654, 68, 232));
    for (const y of [676, 746]) { k.addStroke({ b: 0.3, r: 0.2 }, k.rect(60, y, 250, 56), 3); k.fill(C.gold, k.circ(185, y + 28, 5)); }
    k.fill({ y: 0.66, r: 0.6, b: 0.5 }, k.poly([56, 812, 314, 812, 350, 862, 20, 862]));
    k.fill({ y: 0.5, r: 0.5, b: 0.46 }, k.rect(20, 862, 330, 16));
    k.fill(C.cream, k.blob([54, 820, 120, 800, 200, 810, 290, 798, 320, 822, 210, 832, 110, 830]));
    k.cut(k.blob([90, 816, 150, 806, 220, 812, 262, 804, 280, 816, 180, 822]), 0.7);
    k.fill(C.gold, k.ell(190, 636, 64, 7));
    candle(k, 146, 632, 62, { glow: 0 }); candle(k, 190, 628, 78, { glow: 0 }); candle(k, 234, 632, 62, { glow: 0 });
    /* the portmanteau, shut and padlocked, and on it a man's hat */
    const leather = { y: 0.6, r: 0.64, b: 0.52 };
    k.add({ b: 0.34, r: 0.12 }, k.ell(205, 1190, 160, 14));
    const pm = k.blob([72, 1184, 66, 1090, 96, 1048, 314, 1048, 342, 1090, 336, 1184]);
    k.fill(leather, pm);
    k.clip(pm, () => { k.add({ b: 0.22 }, k.rect(262, 1040, 90, 150)); k.cut(k.rect(80, 1060, 180, 8), 0.3); });
    k.addStroke({ b: 0.5, r: 0.3 }, k.poly([70, 1096, 340, 1096], true), 3);
    for (const x of [132, 262]) { k.fill(C.ink, k.rect(x, 1046, 16, 140)); k.fill(C.gold, k.rect(x - 3, 1100, 22, 14)); }
    k.fill(C.gold, k.rect(196, 1092, 20, 22)); k.stroke(C.gold, k.poly([199, 1092, 199, 1080, 213, 1080, 213, 1092], true), 3);
    k.fill(C.ink, k.ell(206, 1048, 70, 10));
    k.fill(C.ink, k.poly([168, 1046, 244, 1046, 238, 968, 174, 968]));
    k.cut(k.rect(180, 978, 6, 58), 0.35);
    k.fill({ b: 0.5, r: 0.3 }, k.rect(170, 1030, 72, 8));
    /* Louise d'Armilly in the violet travelling cloak Eugénie gave her */
    const L = lady(k, 800, 1178, 640, { dir: -1, dress: { r: 0.72, b: 0.62, y: 0.08 }, sleeve: { r: 0.72, b: 0.62, y: 0.08 }, shade: { b: 0.26 }, hair: { y: 0.66, r: 0.32, b: 0.08 }, arms: 'clasp' });
    const lf = F(800, 1178, 640, -1);
    k.fill({ r: 0.64, b: 0.56, y: 0.06 }, k.blob(lf.pts([-8, 80, 8, 80, 14, 66, 17, 30, 8, 34, 0, 60, -8, 34, -17, 30, -14, 66])));
    k.addStroke({ b: 0.3 }, k.poly(lf.pts([6, 76, 12, 36]), true), 1.2 * lf.s);
    for (const [hx, hy] of L.hands) k.fill(C.skin, k.circ(hx, hy, 2.4 * lf.s));
    /* Eugénie, in the man's costume, leaning back to keep the hair from her coat */
    const coat = { b: 0.95, r: 0.52, y: 0.1 };
    const E = F(450, 1180, 770, 1);
    const lean = -2.5;
    person(k, 450, 1180, 770, { dir: 1, lean, coat, legs: { b: 0.4, r: 0.26, y: 0.3 }, boots: C.ink, arms: 'none', hair: C.ink, skin: { y: 0.3, r: 0.24 } });
    k.fill({ r: 0.86, y: 0.5 }, k.poly(E.pts([-4.2 + lean, 82, 4.2 + lean, 82, 3.4 + lean, 55, -3.4 + lean, 55])));
    for (let yy = 78; yy > 57; yy -= 4.5) k.fill(C.gold, k.circ(E.X(lean), E.Y(yy), 0.7 * E.s));
    k.fill(C.cream, k.poly(E.pts([-3 + lean, 85, 3.4 + lean, 85, 0.4 + lean, 79.5])));
    k.addStroke({ b: 0.4 }, k.poly(E.pts([-10 + lean, 82, -4.2 + lean, 60, -4 + lean, 44]), true), 0.8 * E.s);
    /* the thick mass of black hair, held out in her left hand */
    const hair = { b: 1, r: 0.8, y: 0.32 };
    k.fill(hair, k.blob(E.pts([-4 + lean, 98.6, -8.4 + lean, 94, -12, 90.2, -19, 91.4, -24.5, 94.2, -21, 96.6, -13, 96.4, -7 + lean, 99.6])));
    k.fill(hair, k.blob(E.pts([-22.5, 92.5, -27, 91.5, -29.5, 80, -28, 66, -26, 72, -25.5, 84])));
    const strand = k.P(); for (const o of [-1, 0, 1]) { const a = E.pts([-26 + o, 90, -28.5 + o, 78, -27 + o * 1.5, 64]); strand.moveTo(a[0], a[1]); strand.quadraticCurveTo(a[2], a[3], a[4], a[5]); }
    k.cut(strand, 0.3, 0.5 * E.s);
    arm(k, E, coat, [-8.5 + lean, 79, -17, 84, -23, 91.5], [-23.4, 92.4], { skin: { y: 0.3, r: 0.24 }, cuff: C.cream });
    /* the long scissors in her right hand, the steel meeting through the hair */
    arm(k, E, coat, [8.5 + lean, 79, 6, 63, -9, 87], [-9.6, 88], { skin: { y: 0.3, r: 0.24 }, cuff: C.cream });
    const steel = { b: 0.4, r: 0.14, y: 0.06 };
    k.stroke(steel, k.poly(E.pts([-10.5, 89.5, -15.8, 96.2]), true), 0.9 * E.s);
    k.stroke(steel, k.poly(E.pts([-10.5, 89.5, -17.2, 94]), true), 0.9 * E.s);
    k.cut(k.poly(E.pts([-11.2, 90.4, -15, 95.2]), true), 0.8, 0.3 * E.s);
    k.stroke(steel, k.circ(E.X(-8.6), E.Y(86.6), 1.2 * E.s), 0.5 * E.s);
    k.stroke(steel, k.circ(E.X(-9.8), E.Y(85.4), 1.2 * E.s), 0.5 * E.s);
    /* her eyes sparkling under ebony eyebrows */
    k.stroke(C.ink, k.poly(E.pts([1.4 + lean, 94.2, 4.6 + lean, 94.6]), true), 0.6 * E.s);
    k.fill(C.ink, k.ell(E.X(3.2 + lean), E.Y(92.2), 0.7 * E.s, 0.55 * E.s));
    k.cut(k.circ(E.X(3.4 + lean), E.Y(92.4), 0.22 * E.s), 1);
    /* the hair already cut, fallen in a cluster at her feet */
    const curls = k.P();
    for (let i = 0; i < 26; i++) { const cx = E.X(k.R(-22, -4)), cy = E.Y(k.R(0.4, 3.4)), r = k.R(0.8, 2.2) * E.s; curls.moveTo(cx + r, cy); curls.ellipse(cx, cy, r, r * 0.55, k.R(-0.5, 0.5), 0, Math.PI * 2); }
    k.fill(hair, curls);
    const loose = k.P(); for (let i = 0; i < 9; i++) { const x0 = E.X(k.R(-24, -6)), y0 = E.Y(k.R(1, 4)); loose.moveTo(x0, y0); loose.quadraticCurveTo(x0 + k.R(-30, 30), y0 - k.R(8, 22), x0 + k.R(-40, 40), y0 - k.R(4, 14)); }
    k.stroke(hair, loose, 3);
    const fall = k.P(); for (const [a, b] of [[-19, 60], [-16, 42], [-21, 30]]) { const p = E.pts([a, b, a - 1.5, b - 4, a + 0.5, b - 8]); fall.moveTo(p[0], p[1]); fall.quadraticCurveTo(p[2], p[3], p[4], p[5]); }
    k.stroke(hair, fall, 3.2);
    k.add({ b: k.lin(560, 0, 1000, 0, [0, 0], [1, 0.34]), r: k.lin(560, 0, 1000, 0, [0, 0], [1, 0.16]) }, k.rect(560, 0, 440, 880));
  },
};

/* ── Chapter 98: on the roof of the Bell and Bottle, Compiègne ─────────── */
function crouch(k, x, y, h, o) {
  const f = F(x, y, h, o.dir || 1);
  k.fill(o.legs, k.poly(f.pts([-14, 0, 12, 0, 16, 14, 2, 30, -12, 22])));
  k.fill(o.coat, k.blob(f.pts([-16, 16, -14, 52, -4, 60, 10, 54, 12, 30, 4, 18])));
  arm(k, f, o.coat, [6, 52, 16, 38, 22, 20], [22.5, 18.5], { edge: C.ink });
  k.fill(o.skin || C.skin, k.ell(f.X(4), f.Y(66), 6 * f.s, 7 * f.s));
  k.fill(o.hair, k.blob(f.pts([-2, 64, -1.5, 72, 5, 74, 10.5, 70, 9, 67, 4, 69, 1, 66])));
  if (o.beard) k.fill(o.beard, k.poly(f.pts([4, 63, 10, 63, 8, 58, 5, 58])));
  k.fill(C.ink, k.circ(f.X(8.4), f.Y(67), 0.7 * f.s));
}

const roofs = {
  w: 1200, h: 800, seed: 52402,
  draw(k) {
    sky(k, 0, 800, [[0, { b: 0.44 }], [0.5, { b: 0.16, y: 0.12 }], [1, { y: 0.34, r: 0.12 }]]);
    cloud(k, { b: 0.1 }, 60, 110, 420, 24, 8);
    /* the Hôtel de Ville, a massive sixteenth century building, on the right */
    const stoneH = { y: 0.36, r: 0.14, b: 0.12 };
    const slate = { b: 0.66, r: 0.34, y: 0.16 };
    k.fill(slate, k.poly([742, 364, 1222, 364, 1184, 252, 788, 252]));
    k.add({ b: 0.2 }, k.poly([1000, 252, 1184, 252, 1222, 364, 1000, 364]));
    for (const x of [826, 1136]) { k.fill(stoneH, k.rect(x - 18, 290, 36, 50)); k.fill(stoneH, k.poly([x - 24, 292, x + 24, 292, x, 262])); k.fill(C.dark, k.rect(x - 8, 302, 16, 30)); }
    k.fill(stoneH, k.rect(760, 360, 450, 440));
    k.add({ b: 0.18 }, k.rect(1060, 360, 150, 440));
    const winH = (x, y, w, h) => { k.fill({ b: 0.7, r: 0.3 }, k.poly([x, y + h, x, y + w * 0.5, x + w / 2, y, x + w, y + w * 0.5, x + w, y + h])); k.stroke(C.cream, k.poly([x + w / 2, y + 6, x + w / 2, y + h], true), 3); k.stroke(C.cream, k.poly([x, y + h * 0.55, x + w, y + h * 0.55], true), 3); };
    for (const x of [790, 860, 1070, 1140]) { winH(x, 420, 40, 96); winH(x, 590, 40, 96); }
    k.fill({ y: 0.4, r: 0.2, b: 0.16 }, k.rect(756, 546, 458, 14));
    /* the belfry: square tower, openings, octagonal lantern, spire */
    k.fill(stoneH, k.rect(930, 120, 104, 300));
    k.add({ b: 0.2 }, k.rect(990, 120, 44, 300));
    k.fill({ y: 0.4, r: 0.2, b: 0.16 }, k.rect(922, 112, 120, 14));
    for (const x of [944, 990]) { const p = k.P(); p.moveTo(x, 236); p.lineTo(x, 180); p.arc(x + 15, 180, 15, Math.PI, 0); p.lineTo(x + 30, 236); p.closePath(); k.fill(C.dark, p); }
    /* a gendarme's head at one of the openings, motionless as a stone decoration */
    k.fill(C.skin, k.ell(959, 214, 9, 11));
    k.fill(C.ink, k.poly([944, 206, 974, 206, 968, 198, 959, 190, 950, 198]));
    k.fill(C.dark, k.rect(946, 222, 26, 14));
    k.fill(slate, k.poly([944, 112, 1020, 112, 1014, 70, 950, 70]));
    for (const x of [960, 982, 1004]) k.fill(C.dark, k.rect(x - 4, 80, 8, 24));
    k.fill(slate, k.poly([946, 72, 1018, 72, 982, 4]));
    k.add({ b: 0.22 }, k.poly([982, 4, 1018, 72, 982, 72]));
    k.fill(C.gold, k.circ(982, 6, 5));
    /* the smoke of the fire the gendarmes lit, rising like the vapour from a volcano */
    const smoke = { b: 0.56, r: 0.36, y: 0.24 };
    const puffs = [[470, 330, 38], [458, 282, 50], [436, 228, 66], [404, 168, 84], [352, 104, 104], [270, 48, 124], [170, 12, 130], [540, 260, 36], [506, 200, 48]];
    for (const [x, y, r] of puffs) k.fill(scale(smoke, k.R(0.8, 1.05)), k.blob([x - r, y, x - r * 0.7, y - r * 0.7, x, y - r, x + r * 0.8, y - r * 0.6, x + r, y + r * 0.1, x + r * 0.5, y + r * 0.7, x - r * 0.6, y + r * 0.6]));
    for (const [x, y, r] of puffs) k.add({ b: 0.2, r: 0.1 }, k.ell(x + r * 0.3, y + r * 0.3, r * 0.6, r * 0.4));
    for (const [x, y, r] of puffs.slice(0, 6)) k.cut(k.ell(x - r * 0.35, y - r * 0.4, r * 0.35, r * 0.2), 0.3);
    /* the roofs of the inn */
    const tile = { y: 0.62, r: 0.66, b: 0.34 };
    const back = k.poly([-10, 470, -10, 360, 380, 350, 420, 470]);
    k.fill(scale(tile, 0.85), back);
    k.add({ b: 0.3 }, back);
    const front = k.poly([-10, 660, -10, 432, 700, 404, 752, 640]);
    k.fill(tile, front);
    k.clip(front, () => {
      const t = k.P();
      for (let r = 0, y = 420; y < 670; r++, y += 16) for (let x = -20 + (r % 2) * 13; x < 760; x += 26) { t.moveTo(x, y + (752 - x) * 0.0 + 2); t.quadraticCurveTo(x + 13, y + 14, x + 26, y + 2); }
      k.addStroke({ b: 0.32, r: 0.2 }, t, 2);
      k.add({ b: k.lin(0, 404, 0, 660, [0, 0], [1, 0.3]) }, k.rect(-10, 400, 770, 270));
    });
    k.fill({ y: 0.5, r: 0.56, b: 0.5 }, k.poly([-10, 432, 700, 404, 704, 414, -10, 444]));
    /* chimneys and their pots; the second one smokes */
    const brick = { y: 0.54, r: 0.6, b: 0.4 };
    const chim = (x, yb, w, h, pots) => {
      k.fill(brick, k.rect(x - w / 2, yb - h, w, h + 14));
      k.add({ b: 0.26 }, k.rect(x + w * 0.1, yb - h, w * 0.4, h + 14));
      const m = k.P(); for (let y = yb - h + 12; y < yb + 10; y += 12) { m.moveTo(x - w / 2, y); m.lineTo(x + w / 2, y); } k.cut(m, 0.3, 1.2);
      k.fill({ y: 0.5, r: 0.5, b: 0.44 }, k.rect(x - w / 2 - 5, yb - h - 8, w + 10, 10));
      for (let i = 0; i < pots; i++) { const px = x - w / 2 + (i + 0.5) * (w / pots); k.fill({ y: 0.66, r: 0.66, b: 0.24 }, k.poly([px - 7, yb - h - 8, px + 7, yb - h - 8, px + 5.5, yb - h - 34, px - 5.5, yb - h - 34])); k.fill(C.dark, k.ell(px, yb - h - 34, 5.5, 2)); }
    };
    chim(150, 354, 56, 70, 2); chim(470, 416, 64, 60, 2); chim(636, 408, 70, 64, 3);
    /* Andrea crouching down against the chimney-pots */
    crouch(k, 694, 406, 165, { dir: 1, coat: { b: 0.72, y: 0.5, r: 0.12 }, legs: { b: 0.8, r: 0.6, y: 0.4 }, hair: { y: 0.64, r: 0.4, b: 0.12 }, beard: { y: 0.6, r: 0.62, b: 0.1 } });
    /* below: the court, full of people, and the gendarmes watching */
    k.fill({ y: 0.3, r: 0.12, b: 0.1 }, k.rect(-10, 660, 420, 140));
    for (const x of [60, 200, 330]) { k.fill({ b: 0.6, r: 0.3 }, k.rect(x, 690, 40, 70)); k.fill({ b: 0.4, y: 0.5 }, k.rect(x - 16, 690, 14, 70)); k.fill({ b: 0.4, y: 0.5 }, k.rect(x + 42, 690, 14, 70)); }
    k.fill({ y: 0.34, r: 0.2, b: 0.24 }, k.poly([410, 800, 410, 660, 760, 640, 760, 800]));
    crowd(k, 420, 760, 772, 34, [C.navy, C.dark, { y: 0.5, r: 0.3, b: 0.4 }, { r: 0.6, b: 0.3 }, C.cream], { step: 0.34 });
    crowd(k, 430, 750, 798, 40, [C.navy, C.dark, { y: 0.5, r: 0.3, b: 0.4 }, C.red], { step: 0.32 });
    for (const x of [560, 690]) {
      person(k, x, 760, 70, { coat: { b: 0.9, r: 0.3 }, legs: C.cream, hat: 'bicorne', hatC: C.ink, arms: 'down' });
      k.stroke(C.dark, k.poly([x + 6, 700, x + 12, 752], true), 2);
    }
    gull(k, 640, 150, 9, C.navy);
  },
};

/* ── Chapter 100: the apparition ──────────────────────────────────────── */
const apparition = {
  w: 1000, h: 1250, seed: 53383,
  draw(k) {
    k.fill({ b: 0.92, r: 0.62, y: 0.26 }, k.rect(0, 0, 1000, 1250));
    const pan = k.P(); for (let x = 20; x < 1000; x += 200) { pan.rect(x, 90, 170, 380); pan.rect(x, 520, 170, 420); }
    k.addStroke({ b: 0.14, r: 0.1 }, pan, 4);
    parquet(k, 0, 980, 1000, 1250, 620, { b: 0.84, r: 0.62, y: 0.4 }, { boards: 14 });
    /* the library in the recess by the chimney-piece, its door open */
    k.fill({ b: 1, r: 0.78, y: 0.42 }, k.rect(300, 240, 160, 740));
    for (const y of [400, 540, 680, 820, 960]) { books(k, 306, y, 148, 100, { cols: [{ b: 0.9, r: 0.8, y: 0.4 }, { b: 1, r: 0.6, y: 0.5 }, { r: 0.9, b: 0.7, y: 0.4 }], bands: false }); k.fill({ b: 0.9, r: 0.7, y: 0.5 }, k.rect(300, y, 160, 8)); }
    k.fill({ b: 0.78, r: 0.62, y: 0.46 }, k.poly([300, 240, 214, 214, 214, 1000, 300, 980]));
    k.addStroke({ b: 0.2 }, k.poly([236, 250, 284, 262, 284, 560, 236, 552]), 3);
    k.addStroke({ b: 0.2 }, k.poly([236, 610, 284, 614, 284, 950, 236, 958]), 3);
    /* the chimney-piece and the glass above it */
    frame(k, 520, 110, 330, 380, 18, { gold: { y: 0.62, r: 0.42, b: 0.4 } });
    k.fill({ b: 0.96, r: 0.7, y: 0.36 }, k.rect(538, 128, 294, 344));
    k.cut(k.poly([560, 150, 610, 150, 540, 300, 540, 250]), 0.25);
    const marble = { y: 0.2, r: 0.12, b: 0.3 };
    k.fill(marble, k.rect(492, 584, 50, 396)); k.fill(marble, k.rect(808, 584, 50, 396));
    k.fill(marble, k.rect(470, 560, 410, 28));
    k.fill(marble, k.rect(492, 588, 366, 70));
    k.fill({ b: 1, r: 0.9, y: 0.5 }, k.rect(542, 658, 266, 322));
    for (let i = 0; i < 12; i++) k.fill({ r: 0.9, y: 0.6 }, k.circ(k.R(590, 760), k.R(950, 972), k.R(2, 5)));
    /* the night-lamp of alabaster on the chimney-piece, and its glow */
    const lx = 580, ly = 520;
    k.cut(k.circ(lx, ly, 560), k.rad(lx, ly, 0, 560, [0, 1], [0.22, 0.68], [0.6, 0.22], [1, 0]));
    k.add({ y: k.rad(lx, ly, 0, 560, [0, 0.9], [0.45, 0.46], [1, 0.02]), r: k.rad(lx, ly, 0, 560, [0, 0.14], [0.6, 0.1], [1, 0]) }, k.circ(lx, ly, 560));
    k.fill({ y: 0.5, r: 0.3, b: 0.2 }, k.poly([lx - 22, 560, lx + 22, 560, lx + 12, 548, lx - 12, 548]));
    k.fill({ y: 0.42, r: 0.06 }, k.blob([lx - 12, 548, lx - 26, 530, lx - 22, 502, lx, 490, lx + 22, 502, lx + 26, 530, lx + 12, 548]));
    k.cut(k.ell(lx - 6, 516, 8, 14), 0.8);
    /* the bed, its curtains, and Valentine who wakes and watches */
    drape(k, -20, 0, 250, 980, { r: 0.66, b: 0.56, y: 0.2 }, { tie: 0.7, folds: 5 });
    const bed = { y: 0.54, r: 0.5, b: 0.5 };
    k.fill(bed, k.rect(0, 850, 470, 150));
    k.fill(bed, k.rect(-10, 700, 50, 400));
    k.fill({ b: 0.3, y: 0.08 }, k.blob([30, 900, 60, 870, 200, 880, 330, 888, 470, 900, 480, 1000, 30, 1000]));
    k.add({ b: 0.16 }, k.blob([30, 960, 200, 950, 470, 960, 480, 1000, 30, 1000]));
    k.fill({ b: 0.18, y: 0.08 }, k.ell(110, 866, 80, 30));
    k.fill(C.skin, k.ell(150, 846, 26, 30));
    k.fill({ y: 0.66, r: 0.64, b: 0.5 }, k.blob([124, 850, 122, 822, 146, 812, 174, 822, 178, 836, 160, 830, 138, 838, 132, 870]));
    k.fill(C.ink, k.ell(166, 846, 2.4, 3));
    k.fill({ b: 0.2, y: 0.08 }, k.blob([150, 874, 196, 868, 250, 884, 234, 904, 170, 902]));
    k.fill(C.skin, k.circ(236, 890, 9));
    /* the table by the bed, the carafe */
    k.fill({ y: 0.54, r: 0.5, b: 0.5 }, k.rect(420, 930, 90, 16)); k.fill({ y: 0.54, r: 0.5, b: 0.5 }, k.rect(456, 946, 16, 150));
    k.fill({ b: 0.26, y: 0.14 }, k.blob([448, 930, 444, 898, 454, 878, 462, 878, 472, 898, 468, 930]));
    k.cut(k.rect(450, 894, 4, 26), 0.6);
    /* the figure from the library holds the glass up to the night-light */
    const cf = F(716, 1210, 760, -1);
    person(k, 716, 1210, 760, { dir: -1, coat: C.ink, legs: C.ink, shirt: { b: 0.3 }, hair: C.ink, skin: { y: 0.34, r: 0.3, b: 0.12 }, long: true, arms: 'none' });
    arm(k, cf, C.ink, [-8.5, 79, -12, 60, -11.5, 47], [-11.5, 45], { edge: { b: 0.5 }, skin: { y: 0.3, r: 0.28, b: 0.2 } });
    arm(k, cf, C.ink, [8.5, 79, 18, 76, 20, 89], [20, 90.6], { edge: { b: 0.5 }, skin: { y: 0.4, r: 0.3 } });
    const gx = cf.X(20), gy = cf.Y(96);
    k.cut(k.circ(gx, gy, 46), k.rad(gx, gy, 0, 46, [0, 0.8], [1, 0]));
    const gl = k.poly([gx - 12, gy - 26, gx + 12, gy - 26, gx + 9, gy + 22, gx - 9, gy + 22]);
    k.cut(gl, 1);
    k.fill({ y: 0.5, r: 0.08 }, gl);
    k.add({ y: 0.3, r: 0.1 }, k.rect(gx - 11, gy - 2, 22, 20));
    k.cut(k.rect(gx - 7, gy - 22, 3.5, 38), 0.8);
    k.add({ y: k.lin(cf.X(-2), 0, cf.X(8), 0, [0, 0], [1, 0.5]) }, k.ell(cf.X(0.6), cf.Y(91.5), 6.6 * cf.s, 7.8 * cf.s));
    k.fill(C.ink, k.ell(cf.X(4.2), cf.Y(92), 0.7 * cf.s, 0.6 * cf.s));
  },
};

/* ── Chapter 105: the cemetery of Père-Lachaise ───────────────────────── */
function tomb(k, x, yb, w, h, spec, o) {
  o = o || {};
  const shade = o.shade || { b: 0.3, r: 0.1 };
  k.fill(spec, k.rect(x - w / 2, yb - h, w, h));
  k.fill(spec, k.poly([x - w / 2 - w * 0.08, yb - h, x + w / 2 + w * 0.08, yb - h, x, yb - h - w * 0.32]));
  k.add(shade, k.rect(x + w * 0.18, yb - h, w * 0.32, h));
  k.fill(o.door || C.dark, k.rect(x - w * 0.16, yb - h * 0.62, w * 0.32, h * 0.62));
  k.fill(spec, k.rect(x - w / 2 - 4, yb - 6, w + 8, 8));
}

function yew(k, x, yb, h, spec) {
  const w = h * 0.3;
  k.fill(spec, k.blob([x - w * 0.5, yb, x - w * 0.46, yb - h * 0.45, x - w * 0.2, yb - h * 0.85, x, yb - h, x + w * 0.2, yb - h * 0.85, x + w * 0.46, yb - h * 0.45, x + w * 0.5, yb]));
  k.add({ b: 0.2 }, k.poly([x, yb - h, x + w * 0.5, yb, x + w * 0.05, yb]));
}

const lachaise = {
  w: 1400, h: 700, seed: 55175,
  draw(k) {
    sky(k, 0, 420, [[0, { b: 0.66, r: 0.3, y: 0.1 }], [0.55, { b: 0.44, r: 0.18, y: 0.12 }], [1, { b: 0.26, y: 0.24, r: 0.1 }]]);
    for (const [x, y, w] of [[-60, 70, 700], [520, 40, 800], [300, 170, 900], [900, 150, 600]]) cloud(k, { b: 0.24, r: 0.12 }, x, y, w, 30, 9);
    /* the far side of the hill: trees in their last yellow leaves, monuments */
    k.fill({ b: 0.4, r: 0.16, y: 0.24 }, k.blob([-40, 440, -40, 320, 200, 300, 460, 316, 700, 290, 980, 312, 1200, 296, 1440, 318, 1440, 440]));
    for (let i = 0; i < 26; i++) { const x = k.R(0, 1400), y = k.R(300, 330), r = k.R(20, 46); k.fill({ y: 0.6, r: 0.3, b: 0.3 }, k.blob([x - r, y, x - r * 0.5, y - r * 0.8, x + r * 0.4, y - r * 0.9, x + r, y - r * 0.1, x + r * 0.2, y + r * 0.3])); }
    for (let i = 0; i < 14; i++) { const x = k.R(20, 1380); k.fill({ b: 0.5, r: 0.26, y: 0.26 }, k.rect(x, k.R(300, 330), 7, 40)); k.fill({ b: 0.5, r: 0.26, y: 0.26 }, k.poly([x - 4, 320, x + 11, 320, x + 3.5, 290])); }
    k.fill({ y: 0.44, b: 0.36, r: 0.14 }, k.rect(0, 340, 1400, 360));
    /* the long white avenues */
    const av1 = k.P(); av1.moveTo(560, 700); av1.bezierCurveTo(610, 560, 520, 440, 380, 350); av1.lineTo(410, 350); av1.bezierCurveTo(580, 440, 730, 560, 800, 700); av1.closePath();
    const av2 = k.P(); av2.moveTo(620, 470); av2.lineTo(1440, 390); av2.lineTo(1440, 412); av2.lineTo(660, 500); av2.closePath();
    k.cut(av1, 0.92); k.cut(av2, 0.92);
    k.add({ y: 0.08, b: 0.06 }, av1); k.add({ y: 0.08, b: 0.06 }, av2);
    /* monuments and yew-trees */
    const pale = { y: 0.16, r: 0.06, b: 0.14 }, grey = { y: 0.3, r: 0.14, b: 0.34 };
    for (const [x, yb, w, h, s] of [[80, 380, 50, 60, pale], [180, 372, 40, 50, grey], [1000, 390, 46, 54, grey], [1120, 384, 56, 70, pale], [1320, 380, 40, 50, grey], [860, 400, 36, 44, pale]]) tomb(k, x, yb, w, h, s);
    for (const [x, yb, h] of [[40, 430, 150], [250, 420, 130], [470, 410, 110], [930, 430, 160], [1210, 420, 150], [1380, 440, 170], [710, 420, 120]]) yew(k, x, yb, h, { b: 0.92, y: 0.62, r: 0.46 });
    /* an obelisk and urns */
    k.fill(pale, k.poly([1060, 470, 1090, 470, 1082, 330, 1075, 318, 1068, 330]));
    k.add({ b: 0.3 }, k.poly([1075, 318, 1082, 330, 1090, 470, 1075, 470]));
    k.fill(grey, k.rect(1052, 470, 46, 20));
    /* the tomb of Abélard and Héloïse: a small gothic canopy */
    const gx = 1240, gb = 520;
    k.fill(pale, k.rect(gx - 70, gb - 16, 140, 16));
    for (const x of [-60, -20, 20, 60]) k.fill(pale, k.rect(gx + x - 5, gb - 120, 10, 104));
    for (const x of [-40, 0, 40]) { const p = k.P(); p.moveTo(gx + x - 20, gb - 118); p.quadraticCurveTo(gx + x - 18, gb - 150, gx + x, gb - 162); p.quadraticCurveTo(gx + x + 18, gb - 150, gx + x + 20, gb - 118); k.fill(pale, p); }
    k.fill(pale, k.rect(gx - 66, gb - 124, 132, 10));
    for (const x of [-64, -20, 20, 64]) k.fill(pale, k.poly([gx + x - 6, gb - 124, gx + x + 6, gb - 124, gx + x, gb - 176]));
    k.add({ b: 0.3 }, k.rect(gx + 20, gb - 120, 46, 104));
    k.fill(grey, k.rect(gx - 40, gb - 44, 80, 28));
    /* the vault of the families of Saint-Méran and Villefort, its bronze door shut */
    const vx = 330, vb = 560;
    const vs = { y: 0.2, r: 0.08, b: 0.18 };
    k.fill(vs, k.rect(vx - 110, vb - 170, 220, 170));
    k.fill(vs, k.poly([vx - 128, vb - 168, vx + 128, vb - 168, vx, vb - 238]));
    k.add({ b: 0.26, r: 0.08 }, k.rect(vx + 40, vb - 170, 70, 170));
    k.add({ b: 0.2 }, k.poly([vx, vb - 238, vx + 128, vb - 168, vx, vb - 168]));
    for (const x of [-92, -60, 60, 92]) { k.fill({ y: 0.16, b: 0.12 }, k.rect(vx + x - 8, vb - 160, 16, 160)); }
    k.fill({ y: 0.6, r: 0.46, b: 0.6 }, k.rect(vx - 34, vb - 118, 68, 118));
    k.addStroke({ y: 0.5, r: 0.3, b: 0.3 }, k.rect(vx - 26, vb - 110, 52, 104), 2);
    k.fill({ y: 0.3, r: 0.1, b: 0.2 }, k.rect(vx - 110, vb - 146, 220, 18));
    k.text({ b: 0.62, r: 0.3 }, 'SAINT-MÉRAN · VILLEFORT', vx, vb - 132, '600 13px Georgia, serif', 'center');
    k.fill({ y: 0.3, r: 0.12, b: 0.24 }, k.rect(vx - 130, vb - 4, 260, 12));
    /* the hearse and its black horses at the vault */
    const black = { b: 1, r: 0.86, y: 0.5 };
    k.add({ b: 0.3, r: 0.1 }, k.ell(560, 590, 120, 10));
    carriage(k, 520, 590, 130, { dir: -1, body: black, win: black, trim: { y: 0.3, b: 0.2 }, wheel: black });
    for (const x of [470, 500, 540, 570]) { k.fill(black, k.ell(x, 500, 6, 16)); }
    horse(k, 420, 592, 58, { dir: -1, coat: black, mane: black });
    horse(k, 395, 598, 60, { dir: -1, coat: { b: 0.9, r: 0.8, y: 0.44 }, mane: black });
    /* black figures scattered over the long white avenues */
    const mourn = [black, C.ink, { b: 0.9, r: 0.66, y: 0.36 }];
    crowd(k, 600, 780, 632, 46, mourn, { step: 0.34, arms: false });
    crowd(k, 610, 800, 680, 60, mourn, { step: 0.32, arms: false });
    crowd(k, 440, 560, 668, 56, mourn, { step: 0.36, arms: false });
    for (const [x, y, h] of [[700, 520, 40], [735, 500, 36], [820, 480, 32], [900, 470, 30], [980, 460, 28], [660, 560, 44], [760, 540, 40]]) person(k, x, y, h, { coat: C.ink, legs: C.ink, hat: k.rnd() < 0.5 ? 'top' : null, hatC: C.ink, dir: -1 });
    /* the count, out of the ranks, watching one shadow */
    person(k, 870, 650, 150, { dir: 1, coat: C.ink, legs: C.ink, shirt: C.cream, skin: PALE, hair: C.ink, hat: 'top', hatC: C.ink, long: true });
    /* Morrel against a tree on the rise above the vault, crushing his hat */
    k.fill({ y: 0.5, b: 0.44, r: 0.16 }, k.blob([960, 700, 1000, 610, 1100, 570, 1220, 570, 1320, 610, 1400, 640, 1400, 700]));
    const bark = { b: 0.9, r: 0.7, y: 0.5 };
    k.fill(bark, k.poly([1136, 590, 1124, 330, 1142, 260, 1154, 330, 1160, 590]));
    const br = k.P(); for (const [x0, y0, x1, y1] of [[1140, 360, 1060, 250], [1146, 320, 1230, 220], [1142, 280, 1110, 170], [1150, 420, 1250, 340], [1134, 400, 1030, 360]]) { br.moveTo(x0, y0); br.quadraticCurveTo((x0 + x1) / 2, y0 - 30, x1, y1); }
    k.stroke(bark, br, 6);
    for (let i = 0; i < 18; i++) k.fill({ y: 0.9, r: 0.4 }, k.ell(k.R(1040, 1250), k.R(170, 360), 5, 3, k.R(0, 3)));
    const mf = F(1172, 600, 190, -1);
    person(k, 1172, 600, 190, { dir: -1, coat: { b: 0.95, r: 0.46, y: 0.1 }, legs: { b: 0.95, r: 0.46, y: 0.1 }, hair: C.ink, skin: PALE, arms: 'hold', lean: -1.5, hatC: C.ink });
    k.fill({ b: 0.95, r: 0.46, y: 0.1 }, k.poly(mf.pts([-5, 86, 5, 86, 5, 80, -5, 80])));
    k.fill(C.ink, k.blob(mf.pts([4, 60, 14, 62, 20, 57, 16, 52, 6, 54])));
    /* a cold wind shaking down the last yellow leaves */
    for (let i = 0; i < 70; i++) { const x = k.R(0, 1400), y = k.R(20, 660); k.fill(k.rnd() < 0.7 ? { y: 0.92, r: 0.3 } : { y: 0.8, r: 0.6 }, k.ell(x, y, k.R(3, 6), k.R(1.6, 3), k.R(-0.8, 0.8))); }
  },
};

/* ── Chapter 110: the Assizes ─────────────────────────────────────────── */
const assizes = {
  w: 1200, h: 800, seed: 57590,
  draw(k) {
    const wall = { y: 0.4, r: 0.22, b: 0.16 };
    k.fill(wall, k.rect(0, 0, 1200, 800));
    /* one of the softest and most brilliant days of September, through high windows */
    for (const x of [90, 330]) {
      sky(k, 50, 290, [[0, { b: 0.3 }], [1, { b: 0.08, y: 0.08 }]], x, x + 120);
      k.fill(wall, k.rect(x + 56, 50, 8, 240)); k.fill(wall, k.rect(x, 160, 120, 8));
      const beam = k.poly([x, 290, x + 120, 290, x + 420, 800, x + 180, 800]);
      k.cut(beam, k.lin(x, 290, x + 300, 800, [0, 0.5], [1, 0.14]));
      k.add({ y: 0.18 }, beam);
    }
    /* the bench of the magistrates, raised, with its panelling */
    const oak = { y: 0.6, r: 0.52, b: 0.44 };
    k.fill({ y: 0.56, r: 0.5, b: 0.5 }, k.rect(560, 60, 620, 330));
    const pan = k.P(); for (let x = 580; x < 1170; x += 100) pan.rect(x, 80, 80, 150); k.addStroke({ b: 0.3, r: 0.2 }, pan, 3);
    for (const [x, c] of [[700, 0], [820, 1], [940, 0]]) {
      person(k, x, 380, 170, { coat: { r: 0.9, y: 0.2 }, legs: { r: 0.9, y: 0.2 }, shirt: C.cream, hair: { b: 0.2, y: 0.1 }, skin: C.skin, hat: 'cap', hatC: C.ink, arms: c ? 'hold' : 'down', long: true });
      k.fill(C.cream, k.poly([x - 12, 380 - 142, x + 12, 380 - 142, x + 10, 380 - 128, x - 10, 380 - 128]));
    }
    k.fill(oak, k.rect(560, 300, 620, 120));
    k.fill({ y: 0.66, r: 0.56, b: 0.46 }, k.rect(548, 290, 644, 18));
    k.fill({ b: 0.66, y: 0.66, r: 0.1 }, k.rect(620, 308, 500, 14));
    /* the public, the lawyers, the press */
    const coats = [C.ink, C.dark, C.navy, { y: 0.5, r: 0.3, b: 0.5 }, { r: 0.6, b: 0.4, y: 0.2 }, C.cream];
    for (let r = 0; r < 4; r++) { const y = 470 + r * 56; k.fill({ y: 0.5, r: 0.44, b: 0.4 }, k.rect(0, y, 520, 12)); crowd(k, -10, 520 - r * 20, y, 44 + r * 6, coats, { step: 0.36 }); }
    k.fill(C.cream, k.circ(186, 470 + 2 * 56 - 38, 5)); k.stroke(C.gold, k.circ(186, 470 + 2 * 56 - 38, 5), 1.6);
    /* the floor of the court */
    k.fill({ y: 0.46, r: 0.38, b: 0.34 }, k.rect(520, 420, 680, 380));
    parquet(k, 520, 420, 1200, 800, 860, { y: 0.5, r: 0.4, b: 0.32 }, { boards: 14 });
    /* the king's attorney, half bowed over in his chair */
    k.fill({ r: 0.72, b: 0.5, y: 0.3 }, k.blob([566, 580, 562, 450, 600, 426, 640, 450, 636, 580]));
    seated(k, 610, 560, 190, { dir: 1, coat: C.ink, legs: C.ink, hair: { b: 0.4, y: 0.1 }, skin: PALE, arm: 'head', lean: 5 });
    k.fill(C.cream, k.poly([612, 486, 626, 486, 622, 470, 616, 470]));
    k.fill(oak, k.rect(520, 580, 200, 170));
    k.add({ b: 0.2 }, k.rect(660, 580, 60, 170));
    k.cut(k.poly([540, 578, 600, 570, 604, 578, 544, 586]), 0.9);
    /* the dock, its oaken rail, and Benedetto: one hand on his hat, the other in his white waistcoat */
    const g = { b: 0.92, r: 0.34 };
    for (const x of [960, 1140]) { person(k, x, 700, 250, { dir: -1, coat: g, legs: C.cream, hat: 'bicorne', hatC: C.ink, hair: C.ink, arms: 'down' }); k.stroke(C.cream, k.poly([x - 18, 700 - 205, x + 18, 700 - 130], true), 5); }
    const af = F(1040, 720, 300, -1);
    person(k, 1040, 720, 300, { dir: -1, coat: { b: 0.62, r: 0.2, y: 0.42 }, legs: C.ink, shirt: C.cream, hair: { y: 0.66, r: 0.44, b: 0.12 }, beard: { y: 0.6, r: 0.66, b: 0.12 }, beardLen: 84, long: true, arms: 'none' });
    k.fill(C.cream, k.poly(af.pts([-5.5, 82, 5.5, 82, 5, 55, -5, 55])));
    k.addStroke({ b: 0.3 }, k.poly(af.pts([0, 80, 0, 56]), true), 0.6 * af.s);
    arm(k, af, { b: 0.62, r: 0.2, y: 0.42 }, [8.5, 79, 10, 66, 2, 70], [1, 70.5], { edge: C.ink });
    arm(k, af, { b: 0.62, r: 0.2, y: 0.42 }, [-8.5, 79, -13, 67, -15.5, 58.5], null, { edge: C.ink });
    k.fill(C.ink, k.poly(af.pts([-22, 60, -9.5, 60, -10.5, 51, -21, 51])));
    k.fill(C.ink, k.ell(af.X(-16), af.Y(51), 9 * af.s, 1.6 * af.s));
    k.fill(C.skin, k.circ(af.X(-15.5), af.Y(60), 2.8 * af.s));
    k.fill(C.ink, k.ell(af.X(3.4), af.Y(92), 0.7 * af.s, 0.6 * af.s));
    k.cut(k.circ(af.X(3.6), af.Y(92.2), 0.22 * af.s), 1);
    k.fill(oak, k.rect(820, 600, 380, 200));
    k.fill({ y: 0.66, r: 0.56, b: 0.46 }, k.rect(810, 588, 400, 22));
    k.add({ b: 0.22 }, k.rect(820, 610, 380, 190));
    const pl = k.P(); for (let x = 850; x < 1200; x += 70) pl.rect(x, 630, 50, 140); k.addStroke({ b: 0.3, r: 0.2 }, pl, 3);
  },
};

/* ── Chapter 112: Paris from the hill of Villejuif ────────────────────── */
const villejuif = {
  w: 1400, h: 700, seed: 58319,
  draw(k) {
    sky(k, 0, 400, [[0, { b: 1, r: 0.66, y: 0.14 }], [0.7, { b: 0.9, r: 0.5, y: 0.1 }], [1, { b: 0.7, r: 0.36, y: 0.22 }]]);
    stars(k, 260, 0, 0, 1400, 300, 1.5);
    const mw = k.P(); for (let i = 0; i < 500; i++) { const t = k.rnd(), x = 200 + t * 1000 + k.R(-60, 60), y = 40 + t * 160 + k.R(-40, 40); mw.moveTo(x + 0.9, y); mw.arc(x, y, k.R(0.5, 1.1), 0, Math.PI * 2); }
    k.cut(mw, 0.7);
    /* the glow the city throws up into the night */
    k.cut(k.rect(0, 250, 1400, 150), k.lin(0, 250, 0, 400, [0, 0], [1, 0.4]));
    k.add({ y: k.lin(0, 260, 0, 400, [0, 0], [1, 0.34]), r: k.lin(0, 300, 0, 400, [0, 0], [1, 0.12]) }, k.rect(0, 250, 1400, 150));
    /* the plain of roofs, and its domes and towers against the glow (our choice of landmarks) */
    const city = { b: 0.96, r: 0.62, y: 0.26 };
    k.fill(city, k.rect(0, 386, 1400, 314));
    const sil = k.P();
    const dome = (x, w, h, lan) => { sil.rect(x - w * 0.55, 386 - h * 0.45, w * 1.1, h * 0.45); sil.ellipse(x, 386 - h * 0.45, w * 0.5, h * 0.4, 0, Math.PI, 0); sil.rect(x - 4, 386 - h * 0.85 - lan, 8, lan); };
    dome(560, 70, 150, 20); dome(300, 60, 130, 30);
    sil.rect(760, 316, 26, 70); sil.rect(800, 316, 26, 70); sil.rect(786, 336, 14, 50);
    sil.rect(420, 350, 18, 36); sil.rect(446, 350, 18, 36);
    for (let x = 0; x < 1400; x += k.R(18, 40)) sil.rect(x, 386 - k.R(4, 16), k.R(14, 34), 20);
    k.fill(city, sil);
    k.fill({ y: 0.6, r: 0.3, b: 0.3 }, k.circ(300, 386 - 130 * 0.85 - 30, 3));
    /* millions of phosphoric waves of light */
    const lights = k.P();
    for (let r = 0; r < 36; r++) {
      const t = r / 35, y0 = 392 + Math.pow(t, 1.5) * 250, gap = 5 + t * 12, amp = 2 + t * 9, ph = k.R(0, 6), fr = 0.014 - t * 0.007;
      for (let x = -10; x < 1410; x += gap * k.R(0.6, 1.4)) {
        if (k.rnd() < 0.18 + 0.3 * Math.max(0, Math.sin(x * 0.004 + r * 0.3))) continue;
        const y = y0 + Math.sin(x * fr + ph) * amp + k.R(-2, 2), rr = (0.8 + t * 1.8) * k.R(0.6, 1.2);
        lights.moveTo(x + rr, y); lights.arc(x, y, rr, 0, Math.PI * 2);
      }
    }
    k.cut(lights, 1);
    k.fill({ y: 0.95, r: 0.2 }, lights);
    waves(k, { y0: 400, y1: 660, rows: 14, len: 90, amp: 5, lw: 2, cut: true, amount: 0.25, dens: 0.4 });
    /* the hilltop: the road, the carriage gone on a short distance */
    const hill = { b: 1, r: 0.8, y: 0.4 };
    k.fill(hill, k.blob([-40, 700, -40, 560, 160, 540, 420, 556, 700, 600, 1000, 620, 1440, 608, 1440, 700]));
    const road = k.P(); road.moveTo(300, 700); road.bezierCurveTo(420, 640, 800, 630, 1440, 640); road.lineTo(1440, 660); road.bezierCurveTo(820, 652, 480, 672, 400, 700); road.closePath();
    k.fill({ b: 0.8, r: 0.6, y: 0.4 }, road);
    k.cut(road, 0.25);
    k.add({ b: 0.4, r: 0.2 }, k.ell(1180, 650, 120, 8));
    horse(k, 1300, 650, 56, { dir: 1, coat: { b: 0.9, r: 0.7, y: 0.4 } });
    horse(k, 1330, 654, 58, { dir: 1, coat: { b: 1, r: 0.8, y: 0.44 } });
    carriage(k, 1180, 652, 130, { dir: 1, body: C.ink, win: { y: 0.5, r: 0.1 } });
    k.cut(k.circ(1240, 610, 10), k.rad(1240, 610, 0, 10, [0, 1], [1, 0])); k.fill(C.gold, k.circ(1240, 610, 3));
    person(k, 1250, 646, 64, { dir: -1, coat: { r: 0.8, b: 0.6 }, legs: C.cream, hat: 'fez', skin: { y: 0.5, r: 0.5, b: 0.5 } });
    /* the count alone, arms folded, gazing on the great city */
    const cf = F(380, 568, 285, 1);
    person(k, 380, 568, 285, { dir: 1, coat: C.ink, legs: C.ink, hair: C.ink, skin: PALE, long: true, arms: 'none', mantle: { b: 1, r: 0.86, y: 0.46 }, mantleFold: { b: 0.4 } });
    arm(k, cf, { b: 1, r: 0.86, y: 0.46 }, [-8.5, 79, -11, 64, 6, 69], null, { edge: { b: 0.5 } });
    arm(k, cf, { b: 1, r: 0.86, y: 0.46 }, [8.5, 79, 12, 64, -5, 70], null, { edge: { b: 0.5 } });
    k.add({ y: 0.3 }, k.ell(cf.X(3), cf.Y(91), 3.6 * cf.s, 6 * cf.s));
  },
};

/* ── Chapter 112: the little garden in the Allées de Meilhan ──────────── */
function bowed(k, x, y, h, o) {
  const f = F(x, y, h, o.dir || 1);
  const dress = o.dress;
  if (o.veilBack) k.fill(o.veilBack, k.blob(f.pts([12, 50, 4, 46, 0, 30, -4, 10, 4, 10, 8, 32])));
  k.fill(dress, k.blob(f.pts([-9, 36, -12, 10, -12, -30, -8, -40, 30, -40, 34, -30, 30, 2, 22, 10, 6, 14])));
  k.fill(dress, k.poly(f.pts([-8, 4, 8, 6, 20, 34, 4, 42])));
  k.clip(k.blob(f.pts([-9, 36, -12, 10, -12, -30, -8, -40, 30, -40, 34, -30, 30, 2, 22, 10, 6, 14])), () => { const fl = k.P(); for (const a of [-4, 6, 16, 26]) { const p = f.pts([a * 0.4, 10, a, -40]); fl.moveTo(p[0], p[1]); fl.lineTo(p[2], p[3]); } k.addStroke({ b: 0.3 }, fl, 0.8 * f.s); });
  k.fill(o.skin || C.skin, k.ell(f.X(21), f.Y(40), 5.6 * f.s, 6.6 * f.s));
  k.fill(o.hair, k.blob(f.pts([14, 40, 15, 47, 21, 49, 27, 45, 25, 43, 20, 45, 16, 42])));
  arm(k, f, dress, [8, 38, 20, 16, 23, 34], null, { edge: C.ink, w: 4 });
  arm(k, f, dress, [4, 36, 16, 14, 20, 32], null, { edge: C.ink, w: 4 });
  k.fill(o.skin || C.skin, k.ell(f.X(23.5), f.Y(37), 3 * f.s, 4 * f.s));
  k.fill(o.skin || C.skin, k.ell(f.X(20), f.Y(35.5), 2.6 * f.s, 3.6 * f.s));
  return f;
}

const garden = {
  w: 1000, h: 1250, seed: 58669,
  draw(k) {
    /* the garden, bathed in sunshine, rich in warmth and light */
    sky(k, 0, 520, [[0, { b: 0.34 }], [1, { b: 0.1, y: 0.2 }]]);
    k.fill({ y: 0.56, r: 0.2, b: 0.06 }, k.rect(0, 360, 1000, 420));
    const vine = { b: 0.8, y: 0.74, r: 0.3 };
    for (let i = 0; i < 60; i++) { const x = k.R(-20, 1020), y = k.R(300, 420), r = k.R(24, 50); k.fill(scale(vine, k.R(0.75, 1)), k.blob([x - r, y, x - r * 0.4, y - r * 0.7, x + r * 0.5, y - r * 0.6, x + r, y + r * 0.1, x + r * 0.2, y + r * 0.6, x - r * 0.7, y + r * 0.5])); }
    k.fill({ y: 0.66, r: 0.3, b: 0.08 }, k.rect(0, 430, 1000, 400));
    stonework(k, 0, 430, 1000, 180, 30, { y: 0.24, r: 0.1, b: 0.04 });
    /* the arbour of Virginia jessamine, thick foliage and long purple flowers */
    const leaf = { b: 0.86, y: 0.72, r: 0.28 };
    k.fill(scale(leaf, 1.05), k.blob([250, 820, 240, 520, 300, 380, 500, 330, 700, 380, 760, 520, 750, 820, 680, 820, 670, 520, 500, 450, 330, 520, 320, 820]));
    for (let i = 0; i < 110; i++) { const a = k.R(Math.PI * 1.05, Math.PI * 1.95), rr = k.R(150, 250), x = 500 + Math.cos(a) * rr * 1.1, y = 560 + Math.sin(a) * rr * 0.9, r = k.R(14, 32); k.fill(scale(leaf, k.R(0.7, 1)), k.blob([x - r, y, x - r * 0.3, y - r * 0.8, x + r * 0.6, y - r * 0.6, x + r, y + r * 0.2, x, y + r * 0.7])); }
    for (let i = 0; i < 40; i++) { const x = k.R(250, 320) + (k.rnd() < 0.5 ? 430 : 0), y = k.R(500, 800), r = k.R(12, 26); k.fill(scale(leaf, k.R(0.7, 1)), k.blob([x - r, y, x - r * 0.3, y - r * 0.8, x + r * 0.6, y - r * 0.6, x + r, y + r * 0.2, x, y + r * 0.7])); }
    /* the shade under the arbour */
    k.add({ b: 0.46, r: 0.16 }, k.blob([330, 820, 330, 540, 500, 460, 670, 540, 670, 820]));
    for (let i = 0; i < 34; i++) {
      const a = k.R(Math.PI * 1.08, Math.PI * 1.92), x = 500 + Math.cos(a) * 205, y = 560 + Math.sin(a) * 170 + k.R(-20, 30);
      const l = k.R(30, 60);
      k.fill(k.rnd() < 0.6 ? { r: 0.78, b: 0.64 } : { r: 0.6, b: 0.8 }, k.blob([x - 6, y, x - 8, y + l * 0.5, x, y + l, x + 8, y + l * 0.5, x + 6, y]));
      k.cut(k.circ(x - 2, y + l * 0.3, 2), 0.5);
    }
    /* gravel */
    k.fill({ y: 0.42, r: 0.18, b: 0.1 }, k.rect(0, 810, 1000, 120));
    for (let i = 0; i < 260; i++) k.fill(k.rnd() < 0.5 ? { y: 0.2, b: 0.2, r: 0.1 } : { y: 0.6, r: 0.3 }, k.circ(k.R(0, 1000), k.R(812, 930), k.R(1.2, 2.6)));
    /* Mercédès seated under it, her veil raised, her face hidden in her hands */
    k.fill({ y: 0.5, r: 0.5, b: 0.5 }, k.rect(390, 740, 240, 14)); k.fill({ y: 0.5, r: 0.5, b: 0.5 }, k.rect(404, 754, 12, 60)); k.fill({ y: 0.5, r: 0.5, b: 0.5 }, k.rect(604, 754, 12, 60));
    bowed(k, 470, 744, 200, { dir: 1, dress: { b: 0.9, r: 0.62, y: 0.34 }, hair: C.ink, veilBack: { b: 1, r: 0.8, y: 0.4 } });
    /* the passage paved with bricks, from the street door */
    const brick = { y: 0.6, r: 0.66, b: 0.56 };
    const frameP = k.P(); frameP.rect(-10, -10, 1020, 1270);
    const op = k.P(); op.moveTo(190, 930); op.lineTo(190, 330); op.bezierCurveTo(190, 120, 810, 120, 810, 330); op.lineTo(810, 930); op.closePath();
    frameP.moveTo(190, 930); frameP.lineTo(190, 330); frameP.bezierCurveTo(190, 120, 810, 120, 810, 330); frameP.lineTo(810, 930); frameP.closePath();
    k.fill({ b: 0.9, r: 0.74, y: 0.5 }, frameP, { rule: 'evenodd' });
    k.clip(frameP, () => { const bw = k.P(); for (let y = 0; y < 940; y += 30) { bw.moveTo(0, y); bw.lineTo(1000, y); for (let x = (y / 30) % 2 ? 30 : 0; x < 1000; x += 60) { bw.moveTo(x, y); bw.lineTo(x, y + 30); } } k.addStroke({ b: 0.3, r: 0.2 }, bw, 2); });
    k.addStroke({ y: 0.5, r: 0.4, b: 0.3 }, op, 10);
    /* the floor of bricks, and the sunlight lying on it */
    const fl = k.poly([190, 930, 810, 930, 1000, 1250, 0, 1250]);
    k.fill(brick, fl);
    k.clip(fl, () => {
      const g = k.P();
      for (let y = 930, st = 14; y < 1260; st *= 1.14, y += st) { g.moveTo(0, y); g.lineTo(1000, y); }
      for (let i = -8; i <= 8; i++) { g.moveTo(500 + i * 38, 930); g.lineTo(500 + i * 125, 1250); }
      k.addStroke({ b: 0.36, r: 0.2 }, g, 2);
      const sun = k.poly([260, 930, 810, 930, 900, 1250, 380, 1250]);
      k.cut(sun, k.lin(0, 930, 0, 1250, [0, 0.72], [1, 0.3]));
      k.add({ y: 0.36, r: 0.08 }, sun);
      k.add({ b: 0.5, r: 0.3 }, k.poly([0, 930, 190, 930, 60, 1250, 0, 1250]));
    });
    /* the count, stepping into the house, dark against the light */
    const cf = F(820, 1250, 700, -1);
    person(k, 820, 1250, 700, { dir: -1, coat: C.ink, legs: C.ink, hair: C.ink, skin: { y: 0.3, r: 0.36, b: 0.4 }, long: true, arms: 'down', hat: 'top', hatC: C.ink });
    k.add({ y: 0.26 }, k.poly(cf.pts([2, 110, 7, 96, 8, 60, 11, 30, 5, 30, 4, 90])));
  },
};

/* ── Chapter 113: the boat to If at sunset ────────────────────────────── */
const ifsunset = {
  w: 1400, h: 700, seed: 58943,
  draw(k) {
    sky(k, 0, 420, [[0, { b: 0.44, r: 0.3 }], [0.45, { y: 0.34, r: 0.34, b: 0.1 }], [0.8, { y: 0.72, r: 0.5 }], [1, { y: 0.95, r: 0.62 }]]);
    cloud(k, { r: 0.3, b: 0.12 }, 120, 120, 560, 20, 8);
    cloud(k, { r: 0.36, y: 0.2 }, 760, 220, 520, 14, 7);
    /* the sun, red and flaming, sinking into the embrace of the ocean */
    k.cut(k.circ(560, 418, 210), k.rad(560, 418, 40, 210, [0, 0.55], [1, 0]));
    k.clip(k.rect(0, 0, 1400, 420), () => disc(k, 560, 418, 56, { y: 0.95, r: 0.86 }, 0));
    sea(k, 420, 700, { top: { y: 0.44, r: 0.34, b: 0.16 }, bottom: { b: 0.62, r: 0.36, y: 0.2 }, rows: 12, amp: 1.2, swellSpec: { b: 0.18, r: 0.08 }, dens: 0.3 });
    lightPath(k, 560, 424, 700, 70, 0.8);
    k.add({ y: k.lin(0, 420, 0, 700, [0, 0.5], [1, 0.1]), r: k.lin(0, 420, 0, 700, [0, 0.3], [1, 0]) }, k.poly([500, 420, 620, 420, 760, 700, 360, 700]));
    /* fishing boats white as gulls, and a merchant ship on the verge of the horizon */
    for (const [x, s] of [[120, 1], [190, 0.8], [880, 0.9], [960, 1.1]]) { k.fill(C.dark, k.ell(x, 418, 12 * s, 2.2 * s)); k.cut(k.poly([x, 416, x, 392 * 1 - 10 * s, x + 14 * s, 414]), 1); }
    ship(k, 290, 419, 44, { dir: -1, sails: 'full', hull: { b: 0.6, r: 0.4 }, sail: { y: 0.1 } });
    /* the Château d'If, warm in the last light */
    chateauIf(k, 1110, 452, 0.92, { stone: { y: 0.56, r: 0.36, b: 0.16 }, rock: { y: 0.44, r: 0.38, b: 0.36 }, shade: { b: 0.4, r: 0.2 }, rockShade: { b: 0.36, r: 0.2 } });
    k.add({ b: 0.14, r: 0.06 }, k.rect(870, 452, 530, 40));
    /* fish leaping */
    for (const [x, y] of [[760, 470], [700, 500], [420, 480]]) { const p = k.P(); p.moveTo(x - 10, y); p.quadraticCurveTo(x, y - 14, x + 10, y); k.stroke(C.navy, p, 3); k.cut(k.ell(x - 12, y + 2, 7, 2), 0.8); k.cut(k.ell(x + 12, y + 2, 7, 2), 0.8); }
    /* the pleasure-boat with a striped awning, the boatman, the count in his cloak */
    const bx = 500, by = 610, L = 380;
    k.add({ b: 0.3, r: 0.1 }, k.ell(bx, by + 16, L * 0.56, 10));
    k.cut(k.ell(bx, by + 30, L * 0.5, 8), 0.3);
    const b = boat(k, bx, by, L, { dir: 1, hull: { b: 0.8, r: 0.5, y: 0.3 }, band: C.gold });
    const aw = k.poly([b.X(-46), b.Y(40), b.X(-6), b.Y(40), b.X(-2), b.Y(33), b.X(-50), b.Y(33)]);
    k.fill(C.cream, aw);
    k.clip(aw, () => { for (let x = -50; x < 0; x += 6) k.fill(C.red, k.rect(Math.min(b.X(x), b.X(x + 3)), b.Y(41), 3 * b.s, 9 * b.s)); });
    for (const x of [-44, -8]) k.stroke(C.dark, k.poly([b.X(x), b.Y(33), b.X(x), b.Y(6)], true), 1.2 * b.s);
    sitter(k, b.X(18), b.Y(6), 84, { r: 0.7, y: 0.5, b: 0.2 }, { hat: 'cap', hatC: C.red, oar: 70 });
    const cloak = { b: 1, r: 0.8, y: 0.4 };
    sitter(k, b.X(-40), b.Y(6), 96, cloak, { skin: PALE, hat: 'round', hatC: C.ink });
    k.fill(cloak, k.blob([b.X(-40) - 18, b.Y(6), b.X(-40) - 16, b.Y(6) - 56, b.X(-40), b.Y(6) - 68, b.X(-40) + 12, b.Y(6) - 60, b.X(-40) + 8, b.Y(6) - 74, b.X(-40) + 18, b.Y(6)]));
    k.add({ y: 0.3, r: 0.1 }, k.ell(b.X(-40) + 4, b.Y(6) - 80, 5, 10));
    gull(k, 820, 150, 12, C.navy); gull(k, 860, 176, 8, C.navy);
  },
};

/* ── Chapter 113: his own dungeon ─────────────────────────────────────── */
const cell = {
  w: 1000, h: 1250, seed: 59100,
  draw(k) {
    const stoneC = { b: 0.62, r: 0.4, y: 0.3 };
    k.fill(stoneC, k.rect(0, 0, 1000, 1250));
    stonework(k, 0, 0, 1000, 1000, 64, { b: 0.2, r: 0.1, y: 0.06 });
    /* the floor */
    k.fill({ b: 0.7, r: 0.5, y: 0.4 }, k.rect(0, 1000, 1000, 250));
    const fl = k.P(); for (let y = 1010, g = 10; y < 1250; g *= 1.3, y += g) { fl.moveTo(0, y); fl.lineTo(1000, y); } k.addStroke({ b: 0.3 }, fl, 2);
    /* the narrow opening high up, and the dull light that tries to come in */
    const wx = 520, wy = 110;
    k.fill({ b: 0.9, r: 0.66, y: 0.4 }, k.poly([wx - 60, wy - 40, wx + 60, wy - 40, wx + 30, wy + 60, wx - 30, wy + 60]));
    k.cut(k.rect(wx - 12, wy - 30, 24, 80), 1);
    k.fill({ b: 0.2 }, k.rect(wx - 12, wy - 30, 24, 80));
    for (const x of [wx - 4, wx + 4]) k.fill(C.dark, k.rect(x - 1.5, wy - 30, 3, 80));
    const beam = k.poly([wx - 12, wy + 50, wx + 12, wy + 50, wx + 160, 1080, wx - 40, 1120]);
    k.cut(beam, k.lin(wx, wy, wx + 60, 1100, [0, 0.55], [0.7, 0.2], [1, 0.08]));
    k.add({ b: 0.06 }, beam);
    /* where his bed stood, since removed; behind it the new stones over Faria's breach */
    k.add({ b: 0.3, r: 0.2 }, k.rect(90, 690, 330, 310));
    k.cut(k.rect(106, 920, 300, 80), 0.25);
    const nw = { y: 0.34, r: 0.18, b: 0.34 };
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { const x = 170 + c * 64 + (r % 2) * 20, y = 760 + r * 38; k.fill(scale(nw, k.R(0.85, 1.1)), k.rect(x, y, 60, 34)); }
    k.cut(k.rect(170, 760, 212, 152), 0.06);
    /* the concierge's torch at the door, which makes the corridor darker still */
    const tx = 794, ty = 430;
    k.fill({ b: 1, r: 0.8, y: 0.44 }, k.rect(780, 300, 220, 700));
    k.cut(k.circ(tx, ty, 420), k.rad(tx, ty, 0, 420, [0, 0.95], [0.3, 0.5], [1, 0]));
    k.add({ y: k.rad(tx, ty, 0, 420, [0, 0.95], [0.4, 0.5], [1, 0.02]), r: k.rad(tx, ty, 0, 420, [0, 0.5], [0.6, 0.14], [1, 0]) }, k.circ(tx, ty, 420));
    k.addStroke({ b: 0.5, r: 0.3 }, k.poly([780, 1000, 780, 300, 1000, 300], true), 14);
    person(k, 900, 1010, 480, { dir: -1, coat: { y: 0.5, r: 0.5, b: 0.6 }, legs: { b: 0.7, r: 0.5, y: 0.3 }, hair: { b: 0.4, y: 0.2 }, arms: 'up', hat: 'cap', hatC: { b: 0.8, r: 0.5 } });
    const tf = F(900, 1010, 480, -1);
    k.fill({ y: 0.6, r: 0.6, b: 0.5 }, k.rect(tf.X(22) - 4, tf.Y(116), 8, 40));
    k.fill(C.gold, k.ell(tf.X(22), tf.Y(122), 10, 18)); k.fill(C.orange, k.ell(tf.X(22), tf.Y(119), 5, 10));
    /* the count seated on a log of wood, a hand pressed to his heart */
    k.fill(C.wood, k.rect(470, 930, 220, 64));
    k.fill({ y: 0.6, r: 0.44, b: 0.3 }, k.ell(690, 962, 14, 32));
    k.addStroke({ y: 0.4, r: 0.4, b: 0.4 }, k.ell(690, 962, 8, 20), 2);
    const cf = F(570, 944, 520, 1);
    seated(k, 570, 944, 520, { dir: 1, coat: C.ink, legs: C.ink, hair: C.ink, skin: PALE, arm: 'none' });
    k.fill({ b: 1, r: 0.86, y: 0.46 }, k.blob(cf.pts([-10, 46, -12, 20, -16, 0, -10, -30, 4, -6, 6, 20, 10, 44])));
    arm(k, cf, C.ink, [6, 38, 12, 26, 3, 32], [2, 32.5], { edge: { b: 0.5 }, skin: PALE });
    k.fill(C.ink, k.ell(cf.X(4.2), cf.Y(52), 0.7 * cf.s, 0.6 * cf.s));
    k.add({ y: 0.3, r: 0.1 }, k.ell(cf.X(4), cf.Y(51), 4 * cf.s, 7 * cf.s));
  },
};

/* ── Chapter 115: Luigi Vampa's bill of fare ──────────────────────────── */
const fowl = {
  w: 1200, h: 800, seed: 59994,
  draw(k) {
    const tufa = { y: 0.56, r: 0.42, b: 0.28 };
    k.fill(tufa, k.rect(0, 0, 1200, 800));
    /* the archway, lit by the lamp */
    const lx = 820, ly = 170;
    k.cut(k.circ(lx, ly, 560), k.rad(lx, ly, 0, 560, [0, 0.9], [0.35, 0.5], [1, 0]));
    k.add({ y: k.rad(lx, ly, 0, 560, [0, 0.9], [0.5, 0.4], [1, 0.06]), r: k.rad(lx, ly, 0, 560, [0, 0.2], [1, 0.06]) }, k.circ(lx, ly, 560));
    const arch = k.P(); arch.moveTo(520, 800); arch.lineTo(520, 240); arch.arc(860, 240, 340, Math.PI, 0); arch.lineTo(1200, 800); arch.lineTo(1260, 800); arch.lineTo(1260, -40); arch.lineTo(460, -40); arch.lineTo(460, 800); arch.closePath();
    k.add({ b: 0.3, r: 0.16 }, arch);
    const cr = k.P(); for (let i = 0; i < 40; i++) { const x = k.R(470, 1200), y = k.R(0, 780); cr.moveTo(x, y); cr.lineTo(x + k.R(-10, 10), y + k.R(10, 24)); } k.addStroke({ b: 0.3, r: 0.2 }, cr, 2);
    k.stroke(C.dark, k.poly([lx, 0, lx, ly - 30], true), 2);
    k.fill(C.dark, k.poly([lx - 16, ly - 30, lx + 16, ly - 30, lx + 10, ly + 12, lx - 10, ly + 12]));
    k.fill(C.gold, k.ell(lx, ly - 6, 7, 14)); k.fill(C.orange, k.ell(lx, ly - 3, 3, 7));
    k.fill({ y: 0.5, r: 0.44, b: 0.34 }, k.rect(460, 700, 740, 100));
    /* Peppino on guard opposite the door: the pan of chick-peas and bacon, grapes, the flask of Orvieto */
    const pf = F(760, 690, 300, -1);
    seated(k, 760, 690, 300, { dir: -1, coat: { y: 0.5, r: 0.5, b: 0.6 }, legs: { b: 0.7, r: 0.3, y: 0.2 }, hair: C.ink, skin: { y: 0.46, r: 0.42, b: 0.2 }, arm: 'lap', boots: { y: 0.5, r: 0.5, b: 0.5 } });
    k.fill(C.red, k.poly(pf.pts([-9.4, 24, 9.4, 24, 9.8, 18, -9.8, 18])));
    k.fill(C.ink, k.poly(pf.pts([-9, 57, 10, 57, 6, 64, -6, 64])));
    const py = 770;
    k.fill({ y: 0.64, r: 0.62, b: 0.3 }, k.ell(pf.X(14), py + 8, 44, 15));
    k.fill({ y: 0.7, r: 0.3 }, k.ell(pf.X(14), py - 2, 36, 7));
    for (let i = 0; i < 12; i++) k.fill({ y: 0.8, r: 0.2 }, k.circ(pf.X(14) + k.R(-26, 26), py - 2 + k.R(-3, 3), 3.4));
    k.fill(C.red, k.rect(pf.X(14) - 10, py - 7, 18, 6));
    for (let i = 0; i < 3; i++) { const p = k.P(); const x = pf.X(14) + (i - 1) * 14; p.moveTo(x, py - 12); p.quadraticCurveTo(x + 9, py - 36, x, py - 60); k.cut(p, 0.4, 2.4); }
    k.fill({ y: 0.64, r: 0.5, b: 0.36 }, k.ell(pf.X(-16), py + 14, 34, 13));
    for (let i = 0; i < 18; i++) k.fill({ r: 0.72, b: 0.7, y: 0.1 }, k.circ(pf.X(-16) + k.R(-22, 22), py + 2 + k.R(-12, 4), 5.5));
    const fx = pf.X(-36);
    k.fill({ b: 0.5, y: 0.6, r: 0.2 }, k.blob([fx - 16, py + 26, fx - 18, py - 14, fx - 6, py - 30, fx - 6, py - 54, fx + 6, py - 54, fx + 6, py - 30, fx + 18, py - 14, fx + 16, py + 26]));
    k.cut(k.rect(fx - 10, py - 16, 4, 34), 0.5);
    /* the handsome young man with the fowl in a silver dish on his head, hands free */
    const yf = F(1060, 792, 420, -1);
    person(k, 1060, 792, 420, { dir: -1, coat: { y: 0.5, r: 0.46, b: 0.2 }, legs: { y: 0.5, r: 0.46, b: 0.2 }, skin: { y: 0.46, r: 0.42, b: 0.2 }, sleeve: { y: 0.46, r: 0.42, b: 0.2 }, hair: C.ink, arms: 'wave2' });
    k.fill({ y: 0.46, r: 0.42, b: 0.2 }, k.poly(yf.pts([-10, 82, 10, 82, 10.5, 58, -10.5, 58])));
    k.fill(C.cream, k.poly(yf.pts([-11, 58, 11, 58, 12, 34, -12, 34])));
    k.fill(C.red, k.poly(yf.pts([-11, 60, 11, 60, 11, 55, -11, 55])));
    k.fill({ b: 0.3, y: 0.08 }, k.ell(yf.X(0), yf.Y(101.5), 22 * yf.s, 2.6 * yf.s));
    k.cut(k.ell(yf.X(-4), yf.Y(102), 12 * yf.s, 1 * yf.s), 0.7);
    k.fill({ y: 0.8, r: 0.46, b: 0.12 }, k.blob(yf.pts([-12, 103, -10, 110, 0, 114, 10, 111, 13, 104])));
    k.cut(k.ell(yf.X(-3), yf.Y(109), 4 * yf.s, 1.5 * yf.s), 0.5);
    /* the whitewashed cell: the worm-eaten table, the stool, the goat-skin bed, the door of ill-joined planks */
    k.fill({ b: 0.14, y: 0.08 }, k.rect(0, 0, 470, 800));
    k.add({ b: k.lin(0, 0, 470, 0, [0, 0.3], [1, 0.05]), r: k.lin(0, 0, 470, 0, [0, 0.1], [1, 0]) }, k.rect(0, 0, 470, 800));
    const plank = { y: 0.6, r: 0.54, b: 0.46 };
    k.fill({ b: 0.5, r: 0.36, y: 0.3 }, k.rect(440, 150, 40, 650));
    k.fill(plank, k.poly([470, 150, 560, 110, 560, 800, 470, 800]));
    const pk = k.P(); for (const x of [490, 512, 536]) { pk.moveTo(x, 146 - (x - 470) * 0.44); pk.lineTo(x, 800); } k.cut(pk, 0.6, 2.4);
    k.fill({ y: 0.66, r: 0.44, b: 0.2 }, k.blob([30, 760, 20, 700, 120, 690, 250, 700, 260, 760]));
    for (let i = 0; i < 40; i++) { const x = k.R(40, 250), y = k.R(700, 750); k.addStroke({ y: 0.4, r: 0.4, b: 0.3 }, k.poly([x, y, x + k.R(-6, 6), y + 8], true), 1.4); }
    const wt = { y: 0.54, r: 0.5, b: 0.44 };
    k.fill(wt, k.rect(110, 590, 240, 20)); k.fill(wt, k.rect(126, 610, 16, 180)); k.fill(wt, k.rect(318, 610, 16, 180));
    for (let i = 0; i < 18; i++) k.fill(C.dark, k.circ(k.R(120, 340), k.R(592, 606), 1.5));
    /* Danglars, hungry, in his blue coat and white waistcoat, the red ribbon still fresh */
    const df = F(300, 792, 380, 1);
    const blue = { b: 0.84, r: 0.2 };
    person(k, 300, 792, 380, { dir: 1, coat: blue, legs: { y: 0.5, r: 0.5, b: 0.56 }, shirt: C.cream, hair: C.ink, buttons: { b: 0.7, r: 0.24 }, arms: 'none', lean: 2 });
    k.fill(C.cream, k.poly(df.pts([-4, 80, 6, 80, 5, 58, -3, 58])));
    k.stroke(C.gold, k.poly(df.pts([-2, 66, 3, 63, 6, 66]), true), 0.6 * df.s);
    k.fill(C.red, k.rect(df.X(-7.5), df.Y(76), 3 * df.s, 1.6 * df.s));
    arm(k, df, blue, [10, 79, 20, 66, 26, 72], [27, 72.6], { edge: C.ink });
    arm(k, df, blue, [-6, 79, 6, 64, 22, 68], [23.4, 68.4], { edge: C.ink });
    k.fill(C.ink, k.ell(df.X(5), df.Y(92), 0.7 * df.s, 0.6 * df.s));
  },
};

/* ── Chapter 116: at the stream, at dawn ──────────────────────────────── */
const stream = {
  w: 1200, h: 800, seed: 60312,
  draw(k) {
    sky(k, 0, 440, [[0, { b: 0.4 }], [0.55, { b: 0.12, y: 0.18, r: 0.06 }], [1, { y: 0.66, r: 0.3 }]]);
    stars(k, 30, 0, 0, 1200, 120, 1.3);
    k.cut(k.circ(860, 440, 300), k.rad(860, 440, 30, 300, [0, 0.6], [1, 0]));
    k.clip(k.rect(0, 0, 1200, 440), () => disc(k, 860, 446, 34, { y: 0.9, r: 0.4 }, 0));
    /* the hills of the Campagna, and an aqueduct far off (ours) */
    k.fill({ b: 0.3, r: 0.14, y: 0.12 }, k.blob([-40, 440, -40, 360, 200, 330, 420, 350, 640, 320, 900, 360, 1240, 330, 1240, 440]));
    const aq = { b: 0.4, r: 0.24, y: 0.3 };
    k.fill(aq, k.rect(80, 372, 520, 20));
    for (let x = 90; x < 600; x += 44) { k.fill(aq, k.rect(x, 392, 12, 40)); }
    k.fill({ y: 0.5, b: 0.34, r: 0.12 }, k.blob([-40, 470, -40, 420, 300, 410, 700, 430, 1240, 414, 1240, 470]));
    /* the road and the post-chaise Vampa pointed to */
    k.fill({ y: 0.56, b: 0.42, r: 0.16 }, k.rect(0, 460, 1200, 180));
    const road = k.poly([0, 520, 1200, 480, 1200, 500, 0, 552]);
    k.cut(road, 0.6); k.add({ y: 0.3, r: 0.1 }, road);
    k.add({ b: 0.3 }, k.ell(1000, 500, 60, 5));
    carriage(k, 1000, 498, 80, { dir: -1, body: { y: 0.6, r: 0.6, b: 0.3 } });
    horse(k, 930, 498, 34, { dir: -1, coat: { y: 0.4, r: 0.5, b: 0.5 } });
    /* the tree he leaned against all night */
    const bark = { b: 0.8, r: 0.6, y: 0.5 };
    k.fill(bark, k.poly([150, 560, 164, 300, 180, 200, 196, 300, 206, 560]));
    const br = k.P(); for (const [x1, y1] of [[80, 140], [280, 120], [120, 230], [270, 250], [178, 60]]) { br.moveTo(180, 300); br.quadraticCurveTo((180 + x1) / 2, 240, x1, y1); }
    k.stroke(bark, br, 7);
    for (let i = 0; i < 50; i++) { const x = k.R(60, 300), y = k.R(40, 260), r = k.R(14, 30); k.fill({ b: 0.7, y: 0.6, r: 0.3 }, k.ell(x, y, r, r * 0.6)); }
    /* the stream */
    const w = k.poly([0, 620, 1200, 590, 1200, 800, 0, 800]);
    sky(k, 610, 800, [[0, { y: 0.5, r: 0.22, b: 0.1 }], [1, { b: 0.6, r: 0.16 }]]);
    k.fill({ y: 0.5, b: 0.42, r: 0.2 }, k.poly([0, 560, 1200, 530, 1200, 596, 0, 626]));
    lightPath(k, 860, 610, 800, 40, 0.7);
    k.add({ b: 0.2 }, w);
    /* Danglars stooping to drink, and in the water his hair entirely white */
    const df = F(470, 624, 290, 1);
    const coat = { b: 0.8, r: 0.3, y: 0.2 };
    k.fill({ y: 0.5, r: 0.5, b: 0.56 }, k.poly(df.pts([-40, 0, -8, 0, -6, 12, -30, 20])));
    k.fill(coat, k.blob(df.pts([-38, 16, -30, 40, 0, 44, 22, 34, 26, 22, 0, 14])));
    k.fill(C.red, k.rect(df.X(8), df.Y(36), 2.6 * df.s, 1.6 * df.s));
    arm(k, df, coat, [14, 36, 22, 18, 28, 2], [29, 1], { edge: C.ink });
    arm(k, df, coat, [8, 34, 14, 14, 18, 0], [18.6, -0.4], { edge: C.ink });
    k.fill(C.skin, k.ell(df.X(30), df.Y(30), 6.4 * df.s, 7 * df.s));
    const white = k.blob(df.pts([24, 30, 23, 38, 30, 40, 37, 36, 37.5, 28, 33, 33, 28, 34]));
    k.cut(white, 1); k.fill({ y: 0.04 }, white);
    /* his reflection */
    const ry = 624 + 8;
    k.add({ b: 0.3, r: 0.16 }, k.ell(df.X(30), ry + 30 * df.s * 0.6, 7 * df.s, 7 * df.s));
    const rw = k.blob(df.pts([24, -12, 23, -20, 30, -23, 37, -20, 37.5, -12]).map((v, i) => (i % 2 ? v + 8 : v)));
    k.cut(rw, 0.85);
    waves(k, { y0: 630, y1: 790, rows: 10, len: 60, amp: 1.6, lw: 1.6, cut: true, amount: 0.35, dens: 0.4 });
    gull(k, 700, 200, 9, C.navy);
  },
};

/* ── Chapter 117: the letter, at daybreak ─────────────────────────────── */
const dawnletter = {
  w: 1000, h: 1250, seed: 60577,
  draw(k) {
    sky(k, 0, 560, [[0, { b: 0.66 }], [0.6, { b: 0.3, y: 0.06 }], [1, { y: 0.4, r: 0.16 }]]);
    stars(k, 22, 0, 0, 1000, 200, 1.8);
    sparkle(k, 760, 90, 9, 0.95); sparkle(k, 190, 140, 7, 0.9);
    sea(k, 560, 900, { top: { b: 0.4, y: 0.14 }, bottom: { b: 0.8, r: 0.12 }, rows: 12, glints: 8 });
    /* the rocks of the island, the grotto door open, and Jacopo waiting among them */
    rock(k, [-40, 900, -40, 480, 60, 420, 170, 450, 250, 540, 300, 700, 330, 900], { y: 0.5, r: 0.36, b: 0.4 }, { shadow: { b: 0.3, r: 0.1 }, facets: 12 });
    const door = k.P(); door.moveTo(80, 640); door.lineTo(80, 530); door.quadraticCurveTo(125, 470, 170, 530); door.lineTo(170, 640); door.closePath();
    k.fill(C.dark, door);
    k.add({ y: 0.4, r: 0.1 }, k.poly([90, 640, 160, 640, 150, 560, 100, 560]));
    rock(k, [700, 900, 740, 660, 820, 590, 920, 560, 1040, 600, 1040, 900], { y: 0.44, r: 0.34, b: 0.44 }, { shadow: { b: 0.3, r: 0.1 }, facets: 10, light: 1 });
    person(k, 850, 600, 150, { dir: -1, coat: { b: 0.6, y: 0.2 }, legs: C.cream, stripes: C.blue, hair: C.ink, hat: 'cap', hatC: C.red, arms: 'down' });
    /* the letter, held open */
    const lx0 = 150, ly0 = 690, lw = 700, lh = 520;
    k.add({ b: 0.4, r: 0.2 }, k.rect(lx0 + 14, ly0 + 16, lw, lh));
    const sheet = k.rect(lx0, ly0, lw, lh);
    k.cut(sheet, 1);
    k.fill({ y: 0.12, r: 0.03 }, sheet);
    k.add({ b: k.lin(lx0, 0, lx0 + lw, 0, [0, 0], [0.8, 0], [1, 0.14]) }, sheet);
    const fold = k.P(); fold.moveTo(lx0, ly0 + lh / 2); fold.lineTo(lx0 + lw, ly0 + lh / 2); k.addStroke({ b: 0.14 }, fold, 2);
    const inkC = { b: 0.92, r: 0.4 };
    const lines = ['Live, then, and be happy, beloved children of', 'my heart, and never forget that until the day', 'when God shall deign to reveal the future to', 'man, all human wisdom is summed up in these', 'two words,'];
    lines.forEach((t, i) => k.text(inkC, t, lx0 + 44, ly0 + 64 + i * 42, 'italic 29px Georgia, serif', 'left'));
    k.text(C.red, 'Wait and hope.', lx0 + lw / 2, ly0 + 334, 'italic 700 68px Georgia, serif', 'center');
    k.addStroke(C.red, k.poly([lx0 + 170, ly0 + 352, lx0 + lw - 170, ly0 + 348], true), 3);
    k.text(inkC, 'Your friend,', lx0 + lw - 60, ly0 + 410, 'italic 29px Georgia, serif', 'right');
    k.text(inkC, 'Edmond Dantès, Count of Monte Cristo.', lx0 + lw - 60, ly0 + 452, 'italic 29px Georgia, serif', 'right');
    /* Morrel's hands at the edges of the sheet, Valentine's hand on his arm */
    const sleeve = { b: 0.9, r: 0.4, y: 0.08 };
    k.fill(sleeve, k.poly([60, 1250, 100, 1100, 170, 1060, 190, 1120, 150, 1250]));
    k.fill(C.skin, k.blob([140, 1060, 170, 1030, 196, 1040, 200, 1090, 176, 1110]));
    k.fill(sleeve, k.poly([940, 1250, 900, 1100, 830, 1060, 810, 1120, 850, 1250]));
    k.fill(C.skin, k.blob([860, 1060, 830, 1030, 804, 1040, 800, 1090, 824, 1110]));
  },
};

/* ── Chapter 117: the white sail ──────────────────────────────────────── */
const sail = {
  w: 1400, h: 700, seed: 61150,
  draw(k) {
    sky(k, 0, 400, [[0, { b: 0.6 }], [0.5, { b: 0.26, y: 0.06 }], [0.85, { y: 0.44, r: 0.14 }], [1, { y: 0.7, r: 0.28 }]]);
    stars(k, 30, 0, 0, 1400, 130, 1.6);
    sparkle(k, 1180, 70, 8, 0.9);
    cloud(k, { y: 0.24, r: 0.12 }, 80, 300, 500, 12, 6);
    /* the sun just up */
    k.cut(k.circ(300, 400, 260), k.rad(300, 400, 20, 260, [0, 0.6], [1, 0]));
    k.clip(k.rect(0, 0, 1400, 400), () => disc(k, 300, 404, 40, { y: 0.92, r: 0.3 }, 0));
    sea(k, 400, 700, { top: { b: 0.52, y: 0.06 }, bottom: { b: 0.9, r: 0.2 }, rows: 18, glints: 12 });
    lightPath(k, 300, 404, 700, 60, 0.8);
    /* on the blue line between the sky and the sea, a large white sail */
    const sx = 990, sy = 401;
    k.cut(k.circ(sx, sy - 30, 90), k.rad(sx, sy - 30, 0, 90, [0, 0.5], [1, 0]));
    k.fill({ b: 0.9, r: 0.4 }, k.ell(sx, sy, 34, 4));
    k.stroke({ b: 0.9, r: 0.4 }, k.poly([sx, sy, sx - 2, sy - 76], true), 2);
    const s1 = k.poly([sx - 2, sy - 76, sx - 2, sy - 4, sx + 40, sy - 6]);
    const s2 = k.poly([sx - 4, sy - 70, sx - 4, sy - 6, sx - 34, sy - 8]);
    k.cut(s1, 1); k.cut(s2, 1);
    k.add({ b: 0.14 }, s2);
    k.cut(k.ell(sx, sy + 3, 30, 2), 0.6);
    /* the rocks of Monte Cristo, Jacopo pointing, Maximilian and Valentine */
    rock(k, [-40, 700, -40, 560, 100, 520, 300, 560, 520, 600, 760, 640, 880, 700], { y: 0.46, r: 0.34, b: 0.42 }, { shadow: { b: 0.3, r: 0.12 }, facets: 14 });
    rock(k, [1060, 700, 1120, 600, 1240, 540, 1340, 530, 1440, 560, 1440, 700], { y: 0.4, r: 0.34, b: 0.46 }, { shadow: { b: 0.3, r: 0.12 }, facets: 10, light: 1 });
    k.add({ y: 0.3, r: 0.1 }, k.poly([100, 520, 300, 560, 520, 600, 760, 640, 740, 652, 500, 612, 280, 572, 100, 534]));
    person(k, 1250, 548, 170, { dir: -1, coat: { b: 0.6, y: 0.2 }, legs: C.cream, stripes: C.blue, hair: C.ink, hat: 'cap', hatC: C.red, arms: 'point' });
    person(k, 560, 612, 200, { dir: 1, coat: { b: 0.95, r: 0.46, y: 0.1 }, legs: { b: 0.95, r: 0.46, y: 0.1 }, hair: C.ink, arms: 'down' });
    lady(k, 610, 616, 186, { dir: 1, dress: { y: 0.1, b: 0.06 }, sleeve: { y: 0.1, b: 0.06 }, hair: { y: 0.66, r: 0.64, b: 0.5 }, shade: { b: 0.18 }, arms: 'down' });
    gull(k, 760, 230, 10, C.navy); gull(k, 800, 250, 7, C.navy); gull(k, 1100, 300, 6, C.navy);
  },
};

export const SCENES = { eugenie, roofs, apparition, lachaise, assizes, villejuif, garden, ifsunset, cell, fowl, stream, dawnletter, sail };
