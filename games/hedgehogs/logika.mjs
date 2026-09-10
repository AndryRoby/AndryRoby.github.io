/* Hedgehogs: the rules on a board of marks, Check and Hint.
 * Pure functions, no DOM. game.js draws what these return; tests-logika.mjs
 * checks that no hint ever contradicts the solution.
 *
 * Marks: v is a flat array of n·n values, 0 empty, 1 dot, 2 hedgehog.
 * regions: n arrays of n region numbers. stars: hedgehogs per line.
 */

function reg(regions, n, i) { return regions[Math.floor(i / n)][i % n]; }
function touches(a, b, n) {
  return Math.abs(Math.floor(a / n) - Math.floor(b / n)) <= 1 && Math.abs((a % n) - (b % n)) <= 1;
}
function neighbours8(i, n) {
  const r = Math.floor(i / n), c = i % n, out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc);
  }
  return out;
}

/* Rows, columns and flowerbeds as lists of cell indices. */
export function jednotky(regions) {
  const n = regions.length;
  const out = [];
  for (let r = 0; r < n; r++) out.push({ druh: 'row', cislo: r + 1, bunky: Array.from({ length: n }, (_, c) => r * n + c) });
  for (let c = 0; c < n; c++) out.push({ druh: 'column', cislo: c + 1, bunky: Array.from({ length: n }, (_, r) => r * n + c) });
  const m = new Map();
  for (let i = 0; i < n * n; i++) {
    const g = reg(regions, n, i);
    if (!m.has(g)) m.set(g, []);
    m.get(g).push(i);
  }
  for (const [g, bunky] of m) out.push({ druh: 'flowerbed', cislo: g + 1, bunky });
  return out;
}

/* Hedgehogs that break a rule right now: a line with too many, or two that
 * touch. Dots are never judged here. */
export function konflikty(v, regions, stars) {
  const n = regions.length;
  const hedgehogs = [];
  for (let i = 0; i < n * n; i++) if (v[i] === 2) hedgehogs.push(i);
  const rowC = new Array(n).fill(0), colC = new Array(n).fill(0), regC = new Map();
  for (const i of hedgehogs) {
    rowC[Math.floor(i / n)]++; colC[i % n]++;
    const g = reg(regions, n, i); regC.set(g, (regC.get(g) || 0) + 1);
  }
  const zle = new Set();
  for (const i of hedgehogs) {
    if (rowC[Math.floor(i / n)] > stars || colC[i % n] > stars || regC.get(reg(regions, n, i)) > stars) zle.add(i);
  }
  for (let a = 0; a < hedgehogs.length; a++) for (let b = a + 1; b < hedgehogs.length; b++) {
    if (touches(hedgehogs[a], hedgehogs[b], n)) { zle.add(hedgehogs[a]); zle.add(hedgehogs[b]); }
  }
  return { hedgehogs: hedgehogs.length, zle };
}

/* Is the board a full, valid solution? (Exactly `stars` per line, nothing
 * touching.) Does not need the stored solution: a valid garden has one. */
export function jeVyriesene(v, regions, stars) {
  const n = regions.length;
  const k = konflikty(v, regions, stars);
  if (k.zle.size || k.hedgehogs !== n * stars) return false;
  const rowC = new Array(n).fill(0), colC = new Array(n).fill(0), regC = new Map();
  for (let i = 0; i < n * n; i++) if (v[i] === 2) {
    rowC[Math.floor(i / n)]++; colC[i % n]++;
    const g = reg(regions, n, i); regC.set(g, (regC.get(g) || 0) + 1);
  }
  if (rowC.some((x) => x !== stars) || colC.some((x) => x !== stars)) return false;
  for (const x of regC.values()) if (x !== stars) return false;
  return regC.size === n;
}

/* Check: compare the marks with the solution. A hedgehog is wrong when the
 * solution has none there; a dot is wrong when the solution has a hedgehog
 * there. Empty cells are never wrong. */
export function porovnaj(v, solution) {
  const out = { hedgehogs: 0, dots: 0, zleJezky: [], zleBodky: [] };
  for (let i = 0; i < v.length; i++) {
    if (v[i] === 2) { out.hedgehogs++; if (solution[i] !== 1) out.zleJezky.push(i); }
    else if (v[i] === 1) { out.dots++; if (solution[i] === 1) out.zleBodky.push(i); }
  }
  return out;
}

/* Every way to put `need` hedgehogs on the candidate cells `cands` so that no
 * two touch. Returns an array of arrays of indices. */
function rozlozenia(cands, need, n) {
  const out = [];
  const cur = [];
  (function go(from) {
    if (cur.length === need) { out.push(cur.slice()); return; }
    for (let k = from; k < cands.length; k++) {
      const x = cands[k];
      if (cur.some((y) => touches(x, y, n))) continue;
      cur.push(x); go(k + 1); cur.pop();
    }
  })(0);
  return out;
}

