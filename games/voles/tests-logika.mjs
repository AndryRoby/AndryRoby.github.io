/* Tests for logika.mjs and plan.mjs. Run: node tests-logika.mjs
 * The important one: hints never contradict the solution, on meadows of every
 * size, and hints alone carry an empty board all the way to the finished
 * meadow. */
import { porovnaj, jeVyriesene, napoveda } from './logika.mjs';
import { geometria, indexPolicka } from './generator.mjs';
import {
  zadaniePreDen, zadanieCvicenie, zbal, rozbal, zbalClues, rozbalClues,
  tyzden, denVTyzdni, urovenDna, posunDen, pekneDatum, kratkyDatum, obtiaznost,
  SADY, PRVY_DEN, UROVNE, KANDIDATOV,
} from './plan.mjs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok    ' + name); }
  catch (e) { failed++; console.log('  FAIL  ' + name + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ' + JSON.stringify(a) + ' != ' + JSON.stringify(b)); }

/* An empty board of marks for a puzzle. */
function prazdna(p) { return new Uint8Array(p.n * p.n); }
/* The finished board of marks: water shaded, every island cell dotted. */
function hotova(p) { return Uint8Array.from(p.solution, (x) => (x === 1 ? 1 : 2)); }

/* Plays a meadow with hints only: apply every hint, check it against the
 * solution, stop when the meadow is finished. Returns how many hints were
 * plain reveals (druh 'odhalenie': no rule of any layer found a next step,
 * which should never happen on an accepted puzzle). */
function hrajNapovedami(p) {
  const v = prazdna(p);
  let odhalenia = 0, krokov = 0;
  const vrstvy = { 1: 0, 2: 0, 3: 0 };
  while (!jeVyriesene(v, p.clues, p.n)) {
    const h = napoveda(v, p.clues, p.solution, p.n);
    assert(h, 'no hint on an unfinished meadow');
    assert(h.bunky.length > 0, 'hint without cells: ' + h.druh);
    assert(h.text && h.text.length > 10, 'hint without text');
    assert(typeof h.pravidlo === 'string' && h.pravidlo.length, 'hint without a rule name');
    for (const b of h.bunky) {
      eq(indexPolicka(b.r, b.c, p.n), b.i, 'hint cell address does not match its index');
      assert(v[b.i] === 0, 'hint ' + h.pravidlo + ' touches a cell that is already marked');
      if (b.val === 1) assert(p.solution[b.i] === 1, 'hint ' + h.pravidlo + ' shades a cell the water does not reach');
      if (b.val === 2) assert(p.solution[b.i] === 0, 'hint ' + h.pravidlo + ' claims an island cell the water covers');
      v[b.i] = b.val;
    }
    if (h.druh === 'odhalenie') odhalenia++;
    else if (h.vrstva >= 1 && h.vrstva <= 3) vrstvy[h.vrstva]++;
    if (++krokov > 4000) throw new Error('hints do not converge');
  }
  return { odhalenia, krokov, vrstvy };
}

test('porovnaj counts wrong shading and wrong dots, never untouched cells', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const v = prazdna(p);
  const jeVoda = p.solution.indexOf(1), nieVoda = p.solution.indexOf(0);
  v[jeVoda] = 2; // a dot where the water goes: wrong
  v[nieVoda] = 1; // shading where the meadow stays dry: wrong
  const r = porovnaj(v, p.solution);
  eq(r.zleBodky, [jeVoda]); eq(r.zlaVoda, [nieVoda]); eq(r.voda, 1); eq(r.bodky, 1);
});

test('porovnaj is happy with the finished meadow', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const r = porovnaj(hotova(p), p.solution);
  eq(r.zlaVoda, []); eq(r.zleBodky, []);
  assert(r.voda > 0 && r.bodky > 0);
});

test('jeVyriesene accepts the generated meadow and rejects it one cell short', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const v = hotova(p);
  assert(jeVyriesene(v, p.clues, p.n));
  const i = p.solution.indexOf(1);
  v[i] = 0;
  assert(!jeVyriesene(v, p.clues, p.n), 'one cell of water missing is not finished');
});

