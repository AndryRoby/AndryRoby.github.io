/* Otters: generator and solver for the daily river loop puzzle.
 *
 * One file, no dependencies, runs the same in Node and in the browser
 * (game.js imports it as a module, tests.mjs too). Everything is
 * deterministic: a date turns into a number, the number into a sequence of
 * random values, the sequence into a puzzle. The same date gives the same
 * puzzle on every machine, so the server never has to compute or store
 * anything.
 *
 * Rules of the game (our own wording): a marsh of n x n patches with dots
 * at the corners. Draw the otters' river along the grid lines: one closed
 * loop, no branches, no crossings, one loop only. A number in a patch says
 * how many of its four sides the river runs along (0 to 3). A patch without
 * a number says nothing. A cross on a side is the player's own note that
 * the river does not run there.
 *
 * Representation: edges as flat arrays, h[r*n + c] is the horizontal edge
 * between dots (r, c) and (r, c+1) for r in 0..n and c in 0..n-1; v[r*(n+1)
 * + c] is the vertical edge between dots (r, c) and (r+1, c) for r in 0..n-1
 * and c in 0..n. Inside the solver both live in one Uint8Array `st` of
 * length E = 2n(n+1): h first, then v; 0 unknown, 1 line, 2 cross. Clues are
 * a flat n*n array of 0..3 or null.
 *
 * Generation (generateSeeded):
 *   1. grow a random 4-connected region of patches with no holes and no
 *      diagonal touch: its boundary is exactly one closed loop,
 *   2. read every patch's number off the loop,
 *   3. walk the patches in random order and take each number away for good
 *      if the puzzle still has exactly one solution (solve) and a person can
 *      still finish it without guessing (solveHuman); twice over,
 *   4. if the region fails (too small, or the full clues themselves need
 *      guessing) try another one, up to `maxAttempts`.
 * The loop is always our own random one, never a copied puzzle.
 *
 * Difficulty, returned as `difficulty`:
 *   layers  how many steps the human solver needed from each layer of
 *           rules (1 local, 2 patterns, 3 short loop and one-step trials),
 *   clues   how many numbers are left on the board,
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
 * Pre každé n raz spočítané a odložené: ktoré hrany patria políčku (hore,
 * vpravo, dole, vľavo), ktoré hrany sa stretávajú v bodke (hore, vpravo,
 * dole, vľavo; -1 mimo mriežky), koncové bodky a susedné políčka hrany. */
const GEO = new Map();
export function geometria(n) {
  if (GEO.has(n)) return GEO.get(n);
  const H = (n + 1) * n, V0 = H, E = 2 * n * (n + 1), D = (n + 1) * (n + 1), C = n * n;
  const hId = (r, c) => r * n + c;
  const vId = (r, c) => V0 + r * (n + 1) + c;
  const cellEdges = new Int32Array(4 * C);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const b = 4 * (r * n + c);
      cellEdges[b] = hId(r, c); cellEdges[b + 1] = vId(r, c + 1);
      cellEdges[b + 2] = hId(r + 1, c); cellEdges[b + 3] = vId(r, c);
    }
  }
  const dotEdges = new Int32Array(4 * D).fill(-1);
  const dotCells = new Int32Array(4 * D).fill(-1);
  for (let r = 0; r <= n; r++) {
    for (let c = 0; c <= n; c++) {
      const b = 4 * (r * (n + 1) + c);
      if (r > 0) dotEdges[b] = vId(r - 1, c);
      if (c < n) dotEdges[b + 1] = hId(r, c);
      if (r < n) dotEdges[b + 2] = vId(r, c);
      if (c > 0) dotEdges[b + 3] = hId(r, c - 1);
      // políčka okolo bodky: vľavo hore, vpravo hore, vľavo dole, vpravo dole
      if (r > 0 && c > 0) dotCells[b] = (r - 1) * n + (c - 1);
      if (r > 0 && c < n) dotCells[b + 1] = (r - 1) * n + c;
      if (r < n && c > 0) dotCells[b + 2] = r * n + (c - 1);
      if (r < n && c < n) dotCells[b + 3] = r * n + c;
    }
  }
  const edgeDots = new Int32Array(2 * E);
  const edgeCells = new Int32Array(2 * E).fill(-1);
  const edgeTyp = new Uint8Array(E), edgeR = new Int32Array(E), edgeC = new Int32Array(E);
  for (let r = 0; r <= n; r++) {
    for (let c = 0; c < n; c++) {
      const e = hId(r, c);
      edgeTyp[e] = 0; edgeR[e] = r; edgeC[e] = c;
      edgeDots[2 * e] = r * (n + 1) + c; edgeDots[2 * e + 1] = r * (n + 1) + c + 1;
      if (r > 0) edgeCells[2 * e] = (r - 1) * n + c;
      if (r < n) edgeCells[2 * e + 1] = r * n + c;
    }
  }
  for (let r = 0; r < n; r++) {
    for (let c = 0; c <= n; c++) {
      const e = vId(r, c);
      edgeTyp[e] = 1; edgeR[e] = r; edgeC[e] = c;
      edgeDots[2 * e] = r * (n + 1) + c; edgeDots[2 * e + 1] = (r + 1) * (n + 1) + c;
      if (c > 0) edgeCells[2 * e] = r * n + (c - 1);
      if (c < n) edgeCells[2 * e + 1] = r * n + c;
    }
  }
  const g = { n, E, H, V0, D, C, hId, vId, cellEdges, dotEdges, dotCells, edgeDots, edgeCells, edgeTyp, edgeR, edgeC };
  GEO.set(n, g);
  return g;
}

