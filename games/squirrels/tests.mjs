/* Tests for the Squirrels generator. No framework: node tests.mjs
 * Prints "N passed, M failed" and exits with code 1 if anything fails. */
import {
  mulberry32, seedFromString, isValidDate, todayBratislava,
  kombinacieSuctu, platnyVzor, randomVzor, cluesFromSolution, behy,
  solve, solveHuman, generate, generateSeeded,
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

/* Hand-verified 3 x 3. The first row and the first column are trunks, the
   four hollows hold
       1 2
       3 4
   so the totals are 3 and 7 across, 4 and 6 down. Nothing else fits: put 2
   in the top left hollow and the 4 down would need another 2 under it, which
   a run may not repeat. */
const MALY_VZOR = Uint8Array.from([1, 1, 1, 1, 0, 0, 1, 0, 0]);
const MALE_RIESENIE = [0, 0, 0, 0, 1, 2, 0, 3, 4];
const MALE_CELLS = [
  { r: null, d: null }, { r: null, d: 4 }, { r: null, d: 6 },
  { r: 3, d: null }, null, null,
  { r: 7, d: null }, null, null,
];

/* Hand-verified 4 x 4 with nine hollows 1..9 in reading order: the totals are
   6, 15, 24 across and 12, 15, 18 down. That is NOT enough to pin the digits
   down. Keep the 1, 2, 3 in the top row and the 7, 8, 9 in the bottom row but
   reorder them to 1, 2, 3 / 2, 6, 7 / 9, 7, 8 and every total still holds, so
   the solver must report more than one solution. */
const VELKY_VZOR = Uint8Array.from([1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
const VELKE_RIESENIE = [0, 0, 0, 0, 0, 1, 2, 3, 0, 4, 5, 6, 0, 7, 8, 9];

/* Every hollow holds 1 to 9, every run adds up to its sign and repeats
   nothing. Used to check the solver's answers against the puzzle itself. */
function sediZadaniu(cells, n, val) {
  const { runs } = behy(cells, n);
  for (let i = 0; i < n * n; i++) {
    if (cells[i] === null && !(val[i] >= 1 && val[i] <= 9)) return false;
    if (cells[i] !== null && val[i] !== 0) return false;
  }
  for (const run of runs) {
    let sum = 0, used = 0;
    for (const i of run.cells) {
      const b = 1 << val[i];
      if (used & b) return false;
      used |= b;
      sum += val[i];
    }
    if (run.sum != null && sum !== run.sum) return false;
  }
  return true;
}

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

// ── Sum combinations ────────────────────────────────────────────────────
test('kombinacieSuctu knows the totals that can be made in only one way', () => {
  eq(kombinacieSuctu(2, 3), [[1, 2]]);
  eq(kombinacieSuctu(2, 4), [[1, 3]]);
  eq(kombinacieSuctu(2, 16), [[7, 9]]);
  eq(kombinacieSuctu(2, 17), [[8, 9]]);
  eq(kombinacieSuctu(3, 6), [[1, 2, 3]]);
  eq(kombinacieSuctu(3, 24), [[7, 8, 9]]);
  eq(kombinacieSuctu(4, 10), [[1, 2, 3, 4]]);
  eq(kombinacieSuctu(4, 30), [[6, 7, 8, 9]]);
  eq(kombinacieSuctu(9, 45), [[1, 2, 3, 4, 5, 6, 7, 8, 9]]);
});
test('kombinacieSuctu lists every way of making a middling total and nothing impossible', () => {
  eq(kombinacieSuctu(2, 10).length, 4); // 1+9, 2+8, 3+7, 4+6
  eq(kombinacieSuctu(2, 1), []);
  eq(kombinacieSuctu(2, 18), []);
  eq(kombinacieSuctu(3, 45), []);
  for (const set of kombinacieSuctu(3, 15)) {
    eq(set.length, 3);
    eq(set.reduce((a, b) => a + b, 0), 15);
    assert(new Set(set).size === 3, 'a run may not repeat a number');
  }
});

// ── Pattern ─────────────────────────────────────────────────────────────
test('platnyVzor rejects a stray hollow, a run of one and a broken first row', () => {
  assert(platnyVzor(MALY_VZOR, 3), 'the hand-verified pattern is fine');
  const bezPrvehoRiadka = Uint8Array.from(MALY_VZOR); bezPrvehoRiadka[1] = 0;
  assert(!platnyVzor(bezPrvehoRiadka, 3), 'the first row must be all trunks');
  // 4 x 4 with a single hollow cut off in the bottom right: its runs are 1 long
  const osamely = Uint8Array.from([1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 0]);
  assert(!platnyVzor(osamely, 4), 'a run of one hollow is not allowed');
});
test('randomVzor gives a usable, point symmetric pattern nearly every time at every size we play', () => {
  const rng = mulberry32(seedFromString('vzory'));
  for (const n of [6, 8, 10, 12]) {
    let hotovych = 0;
    for (let k = 0; k < 40; k++) {
      // randomVzor may give up (it says so with null) when the trunks it has
      // already placed leave no way to cut a run of more than 9; generateSeeded
      // simply starts another pattern. At 12 x 12 that happens for a few
      // patterns in a hundred, at the smaller sizes it does not happen at all.
      const dark = randomVzor(rng, n, 0.25 + rng() * 0.1);
      if (!dark) continue;
      hotovych++;
      assert(platnyVzor(dark, n), n + 'x' + n + ' pattern is not usable');
      // point symmetric inside: a trunk and its mirror through the middle
      for (let r = 1; r < n; r++) {
        for (let c = 1; c < n; c++) {
          eq(dark[r * n + c], dark[(n - r) * n + (n - c)], n + 'x' + n + ' pattern is not point symmetric');
        }
      }
    }
    assert(hotovych >= 36, n + 'x' + n + ' gave up on too many patterns: ' + hotovych + ' of 40');
  }
});
test('every run of a random pattern is 2 to 9 hollows long and every hollow is in both a run across and a run down', () => {
  const rng = mulberry32(seedFromString('behy'));
  for (const n of [6, 8, 10, 12]) {
    const dark = randomVzor(rng, n, 0.3);
    const solution = new Array(n * n).fill(0);
    for (let i = 0; i < n * n; i++) if (!dark[i]) solution[i] = 1 + (i % 9);
    const { runs, cellRuns } = behy(cluesFromSolution(dark, solution, n), n);
    for (const run of runs) assert(run.len >= 2 && run.len <= 9, n + 'x' + n + ' run of ' + run.len);
    for (let i = 0; i < n * n; i++) {
      if (dark[i]) continue;
      assert(cellRuns[2 * i] >= 0, 'hollow ' + i + ' has no run across');
      assert(cellRuns[2 * i + 1] >= 0, 'hollow ' + i + ' has no run down');
    }
  }
});

// ── Clues ───────────────────────────────────────────────────────────────
test('cluesFromSolution reads the hand-verified 3 x 3 signs off the digits', () => {
  eq(cluesFromSolution(MALY_VZOR, MALE_RIESENIE, 3), MALE_CELLS);
});
test('behy finds the four runs of the hand-verified 3 x 3 with their totals', () => {
  const { runs } = behy(MALE_CELLS, 3);
  eq(runs.map((r) => [r.dir, r.sum, r.len]), [['h', 3, 2], ['h', 7, 2], ['v', 4, 2], ['v', 6, 2]]);
  eq(runs[0].cells, [4, 5]);
  eq(runs[2].cells, [4, 7]);
});

// ── solve ───────────────────────────────────────────────────────────────
test('solve finds exactly one filling for the hand-verified 3 x 3', () => {
  const r = solve(MALE_CELLS, 3, { limit: 3 });
  eq(r.count, 1);
  eq(r.solution, MALE_RIESENIE);
});
test('solve reports more than one filling for the hand-verified 4 x 4 that is not pinned down', () => {
  const cells = cluesFromSolution(VELKY_VZOR, VELKE_RIESENIE, 4);
  const r = solve(cells, 4, { limit: 2 });
  eq(r.count, 2);
  assert(JSON.stringify(r.solutions[0]) !== JSON.stringify(r.solutions[1]), 'two different fillings expected');
  for (const s of r.solutions) assert(sediZadaniu(cells, 4, s), 'a reported filling does not fit the signs');
});
test('solve reports no filling for totals that contradict each other', () => {
  // the 3 across can only be 1 and 2, the 4 down only 1 and 3: the shared
  // hollow would have to be 1 in both, and then the 3 across needs a 2 while
  // the 6 down under it would need a 5 that the 7 across cannot take
  const cells = [
    { r: null, d: null }, { r: null, d: 4 }, { r: null, d: 17 },
    { r: 3, d: null }, null, null,
    { r: 7, d: null }, null, null,
  ];
  eq(solve(cells, 3, { limit: 2 }).count, 0);
});
test('solve stops at maxNodes and says so rather than pretending to know', () => {
  const cells = cluesFromSolution(VELKY_VZOR, VELKE_RIESENIE, 4);
  const r = solve(cells, 4, { limit: 2, maxNodes: 1 });
  assert(r.vycerpane, 'expected the search to run out of its budget');
});
test('solve respects a board that is already partly filled in', () => {
  const zaciatok = new Array(9).fill(0);
  zaciatok[4] = 1;
  const r = solve(MALE_CELLS, 3, { limit: 3, initial: zaciatok });
  eq(r.count, 1);
  eq(r.solution, MALE_RIESENIE);
  const zly = new Array(9).fill(0);
  zly[4] = 2; // the top left hollow cannot be 2
  eq(solve(MALE_CELLS, 3, { limit: 3, initial: zly }).count, 0);
});

// ── solveHuman ──────────────────────────────────────────────────────────
test('solveHuman finishes the hand-verified 3 x 3 with layer 1 rules and explains every step in English', () => {
  const r = solveHuman(MALE_CELLS, 3);
  assert(r.solved, 'not solved');
  eq(r.solution, MALE_RIESENIE);
  eq(r.layersUsed[2], 0, 'this one should not need a pattern');
  eq(r.layersUsed[3], 0, 'this one should not need a trial');
  eq(r.steps.length, 4);
  for (const s of r.steps) {
    assert(typeof s.rule === 'string' && s.rule.length, 'step without a rule name');
    assert(s.layer >= 1 && s.layer <= 3, 'step outside the three layers');
    eq(s.cells.length, 1, 'a step fills exactly one hollow');
    const c = s.cells[0];
    assert(c.val >= 1 && c.val <= 9, 'a step must write a number 1 to 9');
    eq(c.i, c.r * 3 + c.c, 'cell index does not match its address');
    eq(MALE_RIESENIE[c.i], c.val, 'a step wrote a number the puzzle does not have there');
    assert(s.text.length > 20 && /[a-z]/.test(s.text) && s.text.endsWith('.'), 'step without a plain English sentence: ' + s.text);
    assert(!/[–—]/.test(s.text), 'no dashes in text shown to a person');
  }
  assert(r.steps.some((s) => s.rule === 'single-combo' || s.rule === 'naked-single'), 'the crossing runs should be used');
  assert(r.steps.some((s) => s.rule === 'last-in-run'), 'the last hollow of a run should be used');
});
test('solveHuman gives up instead of guessing when the totals do not pin the puzzle down', () => {
  const cells = cluesFromSolution(VELKY_VZOR, VELKE_RIESENIE, 4);
  const r = solveHuman(cells, 4);
  assert(!r.solved, 'a guess-free solver must not finish an ambiguous puzzle');
});
test('solveHuman with maxVrstva 2 never records a layer 3 step', () => {
  const p = generateSeeded('x', 'layers/8', { n: 8, maxVrstva: 2 });
  const r = solveHuman(p.cells, 8, { maxVrstva: 2 });
  assert(r.solved);
  eq(r.layersUsed[3], 0);
});
test('solveHuman with limitKrokov 1 stops after one step (this is what Hint uses)', () => {
  const r = solveHuman(MALE_CELLS, 3, { limitKrokov: 1 });
  eq(r.steps.length, 1);
  assert(!r.solved, 'one step should not finish the puzzle');
});
test('solveHuman respects a starting board and only adds to it', () => {
  const zaciatok = new Array(9).fill(0);
  zaciatok[4] = 1;
  const r = solveHuman(MALE_CELLS, 3, { initial: zaciatok });
  assert(r.solved);
  eq(r.solution, MALE_RIESENIE);
  eq(r.steps.length, 3, 'the hollow that is already filled in does not need a step');
});
test('solveHuman notices a board that contradicts the signs', () => {
  const zly = new Array(9).fill(0);
  zly[4] = 2;
  const r = solveHuman(MALE_CELLS, 3, { initial: zly });
  assert(!r.solved, 'a board that cannot be finished must not be reported as solved');
});

// ── generate / generateSeeded ───────────────────────────────────────────
test('generate is deterministic: the same date gives the same puzzle', () => {
  const a = generate('2026-09-10'), b = generate('2026-09-10');
  eq(a.cells, b.cells);
  eq(a.solution, b.solution);
  eq(a.seed, b.seed);
  eq(a.attempts, b.attempts);
});
test('generateSeeded is deterministic per key and different keys give different puzzles', () => {
  const a = generateSeeded('d', 'key/8', { n: 8 });
  const b = generateSeeded('d', 'key/8', { n: 8 });
  const c = generateSeeded('d', 'key/8#1', { n: 8 });
  eq(a.cells, b.cells);
  eq(a.solution, b.solution);
  assert(JSON.stringify(a.solution) !== JSON.stringify(c.solution), 'two keys gave the same puzzle');
});
test('generate returns the expected shape', () => {
  const p = generate('2026-09-10');
  eq(p.date, '2026-09-10');
  eq(p.n, 8);
  eq(p.cells.length, 64);
  eq(p.solution.length, 64);
  for (let i = 0; i < 64; i++) {
    if (p.cells[i] === null) assert(p.solution[i] >= 1 && p.solution[i] <= 9, 'a hollow without a number');
    else {
      eq(p.solution[i], 0, 'a trunk with a number');
      const t = p.cells[i];
      assert(t.r === null || (t.r >= 3 && t.r <= 45), 'total across out of range: ' + t.r);
      assert(t.d === null || (t.d >= 3 && t.d <= 45), 'total down out of range: ' + t.d);
    }
  }
  assert(Number.isInteger(p.seed) && Number.isInteger(p.attempts) && p.attempts >= 1);
  assert(Number.isInteger(p.difficulty.trunks) && p.difficulty.trunks > 0);
  assert(Number.isInteger(p.difficulty.steps) && p.difficulty.steps > 0);
  for (const l of [1, 2, 3]) assert(Number.isInteger(p.difficulty.layers[l]), 'no count for layer ' + l);
});
test('generate rejects a bad date', () => {
  let threw = false;
  try { generate('10.9.2026'); } catch (e) { threw = true; }
  assert(threw);
});
test('generate respects the n option (12 x 12)', () => {
  const p = generate('2026-01-02', { n: 12 });
  eq(p.n, 12);
  eq(p.cells.length, 144);
});
test('the first row and the first column are always trunks, and the pattern stays usable', () => {
  for (const n of [6, 8, 10, 12]) {
    const p = generateSeeded('2026-03-01', '2026-03-01/' + n, { n });
    for (let c = 0; c < n; c++) assert(p.cells[c] !== null, n + 'x' + n + ' first row has a hollow');
    for (let r = 0; r < n; r++) assert(p.cells[r * n] !== null, n + 'x' + n + ' first column has a hollow');
    const dark = new Uint8Array(n * n);
    for (let i = 0; i < n * n; i++) dark[i] = p.cells[i] ? 1 : 0;
    assert(platnyVzor(dark, n), n + 'x' + n + ' pattern is not usable');
  }
});
test('the totals on the signs always agree with the solution', () => {
  for (const n of [6, 8, 10, 12]) {
    const p = generateSeeded('2026-04-01', '2026-04-01/' + n, { n });
    const dark = new Uint8Array(n * n);
    for (let i = 0; i < n * n; i++) dark[i] = p.cells[i] ? 1 : 0;
    eq(p.cells, cluesFromSolution(dark, p.solution, n), n + 'x' + n + ' signs do not match the digits');
    assert(sediZadaniu(p.cells, n, p.solution), n + 'x' + n + ' solution does not fit its own signs');
  }
});

test('every puzzle of 30 consecutive days, at every size, has exactly one solution and needs no guessing', () => {
  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 10 + i));
    return d.toISOString().slice(0, 10);
  });
  const seen = new Set();
  for (const n of [6, 8, 10, 12]) {
    for (const d of dates) {
      const p = generateSeeded(d, d + '/' + n, { n });
      const key = n + ':' + p.solution.join('') + ':' + p.cells.map((x) => (x ? '#' : '.')).join('');
      assert(!seen.has(key), 'repeated puzzle: ' + n + 'x' + n + ' ' + d);
      seen.add(key);
      const r = solve(p.cells, n, { limit: 2 });
      eq(r.count, 1, n + 'x' + n + ' ' + d + ' does not have exactly one solution');
      eq(r.solution, p.solution, n + 'x' + n + ' ' + d + ' solver found a different filling');
      const hu = solveHuman(p.cells, n);
      assert(hu.solved, n + 'x' + n + ' ' + d + ' cannot be finished without guessing');
      eq(hu.solution, p.solution, n + 'x' + n + ' ' + d + ' human rules ended somewhere else');
    }
  }
});

