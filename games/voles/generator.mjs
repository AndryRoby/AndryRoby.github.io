/* Voles: generator and solver for the daily flooded meadow puzzle.
 *
 * One file, no dependencies, runs the same in Node and in the browser
 * (game.js imports it as a module, tests.mjs too). Everything is
 * deterministic: a date turns into a number, the number into a sequence of
 * random values, the sequence into a puzzle. The same date gives the same
 * puzzle on every machine, so the server never has to compute or store
 * anything.
 *
 * Rules of the game (our own wording): a meadow of n x n cells is flooding.
 * Some cells carry a number. Every number is one vole family and says how
 * many cells their island has, counting the numbered cell itself. Shade the
 * water so that every island holds exactly one number and exactly that many
 * cells, islands never touch by a side (corners are fine), all the water
 * hangs together as one piece, and no two by two block is all water.
 *
 * Representation: `clues` is a flat n*n array, a number or null. The solution
 * is a flat n*n array, 0 an island cell and 1 a water cell. Inside the solver
 * the board lives in one Uint8Array `st` of the same length, using the same
 * three values the player's board uses: 0 not decided, 1 water, 2 island.
 * That is on purpose, so a player's marks can be handed to the solver as the
 * starting point of a hint without any conversion.
 *
 * Generation (generateSeeded):
 *   1. flood a random meadow: the water grows one cell at a time, always
 *      beside water it already has and never where it would fill a two by two
 *      block, so it comes out in one piece and legal by construction. What
 *      the water leaves behind are the islands; any island bigger than the
 *      size limit gets more water until it is small enough,
 *   2. put each island's number on a random cell of that island,
 *   3. repair the meadow until it has exactly one answer (solve) and a person
 *      can finish it without guessing (solveHuman). Two levers: move an
 *      island's number onto a cell the two answers disagree about, and, when
 *      that is not enough, flood that cell so the island shrinks by one. The
 *      second lever always takes one cell away, so this cannot run in
 *      circles: at worst it ends with islands of one cell, and those leave
 *      nothing to guess,
 *   4. minimise the puzzle: walk the islands in random order and flood one
 *      away for good whenever the smaller puzzle still has exactly one answer
 *      and is still solvable by hand,
 *   5. if a meadow cannot be repaired, try another one, up to `maxAttempts`.
 *
 * Difficulty, returned as `difficulty`:
 *   layers  how many steps the human solver needed from each layer of rules
 *           (1 the local ones, 2 the ones that look further, 3 a trial),
 *   clues   how many numbers are left on the board,
 *   steps   the total number of steps.
 * plan.mjs ranks candidates by layer 3 first, then layer 2, then layer 1.
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
 * Pre každé n raz spočítané a odložené: štyria susedia každého políčka
 * (hore, vpravo, dole, vľavo; -1 mimo mriežky). */
const GEO = new Map();
export function geometria(n) {
  if (GEO.has(n)) return GEO.get(n);
  const C = n * n;
  const susedia = new Int32Array(4 * C).fill(-1);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c, b = 4 * i;
      susedia[b] = r > 0 ? i - n : -1;
      susedia[b + 1] = c + 1 < n ? i + 1 : -1;
      susedia[b + 2] = r + 1 < n ? i + n : -1;
      susedia[b + 3] = c > 0 ? i - 1 : -1;
    }
  }
  const g = { n, C, susedia };
  GEO.set(n, g);
  return g;
}

/* Políčko ako { r, c } a späť na index. */
export function policko(i, n) { const r = (i / n) | 0; return { r, c: i - r * n }; }
export function indexPolicka(r, c, n) { return r * n + c; }

/* ── Pomôcky nad hotovou mriežkou (1 = ostrov, 0 = voda) ─────────────── */

/* Je voda neprázdna a v jednom kuse? */
export function suvislaVoda(ostrov, n) {
  const g = geometria(n), C = g.C, sus = g.susedia;
  let start = -1, vody = 0;
  for (let i = 0; i < C; i++) if (!ostrov[i]) { vody++; if (start < 0) start = i; }
  if (start < 0) return false;
  const videne = new Uint8Array(C);
  const front = [start];
  videne[start] = 1;
  let n2 = 1;
  while (front.length) {
    const x = front.pop();
    for (let m = 0; m < 4; m++) {
      const y = sus[4 * x + m];
      if (y >= 0 && !ostrov[y] && !videne[y]) { videne[y] = 1; n2++; front.push(y); }
    }
  }
  return n2 === vody;
}

/* Je niekde blok vody 2 x 2? */
export function maBlok2x2(ostrov, n) {
  for (let r = 0; r + 1 < n; r++) {
    for (let c = 0; c + 1 < n; c++) {
      const i = r * n + c;
      if (!ostrov[i] && !ostrov[i + 1] && !ostrov[i + n] && !ostrov[i + n + 1]) return true;
    }
  }
  return false;
}

/* Najväčší ostrov podľa veľkosti mriežky: 6 x 6 do 5, 12 x 12 do 9. */
export function maxOstrovPre(n) {
  return Math.max(3, Math.min(9, Math.round(n * 0.75)));
}

/* ── Náhodná zaplavená lúka ──────────────────────────────────────────── *
 * Lúka sa nestavia z ostrovov, ale z vody: voda rastie z jedného políčka a
 * pridáva sa vždy len k sebe a len tam, kde nevznikne blok 2 x 2. Tým sú dve
 * pravidlá splnené už z konštrukcie a nie je čo opravovať. Ostrovy sú potom
 * jednoducho súvislé kusy, ktoré vode ostali; ktorý je väčší než dovolené
 * maximum, ten sa rozdelí ďalšou vodou.
 * Vráti { solution (ploché 0 ostrov / 1 voda), ostrovy: [[indexy]], ostrov
 * (Uint8Array, 1 = ostrov) } alebo null, keď sa lúka nepodarila. */
