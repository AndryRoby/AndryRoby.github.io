/* Herons: the weekly plan, dates, difficulty and the compact puzzle format.
 * Pure functions, no DOM, no dependencies beyond generator.mjs. Used by the
 * page (game.js), the build script (ops/games/herons/postav.mjs) and the
 * tests.
 *
 * The week (Bratislava time):
 *   Monday, Tuesday      Easy       5 x 5, three or four pairs
 *   Wednesday, Thursday  Medium     6 x 6, four or five pairs
 *   Friday, Saturday     Hard       7 x 7, five or six pairs
 *   Sunday               Challenge  8 x 8, six to eight pairs
 * Practice sets use the three smaller sizes (no Challenge practice set, the
 * same idea as Magpies).
 *
 * Difficulty is measured, not guessed. generateSeeded runs the human solver
 * over the finished puzzle and reports how many steps came from each layer
 * of rules (difficulty.layers):
 *   layer 1  local rules: a nest with one free side, a cell with only one way
 *            through it, a cell whose path already has both its steps, a step
 *            that would leave a path running beside itself, a step that would
 *            join two different pairs,
 *   layer 2  looking further: a cell only one pair can still reach, and a
 *            step without which a part of the marsh would be cut off,
 *   layer 3  a one step trial: assume a step, follow layers 1 and 2, and take
 *            the opposite when that ends in a contradiction.
 * Easy and Medium are generated with layer 3 switched off entirely
 * (UROVNE[...].maxVrstva = 2), so those days never need a trial: the puzzle
 * keeps whatever nests layers 1 and 2 need. Hard and Challenge do allow layer
 * 3, and out of KANDIDATOV candidates (seeded date#0, date#1, ...) sorted by
 * obtiaznost() ascending, each level takes a fixed rank: Hard the second most
 * demanding of the six, Challenge the most demanding. The record of what was
 * picked is dni/YYYY-MM.json, built by postav.mjs; the browser only
 * recomputes when that file is missing.
 */
import { generateSeeded, isValidDate, rozsahParov } from './generator.mjs';

export const PRVY_DEN = '2025-09-10';
export const KANDIDATOV = 6;
export const DNI = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const DNI_DLHE = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MESIACE = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/* maxVrstva: the highest layer of rules the puzzle is allowed to need. 2
 * means a person can finish it without ever trying a step out. */
export const UROVNE = {
  easy: { n: 5, label: 'Easy', maxVrstva: 2 },
  medium: { n: 6, label: 'Medium', maxVrstva: 2 },
  hard: { n: 7, label: 'Hard', maxVrstva: 3 },
  challenge: { n: 8, label: 'Challenge', maxVrstva: 3 },
};
/* Rank (0-based, out of KANDIDATOV candidates sorted by obtiaznost,
 * ascending) that each level picks. Easy and Medium share a pool shape with
 * no layer 3 at all, so their rank only spreads the layer 2 work: Easy takes
 * the quietest candidate of the six, Medium one from the upper middle. Hard
 * and Challenge do allow layer 3, and their rank is what separates them.
 * Measured over five weeks of candidates at every level, the average number
 * of layer 2 and layer 3 steps a level ends up with is
 * 0.0 and 0.0 for Easy, 0.2 and 0.0 for Medium, 2.5 and 0.7 for Hard,
 * 6.6 and 3.8 for Challenge. Ranks are only comparable inside one level's own
 * pool, because each level generates its own candidates at its own size. */
const PORADIE = { easy: 0, medium: 3, hard: 4, challenge: KANDIDATOV - 1 };
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

/* One number for how hard a finished puzzle is to follow: every layer 3 step
 * (a trial) weighs far more than a layer 2 step, and a layer 2 step more than
 * a plain local one. The weights are wide enough that the plain steps of an
 * 8 x 8 marsh (a good two hundred of them) never reach into the layer 2
 * place. Used only to sort candidates against each other. */
export function obtiaznost(p) {
  const l = p.difficulty && p.difficulty.layers ? p.difficulty.layers : { 1: 0, 2: 0, 3: 0 };
  return (l[3] || 0) * 1000000 + (l[2] || 0) * 1000 + (l[1] || 0);
}

/* Picks one puzzle for a level out of KANDIDATOV candidates produced by
 * kandidat(k). Deterministic: the same candidates give the same pick,
 * because a stable sort keeps ties in the order the candidates were made. */
