/* Owls: the weekly plan, dates, difficulty and the compact puzzle format.
 * Pure functions, no DOM, no dependencies beyond generator.mjs. Used by the
 * page (game.js), the build script (ops/games/owls/postav.mjs) and the tests.
 *
 * The week (Bratislava time):
 *   Monday, Tuesday      Easy       6 x 6   layer 1 only
 *   Wednesday, Thursday  Medium     8 x 8   layers 1 and 2
 *   Friday, Saturday     Hard      10 x 10  layers 1 and 2
 *   Sunday               Challenge 12 x 12  all three layers
 * Practice sets use the three smaller sizes (no Challenge practice set, the
 * same as every other game).
 *
 * Difficulty is measured, not guessed. generateSeeded runs the human solver
 * over the finished tree and reports how many steps came from each layer of
 * rules (difficulty.layers, [l1, l2, l3]):
 *   layer 1  two alike side by side, one empty branch between two alike, a
 *            line that already has all its owls of one kind,
 *   layer 2  every way to finish a whole line agrees on a branch, and the
 *            same once the ways that copy a finished line are dropped,
 *   layer 3  a trial: put one kind on a branch, follow layers 1 and 2, and
 *            when that breaks a rule the branch takes the other kind.
 * Out of KANDIDATOV candidates (seeded date#0, date#1, ...) sorted by
 * obtiaznost() ascending, each level takes a fixed rank: Easy the quietest,
 * Medium a middle one, Hard an upper one, Challenge the one that leans on
 * trials most. The record of what was picked is dni/YYYY-MM.json, built by
 * postav.mjs; the browser only recomputes when that file is missing.
 */
import { generateSeeded, isValidDate, porusenia } from './generator.mjs';

export const PRVY_DEN = '2025-09-10';
export const KANDIDATOV = 6;
export const DNI = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const DNI_DLHE = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MESIACE = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/* maxVrstva: the highest layer of rules the tree is allowed to need. */
export const UROVNE = {
  easy: { n: 6, label: 'Easy', maxVrstva: 1 },
  medium: { n: 8, label: 'Medium', maxVrstva: 2 },
  hard: { n: 10, label: 'Hard', maxVrstva: 2 },
  challenge: { n: 12, label: 'Challenge', maxVrstva: 3 },
};
/* Rank (0-based, out of KANDIDATOV candidates sorted by obtiaznost,
 * ascending) that each level picks. Ranks only compare inside one level's own
 * pool, because each level makes its candidates at its own size. */
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
/* "10 Sep" for chips, lists and the shared result */
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

/* One number for how hard a finished tree is to work out: a trial weighs far
 * more than a whole line, and a whole line more than a local step. The base is
 * 1000, not 100: a twelve by twelve has up to 121 open branches, so the layer
 * 1 count can pass a hundred and must not spill into the layer 2 place.
 * Used only to sort candidates against each other. */
export function obtiaznost(p) {
  const l = p.difficulty && p.difficulty.layers ? p.difficulty.layers : [0, 0, 0];
  return (l[2] || 0) * 1e6 + (l[1] || 0) * 1e3 + (l[0] || 0);
}

/* Picks one tree for a level out of KANDIDATOV candidates produced by
 * kandidat(k). Deterministic: the same candidates give the same pick,
 * because a stable sort keeps ties in the order the candidates were made. */
export function vyber(uroven, kandidat, pocet = KANDIDATOV) {
  const zoznam = [];
  for (let k = 0; k < pocet; k++) zoznam.push({ ...kandidat(k), uroven, kandidat: k });
  const zoradene = zoznam.slice().sort((a, b) => obtiaznost(a) - obtiaznost(b));
  const idx = Math.min(PORADIE[uroven], zoradene.length - 1);
  return zoradene[idx];
}

