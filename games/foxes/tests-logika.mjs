/* Tests for logika.mjs and plocha.mjs, the rules the page shares with the
 * solver: node products/arling-sk/games/foxes/tests-logika.mjs
 * No framework. Prints "N passed, M failed" and exits 1 if anything fails.
 * Fourteen days, every level, as ops/spec-foxes.md part 15 asks.
 */
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { zadaniePreDen, posunDen, PRVY_DEN, rozbal, zbal } from './plan.mjs';
import { vetaRozuzlenia, drzitel, platneRozlozenie, menoKusu, struktura, pripravIndicie, krok, bunkyKusa, MAX_RETAZ } from './generator.mjs';
import {
  prazdnaPlocha, kopiaPlochy, premisy, porovnaj, jeVyriesene, autoKriz, napoveda, pouziNapovedu, polozKus, NEDAVNE,
} from './logika.mjs';
import { plochaHTML, legendaHTML, obsadenieHTML, indicieHTML, padHTML, uvodText, otazkaText, prveBunkyKomor, coMenuje } from './plocha.mjs';

const TU = dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + ': ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
const velke = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const DNI = Array.from({ length: 14 }, (_, i) => posunDen(PRVY_DEN, i));
const DAVKA = DNI.map((d) => rozbal(JSON.parse(JSON.stringify(zbal(zadaniePreDen(d))))));
console.log('built ' + DAVKA.length + ' days, ' + DAVKA.map((p) => p.uroven[0]).join('') + '\n');

function riesenaPlocha(p) {
  const pl = prazdnaPlocha(p);
  p.solution.forEach((c, q) => { pl.k[c] = q; });
  return pl;
}
/* Every hint from an empty board to the end, with a check of each action. */
const PREHRAVKY = DAVKA.map((p) => {
  let pl = prazdnaPlocha(p);
  const hinty = [];
  for (let i = 0; i < 400; i++) {
    const h = napoveda(pl, p);
    if (!h) break;
    hinty.push(h);
    pl = pouziNapovedu(pl, p, h);
  }
  return { p, pl, hinty };
});

/* ── 1. Hints ───────────────────────────────────────────────────────────── */
test('no hint ever contradicts the solution', () => {
  for (const { p, hinty } of PREHRAVKY) {
    const sol = new Set(p.solution);
    for (const h of hinty) {
      assert(h.druh !== 'chyba' && h.druh !== 'odhalenie', p.date + ': a ' + h.druh + ' on a board played by hints alone');
      if (h.druh === 'poloz') assert(p.solution[h.kus] === h.bunky[0], p.date + ': a piece put on the wrong cell');
      if (h.druh === 'poznamky') assert(h.poznamky.includes(p.solution[h.kus]), p.date + ': notes that leave out the solution');
      if (h.druh === 'kriz') for (const c of h.bunky) assert(!sol.has(c), p.date + ': a cross on a solution cell');
    }
  }
});

test('hints alone carry an empty board to a solved lair', () => {
  for (const { p, pl, hinty } of PREHRAVKY) assert(jeVyriesene(pl, p), p.date + ' (' + p.uroven + ') not solved after ' + hinty.length + ' hints');
  console.log('     hints per lair: ' + PREHRAVKY.map((x) => x.p.uroven[0] + x.hinty.length).join(' '));
});

test('the second press names every piece it writes notes for, and says where the crosses go (critic 25. 9., finding 4)', () => {
  for (const { p, hinty } of PREHRAVKY) {
    for (const h of hinty) {
      if (h.druh === 'poznamky') {
        assert(h.zapisy && h.zapisy.length && h.zapisy[0].kus === h.kus, p.date + ': notes without zapisy');
        for (const z of h.zapisy) assert(h.text2.includes(menoKusu(p, z.kus)) || h.text2.includes(velke(menoKusu(p, z.kus))), p.date + ': notes for ' + menoKusu(p, z.kus) + ' in: ' + h.text2);
      }
      const kriz = h.kriz || [];
      if (kriz.length && !/is empty, so every cell/.test(h.text2)) assert(/gets a cross|get crosses/.test(h.text2), p.date + ': crosses nobody explains: ' + h.text2);
    }
  }
});

