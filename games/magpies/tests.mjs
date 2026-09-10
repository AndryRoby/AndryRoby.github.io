/* Tests for the Magpies generator. No framework: node tests.mjs
 * Prints "N passed, M failed" and exits with code 1 if anything fails. */
import {
  mulberry32, seedFromString, isValidDate, todayBratislava,
  cluesFromGrid, riesRiadok, solveLines, generate, generateSeeded,
} from './generator.mjs';

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('ok   ' + name);
  } catch (e) {
    failed++;
    console.log('FAIL ' + name + '\n     ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n     ') : e));
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert'); }
function eq(a, b, msg) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) throw new Error((msg || 'eq') + ': ' + ja + ' !== ' + jb);
}

/* Hand-verified 5x5 picture: a filled frame with an empty middle. Every
   line's clue is either [5] (fully forced) or [1,1] with both ends already
   pinned by the border rows/columns, so pure line logic settles it in a
   single pass. */
const FRAME = [
  1, 1, 1, 1, 1,
  1, 0, 0, 0, 1,
  1, 0, 0, 0, 1,
  1, 0, 0, 0, 1,
  1, 1, 1, 1, 1,
];
const FRAME_CLUES = { rows: [[5], [1, 1], [1, 1], [1, 1], [5]], cols: [[5], [1, 1], [1, 1], [1, 1], [5]] };

/* Hand-verified ambiguous case: a 2 x 2 grid where every row and every
   column wants exactly one filled cell. Two pictures fit (the two
   diagonals) and line logic alone cannot tell them apart: nothing in a
   single row or column distinguishes "top-left, bottom-right" from
   "top-right, bottom-left". */
const AMBIGUOUS_CLUES = { rows: [[1], [1]], cols: [[1], [1]] };

// ── PRNG ────────────────────────────────────────────────────────────────
test('mulberry32 gives the same sequence for the same seed', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 100; i++) assert(a() === b(), 'difference at step ' + i);
});
test('mulberry32 gives different sequences for different seeds, numbers in [0, 1)', () => {
  const a = mulberry32(1), b = mulberry32(2);
  let same = 0;
  for (let i = 0; i < 100; i++) {
    const x = a(), y = b();
    assert(x >= 0 && x < 1 && y >= 0 && y < 1, 'out of range');
    if (x === y) same++;
  }
  assert(same < 5, 'too many matches: ' + same);
});
test('seedFromString is deterministic and sensitive to every character', () => {
  assert(seedFromString('2026-09-10') === seedFromString('2026-09-10'));
  assert(seedFromString('2026-09-10') !== seedFromString('2026-09-11'));
  assert(Number.isInteger(seedFromString('x')) && seedFromString('x') >= 0);
});

// ── Date ────────────────────────────────────────────────────────────────
test('isValidDate accepts only real dates in YYYY-MM-DD form', () => {
  assert(isValidDate('2026-09-10'));
  assert(isValidDate('2024-02-29'));
  assert(!isValidDate('2026-02-30'));
  assert(!isValidDate('2025-02-29'));
  assert(!isValidDate('2026-13-01'));
  assert(!isValidDate('26-09-10'));
  assert(!isValidDate('2026/09/10'));
  assert(!isValidDate(''));
});
test('todayBratislava returns YYYY-MM-DD and respects the time zone (23:30 UTC is already the next day)', () => {
  const s = todayBratislava();
  assert(isValidDate(s), 'shape: ' + s);
  eq(todayBratislava(new Date(Date.UTC(2026, 6, 15, 23, 30))), '2026-07-16');
  eq(todayBratislava(new Date(Date.UTC(2026, 0, 15, 23, 30))), '2026-01-16');
  eq(todayBratislava(new Date(Date.UTC(2026, 0, 15, 12, 0))), '2026-01-15');
});

// ── Clues from a picture ────────────────────────────────────────────────
test('cluesFromGrid reads off the hand-verified frame correctly', () => {
  eq(cluesFromGrid(FRAME, 5), FRAME_CLUES);
});
test('cluesFromGrid gives [] for an all-empty line', () => {
  eq(cluesFromGrid([0, 0, 0, 0], 2), { rows: [[], []], cols: [[], []] });
});
test('cluesFromGrid gives one block for an all-filled line', () => {
  eq(cluesFromGrid([1, 1, 1, 1], 2), { rows: [[2], [2]], cols: [[2], [2]] });
});

// ── One line (riesRiadok) ───────────────────────────────────────────────
test('riesRiadok: a single block bigger than half the line forces its overlap', () => {
  const r = riesRiadok([3], 5, [-1, -1, -1, -1, -1]);
  assert(r.ok);
  eq(r.grid, [-1, -1, 1, -1, -1]); // only the middle cell is filled in every placement
});
test('riesRiadok: no blocks means the whole line is forced empty', () => {
  const r = riesRiadok([], 4, [-1, -1, -1, -1]);
  assert(r.ok);
  eq(r.grid, [0, 0, 0, 0]);
});
test('riesRiadok: a known-filled cell where no blocks fit is a contradiction', () => {
  const r = riesRiadok([], 3, [1, -1, -1]);
  assert(!r.ok);
  eq(r.grid, null);
});
test('riesRiadok: a known-empty cell narrows the overlap further', () => {
  const r = riesRiadok([4], 6, [0, -1, -1, -1, -1, -1]);
  assert(r.ok);
  eq(r.grid, [0, -1, 1, 1, 1, -1]); // block must start at 1 or 2: cells 2-4 filled either way
});
test('riesRiadok: two blocks with no room to move are each forced completely', () => {
  const r = riesRiadok([2, 2], 5, [-1, -1, -1, -1, -1]);
  assert(r.ok);
  eq(r.grid, [1, 1, 0, 1, 1]); // 2 + 1 gap + 2 = 5, exactly the line: no other arrangement fits
});
test('riesRiadok: a line with too little room for its blocks has no arrangement', () => {
  const r = riesRiadok([3, 3], 5, new Array(5).fill(-1));
  assert(!r.ok);
});

