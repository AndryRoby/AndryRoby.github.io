/* Hviezdy: generátor a riešiteľ denného zadania.
 *
 * Jeden súbor bez závislostí, ktorý beží rovnako v Node aj v prehliadači
 * (hviezdy.js ho importuje ako modul, tests.mjs tiež). Všetko je deterministické:
 * z dátumu vznikne číslo, z čísla postupnosť náhodných hodnôt, z nej zadanie.
 * Ten istý dátum dá na každom počítači to isté zadanie, takže server nič
 * nemusí počítať ani ukladať.
 *
 * Pravidlá hry (naše vlastné znenie): do mriežky n × n sa kladú hviezdy tak,
 * aby každý riadok, každý stĺpec a každá oblasť mali presne `stars` hviezd
 * a žiadne dve hviezdy sa nedotýkali, ani rohom.
 *
 * Postup generovania (generate):
 *   1. náhodne rozlož platné riešenie (hviezdy, ktoré sa nedotýkajú),
 *   2. z hviezd nechaj rásť oblasti, kým nie je mriežka plná (makeRegions),
 *   3. kým má zadanie viac riešení, presuň jednu bunku cudzieho riešenia do
 *      susednej oblasti (repair); zámer ostáva platný, cudzie riešenie padne,
 *   4. over riešiteľom, že zadanie má PRESNE jedno riešenie (solve),
 *   5. prijmi len zadanie, ktoré sa dá vyriešiť úvahou bez hádania (deduce)
 *      a ktoré nie je triviálne.
 * Rozloženie mriežky je vždy naše vlastné, nikdy prevzaté.
 *
 * Dve miery obtiažnosti, obe vrátené v `difficulty`:
 *   placements  koľko hviezd naivný riešiteľ (riadok po riadku, zľava
 *               doprava, bez predvídania) položil ZBYTOČNE, kým prehľadal
 *               celý strom a dokázal jedinečnosť; teda všetky položenia
 *               mínus n × stars položení samotného riešenia. Nula znamená,
 *               že každý riadok mal len jedinú možnosť. Hrubá miera práce
 *               stroja, nie človeka: nameraný rozptyl 78 až 700 pri
 *               zadaniach, ktoré človek rieši rovnako ľahko.
 *   level       najvyššie pravidlo úvahy, ktoré bolo pri riešení potrebné
 *               (1 jediný kandidát, 2 oblasť v jednom riadku alebo stĺpci
 *               a spoloční susedia, 3 dve alebo tri oblasti v dvoch alebo
 *               troch riadkoch). Len pre jednu hviezdu na oblasť.
 *   steps       počet krokov úvahy.
 * Prijíma sa zadanie s level >= 2 (aspoň jeden krok, ktorý nie je len
 * doplnenie jediného voľného políčka) a placements >= 3 × n × stars.
 * Presné hodnoty a meranie: ops/experiments/sandbox/G-001-hviezdy.md.
 */

/* Mulberry32: malý a rýchly generátor pseudonáhodných čísel so 32-bitovým
   stavom. Vracia čísla v intervale [0, 1). */
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

/* FNV-1a, 32 bitov: z reťazca spraví číslo pre mulberry32. */
export function seedFromString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/* Overí tvar YYYY-MM-DD a to, že dátum existuje (2026-02-30 neprejde). */
export function isValidDate(s) {
  const m = DATE_RE.exec(String(s));
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1) return false;
  const priestupny = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dni = [31, priestupny ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= dni[mo - 1];
}

/* Dnešný dátum v Bratislave ako YYYY-MM-DD. Švédske locale dáva ISO tvar
   priamo; keď Intl chýba alebo časové pásmo nepozná, vezme sa miestny čas. */
export function todayBratislava(now = new Date()) {
  try {
    const s = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
    if (isValidDate(s)) return s;
  } catch (e) { /* padáme na miestny čas */ }
  const p = (x) => String(x).padStart(2, '0');
  return now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate());
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

/* Susedia cez hranu (index v plochom poli). */
function neighbours4(i, n) {
  const r = (i / n) | 0, c = i % n;
  const out = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}

