/* Postavy kapitoly 69 ako vytlacene papierove babky z dielov (rovnaky princip ako postavy.js).
 *
 * Gróf je jedna babka a prevlek su vrstvy dielov na tych istych kostiach. Kazda vrstva
 * je z knihy, farby a strih su NAVRH (kniha farby vacsinou nehovori):
 *  Busoni: "a monk’s dress, with a cowl on his head such as was used by learned men of
 *   the Middle Ages" (r. 37323 az 37324), "the large spectacles, which covered not only
 *   his eyes but his temples" (r. 37338 az 37339).
 *  Wilmore: "thin reddish whiskers, light complexion and light hair, turning rather gray",
 *   "a blue coat, with gilt buttons and high collar, in the fashion of 1811, a white
 *   kerseymere waistcoat, and nankeen pantaloons, three inches too short, but which were
 *   prevented by straps from slipping up to the knee" (r. 37603 az 37609); parochna,
 *   falosna celust a jazva (r. 37712 az 37715), jazva pod golierom kosele (r. 37698 az 37699).
 *  Gróf bez prevleku: "the black hair, dark complexion, and pearly teeth" (r. 37715 az 37716).
 *  Vyslanec: odev v texte neuvedeny (NAVRH tmavy redingot a klobuk, tvar v tieni).
 *  Komornik a sluha: v texte neuvedene (NAVRH Š150 a Š151).
 *
 * Konvencia ako v postavy.js: postava hladi doprava, uhol 0 = koncatina visi dole. */
import { C } from './kulisy/spolocne.js';
import { POZY as POZY18, mix } from './postavy.js';

export const MIERKA69 = 1.06;
export const KOSTI69 = {
  grof: { trup: 32, rameno: 16.5, pred: 14, stehno: 25, lytko: 24, ramX: 1.5 },
  vyslanec: { trup: 31, rameno: 16, pred: 14, stehno: 24, lytko: 23, ramX: 1.5 },
  komornik: { trup: 29, rameno: 15, pred: 13.5, stehno: 23, lytko: 22, ramX: 1.5 },
  sluha: { trup: 30, rameno: 15.5, pred: 13.5, stehno: 24, lytko: 23, ramX: 1.5 },
};

const TIEN = { b: 0.26, r: 0.1, y: 0.02 };
const LINKA = { b: 0.78, r: 0.6, y: 0.32 };

const F = {
  kozaTm: { y: 0.5, r: 0.42, b: 0.17 }, kozaTmT: { y: 0.46, r: 0.46, b: 0.32 },
  koza: { y: 0.4, r: 0.3, b: 0.08 }, kozaT: { y: 0.42, r: 0.36, b: 0.22 },
  plet: { y: 0.2, r: 0.17, b: 0.03 }, pletT: { y: 0.28, r: 0.26, b: 0.1 },
  cierne: { b: 0.96, r: 0.82, y: 0.5 },
  biela: { y: 0.05, r: 0.02, b: 0.05 }, bielaT: { y: 0.1, r: 0.05, b: 0.22 },
  tmaveNoh: { b: 0.72, r: 0.52, y: 0.36 },
  rucho: { b: 0.8, r: 0.66, y: 0.44 }, ruchoT: { b: 0.95, r: 0.82, y: 0.52 },
  nanking: { y: 0.56, r: 0.22, b: 0.07 }, nankingT: { y: 0.62, r: 0.32, b: 0.2 },
  modry: { b: 0.92, r: 0.26, y: 0.05 }, modryT: { b: 1, r: 0.46, y: 0.18 },
  zlato: C.zlato,
  svetleVlasy: { y: 0.34, r: 0.12, b: 0.14 }, sediny: { b: 0.34, r: 0.12, y: 0.08 },
  rysave: { r: 0.64, y: 0.6, b: 0.08 },
  jazva: { r: 0.9, y: 0.3, b: 0.22 },
  redingot: { b: 0.86, r: 0.6, y: 0.4 }, redingotT: { b: 1, r: 0.78, y: 0.5 },
  tienTvare: { b: 0.5, r: 0.32, y: 0.18 },
  sivy: { b: 0.36, r: 0.14, y: 0.12 },
  livrej: { r: 0.86, b: 0.44, y: 0.34 }, livrejT: { r: 0.95, b: 0.62, y: 0.44 },
  hnede: { y: 0.64, r: 0.56, b: 0.5 },
};

function diel(w, h, px, py, draw, seed) {
  return {
    w, h, pivot: [px, py], seed: seed || 11, maska: true, mierka: MIERKA69,
    draw(k) { const T = (pts) => pts.map((v, i) => v + (i % 2 ? py : px)); draw(k, T, px, py); },
  };
}
function hotovo(k, p, daleko, lw) { if (daleko) k.add(TIEN, p); k.addStroke(LINKA, p, lw || 0.55); }
function koncatina(k, T, dlzka, w0, w1, farba, daleko, o) {
  o = o || {};
  const p = k.blob(T([-w0 / 2, -1.5, w0 / 2, -1.5, w0 / 2 + 0.3, dlzka * 0.5, w1 / 2, dlzka + 1.2, 0, dlzka + 2.2, -w1 / 2, dlzka + 1.2, -w0 / 2 - 0.3, dlzka * 0.5]));
  k.fill(farba, p);
  if (o.tien) k.add(o.tien, k.poly(T([-w0 / 2, -1.5, -w0 / 2 + 2, -1, -w1 / 2 + 1.6, dlzka + 1, -w1 / 2, dlzka + 1.2])));
  hotovo(k, p, daleko);
  return p;
}
const ruka = (koza) => (k, T, daleko) => {
  const p = k.blob(T([-2, -1, 2, -1, 3.2, 2.5, 3.6, 5.5, 1.8, 7.4, -0.8, 6.8, -2, 3.5]));
  k.fill(koza, p);
  k.addStroke(F.kozaT, k.poly(T([2.6, 3, 1, 6.6]), true), 0.45);
  hotovo(k, p, daleko);
};
const topanka = (k, T, daleko) => {
  const p = k.blob(T([-2.6, -1.2, 2.2, -1.2, 5, 1.2, 9.2, 2.4, 9.6, 4.4, 3, 4.6, -2.8, 4]));
  k.fill(F.cierne, p);
  k.cut(k.poly(T([3, 1.6, 7.6, 2.8]), true), 0.3, 0.5);
  hotovo(k, p, daleko);
};

