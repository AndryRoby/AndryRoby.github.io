/* Hares: generator and solver for the daily number meadow puzzle.
 *
 * One file, no dependencies, runs the same in Node and in the browser
 * (game.js imports it as a module, tests.mjs too). Everything is
 * deterministic: a date turns into a number, the number into a sequence of
 * random values, the sequence into a puzzle. The same date gives the same
 * puzzle on every machine, so the server never has to compute or store
 * anything.
 *
 * Rules of the game (our own wording): a grid of n x n burrows. Every row,
 * every column and every block holds each number from 1 to n exactly once.
 * On top of that, hares leap like a chess knight: two burrows a knight leap
 * apart (two burrows one way, one burrow across) never hold the same number.
 * On the harder days hares also refuse to sit next to the same number in any
 * direction, corners included (the king rule).
 *
 * Representation:
 *   n         6 (blocks 2 rows by 3 columns) or 9 (blocks 3 by 3)
 *   rules     { knight: true, king: false|true }
 *   givens    flat n*n array of numbers, 0 for an empty burrow
 *   solution  flat n*n array of numbers, never 0
 *
 * Generation (generateSeeded):
 *   1. fill the whole meadow at random with every rule of the day switched
 *      on: depth first search over the burrow with the fewest candidates,
 *      numbers tried in a random order, with propagation after every
 *      number, so a full grid comes out in a few milliseconds even when the
 *      knight and the king rule are both on and legal grids are rare,
 *   2. take the finished grid as the givens and empty burrows one by one in
 *      a random order, keeping a burrow empty only while the puzzle still
 *      has exactly one solution (solve with limit 2) and a person can still
 *      reach it without guessing (solveHuman), down to the number of givens
 *      the level asks for,
 *   3. measure the finished puzzle by running the human solver over it once
 *      more and counting the steps of each layer.
 *
 * Difficulty, returned as `difficulty`:
 *   layers   how many steps of layer 1, 2 and 3 the human solver needed
 *            (see solveHuman), dane how many numbers are given away and
 *            odobrate how many burrows the minimising pass emptied.
 * plan.mjs turns those into one number and ranks candidates by it.
 */

/* Mulberry32: a small, fast pseudo-random generator with 32 bits of state.
   Returns numbers in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* FNV-1a, 32 bits: turns a string into a number for mulberry32. */
export function seedFromString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/* Checks the YYYY-MM-DD shape and that the date actually exists (2026-02-30 fails). */
export function isValidDate(s) {
  const m = DATE_RE.exec(String(s));
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dni = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= dni[mo - 1];
}

/* Today's date in Bratislava as YYYY-MM-DD. The Swedish locale gives the ISO
   shape directly; if Intl is missing or does not know the time zone, falls
   back to local time. */
export function todayBratislava(now = new Date()) {
  try {
    const s = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
    if (isValidDate(s)) return s;
  } catch (e) { /* fall back to local time */ }
  const p = (x) => String(x).padStart(2, '0');
  return now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate());
}

function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

/* ── Čísla ako bitové masky ──────────────────────────────────────────── *
 * Bit d znamená „číslo d sa sem ešte zmestí". Bit 0 sa nepoužíva. */
function vsetkyMasky(n) { return ((1 << (n + 1)) - 2) >>> 0; }
function cislaZMasky(m) {
  const out = [];
  for (let d = 1; d <= 9; d++) if (m & (1 << d)) out.push(d);
  return out;
}
function pocetBitov(m) { let c = 0; while (m) { m &= m - 1; c++; } return c; }
function jednaCislica(m) { return 31 - Math.clz32(m); }

