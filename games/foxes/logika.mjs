/* Foxes: the rules on the player's board, Check and Hint.
 * Pure functions, no DOM. game.js draws what these return; tests-logika.mjs
 * checks that no hint ever contradicts the solution and that hints alone carry
 * an empty board all the way to a solved lair.
 *
 * The board (`plocha`) is three arrays over the cells, r * n + c:
 *   k   the piece standing there, 0 .. n-2 a fox, n-1 the lost thing, -1 nobody
 *   x   1 for a cross, "nobody here"
 *   m   the notes, one bit per piece (bit p means p could still be here)
 * A piece stands on the board at most once; game.js moves it when it is put
 * down somewhere else.
 *
 * What the player knows is on the board (ops/spec-foxes.md part 10): the
 * premises of a hint are the pieces, the crosses and the notes. When a piece
 * has at least one note, the cells with its note are the player's list of
 * where it can still be; a piece without notes is limited by nothing but the
 * crosses and the rows and columns already taken.
 */
import {
  struktura, pripravIndicie, novyStav, kopiaStavu, poloz, krok, bunkyKusa, textKroku, platneRozlozenie,
  menoKusu, menoKomory, bunkaText, vlastnost, MAX_RETAZ, kdeMoze, linieText, zoznam, slovom, PAROVE,
} from './generator.mjs';
// What a clue names (its pieces), for the chips the first press of Hint
// outlines; the same function the clue list uses (plocha.mjs imports only
// generator.mjs, so there is no cycle).
import { coMenuje } from './plocha.mjs';

/* How many hints back a clue counts as "again" (critic 25. 9., round 2,
   finding 5), and how many more steps of the same clues one press may run. */
export const NEDAVNE = 6;
export const MAX_REBRIK = 4;

export function prazdnaPlocha(zad) {
  const C = zad.n * zad.n;
  return { k: new Array(C).fill(-1), x: new Array(C).fill(0), m: new Array(C).fill(0) };
}
export function kopiaPlochy(pl) { return { k: pl.k.slice(), x: pl.x.slice(), m: pl.m.slice() }; }

/* Where every piece stands on the board, or -1. */
export function pozicie(plocha, zad) {
  const pos = new Array(zad.n).fill(-1);
  for (let c = 0; c < plocha.k.length; c++) if (plocha.k[c] >= 0 && pos[plocha.k[c]] < 0) pos[plocha.k[c]] = c;
  return pos;
}
function maPoznamky(plocha, p) { for (let c = 0; c < plocha.m.length; c++) if ((plocha.m[c] >> p) & 1) return true; return false; }
function poznamkyKusa(plocha, p) { const out = []; for (let c = 0; c < plocha.m.length; c++) if ((plocha.m[c] >> p) & 1) out.push(c); return out; }

/* The board as a solver state: crosses take a cell away from everyone, notes
   limit their piece, and a piece on the board is placed. The clues are not
   applied here; the solver reads them as steps, so a hint can say which one. */
export function premisy(plocha, zad, S = struktura(zad)) {
  const n = zad.n, st = novyStav(S);
  const pos = pozicie(plocha, zad);
  for (let c = 0; c < plocha.x.length; c++) {
    if (!plocha.x[c]) continue;
    const r = (c / n) | 0, b = ~(1 << (c % n));
    for (let p = 0; p < n; p++) st.c[p * n + r] &= b;
  }
  for (let p = 0; p < n; p++) {
    if (pos[p] >= 0 || !maPoznamky(plocha, p)) continue;
    for (let r = 0; r < n; r++) {
      let m = 0;
      for (let s = 0; s < n; s++) if ((plocha.m[r * n + s] >> p) & 1) m |= 1 << s;
      st.c[p * n + r] &= m;
    }
  }
  for (let p = 0; p < n; p++) if (pos[p] >= 0) poloz(S, st, p, pos[p]);
  return st;
}

/* Compare the board with the solution. Wrong pieces and wrong crosses count,
   never notes: notes are pencil marks, and Hint is the one that finds a wrong
   one. `vyber` limits the comparison to a set of cells. */
