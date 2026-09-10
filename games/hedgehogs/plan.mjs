/* Hedgehogs: the weekly plan, dates, difficulty and the compact puzzle
 * format. Pure functions, no DOM, no dependencies beyond generator.mjs and
 * logika.mjs. Used by the page (game.js), the build script
 * (ops/games/hedgehogs/postav.mjs) and the tests.
 *
 * The week (Bratislava time):
 *   Monday, Tuesday      Easy       8 x 8, two hedgehogs per line
 *   Wednesday, Thursday  Medium     9 x 9
 *   Friday, Saturday     Hard      10 x 10
 *   Sunday               Challenge 10 x 10, the hardest candidate
 * Practice sets use the same three sizes.
 *
 * Difficulty is measured, not guessed. For every date the program makes up
 * to KANDIDATOV candidate gardens (seeded date#0, date#1, ...), plays each one
 * with the same hints a player can ask for (logika.mjs napoveda) and counts
 * how often the hints get stuck and have to reveal a hedgehog outright
 * ("reveals"). Then it picks: Easy the first garden with 0 reveals, Medium
 * the first with 1 or 2, Hard the first with 3 to 5, Challenge the one with
 * the most. The record of what was picked is dni/YYYY-MM.json, built by
 * postav.mjs; the browser only recomputes when that file is missing.
 */
import { generateSeeded, isValidDate } from './generator.mjs';
import { napoveda, jeVyriesene } from './logika.mjs';

export const PRVY_DEN = '2025-09-10';       // the archive starts a year before the first published garden
export const PRVY_ZIVY_DEN = '2026-09-10';  // the first garden that was published on its day
export const STARS = 2;
export const KANDIDATOV = 6;
export const DNI = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const DNI_DLHE = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MESIACE = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const UROVNE = {
  easy: { n: 8, label: 'Easy', reveals: [0, 0] },
  medium: { n: 9, label: 'Medium', reveals: [1, 2] },
  hard: { n: 10, label: 'Hard', reveals: [3, 5] },
  challenge: { n: 10, label: 'Challenge', reveals: null },
};
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
/* 0 = Monday … 6 = Sunday */
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

/* Plays a garden with hints only and counts how often the hints got stuck
 * (had to reveal a hedgehog) and how many steps it took. */
export function zmerajNapovedami(p) {
  const n = p.n, v = new Array(n * n).fill(0);
  let reveals = 0, steps = 0;
  while (!jeVyriesene(v, p.regions, p.stars)) {
    const h = napoveda(v, p.regions, p.stars, p.solution);
    if (!h) throw new Error('No hint on an unsolved board');
    for (const i of h.bunky) v[i] = h.hodnota;
    if (h.druh === 'odhalenie') reveals++;
    if (++steps > 5000) throw new Error('Hints do not converge');
  }
  return { reveals, steps };
}

/* Picks one garden for a level out of candidates produced by kandidat(k).
 * Deterministic: the same candidates give the same pick. */
export function vyber(uroven, kandidat, pocet = KANDIDATOV) {
  const chce = UROVNE[uroven].reveals;
  const videne = [];
  for (let k = 0; k < pocet; k++) {
    const p = kandidat(k);
    const m = zmerajNapovedami(p);
    const c = { ...p, uroven, reveals: m.reveals, steps: m.steps, kandidat: k };
    if (chce && m.reveals >= chce[0] && m.reveals <= chce[1]) return c;
    videne.push(c);
  }
  // No candidate in the wanted band: the closest one, Challenge the hardest.
  if (!chce) return videne.reduce((a, c) => (c.reveals > a.reveals || (c.reveals === a.reveals && c.difficulty.placements > a.difficulty.placements) ? c : a));
  const stred = (chce[0] + chce[1]) / 2;
  return videne.reduce((a, c) => (Math.abs(c.reveals - stred) < Math.abs(a.reveals - stred) ? c : a));
}

/* The garden for a date. Deterministic: the same date gives the same garden
 * on every machine. Slow for Hard days (up to a few seconds), which is why
 * the built dni/*.json is used whenever it exists. */
export function zadaniePreDen(iso) {
  if (!isValidDate(iso)) throw new Error('Bad date: ' + iso);
  const u = urovenDna(iso);
  const { n } = UROVNE[u];
  return vyber(u, (k) => generateSeeded(iso, iso + '/' + n + 'x' + STARS + (k ? '#' + k : ''), { n, stars: STARS }));
}

/* A practice garden: set id and 1-based number. Not tied to any date. */
export function zadanieCvicenie(sada, k) {
  const s = SADY.find((x) => x.id === sada);
  if (!s || !(k >= 1 && k <= s.pocet)) throw new Error('Bad practice puzzle: ' + sada + ' ' + k);
  const { n } = UROVNE[s.uroven];
  const name = 'practice-' + sada + '-' + k;
  return vyber(s.uroven, (j) => generateSeeded(name, 'practice/' + sada + '/' + k + '/' + n + 'x' + STARS + (j ? '#' + j : ''), { n, stars: STARS }));
}

/* ── Compact format for dni.json and for embedding in pages ───────────── *
 * { d, n, r, s, u, p, h }: date or practice id, size, regions as one letter
 * per cell (A = region 0), hedgehog indices, level id, placements, reveals. */
export function zbal(p) {
  const r = [];
  for (let i = 0; i < p.n; i++) for (let j = 0; j < p.n; j++) r.push(String.fromCharCode(65 + p.regions[i][j]));
  const s = [];
  for (let i = 0; i < p.n * p.n; i++) if (p.solution[i] === 1) s.push(i);
  return { d: p.date, n: p.n, r: r.join(''), s, u: p.uroven, p: p.difficulty ? p.difficulty.placements : 0, h: p.reveals || 0 };
}
export function rozbal(z) {
  const n = z.n;
  if (typeof z.r !== 'string' || z.r.length !== n * n) throw new Error('Bad packed puzzle');
  const regions = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) row.push(z.r.charCodeAt(i * n + j) - 65);
    regions.push(row);
  }
  const solution = new Array(n * n).fill(0);
  for (const i of z.s) solution[i] = 1;
  return { date: z.d, n, stars: STARS, regions, solution, uroven: z.u, difficulty: { placements: z.p }, reveals: z.h || 0 };
}
