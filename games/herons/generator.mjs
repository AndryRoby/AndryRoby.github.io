/* Herons: generator and solver for the daily marsh path puzzle.
 *
 * One file, no dependencies, runs the same in Node and in the browser
 * (game.js imports it as a module, tests.mjs too). Everything is
 * deterministic: a date turns into a number, the number into a sequence of
 * random values, the sequence into a puzzle. The same date gives the same
 * puzzle on every machine, so the server never has to compute or store
 * anything.
 *
 * Rules of the game (our own wording): a marsh of n x n cells holds pairs of
 * nests, two nests to a pair, each pair with its own number. Draw a flight
 * path between the two nests of every pair. A path runs from cell to cell up,
 * down, left or right, no path crosses another, no path ever runs beside
 * itself, and every cell of the marsh is used by exactly one path.
 *
 * Representation:
 *   ends      flat n*n array, 0 for an empty cell, k for a nest of pair k.
 *   solution  flat n*n array, the number of the path that uses each cell.
 * Inside the solver the puzzle lives on the links between neighbouring cells
 * (the same geometry the loop games use): h[r*(n-1)+c] joins (r, c) and
 * (r, c+1), v[r*n+c] joins (r, c) and (r+1, c). Both live in one Uint8Array
 * `st` of length E = 2n(n-1), the horizontal links first; 0 unknown, 1 a link
 * (the path runs from one cell into the other), 2 crossed (it does not).
 * Directions are always 0 up, 1 right, 2 down, 3 left.
 *
 * Why links and not cells: every cell of the marsh belongs to exactly one
 * path, so a nest has exactly one link and every other cell exactly two. That
 * one sentence carries most of the reasoning, for the solver and for a person
 * with a pencil alike.
 *
 * Generation (generateSeeded):
 *   1. cut the whole marsh into K simple paths: start with every cell as a
 *      path of its own and keep joining two paths at their ends as long as
 *      the joined path stays simple (no cell of a path is beside another cell
 *      of the same path except the one before and the one after it). When no
 *      join is left and there are still too many paths, drop one or two links
 *      again and carry on joining. That partial restart is the only thing
 *      added to the plain "start again" of the specification, and it is what
 *      makes an 8 x 8 marsh take under a millisecond instead of a third of a
 *      second,
 *   2. the ends of the paths are the nests,
 *   3. take clues away: keep joining two paths into one (two nests fewer)
 *      while the puzzle can still be finished by the human rules alone and
 *      the number of pairs stays inside the range for that size,
 *   4. check the finished puzzle once more with solve(),
 *   5. if a marsh fails, try another one, up to `maxAttempts`.
 * A guess free chain of deductions is also a proof that the puzzle has just
 * one solution, and solve() checks that independently in the tests.
 *
 * Difficulty, returned as `difficulty`:
 *   layers  how many steps the human solver needed from each layer of rules
 *           (1 local, 2 which path can reach where, 3 trials),
 *   pairs   how many pairs of nests are left on the board,
 *   steps   the total number of steps.
 * plan.mjs ranks candidates by layer 3 first, then layer 2.
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

/* ── Geometria mriežky ───────────────────────────────────────────────── *
 * Pre každé n raz spočítané a odložené: ktoré spojnice vychádzajú z políčka
 * (hore, vpravo, dole, vľavo; -1 mimo mriežky), ktoré políčko je v danom
 * smere a ktoré dve políčka spája spojnica. */
const GEO = new Map();
export function geometria(n) {
  if (GEO.has(n)) return GEO.get(n);
  const H = n * (n - 1), V0 = H, E = 2 * n * (n - 1), C = n * n;
  const hId = (r, c) => r * (n - 1) + c;
  const vId = (r, c) => V0 + r * n + c;
  const cellEdges = new Int32Array(4 * C).fill(-1);
  const cellSused = new Int32Array(4 * C).fill(-1);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c, b = i << 2;
      if (r > 0) { cellEdges[b] = vId(r - 1, c); cellSused[b] = i - n; }
      if (c < n - 1) { cellEdges[b + 1] = hId(r, c); cellSused[b + 1] = i + 1; }
      if (r < n - 1) { cellEdges[b + 2] = vId(r, c); cellSused[b + 2] = i + n; }
      if (c > 0) { cellEdges[b + 3] = hId(r, c - 1); cellSused[b + 3] = i - 1; }
    }
  }
  const edgeCells = new Int32Array(2 * E);
  const edgeTyp = new Uint8Array(E), edgeR = new Int32Array(E), edgeC = new Int32Array(E);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n - 1; c++) {
      const e = hId(r, c);
      edgeTyp[e] = 0; edgeR[e] = r; edgeC[e] = c;
      edgeCells[2 * e] = r * n + c; edgeCells[2 * e + 1] = r * n + c + 1;
    }
  }
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n; c++) {
      const e = vId(r, c);
      edgeTyp[e] = 1; edgeR[e] = r; edgeC[e] = c;
      edgeCells[2 * e] = r * n + c; edgeCells[2 * e + 1] = (r + 1) * n + c;
    }
  }
  const g = { n, E, H, V0, C, hId, vId, cellEdges, cellSused, edgeCells, edgeTyp, edgeR, edgeC };
  GEO.set(n, g);
  return g;
}

/* Spojnica ako objekt { typ:'h'|'v', r, c } a späť na index. */
export function hrana(e, n) {
  const g = geometria(n);
  return { typ: g.edgeTyp[e] ? 'v' : 'h', r: g.edgeR[e], c: g.edgeC[e] };
}
export function indexHrany(typ, r, c, n) {
  const g = geometria(n);
  return typ === 'h' ? g.hId(r, c) : g.vId(r, c);
}

/* Koľko dvojíc hniezd patrí na mriežku danej veľkosti (spec-herons.md). */
const PAROV = { 5: [3, 4], 6: [4, 5], 7: [5, 6], 8: [6, 8] };
export function rozsahParov(n) {
  if (PAROV[n]) return PAROV[n].slice();
  const k = Math.max(3, Math.round((n * n) / 9));
  return [k, k + 2];
}

