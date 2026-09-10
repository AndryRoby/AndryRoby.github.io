/* Swans: generator and solver for the daily lake loop puzzle.
 *
 * One file, no dependencies, runs the same in Node and in the browser
 * (game.js imports it as a module, tests.mjs too). Everything is
 * deterministic: a date turns into a number, the number into a sequence of
 * random values, the sequence into a puzzle. The same date gives the same
 * puzzle on every machine, so the server never has to compute or store
 * anything.
 *
 * Rules of the game (our own wording): a lake of n x n cells, some of them
 * holding a white or a black swan. Draw one closed loop through the middles
 * of the cells, moving up, down, left or right, through every swan, through
 * every cell at most once, never crossing itself. At a white swan the loop
 * goes straight and turns in the cell just before or just after. At a black
 * swan the loop turns and goes straight through both neighbouring cells.
 *
 * Representation: `pearls` is a flat n*n array, 0 nothing, 1 a white swan, 2
 * a black swan. The loop lives on the links between neighbouring cells:
 * h[r*(n-1) + c] joins the cells (r, c) and (r, c+1) for r in 0..n-1 and c in
 * 0..n-2, v[r*n + c] joins (r, c) and (r+1, c) for r in 0..n-2 and c in
 * 0..n-1. Inside the solver both live in one Uint8Array `st` of length
 * E = 2n(n-1): h first, then v; 0 unknown, 1 line, 2 cross.
 *
 * Directions are always 0 up, 1 right, 2 down, 3 left, so two sides are
 * opposite when their numbers differ by 2.
 *
 * Generation (generateSeeded):
 *   1. grow a random closed loop through 40 to 70 percent of the cells,
 *   2. read off every cell that could carry a swan (a turn with both
 *      neighbours straight is a black one, a straight run with at least one
 *      turning neighbour a white one),
 *   3. keep a random subset of them, growing it until the puzzle can be
 *      finished by the human rules alone,
 *   4. walk the swans in random order and take each one away for good if a
 *      person can still finish without guessing; twice over,
 *   5. if the loop fails try another one, up to `maxAttempts`.
 * A guess free chain of deductions is also a proof that the puzzle has just
 * one solution, and solve() checks that independently in the tests.
 *
 * Difficulty, returned as `difficulty`:
 *   layers  how many steps the human solver needed from each layer of rules
 *           (1 local, 2 patterns between swans, 3 short loop and trials),
 *   pearls  how many swans are left on the board,
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

/* Hráčove (alebo riešiteľove) spojnice { h, v } do jedného stavu a späť.
   hranyZoStavu vráti 0/1 (len čiary), so `surove` aj krížiky (2). */
export function stavZHran(hrany, n) {
  const g = geometria(n);
  const st = new Uint8Array(g.E);
  for (let i = 0; i < g.H; i++) st[i] = hrany.h[i] | 0;
  for (let i = 0; i < g.E - g.H; i++) st[g.V0 + i] = hrany.v[i] | 0;
  return st;
}
export function hranyZoStavu(st, n, surove = false) {
  const g = geometria(n);
  const h = new Array(g.H), v = new Array(g.E - g.H);
  for (let i = 0; i < g.H; i++) h[i] = surove ? st[i] : (st[i] === 1 ? 1 : 0);
  for (let i = 0; i < g.E - g.H; i++) v[i] = surove ? st[g.V0 + i] : (st[g.V0 + i] === 1 ? 1 : 0);
  return { h, v };
}

/* Smery, v ktorých z políčka vychádza čiara (vzostupne). Dva protiľahlé
   smery sa líšia o 2, takže rovno = ds[1] - ds[0] === 2. */
function smeryCiar(g, st, i, out) {
  const b = i << 2;
  let k = 0;
  for (let d = 0; d < 4; d++) { const e = g.cellEdges[b + d]; if (e >= 0 && st[e] === 1) out[k++] = d; }
  return k;
}

/* ── Náhodná slučka cez políčka ──────────────────────────────────────── *
 * Začne štvorcom 2 x 2 a opakovane presúva rovný úsek slučky o políčko
 * nabok: úsek dlhý L spojníc nahradí rovnakým úsekom vo vedľajšom riadku
 * (alebo stĺpci) a spojí ich na koncoch. Každé políčko má stále stupeň 2,
 * takže zo slučky ostáva slučka, len o dve políčka dlhšia. Presun celého
 * úseku (nie jednej spojnice) je dôležitý: nechá v slučke dlhé rovné časti,
 * a práve tie robia miesto pre biele aj čierne labute. */
