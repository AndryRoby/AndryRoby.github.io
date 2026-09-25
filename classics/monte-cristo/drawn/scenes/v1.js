/* Scenes from volume one (chapters 1 to 27).
 * Each scene: { w, h, seed, draw(k) } in its own units. The page decides the
 * print size; w:h must match the plate shape in index.html
 * (pano 1400x700, wide 1200x800, tall 1000x1250).
 * Descriptions of places, clothes and light follow the text of the novel
 * (Project Gutenberg #1184); line numbers are in README.md. */
import { C, person, seated, crowd, gull, cloud, stonework, stars, sparkle, waves } from '../parts.js';
import { sky, disc, sea, lightPath, ship, tartan, boat, sitter } from '../sea.js';
import { rock, tower, wall, crenels, chateauIf, houses, candle, table, bottle, glass, lantern } from '../arch.js';

const NIGHT = { b: 0.95, r: 0.5, y: 0.08 };

/* ── Chapter 1: the Pharaon comes into Marseilles ─────────────────────── */
const arrival = {
  w: 1400, h: 700, seed: 1815,
  draw(k) {
    sky(k, 0, 440, [[0, { b: 0.46, r: 0.06 }], [0.5, { b: 0.2, y: 0.16, r: 0.04 }], [1, { y: 0.55, r: 0.2 }]]);
    disc(k, 470, 262, 44, { y: 0.92, r: 0.3 }, 3.4);
    cloud(k, { r: 0.16, y: 0.24 }, 640, 118, 380, 34, 9);
    cloud(k, { r: 0.12, y: 0.2, b: 0.05 }, 180, 70, 300, 26, 7);
    cloud(k, { b: 0.12, r: 0.08 }, 980, 150, 300, 24, 7);
    /* the islands of the roads, far and pale */
    k.fill({ b: 0.3, r: 0.12, y: 0.06 }, k.blob([640, 442, 700, 424, 780, 418, 860, 428, 900, 442]));
    k.fill({ b: 0.3, r: 0.12, y: 0.06 }, k.blob([920, 442, 950, 428, 1010, 424, 1050, 432, 1070, 442]));
    chateauIf(k, 996, 432, 0.085, { stone: { b: 0.42, r: 0.16, y: 0.08 }, rock: { b: 0.36, r: 0.14, y: 0.06 }, shade: { b: 0.12 }, rockShade: { b: 0.1 }, crack: { b: 0.3 } });
    /* Notre-Dame de la Garde on its hill, where the look-out stood */
    const hill = k.blob([1040, 442, 1100, 380, 1180, 300, 1250, 262, 1320, 250, 1400, 280, 1400, 442]);
    k.fill({ b: 0.34, y: 0.34, r: 0.16 }, hill);
    k.clip(hill, () => {
      k.add({ b: 0.3, r: 0.1 }, k.poly([1290, 250, 1400, 250, 1400, 442, 1230, 442]));
      houses(k, 1060, 1400, 446, { hmin: 18, hmax: 40, wmin: 16, wmax: 30, row: 12, shutters: false, win: { b: 0.4, r: 0.2 }, cols: [{ y: 0.36, r: 0.18, b: 0.06 }, { y: 0.24, r: 0.12 }, C.pale] });
    });
    k.fill({ y: 0.34, r: 0.2, b: 0.2 }, k.rect(1296, 214, 50, 40));
    k.add({ b: 0.26 }, k.rect(1324, 214, 22, 40));
    k.fill({ y: 0.34, r: 0.2, b: 0.2 }, k.rect(1310, 180, 20, 36));
    k.fill({ y: 0.34, r: 0.2, b: 0.2 }, k.poly([1306, 182, 1334, 182, 1320, 166]));
    k.stroke(C.dark, k.poly([1320, 166, 1320, 150], true), 2);
    k.fill(C.red, k.poly([1320, 150, 1338, 154, 1320, 158]));
    /* the sea of the roads */
    sea(k, 440, 700, { top: { b: 0.3, y: 0.24, r: 0.04 }, bottom: { b: 0.78, r: 0.2 }, rows: 20, glints: 12, swellSpec: { b: 0.3 } });
    lightPath(k, 470, 444, 700, 80, 0.8);
    /* the Pharaon under topsails, jib and spanker, and her reflection */
    k.add({ b: 0.38, r: 0.16 }, k.poly([640, 600, 1120, 600, 1100, 640, 670, 640]));
    const sh = ship(k, 880, 596, 440, { dir: -1, sails: 'topsails', sail: { y: 0.16, r: 0.04 }, flag: C.red, band: { y: 0.5, r: 0.18 } });
    person(k, sh.X(12), sh.Y(8), 30, { coat: C.blue, arms: 'hat', hatC: C.ink, hair: C.ink });
    person(k, sh.X(-36), sh.Y(10), 28, { coat: C.dark, hat: 'cap', hatC: C.red });
    /* Morrel's skiff pulling alongside */
    k.add({ b: 0.3 }, k.ell(590, 648, 70, 7));
    boat(k, 590, 642, 110, { dir: 1, band: { y: 0.4, r: 0.2 } });
    sitter(k, 562, 636, 40, C.navy, { oar: 34, hat: 'cap', hatC: C.red });
    sitter(k, 612, 636, 44, C.dark, { hat: 'round' });
    /* Fort Saint-Jean with its ramparts covered with spectators */
    const warm = { y: 0.46, r: 0.2, b: 0.1 };
    wall(k, 170, 700, 420, 176, warm, { m: 10, crenels: false });
    stonework(k, 170, 524, 420, 176, 19, { y: 0.1, r: 0.05, b: 0.06 });
    k.add({ b: 0.22, r: 0.08 }, k.rect(170, 524, 420, 30));
    crowd(k, 250, 586, 524, 50, [C.navy, C.red, C.blue, C.cream, C.dark, C.gold, { r: 0.6, b: 0.4 }], { step: 0.34 });
    crowd(k, 236, 594, 540, 58, [C.navy, C.red, C.dark, C.blue, { y: 0.6, r: 0.5 }], { step: 0.36 });
    tower(k, 150, 700, 210, 380, warm, { shade: { b: 0.34, r: 0.16 }, slits: 3 });
    tower(k, 150, 320, 82, 84, warm, { shade: { b: 0.34, r: 0.16 }, slits: 1 });
    k.fill(C.dark, k.rect(146, 210, 8, 26));
    stonework(k, 45, 330, 210, 370, 22, { y: 0.06, r: 0.03, b: 0.05 }, { mortar: 0.25 });
    gull(k, 640, 196, 13, C.navy); gull(k, 690, 222, 9, C.navy); gull(k, 1180, 150, 11, C.navy); gull(k, 1220, 170, 7, C.navy);
  },
};

