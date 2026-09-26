/* Beavers: generator and solvers for the daily pond of trees and lodges.
 *
 * One file, no dependencies, runs the same in Node and in the browser
 * (game.js imports it as a module, tests.mjs too). Everything is
 * deterministic: a date turns into a number, the number into a sequence of
 * random values, the sequence into a pond. The same date gives the same pond
 * on every machine, so the server never has to compute or store anything.
 *
 * Rules of the game (our own wording): a pond of n x n cells has trees along
 * the brook. Every tree gets one beaver lodge right beside it, above, below,
 * left or right, and each lodge belongs to one tree only, so there are as many
 * lodges as trees. Lodges never touch each other, not side by side and not
 * corner to corner. The number by each row and each column says how many
 * lodges that line holds.
 *
 * Representation. A puzzle is { n, trees, rows, cols }: `trees` the flat
 * indices of the tree cells, `rows` and `cols` the numbers. The solution is a
 * flat n*n array, 1 a lodge and 0 nothing (the trees live in `trees`, never
 * in the solution). Which lodge belongs to which tree is not stored and is not
 * part of the answer: it need not be unique (a lodge between two trees), only
 * the arrangement of lodges is. Inside the human solver the board is one
 * Int8Array `st` with the same three values the player's board uses: 0 not
 * decided, 1 a lodge, 2 grass. A tree cell stays 0 there for ever.
 *
 * Generation (generateSeeded):
 *   1. lodges first: cells in random order, a lodge wherever it touches no
 *      other lodge, not even at a corner, until the target count for the size
 *      is reached (a new attempt when the pond jams below the lower bound),
 *   2. a tree for every lodge on a random free cell beside it,
 *   3. looks: no two by two block made only of trees, at most 15 % of the
 *      numbers zero,
 *   4. uniqueness: solve() counts up to two answers; with a second answer the
 *      tree of a lodge the two answers disagree on moves to another free cell
 *      beside that lodge (the source answer stays valid, the numbers do not
 *      change), at most ten repairs per attempt,
 *   5. no guessing: solveHuman() has to finish the pond with the allowed
 *      layers of rules and land exactly on the source answer,
 *   6. a free first step: on the empty pond the first step is a real piece of
 *      reasoning (a zero line, a tree with one free cell), not the tidy up of
 *      cells with no tree beside them,
 *   7. up to `maxAttempts` attempts, then an error.
 * Nothing is taken away afterwards: the trees and every number are the whole
 * puzzle and are always shown, so there is nothing to minimise.
 *
 * Difficulty, returned as `difficulty`:
 *   layers  how many steps the human solver needed from each layer of rules
 *           (1 one rule in one place, 2 a whole line or a pairing of trees and
 *           lodges, 3 a single trial followed until a rule breaks),
 *   steps   the total number of steps,
 *   retaz   the chain lengths of all trials added up (at most MAX_RETAZ each).
 * plan.mjs ranks candidates by the trials and their chains first, then layer
 * 2, then layer 1.
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

/* ── Geometry ─────────────────────────────────────────────────────────── *
 * geometria(n) is computed once per size: s4 the four side neighbours of
 * every cell (up, down, left, right; -1 off the pond), s8 all eight cells
 * around it, lines the 2n lines, rows 0..n-1 first, then columns. */
const GEO = new Map();
export function geometria(n) {
  const hotova = GEO.get(n);
  if (hotova) return hotova;
  const C = n * n;
  const s4 = new Int16Array(4 * C).fill(-1);
  const s8 = new Int16Array(8 * C).fill(-1);
  const D4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const D8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      for (let m = 0; m < 4; m++) {
        const rr = r + D4[m][0], cc = c + D4[m][1];
        if (rr >= 0 && rr < n && cc >= 0 && cc < n) s4[4 * i + m] = rr * n + cc;
      }
      for (let m = 0; m < 8; m++) {
        const rr = r + D8[m][0], cc = c + D8[m][1];
        if (rr >= 0 && rr < n && cc >= 0 && cc < n) s8[8 * i + m] = rr * n + cc;
      }
    }
  }
  const lines = [];
  for (let r = 0; r < n; r++) lines.push(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) lines.push(Array.from({ length: n }, (_, r) => r * n + c));
  const g = { n, C, s4, s8, lines };
  GEO.set(n, g);
  return g;
}

/* The side neighbours of a cell (the cells a tree's lodge may stand on). */
export function susedia4(i, n) {
  const g = geometria(n), out = [];
  for (let m = 0; m < 4; m++) { const y = g.s4[4 * i + m]; if (y >= 0) out.push(y); }
  return out;
}
/* All eight cells around a cell (the cells a lodge must not share with another). */
export function dotyk8(i, n) {
  const g = geometria(n), out = [];
  for (let m = 0; m < 8; m++) { const y = g.s8[8 * i + m]; if (y >= 0) out.push(y); }
  return out;
}
export function policko(i, n) { const r = (i / n) | 0; return { r, c: i - r * n }; }
export function indexPolicka(r, c, n) { return r * n + c; }
/* "row 3, column 4", counted from 1, rows from the top, columns from the left. */
export function poloha(i, n) { return 'row ' + (((i / n) | 0) + 1) + ', column ' + ((i % n) + 1); }
function dotykaSa(a, b, n) {
  if (a === b) return false;
  const ra = (a / n) | 0, rb = (b / n) | 0;
  return Math.abs(ra - rb) <= 1 && Math.abs((a - ra * n) - (b - rb * n)) <= 1;
}

/* How many trees and lodges a pond of size n gets: about 0.15 to 0.18 of the
 * cells (8 x 8: 10 to 12, 10 x 10: 15 to 18, 12 x 12: 22 to 26, 14 x 14: 29
 * to 35). Random placement of lodges that may not touch jams at about three
 * quarters of the densest packing, so the upper bound stays below that. */
export function rozsahStromov(n) {
  return [Math.round(0.15 * n * n), Math.round(0.18 * n * n)];
}

/* ── Trees and lodges paired ──────────────────────────────────────────── *
 * parovanie(trees, lodges, n): the size of the largest pairing of trees with
 * lodges beside them, each tree and each lodge used at most once (Kuhn's
 * augmenting paths; at most 35 trees, cheap). A pond is right only when every
 * tree gets its own lodge: uplneParovanie. */
export function parovanie(trees, lodges, n) {
  const g = geometria(n);
  const idx = new Map();
  lodges.forEach((x, k) => idx.set(x, k));
  const adj = trees.map((t) => {
    const a = [];
    for (let m = 0; m < 4; m++) { const y = g.s4[4 * t + m]; if (y >= 0 && idx.has(y)) a.push(idx.get(y)); }
    return a;
  });
  const parL = new Int32Array(lodges.length).fill(-1);
  let videne;
  function rozsir(t) {
    for (const l of adj[t]) {
      if (videne[l]) continue;
      videne[l] = 1;
      if (parL[l] < 0 || rozsir(parL[l])) { parL[l] = t; return true; }
    }
    return false;
  }
  let velkost = 0;
  for (let t = 0; t < trees.length; t++) {
    videne = new Uint8Array(lodges.length);
    if (rozsir(t)) velkost++;
  }
  return velkost;
}
export function uplneParovanie(trees, lodges, n) {
  return trees.length === lodges.length && parovanie(trees, lodges, n) === trees.length;
}

