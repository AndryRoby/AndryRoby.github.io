/* Cranes: generator and solver for the daily walkway puzzle.
 *
 * One file, no dependencies, runs the same in Node and in the browser
 * (game.js imports it as a module, tests.mjs too). Everything is
 * deterministic: a date turns into a number, the number into a sequence of
 * random values, the sequence into a puzzle. The same date gives the same
 * puzzle on every machine, so the server never has to compute or store
 * anything.
 *
 * Rules of the game (our own wording): cranes rest on sandbanks. Join the
 * sandbanks with straight walkways so that every sandbank has as many
 * walkways as its number, at most two between the same pair, no crossings,
 * and every sandbank can be reached from every other.
 *
 * Representation: `islands` is an array of { r, c, n }, sorted in reading
 * order (row first, then column), on a grid of n x n points. A solution is an
 * array of { a, b, k }: the indices of two sandbanks (a < b) and how many
 * walkways run between them, 1 or 2. Pairs with no walkway are left out.
 *
 * Inside the solvers a pair is one variable with a domain of { 0, 1, 2 },
 * held as a three bit mask (bit 0 means "no walkway is still possible", bit 1
 * "one walkway", bit 2 "two walkways"). graf() works out, once per layout,
 * which pairs exist (the first sandbank in each of the four directions),
 * which pairs meet at each sandbank, and which pairs would cross.
 *
 * Generation (generateSeeded):
 *   1. grow a layout: the first sandbank at random, then repeatedly pick an
 *      existing one and a direction and drop a new one 2 to 5 squares away,
 *      joined by one walkway or (about 30 percent of the time) two,
 *   2. add a few more walkways between sandbanks that already stand in line,
 *      so the layout is not a bare tree,
 *   3. read every number off the layout (a number is the count of walkways),
 *   4. take single walkways away one at a time, for good, while the puzzle
 *      still has exactly one solution (solve), a person can still finish it
 *      without guessing (solveHuman), and no step of layer 2 or 3 is lost:
 *      fewer walkways means smaller numbers and a puzzle that gives less
 *      away, and the last condition keeps it from shrinking to a bare tree,
 *   5. if a layout fails, try another one, up to `maxAttempts`.
 *
 * Step 4 is where Cranes differs from Magpies and Otters. There every clue is
 * optional, so taking clues away can only make the puzzle harder. Here every
 * sandbank has to show its number, so the only thing that can be taken away
 * is a walkway, and a walkway is both a constraint and a gift: strip enough
 * of them and the layout falls apart into a tree of 1s that a person solves
 * from the leaves without thinking. Hence the extra condition.
 *
 * Difficulty, returned as `difficulty`:
 *   layers  how many steps the human solver needed from each layer of rules
 *           (1 local, 2 patterns between two sandbanks, 3 one step trials),
 *   ostrovy how many sandbanks are on the board,
 *   lavky   how many walkways the solution has,
 *   steps   the total number of steps.
 * plan.mjs ranks candidates by layer 3 first, then layer 2.
 *
 * Every step sentence is built in two parts: first where to look and which
 * rule applies, then, after " That settles", the counts the step decides.
 * game.js cuts the sentence at that marker, so the first press of Hint says
 * only where and why and the second one adds the counts and draws them
 * (ops/spec-hry-ux.md, part 5). No rule may put a count in the first part.
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

/* ── Domény dvojíc ───────────────────────────────────────────────────── *
 * Doména dvojice je trojbitová maska: bit 0 = žiadna lávka, bit 1 = jedna,
 * bit 2 = dve. MLO a MHI sú najmenšia a najväčšia hodnota v maske. */
const MLO = [0, 0, 1, 0, 2, 0, 1, 0];
const MHI = [0, 0, 1, 1, 2, 2, 2, 2];
const POCET = [0, 1, 1, 2, 1, 2, 2, 3];
const HODNOTY = [[], [0], [1], [0, 1], [2], [0, 2], [1, 2], [0, 1, 2]];
const PLNA = 7;

/* Maska všetkých hodnôt od lo po hi (orezané na 0 az 2). */
function maskaIntervalu(lo, hi) {
  const a = lo < 0 ? 0 : lo, b = hi > 2 ? 2 : hi;
  if (a > b) return 0;
  return ((1 << (b + 1)) - 1) & ~((1 << a) - 1);
}

/* ── Geometria rozloženia ────────────────────────────────────────────── */
const SMERY = [[-1, 0], [0, 1], [1, 0], [0, -1]]; // hore, vpravo, dole, vľavo

/* graf(islands, n) prejde rozloženie raz a vráti všetko, čo riešiteľ
 * potrebuje:
 *   susedia[i]      štyri smery, index prvého ostrova v smere alebo -1,
 *   pary[e]         { a, b, vodorovna }, a < b, zoradené podľa a, potom b,
 *   hraneOstrova[i] indexy dvojíc, ktoré sa dotýkajú ostrova i,
 *   krizenia[e]     indexy dvojíc, ktorých lávky by pretli lávku dvojice e,
 *   indexPary(a, b) index dvojice alebo -1.
 * Ostrovy sa nesmú medzi volaniami meniť; čísla (`n`) sa meniť smú, graf od
 * nich nezávisí. */