test('jeVyriesene treats an untouched cell as dry land: only the shading has to be right', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const v = Uint8Array.from(p.solution, (x) => (x === 1 ? 1 : 0));
  assert(jeVyriesene(v, p.clues, p.n), 'a board with the water shaded and no dots is finished');
});

test('jeVyriesene rejects an empty board and a board with everything shaded', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const C = p.n * p.n;
  assert(!jeVyriesene(new Uint8Array(C), p.clues, p.n), 'an empty board is not finished');
  assert(!jeVyriesene(new Uint8Array(C).fill(1), p.clues, p.n), 'a meadow with no island is not finished');
});

test('jeVyriesene rejects a hand made board with a two by two block of water', () => {
  // 4 x 4, hand-verified. A 1 in each corner leaves the middle four cells and
  // the edges as water, and the middle four make a two by two block.
  const n = 4;
  const clues = new Array(16).fill(null);
  for (const i of [0, 3, 12, 15]) clues[i] = 1;
  const v = new Uint8Array(16).fill(1);
  for (const i of [0, 3, 12, 15]) v[i] = 2;
  assert(!jeVyriesene(v, clues, n), 'a two by two block of water must not count as finished');
});

test('jeVyriesene rejects a board where the water is cut in two', () => {
  // 3 x 3, hand-verified: a 3 down the middle column leaves the left column
  // and the right column as water, and those never touch.
  const n = 3;
  const clues = [null, 3, null, null, null, null, null, null, null];
  const v = Uint8Array.from([1, 2, 1, 1, 2, 1, 1, 2, 1]);
  assert(!jeVyriesene(v, clues, n), 'water in two pieces must not count as finished');
});

test('jeVyriesene rejects an island with the wrong size and one with two numbers', () => {
  const n = 3;
  // hand-verified: a 2 in the middle, but the board leaves it only one cell
  const v1 = Uint8Array.from([1, 1, 1, 1, 2, 1, 1, 1, 1]);
  assert(!jeVyriesene(v1, [null, null, null, null, 2, null, null, null, null], n));
  // hand-verified: two 1s side by side would make one island with two numbers
  const v2 = Uint8Array.from([1, 1, 1, 2, 2, 1, 1, 1, 1]);
  assert(!jeVyriesene(v2, [null, null, null, 1, 1, null, null, null, null], n));
});

test('napoveda points at wrong shading before anything else', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const v = prazdna(p);
  v[p.solution.indexOf(0)] = 1;
  const h = napoveda(v, p.clues, p.solution, p.n);
  eq(h.druh, 'chyba'); eq(h.bunky[0].val, 0); eq(h.pravidlo, 'wrong-water');
});

test('napoveda points at a wrong dot next, once there is no wrong shading', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const v = prazdna(p);
  v[p.solution.indexOf(1)] = 2;
  const h = napoveda(v, p.clues, p.solution, p.n);
  eq(h.druh, 'chyba'); eq(h.bunky[0].val, 1); eq(h.pravidlo, 'wrong-dot');
});

test('napoveda on an empty board names a rule of the easiest layer and explains it', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const h = napoveda(prazdna(p), p.clues, p.solution, p.n);
  eq(h.druh, 'bunka');
  eq(h.vrstva, 1, 'the first step of an accepted puzzle should be a layer 1 rule');
  assert(h.bunky.length >= 1);
  assert(h.text.endsWith('.') && h.text.length > 20, h.text);
});

test('napoveda returns null on a finished meadow', () => {
  const p = zadaniePreDen(PRVY_DEN);
  eq(napoveda(hotova(p), p.clues, p.solution, p.n), null);
});

