/* Tests for the Foxes generator and plan. No framework:
 *   node products/arling-sk/games/foxes/tests.mjs
 * Prints "N passed, M failed" and exits 1 if anything fails. It also prints
 * the numbers the spec asks to be measured rather than guessed: clue counts,
 * layer counts, the spread of clue types, trial chains and the time per day.
 * FOXES_POCET changes how many days per level (default 30, spec part 15).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  mulberry32, seedFromString, isValidDate, todayBratislava,
  BANKY, BANKY_HASH, hashBanky, VLASTNOSTI, PROFILY, PROFIL, MAX_SLOV, MAX_RETAZ, MAX_SKUSOK, MIEST_SKUSKY, TYPY,
  struktura, pripravIndicie, solve, solveNaivne, solveHuman, generateSeeded, pravdiva, platneRozlozenie,
  textIndicie, pocetSlov, vetaRozuzlenia, drzitel, klucIndicie, vyberObsadenie,
} from './generator.mjs';
import {
  UROVNE, PRVY_DEN, KANDIDATOV, SADY, MAX_SKUSOK_NEDELA, urovenDna, obtiaznost, posunDen, denVTyzdni,
  zadaniePreDen, zadanieCvicenie, zbal, rozbal, pekneDatum,
} from './plan.mjs';

const TU = dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n     ') : e)); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }
function eq(a, b, m) { const ja = JSON.stringify(a), jb = JSON.stringify(b); if (ja !== jb) throw new Error((m || 'eq') + ': ' + ja + ' !== ' + jb); }

const UROVNE_ZOZ = ['easy', 'medium', 'hard', 'challenge'];
const OPTS = { easy: { n: 5, maxVrstva: 1 }, medium: { n: 6, maxVrstva: 2 }, hard: { n: 7, maxVrstva: 2 }, challenge: { n: 7, maxVrstva: 3 } };
const POCET = Number(process.env.FOXES_POCET || 30);
const ZACIATOK = '2026-09-01';

/* ── 0. The small deterministic pieces ─────────────────────────────────── */
test('mulberry32 is deterministic and stays in [0, 1)', () => {
  const a = mulberry32(12345), b = mulberry32(12345);
  for (let i = 0; i < 200; i++) { const x = a(); assert(x === b(), 'disagree'); assert(x >= 0 && x < 1, 'range ' + x); }
});
test('seedFromString is stable and separates similar keys', () => {
  assert(seedFromString('2026-03-02/7x7') === seedFromString('2026-03-02/7x7'));
  assert(seedFromString('2026-03-02/7x7') !== seedFromString('2026-03-02/7x7#1'));
});
test('isValidDate knows the calendar and todayBratislava gives a real date', () => {
  assert(isValidDate('2024-02-29') && !isValidDate('2026-02-29') && !isValidDate('2026-13-01') && !isValidDate('x'));
  assert(isValidDate(todayBratislava()));
  eq(todayBratislava(new Date('2026-09-25T10:00:00Z')), '2026-09-25');
});

