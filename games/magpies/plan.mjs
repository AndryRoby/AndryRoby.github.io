/* Magpies: the weekly plan, dates, difficulty and the compact puzzle
 * format. Pure functions, no DOM, no dependencies beyond generator.mjs.
 * Used by the page (game.js), the build script (ops/games/magpies/postav.mjs)
 * and the tests.
 *
 * The week (Bratislava time):
 *   Monday, Tuesday      Easy       8 x 8
 *   Wednesday, Thursday  Medium     10 x 10
 *   Friday, Saturday     Hard      12 x 12
 *   Sunday               Challenge 15 x 15
 * Practice sets use the same three sizes as Monday to Saturday (no
 * challenge-size practice set, same as Hedgehogs).
 *
 * Difficulty is measured, not guessed. generateSeeded already reports how
 * many settling passes pure line logic needed (difficulty.passes: fewer
 * passes, easier to follow). For every date the program makes up to
 * KANDIDATOV candidate gardens (seeded date#0, date#1, ...) and sorts them
 * by passes: easy takes the candidate with the fewest passes, medium the
 * lower-middle one, hard the upper-middle one, challenge the most passes.
 * The record of what was picked is dni/YYYY-MM.json, built by postav.mjs;
 * the browser only recomputes when that file is missing.
 */
import { generateSeeded, isValidDate } from './generator.mjs';

export const PRVY_DEN = '2025-09-10';
export const KANDIDATOV = 6;
export const DNI = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const DNI_DLHE = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MESIACE = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const UROVNE = {
  easy: { n: 8, label: 'Easy' },
  medium: { n: 10, label: 'Medium' },
  hard: { n: 12, label: 'Hard' },
  challenge: { n: 15, label: 'Challenge' },
};
// Rank (0-based, out of KANDIDATOV candidates sorted by passes, ascending)
// that each level picks: easy the fewest passes, challenge the most.
const PORADIE = { easy: 0, medium: 2, hard: 4, challenge: KANDIDATOV - 1 };
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

/* Picks one garden for a level out of KANDIDATOV candidates produced by
 * kandidat(k). Deterministic: the same candidates give the same pick,
 * because a stable sort keeps ties in the order the candidates were made. */
export function vyber(uroven, kandidat, pocet = KANDIDATOV) {
  const zoznam = [];
  for (let k = 0; k < pocet; k++) zoznam.push({ ...kandidat(k), uroven, kandidat: k });
  const zoradene = zoznam.slice().sort((a, b) => a.difficulty.passes - b.difficulty.passes);
  const idx = Math.min(PORADIE[uroven], zoradene.length - 1);
  return zoradene[idx];
}

/* The garden for a date. Deterministic: the same date gives the same garden
 * on every machine. Slow for Challenge days (still under 2 s per candidate,
 * see tests.mjs), which is why the built dni/*.json is used whenever it
 * exists. */
export function zadaniePreDen(iso) {
  if (!isValidDate(iso)) throw new Error('Bad date: ' + iso);
  const u = urovenDna(iso);
  const { n } = UROVNE[u];
  return vyber(u, (k) => generateSeeded(iso, iso + '/' + n + (k ? '#' + k : ''), { n }));
}

/* A practice garden: set id and 1-based number. Not tied to any date. */
export function zadanieCvicenie(sada, k) {
  const s = SADY.find((x) => x.id === sada);
  if (!s || !(k >= 1 && k <= s.pocet)) throw new Error('Bad practice puzzle: ' + sada + ' ' + k);
  const { n } = UROVNE[s.uroven];
  const name = 'practice-' + sada + '-' + k;
  return vyber(s.uroven, (j) => generateSeeded(name, 'practice/' + sada + '/' + k + '/' + n + (j ? '#' + j : ''), { n }));
}

/* ── Compact format for dni.json and for embedding in pages ───────────── *
 * { d, n, r, c, s, u, p }: date or practice id, size, row clues, column
 * clues (each blocks joined by ',', lines joined by '|'), filled cell
 * indices, level id, difficulty.passes. */
export function zbal(p) {
  const balBlocks = (lines) => lines.map((b) => b.join(',')).join('|');
  const s = [];
  for (let i = 0; i < p.n * p.n; i++) if (p.solution[i] === 1) s.push(i);
  return { d: p.date, n: p.n, r: balBlocks(p.clues.rows), c: balBlocks(p.clues.cols), s, u: p.uroven, p: p.difficulty ? p.difficulty.passes : 0 };
}
export function rozbal(z) {
  const n = z.n;
  const rozbalBlocks = (str) => str.split('|').map((line) => (line ? line.split(',').map(Number) : []));
  if (typeof z.r !== 'string' || typeof z.c !== 'string') throw new Error('Bad packed puzzle');
  const clues = { rows: rozbalBlocks(z.r), cols: rozbalBlocks(z.c) };
  if (clues.rows.length !== n || clues.cols.length !== n) throw new Error('Bad packed puzzle');
  const solution = new Array(n * n).fill(0);
  for (const i of z.s) solution[i] = 1;
  return { date: z.d, n, clues, solution, uroven: z.u, difficulty: { passes: z.p || 0 } };
}
