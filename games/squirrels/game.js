/* Squirrels: the game page. One script for the daily wood, the archive days
 * and the practice sets; the page says which one it is:
 *
 *   <body data-den="YYYY-MM-DD">          an archive day (built page)
 *   <body data-sada="easy-1" data-k="3">  a practice wood
 *   nothing                               today's wood (or ?d=YYYY-MM-DD)
 *
 * The puzzle itself comes, in this order: from <script type="application/json"
 * id="zadanie"> embedded in a built page; from dni/YYYY-MM.json for the day;
 * or, when both are missing, generated right here from the date. All three
 * give the same wood for the same date (plan.mjs, generator.mjs).
 *
 * The board is always drawn here from the puzzle, so a built page only has to
 * carry the packed puzzle for the browser and a line of text for readers
 * without JavaScript.
 *
 * Ovladanie je od 11. 9. 2026 podla noveho standardu vzoru A
 * (ops/spec-hry-spolocne.md, cast "Vzor A ... ako Cracking the Cryptic"):
 * viacnasobny vyber a styri rezimy zadavania. Doska hraca je preto styri
 * ploche pole dlzky n*n:
 *   v   0 for an empty hollow, 1 to 9 for a number written in it, 0 on trunks
 *   pc  corner marks as a bit mask (bit d means the mark d is showing)
 *   pn  centre marks as a bit mask
 *   fa  0 for no colour, 1 to 9 for one of the nine cell colours
 *
 * Stored in localStorage (all in try/catch, private windows throw):
 *   squirrels:YYYY-MM-DD     { v, p, c, f, sec, start, done, hints, checks, t }
 *   squirrels:p:<set>:<k>    the same for a practice wood
 *   squirrels:streak         { posledny: YYYY-MM-DD, pocet }
 *   squirrels:nastavenia     the settings panel
 * `p` is the centre marks and `c` the corner marks: a save from before the new
 * controls carries only `p`, one grid of notes, and it is read back as centre
 * marks, which is what the standard asks for. sec = seconds spent before the
 * current run, start = ms when the current run began (null while paused or
 * before the first move), done = ms of the solve, hints and checks = help
 * used, t = ms of the last save. The history line is counted from the day
 * records themselves, there is no separate one.
 * Outgoing events via window.umami, if it runs: game_solved, game_check,
 * game_hint, game_share, game_setting. Nothing else leaves the browser, unless the player
 * is signed in (arling.sk account, /style/ucet.js): then every
 * squirrels:YYYY-MM-DD save is also pushed to the account (throttled, 2s) and
 * pulled back on load, so the streak and history follow across devices. Signed
 * out, nothing changes; a signed-in sync that fails over the network fails
 * silently, this browser's copy stays the truth.
 */
import { zadaniePreDen, zadanieCvicenie, rozbal, tyzden, urovenDna, posunDen, pekneDatum, kratkyDatum, UROVNE, SADY, PRVY_DEN, DNI } from './plan.mjs';
import { todayBratislava, isValidDate, behy } from './generator.mjs';
import { jeVyriesene, porovnaj, napoveda } from './logika.mjs';
import * as ucet from '/style/ucet.js';

const $ = (id) => document.getElementById(id);
const hraEl = $('hra');
const doska = $('doska');
const padEl = $('pad');
const rezimyEl = $('rezimy');
const stavEl = $('stav');
const casEl = $('cas');
const datumEl = $('datum');
const seriaEl = $('seria');
const spatBtn = $('spat');
const znovaBtn = $('znova');
const resetBtn = $('reset');
const checkBtn = $('check');
const hintBtn = $('hint');
const pauzaBtn = $('pauza');
const pauzaBlok = $('pauza-blok');
const pokracujBtn = $('pokracuj');
const pauzaCas = $('pauza-cas');
const pasik = $('pasik');
const zdielanieEl = $('zdielanie');
const zdielajBtn = $('zdielaj');
const zdielanieStav = $('zdielanie-stav');
const zdielanieText = $('zdielanie-text');
const urovenEl = $('uroven');
const historiaEl = $('historia');
const cislaText = $('cisla-text');

function track(name, data) { try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, data); } catch (e) { /* statistics are not part of the game */ } }

/* ── Storage ──────────────────────────────────────────────────────────── */
function nacitaj(kluc) {
  try { const s = localStorage.getItem(kluc); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function uloz(kluc, hodnota) {
  try { localStorage.setItem(kluc, JSON.stringify(hodnota)); } catch (e) { /* the game runs without storage */ }
}
function vsetkyKluce(prefix) {
  const out = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(prefix)) out.push(k); } } catch (e) { /* none */ }
  return out;
}

/* ── Settings ─────────────────────────────────────────────────────────── *
 * The list and the defaults are the standard's, in the standard's order
 * (ops/spec-hry-spolocne.md, "Vzor A ... ako Cracking the Cryptic"): they are
 * the settings Andrej plays Chess Sudoku with. Nothing here judges the board
 * while you play: Highlight errors (our Live check) is off, and so is Auto
 * remove restricted notes, because taking a player's own marks away for them
 * is exactly what he switches off.
 *   ovladanie          'selection' (cell first, then a number) or 'digit'
 *   casovac            Display timer
 *   zvyrazniRovnake    Highlight matching numbers
 *   tahVyber           'multiple' or 'single' cell selection when dragging
 *   zapisSoZnackami    'fill' (a number fills a noted cell) or 'note'
 *   zivaKontrola       Highlight errors
 *   predvolenyStyl     Default note style, 'corner' or 'centre'
 *   autoOdstranZnacky  Auto remove restricted notes
 *   pauzaPriOdchode    Auto pause
 *   lenPad             Onscreen input only
 *   potvrditReset      Confirm before Restart
 * lenPad = "Onscreen input only": the pad under the wood writes, the number
 * keys of a physical keyboard do not. Arrows, Escape, Undo, Redo and Pause
 * keep working, so the game stays reachable from the keyboard even with it on. */
const NASTAVENIA_KLUC = 'squirrels:nastavenia';
const NASTAVENIA_VERZIA = 2;   // the controls changed on 11. 9. 2026; an older stored set is not read
const NASTAVENIA_PREDVOLENE = {
  ovladanie: 'selection', casovac: true, zvyrazniRovnake: false, tahVyber: 'multiple',
  zapisSoZnackami: 'fill', zivaKontrola: false, predvolenyStyl: 'corner', autoOdstranZnacky: false,
  pauzaPriOdchode: true, lenPad: false, potvrditReset: true,
};
const ulozeneNastavenia = nacitaj(NASTAVENIA_KLUC);
let nastavenia = Object.assign({}, NASTAVENIA_PREDVOLENE,
  ulozeneNastavenia && ulozeneNastavenia.verzia === NASTAVENIA_VERZIA ? ulozeneNastavenia : {});
function ulozNastavenia() { uloz(NASTAVENIA_KLUC, Object.assign({ verzia: NASTAVENIA_VERZIA }, nastavenia)); }

/* ── Which wood ───────────────────────────────────────────────────────── */
const dnes = todayBratislava();
const body = document.body;
let rezim = 'den';            // 'den' (daily or archive day) or 'cvicenie'
let datum = dnes;
let sada = null, kSada = 0;
if (body.dataset.sada) {
  rezim = 'cvicenie'; sada = body.dataset.sada; kSada = +body.dataset.k || 1;
} else if (body.dataset.den && isValidDate(body.dataset.den)) {
  datum = body.dataset.den;
} else {
  try { const d = new URL(location.href).searchParams.get('d'); if (d && isValidDate(d)) datum = d; } catch (e) { /* today */ }
}
const jeDnes = rezim === 'den' && datum === dnes;
const jeBuduci = rezim === 'den' && datum > dnes;
const KLUC = rezim === 'cvicenie' ? 'squirrels:p:' + sada + ':' + kSada : 'squirrels:' + datum;
/* Undo history lives in its own key, never inside the day record. The account
 * sync sends every day record to the server (odosliStav), and the history of
 * one board would be by far the biggest thing in that payload; `squirrels:h:`
 * also fails the isValidDate test in stavVsetkychDni, so it is left out of the
 * sync by construction. */
const HISTORIA_KLUC = KLUC.replace('squirrels:', 'squirrels:h:');
// The root address always opens today's wood; once the date is settled,
// rewrite it to today's built page so the address bar and a shared link
// point at the day itself (Andrej, 10. 9.). Only the plain root qualifies:
// a built archive day already names its date, a practice page its set, and
// a page opened with ?d= keeps that query untouched.
if (rezim === 'den' && !body.dataset.den && jeDnes && !location.search) {
  try { history.replaceState(null, '', '/games/squirrels/' + datum + '/'); } catch (e) { /* the address stays generic; the game still works */ }
}

function formatCas(sek) {
  const h = Math.floor(sek / 3600), m = Math.floor((sek % 3600) / 60), s = sek % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}