test('no hint sentence comes back word for word in one lair', () => {
  for (const { p, hinty } of PREHRAVKY) {
    const videne = new Set();
    for (const h of hinty) { assert(!videne.has(h.text2), p.date + ': repeated: ' + h.text2); videne.add(h.text2); }
  }
});

test('a hint cites at most two earlier clues, never the clue it reads itself', () => {
  for (const { p, hinty } of PREHRAVKY) for (const h of hinty) {
    const c = h.citovane || [];
    assert(c.length <= 2 && c.every((x) => x !== h.cislo) && new Set(c).size === c.length, p.date + ': cited ' + JSON.stringify(c) + ' for clue ' + h.cislo);
  }
});

test('the first press never names the fox the step is about, nor any fox', () => {
  for (const { p, hinty } of PREHRAVKY) {
    for (const h of hinty) for (const meno of p.mena) assert(!new RegExp('\\b' + meno + '\\b').test(h.text1), p.date + ': "' + meno + '" in: ' + h.text1);
  }
});

test('every hint has two sentences and outlines only cells of the board', () => {
  for (const { p, hinty } of PREHRAVKY) {
    for (const h of hinty) {
      assert(h.text1 && h.text2 && h.text1 !== h.text2, 'empty or equal sentences');
      for (const c of h.oblast) assert(c >= 0 && c < p.n * p.n, 'outline off the board');
    }
  }
});

test('on a board with a wrong fox, a wrong cross or wrong notes, the first hint shows exactly that', () => {
  for (const p of DAVKA) {
    const n = p.n;
    // a wrong fox: fox 0 one cell off its place (not on a stone)
    const kamen = new Set(p.kamene);
    const zlaBunka = [...Array(n * n).keys()].find((c) => c !== p.solution[0] && !kamen.has(c));
    let pl = polozKus(prazdnaPlocha(p), p, 0, zlaBunka);
    let h = napoveda(pl, p);
    assert(h.druh === 'chyba' && h.typ === 'kus' && h.bunky[0] === zlaBunka, p.date + ' wrong fox not found first');
    assert(!pouziNapovedu(pl, p, h).k.includes(0), p.date + ' the wrong fox did not come off');
    // a wrong cross on the cell of the thing
    pl = prazdnaPlocha(p);
    pl.x[p.solution[n - 1]] = 1;
    h = napoveda(pl, p);
    assert(h.druh === 'chyba' && h.typ === 'kriz' && h.bunky[0] === p.solution[n - 1], p.date + ' wrong cross not found first');
    // notes for fox 1 that leave out its cell
    pl = prazdnaPlocha(p);
    for (let c = 0; c < n * n; c++) if (c !== p.solution[1] && !kamen.has(c)) pl.m[c] |= 1 << 1;
    h = napoveda(pl, p);
    assert(h.druh === 'chyba' && h.typ === 'poznamky' && h.kus === 1, p.date + ' wrong notes not found first');
    assert(pouziNapovedu(pl, p, h).m.every((m) => !((m >> 1) & 1)), p.date + ' the wrong notes did not come off');
  }
});

test('a hint from a half played board (correct pieces, crosses and notes) still leads to the end', () => {
  for (const { p, hinty } of PREHRAVKY) {
    // replay the first third of the hints, then add a correct note set by hand
    let pl = prazdnaPlocha(p);
    for (const h of hinty.slice(0, Math.floor(hinty.length / 3))) pl = pouziNapovedu(pl, p, h);
    for (let i = 0; i < 400 && !jeVyriesene(pl, p); i++) {
      const h = napoveda(pl, p);
      assert(h && h.druh !== 'odhalenie', p.date + ' no rule reached from a half played board');
      pl = pouziNapovedu(pl, p, h);
    }
    assert(jeVyriesene(pl, p), p.date + ' not solved');
  }
});

