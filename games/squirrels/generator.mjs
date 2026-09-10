/* Squirrels: generator and solver for the daily cross sums puzzle.
 *
 * One file, no dependencies, runs the same in Node and in the browser
 * (game.js imports it as a module, tests.mjs too). Everything is
 * deterministic: a date turns into a number, the number into a sequence of
 * random values, the sequence into a puzzle. The same date gives the same
 * puzzle on every machine, so the server never has to compute or store
 * anything.
 *
 * Rules of the game (our own wording): a grid of n x n cells. Dark cells are
 * tree trunks, white cells are hollows. Some trunks carry a sign: the number
 * in its top right corner is the total of the run of hollows to its right,
 * the number in its bottom left corner the total of the run of hollows below
 * it. Every hollow holds 1 to 9 acorns, and no number repeats within a run.
 * The first row and the first column are always trunks, every run of hollows
 * is 2 to 9 long, and every hollow belongs both to a run across and to a run
 * down.
 *
 * Representation:
 *   cells     flat n*n array, null for a hollow, { r, d } for a trunk, where
 *             r is the total of the run to its right and d the total of the
 *             run below it (either may be null when there is no such run)
 *   solution  flat n*n array of digits, 0 on every trunk
 *
 * Generation (generateSeeded):
 *   1. lay out a random pattern of trunks: the first row and the first column
 *      are always dark, and trunks are added inside in point symmetric pairs
 *      (a cell and its mirror through the middle of the inner square) until
 *      the pattern reaches its target density, always keeping every run of
 *      hollows 2 to 9 long and all hollows in one connected piece,
 *   2. fill the hollows with digits by backtracking, no repeat inside a run,
 *   3. read the totals off that filling,
 *   4. minimise the puzzle: walk the inner trunks in random order and turn a
 *      symmetric pair of them into hollows for good whenever the puzzle stays
 *      uniquely solvable (solve) and still finishable without guessing
 *      (solveHuman). Every trunk removed takes two totals off the board and
 *      joins two runs into one longer one, so what is left is the smallest
 *      set of signs this puzzle was found to need,
 *   5. accept only a puzzle with exactly one solution that solveHuman
 *      finishes; otherwise try another pattern, up to `maxAttempts`.
 * The pattern and the digits are always our own random ones.
 *
 * Difficulty, returned as `difficulty`:
 *   layers  how many steps the human solver needed from each layer of rules
 *           (1 local, 2 patterns inside a run, 3 one step trials),
 *   trunks  how many dark cells are left,
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
 * priamo. VSETKY = číslice 1 až 9. */
const VSETKY = 0b1111111110;

function cislaZMasky(m) {
  const out = [];
  for (let d = 1; d <= 9; d++) if (m & (1 << d)) out.push(d);
  return out;
}
function pocetBitov(m) { let c = 0; while (m) { m &= m - 1; c++; } return c; }
function jednaCislica(m) { return 31 - Math.clz32(m); }

/* TAB[dlzka][sucet] = pole masiek: všetky množiny číslic 1 až 9 danej dĺžky
   s daným súčtom. Postavené raz pri načítaní modulu (512 podmnožín). */
const TAB = (function () {
  const t = [];
  for (let L = 0; L <= 9; L++) { const r = []; for (let S = 0; S <= 45; S++) r.push([]); t.push(r); }
  for (let m = 1; m < 512; m++) {
    let L = 0, S = 0;
    for (let d = 1; d <= 9; d++) if (m & (1 << (d - 1))) { L++; S += d; }
    // masky v tabuľke používajú bit (1 << d), preto posun
    t[L][S].push(m << 1);
  }
  return t;
})();

/* Všetky množiny číslic dĺžky `len` so súčtom `sum`, ako polia číslic.
   Používa to nápoveda aj testy. */
export function kombinacieSuctu(len, sum) {
  if (!(len >= 1 && len <= 9) || !(sum >= 0 && sum <= 45)) return [];
  return TAB[len][sum].map(cislaZMasky);
}

/* ── Vzor tmavých políčok ────────────────────────────────────────────── */

/* Bodovo symetrický partner vnútorného políčka: stred vnútorného štvorca
   (riadky a stĺpce 1 až n-1) je v (n/2, n/2), zrkadlenie je (n-r, n-c). */
function partner(i, n) {
  const r = (i / n) | 0, c = i % n;
  return (n - r) * n + (n - c);
}

/* Dĺžky vodorovných a zvislých behov bielych políčok. Vráti false, keď je
   niektorý beh dlhý 1 (osamotené políčko v behu), alebo keď kontrolujDlzku
   platí a niektorý beh je dlhší ako 9. */
function behyOk(dark, n, kontrolujDlzku) {
  for (let r = 0; r < n; r++) {
    let run = 0;
    for (let c = 0; c <= n; c++) {
      if (c < n && !dark[r * n + c]) { run++; continue; }
      if (run === 1) return false;
      if (kontrolujDlzku && run > 9) return false;
      run = 0;
    }
  }
  for (let c = 0; c < n; c++) {
    let run = 0;
    for (let r = 0; r <= n; r++) {
      if (r < n && !dark[r * n + c]) { run++; continue; }
      if (run === 1) return false;
      if (kontrolujDlzku && run > 9) return false;
      run = 0;
    }
  }
  return true;
}

