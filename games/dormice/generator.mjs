/* Dormice: generator and solver for the daily logic grid puzzle.
 *
 * One file, no dependencies, runs the same in Node and in the browser
 * (game.js imports it as a module, tests.mjs too). Everything is
 * deterministic: a date turns into a number, the number into a sequence of
 * random values, the sequence into a puzzle. The same key gives the same
 * puzzle on every machine, so the server never has to compute or store
 * anything.
 *
 * Rules of the game (our own wording): a copse holds N dormice. Every
 * dormouse keeps one store in one tree and, in the bigger puzzles, wakes in
 * one week of the spring. There are as many stores, trees and weeks as there
 * are dormice and no two dormice share any of them. The numbered clues beside
 * the grid are all true and together leave exactly one way to match
 * everything up. One store went missing from the shared larder overnight and
 * the last line asks who had it, where and when.
 *
 * Representation (ops/spec-hra-detektiv.md, parts 3 and 4):
 *   k          how many categories, 3 (who, what, where) or 4 (plus when)
 *   N          how many items in each category
 *   ordered    index of the ordered category (when), or -1 when there is none
 *   solution   `assign`, k arrays of N item indices: assign[a][x] is the item
 *              of category a that belongs to dormouse x. assign[0] is the
 *              identity, the other k-1 are permutations of 0..N-1
 *   clues      objects { t, it, ... }, see INDICIE below
 *   poss       Uint32Array of k*k*N masks: poss[a][b][x] is which items of
 *              category b are still possible for item x of category a, and it
 *              is mirrored, so bit y in poss[a][b][x] equals bit x in
 *              poss[b][a][y]. A cross is a bit switched off, a tick is a mask
 *              with a single bit left.
 *
 * Two solvers, and they are not the same thing:
 *   solveHuman  only rules a person can use, in layers 1, 2a, 2b and 3, never
 *               a guess. Every rule is an exclusion or a forced fill, so a
 *               finished run is itself the proof that no other filling
 *               exists. It also measures the difficulty: how many steps came
 *               from each layer.
 *   solve       a full search with MRV and copy on branch, counting solutions
 *               up to `limit` and checking every clue against the finished
 *               assignment at each leaf. This is not a second independent
 *               proof of uniqueness (uniqueness already follows from a
 *               correct solveHuman run); it is an independent check that
 *               solveHuman is correct. Say it that way everywhere.
 *
 * `propaguj` (the machine propagator used by solve and by the layer 3 trials)
 * runs the table rules, the composition rule and the clue constraints to a
 * fixed point. In that fixed point it is path consistency plus the clue
 * constraints: strong and provably incomplete. That is exactly why the
 * uniqueness check is a real search and not a fixed point.
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
 * Štyri banky, písané nami, obyčajné anglické prírodné slová. Disjunktnosť
 * naprieč bankami je tvrdé pravidlo (test 8): žiadne slovo sa neopakuje,
 * žiadne meno plcha nie je drevina a žiadna zásoba nie je odvodená od stromu,
 * ktorý je v banke. Preto tu nie sú acorns pri oak ani hazelnuts, hazel
 * a beech v banke `where` vôbec nie sú, blackberries nie sú pri bramble patch
 * a meno Bramble v banke `who` tiež nie je.
 *
 * Banky sú append only a zmrazené: kompaktný záznam odkazuje na sadu
 * identifikátorom, takže mená v zázname necestujú. Keby sa banka dala
 * prepísať, jedna oprava slova by ticho zmenila každý zverejnený deň a každé
 * vytlačené PDF rok dozadu. BANKY_HASH je v teste.
 *
 * Ten istý obsah je aj v banka-slov.json vedľa tohto súboru; tests.mjs žiada,
 * aby sa oba zoznamy zhodovali slovo po slove. Tu je kópia preto, aby
 * generator.mjs bežal v prehliadači bez fetch a bez import assertions. */
export const BANKY = {
  sada: 'dormice-1',
  who: [
    'Pip', 'Tansy', 'Sorrel', 'Pepper', 'Clover', 'Fennel', 'Thistle',
    'Mallow', 'Comfrey', 'Teasel', 'Yarrow', 'Nutmeg', 'Rue', 'Dill',
    'Eyebright', 'Ginger', 'Lovage', 'Orris', 'Vetch', 'Angelica', 'Hyssop',
  ],
  what: [
    'sloes', 'rosehips', 'haws', 'crab apples', 'bilberries', 'chestnuts',
    'walnuts', 'mushrooms', 'poppy seeds', 'dandelion roots', 'fern curls',
    'wild plums', 'rowanberries', 'nettle tops', 'grass seeds', 'oats',
    'elderberries', 'lichen', 'ivy berries', 'juniper berries',
  ],
  where: [
    'oak', 'birch', 'holly', 'alder', 'elm', 'ash', 'pine', 'maple',
    'willow stump', 'log pile', 'hedge bank', 'stone wall', 'hollow trunk',
    'bramble patch', 'fir', 'cedar', 'yew', 'gorse clump', 'dead branch',
    'reed bed',
  ],
  /* N po sebe idúcich týždňov jari, vytlačených ako dátumy presne týždeň od
     seba, takže rozdiel indexov je rozdiel týždňov. */
  when: ['2 March', '9 March', '16 March', '23 March', '30 March'],
};

/* FNV-1a nad zmrazeným obsahom sady. Test porovná s BANKY_HASH. */
export function hashBanky(b = BANKY) {
  return seedFromString([b.sada, b.who.join(','), b.what.join(','), b.where.join(','), b.when.join(',')].join('|'))
    .toString(16).padStart(8, '0');
}
export const BANKY_HASH = 'd413f37a';

export const KATEGORIE = ['who', 'what', 'where', 'when'];
export const NAZVY_KATEGORII = { who: 'Dormice', what: 'Stores', where: 'Trees', when: 'Weeks' };

/* ── Bitové masky ────────────────────────────────────────────────────── */
function plnaMaska(N) { return (1 << N) - 1; }
function pocetBitov(m) { let c = 0; while (m) { m &= m - 1; c++; } return c; }
function jedenBit(m) { return m !== 0 && (m & (m - 1)) === 0; }
function indexBitu(m) { return 31 - Math.clz32(m); }
function bityZMasky(m) { const o = []; while (m) { const b = m & -m; o.push(31 - Math.clz32(b)); m ^= b; } return o; }

function rozsah(m) { return Array.from({ length: m }, (_, i) => i); }
function zamiesajPole(rng, a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function zamiesaj(rng, m) { return zamiesajPole(rng, rozsah(m)); }
function rovnake(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/* ── Stav poss[a][b][x] ──────────────────────────────────────────────── */
function ix(k, N, a, b, x) { return (a * k + b) * N + x; }

export function novyStav(k, N) {
  const P = new Uint32Array(k * k * N);
  const plna = plnaMaska(N);
  for (let a = 0; a < k; a++) {
    for (let b = 0; b < k; b++) {
      for (let x = 0; x < N; x++) P[(a * k + b) * N + x] = a === b ? (1 << x) : plna;
    }
  }
  return P;
}

/* poss[a][b][x] &= m, aj so zrkadlom. Vracia 1 pri zmene, 0 bez zmeny,
   -1 keď maska ostala prázdna (spor). */
function nastav(P, k, N, a, b, x, m) {
  const i = (a * k + b) * N + x;
  const stara = P[i];
  const nova = stara & m;
  if (nova === stara) return 0;
  P[i] = nova;
  let odobrate = stara & ~nova;
  while (odobrate) {
    const bit = odobrate & -odobrate;
    odobrate ^= bit;
    const y = 31 - Math.clz32(bit);
    P[(b * k + a) * N + y] &= ~(1 << x);
  }
  return nova === 0 ? -1 : 1;
}

/* Ten istý zápis masky aj so zrkadlom, pre logika.mjs a pre postav.mjs. */
export function nastavMasku(P, k, N, a, b, x, m) { return nastav(P, k, N, a, b, x, m); }

function prazdneOk(P, k, N) {
  for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) { if (a === b) continue; for (let x = 0; x < N; x++) if (P[(a * k + b) * N + x] === 0) return false; }
  return true;
}

export function vsetkyJednoznacne(P, k, N) {
  for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) { if (a === b) continue; for (let x = 0; x < N; x++) if (!jedenBit(P[(a * k + b) * N + x])) return false; }
  return true;
}

