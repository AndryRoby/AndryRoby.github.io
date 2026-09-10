/* Hares: the weekly plan, dates, difficulty and the compact puzzle format.
 * Pure functions, no DOM, no dependencies beyond generator.mjs. Used by the
 * page (game.js), the build script (ops/games/hares/postav.mjs) and the
 * tests.
 *
 * The week (Bratislava time):
 *   Monday, Tuesday      Easy       6 x 6, knight rule, 12 numbers given
 *   Wednesday, Thursday  Medium     9 x 9, knight rule, 30 numbers given
 *   Friday, Saturday     Hard       9 x 9, knight and king rule, 25 given
 *   Sunday               Challenge  9 x 9, knight and king rule, 20 given
 * Practice sets use the three smaller settings (no challenge practice set,
 * the same idea as Magpies, Otters and Squirrels).
 *
 * Difficulty is measured, not guessed, and it grows two ways: fewer numbers
 * are given away, and the rules a person has to reach for get harder.
 * generateSeeded runs the human solver over the finished puzzle and reports
 * how many steps came from each layer (difficulty.layers):
 *   layer 1  only one number is left for a burrow (its row, its column, its
 *            block, a knight leap and, on the king days, a touching burrow
 *            all take numbers away), and a number that fits only one burrow
 *            of a row, a column or a block for plain reasons,
 *   layer 2  a number that fits only one burrow of its row, column or block
 *            once the knight leap or the king touch is counted in, a pair of
 *            burrows holding two numbers between them, and a number that
 *            sits in only one row or column of a block,
 *   layer 3  a one step trial: write a number in, follow it one step, and
 *            drop the number when it runs into a contradiction.
 * Easy and Medium are generated with layer 3 switched off entirely
 * (UROVNE[...].maxVrstva = 2), so those days never ask anyone to try a
 * number out. Hard and Challenge do allow layer 3. Out of KANDIDATOV
 * candidates (seeded date#0, date#1, ...) sorted by obtiaznost() ascending,
 * each level takes a fixed rank: Easy the quietest candidate, Challenge the
 * one that leans on the hard rules most. The record of what was picked is
 * dni/YYYY-MM.json, built by postav.mjs; the browser only recomputes when
 * that file is missing.
 */
import { generateSeeded, isValidDate } from './generator.mjs';

export const PRVY_DEN = '2025-09-10';
export const KANDIDATOV = 6;
export const DNI = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const DNI_DLHE = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MESIACE = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/* n: size. rules: the two extra rules of the day. dane: how many numbers the
 * puzzle gives away (the minimising pass empties burrows down to this count
 * while the puzzle stays unique and guess free). maxVrstva: the highest
 * layer of rules the puzzle is allowed to need; 2 means a person can finish
 * it without ever trying a number out. */
export const UROVNE = {
  easy: { n: 6, label: 'Easy', rules: { knight: true, king: false }, dane: 12, maxVrstva: 2 },
  medium: { n: 9, label: 'Medium', rules: { knight: true, king: false }, dane: 30, maxVrstva: 2 },
  hard: { n: 9, label: 'Hard', rules: { knight: true, king: true }, dane: 25, maxVrstva: 3 },
  challenge: { n: 9, label: 'Challenge', rules: { knight: true, king: true }, dane: 20, maxVrstva: 3 },
};
/* Rank (0-based, out of KANDIDATOV candidates sorted by obtiaznost,
 * ascending) that each level picks. Ranks are only comparable inside one
 * level's own pool, because each level generates its own candidates at its
 * own size and with its own rules. */
const PORADIE = { easy: 0, medium: 2, hard: 3, challenge: KANDIDATOV - 1 };
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

/* One number for how hard a finished puzzle is to follow. A layer 3 step (a
 * trial) weighs far more than a layer 2 pattern, a layer 2 pattern more than
 * a plain local step, and among puzzles that need the same rules the one
 * that gives fewer numbers away counts as the harder one. Used only to sort
 * candidates of one level against each other. */
