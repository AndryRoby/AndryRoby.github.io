/* Owls: the rules on the player's board, Check and Hint.
 * Pure functions, no DOM. game.js draws what these return; tests-logika.mjs
 * checks that no hint ever contradicts the solution and that hints alone
 * carry an empty tree all the way to the finished one.
 *
 * The player's board `v` is a flat array of n*n values: 0 an empty branch,
 * 1 a day owl, 2 a night owl, so v = solution + 1 on a finished tree and the
 * board can be handed to the solver with nothing more than a shift by one.
 * The owls that came with the tree (the givens) are in v as well, and never
 * change. `givens` is flat, null for an empty branch, 0 day, 1 night;
 * `solution` is flat, 0 day and 1 night (generator.mjs).
 */
import { solveHuman, porusenia, policko, nazovLinie } from './generator.mjs';

/* Compare the player's owls with the solution. Only the player's own owls
 * are counted and judged: an empty branch is never wrong, and a given owl is
 * right by definition. Returns { sovy, zle } with zle the wrong cells. */
export function porovnaj(v, solution, givens) {
  const out = { sovy: 0, zle: [] };
  for (let i = 0; i < solution.length; i++) {
    if (!v[i] || (givens && givens[i] != null)) continue;
    out.sovy++;
    if (v[i] - 1 !== solution[i]) out.zle.push(i);
  }
  return out;
}

/* Is the board a finished tree? Every branch holds an owl, the givens are
 * as they came, and the three rules hold. Does not need the stored solution:
 * a board that keeps every rule is the answer, because generateSeeded only
 * accepts trees with exactly one. */
export function jeVyriesene(v, givens, n) {
  const C = n * n;
  const g = new Array(C);
  for (let i = 0; i < C; i++) {
    if (v[i] !== 1 && v[i] !== 2) return false;
    if (givens && givens[i] != null && v[i] - 1 !== givens[i]) return false;
    g[i] = v[i] - 1;
  }
  return porusenia(g, n).length === 0;
}

/* Hint: one next step from the player's board, as a patient friend would say
 * it over your shoulder. Returns null only on a finished tree, otherwise
 *   { druh, pravidlo, vrstva, linia, typ, cislo, bunky, hodnoty, text1, text2 }
 *   druh     'chyba' for a wrong owl, otherwise the rule of the step
 *            (pair, gap, full, line, twin, trial)
 *   linia    the line it reads (0..n-1 rows, n..2n-1 columns), -1 for a
 *            trial, which is about one branch
 *   typ      'row' or 'column' for linia, 'cell' for a trial
 *   cislo    the row or column number, counted from 1
 *   bunky    the cells the second press changes, hodnoty what goes there in
 *            the player's values (1 day owl, 2 night owl, 0 take it off)
 *   text1    the first press: where to look and which technique, never which
 *            kind of owl
 *   text2    the second press: the whole reason
 *   retaz    only for a trial: the branches each step of its chain would
 *            fill, in order (text2 names them Step 1, Step 2 ...)
 *   sporLinia  only for a trial: the line where the supposed owl breaks
 * Order: a wrong owl first, because nothing below is sound on a board that
 * already contradicts the solution; then the easiest step the human solver
 * can take from here (solveHuman, one step, lowest layer first). */
export function napoveda(v, givens, solution, n) {
  if (jeVyriesene(v, givens, n)) return null;
  const p = porovnaj(v, solution, givens);
  if (p.zle.length) {
    const i = p.zle[0];
    const { r, c } = policko(i, n);
    return {
      druh: 'chyba', pravidlo: 'wrong-owl', vrstva: 0, linia: r, typ: 'row', cislo: r + 1,
      bunky: [i], hodnoty: [0],
      // game.js adds "Press Hint again to take it off.", so the sentence
      // stops here and the page does not say the same thing twice
      text1: 'There is an owl in row ' + (r + 1) + ' that the finished tree does not have.',
      text2: 'The owl in row ' + (r + 1) + ', column ' + (c + 1) + ' is not like that in the finished tree, so it comes off the branch.',
    };
  }
  const r = solveHuman(givens, n, { initial: v, limitKrokov: 1 });
  if (r.steps.length) {
    const s = r.steps[0];
    const bunka = s.line < 0;
    const typ = bunka ? 'cell' : s.line < n ? 'row' : 'column';
    const cislo = bunka ? policko(s.cells[0], n).r + 1 : (s.line < n ? s.line : s.line - n) + 1;
    const out = {
      druh: s.rule, pravidlo: s.rule, vrstva: s.layer, linia: s.line, typ, cislo,
      bunky: s.cells.slice(), hodnoty: s.vals.map((x) => x + 1),
      text1: s.textBezHodnoty, text2: s.text,
    };
    // A trial: the branches each step of its chain would fill, in order, and
    // the line that breaks, so the second press can number the steps on the
    // tree and outline the break (the chain is only supposed: nothing of it
    // is placed).
    if (bunka) { out.retaz = s.retaz.map((x) => x.slice()); out.sporLinia = s.spor.line; }
    return out;
  }
  // Every accepted tree is reachable by these rules alone (that is what
  // generateSeeded requires before it accepts one), so this point should not
  // be reachable. Kept as a plain, honest fallback for a damaged puzzle.
  for (let i = 0; i < solution.length; i++) {
    if (v[i]) continue;
    const { r: rr, c } = policko(i, n);
    return {
      druh: 'odhalenie', pravidlo: 'reveal', vrstva: 3, linia: rr, typ: 'row', cislo: rr + 1,
      bunky: [i], hodnoty: [solution[i] + 1],
      text1: 'No named rule reaches from here. Hint can settle one branch in ' + nazovLinie(rr, n) + '.',
      text2: 'No named rule reaches from here, so this hint simply settles the branch in row ' + (rr + 1) + ', column ' + (c + 1) + '.',
    };
  }
  return null;
}
