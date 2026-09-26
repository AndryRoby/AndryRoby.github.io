/* Foxes: generator and solvers for the daily placement puzzle.
 *
 * One file, no dependencies, runs the same in Node and in the browser
 * (game.js imports it as a module, tests.mjs too). Everything is
 * deterministic: a date turns into a number, the number into a sequence of
 * random values, the sequence into a puzzle. The same key gives the same
 * puzzle on every machine.
 *
 * Rules of the game (our own wording, ops/spec-foxes.md part 2): a family of
 * foxes shares one lair of n by n cells, split into chambers, with stones and
 * a few marks on the floor (moss, roots, leaves). There are n - 1 foxes and
 * one lost thing, and every row and every column holds exactly one of them.
 * Nobody stands on a stone. The numbered clues are all true and together leave
 * exactly one way to place everyone. The fox left alone in a chamber with the
 * lost thing has it.
 *
 * Representation (spec part 4):
 *   n          side of the board, 5, 6 or 7
 *   pieces     0 .. n-2 are the foxes, n-1 is the lost thing
 *   cells      r * n + c, rows from the top, columns from the left
 *   komory     chamber index of every cell, 0 .. K-1
 *   kamene     the stone cells, sorted
 *   znaky      -1 nothing, 0 moss, 1 roots, 2 leaves, for every cell
 *   solution   the cell of every piece
 *   clues      objects { t, p, q, k, f, e, g }, see TYPY below
 *
 * Solver state: for every piece one byte per row, bit c set when the piece
 * may still stand in column c of that row (n is at most 7), plus the cell of
 * every piece already placed. That is n * n bytes for the whole board, so a
 * copy for a trial is a copy of 49 bytes.
 *
 * Two solvers, and they are not the same thing:
 *   solveHuman  only rules a person can use, in layers 1, 2 and 3, never a
 *               guess. Every rule is a forced conclusion, so a finished run is
 *               itself the proof that no other placement exists. It also
 *               measures the difficulty: how many steps came from each layer.
 *   solve       a full search with MRV and forward checking that uses none of
 *               the human rules: only the clue masks, the taken rows and
 *               columns and the two piece clues against the piece just
 *               placed; every leaf is checked against every clue and the
 *               rule of the lost thing. It is an independent check that
 *               solveHuman is correct, not a second proof. Say it that way.
 */

/* Mulberry32: a small, fast pseudo-random generator with 32 bits of state.
   Returns numbers in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* FNV-1a, 32 bits: turns a string into a number for mulberry32. */
export function seedFromString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/* Checks the YYYY-MM-DD shape and that the date actually exists (2026-02-30 fails). */
export function isValidDate(s) {
  const m = DATE_RE.exec(String(s));
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dni = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= dni[mo - 1];
}

/* Today's date in Bratislava as YYYY-MM-DD. The Swedish locale gives the ISO
   shape directly; if Intl is missing or does not know the time zone, falls
   back to local time. */
export function todayBratislava(now = new Date()) {
  try {
    const s = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
    if (isValidDate(s)) return s;
  } catch (e) { /* fall back to local time */ }
  const p = (x) => String(x).padStart(2, '0');
  return now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate());
}

function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

/* ── Banky slov ──────────────────────────────────────────────────────── *
 * Písané nami, append only a zmrazené: kompaktný záznam odkazuje na sadu
 * identifikátorom (foxes-1), mená v zázname necestujú. Oprava jedného slova by
 * inak ticho zmenila každý zverejnený deň. BANKY_HASH je v teste a ten istý
 * obsah je v banka-slov.json vedľa tohto súboru (test žiada zhodu slovo po
 * slove). Kópia je tu, aby generator.mjs bežal v prehliadači bez fetch.
 *
 * Tri odchýlky od zoznamu v ops/spec-foxes.md časť 5, lebo ten istý spec
 * zakazuje slovo z bánk Dormice a tri jeho slová v nich sú: Poppy (Dormice
 * „poppy seeds"), Ivy („ivy berries") a pine cone („pine"). Namiesto nich
 * Piper, Isla a tin whistle, so zachovanými začiatočnými písmenami. Zapísané
 * v ops/games/foxes/README.md. */
export const BANKY = {
  sada: 'foxes-1',
  foxes: [
    'Ember', 'Rusty', 'Flint', 'Blaze', 'Piper', 'Amber', 'Juno', 'Nell', 'Hob',
    'Lark', 'Quill', 'Vesper', 'Umber', 'Isla', 'Otis', 'Mica', 'Wren', 'Dash',
    'Scout', 'Gus', 'Kip', 'Yara',
  ],
  chambers: [
    'larder', 'nursery', 'tunnel', 'hall', 'cellar', 'gallery', 'playroom',
    'kitchen', 'snug', 'bedroom', 'front room', 'workroom', 'dry room', 'mud room',
  ],
  traits: [['cub', 'grown-up'], ['sleepy', 'wide awake'], ['hungry', 'well fed']],
  things: [
    'ball of wool', 'red apple', 'woolly glove', 'tennis ball', 'tin whistle',
    'little bell', 'blue marble', 'striped sock',
  ],
};

/* FNV-1a nad zmrazeným obsahom sady. Test porovná s BANKY_HASH. */
export function hashBanky(b = BANKY) {
  return seedFromString([
    b.sada, b.foxes.join(','), b.chambers.join(','),
    b.traits.map((x) => x.join('/')).join(','), b.things.join(','),
  ].join('|')).toString(16).padStart(8, '0');
}
export const BANKY_HASH = '10cf9d41';

/* How each trait reads in a sentence. The bank holds the words; the forms are
   grammar, and the test checks that `slovo` matches the bank word for word. */
export const VLASTNOSTI = [
  { a: { slovo: 'cub', kto: 'cub', ktori: 'cubs', je: 'a cub' },
    b: { slovo: 'grown-up', kto: 'grown-up', ktori: 'grown-ups', je: 'a grown-up' } },
  { a: { slovo: 'sleepy', kto: 'sleepy fox', ktori: 'sleepy foxes', je: 'sleepy' },
    b: { slovo: 'wide awake', kto: 'wide awake fox', ktori: 'wide awake foxes', je: 'wide awake' } },
  { a: { slovo: 'hungry', kto: 'hungry fox', ktori: 'hungry foxes', je: 'hungry' },
    b: { slovo: 'well fed', kto: 'well fed fox', ktori: 'well fed foxes', je: 'well fed' } },
];
export function vlastnost(zad, g) { return VLASTNOSTI[zad.vlastnost][g ? 'b' : 'a']; }

export const ZNAKY = ['moss', 'roots', 'leaves'];
export const MAX_SLOV = 14;
export const MAX_RETAZ = 6;
/* At most this many trials in one published lair. Without a cap the Sunday
   pick (the hardest of six candidates) went to lairs with thirty and more
   trials, which is a chore and not a puzzle; the prototype measured 2.4 on
   average and 6 at most (ops/spec-foxes.md part 8), so 6 is the ceiling. */
export const MAX_SKUSOK = 6;
/* A trial is taken only on a piece with this many cells left: "here or
   there", as the page and the guide promise ("one of its two cells"). The
   first build tried pieces with up to sixteen cells, which reads like a guess
   and not like a step (critic 25. 9., finding 5). */
export const MIEST_SKUSKY = 2;

/* ── Profiles ────────────────────────────────────────────────────────── *
 * The generator takes only { n, maxVrstva, maxAttempts } from outside
 * (spec part 3): ops/puzzle-books/postav.mjs passes a white list of keys, so
 * everything else is worked out here from n and the highest layer.
 * `strop` is only an upper bound on the number of clues, never a target. */
export const PROFILY = {
  easy: {
    n: 5, komory: 4, kamene: 3, znaky: 5, maxVrstva: 1, strop: 9, maxTyp: 99, maxIN: 99,
    vahy: { IN: 3, NOTIN: 3, ON: 3, EDGE: 2, EMPTY: 1, GNOT: 1, BESIDE: 1 },
  },
  medium: {
    n: 6, komory: 5, kamene: 4, znaky: 6, maxVrstva: 2, strop: 11, maxTyp: 3, maxIN: 99,
    vahy: { IN: 2, NOTIN: 3, ON: 3, EDGE: 1, EMPTY: 1, GNOT: 1, BESIDE: 1, SAME: 2, DIFF: 2, LEFT: 2, ABOVE: 2, HOLDER: 1 },
  },
  hard: {
    n: 7, komory: 6, kamene: 5, znaky: 7, maxVrstva: 2, strop: 13, maxTyp: 3, maxIN: 1,
    vahy: { IN: 1, NOTIN: 3, ON: 2, EDGE: 1, EMPTY: 1, GNOT: 2, BESIDE: 1, SAME: 2, DIFF: 2, LEFT: 3, ABOVE: 3, NEXTCOL: 2, CORNER: 2, HOLDER: 1 },
  },
  /* The only level that may ask for a trial, and it must: a candidate that
     finishes without layer 3 is thrown away (vyzadujeL3, as in Dormice). */
  challenge: {
    n: 7, komory: 6, kamene: 5, znaky: 7, maxVrstva: 3, strop: 15, maxTyp: 3, maxIN: 0,
    vyzadujeL3: true, maxAttempts: 1500,
    vahy: { NOTIN: 3, ON: 2, EDGE: 1, EMPTY: 1, GNOT: 2, BESIDE: 1, SAME: 2, DIFF: 3, LEFT: 3, ABOVE: 3, NEXTCOL: 2, CORNER: 3, HOLDER: 1 },
  },
};
export function PROFIL(n, maxVrstva) {
  if (n <= 5) return { ...PROFILY.easy, maxVrstva: maxVrstva ?? 1 };
  if (n === 6) return { ...PROFILY.medium, maxVrstva: maxVrstva ?? 2 };
  if ((maxVrstva ?? 2) >= 3) return { ...PROFILY.challenge };
  return { ...PROFILY.hard, maxVrstva: maxVrstva ?? 2 };
}

/* ── Clue types ──────────────────────────────────────────────────────── */
export const UNARNE = ['IN', 'NOTIN', 'ON', 'EDGE', 'BESIDE', 'EMPTY', 'GNOT'];
export const PAROVE = ['SAME', 'DIFF', 'LEFT', 'ABOVE', 'NEXTCOL', 'CORNER'];
export const TYPY = [...UNARNE, ...PAROVE, 'HOLDER'];
/* One letter per type for the packed record (plan.mjs). */
export const PISMENA = {
  IN: 'I', NOTIN: 'N', ON: 'O', EDGE: 'E', BESIDE: 'B', EMPTY: 'M', GNOT: 'G',
  SAME: 'S', DIFF: 'D', LEFT: 'L', ABOVE: 'A', NEXTCOL: 'X', CORNER: 'C', HOLDER: 'H',
};
const JE_UNARNA = new Set(UNARNE);
const JE_PAROVA = new Set(PAROVE);
export function klucIndicie(cl) {
  return [cl.t, cl.p ?? '', cl.q ?? '', cl.k ?? '', cl.f ?? '', cl.e ?? '', cl.g ?? ''].join('|');
}

