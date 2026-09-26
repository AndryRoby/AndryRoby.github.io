/* Tests for the Owls generator (ops/spec-owls.md, part 13). No framework:
 * node tests.mjs. Prints "N passed, M failed" and exits with code 1 if
 * anything fails. */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mulberry32, seedFromString, isValidDate, todayBratislava,
  platneRiadky, porusenia, solve, solveHuman, riesitelne, generate, generateSeeded, nahodneRiesenie, MAX_RETAZ,
} from './generator.mjs';
import { zbal, rozbal, UROVNE } from './plan.mjs';
import { napoveda } from './logika.mjs';

const TU = dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;
function test(name, fn) {
  const t0 = performance.now();
  try {
    fn();
    passed++;
    console.log('ok   ' + name + ' (' + Math.round(performance.now() - t0) + ' ms)');
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

/* 30 consecutive days from 10 September 2026, the four levels on each. Built
   once and shared by the tests below. */
const DNI = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 8, 10 + i)).toISOString().slice(0, 10));
const LEVELS = Object.entries(UROVNE).map(([id, u]) => ({ id, ...u }));
const cache = new Map();
function zadanie(d, u) {
  const k = d + '/' + u.id;
  if (!cache.has(k)) cache.set(k, generateSeeded(d, d + '/' + u.n, { n: u.n, maxVrstva: u.maxVrstva }));
  return cache.get(k);
}
const texty = [];

// ── basics ──────────────────────────────────────────────────────────────
test('mulberry32 and seedFromString are deterministic', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 100; i++) assert(a() === b(), 'difference at step ' + i);
  assert(seedFromString('2026-09-10') === seedFromString('2026-09-10'));
  assert(seedFromString('2026-09-10') !== seedFromString('2026-09-11'));
});
test('isValidDate and todayBratislava', () => {
  assert(isValidDate('2024-02-29') && !isValidDate('2025-02-29') && !isValidDate('2026/09/10'));
  assert(isValidDate(todayBratislava()));
  eq(todayBratislava(new Date(Date.UTC(2026, 6, 15, 23, 30))), '2026-07-16');
});

// ── 1. determinism ──────────────────────────────────────────────────────
test('1. two runs of the same key give byte for byte the same packed tree', () => {
  for (const u of LEVELS) {
    const a = generateSeeded('2026-09-25', 'det/' + u.n, { n: u.n, maxVrstva: u.maxVrstva });
    const b = generateSeeded('2026-09-25', 'det/' + u.n, { n: u.n, maxVrstva: u.maxVrstva });
    eq(JSON.stringify(zbal({ ...a, uroven: u.id })), JSON.stringify(zbal({ ...b, uroven: u.id })), u.id);
  }
  const c = generate('2026-09-10'), d = generate('2026-09-10');
  eq(c.givens, d.givens); eq(c.solution, d.solution);
});

