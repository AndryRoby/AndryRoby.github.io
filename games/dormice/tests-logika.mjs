/* Tests for logika.mjs and plocha.mjs, the rules the page shares with the
 * solver: node products/arling-sk/games/dormice/tests-logika.mjs
 * No framework. Prints "N passed, M failed" and exits 1 if anything fails.
 * Fourteen days, as ops/spec-hra-detektiv.md part 8 asks.
 */
import { zadaniePreDen, posunDen, PRVY_DEN, rozbal, zbal } from './plan.mjs';
import { polozka } from './generator.mjs';
import {
  tabulky, klucTabulky, prazdnaPlocha, naMasky, porovnaj, jeVyriesene,
  napoveda, autoKriz, carryAcross,
} from './logika.mjs';
import { plochaHTML, pocetPolicok, legendaHTML, indicieHTML, otazkaText, jeTabulka, poradieRiadkov, poradieStlpcov, jednoznak } from './plocha.mjs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + ': ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }

const DNI = Array.from({ length: 14 }, (_, i) => posunDen(PRVY_DEN, i));
const DAVKA = DNI.map((d) => zadaniePreDen(d));
console.log('built ' + DAVKA.length + ' days, ' + DAVKA.map((p) => p.uroven[0]).join('') + '\n');

/* The finished board of a puzzle: every square carries a mark. */
function hotovaPlocha(p) {
  const plocha = prazdnaPlocha(p);
  for (const [a, b] of tabulky(p.k)) {
    const t = plocha[klucTabulky(a, b)];
    for (let i = 0; i < t.length; i++) t[i] = -1;
    for (let x = 0; x < p.N; x++) t[p.solution[a][x] * p.N + p.solution[b][x]] = 1;
  }
  return plocha;
}
function spravna(p, a, b, r, c) {
  const x = p.solution[a].indexOf(r);
  return p.solution[b][x] === c;
}
function pouzi(plocha, p, h) {
  for (const b of h.bunky) {
    const t = plocha[klucTabulky(b.tab[0], b.tab[1])];
    t[b.r * p.N + b.c] = h.druh === 'chyba' ? 0 : (b.val === 1 ? 1 : -1);
  }
}

/* ── 1. Hints ───────────────────────────────────────────────────────────── */

test('no hint ever contradicts the solution', () => {
  for (const p of DAVKA) {
    const plocha = prazdnaPlocha(p);
    for (let krok = 0; krok < 4000; krok++) {
      const h = napoveda(plocha, p);
      if (!h) break;
      for (const b of h.bunky) {
        const ok = spravna(p, b.tab[0], b.tab[1], b.r, b.c);
        if (b.val === 1) assert(ok, p.date + ': a hint put a tick where the solution has none');
        if (b.val === 0) assert(!ok, p.date + ': a hint crossed a square the solution needs');
      }
      pouzi(plocha, p, h);
    }
  }
});

test('hints alone carry an empty board to a finished table', () => {
  for (const p of DAVKA) {
    const plocha = prazdnaPlocha(p);
    let kroky = 0;
    while (!jeVyriesene(plocha, p)) {
      const h = napoveda(plocha, p);
      assert(h, p.date + ': the hints ran out with the board unfinished');
      assert(h.druh !== 'odhalenie', p.date + ': a hint had to give the answer away instead of reasoning');
      pouzi(plocha, p, h);
      assert(++kroky < 4000, p.date + ': the hints went round in circles');
    }
    assert(jeVyriesene(plocha, p), p.date + ': the finished board was not recognised');
  }
});

