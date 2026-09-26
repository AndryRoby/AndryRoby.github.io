/* Foxes: the weekly plan, dates, difficulty and the compact puzzle format.
 * Pure functions, no DOM, no dependencies beyond generator.mjs. Used by the
 * page (game.js), the build script (ops/games/foxes/postav.mjs) and the
 * tests.
 *
 * The week (Bratislava time, ops/spec-foxes.md part 3):
 *   Monday, Tuesday      Easy       5 by 5, four foxes, layer 1 only
 *   Wednesday, Thursday  Medium     6 by 6, five foxes, up to layer 2
 *   Friday, Saturday     Hard       7 by 7, six foxes, up to layer 2
 *   Sunday               Challenge  7 by 7, six foxes, needs layer 3
 * Challenge is not bigger than Hard; it is harder, because on Sunday one fox
 * has to be tried in one of its two cells and followed until something
 * breaks, one to three times a lair (MAX_SKUSOK_NEDELA).
 * Four levels and not three: every other game has four, the week and the
 * book pipe are built on them (spec part 3). Practice sets use the three
 * lower levels, as everywhere.
 *
 * Difficulty is measured, not guessed: generateSeeded runs the human solver
 * over the finished puzzle and reports how many steps came from each layer.
 * Easy, Medium and Hard are generated with layer 3 switched off, so on those
 * days the game never asks anyone to try anything.
 */
import { generateSeeded, isValidDate, PROFILY, BANKY, PISMENA, VLASTNOSTI, struktura, pripravIndicie, drzitel } from './generator.mjs';

export const PRVY_DEN = '2025-09-10';
export const KANDIDATOV = 6;
export const DNI = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const DNI_DLHE = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MESIACE = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const UROVNE = {
  easy: { ...PROFILY.easy, label: 'Easy' },
  medium: { ...PROFILY.medium, label: 'Medium' },
  hard: { ...PROFILY.hard, label: 'Hard' },
  challenge: { ...PROFILY.challenge, label: 'Challenge' },
};

/* Rank (0-based, out of KANDIDATOV candidates sorted by obtiaznost,
   ascending) that each level picks. */
const PORADIE = { easy: 0, medium: 2, hard: 3, challenge: 5 };

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
/* "10 Sep" for chips, lists and Share */
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

/* One number for how hard a finished puzzle is to follow: layer 3 steps
   weigh most, then layer 2, then layer 1. Measured l1 stays under 25 and l2
   under 40, so the bases of 1000 never roll over (tests.mjs checks it). */
export function obtiaznost(p) {
  const l = (p.difficulty && p.difficulty.layers) || {};
  return (l[3] || 0) * 1e6 + (l[2] || 0) * 1e3 + (l[1] || 0);
}

/* The Sunday asks for a trial one to three times, not for a string of
   trials: only candidates with one to MAX_SKUSOK_NEDELA trials are ranked
   (all of them if none qualifies). The first build took the hardest of six
   and landed on six trials on 49 of 107 Sundays (critic 25. 9., finding 5);
   with trials only on a piece with two cells (generator.mjs MIEST_SKUSKY)
   candidates rarely go over three anyway, this keeps it so. */
export const MAX_SKUSOK_NEDELA = 3;

/* Picks one puzzle for a level out of KANDIDATOV candidates. Deterministic:
   a stable sort keeps ties in the order the candidates were made. */
export function vyber(uroven, kandidat, pocet = KANDIDATOV) {
  const zoznam = [];
  for (let k = 0; k < pocet; k++) zoznam.push({ ...kandidat(k), uroven, kandidat: k });
  let mozne = zoznam;
  if (uroven === 'challenge') {
    const l3 = (p) => (p.difficulty && p.difficulty.layers && p.difficulty.layers[3]) || 0;
    const v = zoznam.filter((p) => l3(p) >= 1 && l3(p) <= MAX_SKUSOK_NEDELA);
    if (v.length) mozne = v;
  }
  const zoradene = mozne.slice().sort((a, b) => obtiaznost(a) - obtiaznost(b));
  return zoradene[Math.min(PORADIE[uroven], zoradene.length - 1)];
}