export function graf(islands, n) {
  const C = islands.length;
  const mapa = new Map();
  for (let i = 0; i < C; i++) mapa.set(islands[i].r * n + islands[i].c, i);
  const susedia = [];
  for (let i = 0; i < C; i++) {
    const s = [-1, -1, -1, -1];
    for (let d = 0; d < 4; d++) {
      let r = islands[i].r + SMERY[d][0], c = islands[i].c + SMERY[d][1];
      while (r >= 0 && c >= 0 && r < n && c < n) {
        const j = mapa.get(r * n + c);
        if (j !== undefined) { s[d] = j; break; }
        r += SMERY[d][0]; c += SMERY[d][1];
      }
    }
    susedia.push(s);
  }
  const pary = [];
  const videne = new Set();
  for (let i = 0; i < C; i++) {
    for (let d = 0; d < 4; d++) {
      const j = susedia[i][d];
      if (j < 0) continue;
      const a = i < j ? i : j, b = i < j ? j : i, kl = a * C + b;
      if (videne.has(kl)) continue;
      videne.add(kl);
      pary.push({ a, b, vodorovna: islands[a].r === islands[b].r });
    }
  }
  pary.sort((x, y) => (x.a - y.a) || (x.b - y.b));
  const E = pary.length;
  const hraneOstrova = [];
  for (let i = 0; i < C; i++) hraneOstrova.push([]);
  const kluce = new Map();
  for (let e = 0; e < E; e++) {
    hraneOstrova[pary[e].a].push(e);
    hraneOstrova[pary[e].b].push(e);
    kluce.set(pary[e].a * C + pary[e].b, e);
  }
  const krizenia = [];
  for (let e = 0; e < E; e++) krizenia.push([]);
  for (let e = 0; e < E; e++) {
    for (let f = e + 1; f < E; f++) {
      const p = pary[e], q = pary[f];
      if (p.vodorovna === q.vodorovna) continue;
      const hz = p.vodorovna ? p : q, vt = p.vodorovna ? q : p;
      const r = islands[hz.a].r;
      const c1 = Math.min(islands[hz.a].c, islands[hz.b].c);
      const c2 = Math.max(islands[hz.a].c, islands[hz.b].c);
      const c = islands[vt.a].c;
      const r1 = Math.min(islands[vt.a].r, islands[vt.b].r);
      const r2 = Math.max(islands[vt.a].r, islands[vt.b].r);
      if (c1 < c && c < c2 && r1 < r && r < r2) { krizenia[e].push(f); krizenia[f].push(e); }
    }
  }
  return {
    n, C, E, pary, susedia, hraneOstrova, krizenia,
    indexPary: (a, b) => {
      const x = a < b ? a : b, y = a < b ? b : a;
      const e = kluce.get(x * C + y);
      return e === undefined ? -1 : e;
    },
  };
}

/* Riešenie ako pole { a, b, k } (len dvojice s aspoň jednou lávkou). */
function riesenieZDomen(g, dom) {
  const out = [];
  for (let e = 0; e < g.E; e++) {
    const k = MLO[dom[e]];
    if (k >= 1) out.push({ a: g.pary[e].a, b: g.pary[e].b, k });
  }
  return out;
}
/* Riešenie ako počty lávok na dvojicu (pole dlhé g.E). */
export function poleLaviek(riesenie, g) {
  const out = new Uint8Array(g.E);
  for (const m of riesenie) {
    const e = g.indexPary(m.a, m.b);
    if (e < 0) throw new Error('A walkway between sandbanks that are not in line: ' + m.a + ' and ' + m.b);
    out[e] = m.k;
  }
  return out;
}
/* Dve riešenia sú rovnaké, keď majú tie isté dvojice s tými istými počtami. */
export function rovnakeLavky(a, b) {
  const kl = (x) => x.map((m) => m.a + '-' + m.b + ':' + m.k).join(';');
  return kl(a) === kl(b);
}

/* ── Riešiteľ: spoločné jadro ────────────────────────────────────────── *
 * Kontext drží domény dvojíc, front dvojíc na prepočet, príznak sporu a (pri
 * ľudskom riešení) zoznam krokov. `zmien` počíta každé zúženie domény, aj
 * také, ktoré ešte dvojicu neurčilo. */
function kontext(g, islands, dom, steps) {
  return {
    g, islands, dom, steps, step: null,
    q: [], qi: 0, bad: false, stop: false, zmien: 0,
    limitKrokov: 0, stopPriLavke: false, zaklad: null,
    uf: new Int32Array(g.C), vel: new Int32Array(g.C), otv: new Int32Array(g.C),
    t: null,
  };
}
/* Odvodený kontext na skúšky a vetvenie: vlastná kópia domén, nič iné. */
function kopia(k) {
  const k2 = kontext(k.g, k.islands, Uint8Array.from(k.dom), null);
  return k2;
}
function obmedz(k, e, maska) {
  const stara = k.dom[e];
  const nova = stara & maska;
  if (nova === stara) return;
  if (nova === 0) { k.bad = true; return; }
  k.dom[e] = nova;
  k.zmien++;
  k.q.push(e);
  if (k.step && POCET[nova] === 1 && POCET[stara] > 1) k.step.edges.push(e, MLO[nova]);
}
function zacniKrok(k, rule, layer, info, data) {
  if (k.steps) k.step = { rule, layer, info, data: data || null, edges: [] };
}
function ukonciKrok(k) {
  if (!k.step) return;
  if (k.step.edges.length) {
    k.steps.push(k.step);
    // stopPriLavke: zastav sa až pri kroku, ktorý naozaj pridá lávku navyše
    // oproti tomu, čo už na doske je. Krok, ktorý dvojicu len uzavrie na
    // nulu alebo potvrdí nakreslený počet, nemá hráčovi čo ukázať.
    if (k.stopPriLavke) {
      for (let j = 0; j < k.step.edges.length; j += 2) {
        const e = k.step.edges[j], val = k.step.edges[j + 1];
        if (val >= 1 && val > (k.zaklad ? k.zaklad[e] : 0)) { k.stop = true; break; }
      }
    }
    if (k.limitKrokov && k.steps.length >= k.limitKrokov) k.stop = true;
  }
  k.step = null;
}

