/* Voles: the weekly plan, dates, difficulty and the compact puzzle format.
 * Pure functions, no DOM, no dependencies beyond generator.mjs. Used by the
 * page (game.js), the build script (ops/games/voles/postav.mjs) and the
 * tests.
 *
 * The week (Bratislava time):
 *   Monday, Tuesday      Easy       6 x 6
 *   Wednesday, Thursday  Medium     8 x 8
 *   Friday, Saturday     Hard      10 x 10
 *   Sunday               Challenge 12 x 12
 * Practice sets use the three smaller sizes (no Challenge practice set, the
 * same idea as Magpies).
 *
 * Difficulty is measured, not guessed. generateSeeded runs the human solver
 * over the finished meadow and reports how many steps came from each layer
 * of rules (difficulty.layers):
 *   layer 1  the local ones: a 1 is alone, a cell between two numbers (which
 *            covers two numbers corner to corner as well, because the cell
 *            between them touches both by a side), an island that already has
 *            all its cells, every family placed or all the water shaded, a
 *            cell no number is close enough to reach, three water cells of a
 *            two by two block,
 *   layer 2  the ones that look further: an island with only one way to grow,
 *            a piece of water with only one way out, a cell that would join
 *            two numbers or overgrow an island, a cell no number can get to
 *            along any path,
 *   layer 3  the hard one: a trial. Put an island cell (or water) somewhere,
 *            follow layers 1 and 2, and when that ends in nonsense the cell
 *            has to be the other thing.
 * Easy and Medium are generated with layer 3 switched off entirely
 * (UROVNE[...].maxVrstva = 2), so those days never need a trial: the
 * generator keeps shrinking islands until layers 1 and 2 are enough. Hard and
 * Challenge do allow layer 3, and out of KANDIDATOV candidates (seeded
 * date#0, date#1, ...) sorted by obtiaznost() ascending, each level takes a
 * fixed rank: Easy the quietest, Medium a middle one, Hard a middle one of
 * its own harder pool, Challenge the one that leans on trials most. The
 * record of what was picked is dni/YYYY-MM.json, built by postav.mjs; the
 * browser only recomputes when that file is missing.
 */
import { generateSeeded, isValidDate } from './generator.mjs';

export const PRVY_DEN = '2025-09-10';
export const KANDIDATOV = 6;
export const DNI = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const DNI_DLHE = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MESIACE = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/* maxVrstva: the highest layer of rules the puzzle is allowed to need. 2
 * means a person can finish it without ever trying a cell out. */
export const UROVNE = {
  easy: { n: 6, label: 'Easy', maxVrstva: 2 },
  medium: { n: 8, label: 'Medium', maxVrstva: 2 },
  hard: { n: 10, label: 'Hard', maxVrstva: 3 },
  challenge: { n: 12, label: 'Challenge', maxVrstva: 3 },
};
/* Rank (0-based, out of KANDIDATOV candidates sorted by obtiaznost,
 * ascending) that each level picks. Easy and Medium share a pool shape with
 * no layer 3 at all, so their rank only spreads the layer 2 work. Hard and
 * Challenge do allow layer 3, and their rank is what separates them: Hard a
 * middle candidate, Challenge the one that needs the most trials. Ranks are
 * only comparable inside one level's own pool, because each level generates
 * its own candidates at its own size. */
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

/* One number for how hard a finished meadow is to work out: every layer 3
 * step (a trial) weighs far more than a layer 2 rule, and a layer 2 rule more
 * than a plain local step. Used only to sort candidates against each other. */
export function obtiaznost(p) {
  const l = p.difficulty && p.difficulty.layers ? p.difficulty.layers : { 1: 0, 2: 0, 3: 0 };
  return (l[3] || 0) * 10000 + (l[2] || 0) * 100 + (l[1] || 0);
}

/* Picks one meadow for a level out of KANDIDATOV candidates produced by
 * kandidat(k). Deterministic: the same candidates give the same pick,
 * because a stable sort keeps ties in the order the candidates were made. */
export function vyber(uroven, kandidat, pocet = KANDIDATOV) {
  const zoznam = [];
  for (let k = 0; k < pocet; k++) zoznam.push({ ...kandidat(k), uroven, kandidat: k });
  const zoradene = zoznam.slice().sort((a, b) => obtiaznost(a) - obtiaznost(b));
  const idx = Math.min(PORADIE[uroven], zoradene.length - 1);
  return zoradene[idx];
}

