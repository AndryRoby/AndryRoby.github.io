/* Scenes from volume three (chapters 48 to 73): Paris and the house at
 * Auteuil. Same contract as v1.js: { w, h, seed, draw(k) }, sizes by plate
 * shape (pano 1400x700, wide 1200x800, tall 1000x1250). Line numbers of the
 * quotations and descriptions are in README.md. */
import { C, person, crowd, stonework, sparkle, cloud, gull } from '../parts.js';
import { sky } from '../sea.js';
import { houses, wall, candle, bottle, glass } from '../arch.js';
import { PALE, lady, haydee, parquet, drape, chandelier, frame, books, armchair, lampCone } from '../salon.js';

const scale = (base, f) => { const s = {}; for (const key in base) s[key] = base[key] * f; return s; };

/* ── Chapter 51: Valentine at the boarded gate ────────────────────────── */
const gate = {
  w: 1000, h: 1250, seed: 27617,
  draw(k) {
    sky(k, 0, 720, [[0, { b: 0.34, r: 0.05 }], [0.55, { b: 0.12, y: 0.22, r: 0.08 }], [1, { y: 0.52, r: 0.26 }]]);
    /* the roofs of the Faubourg beyond the waste ground, far and pale */
    houses(k, 250, 760, 668, { hmin: 30, hmax: 80, wmin: 26, wmax: 50, row: 14, shutters: false, win: { b: 0.3, r: 0.12 }, roof: { b: 0.3, r: 0.2 }, shade: { b: 0.08 }, cols: [{ b: 0.16, r: 0.08, y: 0.1 }, { b: 0.2, y: 0.14 }, { b: 0.12, r: 0.1, y: 0.16 }] });
    /* the far wall of the kitchen-garden, with the small low door into the street */
    k.fill({ y: 0.34, r: 0.16, b: 0.16 }, k.rect(0, 640, 1000, 60));
    k.fill({ b: 0.6, r: 0.4, y: 0.3 }, k.rect(590, 652, 30, 48));
    /* the lucern, the only crop left */
    k.fill({ y: 0.62, b: 0.46, r: 0.06 }, k.rect(0, 700, 1000, 320));
    const rows = k.P();
    for (let y = 708, g = 6; y < 1020; g *= 1.14, y += g) { rows.moveTo(0, y); for (let x = 0; x <= 1000; x += 40) rows.lineTo(x, y + Math.sin(x * 0.05 + y) * 1.5); }
    k.addStroke({ b: 0.3, y: 0.2 }, rows, 2);
    /* Maximilian behind the gate, in a grey blouse and velvet cap */
    person(k, 548, 1004, 424, { dir: -1, coat: { b: 0.34, r: 0.22, y: 0.22 }, sleeve: { b: 0.34, r: 0.22, y: 0.22 }, legs: { b: 0.62, r: 0.42, y: 0.28 }, hair: C.ink, beard: C.ink, beardLen: 84, hat: 'cap', hatC: { b: 0.85, r: 0.62, y: 0.3 }, long: true, lean: -3 });
    /* the garden walls and, above them, the chestnut trees in blossom */
    const wallC = { y: 0.34, r: 0.14, b: 0.12 };
    wall(k, 0, 1030, 290, 590, wallC, { crenels: false, shade: { b: 0.1 } });
    wall(k, 710, 1030, 290, 570, wallC, { crenels: false, shade: { b: 0.2, r: 0.04 } });
    stonework(k, 0, 440, 290, 590, 40, { y: 0.06, b: 0.04 }, { mortar: 0.2 });
    stonework(k, 710, 460, 290, 570, 40, { y: 0.06, b: 0.06 }, { mortar: 0.2 });
    const leaf = { b: 0.72, y: 0.74, r: 0.18 };
    const leafDark = { b: 0.92, y: 0.62, r: 0.4 };
    const crown = (pts) => {
      const p = k.blob(pts);
      let x0 = 1e9, x1 = -1e9; for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); }
      k.fill(leaf, p);
      k.clip(p, () => {
        for (let i = 0; i < 70; i++) { const x = k.R(x0, x1), y = k.R(-60, 560); k.add(scale(leafDark, k.R(0.25, 0.6)), k.blob([x - 40, y, x - 14, y - 22, x + 30, y - 16, x + 44, y + 8, x + 6, y + 22])); }
        /* the upright candles of pink and white blossom */
        for (let i = 0; i < 90; i++) {
          const x = k.R(x0, x1), y = k.R(-40, 560), hh = k.R(12, 22);
          const c = k.poly([x - hh * 0.3, y, x + hh * 0.3, y, x, y - hh]);
          if (k.rnd() < 0.55) k.cut(c, 0.92); else { k.cut(c, 0.9); k.add({ r: 0.4, y: 0.06 }, c); }
        }
      });
    };
    crown([-80, 560, -80, -80, 330, -80, 420, 20, 400, 110, 448, 200, 400, 300, 430, 360, 330, 420, 250, 470, 140, 450, 60, 560]);
    crown([1080, 540, 1080, -80, 700, -80, 600, 10, 612, 120, 560, 200, 610, 300, 580, 370, 680, 420, 760, 470, 880, 450, 960, 520]);
    /* the two square pilasters with their stone vases of scarlet geraniums */
    const stone = { y: 0.3, r: 0.12, b: 0.12 };
    for (const px of [262, 668]) {
      k.fill(stone, k.rect(px, 372, 70, 660));
      k.add({ b: 0.2, r: 0.06 }, k.rect(px + 44, 372, 26, 660));
      k.fill(stone, k.rect(px - 8, 356, 86, 22));
      k.fill(stone, k.rect(px - 4, 1000, 78, 30));
      const vx = px + 35;
      k.fill(stone, k.blob([vx - 20, 356, vx - 34, 330, vx - 40, 300, vx - 30, 292, vx + 30, 292, vx + 40, 300, vx + 34, 330, vx + 20, 356]));
      k.add({ b: 0.2 }, k.poly([vx + 8, 356, vx + 34, 330, vx + 40, 300, vx + 10, 300]));
      for (let i = 0; i < 16; i++) { const lx = vx + k.R(-50, 50), ly = k.R(248, 300); k.fill(k.rnd() < 0.5 ? leaf : { b: 0.5, y: 0.8 }, k.circ(lx, ly, k.R(7, 12))); }
      for (let i = 0; i < 11; i++) { const fx = vx + k.R(-40, 40), fy = k.R(222, 272); for (let j = 0; j < 5; j++) k.fill(C.red, k.circ(fx + Math.cos(j * 1.26) * 4.6, fy + Math.sin(j * 1.26) * 4.6, 3.4)); }
    }
    /* the curiously wrought iron gate of Louis XIII's time, its upper bars open */
    const iron = { b: 0.9, r: 0.66, y: 0.45 };
    const bars = k.P();
    for (let x = 346; x <= 656; x += 22) { bars.moveTo(x, 626); bars.lineTo(x, 420 + Math.abs(x - 501) * 0.35); }
    k.stroke(iron, bars, 5);
    const scroll = k.P();
    scroll.moveTo(340, 470); scroll.quadraticCurveTo(501, 360, 662, 470);
    scroll.moveTo(340, 500); scroll.quadraticCurveTo(501, 400, 662, 500);
    for (let x = 372; x < 640; x += 44) { const sx = x + 14, sy = 452 - (1 - Math.abs(sx - 501) / 161) * 40; scroll.moveTo(sx + 12 * Math.cos(1.2), sy + 12 * Math.sin(1.2)); scroll.arc(sx, sy, 12, 1.2, 5.6); }
    k.stroke(iron, scroll, 4);
    for (let x = 346; x <= 656; x += 22) { const ty = 420 + Math.abs(x - 501) * 0.35; k.fill(iron, k.poly([x - 5, ty, x + 5, ty, x, ty - 16])); }
    k.fill({ y: 0.6, r: 0.5, b: 0.2 }, k.blob([340, 700, 350, 690, 360, 704, 352, 716]));
    /* boarded up to a height of six feet, the planks not closely adjusted */
    let x = 332;
    while (x < 668) {
      const w = k.R(34, 46), gap = k.R(5, 14);
      const pw = Math.min(w, 668 - x);
      const plank = k.rect(x, 612, pw, 400);
      k.fill({ y: 0.5, r: 0.36, b: 0.34 }, plank);
      k.clip(plank, () => {
        const gr = k.P();
        for (let i = 0; i < 4; i++) { const gx = x + k.R(4, pw - 4); gr.moveTo(gx, 612); gr.bezierCurveTo(gx + k.R(-6, 6), 760, gx + k.R(-6, 6), 880, gx + k.R(-4, 4), 1012); }
        k.addStroke({ b: 0.26, r: 0.14 }, gr, 1.6);
        k.add({ b: 0.18 }, k.rect(x + pw * 0.7, 612, pw * 0.3, 400));
      });
      k.fill(C.dark, k.circ(x + pw / 2, 650, 2.4)); k.fill(C.dark, k.circ(x + pw / 2, 960, 2.4));
      x += pw + gap;
    }
    k.fill({ y: 0.5, r: 0.36, b: 0.4 }, k.rect(332, 700, 336, 18));
    k.fill({ y: 0.5, r: 0.36, b: 0.4 }, k.rect(332, 900, 336, 18));
    /* the garden side: gravel, box and the stone bench */
    k.fill({ y: 0.44, r: 0.28, b: 0.2 }, k.rect(0, 1030, 1000, 220));
    for (let i = 0; i < 260; i++) { const gx = k.R(0, 1000), gy = k.R(1034, 1250); k.fill(k.rnd() < 0.5 ? { b: 0.4, r: 0.2, y: 0.3 } : { y: 0.2 }, k.circ(gx, gy, k.R(1.2, 3))); }
    k.fill(leaf, k.blob([0, 1034, 60, 1000, 170, 990, 250, 1020, 262, 1040, 0, 1046]));
    k.fill(leaf, k.blob([740, 1040, 780, 1004, 900, 990, 1000, 1000, 1000, 1046]));
    k.fill(stone, k.rect(24, 1102, 236, 26));
    k.add({ b: 0.2 }, k.rect(24, 1120, 236, 8));
    k.fill(stone, k.rect(44, 1128, 30, 70)); k.fill(stone, k.rect(212, 1128, 30, 70));
    k.add({ b: 0.3, r: 0.1 }, k.rect(20, 1198, 250, 12));
    /* a book, a parasol and a work-basket with the embroidered handkerchief */
    k.fill(C.red, k.poly([46, 1102, 120, 1102, 116, 1088, 50, 1088]));
    k.fill(C.cream, k.rect(52, 1090, 62, 4));
    k.fill({ y: 0.7, r: 0.5, b: 0.24 }, k.blob([150, 1102, 146, 1070, 200, 1062, 252, 1070, 248, 1102]));
    const wick = k.P(); for (let wx = 152; wx < 250; wx += 7) { wick.moveTo(wx, 1100); wick.lineTo(wx + 3, 1068); } k.addStroke({ r: 0.4, b: 0.3 }, wick, 1.4);
    k.stroke({ y: 0.7, r: 0.5, b: 0.24 }, k.blob([160, 1070, 200, 1030, 240, 1070], true), 4);
    k.cut(k.poly([236, 1070, 266, 1074, 262, 1150, 240, 1144]), 1);
    const emb = k.P(); emb.moveTo(242, 1130); emb.quadraticCurveTo(250, 1120, 258, 1132); k.addStroke({ b: 0.5 }, emb, 1.4);
    k.fill(C.rose, k.circ(250, 1112, 3)); k.fill(C.leaf, k.circ(244, 1116, 2));
    k.fill({ r: 0.45, y: 0.1 }, k.poly([30, 1210, 270, 1150, 274, 1160, 36, 1220]));
    k.stroke(C.dark, k.poly([272, 1152, 290, 1146], true), 3);
    /* Valentine at the planks, in a white dress with a blue sash */
    k.add({ b: 0.26, r: 0.08 }, k.poly([380, 1170, 520, 1150, 780, 1210, 600, 1240]));
    lady(k, 424, 1172, 452, { dir: 1, lean: 3, dress: { y: 0.04, b: 0.05 }, shade: { b: 0.2 }, sleeve: { y: 0.04, b: 0.07 }, sash: C.blue, hair: { y: 0.58, r: 0.5, b: 0.42 }, arms: 'plead', flounce: { b: 0.16 } });
    /* the low evening sun over everything */
    k.add({ y: k.lin(0, 0, 1000, 1250, [0, 0.16], [0.6, 0.04], [1, 0]) }, k.rect(0, 0, 1000, 1250));
  },
};