export function randomLoop(rng, n, hustota) {
  if (n < 3) return null;
  const g = geometria(n);
  const st = new Uint8Array(g.E);
  const naSlucke = new Uint8Array(g.C);
  // začiatok: prstenec okolo štvorca 3 x 3, kde je každé políčko miestom pre
  // labuť (štyri rovné úseky po dvoch spojniciach)
  const r0 = Math.floor(rng() * (n - 2)), c0 = Math.floor(rng() * (n - 2));
  st[g.hId(r0, c0)] = 1; st[g.hId(r0, c0 + 1)] = 1;
  st[g.hId(r0 + 2, c0)] = 1; st[g.hId(r0 + 2, c0 + 1)] = 1;
  st[g.vId(r0, c0)] = 1; st[g.vId(r0 + 1, c0)] = 1;
  st[g.vId(r0, c0 + 2)] = 1; st[g.vId(r0 + 1, c0 + 2)] = 1;
  for (let r = r0; r <= r0 + 2; r++) for (let c = c0; c <= c0 + 2; c++) naSlucke[r * n + c] = 1;
  naSlucke[(r0 + 1) * n + c0 + 1] = 0;
  let size = 8;
  const minimum = Math.ceil(0.4 * n * n);
  const strop = Math.floor(0.7 * n * n);
  let ciel = Math.round((hustota || 0.5) * n * n);
  if (ciel < minimum) ciel = minimum;
  if (ciel > strop) ciel = strop;
  if (ciel % 2) ciel++;
  const linky = new Int32Array(g.E);
  const zaloha = new Uint8Array(g.E), zalohaC = new Uint8Array(g.C);
  const smery = new Int32Array(4);
  /* Preklopenie zákruty do uhlopriečky: veľkosť slučky sa nemení, len tvar.
     Bez neho by rast skončil vždy v tej istej hŕstke tvarov. */
  const preklop = () => {
    let mn = 0;
    for (let i = 0; i < g.C; i++) if (naSlucke[i]) linky[mn++] = i;
    if (!mn) return false;
    const i = linky[Math.floor(rng() * mn)];
    if (smeryCiar(g, st, i, smery) !== 2 || smery[1] - smery[0] === 2) return false;
    const d1 = smery[0], d2 = smery[1];
    const a = g.cellSused[(i << 2) + d1], b = g.cellSused[(i << 2) + d2];
    if (a < 0 || b < 0) return false;
    const uhol = g.cellSused[(a << 2) + d2];
    if (uhol < 0 || naSlucke[uhol]) return false;
    const f1 = g.cellEdges[(a << 2) + d2], f2 = g.cellEdges[(b << 2) + d1];
    if (f1 < 0 || f2 < 0) return false;
    zaloha.set(st); zalohaC.set(naSlucke);
    st[g.cellEdges[(i << 2) + d1]] = 0; st[g.cellEdges[(i << 2) + d2]] = 0;
    st[f1] = 1; st[f2] = 1;
    naSlucke[i] = 0; naSlucke[uhol] = 1;
    if (slukaBezpecna(g, st)) return true;
    st.set(zaloha); naSlucke.set(zalohaC);
    return false;
  };
  let pokusov = 0;
  const maxPokusov = 80 * n * n;
  while (size < ciel && pokusov < maxPokusov) {
    pokusov++;
    if (rng() < 0.4) { preklop(); continue; }
    zaloha.set(st); zalohaC.set(naSlucke);
    let ln = 0;
    for (let e = 0; e < g.E; e++) if (st[e] === 1) linky[ln++] = e;
    const e = linky[Math.floor(rng() * ln)];
    const vodorovna = g.edgeTyp[e] === 0;
    const r = g.edgeR[e], c = g.edgeC[e];
    // najdlhší rovný úsek slučky, ktorého je táto spojnica súčasťou
    const dlzkaOsi = vodorovna ? n - 1 : n - 1;
    const je = (j) => (vodorovna ? st[g.hId(r, j)] : st[g.vId(j, c)]) === 1;
    const kde = vodorovna ? c : r;
    let j0 = kde, j1 = kde;
    while (j0 > 0 && je(j0 - 1)) j0--;
    while (j1 < dlzkaOsi - 1 && je(j1 + 1)) j1++;
    // náhodný podúsek dlhý 1 az 3 spojnice
    const maxL = Math.min(j1 - j0 + 1, 3);
    const L = 1 + Math.floor(rng() * maxL);
    const s0 = j0 + Math.floor(rng() * (j1 - j0 + 2 - L));
    const s1 = s0 + L - 1;
    const strany = rng() < 0.5 ? [0, 1] : [1, 0];
    for (const strana of strany) {
      const posun = strana === 0 ? -1 : 1;
      if (vodorovna) {
        const rr = r + posun;
        if (rr < 0 || rr >= n) continue;
        let volne = true;
        for (let j = s0; j <= s1 + 1 && volne; j++) if (naSlucke[rr * n + j]) volne = false;
        if (!volne) continue;
        for (let j = s0; j <= s1; j++) st[g.hId(r, j)] = 0;
        for (let j = s0 + 1; j <= s1; j++) naSlucke[r * n + j] = 0;
        for (let j = s0; j <= s1; j++) st[g.hId(rr, j)] = 1;
        st[g.vId(Math.min(r, rr), s0)] = 1;
        st[g.vId(Math.min(r, rr), s1 + 1)] = 1;
        for (let j = s0; j <= s1 + 1; j++) naSlucke[rr * n + j] = 1;
      } else {
        const cc = c + posun;
        if (cc < 0 || cc >= n) continue;
        let volne = true;
        for (let j = s0; j <= s1 + 1 && volne; j++) if (naSlucke[j * n + cc]) volne = false;
        if (!volne) continue;
        for (let j = s0; j <= s1; j++) st[g.vId(j, c)] = 0;
        for (let j = s0 + 1; j <= s1; j++) naSlucke[j * n + c] = 0;
        for (let j = s0; j <= s1; j++) st[g.vId(j, cc)] = 1;
        st[g.hId(s0, Math.min(c, cc))] = 1;
        st[g.hId(s1 + 1, Math.min(c, cc))] = 1;
        for (let j = s0; j <= s1 + 1; j++) naSlucke[j * n + cc] = 1;
      }
      // ťah prijmi len vtedy, keď na slučke ostalo každé políčko miestom
      // pre labuť; inak by sa dal ten istý úsek posunúť aj v riešení a
      // zadanie by nebolo jednoznačné
      if (slukaBezpecna(g, st)) { size += 2; break; }
      st.set(zaloha); naSlucke.set(zalohaC);
    }
  }
  if (size < minimum) return null;
  // premiešanie tvaru pri rovnakej veľkosti, aby si dva dni nesadli na tú
  // istú slučku
  const mixov = 2 * n * n;
  for (let m = 0; m < mixov; m++) preklop();
  return hranyZoStavu(st, n);
}

/* Kde by na hotovej slučke mohla sedieť labuť: 1 biela (slučka ide rovno a
   aspoň jeden sused zabočí), 2 čierna (slučka zabočí a v oboch susedoch ide
   rovno), 0 nikde. Ploché pole n*n. */
export function pearlsFromLoop(edges, n) {
  return kandidatiZoStavu(geometria(n), stavZHran(edges, n));
}
function kandidatiZoStavu(g, st) {
  const out = new Array(g.C).fill(0);
  const ds = new Int32Array(4), dj = new Int32Array(4);
  for (let i = 0; i < g.C; i++) {
    if (smeryCiar(g, st, i, ds) !== 2) continue;
    const rovno = ds[1] - ds[0] === 2;
    if (rovno) {
      let ok = false;
      for (let m = 0; m < 2; m++) {
        const j = g.cellSused[(i << 2) + ds[m]];
        if (j < 0) continue;
        if (smeryCiar(g, st, j, dj) === 2 && dj[1] - dj[0] !== 2) ok = true;
      }
      if (ok) out[i] = 1;
    } else {
      let ok = true;
      for (let m = 0; m < 2 && ok; m++) {
        const d = ds[m], j = g.cellSused[(i << 2) + d];
        if (j < 0) { ok = false; break; }
        if (smeryCiar(g, st, j, dj) !== 2 || dj[1] - dj[0] !== 2) { ok = false; break; }
        const e2 = g.cellEdges[(j << 2) + d];
        if (e2 < 0 || st[e2] !== 1) ok = false;
      }
      if (ok) out[i] = 2;
    }
  }
  return out;
}

/* Dá sa táto slučka labuťami vôbec pripnúť? Miesta, kde labuť sedieť nemôže,
   sú diery v popise: keby ich bolo vedľa seba priveľa, dal by sa ten kus
   slučky presunúť a žiadnej labuti by sa tvar nepokazil, teda zadanie by
   malo viac riešení nech dáme labute kamkoľvek. Dva jednoduché presuny
   pokrývajú takmer všetky také prípady:
   - posunúť rovný úsek nabok potrebuje dve voľné políčka za sebou, obe
     rovné a obe bez miesta pre labuť (to je vnútro rovného úseku dlhého
     aspoň 5 spojníc),
   - preklopiť zákrutu do uhlopriečky potrebuje tri zákruty za sebou.
   Slučku prijmeme, len keď ani jedno z toho neplatí. */
