/* Swans: the weekly plan, dates, difficulty and the compact puzzle format.
 * Pure functions, no DOM, no dependencies beyond generator.mjs. Used by the
 * page (game.js), the build script (ops/games/swans/postav.mjs) and the
 * tests.
 *
 * The week (Bratislava time):
 *   Monday, Tuesday      Easy       6 x 6
 *   Wednesday, Thursday  Medium     7 x 7
 *   Friday, Saturday     Hard       8 x 8
 *   Sunday               Challenge 10 x 10
 * Practice sets use the three smaller sizes (no Challenge practice set, the
 * same idea as Magpies).
 *
 * Difficulty is measured, not guessed. generateSeeded runs the human solver
 * over the finished puzzle and reports how many steps came from each layer
 * of rules (difficulty.layers):
 *   layer 1  local rules: a black swan against the edge or in a corner, both
 *            arms of a black swan running straight on through the next cell,
 *            a white swan against the edge, a cell the loop already passes
 *            through, a cell with one line and only one way on,
 *   layer 2  patterns between swans: three white swans in a row, two black
 *            swans side by side, a white swan with one direction blocked, a
 *            white swan whose loop already runs straight on one side,
 *   layer 3  the hard ones: a step that would close the loop before every
 *            swan is on it, and a one step trial (try a line, propagate
 *            layers 1 and 2, a contradiction means a cross).
 * Easy and Medium are generated with layer 3 switched off entirely
 * (UROVNE[...].maxVrstva = 2), so those days never need a trial: the puzzle
 * keeps whatever swans layers 1 and 2 need. Hard and Challenge do allow
 * layer 3, and out of KANDIDATOV candidates (seeded date#0, date#1, ...)
 * sorted by obtiaznost() ascending, each level takes a fixed rank: Hard the
 * candidate that needs layer 3 least, Challenge the one that needs it most.
 * The record of what was picked is dni/YYYY-MM.json, built by postav.mjs;
 * the browser only recomputes when that file is missing.
 */
import { generateSeeded, isValidDate } from './generator.mjs';

export const PRVY_DEN = '2025-09-10';
export const KANDIDATOV = 6;
export const DNI = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const DNI_DLHE = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MESIACE = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/* maxVrstva: the highest layer of rules the puzzle is allowed to need. 2
 * means a person can finish it without ever trying a step out. */
export const UROVNE = {
  easy: { n: 6, label: 'Easy', maxVrstva: 2 },
  medium: { n: 7, label: 'Medium', maxVrstva: 2 },
  hard: { n: 8, label: 'Hard', maxVrstva: 3 },
  challenge: { n: 10, label: 'Challenge', maxVrstva: 3 },
};
/* Rank (0-based, out of KANDIDATOV candidates sorted by obtiaznost,
 * ascending) that each level picks. Easy and Medium share a pool shape with
 * no layer 3 at all, so their rank only spreads the layer 2 work: Easy takes
 * the quietest candidate, Medium a middle one. Hard and Challenge do allow
 * layer 3, and their rank is what separates them: fewest trials, most.
 * Ranks are only comparable inside one level's own pool, because each level
 * generates its own candidates at its own size. */
const PORADIE = { easy: 0, medium: 2, hard: 1, challenge: KANDIDATOV - 1 };
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
 * (a short loop or a trial) weighs far more than a layer 2 pattern, and a
 * layer 2 pattern more than a plain local step. Used only to sort candidates
 * against each other. */
export function obtiaznost(p) {
  const l = p.difficulty && p.difficulty.layers ? p.difficulty.layers : { 1: 0, 2: 0, 3: 0 };
  return (l[3] || 0) * 10000 + (l[2] || 0) * 100 + (l[1] || 0);
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

/* The puzzle for a date. Deterministic: the same date gives the same lake on
 * every machine. Slow enough on Challenge days (still under 4 s for all six
 * candidates together, see tests.mjs) that the built dni/*.json is used
 * whenever it exists. */
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
 * { d, n, p, h, v, u, l, s }: date or practice id, size, the swans as one
 * string of n*n characters (0 nothing, 1 a white swan, 2 a black one), the
 * solution's horizontal steps as n*(n-1) characters of 0/1 and its vertical
 * steps as (n-1)*n characters of 0/1, level id, the three layer counts as
 * "l1,l2,l3", and the total number of steps. */
export function zbal(p) {
  const l = p.difficulty && p.difficulty.layers ? p.difficulty.layers : { 1: 0, 2: 0, 3: 0 };
  return {
    d: p.date, n: p.n, p: p.pearls.join(''),
    h: p.solution.h.join(''), v: p.solution.v.join(''),
    u: p.uroven,
    l: [l[1] || 0, l[2] || 0, l[3] || 0].join(','),
    s: p.difficulty ? p.difficulty.steps || 0 : 0,
  };
}
export function rozbal(z) {
  const n = z.n;
  if (typeof z.p !== 'string' || typeof z.h !== 'string' || typeof z.v !== 'string') throw new Error('Bad packed puzzle');
  if (z.p.length !== n * n || z.h.length !== n * (n - 1) || z.v.length !== (n - 1) * n) throw new Error('Bad packed puzzle');
  const pearls = new Array(n * n);
  for (let i = 0; i < n * n; i++) {
    const x = Number(z.p[i]);
    if (!(x === 0 || x === 1 || x === 2)) throw new Error('Bad packed puzzle');
    pearls[i] = x;
  }
  const solution = {
    h: Array.from(z.h, (ch) => (ch === '1' ? 1 : 0)),
    v: Array.from(z.v, (ch) => (ch === '1' ? 1 : 0)),
  };
  const l = String(z.l || '0,0,0').split(',').map(Number);
  let pocet = 0;
  for (const x of pearls) if (x) pocet++;
  return {
    date: z.d, n, pearls, solution, uroven: z.u,
    difficulty: { layers: { 1: l[0] || 0, 2: l[1] || 0, 3: l[2] || 0 }, pearls: pocet, steps: z.s || 0 },
  };
}