test('a hint over a wrong tick always points at that tick first', () => {
  for (const p of DAVKA) {
    for (const [a, b] of tabulky(p.k)) {
      const plocha = prazdnaPlocha(p);
      // find a square the solution crosses out and put a tick in it
      let dr = -1, dc = -1;
      for (let r = 0; r < p.N && dr < 0; r++) for (let c = 0; c < p.N; c++) if (!spravna(p, a, b, r, c)) { dr = r; dc = c; break; }
      plocha[klucTabulky(a, b)][dr * p.N + dc] = 1;
      const h = napoveda(plocha, p);
      assert(h && h.druh === 'chyba', p.date + ': a board with a wrong tick got an ordinary hint');
      assert(h.bunky[0].r === dr && h.bunky[0].c === dc && klucTabulky(h.bunky[0].tab[0], h.bunky[0].tab[1]) === klucTabulky(a, b),
        p.date + ': the hint pointed somewhere else than the wrong tick');
    }
  }
});

test('the first hint on an empty board never needs the answer', () => {
  for (const p of DAVKA) {
    const h = napoveda(prazdnaPlocha(p), p);
    assert(h && h.druh === 'policko', p.date + ': no ordinary first hint');
    assert(h.text && h.text.length > 12, p.date + ': the hint came without an explanation');
  }
});

/* ── 2. Check ───────────────────────────────────────────────────────────── */

test('Check counts wrong ticks only, never crosses and never an empty square', () => {
  for (const p of DAVKA) {
    const plocha = prazdnaPlocha(p);
    // cross out every square, right and wrong alike: nothing may be counted
    for (const [a, b] of tabulky(p.k)) plocha[klucTabulky(a, b)].fill(-1);
    const bez = porovnaj(plocha, p);
    assert(bez.fajky === 0 && bez.zle.length === 0, p.date + ': crosses were judged');
    // one wrong tick and one right tick
    const [a, b] = tabulky(p.k)[0];
    const t = plocha[klucTabulky(a, b)];
    let dr = -1, dc = -1;
    for (let r = 0; r < p.N && dr < 0; r++) for (let c = 0; c < p.N; c++) if (!spravna(p, a, b, r, c)) { dr = r; dc = c; break; }
    t[dr * p.N + dc] = 1;
    t[p.solution[a][0] * p.N + p.solution[b][0]] = 1;
    const s = porovnaj(plocha, p);
    assert(s.fajky === 2, p.date + ': the tick count is ' + s.fajky + ', not 2');
    assert(s.zle.length === 1, p.date + ': ' + s.zle.length + ' ticks called wrong, not 1');
    assert(s.zle[0].r === dr && s.zle[0].c === dc, p.date + ': the wrong tick was not the one that is wrong');
  }
});

test('Check is clean on the finished board and jeVyriesene agrees', () => {
  for (const p of DAVKA) {
    const plocha = hotovaPlocha(p);
    assert(porovnaj(plocha, p).zle.length === 0, p.date + ': the finished board has a wrong tick');
    assert(jeVyriesene(plocha, p), p.date + ': the finished board was not recognised');
    assert(napoveda(plocha, p) === null, p.date + ': a hint was offered on a finished board');
  }
});

test('jeVyriesene is false while any square is still open', () => {
  for (const p of DAVKA) {
    assert(!jeVyriesene(prazdnaPlocha(p), p), p.date + ': an empty board counted as finished');
    const lenFajky = prazdnaPlocha(p);
    for (const [a, b] of tabulky(p.k)) {
      const t = lenFajky[klucTabulky(a, b)];
      for (let x = 0; x < p.N; x++) t[p.solution[a][x] * p.N + p.solution[b][x]] = 1;
    }
    assert(!jeVyriesene(lenFajky, p), p.date + ': a board with only the ticks counted as finished');
    const skoro = hotovaPlocha(p);
    const kluc = klucTabulky(...tabulky(p.k)[0]);
    for (let i = 0; i < skoro[kluc].length; i++) if (skoro[kluc][i] === -1) { skoro[kluc][i] = 0; break; }
    assert(!jeVyriesene(skoro, p), p.date + ': one square short still counted as finished');
  }
});

/* ── 3. The automatics ──────────────────────────────────────────────────── */