function slukaBezpecna(g, st) {
  const p = kandidatiZoStavu(g, st);
  const ds = new Int32Array(4), dj = new Int32Array(4);
  const volne = (i) => i >= 0 && smeryCiar(g, st, i, dj) === 0;
  for (let i = 0; i < g.C; i++) {
    if (smeryCiar(g, st, i, ds) !== 2 || p[i]) continue;
    if (ds[1] - ds[0] === 2) {
      // dve rovné políčka bez miesta pre labuť za sebou: dá sa ten kus
      // slučky posunúť nabok, keď sú tam dve voľné políčka?
      for (let m = 0; m < 2; m++) {
        const j = g.cellSused[(i << 2) + ds[m]];
        if (j < 0 || p[j]) continue;
        if (smeryCiar(g, st, j, dj) === 2 && dj[1] - dj[0] === 2) return false;
      }
    } else {
      // tri zákruty za sebou: dá sa prostredná preklopiť do voľnej
      // uhlopriečky?
      const a = g.cellSused[(i << 2) + ds[0]], b = g.cellSused[(i << 2) + ds[1]];
      if (a < 0 || b < 0 || p[a] || p[b]) continue;
      if (smeryCiar(g, st, a, dj) !== 2 || dj[1] - dj[0] === 2) continue;
      if (smeryCiar(g, st, b, dj) !== 2 || dj[1] - dj[0] === 2) continue;
      if (volne(g.cellSused[(a << 2) + ds[1]])) return false;
    }
  }
  return true;
}

/* ── Riešiteľ: spoločné jadro ────────────────────────────────────────── *
 * Kontext drží stav spojníc, front na prepočet, príznak sporu a (pri ľudskom
 * riešení) zoznam krokov. `layer` hovorí, či sa v propagácii smú použiť aj
 * dynamické pravidlá vrstvy 2 (biela labuť so zablokovaným smerom a s
 * potrebou zabočenia u suseda). */
function kontext(geo, pearls, st, layer, steps) {
  return {
    geo, pearls, st, layer, steps, step: null, t: null,
    q: new Int32Array(geo.E), qi: 0, qn: 0, bad: false, stop: false, limitKrokov: 0,
    uf: new Int32Array(geo.C), ce: new Int32Array(geo.C), cc: new Int32Array(geo.C),
    deg: new Uint8Array(geo.C), ds: new Int32Array(4), dj: new Int32Array(4),
  };
}
function nastav(k, e, val) {
  const s = k.st[e];
  if (s === val) return;
  if (s !== 0) { k.bad = true; return; }
  k.st[e] = val;
  k.q[k.qn++] = e;
  if (k.step) k.step.edges.push(e, val);
}
function zacniKrok(k, rule, layer, info) {
  if (k.steps) k.step = { rule, layer, edges: [], info };
}
function ukonciKrok(k) {
  if (!k.step) return;
  if (k.step.edges.length) {
    k.steps.push(k.step);
    if (k.limitKrokov && k.steps.length >= k.limitKrokov) k.stop = true;
  }
  k.step = null;
}

/* Osi: 0 vodorovná (vpravo, vľavo), 1 zvislá (hore, dole). */
const OSI = [[1, 3], [0, 2]];

/* Vrstva 1 pri políčku: slučka cez políčko ide alebo neide, teda stupeň je 0
   alebo 2, a políčko s labuťou má stupeň 2. */
function skontrolujPolicko(k, i) {
  const g = k.geo, st = k.st, b = i << 2, pe = k.pearls[i];
  let L = 0, U = 0, u1 = -1;
  for (let d = 0; d < 4; d++) {
    const e = g.cellEdges[b + d];
    if (e < 0) continue;
    const s = st[e];
    if (s === 1) L++; else if (s === 0) { U++; if (u1 < 0) u1 = e; }
  }
  if (L > 2) { k.bad = true; return; }
  if (pe) {
    if (L + U < 2) { k.bad = true; return; }
    if (L === 2 && U) {
      zacniKrok(k, 'cell-full', 1, i);
      for (let d = 0; d < 4; d++) { const e = g.cellEdges[b + d]; if (e >= 0 && st[e] === 0) nastav(k, e, 2); }
      ukonciKrok(k);
    } else if (L + U === 2 && U) {
      zacniKrok(k, 'cell-needs-all', 1, i);
      for (let d = 0; d < 4; d++) { const e = g.cellEdges[b + d]; if (e >= 0 && st[e] === 0) nastav(k, e, 1); }
      ukonciKrok(k);
    }
  } else if (L === 2) {
    if (U) {
      zacniKrok(k, 'cell-full', 1, i);
      for (let d = 0; d < 4; d++) { const e = g.cellEdges[b + d]; if (e >= 0 && st[e] === 0) nastav(k, e, 2); }
      ukonciKrok(k);
    }
  } else if (L === 1) {
    if (U === 0) { k.bad = true; return; }
    if (U === 1) { zacniKrok(k, 'cell-one-way', 1, i); nastav(k, u1, 1); ukonciKrok(k); }
  } else if (U === 1) {
    zacniKrok(k, 'cell-dead-end', 1, i); nastav(k, u1, 2); ukonciKrok(k);
  }
  if (k.bad || k.stop) return;
  if (pe === 1) bielaLabut(k, i);
  else if (pe === 2) ciernaLabut(k, i);
  if (k.bad || k.stop) return;
  if (k.layer >= 2 && pe === 1) bielaVrstva2(k, i);
}

/* Vrstva 1 pri bielej labuti: slučka ide rovno, teda jedna os je celá čiara a
   druhá celá krížik. Strana mimo mriežky je to isté ako krížik, preto biela
   labuť pri okraji ide rovno pozdĺž okraja. */
function bielaLabut(k, i) {
  const g = k.geo, st = k.st, b = i << 2;
  for (let o = 0; o < 2; o++) {
    const ea = g.cellEdges[b + OSI[o][0]], ec = g.cellEdges[b + OSI[o][1]];
    const ea2 = g.cellEdges[b + OSI[1 - o][0]], ec2 = g.cellEdges[b + OSI[1 - o][1]];
    const zavrete = (e) => e < 0 || st[e] === 2;
    if (zavrete(ea) || zavrete(ec)) {
      const okraj = ea < 0 || ec < 0;
      if (ea2 < 0 || ec2 < 0) { k.bad = true; return; }
      if (st[ea2] === 1 && st[ec2] === 1 && (ea < 0 || st[ea] === 2) && (ec < 0 || st[ec] === 2)) return;
      zacniKrok(k, okraj ? 'white-border' : 'white-straight', 1, i);
      if (ea >= 0) nastav(k, ea, 2);
      if (ec >= 0) nastav(k, ec, 2);
      nastav(k, ea2, 1); nastav(k, ec2, 1);
      ukonciKrok(k);
      return;
    }
    if (st[ea] === 1 || st[ec] === 1) {
      if (st[ea] === 1 && st[ec] === 1 && (ea2 < 0 || st[ea2] === 2) && (ec2 < 0 || st[ec2] === 2)) return;
      zacniKrok(k, 'white-straight', 1, i);
      nastav(k, ea, 1); nastav(k, ec, 1);
      if (ea2 >= 0) nastav(k, ea2, 2);
      if (ec2 >= 0) nastav(k, ec2, 2);
      ukonciKrok(k);
      return;
    }
  }
}