/* ── zakladne diely: ruky, nohy, chodidla pre kazdu postavu ── */
function koncatiny(meno, K, o, D) {
  for (const daleko of [false, true]) {
    const s = daleko ? 'Z' : 'P';
    D[meno + ':ram' + s] = diel(11, 23, 5.5, 3, (k, T) => koncatina(k, T, K.rameno, 5.8, 4.8, o.rukav, daleko, { tien: o.rukavT }), o.seed + 1);
    D[meno + ':pred' + s] = diel(9, 20, 4.5, 2, (k, T) => {
      koncatina(k, T, K.pred, 4.6, 3.6, o.rukav, daleko, { tien: o.rukavT });
      if (o.manzeta) k.fill(o.manzeta, k.poly(T([-2.2, K.pred - 2.2, 2.2, K.pred - 2.2, 2, K.pred + 0.8, -2, K.pred + 0.8])));
    }, o.seed + 2);
    D[meno + ':ruka' + s] = diel(9, 10, 3.5, 1.5, (k, T) => ruka(o.koza)(k, T, daleko), o.seed + 3);
    D[meno + ':steh' + s] = diel(12, 30, 6, 3, (k, T) => koncatina(k, T, K.stehno, 8.8, 6.6, o.nohavice, daleko, { tien: { b: 0.16 } }), o.seed + 4);
    D[meno + ':lyt' + s] = diel(10, 29, 5, 2.5, (k, T) => {
      koncatina(k, T, K.lytko, 5.8, 4.4, o.nohavice, daleko);
      if (o.pancuchy) { const n = k.poly(T([-2.6, K.lytko * 0.45, 2.6, K.lytko * 0.45, 2.2, K.lytko + 1, -2.2, K.lytko + 1])); k.fill(o.pancuchy, n); hotovo(k, n, daleko, 0.45); }
    }, o.seed + 5);
    D[meno + ':chod' + s] = diel(13, 7, 3, 1.5, (k, T) => topanka(k, T, daleko), o.seed + 6);
  }
}

/* hlava z profilu: tvar a oko spolocne, vlasy a klobuk podla postavy */
const TVAR = [-6.4, -9, -6.4, -17, -3.8, -22.4, 1.8, -24.4, 6.2, -21.6, 7.2, -17.4, 7.4, -15.2, 9.8, -12.2, 7.6, -11.4, 7.8, -9.6, 7, -8.2, 6.4, -5.6, 3, -3.4, -2.6, -4.6];
function tvar(k, T, koza, kozaT, o) {
  o = o || {};
  k.fill(koza, k.poly(T([-3.2, 2, 3.4, 2, 3.2, -6, -2.8, -6])));
  const t = k.blob(T(TVAR));
  k.fill(koza, t);
  k.add(kozaT, k.blob(T([-6.4, -9, -6.4, -17, -3, -18, -2, -9, -2.6, -4.6])));
  /* oko, obocie, usta */
  k.fill(C.atrament, k.circ(...T([4.7, -15.6]), 0.95));
  k.addStroke(o.obocie || F.cierne, k.poly(T([2.6, -17.8, 6.6, -18.3]), true), 1.05);
  k.addStroke(kozaT, k.poly(T([7.4, -9.6, 5.8, -9.2]), true), 0.55);
  k.addStroke(kozaT, k.poly(T([8.8, -12.6, 7.9, -12]), true), 0.45);
  /* ucho */
  k.add(kozaT, k.ell(...T([-1.8, -14.6]), 1.4, 2.4, 0.2));
  return t;
}