function zamiesajPole(rng, a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function zamiesaj(rng, m) {
  return zamiesajPole(rng, Array.from({ length: m }, (_, i) => i));
}
function rovnake(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/* ── Tvar mriežky a susedstvá ────────────────────────────────────────── */

/* Rozmer bloku: 6 x 6 má bloky 2 riadky x 3 stĺpce, 9 x 9 bloky 3 x 3,
   4 x 4 (len testovacia veľkosť) bloky 2 x 2. */
export function blokRozmer(n) {
  if (n === 6) return { bh: 2, bw: 3 };
  if (n === 9) return { bh: 3, bw: 3 };
  if (n === 4) return { bh: 2, bw: 2 };
  const bh = Math.floor(Math.sqrt(n));
  if (bh * bh !== n) throw new Error('Unsupported size: ' + n);
  return { bh, bw: bh };
}

const SKOKY = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const KROKY = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];

const JADRA = new Map();

/* jadro(n, rules): všetko, čo o mriežke platí bez ohľadu na čísla v nej.
 *   units      3n jednotiek { kind:'row'|'col'|'block', idx, cells }
 *   unitOf[i]  indexy troch jednotiek políčka i (riadok, stĺpec, blok)
 *   klasicke[i] políčka, ktoré s i zdieľajú riadok, stĺpec alebo blok
 *   skok[i]    políčka na skok jazdca od i (aj tie, čo sú zároveň klasické)
 *   kral[i]    dotýkajúce sa políčka vrátane rohov (prázdne, keď king je off)
 *   peers[i]   zjednotenie všetkého, čo sa od i musí líšiť
 * Výsledok sa uchová, lebo je pre danú veľkosť a pravidlá vždy rovnaký. */
export function jadro(n, rules = {}) {
  const knight = rules.knight !== false;
  const king = !!rules.king;
  const kluc = n + ':' + (knight ? 1 : 0) + ':' + (king ? 1 : 0);
  const ulozene = JADRA.get(kluc);
  if (ulozene) return ulozene;

  const { bh, bw } = blokRozmer(n);
  const C = n * n;
  const units = [];
  const unitOf = [];
  for (let r = 0; r < n; r++) {
    const cells = [];
    for (let c = 0; c < n; c++) cells.push(r * n + c);
    units.push({ kind: 'row', idx: r, cells });
  }
  for (let c = 0; c < n; c++) {
    const cells = [];
    for (let r = 0; r < n; r++) cells.push(r * n + c);
    units.push({ kind: 'col', idx: c, cells });
  }
  const blokov = (n / bh) * (n / bw);
  for (let b = 0; b < blokov; b++) {
    const br = Math.floor(b / (n / bw)) * bh, bc = (b % (n / bw)) * bw;
    const cells = [];
    for (let r = br; r < br + bh; r++) for (let c = bc; c < bc + bw; c++) cells.push(r * n + c);
    units.push({ kind: 'block', idx: b, cells, r0: br, c0: bc, bh, bw });
  }
  for (let i = 0; i < C; i++) {
    const r = (i / n) | 0, c = i % n;
    const b = Math.floor(r / bh) * (n / bw) + Math.floor(c / bw);
    unitOf.push([r, n + c, 2 * n + b]);
  }

  const klasicke = [], skok = [], kral = [], peers = [];
  for (let i = 0; i < C; i++) {
    const r = (i / n) | 0, c = i % n;
    const kl = new Set();
    for (const ui of unitOf[i]) for (const j of units[ui].cells) if (j !== i) kl.add(j);
    const sk = [];
    if (knight) {
      for (const [dr, dc] of SKOKY) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n) sk.push(rr * n + cc);
      }
    }
    const kr = [];
    if (king) {
      for (const [dr, dc] of KROKY) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n) kr.push(rr * n + cc);
      }
    }
    const all = new Set(kl);
    for (const j of sk) all.add(j);
    for (const j of kr) all.add(j);
    klasicke.push(Array.from(kl).sort((a, b2) => a - b2));
    skok.push(sk.sort((a, b2) => a - b2));
    kral.push(kr.sort((a, b2) => a - b2));
    peers.push(Int16Array.from(Array.from(all).sort((a, b2) => a - b2)));
  }

  const J = {
    n, C, bh, bw, rules: { knight, king },
    units, unitOf, klasicke, skok, kral, peers, VSETKY: vsetkyMasky(n),
  };
  JADRA.set(kluc, J);
  return J;
}

/* Začiatočný stav: val = dané čísla (a hráčova plocha, ak je), cand = všetko
   na prázdnych políčkach. `hotove` si značí, ktoré napísané čísla už
   propagácia rozniesla susedom. */
function stav(J, givens, initial) {
  const val = new Int8Array(J.C);
  const cand = new Uint16Array(J.C);
  const hotove = new Uint8Array(J.C);
  for (let i = 0; i < J.C; i++) {
    let d = 0;
    if (givens && givens[i] >= 1 && givens[i] <= J.n) d = givens[i];
    else if (initial && initial[i] >= 1 && initial[i] <= J.n) d = initial[i];
    if (d) { val[i] = d; cand[i] = 1 << d; } else cand[i] = J.VSETKY;
  }
  return { val, cand, hotove };
}
function kopia(s) {
  return { val: Int8Array.from(s.val), cand: Uint16Array.from(s.cand), hotove: Uint8Array.from(s.hotove) };
}

