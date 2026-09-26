/* Tests for logika.mjs and plan.mjs. Run: node tests-logika.mjs
 * The important one: hints never contradict the solution, on trees of every
 * size, and hints alone carry an empty tree all the way to the finished one.
 * 14 consecutive days, so every level is played twice. */
import { porovnaj, jeVyriesene, napoveda } from './logika.mjs';
import {
  zadaniePreDen, zadanieCvicenie, zbal, rozbal,
  tyzden, denVTyzdni, urovenDna, posunDen, pekneDatum, kratkyDatum, obtiaznost, vyber,
  SADY, UROVNE, KANDIDATOV,
} from './plan.mjs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok    ' + name); }
  catch (e) { failed++; console.log('  FAIL  ' + name + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ' + JSON.stringify(a) + ' != ' + JSON.stringify(b)); }

const START = '2026-09-14';   // a Monday
const DNI = []; for (let k = 0; k < 14; k++) DNI.push(posunDen(START, k));
const cache = new Map();
const den = (d) => { if (!cache.has(d)) cache.set(d, zadaniePreDen(d)); return cache.get(d); };

/* The empty board of a puzzle: only the owls that came with it. */
function prazdna(p) { return p.givens.map((x) => (x == null ? 0 : x + 1)); }
/* The finished board. */
function hotova(p) { return p.solution.map((x) => x + 1); }
const BEZ_DRUHU = /\b(day|night)\b/i;
let trialov = 0;   // trial hints seen by hrajNapovedami, checked at the end

/* Plays a tree with hints only: apply every hint, check it against the
 * solution, stop when the tree is finished. */
function hrajNapovedami(p) {
  const v = prazdna(p);
  let odhalenia = 0, krokov = 0;
  const vrstvy = [0, 0, 0];
  while (!jeVyriesene(v, p.givens, p.n)) {
    const h = napoveda(v, p.givens, p.solution, p.n);
    assert(h, 'no hint on an unfinished tree');
    assert(h.druh !== 'chyba', 'a wrong owl on a board built from hints only');
    assert(h.bunky.length > 0 && h.bunky.length === h.hodnoty.length, 'hint without cells: ' + h.druh);
    assert(h.text1 && h.text2 && h.text1 !== h.text2, 'hint without two sentences');
    assert(!BEZ_DRUHU.test(h.text1), 'the first press gives the kind away: ' + h.text1);
    assert(h.cislo >= 1 && h.cislo <= p.n, 'hint without a row or column number');
    if (h.druh === 'trial') {
      // the chain Hint numbers on the tree: only empty branches, none twice,
      // never the tried one, one group for every "Step k:" in the sentence
      assert(Array.isArray(h.retaz) && h.retaz.every((x) => x.length > 0), 'a trial hint without its chain');
      const vsetky = h.retaz.flat();
      assert(vsetky.every((i) => v[i] === 0 && i !== h.bunky[0]) && new Set(vsetky).size === vsetky.length, 'a numbered branch that is not empty, or twice');
      eq((h.text2.match(/Step \d+: /g) || []).length, Math.min(h.retaz.length, 6), 'the steps named and numbered differ: ' + h.text2);
      assert(h.sporLinia >= 0 && h.sporLinia < 2 * p.n, 'a trial hint without the line that breaks');
      trialov++;
    }
    for (let j = 0; j < h.bunky.length; j++) {
      const i = h.bunky[j];
      assert(v[i] === 0, 'hint ' + h.druh + ' touches a branch that already has an owl');
      assert(p.givens[i] == null, 'hint ' + h.druh + ' touches a given owl');
      eq(h.hodnoty[j], p.solution[i] + 1, 'hint ' + h.druh + ' puts the wrong owl on ' + i);
      v[i] = h.hodnoty[j];
    }
    if (h.druh === 'odhalenie') odhalenia++;
    else vrstvy[h.vrstva - 1]++;
    if (++krokov > 2000) throw new Error('hints do not converge');
  }
  eq(v, hotova(p), 'hints ended on a different tree');
  return { odhalenia, krokov, vrstvy };
}

test('porovnaj judges only the player\'s owls, never an empty branch or a given owl', () => {
  const p = den(DNI[2]);
  const v = prazdna(p);
  const volne = [];
  for (let i = 0; i < v.length; i++) if (p.givens[i] == null) volne.push(i);
  v[volne[0]] = 2 - p.solution[volne[0]];   // wrong
  v[volne[1]] = p.solution[volne[1]] + 1;   // right
  const r = porovnaj(v, p.solution, p.givens);
  eq(r.sovy, 2); eq(r.zle, [volne[0]]);
  for (const i of r.zle) assert(p.givens[i] == null && v[i] !== 0, 'Check marked an empty branch or a given owl');
  eq(porovnaj(prazdna(p), p.solution, p.givens), { sovy: 0, zle: [] }, 'the owls that came with the tree are never judged');
  eq(porovnaj(hotova(p), p.solution, p.givens).zle, []);
});

test('Check never marks an empty branch or a given owl, over boards full of wrong owls', () => {
  for (const d of DNI) {
    const p = den(d);
    const v = prazdna(p);
    // every second open branch gets the wrong owl
    let k = 0;
    for (let i = 0; i < v.length; i++) if (p.givens[i] == null && k++ % 2 === 0) v[i] = 2 - p.solution[i];
    for (const i of porovnaj(v, p.solution, p.givens).zle) assert(p.givens[i] == null && v[i] !== 0, d);
  }
});

test('jeVyriesene: true on the solution, false one owl short, false with a given changed', () => {
  const p = den(DNI[0]);
  assert(jeVyriesene(hotova(p), p.givens, p.n));
  const v = hotova(p);
  v[p.givens.findIndex((x) => x == null)] = 0;
  assert(!jeVyriesene(v, p.givens, p.n), 'one empty branch is not finished');
  assert(!jeVyriesene(prazdna(p), p.givens, p.n), 'the empty tree is not finished');
  // the same board with every owl flipped keeps rules 1, 2 and 3, but not the givens
  const obratena = p.solution.map((x) => 2 - x);
  assert(!jeVyriesene(obratena, p.givens, p.n), 'a board that changes a given owl is not the tree');
  assert(jeVyriesene(obratena, new Array(p.n * p.n).fill(null), p.n), 'without givens the flipped tree keeps every rule');
});

test('jeVyriesene refuses hand made boards that break each rule, the twin rule included', () => {
  const n = 4, bez = new Array(16).fill(null);
  const zRiadkov = (rs) => rs.flatMap((r) => Array.from(r, (ch) => (ch === '1' ? 2 : 1)));
  assert(jeVyriesene(zRiadkov(['0101', '1010', '0110', '1001']), bez, n), 'a good 4 x 4');
  assert(!jeVyriesene(zRiadkov(['0011', '0011', '1100', '1100']), bez, n), 'twin rows and columns');
  assert(!jeVyriesene(zRiadkov(['0111', '1000', '0110', '1001']), bez, n), 'rows out of balance');
  assert(!jeVyriesene(zRiadkov(['1110', '0001', '1010', '0101']), bez, n), 'three alike side by side');
  // 6 x 6, hand verified: balanced, no three alike, but rows 1 and 4 are twins
  const twin6 = ['001011', '110100', '010011', '001011', '110100', '101100'];
  assert(!jeVyriesene(zRiadkov(twin6), new Array(36).fill(null), 6), 'twin rows on a 6 x 6');
});

test('napoveda points at a wrong owl before anything else, first in its row, then takes it off', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = den(d);
    const v = prazdna(p);
    const volne = [];
    for (let i = 0; i < v.length; i++) if (p.givens[i] == null) volne.push(i);
    const zla = volne[volne.length - 1];
    v[zla] = 2 - p.solution[zla];
    v[volne[0]] = p.solution[volne[0]] + 1;
    const h = napoveda(v, p.givens, p.solution, p.n);
    eq(h.druh, 'chyba', d); eq(h.bunky, [zla], d); eq(h.hodnoty, [0], d);
    eq(h.cislo, Math.floor(zla / p.n) + 1, d);
    assert(/^There is an owl in row \d+ that the finished tree does not have\./.test(h.text1), h.text1);
    assert(!BEZ_DRUHU.test(h.text1));
  }
});