/* ── gróf: zaklad (bez prevleku) a vrstvy ── */
function grofDiely() {
  const K = KOSTI69.grof, D = {};
  koncatiny('grof', K, { rukav: F.biela, rukavT: { b: 0.14 }, koza: F.kozaTm, nohavice: F.tmaveNoh, seed: 690 }, D);
  D['grof:trup'] = diel(26, 43, 13, 37, (k, T) => {
    const p = k.blob(T([-7.8, 3.5, -8.6, -8, -9, -20, -7.4, -30, -3, -33.5, 3, -33.6, 7.6, -30.5, 9, -21, 8.6, -9, 8.2, 3.5]));
    k.fill(F.biela, p);
    k.add(F.bielaT, k.blob(T([-7.8, 3.5, -8.6, -8, -9, -20, -7.4, -30, -3, -33.5, -1.5, -20, -2.6, -5, -2, 3.5])));
    const z = k.P();
    for (const [a, b, c, d] of [[-4, -27, -2, -15], [3, -19, 5.5, -7]]) { const t = T([a, b, c, d]); z.moveTo(t[0], t[1]); z.lineTo(t[2], t[3]); }
    k.addStroke({ b: 0.26, r: 0.1 }, z, 0.5);
    k.fill(F.tmaveNoh, k.poly(T([-8, -0.5, 8.2, -0.5, 8.4, 5.6, -8.2, 5.6])));
    hotovo(k, p, false, 0.6);
  }, 697);
  D['grof:hlava'] = diel(30, 34, 13, 26, (k, T) => {
    const t = tvar(k, T, F.kozaTm, F.kozaTmT);
    /* cierne vlasy, kratke (r. 37715) */
    const vl = k.blob(T([-7, -7.4, -7.9, -16, -6, -22.8, -1, -25.8, 4, -25.2, 7.1, -21.8, 6.8, -19.6, 3, -20.8, -1, -19.8, -2.6, -15.2, -3.2, -9.6, -5.4, -6.6]));
    k.fill(F.cierne, vl);
    hotovo(k, t, false, 0.5);
    k.addStroke(LINKA, vl, 0.45);
    /* perlove zuby: tenky svetly tah v ustach */
    k.cut(k.poly(T([7.1, -9.7, 6.1, -9.5]), true), 0.8, 0.5);
  }, 698);

  /* Busoni: rucho (trup, rukavy, sukna), kapuca, okuliare */
  for (const daleko of [false, true]) {
    const s = daleko ? 'Z' : 'P';
    D['b:rucho:ram' + s] = diel(14, 24, 7, 3, (k, T) => koncatina(k, T, K.rameno, 7.8, 7.2, F.rucho, daleko, { tien: { b: 0.12, r: 0.08 } }), 700 + (daleko ? 1 : 0));
    D['b:rucho:pred' + s] = diel(16, 22, 6, 2, (k, T) => {
      /* siroky mnissky rukav, ktory sa k zapastiu rozsiruje */
      const p = k.blob(T([-3.6, -1.6, 3.6, -1.6, 5.2, K.pred * 0.6, 7.6, K.pred + 2.4, 1.4, K.pred + 3.4, -4.4, K.pred + 2, -4.2, K.pred * 0.5]));
      k.fill(F.rucho, p);
      k.add(F.ruchoT, k.poly(T([-4.4, K.pred + 2, 1.4, K.pred + 3.4, 1, K.pred + 1.4, -3.8, K.pred])));
      hotovo(k, p, daleko);
    }, 702 + (daleko ? 1 : 0));
  }
  D['b:rucho:trup'] = diel(28, 45, 14, 37, (k, T) => {
    const p = k.blob(T([-9, 4, -9.8, -8, -10.2, -20, -8.4, -30.6, -3.4, -34.4, 3.2, -34.4, 8.4, -31, 10, -21, 9.6, -9, 9.2, 4]));
    k.fill(F.rucho, p);
    k.add(F.ruchoT, k.blob(T([-9, 4, -9.8, -8, -10.2, -20, -8.4, -30.6, -3.4, -34.4, -1.6, -20, -3, -5, -2.4, 4])));
    const z = k.P();
    for (const x of [-4.6, 1.4, 6]) { const t = T([x, -30, x + 0.8, 2]); z.moveTo(t[0], t[1]); z.lineTo(t[2], t[3]); }
    k.addStroke(F.ruchoT, z, 0.5);
    /* povrazok v pase (NAVRH) */
    k.stroke({ y: 0.66, r: 0.44, b: 0.34 }, k.poly(T([-9.4, 0, 9.4, 0]), true), 1.3);
    k.stroke({ y: 0.66, r: 0.44, b: 0.34 }, k.poly(T([6.4, 0, 7.4, 9, 6.6, 15]), true), 0.9);
    hotovo(k, p, false, 0.6);
  }, 704);
  D['b:rucho:sukna'] = diel(34, 56, 16, 3, (k, T) => {
    const p = k.poly(T([-9.4, -2, 9.4, -2, 12, 16, 14, 38, 15, 50, -12, 50, -12.4, 36, -11, 14]));
    k.fill(F.rucho, p);
    k.add(F.ruchoT, k.poly(T([-9.4, -2, -3, -2, -5, 50, -12, 50, -12.4, 36, -11, 14])));
    const z = k.P();
    for (const x of [-4, 1.5, 7]) { const t = T([x, 3, x + 1.6, 49]); z.moveTo(t[0], t[1]); z.lineTo(t[2], t[3]); }
    k.addStroke(F.ruchoT, z, 0.5);
    hotovo(k, p, false, 0.6);
  }, 705);
  D['b:kapuca:hlava'] = diel(34, 42, 15, 30, (k, T) => {
    /* kapuca ucenca: prilieha k temenu a padá na plecia, tvar ostane volna */
    const p = k.blob(T([-9, 5, -10.8, -12, -8.8, -24.6, -2.2, -29.6, 5.2, -28.4, 9.4, -23.4, 8.2, -20.2, 4.6, -22.6, -0.4, -21.8, -3.4, -16, -3.8, -6, -3, 1, -5.6, 5.4]));
    k.fill(F.rucho, p);
    k.add(F.ruchoT, k.blob(T([-9, 5, -10.8, -12, -8.8, -24.6, -5, -26, -6.4, -12, -6, 2])));
    k.addStroke({ b: 0.5, r: 0.4, y: 0.3 }, k.poly(T([8.2, -20.2, 4.6, -22.6, -0.4, -21.8, -3.4, -16, -3.8, -6, -3, 1]), true), 0.9);
    hotovo(k, p, false, 0.55);
  }, 706);
  D['b:okuliare:hlava'] = diel(30, 34, 13, 26, (k, T) => {
    /* velke okuliare cez oci aj spanky (r. 37338 az 37339) */
    const [cx, cy] = T([5.4, -15.4]);
    k.fill({ b: 0.1, y: 0.05 }, k.ell(cx, cy, 2.6, 3.1));
    k.addStroke({ b: 0.95, r: 0.7, y: 0.5 }, k.ell(cx, cy, 2.6, 3.1), 0.8);
    k.stroke({ b: 0.95, r: 0.7, y: 0.5 }, k.poly(T([2.8, -15.8, -2.6, -16.4, -4.2, -14.2]), true), 0.7);
    k.cut(k.ell(cx + 0.9, cy - 1.2, 0.6, 1), 0.7);
  }, 707);

  /* Wilmore: osem vrstiev z data-69.json */
  for (const daleko of [false, true]) {
    const s = daleko ? 'Z' : 'P';
    D['w:nohavice:steh' + s] = diel(12, 30, 6, 3, (k, T) => {
      koncatina(k, T, K.stehno, 9, 6.8, F.nanking, daleko, { tien: { b: 0.1, r: 0.06 } });
      k.addStroke(F.nankingT, k.poly(T([1.5, 6, 2.2, 13, 1.4, 19]), true), 0.5);
    }, 710 + (daleko ? 1 : 0));
    D['w:nohavice:lyt' + s] = diel(10, 30, 5, 2.5, (k, T) => {
      /* o tri palce kratsie, pridrzane pasikom pod chodidlom */
      const L = K.lytko - 4;
      const p = k.blob(T([-3, -1.5, 3, -1.5, 3.2, L * 0.5, 2.4, L, -2.4, L, -3.2, L * 0.5]));
      k.fill(F.nanking, p);
      hotovo(k, p, daleko);
      k.stroke({ b: 0.7, r: 0.5, y: 0.4 }, k.poly(T([1.8, L, 2.2, K.lytko + 2.6]), true), 0.7);
      k.stroke({ b: 0.7, r: 0.5, y: 0.4 }, k.poly(T([-1.8, L, -2, K.lytko + 2.4]), true), 0.7);
    }, 712 + (daleko ? 1 : 0));
    D['w:kabat:ram' + s] = diel(12, 24, 6, 3, (k, T) => koncatina(k, T, K.rameno, 6.4, 5.4, F.modry, daleko, { tien: { b: 0.14, r: 0.1 } }), 714 + (daleko ? 1 : 0));
    D['w:kabat:pred' + s] = diel(10, 21, 5, 2, (k, T) => {
      koncatina(k, T, K.pred, 5.2, 4.2, F.modry, daleko);
      k.fill(F.modryT, k.poly(T([-2.4, K.pred - 3, 2.4, K.pred - 3, 2.2, K.pred + 0.6, -2.2, K.pred + 0.6])));
      k.fill(F.zlato, k.circ(...T([1, K.pred - 1.4]), 0.8));
      k.fill(F.biela, k.poly(T([-2, K.pred + 0.6, 2, K.pred + 0.6, 1.8, K.pred + 1.8, -1.8, K.pred + 1.8])));
    }, 716 + (daleko ? 1 : 0));
  }
  D['w:vesta:trup'] = diel(26, 43, 13, 37, (k, T) => {
    /* biela kasmirova vesta vpredu, s radom gombikov */
    const p = k.blob(T([-1, 3.2, -1.6, -12, -1.2, -26, 3, -30.2, 7.6, -29, 9, -21, 8.6, -9, 8.4, 3.2]));
    k.fill({ y: 0.08, r: 0.04, b: 0.04 }, p);
    k.add({ b: 0.1 }, k.poly(T([-1, 3.2, -1.6, -12, 1.4, -12, 1, 3.2])));
    for (let i = 0; i < 5; i++) k.fill({ b: 0.5, r: 0.3, y: 0.3 }, k.circ(...T([7.4, -24 + i * 5.2]), 0.55));
    hotovo(k, p, false, 0.5);
  }, 718);
  D['w:kabat:trup'] = diel(28, 45, 14, 37, (k, T) => {
    /* modry frak podla mody 1811: vpredu vykrojeny, vesta je vidiet */
    const p = k.blob(T([-9.6, 4.4, -10.2, -8, -10.4, -20, -8.6, -31, -3.4, -34.6, 2.6, -34.6, 6.2, -32, 4.4, -24, 5.6, -12, 5, -4, 1.4, 4.4]));
    k.fill(F.modry, p);
    k.add(F.modryT, k.blob(T([-9.6, 4.4, -10.2, -8, -10.4, -20, -8.6, -31, -3.4, -34.6, -1.6, -20, -3, -4, -2.6, 4.4])));
    /* klopa */
    k.fill(F.modryT, k.poly(T([6.2, -32, 3, -27, 4.4, -18, 5.6, -12, 4.4, -24])));
    for (let i = 0; i < 4; i++) k.fill(F.zlato, k.circ(...T([4.4 + (i % 2) * 0.4, -21 + i * 5]), 0.95));
    hotovo(k, p, false, 0.6);
  }, 719);
  D['w:kabat:sukna'] = diel(20, 34, 12, 3, (k, T) => {
    /* sosy fraku za nohami */
    const p = k.poly(T([-10, -2, 1, -2, 0, 12, -2, 28, -8, 30, -10.6, 14]));
    k.fill(F.modry, p);
    k.add(F.modryT, k.poly(T([-10, -2, -5, -2, -6, 30, -8, 30, -10.6, 14])));
    k.fill(F.zlato, k.circ(...T([-1.6, 1.4]), 0.9));
    hotovo(k, p, false, 0.55);
  }, 720);
  D['w:kabat:golier'] = diel(20, 18, 9, 15, (k, T) => {
    /* vysoky golier az pod celust (v suradniciach trupu, vrch trupu = y 0) */
    const p = k.blob(T([-7, -3, -7.8, -10, -5, -13.2, 1, -12.4, 4.6, -9, 5.4, -5.4, 3.4, -2, -1, 0.6]));
    k.fill(F.modry, p);
    k.add(F.modryT, k.poly(T([-7, -3, -7.8, -10, -5, -13.2, -3, -3])));
    k.fill(F.biela, k.poly(T([4.6, -9, 5.8, -8.4, 5.4, -5.4, 4.2, -6.4])));
    hotovo(k, p, false, 0.55);
  }, 721);
  D['w:kabat:golierDole'] = diel(20, 18, 9, 15, (k, T) => {
    /* golier kosele ohrnuty dole: krk je volny (r. 37698 az 37699) */
    const p = k.blob(T([-7, -1, -7.4, -5, -3, -6.4, 3, -5.6, 5.6, -3, 3.4, -0.4, -1, 1]));
    k.fill(F.modry, p);
    k.fill(F.biela, k.poly(T([3, -5.6, 6.2, -3.2, 5, -1.6, 2.4, -3.6])));
    hotovo(k, p, false, 0.55);
  }, 722);
  D['w:plet:hlava'] = diel(30, 34, 13, 26, (k, T) => {
    /* svetla plet: puder cez celu tvar (NAVRH, kniha nehovori ako) */
    const t = tvar(k, T, F.plet, F.pletT, { obocie: { y: 0.4, r: 0.3, b: 0.14 } });
    hotovo(k, t, false, 0.5);
  }, 723);
  D['w:vlasy:hlava'] = diel(30, 34, 13, 26, (k, T) => {
    const vl = k.blob(T([-7.6, -6.4, -8.8, -15, -6.8, -23.4, -1, -26.8, 4.8, -26, 7.8, -22, 7.2, -19.2, 3, -21, -0.6, -19.6, -2.6, -14, -2.2, -8.4, -5, -5]));
    k.fill(F.svetleVlasy, vl);
    const s = k.P();
    for (let i = 0; i < 7; i++) { const t = T([-6.6 + i * 1.3, -23 + i * 0.6, -7 + i * 0.7, -8 + i * 0.4]); s.moveTo(t[0], t[1]); s.quadraticCurveTo(t[0] - 1.2, (t[1] + t[3]) / 2, t[2], t[3]); }
    k.addStroke(F.sediny, s, 0.4);
    k.addStroke(LINKA, vl, 0.45);
  }, 724);
  D['w:bokombrady:hlava'] = diel(30, 34, 13, 26, (k, T) => {
    const p = k.blob(T([-1.8, -17.4, 0.6, -17, 1.4, -11, 3.2, -7.4, 1.6, -6.4, -0.8, -9.8]));
    k.fill(F.rysave, p);
    const s = k.P();
    for (let i = 0; i < 4; i++) { const t = T([-1 + i * 0.5, -16 + i * 2, 0.4 + i * 0.6, -10 + i * 0.8]); s.moveTo(t[0], t[1]); s.lineTo(t[2], t[3]); }
    k.addStroke({ r: 0.8, y: 0.5, b: 0.2 }, s, 0.35);
  }, 725);
  D['w:celust:hlava'] = diel(30, 34, 13, 26, (k, T) => {
    /* falosna celust: brada o kus dlhsia a tazsia (NAVRH tvaru) */
    const p = k.blob(T([2.8, -9.8, 7.9, -9.6, 9, -7, 7.8, -3.4, 3.6, -2, 0.8, -4.8]));
    k.fill(F.plet, p);
    k.addStroke(F.pletT, k.poly(T([7.9, -9.4, 6.2, -8.9]), true), 0.55);
    k.addStroke(LINKA, p, 0.45);
  }, 726);
  D['w:jazva:hlava'] = diel(30, 34, 13, 26, (k, T) => {
    /* cervena jazva na krku, cerstva (r. 37699 az 37700) */
    const p = k.poly(T([-2.4, 0.4, 3.6, -3.6, 4.2, -2.4, -1.8, 1.6]));
    k.fill(F.jazva, p);
    const s = k.P();
    for (let i = 0; i < 4; i++) { const t = T([-0.8 + i * 1.3, 0.8 - i * 0.9, 0.2 + i * 1.3, -1.8 - i * 0.9]); s.moveTo(t[0], t[1]); s.lineTo(t[2], t[3]); }
    k.addStroke({ r: 0.95, b: 0.5, y: 0.4 }, s, 0.4);
  }, 727);
  return D;
}

