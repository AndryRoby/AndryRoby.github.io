/* Tests for the Cranes generator. No framework: node tests.mjs
 * Prints "N passed, M failed" and exits with code 1 if anything fails. */
import {
  mulberry32, seedFromString, isValidDate, todayBratislava,
  graf, poleLaviek, rovnakeLavky, solve, solveHuman,
  generate, generateSeeded, ROZSAH_OSTROVOV,
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

/* ── Hand verified fixtures ──────────────────────────────────────────── */

/* Four sandbanks at the corners of a 3 x 3 grid of points. Each one reaches
   two others, so the four pairs form a ring. With a 2 on every sandbank there
   is exactly one answer: write x for the walkways between the top pair and
   the numbers force the left pair to 2 - x, the right pair to 2 - x and the
   bottom pair back to x. x = 0 leaves the left and right pairs doubled and
   splits the board in two, x = 2 does the same the other way round, so only
   x = 1 keeps every sandbank reachable: the ring of single walkways. */
const STVOREC = (x) => [
  { r: 0, c: 0, n: x }, { r: 0, c: 2, n: x }, { r: 2, c: 0, n: x }, { r: 2, c: 2, n: x },
];
const STVOREC2_RIESENIE = [
  { a: 0, b: 1, k: 1 }, { a: 0, b: 2, k: 1 }, { a: 1, b: 3, k: 1 }, { a: 2, b: 3, k: 1 },
];

/* The same square with a 3 everywhere: now x can be 1 or 2 and both answers
   keep the board in one piece, so the puzzle has two solutions and a person
   would have to guess. */

/* Three sandbanks in a row, 1 and 2 and 1: both end sandbanks reach only the
   middle one, so both walkways are single and the middle 2 is satisfied. */
const RAD121 = [{ r: 0, c: 0, n: 1 }, { r: 0, c: 2, n: 2 }, { r: 0, c: 4, n: 1 }];

/* A cross: a 1 above, below, left and right of the same empty point. The
   sandbank above reaches only the one below, and the one on the left only the
   one on the right, so both walkways are forced, and they would cross. There
   is no answer at all. */
const KRIZ = [{ r: 0, c: 1, n: 1 }, { r: 1, c: 0, n: 1 }, { r: 1, c: 2, n: 1 }, { r: 2, c: 1, n: 1 }];

/* Every sandbank has as many walkways as its number, no two walkways cross,
   and the whole board hangs together. Used to check what the solvers return. */
function jeCele(islands, riesenie, n) {
  const g = graf(islands, n);
  const v = poleLaviek(riesenie, g);
  for (let i = 0; i < g.C; i++) {
    let s = 0;
    for (const e of g.hraneOstrova[i]) s += v[e];
    if (s !== islands[i].n) return false;
  }
  for (let e = 0; e < g.E; e++) {
    if (v[e] < 1) continue;
    for (const f of g.krizenia[e]) if (v[f] >= 1) return false;
  }
  const videne = new Uint8Array(g.C), front = [0];
  videne[0] = 1;
  let dosiahnute = 1;
  while (front.length) {
    const i = front.pop();
    for (const e of g.hraneOstrova[i]) {
      if (v[e] < 1) continue;
      const j = g.pary[e].a === i ? g.pary[e].b : g.pary[e].a;
      if (!videne[j]) { videne[j] = 1; dosiahnute++; front.push(j); }
    }
  }
  return dosiahnute === g.C;
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

// ── graf ────────────────────────────────────────────────────────────────
test('graf finds the four pairs of the hand verified square and no crossing', () => {
  const g = graf(STVOREC(2), 3);
  eq(g.C, 4); eq(g.E, 4);
  eq(g.pary.map((p) => p.a + '-' + p.b), ['0-1', '0-2', '1-3', '2-3']);
  for (const kr of g.krizenia) eq(kr, []);
  eq(g.hraneOstrova[0], [0, 1]);
  eq(g.indexPary(3, 1), 2, 'indexPary should not care about the order');
  eq(g.indexPary(0, 3), -1, 'those two are not in line');
});
test('graf only pairs a sandbank with the first one in each direction', () => {
  const rad = [{ r: 0, c: 0, n: 1 }, { r: 0, c: 2, n: 2 }, { r: 0, c: 4, n: 1 }];
  const g = graf(rad, 5);
  eq(g.pary.map((p) => p.a + '-' + p.b), ['0-1', '1-2'], 'the middle sandbank blocks the long pair');
});
test('graf spots two walkways that would cross', () => {
  const g = graf(KRIZ, 3);
  eq(g.E, 2);
  eq(g.krizenia[0], [1]);
  eq(g.krizenia[1], [0]);
});
test('graf reports no crossing for walkways that only share a line', () => {
  // vodorovná lávka v riadku 1 a zvislá, ktorá sa končí na jej úrovni
  const isl = [{ r: 1, c: 0, n: 1 }, { r: 1, c: 4, n: 1 }, { r: 1, c: 2, n: 2 }, { r: 3, c: 2, n: 1 }];
  const g = graf(isl, 5);
  for (const kr of g.krizenia) eq(kr, [], 'walkways that meet at a sandbank do not cross');
});

// ── solve ───────────────────────────────────────────────────────────────
test('solve finds exactly one answer for the hand verified square of 2s', () => {
  const r = solve(STVOREC(2), 3, { limit: 3 });
  eq(r.count, 1);
  eq(r.solution, STVOREC2_RIESENIE);
  assert(jeCele(STVOREC(2), r.solution, 3));
});
test('solve finds both answers for the hand verified square of 3s', () => {
  const r = solve(STVOREC(3), 3, { limit: 5 });
  eq(r.count, 2, 'the square of 3s is the ambiguous one');
});
test('solve finds exactly one answer for the row 1, 2, 1', () => {
  const r = solve(RAD121, 5, { limit: 3 });
  eq(r.count, 1);
  eq(r.solution, [{ a: 0, b: 1, k: 1 }, { a: 1, b: 2, k: 1 }]);
});
test('solve refuses an answer whose walkways would have to cross', () => {
  eq(solve(KRIZ, 3, { limit: 2 }).count, 0);
});
test('solve refuses an answer that would leave the board in two pieces', () => {
  // dva páry, každý ostrov s číslom 2: obe dvojice by boli dvojité a
  // navzájom oddelené
  const dva = [{ r: 0, c: 0, n: 2 }, { r: 0, c: 2, n: 2 }, { r: 4, c: 0, n: 2 }, { r: 4, c: 2, n: 2 }];
  const g = graf(dva, 5);
  assert(g.E === 4, 'fixture should have four pairs, got ' + g.E);
  const r = solve(dva, 5, { limit: 2 });
  eq(r.count, 1, 'only the ring keeps the board in one piece');
  for (const m of r.solution) eq(m.k, 1);
});
test('solve reports no answer for numbers that contradict each other', () => {
  eq(solve([{ r: 0, c: 0, n: 3 }, { r: 0, c: 2, n: 1 }], 3, { limit: 2 }).count, 0);
});
test('solve stops at maxNodes and says so rather than pretending to know', () => {
  const r = solve(STVOREC(3), 3, { limit: 3, maxNodes: 1 });
  assert(r.vycerpane, 'expected the search to run out of its budget');
});
test('solve honours a starting board given as lower bounds', () => {
  // v štvorci 3 stačí jedna určená dvojica a zvyšok dopadne jednoznačne
  const g = graf(STVOREC(3), 3);
  const start = new Uint8Array(g.E);
  start[0] = 2; // dve lávky medzi ostrovmi 0 a 1
  const r = solve(STVOREC(3), 3, { limit: 3, initial: start, graf: g });
  eq(r.count, 1);
  eq(r.solution[0], { a: 0, b: 1, k: 2 });
});

// ── solveHuman ──────────────────────────────────────────────────────────
test('solveHuman finishes the hand verified square of 2s and explains every step in English', () => {
  const r = solveHuman(STVOREC(2), 3);
  assert(r.solved, 'not solved');
  eq(r.solution, STVOREC2_RIESENIE);
  assert(r.steps.length > 0, 'no steps');
  eq(r.layersUsed[3], 0, 'the square should not need a trial');
  assert(r.layersUsed[2] > 0, 'the square needs the layer 2 pattern to start');
  for (const s of r.steps) {
    assert(typeof s.rule === 'string' && s.rule.length, 'step without a rule name');
    assert(s.layer >= 1 && s.layer <= 3, 'step outside the three layers');
    assert(s.edges.length > 0, 'step without pairs');
    for (const d of s.edges) {
      assert(Number.isInteger(d.a) && Number.isInteger(d.b) && d.a < d.b, 'bad pair');
      assert(d.val >= 0 && d.val <= 2, 'a step must settle a count of 0, 1 or 2');
    }
    assert(s.text.length > 20 && /[a-z]/.test(s.text) && s.text.endsWith('.'), 'step without a plain English sentence: ' + s.text);
    assert(!/[–—]/.test(s.text), 'no dashes in text meant for a person: ' + s.text);
  }
});
test('solveHuman gives up instead of guessing on the ambiguous square of 3s', () => {
  const r = solveHuman(STVOREC(3), 3);
  assert(!r.solved, 'a guess-free solver must not finish an ambiguous puzzle');
});
test('solveHuman uses the all-double rule when a number is twice its count of neighbours', () => {
  // ručne overené: 4 v ľavom hornom rohu, 2 napravo od neho a 2 pod ním.
  // Štvorka dosiahne práve tie dva ostrovy a potrebuje štyri lávky, takže
  // obe dvojice sú dvojité, a tým sú aj obe dvojky hotové.
  const rad = [{ r: 0, c: 0, n: 4 }, { r: 0, c: 3, n: 2 }, { r: 3, c: 0, n: 2 }];
  const r = solveHuman(rad, 5);
  assert(r.solved);
  eq(r.solution, [{ a: 0, b: 1, k: 2 }, { a: 0, b: 2, k: 2 }]);
  const s = r.steps.find((x) => x.rule === 'all-double');
  assert(s, 'the all-double rule should be named here');
  assert(/reaches only 2 other sandbanks/.test(s.text), 'the sentence should count the neighbours: ' + s.text);
  // Prvá polovica vety nesmie prezradiť počet lávok, ten patrí za " That settles".
  const hlava = s.text.slice(0, s.text.indexOf(' That settles'));
  assert(hlava.length > 20, 'the all-double sentence must keep its counts behind the marker: ' + s.text);
  assert(!/walkway/.test(hlava), 'the first half must not say how many walkways: ' + hlava);
  eq(solve(rad, 5, { limit: 3 }).count, 1);
});
test('a 2 with a single neighbour reads as the single neighbour rule, not as all-double', () => {
  const dvojica = [{ r: 0, c: 0, n: 2 }, { r: 0, c: 2, n: 2 }];
  const r = solveHuman(dvojica, 3);
  assert(r.solved);
  eq(r.solution, [{ a: 0, b: 1, k: 2 }]);
  eq(r.steps[0].rule, 'one-neighbour');
  const t = r.steps[0].text;
  const hlava = t.slice(0, t.indexOf(' That settles'));
  assert(/can reach only one other sandbank/.test(hlava), t);
  assert(!/walkway/.test(hlava), 'the first half must not say how many walkways: ' + hlava);
  assert(/ That settles it: two walkways/.test(t), t);
});
test('every step sentence keeps its counts behind " That settles", so the first Hint press can hide them', () => {
  // game.js delí vetu presne na tomto mieste (prvý stlač bez hodnoty, druhý
  // s hodnotou). Keby ju niektoré pravidlo nemalo, prvý stlač by prezradil
  // celú odpoveď, ako to kedysi robili one-neighbour a all-double.
  const videne = new Set();
  const dni = ['2025-09-10', '2025-09-13', '2025-09-16', '2025-09-21', '2026-01-04', '2026-03-15'];
  for (const n of [7, 9, 11, 13]) {
    for (const d of dni) {
      const p = generateSeeded(d, d + '/' + n, { n, ostrovy: ROZSAH_OSTROVOV[n] });
      const r = solveHuman(p.islands, n, { graf: graf(p.islands, n) });
      for (const s of r.steps) {
        videne.add(s.rule);
        const k = s.text.indexOf(' That settles');
        assert(k > 0, 'a step whose count is not held back: ' + s.rule + ' / ' + s.text);
        assert(s.text.slice(k).endsWith('.'), s.text);
      }
    }
  }
  for (const r of ['one-neighbour', 'needs-all', 'island-full', 'no-crossing', 'pair-isolation']) {
    assert(videne.has(r), 'these days should have used the rule ' + r);
  }
  // Ostatné dve pravidlá vrstvy 1 majú vlastné fixtúry vyššie v tomto súbore.
  const doDvojice = solveHuman([{ r: 0, c: 0, n: 4 }, { r: 0, c: 3, n: 2 }, { r: 3, c: 0, n: 2 }], 5);
  for (const s of doDvojice.steps) assert(s.text.indexOf(' That settles') > 0, s.rule + ' / ' + s.text);
});
test('solveHuman finishes the row 1, 2, 1 with layer 1 alone', () => {
  const r = solveHuman(RAD121, 5);
  assert(r.solved);
  eq(r.layersUsed[2], 0); eq(r.layersUsed[3], 0);
  assert(r.steps.some((s) => s.rule === 'one-neighbour'), 'the single neighbour rule should be used');
});
test('solveHuman sees the contradiction in the crossing fixture', () => {
  const r = solveHuman(KRIZ, 3);
  assert(!r.solved);
  assert(r.contradiction, 'two forced walkways that cross are a contradiction');
});
test('solveHuman with maxVrstva 2 never records a layer 3 step', () => {
  const p = generateSeeded('x', 'layers/9', { n: 9, maxVrstva: 2 });
  const r = solveHuman(p.islands, 9, { maxVrstva: 2 });
  assert(r.solved);
  eq(r.layersUsed[3], 0);
});
test('solveHuman with limitKrokov 1 stops after one step', () => {
  const r = solveHuman(RAD121, 5, { limitKrokov: 1 });
  eq(r.steps.length, 1);
  assert(!r.solved, 'one step should not finish the puzzle');
});
test('solveHuman with stopPriLavke stops as soon as a step draws a walkway (this is what Hint uses)', () => {
  const r = solveHuman(STVOREC(2), 3, { stopPriLavke: true });
  assert(!r.solved);
  const posledny = r.steps[r.steps.length - 1];
  assert(posledny.edges.some((d) => d.val >= 1), 'the last step should be the one that draws');
  for (let i = 0; i < r.steps.length - 1; i++) {
    assert(!r.steps[i].edges.some((d) => d.val >= 1), 'it should have stopped at the first drawn walkway');
  }
});
test('solveHuman respects walkways already drawn and only adds to them', () => {
  const g = graf(STVOREC(2), 3);
  const start = new Uint8Array(g.E);
  start[0] = 1;
  const r = solveHuman(STVOREC(2), 3, { initial: start, graf: g });
  assert(r.solved);
  eq(r.solution, STVOREC2_RIESENIE);
});

// ── generate / generateSeeded ────────────────────────────────────────────
test('generate is deterministic: the same date gives the same puzzle', () => {
  const a = generate('2026-09-10'), b = generate('2026-09-10');
  eq(a.islands, b.islands);
  eq(a.bridges, b.bridges);
  eq(a.seed, b.seed);
  eq(a.attempts, b.attempts);
});
test('generateSeeded is deterministic per key and different keys give different puzzles', () => {
  const a = generateSeeded('d', 'key/11', { n: 11 });
  const b = generateSeeded('d', 'key/11', { n: 11 });
  const c = generateSeeded('d', 'key/11#1', { n: 11 });
  eq(a.islands, b.islands);
  eq(a.bridges, b.bridges);
  assert(JSON.stringify(a.bridges) !== JSON.stringify(c.bridges), 'two keys gave the same puzzle');
});
test('generate returns the expected shape', () => {
  const p = generate('2026-09-10');
  eq(p.date, '2026-09-10');
  eq(p.n, 9);
  const [lo, hi] = ROZSAH_OSTROVOV[9];
  assert(p.islands.length >= lo && p.islands.length <= hi, 'sandbank count out of the band: ' + p.islands.length);
  for (const o of p.islands) {
    assert(Number.isInteger(o.r) && Number.isInteger(o.c) && o.r >= 0 && o.c >= 0 && o.r < 9 && o.c < 9, 'sandbank off the grid');
    assert(o.n >= 1 && o.n <= 8, 'a number must be 1 to 8, got ' + o.n);
  }
  for (const m of p.bridges) {
    assert(m.a < m.b, 'a walkway must be stored with the smaller index first');
    assert(m.k === 1 || m.k === 2, 'at most two walkways between the same pair');
  }
  assert(Number.isInteger(p.seed) && Number.isInteger(p.attempts) && p.attempts >= 1);
  assert(Number.isInteger(p.difficulty.ostrovy) && p.difficulty.ostrovy === p.islands.length);
  assert(Number.isInteger(p.difficulty.lavky) && p.difficulty.lavky > 0);
  assert(Number.isInteger(p.difficulty.steps) && p.difficulty.steps > 0);
  for (const l of [1, 2, 3]) assert(Number.isInteger(p.difficulty.layers[l]), 'no count for layer ' + l);
});
test('generate rejects a bad date', () => {
  let threw = false;
  try { generate('10.9.2026'); } catch (e) { threw = true; }
  assert(threw);
});
test('generate respects the grid and the sandbank band (13 x 13)', () => {
  const p = generate('2026-01-02', { n: 13, ostrovy: ROZSAH_OSTROVOV[13] });
  eq(p.n, 13);
  assert(p.islands.length >= 26 && p.islands.length <= 30, 'sandbanks: ' + p.islands.length);
});
test('the numbers on the board are exactly the walkways of the solution', () => {
  for (const n of [7, 9, 11, 13]) {
    const p = generateSeeded('2026-03-01', '2026-03-01/' + n, { n, ostrovy: ROZSAH_OSTROVOV[n] });
    const g = graf(p.islands, n);
    const v = poleLaviek(p.bridges, g);
    for (let i = 0; i < g.C; i++) {
      let s = 0;
      for (const e of g.hraneOstrova[i]) s += v[e];
      eq(s, p.islands[i].n, n + 'x' + n + ' sandbank ' + i);
    }
  }
});
test('no two sandbanks sit next to each other and none stands on a walkway', () => {
  for (const n of [7, 9, 11, 13]) {
    for (let k = 0; k < 3; k++) {
      const p = generateSeeded('layout-' + k, 'layout/' + n + '/' + k, { n, ostrovy: ROZSAH_OSTROVOV[n] });
      const obsadene = new Set(p.islands.map((o) => o.r * n + o.c));
      eq(obsadene.size, p.islands.length, 'two sandbanks on the same point');
      for (const o of p.islands) {
        for (const [dr, dc] of [[-1, 0], [0, 1], [1, 0], [0, -1]]) {
          const r = o.r + dr, c = o.c + dc;
          if (r < 0 || c < 0 || r >= n || c >= n) continue;
          assert(!obsadene.has(r * n + c), n + 'x' + n + ' two sandbanks touching at row ' + (r + 1) + ', column ' + (c + 1));
        }
      }
      for (const m of p.bridges) {
        const A = p.islands[m.a], B = p.islands[m.b];
        assert(A.r === B.r || A.c === B.c, 'a walkway that is not straight');
        if (A.r === B.r) {
          for (let c = Math.min(A.c, B.c) + 1; c < Math.max(A.c, B.c); c++) {
            assert(!obsadene.has(A.r * n + c), n + 'x' + n + ' a walkway runs through a sandbank');
          }
        } else {
          for (let r = Math.min(A.r, B.r) + 1; r < Math.max(A.r, B.r); r++) {
            assert(!obsadene.has(r * n + A.c), n + 'x' + n + ' a walkway runs through a sandbank');
          }
        }
      }
    }
  }
});
test('every puzzle hangs together, has no crossing and satisfies every number', () => {
  for (const n of [7, 9, 11, 13]) {
    for (let k = 0; k < 4; k++) {
      const p = generateSeeded('cele-' + k, 'cele/' + n + '/' + k, { n, ostrovy: ROZSAH_OSTROVOV[n] });
      assert(jeCele(p.islands, p.bridges, n), n + 'x' + n + ' candidate ' + k + ' is not a finished board');
    }
  }
});

test('every puzzle of 30 consecutive days, at every size, has exactly one answer and needs no guessing', () => {
  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 10 + i));
    return d.toISOString().slice(0, 10);
  });
  const seen = new Set();
  for (const n of [7, 9, 11, 13]) {
    for (const d of dates) {
      const p = generateSeeded(d, d + '/' + n, { n, ostrovy: ROZSAH_OSTROVOV[n] });
      const key = n + ':' + p.islands.map((o) => o.r + ',' + o.c + ',' + o.n).join(';');
      assert(!seen.has(key), 'repeated puzzle: ' + n + 'x' + n + ' ' + d);
      seen.add(key);
      const g = graf(p.islands, n);
      const r = solve(p.islands, n, { limit: 2, graf: g });
      eq(r.count, 1, n + 'x' + n + ' ' + d + ' does not have exactly one answer');
      assert(rovnakeLavky(r.solution, p.bridges), n + 'x' + n + ' ' + d + ' solver found different walkways');
      const hu = solveHuman(p.islands, n, { graf: g });
      assert(hu.solved, n + 'x' + n + ' ' + d + ' cannot be finished without guessing');
      assert(rovnakeLavky(hu.solution, p.bridges), n + 'x' + n + ' ' + d + ' human rules ended somewhere else');
    }
  }
});

test('a whole day (six candidates) takes well under 4 seconds at every size, 13 x 13 included', () => {
  const KANDIDATOV = 6; // the same number plan.mjs makes for a date
  const dates = ['2026-09-10', '2026-11-15', '2027-02-07', '2027-06-20'];
  const casy = [];
  let najhorsi = 0;
  for (const n of [7, 9, 11, 13]) {
    let max = 0, sucet = 0;
    for (const d of dates) {
      const t0 = performance.now();
      // The slowest setting a level ever uses: layer 3 allowed. Easy and
      // Medium run with maxVrstva 2, which is faster still.
      for (let k = 0; k < KANDIDATOV; k++) {
        generateSeeded(d, d + '/' + n + (k ? '#' + k : ''), { n, ostrovy: ROZSAH_OSTROVOV[n], maxVrstva: 3 });
      }
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
