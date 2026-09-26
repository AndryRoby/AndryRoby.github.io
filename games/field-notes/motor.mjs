/* Field Notes: motor strán (M0, 26. 9. 2026).
 *
 * Čistý modul bez DOM: beží v prehliadači aj v Node (testy). Všetko je
 * deterministické zo semienka: rovnaký deň alebo rovnaké číslo strany dá
 * každému rovnakú mriežku, rovnaké slová a rovnaké poradie.
 *
 * Záruky (drží ich ops/hry/field-notes/tests.mjs):
 *   1. každé slovo strany je v mriežke práve raz (v ôsmich smeroch),
 *   2. slová témy, ktoré na strane nie sú, sa v mriežke neobjavia,
 *   3. slovo zo zoznamu ZAKAZANE sa neobjaví nikde, okrem prípadu, keď leží
 *      celé vnútri hľadaného slova (URANUS obsahuje ANUS; to je meno planéty),
 *   4. výplň nikdy neprepíše písmeno slova.
 * Keď generátor pre semienko nenájde mriežku, ktorá to všetko spĺňa, skúsi
 * ďalšie odvodené semienko; test prechádza tisíce strán a počíta, či sa to deje.
 */
import { TEMY } from './temy.mjs';

export const VERZIA = 1;
export const VELKOST = 10;
export const NA_STRANU = 8;
export const ZACIATOK = '2026-09-26';

const VSETKY = [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 0], [0, -1], [-1, -1], [-1, 1]];
export const OBTIAZNOST = {
  lahka: { meno: 'Gentle', popis: 'Words run across, down and diagonally down.', smery: [[1, 0], [0, 1], [1, 1]] },
  stredna: { meno: 'Steady', popis: 'Words run forwards: across, down and both diagonals.', smery: [[1, 0], [0, 1], [1, 1], [1, -1]] },
  plna: { meno: 'Every way', popis: 'Words run in all eight directions, backwards too.', smery: VSETKY },
};

/* Slová, ktoré sa nesmú objaviť v náhodnej výplni (anglické aj slovenské
   a české vulgarizmy a nadávky). Kontroluje sa všetkými ôsmimi smermi. */
export const ZAKAZANE = [
  'ANAL', 'ANUS', 'ARSE', 'ASS', 'BITCH', 'BOOB', 'BUTT', 'CLIT', 'COCK', 'COON', 'CRAP', 'CUM', 'CUNT', 'DAMN', 'DICK', 'DIKE', 'DILDO', 'DYKE',
  'FAG', 'FUCK', 'FUK', 'GOOK', 'HOMO', 'JIZZ', 'KIKE', 'KKK', 'NAZI', 'NIGGA', 'NIGGER', 'NUDE', 'PENIS', 'PISS', 'POO', 'POOP', 'PORN', 'PRICK',
  'PUBE', 'PUSSY', 'RAPE', 'SEX', 'SEXY', 'SHAG', 'SHIT', 'SLUT', 'SPIC', 'TIT', 'TITS', 'TWAT', 'VAGINA', 'WANK', 'WHORE', 'XXX',
  'KURVA', 'KOKOT', 'PICA', 'HOVNO', 'PRDEL', 'CHUJ', 'JEBAT', 'SRAT', 'SRACKA',
];

/* Častosť písmen v angličtine (percentá), aby výplň vyzerala ako text a slová sa v nej schovali. */
const ANGLICTINA = { A: 8.2, B: 1.5, C: 2.8, D: 4.3, E: 12.7, F: 2.2, G: 2, H: 6.1, I: 7, J: 0.15, K: 0.8, L: 4, M: 2.4, N: 6.7, O: 7.5, P: 1.9, Q: 0.1, R: 6, S: 6.3, T: 9.1, U: 2.8, V: 1, W: 2.4, X: 0.15, Y: 2, Z: 0.07 };

