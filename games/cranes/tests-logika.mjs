/* Tests for logika.mjs and plan.mjs. Run: node tests-logika.mjs
 * The important one: hints never contradict the solution, on puzzles of every
 * size, and hints alone carry an empty board all the way to the finished
 * one. */
import { porovnaj, jeVyriesene, napoveda } from './logika.mjs';
import { graf, poleLaviek } from './generator.mjs';
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

/* An empty board of walkways for a puzzle. */
function prazdna(p) { return new Uint8Array(graf(p.islands, p.n).E); }
/* The solution as one flat count per pair, in the same order as the board. */
function ploche(p) { return poleLaviek(p.bridges, graf(p.islands, p.n)); }

/* Plays a puzzle with hints only: apply every hint, check it against the
 * solution, stop when the board is finished. Returns how many hints were
 * plain reveals (druh 'odhalenie': no rule of any layer found a next step,
 * which should never happen on an accepted puzzle). */
function hrajNapovedami(p) {
  const g = graf(p.islands, p.n);
  const v = new Uint8Array(g.E), sol = poleLaviek(p.bridges, g);
  let odhalenia = 0, krokov = 0;
  const vrstvy = { 1: 0, 2: 0, 3: 0 };
  while (!jeVyriesene(v, p.islands, p.n, g)) {
    const h = napoveda(v, p.islands, p.bridges, p.n, g);
    assert(h, 'no hint on an unfinished board');
    assert(h.dvojice.length > 0, 'hint without pairs: ' + h.druh);
    assert(h.text && h.text.length > 10, 'hint without text');
    assert(!/[–—]/.test(h.text), 'no dashes in text meant for a person: ' + h.text);
    assert(typeof h.pravidlo === 'string' && h.pravidlo.length, 'hint without a rule name');
    // Prvý stlač Hintu ukazuje len časť pred " That settles"; počet lávok patrí
    // až za tú značku, takže ju musí mať každé pravidlo, ktoré lávku stavia.
    if (h.druh === 'lavka') {
      assert(h.text.indexOf(' That settles') > 0,
        'hint ' + h.pravidlo + ' gives its count away on the first press: ' + h.text);
    }
    let postavene = 0;
    for (const d of h.dvojice) {
      eq(g.indexPary(d.a, d.b), d.e, 'hint pair index does not match its two sandbanks');
      assert(d.val >= 0 && d.val <= 2, 'hint with an impossible count');
      assert(d.val === sol[d.e], 'hint ' + h.pravidlo + ' sets a count the solution does not have');
      if (d.val > v[d.e]) postavene++;
      v[d.e] = d.val;
    }
    assert(postavene > 0, 'hint ' + h.pravidlo + ' put nothing new on the board');
    if (h.druh === 'odhalenie') odhalenia++;
    else if (h.vrstva >= 1 && h.vrstva <= 3) vrstvy[h.vrstva]++;
    if (++krokov > 4000) throw new Error('hints do not converge');
  }
  return { odhalenia, krokov, vrstvy };
}

test('porovnaj counts the walkways on the board and only flags pairs with too many', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const g = graf(p.islands, p.n);
  const sol = ploche(p);
  const v = new Uint8Array(g.E);
  const jedna = Array.from(sol).findIndex((x) => x === 1);
  const ziadna = Array.from(sol).findIndex((x) => x === 0);
  v[jedna] = 2;  // one walkway too many: wrong
  v[ziadna] = 1; // a walkway where none belongs: wrong
  const r = porovnaj(v, p.bridges, p.islands, p.n, g);
  eq(r.zleDvojice.slice().sort((a, b) => a - b), [jedna, ziadna].sort((a, b) => a - b));
  eq(r.lavky, 3);
});

test('porovnaj says nothing is wrong about a board that is only unfinished', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const g = graf(p.islands, p.n);
  const sol = ploche(p);
  const v = new Uint8Array(g.E);
  for (let e = 0; e < g.E; e++) if (sol[e] === 2) v[e] = 1; // half of a double pair
  const r = porovnaj(v, p.bridges, p.islands, p.n, g);
  eq(r.zleDvojice, []); eq(r.krizenia, []); eq(r.prekrocene, []);
});