function slovaCas(sek) {
  const m = Math.floor(sek / 60), s = sek % 60;
  const a = m ? m + (m === 1 ? ' minute' : ' minutes') : '';
  const b = s || !m ? s + (s === 1 ? ' second' : ' seconds') : '';
  return a && b ? a + ' ' + b : a || b;
}
function zoznamSlov(a) {
  if (a.length === 1) return a[0];
  if (a.length === 2) return a[0] + ' and ' + a[1];
  return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
}
function cifryZMasky(m) { const out = []; for (let d = 1; d <= 9; d++) if (m & (1 << d)) out.push(d); return out; }

/* ── Loading the wood ─────────────────────────────────────────────────── */
function vlozene() {
  const el = $('zadanie');
  if (!el) return null;
  try { return rozbal(JSON.parse(el.textContent)); } catch (e) { return null; }
}
async function zTabulky(iso) {
  try {
    const r = await fetch('/games/squirrels/dni/' + iso.slice(0, 7) + '.json', { cache: 'no-cache' });
    if (!r.ok) return null;
    const t = await r.json();
    const z = Array.isArray(t) ? t.find((x) => x.d === iso) : null;
    return z ? rozbal(z) : null;
  } catch (e) { return null; }
}
async function nacitajZadanie() {
  const vl = vlozene();
  if (vl) return vl;
  if (rezim === 'cvicenie') return zadanieCvicenie(sada, kSada);
  return (await zTabulky(datum)) || zadaniePreDen(datum);
}

/* ── State ────────────────────────────────────────────────────────────── */
let zadanie, n, beh, v, pc, pn, fa, start, done, sekundy, hints, checks, ulozene;
let undoStack = [];
let redoStack = [];
const vyber = new Set();    // the picked hollows, by cell index; a set, never one number
let kotva = -1;             // the hollow that carries the focus and the arrow keys
/* Entry modes, exactly the four of the standard. Z, X, C, V pick one, the
 * space bar cycles, a held Shift is Corner and a held Ctrl is Centre for as
 * long as it is held. */
const REZIMY = ['normal', 'corner', 'centre', 'colour'];
let rezimZadania = 'normal';
let cifraVRuke = -1;        // Digit first: the number waiting on the pad, -1 for none
let tikac = null;
let necinnost = null;
let pauza = false;
let tip = null;             // the hint on screen, cleared by the next move
let tipUkazany = false;
let odhalene = false;       // Check's second step is showing the wrong numbers
let checkStav = null;       // what the last Check saw, so the second press can reveal it
const bunky = [];           // the hollow elements, by cell index (null on a trunk)
const kmene = [];           // the trunk elements, by cell index (null on a hollow)
const znacky = [];          // the two <span> of a trunk, by cell index: [across, down]

/* ── Drawing ──────────────────────────────────────────────────────────── */
function suradnice(i) { return 'row ' + (((i / n) | 0) + 1) + ', column ' + ((i % n) + 1); }
function postavMriezku() {
  document.documentElement.style.setProperty('--n', n);
  doska.setAttribute('aria-label', 'Acorn grid ' + n + ' by ' + n);
  doska.textContent = '';
  bunky.length = 0; kmene.length = 0; znacky.length = 0;
  const frag = document.createDocumentFragment();
  for (let r = 0; r < n; r++) {
    const riadok = document.createElement('div');
    riadok.className = 'riadok';
    riadok.setAttribute('role', 'row');
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const okraj = (r === 0 ? ' r0' : '') + (c === 0 ? ' c0' : '');
      const cell = zadanie.cells[i];
      if (cell) {
        const k = document.createElement('div');
        k.className = 'k' + okraj;
        k.dataset.i = i;
        k.setAttribute('role', 'gridcell');
        const popis = [];
        if (cell.r != null) { const s = document.createElement('span'); s.className = 'sr'; s.textContent = cell.r; k.appendChild(s); popis.push(cell.r + ' across'); }
        if (cell.d != null) { const s = document.createElement('span'); s.className = 'sd'; s.textContent = cell.d; k.appendChild(s); popis.push(cell.d + ' down'); }
        if (!popis.length) k.classList.add('prazdny');
        k.setAttribute('aria-label', popis.length ? 'tree, ' + popis.join(', ') : 'tree');
        riadok.appendChild(k);
        bunky.push(null); kmene.push(k);
        znacky.push([k.querySelector('.sr'), k.querySelector('.sd')]);
      } else {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'b' + okraj;
        b.dataset.i = i;
        b.dataset.v = '0';
        b.setAttribute('role', 'gridcell');
        b.setAttribute('aria-selected', 'false');
        b.tabIndex = -1;
        const cif = document.createElement('span');
        cif.className = 'cif';
        b.appendChild(cif);
        // Corner marks: nine fixed places in the order sudokupad uses, left
        // top, right top, left bottom, right bottom, top, bottom, left,
        // right, middle. The marks themselves are sorted and dropped into
        // those places in turn, so two marks always sit in the two top
        // corners whatever the numbers are.
        const rohy = document.createElement('span');
        rohy.className = 'rohy';
        for (let s = 0; s < 9; s++) rohy.appendChild(document.createElement('i'));
        b.appendChild(rohy);
        const stred = document.createElement('span');
        stred.className = 'stred';
        b.appendChild(stred);
        riadok.appendChild(b);
        bunky.push(b); kmene.push(null); znacky.push(null);
      }
    }
    frag.appendChild(riadok);
  }
  doska.appendChild(frag);
  const prva = bunky.find((x) => x);
  if (prva) prva.tabIndex = 0;
  merajBunku();
  popisSignov();
}
/* Every number on the board is drawn from --cell, the measured width of one
 * cell, so a twelve by twelve on a phone reads the same way as a six by six
 * on a desktop. */
function merajBunku() {
  const w = doska.clientWidth;
  if (w > 0 && n) doska.style.setProperty('--cell', (w / n) + 'px');
}
if (window.ResizeObserver) new ResizeObserver(merajBunku).observe(doska);
else window.addEventListener('resize', merajBunku);

/* The signs as plain text for a screen reader: the drawing itself only tells
 * the shape of the wood, not what it asks for. */
function popisSignov() {
  if (!cislaText) return;
  const casti = [];
  for (const run of beh.runs) {
    if (run.sum == null) continue;
    casti.push(run.sum + ' ' + (run.dir === 'h' ? 'across' : 'down') + ' from row ' + (run.r + 1) + ', column ' + (run.c + 1) + ', ' + run.len + (run.len === 1 ? ' hollow' : ' hollows'));
  }
  cislaText.textContent = 'The signs of the wood, ' + n + ' by ' + n + ', ' + casti.length + ' runs in all. ' + casti.join('. ') + '.';
}
function ukazBunku(i) {
  const b = bunky[i];
  if (!b) return;
  const val = v[i] || 0;
  b.dataset.v = String(val);
  b.firstChild.textContent = val ? String(val) : '';
  // Number entry with noted cells: Fill cell. The number covers the marks of
  // its hollow, it does not take them away; Delete gives them back.
  const rohy = cifryZMasky(pc[i]);
  const rohyEl = b.querySelector('.rohy');
  const iSlot = rohyEl.children;
  for (let s = 0; s < 9; s++) iSlot[s].textContent = s < rohy.length ? String(rohy[s]) : '';
  // how many corner marks there are decides how big they may be, the same way
  // the centre marks already shrink as they grow
  rohyEl.dataset.k = String(rohy.length);
  const stred = cifryZMasky(pn[i]);
  const stredEl = b.querySelector('.stred');
  stredEl.textContent = stred.join('');
  stredEl.dataset.k = String(stred.length);
  if (fa[i]) b.dataset.f = String(fa[i]); else b.removeAttribute('data-f');
  const casti = [];
  if (val) casti.push(val + (val === 1 ? ' acorn' : ' acorns'));
  if (rohy.length) casti.push('corner marks ' + rohy.join(' '));
  if (stred.length) casti.push('centre marks ' + stred.join(' '));
  if (fa[i]) casti.push('colour ' + fa[i]);
  b.setAttribute('aria-label', suradnice(i) + ', ' + (casti.length ? casti.join(', ') : 'empty'));
}
/* A soft visual cue only, not a judgement: a run whose hollows are all filled,
 * add up to the total on its sign and use no number twice goes quiet. It says
 * nothing about whether the numbers are RIGHT (Andrej, 10. 9.: nothing turns
 * red while playing; only Check judges). */
function behSplneny(run) {
  let sum = 0, pouzite = 0;
  for (const i of run.cells) {
    const d = v[i];
    if (!d) return false;
    if (pouzite & (1 << d)) return false;
    pouzite |= 1 << d;
    sum += d;
  }
  return run.sum == null || sum === run.sum;
}
function oznacSplnene() {
  const hotovyBeh = new Uint8Array(beh.runs.length);
  beh.runs.forEach((run, id) => { hotovyBeh[id] = behSplneny(run) ? 1 : 0; });
  for (let id = 0; id < beh.runs.length; id++) {
    const run = beh.runs[id];
    const par = znacky[run.clue];
    if (!par) continue;
    const el = run.dir === 'h' ? par[0] : par[1];
    if (el) el.classList.toggle('splnene', !!hotovyBeh[id]);
  }
  for (let i = 0; i < n * n; i++) {
    const b = bunky[i];
    if (!b) continue;
    const a = beh.cellRuns[2 * i], d = beh.cellRuns[2 * i + 1];
    b.classList.toggle('stlmena', !!v[i] && (a < 0 || !!hotovyBeh[a]) && (d < 0 || !!hotovyBeh[d]));
  }
}
/* The picked hollows. The two runs through a hollow are shaded only when a
 * single hollow is picked: with several picked, that shading would cover half
 * the wood and say nothing (the standard: units are shaded for one cell). */