/* ── Propagácia ──────────────────────────────────────────────────────── *
 * Každé napísané číslo zmizne z kandidátov všetkých políčok, ktoré sa od
 * neho musia líšiť (riadok, stĺpec, blok, skok jazdca a pri kráľovi aj
 * susedstvo vrátane rohov). S `prirad` naviac dopíše číslo tam, kde ostal
 * jediný kandidát, a tam, kde jednotka pre číslo nemá iné miesto (to robí
 * strojový riešiteľ; ľudský riešiteľ si taký krok zapisuje sám).
 * Vráti false, keď z toho vyjde spor. */
function propaguj(J, s, prirad) {
  const q = [];
  let head = 0;
  for (let i = 0; i < J.C; i++) if (s.val[i] && !s.hotove[i]) { s.hotove[i] = 1; q.push(i); }
  for (;;) {
    while (head < q.length) {
      const i = q[head++], d = s.val[i], bit = 1 << d;
      const p = J.peers[i];
      for (let k = 0; k < p.length; k++) {
        const j = p[k];
        if (s.val[j]) { if (s.val[j] === d) return false; continue; }
        if (!(s.cand[j] & bit)) continue;
        const nc = s.cand[j] & ~bit;
        if (!nc) return false;
        s.cand[j] = nc;
        if (prirad && (nc & (nc - 1)) === 0) {
          s.val[j] = jednaCislica(nc); s.hotove[j] = 1; q.push(j);
        }
      }
    }
    if (!prirad) return true;
    let pridane = 0;
    for (const u of J.units) {
      let umiestnene = 0;
      for (const i of u.cells) if (s.val[i]) umiestnene |= 1 << s.val[i];
      for (let d = 1; d <= J.n; d++) {
        const bit = 1 << d;
        if (umiestnene & bit) continue;
        let kde = -1, kolko = 0;
        for (const i of u.cells) {
          if (s.val[i] || !(s.cand[i] & bit)) continue;
          kolko++; kde = i;
          if (kolko > 1) break;
        }
        if (!kolko) return false;
        if (kolko === 1) {
          s.val[kde] = d; s.cand[kde] = bit; s.hotove[kde] = 1; q.push(kde); pridane++;
        }
      }
    }
    if (!pridane && head >= q.length) return true;
  }
}

/* ── Kontrola hotovej plochy ─────────────────────────────────────────── */

/* Dvojice políčok, ktoré porušujú niektoré pravidlo. Vracia zoznam indexov
 * (bez opakovania), takže Check má čo označiť. Prázdne políčka sa
 * nekontrolujú. */
export function konflikty(v, n, rules = {}) {
  const J = jadro(n, rules);
  const zle = new Set();
  for (let i = 0; i < J.C; i++) {
    const d = v[i];
    if (!(d >= 1 && d <= n)) continue;
    const p = J.peers[i];
    for (let k = 0; k < p.length; k++) if (v[p[k]] === d) { zle.add(i); zle.add(p[k]); }
  }
  return Array.from(zle).sort((a, b) => a - b);
}

/* Je plocha úplne vyplnená a bez sporu so všetkými pravidlami dňa? */
export function sediPravidlam(v, n, rules = {}) {
  const J = jadro(n, rules);
  for (let i = 0; i < J.C; i++) if (!(v[i] >= 1 && v[i] <= n)) return false;
  for (const u of J.units) {
    let m = 0;
    for (const i of u.cells) {
      const bit = 1 << v[i];
      if (m & bit) return false;
      m |= bit;
    }
  }
  for (let i = 0; i < J.C; i++) {
    const p = J.peers[i];
    for (let k = 0; k < p.length; k++) if (v[p[k]] === v[i]) return false;
  }
  return true;
}

/* ── solve: strojový riešiteľ ────────────────────────────────────────── *
 * solve(givens, n, rules, { limit = 2, initial, maxNodes = 0 })
 *   Propagácia (kandidáti orezané o riadok, stĺpec, blok, skok jazdca a pri
 *   kráľovi aj susedstvo), po nej vetvenie s návratom na políčku s najmenej
 *   kandidátmi. Prehľadáva úplne, takže počet riešení až po `limit` je
 *   spoľahlivý: limit 2 stačí na otázku, či je zadanie jednoznačné.
 *   maxNodes zastaví hľadanie po toľkých vetvách (0 = bez stropu, tak sa aj
 *   používa). Pri zastavení je count neúplný, preto vráti aj vycerpane:
 *   true; volajúci sa vtedy nesmie tváriť, že vie počet riešení.
 * Vráti { count (do limit), solution (ploché pole alebo null), solutions,
 * nodes, vycerpane }. */