/* Vrstva 1 pri čiernej labuti: slučka zabočí, teda z každej dvojice
   protiľahlých strán je práve jedna čiara, a obe ramená idú rovno cez
   susedné políčko. Strana mimo mriežky je krížik, preto čierna labuť pri
   okraji alebo v rohu má ramená smerom od okraja. */
function ciernaLabut(k, i) {
  const g = k.geo, st = k.st, b = i << 2;
  for (let o = 0; o < 2; o++) {
    const ea = g.cellEdges[b + OSI[o][0]], ec = g.cellEdges[b + OSI[o][1]];
    const sa = ea < 0 ? 2 : st[ea], sc = ec < 0 ? 2 : st[ec];
    if ((sa === 2 && sc === 2) || (sa === 1 && sc === 1)) { k.bad = true; return; }
    if (sa === 2 && sc === 0) { zacniKrok(k, ea < 0 ? 'black-border' : 'black-turn', 1, i); nastav(k, ec, 1); ukonciKrok(k); }
    else if (sc === 2 && sa === 0) { zacniKrok(k, ec < 0 ? 'black-border' : 'black-turn', 1, i); nastav(k, ea, 1); ukonciKrok(k); }
    else if (sa === 1 && sc === 0) { zacniKrok(k, 'black-turn', 1, i); nastav(k, ec, 2); ukonciKrok(k); }
    else if (sc === 1 && sa === 0) { zacniKrok(k, 'black-turn', 1, i); nastav(k, ea, 2); ukonciKrok(k); }
    if (k.bad || k.stop) return;
  }
  for (let d = 0; d < 4; d++) {
    const e = g.cellEdges[b + d];
    if (e < 0) continue;
    const j = g.cellSused[b + d];
    const e2 = g.cellEdges[(j << 2) + d];
    if (st[e] === 1) {
      if (e2 < 0) { k.bad = true; return; }
      if (st[e2] !== 1) { zacniKrok(k, 'black-arms', 1, i); nastav(k, e2, 1); ukonciKrok(k); }
    } else if (st[e] === 0 && (e2 < 0 || st[e2] === 2)) {
      zacniKrok(k, 'black-arm-blocked', 1, i); nastav(k, e, 2); ukonciKrok(k);
    }
    if (k.bad || k.stop) return;
  }
}

/* Môže slučka ísť cez bielu labuť po tejto osi? Obe strany musia byť voľné a
   obaja susedia musia mať ešte aspoň dve nezakrížikované strany, inak sa cez
   ne slučka nedostane. */
function osMozna(k, i, o) {
  const g = k.geo, st = k.st, b = i << 2;
  for (let m = 0; m < 2; m++) {
    const d = OSI[o][m];
    const e = g.cellEdges[b + d];
    if (e < 0 || st[e] === 2) return false;
    const j = g.cellSused[b + d];
    if (j < 0) return false;
    let volnych = 0;
    for (let q = 0; q < 4; q++) { const ee = g.cellEdges[(j << 2) + q]; if (ee >= 0 && st[ee] !== 2) volnych++; }
    if (volnych < 2) return false;
  }
  return true;
}

/* Vrstva 2 pri bielej labuti: keď je jeden smer zablokovaný (susedovi už
   neostali dve strany), ide slučka tým druhým; a keď už slučka ide rovno aj
   cez jedného zo susedov, musí ten druhý zabočiť. */
function bielaVrstva2(k, i) {
  const g = k.geo, st = k.st, b = i << 2;
  const m0 = osMozna(k, i, 0), m1 = osMozna(k, i, 1);
  if (!m0 && !m1) { k.bad = true; return; }
  if (m0 !== m1) {
    const o = m0 ? 0 : 1;
    const ea = g.cellEdges[b + OSI[o][0]], ec = g.cellEdges[b + OSI[o][1]];
    const ea2 = g.cellEdges[b + OSI[1 - o][0]], ec2 = g.cellEdges[b + OSI[1 - o][1]];
    if (st[ea] !== 1 || st[ec] !== 1) {
      zacniKrok(k, 'white-blocked', 2, i);
      nastav(k, ea, 1); nastav(k, ec, 1);
      if (ea2 >= 0) nastav(k, ea2, 2);
      if (ec2 >= 0) nastav(k, ec2, 2);
      ukonciKrok(k);
      if (k.bad || k.stop) return;
    }
  }
  for (let o = 0; o < 2; o++) {
    const ea = g.cellEdges[b + OSI[o][0]], ec = g.cellEdges[b + OSI[o][1]];
    if (ea < 0 || ec < 0 || st[ea] !== 1 || st[ec] !== 1) continue;
    for (let m = 0; m < 2; m++) {
      const d = OSI[o][m], d2 = OSI[o][1 - m];
      const j = g.cellSused[b + d];
      if (j < 0) continue;
      const daleko = g.cellEdges[(j << 2) + d];
      if (daleko < 0) continue;
      const rovno = st[daleko] === 1 || k.pearls[j] === 1;
      if (!rovno) continue;
      const j2 = g.cellSused[b + d2];
      if (j2 < 0) continue;
      const daleko2 = g.cellEdges[(j2 << 2) + d2];
      if (daleko2 < 0) continue;
      if (st[daleko2] === 1) { k.bad = true; return; }
      if (st[daleko2] === 0) { zacniKrok(k, 'white-needs-turn', 2, i); nastav(k, daleko2, 2); ukonciKrok(k); return; }
    }
  }
}

/* Prepočíta políčka okolo každej zmenenej spojnice, kým sa niečo mení.
   Ramená čiernej labute siahajú o políčko ďalej, preto sa prepočítavajú aj
   susedné políčka s labuťou. */
