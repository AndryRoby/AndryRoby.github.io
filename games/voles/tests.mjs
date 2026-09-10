/* Tests for the Voles generator. No framework: node tests.mjs
 * Prints "N passed, M failed" and exits with code 1 if anything fails. */
import {
  mulberry32, seedFromString, isValidDate, todayBratislava,
  geometria, policko, indexPolicka, suvislaVoda, maBlok2x2, maxOstrovPre,
  randomRiesenie, solve, solveHuman, generate, generateSeeded,
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

/* Hand-verified 3 x 3: a single 1 in the middle. The island is that one cell
   and nothing else, so the other eight cells are water. The water is in one
   piece all round the middle, and none of the four two by two blocks is all
   water because every one of them holds the middle cell. */
const STRED3 = [null, null, null, null, 1, null, null, null, null];
const STRED3_RIESENIE = [1, 1, 1, 1, 0, 1, 1, 1, 1];

/* Hand-verified 2 x 2: a single 2 in the top left. Its island is that cell
   plus one neighbour, and both neighbours work (the two remaining cells are
   side by side either way, so the water hangs together and the only two by
   two block is not all water). Two answers, so the solver must say so. */
const DVA2 = [2, null, null, null];

/* Hand-verified 2 x 2: a 1 in the top left and a 1 in the bottom right. Each
   island is exactly its own cell, which leaves the other two cells as water,
   and those two only touch at a corner. The water cannot hang together, so
   there is no answer at all. */
const SPOR2 = [1, null, null, 1];

/* Hand-verified 2 x 2: a 4 fills the whole meadow, which leaves no water.
   A meadow with no water is not a finished meadow, so there is no answer. */
const PLNE2 = [4, null, null, null];

/* An independent check that a finished meadow really follows every rule.
   Written from the rules themselves, not from the solver, so a bug in the
   solver cannot hide behind it. `sol` is flat, 0 island and 1 water. */
function platnaLuka(sol, clues, n) {
  const g = geometria(n), C = g.C, sus = g.susedia;
  const chyby = [];
  for (let r = 0; r + 1 < n; r++) {
    for (let c = 0; c + 1 < n; c++) {
      const i = r * n + c;
      if (sol[i] === 1 && sol[i + 1] === 1 && sol[i + n] === 1 && sol[i + n + 1] === 1) chyby.push('a two by two block of water at row ' + (r + 1) + ', column ' + (c + 1));
    }
  }
  let vody = 0, prva = -1;
  for (let i = 0; i < C; i++) if (sol[i] === 1) { vody++; if (prva < 0) prva = i; }
  if (!vody) chyby.push('no water at all');
  else {
    const videne = new Uint8Array(C);
    const front = [prva];
    videne[prva] = 1;
    let n2 = 1;
    while (front.length) {
      const x = front.pop();
      for (let m = 0; m < 4; m++) { const y = sus[4 * x + m]; if (y >= 0 && sol[y] === 1 && !videne[y]) { videne[y] = 1; n2++; front.push(y); } }
    }
    if (n2 !== vody) chyby.push('the water is in more than one piece');
  }
  const hotove = new Uint8Array(C);
  for (let i = 0; i < C; i++) {
    if (sol[i] === 1 || hotove[i]) continue;
    let velkost = 0, cisel = 0, hodnota = -1;
    const stack = [i];
    hotove[i] = 1;
    while (stack.length) {
      const x = stack.pop();
      velkost++;
      if (clues[x] != null) { cisel++; hodnota = clues[x]; }
      for (let m = 0; m < 4; m++) { const y = sus[4 * x + m]; if (y >= 0 && sol[y] !== 1 && !hotove[y]) { hotove[y] = 1; stack.push(y); } }
    }
    if (cisel !== 1) chyby.push('an island with ' + cisel + ' numbers');
    else if (velkost !== hodnota) chyby.push('an island of ' + velkost + ' cells for a ' + hodnota);
  }
  return chyby;
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
test('geometria counts cells and neighbours for a 5 x 5 meadow', () => {
  const g = geometria(5);
  eq(g.C, 25);
  eq(Array.from(g.susedia.slice(0, 4)), [-1, 1, 5, -1], 'top left corner has two neighbours');
  eq(Array.from(g.susedia.slice(4 * 12, 4 * 12 + 4)), [7, 13, 17, 11], 'the middle cell has four');
  eq(Array.from(g.susedia.slice(4 * 24, 4 * 24 + 4)), [19, -1, -1, 23], 'bottom right corner has two');
});
test('policko and indexPolicka are inverses for every cell of a 7 x 7 meadow', () => {
  for (let i = 0; i < 49; i++) {
    const p = policko(i, 7);
    eq(indexPolicka(p.r, p.c, 7), i, 'cell ' + i);
    assert(p.r >= 0 && p.r < 7 && p.c >= 0 && p.c < 7, 'out of the meadow');
  }
});
test('suvislaVoda and maBlok2x2 read a hand made meadow correctly', () => {
  // 1 = island. The middle cell of a 3 x 3 is an island, the rest is water.
  const stred = Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]);
  assert(suvislaVoda(stred, 3), 'the ring of water is in one piece');
  assert(!maBlok2x2(stred, 3), 'every two by two block holds the middle cell');
  // Two islands at opposite corners cut nothing, but leave a two by two block.
  const rohy = Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 0, 1]);
  assert(suvislaVoda(rohy, 3));
  assert(maBlok2x2(rohy, 3), 'the top right two by two block is all water');
  // A whole island row cuts the water in two.
  const pas = Uint8Array.from([0, 0, 0, 1, 1, 1, 0, 0, 0]);
  assert(!suvislaVoda(pas, 3), 'the water is cut in two');
  // No water at all is not a meadow.
  assert(!suvislaVoda(Uint8Array.from([1, 1, 1, 1]), 2));
});
test('maxOstrovPre follows the sizes in the specification', () => {
  eq(maxOstrovPre(6), 5);
  eq(maxOstrovPre(12), 9);
  for (const n of [6, 8, 10, 12]) assert(maxOstrovPre(n) >= 3 && maxOstrovPre(n) <= 9, 'out of range at ' + n);
});

