/* Scenes from volume two (chapters 28 to 47). Same contract as v1.js. */
import { C, person, crowd, gull, cloud, stonework, stars, waves } from '../parts.js';
import { sky, disc, sea, lightPath, ship, tartan } from '../sea.js';
import { rock, tower, wall, crenels, houses, arcade } from '../arch.js';

/* ── Chapter 30: the Pharaon comes back ───────────────────────────────── */
const pharaon = {
  w: 1200, h: 800, seed: 13555,
  draw(k) {
    sky(k, 0, 440, [[0, { b: 0.44 }], [0.7, { b: 0.16, y: 0.1 }], [1, { y: 0.3, r: 0.08, b: 0.06 }]]);
    cloud(k, { b: 0.1 }, 520, 90, 460, 34, 9);
    cloud(k, { b: 0.08, y: 0.08 }, 60, 160, 320, 26, 7);
    /* the far shore and the yacht putting out to sea */
    k.fill({ b: 0.34, r: 0.1, y: 0.1 }, k.blob([700, 442, 800, 418, 940, 404, 1080, 410, 1200, 400, 1200, 442]));
    tartan(k, 1030, 450, 44, { dir: 1, sail: C.cream, band: C.gold, flag: C.gold });
    sea(k, 440, 690, { top: { b: 0.32, y: 0.1 }, bottom: { b: 0.66, r: 0.1 }, rows: 18, glints: 10 });
    /* the tower of Saint-Jean */
    const warm = { y: 0.5, r: 0.24, b: 0.12 };
    const shade = { b: 0.34, r: 0.14 };
    k.fill(warm, k.rect(20, 150, 190, 540));
    k.add(shade, k.rect(130, 150, 80, 540));
    stonework(k, 20, 170, 190, 520, 22, { y: 0.1, r: 0.04, b: 0.06 }, { mortar: 0.22 });
    k.fill(warm, k.rect(10, 130, 210, 30));
    for (let i = 0; i < 9; i++) k.fill(C.dark, k.rect(18 + i * 23, 160, 10, 16));
    crenels(k, warm, 10, 130, 210, 22);
    for (const [x, y] of [[70, 260], [150, 260], [110, 420]]) k.fill(C.dark, k.rect(x, y, 14, 34));
    tower(k, 250, 690, 90, 260, warm, { shade, slits: 2 });
    k.fill(C.red, k.poly([116, 130, 116, 70, 160, 84, 116, 96]));
    k.stroke(C.dark, k.poly([116, 130, 116, 66], true), 3);
    /* the Pharaon, the exact duplicate of the other, casting anchor */
    k.add({ b: 0.36, r: 0.1 }, k.poly([330, 606, 930, 606, 910, 650, 350, 650]));
    const sh = ship(k, 640, 600, 560, { dir: -1, sails: 'furled', sail: C.cream, flag: C.red, band: { y: 0.6, r: 0.2 }, name: 'Pharaon', nameSize: 3.1 });
    for (let i = 0; i < 6; i++) person(k, sh.X(-30 + i * 11), sh.Y(8), 26, { coat: k.pick([C.navy, C.dark, C.blue]), hat: k.pick(['cap', 'varnished', null]), hatC: k.pick([C.red, C.ink]), arms: i === 2 ? 'wave2' : i === 4 ? 'up' : 'down' });
    /* the pier, and the whole city on it */
    k.fill({ y: 0.42, r: 0.22, b: 0.18 }, k.rect(0, 690, 1200, 110));
    stonework(k, 0, 700, 1200, 100, 24, { y: 0.1, r: 0.06, b: 0.08 }, { mortar: 0.25 });
    k.fill({ y: 0.5, r: 0.3, b: 0.2 }, k.rect(0, 686, 1200, 10));
    crowd(k, 300, 1180, 700, 40, [C.navy, C.red, C.blue, C.dark, C.gold, C.cream, { r: 0.6, b: 0.4 }], { step: 0.36 });
    crowd(k, 280, 1200, 732, 50, [C.navy, C.red, C.dark, C.blue, { y: 0.6, r: 0.5 }, C.cream], { step: 0.34 });
    crowd(k, 250, 1200, 774, 62, [C.navy, C.dark, C.red, C.blue, { y: 0.7, r: 0.35 }], { step: 0.32 });
    /* Morrel and his son embrace on the pier-head */
    k.fill({ y: 0.42, r: 0.22, b: 0.18 }, k.rect(500, 780, 300, 20));
    person(k, 628, 800, 170, { dir: 1, coat: C.dark, legs: C.dark, arms: 'embrace', hair: { b: 0.1 }, shirt: C.cream });
    person(k, 676, 800, 186, { dir: -1, coat: { b: 0.82, r: 0.2 }, legs: { r: 0.8, b: 0.2 }, arms: 'embrace', hair: C.ink, buttons: C.gold, hat: 'cap', hatC: { b: 0.9, r: 0.4 } });
    k.fill(C.gold, k.rect(662, 800 - 186 * 0.82, 30, 6));
    /* the sentry-box, and the man with the black beard watching behind it */
    const bx = 1040;
    person(k, bx + 70, 800, 176, { dir: -1, coat: C.ink, legs: C.ink, mantle: { b: 0.95, r: 0.6, y: 0.3 }, beard: C.ink, beardLen: 78, hair: C.ink, hat: 'broad', hatC: C.ink });
    k.fill(C.cream, k.rect(bx - 60, 540, 120, 260));
    for (let i = 0; i < 4; i++) k.fill(C.red, k.rect(bx - 60 + i * 30, 540, 15, 260));
    k.fill({ b: 0.5, r: 0.3 }, k.poly([bx - 76, 546, bx + 76, 546, bx, 490]));
    k.fill(C.dark, k.rect(bx - 30, 600, 60, 120));
    k.add({ b: 0.2 }, k.rect(bx + 30, 540, 30, 260));
    gull(k, 500, 150, 14, C.navy); gull(k, 560, 180, 10, C.navy); gull(k, 880, 260, 9, C.navy);
  },
};