/* ── 1. A hand built lair, worked out on paper ─────────────────────────── */
test('a hand built 5 by 5 lair solves to the placement worked out on paper', () => {
  /* Chambers by rows: a a b b b / a a b b b / c c c d d / c c c d d / c c c d d.
     No stones, no marks. Pieces 0..3 foxes, 4 the thing. Solution cells:
     fox 0 in row 1 col 1 (0), fox 1 row 2 col 3 (7), fox 2 row 3 col 5 (14),
     fox 3 row 4 col 2 (16), thing row 5 col 4 (23).
     The thing is in chamber d with fox 2 alone (fox 1 is in b, 0 in a, 3 in c).
     Clues: fox 0 in the top row and in the leftmost column; fox 1 in b and
     above fox 3; fox 2 in the rightmost column and above fox 3; fox 3 in c;
     the thing in the bottom row and in d.
     On paper: fox 0 is on cell 0. Fox 1 is in b, row 1 is taken, so row 2.
     The thing is on (5,4) or (5,5); on (5,5) column 5 would leave fox 2
     nowhere, so (5,4). Fox 1 then has (2,3) or (2,5); (2,5) would take
     column 5 from fox 2, so (2,3). Fox 3 in c has column 2 left, rows 3 or
     4; fox 2 has column 5, rows 3 or 4, and is above fox 3: fox 2 on (3,5),
     fox 3 on (4,2). Only fox 2 shares d with the thing, so fox 2 has it. */
  const zad = {
    date: 'hand', n: 5, K: 4, komory: [0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 2, 2, 2, 3, 3, 2, 2, 2, 3, 3],
    kamene: [], znaky: new Array(25).fill(-1), bank: BANKY.sada, lisky: [0, 1, 2, 3], komoryIdx: [0, 1, 2, 3],
    vlastnost: 0, skupina: [0, 1, 0, 1], vecIdx: 0, mena: ['Ember', 'Rusty', 'Flint', 'Blaze'],
    menaKomor: ['larder', 'nursery', 'tunnel', 'hall'], vec: 'ball of wool',
    solution: [0, 7, 14, 16, 23],
    clues: [
      { t: 'EDGE', p: 0, e: 0 }, { t: 'EDGE', p: 0, e: 2 },
      { t: 'IN', p: 1, k: 1 }, { t: 'ABOVE', p: 1, q: 3 }, { t: 'EDGE', p: 2, e: 3 }, { t: 'ABOVE', p: 2, q: 3 },
      { t: 'IN', p: 3, k: 2 }, { t: 'EDGE', p: 4, e: 1 }, { t: 'IN', p: 4, k: 3 },
    ],
  };
  for (const cl of zad.clues) assert(pravdiva(zad, cl, zad.solution), 'clue not true: ' + JSON.stringify(cl));
  assert(platneRozlozenie(zad, zad.solution), 'the hand solution is not valid');
  const r = solve(zad, { limit: 2 });
  eq(r.count, 1, 'solutions');
  eq(r.solution, zad.solution, 'solve');
  const h = solveHuman(zad, { maxVrstva: 2 });
  assert(h.solved, 'solveHuman did not finish');
  eq(h.pos, zad.solution, 'solveHuman');
  eq(drzitel(zad, zad.solution), 2, 'the fox alone with the thing');
  eq(vetaRozuzlenia(zad), 'Flint has the ball of wool, in the hall.');
});

/* ── 2. The generated set ──────────────────────────────────────────────── */
const DAVKA = {};
const CASY = {};
for (const u of UROVNE_ZOZ) {
  DAVKA[u] = [];
  CASY[u] = [];
  for (let i = 0; i < POCET; i++) {
    const d = posunDen(ZACIATOK, i);
    const t0 = performance.now();
    DAVKA[u].push(generateSeeded(d, d + '/' + u, OPTS[u]));
    CASY[u].push(performance.now() - t0);
  }
}
const VSETKY = UROVNE_ZOZ.flatMap((u) => DAVKA[u].map((p) => ({ u, p })));
const stat = (a) => { const s = a.slice().sort((x, y) => x - y); return { avg: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), min: s[0], max: s[s.length - 1] }; };

test('1. determinism: the same key gives byte for byte the same packed puzzle', () => {
  for (const u of UROVNE_ZOZ) {
    const d = posunDen(ZACIATOK, 3);
    const a = zbal({ ...generateSeeded(d, d + '/' + u, OPTS[u]), uroven: u });
    const b = zbal({ ...generateSeeded(d, d + '/' + u, OPTS[u]), uroven: u });
    eq(a, b, u);
  }
});

test('2. uniqueness: ' + POCET + ' days at every level, solve finds exactly one placement, the source one', () => {
  for (const { u, p } of VSETKY) {
    const r = solve(p, { limit: 2 });
    assert(!r.vycerpane, u + ' ' + p.date + ' exhausted maxNodes');
    eq(r.count, 1, u + ' ' + p.date + ' count');
    eq(r.solution, p.solution, u + ' ' + p.date);
  }
});

