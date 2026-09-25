/* Postavy ako vytlacene papierove babky.
 *
 * Kazdy diel (trup, hlava, rameno, predlaktie, ruka, stehno, lytko, chodidlo, pri Fariovi
 * aj sukna habitu) sa vytlaci raz ako maly vystrihnuty obraz s vlastnym rastrom a pohyb
 * je len otacanie dielov na kostiach. Body rastra idu s dielom, takze postava ani jej
 * odev sa pri pohybe nikdy nerozteka a v kazdej snimke je rovnaka.
 *
 * Z knihy: Faria je maly, vlasy vybielene utrpenim, hlboko posadene prenikave oko pod
 * hustym sivym obocim, dlha a este cierna brada po prsia (r. 6720 az 6723), saty take
 * roztrhane, ze sa da len hadat povodny strih (r. 6727 az 6729); nehybe pravou rukou
 * ani nohou (r. 8175 az 8176), pouziva len lavu ruku (r. 8257 az 8259).
 * Edmond: handry (r. 9321); vlasy a brada NAVRH kratsie nez pri uteku (r. 9764 az 9767).
 * Farby odevu kniha nehovori: NAVRH.
 *
 * Konvencia: postava hladi doprava (+x). Uhol koncatiny 0 = visi dole, kladny = dopredu.
 * Trup 0 = vzpriamene, kladny = predklon. Pri pohlade dolava sa babka zrkadli, takze
 * blizsia strana je vtedy prava: Faria dolava ukazuje ochrnutu ruku, doprava tu zivu. */
import { C } from './kulisy/spolocne.js';

/* Babky sa tlacia a kreslia o nieco vacsie nez 96 jednotiek sveta, aby tvare citali (NAVRH). */
export const MIERKA = 1.24;
export const KOSTI = {
  edmond: { trup: 31, rameno: 16, pred: 14, stehno: 24, lytko: 23, ramX: 1.5 },
  faria: { trup: 28, rameno: 14.5, pred: 13, stehno: 21, lytko: 21, ramX: 1.5 },
};

const TIEN = { b: 0.26, r: 0.1, y: 0.02 };
const LINKA = { b: 0.75, r: 0.6, y: 0.3 };

const V = {
  edmond: {
    koza: C.koza, kozaT: { y: 0.42, r: 0.36, b: 0.2 },
    kosela: { y: 0.18, r: 0.06, b: 0.12 }, koselaT: { y: 0.22, r: 0.1, b: 0.32 },
    nohavice: { b: 0.52, r: 0.3, y: 0.28 }, vlasy: { b: 0.9, r: 0.72, y: 0.46 },
  },
  faria: {
    koza: { y: 0.34, r: 0.24, b: 0.1 }, kozaT: { y: 0.36, r: 0.3, b: 0.24 },
    habit: { y: 0.5, r: 0.42, b: 0.3 }, habitT: { y: 0.46, r: 0.46, b: 0.52 },
    vlasy: { b: 0.08, y: 0.03 }, obocie: { b: 0.52, r: 0.22, y: 0.1 }, brada: { b: 0.96, r: 0.82, y: 0.48 },
  },
};

/* Diel: kresba s maskou, pivot (kost) v bode (px, py) vo vnutri obrazu. */
function diel(w, h, px, py, draw, seed) {
  return {
    w, h, pivot: [px, py], seed: seed || 11, maska: true, mierka: MIERKA,
    draw(k) {
      const T = (pts) => pts.map((v, i) => v + (i % 2 ? py : px));
      draw(k, T, px, py);
    },
  };
}

/* Obrys a tien: kazdy diel dostane tenku linku (vystrihnuta babka) a pri vzdialenej strane tien. */
function hotovo(k, p, daleko, lw) {
  if (daleko) k.add(TIEN, p);
  k.addStroke(LINKA, p, lw || 0.55);
}