export function solve(givens, n, rules = {}, opts = {}) {
  const limit = opts.limit ?? 2, maxNodes = opts.maxNodes ?? 0;
  const J = jadro(n, rules);
  let count = 0, nodes = 0, vycerpane = false;
  const solutions = [];

  function rek(s) {
    if (vycerpane || count >= limit) return;
    nodes++;
    if (maxNodes && nodes > maxNodes) { vycerpane = true; return; }
    if (!propaguj(J, s, true)) return;
    let best = -1, bestN = n + 1;
    for (let i = 0; i < J.C; i++) {
      if (s.val[i]) continue;
      const p = pocetBitov(s.cand[i]);
      if (p < bestN) { bestN = p; best = i; if (p <= 2) break; }
    }
    if (best < 0) {
      if (!sediPravidlam(s.val, n, rules)) return;
      count++;
      solutions.push(Array.from(s.val));
      return;
    }
    for (const d of cislaZMasky(s.cand[best])) {
      const s2 = kopia(s);
      s2.val[best] = d; s2.cand[best] = 1 << d; s2.hotove[best] = 0;
      rek(s2);
      if (vycerpane || count >= limit) return;
    }
  }
  rek(stav(J, givens, opts.initial));
  return { count, solution: solutions.length ? solutions[0] : null, solutions, nodes, vycerpane };
}

/* ── Náhodná plná plocha ─────────────────────────────────────────────── *
 * Ako solve, ale čísla sa skúšajú v náhodnom poradí a hľadá sa len prvé
 * riešenie. Pri jazdcovi a kráľovi naraz sú platné plochy vzácne, preto
 * propagácia po každom čísle a rozpočet uzlov: keď sa vyčerpá, volajúci
 * skúsi znova s ďalšími náhodnými číslami. */
function randomRiesenie(rng, n, rules, maxNodes) {
  const J = jadro(n, rules);
  let nodes = 0;
  function rek(s) {
    nodes++;
    if (nodes > maxNodes) return null;
    if (!propaguj(J, s, true)) return null;
    let best = -1, bestN = n + 1;
    for (let i = 0; i < J.C; i++) {
      if (s.val[i]) continue;
      const p = pocetBitov(s.cand[i]);
      if (p < bestN) { bestN = p; best = i; if (p <= 2) break; }
    }
    if (best < 0) return sediPravidlam(s.val, n, rules) ? Array.from(s.val) : null;
    for (const d of zamiesajPole(rng, cislaZMasky(s.cand[best]))) {
      const s2 = kopia(s);
      s2.val[best] = d; s2.cand[best] = 1 << d; s2.hotove[best] = 0;
      const r = rek(s2);
      if (r) return r;
      if (nodes > maxNodes) return null;
    }
    return null;
  }
  return rek(stav(J, null, null));
}

/* ── Ľudské pravidlá ─────────────────────────────────────────────────── */

/* Čísla, ktoré políčku i berie klasické susedstvo (riadok, stĺpec, blok),
   a čísla, ktoré mu berie skok jazdca alebo dotyk kráľa. Slúži na to, aby
   krok vedel povedať, prečo číslo inam nejde. */
function braneKlasicky(J, s, i) {
  let m = 0;
  for (const j of J.klasicke[i]) if (s.val[j]) m |= 1 << s.val[j];
  return m;
}
function branePohybom(J, s, i) {
  let m = 0;
  for (const j of J.skok[i]) if (s.val[j]) m |= 1 << s.val[j];
  for (const j of J.kral[i]) if (s.val[j]) m |= 1 << s.val[j];
  return m;
}
/* Prvé políčko so zadaným číslom v dosahu skoku (alebo dotyku) od i. */
function svedokPohybu(J, s, i, d) {
  for (const j of J.skok[i]) if (s.val[j] === d) return { i: j, druh: 'skok' };
  for (const j of J.kral[i]) if (s.val[j] === d) return { i: j, druh: 'dotyk' };
  return null;
}
function svedokKlasicky(J, s, i, d) {
  for (const j of J.klasicke[i]) if (s.val[j] === d) return j;
  return -1;
}

