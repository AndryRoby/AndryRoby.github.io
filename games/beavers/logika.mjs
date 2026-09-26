/* Beavers: the rules on a board of marks, Check, Hint and Auto grass.
 * Pure functions, no DOM. game.js draws what these return; tests-logika.mjs
 * checks that no hint ever contradicts the solution and that hints alone
 * carry an empty pond all the way to the finished one.
 *
 * Marks: `v` is a flat array of n*n values, 0 an empty cell, 1 a lodge, 2
 * grass (the player's own note that no lodge goes there). A tree cell is
 * always 0 in `v` and the game never changes it. `zadanie` is { n, trees,
 * rows, cols } (plan.mjs rozbal), `solution` a flat n*n array, 1 a lodge and
 * 0 nothing.
 */
import { solveHuman, geometria, uplneParovanie, poloha } from './generator.mjs';

/* Compare the marks with the solution. A lodge is wrong where the finished
 * pond has none; grass is wrong on a lodge of the finished pond. An empty
 * cell is never wrong: Check only ever talks about marks that are there. */
export function porovnaj(v, solution) {
  const out = { hrady: 0, trava: 0, zleHrady: [], zlaTrava: [] };
  for (let i = 0; i < solution.length; i++) {
    if (v[i] === 1) { out.hrady++; if (solution[i] !== 1) out.zleHrady.push(i); }
    else if (v[i] === 2) { out.trava++; if (solution[i] === 1) out.zlaTrava.push(i); }
  }
  return out;
}

/* Is the board a finished pond? Judged from the rules alone, without the
 * stored solution: no lodge on a tree, every row and column holds exactly its
 * number of lodges, no two lodges touch (not even at a corner), there are as
 * many lodges as trees, and every tree can have a lodge of its own beside it
 * (a full pairing of trees and lodges). Grass is ignored: it is only a note.
 * The pairing is what refuses a board where the numbers and the no touching
 * rule hold but one lodge stands between two trees and serves both. */
export function jeVyriesene(v, zadanie) {
  const { n, trees, rows, cols } = zadanie;
  const g = geometria(n), C = n * n;
  const isTree = new Uint8Array(C);
  for (const t of trees) isTree[t] = 1;
  const hrady = [];
  const pr = new Array(n).fill(0), pc = new Array(n).fill(0);
  for (let i = 0; i < C; i++) {
    if (v[i] !== 1) continue;
    if (isTree[i]) return false;
    hrady.push(i);
    pr[(i / n) | 0]++; pc[i % n]++;
  }
  for (let x = 0; x < n; x++) if (pr[x] !== rows[x] || pc[x] !== cols[x]) return false;
  for (const h of hrady) for (let m = 0; m < 8; m++) { const y = g.s8[8 * h + m]; if (y >= 0 && v[y] === 1) return false; }
  if (hrady.length !== trees.length) return false;
  return uplneParovanie(trees, hrady, n);
}

/* Every row and column number met, whatever else is on the board. game.js
 * uses it for the neutral sentence at the end of a game that is not solved
 * yet (lodges touching, or a tree without a lodge of its own). */
export function cislaSedia(v, zadanie) {
  const { n, trees, rows, cols } = zadanie;
  const isTree = new Uint8Array(n * n);
  for (const t of trees) isTree[t] = 1;
  const pr = new Array(n).fill(0), pc = new Array(n).fill(0);
  for (let i = 0; i < n * n; i++) if (v[i] === 1 && !isTree[i]) { pr[(i / n) | 0]++; pc[i % n]++; }
  for (let x = 0; x < n; x++) if (pr[x] !== rows[x] || pc[x] !== cols[x]) return false;
  return true;
}

/* Hint: one next step from the current marks, as a patient friend would say
 * it over your shoulder. Returns
 *   { druh, pravidlo, vrstva, bunky:[i], hodnota, kde, text, obrys:[i], rad }
 * druh is 'chyba' for a wrong mark, the rule name for a step and 'odhalenie'
 * for the honest fallback; bunky are the cells to set, hodnota what goes
 * there (1 lodge, 2 grass, 0 clear a wrong mark); kde is the first sentence
 * (where to look and which technique, without the value), text the full
 * explanation for the second press; obrys the object to outline on the first
 * press (a tree, a line, a lodge) and rad the line index (0..2n-1) whose
 * number to light, or -1. A trial (Sunday) also has dlzka, retaz and spor,
 * see below. Returns null only for a solved pond.
 *
 * Order: a wrong mark first, because nothing below is sound on a board that
 * already contradicts the solution; then the simplest rule that finds a new
 * cell from what is on the board (solveHuman stops after its first step, and
 * it tries its layers in order). */