function oznacVyber() {
  for (const b of bunky) if (b) { b.classList.remove('vybrana', 'beh', 'rovnaka', 'vh', 'vp', 'vd', 'vl'); b.setAttribute('aria-selected', 'false'); }
  if (!vyber.size) return;
  if (vyber.size === 1) {
    const i = [...vyber][0];
    for (const k of [beh.cellRuns[2 * i], beh.cellRuns[2 * i + 1]]) {
      if (k < 0) continue;
      for (const j of beh.runs[k].cells) if (bunky[j]) bunky[j].classList.add('beh');
    }
    if (nastavenia.zvyrazniRovnake && v[i]) {
      for (let j = 0; j < n * n; j++) if (bunky[j] && v[j] === v[i]) bunky[j].classList.add('rovnaka');
    }
  }
  /* One outline round the whole picked shape, the way sudokupad draws it: a
   * side is drawn only where the hollow next to it is not picked too, so two
   * picked neighbours share one hairline instead of standing back to back with
   * two frames between them. */
  for (const i of vyber) {
    const b = bunky[i];
    if (!b) continue;
    b.classList.add('vybrana');
    b.setAttribute('aria-selected', 'true');
    const r = (i / n) | 0, c = i % n;
    if (!(r > 0 && vyber.has(i - n))) b.classList.add('vh');
    if (!(c < n - 1 && vyber.has(i + 1))) b.classList.add('vp');
    if (!(r < n - 1 && vyber.has(i + n))) b.classList.add('vd');
    if (!(c > 0 && vyber.has(i - 1))) b.classList.add('vl');
  }
}
function ukazVsetko() {
  for (let i = 0; i < n * n; i++) ukazBunku(i);
  oznacSplnene();
  oznacVyber();
}
function zmazTip() {
  if (!tip) return;
  tip = null; tipUkazany = false;
  for (const b of bunky) if (b) b.classList.remove('tip', 'tip-beh');
  for (const k of kmene) if (k) k.classList.remove('tip-beh');
  if (hintBtn) hintBtn.textContent = 'Hint';
}
function zmazOdhalenie() {
  if (!odhalene && !checkStav) return;
  odhalene = false; checkStav = null;
  for (const b of bunky) if (b) b.classList.remove('chyba');
  if (checkBtn) checkBtn.textContent = 'Check';
}
/* Highlight errors is off by default; when it is on, a wrong number is marked
 * as soon as it is written, with a frame and a mark, not by colour alone. */
function zivaKontrola() {
  if (!nastavenia.zivaKontrola || done || !zadanie) return;
  const p = porovnaj(v, zadanie.solution);
  for (const i of p.zle) if (bunky[i]) bunky[i].classList.add('chyba');
}

/* ── The selection ────────────────────────────────────────────────────── *
 * A set of cell indexes, never a single number: a click picks one hollow, a
 * drag picks the hollows it runs over, Ctrl (Cmd) plus a click adds or takes
 * one away, Ctrl plus an arrow grows the selection, Escape lets it all go. */
function vyberJednu(i) {
  vyber.clear();
  if (bunky[i]) vyber.add(i);
  kotva = i;
  oznacVyber();
}
function vyberPridaj(i) {
  if (!bunky[i]) return;
  vyber.add(i);
  kotva = i;
  oznacVyber();
}
function vyberPrepni(i) {
  if (!bunky[i]) return;
  if (vyber.has(i)) vyber.delete(i); else vyber.add(i);
  kotva = i;
  oznacVyber();
}
function vyberZrus() {
  if (!vyber.size) return;
  vyber.clear();
  oznacVyber();
}
/* Roving tabindex: exactly one hollow is in the page's tab order (WAI-ARIA
 * grid pattern), and it is the one the arrows last left. */
function zameraj(i, fokus) {
  if (i < 0 || !bunky[i]) return;
  for (const b of bunky) if (b) b.tabIndex = -1;
  kotva = i;
  bunky[i].tabIndex = 0;
  if (fokus) bunky[i].focus({ preventScroll: true });
}
/* The next hollow in a direction, wrapping round the edge of the wood: down
 * on the last row comes back to the top, as the standard asks. Trunks are
 * stepped over. */
function dalsia(i, dr, dc) {
  let r = (i / n) | 0, c = i % n;
  for (let k = 0; k < n * n; k++) {
    r = (r + dr + n) % n; c = (c + dc + n) % n;
    const j = r * n + c;
    if (bunky[j]) return j;
  }
  return -1;
}

/* ── What the modes do ────────────────────────────────────────────────── */
function nastavRezim(r) {
  if (!REZIMY.includes(r)) return;
  rezimZadania = r;
  if (hraEl) hraEl.dataset.rezim = r;
  if (padEl) padEl.dataset.rezim = r;
  if (rezimyEl) for (const b of rezimyEl.querySelectorAll('button[data-rezim]')) b.setAttribute('aria-pressed', b.dataset.rezim === r ? 'true' : 'false');
}
function cyklujRezim() { nastavRezim(REZIMY[(REZIMY.indexOf(rezimZadania) + 1) % REZIMY.length]); }
/* N keeps its old job in the new world: it walks the two note styles and back
 * to Normal, starting from the Default note style. */
function cyklujZnacky() {
  /* Poradie sa odvija od predvolby, nie od napevno zapisanych krokov. */
  const prvy = nastavenia.predvolenyStyl === 'centre' ? 'centre' : 'corner';
  const druhy = prvy === 'centre' ? 'corner' : 'centre';
  if (rezimZadania === prvy) nastavRezim(druhy);
  else if (rezimZadania === druhy) nastavRezim('normal');
  else nastavRezim(prvy);
}
/* A held Shift is Corner and a held Ctrl is Centre, for that one keystroke. */
function rezimPreUdalost(e) {
  if (!e) return rezimZadania;
  if (e.shiftKey) return 'corner';
  if (e.ctrlKey || e.metaKey) return 'centre';
  return rezimZadania;
}

/* ── Time ─────────────────────────────────────────────────────────────── */
function ubehnute() {
  if (done) return sekundy;
  return sekundy + (start ? Math.max(0, Math.floor((Date.now() - start) / 1000)) : 0);
}
function ukazCas() {
  casEl.textContent = formatCas(ubehnute());
  if (pauzaBtn) pauzaBtn.hidden = !(start && !done) || !nastavenia.casovac;
}
function spustiTikac() { if (tikac || done || !start) return; tikac = setInterval(ukazCas, 1000); }
function zastavTikac() { if (tikac) { clearInterval(tikac); tikac = null; } }
/* The clock is a score, never a limit. It stops when the tab goes away and
 * after a minute without a single move (ops/spec-hry-ux.md, part 6). */
function nastavNecinnost() {
  if (necinnost) { clearTimeout(necinnost); necinnost = null; }
  if (!nastavenia.pauzaPriOdchode || done || pauza || !start) return;
  necinnost = setTimeout(() => pozastav(true), 60000);
}
function pozastav(auto) {
  if (done || pauza) return;
  if (start) { sekundy = ubehnute(); start = null; }
  pauza = true;
  zastavTikac();
  nastavNecinnost();
  ulozStav();
  ukazCas();
  if (pauzaCas) pauzaCas.textContent = sekundy ? 'You have spent ' + slovaCas(sekundy) + ' so far.' : 'Your numbers are kept; the clock continues when you resume.';
  if (pauzaBlok) pauzaBlok.hidden = false;
  doska.classList.add('pauza');
  if (!auto && pokracujBtn) pokracujBtn.focus();
}
function pokracuj() {
  if (!pauza) return;
  pauza = false;
  start = Date.now();
  if (pauzaBlok) pauzaBlok.hidden = true;
  doska.classList.remove('pauza');
  spustiTikac();
  nastavNecinnost();
  ulozStav();
  ukazCas();
}

/* ── Streak and history ───────────────────────────────────────────────── */
/* Jeden zmeškaný deň po piatich výhrach séria odpustí, najviac dva razy za
 * mesiac (ops/spec-hry-ux.md, časť 8). Odpustenie sa minie až vtedy, keď hráč
 * po vynechanom dni naozaj vyrieši; do záznamu sa ukladá mesiac a počet
 * odpustení v ňom, takže nový mesiac začína znova s dvoma. */
