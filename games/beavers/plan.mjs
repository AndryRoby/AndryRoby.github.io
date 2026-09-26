/* Beavers: the weekly plan, dates, difficulty and the compact puzzle format.
 * Pure functions, no DOM, no dependencies beyond generator.mjs. Used by the
 * page (game.js), the build script (ops/games/beavers/postav.mjs) and the
 * tests.
 *
 * The week (Bratislava time):
 *   Monday, Tuesday      Easy        8 x 8    10 to 12 trees
 *   Wednesday, Thursday  Medium     10 x 10   15 to 18 trees
 *   Friday, Saturday     Hard       12 x 12   22 to 26 trees
 *   Sunday               Challenge  14 x 14   29 to 35 trees
 * Fourteen by fourteen is the largest pond that keeps a cell at 24 px on a
 * 390 px phone with the narrow column of row numbers beside it. Practice sets
 * use the three smaller sizes (no Challenge practice set, the same as every
 * other game).
 *
 * Difficulty is measured, not guessed. generateSeeded runs the human solver
 * over the finished pond and reports how many steps came from each layer of
 * rules (difficulty.layers):
 *   layer 1  one rule in one place: the cells around a lodge, a line that has
 *            its lodges, a line with exactly as many free cells as lodges
 *            missing, a tree with one free cell, a cell with no tree beside it,
 *   layer 2  a whole line or a pairing: every way to fit a line's lodges,
 *            the cells all those ways touch, a cell touching every place one
 *            tree's lodge can go, a cell whose trees are all taken, a few
 *            trees with exactly as many cells left as trees,
 *   layer 3  a single trial: assume a cell, follow layers 1 and 2, and when a
 *            rule breaks the cell is the other thing.
 * Easy, Medium and Hard are generated with layer 3 switched off entirely
 * (UROVNE[...].maxVrstva = 2), so those days never ask for a trial. Challenge
 * allows it without requiring it. Out of KANDIDATOV candidates (seeded
 * date#0, date#1, ...) sorted by obtiaznost() ascending, each level takes a
 * fixed rank: Easy the quietest, Challenge the one that leans on the harder
 * steps most. Medium and Hard also have a floor of layer 2 steps (MIN_L2):
 * when the pond at their rank needs fewer, the easiest candidate that reaches
 * the floor is taken instead, and when none does, the hardest of the six.
 * Measured over all 747 days from PRVY_DEN to a year ahead (25. 9. 2026):
 * without the floor, half of all Medium days needed no layer 2 step at all
 * and were only a bigger Monday; with it Medium needs 2 to 5 of them (median
 * 2) and Hard 5 to 10 (median 6). The record of what was picked is
 * dni/YYYY-MM.json, built by postav.mjs; the browser only recomputes when
 * that file is missing.
 */
import { generateSeeded, isValidDate, geometria, uplneParovanie } from './generator.mjs';

export const PRVY_DEN = '2025-09-10';
export const KANDIDATOV = 6;
export const DNI = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const DNI_DLHE = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MESIACE = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/* maxVrstva: the highest layer of rules a pond is allowed to need. 2 means a
 * person can finish it without ever trying a cell out. */
export const UROVNE = {
  easy: { n: 8, label: 'Easy', maxVrstva: 2 },
  medium: { n: 10, label: 'Medium', maxVrstva: 2 },
  hard: { n: 12, label: 'Hard', maxVrstva: 2 },
  challenge: { n: 14, label: 'Challenge', maxVrstva: 3 },
};
/* Rank (0-based, out of KANDIDATOV candidates sorted by obtiaznost,
 * ascending) that each level picks. */
export const PORADIE = { easy: 0, medium: 2, hard: 3, challenge: KANDIDATOV - 1 };
/* The least number of layer 2 steps a pond of the level should need. Easy
 * stays at none on purpose: Monday and Tuesday are the plain steps only. */
export const MIN_L2 = { easy: 0, medium: 2, hard: 5, challenge: 0 };
export const SADY = [
  { id: 'easy-1', uroven: 'easy', pocet: 8 }, { id: 'easy-2', uroven: 'easy', pocet: 8 }, { id: 'easy-3', uroven: 'easy', pocet: 8 },
  { id: 'medium-1', uroven: 'medium', pocet: 8 }, { id: 'medium-2', uroven: 'medium', pocet: 8 }, { id: 'medium-3', uroven: 'medium', pocet: 8 },
  { id: 'hard-1', uroven: 'hard', pocet: 8 }, { id: 'hard-2', uroven: 'hard', pocet: 8 }, { id: 'hard-3', uroven: 'hard', pocet: 8 },
];