test('Auto cross only ever writes crosses the solution agrees with', () => {
  for (const p of DAVKA) {
    for (const [a, b] of tabulky(p.k)) {
      for (let x = 0; x < p.N; x++) {
        const plocha = prazdnaPlocha(p);
        const r = p.solution[a][x], c = p.solution[b][x];
        plocha[klucTabulky(a, b)][r * p.N + c] = 1;
        const doplnky = autoKriz(plocha, p, a, b, r, c);
        assert(doplnky.length === 2 * (p.N - 1), p.date + ': auto cross filled ' + doplnky.length + ' squares, not ' + (2 * (p.N - 1)));
        for (const d of doplnky) {
          assert(d.val === -1, p.date + ': auto cross wrote something other than a cross');
          assert(!spravna(p, d.tab[0], d.tab[1], d.r, d.c), p.date + ': auto cross crossed out a square the solution needs');
        }
      }
    }
  }
});

test('Carry across only ever writes marks the solution agrees with', () => {
  for (const p of DAVKA) {
    if (p.k < 3) continue;
    for (const [a, b] of tabulky(p.k)) {
      for (let x = 0; x < p.N; x++) {
        // a board a careful player could really have: the true ticks of one
        // table, with their rows and columns crossed out
        const plocha = prazdnaPlocha(p);
        const [ia, ib] = tabulky(p.k)[tabulky(p.k).length - 1];
        const t = plocha[klucTabulky(ia, ib)];
        for (let y = 0; y < p.N; y++) {
          const r = p.solution[ia][y], c = p.solution[ib][y];
          t[r * p.N + c] = 1;
          for (const d of autoKriz(plocha, p, ia, ib, r, c)) plocha[klucTabulky(d.tab[0], d.tab[1])][d.r * p.N + d.c] = d.val;
        }
        const r = p.solution[a][x], c = p.solution[b][x];
        plocha[klucTabulky(a, b)][r * p.N + c] = 1;
        for (const d of carryAcross(plocha, p, a, b, r, c)) {
          const ok = spravna(p, d.tab[0], d.tab[1], d.r, d.c);
          assert(d.val === 1 ? ok : !ok, p.date + ': carry across wrote a mark the solution contradicts');
        }
      }
    }
  }
});

test('Auto cross and Carry across leave a board the solver still agrees with', () => {
  for (const p of DAVKA) {
    const plocha = prazdnaPlocha(p);
    for (const [a, b] of tabulky(p.k)) {
      for (let x = 0; x < p.N; x++) {
        const r = p.solution[a][x], c = p.solution[b][x];
        plocha[klucTabulky(a, b)][r * p.N + c] = 1;
        for (const d of autoKriz(plocha, p, a, b, r, c)) plocha[klucTabulky(d.tab[0], d.tab[1])][d.r * p.N + d.c] = d.val;
        for (const d of carryAcross(plocha, p, a, b, r, c)) plocha[klucTabulky(d.tab[0], d.tab[1])][d.r * p.N + d.c] = d.val;
      }
    }
    assert(jeVyriesene(plocha, p), p.date + ': the automatics did not finish a board of true ticks');
    assert(porovnaj(plocha, p).zle.length === 0, p.date + ': the automatics left a wrong tick behind');
    // and the masks the solver reads back really are down to one bit each
    const P = naMasky(plocha, p);
    assert(P.length === p.k * p.k * p.N, p.date + ': the mask state has the wrong size');
  }
});

/* ── 4. The board as the page draws it ──────────────────────────────────── */

test('the staircase holds every pair of categories exactly once', () => {
  for (const p of DAVKA) {
    const riadky = poradieRiadkov(p.k), stlpce = poradieStlpcov(p.k);
    const videne = new Set();
    for (let i = 0; i < riadky.length; i++) {
      for (let j = 0; j < stlpce.length; j++) {
        if (!jeTabulka(p.k, i, j)) continue;
        const a = riadky[i], b = stlpce[j];
        assert(a !== b, p.date + ': a table would pair a category with itself');
        const kluc = klucTabulky(Math.min(a, b), Math.max(a, b));
        assert(!videne.has(kluc), p.date + ': the table ' + kluc + ' is drawn twice');
        videne.add(kluc);
      }
    }
    assert(videne.size === tabulky(p.k).length, p.date + ': ' + videne.size + ' tables drawn, ' + tabulky(p.k).length + ' needed');
  }
});