/* The tree for a date. Deterministic: the same date gives the same tree on
 * every machine. Fast enough on Sundays (six candidates together stay under
 * 4 s, see tests.mjs) that the built dni/*.json is used whenever it exists,
 * and live generation is only the fallback.
 *
 * A variant above zero adds '/v<n>' to the seed name, so the same date gets a
 * different candidate. ops/games/<game>/postav.mjs passes it when the day it
 * just built repeats a puzzle that is already sold in a book or an edition
 * (A-057, ops/games/vylucenia.mjs); the result is kept in dni/YYYY-MM.json,
 * the only source of truth for a daily puzzle. The browser never passes a
 * variant, so variant 0 is byte for byte what this function gives. */
export function zadaniePreDen(iso, variant = 0) {
  if (!isValidDate(iso)) throw new Error('Bad date: ' + iso);
  const u = urovenDna(iso);
  const { n, maxVrstva } = UROVNE[u];
  return vyber(u, (k) => generateSeeded(iso, iso + '/' + n + (variant ? '/v' + variant : '') + (k ? '#' + k : ''), { n, maxVrstva }));
}

/* A practice tree: set id and 1-based number. Not tied to any date. */
export function zadanieCvicenie(sada, k) {
  const s = SADY.find((x) => x.id === sada);
  if (!s || !(k >= 1 && k <= s.pocet)) throw new Error('Bad practice puzzle: ' + sada + ' ' + k);
  const { n, maxVrstva } = UROVNE[s.uroven];
  const name = 'practice-' + sada + '-' + k;
  return vyber(s.uroven, (j) => generateSeeded(name, 'practice/' + sada + '/' + k + '/' + n + (j ? '#' + j : ''), { n, maxVrstva }));
}

/* ── Compact format for dni.json and for embedding in pages ───────────── *
 * { d, n, g, s, u, l, t }: date or practice id, size, the givens as n*n
 * characters ('.' an empty branch, '0' a day owl, '1' a night owl), the
 * solution as n*n characters of '0' and '1', level id, the three layer counts
 * as "l1,l2,l3", and the number of steps. */
export function zbal(p) {
  const l = p.difficulty && p.difficulty.layers ? p.difficulty.layers : [0, 0, 0];
  return {
    d: p.date, n: p.n,
    g: p.givens.map((x) => (x == null ? '.' : String(x))).join(''),
    s: p.solution.join(''),
    u: p.uroven,
    l: [l[0] || 0, l[1] || 0, l[2] || 0].join(','),
    t: p.difficulty ? p.difficulty.steps || 0 : 0,
  };
}
/* The reverse, with a cheap check of the structure (no solver): lengths,
 * characters, givens that agree with the solution, and a solution that keeps
 * all three rules. The first thing that does not fit throws 'Bad packed
 * puzzle'. The expensive check, one tree and no guessing, belongs to
 * tests.mjs and postav.mjs. */
export function rozbal(z) {
  const zle = (co) => { throw new Error('Bad packed puzzle: ' + co); };
  if (!z || typeof z !== 'object') zle('not an object');
  const n = z.n;
  if (!Number.isInteger(n) || n < 2 || n > 16 || n % 2) zle('size');
  const C = n * n;
  if (typeof z.g !== 'string' || typeof z.s !== 'string') zle('fields');
  if (z.g.length !== C || z.s.length !== C) zle('length');
  if (!/^[.01]*$/.test(z.g)) zle('a strange character in the givens');
  if (!/^[01]*$/.test(z.s)) zle('a strange character in the solution');
  const solution = Array.from(z.s, (ch) => (ch === '1' ? 1 : 0));
  const givens = Array.from(z.g, (ch) => (ch === '.' ? null : ch === '1' ? 1 : 0));
  let pocet = 0;
  for (let i = 0; i < C; i++) {
    if (givens[i] == null) continue;
    pocet++;
    if (givens[i] !== solution[i]) zle('a given owl against the solution');
  }
  if (porusenia(solution, n).length) zle('the solution breaks a rule');
  const l = String(z.l || '0,0,0').split(',').map(Number);
  return {
    date: z.d, n, givens, solution, uroven: z.u,
    difficulty: { layers: [l[0] || 0, l[1] || 0, l[2] || 0], steps: z.t || 0, givens: pocet },
  };
}