const ODPUSTENI_ZA_MESIAC = 2;
function odpusteniVMesiaci(s, den) {
  return s && s.odpusteneMesiac === den.slice(0, 7) ? (s.odpustene || 0) : 0;
}
function odpustitVieme(s, den) {
  if (!s || s.pocet < 5) return false;
  if (s.posledny !== posunDen(den, -2)) return false;   // presne jeden vynechaný deň
  return odpusteniVMesiaci(s, den) < ODPUSTENI_ZA_MESIAC;
}
/* Jeden krok série: k záznamu `s` pridá vyriešený deň `den`. Rovnaké pravidlo
 * používa zápis po vyriešení aj prepočet po zlúčení s účtom, takže sa tie dve
 * cesty nemôžu rozísť. */
function krokSerie(s, den) {
  const odpustene = odpusteniVMesiaci(s, den);
  let pocet = 1, minute = 0;
  if (s.posledny === posunDen(den, -1)) pocet = s.pocet + 1;
  else if (odpustitVieme(s, den)) { pocet = s.pocet + 1; minute = 1; }
  return { posledny: den, pocet, odpusteneMesiac: den.slice(0, 7), odpustene: odpustene + minute };
}
function ukazSeriu() {
  if (!seriaEl) return;
  const s = nacitaj('squirrels:streak');
  if (!s || !s.pocet) { seriaEl.textContent = ''; return; }
  const ziva = s.posledny === dnes || s.posledny === posunDen(dnes, -1);
  const odpustime = !ziva && odpustitVieme(s, dnes);
  if (!ziva && !odpustime) { seriaEl.textContent = ''; return; }
  seriaEl.textContent = 'Streak: ' + s.pocet + (s.pocet === 1 ? ' day' : ' days')
    + (odpustime ? ', one missed day forgiven if you solve today' : '');
}
function zapisSeriu() {
  // Only a wood solved on its own day counts: the archive is for practice.
  if (!jeDnes) return;
  const s = nacitaj('squirrels:streak') || { posledny: null, pocet: 0 };
  if (s.posledny === datum) return;
  uloz('squirrels:streak', krokSerie(s, datum));
}
/* Every solved day in this browser, newest first. */
function historiaDni() {
  const out = [];
  for (const k of vsetkyKluce('squirrels:')) {
    const d = k.slice('squirrels:'.length);
    if (!isValidDate(d)) continue;
    const s = nacitaj(k);
    if (s && s.done) out.push({ d, sec: s.sec || 0, hints: s.hints || 0, checks: s.checks || 0 });
  }
  return out.sort((a, b) => (a.d < b.d ? 1 : -1));
}
function ukazHistoriu() {
  if (!historiaEl) return;
  const h = historiaDni();
  if (!h.length) { historiaEl.hidden = true; return; }
  const best = h.reduce((a, x) => (x.sec && (!a || x.sec < a.sec) ? x : a), null);
  const ciste = h.filter((x) => !x.hints && !x.checks).length;
  const podlaUrovne = {};
  for (const x of h) { const u = UROVNE[urovenDna(x.d)].label.toLowerCase(); podlaUrovne[u] = (podlaUrovne[u] || 0) + 1; }
  const urovne = Object.keys(podlaUrovne).map((u) => podlaUrovne[u] + ' ' + u).join(', ');
  const priemer = Math.round(h.reduce((a, x) => a + (x.sec || 0), 0) / h.length);
  historiaEl.hidden = false;
  historiaEl.innerHTML = '<b>Your woods:</b> ' + h.length + ' solved' + (urovne ? ' (' + urovne + ')' : '') + (ciste ? ', ' + ciste + ' clean, with no hint and no check' : ', none clean yet')
    + (best ? ', best ' + formatCas(best.sec) + ' on ' + kratkyDatum(best.d) : '') + (priemer ? ', average ' + formatCas(priemer) : '') + '. <a href="/games/squirrels/archive/">Archive and full history</a>.';
}

/* ── Saving and solving ───────────────────────────────────────────────── */
function ulozStav() { uloz(KLUC, { v, p: pn, c: pc, f: fa, sec: sekundy, start, done, hints, checks, t: Date.now() }); ulozHistoriu(); naplanujOdoslanie(); }
/* Undo and Redo survive a reload too, because the standard counts the Undo
 * history as part of the saved state. A snapshot is written sparsely, only the
 * hollows that hold something, as index.value in base 36, so a board in the
 * middle of a game costs a few hundred characters instead of a few thousand.
 * The stack in memory stays unlimited; only what is written out is cut, first
 * by count and then by length, so a long session can never fill the browser's
 * storage and push the board itself out of it. */
const HISTORIA_MAX = 60;
const HISTORIA_ZNAKOV = 120000;
function zbalPole(a) {
  let s = '';
  for (let i = 0; i < a.length; i++) if (a[i]) s += (s ? ' ' : '') + i.toString(36) + '.' + a[i].toString(36);
  return s;
}
function rozbalPole(s, dlzka) {
  const a = new Array(dlzka).fill(0);
  if (typeof s !== 'string' || !s) return a;
  for (const c of s.split(' ')) {
    const j = c.indexOf('.');
    if (j < 1) continue;
    const i = parseInt(c.slice(0, j), 36), x = parseInt(c.slice(j + 1), 36);
    if (i >= 0 && i < dlzka && x > 0) a[i] = x;
  }
  return a;
}
function zbalStav(s) { return [zbalPole(s.v), zbalPole(s.c), zbalPole(s.p), zbalPole(s.f)]; }
function rozbalStav(z, dlzka) {
  if (!Array.isArray(z) || z.length !== 4) return null;
  return { v: rozbalPole(z[0], dlzka), c: rozbalPole(z[1], dlzka), p: rozbalPole(z[2], dlzka), f: rozbalPole(z[3], dlzka) };
}
function zmazHistoriu() {
  undoStack = []; redoStack = [];
  try { localStorage.removeItem(HISTORIA_KLUC); } catch (e) { /* the game runs without storage */ }
}
function ulozHistoriu() {
  if (!n || done || (!undoStack.length && !redoStack.length)) {
    try { localStorage.removeItem(HISTORIA_KLUC); } catch (e) { /* the game runs without storage */ }
    return;
  }
  const u = undoStack.slice(-HISTORIA_MAX).map(zbalStav);
  const r = redoStack.slice(-HISTORIA_MAX).map(zbalStav);
  let text = JSON.stringify({ n, u, r, t: Date.now() });
  // the furthest step goes first: the Redo nobody will reach, then the oldest Undo
  while (text.length > HISTORIA_ZNAKOV && u.length + r.length > 1) {
    if (r.length > u.length) r.shift(); else u.shift();
    text = JSON.stringify({ n, u, r, t: Date.now() });
  }
  try { localStorage.setItem(HISTORIA_KLUC, text); } catch (e) { /* the game runs without storage */ }
}
function nacitajHistoriu() {
  const h = nacitaj(HISTORIA_KLUC);
  if (!h || h.n !== n || !Array.isArray(h.u) || !Array.isArray(h.r)) { zmazHistoriu(); return; }
  undoStack = h.u.map((z) => rozbalStav(z, n * n)).filter(Boolean);
  redoStack = h.r.map((z) => rozbalStav(z, n * n)).filter(Boolean);
}

function ukazStav() {
  oznacSplnene();
  stavEl.classList.toggle('ok', !!done);
  if (zdielanieEl) zdielanieEl.hidden = !done;   // Share only after the wood is finished
  if (done) {
    const s = sekundy ? ' in ' + formatCas(sekundy) : '';
    const pomoc = [];
    if (hints) pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
    if (checks) pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
    const hn = pomoc.length ? ' with ' + pomoc.join(' and ') : ' without a hint or a check';
    stavEl.innerHTML = '<b>Solved</b>' + s + hn + '. ' + (pomoc.length ? 'The squirrels have their winter.' : 'A clean wood: the squirrels are impressed.')
      + (jeDnes ? ' A new wood arrives at midnight, Bratislava time.' : '');
    return;
  }
  const napisane = v.reduce((a, x) => a + (x ? 1 : 0), 0);
  if (!napisane) { stavEl.textContent = 'Pick a hollow, or drag across several, then a number from the pad.'; return; }
  let prazdne = 0;
  for (let i = 0; i < n * n; i++) if (bunky[i] && !v[i]) prazdne++;
  if (!prazdne) { stavEl.textContent = 'Every hollow holds a number, but the wood is not right yet. Check shows where.'; return; }
  stavEl.textContent = '';
}

/* ── Share ────────────────────────────────────────────────────────────── *
 * A voluntary step after the wood is finished (ops/spec-hry-ux.md, part 8).
 * The text carries which wood it was, the time, the hints and checks used and
 * the outline of the wood, trunks and hollows, with not one number in it, so
 * it cannot spoil the puzzle for whoever reads it. Nothing is sent anywhere;
 * the text only goes to the clipboard, and when the browser refuses that, into
 * a box the player can copy by hand. */
