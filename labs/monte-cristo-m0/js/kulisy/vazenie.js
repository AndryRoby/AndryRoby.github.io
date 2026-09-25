/* Kulisa kapitoly 18: rez Château d'If od Edmondovej cely cez chodbu po Fariovu celu.
 *
 * Bocny pohlad ako rez stenou (NAVRH rozlozenia). Z knihy: uzke okno a luc svetla
 * vo Fariovej cele (r. 8256 az 8257), ciary na stene na urcovanie casu zo slnka
 * (r. 7235 az 7238), postel (r. 8152), kamen vchodu a rohoz (r. 8364 az 8366),
 * nepouzivany krb so skrysou pod kamenom ohniska (r. 7255 az 7258), lampa z tuku
 * (r. 7322 az 7324); uzka chodba, v ktorej sa Edmond plazi (r. 8362 az 8363),
 * maly otvor do Edmondovej cely (r. 8397 az 8398); v Edmondovej cele postel (r. 8380)
 * a stolicka (r. 8404 az 8405). Male okno Edmondovej cely a vsetky rozmery su NAVRH.
 *
 * Svet ma 1400 x 360 logickych jednotiek, pohlad 640 x 360. Vrstvy: zadna stena
 * (parallax 0,94) a rez s nabytkom (1,0) s dierami tam, kde je vidno do ciel. */
import { C, murivo, slama, rez, pas } from './spolocne.js';

export const SVET = {
  w: 1400, h: 360,
  podlaha: 262,
  strop: 34,
  celaE: [40, 500], // Edmondova cela, x od do
  celaF: [880, 1360], // Fariova cela
  oknoE: [236, 64, 34, 26],
  oknoF: [1148, 52, 20, 58],
  postelE: [58, 196],
  stolicka: 244,
  postelF: [1086, 1214],
  krb: [1262, 1342],
  kamenF: [910, 950], // kamen v podlahe Fariovej cely nad koncom chodby
  otvorE: [494, 516], // maly otvor v spodku steny do Edmondovej cely
  lampa: [1012, 150],
  /* stredova ciara chodby: od otvoru v Edmondovej cele po kamen vo Fariovej */
  chodba: [470, 252, 500, 254, 522, 276, 560, 292, 640, 300, 740, 302, 820, 298, 872, 290, 906, 278, 924, 266, 930, 250],
  sirkaChodby: 26,
  kamery: { e: 0, f: 760 },
};

export function volnyPriestor() {
  const p = new Path2D();
  const [e0, e1] = SVET.celaE, [f0, f1] = SVET.celaF;
  p.rect(e0, SVET.strop, e1 - e0, SVET.podlaha - SVET.strop + 1);
  p.rect(f0, SVET.strop, f1 - f0, SVET.podlaha - SVET.strop + 1);
  const o = pas(SVET.chodba, SVET.sirkaChodby);
  p.moveTo(o[0], o[1]);
  for (let i = 2; i < o.length; i += 2) p.lineTo(o[i], o[i + 1]);
  p.closePath();
  p.rect(SVET.otvorE[0] - 6, 234, SVET.otvorE[1] - SVET.otvorE[0] + 12, 30);
  p.rect(SVET.kamenF[0] - 2, 236, SVET.kamenF[1] - SVET.kamenF[0] + 4, 30);
  return p;
}