function koncatina(k, T, dlzka, w0, w1, farba, daleko, o) {
  o = o || {};
  const p = k.blob(T([-w0 / 2, -1.5, w0 / 2, -1.5, w0 / 2 + 0.3, dlzka * 0.5, w1 / 2, dlzka + 1.2, 0, dlzka + 2.2, -w1 / 2, dlzka + 1.2, -w0 / 2 - 0.3, dlzka * 0.5]));
  k.fill(farba, p);
  if (o.tien) k.add(o.tien, k.poly(T([-w0 / 2, -1.5, -w0 / 2 + 2, -1, -w1 / 2 + 1.6, dlzka + 1, -w1 / 2, dlzka + 1.2])));
  hotovo(k, p, daleko);
  return p;
}

/* rozstrapkany lem: cikcak medzi x0 a x1 vo vyske y */
function lem(x0, x1, y, hl, n, rnd) {
  const out = [];
  for (let i = 0; i <= n; i++) out.push(x0 + ((x1 - x0) * i) / n, y + (i % 2 ? hl * (0.6 + rnd() * 0.8) : -hl * 0.2 * rnd()));
  return out;
}

function edmondDiely() {
  const K = KOSTI.edmond, F = V.edmond, D = {};
  for (const daleko of [false, true]) {
    const s = daleko ? 'Z' : 'P';
    D['edmond:ram' + s] = diel(10, 22, 5, 3, (k, T) => {
      /* rukav roztrhanej kosele po laket, pod nim holá ruka */
      koncatina(k, T, K.rameno, 5.6, 4.6, F.koza, daleko);
      const r = k.poly(T([-3.4, -2, 3.4, -2, 3.2, 8, ...lem(3, -3.2, 10.5, 2.2, 5, k.rnd).slice(0), -3.3, 8]));
      k.fill(F.kosela, r);
      k.add({ b: 0.12 }, k.poly(T([-3.4, -2, -1, -2, -1.2, 10, -3.3, 9])));
      hotovo(k, r, daleko);
    }, 21);
    D['edmond:pred' + s] = diel(8, 19, 4, 2, (k, T) => koncatina(k, T, K.pred, 4.4, 3.4, F.koza, daleko, { tien: { r: 0.1, b: 0.06 } }), 22);
    D['edmond:ruka' + s] = diel(9, 10, 3.5, 1.5, (k, T) => {
      const p = k.blob(T([-2, -1, 2, -1, 3.2, 2.5, 3.6, 5.5, 1.8, 7.4, -0.8, 6.8, -2, 3.5]));
      k.fill(F.koza, p);
      k.addStroke(F.kozaT, k.poly(T([2.6, 3, 1, 6.6]), true), 0.5);
      hotovo(k, p, daleko);
    }, 23);
    D['edmond:steh' + s] = diel(12, 29, 6, 3, (k, T) => {
      koncatina(k, T, K.stehno, 8.6, 6.4, F.nohavice, daleko, { tien: { b: 0.14 } });
      k.addStroke({ b: 0.2, r: 0.1 }, k.poly(T([1.5, 6, 2.2, 12, 1.4, 17]), true), 0.5);
    }, 24);
    D['edmond:lyt' + s] = diel(10, 28, 5, 2.5, (k, T) => {
      koncatina(k, T, K.lytko, 5.2, 4, F.koza, daleko);
      /* nohavica roztrhana pod kolenom (NAVRH) */
      const n = k.poly(T([-3.6, -2, 3.6, -2, 3.4, 9, ...lem(3.2, -3.4, 11, 2.4, 5, k.rnd), -3.4, 9]));
      k.fill(F.nohavice, n);
      hotovo(k, n, daleko);
    }, 25);
    D['edmond:chod' + s] = diel(13, 7, 3, 1.5, (k, T) => {
      const p = k.blob(T([-2.4, -1.2, 2, -1.2, 5, 1.4, 9, 2.6, 9.4, 4.2, 3, 4.4, -2.6, 3.8]));
      k.fill(F.koza, p);
      hotovo(k, p, daleko);
    }, 26);
  }
  D['edmond:trup'] = diel(26, 42, 13, 36, (k, T) => {
    /* kosela z hrubeho platna, roztrhana (r. 9321 handry), vpredu otvorena */
    const p = k.blob(T([-7.8, 3.5, -8.6, -8, -9, -20, -7.4, -29, -3, -32.5, 3, -32.6, 7.6, -29.5, 9, -21, 8.6, -9, 8.2, 3.5]));
    k.fill(F.kosela, p);
    k.add(F.koselaT, k.blob(T([-7.8, 3.5, -8.6, -8, -9, -20, -7.4, -29, -3, -32.5, -1.5, -20, -2.6, -5, -2, 3.5])));
    /* vystrih a tahy latky */
    k.fill(F.koza, k.poly(T([1.5, -32, 5.5, -30, 3.8, -23.5])));
    const z = k.P();
    for (const [a, b, c, d] of [[-4, -26, -2, -14], [3, -18, 5.5, -6], [-5, -8, -3, 1], [6, -26, 7.5, -20]]) { const t = T([a, b, c, d]); z.moveTo(t[0], t[1]); z.lineTo(t[2], t[3]); }
    k.addStroke({ b: 0.3, r: 0.14 }, z, 0.5);
    /* diera v kosli */
    k.fill(F.kozaT, k.ell(T([4, -12])[0], T([4, -12])[1], 1.6, 2.4, 0.3));
    const lm = k.poly(T([-8, 2, ...lem(-8, 8.4, 3.6, 2.6, 7, k.rnd), 8.4, 2]));
    k.fill(F.kosela, lm);
    /* pas nohavic */
    k.fill(F.nohavice, k.poly(T([-8, 0, 8.2, 0, 8.4, 5.6, -8.2, 5.6])));
    k.fill(F.koselaT, k.poly(T([-8.4, 2.5, 8.6, 2.5, 8.4, 4.4, -8.4, 4.4])));
    hotovo(k, p, false, 0.6);
  }, 27);
  D['edmond:hlava'] = diel(30, 34, 13, 26, (k, T) => {
    const hl = T([1, -13.5]);
    /* krk */
    k.fill(F.koza, k.poly(T([-3.2, 2, 3.4, 2, 3.2, -6, -2.8, -6])));
    /* tvar z profilu: celo, nos, pery, brada */
    const tvar = k.blob(T([-6.4, -9, -6.4, -17, -3.8, -22.4, 1.8, -24.4, 6.2, -21.6, 7.2, -17.4, 7.4, -15.2, 9.6, -12.4, 7.6, -11.4, 7.8, -9.6, 7, -8.2, 6.4, -5.6, 3, -3.4, -2.6, -4.6]));
    k.fill(F.koza, tvar);
    k.add(F.kozaT, k.blob(T([-6.4, -9, -6.4, -17, -3, -18, -2, -9, -2.6, -4.6])));
    /* oko a obocie */
    k.fill(C.atrament, k.circ(T([4.6, -15.6])[0], T([4.6, -15.6])[1], 0.95));
    k.addStroke(F.vlasy, k.poly(T([2.6, -17.8, 6.6, -18.2]), true), 1.1);
    k.addStroke(F.kozaT, k.poly(T([8.6, -12.8, 7.8, -12]), true), 0.5);
    /* brada (NAVRH kratsia nez pri uteku) */
    const br = k.blob(T([-2.4, -12, 0.4, -10.6, 3.6, -10.4, 7.4, -9.8, 7.8, -7.4, 6.6, -3.2, 3.2, -1.2, -1.6, -2.6, -3.6, -7.8]));
    k.fill(F.vlasy, br);
    k.fill(F.koza, k.blob(T([5.4, -10.4, 7.9, -10.2, 7.7, -9.2, 5.6, -9.3])));
    /* vlasy dlhe, dozadu po plecia */
    const vl = k.blob(T([-7.8, -6, -9, -14, -7.6, -21.6, -3, -25.8, 2.4, -26, 6.8, -23.2, 7.2, -20.2, 3.2, -21.4, -1, -20.6, -2.4, -16, -3.6, -10, -3.2, -2, -5.4, 2.6, -8.6, 1.4]));
    k.fill(F.vlasy, vl);
    const pr = k.P();
    for (let i = 0; i < 6; i++) { const t = T([-6 + i * 0.6, -20 + i * 1.2, -7.4 + i * 0.4, -4 + i * 0.4]); pr.moveTo(t[0], t[1]); pr.lineTo(t[2], t[3]); }
    k.addStroke({ y: 0.12, r: 0.06 }, pr, 0.4);
    hotovo(k, tvar, false, 0.5);
    k.addStroke(LINKA, vl, 0.5);
    void hl;
  }, 28);
  return D;
}