const ZNAK_KMEN = '\u{1F7EB}';    // hneda kocka: strom
const ZNAK_DUTINA = '\u{2B1C}';   // biela kocka: dutina
function odkazNaLes() {
  const b = 'https://arling.sk/games/squirrels/';
  if (rezim === 'cvicenie') return b + 'practice/' + sada + '/' + (kSada === 1 ? '' : kSada + '/');
  return jeDnes ? b : b + datum + '/';
}
function textNaZdielanie() {
  const riadky = [];
  for (let r = 0; r < n; r++) {
    let s = '';
    for (let c = 0; c < n; c++) s += zadanie.cells[r * n + c] ? ZNAK_KMEN : ZNAK_DUTINA;
    riadky.push(s);
  }
  const kto = rezim === 'cvicenie' ? 'Squirrels practice ' + sada + ', wood ' + kSada : 'Squirrels ' + datum;
  const pomoc = [];
  if (hints) pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
  if (checks) pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
  return kto + ' · ' + UROVNE[zadanie.uroven].label + '\n'
    + riadky.join('\n') + '\n'
    + 'Solved' + (sekundy ? ' in ' + formatCas(sekundy) : '') + (pomoc.length ? ' with ' + pomoc.join(' and ') : ', clean: no hint, no check') + '\n'
    + odkazNaLes();
}
async function skopiruj(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch (e) { /* an old browser, or a page without permission: the box below */ }
  try {
    const t = document.createElement('textarea');
    t.value = text;
    t.setAttribute('readonly', '');
    t.style.position = 'fixed'; t.style.top = '-1000px';
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(t);
    return ok;
  } catch (e) { return false; }
}
if (zdielajBtn) zdielajBtn.addEventListener('click', async () => {
  if (!done || !zadanie) return;
  const text = textNaZdielanie();
  const ok = await skopiruj(text);
  if (zdielanieStav) zdielanieStav.textContent = ok
    ? 'Copied. It says nothing about the numbers, and nothing was sent anywhere.'
    : 'This browser would not let the page copy for you. Here is the text, take it from the box.';
  if (zdielanieText) {
    zdielanieText.value = text;
    zdielanieText.hidden = ok;
    if (!ok) { zdielanieText.focus(); zdielanieText.select(); }
  }
  track('game_share', { game: 'squirrels', copied: ok, level: zadanie.uroven });
});

/* ── Check, in two steps ──────────────────────────────────────────────── *
 * The first press says how many numbers are wrong and in which rows; only the
 * second press marks them. The puzzle stays a puzzle unless you ask twice.
 * When a single hollow is picked, only the two runs through it are checked,
 * which is how a crossword checks one word (ops/spec-hry-ux.md, part 4). */
function rozsahCheck() {
  if (vyber.size === 1) {
    const jedna = [...vyber][0];
    if (bunky[jedna]) {
      const set = new Set();
      for (const k of [beh.cellRuns[2 * jedna], beh.cellRuns[2 * jedna + 1]]) {
        if (k < 0) continue;
        for (const i of beh.runs[k].cells) set.add(i);
      }
      const cells = [...set];
      if (cells.some((i) => v[i])) return { cells, kde: ' in the two runs through the hollow you picked' };
    }
  }
  return { cells: null, kde: '' };
}
function skontrolujStav() {
  if (done || pauza) return;
  const r = rozsahCheck();
  const p = porovnaj(v, zadanie.solution);
  const zle = r.cells ? p.zle.filter((i) => r.cells.includes(i)) : p.zle;
  const napisane = r.cells ? r.cells.filter((i) => v[i]).length : p.vyplnene;
  if (!napisane) { stavEl.textContent = 'Nothing written down yet.'; return; }
  checks++;
  ulozStav();
  if (!zle.length) {
    zmazOdhalenie();
    stavEl.textContent = 'Everything right so far' + r.kde + ': ' + napisane + (napisane === 1 ? ' number' : ' numbers') + ' and not one of them wrong.';
    track('game_check', { game: 'squirrels', wrong: 0 });
    return;
  }
  if (checkStav && !odhalene) {
    odhalene = true;
    for (const i of zle) if (bunky[i]) bunky[i].classList.add('chyba');
    stavEl.textContent = 'The marked ' + (zle.length === 1 ? 'hollow does' : 'hollows do') + ' not hold ' + (zle.length === 1 ? 'that number' : 'those numbers') + ' in the finished wood. Take them out and keep going.';
    checkBtn.textContent = 'Check';
    track('game_check', { game: 'squirrels', wrong: zle.length, revealed: true });
    return;
  }
  // The rough area may be a row or a column (ops/spec-hry-ux.md, part 4); we
  // name whichever side needs fewer of them, so mistakes stacked in one column
  // are told as that one column instead of four separate rows.
  const riadky = [], stlpce = [];
  for (const i of zle) {
    const rr = ((i / n) | 0) + 1, cc = (i % n) + 1;
    if (!riadky.includes(rr)) riadky.push(rr);
    if (!stlpce.includes(cc)) stlpce.push(cc);
  }
  const poRiadkoch = riadky.length <= stlpce.length;
  const kde = (poRiadkoch ? riadky : stlpce).sort((a, b) => a - b).map((k) => (poRiadkoch ? 'row ' : 'column ') + k);
  checkStav = { zle: zle.length };
  stavEl.textContent = 'There ' + (zle.length === 1 ? 'is 1 number that is wrong' : 'are ' + zle.length + ' numbers that are wrong') + r.kde
    + ', in ' + zoznamSlov(kde.slice(0, 4)) + (kde.length > 4 ? ' and elsewhere' : '') + '. Press Check again to show where.';
  checkBtn.textContent = 'Show';
  track('game_check', { game: 'squirrels', wrong: zle.length, revealed: false });
}

/* ── Hint, in two steps ───────────────────────────────────────────────── *
 * The first press names the rule and the place and outlines the two runs it
 * reads, without saying what goes there; the second press writes that one
 * number and explains it in full. Every hint is counted and shown at the end. */
const VETY = {
  'wrong-number': (kde) => 'There is a number in ' + kde + ' that the finished wood does not have there. Take it out before going on.',
  'last-in-run': (kde) => 'One run through ' + kde + ' has a single empty hollow left, so its total decides what goes in.',
  'single-combo': (kde) => 'A total on one of the runs through ' + kde + ' can be made in only one way, and that settles this hollow.',
  'naked-single': (kde) => 'What the run across and the run down still allow in ' + kde + ' leaves it only one number.',
  'hidden-single': (kde) => 'A number one of the runs through ' + kde + ' has to use fits only that one hollow.',
  'pair': (kde) => 'Two hollows of a run through ' + kde + ' hold two numbers between them, which takes those numbers away from this one.',
  'run-sum': (kde) => 'Once the crossing runs are taken into account, the total of a run through ' + kde + ' can be made in only one way here.',
  'trial': (kde) => 'Write each number ' + kde + ' still allows and follow the plain rules: all but one run into a contradiction.',
  'reveal': (kde) => 'No named rule reaches from here, so this hint simply opens ' + kde + '.',
};
function ukazNapovedu() {
  if (done || pauza) return;
  if (tip && tipUkazany) {
    // second press: write it. A hint writes into one hollow only, and it
    // writes a real number, so the marks of that hollow go with it.
    const t = tip;
    hints++;   // counted before the move, so the save inside it carries the new number
    const zmenilo = zmenaStavu(() => {
      for (const x of t.bunky) {
        v[x.i] = x.val;
        pc[x.i] = 0;
        pn[x.i] = 0;
        if (x.val && nastavenia.autoOdstranZnacky) vyskrtniZnacky(x.i, x.val);
      }
    });
    const text = t.druh === 'chyba' ? t.text.replace('Clear it before going on.', 'It is cleared now.') : t.text;
    zmazTip(); zmazOdhalenie();
    track('game_hint', { game: 'squirrels', rule: t.pravidlo, layer: t.vrstva, applied: true });
    if (!zmenilo) { ulozStav(); ukazStav(); }
    if (!done) stavEl.textContent = text;
    return;
  }
  const h = napoveda(v, zadanie.cells, zadanie.solution, n);
  if (!h) return;
  tip = h; tipUkazany = true;
  const i = h.bunky[0].i;
  for (const k of [beh.cellRuns[2 * i], beh.cellRuns[2 * i + 1]]) {
    if (k < 0) continue;
    const run = beh.runs[k];
    for (const j of run.cells) if (bunky[j]) bunky[j].classList.add('tip-beh');
    if (kmene[run.clue]) kmene[run.clue].classList.add('tip-beh');
  }
  for (const x of h.bunky) if (bunky[x.i]) bunky[x.i].classList.add('tip');
  vyberJednu(i);
  zameraj(i, false);
  const veta = VETY[h.pravidlo] || VETY.reveal;
  const chyba = h.druh === 'chyba';
  stavEl.textContent = veta(suradnice(i)) + (chyba ? ' Press Hint again to clear it.' : ' Press Hint again to write it in.');
  hintBtn.textContent = chyba ? 'Clear it' : 'Write it';
  track('game_hint', { game: 'squirrels', rule: h.pravidlo, layer: h.vrstva, applied: false });
}

