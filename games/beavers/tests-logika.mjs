/* Tests for logika.mjs and plan.mjs. Run: node tests-logika.mjs
 * The important one: hints never contradict the solution, on ponds of every
 * size, and hints alone carry an empty pond all the way to the finished one. */
import { porovnaj, jeVyriesene, cislaSedia, napoveda, autoTrava } from './logika.mjs';
import { poloha, mulberry32, seedFromString, dotyk8 } from './generator.mjs';
import {
  zadaniePreDen, zadanieCvicenie, zbal, rozbal,
  tyzden, denVTyzdni, urovenDna, posunDen, pekneDatum, kratkyDatum, obtiaznost,
  SADY, PRVY_DEN, UROVNE, KANDIDATOV, NAVYSE,
} from './plan.mjs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok    ' + name); }
  catch (e) { failed++; console.log('  FAIL  ' + name + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ' + JSON.stringify(a) + ' != ' + JSON.stringify(b)); }

const zad = (p) => ({ n: p.n, trees: p.trees, rows: p.rows, cols: p.cols });
function prazdna(p) { return new Array(p.n * p.n).fill(0); }
function stromy(p) { const s = new Uint8Array(p.n * p.n); for (const t of p.trees) s[t] = 1; return s; }
/* The finished board: every lodge placed, every other cell grass. */
function hotova(p) { const s = stromy(p); return p.solution.map((x, i) => (s[i] ? 0 : x === 1 ? 1 : 2)); }
/* Only the lodges, no grass at all. */
function lenHrady(p) { return p.solution.map((x) => (x === 1 ? 1 : 0)); }

/* Plays a pond with hints only: apply every hint, check it against the
 * solution, stop when the pond is solved. Returns how many hints were plain
 * reveals (no rule found a step, which should never happen on an accepted
 * pond) and how many came from each layer. */
function hrajNapovedami(p) {
  const v = prazdna(p);
  const s = stromy(p);
  let odhalenia = 0, krokov = 0;
  const vrstvy = { 1: 0, 2: 0, 3: 0 };
  while (!jeVyriesene(v, zad(p))) {
    const h = napoveda(v, zad(p), p.solution);
    assert(h, 'no hint on an unfinished pond');
    assert(h.bunky.length > 0, 'a hint without cells: ' + h.druh);
    assert(h.kde && h.kde.length > 10 && h.text && h.text.length > 10, 'a hint without its two sentences');
    for (const i of h.bunky) {
      assert(!s[i], 'a hint on a tree');
      assert(v[i] === 0, 'hint ' + h.druh + ' touches a cell that is already marked');
      if (h.hodnota === 1) assert(p.solution[i] === 1, 'hint ' + h.druh + ' puts a lodge where the pond has none');
      if (h.hodnota === 2) assert(p.solution[i] === 0, 'hint ' + h.druh + ' puts grass on a lodge of the pond');
      v[i] = h.hodnota;
    }
    if (h.druh === 'odhalenie') odhalenia++;
    else if (h.vrstva >= 1 && h.vrstva <= 3) vrstvy[h.vrstva]++;
    if (++krokov > 2000) throw new Error('hints do not converge');
  }
  return { odhalenia, krokov, vrstvy };
}

const P0 = zadaniePreDen(PRVY_DEN);

test('porovnaj counts wrong lodges and wrong grass, never an empty cell', () => {
  const p = P0;
  const v = prazdna(p);
  const s = stromy(p);
  const hrad = p.solution.indexOf(1);
  let nie = -1;
  for (let i = 0; i < p.n * p.n; i++) if (!s[i] && p.solution[i] === 0) { nie = i; break; }
  v[hrad] = 2; // grass on a lodge: wrong
  v[nie] = 1;  // a lodge where there is none: wrong
  const r = porovnaj(v, p.solution);
  eq(r.zlaTrava, [hrad]); eq(r.zleHrady, [nie]); eq(r.hrady, 1); eq(r.trava, 1);
  const prazdne = porovnaj(prazdna(p), p.solution);
  eq(prazdne.zleHrady.length + prazdne.zlaTrava.length, 0, 'an empty board has no mistakes');
});

test('porovnaj is happy with the finished pond', () => {
  const r = porovnaj(hotova(P0), P0.solution);
  eq(r.zleHrady, []); eq(r.zlaTrava, []);
  assert(r.hrady === P0.trees.length && r.trava > 0);
});

test('jeVyriesene is true on the solution with grass and without it', () => {
  assert(jeVyriesene(hotova(P0), zad(P0)));
  assert(jeVyriesene(lenHrady(P0), zad(P0)));
  assert(cislaSedia(lenHrady(P0), zad(P0)));
});

test('jeVyriesene is false with one lodge missing', () => {
  const v = lenHrady(P0);
  v[P0.solution.indexOf(1)] = 0;
  assert(!jeVyriesene(v, zad(P0)));
});

test('jeVyriesene is false with two lodges touching, even when the numbers happen to fit', () => {
  // hand made 4 x 4 (verified on paper): trees in row 1, column 2 and row 4,
  // column 3; a lodge right below the first tree (row 2, column 2) and one
  // right above the second (row 3, column 3) sit corner to corner. The
  // numbers are taken from that board, so they fit, and each tree has its own.
  const n = 4;
  const z = { n, trees: [1, 14], rows: [0, 1, 1, 0], cols: [0, 1, 1, 0] };
  const v = new Array(16).fill(0);
  v[5] = 1; v[10] = 1;
  assert(cislaSedia(v, z), 'the numbers fit');
  assert(!jeVyriesene(v, z), 'lodges touching corner to corner must not count as solved');
  // and on the daily pond: a lodge moved next to another one
  const w = lenHrady(P0);
  const h = P0.solution.indexOf(1);
  const s = stromy(P0);
  const soused = dotyk8(h, P0.n).find((y) => !s[y] && !w[y]);
  w[soused] = 1;
  assert(!jeVyriesene(w, zad(P0)));
});

test('jeVyriesene refuses the shared lodge: numbers and no touching hold, one tree has no lodge of its own', () => {
  // the hand built 5 x 5 from tests.mjs
  const z = { n: 5, trees: [0, 2, 17], rows: [1, 0, 0, 2, 0], cols: [0, 2, 0, 1, 0] };
  const v = new Array(25).fill(0);
  for (const h of [1, 16, 18]) v[h] = 1;
  assert(cislaSedia(v, z), 'the numbers do fit');
  assert(!jeVyriesene(v, z), 'but it is not solved');
});

test('napoveda points at a wrong lodge before anything else', () => {
  const v = prazdna(P0);
  const s = stromy(P0);
  let nie = -1;
  for (let i = 0; i < v.length; i++) if (!s[i] && P0.solution[i] === 0) { nie = i; break; }
  v[nie] = 1;
  const h = napoveda(v, zad(P0), P0.solution);
  eq(h.druh, 'chyba'); eq(h.bunky, [nie]); eq(h.hodnota, 0); eq(h.pravidlo, 'wrong-lodge');
  assert(h.kde.includes(poloha(nie, P0.n)), 'the first sentence names the place of the mistake');
});

test('napoveda points at wrong grass the same way', () => {
  const v = prazdna(P0);
  const h0 = P0.solution.indexOf(1);
  v[h0] = 2;
  const h = napoveda(v, zad(P0), P0.solution);
  eq(h.druh, 'chyba'); eq(h.bunky, [h0]); eq(h.hodnota, 1); eq(h.pravidlo, 'wrong-grass');
});

test('napoveda on an empty pond names a layer 1 rule that is real reasoning, not the tidy up', () => {
  const h = napoveda(prazdna(P0), zad(P0), P0.solution);
  eq(h.vrstva, 1);
  assert(h.druh !== 'no-tree', 'the first hint of an accepted pond is ' + h.druh);
  assert(h.text.endsWith('.') && h.kde.endsWith('.'));
});

test('napoveda returns null on a finished pond, grass or no grass', () => {
  eq(napoveda(hotova(P0), zad(P0), P0.solution), null);
  eq(napoveda(lenHrady(P0), zad(P0), P0.solution), null);
});

const DNI = []; for (let k = 0; k < 14; k++) DNI.push(posunDen('2026-09-14', k));
const vysledky = [];
test('hints carry an empty pond to the finished one for 14 consecutive days (all sizes), never contradicting the solution, never a plain reveal', () => {
  for (const d of DNI) {
    const p = zadaniePreDen(d);
    const r = hrajNapovedami(p);
    vysledky.push({ d, n: p.n, u: p.uroven, ...r });
    assert(r.odhalenia === 0, d + ' needed a plain reveal');
  }
});
test('hints solve the first pond of every practice set', () => {
  for (const s of SADY) {
    const p = zadanieCvicenie(s.id, 1);
    const r = hrajNapovedami(p);
    vysledky.push({ d: s.id, n: p.n, u: p.uroven, ...r });
    assert(r.odhalenia === 0, s.id + ' needed a plain reveal');
  }
});

test('over a board with one wrong mark among right ones the hint shows the wrong mark first', () => {
  const rng = mulberry32(seedFromString('zla-znacka'));
  for (const d of DNI.slice(0, 7)) {
    const p = zadaniePreDen(d);
    const s = stromy(p);
    const v = prazdna(p);
    for (let i = 0; i < v.length; i++) if (!s[i] && rng() < 0.4) v[i] = p.solution[i] === 1 ? 1 : 2;
    let zla = -1;
    for (let i = 0; i < v.length; i++) if (!s[i] && v[i] === 0) { zla = i; break; }
    v[zla] = p.solution[zla] === 1 ? 2 : 1;
    const h = napoveda(v, zad(p), p.solution);
    eq(h.druh, 'chyba', d);
    eq(h.bunky, [zla], d);
  }
});

test('autoTrava over right marks never puts grass on a lodge of the pond and never overwrites a mark', () => {
  const rng = mulberry32(seedFromString('auto-trava'));
  let doplnenych = 0;
  for (const d of DNI) {
    const p = zadaniePreDen(d);
    const s = stromy(p);
    const hrady = [];
    for (let i = 0; i < p.solution.length; i++) if (p.solution[i] === 1) hrady.push(i);
    const v = prazdna(p);
    for (let i = 0; i < v.length; i++) if (!s[i] && p.solution[i] === 0 && rng() < 0.2) v[i] = 2;
    for (const h of hrady) {
      if (rng() < 0.3) continue;
      v[h] = 1;
      const pred = v.slice();
      const doplnit = autoTrava(v, zad(p), h);
      for (const i of doplnit) {
        assert(pred[i] === 0, 'auto grass over a mark at ' + i);
        assert(!s[i], 'auto grass on a tree');
        assert(p.solution[i] === 0, d + ': auto grass on a lodge of the pond at ' + i);
        v[i] = 2;
        doplnenych++;
      }
    }
    eq(autoTrava(v, zad(p), p.trees[0]), [], 'nothing for a cell that is not a lodge');
  }
  assert(doplnenych > 100, 'auto grass filled in only ' + doplnenych + ' cells');
});

test('each kde keeps the target cell to itself where it would give it away (lone-tree, line-room), and no sentence has a dash', () => {
  const videne = {};
  for (const d of DNI) {
    const p = zadaniePreDen(d);
    const v = prazdna(p);
    for (let k = 0; k < 400 && !jeVyriesene(v, zad(p)); k++) {
      const h = napoveda(v, zad(p), p.solution);
      videne[h.druh] = (videne[h.druh] || 0) + 1;
      assert(!new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']').test(h.kde + h.text), 'a dash in ' + h.druh);
      if (h.druh === 'lone-tree' || h.druh === 'line-room') {
        for (const i of h.bunky) assert(!h.kde.includes(poloha(i, p.n)), h.druh + ' gives the cell away: ' + h.kde);
      }
      for (const i of h.bunky) v[i] = h.hodnota;
    }
  }
  assert(videne['lone-tree'] > 0 && videne['line-room'] > 0, 'both rules should have come up: ' + JSON.stringify(videne));
});

test('the daily ponds follow the weekly plan: 8, 8, 10, 10, 12, 12, 14', () => {
  const velkosti = [8, 8, 10, 10, 12, 12, 14];
  for (const d of DNI) {
    const p = zadaniePreDen(d);
    eq(p.n, velkosti[denVTyzdni(d)], d);
    eq(p.uroven, urovenDna(d), d);
    eq(p.n, UROVNE[p.uroven].n, d);
  }
});
test('Easy, Medium and Hard never ask for a trial', () => {
  for (const d of DNI) {
    const u = urovenDna(d);
    if (u === 'challenge') continue;
    eq(zadaniePreDen(d).difficulty.layers[3], 0, d + ' (' + u + ')');
  }
});
test('the picked candidate is one of the KANDIDATOV + NAVYSE and its difficulty is measured', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = zadaniePreDen(d);
    // plan.mjs looks at NAVYSE more candidates when none of the six reaches MIN_L2
    assert(p.kandidat >= 0 && p.kandidat < KANDIDATOV + NAVYSE, 'no candidate index for ' + d);
    assert(Number.isFinite(obtiaznost(p)) && obtiaznost(p) > 0, 'no measurement for ' + d);
  }
});
test('the same date always gives the same pond', () => {
  for (const d of DNI.slice(0, 3)) {
    const a = zadaniePreDen(d), b = zadaniePreDen(d);
    eq(a.trees, b.trees, d); eq(a.solution, b.solution, d); eq(a.kandidat, b.kandidat, d);
  }
});
test('zbal and rozbal round-trip and stay small', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = zadaniePreDen(d);
    const z = zbal(p), r = rozbal(z);
    eq(r.trees, p.trees); eq(r.rows, p.rows); eq(r.cols, p.cols); eq(r.solution, p.solution); eq(r.n, p.n); eq(r.uroven, p.uroven);
    eq(r.difficulty.layers, p.difficulty.layers);
    assert(JSON.stringify(z).length < 25 * p.n + 150, 'packed day too big for ' + p.n + 'x' + p.n + ': ' + JSON.stringify(z).length + ' bytes');
    assert(jeVyriesene(lenHrady(r), zad(r)), 'the unpacked pond does not finish its own puzzle');
  }
});
test('rozbal refuses a packed puzzle of the wrong shape', () => {
  const z = zbal(P0);
  for (const zly of [{ ...z, r: z.r.slice(1) }, { ...z, s: 5 }, { ...z, t: z.t + ',x' }, { ...z, c: z.c + '1' }, null]) {
    let threw = false;
    try { rozbal(zly); } catch (e) { threw = true; }
    assert(threw, 'accepted a broken packed puzzle');
  }
});
test('tyzden and the date helpers', () => {
  eq(tyzden('2026-09-10'), ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']);
  eq(denVTyzdni('2026-09-14'), 0);
  eq(pekneDatum('2026-09-10'), 'Thursday 10 September 2026');
  eq(kratkyDatum('2026-09-10'), '10 Sep');
  eq(posunDen('2026-02-28', 1), '2026-03-01');
});

console.log('\n  hints per pond (reveals = no rule found a step, always 0 for an accepted pond):');
for (const r of vysledky) {
  console.log('  ' + r.d.padEnd(16) + ' n' + String(r.n).padEnd(3) + r.u.padEnd(10) + ' steps ' + String(r.krokov).padStart(3)
    + '  layers ' + r.vrstvy[1] + '/' + r.vrstvy[2] + '/' + r.vrstvy[3] + '  reveals ' + r.odhalenia);
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