/* Dotýkajú sa dve bunky (aj rohom)? */
function touches8(a, b, n) {
  const dr = Math.abs(((a / n) | 0) - ((b / n) | 0)), dc = Math.abs((a % n) - (b % n));
  return a !== b && dr <= 1 && dc <= 1;
}

/* Dotýka sa stĺpec c niektorej hviezdy v predchádzajúcom riadku? */
function touchesPrev(prev, c) {
  for (let i = 0; i < prev.length; i++) {
    const d = prev[i] - c;
    if (d >= -1 && d <= 1) return true;
  }
  return false;
}

/* Náhodné platné rozloženie hviezd bez ohľadu na oblasti: každý riadok
   a stĺpec má `stars` hviezd a žiadne dve sa nedotýkajú. Vracia pole
   riadkov, každý riadok je zoradené pole stĺpcov. Náhodnosť je len
   v poradí, v akom sa skúšajú kandidáti; návrat späť zaručuje výsledok. */
export function randomSolution(n, stars, rng) {
  const colCount = new Array(n).fill(0);
  const rows = [];
  function pick(r, from, chosen) {
    if (chosen.length === stars) {
      rows[r] = chosen.slice();
      if (r === n - 1 || pick(r + 1, 0, [])) return true;
      rows.length = r;
      return false;
    }
    const prev = r > 0 ? rows[r - 1] : [];
    const cands = [];
    for (let c = from; c < n; c++) {
      if (colCount[c] >= stars) continue;
      if (touchesPrev(prev, c)) continue;
      cands.push(c);
    }
    shuffle(cands, rng);
    for (const c of cands) {
      chosen.push(c); colCount[c]++;
      if (pick(r, c + 2, chosen)) return true;
      chosen.pop(); colCount[c]--;
    }
    return false;
  }
  if (!pick(0, 0, [])) throw new Error('Rozloženie hviezd pre n=' + n + ', stars=' + stars + ' neexistuje.');
  return rows;
}

/* Rast oblastí. Každá oblasť začína v jednom semene a v každom kroku si jedna
   z oblastí, ktoré ešte majú voľného suseda, pripojí jednu voľnú bunku.
   Menšie oblasti majú prednosť (bias cez rng() na druhú), aby nevznikla
   jedna obria oblasť a sedem drobných. Každá oblasť je súvislá (rastie len
   cez hrany) a všetky bunky sú pridelené, lebo mriežka je súvislá a kým je
   voľná bunka, niektorá oblasť ju má za suseda.
 *
 * makeRegions(n)                  n oblastí z náhodných semien
 * makeRegions(n, rng, seeds)      oblasti zo zadaných semien [{r, c}, ...]
 * Vracia pole n polí s číslom oblasti pre každú bunku. Čísla sú 0 .. k-1
 * v poradí prvého výskytu po riadkoch. */
export function makeRegions(n, rng = mulberry32(1), seeds) {
  if (!Number.isInteger(n) || n < 2) throw new Error('n musí byť celé číslo aspoň 2');
  const grid = new Int16Array(n * n).fill(-1);
  let seedCells;
  if (seeds && seeds.length) {
    seedCells = seeds.map((s) => s.r * n + s.c);
  } else {
    const all = [];
    for (let i = 0; i < n * n; i++) all.push(i);
    shuffle(all, rng);
    seedCells = all.slice(0, n);
  }
  const k = seedCells.length;
  const members = [];
  for (let g = 0; g < k; g++) {
    if (grid[seedCells[g]] !== -1) throw new Error('Dve semená v tej istej bunke');
    grid[seedCells[g]] = g;
    members.push([seedCells[g]]);
  }
  let free = n * n - k;
  const frontierOf = (g) => {
    const out = [];
    for (const cell of members[g]) for (const x of neighbours4(cell, n)) if (grid[x] === -1) out.push(x);
    return out;
  };
  while (free > 0) {
    const cands = [];
    for (let g = 0; g < k; g++) {
      const f = frontierOf(g);
      if (f.length) cands.push({ g, f });
    }
    if (!cands.length) throw new Error('Nemá kam rásť, hoci ostali voľné bunky');
    cands.sort((a, b) => members[a.g].length - members[b.g].length);
    const x = rng();
    const pick = cands[Math.floor(x * x * cands.length)];
    const cell = pick.f[Math.floor(rng() * pick.f.length)];
    grid[cell] = pick.g;
    members[pick.g].push(cell);
    free--;
  }
  return relabel(grid, n);
}

