/* Scenes from volume four (chapters 74 to 95): Janina, and the past
 * catching up with Paris. Same contract as v1.js. */
import { C, person, seated, crowd, stonework, cloud, gull, waves, sparkle } from '../parts.js';
import { sky, sea, lightPath } from '../sea.js';
import { rock, candle } from '../arch.js';
import { PALE, lady, haydee, parquet, drape, frame, books } from '../salon.js';
import { horse, carriage } from './ride.js';

const scale = (base, f) => { const s = {}; for (const key in base) s[key] = base[key] * f; return s; };

/* ── Chapter 77: the lake of Janina, as Haydée remembers it ───────────── */
const janina = {
  w: 1400, h: 700, seed: 41663,
  draw(k) {
    sky(k, 0, 390, [[0, { b: 0.5 }], [0.7, { b: 0.2, y: 0.04 }], [1, { b: 0.1, y: 0.14 }]]);
    cloud(k, { b: 0.08 }, 760, 70, 460, 30, 8);
    /* the heights of Pindus */
    k.fill({ b: 0.34, r: 0.1, y: 0.06 }, k.blob([-40, 390, -40, 250, 120, 170, 260, 200, 420, 110, 560, 150, 700, 70, 840, 130, 980, 100, 1120, 170, 1260, 120, 1440, 190, 1440, 390]));
    k.add({ b: 0.14 }, k.blob([700, 70, 760, 160, 740, 260, 820, 390, 1440, 390, 1440, 190, 1260, 120, 1120, 170, 980, 100, 840, 130]));
    k.cut(k.poly([690, 76, 710, 72, 730, 96, 700, 100]), 0.7);
    k.cut(k.poly([972, 104, 990, 100, 1010, 122, 984, 124]), 0.6);
    const green = { b: 0.54, y: 0.66, r: 0.1 };
    k.fill(green, k.blob([-40, 390, -40, 300, 160, 250, 360, 290, 520, 240, 700, 290, 900, 250, 1060, 300, 1240, 260, 1440, 300, 1440, 390]));
    /* fir-trees and myrtles that look from afar like lichens on the rocks */
    const lichen = { b: 0.9, y: 0.62, r: 0.46 };
    for (let i = 0; i < 160; i++) {
      const x = k.R(-20, 1420), y = k.R(270, 388), r = k.R(6, 16);
      k.fill(scale(lichen, k.R(0.8, 1.05)), k.blob([x - r, y + r * 0.4, x - r * 0.6, y - r * 0.8, x + r * 0.2, y - r, x + r, y - r * 0.2, x + r * 0.8, y + r * 0.6]));
    }
    /* the lake, blue, mirroring the mountains */
    sea(k, 388, 700, { top: { b: 0.5, y: 0.08 }, bottom: { b: 0.82, r: 0.12 }, rows: 16, glints: 10, swellSpec: { b: 0.24 }, amp: 2 });
    k.add({ b: 0.2, y: 0.2 }, k.blob([-40, 388, 160, 430, 360, 410, 520, 440, 700, 412, 900, 440, 1060, 408, 1240, 436, 1440, 410, 1440, 388]));
    /* the castle of Yanina, white and angular, rising from the water */
    rock(k, [-40, 470, -40, 380, 60, 360, 200, 350, 330, 364, 420, 400, 440, 470], lichen, { shadow: { b: 0.3 }, facets: 10, cracks: 4 });
    const white = { y: 0.04, b: 0.03 };
    const shade = { b: 0.34, r: 0.08 };
    const block = (x, y, w, h, side) => {
      k.fill(white, k.rect(x, y - h, w, h));
      k.fill(shade, k.poly([x + w, y - h, x + w + side, y - h - side * 0.4, x + w + side, y - side * 0.4, x + w, y]));
      const cr = k.P(); for (let cx = x + 2; cx < x + w - 6; cx += 14) cr.rect(cx, y - h - 9, 8, 9);
      k.fill(white, cr);
    };
    block(20, 390, 120, 110, 18); block(150, 380, 90, 170, 16); block(250, 386, 150, 80, 22); block(60, 300, 60, 50, 12);
    for (const [x, y] of [[40, 330], [80, 350], [170, 260], [200, 300], [280, 340], [340, 350]]) k.fill(C.dark, k.rect(x, y, 6, 14));
    k.add({ b: 0.26 }, k.poly([20, 392, 420, 392, 400, 470, 40, 470]));
    /* the kiosk on its island: a ground floor and, above, another floor looking on the lake, all lattice-work */
    rock(k, [760, 470, 790, 440, 900, 426, 1010, 434, 1080, 470], { b: 0.6, r: 0.3, y: 0.4 }, { shadow: { b: 0.3 }, facets: 6, cracks: 3, fs: 0.6 });
    k.fill({ y: 0.14, r: 0.05 }, k.rect(820, 360, 200, 76));
    k.add({ b: 0.2 }, k.rect(960, 360, 60, 76));
    for (const x of [846, 896, 946, 996]) k.fill(C.dark, k.blob([x - 9, 436, x - 9, 404, x, 394, x + 9, 404, x + 9, 436]));
    k.fill({ y: 0.5, r: 0.44, b: 0.36 }, k.rect(840, 296, 170, 58));
    const lat = k.P();
    for (let x = 836; x < 1016; x += 9) { lat.moveTo(x, 296); lat.lineTo(x + 20, 354); lat.moveTo(x + 20, 296); lat.lineTo(x, 354); }
    k.clip(k.rect(840, 296, 170, 58), () => k.cut(lat, 0.7, 1.6));
    k.fill({ r: 0.72, y: 0.52, b: 0.22 }, k.poly([806, 300, 1044, 300, 1010, 272, 840, 272]));
    k.fill({ r: 0.72, y: 0.52, b: 0.22 }, k.poly([796, 362, 1050, 362, 1026, 352, 820, 352]));
    k.add({ b: 0.3 }, k.poly([806, 300, 1044, 300, 1040, 306, 810, 306]));
    /* on the terrace: the pasha with his white beard, Vasiliki beside him, the child at his feet */
    k.fill({ y: 0.34, r: 0.2, b: 0.2 }, k.rect(740, 430, 90, 8));
    k.fill({ r: 0.8, y: 0.4 }, k.ell(784, 428, 30, 6));
    seated(k, 776, 424, 44, { dir: 1, coat: { r: 0.8, b: 0.6 }, skin: C.skin, arm: 'up' });
    k.fill({ b: 0.05 }, k.poly([778, 402, 784, 402, 783, 382, 778, 386]));
    k.fill({ y: 0.06 }, k.ell(777, 396, 4, 3));
    seated(k, 758, 426, 38, { dir: 1, coat: { b: 0.6, y: 0.2 }, skin: C.skin, lean: 3, hair: C.ink });
    k.fill(C.red, k.circ(800, 428, 5)); k.fill(C.skin, k.circ(800, 420, 4));
    /* black specks on the lake that he watched for */
    for (const [x, y, w] of [[1250, 412, 14], [1300, 420, 12], [1344, 408, 10], [1370, 426, 13]]) { k.fill(C.ink, k.ell(x, y, w, 3)); k.fill(C.ink, k.rect(x - 1, y - 9, 2, 8)); }
    /* reflections of the castle and the kiosk */
    k.add({ b: 0.1 }, k.rect(20, 470, 380, 60));
    k.cut(k.rect(820, 474, 200, 40), 0.3);
    waves(k, { y0: 480, y1: 560, rows: 8, len: 50, amp: 1.5, lw: 1.4, cut: true, amount: 0.4, dens: 0.4, x0: 0, x1: 1100 });
    gull(k, 560, 200, 10, C.navy); gull(k, 600, 220, 7, C.navy);
  },
};

