/* Tests for logika.mjs and plan.mjs. Run: node tests-logika.mjs
 * The important one: hints never contradict the solution, on marshes of every
 * size, and hints alone carry an empty board all the way to the finished
 * puzzle. */
import { porovnaj, jeVyriesene, napoveda } from './logika.mjs';
import { solve } from './generator.mjs';
import {
  zadaniePreDen, zadanieCvicenie, zbal, rozbal, tyzden, denVTyzdni, urovenDna,
  posunDen, pekneDatum, kratkyDatum, obtiaznost, SADY, PRVY_DEN, UROVNE, KANDIDATOV,
  rozsahParov,
} from './plan.mjs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok    ' + name); }
  catch (e) { failed++; console.log('  FAIL  ' + name + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ' + JSON.stringify(a) + ' != ' + JSON.stringify(b)); }

/* An empty board for a puzzle. */
function prazdna(p) { return new Array(p.n * p.n).fill(0); }

/* Eight pairs of neighbouring nests on a 4 x 4 marsh: every path is one step
 * long and the board is its own solution. Small enough to check by eye. */
const DOMINA_ENDS = [1, 1, 2, 2, 3, 3, 4, 4, 7, 7, 5, 5, 8, 8, 6, 6];

/* The same marsh with the two nests of pairs 7 and 8 taken off, and those four
 * cells given to the path 1 instead. Every cell still has the right number of
 * neighbours on its own path (the four make a ring), but the path 1 is in two
 * pieces, so the board is not a solution. */
const ROZPADNUTE_ENDS = [1, 1, 2, 2, 3, 3, 4, 4, 0, 0, 5, 5, 0, 0, 6, 6];
const ROZPADNUTE_V = [1, 1, 2, 2, 3, 3, 4, 4, 1, 1, 5, 5, 1, 1, 6, 6];

/* A 3 x 3 where the path 1 runs beside itself: it leaves the nest in the top
 * left corner, goes round and comes back next to where it started. */
const DOTYK_ENDS = [1, 0, 2, 0, 0, 0, 1, 0, 2];
const DOTYK_V = [1, 1, 2, 1, 1, 2, 1, 2, 2];

/* Plays a puzzle with hints only: apply every hint, check it against the
 * solution, stop when the marsh is full. Returns how many hints were plain
 * reveals (druh 'odhalenie': no rule of any layer found a next cell, which
 * should never happen on an accepted puzzle). */
function hrajNapovedami(p) {
  const v = prazdna(p);
  let odhalenia = 0, krokov = 0;
  const vrstvy = { 1: 0, 2: 0, 3: 0 };
  while (!jeVyriesene(v, p.ends, p.n)) {
    const h = napoveda(v, p.ends, p.solution, p.n);
    assert(h, 'no hint on an unfinished marsh');
    assert(h.bunky.length > 0, 'hint without any cell: ' + h.druh);
    assert(h.text && h.text.length > 10, 'hint without text');
    assert(!/[–—]/.test(h.text), 'a dash slipped into a hint: ' + h.text);
    assert(typeof h.pravidlo === 'string' && h.pravidlo.length, 'hint without a rule name');
    for (const b of h.bunky) {
      assert(b.i >= 0 && b.i < p.n * p.n, 'hint points outside the marsh');
      assert(!v[b.i], 'hint ' + h.pravidlo + ' touches a cell that is already drawn');
      eq(b.pair, p.solution[b.i], 'hint ' + h.pravidlo + ' gives a cell to the wrong path');
      v[b.i] = b.pair;
    }
    if (h.druh === 'odhalenie') odhalenia++;
    else if (h.vrstva >= 1 && h.vrstva <= 3) vrstvy[h.vrstva]++;
    if (++krokov > 4000) throw new Error('hints do not converge');
  }
  return { odhalenia, krokov, vrstvy };
}

test('porovnaj counts the drawn cells and names only the wrong ones', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const v = prazdna(p);
  const i = p.solution.findIndex((x, j) => !p.ends[j] && x === 1);
  const j = p.solution.findIndex((x) => x === 2);
  v[i] = 1; // right
  v[j] = 1; // wrong, that cell belongs to the path 2
  const r = porovnaj(v, p.solution);
  eq(r.vyplnene, 2);
  eq(r.zle, [j], 'only the wrong cell');
});

test('porovnaj is happy with the finished marsh', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const r = porovnaj(p.solution, p.solution);
  eq(r.zle, []);
  assert(r.vyplnene === p.n * p.n);
});