/* ── Chapter 3: Mercédès in the Catalan village ───────────────────────── */
function mercedes(k, x, y, h) {
  const s = h / 100;
  const X = (dx) => x + dx * s, Y = (dy) => y - dy * s;
  const P = (arr) => { const o = []; for (let i = 0; i < arr.length; i += 2) o.push(X(arr[i]), Y(arr[i + 1])); return o; };
  const skin = { y: 0.5, r: 0.42, b: 0.14 };
  /* legs in red stockings, one foot lifted to tap the floor */
  k.fill(C.red, k.poly(P([-6, 26, 0, 26, -1, 2, -6, 2])));
  k.fill(C.red, k.poly(P([2, 26, 8, 26, 12, 6, 7, 5])));
  const clocks = k.P();
  for (const [a, b] of [[-3.4, 22], [-3.6, 12], [5.6, 22], [8.6, 14]]) { clocks.moveTo(X(a), Y(b)); clocks.lineTo(X(a + 0.3), Y(b - 5)); }
  k.addStroke({ b: 0.7 }, clocks, 0.8 * s);
  k.fill(C.dark, k.poly(P([-7, 3, 1, 3, 1.5, 0, -8, 0])));
  k.fill(C.dark, k.poly(P([7, 7, 13, 6, 15, 2, 8, 3])));
  /* skirt and bodice */
  k.fill({ b: 0.72, r: 0.32, y: 0.06 }, k.blob(P([-9, 62, 8, 62, 13, 40, 17, 24, 2, 22, -15, 24, -12, 42])));
  k.add({ b: 0.2 }, k.poly(P([2, 62, 8, 62, 17, 24, 6, 22])));
  const hem = k.P(); hem.moveTo(X(-15), Y(25)); hem.quadraticCurveTo(X(0), Y(21), X(17), Y(25));
  k.stroke(C.gold, hem, 1.6 * s);
  k.fill(C.cream, k.poly(P([-8, 84, 8, 84, 8.5, 60, -8.5, 60])));
  k.fill(C.red, k.poly(P([-8.5, 72, 8.5, 72, 8.5, 60, -8.5, 60])));
  /* a kerchief crossed on the breast */
  k.fill(C.gold, k.poly(P([-8.5, 84, 8.5, 84, 0, 76.5])));
  k.add({ r: 0.35 }, k.poly(P([-8.5, 84, 0, 84, 0, 76.5])));
  /* arms bare to the elbow, hands together at the waist, picking heath */
  k.stroke(C.cream, k.poly(P([-8, 80, -11, 70]), true), 4.6 * s);
  k.stroke(skin, k.poly(P([-11, 70, -6, 62, 1, 64]), true), 3.6 * s);
  k.stroke(C.cream, k.poly(P([8, 80, 11, 70]), true), 4.6 * s);
  k.stroke(skin, k.poly(P([11, 70, 6, 63, 1, 64]), true), 3.6 * s);
  k.fill(skin, k.circ(X(1), Y(64.4), 2.4 * s));
  /* heath in her fingers */
  for (let i = 0; i < 9; i++) k.fill(k.pick([C.rose, C.plum, C.red]), k.circ(X(1 + k.R(-3, 3)), Y(66 + k.R(-2, 4)), k.R(0.6, 1.1) * s));
  k.stroke(C.leaf, k.poly(P([1, 64, 3, 70]), true), 0.6 * s);
  /* head turned a little, hair as black as jet */
  k.fill(skin, k.rect(X(-2), Y(89), 4 * s, 6 * s));
  k.fill(skin, k.ell(X(0.6), Y(93.5), 6.2 * s, 7.6 * s));
  k.fill(C.ink, k.blob(P([-7, 92, -6.6, 99, -1, 102, 5, 101, 7.6, 96, 6.4, 94, 2, 97, -3, 96, -5, 90])));
  k.fill(C.ink, k.ell(X(-6.5), Y(96), 3.8 * s, 3.4 * s));
  k.fill(C.red, k.circ(X(-4), Y(99.5), 1.1 * s));
  k.fill(C.ink, k.ell(X(2.6), Y(94), 0.7 * s, 0.5 * s));
}