/* ── Dates (all as YYYY-MM-DD, arithmetic in UTC so no DST surprises) ──── */
export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
export function toISO(ms) { return new Date(ms).toISOString().slice(0, 10); }
export function posunDen(iso, k) { return toISO(parseISO(iso) + k * 86400000); }
/* 0 = Monday ... 6 = Sunday */
export function denVTyzdni(iso) { return (new Date(parseISO(iso)).getUTCDay() + 6) % 7; }
/* The seven days of the week that contains iso, Monday first. */
export function tyzden(iso) {
  const p = posunDen(iso, -denVTyzdni(iso));
  return Array.from({ length: 7 }, (_, k) => posunDen(p, k));
}
export function porovnajDatumy(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
/* "Thursday 10 September 2026" */
export function pekneDatum(iso) {
  const t = new Date(parseISO(iso));
  return DNI_DLHE[denVTyzdni(iso)] + ' ' + t.getUTCDate() + ' ' + MESIACE[t.getUTCMonth()] + ' ' + t.getUTCFullYear();
}
/* "10 Sep" for chips and lists */
export function kratkyDatum(iso) {
  const t = new Date(parseISO(iso));
  return t.getUTCDate() + ' ' + MESIACE[t.getUTCMonth()].slice(0, 3);
}

/* ── The weekly plan ──────────────────────────────────────────────────── */
export function urovenDna(iso) {
  const d = denVTyzdni(iso);
  if (d <= 1) return 'easy';
  if (d <= 3) return 'medium';
  if (d <= 5) return 'hard';
  return 'challenge';
}

/* One number for how hard a finished pond is to work out: a trial weighs far
 * more than a layer 2 step, and a layer 2 step more than a plain layer 1
 * step. A trial counts once plus the length of its chain (difficulty.retaz,
 * the steps from the assumption to the contradiction, at most eight each):
 * a trial that breaks a rule after five steps is harder to find than one that
 * breaks it at once (the second review, 25. 9.). The weights are a million
 * and a thousand, not ten thousand and a hundred as in Voles: a fourteen by
 * fourteen pond easily has more than a hundred layer 1 steps, which would
 * spill into the layer 2 term. Used only to sort candidates against each
 * other. */
export function obtiaznost(p) {
  const d = p.difficulty || {};
  const l = d.layers || { 1: 0, 2: 0, 3: 0 };
  return ((l[3] || 0) + (d.retaz || 0)) * 1e6 + (l[2] || 0) * 1e3 + (l[1] || 0);
}

/* Picks one pond for a level out of KANDIDATOV candidates produced by
 * kandidat(k). Deterministic: the same candidates give the same pick, because
 * a stable sort keeps ties in the order the candidates were made. The pond at
 * the level's rank, unless it needs fewer layer 2 steps than MIN_L2: then the
 * easiest of the six that needs at least that many; when none of the six
 * does, the easiest of NAVYSE more candidates (#6 to #17) that does (the
 * second review, 25. 9.: without them a few Wednesdays had no layer 2 step at
 * all); and only when none of those does either, the hardest of the six. A
 * day whose six reach the floor never looks further, so it stays byte for
 * byte what it was. */
export const NAVYSE = 12;
const vrstva2 = (p) => (p.difficulty && p.difficulty.layers ? p.difficulty.layers[2] || 0 : 0);
const podlaObtiaznosti = (a, b) => obtiaznost(a) - obtiaznost(b);
export function vyber(uroven, kandidat, pocet = KANDIDATOV) {
  const zoznam = [];
  for (let k = 0; k < pocet; k++) zoznam.push({ ...kandidat(k), uroven, kandidat: k });
  const zoradene = zoznam.slice().sort(podlaObtiaznosti);
  const idx = Math.min(PORADIE[uroven], zoradene.length - 1);
  const minimum = MIN_L2[uroven] || 0;
  if (vrstva2(zoradene[idx]) >= minimum) return zoradene[idx];
  const j = zoradene.findIndex((p) => vrstva2(p) >= minimum);
  if (j >= 0) return zoradene[j];
  const navyse = [];
  for (let k = pocet; k < pocet + NAVYSE; k++) navyse.push({ ...kandidat(k), uroven, kandidat: k });
  const dost = navyse.filter((p) => vrstva2(p) >= minimum).sort(podlaObtiaznosti);
  return dost.length ? dost[0] : zoradene[zoradene.length - 1];
}

/* The pond for a date. Deterministic: the same date gives the same pond on
 * every machine. Fast even on Sundays (six candidates of fourteen by
 * fourteen stay well under 4 s, see tests.mjs), but the built dni/*.json is
 * used whenever it exists and live generation is only the fallback.
 *
 * A variant above zero adds '/v<n>' to the seed name, so the same date gets a
 * different candidate. ops/games/<game>/postav.mjs passes it when the day it
 * just built repeats a puzzle that is already sold in a book or an edition
 * (A-057, ops/games/vylucenia.mjs); it then keeps the result in
 * dni/YYYY-MM.json, which is the only source of truth for a daily puzzle
 * anyway. The browser never passes a variant, so variant 0 is byte for byte
 * what this function gives. */
export function zadaniePreDen(iso, variant = 0) {
  if (!isValidDate(iso)) throw new Error('Bad date: ' + iso);
  const u = urovenDna(iso);
  const { n, maxVrstva } = UROVNE[u];
  return vyber(u, (k) => generateSeeded(iso, iso + '/' + n + (variant ? '/v' + variant : '') + (k ? '#' + k : ''), { n, maxVrstva }));
}

/* A practice pond: set id and 1-based number. Not tied to any date. */
export function zadanieCvicenie(sada, k) {
  const s = SADY.find((x) => x.id === sada);
  if (!s || !(k >= 1 && k <= s.pocet)) throw new Error('Bad practice puzzle: ' + sada + ' ' + k);
  const { n, maxVrstva } = UROVNE[s.uroven];
  const name = 'practice-' + sada + '-' + k;
  return vyber(s.uroven, (j) => generateSeeded(name, 'practice/' + sada + '/' + k + '/' + n + (j ? '#' + j : ''), { n, maxVrstva }));
}

/* ── Compact format for dni.json and for embedding in pages ───────────── *
 * { d, n, t, r, c, s, u, l, k }: date or practice id, size, the tree cells
 * joined by commas, the row numbers and the column numbers as strings of one
 * digit per line (a line never holds more than seven lodges), the lodge cells
 * joined by commas, level id, the three layer counts as "l1,l2,l3", and the
 * total number of steps. Which lodge belongs to which tree is not stored. */
export function zbal(p) {
  const l = p.difficulty && p.difficulty.layers ? p.difficulty.layers : { 1: 0, 2: 0, 3: 0 };
  const s = [];
  for (let i = 0; i < p.n * p.n; i++) if (p.solution[i] === 1) s.push(i);
  return {
    d: p.date, n: p.n,
    t: p.trees.join(','),
    r: p.rows.join(''),
    c: p.cols.join(''),
    s: s.join(','),
    u: p.uroven,
    l: [l[1] || 0, l[2] || 0, l[3] || 0].join(','),
    k: p.difficulty ? p.difficulty.steps || 0 : 0,
  };
}

/* rozbal is a cheap check of the structure, not a solver: it throws "Bad
 * packed puzzle" when the lines are the wrong length, an index is off the
 * pond, a lodge stands on a tree, two lodges touch (even at a corner), a lodge
 * has no tree beside it, the lodges do not match the numbers, there are not
 * as many lodges as trees, or the trees and lodges cannot be paired so that
 * every tree has its own lodge. Full proof of a single answer belongs to
 * tests.mjs and postav.mjs. */
export function rozbal(z) {
  const zle = () => { throw new Error('Bad packed puzzle'); };
  if (!z || typeof z !== 'object') zle();
  const n = z.n;
  if (!Number.isInteger(n) || n < 2 || n > 20) zle();
  if (typeof z.t !== 'string' || typeof z.r !== 'string' || typeof z.c !== 'string' || typeof z.s !== 'string') zle();
  if (z.r.length !== n || z.c.length !== n || !/^\d+$/.test(z.r) || !/^\d+$/.test(z.c)) zle();
  const C = n * n;
  const indexy = (str) => (str === '' ? [] : str.split(',').map((x) => {
    if (!/^\d+$/.test(x)) zle();
    const v = Number(x);
    if (v >= C) zle();
    return v;
  }));
  const trees = indexy(z.t).sort((a, b) => a - b);
  const hrady = indexy(z.s).sort((a, b) => a - b);
  if (new Set(trees).size !== trees.length || new Set(hrady).size !== hrady.length) zle();
  const g = geometria(n);
  const isTree = new Uint8Array(C), hrad = new Uint8Array(C);
  for (const t of trees) isTree[t] = 1;
  for (const h of hrady) { if (isTree[h]) zle(); hrad[h] = 1; }
  const rows = Array.from(z.r, Number), cols = Array.from(z.c, Number);
  const pr = new Array(n).fill(0), pc = new Array(n).fill(0);
  for (const h of hrady) {
    for (let m = 0; m < 8; m++) { const y = g.s8[8 * h + m]; if (y >= 0 && hrad[y]) zle(); }
    let strom = false;
    for (let m = 0; m < 4; m++) { const y = g.s4[4 * h + m]; if (y >= 0 && isTree[y]) { strom = true; break; } }
    if (!strom) zle();
    pr[(h / n) | 0]++; pc[h % n]++;
  }
  for (let x = 0; x < n; x++) if (pr[x] !== rows[x] || pc[x] !== cols[x]) zle();
  if (hrady.length !== trees.length) zle();
  if (!uplneParovanie(trees, hrady, n)) zle();
  const solution = new Array(C).fill(0);
  for (const h of hrady) solution[h] = 1;
  const l = String(z.l || '0,0,0').split(',').map(Number);
  return {
    date: z.d, n, trees, rows, cols, solution, uroven: z.u,
    difficulty: { layers: { 1: l[0] || 0, 2: l[1] || 0, 3: l[2] || 0 }, steps: z.k || 0 },
  };
}