/* ── solve: the full search, independent of the human solver ─────────── *
 * Row by row: for row r every bit pattern with exactly rows[r] lodges, no two
 * side by side, only on cells that are not a tree and have a tree beside them,
 * and not touching (even at a corner) the pattern of the row above. Pruning:
 * what a column still needs must fit in the rows left (no two lodges one
 * above the other), and a tree in row r-1 must have a lodge beside it once
 * row r is decided. At the end: the column numbers exactly and a full pairing
 * of trees and lodges. A different algorithm from solveHuman, so it is a real
 * cross-check of the human solver, not a second proof of uniqueness.
 * opts: limit (stop after this many answers, default 2), maxNodes (a budget;
 * when it runs out the result says vycerpane and the count is not to be
 * trusted). Returns { count, solution, riesenia, nodes, vycerpane }. */
const MASKY = new Map();
function popcount(x) { let c = 0; while (x) { x &= x - 1; c++; } return c; }
function maskyBezSusedov(n) {
  const hotove = MASKY.get(n);
  if (hotove) return hotove;
  const podla = [];
  for (let x = 0; x < (1 << n); x++) {
    if (x & (x >> 1)) continue;
    const p = popcount(x);
    if (!podla[p]) podla[p] = [];
    podla[p].push(x);
  }
  MASKY.set(n, podla);
  return podla;
}

export function solve(z, opts = {}) {
  const n = z.n, C = n * n;
  const limit = opts.limit ?? 2;
  const maxNodes = opts.maxNodes ?? 20000;
  const g = geometria(n);
  const out = { count: 0, solution: null, riesenia: [], nodes: 0, vycerpane: false };
  const T = z.trees.length;
  let sr = 0, sc = 0;
  for (let r = 0; r < n; r++) sr += z.rows[r];
  for (let c = 0; c < n; c++) sc += z.cols[c];
  if (sr !== T || sc !== T) return out;

  const isTree = new Uint8Array(C);
  for (const t of z.trees) isTree[t] = 1;
  const kand = new Int32Array(n), stromy = new Int32Array(n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      if (isTree[i]) { stromy[r] |= 1 << c; continue; }
      for (let m = 0; m < 4; m++) { const y = g.s4[4 * i + m]; if (y >= 0 && isTree[y]) { kand[r] |= 1 << c; break; } }
    }
  }
  const podla = maskyBezSusedov(n);
  const vzory = [];
  for (let r = 0; r < n; r++) {
    const zoz = podla[z.rows[r]] || [];
    const moze = zoz.filter((m) => (m & ~kand[r]) === 0);
    if (!moze.length) return out;
    vzory.push(moze);
  }
  // capS[r][c]: the most lodges column c can still take in rows r..n-1
  // (candidate cells only, never two one above the other)
  const capS = new Int16Array((n + 2) * n);
  for (let c = 0; c < n; c++) {
    for (let r = n - 1; r >= 0; r--) {
      const bez = capS[(r + 1) * n + c];
      const s = (kand[r] >> c) & 1 ? 1 + capS[(r + 2) * n + c] : 0;
      capS[r * n + c] = Math.max(bez, s);
    }
  }
  const full = (1 << n) - 1;
  const cnt = new Int16Array(n);
  const maska = new Int32Array(n);

  function list() {
    const posl = maska[n - 1], pred = n >= 2 ? maska[n - 2] : 0;
    if (stromy[n - 1] & ~(pred | (posl << 1) | (posl >> 1)) & full) return false;
    for (let c = 0; c < n; c++) if (cnt[c] !== z.cols[c]) return false;
    const hrady = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if ((maska[r] >> c) & 1) hrady.push(r * n + c);
    if (!uplneParovanie(z.trees, hrady, n)) return false;
    out.count++;
    if (out.riesenia.length < limit) {
      const sol = new Array(C).fill(0);
      for (const h of hrady) sol[h] = 1;
      out.riesenia.push(sol);
    }
    return out.count >= limit;
  }
  function rek(r) {
    if (r === n) return list();
    const prev = r > 0 ? maska[r - 1] : 0;
    const zakaz = prev | (prev << 1) | (prev >> 1);
    for (const m of vzory[r]) {
      if (m & zakaz) continue;
      if (++out.nodes > maxNodes) { out.vycerpane = true; return true; }
      if (r >= 1 && stromy[r - 1]) {
        const kryt = (r >= 2 ? maska[r - 2] : 0) | m | (prev << 1) | (prev >> 1);
        if (stromy[r - 1] & ~kryt & full) continue;
      }
      let ok = true;
      for (let c = 0; c < n; c++) {
        const b = (m >> c) & 1;
        const zvysok = z.cols[c] - cnt[c] - b;
        if (zvysok < 0 || zvysok > (b ? capS[(r + 2) * n + c] : capS[(r + 1) * n + c])) { ok = false; break; }
      }
      if (!ok) continue;
      maska[r] = m;
      for (let c = 0; c < n; c++) cnt[c] += (m >> c) & 1;
      const stop = rek(r + 1);
      for (let c = 0; c < n; c++) cnt[c] -= (m >> c) & 1;
      if (stop) return true;
    }
    maska[r] = 0;
    return false;
  }
  rek(0);
  out.solution = out.riesenia.length ? out.riesenia[0] : null;
  return out;
}

/* ── solveHuman: only the rules a person uses, no guessing ────────────── *
 * The state: every cell unknown, a lodge or grass; the trees are fixed. A
 * free cell is an unknown one. A sure pair: a lodge that has, beside it, a
 * single tree not already surely paired with another lodge belongs to that
 * tree. Sure pairs are worked out to a fixed point before the layer 2 rules;
 * a tree with a sure pair is taken.
 *
 * Every step is one rule on one object (a tree, a line, a lodge, a cell) and
 * may set several cells at once, all to the same value. The layers are tried
 * in order, and inside a layer the rules in the order below; the solver stops
 * at the first step it can make, so a hint is always the simplest step there
 * is right now.
 *
 * Layer 1, one rule in one place:
 *   around-lodge  the eight cells around a lodge are grass,
 *   line-full     a line that already holds its number of lodges (zero too):
 *                 the rest is grass,
 *   line-room     a line with exactly as many free cells as lodges missing:
 *                 all of them are lodges,
 *   lone-tree     a tree with no lodge beside it and one free cell beside it:
 *                 that is its lodge,
 *   no-tree       a free cell with no tree beside it is grass (one step per row;
 *                 last on purpose, so the first hint is real reasoning).
 * Layer 2, a whole line at once, trees and lodges paired:
 *   line-fit          every way to fit the missing lodges of a line, never two
 *                     side by side, agrees on a cell,
 *   line-shadow       every such way touches the same cell of the next line,
 *   shared-neighbour  a tree whose lodge can only go in two to four free cells:
 *                     a free cell touching all of them is grass,
 *   tree-taken        a free cell whose trees are all taken is grass,
 *   crowded-trees     up to three untaken trees with exactly as many cells left
 *                     between them as trees: those cells are lodges.
 * Layer 3, one trial one level deep:
 *   trial   every free cell is assumed a lodge and grass, layers 1 and 2 run
 *           on all of them side by side, and the assumption that first ends
 *           in a contradiction a sentence can name (the shortest chain; a
 *           tie to the contradiction nearest the cell) gets its opposite
 *           written. The sentence names the first steps of the chain.
 * The full pairing of every tree at once (Hall's condition) is only in solve
 * and in logika.mjs jeVyriesene: a person does not pair forty trees at once,
 * and a contradiction nobody can say in a sentence is never a reason for a
 * hint. */