/* ── vyslanec, komornik, sluha ── */
function vyslanecDiely() {
  const K = KOSTI69.vyslanec, D = {};
  koncatiny('vyslanec', K, { rukav: F.redingot, rukavT: { b: 0.12 }, koza: F.koza, nohavice: F.tmaveNoh, manzeta: F.biela, seed: 730 }, D);
  D['vyslanec:trup'] = diel(26, 43, 13, 37, (k, T) => {
    const p = k.blob(T([-8.4, 4, -9, -8, -9.4, -20, -7.8, -30, -3.2, -33, 3.2, -33, 7.8, -30, 9.2, -20, 8.8, -8, 8.6, 4]));
    k.fill(F.redingot, p);
    k.add(F.redingotT, k.blob(T([-8.4, 4, -9, -8, -9.4, -20, -7.8, -30, -3.2, -33, -1.6, -20, -2.8, -4, -2.2, 4])));
    /* biela kravata (Villefort nosi bielu, r. 26531; pod klobukom vyslanca je to NAVRH) */
    k.fill(F.biela, k.poly(T([3, -32.6, 7.2, -30, 6, -26.6, 3.4, -28])));
    for (let i = 0; i < 4; i++) k.fill(F.redingotT, k.circ(...T([7.4, -22 + i * 5.4]), 0.8));
    hotovo(k, p, false, 0.6);
  }, 737);
  D['vyslanec:sukna'] = diel(24, 32, 12, 3, (k, T) => {
    /* dolna cast redingotu po kolena */
    const p = k.poly(T([-9, -2, 9, -2, 10.4, 14, 11, 25, -10.4, 25, -10, 12]));
    k.fill(F.redingot, p);
    k.add(F.redingotT, k.poly(T([-9, -2, -3, -2, -4.4, 25, -10.4, 25, -10, 12])));
    k.addStroke(F.redingotT, k.poly(T([7.8, -1, 8.6, 24]), true), 0.6);
    hotovo(k, p, false, 0.55);
  }, 738);
  D['vyslanec:hlava'] = diel(34, 48, 15, 26, (k, T) => {
    const t = tvar(k, T, F.koza, F.kozaT);
    /* tvar v tieni klobuka: husty modry raster cez oci a celo (NAVRH) */
    k.clip(t, () => k.add(F.tienTvare, k.rect(...T([-8, -26]), 20 * 1, 13)));
    k.hatch({ b: 0.34, r: 0.2 }, t, 60, 1.4, 0.35);
    hotovo(k, t, false, 0.5);
    /* vysoky klobuk */
    const kl = k.poly(T([-6.6, -23.4, 6.6, -23.4, 6.2, -38.4, -6, -38.6]));
    k.fill(F.cierne, kl);
    k.cut(k.poly(T([3.4, -36, 4.2, -25]), true), 0.3, 0.6);
    const okraj = k.ell(...T([0.6, -23.2]), 11.4, 1.9);
    k.fill(F.cierne, okraj);
    k.fill({ b: 0.5, r: 0.5, y: 0.3 }, k.poly(T([-6.4, -26.4, 6.4, -26.4, 6.4, -24.6, -6.4, -24.6])));
    k.addStroke(LINKA, kl, 0.5);
  }, 739);
  return D;
}
function komornikDiely() {
  const K = KOSTI69.komornik, D = {};
  koncatiny('komornik', K, { rukav: { b: 0.82, r: 0.66, y: 0.46 }, rukavT: { b: 0.1 }, koza: F.koza, nohavice: { b: 0.82, r: 0.66, y: 0.46 }, seed: 750 }, D);
  D['komornik:trup'] = diel(26, 43, 13, 37, (k, T) => {
    const p = k.blob(T([-8, 3.6, -8.8, -8, -9.2, -19, -7.6, -27.4, -3, -30.4, 3, -30.4, 7.4, -27.6, 8.8, -19, 8.4, -8, 8.2, 3.6]));
    k.fill({ b: 0.82, r: 0.66, y: 0.46 }, p);
    k.add({ b: 0.16 }, k.blob(T([-8, 3.6, -8.8, -8, -9.2, -19, -7.6, -27.4, -3, -30.4, -1.6, -18, -2.6, 3.6])));
    k.fill(F.biela, k.poly(T([2.6, -30, 6.8, -27.8, 5.4, -25.4, 2.6, -26.8])));
    hotovo(k, p, false, 0.6);
  }, 757);
  D['komornik:hlava'] = diel(30, 34, 13, 26, (k, T) => {
    const t = tvar(k, T, F.koza, F.kozaT, { obocie: F.sivy });
    const vl = k.blob(T([-7, -7, -7.6, -15, -5.6, -21.6, -1, -24.2, 3.4, -23.8, 5.6, -21.8, 2.4, -21.4, -1.2, -20.4, -2.4, -15.4, -3, -9.6, -5.2, -6.4]));
    k.fill(F.sivy, vl);
    k.addStroke(F.kozaT, k.poly(T([3.4, -18.8, 5, -19.2]), true), 0.4);
    hotovo(k, t, false, 0.5);
    k.addStroke(LINKA, vl, 0.45);
  }, 758);
  return D;
}
function sluhaDiely() {
  const K = KOSTI69.sluha, D = {};
  koncatiny('sluha', K, { rukav: F.livrej, rukavT: { b: 0.12 }, koza: F.koza, nohavice: F.livrejT, pancuchy: F.biela, seed: 770 }, D);
  D['sluha:trup'] = diel(26, 43, 13, 37, (k, T) => {
    const p = k.blob(T([-8.2, 4, -8.8, -8, -9.2, -19.6, -7.6, -28.6, -3, -31.6, 3, -31.6, 7.4, -28.6, 8.8, -19.6, 8.4, -8, 8.2, 4]));
    k.fill(F.livrej, p);
    k.add(F.livrejT, k.blob(T([-8.2, 4, -8.8, -8, -9.2, -19.6, -7.6, -28.6, -3, -31.6, -1.4, -18, -2.4, 4])));
    for (let i = 0; i < 5; i++) k.fill(F.zlato, k.circ(...T([7.2, -26 + i * 5.4]), 0.8));
    k.fill(F.biela, k.poly(T([2.8, -31.2, 6.8, -29, 5.6, -26.4, 2.8, -28])));
    hotovo(k, p, false, 0.6);
  }, 777);
  D['sluha:hlava'] = diel(30, 34, 13, 26, (k, T) => {
    const t = tvar(k, T, F.koza, F.kozaT, { obocie: F.hnede });
    const vl = k.blob(T([-7.2, -6, -8, -15, -6, -22.4, -1, -25, 4, -24.6, 6.8, -21.6, 3, -21, -1.2, -19.8, -2.8, -14.6, -3.4, -8.6, -6, -4]));
    k.fill(F.hnede, vl);
    k.fill(F.cierne, k.poly(T([-7.8, -9, -9.6, -6.6, -9, -4.4, -7.4, -6.8])));
    hotovo(k, t, false, 0.5);
    k.addStroke(LINKA, vl, 0.45);
  }, 778);
  return D;
}