const catalans = {
  w: 1000, h: 1250, seed: 1003,
  draw(k) {
    /* whitewashed room, warm with the reflected sun */
    k.fill({ y: k.lin(0, 0, 0, 800, [0, 0.12], [1, 0.05]), r: 0.02 }, k.rect(0, 0, 1000, 800));
    /* the only street outside, through the door: sun, dead-leaf walls, sea */
    const door = k.rect(90, 250, 290, 590);
    k.clip(door, () => {
      sky(k, 250, 560, [[0, { b: 0.42 }], [1, { b: 0.12, y: 0.2 }]], 90, 380);
      k.fill({ b: 0.62, r: 0.1 }, k.rect(90, 556, 290, 40));
      waves(k, { y0: 560, y1: 594, rows: 4, len: 30, amp: 1.5, lw: 1.4, cut: true, amount: 0.6, x0: 90, x1: 380 });
      tartan(k, 250, 566, 70, { dir: -1, band: C.red, sail: C.cream });
      k.fill({ y: 0.7, r: 0.48, b: 0.16 }, k.rect(90, 420, 90, 180));
      k.fill({ r: 0.55, y: 0.55, b: 0.2 }, k.poly([84, 420, 186, 420, 176, 404, 94, 404]));
      k.fill(C.dark, k.rect(118, 470, 26, 44));
      k.fill({ y: 0.6, r: 0.4, b: 0.1 }, k.rect(300, 470, 90, 130));
      k.fill({ y: 0.48, r: 0.12 }, k.rect(90, 596, 290, 260));
      k.add({ b: 0.18, r: 0.1 }, k.poly([90, 700, 380, 640, 380, 860, 90, 860]));
    });
    /* door frame, the door leaf swung open against the wall */
    const wood = { y: 0.55, r: 0.42, b: 0.34 };
    k.fill(wood, k.rect(72, 232, 18, 612)); k.fill(wood, k.rect(380, 232, 18, 612)); k.fill(wood, k.rect(72, 226, 326, 22));
    k.fill({ y: 0.5, r: 0.38, b: 0.5 }, k.poly([72, 246, 30, 226, 30, 876, 72, 842]));
    /* wainscot and tiled floor */
    k.fill(wood, k.rect(398, 700, 602, 150));
    k.fill(wood, k.rect(0, 700, 30, 150));
    const boards = k.P(); for (let x = 420; x < 1000; x += 46) { boards.moveTo(x, 704); boards.lineTo(x, 846); }
    k.addStroke({ b: 0.35, r: 0.2 }, boards, 2.2);
    k.fill({ y: 0.62, r: 0.5, b: 0.3 }, k.rect(398, 694, 602, 12));
    k.fill({ r: 0.5, y: 0.56, b: 0.14 }, k.rect(0, 846, 1000, 404));
    const tiles = k.P();
    for (let i = -12; i <= 12; i++) { tiles.moveTo(500 + i * 40, 846); tiles.lineTo(500 + i * 150, 1250); }
    for (let y = 870, g = 26; y < 1250; y += g, g *= 1.22) { tiles.moveTo(0, y); tiles.lineTo(1000, y); }
    k.addStroke({ b: 0.3, r: 0.12 }, tiles, 2);
    /* the sun lying through the door across the floor */
    const patch = k.poly([90, 846, 380, 846, 700, 1250, 150, 1250]);
    k.cut(patch, 0.35);
    k.add({ y: 0.32 }, patch);
    /* heath blossoms strewn on the floor */
    for (let i = 0; i < 70; i++) {
      const x = k.R(520, 820), y = k.R(990, 1180);
      k.fill(k.pick([C.rose, C.plum, { r: 0.7, b: 0.2 }]), k.circ(x, y, k.R(2.4, 4.6)));
    }
    for (let i = 0; i < 14; i++) k.fill(k.pick([C.rose, C.plum]), k.circ(k.R(610, 700), k.R(700, 980), k.R(2, 3.6)));
    /* Fernand on a chair balanced on two legs, elbow on an old table */
    const tw = { y: 0.46, r: 0.36, b: 0.4 };
    table(k, 150, 880, 190, 180, tw, { legs: tw });
    k.fill(tw, k.rect(150, 880, 190, 16));
    bottle(k, 196, 880, 70, C.leaf);
    const cx = 330, cy = 1010;
    k.stroke(C.dwood, k.poly([cx - 10, cy - 150, cx + 26, cy + 16, cx + 40, cy + 124], true), 9);
    k.stroke(C.dwood, k.poly([cx + 96, cy + 4, cx + 116, cy + 128], true), 9);
    k.stroke(C.dwood, k.poly([cx + 18, cy + 8, cx + 104, cy - 6], true), 12);
    seated(k, cx + 60, cy, 330, { dir: -1, coat: { b: 0.6, y: 0.3, r: 0.1 }, legs: { b: 0.8, r: 0.4 }, arm: 'table', lean: -8, hair: C.ink, boots: C.dark });
    const hx = cx + 60 + 7.2 * 3.3, hy = cy - 51 * 3.3;
    k.fill({ r: 0.86, y: 0.1 }, k.blob([hx - 22, hy - 12, hx - 18, hy - 30, hx + 4, hy - 36, hx + 26, hy - 28, hx + 44, hy - 14, hx + 40, hy - 6, hx + 22, hy - 16, hx, hy - 16]));
    k.fill({ y: 0.8, r: 0.2 }, k.rect(cx + 32, cy - 76, 56, 12));
    /* Mercédès leaning with her back against the wainscot */
    k.add({ b: 0.2, r: 0.1 }, k.ell(700, 1082, 110, 14));
    mercedes(k, 690, 1080, 620);
    /* falling heath */
    for (let i = 0; i < 10; i++) k.fill(C.rose, k.circ(k.R(660, 740), k.R(740, 980), k.R(2, 3.4)));
  },
};

/* ── Chapter 4: the arbour of La Réserve ──────────────────────────────── */
const conspiracy = {
  w: 1200, h: 800, seed: 1469,
  draw(k) {
    sky(k, 0, 470, [[0, { r: 0.28, b: 0.3 }], [0.6, { r: 0.28, y: 0.3 }], [1, { y: 0.62, r: 0.3 }]]);
    disc(k, 860, 400, 38, { y: 0.9, r: 0.45 }, 2.8);
    k.fill({ b: 0.55, r: 0.22 }, k.rect(0, 440, 1200, 40));
    lightPath(k, 860, 444, 480, 40, 0.7);
    k.fill({ b: 0.4, r: 0.28, y: 0.2 }, k.blob([0, 450, 120, 430, 260, 436, 330, 452, 0, 460]));
    /* gravel under the arbour */
    k.fill({ y: 0.36, r: 0.2, b: 0.12 }, k.rect(0, 470, 1200, 330));
    for (let i = 0; i < 380; i++) k.add({ b: 0.3, r: 0.1 }, k.circ(k.R(0, 1200), k.R(480, 800), k.R(1, 2.6)));
    /* posts and trellis */
    const wood = { y: 0.5, r: 0.46, b: 0.52 };
    for (const x of [40, 1130]) k.fill(wood, k.rect(x, 60, 30, 740));
    k.fill(wood, k.rect(0, 60, 1200, 22));
    const lat = k.P();
    for (let x = -400; x < 1600; x += 70) { lat.moveTo(x, 82); lat.lineTo(x + 300, 400); lat.moveTo(x + 300, 82); lat.lineTo(x, 400); }
    k.clip(k.rect(0, 82, 1200, 250), () => k.addStroke(wood, lat, 4));
    /* vine: clusters of leaves along the top and down the posts */
    const leaf = (x, y, r) => {
      const p = k.blob([x, y - r, x + r * 0.9, y - r * 0.2, x + r * 0.5, y + r * 0.8, x - r * 0.5, y + r * 0.8, x - r * 0.9, y - r * 0.2]);
      k.fill(k.pick([C.leaf, C.green, { y: 0.8, b: 0.4, r: 0.1 }, { b: 0.7, y: 0.6, r: 0.35 }]), p);
    };
    for (let i = 0; i < 260; i++) leaf(k.R(-20, 1220), k.R(40, 200) + (k.rnd() < 0.3 ? k.R(0, 120) : 0), k.R(14, 30));
    for (let i = 0; i < 70; i++) leaf(k.R(10, 110), k.R(180, 700), k.R(12, 24));
    for (let i = 0; i < 70; i++) leaf(k.R(1090, 1200), k.R(180, 700), k.R(12, 24));
    for (let i = 0; i < 9; i++) { const x = k.R(200, 1000), y = k.R(170, 230); for (let j = 0; j < 7; j++) k.fill(C.plum, k.circ(x + k.R(-8, 8), y + j * 5 + k.R(-3, 3), 5)); }
    /* evening light falling through the leaves on the gravel */
    for (let i = 0; i < 26; i++) { const x = k.R(100, 1100), y = k.R(640, 790); k.cut(k.ell(x, y, k.R(14, 40), k.R(4, 9)), 0.55); k.add({ y: 0.3 }, k.ell(x, y, k.R(10, 30), k.R(3, 7))); }
    /* the table: cloth, bottles, glasses, pen, ink and paper */
    table(k, 300, 520, 600, 260, { y: 0.5, r: 0.46, b: 0.52 }, { cloth: C.cream });
    k.fill(C.cream, k.rect(290, 512, 620, 16));
    k.add({ b: 0.14, r: 0.04 }, k.poly([290, 528, 910, 528, 918, 636, 282, 636]));
    bottle(k, 360, 516, 110, C.leaf);
    bottle(k, 410, 516, 96, { r: 0.8, b: 0.55 });
    glass(k, 460, 516, 36, { r: 0.55, b: 0.3 });
    glass(k, 836, 516, 36, { r: 0.4, b: 0.2 });
    k.fill(C.dark, k.rect(640, 494, 30, 22));
    k.fill(C.ink, k.ell(655, 494, 15, 5));
    /* the sheet: the denunciation written with the left hand */
    k.cut(k.poly([540, 518, 664, 510, 676, 524, 548, 532]), 1);
    const lines = k.P(); for (let i = 0; i < 5; i++) { lines.moveTo(556 + i * 2, 518 + i * 2.4); lines.lineTo(640 + i * 2, 514 + i * 2.4); }
    k.addStroke({ b: 0.8 }, lines, 0.9);
    /* Danglars at the table, pen in his left hand */
    seated(k, 740, 580, 300, { dir: -1, coat: C.dark, legs: C.dark, arm: 'table', hair: C.ink, boots: C.ink });
    k.stroke(C.ink, k.poly([652, 506, 628, 468], true), 2.4);
    k.fill(C.cream, k.poly([725, 440, 736, 440, 732, 420, 728, 420]));
    /* Fernand leaning over, reading in an undertone */
    person(k, 470, 700, 350, { dir: 1, lean: 9, coat: { b: 0.62, y: 0.32, r: 0.08 }, legs: { b: 0.8, r: 0.35 }, sash: C.red, arms: 'hold', hair: C.ink, hat: 'kerchief', hatC: C.red, boots: C.dark });
    /* Caderousse, drunk, glass raised */
    seated(k, 960, 590, 290, { dir: -1, coat: { y: 0.55, r: 0.35, b: 0.2 }, legs: { b: 0.6, r: 0.35 }, arm: 'up', lean: 6, hair: C.ink, boots: C.dark });
    glass(k, 890, 434, 30, { r: 0.6, b: 0.25 });
    k.fill(C.ink, k.poly([958, 440, 968, 440, 972, 462, 954, 462]));
  },
};