test('3. independence: the naive search agrees on 10 days of every level', () => {
  const uzly = {};
  for (const u of UROVNE_ZOZ) {
    uzly[u] = [];
    for (const p of DAVKA[u].slice(0, 10)) {
      const r = solveNaivne(p, { limit: 2, maxNodes: 2000000 });
      assert(!r.vycerpane, u + ' ' + p.date + ' naive exhausted');
      eq(r.count, 1, u + ' ' + p.date + ' naive count');
      eq(r.solution, p.solution, u + ' ' + p.date + ' naive');
      uzly[u].push(r.uzly);
    }
  }
  console.log('     naive nodes: ' + UROVNE_ZOZ.map((u) => u + ' ' + JSON.stringify(stat(uzly[u]))).join(', '));
});

test('4. solvable without guessing: easy by layer 1 only, medium and hard without layer 3, challenge with a trial', () => {
  for (const { u, p } of VSETKY) {
    const h = solveHuman(p, { maxVrstva: OPTS[u].maxVrstva });
    assert(h.solved, u + ' ' + p.date + ' not solved within its layer');
    eq(h.pos, p.solution, u + ' ' + p.date);
    if (u === 'easy') assert(!h.layers[2] && !h.layers[3], p.date + ' easy needed layer 2 or 3');
    if (u === 'medium' || u === 'hard') assert(!h.layers[3], p.date + ' used layer 3');
    if (u === 'challenge') assert(h.layers[3] >= 1 && h.layers[3] <= MAX_SKUSOK, p.date + ' challenge with ' + h.layers[3] + ' trials');
  }
});

test('5. every trial chain is at most MAX_RETAZ = 6 steps, and the guide says so', () => {
  eq(MAX_RETAZ, 6);
  const retaze = [];
  const zdroje = DAVKA.challenge.slice();
  const dni = join(TU, 'dni');
  if (existsSync(dni)) {
    for (const f of readdirSync(dni).filter((x) => /^\d{4}-\d{2}\.json$/.test(x))) {
      for (const z of JSON.parse(readFileSync(join(dni, f), 'utf8'))) if (z.u === 'challenge') zdroje.push(rozbal(z));
    }
  }
  for (const p of zdroje) {
    const h = solveHuman(p, { maxVrstva: 3, texty: true });
    assert(h.solved, p.date + ' not solved');
    for (const k of h.steps) {
      if (k.rule !== 'trial') continue;
      assert(k.retaz <= 6, p.date + ' chain ' + k.retaz);
      assert(/Step|at once/.test(k.text + k.textBezHodnoty));
      retaze.push(k.retaz);
      // "one of its two cells", as the page and the guide say (finding 5)
      eq(k.pocet, MIEST_SKUSKY, p.date + ' a trial on a piece with ' + k.pocet + ' cells');
      assert(/^One of them has two cells left\./.test(k.textBezHodnoty), p.date + ': ' + k.textBezHodnoty);
      // every link says what it leaves, and never makes the tried fox its subject
      const meno = p.mena[k.piece] || p.vec;
      for (const veta of (k.text.match(/Step \d+: [^.]*\./g) || [])) {
        assert(!/narrow things down|rule out more cells/.test(veta), p.date + ' a link that says nothing: ' + veta);
        assert(!new RegExp('\\b' + meno + '\\b').test(veta), p.date + ' a link names the fox being tried: ' + veta);
      }
      assert(/So .* is in the other cell, row \d, column \d\.$/.test(k.text), p.date + ' the trial does not end in the other cell: ' + k.text);
    }
  }
  console.log('     trials checked: ' + retaze.length + ' over ' + zdroje.length + ' challenge lairs, chain ' + JSON.stringify(stat(retaze)));
  const postav = readFileSync(join(TU, '..', '..', '..', '..', 'ops', 'games', 'foxes', 'postav.mjs'), 'utf8');
  assert(postav.includes('within six steps'), 'the guide text lost "within six steps"');
  assert(readFileSync(join(TU, 'index.html'), 'utf8').includes('within six steps'), 'index.html lost "within six steps"');
});

