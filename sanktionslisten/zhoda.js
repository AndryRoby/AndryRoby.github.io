/* GENEROVANÉ z ops/saas/sankcie/zhoda.mjs skriptom ops/saas/sankcie/postav-web.mjs. Neupravovať tu. */
/* Zhoda mena partnera so zoznamom EÚ. Rovnaký kód v Node aj v prehliadači
 * (products/arling-sk/sanktionslisten/zhoda.js je jeho kópia).
 *
 * Skóre 0 až 100 je najvyššie z troch pravidiel (každé vysvetlené v dôvode):
 *  A „celé meno“: Diceho zhoda množín tokenov, 2S / (|partner| + |zoznam|),
 *    kde S je súčet podobností spárovaných tokenov (poradie nehrá rolu);
 *  B „meno zo zoznamu je celé v názve partnera“: všetky tokeny aliasu
 *    (aspoň 2, alebo 1 presný token s aspoň 8 písmenami) sa našli v názve
 *    partnera; skóre 90 × priemerná podobnosť;
 *  C „názov partnera je celý v mene zo zoznamu“: všetky tokeny partnera
 *    (aspoň 2, alebo 1 presný token s aspoň 8 písmenami) sú v aliase;
 *    skóre 90 × priemerná podobnosť.
 * Podobnosť tokenov: rovnaké = 1; inak Levenshtein, len pri tokenoch
 * s aspoň 5 písmenami, najviac 1 zmena (2 pri 9 a viac písmenách),
 * podobnosť 1 - zmeny / dĺžka. Kratšie tokeny musia byť rovnaké. */

import { normalizuj, maNelatinskePismo, VSEOBECNE_SLOVA } from './normalizacia.js';

export const PREDVOLENY_PRAH = 88;
const DF_MAX = 400; // token vo viac ako 400 aliasoch sa nepoužije na vyhľadanie kandidátov (len na skóre)

export function levenshtein(a, b, max = Infinity) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let pred = new Array(b.length + 1);
  let akt = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) pred[j] = j;
  for (let i = 1; i <= a.length; i++) {
    akt[0] = i;
    let minRiadok = akt[0];
    for (let j = 1; j <= b.length; j++) {
      const c = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      akt[j] = Math.min(pred[j] + 1, akt[j - 1] + 1, pred[j - 1] + c);
      if (akt[j] < minRiadok) minRiadok = akt[j];
    }
    if (minRiadok > max) return max + 1;
    [pred, akt] = [akt, pred];
  }
  return pred[b.length];
}

export function maxZmien(dlzka) { return dlzka >= 9 ? 2 : 1; }

export function podobnostTokenov(a, b) {
  if (a === b) return 1;
  const L = Math.max(a.length, b.length);
  const m = Math.min(a.length, b.length);
  if (m < 5) return 0;
  const maxd = maxZmien(L);
  if (L - m > maxd) return 0;
  const d = levenshtein(a, b, maxd);
  if (d > maxd) return 0;
  return 1 - d / L;
}

/* Skóre dvoch množín tokenov s dôvodom. */
/* firma: subjekt zo zoznamu je organizácia (pri osobe sa jednoslovné
 * pravidlá B a C nepoužijú: priezvisko samo nie je zhoda s osobou). */
export function skore(q, c, firma = true) {
  const pary = [];
  for (let i = 0; i < q.length; i++) {
    for (let j = 0; j < c.length; j++) {
      const s = podobnostTokenov(q[i], c[j]);
      if (s > 0) pary.push([s, i, j]);
    }
  }
  pary.sort((x, y) => y[0] - x[0] || x[1] - y[1] || x[2] - y[2]);
  const pouziteQ = new Set();
  const pouziteC = new Set();
  const vybrane = [];
  let S = 0;
  for (const [s, i, j] of pary) {
    if (pouziteQ.has(i) || pouziteC.has(j)) continue;
    pouziteQ.add(i); pouziteC.add(j);
    vybrane.push({ i, j, s });
    S += s;
  }
  if (!vybrane.length) return { hodnota: 0, pravidlo: null, pary: [] };
  let hodnota = (2 * S) / (q.length + c.length);
  let pravidlo = 'A';
  const jednoslovne = (t) => firma && vybrane[0].s === 1 && t.length >= 8 && !VSEOBECNE_SLOVA.has(t);
  // Obsiahnuté meno musí niesť aspoň 7 písmen, inak je dôkaz slabý (ti&m, AS).
  const znaky = (ts) => ts.reduce((a, t) => a + t.length, 0);
  if (pouziteC.size === c.length && znaky(c) >= 7 && (c.length >= 2 || jednoslovne(c[0]))) {
    const b = 0.9 * (S / c.length);
    if (b > hodnota) { hodnota = b; pravidlo = 'B'; }
  }
  if (pouziteQ.size === q.length && znaky(q) >= 7 && (q.length >= 2 || jednoslovne(q[0]))) {
    const cc = 0.9 * (S / q.length);
    if (cc > hodnota) { hodnota = cc; pravidlo = 'C'; }
  }
  vybrane.sort((x, y) => x.i - y.i);
  let prehodene = false;
  for (let k = 1; k < vybrane.length; k++) if (vybrane[k].j < vybrane[k - 1].j) prehodene = true;
  return { hodnota, pravidlo, pary: vybrane, prehodene };
}