function fariaDiely() {
  const K = KOSTI.faria, F = V.faria, D = {};
  for (const daleko of [false, true]) {
    const s = daleko ? 'Z' : 'P';
    D['faria:ram' + s] = diel(11, 20, 5.5, 3, (k, T) => {
      const p = koncatina(k, T, K.rameno, 6.4, 5.8, F.habit, daleko, { tien: { b: 0.16 } });
      k.addStroke({ b: 0.3, r: 0.2 }, k.poly(T([1.6, 3, 2.2, 10]), true), 0.45);
      void p;
    }, 31);
    D['faria:pred' + s] = diel(11, 19, 5.5, 2, (k, T) => {
      koncatina(k, T, K.pred, 5.8, 5, F.habit, daleko);
      /* rozstrapkany rukav nad zapastim */
      const r = k.poly(T([-3.2, K.pred - 3, ...lem(-3.4, 3.4, K.pred + 0.6, 2.4, 5, k.rnd), 3.2, K.pred - 3]));
      k.fill(F.habit, r);
      hotovo(k, r, daleko);
    }, 32);
    D['faria:ruka' + s] = diel(9, 10, 3.5, 1.5, (k, T) => {
      const p = k.blob(T([-1.8, -1, 1.8, -1, 3, 2.4, 3.4, 5.4, 1.6, 7.2, -0.8, 6.6, -1.8, 3.4]));
      k.fill(F.koza, p);
      k.addStroke(F.kozaT, k.poly(T([-0.6, 1, 0.6, 5.4]), true), 0.4);
      hotovo(k, p, daleko);
    }, 33);
    D['faria:steh' + s] = diel(12, 26, 6, 3, (k, T) => koncatina(k, T, K.stehno, 8, 6, F.habitT, daleko), 34);
    D['faria:lyt' + s] = diel(9, 25, 4.5, 2.5, (k, T) => {
      koncatina(k, T, K.lytko, 4.4, 3.6, F.koza, daleko);
      /* tenke nohy v potrhanych navlekoch (NAVRH) */
      const n = k.poly(T([-2.6, -1.6, 2.6, -1.6, 2.4, 12, ...lem(2.3, -2.4, 14, 2, 4, k.rnd), -2.4, 12]));
      k.fill({ b: 0.46, r: 0.36, y: 0.4 }, n);
      hotovo(k, n, daleko);
    }, 35);
    D['faria:chod' + s] = diel(12, 7, 3, 1.5, (k, T) => {
      const p = k.blob(T([-2.2, -1.2, 1.8, -1.2, 4.6, 1.4, 8.2, 2.6, 8.6, 4, 3, 4.2, -2.4, 3.6]));
      k.fill(F.koza, p);
      hotovo(k, p, daleko);
    }, 36);
  }
  D['faria:sukna'] = diel(28, 34, 14, 3, (k, T) => {
    /* dolna cast habitu, taka roztrhana, ze sa da len hadat povodny strih (r. 6727 az 6729) */
    const p = k.poly(T([-9, -2, 9, -2, 11, 12, 12.4, 22, ...lem(12.4, -11.6, 26, 5, 11, k.rnd), -11.6, 21, -10.6, 10]));
    k.fill(F.habit, p);
    k.add(F.habitT, k.poly(T([-9, -2, -3, -2, -5, 26, -11.6, 25, -10.6, 10])));
    const z = k.P();
    for (const x of [-4, 1, 5.5]) { const t = T([x, 2, x + 1.2, 22]); z.moveTo(t[0], t[1]); z.lineTo(t[2], t[3]); }
    k.addStroke({ b: 0.3, r: 0.2 }, z, 0.5);
    k.fill(F.habitT, k.ell(T([4, 14])[0], T([4, 14])[1], 1.4, 2.2));
    hotovo(k, p, false, 0.6);
  }, 37);
  D['faria:trup'] = diel(26, 38, 13, 33, (k, T) => {
    const p = k.blob(T([-8.4, 2.5, -9.4, -8, -9.2, -19, -7.4, -26.4, -3, -29.4, 2.6, -29.6, 7, -27, 8.8, -19, 9, -8, 8.8, 2.5]));
    k.fill(F.habit, p);
    k.add(F.habitT, k.blob(T([-8.4, 2.5, -9.4, -8, -9.2, -19, -7.4, -26.4, -3, -29.4, -1.4, -18, -2.4, -4, -2, 2.5])));
    /* zaplaty a trhliny */
    k.fill({ y: 0.6, r: 0.36, b: 0.2 }, k.poly(T([2.4, -15, 7, -14, 6.6, -9, 2.2, -9.6])));
    k.addStroke({ b: 0.4, r: 0.2 }, k.poly(T([2.4, -15, 7, -14, 6.6, -9, 2.2, -9.6])), 0.4);
    k.fill(F.habitT, k.poly(T([-5, -6, -3.2, -2, -4.6, 1, -6, -2])));
    /* povrazok v pase */
    k.stroke({ y: 0.6, r: 0.4, b: 0.36 }, k.poly(T([-9, 0.6, 9, 0.6]), true), 1.4);
    hotovo(k, p, false, 0.6);
  }, 38);
  D['faria:hlava'] = diel(32, 50, 14, 24, (k, T) => {
    k.fill(F.koza, k.poly(T([-3, 2, 3.2, 2, 3, -6, -2.6, -6])));
    const tvar = k.blob(T([-6, -9, -6.2, -16.6, -3.6, -21.8, 1.6, -23.4, 5.6, -21, 6.6, -17, 6.8, -15, 9.2, -11.8, 7.2, -11, 7.4, -9.4, 6.6, -8, 6, -5.6, 2.8, -3.4, -2.4, -4.6]));
    k.fill(F.koza, tvar);
    k.add(F.kozaT, k.blob(T([-6, -9, -6.2, -16.6, -3, -17.4, -2, -9, -2.4, -4.6])));
    /* vrasky */
    const vr = k.P();
    for (const [a, b, c, d] of [[1, -20.4, 4.6, -20.6], [0.6, -19.2, 4.2, -19.6], [5.2, -12, 3.8, -9.6]]) { const t = T([a, b, c, d]); vr.moveTo(t[0], t[1]); vr.lineTo(t[2], t[3]); }
    k.addStroke(F.kozaT, vr, 0.4);
    /* hlboko posadene prenikave oko pod hustym sivym obocim (r. 6720 az 6723) */
    const o = T([4.2, -15.2]);
    k.add({ b: 0.2, r: 0.16 }, k.ell(o[0], o[1], 2.2, 1.6));
    k.fill(C.atrament, k.circ(o[0] + 0.2, o[1] + 0.1, 0.9));
    k.cut(k.circ(o[0] + 0.5, o[1] - 0.3, 0.32), 1);
    k.fill(F.obocie, k.blob(T([1.4, -17, 3.4, -18.8, 7, -18.4, 7.4, -17, 4.4, -17.2])));
    /* dlha a este cierna brada, az po prsia */
    const br = k.blob(T([-1.6, -12.4, 1.4, -10.8, 4, -10.6, 7.2, -9.6, 7.6, -6, 7.8, 2, 6.6, 12, 4.2, 20, 1.6, 23.2, -0.6, 18, -1.4, 8, -3, 0, -3.4, -8]));
    k.fill(F.brada, br);
    const pr = k.P();
    for (let i = 0; i < 7; i++) { const t = T([0.4 + i * 1, -6 + i * 0.4, 1 + i * 0.7, 8 + i * 1.8]); pr.moveTo(t[0], t[1]); pr.quadraticCurveTo(t[0] + 1.2, (t[1] + t[3]) / 2, t[2], t[3]); }
    k.addStroke({ y: 0.14, r: 0.12, b: 0.2 }, pr, 0.35);
    /* fuzy a pery */
    k.fill(F.koza, k.blob(T([5.6, -10.2, 7.7, -10.1, 7.6, -9.1, 5.8, -9.2])));
    /* vlasy vybielene utrpenim */
    const vl = k.blob(T([-7.6, -4, -8.6, -12, -7.4, -20.4, -3, -24.8, 2.2, -25, 6.2, -22.4, 6.8, -19.6, 3.4, -20.8, -0.6, -20, -2.2, -15, -3.2, -9, -3, -1, -5.4, 1.4]));
    k.fill(F.vlasy, vl);
    const vt = k.P();
    for (let i = 0; i < 9; i++) { const t = T([-6.4 + i * 0.9, -22 + i * 0.8, -7 + i * 0.3, -3 + i * 0.2]); vt.moveTo(t[0], t[1]); vt.quadraticCurveTo(t[0] - 1.5, (t[1] + t[3]) / 2, t[2], t[3]); }
    k.addStroke({ b: 0.32, r: 0.1 }, vt, 0.35);
    k.addStroke(LINKA, vl, 0.45);
    hotovo(k, tvar, false, 0.5);
    k.addStroke(LINKA, br, 0.4);
  }, 39);
  return D;
}

