/* Magpies: the rules on a board of marks, Check and Hint.
 * Pure functions, no DOM. game.js draws what these return; tests-logika.mjs
 * checks that no hint ever contradicts the solution.
 *
 * Marks: v is a flat array of n*n values, 0 empty (unmarked), 1 filled,
 * 2 cross (a note the player left meaning "nothing here"). clues is
 * { rows, cols }, each an array of n block-length arrays (generator.mjs).
 */
import { riesRiadok } from './generator.mjs';

/* Compare the marks with the solution. A filled mark is wrong when the
 * solution has nothing there; a cross is wrong when the solution has a
 * filled cell there. Empty (unmarked) cells are never wrong. */
export function porovnaj(v, solution) {
  const out = { vyplnene: 0, krizky: 0, zleVyplnene: [], zleKrizky: [] };
  for (let i = 0; i < v.length; i++) {
    if (v[i] === 1) { out.vyplnene++; if (solution[i] !== 1) out.zleVyplnene.push(i); }
    else if (v[i] === 2) { out.krizky++; if (solution[i] === 1) out.zleKrizky.push(i); }
  }
  return out;
}

/* Is the board a full, valid solution? Every row and every column's filled
 * cells must form exactly the blocks its clue says, in order. Crosses are
 * ignored (treated the same as unmarked): they are only a player's note,
 * never part of what is judged. Does not need the stored solution: a board
 * that matches its own clues has exactly one solution and this is it. */
export function jeVyriesene(v, clues) {
  const n = clues.rows.length;
  for (let r = 0; r < n; r++) {
    if (!zhoduje(v, (c) => r * n + c, n, clues.rows[r])) return false;
  }
  for (let c = 0; c < n; c++) {
    if (!zhoduje(v, (r) => r * n + c, n, clues.cols[c])) return false;
  }
  return true;
}
function zhoduje(v, indexOf, n, blocks) {
  const found = [];
  let run = 0;
  for (let k = 0; k < n; k++) {
    if (v[indexOf(k)] === 1) run++;
    else { if (run) found.push(run); run = 0; }
  }
  if (run) found.push(run);
  return found.length === blocks.length && found.every((x, i) => x === blocks[i]);
}

/* Turns the player's marks for one line into the -1/0/1 `known` array
 * riesRiadok expects: a cross is a confirmed empty cell, an unmarked cell
 * is still unknown. */
function znameZLinie(v, indexOf, n) {
  const known = new Array(n);
  for (let k = 0; k < n; k++) {
    const m = v[indexOf(k)];
    known[k] = m === 1 ? 1 : m === 2 ? 0 : -1;
  }
  return known;
}

function vysvetli(druhSlovo, cislo, blocks, pocet, vyplnaSa) {
  const slovoBuniek = pocet === 1 ? 'cell' : 'cells';
  const akcia = vyplnaSa ? (pocet === 1 ? 'is filled' : 'are filled') : (pocet === 1 ? 'stays empty' : 'stay empty');
  const zaimeno = pocet === 1 ? 'it' : 'they';
  if (blocks.length === 1) {
    return druhSlovo + ' ' + cislo + ': the ' + blocks[0] + '-block cannot avoid the marked ' + slovoBuniek + ', so ' + zaimeno + ' ' + akcia + '.';
  }
  return druhSlovo + ' ' + cislo + ': every way to place its blocks (' + blocks.join(', ') + ') agrees on the marked ' + slovoBuniek + ', so ' + zaimeno + ' ' + akcia + '.';
}

/* Hint: one next step from the current marks, as the kind of thing a
 * patient friend would say over your shoulder. Returns
 *   { druh:'chyba'|'riadok'|'stlpec', cislo, bunky:[i], hodnota:0|1|2, text }
 * bunky are the cells to mark, hodnota what to put there (1 filled, 2 cross,
 * 0 clear a wrong mark). Returns null only for a solved board.
 *
 * Order: a wrong mark first (nothing below is sound on a wrong board); then
 * the first row or column where line logic (respecting the player's marks
 * so far, crosses included) can pin down at least one more cell. */
export function napoveda(v, clues, solution) {
  const n = clues.rows.length;
  if (jeVyriesene(v, clues)) return null;

  // 0. Wrong marks first.
  const p = porovnaj(v, solution);
  if (p.zleVyplnene.length) {
    return { druh: 'chyba', bunky: [p.zleVyplnene[0]], hodnota: 0,
      text: 'This cell is not filled in the solution. Clear it before going on.' };
  }
  if (p.zleKrizky.length) {
    return { druh: 'chyba', bunky: [p.zleKrizky[0]], hodnota: 1,
      text: 'This cell is filled in the solution. Change the cross before going on.' };
  }

  // 1. Rows, then columns: the first line where logic finds something new.
  for (let r = 0; r < n; r++) {
    const idx = (c) => r * n + c;
    const known = znameZLinie(v, idx, n);
    const res = riesRiadok(clues.rows[r], n, known);
    if (!res.ok) continue; // cannot happen on a board with no wrong marks
    const noveVyplnene = [], novePrazdne = [];
    for (let c = 0; c < n; c++) {
      if (known[c] !== -1 || res.grid[c] === -1) continue;
      (res.grid[c] === 1 ? noveVyplnene : novePrazdne).push(idx(c));
    }
    if (noveVyplnene.length) {
      return { druh: 'riadok', cislo: r + 1, bunky: noveVyplnene, hodnota: 1,
        text: vysvetli('Row', r + 1, clues.rows[r], noveVyplnene.length, true) };
    }
    if (novePrazdne.length) {
      return { druh: 'riadok', cislo: r + 1, bunky: novePrazdne, hodnota: 2,
        text: vysvetli('Row', r + 1, clues.rows[r], novePrazdne.length, false) };
    }
  }
  for (let c = 0; c < n; c++) {
    const idx = (r) => r * n + c;
    const known = znameZLinie(v, idx, n);
    const res = riesRiadok(clues.cols[c], n, known);
    if (!res.ok) continue;
    const noveVyplnene = [], novePrazdne = [];
    for (let r = 0; r < n; r++) {
      if (known[r] !== -1 || res.grid[r] === -1) continue;
      (res.grid[r] === 1 ? noveVyplnene : novePrazdne).push(idx(r));
    }
    if (noveVyplnene.length) {
      return { druh: 'stlpec', cislo: c + 1, bunky: noveVyplnene, hodnota: 1,
        text: vysvetli('Column', c + 1, clues.cols[c], noveVyplnene.length, true) };
    }
    if (novePrazdne.length) {
      return { druh: 'stlpec', cislo: c + 1, bunky: novePrazdne, hodnota: 2,
        text: vysvetli('Column', c + 1, clues.cols[c], novePrazdne.length, false) };
    }
  }

  // Every accepted garden is fully reachable by rows and columns alone
  // (that is what generateSeeded requires before it accepts a picture), so
  // this point should not be reachable. Kept as a plain, honest fallback in
  // case a hand-built or damaged puzzle ever reaches here.
  for (let i = 0; i < v.length; i++) {
    if (solution[i] === 1 && v[i] === 0) {
      return { druh: 'odhalenie', bunky: [i], hodnota: 1,
        text: 'No simple step from here. This cell is filled in the solution.' };
    }
  }
  return null;
}
