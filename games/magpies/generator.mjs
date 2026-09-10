/* Magpies: generator and solver for the daily picture logic puzzle (nonogram).
 *
 * One file, no dependencies, runs the same in Node and in the browser
 * (game.js imports it as a module, tests.mjs too). Everything is
 * deterministic: a date turns into a number, the number into a sequence of
 * random values, the sequence into a puzzle. The same date gives the same
 * puzzle on every machine, so the server never has to compute or store
 * anything.
 *
 * Rules of the game (our own wording): a grid of n x n cells hides a
 * picture. Next to every row and every column are the lengths of the
 * blocks of filled cells in that line, in order, with at least one empty
 * cell between two blocks. A filled cell means a magpie left something
 * shiny there; an empty cell means nothing.
 *
 * Generation (generateSeeded):
 *   1. paint a random picture at a fill density between 0.45 and 0.6,
 *   2. read off the block clues for every row and column,
 *   3. solve with pure line logic alone (solveLines): repeatedly narrow
 *      every row and column using only the cells already known, until
 *      nothing more changes,
 *   4. accept only a picture that line logic completes fully: that proves
 *      both that the clues have exactly one solution and that a player can
 *      reach it without ever having to guess. Anything left undetermined
 *      is discarded and another picture is tried (up to `maxAttempts`).
 * The picture is always our own random one, never a copied image.
 *
 * Difficulty, returned as `difficulty`:
 *   passes  how many full sweeps over every row and every column it took
 *           line logic to settle (a sweep "counts" only when it changed at
 *           least one cell). Fewer passes means the puzzle opens up fast;
 *           more passes means later cells depend on earlier ones, which is
 *           harder for a person to follow. Used by plan.mjs to rank
 *           candidates into easy/medium/hard/challenge.
 *   cells   n x n, the size of the grid; kept alongside passes so passes
 *           can be read relative to the puzzle's size.
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

/* ── Clues from a picture ────────────────────────────────────────────── */

/* Block lengths of a line: runs of 1s in order, [] when the line is all 0. */
function blocksOfLine(get, len) {
  const blocks = [];
  let run = 0;
  for (let i = 0; i < len; i++) {
    if (get(i) === 1) run++;
    else { if (run) blocks.push(run); run = 0; }
  }
  if (run) blocks.push(run);
  return blocks;
}

/* Reads the row and column clues off a flat n*n picture of 0/1. */
export function cluesFromGrid(grid, n) {
  const rows = [];
  for (let r = 0; r < n; r++) rows.push(blocksOfLine((c) => grid[r * n + c], n));
  const cols = [];
  for (let c = 0; c < n; c++) cols.push(blocksOfLine((r) => grid[r * n + c], n));
  return { rows, cols };
}

/* ── One line, solved by pure logic ──────────────────────────────────── *
 * riesRiadok(blocks, len, known)
 *   blocks  block lengths for this line, in order ([] = the whole line is empty)
 *   len     line length
 *   known   array of length `len`: -1 unknown, 0 empty, 1 filled (the marks
 *           already fixed, from an earlier pass or from a player's marks)
 * Finds every arrangement of the blocks consistent with `known` (depth-first,
 * pruned by a memoised feasibility check so a branch that can never finish is
 * cut before it is explored) and returns which cells agree across every one
 * of them. Returns { ok, grid }:
 *   ok    false when no arrangement fits `known` at all (the clue and the
 *         marks contradict each other; cannot happen on a correct board)
 *   grid  length `len`, 1 where every arrangement fills the cell, 0 where
 *         every arrangement leaves it empty, -1 where arrangements differ
 * This is the one piece of reasoning both the generator (checking that a
 * picture is the puzzle's unique, guess-free solution) and the hints
 * (logika.mjs napoveda) run on a single row or column. */
export function riesRiadok(blocks, len, known) {
  const m = blocks.length;
  const sufMin = new Array(m + 1).fill(0);
  for (let k = m - 1; k >= 0; k--) sufMin[k] = blocks[k] + (k + 1 < m ? sufMin[k + 1] + 1 : 0);

  const memo = new Map();
  // feasible(k, pos): can blocks[k..] be placed with block k starting at pos
  // or later, consistent with `known`, and can the rest of the line to the
  // end be made consistent too?
  function feasible(k, pos) {
    if (k === m) {
      for (let i = pos; i < len; i++) if (known[i] === 1) return false;
      return true;
    }
    const key = k * (len + 1) + pos;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let ok = false;
    const maxStart = len - sufMin[k];
    for (let s = pos; s <= maxStart; s++) {
      let gapBad = false;
      for (let i = pos; i < s; i++) if (known[i] === 1) { gapBad = true; break; }
      if (gapBad) break; // a known-filled cell stuck before the block: no larger s helps either
      let spanBad = false;
      for (let i = s; i < s + blocks[k]; i++) if (known[i] === 0) { spanBad = true; break; }
      if (spanBad) continue;
      const after = s + blocks[k];
      if (k + 1 < m) {
        if (after >= len || known[after] === 1) continue; // the mandatory single gap cell
        if (feasible(k + 1, after + 1)) { ok = true; break; }
      } else if (feasible(k + 1, after)) { ok = true; break; }
    }
    memo.set(key, ok);
    return ok;
  }

  const cur = new Array(len);
  const sawFill = new Array(len).fill(false);
  const sawEmpty = new Array(len).fill(false);
  let any = false;

  function place(k, pos) {
    if (k === m) {
      // No more blocks: the rest of the line must be assignable empty. This
      // repeats feasible()'s own base case because the very first call
      // (k === m === 0, an all-empty line) never passes through the
      // feasible() pre-check that every other route to this point does.
      for (let i = pos; i < len; i++) if (known[i] === 1) return;
      for (let i = pos; i < len; i++) cur[i] = 0;
      any = true;
      for (let i = 0; i < len; i++) (cur[i] ? sawFill : sawEmpty)[i] = true;
      return;
    }
    const maxStart = len - sufMin[k];
    for (let s = pos; s <= maxStart; s++) {
      let gapBad = false;
      for (let i = pos; i < s; i++) if (known[i] === 1) { gapBad = true; break; }
      if (gapBad) break;
      let spanBad = false;
      for (let i = s; i < s + blocks[k]; i++) if (known[i] === 0) { spanBad = true; break; }
      if (spanBad) continue;
      const after = s + blocks[k];
      const nextPos = k + 1 < m ? after + 1 : after;
      if (k + 1 < m && (after >= len || known[after] === 1)) continue;
      if (!feasible(k + 1, nextPos)) continue; // prune: this branch can never finish
      for (let i = pos; i < s; i++) cur[i] = 0;
      for (let i = s; i < after; i++) cur[i] = 1;
      // The single mandatory gap cell right after this block (position
      // `after`, skipped over by nextPos = after + 1) is real ground truth
      // for this placement too and must be written, not left holding
      // whatever a previously explored sibling branch last put there.
      if (k + 1 < m) cur[after] = 0;
      place(k + 1, nextPos);
    }
  }
  place(0, 0);

  if (!any) return { ok: false, grid: null };
  const grid = new Array(len);
  for (let i = 0; i < len; i++) grid[i] = sawFill[i] && sawEmpty[i] ? -1 : sawFill[i] ? 1 : 0;
  return { ok: true, grid };
}