/* Prečísluje oblasti v poradí prvého výskytu po riadkoch a vráti pole polí. */
function relabel(flat, n) {
  const map = new Map();
  const out = [];
  for (let r = 0; r < n; r++) {
    const row = [];
    for (let c = 0; c < n; c++) {
      const g = flat[r * n + c];
      if (!map.has(g)) map.set(g, map.size);
      row.push(map.get(g));
    }
    out.push(row);
  }
  return out;
}

/* Spojí po `k` susediacich oblastí do jednej, kým nezostane presne m / k
   oblastí. Používa sa pri viac ako jednej hviezde na oblasť: oblasti sa
   nechajú vyrásť z každej hviezdy zvlášť (n × stars malých oblastí) a potom
   sa zlepia po `stars` kusoch. Zlepenie súvislých susediacich oblastí je
   zase súvislá oblasť. Hľadá sa s návratom: vždy sa vezme prvá nezaradená
   oblasť a skúšajú sa všetky súvislé skupiny veľkosti k, ktoré ju obsahujú,
   v náhodnom poradí. Keď rozpis neexistuje alebo sa minie rozpočet krokov,
   vráti null a volajúci skúsi nový rast. */
export function mergeRegions(regions, k, rng = mulberry32(1), budget = 20000) {
  const n = regions.length;
  let m = 0;
  for (const row of regions) for (const g of row) if (g + 1 > m) m = g + 1;
  if (m % k !== 0) return null;
  const adj = Array.from({ length: m }, () => new Set());
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const g = regions[r][c];
    if (r > 0 && regions[r - 1][c] !== g) { adj[g].add(regions[r - 1][c]); adj[regions[r - 1][c]].add(g); }
    if (c > 0 && regions[r][c - 1] !== g) { adj[g].add(regions[r][c - 1]); adj[regions[r][c - 1]].add(g); }
  }
  const group = new Array(m).fill(-1);
  let steps = 0;

  // Všetky súvislé skupiny veľkosti k z nezaradených oblastí, ktoré obsahujú `start`.
  function groupsFrom(start) {
    const out = [];
    const cur = [start];
    const inCur = new Set(cur);
    function grow() {
      if (cur.length === k) { out.push(cur.slice()); return; }
      const cands = new Set();
      for (const a of cur) for (const b of adj[a]) if (group[b] === -1 && !inCur.has(b) && b > start) cands.add(b);
      for (const b of cands) {
        cur.push(b); inCur.add(b);
        grow();
        cur.pop(); inCur.delete(b);
      }
    }
    grow();
    const uniq = new Map();
    for (const g of out) uniq.set(g.slice().sort((a, b) => a - b).join(','), g);
    return shuffle([...uniq.values()], rng);
  }
  function assign(next) {
    if (++steps > budget) return false;
    let start = -1;
    for (let g = 0; g < m; g++) if (group[g] === -1) { start = g; break; }
    if (start === -1) return true;
    for (const grp of groupsFrom(start)) {
      for (const g of grp) group[g] = next;
      if (assign(next + 1)) return true;
      for (const g of grp) group[g] = -1;
      if (steps > budget) return false;
    }
    return false;
  }
  if (!assign(0)) return null;
  const flat = new Int16Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) flat[r * n + c] = group[regions[r][c]];
  return relabel(flat, n);
}

/* Počet oblastí a veľkosť najmenšej a najväčšej z nich. */
export function regionStats(regions) {
  const sizes = new Map();
  for (const row of regions) for (const g of row) sizes.set(g, (sizes.get(g) || 0) + 1);
  let min = Infinity, max = 0;
  for (const s of sizes.values()) { if (s < min) min = s; if (s > max) max = s; }
  return { count: sizes.size, min, max };
}

