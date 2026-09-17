/* Dormice: the rules on a board of marks, Check and Hint.
 * Pure functions, no DOM. game.js draws what these return; tests-logika.mjs
 * checks that no hint ever contradicts the solution and that hints alone carry
 * an empty board all the way to a finished table.
 *
 * The board (`plocha`) is one N by N array of marks per table, keyed 'a,b'
 * with a < b, where a and b are category indices. A square holds 0 for empty,
 * 1 for a tick and -1 for a cross. That is exactly what part 3.2 of the spec
 * says a square is: one bit of poss[a][b][x], a cross when it is off and a
 * tick when it is the only one left.
 */
import {
  novyStav, nastavMasku, solveHuman, vsetkyPravdive, riesenieZoStavu, polozka,
} from './generator.mjs';

/* The tables of the staircase, left to right and top to bottom. */
export function tabulky(k) {
  const out = [];
  for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) out.push([a, b]);
  return out;
}
export function klucTabulky(a, b) { return a + ',' + b; }

export function prazdnaPlocha(zad) {
  const p = {};
  for (const [a, b] of tabulky(zad.k)) p[klucTabulky(a, b)] = new Array(zad.N * zad.N).fill(0);
  return p;
}

export function znacka(plocha, a, b, r, c, N) {
  const t = plocha[klucTabulky(a, b)];
  return t ? t[r * N + c] : 0;
}

/* The player's marks as a poss state, so the same solver runs over the board
 * the player is looking at. A cross switches the bit off; a tick leaves its
 * row with that one bit. */
export function naMasky(plocha, zad) {
  const k = zad.k, N = zad.N;
  const P = novyStav(k, N);
  for (const [a, b] of tabulky(k)) {
    const t = plocha[klucTabulky(a, b)];
    if (!t) continue;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const v = t[r * N + c];
        if (v === -1) nastavMasku(P, k, N, a, b, r, ((1 << N) - 1) & ~(1 << c));
      }
    }
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) if (t[r * N + c] === 1) nastavMasku(P, k, N, a, b, r, 1 << c);
    }
  }
  return P;
}

/* Compare the board with the solution. Only wrong ticks are counted, never
 * crosses: one wrong tick poisons dozens of squares through the carry between
 * tables, and a raw count of marks would tell a player who made one mistake
 * that they have forty. */
export function porovnaj(plocha, zad) {
  const N = zad.N;
  const out = { fajky: 0, zle: [] };
  for (const [a, b] of tabulky(zad.k)) {
    const t = plocha[klucTabulky(a, b)];
    if (!t) continue;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (t[r * N + c] !== 1) continue;
        out.fajky++;
        const x = zad.solution[a].indexOf(r);
        if (zad.solution[b][x] !== c) out.zle.push({ tab: [a, b], r, c });
      }
    }
  }
  return out;
}

/* Is the table finished? Every square holds a mark (not only the ticks, so
 * every mask really is down to one bit), every row and every column of every
 * table has exactly one tick, the ticks agree from table to table, and every
 * clue is true. Does not look at the stored solution: a board that satisfies
 * its own clues is the solution, because generateSeeded only accepts puzzles
 * with exactly one. Without the explicit rule about crosses a player who put
 * down only the N*(k-1) ticks would have finished the puzzle and the
 * celebration would fire at the wrong moment. */
export function jeVyriesene(plocha, zad) {
  const k = zad.k, N = zad.N;
  const par = {};
  for (const [a, b] of tabulky(k)) {
    const t = plocha[klucTabulky(a, b)];
    if (!t) return false;
    const vRiadku = new Array(N).fill(0);
    const vStlpci = new Array(N).fill(0);
    const kam = new Array(N).fill(-1);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const v = t[r * N + c];
        if (v !== 1 && v !== -1) return false;
        if (v === 1) { vRiadku[r]++; vStlpci[c]++; kam[r] = c; }
      }
    }
    for (let i = 0; i < N; i++) if (vRiadku[i] !== 1 || vStlpci[i] !== 1) return false;
    par[klucTabulky(a, b)] = kam;
  }
  const assign = [Array.from({ length: N }, (_, x) => x)];
  for (let a = 1; a < k; a++) assign.push(par[klucTabulky(0, a)].slice());
  for (const [a, b] of tabulky(k)) {
    if (a === 0) continue;
    for (let x = 0; x < N; x++) if (par[klucTabulky(a, b)][assign[a][x]] !== assign[b][x]) return false;
  }
  return vsetkyPravdive(zad.clues, assign, k, N, zad.ordered);
}

