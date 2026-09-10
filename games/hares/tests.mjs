/* Tests for the Hares generator. No framework: node tests.mjs
 * Prints "N passed, M failed" and exits with code 1 if anything fails. */
import {
  mulberry32, seedFromString, isValidDate, todayBratislava,
  blokRozmer, jadro, konflikty, sediPravidlam,
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
const SKOK = { knight: true, king: false };
const SKOK_DOTYK = { knight: true, king: true };
function zPolia(s) { return Array.from(s, (c) => c.charCodeAt(0) - 48); }

/* The four settings the week really uses (plan.mjs UROVNE). */
const NASTAVENIA = [
  { id: 'easy', n: 6, rules: SKOK, dane: 12, maxVrstva: 2 },
  { id: 'medium', n: 9, rules: SKOK, dane: 30, maxVrstva: 2 },
  { id: 'hard', n: 9, rules: SKOK_DOTYK, dane: 25, maxVrstva: 3 },
  { id: 'challenge', n: 9, rules: SKOK_DOTYK, dane: 20, maxVrstva: 3 },
];

/* Hand-checked 4 x 4 with blocks 2 x 2 and the knight rule.
     1 2 3 4
     4 3 2 1
     3 4 1 2
     2 1 4 3
   Every row, every column and every 2 x 2 block holds 1 to 4 once. The
   knight rule holds too: on a 4 x 4 board every burrow has exactly two
   knight leaps, and from row 1 column 1 they land on the 2 in row 2 column 3
   and the 4 in row 3 column 2, neither of them a 1. The other burrows are
   checked by the test with sediPravidlam.
   Given only its first row, this is the one meadow that fits: with 1, 2, 3,
   4 across the top, row 2 cannot start with anything but 4, because its
   block already holds the 1 and the 2 and a 3 there would sit a knight leap
   from the 3 in row 1, column 3. The rest follows the same way. */
const MALE_RIESENIE = zPolia('1234432134122143');

/* One number in a 4 x 4 grid, all four blocks empty otherwise: nowhere near
   enough to pin anything down, so the solver must report more than one. */
const MALE_ZADANIE_VOLNE = zPolia('1000000000000000');

/* A 6 x 6 puzzle whose human solution uses a naked pair (found by scanning
   seeded candidates, see the step the test looks for). */
const PAR_ZADANIE = zPolia('600230500600300000000000000400000003');
/* A 9 x 9 knight and king puzzle whose human solution uses a pointing pair. */
const POINTING_ZADANIE = zPolia(
  '005000000001400005400800000000604000010000000000050000000003900000000570900000043');

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

// ── The grid, its blocks and what a burrow sees ─────────────────────────
test('blokRozmer gives 2 by 3 blocks at 6 x 6 and 3 by 3 at 9 x 9', () => {
  eq(blokRozmer(6), { bh: 2, bw: 3 });
  eq(blokRozmer(9), { bh: 3, bw: 3 });
  eq(blokRozmer(4), { bh: 2, bw: 2 });
});
test('every size has 3n units of n burrows and every burrow is in exactly three of them', () => {
  for (const n of [6, 9]) {
    const J = jadro(n, SKOK);
    eq(J.units.length, 3 * n, n + ' units');
    for (const u of J.units) eq(u.cells.length, n, n + ' unit size');
    const kolko = new Array(n * n).fill(0);
    for (const u of J.units) for (const i of u.cells) kolko[i]++;
    for (let i = 0; i < n * n; i++) eq(kolko[i], 3, n + ' burrow ' + i);
  }
});
test('the knight leaps of a corner and of a middle burrow are exactly the ones a chess knight makes', () => {
  const J = jadro(9, SKOK);
  eq(J.skok[0], [11, 19], 'row 1, column 1');
  const stred = 4 * 9 + 4; // row 5, column 5
  eq(J.skok[stred].slice().sort((a, b) => a - b),
    [2 * 9 + 3, 2 * 9 + 5, 3 * 9 + 2, 3 * 9 + 6, 5 * 9 + 2, 5 * 9 + 6, 6 * 9 + 3, 6 * 9 + 5].sort((a, b) => a - b));
  assert(J.kral[stred].length === 0, 'the king rule is off here, so nothing touches');
});
test('with the king rule on, a middle burrow also watches its eight neighbours, corners included', () => {
  const J = jadro(9, SKOK_DOTYK);
  const stred = 4 * 9 + 4;
  eq(J.kral[stred].length, 8);
  for (const j of J.kral[stred]) {
    const dr = Math.abs(((j / 9) | 0) - 4), dc = Math.abs((j % 9) - 4);
    assert(dr <= 1 && dc <= 1 && (dr || dc), 'not a neighbour: ' + j);
  }
  // a burrow watches its own row, column, block, leaps and neighbours, never itself
  for (const j of J.peers[stred]) assert(j !== stred, 'a burrow must not watch itself');
});
test('the knight rule can be switched off, and then a knight leap is allowed to repeat', () => {
  const bez = jadro(9, { knight: false, king: false });
  eq(bez.skok[0], []);
  const v = new Array(81).fill(0);
  // row 1 column 4 and row 2 column 2: a knight leap apart, and in no other
  // way related (different row, different column, different block)
  v[3] = 5; v[10] = 5;
  eq(konflikty(v, 9, { knight: false, king: false }), []);
  eq(konflikty(v, 9, SKOK), [3, 10]);
});

// ── konflikty and sediPravidlam ─────────────────────────────────────────
test('sediPravidlam accepts the hand-checked 4 x 4 and konflikty finds nothing in it', () => {
  assert(sediPravidlam(MALE_RIESENIE, 4, SKOK), 'the fixture should follow every rule');
  eq(konflikty(MALE_RIESENIE, 4, SKOK), []);
});
test('sediPravidlam refuses a board that repeats a number in a row, and one with an empty burrow', () => {
  const zly = MALE_RIESENIE.slice(); zly[1] = 1;
  assert(!sediPravidlam(zly, 4, SKOK));
  const neuplny = MALE_RIESENIE.slice(); neuplny[5] = 0;
  assert(!sediPravidlam(neuplny, 4, SKOK));
});
test('konflikty points at both burrows of a knight leap that repeats and at a touching pair on king days', () => {
  const v = new Array(81).fill(0);
  v[0] = 7; v[19] = 7; // row 1 column 1 and row 3 column 2: a knight leap
  eq(konflikty(v, 9, SKOK), [0, 19]);
  const w = new Array(81).fill(0);
  w[0] = 3; w[10] = 3; // row 1 column 1 and row 2 column 2: touching corners
  eq(konflikty(w, 9, SKOK), [0, 10], 'they also share a block, so this is a clash either way');
  const u = new Array(81).fill(0);
  u[2] = 4; u[12] = 4; // row 1 column 3 and row 2 column 4: only the king rule catches this
  eq(konflikty(u, 9, SKOK), []);
  eq(konflikty(u, 9, SKOK_DOTYK), [2, 12]);
});

// ── solve ───────────────────────────────────────────────────────────────
test('solve finds exactly one meadow for the hand-checked 4 x 4 when enough is given', () => {
  const givens = MALE_RIESENIE.slice();
  for (let i = 4; i < 16; i++) givens[i] = 0; // only the first row is given
  const r = solve(givens, 4, SKOK, { limit: 3 });
  eq(r.count, 1);
  eq(r.solution, MALE_RIESENIE);
});
test('solve reports more than one meadow when the givens do not pin the puzzle down', () => {
  const r = solve(MALE_ZADANIE_VOLNE, 4, SKOK, { limit: 2 });
  eq(r.count, 2);
  assert(JSON.stringify(r.solutions[0]) !== JSON.stringify(r.solutions[1]), 'two different meadows expected');
  for (const s of r.solutions) assert(sediPravidlam(s, 4, SKOK), 'a reported meadow breaks a rule');
});
test('solve reports no meadow at all when two givens already contradict each other', () => {
  const zle = new Array(81).fill(0);
  zle[0] = 6; zle[19] = 6; // the same number a knight leap apart
  eq(solve(zle, 9, SKOK, { limit: 2 }).count, 0);
});
test('solve says so when it runs out of its node budget rather than pretending to know', () => {
  const r = solve(MALE_ZADANIE_VOLNE, 4, SKOK, { limit: 2, maxNodes: 1 });
  assert(r.vycerpane, 'expected the search to run out of its budget');
});
test('solve respects a board that is already partly filled in', () => {
  const givens = MALE_RIESENIE.slice();
  for (let i = 4; i < 16; i++) givens[i] = 0;
  const zaciatok = new Array(16).fill(0);
  zaciatok[4] = MALE_RIESENIE[4];
  eq(solve(givens, 4, SKOK, { limit: 3, initial: zaciatok }).count, 1);
  const zly = new Array(16).fill(0);
  zly[4] = MALE_RIESENIE[4] === 1 ? 2 : 1;
  eq(solve(givens, 4, SKOK, { limit: 3, initial: zly }).count, 0);
});
test('an empty 9 x 9 with the knight and the king rule still has meadows, and every one of them follows all the rules', () => {
  const r = solve(new Array(81).fill(0), 9, SKOK_DOTYK, { limit: 2 });
  eq(r.count, 2, 'the rules are strict but not impossible');
  for (const s of r.solutions) assert(sediPravidlam(s, 9, SKOK_DOTYK), 'a reported meadow breaks a rule');
});

// ── solveHuman ──────────────────────────────────────────────────────────
test('solveHuman finishes a puzzle with plain rules and explains every step in English', () => {
  const p = generateSeeded('x', 'human/6', { n: 6, rules: SKOK, dane: 12, maxVrstva: 2 });
  const r = solveHuman(p.givens, 6, SKOK);
  assert(r.solved, 'not solved');
  eq(r.solution, p.solution);
  eq(r.layersUsed[3], 0, 'a maxVrstva 2 puzzle should not need a trial');
  assert(r.steps.length > 10, 'too few steps: ' + r.steps.length);
  for (const s of r.steps) {
    assert(typeof s.rule === 'string' && s.rule.length, 'step without a rule name');
    assert(s.layer >= 1 && s.layer <= 3, 'step outside the three layers');
    eq(s.cells.length, 1, 'a step fills exactly one burrow');
    const c = s.cells[0];
    assert(c.val >= 1 && c.val <= 6, 'a step must write a number 1 to 6');
    eq(c.i, c.r * 6 + c.c, 'burrow index does not match its address');
    eq(p.solution[c.i], c.val, 'a step wrote a number the puzzle does not have there');
    assert(s.text.length > 20 && /[a-z]/.test(s.text) && s.text.endsWith('.'), 'step without a plain English sentence: ' + s.text);
    assert(!/[–—]/.test(s.text), 'no dashes in text shown to a person');
  }
});
test('solveHuman uses the knight leap and says so in English', () => {
  const p = generateSeeded('x', 'human/9-leap', { n: 9, rules: SKOK, dane: 24, maxVrstva: 3 });
  const r = solveHuman(p.givens, 9, SKOK);
  assert(r.solved, 'not solved');
  const skoky = r.steps.filter((s) => /knight leap/.test(s.text));
  assert(skoky.length > 0, 'the knight rule should carry at least one step');
  assert(skoky.some((s) => s.rule === 'naked-single-leap' || s.rule === 'hidden-single-leap'),
    'a step that leans on the leap should be named after it');
});
test('a hidden single that only the knight leap explains is a layer 2 step', () => {
  const p = generateSeeded('x', 'human/9-hidden', { n: 9, rules: SKOK_DOTYK, dane: 18, maxVrstva: 3 });
  const r = solveHuman(p.givens, 9, SKOK_DOTYK);
  assert(r.solved, 'not solved');
  const skryte = r.steps.filter((s) => s.rule === 'hidden-single-leap');
  assert(skryte.length > 0, 'expected at least one hidden single held by the leap');
  for (const s of skryte) eq(s.layer, 2, 'a hidden single that needs the leap belongs to layer 2');
  for (const s of r.steps.filter((x) => x.rule === 'hidden-single')) {
    eq(s.layer, 1, 'a plain hidden single belongs to layer 1');
  }
});
test('the naked pair rule works and explains itself', () => {
  const r = solveHuman(PAR_ZADANIE, 6, SKOK, { maxVrstva: 3 });
  assert(r.solved, 'the fixture should be solvable');
  const par = r.steps.filter((s) => s.rule === 'pair');
  assert(par.length > 0, 'the fixture was picked because it needs a naked pair');
  for (const s of par) {
    eq(s.layer, 2);
    assert(/can hold only/.test(s.text) && s.text.endsWith('.'), s.text);
    eq(r.solution[s.cells[0].i], s.cells[0].val, 'the pair step wrote a wrong number');
  }
});
test('the pointing pair rule works and explains itself', () => {
  const r = solveHuman(POINTING_ZADANIE, 9, SKOK_DOTYK, { maxVrstva: 3 });
  assert(r.solved, 'the fixture should be solvable');
  const uk = r.steps.filter((s) => s.rule === 'pointing');
  assert(uk.length > 0, 'the fixture was picked because it needs a pointing pair');
  for (const s of uk) {
    eq(s.layer, 2);
    assert(/fits only in/.test(s.text) && s.text.endsWith('.'), s.text);
    eq(r.solution[s.cells[0].i], s.cells[0].val, 'the pointing step wrote a wrong number');
  }
});
test('solveHuman gives up instead of guessing when the givens do not pin the puzzle down', () => {
  const r = solveHuman(MALE_ZADANIE_VOLNE, 4, SKOK);
  assert(!r.solved, 'a guess free solver must not finish an ambiguous puzzle');
});
test('solveHuman with maxVrstva 2 never records a layer 3 step', () => {
  const p = generateSeeded('x', 'layers/9', { n: 9, rules: SKOK, dane: 30, maxVrstva: 2 });
  const r = solveHuman(p.givens, 9, SKOK, { maxVrstva: 2 });
  assert(r.solved);
  eq(r.layersUsed[3], 0);
});
test('solveHuman with limitKrokov 1 stops after one step (this is what Hint uses)', () => {
  const p = generateSeeded('x', 'hint/6', { n: 6, rules: SKOK, dane: 12, maxVrstva: 2 });
  const r = solveHuman(p.givens, 6, SKOK, { limitKrokov: 1 });
  eq(r.steps.length, 1);
  assert(!r.solved, 'one step should not finish the puzzle');
});
test('solveHuman respects a starting board and only adds to it', () => {
  const p = generateSeeded('x', 'start/6', { n: 6, rules: SKOK, dane: 12, maxVrstva: 2 });
  const prazdne = [];
  for (let i = 0; i < 36; i++) if (!p.givens[i]) prazdne.push(i);
  const zaciatok = new Array(36).fill(0);
  zaciatok[prazdne[0]] = p.solution[prazdne[0]];
  const r = solveHuman(p.givens, 6, SKOK, { initial: zaciatok });
  assert(r.solved);
  eq(r.solution, p.solution);
  const bez = solveHuman(p.givens, 6, SKOK);
  eq(r.steps.length, bez.steps.length - 1, 'the burrow that is already filled in does not need a step');
});
test('solveHuman notices a board that contradicts the rules', () => {
  const p = generateSeeded('x', 'bad/6', { n: 6, rules: SKOK, dane: 12, maxVrstva: 2 });
  let i = -1;
  for (let k = 0; k < 36; k++) if (!p.givens[k]) { i = k; break; }
  const zly = new Array(36).fill(0);
  zly[i] = p.solution[i] === 6 ? 1 : p.solution[i] + 1;
  const r = solveHuman(p.givens, 6, SKOK, { initial: zly });
  assert(!r.solved, 'a board that cannot be finished must not be reported as solved');
});

// ── generate / generateSeeded ───────────────────────────────────────────
test('generate is deterministic: the same date gives the same puzzle', () => {
  const a = generate('2026-09-10'), b = generate('2026-09-10');
  eq(a.givens, b.givens);
  eq(a.solution, b.solution);
  eq(a.seed, b.seed);
  eq(a.attempts, b.attempts);
});
test('generateSeeded is deterministic per key and different keys give different puzzles', () => {
  const a = generateSeeded('d', 'key/9', { n: 9, rules: SKOK });
  const b = generateSeeded('d', 'key/9', { n: 9, rules: SKOK });
  const c = generateSeeded('d', 'key/9#1', { n: 9, rules: SKOK });
  eq(a.givens, b.givens);
  eq(a.solution, b.solution);
  assert(JSON.stringify(a.solution) !== JSON.stringify(c.solution), 'two keys gave the same puzzle');
});
test('generate returns the expected shape', () => {
  const p = generate('2026-09-10');
  eq(p.date, '2026-09-10');
  eq(p.n, 9);
  eq(p.rules, { knight: true, king: false });
  eq(p.givens.length, 81);
  eq(p.solution.length, 81);
  let dane = 0;
  for (let i = 0; i < 81; i++) {
    assert(p.solution[i] >= 1 && p.solution[i] <= 9, 'a burrow without a number in the solution');
    assert(p.givens[i] === 0 || p.givens[i] === p.solution[i], 'a given that the solution does not agree with');
    if (p.givens[i]) dane++;
  }
  eq(dane, p.difficulty.dane, 'the count of givens does not match');
  assert(Number.isInteger(p.seed) && Number.isInteger(p.attempts) && p.attempts >= 1);
  assert(Number.isInteger(p.difficulty.odobrate) && p.difficulty.odobrate > 0);
  assert(Number.isInteger(p.difficulty.steps) && p.difficulty.steps > 0);
  for (const l of [1, 2, 3]) assert(Number.isInteger(p.difficulty.layers[l]), 'no count for layer ' + l);
  assert(typeof p.ms === 'number' && p.ms >= 0);
});
test('generate rejects a bad date', () => {
  let threw = false;
  try { generate('10.9.2026'); } catch (e) { threw = true; }
  assert(threw);
});
test('generate respects the size, the rules and the number of givens asked for', () => {
  const p = generate('2026-01-02', { n: 6, rules: SKOK, dane: 12, maxVrstva: 2 });
  eq(p.n, 6);
  eq(p.givens.length, 36);
  eq(p.difficulty.dane, 12);
  const q = generate('2026-01-02', { n: 9, rules: SKOK_DOTYK, dane: 20, maxVrstva: 3 });
  eq(q.rules, { knight: true, king: true });
  eq(q.difficulty.dane, 20);
});
test('the solution of every setting follows every rule of that day', () => {
  for (const k of NASTAVENIA) {
    const p = generateSeeded('2026-04-01', '2026-04-01/' + k.id, k);
    assert(sediPravidlam(p.solution, k.n, k.rules), k.id + ' solution breaks a rule');
    eq(konflikty(p.solution, k.n, k.rules), [], k.id + ' solution has a conflict');
    eq(konflikty(p.givens, k.n, k.rules), [], k.id + ' givens contradict each other');
  }
});

test('every puzzle of 30 consecutive days, at every setting of the week, has exactly one solution and needs no guessing', () => {
  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 10 + i));
    return d.toISOString().slice(0, 10);
  });
  const seen = new Set();
  for (const k of NASTAVENIA) {
    for (const d of dates) {
      const p = generateSeeded(d, d + '/' + k.n + '/' + k.id, k);
      const key = k.id + ':' + p.givens.join('') + ':' + p.solution.join('');
      assert(!seen.has(key), 'repeated puzzle: ' + k.id + ' ' + d);
      seen.add(key);
      eq(p.difficulty.dane, k.dane, k.id + ' ' + d + ' did not reach the number of givens the level asks for');
      const r = solve(p.givens, k.n, k.rules, { limit: 2 });
      eq(r.count, 1, k.id + ' ' + d + ' does not have exactly one solution');
      eq(r.solution, p.solution, k.id + ' ' + d + ' solver found a different meadow');
      const hu = solveHuman(p.givens, k.n, k.rules, { maxVrstva: k.maxVrstva });
      assert(hu.solved, k.id + ' ' + d + ' cannot be finished without guessing');
      eq(hu.solution, p.solution, k.id + ' ' + d + ' human rules ended somewhere else');
      if (k.maxVrstva === 2) eq(hu.layersUsed[3], 0, k.id + ' ' + d + ' should never need a trial');
    }
  }
});

