/* Whistle Stop M0: ekonomika jednej budovy (General Store), čisté funkcie bez plátna.
   Čísla sú skopírované z ops/hry/western/sim.mjs (BUDOVY[1] a objekt E) a GDD 2.6, 2.7, 3.1, 3.2.
   Keď príde M1, sim.mjs importuje tento súbor, aby sa hra a simulácia nerozišli (GDD 5.1). */

export const OBCHOD = { id: 'obchod', meno: 'General Store', c: 60, r: 1.15, prijem: 12, t: 2 };

export const E = {
  milniky: [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
  manazerCena: 25,                 // x základná cena budovy
  nabytok: { miest: 6, stupnov: 3, nasobok: 1.25, odUrovne: 25, cenaZaklad: 50, rastVUrovniach: 24 },
  tukPodiel: 0.1,                  // ťuk na riadenú budovu = okamžitá minca 10 % cyklu
  tukovZaS: 8,                     // viac ťukov za sekundu sa nepočíta (autoclicker sa neoplatí)
  offlineCapS: 3 * 3600            // pošta v M0 nie je, strop 3 h
};

// Stupne fasády podľa úrovne (GDD 2.6). Stupeň 10 je len vzhľad (štít), peniaze nedáva.
export const FASADA = [
  { od: 0, meno: 'stakes' }, { od: 1, meno: 'booth' }, { od: 10, meno: 'false front' },
  { od: 25, meno: 'porch' }, { od: 50, meno: 'second floor' }, { od: 100, meno: 'balcony' },
  { od: 200, meno: 'brick' }, { od: 300, meno: 'third floor' }
];

// Nábytok obchodu zhora: 6 miest x 3 stupne (GDD 2.2). Mená sú anglicky, sú to texty hry.
export const MIESTA = [
  { id: 'pult', meno: 'Counter' }, { id: 'police', meno: 'Shelves' }, { id: 'sudy', meno: 'Barrels' },
  { id: 'vaha', meno: 'Scale' }, { id: 'pec', meno: 'Stove' }, { id: 'sklad', meno: 'Storeroom' }
];

export function milnikov(n) {
  let k = 0;
  for (const m of E.milniky) { if (n >= m) k++; else break; }
  if (n > 1000) k += Math.floor((n - 1000) / 250);
  return k;
}
export function dalsiMilnik(n) {
  for (const m of E.milniky) if (n < m) return m;
  return 1000 + (Math.floor((n - 1000) / 250) + 1) * 250;
}
export function stupenFasady(n) {
  let k = 0;
  for (let i = 0; i < FASADA.length; i++) if (n >= FASADA[i].od) k = i;
  return k;
}
// Postavy za pultom: 1 od úrovne 1, 2 od 25, 3 od 100, 4 od 300 (GDD 2.3).
export function pracovnikov(n) { return n >= 300 ? 4 : n >= 100 ? 3 : n >= 25 ? 2 : n >= 1 ? 1 : 0; }

// Najbližšie ciele pre kartu (nález 4 brány M0): najbližšia vizuálna zmena (fasáda, ďalší pracovník, interiér)
// a najbližší ekonomický míľnik zvlášť. Keď padnú na tú istú úroveň, karta ich ukáže v jednom riadku.
const MENO_PRACOVNIKA = { 25: 'second clerk', 100: 'third clerk', 300: 'fourth clerk' };
export function dalsieCiele(n) {
  const zmeny = new Map();
  const pridaj = (u, text) => { if (u > n) { if (!zmeny.has(u)) zmeny.set(u, []); zmeny.get(u).push(text); } };
  for (const f of FASADA) pridaj(f.od, f.meno);
  for (const u in MENO_PRACOVNIKA) pridaj(+u, MENO_PRACOVNIKA[u]);
  pridaj(E.nabytok.odUrovne, 'interior');
  const vzhladU = zmeny.size ? Math.min(...zmeny.keys()) : 0;
  const prijemU = dalsiMilnik(n);
  const riadky = [];
  if (vzhladU && vzhladU === prijemU) riadky.push(`Level ${prijemU}: income x2, ${zmeny.get(vzhladU).join(', ')}`);
  else {
    if (vzhladU) riadky.push(`Level ${vzhladU}: ${zmeny.get(vzhladU).join(', ')}`);
    if (prijemU <= 1000) riadky.push(`Level ${prijemU}: income x2`);
  }
  return { vzhlad: vzhladU ? { uroven: vzhladU, co: zmeny.get(vzhladU) } : null, prijem: prijemU, riadky };
}

// cena k úrovní naraz pri n úrovniach: súčet geometrického radu c r^n (r^k − 1) / (r − 1)
export function cenaUrovni(n, k = 1) {
  const { c, r } = OBCHOD;
  return c * Math.pow(r, n) * (Math.pow(r, k) - 1) / (r - 1);
}
export function cenaManazera() { return OBCHOD.c * E.manazerCena; }
// kus nábytku poradia k (0 až 17): c x 50 x (r^24)^k
export function cenaNabytku(k) {
  const N = E.nabytok;
  return OBCHOD.c * N.cenaZaklad * Math.pow(Math.pow(OBCHOD.r, N.rastVUrovniach), k);
}
export function kusovNabytku(nab) { let f = 0; for (const x of nab) f += x; return f; }

// peniaze za sekundu pri plnom behu: p n 2^m 1,25^f
export function prijemZaS(n, nab) {
  if (n <= 0) return 0;
  return OBCHOD.prijem * n * Math.pow(2, milnikov(n)) * Math.pow(E.nabytok.nasobok, kusovNabytku(nab));
}
export function zaCyklus(n, nab) { return prijemZaS(n, nab) * OBCHOD.t; }

// Koľko úrovní sa dá kúpiť za peniaze (tlačidlo Max; v M0 je len x1 a x10, Max slúži testom).
export function kolkoZaPeniaze(n, peniaze) {
  const { c, r } = OBCHOD;
  const k = Math.floor(Math.log(peniaze * (r - 1) / (c * Math.pow(r, n)) + 1) / Math.log(r));
  return Math.max(0, k);
}

const SUF = ['', 'K', 'M', 'B', 'T', 'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag', 'ah', 'ai', 'aj', 'ak', 'al', 'am', 'an', 'ao', 'ap'];
export function fmt(x) {
  if (!isFinite(x)) return String(x);
  if (Math.abs(x) < 1000) return x < 10 && x % 1 !== 0 ? x.toFixed(1) : Math.floor(x).toString();
  const e = Math.min(Math.floor(Math.log10(Math.abs(x)) / 3), SUF.length - 1);
  return (x / Math.pow(1000, e)).toFixed(2) + ' ' + SUF[e];
}
