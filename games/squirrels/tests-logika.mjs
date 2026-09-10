/* Tests for logika.mjs and plan.mjs. Run: node tests-logika.mjs
 * The important one: hints never contradict the solution, on puzzles of every
 * size, and hints alone carry an empty board all the way to the finished
 * puzzle. */
import { porovnaj, jeVyriesene, napoveda } from './logika.mjs';
import { behy, cluesFromSolution, solve } from './generator.mjs';
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

/* An empty board for a puzzle: every hollow at 0. */
function prazdna(p) { return new Array(p.n * p.n).fill(0); }

/* Plays a puzzle with hints only: apply every hint, check it against the
 * solution, stop when the puzzle is finished. Returns how many hints were
 * plain reveals (druh 'odhalenie': no rule of any layer found a next step,
 * which should never happen on an accepted puzzle). */
function hrajNapovedami(p) {
  const v = prazdna(p);
  let odhalenia = 0, krokov = 0;
  const vrstvy = { 1: 0, 2: 0, 3: 0 };
  while (!jeVyriesene(v, p.cells, p.n)) {
    const h = napoveda(v, p.cells, p.solution, p.n);
    assert(h, 'no hint on an unfinished puzzle');
    assert(h.bunky.length > 0, 'hint without hollows: ' + h.druh);
    assert(h.text && h.text.length > 10, 'hint without text');
    assert(!/[–—]/.test(h.text), 'no dashes in text shown to a person: ' + h.text);
    assert(typeof h.pravidlo === 'string' && h.pravidlo.length, 'hint without a rule name');
    for (const c of h.bunky) {
      eq(c.i, c.r * p.n + c.c, 'hint hollow index does not match its address');
      assert(v[c.i] === 0, 'hint ' + h.pravidlo + ' touches a hollow that is already filled in');
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
  let a = -1;
  for (let i = 0; i < p.solution.length; i++) if (p.solution[i]) { a = i; break; }
  v[a] = p.solution[a] === 9 ? 1 : p.solution[a] + 1; // one number too high
  const r = porovnaj(v, p.solution);
  eq(r.zle, [a]); eq(r.vyplnene, 1);
});

test('porovnaj is happy with the finished puzzle and never blames an empty hollow', () => {
  const p = den(PRVY_DEN);
  const r = porovnaj(p.solution, p.solution);
  eq(r.zle, []);
  assert(r.vyplnene > 0);
  eq(porovnaj(prazdna(p), p.solution), { vyplnene: 0, zle: [] });
});

test('jeVyriesene accepts the generated puzzle and rejects it one hollow short', () => {
  const p = den(PRVY_DEN);
  const v = p.solution.slice();
  assert(jeVyriesene(v, p.cells, p.n));
  for (let i = 0; i < v.length; i++) if (v[i]) { v[i] = 0; break; }
  assert(!jeVyriesene(v, p.cells, p.n));
});

test('jeVyriesene rejects a board whose totals are right but repeats a number in a run', () => {
  // Hand-verified 3 x 3: hollows 1, 2 / 3, 4 with totals 3 and 7 across, 4
  // and 6 down. Writing 2, 1 / 2, 5 keeps both totals across and both totals
  // down, but the 4 down would hold 2 and 2.
  const n = 3;
  const dark = Uint8Array.from([1, 1, 1, 1, 0, 0, 1, 0, 0]);
  const cells = cluesFromSolution(dark, [0, 0, 0, 0, 1, 2, 0, 3, 4], n);
  const zly = [0, 0, 0, 0, 2, 1, 0, 2, 5];
  const { runs } = behy(cells, n);
  for (const run of runs) {
    let s = 0;
    for (const i of run.cells) s += zly[i];
    eq(s, run.sum, 'fixture: every total should still add up');
  }
  assert(!jeVyriesene(zly, cells, n), 'a repeat inside a run must not count as solved');
});

test('napoveda points at a wrong number before anything else', () => {
  const p = den(PRVY_DEN);
  const v = prazdna(p);
  let a = -1;
  for (let i = 0; i < p.solution.length; i++) if (p.solution[i]) { a = i; break; }
  v[a] = p.solution[a] === 9 ? 1 : p.solution[a] + 1;
  const h = napoveda(v, p.cells, p.solution, p.n);
  eq(h.druh, 'chyba'); eq(h.pravidlo, 'wrong-number'); eq(h.bunky[0].val, 0); eq(h.bunky[0].i, a);
});

test('napoveda on an empty board names a rule of the easiest layer and explains it', () => {
  const p = den(PRVY_DEN);
  const h = napoveda(prazdna(p), p.cells, p.solution, p.n);
  eq(h.druh, 'bunka');
  eq(h.vrstva, 1, 'the first step of an accepted puzzle should be a layer 1 rule');
  eq(h.bunky.length, 1);
  assert(h.text.endsWith('.') && h.text.length > 20, h.text);
});

test('napoveda returns null on a finished puzzle', () => {
  const p = den(PRVY_DEN);
  eq(napoveda(p.solution.slice(), p.cells, p.solution, p.n), null);
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
test('the daily puzzles follow the weekly plan: 6, 6, 8, 8, 10, 10, 12', () => {
  const velkosti = [6, 6, 8, 8, 10, 10, 12];
  for (const d of DNI) {
    const p = den(d);
    eq(p.n, velkosti[denVTyzdni(d)], d);
    eq(p.uroven, urovenDna(d), d);
    eq(p.n, UROVNE[p.uroven].n, d);
  }
});
test('every daily puzzle has exactly one solution', () => {
  for (const d of DNI) {
    const p = den(d);
    const r = solve(p.cells, p.n, { limit: 2 });
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
test('a harder level really does take more work: Challenge needs more steps than Easy', () => {
  const pre = (u) => {
    let sum = 0, k = 0;
    for (const d of DNI) { if (urovenDna(d) !== u) continue; sum += den(d).difficulty.steps; k++; }
    return sum / k;
  };
  const easy = pre('easy'), challenge = pre('challenge');
  assert(challenge > easy, 'challenge ' + challenge + ' should take more steps than easy ' + easy);
});
test('the picked candidate is one of the KANDIDATOV made for that day and its difficulty is measured', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = den(d);
    assert(p.kandidat >= 0 && p.kandidat < KANDIDATOV, 'no candidate index for ' + d);
    assert(Number.isInteger(obtiaznost(p)) && obtiaznost(p) > 0, 'no measurement for ' + d);
    assert(p.difficulty.trunks > 0 && p.difficulty.trunks < p.n * p.n, 'odd number of trunks on ' + d);
  }
});
test('the same date always gives the same puzzle', () => {
  for (const d of DNI.slice(0, 3)) {
    const a = zadaniePreDen(d), b = zadaniePreDen(d);
    eq(a.cells, b.cells, d); eq(a.solution, b.solution, d); eq(a.kandidat, b.kandidat, d);
  }
});
test('zbal and rozbal round-trip and stay reasonably small', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = den(d);
    const z = zbal(p), r = rozbal(z);
    eq(r.cells, p.cells); eq(r.solution, p.solution); eq(r.n, p.n); eq(r.uroven, p.uroven);
    eq(r.difficulty.layers, p.difficulty.layers);
    assert(JSON.stringify(z).length < 30 * p.n, 'packed day too big for ' + p.n + 'x' + p.n + ': ' + JSON.stringify(z).length + ' bytes');
    assert(jeVyriesene(r.solution, r.cells, r.n), 'the unpacked puzzle is not finished by its own solution');
  }
});
test('rozbal refuses a packed puzzle of the wrong shape', () => {
  const z = zbal(den(PRVY_DEN));
  for (const zly of [{ ...z, b: z.b.slice(1) }, { ...z, s: 5 }, { ...z, s: z.s + '1' }, { ...z, b: z.b.replace('#', 'x') }]) {
    let threw = false;
    try { rozbal(zly); } catch (e) { threw = true; }
    assert(threw, 'accepted a broken packed puzzle');
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

console.log('\n  hints per puzzle (reveals = no rule found a step, always 0 for an accepted puzzle):');
for (const r of vysledky) {
  console.log('  ' + r.d.padEnd(16) + ' n' + String(r.n).padEnd(3) + r.u.padEnd(10) + ' steps ' + String(r.krokov).padStart(3) +
    '  layers ' + r.vrstvy[1] + '/' + r.vrstvy[2] + '/' + r.vrstvy[3] + '  reveals ' + r.odhalenia);
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