function kontext(z, initial) {
  const n = z.n, g = geometria(n), C = g.C;
  const isTree = new Uint8Array(C);
  for (const t of z.trees) isTree[t] = 1;
  const trees = Array.from(z.trees).sort((a, b) => a - b);
  const st = new Int8Array(C);
  if (initial) for (let i = 0; i < C; i++) if (!isTree[i]) st[i] = initial[i] === 1 ? 1 : initial[i] === 2 ? 2 : 0;
  const stromyPri = new Array(C);
  for (let i = 0; i < C; i++) {
    const a = [];
    if (!isTree[i]) for (let m = 0; m < 4; m++) { const y = g.s4[4 * i + m]; if (y >= 0 && isTree[y]) a.push(y); }
    stromyPri[i] = a;
  }
  const num = new Int16Array(2 * n);
  for (let r = 0; r < n; r++) num[r] = z.rows[r];
  for (let c = 0; c < n; c++) num[n + c] = z.cols[c];
  return { n, C, g, isTree, trees, st, stromyPri, num };
}
function klon(k) { return Object.assign({}, k, { st: k.st.slice() }); }
function maVolne(k) {
  for (let i = 0; i < k.C; i++) if (!k.isTree[i] && k.st[i] === 0) return true;
  return false;
}

/* Free cells that could still take a lodge: not touching any lodge. */
function mozeHradPole(k) {
  const { C, g, st, isTree } = k;
  const out = new Uint8Array(C);
  for (let i = 0; i < C; i++) {
    if (isTree[i] || st[i] !== 0) continue;
    let ok = 1;
    for (let m = 0; m < 8; m++) { const y = g.s8[8 * i + m]; if (y >= 0 && st[y] === 1) { ok = 0; break; } }
    out[i] = ok;
  }
  return out;
}

/* Sure pairs, to a fixed point. hradStromu: tree -> its lodge (or -1),
 * stromHradu: lodge -> its tree (or -1). A lodge left with no tree it could
 * belong to is a contradiction (lodge-alone). */
function pary(k) {
  const { C, g, st, isTree } = k;
  const hradStromu = new Int16Array(C).fill(-1);
  const stromHradu = new Int16Array(C).fill(-1);
  const hrady = [];
  for (let i = 0; i < C; i++) if (st[i] === 1 && !isTree[i]) hrady.push(i);
  let spor = null, zmena = true;
  while (zmena) {
    zmena = false;
    for (const h of hrady) {
      if (stromHradu[h] >= 0) continue;
      let jediny = -1, pocet = 0;
      for (let m = 0; m < 4; m++) {
        const t = g.s4[4 * h + m];
        if (t >= 0 && isTree[t] && hradStromu[t] < 0) { pocet++; jediny = t; }
      }
      if (!pocet) { if (!spor) spor = { typ: 'lodge-alone', i: h }; continue; }
      if (pocet === 1) { hradStromu[jediny] = h; stromHradu[h] = jediny; zmena = true; }
    }
  }
  return { hradStromu, stromHradu, spor };
}

/* Where an untaken tree's lodge can still be: free cells beside it and lodges
 * beside it that are not surely paired with another tree. */
function kandidati(k, P, t) {
  const out = [];
  for (let m = 0; m < 4; m++) {
    const y = k.g.s4[4 * t + m];
    if (y < 0 || k.isTree[y]) continue;
    if (k.st[y] === 0) out.push(y);
    else if (k.st[y] === 1 && P.stromHradu[y] < 0) out.push(y);
  }
  return out;
}
function zjednot(a, b) {
  const out = a.slice();
  for (const x of b) if (!out.includes(x)) out.push(x);
  return out;
}

/* A contradiction a sentence can name, or null:
 *   touch        two lodges touch,
 *   too-many     a line holds more lodges than its number,
 *   no-room      a line can no longer reach its number (not enough free cells
 *                without two side by side),
 *   lodge-alone  a lodge has no tree it could belong to,
 *   tree-alone   a tree has no lodge and no free cell beside it,
 *   crowd        two or three trees have fewer cells left than lodges they need. */
function najdiSpor(k, P) {
  const { n, C, g, st, num } = k;
  for (let i = 0; i < C; i++) {
    if (st[i] !== 1) continue;
    for (let m = 0; m < 8; m++) { const y = g.s8[8 * i + m]; if (y > i && st[y] === 1) return { typ: 'touch', a: i, b: y }; }
  }
  const moze = mozeHradPole(k);
  for (let L = 0; L < 2 * n; L++) {
    let hrady = 0, kapacita = 0, beh = 0;
    for (const x of g.lines[L]) {
      if (st[x] === 1) hrady++;
      if (moze[x]) beh++;
      else { kapacita += (beh + 1) >> 1; beh = 0; }
    }
    kapacita += (beh + 1) >> 1;
    if (hrady > num[L]) return { typ: 'too-many', L };
    if (hrady + kapacita < num[L]) return { typ: 'no-room', L };
  }
  if (P.spor) return P.spor;
  const male = [];
  for (const t of k.trees) {
    if (P.hradStromu[t] >= 0) continue;
    const kand = kandidati(k, P, t);
    if (!kand.length) return { typ: 'tree-alone', t };
    if (kand.length <= 2) male.push({ t, kand });
  }
  for (let a = 0; a < male.length; a++) {
    for (let b = a + 1; b < male.length; b++) {
      const u = zjednot(male[a].kand, male[b].kand);
      if (u.length < 2) return { typ: 'crowd', grp: [male[a].t, male[b].t] };
      if (u.length > 2) continue;
      for (let c = b + 1; c < male.length; c++) {
        if (male[c].kand.every((x) => u.includes(x))) return { typ: 'crowd', grp: [male[a].t, male[b].t, male[c].t] };
      }
    }
  }
  return null;
}

/* ── Layer 1 ──────────────────────────────────────────────────────────── */
function krok1(k) {
  const { n, C, g, st, isTree, num, trees } = k;
  for (let i = 0; i < C; i++) {
    if (st[i] !== 1) continue;
    const cells = [];
    for (let m = 0; m < 8; m++) { const y = g.s8[8 * i + m]; if (y >= 0 && !isTree[y] && st[y] === 0) cells.push(y); }
    if (cells.length) return { rule: 'around-lodge', layer: 1, cells, val: 2, info: { i } };
  }
  const hradyV = new Int16Array(2 * n), volneV = [];
  for (let L = 0; L < 2 * n; L++) {
    const volne = [];
    for (const x of g.lines[L]) { if (st[x] === 1) hradyV[L]++; else if (st[x] === 0 && !isTree[x]) volne.push(x); }
    volneV.push(volne);
  }
  for (let L = 0; L < 2 * n; L++) {
    if (hradyV[L] === num[L] && volneV[L].length) return { rule: 'line-full', layer: 1, cells: volneV[L], val: 2, info: { L, pocet: num[L] } };
  }
  for (let L = 0; L < 2 * n; L++) {
    const need = num[L] - hradyV[L];
    if (need > 0 && volneV[L].length === need) return { rule: 'line-room', layer: 1, cells: volneV[L], val: 1, info: { L, need } };
  }
  for (const t of trees) {
    let maHrad = false;
    const volne = [];
    for (let m = 0; m < 4; m++) {
      const y = g.s4[4 * t + m];
      if (y < 0 || isTree[y]) continue;
      if (st[y] === 1) maHrad = true;
      else if (st[y] === 0) volne.push(y);
    }
    if (!maHrad && volne.length === 1) return { rule: 'lone-tree', layer: 1, cells: volne, val: 1, info: { t } };
  }
  for (let r = 0; r < n; r++) {
    const cells = [];
    for (const x of g.lines[r]) if (!isTree[x] && st[x] === 0 && !k.stromyPri[x].length) cells.push(x);
    if (cells.length) return { rule: 'no-tree', layer: 1, cells, val: 2, info: { L: r } };
  }
  return null;
}