test('napoveda on the empty tree is a layer 1 step with two sentences, and null on the finished tree', () => {
  for (const d of DNI) {
    const p = den(d);
    const h = napoveda(prazdna(p), p.givens, p.solution, p.n);
    eq(h.vrstva, 1, d);
    assert(['pair', 'gap', 'full'].includes(h.druh), d + ' ' + h.druh);
    assert(h.text2.length > h.text1.length - 20 && /\.$/.test(h.text2), h.text2);
    eq(napoveda(hotova(p), p.givens, p.solution, p.n), null, d);
  }
});

const vysledky = [];
test('hints alone carry the empty tree to the finished one for 14 days (all sizes), never contradicting it', () => {
  for (const d of DNI) {
    const p = den(d);
    const r = hrajNapovedami(p);
    vysledky.push({ d, n: p.n, u: p.uroven, ...r });
    eq(r.odhalenia, 0, d + ' needed a plain reveal');
  }
  // the two Sundays in the fortnight bring trial hints with a numbered chain
  assert(trialov > 0, 'no trial hint in 14 days, so the chain was never checked');
});
test('hints solve the first tree of every practice set', () => {
  for (const s of SADY) {
    const p = zadanieCvicenie(s.id, 1);
    const r = hrajNapovedami(p);
    vysledky.push({ d: s.id, n: p.n, u: p.uroven, ...r });
    eq(r.odhalenia, 0, s.id);
  }
});
test('hints from a half finished board, where the player got there in their own order, still agree with the tree', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = den(d);
    const v = prazdna(p);
    // every third open branch filled correctly, out of any solver order
    let k = 0;
    for (let i = 0; i < v.length; i++) if (p.givens[i] == null && k++ % 3 === 0) v[i] = p.solution[i] + 1;
    for (let krok = 0; krok < 400 && !jeVyriesene(v, p.givens, p.n); krok++) {
      const h = napoveda(v, p.givens, p.solution, p.n);
      h.bunky.forEach((i, j) => { eq(h.hodnoty[j], p.solution[i] + 1, d + ' ' + h.druh); v[i] = h.hodnoty[j]; });
    }
    assert(jeVyriesene(v, p.givens, p.n), d + ' not finished');
  }
});