test('5b. the published Sundays: one to three trials each, and the page says so', () => {
  const dni = join(TU, 'dni');
  const pocty = [];
  if (existsSync(dni)) {
    for (const f of readdirSync(dni).filter((x) => /^\d{4}-\d{2}\.json$/.test(x))) {
      for (const z of JSON.parse(readFileSync(join(dni, f), 'utf8'))) if (z.u === 'challenge') pocty.push(Number(z.l.split(',')[2]));
    }
  }
  for (const d of DAVKA.challenge) assert(d.difficulty.layers[3] >= 1, d.date + ' a challenge candidate without a trial');
  if (pocty.length) {
    for (const x of pocty) assert(x >= 1 && x <= MAX_SKUSOK_NEDELA, 'a published Sunday with ' + x + ' trials');
    const priemer = pocty.reduce((a, b) => a + b, 0) / pocty.length;
    assert(priemer <= 3, 'average ' + priemer);
    const h = {}; for (const x of pocty) h[x] = (h[x] || 0) + 1;
    console.log('     published Sundays: ' + pocty.length + ', trials ' + JSON.stringify(h) + ', average ' + priemer.toFixed(2));
  }
  const postav = readFileSync(join(TU, '..', '..', '..', '..', 'ops', 'games', 'foxes', 'postav.mjs'), 'utf8');
  const html = readFileSync(join(TU, 'index.html'), 'utf8');
  for (const [kde, t] of [['postav.mjs', postav], ['index.html', html]]) {
    assert(t.includes('one of its two cells'), kde + ' lost "one of its two cells"');
    assert(!/now and then one fox/i.test(t), kde + ' still says "now and then"');
  }
  assert(postav.includes('Seventy-two lairs with no date attached') && !/twenty-four lairs with no date/i.test(postav), 'the practice count in the guide is wrong (9 sets of 8)');
  assert(html.includes('twenty-four lairs of each level'), 'index.html: the practice count per level');
});

test('6. truth: every clue of every lair is true against the solution, recomputed from scratch', () => {
  for (const { u, p } of VSETKY) for (const cl of p.clues) assert(pravdiva(p, cl, p.solution), u + ' ' + p.date + ' ' + JSON.stringify(cl));
});

test('7. minimal and no dead clue: taking any clue out breaks the human solver, and every clue is cited', () => {
  for (const { u, p } of VSETKY) {
    const h = solveHuman(p, { maxVrstva: OPTS[u].maxVrstva, maxSkusok: MAX_SKUSOK });
    eq(h.pouziteIndicie.size, p.clues.length, u + ' ' + p.date + ' a clue is never cited');
    for (let i = 0; i < p.clues.length; i++) {
      const bez = { ...p, clues: p.clues.filter((_, j) => j !== i) };
      assert(!solveHuman(bez, { maxVrstva: OPTS[u].maxVrstva, maxSkusok: MAX_SKUSOK }).solved, u + ' ' + p.date + ' clue ' + (i + 1) + ' is not needed');
    }
  }
});

test('8. the solution: one piece per row and column, none on a stone, one fox alone with the thing, HOLDER true', () => {
  for (const { u, p } of VSETKY) {
    const n = p.n, kamen = new Set(p.kamene);
    const rr = new Set(p.solution.map((a) => (a / n) | 0)), ss = new Set(p.solution.map((a) => a % n));
    eq(rr.size, n, u + ' rows'); eq(ss.size, n, u + ' columns');
    for (const a of p.solution) assert(!kamen.has(a), u + ' ' + p.date + ' piece on a stone');
    const f = drzitel(p, p.solution);
    assert(f >= 0, u + ' ' + p.date + ' no fox alone with the thing');
    for (const cl of p.clues) if (cl.t === 'HOLDER') eq(cl.g, p.skupina[f], u + ' ' + p.date + ' holder');
  }
});

