/* Tests for the Beavers generator and solvers. No framework: node tests.mjs
 * Prints "N passed, M failed" and exits with code 1 if anything fails.
 * The numbered tests follow part 13 of ops/spec-beavers.md. */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mulberry32, seedFromString, isValidDate, todayBratislava,
  geometria, susedia4, dotyk8, poloha, parovanie, uplneParovanie, rozsahStromov, maBlokStromov,
  solve, solveHuman, generate, generateSeeded, pravidloNadStavom, MAX_RETAZ,
} from './generator.mjs';
import { zbal, rozbal, UROVNE, obtiaznost, KANDIDATOV, NAVYSE, vyber, PORADIE, MIN_L2, zadaniePreDen, urovenDna, posunDen } from './plan.mjs';
import { jeVyriesene, napoveda } from './logika.mjs';

const TU = dirname(fileURLToPath(import.meta.url));
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

/* The levels as the daily plan runs them. */
const LEVELS = Object.values(UROVNE).map((u) => ({ n: u.n, maxVrstva: u.maxVrstva }));
const DATES = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 8, 10 + i)).toISOString().slice(0, 10));
/* Every pond of the 30 days at every level, generated once and reused. */
const PONDS = [];
for (const lv of LEVELS) for (const d of DATES) PONDS.push({ d, ...lv, p: generateSeeded(d, d + '/' + lv.n, lv) });

/* Hand-built 5 x 5 (verified on paper). Trees in row 1, column 1 and row 1,
   column 3 share the one lodge between them, row 1, column 2; the tree in
   row 4, column 3 has two lodges, row 4, column 2 and row 4, column 4. Three
   trees, three lodges, no two lodges touch, every lodge has a tree beside it
   and the numbers are those of the board, but the first two trees cannot
   both have a lodge of their own. */
const DELENY = { n: 5, trees: [0, 2, 17], rows: [1, 0, 0, 2, 0], cols: [0, 2, 0, 1, 0] };
const DELENY_V = (() => { const v = new Array(25).fill(0); for (const h of [1, 16, 18]) v[h] = 1; return v; })();

// ── PRNG and dates ────────────────────────────────────────────────────────
test('mulberry32 gives the same sequence for the same seed', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 100; i++) assert(a() === b(), 'difference at step ' + i);
});
test('seedFromString is deterministic and sensitive to every character', () => {
  assert(seedFromString('2026-09-10') === seedFromString('2026-09-10'));
  assert(seedFromString('2026-09-10') !== seedFromString('2026-09-11'));
});
test('isValidDate accepts only real dates in YYYY-MM-DD form', () => {
  assert(isValidDate('2026-09-10'));
  assert(isValidDate('2024-02-29'));
  assert(!isValidDate('2026-02-30'));
  assert(!isValidDate('2026-13-01'));
  assert(!isValidDate('2026/09/10'));
});
test('todayBratislava respects the time zone (23:30 UTC is already the next day)', () => {
  assert(isValidDate(todayBratislava()));
  eq(todayBratislava(new Date(Date.UTC(2026, 6, 15, 23, 30))), '2026-07-16');
  eq(todayBratislava(new Date(Date.UTC(2026, 0, 15, 12, 0))), '2026-01-15');
});

// ── Geometry and pairing ──────────────────────────────────────────────────
test('susedia4 and dotyk8 count the cells around a corner, an edge and the middle', () => {
  eq(susedia4(0, 5).sort((a, b) => a - b), [1, 5]);
  eq(dotyk8(0, 5).sort((a, b) => a - b), [1, 5, 6]);
  eq(susedia4(12, 5).sort((a, b) => a - b), [7, 11, 13, 17]);
  eq(dotyk8(12, 5).length, 8);
  eq(dotyk8(2, 5).length, 5);
  eq(geometria(5).lines.length, 10);
  eq(poloha(7, 5), 'row 2, column 3');
});
test('parovanie finds the largest pairing and refuses the shared lodge', () => {
  eq(parovanie([0, 2, 17], [1, 16, 18], 5), 2);
  assert(!uplneParovanie([0, 2, 17], [1, 16, 18], 5));
  // A lodge on each side of the middle tree, plus one tree each: a full pairing.
  assert(uplneParovanie([0, 17], [1, 16], 5));
});
test('rozsahStromov follows the table of the specification', () => {
  eq(rozsahStromov(8), [10, 12]);
  eq(rozsahStromov(10), [15, 18]);
  eq(rozsahStromov(12), [22, 26]);
  eq(rozsahStromov(14), [29, 35]);
});