/* ── Layer 2 ──────────────────────────────────────────────────────────── */
const MAX_ROZLOZENI = 5000;
/* Every way to fit the lodges a line still misses into its free cells that
 * touch no lodge, never two side by side. Positions are indices into the
 * line. null when nothing is missing or there are too many ways to list. */
function rozlozenia(k, L, moze) {
  const { g, st, num } = k;
  const cells = g.lines[L];
  let hrady = 0;
  for (const x of cells) if (st[x] === 1) hrady++;
  const need = num[L] - hrady;
  if (need <= 0) return null;
  const poz = [];
  for (let p = 0; p < cells.length; p++) if (moze[cells[p]]) poz.push(p);
  const list = [];
  if (poz.length < need) return { need, cells, list };
  const cur = [];
  let prilis = false;
  (function rek(j, posledna) {
    if (cur.length === need) { list.push(cur.slice()); if (list.length > MAX_ROZLOZENI) prilis = true; return; }
    for (let q = j; q < poz.length; q++) {
      if (poz.length - q < need - cur.length) break;
      const p = poz[q];
      if (p - posledna < 2) continue;
      cur.push(p);
      rek(q + 1, p);
      cur.pop();
      if (prilis) return;
    }
  })(0, -10);
  if (prilis) return null;
  return { need, cells, list };
}

/* jen: only this one rule (for tests: every rule over a board a player made,
 * whatever the rules before it would find). Without it, the rules in order. */
function krok2(k, P, jen) {
  const { n, C, g, st, isTree, trees } = k;
  const smie = (r) => !jen || jen === r;
  const moze = mozeHradPole(k);
  const roz = [];
  if (smie('line-fit') || smie('line-shadow')) for (let L = 0; L < 2 * n; L++) roz.push(rozlozenia(k, L, moze));
  // line-fit
  if (smie('line-fit')) for (let L = 0; L < 2 * n; L++) {
    const R = roz[L];
    if (!R || !R.list.length) continue;
    const pocet = new Int32Array(n);
    for (const a of R.list) for (const p of a) pocet[p]++;
    const vsade = [], nikde = [];
    for (let p = 0; p < n; p++) {
      const x = R.cells[p];
      if (isTree[x] || st[x] !== 0) continue;
      if (pocet[p] === R.list.length) vsade.push(x);
      else if (pocet[p] === 0) nikde.push(x);
    }
    if (vsade.length) return { rule: 'line-fit', layer: 2, cells: vsade, val: 1, info: { L, need: R.need } };
    if (nikde.length) return { rule: 'line-fit', layer: 2, cells: nikde, val: 2, info: { L, need: R.need } };
  }
  // line-shadow
  if (smie('line-shadow')) for (let L = 0; L < 2 * n; L++) {
    const R = roz[L];
    if (!R || !R.list.length) continue;
    const poradie = L < n ? L : L - n;
    for (const d of [-1, 1]) {
      if (poradie + d < 0 || poradie + d >= n) continue;
      const L2 = L + d;
      const cells2 = g.lines[L2];
      const spolu = new Uint8Array(n).fill(1);
      for (const a of R.list) {
        const dotknute = new Uint8Array(n);
        for (const p of a) for (let q = p - 1; q <= p + 1; q++) if (q >= 0 && q < n) dotknute[q] = 1;
        for (let q = 0; q < n; q++) spolu[q] &= dotknute[q];
      }
      const cells = [];
      for (let q = 0; q < n; q++) {
        const x = cells2[q];
        if (spolu[q] && !isTree[x] && st[x] === 0) cells.push(x);
      }
      if (cells.length) return { rule: 'line-shadow', layer: 2, cells, val: 2, info: { L, L2 } };
    }
  }
  // shared-neighbour
  if (smie('shared-neighbour')) for (const t of trees) {
    if (P.hradStromu[t] >= 0) continue;
    const kand = kandidati(k, P, t);
    if (kand.length < 2 || kand.length > 4 || kand.some((x) => st[x] === 1)) continue;
    const cells = [];
    for (let m = 0; m < 8; m++) {
      const y = g.s8[8 * kand[0] + m];
      if (y < 0 || isTree[y] || st[y] !== 0 || kand.includes(y)) continue;
      if (kand.every((x) => x === kand[0] || dotykaSa(x, y, n))) cells.push(y);
    }
    if (cells.length) return { rule: 'shared-neighbour', layer: 2, cells: cells.sort((a, b) => a - b), val: 2, info: { t, kand } };
  }
  // tree-taken
  if (smie('tree-taken')) for (let i = 0; i < C; i++) {
    if (isTree[i] || st[i] !== 0) continue;
    const sp = k.stromyPri[i];
    if (!sp.length) continue;
    if (sp.every((t) => P.hradStromu[t] >= 0)) {
      return { rule: 'tree-taken', layer: 2, cells: [i], val: 2, info: { i, stromy: sp.slice(), hrady: sp.map((t) => P.hradStromu[t]) } };
    }
  }
  // crowded-trees
  if (!smie('crowded-trees')) return null;
  const male = [];
  for (const t of trees) {
    if (P.hradStromu[t] >= 0) continue;
    const kand = kandidati(k, P, t);
    if (kand.length >= 1 && kand.length <= 3) male.push({ t, kand });
  }
  for (const a of male) {
    if (a.kand.length === 1 && st[a.kand[0]] === 0) return { rule: 'crowded-trees', layer: 2, cells: [a.kand[0]], val: 1, info: { grp: [a.t], kand: a.kand } };
  }
  for (let x = 0; x < male.length; x++) {
    for (let y = x + 1; y < male.length; y++) {
      const a = male[x], b = male[y];
      const u = zjednot(a.kand, b.kand);
      if (u.length === a.kand.length + b.kand.length) continue; // nothing shared
      if (u.length === 2) {
        const volne = u.filter((c) => st[c] === 0).sort((p, q) => p - q);
        if (volne.length) return { rule: 'crowded-trees', layer: 2, cells: volne, val: 1, info: { grp: [a.t, b.t], kand: u } };
      }
    }
  }
  for (let x = 0; x < male.length; x++) {
    for (let y = x + 1; y < male.length; y++) {
      const u2 = zjednot(male[x].kand, male[y].kand);
      if (u2.length > 3 || u2.length === male[x].kand.length + male[y].kand.length) continue;
      for (let w = y + 1; w < male.length; w++) {
        const u = zjednot(u2, male[w].kand);
        if (u.length !== 3 || u.length === u2.length + male[w].kand.length) continue;
        const volne = u.filter((c) => st[c] === 0).sort((p, q) => p - q);
        if (volne.length) return { rule: 'crowded-trees', layer: 2, cells: volne, val: 1, info: { grp: [male[x].t, male[y].t, male[w].t], kand: u } };
      }
    }
  }
  return null;
}