/* ── Chapter 53: the count and Haydée at the Opera ────────────────────── */
const opera = {
  w: 1400, h: 700, seed: 28888,
  draw(k) {
    k.fill({ r: 0.8, b: 0.62, y: 0.3 }, k.rect(0, 0, 1400, 700));
    const tiers = [[-80, 110], [138, 322], [350, 540]];
    const bend = (x, t) => -0.00011 * (x - 700) * (x - 700) * (0.7 + t * 0.25);
    const N = 9;
    const colX = (i) => 700 + Math.sin(((i / N) - 0.5) * 2.1) * 820;
    const gold = { y: 0.88, r: 0.34, b: 0.12 };
    const velvet = { r: 0.94, b: 0.3, y: 0.12 };
    const dress = [C.dark, C.navy, C.ink, C.cream, C.red, { r: 0.5, b: 0.5 }, C.gold, { b: 0.5 }];
    tiers.forEach(([top, bot], t) => {
      for (let i = 0; i < N; i++) {
        const x0 = colX(i), x1 = colX(i + 1);
        const y0a = top + bend(x0, t), y0b = top + bend(x1, t), y1a = bot + bend(x0, t), y1b = bot + bend(x1, t);
        const hH = y1a - y0a;
        const box = k.poly([x0, y0a, x1, y0b, x1, y1b, x0, y1a]);
        const center = t === 2 && i === 4;
        k.fill(center ? { r: 0.9, y: 0.3, b: 0.2 } : { r: 0.9, b: 0.52, y: 0.22 }, box);
        k.add({ b: 0.3 }, k.poly([x0, y0a, x1, y0b, x1, y0b + hH * 0.3, x0, y0a + hH * 0.3]));
        const pTop = (y) => y + hH * 0.66;
        if (!center) {
          /* heads and shoulders at the front of the box, many with glasses raised */
          const hh = hH * 0.36 * (0.9 + Math.abs(x0 - 700) / 1600);
          crowd(k, x0 + hh * 0.3, x1 - hh * 0.25, pTop((y0a + y0b) / 2) + hh * 0.25, hh, dress, { step: 0.55, arms: false, skin: C.skin });
          let gx = x0 + hh * 0.5;
          while (gx < x1 - hh * 0.4) {
            if (k.rnd() < 0.45) {
              const gy = pTop((y0a + y0b) / 2) + hh * 0.25 - hh * 0.8;
              const dx = gx < 700 ? 1 : -1;
              k.fill(C.gold, k.rect(gx + dx * hh * 0.05 - hh * 0.09, gy - hh * 0.05, hh * 0.18, hh * 0.1));
              k.fill(C.ink, k.circ(gx + dx * hh * 0.14, gy - hh * 0.03, hh * 0.05)); k.fill(C.ink, k.circ(gx + dx * hh * 0.14, gy + hh * 0.05, hh * 0.05));
            }
            gx += hh * 0.55 * (0.8 + k.rnd() * 0.5);
          }
        }
        /* the gilded front with its velvet rail */
        const f0 = pTop(y0a), f1 = pTop(y0b);
        k.fill(gold, k.poly([x0, f0, x1, f1, x1, y1b, x0, y1a]));
        k.fill(velvet, k.poly([x0, f0 - 5, x1, f1 - 5, x1, f1 + 6, x0, f0 + 6]));
        const orn = k.P();
        for (let j = 1; j < 4; j++) { const ox = x0 + (x1 - x0) * j / 4, oy = f0 + (f1 - f0) * j / 4 + (y1a - f0) * 0.55; orn.ellipse(ox, oy, (x1 - x0) * 0.07, (y1a - f0) * 0.18, 0, 0, Math.PI * 2); }
        k.addStroke({ r: 0.5, b: 0.3 }, orn, 1.4);
        k.add({ b: 0.2, r: 0.1 }, k.poly([x0, y1a - (y1a - f0) * 0.2, x1, y1b - (y1b - f1) * 0.2, x1, y1b, x0, y1a]));
        /* gilt pilaster between the boxes */
        k.fill(gold, k.poly([x0 - 4, y0a - 6, x0 + 4, y0a - 6, x0 + 4, y1a + 6, x0 - 4, y1a + 6]));
      }
    });
    /* the great chandelier, its light falling on the nearest boxes */
    chandelier(k, 330, 120, 86, { glow: 4.2, n: 11 });
    /* the box that belonged to the Russian ambassador, first circle */
    const bx0 = colX(4), bx1 = colX(5);
    const cx = (bx0 + bx1) / 2, rail = 350 + (540 - 350) * 0.66 + bend(cx, 2);
    k.cut(k.circ(cx, rail - 60, 230), k.rad(cx, rail - 60, 0, 230, [0, 0.55], [1, 0]));
    k.add({ y: k.rad(cx, rail - 60, 0, 230, [0, 0.5], [1, 0]) }, k.circ(cx, rail - 60, 230));
    person(k, cx - 52, rail + 130, 300, { dir: 1, coat: C.ink, legs: C.ink, shirt: C.cream, hair: C.ink, skin: PALE, long: true });
    haydee(k, cx + 30, rail + 170, 270, { dir: -1, burnous: { y: 0.05, b: 0.03 }, arms: 'clasp' });
    for (let i = 0; i < 14; i++) sparkle(k, cx + 30 + k.R(-24, 26), rail + 170 - 270 * k.R(0.66, 1.02), k.R(4, 8), 1);
    const f0 = rail + bend(bx0, 2) - bend(cx, 2), f1 = rail + bend(bx1, 2) - bend(cx, 2);
    k.fill(gold, k.poly([bx0, f0, bx1, f1, bx1, 540 + bend(bx1, 2), bx0, 540 + bend(bx0, 2)]));
    k.fill(velvet, k.poly([bx0, f0 - 5, bx1, f1 - 5, bx1, f1 + 6, bx0, f0 + 6]));
    k.fill(C.red, k.poly([bx0 + 8, f0 + 14, bx1 - 8, f1 + 14, bx1 - 8, f1 + 36, bx0 + 8, f0 + 36]));
    /* the pit, standing up and looking at one box */
    k.fill({ r: 0.7, b: 0.72, y: 0.36 }, k.rect(0, 580, 1400, 120));
    crowd(k, -10, 1410, 640, 68, [C.ink, C.dark, C.navy, { b: 0.8, r: 0.6, y: 0.5 }], { step: 0.36, arms: false });
    crowd(k, -20, 1420, 700, 92, [C.ink, C.dark, C.navy, { b: 0.95, r: 0.72, y: 0.5 }], { step: 0.34, arms: false });
    for (let i = 0; i < 9; i++) { const gx = k.R(60, 1340), gy = k.R(596, 640); k.fill(C.gold, k.rect(gx - 7, gy, 14, 6)); }
  },
};

