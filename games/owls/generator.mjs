/* Owls: generator and solver for the daily tree of day and night owls.
 *
 * One file, no dependencies, runs the same in Node and in the browser
 * (game.js imports it as a module, tests.mjs too). Everything is
 * deterministic: a date turns into a number, the number into a sequence of
 * random values, the sequence into a puzzle. The same date gives the same
 * tree on every machine, so the server never computes or stores anything.
 *
 * Rules of the game (our own wording): a tree of n x n branches, n even.
 * Every branch holds one owl, and every owl keeps the day or the night.
 *   1. every row and every column has as many day owls as night owls,
 *   2. no three owls of the same kind sit side by side in a row or a column,
 *   3. no two rows are alike, and no two columns are alike.
 * Some owls are on the tree from the start (the givens); the rest is worked
 * out, and exactly one tree fits.
 *
 * Representation. `givens` is a flat n*n array: null for an empty branch, 0 a
 * day owl, 1 a night owl. `solution` is a flat n*n array of 0 and 1. Inside
 * the solver a line (a row or a column) is a bit mask, bit k set when the owl
 * at place k keeps the night, and the board is one state:
 *   g   Int8Array n*n, -1 not decided, 0 day, 1 night,
 *   km  per line, the mask of places that are decided,
 *   kv  per line, the mask of places decided as night.
 * Lines are numbered 0..n-1 for the rows and n..2n-1 for the columns, and the
 * masks are kept up to date whenever a branch is decided, never recomputed.
 * Everything else stands on platneRiadky(n), the list of every line that is
 * balanced and has no three alike side by side (208 of them at n = 12): the
 * lines that can still fill a line are the ones with (r & km) === kv, minus
 * the copies of finished parallel lines (rule 3).
 *
 * Generation (generateSeeded):
 *   1. a random finished tree, row by row from a shuffled list of valid rows,
 *      pruned by the columns (never more than n/2 of a kind, never three alike
 *      down a column) and by rule 3,
 *   2. minimisation: start with every owl given and, in random order, take
 *      each one away when the tree is still solvable by the human rules up to
 *      the level's highest layer (a fixpoint check, not step by step). The
 *      Sunday level goes twice: first with layers 1 and 2 only (cheap), then
 *      once more over the owls that are left with layer 3 allowed,
 *   3. acceptance: solveHuman finishes the tree with no trial chain longer
 *      than MAX_RETAZ steps, solve(limit 2) finds exactly one tree and it is
 *      the one we started from (a mismatch throws), and the first step on the
 *      empty tree is a layer 1 step. Otherwise the next attempt, at most
 *      maxAttempts, then an exception.
 * Every rule of the human solver is a forced conclusion from the three rules,
 * never a choice, so when solveHuman fills the whole tree no other tree can
 * exist. solve(limit 2) is an independent check that the rules are sound, not
 * a second proof.
 *
 * The human solver (solveHuman) works in three layers and always takes the
 * first step it finds, lowest layer first; inside a layer in the order of the
 * rules below, rows before columns, top to bottom and left to right (a trial
 * is the exception: the shortest one wins, reading order breaks ties):
 *   layer 1  pair  two alike side by side: both ends take the other kind,
 *            gap   two alike with one empty branch between: it takes the
 *                  other kind,
 *            full  a line with all n/2 owls of one kind: the rest is the
 *                  other kind,
 *   layer 2  line  every way to finish the line (balanced, no three alike)
 *                  agrees on a branch,
 *            twin  the same once the ways that copy a finished parallel line
 *                  are dropped (rule 3),
 *   layer 3  trial put one kind on a branch, follow layers 1 and 2, and when
 *                  that breaks a rule, the branch takes the other kind. Of
 *                  all trials that work, the one with the shortest chain
 *                  (see "Layer 3" below), never longer than MAX_RETAZ steps
 *                  on a published tree.
 * Every step carries two English sentences: textBezHodnoty says where to look
 * and which technique, never which kind of owl (the first press of Hint), and
 * text explains it in full (the second press).
 *
 * Difficulty, returned as `difficulty`: layers [l1, l2, l3], how many steps
 * came from each layer, steps in all, and the number of givens.
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

/* ── Bits ─────────────────────────────────────────────────────────────── */
function pop(x) {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24;
}
/* Three set bits side by side anywhere in x. */
function maTrojicu(x) { return (x & (x >>> 1) & (x >>> 2)) !== 0; }
/* Index of the lowest set bit. */
function najnizsi(x) { return 31 - Math.clz32(x & -x); }

/* ── Valid lines ──────────────────────────────────────────────────────── */
const RIADKY = new Map();
/* Every line of length n that is balanced (n/2 night owls) and has no three
   alike side by side, as bit masks in ascending order. Computed once per n. */
export function platneRiadky(n) {
  if (RIADKY.has(n)) return RIADKY.get(n);
  if (!Number.isInteger(n) || n < 2 || n > 16 || n % 2) throw new Error('The tree must have an even side from 2 to 16, got ' + n);
  const full = (1 << n) - 1;
  const out = [];
  for (let r = 0; r <= full; r++) {
    if (pop(r) !== n / 2) continue;
    if (maTrojicu(r) || maTrojicu(~r & full)) continue;
    out.push(r);
  }
  const R = Int32Array.from(out);
  RIADKY.set(n, R);
  return R;
}