/* Rekvizity drzane v ruke (pivot = dlan). */
function rekvizity() {
  return {
    'rek:valcek': diel(16, 10, 3, 5, (k, T) => {
      /* papier, ktory sa roky zvijal do valceka a tazko sa drzi otvoreny (r. 8259 az 8261) */
      const p = k.poly(T([0, -3.2, 11, -3.2, 11, 3.2, 0, 3.2]));
      k.fill(C.plat, p);
      k.fill({ y: 0.3, r: 0.12, b: 0.1 }, k.ell(T([11, 0])[0], T([11, 0])[1], 1.6, 3.2));
      k.add({ b: 0.14 }, k.poly(T([0, 1.2, 11, 1.2, 11, 3.2, 0, 3.2])));
      k.addStroke(LINKA, p, 0.4);
    }, 41),
    'rek:list': diel(20, 22, 2, 18, (k, T) => {
      const p = k.poly(T([0, 0, 1, -16, 12, -17, 14, -13, 12, -9, 14, -5, 11, -1]));
      k.fill(C.plat, p);
      const l = k.P();
      for (let i = 0; i < 5; i++) { const t = T([2.4, -13.5 + i * 2.6, 9.6 - (i % 2) * 2, -13.5 + i * 2.6]); l.moveTo(t[0], t[1]); l.lineTo(t[2], t[3]); }
      k.addStroke(C.hrdza, l, 0.6);
      k.fill({ b: 0.7, r: 0.5, y: 0.3 }, k.poly(T([12, -17, 14, -13, 12, -9, 14, -5, 11, -1, 12.6, -1, 15.2, -5, 13.2, -9, 15.2, -13, 13, -17.2])));
      k.addStroke(LINKA, p, 0.4);
    }, 42),
  };
}

