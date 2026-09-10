/* Tests for the Swans generator. No framework: node tests.mjs
 * Prints "N passed, M failed" and exits with code 1 if anything fails. */
import {
  mulberry32, seedFromString, isValidDate, todayBratislava,
  geometria, hrana, indexHrany, stavZHran,
  randomLoop, pearlsFromLoop, solve, solveHuman,
  generate, generateSeeded,
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

/* Hand-verified 3 x 3: a black swan in each corner. A black swan turns and
   runs straight on through the next cell, and in a corner the only way to do
   that is along both edges of the lake, so the loop is the ring round the
   middle cell. */
const ROHY3 = [2, 0, 2, 0, 0, 0, 2, 0, 2];
const RING3 = { h: [1, 1, 0, 0, 1, 1], v: [1, 0, 1, 1, 0, 1] };

/* The same ring read the other way round: every cell of it can carry a swan,
   the four corners a black one and the four sides a white one. */
const RING3_LABUTE = [2, 1, 2, 1, 0, 1, 2, 1, 2];

/* Hand-verified 2 x 2: the only closed loop through cells of a 2 x 2 lake is
   the square through all four, so even with no swans at all there is exactly
   one solution. */
const PRAZDNE2 = [0, 0, 0, 0];
const STVOREC2 = { h: [1, 1], v: [1, 1] };

/* Hand-verified: a white swan in a corner is impossible, the loop cannot go
   straight through a corner cell. */
const BIELA_V_ROHU2 = [1, 0, 0, 0];

/* Every cell of a drawn loop has either no line or exactly two, and all the
   lines hang together: one closed loop. Used to check randomLoop and the
   solver's answers. */
function jednaSlucka(edges, n) {
  const g = geometria(n);
  const st = stavZHran(edges, n);
  let total = 0, start = -1;
  for (let e = 0; e < g.E; e++) if (st[e] === 1) total++;
  if (!total) return false;
  for (let i = 0; i < g.C; i++) {
    let L = 0;
    for (let d = 0; d < 4; d++) { const e = g.cellEdges[(i << 2) + d]; if (e >= 0 && st[e] === 1) L++; }
    if (L !== 0 && L !== 2) return false;
    if (L === 2 && start < 0) start = i;
  }
  const videne = new Uint8Array(g.E), front = [start];
  let dosiahnute = 0;
  while (front.length) {
    const i = front.pop();
    for (let d = 0; d < 4; d++) {
      const e = g.cellEdges[(i << 2) + d];
      if (e < 0 || st[e] !== 1 || videne[e]) continue;
      videne[e] = 1; dosiahnute++;
      front.push(g.cellSused[(i << 2) + d]);
    }
  }
  return dosiahnute === total;
}
/* How many cells the loop runs through. */
function policokNaSlucke(edges, n) {
  const g = geometria(n), st = stavZHran(edges, n);
  let cells = 0;
  for (let i = 0; i < g.C; i++) {
    for (let d = 0; d < 4; d++) { const e = g.cellEdges[(i << 2) + d]; if (e >= 0 && st[e] === 1) { cells++; break; } }
  }
  return cells;
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

// ── Grid geometry ───────────────────────────────────────────────────────
test('geometria counts steps and cells for a 6 x 6 lake', () => {
  const g = geometria(6);
  eq(g.E, 2 * 6 * 5); eq(g.H, 6 * 5); eq(g.C, 36);
});
test('hrana and indexHrany are inverses for every step of a 5 x 5 lake', () => {
  const g = geometria(5);
  for (let e = 0; e < g.E; e++) {
    const x = hrana(e, 5);
    eq(indexHrany(x.typ, x.r, x.c, 5), e, 'step ' + e);
  }
});
test('the four steps out of a cell are up, right, down and left, and lead to the neighbouring cells', () => {
  const g = geometria(3);
  const i = 1 * 3 + 1, b = i << 2; // the middle cell
  eq(g.cellEdges[b], indexHrany('v', 0, 1, 3));
  eq(g.cellEdges[b + 1], indexHrany('h', 1, 1, 3));
  eq(g.cellEdges[b + 2], indexHrany('v', 1, 1, 3));
  eq(g.cellEdges[b + 3], indexHrany('h', 1, 0, 3));
  eq(Array.from(g.cellSused.slice(b, b + 4)), [1, 5, 7, 3]);
});
test('a cell on the edge of the lake has no step off the board', () => {
  const g = geometria(3);
  eq(g.cellEdges[0], -1, 'no step up from the top left corner');
  eq(g.cellEdges[3], -1, 'no step left from the top left corner');
  eq(g.cellSused[0], -1);
});

// ── Loops and swan seats ────────────────────────────────────────────────
test('pearlsFromLoop reads the hand-verified 3 x 3 ring as four black corners and four white sides', () => {
  assert(jednaSlucka(RING3, 3), 'the fixture is not one closed loop');
  eq(pearlsFromLoop(RING3, 3), RING3_LABUTE);
});
test('randomLoop always gives one closed loop through 40 to 70 percent of the cells', () => {
  const rng = mulberry32(seedFromString('loops'));
  let pokusov = 0, hotovych = 0;
  for (const n of [6, 7, 8, 10]) {
    for (let k = 0; k < 25; k++) {
      pokusov++;
      const edges = randomLoop(rng, n, 0.4 + rng() * 0.3);
      if (!edges) continue;
      hotovych++;
      assert(jednaSlucka(edges, n), n + 'x' + n + ' is not one closed loop');
      const cells = policokNaSlucke(edges, n);
      assert(cells >= 0.4 * n * n, n + 'x' + n + ' loop covers only ' + cells + ' of ' + n * n + ' cells');
      assert(cells <= 0.7 * n * n + 1, n + 'x' + n + ' loop covers ' + cells + ' of ' + n * n + ' cells');
      for (const x of pearlsFromLoop(edges, n)) assert(x === 0 || x === 1 || x === 2, 'bad swan: ' + x);
    }
  }
  assert(hotovych > pokusov * 0.6, 'too many loops gave up: ' + hotovych + ' of ' + pokusov);
});
test('every swan seat the generator offers really is a legal seat on its loop', () => {
  const rng = mulberry32(seedFromString('seats'));
  for (const n of [6, 8]) {
    for (let k = 0; k < 10; k++) {
      const edges = randomLoop(rng, n, 0.5);
      if (!edges) continue;
      const p = pearlsFromLoop(edges, n);
      // a board with every seat filled is solved by its own loop
      const r = solveHuman(p, n);
      if (!r.solved) continue;
      eq(r.solution, edges, n + 'x' + n + ' seat ' + k);
    }
  }
});

// ── solve ───────────────────────────────────────────────────────────────
test('solve finds exactly one loop for the hand-verified 3 x 3 black corners', () => {
  const r = solve(ROHY3, 3, { limit: 3 });
  eq(r.count, 1);
  eq(r.solution, RING3);
});
test('solve finds exactly one loop for the 3 x 3 ring described by all eight swans', () => {
  const r = solve(RING3_LABUTE, 3, { limit: 3 });
  eq(r.count, 1);
  eq(r.solution, RING3);
});
test('solve finds the only loop of a 2 x 2 lake even with no swans at all', () => {
  const r = solve(PRAZDNE2, 2, { limit: 3 });
  eq(r.count, 1);
  eq(r.solution, STVOREC2);
});
test('solve reports more than one loop when the swans do not pin it down', () => {
  eq(solve(new Array(16).fill(0), 4, { limit: 2 }).count, 2);
});
test('solve reports no loop for a white swan in a corner, where the loop cannot go straight', () => {
  eq(solve(BIELA_V_ROHU2, 2, { limit: 2 }).count, 0);
});
test('solve reports no loop for two black swans that would each need the other to go straight', () => {
  // a 2 x 2 of black swans: every cell turns, so no black swan has a
  // neighbour running straight through
  eq(solve([2, 2, 2, 2], 2, { limit: 2 }).count, 0);
});
test('solve stops at maxNodes and says so rather than pretending to know', () => {
  const r = solve(new Array(36).fill(0), 6, { limit: 2, maxNodes: 1 });
  assert(r.vycerpane, 'expected the search to run out of its budget');
});

// ── solveHuman ──────────────────────────────────────────────────────────
test('solveHuman finishes the hand-verified 3 x 3 with layer 1 rules and explains every step in English', () => {
  const r = solveHuman(ROHY3, 3);
  assert(r.solved, 'not solved');
  eq(r.solution, RING3);
  assert(r.steps.length > 0, 'no steps');
  eq(r.layersUsed[3], 0, 'four black corners should not need a trial');
  for (const s of r.steps) {
    assert(typeof s.rule === 'string' && s.rule.length, 'step without a rule name');
    assert(s.layer >= 1 && s.layer <= 3, 'step outside the three layers');
    assert(s.edges.length > 0, 'step without any steps of the loop');
    for (const e of s.edges) {
      assert(e.typ === 'h' || e.typ === 'v', 'bad step type');
      assert(e.val === 1 || e.val === 2, 'a step must draw a line or a cross');
      assert(Number.isInteger(indexHrany(e.typ, e.r, e.c, 3)), 'step outside the lake');
    }
    assert(s.text.length > 20 && /[a-z]/.test(s.text) && s.text.endsWith('.'), 'step without a plain English sentence: ' + s.text);
    assert(!/[–—]/.test(s.text), 'a dash slipped into a sentence: ' + s.text);
  }
  // a corner cell has only two sides, so the plain degree rule fills them in
  // before the black swan rule gets a chance; the arms are what the swan
  // itself contributes
  assert(r.steps.some((s) => s.rule === 'black-arms'), 'the arms of the black swans should be used');
});
test('solveHuman gives up instead of guessing when the swans do not pin the loop down', () => {
  const r = solveHuman(new Array(16).fill(0), 4);
  assert(!r.solved, 'a guess-free solver must not finish an ambiguous puzzle');
});
test('solveHuman with maxVrstva 2 never records a layer 3 step', () => {
  const p = generateSeeded('x', 'layers/7', { n: 7, maxVrstva: 2 });
  const r = solveHuman(p.pearls, 7, { maxVrstva: 2 });
  assert(r.solved);
  eq(r.layersUsed[3], 0);
});
test('solveHuman with limitKrokov 1 stops after one step (this is what Hint uses)', () => {
  const r = solveHuman(ROHY3, 3, { limitKrokov: 1 });
  eq(r.steps.length, 1);
  assert(!r.solved, 'one step should not finish the puzzle');
});
test('solveHuman respects a starting board and only adds to it', () => {
  const g = geometria(3);
  const zaciatok = new Uint8Array(g.E);
  zaciatok[indexHrany('h', 0, 0, 3)] = 1; // one step of the ring already drawn
  const r = solveHuman(ROHY3, 3, { initial: zaciatok });
  assert(r.solved);
  eq(r.solution, RING3);
});
test('solveHuman never draws a line or a cross that the real loop contradicts', () => {
  const rng = mulberry32(seedFromString('sound'));
  for (const n of [6, 8, 10]) {
    for (let k = 0; k < 6; k++) {
      const edges = randomLoop(rng, n, 0.4 + rng() * 0.3);
      if (!edges) continue;
      const p = pearlsFromLoop(edges, n);
      const r = solveHuman(p, n);
      assert(!r.contradiction, n + 'x' + n + ' the rules contradicted a real loop');
      const sol = stavZHran(edges, n);
      for (let e = 0; e < r.state.length; e++) {
        if (r.state[e] === 1) assert(sol[e] === 1, n + 'x' + n + ' rule drew a line the loop does not use');
        if (r.state[e] === 2) assert(sol[e] !== 1, n + 'x' + n + ' rule crossed a step the loop uses');
      }
    }
  }
});

// ── generate / generateSeeded ────────────────────────────────────────────
test('generate is deterministic: the same date gives the same puzzle', () => {
  const a = generate('2026-09-10'), b = generate('2026-09-10');
  eq(a.pearls, b.pearls);
  eq(a.solution, b.solution);
  eq(a.seed, b.seed);
  eq(a.attempts, b.attempts);
});
test('generateSeeded is deterministic per key and different keys give different puzzles', () => {
  const a = generateSeeded('d', 'key/7', { n: 7 });
  const b = generateSeeded('d', 'key/7', { n: 7 });
  const c = generateSeeded('d', 'key/7#1', { n: 7 });
  eq(a.pearls, b.pearls);
  eq(a.solution, b.solution);
  assert(JSON.stringify(a.solution) !== JSON.stringify(c.solution), 'two keys gave the same puzzle');
});
test('generate returns the expected shape', () => {
  const p = generate('2026-09-10');
  eq(p.date, '2026-09-10');
  eq(p.n, 6);
  eq(p.pearls.length, 36);
  eq(p.solution.h.length, 6 * 5);
  eq(p.solution.v.length, 5 * 6);
  for (const x of p.pearls) assert(x === 0 || x === 1 || x === 2, 'a swan must be 0, 1 or 2, got ' + x);
  assert(Number.isInteger(p.seed) && Number.isInteger(p.attempts) && p.attempts >= 1);
  assert(Number.isInteger(p.difficulty.pearls) && p.difficulty.pearls > 0);
  assert(Number.isInteger(p.difficulty.steps) && p.difficulty.steps > 0);
  for (const l of [1, 2, 3]) assert(Number.isInteger(p.difficulty.layers[l]), 'no count for layer ' + l);
});
test('generate rejects a bad date', () => {
  let threw = false;
  try { generate('10.9.2026'); } catch (e) { threw = true; }
  assert(threw);
});
test('generate respects the n option (10 x 10)', () => {
  const p = generate('2026-01-02', { n: 10 });
  eq(p.n, 10);
  eq(p.pearls.length, 100);
  eq(p.solution.h.length, 90);
  eq(p.solution.v.length, 90);
});
test('every swan left on the board sits where the loop really lets it', () => {
  for (const n of [6, 7, 8, 10]) {
    const p = generateSeeded('2026-03-01', '2026-03-01/' + n, { n });
    const plne = pearlsFromLoop(p.solution, n);
    for (let i = 0; i < n * n; i++) {
      if (p.pearls[i]) eq(p.pearls[i], plne[i], n + 'x' + n + ' swan ' + i);
    }
    assert(p.difficulty.pearls < n * n, 'nothing was taken away at ' + n + 'x' + n);
    const podiel = p.difficulty.pearls / (n * n);
    assert(podiel > 0.05 && podiel < 0.35, n + 'x' + n + ' has ' + p.difficulty.pearls + ' swans, that is ' + Math.round(podiel * 100) + ' percent of the lake');
  }
});
test('every puzzle is one closed loop with no branch and no cell used twice', () => {
  for (const n of [6, 7, 8, 10]) {
    for (let k = 0; k < 3; k++) {
      const p = generateSeeded('loop-' + k, 'loop/' + n + '/' + k, { n });
      assert(jednaSlucka(p.solution, n), n + 'x' + n + ' candidate ' + k + ' is not one closed loop');
      const cells = policokNaSlucke(p.solution, n);
      assert(cells >= 0.4 * n * n && cells <= 0.7 * n * n + 1, n + 'x' + n + ' covers ' + cells + ' of ' + n * n);
    }
  }
});

test('every puzzle of 30 consecutive days, at every size, has exactly one loop and needs no guessing', () => {
  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 10 + i));
    return d.toISOString().slice(0, 10);
  });
  const seen = new Set();
  for (const n of [6, 7, 8, 10]) {
    for (const d of dates) {
      const p = generateSeeded(d, d + '/' + n, { n });
      const key = n + ':' + p.solution.h.join('') + p.solution.v.join('');
      assert(!seen.has(key), 'repeated loop: ' + n + 'x' + n + ' ' + d);
      seen.add(key);
      const r = solve(p.pearls, n, { limit: 2 });
      eq(r.count, 1, n + 'x' + n + ' ' + d + ' does not have exactly one loop');
      eq(r.solution, p.solution, n + 'x' + n + ' ' + d + ' solver found a different loop');
      const hu = solveHuman(p.pearls, n);
      assert(hu.solved, n + 'x' + n + ' ' + d + ' cannot be finished without guessing');
      eq(hu.solution, p.solution, n + 'x' + n + ' ' + d + ' human rules ended somewhere else');
    }
  }
});