/* ── Chapter 58: M. Noirtier, as his great glass sees him ─────────────── */
const noirtier = {
  w: 1200, h: 800, seed: 32144,
  draw(k) {
    /* panelled walls, the door on the left, the window on the right */
    const wallC = { y: 0.3, r: 0.1, b: 0.1 };
    k.fill(wallC, k.rect(0, 0, 1200, 600));
    const pan = k.P();
    for (const [x, w] of [[40, 120], [340, 200], [580, 260], [880, 60]]) { pan.rect(x, 90, w, 210); pan.rect(x, 340, w, 220); }
    k.addStroke({ y: 0.3, r: 0.16, b: 0.14 }, pan, 5);
    k.cut(pan, 0.35, 1.6);
    k.fill({ y: 0.4, r: 0.2, b: 0.2 }, k.rect(0, 560, 1200, 40));
    /* the window and its light across the floor */
    sky(k, 110, 520, [[0, { b: 0.3 }], [1, { b: 0.1, y: 0.12 }]], 960, 1140);
    const mull = k.P(); mull.rect(960, 110, 180, 410); mull.moveTo(1050, 110); mull.lineTo(1050, 520); for (let y = 190; y < 520; y += 82) { mull.moveTo(960, y); mull.lineTo(1140, y); }
    k.stroke({ y: 0.5, r: 0.3, b: 0.3 }, mull, 7);
    drape(k, 918, 80, 70, 520, { r: 0.55, b: 0.46, y: 0.3 }, { tie: 0.5, folds: 3 });
    drape(k, 1112, 80, 88, 520, { r: 0.55, b: 0.46, y: 0.3 }, { tie: 0.5, folds: 3 });
    parquet(k, 0, 600, 1200, 800, 600, { y: 0.56, r: 0.4, b: 0.26 }, { boards: 20 });
    const beam = k.poly([960, 600, 1140, 600, 900, 800, 520, 800]);
    k.cut(beam, k.lin(1050, 600, 700, 800, [0, 0.55], [1, 0.1]));
    k.add({ y: 0.2 }, beam);
    /* the door opens: his son and his son's wife come in, ceremoniously */
    k.fill({ y: 0.5, r: 0.28, b: 0.22 }, k.rect(96, 150, 220, 450));
    k.fill({ b: 0.86, r: 0.6, y: 0.4 }, k.rect(112, 166, 188, 434));
    k.fill({ y: 0.36, r: 0.16, b: 0.14 }, k.poly([112, 166, 150, 150, 150, 616, 112, 600]));
    person(k, 186, 606, 330, { dir: 1, coat: C.ink, legs: C.ink, shirt: C.cream, hair: C.ink, long: true });
    lady(k, 262, 604, 300, { dir: 1, dress: C.plum, shade: { b: 0.3 }, hair: { y: 0.6, r: 0.5, b: 0.4 }, arms: 'clasp' });
    /* the armchair on casters, and the old man in it */
    const cx = 590, fy = 776;
    k.add({ b: 0.3, r: 0.14 }, k.ell(cx, fy, 210, 26));
    armchair(k, cx, fy, 340, { cloth: { b: 0.62, r: 0.4, y: 0.34 }, casters: true });
    const gown = { b: 0.66, r: 0.72, y: 0.42 };
    k.fill(gown, k.poly([486, 486, 694, 486, 716, 650, 464, 650]));
    k.add({ b: 0.3 }, k.poly([600, 486, 694, 486, 716, 650, 600, 650]));
    k.fill(C.cream, k.poly([566, 486, 634, 486, 600, 548]));
    /* a rug over the knees (the book does not say; ours) */
    const rug = k.blob([450, 636, 730, 636, 758, 700, 746, 762, 454, 762, 442, 700]);
    k.fill({ b: 0.84, r: 0.3 }, rug);
    k.clip(rug, () => { for (let y = 650; y < 770; y += 26) k.fill(C.red, k.rect(430, y, 340, 6)); for (let x = 470; x < 760; x += 40) k.add({ y: 0.4 }, k.rect(x, 630, 5, 140)); });
    /* arms lying still on the arms of the chair */
    for (const d of [-1, 1]) {
      k.stroke(gown, k.poly([cx + d * 96, 498, cx + d * 128, 560, cx + d * 132, 626], true), 38);
      k.fill(PALE, k.ell(cx + d * 136, 640, 20, 13));
    }
    /* long white hair over the shoulders, the face, and the living eyes */
    k.fill({ b: 0.12, y: 0.04 }, k.blob([530, 520, 520, 430, 540, 350, 600, 330, 660, 350, 680, 430, 670, 520, 640, 500, 630, 420, 570, 420, 560, 500]));
    const strands = k.P(); for (let i = 0; i < 16; i++) { const sx = 530 + i * 9.5; strands.moveTo(sx, 360 + Math.abs(i - 7.5) * 4); strands.quadraticCurveTo(sx + (i < 8 ? -8 : 8), 440, sx + (i < 8 ? -4 : 4), 516); }
    k.addStroke({ b: 0.2, r: 0.06 }, strands, 1.6);
    k.fill(PALE, k.rect(582, 440, 36, 50));
    k.fill(PALE, k.ell(600, 404, 44, 54));
    k.add({ b: 0.14 }, k.ell(620, 410, 22, 48));
    k.fill({ b: 0.12, y: 0.04 }, k.blob([556, 392, 560, 360, 600, 346, 640, 360, 644, 392, 630, 370, 600, 364, 570, 370]));
    for (const ex of [580, 620]) {
      k.add({ r: 0.14, b: 0.1 }, k.ell(ex, 404, 15, 9));
      k.cut(k.ell(ex, 402, 11, 6.2), 1);
      k.fill({ b: 1, r: 0.86, y: 0.5 }, k.circ(ex + 1, 402, 5.6));
      k.cut(k.circ(ex + 2.8, 400, 2), 1);
      k.fill(C.gold, k.circ(ex - 1, 403.8, 1));
      const lash = k.P(); lash.moveTo(ex - 15, 402); lash.quadraticCurveTo(ex, 388, ex + 15, 401);
      k.stroke(C.ink, lash, 4.6);
      const low = k.P(); low.moveTo(ex - 12, 406); low.quadraticCurveTo(ex, 413, ex + 12, 406);
      k.stroke(C.ink, low, 1.6);
      k.fill({ b: 0.3, y: 0.06 }, k.poly([ex - 16, 382, ex + 14, 378, ex + 15, 383, ex - 15, 387]));
    }
    k.add({ r: 0.2, b: 0.12 }, k.poly([598, 404, 604, 404, 608, 428, 596, 428]));
    k.stroke({ r: 0.4, b: 0.3 }, k.poly([588, 444, 612, 444], true), 2.4);
    /* Valentine, who reads everything in that look */
    lady(k, 800, 780, 430, { dir: -1, lean: 4, dress: { b: 0.2, y: 0.05 }, shade: { b: 0.26 }, sash: { b: 0.5 }, hair: { y: 0.6, r: 0.52, b: 0.44 }, arms: 'plead', flounce: { b: 0.14 } });
    /* the great glass itself: this whole picture is what it shows him */
    k.cut(k.poly([0, 180, 180, 0, 260, 0, 0, 260]), 0.12);
    k.cut(k.poly([1200, 520, 1200, 600, 920, 800, 840, 800]), 0.1);
    frame(k, 0, 0, 1200, 800, 24);
  },
};

