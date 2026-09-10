/* Badgers: the rules on a board of numbers, Check and Hint.
 * Pure functions, no DOM. game.js draws what these return; tests-logika.mjs
 * checks that no hint ever contradicts the solution and that hints alone carry
 * an empty board all the way to the finished puzzle.
 *
 * Marks: `v` is a flat n*n array of numbers, 0 for an empty cell and 1 to n
 * for a cell the player has filled in. `cages` is the array of
 * { sum, cells:[index...] }, `solution` the flat n*n array of numbers
 * (generator.mjs).
 */
import { jednotky, solveHuman } from './generator.mjs';

/* Compare the board with the solution. A cell is wrong when the number in it
 * is not the one the puzzle has there. Empty cells are never wrong: Check only
 * ever talks about numbers that are actually written down. */
export function porovnaj(v, solution) {
  const out = { vyplnene: 0, zle: [] };
  for (let i = 0; i < solution.length; i++) {
    if (!v[i]) continue;
    out.vyplnene++;
    if (v[i] !== solution[i]) out.zle.push(i);
  }
  return out;
}

/* Is the board finished? Every cell holds a number 1 to n, every row, column
 * and block holds each number once, and every pen adds up to its total without
 * repeating a number. Does not need the stored solution: a board that
 * satisfies its own totals is the solution, because generateSeeded only
 * accepts puzzles with exactly one. */
export function jeVyriesene(v, cages, n) {
  for (let i = 0; i < n * n; i++) if (!(v[i] >= 1 && v[i] <= n)) return false;
  for (const u of jednotky(n)) {
    let used = 0;
    for (const i of u.cells) {
      const b = 1 << v[i];
      if (used & b) return false;
      used |= b;
    }
  }
  for (const cage of cages) {
    let used = 0, sum = 0;
    for (const i of cage.cells) {
      const b = 1 << v[i];
      if (used & b) return false;
      used |= b;
      sum += v[i];
    }
    if (sum !== cage.sum) return false;
  }
  return true;
}

/* Hint: one next step from the numbers already on the board, as the kind of
 * thing a patient friend would say over your shoulder. Returns
 *   { druh:'chyba'|'bunka'|'odhalenie', pravidlo, vrstva, bunky, text }
 * where bunky is [{ r, c, i, val }] and val is what to write there (1 to n, or
 * 0 to clear a wrong number). Returns null only on a finished puzzle.
 *
 * Order: a wrong number first, because nothing below is sound on a board that
 * already contradicts the solution. Then the simplest rule that finds a new
 * cell while respecting what the player has written: solveHuman runs its
 * layers in order (1 local, 2 patterns across a line or a pen, 3 one step
 * trials) and is stopped after the first step it records, so the hint is
 * always the easiest one available right now. */
export function napoveda(v, cages, solution, n) {
  if (jeVyriesene(v, cages, n)) return null;

  // 0. Wrong numbers first.
  const p = porovnaj(v, solution);
  if (p.zle.length) {
    const i = p.zle[0];
    return {
      druh: 'chyba', pravidlo: 'wrong-number', vrstva: 0,
      bunky: [{ r: (i / n) | 0, c: i % n, i, val: 0 }],
      text: 'This cell does not hold ' + v[i] + ' in the finished puzzle. Clear it before going on.',
    };
  }

  // 1. The easiest rule that finds something new from what is on the board.
  const r = solveHuman(cages, n, { initial: v, limitKrokov: 1 });
  if (r.steps.length) {
    const s = r.steps[0];
    return { druh: 'bunka', pravidlo: s.rule, vrstva: s.layer, bunky: s.cells, text: s.text };
  }

  // Every accepted puzzle is fully reachable by these rules (that is what
  // generateSeeded requires before it accepts one), so this point should not be
  // reachable. Kept as a plain, honest fallback in case a hand-built or damaged
  // puzzle ever gets here.
  for (let i = 0; i < solution.length; i++) {
    if (!v[i]) {
      return {
        druh: 'odhalenie', pravidlo: 'reveal', vrstva: 3,
        bunky: [{ r: (i / n) | 0, c: i % n, i, val: solution[i] }],
        text: 'No simple step from here. This cell holds ' + solution[i] + '.',
      };
    }
  }
  return null;
}