test('9. the board: contiguous chambers of at least 3 cells, stones off the solution, two free cells per line', () => {
  for (const { u, p } of VSETKY) {
    const n = p.n, C = n * n;
    eq(p.K, PROFIL(n, OPTS[u].maxVrstva).komory, 'chambers');
    for (let k = 0; k < p.K; k++) {
      const bunky = []; for (let c = 0; c < C; c++) if (p.komory[c] === k) bunky.push(c);
      assert(bunky.length >= 3, u + ' ' + p.date + ' small chamber');
      const videne = new Set([bunky[0]]), f = [bunky[0]];
      while (f.length) { const c = f.pop(), r = (c / n) | 0, s = c % n; for (const d of [r > 0 ? c - n : -1, r < n - 1 ? c + n : -1, s > 0 ? c - 1 : -1, s < n - 1 ? c + 1 : -1]) if (d >= 0 && p.komory[d] === k && !videne.has(d)) { videne.add(d); f.push(d); } }
      eq(videne.size, bunky.length, u + ' ' + p.date + ' chamber ' + k + ' not contiguous');
    }
    const kamen = new Set(p.kamene);
    for (let i = 0; i < n; i++) {
      let r = 0, s = 0;
      for (let j = 0; j < n; j++) { if (!kamen.has(i * n + j)) r++; if (!kamen.has(j * n + i)) s++; }
      assert(r >= 2 && s >= 2, u + ' ' + p.date + ' line ' + i + ' with fewer than two free cells');
    }
    for (const c of p.kamene) eq(p.znaky[c], -1, 'a mark on a stone');
  }
});

test('10. the first step is free: at least two clues act on an empty board', () => {
  for (const { u, p } of VSETKY) {
    let hned = 0;
    for (const cl of p.clues) {
      const h = solveHuman({ ...p, clues: [cl] }, { maxVrstva: 2, limitKrokov: 1 });
      if (h.steps.length && h.steps[0].clue === 0) hned++;
    }
    assert(hned >= 2, u + ' ' + p.date + ' only ' + hned);
  }
});

test('11. caps: clue count under the ceiling, a type at most 3 times from medium, IN and HOLDER, SAME never with the thing', () => {
  const typy = {}, pocty = {};
  for (const { u, p } of VSETKY) {
    const prof = UROVNE[u];
    assert(p.clues.length <= prof.strop, u + ' ' + p.date + ' ' + p.clues.length + ' clues');
    (pocty[u] = pocty[u] || []).push(p.clues.length);
    const c = {};
    for (const cl of p.clues) { c[cl.t] = (c[cl.t] || 0) + 1; typy[u + ' ' + cl.t] = (typy[u + ' ' + cl.t] || 0) + 1; }
    if (u !== 'easy') for (const t of TYPY) assert((c[t] || 0) <= 3, u + ' ' + p.date + ' ' + t + ' ' + c[t]);
    if (u === 'hard') assert((c.IN || 0) <= 1, p.date + ' IN on hard');
    if (u === 'challenge') assert(!c.IN, p.date + ' IN on challenge');
    assert((c.HOLDER || 0) <= 1, 'HOLDER twice');
    for (const cl of p.clues) if (cl.t === 'SAME') assert(cl.p !== p.n - 1 && cl.q !== p.n - 1, 'SAME with the thing');
    assert(new Set(p.clues.map(klucIndicie)).size === p.clues.length, 'a clue twice');
  }
  for (const u of UROVNE_ZOZ) console.log('     ' + u + ': clues ' + JSON.stringify(stat(pocty[u])) + ', ms ' + JSON.stringify(stat(CASY[u].map(Math.round))));
  for (const u of UROVNE_ZOZ) console.log('     ' + u + ' types: ' + Object.entries(typy).filter(([k]) => k.startsWith(u + ' ')).map(([k, v]) => k.slice(u.length + 1) + ' ' + v).join(', '));
});

test('12. difficulty: l1 and l2 stay under 1000, so obtiaznost never rolls over', () => {
  const l = { 1: [], 2: [], 3: [] };
  for (const { p } of VSETKY) { assert(p.difficulty.layers[1] < 1000 && p.difficulty.layers[2] < 1000); for (const k of [1, 2, 3]) l[k].push(p.difficulty.layers[k]); }
  console.log('     layers: l1 ' + JSON.stringify(stat(l[1])) + ', l2 ' + JSON.stringify(stat(l[2])) + ', l3 ' + JSON.stringify(stat(l[3])));
});