/* Hráčove políčka (číslo cesty, 0 prázdne) na stav spojníc: dve susedné
   políčka tej istej cesty musia byť spojené (cesta sa nesmie dotknúť sama
   seba), dve políčka rôznych ciest spojené byť nemôžu. Políčko bez čísla
   nehovorí nič. */
export function stavZBuniek(v, n) {
  const g = geometria(n);
  const st = new Uint8Array(g.E);
  for (let e = 0; e < g.E; e++) {
    const a = v[g.edgeCells[2 * e]] | 0, b = v[g.edgeCells[2 * e + 1]] | 0;
    if (!a || !b) continue;
    st[e] = a === b ? 1 : 2;
  }
  return st;
}

/* Zo stavu spojníc späť na políčka: reťazec spojený čiarami dostane číslo
   hniezda, ktoré v ňom leží (0, kým sa k žiadnemu nedostal). */
export function vlastnici(st, ends, n) {
  const g = geometria(n);
  const out = new Array(g.C).fill(0);
  const videne = new Uint8Array(g.C);
  for (let i = 0; i < g.C; i++) {
    if (videne[i]) continue;
    const komp = [i];
    videne[i] = 1;
    let p = ends[i] || 0;
    for (let t = 0; t < komp.length; t++) {
      const x = komp[t], b = x << 2;
      for (let d = 0; d < 4; d++) {
        const e = g.cellEdges[b + d];
        if (e < 0 || st[e] !== 1) continue;
        const y = g.cellSused[b + d];
        if (videne[y]) continue;
        videne[y] = 1;
        if (!p) p = ends[y] || 0;
        komp.push(y);
      }
    }
    for (const x of komp) out[x] = p;
  }
  return out;
}

/* ── Náhodný rozklad mriežky na jednoduché cesty ─────────────────────── *
 * Pracuje s množinou vybraných spojníc: pridať spojnicu = spojiť dve cesty
 * na ich koncoch. Spojnica sa smie pridať, ak ani jedno z jej políčok nemá
 * už dva konce, ak cesty nie sú tá istá (to by bola slučka) a ak sa spojené
 * cesty nikde inde nedotýkajú (to by bola cesta popri sebe samej). */
function novyRozklad(g) {
  const s = { vyb: new Uint8Array(g.E), deg: new Uint8Array(g.C), uf: new Int32Array(g.C), zoz: new Array(g.C) };
  for (let i = 0; i < g.C; i++) { s.uf[i] = i; s.zoz[i] = [i]; }
  return s;
}
function korenR(s, x) { while (s.uf[x] !== x) { s.uf[x] = s.uf[s.uf[x]]; x = s.uf[x]; } return x; }
function daSaPridat(g, s, e) {
  const a = g.edgeCells[2 * e], b = g.edgeCells[2 * e + 1];
  if (s.deg[a] >= 2 || s.deg[b] >= 2) return false;
  const ra = korenR(s, a), rb = korenR(s, b);
  if (ra === rb) return false;
  const mensi = s.zoz[ra].length <= s.zoz[rb].length ? s.zoz[ra] : s.zoz[rb];
  const druhy = s.zoz[ra].length <= s.zoz[rb].length ? rb : ra;
  for (const x of mensi) {
    const bx = x << 2;
    for (let d = 0; d < 4; d++) {
      const y = g.cellSused[bx + d];
      if (y < 0 || korenR(s, y) !== druhy) continue;
      if ((x === a && y === b) || (x === b && y === a)) continue;
      return false;
    }
  }
  return true;
}
function pridajSpojnicu(g, s, e) {
  const a = g.edgeCells[2 * e], b = g.edgeCells[2 * e + 1];
  s.vyb[e] = 1; s.deg[a]++; s.deg[b]++;
  const ra = korenR(s, a), rb = korenR(s, b);
  const hlavny = s.zoz[ra].length >= s.zoz[rb].length ? ra : rb;
  const vedlajsi = hlavny === ra ? rb : ra;
  for (const x of s.zoz[vedlajsi]) s.zoz[hlavny].push(x);
  s.zoz[vedlajsi] = null;
  s.uf[vedlajsi] = hlavny;
}
function prestavRozklad(g, s) {
  s.deg.fill(0);
  for (let i = 0; i < g.C; i++) { s.uf[i] = i; s.zoz[i] = [i]; }
  for (let e = 0; e < g.E; e++) {
    if (!s.vyb[e]) continue;
    const a = g.edgeCells[2 * e], b = g.edgeCells[2 * e + 1];
    s.deg[a]++; s.deg[b]++;
    pridajBezPocitania(g, s, a, b);
  }
}
function pridajBezPocitania(g, s, a, b) {
  const ra = korenR(s, a), rb = korenR(s, b);
  if (ra === rb) return;
  const hlavny = s.zoz[ra].length >= s.zoz[rb].length ? ra : rb;
  const vedlajsi = hlavny === ra ? rb : ra;
  for (const x of s.zoz[vedlajsi]) s.zoz[hlavny].push(x);
  s.zoz[vedlajsi] = null;
  s.uf[vedlajsi] = hlavny;
}
function spajajDoSyta(g, s, rng) {
  const poradie = [];
  for (let e = 0; e < g.E; e++) if (!s.vyb[e]) poradie.push(e);
  for (let i = poradie.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = poradie[i]; poradie[i] = poradie[j]; poradie[j] = t;
  }
  for (const e of poradie) if (daSaPridat(g, s, e)) pridajSpojnicu(g, s, e);
}
function pocetCiest(g, s) {
  let m = 0;
  for (let e = 0; e < g.E; e++) if (s.vyb[e]) m++;
  return g.C - m;
}
function najkratsiaCesta(g, s) {
  let min = g.C;
  for (let i = 0; i < g.C; i++) if (s.zoz[i] && s.zoz[i].length < min) min = s.zoz[i].length;
  return min;
}
/* Rozklad na cesty ako polia buniek v poradí, alebo null. Každá cesta má
   aspoň tri políčka a počet ciest je medzi kMin a kMax. */