export function vyber(uroven, kandidat, pocet = KANDIDATOV) {
  const zoznam = [];
  for (let k = 0; k < pocet; k++) zoznam.push({ ...kandidat(k), uroven, kandidat: k });
  const zoradene = zoznam.slice().sort((a, b) => obtiaznost(a) - obtiaznost(b));
  const idx = Math.min(PORADIE[uroven], zoradene.length - 1);
  return zoradene[idx];
}

/* The puzzle for a date. Deterministic: the same date gives the same marsh on
 * every machine, and fast enough (well under 4 s for all six candidates of
 * any day, see tests.mjs) that the built dni/*.json is only a convenience. */
export function zadaniePreDen(iso) {
  if (!isValidDate(iso)) throw new Error('Bad date: ' + iso);
  const u = urovenDna(iso);
  const { n, maxVrstva } = UROVNE[u];
  return vyber(u, (k) => generateSeeded(iso, iso + '/' + n + (k ? '#' + k : ''), { n, maxVrstva }));
}

/* A practice puzzle: set id and 1-based number. Not tied to any date. */
export function zadanieCvicenie(sada, k) {
  const s = SADY.find((x) => x.id === sada);
  if (!s || !(k >= 1 && k <= s.pocet)) throw new Error('Bad practice puzzle: ' + sada + ' ' + k);
  const { n, maxVrstva } = UROVNE[s.uroven];
  const name = 'practice-' + sada + '-' + k;
  return vyber(s.uroven, (j) => generateSeeded(name, 'practice/' + sada + '/' + k + '/' + n + (j ? '#' + j : ''), { n, maxVrstva }));
}

/* ── Compact format for dni.json and for embedding in pages ───────────── *
 * { d, n, e, s, u, l, k }: date or practice id, size, the nests as one string
 * of n*n characters (0 an empty cell, k a nest of pair k), the solution as
 * another n*n characters (the path number of every cell), level id, the three
 * layer counts as "l1,l2,l3", and the total number of steps. With more than
 * nine pairs the numbers would not fit in one character each, so both strings
 * switch to numbers joined by "|"; at the sizes we play (at most eight pairs)
 * that never happens, but rozbal reads both. */
function zbalPole(pole) {
  let max = 0;
  for (const x of pole) if (x > max) max = x;
  return max > 9 ? pole.join('|') : pole.join('');
}
function rozbalPole(s, dlzka) {
  if (typeof s !== 'string') throw new Error('Bad packed puzzle');
  const out = s.indexOf('|') >= 0 ? s.split('|').map(Number) : Array.from(s, (ch) => Number(ch));
  if (out.length !== dlzka) throw new Error('Bad packed puzzle');
  for (const x of out) if (!Number.isInteger(x) || x < 0) throw new Error('Bad packed puzzle');
  return out;
}
export function zbal(p) {
  const l = p.difficulty && p.difficulty.layers ? p.difficulty.layers : { 1: 0, 2: 0, 3: 0 };
  return {
    d: p.date, n: p.n,
    e: zbalPole(p.ends), s: zbalPole(p.solution),
    u: p.uroven,
    l: [l[1] || 0, l[2] || 0, l[3] || 0].join(','),
    k: p.difficulty ? p.difficulty.steps || 0 : 0,
  };
}
export function rozbal(z) {
  const n = z.n;
  if (!Number.isInteger(n) || n < 2) throw new Error('Bad packed puzzle');
  const ends = rozbalPole(z.e, n * n);
  const solution = rozbalPole(z.s, n * n);
  let pocet = 0;
  const videne = new Map();
  for (const x of ends) if (x) videne.set(x, (videne.get(x) || 0) + 1);
  for (const [, c] of videne) { if (c !== 2) throw new Error('Bad packed puzzle'); pocet++; }
  if (!pocet) throw new Error('Bad packed puzzle');
  const l = String(z.l || '0,0,0').split(',').map(Number);
  return {
    date: z.d, n, ends, solution, pairs: pocet, uroven: z.u,
    difficulty: { layers: { 1: l[0] || 0, 2: l[1] || 0, 3: l[2] || 0 }, pairs: pocet, steps: z.k || 0 },
  };
}

/* How many pairs a size carries, straight from the generator, so pages and
 * tests do not have to keep their own copy of the table. */
export { rozsahParov };