/* ── 3. The word banks ─────────────────────────────────────────────────── */
test('13a. banka-slov.json and the copy in generator.mjs agree word for word, and the hash holds', () => {
  const json = JSON.parse(readFileSync(join(TU, 'banka-slov.json'), 'utf8'));
  eq(json.sada, BANKY.sada);
  for (const k of ['foxes', 'chambers', 'traits', 'things']) eq(json[k], BANKY[k], k);
  eq(json.hash, BANKY_HASH, 'hash in the json file');
  eq(hashBanky(), BANKY_HASH, 'the banks changed, which would change every published day');
  eq(BANKY.foxes.length, 22); eq(BANKY.chambers.length, 14); eq(BANKY.things.length, 8);
  eq(VLASTNOSTI.map((v) => [v.a.slovo, v.b.slovo]), BANKY.traits, 'trait forms follow the bank');
});

test('13b. banks: disjoint, first letters unique, no mark or trait word in a name, no famous fox, no Dormice word', () => {
  const slova = new Map();
  const banky = { foxes: BANKY.foxes, chambers: BANKY.chambers, traits: BANKY.traits.flat(), things: BANKY.things };
  for (const [kde, zoz] of Object.entries(banky)) for (const w of zoz) for (const s of w.toLowerCase().split(/[\s-]+/)) {
    const bolo = slova.get(s);
    assert(!bolo || bolo === kde, '"' + s + '" is in ' + bolo + ' and ' + kde);
    slova.set(s, kde);
  }
  eq(new Set(BANKY.foxes.map((w) => w[0])).size, BANKY.foxes.length, 'fox letters');
  eq(new Set(BANKY.chambers.map((w) => w[0].toUpperCase())).size, BANKY.chambers.length, 'chamber letters');
  const zakazane = ['moss', 'root', 'roots', 'leaf', 'leaves', 'stone', 'cub', 'grown', 'sleepy', 'awake', 'hungry', 'fed', 'den', 'burrow', 'earth', 'left', 'right', 'top', 'bottom', 'north', 'south', 'east', 'west'];
  for (const w of [...BANKY.foxes, ...BANKY.chambers]) for (const s of w.toLowerCase().split(/[\s-]+/)) assert(!zakazane.includes(s), 'forbidden word in a name: ' + w);
  for (const f of ['Tod', 'Todd', 'Reynard', 'Vixey', 'Swiper', 'Nick', 'Foxy', 'Tails']) assert(!BANKY.foxes.includes(f), 'famous fox ' + f);
  const dormice = JSON.parse(readFileSync(join(TU, '..', 'dormice', 'banka-slov.json'), 'utf8'));
  const dSlova = new Set(['who', 'what', 'where'].flatMap((k) => dormice[k]).flatMap((w) => w.toLowerCase().split(/\s+/)));
  for (const w of Object.values(banky).flat()) for (const s of w.toLowerCase().split(/[\s-]+/)) assert(!dSlova.has(s), 'a Dormice word: ' + s + ' in ' + w);
});

test('13c. 500 seeds draw a hard cast (six foxes, six chambers) with all first letters different, never failing', () => {
  let zlyhania = 0;
  for (let i = 0; i < 500; i++) {
    const o = vyberObsadenie(mulberry32(seedFromString('banky/' + i)), 6, 6);
    if (!o) { zlyhania++; continue; }
    const pismena = [...o.lisky.map((x) => BANKY.foxes[x]), ...o.komory.map((x) => BANKY.chambers[x])].map((w) => w[0].toUpperCase());
    if (new Set(pismena).size !== pismena.length) zlyhania++;
  }
  eq(zlyhania, 0);
  for (const { p } of VSETKY) {
    const pismena = [...p.mena, ...p.menaKomor].map((w) => w[0].toUpperCase());
    eq(new Set(pismena).size, pismena.length, p.date + ' letters');
  }
});

/* ── 4. Texts ──────────────────────────────────────────────────────────── */
const SUBORY = ['generator.mjs', 'plan.mjs', 'logika.mjs', 'plocha.mjs', 'game.js', 'index.html', 'zoznamy.js', 'guide/index.html']
  .map((f) => join(TU, f)).filter((f) => existsSync(f));