/* ── Geometry ─────────────────────────────────────────────────────────── */
export function policko(i, n) { const r = (i / n) | 0; return { r, c: i - r * n }; }
/* The flat index of place k on line L (rows 0..n-1, columns n..2n-1). */
export function bunkaLinie(L, k, n) { return L < n ? L * n + k : k * n + (L - n); }
/* The two lines through cell i: its row and its column. */
export function linieBunky(i, n) { const r = (i / n) | 0; return [r, n + (i - r * n)]; }
/* "row 3" or "column 5", counted from 1. */
export function nazovLinie(L, n) { return L < n ? 'row ' + (L + 1) : 'column ' + (L - n + 1); }
const velke = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ── The rules on a finished board ────────────────────────────────────── */
/* Every rule a full board breaks, in plain words; an empty list means the
   board is a finished tree. g is flat, 0 day and 1 night; anything else in a
   cell (null, -1) counts as an empty branch. Written from the rules, not from
   the solver, so tests and rozbal can lean on it. */
export function porusenia(g, n) {
  const out = [];
  const full = (1 << n) - 1;
  const masky = new Int32Array(2 * n);
  for (let L = 0; L < 2 * n; L++) {
    let m = 0;
    for (let k = 0; k < n; k++) {
      const x = g[bunkaLinie(L, k, n)];
      if (x !== 0 && x !== 1) { out.push(velke(nazovLinie(L, n)) + ' has an empty branch'); m = -1; break; }
      if (x === 1) m |= 1 << k;
    }
    masky[L] = m;
    if (m < 0) continue;
    if (pop(m) !== n / 2) out.push(velke(nazovLinie(L, n)) + ' is not balanced');
    if (maTrojicu(m) || maTrojicu(~m & full)) out.push(velke(nazovLinie(L, n)) + ' has three alike side by side');
  }
  for (const zac of [0, n]) {
    for (let a = zac; a < zac + n; a++) {
      for (let b = a + 1; b < zac + n; b++) {
        if (masky[a] >= 0 && masky[a] === masky[b]) out.push(velke(nazovLinie(a, n)) + ' and ' + nazovLinie(b, n) + ' are twins');
      }
    }
  }
  return out;
}

/* ── Solver state ─────────────────────────────────────────────────────── */
function novyStav(n) {
  return {
    n, pol: n / 2, full: (1 << n) - 1, R: platneRiadky(n),
    g: new Int8Array(n * n).fill(-1), km: new Int32Array(2 * n), kv: new Int32Array(2 * n),
    spor: -1,
  };
}
function kopia(s) {
  return { n: s.n, pol: s.pol, full: s.full, R: s.R, g: s.g.slice(), km: s.km.slice(), kv: s.kv.slice(), spor: -1 };
}
/* Decide cell i as v (0 day, 1 night). The cell must still be open. */
function nastav(s, i, v) {
  const n = s.n, r = (i / n) | 0, c = i - r * n;
  s.g[i] = v;
  s.km[r] |= 1 << c;
  s.km[n + c] |= 1 << r;
  if (v) { s.kv[r] |= 1 << c; s.kv[n + c] |= 1 << r; }
}
/* A state from the givens (null or -1 open, 0 day, 1 night) and, if there is
   one, the player's board (0 empty, 1 day owl, 2 night owl). */
function stavZ(givens, n, initial) {
  const s = novyStav(n);
  for (let i = 0; i < n * n; i++) {
    const x = givens[i];
    if (x === 0 || x === 1) nastav(s, i, x);
    else if (initial && (initial[i] === 1 || initial[i] === 2)) nastav(s, i, initial[i] - 1);
  }
  return s;
}
function jeHotovy(s) {
  for (let L = 0; L < s.n; L++) if (s.km[L] !== s.full) return false;
  return true;
}

/* Candidates of line L: the valid lines that agree with what is decided and,
   with dvojcata, are not a copy of a finished parallel line. The answer lands
   in ROZ so the hot loop does not allocate: pocet (how many), a (AND of them,
   the places that are night in every one), o (OR, the places night in at
   least one) and z (1 when dvojcata set aside at least one finished parallel
   line that this one could still have copied, else 0). */
const ROZ = { pocet: 0, a: 0, o: 0, z: 0 };
function rozbor(s, L, dvojcata) {
  const n = s.n, km = s.km[L], kv = s.kv[L], R = s.R;
  let z0 = -1, z1 = -1, z2 = -1, zaklad = null;
  if (dvojcata) {
    const zac = L < n ? 0 : n;
    let pocetZ = 0;
    for (let M = zac; M < zac + n; M++) {
      if (M === L || s.km[M] !== s.full) continue;
      const x = s.kv[M];
      if ((x & km) !== kv) continue;          // cannot become this one anyway
      if (pocetZ === 0) z0 = x; else if (pocetZ === 1) z1 = x; else if (pocetZ === 2) z2 = x;
      else { if (!zaklad) zaklad = [z0, z1, z2]; zaklad.push(x); }
      pocetZ++;
    }
  }
  let a = s.full, o = 0, pocet = 0;
  for (let j = 0; j < R.length; j++) {
    const r = R[j];
    if ((r & km) !== kv) continue;
    if (r === z0 || r === z1 || r === z2) continue;
    if (zaklad && zaklad.includes(r)) continue;
    a &= r; o |= r; pocet++;
  }
  ROZ.pocet = pocet; ROZ.a = a; ROZ.o = o; ROZ.z = z0 < 0 ? 0 : 1;
  return pocet;
}

/* Full line logic to a fixpoint: layers 1 and 2 together (they have the same
   closure, layer 1 is a special case of layer 2). Only lines that changed are
   looked at again. Returns false on a contradiction and leaves the line in
   s.spor. `zaciatok` lists the lines to start from (all when missing). */