/* ── Chapter 85: Tréport, the morning after the journey ───────────────── */
const treport = {
  w: 1200, h: 800, seed: 46860,
  draw(k) {
    /* the view through the window */
    sky(k, 0, 340, [[0, { b: 0.42 }], [0.7, { b: 0.14, y: 0.12 }], [1, { y: 0.34, r: 0.12 }]]);
    cloud(k, { b: 0.1, r: 0.04 }, 300, 110, 400, 26, 8);
    cloud(k, { y: 0.1, r: 0.06 }, 640, 190, 300, 18, 6);
    sea(k, 336, 600, { top: { b: 0.36, y: 0.1 }, bottom: { b: 0.72, r: 0.1 }, rows: 16, glints: 10 });
    lightPath(k, 420, 340, 520, 50, 0.6);
    /* the cliffs of the creek (their colour is ours) */
    const cliff = k.blob([780, 600, 800, 420, 850, 330, 930, 290, 1040, 270, 1200, 262, 1200, 600]);
    k.fill({ y: 0.14, r: 0.04, b: 0.06 }, cliff);
    k.clip(cliff, () => {
      k.add({ b: 0.24 }, k.poly([780, 600, 820, 380, 880, 340, 860, 600]));
      const st = k.P(); for (let y = 320; y < 600; y += 26) { st.moveTo(780, y); st.lineTo(1200, y + k.R(-6, 6)); } k.addStroke({ b: 0.16, y: 0.1 }, st, 2);
      k.fill({ b: 0.6, y: 0.7 }, k.blob([840, 344, 930, 286, 1050, 266, 1200, 258, 1200, 290, 1060, 300, 940, 320]));
    });
    k.fill({ b: 0.4, r: 0.1, y: 0.1 }, k.blob([-20, 344, 60, 326, 180, 330, 260, 344]));
    /* fishing boats round the schooner, like subjects awaiting their queen */
    const fish = (x, y, s, sail) => {
      k.fill({ y: 0.6, r: 0.5, b: 0.44 }, k.blob([x - 26 * s, y, x - 20 * s, y + 8 * s, x + 20 * s, y + 8 * s, x + 28 * s, y - 2 * s]));
      k.stroke(C.dark, k.poly([x, y, x, y - 44 * s], true), 1.6 * s);
      if (sail) k.fill(sail, k.poly([x + 1, y - 42 * s, x + 1, y - 6 * s, x + 26 * s, y - 8 * s]));
      else k.stroke({ y: 0.7, r: 0.5, b: 0.2 }, k.poly([x - 12 * s, y - 20 * s, x + 12 * s, y - 20 * s], true), 3 * s);
    };
    for (const [x, y, s, sl] of [[240, 470, 1, 0], [330, 500, 1.2, 1], [790, 470, 0.9, 0], [880, 510, 1.3, 0], [960, 540, 1.4, 1], [180, 420, 0.7, 1], [720, 530, 1.1, 0]]) fish(x, y, s, sl ? { y: 0.7, r: 0.6, b: 0.2 } : null);
    /* the little sloop: narrow keel, high masts */
    const hx = 560, hy = 520, L = 340;
    k.add({ b: 0.3, r: 0.1 }, k.ell(hx, hy + 18, L * 0.55, 10));
    k.fill(C.ink, k.blob([hx - L * 0.5, hy - 8, hx - L * 0.44, hy + 14, hx + L * 0.3, hy + 14, hx + L * 0.52, hy - 12, hx + L * 0.2, hy - 4, hx - L * 0.2, hy - 4]));
    k.fill(C.gold, k.poly([hx - L * 0.48, hy - 2, hx + L * 0.47, hy - 6, hx + L * 0.46, hy - 2, hx - L * 0.47, hy + 2]));
    k.stroke(C.dark, k.poly([hx + L * 0.5, hy - 12, hx + L * 0.78, hy - 40], true), 3);
    const m1 = [hx - 60, hy - 6, hx - 74, hy - 290], m2 = [hx + 60, hy - 8, hx + 48, hy - 320];
    k.stroke(C.dark, k.poly(m1, true), 4); k.stroke(C.dark, k.poly(m2, true), 4.4);
    const rig = k.P(); rig.moveTo(m2[2], m2[3]); rig.lineTo(hx + L * 0.78, hy - 40); rig.moveTo(m1[2], m1[3]); rig.lineTo(m2[2], m2[3]); rig.moveTo(m1[2], m1[3]); rig.lineTo(hx - L * 0.5, hy - 8); rig.moveTo(m2[2], m2[3]); rig.lineTo(hx + 20, hy - 6); rig.moveTo(m1[2], m1[3]); rig.lineTo(hx - 110, hy - 6);
    k.stroke(C.dark, rig, 1);
    for (const m of [m1, m2]) { k.stroke(C.cream, k.poly([m[0] - 2, m[1] - 60, m[0] - 80, m[1] - 50], true), 9); k.stroke(C.cream, k.poly([m[0] - 4, m[1] - 150, m[0] - 60, m[1] - 140], true), 6); }
    k.fill(C.red, k.poly([m2[2], m2[3], m2[2] - 40, m2[3] + 4, m2[2], m2[3] + 8]));
    /* on its flag the Monte Cristo arms: a mountain or on a sea azure, a cross gules in chief */
    const fx = hx - L * 0.5, fy = hy - 20;
    k.stroke(C.dark, k.poly([fx + 6, fy + 16, fx - 10, fy - 110], true), 3);
    const fl = k.P(); fl.moveTo(fx - 10, fy - 110); fl.quadraticCurveTo(fx - 70, fy - 124, fx - 128, fy - 104); fl.lineTo(fx - 124, fy - 30); fl.quadraticCurveTo(fx - 66, fy - 50, fx - 8, fy - 36); fl.closePath();
    k.cut(fl, 1);
    k.fill({ y: 0.05 }, fl);
    k.clip(fl, () => {
      const sw = k.P(); sw.moveTo(fx - 140, fy - 60); sw.quadraticCurveTo(fx - 70, fy - 74, fx, fy - 60); sw.lineTo(fx, fy); sw.lineTo(fx - 140, fy); sw.closePath();
      k.fill({ b: 0.92, r: 0.16 }, sw);
      waves(k, { y0: fy - 56, y1: fy - 30, rows: 3, len: 14, amp: 1.2, lw: 1.2, cut: true, amount: 0.8, x0: fx - 130, x1: fx });
      k.fill({ y: 0.95, r: 0.22 }, k.poly([fx - 104, fy - 60, fx - 70, fy - 96, fx - 38, fy - 58]));
      k.add({ r: 0.3 }, k.poly([fx - 70, fy - 96, fx - 38, fy - 58, fx - 70, fy - 62]));
      k.fill(C.red, k.rect(fx - 74, fy - 124, 8, 28));
      k.fill(C.red, k.rect(fx - 86, fy - 116, 32, 7));
    });
    /* the window: dark room, stone balustrade of the terrace, curtains */
    const room = { b: 0.8, r: 0.6, y: 0.5 };
    const wnd = k.P(); wnd.rect(0, 0, 1200, 800); wnd.rect(180, 50, 840, 640);
    k.fill(room, wnd, { rule: 'evenodd' });
    k.add({ b: 0.2 }, k.rect(0, 0, 180, 800));
    frame(k, 170, 40, 860, 660, 14, { gold: { y: 0.5, r: 0.3, b: 0.24 } });
    const bal = { y: 0.3, r: 0.12, b: 0.12 };
    k.fill(bal, k.rect(184, 580, 832, 22));
    k.fill(bal, k.rect(184, 666, 832, 24));
    for (let x = 200; x < 1010; x += 38) {
      k.fill(bal, k.blob([x, 666, x - 6, 646, x - 10, 624, x - 4, 604, x + 4, 604, x + 10, 624, x + 6, 646]));
      k.add({ b: 0.2 }, k.poly([x + 1, 604, x + 10, 624, x + 6, 646, x + 1, 666]));
    }
    k.add({ b: 0.24, r: 0.08 }, k.rect(184, 596, 832, 6));
    parquet(k, 0, 700, 1200, 800, 600, { y: 0.56, r: 0.46, b: 0.36 }, { boards: 16 });
    k.cut(k.poly([180, 700, 1020, 700, 1100, 800, 120, 800]), 0.3);
    drape(k, 90, 20, 150, 690, { r: 0.7, b: 0.55, y: 0.34 }, { tie: 0.55, folds: 5, fringe: C.gold });
    drape(k, 960, 20, 150, 690, { r: 0.7, b: 0.55, y: 0.34 }, { tie: 0.55, folds: 5, fringe: C.gold });
    k.fill({ y: 0.6, r: 0.4, b: 0.36 }, k.rect(70, 8, 1060, 22));
    gull(k, 700, 160, 12, C.navy); gull(k, 740, 186, 8, C.navy);
  },
};