// ── Random meadows ──────────────────────────────────────────────────────
test('randomRiesenie always gives a meadow that follows every rule', () => {
  const rng = mulberry32(seedFromString('meadows'));
  let pokusov = 0, hotovych = 0;
  for (const n of [6, 8, 10, 12]) {
    for (let k = 0; k < 25; k++) {
      pokusov++;
      const rr = randomRiesenie(rng, n, { hustota: 0.28 + rng() * 0.12 });
      if (!rr) continue;
      hotovych++;
      assert(suvislaVoda(rr.ostrov, n), n + 'x' + n + ': the water is not in one piece');
      assert(!maBlok2x2(rr.ostrov, n), n + 'x' + n + ': a two by two block of water');
      const maxO = maxOstrovPre(n);
      let bunky = 0;
      for (const cells of rr.ostrovy) {
        assert(cells.length >= 1 && cells.length <= maxO, n + 'x' + n + ': an island of ' + cells.length + ' cells, the limit is ' + maxO);
        bunky += cells.length;
      }
      let ostrovnych = 0;
      for (let i = 0; i < n * n; i++) if (rr.solution[i] === 0) ostrovnych++;
      eq(bunky, ostrovnych, n + 'x' + n + ': the islands do not cover the dry cells');
      assert(rr.ostrovy.length >= 2, n + 'x' + n + ': a meadow needs more than one island');
    }
  }
  assert(hotovych > pokusov * 0.8, 'too many meadows gave up: ' + hotovych + ' of ' + pokusov);
});

