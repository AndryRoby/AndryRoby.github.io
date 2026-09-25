/* Kulisy kapitoly 69: Pariz 1838 v reze, kresleny kodom ako risografia.
 *
 * Z knihy (data-69.json, kulisy): Busoniho dom za Saint-Sulpice je maly dvojpodlazny dom,
 * dve izby na poschodi (r. 37263 az 37265); dole jedalen so stolom, stolickami a pribornikom
 * z orechu (r. 37265 az 37267) a salonik s obkladom bez ozdob, koberca a hodin (r. 37267 az
 * 37268); hore izba "more library than parlor" s teologickymi knihami a pergamenmi (r. 37269
 * az 37271) a spalna: postel bez zavesov, styri kresla, pohovka v zltom utrechtskom zamate,
 * klacadlo (r. 37279 az 37281); okienko komornika (r. 37272 az 37274); olivovozelene dvere
 * a kocar na rohu Rue Férou (r. 37291 az 37292); hrube schodisko a stol s lampou s velkym
 * tienidlom (r. 37320 az 37322).
 * Wilmorov salon (r. 37593 az 37601): krb s dvoma modernymi vazami zo Sèvres, hodiny s Amorom
 * s napnutym lukom, zrkadlo a po bokoch rytiny Homéra so sprievodcom a zobrajuceho Belisara,
 * sivkasta tapeta, cerveno cierne calunenie, lampy s matnym sklom; spalna (r. 37713).
 * Rozlozenie, farby, nabytok spalne u Wilmora a vsetko ostatne je NAVRH. */
import { C, rez } from './spolocne.js';

export const SVETY69 = {
  busoni: {
    w: 1180, h: 360,
    horna: 166, dolna: 318, strop: 30, strop2: 180,
    fasada: [150, 330], dvere: [262, 304], okienko: [276, 224, 14, 12],
    schody: [[356, 318], [500, 166]],
    kniznica: [500, 860], spalna: [868, 1150], jedalen: [500, 820], salonik: [828, 1150],
    stol: [660, 720, 136], lampa: [690, 136],
    stolickaV: 622, stolickaB: 756,
  },
  wilmore: {
    w: 920, h: 360,
    podlaha: 300, strop: 52,
    spalna: [24, 400], stena: [400, 420], salon: [420, 900],
    dvere: [402, 418], krb: [596, 684],
    lampy: [[474, 206], [858, 206]],
    rytiny: [[574, 164], [706, 164]],
    kreslo: 520,
  },
};

const B = SVETY69.busoni, W = SVETY69.wilmore;

/* ── drobnosti ── */
const OMIETKA = { y: 0.18, r: 0.1, b: 0.08 };
const DREVO = C.drevo, DREVO_TM = C.drevoTm;
const OREH = { y: 0.6, r: 0.62, b: 0.62 };
const PARKETY = { y: 0.46, r: 0.34, b: 0.28 };
const OLIVA = { y: 0.74, b: 0.56, r: 0.12 };
const MODRA_TM = { b: 0.9, r: 0.62, y: 0.36 };
const LINKA = C.atrament;

function dosky(k, x0, x1, y, h) {
  k.fill(PARKETY, k.rect(x0, y, x1 - x0, h));
  k.cut(k.rect(x0, y, x1 - x0, 1.2), 0.45);
  const s = k.P();
  for (let x = x0 + 10; x < x1; x += k.R(22, 34)) { s.moveTo(x, y + 1); s.lineTo(x, y + h); }
  k.addStroke({ b: 0.4, r: 0.3 }, s, 0.6);
}
/* tapeta: podklad a jemny vzor bodiek alebo pasov */
function tapeta(k, x, y, w, h, farba, vzor, bodka) {
  k.fill(farba, k.rect(x, y, w, h));
  if (vzor === 'pasy') {
    const s = k.P();
    for (let xx = x + 6; xx < x + w; xx += 12) { s.moveTo(xx, y); s.lineTo(xx, y + h); }
    k.addStroke(bodka, s, 2.2);
  } else if (vzor === 'bodky') {
    for (let yy = y + 8, i = 0; yy < y + h; yy += 14, i++) for (let xx = x + 6 + (i % 2) * 7; xx < x + w; xx += 14) k.add(bodka, k.poly([xx, yy - 2, xx + 1.6, yy, xx, yy + 2, xx - 1.6, yy]));
  }
}
function obklad(k, x, y, w, h) {
  k.fill(OREH, k.rect(x, y, w, h));
  k.add({ b: 0.14 }, k.rect(x, y, w, 3));
  const s = k.P();
  for (let xx = x + 4; xx < x + w - 20; xx += 46) s.rect(xx, y + 7, 38, h - 13);
  k.addStroke({ b: 0.46, r: 0.36, y: 0.2 }, s, 0.9);
}
/* bocna stolicka: sedak vo vyske v nad podlahou, operadlo za chrbtom (smer = kam sa hladi) */
function stolicka(k, x, y, smer, farba, cal) {
  const f = farba || DREVO_TM;
  k.fill(cal || DREVO, k.rect(x - 11, y - 25, 22, 4));
  for (const dx of [-9, 7]) k.fill(f, k.rect(x + dx, y - 21, 2.4, 21));
  const bx = x - smer * 11;
  k.fill(f, k.poly([bx - 1.4, y - 21, bx + 1.4, y - 21, bx + 1.4 - smer * 2, y - 58, bx - 1.4 - smer * 2, y - 58]));
  if (cal) k.fill(cal, k.poly([bx, y - 27, bx + smer * 2.4, y - 27, bx + smer * 0.4 - smer * 2, y - 55, bx - smer * 2, y - 55]));
}
function kreslo(k, x, y, smer, cal) {
  k.fill(DREVO_TM, k.rect(x - 14, y - 12, 3, 12));
  k.fill(DREVO_TM, k.rect(x + 11, y - 12, 3, 12));
  k.fill(cal, k.blob([x - 15, y - 12, x - 16, y - 24, x + 14, y - 25, x + 16, y - 12]));
  const bx = x - smer * 14;
  k.fill(cal, k.blob([bx - 4, y - 14, bx - 5, y - 52, bx, y - 58, bx + 5, y - 52, bx + 4, y - 14]));
  k.addStroke(LINKA, k.blob([bx - 4, y - 14, bx - 5, y - 52, bx, y - 58, bx + 5, y - 52, bx + 4, y - 14]), 0.7);
  k.fill(DREVO, k.rect(x - 15, y - 34, 30, 3));
}
function polica(k, x, y, w, h, rnd) {
  k.fill(DREVO_TM, k.rect(x - 4, y - 4, w + 8, h + 8));
  k.fill({ b: 0.7, r: 0.5, y: 0.36 }, k.rect(x, y, w, h));
  const rady = Math.floor(h / 26);
  for (let r = 0; r < rady; r++) {
    const yy = y + r * 26;
    k.fill(DREVO, k.rect(x - 2, yy + 23, w + 4, 3));
    let xx = x + 2;
    while (xx < x + w - 6) {
      const bw = k.R(3.4, 6.6), bh = k.R(15, 21);
      const farby = [{ r: 0.86, b: 0.5, y: 0.36 }, { b: 0.86, r: 0.42, y: 0.2 }, { y: 0.66, r: 0.62, b: 0.5 }, { y: 0.72, r: 0.3, b: 0.24 }, { b: 0.6, r: 0.66, y: 0.5 }];
      const f = farby[Math.floor(rnd() * farby.length)];
      k.fill(f, k.rect(xx, yy + 23 - bh, bw, bh));
      if (rnd() < 0.5) k.add({ y: 0.7 }, k.rect(xx + 0.8, yy + 23 - bh + 3, bw - 1.6, 1.2));
      xx += bw + 0.6;
      if (rnd() < 0.08) xx += 5;
    }
  }
}
function okno(k, x, y, w, h, noc) {
  k.fill({ y: 0.5, r: 0.44, b: 0.4 }, k.rect(x - 4, y - 4, w + 8, h + 8));
  k.fill(noc ? { b: 0.72, r: 0.4, y: 0.12 } : { b: 0.22, y: 0.06 }, k.rect(x, y, w, h));
  const s = k.P();
  s.moveTo(x + w / 2, y); s.lineTo(x + w / 2, y + h);
  for (let yy = y + h / 3; yy < y + h; yy += h / 3) { s.moveTo(x, yy); s.lineTo(x + w, yy); }
  k.addStroke({ y: 0.5, r: 0.44, b: 0.4 }, s, 1.6);
}