// ── 2. the valid lines and the size of the answer space ─────────────────
test('2. platneRiadky has 14, 34, 84, 208 lines and there are 4140 finished 6 x 6 trees', () => {
  eq([6, 8, 10, 12].map((n) => platneRiadky(n).length), [14, 34, 84, 208]);
  for (const n of [6, 8, 10, 12]) {
    for (const r of platneRiadky(n)) {
      const bity = Array.from({ length: n }, (_, k) => (r >>> k) & 1);
      eq(bity.filter((x) => x).length, n / 2, 'unbalanced line');
      for (let k = 0; k + 2 < n; k++) assert(!(bity[k] === bity[k + 1] && bity[k + 1] === bity[k + 2]), 'three alike');
    }
  }
  // every finished 6 x 6 tree, counted from the rules (not from the solver)
  const n = 6, R = platneRiadky(n), riadky = [];
  let pocet = 0;
  const rek = (d) => {
    if (d === n) {
      const g = [];
      for (const r of riadky) for (let c = 0; c < n; c++) g.push((r >>> c) & 1);
      if (!porusenia(g, n).length) pocet++;
      return;
    }
    for (const r of R) {
      if (riadky.includes(r)) continue;
      let ok = true;
      for (let c = 0; c < n && ok; c++) {
        const b = (r >>> c) & 1;
        let k = b;
        for (const x of riadky) k += (x >>> c) & 1;
        if (k > n / 2 || d + 1 - k > n / 2) ok = false;
        else if (d >= 2 && ((riadky[d - 1] >>> c) & 1) === b && ((riadky[d - 2] >>> c) & 1) === b) ok = false;
      }
      if (!ok) continue;
      riadky.push(r); rek(d + 1); riadky.pop();
    }
  };
  rek(0);
  eq(pocet, 4140);
});
test('porusenia names each broken rule on hand made 4 x 4 boards', () => {
  // hand verified: rows 0101, 1010, 0110, 1001 read from the left
  const dobra = [0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1];
  eq(porusenia(dobra, 4), []);
  const dvojcata = [0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0];
  assert(porusenia(dvojcata, 4).some((x) => /twins/.test(x)), 'twins not found');
  const trojica = [1, 1, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1];
  assert(porusenia(trojica, 4).some((x) => /three alike|not balanced/.test(x)));
  const prazdna = dobra.slice(); prazdna[5] = null;
  assert(porusenia(prazdna, 4).some((x) => /empty/.test(x)));
});
test('nahodneRiesenie always gives a tree that keeps all three rules', () => {
  const rng = mulberry32(seedFromString('trees'));
  for (const n of [6, 8, 10, 12]) for (let k = 0; k < 10; k++) {
    const g = nahodneRiesenie(rng, n);
    assert(g, 'gave up at ' + n);
    eq(porusenia(g, n), [], n + 'x' + n);
  }
});

// ── 3. uniqueness ───────────────────────────────────────────────────────
test('3. 30 consecutive days on all four levels: exactly one tree, the solver never runs out, and it is the source', () => {
  for (const u of LEVELS) for (const d of DNI) {
    const p = zadanie(d, u);
    const r = solve(p.givens, u.n, { limit: 2 });
    assert(!r.vycerpane, u.id + ' ' + d + ' ran out of nodes');
    eq(r.count, 1, u.id + ' ' + d + ' does not have exactly one tree');
    eq(r.solution, p.solution, u.id + ' ' + d + ' solver found a different tree');
  }
});
test('solve says two when the givens do not pin the tree down, and none when they cannot fit', () => {
  eq(solve(new Array(16).fill(null), 4, { limit: 2 }).count, 2);
  eq(solve(new Array(16).fill(null), 4, { limit: 100 }).count, 72, 'there are 72 finished 4 x 4 trees');
  const spor = new Array(16).fill(null); spor[0] = 1; spor[1] = 1; spor[2] = 1;
  eq(solve(spor, 4, { limit: 2 }).count, 0);
  const r = solve(new Array(64).fill(null), 8, { limit: 3, maxNodes: 1 });
  assert(r.vycerpane, 'expected the search to run out of its budget');
});