/* Je každá oblasť súvislá (cez hrany) a je každá bunka pridelená? */
export function regionsConnected(regions) {
  const n = regions.length;
  if (!n) return false;
  const seen = new Uint8Array(n * n);
  const startOf = new Map();
  for (let r = 0; r < n; r++) {
    if (!Array.isArray(regions[r]) || regions[r].length !== n) return false;
    for (let c = 0; c < n; c++) {
      const g = regions[r][c];
      if (!Number.isInteger(g) || g < 0) return false;
      if (!startOf.has(g)) startOf.set(g, r * n + c);
    }
  }
  for (const [g, start] of startOf) {
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const cell = stack.pop();
      for (const x of neighbours4(cell, n)) {
        if (!seen[x] && regions[(x / n) | 0][x % n] === g) { seen[x] = 1; stack.push(x); }
      }
    }
  }
  for (let i = 0; i < n * n; i++) if (!seen[i]) return false;
  return true;
}

/* Koľko buniek ostane oblasti g po odobratí bunky x, ak ostane súvislá;
   0, ak by sa rozpadla alebo vyprázdnila. */
function sizeWithout(regions, g, x) {
  const n = regions.length;
  let start = -1, total = 0;
  for (let i = 0; i < n * n; i++) {
    if (i !== x && regions[(i / n) | 0][i % n] === g) { total++; if (start < 0) start = i; }
  }
  if (total === 0) return 0;
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const cell = stack.pop();
    for (const y of neighbours4(cell, n)) {
      if (y !== x && !seen.has(y) && regions[(y / n) | 0][y % n] === g) { seen.add(y); stack.push(y); }
    }
  }
  return seen.size === total ? total : 0;
}

/* Prípustné presuny: bunka i (nie hviezda zámeru) do susednej cudzej oblasti
   tak, aby jej pôvodná oblasť ostala súvislá a mala aspoň minSize buniek. */
function movesFor(regions, cells, intended, minSize) {
  const n = regions.length;
  const out = [];
  for (const i of cells) {
    if (intended[i] === 1) continue;
    const g = regions[(i / n) | 0][i % n];
    const others = new Set();
    for (const y of neighbours4(i, n)) {
      const h = regions[(y / n) | 0][y % n];
      if (h !== g) others.add(h);
    }
    if (!others.size) continue;
    if (sizeWithout(regions, g, i) < minSize) continue;
    for (const h of others) out.push({ i, h });
  }
  return out;
}

/* Oprava viacznačného zadania. Kým riešiteľ nájde druhé riešenie, vezme
   z neho hviezdu, ktorá nie je hviezdou zámeru, a presunie tú bunku do
   susednej oblasti. Tým to druhé riešenie určite padne (jeho oblasť by mala
   o hviezdu viac a pôvodná o hviezdu menej) a zámer ostáva platný (jeho
   hviezdy sa nehýbu). Keď taký presun nie je možný, presunie sa ľubovoľná
   hraničná bunka. Mení `regions` na mieste. Vracia { ok, steps }. */
export function repair(regions, intended, stars, rng, opts = {}) {
  const n = regions.length;
  const maxSteps = opts.maxSteps ?? 300;
  const minSize = opts.minRegionSize ?? 2 * stars;
  const intendedKey = intended.join('');
  for (let steps = 0; steps < maxSteps; steps++) {
    const res = solve(regions, stars, { limit: 2 });
    if (res.solutions.length === 1) return { ok: true, steps };
    if (res.solutions.length === 0) return { ok: false, steps };
    const alt = res.solutions.find((s) => s.join('') !== intendedKey) || res.solutions[1];
    const altCells = [];
    for (let i = 0; i < n * n; i++) if (alt[i] === 1) altCells.push(i);
    let cands = movesFor(regions, altCells, intended, minSize);
    if (!cands.length) {
      const all = [];
      for (let i = 0; i < n * n; i++) all.push(i);
      cands = movesFor(regions, all, intended, minSize);
    }
    if (!cands.length) return { ok: false, steps };
    const m = cands[Math.floor(rng() * cands.length)];
    regions[(m.i / n) | 0][m.i % n] = m.h;
  }
  return { ok: false, steps: maxSteps };
}