export function obtiaznost(p) {
  const d = p.difficulty || {};
  const l = d.layers || { 1: 0, 2: 0, 3: 0 };
  const volne = p.n * p.n - (d.dane || 0);
  return ((l[3] || 0) * 10000 + (l[2] || 0) * 100 + (l[1] || 0)) * 100 + volne;
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

/* The puzzle for a date. Deterministic: the same date gives the same puzzle
 * on every machine. Fast enough to compute in the browser (all six
 * candidates of the slowest day stay far under 4 s, see tests.mjs), but the
 * built dni/*.json is used whenever it exists. */
export function zadaniePreDen(iso) {
  if (!isValidDate(iso)) throw new Error('Bad date: ' + iso);
  const u = urovenDna(iso);
  const { n, rules, dane, maxVrstva } = UROVNE[u];
  return vyber(u, (k) => generateSeeded(iso, iso + '/' + n + (k ? '#' + k : ''), { n, rules, dane, maxVrstva }));
}

/* A practice puzzle: set id and 1-based number. Not tied to any date. */
export function zadanieCvicenie(sada, k) {
  const s = SADY.find((x) => x.id === sada);
  if (!s || !(k >= 1 && k <= s.pocet)) throw new Error('Bad practice puzzle: ' + sada + ' ' + k);
  const { n, rules, dane, maxVrstva } = UROVNE[s.uroven];
  const name = 'practice-' + sada + '-' + k;
  return vyber(s.uroven, (j) => generateSeeded(name, 'practice/' + sada + '/' + k + '/' + n + (j ? '#' + j : ''), { n, rules, dane, maxVrstva }));
}

/* ── Compact format for dni.json and for embedding in pages ───────────── *
 * { d, n, r, g, s, u, l, t }: date or practice id, size, the rules of the
 * day ('k' knight only, 'kk' knight and king), the givens as n*n characters
 * (a digit, '0' for an empty burrow), the solution as n*n digits, the level
 * id, the three layer counts as "l1,l2,l3", and the total number of steps
 * the human solver took. */
export function zbal(p) {
  const d = p.difficulty || {};
  const l = d.layers || { 1: 0, 2: 0, 3: 0 };
  let g = '', s = '';
  for (let i = 0; i < p.n * p.n; i++) {
    g += String(p.givens[i] || 0);
    s += String(p.solution[i]);
  }
  return {
    d: p.date, n: p.n, r: p.rules && p.rules.king ? 'kk' : 'k', g, s, u: p.uroven,
    l: [l[1] || 0, l[2] || 0, l[3] || 0].join(','),
    t: d.steps || 0,
  };
}
export function rozbal(z) {
  const n = z.n;
  if (typeof z.g !== 'string' || typeof z.s !== 'string') throw new Error('Bad packed puzzle');
  if (z.g.length !== n * n || z.s.length !== n * n) throw new Error('Bad packed puzzle');
  if (z.r !== 'k' && z.r !== 'kk') throw new Error('Bad packed puzzle');
  const givens = new Array(n * n).fill(0);
  const solution = new Array(n * n).fill(0);
  let dane = 0;
  for (let i = 0; i < n * n; i++) {
    const a = z.g.charCodeAt(i) - 48, b = z.s.charCodeAt(i) - 48;
    if (!(b >= 1 && b <= n)) throw new Error('Bad packed puzzle');
    if (a !== 0 && a !== b) throw new Error('Bad packed puzzle');
    if (a) { givens[i] = a; dane++; }
    solution[i] = b;
  }
  const l = String(z.l || '0,0,0').split(',').map(Number);
  return {
    date: z.d, n, rules: { knight: true, king: z.r === 'kk' }, givens, solution, uroven: z.u,
    difficulty: { layers: { 1: l[0] || 0, 2: l[1] || 0, 3: l[2] || 0 }, dane, steps: z.t || 0 },
  };
}