export function randomPaths(rng, n, kMin, kMax, maxKol = 400) {
  const g = geometria(n);
  const s = novyRozklad(g);
  spajajDoSyta(g, s, rng);
  for (let kolo = 0; kolo <= maxKol; kolo++) {
    const p = pocetCiest(g, s);
    if (p >= kMin && p <= kMax && najkratsiaCesta(g, s) >= 3) return cestyZRozkladu(g, s);
    const vybrane = [];
    for (let e = 0; e < g.E; e++) if (s.vyb[e]) vybrane.push(e);
    if (!vybrane.length) return null;
    // zbúrať jednu až tri spojnice a spájať znova (čiastočný nový začiatok)
    const kolko = 1 + Math.floor(rng() * 3);
    for (let u = 0; u < kolko; u++) s.vyb[vybrane[Math.floor(rng() * vybrane.length)]] = 0;
    prestavRozklad(g, s);
    spajajDoSyta(g, s, rng);
  }
  return null;
}
/* Z vybraných spojníc vyskladá jednotlivé cesty v poradí od konca ku koncu. */
function cestyZRozkladu(g, s) {
  const cesty = [];
  const videne = new Uint8Array(g.C);
  for (let i = 0; i < g.C; i++) {
    if (videne[i] || s.deg[i] > 1) continue; // koniec cesty
    const cesta = [i];
    videne[i] = 1;
    let x = i;
    for (;;) {
      let dalsi = -1;
      const b = x << 2;
      for (let d = 0; d < 4; d++) {
        const e = g.cellEdges[b + d];
        if (e < 0 || !s.vyb[e]) continue;
        const y = g.cellSused[b + d];
        if (!videne[y]) { dalsi = y; break; }
      }
      if (dalsi < 0) break;
      videne[dalsi] = 1;
      cesta.push(dalsi);
      x = dalsi;
    }
    cesty.push(cesta);
  }
  for (let i = 0; i < g.C; i++) if (!videne[i]) return null; // slučka, nemalo by nastať
  return cesty;
}

/* Cesty očíslované podľa najmenšieho indexu políčka, aby ten istý rozklad
   dal vždy tie isté čísla. */
export function usporiadaj(cesty) {
  return cesty.slice().sort((a, b) => Math.min(a[0], a[a.length - 1]) - Math.min(b[0], b[b.length - 1]));
}
export function endsZCiest(cesty, n) {
  const out = new Array(n * n).fill(0);
  cesty.forEach((c, k) => { out[c[0]] = k + 1; out[c[c.length - 1]] = k + 1; });
  return out;
}
export function riesenieZCiest(cesty, n) {
  const out = new Array(n * n).fill(0);
  cesty.forEach((c, k) => { for (const x of c) out[x] = k + 1; });
  return out;
}

/* Je pole buniek jednoduchá cesta (žiadne políčko nesusedí s iným políčkom
   tej istej cesty okrem predchodcu a nasledovníka)? */
function jednoduchaCesta(cells, n) {
  const poz = new Map();
  for (let t = 0; t < cells.length; t++) poz.set(cells[t], t);
  const g = geometria(n);
  for (let t = 0; t < cells.length; t++) {
    const b = cells[t] << 2;
    for (let d = 0; d < 4; d++) {
      const y = g.cellSused[b + d];
      if (y < 0 || !poz.has(y)) continue;
      const r = poz.get(y) - t;
      if (r !== 1 && r !== -1) return false;
    }
  }
  return true;
}
/* Spojí cesty A a B na koncoch a a b, ak spojená cesta ostáva jednoduchá. */
function spojDveCesty(A, B, a, b, n) {
  const A2 = A[A.length - 1] === a ? A : A.slice().reverse();
  const B2 = B[0] === b ? B : B.slice().reverse();
  if (A2[A2.length - 1] !== a || B2[0] !== b) return null;
  const m = A2.concat(B2);
  return jednoduchaCesta(m, n) ? m : null;
}
/* Všetky dvojice ciest, ktoré sa dajú spojiť koncom ku koncu. */
function moznaSpojenia(cesty, n) {
  const g = geometria(n);
  const kde = new Map();
  cesty.forEach((c, p) => { kde.set(c[0], p); kde.set(c[c.length - 1], p); });
  const out = [];
  cesty.forEach((c, p) => {
    for (const a of [c[0], c[c.length - 1]]) {
      const b0 = a << 2;
      for (let d = 0; d < 4; d++) {
        const y = g.cellSused[b0 + d];
        if (y < 0 || !kde.has(y)) continue;
        const q = kde.get(y);
        if (q <= p) continue;
        out.push([p, a, q, y]);
      }
    }
  });
  return out;
}

/* ── Riešiteľ: spoločné jadro ────────────────────────────────────────── *
 * Kontext drží stav spojníc, stupne políčok, reťazce (union-find so zoznamom
 * buniek), značku reťazca (číslo dvojice, ku ktorej patrí), front na
 * prepočet a pri ľudskom riešení aj zoznam krokov. `rules` hovorí, či sa
 * v propagácii použije aj dosahovanie dvojíc (vrstva 2). */
function nestyZEnds(ends) {
  let K = 0;
  for (const x of ends) if (x > K) K = x;
  const nesty = Array.from({ length: K + 1 }, () => []);
  for (let i = 0; i < ends.length; i++) if (ends[i]) nesty[ends[i]].push(i);
  for (let p = 1; p <= K; p++) if (nesty[p].length !== 2) throw new Error('Pair ' + p + ' does not have exactly two nests');
  return { K, nesty };
}