test('a whole day (six candidates) takes well under 4 seconds at every size, 12 x 12 included', () => {
  const KANDIDATOV = 6; // the same number plan.mjs makes for a date
  const dates = ['2026-09-10', '2026-11-15', '2027-02-07', '2027-06-20'];
  // the setting each level really uses: Easy and Medium never allow a trial
  const NASTAVENIE = { 6: 2, 8: 2, 10: 3, 12: 3 };
  const casy = [];
  let najhorsi = 0;
  for (const n of [6, 8, 10, 12]) {
    const maxVrstva = NASTAVENIE[n];
    let max = 0, sucet = 0;
    for (const d of dates) {
      const t0 = performance.now();
      for (let k = 0; k < KANDIDATOV; k++) generateSeeded(d, d + '/' + n + (k ? '#' + k : ''), { n, maxVrstva });
      const ms = performance.now() - t0;
      sucet += ms; max = Math.max(max, ms);
    }
    casy.push('     ' + n + 'x' + n + ' (maxVrstva ' + maxVrstva + '): avg ' + (sucet / dates.length).toFixed(0) + ' ms, slowest day ' + max.toFixed(0) + ' ms');
    najhorsi = Math.max(najhorsi, max);
    assert(max < 4000, n + 'x' + n + ' took ' + max.toFixed(0) + ' ms for one day, the limit is 4000 ms');
  }
  for (const c of casy) console.log(c);
  console.log('     slowest day of any size: ' + najhorsi.toFixed(0) + ' ms');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exitCode = 1;