/* ── Zadna stena ───────────────────────────────────────────────────── */
export const zadna = {
  w: 1400, h: 360, seed: 8253,
  draw(k) {
    const S = SVET;
    k.fill(C.kamen, k.rect(0, 0, 1400, 360));
    murivo(k, 0, 20, 1400, 250, 23, { b: 0.62, r: 0.22, y: 0.2 }, { malta: 0.3 });
    /* tien v kutoch a pod stropom, svetlejsie v strede steny */
    k.add({ b: k.lin(0, 30, 0, 262, [0, 0.42], [0.35, 0.05], [1, 0.22]), r: k.lin(0, 30, 0, 262, [0, 0.15], [1, 0.05]) }, k.rect(0, 0, 1400, 360));
    for (const [a, b] of [S.celaE, S.celaF]) {
      k.add({ b: k.lin(a, 0, a + 70, 0, [0, 0.38], [1, 0]) }, k.rect(a, 0, 70, 300));
      k.add({ b: k.lin(b - 70, 0, b, 0, [0, 0], [1, 0.38]) }, k.rect(b - 70, 0, 70, 300));
    }
    /* okna: hlboke spalety, mreze, kusok oblohy */
    const okno = (x, y, w, h, spaleta) => {
      k.fill(C.kamenTien, k.poly([x - spaleta, y - spaleta * 0.6, x + w + spaleta, y - spaleta * 0.6, x + w + spaleta * 0.4, y + h + spaleta * 0.8, x - spaleta * 0.4, y + h + spaleta * 0.8]));
      k.add({ b: 0.18, r: 0.08 }, k.poly([x + w + spaleta, y - spaleta * 0.6, x + w + spaleta * 0.4, y + h + spaleta * 0.8, x + w, y + h, x + w, y]));
      k.cut(k.rect(x, y, w, h), 1);
      k.fill({ b: k.lin(0, y, 0, y + h, [0, 0.34], [1, 0.12]), y: 0.08 }, k.rect(x, y, w, h));
      for (let i = 1; i < 3; i++) k.fill(C.zelezo, k.rect(x + (w * i) / 3 - 1, y - 1, 2.2, h + 2));
      k.fill(C.zelezo, k.rect(x - 1, y + h / 2 - 1, w + 2, 2));
    };
    okno(...S.oknoE, 12);
    okno(...S.oknoF, 10);
    /* ciary na stene, podla ktorych Faria cita cas zo slnka (r. 7235 az 7238) */
    const cx = 1232, cy = 150;
    const ciary = k.P();
    for (let i = 0; i < 7; i++) {
      const a = -2.55 + i * 0.16;
      ciary.moveTo(cx + Math.cos(a) * 34, cy + Math.sin(a) * 34);
      ciary.lineTo(cx + Math.cos(a) * (70 + (i % 2) * 10), cy + Math.sin(a) * (70 + (i % 2) * 10));
    }
    k.addStroke({ b: 0.55, r: 0.4 }, ciary, 0.9);
    for (let i = 0; i < 7; i++) {
      const a = -2.55 + i * 0.16;
      k.add({ r: 0.5, b: 0.4 }, k.circ(cx + Math.cos(a) * 76, cy + Math.sin(a) * 76, 0.9));
    }
    /* nepouzivany krb, kamen ohniska (skrysa pod nim, r. 7255 az 7258) */
    const [k0, k1] = S.krb;
    k.fill({ b: 0.55, r: 0.34, y: 0.3 }, k.rect(k0 - 8, 150, k1 - k0 + 16, 12));
    k.fill({ b: 0.46, r: 0.28, y: 0.26 }, k.rect(k0, 162, 12, 100));
    k.fill({ b: 0.46, r: 0.28, y: 0.26 }, k.rect(k1 - 12, 162, 12, 100));
    k.fill(C.tma, k.poly([k0 + 12, 262, k0 + 12, 176, k0 + 22, 166, k1 - 22, 166, k1 - 12, 176, k1 - 12, 262]));
    k.add({ b: 0.1, r: 0.12 }, k.rect(k0 + 18, 230, k1 - k0 - 36, 32));
    k.fill({ b: 0.4, r: 0.3, y: 0.34 }, k.rect(k0 + 8, 255, k1 - k0 - 16, 7));
    k.addStroke({ b: 0.6, r: 0.4 }, k.poly([k0 + 26, 258, k1 - 26, 258], true), 0.6);
    /* vyklenok s lampou z tuku (r. 7322 az 7324) */
    const [lx, ly] = S.lampa;
    k.fill({ b: 0.72, r: 0.4, y: 0.3 }, k.poly([lx - 15, ly + 16, lx - 15, ly - 6, lx - 10, ly - 15, lx, ly - 19, lx + 10, ly - 15, lx + 15, ly - 6, lx + 15, ly + 16]));
    k.add({ b: k.lin(0, ly - 19, 0, ly + 16, [0, 0.25], [1, 0]) }, k.rect(lx - 15, ly - 19, 30, 35));
    k.fill(C.dlazba, k.rect(lx - 17, ly + 16, 34, 3.5));
    /* lampa: miska s tukom a knotom, rano zhasnuta */
    k.fill({ y: 0.5, r: 0.5, b: 0.36 }, k.blob([lx - 7, ly + 11, lx - 6, ly + 16, lx + 6, ly + 16, lx + 8, ly + 11, lx + 12, ly + 10]));
    k.stroke(C.atrament, k.poly([lx + 10.5, ly + 10.3, lx + 12.5, ly + 7.5], true), 0.8);
    /* Edmondova cela: vyryte ciarky dni vedla postele (NAVRH) */
    const dni = k.P();
    for (let i = 0; i < 26; i++) { const x = 70 + (i % 13) * 4.4 + Math.floor(i / 13) * 2, y = 150 + Math.floor(i / 13) * 16; dni.moveTo(x, y); dni.lineTo(x + 0.6, y + 10); }
    k.addStroke({ b: 0.5, r: 0.3 }, dni, 0.8);
    /* vlhke skvrny */
    for (let i = 0; i < 14; i++) {
      const x = k.R(40, 1360), y = k.R(40, 200);
      k.add({ b: 0.12, y: 0.06 }, k.blob([x, y, x + k.R(10, 30), y + k.R(-4, 6), x + k.R(8, 26), y + k.R(20, 60), x - k.R(2, 8), y + k.R(10, 40)]));
    }
  },
};