/* Hrana ako objekt { typ:'h'|'v', r, c } a späť na index. */
export function hrana(e, n) {
  const g = geometria(n);
  return { typ: g.edgeTyp[e] ? 'v' : 'h', r: g.edgeR[e], c: g.edgeC[e] };
}
export function indexHrany(typ, r, c, n) {
  const g = geometria(n);
  return typ === 'h' ? g.hId(r, c) : g.vId(r, c);
}

/* Hráčove (alebo riešiteľove) hrany { h, v } (0/1/2) do jedného stavu a späť.
   hranyZoStavu vráti 0/1 (len čiary), s `surove` aj krížiky (2). */
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

/* ── Oblasť, slučka, čísla ───────────────────────────────────────────── */

/* Bodka (dr, dc) po pridaní políčka: sú okolo nej práve dve políčka oblasti
   a ležia diagonálne? To by bolo kríženie slučky. */
function diagonalnyDotyk(inR, n, dr, dc) {
  const je = (r, c) => r >= 0 && c >= 0 && r < n && c < n && inR[r * n + c] === 1;
  const a = je(dr - 1, dc - 1), b = je(dr - 1, dc), c = je(dr, dc - 1), d = je(dr, dc);
  const pocet = a + b + c + d;
  return pocet === 2 && ((a && d) || (b && c));
}

/* Je doplnok oblasti (spolu s vonkajškom) 4-súvislý? Inak má oblasť dieru. */
function bezDier(inR, n) {
  const seen = new Uint8Array(n * n);
  const q = new Int32Array(n * n);
  let qn = 0, total = 0;
  for (let i = 0; i < n * n; i++) if (!inR[i]) total++;
  for (let i = 0; i < n * n; i++) {
    const r = (i / n) | 0, c = i % n;
    if (!inR[i] && (r === 0 || c === 0 || r === n - 1 || c === n - 1)) { seen[i] = 1; q[qn++] = i; }
  }
  let reached = 0;
  for (let qi = 0; qi < qn; qi++) {
    const i = q[qi]; reached++;
    const r = (i / n) | 0, c = i % n;
    const sus = [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1];
    for (const j of sus) if (j >= 0 && !inR[j] && !seen[j]) { seen[j] = 1; q[qn++] = j; }
  }
  return reached === total;
}

/* Náhodná 4-súvislá oblasť políčok bez dier a bez diagonálneho dotyku.
   Rastie z náhodného políčka; radšej pridáva políčka s jediným susedom v
   oblasti (tenké ramená robia dlhšiu, zaujímavejšiu rieku). Vráti
   Uint8Array n*n (1 = políčko vnútri rieky), alebo null, keď sa nedorástla
   aspoň na 60 percent cieľa. */
export function randomRegion(rng, n, hustota) {
  const ciel = Math.max(2, Math.round(hustota * n * n));
  const inR = new Uint8Array(n * n);
  let size = 1;
  inR[Math.floor(rng() * n * n)] = 1;
  while (size < ciel) {
    const kand = [], vahy = [];
    let suma = 0;
    for (let i = 0; i < n * n; i++) {
      if (inR[i]) continue;
      const r = (i / n) | 0, c = i % n;
      let k = 0;
      if (r > 0 && inR[i - n]) k++;
      if (r < n - 1 && inR[i + n]) k++;
      if (c > 0 && inR[i - 1]) k++;
      if (c < n - 1 && inR[i + 1]) k++;
      if (!k) continue;
      inR[i] = 1;
      let ok = !diagonalnyDotyk(inR, n, r, c) && !diagonalnyDotyk(inR, n, r, c + 1)
        && !diagonalnyDotyk(inR, n, r + 1, c) && !diagonalnyDotyk(inR, n, r + 1, c + 1);
      if (ok && k >= 2) ok = bezDier(inR, n);
      inR[i] = 0;
      if (!ok) continue;
      const w = k === 1 ? 3 : k === 2 ? 1 : 0.3;
      kand.push(i); vahy.push(w); suma += w;
    }
    if (!kand.length) break;
    let x = rng() * suma, pick = kand[kand.length - 1];
    for (let j = 0; j < kand.length; j++) { x -= vahy[j]; if (x < 0) { pick = kand[j]; break; } }
    inR[pick] = 1;
    size++;
  }
  if (size < 0.6 * ciel) return null;
  return inR;
}