function skontroluj() {
  if (!jeVyriesene(v, zadanie.cells, n)) return false;
  sekundy = ubehnute();
  done = Date.now();
  start = null;
  zastavTikac();
  nastavNecinnost();
  doska.classList.add('hotovo');
  zmazTip(); zmazOdhalenie();
  vyberZrus();               // the finished wood is green all over, not one picked hollow
  ukazCas();
  zapisSeriu();
  ukazSeriu();
  ulozStav();
  ukazHistoriu();
  ukazPasik();
  track('game_solved', { game: 'squirrels', day: rezim === 'den' ? datum : sada + '/' + kSada, seconds: sekundy, hints, checks, level: zadanie.uroven });
  return true;
}

/* ── Moves ────────────────────────────────────────────────────────────── *
 * Every change to the board goes through zmenaStavu: it keeps the whole board
 * before and after, so Undo and Redo are one shared stack with no limit and
 * Restart is undone by a single Undo (ops/spec-hry-ux.md, part 3). */
function ukazTlacidla() {
  if (spatBtn) spatBtn.disabled = !undoStack.length || !!done;
  if (znovaBtn) znovaBtn.disabled = !redoStack.length || !!done;
}
function odfotStav() { return { v: v.slice(), c: pc.slice(), p: pn.slice(), f: fa.slice() }; }
function nastavStav(s) { v = s.v.slice(); pc = s.c.slice(); pn = s.p.slice(); fa = s.f.slice(); }
function rovnake(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function rovnakeStavy(a, b) { return rovnake(a.v, b.v) && rovnake(a.c, b.c) && rovnake(a.p, b.p) && rovnake(a.f, b.f); }
function zmenaStavu(fn) {
  if (done || pauza) return false;
  const pred = odfotStav();
  fn();
  if (rovnakeStavy(odfotStav(), pred)) return false;
  undoStack.push(pred);
  redoStack.length = 0;
  poTahu();
  return true;
}
function poTahu() {
  if (!start) { start = Date.now(); spustiTikac(); }
  ukazVsetko();
  zmazTip(); zmazOdhalenie();
  if (!skontroluj()) { ulozStav(); zivaKontrola(); }
  ukazStav();
  ukazCas();
  ukazTlacidla();
  nastavNecinnost();
}
/* Auto remove restricted notes, off by default (Andrej plays without it):
 * with it on, a number written into a hollow takes the same mark out of every
 * other hollow of its two runs, corner and centre alike. */
function vyskrtniZnacky(i, d) {
  for (const k of [beh.cellRuns[2 * i], beh.cellRuns[2 * i + 1]]) {
    if (k < 0) continue;
    for (const j of beh.runs[k].cells) if (j !== i) { pc[j] &= ~(1 << d); pn[j] &= ~(1 << d); }
  }
}
function ciele() { return [...vyber].filter((i) => bunky[i]); }
/* One number, every picked hollow, by mode. In Normal the same number again
 * takes it back, in Corner and Centre the mark is switched on unless every
 * picked hollow already has it, in Colour the same colour again takes it off:
 * the way back is always the same key twice. */
function zapisCifru(d, r) {
  if (done || pauza || !d) return;
  const c = ciele();
  if (!c.length) { stavEl.textContent = 'Pick a hollow first, then a number.'; return; }
  if (r === 'colour') {
    const maju = c.every((i) => fa[i] === d);
    zmenaStavu(() => { for (const i of c) fa[i] = maju ? 0 : d; });
    return;
  }
  if (r === 'corner' || r === 'centre') {
    const pole = r === 'corner' ? pc : pn;
    const maju = c.every((i) => pole[i] & (1 << d));
    zmenaStavu(() => { for (const i of c) { if (maju) pole[i] &= ~(1 << d); else pole[i] |= 1 << d; } });
    return;
  }
  // Normal. With "Number entry with noted cells: Add note" a hollow that
  // already carries marks takes another mark instead of the number; the
  // default, Fill cell, writes the number and lets the marks hide under it.
  if (nastavenia.zapisSoZnackami === 'note' && c.every((i) => !v[i] && (pc[i] || pn[i]))) {
    zapisCifru(d, nastavenia.predvolenyStyl === 'centre' ? 'centre' : 'corner');
    return;
  }
  const maju = c.every((i) => v[i] === d);
  zmenaStavu(() => {
    for (const i of c) {
      v[i] = maju ? 0 : d;
      if (!maju && nastavenia.autoOdstranZnacky) vyskrtniZnacky(i, d);
    }
  });
}
/* Delete and Backspace, in the order the standard sets: the numbers first,
 * then the marks (corner and centre together), then the colour. Marks hidden
 * under a number come back with the number's own Delete, because Fill cell
 * only covers them. */
function zmazVybrane() {
  if (done || pauza) return;
  const c = ciele();
  if (!c.length) return;
  if (c.some((i) => v[i])) { zmenaStavu(() => { for (const i of c) v[i] = 0; }); return; }
  if (c.some((i) => pc[i] || pn[i])) { zmenaStavu(() => { for (const i of c) { pc[i] = 0; pn[i] = 0; } }); return; }
  zmenaStavu(() => { for (const i of c) fa[i] = 0; });
}

function spat() {
  if (done || pauza || !undoStack.length) return;
  redoStack.push(odfotStav());
  nastavStav(undoStack.pop());
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) { ulozStav(); zivaKontrola(); }
  ukazStav();
  ukazTlacidla();
}
function znova() {
  if (done || pauza || !redoStack.length) return;
  undoStack.push(odfotStav());
  nastavStav(redoStack.pop());
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) { ulozStav(); zivaKontrola(); }
  ukazStav();
  ukazTlacidla();
}
/* Restart: the wood as it was given, with every number, mark and colour gone
 * and the clock still running (Andrej, 10. 9.: clearing is a move, not a
 * restart of the day). One Undo brings everything back. */
function restart() {
  if (done || pauza) return;
  if (v.every((x) => !x) && pc.every((x) => !x) && pn.every((x) => !x) && fa.every((x) => !x)) return;
  if (nastavenia.potvrditReset && !window.confirm('Restart the wood? Every number, mark and colour goes; the clock keeps running and one Undo brings them back.')) return;
  zmenaStavu(() => {
    v = new Array(n * n).fill(0);
    pc = new Array(n * n).fill(0);
    pn = new Array(n * n).fill(0);
    fa = new Array(n * n).fill(0);
  });
}

/* ── Pointer ──────────────────────────────────────────────────────────── *
 * A click or a tap picks one hollow, a drag picks every hollow it runs over
 * ("Cell selection when dragging: select multiple cells"), Ctrl or Cmd plus a
 * click adds one to the selection or takes it away. With Control method set
 * to Digit first the pad holds a number and the taps write it. */
function bunkaPod(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const b = el && el.closest ? el.closest('.b') : null;
  return b && doska.contains(b) ? +b.dataset.i : -1;
}
let tah = null; // { id, rezim: 'vyber' | 'pisanie' }
doska.addEventListener('pointerdown', (e) => {
  if (done || pauza || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const i = bunkaPod(e);
  if (i < 0) { if (!e.ctrlKey && !e.metaKey) vyberZrus(); return; }
  if (nastavenia.ovladanie === 'digit' && cifraVRuke >= 0) {
    vyberJednu(i);
    zameraj(i, true);
    if (cifraVRuke === 0) zmazVybrane(); else zapisCifru(cifraVRuke, rezimZadania);
    tah = { id: e.pointerId, rezim: 'pisanie' };
  } else {
    // Ctrl (Cmd) adds a hollow or takes it out again, and only Ctrl: a held
    // Shift writes a corner mark, so it must not quietly grow the selection
    // as well. The standard and the other two games give this to Ctrl alone.
    if (e.ctrlKey || e.metaKey) vyberPrepni(i);
    else vyberJednu(i);
    zameraj(i, true);
    tah = { id: e.pointerId, rezim: 'vyber' };
  }
  try { doska.setPointerCapture(e.pointerId); } catch (err) { /* works without capture too, less smoothly */ }
  e.preventDefault();
});
doska.addEventListener('pointermove', (e) => {
  if (!tah || tah.id !== e.pointerId || done || pauza) return;
  const i = bunkaPod(e);
  if (i < 0 || i === kotva) return;
  if (tah.rezim === 'pisanie') {
    vyberJednu(i);
    zameraj(i, false);
    if (cifraVRuke === 0) zmazVybrane(); else zapisCifru(cifraVRuke, rezimZadania);
    return;
  }
  if (nastavenia.tahVyber === 'single') { vyberJednu(i); zameraj(i, false); return; }
  vyberPridaj(i);
  zameraj(i, false);
});
function koniecTahu(e) {
  if (!tah || tah.id !== e.pointerId) return;
  tah = null;
  try { doska.releasePointerCapture(e.pointerId); } catch (err) { /* nothing */ }
}
doska.addEventListener('pointerup', koniecTahu);
doska.addEventListener('pointercancel', (e) => { if (tah && tah.id === e.pointerId) tah = null; });
/* Tab into the board and the hollow that takes the focus is the picked one. */
doska.addEventListener('focusin', (e) => {
  const b = e.target && e.target.closest ? e.target.closest('.b') : null;
  if (!b) return;
  const i = +b.dataset.i;
  kotva = i;
  if (!vyber.size) vyberJednu(i);
});

/* ── The number pad and the four mode buttons ─────────────────────────── */
function ukazCifruVRuke() {
  if (!padEl) return;
  for (const b of padEl.querySelectorAll('button[data-d]')) b.setAttribute('aria-pressed', nastavenia.ovladanie === 'digit' && +b.dataset.d === cifraVRuke ? 'true' : 'false');
}
padEl.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-d]');
  if (!b || done || pauza) return;
  const d = +b.dataset.d;
  if (nastavenia.ovladanie === 'digit') {
    cifraVRuke = cifraVRuke === d ? -1 : d;
    ukazCifruVRuke();
    stavEl.textContent = cifraVRuke < 0 ? 'No number in hand. Tap a number, then the hollows.'
      : (cifraVRuke === 0 ? 'Erase in hand. Tap the hollows to clear them.' : cifraVRuke + ' in hand. Tap the hollows to write it.');
    return;
  }
  if (!vyber.size) { stavEl.textContent = 'Pick a hollow first, then a number.'; return; }
  if (!d) zmazVybrane(); else zapisCifru(d, rezimZadania);
});
if (rezimyEl) rezimyEl.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-rezim]');
  if (!b) return;
  nastavRezim(b.dataset.rezim);
});
if (spatBtn) spatBtn.addEventListener('click', spat);
if (znovaBtn) znovaBtn.addEventListener('click', znova);
if (resetBtn) resetBtn.addEventListener('click', restart);
if (checkBtn) checkBtn.addEventListener('click', skontrolujStav);
if (hintBtn) hintBtn.addEventListener('click', ukazNapovedu);
if (pauzaBtn) pauzaBtn.addEventListener('click', () => pozastav(false));
if (pokracujBtn) pokracujBtn.addEventListener('click', pokracuj);