/* Vrstva 1 pri ostrove: koľko lávok z neho už určite vedie a koľko ich tam
 * najviac môže viesť. Z toho sa pre každú dvojicu spočíta najmenší a
 * najväčší možný počet lávok. Jedným pravidlom sa tak vybaví celý zoznam zo
 * špecifikácie: číslo = dvojnásobok počtu susedov, jediný sused, presne
 * dosť kapacity, plný alebo zablokovaný sused, aj "aspoň jedna lávka", keď
 * číslo presiahne 2 x (počet susedov - 1). Špecifikácia spomína tri susedy a
 * číslo 5 vo vrstve 2; je to tá istá veta, takže ju nájde už vrstva 1. */
function skontrolujOstrov(k, i) {
  const es = k.g.hraneOstrova[i], dom = k.dom, need = k.islands[i].n;
  let sumLo = 0, sumHi = 0, zive = 0, vsetkyDve = true;
  for (let x = 0; x < es.length; x++) {
    const m = dom[es[x]];
    sumLo += MLO[m]; sumHi += MHI[m];
    if (MHI[m] > 0) { zive++; if (MHI[m] !== 2) vsetkyDve = false; }
  }
  if (sumLo > need || sumHi < need) { k.bad = true; return; }
  if (sumLo === need && sumHi === need) return;
  zacniKrok(k, 'island', 1, i, { need, zive });
  let zvysil = false;
  for (let x = 0; x < es.length; x++) {
    const e = es[x], m = dom[e];
    const maxE = need - (sumLo - MLO[m]);
    const minE = need - (sumHi - MHI[m]);
    const mm = maskaIntervalu(minE, maxE);
    if ((m & mm) === m) continue;
    if (minE > MLO[m]) zvysil = true;
    obmedz(k, e, mm);
    if (k.bad) { ukonciKrok(k); return; }
  }
  if (k.step) {
    // Jediný sused sa pýta prv než "všetko dvojité": pri jednom susedovi znie
    // veta o jednom susedovi prirodzenejšie a all-double tak vždy hovorí
    // o dvoch alebo viacerých susedoch.
    k.step.rule = (zive === 1 && sumLo === 0) ? 'one-neighbour'
      : (need === 2 * zive && vsetkyDve && sumLo === 0) ? 'all-double'
        : sumHi === need ? 'needs-all'
          : sumLo === need ? 'island-full'
            : zvysil ? 'at-least-one' : 'capacity';
  }
  ukonciKrok(k);
}

/* Vrstva 1 pri krížení: kde už určite vedie lávka, tam sa cez ňu nedá. */
function skontrolujKrizenia(k, e) {
  if (MLO[k.dom[e]] < 1) return;
  const kr = k.g.krizenia[e];
  for (let x = 0; x < kr.length; x++) {
    const f = kr[x];
    if (MHI[k.dom[f]] === 0) continue;
    zacniKrok(k, 'no-crossing', 1, [e, f]);
    obmedz(k, f, 1);
    ukonciKrok(k);
    if (k.bad || k.stop) return;
  }
}

/* Prepočíta ostrovy a kríženia okolo každej zmenenej dvojice, kým sa niečo
   mení. Používa len vrstvu 1. */
function propaguj(k) {
  while (k.qi < k.q.length && !k.bad && !k.stop) {
    const e = k.q[k.qi++];
    skontrolujKrizenia(k, e); if (k.bad || k.stop) break;
    skontrolujOstrov(k, k.g.pary[e].a); if (k.bad || k.stop) break;
    skontrolujOstrov(k, k.g.pary[e].b);
  }
  if (!k.stop) { k.q.length = 0; k.qi = 0; }
  return !k.bad;
}

/* Začiatok: raz cez všetky ostrovy a všetky kríženia, potom propagácia. */
function zaciatok(k) {
  for (let i = 0; i < k.g.C && !k.bad && !k.stop; i++) skontrolujOstrov(k, i);
  for (let e = 0; e < k.g.E && !k.bad && !k.stop; e++) skontrolujKrizenia(k, e);
  propaguj(k);
}

function najdi(uf, x) {
  while (uf[x] !== x) { uf[x] = uf[uf[x]]; x = uf[x]; }
  return x;
}

/* Dajú sa ostrovy vôbec ešte spojiť? Spája cez dvojice, ktoré ešte môžu mať
   lávku (horná hranica aspoň 1). */
function mozeBytSpojene(k) {
  const g = k.g, uf = k.uf;
  for (let i = 0; i < g.C; i++) uf[i] = i;
  let komp = g.C;
  for (let e = 0; e < g.E; e++) {
    if (MHI[k.dom[e]] === 0) continue;
    const a = najdi(uf, g.pary[e].a), b = najdi(uf, g.pary[e].b);
    if (a !== b) { uf[a] = b; komp--; }
  }
  return komp === 1;
}

/* Uzavretá skupina: komponent istých lávok, v ktorom má už každý ostrov
   všetky svoje lávky, a predsa v ňom nie sú všetky ostrovy. Taká skupina by
   ostala odrezaná, čiže je to spor. */
function uzavretaSkupina(k) {
  const g = k.g, uf = k.uf, vel = k.vel, otv = k.otv;
  for (let i = 0; i < g.C; i++) { uf[i] = i; vel[i] = 1; otv[i] = 0; }
  for (let e = 0; e < g.E; e++) {
    if (MLO[k.dom[e]] < 1) continue;
    const a = najdi(uf, g.pary[e].a), b = najdi(uf, g.pary[e].b);
    if (a !== b) { uf[a] = b; vel[b] += vel[a]; }
  }
  for (let i = 0; i < g.C; i++) {
    const es = g.hraneOstrova[i];
    let sumLo = 0;
    for (let x = 0; x < es.length; x++) sumLo += MLO[k.dom[es[x]]];
    if (sumLo < k.islands[i].n) otv[najdi(uf, i)]++;
  }
  for (let i = 0; i < g.C; i++) {
    if (najdi(uf, i) !== i) continue;
    if (vel[i] < g.C && otv[i] === 0) return true;
  }
  return false;
}