/* ── Chapter 61: the telegraph tower of Montlhéry and its garden ──────── */
const telegraph = {
  w: 1000, h: 1250, seed: 33532,
  draw(k) {
    sky(k, 0, 560, [[0, { b: 0.44 }], [1, { b: 0.08, y: 0.12 }]]);
    cloud(k, { b: 0.1 }, 480, 150, 420, 30, 8);
    /* the plain below: fields, the road to Orléans, Linas and its own telegraph */
    const field = [{ y: 0.6, r: 0.14 }, { y: 0.5, b: 0.36 }, { y: 0.34, r: 0.1, b: 0.1 }, { y: 0.66, r: 0.2, b: 0.1 }, { y: 0.44, b: 0.24 }];
    for (let r = 0; r < 7; r++) {
      const y0 = 560 + r * r * 5.4, y1 = 560 + (r + 1) * (r + 1) * 5.4;
      let x = -20;
      while (x < 1000) { const w = k.R(60, 160) * (1 + r * 0.3); k.fill(k.pick(field), k.poly([x, y0, x + w, y0, x + w * 1.1, y1, x - w * 0.1, y1])); x += w; }
    }
    k.add({ b: 0.18 }, k.rect(0, 560, 1000, 24));
    k.stroke({ y: 0.3, r: 0.2 }, k.poly([1000, 600, 760, 580, 560, 566, 420, 562], true), 5);
    houses(k, 650, 760, 578, { hmin: 8, hmax: 16, wmin: 10, wmax: 18, row: 8, shutters: false, win: { b: 0.4 }, cols: [{ b: 0.2, y: 0.1 }, { y: 0.2, r: 0.08 }] });
    k.stroke(C.dark, k.poly([880, 572, 880, 540], true), 2);
    k.stroke(C.dark, k.poly([870, 540, 890, 536], true), 2);
    k.stroke(C.dark, k.poly([870, 540, 866, 530], true), 1.5); k.stroke(C.dark, k.poly([890, 536, 896, 546], true), 1.5);
    /* the hill top: black earth and the hedge whose flowers are now green fruit */
    k.fill({ b: 0.62, r: 0.44, y: 0.5 }, k.blob([-40, 1250, -40, 700, 200, 668, 600, 660, 1040, 690, 1040, 1250]));
    const hedge = k.blob([380, 780, 380, 730, 470, 700, 640, 694, 820, 700, 1010, 690, 1010, 790]);
    k.fill({ b: 0.74, y: 0.72, r: 0.22 }, hedge);
    k.clip(hedge, () => {
      for (let i = 0; i < 60; i++) { const x = k.R(380, 1010), y = k.R(700, 790); k.add({ b: 0.3, r: 0.14 }, k.circ(x, y, k.R(8, 18))); }
      for (let i = 0; i < 70; i++) k.fill({ y: 0.7, b: 0.3 }, k.circ(k.R(380, 1010), k.R(704, 784), k.R(2.4, 4)));
    });
    /* the little wooden gate on willow hinges, fastened with a nail and string */
    k.fill({ y: 0.56, r: 0.38, b: 0.3 }, k.rect(880, 716, 76, 76));
    const slat = k.P(); for (let x = 888; x < 956; x += 14) { slat.moveTo(x, 716); slat.lineTo(x, 792); } slat.moveTo(880, 736); slat.lineTo(956, 772);
    k.addStroke({ b: 0.3, r: 0.2 }, slat, 3);
    k.stroke({ y: 0.4 }, k.poly([956, 740, 966, 752, 958, 764], true), 1.4);
    /* the soil black as soot */
    k.fill({ b: 0.8, r: 0.62, y: 0.52 }, k.rect(380, 790, 620, 460));
    k.fill({ b: 0.8, r: 0.62, y: 0.52 }, k.rect(0, 900, 400, 350));
    /* the red gravel path in the figure of 8, edged with thick box */
    const eight = k.P();
    eight.ellipse(560, 1010, 170, 84, 0, 0, Math.PI * 2);
    eight.moveTo(1000, 1010); eight.ellipse(830, 1010, 170, 84, 0, 0, Math.PI * 2);
    k.stroke({ b: 0.8, y: 0.66, r: 0.3 }, eight, 64);
    k.stroke({ r: 0.62, y: 0.58, b: 0.1 }, eight, 40);
    const grit = k.P(); for (let i = 0; i < 500; i++) { const a = k.R(0, Math.PI * 2), c = k.rnd() < 0.5 ? 560 : 830; grit.moveTo(c + Math.cos(a) * 170 + k.R(-14, 14), 1010 + Math.sin(a) * 84 + k.R(-12, 12)); grit.lineTo(c + Math.cos(a) * 170 + k.R(-14, 14) + 1.6, 1010 + Math.sin(a) * 84 + k.R(-12, 12)); }
    k.addStroke({ r: 0.3, b: 0.2 }, grit, 2);
    /* the twenty rose-trees of the parterre, and not a slug on them */
    const rose = (x, y, s) => {
      k.stroke({ b: 0.7, r: 0.4, y: 0.4 }, k.poly([x, y, x, y - 30 * s], true), 3 * s);
      k.fill({ b: 0.7, y: 0.72, r: 0.2 }, k.blob([x - 22 * s, y - 30 * s, x - 14 * s, y - 56 * s, x + 12 * s, y - 60 * s, x + 24 * s, y - 34 * s]));
      for (let j = 0; j < 5; j++) k.fill(k.pick([C.red, C.rose, { r: 0.9, y: 0.3 }]), k.circ(x + k.R(-16, 16) * s, y - k.R(34, 56) * s, 4.4 * s));
    };
    const spots = [[520, 990], [600, 1000], [560, 1036], [790, 990], [870, 996], [830, 1034], [420, 900], [470, 870], [640, 880], [720, 900], [940, 900], [980, 950], [420, 1150], [500, 1140], [640, 1150], [760, 1140], [880, 1150], [690, 1010], [350, 980], [560, 960]];
    for (const [x, y] of spots.sort((a, b) => a[1] - b[1])) rose(x, y, 0.8 + (y - 860) / 900);
    /* the tank of water, a frog and a toad on opposite sides */
    k.fill({ y: 0.4, r: 0.3, b: 0.3 }, k.rect(806, 1150, 180, 84));
    k.fill({ b: 0.72, r: 0.14 }, k.rect(818, 1162, 156, 60));
    k.cut(k.rect(830, 1176, 60, 3), 0.6); k.cut(k.rect(900, 1196, 50, 3), 0.5);
    k.fill({ b: 0.6, y: 0.9 }, k.ell(830, 1158, 12, 7)); k.fill(C.ink, k.circ(836, 1154, 1.6));
    k.fill({ y: 0.5, r: 0.5, b: 0.4 }, k.ell(964, 1228, 13, 8)); k.fill(C.ink, k.circ(958, 1224, 1.6));
    /* the old tower, covered with ivy and studded with wall-flowers */
    const tw = { y: 0.42, r: 0.24, b: 0.22 };
    k.fill(tw, k.rect(70, 300, 300, 670));
    k.add({ b: 0.24, r: 0.1 }, k.rect(250, 300, 120, 670));
    stonework(k, 70, 310, 300, 660, 36, { y: 0.08, b: 0.06 }, { mortar: 0.25 });
    k.fill(C.dark, k.blob([150, 970, 150, 830, 190, 800, 230, 830, 230, 970]));
    k.fill(C.dark, k.rect(200, 420, 32, 60)); k.fill(C.dark, k.rect(130, 620, 30, 54));
    const ivy = (pts) => {
      const p = k.blob(pts);
      k.fill({ b: 0.86, y: 0.6, r: 0.36 }, p);
      k.clip(p, () => { for (let i = 0; i < 70; i++) { const x = k.R(40, 400), y = k.R(150, 980); k.add({ y: 0.4, b: 0.1 }, k.ell(x, y, k.R(5, 9), k.R(3, 6), k.R(0, 3))); } });
    };
    ivy([60, 980, 50, 760, 80, 620, 120, 540, 170, 580, 150, 700, 190, 800, 250, 830, 300, 980]);
    ivy([300, 720, 340, 600, 376, 540, 376, 900, 330, 860]);
    ivy([70, 420, 110, 340, 180, 316, 170, 400, 120, 460]);
    for (let i = 0; i < 90; i++) { const x = k.R(70, 370), y = k.R(320, 960); if (k.rnd() < 0.5) continue; for (let j = 0; j < 4; j++) k.fill(k.pick([C.gold, C.orange, { y: 0.9, r: 0.4 }]), k.circ(x + Math.cos(j * 1.57) * 3.6, y + Math.sin(j * 1.57) * 3.6, 3)); }
    /* the sun-dial */
    k.fill({ y: 0.4, r: 0.2, b: 0.2 }, k.rect(398, 830, 22, 80));
    k.fill({ y: 0.5, r: 0.3, b: 0.2 }, k.ell(409, 830, 30, 8));
    k.fill(C.dark, k.poly([400, 828, 420, 828, 410, 810]));
    /* the telegraph on the top, with its great bony arms */
    k.fill(tw, k.rect(56, 280, 328, 30));
    k.add({ b: 0.2 }, k.rect(56, 302, 328, 8));
    const wood = { b: 0.8, r: 0.66, y: 0.5 };
    k.stroke(wood, k.poly([220, 282, 220, 150], true), 10);
    k.stroke(wood, k.poly([150, 282, 220, 200, 290, 282], true), 4);
    const rx = 220, ry = 176, ra = -0.18, rl = 150;
    const r0 = [rx - Math.cos(ra) * rl, ry - Math.sin(ra) * rl], r1 = [rx + Math.cos(ra) * rl, ry + Math.sin(ra) * rl];
    k.stroke(wood, k.poly([...r0, ...r1], true), 12);
    const lou = k.P(); for (let t = -0.9; t <= 0.9; t += 0.15) { const px = rx + Math.cos(ra) * rl * t, py = ry + Math.sin(ra) * rl * t; lou.moveTo(px - 4, py - 8); lou.lineTo(px + 4, py + 8); }
    k.cut(lou, 0.6, 2);
    const armAt = ([ax, ay], a) => {
      const bx = ax + Math.cos(a) * 80, by = ay + Math.sin(a) * 80;
      k.stroke(wood, k.poly([ax, ay, bx, by], true), 8);
      k.fill(wood, k.circ(ax - Math.cos(a) * 16, ay - Math.sin(a) * 16, 7));
      k.fill(C.dark, k.circ(ax, ay, 4));
    };
    armAt(r0, -2.2); armAt(r1, 0.9);
    /* the wheelbarrow filled with leaves, and the gardener rising from behind it */
    person(k, 330, 1176, 300, { dir: 1, coat: C.cream, sleeve: C.cream, legs: { b: 0.5, r: 0.3, y: 0.3 }, apron: { b: 0.5, y: 0.26 }, hair: { b: 0.2, y: 0.06 }, arms: 'hold', lean: 4 });
    for (let i = 0; i < 5; i++) { const lx = 350 + i * 9, ly = 1002 + (i % 2) * 5; k.fill({ b: 0.6, y: 0.85 }, k.ell(lx, ly, 12, 7, 0.3)); }
    for (const [sx, sy] of [[350, 996], [364, 999], [378, 994], [394, 1030], [404, 1060], [398, 1100]]) k.fill(C.red, k.circ(sx, sy, 4));
    const bar = { y: 0.6, r: 0.46, b: 0.34 };
    k.fill(bar, k.poly([240, 1120, 420, 1120, 400, 1190, 262, 1190]));
    k.fill({ y: 0.7, b: 0.5, r: 0.3 }, k.blob([244, 1122, 260, 1090, 320, 1074, 380, 1082, 420, 1110]));
    for (let i = 0; i < 26; i++) k.fill(k.pick([{ y: 0.8, r: 0.4 }, { y: 0.7, b: 0.5 }, { y: 0.6, r: 0.6 }]), k.ell(k.R(250, 414), k.R(1084, 1118), 9, 5, k.R(0, 3)));
    k.fill(C.dark, k.circ(420, 1200, 26)); k.cut(k.circ(420, 1200, 8), 0.5);
    k.stroke(bar, k.poly([262, 1190, 220, 1236], true), 8);
    /* the count, who has left his horse at the foot of the hill */
    person(k, 700, 1206, 380, { dir: -1, coat: C.ink, legs: C.ink, boots: C.ink, shirt: C.cream, hair: C.ink, skin: PALE, hat: 'top', hatC: C.ink, long: true });
  },
};

