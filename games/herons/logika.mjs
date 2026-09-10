/* Herons: the rules on a board of drawn paths, Check and Hint.
 * Pure functions, no DOM. game.js draws what these return; tests-logika.mjs
 * checks that no hint ever contradicts the solution and that hints alone
 * carry an empty marsh all the way to the finished puzzle.
 *
 * The board: `v` is a flat n*n array, 0 for a cell no path runs through yet
 * and k for a cell the player has given to the path of pair k. That is the
 * whole state a person can see, so Check and Hint speak in cells, never in
 * the links the solver reasons with. `ends` is the flat n*n array of nests
 * (0 empty, k a nest of pair k) and `solution` the flat n*n array of path
 * numbers (generator.mjs).
 */
import { geometria, solveHuman, stavZBuniek } from './generator.mjs';

function poctyParov(ends) {
  let K = 0;
  for (const x of ends) if (x > K) K = x;
  return K;
}

/* A nest always belongs to its own pair, whether the page draws it as part of
 * the path or leaves it as a bare nest, so both readings of the board mean
 * the same thing here. */
function sHniezdami(v, ends) {
  const w = new Array(ends.length);
  for (let i = 0; i < ends.length; i++) w[i] = (v[i] | 0) || (ends[i] | 0);
  return w;
}

/* Compare the board with the solution. A cell is wrong when the player gave
 * it to a path that does not run through it. Empty cells are never wrong:
 * Check only ever talks about what is actually drawn. */
export function porovnaj(v, solution) {
  const out = { vyplnene: 0, zle: [] };
  for (let i = 0; i < solution.length; i++) {
    const p = v[i] | 0;
    if (!p) continue;
    out.vyplnene++;
    if (p !== solution[i]) out.zle.push(i);
  }
  return out;
}

/* Is the marsh finished? Every cell belongs to a path, every nest to its own
 * pair, every nest cell has exactly one neighbour on its path and every other
 * cell exactly two (so no path branches, crosses or runs beside itself), and
 * the cells of each pair hang together as one path from nest to nest. Does
 * not need the stored solution: a board that keeps every pair happy is the
 * solution, because generateSeeded only accepts puzzles with just one. */
export function jeVyriesene(v0, ends, n) {
  const g = geometria(n);
  const K = poctyParov(ends);
  if (!K) return false;
  const v = sHniezdami(v0, ends);
  for (let i = 0; i < g.C; i++) {
    const p = v[i] | 0;
    if (!p || p > K) return false;
    if (ends[i] && ends[i] !== p) return false;
    let rovnakych = 0;
    for (let d = 0; d < 4; d++) {
      const y = g.cellSused[(i << 2) + d];
      if (y >= 0 && (v[y] | 0) === p) rovnakych++;
    }
    if (rovnakych !== (ends[i] ? 1 : 2)) return false;
  }
  // každá dvojica je jedna súvislá cesta od hniezda k hniezdu
  const hniezda = Array.from({ length: K + 1 }, () => []);
  for (let i = 0; i < g.C; i++) if (ends[i]) hniezda[ends[i]].push(i);
  for (let p = 1; p <= K; p++) {
    if (hniezda[p].length !== 2) return false;
    const videne = new Uint8Array(g.C);
    const q = [hniezda[p][0]];
    videne[q[0]] = 1;
    let pocet = 1;
    for (let t = 0; t < q.length; t++) {
      const b = q[t] << 2;
      for (let d = 0; d < 4; d++) {
        const y = g.cellSused[b + d];
        if (y < 0 || videne[y] || (v[y] | 0) !== p) continue;
        videne[y] = 1; pocet++; q.push(y);
      }
    }
    if (!videne[hniezda[p][1]]) return false;
    let celkom = 0;
    for (let i = 0; i < g.C; i++) if ((v[i] | 0) === p) celkom++;
    if (celkom !== pocet) return false;
  }
  return true;
}

/* Hint: one next cell from the current board, as the kind of thing a patient
 * friend would say over your shoulder. Returns
 *   { druh:'chyba'|'bunka'|'odhalenie', pravidlo, vrstva, bunky, text }
 * where bunky is [{ i, pair }] and pair is the path the cell belongs to (0 on
 * a mistake: clear it). Returns null only on a finished marsh.
 *
 * Order: a wrong cell first, because nothing below is sound on a board that
 * already contradicts the solution. Then the easiest rule that gets as far as
 * naming a cell: solveHuman runs its layers in order (1 local, 2 reach and
 * cut off regions, 3 trials) and is stopped the moment it learns which path
 * some new cell belongs to. Steps it takes on the way are about links the
 * board cannot show, so they are not offered as hints, only their conclusion
 * is. */
export function napoveda(v, ends, solution, n) {
  if (jeVyriesene(v, ends, n)) return null;

  // 0. Wrong cells first.
  const p = porovnaj(v, solution);
  if (p.zle.length) {
    const i = p.zle[0];
    return {
      druh: 'chyba', pravidlo: 'wrong-cell', vrstva: 0,
      bunky: [{ i, pair: 0 }],
      text: 'The path ' + v[i] + ' does not run through this cell. Clear it before going on.',
    };
  }

  // 1. The easiest rule that names a cell, starting from what is drawn.
  const w = sHniezdami(v, ends);
  const r = solveHuman(ends, n, {
    initial: stavZBuniek(w, n), vlastnici: w, dokymBunka: true,
  });
  const krok = r.steps.length ? r.steps[r.steps.length - 1] : null;
  if (krok && krok.cells.length) {
    const bunky = krok.cells.filter((c) => !(v[c.i] | 0));
    if (bunky.length) {
      return { druh: 'bunka', pravidlo: krok.rule, vrstva: krok.layer, bunky, text: krok.text };
    }
  }

  // Every accepted puzzle is fully reachable by these rules (that is what
  // generateSeeded requires before it accepts one), so this point should not
  // be reachable. Kept as a plain, honest fallback in case a hand built or
  // damaged puzzle ever gets here.
  for (let i = 0; i < solution.length; i++) {
    if (!(v[i] | 0)) {
      return {
        druh: 'odhalenie', pravidlo: 'reveal', vrstva: 3,
        bunky: [{ i, pair: solution[i] }],
        text: 'No simple step from here. This cell belongs to the path ' + solution[i] + '.',
      };
    }
  }
  return null;
}