/* Sú všetky biele políčka v jednom kuse (susedstvo hore, dole, vľavo, vpravo)? */
function bielaSuvisla(dark, n) {
  let start = -1, total = 0;
  for (let i = 0; i < n * n; i++) if (!dark[i]) { total++; if (start < 0) start = i; }
  if (total === 0) return false;
  const seen = new Uint8Array(n * n);
  const q = [start];
  seen[start] = 1;
  let dosiahnute = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi]; dosiahnute++;
    const r = (i / n) | 0, c = i % n;
    const sus = [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1];
    for (const j of sus) if (j >= 0 && !dark[j] && !seen[j]) { seen[j] = 1; q.push(j); }
  }
  return dosiahnute === total;
}

/* Je vzor tmavých políčok použiteľný? Prvý riadok a prvý stĺpec tmavé, každý
   beh bielych 2 až 9 dlhý, biele políčka v jednom kuse. `kontrolujDlzku`
   false vypne len hornú hranicu 9 (počas rozbíjania dlhých behov). */
export function platnyVzor(dark, n, kontrolujDlzku = true) {
  for (let c = 0; c < n; c++) if (!dark[c]) return false;
  for (let r = 0; r < n; r++) if (!dark[r * n]) return false;
  if (!behyOk(dark, n, kontrolujDlzku)) return false;
  return bielaSuvisla(dark, n);
}

/* Políčka behov dlhších ako 9 (kandidáti na rozbitie), alebo null. */
function dlhePolicka(dark, n) {
  const out = [];
  for (let r = 0; r < n; r++) {
    let start = -1;
    for (let c = 0; c <= n; c++) {
      const biele = c < n && !dark[r * n + c];
      if (biele) { if (start < 0) start = c; continue; }
      if (start >= 0 && c - start > 9) for (let x = start; x < c; x++) out.push(r * n + x);
      start = -1;
    }
  }
  for (let c = 0; c < n; c++) {
    let start = -1;
    for (let r = 0; r <= n; r++) {
      const biele = r < n && !dark[r * n + c];
      if (biele) { if (start < 0) start = r; continue; }
      if (start >= 0 && r - start > 9) for (let x = start; x < r; x++) out.push(x * n + c);
      start = -1;
    }
  }
  return out.length ? out : null;
}