test('a whole day (six candidates) takes well under 4 seconds at every setting of the week', () => {
  const KANDIDATOV = 6; // the same number plan.mjs makes for a date
  const dates = ['2026-09-10', '2026-11-15', '2027-02-07', '2027-06-20'];
  const casy = [];
  let najhorsi = 0;
  for (const k of NASTAVENIA) {
    let max = 0, sucet = 0;
    for (const d of dates) {
      const t0 = performance.now();
      for (let c = 0; c < KANDIDATOV; c++) {
        generateSeeded(d, d + '/' + k.n + (c ? '#' + c : ''), k);
      }
      const ms = performance.now() - t0;
      sucet += ms; max = Math.max(max, ms);
    }
    casy.push('     ' + k.id.padEnd(10) + k.n + 'x' + k.n + ' ' + (k.rules.king ? 'knight and king' : 'knight').padEnd(16) +
      ' givens ' + String(k.dane).padStart(2) + ', maxVrstva ' + k.maxVrstva +
      ': avg ' + (sucet / dates.length).toFixed(0) + ' ms, slowest day ' + max.toFixed(0) + ' ms');
    najhorsi = Math.max(najhorsi, max);
    assert(max < 4000, k.id + ' took ' + max.toFixed(0) + ' ms for one day, the limit is 4000 ms');
  }
  for (const c of casy) console.log(c);
  console.log('     slowest day of any setting: ' + najhorsi.toFixed(0) + ' ms');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exitCode = 1;