function kontext(g, ends, initial, rules, steps, vlastniciInit) {
  const { K, nesty } = nestyZEnds(ends);
  const C = g.C;
  const k = {
    g, ends, K, nesty, rules, steps,
    st: new Uint8Array(g.E),
    cap: new Uint8Array(C),
    deg: new Uint8Array(C),
    volne: new Uint8Array(C),
    uf: new Int32Array(C),
    znacka: new Int32Array(C),
    zoznam: new Array(C),
    q: [], qi: 0,
    bad: false, stop: false, step: null,
    limitKrokov: 0, dokymBunka: false,
    vlastnikPred: steps ? new Int32Array(C) : null,
  };
  for (let i = 0; i < C; i++) {
    k.cap[i] = ends[i] ? 1 : 2;
    k.uf[i] = i;
    k.zoznam[i] = [i];
    k.znacka[i] = ends[i] || 0;
    let v = 0;
    for (let d = 0; d < 4; d++) if (g.cellEdges[(i << 2) + d] >= 0) v++;
    k.volne[i] = v;
    k.q.push(i);
  }
  if (initial) {
    const s = k.steps;
    k.steps = null;
    for (let e = 0; e < g.E; e++) {
      const x = initial[e];
      if (x === 1 || x === 2) nastav(k, e, x);
    }
    k.steps = s;
  }
  // hráčove čísla políčok: reťazec, v ktorom leží označené políčko, patrí tej
  // dvojici (platí, kým sú hráčove čísla správne, a to nápoveda overuje prvá)
  if (vlastniciInit) {
    for (let i = 0; i < C; i++) {
      const p = vlastniciInit[i] | 0;
      if (!p) continue;
      const r = najdi(k, i);
      if (k.znacka[r] && k.znacka[r] !== p) { k.bad = true; break; }
      k.znacka[r] = p;
    }
  }
  if (k.vlastnikPred) for (let i = 0; i < C; i++) k.vlastnikPred[i] = k.znacka[najdi(k, i)];
  return k;
}

function najdi(k, x) { while (k.uf[x] !== x) { k.uf[x] = k.uf[k.uf[x]]; x = k.uf[x]; } return x; }

function klon(k, rules) {
  const zoznam = new Array(k.zoznam.length);
  for (let i = 0; i < k.zoznam.length; i++) zoznam[i] = k.zoznam[i] ? k.zoznam[i].slice() : null;
  return {
    ...k,
    st: k.st.slice(), deg: k.deg.slice(), volne: k.volne.slice(),
    uf: k.uf.slice(), znacka: k.znacka.slice(), zoznam,
    q: [], qi: 0, step: null, steps: null, vlastnikPred: null,
    stop: false, limitKrokov: 0, dokymBunka: false,
    rules: rules ?? k.rules,
  };
}

function zacniKrok(k, rule, layer, info) {
  if (!k.steps) return;
  k.step = { rule, layer, info, edges: [], cells: [] };
}
function ukonciKrok(k) {
  const s = k.step;
  k.step = null;
  if (!s) return;
  const pred = k.vlastnikPred;
  for (let i = 0; i < k.g.C; i++) {
    const p = k.znacka[najdi(k, i)];
    if (p && !pred[i]) { s.cells.push(i, p); pred[i] = p; }
  }
  if (!s.edges.length && !s.cells.length) return;
  k.steps.push(s);
  if (k.limitKrokov && k.steps.length >= k.limitKrokov) k.stop = true;
  if (k.dokymBunka && s.cells.length) k.stop = true;
}

/* Postaví spojnicu (1) alebo ju preškrtne (2). Pri spojení zlúči reťazce
   a hneď overí, že spojený reťazec ostáva jednoduchou cestou. */
function nastav(k, e, val) {
  if (k.bad) return;
  const g = k.g, st = k.st;
  if (st[e] === val) return;
  if (st[e] !== 0) { k.bad = true; return; }
  st[e] = val;
  const a = g.edgeCells[2 * e], b = g.edgeCells[2 * e + 1];
  k.volne[a]--; k.volne[b]--;
  if (k.step) k.step.edges.push(e, val);
  if (val === 1) {
    k.deg[a]++; k.deg[b]++;
    if (k.deg[a] > k.cap[a] || k.deg[b] > k.cap[b]) { k.bad = true; return; }
    const ra = najdi(k, a), rb = najdi(k, b);
    if (ra === rb) { k.bad = true; return; } // slučka alebo dotyk so sebou
    const za = k.znacka[ra], zb = k.znacka[rb];
    if (za && zb && za !== zb) { k.bad = true; return; } // dve rôzne dvojice
    const hlavny = k.zoznam[ra].length >= k.zoznam[rb].length ? ra : rb;
    const vedlajsi = hlavny === ra ? rb : ra;
    for (const x of k.zoznam[vedlajsi]) k.zoznam[hlavny].push(x);
    k.zoznam[vedlajsi] = null;
    k.uf[vedlajsi] = hlavny;
    k.znacka[hlavny] = za || zb;
    const cely = k.zoznam[hlavny];
    for (const x of cely) {
      const bx = x << 2;
      for (let d = 0; d < 4; d++) {
        const y = g.cellSused[bx + d];
        if (y < 0 || najdi(k, y) !== hlavny) continue;
        if (st[g.cellEdges[bx + d]] !== 1) { k.bad = true; return; } // cesta popri sebe
      }
      k.q.push(x);
    }
  }
  k.q.push(a); k.q.push(b);
}

/* Vrstva 1: miestne pravidlá. Políčko má toľko spojníc, koľko mu patrí
   (hniezdo jednu, každé iné dve), spojnica, ktorá by cestu položila popri
   sebe samej alebo spojila dve rôzne dvojice, sa preškrtne. */