/* Only these keys go into the generator (spec part 3: the book pipe passes a
   white list too). */
function optsUrovne(u) {
  const { n, maxVrstva, maxAttempts } = UROVNE[u];
  return { n, maxVrstva, maxAttempts };
}

/* The puzzle for a date. Deterministic: the same date gives the same puzzle
   on every machine; the built dni/YYYY-MM.json is used whenever it exists.
   A variant above zero adds '/v<n>' to the seed (ops/games/vylucenia.mjs,
   A-057); the browser never passes one. */
export function zadaniePreDen(iso, variant = 0) {
  if (!isValidDate(iso)) throw new Error('Bad date: ' + iso);
  const u = urovenDna(iso);
  const o = optsUrovne(u);
  const tvar = o.n + 'x' + o.n;
  return vyber(u, (k) => generateSeeded(iso, iso + '/' + tvar + (variant ? '/v' + variant : '') + (k ? '#' + k : ''), o));
}

/* A practice puzzle: set id and 1-based number. Not tied to any date. */
export function zadanieCvicenie(sada, k) {
  const s = SADY.find((x) => x.id === sada);
  if (!s || !(k >= 1 && k <= s.pocet)) throw new Error('Bad practice puzzle: ' + sada + ' ' + k);
  const o = optsUrovne(s.uroven);
  const tvar = o.n + 'x' + o.n;
  const name = 'practice-' + sada + '-' + k;
  return vyber(s.uroven, (j) => generateSeeded(name, 'practice/' + sada + '/' + k + '/' + tvar + (j ? '#' + j : ''), o));
}

/* ── Compact format for dni.json and for embedding in pages ───────────── *
 * { d, n, b, r, x, f, c, s, u, l, t } (spec part 4): date or practice id,
 * side, the bank set id with the cast as indices (fox names, chamber names,
 * the trait pair, one group bit per fox, the thing), the chambers as letters
 * a to g, the stones, the floor marks (. m r l), the clues joined by ';' with
 * the fields of one clue joined by '|', the solution as cells, the level, the
 * three layer counts and the number of steps. No name travels in the record:
 * the banks are frozen, so a correction to a word cannot change a published
 * day. */
const TYP_Z_PISMENA = Object.fromEntries(Object.entries(PISMENA).map(([t, p]) => [p, t]));
const POLIA = {
  IN: ['p', 'k'], NOTIN: ['p', 'k'], ON: ['p', 'f'], EDGE: ['p', 'e'], BESIDE: ['p'], EMPTY: ['k'], GNOT: ['g', 'k'],
  SAME: ['p', 'q'], DIFF: ['p', 'q'], LEFT: ['p', 'q'], ABOVE: ['p', 'q'], NEXTCOL: ['p', 'q'], CORNER: ['p', 'q'], HOLDER: ['g'],
};
const ZNAK_PISMENO = ['m', 'r', 'l'];
function zbalIndiciu(cl) { return [PISMENA[cl.t], ...POLIA[cl.t].map((k) => String(cl[k]))].join('|'); }
function rozbalIndiciu(s) {
  const casti = String(s).split('|');
  const t = TYP_Z_PISMENA[casti[0]];
  if (!t || casti.length !== POLIA[t].length + 1) return null;
  const cl = { t };
  POLIA[t].forEach((k, i) => { cl[k] = Number(casti[i + 1]); });
  return cl;
}

