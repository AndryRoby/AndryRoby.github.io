/* Tests for logika.mjs and plan.mjs. Run: node tests-logika.mjs
 * The important one: hints never contradict the solution, on 40 gardens of
 * every size, from the empty board to the solved one. */
import { konflikty, jeVyriesene, porovnaj, napoveda, jednotky } from './logika.mjs';
import { zadaniePreDen, zadanieCvicenie, zbal, rozbal, tyzden, denVTyzdni, urovenDna, posunDen, pekneDatum, SADY, PRVY_ZIVY_DEN, UROVNE, KANDIDATOV } from './plan.mjs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok    ' + name); }
  catch (e) { failed++; console.log('  FAIL  ' + name + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ' + JSON.stringify(a) + ' != ' + JSON.stringify(b)); }

/* Plays a garden with hints only: apply every hint, check it against the
 * solution, stop when solved. Returns how many hints were plain reveals. */
function hrajNapovedami(p) {
  const n = p.n, v = new Array(n * n).fill(0);
  let odhalenia = 0, krokov = 0;
  while (!jeVyriesene(v, p.regions, p.stars)) {
    const h = napoveda(v, p.regions, p.stars, p.solution);
    assert(h, 'no hint on an unsolved board');
    assert(h.bunky.length > 0, 'hint without cells: ' + h.druh);
    assert(h.text && h.text.length > 10, 'hint without text');
    for (const i of h.bunky) {
      assert(v[i] === 0, 'hint ' + h.druh + ' marks a cell that is already marked');
      if (h.hodnota === 2) assert(p.solution[i] === 1, 'hint ' + h.druh + ' puts a hedgehog on an empty cell of the solution');
      if (h.hodnota === 1) assert(p.solution[i] !== 1, 'hint ' + h.druh + ' puts a dot on a hedgehog of the solution');
      v[i] = h.hodnota;
    }
    if (h.druh === 'odhalenie') odhalenia++;
    if (++krokov > 2000) throw new Error('hints do not converge');
  }
  return { odhalenia, krokov };
}

test('konflikty: touching hedgehogs and a full row are flagged, dots are not', () => {
  const regions = [[0, 0, 1, 1], [0, 0, 1, 1], [2, 2, 3, 3], [2, 2, 3, 3]];
  const v = new Array(16).fill(0);
  v[0] = 2; v[1] = 2; v[6] = 1;
  const k = konflikty(v, regions, 1);
  eq(k.hedgehogs, 2); assert(k.zle.has(0) && k.zle.has(1) && !k.zle.has(6));
});

test('jeVyriesene accepts the generated solution and rejects one hedgehog short', () => {
  const p = zadaniePreDen('2026-09-10');
  const v = p.solution.map((x) => (x ? 2 : 0));
  assert(jeVyriesene(v, p.regions, p.stars));
  const i = v.indexOf(2); v[i] = 0;
  assert(!jeVyriesene(v, p.regions, p.stars));
});

test('porovnaj counts wrong hedgehogs and wrong dots, never empty cells', () => {
  const p = zadaniePreDen('2026-09-10');
  const v = new Array(p.n * p.n).fill(0);
  const first = p.solution.indexOf(1), empty = p.solution.indexOf(0);
  v[first] = 1; v[empty] = 2;
  const r = porovnaj(v, p.solution);
  eq(r.zleBodky, [first]); eq(r.zleJezky, [empty]); eq(r.hedgehogs, 1); eq(r.dots, 1);
});

test('napoveda points at a wrong hedgehog before anything else', () => {
  const p = zadaniePreDen('2026-09-10');
  const v = new Array(p.n * p.n).fill(0);
  v[p.solution.indexOf(0)] = 2;
  const h = napoveda(v, p.regions, p.stars, p.solution);
  eq(h.druh, 'chyba'); eq(h.hodnota, 0);
});

test('napoveda after a right hedgehog: its neighbours stay empty', () => {
  const p = zadaniePreDen('2026-09-10');
  const v = new Array(p.n * p.n).fill(0);
  v[p.solution.indexOf(1)] = 2;
  const h = napoveda(v, p.regions, p.stars, p.solution);
  eq(h.druh, 'susedia'); eq(h.hodnota, 1); assert(h.bunky.length >= 3);
});

test('napoveda returns null on a solved board', () => {
  const p = zadaniePreDen('2026-09-10');
  eq(napoveda(p.solution.map((x) => (x ? 2 : 0)), p.regions, p.stars, p.solution), null);
});

test('jednotky: n rows, n columns, n flowerbeds, every cell once per kind', () => {
  const p = zadaniePreDen('2026-09-10');
  const j = jednotky(p.regions);
  eq(j.length, 3 * p.n);
  for (const druh of ['row', 'column', 'flowerbed']) {
    const cells = j.filter((x) => x.druh === druh).flatMap((x) => x.bunky).sort((a, b) => a - b);
    eq(cells.length, p.n * p.n); eq(cells[cells.length - 1], p.n * p.n - 1);
  }
});

const DNI = []; for (let k = 0; k < 28; k++) DNI.push(posunDen(PRVY_ZIVY_DEN, k));
const vysledky = [];
test('hints solve 28 consecutive gardens (all sizes) without ever contradicting the solution', () => {
  for (const d of DNI) {
    const p = zadaniePreDen(d);
    const r = hrajNapovedami(p);
    vysledky.push({ d, n: p.n, u: p.uroven, ...r });
  }
});
test('hints solve the first garden of every practice set', () => {
  for (const s of SADY) {
    const p = zadanieCvicenie(s.id, 1);
    const r = hrajNapovedami(p);
    vysledky.push({ d: s.id, n: p.n, u: p.uroven, ...r });
  }
});
test('the daily gardens on the days of the week follow the plan 8, 9, 10, 10', () => {
  for (const d of DNI) {
    const p = zadaniePreDen(d);
    const dz = denVTyzdni(d);
    eq(p.n, dz <= 1 ? 8 : dz <= 3 ? 9 : 10, d);
    eq(p.uroven, urovenDna(d), d);
    eq(p.stars, 2);
  }
});
test('the picked garden sits in the reveal band of its level (or is the closest candidate)', () => {
  for (const d of DNI.slice(0, 14)) {
    const p = zadaniePreDen(d);
    const band = UROVNE[p.uroven].reveals;
    assert(typeof p.reveals === 'number' && p.kandidat >= 0 && p.kandidat < KANDIDATOV, 'no measurement for ' + d);
    if (band && p.kandidat < KANDIDATOV - 1) assert(p.reveals >= band[0] && p.reveals <= band[1], d + ' reveals ' + p.reveals + ' outside ' + band);
  }
  const p = zadaniePreDen('2026-09-10');
  eq(p.n, 9); eq(p.uroven, 'medium');
});
test('zbal and rozbal round-trip and stay small', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = zadaniePreDen(d);
    const z = zbal(p), r = rozbal(z);
    eq(r.regions, p.regions); eq(r.solution, p.solution); eq(r.n, p.n);
    assert(JSON.stringify(z).length < 300, 'packed day over 300 bytes');
  }
});
test('tyzden gives Monday to Sunday around the date', () => {
  eq(tyzden('2026-09-10'), ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']);
  eq(tyzden('2026-09-13')[6], '2026-09-13');
  eq(tyzden('2026-09-14')[0], '2026-09-14');
  eq(denVTyzdni('2026-09-14'), 0);
  eq(pekneDatum('2026-09-10'), 'Thursday 10 September 2026');
});

console.log('\n  hints per garden (odhalenia = plain reveals, the fewer the better):');
for (const r of vysledky) console.log('  ' + r.d.padEnd(16) + ' n' + r.n + ' ' + r.u.padEnd(9) + ' steps ' + String(r.krokov).padStart(3) + '  reveals ' + r.odhalenia);
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