export function randomRiesenie(rng, n, opts = {}) {
  const g = geometria(n), C = g.C, sus = g.susedia;
  const maxOstrov = opts.maxOstrov ?? maxOstrovPre(n);
  const hustota = opts.hustota ?? 0.32; // podiel ostrovných políčok
  const voda = new Uint8Array(C);
  const cielVody = Math.max(1, Math.min(C - 2, C - Math.round(C * hustota)));

  // Vznikol by pridaním x niekde blok vody 2 x 2?
  const tvoriBlok = (x) => {
    const r = (x / n) | 0, c = x % n;
    for (let dr = -1; dr <= 0; dr++) {
      for (let dc = -1; dc <= 0; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr + 1 >= n || cc + 1 >= n) continue;
        const a = rr * n + cc;
        if ((a === x || voda[a]) && (a + 1 === x || voda[a + 1])
          && (a + n === x || voda[a + n]) && (a + n + 1 === x || voda[a + n + 1])) return true;
      }
    }
    return false;
  };

  const hranica = [];
  const pridajHranicu = (x) => {
    for (let m = 0; m < 4; m++) { const y = sus[4 * x + m]; if (y >= 0 && !voda[y]) hranica.push(y); }
  };
  const start = Math.floor(rng() * C);
  voda[start] = 1;
  let pocetVody = 1;
  pridajHranicu(start);
  // Políčko raz odmietnuté kvôli bloku 2 x 2 sa už nikdy nestane dobrým
  // (vody len pribúda), preto ho z hranice vyhadzujeme natrvalo.
  while (pocetVody < cielVody && hranica.length) {
    const j = Math.floor(rng() * hranica.length);
    const x = hranica[j];
    hranica[j] = hranica[hranica.length - 1];
    hranica.pop();
    if (voda[x] || tvoriBlok(x)) continue;
    voda[x] = 1;
    pocetVody++;
    pridajHranicu(x);
  }
  if (pocetVody < 2) return null;

  // Kusy, ktoré vode ostali. Ktorý je väčší než maximum, tomu pridáme vodu.
  const komponenty = () => {
    const kde = new Int32Array(C).fill(-1);
    const out = [];
    const stack = [];
    for (let i = 0; i < C; i++) {
      if (voda[i] || kde[i] >= 0) continue;
      const id = out.length, cells = [];
      kde[i] = id;
      stack.push(i);
      while (stack.length) {
        const x = stack.pop();
        cells.push(x);
        for (let m = 0; m < 4; m++) { const y = sus[4 * x + m]; if (y >= 0 && !voda[y] && kde[y] < 0) { kde[y] = id; stack.push(y); } }
      }
      out.push(cells);
    }
    return out;
  };

  let ostrovy = komponenty();
  let strop = 0;
  for (;;) {
    const velky = ostrovy.find((cells) => cells.length > maxOstrov);
    if (!velky) break;
    if (strop++ > C) return null;
    const kand = velky.filter((x) => {
      if (tvoriBlok(x)) return false;
      for (let m = 0; m < 4; m++) { const y = sus[4 * x + m]; if (y >= 0 && voda[y]) return true; }
      return false;
    });
    if (!kand.length) return null;
    voda[kand[Math.floor(rng() * kand.length)]] = 1;
    ostrovy = komponenty();
  }
  if (ostrovy.length < 2) return null;

  const ostrov = new Uint8Array(C);
  for (let i = 0; i < C; i++) ostrov[i] = voda[i] ? 0 : 1;
  if (!suvislaVoda(ostrov, n) || maBlok2x2(ostrov, n)) return null;
  return { solution: riesenieZOstrova(ostrov, C), ostrovy, ostrov };
}

/* ── Riešiteľ: spoločné vnútro ───────────────────────────────────────── */

function kontext(g, clues, st, steps) {
  let sucet = 0, najvacsie = 0;
  for (const x of clues) if (x != null) { sucet += x; if (x > najvacsie) najvacsie = x; }
  return {
    geo: g, clues, st, steps: steps || null, krok: null,
    bad: false, stop: false, limitKrokov: 0,
    pocetZmien: 0, pred: 0,
    sucetCisel: sucet, celaVoda: g.C - sucet, maxCislo: najvacsie,
  };
}

function klon(k) {
  return {
    ...k, st: k.st.slice(), steps: null, krok: null,
    bad: false, stop: false, limitKrokov: 0, pocetZmien: 0, pred: 0,
  };
}

/* Nastaví políčko. Konflikt s tým, čo tam už je, je spor. */
function nastav(k, i, val) {
  const st = k.st;
  if (st[i] === val) return;
  if (st[i] !== 0) { k.bad = true; return; }
  st[i] = val;
  k.pocetZmien++;
  if (k.krok) k.krok.cells.push(i, val);
}

function zacni(k, rule, layer, info) {
  k.pred = k.pocetZmien;
  if (k.steps) k.krok = { rule, layer, info, cells: [] };
}

/* Vráti true, keď krok naozaj niečo zmenil (a vtedy ho aj zapíše). */
function ukonci(k) {
  const zmena = k.pocetZmien > k.pred;
  if (k.krok) {
    if (zmena) {
      k.steps.push(k.krok);
      if (k.limitKrokov && k.steps.length >= k.limitKrokov) k.stop = true;
    }
    k.krok = null;
  }
  return zmena;
}

/* Políčko s číslom je vždy ostrov. To nie je krok, to je zadanie. */
function zaciatok(k) {
  const clues = k.clues;
  for (let i = 0; i < clues.length; i++) if (clues[i] != null) nastav(k, i, 2);
}

function maNeznama(k) {
  const st = k.st;
  for (let i = 0; i < st.length; i++) if (st[i] === 0) return true;
  return false;
}

function riesenieZoStavu(st) {
  const out = new Array(st.length);
  for (let i = 0; i < st.length; i++) out[i] = st[i] === 1 ? 1 : 0;
  return out;
}

/* Rozbor dosky: ostrovné kusy s ich číslami a voľnými susedmi, kusy vody,
 * voľné oblasti (všetko, čo nie je ostrov), dosah čísel vzdušnou čiarou aj
 * po ceste. Nastaví k.bad, keď je doska už teraz v spore.
 * man = true dopočíta aj dosah vzdušnou čiarou; potrebuje ho len ľudský
 * riešiteľ (pravidlo vrstvy 1), stroju stačí dosah po ceste. */
/* Pracovné polia pre rozbor. Rozbor sa volá desaťtisíce ráz, tak sa polia
   nealokujú stále nanovo, ale držia sa pre každé n. Nikdy nebežia dva
   rozbory naraz (žiadne pravidlo počas svojho prechodu rozbor nevolá),
   takže zdieľanie je bezpečné. */
const SKRATKY = new Map();
function skratky(n) {
  let s = SKRATKY.get(n);
  if (!s) {
    const C = n * n;
    s = {
      compOf: new Int32Array(C), znak: new Int32Array(C),
      vodaOf: new Int32Array(C), znak2: new Int32Array(C),
      volnyOf: new Int32Array(C), dosah: new Uint8Array(C), dosahMan: new Uint8Array(C),
      fronta: new Int32Array(C), dist: new Int32Array(C), pecat: new Int32Array(C),
      bl1: new Int32Array(C), bl2: new Int32Array(C), stack: [], gen: 0,
    };
    SKRATKY.set(n, s);
  }
  return s;
}