test('jeVyriesene accepts the generated filling and rejects it one cell short', () => {
  const p = zadaniePreDen(PRVY_DEN);
  assert(jeVyriesene(p.solution, p.ends, p.n));
  const v = p.solution.slice();
  const i = v.findIndex((x, j) => !p.ends[j]);
  v[i] = 0;
  assert(!jeVyriesene(v, p.ends, p.n));
});

test('jeVyriesene rejects an empty board and any single cell given to the wrong path', () => {
  const p = zadaniePreDen(PRVY_DEN);
  assert(!jeVyriesene(prazdna(p), p.ends, p.n));
  let skusenych = 0;
  for (let i = 0; i < p.n * p.n && skusenych < 6; i++) {
    if (p.ends[i]) continue;
    const v = p.solution.slice();
    v[i] = (v[i] % p.pairs) + 1;
    if (v[i] === p.solution[i]) continue;
    skusenych++;
    assert(!jeVyriesene(v, p.ends, p.n), 'cell ' + i + ' given to the path ' + v[i] + ' still counted as solved');
  }
  assert(skusenych > 0, 'nothing was tried');
});

test('jeVyriesene accepts the hand checked 4 x 4 of eight short paths', () => {
  assert(jeVyriesene(DOMINA_ENDS, DOMINA_ENDS, 4));
  eq(solve(DOMINA_ENDS, 4, { limit: 2 }).count, 1, 'the fixture should have exactly one filling');
});

test('jeVyriesene rejects a path that is in two pieces even when every cell has the right neighbours', () => {
  assert(!jeVyriesene(ROZPADNUTE_V, ROZPADNUTE_ENDS, 4));
});

test('jeVyriesene rejects a path that runs beside itself', () => {
  assert(!jeVyriesene(DOTYK_V, DOTYK_ENDS, 3));
});

test('napoveda points at a wrong cell before anything else', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const v = prazdna(p);
  const i = p.solution.findIndex((x, j) => !p.ends[j] && x !== 1);
  v[i] = 1;
  const h = napoveda(v, p.ends, p.solution, p.n);
  eq(h.druh, 'chyba');
  eq(h.pravidlo, 'wrong-cell');
  eq(h.bunky, [{ i, pair: 0 }]);
});

test('napoveda on an empty board names a rule of the easiest layer and explains it', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const h = napoveda(prazdna(p), p.ends, p.solution, p.n);
  eq(h.druh, 'bunka');
  eq(h.vrstva, 1, 'the first step of an accepted puzzle should be a layer 1 rule');
  assert(h.bunky.length >= 1);
  assert(h.text.endsWith('.') && h.text.length > 20, h.text);
});

test('napoveda returns null on a finished marsh', () => {
  const p = zadaniePreDen(PRVY_DEN);
  eq(napoveda(p.solution, p.ends, p.solution, p.n), null);
});