/* Priradenie z hotového stavu: assign[a][x] je položka kategórie a, ktorá
   patrí plchovi x. Vráti null, keď to nie je platné priradenie. */
export function riesenieZoStavu(P, k, N) {
  const assign = [];
  for (let a = 0; a < k; a++) {
    const rad = new Array(N);
    const videne = new Set();
    for (let x = 0; x < N; x++) {
      const m = P[(0 * k + a) * N + x];
      if (!jedenBit(m)) return null;
      const i = indexBitu(m);
      if (videne.has(i)) return null;
      videne.add(i);
      rad[x] = i;
    }
    assign.push(rad);
  }
  for (let x = 0; x < N; x++) if (assign[0][x] !== x) return null;
  return assign;
}

/* ── Indície ─────────────────────────────────────────────────────────── *
 * L  LINK      is(A,B)            entity(A) = entity(B)
 * X  EXCLUDE   isnt(A,B)          entity(A) != entity(B)
 * D  DIFFERENT different(A,B[,C]) všetky menované patria rôznym plchom
 * E  EITHER    either(A,c,S)      entity(A) má jednu z položiek S kategórie c
 * O  ORDER     order(A,B,g1,g2)   g1 <= pos(B) - pos(A) <= g2
 * A  APART     apart(A,B,g1,g2)   g1 <= |pos(B) - pos(A)| <= g2
 * N  ENDS      ends(A,kde)        0 prvý, 1 posledný, 2 ani jedno
 * B  BETWEEN   between(A,B,C)     min(pos A,pos C) < pos B < max(pos A,pos C)
 * `pos(v)` je index týždňa plcha, ktorý má položku v. Usporiadaná kategória
 * nesmie byť koncom indícií O, A, N, B: bola by to len prestrojená LINK nad
 * blokom týždňov a generický kód by čítal poss[o][o]. Vynútené v ponuke aj
 * v `legalna`. */
export const TYPY_INDICII = ['L', 'X', 'D', 'E', 'O', 'A', 'N', 'B'];

function klucIndicie(cl) {
  const it = cl.it.map((p) => p[0] + '.' + p[1]).join('|');
  return [cl.t, it, cl.c ?? '', cl.s ?? '', cl.g1 ?? '', cl.g2 ?? '', cl.kde ?? ''].join('#');
}

/* Inverzia priradenia: inv[a][i] je plch, ktorý má položku i kategórie a. */
function inverzie(assign, k, N) {
  const inv = [];
  for (let a = 0; a < k; a++) { const r = new Array(N); for (let x = 0; x < N; x++) r[assign[a][x]] = x; inv.push(r); }
  return inv;
}

/* Pravdivosť indície voči hotovému priradeniu, prepočítaná od nuly. */
export function pravdiva(cl, assign, k, N, ordered) {
  const inv = inverzie(assign, k, N);
  return pravdivaS(cl, assign, inv, ordered);
}
function pravdivaS(cl, assign, inv, ordered) {
  const ent = (p) => inv[p[0]][p[1]];
  const pos = (p) => assign[ordered][ent(p)];
  switch (cl.t) {
    case 'L': return ent(cl.it[0]) === ent(cl.it[1]);
    case 'X': return ent(cl.it[0]) !== ent(cl.it[1]);
    case 'D': {
      const e = cl.it.map(ent);
      for (let i = 0; i < e.length; i++) for (let j = i + 1; j < e.length; j++) if (e[i] === e[j]) return false;
      return true;
    }
    case 'E': return ((cl.s >> assign[cl.c][ent(cl.it[0])]) & 1) === 1;
    case 'O': { const d = pos(cl.it[1]) - pos(cl.it[0]); return d >= cl.g1 && d <= cl.g2; }
    case 'A': { const d = Math.abs(pos(cl.it[1]) - pos(cl.it[0])); return d >= cl.g1 && d <= cl.g2; }
    case 'N': { const p = pos(cl.it[0]); const N = assign[0].length; return cl.kde === 0 ? p === 0 : cl.kde === 1 ? p === N - 1 : (p !== 0 && p !== N - 1); }
    case 'B': { const a = pos(cl.it[0]), b = pos(cl.it[1]), c = pos(cl.it[2]); return Math.min(a, c) < b && b < Math.max(a, c); }
    default: return false;
  }
}

export function vsetkyPravdive(clues, assign, k, N, ordered) {
  const inv = inverzie(assign, k, N);
  for (const cl of clues) if (!pravdivaS(cl, assign, inv, ordered)) return false;
  return true;
}

/* Štrukturálna legálnosť indície: rôzne kategórie, usporiadaná kategória nie
   je koncom O, A, N, B, veľkosť množiny EITHER v medziach. */
export function legalna(cl, k, N, ordered) {
  const cats = cl.it.map((p) => p[0]);
  for (const [a, i] of cl.it) if (!(a >= 0 && a < k) || !(i >= 0 && i < N)) return false;
  const rozne = new Set(cats);
  if (rozne.size !== cats.length) return false;
  if (cl.t === 'L' || cl.t === 'X') return cl.it.length === 2;
  if (cl.t === 'D') return cl.it.length === 2 || cl.it.length === 3;
  if (cl.t === 'E') {
    if (cl.it.length !== 1 || cl.c === cats[0] || !(cl.c >= 0 && cl.c < k)) return false;
    const p = pocetBitov(cl.s);
    return p >= 2 && p <= N - 1;
  }
  if (cl.t === 'O' || cl.t === 'A' || cl.t === 'N' || cl.t === 'B') {
    if (ordered < 0) return false;
    for (const a of cats) if (a === ordered) return false;
    if (cl.t === 'N') return cl.it.length === 1 && cl.kde >= 0 && cl.kde <= 2;
    if (cl.t === 'B') return cl.it.length === 3;
    return cl.it.length === 2 && cl.g1 >= 1 && cl.g1 <= cl.g2 && cl.g2 <= N - 1;
  }
  return false;
}

/* ── Propagácia jednej indície ───────────────────────────────────────── *
 * Vracia 1 pri zmene, 0 bez zmeny, -1 pri spore. */
function obmedz(P, k, N, ordered, cl) {
  let z = 0;
  const kroky = obmedzenia(P, k, N, ordered, cl);
  for (const [a, b, x, m] of kroky) {
    const r = nastav(P, k, N, a, b, x, m);
    if (r < 0) return -1;
    z |= r;
  }
  return z;
}

/* Zoznam [a,b,x,maska] obmedzení, ktoré indícia kladie na terajší stav. */
function obmedzenia(P, k, N, ordered, cl) {
  const o = ordered;
  const out = [];
  const plna = plnaMaska(N);
  const tyzdne = (p) => P[(p[0] * k + o) * N + p[1]];
  switch (cl.t) {
    case 'L': {
      const [a, i] = cl.it[0], [b, j] = cl.it[1];
      out.push([a, b, i, 1 << j]);
      break;
    }
    case 'X': {
      const [a, i] = cl.it[0], [b, j] = cl.it[1];
      out.push([a, b, i, plna & ~(1 << j)]);
      break;
    }
    case 'D': {
      for (let u = 0; u < cl.it.length; u++) {
        for (let v = u + 1; v < cl.it.length; v++) {
          const [a, i] = cl.it[u], [b, j] = cl.it[v];
          out.push([a, b, i, plna & ~(1 << j)]);
        }
      }
      break;
    }
    case 'E': {
      const [a, i] = cl.it[0];
      out.push([a, cl.c, i, cl.s]);
      break;
    }
    case 'O': case 'A': {
      const A = cl.it[0], B = cl.it[1];
      const WA = tyzdne(A), WB = tyzdne(B);
      let nA = 0, nB = 0;
      for (const p of bityZMasky(WA)) {
        for (const q of bityZMasky(WB)) {
          const d = cl.t === 'O' ? q - p : Math.abs(q - p);
          if (d >= cl.g1 && d <= cl.g2) { nA |= 1 << p; nB |= 1 << q; }
        }
      }
      out.push([A[0], o, A[1], nA]);
      out.push([B[0], o, B[1], nB]);
      out.push([A[0], B[0], A[1], plna & ~(1 << B[1])]);
      break;
    }
    case 'N': {
      const A = cl.it[0];
      const m = cl.kde === 0 ? (1 << 0) : cl.kde === 1 ? (1 << (N - 1)) : plna & ~((1 << 0) | (1 << (N - 1)));
      out.push([A[0], o, A[1], m]);
      break;
    }
    case 'B': {
      const A = cl.it[0], B = cl.it[1], C = cl.it[2];
      const WA = tyzdne(A), WB = tyzdne(B), WC = tyzdne(C);
      let nA = 0, nB = 0, nC = 0;
      for (const p of bityZMasky(WA)) {
        for (const q of bityZMasky(WB)) {
          if (q === p) continue;
          for (const r of bityZMasky(WC)) {
            if (r === p || r === q) continue;
            if (Math.min(p, r) < q && q < Math.max(p, r)) { nA |= 1 << p; nB |= 1 << q; nC |= 1 << r; }
          }
        }
      }
      out.push([A[0], o, A[1], nA]);
      out.push([B[0], o, B[1], nB]);
      out.push([C[0], o, C[1], nC]);
      out.push([A[0], B[0], A[1], plna & ~(1 << B[1])]);
      out.push([A[0], C[0], A[1], plna & ~(1 << C[1])]);
      out.push([B[0], C[0], B[1], plna & ~(1 << C[1])]);
      break;
    }
    default: break;
  }
  return out;
}