/* ── Keyboard ─────────────────────────────────────────────────────────── *
 * One listener for the whole page, because the selection is the board's and
 * not one focused button's. Arrows and WASD move the selection and wrap round
 * the edge, Ctrl plus an arrow grows it, Escape lets it go; 1 to 9 (the row
 * and the numeric keypad) write in the current mode, Z X C V pick a mode, the
 * space bar cycles them, N walks the two note styles and back; Delete and
 * Backspace clear in the standard's order; U and Ctrl+Z undo, R, Ctrl+Y and
 * Ctrl+Shift+Z redo. Ctrl+R is never taken: that is the browser's reload. */
function jeVstup(el) { return !!el && /^(input|textarea|select)$/i.test(el.tagName || ''); }
function jeTlacidlo(el) { return !!el && (/^(button|a|summary)$/i.test(el.tagName || '')) && !el.closest('#doska'); }
function posunVyber(dr, dc, rozsiruj) {
  const z = kotva >= 0 && bunky[kotva] ? kotva : bunky.findIndex((x) => x);
  if (z < 0) return;
  const ciel = vyber.size || kotva >= 0 ? dalsia(z, dr, dc) : z;
  if (ciel < 0) return;
  if (rozsiruj) vyberPridaj(ciel); else vyberJednu(ciel);
  zameraj(ciel, true);
}
document.addEventListener('keydown', (e) => {
  if (jeVstup(e.target)) return;
  const ctrl = e.ctrlKey || e.metaKey;
  // Undo and Redo first: they work even while the board is finished being read.
  if (ctrl && (e.key === 'z' || e.key === 'Z')) { if (e.shiftKey) znova(); else spat(); e.preventDefault(); return; }
  if (ctrl && (e.key === 'y' || e.key === 'Y')) { znova(); e.preventDefault(); return; }
  if (e.key === 'Escape') {
    if (pauza) { pokracuj(); return; }
    if (cifraVRuke >= 0) { cifraVRuke = -1; ukazCifruVRuke(); }
    vyberZrus();
    return;
  }
  // Pause both ways, and above the guard below: P is also the way back out of
  // a pause, and a wood that is asleep answers no other key.
  if (!ctrl && (e.key === 'p' || e.key === 'P')) {
    if (pauza) pokracuj(); else if (!done) pozastav(false);
    e.preventDefault();
    return;
  }
  if (done || pauza) return;
  const smer = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key]
    || (!ctrl && !e.altKey ? { w: [-1, 0], W: [-1, 0], s: [1, 0], S: [1, 0], a: [0, -1], A: [0, -1], d: [0, 1], D: [0, 1] }[e.key] : null);
  // Ctrl (Cmd) plus an arrow grows the selection, and only Ctrl: a held Shift
  // is how a corner mark is borrowed, the same as in Hares and Badgers.
  if (smer) { posunVyber(smer[0], smer[1], ctrl); e.preventDefault(); return; }
  if (ctrl && !/^[1-9]$/.test(e.key)) return;   // Ctrl+R, Ctrl+C and the rest stay the browser's
  if (e.key === 'Delete' || e.key === 'Backspace' || e.key === '0') {
    if (nastavenia.lenPad) return;   // Onscreen input only: the pad writes, the keyboard does not
    zmazVybrane(); e.preventDefault(); return;
  }
  if (/^[1-9]$/.test(e.key)) {
    if (nastavenia.lenPad) return;
    zapisCifru(+e.key, rezimPreUdalost(e));
    e.preventDefault(); return;
  }
  if (ctrl) return;
  if (e.key === ' ') { if (jeTlacidlo(e.target)) return; cyklujRezim(); e.preventDefault(); return; }
  switch (e.key) {
    case 'z': case 'Z': nastavRezim('normal'); e.preventDefault(); return;
    case 'x': case 'X': nastavRezim('corner'); e.preventDefault(); return;
    case 'c': case 'C': nastavRezim('centre'); e.preventDefault(); return;
    case 'v': case 'V': nastavRezim('colour'); e.preventDefault(); return;
    case 'n': case 'N': cyklujZnacky(); e.preventDefault(); return;
    case 'u': case 'U': spat(); e.preventDefault(); return;
    case 'r': case 'R': znova(); e.preventDefault(); return;
    default: return;
  }
});
document.addEventListener('keydown', nastavNecinnost, true);
document.addEventListener('pointerdown', nastavNecinnost, true);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (nastavenia.pauzaPriOdchode && start && !done) pozastav(true); }
  else ukazCas();
});

/* ── The week strip ───────────────────────────────────────────────────── *
 * A finished wood has two marks (ops/spec-hry-ux.md, part 8): solved, and
 * solved clean with no hint and no check. The clean one adds the class
 * `ciste` (a dot in the corner, so the difference is a shape and not only a
 * colour) and says so in the aria-label as well. */
function triedaStavu(st) {
  if (st && st.done) return st.hints || st.checks ? ' hotove' : ' hotove ciste';
  return st && st.v && st.v.some((x) => x) ? ' rozohrane' : '';
}
function slovoStavu(st) {
  if (!st || !st.done) return '';
  return st.hints || st.checks ? ', solved with help' : ', solved clean';
}
function ukazPasik() {
  if (!pasik) return;
  pasik.textContent = '';
  if (rezim === 'cvicenie') {
    const s = SADY.find((x) => x.id === sada);
    for (let k = 1; k <= s.pocet; k++) {
      const st = nacitaj('squirrels:p:' + sada + ':' + k);
      const a = document.createElement(k === kSada ? 'span' : 'a');
      a.className = 'den' + (k === kSada ? ' dnes' : '') + triedaStavu(st);
      if (k !== kSada) a.href = '/games/squirrels/practice/' + sada + '/' + k + '/';
      a.innerHTML = '<small>No.</small><b>' + k + '</b>';
      a.setAttribute('aria-label', 'Wood ' + k + slovoStavu(st));
      if (k === kSada) a.setAttribute('aria-current', 'page');
      pasik.appendChild(a);
    }
    return;
  }
  const dni = tyzden(datum);
  dni.forEach((d, k) => {
    const st = nacitaj('squirrels:' + d);
    const buduci = d > dnes, pred = d < PRVY_DEN;
    const tag = d === datum || buduci || pred ? 'span' : 'a';
    const a = document.createElement(tag);
    a.className = 'den' + (d === datum ? ' dnes' : '') + (buduci || pred ? ' buduci' : '') + triedaStavu(st);
    if (tag === 'a') a.href = '/games/squirrels/' + d + '/';
    a.innerHTML = '<small>' + DNI[k] + '</small><b>' + Number(d.slice(8)) + '</b>';
    a.title = pekneDatum(d) + ', ' + UROVNE[urovenDna(d)].label + (buduci ? ' (not yet)' : '');
    a.setAttribute('aria-label', a.title + slovoStavu(st));
    if (d === datum) a.setAttribute('aria-current', 'page');
    pasik.appendChild(a);
  });
}

