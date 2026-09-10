/* Voles: the rules on a board of marks, Check and Hint.
 * Pure functions, no DOM. game.js draws what these return; tests-logika.mjs
 * checks that no hint ever contradicts the solution and that hints alone
 * carry an empty board all the way to the finished meadow.
 *
 * Marks: `v` is a flat array of n*n values, one per cell, in the same order
 * the solver uses. 0 is an untouched cell, 1 water (the player has shaded
 * it), 2 a dot, the player's own note that the cell belongs to an island.
 * `clues` is a flat n*n array, a number or null. `solution` is a flat n*n
 * array, 0 an island cell and 1 a water cell (generator.mjs).
 *
 * A cell with a dot and an untouched cell mean the same thing to the rules
 * of the game: both are dry land. The dot is only a note the player makes,
 * so jeVyriesene treats everything that is not shaded as island.
 */
import { geometria, solveHuman, policko } from './generator.mjs';

/* Compare the marks with the solution. Shading is wrong where the meadow
 * stays dry; a dot is wrong where the water goes. Untouched cells are never
 * wrong: Check only ever talks about marks that are there. */
export function porovnaj(v, solution) {
  const out = { voda: 0, bodky: 0, zlaVoda: [], zleBodky: [] };
  for (let i = 0; i < solution.length; i++) {
    if (v[i] === 1) { out.voda++; if (solution[i] !== 1) out.zlaVoda.push(i); }
    else if (v[i] === 2) { out.bodky++; if (solution[i] !== 0) out.zleBodky.push(i); }
  }
  return out;
}

/* Is the board a finished meadow? Everything that is not shaded counts as
 * island. Every island has to hold exactly one number and exactly that many
 * cells, the water has to be there and hang together as one piece, and no
 * two by two block may be all water. Islands never touching by a side falls
 * out of the same check: two islands that touch are one piece, and one piece
 * with two numbers is not allowed. Does not need the stored solution: a board
 * that satisfies its own numbers is the answer, because generateSeeded only
 * ever accepts puzzles with exactly one. */
export function jeVyriesene(v, clues, n) {
  const g = geometria(n), C = g.C, sus = g.susedia;
  let voda = 0, prva = -1;
  for (let i = 0; i < C; i++) if (v[i] === 1) { voda++; if (prva < 0) prva = i; }
  if (!voda) return false;

  for (let r = 0; r + 1 < n; r++) {
    for (let c = 0; c + 1 < n; c++) {
      const i = r * n + c;
      if (v[i] === 1 && v[i + 1] === 1 && v[i + n] === 1 && v[i + n + 1] === 1) return false;
    }
  }

  const videne = new Uint8Array(C);
  const front = [prva];
  videne[prva] = 1;
  let dosiahnute = 1;
  while (front.length) {
    const x = front.pop();
    for (let m = 0; m < 4; m++) {
      const y = sus[4 * x + m];
      if (y >= 0 && v[y] === 1 && !videne[y]) { videne[y] = 1; dosiahnute++; front.push(y); }
    }
  }
  if (dosiahnute !== voda) return false;

  const hotove = new Uint8Array(C);
  for (let i = 0; i < C; i++) {
    if (v[i] === 1 || hotove[i]) continue;
    let velkost = 0, cisel = 0, hodnota = -1;
    const stack = [i];
    hotove[i] = 1;
    while (stack.length) {
      const x = stack.pop();
      velkost++;
      if (clues[x] != null) { cisel++; hodnota = clues[x]; }
      for (let m = 0; m < 4; m++) {
        const y = sus[4 * x + m];
        if (y >= 0 && v[y] !== 1 && !hotove[y]) { hotove[y] = 1; stack.push(y); }
      }
    }
    if (cisel !== 1 || velkost !== hodnota) return false;
  }
  return true;
}

/* A step from the human solver, dressed for the page: every cell carries its
 * flat index `i` as well as its row and column, so game.js can apply a hint
 * without converting anything. */
function bunkyKroku(step) {
  return step.cells.map((b) => ({ ...b }));
}

/* Hint: one next step from the current marks, as the kind of thing a patient
 * friend would say over your shoulder. Returns
 *   { druh:'chyba'|'bunka'|'odhalenie', pravidlo, vrstva, bunky, text }
 * where bunky is [{ i, r, c, val }] and val is what to put there (1 water,
 * 2 a dot for island, 0 to clear a wrong mark). Returns null only on a
 * finished meadow.
 *
 * Order: a wrong mark first, because nothing below is sound on a board that
 * already contradicts the solution. Then the simplest rule that finds a new
 * cell while respecting the marks the player has made: solveHuman runs its
 * layers in order (1 local, 2 looking further, 3 a trial) and is stopped
 * after the first step it records, so the hint is always the easiest one
 * available right now. */
export function napoveda(v, clues, solution, n) {
  if (jeVyriesene(v, clues, n)) return null;

  // 0. Wrong marks first.
  const p = porovnaj(v, solution);
  if (p.zlaVoda.length) {
    const i = p.zlaVoda[0];
    return {
      druh: 'chyba', pravidlo: 'wrong-water', vrstva: 0,
      bunky: [{ i, ...policko(i, n), val: 0 }],
      text: 'The water does not reach this cell. Clear the shading before going on.',
    };
  }
  if (p.zleBodky.length) {
    const i = p.zleBodky[0];
    return {
      druh: 'chyba', pravidlo: 'wrong-dot', vrstva: 0,
      bunky: [{ i, ...policko(i, n), val: 1 }],
      text: 'This cell is under water after all. Take the dot off before going on.',
    };
  }

  // 1. The easiest rule that finds something new from what is on the board.
  const r = solveHuman(clues, n, { initial: v, limitKrokov: 1 });
  if (r.steps.length) {
    const s = r.steps[0];
    return { druh: 'bunka', pravidlo: s.rule, vrstva: s.layer, bunky: bunkyKroku(s), text: s.text };
  }

  // Every accepted meadow is fully reachable by these rules (that is what
  // generateSeeded requires before it accepts one), so this point should not
  // be reachable. Kept as a plain, honest fallback in case a hand built or
  // damaged puzzle ever gets here.
  for (let i = 0; i < solution.length; i++) {
    if (solution[i] === 1 && v[i] !== 1) {
      return {
        druh: 'odhalenie', pravidlo: 'reveal', vrstva: 3,
        bunky: [{ i, ...policko(i, n), val: 1 }],
        text: 'No simple step from here. This cell is water.',
      };
    }
  }
  for (let i = 0; i < solution.length; i++) {
    if (solution[i] === 0 && v[i] !== 2) {
      return {
        druh: 'odhalenie', pravidlo: 'reveal', vrstva: 3,
        bunky: [{ i, ...policko(i, n), val: 2 }],
        text: 'No simple step from here. This cell belongs to an island.',
      };
    }
  }
  return null;
}