function analyza(k, man) {
  const g = k.geo, n = g.n, C = g.C, sus = g.susedia, st = k.st, clues = k.clues;
  const s = skratky(n);
  const compOf = s.compOf, znak = s.znak, stack = s.stack;
  compOf.fill(-1);
  znak.fill(-1);
  const comps = [];
  let pocetOstrova = 0, pocetVody = 0;
  for (let i = 0; i < C; i++) { if (st[i] === 2) pocetOstrova++; else if (st[i] === 1) pocetVody++; }
  if (pocetOstrova > k.sucetCisel || pocetVody > k.celaVoda) k.bad = true;
  // Lúka bez vody nie je zaplavená lúka: čísla nesmú pokryť celú mriežku.
  if (k.celaVoda < 1) k.bad = true;

  for (let i = 0; i < C; i++) {
    if (st[i] !== 2 || compOf[i] >= 0) continue;
    const id = comps.length;
    const cells = [];
    compOf[i] = id;
    stack.push(i);
    let clue = null, clueCell = -1, dve = false;
    while (stack.length) {
      const x = stack.pop();
      cells.push(x);
      if (clues[x] != null) { if (clue != null) dve = true; else { clue = clues[x]; clueCell = x; } }
      for (let m = 0; m < 4; m++) { const y = sus[4 * x + m]; if (y >= 0 && st[y] === 2 && compOf[y] < 0) { compOf[y] = id; stack.push(y); } }
    }
    const lib = [];
    for (const x of cells) {
      for (let m = 0; m < 4; m++) {
        const y = sus[4 * x + m];
        if (y >= 0 && st[y] === 0 && znak[y] !== id) { znak[y] = id; lib.push(y); }
      }
    }
    comps.push({ id, cells, size: cells.length, clue, clueCell, lib });
    if (dve) k.bad = true;
    if (clue != null && cells.length > clue) k.bad = true;
    if (clue != null && cells.length < clue && !lib.length) k.bad = true;
    if (clue == null && !lib.length) k.bad = true;
  }
  if (k.bad) return { compOf, comps, vody: [], dosah: null, dosahMan: null, pocetOstrova, pocetVody };

  // kusy vody
  const vodaOf = s.vodaOf, znak2 = s.znak2;
  vodaOf.fill(-1);
  znak2.fill(-1);
  const vody = [];
  for (let i = 0; i < C; i++) {
    if (st[i] !== 1 || vodaOf[i] >= 0) continue;
    const id = vody.length;
    const cells = [];
    vodaOf[i] = id;
    stack.push(i);
    while (stack.length) {
      const x = stack.pop();
      cells.push(x);
      for (let m = 0; m < 4; m++) { const y = sus[4 * x + m]; if (y >= 0 && st[y] === 1 && vodaOf[y] < 0) { vodaOf[y] = id; stack.push(y); } }
    }
    const lib = [];
    for (const x of cells) {
      for (let m = 0; m < 4; m++) {
        const y = sus[4 * x + m];
        if (y >= 0 && st[y] === 0 && znak2[y] !== id) { znak2[y] = id; lib.push(y); }
      }
    }
    vody.push({ id, cells, size: cells.length, lib });
    if (cells.length < k.celaVoda && !lib.length) k.bad = true;
  }

  // voľné oblasti: všetko, čo ešte môže byť voda
  const volnyOf = s.volnyOf;
  volnyOf.fill(-1);
  const volneVelkosti = [];
  for (let i = 0; i < C; i++) {
    if (st[i] === 2 || volnyOf[i] >= 0) continue;
    const id = volneVelkosti.length;
    let velkost = 0;
    volnyOf[i] = id;
    stack.push(i);
    while (stack.length) {
      const x = stack.pop();
      velkost++;
      for (let m = 0; m < 4; m++) { const y = sus[4 * x + m]; if (y >= 0 && st[y] !== 2 && volnyOf[y] < 0) { volnyOf[y] = id; stack.push(y); } }
    }
    volneVelkosti.push(velkost);
  }
  let prvaVolna = -1;
  for (const w of vody) {
    const f = volnyOf[w.cells[0]];
    if (prvaVolna < 0) prvaVolna = f;
    else if (f !== prvaVolna) k.bad = true;
  }
  if (prvaVolna >= 0 && volneVelkosti[prvaVolna] < k.celaVoda) k.bad = true;

  // blok vody 2 x 2
  for (let r = 0; r + 1 < n && !k.bad; r++) {
    for (let c = 0; c + 1 < n; c++) {
      const i = r * n + c;
      if (st[i] === 1 && st[i + 1] === 1 && st[i + n] === 1 && st[i + n + 1] === 1) { k.bad = true; break; }
    }
  }
  if (k.bad) return { compOf, comps, vodaOf, vody, volnyOf, dosah: null, dosahMan: null, pocetOstrova, pocetVody };

  // Ku ktorým očíslovaným kusom políčko prilieha. Políčko, ktoré prilieha
  // k dvom, nemôže byť ostrov, a k jednému môže patriť len tomu jednému.
  const bl1 = s.bl1, bl2 = s.bl2;
  bl1.fill(-1);
  bl2.fill(-1);
  for (let i = 0; i < C; i++) {
    if (st[i] === 1) continue;
    for (let m = 0; m < 4; m++) {
      const y = sus[4 * i + m];
      if (y < 0 || st[y] !== 2) continue;
      const cy = compOf[y];
      if (cy < 0 || comps[cy].clue == null || cy === bl1[i] || cy === bl2[i]) continue;
      if (bl1[i] < 0) bl1[i] = cy; else if (bl2[i] < 0) bl2[i] = cy;
    }
  }

  // dosah čísel: vzdušnou čiarou (Manhattan) a po ceste cez neznáme políčka
  const dosah = s.dosah, dosahMan = man ? s.dosahMan : null;
  dosah.fill(0);
  if (man) dosahMan.fill(0);
  const fronta = s.fronta, dist = s.dist, pecat = s.pecat;
  for (const comp of comps) {
    if (comp.clue == null) continue;
    const budget = comp.clue - comp.size;
    for (const x of comp.cells) { dosah[x] = 1; if (man) dosahMan[x] = 1; }
    if (budget <= 0) continue;
    if (man) {
      const gen = ++s.gen;
      let head = 0, tail = 0;
      for (const x of comp.cells) { pecat[x] = gen; dist[x] = 0; fronta[tail++] = x; }
      while (head < tail) {
        const x = fronta[head++];
        if (dist[x] >= budget) continue;
        for (let m = 0; m < 4; m++) {
          const y = sus[4 * x + m];
          if (y < 0 || pecat[y] === gen) continue;
          pecat[y] = gen; dist[y] = dist[x] + 1; dosahMan[y] = 1; fronta[tail++] = y;
        }
      }
    }
    const gen = ++s.gen;
    let head = 0, tail = 0, volnych = 0;
    for (const x of comp.cells) { pecat[x] = gen; dist[x] = 0; fronta[tail++] = x; }
    while (head < tail) {
      const x = fronta[head++];
      if (dist[x] >= budget) continue;
      for (let m = 0; m < 4; m++) {
        const y = sus[4 * x + m];
        if (y < 0 || pecat[y] === gen || st[y] === 1) continue;
        const b1 = bl1[y];
        if (b1 >= 0 && (b1 !== comp.id || bl2[y] >= 0)) continue;
        const cy = compOf[y];
        if (cy >= 0 && cy !== comp.id && comps[cy].clue != null) continue;
        pecat[y] = gen; dist[y] = dist[x] + 1; dosah[y] = 1; volnych++; fronta[tail++] = y;
      }
    }
    if (volnych < budget) k.bad = true;
  }
  for (const comp of comps) {
    if (comp.clue != null) continue;
    let ok = false;
    for (const x of comp.cells) if (dosah[x]) { ok = true; break; }
    if (!ok) k.bad = true;
  }

  return { compOf, comps, vodaOf, vody, volnyOf, dosah, dosahMan, pocetOstrova, pocetVody };
}