const ZAKAZANE = ['murdoku', 'murdle', 'vraždoku', 'vrazdoku', 'cluedo', 'murder', 'victim', 'weapon', 'kill', 'dead', 'blood', 'crime', 'suspect', 'steal', 'stole', 'thief'];
const vsetkyVety = [];
for (const { u, p } of VSETKY.filter((x, i) => i % 3 === 0)) {
  for (const cl of p.clues) vsetkyVety.push(textIndicie(p, cl));
  const h = solveHuman(p, { maxVrstva: OPTS[u].maxVrstva, texty: true });
  for (const k of h.steps) vsetkyVety.push(k.text, k.textBezHodnoty);
  vsetkyVety.push(vetaRozuzlenia(p));
}

test('14. every clue sentence has at most 14 words, and no dash anywhere a player reads', () => {
  eq(MAX_SLOV, 14);
  for (const { p } of VSETKY) for (const cl of p.clues) assert(pocetSlov(textIndicie(p, cl)) <= 14, textIndicie(p, cl));
  for (const f of SUBORY) { const t = readFileSync(f, 'utf8'); assert(!/[–—]/.test(t), 'a dash in ' + f); }
  for (const v of vsetkyVety) assert(!/[–—]/.test(v), 'a dash in: ' + v);
});

test('15. no forbidden string in the files a player reads or in any step and hint sentence', () => {
  for (const f of SUBORY) {
    const t = readFileSync(f, 'utf8').toLowerCase();
    for (const z of ZAKAZANE) assert(!t.includes(z), '"' + z + '" in ' + f);
  }
  for (const v of vsetkyVety) for (const z of ZAKAZANE) assert(!v.toLowerCase().includes(z), '"' + z + '" in: ' + v);
  console.log('     sentences checked: ' + vsetkyVety.length);
});

/* ── 5. The packed record ──────────────────────────────────────────────── */
test('zbal and rozbal round trip every lair', () => {
  for (const { u, p } of VSETKY) {
    const z = zbal({ ...p, uroven: u });
    const r = rozbal(JSON.parse(JSON.stringify(z)));
    eq(r.clues, p.clues, 'clues'); eq(r.solution, p.solution, 'solution'); eq(r.komory, p.komory, 'chambers');
    eq(r.kamene, p.kamene, 'stones'); eq(r.znaky, p.znaky, 'marks'); eq(r.mena, p.mena, 'names'); eq(r.menaKomor, p.menaKomor);
    eq(r.vec, p.vec); eq(r.skupina, p.skupina); eq(r.vlastnost, p.vlastnost);
    eq(zbal({ ...r, uroven: u, date: p.date, difficulty: p.difficulty }), z, 'second pack');
  }
});