// ── solve on hand made ponds ─────────────────────────────────────────────
test('solve refuses the shared lodge: the numbers fit, the pairing does not', () => {
  eq(solve(DELENY, { limit: 5 }).count, 0);
  assert(!jeVyriesene(DELENY_V, DELENY));
});
test('solve reads hand made 3 x 3 ponds right (verified on paper)', () => {
  // A single tree in the middle; the numbers say row 1 and column 2, so the
  // lodge sits right above the tree.
  const z = { n: 3, trees: [4], rows: [1, 0, 0], cols: [0, 1, 0] };
  const r = solve(z, { limit: 3 });
  eq(r.count, 1);
  eq(r.solution, [0, 1, 0, 0, 0, 0, 0, 0, 0]);
  // The same tree, the numbers say row 2 and column 1: left of the tree.
  eq(solve({ n: 3, trees: [4], rows: [0, 1, 0], cols: [1, 0, 0] }, { limit: 3 }).solution, [0, 0, 0, 1, 0, 0, 0, 0, 0]);
  // Two trees in the middle row, lodges in both bottom corners.
  eq(solve({ n: 3, trees: [3, 5], rows: [0, 0, 2], cols: [1, 0, 1] }, { limit: 3 }).count, 1);
  // The same two trees with lodges wanted in rows 1 and 3, one in each outer
  // column: top left with bottom right, or top right with bottom left. Two answers.
  eq(solve({ n: 3, trees: [3, 5], rows: [1, 0, 1], cols: [1, 0, 1] }, { limit: 3 }).count, 2);
  // A number that asks for a lodge where no tree stands beside: no answer.
  eq(solve({ n: 3, trees: [0], rows: [0, 0, 1], cols: [0, 0, 1] }, { limit: 3 }).count, 0);
});
test('solve stops at maxNodes and says so rather than pretending to know', () => {
  const p = PONDS.find((x) => x.n === 14).p;
  const r = solve({ n: 14, trees: p.trees, rows: p.rows, cols: p.cols }, { limit: 2, maxNodes: 3 });
  assert(r.vycerpane, 'expected the search to run out of its budget');
});

// ── 1. Determinism ────────────────────────────────────────────────────────
test('1. the same key gives the same packed record, byte for byte', () => {
  for (const lv of LEVELS) {
    const a = zbal({ ...generateSeeded('d', 'det/' + lv.n, lv), uroven: 'x' });
    const b = zbal({ ...generateSeeded('d', 'det/' + lv.n, lv), uroven: 'x' });
    eq(JSON.stringify(a), JSON.stringify(b), 'n ' + lv.n);
  }
  const x = generate('2026-09-10'), y = generate('2026-09-10');
  eq(x.trees, y.trees);
  eq(x.solution, y.solution);
  const z = generateSeeded('d', 'det/8#1', { n: 8 });
  assert(JSON.stringify(z.solution) !== JSON.stringify(generateSeeded('d', 'det/8', { n: 8 }).solution), 'two keys gave the same pond');
});

// ── 2. Uniqueness ─────────────────────────────────────────────────────────
test('2. every pond of 30 consecutive days at all four levels has exactly one answer, the source one', () => {
  for (const { d, n, p } of PONDS) {
    const r = solve({ n, trees: p.trees, rows: p.rows, cols: p.cols }, { limit: 2 });
    assert(!r.vycerpane, n + 'x' + n + ' ' + d + ' ran out of its search budget');
    eq(r.count, 1, n + 'x' + n + ' ' + d + ' does not have exactly one answer');
    eq(r.solution, p.solution, n + 'x' + n + ' ' + d + ' the search found a different pond');
  }
});

// ── 3. Independent brute force ───────────────────────────────────────────
/* Every subset of the candidate cells (not a tree, a tree beside it) of the
   size of the number of trees, judged by jeVyriesene. Written from the rules,
   not from solve, so a bug in the pairing inside solve cannot hide here. */
function hrubaSila(z) {
  const n = z.n, C = n * n;
  const isTree = new Uint8Array(C);
  for (const t of z.trees) isTree[t] = 1;
  const kand = [];
  for (let i = 0; i < C; i++) if (!isTree[i] && susedia4(i, n).some((y) => isTree[y])) kand.push(i);
  const T = z.trees.length;
  let pocet = 0;
  const v = new Array(C).fill(0);
  (function rek(j, zostava) {
    if (!zostava) { if (jeVyriesene(v, z)) pocet++; return; }
    for (let q = j; q <= kand.length - zostava; q++) {
      v[kand[q]] = 1;
      rek(q + 1, zostava - 1);
      v[kand[q]] = 0;
    }
  })(0, T);
  return pocet;
}
test('3. on 50 random 6 x 6 ponds (ambiguous and impossible ones too) solve counts exactly what brute force counts', () => {
  const rng = mulberry32(seedFromString('hruba-sila'));
  const n = 6, C = 36;
  const g = geometria(n);
  let viac = 0, ziadne = 0, jedno = 0, zdielane = 0;
  for (let k = 0; k < 50; k++) {
    const strom = new Uint8Array(C), hrad = new Uint8Array(C);
    const T = 4 + Math.floor(rng() * 3);
    if (k % 2 === 0) {
      // lodges first, then a tree beside each, no filters at all
      const hrady = [];
      for (let pokus = 0; pokus < 400 && hrady.length < T; pokus++) {
        const i = Math.floor(rng() * C);
        if (hrad[i] || dotyk8(i, n).some((y) => hrad[y])) continue;
        hrad[i] = 1; hrady.push(i);
      }
      for (const h of hrady) {
        const volne = susedia4(h, n).filter((y) => !hrad[y] && !strom[y]);
        if (volne.length) strom[volne[Math.floor(rng() * volne.length)]] = 1;
      }
    } else {
      // trees anywhere, and the numbers of a random set of cells that may be
      // no answer at all
      for (let t = 0; t < T; t++) strom[Math.floor(rng() * C)] = 1;
      for (let t = 0; t < T; t++) { const i = Math.floor(rng() * C); if (!strom[i]) hrad[i] = 1; }
    }
    const trees = [];
    for (let i = 0; i < C; i++) if (strom[i]) { trees.push(i); hrad[i] = 0; }
    const rows = new Array(n).fill(0), cols = new Array(n).fill(0);
    let pocetHradov = 0;
    for (let i = 0; i < C; i++) if (hrad[i]) { rows[(i / n) | 0]++; cols[i % n]++; pocetHradov++; }
    // make the totals agree with the trees so the case is not trivially empty
    const volne = [];
    for (let i = 0; i < C; i++) if (!strom[i] && !hrad[i]) volne.push(i);
    while (pocetHradov < trees.length && volne.length) {
      const i = volne.splice(Math.floor(rng() * volne.length), 1)[0];
      hrad[i] = 1; rows[(i / n) | 0]++; cols[i % n]++; pocetHradov++;
    }
    const z = { n, trees, rows, cols };
    const r = solve(z, { limit: 100000, maxNodes: 1e7 });
    assert(!r.vycerpane, 'budget ran out on a 6 x 6');
    const b = hrubaSila(z);
    eq(r.count, b, 'pond ' + k + ' ' + JSON.stringify(z));
    if (b === 0) ziadne++; else if (b === 1) jedno++; else viac++;
    // a board of this pond where a lodge is shared by two trees must be refused
    for (const sol of r.riesenia.slice(0, 3)) assert(jeVyriesene(sol, z), 'solve returned a board the rules refuse');
    void g; void zdielane;
  }
  console.log('     answers: none ' + ziadne + ', one ' + jedno + ', more ' + viac);
  assert(viac > 0 && jedno + viac > 0, 'the sample should hold ambiguous ponds too');
  // the shared lodge again, as a pond of its own
  eq(solve(DELENY, { limit: 10 }).count, hrubaSila(DELENY));
});