/* ── Propagačné jadro ────────────────────────────────────────────────── *
 * R1 riadok s jediným bitom je priradenie, R2 stĺpec, ktorý môže vziať jediný
 * riadok, je priradenie, R3 priradenie vyčistí položku zo všetkých ostatných
 * riadkov tabuľky v oboch zrkadlách, R4 kompozícia cez tretiu kategóriu, R5
 * každá indícia sa prepočíta, R6 prázdna maska je spor. */
function pravidlaTabuliek(P, k, N) {
  let z = 0;
  const plna = plnaMaska(N);
  for (let a = 0; a < k; a++) {
    for (let b = 0; b < k; b++) {
      if (a === b) continue;
      for (let x = 0; x < N; x++) {
        const m = P[(a * k + b) * N + x];
        if (!jedenBit(m)) continue;
        for (let x2 = 0; x2 < N; x2++) {
          if (x2 === x) continue;
          const r = nastav(P, k, N, a, b, x2, plna & ~m);
          if (r < 0) return -1;
          z |= r;
        }
      }
      for (let y = 0; y < N; y++) {
        const stlpec = P[(b * k + a) * N + y];
        if (!jedenBit(stlpec)) continue;
        const x = indexBitu(stlpec);
        const r = nastav(P, k, N, a, b, x, 1 << y);
        if (r < 0) return -1;
        z |= r;
      }
    }
  }
  return z;
}

function kompozicia(P, k, N) {
  let z = 0;
  for (let a = 0; a < k; a++) {
    for (let b = 0; b < k; b++) {
      if (b === a) continue;
      for (let c = 0; c < k; c++) {
        if (c === a || c === b) continue;
        for (let x = 0; x < N; x++) {
          let u = 0;
          let m = P[(a * k + b) * N + x];
          while (m) { const bit = m & -m; m ^= bit; u |= P[(b * k + c) * N + (31 - Math.clz32(bit))]; }
          const r = nastav(P, k, N, a, c, x, u);
          if (r < 0) return -1;
          z |= r;
        }
      }
    }
  }
  return z;
}

export function propaguj(P, zad) {
  const k = zad.k, N = zad.N, o = zad.ordered;
  for (let kolo = 0; kolo < 400; kolo++) {
    let zmena = 0;
    for (const cl of zad.clues) { const r = obmedz(P, k, N, o, cl); if (r < 0) return false; zmena |= r; }
    const r1 = pravidlaTabuliek(P, k, N); if (r1 < 0) return false; zmena |= r1;
    const r2 = kompozicia(P, k, N); if (r2 < 0) return false; zmena |= r2;
    if (!prazdneOk(P, k, N)) return false;
    if (!zmena) return true;
  }
  return true;
}

/* ── solve: úplné prehľadávanie s MRV, krížová kontrola ──────────────── *
 * Nie je to druhý nezávislý dôkaz jednoznačnosti (z korektného solveHuman
 * jednoznačnosť už vyplýva). Je to nezávislá kontrola korektnosti solveHuman.
 * Kandidát, ktorý vyčerpá maxNodes, sa zahadzuje, nie prijíma. */
export function solve(zad, opts = {}) {
  const limit = opts.limit ?? 2;
  const maxNodes = opts.maxNodes ?? 20000;
  const k = zad.k, N = zad.N;
  let count = 0, nodes = 0, vycerpane = false;
  const solutions = [];

  function rek(P) {
    if (vycerpane || count >= limit) return;
    nodes++;
    if (maxNodes && nodes > maxNodes) { vycerpane = true; return; }
    if (!propaguj(P, zad)) return;
    let ba = -1, bb = -1, bx = -1, bn = N + 1;
    for (let a = 0; a < k; a++) {
      for (let b = a + 1; b < k; b++) {
        for (let x = 0; x < N; x++) {
          const p = pocetBitov(P[(a * k + b) * N + x]);
          if (p > 1 && p < bn) { bn = p; ba = a; bb = b; bx = x; }
        }
      }
    }
    if (ba < 0) {
      const assign = riesenieZoStavu(P, k, N);
      if (!assign) return;
      if (!vsetkyPravdive(zad.clues, assign, k, N, zad.ordered)) return;
      count++;
      solutions.push(assign);
      return;
    }
    for (const y of bityZMasky(P[(ba * k + bb) * N + bx])) {
      const P2 = Uint32Array.from(P);
      if (nastav(P2, k, N, ba, bb, bx, 1 << y) < 0) continue;
      rek(P2);
      if (vycerpane || count >= limit) return;
    }
  }
  const P0 = opts.initial ? Uint32Array.from(opts.initial) : novyStav(k, N);
  rek(P0);
  return { count, solution: solutions.length ? solutions[0] : null, solutions, nodes, vycerpane };
}

/* ── Anglické znenie indícií ─────────────────────────────────────────── *
 * Každá veta vzniká z našej šablóny nad objektom obmedzenia, nikdy sa
 * neprepisuje odinakiaľ. Najviac 14 slov, aby sa pri 390 px zmestila do dvoch
 * riadkov; dlhšia inštancia sa v generátore odmietne, nie skráti. */
const CISLOVKY = ['zero', 'one', 'two', 'three', 'four', 'five'];