/* Držia isté lávky všetky ostrovy pokope? */
function jednaSkupina(k) {
  const g = k.g, uf = k.uf;
  for (let i = 0; i < g.C; i++) uf[i] = i;
  let komp = g.C;
  for (let e = 0; e < g.E; e++) {
    if (MLO[k.dom[e]] < 1) continue;
    const a = najdi(uf, g.pary[e].a), b = najdi(uf, g.pary[e].b);
    if (a !== b) { uf[a] = b; komp--; }
  }
  return komp === 1;
}

/* Sedia všetky čísla s určenými lávkami? */
function cislaSedia(k) {
  const g = k.g;
  for (let i = 0; i < g.C; i++) {
    const es = g.hraneOstrova[i];
    let s = 0;
    for (let x = 0; x < es.length; x++) s += MLO[k.dom[es[x]]];
    if (s !== k.islands[i].n) return false;
  }
  return true;
}

function vsetkoUrcene(k) {
  for (let e = 0; e < k.g.E; e++) if (POCET[k.dom[e]] > 1) return false;
  return true;
}

/* Počiatočné domény: opts.initial je pole dolných hraníc (koľko lávok už
   niekto nakreslil), nie hotové hodnoty. Nula teda znamená "zatiaľ nič", nie
   "tu lávka nebude". */
function pociatocneDomeny(g, initial) {
  const dom = new Uint8Array(g.E).fill(PLNA);
  if (!initial) return dom;
  for (let e = 0; e < g.E; e++) {
    const x = initial[e] | 0;
    if (x > 0) dom[e] = maskaIntervalu(x, 2);
  }
  return dom;
}

/* ── solve: strojový riešiteľ ────────────────────────────────────────── *
 * solve(islands, n, { limit = 2, initial, maxNodes = 0, graf })
 *   Propagácia (číslo ostrova, kríženie, hranice na dvojicu), po nej
 *   vetvenie s návratom. Do riešenia sa počíta len taký stav, kde sedia
 *   všetky čísla a všetky ostrovy držia pokope. Dve zdravé orezania: keď sa
 *   ostrovy už nedajú spojiť ani cez všetky možné lávky, a keď sa uzavrela
 *   skupina, ktorá nemá všetky ostrovy.
 *   maxNodes zastaví hľadanie po toľkých vetvách (0 = bez stropu). Pri
 *   zastavení je count neúplný, preto vráti aj vycerpane: true; volajúci sa
 *   vtedy nesmie tváriť, že vie počet riešení. Strop je deterministický,
 *   takže zadanie ostáva pre daný kľúč rovnaké.
 * Vráti { count (do limit), solution (pole { a, b, k } prvého riešenia alebo
 * null), nodes, vycerpane }. */
export function solve(islands, n, opts = {}) {
  const limit = opts.limit ?? 2, maxNodes = opts.maxNodes ?? 0;
  const g = opts.graf || graf(islands, n);
  const k0 = kontext(g, islands, pociatocneDomeny(g, opts.initial), null);
  let count = 0, first = null, nodes = 0, vycerpane = false;
  zaciatok(k0);

  /* Vetví sa na ostrove s najmenšou vôľou: tam je najmenej možností. */
  function vyberDvojicu(k) {
    let best = -1, bestVola = Infinity;
    for (let i = 0; i < g.C; i++) {
      const es = g.hraneOstrova[i];
      let sumLo = 0, sumHi = 0, otvorena = -1;
      for (let x = 0; x < es.length; x++) {
        const m = k.dom[es[x]];
        sumLo += MLO[m]; sumHi += MHI[m];
        if (otvorena < 0 && POCET[m] > 1) otvorena = es[x];
      }
      if (otvorena < 0) continue;
      const vola = sumHi - sumLo;
      if (vola < bestVola) { bestVola = vola; best = otvorena; }
    }
    return best;
  }

  function rek(k) {
    if (vycerpane) return;
    nodes++;
    if (maxNodes && nodes > maxNodes) { vycerpane = true; return; }
    if (k.bad) return;
    if (!mozeBytSpojene(k)) return;
    if (uzavretaSkupina(k)) return;
    const e = vyberDvojicu(k);
    if (e < 0) {
      if (!cislaSedia(k) || !jednaSkupina(k)) return;
      count++;
      if (!first) first = riesenieZDomen(g, k.dom);
      return;
    }
    for (const val of HODNOTY[k.dom[e]]) {
      const k2 = kopia(k);
      obmedz(k2, e, 1 << val);
      propaguj(k2);
      rek(k2);
      if (vycerpane || count >= limit) return;
    }
  }
  rek(k0);
  return { count, solution: first, nodes, vycerpane };
}

/* ── solveHuman: len ľudské pravidlá, bez hádania ────────────────────── */

/* Vrstva 2: dvojica, ktorú by daný počet lávok celú dokončil a tým odrezal
 * jej skupinu od zvyšku. Pokrýva obe vety zo špecifikácie (dva ostrovy s
 * číslom 1 sa nespoja, dva ostrovy s číslom 2 sa nespoja dvojito) a rovnako
 * aj prípady, kde k dvojici už niečo visí. */