/* ── 2. Check ───────────────────────────────────────────────────────────── */
test('Check never marks an empty cell or a note, and counts only pieces and crosses', () => {
  for (const p of DAVKA) {
    const n = p.n, pl = prazdnaPlocha(p);
    for (let c = 0; c < n * n; c++) pl.m[c] = (1 << n) - 1;   // notes everywhere
    pl.k[p.solution[0]] = 0;                                   // a right fox
    const zla = p.solution[1] % n === 0 ? p.solution[1] + 1 : p.solution[1] - 1;
    pl.k[zla] = 1;                                             // a wrong fox
    pl.x[p.solution[2]] = 1;                                   // a wrong cross
    const r = porovnaj(pl, p);
    for (const z of r.zle) assert(pl.k[z.bunka] >= 0 || pl.x[z.bunka], 'marked a cell with only notes');
    assert(r.zle.some((z) => z.typ === 'kus' && z.bunka === zla), 'the wrong fox was not counted');
    assert(r.zle.some((z) => z.typ === 'kriz' && z.bunka === p.solution[2]), 'the wrong cross was not counted');
    assert(!r.zle.some((z) => z.bunka === p.solution[0]), 'the right fox was counted');
    const len = porovnaj(pl, p, new Set([p.solution[0]]));
    assert(!len.zle.length && len.lisky + len.vec === 1, 'the selection limit did not hold');
  }
});

/* ── 3. Solved ──────────────────────────────────────────────────────────── */
test('jeVyriesene: false on an incomplete board, on a broken clue, with two foxes by the thing; true on the solution', () => {
  let dveNaslo = 0;
  for (const p of DAVKA) {
    const n = p.n;
    const hotova = riesenaPlocha(p);
    assert(jeVyriesene(hotova, p), p.date + ' the solution is not solved');
    const neuplna = kopiaPlochy(hotova);
    neuplna.k[p.solution[n - 1]] = -1;
    assert(!jeVyriesene(neuplna, p), p.date + ' incomplete board solved');
    // every other placement with one piece per row and column breaks something
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        const pos = p.solution.slice();
        const ra = (pos[a] / n) | 0, sa = pos[a] % n, rb = (pos[b] / n) | 0, sb = pos[b] % n;
        pos[a] = ra * n + sb; pos[b] = rb * n + sa;
        if (p.kamene.includes(pos[a]) || p.kamene.includes(pos[b])) continue;
        const pl = prazdnaPlocha(p);
        pos.forEach((c, q) => { pl.k[c] = q; });
        assert(!jeVyriesene(pl, p), p.date + ' a swapped placement counts as solved');
        const kVec = p.komory[pos[n - 1]];
        if (pos.filter((c, q) => q < n - 1 && p.komory[c] === kVec).length >= 2) { dveNaslo++; assert(drzitel(p, pos) < 0); }
      }
    }
  }
  assert(dveNaslo > 0, 'no swap put two foxes by the thing, the case was never tried');
});

/* ── 4. Auto cross and moving a piece ──────────────────────────────────── */
test('Auto cross never crosses a solution cell after a right piece, and skips stones and pieces', () => {
  for (const p of DAVKA) {
    const sol = new Set(p.solution), kamen = new Set(p.kamene);
    let pl = prazdnaPlocha(p);
    for (let q = 0; q < p.n; q++) {
      pl = polozKus(pl, p, q, p.solution[q]);
      for (const c of autoKriz(pl, p, p.solution[q])) {
        assert(!sol.has(c), p.date + ' Auto cross on a solution cell');
        assert(!kamen.has(c) && pl.k[c] < 0, p.date + ' Auto cross on a stone or a piece');
        pl.x[c] = 1;
      }
    }
    assert(jeVyriesene(pl, p), p.date + ' not solved with auto crosses');
  }
});

test('putting a piece down elsewhere moves it: it stands once, in one step', () => {
  const p = DAVKA[0];
  let pl = polozKus(prazdnaPlocha(p), p, 0, 0);
  pl.m[5] = 1;
  pl.x[5] = 1;
  const po = polozKus(pl, p, 0, 5);
  assert(po.k.filter((x) => x === 0).length === 1 && po.k[5] === 0 && po.k[0] === -1, 'the piece did not move');
  assert(po.x[5] === 0 && po.m[5] === 1, 'the cross stays or the notes went');
  assert(pl.k[0] === 0, 'the board before the move changed: it would not be one clean Undo step');
});