// ── 4. No guessing ────────────────────────────────────────────────────────
const POUZITIE = {};
test('4. solveHuman finishes every pond within its layers; easy, medium and hard never need layer 3', () => {
  for (const { d, n, maxVrstva, p } of PONDS) {
    const hu = solveHuman({ n, trees: p.trees, rows: p.rows, cols: p.cols }, { maxVrstva });
    assert(hu.solved, n + 'x' + n + ' ' + d + ' cannot be finished without guessing');
    eq(hu.solution, p.solution, n + 'x' + n + ' ' + d + ' the human rules ended somewhere else');
    if (maxVrstva < 3) eq(hu.layersUsed[3], 0, n + 'x' + n + ' ' + d + ' needs a trial');
    for (const s of hu.steps) POUZITIE[s.rule] = (POUZITIE[s.rule] || 0) + 1;
  }
});

// ── 5. Every step is true ─────────────────────────────────────────────────
test('5. every cell of every step agrees with the solution', () => {
  for (const { d, n, maxVrstva, p } of PONDS) {
    const hu = solveHuman({ n, trees: p.trees, rows: p.rows, cols: p.cols }, { maxVrstva });
    for (const s of hu.steps) {
      assert(s.cells.length > 0, 'a step without cells: ' + s.rule);
      for (const i of s.cells) eq(s.val === 1 ? 1 : 0, p.solution[i], n + 'x' + n + ' ' + d + ' ' + s.rule + ' set cell ' + i + ' against the pond');
      assert(s.text.endsWith('.') && s.kde.endsWith('.'), 'a sentence without a full stop: ' + s.text);
      assert(!/undefined|null|NaN/.test(s.text + s.kde), 'a sentence with a hole in it: ' + s.text);
    }
  }
  console.log('     rules used: ' + Object.entries(POUZITIE).map(([k, v]) => k + ' ' + v).join(', '));
  console.log('     tree-taken ' + (POUZITIE['tree-taken'] || 0) + ', crowded-trees ' + (POUZITIE['crowded-trees'] || 0));
});

// ── 6. The rules over a state a player made ──────────────────────────────
test('6. over randomly revealed boards (30 to 70 %) no step ever contradicts the solution', () => {
  const rng = mulberry32(seedFromString('odhalene'));
  let krokov = 0, pravidla = {};
  const dni = PONDS.filter((x) => DATES.indexOf(x.d) < 14);
  for (const { d, n, p } of dni) {
    // three boards of lodges and grass (30 to 70 %), and three of lodges only
    // (20 to 80 % of them), which is how many players play: the lodges are
    // what sure pairs, tree-taken and crowded-trees stand on
    for (let opak = 0; opak < 6; opak++) {
      const lenHrady = opak >= 3;
      const podiel = lenHrady ? 0.2 + rng() * 0.6 : 0.3 + rng() * 0.4;
      const isTree = new Uint8Array(n * n);
      for (const t of p.trees) isTree[t] = 1;
      const v = new Array(n * n).fill(0);
      for (let i = 0; i < n * n; i++) {
        if (isTree[i] || rng() >= podiel || (lenHrady && p.solution[i] !== 1)) continue;
        v[i] = p.solution[i] === 1 ? 1 : 2;
      }
      const hu = solveHuman({ n, trees: p.trees, rows: p.rows, cols: p.cols }, { initial: v, maxVrstva: 3 });
      assert(!hu.contradiction, n + 'x' + n + ' ' + d + ': a contradiction on a true board');
      for (const s of hu.steps) {
        krokov++;
        pravidla[s.rule] = (pravidla[s.rule] || 0) + 1;
        for (const i of s.cells) {
          assert(v[i] === 0, s.rule + ' changed a cell the player had marked');
          eq(s.val === 1 ? 1 : 0, p.solution[i], n + 'x' + n + ' ' + d + ' ' + s.rule + ' against the pond at ' + i);
        }
      }
      assert(hu.solved, n + 'x' + n + ' ' + d + ': a revealed board was left unfinished');
    }
  }
  console.log('     ' + krokov + ' steps, of them tree-taken ' + (pravidla['tree-taken'] || 0) + ', crowded-trees ' + (pravidla['crowded-trees'] || 0) + ', trial ' + (pravidla.trial || 0));
});