/* ── Settings panel ───────────────────────────────────────────────────── */
const casBlok = $('cas-blok');
function pouziNastavenia() {
  if (casBlok) casBlok.hidden = !nastavenia.casovac;
  if (!nastavenia.zivaKontrola && !odhalene) { for (const b of bunky) if (b) b.classList.remove('chyba'); }
  zivaKontrola();
  if (nastavenia.ovladanie !== 'digit') cifraVRuke = -1;
  ukazCifruVRuke();
  if (hraEl) hraEl.dataset.ovladanie = nastavenia.ovladanie;
  oznacVyber();
  nastavNecinnost();
  ukazCas();
}
document.querySelectorAll('[data-nastavenie]').forEach((el) => {
  const kluc = el.getAttribute('data-nastavenie');
  const jeVyber = el.tagName.toLowerCase() === 'select';
  if (jeVyber) el.value = String(nastavenia[kluc]); else el.checked = !!nastavenia[kluc];
  el.addEventListener('change', () => {
    nastavenia[kluc] = jeVyber ? el.value : el.checked;
    ulozNastavenia();
    pouziNastavenia();
    track('game_setting', { game: 'squirrels', setting: kluc, value: String(nastavenia[kluc]) });
  });
});

/* ── Account sync (only when signed in, silent otherwise) ────────────────
 * The account stores one object per game: { dni: { 'YYYY-MM-DD': stav }, t }.
 * On merge, for each day the record with the higher `t` wins, but a `done` on
 * either side is never dropped (a slightly older save should not un-solve a
 * day). The streak is then rebuilt from the merged solved days instead of
 * trusted as a stored number, so a merge can never leave it wrong. */
function stavVsetkychDni() {
  const out = {};
  for (const k of vsetkyKluce('squirrels:')) {
    const d = k.slice('squirrels:'.length);
    if (!isValidDate(d)) continue;
    const s = nacitaj(k);
    if (s) out[d] = s;
  }
  return out;
}
function zlucStavDna(lokalny, vzdialeny) {
  if (!vzdialeny) return lokalny;
  if (!lokalny) return vzdialeny;
  const x = (vzdialeny.t || 0) >= (lokalny.t || 0) ? vzdialeny : lokalny;
  const hotovo = lokalny.done || vzdialeny.done || null;
  return hotovo && !x.done ? Object.assign({}, x, { done: hotovo }) : x;
}
/* Po zlúčení s účtom sa séria počíta znova z vyriešených dní, od najstaršieho
 * a tým istým krokom ako pri hraní, takže odpustené dni prežijú aj prepočet.
 * Séria žije, kým je posledný vyriešený deň dnešok alebo včerajšok, prípadne
 * predvčerajšok s voľným odpustením. */
function prepocitajSeriu() {
  const dni = stavVsetkychDni();
  const hotove = Object.keys(dni).filter((d) => isValidDate(d) && d <= dnes && dni[d].done).sort();
  let s = { posledny: null, pocet: 0, odpusteneMesiac: null, odpustene: 0 };
  for (const d of hotove) s = krokSerie(s, d);
  const ziva = s.pocet && (s.posledny === dnes || s.posledny === posunDen(dnes, -1) || odpustitVieme(s, dnes));
  if (!ziva) { try { localStorage.removeItem('squirrels:streak'); } catch (e) { /* nič */ } return; }
  uloz('squirrels:streak', s);
}
function odosliStav() {
  if (!ucet.prihlaseny()) return;
  ucet.hra.uloz('squirrels', { dni: stavVsetkychDni(), t: Date.now() }).catch(() => { /* sieťová chyba: lokálne ostáva pravdou */ });
}
let syncCakanie = null, syncPosledny = 0;
function naplanujOdoslanie() {
  if (!ucet.prihlaseny()) return;
  const zvysok = 2000 - (Date.now() - syncPosledny);
  if (zvysok <= 0) { syncPosledny = Date.now(); odosliStav(); return; }
  if (syncCakanie) return;
  syncCakanie = setTimeout(() => { syncCakanie = null; syncPosledny = Date.now(); odosliStav(); }, zvysok);
}
/* One saved day into the four arrays of the board. `p` is the centre marks:
 * a save from before the new controls has only that one grid of notes, and
 * the standard says it comes back as centre marks. */
function poleZoStavu(s, kluc, dlzka) {
  return s && Array.isArray(s[kluc]) && s[kluc].length === dlzka ? s[kluc].slice() : new Array(dlzka).fill(0);
}
async function synchronizujUcet() {
  if (!ucet.prihlaseny()) return;
  let vzdialene;
  try { vzdialene = await ucet.hra.nacitaj('squirrels'); } catch (e) { return; /* sieťová chyba: lokálne ostáva pravdou */ }
  const diaDni = vzdialene && vzdialene.dni && typeof vzdialene.dni === 'object' ? vzdialene.dni : {};
  let zmenene = false;
  for (const [d, r] of Object.entries(diaDni)) {
    if (!isValidDate(d) || !r || typeof r !== 'object') continue;
    const kluc = 'squirrels:' + d;
    const l = nacitaj(kluc);
    const scelene = zlucStavDna(l, r);
    if (!l || JSON.stringify(l) !== JSON.stringify(scelene)) { uloz(kluc, scelene); zmenene = true; }
  }
  if (zmenene) {
    prepocitajSeriu();
    ukazSeriu();
    ukazHistoriu();
    ukazPasik();
    if (rezim === 'den' && !done) {
      const cerstve = nacitaj(KLUC);
      if (cerstve && Array.isArray(cerstve.v) && n && cerstve.v.length === n * n && (cerstve.t || 0) > ((ulozene && ulozene.t) || 0)) {
        ulozene = cerstve;
        v = cerstve.v.slice();
        pn = poleZoStavu(cerstve, 'p', n * n);
        pc = poleZoStavu(cerstve, 'c', n * n);
        fa = poleZoStavu(cerstve, 'f', n * n);
        done = cerstve.done || null;
        hints = cerstve.hints || 0;
        checks = cerstve.checks || 0;
        sekundy = cerstve.sec || 0;
        // a board that came in from another browser: its own history is the
        // only one that matches it, and that history was never synced
        zmazHistoriu();
        ukazVsetko();
        if (done) { doska.classList.add('hotovo'); zastavTikac(); }
        ukazStav();
        ukazCas();
        ukazTlacidla();
      }
    }
  }
  // push back too: a day solved only in this browser (or a done just merged in) reaches the account right away
  odosliStav();
}

/* ── Start ────────────────────────────────────────────────────────────── */
async function spusti() {
  if (jeBuduci) {
    datumEl.textContent = pekneDatum(datum);
    stavEl.textContent = 'This wood opens on ' + pekneDatum(datum) + ' (Bratislava time). Come back then, or play today’s wood.';
    doska.hidden = true;
    if (padEl) padEl.hidden = true;
    if (rezimyEl) rezimyEl.hidden = true;
    for (const b of [spatBtn, znovaBtn, resetBtn, checkBtn, hintBtn]) if (b) b.disabled = true;
    ukazPasik();
    return;
  }
  try {
    zadanie = await nacitajZadanie();
  } catch (e) {
    stavEl.textContent = 'The wood could not be prepared. Please reload the page.';
    throw e;
  }
  n = zadanie.n;
  beh = behy(zadanie.cells, n);
  ulozene = nacitaj(KLUC);
  v = (ulozene && Array.isArray(ulozene.v) && ulozene.v.length === n * n) ? ulozene.v.slice() : new Array(n * n).fill(0);
  pn = poleZoStavu(ulozene, 'p', n * n);
  pc = poleZoStavu(ulozene, 'c', n * n);
  fa = poleZoStavu(ulozene, 'f', n * n);
  done = ulozene && ulozene.done ? ulozene.done : null;
  hints = ulozene && ulozene.hints ? ulozene.hints : 0;
  checks = ulozene && ulozene.checks ? ulozene.checks : 0;
  sekundy = ulozene && ulozene.sec ? ulozene.sec : 0;
  // The Undo history belongs to the board that was saved: with no saved board
  // there is nothing for it to undo, so it goes.
  if (ulozene && !done) nacitajHistoriu(); else zmazHistoriu();
  start = null;
  if (ulozene && ulozene.start && !done) {
    // The page was closed while the clock ran: count up to the last save, then
    // wait paused.
    const koniec = ulozene.t || ulozene.start;
    sekundy += Math.max(0, Math.floor((koniec - ulozene.start) / 1000));
  }
  postavMriezku();
  ukazVsetko();
  nastavRezim('normal');
  pouziNastavenia();
  if (datumEl) datumEl.textContent = rezim === 'cvicenie' ? UROVNE[zadanie.uroven].label + ' practice ' + sada.split('-')[1] + ', wood ' + kSada : pekneDatum(datum);
  if (urovenEl) urovenEl.textContent = UROVNE[zadanie.uroven].label + ' · ' + n + '×' + n;
  if (done) doska.classList.add('hotovo');
  else if (v.some((x) => x) || pc.some((x) => x) || pn.some((x) => x) || fa.some((x) => x)) pozastav(true);
  ukazCas();
  ukazSeriu();
  ukazHistoriu();
  ukazPasik();
  ukazStav();
  ukazTlacidla();
}
spusti().then(synchronizujUcet);