function propaguj(k) {
  const g = k.g, st = k.st;
  while (k.qi < k.q.length) {
    if (k.bad || k.stop) return;
    const i = k.q[k.qi++];
    const cap = k.cap[i], d = k.deg[i], v = k.volne[i];
    if (d > cap || d + v < cap) { k.bad = true; return; }
    if (v > 0 && d === cap) {
      zacniKrok(k, cap === 1 ? 'nest-full' : 'cell-full', 1, i);
      for (let dd = 0; dd < 4; dd++) {
        const e = g.cellEdges[(i << 2) + dd];
        if (e >= 0 && st[e] === 0) nastav(k, e, 2);
      }
      ukonciKrok(k);
      if (k.bad || k.stop) return;
    } else if (v > 0 && d + v === cap) {
      zacniKrok(k, cap === 1 ? 'nest-one-way' : 'cell-needs-all', 1, i);
      for (let dd = 0; dd < 4; dd++) {
        const e = g.cellEdges[(i << 2) + dd];
        if (e >= 0 && st[e] === 0) nastav(k, e, 1);
      }
      ukonciKrok(k);
      if (k.bad || k.stop) return;
    }
    for (let dd = 0; dd < 4; dd++) {
      const e = g.cellEdges[(i << 2) + dd];
      if (e < 0 || st[e] !== 0) continue;
      const j = g.cellSused[(i << 2) + dd];
      const zi = k.znacka[najdi(k, i)], zj = k.znacka[najdi(k, j)];
      if (zi && zj && zi !== zj) {
        zacniKrok(k, 'pair-clash', 1, e);
        nastav(k, e, 2);
        ukonciKrok(k);
      } else if (dotykBySpojenim(k, e)) {
        zacniKrok(k, 'self-touch', 1, e);
        nastav(k, e, 2);
        ukonciKrok(k);
      }
      if (k.bad || k.stop) return;
    }
  }
}

/* Položila by táto spojnica cestu popri sebe samej (alebo uzavrela slučku)? */
function dotykBySpojenim(k, e) {
  const g = k.g;
  const a = g.edgeCells[2 * e], b = g.edgeCells[2 * e + 1];
  const ra = najdi(k, a), rb = najdi(k, b);
  if (ra === rb) return true;
  const mensi = k.zoznam[ra].length <= k.zoznam[rb].length ? k.zoznam[ra] : k.zoznam[rb];
  const druhy = mensi === k.zoznam[ra] ? rb : ra;
  for (const x of mensi) {
    const bx = x << 2;
    for (let d = 0; d < 4; d++) {
      const y = g.cellSused[bx + d];
      if (y < 0 || najdi(k, y) !== druhy) continue;
      if ((x === a && y === b) || (x === b && y === a)) continue;
      return true;
    }
  }
  return false;
}

/* ── Kam sa ktorá dvojica ešte dostane ───────────────────────────────── *
 * Hotová cesta je reťaz už postavených kúskov, pospájaných koncom na koniec.
 * Preto sa dosah nepočíta po políčkach, ale po reťazcoch: do reťazca sa dá
 * vojsť jeho voľným koncom a vyjde sa druhým voľným koncom (osamotené
 * políčko má oba konce v sebe, koniec pri hniezde je slepý, tam sa cesta
 * končí). Je to výrazne prísnejšie než chodenie po políčkach a práve to robí
 * z pravidiel vrstvy 2 skutočné pravidlá. */
function volneKonce(k) {
  const P = new Array(k.g.C).fill(null);
  for (let i = 0; i < k.g.C; i++) {
    if (k.deg[i] >= k.cap[i]) continue;
    const r = najdi(k, i);
    if (P[r]) P[r].push(i); else P[r] = [i];
  }
  return P;
}
/* Ktorým koncom sa z reťazca vyjde, keď sa doň vošlo koncom `vstup`.
   -1 znamená, že sa nevyjde (cesta sa tam končí alebo tam ani nevojde). */
function vystup(k, P, r, vstup) {
  const lst = P[r];
  if (!lst) return -1;
  if (lst.length >= 2) return lst[0] === vstup ? lst[1] : (lst[1] === vstup ? lst[0] : -1);
  if (lst[0] !== vstup) return -1;
  return k.cap[vstup] - k.deg[vstup] >= 2 ? vstup : -1;
}
/* Reťazce, ktoré ešte môžu ležať na ceste dvojice p, ak sa vyjde z hniezda
   `start`. Cez reťazec s cudzou značkou sa nedá prejsť. */
function dosahRetazcov(k, p, start, P, out) {
  const g = k.g;
  out.fill(0);
  const rA = najdi(k, start);
  out[rA] = 1;
  const lst = P[rA];
  if (!lst) return; // reťazec je hotový, cesta dvojice už nikam nepokračuje
  const prvy = lst.length >= 2 ? (lst[0] === start ? lst[1] : lst[0]) : lst[0];
  const videne = new Uint8Array(g.C);
  const q = [prvy];
  videne[prvy] = 1;
  for (let t = 0; t < q.length; t++) {
    const x = q[t], b = x << 2, rx = najdi(k, x);
    for (let d = 0; d < 4; d++) {
      const e = g.cellEdges[b + d];
      if (e < 0 || k.st[e] !== 0) continue; // po čiare sa ide vnútri reťazca
      const y = g.cellSused[b + d];
      if (k.deg[y] >= k.cap[y]) continue; // nie je to voľný koniec
      const ry = najdi(k, y);
      if (ry === rx) continue;
      const zn = k.znacka[ry];
      if (zn && zn !== p) continue;
      out[ry] = 1;
      const ex = vystup(k, P, ry, y);
      if (ex >= 0 && !videne[ex]) { videne[ex] = 1; q.push(ex); }
    }
  }
}
/* Pre každý reťazec: koľko dvojíc ho ešte môže mať a ktorá to je (ak jedna).
   Vráti null, keď je stav sporný. */