/* ── Busoniho dom: zadna vrstva (fasada, ulica, steny izieb, nabytok pri stene) ── */
export const busoniZadna = {
  w: B.w, h: B.h, seed: 37263,
  draw(k) {
    /* obloha nad Parizom a ulica Férou */
    k.fill({ b: k.lin(0, 0, 0, 318, [0, 0.36], [1, 0.12]), r: 0.06, y: 0.08 }, k.rect(0, 0, B.w, 318));
    /* susedne domy v pozadi ulice (NAVRH) */
    for (const [x, w, h] of [[0, 70, 210], [66, 90, 250]]) {
      k.fill({ b: 0.4, r: 0.22, y: 0.2 }, k.rect(x, 318 - h, w, h));
      for (let yy = 318 - h + 20; yy < 290; yy += 40) for (let xx = x + 12; xx < x + w - 14; xx += 26) k.fill({ b: 0.62, r: 0.36, y: 0.2 }, k.rect(xx, yy, 10, 18));
    }
    k.fill(C.dlazba, k.rect(0, 318, 330, 42));
    const dl = k.P();
    for (let y = 322; y < 360; y += 7) for (let x = (y % 14) ? 0 : 5; x < 330; x += 11) { dl.moveTo(x, y); dl.lineTo(x + 8, y); }
    k.addStroke({ b: 0.4, r: 0.3 }, dl, 0.8);
    /* fasada domu: dve podlazia, rimsa, okno hore */
    const [f0, f1] = B.fasada;
    k.fill({ y: 0.3, r: 0.16, b: 0.12 }, k.rect(f0, 22, f1 - f0, 296));
    const sp = k.P();
    for (let y = 40; y < 318; y += 18) { sp.moveTo(f0, y); sp.lineTo(f1, y); }
    k.addStroke({ y: 0.2, r: 0.14, b: 0.14 }, sp, 0.7);
    k.fill({ y: 0.36, r: 0.24, b: 0.2 }, k.rect(f0 - 6, 166, f1 - f0 + 6, 12));
    k.fill({ y: 0.36, r: 0.24, b: 0.2 }, k.rect(f0 - 8, 14, f1 - f0 + 8, 10));
    okno(k, 200, 62, 46, 78, false);
    okno(k, 176, 206, 40, 70, false);
    /* olivovozelene dvere (samotne kridlo kresli scena), otvor za nimi je tmavy */
    const [d0, d1] = B.dvere;
    k.fill({ y: 0.42, r: 0.3, b: 0.26 }, k.rect(d0 - 7, 222, d1 - d0 + 14, 96));
    k.fill({ b: 0.9, r: 0.66, y: 0.4 }, k.rect(d0, 230, d1 - d0, 88));
    k.fill({ y: 0.42, r: 0.3, b: 0.26 }, k.rect(d0 - 10, 312, d1 - d0 + 20, 6));
    /* nazov ulice na rohu (NAVRH) */
    k.fill({ b: 0.9, r: 0.3, y: 0.08 }, k.rect(154, 180, 50, 12));
    k.text({ y: 0.9 }, 'RUE FÉROU', 179, 189.4, '600 7.4px Georgia, serif', 'center');

    /* vnutro: steny izieb */
    const [kn0, kn1] = B.kniznica, [sp0, sp1] = B.spalna, [j0, j1] = B.jedalen, [sl0, sl1] = B.salonik;
    /* vestibul so schodiskom, dvojita vyska */
    tapeta(k, 330, 30, 170, 288, OMIETKA, 'pasy', { y: 0.06, r: 0.04 });
    /* kniznica: tapeta a police s teologickymi knihami, pergameny */
    tapeta(k, kn0, 30, kn1 - kn0, 136, { b: 0.3, r: 0.2, y: 0.24 }, 'bodky', { r: 0.2, y: 0.16 });
    polica(k, 520, 52, 110, 104, k.rnd);
    polica(k, 752, 52, 96, 104, k.rnd);
    /* pergameny zvinute na polici a na stene (NAVRH umiestnenia) */
    for (let i = 0; i < 5; i++) { const x = 650 + i * 16; k.fill(C.plat, k.rect(x, 64 + (i % 2) * 4, 12, 7)); k.addStroke({ y: 0.4, r: 0.3, b: 0.2 }, k.ell(x + 12, 67.5 + (i % 2) * 4, 1.6, 3.5), 0.6); }
    k.fill(DREVO_TM, k.rect(644, 72, 94, 3));
    /* spalna: postel bez zavesov, kresla, zlta pohovka, klacadlo */
    tapeta(k, sp0, 30, sp1 - sp0, 136, { b: 0.2, r: 0.1, y: 0.16 }, 'pasy', { b: 0.1, y: 0.04 });
    k.fill(DREVO_TM, k.rect(sp1 - 118, 112, 6, 54));
    k.fill(DREVO_TM, k.rect(sp1 - 16, 100, 6, 66));
    k.fill(DREVO, k.rect(sp1 - 118, 134, 108, 12));
    k.fill(C.plat, k.blob([sp1 - 116, 134, sp1 - 110, 124, sp1 - 30, 122, sp1 - 14, 126, sp1 - 14, 134]));
    k.add({ b: 0.14 }, k.rect(sp1 - 116, 131, 102, 3));
    /* klacadlo (prie-dieu) */
    const kx = sp0 + 40;
    k.fill(DREVO_TM, k.poly([kx, 166, kx, 118, kx + 4, 114, kx + 12, 114, kx + 12, 120, kx + 5, 124, kx + 5, 166]));
    k.fill(DREVO, k.rect(kx + 4, 146, 20, 4));
    k.fill({ r: 0.8, b: 0.5, y: 0.3 }, k.rect(kx + 4, 150, 20, 5));
    /* zlta pohovka v utrechtskom zamate a kreslo */
    const px = sp0 + 110;
    k.fill({ y: 0.9, r: 0.24, b: 0.06 }, k.blob([px - 34, 166, px - 38, 140, px - 32, 126, px + 32, 124, px + 38, 138, px + 36, 166]));
    k.add({ y: 0.2, r: 0.2 }, k.rect(px - 34, 146, 70, 3));
    k.addStroke(LINKA, k.blob([px - 34, 166, px - 38, 140, px - 32, 126, px + 32, 124, px + 38, 138, px + 36, 166]), 0.8);
    kreslo(k, sp0 + 190, 166, -1, { r: 0.62, b: 0.46, y: 0.4 });
    /* krucifix nad klacadlom (NAVRH) */
    k.stroke({ b: 0.8, r: 0.6, y: 0.4 }, k.poly([kx + 8, 70, kx + 8, 96], true), 1.6);
    k.stroke({ b: 0.8, r: 0.6, y: 0.4 }, k.poly([kx + 1, 78, kx + 15, 78], true), 1.6);

    /* prizemie: jedalen z orechu a salonik s obkladom */
    tapeta(k, j0, 180, j1 - j0, 138, OMIETKA, 'pasy', { y: 0.07, r: 0.05 });
    obklad(k, j0, 262, j1 - j0, 56);
    /* pribornik z orechu */
    k.fill(OREH, k.rect(j0 + 30, 250, 86, 68));
    k.fill({ y: 0.52, r: 0.56, b: 0.58 }, k.rect(j0 + 26, 246, 94, 6));
    k.addStroke({ b: 0.5, r: 0.4 }, k.rect(j0 + 36, 262, 34, 48), 0.8);
    k.addStroke({ b: 0.5, r: 0.4 }, k.rect(j0 + 76, 262, 34, 48), 0.8);
    for (const x of [j0 + 42, j0 + 62, j0 + 96]) k.fill({ b: 0.5, r: 0.2, y: 0.1 }, k.blob([x - 4, 246, x - 3, 236, x, 232, x + 3, 236, x + 4, 246]));
    /* stol a stolicky */
    k.fill(OREH, k.rect(j0 + 170, 284, 110, 5));
    for (const x of [j0 + 176, j0 + 270]) k.fill(DREVO_TM, k.rect(x, 289, 4, 29));
    stolicka(k, j0 + 160, 318, 1, OREH);
    stolicka(k, j0 + 292, 318, -1, OREH);
    /* salonik: holy obklad, bez ozdob, koberca a hodin */
    k.fill(OREH, k.rect(sl0, 180, sl1 - sl0, 138));
    const pan = k.P();
    for (let x = sl0 + 8; x < sl1 - 30; x += 52) { pan.rect(x, 192, 44, 56); pan.rect(x, 256, 44, 54); }
    k.addStroke({ b: 0.5, r: 0.44, y: 0.26 }, pan, 0.9);
    k.add({ b: 0.14, r: 0.06 }, k.rect(sl0, 180, sl1 - sl0, 138));
    stolicka(k, sl0 + 70, 318, 1, OREH);
    stolicka(k, sl0 + 200, 318, -1, OREH);

    /* schodisko: hrube drevene stupne z vestibulu hore */
    const [[sx0, sy0], [sx1, sy1]] = B.schody;
    const n = 12;
    const st = [];
    for (let i = 0; i <= n; i++) {
      const x = sx0 + ((sx1 - sx0) * i) / n, y = sy0 + ((sy1 - sy0) * i) / n;
      st.push(x, y);
      if (i < n) st.push(x + (sx1 - sx0) / n, y);
    }
    const tvar = k.poly([...st, sx1 + 6, sy1, sx1 + 6, sy1 + 16, sx0 + 18, sy0, sx0, sy0]);
    k.fill({ y: 0.56, r: 0.48, b: 0.42 }, tvar);
    k.add({ b: 0.22, r: 0.1 }, k.poly([sx1 + 6, sy1 + 4, sx1 + 6, sy1 + 16, sx0 + 18, sy0, sx0 + 4, sy0]));
    k.addStroke(LINKA, k.poly(st, true), 1.1);
    /* zabradlie */
    k.stroke(DREVO_TM, k.poly([sx0 + 4, sy0 - 34, sx1 + 4, sy1 - 34], true), 1.8);
    for (let i = 1; i < n; i += 2) { const x = sx0 + ((sx1 - sx0) * i) / n, y = sy0 + ((sy1 - sy0) * i) / n; k.stroke(DREVO_TM, k.poly([x + 4, y, x + 4, y - 34], true), 1.1); }
    /* okienko komornika v stene vestibulu pri dverach (vnutorna strana) */
    k.fill(DREVO, k.rect(334, 220, 18, 18));
    k.fill({ b: 0.9, r: 0.66, y: 0.4 }, k.rect(337, 223, 12, 12));
    /* stol v kniznici (lampu kresli scena) a dve stolicky */
    const [t0, t1, ty] = B.stol;
    k.fill(DREVO, k.rect(t0, ty, t1 - t0, 5));
    k.add({ b: 0.2 }, k.rect(t0, ty + 4, t1 - t0, 1.4));
    for (const x of [t0 + 4, t1 - 8]) k.fill(DREVO_TM, k.rect(x, ty + 5, 4, 166 - ty - 5));
    /* knihy a pergamen na stole */
    k.fill({ r: 0.8, b: 0.55, y: 0.3 }, k.rect(t1 - 26, ty - 6, 18, 6));
    k.fill(C.plat, k.poly([t0 + 6, ty, t0 + 30, ty, t0 + 32, ty - 1.6, t0 + 8, ty - 1.6]));
    stolicka(k, B.stolickaV, 166, 1);
    stolicka(k, B.stolickaB, 166, -1);
    /* vesiak v spalne s ruchom a kapucou kresli scena (miznu, ked sa gróf oblieka) */
    k.fill(DREVO_TM, k.rect(sp0 + 238, 70, 4, 96));
    k.fill(DREVO_TM, k.rect(sp0 + 226, 70, 28, 3));
  },
};