/* ── Vrstva 1: miestne pravidlá ──────────────────────────────────────── *
 * prvy = true znamená "použi prvé pravidlo, ktoré niečo nájde, a skonči"
 * (tak zbiera kroky ľudský riešiteľ a nápoveda). prvy = false prejde celú
 * dosku a použije všetko, čo nájde (tak propaguje strojový riešiteľ). */
function vrstva1(k, prvy, rozbor) {
  const g = k.geo, n = g.n, C = g.C, sus = g.susedia, st = k.st, clues = k.clues;
  const a = rozbor || analyza(k, true);
  if (k.bad) return false;
  let zmena = false;

  // 1. Jednotka je rodina sama pre seba: všetky štyri susedné políčka sú voda.
  for (let i = 0; i < C; i++) {
    if (clues[i] !== 1) continue;
    zacni(k, 'one-alone', 1, i);
    for (let m = 0; m < 4; m++) { const y = sus[4 * i + m]; if (y >= 0) nastav(k, y, 1); }
    if (ukonci(k)) { zmena = true; if (prvy) return true; }
    if (k.bad || k.stop) return zmena;
  }

  // 2. Políčko medzi dvoma číslami je voda. Patrí sem aj prípad, ktorý
  // ops/spec-voles.md (r. 42) vymenúva zvlášť vo vrstve 2, "políčko diagonálne
  // medzi číslami": keď sa dve čísla dotýkajú rohom, obe políčka medzi nimi
  // susedia stranou s oboma číslami, takže ich vždy zachytí už toto pravidlo
  // vrstvy 1 a samostatné diagonálne pravidlo by bolo mŕtvy kód. Vetu o rohu
  // dopĺňa textKroku.
  for (let i = 0; i < C; i++) {
    if (st[i] !== 0) continue;
    let a1 = -1, a2 = -1;
    for (let m = 0; m < 4; m++) {
      const y = sus[4 * i + m];
      if (y < 0 || clues[y] == null) continue;
      if (a1 < 0) a1 = y; else if (a2 < 0) a2 = y;
    }
    if (a2 < 0) continue;
    zacni(k, 'between-numbers', 1, [a1, a2]);
    nastav(k, i, 1);
    if (ukonci(k)) { zmena = true; if (prvy) return true; }
    if (k.bad || k.stop) return zmena;
  }

  // 3. Hotový ostrov je celý obklopený vodou.
  for (const comp of a.comps) {
    if (comp.clue == null || comp.size !== comp.clue || !comp.lib.length) continue;
    zacni(k, 'island-done', 1, comp.clueCell);
    for (const y of comp.lib) nastav(k, y, 1);
    if (ukonci(k)) { zmena = true; if (prvy) return true; }
    if (k.bad || k.stop) return zmena;
  }

  // Pravidlá 4 a 5 sú dopočítanie zo súčtu a ops/spec-voles.md (r. 36 až 39)
  // ich vo vrstve 1 nemenuje. Sú tu preto, že človek ich urobí bez rozmýšľania
  // (dorátanie zvyšku), a nepresúvame ich do vrstvy 2 naschvál: počty krokov
  // podľa vrstiev sú vstup pre obtiaznost() a vyber(), takže presun by pre tie
  // isté dni vybral iné hlavolamy, než aké sú už zapísané v dni/*.json.
  // 4. Všetky rodiny sú na svojom mieste: zvyšok lúky je voda.
  if (a.pocetOstrova === k.sucetCisel) {
    zacni(k, 'all-islands-found', 1, -1);
    for (let i = 0; i < C; i++) if (st[i] === 0) nastav(k, i, 1);
    if (ukonci(k)) { zmena = true; if (prvy) return true; }
    if (k.bad || k.stop) return zmena;
  }

  // 5. Vody je už toľko, koľko jej má byť: zvyšok je ostrov.
  if (a.pocetVody === k.celaVoda) {
    zacni(k, 'all-water-found', 1, -1);
    for (let i = 0; i < C; i++) if (st[i] === 0) nastav(k, i, 2);
    if (ukonci(k)) { zmena = true; if (prvy) return true; }
    if (k.bad || k.stop) return zmena;
  }

  // 6. Políčko, ku ktorému sa žiadne číslo nedostane ani vzdušnou čiarou.
  // (Stroj toto pravidlo preskakuje, pohltí ho silnejšie no-path vo vrstve 2.)
  if (a.dosahMan) {
    zacni(k, 'unreachable', 1, -1);
    for (let i = 0; i < C; i++) if (st[i] === 0 && !a.dosahMan[i]) nastav(k, i, 1);
    if (ukonci(k)) { zmena = true; if (prvy) return true; }
    if (k.bad || k.stop) return zmena;
  }

  // 7. Tri políčka bloku 2 x 2 sú voda: štvrté je ostrov.
  for (let r = 0; r + 1 < n; r++) {
    for (let c = 0; c + 1 < n; c++) {
      const i = r * n + c;
      const stvorec = [i, i + 1, i + n, i + n + 1];
      let vod = 0, volne = -1, zle = false;
      for (const x of stvorec) {
        if (st[x] === 1) vod++;
        else if (st[x] === 0) { if (volne < 0) volne = x; else { zle = true; break; } }
        else { zle = true; break; }
      }
      if (zle || vod !== 3 || volne < 0) continue;
      zacni(k, 'water-2x2', 1, volne);
      nastav(k, volne, 2);
      if (ukonci(k)) { zmena = true; if (prvy) return true; }
      if (k.bad || k.stop) return zmena;
    }
  }

  return zmena;
}