test('porovnaj is happy with the finished board', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const r = porovnaj(ploche(p), p.bridges, p.islands, p.n);
  eq(r.zleDvojice, []); eq(r.krizenia, []); eq(r.prekrocene, []);
  assert(r.lavky > 0);
});

test('porovnaj reports crossings and sandbanks over their number without looking at the solution', () => {
  // ručne overené: štyri ostrovy okolo jedného bodu, obe lávky sa krížia
  const islands = [{ r: 0, c: 1, n: 1 }, { r: 1, c: 0, n: 1 }, { r: 1, c: 2, n: 1 }, { r: 2, c: 1, n: 1 }];
  const g = graf(islands, 3);
  eq(g.E, 2, 'fixture');
  const v = new Uint8Array(g.E); v[0] = 2; v[1] = 1;
  const r = porovnaj(v, [], islands, 3, g);
  eq(r.krizenia.slice().sort((a, b) => a - b), [0, 1]);
  eq(r.prekrocene, [0, 3], 'the pair with two walkways is over its number of 1');
});

test('jeVyriesene accepts the generated board and rejects it one walkway short', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const v = ploche(p);
  assert(jeVyriesene(v, p.islands, p.n));
  const i = Array.from(v).findIndex((x) => x >= 1);
  v[i]--;
  assert(!jeVyriesene(v, p.islands, p.n));
});

test('jeVyriesene rejects two separate groups even when every number is satisfied', () => {
  // ručne overené: dva páry ostrovov s číslom 2, každý spojený dvojito.
  // Čísla sedia, nič sa nekríži, ale doska je na dva kusy.
  const islands = [{ r: 0, c: 0, n: 2 }, { r: 0, c: 2, n: 2 }, { r: 4, c: 0, n: 2 }, { r: 4, c: 2, n: 2 }];
  const g = graf(islands, 5);
  const v = new Uint8Array(g.E);
  v[g.indexPary(0, 1)] = 2; v[g.indexPary(2, 3)] = 2;
  for (let i = 0; i < 4; i++) {
    let s = 0;
    for (const e of g.hraneOstrova[i]) s += v[e];
    eq(s, 2, 'fixture: every number is satisfied');
  }
  assert(!jeVyriesene(v, islands, 5, g), 'two groups must not count as solved');
});

test('jeVyriesene rejects a board where two walkways cross', () => {
  const islands = [{ r: 0, c: 1, n: 1 }, { r: 1, c: 0, n: 1 }, { r: 1, c: 2, n: 1 }, { r: 2, c: 1, n: 1 }];
  const g = graf(islands, 3);
  const v = new Uint8Array(g.E); v[0] = 1; v[1] = 1;
  for (let i = 0; i < 4; i++) {
    let s = 0;
    for (const e of g.hraneOstrova[i]) s += v[e];
    eq(s, 1, 'fixture: every number is satisfied');
  }
  assert(!jeVyriesene(v, islands, 3, g), 'crossing walkways must not count as solved');
});

test('napoveda points at a pair with too many walkways before anything else', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const g = graf(p.islands, p.n);
  const sol = ploche(p);
  const v = new Uint8Array(g.E);
  const ziadna = Array.from(sol).findIndex((x) => x === 0);
  v[ziadna] = 1;
  const h = napoveda(v, p.islands, p.bridges, p.n, g);
  eq(h.druh, 'chyba'); eq(h.pravidlo, 'wrong-count');
  eq(h.dvojice[0].e, ziadna); eq(h.dvojice[0].val, 0);
});

test('napoveda on an empty board names a rule of the easiest layer and explains it', () => {
  const p = zadaniePreDen(PRVY_DEN);
  const h = napoveda(prazdna(p), p.islands, p.bridges, p.n);
  eq(h.druh, 'lavka');
  eq(h.vrstva, 1, 'the first step of an accepted puzzle should be a layer 1 rule');
  assert(h.dvojice.length >= 1);
  assert(h.text.endsWith('.') && h.text.length > 20, h.text);
});