const NAZOV = { row: 'row', column: 'column', flowerbed: 'flowerbed' };
function meno(j) { return j.druh === 'flowerbed' ? 'this flowerbed' : NAZOV[j.druh] + ' ' + j.cislo; }
function Meno(j) { const s = meno(j); return s.charAt(0).toUpperCase() + s.slice(1); }
function slovo(k, jedno, viac) { return k === 1 ? jedno : viac; }

/* Hint: one next step from the current marks, as the kind of thing a
 * patient friend would say over your shoulder. Returns
 *   { druh, bunky, hodnota, jednotka, text }
 * bunky are the cells to mark, hodnota what to put there (1 dot, 2 hedgehog,
 * 0 clear), jednotka the cells to outline while explaining. Returns null
 * only for a solved board.
 *
 * Order, simplest first: a wrong mark; cells around a hedgehog; a full line;
 * a line with exactly as many free cells as it still needs; a line whose
 * every placement forces or excludes cells; a flowerbed that must spend its
 * hedgehogs inside one line (and the pair version of that); finally, when no
 * rule here applies, one hedgehog from the solution, said plainly. */
export function napoveda(v, regions, stars, solution) {
  const n = regions.length;
  if (jeVyriesene(v, regions, stars)) return null;

  // 0. Wrong marks first: nothing below is sound on a wrong board.
  const p = porovnaj(v, solution);
  if (p.zleJezky.length) {
    return { druh: 'chyba', bunky: [p.zleJezky[0]], hodnota: 0, jednotka: [],
      text: 'This hedgehog is not in the solution. Take it away before going on.' };
  }
  if (p.zleBodky.length) {
    return { druh: 'chyba', bunky: [p.zleBodky[0]], hodnota: 2, jednotka: [],
      text: 'A hedgehog belongs where this dot is. Change it before going on.' };
  }

  // 1. The eight cells around a hedgehog.
  for (let i = 0; i < n * n; i++) {
    if (v[i] !== 2) continue;
    const prazdne = neighbours8(i, n).filter((j) => v[j] === 0);
    if (prazdne.length) {
      return { druh: 'susedia', bunky: prazdne, hodnota: 1, jednotka: [i],
        text: 'Hedgehogs prickle: every cell that touches a hedgehog stays empty.' };
    }
  }

  const units = jednotky(regions);
  const placed = (j) => j.bunky.reduce((a, i) => a + (v[i] === 2 ? 1 : 0), 0);
  const fullRow = new Array(n).fill(false), fullCol = new Array(n).fill(false), fullReg = new Map();
  for (const j of units) {
    const f = placed(j) >= stars;
    if (j.druh === 'row') fullRow[j.cislo - 1] = f;
    else if (j.druh === 'column') fullCol[j.cislo - 1] = f;
    else fullReg.set(j.cislo - 1, f);
  }

  // 2. A line that already has its hedgehogs.
  for (const j of units) {
    if (placed(j) < stars) continue;
    const prazdne = j.bunky.filter((i) => v[i] === 0);
    if (prazdne.length) {
      return { druh: 'plna', bunky: prazdne, hodnota: 1, jednotka: j.bunky,
        text: Meno(j) + ' already has its ' + stars + ' hedgehogs, so every other cell in it stays empty.' };
    }
  }

  // A candidate: empty, touching no hedgehog, in no full line.
  const touchesHedgehog = (i) => neighbours8(i, n).some((j) => v[j] === 2);
  const kandidat = (i) => v[i] === 0 && !touchesHedgehog(i)
    && !fullRow[Math.floor(i / n)] && !fullCol[i % n] && !fullReg.get(reg(regions, n, i));
  const open = units.filter((j) => placed(j) < stars).map((j) => ({
    ...j, need: stars - placed(j), cands: j.bunky.filter(kandidat),
  }));

  // 3. Exactly as many free cells as hedgehogs still needed.
  for (const j of open) {
    if (j.cands.length === j.need) {
      return { druh: 'presne', bunky: j.cands, hodnota: 2, jednotka: j.bunky,
        text: Meno(j) + ' still needs ' + j.need + ' ' + slovo(j.need, 'hedgehog', 'hedgehogs') + ' and has exactly ' + j.need + ' free ' + slovo(j.need, 'cell', 'cells') + ' left.' };
    }
  }

  // 4. Every placement of a line's remaining hedgehogs agrees on something.
  for (const j of open) {
    if (j.cands.length > 24) continue; // no such lines in our sizes; keeps the worst case bounded
    const P = rozlozenia(j.cands, j.need, n);
    if (!P.length) continue; // contradiction: cannot happen on a right board
    const vsade = j.cands.filter((i) => P.every((pl) => pl.includes(i)));
    if (vsade.length) {
      return { druh: 'vsade', bunky: vsade, hodnota: 2, jednotka: j.bunky,
        text: 'Every way to place the remaining ' + slovo(j.need, 'hedgehog', 'hedgehogs') + ' of ' + meno(j) + ' uses the marked ' + slovo(vsade.length, 'cell', 'cells') + '.' };
    }
    const nikde = j.cands.filter((i) => !P.some((pl) => pl.includes(i)));
    if (nikde.length) {
      return { druh: 'nikde', bunky: nikde, hodnota: 1, jednotka: j.bunky,
        text: 'No way to place the remaining ' + slovo(j.need, 'hedgehog', 'hedgehogs') + ' of ' + meno(j) + ' can use the marked ' + slovo(nikde.length, 'cell', 'cells') + ': they stay empty.' };
    }
    const dotkne = [];
    for (let i = 0; i < n * n; i++) {
      if (v[i] !== 0 || j.bunky.includes(i)) continue;
      if (P.every((pl) => pl.some((x) => touches(x, i, n)))) dotkne.push(i);
    }
    if (dotkne.length) {
      return { druh: 'dotyk', bunky: dotkne, hodnota: 1, jednotka: j.bunky,
        text: 'Wherever the remaining ' + slovo(j.need, 'hedgehog', 'hedgehogs') + ' of ' + meno(j) + ' can go, ' + slovo(j.need, 'it touches', 'they touch') + ' the marked ' + slovo(dotkne.length, 'cell', 'cells') + ', so ' + slovo(dotkne.length, 'it stays', 'they stay') + ' empty.' };
    }
  }

  // 5. A flowerbed whose free cells all lie in one line, or a line whose free
  //    cells all lie in one flowerbed, with the same number still needed.
  const lines = open.filter((j) => j.druh !== 'flowerbed');
  const beds = open.filter((j) => j.druh === 'flowerbed');
  for (const L of lines) for (const R of beds) {
    if (!R.cands.length || !L.cands.length) continue;
    const inL = new Set(L.bunky), inR = new Set(R.bunky);
    if (R.need === L.need && R.cands.every((i) => inL.has(i))) {
      const von = L.cands.filter((i) => !inR.has(i));
      if (von.length) {
        return { druh: 'vnutri', bunky: von, hodnota: 1, jednotka: R.bunky,
          text: 'The remaining ' + slovo(R.need, 'hedgehog', 'hedgehogs') + ' of this flowerbed must go in ' + meno(L) + '. That fills the ' + NAZOV[L.druh] + ', so its other cells stay empty.' };
      }
    }
    if (R.need === L.need && L.cands.every((i) => inR.has(i))) {
      const von = R.cands.filter((i) => !inL.has(i));
      if (von.length) {
        return { druh: 'vnutri', bunky: von, hodnota: 1, jednotka: R.bunky,
          text: 'The remaining ' + slovo(L.need, 'hedgehog', 'hedgehogs') + ' of ' + meno(L) + ' must go in this flowerbed. That fills the flowerbed, so its other cells stay empty.' };
      }
    }
  }

  // 6. Two flowerbeds inside two rows (or columns), and the other way round.
  for (const druh of ['row', 'column']) {
    const Ls = lines.filter((j) => j.druh === druh);
    for (let a = 0; a < Ls.length; a++) for (let b = a + 1; b < Ls.length; b++) {
      const L1 = Ls[a], L2 = Ls[b];
      const inL = new Set([...L1.bunky, ...L2.bunky]);
      const needL = L1.need + L2.need;
      for (let x = 0; x < beds.length; x++) for (let y = x + 1; y < beds.length; y++) {
        const R1 = beds[x], R2 = beds[y];
        const needR = R1.need + R2.need;
        if (needR !== needL) continue;
        const inR = new Set([...R1.bunky, ...R2.bunky]);
        const candsR = [...R1.cands, ...R2.cands];
        if (candsR.length && candsR.every((i) => inL.has(i))) {
          const von = [...L1.cands, ...L2.cands].filter((i) => !inR.has(i));
          if (von.length) {
            return { druh: 'dvojica', bunky: von, hodnota: 1, jednotka: [...R1.bunky, ...R2.bunky],
              text: 'The two outlined flowerbeds must spend all their remaining hedgehogs in ' + NAZOV[druh] + 's ' + L1.cislo + ' and ' + L2.cislo + '. That fills both ' + NAZOV[druh] + 's, so their other cells stay empty.' };
          }
        }
        const candsL = [...L1.cands, ...L2.cands];
        if (candsL.length && candsL.every((i) => inR.has(i))) {
          const von = candsR.filter((i) => !inL.has(i));
          if (von.length) {
            return { druh: 'dvojica', bunky: von, hodnota: 1, jednotka: [...R1.bunky, ...R2.bunky],
              text: NAZOV[druh].charAt(0).toUpperCase() + NAZOV[druh].slice(1) + 's ' + L1.cislo + ' and ' + L2.cislo + ' must put all their remaining hedgehogs in the two outlined flowerbeds. That fills both flowerbeds, so their other cells stay empty.' };
          }
        }
      }
    }
  }

  // 7. Nothing simple applies: say so and show one hedgehog.
  for (let i = 0; i < n * n; i++) {
    if (solution[i] === 1 && v[i] === 0) {
      return { druh: 'odhalenie', bunky: [i], hodnota: 2, jednotka: [],
        text: 'No simple step from here. This cell holds a hedgehog in the solution.' };
    }
  }
  return null;
}