function propaguj(k) {
  const g = k.geo;
  while (k.qi < k.qn && !k.bad && !k.stop) {
    const e = k.q[k.qi++];
    const a = g.edgeCells[2 * e], b = g.edgeCells[2 * e + 1];
    skontrolujPolicko(k, a); if (k.bad || k.stop) break;
    skontrolujPolicko(k, b); if (k.bad || k.stop) break;
    for (let m = 0; m < 2 && !k.bad && !k.stop; m++) {
      const i = m ? b : a;
      for (let d = 0; d < 4; d++) {
        const j = g.cellSused[(i << 2) + d];
        if (j >= 0 && k.pearls[j]) { skontrolujPolicko(k, j); if (k.bad || k.stop) break; }
      }
    }
  }
  if (!k.stop) k.qi = k.qn = 0;
  return !k.bad;
}

/* Statické vzory vrstvy 2, ktoré platia hneď zo zadania: tri biele labute v
   rade (slučka cez prostrednú ide kolmo) a dve čierne vedľa seba (spoločná
   spojnica je krížik, ramená idú od seba). */
function statickeVzory(k) {
  const g = k.geo, n = g.n, p = k.pearls;
  for (let r = 0; r < n && !k.bad && !k.stop; r++) {
    for (let c = 0; c + 2 < n; c++) {
      const i = r * n + c;
      if (p[i] === 1 && p[i + 1] === 1 && p[i + 2] === 1) {
        zacniKrok(k, 'three-whites', 2, [i, i + 1, i + 2]);
        nastav(k, g.hId(r, c), 2); nastav(k, g.hId(r, c + 1), 2);
        ukonciKrok(k);
        if (k.bad || k.stop) return true;
      }
    }
  }
  for (let c = 0; c < n && !k.bad && !k.stop; c++) {
    for (let r = 0; r + 2 < n; r++) {
      const i = r * n + c;
      if (p[i] === 1 && p[i + n] === 1 && p[i + 2 * n] === 1) {
        zacniKrok(k, 'three-whites', 2, [i, i + n, i + 2 * n]);
        nastav(k, g.vId(r, c), 2); nastav(k, g.vId(r + 1, c), 2);
        ukonciKrok(k);
        if (k.bad || k.stop) return true;
      }
    }
  }
  for (let r = 0; r < n && !k.bad && !k.stop; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      if (p[i] !== 2) continue;
      if (c + 1 < n && p[i + 1] === 2) {
        zacniKrok(k, 'black-black', 2, [i, i + 1]); nastav(k, g.hId(r, c), 2); ukonciKrok(k);
        if (k.bad || k.stop) return true;
      }
      if (r + 1 < n && p[i + n] === 2) {
        zacniKrok(k, 'black-black', 2, [i, i + n]); nastav(k, g.vId(r, c), 2); ukonciKrok(k);
        if (k.bad || k.stop) return true;
      }
    }
  }
  return false;
}

/* Začiatok: pri vrstve 2 najprv statické vzory, potom všetky políčka raz. */
function zaciatok(k) {
  const g = k.geo;
  if (k.layer >= 2) { statickeVzory(k); if (k.bad || k.stop) return; }
  for (let i = 0; i < g.C && !k.bad && !k.stop; i++) skontrolujPolicko(k, i);
  propaguj(k);
}

function najdi(uf, x) {
  while (uf[x] !== x) { uf[x] = uf[uf[x]]; x = uf[x]; }
  return x;
}

/* Sedí tvar slučky pri labuti i? Volá sa až nad hotovou slučkou, kde má
   každé políčko na nej stupeň 2. */
function tvarOK(k, i) {
  const g = k.geo, st = k.st, pe = k.pearls[i], ds = k.ds, dj = k.dj;
  if (smeryCiar(g, st, i, ds) !== 2) return false;
  const rovno = ds[1] - ds[0] === 2;
  if (pe === 1) {
    if (!rovno) return false;
    for (let m = 0; m < 2; m++) {
      const j = g.cellSused[(i << 2) + ds[m]];
      if (j < 0) return false;
      if (smeryCiar(g, st, j, dj) === 2 && dj[1] - dj[0] !== 2) return true;
    }
    return false;
  }
  if (rovno) return false;
  for (let m = 0; m < 2; m++) {
    const d = ds[m], j = g.cellSused[(i << 2) + d];
    if (j < 0) return false;
    if (smeryCiar(g, st, j, dj) !== 2 || dj[1] - dj[0] !== 2) return false;
    const e2 = g.cellEdges[(j << 2) + d];
    if (e2 < 0 || st[e2] !== 1) return false;
  }
  return true;
}

/* Rozbor čiar: komponenty, stupne políčok, uzavreté slučky, spokojné labute.
   Používa odkladacie polia kontextu (deg, uf, ce, cc). */
function stavSlucok(k) {
  const g = k.geo, st = k.st, E = g.E, C = g.C, uf = k.uf, ce = k.ce, cc = k.cc, deg = k.deg;
  for (let i = 0; i < C; i++) { uf[i] = i; ce[i] = 0; cc[i] = 0; deg[i] = 0; }
  let total = 0;
  for (let e = 0; e < E; e++) {
    if (st[e] !== 1) continue;
    total++;
    const a = g.edgeCells[2 * e], b = g.edgeCells[2 * e + 1];
    deg[a]++; deg[b]++;
    const ra = najdi(uf, a), rb = najdi(uf, b);
    if (ra !== rb) uf[ra] = rb;
  }
  for (let e = 0; e < E; e++) if (st[e] === 1) ce[najdi(uf, g.edgeCells[2 * e])]++;
  for (let i = 0; i < C; i++) if (deg[i]) cc[najdi(uf, i)]++;
  let cycles = 0, cycleEdges = 0;
  for (let i = 0; i < C; i++) if (uf[i] === i && ce[i] > 0 && ce[i] === cc[i]) { cycles++; cycleEdges += ce[i]; }
  let labuteOK = true;
  for (let i = 0; i < C && labuteOK; i++) {
    if (!k.pearls[i]) continue;
    if (deg[i] !== 2 || !tvarOK(k, i)) labuteOK = false;
  }
  return { cycles, cycleEdges, total, labuteOK };
}
/* Uzavretá slučka je spor, keď mimo nej ostali čiary, keď je slučiek viac
   alebo keď niektorá labuť nie je na nej alebo nemá svoj tvar. */
function slukaJeSpor(s) {
  return s.cycles > 0 && (s.cycles > 1 || s.cycleEdges < s.total || !s.labuteOK);
}

/* Zakríkuj spojnice, ktoré by uzavreli slučku skôr, než sú na nej všetky
   labute. Bez tohto orezania sa vetvenie na väčšom jazere zamotá na dlhé
   minúty: cesta sa uzavrie do malého krúžku a spor sa ukáže až o veľa
   krokov neskôr. Vráti true, keď niečo zakríkla. */
