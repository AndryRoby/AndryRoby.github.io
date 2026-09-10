/* Tests for logika.mjs and plan.mjs. Run: node tests-logika.mjs
 * The important one: hints never contradict the solution, on lakes of every
 * size, and hints alone carry an empty board all the way to the finished
 * loop. */
import { porovnaj, jeVyriesene, napoveda } from './logika.mjs';
import { geometria, indexHrany, pearlsFromLoop } from './generator.mjs';
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

/* An empty board of marks for a puzzle. */
function prazdna(p) { return new Uint8Array(geometria(p.n).E); }
/* The solution as one flat 0/1 array in the same order as the marks. */
function ploche(p) {
  const g = geometria(p.n), out = new Uint8Array(g.E);
  for (let i = 0; i < g.H; i++) out[i] = p.solution.h[i];
  for (let i = 0; i < g.E - g.H; i++) out[g.V0 + i] = p.solution.v[i];
  return out;
}

/* Plays a puzzle with hints only: apply every hint, check it against the
 * solution, stop when the loop is finished. Returns how many hints were
 * plain reveals (druh 'odhalenie': no rule of any layer found a next step,
 * which should never happen on an accepted puzzle). */
function hrajNapovedami(p) {
  const v = prazdna(p), sol = ploche(p);
  let odhalenia = 0, krokov = 0;
  const vrstvy = { 1: 0, 2: 0, 3: 0 };
  while (!jeVyriesene(v, p.pearls, p.n)) {
    const h = napoveda(v, p.pearls, p.solution, p.n);
    assert(h, 'no hint on an unfinished loop');
    assert(h.hrany.length > 0, 'hint without any step: ' + h.druh);
    assert(h.text && h.text.length > 10, 'hint without text');
    assert(!/[–—]/.test(h.text), 'a dash slipped into a hint: ' + h.text);
    assert(typeof h.pravidlo === 'string' && h.pravidlo.length, 'hint without a rule name');
    for (const e of h.hrany) {
      eq(indexHrany(e.typ, e.r, e.c, p.n), e.i, 'hint step index does not match its address');
      assert(v[e.i] === 0, 'hint ' + h.pravidlo + ' touches a step that is already marked');
      if (e.val === 1) assert(sol[e.i] === 1, 'hint ' + h.pravidlo + ' draws a line the loop does not use');
      if (e.val === 2) assert(sol[e.i] !== 1, 'hint ' + h.pravidlo + ' crosses a step the loop uses');
      v[e.i] = e.val;
    }
    if (h.druh === 'odhalenie') odhalenia++;
    else if (h.vrstva >= 1 && h.vrstva <= 3) vrstvy[h.vrstva]++;
    if (++krokov > 4000) throw new Error('hints do not converge');
  }
  return { odhalenia, krokov, vrstvy };
}

test('porovnaj counts wrong lines and wrong crosses, never untouched steps', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const v = prazdna(p), sol = ploche(p);
  const jeCiara = sol.indexOf(1), nieCiara = sol.indexOf(0);
  v[jeCiara] = 2; // a cross where the loop runs: wrong
  v[nieCiara] = 1; // a line where it does not: wrong
  const r = porovnaj(v, p.solution);
  eq(r.zleKrizky, [jeCiara]); eq(r.zleCiary, [nieCiara]); eq(r.ciary, 1); eq(r.krizky, 1);
});

test('porovnaj is happy with the finished loop', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const r = porovnaj(ploche(p), p.solution);
  eq(r.zleCiary, []); eq(r.zleKrizky, []);
  assert(r.ciary > 0);
});

test('jeVyriesene accepts the generated loop and rejects it one step short', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const v = ploche(p);
  assert(jeVyriesene(v, p.pearls, p.n));
  const i = v.indexOf(1); v[i] = 0;
  assert(!jeVyriesene(v, p.pearls, p.n));
});

test('jeVyriesene ignores crosses: crossing every step the loop skips still finishes it', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const sol = ploche(p);
  const v = Uint8Array.from(sol, (x) => (x === 1 ? 1 : 2));
  assert(jeVyriesene(v, p.pearls, p.n));
});

test('jeVyriesene rejects two separate loops even when every swan looks happy', () => {
  // Hand-verified 4 x 4: the square through the four top left cells and
  // another through the four bottom right ones. Every cell of both squares
  // turns, so neither square can carry a swan; put no swans on the board and
  // the only thing wrong is that these are two loops, not one.
  const n = 4, g = geometria(n), v = new Uint8Array(g.E);
  for (const [t, r, c] of [['h', 0, 0], ['h', 1, 0], ['v', 0, 0], ['v', 0, 1],
    ['h', 2, 2], ['h', 3, 2], ['v', 2, 2], ['v', 2, 3]]) v[indexHrany(t, r, c, n)] = 1;
  const pearls = new Array(16).fill(0);
  assert(!jeVyriesene(v, pearls, n), 'two loops must not count as solved');
});