function propaguj(s, zaciatok) {
  const n = s.n, full = s.full, n2 = 2 * n;
  const vo = new Uint8Array(n2);
  const q = [];
  const pridaj = (L) => { if (!vo[L]) { vo[L] = 1; q.push(L); } };
  const pridajRovnobezne = (L) => { const zac = L < n ? 0 : n; for (let M = zac; M < zac + n; M++) if (M !== L) pridaj(M); };
  if (zaciatok) for (const L of zaciatok) pridaj(L);
  else for (let L = 0; L < n2; L++) pridaj(L);
  while (q.length) {
    const L = q.pop();
    vo[L] = 0;
    const km = s.km[L];
    if (!rozbor(s, L, true)) { s.spor = L; return false; }
    if (km === full) continue;
    const noc = ROZ.a & ~km & full, den = ~ROZ.o & ~km & full;
    let bity = noc | den;
    if (!bity) continue;
    while (bity) {
      const k = najnizsi(bity);
      bity &= bity - 1;
      const i = bunkaLinie(L, k, n);
      nastav(s, i, (noc >>> k) & 1);
      const P = L < n ? n + k : k;
      pridaj(P);
      if (s.km[P] === full) pridajRovnobezne(P);
    }
    if (s.km[L] === full) pridajRovnobezne(L);
  }
  return true;
}
/* The lines to look at after cell i was decided by hand. */
function linieZmeny(s, i) {
  const [r, c] = linieBunky(i, s.n);
  const out = [r, c];
  const zac = (L) => (L < s.n ? 0 : s.n);
  for (const L of [r, c]) {
    if (s.km[L] !== s.full) continue;
    for (let M = zac(L); M < zac(L) + s.n; M++) if (M !== L && !out.includes(M)) out.push(M);
  }
  return out;
}

/* Layer 1 alone, to a fixpoint, with bit tricks. The three layer 1 rules on a
   line of known day places D and night places N:
     pair  D & (D >>> 1) marks a pair at k, k+1; its ends are k-1 and k+2,
     gap   D & (D >>> 2) marks k and k+2; the gap is k+1,
     full  pop(D) === n/2 closes the line.
   Returns false when a branch would have to be both (only on a wrong board). */
function l1Linia(s, L) {
  const km = s.km[L], kv = s.kv[L], full = s.full;
  const volne = ~km & full;
  const N = kv, D = km & ~kv;
  const pN = N & (N >>> 1), pD = D & (D >>> 1);
  const gN = N & (N >>> 2), gD = D & (D >>> 2);
  let den = (((pN >>> 1) | (pN << 2)) | (gN << 1)) & volne;
  let noc = (((pD >>> 1) | (pD << 2)) | (gD << 1)) & volne;
  if (pop(N) === s.pol) den |= volne;
  if (pop(D) === s.pol) noc |= volne;
  ROZ.a = noc; ROZ.o = den;
  return !(den & noc);
}
function propaguj1(s) {
  const n = s.n, n2 = 2 * n;
  for (let zmena = true; zmena;) {
    zmena = false;
    for (let L = 0; L < n2; L++) {
      if (!l1Linia(s, L)) { s.spor = L; return false; }
      const noc = ROZ.a, den = ROZ.o;
      let bity = noc | den;
      while (bity) {
        const k = najnizsi(bity);
        bity &= bity - 1;
        const i = bunkaLinie(L, k, n);
        if (s.g[i] < 0) { nastav(s, i, (noc >>> k) & 1); zmena = true; }
      }
    }
  }
  return true;
}

/* ── Layer 3: a trial ─────────────────────────────────────────────────── *
 * Put v on cell i and follow layers 1 and 2; when a line breaks, the branch
 * takes the other kind.
 *
 * How long a trial is. Following a trial is only reasoning, not guessing, if
 * a person can hold the chain in their head, so every trial is measured the
 * way a person follows it (retaz): from the supposed owl, read the lines it
 * touched, one line at a time and the nearest first, with layers 1 and 2,
 * until one line has no way left to be finished. Each step remembers the line
 * it read, what that line held at that moment and, when the twin rule was
 * needed, the finished lines it compared with. From the broken line we walk
 * back through those records and count only the steps the break rests on:
 * the chain. Steps the queue happened to take elsewhere are not counted,
 * because nobody following the chain would take them. The count is
 * cautious: a step is charged with every owl its line held, not only the
 * ones it really needed.
 *
 * A published tree never needs a trial longer than MAX_RETAZ steps (a review
 * on 25. 9. 2026 found Sunday trials that took 17 steps on average and up to
 * 48 before anything broke, which is a guess in disguise). Among the trials
 * that work, the shortest one is taken, and among equally short ones the
 * first in reading order: cells row by row, the day owl before the night owl.
 * The minimisation, solveHuman and Hint all pick the same way, so the tree
 * the generator accepts is the tree solveHuman walks through. */
export const MAX_RETAZ = 6;

/* Follows a trial. A trial that breaks nothing proves every branch it
   decided (trying any of those the same way can only reach a part of the same
   board), and `vylucene` collects them (index 2*i + v) so they are skipped:
   that never changes which trial wins, only how soon it is found. Returns
   null when nothing breaks, otherwise { i, v, t, spor, dlzka, prvy, cela }:
   the broken board, the line where it broke, the number of steps in the
   chain, the first of them and all of them in order, each { line, maska,
   dvojcata, cells, vals } (prvy is null and cela empty for a chain of no
   steps). */