// ── solve ───────────────────────────────────────────────────────────────
test('solve finds exactly one meadow for the hand-verified 3 x 3 with a single 1', () => {
  const r = solve(STRED3, 3, { limit: 3 });
  eq(r.count, 1);
  eq(r.solution, STRED3_RIESENIE);
});
test('solve reports two meadows when the numbers do not pin one down', () => {
  const r = solve(DVA2, 2, { limit: 3 });
  eq(r.count, 2);
  for (const s of r.riesenia) eq(platnaLuka(s, DVA2, 2), [], 'the solver returned a meadow that breaks a rule');
});
test('solve reports no meadow when the water would be cut in two', () => {
  eq(solve(SPOR2, 2, { limit: 2 }).count, 0);
});
test('solve refuses a meadow with no water at all', () => {
  eq(solve(PLNE2, 2, { limit: 2 }).count, 0);
});
test('solve reports no meadow for a number bigger than the meadow', () => {
  eq(solve([9, null, null, null], 2, { limit: 2 }).count, 0);
});
test('solve stops at maxNodes and says so rather than pretending to know', () => {
  const r = solve(DVA2, 2, { limit: 3, maxNodes: 1 });
  assert(r.vycerpane, 'expected the search to run out of its budget');
});

// ── solveHuman ──────────────────────────────────────────────────────────
test('solveHuman finishes the hand-verified 3 x 3 and explains every step in plain English', () => {
  const r = solveHuman(STRED3, 3);
  assert(r.solved, 'not solved');
  eq(r.solution, STRED3_RIESENIE);
  assert(r.steps.length > 0, 'no steps');
  eq(r.layersUsed[3], 0, 'a single 1 should not need a trial');
  for (const s of r.steps) {
    assert(typeof s.rule === 'string' && s.rule.length, 'step without a rule name');
    assert(s.layer >= 1 && s.layer <= 3, 'step outside the three layers');
    assert(s.cells.length > 0, 'step without cells');
    for (const b of s.cells) {
      assert(b.val === 1 || b.val === 2, 'a step must shade water or claim an island cell');
      eq(indexPolicka(b.r, b.c, 3), b.i, 'cell address does not match its index');
    }
    assert(s.text.length > 20 && /[a-z]/.test(s.text) && s.text.endsWith('.'), 'step without a plain English sentence: ' + s.text);
    assert(s.text.indexOf('undefined') < 0 && s.text.indexOf('null') < 0, 'step text with a hole in it: ' + s.text);
  }
  assert(r.steps.some((s) => s.rule === 'one-alone'), 'the 1 in the middle should be used');
});
test('solveHuman gives up instead of guessing when the numbers do not pin the meadow down', () => {
  const r = solveHuman(DVA2, 2);
  assert(!r.solved, 'a guess-free solver must not finish an ambiguous puzzle');
});
test('solveHuman with maxVrstva 2 never records a layer 3 step', () => {
  const p = generateSeeded('x', 'layers/8', { n: 8, maxVrstva: 2 });
  const r = solveHuman(p.clues, 8, { maxVrstva: 2 });
  assert(r.solved);
  eq(r.layersUsed[3], 0);
});
test('solveHuman with limitKrokov 1 stops after one step (this is what Hint uses)', () => {
  const r = solveHuman(STRED3, 3, { limitKrokov: 1 });
  eq(r.steps.length, 1);
  assert(!r.solved, 'one step should not finish the puzzle');
});
test('solveHuman respects a starting board and only adds to it', () => {
  const zaciatok = new Uint8Array(9);
  zaciatok[0] = 1; // one corner already shaded, which is right
  const r = solveHuman(STRED3, 3, { initial: zaciatok });
  assert(r.solved);
  eq(r.solution, STRED3_RIESENIE);
});
test('solveHuman reports a contradiction rather than a meadow when the board is already wrong', () => {
  const zaciatok = new Uint8Array(9);
  zaciatok[4] = 1; // the cell with the 1 shaded as water
  const r = solveHuman(STRED3, 3, { initial: zaciatok });
  assert(!r.solved && r.contradiction, 'expected a contradiction');
});
test('every layer 3 step is a trial, and every trial stands up to the machine solver', () => {
  const p = generateSeeded('x', 'trials/10', { n: 10, maxVrstva: 3 });
  const r = solveHuman(p.clues, 10, { maxVrstva: 3 });
  assert(r.solved);
  for (const s of r.steps) {
    if (s.layer !== 3) continue;
    assert(s.rule === 'trial-water' || s.rule === 'trial-island', 'layer 3 rule is not a trial: ' + s.rule);
  }
  for (const s of r.steps) for (const b of s.cells) {
    const cakane = p.solution[b.i] === 1 ? 1 : 2;
    eq(b.val, cakane, 'the rule ' + s.rule + ' set cell ' + b.i + ' against the meadow');
  }
});