/* Skrytá jednotka: číslo, ktoré sa v jednotke vojde na jediné políčko.
 * `pohybom` false hľadá len tie, ktoré vysvetlí samé klasické susedstvo
 * (vrstva 1), true tie ostatné (vrstva 2, tam už rozhoduje skok alebo
 * dotyk, prípadne kandidáti z predošlých krokov). */
function skrytaJednotka(J, s, pohybom) {
  for (const u of J.units) {
    let umiestnene = 0;
    for (const i of u.cells) if (s.val[i]) umiestnene |= 1 << s.val[i];
    for (let d = 1; d <= J.n; d++) {
      const bit = 1 << d;
      if (umiestnene & bit) continue;
      let kde = -1, kolko = 0;
      for (const i of u.cells) {
        if (s.val[i] || !(s.cand[i] & bit)) continue;
        kolko++; kde = i;
        if (kolko > 1) break;
      }
      if (kolko !== 1 || pocetBitov(s.cand[kde]) <= 1) continue;
      // prečo inde nejde: stačí klasické susedstvo, alebo treba pohyb?
      let stacilo = true;
      const svedkovia = [];
      for (const i of u.cells) {
        if (i === kde || s.val[i]) continue;
        const j = svedokKlasicky(J, s, i, d);
        if (j >= 0) continue;
        stacilo = false;
        const sv = svedokPohybu(J, s, i, d);
        if (sv) svedkovia.push({ prazdne: i, ...sv });
      }
      if (stacilo && !pohybom) {
        return { rule: 'hidden-single', layer: 1, i: kde, val: d, unit: u };
      }
      if (!stacilo && pohybom) {
        return svedkovia.length
          ? { rule: 'hidden-single-leap', layer: 2, i: kde, val: d, unit: u, svedok: svedkovia[0] }
          : { rule: 'hidden-single-marks', layer: 2, i: kde, val: d, unit: u };
      }
    }
  }
  return null;
}

/* Vrstva 1: jediný kandidát v políčku (aj vďaka skoku a dotyku) a skrytá
 * jednotka v riadku, stĺpci alebo bloku, ktorú vysvetlí samo klasické
 * susedstvo. */
function vrstva1(J, s) {
  for (let i = 0; i < J.C; i++) {
    if (s.val[i]) continue;
    const c = s.cand[i];
    if (!c || (c & (c - 1)) !== 0) continue;
    const d = jednaCislica(c);
    const kl = braneKlasicky(J, s, i);
    if ((J.VSETKY & ~kl) === c) return { rule: 'naked-single', layer: 1, i, val: d };
    const poh = branePohybom(J, s, i);
    if ((J.VSETKY & ~(kl | poh)) === c) {
      let sv = null;
      for (const e of cislaZMasky(J.VSETKY & ~c & ~kl)) {
        const w = svedokPohybu(J, s, i, e);
        if (w) { sv = { ...w, val: e }; break; }
      }
      return { rule: 'naked-single-leap', layer: 1, i, val: d, svedok: sv };
    }
    return { rule: 'naked-single-marks', layer: 1, i, val: d };
  }
  return skrytaJednotka(J, s, false);
}

/* Vrstva 2: skrytá jednotka, ktorú drží až skok jazdca alebo dotyk kráľa,
 * dvojica rovnakých kandidátov v jednotke a číslo, ktoré je v bloku len v
 * jednom riadku (alebo stĺpci). Dvojica a pointing pair sa zapíšu len vtedy,
 * keď z nich hneď vyjde jedno číslo; inak sa zmena vráti, aby každý krok
 * stál sám za seba. */