function krokVrstvy2(k) {
  const g = k.g, dom = k.dom;
  const pred = k.zmien;
  for (let e = 0; e < g.E; e++) {
    if (POCET[dom[e]] < 2) continue;
    const a = g.pary[e].a, b = g.pary[e].b;
    const zvA = zvysokOstrova(k, a, e), zvB = zvysokOstrova(k, b, e);
    if (zvA !== zvB) continue;
    const x = zvA;
    if (x < 1 || x > 2 || !(dom[e] & (1 << x))) continue;
    if (!odrezalaBySa(k, e, x)) continue;
    zacniKrok(k, 'pair-isolation', 2, e, { x });
    obmedz(k, e, maskaIntervalu(0, x - 1));
    ukonciKrok(k);
    if (k.bad || k.stop || k.zmien > pred) return true;
  }
  return false;
}
/* Koľko lávok ostrovu i ešte chýba, keď sa dvojica e neráta. */
function zvysokOstrova(k, i, e) {
  const es = k.g.hraneOstrova[i];
  let s = 0;
  for (let x = 0; x < es.length; x++) if (es[x] !== e) s += MLO[k.dom[es[x]]];
  return k.islands[i].n - s;
}
/* Odrezala by sa skupina, keby dvojica e dostala x lávok? */
function odrezalaBySa(k, e, x) {
  if (!k.t) k.t = kopia(k);
  const t = k.t;
  t.dom.set(k.dom);
  t.dom[e] = 1 << x;
  return uzavretaSkupina(t);
}

/* Skúška: daj dvojici e presne x lávok a nechaj bežať vrstvy 1 a 2. Vráti
   true, keď z toho vyjde spor alebo odrezaná skupina. */
function skus(k, e, x) {
  const t = kopia(k);
  obmedz(t, e, 1 << x);
  if (!propaguj(t)) return true;
  for (let kolo = 0; kolo < 6; kolo++) {
    if (!mozeBytSpojene(t) || uzavretaSkupina(t)) return true;
    const pred = t.zmien;
    krokVrstvy2(t);
    if (t.bad) return true;
    if (t.zmien === pred) break;
    if (!propaguj(t)) return true;
  }
  return !mozeBytSpojene(t) || uzavretaSkupina(t);
}

/* Vrstva 3: jednokroková skúška každej otvorenej dvojice. Hodnota, z ktorej
 * vyjde spor alebo odrezaná skupina, ide preč. */
function krokVrstvy3(k) {
  const g = k.g;
  for (let e = 0; e < g.E; e++) {
    if (POCET[k.dom[e]] < 2) continue;
    for (const x of HODNOTY[k.dom[e]]) {
      if (!skus(k, e, x)) continue;
      zacniKrok(k, 'trial', 3, e, { x });
      obmedz(k, e, PLNA & ~(1 << x));
      ukonciKrok(k);
      return true;
    }
  }
  return false;
}

/* solveHuman(islands, n, { initial, limitKrokov, stopPriLavke, maxVrstva, graf })
 *   Rieši len ľudskými pravidlami v troch vrstvách, bez hádania: vrstva 1
 *   (číslo ostrova a kríženie), vrstva 2 (dvojica, ktorá by sa odrezala),
 *   vrstva 3 (jednokroková skúška). Ľahšia vrstva má vždy prednosť; ťažšia
 *   príde na rad, až keď ľahšie nič nenájdu.
 *   initial: pole dolných hraníc na dvojicu (hráčove lávky); limitKrokov:
 *   skončiť po toľkých krokoch; stopPriLavke: skončiť hneď, ako niektorý
 *   krok naozaj postaví lávku (to používa nápoveda).
 * Vráti { solved, contradiction, layersUsed:{1,2,3}, steps, solution, dom },
 * kde steps sú kroky { rule, layer, edges:[{ a, b, val }], text } s anglickým
 * vysvetlením. */
export function solveHuman(islands, n, opts = {}) {
  const g = opts.graf || graf(islands, n);
  const steps = [];
  const k = kontext(g, islands, pociatocneDomeny(g, opts.initial), steps);
  k.limitKrokov = opts.limitKrokov || 0;
  k.stopPriLavke = !!opts.stopPriLavke;
  k.zaklad = new Uint8Array(g.E);
  if (opts.initial) for (let e = 0; e < g.E; e++) k.zaklad[e] = opts.initial[e] | 0;
  const maxVrstva = opts.maxVrstva ?? 3;
  zaciatok(k);
  while (!k.bad && !k.stop) {
    if (vsetkoUrcene(k)) break;
    const pred = k.zmien;
    krokVrstvy2(k);
    if (k.zmien === pred && !k.bad && !k.stop && maxVrstva >= 3) krokVrstvy3(k);
    if (k.bad || k.stop) break;
    if (k.zmien === pred) break;
    propaguj(k);
  }
  const solved = !k.bad && vsetkoUrcene(k) && cislaSedia(k) && jednaSkupina(k);
  const layersUsed = { 1: 0, 2: 0, 3: 0 };
  for (const s of steps) layersUsed[s.layer]++;
  return {
    solved,
    contradiction: k.bad,
    layersUsed,
    steps: steps.map((s) => verejnyKrok(s, g, islands)),
    solution: solved ? riesenieZDomen(g, k.dom) : null,
    dom: k.dom,
  };
}