// ── 4. no guessing ──────────────────────────────────────────────────────
test('4. solveHuman finishes every tree within its level: easy with layer 1 only, medium and hard without layer 3', () => {
  for (const u of LEVELS) for (const d of DNI) {
    const p = zadanie(d, u);
    const hu = solveHuman(p.givens, u.n, { maxVrstva: u.maxVrstva });
    assert(hu.solved, u.id + ' ' + d + ' cannot be finished without guessing');
    eq(hu.solution, p.solution, u.id + ' ' + d + ' human rules ended somewhere else');
    if (u.maxVrstva === 1) eq([hu.layersUsed[1], hu.layersUsed[2]], [0, 0], u.id + ' ' + d);
    if (u.maxVrstva === 2) eq(hu.layersUsed[2], 0, u.id + ' ' + d);
    eq(hu.layersUsed, p.difficulty.layers, 'difficulty is not the measured one');
    for (const s of hu.steps) {
      texty.push(s.text, s.textBezHodnoty);
      assert(s.cells.length > 0 && s.cells.length === s.vals.length, 'step without cells');
      for (let j = 0; j < s.cells.length; j++) eq(s.vals[j], p.solution[s.cells[j]], 'the rule ' + s.rule + ' set a branch against the tree');
      assert(/^[A-Z].*\.$/.test(s.text) && /^[A-Z].*\.$/.test(s.textBezHodnoty), 'not a plain sentence: ' + s.text);
      assert(!/undefined|null|NaN/.test(s.text + s.textBezHodnoty), 'a hole in the text: ' + s.text);
    }
  }
});
test('the step rules: medium needs the twin rule, Sunday has trials on some days, and a trial names what broke', () => {
  let twin = 0, trial = 0;
  for (const d of DNI) {
    const m = solveHuman(zadanie(d, LEVELS[1]).givens, 8, { maxVrstva: 2 });
    if (m.steps.some((s) => s.rule === 'twin')) twin++;
    const c = solveHuman(zadanie(d, LEVELS[3]).givens, 12, { maxVrstva: 3 });
    for (const s of c.steps) {
      if (s.rule !== 'trial') continue;
      trial++;
      assert(/^Suppose the owl in row \d+, column \d+ kept the (day|night)\. (Step 1: .+\. )?Then (row|column) \d+ (would|could) [^.]+, so this owl keeps the (day|night)\.$/.test(s.text), s.text);
      // review of 25. 9. 2026, round 2: every step of the chain is named in
      // order, Step 1 to Step N, and carries the branches Hint numbers
      const menovane = [...s.text.matchAll(/Step (\d+): (row|column) \d+(, kept unlike (row|column) \d+( and (row|column) \d+)*,)? (would need (a (day|night) owl|(day|night) owls) in (row|column)s? [\d, and]+( and (a (day|night) owl|(day|night) owls) in (row|column)s? [\d, and]+)?|could then be finished in only one way|would settle \w+ more branches)\./g)].map((m) => +m[1]);
      eq(menovane, Array.from({ length: s.dlzka }, (_, k) => k + 1), 'the chain is not told step by step: ' + s.text);
      assert(Array.isArray(s.retaz) && s.retaz.length === s.dlzka && s.retaz.every((x) => x.length > 0), 'a trial without its numbered branches');
      const vsetky = s.retaz.flat();
      assert(new Set(vsetky).size === vsetky.length && !vsetky.includes(s.cells[0]), 'a branch numbered twice, or the tried branch numbered');
      assert(Number.isInteger(s.spor.line) && s.spor.line >= 0 && s.spor.line < 24, 'a trial without the line that breaks');
      assert(/: try one kind of owl there and follow it; something breaks (at once|within \w+ steps?)\.$/.test(s.textBezHodnoty), s.textBezHodnoty);
    }
  }
  assert(twin >= 20, 'only ' + twin + ' of 30 medium trees use the twin rule');
  assert(trial > 0, 'no trial on any of 30 Sundays');
});
/* The review of 25. 9. 2026: a trial that needs 17 steps before anything
   breaks is not reasoning a person can check. Every trial on a published
   Sunday, as the solver and Hint walk it, stays within MAX_RETAZ steps, and
   Hint takes the shortest trial there is, so from the empty tree it never
   says more than that either. */
test('4b. every trial on 30 Sundays breaks within MAX_RETAZ steps (' + MAX_RETAZ + ')', () => {
  let najdlhsi = 0, pocet = 0;
  for (const d of DNI) {
    const p = zadanie(d, LEVELS[3]);
    const hu = solveHuman(p.givens, 12, { maxVrstva: 3 });
    for (const s of hu.steps) {
      if (s.rule !== 'trial') continue;
      pocet++;
      assert(Number.isInteger(s.dlzka) && s.dlzka >= 0, 'a trial without a measured chain');
      assert(s.dlzka <= MAX_RETAZ, d + ': a trial of ' + s.dlzka + ' steps: ' + s.text);
      najdlhsi = Math.max(najdlhsi, s.dlzka);
    }
    // the same tree with the limit set walks the very same path
    const k = solveHuman(p.givens, 12, { maxVrstva: 3, maxRetaz: MAX_RETAZ });
    assert(k.solved, d + ' needs a longer trial than MAX_RETAZ');
    eq(k.layersUsed, hu.layersUsed, d + ' the limit changed the path');
  }
  console.log('     ' + pocet + ' trials on 30 Sundays, the longest chain ' + najdlhsi + ' steps');
  // the page and the guide promise the number in words
  eq(MAX_RETAZ, 6, 'index.html ("within six steps") and the guide in postav.mjs ("more than six steps") say six');
  assert(readFileSync(join(TU, 'index.html'), 'utf8').includes('happens within six steps'), 'index.html lost the six steps');
});
test('solveHuman with limitKrokov 1 stops after one step and respects the starting board', () => {
  const p = zadanie(DNI[0], LEVELS[1]);
  const r = solveHuman(p.givens, 8, { limitKrokov: 1 });
  eq(r.steps.length, 1);
  const v = p.solution.map((x) => x + 1);
  v[0] = 0; v[9] = 0;
  const r2 = solveHuman(p.givens, 8, { initial: v });
  assert(r2.solved && r2.steps.length >= 1);
  const zla = p.solution.map((x) => x + 1);
  for (let i = 0; i < 8; i++) zla[i] = 1;   // a whole row of day owls
  assert(solveHuman(p.givens, 8, { initial: zla }).contradiction, 'expected a contradiction');
});