/* ── Busoniho dom: rez (strop, podlahy, prieciky, obvod, zaklad) ── */
export const busoniRez = {
  w: B.w, h: B.h, seed: 37320, maska: true,
  draw(k) {
    const masa = new Path2D();
    const [f0, f1] = B.fasada;
    /* strop a strecha nad vnutrom */
    masa.rect(f1, 18, B.w - f1, 12);
    /* medzipodlazie od hornej izby po koniec, s otvorom nad schodmi */
    masa.rect(B.schody[1][0] + 6, 166, B.w - B.schody[1][0] - 6, 14);
    /* podlaha prizemia a zaklad */
    masa.rect(f1, 318, B.w - f1, 42);
    /* obvodova stena vpravo */
    masa.rect(1150, 18, 30, 342);
    /* prieciky s dverovymi otvormi (vyska otvoru 120) */
    for (const [x, y0, y1] of [[860, 30, 166], [820, 180, 318]]) masa.rect(x, y0, 8, y1 - y0 - 120);
    rez(k, masa);
    /* hrany rezu */
    const hr = k.P();
    hr.rect(f1, 30, 1150 - f1, 136); hr.rect(f1, 180, 1150 - f1, 138);
    k.addStroke(C.atrament, hr, 1.4);
    /* strecha: skridla nad rezom (NAVRH) */
    k.fill({ b: 0.62, r: 0.4, y: 0.3 }, k.poly([f0 - 10, 18, B.w, 18, B.w, 4, f0 + 30, 4]));
    const sk = k.P();
    for (let x = f0; x < B.w; x += 9) { sk.moveTo(x, 4); sk.lineTo(x - 3, 18); }
    k.addStroke({ b: 0.3, r: 0.2 }, sk, 0.7);
    k.fill({ b: 0.6, r: 0.5, y: 0.4 }, k.rect(980, -6, 26, 12));
    /* podlahy izieb */
    dosky(k, B.schody[1][0] + 6, 1150, 166, 7);
    dosky(k, f1, 1150, 318, 7);
    /* okraj fasady: rez muru tam, kde je dom otvoreny */
    k.fill(C.rez, k.rect(f1 - 4, 22, 8, 296));
    k.addStroke(C.atrament, k.poly([f1 + 4, 30, f1 + 4, 318], true), 1.2);
    /* okna do dvora v zadnej stene su v zadnej vrstve; tu len rimsa zakladu */
    k.add({ b: 0.2, r: 0.1 }, k.rect(f1, 330, B.w - f1, 30));
  },
};