test('premisy: crosses, notes and pieces become the solver state', () => {
  const p = DAVKA[6];
  const n = p.n;
  const pl = prazdnaPlocha(p);
  pl.x[0] = 1;
  pl.k[p.solution[0]] = 0;
  const st = premisy(pl, p);
  for (let q = 0; q < n; q++) assert(!(st.c[q * n] & 1), 'the cross did not remove the cell');
  assert(st.pl[0] === p.solution[0], 'the piece is not placed');
});

/* ── 5. plocha.mjs ──────────────────────────────────────────────────────── */
test('the board markup: n by n cells, one letter per chamber, stones, a row per line', () => {
  for (const p of DAVKA) {
    const h = plochaHTML(p);
    assert((h.match(/class="b /g) || []).length === p.n * p.n, 'cells');
    assert((h.match(/role="row"/g) || []).length === p.n, 'rows');
    assert((h.match(/class="kp"/g) || []).length === p.K, 'chamber letters');
    assert((h.match(/class="kamen-tvar"/g) || []).length === p.kamene.length, 'stones');
    assert((h.match(/tabindex="0"/g) || []).length === 1, 'roving tabindex');
    assert(prveBunkyKomor(p).every((c) => c >= 0), 'a chamber without a first cell');
    assert((legendaHTML(p).match(/<li>/g) || []).length === p.K, 'legend');
    assert((padHTML(p).match(/class="cip/g) || []).length === p.n, 'pad');
    assert((indicieHTML(p, p.clues.map(() => 'x')).match(/<li /g) || []).length === p.clues.length, 'clue list');
    assert(obsadenieHTML(p).includes(p.vec), 'cast without the thing');
    assert(uvodText(p).includes(p.vec) && otazkaText(p).includes(p.vec), 'intro or question without the thing');
  }
});

test('the answer sentence is in no markup before the lair is solved', () => {
  const sablona = readFileSync(join(TU, 'index.html'), 'utf8');
  for (const p of DAVKA) {
    const veta = vetaRozuzlenia(p);
    for (const kus of [plochaHTML(p), legendaHTML(p), obsadenieHTML(p), padHTML(p), uvodText(p), otazkaText(p), sablona]) assert(!kus.includes(veta), 'answer in markup');
    assert(!sablona.includes(' has the ' + p.vec + ', in '), 'the template carries an answer');
  }
});

test('what a clue names stays on the board and among the pieces', () => {
  for (const p of DAVKA) {
    for (const cl of p.clues) {
      const x = coMenuje(p, cl, null);
      for (const c of x.bunky) assert(c >= 0 && c < p.n * p.n);
      for (const q of x.kusy) assert(q >= 0 && q < p.n);
    }
  }
  assert(platneRozlozenie(DAVKA[0], DAVKA[0].solution));
});

/* ── 6. The page ──────────────────────────────────────────────────────── */
test('the page numbers only the clue list, and folds the intro and the cast away on a phone', () => {
  const html = readFileSync(join(TU, 'index.html'), 'utf8');
  const styl = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  // no rule may reach every li of the clue box: the cast is a <ul> in it
  assert(!/\.indicie li\b/.test(styl), 'a rule on ".indicie li" would number the cast too');
  assert(/\.indicie ol > li\{counter-increment:ind/.test(styl), 'the clue counter is not on "ol > li"');
  assert(/\.indicie ol > li::before\{content:counter\(ind\)/.test(styl), 'the clue number is not on "ol > li::before"');
  assert(/@media \(max-width:860px\)\{\s*\.hero\{gap:26px\}\s*#indicie\{[^}]*\}\s*\.indicie \.uvod,\.indicie \.obsadenie\{display:none\}/.test(styl), 'the intro and the cast are not folded away on a phone');
  assert(html.includes('id="citac"') && html.includes('id="citac-text"'), 'the clue reader under the board is missing');
  for (const p of DAVKA) assert((padHTML(p).match(/class="vl"/g) || []).length === p.n - 1, p.date + ': a fox chip without its trait');
});

/* ── 7. og.png and the GIFs give nothing away ─────────────────────────── */
test('og.png and the tutorial GIFs are drawn from lairs that are never published, and og shows no answer', () => {
  // FOXES_TMP moves the scratch folder, as in og.mjs and gify.mjs.
  const tmp = mkdtempSync(join(process.env.FOXES_TMP || tmpdir(), 'foxes-test-'));
  const koren = join(TU, '..', '..', '..', '..');
  try {
    const env = { ...process.env, FOXES_TMP: tmp };
    execFileSync(process.execPath, [join(koren, 'ops', 'games', 'foxes', 'og.mjs'), '--data'], { cwd: koren, env, stdio: 'pipe' });
    const og = JSON.parse(readFileSync(join(tmp, 'og', 'og-data.json'), 'utf8'));
    assert(og.den < PRVY_DEN, 'og.png from a published day: ' + og.den);
    const p = zadaniePreDen(og.den);
    const V = p.n - 1, f = drzitel(p, p.solution), k = p.komory[p.solution[V]];
    assert(og.kusy.length >= 2, 'og.png shows fewer than two foxes');
    for (const x of og.kusy) assert(x.p !== V && x.p !== f && p.komory[x.c] !== k, 'og.png shows the thing, its holder or a fox in its chamber');
    for (const x of og.poznamky) assert(!((x.m >> V) & 1) && !((x.m >> f) & 1) && p.komory[x.c] !== k, 'og.png shows notes of the thing or its holder, or in its chamber');
    for (const c of og.kriziky) assert(p.komory[c] !== k, 'og.png shows a cross in the chamber of the thing');
    execFileSync(process.execPath, [join(koren, 'ops', 'games', 'foxes', 'gify.mjs'), '--data'], { cwd: koren, env, stdio: 'pipe' });
    for (const m of ['rule-01', 'rule-02', 'rule-03']) {
      const g = JSON.parse(readFileSync(join(tmp, 'gify', m + '.json'), 'utf8'));
      assert(g.den < PRVY_DEN, m + '.gif from a published day: ' + g.den);
    }
  } finally {
    try { rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* Windows */ }
  }
});

/* ── 8. Citations, outlines and the ladder (critic 25. 9., round 2) ───── *
 * Sixty published days of medium and up, every third one of 2026, as the
 * critic's citacie-miera.mjs picked them, read from the record in dni/. */
const ZAZNAMY = readdirSync(join(TU, 'dni')).filter((f) => /^2026-\d\d\.json$/.test(f)).sort()
  .flatMap((f) => JSON.parse(readFileSync(join(TU, 'dni', f), 'utf8')));
const SEDESIAT = ZAZNAMY.filter((z) => z.u !== 'easy').filter((_, i) => i % 3 === 0).slice(0, 60).map((z) => rozbal(z));
/* One pass of a clue about two pieces, written again here on purpose: the
   test does not borrow the code it checks. */
function revizia(n, c, p, q, T) {
  for (let r = 0; r < n; r++) {
    let nove = c[p * n + r];
    for (let s = 0; s < n; s++) {
      if (!((nove >> s) & 1)) continue;
      let ok = false;
      for (let rr = 0; rr < n && !ok; rr++) if (c[q * n + rr] & T[(r * n + s) * n + rr]) ok = true;
      if (!ok) nove &= ~(1 << s);
    }
    c[p * n + r] = nove;
  }
}
const niektoMa = (c, n, bunka) => { for (let q = 0; q < n; q++) if ((c[q * n + ((bunka / n) | 0)] >> (bunka % n)) & 1) return true; return false; };

test('a clue about two pieces cites a quiet clue only when the step needs it, and always one it rests on (60 days)', () => {
  let parov = 0, sOporou = 0, bez = 0, citovanych = 0, zbytocnych = 0;
  const priklady = [];
  for (const p of SEDESIAT) {
    const n = p.n, S = struktura(p), I = pripravIndicie(S, p.clues);
    let pl = prazdnaPlocha(p);
    for (let i = 0; i < 200 && !jeVyriesene(pl, p); i++) {
      const h = napoveda(pl, p);
      if (h.pravidlo === 'pair' && h.druh !== 'poloz') {
        // The solver again from the board, to the step whose result the hint
        // writes; every quiet clue on the way, with the cells it took.
        const st = premisy(pl, p, S);
        const tiche = new Map();
        let pred = null;
        for (let g = 0; g < 600; g++) {
          const pc = st.c.slice();
          const k = krok(S, I, st, 3, MAX_RETAZ);
          if (!k) break;
          const zmenil = h.zapisy.some((z) => { for (let r = 0; r < n; r++) if (pc[z.kus * n + r] !== st.c[z.kus * n + r]) return true; return false; })
            || h.kriz.some((c) => niektoMa(pc, n, c) && !niektoMa(st.c, n, c));
          if (k.rule === 'pair' && k.clue === h.cislo && zmenil && h.zapisy.every((z) => bunkyKusa(S, st, z.kus).join() === z.bunky.join())
            && h.kriz.every((c) => !niektoMa(st.c, n, c))) { pred = pc; break; }
          // a clue about who has the thing is never cited (logika.mjs)
          if (k.clue >= 0 && p.clues[k.clue].t !== 'HOLDER') {
            const v = tiche.get(k.clue) || new Uint8Array(st.c.length);
            for (let j = 0; j < v.length; j++) v[j] |= pc[j] & ~st.c[j];
            tiche.set(k.clue, v);
          }
        }
        assert(pred, p.date + ' #' + (i + 1) + ': the step of the hint was not found');
        parov++;
        const X = I[h.cislo], pise = new Set(h.zapisy.map((z) => z.kus)), krizy = new Set(h.kriz);
        const tvrde = new Set(), ine = new Set();
        for (const [c, v] of tiche) {
          if (c === h.cislo) continue;
          // the step rests on it: give its cells back, run the clue again, and
          // a cell the step took from a piece it writes (or crosses) stays
          const cc = pred.slice();
          for (let j = 0; j < cc.length; j++) cc[j] |= v[j];
          revizia(n, cc, X.p, X.q, X.F);
          revizia(n, cc, X.q, X.p, X.B);
          for (const w of [X.p, X.q]) for (let r = 0; r < n; r++) {
            const ostalo = cc[w * n + r] & pred[w * n + r] & ~st.c[w * n + r];
            for (let s = 0; s < n; s++) if (((ostalo >> s) & 1) && (pise.has(w) || krizy.has(r * n + s))) tvrde.add(c);
          }
          // or at least it took a cell of a piece the hint writes, or a cell
          // the hint now crosses (the critic's "own" cells)
          for (const w of pise) for (let r = 0; r < n; r++) if (v[w * n + r]) ine.add(c);
          for (const b of krizy) for (let q = 0; q < n; q++) if ((v[q * n + ((b / n) | 0)] >> (b % n)) & 1) ine.add(c);
        }
        const cit = h.citovane || [];
        citovanych += cit.length;
        if (tvrde.size) {
          sOporou++;
          if (!cit.some((c) => tvrde.has(c))) { bez++; priklady.push(p.date + ' #' + (i + 1) + ' needs ' + [...tvrde].map((c) => c + 1) + ', cites ' + cit.map((c) => c + 1)); }
        }
        for (const c of cit) if (!tvrde.has(c) && !ine.has(c)) { zbytocnych++; priklady.push(p.date + ' #' + (i + 1) + ' cites ' + (c + 1) + ' for nothing: ' + h.text1); }
      }
      pl = pouziNapovedu(pl, p, h);
    }
  }
  console.log('     60 days: ' + parov + ' hints on a clue about two pieces, ' + sOporou + ' rest on a quiet clue, ' + bez + ' of them cite none of those; '
    + citovanych + ' citations, ' + zbytocnych + ' for nothing');
  assert(sOporou > 0, 'no hint rested on a quiet clue, the case was never tried');
  assert(!bez && !zbytocnych, priklady.slice(0, 6).join(' | '));
});

test('two cited clues about the same two pieces make one clause', () => {
  for (const { p, hinty } of PREHRAVKY) for (const h of hinty) {
    const m = /^Clue (\d+) [^.]*?, and clue (\d+) links (.+?) and (.+?)\./.exec(h.text2);
    if (!m) continue;
    const a = p.clues[+m[1] - 1], b = p.clues[+m[2] - 1];
    assert(!(a.p !== undefined && a.q !== undefined && new Set([a.p, a.q, b.p, b.q]).size === 2), p.date + ': ' + h.text2);
  }
});

test('every first press outlines something: cells, or the chips of the pieces its clue names (critic 25. 9., round 2, finding 4)', () => {
  let bezPlochy = 0, spolu = 0;
  const vsetky = [...PREHRAVKY.map((x) => ({ p: x.p, hinty: x.hinty })), ...SEDESIAT.slice(0, 30).map((p) => {
    let pl = prazdnaPlocha(p);
    const hinty = [];
    for (let i = 0; i < 200 && !jeVyriesene(pl, p); i++) { const h = napoveda(pl, p); hinty.push(h); pl = pouziNapovedu(pl, p, h); }
    return { p, hinty };
  })];
  for (const { p, hinty } of vsetky) for (const h of hinty) {
    spolu++;
    if (!h.oblast.length) bezPlochy++;
    assert(h.oblast.length || (h.tipKusy && h.tipKusy.length), p.date + ': nothing outlined for a ' + h.pravidlo + ' hint');
    // "The cellar is empty." names no piece, only its chamber
    if (h.cislo >= 0 && p.clues[h.cislo].t !== 'EMPTY') assert(h.tipKusy && h.tipKusy.length, p.date + ': a hint on clue ' + (h.cislo + 1) + ' outlines no chip');
    for (const q of h.tipKusy || []) assert(q >= 0 && q < p.n, 'a chip off the pad');
    if (h.pravidlo === 'trial') assert(h.oblast.length === 2, p.date + ': a trial outlines ' + h.oblast.length + ' cells, not its two');
  }
  console.log('     ' + spolu + ' hints, ' + bezPlochy + ' of them outline chips only');
});

test('with the hints taken so far, a clue that comes round again for the same piece says "again", and hints still only follow the solution', () => {
  let znova = 0, dalej = 0;
  const dni = [...DAVKA, ...SEDESIAT.slice(0, 20), rozbal(ZAZNAMY.find((z) => z.d === '2026-09-25'))];
  for (const p of dni) {
    let pl = prazdnaPlocha(p);
    const nedavne = [], sol = new Set(p.solution), videne = new Set();
    for (let i = 0; i < 400 && !jeVyriesene(pl, p); i++) {
      const h = napoveda(pl, p, { nedavne });
      assert(h && h.druh !== 'chyba' && h.druh !== 'odhalenie', p.date + ': a ' + (h && h.druh) + ' with history');
      if (h.druh === 'poloz') assert(p.solution[h.kus] === h.bunky[0], p.date + ': a piece on the wrong cell');
      for (const z of h.zapisy) assert(z.bunky.includes(p.solution[z.kus]), p.date + ': notes that leave out the solution');
      for (const c of h.kriz) assert(!sol.has(c), p.date + ': a cross on a solution cell');
      assert(!videne.has(h.text2), p.date + ': repeated: ' + h.text2);
      videne.add(h.text2);
      if (/ again: /.test(h.text2)) {
        znova++;
        if (h.cisla.length > 1) dalej++;
        assert(nedavne.slice(-NEDAVNE).some((x) => x.cisla.includes(h.cislo) && h.zapisy.some((z) => x.kusy.includes(z.kus))), p.date + ': "again" with no recent hint on that clue and piece');
        for (const z of h.zapisy) assert(h.text2.includes(menoKusu(p, z.kus)) || h.text2.includes(velke(menoKusu(p, z.kus))), p.date + ': notes for a piece the sentence does not name');
        assert(/links two of them again/.test(h.text1), p.date + ': the first press does not say "again"');
      }
      nedavne.push({ cisla: h.cisla, kusy: h.zapisy.map((z) => z.kus) });
      pl = pouziNapovedu(pl, p, h);
    }
    assert(jeVyriesene(pl, p), p.date + ' not solved with history');
  }
  // the day the critic counted: 36 hints, the first fox at the 26th
  const z = rozbal(ZAZNAMY.find((x) => x.d === '2026-09-25'));
  const hraj = (sHistoriou) => {
    let pl = prazdnaPlocha(z), prva = 0, i = 0;
    const nedavne = [];
    for (; i < 200 && !jeVyriesene(pl, z); i++) {
      const h = napoveda(pl, z, sHistoriou ? { nedavne } : {});
      nedavne.push({ cisla: h.cisla, kusy: h.zapisy.map((x) => x.kus) });
      pl = pouziNapovedu(pl, z, h);
      if (!prva && pl.k.some((x) => x >= 0)) prva = i + 1;
    }
    return { hinty: i, prva };
  };
  const bez = hraj(false), s = hraj(true);
  console.log('     "again" hints: ' + znova + ', running on through more clues: ' + dalej + '; 2026-09-25: ' + bez.hinty + ' hints, first fox at ' + bez.prva + ' without history, ' + s.hinty + ' and ' + s.prva + ' with it');
  assert(znova > 0 && dalej > 0, 'the ladder case was never tried');
  assert(s.hinty < bez.hinty && s.prva < bez.prva, '2026-09-25 is no shorter with history');
});

test('the page: the board fits a wide screen, a phone has every control in one grid, a solved lair hides its notes, built pages say "Play this lair"', () => {
  const html = readFileSync(join(TU, 'index.html'), 'utf8');
  const styl = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  // 26. 9.: only the board shrinks by the height, on every screen; the
  // column keeps its width, and the height rule has a floor everywhere.
  assert(/body\.noc\.hra \.hra \.doska-obal\{--dw:100%;width:var\(--dw\);margin-inline:calc\(\(100% - var\(--dw\)\) \/ 2\)\}/.test(styl), 'the board does not take its size from --dw');
  assert(/@media \(min-width:1100px\)\{ body\.noc\.hra \.hra \.doska-obal\{--dw:min\(100%,max\(360px,calc\(100vh - 440px\)\)\)\} \}/.test(styl), 'no height rule for the board on a wide screen');
  assert(/max\(300px,calc\(100svh - 400px\)\)/.test(styl) && /max\(280px,calc\(100svh - 420px\)\)/.test(styl), 'no height rule for the board on a tablet or a phone');
  assert(!/body\.hra \.hero #hra\.hra\{width:min/.test(styl), 'the wide screen narrows the whole column again');
  assert(!/\.cip \.vl\{display:none\}/.test(styl), 'a chip hides its trait again');
  assert(/\.hotovo \.pozn,\.hotovo \.kriz\{visibility:hidden\}/.test(styl), 'a solved lair keeps its notes and crosses');
  assert(/\.vstup > \.pad:not\(\[hidden\]\),\.vstup > \.nastroje:not\(\[hidden\]\),\.vstup > \.ovladanie\{display:contents\}/.test(styl), 'the phone grid of the controls is missing');
  const a = html.indexOf('<div class="vstup">'), b = html.indexOf('id="pad"'), c = html.indexOf('id="nastroje"'), d = html.indexOf('class="ovladanie"'), e = html.indexOf('<p class="stav"');
  assert(a >= 0 && a < b && b < c && c < d && d < e, 'the pad, the marks and the buttons are not inside .vstup');
  assert(/\.cip\.tip-kus\{/.test(styl) && readFileSync(join(TU, 'game.js'), 'utf8').includes("classList.add('tip-kus')"), 'the first press outlines no chip');
  assert(html.includes('Play today\'s lair'), 'the game page lost "Play today\'s lair"');
  for (const f of [join('practice', 'easy-1', 'index.html'), join('practice', 'hard-3', '8', 'index.html')]) {
    const t = readFileSync(join(TU, f), 'utf8');
    assert(t.includes('Play this lair') && !t.includes('Play today\'s lair'), f + ' says "Play today\'s lair"');
  }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
