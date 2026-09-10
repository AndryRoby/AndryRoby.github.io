/* Tests for the Badgers generator. No framework: node tests.mjs
 * Prints "N passed, M failed" and exits with code 1 if anything fails. */
import {
  mulberry32, seedFromString, isValidDate, todayBratislava,
  kombinacieSuctu, blokoveRozmery, blokIndexu, jednotky,
  randomRiesenie, randomOhrady, ohradyOk, solve, solveHuman, generate, generateSeeded,
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

/* Hand-verified 4 x 4 (blocks of 2 by 2). The grid is
     1 2 3 4
     3 4 1 2
     2 1 4 3
     4 3 2 1
   and the pens are: the single cell in the top left corner (1), the pair
   right of it (2 and 3 make 5), the pair in the fourth column of the first two
   rows (4 and 2 make 6), three vertical pairs down the middle rows (3 + 2,
   4 + 1, 1 + 4, all making 5), the pair at the bottom of the fourth column
   (3 + 1 = 4) and the three cells of the bottom row left of it (4 + 3 + 2 = 9).
   That is enough to pin the grid down: the corner is written out, the 4 of the
   first row has nowhere else to go than the fourth column, the 6 pen can only
   be 2 and 4, and the rest follows cell by cell. */
const MALE_RIESENIE = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1];
const MALE_OHRADY = [
  { sum: 1, cells: [0] },
  { sum: 5, cells: [1, 2] },
  { sum: 6, cells: [3, 7] },
  { sum: 5, cells: [4, 8] },
  { sum: 5, cells: [5, 9] },
  { sum: 5, cells: [6, 10] },
  { sum: 4, cells: [11, 15] },
  { sum: 9, cells: [12, 13, 14] },
];

/* Hand-verified 4 x 4 that says nothing at all: each of the four rows is one
   pen, and every row of a finished grid adds up to 1 + 2 + 3 + 4 = 10, so all
   four totals are 10 whatever the grid is. The solver must report more than
   one solution and the human solver must refuse to finish it. */
const PRAZDNE_OHRADY = [0, 1, 2, 3].map((r) => ({ sum: 10, cells: [r * 4, r * 4 + 1, r * 4 + 2, r * 4 + 3] }));

/* Every cell holds a number 1 to n, every row, column and block holds each
   number once, every pen adds up to its total and repeats nothing. Used to
   check the solver's answers against the puzzle itself. */
