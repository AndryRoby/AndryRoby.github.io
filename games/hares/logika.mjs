/* Hares: the rules on a board of numbers, Check and Hint.
 * Pure functions, no DOM. game.js draws what these return; tests-logika.mjs
 * checks that no hint ever contradicts the solution and that hints alone
 * carry an empty board all the way to the finished puzzle.
 *
 * Marks: `v` is a flat n*n array of numbers, 0 for an empty burrow and 1 to
 * n for a burrow that holds a number (the givens are part of it, the player
 * only adds to them). `givens` is the flat n*n array the puzzle starts from
 * (0 where the player has to think), `solution` the flat n*n array of the
 * finished meadow, and `rules` is { knight, king } for the day
 * (generator.mjs).
 */
import { solveHuman, jadro, konflikty, sediPravidlam } from './generator.mjs';

/* Compare the board with the solution. A burrow is wrong when the number in
 * it is not the one the puzzle has there. Empty burrows are never wrong:
 * Check only ever talks about numbers that are actually written down. */
export function porovnaj(v, solution) {
  const out = { vyplnene: 0, zle: [] };
  for (let i = 0; i < solution.length; i++) {
    if (!v[i]) continue;
    out.vyplnene++;
    if (v[i] !== solution[i]) out.zle.push(i);
  }
  return out;
}

/* Is the board finished? Every burrow holds a number, every row, column and
 * block holds each number once, and no two burrows a knight leap apart (on
 * the king days, no two touching burrows either) hold the same number. Does
 * not need the stored solution: a board that satisfies its own rules is the
 * solution, because generateSeeded only accepts puzzles with exactly one. */
export function jeVyriesene(v, n, rules) {
  return sediPravidlam(v, n, rules);
}

/* Every burrow that breaks a rule against another burrow on the board.
 * Used by Check for a board the player is still filling in. */
export { konflikty };

/* The burrows a selected burrow keeps an eye on: `skok` a knight leap away
 * and `dotyk` touching it (empty when the king rule is off). The board can
 * shade them as a help; it says nothing about whether anything is right. */
export function dosah(i, n, rules) {
  const J = jadro(n, rules);
  return { skok: Array.from(J.skok[i]), dotyk: Array.from(J.kral[i]) };
}

/* Rows, columns and blocks that are full and hold no repeat, so the board
 * can quieten them down. Each one as { kind, idx, cells }. */
export function hotoveJednotky(v, n, rules) {
  const J = jadro(n, rules);
  const out = [];
  for (const u of J.units) {
    let m = 0, ok = true;
    for (const i of u.cells) {
      const d = v[i];
      if (!(d >= 1 && d <= n) || (m & (1 << d))) { ok = false; break; }
      m |= 1 << d;
    }
    if (ok) out.push({ kind: u.kind, idx: u.idx, cells: u.cells.slice() });
  }
  return out;
}

/* Hint: one next step from the numbers already on the board, as the kind of
 * thing a patient friend would say over your shoulder. Returns
 *   { druh:'chyba'|'bunka'|'odhalenie', pravidlo, vrstva, bunky, text }
 * where bunky is [{ r, c, i, val }] and val is what to write there (1 to n,
 * or 0 to clear a wrong number). Returns null only on a finished puzzle.
 *
 * Order: a wrong number first, because nothing below is sound on a board
 * that already contradicts the solution. Then the simplest rule that finds a
 * new burrow while respecting what the player has written: solveHuman runs
 * its layers in order (1 what one burrow or one row, column or block says on
 * its own, 2 the patterns and the knight leap, 3 one step trials) and is
 * stopped after the first step it records, so the hint is always the easiest
 * one available right now. */
export function napoveda(v, givens, solution, n, rules) {
  if (jeVyriesene(v, n, rules)) return null;

  // 0. Wrong numbers first.
  const p = porovnaj(v, solution);
  if (p.zle.length) {
    const i = p.zle[0];
    return {
      druh: 'chyba', pravidlo: 'wrong-number', vrstva: 0,
      bunky: [{ r: (i / n) | 0, c: i % n, i, val: 0 }],
      text: 'This burrow does not hold ' + v[i] + ' in the finished meadow. Clear it before going on.',
    };
  }

  // 1. The easiest rule that finds something new from what is on the board.
  const r = solveHuman(givens, n, rules, { initial: v, limitKrokov: 1 });
  if (r.steps.length) {
    const s = r.steps[0];
    return { druh: 'bunka', pravidlo: s.rule, vrstva: s.layer, bunky: s.cells, text: s.text };
  }

  // Every accepted puzzle is fully reachable by these rules (that is what
  // generateSeeded requires before it accepts one), so this point should not
  // be reachable. Kept as a plain, honest fallback in case a hand-built or
  // damaged puzzle ever gets here.
  for (let i = 0; i < solution.length; i++) {
    if (!v[i]) {
      return {
        druh: 'odhalenie', pravidlo: 'reveal', vrstva: 3,
        bunky: [{ r: (i / n) | 0, c: i % n, i, val: solution[i] }],
        text: 'No simple step from here. This burrow holds ' + solution[i] + '.',
      };
    }
  }
  return null;
}
