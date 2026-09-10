/* Squirrels: the weekly plan, dates, difficulty and the compact puzzle
 * format. Pure functions, no DOM, no dependencies beyond generator.mjs. Used
 * by the page (game.js), the build script (ops/games/squirrels/postav.mjs)
 * and the tests.
 *
 * The week (Bratislava time):
 *   Monday, Tuesday      Easy       6 x 6
 *   Wednesday, Thursday  Medium     8 x 8
 *   Friday, Saturday     Hard      10 x 10
 *   Sunday               Challenge 12 x 12
 * Practice sets use the three smaller sizes (no challenge size practice set,
 * the same idea as Magpies and Otters).
 *
 * Difficulty is measured, not guessed. generateSeeded runs the human solver
 * over the finished puzzle and reports how many steps came from each layer of
 * rules (difficulty.layers):
 *   layer 1  the last empty hollow of a run, a total that can be made in only
 *            one way, and the plain crossing of what the run across and the
 *            run down allow in one hollow,
 *   layer 2  a number a run has to use that fits only one of its hollows, a
 *            pair of hollows that hold two numbers between them, and a total
 *            that can only be made one way once the crossing runs are taken
 *            into account,
 *   layer 3  a one step trial: write a number in, follow the layer 1 rules,
 *            and drop the number when they run into a contradiction.
 * Easy and Medium are generated with layer 3 switched off entirely
 * (UROVNE[...].maxVrstva = 2), so those days never ask anyone to try a number
 * out. Hard and Challenge do allow layer 3, and out of KANDIDATOV candidates
 * (seeded date#0, date#1, ...) sorted by obtiaznost() ascending, each level
 * takes a fixed rank: Easy the quietest candidate, Challenge the one that
 * leans on the hard rules most. The record of what was picked is
 * dni/YYYY-MM.json, built by postav.mjs; the browser only recomputes when
 * that file is missing.
 */
import { generateSeeded, isValidDate, cluesFromSolution } from './generator.mjs';

export const PRVY_DEN = '2025-09-10';
export const KANDIDATOV = 6;
export const DNI = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const DNI_DLHE = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MESIACE = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/* maxVrstva: the highest layer of rules the puzzle is allowed to need. 2
 * means a person can finish it without ever trying a number out. */
export const UROVNE = {
  easy: { n: 6, label: 'Easy', maxVrstva: 2 },
  medium: { n: 8, label: 'Medium', maxVrstva: 2 },
  hard: { n: 10, label: 'Hard', maxVrstva: 3 },
  challenge: { n: 12, label: 'Challenge', maxVrstva: 3 },
};
/* Rank (0-based, out of KANDIDATOV candidates sorted by obtiaznost,
 * ascending) that each level picks. Ranks are only comparable inside one
 * level's own pool, because each level generates its own candidates at its
 * own size. */
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

/* One number for how hard a finished puzzle is to follow: every layer 3 step
 * (a trial) weighs far more than a layer 2 pattern, and a layer 2 pattern
 * more than a plain local step. Used only to sort candidates against each
 * other. */
export function obtiaznost(p) {
  const l = p.difficulty && p.difficulty.layers ? p.difficulty.layers : { 1: 0, 2: 0, 3: 0 };
  return (l[3] || 0) * 10000 + (l[2] || 0) * 100 + (l[1] || 0);
}

/* Picks one puzzle for a level out of KANDIDATOV candidates produced by
 * kandidat(k). Deterministic: the same candidates give the same pick, because
 * a stable sort keeps ties in the order the candidates were made. */
export function vyber(uroven, kandidat, pocet = KANDIDATOV) {
  const zoznam = [];
  for (let k = 0; k < pocet; k++) zoznam.push({ ...kandidat(k), uroven, kandidat: k });
  const zoradene = zoznam.slice().sort((a, b) => obtiaznost(a) - obtiaznost(b));
  const idx = Math.min(PORADIE[uroven], zoradene.length - 1);
  return zoradene[idx];
}

/* The puzzle for a date. Deterministic: the same date gives the same puzzle
 * on every machine. Fast enough to compute in the browser (all six candidates
 * of the slowest day stay well under 4 s, see tests.mjs), but the built
 * dni/*.json is used whenever it exists. */
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
 * { d, n, b, s, u, l, t }: date or practice id, size, the pattern as n*n
 * characters ('#' a trunk, '.' a hollow), the solution as one digit per
 * hollow in row major order, level id, the three layer counts as "l1,l2,l3",
 * and the total number of steps. The totals on the signs are not stored: they
 * are the sums of the runs, so cluesFromSolution reads them straight back off
 * the pattern and the digits. */
export function zbal(p) {
  const l = p.difficulty && p.difficulty.layers ? p.difficulty.layers : { 1: 0, 2: 0, 3: 0 };
  let b = '', s = '';
  for (let i = 0; i < p.n * p.n; i++) {
    if (p.cells[i]) b += '#';
    else { b += '.'; s += String(p.solution[i]); }
  }
  return {
    d: p.date, n: p.n, b, s, u: p.uroven,
    l: [l[1] || 0, l[2] || 0, l[3] || 0].join(','),
    t: p.difficulty ? p.difficulty.steps || 0 : 0,
  };
}
export function rozbal(z) {
  const n = z.n;
  if (typeof z.b !== 'string' || typeof z.s !== 'string') throw new Error('Bad packed puzzle');
  if (z.b.length !== n * n) throw new Error('Bad packed puzzle');
  const dark = new Uint8Array(n * n);
  let biele = 0;
  for (let i = 0; i < n * n; i++) {
    if (z.b[i] === '#') dark[i] = 1;
    else if (z.b[i] === '.') biele++;
    else throw new Error('Bad packed puzzle');
  }
  if (z.s.length !== biele) throw new Error('Bad packed puzzle');
  const solution = new Array(n * n).fill(0);
  let k = 0;
  for (let i = 0; i < n * n; i++) {
    if (dark[i]) continue;
    const d = z.s.charCodeAt(k++) - 48;
    if (!(d >= 1 && d <= 9)) throw new Error('Bad packed puzzle');
    solution[i] = d;
  }
  const cells = cluesFromSolution(dark, solution, n);
  const l = String(z.l || '0,0,0').split(',').map(Number);
  let trunks = 0;
  for (let i = 0; i < n * n; i++) if (dark[i]) trunks++;
  return {
    date: z.d, n, cells, solution, uroven: z.u,
    difficulty: { layers: { 1: l[0] || 0, 2: l[1] || 0, 3: l[2] || 0 }, trunks, steps: z.t || 0 },
  };
}