/* ── Chapter 8: the boat to the Château d'If ──────────────────────────── */
const toIf = {
  w: 1400, h: 700, seed: 3452,
  draw(k) {
    sky(k, 0, 470, [[0, { b: 1, r: 0.62, y: 0.1 }], [0.7, { b: 0.84, r: 0.4 }], [1, { b: 0.66, r: 0.3, y: 0.08 }]]);
    stars(k, 140, 0, 0, 1400, 330, 1.6);
    disc(k, 1210, 110, 26, { y: 0.2 }, 3);
    k.cut(k.circ(1210, 110, 26), 0.9);
    cloud(k, { b: 0.24, r: 0.12 }, 1010, 150, 380, 26, 8);
    /* the lamps of Marseilles behind */
    k.fill({ b: 1, r: 0.72, y: 0.3 }, k.blob([0, 470, 0, 446, 90, 434, 200, 440, 300, 452, 380, 470]));
    for (let i = 0; i < 26; i++) {
      const x = k.R(10, 330), y = k.R(446, 466);
      k.cut(k.circ(x, y, 1.8), 1); k.fill(C.gold, k.circ(x, y, 1.8));
      const p = k.P(); p.moveTo(x, 476); p.lineTo(x, 476 + k.R(10, 30));
      k.addStroke({ y: 0.7, r: 0.2 }, p, 1.4);
    }
    sea(k, 470, 700, { top: { b: 0.78, r: 0.4 }, bottom: { b: 1, r: 0.62, y: 0.12 }, swellSpec: { b: 0.4, r: 0.2 }, rows: 18 });
    lightPath(k, 1210, 474, 560, 60, 0.45);
    /* the black and frowning rock */
    chateauIf(k, 1010, 500, 1.2, { stone: { b: 0.8, r: 0.5, y: 0.22 }, rock: { b: 0.92, r: 0.62, y: 0.3 }, shade: { b: 0.2, r: 0.14 }, rockShade: { b: 0.1, r: 0.1 }, crack: { b: 0.3, r: 0.3 }, lit: [4], glow: true });
    k.cut(k.rect(1080, 238, 4, 250), 0.12);
    /* the boat: four gendarmes, two rowers, and Dantès rising to look */
    lantern(k, 214, 520, 0.01, 170);
    k.add({ y: k.rad(330, 640, 0, 180, [0, 0.5], [1, 0]) }, k.ell(330, 650, 200, 26));
    const b = boat(k, 420, 640, 420, { dir: 1, hull: { b: 0.9, r: 0.62, y: 0.3 }, band: { y: 0.3, r: 0.2, b: 0.4 } });
    const gen = { b: 1, r: 0.55, y: 0.1 };
    sitter(k, 269, 630, 86, gen, { hat: 'bicorne' });
    sitter(k, 336, 630, 84, gen, { hat: 'bicorne' });
    sitter(k, 490, 630, 86, gen, { hat: 'bicorne' });
    sitter(k, 560, 630, 81, gen, { hat: 'bicorne' });
    sitter(k, 616, 634, 73, { b: 0.7, r: 0.4 }, { oar: 60 });
    sitter(k, 213, 634, 73, { b: 0.7, r: 0.4 }, { oar: 60 });
    person(k, 424, 632, 150, { coat: { b: 0.72, r: 0.2 }, legs: { b: 0.72, r: 0.2 }, hair: C.ink, buttons: C.gold, dir: 1, arms: 'down' });
    /* the lantern at the stern and the light it throws on the water */
    k.stroke(C.dark, k.poly([236, 632, 214, 546], true), 4);
    lantern(k, 214, 520, 34, 0);
  },
};

/* ── Chapter 15: the floor gives way ──────────────────────────────────── */
function kneel(k, x, y, h, o) {
  const s = h / 100, d = o.dir || 1;
  const X = (dx) => x + dx * s * d, Y = (dy) => y - dy * s;
  const P = (arr) => { const out = []; for (let i = 0; i < arr.length; i += 2) out.push(X(arr[i]), Y(arr[i + 1])); return out; };
  k.fill(o.legs, k.poly(P([-18, 0, 12, 0, 14, 12, -16, 16])));
  k.fill(o.legs, k.poly(P([-4, 14, 12, 14, 8, 40, -10, 38])));
  k.fill(o.coat, k.poly(P([-12 + o.lean, 74, 8 + o.lean, 74, 10, 34, -12, 34])));
  k.stroke(o.coat, k.poly(P([4 + o.lean, 70, 18 + o.lean, 54, 30 + o.lean, 46]), true), 6 * s);
  k.stroke(o.coat, k.poly(P([-8 + o.lean, 70, -4 + o.lean, 50, 10 + o.lean, 40]), true), 6 * s);
  k.fill(o.skin || C.skin, k.circ(X(31 + o.lean), Y(46), 3.4 * s));
  k.fill(o.skin || C.skin, k.ell(X(-1 + o.lean), Y(83), 7 * s, 8.4 * s));
  k.fill(o.hair || C.ink, k.blob(P([-9 + o.lean, 82, -8 + o.lean, 92, 0 + o.lean, 94, 7 + o.lean, 89, 5 + o.lean, 84, -2 + o.lean, 86, -6 + o.lean, 70])));
  if (o.beard) k.fill(o.hair || C.ink, k.poly(P([2 + o.lean, 80, 7 + o.lean, 80, 5 + o.lean, 70, 0 + o.lean, 72])));
}