/* ── Chapter 86: Haydée before the Chamber of Peers ───────────────────── */
const trial = {
  w: 1000, h: 1250, seed: 47373,
  draw(k) {
    const stone = { y: 0.4, r: 0.2, b: 0.18 };
    k.fill(stone, k.rect(0, 0, 1000, 720));
    /* high windows, and the morning light coming down from them */
    for (const x of [300, 600]) {
      sky(k, 90, 340, [[0, { b: 0.32 }], [1, { b: 0.1, y: 0.1 }]], x, x + 100);
      k.fill(stone, k.rect(x + 46, 90, 8, 250));
      const beam = k.poly([x, 340, x + 100, 340, x + 240, 1250, x - 20, 1250]);
      k.cut(beam, k.lin(x, 340, x + 100, 1250, [0, 0.4], [1, 0.1]));
      k.add({ y: 0.12 }, beam);
    }
    /* columns */
    for (const x of [120, 470, 860]) {
      k.fill({ y: 0.34, r: 0.12, b: 0.1 }, k.rect(x - 34, 40, 68, 690));
      k.add({ b: 0.26 }, k.rect(x + 8, 40, 26, 690));
      const fl = k.P(); for (let i = -2; i <= 2; i++) { fl.moveTo(x + i * 12, 60); fl.lineTo(x + i * 12, 720); } k.addStroke({ b: 0.12 }, fl, 2);
      k.fill({ y: 0.34, r: 0.12, b: 0.1 }, k.rect(x - 46, 30, 92, 24));
    }
    /* Beauchamp in a box, hidden by a column */
    k.fill({ r: 0.6, b: 0.6, y: 0.3 }, k.rect(150, 220, 150, 120));
    k.fill(C.red, k.rect(150, 300, 150, 40));
    k.fill(C.skin, k.circ(172, 280, 14)); k.fill(C.ink, k.rect(158, 262, 28, 8));
    k.fill({ y: 0.34, r: 0.12, b: 0.1 }, k.rect(186, 210, 50, 140));
    /* the peers on their benches */
    const peers = [C.ink, C.dark, C.navy, { b: 0.8, r: 0.6, y: 0.5 }, { b: 0.6, r: 0.3 }];
    for (let r = 0; r < 4; r++) {
      const y = 470 + r * 60;
      k.fill({ y: 0.5, r: 0.46, b: 0.4 }, k.rect(0, y, 1000, 14));
      crowd(k, -10, 330 - r * 40, y, 44 + r * 6, peers, { step: 0.4, arms: false });
      crowd(k, 690 + r * 40, 1010, y, 44 + r * 6, peers, { step: 0.4, arms: false });
    }
    /* the president's desk */
    k.fill({ y: 0.5, r: 0.5, b: 0.5 }, k.rect(330, 560, 340, 140));
    k.fill({ b: 0.7, y: 0.6 }, k.rect(320, 548, 360, 20));
    person(k, 500, 720, 170, { dir: 1, coat: C.ink, legs: C.ink, shirt: C.cream, hair: { b: 0.2 }, arms: 'down' });
    k.fill({ y: 0.5, r: 0.5, b: 0.5 }, k.rect(330, 600, 340, 100));
    k.fill(C.gold, k.poly([380, 548, 400, 548, 398, 534, 382, 534])); k.fill(C.gold, k.circ(390, 530, 4));
    k.cut(k.poly([560, 546, 620, 540, 624, 546, 564, 550]), 0.9);
    /* the floor of the committee room */
    parquet(k, 0, 720, 1000, 1250, 500, { y: 0.5, r: 0.36, b: 0.28 }, { boards: 18 });
    /* the seat the president placed for her, which she declined */
    const ch = { y: 0.6, r: 0.4, b: 0.3 };
    k.fill(ch, k.rect(214, 900, 14, 260)); k.fill(ch, k.rect(300, 1030, 12, 130)); k.fill(ch, k.rect(220, 1040, 12, 130));
    k.fill({ r: 0.8, y: 0.2 }, k.rect(206, 1010, 120, 30));
    k.fill({ r: 0.8, y: 0.2 }, k.rect(212, 910, 26, 100));
    k.add({ b: 0.3, r: 0.1 }, k.ell(270, 1170, 70, 10));
    /* Morcerf fallen on his chair, in his uniform buttoned up to the chin */
    k.fill(ch, k.rect(826, 820, 14, 350)); k.fill(ch, k.rect(760, 1000, 12, 170)); k.fill(ch, k.rect(930, 1000, 12, 170));
    k.fill({ r: 0.8, y: 0.2 }, k.rect(750, 980, 200, 30));
    const uni = { b: 0.9, r: 0.32 };
    seated(k, 846, 996, 470, { dir: -1, coat: uni, legs: { b: 0.5, r: 0.2 }, boots: C.ink, hair: { b: 0.3, y: 0.06 }, skin: PALE, arm: 'head', lean: 4 });
    k.fill(C.gold, k.ell(846 + 10, 996 - 194, 30, 9)); k.fill(C.gold, k.ell(846 - 34, 996 - 190, 24, 8));
    for (let yy = 40; yy > 6; yy -= 7) k.fill(C.gold, k.circ(846 - 9, 996 - yy * 4.7, 3.4));
    k.fill(C.red, k.rect(846 - 16, 996 - 176, 12, 5));
    /* his papers slipping to the floor */
    for (const [px, py, a] of [[720, 1060, 0.3], [690, 1140, -0.5], [760, 1170, 0.9]]) { k.cut(k.poly([px - 24 * Math.cos(a), py - 24 * Math.sin(a) - 16, px + 24 * Math.cos(a), py + 24 * Math.sin(a) - 16, px + 24 * Math.cos(a), py + 24 * Math.sin(a) + 16, px - 24 * Math.cos(a), py - 24 * Math.sin(a) + 16]), 1); }
    /* Haydée, her large veil thrown aside, in the Greek dress */
    k.add({ b: 0.3, r: 0.1 }, k.ell(500, 1196, 150, 16));
    haydee(k, 500, 1190, 600, { dir: 1, arms: 'veil', veilHeld: { b: 0.36, r: 0.08, y: 0.04 } });
  },
};