function vrstva2(J, s) {
  const a = skrytaJednotka(J, s, true);
  if (a) return a;

  // dvojica: dve políčka jednotky majú tie isté dva kandidátov
  for (const u of J.units) {
    const prazdne = u.cells.filter((i) => !s.val[i]);
    if (prazdne.length < 3) continue;
    for (let x = 0; x < prazdne.length; x++) {
      const ca = s.cand[prazdne[x]];
      if (pocetBitov(ca) !== 2) continue;
      for (let y = x + 1; y < prazdne.length; y++) {
        if (s.cand[prazdne[y]] !== ca) continue;
        for (const i of prazdne) {
          if (i === prazdne[x] || i === prazdne[y]) continue;
          const nc = s.cand[i] & ~ca;
          if (nc && nc !== s.cand[i] && (nc & (nc - 1)) === 0) {
            for (const j of prazdne) if (j !== prazdne[x] && j !== prazdne[y]) s.cand[j] &= ~ca;
            return {
              rule: 'pair', layer: 2, i, val: jednaCislica(nc), unit: u,
              dvojica: cislaZMasky(ca), kde: [prazdne[x], prazdne[y]],
            };
          }
        }
      }
    }
  }

  // číslo v bloku len v jednom riadku alebo stĺpci
  for (const u of J.units) {
    if (u.kind !== 'block') continue;
    for (let d = 1; d <= J.n; d++) {
      const bit = 1 << d;
      let umiestnene = false;
      const kde = [];
      for (const i of u.cells) {
        if (s.val[i] === d) { umiestnene = true; break; }
        if (!s.val[i] && (s.cand[i] & bit)) kde.push(i);
      }
      if (umiestnene || kde.length < 2) continue;
      for (const smer of ['row', 'col']) {
        const cislo = smer === 'row' ? (kde[0] / J.n) | 0 : kde[0] % J.n;
        let rovnaky = true;
        for (const i of kde) {
          const t = smer === 'row' ? (i / J.n) | 0 : i % J.n;
          if (t !== cislo) { rovnaky = false; break; }
        }
        if (!rovnaky) continue;
        const linia = J.units[smer === 'row' ? cislo : J.n + cislo];
        for (const i of linia.cells) {
          if (s.val[i] || kde.indexOf(i) >= 0) continue;
          const nc = s.cand[i] & ~bit;
          if (nc && nc !== s.cand[i] && (nc & (nc - 1)) === 0) {
            for (const j of linia.cells) if (!s.val[j] && kde.indexOf(j) < 0) s.cand[j] &= ~bit;
            return { rule: 'pointing', layer: 2, i, val: jednaCislica(nc), unit: u, linia, cislo: d };
          }
        }
      }
    }
  }
  return null;
}

/* Vrstva 3: jednokrokové skúšanie. Políčko s dvoma alebo tromi kandidátmi:
 * každý sa skúsi napísať a rozvinúť propagáciou; ak z toho vyjde spor,
 * číslo padá. Keď ostane jediné, políčko je určené. Ak spor nevyjde, stav
 * sa nemení. */
function vrstva3(J, s) {
  for (let i = 0; i < J.C; i++) {
    if (s.val[i]) continue;
    const c = s.cand[i];
    const p = pocetBitov(c);
    if (p < 2 || p > 3) continue;
    let ostava = 0;
    const zle = [];
    for (const d of cislaZMasky(c)) {
      const t = kopia(s);
      t.val[i] = d; t.cand[i] = 1 << d; t.hotove[i] = 0;
      if (propaguj(J, t, true)) ostava |= 1 << d; else zle.push(d);
    }
    if (!ostava) return null;
    if (zle.length && (ostava & (ostava - 1)) === 0) {
      s.cand[i] = ostava;
      return { rule: 'trial', layer: 3, i, val: jednaCislica(ostava), zle };
    }
  }
  return null;
}

/* solveHuman(givens, n, rules, { initial, limitKrokov, maxVrstva })
 *   Rieši len ľudskými pravidlami, bez hádania, v troch vrstvách:
 *   vrstva 1 (jediný kandidát, skrytá jednotka z riadku, stĺpca alebo bloku,
 *   pričom skok jazdca a dotyk kráľa berú kandidátov rovnako ako riadok),
 *   vrstva 2 (skrytá jednotka, ktorú drží až skok alebo dotyk, dvojica,
 *   číslo v bloku len v jednom riadku), vrstva 3 (jednokroková skúška so
 *   sporom). Ľahšia vrstva má vždy prednosť.
 *   initial: ploché pole čísel (0 prázdne), napríklad hráčova plocha;
 *   limitKrokov: skončiť po toľkých krokoch (nápoveda: 1);
 *   maxVrstva: najvyššia dovolená vrstva (2 = riešiteľné bez skúšania).
 * Vráti { solved, contradiction, layersUsed:{1,2,3}, steps, solution, values },
 * kde steps sú kroky { rule, layer, cells:[{ r, c, i, val }], text } s
 * anglickým vysvetlením. */