const DNI = []; for (let k = 0; k < 14; k++) DNI.push(posunDen(PRVY_DEN, k));
const vysledky = [];
test('hints carry an empty board to the finished meadow for 14 consecutive days (all sizes), never contradicting the solution and never needing a plain reveal', () => {
  for (const d of DNI) {
    const p = zadaniePreDen(d);
    const r = hrajNapovedami(p);
    vysledky.push({ d, n: p.n, u: p.uroven, ...r });
    assert(r.odhalenia === 0, d + ' needed a plain reveal, but every accepted meadow should be reachable by the rules alone');
  }
});
test('hints solve the first meadow of every practice set', () => {
  for (const s of SADY) {
    const p = zadanieCvicenie(s.id, 1);
    const r = hrajNapovedami(p);
    vysledky.push({ d: s.id, n: p.n, u: p.uroven, ...r });
    assert(r.odhalenia === 0, s.id + ' needed a plain reveal');
  }
});
test('the daily meadows follow the weekly plan: 6, 6, 8, 8, 10, 10, 12', () => {
  const velkosti = [6, 6, 8, 8, 10, 10, 12];
  for (const d of DNI) {
    const p = zadaniePreDen(d);
    eq(p.n, velkosti[denVTyzdni(d)], d);
    eq(p.uroven, urovenDna(d), d);
    eq(p.n, UROVNE[p.uroven].n, d);
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
test('Challenge leans on trials more than Hard does', () => {
  const pre = (u) => {
    let sum = 0, n = 0;
    for (const d of DNI) { if (urovenDna(d) !== u) continue; sum += zadaniePreDen(d).difficulty.layers[3]; n++; }
    return sum / n;
  };
  const hard = pre('hard'), challenge = pre('challenge');
  assert(challenge > hard, 'challenge ' + challenge + ' should need more layer 3 steps than hard ' + hard);
});
test('the picked candidate is one of the KANDIDATOV made for that day and its difficulty is measured', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = zadaniePreDen(d);
    assert(p.kandidat >= 0 && p.kandidat < KANDIDATOV, 'no candidate index for ' + d);
    assert(Number.isInteger(obtiaznost(p)) && obtiaznost(p) > 0, 'no measurement for ' + d);
    assert(p.difficulty.clues > 0 && p.difficulty.clues < p.n * p.n, 'no room left for the water on ' + d);
  }
});
test('the same date always gives the same puzzle', () => {
  for (const d of DNI.slice(0, 3)) {
    const a = zadaniePreDen(d), b = zadaniePreDen(d);
    eq(a.clues, b.clues, d); eq(a.solution, b.solution, d); eq(a.kandidat, b.kandidat, d);
  }
});
test('zbalClues writes a number of ten or more between bars and reads it back', () => {
  const clues = [null, 3, null, 12, null, 9, null, null, 10];
  eq(rozbalClues(zbalClues(clues), 9), clues);
  eq(zbalClues([null, 3, 12]), '.3|12|');
});
test('zbal and rozbal round-trip and stay reasonably small', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = zadaniePreDen(d);
    const z = zbal(p), r = rozbal(z);
    eq(r.clues, p.clues); eq(r.solution, p.solution); eq(r.n, p.n); eq(r.uroven, p.uroven);
    eq(r.difficulty.layers, p.difficulty.layers);
    assert(JSON.stringify(z).length < 55 * p.n, 'packed day too big for ' + p.n + 'x' + p.n + ': ' + JSON.stringify(z).length + ' bytes');
    assert(jeVyriesene(Uint8Array.from(r.solution, (x) => (x === 1 ? 1 : 2)), r.clues, r.n), 'the unpacked meadow does not finish its own puzzle');
  }
});
test('rozbal refuses a packed puzzle of the wrong shape', () => {
  const z = zbal(zadaniePreDen(PRVY_DEN));
  for (const zly of [{ ...z, c: z.c.slice(1) }, { ...z, s: 5 }, { ...z, s: z.s + '0' }, { ...z, c: z.c + '|3' }]) {
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

console.log('\n  hints per meadow (reveals = no rule found a step, always 0 for an accepted meadow):');
for (const r of vysledky) {
  console.log('  ' + r.d.padEnd(16) + ' n' + String(r.n).padEnd(3) + r.u.padEnd(10) + ' steps ' + String(r.krokov).padStart(3) +
    '  layers ' + r.vrstvy[1] + '/' + r.vrstvy[2] + '/' + r.vrstvy[3] + '  reveals ' + r.odhalenia);
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