/* ── Chapter 34: the Colosseum by moonlight ───────────────────────────── */
const colosseum = {
  w: 1400, h: 700, seed: 16936,
  draw(k) {
    sky(k, 0, 700, [[0, { b: 1, r: 0.6, y: 0.1 }], [0.6, { b: 0.8, r: 0.4 }], [1, { b: 0.7, r: 0.3 }]]);
    stars(k, 120, 0, 0, 1400, 260, 1.5);
    const mx = 1100, my = 110;
    k.cut(k.circ(mx, my, 260), k.rad(mx, my, 40, 260, [0, 0.55], [1, 0]));
    k.cut(k.circ(mx, my, 44), 1);
    k.fill({ y: 0.16 }, k.circ(mx, my, 44));
    k.add({ b: 0.12 }, k.circ(mx - 10, my + 6, 12)); k.add({ b: 0.1 }, k.circ(mx + 14, my - 10, 8));
    /* the far side of the ring: tiers of arches, broken at the top */
    const stone = { b: 0.78, r: 0.56, y: 0.34 };
    const N = 22;
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N * 2 - 1;
      const x0 = 700 + Math.sin((i / N - 0.5) * 2.2) * 760, x1 = 700 + Math.sin(((i + 1) / N - 0.5) * 2.2) * 760;
      const sc = 0.72 + 0.34 * u * u;
      const base = 470 + (1 - sc) * -60, tierH = 88 * sc;
      const tiers = 3 + (k.rnd() < 0.5 ? 1 : 0) - (Math.abs(u) < 0.25 && k.rnd() < 0.5 ? 1 : 0);
      for (let t = 0; t < tiers; t++) {
        const yb = base - t * tierH;
        arcade(k, x0, yb, x1 - x0 + 1, tierH, 1, t % 2 ? { b: 0.72, r: 0.5, y: 0.3 } : stone, {
          open: 0.74,
          through: (j) => (k.rnd() < 0.55 ? { b: 0.7, r: 0.32, y: 0.04 } : { b: 0.98, r: 0.7, y: 0.4 }),
          cornice: { b: 0.9, r: 0.66, y: 0.4 },
        });
      }
      /* ragged broken top */
      const topY = base - tiers * tierH - tierH * 0.1;
      k.fill(stone, k.poly([x0, topY + 2, x0 + (x1 - x0) * 0.3, topY - k.R(0, 16) * sc, x0 + (x1 - x0) * 0.7, topY - k.R(0, 26) * sc, x1, topY + 2]));
    }
    /* long fibrous shoots hanging from the broken ceiling */
    const vines = k.P();
    for (let i = 0; i < 60; i++) { const x = k.R(40, 1360), y = k.R(150, 230), l = k.R(20, 90); vines.moveTo(x, y); vines.quadraticCurveTo(x + 6, y + l / 2, x + k.R(-6, 6), y + l); }
    k.addStroke({ y: 0.4, b: 0.3 }, vines, 1.6);
    /* the arena: rubble, grass and the moon lying in patches */
    k.fill({ b: 0.9, r: 0.62, y: 0.4 }, k.rect(0, 470, 1400, 230));
    /* the moon through the arches, lying on the ground as long arch shapes */
    for (let i = 0; i < 7; i++) {
      const x = 180 + i * 150 + k.R(-20, 20), y = 520 + (i % 3) * 50, w = 60 + (i % 3) * 14, l = 70 + (i % 3) * 30;
      const p = k.P(); p.moveTo(x, y); p.lineTo(x + w, y); p.lineTo(x + w - l * 0.55, y + l); p.quadraticCurveTo(x - l * 0.55 + w / 2, y + l + w * 0.4, x - l * 0.55, y + l); p.closePath();
      k.cut(p, 0.5); k.add({ y: 0.16, b: 0.08 }, p);
    }
    for (let i = 0; i < 40; i++) { const x = k.R(0, 1400), y = k.R(490, 700); k.fill({ b: 1, r: 0.72, y: 0.5 }, k.blob([x - 16, y, x - 8, y - 12, x + 14, y - 10, x + 18, y + 2])); }
    const grass = k.P(); for (let i = 0; i < 160; i++) { const x = k.R(0, 1400), y = k.R(480, 700); grass.moveTo(x, y); grass.lineTo(x + k.R(-5, 5), y - k.R(6, 18)); }
    k.addStroke({ y: 0.5, b: 0.4 }, grass, 1.6);
    /* steps up to a vomitorium, where the man in the mantle stands */
    for (let i = 0; i < 5; i++) k.fill(i % 2 ? { b: 0.86, r: 0.6, y: 0.4 } : { b: 0.8, r: 0.54, y: 0.36 }, k.rect(830 - i * 14, 640 - i * 22, 300 + i * 28, 24));
    k.cut(k.poly([840, 640, 1060, 640, 1090, 700, 820, 700]), 0.5);
    k.add({ y: 0.2 }, k.poly([840, 640, 1060, 640, 1090, 700, 820, 700]));
    const brown = { y: 0.5, r: 0.52, b: 0.5 };
    person(k, 960, 560, 190, { dir: -1, coat: C.ink, legs: C.ink, boots: C.ink, mantle: brown, mantleFold: { b: 0.35, r: 0.2 }, muffle: brown, hat: 'broad', hatC: C.ink, hair: C.ink });
    /* the polished boots caught by the moon */
    k.cut(k.rect(940, 546, 10, 4), 0.9); k.cut(k.rect(964, 546, 10, 4), 0.9);
    /* Franz in the shadow of a broken pillar */
    k.fill({ b: 1, r: 0.72, y: 0.46 }, k.poly([90, 700, 90, 300, 130, 280, 200, 296, 220, 330, 220, 700]));
    stonework(k, 90, 330, 130, 370, 30, { b: 0.05 }, { mortar: 0.2 });
    k.cut(k.rect(200, 300, 20, 400), 0.35);
    person(k, 250, 690, 150, { dir: 1, coat: { b: 0.96, r: 0.66, y: 0.3 }, legs: { b: 0.96, r: 0.66, y: 0.3 }, hair: C.ink, hat: 'top', hatC: C.ink, arms: 'down' });
    k.cut(k.rect(262, 690 - 150 * 0.93, 3, 12), 0.5);
  },
};