function sediZadaniu(cages, n, val) {
  for (let i = 0; i < n * n; i++) if (!(val[i] >= 1 && val[i] <= n)) return false;
  for (const u of jednotky(n)) {
    let used = 0;
    for (const i of u.cells) { const b = 1 << val[i]; if (used & b) return false; used |= b; }
  }
  for (const cage of cages) {
    let used = 0, sum = 0;
    for (const i of cage.cells) { const b = 1 << val[i]; if (used & b) return false; used |= b; sum += val[i]; }
    if (sum !== cage.sum) return false;
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
test('kombinacieSuctu knows the totals that can be made in only one way with nine numbers', () => {
  eq(kombinacieSuctu(2, 3), [[1, 2]]);
  eq(kombinacieSuctu(2, 4), [[1, 3]]);
  eq(kombinacieSuctu(2, 16), [[7, 9]]);
  eq(kombinacieSuctu(2, 17), [[8, 9]]);
  eq(kombinacieSuctu(3, 6), [[1, 2, 3]]);
  eq(kombinacieSuctu(3, 7), [[1, 2, 4]]);
  eq(kombinacieSuctu(3, 23), [[6, 8, 9]]);
  eq(kombinacieSuctu(3, 24), [[7, 8, 9]]);
  eq(kombinacieSuctu(4, 10), [[1, 2, 3, 4]]);
  eq(kombinacieSuctu(4, 11), [[1, 2, 3, 5]]);
  eq(kombinacieSuctu(4, 29), [[5, 7, 8, 9]]);
  eq(kombinacieSuctu(4, 30), [[6, 7, 8, 9]]);
  eq(kombinacieSuctu(5, 15), [[1, 2, 3, 4, 5]]);
  eq(kombinacieSuctu(5, 16), [[1, 2, 3, 4, 6]]);
  eq(kombinacieSuctu(5, 34), [[4, 6, 7, 8, 9]]);
  eq(kombinacieSuctu(5, 35), [[5, 6, 7, 8, 9]]);
});
test('kombinacieSuctu works with six numbers too (the smaller grid)', () => {
  eq(kombinacieSuctu(2, 3, 6), [[1, 2]]);
  eq(kombinacieSuctu(2, 11, 6), [[5, 6]]);
  eq(kombinacieSuctu(3, 6, 6), [[1, 2, 3]]);
  eq(kombinacieSuctu(3, 15, 6), [[4, 5, 6]]);
  eq(kombinacieSuctu(2, 12, 6), []);
  for (const set of kombinacieSuctu(3, 10, 6)) {
    eq(set.length, 3);
    eq(set.reduce((a, b) => a + b, 0), 10);
    assert(set.every((d) => d >= 1 && d <= 6), 'a number outside the range of the small grid');
  }
});
test('kombinacieSuctu lists every way of making a middling total and nothing impossible', () => {
  eq(kombinacieSuctu(2, 10).length, 4); // 1+9, 2+8, 3+7, 4+6
  eq(kombinacieSuctu(2, 1), []);
  eq(kombinacieSuctu(2, 18), []);
  eq(kombinacieSuctu(3, 45), []);
  for (const set of kombinacieSuctu(3, 15)) {
    eq(set.length, 3);
    eq(set.reduce((a, b) => a + b, 0), 15);
    assert(new Set(set).size === 3, 'a pen may not repeat a number');
  }
});

// ── Grid, blocks, units ─────────────────────────────────────────────────
test('the blocks are 3 by 3 on the big grid and 2 rows by 3 columns on the small one', () => {
  eq(blokoveRozmery(9), { vyska: 3, sirka: 3 });
  eq(blokoveRozmery(6), { vyska: 2, sirka: 3 });
  eq(blokIndexu(0, 9), 0);
  eq(blokIndexu(80, 9), 8);
  eq(blokIndexu(3, 9), 1);
  eq(blokIndexu(0, 6), 0);
  eq(blokIndexu(35, 6), 5);
  eq(blokIndexu(3, 6), 1);
  let threw = false;
  try { blokoveRozmery(7); } catch (e) { threw = true; }
  assert(threw, 'a size we do not play should be refused');
});
test('jednotky gives n rows, n columns and n blocks, and every cell is in exactly three of them', () => {
  for (const n of [6, 9]) {
    const un = jednotky(n);
    eq(un.length, 3 * n, n + ': wrong number of units');
    for (const u of un) {
      eq(u.cells.length, n, n + ': unit of the wrong size');
      eq(new Set(u.cells).size, n, n + ': unit with a repeated cell');
    }
    const kolko = new Array(n * n).fill(0);
    for (const u of un) for (const i of u.cells) kolko[i]++;
    for (let i = 0; i < n * n; i++) eq(kolko[i], 3, n + ': cell ' + i + ' is not in exactly three units');
    eq(un.filter((u) => u.druh === 'row').length, n);
    eq(un.filter((u) => u.druh === 'column').length, n);
    eq(un.filter((u) => u.druh === 'block').length, n);
  }
});

// ── A random filled grid ────────────────────────────────────────────────
test('randomRiesenie fills the grid so that every row, column and block holds each number once', () => {
  const rng = mulberry32(seedFromString('mriezky'));
  for (const n of [6, 9]) {
    for (let k = 0; k < 20; k++) {
      const g = randomRiesenie(rng, n);
      eq(g.length, n * n);
      for (const u of jednotky(n)) {
        const videne = new Set();
        for (const i of u.cells) {
          assert(g[i] >= 1 && g[i] <= n, n + ': number out of range');
          assert(!videne.has(g[i]), n + ': ' + u.druh + ' ' + (u.cislo + 1) + ' repeats ' + g[i]);
          videne.add(g[i]);
        }
      }
    }
  }
});
test('randomRiesenie gives a different grid for a different seed', () => {
  const a = randomRiesenie(mulberry32(1), 9).join('');
  const b = randomRiesenie(mulberry32(2), 9).join('');
  assert(a !== b, 'two seeds gave the same grid');
});

// ── Pens ────────────────────────────────────────────────────────────────
test('randomOhrady splits the whole grid into connected pens of 1 to 5 cells that never repeat a number', () => {
  const rng = mulberry32(seedFromString('ohrady'));
  for (const n of [6, 9]) {
    let hotovych = 0;
    for (let k = 0; k < 25; k++) {
      const solution = randomRiesenie(rng, n);
      const cages = randomOhrady(rng, solution, n);
      // randomOhrady may give up (it says so with null) when the pens it has
      // already grown leave a stray cell it cannot glue anywhere;
      // generateSeeded simply starts another grid.
      if (!cages) continue;
      hotovych++;
      assert(ohradyOk(cages, n, { solution }), n + ': the pens are not a usable split of the grid');
      const jednocelkove = cages.filter((c) => c.cells.length === 1).length;
      assert(jednocelkove <= 2, n + ': ' + jednocelkove + ' pens of a single cell, at most two are allowed');
      const velke = cages.filter((c) => c.cells.length === 5).length;
      assert(velke <= (n === 9 ? 4 : 2), n + ': too many pens of five cells: ' + velke);
    }
    assert(hotovych >= 18, n + ': gave up on too many splits: ' + hotovych + ' of 25');
  }
});
test('ohradyOk refuses a split that overlaps, leaves a cell out, breaks a pen apart or grows too big', () => {
  const n = 4;
  assert(ohradyOk(MALE_OHRADY, n, { solution: MALE_RIESENIE }), 'the hand-verified pens are fine');
  const prekryv = MALE_OHRADY.map((c) => ({ ...c, cells: c.cells.slice() }));
  prekryv[1] = { sum: 5, cells: [0, 2] }; // cell 0 is already the single cell pen
  assert(!ohradyOk(prekryv, n), 'two pens must not share a cell');
  assert(!ohradyOk(MALE_OHRADY.slice(1), n), 'every cell has to be in a pen');
  const roztrhnute = MALE_OHRADY.map((c) => ({ ...c, cells: c.cells.slice() }));
  roztrhnute[1] = { sum: 5, cells: [1, 6] };
  roztrhnute[5] = { sum: 5, cells: [2, 10] };
  assert(!ohradyOk(roztrhnute, n), 'a pen has to be one connected group');
  const velka = [{ sum: 10, cells: [0, 1, 2, 3, 7, 6] }, { sum: 6, cells: [4, 5] }];
  assert(!ohradyOk(velka, n), 'a pen of six cells is too big');
  const zlySucet = MALE_OHRADY.map((c) => ({ ...c, cells: c.cells.slice() }));
  zlySucet[0] = { sum: 2, cells: [0] };
  assert(!ohradyOk(zlySucet, n, { solution: MALE_RIESENIE }), 'a total that does not match the grid must be refused');
});

// ── solve ───────────────────────────────────────────────────────────────
test('solve finds exactly one filling for the hand-verified 4 x 4', () => {
  const r = solve(MALE_OHRADY, 4, { limit: 3 });
  eq(r.count, 1);
  eq(r.solution, MALE_RIESENIE);
});
test('solve reports more than one filling when the totals say nothing', () => {
  const r = solve(PRAZDNE_OHRADY, 4, { limit: 2 });
  eq(r.count, 2);
  assert(JSON.stringify(r.solutions[0]) !== JSON.stringify(r.solutions[1]), 'two different fillings expected');
  for (const s of r.solutions) assert(sediZadaniu(PRAZDNE_OHRADY, 4, s), 'a reported filling does not fit the pens');
});
test('solve reports no filling for totals that contradict each other', () => {
  // The pen of 5 down the first column (cells 4 and 8) is split into two pens
  // of one cell, 1 and 4. The corner cell above them is already a pen of 1, so
  // the first column would hold two ones, which no column may do.
  const cages = MALE_OHRADY
    .filter((c) => !(c.cells.length === 2 && c.cells[0] === 4))
    .map((c) => ({ sum: c.sum, cells: c.cells.slice() }));
  cages.push({ sum: 1, cells: [4] }, { sum: 4, cells: [8] });
  assert(ohradyOk(cages, 4), 'the fixture is still a usable split of the grid');
  eq(solve(cages, 4, { limit: 2 }).count, 0);
});
test('solve stops at maxNodes and says so rather than pretending to know', () => {
  const r = solve(PRAZDNE_OHRADY, 4, { limit: 2, maxNodes: 1 });
  assert(r.vycerpane, 'expected the search to run out of its budget');
});
test('solve respects a board that is already partly filled in', () => {
  const zaciatok = new Array(16).fill(0);
  zaciatok[1] = 2;
  const r = solve(MALE_OHRADY, 4, { limit: 3, initial: zaciatok });
  eq(r.count, 1);
  eq(r.solution, MALE_RIESENIE);
  const zly = new Array(16).fill(0);
  zly[1] = 3; // the second cell of the first row cannot be 3
  eq(solve(MALE_OHRADY, 4, { limit: 3, initial: zly }).count, 0);
});

// ── solveHuman ──────────────────────────────────────────────────────────
test('solveHuman finishes the hand-verified 4 x 4 with layer 1 rules and explains every step in English', () => {
  const r = solveHuman(MALE_OHRADY, 4);
  assert(r.solved, 'not solved');
  eq(r.solution, MALE_RIESENIE);
  eq(r.layersUsed[2], 0, 'this one should not need a pattern');
  eq(r.layersUsed[3], 0, 'this one should not need a trial');
  eq(r.steps.length, 16);
  for (const s of r.steps) {
    assert(typeof s.rule === 'string' && s.rule.length, 'step without a rule name');
    assert(s.layer >= 1 && s.layer <= 3, 'step outside the three layers');
    eq(s.cells.length, 1, 'a step fills exactly one cell');
    const c = s.cells[0];
    assert(c.val >= 1 && c.val <= 4, 'a step must write a number 1 to 4');
    eq(c.i, c.r * 4 + c.c, 'cell index does not match its address');
    eq(MALE_RIESENIE[c.i], c.val, 'a step wrote a number the puzzle does not have there');
    assert(s.text.length > 20 && /[a-z]/.test(s.text) && s.text.endsWith('.'), 'step without a plain English sentence: ' + s.text);
    assert(!/[–—]/.test(s.text), 'no dashes in text shown to a person');
  }
  assert(r.steps.some((s) => s.rule === 'single-cell-cage'), 'the pen of one cell should be used');
  assert(r.steps.some((s) => s.rule === 'single-combo'), 'a total that can be made only one way should be used');
  assert(r.steps.some((s) => s.rule === 'hidden-single'), 'the only place left for a number should be used');
});
test('solveHuman gives up instead of guessing when the totals do not pin the puzzle down', () => {
  const r = solveHuman(PRAZDNE_OHRADY, 4);
  assert(!r.solved, 'a guess-free solver must not finish an ambiguous puzzle');
  eq(r.steps.length, 0, 'there is nothing to deduce here');
});
test('solveHuman with maxVrstva 2 never records a layer 3 step', () => {
  const p = generateSeeded('x', 'layers/9', { n: 9, maxVrstva: 2 });
  const r = solveHuman(p.cages, 9, { maxVrstva: 2 });
  assert(r.solved);
  eq(r.layersUsed[3], 0);
});
test('solveHuman with limitKrokov 1 stops after one step (this is what Hint uses)', () => {
  const r = solveHuman(MALE_OHRADY, 4, { limitKrokov: 1 });
  eq(r.steps.length, 1);
  assert(!r.solved, 'one step should not finish the puzzle');
});
test('solveHuman respects a starting board and only adds to it', () => {
  const zaciatok = new Array(16).fill(0);
  zaciatok[1] = 2;
  const r = solveHuman(MALE_OHRADY, 4, { initial: zaciatok });
  assert(r.solved);
  eq(r.solution, MALE_RIESENIE);
  eq(r.steps.length, 15, 'the cell that is already filled in does not need a step');
});
test('solveHuman notices a board that contradicts the pens', () => {
  const zly = new Array(16).fill(0);
  zly[1] = 3;
  const r = solveHuman(MALE_OHRADY, 4, { initial: zly });
  assert(!r.solved, 'a board that cannot be finished must not be reported as solved');
});
test('the layer 2 rules really do get used on the big grid, and every step is right', () => {
  const p = generateSeeded('2026-05-05', '2026-05-05/9', { n: 9, maxVrstva: 2 });
  const r = solveHuman(p.cages, 9, { maxVrstva: 2 });
  assert(r.solved);
  assert(r.layersUsed[2] > 0, 'a medium puzzle should need at least one pattern');
  for (const s of r.steps) eq(p.solution[s.cells[0].i], s.cells[0].val, 'a step wrote the wrong number');
  const znama = new Set(['single-cell-cage', 'single-combo', 'naked-single', 'hidden-single',
    'unit-sum-in', 'unit-sum-out', 'pair', 'cage-sum', 'cage-in-unit', 'trial']);
  for (const s of r.steps) assert(znama.has(s.rule), 'unknown rule name: ' + s.rule);
});

// ── generate / generateSeeded ───────────────────────────────────────────
test('generate is deterministic: the same date gives the same puzzle', () => {
  const a = generate('2026-09-10'), b = generate('2026-09-10');
  eq(a.cages, b.cages);
  eq(a.solution, b.solution);
  eq(a.seed, b.seed);
  eq(a.attempts, b.attempts);
});
test('generateSeeded is deterministic per key and different keys give different puzzles', () => {
  const a = generateSeeded('d', 'key/9', { n: 9 });
  const b = generateSeeded('d', 'key/9', { n: 9 });
  const c = generateSeeded('d', 'key/9#1', { n: 9 });
  eq(a.cages, b.cages);
  eq(a.solution, b.solution);
  assert(JSON.stringify(a.solution) !== JSON.stringify(c.solution), 'two keys gave the same puzzle');
});
test('generate returns the expected shape', () => {
  const p = generate('2026-09-10');
  eq(p.date, '2026-09-10');
  eq(p.n, 9);
  eq(p.solution.length, 81);
  assert(ohradyOk(p.cages, 9, { solution: p.solution }), 'the pens are not a usable split of the grid');
  assert(sediZadaniu(p.cages, 9, p.solution), 'the solution does not fit its own pens');
  for (const cage of p.cages) {
    assert(cage.sum >= 1 && cage.sum <= 35, 'total out of range: ' + cage.sum);
    assert(cage.cells.length >= 1 && cage.cells.length <= 5, 'pen of ' + cage.cells.length + ' cells');
  }
  assert(Number.isInteger(p.seed) && Number.isInteger(p.attempts) && p.attempts >= 1);
  assert(Number.isInteger(p.difficulty.cages) && p.difficulty.cages === p.cages.length);
  assert(Number.isInteger(p.difficulty.steps) && p.difficulty.steps > 0);
  assert(Number.isInteger(p.difficulty.zlucene) && p.difficulty.zlucene >= 0);
  for (const l of [1, 2, 3]) assert(Number.isInteger(p.difficulty.layers[l]), 'no count for layer ' + l);
});
test('generate rejects a bad date', () => {
  let threw = false;
  try { generate('10.9.2026'); } catch (e) { threw = true; }
  assert(threw);
});
test('generate respects the n option (the small 6 x 6 grid)', () => {
  const p = generate('2026-01-02', { n: 6 });
  eq(p.n, 6);
  eq(p.solution.length, 36);
  assert(p.solution.every((d) => d >= 1 && d <= 6), 'the small grid only holds 1 to 6');
  assert(ohradyOk(p.cages, 6, { solution: p.solution }));
});
test('nothing is filled in at the start: the totals are the whole puzzle', () => {
  const p = generate('2026-09-11');
  assert(!('givens' in p) && !('clues' in p), 'Badgers never gives numbers away');
  let jednobunkove = 0;
  for (const cage of p.cages) if (cage.cells.length === 1) jednobunkove++;
  assert(jednobunkove <= 2, 'at most two pens of a single cell, found ' + jednobunkove);
});
test('the pens keep their promises at both sizes: few big ones, at most two of a single cell', () => {
  for (const n of [6, 9]) {
    for (const d of ['2026-04-01', '2026-04-02', '2026-04-03']) {
      const p = generateSeeded(d, d + '/' + n, { n });
      assert(ohradyOk(p.cages, n, { solution: p.solution }), n + ' ' + d + ': the pens are not a usable split');
      const velke = p.cages.filter((c) => c.cells.length === 5).length;
      const male = p.cages.filter((c) => c.cells.length === 1).length;
      assert(velke <= (n === 9 ? 4 : 2), n + ' ' + d + ': too many pens of five cells: ' + velke);
      assert(male <= 2, n + ' ' + d + ': too many pens of a single cell: ' + male);
    }
  }
});
test('minimising really does take totals off the board', () => {
  let zlucenych = 0;
  for (const d of ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04']) {
    zlucenych += generateSeeded(d, d + '/9', { n: 9 }).difficulty.zlucene;
  }
  assert(zlucenych > 0, 'the minimising pass never managed to merge two pens');
});

test('every puzzle of 30 consecutive days, at every size and every setting, has exactly one solution and needs no guessing', () => {
  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 10 + i));
    return d.toISOString().slice(0, 10);
  });
  const seen = new Set();
  // the three settings the weekly plan really uses (Hard and Challenge share one)
  for (const { n, maxVrstva } of [{ n: 6, maxVrstva: 2 }, { n: 9, maxVrstva: 2 }, { n: 9, maxVrstva: 3 }]) {
    const znacka = n + 'x' + n + ' (maxVrstva ' + maxVrstva + ')';
    for (const d of dates) {
      const p = generateSeeded(d, d + '/' + n + '/' + maxVrstva, { n, maxVrstva });
      const key = n + ':' + p.solution.join('') + ':' + p.cages.map((c) => c.sum + ':' + c.cells.join(',')).join(';');
      assert(!seen.has(key), 'repeated puzzle: ' + znacka + ' ' + d);
      seen.add(key);
      assert(ohradyOk(p.cages, n, { solution: p.solution }), znacka + ' ' + d + ': the pens are not a usable split');
      const r = solve(p.cages, n, { limit: 2 });
      eq(r.count, 1, znacka + ' ' + d + ' does not have exactly one solution');
      eq(r.solution, p.solution, znacka + ' ' + d + ' solver found a different filling');
      const hu = solveHuman(p.cages, n, { maxVrstva });
      assert(hu.solved, znacka + ' ' + d + ' cannot be finished without guessing');
      eq(hu.solution, p.solution, znacka + ' ' + d + ' human rules ended somewhere else');
      if (maxVrstva === 2) eq(hu.layersUsed[3], 0, znacka + ' ' + d + ' should not need a trial');
    }
  }
});