/* Auto cross: after a tick the rest of that row and that column of the same
 * table are crosses, because each item belongs to one dormouse and to no
 * other. Returns the squares to fill in, so the caller can put the whole lot
 * into one Undo step. Carry across (the transitive closure between tables) is
 * deliberately not here: that is a deduction the player has not seen. */
export function autoKriz(plocha, zad, a, b, r, c) {
  const N = zad.N;
  const t = plocha[klucTabulky(a, b)];
  const out = [];
  if (!t) return out;
  for (let i = 0; i < N; i++) {
    if (i !== c && t[r * N + i] === 0) out.push({ tab: [a, b], r, c: i, val: -1 });
    if (i !== r && t[i * N + c] === 0) out.push({ tab: [a, b], r: i, c, val: -1 });
  }
  return out;
}

/* Carry across: the transitive closure between tables, and the one automatic
 * that stays OFF by default however the Auto cross switch is set, because it
 * is already a deduction the player has not seen. A tick at (r, c) of table
 * (a, b) says item r of a and item c of b belong to the same dormouse, so
 * their rows in every third table hold the same marks; this copies the marks
 * one row has into the other, both ways, and never overwrites a mark that is
 * already there. Returns the squares to fill in, so the caller can put the
 * whole lot into one Undo step. */
export function carryAcross(plocha, zad, a, b, r, c) {
  const k = zad.k, N = zad.N;
  const out = [];
  const kopiruj = (x, ix, y, iy) => {
    // rows ix of category x and iy of category y are the same dormouse
    for (let d = 0; d < k; d++) {
      if (d === x || d === y) continue;
      const zdroj = plocha[klucTabulky(Math.min(x, d), Math.max(x, d))];
      const ciel = plocha[klucTabulky(Math.min(y, d), Math.max(y, d))];
      if (!zdroj || !ciel) continue;
      for (let j = 0; j < N; j++) {
        const v1 = x < d ? zdroj[ix * N + j] : zdroj[j * N + ix];
        const v2 = y < d ? ciel[iy * N + j] : ciel[j * N + iy];
        if (v1 === 0 || v2 !== 0) continue;
        out.push(y < d
          ? { tab: [y, d], r: iy, c: j, val: v1 }
          : { tab: [d, y], r: j, c: iy, val: v1 });
      }
    }
  };
  kopiruj(a, r, b, c);
  kopiruj(b, c, a, r);
  return out;
}

/* Hint: one next step from the marks already on the board, as the kind of
 * thing a patient friend would say over your shoulder. Returns
 *   { druh:'chyba'|'policko'|'odhalenie', pravidlo, vrstva, bunky, text }
 * where bunky is [{ tab, r, c, val }] and val is 1 for a tick, 0 for a cross
 * and -1 to clear a wrong tick. Returns null only on a finished puzzle.
 *
 * Order: a wrong tick first, because nothing below is sound on a board that
 * already contradicts the solution. Then the simplest rule that finds a new
 * square while respecting what the player has marked: solveHuman runs its
 * layers in order and is stopped after the first step it records, so the hint
 * is always the easiest one available right now. */