export function porovnaj(plocha, zad, vyber = null) {
  const n = zad.n, V = n - 1, sol = zad.solution;
  const vRieseni = new Map(sol.map((c, p) => [c, p]));
  const out = { lisky: 0, vec: 0, kriziky: 0, zle: [] };
  for (let c = 0; c < plocha.k.length; c++) {
    if (vyber && !vyber.has(c)) continue;
    const p = plocha.k[c];
    if (p >= 0) {
      if (p === V) out.vec++; else out.lisky++;
      if (sol[p] !== c) out.zle.push({ typ: 'kus', bunka: c, kus: p });
    } else if (plocha.x[c]) {
      out.kriziky++;
      if (vRieseni.has(c)) out.zle.push({ typ: 'kriz', bunka: c, kus: -1 });
    }
  }
  return out;
}

/* Solved: all n pieces on the board once each, one in every row and every
   column, none on a stone, every clue true, and exactly one fox in the
   chamber of the lost thing. The stored solution is not needed, because the
   generator only accepts puzzles with one placement. Crosses and notes are
   not looked at. */
export function jeVyriesene(plocha, zad) {
  const n = zad.n;
  const pos = new Array(n).fill(-1);
  for (let c = 0; c < plocha.k.length; c++) {
    const p = plocha.k[c];
    if (p < 0) continue;
    if (pos[p] >= 0) return false;
    pos[p] = c;
  }
  if (pos.some((c) => c < 0)) return false;
  return platneRozlozenie(zad, pos);
}

/* Put piece p on cell c, as a new board. A piece stands on the board at most
   once (spec part 9, deviation 3), so it leaves the cell it stood on before;
   a piece already on c goes off, and a cross on c is taken away. The notes of
   c stay, hidden under the piece, and come back when it goes. game.js wraps
   the whole change into one Undo step. */
export function polozKus(plocha, zad, p, c) {
  const pl = kopiaPlochy(plocha);
  for (let i = 0; i < pl.k.length; i++) if (pl.k[i] === p) pl.k[i] = -1;
  pl.k[c] = p;
  pl.x[c] = 0;
  return pl;
}

/* Auto cross: after a piece goes down, the rest of its row and its column is
   nobody's. Returns the cells to cross, so the caller can put the whole lot
   into one Undo step. Stones, pieces and cells already crossed are left. */
export function autoKriz(plocha, zad, bunka) {
  const n = zad.n, r = (bunka / n) | 0, s = bunka % n, out = [];
  const kamen = new Set(zad.kamene);
  for (let i = 0; i < n; i++) {
    for (const c of [r * n + i, i * n + s]) {
      if (c === bunka || kamen.has(c) || plocha.k[c] >= 0 || plocha.x[c] || out.includes(c)) continue;
      out.push(c);
    }
  }
  return out.sort((a, b) => a - b);
}

/* The cells a first press of Hint outlines: where to look, never what.
   With the player's board (plocha), a clue about two pieces outlines where
   each of them stands or has notes: the clue names both, so that gives
   nothing away (critic 25. 9., round 2, finding 4). */
export function oblastKroku(zad, S, k, plocha) {
  const n = zad.n, C = n * n;
  const riadok = (r) => Array.from({ length: n }, (_, i) => r * n + i);
  const stlpec = (s) => Array.from({ length: n }, (_, i) => i * n + s);
  const komora = (kk) => S.komBunky[kk].slice();
  if (k.rule === 'pair' && plocha) {
    const cl = zad.clues[k.clue], pos = pozicie(plocha, zad), out = new Set();
    for (const p of [cl.p, cl.q]) {
      if (pos[p] >= 0) out.add(pos[p]);
      else for (const c of poznamkyKusa(plocha, p)) out.add(c);
    }
    return [...out].sort((a, b) => a - b);
  }
  switch (k.rule) {
    case 'only-place': return riadok((k.cell / n) | 0);
    case 'row-one-cell': case 'row-one-piece': case 'locked-row': return riadok(k.row);
    case 'column-one-cell': case 'column-one-piece': case 'locked-column': return stlpec(k.col);
    case 'pair-of-rows': return k.lines.flatMap(riadok);
    case 'pair-of-columns': return k.lines.flatMap(stlpec);
    case 'alone-rule': case 'holder-trait': return komora(k.chamber);
    case 'clue': {
      const cl = zad.clues[k.clue];
      if (cl.k !== undefined) return komora(cl.k);
      if (cl.t === 'ON') return Array.from({ length: C }, (_, c) => c).filter((c) => zad.znaky[c] === cl.f);
      if (cl.t === 'EDGE') return cl.e === 0 ? riadok(0) : cl.e === 1 ? riadok(n - 1) : cl.e === 2 ? stlpec(0) : stlpec(n - 1);
      if (cl.t === 'BESIDE') return Array.from({ length: C }, (_, c) => c).filter((c) => (S.priM[(c / n) | 0] >> (c % n)) & 1);
      return [];
    }
    default: return [];
  }
}