/* ── Vrstva 2: pravidlá, ktoré sa pozerajú ďalej ─────────────────────── */
function vrstva2(k, prvy, rozbor) {
  const g = k.geo, n = g.n, C = g.C, sus = g.susedia, st = k.st, clues = k.clues;
  const a = rozbor || analyza(k, false);
  if (k.bad) return false;
  let zmena = false;

  // 1. Ostrov s jedinou možnosťou rozšírenia sa rozšíri.
  for (const comp of a.comps) {
    if (comp.clue != null && comp.size >= comp.clue) continue;
    if (comp.lib.length !== 1) continue;
    zacni(k, 'island-one-way', 2, comp.clueCell);
    nastav(k, comp.lib[0], 2);
    if (ukonci(k)) { zmena = true; if (prvy) return true; }
    if (k.bad || k.stop) return zmena;
  }

  // 2. Kus vody s jediným únikom sa musí predĺžiť, inak by ostal odrezaný.
  for (const w of a.vody) {
    if (w.size >= k.celaVoda || w.lib.length !== 1) continue;
    zacni(k, 'water-one-way', 2, -1);
    nastav(k, w.lib[0], 1);
    if (ukonci(k)) { zmena = true; if (prvy) return true; }
    if (k.bad || k.stop) return zmena;
  }

  // 3. Políčko, ktoré by spojilo dve čísla, je voda. A políčko, ktorým by
  //    ostrov prerástol svoje číslo, tiež. Pozor: dva oddelené kusy ostrova
  //    bez čísla ešte môžu patriť tomu istému ostrovu, tie spájať smie.
  for (let i = 0; i < C; i++) {
    if (st[i] !== 0) continue;
    const ids = [];
    for (let m = 0; m < 4; m++) {
      const y = sus[4 * i + m];
      if (y < 0 || st[y] !== 2) continue;
      // -1: políčko sa stalo ostrovom až počas tohto prechodu, rozbor ho
      // ešte nepozná. Vynechať ho znamená len menej odvodiť, nikdy zle.
      const cy = a.compOf[y];
      if (cy >= 0 && ids.indexOf(cy) < 0) ids.push(cy);
    }
    if (!ids.length) continue;
    let sCislom = 0, spolu = 1, cislo = -1, cisloBunka = -1;
    for (const cid of ids) {
      const comp = a.comps[cid];
      spolu += comp.size;
      if (comp.clue != null) { sCislom++; if (cislo < 0) { cislo = comp.clue; cisloBunka = comp.clueCell; } }
    }
    let pravidlo = null, info = -1;
    if (sCislom >= 2) { pravidlo = 'would-join'; info = i; }
    else if (sCislom === 1 && spolu > cislo) { pravidlo = 'too-big'; info = cisloBunka; }
    else if (sCislom === 0 && spolu > k.maxCislo) { pravidlo = 'too-big-any'; info = -1; }
    if (!pravidlo) continue;
    zacni(k, pravidlo, 2, info);
    nastav(k, i, 1);
    if (ukonci(k)) { zmena = true; if (prvy) return true; }
    if (k.bad || k.stop) return zmena;
  }

  // 4. Políčko, ku ktorému sa žiadne číslo nedostane po ceste.
  {
    zacni(k, 'no-path', 2, -1);
    for (let i = 0; i < C; i++) if (st[i] === 0 && !a.dosah[i]) nastav(k, i, 1);
    if (ukonci(k)) { zmena = true; if (prvy) return true; }
    if (k.bad || k.stop) return zmena;
  }

  return zmena;
}

/* Propagácia bez zapisovania krokov: vrstvy 1 a 2 dokola, celé prechody.
 * Rozbor dosky sa robí raz na prechod pre obe vrstvy. Rozbor síce medzitým
 * zostarne, ale nové poznanie sa len pridáva, takže z neho nikdy nevyjde zlý
 * záver, len o niečo menej záverov naraz. */
function propagujDo2(k) {
  for (;;) {
    if (k.bad || k.stop) return null;
    const a = analyza(k, false);
    if (k.bad) return null;
    let zmena = vrstva1(k, false, a);
    if (!k.bad && !k.stop && vrstva2(k, false, a)) zmena = true;
    // Posledný rozbor sa už nezmenil, volajúci ho môže rovno použiť.
    if (!zmena || k.bad || k.stop) return k.bad || k.stop ? null : a;
  }
}

/* Jednokroková skúška: polož políčku hodnotu, dopropaguj vrstvy 1 a 2, a
   povedz, či z toho vyšiel spor. */
function skus(k, i, val) {
  const k2 = klon(k);
  nastav(k2, i, val);
  if (k2.bad) return true;
  propagujDo2(k2);
  return k2.bad;
}

/* ── Vrstva 3: skúšanie so sporom ────────────────────────────────────── *
 * Skúša len políčka na hranici známeho (aspoň jeden rozhodnutý sused), tak
 * ako by to robil človek: nikto neskúša políčko uprostred neznáma. */
function krokVrstvy3(k) {
  const g = k.geo, C = g.C, sus = g.susedia, st = k.st;
  for (let i = 0; i < C; i++) {
    if (st[i] !== 0) continue;
    let hranica = false;
    for (let m = 0; m < 4; m++) { const y = sus[4 * i + m]; if (y >= 0 && st[y] !== 0) { hranica = true; break; } }
    if (!hranica) continue;
    if (skus(k, i, 2)) {
      zacni(k, 'trial-water', 3, i);
      nastav(k, i, 1);
      if (ukonci(k)) return true;
      if (k.bad) return false;
      continue;
    }
    if (skus(k, i, 1)) {
      zacni(k, 'trial-island', 3, i);
      nastav(k, i, 2);
      if (ukonci(k)) return true;
      if (k.bad) return false;
    }
  }
  return false;
}