// ── 5. the solution and the givens ──────────────────────────────────────
test('5. every solution keeps the three rules and every given owl agrees with it', () => {
  for (const u of LEVELS) for (const d of DNI) {
    const p = zadanie(d, u);
    eq(porusenia(p.solution, u.n), [], u.id + ' ' + d);
    eq(p.givens.length, u.n * u.n);
    for (let i = 0; i < p.givens.length; i++) if (p.givens[i] != null) eq(p.givens[i], p.solution[i], 'given ' + i);
    assert(p.difficulty.givens > 0 && p.difficulty.givens < u.n * u.n / 2, u.id + ' ' + d + ': ' + p.difficulty.givens + ' givens');
  }
});

// ── 6. minimal ──────────────────────────────────────────────────────────
/* "Needed" is measured with the level's own rules, and on Sunday those
   include the limit on a trial's chain: without an owl the tree may still be
   finished by a trial of twenty steps, which the level does not allow. */
test('6. taking away any given owl breaks solveHuman at the level\'s layer (10 days a level, every owl)', () => {
  for (const u of LEVELS) for (const d of DNI.slice(0, 10)) {
    const p = zadanie(d, u);
    for (let i = 0; i < p.givens.length; i++) {
      if (p.givens[i] == null) continue;
      const g = p.givens.slice(); g[i] = null;
      assert(!solveHuman(g, u.n, { maxVrstva: u.maxVrstva, maxRetaz: MAX_RETAZ }).solved, u.id + ' ' + d + ': owl ' + i + ' is not needed');
    }
  }
});
test('6b. the fast check the generator uses agrees with solveHuman (all 30 days, every owl)', () => {
  for (const u of LEVELS) for (const d of DNI) {
    const p = zadanie(d, u);
    assert(riesitelne(p.givens, u.n, u.maxVrstva), u.id + ' ' + d + ' not solvable by the fast check');
    for (let i = 0; i < p.givens.length; i++) {
      if (p.givens[i] == null) continue;
      const g = p.givens.slice(); g[i] = null;
      assert(!riesitelne(g, u.n, u.maxVrstva), u.id + ' ' + d + ': owl ' + i + ' is not needed');
    }
  }
});

// ── 7. the first step ───────────────────────────────────────────────────
test('7. the first step on the empty tree is a layer 1 step, 30 days on all levels', () => {
  for (const u of LEVELS) for (const d of DNI) {
    const p = zadanie(d, u);
    const r = solveHuman(p.givens, u.n, { limitKrokov: 1 });
    eq(r.steps[0].layer, 1, u.id + ' ' + d);
    const h = napoveda(p.givens.map((x) => (x == null ? 0 : x + 1)), p.givens, p.solution, u.n);
    eq(h.vrstva, 1, 'the first hint of ' + u.id + ' ' + d);
    texty.push(h.text1, h.text2);
  }
});

// ── 8. the difficulty number ────────────────────────────────────────────
test('8. layer counts stay under 1000, so obtiaznost never spills', () => {
  for (const u of LEVELS) for (const d of DNI) {
    const l = zadanie(d, u).difficulty.layers;
    assert(l[0] < 1000 && l[1] < 1000, u.id + ' ' + d + ' ' + l);
  }
});