test('the daily trees follow the weekly plan: 6, 6, 8, 8, 10, 10, 12', () => {
  const velkosti = [6, 6, 8, 8, 10, 10, 12];
  for (const d of DNI) {
    const p = den(d);
    eq(p.n, velkosti[denVTyzdni(d)], d);
    eq(p.uroven, urovenDna(d), d);
    eq(p.n, UROVNE[p.uroven].n, d);
  }
});
test('Easy uses layer 1 only, Medium and Hard never ask for a trial', () => {
  for (const d of DNI) {
    const p = den(d), l = p.difficulty.layers;
    if (p.uroven === 'easy') eq([l[1], l[2]], [0, 0], d);
    if (p.uroven === 'medium' || p.uroven === 'hard') eq(l[2], 0, d);
  }
});
test('the picked candidate is one of the KANDIDATOV made for the day, at its rank', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = den(d);
    assert(p.kandidat >= 0 && p.kandidat < KANDIDATOV, 'no candidate index for ' + d);
    assert(Number.isInteger(obtiaznost(p)) && obtiaznost(p) > 0, 'no measurement for ' + d);
  }
  // vyber: the rank inside a sorted pool, stable on ties
  const falosne = (k) => ({ difficulty: { layers: [[5, 1, 9, 2, 7, 3][k], 0, 0] } });
  // sorted: 1 (k1), 2 (k3), 3 (k5), 5 (k0), 7 (k4), 9 (k2)
  eq(vyber('easy', falosne).kandidat, 1);
  eq(vyber('medium', falosne).kandidat, 5);
  eq(vyber('hard', falosne).kandidat, 4);
  eq(vyber('challenge', falosne).kandidat, 2);
  eq(obtiaznost({ difficulty: { layers: [120, 3, 1] } }), 1003120);
});
test('the same date always gives the same tree', () => {
  for (const d of DNI.slice(0, 3)) {
    const a = den(d), b = zadaniePreDen(d);
    eq(a.givens, b.givens, d); eq(a.solution, b.solution, d); eq(a.kandidat, b.kandidat, d);
  }
});
test('zbal and rozbal round-trip and stay small', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = den(d);
    const z = zbal(p), r = rozbal(z);
    eq(r.givens, p.givens); eq(r.solution, p.solution); eq(r.n, p.n); eq(r.uroven, p.uroven);
    eq(r.difficulty.layers, p.difficulty.layers);
    eq(r.difficulty.givens, p.difficulty.givens);
    assert(JSON.stringify(z).length < 2 * p.n * p.n + 80, 'packed day too big: ' + JSON.stringify(z).length);
    assert(jeVyriesene(r.solution.map((x) => x + 1), r.givens, r.n), 'the unpacked tree does not finish its own puzzle');
  }
});
test('dates: tyzden, denVTyzdni, pekneDatum, kratkyDatum, posunDen', () => {
  eq(tyzden('2026-09-10'), ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']);
  eq(denVTyzdni('2026-09-14'), 0);
  eq(pekneDatum('2026-09-10'), 'Thursday 10 September 2026');
  eq(kratkyDatum('2026-09-25'), '25 Sep');
  eq(posunDen('2026-02-28', 1), '2026-03-01');
});

console.log('\n  hints per tree (reveals = no rule found a step, always 0 for an accepted tree):');
for (const r of vysledky) {
  console.log('  ' + r.d.padEnd(12) + ' n' + String(r.n).padEnd(3) + r.u.padEnd(10) + ' steps ' + String(r.krokov).padStart(3)
    + '  layers ' + r.vrstvy.join('/') + '  reveals ' + r.odhalenia);
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