function analyzaDosahu(k) {
  const C = k.g.C;
  const P = volneKonce(k);
  const A = new Uint8Array(C), B = new Uint8Array(C);
  const pocet = new Int32Array(C), ktory = new Int32Array(C);
  for (let p = 1; p <= k.K; p++) {
    const a = k.nesty[p][0], b = k.nesty[p][1];
    dosahRetazcov(k, p, a, P, A);
    if (!A[najdi(k, b)]) return null; // hniezda sa k sebe nedostanú
    dosahRetazcov(k, p, b, P, B);
    for (let i = 0; i < C; i++) if (A[i] && B[i]) { pocet[i]++; ktory[i] = p; }
  }
  for (let i = 0; i < C; i++) {
    if (!k.zoznam[i]) continue;
    if (!pocet[i]) return null; // k tomuto kúsku mokrade sa nedostane nikto
  }
  return { pocet, ktory };
}

/* Vrstva 2, prvé pravidlo: ku ktorému políčku sa dostane len jedna dvojica,
   to políčko patrí jej. Zároveň chytí spor: dvojica, ktorej hniezda sa už
   k sebe nedostanú, alebo kus mokrade, ku ktorému sa nedostane nikto. */
function dosiahnutelnost(k) {
  const r = analyzaDosahu(k);
  if (!r) { k.bad = true; return false; }
  let zmena = false;
  for (let i = 0; i < k.g.C; i++) {
    if (!k.zoznam[i] || r.pocet[i] !== 1) continue;
    if (k.znacka[i] === r.ktory[i]) continue;
    if (k.znacka[i]) { k.bad = true; return zmena; }
    zacniKrok(k, 'only-pair', 2, [k.zoznam[i][0], r.ktory[i]]);
    k.znacka[i] = r.ktory[i];
    for (const x of k.zoznam[i]) k.q.push(x);
    ukonciKrok(k);
    zmena = true;
    if (k.bad || k.stop) return zmena;
  }
  return zmena;
}

/* Je stav ešte spojiteľný? Rovnaká úvaha, ale nič nemení: len povie áno
   alebo nie. */
function spojiteOK(k) {
  return analyzaDosahu(k) !== null;
}

/* Vrstva 2, druhé pravidlo: spojnica, bez ktorej by sa časť mokrade odrezala
   od všetkých ciest, musí byť postavená. */
function rezOblasti(k) {
  const g = k.g;
  for (let e = 0; e < g.E; e++) {
    if (k.st[e] !== 0) continue;
    k.st[e] = 2;
    const ok = spojiteOK(k);
    k.st[e] = 0;
    if (ok) continue;
    zacniKrok(k, 'region-cut', 2, e);
    nastav(k, e, 1);
    ukonciKrok(k);
    return true;
  }
  return false;
}

/* Vrstva 2 má dve pravidlá: dosah dvojíc a odrezaná oblasť. Špecifikácia
   spomína ako tretie „koridor pri okraji", teda dve rovnobežné cesty, ktoré
   nechajú medzi sebou uličku. Samostatné pravidlo na to tu nie je: každý taký
   koridor je zároveň oblasť, ku ktorej sa dostane len jedna cesta, alebo by
   sa bez spojnice odrezal, takže ho chytí jedno z týchto dvoch pravidiel. */
function krokVrstvy2(k) {
  if (dosiahnutelnost(k)) return true;
  if (k.bad || k.stop) return false;
  return rezOblasti(k);
}

/* Vrstva 3: jednokrokové skúšanie. Postav spojnicu (alebo ju preškrtni),
   dopropaguj vrstvy 1 a 2, a ak z toho vyjde spor, platí opak. */
function krokVrstvy3(k) {
  const g = k.g;
  for (let e = 0; e < g.E; e++) {
    if (k.st[e] !== 0) continue;
    for (const val of [1, 2]) {
      const k2 = klon(k, 2);
      nastav(k2, e, val);
      propagujUplne(k2);
      if (!k2.bad) continue;
      zacniKrok(k, val === 1 ? 'trial-cross' : 'trial-line', 3, e);
      nastav(k, e, val === 1 ? 2 : 1);
      ukonciKrok(k);
      return true;
    }
  }
  return false;
}

function propagujUplne(k) {
  for (;;) {
    propaguj(k);
    if (k.bad || k.stop || k.rules < 2) return;
    if (!dosiahnutelnost(k)) return;
    if (k.bad || k.stop) return;
  }
}

/* Je zadanie dokončené? Všetky spojnice rozhodnuté, každé políčko má svoj
   počet čiar a každý reťazec spája práve dve hniezda tej istej dvojice. */
function jeHotove(k) {
  const g = k.g;
  for (let e = 0; e < g.E; e++) if (k.st[e] === 0) return false;
  for (let i = 0; i < g.C; i++) if (k.deg[i] !== k.cap[i]) return false;
  let ciest = 0;
  for (let i = 0; i < g.C; i++) {
    const lst = k.zoznam[i];
    if (!lst) continue;
    ciest++;
    if (!k.znacka[i]) return false;
    let nestov = 0;
    for (const x of lst) if (k.ends[x]) nestov++;
    if (nestov !== 2) return false;
  }
  return ciest === k.K;
}

function suNeznameHrany(k) {
  for (let e = 0; e < k.g.E; e++) if (k.st[e] === 0) return true;
  return false;
}

/* ── solve: úplné prehľadávanie s návratom ───────────────────────────── *
 * Rozhoduje spojnicu po spojnici, po každom kroku dopropaguje miestne
 * pravidlá (a pri rules >= 2 aj dosahovanie dvojíc). Vetví sa vždy na
 * najviac zovretom políčku, čo je funkcia stavu, takže žiadne riešenie sa
 * nezapočíta dvakrát.
 * opts: limit (koľko riešení stačí nájsť, 2), rules (1 alebo 2), initial,
 * maxNodes (0 bez stropu; pri zastavení je count neúplný a vycerpane true).
 * Vráti { count, solution (ploché pole čísel ciest alebo null), nodes,
 * vycerpane }. */