const faria = {
  w: 1000, h: 1250, seed: 6064,
  draw(k) {
    const stone = { b: 0.46, r: 0.2, y: 0.14 };
    k.fill(stone, k.rect(0, 0, 1000, 930));
    stonework(k, 0, 0, 1000, 930, 58, { b: 0.2, r: 0.1, y: 0.05 }, { mortar: 0.3 });
    k.add({ b: k.lin(0, 0, 0, 930, [0, 0.35], [0.5, 0.05], [1, 0.25]) }, k.rect(0, 0, 1000, 930));
    /* the floor */
    k.fill({ b: 0.52, r: 0.28, y: 0.2 }, k.rect(0, 930, 1000, 320));
    const flags = k.P(); for (let y = 960, g = 40; y < 1250; y += g, g *= 1.3) { flags.moveTo(0, y); flags.lineTo(1000, y); }
    for (let i = -8; i < 9; i++) { flags.moveTo(500 + i * 90, 930); flags.lineTo(500 + i * 190, 1250); }
    k.addStroke({ b: 0.3, r: 0.2 }, flags, 2);
    /* the high barred window and its ray of light */
    const wx = 690, wy = 110;
    k.fill({ b: 0.9, r: 0.5, y: 0.2 }, k.rect(wx - 16, wy - 16, 162, 122));
    sky(k, wy, wy + 90, [[0, { b: 0.3 }], [1, { b: 0.1, y: 0.2 }]], wx, wx + 130);
    for (let i = 1; i < 5; i++) k.fill(C.dark, k.rect(wx + i * 26 - 4, wy, 8, 90));
    const ray = k.poly([wx, wy + 90, wx + 130, wy + 90, 420, 1150, 60, 1080]);
    k.cut(ray, k.lin(wx, wy, 300, 1100, [0, 0.55], [1, 0.2]));
    k.add({ y: k.lin(wx, wy, 300, 1100, [0, 0.55], [1, 0.25]) }, ray);
    /* straw bed and water jug */
    k.fill({ y: 0.7, r: 0.3, b: 0.12 }, k.blob([640, 1080, 700, 1040, 960, 1030, 1000, 1070, 1000, 1150, 640, 1150]));
    const straw = k.P(); for (let i = 0; i < 90; i++) { const x = k.R(650, 990), y = k.R(1040, 1140), a = k.R(-0.5, 0.5); straw.moveTo(x, y); straw.lineTo(x + Math.cos(a) * 30, y + Math.sin(a) * 30); }
    k.addStroke({ y: 0.9, r: 0.5, b: 0.2 }, straw, 2);
    k.fill({ r: 0.6, y: 0.62, b: 0.3 }, k.blob([120, 990, 110, 930, 130, 900, 170, 900, 190, 930, 180, 990]));
    k.cut(k.rect(132, 916, 6, 60), 0.4);
    /* the hole opening in the floor, earth and stones falling in */
    const hx = 470, hy = 1030;
    k.fill({ b: 1, r: 0.85, y: 0.55 }, k.ell(hx, hy, 170, 58));
    for (let i = 0; i < 26; i++) {
      const a = k.R(0, Math.PI * 2), rr = k.R(150, 200);
      const x = hx + Math.cos(a) * rr, y = hy + Math.sin(a) * rr * 0.36;
      k.fill(k.pick([stone, { b: 0.6, r: 0.4, y: 0.3 }, { y: 0.4, r: 0.3, b: 0.4 }]), k.blob([x - 12, y, x - 4, y - 10, x + 12, y - 6, x + 10, y + 6]));
    }
    /* the head, then the shoulders, of the old man */
    const rag = { y: 0.34, r: 0.3, b: 0.4 };
    k.clip(k.rect(0, 0, 1000, hy + 10), () => {
      k.fill(rag, k.blob([hx - 120, hy + 30, hx - 110, hy - 40, hx - 60, hy - 90, hx + 60, hy - 90, hx + 110, hy - 40, hx + 120, hy + 30]));
      k.add({ b: 0.3 }, k.poly([hx + 10, hy - 90, hx + 60, hy - 90, hx + 110, hy - 40, hx + 120, hy + 30, hx + 30, hy + 30]));
    });
    const skin = { y: 0.34, r: 0.28, b: 0.06 };
    k.fill(skin, k.rect(hx - 22, hy - 130, 44, 50));
    k.fill(skin, k.ell(hx, hy - 170, 46, 56));
    /* the long beard, still black, falling on his breast */
    k.fill({ y: 0.5, r: 0.4, b: 0.1 }, k.poly([hx - 4, hy - 172, hx + 4, hy - 172, hx + 8, hy - 150, hx - 6, hy - 150]));
    k.fill(C.ink, k.blob([hx - 40, hy - 150, hx - 20, hy - 132, hx, hy - 136, hx + 20, hy - 132, hx + 40, hy - 150, hx + 34, hy - 96, hx + 10, hy - 20, hx - 10, hy - 20, hx - 34, hy - 96]));
    k.fill(C.ink, k.blob([hx - 26, hy - 136, hx - 8, hy - 146, hx, hy - 142, hx + 8, hy - 146, hx + 26, hy - 136, hx, hy - 132]));
    k.cut(k.ell(hx, hy - 130, 12, 3.4), 0.6);
    /* hair whitened, thick grey brows, piercing eyes */
    k.fill({ b: 0.14, y: 0.06 }, k.blob([hx - 50, hy - 170, hx - 44, hy - 212, hx, hy - 232, hx + 44, hy - 212, hx + 50, hy - 170, hx + 38, hy - 196, hx, hy - 206, hx - 38, hy - 196]));
    k.fill({ b: 0.5, r: 0.2 }, k.rect(hx - 32, hy - 186, 24, 6)); k.fill({ b: 0.5, r: 0.2 }, k.rect(hx + 8, hy - 186, 24, 6));
    k.fill(C.ink, k.circ(hx - 19, hy - 174, 4)); k.fill(C.ink, k.circ(hx + 19, hy - 174, 4));
    k.cut(k.circ(hx - 17, hy - 176, 1.4), 1); k.cut(k.circ(hx + 21, hy - 176, 1.4), 1);
    /* his hand on the rim */
    k.stroke(rag, k.poly([hx - 110, hy - 10, hx - 170, hy + 8], true), 26);
    k.fill(skin, k.ell(hx - 182, hy + 10, 20, 11));
    /* Dantès drawing back smartly */
    kneel(k, 820, 1010, 420, { dir: -1, coat: { b: 0.6, r: 0.3, y: 0.3 }, legs: { b: 0.66, r: 0.36, y: 0.24 }, lean: 10, hair: C.ink, beard: true });
  },
};