function retaz(s, i, v, vylucene) {
  const n = s.n, full = s.full;
  const t = kopia(s);
  const odKroku = new Int16Array(n * n).fill(-1);   // the step that decided a branch; -1 before it
  const kroky = [];
  const q = [];
  let hlava = 0;
  const vo = new Uint8Array(2 * n);
  const pridaj = (L) => { if (!vo[L]) { vo[L] = 1; q.push(L); } };
  const pridajRovnobezne = (L) => { const zac = L < n ? 0 : n; for (let M = zac; M < zac + n; M++) if (M !== L) pridaj(M); };
  const poloz = (c, x, krok) => {
    nastav(t, c, x);
    odKroku[c] = krok;
    const r = (c / n) | 0, st = n + c - r * n;
    pridaj(r); if (t.km[r] === full) pridajRovnobezne(r);
    pridaj(st); if (t.km[st] === full) pridajRovnobezne(st);
  };
  poloz(i, v, -1);   // the supposed owl is where the chain starts, not a step
  while (hlava < q.length) {
    const L = q[hlava++];
    vo[L] = 0;
    const km = t.km[L];
    const pocet = rozbor(t, L, true);
    const noc = ROZ.a & ~km & full, den = ~ROZ.o & ~km & full, z = ROZ.z;
    if (!pocet) {
      // the twin rule broke it when the line could still be finished without it
      const dvojcata = z && rozbor(t, L, false) ? hotoveRovnobezne(t, L) : null;
      t.spor = L;
      return { i, v, ...kuzel(t, L, km, dvojcata, odKroku, kroky) };
    }
    if (km === full || !(noc | den)) continue;
    let dvojcata = null;
    if (z) {
      rozbor(t, L, false);
      if (((ROZ.a & ~km & full) | (~ROZ.o & ~km & full)) !== (noc | den)) dvojcata = hotoveRovnobezne(t, L);
    }
    const krok = kroky.length;
    const cells = [], vals = [];
    kroky.push({ line: L, maska: km, dvojcata, cells, vals });
    let bity = noc | den;
    while (bity) {
      const k = najnizsi(bity);
      bity &= bity - 1;
      const c = bunkaLinie(L, k, n), x = (noc >>> k) & 1;
      cells.push(c); vals.push(x);
      poloz(c, x, krok);
    }
  }
  if (vylucene) {
    for (let j = 0; j < t.g.length; j++) if (s.g[j] < 0 && t.g[j] >= 0) vylucene[2 * j + t.g[j]] = 1;
  }
  return null;
}
/* The finished lines parallel to L that L still matches on every owl it has:
   the ones the twin rule compares it with. */
function hotoveRovnobezne(t, L) {
  const n = t.n, zac = L < n ? 0 : n, out = [];
  for (let M = zac; M < zac + n; M++) {
    if (M !== L && t.km[M] === t.full && (t.kv[M] & t.km[L]) === t.kv[L]) out.push(M);
  }
  return out;
}
/* Walks back from the broken line M (which held `maska` when it broke) to the
   steps it rests on, and counts them. */
function kuzel(t, M, maska, dvojcata, odKroku, kroky) {
  const n = t.n;
  const treba = new Uint8Array(kroky.length);
  const zasobnik = [];
  const citaj = (L, m) => {
    while (m) {
      const k = najnizsi(m);
      m &= m - 1;
      const j = odKroku[bunkaLinie(L, k, n)];
      if (j >= 0 && !treba[j]) { treba[j] = 1; zasobnik.push(j); }
    }
  };
  const citajKrok = (L, m, dv) => { citaj(L, m); if (dv) for (const P of dv) citaj(P, t.full); };
  citajKrok(M, maska, dvojcata);
  while (zasobnik.length) { const k = kroky[zasobnik.pop()]; citajKrok(k.line, k.maska, k.dvojcata); }
  // The chain in the order it was read: a step only rests on steps before it,
  // so the player can follow it from the first to the last.
  const cela = [];
  for (let j = 0; j < kroky.length; j++) if (treba[j]) cela.push(kroky[j]);
  return { t, spor: M, dlzka: cela.length, prvy: cela[0] || null, cela };
}
/* The trial a person would pick (see above), with a chain of at most
   maxDlzka steps. Returns the result of retaz, or null. */
function najkratsiaSkuska(s, maxDlzka = Infinity) {
  const vylucene = new Uint8Array(2 * s.g.length);
  let naj = null;
  for (let i = 0; i < s.g.length; i++) {
    if (s.g[i] >= 0) continue;
    for (let v = 0; v < 2; v++) {
      if (vylucene[2 * i + v]) continue;
      const r = retaz(s, i, v, vylucene);
      if (!r || r.dlzka > maxDlzka) continue;
      if (!naj || r.dlzka < naj.dlzka) {
        naj = r;
        if (r.dlzka === 0) return naj;
      }
    }
  }
  return naj;
}

/* Is the tree finished by the human rules up to layer maxVrstva? A fixpoint
   check without any step records, for the minimisation; it walks the same
   path as solveHuman with maxRetaz MAX_RETAZ (layers 1 and 2 to their
   fixpoint, then the same trial). s is changed. */
function riesitelnyStav(s, maxVrstva) {
  if (maxVrstva <= 1) return propaguj1(s) && jeHotovy(s);
  if (!propaguj(s)) return false;
  while (!jeHotovy(s)) {
    if (maxVrstva < 3) return false;
    const t = najkratsiaSkuska(s, MAX_RETAZ);
    if (!t) return false;
    nastav(s, t.i, 1 - t.v);
    if (!propaguj(s, linieZmeny(s, t.i))) return false;
  }
  return true;
}
export function riesitelne(givens, n, maxVrstva = 3) {
  return riesitelnyStav(stavZ(givens, n), maxVrstva);
}

/* ── solve: how many trees fit ────────────────────────────────────────── *
 * Depth first with full line logic at every node, branching on the first open
 * branch of the open line with the fewest ways left. Stops at `limit`
 * solutions; `maxNodes` bounds the search, and running out of it is reported
 * as vycerpane rather than a guess. */