export const DIELY = Object.assign({}, edmondDiely(), fariaDiely(), rekvizity());
export const MENA_DIELOV = Object.keys(DIELY);

/* ── Pozy ──────────────────────────────────────────────────────────── */
/* ramZ, ramP = [rameno, predlaktie], nohaZ, nohaP = [stehno, lytko], boky = vyska bokov nad zemou. */
export const POZY = {
  stoj: { trup: 0.02, hlava: 0, ramZ: [0.1, 0.12], ramP: [-0.06, 0.1], nohaZ: [0.05, -0.04], nohaP: [-0.05, -0.02], boky: 48 },
  stojF: { trup: 0.14, hlava: 0.08, ramZ: [0.2, 0.2], ramP: [0.02, 0.06], nohaZ: [0.12, -0.14], nohaP: [-0.04, -0.06], boky: 42 },
  kolena: { trup: 0.12, hlava: 0.1, ramZ: [0.25, 0.5], ramP: [0.3, 0.6], nohaZ: [-0.08, -1.5], nohaP: [1.45, -1.45], boky: 24, spicka: 0 },
  plaz1: { trup: 1.5, hlava: -1.25, ramZ: [2.2, 1.0], ramP: [1.3, 1.6], nohaZ: [-1.2, -0.7], nohaP: [-1.5, -0.1], boky: 10, spicka: 1.2 },
  plaz2: { trup: 1.52, hlava: -1.2, ramZ: [1.3, 1.6], ramP: [2.2, 1.0], nohaZ: [-1.5, -0.1], nohaP: [-1.2, -0.7], boky: 10, spicka: 1.2 },
  sed: { trup: 0.04, hlava: 0.02, ramZ: [0.3, 0.9], ramP: [0.25, 1.0], nohaZ: [1.5, -1.45], nohaP: [1.4, -1.35], boky: 27 },
  sedDlane: { trup: 0.55, hlava: 0.5, ramZ: [0.55, 2.35], ramP: [0.45, 2.5], nohaZ: [1.5, -1.5], nohaP: [1.45, -1.4], boky: 27 },
  sedPapier: { trup: -0.02, hlava: 0.12, ramZ: [0.9, 0.9], ramP: [0.18, 0.2], nohaZ: [1.45, -1.4], nohaP: [1.35, -1.3], boky: 27 },
  sedRuka: { trup: 0.08, hlava: 0.04, ramZ: [1.25, 0.35], ramP: [0.3, 0.25], nohaZ: [1.45, -1.4], nohaP: [1.35, -1.3], boky: 27 },
  sedOkno: { trup: -0.06, hlava: -0.35, ramZ: [0.6, 0.9], ramP: [0.18, 0.2], nohaZ: [1.45, -1.4], nohaP: [1.35, -1.3], boky: 27 },
  sedSeba: { trup: 0.06, hlava: 0.18, ramZ: [0.5, 1.5], ramP: [0.18, 0.2], nohaZ: [1.45, -1.4], nohaP: [1.35, -1.3], boky: 27 },
  sedNatiahnuty: { trup: 0.1, hlava: 0.02, ramZ: [0.2, 0.2], ramP: [1.35, 0.15], nohaZ: [1.45, -1.4], nohaP: [1.35, -1.3], boky: 27 },
  sedStolicka: { trup: 0.1, hlava: 0.05, ramZ: [0.35, 1.1], ramP: [0.3, 1.2], nohaZ: [1.5, -1.5], nohaP: [1.4, -1.4], boky: 24 },
  sedPocuva: { trup: 0.22, hlava: 0.12, ramZ: [0.5, 1.4], ramP: [0.4, 1.5], nohaZ: [1.5, -1.5], nohaP: [1.4, -1.4], boky: 24 },
  objatie: { trup: 0.75, hlava: 0.35, ramZ: [2.1, 0.5], ramP: [1.9, 0.7], nohaZ: [1.3, -1.6], nohaP: [1.1, -1.5], boky: 24 },
  vlecie1: { trup: 1.35, hlava: -1.0, ramZ: [2.3, 0.5], ramP: [0.4, 0.5], nohaZ: [-1.0, -0.8], nohaP: [-1.45, -0.05], boky: 11, spicka: 1.2 },
  vlecie2: { trup: 1.4, hlava: -1.05, ramZ: [1.5, 1.3], ramP: [0.4, 0.5], nohaZ: [-1.45, -0.2], nohaP: [-1.45, -0.05], boky: 11, spicka: 1.2 },
};