test('a whole day (six candidates) takes well under 4 seconds at every size and setting', () => {
  const KANDIDATOV = 6; // the same number plan.mjs makes for a date
  const dates = ['2026-09-10', '2026-11-15', '2027-02-07', '2027-06-20'];
  const NASTAVENIA = [
    { n: 6, maxVrstva: 2, uroven: 'Easy' },
    { n: 9, maxVrstva: 2, uroven: 'Medium' },
    { n: 9, maxVrstva: 3, uroven: 'Hard and Challenge' },
  ];
  const casy = [];
  let najhorsi = 0;
  for (const { n, maxVrstva, uroven } of NASTAVENIA) {
    let max = 0, sucet = 0;
    for (const d of dates) {
      const t0 = performance.now();
      for (let k = 0; k < KANDIDATOV; k++) generateSeeded(d, d + '/' + n + (k ? '#' + k : ''), { n, maxVrstva });
      const ms = performance.now() - t0;
      sucet += ms; max = Math.max(max, ms);
    }
    casy.push('     ' + n + 'x' + n + ' ' + uroven + ' (maxVrstva ' + maxVrstva + '): avg ' +
      (sucet / dates.length).toFixed(0) + ' ms, slowest day ' + max.toFixed(0) + ' ms');
    najhorsi = Math.max(najhorsi, max);
    assert(max < 4000, n + 'x' + n + ' took ' + max.toFixed(0) + ' ms for one day, the limit is 4000 ms');
  }
  for (const c of casy) console.log(c);
  console.log('     slowest day of any size: ' + najhorsi.toFixed(0) + ' ms');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exitCode = 1;