/* subjekty: [{ eu, typ, program, akt, url, oznacene, mena: [string] }] */
export function postavIndex(subjekty) {
  const aliasy = [];
  const slovnik = new Map();
  let preskoceneNelatinske = 0;
  subjekty.forEach((sub, si) => {
    const videne = new Set();
    for (const meno of sub.mena) {
      if (maNelatinskePismo(meno)) { preskoceneNelatinske++; continue; }
      const n = normalizuj(meno);
      if (!n.tokeny.length) continue;
      const kluc = n.tokeny.slice().sort().join(' ');
      if (videne.has(kluc)) continue;
      videne.add(kluc);
      const ai = aliasy.length;
      aliasy.push({ s: si, t: n.tokeny, w: n.slova, o: meno });
      for (const t of n.tokeny) {
        let p = slovnik.get(t);
        if (!p) { p = []; slovnik.set(t, p); }
        p.push(ai);
      }
    }
  });
  const tokeny = [...slovnik.keys()];
  const bigramy = new Map();
  tokeny.forEach((t, ti) => {
    if (t.length < 5) return;
    for (const b of bigramyTokenu(t)) {
      let p = bigramy.get(b);
      if (!p) { p = []; bigramy.set(b, p); }
      p.push(ti);
    }
  });
  return { subjekty, aliasy, slovnik, tokeny, bigramy, preskoceneNelatinske, cache: new Map() };
}

/* Kompaktný JSON (postav-index.mjs) -> subjekty pre postavIndex. */
export function subjektyZJson(j) {
  const subjekty = j.s.map(([eu, typ, program, akt, url, oznacene]) => ({ eu, typ, program, akt, url, oznacene, mena: [] }));
  for (const [si, meno] of j.a) subjekty[si].mena.push(meno);
  return subjekty;
}

function bigramyTokenu(t) {
  const s = new Set();
  for (let i = 0; i < t.length - 1; i++) s.add(t.slice(i, i + 2));
  return s;
}

/* Tokeny zo slovníka podobné tokenu q (vrátane q samého). */
function podobne(index, q) {
  const hit = index.cache.get(q);
  if (hit) return hit;
  const out = [];
  if (index.slovnik.has(q)) out.push(q);
  if (q.length >= 5) {
    const bg = bigramyTokenu(q);
    const pocet = new Map();
    for (const b of bg) {
      const p = index.bigramy.get(b);
      if (!p) continue;
      for (const ti of p) pocet.set(ti, (pocet.get(ti) || 0) + 1);
    }
    const potreba = Math.max(1, bg.size - 2 * 2);
    for (const [ti, n] of pocet) {
      if (n < potreba) continue;
      const t = index.tokeny[ti];
      if (t !== q && podobnostTokenov(q, t) > 0) out.push(t);
    }
  }
  index.cache.set(q, out);
  return out;
}

/* Vyhľadanie jedného mena. Vráti zhody nad prahom, najlepšiu na subjekt. */
export function hladaj(index, meno, { prah = PREDVOLENY_PRAH, max = 5 } = {}) {
  const n = normalizuj(meno);
  if (!n.tokeny.length) return [];
  const naToken = n.tokeny.map((q) => podobne(index, q));
  // Kandidáti: aliasy, ktoré zdieľajú aspoň jeden (podobný) token. Časté
  // tokeny (df > DF_MAX) sa na hľadanie nepoužijú, ak je k dispozícii iný.
  const df = (ts) => ts.reduce((a, t) => a + index.slovnik.get(t).length, 0);
  let pouzite = naToken.filter((ts) => ts.length && df(ts) <= DF_MAX);
  if (!pouzite.length) {
    const neprazdne = naToken.filter((ts) => ts.length).sort((a, b) => df(a) - df(b));
    pouzite = neprazdne.slice(0, 1);
  }
  const kandidati = new Set();
  for (const ts of pouzite) for (const t of ts) for (const ai of index.slovnik.get(t)) kandidati.add(ai);
  const najlepsie = new Map();
  for (const ai of kandidati) {
    const a = index.aliasy[ai];
    const sk = skore(n.tokeny, a.t, index.subjekty[a.s].typ !== 'P');
    const h = Math.round(sk.hodnota * 100);
    if (h < prah) continue;
    const pred = najlepsie.get(a.s);
    if (!pred || h > pred.skore) {
      najlepsie.set(a.s, {
        subjekt: a.s, skore: h, alias: a.o, pravidlo: sk.pravidlo, prehodene: sk.prehodene,
        pary: sk.pary.map((p) => ({ partner: n.slova[p.i], zoznam: a.w[p.j], podobnost: Math.round(p.s * 100) })),
      });
    }
  }
  return [...najlepsie.values()].sort((x, y) => y.skore - x.skore).slice(0, max);
}

/* Krátky dôvod zhody po nemecky pre výsledok a protokol. */
export function dovodDe(z) {
  const pravidlo = {
    A: 'Name stimmt insgesamt überein',
    B: 'Name aus der EU-Liste ist vollständig im Partnernamen enthalten',
    C: 'Partnername ist vollständig im Namen aus der EU-Liste enthalten',
  }[z.pravidlo] || '';
  const casti = z.pary.map((p) => p.podobnost === 100
    ? '„' + p.partner + '“ = „' + p.zoznam + '“'
    : '„' + p.partner + '“ ≈ „' + p.zoznam + '“ (' + p.podobnost + ' %)');
  return pravidlo + (z.prehodene ? ', andere Reihenfolge' : '') + ': ' + casti.join(', ');
}