/* ── Chapter 89: the letter from the arbour of La Réserve ─────────────── */
const letter = {
  w: 1000, h: 1250, seed: 48652,
  draw(k) {
    k.fill({ b: 0.92, r: 0.66, y: 0.36 }, k.rect(0, 0, 1000, 1250));
    /* wainscot and a shelf of books in the dark */
    const pan = k.P(); for (let x = 20; x < 1000; x += 190) { pan.rect(x, 740, 160, 380); pan.rect(x, 120, 160, 560); }
    k.addStroke({ b: 0.2, r: 0.12 }, pan, 5);
    k.fill({ y: 0.4, r: 0.3, b: 0.3 }, k.rect(540, 360, 440, 12));
    books(k, 546, 360, 430, 80, { cols: [{ r: 0.8, b: 0.6, y: 0.3 }, { b: 0.8, r: 0.5, y: 0.3 }, { y: 0.6, r: 0.5, b: 0.5 }] });
    k.fill({ r: 0.7, b: 0.62, y: 0.4 }, k.rect(0, 1120, 1000, 130));
    /* the lamp and the wax lights on the secretaire */
    const lx = 240, ly = 470;
    k.cut(k.circ(lx, ly, 620), k.rad(lx, ly, 0, 620, [0, 0.95], [0.3, 0.62], [0.7, 0.2], [1, 0]));
    k.add({ y: k.rad(lx, ly, 0, 620, [0, 0.9], [0.5, 0.45], [1, 0.05]), r: k.rad(lx, ly, 0, 620, [0, 0.18], [0.7, 0.14], [1, 0]) }, k.circ(lx, ly, 620));
    /* the secretaire, a drawer opened by a spring */
    const wood = { y: 0.66, r: 0.62, b: 0.5 };
    k.fill(wood, k.rect(60, 560, 360, 560));
    k.add({ b: 0.2 }, k.rect(330, 560, 90, 560));
    k.fill({ y: 0.7, r: 0.66, b: 0.56 }, k.rect(46, 546, 388, 20));
    for (const y of [640, 820, 960]) { k.addStroke({ b: 0.3, r: 0.2 }, k.rect(80, y, 320, 110), 3); k.fill(C.gold, k.circ(240, y + 55, 6)); }
    k.fill({ y: 0.7, r: 0.6, b: 0.46 }, k.poly([80, 750, 400, 750, 440, 780, 60, 780]));
    k.fill({ y: 0.5, r: 0.5, b: 0.5 }, k.poly([90, 740, 390, 740, 400, 752, 80, 752]));
    k.fill(C.gold, k.poly([lx - 30, 546, lx + 30, 546, lx + 12, 510, lx - 12, 510]));
    k.fill(C.gold, k.rect(lx - 5, 440, 10, 72));
    k.fill({ y: 0.3 }, k.ell(lx, ly - 30, 30, 40));
    k.cut(k.ell(lx, ly - 30, 16, 24), 1);
    k.fill(C.gold, k.ell(lx, ly - 22, 5, 11));
    candle(k, 100, 546, 70, { glow: 0 }); candle(k, 380, 546, 70, { glow: 0 });
    /* Mercédès, her veil thrown back, reads Danglars' letter */
    const m = lady(k, 540, 1190, 620, { dir: -1, lean: -2, dress: { b: 0.74, r: 0.62, y: 0.4 }, sleeve: { b: 0.74, r: 0.62, y: 0.4 }, shade: { b: 0.2 }, hair: C.ink, veilBack: { b: 0.84, r: 0.5, y: 0.2 }, arms: 'read' });
    const [h1, h2] = m.hands;
    const px = (h1[0] + h2[0]) / 2, py = (h1[1] + h2[1]) / 2 - 16;
    const paper = k.poly([px - 52, py - 64, px + 46, py - 70, px + 52, py + 50, px - 46, py + 56]);
    k.cut(paper, 1);
    k.fill({ y: 0.5, r: 0.16, b: 0.06 }, paper);
    k.add({ y: 0.2, r: 0.1 }, k.poly([px + 20, py - 68, px + 46, py - 70, px + 52, py + 50, px + 26, py + 52]));
    const ink = k.P(); for (let i = 0; i < 9; i++) { const y = py - 50 + i * 11; ink.moveTo(px - 40, y + 1); for (let x = px - 40; x < px + 38; x += 6) ink.lineTo(x + 6, y + Math.sin(x * 0.7 + i) * 1.4 - (x - px) * 0.05); }
    k.addStroke({ r: 0.62, y: 0.56, b: 0.28 }, ink, 1.6);
    for (const [hx, hy] of m.hands) k.fill(C.skin, k.circ(hx, hy, 14));
    /* the count a step back, in the shadow */
    person(k, 850, 1200, 680, { dir: -1, coat: C.ink, legs: C.ink, shirt: { b: 0.3 }, hair: C.ink, skin: { y: 0.34, r: 0.36, b: 0.4 }, long: true, arms: 'down' });
    k.fill(C.ink, k.ell(850 - 3.2 * 6.8, 1200 - 92 * 6.8, 3, 2.2));
    k.add({ y: 0.2, r: 0.1 }, k.ell(850 - 3 * 6.8, 1200 - 90 * 6.8, 26, 34));
    k.add({ b: k.lin(560, 0, 1000, 0, [0, 0], [1, 0.5]), r: k.lin(560, 0, 1000, 0, [0, 0], [1, 0.3]) }, k.rect(560, 0, 440, 1250));
  },
};