test('jeVyriesene rejects a branch: three lines out of one cell', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const g = geometria(p.n), v = ploche(p);
  for (let i = 0; i < g.C; i++) {
    let L = 0, volna = -1;
    for (let d = 0; d < 4; d++) { const e = g.cellEdges[(i << 2) + d]; if (e < 0) continue; if (v[e] === 1) L++; else volna = e; }
    if (L === 2 && volna >= 0) { v[volna] = 1; break; }
  }
  assert(!jeVyriesene(v, p.pearls, p.n), 'a branch must not count as solved');
});

test('jeVyriesene rejects a loop that goes straight through a black swan', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const v = ploche(p);
  // move a black swan onto a cell where the loop runs straight
  const plne = pearlsFromLoop(p.solution, p.n);
  const rovne = plne.indexOf(1);
  assert(rovne >= 0, 'no straight cell on this loop');
  const pearls = p.pearls.slice();
  pearls[rovne] = 2;
  assert(!jeVyriesene(v, pearls, p.n), 'a black swan on a straight run must not count as solved');
});

test('napoveda points at a wrong line before anything else', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const v = prazdna(p);
  v[ploche(p).indexOf(0)] = 1;
  const h = napoveda(v, p.pearls, p.solution, p.n);
  eq(h.druh, 'chyba'); eq(h.hrany[0].val, 0); eq(h.pravidlo, 'wrong-line');
});

test('napoveda points at a wrong cross next, once there is no wrong line', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const v = prazdna(p);
  v[ploche(p).indexOf(1)] = 2;
  const h = napoveda(v, p.pearls, p.solution, p.n);
  eq(h.druh, 'chyba'); eq(h.hrany[0].val, 1); eq(h.pravidlo, 'wrong-cross');
});

test('napoveda on an empty board names a rule of the easiest layer and explains it', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const h = napoveda(prazdna(p), p.pearls, p.solution, p.n);
  eq(h.druh, 'hrana');
  eq(h.vrstva, 1, 'the first step of an accepted puzzle should be a layer 1 rule');
  assert(h.hrany.length >= 1);
  assert(h.text.endsWith('.') && h.text.length > 20, h.text);
});

test('napoveda returns null on a finished loop', () => {
  const p = zadaniePreDen(PRVY_DEN);
  eq(napoveda(ploche(p), p.pearls, p.solution, p.n), null);
});

const DNI = []; for (let k = 0; k < 14; k++) DNI.push(posunDen(PRVY_DEN, k));
const vysledky = [];
test('hints carry an empty board to the finished loop for 14 consecutive days (all sizes), never contradicting the solution and never needing a plain reveal', () => {
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
test('the daily lakes follow the weekly plan: 6, 6, 7, 7, 8, 8, 10', () => {
  const velkosti = [6, 6, 7, 7, 8, 8, 10];
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
test('Challenge leans on layer 3 more than Hard does', () => {
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
    assert(p.difficulty.pearls > 0 && p.difficulty.pearls < p.n * p.n, 'no swans taken away on ' + d);
  }
});
test('the same date always gives the same puzzle', () => {
  for (const d of DNI.slice(0, 3)) {
    const a = zadaniePreDen(d), b = zadaniePreDen(d);
    eq(a.pearls, b.pearls, d); eq(a.solution, b.solution, d); eq(a.kandidat, b.kandidat, d);
  }
});
test('zbal and rozbal round-trip and stay reasonably small', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = zadaniePreDen(d);
    const z = zbal(p), r = rozbal(z);
    eq(r.pearls, p.pearls); eq(r.solution, p.solution); eq(r.n, p.n); eq(r.uroven, p.uroven);
    eq(r.difficulty.layers, p.difficulty.layers);
    assert(JSON.stringify(z).length < 55 * p.n, 'packed day too big for ' + p.n + 'x' + p.n + ': ' + JSON.stringify(z).length + ' bytes');
    assert(jeVyriesene(ploche(r), r.pearls, r.n), 'the unpacked loop does not finish its own puzzle');
  }
});
test('rozbal refuses a packed puzzle of the wrong shape', () => {
  const z = zbal(zadaniePreDen(PRVY_DEN));
  for (const zly of [{ ...z, p: z.p.slice(1) }, { ...z, h: 5 }, { ...z, v: z.v + '0' }, { ...z, p: '3' + z.p.slice(1) }]) {
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
  console.log('  ' + r.d.padEnd(16) + ' n' + r.n + ' ' + r.u.padEnd(10) + ' steps ' + String(r.krokov).padStart(3) +
    '  layers ' + r.vrstvy[1] + '/' + r.vrstvy[2] + '/' + r.vrstvy[3] + '  reveals ' + r.odhalenia);
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