function zakazKratkeSlucky(k) {
  const g = k.geo, st = k.st, pearls = k.pearls;
  const s = stavSlucok(k);
  const deg = k.deg, uf = k.uf, ce = k.ce;
  let zmena = false;
  for (let e = 0; e < g.E; e++) {
    if (st[e] !== 0) continue;
    const a = g.edgeCells[2 * e], b = g.edgeCells[2 * e + 1];
    if (deg[a] !== 1 || deg[b] !== 1) continue;
    const ra = najdi(uf, a);
    if (ra !== najdi(uf, b)) continue;
    let uplne = ce[ra] === s.total;
    if (uplne) {
      for (let i = 0; i < g.C && uplne; i++) {
        if (!pearls[i]) continue;
        if (deg[i] + (i === a || i === b ? 1 : 0) !== 2) uplne = false;
      }
    }
    if (!uplne) { nastav(k, e, 2); zmena = true; if (k.bad) return true; }
  }
  return zmena;
}
/* Vyskúša každú voľnú spojnicu: keď z čiary vyjde spor, je tam krížik, a keď
   zo krížika vyjde spor, je tam čiara. To isté robí vrstva 3 ľudského
   riešiteľa; tu z toho má úžitok vetvenie, ktoré sa vďaka nej takmer nemusí
   vetviť. Vráti true, keď niečo nastavila. */
function skusVsetky(k) {
  const g = k.geo, st = k.st;
  if (!k.t) k.t = kontext(g, k.pearls, new Uint8Array(g.E), 2, null);
  const t = k.t;
  let zmena = false;
  for (let e = 0; e < g.E && !k.bad; e++) {
    if (st[e] !== 0) continue;
    if (skus(k, t, e, 1)) { nastav(k, e, 2); zmena = true; }
    else if (skus(k, t, e, 2)) { nastav(k, e, 1); zmena = true; }
  }
  return zmena;
}

/* Propagácia až do konca, aj s orezaním krátkych slučiek (a pri rules 3 aj so
   skúškami). */
function propagujUplne(k) {
  while (!k.bad && !k.stop) {
    if (!propaguj(k)) return false;
    if (zakazKratkeSlucky(k)) continue;
    if (k.layer >= 3 && skusVsetky(k)) continue;
    break;
  }
  return !k.bad;
}

/* ── solve: strojový riešiteľ ────────────────────────────────────────── *
 * solve(pearls, n, { limit = 2, rules = 3, initial, maxNodes = 0 })
 *   propagácia (políčko má stupeň 0 alebo 2, labuť stupeň 2 a svoj tvar;
 *   rules 2 pridá aj statické vzory a bielu labuť so zablokovaným smerom,
 *   rules 3 aj skúšku každej spojnice), po nej vetvenie s návratom. Bez
 *   skúšok sa desať krát desať vetví aj na státisíce uzlov, so skúškami
 *   spravidla na jednotky. Riešenie musí byť práve jedna uzavretá
 *   slučka cez všetky labute: uzavretá slučka s čiarami mimo nej alebo s
 *   labuťou bokom je spor, dve slučky nie sú riešenie.
 *   maxNodes zastaví hľadanie po toľkých vetvách (0 = bez stropu). Pri
 *   zastavení je count neúplný, preto vráti aj vycerpane: true; volajúci sa
 *   vtedy nesmie tváriť, že vie počet riešení. Strop je deterministický,
 *   takže zadanie ostáva pre daný kľúč rovnaké.
 * Vráti { count (do limit), solution:{h, v} prvého riešenia alebo null,
 * nodes, vycerpane }. */
export function solve(pearls, n, opts = {}) {
  const limit = opts.limit ?? 2, rules = opts.rules ?? 3, maxNodes = opts.maxNodes ?? 0;
  const g = geometria(n);
  const st = opts.initial ? Uint8Array.from(opts.initial) : new Uint8Array(g.E);
  const k0 = kontext(g, pearls, st, rules, null);
  let count = 0, first = null, nodes = 0, vycerpane = false;
  zaciatok(k0);
  propagujUplne(k0);

  function vyberHranu(k) {
    const st2 = k.st, deg = k.deg;
    for (let i = 0; i < g.C; i++) {
      if (deg[i] !== 1) continue;
      for (let d = 0; d < 4; d++) { const e = g.cellEdges[(i << 2) + d]; if (e >= 0 && st2[e] === 0) return e; }
    }
    let best = -1, bestU = 9;
    for (let i = 0; i < g.C; i++) {
      if (!pearls[i]) continue;
      let L = 0, U = 0;
      for (let d = 0; d < 4; d++) {
        const e = g.cellEdges[(i << 2) + d];
        if (e < 0) continue;
        const s = st2[e];
        if (s === 1) L++; else if (s === 0) U++;
      }
      if (U > 0 && L < 2 && U < bestU) { best = i; bestU = U; }
    }
    if (best >= 0) for (let d = 0; d < 4; d++) { const e = g.cellEdges[(best << 2) + d]; if (e >= 0 && st2[e] === 0) return e; }
    for (let e = 0; e < g.E; e++) if (st2[e] === 0) return e;
    return -1;
  }

  function rek(k) {
    if (vycerpane) return;
    nodes++;
    if (maxNodes && nodes > maxNodes) { vycerpane = true; return; }
    if (k.bad) return;
    const s = stavSlucok(k);
    if (s.cycles) {
      if (slukaJeSpor(s)) return;
      count++;
      if (!first) { first = k.st.slice(); for (let e = 0; e < g.E; e++) if (first[e] === 0) first[e] = 2; }
      return;
    }
    const e = vyberHranu(k);
    if (e < 0) return;
    for (const val of [1, 2]) {
      const k2 = { ...k, st: k.st.slice(), qi: 0, qn: 0, bad: false, step: null };
      nastav(k2, e, val);
      propagujUplne(k2);
      rek(k2);
      if (vycerpane || count >= limit) return;
    }
  }
  rek(k0);
  return { count, solution: first ? hranyZoStavu(first, n) : null, nodes, vycerpane };
}

/* ── solveHuman: len ľudské pravidlá, bez hádania ────────────────────── */

/* Vrstva 2: vzory medzi labuťami. Tri biele v rade, dve čierne vedľa seba,
   biela labuť so zablokovaným smerom a biela labuť, ktorej jeden sused už
   ide rovno (druhý teda musí zabočiť). Vráti true, keď niečo nastavila
   alebo narazila na spor.
   Poznámka k špecifikácii: čierna labuť vedľa bielej sama o sebe nič
   nevynúti (rameno čiernej cez bielu je vždy v poriadku, biela ide rovno a
   čierna zabáča), preto jej miesto v tejto vrstve drží pravidlo o potrebe
   zabočenia, ktoré je druhou polovicou pravidla bielej labute. */
function krokVrstvy2(k) {
  const g = k.geo;
  const pred = k.steps.length;
  const hotovo = () => k.bad || k.steps.length > pred;
  statickeVzory(k);
  if (hotovo()) return true;
  for (let i = 0; i < g.C; i++) {
    if (k.pearls[i] !== 1) continue;
    bielaVrstva2(k, i);
    if (hotovo()) return true;
  }
  return false;
}

