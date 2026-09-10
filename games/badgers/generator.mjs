/* Badgers: generator and solver for the daily sum pens puzzle.
 *
 * One file, no dependencies, runs the same in Node and in the browser
 * (game.js imports it as a module, tests.mjs too). Everything is
 * deterministic: a date turns into a number, the number into a sequence of
 * random values, the sequence into a puzzle. The same date gives the same
 * puzzle on every machine, so the server never has to compute or store
 * anything.
 *
 * Rules of the game (our own wording): a grid of n x n cells, split into
 * rows, columns and blocks (3 x 3 at nine, 2 rows by 3 columns at six) and,
 * on top of that, into pens with a dotted outline. Every cell holds a number
 * 1 to n; every row, every column and every block holds each number once; a
 * pen never repeats a number and the numbers inside it add up to the total in
 * its top left corner. Nothing is filled in at the start: the totals are the
 * whole puzzle.
 *
 * Representation:
 *   n         the side of the grid (6 or 9)
 *   cages     [{ sum, cells: [index...] }], every cell in exactly one pen,
 *             each pen a connected group of 1 to 5 cells
 *   solution  flat n*n array of numbers 1 to n
 *
 * Generation (generateSeeded):
 *   1. a random filled grid: the plain pattern grid, then the rows inside
 *      each band, the bands, the columns inside each stack, the stacks and
 *      the numbers themselves are all shuffled, which keeps every row, column
 *      and block correct while making the grid our own random one,
 *   2. a random split into pens: grow from random seed cells, 1 to 5 cells
 *      each, never taking a cell whose number is already in the pen; at most
 *      two pens of a single cell,
 *   3. the totals are read off the filled grid,
 *   4. minimise the puzzle: merge neighbouring pens (two totals become one,
 *      so the board says less) for as long as the puzzle stays uniquely
 *      solvable and still finishable without guessing,
 *   5. accept only a puzzle that solveHuman finishes and that solve confirms
 *      has exactly one solution; otherwise try another grid, up to
 *      `maxAttempts`.
 *
 * Difficulty, returned as `difficulty`:
 *   layers  how many steps the human solver needed from each layer of rules
 *           (1 local, 2 patterns across a line or a pen, 3 one step trials),
 *   cages   how many pens are left,
 *   zlucene how many merges the minimising pass managed,
 *   steps   the total number of steps.
 * plan.mjs ranks candidates by layer 3 first, then layer 2.
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

/* ── Číslice ako bitové masky ────────────────────────────────────────── *
 * Číslica d je bit (1 << d), takže bit 0 sa nepoužíva a maska sa dá čítať
 * priamo. VSETKY(D) = číslice 1 až D. */
function vsetkyMaska(D) { return ((1 << (D + 1)) - 2) >>> 0; }

function cislaZMasky(m, D) {
  const out = [];
  for (let d = 1; d <= D; d++) if (m & (1 << d)) out.push(d);
  return out;
}
function pocetBitov(m) { let c = 0; while (m) { m &= m - 1; c++; } return c; }
function jednaCislica(m) { return 31 - Math.clz32(m); }
function jeJedna(m) { return m !== 0 && (m & (m - 1)) === 0; }

/* TAB[dlzka][sucet] = pole masiek: všetky množiny číslic 1 až D danej dĺžky
   s daným súčtom. Postavené raz na veľkosť (512 podmnožín pri deviatich). */
const TABY = new Map();
function tabulka(D) {
  const hotova = TABY.get(D);
  if (hotova) return hotova;
  const T = (D * (D + 1)) / 2;
  const t = [];
  for (let L = 0; L <= D; L++) { const r = []; for (let S = 0; S <= T; S++) r.push([]); t.push(r); }
  for (let m = 1; m < (1 << D); m++) {
    let L = 0, S = 0;
    for (let d = 1; d <= D; d++) if (m & (1 << (d - 1))) { L++; S += d; }
    // masky v tabuľke používajú bit (1 << d), preto posun
    t[L][S].push(m << 1);
  }
  TABY.set(D, t);
  return t;
}
function zoznamMasiek(TAB, len, sum) {
  if (!(len >= 0 && len < TAB.length)) return [];
  const r = TAB[len];
  return sum >= 0 && sum < r.length ? r[sum] : [];
}

/* Všetky množiny číslic dĺžky `len` so súčtom `sum` z číslic 1 až D, ako polia
   číslic. Pri deviatich čísliciach sú to práve tie súčty zo špecifikácie, ktoré
   sa dajú poskladať jediným spôsobom: 3 a 4 a 16 a 17 z dvoch, 6 a 7 a 23 a 24
   z troch, 10 a 11 a 29 a 30 zo štyroch, 15 a 16 a 34 a 35 z piatich. */
export function kombinacieSuctu(len, sum, D = 9) {
  return zoznamMasiek(tabulka(D), len, sum).map((m) => cislaZMasky(m, D));
}

/* ── Mriežka, bloky, jednotky ────────────────────────────────────────── */

/* Tvar bloku podľa veľkosti mriežky: 9 má bloky 3 x 3, 6 má bloky 2 riadky
   krát 3 stĺpce, 4 (len na testy) bloky 2 x 2. */
export function blokoveRozmery(n) {
  if (n === 9) return { vyska: 3, sirka: 3 };
  if (n === 6) return { vyska: 2, sirka: 3 };
  if (n === 4) return { vyska: 2, sirka: 2 };
  throw new Error('Unsupported grid size: ' + n);
}

export function blokIndexu(i, n) {
  const { vyska, sirka } = blokoveRozmery(n);
  const r = (i / n) | 0, c = i % n;
  return (((r / vyska) | 0) * (n / sirka) + ((c / sirka) | 0)) | 0;
}

/* Riadky, stĺpce a bloky ako zoznam { druh, cislo, cells }. Poradie je pevné:
   najprv n riadkov, potom n stĺpcov, potom n blokov (v poradí čítania). */