/* Náhodné poradie (Fisher-Yates) z rng. */
function zamiesaj(rng, m) {
  const a = Array.from({ length: m }, (_, i) => i);
  for (let i = m - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function zamiesajPole(rng, a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

/* Náhodný vzor tmavých políčok. Prvý riadok a prvý stĺpec sú tmavé vždy
   (pravidlo hry, nie náhoda); vnútri sa pridávajú bodovo symetrické dvojice,
   najprv toľko, aby žiadny beh nebol dlhší ako 9, potom až po cieľovú
   hustotu. `hustota` je podiel z celej mriežky n*n a počíta tie tmavé
   políčka, o ktorých sa naozaj rozhoduje, teda vnútorné (25 až 35 percent
   z n*n vyjde na 30 až 50 percent vnútorného štvorca).
   Vráti Uint8Array n*n (1 = tmavé) alebo null, keď sa vzor nepodarilo
   dotiahnuť do platného tvaru. */
export function randomVzor(rng, n, hustota) {
  const dark = new Uint8Array(n * n);
  for (let c = 0; c < n; c++) dark[c] = 1;
  for (let r = 0; r < n; r++) dark[r * n] = 1;
  const ciel = Math.round(hustota * n * n);
  let pridane = 0;
  const vsetkyBiele = () => {
    const out = [];
    for (let i = 0; i < n * n; i++) if (!dark[i]) out.push(i);
    return out;
  };
  const skus = (kand, dlhe) => {
    zamiesajPole(rng, kand);
    for (const i of kand) {
      const j = partner(i, n);
      if (dark[i] || dark[j]) continue;
      dark[i] = 1; dark[j] = 1;
      if (platnyVzor(dark, n, !dlhe)) { pridane += i === j ? 1 : 2; return true; }
      dark[i] = 0; dark[j] = 0;
    }
    return false;
  };
  for (let guard = 0; guard < 4000; guard++) {
    const dlhe = dlhePolicka(dark, n);
    if (!dlhe && pridane >= ciel) break;
    if (dlhe) {
      // najprv políčka v dlhom behu, a keď sa žiadne z nich nedá stmaviť,
      // ktorékoľvek iné: aj vzdialená dvojica vie otvoriť ďalšie možnosti
      if (!skus(dlhe, true) && !skus(vsetkyBiele(), true)) return null;
    } else if (!skus(vsetkyBiele(), false)) break;
  }
  return platnyVzor(dark, n, true) ? dark : null;
}

/* ── Behy a indície ──────────────────────────────────────────────────── */

/* Indície zo vzoru a z riešenia: každé tmavé políčko dostane súčet behu
   doprava (r) a behu dole (d), alebo null, keď taký beh nie je. */
export function cluesFromSolution(dark, solution, n) {
  const cells = new Array(n * n).fill(null);
  for (let i = 0; i < n * n; i++) if (dark[i]) cells[i] = { r: null, d: null };
  for (let i = 0; i < n * n; i++) {
    if (!dark[i]) continue;
    const r = (i / n) | 0, c = i % n;
    let s = 0, len = 0;
    for (let cc = c + 1; cc < n && !dark[r * n + cc]; cc++) { s += solution[r * n + cc]; len++; }
    if (len) cells[i].r = s;
    s = 0; len = 0;
    for (let rr = r + 1; rr < n && !dark[rr * n + c]; rr++) { s += solution[rr * n + c]; len++; }
    if (len) cells[i].d = s;
  }
  return cells;
}

/* Behy zadania: pole { dir:'h'|'v', sum, cells:[index], clue, r, c, len },
   kde r a c sú súradnice prvého bieleho políčka behu. cellRuns[2*i] je
   vodorovný beh bieleho políčka i, cellRuns[2*i+1] zvislý. */
export function behy(cells, n) {
  const runs = [];
  const cellRuns = new Int32Array(2 * n * n).fill(-1);
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (cells[r * n + c] === null) { c++; continue; }
      const clue = r * n + c;
      const list = [];
      let cc = c + 1;
      while (cc < n && cells[r * n + cc] === null) { list.push(r * n + cc); cc++; }
      if (list.length) {
        const id = runs.length;
        runs.push({ dir: 'h', sum: cells[clue].r, cells: list, clue, r, c: c + 1, len: list.length });
        for (const i of list) cellRuns[2 * i] = id;
      }
      c = cc;
    }
  }
  for (let c = 0; c < n; c++) {
    let r = 0;
    while (r < n) {
      if (cells[r * n + c] === null) { r++; continue; }
      const clue = r * n + c;
      const list = [];
      let rr = r + 1;
      while (rr < n && cells[rr * n + c] === null) { list.push(rr * n + c); rr++; }
      if (list.length) {
        const id = runs.length;
        runs.push({ dir: 'v', sum: cells[clue].d, cells: list, clue, r: r + 1, c, len: list.length });
        for (const i of list) cellRuns[2 * i + 1] = id;
      }
      r = rr;
    }
  }
  return { runs, cellRuns };
}

/* Všetko, čo riešiteľ o zadaní potrebuje, spočítané raz. */
function jadro(cells, n) {
  const b = behy(cells, n);
  const biele = [];
  for (let i = 0; i < n * n; i++) if (cells[i] === null) biele.push(i);
  return { n, C: n * n, cells, runs: b.runs, cellRuns: b.cellRuns, biele, _inQ: new Uint8Array(b.runs.length) };
}

/* Začiatočný stav: val 0 na prázdnom, cand VSETKY na každom bielom políčku.
   `initial` je ploché pole číslic (0 prázdne), napríklad hráčova plocha. */
function stav(J, initial) {
  const val = new Int8Array(J.C);
  const cand = new Uint16Array(J.C);
  for (const i of J.biele) {
    cand[i] = VSETKY;
    if (initial && initial[i] >= 1 && initial[i] <= 9) { val[i] = initial[i]; cand[i] = 1 << initial[i]; }
  }
  return { val, cand };
}
function kopia(s) { return { val: Int8Array.from(s.val), cand: Uint16Array.from(s.cand) }; }

/* ── Propagácia (vrstva 1) ───────────────────────────────────────────── *
 * Pre každý beh: z jeho súčtu a dĺžky zoberie všetky množiny číslic, ktoré
 * obsahujú už napísané číslice a ktorých zvyšok sa vojde do kandidátov
 * prázdnych políčok. Zjednotenie zvyškov je to, čo v tomto behu ešte môže
 * stáť, a kandidáti každého bieleho políčka sa oň orežú. Políčko tak dostane
 * prienik toho, čo dovoľuje jeho vodorovný a jeho zvislý beh.
 * `prirad` true naviac dopíše číslicu tam, kde ostal jediný kandidát (to robí
 * strojový riešiteľ; ľudský riešiteľ si taký krok zapisuje sám).
 * `seedRuns` obmedzí prvý prechod na zadané behy (po jednej zmene stačí). */
function propaguj(J, s, prirad, seedRuns) {
  const runs = J.runs, R = runs.length, inQ = J._inQ;
  inQ.fill(0);
  const q = [];
  if (seedRuns) { for (const ri of seedRuns) if (ri >= 0 && !inQ[ri]) { inQ[ri] = 1; q.push(ri); } }
  else { for (let ri = 0; ri < R; ri++) { inQ[ri] = 1; q.push(ri); } }
  for (let head = 0; head < q.length; head++) {
    const ri = q[head]; inQ[ri] = 0;
    const run = runs[ri];
    let used = 0, prazdne = 0, candU = 0;
    for (const i of run.cells) {
      const v = s.val[i];
      if (v) { const b = 1 << v; if (used & b) return false; used |= b; }
      else { prazdne++; candU |= s.cand[i]; }
    }
    if (!prazdne) {
      if (run.sum != null) {
        let sum = 0;
        for (const i of run.cells) sum += s.val[i];
        if (sum !== run.sum) return false;
      }
      continue;
    }
    let allow;
    if (run.sum == null) allow = VSETKY & ~used;
    else {
      const zoznam = TAB[run.len] && TAB[run.len][run.sum] ? TAB[run.len][run.sum] : [];
      allow = 0;
      let poss = 0;
      for (let t = 0; t < zoznam.length; t++) {
        const m = zoznam[t];
        if ((m & used) !== used) continue;
        const rem = m & ~used;
        if (rem & ~candU) continue;
        allow |= rem; poss++;
      }
      if (!poss) return false;
    }
    for (const i of run.cells) {
      if (s.val[i]) continue;
      const nc = s.cand[i] & allow;
      if (!nc) return false;
      const zmena = nc !== s.cand[i];
      s.cand[i] = nc;
      if (prirad && (nc & (nc - 1)) === 0) {
        s.val[i] = jednaCislica(nc);
        const a = J.cellRuns[2 * i], b = J.cellRuns[2 * i + 1];
        if (a >= 0 && !inQ[a]) { inQ[a] = 1; q.push(a); }
        if (b >= 0 && !inQ[b]) { inQ[b] = 1; q.push(b); }
      } else if (zmena) {
        const a = J.cellRuns[2 * i], b = J.cellRuns[2 * i + 1];
        if (a >= 0 && !inQ[a]) { inQ[a] = 1; q.push(a); }
        if (b >= 0 && !inQ[b]) { inQ[b] = 1; q.push(b); }
      }
    }
  }
  return true;
}

/* Sedí každý beh (súčet aj bez opakovania) na úplne vyplnenej ploche? */
function overRiesenie(J, val) {
  for (const run of J.runs) {
    let sum = 0, used = 0;
    for (const i of run.cells) {
      const v = val[i];
      if (!(v >= 1 && v <= 9)) return false;
      const b = 1 << v;
      if (used & b) return false;
      used |= b;
      sum += v;
    }
    if (run.sum != null && sum !== run.sum) return false;
  }
  return true;
}

/* ── solve: strojový riešiteľ ────────────────────────────────────────── *
 * solve(cells, n, { limit = 2, initial, maxNodes = 0 })
 *   Propagácia (prienik povolených číslic z vodorovného a zvislého behu),
 *   po nej vetvenie s návratom na políčku s najmenej kandidátmi. Prehľadáva
 *   úplne, takže počet riešení až po `limit` je spoľahlivý: limit 2 stačí na
 *   otázku, či je zadanie jednoznačné.
 *   maxNodes zastaví hľadanie po toľkých vetvách (0 = bez stropu). Pri
 *   zastavení je count neúplný, preto vráti aj vycerpane: true; volajúci sa
 *   vtedy nesmie tváriť, že vie počet riešení.
 * Vráti { count (do limit), solution (ploché pole číslic alebo null),
 * solutions (všetky nájdené, do limit), nodes, vycerpane }. */
export function solve(cells, n, opts = {}) {
  const limit = opts.limit ?? 2, maxNodes = opts.maxNodes ?? 0;
  const J = jadro(cells, n);
  let count = 0, nodes = 0, vycerpane = false;
  const solutions = [];

  function rek(s, seedRuns) {
    if (vycerpane || count >= limit) return;
    nodes++;
    if (maxNodes && nodes > maxNodes) { vycerpane = true; return; }
    if (!propaguj(J, s, true, seedRuns)) return;
    let best = -1, bestN = 10;
    for (const i of J.biele) {
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
    for (const d of cislaZMasky(s.cand[best])) {
      const s2 = kopia(s);
      s2.val[best] = d; s2.cand[best] = 1 << d;
      rek(s2, [J.cellRuns[2 * best], J.cellRuns[2 * best + 1]]);
      if (vycerpane || count >= limit) return;
    }
  }
  rek(stav(J, opts.initial), null);
  return { count, solution: solutions.length ? solutions[0] : null, solutions, nodes, vycerpane };
}

/* ── solveHuman: len ľudské pravidlá, bez hádania ────────────────────── */

/* Možné množiny číslic behu pri terajšom stave: { zoznam (masky zvyškov),
   used, prazdne (indexy políčok), must (číslice v každej možnosti) }. */
function moznostiBehu(J, s, run) {
  let used = 0;
  const prazdne = [];
  let candU = 0;
  for (const i of run.cells) {
    const v = s.val[i];
    if (v) used |= 1 << v;
    else { prazdne.push(i); candU |= s.cand[i]; }
  }
  const zoznam = [];
  let must = VSETKY;
  if (run.sum == null) {
    if (prazdne.length) { zoznam.push(VSETKY & ~used); must = 0; }
    return { used, prazdne, zoznam, must, candU };
  }
  const t = TAB[run.len] && TAB[run.len][run.sum] ? TAB[run.len][run.sum] : [];
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

/* Vrstva 1: posledné políčko behu, jediná možná množina súčtu, jediný
   kandidát. Vráti krok alebo null. */
function vrstva1(J, s) {
  for (const run of J.runs) {
    if (run.sum == null) continue;
    let prazdne = -1, pocet = 0, sucet = 0;
    for (const i of run.cells) { if (s.val[i]) sucet += s.val[i]; else { pocet++; prazdne = i; } }
    if (pocet !== 1) continue;
    const d = run.sum - sucet;
    if (d >= 1 && d <= 9 && (s.cand[prazdne] & (1 << d))) {
      return { rule: 'last-in-run', layer: 1, i: prazdne, val: d, run, sucet };
    }
  }
  for (const run of J.runs) {
    if (run.sum == null) continue;
    const mo = moznostiBehu(J, s, run);
    if (mo.zoznam.length !== 1) continue;
    for (const i of mo.prazdne) {
      const c = s.cand[i];
      if (c && (c & (c - 1)) === 0) {
        return { rule: 'single-combo', layer: 1, i, val: jednaCislica(c), run, mnozina: cislaZMasky(mo.zoznam[0] | mo.used) };
      }
    }
  }
  for (const i of J.biele) {
    if (s.val[i]) continue;
    const c = s.cand[i];
    if (c && (c & (c - 1)) === 0) {
      return { rule: 'naked-single', layer: 1, i, val: jednaCislica(c),
        run: J.runs[J.cellRuns[2 * i]], run2: J.runs[J.cellRuns[2 * i + 1]] };
    }
  }
  return null;
}

/* Vieme číslice `rem` rozdať políčkam `prazdne` tak, aby každé dostalo svoju
   a nikde neodporovali kandidátom? Lacná nutná podmienka: každá číslica musí
   niekam pasovať a každé políčko musí niečo dostať. */
function daSaRozdat(s, prazdne, rem, vynechajPolicko, pevnaCislica) {
  let zvysok = rem;
  if (pevnaCislica) zvysok = rem & ~pevnaCislica;
  for (let d = 1; d <= 9; d++) {
    if (!(zvysok & (1 << d))) continue;
    let kam = 0;
    for (const i of prazdne) { if (i === vynechajPolicko) continue; if (s.cand[i] & (1 << d)) { kam = 1; break; } }
    if (!kam) return false;
  }
  for (const i of prazdne) {
    if (i === vynechajPolicko) continue;
    if (!(s.cand[i] & zvysok)) return false;
  }
  return true;
}

/* Vrstva 2: skrytá jednotka v behu, dvojica kandidátov, a súčet cez dva behy
   (číslica v políčku, pri ktorej sa už zvyšok behu nedá poskladať z toho, čo
   krížiace behy v ostatných políčkach dovoľujú). Kroky menia kandidátov len
   vtedy, keď z toho hneď vyjde jedna číslica; inak sa zmena vráti späť, aby
   každý zapísaný krok stál sám za seba. */
function vrstva2(J, s) {
  // a) skrytá jednotka: číslica, ktorú beh musí použiť, sa vojde na jediné miesto
  for (const run of J.runs) {
    if (run.sum == null) continue;
    const mo = moznostiBehu(J, s, run);
    if (!mo.prazdne.length) continue;
    for (const d of cislaZMasky(mo.must)) {
      let kde = -1, kolko = 0;
      for (const i of mo.prazdne) if (s.cand[i] & (1 << d)) { kolko++; kde = i; }
      if (kolko === 1 && pocetBitov(s.cand[kde]) > 1) {
        return { rule: 'hidden-single', layer: 2, i: kde, val: d, run };
      }
    }
  }
  // b) dvojica: dve políčka behu majú tie isté dva kandidátov, tak tie dve
  // číslice inde v behu byť nemôžu
  for (const run of J.runs) {
    const prazdne = run.cells.filter((i) => !s.val[i]);
    if (prazdne.length < 3) continue;
    for (let a = 0; a < prazdne.length; a++) {
      const ca = s.cand[prazdne[a]];
      if (pocetBitov(ca) !== 2) continue;
      for (let b = a + 1; b < prazdne.length; b++) {
        if (s.cand[prazdne[b]] !== ca) continue;
        for (const i of prazdne) {
          if (i === prazdne[a] || i === prazdne[b]) continue;
          const nc = s.cand[i] & ~ca;
          if (nc && nc !== s.cand[i] && (nc & (nc - 1)) === 0) {
            for (const j of prazdne) if (j !== prazdne[a] && j !== prazdne[b]) s.cand[j] &= ~ca;
            return { rule: 'pair', layer: 2, i, val: jednaCislica(nc), run, dvojica: cislaZMasky(ca) };
          }
        }
      }
    }
  }
  // c) súčet cez dva behy
  for (const run of J.runs) {
    if (run.sum == null) continue;
    const mo = moznostiBehu(J, s, run);
    if (mo.prazdne.length < 2 || !mo.zoznam.length) continue;
    for (const i of mo.prazdne) {
      const c = s.cand[i];
      if (pocetBitov(c) < 2) continue;
      let ok = 0;
      for (const d of cislaZMasky(c)) {
        const bit = 1 << d;
        let mozne = false;
        for (const rem of mo.zoznam) {
          if (!(rem & bit)) continue;
          if (daSaRozdat(s, mo.prazdne, rem, i, bit)) { mozne = true; break; }
        }
        if (mozne) ok |= bit;
      }
      if (ok !== c && ok && (ok & (ok - 1)) === 0) {
        s.cand[i] = ok;
        return { rule: 'run-sum', layer: 2, i, val: jednaCislica(ok), run };
      }
    }
  }
  return null;
}

/* Vrstva 3: jednokrokové skúšanie. Políčko s dvoma alebo tromi kandidátmi:
   každý sa skúsi napísať a rozvinúť vrstvou 1; ak z toho vyjde spor, číslica
   padá. Keď ostane jediná, políčko je určené. Ak spor nevyjde, stav sa
   nemení. */
function vrstva3(J, s) {
  for (const i of J.biele) {
    if (s.val[i]) continue;
    const c = s.cand[i];
    const p = pocetBitov(c);
    if (p < 2 || p > 3) continue;
    const seed = [J.cellRuns[2 * i], J.cellRuns[2 * i + 1]];
    let ostava = 0;
    const zle = [];
    for (const d of cislaZMasky(c)) {
      const t = kopia(s);
      t.val[i] = d; t.cand[i] = 1 << d;
      if (propaguj(J, t, true, seed)) ostava |= 1 << d; else zle.push(d);
    }
    if (!ostava) return null;
    if (zle.length && (ostava & (ostava - 1)) === 0) {
      s.cand[i] = ostava;
      return { rule: 'trial', layer: 3, i, val: jednaCislica(ostava), zle };
    }
  }
  return null;
}

/* solveHuman(cells, n, { initial, limitKrokov, maxVrstva })
 *   Rieši len ľudskými pravidlami, bez hádania, v troch vrstvách: vrstva 1
 *   (posledné políčko behu, jediná možná množina súčtu, prienik kandidátov
 *   oboch behov), vrstva 2 (skrytá jednotka, dvojica, súčet cez dva behy),
 *   vrstva 3 (jednokroková skúška so sporom). Ľahšia vrstva má vždy prednosť.
 *   initial: ploché pole číslic (0 prázdne), napríklad hráčova plocha;
 *   limitKrokov: skončiť po toľkých krokoch (nápoveda: 1);
 *   maxVrstva: najvyššia dovolená vrstva (2 = riešiteľné bez skúšania).
 * Vráti { solved, contradiction, layersUsed:{1,2,3}, steps, solution, values },
 * kde steps sú kroky { rule, layer, cells:[{ r, c, i, val }], text } s
 * anglickým vysvetlením. */
export function solveHuman(cells, n, opts = {}) {
  const J = jadro(cells, n);
  const s = stav(J, opts.initial);
  const maxVrstva = opts.maxVrstva ?? 3;
  const limitKrokov = opts.limitKrokov || 0;
  const steps = [];
  let bad = !propaguj(J, s, false, null);
  while (!bad) {
    let prazdne = false;
    for (const i of J.biele) if (!s.val[i]) { prazdne = true; break; }
    if (!prazdne) break;
    const k = vrstva1(J, s) || vrstva2(J, s) || (maxVrstva >= 3 ? vrstva3(J, s) : null);
    if (!k) break;
    s.val[k.i] = k.val;
    s.cand[k.i] = 1 << k.val;
    steps.push({ rule: k.rule, layer: k.layer, cells: [{ r: (k.i / n) | 0, c: k.i % n, i: k.i, val: k.val }], text: textKroku(k, n) });
    if (limitKrokov && steps.length >= limitKrokov) break;
    if (!propaguj(J, s, false, [J.cellRuns[2 * k.i], J.cellRuns[2 * k.i + 1]])) { bad = true; break; }
  }
  let hotove = !bad;
  for (const i of J.biele) if (!s.val[i]) { hotove = false; break; }
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
/* Veta začína veľkým písmenom. */
function veta(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function popisBehu(run) {
  if (!run) return 'this run';
  const sum = run.sum == null ? 'unmarked' : String(run.sum);
  return run.dir === 'h'
    ? 'the ' + sum + ' across in row ' + (run.r + 1) + ' from column ' + (run.c + 1)
    : 'the ' + sum + ' down in column ' + (run.c + 1) + ' from row ' + (run.r + 1);
}
function polohaBunky(i, n) {
  return 'row ' + (((i / n) | 0) + 1) + ', column ' + ((i % n) + 1);
}

function textKroku(k, n) {
  const kde = polohaBunky(k.i, n);
  switch (k.rule) {
    case 'last-in-run':
      return 'In ' + popisBehu(k.run) + ' only one hollow is still empty, and the others already hold ' +
        k.sucet + ', so the hollow in ' + kde + ' holds ' + k.val + '.';
    case 'single-combo':
      return veta(popisBehu(k.run)) + ' can only be made of ' + zoznamCislic(k.mnozina) +
        ', and with what the crossing run allows, the hollow in ' + kde + ' can only be ' + k.val + '.';
    case 'naked-single':
      return veta(popisBehu(k.run)) + ' and ' + popisBehu(k.run2) + ' cross in ' + kde +
        ', and only one number fits both of them there, so that hollow holds ' + k.val + '.';
    case 'hidden-single':
      return veta(popisBehu(k.run)) + ' has to use a ' + k.val +
        ', and the hollow in ' + kde + ' is the only one of that run where a ' + k.val + ' still fits.';
    case 'pair':
      return 'Two hollows of ' + popisBehu(k.run) + ' can hold only ' + zoznamCislic(k.dvojica) +
        ' between them, so no other hollow of that run can take those numbers, which leaves ' +
        k.val + ' for the hollow in ' + kde + '.';
    case 'run-sum':
      return 'In ' + popisBehu(k.run) + ' every way of making the total out of what the crossing runs still allow in its other hollows leaves the same number here, so the hollow in ' +
        kde + ' holds ' + k.val + '.';
    case 'trial':
      return 'Writing ' + zoznamCislic(k.zle, 'or') + ' into the hollow in ' + kde +
        ' runs into a contradiction in the runs around it, so that hollow holds ' + k.val + '.';
    default:
      return 'The hollow in ' + kde + ' holds ' + k.val + '.';
  }
}

/* ── Denný les ───────────────────────────────────────────────────────── *
 * generate(dateStr, opts) picks n (default 8) and calls generateSeeded with
 * the date as both name and key, so every date keeps the puzzle it always
 * had. opts: n, hustota, maxAttempts (default 200). */
export function generate(dateStr, opts = {}) {
  if (!isValidDate(dateStr)) throw new Error('Date must be in YYYY-MM-DD form: ' + dateStr);
  const n = opts.n ?? 8;
  return generateSeeded(dateStr, dateStr + '/' + n, opts);
}

/* Vyplní biele políčka číslicami s návratom, bez opakovania v behu. Každý beh
   dostane náhodnú chuť: buď ťahá k nízkym, alebo k vysokým čísliciam. Súčty
   sa tým tlačia k okrajom rozsahu, a taký súčet sa dá poskladať z menej
   množín, čo je presne to, čo robí zadanie jednoznačným. Vráti ploché pole
   číslic alebo null (rozpočet uzlov vyčerpaný). */
function vyplnCislice(rng, dark, n) {
  const val = new Array(n * n).fill(0);
  const cells = new Array(n * n).fill(null);
  for (let i = 0; i < n * n; i++) if (dark[i]) cells[i] = { r: null, d: null };
  const { runs, cellRuns } = behy(cells, n);
  const chut = runs.map(() => (rng() < 0.5 ? 1 : -1));
  const used = new Int32Array(runs.length);
  const biele = [];
  for (let i = 0; i < n * n; i++) if (!dark[i]) biele.push(i);
  let uzly = 0;
  function rek(k) {
    if (k === biele.length) return true;
    if (++uzly > 200000) return false;
    const i = biele[k];
    const a = cellRuns[2 * i], b = cellRuns[2 * i + 1];
    const m = VSETKY & ~(a >= 0 ? used[a] : 0) & ~(b >= 0 ? used[b] : 0);
    const w = (a >= 0 ? chut[a] : 0) + (b >= 0 ? chut[b] : 0);
    const cifry = cislaZMasky(m).map((d) => ({ d, s: w * d + rng() * 2 }));
    cifry.sort((x, y) => x.s - y.s);
    for (const { d } of cifry) {
      const bit = 1 << d;
      if (a >= 0) used[a] |= bit;
      if (b >= 0) used[b] |= bit;
      val[i] = d;
      if (rek(k + 1)) return true;
      if (a >= 0) used[a] &= ~bit;
      if (b >= 0) used[b] &= ~bit;
      val[i] = 0;
    }
    return false;
  }
  return rek(0) ? val : null;
}

/* Číslice, ktoré sa dajú napísať do políčka i bez opakovania v jeho
   vodorovnom a zvislom behu (pri terajšom vyplnení v). */
function volneCislice(dark, v, i, n) {
  const r = (i / n) | 0, c = i % n;
  let m = VSETKY;
  for (let cc = c - 1; cc >= 0 && !dark[r * n + cc]; cc--) m &= ~(1 << v[r * n + cc]);
  for (let cc = c + 1; cc < n && !dark[r * n + cc]; cc++) m &= ~(1 << v[r * n + cc]);
  for (let rr = r - 1; rr >= 0 && !dark[rr * n + c]; rr--) m &= ~(1 << v[rr * n + c]);
  for (let rr = r + 1; rr < n && !dark[rr * n + c]; rr++) m &= ~(1 << v[rr * n + c]);
  return m & VSETKY;
}

/* Dotiahne vyplnenie k jedinému riešeniu. Kým riešiteľ nájde dve riešenia,
   vezme políčko, v ktorom sa tie dve líšia, a napíše doň inú číslicu. Súčty
   sa čítajú z vyplnenia, takže každá taká zmena je zase platné zadanie, len
   s inými indíciami, a tú konkrétnu dvojznačnosť ruší. Vráti
   { solution, cells, kol } alebo null, keď sa to za `kol` kôl nepodarilo.

   Odchýlka od ops/spec-squirrels.md (riadok 28), priznaná: spec hovorí
   „jednoznačnosť sa overí riešiteľom, kandidát bez jednoznačnosti sa zahodí".
   Doslovné zahadzovanie tu nefunguje: náhodné vyplnenie dá jednoznačné
   zadanie prakticky nikdy (odmerané 0 z 240 pokusov naprieč veľkosťami a
   hustotami), takže kandidát sa najprv opravuje a zahodí sa až vtedy, keď sa
   oprava nepodarí (návrat null). Záruka, ktorú spec chce, ostáva rovnaká:
   vracia sa len vyplnenie, o ktorom solve(limit 2) povedal count === 1. */
function opravNaJednoznacne(rng, dark, val, n, kolMax, maxNodes) {
  const v = val.slice();
  for (let t = 0; t < kolMax; t++) {
    const cells = cluesFromSolution(dark, v, n);
    const r = solve(cells, n, { limit: 2, maxNodes });
    if (r.vycerpane || r.count === 0) return null;
    if (r.count === 1) return { solution: v, cells, kol: t };
    const A = r.solutions[0], B = r.solutions[1];
    const rozdiel = [];
    for (let i = 0; i < n * n; i++) if (!dark[i] && A[i] !== B[i]) rozdiel.push(i);
    if (!rozdiel.length) return null;
    const i = rozdiel[Math.floor(rng() * rozdiel.length)];
    const cifry = cislaZMasky(volneCislice(dark, v, i, n)).filter((d) => d !== v[i]);
    if (!cifry.length) continue;
    v[i] = cifry[Math.floor(rng() * cifry.length)];
  }
  return null;
}

/* Číslice pre políčka, ktoré sa práve zmenili z tmavých na biele: taká, ktorá
   sa neopakuje vo svojom novom vodorovnom ani zvislom behu. Vráti nové
   riešenie alebo null. */
function doplnCislice(rng, dark, solution, nove, n) {
  const s = solution.slice();
  for (const i of nove) s[i] = 0;
  for (const i of nove) {
    const cifry = cislaZMasky(volneCislice(dark, s, i, n));
    if (!cifry.length) return null;
    s[i] = cifry[Math.floor(rng() * cifry.length)];
  }
  return s;
}

function rovnake(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/* The same as generate, but the random seed comes from `key` (any string) and
 * `name` is only stored in the result as `date`. Practice puzzles and the
 * daily candidates use it. Deterministic: the same key gives the same puzzle.
 * Returns { date, n, cells, solution, seed, attempts,
 * difficulty:{ layers:{1,2,3}, trunks, odobrate, steps }, ms }, where
 * `odobrate` is how many trunks the minimising pass managed to turn into
 * hollows. */
export function generateSeeded(name, key, opts = {}) {
  const n = opts.n ?? 8;
  const maxAttempts = opts.maxAttempts ?? 200;
  const maxVrstva = opts.maxVrstva ?? 3;
  // Strop na vetvenie pri kontrole jednoznačnosti. Bez neho sa riešiteľ na
  // veľmi voľnom zadaní zamotá na dlhé sekundy; s ním sa také odobratie
  // políčka proste neprijme. Strop je pevný, takže zadanie ostáva pre daný
  // kľúč vždy rovnaké.
  const maxNodes = opts.maxNodes ?? 30000;
  const kolOpravy = opts.kolOpravy ?? 300;
  const t0 = nowMs();
  const seed = seedFromString(key);
  const rng = mulberry32(seed);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const hustota = opts.hustota ?? (0.25 + rng() * 0.1);
    const dark = randomVzor(rng, n, hustota);
    if (!dark) continue;
    const prve = vyplnCislice(rng, dark, n);
    if (!prve) continue;
    const opravene = opravNaJednoznacne(rng, dark, prve, n, kolOpravy, maxNodes);
    if (!opravene) continue;
    let solution = opravene.solution;
    let cells = opravene.cells;
    const uvod = solveHuman(cells, n, { maxVrstva });
    if (!uvod.solved || !rovnake(uvod.solution, solution)) continue;

    // Minimalizácia: bodovo symetrická dvojica tmavých políčok sa zmení na
    // dutiny (dva súčty preč, dva behy sa spoja), keď zadanie ostane
    // jednoznačné aj ľudsky riešiteľné.
    let odobrate = 0;
    for (const i of zamiesaj(rng, n * n)) {
      if (!dark[i]) continue;
      const r = (i / n) | 0, c = i % n;
      if (r === 0 || c === 0) continue;
      const j = partner(i, n);
      if (!dark[j]) continue;
      dark[i] = 0; dark[j] = 0;
      let ok = false;
      if (platnyVzor(dark, n, true)) {
        // Nové dutiny treba čímsi naplniť. Skúsi sa niekoľko číslic, lebo
        // jednu a tú istú dvojicu dutín vie zachrániť aj len jedna z nich.
        for (let pokus = 0; pokus < 3 && !ok; pokus++) {
          const novy = doplnCislice(rng, dark, solution, i === j ? [i] : [i, j], n);
          if (!novy) break;
          const noveCells = cluesFromSolution(dark, novy, n);
          const h = solveHuman(noveCells, n, { maxVrstva });
          if (!h.solved || !rovnake(h.solution, novy)) continue;
          const r2 = solve(noveCells, n, { limit: 2, maxNodes });
          if (r2.vycerpane || r2.count !== 1) continue;
          solution = novy; cells = noveCells; odobrate += i === j ? 1 : 2; ok = true;
        }
      }
      if (!ok) { dark[i] = 1; dark[j] = 1; }
    }

    const fin = solveHuman(cells, n, { maxVrstva });
    if (!fin.solved || !rovnake(fin.solution, solution)) {
      throw new Error('solveHuman settled on a different filling than the source for ' + name);
    }
    let trunks = 0;
    for (let i = 0; i < n * n; i++) if (dark[i]) trunks++;
    return {
      date: name, n, cells, solution, seed, attempts: attempt,
      difficulty: { layers: fin.layersUsed, trunks, odobrate, steps: fin.steps.length },
      ms: Math.round((nowMs() - t0) * 10) / 10,
    };
  }
  throw new Error('No unique, guess-free puzzle for ' + name + ' in ' + maxAttempts + ' attempts');
}