/* Riešiteľ. Prehľadáva riadok po riadku, v riadku zľava doprava, a kladie
   hviezdu len tam, kde stĺpec aj oblasť ešte majú miesto a kde sa nedotkne
   hviezdy z predchádzajúceho riadka (v rámci riadka drží rozostup 2).
   Keď je riadok hotový, skontroluje oblasti, ktoré ním končia: musia byť
   plné. Nič iné nepredvída, preto je to naivný riešiteľ a jeho práca sa
   dá použiť ako miera práce stroja.
 *
 * solve(regions, stars, {limit})
 *   limit   po koľkých nájdených riešeniach prestať (predvolené 2: stačí
 *           na dôkaz jedinečnosti a netreba prehľadať všetko)
 * Vracia { solutions, placements, complete }:
 *   solutions   pole riešení, každé ako ploché pole n·n núl a jednotiek
 *   placements  koľkokrát riešiteľ položil hviezdu
 *   complete    true, ak prehľadal celý strom (solutions je úplný zoznam) */
export function solve(regions, stars = 1, opts = {}) {
  const limit = opts.limit ?? 2;
  const n = regions.length;
  const reg = new Int16Array(n * n);
  let m = 0;
  for (let r = 0; r < n; r++) {
    if (!Array.isArray(regions[r]) || regions[r].length !== n) throw new Error('Oblasti musia byť n × n');
    for (let c = 0; c < n; c++) {
      reg[r * n + c] = regions[r][c];
      if (regions[r][c] + 1 > m) m = regions[r][c] + 1;
    }
  }
  const lastRow = new Int16Array(m).fill(-1);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) lastRow[reg[r * n + c]] = r;
  const closing = Array.from({ length: n }, () => []);
  for (let g = 0; g < m; g++) if (lastRow[g] >= 0) closing[lastRow[g]].push(g);

  const colCount = new Int8Array(n);
  const regCount = new Int8Array(m);
  const cur = Array.from({ length: n }, () => []);
  const solutions = [];
  let placements = 0;
  let stopped = false;

  // Počet oblastí musí byť n, inak celkový počet hviezd nesedí a riešenie neexistuje.
  if (m !== n) return { solutions, placements, complete: true };

  function rowDone(r) {
    const cl = closing[r];
    for (let i = 0; i < cl.length; i++) if (regCount[cl[i]] !== stars) return false;
    if (r === n - 1) {
      const flat = new Array(n * n).fill(0);
      for (let rr = 0; rr < n; rr++) for (const c of cur[rr]) flat[rr * n + c] = 1;
      solutions.push(flat);
      if (solutions.length >= limit) { stopped = true; return true; }
      return false;
    }
    return placeRow(r + 1, 0, 0);
  }
  function placeRow(r, from, k) {
    if (k === stars) return rowDone(r);
    const prev = r > 0 ? cur[r - 1] : null;
    const last = n - 1 - 2 * (stars - k - 1);
    const row = cur[r];
    for (let c = from; c <= last; c++) {
      if (colCount[c] >= stars) continue;
      const g = reg[r * n + c];
      if (regCount[g] >= stars) continue;
      if (prev && touchesPrev(prev, c)) continue;
      colCount[c]++; regCount[g]++; row.push(c); placements++;
      const stop = placeRow(r, c + 2, k + 1);
      row.pop(); colCount[c]--; regCount[g]--;
      if (stop) return true;
    }
    return false;
  }
  placeRow(0, 0, 0);
  return { solutions, placements, complete: !stopped };
}