/* Rekvizity v rukach: mesec vyslanca (NAVRH), zapecateny papier, odporucaci list. */
function rekvizity69() {
  return {
    'rek69:mesec': diel(10, 12, 4, 2, (k, T) => {
      const p = k.blob(T([-2, 0, 2, 0, 4.4, 5, 3.4, 9, -3, 9, -4, 5]));
      k.fill({ r: 0.7, y: 0.5, b: 0.36 }, p);
      k.stroke(C.zlato, k.poly(T([-2, 1, 2, 1]), true), 0.8);
      k.addStroke(LINKA, p, 0.45);
    }, 790),
    'rek69:list': diel(16, 14, 2, 11, (k, T) => {
      const p = k.poly(T([0, 0, 1, -10, 12, -11, 13, -1]));
      k.fill(C.plat, p);
      k.fill(C.cervena, k.circ(...T([6.6, -5.4]), 1.5));
      k.addStroke(LINKA, p, 0.4);
    }, 791),
  };
}

export const DIELY69 = Object.assign({}, grofDiely(), vyslanecDiely(), komornikDiely(), sluhaDiely(), rekvizity69());

/* ── Pozy kapitoly 69 (k pozam z postavy.js) ── */
export const POZY69 = Object.assign({}, POZY18, {
  stojRuky: { trup: 0.03, hlava: 0.02, ramZ: [0.55, 1.5], ramP: [0.45, 1.55], nohaZ: [0.05, -0.04], nohaP: [-0.05, -0.02], boky: 48 },
  sedStol: { trup: 0.1, hlava: 0.06, ramZ: [0.55, 1.2], ramP: [0.62, 1.1], nohaZ: [1.5, -1.5], nohaP: [1.4, -1.4], boky: 26 },
  sedStolRuky: { trup: 0.14, hlava: 0.1, ramZ: [0.7, 1.0], ramP: [0.9, 0.6], nohaZ: [1.5, -1.5], nohaP: [1.4, -1.4], boky: 26 },
  sedTienidlo: { trup: 0.2, hlava: 0.08, ramZ: [0.55, 1.2], ramP: [1.25, 0.2], nohaZ: [1.5, -1.5], nohaP: [1.4, -1.4], boky: 26 },
  sedClona: { trup: -0.08, hlava: -0.16, ramZ: [0.5, 1.2], ramP: [1.25, 2.15], nohaZ: [1.5, -1.5], nohaP: [1.4, -1.4], boky: 26 },
  sedPredklon: { trup: 0.3, hlava: 0.12, ramZ: [0.5, 1.4], ramP: [0.7, 1.2], nohaZ: [1.5, -1.5], nohaP: [1.4, -1.4], boky: 26 },
  sedStrnuly: { trup: -0.04, hlava: -0.04, ramZ: [0.35, 1.25], ramP: [0.35, 1.3], nohaZ: [1.5, -1.5], nohaP: [1.4, -1.4], boky: 26 },
  uklon: { trup: 0.55, hlava: 0.3, ramZ: [0.08, 0.1], ramP: [-0.1, 0.1], nohaZ: [0.1, -0.06], nohaP: [-0.08, -0.02], boky: 47 },
  uklonStrnuly: { trup: 0.2, hlava: 0.1, ramZ: [0.02, 0.02], ramP: [0.0, 0.02], nohaZ: [0.04, -0.02], nohaP: [-0.04, -0.02], boky: 48 },
  obliekanie: { trup: 0.02, hlava: -0.08, ramZ: [1.3, 1.9], ramP: [1.5, 2.0], nohaZ: [0.05, -0.04], nohaP: [-0.05, -0.02], boky: 48 },
  obliekanieDole: { trup: 0.35, hlava: 0.25, ramZ: [0.6, 0.3], ramP: [0.7, 0.2], nohaZ: [0.2, -0.3], nohaP: [-0.1, -0.2], boky: 45 },
  golier: { trup: -0.04, hlava: -0.26, ramZ: [0.2, 0.3], ramP: [1.7, 2.35], nohaZ: [1.5, -1.5], nohaP: [1.4, -1.4], boky: 26 },
  golierStoj: { trup: -0.04, hlava: -0.3, ramZ: [0.1, 0.2], ramP: [1.7, 2.35], nohaZ: [0.05, -0.04], nohaP: [-0.05, -0.02], boky: 48 },
  strhnut: { trup: 0.04, hlava: 0.12, ramZ: [0.1, 0.2], ramP: [2.5, 1.6], nohaZ: [0.05, -0.04], nohaP: [-0.05, -0.02], boky: 48 },
  pisanie: { trup: 0.3, hlava: 0.3, ramZ: [0.8, 0.9], ramP: [1.0, 0.6], nohaZ: [1.5, -1.5], nohaP: [1.4, -1.4], boky: 26 },
  ukazat: { trup: 0.06, hlava: 0.02, ramZ: [0.5, 1.2], ramP: [1.3, 0.1], nohaZ: [1.5, -1.5], nohaP: [1.4, -1.4], boky: 26 },
  dvere: { trup: 0.06, hlava: 0.02, ramZ: [0.2, 0.2], ramP: [1.2, 0.3], nohaZ: [0.05, -0.04], nohaP: [-0.05, -0.02], boky: 48 },
  okienko: { trup: 0.12, hlava: 0.1, ramZ: [0.2, 0.3], ramP: [0.9, 1.4], nohaZ: [0.05, -0.04], nohaP: [-0.05, -0.02], boky: 48 },
});
export { mix };