export function napoveda(v, zadanie, solution) {
  if (jeVyriesene(v, zadanie)) return null;
  const n = zadanie.n;

  const p = porovnaj(v, solution);
  const zle = p.zleHrady.concat(p.zlaTrava).sort((a, b) => a - b);
  if (zle.length) {
    const i = zle[0];
    const pol = poloha(i, n);
    if (v[i] === 1) {
      return {
        druh: 'chyba', pravidlo: 'wrong-lodge', vrstva: 0, bunky: [i], hodnota: 0, obrys: [i], rad: -1,
        kde: 'One of your marks is not right. Look at ' + pol + '.',
        text: 'There is no lodge in ' + pol + ' in the finished pond. Clear it before going on.',
      };
    }
    return {
      druh: 'chyba', pravidlo: 'wrong-grass', vrstva: 0, bunky: [i], hodnota: 1, obrys: [i], rad: -1,
      kde: 'One of your marks is not right. Look at ' + pol + '.',
      text: 'The finished pond has a lodge in ' + pol + ', so it cannot be grass. The lodge goes there.',
    };
  }

  const r = solveHuman(zadanie, { initial: v, limitKrokov: 1, maxVrstva: 3 });
  if (r.steps.length) {
    const s = r.steps[0];
    const h = { druh: s.rule, pravidlo: s.rule, vrstva: s.layer, bunky: s.cells.slice(), hodnota: s.val, kde: s.kde, text: s.text, obrys: s.obrys, rad: s.rad };
    // A trial also carries its chain, for the second press: the cells of
    // each step the sentence names (retaz: [{ bunky, hodnota }]) and where
    // the rule breaks (spor: { bunky, rad }). Nothing of it is filled in.
    if (s.rule === 'trial') {
      h.dlzka = s.dlzka;
      h.retaz = s.retaz.map((x) => ({ bunky: x.cells.slice(), hodnota: x.val }));
      h.spor = { bunky: s.spor.cells.slice(), rad: s.spor.rad };
    }
    return h;
  }

  // Every accepted pond is reachable by these rules (generateSeeded requires
  // it before it accepts one), so this should never run. Kept as a plain,
  // honest fallback for a hand built or damaged puzzle.
  const isTree = new Uint8Array(n * n);
  for (const t of zadanie.trees) isTree[t] = 1;
  for (let i = 0; i < solution.length; i++) {
    if (solution[i] === 1 && v[i] !== 1) {
      return { druh: 'odhalenie', pravidlo: 'reveal', vrstva: 3, bunky: [i], hodnota: 1, obrys: [i], rad: -1,
        kde: 'No simple step from here.', text: 'No simple step from here. This cell holds a lodge.' };
    }
  }
  for (let i = 0; i < solution.length; i++) {
    if (solution[i] === 0 && !isTree[i] && v[i] === 0) {
      return { druh: 'odhalenie', pravidlo: 'reveal', vrstva: 3, bunky: [i], hodnota: 2, obrys: [i], rad: -1,
        kde: 'No simple step from here.', text: 'No simple step from here. This cell is grass.' };
    }
  }
  return null;
}

/* Auto grass (a setting, off by default): what to fill in after the player
 * puts a lodge on cell i. The eight cells around the new lodge, and the rest
 * of its row and its column when that line has just reached its number.
 * Only empty cells, never a tree, never over a mark the player made. Reads
 * only the board and the numbers, never the solution. */
export function autoTrava(v, zadanie, i) {
  if (v[i] !== 1) return [];
  const { n, trees, rows, cols } = zadanie;
  const g = geometria(n);
  const isTree = new Uint8Array(n * n);
  for (const t of trees) isTree[t] = 1;
  const out = new Set();
  for (let m = 0; m < 8; m++) { const y = g.s8[8 * i + m]; if (y >= 0 && !isTree[y] && v[y] === 0) out.add(y); }
  const r = (i / n) | 0, c = i % n;
  for (const [L, cislo] of [[r, rows[r]], [n + c, cols[c]]]) {
    const cells = g.lines[L];
    let h = 0;
    for (const x of cells) if (v[x] === 1) h++;
    if (h === cislo) for (const x of cells) if (!isTree[x] && v[x] === 0) out.add(x);
  }
  return [...out].sort((a, b) => a - b);
}