/* ── Chapter 17: the abbé's work on linen ─────────────────────────────── */
const abbe = {
  w: 1200, h: 800, seed: 7214,
  draw(k) {
    const dark = { b: 0.86, r: 0.56, y: 0.36 };
    k.fill(dark, k.rect(0, 0, 1200, 800));
    stonework(k, 0, 0, 1200, 520, 64, { b: 0.1, r: 0.05 }, { mortar: 0.25 });
    /* the lamp of melted fat, a torch like those of public illuminations */
    const lx = 250, ly = 330;
    k.cut(k.circ(lx, ly, 560), k.rad(lx, ly, 0, 560, [0, 0.95], [0.3, 0.6], [1, 0]));
    k.add({ y: k.rad(lx, ly, 0, 560, [0, 0.9], [0.4, 0.5], [1, 0.05]), r: k.rad(lx, ly, 0, 560, [0, 0.2], [0.6, 0.2], [1, 0]) }, k.circ(lx, ly, 560));
    k.fill(C.dark, k.poly([lx - 40, ly + 70, lx + 40, ly + 70, lx + 26, ly + 20, lx - 26, ly + 20]));
    k.fill(C.dark, k.rect(lx - 6, ly + 70, 12, 120));
    k.fill(C.dark, k.rect(lx - 50, ly + 186, 100, 14));
    k.fill(C.gold, k.blob([lx - 20, ly + 22, lx - 14, ly - 40, lx, ly - 90, lx + 14, ly - 40, lx + 20, ly + 22]));
    k.fill(C.orange, k.blob([lx - 9, ly + 22, lx - 6, ly - 10, lx, ly - 40, lx + 6, ly - 10, lx + 9, ly + 22]));
    /* the stone ledge */
    k.fill({ y: 0.42, r: 0.3, b: 0.3 }, k.rect(0, 520, 1200, 280));
    k.add({ b: k.lin(0, 520, 0, 800, [0, 0.05], [1, 0.45]), r: 0.08 }, k.rect(0, 520, 1200, 280));
    k.fill({ y: 0.6, r: 0.36, b: 0.24 }, k.rect(0, 514, 1200, 12));
    /* strips of linen closely covered with writing, numbered */
    const strip = (x, y, w, h, a, n) => {
      const c = Math.cos(a), s = Math.sin(a);
      const T = (u, v) => [x + u * c - v * s, y + u * s + v * c];
      const q = [...T(0, 0), ...T(w, 0), ...T(w, h), ...T(0, h)];
      k.add({ b: 0.4, r: 0.25 }, k.poly(q.map((v, i) => v + (i % 2 ? 6 : 4))));
      k.cut(k.poly(q), 1);
      k.fill({ y: 0.14, r: 0.04 }, k.poly(q));
      const ln = k.P();
      for (let v = 22; v < h - 8; v += 7.5) { const x0 = 6 + k.R(0, 4), x1 = w - 6 - k.R(0, 16); const a0 = T(x0, v), a1 = T(x1, v); ln.moveTo(a0[0], a0[1]); ln.lineTo(a1[0], a1[1]); }
      k.addStroke({ b: 0.72, r: 0.2 }, ln, 1.6);
      const t = T(w / 2 - 8, 16);
      k.text({ r: 0.9 }, String(n), t[0] + 4, t[1], '700 13px Georgia, serif', 'center');
    };
    strip(420, 470, 80, 330, -1.35, 64);
    strip(470, 540, 80, 330, -1.62, 65);
    strip(520, 590, 80, 350, -1.2, 66);
    strip(600, 560, 80, 330, -1.5, 67);
    strip(780, 450, 80, 360, -0.2, 68);
    strip(880, 470, 80, 340, 0.12, 12);
    strip(990, 500, 80, 330, 0.36, 27);
    /* "finis" at the end of the sixty-eighth strip */
    k.text({ r: 0.9, b: 0.4 }, 'finis', 812, 790, 'italic 700 20px Georgia, serif', 'left');
    /* the pens: slender sticks with a fish cartilage tied at the end, and the knife */
    const pen = (x, y, a, l) => {
      const c = Math.cos(a), s = Math.sin(a);
      k.stroke({ y: 0.55, r: 0.45, b: 0.3 }, k.poly([x, y, x + c * l, y + s * l], true), 5);
      k.fill(C.cream, k.poly([x + c * l, y + s * l, x + c * (l + 26) , y + s * (l + 26), x + c * l - s * 5, y + s * l + c * 5]));
      k.stroke(C.red, k.poly([x + c * (l - 4) - s * 3, y + s * (l - 4) + c * 3, x + c * (l - 4) + s * 3, y + s * (l - 4) - c * 3], true), 2);
    };
    pen(560, 720, -0.3, 150);
    pen(600, 760, -0.36, 140);
    k.fill({ b: 0.5, r: 0.2, y: 0.1 }, k.poly([220, 700, 360, 680, 368, 690, 228, 712]));
    k.fill(C.dark, k.rect(160, 694, 64, 22));
    /* ink made from soot, in a little pot */
    k.fill(C.dark, k.blob([380, 640, 384, 600, 430, 598, 436, 640]));
    k.fill(C.ink, k.ell(408, 600, 24, 6));
    /* the rope ladder coiled in the corner */
    for (let i = 0; i < 6; i++) k.stroke({ y: 0.55, r: 0.3, b: 0.2 }, k.ell(120, 560 - i * 8, 90 - i * 4, 22), 7);
  },
};