/* ── Náhoda zo semienka ────────────────────────────────────────────────── */
export function hash(text) {
  let h = 2166136261 >>> 0;
  for (let k = 0; k < text.length; k++) {
    h ^= text.charCodeAt(k);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // Záverečné premiešanie (murmur fmix), aby sa podobné reťazce rozišli.
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function zamiesaj(pole, R) {
  const a = pole.slice();
  for (let k = a.length - 1; k > 0; k--) {
    const j = Math.floor(R() * (k + 1));
    [a[k], a[j]] = [a[j], a[k]];
  }
  return a;
}

/* ── Mriežka ───────────────────────────────────────────────────────────── */

/* Všetky výskyty slova v mriežke všetkými ôsmimi smermi (cesta buniek). */
export function vyskyty(pismena, n, slovo) {
  const out = [];
  const L = slovo.length;
  for (let start = 0; start < n * n; start++) {
    if (pismena[start] !== slovo[0]) continue;
    const x = start % n, y = (start / n) | 0;
    for (const [dx, dy] of VSETKY) {
      const kx = x + dx * (L - 1), ky = y + dy * (L - 1);
      if (kx < 0 || ky < 0 || kx >= n || ky >= n) continue;
      let ok = true;
      const cesta = [start];
      for (let k = 1; k < L && ok; k++) {
        const c = (y + dy * k) * n + x + dx * k;
        if (pismena[c] !== slovo[k]) ok = false; else cesta.push(c);
      }
      if (ok) out.push(cesta);
    }
  }
  // Jednopísmenkové a palindrómy by sa počítali dvakrát; naše slová také nie sú (test).
  return out;
}

function vahyVyplne(slova) {
  const vahy = { ...ANGLICTINA };
  const pocty = {};
  let spolu = 0;
  for (const s of slova) for (const ch of s) { pocty[ch] = (pocty[ch] || 0) + 1; spolu++; }
  for (const ch of Object.keys(pocty)) vahy[ch] += (pocty[ch] / spolu) * 100;
  const kluce = Object.keys(vahy);
  const sucet = kluce.reduce((a, k) => a + vahy[k], 0);
  let acc = 0;
  return kluce.map((k) => { acc += vahy[k] / sucet; return [k, acc]; });
}
function pismenoVyplne(tabulka, R) {
  const r = R();
  for (const [ch, hranica] of tabulka) if (r <= hranica) return ch;
  return 'E';
}

/* Postaví mriežku n x n so slovami (reťazce A až Z). Vráti { pismena, cesty }
   alebo null, ak sa v danom počte pokusov nepodarí. */
export function postavMriezku(slova, { velkost = VELKOST, smery = VSETKY, seed = 1, nesmu = [], pokusov = 400 } = {}) {
  const n = velkost;
  const R = rng(seed);
  const poradie = slova.map((s, k) => [s, k]).sort((a, b) => b[0].length - a[0].length || a[1] - b[1]);
  const tabulka = vahyVyplne(slova);
  for (let pokus = 0; pokus < pokusov; pokus++) {
    const m = new Array(n * n).fill('');
    const cesty = new Array(slova.length);
    let ok = true;
    for (const [slovo, idx] of poradie) {
      const moznosti = [];
      const L = slovo.length;
      for (let start = 0; start < n * n; start++) {
        const x = start % n, y = (start / n) | 0;
        for (const [dx, dy] of smery) {
          const kx = x + dx * (L - 1), ky = y + dy * (L - 1);
          if (kx < 0 || ky < 0 || kx >= n || ky >= n) continue;
          let prekryv = 0, pasuje = true;
          const cesta = [];
          for (let k = 0; k < L; k++) {
            const c = (y + dy * k) * n + x + dx * k;
            if (m[c] === '') { cesta.push(c); continue; }
            if (m[c] !== slovo[k]) { pasuje = false; break; }
            prekryv++; cesta.push(c);
          }
          // Slovo nesmie ležať celé na inom slove.
          if (pasuje && prekryv < L) moznosti.push([cesta, prekryv]);
        }
      }
      if (!moznosti.length) { ok = false; break; }
      // Mierne uprednostní kríženie, ale nechá veľa náhody, aby slová neboli nahustené v jednom rohu.
      let sucet = 0;
      const vahy = moznosti.map(([, p]) => { const w = 1 + p * 2.5; sucet += w; return w; });
      let r = R() * sucet, vyber = moznosti[moznosti.length - 1][0];
      for (let k = 0; k < moznosti.length; k++) { r -= vahy[k]; if (r <= 0) { vyber = moznosti[k][0]; break; } }
      vyber.forEach((c, k) => { m[c] = slovo[k]; });
      cesty[idx] = vyber;
    }
    if (!ok) continue;
    const pevne = new Set(cesty.flat());
    const volne = [];
    for (let c = 0; c < n * n; c++) if (!pevne.has(c)) { volne.push(c); m[c] = pismenoVyplne(tabulka, R); }
    // Oprava výplne: čo vadí, prehodí sa, kým nie je čisto (alebo sa to nedá).
    let cisto = false;
    for (let oprava = 0; oprava < 80; oprava++) {
      const vadne = problemy(m.join(''), n, slova, cesty, nesmu);
      if (vadne === null) break;
      if (vadne.size === 0) { cisto = true; break; }
      for (const c of vadne) m[c] = pismenoVyplne(tabulka, R);
    }
    if (cisto) return { pismena: m.join(''), cesty };
  }
  return null;
}

/* Vráti množinu buniek výplne, ktoré treba prehodiť; prázdnu, keď je mriežka
   v poriadku; null, keď sa problém výplňou opraviť nedá. */
export function problemy(pismena, n, slova, cesty, nesmu = []) {
  const pevne = new Set(cesty.flat());
  const vadne = new Set();
  const pridaj = (cesta) => {
    const volne = cesta.filter((c) => !pevne.has(c));
    if (!volne.length) return false;
    volne.forEach((c) => vadne.add(c));
    return true;
  };
  const rovnaka = (a, b) => a.length === b.length && (a.every((c, k) => c === b[k]) || a.every((c, k) => c === b[b.length - 1 - k]));
  for (let k = 0; k < slova.length; k++) {
    for (const v of vyskyty(pismena, n, slova[k])) {
      if (rovnaka(v, cesty[k])) continue;
      if (!pridaj(v)) return null;
    }
  }
  // Slovo, ktoré leží celé vnútri hľadaného slova, je jeho súčasť, nie náhoda výplne
  // (SUN je v URANUS čítanom odzadu, ANUS v URANUS). Také sa neopravuje.
  const vnutriSlova = (v) => cesty.some((cesta) => v.every((c) => cesta.includes(c)));
  for (const s of nesmu) {
    for (const v of vyskyty(pismena, n, s)) {
      if (vnutriSlova(v)) continue;
      if (!pridaj(v)) return null;
    }
  }
  for (const zle of ZAKAZANE) {
    for (const v of vyskyty(pismena, n, zle)) {
      if (vnutriSlova(v)) continue;
      if (!pridaj(v)) return null;
    }
  }
  return vadne;
}

/* ── Strany ────────────────────────────────────────────────────────────── */

/* Z témy vyberie NA_STRANU slov; poradie na strane ostáva poradím témy. */
export function vyberSlova(tema, R, pocet = NA_STRANU) {
  const kandidati = zamiesaj(tema.slova.map((_, k) => k), R);
  const vybrane = [];
  for (const k of kandidati) {
    const s = tema.slova[k].slovo;
    const rev = [...s].reverse().join('');
    if (vybrane.some((j) => { const t = tema.slova[j].slovo; return t.includes(s) || s.includes(t) || t.includes(rev) || rev.includes(t); })) continue;
    vybrane.push(k);
    if (vybrane.length === pocet) break;
  }
  return vybrane.sort((a, b) => a - b);
}

export function postavStranu({ tema, seed, obtiaznost, druh, kluc }) {
  for (let pokus = 0; pokus < 20; pokus++) {
    const s = pokus ? hash(seed + ':' + pokus) : seed;
    const R = rng(s);
    const indexy = vyberSlova(tema, R);
    const slova = indexy.map((k) => tema.slova[k]);
    const nesmu = tema.slova.filter((_, k) => !indexy.includes(k)).map((x) => x.slovo);
    const m = postavMriezku(slova.map((x) => x.slovo), { velkost: VELKOST, smery: OBTIAZNOST[obtiaznost].smery, seed: hash(s + ':mriezka'), nesmu });
    if (!m) continue;
    return {
      druh, kluc, tema: tema.id, nazov: tema.nazov, podtitul: tema.podtitul, obtiaznost, velkost: VELKOST, pismena: m.pismena,
      slova: slova.map((x, k) => ({ ...x, cesta: m.cesty[k] })),
    };
  }
  throw new Error('Field Notes: strana sa nedala postaviť ' + druh + ' ' + kluc);
}

/* Deň ako celé číslo od ZACIATOK (dátum YYYY-MM-DD, bez časovej zóny). */
export function poradieDna(datum) {
  const [a, b] = [datum, ZACIATOK].map((d) => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd); });
  return Math.round((a - b) / 86400000);
}
export function denVTyzdni(datum) {
  const [y, m, d] = datum.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 nedeľa
}
export function obtiaznostDna(datum) {
  const d = denVTyzdni(datum);
  if (d === 1 || d === 2) return 'lahka';
  if (d === 3 || d === 4) return 'stredna';
  return 'plna';
}
const mod = (a, b) => ((a % b) + b) % b;