export function solve(ends, n, opts = {}) {
  const limit = opts.limit ?? 2, rules = opts.rules ?? 2, maxNodes = opts.maxNodes ?? 0;
  const g = geometria(n);
  const k0 = kontext(g, ends, opts.initial || null, rules, null, opts.vlastnici || null);
  let count = 0, first = null, nodes = 0, vycerpane = false;
  propagujUplne(k0);

  function vyberHranu(k) {
    let best = -1, bestV = 9;
    for (let i = 0; i < g.C; i++) {
      const v = k.volne[i];
      if (!v || k.deg[i] >= k.cap[i]) continue;
      if (v < bestV) { bestV = v; best = i; }
    }
    if (best >= 0) {
      for (let d = 0; d < 4; d++) {
        const e = g.cellEdges[(best << 2) + d];
        if (e >= 0 && k.st[e] === 0) return e;
      }
    }
    for (let e = 0; e < g.E; e++) if (k.st[e] === 0) return e;
    return -1;
  }

  function rek(k) {
    if (vycerpane) return;
    nodes++;
    if (maxNodes && nodes > maxNodes) { vycerpane = true; return; }
    if (k.bad) return;
    const e = vyberHranu(k);
    if (e < 0) {
      if (jeHotove(k)) {
        count++;
        if (!first) first = vlastnici(k.st, ends, n);
      }
      return;
    }
    for (const val of [1, 2]) {
      const k2 = klon(k);
      nastav(k2, e, val);
      propagujUplne(k2);
      rek(k2);
      if (vycerpane || count >= limit) return;
    }
  }
  rek(k0);
  return { count, solution: first, nodes, vycerpane };
}

/* ── solveHuman: len ľudské pravidlá, bez hádania ────────────────────── *
 * solveHuman(ends, n, { initial, vlastnici, limitKrokov, dokymBunka, maxVrstva })
 *   Vrstva 1 sú miestne pravidlá (hniezdo s jediným voľným susedom, políčko
 *   s jediným možným prechodom, plné políčko, cesta popri sebe samej, dve
 *   rôzne dvojice), vrstva 2 je dosah dvojíc a odrezaná oblasť, vrstva 3
 *   jednokroková skúška. Ľahšia vrstva má vždy prednosť.
 *   initial: začiatočný stav spojníc (napríklad hráčove správne políčka cez
 *   stavZBuniek), vlastnici: ploché pole čísel ciest, ktoré hráč už vie;
 *   limitKrokov: skončiť po toľkých krokoch; dokymBunka:
 *   skončiť hneď, ako sa o niektorom políčku dozvieme, ktorej ceste patrí
 *   (to je to, čo vie nápoveda ukázať hráčovi).
 * Vráti { solved, contradiction, layersUsed:{1,2,3}, steps, solution, state,
 * owners }, kde steps sú kroky { rule, layer, edges:[{typ,r,c,val}],
 * cells:[{i,pair}], text } s anglickým vysvetlením. */
export function solveHuman(ends, n, opts = {}) {
  const g = geometria(n);
  const steps = [];
  const k = kontext(g, ends, opts.initial || null, 1, steps, opts.vlastnici || null);
  k.limitKrokov = opts.limitKrokov || 0;
  k.dokymBunka = !!opts.dokymBunka;
  const maxVrstva = opts.maxVrstva ?? 3;
  let solved = false;
  propaguj(k);
  while (!k.bad && !k.stop) {
    if (jeHotove(k)) { solved = true; break; }
    if (!suNeznameHrany(k)) break;
    if (!krokVrstvy2(k) && !(maxVrstva >= 3 && krokVrstvy3(k))) break;
    if (k.bad || k.stop) break;
    propaguj(k);
  }
  if (!solved && !k.bad && !k.stop && jeHotove(k)) solved = true;
  const layersUsed = { 1: 0, 2: 0, 3: 0 };
  for (const s of steps) layersUsed[s.layer]++;
  return {
    solved: solved && !k.bad,
    contradiction: k.bad,
    layersUsed,
    steps: steps.map((s) => verejnyKrok(s, g, ends)),
    solution: solved && !k.bad ? vlastnici(k.st, ends, n) : null,
    state: k.st,
    owners: vlastnici(k.st, ends, n),
  };
}