export function zbal(p) {
  const l = (p.difficulty && p.difficulty.layers) || {};
  return {
    d: p.date, n: p.n,
    b: p.bank + ':' + [p.lisky.join(','), p.komoryIdx.join(','), p.vlastnost, p.skupina.join(''), p.vecIdx].join('/'),
    r: p.komory.map((k) => String.fromCharCode(97 + k)).join(''),
    x: p.kamene.join(','),
    f: p.znaky.map((z) => (z < 0 ? '.' : ZNAK_PISMENO[z])).join(''),
    c: p.clues.map(zbalIndiciu).join(';'),
    s: p.solution.join(','),
    u: p.uroven,
    l: [l[1] || 0, l[2] || 0, l[3] || 0].join(','),
    t: (p.difficulty && p.difficulty.steps) || 0,
  };
}

/* rozbal is a cheap structural check, not a solver (as in Badgers and
   Dormice): shapes and letters, contiguous chambers of at least three cells,
   one piece in every row and column and none on a stone, exactly one fox in
   the chamber of the lost thing, every clue true against the solution, the
   number of clues under the ceiling of the level, and different first
   letters. Full uniqueness belongs to tests.mjs and postav.mjs; a solver here
   would run on a phone at every page load. */
export function rozbal(z) {
  const zle = () => { throw new Error('Bad packed puzzle'); };
  const n = z.n;
  if (!(n === 5 || n === 6 || n === 7)) zle();
  const C = n * n, V = n - 1;
  for (const k of ['b', 'r', 'x', 'f', 'c', 's']) if (typeof z[k] !== 'string') zle();
  const dve = z.b.split(':');
  if (dve.length !== 2 || dve[0] !== BANKY.sada) zle();
  const casti = dve[1].split('/');
  if (casti.length !== 5) zle();
  const lisky = casti[0].split(',').map(Number);
  const komoryIdx = casti[1].split(',').map(Number);
  const vl = Number(casti[2]);
  const skupina = casti[3].split('').map(Number);
  const vecIdx = Number(casti[4]);
  if (lisky.length !== V || skupina.length !== V) zle();
  for (const i of lisky) if (!Number.isInteger(i) || i < 0 || i >= BANKY.foxes.length) zle();
  for (const i of komoryIdx) if (!Number.isInteger(i) || i < 0 || i >= BANKY.chambers.length) zle();
  if (!Number.isInteger(vl) || vl < 0 || vl >= VLASTNOSTI.length) zle();
  if (skupina.some((g) => g !== 0 && g !== 1) || skupina.every((g) => g === 0) || skupina.every((g) => g === 1)) zle();
  if (!Number.isInteger(vecIdx) || vecIdx < 0 || vecIdx >= BANKY.things.length) zle();
  const mena = lisky.map((i) => BANKY.foxes[i]);
  const menaKomor = komoryIdx.map((i) => BANKY.chambers[i]);
  const pismena = new Set([...mena, ...menaKomor].map((w) => w.charAt(0).toUpperCase()));
  if (pismena.size !== mena.length + menaKomor.length) zle();
  const K = komoryIdx.length;
  if (K < 2) zle();
  // chambers
  if (z.r.length !== C) zle();
  const komory = [];
  for (const ch of z.r) { const k = ch.charCodeAt(0) - 97; if (!(k >= 0 && k < K)) zle(); komory.push(k); }
  for (let k = 0; k < K; k++) {
    const bunky = [];
    for (let c = 0; c < C; c++) if (komory[c] === k) bunky.push(c);
    if (bunky.length < 3) zle();
    const videne = new Set([bunky[0]]), fronta = [bunky[0]];
    while (fronta.length) {
      const c = fronta.pop(), r = (c / n) | 0, s = c % n;
      for (const d of [r > 0 ? c - n : -1, r < n - 1 ? c + n : -1, s > 0 ? c - 1 : -1, s < n - 1 ? c + 1 : -1]) {
        if (d >= 0 && komory[d] === k && !videne.has(d)) { videne.add(d); fronta.push(d); }
      }
    }
    if (videne.size !== bunky.length) zle();
  }
  // stones and floor marks
  const kamene = z.x ? z.x.split(',').map(Number) : [];
  for (const c of kamene) if (!Number.isInteger(c) || c < 0 || c >= C) zle();
  if (new Set(kamene).size !== kamene.length) zle();
  kamene.sort((a, b) => a - b);
  if (z.f.length !== C) zle();
  const znaky = [];
  for (const ch of z.f) { const i = ch === '.' ? -1 : ZNAK_PISMENO.indexOf(ch); if (ch !== '.' && i < 0) zle(); znaky.push(i); }
  for (const c of kamene) if (znaky[c] >= 0) zle();
  // solution
  const solution = z.s.split(',').map(Number);
  if (solution.length !== n) zle();
  let rr = 0, ss = 0;
  const kamen = new Set(kamene);
  for (const a of solution) {
    if (!Number.isInteger(a) || a < 0 || a >= C || kamen.has(a)) zle();
    rr |= 1 << ((a / n) | 0); ss |= 1 << (a % n);
  }
  if (rr !== (1 << n) - 1 || ss !== (1 << n) - 1) zle();
  const zad = {
    date: z.d, n, K, komory, kamene, znaky, bank: BANKY.sada,
    lisky, komoryIdx, vlastnost: vl, skupina, vecIdx, mena, menaKomor, vec: BANKY.things[vecIdx],
    clues: [], solution, uroven: z.u,
  };
  if (drzitel(zad, solution) < 0) zle();
  // clues
  const clues = z.c ? z.c.split(';').map(rozbalIndiciu) : [];
  if (clues.some((cl) => !cl)) zle();
  const strop = UROVNE[z.u] ? UROVNE[z.u].strop : 4 * n;
  if (clues.length > strop) zle();
  for (const cl of clues) {
    for (const k of ['p', 'q']) if (cl[k] !== undefined && !(Number.isInteger(cl[k]) && cl[k] >= 0 && cl[k] < n)) zle();
    if (cl.k !== undefined && !(Number.isInteger(cl.k) && cl.k >= 0 && cl.k < K)) zle();
    if (cl.g !== undefined && cl.g !== 0 && cl.g !== 1) zle();
    if (cl.f !== undefined && !(cl.f >= 0 && cl.f <= 2)) zle();
    if (cl.e !== undefined && !(cl.e >= 0 && cl.e <= 3)) zle();
    if (cl.p !== undefined && cl.q !== undefined && cl.p === cl.q) zle();
  }
  zad.clues = clues;
  // every clue true against the solution, through the same masks the
  // solvers use
  const S = struktura(zad);
  const I = pripravIndicie(S, clues);
  for (const X of I) if (!pravdivaRychlo(S, X, solution, zad)) zle();
  const l = String(z.l || '0,0,0').split(',').map(Number);
  zad.difficulty = { layers: { 1: l[0] || 0, 2: l[1] || 0, 3: l[2] || 0 }, clues: clues.length, steps: z.t || 0 };
  return zad;
}
function pravdivaRychlo(S, X, pos, zad) {
  const n = S.n;
  if (X.typ === 'u') {
    for (const p of X.kusy) { const a = pos[p]; if (!((X.m[(a / n) | 0] >> (a % n)) & 1)) return false; }
    return true;
  }
  if (X.typ === 'h') { const f = drzitel(zad, pos); return f >= 0 && zad.skupina[f] === X.g; }
  const a = pos[X.p], b = pos[X.q];
  return ((X.F[a * n + ((b / n) | 0)] >> (b % n)) & 1) === 1;
}

/* The cast of one puzzle, for the page and the book: every fox with its
   trait, then the thing. */
export function obsadenie(zad) {
  const vl = VLASTNOSTI[zad.vlastnost];
  return {
    lisky: zad.mena.map((meno, p) => ({ meno, vlastnost: vl[zad.skupina[p] ? 'b' : 'a'].je })),
    vec: zad.vec,
  };
}