/* Riešenie úvahou, tak ako rieši človek, len pre jednu hviezdu na oblasť.
   Každé políčko je neznáme, vylúčené alebo hviezda. Pravidlá v poradí, ako
   sa skúšajú (vždy sa použije prvé, ktoré niečo zmení):
 *   1  jediný kandidát: riadok, stĺpec alebo oblasť bez hviezdy má už len
 *      jedno neznáme políčko, tam je hviezda; hviezda vylúči svoj riadok,
 *      stĺpec, oblasť a všetkých ôsmich susedov
 *   2  oblasť v jednom riadku (stĺpci): jej hviezda je tam, ostatné políčka
 *      riadka (stĺpca) sú vylúčené; obrátene riadok (stĺpec) v jednej
 *      oblasti vylúči zvyšok oblasti; spoloční susedia: políčko, ktoré sa
 *      dotýka každého kandidáta nejakej jednotky, hviezdu mať nemôže
 *   3  dve alebo tri oblasti, ktorých kandidáti ležia v dvoch alebo troch
 *      riadkoch (stĺpcoch), tie riadky obsadia, ostatné políčka riadkov sú
 *      vylúčené; a obrátene pre riadky (stĺpce) v dvoch alebo troch oblastiach
 * Vracia { supported, solved, level, steps, used, grid }. Ak pravidlá nestačia,
 * solved je false: zadanie by vyžadovalo hádanie alebo hlbšiu úvahu. */