// ── 6b. Every layer 2 rule on its own, over boards a player made ─────────
/* In solveHuman a layer 1 rule nearly always comes first on a board a player
   made, so test 6 hardly ever gets as far as shared-neighbour or
   crowded-trees there (the first review, 25. 9.: 0 of 400 boards).
   pravidloNadStavom asks one rule directly, whatever would come before it,
   so every rule is judged on boards the solver never builds itself. */
const PRAVIDLA2 = ['line-fit', 'line-shadow', 'shared-neighbour', 'tree-taken', 'crowded-trees'];
function stromyP(p) { const s = new Uint8Array(p.n * p.n); for (const t of p.trees) s[t] = 1; return s; }
function overKrok(s, v, p, kde) {
  assert(s.cells.length > 0, kde + ': a step without cells');
  for (const i of s.cells) {
    assert(v[i] === 0, kde + ': ' + s.rule + ' changed a cell the player had marked');
    eq(s.val === 1 ? 1 : 0, p.solution[i], kde + ': ' + s.rule + ' against the pond at ' + i);
  }
  assert(s.text.endsWith('.') && s.kde.endsWith('.') && !/undefined|null|NaN/.test(s.text + s.kde), kde + ': a broken sentence: ' + s.text);
}
test('6b. every layer 2 rule, asked on its own over boards a player made, agrees with the solution', () => {
  const rng = mulberry32(seedFromString('pravidla-samostatne'));
  const pocty = {};
  let plochy = 0;
  for (const { d, n, p } of PONDS.filter((x) => DATES.indexOf(x.d) < 14)) {
    const isTree = stromyP(p);
    const priStrome = (i) => susedia4(i, n).some((y) => isTree[y]);
    for (let opak = 0; opak < 9; opak++) {
      // 0: lodges and grass anywhere; 1: lodges only; 2: worked tree by tree,
      // grass beside the trees and a few lodges, which leaves trees with two
      // or three free cells, the boards the pairing rules stand on
      const druh = opak % 3;
      const podiel = druh === 0 ? 0.3 + rng() * 0.4 : druh === 1 ? 0.2 + rng() * 0.6 : 0.5 + rng() * 0.4;
      const v = new Array(n * n).fill(0);
      for (let i = 0; i < n * n; i++) {
        if (isTree[i]) continue;
        const hrad = p.solution[i] === 1;
        if (druh === 1 && !hrad) continue;
        if (druh === 2 && (hrad ? rng() >= 0.4 : !priStrome(i) || rng() >= podiel)) continue;
        if (druh !== 2 && rng() >= podiel) continue;
        v[i] = hrad ? 1 : 2;
      }
      plochy++;
      const z = { n, trees: p.trees, rows: p.rows, cols: p.cols };
      for (const r of PRAVIDLA2) {
        const s = pravidloNadStavom(z, v, r);
        if (!s) continue;
        eq(s.rule, r, 'asked for ' + r);
        overKrok(s, v, p, n + 'x' + n + ' ' + d);
        pocty[r] = (pocty[r] || 0) + 1;
      }
    }
  }
  console.log('     ' + plochy + ' boards, steps per rule: ' + PRAVIDLA2.map((r) => r + ' ' + (pocty[r] || 0)).join(', '));
  for (const r of ['shared-neighbour', 'tree-taken', 'crowded-trees']) assert((pocty[r] || 0) >= 20, r + ' fired only ' + (pocty[r] || 0) + ' times');
});

/* One full pairing of the answer, tree -> its lodge (augmenting paths). */
function parovanieRiesenia(p) {
  const n = p.n;
  const hrady = new Set();
  for (let i = 0; i < n * n; i++) if (p.solution[i] === 1) hrady.add(i);
  const vlastnik = new Map();
  const rek = (t, videne) => {
    for (const y of susedia4(t, n)) {
      if (!hrady.has(y) || videne.has(y)) continue;
      videne.add(y);
      if (!vlastnik.has(y) || rek(vlastnik.get(y), videne)) { vlastnik.set(y, t); return true; }
    }
    return false;
  };
  for (const t of p.trees) assert(rek(t, new Set()), 'the answer has no full pairing');
  return new Map([...vlastnik].map(([h, t]) => [t, h]));
}
/* A true lodge far from every cell in `pri`, for the unrelated mark a player
   leaves elsewhere without grass around it. */
function vzdialenyHrad(p, par, pri) {
  const n = p.n;
  const blizko = new Set();
  for (const q of pri) { blizko.add(q); for (const y of dotyk8(q, n)) blizko.add(y); }
  return [...par.values()].find((h) => !blizko.has(h) && !dotyk8(h, n).some((y) => blizko.has(y)));
}

/* 6c. The cases the review asked for, built by hand on real ponds. Two trees
   can share two free cells only when they stand corner to corner, and then
   those two cells touch, so "two trees, two shared free cells" cannot occur
   on a true board. What crowded-trees really decides with two trees is this:
   a lodge L stands between trees a and c, the rest of c's cells are grass, so
   L is c's and a's lodge goes in its one other free cell x. It is also the
   case "the lodge beside a tree belongs to another tree": the sure pairs never
   give L to c while a is untaken, so that case reaches the rule through the
   pair of trees and not through a single one. Each case is built twice: on an
   almost empty board (the construction, one unrelated true lodge far away
   without grass around it) and on an almost finished one (every other cell
   as in the answer). */