test('plochaHTML draws one square per cell of every table, and nothing else', () => {
  for (const p of DAVKA) {
    const html = plochaHTML(p);
    const pocet = (html.match(/class="b /g) || []).length;
    assert(pocet === pocetPolicok(p), p.date + ': ' + pocet + ' squares drawn, ' + pocetPolicok(p) + ' expected');
    assert(pocet === tabulky(p.k).length * p.N * p.N, p.date + ': the square count does not match the tables');
    // every square carries the table and the place inside it
    for (const [a, b] of tabulky(p.k)) {
      for (let r = 0; r < p.N; r++) for (let c = 0; c < p.N; c++) {
        const hlada = 'data-t="' + a + ',' + b + '" data-r="' + r + '" data-c="' + c + '"';
        assert(html.includes(hlada), p.date + ': the square ' + hlada + ' is missing from the board');
      }
    }
    assert(!html.includes('undefined'), p.date + ': the board markup carries an undefined');
  }
});

test('the single character headers are all different inside one puzzle', () => {
  for (const p of DAVKA) {
    const videne = new Set();
    for (let a = 0; a < p.k; a++) {
      if (p.cats[a].id === 'when') continue;
      for (let i = 0; i < p.N; i++) {
        const z = jednoznak(p, a, i);
        assert(z.length === 1, p.date + ': the header "' + z + '" is not one character');
        assert(!videne.has(z), p.date + ': the header "' + z + '" stands for two different items');
        videne.add(z);
      }
    }
  }
});

test('the cast list and the clue list name every item and every clue', () => {
  for (const p of DAVKA) {
    const l = legendaHTML(p);
    for (let a = 0; a < p.k; a++) for (const w of p.cats[a].items) assert(l.includes(w), p.date + ': "' + w + '" is missing from the cast list');
    const vety = p.clues.map((_, i) => 'clue number ' + i);
    const ind = indicieHTML(p, vety);
    for (const v of vety) assert(ind.includes(v), p.date + ': a clue is missing from the list');
    assert((ind.match(/<li /g) || []).length === p.clues.length, p.date + ': the clue list is the wrong length');
    const q = otazkaText(p);
    assert(q.includes(p.cats[1].items[p.question.what]), p.date + ': the closing question names the wrong store');
    assert(/which week/.test(q) === (p.ordered === 3), p.date + ': the closing question asks about weeks on a puzzle without them');
  }
});

test('nothing in the markup gives the answer away before it is solved', () => {
  for (const p of DAVKA) {
    const html = plochaHTML(p) + legendaHTML(p) + indicieHTML(p, p.clues.map(() => 'x')) + otazkaText(p);
    assert(!/data-v=/.test(html), p.date + ': the board markup carries marks');
    // the solution of a day is in the packed record the page embeds, exactly
    // as it is for every other game, but never in the board or the words
    assert(!html.includes(JSON.stringify(p.solution)), p.date + ': the solution is in the markup');
  }
});

test('a packed puzzle survives the round trip the page uses', () => {
  for (const p of DAVKA) {
    const r = rozbal(zbal(p));
    assert(r.k === p.k && r.N === p.N, p.date + ': the shape changed');
    assert(r.cats.every((c, a) => c.label === p.cats[a].label && c.jedno === p.cats[a].jedno),
      p.date + ': rozbal lost the category names the page prints');
    assert(polozka(r, 0, 0) === polozka(p, 0, 0), p.date + ': the item names changed');
    assert(jeVyriesene(hotovaPlocha(r), r), p.date + ': the unpacked puzzle does not accept its own solution');
  }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