/* ── Chapter 90: the meeting at Vincennes ─────────────────────────────── */
const vincennes = {
  w: 1400, h: 700, seed: 49004,
  draw(k) {
    sky(k, 0, 480, [[0, { b: 0.3, y: 0.1 }], [0.6, { y: 0.34, r: 0.08, b: 0.06 }], [1, { y: 0.46, r: 0.14 }]]);
    /* the wood: far trunks in blue, then the ground */
    for (let i = 0; i < 16; i++) { const x = k.R(0, 1400), w = k.R(12, 28); k.fill({ b: 0.2, y: 0.14, r: 0.08 }, k.poly([x, 500, x + w * 0.2, 60, x + w * 0.8, 60, x + w, 500])); }
    k.fill({ b: 0.42, y: 0.4, r: 0.1 }, k.blob([-40, 500, -40, 420, 200, 400, 500, 420, 800, 400, 1100, 420, 1440, 404, 1440, 500]));
    k.fill({ y: 0.62, b: 0.34, r: 0.08 }, k.rect(0, 470, 1400, 230));
    const grass = k.P(); for (let i = 0; i < 400; i++) { const x = k.R(0, 1400), y = k.R(476, 700); grass.moveTo(x, y); grass.lineTo(x + k.R(-4, 4), y - k.R(4, 12)); } k.addStroke({ b: 0.36, y: 0.2 }, grass, 1.6);
    /* the canopy */
    const leaves = { b: 0.84, y: 0.7, r: 0.3 };
    const boughs = k.P(); for (const [x0, x1, y1] of [[40, 300, 150], [60, -40, 190], [150, 420, 90], [1290, 1000, 170], [1330, 1440, 120], [1370, 1180, 60]]) { boughs.moveTo(x0, 260); boughs.quadraticCurveTo((x0 + x1) / 2, y1 + 40, x1, y1); }
    k.stroke({ b: 0.86, r: 0.66, y: 0.5 }, boughs, 9);
    for (let i = 0; i < 110; i++) { const x = k.R(-60, 1460), edge = Math.abs(x - 700) / 700, y = k.R(-80, 60 + edge * 200), r = k.R(30, 80); k.fill(scale(leaves, k.R(0.8, 1.05)), k.blob([x - r, y, x - r * 0.4, y - r * 0.7, x + r * 0.5, y - r * 0.6, x + r, y + r * 0.1, x + r * 0.2, y + r * 0.6, x - r * 0.7, y + r * 0.5])); }
    /* morning light through the trees, eight o'clock */
    for (const [x0, w] of [[300, 50], [470, 90], [690, 40], [880, 70]]) { const b = k.poly([x0, 0, x0 + w, 0, x0 + w + 330, 700, x0 + 250, 700]); k.cut(b, k.lin(0, 0, 0, 700, [0, 0.55], [1, 0.22])); k.add({ y: 0.22, r: 0.04 }, b); }
    /* two carriages under the trees */
    k.add({ b: 0.3, r: 0.1 }, k.ell(210, 520, 150, 12));
    horse(k, 330, 518, 70, { dir: 1, coat: { y: 0.56, r: 0.6, b: 0.6 } });
    carriage(k, 190, 520, 170, { dir: 1, body: { b: 0.9, r: 0.66, y: 0.4 } });
    person(k, 262, 452, 60, { coat: C.dark, hat: 'top', hatC: C.ink });
    k.add({ b: 0.3, r: 0.1 }, k.ell(1180, 494, 110, 8));
    carriage(k, 1180, 496, 120, { dir: -1, body: C.navy });
    horse(k, 1090, 494, 50, { dir: -1, coat: { y: 0.3, r: 0.4, b: 0.5 } });
    /* the near trunks */
    const bark = { b: 0.86, r: 0.66, y: 0.5 };
    for (const [x, w] of [[40, 70], [150, 40], [1290, 80], [1370, 50]]) {
      k.fill(bark, k.poly([x - w / 2, 700, x - w * 0.4, 0, x + w * 0.4, 0, x + w / 2, 700]));
      k.add({ b: 0.2 }, k.rect(x + w * 0.1, 0, w * 0.4, 700));
      const br = k.P(); for (let y = 20; y < 700; y += k.R(18, 40)) { br.moveTo(x - w * 0.3, y); br.lineTo(x + w * 0.1, y + k.R(-6, 6)); } k.addStroke({ b: 0.3, r: 0.2 }, br, 2);
    }
    /* Albert's horse, held by his servant */
    horse(k, 1040, 640, 150, { dir: -1, coat: { y: 0.3, r: 0.3, b: 0.3 }, mane: C.cream, saddle: C.red });
    person(k, 1150, 646, 190, { dir: -1, coat: { b: 0.6, r: 0.3 }, legs: C.cream, hat: 'cap', hatC: C.ink, hair: C.ink, arms: 'point' });
    /* the young men: Château-Renaud, Beauchamp, Franz and Debray on one side */
    const men = [[860, { b: 0.6, r: 0.5, y: 0.5 }], [910, C.navy], [960, { y: 0.5, r: 0.3, b: 0.5 }], [900, C.dark]];
    men.forEach(([x, c], i) => person(k, x + (i === 3 ? 30 : 0), 610 + (i === 3 ? 16 : 0), 200 + (i === 3 ? 14 : 0), { dir: -1, coat: c, legs: c, shirt: C.cream, hair: i % 2 ? C.ink : { y: 0.6, r: 0.5, b: 0.4 }, hat: 'top', hatC: C.ink, long: true }));
    /* Morrel and Emmanuel, the count's seconds, on the other */
    person(k, 430, 626, 214, { dir: 1, coat: C.navy, legs: C.navy, shirt: C.cream, hair: C.ink, beard: C.ink, beardLen: 86, hat: 'top', hatC: C.ink, long: true });
    person(k, 360, 618, 200, { dir: 1, coat: C.dark, legs: C.dark, shirt: C.cream, hair: { y: 0.6, r: 0.5, b: 0.4 }, hat: 'top', hatC: C.ink, long: true });
    /* the count gives Albert his hand */
    k.add({ b: 0.3, r: 0.1 }, k.poly([560, 670, 800, 670, 1000, 700, 620, 700]));
    person(k, 600, 672, 240, { dir: 1, coat: C.ink, legs: C.ink, shirt: C.cream, hair: C.ink, skin: PALE, long: true, arms: 'shake' });
    person(k, 742, 672, 236, { dir: -1, coat: { y: 0.5, r: 0.36, b: 0.5 }, legs: { y: 0.5, r: 0.36, b: 0.5 }, shirt: C.cream, hair: { y: 0.6, r: 0.5, b: 0.44 }, long: true, arms: 'shake', lean: 2 });
    const s = 2.36;
    k.fill(C.cream, k.poly([742 + 5 * s, 672 - 80 * s, 742 - 5 * s, 672 - 80 * s, 742 - 6 * s, 672 - 46 * s, 742 + 6 * s, 672 - 46 * s]));
    k.fill(C.cream, k.poly([742 + 3 * s, 672 - 84 * s, 742 - 3 * s, 672 - 84 * s, 742 - 5 * s, 672 - 81 * s, 742 + 5 * s, 672 - 81 * s]));
  },
};

export const SCENES = { janina, treport, trial, letter, vincennes };