// ── generate / generateSeeded ────────────────────────────────────────────
test('generate is deterministic: the same date gives the same meadow', () => {
  const a = generate('2026-09-10'), b = generate('2026-09-10');
  eq(a.clues, b.clues);
  eq(a.solution, b.solution);
  eq(a.seed, b.seed);
  eq(a.attempts, b.attempts);
});
test('generateSeeded is deterministic per key and different keys give different meadows', () => {
  const a = generateSeeded('d', 'key/10', { n: 10 });
  const b = generateSeeded('d', 'key/10', { n: 10 });
  const c = generateSeeded('d', 'key/10#1', { n: 10 });
  eq(a.clues, b.clues);
  eq(a.solution, b.solution);
  assert(JSON.stringify(a.solution) !== JSON.stringify(c.solution), 'two keys gave the same meadow');
});
test('generate returns the expected shape', () => {
  const p = generate('2026-09-10');
  eq(p.date, '2026-09-10');
  eq(p.n, 8);
  eq(p.clues.length, 64);
  eq(p.solution.length, 64);
  for (const x of p.clues) assert(x === null || (Number.isInteger(x) && x >= 1), 'a number on the board must be a whole number of at least 1, got ' + x);
  for (const x of p.solution) assert(x === 0 || x === 1, 'the solution is 0 for an island cell and 1 for water, got ' + x);
  assert(Number.isInteger(p.seed) && Number.isInteger(p.attempts) && p.attempts >= 1);
  assert(Number.isInteger(p.difficulty.clues) && p.difficulty.clues > 0);
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
  eq(p.clues.length, 144);
  eq(p.solution.length, 144);
});
test('every meadow follows every rule, and its numbers sit on island cells', () => {
  for (const n of [6, 8, 10, 12]) {
    for (let k = 0; k < 3; k++) {
      const p = generateSeeded('luka-' + k, 'luka/' + n + '/' + k, { n });
      eq(platnaLuka(p.solution, p.clues, n), [], n + 'x' + n + ' candidate ' + k);
      let sucet = 0, ostrovnych = 0;
      for (let i = 0; i < n * n; i++) {
        if (p.clues[i] != null) { assert(p.solution[i] === 0, 'a number on a water cell at ' + i); sucet += p.clues[i]; }
        if (p.solution[i] === 0) ostrovnych++;
      }
      eq(sucet, ostrovnych, n + 'x' + n + ': the numbers do not add up to the dry cells');
      assert(p.difficulty.clues < n * n, 'the whole meadow is numbers at ' + n + 'x' + n);
    }
  }
});

test('every puzzle of 30 consecutive days, at every size, has exactly one meadow and needs no guessing', () => {
  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 10 + i));
    return d.toISOString().slice(0, 10);
  });
  const seen = new Set();
  for (const n of [6, 8, 10, 12]) {
    for (const d of dates) {
      const p = generateSeeded(d, d + '/' + n, { n });
      const key = n + ':' + p.solution.join('');
      assert(!seen.has(key), 'repeated meadow: ' + n + 'x' + n + ' ' + d);
      seen.add(key);
      const r = solve(p.clues, n, { limit: 2 });
      eq(r.count, 1, n + 'x' + n + ' ' + d + ' does not have exactly one meadow');
      eq(r.solution, p.solution, n + 'x' + n + ' ' + d + ' solver found a different meadow');
      const hu = solveHuman(p.clues, n);
      assert(hu.solved, n + 'x' + n + ' ' + d + ' cannot be finished without guessing');
      eq(hu.solution, p.solution, n + 'x' + n + ' ' + d + ' human rules ended somewhere else');
    }
  }
});

test('a whole day (six candidates) takes well under 4 seconds at every size, 12 x 12 included', () => {
  const KANDIDATOV = 6; // the same number plan.mjs makes for a date
  const dates = ['2026-09-10', '2026-11-15', '2027-02-07', '2027-06-20'];
  const casy = [];
  let najhorsi = 0;
  for (const n of [6, 8, 10, 12]) {
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