/* ── Layer 3 ──────────────────────────────────────────────────────────── *
 * A trial is only worth a hint when a person can follow it. The chain is the
 * number of layer 1 and 2 steps from the assumption to the contradiction.
 * Taking simply the first cell in reading order that leads to a contradiction
 * (the first version) gave chains of 8 steps in the median and up to 40 (the
 * second review, 25. 9.): a hint that names a contradiction far away is a
 * reveal dressed up as reasoning. So every free cell is assumed both ways,
 * all of them are followed one step at a time side by side, and the first
 * contradiction reached wins: the shortest chain there is. A tie goes to the
 * contradiction nearest to the assumed cell, then to reading order with a
 * lodge assumed first. maxRetaz caps the chain (the generator uses MAX_RETAZ,
 * so a Sunday never asks for a longer one); with no chain under the cap the
 * layer finds nothing. */
export const MAX_RETAZ = 8;

/* Chebyshev distance from cell i to the place a contradiction names. */
function vzdialenostSporu(i, sp, n) {
  const r = (i / n) | 0, c = i % n;
  const d = (j) => Math.max(Math.abs(((j / n) | 0) - r), Math.abs((j % n) - c));
  switch (sp.typ) {
    case 'touch': return Math.min(d(sp.a), d(sp.b));
    case 'too-many': case 'no-room': return sp.L < n ? Math.abs(sp.L - r) : Math.abs(sp.L - n - c);
    case 'tree-alone': return d(sp.t);
    case 'lodge-alone': return d(sp.i);
    case 'crowd': return Math.min(...sp.grp.map(d));
    default: return n;
  }
}

function krok3(k, maxRetaz = Infinity) {
  let stavy = [];
  for (let i = 0; i < k.C; i++) {
    if (k.isTree[i] || k.st[i] !== 0) continue;
    for (const val of [1, 2]) {
      const kk = klon(k);
      kk.st[i] = val;
      stavy.push({ i, val, kk, zaznam: [] });
    }
  }
  for (let kroky = 0; stavy.length; kroky++) {
    let best = null;
    const dalej = [];
    for (const s of stavy) {
      const P = pary(s.kk);
      const sp = najdiSpor(s.kk, P);
      if (sp) {
        const vzd = vzdialenostSporu(s.i, sp, k.n);
        if (!best || vzd < best.vzd) best = { s, sp, vzd };
        continue;
      }
      if (best || kroky >= maxRetaz) continue;   // a shorter chain is known, or the cap is reached
      const krok = krok1(s.kk) || krok2(s.kk, P);
      if (!krok) continue;                       // stuck without a contradiction
      for (const x of krok.cells) s.kk.st[x] = krok.val;
      s.zaznam.push(krok);
      dalej.push(s);
    }
    if (best) {
      const { s, sp } = best;
      return { rule: 'trial', layer: 3, cells: [s.i], val: s.val === 1 ? 2 : 1, info: { i: s.i, predpoklad: s.val, spor: sp, retaz: s.zaznam, dlzka: kroky } };
    }
    stavy = dalej;
  }
  return null;
}

function jeHotovo(k) {
  const { n, C, st, isTree, num, g } = k;
  const hrady = [];
  for (let i = 0; i < C; i++) {
    if (isTree[i]) continue;
    if (st[i] === 0) return false;
    if (st[i] === 1) hrady.push(i);
  }
  for (let L = 0; L < 2 * n; L++) {
    let h = 0;
    for (const x of g.lines[L]) if (st[x] === 1) h++;
    if (h !== num[L]) return false;
  }
  for (const h of hrady) for (let m = 0; m < 8; m++) { const y = g.s8[8 * h + m]; if (y >= 0 && st[y] === 1) return false; }
  return uplneParovanie(k.trees, hrady, n);
}

/* solveHuman(z, opts): z = { n, trees, rows, cols }.
 * opts: maxVrstva (the highest layer allowed, 2 means no trial), initial (a
 * starting board with the player's values 0 empty, 1 lodge, 2 grass),
 * limitKrokov (stop after that many steps; a hint asks for 1), maxRetaz (the
 * longest chain a trial may have; no limit unless given).
 * Returns { solved, contradiction, spor, layersUsed:{1,2,3}, retaz, steps,
 * solution, state }: retaz is the sum of the chain lengths of all trials,
 * and each step is { rule, layer, cells:[i], val (1 lodge, 2 grass), kde
 * (where to look, without the value), text (the whole explanation), obrys
 * (the cells of the object to outline), rad (the line index 0..2n-1 for a
 * rule about a line, else -1) }; a trial also has dlzka (its chain length),
 * retaz (the steps of the chain the text names: [{ cells, val }]) and spor
 * ({ cells, rad }: where the contradiction is). */
export function solveHuman(z, opts = {}) {
  const k = kontext(z, opts.initial);
  const maxVrstva = opts.maxVrstva ?? 3;
  const maxRetaz = opts.maxRetaz ?? Infinity;
  const limit = opts.limitKrokov || 0;
  const steps = [];
  const layersUsed = { 1: 0, 2: 0, 3: 0 };
  let retaz = 0;
  let P = pary(k);
  let spor = najdiSpor(k, P);
  while (!spor) {
    if (limit && steps.length >= limit) break;
    if (!maVolne(k)) break;
    let krok = krok1(k);
    if (!krok && maxVrstva >= 2) krok = krok2(k, P);
    if (!krok && maxVrstva >= 3) krok = krok3(k, maxRetaz);
    if (!krok) break;
    for (const x of krok.cells) k.st[x] = krok.val;
    steps.push(krok);
    layersUsed[krok.layer]++;
    if (krok.rule === 'trial') retaz += krok.info.dlzka;
    P = pary(k);
    spor = najdiSpor(k, P);
  }
  const solved = !spor && jeHotovo(k);
  return {
    solved,
    contradiction: !!spor,
    spor,
    layersUsed,
    retaz,
    steps: steps.map((s) => verejnyKrok(s, k)),
    solution: solved ? Array.from(k.st, (x, i) => (x === 1 && !k.isTree[i] ? 1 : 0)) : null,
    state: k.st,
  };
}

/* For the tests only: the step one layer 2 rule makes on a board a player
 * made (initial as in solveHuman), whatever the rules before it would find,
 * or null. In solveHuman the rules of layer 1 nearly always come first on
 * such a board, so this is the only way to test shared-neighbour, tree-taken
 * and crowded-trees on boards the solver never builds itself (spec part 6). */
export function pravidloNadStavom(z, initial, rule) {
  const k = kontext(z, initial);
  const s = krok2(k, pary(k), rule);
  return s ? verejnyKrok(s, k) : null;
}