test('6c. crowded-trees and shared-neighbour by hand: the step puts exactly the answer, on an empty and on a nearly finished board', () => {
  const vysledky = { crowdedPrazdna: [0, 0], crowdedPlna: [0, 0], sharedPrazdna: [0, 0], sharedPlna: [0, 0] };
  for (const { d, n, p } of PONDS) {
    const C = n * n, isTree = stromyP(p), par = parovanieRiesenia(p);
    const z = { n, trees: p.trees, rows: p.rows, cols: p.cols };
    const hotova = () => p.solution.map((x, i) => (isTree[i] ? 0 : x === 1 ? 1 : 2));
    // crowded-trees: c owns L, a is beside L too and owns x
    let crowded = null;
    for (const [c, L] of par) {
      for (const a of susedia4(L, n)) {
        if (!isTree[a] || a === c || crowded) continue;
        const x = par.get(a);
        const ine = [...new Set([...susedia4(a, n), ...susedia4(c, n)])].filter((y) => !isTree[y] && y !== L && y !== x);
        if (ine.some((y) => p.solution[y] === 1)) continue;
        crowded = { a, c, L, x, ine };
      }
      if (crowded) break;
    }
    if (crowded) {
      const { a, c, L, x, ine } = crowded;
      const prazdna = new Array(C).fill(0);
      prazdna[L] = 1;
      for (const y of ine) prazdna[y] = 2;
      const U = vzdialenyHrad(p, par, [a, c, L, x, ...ine]);
      if (U !== undefined) prazdna[U] = 1;
      const plna = hotova();
      plna[x] = 0;
      for (const [meno, v] of [['crowdedPrazdna', prazdna], ['crowdedPlna', plna]]) {
        const s = pravidloNadStavom(z, v, 'crowded-trees');
        assert(s, n + 'x' + n + ' ' + d + ' ' + meno + ': crowded-trees found nothing for the trees at ' + a + ' and ' + c);
        eq(s.val, 1, 'crowded-trees puts lodges');
        overKrok(s, v, p, n + 'x' + n + ' ' + d + ' ' + meno);
        vysledky[meno][0]++;
        if (s.cells.length === 1 && s.cells[0] === x) vysledky[meno][1]++;
      }
    }
    // shared-neighbour: tree t with only x (its lodge) and w free, the two
    // around a corner of t, so the fourth cell y of that square touches both
    let shared = null;
    for (const [t, x] of par) {
      if (shared) break;
      if (susedia4(t, n).some((y) => y !== x && p.solution[y] === 1)) continue; // no other lodge beside t
      const [rt, ct] = [(t / n) | 0, t % n], [rx, cx] = [(x / n) | 0, x % n];
      for (const w of susedia4(t, n)) {
        const [rw, cw] = [(w / n) | 0, w % n];
        if (isTree[w] || w === x || (rw !== rt && rx !== rt) || (cw !== ct && cx !== ct)) continue; // w beside t, around a corner from x
        const y = (rx + rw - rt) * n + (cx + cw - ct);
        if (isTree[y]) continue;
        const ine = susedia4(t, n).filter((q) => !isTree[q] && q !== x && q !== w);
        shared = { t, x, w, y, ine };
        break;
      }
    }
    if (shared) {
      const { t, x, w, y, ine } = shared;
      const prazdna = new Array(C).fill(0);
      for (const q of ine) prazdna[q] = 2;
      const U = vzdialenyHrad(p, par, [t, x, w, y, ...ine]);
      if (U !== undefined) prazdna[U] = 1;
      const plna = hotova();
      for (const q of [x, w, y]) plna[q] = 0;
      for (const [meno, v] of [['sharedPrazdna', prazdna], ['sharedPlna', plna]]) {
        const s = pravidloNadStavom(z, v, 'shared-neighbour');
        assert(s, n + 'x' + n + ' ' + d + ' ' + meno + ': shared-neighbour found nothing for the tree at ' + t);
        eq(s.val, 2, 'shared-neighbour puts grass');
        overKrok(s, v, p, n + 'x' + n + ' ' + d + ' ' + meno);
        vysledky[meno][0]++;
        if (s.cells.length === 1 && s.cells[0] === y) vysledky[meno][1]++;
      }
    }
  }
  console.log('     cases (built, of them the very step built): ' + Object.entries(vysledky).map(([k, [a, b]]) => k + ' ' + a + '/' + b).join(', '));
  for (const [k, [a, b]] of Object.entries(vysledky)) {
    assert(a >= 20, k + ': only ' + a + ' cases could be built');
    // on the nearly finished board nothing else is left to find
    if (/Plna$/.test(k)) eq(b, a, k + ': the rule found a different step on a nearly finished board');
  }
});