export function solve(givens, n, opts = {}) {
  const limit = opts.limit ?? 2;
  const maxNodes = opts.maxNodes ?? 20000;
  const riesenia = [];
  let uzly = 0, vycerpane = false;
  const rek = (s, linie) => {
    if (riesenia.length >= limit || vycerpane) return;
    if (++uzly > maxNodes) { vycerpane = true; return; }
    if (!propaguj(s, linie)) return;
    let naj = -1, najPocet = Infinity;
    for (let L = 0; L < 2 * n; L++) {
      if (s.km[L] === s.full) continue;
      const p = rozbor(s, L, true);
      if (p < najPocet) { najPocet = p; naj = L; }
    }
    if (naj < 0) { riesenia.push(Array.from(s.g)); return; }
    const i = bunkaLinie(naj, najnizsi(~s.km[naj] & s.full), n);
    for (let v = 0; v < 2; v++) {
      const t = kopia(s);
      nastav(t, i, v);
      rek(t, linieZmeny(t, i));
      if (riesenia.length >= limit || vycerpane) return;
    }
  };
  rek(stavZ(givens, n), null);
  return { count: riesenia.length, solution: riesenia[0] || null, riesenia, vycerpane, uzly };
}

/* ── Words ────────────────────────────────────────────────────────────── */
const DRUH = ['day', 'night'];
const SLOVA = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const slovom = (k) => (k < SLOVA.length ? SLOVA[k] : String(k));
function sovy(pocet, druh) { return SLOVA[pocet] + ' ' + DRUH[druh] + (pocet === 1 ? ' owl' : ' owls'); }
function zoznamSlov(a) {
  if (a.length <= 1) return a.join('');
  if (a.length === 2) return a[0] + ' or ' + a[1];
  return a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1];
}
/* What a step puts on the branches it marks, as the end of a sentence. */
function coDava(vals) {
  const x = vals[0];
  if (vals.every((v) => v === x)) return vals.length === 1 ? 'puts a ' + DRUH[x] + ' owl on the marked branch' : 'puts ' + DRUH[x] + ' owls on the marked branches';
  return 'places the owls on the marked branches the same way';
}
function typLinie(L, n) { return L < n ? 'row' : 'column'; }

/* Why a board broke, read from the line where the contradiction showed. */
function popisSporu(t, M) {
  const n = t.n, km = t.km[M], kv = t.kv[M], full = t.full;
  const N = kv, D = km & ~kv;
  const meno = nazovLinie(M, n);
  if (maTrojicu(D)) return { druh: 'trojica', veta: meno + ' would get three day owls side by side' };
  if (maTrojicu(N)) return { druh: 'trojica', veta: meno + ' would get three night owls side by side' };
  if (pop(D) > t.pol) return { druh: 'vela', veta: meno + ' would get more than ' + SLOVA[t.pol] + ' day owls' };
  if (pop(N) > t.pol) return { druh: 'vela', veta: meno + ' would get more than ' + SLOVA[t.pol] + ' night owls' };
  if (km === full) {
    const zac = M < n ? 0 : n;
    for (let P = zac; P < zac + n; P++) {
      if (P !== M && t.km[P] === full && t.kv[P] === kv) return { druh: 'kopia', veta: meno + ' would become a copy of ' + nazovLinie(P, n) };
    }
  }
  if (!rozbor(t, M, false)) return { druh: 'trojica', veta: meno + ' could not be finished without three owls alike side by side' };
  // name the finished lines it would copy, so the player can compare them
  const dvojcata = hotoveRovnobezne(t, M);
  return { druh: 'kopia', veta: meno + ' could only be finished as a copy of ' + (dvojcata.length ? dvojcata.map((P) => nazovLinie(P, n)).join(' or ') : 'a finished ' + typLinie(M, n)) };
}

/* ── The steps a person takes ─────────────────────────────────────────── */
function krokVrstvy1(s) {
  const n = s.n, full = s.full;
  // pair: the first pair, anywhere, that still has an open end
  for (let L = 0; L < 2 * n; L++) {
    const km = s.km[L], kv = s.kv[L];
    for (let k = 0; k + 1 < n; k++) {
      if (!((km >>> k) & 1) || !((km >>> (k + 1)) & 1)) continue;
      const a = (kv >>> k) & 1;
      if (((kv >>> (k + 1)) & 1) !== a) continue;
      const cells = [];
      for (const j of [k - 1, k + 2]) if (j >= 0 && j < n && !((km >>> j) & 1)) cells.push(bunkaLinie(L, j, n));
      if (!cells.length) continue;
      const Meno = velke(nazovLinie(L, n));
      const obe = cells.length === 2;
      return {
        rule: 'pair', layer: 1, line: L, cells, vals: cells.map(() => 1 - a), druh: a,
        textBezHodnoty: Meno + ': two owls of the same kind sit side by side. Look at ' + (obe ? 'both ends' : 'the open end') + ' of the pair.',
        text: Meno + ' has two ' + DRUH[a] + ' owls side by side, so ' + (obe ? 'the owls at both ends of the pair keep' : 'the owl at the open end of the pair keeps') + ' the ' + DRUH[1 - a] + '.',
      };
    }
  }
  // gap: two alike with one open branch between them
  for (let L = 0; L < 2 * n; L++) {
    const km = s.km[L], kv = s.kv[L];
    for (let k = 0; k + 2 < n; k++) {
      if (!((km >>> k) & 1) || !((km >>> (k + 2)) & 1) || ((km >>> (k + 1)) & 1)) continue;
      const a = (kv >>> k) & 1;
      if (((kv >>> (k + 2)) & 1) !== a) continue;
      const Meno = velke(nazovLinie(L, n));
      return {
        rule: 'gap', layer: 1, line: L, cells: [bunkaLinie(L, k + 1, n)], vals: [1 - a], druh: a,
        textBezHodnoty: Meno + ': one empty branch sits between two owls of the same kind.',
        text: Meno + ' has a ' + DRUH[a] + ' owl on each side of this branch, so the owl between them keeps the ' + DRUH[1 - a] + '.',
      };
    }
  }
  // full: a line that already has all its owls of one kind
  for (let L = 0; L < 2 * n; L++) {
    const km = s.km[L], kv = s.kv[L];
    if (km === full) continue;
    const noc = pop(kv), den = pop(km & ~kv);
    if (noc !== s.pol && den !== s.pol) continue;
    const x = den === s.pol ? 0 : 1;
    const cells = [];
    for (let k = 0; k < n; k++) if (!((km >>> k) & 1)) cells.push(bunkaLinie(L, k, n));
    const Meno = velke(nazovLinie(L, n));
    return {
      rule: 'full', layer: 1, line: L, cells, vals: cells.map(() => 1 - x), druh: x,
      textBezHodnoty: Meno + ' already holds every owl of one kind it can take.',
      text: Meno + ' already has its ' + SLOVA[s.pol] + ' ' + DRUH[x] + ' owls, so ' + (cells.length === 1 ? 'the last open branch in it keeps' : 'every other owl in it keeps') + ' the ' + DRUH[1 - x] + '.',
    };
  }
  return null;
}