/* ── Wilmorov byt: zadna vrstva ── */
export const wilmoreZadna = {
  w: W.w, h: W.h, seed: 37593,
  draw(k) {
    const P = W.podlaha;
    k.fill({ b: 0.5, r: 0.3, y: 0.2 }, k.rect(0, 0, W.w, 360));
    /* spalna (NAVRH): jednoducha tapeta, postel, toaletny stolik, vesiak */
    const [s0, s1] = W.spalna;
    tapeta(k, s0, W.strop, s1 - s0, P - W.strop, { b: 0.16, r: 0.16, y: 0.2 }, 'bodky', { r: 0.18, b: 0.1 });
    okno(k, 120, 104, 54, 96, true);
    k.fill({ r: 0.7, b: 0.46, y: 0.4 }, k.poly([112, 96, 182, 96, 186, 206, 172, 206, 160, 110, 132, 110, 122, 206, 108, 206]));
    /* postel */
    k.fill(DREVO_TM, k.rect(s0 + 14, P - 58, 6, 58));
    k.fill(DREVO_TM, k.rect(s0 + 150, P - 40, 6, 40));
    k.fill(DREVO, k.rect(s0 + 14, P - 26, 142, 10));
    k.fill(C.plat, k.blob([s0 + 18, P - 26, s0 + 22, P - 36, s0 + 120, P - 36, s0 + 150, P - 30, s0 + 152, P - 26]));
    k.fill({ b: 0.5, r: 0.3, y: 0.2 }, k.blob([s0 + 60, P - 26, s0 + 62, P - 38, s0 + 150, P - 36, s0 + 154, P - 22]));
    /* toaletny stolik bez zrkadla, na nom puder (NAVRH) */
    k.fill(DREVO, k.rect(206, P - 44, 74, 5));
    for (const x of [210, 272]) k.fill(DREVO_TM, k.rect(x, P - 39, 3, 39));
    k.fill({ y: 0.2, b: 0.1 }, k.ell(260, P - 47, 7, 3));
    k.fill({ r: 0.6, y: 0.5, b: 0.3 }, k.rect(254, P - 50, 12, 3));
    /* stolicka pri stoliku */
    stolicka(k, 296, P, -1);
    /* vesiak */
    k.fill(DREVO_TM, k.rect(354, P - 132, 4, 132));
    k.fill(DREVO_TM, k.poly([342, P, 370, P, 364, P - 6, 348, P - 6]));
    for (const d of [-1, 1]) k.stroke(DREVO_TM, k.poly([356, P - 128, 356 + d * 12, P - 138], true), 1.6);

    /* salon: sivkasta tapeta, calunenie cervene a cierne */
    const [a0, a1] = W.salon;
    tapeta(k, a0, W.strop, a1 - a0, P - W.strop, { b: 0.28, r: 0.12, y: 0.12 }, 'pasy', { b: 0.08, r: 0.04 });
    k.fill({ r: 0.2, b: 0.24, y: 0.14 }, k.rect(a0, P - 52, a1 - a0, 52));
    k.addStroke({ b: 0.5, r: 0.3 }, k.poly([a0, P - 52, a1, P - 52], true), 1);
    /* krb, dve moderne vazy zo Sèvres, hodiny s Amorom s napnutym lukom */
    const [k0, k1] = W.krb;
    const kx = (k0 + k1) / 2;
    k.fill({ y: 0.2, r: 0.14, b: 0.2 }, k.rect(k0 - 8, P - 70, k1 - k0 + 16, 8));
    k.fill({ y: 0.16, r: 0.1, b: 0.16 }, k.rect(k0, P - 62, 12, 62));
    k.fill({ y: 0.16, r: 0.1, b: 0.16 }, k.rect(k1 - 12, P - 62, 12, 62));
    k.fill({ b: 0.96, r: 0.8, y: 0.5 }, k.blob([k0 + 12, P, k0 + 12, P - 46, kx, P - 56, k1 - 12, P - 46, k1 - 12, P]));
    k.fill({ y: 0.9, r: 0.66 }, k.ell(kx, P - 6, 16, 5));
    k.add({ y: 0.6, r: 0.3 }, k.ell(kx, P - 14, 10, 8));
    for (const vx of [k0 + 6, k1 - 6]) {
      const v = k.blob([vx - 6, P - 70, vx - 7, P - 82, vx - 4, P - 92, vx - 3, P - 98, vx + 3, P - 98, vx + 4, P - 92, vx + 7, P - 82, vx + 6, P - 70]);
      k.fill({ b: 0.86, r: 0.1, y: 0.02 }, v);
      k.fill(C.zlato, k.rect(vx - 6, P - 86, 12, 2.4));
      k.add({ y: 0.9 }, k.ell(vx, P - 80, 3, 4));
      k.addStroke(LINKA, v, 0.6);
    }
    /* hodiny: podstavec, cifernik a Amor s lukom (NAVRH tvaru) */
    k.fill(C.zlato, k.rect(kx - 13, P - 76, 26, 6));
    k.fill({ y: 0.9, r: 0.3, b: 0.1 }, k.blob([kx - 10, P - 76, kx - 9, P - 92, kx + 9, P - 92, kx + 10, P - 76]));
    k.fill({ y: 0.08 }, k.circ(kx, P - 85, 5));
    k.addStroke(LINKA, k.circ(kx, P - 85, 5), 0.6);
    k.stroke(LINKA, k.poly([kx, P - 85, kx + 2.6, P - 87.4], true), 0.6);
    k.fill({ y: 0.9, r: 0.36, b: 0.1 }, k.blob([kx - 2, P - 92, kx - 3, P - 100, kx, P - 106, kx + 3, P - 100, kx + 2, P - 92]));
    k.fill({ y: 0.9, r: 0.36, b: 0.1 }, k.circ(kx, P - 108, 2.4));
    k.stroke({ y: 0.9, r: 0.4, b: 0.2 }, k.blob([kx + 5, P - 112, kx + 8, P - 104, kx + 5, P - 96], true), 0.9);
    k.stroke({ y: 0.5, r: 0.3, b: 0.3 }, k.poly([kx + 5, P - 112, kx + 2, P - 104, kx + 5, P - 96], true), 0.4);
    /* zrkadlo nad krbom */
    k.fill(C.zlato, k.rect(kx - 32, P - 190, 64, 108));
    k.fill({ b: 0.3, y: 0.08, r: 0.06 }, k.rect(kx - 27, P - 185, 54, 98));
    k.cut(k.poly([kx - 20, P - 180, kx - 10, P - 180, kx - 26, P - 120, kx - 27, P - 136]), 0.6);
    /* dve rytiny po bokoch zrkadla: Homér nesie sprievodcu, Belisar zobre */
    const [[r1x, r1y], [r2x, r2y]] = W.rytiny;
    for (const [x, y, co] of [[r1x, r1y, 'homer'], [r2x, r2y, 'belisar']]) {
      k.fill({ b: 0.9, r: 0.62, y: 0.4 }, k.rect(x - 17, y - 24, 34, 48));
      k.fill({ y: 0.12, r: 0.04 }, k.rect(x - 14, y - 21, 28, 42));
      const f = { b: 0.8, r: 0.5, y: 0.3 };
      if (co === 'homer') {
        /* starec so sprievodcom na chrbte (NAVRH vykladu obrazu) */
        k.fill(f, k.blob([x - 6, y + 18, x - 7, y - 2, x - 3, y - 8, x + 3, y - 6, x + 5, y + 18]));
        k.fill(f, k.circ(x - 3, y - 11, 2.6));
        k.fill(f, k.blob([x + 1, y - 8, x + 3, y - 18, x + 8, y - 18, x + 9, y - 8]));
        k.fill(f, k.circ(x + 6, y - 20, 2));
        k.stroke(f, k.poly([x - 9, y + 18, x - 8, y - 4], true), 0.8);
      } else {
        /* zobrajuci s natiahnutou dlanou a palicou */
        k.fill(f, k.blob([x - 6, y + 18, x - 6, y - 4, x - 2, y - 9, x + 3, y - 6, x + 4, y + 18]));
        k.fill(f, k.circ(x - 1, y - 12, 2.6));
        k.stroke(f, k.poly([x + 2, y - 2, x + 10, y - 4], true), 1.2);
        k.fill(f, k.ell(x + 10.6, y - 4.4, 1.6, 1));
        k.stroke(f, k.poly([x - 9, y + 18, x - 7, y - 6], true), 0.8);
      }
      k.addStroke({ b: 0.7, r: 0.4 }, k.rect(x - 14, y - 21, 28, 42), 0.5);
    }
    /* lampy s matnym sklom na konzolach */
    for (const [lx, ly] of W.lampy) {
      k.fill(DREVO_TM, k.rect(lx - 14, ly + 36, 28, 4));
      k.fill(DREVO_TM, k.rect(lx - 2, ly + 40, 4, P - ly - 40));
      k.fill(C.zlato, k.rect(lx - 3, ly + 16, 6, 20));
      k.fill({ y: 0.3, r: 0.1, b: 0.06 }, k.ell(lx, ly + 6, 10, 11));
      k.add({ b: 0.12 }, k.ell(lx - 3, ly + 8, 5, 7));
      k.addStroke({ b: 0.5, r: 0.3 }, k.ell(lx, ly + 6, 10, 11), 0.6);
    }
    /* kreslo pre vyslanca a pohovka, cervene a cierne */
    kreslo(k, W.kreslo, P, 1, { r: 0.88, b: 0.46, y: 0.36 });
    const px = 790;
    k.fill({ b: 0.95, r: 0.8, y: 0.5 }, k.blob([px - 40, P, px - 44, P - 28, px - 36, P - 44, px + 34, P - 46, px + 42, P - 30, px + 40, P]));
    k.fill({ r: 0.88, b: 0.46, y: 0.36 }, k.rect(px - 38, P - 30, 76, 10));
    /* dvere do predsiene vpravo */
    k.fill({ y: 0.5, r: 0.44, b: 0.4 }, k.rect(a1 - 36, P - 124, 30, 124));
    k.fill({ y: 0.6, r: 0.5, b: 0.44 }, k.rect(a1 - 32, P - 120, 22, 120));
    k.addStroke({ b: 0.5, r: 0.4 }, k.rect(a1 - 29, P - 114, 16, 50), 0.7);
    k.addStroke({ b: 0.5, r: 0.4 }, k.rect(a1 - 29, P - 58, 16, 50), 0.7);
    /* otvor v priecku (kridlo kresli scena) */
    k.fill({ b: 0.9, r: 0.62, y: 0.4 }, k.rect(W.dvere[0], P - 122, W.dvere[1] - W.dvere[0], 122));
  },
};