export function deduce(regions, stars = 1) {
  if (stars !== 1) return { supported: false, solved: false, level: 0, steps: 0, used: {}, grid: null };
  const n = regions.length;
  const reg = new Int16Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) reg[r * n + c] = regions[r][c];
  const st = new Int8Array(n * n); // 0 neznáme, 1 vylúčené, 2 hviezda
  const regCells = Array.from({ length: n }, () => []);
  for (let i = 0; i < n * n; i++) {
    if (reg[i] < 0 || reg[i] >= n) return { supported: true, solved: false, level: 0, steps: 0, used: {}, grid: null };
    regCells[reg[i]].push(i);
  }
  const rows = [], cols = [], regs = [];
  for (let r = 0; r < n; r++) rows.push({ kind: 'row', idx: r, cells: Array.from({ length: n }, (_, c) => r * n + c) });
  for (let c = 0; c < n; c++) cols.push({ kind: 'col', idx: c, cells: Array.from({ length: n }, (_, r) => r * n + c) });
  for (let g = 0; g < n; g++) regs.push({ kind: 'reg', idx: g, cells: regCells[g] });
  const units = [...rows, ...cols, ...regs];
  const lines = [...rows, ...cols];

  let stars_ = 0, steps = 0, level = 0;
  const used = {};
  const excl = (i) => { if (st[i] === 0) { st[i] = 1; return true; } return false; };
  function star(i) {
    st[i] = 2; stars_++;
    const r = (i / n) | 0, c = i % n;
    for (let k = 0; k < n; k++) { if (k !== c) excl(r * n + k); if (k !== r) excl(k * n + c); }
    for (const x of regCells[reg[i]]) if (x !== i) excl(x);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && rr < n && cc >= 0 && cc < n) excl(rr * n + cc);
    }
  }
  const hasStar = (u) => u.cells.some((i) => st[i] === 2);
  const unknown = (u) => u.cells.filter((i) => st[i] === 0);
  const note = (lv, name) => { steps++; if (lv > level) level = lv; used[name] = (used[name] || 0) + 1; };
  const combos = (arr, k, start = 0, cur = [], out = []) => {
    if (cur.length === k) { out.push(cur.slice()); return out; }
    for (let i = start; i < arr.length; i++) { cur.push(arr[i]); combos(arr, k, i + 1, cur, out); cur.pop(); }
    return out;
  };

  function ruleSingle() {
    for (const u of units) {
      if (hasStar(u)) continue;
      const c = unknown(u);
      if (c.length === 0) return 'contradiction';
      if (c.length === 1) { star(c[0]); note(1, 'single'); return true; }
    }
    return false;
  }
  function ruleRegionInLine() {
    for (const g of regs) {
      if (hasStar(g)) continue;
      const c = unknown(g);
      const rs = new Set(c.map((i) => (i / n) | 0)), cs = new Set(c.map((i) => i % n));
      if (rs.size === 1) {
        const r = [...rs][0];
        let ch = false;
        for (let k = 0; k < n; k++) { const i = r * n + k; if (reg[i] !== g.idx && excl(i)) ch = true; }
        if (ch) { note(2, 'region-in-row'); return true; }
      }
      if (cs.size === 1) {
        const cc = [...cs][0];
        let ch = false;
        for (let k = 0; k < n; k++) { const i = k * n + cc; if (reg[i] !== g.idx && excl(i)) ch = true; }
        if (ch) { note(2, 'region-in-col'); return true; }
      }
    }
    return false;
  }
  function ruleLineInRegion() {
    for (const u of lines) {
      if (hasStar(u)) continue;
      const c = unknown(u);
      const gs = new Set(c.map((i) => reg[i]));
      if (gs.size !== 1) continue;
      const g = [...gs][0];
      const inLine = new Set(u.cells);
      let ch = false;
      for (const i of regCells[g]) if (!inLine.has(i) && excl(i)) ch = true;
      if (ch) { note(2, 'line-in-region'); return true; }
    }
    return false;
  }
  function ruleTouchAll() {
    for (const u of units) {
      if (hasStar(u)) continue;
      const c = unknown(u);
      if (c.length > 4) continue;
      let ch = false;
      for (let x = 0; x < n * n; x++) {
        if (st[x] !== 0 || c.includes(x)) continue;
        if (c.every((i) => touches8(i, x, n))) { if (excl(x)) ch = true; }
      }
      if (ch) { note(2, 'touch-all'); return true; }
    }
    return false;
  }
  function ruleSets(k) {
    const freeRegs = regs.filter((g) => !hasStar(g));
    for (const combo of combos(freeRegs, k)) {
      const cells = combo.flatMap(unknown);
      const rs = new Set(cells.map((i) => (i / n) | 0)), cs = new Set(cells.map((i) => i % n));
      const gset = new Set(combo.map((g) => g.idx));
      if (rs.size === k) {
        let ch = false;
        for (const r of rs) for (let cc = 0; cc < n; cc++) { const i = r * n + cc; if (!gset.has(reg[i]) && excl(i)) ch = true; }
        if (ch) { note(3, 'regions-in-rows-' + k); return true; }
      }
      if (cs.size === k) {
        let ch = false;
        for (const cc of cs) for (let r = 0; r < n; r++) { const i = r * n + cc; if (!gset.has(reg[i]) && excl(i)) ch = true; }
        if (ch) { note(3, 'regions-in-cols-' + k); return true; }
      }
    }
    for (const family of [rows, cols]) {
      const freeLines = family.filter((u) => !hasStar(u));
      for (const combo of combos(freeLines, k)) {
        const cells = combo.flatMap(unknown);
        const gs = new Set(cells.map((i) => reg[i]));
        if (gs.size !== k) continue;
        const inLines = new Set(combo.flatMap((u) => u.cells));
        let ch = false;
        for (const g of gs) for (const i of regCells[g]) if (!inLines.has(i) && excl(i)) ch = true;
        if (ch) { note(3, 'lines-in-regions-' + k); return true; }
      }
    }
    return false;
  }

  while (stars_ < n) {
    const s = ruleSingle();
    if (s === 'contradiction') return { supported: true, solved: false, contradiction: true, level, steps, used, grid: null };
    if (s) continue;
    if (ruleRegionInLine()) continue;
    if (ruleLineInRegion()) continue;
    if (ruleTouchAll()) continue;
    if (ruleSets(2)) continue;
    if (ruleSets(3)) continue;
    break;
  }
  const grid = Array.from(st, (x) => (x === 2 ? 1 : 0));
  return { supported: true, solved: stars_ === n, level, steps, used, grid };
}

/* Overí hotovú mriežku proti pravidlám. `grid` je ploché pole n·n, kde 1 je
   hviezda (čokoľvek iné nie je hviezda). Vracia zoznam chýb; prázdny zoznam
   znamená správne riešenie. Každá chyba má druh a index alebo bunky,
   ktorých sa týka, aby ich stránka vedela zvýrazniť. */