function krokVrstvy2(s) {
  const n = s.n, full = s.full;
  for (const dvojcata of [false, true]) {
    for (let L = 0; L < 2 * n; L++) {
      const km = s.km[L];
      if (km === full) continue;
      const pocet = rozbor(s, L, dvojcata);
      if (!pocet) return { rule: 'spor', layer: 2, line: L, cells: [], vals: [] };
      const noc = ROZ.a & ~km & full, den = ~ROZ.o & ~km & full;
      if (!(noc | den)) continue;
      const cells = [], vals = [];
      for (let k = 0; k < n; k++) {
        if ((noc >>> k) & 1) { cells.push(bunkaLinie(L, k, n)); vals.push(1); }
        else if ((den >>> k) & 1) { cells.push(bunkaLinie(L, k, n)); vals.push(0); }
      }
      const krok = { rule: dvojcata ? 'twin' : 'line', layer: 2, line: L, cells, vals };
      Object.assign(krok, dvojcata ? textyDvojcata(s, L, cells, vals, pocet) : textyLinie(s, L, cells, vals, pocet));
      return krok;
    }
  }
  return null;
}
function textyLinie(s, L, cells, vals, pocet) {
  const n = s.n, km = s.km[L], kv = s.kv[L];
  const Meno = velke(nazovLinie(L, n));
  const trebaDen = s.pol - pop(km & ~kv), trebaNoc = s.pol - pop(kv);
  if ((trebaDen === 1) !== (trebaNoc === 1)) {
    const x = trebaDen === 1 ? 0 : 1, y = 1 - x;
    const textBezHodnoty = Meno + ' needs just one more owl of one kind.';
    const uvod = Meno + ' needs just one more ' + DRUH[x] + ' owl.';
    if (vals.includes(x)) {
      return { textBezHodnoty, text: uvod + ' On any other branch it would leave three ' + DRUH[y] + ' owls side by side, so it goes on the marked branch where it fits and the rest of the ' + typLinie(L, n) + ' keeps the ' + DRUH[y] + '.' };
    }
    const jedna = cells.length === 1;
    return { textBezHodnoty, text: uvod + ' On ' + (jedna ? 'the marked branch' : 'any of the marked branches') + ' it would leave three ' + DRUH[y] + ' owls side by side, so ' + (jedna ? 'that branch keeps' : 'those branches keep') + ' the ' + DRUH[y] + '.' };
  }
  const potreby = trebaNoc >= trebaDen ? [sovy(trebaNoc, 1), sovy(trebaDen, 0)] : [sovy(trebaDen, 0), sovy(trebaNoc, 1)];
  return {
    textBezHodnoty: Meno + ': count what it still needs and try where those owls can go.',
    text: Meno + ' still needs ' + potreby[0] + ' and ' + potreby[1] + '. '
      + (pocet === 1 ? 'Only one way to place them avoids three alike side by side, and it ' : 'Every way to place them without three alike side by side ')
      + coDava(vals) + '.',
  };
}
function textyDvojcata(s, L, cells, vals, pocet) {
  const n = s.n, km = s.km[L], kv = s.kv[L];
  const Meno = velke(nazovLinie(L, n));
  const typ = typLinie(L, n);
  const zac = L < n ? 0 : n;
  const dvojcata = [];
  for (let M = zac; M < zac + n; M++) {
    if (M !== L && s.km[M] === s.full && (s.kv[M] & km) === kv) dvojcata.push(M);
  }
  const textBezHodnoty = Meno + ' is close to being a copy of a finished ' + typ + '. It must not become one.';
  const volnych = n - pop(km);
  if (volnych === 2 && dvojcata.length === 1 && cells.length === 2) {
    const ine = nazovLinie(dvojcata[0], n);
    return {
      textBezHodnoty,
      text: Meno + ' matches the finished ' + ine + ' on every owl it has so far. If its two empty branches went the same way as in ' + ine + ', the ' + typ + 's would be twins, so they go the other way round.',
    };
  }
  return {
    textBezHodnoty,
    text: Meno + ' must not end up a copy of ' + zoznamSlov(dvojcata.map((M) => nazovLinie(M, n))) + ', and '
      + (pocet === 1 ? 'the only way left to finish it ' : 'every other way to finish it ') + coDava(vals) + '.',
  };
}
/* One step of a trial's chain as the end of a sentence, "column 5 would need
   a day owl in row 4". A step that settles more than three branches is named
   by its line alone ("row 4 could then be finished in only one way"); Hint
   numbers its branches on the tree, so the player still sees which ones. A
   step that needed the twin rule says which finished lines it kept apart
   from. */
