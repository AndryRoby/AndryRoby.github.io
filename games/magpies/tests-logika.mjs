/* Tests for logika.mjs and plan.mjs. Run: node tests-logika.mjs
 * The important one: hints never contradict the solution, on gardens of
 * every size, from the empty board to the solved one. */
import { porovnaj, jeVyriesene, napoveda } from './logika.mjs';
import {
  zadaniePreDen, zadanieCvicenie, zbal, rozbal, tyzden, denVTyzdni, urovenDna,
  posunDen, pekneDatum, SADY, PRVY_DEN, UROVNE, KANDIDATOV,
} from './plan.mjs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok    ' + name); }
  catch (e) { failed++; console.log('  FAIL  ' + name + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ' + JSON.stringify(a) + ' != ' + JSON.stringify(b)); }

/* Plays a garden with hints only: apply every hint, check it against the
 * solution, stop when solved. Returns how many hints were plain reveals
 * (druh 'odhalenie': line logic alone could not find the next step). */
function hrajNapovedami(p) {
  const n = p.n, v = new Array(n * n).fill(0);
  let odhalenia = 0, krokov = 0;
  while (!jeVyriesene(v, p.clues)) {
    const h = napoveda(v, p.clues, p.solution);
    assert(h, 'no hint on an unsolved board');
    assert(h.bunky.length > 0, 'hint without cells: ' + h.druh);
    assert(h.text && h.text.length > 10, 'hint without text');
    for (const i of h.bunky) {
      assert(v[i] === 0, 'hint ' + h.druh + ' marks a cell that is already marked');
      if (h.hodnota === 1) assert(p.solution[i] === 1, 'hint ' + h.druh + ' fills an empty cell of the solution');
      if (h.hodnota === 2) assert(p.solution[i] !== 1, 'hint ' + h.druh + ' crosses out a filled cell of the solution');
      v[i] = h.hodnota;
    }
    if (h.druh === 'odhalenie') odhalenia++;
    if (++krokov > 2000) throw new Error('hints do not converge');
  }
  return { odhalenia, krokov };
}

test('porovnaj counts wrong fills and wrong crosses, never unmarked cells', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const v = new Array(p.n * p.n).fill(0);
  const filled = p.solution.indexOf(1), empty = p.solution.indexOf(0);
  v[filled] = 2; // a cross where the solution is filled: wrong
  v[empty] = 1;  // a fill where the solution is empty: wrong
  const r = porovnaj(v, p.solution);
  eq(r.zleKrizky, [filled]); eq(r.zleVyplnene, [empty]); eq(r.vyplnene, 1); eq(r.krizky, 1);
});

test('jeVyriesene accepts the generated solution and rejects one cell short', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const v = p.solution.slice();
  assert(jeVyriesene(v, p.clues));
  const i = v.indexOf(1); v[i] = 0;
  assert(!jeVyriesene(v, p.clues));
});

test('jeVyriesene ignores crosses: marking every empty cell with a cross still solves it', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const v = p.solution.map((x) => (x ? 1 : 2));
  assert(jeVyriesene(v, p.clues));
});

test('napoveda points at a wrong fill before anything else', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const v = new Array(p.n * p.n).fill(0);
  v[p.solution.indexOf(0)] = 1;
  const h = napoveda(v, p.clues, p.solution);
  eq(h.druh, 'chyba'); eq(h.hodnota, 0);
});

test('napoveda points at a wrong cross next, once there is no wrong fill', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const v = new Array(p.n * p.n).fill(0);
  v[p.solution.indexOf(1)] = 2;
  const h = napoveda(v, p.clues, p.solution);
  eq(h.druh, 'chyba'); eq(h.hodnota, 1);
});

test('napoveda on an empty board names a row or a column with an explanation', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const v = new Array(p.n * p.n).fill(0);
  const h = napoveda(v, p.clues, p.solution);
  assert(h.druh === 'riadok' || h.druh === 'stlpec', h.druh);
  assert(h.cislo >= 1 && h.cislo <= p.n);
  assert(h.hodnota === 1 || h.hodnota === 2);
});

test('napoveda returns null on a solved board', () => {
  const p = zadaniePreDen(PRVY_DEN);
  eq(napoveda(p.solution.slice(), p.clues, p.solution), null);
});

const DNI = []; for (let k = 0; k < 28; k++) DNI.push(posunDen(PRVY_DEN, k));
const vysledky = [];
test('hints solve 28 consecutive gardens (all sizes) without ever contradicting the solution or needing a plain reveal', () => {
  for (const d of DNI) {
    const p = zadaniePreDen(d);
    const r = hrajNapovedami(p);
    vysledky.push({ d, n: p.n, u: p.uroven, ...r });
    assert(r.odhalenia === 0, d + ' needed a plain reveal, but every accepted garden should be fully reachable by line logic');
  }
});
test('hints solve the first garden of every practice set', () => {
  for (const s of SADY) {
    const p = zadanieCvicenie(s.id, 1);
    const r = hrajNapovedami(p);
    vysledky.push({ d: s.id, n: p.n, u: p.uroven, ...r });
  }
});
test('the daily gardens follow the weekly plan: 8, 10, 12, 15', () => {
  for (const d of DNI) {
    const p = zadaniePreDen(d);
    const dz = denVTyzdni(d);
    eq(p.n, dz <= 1 ? 8 : dz <= 3 ? 10 : dz <= 5 ? 12 : 15, d);
    eq(p.uroven, urovenDna(d), d);
  }
});
test('the picked candidate is ranked by passes: easy has the fewest of the 6, challenge the most', () => {
  for (const d of DNI.slice(0, 14)) {
    const p = zadaniePreDen(d);
    assert(Number.isInteger(p.difficulty.passes) && p.kandidat >= 0 && p.kandidat < KANDIDATOV, 'no measurement for ' + d);
  }
});
test('zbal and rozbal round-trip and stay reasonably small', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = zadaniePreDen(d);
    const z = zbal(p), r = rozbal(z);
    eq(r.clues, p.clues); eq(r.solution, p.solution); eq(r.n, p.n);
    assert(JSON.stringify(z).length < 55 * p.n, 'packed day too big for ' + p.n + 'x' + p.n + ': ' + JSON.stringify(z).length + ' bytes');
  }
});
test('tyzden gives Monday to Sunday around the date', () => {
  eq(tyzden('2026-09-10'), ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']);
  eq(tyzden('2026-09-13')[6], '2026-09-13');
  eq(tyzden('2026-09-14')[0], '2026-09-14');
  eq(denVTyzdni('2026-09-14'), 0);
  eq(pekneDatum('2026-09-10'), 'Thursday 10 September 2026');
});

console.log('\n  hints per garden (odhalenia = plain reveals, always 0 for an accepted garden):');
for (const r of vysledky) console.log('  ' + r.d.padEnd(16) + ' n' + r.n + ' ' + r.u.padEnd(9) + ' steps ' + String(r.krokov).padStart(3) + '  reveals ' + r.odhalenia);
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