/* Hranica oblasti ako hrany { h, v } z 0/1. */
export function loopFromRegion(region, n) {
  const je = (r, c) => (r >= 0 && c >= 0 && r < n && c < n && region[r * n + c] === 1 ? 1 : 0);
  const h = new Array((n + 1) * n), v = new Array(n * (n + 1));
  for (let r = 0; r <= n; r++) for (let c = 0; c < n; c++) h[r * n + c] = je(r - 1, c) !== je(r, c) ? 1 : 0;
  for (let r = 0; r < n; r++) for (let c = 0; c <= n; c++) v[r * (n + 1) + c] = je(r, c - 1) !== je(r, c) ? 1 : 0;
  return { h, v };
}

/* Počet čiar okolo každého políčka (ploché pole n*n). */
export function cluesFromLoop(edges, n) {
  const out = new Array(n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      out[r * n + c] = (edges.h[r * n + c] === 1) + (edges.h[(r + 1) * n + c] === 1)
        + (edges.v[r * (n + 1) + c] === 1) + (edges.v[r * (n + 1) + c + 1] === 1);
    }
  }
  return out;
}

/* ── Riešiteľ: spoločné jadro ────────────────────────────────────────── *
 * Kontext drží stav hrán, front hrán na prepočet, príznak sporu a (pri
 * ľudskom riešení) zoznam krokov. `layer` hovorí, či sa v propagácii smú
 * použiť aj dynamické pravidlá vrstvy 2 (čiara vchádzajúca do 1 alebo 3). */