/* ── The whole grid, solved by line logic alone ──────────────────────── *
 * solveLines(clues, n, initial)
 *   initial  optional starting grid, flat n*n of -1/0/1 (default: all -1,
 *            an empty board); logika.mjs's napoveda passes the player's
 *            current marks here to find what line logic can add next
 * Repeats riesRiadok over every row, then every column, then every row
 * again, until a whole pass changes nothing. Returns
 * { grid, complete, passes, cells, contradiction }:
 *   grid          flat n*n, -1/0/1 as above, the settled state
 *   complete      true when nothing is left at -1: the clues have exactly
 *                 one solution and it was reached without any guessing
 *   passes        how many changing sweeps it took to settle (0 if the
 *                 starting grid already needed no work)
 *   cells         n*n, kept alongside passes for size-relative comparisons
 *   contradiction true if some row or column has no arrangement consistent
 *                 with `initial` at all (marks that disagree with the clues) */
export function solveLines(clues, n, initial) {
  const grid = initial ? initial.slice() : new Array(n * n).fill(-1);
  let passes = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < n; r++) {
      const known = new Array(n);
      for (let c = 0; c < n; c++) known[c] = grid[r * n + c];
      const res = riesRiadok(clues.rows[r], n, known);
      if (!res.ok) return { grid, complete: false, passes, cells: n * n, contradiction: true };
      for (let c = 0; c < n; c++) {
        if (res.grid[c] !== -1 && grid[r * n + c] === -1) { grid[r * n + c] = res.grid[c]; changed = true; }
      }
    }
    for (let c = 0; c < n; c++) {
      const known = new Array(n);
      for (let r = 0; r < n; r++) known[r] = grid[r * n + c];
      const res = riesRiadok(clues.cols[c], n, known);
      if (!res.ok) return { grid, complete: false, passes, cells: n * n, contradiction: true };
      for (let r = 0; r < n; r++) {
        if (res.grid[r] !== -1 && grid[r * n + c] === -1) { grid[r * n + c] = res.grid[r]; changed = true; }
      }
    }
    if (changed) passes++;
  }
  const complete = grid.every((x) => x !== -1);
  return { grid, complete, passes, cells: n * n, contradiction: false };
}

/* ── Daily garden ─────────────────────────────────────────────────────── *
 * generate(dateStr, opts) picks n (default 10) and calls generateSeeded
 * with the date as both name and key, so every date keeps the garden it
 * always had. opts: n, hustota, maxAttempts (default 400). */
export function generate(dateStr, opts = {}) {
  if (!isValidDate(dateStr)) throw new Error('Date must be in YYYY-MM-DD form: ' + dateStr);
  const n = opts.n ?? 10;
  return generateSeeded(dateStr, dateStr + '/' + n, opts);
}

/* The same as generate, but the random seed comes from `key` (any string)
 * and `name` is only stored in the result as `date`. Practice gardens and
 * the daily candidates use it; generate() itself is just a thin wrapper, so
 * every date keeps the garden it always had.
 * Returns { date, n, clues:{rows, cols}, solution (flat 0/1), seed, attempts,
 * difficulty:{ passes, cells }, ms }. */
export function generateSeeded(name, key, opts = {}) {
  const n = opts.n ?? 10;
  const maxAttempts = opts.maxAttempts ?? 400;
  const t0 = nowMs();
  const seed = seedFromString(key);
  const rng = mulberry32(seed);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const hustota = opts.hustota ?? (0.45 + rng() * 0.15);
    const flat = new Array(n * n);
    for (let i = 0; i < n * n; i++) flat[i] = rng() < hustota ? 1 : 0;
    const clues = cluesFromGrid(flat, n);
    const res = solveLines(clues, n);
    if (!res.complete) continue;
    if (res.grid.join(',') !== flat.join(',')) {
      throw new Error('solveLines settled on a different picture than the source for ' + name);
    }
    return {
      date: name, n, clues, solution: flat, seed, attempts: attempt,
      difficulty: { passes: res.passes, cells: res.cells },
      ms: Math.round((nowMs() - t0) * 10) / 10,
    };
  }
  throw new Error('No unique, guess-free garden for ' + name + ' in ' + maxAttempts + ' attempts');
}