/* ── Chapter 20: the sea is the cemetery ──────────────────────────────── */
const cemetery = {
  w: 1000, h: 1250, seed: 9256,
  draw(k) {
    sky(k, 0, 1250, [[0, NIGHT], [0.5, { b: 0.86, r: 0.44, y: 0.06 }], [1, { b: 1, r: 0.6, y: 0.14 }]]);
    cloud(k, { b: 0.1, r: 0.2 }, 380, 120, 640, 90, 12);
    k.cut(k.ell(700, 150, 220, 60), k.rad(700, 150, 0, 220, [0, 0.35], [1, 0]));
    /* the rampart and the rock face falling to the sea */
    const face = k.poly([0, 300, 520, 300, 520, 440, 560, 460, 560, 600, 610, 660, 590, 790, 640, 900, 600, 980, 0, 980]);
    k.fill({ b: 0.9, r: 0.62, y: 0.3 }, face);
    k.clip(face, () => {
      stonework(k, 0, 300, 540, 140, 26, { b: 0.08, r: 0.08 }, { mortar: 0.3 });
      rock(k, [0, 440, 560, 460, 610, 660, 590, 790, 640, 900, 600, 980, 0, 980], { b: 0.9, r: 0.66, y: 0.36 }, { light: 1, shadow: { b: 0.2, r: 0.1 }, facets: 30, fs: 1.6, cracks: 18 });
      k.add({ b: 0.15, r: 0.1 }, k.rect(0, 300, 300, 680));
    });
    crenels(k, { b: 0.9, r: 0.62, y: 0.3 }, 0, 300, 520, 30);
    /* the two grave-diggers and their lantern on the terrace */
    lantern(k, 410, 226, 0.01, 170);
    const gd = { b: 1, r: 0.7, y: 0.3 };
    person(k, 350, 276, 84, { coat: gd, legs: gd, dir: 1, arms: "down", hat: "cap", hatC: gd });
    person(k, 470, 276, 86, { coat: gd, legs: gd, dir: -1, arms: "down", hat: "cap", hatC: gd });
    lantern(k, 410, 226, 22, 0);
    /* slanting rain */
    const rain = k.P();
    for (let i = 0; i < 260; i++) { const x = k.R(-100, 1100), y = k.R(-50, 1250), l = k.R(18, 46); rain.moveTo(x, y); rain.lineTo(x - l * 0.35, y + l); }
    k.cut(rain, 0.28, 1.4);
    /* the sea below, heavy swell */
    sea(k, 980, 1250, { top: { b: 0.9, r: 0.52, y: 0.1 }, bottom: { b: 1, r: 0.66, y: 0.2 }, swellSpec: { b: 0.25, r: 0.2 }, rows: 16, amp: 6, len: 90 });
    waves(k, { y0: 990, y1: 1250, rows: 10, len: 80, amp: 5, lw: 2.4, cut: true, amount: 0.55, dens: 0.35 });
    /* where the sea closed again: rings and foam, nothing more */
    const fx = 720, fy = 1050;
    for (let i = 0; i < 4; i++) k.cut(k.ell(fx, fy, 40 + i * 42, 9 + i * 10), 0.8 - i * 0.16, 3.4 - i * 0.5);
    for (let i = 0; i < 26; i++) { const a = k.R(-2.7, -0.4), r = k.R(20, 90); k.cut(k.circ(fx + Math.cos(a) * r * 0.8, fy + Math.sin(a) * r, k.R(2, 5.5)), 0.9); }
    k.cut(k.ell(fx, fy, 34, 8), 1);
  },
};

/* ── Chapter 21: off Tiboulen, the tartan at dawn ─────────────────────── */
const tiboulen = {
  w: 1400, h: 700, seed: 9490,
  draw(k) {
    sky(k, 0, 440, [[0, { b: 0.5, r: 0.3 }], [0.45, { r: 0.34, y: 0.3, b: 0.1 }], [1, { y: 0.9, r: 0.42 }]]);
    disc(k, 860, 440, 70, { y: 0.95, r: 0.26 }, 2.6);
    cloud(k, { r: 0.4, y: 0.3 }, 560, 250, 600, 30, 9);
    cloud(k, { r: 0.32, b: 0.14 }, 960, 170, 420, 26, 8);
    cloud(k, { r: 0.3, y: 0.2 }, 60, 120, 380, 24, 7);
    /* the Château d'If far off, where he came from */
    k.fill({ b: 0.46, r: 0.3 }, k.blob([230, 442, 280, 430, 360, 428, 420, 442]));
    chateauIf(k, 320, 436, 0.13, { stone: { b: 0.5, r: 0.34, y: 0.1 }, rock: { b: 0.5, r: 0.34, y: 0.1 }, shade: { b: 0.14 }, rockShade: { b: 0.1 }, crack: { b: 0.3 } });
    k.fill({ b: 0.46, r: 0.3 }, k.blob([470, 442, 520, 432, 620, 428, 700, 442]));
    sea(k, 440, 700, { top: { y: 0.55, r: 0.3, b: 0.2 }, bottom: { b: 0.8, r: 0.3 }, rows: 22, glints: 14, swellSpec: { b: 0.36, r: 0.1 } });
    lightPath(k, 860, 444, 700, 130, 0.9);
    /* the tartan with her lateen sail, skimming the sea like a gull */
    k.add({ b: 0.3, r: 0.1 }, k.ell(1080, 566, 150, 10));
    tartan(k, 1080, 556, 300, { dir: -1, sail: { y: 0.3, r: 0.1 }, band: C.red, flag: C.red, shade: { b: 0.2, r: 0.1 } });
    /* the rocks of Tiboulen, black against the dawn */
    rock(k, [0, 700, 0, 470, 60, 440, 150, 470, 230, 520, 300, 600, 330, 700], { b: 0.92, r: 0.6, y: 0.4 }, { light: 1, shadow: { b: 0.1, r: 0.1 }, facets: 18, fs: 1.3 });
    waves(k, { y0: 610, y1: 700, rows: 5, len: 40, amp: 4, lw: 3, cut: true, amount: 0.8, dens: 0.8, x0: 180, x1: 420 });
    /* a swimmer, the red cap from the wreck on his head, one arm raised */
    const sx = 600, sy = 600;
    const sk = { y: 0.34, r: 0.34, b: 0.14 };
    k.cut(k.ell(sx, sy + 8, 90, 14), 0.75, 4);
    k.fill(sk, k.circ(sx, sy - 8, 20));
    k.fill(C.ink, k.blob([sx - 16, sy + 4, sx - 20, sy - 10, sx - 12, sy - 16, sx - 4, sy + 10]));
    k.fill(C.red, k.blob([sx - 21, sy - 16, sx - 12, sy - 32, sx + 10, sy - 34, sx + 22, sy - 18, sx + 34, sy - 22, sx + 28, sy - 12]));
    k.stroke(sk, k.poly([sx + 14, sy + 2, sx + 44, sy - 60, sx + 50, sy - 96], true), 12);
    k.fill(sk, k.ell(sx + 51, sy - 101, 8, 10));
    /* the wreck of the fishing boat on the rocks */
    k.stroke({ y: 0.5, r: 0.4, b: 0.5 }, k.poly([80, 520, 190, 560], true), 9);
    k.stroke({ y: 0.5, r: 0.4, b: 0.5 }, k.poly([120, 500, 150, 590], true), 7);
    gull(k, 980, 330, 14, C.navy); gull(k, 1030, 300, 10, C.navy); gull(k, 520, 330, 9, C.navy);
  },
};