function kontext(geo, clues, st, layer, steps) {
  return {
    geo, clues, st, layer, steps, step: null,
    q: new Int32Array(geo.E), qi: 0, qn: 0, bad: false, stop: false, limitKrokov: 0,
    uf: new Int32Array(geo.D), ce: new Int32Array(geo.D), cd: new Int32Array(geo.D),
    deg: new Uint8Array(geo.D), cellL: new Uint8Array(geo.C),
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

/* Vrstva 1 pri bodke: 0 alebo 2 čiary. Pri vrstve 2 aj čiara vchádzajúca do
   rohu políčka s 1 alebo 3. */
function skontrolujBodku(k, d) {
  const de = k.geo.dotEdges, st = k.st, b = d << 2;
  let L = 0, U = 0, u1 = -1, lineE = -1;
  for (let i = 0; i < 4; i++) {
    const e = de[b + i];
    if (e < 0) continue;
    const s = st[e];
    if (s === 1) { L++; lineE = e; } else if (s === 0) { U++; if (u1 < 0) u1 = e; }
  }
  if (L > 2) { k.bad = true; return; }
  if (L === 2) {
    if (U) {
      zacniKrok(k, 'dot-two-lines', 1, d);
      for (let i = 0; i < 4; i++) { const e = de[b + i]; if (e >= 0 && st[e] === 0) nastav(k, e, 2); }
      ukonciKrok(k);
    }
    return;
  }
  if (L === 1) {
    if (U === 0) { k.bad = true; return; }
    if (U === 1) { zacniKrok(k, 'dot-one-way', 1, d); nastav(k, u1, 1); ukonciKrok(k); return; }
    if (k.layer >= 2) vstupDoPolicka(k, d, lineE);
    return;
  }
  if (U === 1) { zacniKrok(k, 'dot-dead-end', 1, d); nastav(k, u1, 2); ukonciKrok(k); }
}

/* Vrstva 2: čiara `lineE` prichádza do bodky d zvonku políčka s 1 alebo 3.
   Pri 3 sú obe vzdialené strany čiary a štvrtá hrana bodky krížik; pri 1
   (ak sa čiara nemôže vyhnúť políčku) sú obe vzdialené strany krížiky. */
function vstupDoPolicka(k, d, lineE) {
  const g = k.geo, st = k.st, clues = k.clues, b = d << 2;
  for (let j = 0; j < 4; j++) {
    const i = g.dotCells[b + j];
    if (i < 0) continue;
    const kk = clues[i];
    if (kk !== 1 && kk !== 3) continue;
    let n1 = -1, n2 = -1, f1 = -1, f2 = -1;
    for (let m = 0; m < 4; m++) {
      const e = g.cellEdges[4 * i + m];
      if (g.edgeDots[2 * e] === d || g.edgeDots[2 * e + 1] === d) { if (n1 < 0) n1 = e; else n2 = e; }
      else if (f1 < 0) f1 = e; else f2 = e;
    }
    if (lineE === n1 || lineE === n2) continue;
    let other = -1;
    for (let m = 0; m < 4; m++) {
      const e = g.dotEdges[b + m];
      if (e >= 0 && e !== lineE && e !== n1 && e !== n2) other = e;
    }
    if (kk === 3) {
      zacniKrok(k, 'enter-three', 2, i);
      nastav(k, f1, 1); nastav(k, f2, 1);
      if (other >= 0) nastav(k, other, 2);
      ukonciKrok(k);
    } else if (other < 0 || st[other] === 2) {
      zacniKrok(k, 'enter-one', 2, i);
      nastav(k, f1, 2); nastav(k, f2, 2);
      ukonciKrok(k);
    }
    if (k.bad || k.stop) return;
  }
}

/* Vrstva 1 pri políčku s číslom: má presne toľko čiar. */
function skontrolujPolicko(k, i) {
  const kk = k.clues[i];
  if (kk == null) return;
  const ce = k.geo.cellEdges, st = k.st, b = i << 2;
  let L = 0, U = 0;
  for (let m = 0; m < 4; m++) { const s = st[ce[b + m]]; if (s === 1) L++; else if (s === 0) U++; }
  if (L > kk || L + U < kk) { k.bad = true; return; }
  if (!U) return;
  if (L === kk) {
    zacniKrok(k, kk === 0 ? 'zero' : 'cell-full', 1, i);
    for (let m = 0; m < 4; m++) if (st[ce[b + m]] === 0) nastav(k, ce[b + m], 2);
    ukonciKrok(k);
  } else if (L + U === kk) {
    zacniKrok(k, 'cell-needs-all', 1, i);
    for (let m = 0; m < 4; m++) if (st[ce[b + m]] === 0) nastav(k, ce[b + m], 1);
    ukonciKrok(k);
  }
}

/* Prepočíta bodky a políčka okolo každej zmenenej hrany, kým sa niečo mení. */
function propaguj(k) {
  const g = k.geo;
  while (k.qi < k.qn && !k.bad && !k.stop) {
    const e = k.q[k.qi++];
    skontrolujBodku(k, g.edgeDots[2 * e]); if (k.bad) break;
    skontrolujBodku(k, g.edgeDots[2 * e + 1]); if (k.bad) break;
    const c1 = g.edgeCells[2 * e], c2 = g.edgeCells[2 * e + 1];
    if (c1 >= 0) { skontrolujPolicko(k, c1); if (k.bad) break; }
    if (c2 >= 0) skontrolujPolicko(k, c2);
  }
  if (!k.stop) k.qi = k.qn = 0;
  return !k.bad;
}

/* Začiatok: 3 v rohu (vrstva 1), potom všetky políčka a bodky raz. */
function zaciatok(k) {
  const g = k.geo, n = g.n, clues = k.clues;
  const rohy = [
    [0, g.hId(0, 0), g.vId(0, 0)], [n - 1, g.hId(0, n - 1), g.vId(0, n)],
    [(n - 1) * n, g.hId(n, 0), g.vId(n - 1, 0)], [n * n - 1, g.hId(n, n - 1), g.vId(n - 1, n)],
  ];
  for (const [i, a, b] of rohy) {
    if (clues[i] !== 3) continue;
    zacniKrok(k, 'three-corner', 1, i); nastav(k, a, 1); nastav(k, b, 1); ukonciKrok(k);
    if (k.bad || k.stop) return;
  }
  for (let i = 0; i < g.C && !k.bad && !k.stop; i++) skontrolujPolicko(k, i);
  for (let d = 0; d < g.D && !k.bad && !k.stop; d++) skontrolujBodku(k, d);
  propaguj(k);
}

function najdi(uf, x) {
  while (uf[x] !== x) { uf[x] = uf[uf[x]]; x = uf[x]; }
  return x;
}

/* Rozbor čiar: komponenty, stupne bodiek, uzavreté slučky, splnené čísla.
   Používa odkladacie polia kontextu (deg, uf, ce, cd, cellL). */
function stavSlucok(k) {
  const g = k.geo, st = k.st, E = g.E, D = g.D, uf = k.uf, ce = k.ce, cd = k.cd, deg = k.deg, cellL = k.cellL;
  for (let d = 0; d < D; d++) { uf[d] = d; ce[d] = 0; cd[d] = 0; deg[d] = 0; }
  let total = 0;
  for (let e = 0; e < E; e++) {
    if (st[e] !== 1) continue;
    total++;
    const a = g.edgeDots[2 * e], b = g.edgeDots[2 * e + 1];
    deg[a]++; deg[b]++;
    const ra = najdi(uf, a), rb = najdi(uf, b);
    if (ra !== rb) uf[ra] = rb;
  }
  for (let e = 0; e < E; e++) if (st[e] === 1) ce[najdi(uf, g.edgeDots[2 * e])]++;
  for (let d = 0; d < D; d++) if (deg[d]) cd[najdi(uf, d)]++;
  let cycles = 0, cycleEdges = 0;
  for (let d = 0; d < D; d++) if (uf[d] === d && ce[d] > 0 && ce[d] === cd[d]) { cycles++; cycleEdges += ce[d]; }
  let cluesOK = true;
  for (let i = 0; i < g.C; i++) {
    let L = 0;
    for (let m = 0; m < 4; m++) if (st[g.cellEdges[4 * i + m]] === 1) L++;
    cellL[i] = L;
    if (k.clues[i] != null && k.clues[i] !== L) cluesOK = false;
  }
  return { cycles, cycleEdges, total, cluesOK };
}
/* Uzavretá slučka je spor, keď mimo nej ostali čiary alebo nesplnené čísla. */
function slukaJeSpor(s) {
  return s.cycles > 0 && (s.cycles > 1 || s.cycleEdges < s.total || !s.cluesOK);
}

/* ── solve: strojový riešiteľ ────────────────────────────────────────── *
 * solve(clues, n, { limit = 2, rules = 2, initial, maxNodes = 0 })
 *   propagácia (bodka 0 alebo 2 čiary, políčko presne toľko čiar, krížik kde
 *   čiara nemôže byť; rules 2 pridá aj čiaru vchádzajúcu do 1 alebo 3), po
 *   nej vetvenie s návratom. Riešenie musí byť práve jedna uzavretá slučka:
 *   uzavretá slučka s čiarami mimo nej alebo nesplneným číslom je spor,
 *   dve slučky nie sú riešenie.
 *   maxNodes zastaví hľadanie po toľkých vetvách (0 = bez stropu). Pri
 *   zastavení je count neúplný, preto vráti aj vycerpane: true; volajúci
 *   sa vtedy nesmie tváriť, že vie počet riešení. Strop je deterministický
 *   (počíta sa vždy rovnako), takže zadanie ostáva pre daný kľúč rovnaké.
 * Vráti { count (do limit), solution:{h, v} prvého riešenia alebo null,
 * nodes, vycerpane }. */
export function solve(clues, n, opts = {}) {
  const limit = opts.limit ?? 2, rules = opts.rules ?? 2, maxNodes = opts.maxNodes ?? 0;
  const g = geometria(n);
  const st = opts.initial ? Uint8Array.from(opts.initial) : new Uint8Array(g.E);
  const k0 = kontext(g, clues, st, rules, null);
  let count = 0, first = null, nodes = 0, vycerpane = false;
  zaciatok(k0);

  function vyberHranu(k) {
    const st = k.st, deg = k.deg, de = g.dotEdges;
    for (let d = 0; d < g.D; d++) {
      if (deg[d] !== 1) continue;
      for (let i = 0; i < 4; i++) { const e = de[4 * d + i]; if (e >= 0 && st[e] === 0) return e; }
    }
    let best = -1, bestU = 9;
    for (let i = 0; i < g.C; i++) {
      const kk = clues[i];
      if (kk == null) continue;
      let L = 0, U = 0;
      for (let m = 0; m < 4; m++) { const s = st[g.cellEdges[4 * i + m]]; if (s === 1) L++; else if (s === 0) U++; }
      if (U > 0 && L < kk && U < bestU) { best = i; bestU = U; }
    }
    if (best >= 0) for (let m = 0; m < 4; m++) { const e = g.cellEdges[4 * best + m]; if (st[e] === 0) return e; }
    for (let e = 0; e < g.E; e++) if (st[e] === 0) return e;
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
      propaguj(k2);
      rek(k2);
      if (vycerpane || count >= limit) return;
    }
  }
  rek(k0);
  return { count, solution: first ? hranyZoStavu(first, n) : null, nodes, vycerpane };
}

/* ── solveHuman: len ľudské pravidlá, bez hádania ────────────────────── */

/* Vrstva 2: vzory z čísel (dve 3 vedľa seba, 3 vedľa 0, 3 diagonálne k 3,
   1 v rohu, 2 v rohu) a čiara vchádzajúca do 1 alebo 3. Vráti true, keď
   niečo nastavila (alebo narazila na spor). */
function krokVrstvy2(k) {
  const g = k.geo, n = g.n, clues = k.clues, st = k.st;
  const pred = k.steps.length;
  const hotovo = () => k.bad || k.steps.length > pred;
  for (let i = 0; i < g.C; i++) {
    const kk = clues[i];
    if (kk == null) continue;
    const r = (i / n) | 0, c = i % n;
    if (kk === 3) {
      if (c + 1 < n && clues[i + 1] === 3) {
        zacniKrok(k, 'three-three', 2, [i, i + 1]);
        nastav(k, g.vId(r, c + 1), 1); nastav(k, g.vId(r, c), 1); nastav(k, g.vId(r, c + 2), 1);
        if (r > 0) nastav(k, g.vId(r - 1, c + 1), 2);
        if (r + 1 < n) nastav(k, g.vId(r + 1, c + 1), 2);
        ukonciKrok(k); if (hotovo()) return true;
      }
      if (r + 1 < n && clues[i + n] === 3) {
        zacniKrok(k, 'three-three', 2, [i, i + n]);
        nastav(k, g.hId(r + 1, c), 1); nastav(k, g.hId(r, c), 1); nastav(k, g.hId(r + 2, c), 1);
        if (c > 0) nastav(k, g.hId(r + 1, c - 1), 2);
        if (c + 1 < n) nastav(k, g.hId(r + 1, c + 1), 2);
        ukonciKrok(k); if (hotovo()) return true;
      }
      const susedia = [r > 0 ? i - n : -1, r + 1 < n ? i + n : -1, c > 0 ? i - 1 : -1, c + 1 < n ? i + 1 : -1];
      for (let m = 0; m < 4; m++) {
        const j = susedia[m];
        if (j < 0 || clues[j] !== 0) continue;
        // spoločná hrana je strana m políčka i (hore, dole, vľavo, vpravo)
        const spolocna = [g.hId(r, c), g.hId(r + 1, c), g.vId(r, c), g.vId(r, c + 1)][m];
        zacniKrok(k, 'three-zero', 2, i);
        for (let q = 0; q < 4; q++) { const e = g.cellEdges[4 * i + q]; if (e !== spolocna) nastav(k, e, 1); }
        ukonciKrok(k); if (hotovo()) return true;
      }
      if (r + 1 < n && c + 1 < n && clues[i + n + 1] === 3) {
        zacniKrok(k, 'three-diag', 2, [i, i + n + 1]);
        nastav(k, g.hId(r, c), 1); nastav(k, g.vId(r, c), 1);
        nastav(k, g.hId(r + 2, c + 1), 1); nastav(k, g.vId(r + 1, c + 2), 1);
        ukonciKrok(k); if (hotovo()) return true;
      }
      if (r + 1 < n && c > 0 && clues[i + n - 1] === 3) {
        zacniKrok(k, 'three-diag', 2, [i, i + n - 1]);
        nastav(k, g.hId(r, c), 1); nastav(k, g.vId(r, c + 1), 1);
        nastav(k, g.hId(r + 2, c - 1), 1); nastav(k, g.vId(r + 1, c - 1), 1);
        ukonciKrok(k); if (hotovo()) return true;
      }
    }
    const roh = (r === 0 || r === n - 1) && (c === 0 || c === n - 1);
    if (roh && kk === 1) {
      zacniKrok(k, 'one-corner', 2, i);
      nastav(k, r === 0 ? g.hId(0, c) : g.hId(n, c), 2);
      nastav(k, c === 0 ? g.vId(r, 0) : g.vId(r, n), 2);
      ukonciKrok(k); if (hotovo()) return true;
    }
    if (roh && kk === 2 && n >= 2) {
      zacniKrok(k, 'two-corner', 2, i);
      const rr = r === 0 ? 0 : n, cc = c === 0 ? 0 : n;
      nastav(k, g.hId(rr, c === 0 ? 1 : n - 2), 1);
      nastav(k, g.vId(r === 0 ? 1 : n - 2, cc), 1);
      ukonciKrok(k); if (hotovo()) return true;
    }
  }
  const de = g.dotEdges;
  for (let d = 0; d < g.D; d++) {
    let L = 0, lineE = -1;
    for (let m = 0; m < 4; m++) { const e = de[4 * d + m]; if (e >= 0 && st[e] === 1) { L++; lineE = e; } }
    if (L !== 1) continue;
    vstupDoPolicka(k, d, lineE);
    if (hotovo()) return true;
  }
  return false;
}

/* Skúška: nastav hranu e na val, propaguj vrstvy 1 a 2, vráť true pri spore
   (vrátane predčasne uzavretej slučky). */
function skus(k, t, e, val) {
  t.st.set(k.st); t.qi = t.qn = 0; t.bad = false;
  nastav(t, e, val);
  if (!propaguj(t)) return true;
  return slukaJeSpor(stavSlucok(t));
}

/* Vrstva 3: krátka slučka (hrana, ktorá by uzavrela rieku skôr, než sú
   splnené všetky čísla, je krížik) a jednokroková skúška každej hrany. */
function krokVrstvy3(k) {
  const g = k.geo, st = k.st, E = g.E, clues = k.clues;
  const s = stavSlucok(k);
  const deg = k.deg, uf = k.uf, ce = k.ce, cellL = k.cellL;
  for (let e = 0; e < E; e++) {
    if (st[e] !== 0) continue;
    const a = g.edgeDots[2 * e], b = g.edgeDots[2 * e + 1];
    if (deg[a] !== 1 || deg[b] !== 1) continue;
    const ra = najdi(uf, a);
    if (ra !== najdi(uf, b)) continue;
    let uplne = ce[ra] === s.total;
    if (uplne) {
      const c1 = g.edgeCells[2 * e], c2 = g.edgeCells[2 * e + 1];
      for (let i = 0; i < g.C && uplne; i++) {
        if (clues[i] == null) continue;
        if (cellL[i] + (i === c1 || i === c2 ? 1 : 0) !== clues[i]) uplne = false;
      }
    }
    if (!uplne) { zacniKrok(k, 'short-loop', 3, e); nastav(k, e, 2); ukonciKrok(k); return true; }
  }
  if (!k.t) { k.t = kontext(g, clues, new Uint8Array(E), 2, null); }
  const t = k.t;
  for (let e = 0; e < E; e++) {
    if (st[e] !== 0) continue;
    if (skus(k, t, e, 1)) { zacniKrok(k, 'trial-cross', 3, e); nastav(k, e, 2); ukonciKrok(k); return true; }
    if (skus(k, t, e, 2)) { zacniKrok(k, 'trial-line', 3, e); nastav(k, e, 1); ukonciKrok(k); return true; }
  }
  return false;
}

/* solveHuman(clues, n, { initial, limitKrokov, maxVrstva })
 *   Rieši len ľudskými pravidlami v troch vrstvách, bez hádania: vrstva 1
 *   (miestne pravidlá bodky a políčka, 0, 3 v rohu), vrstva 2 (vzory),
 *   vrstva 3 (krátka slučka a jednokroková skúška). Ľahšia vrstva má vždy
 *   prednosť; ťažšia príde na rad, až keď ľahšie nič nenájdu.
 *   initial: voliteľný začiatočný stav (Uint8Array 0/1/2, napr. hráčove
 *   správne značky); limitKrokov: skončiť po toľkých krokoch (nápoveda: 1).
 * Vráti { solved, layersUsed:{1,2,3}, steps, solution, state }, kde steps sú
 * kroky { rule, layer, edges:[{ typ, r, c, val }], text } s anglickým
 * vysvetlením. */
export function solveHuman(clues, n, opts = {}) {
  const g = geometria(n);
  const st = opts.initial ? Uint8Array.from(opts.initial) : new Uint8Array(g.E);
  const steps = [];
  const k = kontext(g, clues, st, 1, steps);
  k.limitKrokov = opts.limitKrokov || 0;
  // maxVrstva: najvyššia dovolená vrstva pravidiel (2 = riešiteľné bez skúšok)
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
    steps: steps.map((s) => verejnyKrok(s, g, clues)),
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
function bodka(d, n) {
  const r = (d / (n + 1)) | 0, c = d % (n + 1);
  return 'the dot in row ' + (r + 1) + ', column ' + (c + 1) + ' of the dots';
}
function popisHrany(e, g) {
  const n = g.n, r = g.edgeR[e], c = g.edgeC[e];
  if (g.edgeTyp[e] === 0) {
    return r < n ? 'the top side of the patch ' + poloha(r * n + c, n) : 'the bottom side of the patch ' + poloha((n - 1) * n + c, n);
  }
  return c < n ? 'the left side of the patch ' + poloha(r * n + c, n) : 'the right side of the patch ' + poloha(r * n + n - 1, n);
}
function verejnyKrok(s, g, clues) {
  const n = g.n;
  const edges = [];
  for (let j = 0; j < s.edges.length; j += 2) edges.push({ ...hrana(s.edges[j], n), val: s.edges[j + 1] });
  return { rule: s.rule, layer: s.layer, edges, text: textKroku(s, g, edges, clues) };
}
function textKroku(s, g, edges, clues) {
  const n = g.n, i = s.info;
  const k = typeof i === 'number' && i >= 0 ? clues[i] : null;
  const pocet = edges.length;
  switch (s.rule) {
    case 'zero':
      return 'The 0 ' + poloha(i, n) + ': the river runs along none of its sides, so all four are crossed.';
    case 'three-corner':
      return 'The 3 ' + poloha(i, n) + ': a loop cannot turn back on itself, so both outer sides are part of the river.';
    case 'cell-full':
      return 'The ' + k + ' ' + poloha(i, n) + ' already has ' + (k === 1 ? 'its one line' : 'its ' + k + ' lines') + ', so ' + (pocet === 1 ? 'its last open side is' : 'its other open sides are') + ' crossed.';
    case 'cell-needs-all':
      return 'The ' + k + ' ' + poloha(i, n) + ' has exactly as many open sides left as it needs, so the river runs along ' + (pocet === 1 ? 'the last one' : 'all of them') + '.';
    case 'dot-two-lines':
      return 'Two lines already meet at ' + bodka(i, n) + ': the river cannot branch, so ' + (pocet === 1 ? 'its remaining side is' : 'its remaining sides are') + ' crossed.';
    case 'dot-one-way':
      return 'The line reaching ' + bodka(i, n) + ' has only one way on, so the river continues there.';
    case 'dot-dead-end':
      return 'A line into ' + bodka(i, n) + ' would have nowhere to go on, so this side is crossed.';
    case 'loop-done':
      return 'The river is closed and every number is satisfied, so every other side is crossed.';
    case 'three-three':
      return 'Two 3s side by side (' + poloha(i[0], n) + ' and ' + poloha(i[1], n) + '): the river must use the side between them and both outer sides, and cannot run straight on past the shared side.';
    case 'three-zero':
      return 'The 3 ' + poloha(i, n) + ' sits next to a 0, so the river runs along its other three sides.';
    case 'three-diag':
      return 'Two 3s touch at a corner (' + poloha(i[0], n) + ' and ' + poloha(i[1], n) + '): each must take the two sides away from that corner.';
    case 'one-corner':
      return 'The 1 ' + poloha(i, n) + ': a line along one outer side would have to turn into the other and use two, so both outer sides are crossed.';
    case 'two-corner':
      return 'The 2 ' + poloha(i, n) + ': whichever two sides the river takes, it has to run on along the border on both sides of the corner.';
    case 'enter-three':
      return 'A line reaches a corner of the 3 ' + poloha(i, n) + ': it can use at most one side there, so the two far sides are part of the river and the line does not pass by.';
    case 'enter-one':
      return 'A line reaches a corner of the 1 ' + poloha(i, n) + ' and cannot pass by, so it runs along one of the two near sides and the two far sides are crossed.';
    case 'short-loop':
      return 'Joining the two ends at ' + popisHrany(i, g) + ' would close the river before every number is satisfied, so this side is crossed.';
    case 'trial-cross':
      return 'If the river ran along ' + popisHrany(i, g) + ', the numbers and dots around it could not be satisfied, so it is crossed.';
    case 'trial-line':
      return 'If ' + popisHrany(i, g) + ' were crossed, the river around it could not continue, so it must run along that side.';
    default:
      return 'A step of the river.';
  }
}

/* ── Denná rieka ─────────────────────────────────────────────────────── *
 * generate(dateStr, opts) picks n (default 6) and calls generateSeeded with
 * the date as both name and key, so every date keeps the river it always
 * had. opts: n, hustota, maxAttempts (default 200). */
export function generate(dateStr, opts = {}) {
  if (!isValidDate(dateStr)) throw new Error('Date must be in YYYY-MM-DD form: ' + dateStr);
  const n = opts.n ?? 6;
  return generateSeeded(dateStr, dateStr + '/' + n, opts);
}

/* Náhodné poradie (Fisher-Yates) z rng. */
function zamiesaj(rng, m) {
  const a = Array.from({ length: m }, (_, i) => i);
  for (let i = m - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

function rovnakeHrany(a, b) {
  return a.h.join('') === b.h.join('') && a.v.join('') === b.v.join('');
}

/* The same as generate, but the random seed comes from `key` (any string)
 * and `name` is only stored in the result as `date`. Practice rivers and
 * the daily candidates use it. Deterministic: the same key gives the same
 * puzzle.
 * Returns { date, n, clues (flat n*n, 0..3 or null), solution:{h, v} (0/1),
 * seed, attempts, difficulty:{ layers:{1,2,3}, clues, steps }, ms }. */
export function generateSeeded(name, key, opts = {}) {
  const n = opts.n ?? 6;
  const maxAttempts = opts.maxAttempts ?? 200;
  const maxVrstva = opts.maxVrstva ?? 3;
  // Strop na vetvenie pri kontrole jednoznačnosti. Bez neho sa riešiteľ na
  // veľmi riedkom zadaní zamotá na desiatky sekúnd; s ním sa také odobratie
  // čísla proste neprijme a číslo na doske ostane.
  const maxNodes = opts.maxNodes ?? 4000;
  const t0 = nowMs();
  const seed = seedFromString(key);
  const rng = mulberry32(seed);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const hustota = opts.hustota ?? (0.3 + rng() * 0.3);
    const region = randomRegion(rng, n, hustota);
    if (!region) continue;
    const edges = loopFromRegion(region, n);
    const plne = cluesFromLoop(edges, n);
    const clues = plne.slice();
    // rieka musí byť riešiteľná ľudsky už so všetkými číslami
    const uvod = solveHuman(clues, n, { maxVrstva });
    if (!uvod.solved || !rovnakeHrany(uvod.solution, edges)) continue;
    for (let pass = 0; pass < 2; pass++) {
      const poradie = zamiesaj(rng, n * n);
      for (const i of poradie) {
        if (clues[i] == null) continue;
        const stare = clues[i];
        clues[i] = null;
        // Najprv ľudský riešiteľ (odmietne väčšinu odobratí lacno), potom
        // kontrola jednoznačnosti s pevným stropom na vetvenie.
        let ok = solveHuman(clues, n, { maxVrstva }).solved;
        if (ok) { const r = solve(clues, n, { limit: 2, maxNodes }); ok = !r.vycerpane && r.count === 1; }
        if (!ok) clues[i] = stare;
      }
    }
    const fin = solveHuman(clues, n, { maxVrstva });
    if (!fin.solved || !rovnakeHrany(fin.solution, edges)) {
      throw new Error('solveHuman settled on a different river than the source for ' + name);
    }
    let pocet = 0;
    for (const x of clues) if (x != null) pocet++;
    return {
      date: name, n, clues, solution: edges, seed, attempts: attempt,
      difficulty: { layers: fin.layersUsed, clues: pocet, steps: fin.steps.length },
      ms: Math.round((nowMs() - t0) * 10) / 10,
    };
  }
  throw new Error('No unique, guess-free river for ' + name + ' in ' + maxAttempts + ' attempts');
}