export const wilmoreRez = {
  w: W.w, h: W.h, seed: 37601, maska: true,
  draw(k) {
    const P = W.podlaha;
    const masa = new Path2D();
    masa.rect(0, 0, W.w, W.strop);
    masa.rect(0, 0, W.spalna[0], 360);
    masa.rect(W.salon[1], 0, W.w - W.salon[1], 360);
    masa.rect(0, P, W.w, 360 - P);
    masa.rect(W.stena[0], W.strop, W.stena[1] - W.stena[0], P - 122 - W.strop);
    masa.rect(W.stena[0], P - 122, 2, 122);
    masa.rect(W.stena[1] - 2, P - 122, 2, 122);
    rez(k, masa);
    dosky(k, W.spalna[0], W.salon[1], P, 7);
    const hr = k.P();
    hr.rect(W.spalna[0], W.strop, W.salon[1] - W.spalna[0], P - W.strop);
    k.addStroke(C.atrament, hr, 1.4);
    /* nad stropom byt suseda, len naznak (NAVRH) */
    k.add({ b: 0.14, r: 0.1 }, k.rect(0, 0, W.w, 20));
  },
};

/* ── pohyblive rekvizity ── */
export const REK69 = {
  /* olivovozelene kridlo dveri s okienkom */
  'rek69:dvere': {
    w: 44, h: 90, seed: 37291, maska: true,
    draw(k) {
      const p = k.rect(1, 1, 42, 88);
      k.fill(OLIVA, p);
      k.add({ b: 0.2 }, k.rect(1, 1, 8, 88));
      const pl = k.P(); pl.rect(7, 36, 30, 22); pl.rect(7, 62, 30, 22);
      k.addStroke({ y: 0.4, b: 0.5, r: 0.2 }, pl, 0.9);
      /* okienko (wicket) */
      k.fill({ y: 0.5, b: 0.62, r: 0.2 }, k.rect(14, 8, 16, 14));
      k.addStroke(LINKA, k.rect(14, 8, 16, 14), 0.7);
      k.fill(C.zlato, k.circ(36, 50, 1.8));
      k.addStroke(LINKA, p, 0.9);
    },
  },
  'rek69:okienkoOtv': {
    w: 16, h: 14, seed: 37273, maska: true,
    draw(k) { k.fill({ b: 0.95, r: 0.7, y: 0.4 }, k.rect(0, 0, 16, 14)); k.fill({ y: 0.5, r: 0.36, b: 0.1 }, k.circ(9, 8, 3.6)); k.fill(C.atrament, k.circ(10.4, 7.4, 0.7)); },
  },
  'rek69:kocar': {
    w: 150, h: 96, seed: 37290, maska: true,
    draw(k) {
      /* uzavrety kocar, tmavy lak (NAVRH) */
      const telo = k.blob([14, 74, 10, 40, 22, 22, 86, 18, 120, 24, 132, 42, 128, 74]);
      k.fill({ b: 0.9, r: 0.62, y: 0.4 }, telo);
      k.fill({ b: 0.3, y: 0.1 }, k.rect(40, 32, 30, 22));
      k.fill({ b: 0.3, y: 0.1 }, k.rect(78, 32, 30, 22));
      k.fill({ b: 1, r: 0.8, y: 0.5 }, k.rect(10, 16, 124, 5));
      k.addStroke(LINKA, telo, 0.9);
      for (const [x, r] of [[34, 18], [112, 16]]) {
        k.stroke({ y: 0.6, r: 0.5, b: 0.4 }, k.circ(x, 78, r), 2.2);
        const sp = k.P();
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; sp.moveTo(x, 78); sp.lineTo(x + Math.cos(a) * r, 78 + Math.sin(a) * r); }
        k.addStroke({ y: 0.6, r: 0.5, b: 0.4 }, sp, 0.8);
      }
      k.fill(C.zlato, k.rect(134, 30, 6, 10));
      k.stroke({ b: 0.9, r: 0.7, y: 0.4 }, k.poly([130, 60, 150, 64], true), 2);
    },
  },
  /* lampa s velkym tienidlom: dole a s tienidlom zdvihnutym na strane hosta */
  'rek69:lampa': lampa(0),
  'rek69:lampaHore': lampa(1),
  /* vesiak u Busoniho: rucho a kapuca, ktore zmiznu, ked ich gróf oblecie */
  'rek69:rucho': {
    w: 30, h: 90, seed: 37323, maska: true,
    draw(k) {
      const p = k.blob([12, 2, 18, 2, 24, 20, 27, 60, 28, 88, 3, 88, 4, 58, 6, 20]);
      k.fill({ b: 0.8, r: 0.66, y: 0.44 }, p);
      k.add({ b: 0.2 }, k.poly([6, 20, 12, 2, 12, 88, 3, 88]));
      k.addStroke(LINKA, p, 0.7);
    },
  },
  'rek69:kapuca': {
    w: 22, h: 20, seed: 37324, maska: true,
    draw(k) { const p = k.blob([2, 18, 3, 6, 11, 1, 19, 6, 20, 18]); k.fill({ b: 0.86, r: 0.7, y: 0.46 }, p); k.addStroke(LINKA, p, 0.6); },
  },
  'rek69:okuliare': {
    w: 20, h: 8, seed: 37338, maska: true,
    draw(k) { for (const x of [5, 15]) { k.fill({ b: 0.12 }, k.circ(x, 4, 3.4)); k.addStroke({ b: 0.9, r: 0.7, y: 0.5 }, k.circ(x, 4, 3.4), 0.7); } k.stroke({ b: 0.9, r: 0.7, y: 0.5 }, k.poly([8.4, 4, 11.6, 4], true), 0.6); },
  },
  /* Wilmorove veci v spalni */
  'rek69:w_kabat': {
    w: 34, h: 70, seed: 37606, maska: true,
    draw(k) {
      const p = k.blob([10, 2, 24, 2, 30, 16, 31, 48, 26, 68, 17, 60, 8, 68, 3, 48, 4, 16]);
      k.fill({ b: 0.92, r: 0.26, y: 0.05 }, p);
      for (let i = 0; i < 4; i++) k.fill(C.zlato, k.circ(20, 18 + i * 8, 1.2));
      k.fill({ b: 1, r: 0.46, y: 0.18 }, k.poly([10, 2, 24, 2, 22, 8, 12, 8]));
      k.addStroke(LINKA, p, 0.7);
    },
  },
  'rek69:w_vesta': {
    w: 20, h: 26, seed: 37607, maska: true,
    draw(k) { const p = k.poly([2, 2, 18, 2, 19, 24, 10, 20, 1, 24]); k.fill({ y: 0.06, b: 0.06 }, p); for (let i = 0; i < 4; i++) k.fill({ b: 0.5, r: 0.3 }, k.circ(10, 6 + i * 4, 0.7)); k.addStroke(LINKA, p, 0.6); },
  },
  'rek69:w_nohavice': {
    w: 30, h: 12, seed: 37608, maska: true,
    draw(k) { const p = k.poly([1, 3, 28, 1, 29, 10, 2, 11]); k.fill({ y: 0.56, r: 0.22, b: 0.07 }, p); k.addStroke({ y: 0.7, r: 0.3, b: 0.2 }, k.poly([14, 2, 14, 10], true), 0.6); k.addStroke(LINKA, p, 0.6); },
  },
  'rek69:w_parochna': {
    w: 22, h: 30, seed: 37605, maska: true,
    draw(k) {
      k.fill(DREVO_TM, k.rect(9, 20, 4, 10));
      k.fill({ y: 0.3, r: 0.2, b: 0.2 }, k.ell(11, 14, 7, 8));
      const v = k.blob([3, 16, 3, 6, 11, 1, 19, 6, 19, 16, 15, 10, 7, 10]);
      k.fill({ y: 0.34, r: 0.12, b: 0.14 }, v);
      k.addStroke(LINKA, v, 0.5);
    },
  },
  'rek69:w_skatulka': {
    w: 18, h: 9, seed: 37714, maska: true,
    draw(k) { const p = k.rect(1, 2, 16, 7); k.fill({ r: 0.7, b: 0.6, y: 0.4 }, p); k.fill({ r: 0.6, y: 0.6, b: 0.1 }, k.rect(4, 0.6, 5, 2)); k.fill({ r: 0.9, y: 0.3, b: 0.2 }, k.rect(10, 1, 4, 1.4)); k.addStroke(LINKA, p, 0.5); },
  },
  'rek69:dvereW': {
    w: 16, h: 122, seed: 37602, maska: true,
    draw(k) { const p = k.rect(0, 0, 16, 122); k.fill({ y: 0.58, r: 0.5, b: 0.42 }, p); k.addStroke({ b: 0.5, r: 0.4 }, k.rect(3, 6, 10, 50), 0.6); k.addStroke({ b: 0.5, r: 0.4 }, k.rect(3, 64, 10, 50), 0.6); k.fill(C.zlato, k.circ(12, 64, 1.2)); k.addStroke(LINKA, p, 0.8); },
  },
};
function lampa(hore) {
  return {
    w: 44, h: 46, seed: 37321 + hore, maska: true,
    draw(k) {
      /* noha a olejova nadrzka */
      k.fill(C.zlato, k.poly([18, 44, 26, 44, 24, 30, 20, 30]));
      k.fill({ y: 0.8, r: 0.5, b: 0.3 }, k.ell(22, 28, 5, 3));
      k.fill({ y: 0.6, r: 0.4, b: 0.2 }, k.rect(20.6, 18, 2.8, 10));
      /* velke tienidlo: pri zdvihnuti sa nakloni, na strane hosta (vlavo) hore */
      const u = hore ? -0.42 : 0;
      const c = Math.cos(u), s = Math.sin(u);
      const R = (x, y) => [22 + (x - 22) * c - (y - 16) * s, 16 + (x - 22) * s + (y - 16) * c];
      const body = [[2, 22], [8, 6], [36, 6], [42, 22]].flatMap(([x, y]) => R(x, y));
      const t = k.poly(body);
      k.fill({ b: 0.62, r: 0.2, y: 0.22 }, t);
      k.add({ b: 0.3 }, k.poly([...R(2, 22), ...R(8, 6), ...R(14, 6), ...R(10, 22)]));
      k.addStroke(LINKA, t, 0.8);
      k.fill({ y: 0.5 }, k.poly([...R(4, 22), ...R(40, 22), ...R(38, 24), ...R(6, 24)]));
    },
  };
}