/* ── Rez a nabytok ─────────────────────────────────────────────────── */
export const rezSvet = {
  w: 1400, h: 360, seed: 8359, maska: true,
  draw(k) {
    const S = SVET;
    const P = S.podlaha;
    const masa = new Path2D();
    masa.rect(0, 0, 1400, S.strop);
    masa.rect(0, 0, S.celaE[0], 360);
    masa.rect(S.celaE[1], 0, S.celaF[0] - S.celaE[1], 360);
    masa.rect(S.celaF[1], 0, 1400 - S.celaF[1], 360);
    masa.rect(0, P, 1400, 360 - P);
    rez(k, masa);
    /* kvadre v reze stropu a stien */
    const kv = k.P();
    for (let x = 0; x < 1400; x += 38) { kv.moveTo(x, 0); kv.lineTo(x + 6, S.strop); }
    k.addStroke({ b: 0.1, r: 0.08, y: 0.05 }, kv, 0.8);
    /* skala pod podlahou: hlbsie tmavsia, s kamenmi */
    k.add({ b: k.lin(0, P, 0, 360, [0, 0], [1, 0.1]) }, k.rect(0, P, 1400, 360 - P));
    for (let i = 0; i < 70; i++) {
      const x = k.R(0, 1400), y = k.R(P + 14, 356), r = k.R(3, 9);
      k.add({ b: 0.06, r: 0.1, y: 0.08 }, k.blob([x - r, y, x - r * 0.3, y - r * 0.7, x + r, y - r * 0.4, x + r * 0.8, y + r * 0.5, x, y + r * 0.6]));
    }
    /* podlaha: dlazba s hornou hranou, ktora chyti svetlo */
    for (const [a, b] of [S.celaE, S.celaF]) {
      k.fill(C.dlazba, k.rect(a, P, b - a, 7));
      k.cut(k.rect(a, P, b - a, 1.4), 0.5);
      const sp = k.P();
      for (let x = a + 14; x < b; x += k.R(26, 40)) { sp.moveTo(x, P); sp.lineTo(x - 1, P + 7); }
      k.addStroke({ b: 0.5, r: 0.3 }, sp, 0.7);
    }
    /* hrany rezu: ostra ciara na rozhrani hmoty a priestoru */
    const hr = k.P();
    for (const [a, b] of [S.celaE, S.celaF]) { hr.rect(a, S.strop, b - a, P - S.strop); }
    k.addStroke(C.atrament, hr, 1.6);
    /* chodba: vyhlbena v skale, tmava, s hranou */
    const ch = pas(S.chodba, S.sirkaChodby);
    const chp = k.poly(ch);
    k.fill({ b: 0.74, r: 0.54, y: 0.42 }, chp);
    k.add({ b: k.lin(0, 250, 0, 314, [0, 0.05], [1, 0.25]) }, chp);
    const dno = k.P();
    for (let i = 0; i < S.chodba.length / 2 - 1; i++) {
      const x = S.chodba[i * 2], y = S.chodba[i * 2 + 1] + S.sirkaChodby / 2 - 2;
      if (i === 0) dno.moveTo(x, y); else dno.lineTo(x, y);
    }
    k.addStroke({ y: 0.3, r: 0.18 }, dno, 1.2);
    for (let i = 0; i < 24; i++) {
      const t = k.R(0.05, 0.95), n = S.chodba.length / 2 - 1, j = Math.floor(t * n);
      const x = S.chodba[j * 2] + k.R(-6, 6), y = S.chodba[j * 2 + 1] + k.R(4, 10);
      k.add({ y: 0.2, r: 0.1, b: 0.05 }, k.circ(x, y, k.R(0.8, 1.8)));
    }
    k.addStroke(C.atrament, chp, 1.3);
    /* maly otvor v spodku steny do Edmondovej cely (r. 8397 az 8398) */
    const [o0, o1] = S.otvorE;
    const otvor = k.blob([o0 - 4, P + 1, o0 - 3, P - 14, (o0 + o1) / 2, P - 24, o1 + 3, P - 14, o1 + 4, P + 1]);
    k.fill({ b: 0.84, r: 0.6, y: 0.44 }, otvor);
    k.addStroke(C.atrament, otvor, 1.2);
    /* otvor pod kamenom vo Fariovej cele (kamen a rohoz su pohyblive, kresli ich scena) */
    k.fill({ b: 0.84, r: 0.6, y: 0.44 }, k.rect(S.kamenF[0], P - 1, S.kamenF[1] - S.kamenF[0], 12));

    /* ── nabytok Edmondovej cely ── */
    const [e0, e1] = S.postelE;
    lozko(k, e0, e1, P, 0);
    /* stolicka (r. 8404 az 8405) */
    const sx = S.stolicka;
    k.fill(C.drevo, k.rect(sx - 13, P - 22, 26, 5));
    k.add({ b: 0.2 }, k.rect(sx - 13, P - 18, 26, 1.5));
    for (const dx of [-10, 7]) k.fill(C.drevoTm, k.poly([sx + dx, P - 17, sx + dx + 3, P - 17, sx + dx + 3 + (dx < 0 ? -2 : 2), P, sx + dx + (dx < 0 ? -2 : 2), P]));
    /* dzban na vodu (NAVRH) */
    k.fill({ r: 0.6, y: 0.62, b: 0.3 }, k.blob([430, P, 427, P - 16, 432, P - 24, 442, P - 24, 447, P - 16, 444, P]));
    k.cut(k.rect(432, P - 20, 2, 12), 0.4);
    k.fill({ r: 0.7, y: 0.6, b: 0.4 }, k.ell(437, P - 24, 6, 1.6));

    /* ── nabytok Fariovej cely ── */
    const [f0, f1] = S.postelF;
    lozko(k, f0, f1, P, 1);
    /* stolik s kusmi platna a perami (kap. 17, NAVRH umiestnenia) */
    k.fill(C.drevo, k.rect(990, P - 36, 44, 5));
    for (const dx of [993, 1027]) k.fill(C.drevoTm, k.rect(dx, P - 31, 3, 31));
    k.fill(C.plat, k.poly([996, P - 36, 1016, P - 36, 1019, P - 38.5, 999, P - 38.5]));
    k.fill(C.plat, k.poly([1002, P - 38.5, 1022, P - 38.5, 1024, P - 41, 1004, P - 41]));
    k.stroke({ y: 0.55, r: 0.45, b: 0.3 }, k.poly([1020, P - 42, 1034, P - 50], true), 1.2);
  },
};