test('a whole day (six candidates) takes well under 4 seconds at every size, 10 x 10 included', () => {
  const KANDIDATOV = 6; // the same number plan.mjs makes for a date
  const dates = ['2026-09-10', '2026-11-15', '2027-02-07', '2027-06-20'];
  const casy = [];
  let najhorsi = 0;
  for (const n of [6, 7, 8, 10]) {
    let max = 0, sucet = 0;
    for (const d of dates) {
      const t0 = performance.now();
      // The slowest setting a level ever uses: layer 3 allowed. Easy and
      // Medium run with maxVrstva 2, which is faster still.
      for (let k = 0; k < KANDIDATOV; k++) generateSeeded(d, d + '/' + n + (k ? '#' + k : ''), { n, maxVrstva: 3 });
      const ms = performance.now() - t0;
      sucet += ms; max = Math.max(max, ms);
    }
    casy.push('     ' + n + 'x' + n + ': avg ' + (sucet / dates.length).toFixed(0) + ' ms, slowest day ' + max.toFixed(0) + ' ms');
    najhorsi = Math.max(najhorsi, max);
    assert(max < 4000, n + 'x' + n + ' took ' + max.toFixed(0) + ' ms for one day, the limit is 4000 ms');
  }
  for (const c of casy) console.log(c);
  console.log('     slowest day of any size: ' + najhorsi.toFixed(0) + ' ms');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exitCode = 1;
