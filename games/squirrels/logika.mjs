/* Squirrels: the rules on a board of numbers, Check and Hint.
 * Pure functions, no DOM. game.js draws what these return; tests-logika.mjs
 * checks that no hint ever contradicts the solution and that hints alone
 * carry an empty board all the way to the finished puzzle.
 *
 * Marks: `v` is a flat n*n array of numbers, 0 for an empty hollow and 1 to 9
 * for a hollow the player has filled in; trunks stay 0 and are never touched.
 * `cells` is the flat n*n array of null (a hollow) and { r, d } (a trunk with
 * the total of the run to its right and the run below it), `solution` the
 * flat n*n array of digits with 0 on every trunk (generator.mjs).
 */
import { behy, solveHuman } from './generator.mjs';

/* Compare the board with the solution. A hollow is wrong when the number in
 * it is not the one the puzzle has there. Empty hollows are never wrong:
 * Check only ever talks about numbers that are actually written down. */
export function porovnaj(v, solution) {
  const out = { vyplnene: 0, zle: [] };
  for (let i = 0; i < solution.length; i++) {
    if (solution[i] === 0) continue;
    if (!v[i]) continue;
    out.vyplnene++;
    if (v[i] !== solution[i]) out.zle.push(i);
  }
  return out;
}

/* Is the board finished? Every hollow holds a number 1 to 9, every run adds
 * up to the total on its sign, and no number repeats inside a run. Does not
 * need the stored solution: a board that satisfies its own signs is the
 * solution, because generateSeeded only accepts puzzles with exactly one. */
export function jeVyriesene(v, cells, n) {
  const { runs } = behy(cells, n);
  for (let i = 0; i < n * n; i++) {
    if (cells[i] !== null) continue;
    if (!(v[i] >= 1 && v[i] <= 9)) return false;
  }
  for (const run of runs) {
    let sum = 0, used = 0;
    for (const i of run.cells) {
      const b = 1 << v[i];
      if (used & b) return false;
      used |= b;
      sum += v[i];
    }
    if (run.sum != null && sum !== run.sum) return false;
  }
  return true;
}

/* Hint: one next step from the numbers already on the board, as the kind of
 * thing a patient friend would say over your shoulder. Returns
 *   { druh:'chyba'|'bunka'|'odhalenie', pravidlo, vrstva, bunky, text }
 * where bunky is [{ r, c, i, val }] and val is what to write there (1 to 9,
 * or 0 to clear a wrong number). Returns null only on a finished puzzle.
 *
 * Order: a wrong number first, because nothing below is sound on a board that
 * already contradicts the solution. Then the simplest rule that finds a new
 * hollow while respecting what the player has written: solveHuman runs its
 * layers in order (1 local, 2 patterns inside a run, 3 one step trials) and
 * is stopped after the first step it records, so the hint is always the
 * easiest one available right now. */
export function napoveda(v, cells, solution, n) {
  if (jeVyriesene(v, cells, n)) return null;

  // 0. Wrong numbers first.
  const p = porovnaj(v, solution);
  if (p.zle.length) {
    const i = p.zle[0];
    return {
      druh: 'chyba', pravidlo: 'wrong-number', vrstva: 0,
      bunky: [{ r: (i / n) | 0, c: i % n, i, val: 0 }],
      text: 'This hollow does not hold ' + v[i] + ' in the finished puzzle. Clear it before going on.',
    };
  }

  // 1. The easiest rule that finds something new from what is on the board.
  const r = solveHuman(cells, n, { initial: v, limitKrokov: 1 });
  if (r.steps.length) {
    const s = r.steps[0];
    return { druh: 'bunka', pravidlo: s.rule, vrstva: s.layer, bunky: s.cells, text: s.text };
  }

  // Every accepted puzzle is fully reachable by these rules (that is what
  // generateSeeded requires before it accepts one), so this point should not
  // be reachable. Kept as a plain, honest fallback in case a hand-built or
  // damaged puzzle ever gets here.
  for (let i = 0; i < solution.length; i++) {
    if (solution[i] >= 1 && !v[i]) {
      return {
        druh: 'odhalenie', pravidlo: 'reveal', vrstva: 3,
        bunky: [{ r: (i / n) | 0, c: i % n, i, val: solution[i] }],
        text: 'No simple step from here. This hollow holds ' + solution[i] + '.',
      };
    }
  }
  return null;
}