/* Postel: drevena lavica so slamnikom. strana 0 = Edmond, 1 = Faria. */
function lozko(k, a, b, P, strana) {
  const h = 24;
  k.fill(C.drevoTm, k.rect(a + 3, P - h + 6, 5, h - 6));
  k.fill(C.drevoTm, k.rect(b - 8, P - h + 6, 5, h - 6));
  k.fill(C.drevo, k.rect(a, P - h, b - a, 7));
  k.add({ b: 0.22, r: 0.1 }, k.rect(a, P - h + 5, b - a, 2));
  const mat = k.blob([a + 2, P - h + 1, a + 6, P - h - 6, a + (b - a) * 0.4, P - h - 8, b - 10, P - h - 7, b - 2, P - h - 3, b - 3, P - h + 1]);
  k.fill(C.slama, mat);
  slama(k, a + 4, P - h - 7, b - 6, P - h, 60);
  k.add({ b: 0.15, r: 0.1 }, k.rect(a, P - h - 2, b - a, 3));
  if (strana === 0) {
    /* prikryvka zlozena na konci (NAVRH) */
    k.fill({ b: 0.46, r: 0.3, y: 0.28 }, k.blob([b - 42, P - h - 6, b - 40, P - h - 13, b - 12, P - h - 13, b - 6, P - h - 6]));
  }
}