// ── The whole grid (solveLines) ─────────────────────────────────────────
test('solveLines completes the hand-verified frame in one pass and matches the picture', () => {
  const res = solveLines(FRAME_CLUES, 5);
  assert(res.complete, 'left cells undetermined');
  eq(res.grid, FRAME);
  eq(res.cells, 25);
  assert(res.passes >= 1, 'passes ' + res.passes);
});
test('solveLines leaves the hand-verified ambiguous 2x2 undetermined', () => {
  const res = solveLines(AMBIGUOUS_CLUES, 2);
  assert(!res.complete);
  assert(res.grid.every((x) => x === -1), 'line logic alone should find nothing at all here');
});
test('solveLines reports a contradiction when the starting marks disagree with the clues', () => {
  const bad = new Array(25).fill(-1);
  bad[1] = 1; // the border row's own clue [5] wants every cell filled; this is consistent...
  bad[6] = 1; // ...but cell (1,1) inside the frame's hollow middle must be empty: contradiction
  const res = solveLines(FRAME_CLUES, 5, bad);
  assert(res.contradiction, 'expected a contradiction');
  assert(!res.complete);
});
test('solveLines accepts a partial start and only adds to it (used by napoveda)', () => {
  const start = new Array(25).fill(-1);
  start[0] = 1; // one cell of the border already marked
  const res = solveLines(FRAME_CLUES, 5, start);
  assert(res.complete);
  eq(res.grid, FRAME);
});

// ── generate / generateSeeded ────────────────────────────────────────────
test('generate is deterministic: the same date gives the same garden', () => {
  const a = generate('2026-09-10'), b = generate('2026-09-10');
  eq(a.clues, b.clues);
  eq(a.solution, b.solution);
  eq(a.seed, b.seed);
  eq(a.attempts, b.attempts);
});
test('generate returns the expected shape', () => {
  const p = generate('2026-09-10');
  eq(p.date, '2026-09-10');
  eq(p.n, 10);
  eq(p.clues.rows.length, 10);
  eq(p.clues.cols.length, 10);
  eq(p.solution.length, 100);
  assert(Number.isInteger(p.seed) && Number.isInteger(p.attempts) && p.attempts >= 1);
  assert(Number.isInteger(p.difficulty.passes) && p.difficulty.passes >= 0);
  eq(p.difficulty.cells, 100);
});
test('generate rejects a bad date', () => {
  let threw = false;
  try { generate('10.9.2026'); } catch (e) { threw = true; }
  assert(threw);
});
test('generate respects the n option (6 x 6)', () => {
  const p = generate('2026-01-02', { n: 6 });
  eq(p.n, 6);
  eq(p.clues.rows.length, 6);
  eq(p.solution.length, 36);
});
test('generateSeeded: every accepted garden is unique and guess-free for 30 consecutive days, every size', () => {
  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 10 + i));
    return d.toISOString().slice(0, 10);
  });
  const seen = new Set();
  for (const n of [8, 10, 12, 15]) {
    for (const d of dates) {
      const p = generateSeeded(d, d + '/' + n, { n });
      const key = n + ':' + p.solution.join('');
      assert(!seen.has(key), 'repeated garden: ' + n + 'x' + n + ' ' + d);
      seen.add(key);
      const res = solveLines(p.clues, n);
      assert(res.complete, n + 'x' + n + ' ' + d + ' not fully determined by line logic');
      eq(res.grid, p.solution, n + 'x' + n + ' ' + d);
      eq(cluesFromGrid(p.solution, n), p.clues, n + 'x' + n + ' ' + d + ' clues do not match the solution');
    }
  }
});
test('generate 15 x 15 (Challenge size) stays well under 2 seconds per accepted garden on average', () => {
  const dates = Array.from({ length: 10 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 9, 1 + i));
    return d.toISOString().slice(0, 10);
  });
  let totalMs = 0, totalAttempts = 0, maxMs = 0;
  for (const d of dates) {
    const t0 = performance.now();
    const p = generate(d, { n: 15 });
    const ms = performance.now() - t0;
    totalMs += ms; totalAttempts += p.attempts; maxMs = Math.max(maxMs, ms);
  }
  const avgMs = totalMs / dates.length;
  console.log('     15x15: avg ' + avgMs.toFixed(2) + ' ms, max ' + maxMs.toFixed(2) + ' ms, avg attempts ' + (totalAttempts / dates.length).toFixed(2));
  assert(avgMs < 2000, '15x15 averaged ' + avgMs.toFixed(0) + ' ms per garden');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exitCode = 1;