/* ── Chapter 63: an Oriental feast at Auteuil ─────────────────────────── */
const feast = {
  w: 1200, h: 800, seed: 34466,
  draw(k) {
    /* dark damask walls */
    k.fill({ r: 0.86, b: 0.56, y: 0.3 }, k.rect(0, 0, 1200, 470));
    const dam = k.P();
    for (let y = 30; y < 470; y += 60) for (let x = (y / 60) % 2 ? 30 : 0; x < 1200; x += 60) { dam.moveTo(x, y - 14); dam.quadraticCurveTo(x + 12, y, x, y + 14); dam.quadraticCurveTo(x - 12, y, x, y - 14); }
    k.add({ b: 0.3, r: 0.1 }, dam);
    chandelier(k, 600, 110, 90, { glow: 5, n: 11 });
    /* four servants bring in two casks covered with water plants, a live fish in each */
    const livery = { b: 0.82, r: 0.36 };
    const cask = (x, y) => {
      person(k, x - 90, y + 150, 250, { dir: 1, coat: livery, legs: C.cream, shirt: C.cream, hair: { b: 0.2 }, arms: 'hold' });
      person(k, x + 90, y + 150, 250, { dir: -1, coat: livery, legs: C.cream, shirt: C.cream, hair: C.ink, arms: 'hold' });
      k.fill({ y: 0.62, r: 0.48, b: 0.36 }, k.blob([x - 70, y, x - 76, y - 50, x - 64, y - 96, x + 64, y - 96, x + 76, y - 50, x + 70, y]));
      for (const hy of [-18, -78]) k.stroke(C.dark, k.poly([x - 72, y + hy, x + 72, y + hy], true), 6);
      k.fill({ b: 0.7, r: 0.1 }, k.ell(x, y - 96, 64, 12));
      for (let i = 0; i < 14; i++) { const lx = x + k.R(-80, 80); k.stroke({ b: 0.7, y: 0.8 }, k.poly([lx, y - 94, lx + k.R(-30, 30), y - 94 + k.R(-10, 60)], true), k.R(3, 6)); }
      k.fill({ b: 0.5, r: 0.3, y: 0.2 }, k.ell(x + 10, y - 100, 22, 8));
      k.cut(k.circ(x + 24, y - 102, 2), 1);
    };
    cask(250, 330);
    cask(960, 320);
    /* the table: a white cloth, and on it the four quarters of the globe */
    k.fill({ b: 0.08, y: 0.03 }, k.poly([0, 470, 1200, 470, 1200, 800, 0, 800]));
    k.add({ b: 0.14 }, k.rect(0, 470, 1200, 12));
    const folds = k.P(); for (let x = 60; x < 1200; x += 150) { folds.moveTo(x, 482); folds.lineTo(x - 20, 800); } k.addStroke({ b: 0.1 }, folds, 2);
    /* candles on the table */
    for (const [x, h] of [[440, 90], [760, 90]]) { k.fill(C.gold, k.rect(x - 14, 512, 28, 12)); candle(k, x, 512, h, { glow: 180 }); }
    const silver = { b: 0.3, r: 0.1, y: 0.08 };
    const dish = (x, y, rx, ry) => {
      k.add({ b: 0.22, r: 0.08 }, k.ell(x + 8, y + 10, rx, ry));
      k.fill(silver, k.ell(x, y, rx, ry));
      k.fill({ b: 0.16, y: 0.04 }, k.ell(x, y, rx * 0.84, ry * 0.8));
      k.cut(k.ell(x - rx * 0.4, y - ry * 0.55, rx * 0.3, ry * 0.12), 0.9);
    };
    /* the sterlet from beyond St. Petersburg: long snout, rows of bony plates */
    dish(380, 600, 250, 62);
    const st = k.blob([160, 600, 230, 578, 380, 568, 520, 580, 590, 596, 520, 614, 380, 624, 230, 616]);
    k.fill({ b: 0.56, r: 0.3, y: 0.32 }, st);
    k.fill({ b: 0.56, r: 0.3, y: 0.32 }, k.poly([160, 600, 110, 596, 160, 590]));
    k.fill({ b: 0.56, r: 0.3, y: 0.32 }, k.poly([580, 598, 640, 572, 628, 600, 644, 626]));
    k.clip(st, () => { k.add({ y: 0.3 }, k.rect(150, 604, 460, 30)); for (let x = 220; x < 560; x += 22) { k.fill({ y: 0.6, r: 0.3, b: 0.2 }, k.poly([x, 574, x + 8, 568, x + 16, 576, x + 8, 582])); k.fill({ y: 0.6, r: 0.3, b: 0.2 }, k.poly([x + 6, 600, x + 13, 596, x + 20, 602, x + 13, 606])); } });
    k.fill(C.ink, k.circ(196, 594, 4)); k.cut(k.circ(197, 593, 1.2), 1);
    /* the lamprey from Lake Fusaro */
    dish(820, 690, 240, 62);
    const lp = k.P(); lp.moveTo(610, 700); lp.bezierCurveTo(700, 650, 780, 740, 870, 690); lp.bezierCurveTo(940, 650, 990, 690, 1030, 676);
    k.stroke({ b: 0.7, r: 0.56, y: 0.5 }, lp, 30);
    k.addStroke({ y: 0.4, r: 0.1 }, lp, 8);
    k.fill({ b: 0.7, r: 0.56, y: 0.5 }, k.circ(1030, 676, 18));
    k.fill({ r: 0.5, y: 0.2 }, k.circ(1044, 676, 7));
    for (let i = 0; i < 7; i++) k.cut(k.circ(1000 - i * 10, 670 + Math.sin(i) * 2, 2.4), 0.8);
    /* rare birds keeping their brilliant plumage */
    dish(1060, 520, 120, 36);
    k.fill({ y: 0.7, r: 0.62, b: 0.2 }, k.blob([1000, 520, 1030, 488, 1090, 484, 1120, 510, 1080, 530]));
    k.fill(C.navy, k.circ(1116, 484, 12)); k.fill(C.red, k.circ(1122, 480, 5));
    for (let i = 0; i < 5; i++) k.fill(k.pick([C.gold, C.blue, C.red, C.orange]), k.poly([1000, 516, 900 - i * 12, 440 + i * 10, 910 - i * 10, 452 + i * 10]));
    /* fruit heaped in a vase from China, blue on white */
    const vase = k.blob([100, 560, 70, 520, 66, 470, 90, 430, 150, 430, 176, 470, 172, 520, 142, 560]);
    k.fill({ b: 0.05 }, vase);
    k.clip(vase, () => { const pat = k.P(); for (let y = 440; y < 560; y += 22) { pat.moveTo(60, y); for (let x = 60; x < 180; x += 12) pat.quadraticCurveTo(x + 6, y - 8, x + 12, y); } k.addStroke(C.blue, pat, 3); k.add({ b: 0.2 }, k.rect(140, 420, 50, 150)); });
    const fruit = (x, y, r, spec) => { k.fill(spec, k.circ(x, y, r)); k.cut(k.circ(x - r * 0.35, y - r * 0.35, r * 0.25), 0.6); };
    for (let i = 0; i < 16; i++) fruit(80 + k.R(0, 80), 420 - k.R(0, 60) + (i % 3) * 6, k.R(12, 20), k.pick([C.orange, C.gold, C.red, { r: 0.8, y: 0.8 }, { b: 0.5, y: 0.9 }]));
    for (let i = 0; i < 20; i++) fruit(40 + k.R(0, 50), 440 + k.R(0, 70), 6, C.plum);
    /* and in a jar from Japan */
    const jar = k.blob([1110, 470, 1080, 440, 1080, 380, 1100, 350, 1180, 350, 1200, 380, 1200, 440, 1170, 470]);
    k.fill({ r: 0.9, y: 0.3 }, jar);
    k.clip(jar, () => { k.fill(C.gold, k.rect(1070, 392, 140, 14)); for (let i = 0; i < 6; i++) k.fill(C.gold, k.circ(1090 + i * 20, 430, 5)); k.add({ b: 0.3 }, k.rect(1170, 340, 40, 140)); });
    for (let i = 0; i < 10; i++) fruit(1110 + k.R(0, 80), 340 - k.R(0, 40), k.R(12, 18), k.pick([C.orange, C.gold, { b: 0.5, y: 0.9 }, C.red]));
    /* wines of the Archipelago, Asia Minor and the Cape, in bottles of grotesque shape */
    const bottles = [[560, 520, 100, { b: 0.7, y: 0.6 }], [640, 516, 130, { r: 0.8, b: 0.6 }], [720, 522, 90, { y: 0.8, r: 0.4 }]];
    for (const [bx, by, bh, sp] of bottles) bottle(k, bx, by, bh, sp);
    k.fill({ b: 0.6, y: 0.6, r: 0.3 }, k.blob([790, 520, 770, 500, 780, 470, 800, 460, 796, 440, 812, 440, 810, 460, 834, 474, 836, 504, 816, 520]));
    k.cut(k.rect(784, 478, 4, 26), 0.6);
    k.fill({ r: 0.7, b: 0.7, y: 0.2 }, k.blob([490, 522, 470, 480, 490, 470, 480, 440, 500, 420, 520, 440, 510, 470, 530, 480, 512, 522]));
    glass(k, 300, 520, 50, { b: 0.2 }); glass(k, 880, 540, 50, { b: 0.2 });
  },
};