// ── 9. rozbal refuses damage ────────────────────────────────────────────
test('9. rozbal refuses a damaged record: length, character, given against solution, three alike, twin rows', () => {
  const p = zadanie(DNI[2], LEVELS[1]);
  const z = zbal({ ...p, uroven: 'medium' });
  const ok = rozbal(z);
  eq(ok.givens, p.givens); eq(ok.solution, p.solution);
  const zmen = (s, i, ch) => s.slice(0, i) + ch + s.slice(i + 1);
  const i0 = p.givens.findIndex((x) => x != null);
  // a solution whose first row reads 1,1,1 at the start
  const troj = zmen(zmen(zmen(z.s, 0, '1'), 1, '1'), 2, '1');
  // a solution with row 2 copied onto row 1
  const dvoj = z.s.slice(8, 16) + z.s.slice(8);
  const zle = [
    { ...z, g: z.g.slice(1) },
    { ...z, s: z.s + '0' },
    { ...z, g: zmen(z.g, 5, 'x') },
    { ...z, s: zmen(z.s, 3, '2') },
    { ...z, g: zmen(z.g, i0, z.g[i0] === '1' ? '0' : '1') },
    { ...z, s: troj, g: '.'.repeat(64) },
    { ...z, s: dvoj, g: '.'.repeat(64) },
  ];
  for (const x of zle) {
    let threw = false;
    try { rozbal(x); } catch (e) { threw = /Bad packed puzzle/.test(e.message); }
    assert(threw, 'accepted a damaged record: ' + JSON.stringify(x).slice(0, 80));
  }
});

// ── 10. time ────────────────────────────────────────────────────────────
test('10. a whole Sunday (six challenge candidates) takes under 4 s', () => {
  const nedele = ['2026-09-13', '2026-09-20', '2026-09-27', '2026-10-04', '2026-11-15', '2027-02-07'];
  let najhorsi = 0;
  const casy = [];
  for (const d of nedele) {
    const t0 = performance.now();
    for (let k = 0; k < 6; k++) generateSeeded(d, d + '/12' + (k ? '#' + k : ''), { n: 12, maxVrstva: 3 });
    const ms = performance.now() - t0;
    casy.push(Math.round(ms));
    najhorsi = Math.max(najhorsi, ms);
  }
  console.log('     Sundays: ' + casy.join(', ') + ' ms');
  assert(najhorsi < 4000, 'slowest Sunday took ' + Math.round(najhorsi) + ' ms');
});

// ── 11. no borrowed names, no dashes ────────────────────────────────────
const ZAKAZANE = [/takuzu/i, /binairo/i, /tango/i, /linkedin/i, /unruly/i, /0h h1/i, /–/, /—/];
function bezZakazanych(meno, text) {
  for (const re of ZAKAZANE) assert(!re.test(text), meno + ' contains ' + re);
}
test('11. no borrowed puzzle names and no dashes in the page, the guide, the lists and every sentence of the solver', () => {
  const index = readFileSync(join(TU, 'index.html'), 'utf8');
  bezZakazanych('index.html', index);
  // "binary logic puzzle" may describe the game to a search engine, never to the player
  const bezPopisu = index.replace(/<meta name="description" content="[^"]*">/, '').replace(/<meta property="og:description" content="[^"]*">/, '');
  assert(!/binary/i.test(bezPopisu), 'the word binary outside the two descriptions of index.html');
  const guide = join(TU, 'guide', 'index.html');
  assert(existsSync(guide), 'guide/index.html is not built yet (node ops/games/owls/postav.mjs --zapis)');
  const g = readFileSync(guide, 'utf8');
  bezZakazanych('guide/index.html', g);
  bezZakazanych('zoznamy.js', readFileSync(join(TU, 'zoznamy.js'), 'utf8'));
  bezZakazanych('game.js', readFileSync(join(TU, 'game.js'), 'utf8'));
  assert(texty.length > 1000, 'too few sentences collected: ' + texty.length);
  for (const t of new Set(texty)) bezZakazanych('a step sentence', t);
  // the wrong owl hint and the fallback have sentences of their own
  const p = zadanie(DNI[0], LEVELS[0]);
  const v = p.givens.map((x) => (x == null ? 0 : x + 1));
  const i = p.givens.findIndex((x) => x == null);
  v[i] = 2 - p.solution[i];
  const h = napoveda(v, p.givens, p.solution, 6);
  eq(h.druh, 'chyba');
  bezZakazanych('the wrong owl hint', h.text1 + h.text2);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exitCode = 1;