/* ── Anglické vysvetlenia krokov ─────────────────────────────────────── */
function miesto(i, islands) {
  return 'the sandbank in row ' + (islands[i].r + 1) + ', column ' + (islands[i].c + 1);
}
function fraza(val) {
  return val === 0 ? 'no walkway' : val === 1 ? 'one walkway' : 'two walkways';
}
/* Krátky dovetok o tom, čo sa krokom rozhodlo. */
function dodatok(edges, islands) {
  if (edges.length === 1) {
    const e = edges[0];
    return ' That settles it: ' + fraza(e.val) + ' between ' + miesto(e.a, islands) + ' and ' + miesto(e.b, islands) + '.';
  }
  return ' That settles ' + edges.length + ' of those pairs at once.';
}
function verejnyKrok(s, g, islands) {
  const edges = [];
  for (let j = 0; j < s.edges.length; j += 2) {
    const e = s.edges[j];
    edges.push({ a: g.pary[e].a, b: g.pary[e].b, val: s.edges[j + 1] });
  }
  return { rule: s.rule, layer: s.layer, edges, text: textKroku(s, g, islands, edges) };
}
function textKroku(s, g, islands, edges) {
  const i = s.info;
  const d = s.data || {};
  switch (s.rule) {
    /* Prvá veta smie povedať len kde a akou technikou, počet lávok patrí až do
       dodatku za " That settles" (game.js podľa neho delí prvý a druhý stlač
       Hintu, ops/spec-hry-ux.md časť 5). Preto ani tieto dva prípady nesmú mať
       počet vo vete, hoci ho čítať z pravidla je ľahké. */
    case 'all-double':
      return 'The ' + d.need + ' on ' + miesto(i, islands) + ' reaches only ' + d.zive
        + ' other sandbanks, so weigh its number against the most those few pairs could carry.' + dodatok(edges, islands);
    case 'one-neighbour':
      return 'The ' + d.need + ' on ' + miesto(i, islands)
        + ' can reach only one other sandbank, so its whole number goes that way.' + dodatok(edges, islands);
    case 'needs-all':
      return 'The ' + d.need + ' on ' + miesto(i, islands)
        + ' has exactly as much room left around it as it still needs, so every walkway it can still take is drawn.' + dodatok(edges, islands);
    case 'island-full':
      return 'The ' + d.need + ' on ' + miesto(i, islands)
        + ' already has all of its walkways, so nothing more can leave it.' + dodatok(edges, islands);
    case 'at-least-one':
      return 'The ' + d.need + ' on ' + miesto(i, islands)
        + ' cannot get enough walkways from the other sandbanks it reaches, so some of them are forced.' + dodatok(edges, islands);
    case 'capacity':
      return 'The ' + d.need + ' on ' + miesto(i, islands)
        + ' has room for only so many walkways, and that is enough to pin one of them down.' + dodatok(edges, islands);
    case 'no-crossing': {
      const p = g.pary[i[0]], q = g.pary[i[1]];
      return 'A walkway between ' + miesto(p.a, islands) + ' and ' + miesto(p.b, islands)
        + ' already lies across the line from ' + miesto(q.a, islands) + ' to ' + miesto(q.b, islands)
        + ', and walkways never cross.' + dodatok(edges, islands);
    }
    case 'pair-isolation': {
      const p = g.pary[i];
      return fraza(d.x).charAt(0).toUpperCase() + fraza(d.x).slice(1) + ' between ' + miesto(p.a, islands)
        + ' and ' + miesto(p.b, islands) + ' would finish both of them and close their group off from the rest, so they take fewer.'
        + dodatok(edges, islands);
    }
    case 'trial': {
      const p = g.pary[i];
      return 'Try ' + fraza(d.x) + ' between ' + miesto(p.a, islands) + ' and ' + miesto(p.b, islands)
        + ': the numbers around them cannot then work out, so that count is out.' + dodatok(edges, islands);
    }
    default:
      return 'A step towards the walkways.';
  }
}

/* ── Denné zadanie ───────────────────────────────────────────────────── */

/* Koľko ostrovov patrí na ktorú mriežku (spec: 7x7 8 az 10, 9x9 12 az 15,
   11x11 18 az 22, 13x13 26 az 30). */
export const ROZSAH_OSTROVOV = { 7: [8, 10], 9: [12, 15], 11: [18, 22], 13: [26, 30] };
function rozsahPre(n) {
  if (ROZSAH_OSTROVOV[n]) return ROZSAH_OSTROVOV[n];
  const s = Math.max(3, Math.round(n * n * 0.16));
  return [s, s + 3];
}

/* generate(dateStr, opts) vyberie mriežku (predvolene 9 x 9) a zavolá
 * generateSeeded s dátumom ako menom aj kľúčom, takže každý deň má navždy tie
 * isté ostrovy. opts: n, ostrovy, maxAttempts (predvolene 200), maxVrstva. */
export function generate(dateStr, opts = {}) {
  if (!isValidDate(dateStr)) throw new Error('Date must be in YYYY-MM-DD form: ' + dateStr);
  const n = opts.n ?? 9;
  return generateSeeded(dateStr, dateStr + '/' + n, opts);
}