const DNI = []; for (let k = 0; k < 14; k++) DNI.push(posunDen(PRVY_DEN, k));
const vysledky = [];
test('hints carry an empty board to the finished marsh for 14 consecutive days (all sizes), never contradicting the solution and never needing a plain reveal', () => {
  for (const d of DNI) {
    const p = zadaniePreDen(d);
    const r = hrajNapovedami(p);
    vysledky.push({ d, n: p.n, u: p.uroven, ...r });
    assert(r.odhalenia === 0, d + ' needed a plain reveal, but every accepted puzzle should be reachable by the rules alone');
  }
});
test('hints solve the first puzzle of every practice set', () => {
  for (const s of SADY) {
    const p = zadanieCvicenie(s.id, 1);
    const r = hrajNapovedami(p);
    vysledky.push({ d: s.id, n: p.n, u: p.uroven, ...r });
    assert(r.odhalenia === 0, s.id + ' needed a plain reveal');
  }
});
test('the daily marshes follow the weekly plan: 5, 5, 6, 6, 7, 7, 8', () => {
  const velkosti = [5, 5, 6, 6, 7, 7, 8];
  for (const d of DNI) {
    const p = zadaniePreDen(d);
    eq(p.n, velkosti[denVTyzdni(d)], d);
    eq(p.uroven, urovenDna(d), d);
    eq(p.n, UROVNE[p.uroven].n, d);
    const [kMin, kMax] = rozsahParov(p.n);
    assert(p.pairs >= kMin && p.pairs <= kMax, d + ' has ' + p.pairs + ' pairs, the size allows ' + kMin + ' to ' + kMax);
  }
});
test('Easy and Medium never ask for a trial: no layer 3 step anywhere in their week', () => {
  for (const d of DNI) {
    const u = urovenDna(d);
    if (u !== 'easy' && u !== 'medium') continue;
    const p = zadaniePreDen(d);
    eq(p.difficulty.layers[3], 0, d + ' (' + u + ') needs a layer 3 step');
  }
});
test('the harder the level, the more it leans on the rules beyond the plain local ones', () => {
  const pre = (u) => {
    let sum = 0, n = 0;
    for (const d of DNI) {
      if (urovenDna(d) !== u) continue;
      const l = zadaniePreDen(d).difficulty.layers;
      sum += l[2] + l[3]; n++;
    }
    return n ? sum / n : 0;
  };
  const easy = pre('easy'), medium = pre('medium'), hard = pre('hard'), challenge = pre('challenge');
  console.log('        layer 2 and 3 steps per day: easy ' + easy.toFixed(1) + ', medium ' + medium.toFixed(1) + ', hard ' + hard.toFixed(1) + ', challenge ' + challenge.toFixed(1));
  assert(challenge > easy, 'challenge ' + challenge + ' should ask more than easy ' + easy);
  assert(hard >= medium, 'hard ' + hard + ' should ask at least as much as medium ' + medium);
});
test('the picked candidate is one of the KANDIDATOV made for that day and its difficulty is measured', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = zadaniePreDen(d);
    assert(p.kandidat >= 0 && p.kandidat < KANDIDATOV, 'no candidate index for ' + d);
    assert(Number.isInteger(obtiaznost(p)) && obtiaznost(p) > 0, 'no measurement for ' + d);
    assert(p.difficulty.steps > 0, 'no steps counted on ' + d);
  }
});
test('the same date always gives the same puzzle', () => {
  for (const d of DNI.slice(0, 3)) {
    const a = zadaniePreDen(d), b = zadaniePreDen(d);
    eq(a.ends, b.ends, d); eq(a.solution, b.solution, d); eq(a.kandidat, b.kandidat, d);
  }
});
test('zbal and rozbal round trip and stay reasonably small', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = zadaniePreDen(d);
    const z = zbal(p), r = rozbal(z);
    eq(r.ends, p.ends); eq(r.solution, p.solution); eq(r.n, p.n); eq(r.uroven, p.uroven);
    eq(r.pairs, p.pairs);
    eq(r.difficulty.layers, p.difficulty.layers);
    assert(JSON.stringify(z).length < 55 * p.n, 'packed day too big for ' + p.n + 'x' + p.n + ': ' + JSON.stringify(z).length + ' bytes');
    assert(jeVyriesene(r.solution, r.ends, r.n), 'the unpacked filling does not finish its own puzzle');
  }
});
test('rozbal refuses a packed puzzle of the wrong shape', () => {
  const z = zbal(zadaniePreDen(PRVY_DEN));
  const zle = [
    { ...z, e: z.e.slice(1) },
    { ...z, s: 5 },
    { ...z, s: z.s + '0' },
    { ...z, e: 'x' + z.e.slice(1) },
    { ...z, e: z.e.replace('1', '0') }, // a pair left with a single nest
    { ...z, n: 0 },
  ];
  for (const x of zle) {
    let threw = false;
    try { rozbal(x); } catch (e) { threw = true; }
    assert(threw, 'accepted a broken packed puzzle: ' + JSON.stringify(x).slice(0, 60));
  }
});
test('tyzden gives Monday to Sunday around the date', () => {
  eq(tyzden('2026-09-10'), ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']);
  eq(tyzden('2026-09-13')[6], '2026-09-13');
  eq(tyzden('2026-09-14')[0], '2026-09-14');
  eq(denVTyzdni('2026-09-14'), 0);
  eq(pekneDatum('2026-09-10'), 'Thursday 10 September 2026');
  eq(kratkyDatum('2026-09-10'), '10 Sep');
  eq(posunDen('2026-02-28', 1), '2026-03-01');
});

console.log('\n  hints per puzzle (reveals = no rule found a cell, always 0 for an accepted puzzle):');
for (const r of vysledky) {
  console.log('  ' + r.d.padEnd(16) + ' n' + r.n + ' ' + r.u.padEnd(10) + ' hints ' + String(r.krokov).padStart(3) +
    '  layers ' + r.vrstvy[1] + '/' + r.vrstvy[2] + '/' + r.vrstvy[3] + '  reveals ' + r.odhalenia);
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