/* ── solve: koľko riešení má zadanie ─────────────────────────────────── *
 * opts: limit (koľko riešení stačí nájsť, štandardne 2), initial (počiatočný
 * stav 0/1/2), maxNodes (strop na vetvenie, 0 = bez stropu). Pri zastavení
 * na strope je count neúplný, preto vráti aj vycerpane: true; volajúci sa
 * vtedy nesmie tváriť, že vie počet riešení. Strop je deterministický, takže
 * zadanie ostáva pre daný kľúč rovnaké.
 * Vráti { count, solution (ploché 0/1 prvého riešenia alebo null), riesenia
 * (všetky nájdené, najviac limit), nodes, vycerpane }. */
export function solve(clues, n, opts = {}) {
  const limit = opts.limit ?? 2;
  const maxNodes = opts.maxNodes ?? 0;
  const g = geometria(n);
  const st = opts.initial ? Uint8Array.from(opts.initial) : new Uint8Array(g.C);
  const k0 = kontext(g, clues, st, null);
  zaciatok(k0);
  let count = 0, nodes = 0, vycerpane = false;
  const riesenia = [];

  function vyberBunku(k, a) {
    let best = -1, bestN = 1e9;
    for (const comp of a.comps) {
      if (comp.clue != null && comp.size >= comp.clue) continue;
      if (comp.lib.length && comp.lib.length < bestN) { bestN = comp.lib.length; best = comp.lib[0]; }
    }
    if (best >= 0) return best;
    for (const w of a.vody) {
      if (w.size >= k.celaVoda) continue;
      if (w.lib.length) return w.lib[0];
    }
    for (let i = 0; i < g.C; i++) if (k.st[i] === 0) return i;
    return -1;
  }

  function rek(k) {
    if (vycerpane) return;
    nodes++;
    if (maxNodes && nodes > maxNodes) { vycerpane = true; return; }
    const a = propagujDo2(k);
    if (k.bad || !a) return;
    const i = vyberBunku(k, a);
    if (i < 0) {
      count++;
      riesenia.push(riesenieZoStavu(k.st));
      return;
    }
    for (const val of [2, 1]) {
      const k2 = klon(k);
      nastav(k2, i, val);
      rek(k2);
      if (vycerpane || count >= limit) return;
    }
  }
  rek(k0);
  return { count, solution: riesenia.length ? riesenia[0] : null, riesenia, nodes, vycerpane };
}

/* ── solveHuman: len ľudské pravidlá, bez hádania ────────────────────── *
 * opts: maxVrstva (najvyššia dovolená vrstva, 2 = riešiteľné bez skúšania),
 * initial (počiatočný stav, napríklad hráčove značky), limitKrokov (skončiť
 * po toľkých krokoch, nápoveda dáva 1).
 * Vráti { solved, contradiction, layersUsed:{1,2,3}, steps, solution, state },
 * kde steps sú kroky { rule, layer, cells:[{ i, r, c, val }], text }
 * s anglickým vysvetlením. */
export function solveHuman(clues, n, opts = {}) {
  const g = geometria(n);
  const st = opts.initial ? Uint8Array.from(opts.initial) : new Uint8Array(g.C);
  const steps = [];
  const k = kontext(g, clues, st, steps);
  k.limitKrokov = opts.limitKrokov || 0;
  const maxVrstva = opts.maxVrstva ?? 3;
  zaciatok(k);
  while (!k.bad && !k.stop) {
    if (vrstva1(k, true)) continue;
    if (k.bad || k.stop) break;
    if (!maNeznama(k)) break;
    if (vrstva2(k, true)) continue;
    if (k.bad || k.stop) break;
    if (maxVrstva >= 3 && krokVrstvy3(k)) continue;
    break;
  }
  let solved = false;
  if (!k.bad && !maNeznama(k)) {
    analyza(k, false);
    solved = !k.bad;
  }
  const layersUsed = { 1: 0, 2: 0, 3: 0 };
  for (const s of steps) layersUsed[s.layer]++;
  return {
    solved,
    contradiction: k.bad,
    layersUsed,
    steps: steps.map((s) => verejnyKrok(s, g, clues)),
    solution: solved ? riesenieZoStavu(st) : null,
    state: st,
  };
}

/* ── Anglické vysvetlenia krokov ─────────────────────────────────────── */
function poloha(i, n) {
  const r = (i / n) | 0, c = i % n;
  return 'row ' + (r + 1) + ', column ' + (c + 1);
}

function verejnyKrok(s, g, clues) {
  const n = g.n;
  const cells = [];
  for (let j = 0; j < s.cells.length; j += 2) {
    const i = s.cells[j];
    cells.push({ i, r: (i / n) | 0, c: i % n, val: s.cells[j + 1] });
  }
  return { rule: s.rule, layer: s.layer, cells, text: textKroku(s, g, cells, clues) };
}