/* Náhodné poradie (Fisher-Yates) z rng. */
function zamiesaj(rng, m) {
  const a = Array.from({ length: m }, (_, i) => i);
  for (let i = m - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

/* Úsek medzi dvoma bodmi mriežky (ako čísla r * n + c). */
function usek(p, q, n) {
  const r1 = (p / n) | 0, c1 = p % n, r2 = (q / n) | 0, c2 = q % n;
  return {
    vodorovna: r1 === r2,
    r: Math.min(r1, r2), rr: Math.max(r1, r2),
    c: Math.min(c1, c2), cc: Math.max(c1, c2),
  };
}
function krizuju(s, t) {
  if (s.vodorovna === t.vodorovna) return false;
  const h = s.vodorovna ? s : t, v = s.vodorovna ? t : s;
  return h.c < v.c && v.c < h.cc && v.r < h.r && h.r < v.rr;
}
function leziNa(s, pos, n) {
  const r = (pos / n) | 0, c = pos % n;
  if (s.vodorovna) return r === s.r && c > s.c && c < s.cc;
  return c === s.c && r > s.r && r < s.rr;
}

/* Rozloženie ostrovov a lávok. Prvý ostrov náhodne, potom sa opakovane
 * vyberie existujúci ostrov a smer a vo vzdialenosti 2 az 5 sa položí nový:
 * nesmie prekryť ostrov, dotknúť sa iného ostrova zboku, ležať na lávke ani
 * krížiť lávku. Spojí sa jednou lávkou, asi v 30 percentách dvoma. Vráti
 * { ostrovy: [{ r, c }], mosty: [{ p, q, k }] } alebo null, keď sa
 * rozloženie nedorástlo na cieľ. */
function postavRozlozenie(rng, n, ciel, opts = {}) {
  const obsadene = new Set();
  const poz = [];
  const mosty = [];
  const useky = [];
  const stupen = [];
  const start = Math.floor(rng() * n) * n + Math.floor(rng() * n);
  obsadene.add(start); poz.push(start); stupen.push(0);
  let pokusy = 0;
  const maxPokusov = 200 * ciel;
  while (poz.length < ciel && pokusy < maxPokusov) {
    pokusy++;
    const a = Math.floor(rng() * poz.length);
    const d = Math.floor(rng() * 4);
    const dist = 2 + Math.floor(rng() * (opts.dosah ?? 4)); // 2 az 5 políčok
    const pocet = rng() < 0.3 ? 2 : 1;
    const ar = (poz[a] / n) | 0, ac = poz[a] % n;
    const nr = ar + SMERY[d][0] * dist, nc = ac + SMERY[d][1] * dist;
    if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
    if (stupen[a] + pocet > 8) continue;
    const p = nr * n + nc;
    if (obsadene.has(p)) continue;
    // medzi nimi nesmie stáť iný ostrov
    let volne = true;
    for (let s = 1; s < dist && volne; s++) {
      if (obsadene.has((ar + SMERY[d][0] * s) * n + (ac + SMERY[d][1] * s))) volne = false;
    }
    if (!volne) continue;
    // nový ostrov sa nesmie dotýkať iného zboku
    for (let m = 0; m < 4 && volne; m++) {
      const qr = nr + SMERY[m][0], qc = nc + SMERY[m][1];
      if (qr < 0 || qc < 0 || qr >= n || qc >= n) continue;
      if (obsadene.has(qr * n + qc)) volne = false;
    }
    if (!volne) continue;
    // nesmie ležať na existujúcej lávke
    for (let x = 0; x < useky.length && volne; x++) if (leziNa(useky[x], p, n)) volne = false;
    if (!volne) continue;
    const u = usek(poz[a], p, n);
    for (let x = 0; x < useky.length && volne; x++) if (krizuju(u, useky[x])) volne = false;
    if (!volne) continue;
    obsadene.add(p); poz.push(p); stupen.push(pocet);
    stupen[a] += pocet;
    mosty.push({ p: poz[a], q: p, k: pocet });
    useky.push(u);
  }
  if (poz.length < ciel) return null;
  return { poz, mosty, useky, stupen };
}

/* Zoradí ostrovy v poradí čítania a prepíše lávky na indexy. */
function usporiadaj(poz, mosty, n) {
  const zoradene = poz.slice().sort((a, b) => a - b);
  const index = new Map();
  zoradene.forEach((p, i) => index.set(p, i));
  const ostrovy = zoradene.map((p) => ({ r: (p / n) | 0, c: p % n, n: 0 }));
  const lavky = mosty.map((m) => {
    const a = index.get(m.p), b = index.get(m.q);
    return { a: Math.min(a, b), b: Math.max(a, b), k: m.k };
  });
  return { ostrovy, lavky };
}

/* Čísla ostrovov = počet lávok, ktoré z nich vedú. */
function prepisCisla(ostrovy, g, pocty) {
  for (let i = 0; i < ostrovy.length; i++) ostrovy[i].n = 0;
  for (let e = 0; e < g.E; e++) {
    if (!pocty[e]) continue;
    ostrovy[g.pary[e].a].n += pocty[e];
    ostrovy[g.pary[e].b].n += pocty[e];
  }
}

function rieseniePodlaPoctov(g, pocty) {
  const out = [];
  for (let e = 0; e < g.E; e++) if (pocty[e] >= 1) out.push({ a: g.pary[e].a, b: g.pary[e].b, k: pocty[e] });
  return out;
}

/* The same as generate, but the random seed comes from `key` (any string)
 * and `name` is only stored in the result as `date`. Practice puzzles and the
 * daily candidates use it. Deterministic: the same key gives the same puzzle.
 * opts: n (the grid of points, default 9), ostrovy ([least, most] sandbanks,
 * default from ROZSAH_OSTROVOV), maxVrstva (the highest layer of rules the
 * puzzle may need, default 3), maxAttempts (default 200), maxNodes (the
 * branching budget of the uniqueness check, default 20000), dosah (how many
 * different lengths a new sandbank may be dropped at, default 4, so 2 to 5
 * squares), navyse (how many walkways beyond the tree to try, as a share of
 * the sandbank count, default 0.12 plus up to 0.18 at random), prechody (how
 * many times the walkways are walked over and taken away, default 2).
 * Returns { date, n, islands ([{ r, c, n }] in reading order), bridges
 * ([{ a, b, k }]), seed, attempts, difficulty:{ layers:{1,2,3}, ostrovy,
 * lavky, steps }, ms }.
 * Pole s lávkami zadania sa volá bridges podľa ops/spec-cranes.md; solution
 * ostáva menom pre to, čo vráti solve alebo solveHuman, teda pre nájdené
 * riešenie, nie pre uložené zadanie. */
export function generateSeeded(name, key, opts = {}) {
  const n = opts.n ?? 9;
  const maxAttempts = opts.maxAttempts ?? 200;
  const maxVrstva = opts.maxVrstva ?? 3;
  // Strop na vetvenie pri kontrole jednoznačnosti. Bez neho sa riešiteľ na
  // veľmi riedkom zadaní zamotá na dlhé sekundy; s ním sa také odobratie
  // lávky proste neprijme a lávka na doske ostane.
  const maxNodes = opts.maxNodes ?? 20000;
  const [minO, maxO] = opts.ostrovy || rozsahPre(n);
  const t0 = nowMs();
  const seed = seedFromString(key);
  const rng = mulberry32(seed);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ciel = minO + Math.floor(rng() * (maxO - minO + 1));
    const surove = postavRozlozenie(rng, n, ciel, { dosah: opts.dosah });
    if (!surove) continue;
    const { ostrovy, lavky } = usporiadaj(surove.poz, surove.mosty, n);
    const g = graf(ostrovy, n);
    const pocty = new Uint8Array(g.E);
    let zle = false;
    for (const m of lavky) {
      const e = g.indexPary(m.a, m.b);
      if (e < 0) { zle = true; break; }
      pocty[e] += m.k;
      if (pocty[e] > 2) { zle = true; break; }
    }
    if (zle) continue;
    // niekoľko lávok navyše medzi ostrovmi, ktoré už stoja v rade, aby graf
    // nebol len strom
    const navyse = Math.round(ostrovy.length * ((opts.navyse ?? 0.12) + rng() * 0.18));
    let pridane = 0;
    for (const e of zamiesaj(rng, g.E)) {
      if (pridane >= navyse) break;
      if (pocty[e] !== 0) continue;
      let volne = true;
      for (const f of g.krizenia[e]) if (pocty[f] >= 1) { volne = false; break; }
      if (!volne) continue;
      const a = g.pary[e].a, b = g.pary[e].b;
      let sa = 0, sb = 0;
      for (const f of g.hraneOstrova[a]) sa += pocty[f];
      for (const f of g.hraneOstrova[b]) sb += pocty[f];
      if (sa + 1 > 8 || sb + 1 > 8) continue;
      pocty[e] = 1;
      pridane++;
    }
    prepisCisla(ostrovy, g, pocty);
    let nula = false;
    for (const o of ostrovy) if (o.n < 1) nula = true;
    if (nula) continue;
    const nase = rieseniePodlaPoctov(g, pocty);
    const r = solve(ostrovy, n, { limit: 2, maxNodes, graf: g });
    if (r.vycerpane || r.count !== 1 || !rovnakeLavky(r.solution, nase)) continue;
    const uvod = solveHuman(ostrovy, n, { maxVrstva, graf: g });
    if (!uvod.solved || !rovnakeLavky(uvod.solution, nase)) continue;

    // Minimalizácia: lávky sa odoberajú po jednej a nadobro, kým zadanie
    // ostáva jednoznačné aj ľudsky riešiteľné. Menej lávok znamená menšie
    // čísla, teda menej darovaného.
    // Cranes je v tomto iné než Magpies alebo Otters: každý ostrov musí svoje
    // číslo ukázať, takže sa odoberajú lávky, a lávka je aj tvrdá podmienka,
    // aj indícia. Bez stráže by sa zadanie zmenšilo na holý strom samých
    // jednotiek, ktorý sa rieši od listov a nemá čo ponúknuť. Preto sa
    // odobratie prijme len vtedy, keď sa nestratí ani jeden krok vrstvy 2
    // alebo 3.
    let vrstvy = uvod.layersUsed;
    for (let pass = 0; pass < (opts.prechody ?? 2); pass++) {
      for (const e of zamiesaj(rng, g.E)) {
        if (pocty[e] < 1) continue;
        const a = g.pary[e].a, b = g.pary[e].b;
        if (ostrovy[a].n < 2 || ostrovy[b].n < 2) continue;
        pocty[e]--; ostrovy[a].n--; ostrovy[b].n--;
        const skusane = rieseniePodlaPoctov(g, pocty);
        const rr = solve(ostrovy, n, { limit: 2, maxNodes, graf: g });
        let ok = !rr.vycerpane && rr.count === 1 && rovnakeLavky(rr.solution, skusane);
        let hu = null;
        if (ok) {
          hu = solveHuman(ostrovy, n, { maxVrstva, graf: g });
          ok = hu.solved && rovnakeLavky(hu.solution, skusane);
        }
        if (ok) ok = hu.layersUsed[2] >= vrstvy[2] && hu.layersUsed[3] >= vrstvy[3];
        if (ok) vrstvy = hu.layersUsed;
        else { pocty[e]++; ostrovy[a].n++; ostrovy[b].n++; }
      }
    }

    const finalne = rieseniePodlaPoctov(g, pocty);
    const fin = solveHuman(ostrovy, n, { maxVrstva, graf: g });
    if (!fin.solved || !rovnakeLavky(fin.solution, finalne)) {
      throw new Error('solveHuman settled on different walkways than the source for ' + name);
    }
    let lavkySpolu = 0;
    for (const m of finalne) lavkySpolu += m.k;
    return {
      date: name, n, islands: ostrovy, bridges: finalne, seed, attempts: attempt,
      difficulty: {
        layers: fin.layersUsed, ostrovy: ostrovy.length, lavky: lavkySpolu, steps: fin.steps.length,
      },
      ms: Math.round((nowMs() - t0) * 10) / 10,
    };
  }
  throw new Error('No unique, guess-free layout for ' + name + ' in ' + maxAttempts + ' attempts');
}