export function solveHuman(givens, n, rules = {}, opts = {}) {
  const J = jadro(n, rules);
  const s = stav(J, givens, opts.initial);
  const maxVrstva = opts.maxVrstva ?? 3;
  const limitKrokov = opts.limitKrokov || 0;
  const steps = [];
  let bad = !propaguj(J, s, false);
  while (!bad) {
    let prazdne = false;
    for (let i = 0; i < J.C; i++) if (!s.val[i]) { prazdne = true; break; }
    if (!prazdne) break;
    const k = vrstva1(J, s) || (maxVrstva >= 2 ? vrstva2(J, s) : null) || (maxVrstva >= 3 ? vrstva3(J, s) : null);
    if (!k) break;
    s.val[k.i] = k.val;
    s.cand[k.i] = 1 << k.val;
    s.hotove[k.i] = 0;
    steps.push({
      rule: k.rule, layer: k.layer,
      cells: [{ r: (k.i / n) | 0, c: k.i % n, i: k.i, val: k.val }],
      text: textKroku(J, k),
    });
    if (limitKrokov && steps.length >= limitKrokov) break;
    if (!propaguj(J, s, false)) { bad = true; break; }
  }
  let hotove = !bad;
  for (let i = 0; i < J.C; i++) if (!s.val[i]) { hotove = false; break; }
  if (hotove) hotove = sediPravidlam(s.val, n, rules);
  const layersUsed = { 1: 0, 2: 0, 3: 0 };
  for (const st of steps) layersUsed[st.layer]++;
  return {
    solved: hotove,
    contradiction: bad,
    layersUsed,
    steps,
    solution: hotove ? Array.from(s.val) : null,
    values: Array.from(s.val),
  };
}

/* ── Anglické vysvetlenia krokov ─────────────────────────────────────── */