/* ── Chapter 36: the moccoletti on the Corso ──────────────────────────── */
const carnival = {
  w: 1000, h: 1250, seed: 18899,
  draw(k) {
    const vx = 500, vy = 520;
    const proj = (X, Y, z) => [vx + (X - vx) / z, vy + (Y - vy) / z];
    /* the sky over the Corso, night coming, the first stars */
    sky(k, 0, 700, [[0, { b: 1, r: 0.55, y: 0.06 }], [1, { b: 0.66, r: 0.5, y: 0.2 }]]);
    stars(k, 60, 300, 0, 700, 400, 1.6);
    /* palaces on both sides, receding */
    const cuts = [1, 1.35, 1.8, 2.4, 3.2, 4.3, 5.8, 7.8, 10.5, 14, 19];
    const fronts = [{ y: 0.46, r: 0.3, b: 0.18 }, { y: 0.34, r: 0.44, b: 0.24 }, { y: 0.56, r: 0.2, b: 0.16 }, { y: 0.3, r: 0.3, b: 0.4 }, { y: 0.52, r: 0.36, b: 0.1 }];
    const hang = [C.red, C.gold, C.cream, { r: 0.8, y: 0.8 }, C.blue];
    for (const side of [-1, 1]) {
      const X = side < 0 ? -260 : 1260;
      for (let i = cuts.length - 2; i >= 0; i--) {
        const z0 = cuts[i], z1 = cuts[i + 1];
        const top = -900 - (i % 3) * 160;
        const col = fronts[(i * 2 + (side > 0 ? 1 : 0)) % fronts.length];
        const a = proj(X, top, z0), b = proj(X, top, z1), c = proj(X, 1500, z1), d = proj(X, 1500, z0);
        const face = k.poly([...a, ...b, ...c, ...d]);
        k.fill(col, face);
        k.add({ b: 0.35 * (i / cuts.length) + 0.12, r: 0.2 * (i / cuts.length) }, face);
        /* cornice line and the edge of the next house */
        k.stroke({ b: 0.6, r: 0.4, y: 0.3 }, k.poly([...a, ...b], true), 10 / z0);
        k.stroke({ b: 0.5, r: 0.3, y: 0.2 }, k.poly([...a, ...d], true), 6 / z0);
        /* windows by floor, with balconies hung with carpets */
        for (let fl = 0; fl < 6; fl++) {
          const Yw = top + 260 + fl * 330;
          if (Yw > 1250) break;
          for (let j = 0; j < 2; j++) {
            const za = z0 + (z1 - z0) * (0.2 + j * 0.45), zb = za + (z1 - z0) * 0.22;
            const p1 = proj(X, Yw, za), p2 = proj(X, Yw, zb), p3 = proj(X, Yw + 170, zb), p4 = proj(X, Yw + 170, za);
            const lit = k.rnd() < 0.7;
            k.fill(lit ? { y: 0.95, r: 0.3 } : { b: 0.9, r: 0.6, y: 0.3 }, k.poly([...p1, ...p2, ...p3, ...p4]));
            if (fl >= 1 && fl <= 4 && k.rnd() < 0.75) {
              const h1 = proj(X, Yw + 190, za), h2 = proj(X, Yw + 190, zb), h3 = proj(X, Yw + 330, zb), h4 = proj(X, Yw + 330, za);
              const hc = k.pick(hang);
              k.fill(hc, k.poly([...h1, ...h2, ...h3, ...h4]));
              if (hc === C.cream && k.rnd() < 0.8) {
                const m1 = proj(X, Yw + 260, za + (zb - za) * 0.5);
                k.fill(C.red, k.circ(m1[0], m1[1], 16 / za));
              }
              const rail = k.P(); rail.moveTo(h1[0], h1[1]); rail.lineTo(h2[0], h2[1]);
              k.stroke(C.dark, rail, 5 / za);
              /* people leaning from the balcony, with their little lights */
              for (let q = 0; q < 2; q++) {
                const hp = proj(X + side * -40, Yw + 150, za + (zb - za) * (0.3 + q * 0.4));
                k.fill(k.pick([C.dark, C.red, C.navy]), k.circ(hp[0], hp[1], 22 / za));
                if (k.rnd() < 0.8) { const lp = proj(X + side * -80, Yw + 60, za + (zb - za) * (0.3 + q * 0.4)); k.fill(C.gold, k.circ(lp[0], lp[1], 7 / za)); }
              }
            }
          }
        }
      }
    }
    /* the street floor */
    const fl1 = proj(-260, 1500, 1), fl2 = proj(1260, 1500, 1), fl3 = proj(1260, 1500, 19), fl4 = proj(-260, 1500, 19);
    k.fill({ b: 0.9, r: 0.6, y: 0.4 }, k.poly([...fl1, ...fl2, ...fl3, ...fl4]));
    /* the crowd, from far to near, every one with a moccoletto */
    for (let z = 18; z > 1.5; z /= 1.12) {
      const y = vy + (1500 - vy) / z;
      const x0 = vx + (-260 - vx) / z, x1 = vx + (1260 - vx) / z;
      const h = 150 / z;
      crowd(k, x0 + h * 0.3, x1, y, h * 1.4, [C.dark, C.navy, C.red, C.plum, { b: 0.9, r: 0.7, y: 0.5 }, C.blue, C.cream], { step: 0.34, arms: true });
      let x = x0 + k.R(0, h);
      while (x < x1) {
        if (k.rnd() < (z < 3 ? 0.3 : 0.55)) {
          const lx = x + k.R(-h * 0.2, h * 0.2), ly = y - h * k.R(1.3, 2.3);
          const R = h * 0.9;
          k.cut(k.circ(lx, ly, R), k.rad(lx, ly, 0, R, [0, 0.8], [1, 0]));
          k.add({ y: k.rad(lx, ly, 0, R, [0, 0.9], [1, 0]), r: k.rad(lx, ly, 0, R * 0.5, [0, 0.25], [1, 0]) }, k.circ(lx, ly, R));
          k.fill(C.cream, k.rect(lx - h * 0.04, ly, h * 0.08, h * 0.3));
          k.fill(C.orange, k.ell(lx, ly - h * 0.06, h * 0.06, h * 0.12));
        }
        x += h * k.R(0.28, 0.6);
      }
    }
    /* confetti and flying flowers in the air */
    for (let i = 0; i < 260; i++) {
      const x = k.R(0, 1000), y = k.R(0, 1100);
      k.fill(k.pick([C.red, C.gold, C.cream, C.rose, C.blue]), k.rect(x, y, k.R(2, 5), k.R(2, 5)));
    }
    for (let i = 0; i < 16; i++) {
      const x = k.R(100, 900), y = k.R(200, 900);
      for (let j = 0; j < 5; j++) k.fill(C.plum, k.circ(x + Math.cos(j * 1.26) * 5, y + Math.sin(j * 1.26) * 5, 4));
      k.fill(C.gold, k.circ(x, y, 2.6));
    }
  },
};

export const SCENES = { pharaon, colosseum, carnival };