export function mix(a, b, t) {
  const o = {};
  for (const key of Object.keys(a)) {
    const x = a[key], y = b[key] == null ? x : b[key];
    o[key] = Array.isArray(x) ? x.map((v, i) => v + (y[i] - v) * t) : x + (y - x) * t;
  }
  return o;
}

/* Chodza: dve krajne pozy a interpolacia kosti, kyv 1 az 2 jednotky. faza v radianoch. */
export function chodza(faza, stara) {
  const s = Math.sin(faza), c = Math.cos(faza);
  const krok = stara ? 0.22 : 0.34;
  return {
    trup: stara ? 0.16 : 0.05, hlava: stara ? 0.08 : 0,
    ramZ: [0.22 * s + 0.05, 0.25 + 0.1 * s], ramP: [-0.22 * s, 0.2 - 0.1 * s],
    nohaZ: [krok * s, -Math.max(0, -c) * 0.55 - 0.05], nohaP: [-krok * s, -Math.max(0, c) * 0.55 - 0.05],
    boky: (stara ? 42 : 47.5) - Math.abs(Math.sin(faza)) * 1.4, spicka: 0,
  };
}
export function plazenie(faza) {
  const t = (Math.sin(faza) + 1) / 2;
  return mix(POZY.plaz1, POZY.plaz2, t);
}
export function vlecenie(faza) {
  const t = (Math.sin(faza) + 1) / 2;
  return mix(POZY.vlecie1, POZY.vlecie2, t);
}