export function jednotky(n) {
  const { vyska, sirka } = blokoveRozmery(n);
  const out = [];
  for (let r = 0; r < n; r++) {
    const cells = [];
    for (let c = 0; c < n; c++) cells.push(r * n + c);
    out.push({ druh: 'row', cislo: r, cells });
  }
  for (let c = 0; c < n; c++) {
    const cells = [];
    for (let r = 0; r < n; r++) cells.push(r * n + c);
    out.push({ druh: 'column', cislo: c, cells });
  }
  const pasy = n / vyska, stohy = n / sirka;
  for (let b = 0; b < pasy; b++) {
    for (let a = 0; a < stohy; a++) {
      const cells = [];
      for (let r = 0; r < vyska; r++) for (let c = 0; c < sirka; c++) cells.push((b * vyska + r) * n + a * sirka + c);
      out.push({ druh: 'block', cislo: b * stohy + a, cells });
    }
  }
  return out;
}

function susedia(i, n) {
  const r = (i / n) | 0, c = i % n;
  const out = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}

/* Náhodné poradie (Fisher-Yates) z rng. */
function rozsah(m) { return Array.from({ length: m }, (_, i) => i); }
function zamiesajPole(rng, a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function zamiesaj(rng, m) { return zamiesajPole(rng, rozsah(m)); }

function rovnake(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/* ── Náhodná vyplnená mriežka ────────────────────────────────────────── *
 * Základný vzor (r % vyska) * sirka + r / vyska + c je platná mriežka pre
 * akýkoľvek tvar bloku. Zamiešaním riadkov vnútri pásov, samotných pásov,
 * stĺpcov vnútri stohov, stohov a číslic ostane platná, ale je to už naša
 * vlastná náhodná mriežka. */
export function randomRiesenie(rng, n) {
  const { vyska, sirka } = blokoveRozmery(n);
  const pasy = zamiesaj(rng, n / vyska);
  const riadky = [];
  for (const p of pasy) for (const r of zamiesaj(rng, vyska)) riadky.push(p * vyska + r);
  const stohy = zamiesaj(rng, n / sirka);
  const stlpce = [];
  for (const st of stohy) for (const c of zamiesaj(rng, sirka)) stlpce.push(st * sirka + c);
  const symboly = zamiesaj(rng, n);
  const out = new Array(n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const rr = riadky[r], cc = stlpce[c];
      const zaklad = ((rr % vyska) * sirka + ((rr / vyska) | 0) + cc) % n;
      out[r * n + c] = symboly[zaklad] + 1;
    }
  }
  return out;
}

/* ── Ohrady ──────────────────────────────────────────────────────────── */

/* Je rozdelenie na ohrady použiteľné? Každé políčko práve v jednej ohrade,
   ohrada súvislá, veľkosť 1 až maxVelkost, a (voliteľne) žiadne opakovanie
   číslice v ohrade. Používajú to testy aj rozbal. */
export function ohradyOk(cages, n, opts = {}) {
  const maxVelkost = opts.maxVelkost ?? 5;
  const C = n * n;
  if (!Array.isArray(cages) || !cages.length) return false;
  const kde = new Int32Array(C).fill(-1);
  for (let g = 0; g < cages.length; g++) {
    const cage = cages[g];
    if (!cage || !Array.isArray(cage.cells) || !cage.cells.length) return false;
    if (cage.cells.length > maxVelkost) return false;
    if (!Number.isInteger(cage.sum) || cage.sum < 1) return false;
    for (const i of cage.cells) {
      if (!(i >= 0 && i < C) || kde[i] >= 0) return false;
      kde[i] = g;
    }
    // súvislosť: prehľadanie do šírky vnútri ohrady
    const vlastne = new Set(cage.cells);
    const videne = new Set([cage.cells[0]]);
    const q = [cage.cells[0]];
    for (let h = 0; h < q.length; h++) {
      for (const j of susedia(q[h], n)) if (vlastne.has(j) && !videne.has(j)) { videne.add(j); q.push(j); }
    }
    if (videne.size !== cage.cells.length) return false;
  }
  for (let i = 0; i < C; i++) if (kde[i] < 0) return false;
  if (opts.solution) {
    for (const cage of cages) {
      let used = 0, sum = 0;
      for (const i of cage.cells) {
        const b = 1 << opts.solution[i];
        if (used & b) return false;
        used |= b;
        sum += opts.solution[i];
      }
      if (sum !== cage.sum) return false;
    }
  }
  return true;
}

/* Váhy cieľových veľkostí ohrady (index = veľkosť). Malé ohrady sú tu naschvál
   časté: veľa malých ohrád znamená veľa súčtov, teda zadanie, ktoré sa dá
   dorátať bez hádania. Zlučovanie v generateSeeded potom zadanie ubíja späť
   k väčším ohradám presne dovtedy, kým to ešte ide. Dni bez skúšania (vrstva
   najviac 2) potrebujú ešte štedrejší začiatok, preto VAHY_BEZ_SKUSANIA. */
export const VAHY_VELKOSTI = [0, 3, 50, 35, 11, 1];
export const VAHY_BEZ_SKUSANIA = [0, 2, 65, 30, 3, 0];

/* Náhodné rozdelenie mriežky na ohrady: rast z náhodných semien. Do ohrady sa
   pridá len sused, ktorého číslica v nej ešte nie je (to je pravidlo hry, nie
   len vkus). Susedia sa zbierajú aj s opakovaním, takže políčko priľahlé
   k ohrade z dvoch strán má väčšiu šancu, a ohrady vychádzajú zavalité, nie
   hadovité. Ohrád veľkosti 1 nechá najviac `maxJednotiek` (zvyšné skúsi
   prilepiť k susednej ohrade), veľkosti 5 najviac `maxVelkych`. Vráti pole
   { sum, cells } zoradené podľa prvého políčka, alebo null. */
export function randomOhrady(rng, solution, n, opts = {}) {
  const C = n * n;
  const vahy = opts.vahy || VAHY_VELKOSTI;
  const maxJednotiek = opts.maxJednotiek ?? 2;
  const maxVelkych = opts.maxVelkych ?? (n === 9 ? 4 : 2);
  const celkovaVaha = vahy.reduce((a, b) => a + b, 0);
  const nahodnaVelkost = () => {
    let x = rng() * celkovaVaha;
    for (let v = 1; v < vahy.length; v++) { x -= vahy[v]; if (x <= 0) return v; }
    return vahy.length - 1;
  };

  const kde = new Int32Array(C).fill(-1);
  const cages = [];
  for (const seed of zamiesaj(rng, C)) {
    if (kde[seed] >= 0) continue;
    const g = cages.length;
    const cells = [seed];
    kde[seed] = g;
    let maska = 1 << solution[seed];
    const ciel = nahodnaVelkost();
    while (cells.length < ciel) {
      const kand = [];
      for (const i of cells) {
        for (const j of susedia(i, n)) if (kde[j] < 0 && !(maska & (1 << solution[j]))) kand.push(j);
      }
      if (!kand.length) break;
      const j = kand[Math.floor(rng() * kand.length)];
      kde[j] = g; cells.push(j); maska |= 1 << solution[j];
    }
    cages.push({ cells });
  }

  // ohrady veľkosti 1 nad limit sa skúsia prilepiť k susednej ohrade
  const jednotky1 = cages.filter((c) => c.cells.length === 1);
  if (jednotky1.length > maxJednotiek) {
    for (const cage of zamiesajPole(rng, jednotky1.slice())) {
      const stale = cages.filter((c) => c.cells.length === 1).length;
      if (stale <= maxJednotiek) break;
      const i = cage.cells[0];
      let prilepene = false;
      for (const j of zamiesajPole(rng, susedia(i, n))) {
        const ciel = cages[kde[j]];
        if (ciel === cage || ciel.cells.length >= 5) continue;
        let maska = 0;
        for (const x of ciel.cells) maska |= 1 << solution[x];
        if (maska & (1 << solution[i])) continue;
        ciel.cells.push(i);
        kde[i] = cages.indexOf(ciel);
        cage.cells.length = 0;
        prilepene = true;
        break;
      }
      if (!prilepene) return null;
    }
  }

  const zive = cages.filter((c) => c.cells.length);
  if (zive.filter((c) => c.cells.length === 1).length > maxJednotiek) return null;
  if (zive.filter((c) => c.cells.length === 5).length > maxVelkych) return null;
  // hotové ohrady majú vždy ten istý tvar { sum, cells } a políčka v poradí
  // čítania, takže sa dajú porovnávať a baliť ako reťazec
  const hotove = zive.map((c) => {
    const cells = c.cells.slice().sort((a, b) => a - b);
    let sum = 0;
    for (const i of cells) sum += solution[i];
    return { sum, cells };
  });
  hotove.sort((a, b) => a.cells[0] - b.cells[0]);
  return ohradyOk(hotove, n, { solution }) ? hotove : null;
}

/* ── Jadro a stav riešiteľa ──────────────────────────────────────────── */

/* Všetko, čo riešiteľ o zadaní potrebuje, spočítané raz. Obmedzenia majú
   spoločné číslovanie: 0 až U-1 sú jednotky (riadky, stĺpce, bloky), ďalej
   ohrady. */
function jadro(cages, n) {
  const D = n, C = n * n;
  const un = jednotky(n);
  const cellUnits = new Int32Array(3 * C);
  for (let i = 0; i < C; i++) {
    cellUnits[3 * i] = (i / n) | 0;
    cellUnits[3 * i + 1] = n + (i % n);
    cellUnits[3 * i + 2] = 2 * n + blokIndexu(i, n);
  }
  const cellCage = new Int32Array(C).fill(-1);
  for (let g = 0; g < cages.length; g++) for (const i of cages[g].cells) cellCage[i] = g;
  return {
    n, D, C, VSETKY: vsetkyMaska(D), TAB: tabulka(D),
    units: un, U: un.length, cages, cellUnits, cellCage,
    _inQ: new Uint8Array(un.length + cages.length),
    _mark: new Uint8Array(C),
  };
}

/* Začiatočný stav: val 0 na prázdnom políčku, cand všetky číslice. `initial`
   je ploché pole číslic (0 prázdne), napríklad hráčova plocha. */
function stav(J, initial) {
  const val = new Int8Array(J.C);
  const cand = new Uint16Array(J.C);
  for (let i = 0; i < J.C; i++) {
    cand[i] = J.VSETKY;
    if (initial && initial[i] >= 1 && initial[i] <= J.D) { val[i] = initial[i]; cand[i] = 1 << initial[i]; }
  }
  return { val, cand };
}
function kopia(s) { return { val: Int8Array.from(s.val), cand: Uint16Array.from(s.cand) }; }

function dotkni(J, i, q, inQ) {
  const a = J.cellUnits[3 * i], b = J.cellUnits[3 * i + 1], c = J.cellUnits[3 * i + 2];
  const g = J.cellCage[i] >= 0 ? J.U + J.cellCage[i] : -1;
  for (const id of [a, b, c, g]) if (id >= 0 && !inQ[id]) { inQ[id] = 1; q.push(id); }
}

/* ── Propagácia ──────────────────────────────────────────────────────── *
 * Jednotka (riadok, stĺpec, blok): napísaná číslica sa škrtne u ostatných,
 * a každá zvyšná číslica musí mať v jednotke aspoň jedno miesto.
 * Ohrada: z jej súčtu a veľkosti sa zoberú všetky množiny číslic, ktoré
 * obsahujú už napísané číslice a ktorých zvyšok sa vojde do kandidátov
 * prázdnych políčok; zjednotenie zvyškov je to, čo v ohrade ešte môže stáť.
 * `prirad` true naviac dopíše číslicu tam, kde ostal jediný kandidát alebo kde
 * má číslica v jednotke jediné miesto (to robí strojový riešiteľ a skúšanie
 * vo vrstve 3; ľudský riešiteľ si taký krok zapisuje sám).
 * `seed` obmedzí prvý prechod na zadané obmedzenia (po jednej zmene stačí). */
function propaguj(J, s, prirad, seed) {
  const inQ = J._inQ;
  inQ.fill(0);
  const q = [];
  if (seed) { for (const id of seed) if (id >= 0 && !inQ[id]) { inQ[id] = 1; q.push(id); } }
  else { for (let id = 0; id < inQ.length; id++) { inQ[id] = 1; q.push(id); } }
  for (let head = 0; head < q.length; head++) {
    const id = q[head];
    inQ[id] = 0;
    const ok = id < J.U ? jednotkaKrok(J, s, J.units[id], prirad, q, inQ) : ohradaKrok(J, s, J.cages[id - J.U], prirad, q, inQ);
    if (!ok) return false;
  }
  return true;
}

function jednotkaKrok(J, s, u, prirad, q, inQ) {
  let used = 0;
  for (const i of u.cells) {
    const v = s.val[i];
    if (!v) continue;
    const b = 1 << v;
    if (used & b) return false;
    used |= b;
  }
  for (const i of u.cells) {
    if (s.val[i]) continue;
    const nc = s.cand[i] & ~used;
    if (!nc) return false;
    if (nc !== s.cand[i]) { s.cand[i] = nc; dotkni(J, i, q, inQ); }
  }
  // každá nenapísaná číslica potrebuje v jednotke miesto; jediné miesto je
  // skrytá jednotka a strojový riešiteľ ju rovno napíše
  const cakaju = [];
  for (let d = 1; d <= J.D; d++) {
    const b = 1 << d;
    if (used & b) continue;
    let kde = -1, kolko = 0;
    for (const i of u.cells) { if (s.val[i]) continue; if (s.cand[i] & b) { kolko++; kde = i; } }
    if (!kolko) return false;
    if (kolko === 1 && prirad) cakaju.push(kde, d);
  }
  if (!prirad) return true;
  for (const i of u.cells) {
    if (s.val[i]) continue;
    if (jeJedna(s.cand[i])) cakaju.push(i, jednaCislica(s.cand[i]));
  }
  for (let k = 0; k < cakaju.length; k += 2) {
    const i = cakaju[k], d = cakaju[k + 1];
    if (s.val[i]) { if (s.val[i] !== d) return false; continue; }
    if (!(s.cand[i] & (1 << d))) return false;
    s.val[i] = d; s.cand[i] = 1 << d;
    dotkni(J, i, q, inQ);
  }
  return true;
}

function ohradaKrok(J, s, cage, prirad, q, inQ) {
  let used = 0, sum = 0, prazdne = 0, candU = 0;
  for (const i of cage.cells) {
    const v = s.val[i];
    if (v) {
      const b = 1 << v;
      if (used & b) return false;
      used |= b; sum += v;
    } else { prazdne++; candU |= s.cand[i]; }
  }
  if (!prazdne) return sum === cage.sum;
  const zoznam = zoznamMasiek(J.TAB, cage.cells.length, cage.sum);
  let allow = 0, poss = 0;
  for (let t = 0; t < zoznam.length; t++) {
    const m = zoznam[t];
    if ((m & used) !== used) continue;
    const rem = m & ~used;
    if (rem & ~candU) continue;
    allow |= rem; poss++;
  }
  if (!poss) return false;
  for (const i of cage.cells) {
    if (s.val[i]) continue;
    const nc = s.cand[i] & allow;
    if (!nc) return false;
    if (nc !== s.cand[i]) { s.cand[i] = nc; dotkni(J, i, q, inQ); }
    if (prirad && jeJedna(s.cand[i])) {
      s.val[i] = jednaCislica(s.cand[i]);
      dotkni(J, i, q, inQ);
    }
  }
  return true;
}

/* Sedí každý riadok, stĺpec, blok a každá ohrada na úplne vyplnenej ploche? */
function overRiesenie(J, val) {
  for (let i = 0; i < J.C; i++) if (!(val[i] >= 1 && val[i] <= J.D)) return false;
  for (const u of J.units) {
    let used = 0;
    for (const i of u.cells) {
      const b = 1 << val[i];
      if (used & b) return false;
      used |= b;
    }
  }
  for (const cage of J.cages) {
    let used = 0, sum = 0;
    for (const i of cage.cells) {
      const b = 1 << val[i];
      if (used & b) return false;
      used |= b; sum += val[i];
    }
    if (sum !== cage.sum) return false;
  }
  return true;
}

/* ── solve: strojový riešiteľ ────────────────────────────────────────── *
 * solve(cages, n, { limit = 2, initial, maxNodes = 0 })
 *   Propagácia (jedinečnosť v riadku, stĺpci a bloku plus kombinácie súčtu
 *   ohrady), po nej vetvenie s návratom na políčku s najmenej kandidátmi.
 *   Prehľadáva úplne, takže počet riešení až po `limit` je spoľahlivý: limit 2
 *   stačí na otázku, či je zadanie jednoznačné.
 *   maxNodes zastaví hľadanie po toľkých vetvách (0 = bez stropu). Pri
 *   zastavení je count neúplný, preto vráti aj vycerpane: true; volajúci sa
 *   vtedy nesmie tváriť, že vie počet riešení.
 * Vráti { count (do limit), solution (ploché pole číslic alebo null),
 * solutions (všetky nájdené, do limit), nodes, vycerpane }. */
export function solve(cages, n, opts = {}) {
  const limit = opts.limit ?? 2, maxNodes = opts.maxNodes ?? 0;
  const J = jadro(cages, n);
  let count = 0, nodes = 0, vycerpane = false;
  const solutions = [];

  function rek(s, seed) {
    if (vycerpane || count >= limit) return;
    nodes++;
    if (maxNodes && nodes > maxNodes) { vycerpane = true; return; }
    if (!propaguj(J, s, true, seed)) return;
    let best = -1, bestN = J.D + 1;
    for (let i = 0; i < J.C; i++) {
      if (s.val[i]) continue;
      const p = pocetBitov(s.cand[i]);
      if (p < bestN) { bestN = p; best = i; if (p <= 2) break; }
    }
    if (best < 0) {
      if (!overRiesenie(J, s.val)) return;
      count++;
      solutions.push(Array.from(s.val));
      return;
    }
    const seed2 = [J.cellUnits[3 * best], J.cellUnits[3 * best + 1], J.cellUnits[3 * best + 2], J.U + J.cellCage[best]];
    for (const d of cislaZMasky(s.cand[best], J.D)) {
      const s2 = kopia(s);
      s2.val[best] = d; s2.cand[best] = 1 << d;
      rek(s2, seed2);
      if (vycerpane || count >= limit) return;
    }
  }
  rek(stav(J, opts.initial), null);
  return { count, solution: solutions.length ? solutions[0] : null, solutions, nodes, vycerpane };
}

/* ── solveHuman: len ľudské pravidlá, bez hádania ────────────────────── */

/* Možné množiny číslic ohrady pri terajšom stave: { used, prazdne (indexy),
   zoznam (masky zvyškov), must (číslice v každej možnosti), candU }. */
function moznostiOhrady(J, s, cage) {
  let used = 0, candU = 0;
  const prazdne = [];
  for (const i of cage.cells) {
    const v = s.val[i];
    if (v) used |= 1 << v;
    else { prazdne.push(i); candU |= s.cand[i]; }
  }
  const zoznam = [];
  let must = J.VSETKY;
  const t = zoznamMasiek(J.TAB, cage.cells.length, cage.sum);
  for (let k = 0; k < t.length; k++) {
    const m = t[k];
    if ((m & used) !== used) continue;
    const rem = m & ~used;
    if (rem & ~candU) continue;
    zoznam.push(rem);
    must &= rem;
  }
  if (!zoznam.length) must = 0;
  return { used, prazdne, zoznam, must, candU };
}

/* Vieme číslice `rem` rozdať políčkam `prazdne` tak, aby každé dostalo svoju
   a nikde neodporovali kandidátom? Lacná nutná podmienka: každá číslica musí
   niekam pasovať a každé políčko musí niečo dostať. */
function daSaRozdat(s, prazdne, rem, vynechaj, pevna) {
  const zvysok = pevna ? rem & ~pevna : rem;
  for (let d = 1; d <= 9; d++) {
    if (!(zvysok & (1 << d))) continue;
    let kam = 0;
    for (const i of prazdne) { if (i === vynechaj) continue; if (s.cand[i] & (1 << d)) { kam = 1; break; } }
    if (!kam) return false;
  }
  for (const i of prazdne) {
    if (i === vynechaj) continue;
    if (!(s.cand[i] & zvysok)) return false;
  }
  return true;
}

function popisJednotky(u) { return u.druh + ' ' + (u.cislo + 1); }

/* Vrstva 1: ohrada z jedného políčka, jediná možná množina súčtu, jediný
   kandidát, a číslica s jediným miestom v riadku, stĺpci alebo bloku. */
function vrstva1(J, s) {
  for (const cage of J.cages) {
    if (cage.cells.length !== 1) continue;
    const i = cage.cells[0];
    if (s.val[i]) continue;
    if (cage.sum >= 1 && cage.sum <= J.D && (s.cand[i] & (1 << cage.sum))) {
      return { rule: 'single-cell-cage', layer: 1, i, val: cage.sum, cage };
    }
  }
  for (const cage of J.cages) {
    const t = zoznamMasiek(J.TAB, cage.cells.length, cage.sum);
    if (t.length !== 1) continue;
    for (const i of cage.cells) {
      if (s.val[i]) continue;
      if (jeJedna(s.cand[i])) {
        return { rule: 'single-combo', layer: 1, i, val: jednaCislica(s.cand[i]), cage, mnozina: cislaZMasky(t[0], J.D) };
      }
    }
  }
  for (let i = 0; i < J.C; i++) {
    if (s.val[i]) continue;
    if (jeJedna(s.cand[i])) return { rule: 'naked-single', layer: 1, i, val: jednaCislica(s.cand[i]) };
  }
  for (const u of J.units) {
    let used = 0;
    for (const i of u.cells) if (s.val[i]) used |= 1 << s.val[i];
    for (let d = 1; d <= J.D; d++) {
      const b = 1 << d;
      if (used & b) continue;
      let kde = -1, kolko = 0;
      for (const i of u.cells) { if (s.val[i]) continue; if (s.cand[i] & b) { kolko++; kde = i; } }
      if (kolko === 1 && !jeJedna(s.cand[kde])) {
        return { rule: 'hidden-single', layer: 1, i: kde, val: d, unit: u };
      }
    }
  }
  return null;
}

/* Vrstva 2, časť a: pravidlo súčtu jednotky. Riadok, stĺpec aj blok majú vždy
   ten istý súčet (45 pri deviatich číslach, 21 pri šiestich). Keď ohrady celé
   vnútri jednotky nechajú jediné políčko navyše, jeho číslica je rozdiel
   (innie); keď ohrady, ktoré do jednotky zasahujú, pokrývajú jednotku a jediné
   políčko mimo nej, to políčko je rozdiel na druhú stranu (outie). */
function pravidloSuctu(J, s) {
  const T = (J.D * (J.D + 1)) / 2;
  const mark = J._mark;
  for (const u of J.units) {
    for (const i of u.cells) mark[i] = 1;
    const dotyk = new Set();
    for (const i of u.cells) dotyk.add(J.cellCage[i]);
    let sumVnutri = 0, sumDotyk = 0;
    const vonku = [];
    const celeVnutri = new Set();
    for (const g of dotyk) {
      const cage = J.cages[g];
      let cele = true;
      for (const i of cage.cells) if (!mark[i]) { cele = false; vonku.push(i); }
      sumDotyk += cage.sum;
      if (cele) { sumVnutri += cage.sum; celeVnutri.add(g); }
    }
    const zvysne = [];
    for (const i of u.cells) if (!celeVnutri.has(J.cellCage[i])) zvysne.push(i);
    if (zvysne.length === 1) {
      const i = zvysne[0], d = T - sumVnutri;
      if (!s.val[i] && d >= 1 && d <= J.D && (s.cand[i] & (1 << d)) && !jeJedna(s.cand[i])) {
        for (const x of u.cells) mark[x] = 0;
        return { rule: 'unit-sum-in', layer: 2, i, val: d, unit: u, sucet: sumVnutri, celkom: T };
      }
    }
    if (vonku.length === 1) {
      const i = vonku[0], d = sumDotyk - T;
      if (!s.val[i] && d >= 1 && d <= J.D && (s.cand[i] & (1 << d)) && !jeJedna(s.cand[i])) {
        for (const x of u.cells) mark[x] = 0;
        return { rule: 'unit-sum-out', layer: 2, i, val: d, unit: u, sucet: sumDotyk, celkom: T };
      }
    }
    for (const i of u.cells) mark[i] = 0;
  }
  return null;
}

/* Vrstva 2, časť b: dvojica kandidátov. Dve políčka jednej jednotky alebo
   jednej ohrady, ktoré majú tie isté dva kandidátov, si tie dve číslice medzi
   sebou rozdelia, takže inde v tej jednotke stáť nemôžu. Krok sa zapíše len
   vtedy, keď z toho hneď vyjde číslica, a škrtnutie sa nikam neukladá: každý
   krok musí stáť sám za sebou nad číslami, ktoré sú na ploche (viď poznámku
   pri solveHuman). */
function dvojice(J, s) {
  const skupiny = [];
  for (const u of J.units) skupiny.push({ cells: u.cells, unit: u, cage: null });
  for (const cage of J.cages) skupiny.push({ cells: cage.cells, unit: null, cage });
  for (const sk of skupiny) {
    const prazdne = sk.cells.filter((i) => !s.val[i]);
    if (prazdne.length < 3) continue;
    for (let a = 0; a < prazdne.length; a++) {
      const ca = s.cand[prazdne[a]];
      if (pocetBitov(ca) !== 2) continue;
      for (let b = a + 1; b < prazdne.length; b++) {
        if (s.cand[prazdne[b]] !== ca) continue;
        for (const i of prazdne) {
          if (i === prazdne[a] || i === prazdne[b]) continue;
          const nc = s.cand[i] & ~ca;
          if (nc && nc !== s.cand[i] && jeJedna(nc)) {
            return {
              rule: 'pair', layer: 2, i, val: jednaCislica(nc),
              unit: sk.unit, cage: sk.cage, dvojica: cislaZMasky(ca, J.D),
            };
          }
        }
      }
    }
  }
  return null;
}

/* Vrstva 2, časť c: kombinácie súčtu obmedzené kandidátmi. Číslica v políčku
   ohrady padá, keď sa pri nej zvyšok ohrady už nedá poskladať z toho, čo
   riadky, stĺpce a bloky v ostatných políčkach dovoľujú. */
function suctyOhrad(J, s) {
  for (const cage of J.cages) {
    const mo = moznostiOhrady(J, s, cage);
    if (mo.prazdne.length < 2 || !mo.zoznam.length) continue;
    for (const i of mo.prazdne) {
      const c = s.cand[i];
      if (pocetBitov(c) < 2) continue;
      let ok = 0;
      for (const d of cislaZMasky(c, J.D)) {
        const bit = 1 << d;
        let mozne = false;
        for (const rem of mo.zoznam) {
          if (!(rem & bit)) continue;
          if (daSaRozdat(s, mo.prazdne, rem, i, bit)) { mozne = true; break; }
        }
        if (mozne) ok |= bit;
      }
      if (ok !== c && jeJedna(ok)) {
        return { rule: 'cage-sum', layer: 2, i, val: jednaCislica(ok), cage };
      }
    }
  }
  return null;
}

/* Vrstva 2, časť d: ohrada celá v jednom riadku, stĺpci alebo bloku. Číslice,
   ktoré ohrada musí použiť pri každej možnosti súčtu, potom nemôžu stáť inde
   v tej jednotke. */
function ohradaVJednotke(J, s) {
  for (const cage of J.cages) {
    if (cage.cells.length < 2) continue;
    const prve = cage.cells[0];
    const kandidatiJednotiek = [];
    for (let k = 0; k < 3; k++) {
      const id = J.cellUnits[3 * prve + k];
      let vsetky = true;
      for (const i of cage.cells) if (J.cellUnits[3 * i + k] !== id) { vsetky = false; break; }
      if (vsetky) kandidatiJednotiek.push(J.units[id]);
    }
    if (!kandidatiJednotiek.length) continue;
    const mo = moznostiOhrady(J, s, cage);
    if (!mo.must) continue;
    for (const u of kandidatiJednotiek) {
      const vlastne = new Set(cage.cells);
      for (const i of u.cells) {
        if (vlastne.has(i) || s.val[i]) continue;
        const nc = s.cand[i] & ~mo.must;
        if (nc && nc !== s.cand[i] && jeJedna(nc)) {
          return {
            rule: 'cage-in-unit', layer: 2, i, val: jednaCislica(nc), cage, unit: u,
            cislice: cislaZMasky(mo.must, J.D),
          };
        }
      }
    }
  }
  return null;
}

function vrstva2(J, s) {
  return pravidloSuctu(J, s) || dvojice(J, s) || suctyOhrad(J, s) || ohradaVJednotke(J, s);
}

/* Vrstva 3: jednokrokové skúšanie. Políčko s dvoma alebo tromi kandidátmi:
   každý sa skúsi napísať a rozvinúť vrstvou 1; ak z toho vyjde spor, číslica
   padá. Keď ostane jediná, políčko je určené. Ak spor nevyjde, stav sa
   nemení. */
function vrstva3(J, s) {
  for (let i = 0; i < J.C; i++) {
    if (s.val[i]) continue;
    const c = s.cand[i];
    const p = pocetBitov(c);
    if (p < 2 || p > 3) continue;
    const seed = [J.cellUnits[3 * i], J.cellUnits[3 * i + 1], J.cellUnits[3 * i + 2], J.U + J.cellCage[i]];
    let ostava = 0;
    const zle = [];
    for (const d of cislaZMasky(c, J.D)) {
      const t = kopia(s);
      t.val[i] = d; t.cand[i] = 1 << d;
      if (propaguj(J, t, true, seed)) ostava |= 1 << d; else zle.push(d);
    }
    if (!ostava) return null;
    if (zle.length && jeJedna(ostava)) {
      return { rule: 'trial', layer: 3, i, val: jednaCislica(ostava), zle };
    }
  }
  return null;
}

/* solveHuman(cages, n, { initial, limitKrokov, maxVrstva })
 *   Rieši len ľudskými pravidlami, bez hádania, v troch vrstvách: vrstva 1
 *   (ohrada z jedného políčka, jediná možná množina súčtu, jediný kandidát,
 *   skrytá jednotka), vrstva 2 (pravidlo súčtu jednotky, dvojica kandidátov,
 *   kombinácie súčtu obmedzené kandidátmi, ohrada celá v jednej jednotke),
 *   vrstva 3 (jednokroková skúška so sporom). Ľahšia vrstva má vždy prednosť.
 *   initial: ploché pole číslic (0 prázdne), napríklad hráčova plocha;
 *   limitKrokov: skončiť po toľkých krokoch (nápoveda: 1);
 *   maxVrstva: najvyššia dovolená vrstva (2 = riešiteľné bez skúšania).
 * Vráti { solved, contradiction, layersUsed:{1,2,3}, steps, solution, values },
 * kde steps sú kroky { rule, layer, cells:[{ r, c, i, val }], text } s
 * anglickým vysvetlením.
 * Každý krok je vynútený, nie tipnutý, takže dokončené riešenie je zároveň
 * dôkaz, že zadanie iné riešenie nemá.
 * Žiadne pravidlo si neodkladá škrtnutých kandidátov nabok: každý krok vychádza
 * len z čísel, ktoré sú v tej chvíli na ploche. Vďaka tomu dá riešiteľ ten istý
 * krok aj vtedy, keď sa spustí odznova s hráčovou plochou, čo je presne to, čo
 * robí nápoveda (logika.mjs) po každom jednom ťahu. */
export function solveHuman(cages, n, opts = {}) {
  const J = jadro(cages, n);
  const s = stav(J, opts.initial);
  const maxVrstva = opts.maxVrstva ?? 3;
  const limitKrokov = opts.limitKrokov || 0;
  const steps = [];
  let bad = !propaguj(J, s, false, null);
  while (!bad) {
    let prazdne = false;
    for (let i = 0; i < J.C; i++) if (!s.val[i]) { prazdne = true; break; }
    if (!prazdne) break;
    const k = vrstva1(J, s) || (maxVrstva >= 2 ? vrstva2(J, s) : null) || (maxVrstva >= 3 ? vrstva3(J, s) : null);
    if (!k) break;
    s.val[k.i] = k.val;
    s.cand[k.i] = 1 << k.val;
    steps.push({
      rule: k.rule, layer: k.layer,
      cells: [{ r: (k.i / n) | 0, c: k.i % n, i: k.i, val: k.val }],
      text: textKroku(k, n),
    });
    if (limitKrokov && steps.length >= limitKrokov) break;
    const seed = [J.cellUnits[3 * k.i], J.cellUnits[3 * k.i + 1], J.cellUnits[3 * k.i + 2], J.U + J.cellCage[k.i]];
    if (!propaguj(J, s, false, seed)) { bad = true; break; }
  }
  let hotove = !bad;
  if (hotove) for (let i = 0; i < J.C; i++) if (!s.val[i]) { hotove = false; break; }
  if (hotove) hotove = overRiesenie(J, s.val);
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

function zoznamCislic(a, spojka = 'and') {
  if (a.length === 1) return String(a[0]);
  return a.slice(0, -1).join(', ') + ' ' + spojka + ' ' + a[a.length - 1];
}
function polohaBunky(i, n) {
  return 'row ' + (((i / n) | 0) + 1) + ', column ' + ((i % n) + 1);
}
function popisOhrady(cage, n) {
  if (!cage) return 'this pen';
  return 'the pen of ' + cage.sum + ' that starts in ' + polohaBunky(cage.cells[0], n);
}

function textKroku(k, n) {
  const kde = polohaBunky(k.i, n);
  switch (k.rule) {
    case 'single-cell-cage':
      return 'The pen in ' + kde + ' holds a single cell, so its total is the number itself: ' + k.val + '.';
    case 'single-combo':
      return 'The total of ' + popisOhrady(k.cage, n) + ' can only be made of ' + zoznamCislic(k.mnozina) +
        ', and with what the row, the column and the block allow, the cell in ' + kde + ' can only be ' + k.val + '.';
    case 'naked-single':
      return 'Only one number is still free for the cell in ' + kde + ', so it holds ' + k.val + '.';
    case 'hidden-single':
      return popisJednotky(k.unit).charAt(0).toUpperCase() + popisJednotky(k.unit).slice(1) +
        ' has to hold a ' + k.val + ' somewhere, and the cell in ' + kde + ' is the only place left for it.';
    case 'unit-sum-in':
      return 'Every ' + k.unit.druh + ' adds up to ' + k.celkom + '. The pens that lie inside ' +
        popisJednotky(k.unit) + ' add up to ' + k.sucet + ', so the one cell left over, in ' + kde + ', holds ' + k.val + '.';
    case 'unit-sum-out':
      return 'The pens that reach into ' + popisJednotky(k.unit) + ' add up to ' + k.sucet + ' while a ' +
        k.unit.druh + ' adds up to ' + k.celkom + ', so their one cell outside it, in ' + kde + ', holds ' + k.val + '.';
    case 'pair':
      return 'Two cells of ' + (k.unit ? popisJednotky(k.unit) : popisOhrady(k.cage, n)) + ' can hold only ' +
        zoznamCislic(k.dvojica) + ' between them, so no other cell there can take those numbers, which leaves ' +
        k.val + ' for the cell in ' + kde + '.';
    case 'cage-sum':
      return 'Every way of making the total of ' + popisOhrady(k.cage, n) +
        ' out of what the rows, the columns and the blocks still allow in its other cells leaves the same number here, so the cell in ' +
        kde + ' holds ' + k.val + '.';
    case 'cage-in-unit':
      return popisOhrady(k.cage, n).charAt(0).toUpperCase() + popisOhrady(k.cage, n).slice(1) + ' lies inside ' +
        popisJednotky(k.unit) + ' and has to use ' + zoznamCislic(k.cislice) + ', so no other cell of that ' +
        k.unit.druh + ' can hold ' + (k.cislice.length > 1 ? 'them' : 'it') + ', which leaves ' + k.val +
        ' for the cell in ' + kde + '.';
    case 'trial':
      return 'Writing ' + zoznamCislic(k.zle, 'or') + ' into the cell in ' + kde +
        ' runs into a contradiction in the pens and lines around it, so that cell holds ' + k.val + '.';
    default:
      return 'The cell in ' + kde + ' holds ' + k.val + '.';
  }
}

/* ── Denná nora ──────────────────────────────────────────────────────── *
 * generate(dateStr, opts) picks n (default 9) and calls generateSeeded with
 * the date as both name and key, so every date keeps the puzzle it always
 * had. opts: n, maxAttempts (default 400). */
export function generate(dateStr, opts = {}) {
  if (!isValidDate(dateStr)) throw new Error('Date must be in YYYY-MM-DD form: ' + dateStr);
  const n = opts.n ?? 9;
  return generateSeeded(dateStr, dateStr + '/' + n, opts);
}

/* Susedné dvojice ohrád (indexy do poľa cages, a < b). */
function susedneDvojice(cages, cellCage, n) {
  const videne = new Set();
  const out = [];
  for (let i = 0; i < n * n; i++) {
    for (const j of susedia(i, n)) {
      const a = cellCage[i], b = cellCage[j];
      if (a === b) continue;
      const kluc = a < b ? a * 1000 + b : b * 1000 + a;
      if (videne.has(kluc)) continue;
      videne.add(kluc);
      out.push(a < b ? [a, b] : [b, a]);
    }
  }
  return out;
}

function mapaOhrad(cages, n) {
  const kde = new Int32Array(n * n).fill(-1);
  for (let g = 0; g < cages.length; g++) for (const i of cages[g].cells) kde[i] = g;
  return kde;
}

/* The same as generate, but the random seed comes from `key` (any string) and
 * `name` is only stored in the result as `date`. Practice puzzles and the
 * daily candidates use it. Deterministic: the same key gives the same puzzle.
 * Returns { date, n, cages, solution, seed, attempts,
 * difficulty:{ layers:{1,2,3}, cages, zlucene, steps }, ms }. */
export function generateSeeded(name, key, opts = {}) {
  const n = opts.n ?? 9;
  const maxAttempts = opts.maxAttempts ?? 400;
  const maxVrstva = opts.maxVrstva ?? 3;
  const vahy = opts.vahy || (maxVrstva >= 3 ? VAHY_VELKOSTI : VAHY_BEZ_SKUSANIA);
  // Strop na vetvenie pri kontrole jednoznačnosti. Bez neho sa riešiteľ na
  // veľmi voľnom zadaní zamotá na dlhé sekundy; s ním sa taký kandidát proste
  // neprijme. Strop je pevný, takže zadanie ostáva pre daný kľúč vždy rovnaké.
  const maxNodes = opts.maxNodes ?? 20000;
  const maxVelkych = opts.maxVelkych ?? (n === 9 ? 4 : 2);
  const maxJednotiek = opts.maxJednotiek ?? 2;
  const limitPokusov = opts.limitZlucenia ?? 24;
  const t0 = nowMs();
  const seed = seedFromString(key);
  const rng = mulberry32(seed);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const solution = randomRiesenie(rng, n);
    let cages = randomOhrady(rng, solution, n, { vahy, maxJednotiek, maxVelkych });
    if (!cages) continue;
    const uvod = solveHuman(cages, n, { maxVrstva });
    if (!uvod.solved || !rovnake(uvod.solution, solution)) continue;

    // Minimalizácia: dve susedné ohrady sa spoja do jednej (dva súčty sa
    // zmenia na jeden, zadanie teda povie menej), keď ostane jednoznačné aj
    // ľudsky riešiteľné. Dokončený ľudský riešiteľ je zároveň dôkaz
    // jednoznačnosti, lebo každý jeho krok je vynútený.
    let pokusy = 0, zlucene = 0, zmena = true;
    while (zmena && pokusy < limitPokusov) {
      zmena = false;
      const kde = mapaOhrad(cages, n);
      const pary = zamiesajPole(rng, susedneDvojice(cages, kde, n));
      for (const [a, b] of pary) {
        if (pokusy >= limitPokusov) break;
        const spojene = cages[a].cells.concat(cages[b].cells).sort((x, y) => x - y);
        if (spojene.length > 5) continue;
        let maska = 0, opakuje = false;
        for (const i of spojene) { const bit = 1 << solution[i]; if (maska & bit) { opakuje = true; break; } maska |= bit; }
        if (opakuje) continue;
        let velkych = 0, jednotiek = 0;
        for (let g = 0; g < cages.length; g++) {
          if (g === a || g === b) continue;
          if (cages[g].cells.length === 5) velkych++;
          if (cages[g].cells.length === 1) jednotiek++;
        }
        if (spojene.length === 5) velkych++;
        if (velkych > maxVelkych || jednotiek > maxJednotiek) continue;
        pokusy++;
        let sum = 0;
        for (const i of spojene) sum += solution[i];
        const nove = cages.filter((_, g) => g !== a && g !== b);
        nove.push({ sum, cells: spojene });
        nove.sort((x, y) => x.cells[0] - y.cells[0]);
        const h = solveHuman(nove, n, { maxVrstva });
        if (!h.solved || !rovnake(h.solution, solution)) continue;
        cages = nove;
        zlucene++;
        zmena = true;
        break;
      }
    }

    const fin = solveHuman(cages, n, { maxVrstva });
    if (!fin.solved || !rovnake(fin.solution, solution)) continue;
    const r = solve(cages, n, { limit: 2, maxNodes });
    if (r.vycerpane || r.count !== 1) continue;
    if (!rovnake(r.solution, solution)) {
      throw new Error('solve found a different filling than the source for ' + name);
    }
    return {
      date: name, n, cages, solution, seed, attempts: attempt,
      difficulty: { layers: fin.layersUsed, cages: cages.length, zlucene, steps: fin.steps.length },
      ms: Math.round((nowMs() - t0) * 10) / 10,
    };
  }
  throw new Error('No unique, guess-free puzzle for ' + name + ' in ' + maxAttempts + ' attempts');
}