test('napoveda returns null on a finished board', () => {
  const p = zadaniePreDen(PRVY_DEN);
  eq(napoveda(ploche(p), p.islands, p.bridges, p.n), null);
});

const DNI = []; for (let k = 0; k < 14; k++) DNI.push(posunDen(PRVY_DEN, k));
const vysledky = [];
test('hints carry an empty board to the finished puzzle for 14 consecutive days (all sizes), never contradicting the solution and never needing a plain reveal', () => {
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
test('the daily puzzles follow the weekly plan: 7, 7, 9, 9, 11, 11, 13', () => {
  const velkosti = [7, 7, 9, 9, 11, 11, 13];
  for (const d of DNI) {
    const p = zadaniePreDen(d);
    eq(p.n, velkosti[denVTyzdni(d)], d);
    eq(p.uroven, urovenDna(d), d);
    eq(p.n, UROVNE[p.uroven].n, d);
    const [lo, hi] = UROVNE[p.uroven].ostrovy;
    assert(p.islands.length >= lo && p.islands.length <= hi, d + ' has ' + p.islands.length + ' sandbanks, band is ' + lo + ' to ' + hi);
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
test('Challenge leans on the harder layers more than Easy does', () => {
  const pre = (u) => {
    let sum = 0, n = 0;
    for (const d of DNI) { if (urovenDna(d) !== u) continue; sum += obtiaznost(zadaniePreDen(d)); n++; }
    return sum / n;
  };
  const easy = pre('easy'), challenge = pre('challenge');
  assert(challenge > easy, 'challenge ' + challenge + ' should be measured harder than easy ' + easy);
});
test('the picked candidate is one of the KANDIDATOV made for that day and its difficulty is measured', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = zadaniePreDen(d);
    assert(p.kandidat >= 0 && p.kandidat < KANDIDATOV, 'no candidate index for ' + d);
    assert(Number.isInteger(obtiaznost(p)) && obtiaznost(p) > 0, 'no measurement for ' + d);
    assert(p.difficulty.lavky > 0 && p.difficulty.ostrovy === p.islands.length, 'no measurement of the board on ' + d);
  }
});
test('the same date always gives the same puzzle', () => {
  for (const d of DNI.slice(0, 3)) {
    const a = zadaniePreDen(d), b = zadaniePreDen(d);
    eq(a.islands, b.islands, d); eq(a.bridges, b.bridges, d); eq(a.kandidat, b.kandidat, d);
  }
});
test('zbal and rozbal round-trip and stay reasonably small', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = zadaniePreDen(d);
    const z = zbal(p), r = rozbal(z);
    eq(r.islands, p.islands); eq(r.bridges, p.bridges); eq(r.n, p.n); eq(r.uroven, p.uroven);
    eq(r.difficulty.layers, p.difficulty.layers);
    assert(JSON.stringify(z).length < 55 * p.n, 'packed day too big for ' + p.n + 'x' + p.n + ': ' + JSON.stringify(z).length + ' bytes');
    assert(jeVyriesene(poleLaviek(r.bridges, graf(r.islands, r.n)), r.islands, r.n), 'the unpacked board does not finish its own puzzle');
  }
});
test('rozbal refuses a packed puzzle of the wrong shape', () => {
  const z = zbal(zadaniePreDen(PRVY_DEN));
  const zle = [
    { ...z, i: 5 },
    { ...z, b: z.b + ';0-99:1' },
    { ...z, i: z.i + ';1,2' },
    { ...z, b: z.b + ';2-1:3' },
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

console.log('\n  hints per puzzle (reveals = no rule found a step, always 0 for an accepted puzzle):');
for (const r of vysledky) {
  console.log('  ' + r.d.padEnd(16) + ' n' + String(r.n).padStart(2) + ' ' + r.u.padEnd(10) + ' steps ' + String(r.krokov).padStart(3) +
    '  layers ' + r.vrstvy[1] + '/' + r.vrstvy[2] + '/' + r.vrstvy[3] + '  reveals ' + r.odhalenia);
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
