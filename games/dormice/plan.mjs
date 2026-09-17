/* Dormice: the weekly plan, dates, difficulty and the compact puzzle format.
 * Pure functions, no DOM, no dependencies beyond generator.mjs. Used by the
 * page (game.js), the build script (ops/games/dormice/postav.mjs) and the
 * tests.
 *
 * The week (Bratislava time):
 *   Monday, Tuesday      Easy       3 categories of 5, no weeks
 *   Wednesday, Thursday  Medium     4 categories of 4, with weeks
 *   Friday, Saturday     Hard       4 categories of 4, with weeks
 *   Sunday               Challenge  4 categories of 4, with weeks
 * Hard and Challenge have the same shape as Medium on purpose. The ceiling of
 * twelve columns is a measured number, not a guess: at 374 px of usable width
 * and a 30 px label column a cell is (374 - 30) / 12 = 28.7 px, above the
 * 24 by 24 px floor of WCAG 2.5.8, while fifteen columns would be 22.9 px and
 * below it. Difficulty grows through the kind of clue, how weak it is and
 * whether layer 3 is needed, never through size. The precedent is Badgers,
 * where Medium, Hard and Challenge are all 9 by 9.
 * Practice sets use the three lower levels (no challenge practice set, the
 * same idea as Magpies, Otters and Badgers).
 *
 * Difficulty is measured, not guessed. generateSeeded runs the human solver
 * over the finished puzzle and reports how many steps came from each layer:
 *   layer 1   one clue or one table: a clue read on its own, a row with one
 *             square left, an item with one place left, crossing out the rest
 *             of a row and a column after a tick,
 *   layer 2a  facts carried from table to table,
 *   layer 2b  patterns and order: every remaining middle item rules something
 *             out, either sets, order, apart, ends and between windows, naked
 *             and hidden sets,
 *   layer 3   a one step trial, exactly one assumption deep: put a tick in,
 *             run layers 1 to 2b, and cross the square out when a clue breaks.
 * Easy, Medium and Hard are generated with layer 3 switched off entirely, so
 * on those days the game never asks anyone to test anything. Challenge not
 * only allows layer 3, it requires it (PROFILY.challenge.vyzadujeL3).
 */
import { generateSeeded, isValidDate, PROFILY, BANKY, KATEGORIE, NAZVY_KATEGORII, JEDNOTNE, legalna, pravdiva, polozka } from './generator.mjs';

export const PRVY_DEN = '2025-09-10';
export const KANDIDATOV = 6;
export const DNI = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const DNI_DLHE = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MESIACE = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* maxVrstva: the highest layer of rules the puzzle is allowed to need. '2b'
 * means a person can finish it without ever testing an assumption. `strop` is
 * only an upper bound on how many clues a puzzle may carry, never a target
 * and never a lower bound: the minimising pass pushes the set down and a lower
 * bound would throw perfectly good puzzles away. The real spread is measured
 * and printed by tests.mjs. */
export const UROVNE = {
  easy: { ...PROFILY.easy, label: 'Easy' },
  medium: { ...PROFILY.medium, label: 'Medium' },
  hard: { ...PROFILY.hard, label: 'Hard' },
  challenge: { ...PROFILY.challenge, label: 'Challenge' },
};

/* Rank (0-based, out of KANDIDATOV candidates sorted by obtiaznost,
 * ascending) that each level picks. Ranks are only comparable inside one
 * level's own pool, because each level generates its own candidates with its
 * own shape and its own highest allowed layer. */
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

/* One number for how hard a finished puzzle is to follow. The bases are 1000,
 * not 100: Dormice has six tables of sixteen squares at four categories of
 * four, so a layer 1 count above a hundred is normal and with Badgers bases it
 * would roll over into the layer 2 term. No tiebreak on the number of clues
 * either: with a weight of 1000 that would not be a tiebreak but the second
 * strongest term, and the sentence "difficulty is measured in solver steps"
 * would stop being true. */
