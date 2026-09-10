/* Otters: the rules on a board of marks, Check and Hint.
 * Pure functions, no DOM. game.js draws what these return; tests-logika.mjs
 * checks that no hint ever contradicts the solution and that hints alone
 * carry an empty board all the way to the finished river.
 *
 * Marks: `v` is a flat array of E = 2n(n+1) values in the same order the
 * solver uses (generator.mjs, geometria): the (n+1)*n horizontal edges
 * first, then the n*(n+1) vertical ones. 0 is an untouched side, 1 a line
 * (the river runs here), 2 a cross (the player's own note that it does
 * not). `clues` is a flat n*n array of 0..3 or null. `solution` is
 * { h, v }, each a flat array of 0/1 (generator.mjs).
 */
import { geometria, solveHuman, indexHrany, hrana } from './generator.mjs';

/* n from a packed solution: h has n*(n+1) entries. */
function velkost(solution) {
  const L = solution.h.length;
  return Math.round((Math.sqrt(1 + 4 * L) - 1) / 2);
}
/* The solution as one flat 0/1 array in the solver's edge order. */
function ploche(solution, n) {
  const g = geometria(n);
  const out = new Uint8Array(g.E);
  for (let i = 0; i < g.H; i++) out[i] = solution.h[i] === 1 ? 1 : 0;
  for (let i = 0; i < g.E - g.H; i++) out[g.V0 + i] = solution.v[i] === 1 ? 1 : 0;
  return out;
}

/* Compare the marks with the solution. A line is wrong when the river does
 * not run along that side; a cross is wrong when it does. Untouched sides
 * are never wrong, and a side the player has not drawn yet is not counted as
 * a mistake either: Check only ever talks about marks that are there. */
export function porovnaj(v, solution) {
  const n = velkost(solution);
  const s = ploche(solution, n);
  const out = { ciary: 0, krizky: 0, zleCiary: [], zleKrizky: [] };
  for (let e = 0; e < s.length; e++) {
    if (v[e] === 1) { out.ciary++; if (s[e] !== 1) out.zleCiary.push(e); }
    else if (v[e] === 2) { out.krizky++; if (s[e] === 1) out.zleKrizky.push(e); }
  }
  return out;
}

/* Is the board a finished river? Every patch with a number has exactly that
 * many of its sides drawn, every dot has either no line or exactly two (no
 * branch, no crossing), and all the lines hang together as one single closed
 * loop. Crosses are ignored, they are only a note. Does not need the stored
 * solution: a board that satisfies its own numbers as one loop is the
 * solution, because generateSeeded only accepts puzzles with exactly one. */
export function jeVyriesene(v, clues, n) {
  const g = geometria(n);
  let total = 0;
  for (let e = 0; e < g.E; e++) if (v[e] === 1) total++;
  if (!total) return false;
  for (let i = 0; i < g.C; i++) {
    if (clues[i] == null) continue;
    let L = 0;
    for (let m = 0; m < 4; m++) if (v[g.cellEdges[4 * i + m]] === 1) L++;
    if (L !== clues[i]) return false;
  }
  let start = -1;
  for (let d = 0; d < g.D; d++) {
    let L = 0;
    for (let m = 0; m < 4; m++) { const e = g.dotEdges[4 * d + m]; if (e >= 0 && v[e] === 1) L++; }
    if (L !== 0 && L !== 2) return false;
    if (L === 2 && start < 0) start = d;
  }
  if (start < 0) return false;
  // Walk from one dot: a single closed loop reaches every drawn side.
  const videne = new Uint8Array(g.E);
  const front = [start];
  const bodkaVidena = new Uint8Array(g.D);
  bodkaVidena[start] = 1;
  let dosiahnute = 0;
  while (front.length) {
    const d = front.pop();
    for (let m = 0; m < 4; m++) {
      const e = g.dotEdges[4 * d + m];
      if (e < 0 || v[e] !== 1 || videne[e]) continue;
      videne[e] = 1; dosiahnute++;
      const a = g.edgeDots[2 * e], b = g.edgeDots[2 * e + 1];
      const iny = a === d ? b : a;
      if (!bodkaVidena[iny]) { bodkaVidena[iny] = 1; front.push(iny); }
    }
  }
  return dosiahnute === total;
}

/* A step from the human solver, dressed for the page: every edge carries its
 * flat index `i` as well as its { typ, r, c } address, so game.js can apply
 * a hint without converting anything. */
function hranyKroku(step, n) {
  return step.edges.map((e) => ({ ...e, i: indexHrany(e.typ, e.r, e.c, n) }));
}

/* Hint: one next step from the current marks, as the kind of thing a patient
 * friend would say over your shoulder. Returns
 *   { druh:'chyba'|'hrana'|'odhalenie', hrany, text, pravidlo, vrstva }
 * where hrany is [{ typ, r, c, i, val }] and val is what to put there (1 a
 * line, 2 a cross, 0 to clear a wrong mark). Returns null only on a finished
 * river.
 *
 * Order: a wrong mark first, because nothing below is sound on a board that
 * already contradicts the solution. Then the simplest rule that finds a new
 * side while respecting the marks the player has made: solveHuman runs its
 * layers in order (1 local, 2 patterns, 3 short loop and trials) and is
 * stopped after the first step it records, so the hint is always the easiest
 * one available right now. */
export function napoveda(v, clues, solution, n) {
  if (jeVyriesene(v, clues, n)) return null;

  // 0. Wrong marks first.
  const p = porovnaj(v, solution);
  if (p.zleCiary.length) {
    const e = p.zleCiary[0];
    return {
      druh: 'chyba', pravidlo: 'wrong-line', vrstva: 0,
      hrany: [{ ...hrana(e, n), i: e, val: 0 }],
      text: 'The river does not run along this side. Clear the line before going on.',
    };
  }
  if (p.zleKrizky.length) {
    const e = p.zleKrizky[0];
    return {
      druh: 'chyba', pravidlo: 'wrong-cross', vrstva: 0,
      hrany: [{ ...hrana(e, n), i: e, val: 1 }],
      text: 'The river does run along this side. Take the cross off before going on.',
    };
  }

  // 1. The easiest rule that finds something new from what is on the board.
  const r = solveHuman(clues, n, { initial: v, limitKrokov: 1 });
  if (r.steps.length) {
    const s = r.steps[0];
    return { druh: 'hrana', pravidlo: s.rule, vrstva: s.layer, hrany: hranyKroku(s, n), text: s.text };
  }

  // Every accepted river is fully reachable by these rules (that is what
  // generateSeeded requires before it accepts one), so this point should not
  // be reachable. Kept as a plain, honest fallback in case a hand-built or
  // damaged puzzle ever gets here.
  const sol = ploche(solution, n);
  for (let e = 0; e < sol.length; e++) {
    if (sol[e] === 1 && v[e] === 0) {
      return {
        druh: 'odhalenie', pravidlo: 'reveal', vrstva: 3,
        hrany: [{ ...hrana(e, n), i: e, val: 1 }],
        text: 'No simple step from here. The river runs along this side.',
      };
    }
  }
  for (let e = 0; e < sol.length; e++) {
    if (sol[e] !== 1 && v[e] === 0) {
      return {
        druh: 'odhalenie', pravidlo: 'reveal', vrstva: 3,
        hrany: [{ ...hrana(e, n), i: e, val: 2 }],
        text: 'No simple step from here. The river does not run along this side.',
      };
    }
  }
  return null;
}