/* ── Chapter 24: the coffer in the secret cave ────────────────────────── */
const treasure = {
  w: 1200, h: 800, seed: 10562,
  draw(k) {
    k.fill({ b: 0.92, r: 0.66, y: 0.4 }, k.rect(0, 0, 1200, 800));
    /* the vault of the cave */
    rock(k, [0, 0, 1200, 0, 1200, 800, 1080, 800, 1100, 520, 1020, 260, 860, 130, 600, 90, 340, 130, 170, 260, 100, 520, 120, 800, 0, 800], { b: 0.95, r: 0.7, y: 0.46 }, { shadow: { b: 0.05 }, facets: 30, fs: 2, cracks: 20 });
    /* a torch pushed into a crack of the rock */
    const tx = 1000, ty = 330;
    k.stroke(C.wood, k.poly([tx + 40, ty + 120, tx, ty], true), 12);
    k.fill(C.gold, k.blob([tx - 16, ty + 6, tx - 12, ty - 40, tx, ty - 80, tx + 12, ty - 40, tx + 16, ty + 6]));
    k.fill(C.orange, k.blob([tx - 7, ty + 6, tx - 4, ty - 16, tx, ty - 40, tx + 4, ty - 16, tx + 7, ty + 6]));
    /* the light of the gold itself */
    const gx = 560, gy = 540;
    k.cut(k.circ(gx, gy, 520), k.rad(gx, gy, 0, 520, [0, 1], [0.35, 0.7], [1, 0]));
    k.add({ y: k.rad(gx, gy, 0, 520, [0, 0.95], [0.5, 0.55], [1, 0.1]), r: k.rad(gx, gy, 0, 520, [0, 0.12], [0.6, 0.3], [1, 0.2]) }, k.circ(gx, gy, 520));
    k.cut(k.circ(tx, ty - 30, 160), k.rad(tx, ty - 30, 0, 160, [0, 0.6], [1, 0]));
    k.add({ y: k.rad(tx, ty - 30, 0, 160, [0, 0.8], [1, 0]) }, k.circ(tx, ty - 30, 160));
    /* the pickaxe he worked with */
    k.stroke(C.wood, k.poly([180, 770, 260, 470], true), 12);
    k.stroke(C.dark, k.poly([200, 480, 260, 470, 330, 500], true), 12);
    /* the coffer of oak bound with iron, the lid thrown back */
    const cx = 330, cy = 520, cw = 520, ch = 170;
    k.fill({ y: 0.6, r: 0.55, b: 0.55 }, k.poly([cx + 20, cy - 10, cx + cw - 20, cy - 10, cx + cw + 20, cy - 190, cx - 20, cy - 190]));
    k.fill(C.dark, k.rect(cx + 60, cy - 190, 20, 180)); k.fill(C.dark, k.rect(cx + cw - 80, cy - 190, 20, 180));
    k.fill({ y: 0.6, r: 0.52, b: 0.5 }, k.rect(cx, cy, cw, ch));
    k.add({ b: 0.2 }, k.rect(cx, cy + ch * 0.5, cw, ch * 0.5));
    for (const x of [cx + 60, cx + cw - 80]) k.fill(C.dark, k.rect(x, cy, 20, ch));
    k.fill(C.dark, k.rect(cx + cw / 2 - 22, cy + 30, 44, 50));
    k.fill(C.gold, k.circ(cx + cw / 2, cy + 50, 9));
    /* three compartments, seen from above the rim */
    const top = cy - 4, depth = 120;
    k.fill({ y: 0.6, r: 0.52, b: 0.55 }, k.poly([cx, cy, cx + cw, cy, cx + cw - 30, top - depth, cx + 30, top - depth]));
    const third = cw / 3;
    const comp = (i) => k.poly([cx + 8 + i * third, cy - 6, cx + (i + 1) * third - 8, cy - 6, cx + (i + 1) * third - 8 - (i === 2 ? 16 : 0), top - depth + 6, cx + 8 + i * third + (i === 0 ? 16 : 0), top - depth + 6]);
    /* 1: piles of golden coin */
    k.clip(comp(0), () => {
      k.fill(C.gold, comp(0));
      for (let i = 0; i < 90; i++) {
        const x = k.R(cx, cx + third), y = k.R(top - depth, cy);
        k.fill(k.pick([C.gold, C.orange, { y: 1, r: 0.3 }]), k.ell(x, y, 11, 6));
        k.cut(k.ell(x - 3, y - 2, 4, 1.6), 0.9);
      }
    });
    /* 2: bars of unpolished gold */
    k.clip(comp(1), () => {
      k.fill({ y: 0.9, r: 0.5 }, comp(1));
      for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
        const x = cx + third + 14 + c * 42 + (r % 2) * 16, y = top - depth + 10 + r * 14;
        k.fill({ y: 0.95, r: 0.32 }, k.poly([x, y + 12, x + 36, y + 12, x + 32, y, x + 4, y]));
        k.add({ r: 0.3, b: 0.1 }, k.rect(x, y + 8, 36, 4));
      }
    });
    /* 3: diamonds, pearls and rubies */
    k.clip(comp(2), () => {
      k.fill({ b: 0.6, r: 0.5 }, comp(2));
      for (let i = 0; i < 70; i++) {
        const x = k.R(cx + 2 * third, cx + cw), y = k.R(top - depth, cy);
        const t = k.rnd();
        if (t < 0.4) { k.fill(C.red, k.circ(x, y, k.R(4, 7))); k.cut(k.circ(x - 2, y - 2, 1.6), 0.8); }
        else if (t < 0.7) { k.cut(k.circ(x, y, k.R(3.5, 6)), 1); k.fill({ y: 0.12, r: 0.04 }, k.circ(x, y, 5)); }
        else sparkle(k, x, y, k.R(5, 9), 1);
      }
    });
    /* Edmond kneeling at the coffer, his hands full, the jewels falling like hail against glass */
    kneel(k, 1010, 790, 430, { dir: -1, coat: { y: 0.3, r: 0.3, b: 0.5 }, legs: { b: 0.7, r: 0.4, y: 0.3 }, lean: 6, hair: C.ink, beard: true, skin: { y: 0.46, r: 0.4, b: 0.16 } });
    for (let i = 0; i < 22; i++) {
      const x = 880 + k.R(-30, 30), y = 600 + i * 4 + k.R(0, 20);
      if (i % 3 === 0) sparkle(k, x, y, k.R(5, 9), 1);
      else if (i % 3 === 1) k.fill(C.red, k.circ(x, y, 4.5));
      else k.cut(k.circ(x, y, 4.5), 1);
    }
  },
};

export const SCENES = { arrival, catalans, conspiracy, 'to-if': toIf, faria, abbe, cemetery, tiboulen, treasure };
