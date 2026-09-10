/* Tests for logika.mjs and plan.mjs. Run: node tests-logika.mjs
 * The important one: hints never contradict the solution, on puzzles of
 * every setting of the week, and hints alone carry an empty board all the
 * way to the finished puzzle. */
import { porovnaj, jeVyriesene, napoveda, konflikty, dosah, hotoveJednotky } from './logika.mjs';
import { solve, sediPravidlam } from './generator.mjs';
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

/* The board a player starts from: the givens and nothing else. */
function zaciatok(p) { return p.givens.slice(); }
/* The first burrow the player has to think about. */
function prvePrazdne(p) {
  for (let i = 0; i < p.givens.length; i++) if (!p.givens[i]) return i;
  return -1;
}

/* Plays a puzzle with hints only: apply every hint, check it against the
 * solution, stop when the puzzle is finished. Returns how many hints were
 * plain reveals (druh 'odhalenie': no rule of any layer found a next step,
 * which should never happen on an accepted puzzle). */
function hrajNapovedami(p) {
  const v = zaciatok(p);
  let odhalenia = 0, krokov = 0;
  const vrstvy = { 1: 0, 2: 0, 3: 0 };
  while (!jeVyriesene(v, p.n, p.rules)) {
    const h = napoveda(v, p.givens, p.solution, p.n, p.rules);
    assert(h, 'no hint on an unfinished puzzle');
    assert(h.bunky.length > 0, 'hint without burrows: ' + h.druh);
    assert(h.text && h.text.length > 10, 'hint without text');
    assert(!/[–—]/.test(h.text), 'no dashes in text shown to a person: ' + h.text);
    assert(typeof h.pravidlo === 'string' && h.pravidlo.length, 'hint without a rule name');
    for (const c of h.bunky) {
      eq(c.i, c.r * p.n + c.c, 'hint burrow index does not match its address');
      assert(v[c.i] === 0, 'hint ' + h.pravidlo + ' touches a burrow that is already filled in');
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
  const v = zaciatok(p);
  const a = prvePrazdne(p);
  v[a] = p.solution[a] === p.n ? 1 : p.solution[a] + 1; // one number too high
  const r = porovnaj(v, p.solution);
  eq(r.zle, [a]);
  eq(r.vyplnene, p.difficulty.dane + 1);
});

test('porovnaj is happy with the finished puzzle and never blames an empty burrow', () => {
  const p = den(PRVY_DEN);
  const r = porovnaj(p.solution, p.solution);
  eq(r.zle, []);
  eq(r.vyplnene, p.n * p.n);
  eq(porovnaj(new Array(p.n * p.n).fill(0), p.solution), { vyplnene: 0, zle: [] });
});

test('jeVyriesene accepts the finished meadow and rejects it one burrow short', () => {
  const p = den(PRVY_DEN);
  const v = p.solution.slice();
  assert(jeVyriesene(v, p.n, p.rules));
  v[prvePrazdne(p)] = 0;
  assert(!jeVyriesene(v, p.n, p.rules));
});

test('jeVyriesene rejects a full board that keeps every row, column and block but breaks the knight rule', () => {
  // 4 x 4, blocks 2 x 2. Rows, columns and blocks are all fine here, but the
  // 1 in row 1, column 1 and the 1 in row 2, column 3 are a knight leap
  // apart, so the meadow is not finished.
  const n = 4;
  const v = '1234341243212143'.split('').map(Number);
  for (let r = 0; r < n; r++) {
    const m = new Set();
    for (let c = 0; c < n; c++) m.add(v[r * n + c]);
    eq(m.size, n, 'fixture: every row should still hold 1 to 4');
  }
  assert(jeVyriesene(v, n, { knight: false, king: false }), 'without the knight rule this board is finished');
  assert(!jeVyriesene(v, n, { knight: true, king: false }), 'the knight rule must catch it');
  eq(konflikty(v, n, { knight: true, king: false }).length > 0, true);
});

test('dosah lists the burrows a knight leap away, and the touching ones only on king days', () => {
  const stred = 4 * 9 + 4;
  const bezKrala = dosah(stred, 9, { knight: true, king: false });
  eq(bezKrala.skok.length, 8);
  eq(bezKrala.dotyk.length, 0);
  const sKralom = dosah(stred, 9, { knight: true, king: true });
  eq(sKralom.dotyk.length, 8);
});

test('hotoveJednotky names the rows, columns and blocks that are full and clean', () => {
  const p = den(PRVY_DEN);
  eq(hotoveJednotky(new Array(p.n * p.n).fill(0), p.n, p.rules), []);
  const vsetky = hotoveJednotky(p.solution, p.n, p.rules);
  eq(vsetky.length, 3 * p.n, 'the finished meadow has every unit done');
  const skoro = p.solution.slice();
  skoro[0] = 0;
  const kus = hotoveJednotky(skoro, p.n, p.rules);
  eq(kus.length, 3 * p.n - 3, 'one empty burrow leaves its row, column and block unfinished');
});

test('napoveda points at a wrong number before anything else', () => {
  const p = den(PRVY_DEN);
  const v = zaciatok(p);
  const a = prvePrazdne(p);
  v[a] = p.solution[a] === p.n ? 1 : p.solution[a] + 1;
  const h = napoveda(v, p.givens, p.solution, p.n, p.rules);
  eq(h.druh, 'chyba'); eq(h.pravidlo, 'wrong-number'); eq(h.bunky[0].val, 0); eq(h.bunky[0].i, a);
});

test('napoveda on a fresh board names a rule of the easiest layer and explains it', () => {
  const p = den(PRVY_DEN);
  const h = napoveda(zaciatok(p), p.givens, p.solution, p.n, p.rules);
  eq(h.druh, 'bunka');
  eq(h.vrstva, 1, 'the first step of an accepted puzzle should be a layer 1 rule');
  eq(h.bunky.length, 1);
  assert(h.text.endsWith('.') && h.text.length > 20, h.text);
});

test('napoveda returns null on a finished puzzle', () => {
  const p = den(PRVY_DEN);
  eq(napoveda(p.solution.slice(), p.givens, p.solution, p.n, p.rules), null);
});

const DNI = []; for (let k = 0; k < 14; k++) DNI.push(posunDen(PRVY_DEN, k));
const vysledky = [];
test('hints carry a fresh board to the finished puzzle for 14 consecutive days (all settings), never contradicting the solution and never needing a plain reveal', () => {
  for (const d of DNI) {
    const p = den(d);
    const r = hrajNapovedami(p);
    vysledky.push({ d, n: p.n, u: p.uroven, dane: p.difficulty.dane, ...r });
    assert(r.odhalenia === 0, d + ' needed a plain reveal, but every accepted puzzle should be reachable by the rules alone');
  }
});
test('hints solve the first puzzle of every practice set', () => {
  for (const s of SADY) {
    const p = zadanieCvicenie(s.id, 1);
    const r = hrajNapovedami(p);
    vysledky.push({ d: s.id, n: p.n, u: p.uroven, dane: p.difficulty.dane, ...r });
    assert(r.odhalenia === 0, s.id + ' needed a plain reveal');
  }
});
test('the daily puzzles follow the weekly plan: 6, 6, 9, 9, 9, 9, 9 with the king rule from Friday on', () => {
  const velkosti = [6, 6, 9, 9, 9, 9, 9];
  const krali = [false, false, false, false, true, true, true];
  for (const d of DNI) {
    const p = den(d);
    eq(p.n, velkosti[denVTyzdni(d)], d);
    eq(p.uroven, urovenDna(d), d);
    eq(p.n, UROVNE[p.uroven].n, d);
    eq(p.rules.knight, true, d + ' the knight rule is on every day');
    eq(p.rules.king, krali[denVTyzdni(d)], d);
    eq(p.difficulty.dane, UROVNE[p.uroven].dane, d + ' gives away the wrong number of numbers');
  }
});
test('every daily puzzle has exactly one solution and its givens agree with it', () => {
  for (const d of DNI) {
    const p = den(d);
    const r = solve(p.givens, p.n, p.rules, { limit: 2 });
    eq(r.count, 1, d);
    eq(r.solution, p.solution, d);
    assert(sediPravidlam(p.solution, p.n, p.rules), d + ' solution breaks a rule');
    for (let i = 0; i < p.n * p.n; i++) {
      assert(p.givens[i] === 0 || p.givens[i] === p.solution[i], d + ' a given the solution does not agree with');
    }
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
test('a harder level really does take more work: Challenge needs more steps than Easy and gives less away', () => {
  const pre = (u, pole) => {
    let sum = 0, k = 0;
    for (const d of DNI) { if (urovenDna(d) !== u) continue; sum += pole(den(d)); k++; }
    return sum / k;
  };
  const kroky = (p) => p.difficulty.steps;
  const easy = pre('easy', kroky), challenge = pre('challenge', kroky);
  assert(challenge > easy, 'challenge ' + challenge + ' should take more steps than easy ' + easy);
  assert(UROVNE.challenge.dane < UROVNE.medium.dane, 'challenge should give less away than medium');
  assert(UROVNE.hard.dane < UROVNE.medium.dane, 'hard should give less away than medium');
});
test('the picked candidate is one of the KANDIDATOV made for that day and its difficulty is measured', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = den(d);
    assert(p.kandidat >= 0 && p.kandidat < KANDIDATOV, 'no candidate index for ' + d);
    assert(Number.isInteger(obtiaznost(p)) && obtiaznost(p) > 0, 'no measurement for ' + d);
    assert(p.difficulty.dane > 0 && p.difficulty.dane < p.n * p.n, 'odd number of givens on ' + d);
  }
});
test('obtiaznost counts a trial above a pattern, a pattern above a plain step, and fewer givens as harder', () => {
  const p = (l1, l2, l3, dane) => ({ n: 9, difficulty: { layers: { 1: l1, 2: l2, 3: l3 }, dane } });
  assert(obtiaznost(p(50, 0, 1, 25)) > obtiaznost(p(50, 20, 0, 25)), 'a trial should outweigh any number of patterns here');
  assert(obtiaznost(p(50, 2, 0, 25)) > obtiaznost(p(50, 1, 0, 25)));
  assert(obtiaznost(p(50, 1, 0, 20)) > obtiaznost(p(50, 1, 0, 25)), 'fewer givens is harder');
});
test('the same date always gives the same puzzle', () => {
  for (const d of DNI.slice(0, 3)) {
    const a = zadaniePreDen(d), b = zadaniePreDen(d);
    eq(a.givens, b.givens, d); eq(a.solution, b.solution, d); eq(a.kandidat, b.kandidat, d);
  }
});
test('zbal and rozbal round-trip and stay small enough to embed in a page', () => {
  for (const d of DNI.slice(0, 7)) {
    const p = den(d);
    const z = zbal(p), r = rozbal(z);
    eq(r.givens, p.givens); eq(r.solution, p.solution); eq(r.n, p.n); eq(r.uroven, p.uroven);
    eq(r.rules, p.rules);
    eq(r.difficulty.layers, p.difficulty.layers);
    eq(r.difficulty.dane, p.difficulty.dane);
    const bajtov = JSON.stringify(z).length;
    // two characters per burrow (the givens and the solution) plus the short
    // labels around them
    assert(bajtov < 2 * p.n * p.n + 100, 'packed day too big for ' + p.n + 'x' + p.n + ': ' + bajtov + ' bytes');
    assert(jeVyriesene(r.solution, r.n, r.rules), 'the unpacked puzzle is not finished by its own solution');
  }
});
test('rozbal refuses a packed puzzle of the wrong shape', () => {
  const z = zbal(den(PRVY_DEN));
  const zle = [
    { ...z, g: z.g.slice(1) },
    { ...z, s: 5 },
    { ...z, s: z.s + '1' },
    { ...z, r: 'x' },
    { ...z, s: '0' + z.s.slice(1) },
    { ...z, g: (z.s[0] === '1' ? '2' : '1') + z.g.slice(1) },
  ];
  for (const x of zle) {
    let threw = false;
    try { rozbal(x); } catch (e) { threw = true; }
    assert(threw, 'accepted a broken packed puzzle: ' + JSON.stringify(x).slice(0, 40));
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
  console.log('  ' + r.d.padEnd(16) + ' n' + String(r.n).padEnd(3) + r.u.padEnd(10) + ' givens ' + String(r.dane).padStart(2) +
    '  steps ' + String(r.krokov).padStart(3) + '  layers ' + r.vrstvy[1] + '/' + r.vrstvy[2] + '/' + r.vrstvy[3] +
    '  reveals ' + r.odhalenia);
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