/* Skúška: nastav spojnicu e na val, propaguj vrstvy 1 a 2, vráť true pri
   spore (vrátane predčasne uzavretej slučky). */
function skus(k, t, e, val) {
  t.st.set(k.st); t.qi = t.qn = 0; t.bad = false;
  nastav(t, e, val);
  if (!propaguj(t)) return true;
  return slukaJeSpor(stavSlucok(t));
}

/* Vrstva 3: krátka slučka (spojnica, ktorá by uzavrela slučku skôr, než sú
   na nej všetky labute, je krížik) a jednokroková skúška každej spojnice. */
function krokVrstvy3(k) {
  const g = k.geo, st = k.st, E = g.E, pearls = k.pearls;
  const s = stavSlucok(k);
  const deg = k.deg, uf = k.uf, ce = k.ce;
  for (let e = 0; e < E; e++) {
    if (st[e] !== 0) continue;
    const a = g.edgeCells[2 * e], b = g.edgeCells[2 * e + 1];
    if (deg[a] !== 1 || deg[b] !== 1) continue;
    const ra = najdi(uf, a);
    if (ra !== najdi(uf, b)) continue;
    let uplne = ce[ra] === s.total;
    if (uplne) {
      for (let i = 0; i < g.C && uplne; i++) {
        if (!pearls[i]) continue;
        if (deg[i] + (i === a || i === b ? 1 : 0) !== 2) uplne = false;
      }
    }
    if (!uplne) { zacniKrok(k, 'short-loop', 3, e); nastav(k, e, 2); ukonciKrok(k); return true; }
  }
  if (!k.t) k.t = kontext(g, pearls, new Uint8Array(E), 2, null);
  const t = k.t;
  for (let e = 0; e < E; e++) {
    if (st[e] !== 0) continue;
    if (skus(k, t, e, 1)) { zacniKrok(k, 'trial-cross', 3, e); nastav(k, e, 2); ukonciKrok(k); return true; }
    if (skus(k, t, e, 2)) { zacniKrok(k, 'trial-line', 3, e); nastav(k, e, 1); ukonciKrok(k); return true; }
  }
  return false;
}

/* solveHuman(pearls, n, { initial, limitKrokov, maxVrstva })
 *   Rieši len ľudskými pravidlami v troch vrstvách, bez hádania: vrstva 1
 *   (miestne pravidlá políčka a labute, okraj a roh), vrstva 2 (vzory medzi
 *   labuťami), vrstva 3 (krátka slučka a jednokroková skúška). Ľahšia vrstva
 *   má vždy prednosť; ťažšia príde na rad, až keď ľahšie nič nenájdu.
 *   initial: voliteľný začiatočný stav (Uint8Array 0/1/2, napríklad hráčove
 *   správne značky); limitKrokov: skončiť po toľkých krokoch (nápoveda: 1).
 * Vráti { solved, contradiction, layersUsed:{1,2,3}, steps, solution, state },
 * kde steps sú kroky { rule, layer, edges:[{ typ, r, c, val }], text } s
 * anglickým vysvetlením. */