function textKroku(s, g, cells, clues) {
  const n = g.n, i = s.info;
  const jedno = typeof i === 'number' && i >= 0 ? i : -1;
  const cislo = jedno >= 0 && clues[jedno] != null ? clues[jedno] : null;
  const pocet = cells.length;
  const prve = cells.length ? cells[0].i : -1;
  switch (s.rule) {
    case 'one-alone':
      return 'The 1 in ' + poloha(jedno, n) + ' is a family on its own, so every cell beside it is water.';
    case 'between-numbers': {
      // Dve čísla rohom k rohu majú medzi sebou práve také políčko: dotýka sa
      // stranami oboch. Stojí za to to povedať, je to častý vzor.
      const r1 = (i[0] / n) | 0, c1 = i[0] % n, r2 = (i[1] / n) | 0, c2 = i[1] % n;
      const rohom = Math.abs(r1 - r2) === 1 && Math.abs(c1 - c2) === 1;
      return 'The cell in ' + poloha(prve, n) + ' sits between the numbers in ' + poloha(i[0], n) + ' and ' + poloha(i[1], n)
        + (rohom ? ', which touch corner to corner' : '') + '. One cell cannot belong to two islands, so it is water.';
    }
    case 'island-done':
      return 'The island with the ' + cislo + ' in ' + poloha(jedno, n) + ' already has all ' + cislo + ' of its cells, so ' + (pocet === 1 ? 'the last cell beside it is' : 'every cell beside it is') + ' water.';
    case 'all-islands-found':
      return 'Every family already has an island of the right size, so ' + (pocet === 1 ? 'the last open cell is' : 'all the open cells are') + ' water.';
    case 'all-water-found':
      return 'The water is as big as it can be, so ' + (pocet === 1 ? 'the last open cell belongs' : 'the open cells belong') + ' to an island.';
    case 'unreachable':
      return pocet === 1
        ? 'No number is close enough to reach the cell in ' + poloha(prve, n) + ', so it is water.'
        : 'No number is close enough to reach these ' + pocet + ' cells, so they are water.';
    case 'no-path':
      return pocet === 1
        ? 'No number can get to the cell in ' + poloha(prve, n) + ' without crossing water or another island, so it is water.'
        : 'No number can get to these ' + pocet + ' cells without crossing water or another island, so they are water.';
    case 'water-2x2':
      return 'Three cells of a two by two block are already water. Water never fills a whole two by two block, so the cell in ' + poloha(jedno, n) + ' belongs to an island.';
    case 'island-one-way':
      return (cislo != null
        ? 'The island with the ' + cislo + ' in ' + poloha(jedno, n) + ' is not finished and has only one cell left to grow into'
        : 'This piece of island still needs a number and has only one cell left to grow into')
        + ', so the cell in ' + poloha(prve, n) + ' belongs to it.';
    case 'water-one-way':
      return 'This piece of water has only one way out, and all the water has to hang together, so the cell in ' + poloha(prve, n) + ' is water.';
    case 'would-join':
      return 'The cell in ' + poloha(jedno, n) + ' touches two islands that already have their own numbers. Islands never touch by a side, so it is water.';
    case 'too-big':
      return 'Taking the cell in ' + poloha(prve, n) + ' would give the island with the ' + cislo + ' in ' + poloha(jedno, n) + ' more than ' + cislo + ' cells, so it is water.';
    case 'too-big-any':
      return 'Taking the cell in ' + poloha(prve, n) + ' would join the pieces beside it into an island bigger than any number left on the board, so it is water.';
    case 'trial-water':
      return 'Try it: if the cell in ' + poloha(jedno, n) + ' belonged to an island, the meadow could not work out. Some water would be cut off, a two by two block would fill, or an island would be left without a number. So it is water.';
    case 'trial-island':
      return 'Try it: if the cell in ' + poloha(jedno, n) + ' were water, the meadow could not work out. Some water would be cut off, a two by two block would fill, or an island would be left without a number. So it belongs to an island.';
    default:
      return 'A step across the meadow.';
  }
}

/* ── Denná lúka ──────────────────────────────────────────────────────── *
 * generate(dateStr, opts) picks n (default 8) and calls generateSeeded with
 * the date as both name and key, so every date keeps the meadow it always
 * had. opts: n, hustota, maxAttempts (default 200). */
export function generate(dateStr, opts = {}) {
  if (!isValidDate(dateStr)) throw new Error('Date must be in YYYY-MM-DD form: ' + dateStr);
  const n = opts.n ?? 8;
  return generateSeeded(dateStr, dateStr + '/' + n, opts);
}

