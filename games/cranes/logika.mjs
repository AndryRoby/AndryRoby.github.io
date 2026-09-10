/* Cranes: the rules on a board of walkways, Check and Hint.
 * Pure functions, no DOM. game.js draws what these return; tests-logika.mjs
 * checks that no hint ever contradicts the solution and that hints alone
 * carry an empty board all the way to the finished puzzle.
 *
 * Marks: `v` is a flat array with one entry per pair of sandbanks that stand
 * in line, in the order graf() lists them (sorted by the lower index, then
 * the higher). The value is how many walkways the player has drawn there: 0,
 * 1 or 2. There is no cross mark, so 0 means "nothing drawn yet", never "no
 * walkway will ever go here". `islands` is [{ r, c, n }] in reading order and
 * `bridges` is [{ a, b, k }] (generator.mjs), the puzzle's own walkways.
 */
import { graf, solveHuman, poleLaviek } from './generator.mjs';

function fraza(val) {
  return val === 0 ? 'no walkway' : val === 1 ? 'one walkway' : 'two walkways';
}

/* Compare the walkways with the solution. A pair with more walkways than the
 * solution has is a mistake; a pair with fewer is simply not finished, and
 * Check never counts that as a mistake. Crossings and sandbanks over their
 * number are wrong on their own, without looking at the solution at all, so
 * they are reported separately: those are the two things a player can see for
 * themselves once they are pointed at.
 * Returns { lavky, zleDvojice, krizenia, prekrocene }, all as indices into
 * the pair list (prekrocene as sandbank indices). */
export function porovnaj(v, bridges, islands, n, g = graf(islands, n)) {
  const sol = poleLaviek(bridges, g);
  const out = { lavky: 0, zleDvojice: [], krizenia: [], prekrocene: [] };
  for (let e = 0; e < g.E; e++) {
    const x = v[e] | 0;
    out.lavky += x;
    if (x > sol[e]) out.zleDvojice.push(e);
  }
  for (let e = 0; e < g.E; e++) {
    if ((v[e] | 0) < 1) continue;
    for (const f of g.krizenia[e]) if ((v[f] | 0) >= 1) { out.krizenia.push(e); break; }
  }
  for (let i = 0; i < g.C; i++) {
    let s = 0;
    for (const e of g.hraneOstrova[i]) s += v[e] | 0;
    if (s > islands[i].n) out.prekrocene.push(i);
  }
  return out;
}

/* Is the board finished? Every sandbank has exactly as many walkways as its
 * number, no two walkways cross, and every sandbank can be reached from every
 * other. Does not need the stored solution: a board that satisfies its own
 * numbers in one piece is the solution, because generateSeeded only accepts
 * puzzles with exactly one. */
export function jeVyriesene(v, islands, n, g = graf(islands, n)) {
  for (let i = 0; i < g.C; i++) {
    let s = 0;
    for (const e of g.hraneOstrova[i]) s += v[e] | 0;
    if (s !== islands[i].n) return false;
  }
  for (let e = 0; e < g.E; e++) {
    if ((v[e] | 0) < 1) continue;
    for (const f of g.krizenia[e]) if ((v[f] | 0) >= 1) return false;
  }
  // všetky ostrovy v jednom celku
  if (g.C === 0) return false;
  const videne = new Uint8Array(g.C);
  const front = [0];
  videne[0] = 1;
  let dosiahnute = 1;
  while (front.length) {
    const i = front.pop();
    for (const e of g.hraneOstrova[i]) {
      if ((v[e] | 0) < 1) continue;
      const j = g.pary[e].a === i ? g.pary[e].b : g.pary[e].a;
      if (videne[j]) continue;
      videne[j] = 1; dosiahnute++; front.push(j);
    }
  }
  return dosiahnute === g.C;
}

/* Hint: one next step from the walkways already drawn, as the kind of thing a
 * patient friend would say over your shoulder. Returns
 *   { druh:'chyba'|'lavka'|'odhalenie', dvojice, text, pravidlo, vrstva }
 * where dvojice is [{ e, a, b, val }] and val is how many walkways belong
 * there. Returns null only on a finished board.
 *
 * Order: a pair with too many walkways first, because nothing below is sound
 * on a board that already contradicts the solution. Then the easiest rule
 * that finds something new. The human solver is given the drawn walkways as
 * lower bounds, not as final counts, so a pair the player has drawn once and
 * means to draw twice is never treated as a mistake.
 *
 * A step that only rules a pair out (val 0) has nothing to show on the board,
 * because the board has no cross mark for a pair. The solver is therefore let
 * run until the first step that actually puts a walkway down, and that is the
 * step the hint talks about. */
export function napoveda(v, islands, bridges, n, g = graf(islands, n)) {
  if (jeVyriesene(v, islands, n, g)) return null;
  const sol = poleLaviek(bridges, g);

  // 0. Too many walkways somewhere: that has to go first.
  for (let e = 0; e < g.E; e++) {
    if ((v[e] | 0) <= sol[e]) continue;
    return {
      druh: 'chyba', pravidlo: 'wrong-count', vrstva: 0,
      dvojice: [{ e, a: g.pary[e].a, b: g.pary[e].b, val: sol[e] }],
      text: sol[e] === 0
        ? 'No walkway runs between these two sandbanks. Take it off before going on.'
        : 'Only ' + fraza(sol[e]) + ' runs between these two sandbanks. Take the other one off before going on.',
    };
  }

  // 1. The easiest rule that puts a new walkway down.
  const r = solveHuman(islands, n, { initial: v, stopPriLavke: true, graf: g });
  for (let x = r.steps.length - 1; x >= 0; x--) {
    const s = r.steps[x];
    if (!s.edges.some((d) => d.val > (v[g.indexPary(d.a, d.b)] | 0))) continue;
    return {
      druh: 'lavka', pravidlo: s.rule, vrstva: s.layer,
      dvojice: s.edges.map((d) => ({ e: g.indexPary(d.a, d.b), a: d.a, b: d.b, val: d.val })),
      text: s.text,
    };
  }

  // Every accepted puzzle is fully reachable by these rules (that is what
  // generateSeeded requires before it accepts one), so this point should not
  // be reachable. Kept as a plain, honest fallback in case a hand built or
  // damaged puzzle ever gets here.
  for (let e = 0; e < g.E; e++) {
    if (sol[e] > (v[e] | 0)) {
      return {
        druh: 'odhalenie', pravidlo: 'reveal', vrstva: 3,
        dvojice: [{ e, a: g.pary[e].a, b: g.pary[e].b, val: sol[e] }],
        text: 'No simple step from here. ' + fraza(sol[e]).charAt(0).toUpperCase() + fraza(sol[e]).slice(1)
          + ' runs between these two sandbanks.',
      };
    }
  }
  return null;
}