/* ── The sentences ────────────────────────────────────────────────────── */
const SLOVA = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
function zoznamSlov(a) {
  if (a.length === 1) return a[0];
  if (a.length === 2) return a[0] + ' and ' + a[1];
  return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
}
function nazovRadu(L, n, velke) {
  const s = L < n ? 'row ' + (L + 1) : 'column ' + (L - n + 1);
  return velke ? s[0].toUpperCase() + s.slice(1) : s;
}
/* "row 5, column 6", "row 5, columns 6 and 7", "rows 9 and 10, column 4" */
function zoznamPolicok(cells, n) {
  const s = cells.slice().sort((a, b) => a - b);
  if (s.length === 1) return poloha(s[0], n);
  const rr = s.map((i) => (i / n) | 0), cc = s.map((i) => i % n);
  if (rr.every((x) => x === rr[0])) return 'row ' + (rr[0] + 1) + ', columns ' + zoznamSlov(cc.map((x) => String(x + 1)));
  if (cc.every((x) => x === cc[0])) return 'rows ' + zoznamSlov(rr.map((x) => String(x + 1))) + ', column ' + (cc[0] + 1);
  return zoznamSlov(s.map((i) => poloha(i, n)));
}
/* The places inside one line: "column 6", "columns 6 and 9" for a row. */
function miestaVRade(L, cells, n) {
  const s = cells.slice().sort((a, b) => a - b);
  const cisla = s.map((i) => String((L < n ? i % n : (i / n) | 0) + 1));
  return (L < n ? (s.length === 1 ? 'column ' : 'columns ') : (s.length === 1 ? 'row ' : 'rows ')) + zoznamSlov(cisla);
}
const lodgeSlovo = (x) => (x === 1 ? 'lodge' : 'lodges');
/* A count in a sentence as a word ("its two lodges"), digits only past seven. */
const slovom = (x) => SLOVA[x] || String(x);

function vetaSporu(sp, n) {
  switch (sp.typ) {
    case 'touch': return 'the lodges in ' + poloha(sp.a, n) + ' and ' + poloha(sp.b, n) + ' would touch';
    case 'too-many': return nazovRadu(sp.L, n, false) + ' would hold more lodges than its number says';
    case 'no-room': return nazovRadu(sp.L, n, false) + ' would need more lodges than it has room for';
    case 'tree-alone': return 'the tree in ' + poloha(sp.t, n) + ' would have no cell left for its lodge';
    case 'lodge-alone': return 'the lodge in ' + poloha(sp.i, n) + ' would have no tree of its own';
    case 'crowd': return 'the trees in ' + zoznamPolicok(sp.grp, n) + ' would have fewer cells left than the lodges they need';
    default: return 'a rule would break';
  }
}
/* Where a contradiction is, for the second press of a trial hint: the cells
 * to outline and the line whose number to light (-1 for none). */
function mistoSporu(sp, k) {
  switch (sp.typ) {
    case 'touch': return { cells: [sp.a, sp.b], rad: -1 };
    case 'too-many': case 'no-room': return { cells: k.g.lines[sp.L].slice(), rad: sp.L };
    case 'tree-alone': return { cells: [sp.t], rad: -1 };
    case 'lodge-alone': return { cells: [sp.i], rad: -1 };
    case 'crowd': return { cells: sp.grp.slice(), rad: -1 };
    default: return { cells: [], rad: -1 };
  }
}

/* One step of a trial's chain as a clause in the conditional, with its reason
 * in a few words: "row 2, column 4 would be the lodge of the tree in row 2,
 * column 5". */
function klauzula(s, n) {
  const pol = (i) => poloha(i, n);
  const kde = zoznamPolicok(s.cells, n);
  const jeden = s.cells.length === 1;
  const co = kde + (s.val === 1 ? (jeden ? ' would be a lodge' : ' would be lodges') : ' would be grass');
  const inf = s.info;
  switch (s.rule) {
    case 'around-lodge': return 'the cells around the lodge in ' + pol(inf.i) + ' would be grass';
    case 'line-full': return 'the rest of ' + nazovRadu(inf.L, n, false) + ' would be grass';
    case 'line-room': return co + ' to make up ' + nazovRadu(inf.L, n, false);
    case 'lone-tree': return kde + ' would be the lodge of the tree in ' + pol(inf.t);
    case 'line-fit': return s.val === 1 ? co + ' to fit the lodges of ' + nazovRadu(inf.L, n, false)
      : co + ', as no way to fit ' + nazovRadu(inf.L, n, false) + ' uses ' + (jeden ? 'it' : 'them');
    case 'line-shadow': return co + ', as every way to fit ' + nazovRadu(inf.L, n, false) + ' touches ' + (jeden ? 'it' : 'them');
    case 'shared-neighbour': return co + ', as ' + (jeden ? 'it touches' : 'they touch') + ' every cell left for the tree in ' + pol(inf.t);
    case 'tree-taken': return co + ', as ' + (inf.stromy.length === 1 ? 'the tree beside it would already have its lodge' : 'the trees beside it would all have their lodges');
    case 'crowded-trees': return co + ' for the tree' + (inf.grp.length === 1 ? '' : 's') + ' in ' + zoznamPolicok(inf.grp, n);
    default: return co;
  }
}
/* The steps of a chain the sentence names: at most three, the grass around a
 * lodge folded into the lodge before it ("with grass around it"), and the
 * grass around an assumed lodge folded into the assumption (okolo is that
 * cell, or -1). Returns { kroky: [{ s, veta }], pokryte, zlozene }: pokryte
 * is how many steps of the chain the named ones cover, zlozene whether the
 * first step went into the assumption. */
const RETAZ_VIET = 3;
function menovaneKroky(retaz, n, okolo) {
  const kroky = [];
  let j = 0, zlozene = false;
  if (okolo >= 0 && retaz.length && retaz[0].rule === 'around-lodge' && retaz[0].info.i === okolo) { j = 1; zlozene = true; }
  for (; j < retaz.length && kroky.length < RETAZ_VIET; j++) {
    const s = retaz[j];
    let veta = klauzula(s, n);
    const dalsi = retaz[j + 1];
    if (s.val === 1 && s.cells.length === 1 && dalsi && dalsi.rule === 'around-lodge' && dalsi.info.i === s.cells[0]) {
      veta += ', with grass around it';
      j++;
    }
    kroky.push({ s, veta });
  }
  return { kroky, pokryte: j, zlozene };
}
const okoloPredpokladu = (inf) => (inf.predpoklad === 1 ? inf.i : -1);