// ── 12. The pick of the day ──────────────────────────────────────────────
test('12. vyber takes the rank of the level, but not a pond under MIN_L2 while one of up to eighteen candidates reaches it', () => {
  // l2 of candidates 0 to 17; what is not given is 0
  const kand = (l2) => (k) => ({ difficulty: { layers: { 1: 10 + k, 2: l2[k] || 0, 3: 0 } } });
  const l2 = (p) => p.difficulty.layers[2];
  const nuly = new Array(KANDIDATOV).fill(0);
  eq(l2(vyber('medium', kand([0, 0, 0, 1, 2, 3]))), 2, 'medium under the floor takes the easiest of the six at the floor');
  eq(l2(vyber('medium', kand([2, 3, 4, 5, 6, 7]))), 4, 'medium above the floor keeps its rank');
  eq(l2(vyber('medium', kand([0, 1, 0, 1, 0, 0, 0, 0, 3, 0, 2, 5]))), 2, 'none of the six at the floor: the easiest of the ones after them that is');
  eq(vyber('medium', kand([0, 1, 0, 1, 0, 0, 0, 0, 3, 0, 2, 5])).kandidat, 10, 'and that is candidate #10');
  eq(l2(vyber('medium', kand([0, 1, 0, 1, 0, 0]))), 1, 'with nobody of all eighteen at the floor, the hardest of the six');
  eq(l2(vyber('medium', kand([...nuly, ...new Array(NAVYSE - 1).fill(0), 2]))), 2, 'the last extra candidate still counts');
  eq(l2(vyber('easy', kand([0, 3, 4, 5, 6, 7]))), 0, 'easy never looks at the floor');
  eq(l2(vyber('hard', kand([1, 2, 3, 4, 6, 9]))), 6, 'hard under its floor of 5');
  eq(PORADIE.easy, 0); eq(MIN_L2.easy, 0);
  // a day whose six reach the floor never asks for a seventh
  let volane = 0;
  vyber('medium', (k) => { volane = Math.max(volane, k + 1); return kand([2, 3, 4, 5, 6, 7])(k); });
  eq(volane, KANDIDATOV, 'candidates asked for');
  // real days of a medium and a hard week
  for (const d of ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10']) {
    const u = urovenDna(d), lv = UROVNE[u];
    const p = zadaniePreDen(d);
    if (l2(p) >= MIN_L2[u]) continue;
    for (let k = 0; k < KANDIDATOV + NAVYSE; k++) assert(l2(generateSeeded(d, d + '/' + lv.n + (k ? '#' + k : ''), lv)) < MIN_L2[u], d + ' fell under the floor although candidate ' + k + ' reaches it');
  }
  // the days as they are built (dni/, PRVY_DEN to a year ahead): no Medium
  // under 2 and no Hard under 5, which is what the guide promises
  const dniDir = join(TU, 'dni');
  if (existsSync(dniDir)) {
    const pod = [], pocty = {};
    for (const f of readdirSync(dniDir)) {
      if (!/^\d{4}-\d{2}\.json$/.test(f)) continue;
      for (const z of JSON.parse(readFileSync(join(dniDir, f), 'utf8'))) {
        pocty[z.u] = (pocty[z.u] || 0) + 1;
        if ((Number(String(z.l).split(',')[1]) || 0) < (MIN_L2[z.u] || 0)) pod.push(z.d + ' ' + z.u + ' l2 ' + String(z.l).split(',')[1]);
      }
    }
    console.log('     built days: ' + Object.entries(pocty).map(([u, k]) => u + ' ' + k).join(', ') + '; under the floor: ' + pod.length);
    eq(pod, [], 'built days under the floor of layer 2 steps');
  }
});

// ── 13. Sunday trials a person can follow ────────────────────────────────
/* The second review (25. 9.) measured the chains behind the Sunday trials of
   the first version: 8 steps in the median, 26 at p90, 40 at most, from the
   assumption to the contradiction the sentence names. Now the trial with the
   shortest chain is taken and the generator refuses a chain longer than
   MAX_RETAZ. Measured here on 30 Sundays, and every chain length the solver
   reports is measured again independently: solveHuman from the board with
   the assumption written in, layers 1 and 2 only, until it runs into the
   contradiction. On the first three Sundays it is also checked that no other
   assumption on the same board breaks a rule sooner. */
test('13. Sunday trials: p90 of the chain at most 8 over 30 Sundays, every chain within MAX_RETAZ and the shortest there is', () => {
  const dlzky = [];
  let nedel = 0, overeneNajkratsie = 0;
  for (let d = '2026-09-27'; nedel < 30; d = posunDen(d, 7), nedel++) {
    const p = zadaniePreDen(d);
    eq(p.n, 14, d + ' is a Sunday of 14 x 14');
    const z = { n: p.n, trees: p.trees, rows: p.rows, cols: p.cols };
    const hu = solveHuman(z, { maxVrstva: 3 });
    assert(hu.solved, d + ' is not finished');
    const st = new Array(p.n * p.n).fill(0);
    const isTree = stromyP(p);
    for (const s of hu.steps) {
      if (s.rule === 'trial') {
        dlzky.push(s.dlzka);
        const init = st.slice();
        init[s.cells[0]] = s.val === 1 ? 2 : 1;
        const r = solveHuman(z, { initial: init, maxVrstva: 2 });
        assert(r.contradiction, d + ': the assumption at ' + s.cells[0] + ' leads to no contradiction on its own');
        eq(r.steps.length, s.dlzka, d + ': chain length at ' + s.cells[0]);
        assert(s.retaz.length <= 3 && s.retaz.every((x) => x.cells.length && x.cells.every((i) => init[i] === 0 && !isTree[i])), d + ': the named chain steps must be free cells');
        assert(s.spor && Array.isArray(s.spor.cells), d + ': a trial without the place of its contradiction');
        if (nedel < 3 && s.dlzka > 0) {
          // nobody else is shorter: no other assumption reaches a
          // contradiction in fewer than dlzka steps. limitKrokov is dlzka,
          // not dlzka - 1: solveHuman reads 0 as "no limit", so a chain of 1
          // used to let every other assumption run to the end (26. 9.).
          for (let i = 0; i < st.length; i++) {
            if (isTree[i] || st[i] !== 0) continue;
            for (const val of [1, 2]) {
              const b = st.slice(); b[i] = val;
              const q = solveHuman(z, { initial: b, maxVrstva: 2, limitKrokov: s.dlzka });
              assert(!(q.contradiction && q.steps.length < s.dlzka), d + ': assuming ' + val + ' at ' + i + ' breaks a rule after ' + q.steps.length + ' steps, sooner than the trial at ' + s.cells[0] + ' (' + s.dlzka + ')');
            }
          }
          overeneNajkratsie++;
        }
      }
      for (const i of s.cells) st[i] = s.val;
    }
  }
  dlzky.sort((a, b) => a - b);
  const q = (f) => dlzky[Math.floor(f * (dlzky.length - 1))];
  console.log('     ' + dlzky.length + ' trials on 30 Sundays, chain min ' + dlzky[0] + ', median ' + q(0.5) + ', p90 ' + q(0.9) + ', max ' + dlzky[dlzky.length - 1] + '; shortest checked for ' + overeneNajkratsie);
  assert(dlzky.length > 30, 'too few trials to measure: ' + dlzky.length);
  assert(q(0.9) <= 8, 'p90 of the chain is ' + q(0.9));
  assert(dlzky[dlzky.length - 1] <= MAX_RETAZ, 'a chain of ' + dlzky[dlzky.length - 1]);
});