function zoznamCisel(a, spojka = 'and') {
  if (a.length === 1) return String(a[0]);
  return a.slice(0, -1).join(', ') + ' ' + spojka + ' ' + a[a.length - 1];
}
function veta(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
/* „a 5", ale „an 8" */
function sCislom(d) { return (d === 8 ? 'an ' : 'a ') + d; }
function polohaBunky(J, i) {
  return 'row ' + (((i / J.n) | 0) + 1) + ', column ' + ((i % J.n) + 1);
}
function popisJednotky(J, u) {
  if (u.kind === 'row') return 'row ' + (u.idx + 1);
  if (u.kind === 'col') return 'column ' + (u.idx + 1);
  return 'the block in rows ' + (u.r0 + 1) + ' to ' + (u.r0 + u.bh) + ', columns ' + (u.c0 + 1) + ' to ' + (u.c0 + u.bw);
}
/* „a knight leap away in row 3, column 5" alebo „right next to it in ..." */
function popisPohybu(J, sv) {
  const kde = polohaBunky(J, sv.i);
  return sv.druh === 'skok' ? 'a knight leap away in ' + kde : 'right next to it in ' + kde;
}

function textKroku(J, k) {
  const kde = polohaBunky(J, k.i);
  switch (k.rule) {
    case 'naked-single':
      return 'The burrow in ' + kde + ' already sees every number but ' + k.val +
        ' in its row, its column and its block, so it holds ' + k.val + '.';
    case 'naked-single-leap':
      return 'The burrow in ' + kde + ' already sees every number but ' + k.val +
        (k.svedok ? ', the ' + k.svedok.val + ' among them ' + popisPohybu(J, k.svedok) : '') +
        ', so it holds ' + k.val + '.';
    case 'naked-single-marks':
      return 'After the numbers ruled out so far, ' + k.val + ' is the only one left for the burrow in ' +
        kde + '.';
    case 'hidden-single':
      return veta(sCislom(k.val)) + ' has to go somewhere in ' + popisJednotky(J, k.unit) +
        ', and every free burrow there except ' + kde + ' already sees ' + sCislom(k.val) +
        ' in its own row, column or block, so the ' + k.val + ' belongs in ' + kde + '.';
    case 'hidden-single-leap':
      return veta(sCislom(k.val)) + ' has to go somewhere in ' + popisJednotky(J, k.unit) +
        ', and the other free burrows there are blocked, one of them by the ' + k.val + ' ' +
        popisPohybu(J, k.svedok) + ', so the ' + k.val + ' belongs in ' + kde + '.';
    case 'hidden-single-marks':
      return veta(sCislom(k.val)) + ' has to go somewhere in ' + popisJednotky(J, k.unit) +
        ', and after the numbers ruled out so far ' + kde + ' is the only burrow left for it.';
    case 'pair':
      return 'Two burrows of ' + popisJednotky(J, k.unit) + ' can hold only ' + zoznamCisel(k.dvojica) +
        ' between them, so no other burrow there can take those numbers, which leaves ' + k.val +
        ' for ' + kde + '.';
    case 'pointing':
      return 'In ' + popisJednotky(J, k.unit) + ' the ' + k.cislo + ' fits only in ' +
        popisJednotky(J, k.linia) + ', so the rest of that ' + (k.linia.kind === 'row' ? 'row' : 'column') +
        ' cannot take ' + sCislom(k.cislo) + ', which leaves ' + k.val + ' for ' + kde + '.';
    case 'trial':
      return 'Writing ' + zoznamCisel(k.zle, 'or') + ' into ' + kde +
        ' runs into a contradiction a step later, so that burrow holds ' + k.val + '.';
    default:
      return veta('the burrow in ' + kde + ' holds ' + k.val + '.');
  }
}

/* ── Denná lúka ──────────────────────────────────────────────────────── *
 * generate(dateStr, opts) picks the size and the rules (9 x 9 with the
 * knight rule by default) and calls generateSeeded with the date as both
 * name and key, so every date keeps the puzzle it always had.
 * opts: n, rules, dane, maxVrstva, maxAttempts (default 200). */
export function generate(dateStr, opts = {}) {
  if (!isValidDate(dateStr)) throw new Error('Date must be in YYYY-MM-DD form: ' + dateStr);
  const n = opts.n ?? 9;
  return generateSeeded(dateStr, dateStr + '/' + n, opts);
}

/* Koľko čísel má ostať, keď to úroveň nepovie: zhruba tretina plochy. */
function predvolenyPocet(n) { return n === 6 ? 12 : 30; }

/* The same as generate, but the random seed comes from `key` (any string) and
 * `name` is only stored in the result as `date`. Practice puzzles and the
 * daily candidates use it. Deterministic: the same key gives the same puzzle.
 * Returns { date, n, rules, givens, solution, seed, attempts,
 * difficulty: { layers:{1,2,3}, dane, odobrate, steps }, ms }. */
export function generateSeeded(name, key, opts = {}) {
  const n = opts.n ?? 9;
  const rules = { knight: opts.rules ? opts.rules.knight !== false : true, king: !!(opts.rules && opts.rules.king) };
  const maxAttempts = opts.maxAttempts ?? 200;
  const maxVrstva = opts.maxVrstva ?? 3;
  const ciel = opts.dane ?? predvolenyPocet(n);
  // Rozpočet uzlov pri hľadaní náhodnej plnej plochy. Keď sa vyčerpá, skúsi
  // sa ďalšia náhodná plocha; strop je pevný, takže zadanie ostáva pre daný
  // kľúč vždy rovnaké.
  const maxNodesFill = opts.maxNodesFill ?? 4000;
  const t0 = nowMs();
  const seed = seedFromString(key);
  const rng = mulberry32(seed);
  const C = n * n;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const solution = randomRiesenie(rng, n, rules, maxNodesFill);
    if (!solution) continue;

    // Minimalizácia: políčka sa vyprázdňujú v náhodnom poradí a prázdne
    // ostane len to, po ktorom má zadanie stále práve jedno riešenie a
    // ľudský riešiteľ ho dorieši bez hádania.
    const givens = solution.slice();
    let pocet = C, odobrate = 0;
    for (const i of zamiesaj(rng, C)) {
      if (pocet <= ciel) break;
      const stare = givens[i];
      givens[i] = 0;
      let ok = false;
      const r = solve(givens, n, rules, { limit: 2 });
      if (!r.vycerpane && r.count === 1) {
        const h = solveHuman(givens, n, rules, { maxVrstva });
        ok = h.solved && rovnake(h.solution, solution);
      }
      if (ok) { pocet--; odobrate++; } else givens[i] = stare;
    }
    if (!odobrate) continue;

    const fin = solveHuman(givens, n, rules, { maxVrstva });
    if (!fin.solved || !rovnake(fin.solution, solution)) {
      throw new Error('solveHuman settled on a different meadow than the source for ' + name);
    }
    return {
      date: name, n, rules, givens, solution, seed, attempts: attempt,
      difficulty: { layers: fin.layersUsed, dane: pocet, odobrate, steps: fin.steps.length },
      ms: Math.round((nowMs() - t0) * 10) / 10,
    };
  }
  throw new Error('No unique, guess-free puzzle for ' + name + ' in ' + maxAttempts + ' attempts');
}