/* A clue a step leant on, as a short clause, for the sentence of the next
   step that changes the board (spec part 10: steps that leave a piece more
   than n cells are not reported on their own). */
function klauzula(zad, k) {
  const cl = zad.clues[k.clue];
  const cis = 'clue ' + (k.clue + 1);
  const A = cl.p !== undefined ? menoKusu(zad, cl.p) : '';
  switch (cl.t) {
    case 'IN': return cis + ' puts ' + A + ' in ' + menoKomory(zad, cl.k);
    case 'NOTIN': return cis + ' keeps ' + A + ' out of ' + menoKomory(zad, cl.k);
    case 'ON': return cis + ' puts ' + A + ' ' + ['on moss', 'under the roots', 'in the leaves'][cl.f];
    case 'EDGE': return cis + ' puts ' + A + ' ' + ['in the top row', 'in the bottom row', 'in the leftmost column', 'in the rightmost column'][cl.e];
    case 'BESIDE': return cis + ' puts ' + A + ' right next to a stone';
    case 'EMPTY': return cis + ' empties ' + menoKomory(zad, cl.k);
    case 'GNOT': return cis + ' keeps the ' + vlastnost(zad, cl.g).ktori + ' out of ' + menoKomory(zad, cl.k);
    case 'HOLDER': return cis + ' says who has the ' + zad.vec;
    default: return cis + ' links ' + menoKusu(zad, cl.p) + ' and ' + menoKusu(zad, cl.q);
  }
}
function velke(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* The clues a hint builds on, in words: "It builds on clues 3 and 6." for the
   first press, and for the second one clause each, in the order the solver
   took them. Two clues about the same two pieces make one clause ("Clues 7
   and 8 link Mica and Gus."), never "clue 8 links Nell and Juno, and clue 7
   links Juno and Nell" (critic 25. 9., round 2, finding 3). */
function citacieText(zad, citovane) {
  if (!citovane.length) return { t1: '', t2: '' };
  const cisla = citovane.map((x) => x.clue + 1).sort((a, b) => a - b);
  const t1 = ' It builds on ' + (cisla.length === 1 ? 'clue ' + cisla[0] : 'clues ' + zoznam(cisla.map(String))) + '.';
  const [a, b] = citovane.map((x) => zad.clues[x.clue]);
  if (b && PAROVE.includes(a.t) && PAROVE.includes(b.t) && ((a.p === b.p && a.q === b.q) || (a.p === b.q && a.q === b.p))) {
    return { t1, t2: 'Clues ' + cisla[0] + ' and ' + cisla[1] + ' link ' + menoKusu(zad, a.p) + ' and ' + menoKusu(zad, a.q) + '. ' };
  }
  return { t1, t2: velke(citovane.map((x) => klauzula(zad, x)).join(', and ')) + '. ' };
}

/* One pass of a clue about two pieces: the cells of p for which q has no
   cell the clue allows go (the generator's revise, on a copy). */
function reviziaDvojice(n, c, p, q, T) {
  for (let r = 0; r < n; r++) {
    let m = c[p * n + r], nove = m;
    while (m) {
      const s = 31 - Math.clz32(m & -m);
      m &= m - 1;
      const a = (r * n + s) * n;
      let ok = false;
      for (let rr = 0; rr < n; rr++) if (c[q * n + rr] & T[a + rr]) { ok = true; break; }
      if (!ok) nove &= ~(1 << s);
    }
    c[p * n + r] = nove;
  }
}

/* A set of cells in the plainest words: one line and a span, a short list,
   or "the five marked cells" (the second press marks them on the board). */
function bunkyText(n, bunky) {
  const riadky = [...new Set(bunky.map((c) => (c / n) | 0))].sort((a, b) => a - b);
  const stlpce = [...new Set(bunky.map((c) => c % n))].sort((a, b) => a - b);
  if (riadky.length === 1) return linieText('row', riadky) + ', ' + linieText('column', stlpce);
  if (stlpce.length === 1) return linieText('column', stlpce) + ', ' + linieText('row', riadky);
  if (bunky.length <= 3) {
    const skupiny = riadky.map((r) => 'row ' + (r + 1) + ', ' + linieText('column', bunky.filter((c) => ((c / n) | 0) === r).map((c) => c % n)));
    return skupiny.length === 2 ? skupiny[0] + ', and ' + skupiny[1] : skupiny.slice(0, -1).join('; ') + '; and ' + skupiny[skupiny.length - 1];
  }
  return 'the ' + slovom(bunky.length) + ' marked cells';
}

/* The pieces whose places the step sentence itself already states, in the
   same words the notes will show. */
function opisaneKusy(zad, k) {
  const out = new Set();
  if (k.rule === 'clue') {
    const cl = zad.clues[k.clue];
    if (['IN', 'ON', 'EDGE', 'BESIDE'].includes(cl.t)) out.add(cl.p);
  }
  if (k.rule === 'pair') for (const p of k.pieces) out.add(p);
  return out;
}

/* What the second press puts on the board, said after the step: whose notes
   and where, and which cells get a cross and why. A hint never writes notes
   for a piece it does not name (critic 25. 9., finding 4). */
function vetaAkcie(zad, S, st, k, akcia, textKroku) {
  if (akcia.druh === 'poloz') return '';
  const n = zad.n, M = (p) => menoKusu(zad, p);
  const casti = [];
  const opisane = opisaneKusy(zad, k);
  const maly = textKroku.toLowerCase();
  const dalsie = akcia.zapisy.filter((z) => {
    if (opisane.has(z.kus)) return false;
    // "so Juno must be in column 1" already says it when that is all
    const kde = kdeMoze(zad, S, st, z.kus).toLowerCase(), m = M(z.kus).toLowerCase();
    return !maly.includes(m + ' must be in ' + kde + '.') && !maly.includes(m + ' can only be in ' + kde + ',');
  });
  if (dalsie.length) {
    // The places carry their own commas ("column 1, rows 2 and 3"), so two
    // or more pieces are kept apart with semicolons.
    const kusy = dalsie.map((z) => M(z.kus) + ' only ' + kdeMoze(zad, S, st, z.kus));
    casti.push('That leaves ' + (kusy.length === 1 ? kusy[0] : kusy.slice(0, -1).join('; ') + '; and ' + kusy[kusy.length - 1]) + '.');
  }
  const nove = akcia.zapisy.filter((z) => !z.stare), stare = akcia.zapisy.filter((z) => z.stare);
  if (nove.length) casti.push('The notes for ' + zoznam(nove.map((z) => M(z.kus))) + ' go there.');
  if (stare.length) casti.push('The other notes for ' + zoznam(stare.map((z) => M(z.kus))) + ' come off.');
  const prazdnaKomora = k.rule === 'clue' && zad.clues[k.clue].t === 'EMPTY';
  if (akcia.kriz.length && !prazdnaKomora) {
    casti.push('Nobody is left who could be in ' + bunkyText(n, akcia.kriz) + ', so ' + (akcia.kriz.length === 1 ? 'it gets a cross.' : 'they get crosses.'));
  }
  return casti.length ? ' ' + casti.join(' ') : '';
}

/* Hint: one next step from the marks already on the board. Returns null on a
 * solved board, otherwise
 *   { druh, pravidlo, vrstva, cislo, kus, bunky, poznamky, zapisy, kriz, oblast, text1, text2 }
 * druh is what the second press does:
 *   'chyba'      takes one wrong mark off (typ 'kus', 'kriz' or 'poznamky')
 *   'poloz'      puts piece kus on bunky[0]
 *   'poznamky'   writes the notes of every piece in `zapisy` ({ kus, bunky })
 *                into exactly those cells, and crosses the cells `kriz`
 *                (kus and poznamky are the first of zapisy)
 *   'kriz'       crosses the cells `kriz` (= bunky)
 *   'odhalenie'  puts a piece down when no rule reaches (should not happen)
 * bunky are all the cells the second press marks.
 * cislo is the 0-based clue the step used, or -1 (cisla: every clue of the
 * press, see "again" below); oblast the cells the first press outlines and
 * tipKusy the pieces whose chips it outlines: the ones the clue names, so a
 * clue about two pieces outlines something even on an empty board (critic
 * 25. 9., round 2, finding 4). citovane: the earlier clues the step builds on.
 *
 * Order: a wrong mark first, because nothing below is sound on a board that
 * contradicts the solution. Then the solver runs from the player's premises
 * and the first step that changes the board is reported: a piece placed, the
 * places of one piece narrowed to at most n cells that are not its notes yet,
 * or a cell nobody can be in any more (not in a row or column that already
 * has its piece, that goes without saying).
 *
 * opts.nedavne: the hints already taken, oldest first, as { cisla, kusy }
 * (game.js keeps them). When the step is a clue about two pieces that one of
 * the last NEDAVNE hints already used on the same piece, the lair is climbing
 * a ladder (clue 3 on the whistle, clue 4 on Vesper, clue 3 again...). Then
 * the press says "Clue 3 again" and runs on through the next steps of the
 * same clues, at most MAX_REBRIK of them, and writes where they end in one go
 * (critic 25. 9., round 2, finding 5). Without opts every hint is one step. */
export function napoveda(plocha, zad, opts = {}) {
  if (jeVyriesene(plocha, zad)) return null;
  const n = zad.n, V = n - 1, sol = zad.solution;
  const M = (p) => menoKusu(zad, p), MV = (p) => velke(menoKusu(zad, p));

  // 1. A wrong mark, the first one in reading order; then wrong notes.
  const solMnozina = new Set(sol);
  for (let c = 0; c < plocha.k.length; c++) {
    const p = plocha.k[c];
    if (p >= 0 && sol[p] !== c) {
      return {
        druh: 'chyba', typ: 'kus', pravidlo: 'wrong-piece', vrstva: 0, cislo: -1, kus: p, bunky: [c], poznamky: [], zapisy: [], kriz: [], oblast: [c],
        text1: 'One of your marks does not fit the finished lair. It is in row ' + (((c / n) | 0) + 1) + '.',
        text2: MV(p) + ' does not belong in ' + bunkaText(n, c) + ', so ' + M(p) + ' comes off.',
      };
    }
    if (p < 0 && plocha.x[c] && solMnozina.has(c)) {
      return {
        druh: 'chyba', typ: 'kriz', pravidlo: 'wrong-cross', vrstva: 0, cislo: -1, kus: -1, bunky: [c], poznamky: [], zapisy: [], kriz: [], oblast: [c],
        text1: 'One of your marks does not fit the finished lair. It is in row ' + (((c / n) | 0) + 1) + '.',
        text2: 'The cross in ' + bunkaText(n, c) + ' covers a cell where someone is. It comes off.',
      };
    }
  }
  const pos = pozicie(plocha, zad);
  for (let p = 0; p < n; p++) {
    if (pos[p] >= 0 || !maPoznamky(plocha, p)) continue;
    if ((plocha.m[sol[p]] >> p) & 1) continue;
    const bunky = poznamkyKusa(plocha, p);
    return {
      druh: 'chyba', typ: 'poznamky', pravidlo: 'wrong-notes', vrstva: 0, cislo: -1, kus: p, bunky, poznamky: [], zapisy: [], kriz: [], oblast: bunky,
      text1: 'One of your marks does not fit the finished lair: a set of notes.',
      text2: 'Your notes for ' + M(p) + ' leave out the cell where ' + M(p) + ' is, so they come off.',
    };
  }

  // 2. One step of the solver from what is on the board. Everything that one
  //    step leaves on the board goes down with one press: the notes of every
  //    piece it narrowed to at most n cells and the crosses on every cell it
  //    emptied. Taking only one of them per press made the same sentence come
  //    back two and three times with a different cross each (critic 25. 9.,
  //    finding 4).
  const S = struktura(zad);
  const I = pripravIndicie(S, zad.clues);
  const st = premisy(plocha, zad, S);
  const riadokMa = new Uint8Array(n), stlpecMa = new Uint8Array(n);
  for (let p = 0; p < n; p++) if (pos[p] >= 0) { riadokMa[(pos[p] / n) | 0] = 1; stlpecMa[pos[p] % n] = 1; }
  const kamen = new Set(zad.kamene);

  /* What the solver did between `pred` (the cells before) and `stav`, as a
     change of the player's board: a piece placed, or the notes of every
     piece it narrowed to at most n cells and the crosses on every cell it
     emptied. null when the board would not change. */
  function akciaMedzi(pred, plPred, stav, k) {
    for (let p = 0; p < n; p++) {
      if (plPred[p] < 0 && stav.pl[p] >= 0 && pos[p] !== stav.pl[p]) return { druh: 'poloz', kus: p, bunky: [stav.pl[p]], poznamky: [], zapisy: [], kriz: [] };
    }
    // A trial ends with "so it is in the other cell": the piece goes there
    // with the same press, not as one lonely note first.
    if (k.rule === 'trial' && pos[k.piece] < 0) {
      const zvysok = bunkyKusa(S, stav, k.piece);
      if (zvysok.length === 1) return { druh: 'poloz', kus: k.piece, bunky: zvysok, poznamky: [], zapisy: [], kriz: [] };
    }
    const zmenene = [];
    for (let p = 0; p < n; p++) {
      if (stav.pl[p] >= 0) continue;
      for (let r = 0; r < n; r++) if (pred[p * n + r] !== stav.c[p * n + r]) { zmenene.push(p); break; }
    }
    const prve = [k.piece, ...(k.pieces || [])].filter((p) => p >= 0 && zmenene.includes(p));
    const zapisy = [];
    for (const p of [...new Set([...prve, ...zmenene])]) {
      const bunky = bunkyKusa(S, stav, p);
      if (bunky.length > n) continue;
      const stare = poznamkyKusa(plocha, p);
      if (stare.length === bunky.length && stare.every((c, i) => c === bunky[i])) continue;
      zapisy.push({ kus: p, bunky, stare: stare.length });
    }
    const kriz = [];
    for (let c = 0; c < n * n; c++) {
      const r = (c / n) | 0, s = c % n, b = 1 << s;
      if (plocha.x[c] || plocha.k[c] >= 0 || kamen.has(c) || riadokMa[r] || stlpecMa[s]) continue;
      let bolo = false, je = false;
      for (let p = 0; p < n; p++) { if (pred[p * n + r] & b) bolo = true; if (stav.c[p * n + r] & b) je = true; }
      if (bolo && !je) kriz.push(c);
    }
    if (!zapisy.length && !kriz.length) return null;
    const bunky = [...new Set([...zapisy.flatMap((z) => z.bunky), ...kriz])].sort((a, b) => a - b);
    return zapisy.length
      ? { druh: 'poznamky', kus: zapisy[0].kus, bunky, poznamky: zapisy[0].bunky, zapisy, kriz }
      : { druh: 'kriz', kus: -1, bunky: kriz, poznamky: [], zapisy, kriz };
  }

  /* How much a quiet earlier clue matters to the step just found, from the
     cells it took (vzal, per piece and row):
       2  the step rests on it: give those cells back, run the clue about two
          pieces again, and a cell the step takes from a piece it writes (or
          a cell it crosses) stays open;
       1  it shaped what the press writes: without it a piece the press
          writes would keep more cells, a crossed cell would stay open, or
          (for the line and chamber rules) a piece the step reads from would
          have more room;
       0  it took cells elsewhere, and citing it would be noise.
     For a clue about two pieces the answer is exact: the clue is run again
     without the earlier one (critic 25. 9., round 2, finding 3: "It builds on
     clue 6" where clue 6 took nothing the step needed, and no citation where
     the partner had been narrowed without a word). */
  function vaha(vzal, k, akcia, pred, stav) {
    const pise = new Set(akcia.zapisy.map((z) => z.kus));
    if (akcia.druh === 'poloz') pise.add(akcia.kus);
    const krizy = new Set(akcia.kriz);
    const dvojica = k.rule === 'pair' ? I[k.clue] : null;
    let makka = false;
    // a crossed cell someone else could still stand in without it
    for (const c of akcia.kriz) {
      const r = (c / n) | 0, b = 1 << (c % n);
      for (let p = 0; p < n; p++) if ((!dvojica || (p !== dvojica.p && p !== dvojica.q)) && (vzal[p * n + r] & b)) makka = true;
    }
    if (dvojica) {
      const c = pred.slice();
      for (let i = 0; i < c.length; i++) c[i] |= vzal[i];
      reviziaDvojice(n, c, dvojica.p, dvojica.q, dvojica.F);
      reviziaDvojice(n, c, dvojica.q, dvojica.p, dvojica.B);
      let tvrda = false;
      for (const w of [dvojica.p, dvojica.q]) {
        for (let r = 0; r < n; r++) {
          const vzate = pred[w * n + r] & ~stav.c[w * n + r];
          let navyse = c[w * n + r] & ~stav.c[w * n + r];
          while (navyse) {
            const s = 31 - Math.clz32(navyse & -navyse);
            navyse &= navyse - 1;
            if (!pise.has(w) && !krizy.has(r * n + s)) continue;
            if ((vzate >> s) & 1) tvrda = true; else makka = true;
          }
        }
      }
      return tvrda ? 2 : makka ? 1 : 0;
    }
    if (makka) return 1;
    // A clue about one piece keeps only the cells it allows, so a cell taken
    // outside them would have gone anyway.
    const X = k.rule === 'clue' ? I[k.clue] : null;
    for (const w of pise) for (let r = 0; r < n; r++) if (vzal[w * n + r] & (X && X.typ === 'u' ? X.m[r] : S.full)) return 1;
    if (k.rule !== 'clue') for (const p of [k.piece, ...(k.pieces || [])]) if (p >= 0) for (let r = 0; r < n; r++) if (vzal[p * n + r]) return 1;
    return 0;
  }
  /* At most two quiet clues, the ones the step rests on first, then the
     nearest; each clue once, never the clue the step itself reads; in the
     order the solver took them. */
  function vyberCitacie(tiche, k, akcia, pred, stav) {
    const podlaIndicie = new Map();
    tiche.forEach((x, i) => {
      if (x.k.clue === k.clue) return;
      let y = podlaIndicie.get(x.k.clue);
      if (!y) { y = { k: x.k, vzal: new Uint8Array(x.vzal.length), i }; podlaIndicie.set(x.k.clue, y); }
      for (let j = 0; j < x.vzal.length; j++) y.vzal[j] |= x.vzal[j];
      y.i = i;
    });
    const kandidati = [];
    for (const y of podlaIndicie.values()) {
      const v = vaha(y.vzal, k, akcia, pred, stav);
      if (v) kandidati.push({ k: y.k, i: y.i, v });
    }
    kandidati.sort((a, b) => b.v - a.v || b.i - a.i);
    return kandidati.slice(0, 2).sort((a, b) => a.i - b.i).map((y) => y.k);
  }

  const nedavne = (opts.nedavne || []).slice(-NEDAVNE);
  const tiche = [];
  for (let g = 0; g < 600; g++) {
    const pred = st.c.slice(), plPred = st.pl.slice();
    const k = krok(S, I, st, 3, MAX_RETAZ);
    if (!k) break;
    let akcia = akciaMedzi(pred, plPred, st, k);
    if (!akcia) {
      // A step that leaves nothing new on the board: remember which cells
      // of which piece it took away, so a later hint cites it only when it
      // matters there.
      if (k.clue >= 0 && zad.clues[k.clue].t !== 'HOLDER') {
        const vzal = new Uint8Array(st.c.length);
        for (let i = 0; i < st.c.length; i++) vzal[i] = pred[i] & ~st.c[i];
        tiche.push({ k, vzal });
      }
      continue;
    }
    const t = textKroku(zad, S, st, k);
    const citovane = vyberCitacie(tiche, k, akcia, pred, st);

    // The ladder: this clue already narrowed this piece a few hints ago. The
    // press runs on through the next steps of the clues the last hints used,
    // as long as each one is such a clue and changes the board, and writes
    // where they end.
    const kroky = [{ k, t }];
    const znova = k.rule === 'pair' && akcia.druh !== 'poloz'
      && nedavne.some((x) => (x.cisla || []).includes(k.clue) && akcia.zapisy.some((z) => (x.kusy || []).includes(z.kus)));
    let kSpolu = k;
    if (znova) {
      const rebrik = new Set([k.clue]);
      for (const x of nedavne) for (const c of x.cisla || []) if (c >= 0 && c < I.length && I[c].typ === 'p') rebrik.add(c);
      for (let j = 0; j < MAX_REBRIK; j++) {
        const skusobny = kopiaStavu(st);
        const k2 = krok(S, I, skusobny, 3, MAX_RETAZ);
        if (!k2 || k2.rule !== 'pair' || !rebrik.has(k2.clue)) break;
        const a2 = akciaMedzi(st.c, st.pl, skusobny, k2);
        if (!a2 || a2.druh === 'poloz') break;
        st.c.set(skusobny.c); st.pl.set(skusobny.pl); st.used.set(skusobny.used);
        kroky.push({ k: k2, t: textKroku(zad, S, st, k2) });
      }
      if (kroky.length > 1) {
        kSpolu = { rule: 'pair', layer: 2, clue: k.clue, piece: -1, pieces: [...new Set(kroky.flatMap((x) => x.k.pieces))] };
        akcia = akciaMedzi(pred, plPred, st, kSpolu);
      }
    }

    const cisla = kroky.map((x) => x.k.clue);
    const tipKusy = [...new Set(cisla.filter((c) => c >= 0).flatMap((c) => coMenuje(zad, zad.clues[c], S).kusy))];
    const oblast = [...new Set(kroky.flatMap((x) => (x.k.rule === 'trial'
      // the two cells of the piece being tried: where to look, not who
      ? [x.k.cell, ...bunkyKusa(S, st, x.k.piece)]
      : oblastKroku(zad, S, x.k, plocha))))].sort((a, b) => a - b);
    let text1 = t.textBezHodnoty, text2 = t.text;
    if (znova) {
      const dalej = [...new Set(kroky.slice(1).map((x) => 'clue ' + (x.k.clue + 1)))];
      text1 = 'Clue ' + (k.clue + 1) + ' links two of them again. Compare where each can still be' + (dalej.length ? ', then follow ' + zoznam(dalej) : '') + '.';
      text2 = kroky.map((x, i) => x.t.text.replace(/^Clue (\d+): /, (m, d) => (i ? 'Then clue ' : 'Clue ') + d + ' again: ')).join(' ');
    }
    const cit = citacieText(zad, citovane);
    return {
      druh: akcia.druh, pravidlo: k.rule, vrstva: Math.max(...kroky.map((x) => x.k.layer)), cislo: k.clue, cisla, kus: akcia.kus,
      bunky: akcia.bunky, poznamky: akcia.poznamky, zapisy: akcia.zapisy, kriz: akcia.kriz, oblast, tipKusy,
      citovane: citovane.map((x) => x.clue),
      text1: text1 + cit.t1,
      text2: cit.t2 + text2 + vetaAkcie(zad, S, st, kSpolu, akcia, text2),
    };
  }

  // 3. Every accepted lair is reachable by the rules from any board that
  //    agrees with the solution, so this should not be reachable. An honest
  //    fallback for a damaged or hand made puzzle.
  for (let p = 0; p < n; p++) {
    if (pos[p] === sol[p]) continue;
    return {
      druh: 'odhalenie', pravidlo: 'reveal', vrstva: 3, cislo: -1, kus: p, bunky: [sol[p]], poznamky: [], zapisy: [], kriz: [], oblast: [sol[p]],
      text1: 'No simple step is left from here.',
      text2: 'No simple step is left from here, so here is one piece: ' + M(p) + ' is in ' + bunkaText(n, sol[p]) + '.',
    };
  }
  return null;
}

/* What Hint 2 does to the board, as a new board. game.js wraps it into one
   Undo step; the tests use it to play hints alone. */
export function pouziNapovedu(plocha, zad, h) {
  const pl = kopiaPlochy(plocha);
  if (h.druh === 'chyba') {
    if (h.typ === 'kus') pl.k[h.bunky[0]] = -1;
    else if (h.typ === 'kriz') pl.x[h.bunky[0]] = 0;
    else for (let c = 0; c < pl.m.length; c++) pl.m[c] &= ~(1 << h.kus);
    return pl;
  }
  if (h.druh === 'poloz' || h.druh === 'odhalenie') {
    for (let c = 0; c < pl.k.length; c++) if (pl.k[c] === h.kus) pl.k[c] = -1;
    pl.k[h.bunky[0]] = h.kus;
    pl.x[h.bunky[0]] = 0;
    return pl;
  }
  if (h.druh === 'poznamky' || h.druh === 'kriz') {
    // Every set of notes the step narrowed, and every cell it emptied, in
    // one step (a hint made before the merge carries only kus and poznamky).
    const zapisy = h.zapisy && h.zapisy.length ? h.zapisy : h.druh === 'poznamky' ? [{ kus: h.kus, bunky: h.poznamky }] : [];
    for (const z of zapisy) {
      const set = new Set(z.bunky);
      for (let c = 0; c < pl.m.length; c++) {
        if (set.has(c)) pl.m[c] |= 1 << z.kus;
        else pl.m[c] &= ~(1 << z.kus);
      }
    }
    for (const c of h.kriz || (h.druh === 'kriz' ? h.bunky : [])) pl.x[c] = 1;
    return pl;
  }
  return pl;
}