/* The meadow for a date. Deterministic: the same date gives the same meadow
 * on every machine. Fast enough even on Challenge days (all six candidates
 * together stay well under 4 s, see tests.mjs) that the built dni/*.json is
 * used whenever it exists, and live generation is only the fallback. */
export function zadaniePreDen(iso) {
  if (!isValidDate(iso)) throw new Error('Bad date: ' + iso);
  const u = urovenDna(iso);
  const { n, maxVrstva } = UROVNE[u];
  return vyber(u, (k) => generateSeeded(iso, iso + '/' + n + (k ? '#' + k : ''), { n, maxVrstva }));
}

/* A practice meadow: set id and 1-based number. Not tied to any date. */
export function zadanieCvicenie(sada, k) {
  const s = SADY.find((x) => x.id === sada);
  if (!s || !(k >= 1 && k <= s.pocet)) throw new Error('Bad practice puzzle: ' + sada + ' ' + k);
  const { n, maxVrstva } = UROVNE[s.uroven];
  const name = 'practice-' + sada + '-' + k;
  return vyber(s.uroven, (j) => generateSeeded(name, 'practice/' + sada + '/' + k + '/' + n + (j ? '#' + j : ''), { n, maxVrstva }));
}

/* ── Compact format for dni.json and for embedding in pages ───────────── *
 * { d, n, c, s, u, l, p }: date or practice id, size, the numbers as one
 * string (a digit per cell, a dot for a cell with no number, and a number of
 * ten or more written between two bars), the solution as n*n characters of
 * 0 for an island cell and 1 for water, level id, the three layer counts as
 * "l1,l2,l3", and the total number of steps. */
export function zbalClues(clues) {
  let out = '';
  for (const x of clues) {
    if (x == null) out += '.';
    else if (x < 10) out += String(x);
    else out += '|' + x + '|';
  }
  return out;
}
export function rozbalClues(s, C) {
  const clues = new Array(C).fill(null);
  let i = 0, j = 0;
  while (j < s.length) {
    if (i >= C) throw new Error('Bad packed puzzle: too many numbers');
    const ch = s[j];
    if (ch === '|') {
      const e = s.indexOf('|', j + 1);
      if (e < 0) throw new Error('Bad packed puzzle: unfinished number');
      const v = Number(s.slice(j + 1, e));
      if (!Number.isInteger(v) || v < 1) throw new Error('Bad packed puzzle: bad number');
      clues[i] = v;
      j = e + 1;
    } else if (ch === '.') {
      clues[i] = null;
      j++;
    } else {
      const v = Number(ch);
      if (!Number.isInteger(v) || v < 1) throw new Error('Bad packed puzzle: bad number');
      clues[i] = v;
      j++;
    }
    i++;
  }
  if (i !== C) throw new Error('Bad packed puzzle: wrong length');
  return clues;
}

export function zbal(p) {
  const l = p.difficulty && p.difficulty.layers ? p.difficulty.layers : { 1: 0, 2: 0, 3: 0 };
  return {
    d: p.date, n: p.n,
    c: zbalClues(p.clues),
    s: p.solution.join(''),
    u: p.uroven,
    l: [l[1] || 0, l[2] || 0, l[3] || 0].join(','),
    p: p.difficulty ? p.difficulty.steps || 0 : 0,
  };
}
export function rozbal(z) {
  const n = z.n;
  const C = n * n;
  if (typeof z.c !== 'string' || typeof z.s !== 'string') throw new Error('Bad packed puzzle');
  if (z.s.length !== C) throw new Error('Bad packed puzzle');
  const clues = rozbalClues(z.c, C);
  const solution = Array.from(z.s, (ch) => (ch === '1' ? 1 : 0));
  const l = String(z.l || '0,0,0').split(',').map(Number);
  let pocet = 0;
  for (const x of clues) if (x != null) pocet++;
  return {
    date: z.d, n, clues, solution, uroven: z.u,
    difficulty: { layers: { 1: l[0] || 0, 2: l[1] || 0, 3: l[2] || 0 }, clues: pocet, steps: z.p || 0 },
  };
}