/* Náhodné poradie (Fisher-Yates) z rng. */
function zamiesaj(rng, m) {
  const a = Array.from({ length: m }, (_, i) => i);
  for (let i = m - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

function rovnake(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/* Mriežka ostrovov (1 = ostrov) na riešenie (0 = ostrov, 1 = voda). */
function riesenieZOstrova(ostrov, C) {
  const out = new Array(C);
  for (let i = 0; i < C; i++) out[i] = ostrov[i] ? 0 : 1;
  return out;
}

/* Ostane ostrov v jednom kuse, keď mu vezmeme políčko d? */
function drziPoOdobrati(cells, d, n) {
  if (cells.length < 2) return false;
  const g = geometria(n), sus = g.susedia;
  const patri = new Set(cells);
  patri.delete(d);
  const start = patri.values().next().value;
  const videne = new Set([start]);
  const front = [start];
  while (front.length) {
    const x = front.pop();
    for (let m = 0; m < 4; m++) {
      const y = sus[4 * x + m];
      if (y >= 0 && patri.has(y) && !videne.has(y)) { videne.add(y); front.push(y); }
    }
  }
  return videne.size === patri.size;
}

/* The same as generate, but the random seed comes from `key` (any string)
 * and `name` is only stored in the result as `date`. Practice meadows and
 * the daily candidates use it. Deterministic: the same key gives the same
 * puzzle.
 * Returns { date, n, clues (flat n*n, a number or null), solution (flat n*n,
 * 0 island / 1 water), seed, attempts, difficulty:{ layers:{1,2,3}, clues,
 * steps }, ms }. */
export function generateSeeded(name, key, opts = {}) {
  const n = opts.n ?? 8;
  const C = n * n;
  const maxAttempts = opts.maxAttempts ?? 200;
  const maxVrstva = opts.maxVrstva ?? 3;
  // Strop na vetvenie pri kontrole jednoznačnosti. Bez neho sa riešiteľ na
  // veľmi riedkom zadaní zamotá na sekundy; s ním sa taká úprava proste
  // neprijme. Strop je deterministický, výsledok teda pre daný kľúč stály.
  const maxNodes = opts.maxNodes ?? 4000;
  const oprav = opts.oprav ?? 60;
  const prechodov = opts.prechodov ?? (n <= 8 ? 2 : 1);
  const t0 = nowMs();
  const seed = seedFromString(key);
  const rng = mulberry32(seed);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Podiel ostrovných políčok. Čím hustejšie ostrovy, tým zaujímavejšia
    // lúka, ale aj tým dlhšie hľadanie: na veľkej mriežke sa preto drží
    // nižšie, aby jeden deň (šesť kandidátov) ostal hlboko pod 4 sekundami.
    const hustota = opts.hustota ?? (n >= 12 ? 0.31 + rng() * 0.04
      : n >= 10 ? 0.33 + rng() * 0.03 : 0.33 + rng() * 0.04);
    const rr = randomRiesenie(rng, n, { hustota, maxOstrov: opts.maxOstrov });
    if (!rr) continue;

    let ostrov = rr.ostrov;
    const ostrovy = rr.ostrovy.map((cells) => cells.slice());
    const ostrovBunky = new Int32Array(C).fill(-1);
    for (let ix = 0; ix < ostrovy.length; ix++) for (const x of ostrovy[ix]) ostrovBunky[x] = ix;
    const cisloBunky = ostrovy.map((cells) => cells[Math.floor(rng() * cells.length)]);
    let clues = new Array(C).fill(null);
    for (let ix = 0; ix < ostrovy.length; ix++) clues[cisloBunky[ix]] = ostrovy[ix].length;
    let solution = riesenieZOstrova(ostrov, C);
    // ostrov, ktorému sme už raz presunuli číslo (druhýkrát to nepomôže)
    const presunute = new Uint8Array(ostrovy.length);
    const MOZE_PRESUNUT = 3; // koľkokrát smie ostrov posunúť svoje číslo

    /* Zaplav políčko d ostrova ix. Ostrov sa zmenší o jedna, jeho číslo
       klesne. Voda sa tým nikdy nerozpadne (pribúda k sebe), len blok 2 x 2
       treba ustrážiť. Keď na tom políčku sedí číslo, presunie sa inam. */
    const zaplav = (ix, d) => {
      const cells = ostrovy[ix];
      if (cells.length < 2) return false;
      if (!drziPoOdobrati(cells, d, n)) return false;
      ostrov[d] = 0;
      if (maBlok2x2(ostrov, n)) { ostrov[d] = 1; return false; }
      const zvysok = cells.filter((x) => x !== d);
      if (cisloBunky[ix] === d) {
        clues[d] = null;
        cisloBunky[ix] = zvysok[0];
      }
      ostrovy[ix] = zvysok;
      ostrovBunky[d] = -1;
      clues[d] = null;
      clues[cisloBunky[ix]] = zvysok.length;
      presunute[ix] = 0;
      solution = riesenieZOstrova(ostrov, C);
      return true;
    };

    /* Zmenši lúku o jedno políčko. Najprv sporné políčka, potom ktorékoľvek
       ostrovné. V oboch prípadoch najprv z menších ostrovov: veľký ostrov je
       na lúke to zaujímavé, škoda ho okrajovať. Kým sa niečo zmenšiť dá,
       oprava ide dopredu. */
    const podlaVelkosti = (zoznam) => zoznam
      .map((d) => ({ d, ix: ostrovBunky[d] }))
      .filter((x) => x.ix >= 0)
      .sort((a, b) => ostrovy[a.ix].length - ostrovy[b.ix].length);
    const zmensi = (sporne) => {
      for (const x of podlaVelkosti(sporne)) if (zaplav(x.ix, x.d)) return true;
      for (const x of podlaVelkosti(zamiesaj(rng, C))) if (zaplav(x.ix, x.d)) return true;
      return false;
    };

    // Oprava lúky. Dve páky: presunúť číslo ostrova na sporné políčko, a keď
    // to nestačí, zobrať ostrovu to sporné políčko. Druhá páka vždy uberie
    // jedno ostrovné políčko, takže sa to nemôže točiť donekonečna: v
    // najhoršom skončíme pri samých jednotkách, a tie sú jednoznačné.
    let hotove = false;
    for (let op = 0; op < oprav; op++) {
      const r = solve(clues, n, { limit: 2, maxNodes });
      if (r.vycerpane || !r.count) break;
      if (r.count === 1) {
        if (!rovnake(r.solution, solution)) break;
        const hu = solveHuman(clues, n, { maxVrstva });
        if (hu.solved && rovnake(hu.solution, solution)) { hotove = true; break; }
        // Jednoznačné, ale človek to bez hádania nedá. Zjednoduš lúku:
        // zaplav políčko, na ktorom riešiteľ uviazol.
        const uviazol = [];
        for (let i = 0; i < C; i++) if (hu.state[i] === 0 && solution[i] === 0) uviazol.push(i);
        if (!zmensi(uviazol)) break;
        continue;
      }
      const ine = r.riesenia.find((x) => !rovnake(x, solution));
      if (!ine) break;
      // políčka, ktoré sú u nás ostrov a v tom druhom riešení voda
      const sporne = [];
      for (let i = 0; i < C; i++) if (solution[i] === 0 && ine[i] === 1) sporne.push(i);
      if (!sporne.length) break;
      let spravene = false;
      for (const d of sporne) {
        const ix = ostrovBunky[d];
        if (ix < 0 || presunute[ix] >= MOZE_PRESUNUT || cisloBunky[ix] === d) continue;
        clues[cisloBunky[ix]] = null;
        cisloBunky[ix] = d;
        clues[d] = ostrovy[ix].length;
        presunute[ix]++;
        spravene = true;
        break;
      }
      if (spravene) continue;
      if (!zmensi(sporne)) break;
    }
    if (!hotove) continue;

    // Minimalizácia: zaplav celý ostrov, keď zadanie aj tak ostane
    // jednoznačné a ľudsky riešiteľné. Menej čísel, tá istá istota.
    const zaplavene = new Uint8Array(ostrovy.length);
    for (let pass = 0; pass < prechodov; pass++) {
      for (const idx of zamiesaj(rng, ostrovy.length)) {
        if (zaplavene[idx] || !ostrovy[idx].length) continue;
        const novyOstrov = ostrov.slice();
        for (const x of ostrovy[idx]) novyOstrov[x] = 0;
        if (maBlok2x2(novyOstrov, n)) continue;
        const noveClues = clues.slice();
        for (const x of ostrovy[idx]) noveClues[x] = null;
        let zostava = 0;
        for (const x of noveClues) if (x != null) zostava++;
        if (!zostava) continue;
        const noveRiesenie = riesenieZOstrova(novyOstrov, C);
        const r = solve(noveClues, n, { limit: 2, maxNodes });
        if (r.vycerpane || r.count !== 1 || !rovnake(r.solution, noveRiesenie)) continue;
        const hu = solveHuman(noveClues, n, { maxVrstva });
        if (!hu.solved || !rovnake(hu.solution, noveRiesenie)) continue;
        ostrov = novyOstrov;
        clues = noveClues;
        solution = noveRiesenie;
        zaplavene[idx] = 1;
      }
    }

    const fin = solveHuman(clues, n, { maxVrstva });
    if (!fin.solved || !rovnake(fin.solution, solution)) {
      throw new Error('solveHuman settled on a different meadow than the source for ' + name);
    }
    let pocet = 0;
    for (const x of clues) if (x != null) pocet++;
    return {
      date: name, n, clues, solution, seed, attempts: attempt,
      difficulty: { layers: fin.layersUsed, clues: pocet, steps: fin.steps.length },
      ms: Math.round((nowMs() - t0) * 10) / 10,
    };
  }
  throw new Error('No unique, guess-free meadow for ' + name + ' in ' + maxAttempts + ' attempts');
}