/* ── Chapter 69: the Abbé Busoni turns the lamp shade ─────────────────── */
const busoni = {
  w: 1200, h: 800, seed: 37242,
  draw(k) {
    k.fill({ b: 0.9, r: 0.66, y: 0.4 }, k.rect(0, 0, 1200, 800));
    /* shelves of theological books and parchments */
    const shelf = { y: 0.5, r: 0.44, b: 0.46 };
    for (let s = 0; s < 5; s++) {
      const y = 110 + s * 100;
      k.fill(shelf, k.rect(0, y, 1200, 12));
      books(k, 6, y, 1190, 84, { cols: [{ r: 0.8, b: 0.5, y: 0.4 }, { y: 0.6, r: 0.5, b: 0.5 }, { b: 0.8, r: 0.5, y: 0.2 }, { y: 0.7, r: 0.4, b: 0.3 }, { r: 0.6, b: 0.7, y: 0.5 }], min: 10, max: 22 });
      for (let i = 0; i < 3; i++) { const px = k.R(40, 1150); k.fill({ y: 0.4, r: 0.14, b: 0.1 }, k.poly([px, y, px + 40, y, px + 36, y - 20, px + 4, y - 20])); k.fill({ y: 0.4, r: 0.14, b: 0.1 }, k.circ(px + 4, y - 10, 10)); }
    }
    /* the rest of the room in partial darkness */
    k.add({ b: k.rad(600, 420, 120, 700, [0, 0], [1, 0.6]), r: k.rad(600, 420, 120, 700, [0, 0], [1, 0.45]), y: k.rad(600, 420, 120, 700, [0, 0], [1, 0.2]) }, k.rect(0, 0, 1200, 800));
    /* the table with its parchments and an open folio */
    k.fill({ y: 0.54, r: 0.5, b: 0.5 }, k.rect(250, 540, 700, 40));
    k.fill({ y: 0.5, r: 0.5, b: 0.56 }, k.rect(250, 580, 700, 220));
    k.fill({ y: 0.34, r: 0.1, b: 0.08 }, k.poly([330, 540, 470, 540, 480, 520, 330, 522]));
    k.fill({ y: 0.34, r: 0.1, b: 0.08 }, k.poly([640, 540, 800, 540, 790, 516, 650, 522]));
    const lines = k.P(); for (let y = 526; y < 538; y += 4) { lines.moveTo(340, y); lines.lineTo(470, y); lines.moveTo(656, y); lines.lineTo(790, y); } k.addStroke(C.dark, lines, 1);
    /* the lamp, its large shade pressed down on the abbé's side */
    const lx = 560, ly = 420;
    lampCone(k, lx + 20, ly + 6, 90, -0.24, 500, { spread: 0.34 });
    k.cut(k.ell(lx, 540, 170, 20), k.rad(lx, 540, 0, 170, [0, 0.8], [1, 0]));
    k.add({ y: k.rad(lx, 540, 0, 170, [0, 0.6], [1, 0]) }, k.ell(lx, 540, 170, 20));
    k.fill(C.gold, k.poly([lx - 24, 540, lx + 24, 540, lx + 10, 500, lx - 10, 500]));
    k.fill(C.gold, k.rect(lx - 6, 440, 12, 62));
    k.fill({ y: 0.5, r: 0.1 }, k.ell(lx, 436, 14, 26));
    k.fill({ b: 0.92, r: 0.7, y: 0.6 }, k.poly([lx - 110, 420, lx + 60, 360, lx + 40, 330, lx - 50, 380]));
    k.fill({ b: 0.92, r: 0.7, y: 0.6 }, k.poly([lx - 50, 380, lx + 40, 330, lx + 10, 300, lx - 30, 318]));
    k.fill({ y: 0.9, r: 0.24 }, k.poly([lx - 106, 422, lx + 62, 362, lx + 60, 368, lx - 104, 428]));
    /* the abbé in a monk's dress, a cowl on his head, his face in shadow */
    const robe = { b: 0.85, r: 0.78, y: 0.62 };
    k.fill(robe, k.blob([200, 800, 190, 600, 214, 460, 270, 370, 330, 350, 400, 400, 420, 520, 430, 800]));
    k.fill(robe, k.blob([250, 420, 244, 330, 280, 270, 336, 262, 380, 300, 384, 380, 350, 410]));
    k.fill({ y: 0.4, r: 0.4, b: 0.46 }, k.blob([330, 330, 340, 300, 372, 298, 380, 340, 364, 372, 340, 368]));
    k.stroke(robe, k.poly([380, 440, 440, 420, 470, 402], true), 34);
    k.fill({ y: 0.5, r: 0.36, b: 0.2 }, k.ell(476, 400, 16, 11));
    k.stroke({ y: 0.4, r: 0.3, b: 0.3 }, k.poly([240, 500, 260, 700], true), 3);
    /* the stranger, with the light full in his face */
    person(k, 920, 800, 470, { dir: -1, coat: C.ink, legs: C.ink, shirt: C.cream, hair: { b: 0.7, r: 0.5, y: 0.4 }, skin: { y: 0.6, r: 0.24 }, long: true, arms: 'down' });
    k.stroke(C.ink, k.poly([884, 432, 850, 404, 868, 356], true), 24);
    k.fill({ y: 0.6, r: 0.24 }, k.ell(872, 348, 10, 13));
    k.add({ y: 0.3 }, k.ell(904, 370, 70, 80));
  },
};

