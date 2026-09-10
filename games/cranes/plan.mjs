/* Cranes: the weekly plan, dates, difficulty and the compact puzzle format.
 * Pure functions, no DOM, no dependencies beyond generator.mjs. Used by the
 * page (game.js), the build script (ops/games/cranes/postav.mjs) and the
 * tests.
 *
 * The week (Bratislava time):
 *   Monday, Tuesday      Easy       7 x 7    8 to 10 sandbanks
 *   Wednesday, Thursday  Medium     9 x 9   12 to 15 sandbanks
 *   Friday, Saturday     Hard      11 x 11  18 to 22 sandbanks
 *   Sunday               Challenge 13 x 13  26 to 30 sandbanks
 * Practice sets use the three smaller sizes (no Challenge practice set, the
 * same idea as Magpies).
 *
 * Difficulty is measured, not guessed. generateSeeded runs the human solver
 * over the finished puzzle and reports how many steps came from each layer of
 * rules (difficulty.layers):
 *   layer 1  local rules: what a single number and the walkways already
 *            around it allow, and the fact that walkways never cross. This
 *            one rule covers the whole layer 1 list: a number that is twice
 *            its count of reachable sandbanks, a 1 or a 2 with a single
 *            neighbour, a sandbank whose remaining room is exactly what it
 *            still needs, a neighbour that is already full or blocked, and a
 *            number too big to be carried without at least one walkway to
 *            every neighbour,
 *   layer 2  a pair of sandbanks that a given count of walkways would finish
 *            off, closing their group away from the rest: two 1s never join,
 *            two 2s never join twice,
 *   layer 3  a one step trial: give a pair a count, follow layers 1 and 2,
 *            and rule the count out if it ends in a contradiction or in a
 *            group cut off from the rest.
 * Easy and Medium are generated with layer 3 switched off entirely
 * (UROVNE[...].maxVrstva = 2), so those days never need a trial. Hard and
 * Challenge do allow layer 3, and out of KANDIDATOV candidates (seeded
 * date#0, date#1, ...) sorted by obtiaznost() ascending, each level takes a
 * fixed rank: Easy the quietest, Medium a middle one, Hard high, Challenge
 * the one that leans on the harder layers most. The record of what was picked
 * is dni/YYYY-MM.json, built by postav.mjs; the browser only recomputes when
 * that file is missing.
 */
import { generateSeeded, isValidDate } from './generator.mjs';

export const PRVY_DEN = '2025-09-10';
export const KANDIDATOV = 6;
export const DNI = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const DNI_DLHE = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MESIACE = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/* n is the grid of points, ostrovy the range of sandbanks on it, maxVrstva
 * the highest layer of rules the puzzle is allowed to need. 2 means a person
 * can finish it without ever trying a count out. */
export const UROVNE = {
  easy: { n: 7, ostrovy: [8, 10], label: 'Easy', maxVrstva: 2 },
  medium: { n: 9, ostrovy: [12, 15], label: 'Medium', maxVrstva: 2 },
  hard: { n: 11, ostrovy: [18, 22], label: 'Hard', maxVrstva: 3 },
  challenge: { n: 13, ostrovy: [26, 30], label: 'Challenge', maxVrstva: 3 },
};
/* Rank (0-based, out of KANDIDATOV candidates sorted by obtiaznost,
 * ascending) that each level picks. Ranks are only comparable inside one
 * level's own pool, because each level generates its own candidates at its
 * own size. */
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

/* The puzzle for a date. Deterministic: the same date gives the same
 * sandbanks on every machine. Fast enough that the browser could do it, but
 * the built dni/*.json is used whenever it exists. */
export function zadaniePreDen(iso) {
  if (!isValidDate(iso)) throw new Error('Bad date: ' + iso);
  const u = urovenDna(iso);
  const { n, ostrovy, maxVrstva } = UROVNE[u];
  return vyber(u, (k) => generateSeeded(iso, iso + '/' + n + (k ? '#' + k : ''), { n, ostrovy, maxVrstva }));
}

/* A practice puzzle: set id and 1-based number. Not tied to any date. */
export function zadanieCvicenie(sada, k) {
  const s = SADY.find((x) => x.id === sada);
  if (!s || !(k >= 1 && k <= s.pocet)) throw new Error('Bad practice puzzle: ' + sada + ' ' + k);
  const { n, ostrovy, maxVrstva } = UROVNE[s.uroven];
  const name = 'practice-' + sada + '-' + k;
  return vyber(s.uroven, (j) => generateSeeded(name, 'practice/' + sada + '/' + k + '/' + n + (j ? '#' + j : ''), { n, ostrovy, maxVrstva }));
}

/* ── Compact format for dni.json and for embedding in pages ───────────── *
 * { d, n, i, b, u, l, s }: date or practice id, the grid of points, the
 * sandbanks as "r,c,n;r,c,n;..." in reading order, the walkways as
 * "a-b:k;a-b:k;..." (indices into the sandbanks, a < b, k is 1 or 2), level
 * id, the three layer counts as "l1,l2,l3", and the total number of steps. */
export function zbal(p) {
  const l = p.difficulty && p.difficulty.layers ? p.difficulty.layers : { 1: 0, 2: 0, 3: 0 };
  return {
    d: p.date, n: p.n,
    i: p.islands.map((o) => o.r + ',' + o.c + ',' + o.n).join(';'),
    b: p.bridges.map((m) => m.a + '-' + m.b + ':' + m.k).join(';'),
    u: p.uroven,
    l: [l[1] || 0, l[2] || 0, l[3] || 0].join(','),
    s: p.difficulty ? p.difficulty.steps || 0 : 0,
  };
}
export function rozbal(z) {
  const n = z.n;
  if (typeof z.i !== 'string' || typeof z.b !== 'string' || !(n > 0)) throw new Error('Bad packed puzzle');
  const islands = z.i.split(';').map((s) => {
    const p = s.split(',').map(Number);
    if (p.length !== 3 || p.some((x) => !Number.isInteger(x))) throw new Error('Bad packed sandbank: ' + s);
    if (p[0] < 0 || p[1] < 0 || p[0] >= n || p[1] >= n || p[2] < 1 || p[2] > 8) throw new Error('Sandbank off the grid: ' + s);
    return { r: p[0], c: p[1], n: p[2] };
  });
  const bridges = z.b === '' ? [] : z.b.split(';').map((s) => {
    const m = /^(\d+)-(\d+):([12])$/.exec(s);
    if (!m) throw new Error('Bad packed walkway: ' + s);
    const a = +m[1], b = +m[2];
    if (!(a < b) || b >= islands.length) throw new Error('Walkway between sandbanks that are not there: ' + s);
    return { a, b, k: +m[3] };
  });
  const l = String(z.l || '0,0,0').split(',').map(Number);
  let lavky = 0;
  for (const m of bridges) lavky += m.k;
  return {
    date: z.d, n, islands, bridges, uroven: z.u,
    difficulty: {
      layers: { 1: l[0] || 0, 2: l[1] || 0, 3: l[2] || 0 },
      ostrovy: islands.length, lavky, steps: z.s || 0,
    },
  };
}