/* ── svetlo: ziara lampy, luc na tvar hosta, matne lampy u Wilmora ── */
function ziara(w, h, cx, cy, rx, ry, sila, seed) {
  return {
    w, h, seed, maska: true,
    draw(k) {
      const p = k.ell(cx, cy, rx, ry);
      k.fill({ y: k.rad(cx, cy, 0, Math.max(rx, ry), [0, sila], [0.5, sila * 0.55], [1, 0]), r: k.rad(cx, cy, 0, Math.max(rx, ry), [0, 0.06], [1, 0]) }, p);
    },
  };
}
export const SVETLO69 = {
  'luc69:lampa': ziara(260, 150, 130, 118, 124, 88, 0.62, 37322),
  'luc69:clona': {
    w: 150, h: 90, seed: 37361, maska: true,
    draw(k) {
      /* kuzel svetla z nakloneneho tienidla dolava hore na tvar hosta */
      const p = k.poly([150, 70, 0, 4, 0, 78, 150, 82]);
      k.fill({ y: k.lin(150, 76, 0, 40, [0, 0.7], [1, 0.3]), r: 0.04 }, p);
    },
  },
  'luc69:matne': ziara(90, 90, 45, 45, 40, 40, 0.34, 37600),
  'luc69:okno': {
    w: 170, h: 170, seed: 37292, maska: true,
    draw(k) { const p = k.poly([0, 0, 50, 0, 170, 170, 70, 170]); k.fill({ y: k.lin(0, 0, 120, 170, [0, 0.36], [1, 0.12]) }, p); },
  },
};

/* ── tabla: prolog, mapa Parize, Villefort, titul, "Before" ── */
const TW = 640, TH = 360;
const prolog = {
  w: TW, h: TH, seed: 37251,
  draw(k) {
    /* tmavy stol a dve spravy (oko bez postavy, NAVRH kompozicie) */
    k.fill({ b: 0.9, r: 0.7, y: 0.5 }, k.rect(0, 0, TW, TH));
    k.hatch({ b: 0.12, r: 0.1 }, k.rect(0, 0, TW, TH), 8, 3.4, 0.6, { vlna: 0.8 });
    k.cut(k.circ(420, 150, 260), k.rad(420, 150, 30, 260, [0, 0.55], [1, 0]));
    k.add({ y: k.rad(420, 150, 0, 240, [0, 0.4], [1, 0]) }, k.circ(420, 150, 260));
    const papier = (x, y, w, h, u, riadky) => {
      const c = Math.cos(u), s = Math.sin(u);
      const R = (px, py) => [x + px * c - py * s, y + px * s + py * c];
      const p = k.poly([...R(0, 0), ...R(w, 0), ...R(w, h), ...R(0, h)]);
      k.fill({ b: 0.3, r: 0.2, y: 0.1 }, k.poly([...R(4, 5), ...R(w + 4, 5), ...R(w + 4, h + 5), ...R(4, h + 5)]));
      k.fill({ y: 0.08, r: 0.03, b: 0.02 }, p);
      const l = k.P();
      for (let i = 0; i < riadky; i++) { const a = R(14, 26 + i * 11), b2 = R(w - 14 - (i % 3) * 18, 26 + i * 11); l.moveTo(...a); l.lineTo(...b2); }
      k.addStroke({ b: 0.7, r: 0.4, y: 0.2 }, l, 1.1);
      k.addStroke({ b: 0.5, r: 0.3 }, p, 0.6);
      return R;
    };
    papier(150, 84, 170, 120, -0.1, 7);
    const R2 = papier(320, 120, 190, 190, 0.06, 13);
    k.fill({ r: 0.9, y: 0.3, b: 0.2 }, k.circ(...R2(160, 170), 7));
    /* kalamar a pero, sviecka (NAVRH) */
    k.fill({ b: 0.96, r: 0.8, y: 0.5 }, k.blob([96, 260, 94, 246, 104, 240, 116, 246, 114, 260]));
    k.stroke({ y: 0.3, r: 0.2, b: 0.2 }, k.poly([108, 244, 140, 190], true), 1.4);
    k.fill({ y: 0.2, b: 0.1 }, k.rect(560, 60, 12, 60));
    k.fill({ y: 0.95, r: 0.5 }, k.blob([566, 58, 562, 50, 566, 38, 570, 50]));
  },
};