function popis(s, k) {
  const n = k.n, inf = s.info;
  const pol = (i) => poloha(i, n);
  switch (s.rule) {
    case 'around-lodge':
      return { kde: 'Look around the lodge in ' + pol(inf.i) + '.', text: 'Lodges never touch, so the cells around the lodge in ' + pol(inf.i) + ' are grass.' };
    case 'line-full': {
      const R = nazovRadu(inf.L, n, true);
      if (!inf.pocet) return { kde: R + ': look at its number.', text: 'The number by ' + nazovRadu(inf.L, n, false) + ' is 0, so every cell in it is grass.' };
      return { kde: R + ' already has all its lodges.', text: R + ' already has its ' + slovom(inf.pocet) + ' ' + lodgeSlovo(inf.pocet) + ', so every other cell in it is grass.' };
    }
    case 'line-room': {
      const R = nazovRadu(inf.L, n, true);
      return {
        kde: R + ': count its free cells.',
        text: inf.need === 1 ? R + ' needs one more lodge and has exactly one free cell, so it is a lodge.'
          : R + ' needs ' + slovom(inf.need) + ' more lodges and has exactly ' + slovom(inf.need) + ' free cells, so all of them are lodges.',
      };
    }
    case 'lone-tree':
      return { kde: 'The tree in ' + pol(inf.t) + ' has little room around it.', text: 'The tree in ' + pol(inf.t) + ' has only one free cell beside it, so its lodge goes in ' + pol(s.cells[0]) + '.' };
    case 'no-tree': {
      const jedna = s.cells.length === 1;
      return {
        kde: 'Row ' + (inf.L + 1) + (jedna ? ' has a cell with no tree beside it.' : ' has cells with no tree beside them.'),
        text: 'Row ' + (inf.L + 1) + ': a cell with no tree right beside it can never hold a lodge, so ' + (jedna ? 'this cell is' : 'these cells are') + ' grass.',
      };
    }
    case 'line-fit': {
      const R = nazovRadu(inf.L, n, true);
      const miesta = miestaVRade(inf.L, s.cells, n);
      const jeden = s.cells.length === 1;
      const ako = inf.need === 1 ? 'it' : 'them without two side by side';
      const zaciatok = R + ' needs ' + slovom(inf.need) + ' more ' + lodgeSlovo(inf.need) + ', and ';
      // one cell: "puts it in" for a single lodge, "puts one in" for several;
      // more cells: "puts a lodge in each of" (the second review, 25. 9.)
      const kam = !jeden ? 'puts a lodge in each of ' : inf.need === 1 ? 'puts it in ' : 'puts one in ';
      return {
        kde: R + ': try every way to fit its lodges.',
        text: s.val === 1 ? zaciatok + 'every way to fit ' + ako + ' ' + kam + miesta + ', so ' + (jeden ? 'it is a lodge.' : 'they are lodges.')
          : zaciatok + 'no way to fit ' + ako + ' uses ' + miesta + ', so ' + (jeden ? 'it is grass.' : 'they are grass.'),
      };
    }
    case 'line-shadow': {
      const jeden = s.cells.length === 1;
      return {
        kde: nazovRadu(inf.L, n, true) + ': see which cells its lodges must touch.',
        text: 'Every way to fit the lodges of ' + nazovRadu(inf.L, n, false) + ' touches ' + zoznamPolicok(s.cells, n) + ', so ' + (jeden ? 'that cell is' : 'those cells are') + ' grass.',
      };
    }
    case 'shared-neighbour': {
      const kolko = SLOVA[inf.kand.length];
      const vsetky = inf.kand.length === 2 ? 'both' : 'all ' + kolko;
      const jeden = s.cells.length === 1;
      return {
        kde: 'The tree in ' + pol(inf.t) + ' has ' + kolko + ' free cells beside it.',
        text: 'The lodge of the tree in ' + pol(inf.t) + ' goes in one of ' + kolko + ' cells, and ' + zoznamPolicok(s.cells, n) + (jeden ? ' touches ' : ' touch ') + vsetky + ', so ' + (jeden ? 'it is' : 'they are') + ' grass.',
      };
    }
    case 'tree-taken': {
      const p = pol(inf.i);
      if (inf.stromy.length === 1) {
        return { kde: 'Look at the only tree beside ' + p + '.', text: 'The only tree beside ' + p + ' already has its lodge in ' + pol(inf.hrady[0]) + '. A lodge here would have no tree of its own, so it is grass.' };
      }
      const vsetky = inf.stromy.length === 2 ? 'Both' : 'All ' + SLOVA[inf.stromy.length];
      return {
        kde: 'Look at the trees beside ' + p + '.',
        text: vsetky + ' trees beside ' + p + ' already have their lodges, in ' + zoznamSlov(inf.hrady.map(pol)) + '. A lodge here would have no tree of its own, so it is grass.',
      };
    }
    case 'crowded-trees': {
      if (inf.grp.length === 1) {
        return { kde: 'Look at the tree in ' + pol(inf.grp[0]) + '.', text: 'Every lodge beside the tree in ' + pol(inf.grp[0]) + ' belongs to another tree, so its own lodge goes in ' + pol(s.cells[0]) + ', its only free cell.' };
      }
      const kto = zoznamPolicok(inf.grp, n);
      const kk = inf.grp.length, slovo = SLOVA[kk];
      const kde = 'Look at the trees in ' + kto + '.';
      if (s.cells.length === inf.kand.length) {
        return { kde, text: 'The trees in ' + kto + ' have only ' + slovo + ' free cells between them, and each needs its own lodge, so ' + (kk === 2 ? 'both' : 'all ' + slovo) + ' are lodges.' };
      }
      const uz = inf.kand.length - s.cells.length;
      return {
        kde,
        text: 'The trees in ' + kto + ' have only ' + slovo + ' cells left for their lodges, ' + (uz === 1 ? 'one of them a lodge already' : SLOVA[uz] + ' of them lodges already')
          + ', and each needs its own, so ' + zoznamPolicok(s.cells, n) + (s.cells.length === 1 ? ' is a lodge too.' : ' are lodges too.'),
      };
    }
    case 'trial': {
      // The chain spelled out: up to three steps, each with its reason, then
      // how many steps later the rule breaks. The second press marks the
      // cells of the named steps 1, 2, 3 (game.js), so every step can be
      // checked on the pond; nothing is left as "trust me".
      const p = pol(inf.i);
      const { kroky, pokryte, zlozene } = menovaneKroky(inf.retaz, n, okoloPredpokladu(inf));
      const zvysok = inf.dlzka - pokryte;
      let stred = '';
      kroky.forEach((x, j) => { stred += (j === 0 ? '' : ', then ') + x.veta; });
      const potom = !kroky.length ? (zvysok > 0 ? slovom(zvysok) + (zvysok === 1 ? ' step' : ' steps') + ' later ' : '')
        : zvysok <= 0 ? ', and then ' : ', and ' + slovom(zvysok) + (zvysok === 1 ? ' step' : ' steps') + ' later ';
      return {
        kde: 'Try ' + (inf.predpoklad === 1 ? 'a lodge' : 'grass') + ' in ' + p + ' and follow it until a rule breaks.',
        text: 'If ' + p + (inf.predpoklad === 1 ? ' held a lodge, ' + (zlozene ? 'with grass around it, ' : '') : ' were grass, ')
          + stred + potom + vetaSporu(inf.spor, n) + '. So it is ' + (s.val === 2 ? 'grass.' : 'a lodge.'),
      };
    }
    default:
      return { kde: 'Look at the pond.', text: 'A step across the pond.' };
  }
}
function obrysKroku(s, k) {
  const inf = s.info;
  switch (s.rule) {
    case 'around-lodge': return [inf.i];
    case 'line-full': case 'line-room': case 'no-tree': case 'line-fit': case 'line-shadow': return k.g.lines[inf.L].slice();
    case 'lone-tree': case 'shared-neighbour': return [inf.t];
    case 'tree-taken': return inf.stromy.slice();
    case 'crowded-trees': return inf.grp.slice();
    case 'trial': return [inf.i];
    default: return s.cells.slice();
  }
}
function verejnyKrok(s, k) {
  const { kde, text } = popis(s, k);
  const rad = s.info && typeof s.info.L === 'number' ? s.info.L : -1;
  const out = { rule: s.rule, layer: s.layer, cells: s.cells.slice(), val: s.val, kde, text, obrys: obrysKroku(s, k), rad };
  if (s.rule === 'trial') {
    out.dlzka = s.info.dlzka;
    // the cells of each named step of the chain (the grass folded into a
    // lodge clause is not marked: the clause names the lodge)
    out.retaz = menovaneKroky(s.info.retaz, k.n, okoloPredpokladu(s.info)).kroky.map((x) => ({ cells: x.s.cells.slice(), val: x.s.val }));
    out.spor = mistoSporu(s.info.spor, k);
  }
  return out;
}