/* Poradie vrstiev pri kresleni (nezavisi od poradia, v akom ich hrac oblieka). */
const HLAVA_VRSTVY = ['plet', 'celust', 'bokombrady', 'vlasy', 'jazva', 'kapuca', 'okuliare'];
const HLAVA_DIEL = { plet: 'w:plet:hlava', celust: 'w:celust:hlava', bokombrady: 'w:bokombrady:hlava', vlasy: 'w:vlasy:hlava', jazva: 'w:jazva:hlava', kapuca: 'b:kapuca:hlava', okuliare: 'b:okuliare:hlava' };
export const STRHNE = ['vlasy', 'bokombrady', 'celust', 'jazva', 'plet'];

/* Nakresli babku kapitoly 69. h = herec: { vrstvy:Set, okuliareNaOciach, golierDole, strhava (0 az 1), rek }. */
export function kresliBabku69(ctx, B, meno, p, x, y, smer, sSveta, h) {
  const K = KOSTI69[meno];
  const s = sSveta * MIERKA69;
  const v = (h && h.vrstvy) || new Set();
  const d = (n, alfa, posun) => {
    const b = B[n];
    if (!b) return;
    const kr = DIELY69[n];
    if (alfa != null && alfa < 1) { if (alfa <= 0.01) return; ctx.globalAlpha = alfa; }
    if (posun) { ctx.save(); ctx.translate(posun[0] * s, posun[1] * s); ctx.rotate(posun[2] || 0); }
    ctx.drawImage(b, -kr.pivot[0] * s, -kr.pivot[1] * s, kr.w * s, kr.h * s);
    if (posun) ctx.restore();
    ctx.globalAlpha = 1;
  };
  const busoni = meno === 'grof' && v.has('rucho');
  const kabat = meno === 'grof' && v.has('kabat');
  const nohavice = meno === 'grof' && v.has('nohavice');
  ctx.save();
  ctx.translate(x * sSveta, y * sSveta - p.boky * s);
  if (smer < 0) ctx.scale(-1, 1);
  const noha = (n, st) => {
    ctx.save();
    ctx.rotate(-n[0]); d(meno + ':steh' + st); if (nohavice) d('w:nohavice:steh' + st);
    ctx.translate(0, K.stehno * s); ctx.rotate(-n[1]); d(meno + ':lyt' + st); if (nohavice) d('w:nohavice:lyt' + st);
    ctx.translate(0, K.lytko * s); ctx.rotate(n[0] + n[1] + (p.spicka || 0)); d(meno + ':chod' + st);
    ctx.restore();
  };
  const ruka = (a, st, dx) => {
    ctx.save();
    ctx.rotate(p.trup);
    ctx.translate(dx * s, (-K.trup + 3.5) * s);
    ctx.rotate(-a[0]); d(meno + ':ram' + st); if (busoni) d('b:rucho:ram' + st); if (kabat) d('w:kabat:ram' + st);
    ctx.translate(0, K.rameno * s); ctx.rotate(-a[1]); d(meno + ':pred' + st); if (busoni) d('b:rucho:pred' + st); if (kabat) d('w:kabat:pred' + st);
    ctx.translate(0, K.pred * s); d(meno + ':ruka' + st);
    const r = h && h.rek && h.rek['ruka' + st];
    if (r) { if (r.uhol) ctx.rotate(r.uhol); d(r.meno); }
    ctx.restore();
  };
  const sukna = (n) => { ctx.save(); ctx.rotate(-((p.nohaZ[0] + p.nohaP[0]) / 2) * 0.92); d(n); ctx.restore(); };
  ruka(p.ramZ, 'Z', -K.ramX);
  noha(p.nohaZ, 'Z');
  if (kabat) sukna('w:kabat:sukna');
  noha(p.nohaP, 'P');
  if (busoni) sukna('b:rucho:sukna');
  if (meno === 'vyslanec') sukna('vyslanec:sukna');
  ctx.save();
  ctx.rotate(p.trup);
  d(meno + ':trup');
  if (meno === 'grof' && v.has('vesta')) d('w:vesta:trup');
  if (kabat) d('w:kabat:trup');
  if (busoni) d('b:rucho:trup');
  ctx.save();
  ctx.translate(0.6 * s, -K.trup * s);
  ctx.rotate(p.hlava);
  d(meno + ':hlava');
  if (meno === 'grof') {
    const t = h && h.strhava || 0;
    for (const vr of HLAVA_VRSTVY) {
      if (!v.has(vr)) continue;
      if (vr === 'okuliare' && !(h && h.okuliareNaOciach)) continue;
      if (t && STRHNE.includes(vr)) {
        /* strhnutie jednou rukou: diely odletia k ruke a zmiznu (r. 37712 az 37716) */
        const q = Math.min(1, t * 1.25);
        d(HLAVA_DIEL[vr], vr === 'plet' ? 1 - q : 1 - q * q, vr === 'plet' ? null : [q * 9, -q * 16, -q * 0.6]);
      } else d(HLAVA_DIEL[vr]);
    }
  }
  ctx.restore();
  if (kabat) d(h && h.golierDole ? 'w:kabat:golierDole' : 'w:kabat:golier', null, [0.6, -K.trup + 1]);
  ctx.restore();
  ruka(p.ramP, 'P', K.ramX);
  ctx.restore();
}