/* Denná strana: rovnaká pre všetkých v daný kalendárny deň. Témy sa striedajú po rade. */
export function stranaDna(datum) {
  const tema = TEMY[mod(poradieDna(datum), TEMY.length)];
  return postavStranu({ tema, seed: hash(`fieldnotes:day:${datum}:v${VERZIA}`), obtiaznost: obtiaznostDna(datum), druh: 'den', kluc: datum });
}

/* Nekonečné strany: číslo 1, 2, 3 … bez konca. Prvé dve jemné, potom postupne všetky smery. */
export function obtiaznostStrany(cislo) {
  if (cislo <= 2) return 'lahka';
  if (cislo <= 5) return 'stredna';
  return (cislo - 6) % 3 === 2 ? 'stredna' : 'plna';
}
export function temaStrany(cislo) {
  // Pevné poradie dokola, takže téma sa nikdy nezopakuje dvakrát za sebou.
  // Strana 1 je iná téma než dnešná denná strana prvého dňa (tá je prvá v zozname).
  return TEMY[mod(cislo, TEMY.length)];
}
export function stranaNekonecna(cislo) {
  return postavStranu({ tema: temaStrany(cislo), seed: hash(`fieldnotes:endless:${cislo}:v${VERZIA}`), obtiaznost: obtiaznostStrany(cislo), druh: 'strana', kluc: String(cislo) });
}