// ── 7. The terms of the difficulty ───────────────────────────────────────
test('7. l1 and l2 stay under 1000 on every level, so obtiaznost never spills', () => {
  const easyL2 = {};
  for (const { n, p } of PONDS) {
    assert(p.difficulty.layers[1] < 1000, 'l1 ' + p.difficulty.layers[1] + ' at ' + n);
    assert(p.difficulty.layers[2] < 1000, 'l2 ' + p.difficulty.layers[2] + ' at ' + n);
    assert(obtiaznost(p) === (p.difficulty.layers[3] + p.difficulty.retaz) * 1e6 + p.difficulty.layers[2] * 1e3 + p.difficulty.layers[1]);
    if (!p.difficulty.layers[3]) eq(p.difficulty.retaz, 0, 'a chain without a trial');
    if (n === 8) easyL2[p.difficulty.layers[2]] = (easyL2[p.difficulty.layers[2]] || 0) + 1;
  }
  console.log('     l2 on 8 x 8: ' + Object.keys(easyL2).sort((a, b) => a - b).map((k) => k + ':' + easyL2[k]).join(' '));
});

// ── 8. Counts and density ────────────────────────────────────────────────
test('8. every pond has its number of trees within the table, and every look filter holds', () => {
  const zam = {};
  let pokusov = 0;
  for (const { n, p } of PONDS) {
    const [lo, hi] = rozsahStromov(n);
    assert(p.trees.length >= lo && p.trees.length <= hi, n + 'x' + n + ' has ' + p.trees.length + ' trees');
    const strom = new Uint8Array(n * n);
    for (const t of p.trees) strom[t] = 1;
    assert(!maBlokStromov(strom, n), 'a two by two block of trees');
    let nul = 0;
    for (let x = 0; x < n; x++) { if (!p.rows[x]) nul++; if (!p.cols[x]) nul++; }
    assert(nul <= Math.floor(0.3 * n), 'too many zeros: ' + nul);
    pokusov += p.attempts;
    for (const [k, v] of Object.entries(p.zamietnute)) zam[k] = (zam[k] || 0) + v;
  }
  console.log('     attempts ' + pokusov + ' for ' + PONDS.length + ' ponds, thrown away: ' + JSON.stringify(zam)
    + ', for density ' + (100 * (zam.hustota || 0) / pokusov).toFixed(1) + ' %');
  assert((zam.hustota || 0) <= 0.1 * pokusov, 'placement jams below the lower bound in more than 10 % of attempts');
});
test('8b. random placement reaches the lower bound in at least 90 % of tries at every size (measured, not assumed)', () => {
  const rng = mulberry32(seedFromString('hustota'));
  for (const n of [8, 10, 12, 14]) {
    const [lo, hi] = rozsahStromov(n);
    let dosiahlo = 0, maxi = 0;
    const g = geometria(n);
    for (let k = 0; k < 200; k++) {
      const hrad = new Uint8Array(n * n);
      const poradie = Array.from({ length: n * n }, (_, i) => i);
      for (let i = poradie.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [poradie[i], poradie[j]] = [poradie[j], poradie[i]]; }
      let pocet = 0;
      for (const i of poradie) {
        let volno = true;
        for (let m = 0; m < 8; m++) { const y = g.s8[8 * i + m]; if (y >= 0 && hrad[y]) { volno = false; break; } }
        if (volno) { hrad[i] = 1; pocet++; }
      }
      if (pocet >= lo) dosiahlo++;
      maxi = Math.max(maxi, pocet);
    }
    console.log('     ' + n + 'x' + n + ': jammed at or above ' + lo + ' in ' + (dosiahlo / 2).toFixed(1) + ' % of 200, the most ' + maxi + ' (upper bound ' + hi + ')');
    assert(dosiahlo >= 180, n + 'x' + n + ' reaches the lower bound in only ' + dosiahlo + ' of 200');
  }
});