export function solveHuman(pearls, n, opts = {}) {
  const g = geometria(n);
  const st = opts.initial ? Uint8Array.from(opts.initial) : new Uint8Array(g.E);
  const steps = [];
  const k = kontext(g, pearls, st, 1, steps);
  k.limitKrokov = opts.limitKrokov || 0;
  const maxVrstva = opts.maxVrstva ?? 3;
  let solved = false;
  zaciatok(k);
  while (!k.bad && !k.stop) {
    const s = stavSlucok(k);
    if (s.cycles) {
      if (slukaJeSpor(s)) { k.bad = true; break; }
      zacniKrok(k, 'loop-done', 1, -1);
      for (let e = 0; e < g.E; e++) if (st[e] === 0) nastav(k, e, 2);
      ukonciKrok(k);
      solved = true;
      break;
    }
    let unknown = false;
    for (let e = 0; e < g.E; e++) if (st[e] === 0) { unknown = true; break; }
    if (!unknown) break;
    if (!krokVrstvy2(k) && !(maxVrstva >= 3 && krokVrstvy3(k))) break;
    if (k.bad || k.stop) break;
    propaguj(k);
  }
  const layersUsed = { 1: 0, 2: 0, 3: 0 };
  for (const s of steps) layersUsed[s.layer]++;
  return {
    solved: solved && !k.bad,
    contradiction: k.bad,
    layersUsed,
    steps: steps.map((s) => verejnyKrok(s, g, pearls)),
    solution: solved && !k.bad ? hranyZoStavu(st, n) : null,
    state: st,
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
  return 'the step between the cell ' + poloha(a, n) + ' and the cell ' + poloha(b, n);
}
function verejnyKrok(s, g, pearls) {
  const n = g.n;
  const edges = [];
  for (let j = 0; j < s.edges.length; j += 2) edges.push({ ...hrana(s.edges[j], n), val: s.edges[j + 1] });
  return { rule: s.rule, layer: s.layer, edges, text: textKroku(s, g, edges, pearls) };
}
function textKroku(s, g, edges, pearls) {
  const n = g.n, i = s.info;
  const pocet = edges.length;
  const jeden = pocet === 1;
  switch (s.rule) {
    case 'cell-full':
      return 'The loop already passes through the cell ' + poloha(i, n) + ', so ' + (jeden ? 'its last open side is' : 'its other open sides are') + ' crossed.';
    case 'cell-needs-all':
      return 'The swan ' + poloha(i, n) + ' has exactly as many open sides left as the loop needs, so it runs through ' + (jeden ? 'the last one' : 'all of them') + '.';
    case 'cell-one-way':
      return 'The loop reaching the cell ' + poloha(i, n) + ' has only one way on, so it continues there.';
    case 'cell-dead-end':
      return 'A line into the cell ' + poloha(i, n) + ' would have nowhere to go on, so this side is crossed.';
    case 'white-border':
      return 'The white swan ' + poloha(i, n) + ' lies against the edge of the lake, and the loop goes straight through a white swan, so it has to run along the edge.';
    case 'white-straight':
      return 'The loop goes straight through the white swan ' + poloha(i, n) + ', so it takes both opposite sides and neither of the other two.';
    case 'black-border':
      return 'The black swan ' + poloha(i, n) + ' lies against the edge of the lake, so the loop turns there with both arms pointing away from the edge.';
    case 'black-turn':
      return 'The loop turns at the black swan ' + poloha(i, n) + ', so it takes exactly one side out of every pair of opposite sides.';
    case 'black-arms':
      return 'Each arm of the black swan ' + poloha(i, n) + ' runs straight on through the next cell, so the loop continues there.';
    case 'black-arm-blocked':
      return 'An arm of the black swan ' + poloha(i, n) + ' could not run straight on through the next cell, so this side is crossed.';
    case 'loop-done':
      return 'The loop is closed and every swan has what it asks for, so every other side is crossed.';
    case 'three-whites':
      return 'Three white swans in a row (' + poloha(i[0], n) + ', ' + poloha(i[1], n) + ' and ' + poloha(i[2], n) + '): the loop along the row would leave the middle one with no turn beside it, so it crosses the row instead.';
    case 'black-black':
      return 'Two black swans side by side (' + poloha(i[0], n) + ' and ' + poloha(i[1], n) + '): the loop turns at both, so it cannot run between them and their arms point away from each other.';
    case 'white-blocked':
      return 'The white swan ' + poloha(i, n) + ' cannot go straight one way, because the loop has no room in the cells beside it, so it goes the other way.';
    case 'white-needs-turn':
      return 'The loop goes straight through the white swan ' + poloha(i, n) + ' and straight on through the cell on one side of it, so it has to turn in the cell on the other side.';
    case 'short-loop':
      return 'Joining the two ends at ' + popisHrany(i, g) + ' would close the loop before every swan is on it, so this side is crossed.';
    case 'trial-cross':
      return 'If the loop took ' + popisHrany(i, g) + ', the cells and swans around it could not work out, so this side is crossed.';
    case 'trial-line':
      return 'If ' + popisHrany(i, g) + ' were crossed, the loop around it could not go on, so it must run there.';
    default:
      return 'A step of the loop.';
  }
}

/* ── Denná slučka ────────────────────────────────────────────────────── *
 * generate(dateStr, opts) picks n (default 6) and calls generateSeeded with
 * the date as both name and key, so every date keeps the puzzle it always
 * had. opts: n, hustota, maxAttempts (default 600, dovod je pri maxAttempts
 * v generateSeeded). */
export function generate(dateStr, opts = {}) {
  if (!isValidDate(dateStr)) throw new Error('Date must be in YYYY-MM-DD form: ' + dateStr);
  const n = opts.n ?? 6;
  return generateSeeded(dateStr, dateStr + '/' + n, opts);
}

/* Náhodné poradie (Fisher-Yates) z rng. */
function zamiesaj(rng, pole) {
  const a = pole.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

function rovnakeHrany(a, b) {
  return a.h.join('') === b.h.join('') && a.v.join('') === b.v.join('');
}

/* The same as generate, but the random seed comes from `key` (any string)
 * and `name` is only stored in the result as `date`. Practice puzzles and
 * the daily candidates use it. Deterministic: the same key gives the same
 * puzzle.
 * Returns { date, n, pearls (flat n*n, 0 none, 1 white, 2 black),
 * solution:{h, v} (0/1), seed, attempts,
 * difficulty:{ layers:{1,2,3}, pearls, steps }, ms }. */
export function generateSeeded(name, key, opts = {}) {
  const n = opts.n ?? 6;
  // Vedomá odchýlka od ops/spec-hry-spolocne.md, kde je „max 200 pokusov,
  // potom výnimka". Merané na tomto generátore (scratchpad/swans-attempts.mjs,
  // 780 kandidátov): priemer pokusov 5 pri 6×6, 10 pri 7×7, 12 pri 8×8 a 37
  // pri 10×10, najhorší kandidát 162 pri 10×10. Pri priemere 37 je šanca, že
  // 10×10 nestihne 200 pokusov, asi 0,4 % na kandidáta, čo je pri šiestich
  // kandidátoch na každú nedeľu niekoľko spadnutých dní za dva roky. Strop 600
  // tú šancu zráža pod stotinu percenta (a pokus stojí pár milisekúnd), takže
  // výnimka ostáva výnimkou a nie ruletou.
  const maxAttempts = opts.maxAttempts ?? 600;
  const maxVrstva = opts.maxVrstva ?? 3;
  const t0 = nowMs();
  const seed = seedFromString(key);
  const rng = mulberry32(seed);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const hustota = opts.hustota ?? (0.4 + rng() * 0.3);
    const edges = randomLoop(rng, n, hustota);
    if (!edges) continue;
    const plne = pearlsFromLoop(edges, n);
    const kandidati = [];
    for (let i = 0; i < n * n; i++) if (plne[i]) kandidati.push(i);
    if (kandidati.length < Math.max(4, Math.round(0.1 * n * n))) continue;
    // so všetkými labuťami musí slučku zvládnuť aj človek, inak nemá zmysel
    // z tohto zadania uberať
    const uvod = solveHuman(plne, n, { maxVrstva });
    if (!uvod.solved || !rovnakeHrany(uvod.solution, edges)) continue;
    // náhodná podmnožina, 15 az 30 percent políčok; keď na ňu ľudské
    // pravidlá nestačia, rastie, kým sa nedostane k celej ponuke
    const poradieK = zamiesaj(rng, kandidati);
    let k = Math.round((0.15 + rng() * 0.15) * n * n);
    if (k < 4) k = 4;
    if (k > poradieK.length) k = poradieK.length;
    let pearls = null;
    for (;;) {
      const p = new Array(n * n).fill(0);
      for (let j = 0; j < k; j++) p[poradieK[j]] = plne[poradieK[j]];
      const r = solveHuman(p, n, { maxVrstva });
      if (r.solved && rovnakeHrany(r.solution, edges)) { pearls = p; break; }
      if (k >= poradieK.length) break;
      k = Math.min(poradieK.length, Math.ceil(k * 1.4) + 1);
    }
    if (!pearls) continue;
    // odoberaj labute, kým ostáva ľudsky riešiteľná (a tým aj jednoznačná)
    for (let pass = 0; pass < 2; pass++) {
      const poradie = zamiesaj(rng, poradieK);
      for (const i of poradie) {
        if (!pearls[i]) continue;
        const stare = pearls[i];
        pearls[i] = 0;
        const r = solveHuman(pearls, n, { maxVrstva });
        if (!(r.solved && rovnakeHrany(r.solution, edges))) pearls[i] = stare;
      }
    }
    const fin = solveHuman(pearls, n, { maxVrstva });
    if (!fin.solved || !rovnakeHrany(fin.solution, edges)) {
      throw new Error('solveHuman settled on a different loop than the source for ' + name);
    }
    let pocet = 0;
    for (const x of pearls) if (x) pocet++;
    return {
      date: name, n, pearls, solution: edges, seed, attempts: attempt,
      difficulty: { layers: fin.layersUsed, pearls: pocet, steps: fin.steps.length },
      ms: Math.round((nowMs() - t0) * 10) / 10,
    };
  }
  throw new Error('No unique, guess-free loop for ' + name + ' in ' + maxAttempts + ' attempts');
}