function velke(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* Holý názov položky: Pip, the sloes, the elm, 9 March. */
export function polozka(zad, a, i) {
  const t = zad.cats[a].items[i];
  return a === 0 ? t : a === 3 ? t : 'the ' + t;
}
/* Položka ako podstatné meno vo výpočte: the week of 9 March pri týždňoch. */
function frazaPolozky(zad, a, i) {
  return a === 3 ? 'the week of ' + zad.cats[a].items[i] : polozka(zad, a, i);
}
/* Plch, ktorý tú položku má. */
function frazaPlcha(zad, a, i) {
  const t = zad.cats[a].items[i];
  if (a === 0) return t;
  if (a === 1) return 'the dormouse with the ' + t;
  if (a === 2) return 'the dormouse in the ' + t;
  return 'the dormouse who woke on ' + t;
}
function zoznamFraz(casti, spojka) {
  if (casti.length === 1) return casti[0];
  return casti.slice(0, -1).join(', ') + ' ' + spojka + ' ' + casti[casti.length - 1];
}

const SABLONY_LINK = {
  '0,1': (A, B) => A + ' keeps ' + B + '.',
  '0,2': (A, B) => A + ' sleeps in ' + B + '.',
  '0,3': (A, B) => A + ' woke on ' + B + '.',
  '1,2': (A, B) => A + ' are kept in ' + B + '.',
  '1,3': (A, B) => A + ' were put away on ' + B + '.',
  '2,3': (A, B) => 'the store in ' + A + ' was put away on ' + B + '.',
};
const SABLONY_EXCLUDE = {
  '0,1': (A, B) => A + ' does not keep ' + B + '.',
  '0,2': (A, B) => A + ' does not sleep in ' + B + '.',
  '0,3': (A, B) => A + ' did not wake on ' + B + '.',
  '1,2': (A, B) => A + ' are not kept in ' + B + '.',
  '1,3': (A, B) => A + ' were not put away on ' + B + '.',
  '2,3': (A, B) => 'the store in ' + A + ' was not put away on ' + B + '.',
};
const SABLONY_EITHER = {
  0: (E, L) => E + ' is ' + L + '.',
  1: (E, L) => E + ' keeps ' + L + '.',
  2: (E, L) => E + ' sleeps in ' + L + '.',
  3: (E, L) => E + ' woke on ' + L + '.',
};

export function textIndicie(zad, cl) {
  switch (cl.t) {
    case 'L': case 'X': {
      let [a, i] = cl.it[0], [b, j] = cl.it[1];
      if (a > b) { const ta = a, ti = i; a = b; i = j; b = ta; j = ti; }
      const f = (cl.t === 'L' ? SABLONY_LINK : SABLONY_EXCLUDE)[a + ',' + b];
      return velke(f(polozka(zad, a, i), polozka(zad, b, j)));
    }
    case 'D': {
      const casti = cl.it.map(([a, i]) => frazaPolozky(zad, a, i));
      const chvost = cl.it.length === 3 ? ' belong to three different dormice.' : ' belong to different dormice.';
      return velke(zoznamFraz(casti, 'and') + chvost);
    }
    case 'E': {
      const E = frazaPlcha(zad, cl.it[0][0], cl.it[0][1]);
      const L = zoznamFraz(bityZMasky(cl.s).map((y) => polozka(zad, cl.c, y)), 'or');
      return velke(SABLONY_EITHER[cl.c](E, L));
    }
    case 'O': {
      const A = frazaPlcha(zad, cl.it[0][0], cl.it[0][1]);
      const B = frazaPlcha(zad, cl.it[1][0], cl.it[1][1]);
      if (cl.g1 === cl.g2) {
        const w = CISLOVKY[cl.g1] + (cl.g1 === 1 ? ' week' : ' weeks');
        return velke(A + ' woke exactly ' + w + ' before ' + B + '.');
      }
      return velke(A + ' woke before ' + B + '.');
    }
    case 'A': {
      const A = frazaPlcha(zad, cl.it[0][0], cl.it[0][1]);
      const B = frazaPlcha(zad, cl.it[1][0], cl.it[1][1]);
      const w = CISLOVKY[cl.g1] + (cl.g1 === 1 ? ' week' : ' weeks');
      return velke(A + ' and ' + B + ' woke ' + w + ' apart, in some order.');
    }
    case 'N': {
      const A = frazaPlcha(zad, cl.it[0][0], cl.it[0][1]);
      if (cl.kde === 0) return velke(A + ' was the first to wake.');
      if (cl.kde === 1) return velke(A + ' was the last to wake.');
      return velke(A + ' woke neither first nor last.');
    }
    case 'B': {
      const A = frazaPlcha(zad, cl.it[0][0], cl.it[0][1]);
      const B = frazaPlcha(zad, cl.it[1][0], cl.it[1][1]);
      const C = frazaPlcha(zad, cl.it[2][0], cl.it[2][1]);
      return velke(B + ' woke between ' + A + ' and ' + C + '.');
    }
    default: return '';
  }
}

export function pocetSlov(t) { return String(t).trim().split(/\s+/).length; }
export const MAX_SLOV = 14;

/* Jedna veta rozuzlenia pre panel výsledku a pre stranu riešení. */
export function vetaRozuzlenia(zad) {
  const x = zad.solution[1].indexOf(zad.question.what);
  const kto = zad.cats[0].items[zad.solution[0][x]];
  const co = zad.cats[1].items[zad.solution[1][x]];
  const kde = zad.cats[2].items[zad.solution[2][x]];
  let s = kto + ' had the ' + co + ', in the ' + kde;
  if (zad.ordered === 3) s += ', in the week of ' + zad.cats[3].items[zad.solution[3][x]];
  return s + '.';
}

/* ── solveHuman: vrstvy 1, 2a, 2b a 3 ────────────────────────────────── */
export const VRSTVY = ['1', '2a', '2b', '3'];
export function poradieVrstvy(v) { const i = VRSTVY.indexOf(String(v)); return i < 0 ? VRSTVY.length : i + 1; }

/* Políčko v kanonickej orientácii tabuľky (a < b). */
function bunka(a, b, x, y, val) {
  return a < b ? { tab: [a, b], r: x, c: y, val } : { tab: [b, a], r: y, c: x, val };
}

/* Použije zoznam [a,b,x,maska] na stav a zapíše, ktoré políčka sa zmenili.
   Vracia -1 pri spore, inak počet zmenených riadkov. */
function pouzi(P, k, N, zmeny, cells) {
  let pocet = 0;
  for (const [a, b, x, m] of zmeny) {
    const i = (a * k + b) * N + x;
    const stara = P[i];
    const nova = stara & m;
    if (nova === stara) continue;
    for (const y of bityZMasky(stara & ~nova)) cells.push(bunka(a, b, x, y, 0));
    if (jedenBit(nova) && !jedenBit(stara)) cells.push(bunka(a, b, x, indexBitu(nova), 1));
    const r = nastav(P, k, N, a, b, x, m);
    if (r < 0) return -1;
    pocet++;
  }
  return pocet;
}

function meniNiecoZ(P, k, N, zmeny) {
  for (const [a, b, x, m] of zmeny) { const i = (a * k + b) * N + x; if ((P[i] & m) !== P[i]) return true; }
  return false;
}

/* Vrstva 1: jedna indícia alebo jedna tabuľka. */
function vrstva1(P, zad) {
  const k = zad.k, N = zad.N, plna = plnaMaska(N);
  for (let ci = 0; ci < zad.clues.length; ci++) {
    const cl = zad.clues[ci];
    let pravidlo = null;
    if (cl.t === 'L') pravidlo = 'apply-link';
    else if (cl.t === 'X') pravidlo = 'apply-exclude';
    else if (cl.t === 'D') pravidlo = 'apply-different';
    else if (cl.t === 'E' && pocetBitov(cl.s) === 2) pravidlo = 'apply-either-pair';
    if (!pravidlo) continue;
    const z = obmedzenia(P, k, N, zad.ordered, cl);
    if (meniNiecoZ(P, k, N, z)) return { rule: pravidlo, layer: '1', clue: ci, zmeny: z, text: 'Clue ' + (ci + 1) + ' settles squares on its own.' };
  }
  for (let a = 0; a < k; a++) {
    for (let b = 0; b < k; b++) {
      if (a === b) continue;
      for (let x = 0; x < N; x++) {
        const m = P[(a * k + b) * N + x];
        if (!jedenBit(m)) continue;
        const z = [];
        for (let x2 = 0; x2 < N; x2++) if (x2 !== x && (P[(a * k + b) * N + x2] & m)) z.push([a, b, x2, plna & ~m]);
        if (z.length) {
          return {
            rule: 'row-single', layer: '1', clue: -1, zmeny: z,
            text: velke(polozka(zad, a, x) + ' goes with ' + polozka(zad, b, indexBitu(m)) + ', so nothing else in that table can.'),
          };
        }
      }
      for (let y = 0; y < N; y++) {
        const stlpec = P[(b * k + a) * N + y];
        if (!jedenBit(stlpec)) continue;
        const x = indexBitu(stlpec);
        if (jedenBit(P[(a * k + b) * N + x])) continue;
        return {
          rule: 'column-single', layer: '1', clue: -1, zmeny: [[a, b, x, 1 << y]],
          text: velke(polozka(zad, b, y) + ' has only one place left, so it goes with ' + polozka(zad, a, x) + '.'),
        };
      }
    }
  }
  return null;
}

/* Vrstva 2a: prenos medzi tabuľkami a tranzitívne pravidlá. */
function vrstva2a(P, zad) {
  const k = zad.k, N = zad.N, plna = plnaMaska(N);
  for (let a = 0; a < k; a++) {
    for (let b = 0; b < k; b++) {
      if (a === b) continue;
      for (let x = 0; x < N; x++) {
        const m = P[(a * k + b) * N + x];
        if (!jedenBit(m)) continue;
        const y = indexBitu(m);
        for (let c = 0; c < k; c++) {
          if (c === a || c === b) continue;
          const mx = P[(a * k + c) * N + x], my = P[(b * k + c) * N + y];
          const spolu = mx & my;
          if (spolu !== mx || spolu !== my) {
            return {
              rule: 'carry-across', layer: '2a', clue: -1, zmeny: [[a, c, x, spolu], [b, c, y, spolu]],
              text: velke(polozka(zad, a, x) + ' and ' + polozka(zad, b, y) + ' are the same dormouse, so their rows in the ' + zad.cats[c].label.toLowerCase() + ' table agree.'),
            };
          }
        }
      }
    }
  }
  for (let a = 0; a < k; a++) {
    for (let b = 0; b < k; b++) {
      if (a === b) continue;
      for (let x = 0; x < N; x++) {
        for (const y of bityZMasky(P[(a * k + b) * N + x])) {
          for (let c = 0; c < k; c++) {
            if (c === a || c === b) continue;
            if ((P[(a * k + c) * N + x] & P[(b * k + c) * N + y]) === 0) {
              return {
                rule: 'no-shared-partner', layer: '2a', clue: -1, zmeny: [[a, b, x, plna & ~(1 << y)]],
                text: velke(polozka(zad, a, x) + ' and ' + polozka(zad, b, y) + ' have no ' + zad.cats[c].jedno + ' left in common, so they are different dormice.'),
              };
            }
          }
        }
      }
    }
  }
  return null;
}

/* Vrstva 2b: vzory, okná poradia a množiny. */
function vrstva2b(P, zad) {
  const k = zad.k, N = zad.N;
  for (let ci = 0; ci < zad.clues.length; ci++) {
    const cl = zad.clues[ci];
    let pravidlo = null;
    if (cl.t === 'E' && pocetBitov(cl.s) > 2) pravidlo = 'either-set';
    else if (cl.t === 'O') pravidlo = 'order-window';
    else if (cl.t === 'A') pravidlo = 'apart-window';
    else if (cl.t === 'N') pravidlo = 'ends-window';
    else if (cl.t === 'B') pravidlo = 'between-window';
    if (!pravidlo) continue;
    const z = obmedzenia(P, k, N, zad.ordered, cl);
    if (meniNiecoZ(P, k, N, z)) return { rule: pravidlo, layer: '2b', clue: ci, zmeny: z, text: 'Clue ' + (ci + 1) + ' narrows the weeks it can still fit.' };
  }
  for (let a = 0; a < k; a++) {
    for (let b = 0; b < k; b++) {
      if (b === a) continue;
      for (let c = 0; c < k; c++) {
        if (c === a || c === b) continue;
        for (let x = 0; x < N; x++) {
          let u = 0;
          for (const y of bityZMasky(P[(a * k + b) * N + x])) u |= P[(b * k + c) * N + y];
          const teraz = P[(a * k + c) * N + x];
          if ((teraz & ~u) !== 0) {
            return {
              rule: 'through-the-middle', layer: '2b', clue: -1, zmeny: [[a, c, x, u]],
              text: velke('every ' + zad.cats[b].jedno + ' still open for ' + polozka(zad, a, x) + ' rules some of the ' + zad.cats[c].label.toLowerCase() + ' out.'),
            };
          }
        }
      }
    }
  }
  for (let a = 0; a < k; a++) {
    for (let b = 0; b < k; b++) {
      if (a === b) continue;
      const krok = nahaMnozina(P, zad, a, b);
      if (krok) return krok;
    }
  }
  return null;
}

/* Naked set v jednej tabuľke: r riadkov, ktoré spolu pokrývajú presne r
   položiek, tie položky nikde inde v tabuľke byť nemôžu. Hidden set je to
   isté v zrkadlenej tabuľke, a tú prejdeme tiež. */
function nahaMnozina(P, zad, a, b) {
  const k = zad.k, N = zad.N, plna = plnaMaska(N);
  const riadky = [];
  for (let x = 0; x < N; x++) riadky.push(P[(a * k + b) * N + x]);
  for (let velkost = 2; velkost <= N - 2; velkost++) {
    const vyber = [];
    const rek = (od) => {
      if (vyber.length === velkost) {
        let u = 0;
        for (const x of vyber) u |= riadky[x];
        if (pocetBitov(u) !== velkost) return false;
        const z = [];
        for (let x = 0; x < N; x++) if (!vyber.includes(x) && (riadky[x] & u)) z.push([a, b, x, plna & ~u]);
        if (!z.length) return false;
        const mena = vyber.map((x) => polozka(zad, a, x)).join(' and ');
        vysledok = {
          rule: 'naked-set', layer: '2b', clue: -1, zmeny: z,
          text: velke(mena + ' take ' + CISLOVKY[velkost] + ' of the ' + zad.cats[b].label.toLowerCase() + ' between them, so no one else can.'),
        };
        return true;
      }
      for (let x = od; x < N; x++) {
        if (pocetBitov(riadky[x]) < 2 || pocetBitov(riadky[x]) > velkost) continue;
        vyber.push(x);
        if (rek(x + 1)) return true;
        vyber.pop();
      }
      return false;
    };
    let vysledok = null;
    if (rek(0)) return vysledok;
  }
  return null;
}

/* Vrstva 3: jednokroková skúška, presne jeden predpoklad hlboko. Vlož fajku
   do otvoreného políčka, dobehni propagáciu a pri spore zapíš krížik. */
function vrstva3(P, zad) {
  const k = zad.k, N = zad.N, plna = plnaMaska(N);
  for (let a = 0; a < k; a++) {
    for (let b = a + 1; b < k; b++) {
      for (let x = 0; x < N; x++) {
        const m = P[(a * k + b) * N + x];
        if (jedenBit(m)) continue;
        for (const y of bityZMasky(m)) {
          const P2 = Uint32Array.from(P);
          let spor = nastav(P2, k, N, a, b, x, 1 << y) < 0;
          if (!spor) spor = !propaguj(P2, zad);
          if (spor) {
            return {
              rule: 'trial', layer: '3', clue: -1, zmeny: [[a, b, x, plna & ~(1 << y)]],
              text: velke('try ' + polozka(zad, a, x) + ' with ' + polozka(zad, b, y) + ' and the clues run into a contradiction, so that square is a cross.'),
            };
          }
        }
      }
    }
  }
  return null;
}

/* solveHuman(zad, { initial, limitKrokov, maxVrstva })
 *   Rieši len ľudskými pravidlami, bez hádania. Vrstvy sa skúšajú v poradí
 *   a riešiteľ sa zastaví na prvom kroku, ktorý vie urobiť, takže nápoveda je
 *   vždy najjednoduchší krok, ktorý sa dá práve teraz urobiť.
 *   initial: stav poss, napríklad hráčova plocha (logika.mjs);
 *   limitKrokov: skončiť po toľkých krokoch (nápoveda: 1);
 *   maxVrstva: najvyššia dovolená vrstva, '1', '2a', '2b' alebo '3'.
 * Vráti { solved, contradiction, layersUsed, steps, solution, poss, pouziteIndicie }. */
export function solveHuman(zad, opts = {}) {
  const k = zad.k, N = zad.N;
  const P = opts.initial ? Uint32Array.from(opts.initial) : novyStav(k, N);
  const strop = poradieVrstvy(opts.maxVrstva ?? '3');
  const limitKrokov = opts.limitKrokov || 0;
  const steps = [];
  const pouzite = new Set();
  let spor = !prazdneOk(P, k, N);
  while (!spor) {
    if (vsetkyJednoznacne(P, k, N)) break;
    const kr = vrstva1(P, zad)
      || (strop >= 2 ? vrstva2a(P, zad) : null)
      || (strop >= 3 ? vrstva2b(P, zad) : null)
      || (strop >= 4 ? vrstva3(P, zad) : null);
    if (!kr) break;
    const cells = [];
    const r = pouzi(P, k, N, kr.zmeny, cells);
    if (r < 0 || !prazdneOk(P, k, N)) { spor = true; break; }
    if (r === 0) break;
    if (kr.clue >= 0) pouzite.add(kr.clue);
    steps.push({ rule: kr.rule, layer: kr.layer, clue: kr.clue, cells, text: kr.text });
    if (limitKrokov && steps.length >= limitKrokov) break;
    if (steps.length > 4000) break;
  }
  let hotove = !spor && vsetkyJednoznacne(P, k, N);
  let assign = null;
  if (hotove) {
    assign = riesenieZoStavu(P, k, N);
    hotove = !!assign && vsetkyPravdive(zad.clues, assign, k, N, zad.ordered);
  }
  const layersUsed = { 1: 0, '2a': 0, '2b': 0, 3: 0 };
  for (const st of steps) layersUsed[st.layer]++;
  return { solved: hotove, contradiction: spor, layersUsed, steps, solution: hotove ? assign : null, poss: P, pouziteIndicie: pouzite };
}

/* ── Odtlačky ────────────────────────────────────────────────────────── *
 * Prefix je k x N, nie samotné N: dve rôzne k s rovnakým N by inak dali
 * rovnaký prefix (ops/spec-hra-detektiv.md 6.4 bod 3). */
export function odtlacok(zad) {
  const obsadenie = zad.cats.map((c) => c.idx.join(',')).join('/');
  const indicie = zad.clues.map(klucIndicie).slice().sort().join(';');
  return zad.k + 'x' + zad.N + '|' + zad.bank + '|' + obsadenie + '|' + indicie;
}
export function odtlacokRiesenia(zad) {
  const obsadenie = zad.cats.map((c) => c.idx.join(',')).join('/');
  return zad.k + 'x' + zad.N + '|' + zad.bank + '|' + obsadenie + '|' + zad.solution.slice(1).map((p) => p.join('')).join('-');
}

/* ── Výber obsadenia ─────────────────────────────────────────────────── *
 * N položiek na kategóriu tak, aby všetky položky neusporiadaných kategórií
 * mali navzájom rôzne začiatočné písmeno (hlavičky mriežky sú jednoznaky).
 * Je to systém rôznych reprezentantov, teda Hallova podmienka nad zjednotením
 * písmen; hľadá sa spätným vyhľadávaním nad zamiešanými bankami. */
function vyberObsadenie(rng, k, N) {
  const kats = KATEGORIE.slice(0, k);
  const vybrane = kats.map(() => []);
  const pismena = new Set();
  const poradie = [];
  for (let a = 0; a < k; a++) {
    if (KATEGORIE[a] === 'when') continue;
    const zoznam = zamiesajPole(rng, rozsah(BANKY[KATEGORIE[a]].length));
    for (let s = 0; s < N; s++) poradie.push({ a, zoznam });
  }
  let kroky = 0;
  const rek = (p) => {
    if (kroky++ > 20000) return false;
    if (p >= poradie.length) return true;
    const { a, zoznam } = poradie[p];
    const bank = BANKY[KATEGORIE[a]];
    for (const i of zoznam) {
      if (vybrane[a].includes(i)) continue;
      const pis = bank[i].charAt(0).toUpperCase();
      if (pismena.has(pis)) continue;
      pismena.add(pis);
      vybrane[a].push(i);
      if (rek(p + 1)) return true;
      vybrane[a].pop();
      pismena.delete(pis);
    }
    return false;
  };
  if (!rek(0)) return null;
  const out = [];
  for (let a = 0; a < k; a++) {
    if (KATEGORIE[a] === 'when') out.push(rozsah(N));
    else out.push(vybrane[a].slice());
  }
  return out;
}

export const JEDNOTNE = { who: 'dormouse', what: 'store', where: 'tree', when: 'week' };

function postavKategorie(idx, k) {
  const out = [];
  for (let a = 0; a < k; a++) {
    const id = KATEGORIE[a];
    out.push({
      id, label: NAZVY_KATEGORII[id], jedno: JEDNOTNE[id],
      idx: idx[a], items: idx[a].map((i) => BANKY[id][i]),
    });
  }
  return out;
}

/* ── Riešenie a filtre degenerácie ───────────────────────────────────── */
function blizkoIdentite(p, q) {
  let rozdiel = 0;
  for (let i = 0; i < p.length; i++) if (p[i] !== q[i]) rozdiel++;
  return rozdiel === 0 || rozdiel === 2;
}

function nahodneRiesenie(rng, k, N) {
  const assign = [rozsah(N)];
  for (let a = 1; a < k; a++) assign.push(zamiesaj(rng, N));
  const identita = rozsah(N);
  for (let a = 1; a < k; a++) if (blizkoIdentite(assign[a], identita)) return null;
  for (let a = 1; a < k; a++) for (let b = a + 1; b < k; b++) if (blizkoIdentite(assign[a], assign[b])) return null;
  return assign;
}

/* ── Profily úrovní ──────────────────────────────────────────────────── *
 * Pásmo počtu indícií je len horný strop, nie cieľ a nie dolná hranica:
 * minimalizácia tlačí množinu nadol a spodná hranica by systematicky
 * zahadzovala platné hádanky. Skutočné rozdelenie sa meria. */
export const PROFILY = {
  easy: { k: 3, N: 5, maxVrstva: '2a', strop: 8, maxLink: 99, vahy: { L: 3, X: 4, D: 2, E: 2 } },
  medium: { k: 4, N: 4, maxVrstva: '2b', strop: 11, maxLink: 99, vahy: { L: 2, X: 4, D: 2, E: 2, O: 3, A: 2 } },
  hard: { k: 4, N: 4, maxVrstva: '2b', strop: 13, maxLink: 1, vahy: { L: 1, X: 4, D: 2, E: 2, O: 3, A: 3, N: 2, B: 2 } },
  /* Challenge je jediná úroveň, ktorá smie žiadať skúšanie, a `vyzadujeL3`
     hovorí, že ho aj žiadať musí: kandidát, ktorý sa dá dokončiť bez vrstvy 3,
     sa zahodí. Bez toho by veta o skúšaní v knihe platila len pre časť zadaní. */
  challenge: {
    k: 4, N: 4, maxVrstva: '3', strop: 15, maxLink: 0, vyzadujeL3: true,
    /* Nameraných 40 seedov: medián 33 pokusov, najhorší 188. Strop 200 zo spec
       4.4 by teda na challenge padal, preto je tu 1500. Pokus stojí okolo
       jednej milisekundy, takže strop nie je rozpočet, len poistka. */
    maxAttempts: 1500,
    vahy: { X: 4, D: 2, E: 2, O: 2, A: 4, N: 2, B: 3 },
  },
};

/* ── Vzorkovanie pravdivých indícií ──────────────────────────────────── *
 * Bazén sa neenumeruje celý: vážený výber typu, potom náhodná legálna
 * inštancia toho typu, pravdivá v riešení. Odmietne sa duplikát, príliš dlhá
 * veta a indícia, ktorá nad terajšou množinou nič neodoberie. Každá prijatá
 * indícia stav striktne zmenší, takže slučka končí. */
function nahodnaIndicia(rng, zad, assign, typ) {
  const k = zad.k, N = zad.N, o = zad.ordered;
  const inv = inverzie(assign, k, N);
  const neusp = [];
  for (let a = 0; a < k; a++) if (a !== o) neusp.push(a);
  const nahodne = (pole) => pole[Math.floor(rng() * pole.length)];
  const dveKat = (zoznam) => {
    const a = nahodne(zoznam);
    let b = nahodne(zoznam);
    if (a === b) return null;
    return [a, b];
  };
  switch (typ) {
    case 'L': {
      const par = dveKat(rozsah(k)); if (!par) return null;
      const x = Math.floor(rng() * N);
      return { t: 'L', it: [[par[0], assign[par[0]][x]], [par[1], assign[par[1]][x]]] };
    }
    case 'X': {
      const par = dveKat(rozsah(k)); if (!par) return null;
      const x = Math.floor(rng() * N);
      let y = Math.floor(rng() * N);
      if (y === x) return null;
      return { t: 'X', it: [[par[0], assign[par[0]][x]], [par[1], assign[par[1]][y]]] };
    }
    case 'D': {
      const kolko = rng() < 0.5 ? 2 : Math.min(3, k);
      const kats = zamiesajPole(rng, rozsah(k)).slice(0, kolko);
      const plchy = zamiesaj(rng, N).slice(0, kolko);
      if (kats.length < kolko) return null;
      return { t: 'D', it: kats.map((a, u) => [a, assign[a][plchy[u]]]) };
    }
    case 'E': {
      const par = dveKat(rozsah(k)); if (!par) return null;
      const [a, c] = par;
      const x = Math.floor(rng() * N);
      const velkost = 2 + Math.floor(rng() * Math.max(1, N - 2));
      if (velkost > N - 1) return null;
      const spravna = assign[c][x];
      const ostatne = zamiesajPole(rng, rozsah(N).filter((y) => y !== spravna)).slice(0, velkost - 1);
      let s = 1 << spravna;
      for (const y of ostatne) s |= 1 << y;
      return { t: 'E', it: [[a, assign[a][x]]], c, s };
    }
    case 'O': case 'A': {
      if (o < 0) return null;
      const par = dveKat(neusp); if (!par) return null;
      const x = Math.floor(rng() * N);
      let y = Math.floor(rng() * N);
      if (x === y) return null;
      let A = [par[0], assign[par[0]][x]], B = [par[1], assign[par[1]][y]];
      const pa = assign[o][x], pb = assign[o][y];
      if (typ === 'O') {
        if (pb < pa) { const t = A; A = B; B = t; }
        const d = Math.abs(pb - pa);
        const presna = rng() < 0.65;
        return presna ? { t: 'O', it: [A, B], g1: d, g2: d } : { t: 'O', it: [A, B], g1: 1, g2: N - 1 };
      }
      const d = Math.abs(pb - pa);
      return { t: 'A', it: [A, B], g1: d, g2: d };
    }
    case 'N': {
      if (o < 0) return null;
      const a = nahodne(neusp);
      const x = Math.floor(rng() * N);
      const p = assign[o][x];
      const kde = p === 0 ? 0 : p === N - 1 ? 1 : 2;
      return { t: 'N', it: [[a, assign[a][x]]], kde };
    }
    case 'B': {
      if (o < 0 || neusp.length < 3) return null;
      const kats = zamiesajPole(rng, neusp.slice()).slice(0, 3);
      const plchy = zamiesaj(rng, N).slice(0, 3);
      const pos = plchy.map((x) => assign[o][x]);
      const stred = [0, 1, 2].filter((u) => Math.min(pos[(u + 1) % 3], pos[(u + 2) % 3]) < pos[u] && pos[u] < Math.max(pos[(u + 1) % 3], pos[(u + 2) % 3]));
      if (!stred.length) return null;
      const s = stred[0];
      const ostatne = [0, 1, 2].filter((u) => u !== s);
      const it = [
        [kats[ostatne[0]], assign[kats[ostatne[0]]][plchy[ostatne[0]]]],
        [kats[s], assign[kats[s]][plchy[s]]],
        [kats[ostatne[1]], assign[kats[ostatne[1]]][plchy[ostatne[1]]]],
      ];
      return { t: 'B', it };
    }
    default: return null;
  }
}

function vyberTyp(rng, vahy, pocetLink, maxLink) {
  const zoznam = [];
  for (const t of Object.keys(vahy)) {
    if (t === 'L' && pocetLink >= maxLink) continue;
    for (let i = 0; i < vahy[t]; i++) zoznam.push(t);
  }
  if (!zoznam.length) return null;
  return zoznam[Math.floor(rng() * zoznam.length)];
}

/* ── Oslabovanie ─────────────────────────────────────────────────────── */
function oslabenia(cl, N) {
  const out = [];
  if (cl.t === 'L') {
    const [a, i] = cl.it[0], [b, j] = cl.it[1];
    for (let y = 0; y < N; y++) if (y !== j) out.push({ t: 'E', it: [[a, i]], c: b, s: (1 << j) | (1 << y) });
  }
  if (cl.t === 'O' && cl.g1 === cl.g2) {
    out.push({ t: 'A', it: [cl.it[0], cl.it[1]], g1: cl.g1, g2: cl.g2 });
    out.push({ t: 'O', it: [cl.it[0], cl.it[1]], g1: 1, g2: N - 1 });
  }
  if (cl.t === 'E') {
    const p = pocetBitov(cl.s);
    if (p + 1 <= N - 1) for (let y = 0; y < N; y++) if (!((cl.s >> y) & 1)) out.push({ t: 'E', it: cl.it, c: cl.c, s: cl.s | (1 << y) });
  }
  if (cl.t === 'D' && cl.it.length === 3) {
    out.push({ t: 'D', it: [cl.it[0], cl.it[1]] });
    out.push({ t: 'D', it: [cl.it[0], cl.it[2]] });
    out.push({ t: 'D', it: [cl.it[1], cl.it[2]] });
  }
  return out;
}

/* ── Filtre hráčskej kvality (4.6) ───────────────────────────────────── */
function filtreKvality(zad, beh) {
  const k = zad.k, N = zad.N;
  let hned = 0;
  for (const cl of zad.clues) {
    const P = novyStav(k, N);
    if (meniNiecoZ(P, k, N, obmedzenia(P, k, N, zad.ordered, cl))) hned++;
  }
  if (hned < 2) return 'first step not free';
  const kroky = beh.steps;
  if (!kroky.length) return 'no steps';
  const zname = [];
  for (let x = 0; x < N; x++) zname.push(0);
  let prvyUzavrety = -1;
  const P = novyStav(k, N);
  for (let s = 0; s < kroky.length; s++) {
    pouzi(P, k, N, [], []);
    for (const c of kroky[s].cells) {
      const [a, b] = c.tab;
      if (c.val === 1) {
        if (a === 0) zname[c.r] |= 1 << b;
        if (b === 0) zname[c.c] |= 1 << a;
      }
    }
    if (prvyUzavrety < 0) {
      for (let x = 0; x < N; x++) {
        let vsetky = true;
        for (let c = 1; c < k; c++) if (!((zname[x] >> c) & 1)) vsetky = false;
        if (vsetky) { prvyUzavrety = s; break; }
      }
    }
  }
  if (prvyUzavrety >= 0 && prvyUzavrety < Math.floor(kroky.length * 0.4)) return 'a dormouse closed too early';
  const poTabulkach = new Map();
  let spolu = 0;
  for (const st of kroky) {
    for (const c of st.cells) {
      const kluc = c.tab[0] + ',' + c.tab[1];
      poTabulkach.set(kluc, (poTabulkach.get(kluc) || 0) + 1);
      spolu++;
    }
  }
  for (const v of poTabulkach.values()) if (v > spolu * 0.55) return 'one table takes too much of the work';
  return null;
}

/* ── Generovanie ─────────────────────────────────────────────────────── */
export function generate(dateStr, opts = {}) {
  if (!isValidDate(dateStr)) throw new Error('Date must be in YYYY-MM-DD form: ' + dateStr);
  const k = opts.k ?? 4, N = opts.N ?? 4;
  return generateSeeded(dateStr, dateStr + '/' + k + 'x' + N, opts);
}

/* generateSeeded(name, key, opts)
 *   opts: { k, N, maxVrstva, strop, vahy, maxLink, maxAttempts, maxNodes,
 *           meraMinimalitu }
 * Vráti { date, k, N, ordered, bank, cats, clues, solution, question, seed,
 *         attempts, difficulty, ms }. */
export function generateSeeded(name, key, opts = {}) {
  const k = opts.k ?? 4;
  const N = opts.N ?? 4;
  const ordered = k === 4 ? 3 : -1;
  const maxVrstva = opts.maxVrstva ?? '3';
  const strop = opts.strop ?? 4 * N * k;
  const vahy = opts.vahy || PROFILY.medium.vahy;
  const maxLink = opts.maxLink ?? 99;
  const maxAttempts = opts.maxAttempts ?? 200;
  const maxNodes = opts.maxNodes ?? 20000;
  const stropIndicii = 4 * N * k;
  const t0 = nowMs();
  const seed = seedFromString(key);
  const rng = mulberry32(seed);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const idx = vyberObsadenie(rng, k, N);
    if (!idx) continue;
    const assign = nahodneRiesenie(rng, k, N);
    if (!assign) continue;
    const cats = postavKategorie(idx, k);
    const zad = { date: name, k, N, ordered, bank: BANKY.sada, cats, clues: [], solution: assign };

    /* Skúša riešiteľa lacno (vrstvy do 2b) a až keď treba, s vrstvou 3.
       Výkonové pravidlo zo spec 4.4: drahý nie je solve, drahý je solveHuman
       volaný stovky ráz na kandidáta, takže vrstva 3 sa púšťa len vtedy, keď
       vrstvy 1 až 2b nestačia. `l3` hovorí práve to: zadanie sa bez skúšania
       dokončiť nedá. */
    const skus = (clues) => {
      const z = { k, N, ordered, cats, clues, solution: assign };
      const lacny = solveHuman(z, { maxVrstva: maxVrstva === '3' ? '2b' : maxVrstva });
      if (lacny.solved && rovnake(lacny.solution, assign)) return { beh: lacny, l3: false };
      if (maxVrstva !== '3') return null;
      // Lacná brána pred drahým riešiteľom: keď zadanie nie je jednoznačné,
      // vrstva 3 ho aj tak nedorieši, a práve tieto prípady sú pri hľadaní
      // najčastejšie. solve je rádovo lacnejšie než vrstva 3 nad otvorenou
      // plochou.
      const kontrola = solve({ k, N, ordered, clues }, { limit: 2, maxNodes });
      if (kontrola.vycerpane || kontrola.count !== 1) return null;
      const drahy = solveHuman(z, { maxVrstva: '3' });
      if (drahy.solved && rovnake(drahy.solution, assign)) return { beh: drahy, l3: true };
      return null;
    };
    const minimalizuj = (clues) => {
      let beh = null, zmena = true;
      while (zmena) {
        zmena = false;
        for (const i of zamiesaj(rng, clues.length)) {
          if (i >= clues.length) continue;
          const bez = clues.filter((_, u) => u !== i);
          if (!bez.length) continue;
          const r = solve({ k, N, ordered, clues: bez }, { limit: 2, maxNodes });
          if (r.vycerpane || r.count !== 1) continue;
          const h = skus(bez);
          if (!h) continue;
          clues = bez;
          beh = h;
          zmena = true;
          break;
        }
      }
      return { clues, beh };
    };
    /* Oslabovanie: nahraď indíciu striktne slabšou pravdivou indíciou. Na
       challenge sa uprednostní to oslabenie, po ktorom zadanie bez vrstvy 3
       dokončiť nejde, lebo práve to je rozdiel medzi hard a challenge. */
    const oslabuj = (clues, kluce) => {
      let pocet = 0, beh = null;
      for (let i = 0; i < clues.length; i++) {
        const moznosti = zamiesajPole(rng, oslabenia(clues[i], N));
        let najlepsie = null;
        for (const nova of moznosti) {
          if (!legalna(nova, k, N, ordered)) continue;
          if (!pravdiva(nova, assign, k, N, ordered)) continue;
          if (pocetSlov(textIndicie(zad, nova)) > MAX_SLOV) continue;
          const kluc = klucIndicie(nova);
          if (kluce.has(kluc)) continue;
          const skusane = clues.slice();
          skusane[i] = nova;
          const h = skus(skusane);
          if (!h) continue;
          if (!najlepsie || (opts.vyzadujeL3 && h.l3 && !najlepsie.h.l3)) najlepsie = { nova, kluc, skusane, h };
          if (!opts.vyzadujeL3 || h.l3) break;
        }
        if (!najlepsie) continue;
        clues = najlepsie.skusane;
        kluce.add(najlepsie.kluc);
        beh = najlepsie.h;
        pocet++;
      }
      return { clues, beh, pocet };
    };

    // 1. Pridávaj pravdivé indície, kým riešiteľ nedorieši.
    let clues = [];
    const kluce = new Set();
    let pocetLink = 0;
    let beh = null;
    for (let pokus = 0; pokus < 400 && clues.length < stropIndicii; pokus++) {
      const typ = vyberTyp(rng, vahy, pocetLink, maxLink);
      if (!typ) break;
      const cl = nahodnaIndicia(rng, zad, assign, typ);
      if (!cl) continue;
      if (!legalna(cl, k, N, ordered)) continue;
      if (!pravdiva(cl, assign, k, N, ordered)) continue;
      const kluc = klucIndicie(cl);
      if (kluce.has(kluc)) continue;
      if (pocetSlov(textIndicie(zad, cl)) > MAX_SLOV) continue;
      // Musí nad terajšou množinou niečo odobrať.
      const zaklad = novyStav(k, N);
      if (!propaguj(zaklad, { k, N, ordered, clues })) break;
      if (!meniNiecoZ(zaklad, k, N, obmedzenia(zaklad, k, N, ordered, cl))) continue;
      clues.push(cl);
      kluce.add(kluc);
      if (cl.t === 'L') pocetLink++;
      beh = skus(clues);
      if (beh) break;
    }
    if (!beh) continue;

    // 2. Minimalizácia: zamiešaj, skúšobne odober, odobratie nechaj, len ak
    //    riešiteľ stále dobehne a solve stále vráti presne jedno.
    let vysledok = minimalizuj(clues);
    clues = vysledok.clues;
    if (vysledok.beh) beh = vysledok.beh;

    // 3. Oslabovanie a po ňom znovu minimalizácia, lebo oslabenie niekedy
    //    urobí inú indíciu nadbytočnou. Na challenge sa kolo zopakuje, kým
    //    zadanie nezačne vyžadovať vrstvu 3, najviac trikrát.
    let oslabene = 0;
    const kol = opts.vyzadujeL3 ? 3 : 1;
    for (let kolo = 0; kolo < kol; kolo++) {
      const o1 = oslabuj(clues, kluce);
      clues = o1.clues;
      oslabene += o1.pocet;
      if (o1.beh) beh = o1.beh;
      const m2 = minimalizuj(clues);
      clues = m2.clues;
      if (m2.beh) beh = m2.beh;
      if (!opts.vyzadujeL3 || (beh && beh.l3)) break;
    }
    if (opts.vyzadujeL3 && !(beh && beh.l3)) continue;

    if (clues.length > strop) continue;

    // 5. Poradie indícií je zamiešané seedom, ale prvé dve sú priamo použiteľné.
    clues = zamiesajPole(rng, clues.slice());
    const hnedPouzitelna = (cl) => {
      const P = novyStav(k, N);
      return meniNiecoZ(P, k, N, obmedzenia(P, k, N, ordered, cl));
    };
    // Vrstva 1 je to, čo hráč vie použiť bez rozmýšľania o poradí, preto sa na
    // prvé dve miesta hľadá najprv indícia vrstvy 1 a až potom hociktorá, ktorá
    // na prázdnej ploche niečo urobí.
    const vrstvaJedna = (cl) => cl.t === 'L' || cl.t === 'X' || cl.t === 'D' || (cl.t === 'E' && pocetBitov(cl.s) === 2);
    for (let poz = 0; poz < Math.min(2, clues.length); poz++) {
      if (vrstvaJedna(clues[poz]) && hnedPouzitelna(clues[poz])) continue;
      let kam = -1;
      for (let j = poz + 1; j < clues.length; j++) if (vrstvaJedna(clues[j]) && hnedPouzitelna(clues[j])) { kam = j; break; }
      if (kam < 0 && !hnedPouzitelna(clues[poz])) {
        for (let j = poz + 1; j < clues.length; j++) if (hnedPouzitelna(clues[j])) { kam = j; break; }
      }
      if (kam >= 0) { const t = clues[poz]; clues[poz] = clues[kam]; clues[kam] = t; }
    }
    zad.clues = clues;

    // 6. Záverečná kontrola: riešiteľ dobehne v rámci dovolenej vrstvy, žiadna
    //    mŕtva indícia, filtre kvality, a nezávislá krížová kontrola.
    const fin = solveHuman(zad, { maxVrstva });
    if (!fin.solved || !rovnake(fin.solution, assign)) continue;
    if (fin.pouziteIndicie.size !== clues.length) continue;
    if (opts.vyzadujeL3 && fin.layersUsed['3'] === 0) continue;
    const zleKvalita = filtreKvality(zad, fin);
    if (zleKvalita) continue;
    let dlha = false;
    for (const cl of clues) if (pocetSlov(textIndicie(zad, cl)) > MAX_SLOV) dlha = true;
    if (dlha) continue;
    const r = solve(zad, { limit: 2, maxNodes });
    if (r.vycerpane || r.count !== 1) continue;
    if (!rovnake(r.solution, assign)) {
      throw new Error('solve found a different match than the source for ' + name);
    }

    // 7. Záverečná otázka: jedna zásoba zmizla zo spoločnej špajze.
    const question = { what: assign[1][Math.floor(rng() * N)] };

    let minimalne = null;
    if (opts.meraMinimalitu) {
      minimalne = true;
      for (let i = 0; i < clues.length; i++) {
        const bez = clues.filter((_, u) => u !== i);
        const rr = solve({ k, N, ordered, clues: bez }, { limit: 2, maxNodes });
        if (rr.vycerpane || rr.count < 2) { minimalne = false; break; }
      }
    }

    zad.question = question;
    zad.seed = seed;
    zad.attempts = attempt;
    zad.difficulty = {
      layers: fin.layersUsed,
      clues: clues.length,
      weakened: oslabene,
      steps: fin.steps.length,
      minimalnePreJednoznacnost: minimalne,
    };
    zad.ms = Math.round((nowMs() - t0) * 10) / 10;
    return zad;
  }
  throw new Error('No unique, guess-free puzzle for ' + name + ' in ' + maxAttempts + ' attempts');
}