/* Mapa Parize (NAVRH kresby). Projekcia: x = (dlzka - 2,28) * 5000 + 20, y = (48,893 - sirka) * 7600. */
export const MAPA69 = {
  bod: (lon, lat) => [(lon - 2.28) * 5000 + 20, (48.893 - lat) * 7600],
  ferou: [2.3348, 48.8497], villefort: [2.3138, 48.8722], fontaine: [2.3356, 48.8806],
};
const mapaPariz = {
  w: TW, h: TH, seed: 1838,
  draw(k) {
    const Pt = (a) => a.flatMap(([lon, lat]) => MAPA69.bod(lon, lat));
    k.papier(k.rect(0, 0, TW, TH));
    k.fill({ y: 0.12, r: 0.05, b: 0.04 }, k.rect(0, 0, TW, TH));
    /* bloky ulic ako jemna mriezka */
    const bl = k.P();
    for (let x = 0; x < TW; x += 16) { bl.moveTo(x, 0); bl.lineTo(x + 30, TH); }
    for (let y = 0; y < TH; y += 14) { bl.moveTo(0, y); bl.lineTo(TW, y - 20); }
    k.addStroke({ r: 0.14, y: 0.1 }, bl, 0.5);
    /* Seina (NAVRH priebehu podla mapy mesta) */
    const seina = Pt([[2.28, 48.8545], [2.29, 48.8605], [2.3015, 48.8645], [2.3197, 48.8642], [2.3295, 48.8608], [2.3413, 48.8572], [2.35, 48.8545], [2.365, 48.8495], [2.39, 48.843]]);
    const breh = k.P();
    breh.moveTo(seina[0], seina[1]);
    for (let i = 2; i < seina.length; i += 2) breh.lineTo(seina[i], seina[i + 1]);
    k.stroke({ b: 0.62, y: 0.08 }, breh, 15);
    k.hatch({ b: 0.3 }, k.rect(0, 200, TW, 110), 0, 3, 0.4, { vlna: 1 });
    k.stroke({ b: 0.9, r: 0.2 }, breh, 1);
    /* Ile de la Cité */
    k.fill({ y: 0.3, r: 0.14, b: 0.1 }, k.blob(Pt([[2.3405, 48.8567], [2.3475, 48.8545], [2.3545, 48.8522], [2.353, 48.8505], [2.346, 48.8522], [2.3415, 48.855]])));
    /* Tuileries a Louvre (NAVRH) */
    const [tx, ty] = MAPA69.bod(2.3265, 48.8635);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) k.fill({ y: 0.5, b: 0.36 }, k.circ(tx + i * 11, ty - 6 + j * 8, 2.6));
    k.fill({ y: 0.36, r: 0.3, b: 0.3 }, k.rect(...MAPA69.bod(2.3335, 48.8618), 52, 8));
    /* Saint-Sulpice: dve veze */
    const [sx, sy] = MAPA69.bod(2.3348, 48.8511);
    k.fill({ b: 0.7, r: 0.5, y: 0.4 }, k.rect(sx - 10, sy - 6, 20, 10));
    for (const dx of [-9, 6]) k.fill({ b: 0.7, r: 0.5, y: 0.4 }, k.rect(sx + dx, sy - 14, 4, 10));
    /* body deja */
    for (const b of ['ferou', 'villefort', 'fontaine']) { const [x, y] = MAPA69.bod(...MAPA69[b]); k.fill({ b: 0.95, r: 0.7, y: 0.4 }, k.circ(x, y, 3)); }
    const t = (s, lon, lat, dx, dy, al, it, vel) => { const [x, y] = MAPA69.bod(lon, lat); k.text({ b: 0.92, r: 0.72, y: 0.42 }, s, x + dx, y + dy, (it ? 'italic ' : '') + (vel || 12) + 'px Georgia, serif', al || 'left'); };
    t('Rue Férou', ...MAPA69.ferou, 8, 14, 'left', true);
    t('Saint-Sulpice', 2.3348, 48.8511, -14, -18, 'right');
    t('Faubourg Saint-Honoré', ...MAPA69.villefort, -8, -8, 'right', true);
    t('M. de Villefort', ...MAPA69.villefort, -8, 8, 'right');
    t('Rue Fontaine-Saint-Georges', ...MAPA69.fontaine, 8, -6, 'left', true);
    t('No. 5, Lord Wilmore', ...MAPA69.fontaine, 8, 9, 'left');
    t('The Seine', 2.296, 48.8622, 0, 18, 'left', true, 11);
    t('Tuileries', 2.3265, 48.8635, 0, -12, 'left', false, 10);
    t('Paris', 2.39, 48.889, 0, 0, 'right', false, 22);
    k.text({ r: 0.9 }, 'N', 600, 300, '600 11px Georgia, serif', 'center');
    k.fill({ r: 0.8 }, k.poly([600, 306, 604, 330, 600, 354, 596, 330]));
  },
};

/* Villefort doma: spi, okuliare na stolíku, klobuk a redingot vyslanca na stolicke. */
function villefort(len) {
  return {
    w: TW, h: TH, seed: 37719, atramenty: len || 'yrb',
    draw(k) {
      k.fill({ b: 0.86, r: 0.58, y: 0.34 }, k.rect(0, 0, TW, TH));
      tapeta(k, 0, 0, TW, 250, { b: 0.72, r: 0.5, y: 0.3 }, 'pasy', { b: 0.14, r: 0.06 });
      dosky(k, 0, TW, 250, 110);
      k.add({ b: 0.3, r: 0.2 }, k.rect(0, 250, TW, 110));
      /* ziara lampy (zlty atrament; ked lampa zhasne, ostane len modry) */
      k.cut(k.circ(430, 170, 230), k.rad(430, 170, 20, 230, [0, 0.6], [1, 0]));
      k.add({ y: k.rad(430, 170, 0, 220, [0, 0.8], [0.5, 0.3], [1, 0]), r: k.rad(430, 170, 0, 220, [0, 0.12], [1, 0]) }, k.circ(430, 170, 230));
      /* postel */
      k.fill({ y: 0.6, r: 0.6, b: 0.6 }, k.rect(90, 150, 12, 120));
      k.fill({ y: 0.6, r: 0.6, b: 0.6 }, k.rect(356, 196, 10, 74));
      k.fill({ y: 0.56, r: 0.5, b: 0.44 }, k.rect(96, 232, 266, 20));
      k.fill({ y: 0.08, r: 0.04, b: 0.1 }, k.blob([104, 232, 108, 214, 170, 208, 250, 204, 350, 206, 360, 232]));
      k.add({ b: 0.14 }, k.rect(104, 226, 256, 6));
      /* vankus a hlava z profilu: chudy, zlta plet, hlboko posadene oci (r. 26525 az 26532) */
      k.fill({ y: 0.06, b: 0.1 }, k.blob([108, 214, 110, 196, 150, 194, 162, 206, 150, 216]));
      const hl = k.blob([128, 204, 132, 188, 146, 182, 160, 184, 168, 192, 176, 196, 170, 200, 168, 206, 150, 212, 134, 212]);
      k.fill({ y: 0.5, r: 0.26, b: 0.1 }, hl);
      k.fill({ b: 0.95, r: 0.8, y: 0.5 }, k.blob([128, 204, 130, 186, 142, 180, 152, 182, 146, 190, 138, 200]));
      k.addStroke({ b: 0.8, r: 0.6, y: 0.4 }, k.poly([158, 192, 164, 193], true), 1);
      k.addStroke({ b: 0.9, r: 0.6, y: 0.4 }, hl, 0.8);
      /* stolík, lampa, zlate okuliare */
      k.fill({ y: 0.56, r: 0.5, b: 0.44 }, k.rect(392, 196, 70, 6));
      for (const x of [396, 454]) k.fill({ y: 0.5, r: 0.5, b: 0.5 }, k.rect(x, 202, 5, 68));
      k.fill(C.zlato, k.poly([424, 196, 436, 196, 433, 176, 427, 176]));
      k.fill({ y: 0.4, r: 0.2, b: 0.4 }, k.poly([410, 168, 450, 168, 442, 146, 418, 146]));
      for (const x of [446, 456]) k.addStroke(C.zlato, k.circ(x, 192, 3.2), 1.1);
      k.stroke(C.zlato, k.poly([449.2, 192, 452.8, 192], true), 0.8);
      k.stroke(C.zlato, k.poly([442.8, 191, 436, 188], true), 0.8);
      /* stolicka s klobukom a redingotom vyslanca */
      k.fill({ y: 0.5, r: 0.5, b: 0.5 }, k.rect(512, 214, 44, 5));
      for (const x of [514, 550]) k.fill({ y: 0.5, r: 0.5, b: 0.5 }, k.rect(x, 219, 4, 51));
      k.fill({ y: 0.5, r: 0.5, b: 0.5 }, k.rect(552, 150, 4, 66));
      k.fill({ b: 0.9, r: 0.62, y: 0.4 }, k.blob([546, 156, 560, 154, 564, 200, 556, 250, 540, 246, 544, 200]));
      k.fill({ b: 0.98, r: 0.86, y: 0.5 }, k.rect(518, 196, 22, 18));
      k.fill({ b: 0.98, r: 0.86, y: 0.5 }, k.ell(529, 213, 16, 2.4));
      /* cervena stuzka na redingote (r. 26532) */
      k.fill({ r: 0.95, y: 0.3 }, k.rect(549, 176, 5, 2));
    },
  };
}