/* ── Small helpers ───────────────────────────────────────────────────── */
const POP = new Uint8Array(256);
for (let i = 1; i < 256; i++) POP[i] = POP[i >> 1] + (i & 1);
function najnizsi(m) { return 31 - Math.clz32(m & -m); }
function rozsah(m) { return Array.from({ length: m }, (_, i) => i); }
function zamiesaj(rng, a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
const nahodny = (rng, pole) => pole[Math.floor(rng() * pole.length)];
function velke(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ── The board as bit masks ──────────────────────────────────────────── */
/* Everything the rules need about a board, worked out once per puzzle. */
export function struktura(zad) {
  const n = zad.n, C = n * n, P = n, V = n - 1, full = (1 << n) - 1, K = zad.K;
  const kom = new Uint8Array(K * n);
  const komBunky = Array.from({ length: K }, () => []);
  for (let c = 0; c < C; c++) {
    const r = (c / n) | 0, s = c - r * n;
    kom[zad.komory[c] * n + r] |= 1 << s;
    komBunky[zad.komory[c]].push(c);
  }
  const kamen = new Uint8Array(C);
  for (const c of zad.kamene) kamen[c] = 1;
  const volne = new Uint8Array(n);
  for (let r = 0; r < n; r++) for (let s = 0; s < n; s++) if (!kamen[r * n + s]) volne[r] |= 1 << s;
  const znakM = new Uint8Array(3 * n);
  for (let c = 0; c < C; c++) if (zad.znaky[c] >= 0) znakM[zad.znaky[c] * n + ((c / n) | 0)] |= 1 << (c % n);
  const hranaM = new Uint8Array(4 * n);
  hranaM[0 * n + 0] = full;
  hranaM[1 * n + n - 1] = full;
  for (let r = 0; r < n; r++) { hranaM[2 * n + r] = 1; hranaM[3 * n + r] = 1 << (n - 1); }
  const priM = new Uint8Array(n);
  for (let c = 0; c < C; c++) {
    if (kamen[c]) continue;
    const r = (c / n) | 0, s = c - r * n;
    if ((r > 0 && kamen[c - n]) || (r < n - 1 && kamen[c + n]) || (s > 0 && kamen[c - 1]) || (s < n - 1 && kamen[c + 1])) priM[r] |= 1 << s;
  }
  return { n, C, P, V, full, K, kom, komBunky, kamen, volne, znakM, hranaM, priM, komory: zad.komory, skupina: zad.skupina };
}

/* The columns of row rr where the partner of a pair clue may stand, when the
   other piece stands on cell a. `obratene` reads the clue from its second
   piece. The row and the column of a are always out: two pieces never share
   a row or a column. */
function relMaska(S, t, a, rr, obratene) {
  const n = S.n, r = (a / n) | 0, c = a - r * n, full = S.full;
  if (rr === r) return 0;
  let m = 0;
  switch (t) {
    case 'SAME': m = S.kom[S.komory[a] * n + rr]; break;
    case 'DIFF': m = full & ~S.kom[S.komory[a] * n + rr]; break;
    case 'LEFT': m = obratene ? ((1 << c) - 1) : (full & ~((2 << c) - 1)); break;
    case 'ABOVE': m = obratene ? (rr < r ? full : 0) : (rr > r ? full : 0); break;
    case 'NEXTCOL': m = obratene ? (c > 0 ? 1 << (c - 1) : 0) : (c + 1 < n ? 1 << (c + 1) : 0); break;
    case 'CORNER': m = Math.abs(rr - r) === 1 ? ((c > 0 ? 1 << (c - 1) : 0) | (c + 1 < n ? 1 << (c + 1) : 0)) : 0; break;
    default: m = 0;
  }
  return m & ~(1 << c) & full;
}
function vztah(S, t, a, b) {
  const n = S.n;
  return ((relMaska(S, t, a, (b / n) | 0, false) >> (b % n)) & 1) === 1;
}

/* A clue made ready for the rules: masks for a one piece clue, both tables
   for a two piece clue. */
export function pripravIndiciu(S, cl) {
  const n = S.n, full = S.full;
  if (JE_UNARNA.has(cl.t)) {
    const m = new Uint8Array(n);
    for (let r = 0; r < n; r++) {
      switch (cl.t) {
        case 'IN': m[r] = S.kom[cl.k * n + r]; break;
        case 'NOTIN': case 'EMPTY': case 'GNOT': m[r] = full & ~S.kom[cl.k * n + r]; break;
        case 'ON': m[r] = S.znakM[cl.f * n + r]; break;
        case 'EDGE': m[r] = S.hranaM[cl.e * n + r]; break;
        case 'BESIDE': m[r] = S.priM[r]; break;
      }
    }
    let kusy;
    if (cl.t === 'EMPTY') kusy = rozsah(S.P);
    else if (cl.t === 'GNOT') kusy = rozsah(S.P - 1).filter((p) => S.skupina[p] === cl.g);
    else kusy = [cl.p];
    return { cl, typ: 'u', kusy, m };
  }
  if (JE_PAROVA.has(cl.t)) {
    const C = S.C;
    const F = new Uint8Array(C * n), B = new Uint8Array(C * n);
    for (let a = 0; a < C; a++) {
      for (let rr = 0; rr < n; rr++) {
        F[a * n + rr] = relMaska(S, cl.t, a, rr, false);
        B[a * n + rr] = relMaska(S, cl.t, a, rr, true);
      }
    }
    return { cl, typ: 'p', p: cl.p, q: cl.q, F, B };
  }
  if (cl.t === 'HOLDER') return { cl, typ: 'h', g: cl.g };
  throw new Error('Unknown clue type ' + cl.t);
}
export function pripravIndicie(S, clues, cache) {
  return clues.map((cl) => {
    if (!cache) return pripravIndiciu(S, cl);
    let x = cache.get(cl);
    if (!x) { x = pripravIndiciu(S, cl); cache.set(cl, x); }
    return x;
  });
}

/* ── Truth of a placement ────────────────────────────────────────────── */
/* The fox alone in the chamber of the lost thing, or -1 when that chamber
   holds no fox or more than one. */
export function drzitel(zad, pos) {
  const V = zad.n - 1, k = zad.komory[pos[V]];
  let f = -1;
  for (let p = 0; p < V; p++) {
    if (zad.komory[pos[p]] !== k) continue;
    if (f >= 0) return -1;
    f = p;
  }
  return f;
}
function pravdivaS(S, X, pos) {
  const n = S.n;
  if (X.typ === 'u') {
    for (const p of X.kusy) { const a = pos[p]; if (!((X.m[(a / n) | 0] >> (a % n)) & 1)) return false; }
    return true;
  }
  if (X.typ === 'p') return vztah(S, X.cl.t, pos[X.p], pos[X.q]);
  if (X.typ === 'h') {
    const f = drzitel(S, pos);
    return f >= 0 && S.skupina[f] === X.g;
  }
  return false;
}
export function pravdiva(zad, cl, pos) {
  const S = struktura(zad);
  return pravdivaS(S, pripravIndiciu(S, cl), pos);
}
/* Every rule of the game and every clue. */
function platne(S, I, pos) {
  const n = S.n;
  let rr = 0, ss = 0;
  for (let p = 0; p < S.P; p++) {
    const a = pos[p];
    if (a < 0 || S.kamen[a]) return false;
    rr |= 1 << ((a / n) | 0); ss |= 1 << (a % n);
  }
  if (rr !== S.full || ss !== S.full) return false;
  if (drzitel(S, pos) < 0) return false;
  for (const X of I) if (!pravdivaS(S, X, pos)) return false;
  return true;
}
/* What a full placement breaks, for the last sentence of a trial: the rule
   of the lost thing (no fox or two in its chamber) or the first false clue. */
function porusenie(S, I, pos) {
  if (drzitel(S, pos) < 0) {
    const k = S.komory[pos[S.V]];
    let pocet = 0;
    for (let p = 0; p < S.V; p++) if (S.komory[pos[p]] === k) pocet++;
    return { typ: 'samota', k, pocet };
  }
  for (let i = 0; i < I.length; i++) if (!pravdivaS(S, I[i], pos)) return { typ: 'indicia', i };
  return { typ: 'indicie' };
}
export function platneRozlozenie(zad, pos) {
  const S = struktura(zad);
  return platne(S, pripravIndicie(S, zad.clues), pos);
}

/* ── Solver state ────────────────────────────────────────────────────── */
export function novyStav(S) {
  const c = new Uint8Array(S.P * S.n);
  for (let p = 0; p < S.P; p++) for (let r = 0; r < S.n; r++) c[p * S.n + r] = S.volne[r];
  return { c, pl: new Int8Array(S.P).fill(-1), used: new Uint8Array(64) };
}
export function kopiaStavu(st) { return { c: st.c.slice(), pl: st.pl.slice(), used: st.used.slice() }; }
function pocet(S, c, p) { let x = 0; for (let r = 0; r < S.n; r++) x += POP[c[p * S.n + r]]; return x; }
function prvaBunka(S, c, p) { for (let r = 0; r < S.n; r++) if (c[p * S.n + r]) return r * S.n + najnizsi(c[p * S.n + r]); return -1; }
export function bunkyKusa(S, st, p) {
  const out = [];
  for (let r = 0; r < S.n; r++) { let m = st.c[p * S.n + r]; while (m) { out.push(r * S.n + najnizsi(m)); m &= m - 1; } }
  return out;
}
function vsetkyPolozene(S, st) { for (let p = 0; p < S.P; p++) if (st.pl[p] < 0) return false; return true; }

/* Put piece p on cell a: its row and its column are nobody else's. */
export function poloz(S, st, p, a) {
  const n = S.n, r = (a / n) | 0, s = a - r * n, c = st.c, nb = ~(1 << s);
  st.pl[p] = a;
  for (let rr = 0; rr < n; rr++) c[p * n + rr] = 0;
  c[p * n + r] = 1 << s;
  for (let q = 0; q < S.P; q++) {
    if (q === p) continue;
    c[q * n + r] = 0;
    for (let rr = 0; rr < n; rr++) c[q * n + rr] &= nb;
  }
}

/* A contradiction: a piece with no cell, or a row or a column nobody can
   fill. Returns null or { typ, p | r | s }. */
function spor(S, st) {
  const n = S.n, c = st.c;
  let stlpce = 0;
  for (let p = 0; p < S.P; p++) {
    let x = 0;
    for (let r = 0; r < n; r++) x |= c[p * n + r];
    if (!x) return { typ: 'kus', p };
    stlpce |= x;
  }
  for (let r = 0; r < n; r++) {
    let x = 0;
    for (let p = 0; p < S.P; p++) x |= c[p * n + r];
    if (!x) return { typ: 'riadok', r };
  }
  if (stlpce !== S.full) {
    for (let s = 0; s < n; s++) if (!((stlpce >> s) & 1)) return { typ: 'stlpec', s };
  }
  return null;
}

/* Read masks for the dependency cone of a trial: which missing cells a step
   relied on. Only filled while a trial is followed (R not null). */
function citajKus(S, c, R, p) { if (R) for (let r = 0; r < S.n; r++) R[p * S.n + r] |= ~c[p * S.n + r] & S.full; }
function citajRiadok(S, c, R, r) { if (R) for (let p = 0; p < S.P; p++) R[p * S.n + r] |= ~c[p * S.n + r] & S.full; }
function citajStlpec(S, c, R, s) { if (R) for (let p = 0; p < S.P; p++) for (let r = 0; r < S.n; r++) R[p * S.n + r] |= ~c[p * S.n + r] & (1 << s); }
function citajVKomore(S, c, R, p, k) { if (R) for (let r = 0; r < S.n; r++) R[p * S.n + r] |= ~c[p * S.n + r] & S.kom[k * S.n + r]; }

/* ── Layer 1: one clue or one line ───────────────────────────────────── */
function vrstva1(S, I, st, R) {
  const n = S.n, P = S.P, c = st.c, full = S.full;
  // only-place: a piece with a single cell left goes there
  for (let p = 0; p < P; p++) {
    if (st.pl[p] >= 0 || pocet(S, c, p) !== 1) continue;
    const a = prvaBunka(S, c, p);
    citajKus(S, c, R, p);
    poloz(S, st, p, a);
    return { rule: 'only-place', layer: 1, clue: -1, piece: p, cell: a };
  }
  // a clue about one piece, or about everyone in a chamber
  for (let i = 0; i < I.length; i++) {
    const X = I[i];
    if (X.typ !== 'u' || st.used[i]) continue;
    st.used[i] = 1;
    const zmenene = [];
    for (const p of X.kusy) {
      let x = false;
      for (let r = 0; r < n; r++) {
        const v = c[p * n + r], nv = v & X.m[r];
        if (nv !== v) { c[p * n + r] = nv; x = true; }
      }
      if (x) zmenene.push(p);
    }
    if (zmenene.length) return { rule: 'clue', layer: 1, clue: i, piece: X.kusy.length === 1 ? X.kusy[0] : -1, pieces: zmenene };
  }
  // row-one-cell: a row with one open cell settles the column of that cell
  const otvorene = new Uint8Array(n);
  for (let r = 0; r < n; r++) { let x = 0; for (let p = 0; p < P; p++) x |= c[p * n + r]; otvorene[r] = x; }
  for (let r = 0; r < n; r++) {
    if (POP[otvorene[r]] !== 1) continue;
    const s = najnizsi(otvorene[r]), b = 1 << s;
    let treba = false;
    for (let p = 0; p < P && !treba; p++) for (let rr = 0; rr < n; rr++) if (rr !== r && (c[p * n + rr] & b)) { treba = true; break; }
    if (!treba) continue;
    citajRiadok(S, c, R, r);
    for (let p = 0; p < P; p++) for (let rr = 0; rr < n; rr++) if (rr !== r) c[p * n + rr] &= ~b;
    return { rule: 'row-one-cell', layer: 1, clue: -1, row: r, col: s, cell: r * n + s };
  }
  for (let s = 0; s < n; s++) {
    const b = 1 << s;
    let kde = -1, kolko = 0;
    for (let r = 0; r < n; r++) if (otvorene[r] & b) { kolko++; kde = r; }
    if (kolko !== 1) continue;
    let treba = false;
    for (let p = 0; p < P; p++) if (c[p * n + kde] & ~b) { treba = true; break; }
    if (!treba) continue;
    citajStlpec(S, c, R, s);
    for (let p = 0; p < P; p++) c[p * n + kde] &= b;
    return { rule: 'column-one-cell', layer: 1, clue: -1, row: kde, col: s, cell: kde * n + s };
  }
  // row-one-piece: a row only one piece can still reach belongs to it
  for (let r = 0; r < n; r++) {
    let kto = -1, kolko = 0;
    for (let p = 0; p < P; p++) if (c[p * n + r]) { kolko++; kto = p; }
    if (kolko !== 1 || st.pl[kto] >= 0) continue;
    let mimo = false;
    for (let rr = 0; rr < n; rr++) if (rr !== r && c[kto * n + rr]) { mimo = true; break; }
    if (!mimo) continue;
    if (R) for (let q = 0; q < P; q++) if (q !== kto) R[q * n + r] |= ~c[q * n + r] & full;
    for (let rr = 0; rr < n; rr++) if (rr !== r) c[kto * n + rr] = 0;
    return { rule: 'row-one-piece', layer: 1, clue: -1, row: r, piece: kto };
  }
  for (let s = 0; s < n; s++) {
    const b = 1 << s;
    let kto = -1, kolko = 0;
    for (let p = 0; p < P; p++) {
      let ma = false;
      for (let r = 0; r < n; r++) if (c[p * n + r] & b) { ma = true; break; }
      if (ma) { kolko++; kto = p; }
    }
    if (kolko !== 1 || st.pl[kto] >= 0) continue;
    let mimo = false;
    for (let r = 0; r < n; r++) if (c[kto * n + r] & ~b) { mimo = true; break; }
    if (!mimo) continue;
    if (R) for (let q = 0; q < P; q++) if (q !== kto) for (let r = 0; r < n; r++) R[q * n + r] |= ~c[q * n + r] & b;
    for (let r = 0; r < n; r++) c[kto * n + r] &= b;
    return { rule: 'column-one-piece', layer: 1, clue: -1, col: s, piece: kto };
  }
  return null;
}

/* ── Layer 2: two things at once ─────────────────────────────────────── */
/* Takes out the cells of p for which q has no cell the clue allows. */
function revise(S, c, p, q, T) {
  const n = S.n;
  let x = false;
  for (let r = 0; r < n; r++) {
    let m = c[p * n + r];
    if (!m) continue;
    let nove = m;
    while (m) {
      const s = najnizsi(m);
      m &= m - 1;
      const a = (r * n + s) * n;
      let ok = false;
      for (let rr = 0; rr < n; rr++) if (c[q * n + rr] & T[a + rr]) { ok = true; break; }
      if (!ok) nove &= ~(1 << s);
    }
    if (nove !== c[p * n + r]) { c[p * n + r] = nove; x = true; }
  }
  return x;
}
function holderIndex(I) { for (let i = 0; i < I.length; i++) if (I[i].typ === 'h') return i; return -1; }

function vrstva2(S, I, st, R) {
  const n = S.n, P = S.P, V = S.V, c = st.c, full = S.full;
  // pair: a clue about two pieces, each against where the other can still be
  for (let i = 0; i < I.length; i++) {
    const X = I[i];
    if (X.typ !== 'p') continue;
    const a = revise(S, c, X.p, X.q, X.F);
    const b = revise(S, c, X.q, X.p, X.B);
    if (a || b) {
      citajKus(S, c, R, X.p); citajKus(S, c, R, X.q);
      const pieces = [];
      if (a) pieces.push(X.p);
      if (b) pieces.push(X.q);
      return { rule: 'pair', layer: 2, clue: i, piece: -1, pieces, pair: [X.p, X.q] };
    }
  }
  // locked-row, locked-column: a piece stuck in one line keeps it for itself
  for (let p = 0; p < P; p++) {
    if (st.pl[p] >= 0) continue;
    let riadky = 0, stlpce = 0;
    for (let r = 0; r < n; r++) if (c[p * n + r]) { riadky |= 1 << r; stlpce |= c[p * n + r]; }
    if (POP[riadky] === 1) {
      const r = najnizsi(riadky);
      let x = false;
      for (let q = 0; q < P; q++) if (q !== p && c[q * n + r]) { c[q * n + r] = 0; x = true; }
      if (x) { citajKus(S, c, R, p); return { rule: 'locked-row', layer: 2, clue: -1, piece: p, row: r }; }
    }
    if (POP[stlpce] === 1) {
      const s = najnizsi(stlpce), b = 1 << s;
      let x = false;
      for (let q = 0; q < P; q++) if (q !== p) for (let r = 0; r < n; r++) if (c[q * n + r] & b) { c[q * n + r] &= ~b; x = true; }
      if (x) { citajKus(S, c, R, p); return { rule: 'locked-column', layer: 2, clue: -1, piece: p, col: s }; }
    }
  }
  // alone-rule and holder-trait: the chamber of the lost thing holds exactly
  // one fox, and a clue may say which kind of fox that is
  const h = holderIndex(I);
  const g = h >= 0 ? I[h].g : -1;
  let komoryVeci = 0;
  for (let k = 0; k < S.K; k++) {
    for (let r = 0; r < n; r++) if (c[V * n + r] & S.kom[k * n + r]) { komoryVeci |= 1 << k; break; }
  }
  const mozeV = (p, k) => { for (let r = 0; r < n; r++) if (c[p * n + r] & S.kom[k * n + r]) return true; return false; };
  for (let k = 0; k < S.K; k++) {
    if (!((komoryVeci >> k) & 1)) continue;
    const moze = [], su = [];
    for (let p = 0; p < V; p++) {
      if (mozeV(p, k)) moze.push(p);
      if (st.pl[p] >= 0 && S.komory[st.pl[p]] === k) su.push(p);
    }
    const mozeZ = h >= 0 ? moze.filter((p) => S.skupina[p] === g) : moze;
    let variant = null, kto = -1;
    if (su.length >= 2) variant = 'dve';
    else if (h >= 0 && su.some((p) => S.skupina[p] !== g)) { variant = 'zly'; kto = su.find((p) => S.skupina[p] !== g); }
    else if (!mozeZ.length) variant = 'nikto';
    if (!variant) continue;
    let x = false;
    for (let r = 0; r < n; r++) {
      const v = c[V * n + r], nv = v & ~S.kom[k * n + r];
      if (nv !== v) { c[V * n + r] = nv; x = true; }
    }
    if (x) {
      if (R) { citajKus(S, c, R, V); for (let p = 0; p < V; p++) { citajVKomore(S, c, R, p, k); if (st.pl[p] >= 0 && S.komory[st.pl[p]] === k) citajKus(S, c, R, p); } }
      return { rule: 'alone-rule', layer: 2, clue: variant === 'dve' ? -1 : h, variant, chamber: k, piece: kto, pieces: su };
    }
  }
  if (POP[komoryVeci] === 1) {
    const k = najnizsi(komoryVeci);
    const su = [], moze = [];
    for (let p = 0; p < V; p++) {
      if (st.pl[p] >= 0 && S.komory[st.pl[p]] === k) su.push(p);
      if (mozeV(p, k)) moze.push(p);
    }
    const von = (p) => {
      let x = false;
      for (let r = 0; r < n; r++) { const v = c[p * n + r], nv = v & ~S.kom[k * n + r]; if (nv !== v) { c[p * n + r] = nv; x = true; } }
      return x;
    };
    if (h >= 0) {
      const zmenene = [];
      for (let p = 0; p < V; p++) if (S.skupina[p] !== g && von(p)) zmenene.push(p);
      if (zmenene.length) {
        citajKus(S, c, R, V);
        return { rule: 'holder-trait', layer: 2, clue: h, chamber: k, pieces: zmenene };
      }
    }
    if (su.length === 1) {
      const zmenene = [];
      for (let p = 0; p < V; p++) if (p !== su[0] && von(p)) zmenene.push(p);
      if (zmenene.length) {
        if (R) { citajKus(S, c, R, V); citajKus(S, c, R, su[0]); }
        return { rule: 'alone-rule', layer: 2, clue: -1, variant: 'jeden', chamber: k, piece: su[0], pieces: zmenene };
      }
    }
    if (moze.length === 1 && st.pl[moze[0]] < 0) {
      const p = moze[0];
      let x = false;
      for (let r = 0; r < n; r++) { const v = c[p * n + r], nv = v & S.kom[k * n + r]; if (nv !== v) { c[p * n + r] = nv; x = true; } }
      if (x) {
        if (R) { citajKus(S, c, R, V); for (let q = 0; q < V; q++) if (q !== p) citajVKomore(S, c, R, q, k); }
        return { rule: 'alone-rule', layer: 2, clue: -1, variant: 'jediny', chamber: k, piece: p, pieces: [p] };
      }
    }
  }
  // pair-of-rows, pair-of-columns: two pieces sharing the same two lines
  for (let smer = 0; smer < 2; smer++) {
    const lin = new Int16Array(P).fill(-1);
    for (let p = 0; p < P; p++) {
      if (st.pl[p] >= 0) continue;
      let m = 0;
      if (smer === 0) { for (let r = 0; r < n; r++) if (c[p * n + r]) m |= 1 << r; }
      else for (let r = 0; r < n; r++) m |= c[p * n + r];
      lin[p] = m;
    }
    for (let p = 0; p < P; p++) {
      if (lin[p] < 0) continue;
      for (let q = p + 1; q < P; q++) {
        if (lin[q] < 0) continue;
        const u = lin[p] | lin[q];
        if (POP[u] !== 2) continue;
        let x = false;
        for (let o = 0; o < P; o++) {
          if (o === p || o === q) continue;
          if (smer === 0) { for (let r = 0; r < n; r++) if (((u >> r) & 1) && c[o * n + r]) { c[o * n + r] = 0; x = true; } }
          else for (let r = 0; r < n; r++) if (c[o * n + r] & u) { c[o * n + r] &= ~u; x = true; }
        }
        if (x) {
          citajKus(S, c, R, p); citajKus(S, c, R, q);
          const linie = [];
          for (let i = 0; i < n; i++) if ((u >> i) & 1) linie.push(i);
          return { rule: smer === 0 ? 'pair-of-rows' : 'pair-of-columns', layer: 2, clue: -1, pieces: [p, q], lines: linie };
        }
      }
    }
  }
  return null;
}

/* Layers 1 and 2 to their fixed point. False on a contradiction. */
function dobehni(S, I, st, maxV) {
  for (let g = 0; g < 2000; g++) {
    if (spor(S, st)) return false;
    if (vsetkyPolozene(S, st)) break;
    if (vrstva1(S, I, st, null)) continue;
    if (maxV >= 2 && vrstva2(S, I, st, null)) continue;
    break;
  }
  return !spor(S, st);
}

/* ── Layer 3: a one step trial, exactly one assumption deep ──────────── *
 * Put a piece on one of its cells, follow layers 1 and 2, and when something
 * breaks, that cell is out. How long the chain is: every step records which
 * missing cells it relied on, every missing cell remembers the step that took
 * it out, and from the break we walk back and count only the steps the break
 * rests on (the cone, as in Owls). Steps the queue took elsewhere are not
 * counted, because nobody following the chain would take them. The count is
 * cautious: a step is charged with every cell its piece or line had lost. */
function kuzel(S, odKroku, kroky, Rspor) {
  const n = S.n, C = S.C;
  const treba = new Uint8Array(kroky.length);
  const zasobnik = [];
  const citaj = (R) => {
    for (let i = 0; i < R.length; i++) {
      let m = R[i];
      if (!m) continue;
      const p = (i / n) | 0, r = i - p * n;
      while (m) {
        const s = najnizsi(m);
        m &= m - 1;
        const j = odKroku[p * C + r * n + s];
        if (j >= 0 && !treba[j]) { treba[j] = 1; zasobnik.push(j); }
      }
    }
  };
  citaj(Rspor);
  while (zasobnik.length) citaj(kroky[zasobnik.pop()].R);
  const cela = [];
  for (let j = 0; j < kroky.length; j++) if (treba[j]) cela.push(kroky[j].k);
  return cela;
}
function skuska(S, I, st, p, a) {
  const n = S.n, C = S.C, P = S.P;
  const t = kopiaStavu(st);
  const odKroku = new Int16Array(P * C).fill(-1);
  const kroky = [];
  poloz(S, t, p, a);
  for (let g = 0; g < 400; g++) {
    const sp = spor(S, t);
    if (sp) {
      const R = new Uint8Array(P * n);
      if (sp.typ === 'kus') citajKus(S, t.c, R, sp.p);
      else if (sp.typ === 'riadok') citajRiadok(S, t.c, R, sp.r);
      else citajStlpec(S, t.c, R, sp.s);
      const cela = kuzel(S, odKroku, kroky, R);
      return { dlzka: cela.length, cela, spor: sp };
    }
    if (vsetkyPolozene(S, t)) {
      const pos = Array.from(t.pl);
      if (platne(S, I, pos)) return null;
      const R = new Uint8Array(P * n);
      for (let q = 0; q < P; q++) citajKus(S, t.c, R, q);
      const cela = kuzel(S, odKroku, kroky, R);
      return { dlzka: cela.length, cela, spor: porusenie(S, I, pos) };
    }
    const pred = t.c.slice();
    const R = new Uint8Array(P * n);
    const k = vrstva1(S, I, t, R) || vrstva2(S, I, t, R);
    if (!k) return null;
    // Where everyone could be right after this step, so the hint can say
    // what the step leaves ("Piper could then only be in row 6, column 4").
    k.po = { c: t.c.slice(), pl: t.pl.slice() };
    const j = kroky.length;
    kroky.push({ k, R });
    for (let i = 0; i < P * n; i++) {
      let rem = pred[i] & ~t.c[i];
      if (!rem) continue;
      const q = (i / n) | 0, r = i - q * n;
      while (rem) { const s = najnizsi(rem); rem &= rem - 1; odKroku[q * C + r * n + s] = j; }
    }
  }
  return null;
}
/* The trial a person would pick: only a piece with two cells left ("here or
   there", MIEST_SKUSKY), and of the trials that work, the one with the
   shortest chain, the first in reading order on a tie. A trial longer than
   maxRetaz does not count: that would be a guess in disguise. */
function vrstva3(S, I, st, maxRetaz) {
  const P = S.P;
  const kusy = [];
  for (let p = 0; p < P; p++) if (st.pl[p] < 0) kusy.push({ p, m: pocet(S, st.c, p) });
  kusy.sort((x, y) => x.m - y.m || x.p - y.p);
  let i = 0;
  while (i < kusy.length) {
    const hladina = kusy[i].m;
    if (hladina > MIEST_SKUSKY) break;
    let j = i;
    while (j < kusy.length && kusy[j].m === hladina) j++;
    let naj = null;
    for (let u = i; u < j; u++) {
      const p = kusy[u].p;
      for (const a of bunkyKusa(S, st, p)) {
        const r = skuska(S, I, st, p, a);
        if (!r || r.dlzka > maxRetaz) continue;
        if (!naj || r.dlzka < naj.dlzka || (r.dlzka === naj.dlzka && a < naj.a)) naj = { p, a, ...r };
      }
    }
    if (naj) {
      const n = S.n;
      st.c[naj.p * n + ((naj.a / n) | 0)] &= ~(1 << (naj.a % n));
      return { rule: 'trial', layer: 3, clue: -1, piece: naj.p, cell: naj.a, retaz: naj.dlzka, chain: naj.cela, spor: naj.spor, pocet: hladina };
    }
    i = j;
  }
  return null;
}

/* One step of the human solver, the simplest one available. */
export function krok(S, I, st, maxV = 3, maxRetaz = MAX_RETAZ) {
  return vrstva1(S, I, st, null)
    || (maxV >= 2 ? vrstva2(S, I, st, null) : null)
    || (maxV >= 3 ? vrstva3(S, I, st, maxRetaz) : null);
}

/* solveHuman(zad, { initial, limitKrokov, maxVrstva, maxRetaz, texty })
 *   Only human rules, never a guess. Layers are tried in order and the solver
 *   stops at the first step it can take, so a hint is always the simplest
 *   step available right now. initial: a solver state, for example the
 *   player's board (logika.mjs premisy). texty: add text and textBezHodnoty
 *   to every step (the hints and the tests; the generator does without).
 * Returns { solved, contradiction, layers, steps, pos, pouziteIndicie, stav }. */
export function solveHuman(zad, opts = {}) {
  const S = opts.S || struktura(zad);
  const I = opts.I || pripravIndicie(S, zad.clues);
  const maxV = opts.maxVrstva ?? 3;
  const maxRetaz = opts.maxRetaz ?? MAX_RETAZ;
  const maxSkusok = opts.maxSkusok ?? Infinity;
  const st = opts.initial ? kopiaStavu(opts.initial) : novyStav(S);
  const steps = [];
  const layers = { 1: 0, 2: 0, 3: 0 };
  const pouzite = new Set();
  let contradiction = false;
  for (let g = 0; g < 4000; g++) {
    if (spor(S, st)) { contradiction = true; break; }
    if (vsetkyPolozene(S, st)) break;
    const pred = opts.texty ? st.c.slice() : null;
    const k = krok(S, I, st, maxV, maxRetaz);
    if (!k) break;
    layers[k.layer]++;
    if (layers[3] > maxSkusok) break;
    if (k.clue >= 0) pouzite.add(k.clue);
    if (opts.texty) {
      k.cells = zmeneneBunky(S, pred, st);
      Object.assign(k, textKroku(zad, S, st, k));
    }
    steps.push(k);
    if (opts.limitKrokov && steps.length >= opts.limitKrokov) break;
  }
  const pos = Array.from(st.pl);
  const solved = !contradiction && vsetkyPolozene(S, st) && platne(S, I, pos);
  return { solved, contradiction, layers, steps, pos: solved ? pos : null, pouziteIndicie: pouzite, stav: st };
}
function zmeneneBunky(S, pred, st) {
  const n = S.n, out = new Set();
  for (let p = 0; p < S.P; p++) {
    for (let r = 0; r < n; r++) {
      let m = pred[p * n + r] & ~st.c[p * n + r];
      while (m) { out.add(r * n + najnizsi(m)); m &= m - 1; }
    }
    if (st.pl[p] >= 0) out.add(st.pl[p]);
  }
  return [...out].sort((a, b) => a - b);
}

/* Solvable by the human rules up to layer mv? For the minimisation: layers 1
   and 2 are one fixed point, which does not depend on the order of the steps. */
function riesitelne(S, I, mv) {
  if (mv <= 2) {
    const st = novyStav(S);
    if (!dobehni(S, I, st, mv)) return false;
    return vsetkyPolozene(S, st) && platne(S, I, Array.from(st.pl));
  }
  return solveHuman(null, { S, I, maxVrstva: 3, maxSkusok: MAX_SKUSOK }).solved;
}

/* ── solve: an independent full search ───────────────────────────────── *
 * MRV with forward checking over the same bit masks, and none of the human
 * rules: the clue masks, the rows and columns already taken and the two piece
 * clues against the piece just placed. Every leaf is checked in full. */
export function solve(zad, opts = {}) {
  const limit = opts.limit ?? 2, maxNodes = opts.maxNodes ?? 20000;
  const S = opts.S || struktura(zad);
  const I = opts.I || pripravIndicie(S, zad.clues);
  const n = S.n, P = S.P;
  const dom = novyStav(S).c;
  for (const X of I) if (X.typ === 'u') for (const p of X.kusy) for (let r = 0; r < n; r++) dom[p * n + r] &= X.m[r];
  const pary = I.filter((X) => X.typ === 'p');
  const pos = new Array(P).fill(-1);
  const riesenia = [];
  let uzly = 0, vycerpane = false;
  function rek(d) {
    if (riesenia.length >= limit || vycerpane) return;
    if (++uzly > maxNodes) { vycerpane = true; return; }
    let p = -1, best = 99;
    for (let q = 0; q < P; q++) {
      if (pos[q] >= 0) continue;
      const x = pocet(S, d, q);
      if (x < best) { best = x; p = q; }
    }
    if (p < 0) { if (platne(S, I, pos)) riesenia.push(pos.slice()); return; }
    if (!best) return;
    for (let r = 0; r < n; r++) {
      let m = d[p * n + r];
      while (m) {
        const s = najnizsi(m);
        m &= m - 1;
        const a = r * n + s, nb = ~(1 << s);
        const d2 = d.slice();
        let ok = true;
        for (let q = 0; q < P && ok; q++) {
          if (q === p || pos[q] >= 0) continue;
          d2[q * n + r] = 0;
          for (let rr = 0; rr < n; rr++) d2[q * n + rr] &= nb;
          for (const X of pary) {
            if (X.p === p && X.q === q) for (let rr = 0; rr < n; rr++) d2[q * n + rr] &= X.F[a * n + rr];
            else if (X.q === p && X.p === q) for (let rr = 0; rr < n; rr++) d2[q * n + rr] &= X.B[a * n + rr];
          }
          if (!pocet(S, d2, q)) ok = false;
        }
        if (!ok) continue;
        pos[p] = a;
        rek(d2);
        pos[p] = -1;
        if (riesenia.length >= limit || vycerpane) return;
      }
    }
  }
  rek(dom);
  return { count: riesenia.length, solution: riesenia[0] || null, riesenia, uzly, vycerpane };
}

/* The naive search of the prototype: fixed domains, no forward checking, the
   pieces in the order of their domain size. Only tests.mjs uses it, as a
   check that solve and the human solver agree with something simpler still. */
export function solveNaivne(zad, opts = {}) {
  const limit = opts.limit ?? 2, maxNodes = opts.maxNodes ?? 2000000;
  const S = struktura(zad);
  const I = pripravIndicie(S, zad.clues);
  const n = S.n, P = S.P;
  const dom = novyStav(S).c;
  for (const X of I) if (X.typ === 'u') for (const p of X.kusy) for (let r = 0; r < n; r++) dom[p * n + r] &= X.m[r];
  const poradie = rozsah(P).sort((a, b) => pocet(S, dom, a) - pocet(S, dom, b));
  const pary = I.filter((X) => X.typ === 'p');
  const pos = new Array(P).fill(-1);
  const rUsed = new Uint8Array(n), sUsed = new Uint8Array(n);
  const riesenia = [];
  let uzly = 0, vycerpane = false;
  function rek(i) {
    if (riesenia.length >= limit || vycerpane) return;
    if (++uzly > maxNodes) { vycerpane = true; return; }
    if (i === P) { if (platne(S, I, pos)) riesenia.push(pos.slice()); return; }
    const p = poradie[i];
    for (let r = 0; r < n; r++) {
      if (rUsed[r]) continue;
      let m = dom[p * n + r];
      while (m) {
        const s = najnizsi(m);
        m &= m - 1;
        if (sUsed[s]) continue;
        const a = r * n + s;
        pos[p] = a;
        let ok = true;
        for (const X of pary) {
          if ((X.p === p || X.q === p) && pos[X.p] >= 0 && pos[X.q] >= 0 && !vztah(S, X.cl.t, pos[X.p], pos[X.q])) { ok = false; break; }
        }
        if (ok) { rUsed[r] = 1; sUsed[s] = 1; rek(i + 1); rUsed[r] = 0; sUsed[s] = 0; }
        pos[p] = -1;
        if (riesenia.length >= limit || vycerpane) return;
      }
    }
  }
  rek(0);
  return { count: riesenia.length, solution: riesenia[0] || null, uzly, vycerpane };
}

/* ── Texts ───────────────────────────────────────────────────────────── */
const CISLA = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
export function slovom(x) { return x >= 0 && x < CISLA.length ? CISLA[x] : String(x); }
export function menoKusu(zad, p) { return p === zad.n - 1 ? 'the ' + zad.vec : zad.mena[p]; }
export function menoKomory(zad, k) { return 'the ' + zad.menaKomor[k]; }
export function bunkaText(n, a) { return 'row ' + (((a / n) | 0) + 1) + ', column ' + ((a % n) + 1); }
export function zoznam(casti, spojka = 'and') {
  if (casti.length <= 1) return casti.join('');
  return casti.slice(0, -1).join(', ') + ' ' + spojka + ' ' + casti[casti.length - 1];
}
const ZNAK_LISKA = ['lying on moss', 'under the roots', 'in the leaves'];
const ZNAK_VEC = ['on moss', 'under the roots', 'in the leaves'];
const HRANA = ['in the top row', 'in the bottom row', 'in the leftmost column', 'in the rightmost column'];

/* Every clue sentence comes from this one template over the constraint
   behind it; nothing is written by hand anywhere else. At most MAX_SLOV words,
   so it fits two lines at 390 px; a longer instance is refused, not cut. */
export function textIndicie(zad, cl) {
  const A = cl.p !== undefined ? menoKusu(zad, cl.p) : '';
  const B = cl.q !== undefined ? menoKusu(zad, cl.q) : '';
  const K = cl.k !== undefined ? menoKomory(zad, cl.k) : '';
  const jeVec = cl.p === zad.n - 1;
  switch (cl.t) {
    case 'IN': return velke(A + ' is in ' + K + '.');
    case 'NOTIN': return velke(A + ' is not in ' + K + '.');
    case 'ON': return velke(A + ' is ' + (jeVec ? ZNAK_VEC : ZNAK_LISKA)[cl.f] + '.');
    case 'EDGE': return velke(A + ' is ' + HRANA[cl.e] + '.');
    case 'BESIDE': return velke(A + ' is right next to a stone.');
    case 'EMPTY': return velke(K + ' is empty.');
    case 'GNOT': return 'No ' + vlastnost(zad, cl.g).kto + ' is in ' + K + '.';
    case 'HOLDER': return 'Whoever has the ' + zad.vec + ' is ' + vlastnost(zad, cl.g).je + '.';
    case 'SAME': return velke(A + ' and ' + B + ' are in the same chamber.');
    case 'DIFF': return velke(A + ' and ' + B + ' are in different chambers.');
    case 'LEFT': return velke(A + ' is somewhere left of ' + B + '.');
    case 'ABOVE': return velke(A + ' is somewhere above ' + B + '.');
    case 'NEXTCOL': return velke(B + ' is one column to the right of ' + A + '.');
    case 'CORNER': return velke(A + ' and ' + B + ' touch corner to corner.');
    default: return '';
  }
}
export function pocetSlov(t) { return String(t).trim().split(/\s+/).length; }

/* The answer, one sentence, for the result panel and the book. */
export function vetaRozuzlenia(zad) {
  const f = drzitel(zad, zad.solution);
  return zad.mena[f] + ' has the ' + zad.vec + ', in ' + menoKomory(zad, zad.komory[zad.solution[zad.n - 1]]) + '.';
}

/* Where a piece can still be, in the plainest words that fit. */
export function linieText(slovo, cisla) {
  const c = cisla.map((x) => x + 1);
  if (c.length === 1) return slovo + ' ' + c[0];
  let suvisle = true;
  for (let i = 1; i < c.length; i++) if (c[i] !== c[i - 1] + 1) suvisle = false;
  if (suvisle && c.length >= 3) return slovo + 's ' + c[0] + ' to ' + c[c.length - 1];
  return slovo + 's ' + zoznam(c.map(String));
}
export function kdeMoze(zad, S, st, p, ako) {
  const n = S.n;
  const bunky = bunkyKusa(S, st, p);
  if (st.pl[p] >= 0 || bunky.length === 1) return bunkaText(n, bunky[0]);
  const riadky = [...new Set(bunky.map((a) => (a / n) | 0))].sort((a, b) => a - b);
  const stlpce = [...new Set(bunky.map((a) => a % n))].sort((a, b) => a - b);
  const komory = [...new Set(bunky.map((a) => S.komory[a]))].sort((a, b) => a - b);
  // The dimension the clue speaks about comes first, so two hints in a row
  // over the same clue do not read the same when the second one narrowed it.
  // A whole row (or column) is named alone, without listing its cells.
  const celyRiadok = riadky.length === 1 && POP[S.volne[riadky[0]]] === bunky.length;
  let volnychVStlpci = 0;
  if (stlpce.length === 1) for (let r = 0; r < n; r++) if ((S.volne[r] >> stlpce[0]) & 1) volnychVStlpci++;
  const celyStlpec = stlpce.length === 1 && volnychVStlpci === bunky.length;
  if (celyRiadok) return 'row ' + (riadky[0] + 1);
  if (celyStlpec) return 'column ' + (stlpce[0] + 1);
  if (ako === 'stlpce') return (riadky.length === 1 ? 'row ' + (riadky[0] + 1) + ', ' : '') + linieText('column', stlpce);
  if (ako === 'riadky') return (stlpce.length === 1 ? 'column ' + (stlpce[0] + 1) + ', ' : '') + linieText('row', riadky);
  // Cells in one row or one column read as that line and a span, never as a
  // list of cells ("row 6, columns 4 to 6", critic 25. 9., finding 9).
  if (riadky.length === 1) return linieText('row', riadky) + ', ' + linieText('column', stlpce);
  if (stlpce.length === 1) return linieText('column', stlpce) + ', ' + linieText('row', riadky);
  if (bunky.length <= 3) {
    // grouped by row, so a list never reads "row 4, column 3, row 4, column 4"
    const skupiny = riadky.map((r) => 'row ' + (r + 1) + ', ' + linieText('column', bunky.filter((a) => ((a / n) | 0) === r).map((a) => a % n)));
    return skupiny.length === 2 ? skupiny[0] + ', or ' + skupiny[1] : skupiny.slice(0, -1).join('; ') + '; or ' + skupiny[skupiny.length - 1];
  }
  if (ako === 'komory') return zoznam(komory.map((k) => menoKomory(zad, k)), 'or');
  if (komory.length === 1) return menoKomory(zad, komory[0]) + ', ' + slovom(bunky.length) + ' cells';
  if (riadky.length <= 3) return slovom(bunky.length) + ' cells in ' + linieText('row', riadky);
  if (stlpce.length <= 3) return slovom(bunky.length) + ' cells in ' + linieText('column', stlpce);
  return slovom(bunky.length) + ' cells';
}
/* A clue sentence inside another sentence: no full stop, and a lower case
   article after "Clue 3:". Names keep their capital. */
function bezBodky(s) { s = s.replace(/\.$/, ''); return s.startsWith('The ') ? 't' + s.slice(1) : s; }

/* Two sentences for every step (spec part 8): textBezHodnoty for the first
   press of Hint, the technique and the place without naming the fox the step
   is about or the cell; text for the second press. st is the state right
   after the step. */
export function textKroku(zad, S, st, k) {
  const n = S.n, M = (p) => menoKusu(zad, p), MV = (p) => velke(menoKusu(zad, p));
  const cis = k.clue >= 0 ? k.clue + 1 : 0;
  const cl = k.clue >= 0 ? zad.clues[k.clue] : null;
  const vec = 'the ' + zad.vec;
  switch (k.rule) {
    case 'only-place':
      return {
        textBezHodnoty: 'One of them has just one cell left. Look at row ' + (((k.cell / n) | 0) + 1) + '.',
        text: MV(k.piece) + ' can only be in ' + bunkaText(n, k.cell) + ' now, so ' + M(k.piece) + ' goes there.',
      };
    case 'clue': {
      if (cl.t === 'EMPTY') {
        return {
          textBezHodnoty: 'Clue ' + cis + ' says something about a whole chamber.',
          text: 'Clue ' + cis + ' says ' + menoKomory(zad, cl.k) + ' is empty, so every cell of ' + menoKomory(zad, cl.k) + ' gets a cross.',
        };
      }
      if (cl.t === 'GNOT') {
        const skupina = [];
        for (let p = 0; p < S.V; p++) if (S.skupina[p] === cl.g) skupina.push(zad.mena[p]);
        return {
          textBezHodnoty: 'Clue ' + cis + ' narrows down where some of them can be.',
          text: 'Clue ' + cis + ': no ' + vlastnost(zad, cl.g).kto + ' is in ' + menoKomory(zad, cl.k) + ', so ' + zoznam(skupina) + ' stay' + (skupina.length === 1 ? 's' : '') + ' out of it.',
        };
      }
      const bez = 'Clue ' + cis + ' narrows down where one of them can be.';
      const p = cl.p, m = pocet(S, st.c, p);
      if (cl.t === 'IN') return { textBezHodnoty: bez, text: 'Clue ' + cis + ' puts ' + M(p) + ' in ' + menoKomory(zad, cl.k) + ', so ' + M(p) + ' can only be in its ' + slovom(m) + ' free cell' + (m === 1 ? '' : 's') + '.' };
      if (cl.t === 'NOTIN') return { textBezHodnoty: bez, text: 'Clue ' + cis + ' keeps ' + M(p) + ' out of ' + menoKomory(zad, cl.k) + '.' };
      return { textBezHodnoty: bez, text: 'Clue ' + cis + ': ' + bezBodky(textIndicie(zad, cl)) + ', so ' + M(p) + ' can only be in ' + kdeMoze(zad, S, st, p) + ' now.' };
    }
    case 'row-one-cell':
      return {
        textBezHodnoty: 'Row ' + (k.row + 1) + ' has only one cell left where anyone can be.',
        text: 'Row ' + (k.row + 1) + ' has one open cell, so someone is there, and nobody else can be in column ' + (k.col + 1) + '.',
      };
    case 'column-one-cell':
      return {
        textBezHodnoty: 'Column ' + (k.col + 1) + ' has only one cell left where anyone can be.',
        text: 'Column ' + (k.col + 1) + ' has one open cell, so someone is there, and nobody else can be in row ' + (k.row + 1) + '.',
      };
    case 'row-one-piece':
      return {
        textBezHodnoty: 'Row ' + (k.row + 1) + ': only one of them can still go there.',
        text: 'Everyone else is ruled out of row ' + (k.row + 1) + ', so ' + M(k.piece) + ' must be in row ' + (k.row + 1) + '.',
      };
    case 'column-one-piece':
      return {
        textBezHodnoty: 'Column ' + (k.col + 1) + ': only one of them can still go there.',
        text: 'Everyone else is ruled out of column ' + (k.col + 1) + ', so ' + M(k.piece) + ' must be in column ' + (k.col + 1) + '.',
      };
    case 'pair': {
      const ako = cl.t === 'ABOVE' ? 'riadky' : cl.t === 'LEFT' || cl.t === 'NEXTCOL' ? 'stlpce' : cl.t === 'SAME' || cl.t === 'DIFF' ? 'komory' : '';
      const casti = k.pieces.map((p, i) => (i === 0 ? M(p) + ' can only be in ' : M(p) + ' in ') + kdeMoze(zad, S, st, p, ako));
      return {
        textBezHodnoty: 'Clue ' + cis + ' links two of them. Compare where each can still be.',
        // The places carry their own "and" ("columns 2 and 3"), so the two
        // pieces are joined with a comma before theirs.
        text: 'Clue ' + cis + ': ' + bezBodky(textIndicie(zad, cl)) + ', so ' + casti.join(', and ') + '.',
      };
    }
    case 'locked-row':
      return {
        textBezHodnoty: 'One of them is stuck in a single row.',
        text: MV(k.piece) + ' can only be in row ' + (k.row + 1) + ', so nobody else can be in row ' + (k.row + 1) + '.',
      };
    case 'locked-column':
      return {
        textBezHodnoty: 'One of them is stuck in a single column.',
        text: MV(k.piece) + ' can only be in column ' + (k.col + 1) + ', so nobody else can be in column ' + (k.col + 1) + '.',
      };
    case 'alone-rule': {
      const K = menoKomory(zad, k.chamber);
      const bez = 'Think about the chamber with ' + vec + '.';
      if (k.variant === 'dve') return { textBezHodnoty: bez, text: 'Two foxes are already in ' + K + ', so ' + vec + ' is not there.' };
      if (k.variant === 'zly') return { textBezHodnoty: bez, text: MV(k.piece) + ' is already in ' + K + ' and is not ' + vlastnost(zad, zad.clues[k.clue].g).je + ', so by clue ' + cis + ' ' + vec + ' is not there.' };
      if (k.variant === 'nikto') {
        if (k.clue >= 0) return { textBezHodnoty: bez, text: 'By clue ' + cis + ' whoever has ' + vec + ' is ' + vlastnost(zad, zad.clues[k.clue].g).je + ', and no such fox can reach ' + K + ', so ' + vec + ' is not there.' };
        return { textBezHodnoty: bez, text: 'No fox can reach ' + K + ' any more, so ' + vec + ' is not there.' };
      }
      if (k.variant === 'jeden') return { textBezHodnoty: bez, text: velke(vec) + ' is in ' + K + ' and ' + M(k.piece) + ' is already there, so nobody else can be in ' + K + '.' };
      return { textBezHodnoty: bez, text: 'Only ' + M(k.piece) + ' can still reach ' + K + ', so ' + M(k.piece) + ' is there.' };
    }
    case 'holder-trait': {
      const K = menoKomory(zad, k.chamber), g = zad.clues[k.clue].g;
      return {
        textBezHodnoty: 'Clue ' + cis + ' says who has ' + vec + ', without a name.',
        text: 'Clue ' + cis + ': whoever has ' + vec + ' is ' + vlastnost(zad, g).je + '. ' + velke(vec) + ' is in ' + K + ', so no ' + vlastnost(zad, 1 - g).kto + ' can be in ' + K + '.',
      };
    }
    case 'pair-of-rows':
    case 'pair-of-columns': {
      const slovo = k.rule === 'pair-of-rows' ? 'rows' : 'columns';
      return {
        textBezHodnoty: 'Two of them share the same two ' + slovo + '.',
        text: MV(k.pieces[0]) + ' and ' + M(k.pieces[1]) + ' can only be in ' + slovo + ' ' + (k.lines[0] + 1) + ' and ' + (k.lines[1] + 1) + ', so nobody else can be in those ' + slovo + '.',
      };
    }
    case 'trial': {
      const kolko = k.retaz ? 'within ' + slovom(k.retaz) + ' step' + (k.retaz === 1 ? '' : 's') : 'at once';
      const casti = ['Suppose ' + M(k.piece) + ' were in ' + bunkaText(n, k.cell) + '.'];
      k.chain.forEach((c, i) => casti.push('Step ' + (i + 1) + ': ' + vetaRetaze(zad, S, c, k.piece) + '.'));
      // When the last step already said "would leave Nell no cell at all",
      // the break is not said twice.
      const posledny = k.chain.length ? k.chain[k.chain.length - 1] : null;
      const uzPovedane = posledny && posledny.po && k.spor && k.spor.typ === 'kus' && !bunkyKusa(S, posledny.po, k.spor.p).length
        && (posledny.rule === 'pair' || posledny.rule === 'clue') && k.spor.p !== k.piece;
      if (!uzPovedane) casti.push((k.chain.length ? 'Then ' : 'Then at once ') + vetaSporu(zad, n, k.spor) + '.');
      const zvysok = bunkyKusa(S, st, k.piece);
      casti.push(zvysok.length === 1 ? 'So ' + M(k.piece) + ' is in the other cell, ' + bunkaText(n, zvysok[0]) + '.' : 'So ' + M(k.piece) + ' cannot be in ' + bunkaText(n, k.cell) + '.');
      return {
        textBezHodnoty: 'One of them has ' + slovom(k.pocet) + ' cells left. Try one and follow it; something breaks ' + kolko + '.',
        text: casti.join(' '),
      };
    }
    default:
      return { textBezHodnoty: 'One step follows from what is already there.', text: 'One step follows from what is already there.' };
  }
}
/* One link of a trial, as a would, with what it leaves: never "narrows things
   down", always where the piece could then be, so every step can be checked
   on the board. The piece being tried is never the subject of a link; it is
   the supposition (critic 25. 9., finding 5). k.po is the state right after
   the link (skuska). */
function vetaRetaze(zad, S, k, skusany) {
  const n = S.n, M = (p) => menoKusu(zad, p);
  const kde = (p, ako) => {
    if (!k.po) return 'fewer cells';
    return bunkyKusa(S, k.po, p).length ? 'only ' + kdeMoze(zad, S, k.po, p, ako) : 'no cell at all';
  };
  const cis = 'clue ' + (k.clue + 1);
  switch (k.rule) {
    case 'only-place': return M(k.piece) + ' would have to be in ' + bunkaText(n, k.cell);
    case 'row-one-cell': return 'row ' + (k.row + 1) + ' would have only one open cell, in column ' + (k.col + 1);
    case 'column-one-cell': return 'column ' + (k.col + 1) + ' would have only one open cell, in row ' + (k.row + 1);
    case 'row-one-piece': return 'only ' + M(k.piece) + ' could still go in row ' + (k.row + 1);
    case 'column-one-piece': return 'only ' + M(k.piece) + ' could still go in column ' + (k.col + 1);
    case 'clue': {
      const cl = zad.clues[k.clue];
      if (cl.t === 'EMPTY') return cis + ' would leave ' + menoKomory(zad, cl.k) + ' empty';
      const ine = (k.pieces || []).filter((p) => p !== skusany);
      if (!ine.length) return cis + ' would rule out that very cell';
      if (cl.t === 'GNOT') return cis + ' would keep ' + zoznam(ine.map(M)) + ' out of ' + menoKomory(zad, cl.k);
      return cis + ' would leave ' + ine.map((p) => M(p) + ' ' + kde(p)).join(', and ');
    }
    case 'pair': {
      const cl = zad.clues[k.clue];
      const ine = k.pieces.filter((p) => p !== skusany);
      if (!ine.length) return cis + ' would rule out that very cell';
      const ako = cl.t === 'ABOVE' ? 'riadky' : cl.t === 'LEFT' || cl.t === 'NEXTCOL' ? 'stlpce' : '';
      return cis + ' would leave ' + ine.map((p) => M(p) + ' ' + kde(p, ako)).join(', and ');
    }
    case 'locked-row': return M(k.piece) + ' would be stuck in row ' + (k.row + 1) + ', so nobody else could be there';
    case 'locked-column': return M(k.piece) + ' would be stuck in column ' + (k.col + 1) + ', so nobody else could be there';
    case 'alone-rule': {
      const K = menoKomory(zad, k.chamber);
      if (k.variant === 'jeden') return 'nobody else could be in ' + K;
      if (k.variant === 'jediny') return M(k.piece) + ' would have to be in ' + K;
      // the lost thing itself is being tried: say what goes wrong around it
      if (skusany === zad.n - 1) {
        if (k.variant === 'dve') return 'two foxes would share ' + K + ' with it';
        if (k.variant === 'zly') return M(k.piece) + ' would be with it in ' + K + ' and is not ' + vlastnost(zad, zad.clues[k.clue].g).je;
        return 'no fox that could have it would reach ' + K;
      }
      return 'the ' + zad.vec + ' could not be in ' + K;
    }
    case 'holder-trait': return 'no ' + vlastnost(zad, 1 - zad.clues[k.clue].g).kto + ' could be in ' + menoKomory(zad, k.chamber);
    case 'pair-of-rows': return M(k.pieces[0]) + ' and ' + M(k.pieces[1]) + ' would take rows ' + (k.lines[0] + 1) + ' and ' + (k.lines[1] + 1);
    case 'pair-of-columns': return M(k.pieces[0]) + ' and ' + M(k.pieces[1]) + ' would take columns ' + (k.lines[0] + 1) + ' and ' + (k.lines[1] + 1);
    default: return 'one more thing would follow';
  }
}
function vetaSporu(zad, n, sp) {
  if (!sp) return 'something would break';
  if (sp.typ === 'kus') return menoKusu(zad, sp.p) + ' would have no cell left';
  if (sp.typ === 'riadok') return 'row ' + (sp.r + 1) + ' would be left with nobody';
  if (sp.typ === 'stlpec') return 'column ' + (sp.s + 1) + ' would be left with nobody';
  if (sp.typ === 'samota') {
    const K = menoKomory(zad, sp.k), vec = 'the ' + zad.vec;
    return sp.pocet ? slovom(sp.pocet) + ' foxes would share ' + K + ' with ' + vec : vec + ' would be alone in ' + K + ', with no fox to have it';
  }
  if (sp.typ === 'indicia') return 'clue ' + (sp.i + 1) + ' would be false';
  return 'the clues would not all hold';
}

/* ── Building a board ────────────────────────────────────────────────── */
function rastKomor(rng, n, K) {
  const C = n * n;
  const reg = new Int8Array(C).fill(-1);
  const semena = zamiesaj(rng, rozsah(C)).slice(0, K);
  const velk = new Array(K).fill(0);
  semena.forEach((c, k) => { reg[c] = k; velk[k] = 1; });
  let ostava = C - K;
  const maxV = Math.ceil((2 * C) / K);
  let krokov = 0;
  while (ostava > 0 && krokov++ < 10000) {
    const k = Math.floor(rng() * K);
    if (velk[k] >= maxV) continue;
    const hranica = [];
    for (let c = 0; c < C; c++) {
      if (reg[c] !== k) continue;
      const r = (c / n) | 0, s = c % n;
      if (r > 0 && reg[c - n] < 0) hranica.push(c - n);
      if (r < n - 1 && reg[c + n] < 0) hranica.push(c + n);
      if (s > 0 && reg[c - 1] < 0) hranica.push(c - 1);
      if (s < n - 1 && reg[c + 1] < 0) hranica.push(c + 1);
    }
    if (!hranica.length) continue;
    const d = nahodny(rng, hranica);
    reg[d] = k; velk[k]++; ostava--;
  }
  if (ostava > 0 || velk.some((v) => v < 3)) return null;
  return Array.from(reg);
}
/* Names with first letters that differ from each other and from `zakazane`. */
/* The cast of one puzzle as bank indices: foxes first, then chambers whose
   letters no fox has. Exported for the test that draws 500 casts. */
export function vyberObsadenie(rng, pocetLisok, pocetKomor) {
  const m = vyberMena(rng, BANKY.foxes, pocetLisok, []);
  if (!m) return null;
  const km = vyberMena(rng, BANKY.chambers, pocetKomor, [...m.pismena]);
  if (!km) return null;
  return { lisky: m.out, komory: km.out };
}
function vyberMena(rng, zoznamMien, kolko, zakazane) {
  const poradie = zamiesaj(rng, rozsah(zoznamMien.length));
  const out = [], pismena = new Set(zakazane);
  for (const i of poradie) {
    const p = zoznamMien[i].charAt(0).toUpperCase();
    if (pismena.has(p)) continue;
    out.push(i); pismena.add(p);
    if (out.length === kolko) return { out, pismena };
  }
  return null;
}
function postavPlochu(rng, prof) {
  const n = prof.n, C = n * n;
  const komory = rastKomor(rng, n, prof.komory);
  if (!komory) return null;
  const sigma = zamiesaj(rng, rozsah(n));
  const pozicie = rozsah(n).map((r) => r * n + sigma[r]);
  const vKomore = new Array(prof.komory).fill(0);
  for (const c of pozicie) vKomore[komory[c]]++;
  const dvojice = rozsah(prof.komory).filter((k) => vKomore[k] === 2);
  if (!dvojice.length) return null;
  const kVec = nahodny(rng, dvojice);
  const bunkaVec = nahodny(rng, pozicie.filter((c) => komory[c] === kVec));
  const ostatne = zamiesaj(rng, pozicie.filter((c) => c !== bunkaVec));
  const solution = [...ostatne, bunkaVec];
  const vRieseni = new Set(pozicie);
  const kamen = new Uint8Array(C);
  let polozenych = 0;
  for (const c of zamiesaj(rng, rozsah(C).filter((c) => !vRieseni.has(c)))) {
    if (polozenych >= prof.kamene) break;
    const r = (c / n) | 0, s = c % n;
    let volR = 0, volS = 0;
    for (let i = 0; i < n; i++) { if (!kamen[r * n + i]) volR++; if (!kamen[i * n + s]) volS++; }
    if (volR <= 2 || volS <= 2) continue;
    kamen[c] = 1; polozenych++;
  }
  const znaky = new Array(C).fill(-1);
  for (const c of zamiesaj(rng, rozsah(C).filter((c) => !kamen[c])).slice(0, prof.znaky)) znaky[c] = Math.floor(rng() * ZNAKY.length);
  const obs = vyberObsadenie(rng, n - 1, prof.komory);
  if (!obs) return null;
  const m = { out: obs.lisky }, km = { out: obs.komory };
  const vl = Math.floor(rng() * VLASTNOSTI.length);
  let skupina;
  do { skupina = rozsah(n - 1).map(() => (rng() < 0.5 ? 0 : 1)); } while (skupina.every((g) => g === 0) || skupina.every((g) => g === 1));
  const vecIdx = Math.floor(rng() * BANKY.things.length);
  const kamene = [];
  for (let c = 0; c < C; c++) if (kamen[c]) kamene.push(c);
  return {
    n, K: prof.komory, komory, kamene, znaky, bank: BANKY.sada,
    lisky: m.out, komoryIdx: km.out, vlastnost: vl, skupina, vecIdx,
    mena: m.out.map((i) => BANKY.foxes[i]), menaKomor: km.out.map((i) => BANKY.chambers[i]),
    vec: BANKY.things[vecIdx], solution,
  };
}

/* ── Sampling true clues ─────────────────────────────────────────────── */
function naKraji(n, a, e) {
  const r = (a / n) | 0, s = a % n;
  return e === 0 ? r === 0 : e === 1 ? r === n - 1 : e === 2 ? s === 0 : s === n - 1;
}
function nahodnaIndicia(rng, zad, S, typ) {
  const n = zad.n, P = n, V = n - 1, pos = zad.solution;
  const kus = () => Math.floor(rng() * P);
  switch (typ) {
    case 'IN': { const p = kus(); return { t: 'IN', p, k: zad.komory[pos[p]] }; }
    case 'NOTIN': { const p = kus(); const k = Math.floor(rng() * zad.K); return k === zad.komory[pos[p]] ? null : { t: 'NOTIN', p, k }; }
    case 'ON': { const p = kus(); return zad.znaky[pos[p]] >= 0 ? { t: 'ON', p, f: zad.znaky[pos[p]] } : null; }
    case 'EDGE': {
      const p = kus();
      const e = [0, 1, 2, 3].filter((x) => naKraji(n, pos[p], x));
      return e.length ? { t: 'EDGE', p, e: nahodny(rng, e) } : null;
    }
    case 'BESIDE': { const p = kus(); const a = pos[p]; return (S.priM[(a / n) | 0] >> (a % n)) & 1 ? { t: 'BESIDE', p } : null; }
    case 'EMPTY': {
      const plne = new Set(pos.map((c) => zad.komory[c]));
      const k = rozsah(zad.K).filter((x) => !plne.has(x));
      return k.length ? { t: 'EMPTY', k: nahodny(rng, k) } : null;
    }
    case 'GNOT': {
      const g = rng() < 0.5 ? 0 : 1;
      const plne = new Set(rozsah(V).filter((p) => zad.skupina[p] === g).map((p) => zad.komory[pos[p]]));
      const k = rozsah(zad.K).filter((x) => !plne.has(x));
      return k.length ? { t: 'GNOT', g, k: nahodny(rng, k) } : null;
    }
    case 'HOLDER': { const f = drzitel(zad, pos); return { t: 'HOLDER', g: zad.skupina[f] }; }
    default: {
      if (!JE_PAROVA.has(typ)) return null;
      let p = kus(), q = kus();
      if (p === q) return null;
      // SAME with the lost thing would say the answer outright
      if (typ === 'SAME' && (p === V || q === V)) return null;
      const rp = (x) => (pos[x] / n) | 0, sp = (x) => pos[x] % n;
      if (typ === 'LEFT' && !(sp(p) < sp(q))) { const t = p; p = q; q = t; }
      if (typ === 'ABOVE' && !(rp(p) < rp(q))) { const t = p; p = q; q = t; }
      if (typ === 'NEXTCOL' && sp(q) === sp(p) - 1) { const t = p; p = q; q = t; }
      if ((typ === 'SAME' || typ === 'DIFF' || typ === 'CORNER') && p > q) { const t = p; p = q; q = t; }
      const cl = { t: typ, p, q };
      return vztah(S, typ, pos[p], pos[q]) ? cl : null;
    }
  }
}
function oslabenia(zad, S, cl) {
  const out = [];
  if (cl.t === 'IN') for (let k = 0; k < zad.K; k++) if (k !== cl.k) out.push({ t: 'NOTIN', p: cl.p, k });
  if (cl.t === 'NEXTCOL') out.push({ t: 'LEFT', p: cl.p, q: cl.q });
  return out.filter((o) => pravdivaS(S, pripravIndiciu(S, o), zad.solution));
}

/* ── Generation ──────────────────────────────────────────────────────── */
export function generate(dateStr, opts = {}) {
  if (!isValidDate(dateStr)) throw new Error('Date must be in YYYY-MM-DD form: ' + dateStr);
  const n = opts.n ?? 7;
  return generateSeeded(dateStr, dateStr + '/' + n + 'x' + n, opts);
}

/* generateSeeded(name, key, { n, maxVrstva, maxAttempts, maxNodes })
 * Returns the puzzle: { date, n, K, komory, kamene, znaky, bank, lisky,
 * komoryIdx, vlastnost, skupina, vecIdx, mena, menaKomor, vec, clues,
 * solution, seed, attempts, difficulty, ms }. */
export function generateSeeded(name, key, opts = {}) {
  const n = opts.n ?? 7;
  const prof = PROFIL(n, opts.maxVrstva);
  const maxV = prof.maxVrstva;
  const stavV = Math.min(maxV, 2);
  const maxAttempts = opts.maxAttempts ?? prof.maxAttempts ?? 200;
  const maxNodes = opts.maxNodes ?? 20000;
  const t0 = nowMs();
  const seed = seedFromString(key);
  const rng = mulberry32(seed);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const plocha = postavPlochu(rng, prof);
    if (!plocha) continue;
    const zad = { date: name, ...plocha, clues: [] };
    const S = struktura(zad);
    const cache = new Map();
    const prep = (clues) => pripravIndicie(S, clues, cache);
    const pocty = (clues, t) => clues.filter((x) => x.t === t).length;

    // 1. Add true clues until layers 1 and 2 finish the board.
    let clues = [];
    let I = [];
    const kluce = new Set();
    let zaklad = novyStav(S);
    dobehni(S, I, zaklad, stavV);
    let ok = false;
    for (let g = 0; g < 400; g++) {
      if (clues.length > 4 * n) break;
      const typy = [];
      for (const [t, v] of Object.entries(prof.vahy)) {
        if (t === 'IN' && pocty(clues, 'IN') >= prof.maxIN) continue;
        if (t === 'HOLDER' && pocty(clues, 'HOLDER') >= 1) continue;
        if (pocty(clues, t) >= prof.maxTyp) continue;
        for (let i = 0; i < v; i++) typy.push(t);
      }
      if (!typy.length) break;
      const cl = nahodnaIndicia(rng, zad, S, nahodny(rng, typy));
      if (!cl) continue;
      const kl = klucIndicie(cl);
      if (kluce.has(kl)) continue;
      if (pocetSlov(textIndicie(zad, cl)) > MAX_SLOV) continue;
      const X = pripravIndiciu(S, cl);
      cache.set(cl, X);
      const I2 = [...I, X];
      const t = kopiaStavu(zaklad);
      dobehni(S, I2, t, stavV);
      let zmena = false;
      for (let i = 0; i < t.c.length; i++) if (t.c[i] !== zaklad.c[i]) { zmena = true; break; }
      if (!zmena) continue;
      clues.push(cl); I = I2; kluce.add(kl); zaklad = t;
      if (vsetkyPolozene(S, t) && platne(S, I, Array.from(t.pl))) { ok = true; break; }
    }
    if (!ok && maxV >= 3) ok = riesitelne(S, prep(clues), 3);
    if (!ok) continue;

    // 2. Minimise: take a clue out and keep it out while the board still
    //    finishes. For layer 3 a cheap gate first: without exactly one
    //    solution there is no point running the trials.
    const jednoznacne = (cs) => { const r = solve(null, { S, I: prep(cs), limit: 2, maxNodes }); return !r.vycerpane && r.count === 1; };
    const minim = (mv) => {
      let zmena = true;
      while (zmena) {
        zmena = false;
        for (const i of zamiesaj(rng, rozsah(clues.length))) {
          if (i >= clues.length) continue;
          const bez = clues.filter((_, j) => j !== i);
          if (!bez.length) continue;
          if (mv >= 3 && !jednoznacne(bez)) continue;
          if (riesitelne(S, prep(bez), mv)) { clues = bez; zmena = true; break; }
        }
      }
    };
    minim(stavV);
    // 3. Weaken: IN into NOTIN, NEXTCOL into LEFT, while it still finishes and
    //    the caps on one type hold. Then minimise again.
    for (let i = 0; i < clues.length; i++) {
      for (const o of oslabenia(zad, S, clues[i])) {
        if (kluce.has(klucIndicie(o))) continue;
        if (pocty(clues, o.t) >= prof.maxTyp) continue;
        const sk = clues.slice();
        sk[i] = o;
        if (riesitelne(S, prep(sk), stavV)) { clues = sk; kluce.add(klucIndicie(o)); break; }
      }
    }
    minim(stavV);
    if (maxV >= 3) minim(3);

    if (clues.length > prof.strop) continue;
    // Caps, checked again after the weakening.
    let preStrop = false;
    for (const t of TYPY) if (pocty(clues, t) > (n >= 6 ? prof.maxTyp : 99)) preStrop = true;
    if (pocty(clues, 'IN') > prof.maxIN || pocty(clues, 'HOLDER') > 1) preStrop = true;
    if (preStrop) continue;

    // 4. Order: shuffled by the seed, but the first two are clues a person can
    //    use on an empty board, layer 1 clues first.
    clues = zamiesaj(rng, clues.slice());
    const hned = (cl) => {
      const X = prep([cl])[0];
      const st = novyStav(S);
      if (X.typ === 'u') { for (const p of X.kusy) for (let r = 0; r < n; r++) if ((st.c[p * n + r] & X.m[r]) !== st.c[p * n + r]) return true; return false; }
      if (X.typ === 'p') return revise(S, st.c, X.p, X.q, X.F) || revise(S, st.c, X.q, X.p, X.B);
      return false;
    };
    for (let poz = 0; poz < Math.min(2, clues.length); poz++) {
      if (JE_UNARNA.has(clues[poz].t) && hned(clues[poz])) continue;
      let kam = -1;
      for (let j = poz + 1; j < clues.length; j++) if (JE_UNARNA.has(clues[j].t) && hned(clues[j])) { kam = j; break; }
      if (kam < 0 && !hned(clues[poz])) for (let j = poz + 1; j < clues.length; j++) if (hned(clues[j])) { kam = j; break; }
      if (kam >= 0) { const t = clues[poz]; clues[poz] = clues[kam]; clues[kam] = t; }
    }
    // The trial a person takes depends on the order of the clues (the chain
    // is followed in clue order), so on the challenge one more pass over the
    // final order: every clue left is needed exactly as it is published.
    if (maxV >= 3) minim(3);
    if (clues.filter(hned).length < 2) continue;
    zad.clues = clues;

    // 5. The final run: the human solver finishes within the allowed layer,
    //    every clue is cited, and the independent search agrees.
    I = prep(clues);
    const fin = solveHuman(zad, { S, I, maxVrstva: maxV, maxSkusok: MAX_SKUSOK });
    if (!fin.solved) continue;
    if (fin.pos.join() !== zad.solution.join()) throw new Error('solveHuman finished on another placement for ' + name);
    if (prof.vyzadujeL3 && !fin.layers[3]) continue;
    if (fin.pouziteIndicie.size !== clues.length) continue;
    const r = solve(zad, { S, I, limit: 2, maxNodes });
    if (r.vycerpane || r.count !== 1) continue;
    if (r.solution.join() !== zad.solution.join()) throw new Error('solve found a different placement than the source for ' + name);

    zad.seed = seed;
    zad.attempts = attempt;
    zad.difficulty = { layers: fin.layers, steps: fin.steps.length, clues: clues.length };
    zad.ms = Math.round((nowMs() - t0) * 10) / 10;
    return zad;
  }
  throw new Error('No unique, guess-free lair for ' + name + ' in ' + maxAttempts + ' attempts');
}