// ── 9. rozbal refuses a broken record ────────────────────────────────────
function hodi(fn) { try { fn(); return false; } catch (e) { return /Bad packed puzzle/.test(e.message); } }
test('9. rozbal refuses touching lodges, a lodge on a tree or with no tree, wrong numbers, wrong counts, wrong lengths and the shared lodge', () => {
  const p = PONDS[0].p;
  const z = zbal({ ...p, uroven: 'easy' });
  const r = rozbal(z);
  eq(r.solution, p.solution);
  eq(r.trees, p.trees);
  const n = p.n;
  const hrady = z.s.split(',').map(Number);
  const h0 = hrady[0];
  // touching: a lodge moved diagonally next to another one
  const dotyk = dotyk8(h0, n).find((y) => !p.trees.includes(y));
  assert(hodi(() => rozbal({ ...z, s: hrady.concat([dotyk]).join(',') })), 'touching lodges accepted');
  assert(hodi(() => rozbal({ ...z, s: hrady.slice(1).concat([p.trees[0]]).join(',') })), 'a lodge on a tree accepted');
  const bezStromu = (() => { for (let i = 0; i < n * n; i++) if (!p.trees.includes(i) && !susedia4(i, n).some((y) => p.trees.includes(y))) return i; return -1; })();
  assert(bezStromu >= 0);
  assert(hodi(() => rozbal({ ...z, s: hrady.slice(1).concat([bezStromu]).join(',') })), 'a lodge with no tree accepted');
  const zleR = String((+z.r[0] + 1) % 8) + z.r.slice(1);
  assert(hodi(() => rozbal({ ...z, r: zleR })), 'a wrong row number accepted');
  assert(hodi(() => rozbal({ ...z, t: z.t + ',' + bezStromu })), 'more trees than lodges accepted');
  assert(hodi(() => rozbal({ ...z, r: z.r.slice(1) })), 'a short r accepted');
  assert(hodi(() => rozbal({ ...z, c: z.c + '0' })), 'a long c accepted');
  assert(hodi(() => rozbal({ ...z, s: z.s + ',99999' })), 'an index off the pond accepted');
  const deleny = { d: 'x', n: 5, t: '0,2,17', r: '10020', c: '02010', s: '1,16,18', u: 'easy', l: '0,0,0', k: 0 };
  assert(hodi(() => rozbal(deleny)), 'the shared lodge accepted');
});

// ── 10. Time ──────────────────────────────────────────────────────────────
test('10. a whole Challenge day (six candidates of 14 x 14) takes under 4 seconds', () => {
  const lv = UROVNE.challenge;
  let max = 0;
  for (const d of ['2026-09-13', '2026-11-15', '2027-02-07', '2027-06-20', '2027-08-29']) {
    const t0 = performance.now();
    for (let k = 0; k < KANDIDATOV; k++) generateSeeded(d, d + '/' + lv.n + (k ? '#' + k : ''), { n: lv.n, maxVrstva: lv.maxVrstva });
    max = Math.max(max, performance.now() - t0);
  }
  console.log('     slowest Challenge day: ' + max.toFixed(0) + ' ms');
  assert(max < 4000, 'took ' + max.toFixed(0) + ' ms');
});

// ── 11. Forbidden strings ────────────────────────────────────────────────
const ZAKAZANE = [/\btents?\b/i, /\bcamp(s|site|ing)?\b/i, /Tents and Trees/i, new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']')]; // en dash and em dash
function skontrolujText(meno, text) {
  for (const re of ZAKAZANE) {
    const m = re.exec(text);
    assert(!m, meno + ' holds a forbidden string ' + re + ' near "' + (m ? text.slice(Math.max(0, m.index - 30), m.index + 30) : '') + '"');
  }
}
test('11. no borrowed name of the genre and no dash in the pages, the manifest, the lists, the GIF texts or the solver steps', () => {
  const subory = ['index.html', 'manifest.json', 'zoznamy.js', 'guide/index.html'];
  let citane = 0;
  for (const f of subory) {
    const cesta = join(TU, f);
    if (!existsSync(cesta)) { if (f !== 'guide/index.html') throw new Error('missing ' + f); continue; }
    skontrolujText(f, readFileSync(cesta, 'utf8'));
    citane++;
  }
  const postav = join(TU, '..', '..', '..', '..', 'ops', 'games', 'beavers', 'postav.mjs');
  if (existsSync(postav)) {
    const src = readFileSync(postav, 'utf8');
    const alty = src.match(/gif\(\d, '[^']*'\)/g) || [];
    for (const a of alty) skontrolujText('GIF alt', a);
  }
  // every sentence the solver and the hints can say
  for (const { n, maxVrstva, p } of PONDS.filter((x, i) => i % 5 === 0)) {
    const hu = solveHuman({ n, trees: p.trees, rows: p.rows, cols: p.cols }, { maxVrstva });
    for (const s of hu.steps) { skontrolujText('step ' + s.rule, s.text); skontrolujText('step ' + s.rule, s.kde); }
    const v = new Array(n * n).fill(0);
    v[p.solution.indexOf(1)] = 2;
    const h = napoveda(v, { n, trees: p.trees, rows: p.rows, cols: p.cols }, p.solution);
    skontrolujText('hint ' + h.druh, h.text + ' ' + h.kde);
  }
  assert(citane >= 3, 'read ' + citane + ' files');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exitCode = 1;