/* ── Anglické vysvetlenia krokov ─────────────────────────────────────── */
function poloha(i, n) {
  const r = (i / n) | 0, c = i % n;
  if (r === 0 && c === 0) return 'in the top left corner';
  if (r === 0 && c === n - 1) return 'in the top right corner';
  if (r === n - 1 && c === 0) return 'in the bottom left corner';
  if (r === n - 1 && c === n - 1) return 'in the bottom right corner';
  return 'in row ' + (r + 1) + ', column ' + (c + 1);
}
function popisHrany(e, g) {
  const a = g.edgeCells[2 * e], b = g.edgeCells[2 * e + 1], n = g.n;
  return 'between the cell ' + poloha(a, n) + ' and the cell ' + poloha(b, n);
}
function zoznamBuniek(indexy, n) {
  const casti = indexy.map((i) => 'the cell ' + poloha(i, n));
  if (casti.length === 1) return casti[0];
  return casti.slice(0, -1).join(', ') + ' and ' + casti[casti.length - 1];
}
function verejnyKrok(s, g, ends) {
  const n = g.n;
  const edges = [];
  for (let j = 0; j < s.edges.length; j += 2) edges.push({ ...hrana(s.edges[j], n), val: s.edges[j + 1] });
  const cells = [];
  for (let j = 0; j < s.cells.length; j += 2) cells.push({ i: s.cells[j], pair: s.cells[j + 1] });
  return { rule: s.rule, layer: s.layer, edges, cells, text: textKroku(s, g, ends) };
}
function textKroku(s, g, ends) {
  const n = g.n, i = s.info;
  // políčka na druhom konci spojníc, ktorých sa krok týka
  const druhe = [];
  for (let j = 0; j < s.edges.length; j += 2) {
    const e = s.edges[j], a = g.edgeCells[2 * e], b = g.edgeCells[2 * e + 1];
    if (a === i) druhe.push(b); else if (b === i) druhe.push(a);
  }
  const jeden = druhe.length === 1;
  switch (s.rule) {
    case 'nest-one-way':
      return 'The nest ' + ends[i] + ' ' + poloha(i, n) + ' has only one free side, so its path leaves through ' + zoznamBuniek(druhe, n) + '.';
    case 'nest-full':
      return 'The path of the nest ' + ends[i] + ' ' + poloha(i, n) + ' already has its one step, so it does not run to ' + zoznamBuniek(druhe, n) + '.';
    case 'cell-needs-all':
      return 'Every cell of the marsh is used by a path, and the cell ' + poloha(i, n) + ' has only ' + (jeden ? 'one free side left' : 'two free sides') + ', so a path runs through ' + (jeden ? 'it to ' + zoznamBuniek(druhe, n) : 'both, to ' + zoznamBuniek(druhe, n)) + '.';
    case 'cell-full':
      return 'The path through the cell ' + poloha(i, n) + ' already has both its steps, so it does not run to ' + zoznamBuniek(druhe, n) + '.';
    case 'self-touch':
      return 'A step ' + popisHrany(i, g) + ' would leave a path running beside itself, and no path may touch itself, so it does not go that way.';
    case 'pair-clash':
      return 'A step ' + popisHrany(i, g) + ' would join two different pairs of nests, so no path goes that way.';
    case 'only-pair':
      return 'Only the pair ' + i[1] + ' can still reach the cell ' + poloha(i[0], n) + ', so that cell belongs to its path.';
    case 'region-cut':
      return 'Without a step ' + popisHrany(i, g) + ' a part of the marsh could not be reached by any path, so a path runs there.';
    case 'trial-cross':
      return 'If a path ran ' + popisHrany(i, g) + ', the cells around it could not all be used, so it does not.';
    case 'trial-line':
      return 'If no path ran ' + popisHrany(i, g) + ', the cells around it could not all be used, so one does.';
    default:
      return 'A step of a path.';
  }
}

/* ── Denné zadanie ───────────────────────────────────────────────────── *
 * generate(dateStr, opts) picks n (default 5) and calls generateSeeded with
 * the date as both name and key, so every date keeps the puzzle it always
 * had. opts: n, parov, maxAttempts, maxVrstva. */
export function generate(dateStr, opts = {}) {
  if (!isValidDate(dateStr)) throw new Error('Date must be in YYYY-MM-DD form: ' + dateStr);
  const n = opts.n ?? 5;
  return generateSeeded(dateStr, dateStr + '/' + n, opts);
}

/* Náhodné poradie (Fisher-Yates) z rng. */
function zamiesaj(rng, pole) {
  const a = pole.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function rovnake(a, b) { return a.join(',') === b.join(','); }

/* The same as generate, but the random seed comes from `key` (any string)
 * and `name` is only stored in the result as `date`. Practice puzzles and
 * the daily candidates use it. Deterministic: the same key gives the same
 * puzzle.
 * Returns { date, n, ends (flat n*n, 0 empty, k a nest of pair k),
 * solution (flat n*n, the path number of every cell), pairs, seed, attempts,
 * difficulty:{ layers:{1,2,3}, pairs, steps }, ms }. */
export function generateSeeded(name, key, opts = {}) {
  const n = opts.n ?? 5;
  const rozsah = opts.parov || rozsahParov(n);
  const kMin = rozsah[0], kMax = rozsah[1];
  const maxAttempts = opts.maxAttempts ?? 200;
  const maxVrstva = opts.maxVrstva ?? 3;
  const t0 = nowMs();
  const seed = seedFromString(key);
  const rng = mulberry32(seed);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const surove = randomPaths(rng, n, kMin, kMax);
    if (!surove) continue;
    let cesty = usporiadaj(surove);
    let ends = endsZCiest(cesty, n);
    let riesenie = riesenieZCiest(cesty, n);
    let fin = solveHuman(ends, n, { maxVrstva });
    if (!fin.solved || !rovnake(fin.solution, riesenie)) continue;
    // minimalizácia zadania: dve cesty spojiť do jednej (dve hniezda preč),
    // kým to človek ešte dorieši bez hádania
    while (cesty.length > kMin) {
      let zmena = false;
      for (const [p, a, q, b] of zamiesaj(rng, moznaSpojenia(cesty, n))) {
        const m = spojDveCesty(cesty[p], cesty[q], a, b, n);
        if (!m) continue;
        const nove = usporiadaj(cesty.filter((_, x) => x !== p && x !== q).concat([m]));
        const e2 = endsZCiest(nove, n), r2 = riesenieZCiest(nove, n);
        const h = solveHuman(e2, n, { maxVrstva });
        if (!h.solved || !rovnake(h.solution, r2)) continue;
        cesty = nove; ends = e2; riesenie = r2; fin = h;
        zmena = true;
        break;
      }
      if (!zmena) break;
    }
    // Bez hádania sa dá dôjsť len k jedinému riešeniu, takže jednoznačnosť je
    // už dokázaná. Aj tak sa overí druhým, nezávislým riešiteľom: keby sa
    // niekedy nezhodli, je to chyba v pravidlách a nie deň navyše.
    const kontrola = solve(ends, n, { limit: 2 });
    if (kontrola.count !== 1 || !rovnake(kontrola.solution, riesenie)) {
      throw new Error('The search and the human rules disagree about ' + name + ' (' + kontrola.count + ' fillings)');
    }
    return {
      date: name, n, ends, solution: riesenie, pairs: cesty.length, seed, attempts: attempt,
      difficulty: { layers: fin.layersUsed, pairs: cesty.length, steps: fin.steps.length },
      ms: Math.round((nowMs() - t0) * 10) / 10,
    };
  }
  throw new Error('No unique, guess-free marsh for ' + name + ' in ' + maxAttempts + ' attempts');
}
