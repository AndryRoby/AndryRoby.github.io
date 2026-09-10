/* Tests for logika.mjs and plan.mjs. Run: node tests-logika.mjs
 * The important one: hints never contradict the solution, on puzzles of every
 * size, and hints alone carry an empty board all the way to the finished
 * puzzle. */
import { porovnaj, jeVyriesene, napoveda } from './logika.mjs';
import { solve, ohradyOk } from './generator.mjs';
import {
  zadaniePreDen, zadanieCvicenie, zbal, rozbal, tyzden, denVTyzdni, urovenDna,
  posunDen, pekneDatum, kratkyDatum, obtiaznost, SADY, PRVY_DEN, UROVNE, KANDIDATOV,
} from './plan.mjs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok    ' + name); }
  catch (e) { failed++; console.log('  FAIL  ' + name + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ' + JSON.stringify(a) + ' != ' + JSON.stringify(b)); }

/* Building a day's puzzle is the slow part and several tests want the same
   day, so each one is built once and kept. */
const PAMAT = new Map();
function den(iso) {
  if (!PAMAT.has(iso)) PAMAT.set(iso, zadaniePreDen(iso));
  return PAMAT.get(iso);
}

/* An empty board for a puzzle: every cell at 0. */
function prazdna(p) { return new Array(p.n * p.n).fill(0); }

/* Plays a puzzle with hints only: apply every hint, check it against the
 * solution, stop when the puzzle is finished. Returns how many hints were
 * plain reveals (druh 'odhalenie': no rule of any layer found a next step,
 * which should never happen on an accepted puzzle). */
function hrajNapovedami(p) {
  const v = prazdna(p);
  let odhalenia = 0, krokov = 0;
  const vrstvy = { 1: 0, 2: 0, 3: 0 };
  while (!jeVyriesene(v, p.cages, p.n)) {
    const h = napoveda(v, p.cages, p.solution, p.n);
    assert(h, 'no hint on an unfinished puzzle');
    assert(h.bunky.length > 0, 'hint without cells: ' + h.druh);
    assert(h.text && h.text.length > 10, 'hint without text');
    assert(!/[–—]/.test(h.text), 'no dashes in text shown to a person: ' + h.text);
    assert(typeof h.pravidlo === 'string' && h.pravidlo.length, 'hint without a rule name');
    for (const c of h.bunky) {
      eq(c.i, c.r * p.n + c.c, 'hint cell index does not match its address');
      assert(v[c.i] === 0, 'hint ' + h.pravidlo + ' touches a cell that is already filled in');
      eq(c.val, p.solution[c.i], 'hint ' + h.pravidlo + ' writes a number the puzzle does not have there');
      v[c.i] = c.val;
    }
    if (h.druh === 'odhalenie') odhalenia++;
    else if (h.vrstva >= 1 && h.vrstva <= 3) vrstvy[h.vrstva]++;
    if (++krokov > 4000) throw new Error('hints do not converge');
  }
  return { odhalenia, krokov, vrstvy };
}

test('porovnaj counts the numbers written down and points at the wrong ones', () => {
  const p = den(PRVY_DEN);
  const v = prazdna(p);
  v[0] = p.solution[0] === p.n ? 1 : p.solution[0] + 1; // one number too high
  const r = porovnaj(v, p.solution);
  eq(r.zle, [0]); eq(r.vyplnene, 1);
});

test('porovnaj is happy with the finished puzzle and never blames an empty cell', () => {
  const p = den(PRVY_DEN);
  const r = porovnaj(p.solution, p.solution);
  eq(r.zle, []);
  eq(r.vyplnene, p.n * p.n);
  eq(porovnaj(prazdna(p), p.solution), { vyplnene: 0, zle: [] });
});

test('jeVyriesene accepts the generated puzzle and rejects it one cell short', () => {
  const p = den(PRVY_DEN);
  const v = p.solution.slice();
  assert(jeVyriesene(v, p.cages, p.n));
  v[0] = 0;
  assert(!jeVyriesene(v, p.cages, p.n));
});

test('jeVyriesene rejects a board whose totals are right but repeats a number in a row', () => {
  // Hand-verified 4 x 4: the grid 1 2 3 4 / 3 4 1 2 / 2 1 4 3 / 4 3 2 1 with
  // each row as one pen of 10. Writing 1 1 4 4 in the first row keeps the
  // total at 10, but a row may not hold the same number twice.
  const n = 4;
  const cages = [0, 1, 2, 3].map((r) => ({ sum: 10, cells: [r * 4, r * 4 + 1, r * 4 + 2, r * 4 + 3] }));
  const zly = [1, 1, 4, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1];
  for (const cage of cages) {
    let s = 0;
    for (const i of cage.cells) s += zly[i];
    eq(s, cage.sum, 'fixture: every total should still add up');
  }
  assert(!jeVyriesene(zly, cages, n), 'a repeat inside a row must not count as solved');
});

test('jeVyriesene rejects a board that fits every row, column and block but not a pen', () => {
  const p = den(PRVY_DEN);
  const cages = p.cages.map((c) => ({ sum: c.sum + (c === p.cages[0] ? 1 : 0), cells: c.cells.slice() }));
  assert(!jeVyriesene(p.solution.slice(), cages, p.n), 'a pen whose total does not add up must not count as solved');
});

test('napoveda points at a wrong number before anything else', () => {
  const p = den(PRVY_DEN);
  const v = prazdna(p);
  v[0] = p.solution[0] === p.n ? 1 : p.solution[0] + 1;
  const h = napoveda(v, p.cages, p.solution, p.n);
  eq(h.druh, 'chyba'); eq(h.pravidlo, 'wrong-number'); eq(h.bunky[0].val, 0); eq(h.bunky[0].i, 0);
});

test('napoveda on an empty board names one of the rules and explains it', () => {
  // Which layer opens a puzzle is up to the puzzle: a board with a pen of one
  // cell starts at layer 1, one where the first thing to see is the total of a
  // whole row starts at layer 2. What matters is that the hint is a real rule
  // with a real sentence, and that it fills exactly one cell.
  const znama = new Set(['single-cell-cage', 'single-combo', 'naked-single', 'hidden-single',
    'unit-sum-in', 'unit-sum-out', 'pair', 'cage-sum', 'cage-in-unit', 'trial']);
  for (const d of [PRVY_DEN, posunDen(PRVY_DEN, 4), posunDen(PRVY_DEN, 5)]) {
    const p = den(d);
    const h = napoveda(prazdna(p), p.cages, p.solution, p.n);
    eq(h.druh, 'bunka', d);
    assert(znama.has(h.pravidlo), d + ': unknown rule ' + h.pravidlo);
    assert(h.vrstva >= 1 && h.vrstva <= 3, d + ': step outside the three layers');
    eq(h.bunky.length, 1, d);
    eq(h.bunky[0].val, p.solution[h.bunky[0].i], d + ': the first hint writes the wrong number');
    assert(h.text.endsWith('.') && h.text.length > 20, h.text);
  }
});

test('napoveda returns null on a finished puzzle', () => {
  const p = den(PRVY_DEN);
  eq(napoveda(p.solution.slice(), p.cages, p.solution, p.n), null);
});

const DNI = []; for (let k = 0; k < 14; k++) DNI.push(posunDen(PRVY_DEN, k));
const vysledky = [];
test('hints carry an empty board to the finished puzzle for 14 consecutive days (all sizes), never contradicting the solution and never needing a plain reveal', () => {
  for (const d of DNI) {
    const p = den(d);
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
test('the daily puzzles follow the weekly plan: 6, 6, 9, 9, 9, 9, 9', () => {
  const velkosti = [6, 6, 9, 9, 9, 9, 9];
  for (const d of DNI) {
    const p = den(d);
    eq(p.n, velkosti[denVTyzdni(d)], d);
    eq(p.uroven, urovenDna(d), d);
    eq(p.n, UROVNE[p.uroven].n, d);
  }
});
test('every daily puzzle is a usable split of the grid and has exactly one solution', () => {
  for (const d of DNI) {
    const p = den(d);
    assert(ohradyOk(p.cages, p.n, { solution: p.solution }), d + ': the pens are not a usable split of the grid');
    const r = solve(p.cages, p.n, { limit: 2 });
    eq(r.count, 1, d);
    eq(r.solution, p.solution, d);
  }
});
test('Easy and Medium never ask anyone to try a number out: no layer 3 step anywhere in their week', () => {
  for (const d of DNI) {
    const u = urovenDna(d);
    if (u !== 'easy' && u !== 'medium') continue;
    const p = den(d);
    eq(p.difficulty.layers[3], 0, d + ' (' + u + ') needs a layer 3 step');
  }
});
test('a harder level really does take more work: Challenge leans on the hard rules more than Easy', () => {
  const pre = (u) => {
    let sum = 0, k = 0;
    for (const d of DNI) { if (urovenDna(d) !== u) continue; sum += obtiaznost(den(d)); k++; }
    return sum / k;
  };
  const easy = pre('easy'), challenge = pre('challenge');
  assert(challenge > easy, 'challenge ' + challenge + ' should be harder than easy ' + easy);
});
test('the picked candidate is one of the KANDIDATOV made for that day and its difficulty is measured', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = den(d);
    assert(p.kandidat >= 0 && p.kandidat < KANDIDATOV, 'no candidate index for ' + d);
    assert(Number.isInteger(obtiaznost(p)) && obtiaznost(p) > 0, 'no measurement for ' + d);
    assert(p.difficulty.cages > 0 && p.difficulty.cages < p.n * p.n, 'odd number of pens on ' + d);
  }
});
test('the same date always gives the same puzzle', () => {
  for (const d of DNI.slice(0, 3)) {
    const a = zadaniePreDen(d), b = zadaniePreDen(d);
    eq(a.cages, b.cages, d); eq(a.solution, b.solution, d); eq(a.kandidat, b.kandidat, d);
  }
});
test('zbal and rozbal round-trip and stay reasonably small', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = den(d);
    const z = zbal(p), r = rozbal(z);
    eq(r.cages, p.cages); eq(r.solution, p.solution); eq(r.n, p.n); eq(r.uroven, p.uroven);
    eq(r.difficulty.layers, p.difficulty.layers);
    assert(JSON.stringify(z).length < 70 * p.n, 'packed day too big for ' + p.n + 'x' + p.n + ': ' + JSON.stringify(z).length + ' bytes');
    assert(jeVyriesene(r.solution, r.cages, r.n), 'the unpacked puzzle is not finished by its own solution');
  }
});
test('rozbal refuses a packed puzzle of the wrong shape', () => {
  const z = zbal(den(PRVY_DEN));
  const zle = [
    { ...z, c: z.c.slice(1) },
    { ...z, s: 5 },
    { ...z, s: z.s + '1' },
    { ...z, s: '0' + z.s.slice(1) },
    { ...z, c: z.c.replace(':', ',') },
    { ...z, c: z.c.split(';').slice(1).join(';') },
    { ...z, n: 7 },
  ];
  for (const x of zle) {
    let threw = false;
    try { rozbal(x); } catch (e) { threw = true; }
    assert(threw, 'accepted a broken packed puzzle: ' + JSON.stringify(x).slice(0, 60));
  }
});
test('rozbal refuses a packed puzzle whose totals no longer match the grid', () => {
  const z = zbal(den(PRVY_DEN));
  const prvy = z.c.split(';')[0];
  const zmeneny = { ...z, c: z.c.replace(prvy, (Number(prvy.split(':')[0]) + 1) + ':' + prvy.split(':')[1]) };
  let threw = false;
  try { rozbal(zmeneny); } catch (e) { threw = true; }
  assert(threw, 'accepted a packed puzzle with a total that does not add up');
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

console.log('\n  hints per puzzle (reveals = no rule found a step, always 0 for an accepted puzzle):');
for (const r of vysledky) {
  console.log('  ' + r.d.padEnd(16) + ' n' + String(r.n).padEnd(3) + r.u.padEnd(10) + ' steps ' + String(r.krokov).padStart(3) +
    '  layers ' + r.vrstvy[1] + '/' + r.vrstvy[2] + '/' + r.vrstvy[3] + '  reveals ' + r.odhalenia);
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
