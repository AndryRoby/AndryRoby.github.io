/* Tests for the Herons generator. No framework: node tests.mjs
 * Prints "N passed, M failed" and exits with code 1 if anything fails. */
import {
  mulberry32, seedFromString, isValidDate, todayBratislava,
  geometria, hrana, indexHrany, stavZBuniek, vlastnici, rozsahParov,
  randomPaths, usporiadaj, endsZCiest, riesenieZCiest,
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

/* Hand verified 3 x 3, two pairs:
 *     1 . .          1 1 1
 *     . 2 .    ->    2 2 1
 *     2 1 .          2 1 1
 * The path 2 is short: the middle cell, left one, down one. The path 1 has to
 * take the other six, and the only way out of the top left corner that also
 * picks up the whole right hand side without ever running beside itself is
 * along the top, down the right and one step left. */
const MALE3 = [1, 0, 0, 0, 2, 0, 2, 1, 0];
const MALE3_RIESENIE = [1, 1, 1, 2, 2, 1, 2, 1, 1];

/* Hand verified 2 x 2, two pairs side by side: each path is one step long and
 * there is nowhere else for either of them to go. */
const MALE2 = [1, 1, 2, 2];
const MALE2_RIESENIE = [1, 1, 2, 2];

/* Found by search over 5 x 5 marshes (scratchpad/fixtures.mjs) and kept as a
 * puzzle that is NOT pinned down: with only these four pairs the marsh can be
 * filled in more than one way, which is exactly what the generator has to
 * refuse. */
const NEJEDNOZNACNE5 = [0, 0, 0, 0, 1, 0, 2, 0, 0, 3, 0, 0, 3, 1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0];

/* Is `solution` a legal filling of the marsh: every cell used, every pair one
 * simple path from nest to nest, no path beside itself? */
function legalne(ends, solution, n) {
  const g = geometria(n);
  let K = 0;
  for (const x of ends) if (x > K) K = x;
  for (let i = 0; i < g.C; i++) {
    const p = solution[i];
    if (!p || p > K) return false;
    if (ends[i] && ends[i] !== p) return false;
    let rovnakych = 0;
    for (let d = 0; d < 4; d++) {
      const y = g.cellSused[(i << 2) + d];
      if (y >= 0 && solution[y] === p) rovnakych++;
    }
    if (rovnakych !== (ends[i] ? 1 : 2)) return false;
  }
  for (let p = 1; p <= K; p++) {
    const start = solution.indexOf(p);
    const videne = new Uint8Array(g.C);
    const q = [start];
    videne[start] = 1;
    let pocet = 1;
    for (let t = 0; t < q.length; t++) {
      const b = q[t] << 2;
      for (let d = 0; d < 4; d++) {
        const y = g.cellSused[b + d];
        if (y < 0 || videne[y] || solution[y] !== p) continue;
        videne[y] = 1; pocet++; q.push(y);
      }
    }
    let celkom = 0;
    for (let i = 0; i < g.C; i++) if (solution[i] === p) celkom++;
    if (celkom !== pocet || celkom < 2) return false;
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

// ── Grid geometry ───────────────────────────────────────────────────────
test('geometria counts steps and cells for a 6 x 6 marsh', () => {
  const g = geometria(6);
  eq(g.E, 2 * 6 * 5); eq(g.H, 6 * 5); eq(g.C, 36);
});
test('hrana and indexHrany are inverses for every step of a 5 x 5 marsh', () => {
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
test('a cell on the edge of the marsh has no step off the board', () => {
  const g = geometria(3);
  eq(g.cellEdges[0], -1, 'no step up from the top left corner');
  eq(g.cellEdges[3], -1, 'no step left from the top left corner');
  eq(g.cellSused[0], -1);
});
test('stavZBuniek and vlastnici read the same filled marsh both ways', () => {
  const st = stavZBuniek(MALE3_RIESENIE, 3);
  eq(vlastnici(st, MALE3, 3), MALE3_RIESENIE);
});
test('rozsahParov follows the specification for every size we play', () => {
  eq(rozsahParov(5), [3, 4]);
  eq(rozsahParov(6), [4, 5]);
  eq(rozsahParov(7), [5, 6]);
  eq(rozsahParov(8), [6, 8]);
});

// ── Cutting the marsh into paths ────────────────────────────────────────
test('randomPaths always covers every cell with simple paths of at least three cells', () => {
  const rng = mulberry32(seedFromString('paths'));
  let pokusov = 0, hotovych = 0;
  for (const n of [5, 6, 7, 8]) {
    const [kMin, kMax] = rozsahParov(n);
    for (let k = 0; k < 25; k++) {
      pokusov++;
      const cesty = randomPaths(rng, n, kMin, kMax);
      if (!cesty) continue;
      hotovych++;
      assert(cesty.length >= kMin && cesty.length <= kMax, n + 'x' + n + ' gave ' + cesty.length + ' paths');
      const pokryte = new Uint8Array(n * n);
      for (const c of cesty) {
        assert(c.length >= 3, n + 'x' + n + ' has a path of only ' + c.length + ' cells');
        for (const x of c) { assert(!pokryte[x], 'cell ' + x + ' is on two paths'); pokryte[x] = 1; }
      }
      for (let i = 0; i < n * n; i++) assert(pokryte[i], 'cell ' + i + ' is on no path at all');
      const cesty2 = usporiadaj(cesty);
      assert(legalne(endsZCiest(cesty2, n), riesenieZCiest(cesty2, n), n), n + 'x' + n + ' is not a legal filling');
    }
  }
  assert(hotovych > pokusov * 0.9, 'too many marshes gave up: ' + hotovych + ' of ' + pokusov);
});

// ── solve ───────────────────────────────────────────────────────────────
test('solve finds exactly one filling for the hand verified 3 x 3', () => {
  const r = solve(MALE3, 3, { limit: 3 });
  eq(r.count, 1);
  eq(r.solution, MALE3_RIESENIE);
});
test('solve finds the one filling of the hand verified 2 x 2', () => {
  const r = solve(MALE2, 2, { limit: 3 });
  eq(r.count, 1);
  eq(r.solution, MALE2_RIESENIE);
});
test('solve reports more than one filling when the nests do not pin the paths down', () => {
  const r = solve(NEJEDNOZNACNE5, 5, { limit: 2 });
  eq(r.count, 2, 'expected two different fillings');
  assert(legalne(NEJEDNOZNACNE5, r.solution, 5), 'the filling it did report is not legal');
});
test('solve reports no filling when the nests leave cells nobody can use', () => {
  // one pair of neighbouring nests on a 3 x 3: their path is one step long
  // and the other seven cells have no path to belong to
  const ends = [1, 1, 0, 0, 0, 0, 0, 0, 0];
  eq(solve(ends, 3, { limit: 2 }).count, 0);
});
test('solve stops at maxNodes and says so rather than pretending to know', () => {
  const ends = new Array(64).fill(0);
  ends[0] = 1; ends[63] = 1; ends[7] = 2; ends[56] = 2;
  const r = solve(ends, 8, { limit: 2, maxNodes: 1 });
  assert(r.vycerpane, 'expected the search to run out of its budget');
});

// ── solveHuman ──────────────────────────────────────────────────────────
test('solveHuman finishes the hand verified 3 x 3 and explains every step in English', () => {
  const r = solveHuman(MALE3, 3);
  assert(r.solved, 'not solved');
  eq(r.solution, MALE3_RIESENIE);
  assert(r.steps.length > 0, 'no steps');
  for (const s of r.steps) {
    assert(typeof s.rule === 'string' && s.rule.length, 'step without a rule name');
    assert(s.layer >= 1 && s.layer <= 3, 'step outside the three layers');
    assert(s.edges.length > 0 || s.cells.length > 0, 'step that says nothing');
    for (const e of s.edges) {
      assert(e.typ === 'h' || e.typ === 'v', 'bad step type');
      assert(e.val === 1 || e.val === 2, 'a step must draw a link or cross it out');
      assert(Number.isInteger(indexHrany(e.typ, e.r, e.c, 3)), 'step outside the marsh');
    }
    for (const c of s.cells) {
      assert(c.i >= 0 && c.i < 9, 'cell outside the marsh');
      assert(c.pair >= 1, 'cell without a path number');
      eq(c.pair, MALE3_RIESENIE[c.i], 'step gave cell ' + c.i + ' to the wrong path');
    }
    assert(s.text.length > 20 && /[a-z]/.test(s.text) && s.text.endsWith('.'), 'step without a plain English sentence: ' + s.text);
    assert(!/[–—]/.test(s.text), 'a dash slipped into a sentence: ' + s.text);
  }
});
test('solveHuman gives up instead of guessing when the nests do not pin the paths down', () => {
  const r = solveHuman(NEJEDNOZNACNE5, 5);
  assert(!r.solved, 'a guess free solver must not finish an ambiguous puzzle');
  assert(!r.contradiction, 'an ambiguous puzzle is not a contradiction');
});
test('solveHuman uses all three layers of rules over a run of puzzles', () => {
  const najdene = new Set();
  for (const n of [6, 7, 8]) {
    for (let k = 0; k < 40; k++) {
      const p = generateSeeded('x', 'layers/' + n + '/' + k, { n });
      for (const s of solveHuman(p.ends, n).steps) najdene.add(s.rule);
    }
  }
  for (const r of ['nest-one-way', 'nest-full', 'cell-needs-all', 'cell-full', 'self-touch', 'pair-clash', 'only-pair', 'region-cut', 'trial-cross', 'trial-line']) {
    assert(najdene.has(r), 'the rule ' + r + ' never fired, so it cannot be trusted');
  }
});
test('solveHuman with maxVrstva 2 never records a layer 3 step', () => {
  const p = generateSeeded('x', 'layers/7', { n: 7, maxVrstva: 2 });
  const r = solveHuman(p.ends, 7, { maxVrstva: 2 });
  assert(r.solved);
  eq(r.layersUsed[3], 0);
});
test('solveHuman with limitKrokov 1 stops after one step', () => {
  const r = solveHuman(MALE3, 3, { limitKrokov: 1 });
  eq(r.steps.length, 1);
  assert(!r.solved, 'one step should not finish the puzzle');
});
test('solveHuman with dokymBunka stops as soon as it knows a new cell (this is what Hint uses)', () => {
  const r = solveHuman(MALE3, 3, { dokymBunka: true });
  assert(r.steps.length >= 1, 'no steps');
  const last = r.steps[r.steps.length - 1];
  assert(last.cells.length > 0, 'stopped without naming a cell');
  for (let i = 0; i < r.steps.length - 1; i++) eq(r.steps[i].cells.length, 0, 'stopped later than the first named cell');
});
test('solveHuman respects a starting board and only adds to it', () => {
  const v = new Array(9).fill(0);
  v[1] = 1; // one cell of the top path already drawn
  const r = solveHuman(MALE3, 3, { initial: stavZBuniek(v, 3), vlastnici: v });
  assert(r.solved);
  eq(r.solution, MALE3_RIESENIE);
});
test('solveHuman never draws a step that the real filling contradicts', () => {
  const rng = mulberry32(seedFromString('sound'));
  for (const n of [5, 6, 7, 8]) {
    const [kMin, kMax] = rozsahParov(n);
    for (let k = 0; k < 8; k++) {
      const surove = randomPaths(rng, n, kMin, kMax);
      if (!surove) continue;
      const cesty = usporiadaj(surove);
      const ends = endsZCiest(cesty, n), riesenie = riesenieZCiest(cesty, n);
      const r = solveHuman(ends, n);
      assert(!r.contradiction, n + 'x' + n + ' the rules contradicted a real filling');
      const st = stavZBuniek(riesenie, n);
      for (let e = 0; e < r.state.length; e++) {
        if (r.state[e] === 1) assert(st[e] === 1, n + 'x' + n + ' a rule drew a step the paths do not use');
        if (r.state[e] === 2) assert(st[e] !== 1, n + 'x' + n + ' a rule crossed out a step the paths use');
      }
      for (let i = 0; i < n * n; i++) {
        if (r.owners[i]) eq(r.owners[i], riesenie[i], n + 'x' + n + ' a rule gave cell ' + i + ' to the wrong path');
      }
    }
  }
});

// ── generate / generateSeeded ────────────────────────────────────────────
test('generate is deterministic: the same date gives the same puzzle', () => {
  const a = generate('2026-09-10'), b = generate('2026-09-10');
  eq(a.ends, b.ends);
  eq(a.solution, b.solution);
  eq(a.seed, b.seed);
  eq(a.attempts, b.attempts);
});
test('generateSeeded is deterministic per key and different keys give different puzzles', () => {
  const a = generateSeeded('d', 'key/7', { n: 7 });
  const b = generateSeeded('d', 'key/7', { n: 7 });
  const c = generateSeeded('d', 'key/7#1', { n: 7 });
  eq(a.ends, b.ends);
  eq(a.solution, b.solution);
  assert(JSON.stringify(a.solution) !== JSON.stringify(c.solution), 'two keys gave the same puzzle');
});
test('generate returns the expected shape', () => {
  const p = generate('2026-09-10');
  eq(p.date, '2026-09-10');
  eq(p.n, 5);
  eq(p.ends.length, 25);
  eq(p.solution.length, 25);
  assert(p.pairs >= 3 && p.pairs <= 4, '5 x 5 should carry three or four pairs, got ' + p.pairs);
  for (const x of p.ends) assert(x >= 0 && x <= p.pairs, 'a nest must be 0 or a pair number, got ' + x);
  assert(Number.isInteger(p.seed) && Number.isInteger(p.attempts) && p.attempts >= 1);
  assert(Number.isInteger(p.difficulty.pairs) && p.difficulty.pairs === p.pairs);
  assert(Number.isInteger(p.difficulty.steps) && p.difficulty.steps > 0);
  for (const l of [1, 2, 3]) assert(Number.isInteger(p.difficulty.layers[l]), 'no count for layer ' + l);
});
test('generate rejects a bad date', () => {
  let threw = false;
  try { generate('10.9.2026'); } catch (e) { threw = true; }
  assert(threw);
});
test('generate respects the n option (8 x 8)', () => {
  const p = generate('2026-01-02', { n: 8 });
  eq(p.n, 8);
  eq(p.ends.length, 64);
  eq(p.solution.length, 64);
  assert(p.pairs >= 6 && p.pairs <= 8, '8 x 8 should carry six to eight pairs, got ' + p.pairs);
});
test('every puzzle uses every cell, has two nests per pair and no path beside itself', () => {
  for (const n of [5, 6, 7, 8]) {
    for (let k = 0; k < 4; k++) {
      const p = generateSeeded('fill-' + k, 'fill/' + n + '/' + k, { n });
      assert(legalne(p.ends, p.solution, n), n + 'x' + n + ' candidate ' + k + ' is not a legal filling');
      const pocty = new Map();
      for (const x of p.ends) if (x) pocty.set(x, (pocty.get(x) || 0) + 1);
      eq(pocty.size, p.pairs, n + 'x' + n + ' pair count');
      for (const [pair, c] of pocty) eq(c, 2, n + 'x' + n + ' pair ' + pair + ' does not have two nests');
      for (let i = 0; i < n * n; i++) if (p.ends[i]) eq(p.ends[i], p.solution[i], 'a nest is not on its own path');
    }
  }
});
test('taking clues away leaves as few pairs as the size allows', () => {
  for (const n of [5, 6, 7, 8]) {
    const [kMin] = rozsahParov(n);
    let najmensi = 99;
    for (let k = 0; k < 6; k++) najmensi = Math.min(najmensi, generateSeeded('min-' + k, 'min/' + n + '/' + k, { n }).pairs);
    eq(najmensi, kMin, n + 'x' + n + ' never got down to ' + kMin + ' pairs, the smallest was ' + najmensi);
  }
});

test('every puzzle of 30 consecutive days, at every size, has exactly one filling and needs no guessing', () => {
  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 10 + i));
    return d.toISOString().slice(0, 10);
  });
  const seen = new Set();
  for (const n of [5, 6, 7, 8]) {
    for (const d of dates) {
      const p = generateSeeded(d, d + '/' + n, { n });
      const key = n + ':' + p.solution.join('');
      assert(!seen.has(key), 'repeated marsh: ' + n + 'x' + n + ' ' + d);
      seen.add(key);
      const r = solve(p.ends, n, { limit: 2 });
      eq(r.count, 1, n + 'x' + n + ' ' + d + ' does not have exactly one filling');
      eq(r.solution, p.solution, n + 'x' + n + ' ' + d + ' the solver found a different filling');
      const hu = solveHuman(p.ends, n);
      assert(hu.solved, n + 'x' + n + ' ' + d + ' cannot be finished without guessing');
      eq(hu.solution, p.solution, n + 'x' + n + ' ' + d + ' the human rules ended somewhere else');
    }
  }
});

test('a whole day (six candidates) takes well under 4 seconds at every size, 8 x 8 included', () => {
  const KANDIDATOV = 6; // the same number plan.mjs makes for a date
  const dates = ['2026-09-10', '2026-11-15', '2027-02-07', '2027-06-20'];
  const casy = [];
  let najhorsi = 0;
  for (const n of [5, 6, 7, 8]) {
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