function popisKroku(s, k) {
  const n = s.n, L = k.line;
  const meno = nazovLinie(L, n)
    + (k.dvojcata && k.dvojcata.length ? ', kept unlike ' + k.dvojcata.map((M) => nazovLinie(M, n)).join(' and ') + ',' : '');
  const miesto = (c) => (L < n ? c % n + 1 : ((c / n) | 0) + 1);
  const druhMiesta = L < n ? 'column' : 'row';
  if (k.cells.length > 3) {
    const otvorenych = n - pop(k.maska);
    return otvorenych === k.cells.length ? meno + ' could then be finished in only one way' : meno + ' would settle ' + slovom(k.cells.length) + ' more branches';
  }
  const casti = [];
  for (const x of [0, 1]) {
    const kde = k.cells.filter((c, j) => k.vals[j] === x).map(miesto).sort((a, b) => a - b);
    if (!kde.length) continue;
    casti.push(kde.length === 1
      ? 'a ' + DRUH[x] + ' owl in ' + druhMiesta + ' ' + kde[0]
      : DRUH[x] + ' owls in ' + druhMiesta + 's ' + kde.slice(0, -1).join(', ') + ' and ' + kde[kde.length - 1]);
  }
  return meno + ' would need ' + casti.join(' and ');
}
/* How many steps of a chain Hint names one by one; a longer chain (only
   possible in a hint from a board the player filled in their own order)
   points to the numbers on the tree for the rest. */
const MENOVANYCH_KROKOV = MAX_RETAZ;
function krokVrstvy3(s, maxRetaz = Infinity) {
  const t = najkratsiaSkuska(s, maxRetaz);
  if (!t) return null;
  const { r, c } = policko(t.i, s.n);
  const spor = popisSporu(t.t, t.spor);
  const kde = 'row ' + (r + 1) + ', column ' + (c + 1);
  // The review of 25. 9. 2026 (round 2): "two steps further on" could not be
  // followed. Every step of the chain is now named in order, and Hint
  // numbers on the tree the branches each step would fill (retaz below).
  let cesta = '';
  t.cela.forEach((k, j) => {
    if (j < MENOVANYCH_KROKOV) cesta += 'Step ' + (j + 1) + ': ' + popisKroku(s, k) + '. ';
  });
  if (t.cela.length > MENOVANYCH_KROKOV) {
    cesta += 'Steps ' + (MENOVANYCH_KROKOV + 1) + ' to ' + t.cela.length + ' follow the numbers on the tree. ';
  }
  const kedy = t.dlzka === 0 ? 'something breaks at once' : 'something breaks within ' + slovom(t.dlzka) + (t.dlzka === 1 ? ' step' : ' steps');
  return {
    rule: 'trial', layer: 3, line: -1, cells: [t.i], vals: [1 - t.v], skusane: t.v, dlzka: t.dlzka, spor: { line: t.spor, druh: spor.druh },
    // the branches each step of the chain would fill, in order: Hint numbers
    // them 1, 2, 3 on the tree and outlines the line that breaks
    retaz: t.cela.map((k) => k.cells.slice()),
    textBezHodnoty: velke(kde) + ': try one kind of owl there and follow it; ' + kedy + '.',
    text: 'Suppose the owl in ' + kde + ' kept the ' + DRUH[t.v] + '. ' + cesta + 'Then ' + spor.veta + ', so this owl keeps the ' + DRUH[1 - t.v] + '.',
  };
}

/* ── solveHuman ───────────────────────────────────────────────────────── *
 * Steps like a person, always the easiest one first. Options:
 *   initial      the player's board (0 empty, 1 day owl, 2 night owl) to
 *                start from; only what is on it is used, nothing is judged,
 *   limitKrokov  stop after that many steps (Hint asks for one),
 *   maxVrstva    the highest layer allowed (1, 2 or 3),
 *   maxRetaz     the longest trial chain allowed (generateSeeded passes
 *                MAX_RETAZ; Hint passes nothing and takes the shortest trial
 *                there is, however long, so it never runs dry).
 * Returns { solved, solution, state, steps, layersUsed: [l1, l2, l3],
 * contradiction }. A step is { rule, layer, line, cells, vals, text,
 * textBezHodnoty }: line is the row or column it reads (-1 for a trial, which
 * is about one branch), cells the flat indices it decides and vals what goes
 * there (0 day, 1 night). A trial also carries dlzka, the steps in its chain,
 * retaz, the branches each of those steps would fill, and spor, the line
 * that breaks. */
export function solveHuman(givens, n, opts = {}) {
  const maxVrstva = opts.maxVrstva ?? 3;
  const limitKrokov = opts.limitKrokov ?? Infinity;
  const maxRetaz = opts.maxRetaz ?? Infinity;
  const s = stavZ(givens, n, opts.initial);
  const steps = [];
  const layersUsed = [0, 0, 0];
  // A board that already breaks a rule has no next step worth giving.
  for (let L = 0; L < 2 * n; L++) {
    if (!rozbor(s, L, true)) return { solved: false, solution: null, state: s.g, steps, layersUsed, contradiction: true };
  }
  while (steps.length < limitKrokov) {
    let k = krokVrstvy1(s);
    if (!k && maxVrstva >= 2) {
      k = krokVrstvy2(s);
      if (k && k.rule === 'spor') return { solved: false, solution: null, state: s.g, steps, layersUsed, contradiction: true };
    }
    if (!k && maxVrstva >= 3) k = krokVrstvy3(s, maxRetaz);
    if (!k) break;
    for (let j = 0; j < k.cells.length; j++) nastav(s, k.cells[j], k.vals[j]);
    steps.push(k);
    layersUsed[k.layer - 1]++;
  }
  const solved = jeHotovy(s);
  return { solved, solution: solved ? Array.from(s.g) : null, state: s.g, steps, layersUsed, contradiction: false };
}