export function checkSolution(regions, stars, grid) {
  const n = regions.length;
  const errors = [];
  const rowC = new Array(n).fill(0), colC = new Array(n).fill(0);
  const regC = new Map();
  const starCells = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (grid[r * n + c] !== 1) continue;
    starCells.push(r * n + c);
    rowC[r]++; colC[c]++;
    const g = regions[r][c];
    regC.set(g, (regC.get(g) || 0) + 1);
  }
  for (let r = 0; r < n; r++) if (rowC[r] !== stars) errors.push({ kind: 'row', index: r, count: rowC[r] });
  for (let c = 0; c < n; c++) if (colC[c] !== stars) errors.push({ kind: 'col', index: c, count: colC[c] });
  const allRegions = new Set();
  for (const row of regions) for (const g of row) allRegions.add(g);
  for (const g of allRegions) {
    const cnt = regC.get(g) || 0;
    if (cnt !== stars) errors.push({ kind: 'region', index: g, count: cnt });
  }
  for (let i = 0; i < starCells.length; i++) for (let j = i + 1; j < starCells.length; j++) {
    if (touches8(starCells[i], starCells[j], n)) errors.push({ kind: 'touch', cells: [starCells[i], starCells[j]] });
  }
  return errors;
}

function now() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

/* Denné zadanie. Vracia { date, n, stars, regions, solution, seed, attempts,
   difficulty: { placements, level, steps }, ms }. Rovnaký dátum a rovnaké
   možnosti dajú vždy to isté.
   Možnosti: n (8), stars (1), minLevel (2), minPlacements (3 × n × stars),
   minRegionSize (2 × stars), maxAttempts (400), requireDeduction (true pri
   jednej hviezde; pri viacerých hviezdach úvahu nemáme, platí len
   jedinečnosť a minPlacements), fallback (true: keď hranice obtiažnosti
   nedosiahne žiadny pokus, vráti najlepšie jedinečné zadanie s príznakom
   fallback namiesto chyby). */
export function generate(dateStr, opts = {}) {
  if (!isValidDate(dateStr)) throw new Error('Dátum musí byť v tvare YYYY-MM-DD: ' + dateStr);
  const n = opts.n ?? 8;
  const stars = opts.stars ?? 1;
  const minLevel = opts.minLevel ?? 2;
  const minPlacements = opts.minPlacements ?? 3 * n * stars;
  const minRegionSize = opts.minRegionSize ?? 2 * stars;
  const maxAttempts = opts.maxAttempts ?? 400;
  const requireDeduction = opts.requireDeduction ?? (stars === 1);
  const t0 = now();
  const seed = seedFromString(dateStr + '/' + n + 'x' + stars);
  const rng = mulberry32(seed);
  let best = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const rows = randomSolution(n, stars, rng);
    const seeds = [];
    const flat = new Array(n * n).fill(0);
    for (let r = 0; r < n; r++) for (const c of rows[r]) { seeds.push({ r, c }); flat[r * n + c] = 1; }
    let regions = makeRegions(n, rng, seeds);
    if (stars > 1) {
      regions = mergeRegions(regions, stars, rng);
      if (!regions) continue;
    }
    const rep = repair(regions, flat, stars, rng, { minRegionSize });
    if (!rep.ok) continue;
    const st = regionStats(regions);
    if (st.count !== n || st.min < minRegionSize) continue;
    const res = solve(regions, stars, { limit: 2 });
    if (res.solutions.length !== 1) continue;
    if (res.solutions[0].join('') !== flat.join('')) throw new Error('Riešiteľ našiel iné riešenie než zámer');
    const placements = res.placements - n * stars;
    const ded = deduce(regions, stars);
    if (requireDeduction && !ded.solved) continue;
    const out = {
      date: dateStr, n, stars, regions, solution: flat, seed, attempts: attempt,
      difficulty: { placements, level: ded.supported ? ded.level : 0, steps: ded.supported ? ded.steps : 0 },
      ms: 0,
    };
    const okLevel = !requireDeduction || ded.level >= minLevel;
    if (okLevel && placements >= minPlacements) {
      out.ms = Math.round((now() - t0) * 10) / 10;
      return out;
    }
    if (!best || placements > best.difficulty.placements) best = out;
  }
  if (best && opts.fallback !== false) {
    best.fallback = true;
    best.ms = Math.round((now() - t0) * 10) / 10;
    return best;
  }
  throw new Error('Za ' + maxAttempts + ' pokusov nevzniklo vyhovujúce zadanie pre ' + dateStr);
}