/* ── The daily pond ───────────────────────────────────────────────────── *
 * generate(dateStr, opts) picks n (default 8) and calls generateSeeded with
 * the date as both name and key, so every date keeps the pond it always had.
 * opts: n, maxVrstva (default 2), maxAttempts (default 200). */
export function generate(dateStr, opts = {}) {
  if (!isValidDate(dateStr)) throw new Error('Date must be in YYYY-MM-DD form: ' + dateStr);
  const n = opts.n ?? 8;
  return generateSeeded(dateStr, dateStr + '/' + n, opts);
}

/* Random order (Fisher-Yates) of a copy of `a`, from rng. */
function zamiesaj(rng, a) {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = out[i]; out[i] = out[j]; out[j] = t; }
  return out;
}
function rovnake(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
/* A two by two block made only of trees looks like a copse, not a brook. */
export function maBlokStromov(strom, n) {
  for (let r = 0; r + 1 < n; r++) {
    for (let c = 0; c + 1 < n; c++) {
      const i = r * n + c;
      if (strom[i] && strom[i + 1] && strom[i + n] && strom[i + n + 1]) return true;
    }
  }
  return false;
}

/* The same as generate, but the random seed comes from `key` (any string) and
 * `name` is only stored in the result as `date`. Practice ponds and the daily
 * candidates use it. Deterministic: the same key gives the same pond.
 * opts: n (default 8), maxVrstva (default 2), maxAttempts (default 200),
 * maxNodes (the budget of solve, default 20 000; running out discards the
 * attempt, it never accepts it), maxRetaz (the longest chain of a trial,
 * default MAX_RETAZ; a pond that needs a longer one is thrown away).
 * Returns { date, n, trees, rows, cols, solution, seed, attempts,
 * difficulty:{ layers:{1,2,3}, steps, retaz }, ms, zamietnute } where retaz
 * is the sum of the chain lengths of the trials and zamietnute counts why
 * earlier attempts were thrown away. */
export function generateSeeded(name, key, opts = {}) {
  const n = opts.n ?? 8;
  const C = n * n;
  const maxAttempts = opts.maxAttempts ?? 200;
  const maxVrstva = opts.maxVrstva ?? 2;
  const maxRetaz = opts.maxRetaz ?? MAX_RETAZ;
  const maxNodes = opts.maxNodes ?? 20000;
  const t0 = nowMs();
  const seed = seedFromString(key);
  const rng = mulberry32(seed);
  const g = geometria(n);
  const [lo, hi] = rozsahStromov(n);
  const maxNul = Math.floor(0.15 * 2 * n);
  const vsetky = Array.from({ length: C }, (_, i) => i);
  const zamietnute = { hustota: 0, stromy: 0, vzhlad: 0, nejednoznacne: 0, rozpocet: 0, clovek: 0, prvyKrok: 0 };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // 1. Lodges, never touching, until the target count.
    const ciel = lo + Math.floor(rng() * (hi - lo + 1));
    const hrad = new Uint8Array(C);
    const hrady = [];
    for (const i of zamiesaj(rng, vsetky)) {
      if (hrady.length >= ciel) break;
      let volno = true;
      for (let m = 0; m < 8; m++) { const y = g.s8[8 * i + m]; if (y >= 0 && hrad[y]) { volno = false; break; } }
      if (volno) { hrad[i] = 1; hrady.push(i); }
    }
    if (hrady.length < lo) { zamietnute.hustota++; continue; }

    // 2. A tree beside every lodge.
    const strom = new Uint8Array(C);
    const stromHradu = new Map();
    let bezMiesta = false;
    for (const h of zamiesaj(rng, hrady)) {
      const volne = [];
      for (let m = 0; m < 4; m++) { const y = g.s4[4 * h + m]; if (y >= 0 && !hrad[y] && !strom[y]) volne.push(y); }
      if (!volne.length) { bezMiesta = true; break; }
      const t = volne[Math.floor(rng() * volne.length)];
      strom[t] = 1;
      stromHradu.set(h, t);
    }
    if (bezMiesta) { zamietnute.stromy++; continue; }

    // 3. Looks.
    if (maBlokStromov(strom, n)) { zamietnute.vzhlad++; continue; }
    const rows = new Array(n).fill(0), cols = new Array(n).fill(0);
    for (const h of hrady) { rows[(h / n) | 0]++; cols[h % n]++; }
    let nul = 0;
    for (let x = 0; x < n; x++) { if (!rows[x]) nul++; if (!cols[x]) nul++; }
    if (nul > maxNul) { zamietnute.vzhlad++; continue; }

    // 4. Exactly one answer, repaired by moving trees.
    const solution = Array.from(hrad);
    const stromyZ = () => { const a = []; for (let i = 0; i < C; i++) if (strom[i]) a.push(i); return a; };
    let jedine = false, vycerpane = false;
    for (let oprava = 0; oprava <= 10; oprava++) {
      const r = solve({ n, trees: stromyZ(), rows, cols }, { limit: 2, maxNodes });
      if (r.vycerpane) { vycerpane = true; break; }
      if (r.count === 0) throw new Error('solve found no pond although the source is one: ' + name);
      if (r.count === 1) {
        if (!rovnake(r.solution, solution)) throw new Error('solve settled on a different pond than the source for ' + name);
        jedine = true;
        break;
      }
      if (oprava === 10) break;
      const ine = r.riesenia.find((x) => !rovnake(x, solution));
      let presunute = false;
      for (const h of zamiesaj(rng, hrady.filter((x) => !ine[x]))) {
        const t = stromHradu.get(h);
        const moznosti = [];
        for (let m = 0; m < 4; m++) { const y = g.s4[4 * h + m]; if (y >= 0 && !hrad[y] && !strom[y]) moznosti.push(y); }
        for (const x of zamiesaj(rng, moznosti)) {
          strom[t] = 0; strom[x] = 1;
          if (maBlokStromov(strom, n)) { strom[x] = 0; strom[t] = 1; continue; }
          stromHradu.set(h, x);
          presunute = true;
          break;
        }
        if (presunute) break;
      }
      if (!presunute) break;
    }
    if (!jedine) { if (vycerpane) zamietnute.rozpocet++; else zamietnute.nejednoznacne++; continue; }

    // 5. A person can finish it without guessing, and every trial it needs
    //    reaches its contradiction within maxRetaz steps.
    const trees = stromyZ();
    const hu = solveHuman({ n, trees, rows, cols }, { maxVrstva, maxRetaz });
    if (!hu.solved) { zamietnute.clovek++; continue; }
    if (!rovnake(hu.solution, solution)) throw new Error('solveHuman settled on a different pond than the source for ' + name);

    // 6. The first step is real reasoning.
    if (!hu.steps.length || hu.steps[0].rule === 'no-tree') { zamietnute.prvyKrok++; continue; }

    return {
      date: name, n, trees, rows, cols, solution, seed, attempts: attempt,
      difficulty: { layers: hu.layersUsed, steps: hu.steps.length, retaz: hu.retaz },
      ms: Math.round((nowMs() - t0) * 10) / 10,
      zamietnute,
    };
  }
  throw new Error('No unique, guess-free pond for ' + name + ' in ' + maxAttempts + ' attempts');
}