/* ── A random finished tree ───────────────────────────────────────────── */
function zamiesaj(rng, pole) {
  const a = Array.from(pole);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
/* Row by row from the valid rows, in random order. A column may never hold
   more than n/2 of a kind or three alike one under another, and no row
   repeats; at the end the columns must all differ. The rows that the columns
   still allow are picked out with bit masks first and only those are
   shuffled, so a dead end costs little. Gives up after 200 000 steps (null). */
export function nahodneRiesenie(rng, n) {
  const R = platneRiadky(n), pol = n / 2, full = (1 << n) - 1;
  const riadky = new Int32Array(n);
  const noci = new Int8Array(n);
  let kroky = 0;
  const rek = (d) => {
    if (++kroky > 200000) return false;
    if (d === n) {
      const stlpce = new Set();
      for (let c = 0; c < n; c++) { let m = 0; for (let r = 0; r < n; r++) m |= ((riadky[r] >>> c) & 1) << r; stlpce.add(m); }
      return stlpce.size === n;
    }
    // columns that already have all their night owls take a day owl here,
    // and the other way round; where the two rows above agree, this row differs
    let lenDen = 0, lenNoc = 0;
    for (let c = 0; c < n; c++) {
      if (noci[c] === pol) lenDen |= 1 << c;
      else if (d - noci[c] === pol) lenNoc |= 1 << c;
    }
    const pred = d >= 1 ? riadky[d - 1] : 0;
    const zhoda = d >= 2 ? ~(riadky[d - 1] ^ riadky[d - 2]) & full : 0;
    const moznosti = [];
    for (let j = 0; j < R.length; j++) {
      const r = R[j];
      if ((r & lenDen) || (~r & lenNoc) || ((r ^ pred) & zhoda) !== zhoda) continue;
      let opak = false;
      for (let x = 0; x < d; x++) if (riadky[x] === r) { opak = true; break; }
      if (!opak) moznosti.push(r);
    }
    for (let i = moznosti.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = moznosti[i]; moznosti[i] = moznosti[j]; moznosti[j] = t;
    }
    for (const r of moznosti) {
      riadky[d] = r;
      for (let c = 0; c < n; c++) noci[c] += (r >>> c) & 1;
      if (rek(d + 1)) return true;
      for (let c = 0; c < n; c++) noci[c] -= (r >>> c) & 1;
      if (kroky > 200000) return false;
    }
    return false;
  };
  if (!rek(0)) return null;
  const g = new Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) g[r * n + c] = (riadky[r] >>> c) & 1;
  return g;
}

function rovnake(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/* ── generate / generateSeeded ────────────────────────────────────────── */
export function generate(dateStr, opts = {}) {
  if (!isValidDate(dateStr)) throw new Error('Date must be in YYYY-MM-DD form: ' + dateStr);
  const n = opts.n ?? 8;
  return generateSeeded(dateStr, dateStr + '/' + n, opts);
}

/* One tree from a seed key. `name` is what goes into `date` (a date or a
   practice id); `key` is what seeds the random numbers. Options: n (even,
   default 8), maxVrstva (1, 2 or 3, default 3), maxAttempts (200), maxNodes
   for the uniqueness check (20 000). */
export function generateSeeded(name, key, opts = {}) {
  const n = opts.n ?? 8;
  const maxVrstva = opts.maxVrstva ?? 3;
  const maxAttempts = opts.maxAttempts ?? 200;
  const maxNodes = opts.maxNodes ?? 20000;
  const C = n * n;
  const t0 = nowMs();
  const seed = seedFromString(key);
  const rng = mulberry32(seed);
  const faza1 = Math.min(maxVrstva, 2);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const sol = nahodneRiesenie(rng, n);
    if (!sol) continue;
    const given = Int8Array.from(sol);
    const poradie = zamiesaj(rng, Array.from({ length: C }, (_, i) => i));
    for (const i of poradie) {
      const v = given[i];
      given[i] = -1;
      if (!riesitelnyStav(stavZ(given, n), faza1)) given[i] = v;
    }
    if (maxVrstva >= 3) {
      for (const i of poradie) {
        if (given[i] < 0) continue;
        const v = given[i];
        given[i] = -1;
        if (!riesitelnyStav(stavZ(given, n), 3)) given[i] = v;
      }
    }
    const givens = Array.from(given, (x) => (x < 0 ? null : x));
    const hu = solveHuman(givens, n, { maxVrstva, maxRetaz: MAX_RETAZ });
    if (!hu.solved || !hu.steps.length) continue;
    const r = solve(givens, n, { limit: 2, maxNodes });
    if (r.vycerpane || r.count !== 1) continue;
    if (!rovnake(r.solution, sol)) throw new Error('The solver found a different tree than the source for ' + name);
    if (!rovnake(hu.solution, sol)) throw new Error('solveHuman settled on a different tree than the source for ' + name);
    if (hu.steps[0].layer !== 1) continue;
    let pocet = 0;
    for (const x of givens) if (x != null) pocet++;
    return {
      date: name, n, givens, solution: sol, seed, attempts: attempt,
      difficulty: { layers: hu.layersUsed.slice(), steps: hu.steps.length, givens: pocet },
      ms: Math.round((nowMs() - t0) * 10) / 10,
    };
  }
  throw new Error('No unique, guess-free tree for ' + name + ' in ' + maxAttempts + ' attempts');
}