export function napoveda(plocha, zad) {
  if (jeVyriesene(plocha, zad)) return null;

  const p = porovnaj(plocha, zad);
  if (p.zle.length) {
    const z = p.zle[0];
    return {
      druh: 'chyba', pravidlo: 'wrong-tick', vrstva: '0',
      bunky: [{ tab: z.tab, r: z.r, c: z.c, val: -1 }],
      text: polozka(zad, z.tab[0], z.r) + ' does not go with ' + polozka(zad, z.tab[1], z.c)
        + ' in the finished puzzle. Clear that tick before going on.',
    };
  }

  const r = solveHuman(zad, { initial: naMasky(plocha, zad), limitKrokov: 1 });
  if (r.steps.length) {
    const s = r.steps[0];
    // `indicia` is the 0-based clue the step leant on, or -1 when the step came
    // from the board alone. The page needs it for the first press of Hint,
    // which names the clue and the place but never the value.
    return { druh: 'policko', pravidlo: s.rule, vrstva: s.layer, indicia: s.clue, bunky: s.cells, text: s.text };
  }

  // Bookkeeping, not deduction: a square sharing a row or a column with a
  // tick in the same table is a cross. solveHuman keeps that inside its own
  // masks and never reports it as a step, so once every row is settled it
  // stops with nothing more to say while a board played with Auto cross
  // switched off is still half empty. Hint has to be able to say it, and it
  // is offered last, after every real deduction has been tried.
  const N = zad.N;
  for (const [a, b] of tabulky(zad.k)) {
    const t = plocha[klucTabulky(a, b)];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (t[r * N + c] !== 0) continue;
        let vRiadku = -1, vStlpci = -1;
        for (let i = 0; i < N; i++) {
          if (t[r * N + i] === 1) vRiadku = i;
          if (t[i * N + c] === 1) vStlpci = i;
        }
        if (vRiadku >= 0 || vStlpci >= 0) {
          const veta = vRiadku >= 0
            ? polozka(zad, a, r) + ' already goes with ' + polozka(zad, b, vRiadku) + ', so that square is a cross.'
            : polozka(zad, b, c) + ' already goes with ' + polozka(zad, a, vStlpci) + ', so that square is a cross.';
          return {
            druh: 'policko', pravidlo: 'cross-out', vrstva: '1', indicia: -1,
            bunky: [{ tab: [a, b], r, c, val: 0 }],
            text: veta.charAt(0).toUpperCase() + veta.slice(1),
          };
        }
        // The other half of the same bookkeeping: a row or a column with one
        // square left and no tick anywhere in it. The mask is already down to
        // one bit, so the solver has nothing to report, but the square is
        // still blank on the board.
        let vRiadkuPrazdnych = 0, vStlpciPrazdnych = 0;
        for (let i = 0; i < N; i++) {
          if (t[r * N + i] === 0) vRiadkuPrazdnych++;
          if (t[i * N + c] === 0) vStlpciPrazdnych++;
        }
        if (vRiadkuPrazdnych !== 1 && vStlpciPrazdnych !== 1) continue;
        const veta = vRiadkuPrazdnych === 1
          ? 'every other ' + zad.cats[b].jedno + ' is crossed out for ' + polozka(zad, a, r) + ', so that square is a tick.'
          : 'every other ' + zad.cats[a].jedno + ' is crossed out for ' + polozka(zad, b, c) + ', so that square is a tick.';
        return {
          druh: 'policko', pravidlo: 'last-square', vrstva: '1', indicia: -1,
          bunky: [{ tab: [a, b], r, c, val: 1 }],
          text: veta.charAt(0).toUpperCase() + veta.slice(1),
        };
      }
    }
  }

  // Every accepted puzzle is fully reachable by these rules (that is what
  // generateSeeded requires before it accepts one), so this point should not
  // be reachable. Kept as a plain, honest fallback in case a hand built or
  // damaged puzzle ever gets here.
  for (const [a, b] of tabulky(zad.k)) {
    const t = plocha[klucTabulky(a, b)];
    for (let x = 0; x < N; x++) {
      const y = zad.solution[b][zad.solution[a].indexOf(x)];
      if (t[x * N + y] !== 1) {
        return {
          druh: 'odhalenie', pravidlo: 'reveal', vrstva: '3',
          bunky: [{ tab: [a, b], r: x, c: y, val: 1 }],
          text: 'No simple step from here. ' + polozka(zad, a, x) + ' goes with ' + polozka(zad, b, y) + '.',
        };
      }
    }
  }
  return null;
}

/* The state the solver would reach from the player's marks, for Check on a
 * whole table and for the build script. */
export function stavZPlochy(plocha, zad) {
  const P = naMasky(plocha, zad);
  return { poss: P, riesenie: riesenieZoStavu(P, zad.k, zad.N) };
}