/* ── Ťah hráča ─────────────────────────────────────────────────────────── */

/* Priamka buniek od start po koniec, ak ležia na jednej z ôsmich priamok. */
export function cestaMedzi(n, start, koniec) {
  const dx = (koniec % n) - (start % n), dy = ((koniec / n) | 0) - ((start / n) | 0);
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return null;
  const kroky = Math.max(Math.abs(dx), Math.abs(dy));
  const sx = Math.sign(dx), sy = Math.sign(dy);
  const out = [];
  for (let k = 0; k <= kroky; k++) out.push(start + k * (sx + sy * n));
  return out;
}
/* Ťah prstom: z bodu (v bunkách, stred bunky je +0,5) pritiahne na najbližší z ôsmich smerov. */
export function pritiahni(n, start, x, y) {
  const sx = (start % n) + 0.5, sy = ((start / n) | 0) + 0.5;
  const dx = x - sx, dy = y - sy;
  if (Math.hypot(dx, dy) < 0.45) return [start];
  let naj = VSETKY[0], najSk = -Infinity;
  for (const [ux, uy] of VSETKY) {
    const sk = (ux * dx + uy * dy) / Math.hypot(ux, uy);
    if (sk > najSk) { najSk = sk; naj = [ux, uy]; }
  }
  const [ux, uy] = naj;
  let kroky = Math.max(0, Math.round((dx * ux + dy * uy) / (ux * ux + uy * uy)));
  let bx = start % n, by = (start / n) | 0;
  let koniec = start;
  for (let k = 0; k < kroky; k++) {
    const nx = bx + ux, ny = by + uy;
    if (nx < 0 || ny < 0 || nx >= n || ny >= n) break;
    bx = nx; by = ny; koniec = by * n + bx;
  }
  return cestaMedzi(n, start, koniec);
}
/* Index slova, ktorého cesta je presne táto (aj odzadu), alebo -1. */
export function najdiSlovo(strana, cesta) {
  if (!cesta || cesta.length < 2) return -1;
  return strana.slova.findIndex((s) => s.cesta.length === cesta.length && (s.cesta.every((c, k) => c === cesta[k]) || s.cesta.every((c, k) => c === cesta[cesta.length - 1 - k])));
}

/* Rímske číslo strany (ako na starých tabuliach), nad 3999 arabské. */
export function rimske(n) {
  if (n < 1 || n > 3999) return String(n);
  const t = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of t) while (n >= v) { out += s; n -= v; }
  return out;
}