/* ── Svetlo ────────────────────────────────────────────────────────── */
/* Luc z okna: rovnobeznik, ktory okno vrha po smere d az na podlahu (alebo stenu).
   Tlaci sa ako papier so zltym atramentom; scena ho kladie navrch s priehladnostou,
   takze co je v luci, zosvetlie a zozltne. Smer luca je NAVRH. */
function luc(okno, dx, farba, seed, sila) {
  const [x, y, w, h] = okno;
  const P = SVET.podlaha;
  const dole = (px, py) => [px + dx * (P - py), P];
  const a = [x, y], b = [x + w, y], c = [x + w, y + h], d = [x, y + h];
  const body = dx < 0 ? [...a, ...b, ...c, ...dole(...c), ...dole(...a)] : [...a, ...b, ...dole(...b), ...dole(...d), ...d];
  const xs = body.filter((_, i) => i % 2 === 0);
  const x0 = Math.floor(Math.min(...xs)) - 4, x1 = Math.ceil(Math.max(...xs)) + 4;
  return {
    x0, y0: y - 4, w: x1 - x0, h: P + 6 - (y - 4), seed, maska: true,
    draw(k) {
      const p = k.poly(body);
      k.fill({ y: k.lin(x, y, x + dx * (P - y), P, [0, sila], [1, sila * 0.55]), r: farba || 0.04 }, p);
      /* prach v luci */
      for (let i = 0; i < 26; i++) {
        const t = k.R(0.1, 0.9), u = k.R(0.1, 0.9);
        const px = x + w * u + dx * (P - y) * t, py = y + (P - y) * t;
        k.add({ y: 0.5 }, k.circ(px, py, k.R(0.3, 0.8)));
      }
      /* dopadova skvrna na podlahe */
      const f = dole(x + (dx < 0 ? 0 : w), y);
      k.add({ y: sila * 0.6, r: (farba || 0.04) * 2 }, k.ell((f[0] + dole(x + w, y + h)[0]) / 2, P - 1, Math.abs(dx) * h * 0.5 + w * 0.8, 3));
    },
  };
}
export const LUCE = {
  'luc:F': luc(SVET.oknoF, -0.35, 0.03, 8256, 0.62),
  'luc:E1': luc(SVET.oknoE, 0.55, 0.02, 8380, 0.5),
  'luc:E2': luc(SVET.oknoE, 0.05, 0.03, 8381, 0.5),
  'luc:E3': luc(SVET.oknoE, -0.5, 0.08, 8382, 0.48),
  'luc:Ev': luc(SVET.oknoE, -1.05, 0.34, 8392, 0.42),
};