test('16. rozbal refuses a damaged record', () => {
  const p = DAVKA.hard[0];
  const z = zbal({ ...p, uroven: 'hard' });
  const zle = (uprav, co) => {
    const x = JSON.parse(JSON.stringify(z));
    uprav(x);
    let hodil = false;
    try { rozbal(x); } catch (e) { hodil = /Bad packed puzzle/.test(e.message); }
    assert(hodil, 'accepted: ' + co);
  };
  zle((x) => { x.r = x.r.slice(1); }, 'wrong length');
  zle((x) => { // a chamber cut in two: swap one cell far away
    const n = x.n, pole = x.r.split('');
    const k = pole[0];
    const daleko = pole.findIndex((ch, i) => ch !== k && ((i / n) | 0) === n - 1 && i % n === n - 1);
    pole[daleko] = k; x.r = pole.join('');
  }, 'chamber not contiguous');
  zle((x) => { const s = x.s.split(',').map(Number); s[1] = s[0] + (s[0] % x.n === x.n - 1 ? -1 : 1); x.s = s.join(','); }, 'two pieces in a row');
  zle((x) => { const s = x.s.split(','); x.x = x.x ? x.x + ',' + s[0] : s[0]; }, 'a piece on a stone');
  zle((x) => { const c = x.c.split(';'); c[0] = 'I|0|' + ((p.komory[p.solution[0]] + 1) % p.K); x.c = c.join(';'); }, 'a false clue');
  zle((x) => { x.c = Array.from({ length: 14 }, (_, i) => 'B|' + (i % 2)).join(';'); x.u = 'hard'; }, 'over the ceiling');
  zle((x) => { const [bank, cast] = x.b.split(':'); const casti = cast.split('/'); const l = casti[0].split(','); l[1] = l[0]; casti[0] = l.join(','); x.b = bank + ':' + casti.join('/'); }, 'the same name twice');
  zle((x) => { // Flint and flint-like letters: a fox and a chamber with one letter
    const [bank, cast] = x.b.split(':'); const casti = cast.split('/');
    const komory = casti[1].split(',');
    const pismenoLisky = BANKY.foxes[+casti[0].split(',')[0]][0].toLowerCase();
    const iny = BANKY.chambers.findIndex((w) => w[0] === pismenoLisky);
    if (iny < 0) { x.b = 'foxes-0:' + cast; return; }
    komory[0] = String(iny); casti[1] = komory.join(','); x.b = bank + ':' + casti.join('/');
  }, 'two first letters the same');
  zle((x) => {
    // two foxes in the chamber of the thing: move a fox into it where the row and column allow
    const n = x.n, s = x.s.split(',').map(Number), V = n - 1, kVec = p.komory[s[V]];
    for (let q = 0; q < V; q++) {
      for (let q2 = 0; q2 < V; q2++) {
        if (q2 === q) continue;
        const a = (((s[q] / n) | 0) * n) + (s[q2] % n), b = (((s[q2] / n) | 0) * n) + (s[q] % n);
        const t = s.slice(); t[q] = a; t[q2] = b;
        const v = t.filter((c, i) => i < V && p.komory[c] === kVec).length;
        if (v >= 2 && !p.kamene.includes(a) && !p.kamene.includes(b)) { x.s = t.join(','); x.c = ''; return; }
      }
    }
    x.s = 'x';
  }, 'two foxes with the thing');
});

test('the plan: the week, the ranks and the practice sets', () => {
  eq(urovenDna('2026-09-21'), 'easy'); eq(urovenDna('2026-09-23'), 'medium'); eq(urovenDna('2026-09-25'), 'hard'); eq(urovenDna('2026-09-27'), 'challenge');
  eq(PRVY_DEN, '2025-09-10'); eq(KANDIDATOV, 6);
  eq(SADY.length, 9); assert(SADY.every((s) => s.pocet === 8 && s.uroven !== 'challenge'));
  eq(obtiaznost({ difficulty: { layers: { 1: 5, 2: 3, 3: 1 } } }), 1003005);
  const d = zadaniePreDen('2026-09-23');
  eq(zbal(d), zbal(zadaniePreDen('2026-09-23')), 'zadaniePreDen is deterministic');
  eq(d.uroven, 'medium'); eq(d.n, 6);
  const c = zadanieCvicenie('easy-2', 3);
  eq(c.n, 5); eq(c.uroven, 'easy');
  assert(pekneDatum('2026-09-25') === 'Friday 25 September 2026');
});

/* ── 6. Time ───────────────────────────────────────────────────────────── */
test('17. a whole day of the slowest level (six challenge candidates) stays under 4 s', () => {
  const casy = [];
  let d = '2026-09-27';
  for (let i = 0; i < 8; i++, d = posunDen(d, 7)) {
    assert(denVTyzdni(d) === 6, 'not a Sunday');
    const t0 = performance.now();
    zadaniePreDen(d);
    casy.push(Math.round(performance.now() - t0));
  }
  console.log('     Sunday, six candidates, ms: ' + JSON.stringify(stat(casy)));
  assert(Math.max(...casy) < 4000, 'slowest Sunday ' + Math.max(...casy) + ' ms');
});

test('the profiles give the sizes of the spec', () => {
  eq([PROFILY.easy.n, PROFILY.medium.n, PROFILY.hard.n, PROFILY.challenge.n], [5, 6, 7, 7]);
  eq([PROFILY.easy.strop, PROFILY.medium.strop, PROFILY.hard.strop, PROFILY.challenge.strop], [9, 11, 13, 15]);
  eq(PROFIL(7, 3).vyzadujeL3, true);
  const S = struktura(DAVKA.easy[0]);
  eq(pripravIndicie(S, DAVKA.easy[0].clues).length, DAVKA.easy[0].clues.length);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