function malyRam(k, w, h) { k.papier(k.rect(0, 0, w, h)); return k.rect(6, 6, w - 12, h - 12); }
const predtym69 = [
  /* 1: zahrada v Auteuil, zem prekopana, ryl (skatula sa neukazuje) */
  {
    w: 200, h: 150, seed: 34866,
    draw(k) {
      const p = malyRam(k, 200, 150);
      k.clip(p, () => {
        k.fill({ b: 0.9, r: 0.5, y: 0.2 }, k.rect(0, 0, 200, 150));
        k.cut(k.circ(150, 36, 16), 0.9); k.fill({ y: 0.3 }, k.circ(150, 36, 12));
        for (const [x, h] of [[30, 70], [70, 90], [178, 80]]) { k.fill({ b: 0.95, r: 0.7, y: 0.5 }, k.blob([x - 26, 110, x - 20, 110 - h, x, 104 - h - 20, x + 20, 110 - h, x + 26, 110])); }
        k.fill({ y: 0.5, r: 0.44, b: 0.5 }, k.rect(0, 108, 200, 42));
        k.fill({ y: 0.66, r: 0.5, b: 0.4 }, k.blob([70, 114, 90, 106, 130, 106, 146, 116, 110, 124]));
        k.fill({ b: 0.9, r: 0.8, y: 0.6 }, k.ell(106, 115, 22, 5));
        k.stroke({ y: 0.6, r: 0.5, b: 0.5 }, k.poly([150, 120, 160, 70], true), 2.2);
        k.fill({ b: 0.6, r: 0.4, y: 0.3 }, k.poly([146, 118, 154, 118, 152, 130, 146, 130]));
      });
    },
  },
  /* 2: vecera: dama klesa, muz blednie (siluety, NAVRH) */
  {
    w: 200, h: 150, seed: 34868,
    draw(k) {
      const p = malyRam(k, 200, 150);
      k.clip(p, () => {
        k.fill({ r: 0.7, b: 0.62, y: 0.3 }, k.rect(0, 0, 200, 150));
        k.cut(k.circ(100, 60, 70), k.rad(100, 60, 0, 70, [0, 0.8], [1, 0]));
        k.add({ y: k.rad(100, 60, 0, 60, [0, 0.7], [1, 0]) }, k.circ(100, 60, 60));
        k.fill({ y: 0.2, r: 0.1, b: 0.1 }, k.rect(20, 100, 160, 8));
        for (const x of [80, 100, 120]) { k.fill({ y: 0.9, r: 0.4 }, k.ell(x, 88, 2, 5)); k.fill({ y: 0.1 }, k.rect(x - 1.5, 92, 3, 8)); }
        /* dama zaklonena */
        k.fill({ r: 0.9, b: 0.7, y: 0.4 }, k.blob([34, 150, 30, 110, 40, 84, 46, 70, 54, 74, 52, 96, 60, 150]));
        k.fill({ y: 0.4, r: 0.3, b: 0.1 }, k.circ(42, 64, 7));
        /* muz, tvar biela ako papier */
        k.fill({ b: 0.95, r: 0.8, y: 0.5 }, k.blob([150, 150, 148, 104, 156, 84, 170, 84, 176, 104, 176, 150]));
        k.fill({ y: 0.04 }, k.circ(162, 72, 8));
        k.addStroke({ b: 0.8, r: 0.5 }, k.circ(162, 72, 8), 0.8);
      });
    },
  },
  /* 3: slub: pero, papier a sedem ciarok dni */
  {
    w: 200, h: 150, seed: 36830,
    draw(k) {
      const p = malyRam(k, 200, 150);
      k.clip(p, () => {
        k.fill({ b: 0.86, r: 0.6, y: 0.36 }, k.rect(0, 0, 200, 150));
        k.fill({ y: 0.08, r: 0.03 }, k.poly([40, 40, 160, 34, 166, 124, 44, 130]));
        const l = k.P();
        for (let i = 0; i < 7; i++) { l.moveTo(60 + i * 12, 60); l.lineTo(62 + i * 12, 86); }
        k.addStroke({ b: 0.9, r: 0.5 }, l, 2);
        k.stroke({ r: 0.9, y: 0.3 }, k.poly([56, 96, 150, 92], true), 1.2);
        k.stroke({ y: 0.5, r: 0.3, b: 0.4 }, k.poly([120, 110, 176, 60], true), 1.6);
      });
    },
  },
];

const titul69 = {
  w: 300, h: 140, seed: 37320, maska: true,
  draw(k) {
    /* lampa s velkym tienidlom a velke okuliare */
    k.fill({ y: k.rad(150, 90, 0, 120, [0, 0.7], [1, 0]) }, k.ell(150, 94, 130, 46));
    k.fill({ y: 0.7, r: 0.6, b: 0.5 }, k.rect(40, 118, 220, 6));
    k.fill(C.zlato, k.poly([142, 118, 158, 118, 154, 88, 146, 88]));
    k.fill({ b: 0.72, r: 0.2, y: 0.2 }, k.poly([100, 82, 116, 38, 184, 38, 200, 82]));
    k.addStroke(C.atrament, k.poly([100, 82, 116, 38, 184, 38, 200, 82]), 1);
    for (const x of [206, 230]) { k.fill({ b: 0.14 }, k.circ(x, 108, 9)); k.addStroke({ b: 0.9, r: 0.7, y: 0.5 }, k.circ(x, 108, 9), 1.4); }
    k.stroke({ b: 0.9, r: 0.7, y: 0.5 }, k.poly([215, 108, 221, 108], true), 1.2);
    k.stroke({ b: 0.9, r: 0.7, y: 0.5 }, k.poly([239, 106, 262, 102], true), 1.2);
  },
};

/* Detaily pre ukony rukami: zapecateny papier a odporucaci list, oba bez citatelneho textu. */
export const DETAILY69 = {
  'det:pecat': {
    w: 180, h: 120, seed: 37303, maska: true,
    draw(k) {
      const p = k.poly([10, 14, 170, 8, 172, 110, 8, 114]);
      k.fill({ y: 0.12, r: 0.04, b: 0.03 }, p);
      k.add({ b: 0.1 }, k.poly([10, 14, 90, 62, 170, 8, 172, 20, 90, 70, 8, 26]));
      k.addStroke({ b: 0.5, r: 0.3 }, k.poly([10, 14, 90, 62, 170, 8], true), 0.8);
      k.fill({ r: 0.92, y: 0.3, b: 0.24 }, k.blob([80, 60, 84, 52, 94, 50, 102, 56, 100, 68, 88, 72]));
      k.addStroke({ r: 0.95, b: 0.5, y: 0.4 }, k.circ(91, 61, 5), 0.8);
      k.addStroke({ b: 0.6, r: 0.4 }, p, 0.8);
    },
  },
  'det:list69': {
    w: 160, h: 190, seed: 37625, maska: true,
    draw(k) {
      const p = k.poly([8, 6, 152, 4, 154, 186, 6, 184]);
      k.fill({ y: 0.1, r: 0.03, b: 0.03 }, p);
      /* riadky bez citatelneho textu: kniha jeho slova nedava */
      const l = k.P();
      for (let i = 0; i < 12; i++) { let x = 22; const y = 30 + i * 12, kon = 136 - (i % 4) * 10; while (x < kon) { const w = k.R(8, 22); l.moveTo(x, y); l.quadraticCurveTo(x + w / 2, y - 2.4, Math.min(kon, x + w), y); x += w + k.R(3, 6); } }
      k.addStroke({ b: 0.66, r: 0.3, y: 0.1 }, l, 0.9);
      k.fill({ r: 0.9, y: 0.3, b: 0.2 }, k.circ(128, 168, 6));
      k.addStroke({ b: 0.5, r: 0.3 }, p, 0.7);
    },
  },
};

export const TABLA69 = {
  'tablo:69prolog': prolog,
  'mapa69': mapaPariz,
  'tablo:69v': villefort('yrb'),
  'tablo:69vb': villefort('b'),
  'titul:69': titul69,
  'predtym69:1': predtym69[0], 'predtym69:2': predtym69[1], 'predtym69:3': predtym69[2],
};
export const KULISY69 = { 'b69:zadna': busoniZadna, 'b69:rez': busoniRez, 'w69:zadna': wilmoreZadna, 'w69:rez': wilmoreRez };
export const MENA69 = [...Object.keys(KULISY69), ...Object.keys(REK69), ...Object.keys(SVETLO69)];