export function obtiaznost(p) {
  const l = (p.difficulty && p.difficulty.layers) || {};
  return (l['3'] || 0) * 1e9 + (l['2b'] || 0) * 1e6 + (l['2a'] || 0) * 1e3 + (l['1'] || 0);
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

function optsUrovne(u) {
  const { k, N, maxVrstva, strop, vahy, maxLink, vyzadujeL3, maxAttempts } = UROVNE[u];
  return { k, N, maxVrstva, strop, vahy, maxLink, vyzadujeL3, maxAttempts };
}

/* The puzzle for a date. Deterministic: the same date gives the same puzzle on
 * every machine. Fast enough to compute in the browser (all six candidates of
 * the slowest day stay well under 4 s, see tests.mjs), but the built
 * dni/*.json is used whenever it exists.
 *
 * A variant above zero adds '/v<n>' to the seed name, so the same date gets
 * a different candidate. ops/games/<game>/postav.mjs passes it when the day
 * it just built repeats a puzzle that is already sold in a book or an
 * edition (A-057, ops/games/vylucenia.mjs); it then keeps the result in
 * dni/YYYY-MM.json, which is the only source of truth for a daily puzzle
 * anyway. The browser never passes a variant, so variant 0 is byte for byte
 * what this function gave before.
 */
export function zadaniePreDen(iso, variant = 0) {
  if (!isValidDate(iso)) throw new Error('Bad date: ' + iso);
  const u = urovenDna(iso);
  const o = optsUrovne(u);
  const tvar = o.k + 'x' + o.N;
  return vyber(u, (k) => generateSeeded(iso, iso + '/' + tvar + (variant ? '/v' + variant : '') + (k ? '#' + k : ''), o));
}

/* A practice puzzle: set id and 1-based number. Not tied to any date. */
export function zadanieCvicenie(sada, k) {
  const s = SADY.find((x) => x.id === sada);
  if (!s || !(k >= 1 && k <= s.pocet)) throw new Error('Bad practice puzzle: ' + sada + ' ' + k);
  const o = optsUrovne(s.uroven);
  const tvar = o.k + 'x' + o.N;
  const name = 'practice-' + sada + '-' + k;
  return vyber(s.uroven, (j) => generateSeeded(name, 'practice/' + sada + '/' + k + '/' + tvar + (j ? '#' + j : ''), o));
}

/* ── Compact format for dni.json and for embedding in pages ───────────── *
 * { d, k, N, b, u, s, c, q, l, t }: date or practice id, how many categories,
 * how many items each, the bank set id plus the item indices of the cast, the
 * level, the solution as k-1 strings of digits, the clues joined by ';' with
 * the fields of one clue joined by '|' (the type letter, then the items as
 * category.index, then the numeric arguments), the index of the store the
 * closing question asks about, the four layer counts and the number of steps.
 * The bank set id is what keeps the names out of the record: the banks are
 * append only and frozen, so one correction to a word cannot quietly change
 * every published day and every printed PDF a year back. */
function zbalIndiciu(cl) {
  const casti = [cl.t];
  for (const [a, i] of cl.it) casti.push(a + '.' + i);
  if (cl.t === 'E') { casti.push(String(cl.c)); casti.push(String(cl.s)); }
  if (cl.t === 'O' || cl.t === 'A') { casti.push(String(cl.g1)); casti.push(String(cl.g2)); }
  if (cl.t === 'N') casti.push(String(cl.kde));
  return casti.join('|');
}
function rozbalIndiciu(s) {
  const casti = String(s).split('|');
  const t = casti[0];
  const it = [];
  const cisla = [];
  for (const c of casti.slice(1)) {
    if (c.indexOf('.') >= 0) {
      const [a, i] = c.split('.').map(Number);
      it.push([a, i]);
    } else cisla.push(Number(c));
  }
  const cl = { t, it };
  if (t === 'E') { cl.c = cisla[0]; cl.s = cisla[1]; }
  if (t === 'O' || t === 'A') { cl.g1 = cisla[0]; cl.g2 = cisla[1]; }
  if (t === 'N') cl.kde = cisla[0];
  return cl;
}

export function zbal(p) {
  const l = (p.difficulty && p.difficulty.layers) || {};
  return {
    d: p.date, k: p.k, N: p.N,
    b: p.bank + ':' + p.cats.map((c) => c.idx.join(',')).join('/'),
    u: p.uroven,
    s: p.solution.slice(1).map((r) => r.join('')).join('-'),
    c: p.clues.map(zbalIndiciu).join(';'),
    q: p.question.what,
    l: [l['1'] || 0, l['2a'] || 0, l['2b'] || 0, l['3'] || 0].join(','),
    t: (p.difficulty && p.difficulty.steps) || 0,
  };
}

/* rozbal is a cheap structural check, not a solver: the permutations really
 * are permutations, every clue is true against the solution it carries, the
 * number of clues is under the level's ceiling and the items have different
 * first letters. The heavy checking belongs in tests.mjs and in postav.mjs.
 * A full solveHuman here would run on a phone at every page load, which is
 * exactly what Badgers avoids by calling only the cheap ohradyOk in rozbal. */
export function rozbal(z) {
  const zle = () => { throw new Error('Bad packed puzzle'); };
  const k = z.k, N = z.N;
  if (!(k === 3 || k === 4) || !(N >= 3 && N <= 5)) zle();
  if (typeof z.b !== 'string' || typeof z.s !== 'string' || typeof z.c !== 'string') zle();
  const dveCasti = z.b.split(':');
  if (dveCasti.length !== 2 || dveCasti[0] !== BANKY.sada) zle();
  const obsadenie = dveCasti[1].split('/').map((r) => r.split(',').map(Number));
  if (obsadenie.length !== k) zle();
  const cats = [];
  const pismena = new Set();
  for (let a = 0; a < k; a++) {
    const id = KATEGORIE[a];
    const idx = obsadenie[a];
    if (idx.length !== N) zle();
    const items = [];
    for (const i of idx) {
      if (!Number.isInteger(i) || i < 0 || i >= BANKY[id].length) zle();
      items.push(BANKY[id][i]);
    }
    if (new Set(idx).size !== N) zle();
    if (id !== 'when') {
      for (const w of items) {
        const p = w.charAt(0).toUpperCase();
        if (pismena.has(p)) zle();
        pismena.add(p);
      }
    }
    /* The same shape a freshly generated puzzle carries, so the page can draw
       a record from dni/*.json without knowing where it came from. */
    cats.push({ id, label: NAZVY_KATEGORII[id], jedno: JEDNOTNE[id], idx, items });
  }
  const solution = [Array.from({ length: N }, (_, x) => x)];
  const riadky = z.s.split('-');
  if (riadky.length !== k - 1) zle();
  for (const r of riadky) {
    if (r.length !== N) zle();
    const perm = r.split('').map(Number);
    for (const v of perm) if (!Number.isInteger(v) || v < 0 || v >= N) zle();
    if (new Set(perm).size !== N) zle();
    solution.push(perm);
  }
  const ordered = k === 4 ? 3 : -1;
  const clues = z.c ? z.c.split(';').map(rozbalIndiciu) : [];
  const strop = UROVNE[z.u] ? UROVNE[z.u].strop : 4 * N * k;
  if (clues.length > strop) zle();
  for (const cl of clues) {
    if (!legalna(cl, k, N, ordered)) zle();
    if (!pravdiva(cl, solution, k, N, ordered)) zle();
  }
  if (!Number.isInteger(z.q) || z.q < 0 || z.q >= N) zle();
  const l = String(z.l || '0,0,0,0').split(',').map(Number);
  return {
    date: z.d, k, N, ordered, bank: BANKY.sada, cats, clues, solution,
    question: { what: z.q }, uroven: z.u,
    difficulty: {
      layers: { 1: l[0] || 0, '2a': l[1] || 0, '2b': l[2] || 0, 3: l[3] || 0 },
      clues: clues.length, steps: z.t || 0,
    },
  };
}

/* The cast of one puzzle, category by category, for the page and the book. */
export function obsadenie(zad) {
  return zad.cats.map((c) => ({
    id: c.id, label: c.label,
    items: c.items.map((_, i) => polozka(zad, zad.cats.indexOf(c), i)),
  }));
}