/* ── Chapter 71: grapes and a peach in the hothouse ───────────────────── */
const hothouse = {
  w: 1000, h: 1250, seed: 38213,
  draw(k) {
    /* night outside the glass, the lindens, the lit house and its ball */
    k.fill({ b: 0.92, r: 0.52, y: 0.14 }, k.rect(0, 0, 1000, 1250));
    k.fill({ b: 1, r: 0.66, y: 0.44 }, k.blob([-40, 900, -40, 560, 60, 470, 160, 520, 240, 450, 330, 520, 420, 470, 520, 540, 620, 480, 720, 540, 820, 470, 920, 530, 1040, 470, 1040, 900]));
    for (const [x, y] of [[120, 720], [260, 700], [420, 690], [600, 700]]) k.fill(C.gold, k.rect(x, y, 16, 30));
    /* the frame of the conservatory: arched iron bars and panes */
    const iron = { b: 0.8, r: 0.5, y: 0.4 };
    const bars = k.P();
    for (let x = 0; x <= 1000; x += 125) { bars.moveTo(x, 1250); bars.lineTo(x, 300); }
    bars.moveTo(0, 300); bars.quadraticCurveTo(500, -20, 1000, 300);
    for (let x = 62; x < 1000; x += 125) { const t = x / 1000, yTop = 300 - 4 * t * (1 - t) * 160; bars.moveTo(x, 300); bars.lineTo(x, yTop + 2); }
    for (const y of [560, 820]) { bars.moveTo(0, y); bars.lineTo(1000, y); }
    k.stroke(iron, bars, 7);
    const panes = k.P(); for (let i = 0; i < 16; i++) { const x = k.R(20, 980), y = k.R(320, 1000); panes.moveTo(x, y); panes.lineTo(x + 30, y - 30); } k.cut(panes, 0.35, 2);
    /* inside, the warmth of the house: light from the ball through the open doors */
    k.cut(k.rect(0, 860, 1000, 390), k.lin(0, 860, 0, 1250, [0, 0.2], [1, 0.6]));
    k.add({ y: k.lin(0, 860, 0, 1250, [0, 0.4], [1, 0.3]), r: 0.1 }, k.rect(0, 860, 1000, 390));
    k.fill({ y: 0.5, r: 0.34, b: 0.26 }, k.rect(0, 850, 1000, 20));
    /* the peach tree against the wall */
    const pw = { y: 0.4, r: 0.2, b: 0.2 };
    k.fill(pw, k.rect(760, 500, 240, 360));
    const fan = k.P(); for (let a = -1.2; a <= 1.2; a += 0.3) { fan.moveTo(880, 860); fan.quadraticCurveTo(880 + Math.sin(a) * 60, 760, 880 + Math.sin(a) * 140, 860 - Math.cos(a) * 320); }
    k.stroke({ b: 0.6, r: 0.5, y: 0.4 }, fan, 5);
    for (let i = 0; i < 40; i++) { const a = k.R(-1.2, 1.2), t = k.R(0.3, 1); k.fill({ b: 0.7, y: 0.75, r: 0.2 }, k.ell(880 + Math.sin(a) * 140 * t, 860 - Math.cos(a) * 320 * t, 14, 5, a + 1.2)); }
    for (const [x, y] of [[820, 640], [930, 600], [960, 720], [800, 760]]) { k.fill({ y: 0.9, r: 0.62 }, k.circ(x, y, 15)); k.add({ r: 0.4 }, k.circ(x + 4, y + 3, 11)); }
    /* the vine along the roof, heavy with Muscatel grapes */
    const vine = k.P(); vine.moveTo(40, 1250); vine.bezierCurveTo(60, 900, 20, 500, 140, 330); vine.bezierCurveTo(300, 180, 600, 170, 900, 300);
    k.stroke({ b: 0.7, r: 0.6, y: 0.5 }, vine, 14);
    const vleaf = (x, y, r) => { const p = k.P(); const rot = k.R(-0.8, 0.8); for (let i = 0; i < 5; i++) { const a = Math.PI / 2 + rot + (i - 2) * 0.7; p.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.34, a, 0, Math.PI * 2); } k.fill({ b: 0.72, y: 0.8, r: 0.16 }, p); k.add({ b: 0.2 }, k.circ(x + r * 0.2, y, r * 0.3)); };
    const bunch = (x, y, s) => {
      k.stroke({ b: 0.6, r: 0.5, y: 0.5 }, k.poly([x, y - 16 * s, x + 3 * s, y], true), 2.4 * s);
      const berries = [];
      for (let i = 0; i < 26; i++) { const t = k.rnd(), w = (1 - t) * 20 + 4; berries.push([x + k.R(-w, w) * s + Math.sin(t * 3) * 4 * s, y + t * 62 * s]); }
      berries.sort((a, b) => a[1] - b[1]);
      for (const [gx, gy] of berries) { k.fill({ y: 0.7, b: 0.3, r: 0.04 }, k.circ(gx, gy, 6 * s)); k.add({ b: 0.2 }, k.circ(gx + 2 * s, gy + 2 * s, 4 * s)); k.cut(k.circ(gx - 2 * s, gy - 2.2 * s, 1.5 * s), 0.75); }
    };
    for (let i = 0; i < 34; i++) { const t = i / 34, x = 140 + t * 760 + k.R(-20, 20), y = 330 - Math.sin(t * Math.PI) * 130 + k.R(-10, 60); vleaf(x, y, k.R(30, 48)); }
    for (let i = 0; i < 10; i++) vleaf(k.R(20, 110), k.R(400, 900), k.R(28, 40));
    for (const [x, y, s] of [[230, 300, 1.2], [390, 262, 1.4], [540, 250, 1.1], [690, 280, 1.3], [820, 330, 1], [110, 470, 1.1], [80, 700, 1]]) bunch(x, y, s);
    /* the count steps back, in evening dress */
    person(k, 700, 1180, 580, { dir: -1, coat: C.ink, legs: C.ink, shirt: C.cream, hair: C.ink, skin: PALE, long: true, lean: -4, arms: 'down' });
    /* Mercédès, in a light dress and a gauze scarf; the grapes already on the ground */
    k.add({ b: 0.2, r: 0.1 }, k.ell(470, 1190, 170, 18));
    lady(k, 400, 1186, 540, { dir: 1, dress: { y: 0.16, r: 0.06 }, shade: { b: 0.18, r: 0.06 }, hair: C.ink, arms: 'offer', scarf: { b: 0.2 }, bare: true, necklace: { b: 0.2 }, flounce: { y: 0.2, r: 0.1 } });
    bunch(566, 1150, 0.62);
    for (let i = 0; i < 5; i++) k.fill({ y: 0.72, b: 0.26 }, k.circ(600 + i * 13, 1196 - (i % 2) * 4, 5.8));
    /* the peach, like the grapes, falling */
    k.fill({ y: 0.9, r: 0.62 }, k.circ(560, 960, 17));
    k.add({ r: 0.42 }, k.circ(565, 964, 12));
    k.fill({ b: 0.7, y: 0.75, r: 0.2 }, k.ell(572, 942, 10, 4, -0.6));
    const fall = k.P(); fall.moveTo(544, 918); fall.lineTo(542, 900); fall.moveTo(560, 916); fall.lineTo(560, 896); fall.moveTo(576, 918); fall.lineTo(578, 900);
    k.cut(fall, 0.5, 2);
  },
};

export const SCENES = { gate, opera, noirtier, telegraph, feast, busoni, hothouse };