/* Nakresli babku. B = bitmapy dielov podla mena, s = zariadenove px na jednotku.
   x, y = bod na zemi pod postavou vo svetovych jednotkach (kamera je uz v ctx). */
export function kresliBabku(ctx, B, meno, p, x, y, smer, sSveta, rek) {
  const K = KOSTI[meno];
  const s = sSveta * MIERKA;
  const d = (n) => {
    const b = B[meno + ':' + n] || B[n];
    if (!b) return;
    const kr = DIELY[meno + ':' + n] || DIELY[n];
    ctx.drawImage(b, -kr.pivot[0] * s, -kr.pivot[1] * s, kr.w * s, kr.h * s);
  };
  ctx.save();
  ctx.translate(x * sSveta, y * sSveta - p.boky * s);
  if (smer < 0) ctx.scale(-1, 1);
  if (p.otoc) ctx.rotate(p.otoc);
  const noha = (n, st) => {
    ctx.save();
    ctx.rotate(-n[0]); d('steh' + st);
    ctx.translate(0, K.stehno * s); ctx.rotate(-n[1]); d('lyt' + st);
    ctx.translate(0, K.lytko * s); ctx.rotate(n[0] + n[1] + (p.spicka || 0)); d('chod' + st);
    ctx.restore();
  };
  const ruka = (a, st, dx) => {
    ctx.save();
    ctx.rotate(p.trup);
    ctx.translate(dx * s, (-K.trup + 3.5) * s);
    ctx.rotate(-a[0]); d('ram' + st);
    ctx.translate(0, K.rameno * s); ctx.rotate(-a[1]); d('pred' + st);
    ctx.translate(0, K.pred * s); if (a[2]) ctx.rotate(a[2]); d('ruka' + st);
    const r = rek && rek['ruka' + st];
    if (r) { if (r.uhol) ctx.rotate(r.uhol); d(r.meno); }
    ctx.restore();
  };
  ruka(p.ramZ, 'Z', -K.ramX);
  noha(p.nohaZ, 'Z');
  if (meno === 'faria') {
    noha(p.nohaP, 'P');
    ctx.save(); ctx.rotate(-((p.nohaZ[0] + p.nohaP[0]) / 2) * 0.92); d('sukna'); ctx.restore();
  }
  ctx.save();
  ctx.rotate(p.trup);
  d('trup');
  if (meno !== 'faria') { ctx.restore(); noha(p.nohaP, 'P'); ctx.save(); ctx.rotate(p.trup); }
  ctx.translate(0.6 * s, -K.trup * s);
  ctx.rotate(p.hlava);
  d('hlava');
  ctx.restore();
  ruka(p.ramP, 'P', K.ramX);
  ctx.restore();
}
