/* Swans: the rules on a board of marks, Check and Hint.
 * Pure functions, no DOM. game.js draws what these return; tests-logika.mjs
 * checks that no hint ever contradicts the solution and that hints alone
 * carry an empty board all the way to the finished loop.
 *
 * Marks: `v` is a flat array of E = 2n(n-1) values in the same order the
 * solver uses (generator.mjs, geometria): the n*(n-1) horizontal steps
 * first, then the (n-1)*n vertical ones. A step joins two neighbouring
 * cells. 0 is an untouched step, 1 a line (the loop runs from one cell to
 * the other), 2 a cross (the player's own note that it does not). `pearls`
 * is a flat n*n array, 0 nothing, 1 a white swan, 2 a black swan.
 * `solution` is { h, v }, each a flat array of 0/1 (generator.mjs).
 */
import { geometria, solveHuman, indexHrany, hrana } from './generator.mjs';

/* n from a packed solution: h has n*(n-1) entries. */
function velkost(solution) {
  const L = solution.h.length;
  return Math.round((1 + Math.sqrt(1 + 4 * L)) / 2);
}
/* The solution as one flat 0/1 array in the solver's order. */
function ploche(solution, n) {
  const g = geometria(n);
  const out = new Uint8Array(g.E);
  for (let i = 0; i < g.H; i++) out[i] = solution.h[i] === 1 ? 1 : 0;
  for (let i = 0; i < g.E - g.H; i++) out[g.V0 + i] = solution.v[i] === 1 ? 1 : 0;
  return out;
}

/* Compare the marks with the solution. A line is wrong when the loop does
 * not run between those two cells; a cross is wrong when it does. Untouched
 * steps are never wrong, and a step the player has not drawn yet is not
 * counted as a mistake either: Check only ever talks about marks that are
 * there. */
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

/* Is the board a finished loop? Every cell has either no line or exactly two
 * (no branch, no cell used twice), every swan is on the loop with the shape
 * it asks for (white straight with a turn just before or just after, black
 * turning with both neighbouring cells straight), and all the lines hang
 * together as one single closed loop. Crosses are ignored, they are only a
 * note. Does not need the stored solution: a board that keeps every swan
 * happy as one loop is the solution, because generateSeeded only accepts
 * puzzles with exactly one. */
export function jeVyriesene(v, pearls, n) {
  const g = geometria(n);
  let total = 0;
  for (let e = 0; e < g.E; e++) if (v[e] === 1) total++;
  if (!total) return false;
  const smery = (i, out) => {
    let k = 0;
    for (let d = 0; d < 4; d++) { const e = g.cellEdges[(i << 2) + d]; if (e >= 0 && v[e] === 1) out[k++] = d; }
    return k;
  };
  const ds = new Int32Array(4), dj = new Int32Array(4);
  let start = -1;
  for (let i = 0; i < g.C; i++) {
    const L = smery(i, ds);
    if (L !== 0 && L !== 2) return false;
    if (L === 2 && start < 0) start = i;
    if (!pearls[i]) continue;
    if (L !== 2) return false;
    const rovno = ds[1] - ds[0] === 2;
    if (pearls[i] === 1) {
      if (!rovno) return false;
      let zabocil = false;
      for (let m = 0; m < 2; m++) {
        const j = g.cellSused[(i << 2) + ds[m]];
        if (j < 0) return false;
        if (smery(j, dj) === 2 && dj[1] - dj[0] !== 2) zabocil = true;
      }
      if (!zabocil) return false;
    } else {
      if (rovno) return false;
      for (let m = 0; m < 2; m++) {
        const d = ds[m], j = g.cellSused[(i << 2) + d];
        if (j < 0) return false;
        if (smery(j, dj) !== 2 || dj[1] - dj[0] !== 2) return false;
        const e2 = g.cellEdges[(j << 2) + d];
        if (e2 < 0 || v[e2] !== 1) return false;
      }
    }
  }
  if (start < 0) return false;
  // Walk from one cell: a single closed loop reaches every drawn step.
  const videne = new Uint8Array(g.E);
  const front = [start];
  const polickoVidene = new Uint8Array(g.C);
  polickoVidene[start] = 1;
  let dosiahnute = 0;
  while (front.length) {
    const i = front.pop();
    for (let d = 0; d < 4; d++) {
      const e = g.cellEdges[(i << 2) + d];
      if (e < 0 || v[e] !== 1 || videne[e]) continue;
      videne[e] = 1; dosiahnute++;
      const j = g.cellSused[(i << 2) + d];
      if (!polickoVidene[j]) { polickoVidene[j] = 1; front.push(j); }
    }
  }
  return dosiahnute === total;
}

/* A step from the human solver, dressed for the page: every step carries its
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
 * loop.
 *
 * Order: a wrong mark first, because nothing below is sound on a board that
 * already contradicts the solution. Then the simplest rule that finds a new
 * step while respecting the marks the player has made: solveHuman runs its
 * layers in order (1 local, 2 patterns between swans, 3 short loop and
 * trials) and is stopped after the first step it records, so the hint is
 * always the easiest one available right now. */
export function napoveda(v, pearls, solution, n) {
  if (jeVyriesene(v, pearls, n)) return null;

  // 0. Wrong marks first.
  const p = porovnaj(v, solution);
  if (p.zleCiary.length) {
    const e = p.zleCiary[0];
    return {
      druh: 'chyba', pravidlo: 'wrong-line', vrstva: 0,
      hrany: [{ ...hrana(e, n), i: e, val: 0 }],
      text: 'The loop does not run between these two cells. Clear the line before going on.',
    };
  }
  if (p.zleKrizky.length) {
    const e = p.zleKrizky[0];
    return {
      druh: 'chyba', pravidlo: 'wrong-cross', vrstva: 0,
      hrany: [{ ...hrana(e, n), i: e, val: 1 }],
      text: 'The loop does run between these two cells. Take the cross off before going on.',
    };
  }

  // 1. The easiest rule that finds something new from what is on the board.
  const r = solveHuman(pearls, n, { initial: v, limitKrokov: 1 });
  if (r.steps.length) {
    const s = r.steps[0];
    return { druh: 'hrana', pravidlo: s.rule, vrstva: s.layer, hrany: hranyKroku(s, n), text: s.text };
  }

  // Every accepted loop is fully reachable by these rules (that is what
  // generateSeeded requires before it accepts one), so this point should not
  // be reachable. Kept as a plain, honest fallback in case a hand-built or
  // damaged puzzle ever gets here.
  const sol = ploche(solution, n);
  for (let e = 0; e < sol.length; e++) {
    if (sol[e] === 1 && v[e] === 0) {
      return {
        druh: 'odhalenie', pravidlo: 'reveal', vrstva: 3,
        hrany: [{ ...hrana(e, n), i: e, val: 1 }],
        text: 'No simple step from here. The loop runs between these two cells.',
      };
    }
  }
  for (let e = 0; e < sol.length; e++) {
    if (sol[e] !== 1 && v[e] === 0) {
      return {
        druh: 'odhalenie', pravidlo: 'reveal', vrstva: 3,
        hrany: [{ ...hrana(e, n), i: e, val: 2 }],
        text: 'No simple step from here. The loop does not run between these two cells.',
      };
    }
  }
  return null;
}
