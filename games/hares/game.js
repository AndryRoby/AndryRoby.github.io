import '../kniha.mjs?v=1';
/* Hares: the game page. One script for the daily meadow, the archive days and
 * the practice sets; the page says which one it is:
 *
 *   <body data-den="YYYY-MM-DD">          an archive day (built page)
 *   <body data-sada="easy-1" data-k="3">  a practice meadow
 *   nothing                               today's meadow (or ?d=YYYY-MM-DD)
 *
 * The puzzle itself comes, in this order: from <script type="application/json"
 * id="zadanie"> embedded in a built page; from dni/YYYY-MM.json for the day;
 * or, when both are missing, generated right here from the date. All three
 * give the same meadow for the same date (plan.mjs, generator.mjs).
 *
 * The board is always drawn here from the puzzle, so a built page only has to
 * carry the packed puzzle for the browser and a line of text for readers
 * without JavaScript.
 *
 * Controls follow ops/spec-hry-spolocne.md, part "Vzor A ... ovládanie ako
 * Cracking the Cryptic" (11. 9. 2026): a selection of burrows instead of one
 * picked burrow, and four entry modes, Normal, Corner, Centre and Colour.
 *
 * The player's board is four flat n*n arrays:
 *   v   0 for an empty burrow, 1 to n for a number in it; the numbers the
 *       puzzle gives away are part of v from the start and never change
 *   zr  corner marks as a bit mask (bit d = the mark d is kept)
 *   zs  centre marks as a bit mask
 *   fa  0 for no colour, 1 to 9 for one of the nine colours
 * A burrow that holds a number hides its marks; it does not lose them
 * ("Number entry with noted cells: Fill cell"), so Delete brings them back.
 *
 * Stored in localStorage (all in try/catch, private windows throw):
 *   hares:YYYY-MM-DD     { v, p, c, f, z, sec, start, done, hints, checks, t }
 *   hares:p:<set>:<k>    the same for a practice meadow
 *   hares:streak         { posledny: YYYY-MM-DD, pocet }
 *   hares:nastavenia     the settings panel
 * p = centre marks, c = corner marks, f = colours. `p` keeps its old name on
 * purpose: a game saved before 11. 9. 2026 had one grid of notes, and those
 * are read back as centre marks, so nobody loses a board they left open.
 * sec = seconds spent before the current run, start = ms when the current run
 * began (null while paused or before the first move), done = ms of the solve,
 * hints and checks = help used, t = ms of the last save. The history line is
 * counted from the day records themselves, there is no separate one.
 * Outgoing events via window.umami, if it runs: game_solved, game_check,
 * game_hint, game_share, game_setting. Nothing else leaves the browser, unless
 * the player is signed in (arling.sk account, /style/ucet.js): then every
 * hares:YYYY-MM-DD save is also pushed to the account (throttled, 2s) and
 * pulled back on load, so the streak and history follow across devices. Signed
 * out, nothing changes; a signed-in sync that fails over the network fails
 * silently, this browser's copy stays the truth.
 */
import { zadaniePreDen, zadanieCvicenie, rozbal, tyzden, urovenDna, posunDen, pekneDatum, kratkyDatum, UROVNE, SADY, PRVY_DEN, DNI } from './plan.mjs';
import { todayBratislava, isValidDate, jadro } from './generator.mjs';
import { jeVyriesene, porovnaj, napoveda } from './logika.mjs';
import * as ucet from '/style/ucet.js';
import { oslava } from '../oslava.js';

const $ = (id) => document.getElementById(id);
const hraEl = $('hra');
const doska = $('doska');
const padEl = $('pad');
const farbyEl = $('farby');
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
 * The list and the defaults come from the settings of the app Andrej plays
 * (ops/spec-hry-spolocne.md, "Nastavenia"): Selection first, timer on,
 * matching numbers off, dragging selects several burrows, a number fills a
 * noted burrow, errors never shown while playing, corner is the default note,
 * restricted notes are not removed for you, the clock pauses by itself, the
 * keyboard writes as well as the pad, and Restart asks first.
 * Old keys (dosah, autoPoznamky, zvyrazniRovnake as ON) simply parse and are
 * ignored, so a saved settings object from before never breaks the panel. */
const NASTAVENIA_KLUC = 'hares:nastavenia';
const NASTAVENIA_PREDVOLENE = {
  cifraPrva: false,          // Control method: off = Selection, on = Digit first
  casovac: true,             // Display timer
  zvyrazniRovnake: false,    // Highlight matching numbers
  tahViac: true,             // Cell selection when dragging: multiple cells
  znackyPridavat: false,     // Number entry with noted cells: off = Fill cell
  zivaKontrola: false,       // Highlight errors
  predvolenaCentre: false,   // Default note style: off = Corner
  autoOdstranZnacky: false,  // Auto remove restricted notes
  pauzaPriOdchode: true,     // Auto pause
  lenPad: false,             // Onscreen input only
  potvrditReset: true,       // Confirm before Restart
  oslava: true,              // Celebration: confetti and a bigger result when you finish
};
let nastavenia = Object.assign({}, NASTAVENIA_PREDVOLENE, nacitaj(NASTAVENIA_KLUC) || {});
function ulozNastavenia() { uloz(NASTAVENIA_KLUC, nastavenia); }

/* ── Which meadow ─────────────────────────────────────────────────────── */
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
const KLUC = rezim === 'cvicenie' ? 'hares:p:' + sada + ':' + kSada : 'hares:' + datum;
// The root address always opens today's meadow; once the date is settled,
// rewrite it to today's built page so the address bar and a shared link point
// at the day itself (Andrej, 10. 9.). Only the plain root qualifies: a built
// archive day already names its date, a practice page its set, and a page
// opened with ?d= keeps that query untouched.
if (rezim === 'den' && !body.dataset.den && jeDnes && !location.search) {
  try { history.replaceState(null, '', '/games/hares/' + datum + '/'); } catch (e) { /* the address stays generic; the game still works */ }
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

/* ── Loading the meadow ───────────────────────────────────────────────── */
function vlozene() {
  const el = $('zadanie');
  if (!el) return null;
  try { return rozbal(JSON.parse(el.textContent)); } catch (e) { return null; }
}
async function zTabulky(iso) {
  try {
    const r = await fetch('/games/hares/dni/' + iso.slice(0, 7) + '.json', { cache: 'no-cache' });
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
let zadanie, n, rules, J, v, zr, zs, fa, start, done, sekundy, hints, checks, ulozene;
let undoStack = [];
let redoStack = [];
const vyber = new Set();     // the burrows the pad and the keyboard write into
let kurzor = -1;             // where the arrows move from; also the roving tabindex
const REZIMY = ['normal', 'corner', 'centre', 'colour'];
let rezimZadania = 'normal';
let docasnyRezim = null;     // Shift holds Corner, Ctrl holds Centre, only while held
let zvolenaCifra = null;     // Digit first: the number waiting for burrows
const FARIEB = 9;
let tikac = null;
let necinnost = null;
let pauza = false;
let tip = null;             // the hint on screen, cleared by the next move
let tipUkazany = false;
let odhalene = false;       // Check's second step is showing the wrong numbers
let checkStav = null;       // what the last Check saw, so the second press can reveal it
const bunky = [];           // the burrow elements, by cell index

function aktivnyRezim() { return docasnyRezim || rezimZadania; }

/* ── Drawing ──────────────────────────────────────────────────────────── */
function suradnice(i) { return 'row ' + (((i / n) | 0) + 1) + ', column ' + ((i % n) + 1); }
function jeDane(i) { return !!zadanie.givens[i]; }

function postavMriezku() {
  document.documentElement.style.setProperty('--n', n);
  doska.setAttribute('aria-label', 'Meadow grid ' + n + ' by ' + n);
  doska.textContent = '';
  bunky.length = 0;
  const frag = document.createDocumentFragment();
  for (let r = 0; r < n; r++) {
    const riadok = document.createElement('div');
    riadok.className = 'riadok';
    riadok.setAttribute('role', 'row');
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const b = document.createElement('button');
      b.type = 'button';
      // The two lines a burrow draws: none at the outer edge, a thick one at a
      // block edge, a thin one everywhere else.
      const l = c === 0 ? ' l0' : c % J.bw === 0 ? ' l2' : '';
      const t = r === 0 ? ' t0' : r % J.bh === 0 ? ' t2' : '';
      b.className = 'b' + l + t + (zadanie.givens[i] ? ' dane' : '');
      b.dataset.i = i;
      b.dataset.v = '0';
      b.setAttribute('role', 'gridcell');
      b.tabIndex = -1;
      // The colour sits under everything the player reads: the big number, the
      // corner marks and the centre marks all keep their own layer above it.
      const farba = document.createElement('span');
      farba.className = 'farba';
      b.appendChild(farba);
      const cif = document.createElement('span');
      cif.className = 'cif';
      b.appendChild(cif);
      // Nine fixed corner slots, filled in the sudokupad order: left top, right
      // top, left bottom, right bottom, top, bottom, left, right, middle.
      const rohy = document.createElement('span');
      rohy.className = 'rohy';
      for (let k = 1; k <= FARIEB; k++) { const s = document.createElement('i'); s.className = 's' + k; rohy.appendChild(s); }
      b.appendChild(rohy);
      const stred = document.createElement('span');
      stred.className = 'stred';
      b.appendChild(stred);
      riadok.appendChild(b);
      bunky.push(b);
    }
    frag.appendChild(riadok);
  }
  doska.appendChild(frag);
  bunky[0].tabIndex = 0;
  merajBunku();
  popisZadania();
}
/* The pad carries as many keys as the meadow has numbers, six on Monday and
 * nine from Wednesday, plus the one that empties a burrow. In Colour mode the
 * pad steps aside for the nine colours: the numbers of the meadow stop at six
 * on an easy day, the colours never do. */
function postavPad() {
  if (padEl) {
    padEl.style.setProperty('--pad', n + 1);
    padEl.textContent = '';
    for (let d = 1; d <= n; d++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.d = d;
      b.textContent = d;
      padEl.appendChild(b);
    }
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'zmaz';
    del.dataset.d = 0;
    del.textContent = 'Del';
    del.setAttribute('aria-label', 'Empty the burrow');
    padEl.appendChild(del);
  }
  if (farbyEl) {
    farbyEl.style.setProperty('--pad', FARIEB + 1);
    farbyEl.textContent = '';
    for (let d = 1; d <= FARIEB; d++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.d = d;
      b.className = 'farba-btn f' + d;
      b.setAttribute('aria-label', 'Colour ' + d);
      farbyEl.appendChild(b);
    }
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'zmaz';
    del.dataset.d = 0;
    del.textContent = 'Del';
    del.setAttribute('aria-label', 'Take the colour off');
    farbyEl.appendChild(del);
  }
}
/* Every number on the board is drawn from --cell, the measured width of one
 * burrow, so a nine by nine on a phone reads the same way as a six by six on
 * a desktop. */
function merajBunku() {
  const w = doska.clientWidth;
  if (w > 0 && n) doska.style.setProperty('--cell', (w / n) + 'px');
}
if (window.ResizeObserver) new ResizeObserver(merajBunku).observe(doska);
else window.addEventListener('resize', merajBunku);

/* The numbers the meadow starts with, as plain text for a screen reader: the
 * grid itself only tells the shape, not what it already holds. */
function popisZadania() {
  if (!cislaText) return;
  const casti = [];
  let dane = 0;
  for (let r = 0; r < n; r++) {
    const kus = [];
    for (let c = 0; c < n; c++) { const d = zadanie.givens[r * n + c]; if (d) { kus.push(d + ' in column ' + (c + 1)); dane++; } }
    if (kus.length) casti.push('Row ' + (r + 1) + ': ' + kus.join(', '));
  }
  const extra = rules.king ? ' Today both the knight leap rule and the touching rule are on.' : ' Today the knight leap rule is on.';
  cislaText.textContent = 'The meadow, ' + n + ' by ' + n + ', with ' + dane + ' numbers given.' + extra + ' ' + casti.join('. ') + '.';
}
function cifryMasky(m) {
  const out = [];
  for (let d = 1; d <= n; d++) if (m & (1 << d)) out.push(d);
  return out;
}
function ukazBunku(i) {
  const b = bunky[i];
  if (!b) return;
  const val = v[i] || 0;
  b.dataset.v = String(val);
  b.querySelector('.cif').textContent = val ? String(val) : '';
  // A number hides the marks of its burrow, it does not throw them away: take
  // the number out again and they are all still there ("Fill cell").
  const rohy = cifryMasky(zr[i]);
  const stred = cifryMasky(zs[i]);
  const rohyEl = b.querySelector('.rohy').children;
  for (let k = 0; k < FARIEB; k++) {
    const d = val ? 0 : rohy[k];
    rohyEl[k].textContent = d ? String(d) : '';
  }
  const stredEl = b.querySelector('.stred');
  stredEl.textContent = val ? '' : stred.join('');
  stredEl.dataset.k = val ? 0 : stred.length;
  const f = fa[i] || 0;
  const fEl = b.querySelector('.farba');
  fEl.className = 'farba' + (f ? ' f' + f : '');
  // The mark layers need to know a colour is under them: grey on a colour falls
  // under the contrast the standard asks for, so index.html lifts the marks of
  // a coloured burrow (.b[data-f]) to a near white.
  if (f) b.dataset.f = String(f); else delete b.dataset.f;
  const casti = [];
  if (val) casti.push(jeDane(i) ? val + ', given' : String(val));
  else casti.push('empty');
  if (!val && rohy.length) casti.push('corner ' + rohy.join(' '));
  if (!val && stred.length) casti.push('centre ' + stred.join(' '));
  if (f) casti.push('colour ' + f);
  b.setAttribute('aria-label', suradnice(i) + ', ' + casti.join(', '));
}
/* A soft visual cue only, not a judgement: a row, a column or a block that is
 * full and uses no number twice goes quiet. It says nothing about whether the
 * numbers are RIGHT (Andrej, 10. 9.: nothing turns red while playing; only
 * Check judges). */
function oznacSplnene() {
  const tichych = new Uint8Array(n * n);
  for (const u of J.units) {
    let m = 0, ok = true;
    for (const i of u.cells) {
      const d = v[i];
      if (!(d >= 1 && d <= n) || (m & (1 << d))) { ok = false; break; }
      m |= 1 << d;
    }
    if (ok) for (const i of u.cells) tichych[i]++;
  }
  // A finished row, column or block quietens all of its own burrows, which is
  // what the player sees: the line they just closed steps back.
  for (let i = 0; i < n * n; i++) bunky[i].classList.toggle('stlmena', tichych[i] > 0);
}
/* The selected burrows. With exactly one of them the meadow also shades its
 * row, its column and its block, and, when the setting is on, every burrow
 * holding the same number; with several selected it shades nothing, because a
 * shading of six overlapping units says nothing at all. */
function oznacVyber() {
  for (const b of bunky) b.classList.remove('vybrana', 'jednotka', 'rovnaka');
  if (!vyber.size) return;
  for (const i of vyber) if (bunky[i]) bunky[i].classList.add('vybrana');
  if (vyber.size !== 1) return;
  const i = [...vyber][0];
  if (!bunky[i]) return;
  for (const ui of J.unitOf[i]) for (const j of J.units[ui].cells) bunky[j].classList.add('jednotka');
  if (nastavenia.zvyrazniRovnake && v[i]) {
    for (let j = 0; j < n * n; j++) if (v[j] === v[i]) bunky[j].classList.add('rovnaka');
  }
}
/* A number that already sits in every burrow it can have is spent; the key
 * goes quiet but keeps working, in case one of them has to come back out. */
function ukazPad() {
  if (!padEl) return;
  const pocty = new Array(n + 1).fill(0);
  for (let i = 0; i < n * n; i++) if (v[i]) pocty[v[i]]++;
  padEl.querySelectorAll('button[data-d]').forEach((b) => {
    const d = +b.dataset.d;
    b.classList.toggle('hotova', !!d && pocty[d] >= n);
    b.classList.toggle('zvolena', nastavenia.cifraPrva && zvolenaCifra === d);
  });
  if (farbyEl) farbyEl.querySelectorAll('button[data-d]').forEach((b) => {
    b.classList.toggle('zvolena', nastavenia.cifraPrva && zvolenaCifra === +b.dataset.d);
  });
}
function ukazVsetko() {
  for (let i = 0; i < n * n; i++) ukazBunku(i);
  oznacSplnene();
  oznacVyber();
  ukazPad();
}
function zmazTip() {
  if (!tip) return;
  tip = null; tipUkazany = false;
  for (const b of bunky) b.classList.remove('tip', 'tip-jednotka');
  if (hintBtn) hintBtn.textContent = 'Hint';
}
function zmazOdhalenie() {
  if (!odhalene && !checkStav) return;
  odhalene = false; checkStav = null;
  for (const b of bunky) b.classList.remove('chyba');
  if (checkBtn) checkBtn.textContent = 'Check';
}
/* Highlight errors is off by default; when it is on, a wrong number is marked
 * as soon as it is written, with a frame and a mark, not by colour alone. */
function zivaKontrola() {
  if (!nastavenia.zivaKontrola || done || !zadanie) return;
  const p = porovnaj(v, zadanie.solution);
  for (const i of p.zle) bunky[i].classList.add('chyba');
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
  const s = nacitaj('hares:streak');
  if (!s || !s.pocet) { seriaEl.textContent = ''; return; }
  const ziva = s.posledny === dnes || s.posledny === posunDen(dnes, -1);
  const odpustime = !ziva && odpustitVieme(s, dnes);
  if (!ziva && !odpustime) { seriaEl.textContent = ''; return; }
  seriaEl.textContent = 'Streak: ' + s.pocet + (s.pocet === 1 ? ' day' : ' days')
    + (odpustime ? ', one missed day forgiven if you solve today' : '');
}
function zapisSeriu() {
  // Only a meadow solved on its own day counts: the archive is for practice.
  if (!jeDnes) return;
  const s = nacitaj('hares:streak') || { posledny: null, pocet: 0 };
  if (s.posledny === datum) return;
  uloz('hares:streak', krokSerie(s, datum));
}
/* Every solved day in this browser, newest first. */
function historiaDni() {
  const out = [];
  for (const k of vsetkyKluce('hares:')) {
    const d = k.slice('hares:'.length);
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
  historiaEl.innerHTML = '<b>Your meadows:</b> ' + h.length + ' solved' + (urovne ? ' (' + urovne + ')' : '') + (ciste ? ', ' + ciste + ' clean, with no hint and no check' : ', none clean yet')
    + (best ? ', best ' + formatCas(best.sec) + ' on ' + kratkyDatum(best.d) : '') + (priemer ? ', average ' + formatCas(priemer) : '') + '. <a href="/games/hares/archive/">Archive and full history</a>.';
}

/* ── Saving and solving ───────────────────────────────────────────────── */
/* `z` is how many numbers the player wrote themselves. The saved board holds
 * the given numbers as well, so without it the week strip could not tell an
 * untouched meadow from one somebody had started. */
function ulozStav() { uloz(KLUC, { v, p: zs, c: zr, f: fa, z: napisaneHracom(), sec: sekundy, start, done, hints, checks, t: Date.now() }); naplanujOdoslanie(); }

function napisaneHracom() {
  let k = 0;
  for (let i = 0; i < n * n; i++) if (v[i] && !jeDane(i)) k++;
  return k;
}
function niecoNaPloche() {
  if (napisaneHracom()) return true;
  for (let i = 0; i < n * n; i++) if (zr[i] || zs[i] || fa[i]) return true;
  return false;
}
function ukazStav() {
  oznacSplnene();
  stavEl.classList.toggle('ok', !!done);
  if (zdielanieEl) zdielanieEl.hidden = !done;   // Share only after the meadow is finished
  if (done) {
    const s = sekundy ? ' in ' + formatCas(sekundy) : '';
    const pomoc = [];
    if (hints) pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
    if (checks) pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
    const hn = pomoc.length ? ' with ' + pomoc.join(' and ') : ' without a hint or a check';
    const seria = jeDnes ? (nacitaj('hares:streak') || {}).pocet || 0 : 0;
    stavEl.innerHTML = '<b>Solved</b>' + s + hn + '. ' + (pomoc.length ? 'The hares have their meadow.' : 'A clean meadow: the hares are impressed.')
      + (jeDnes ? ' A new meadow arrives at midnight, Bratislava time.' : '')
      + (seria >= 1 ? '<span class="oslava-streak">Day ' + seria + ' of your streak.</span>' : '')
      + '<span class="oslava-dalej"><a href="/games/hares/practice/">Practice sets</a></span>';
    return;
  }
  if (!napisaneHracom()) { stavEl.textContent = 'Pick a burrow, then a number from the pad.'; return; }
  let prazdne = 0;
  for (let i = 0; i < n * n; i++) if (!v[i]) prazdne++;
  if (!prazdne) { stavEl.textContent = 'Every burrow holds a number, but the meadow is not right yet. Check shows where.'; return; }
  stavEl.textContent = '';
}

/* ── Share ────────────────────────────────────────────────────────────── *
 * A voluntary step after the meadow is finished (ops/spec-hry-ux.md, part 8).
 * The text carries which meadow it was, the time, the hints and checks used
 * and the shape of what was given, with not one number in it, so it cannot
 * spoil the puzzle for whoever reads it. Nothing is sent anywhere; the text
 * only goes to the clipboard, and when the browser refuses that, into a box
 * the player can copy by hand. */
const ZNAK_DANE = '\u{1F7EB}';    // hneda kocka: burrow the meadow gave away
const ZNAK_PRAZDNE = '\u{2B1C}';  // biela kocka: burrow the player filled in
function odkazNaLuku() {
  const b = 'https://arling.sk/games/hares/';
  if (rezim === 'cvicenie') return b + 'practice/' + sada + '/' + (kSada === 1 ? '' : kSada + '/');
  return jeDnes ? b : b + datum + '/';
}
function textNaZdielanie() {
  const riadky = [];
  for (let r = 0; r < n; r++) {
    let s = '';
    for (let c = 0; c < n; c++) s += zadanie.givens[r * n + c] ? ZNAK_DANE : ZNAK_PRAZDNE;
    riadky.push(s);
  }
  const kto = rezim === 'cvicenie' ? 'Hares practice ' + sada + ', meadow ' + kSada : 'Hares ' + datum;
  const pomoc = [];
  if (hints) pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
  if (checks) pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
  return kto + ' · ' + UROVNE[zadanie.uroven].label + (rules.king ? ', knight and touch' : ', knight') + '\n'
    + riadky.join('\n') + '\n'
    + 'Solved' + (sekundy ? ' in ' + formatCas(sekundy) : '') + (pomoc.length ? ' with ' + pomoc.join(' and ') : ', clean: no hint, no check') + '\n'
    + odkazNaLuku();
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
  track('game_share', { game: 'hares', copied: ok, level: zadanie.uroven });
});

/* ── Check, in two steps ──────────────────────────────────────────────── *
 * The first press says how many numbers are wrong and in which rows; only the
 * second press marks them. The puzzle stays a puzzle unless you ask twice.
 * When exactly one burrow is selected, only its row, its column and its block
 * are checked, which is how a crossword checks one word; otherwise the whole
 * meadow (ops/spec-hry-ux.md, part 4). The narrowing holds even when the
 * player has written nothing in that row, column or block yet: Check then says
 * so and names the scope, instead of quietly judging the whole meadow the
 * player did not ask about. */
function rozsahCheck() {
  if (vyber.size !== 1) return { cells: null, kde: '' };
  const i = [...vyber][0];
  const set = new Set();
  for (const ui of J.unitOf[i]) for (const j of J.units[ui].cells) set.add(j);
  return { cells: [...set], kde: ' in the row, the column and the block of the burrow you picked' };
}
function skontrolujStav() {
  if (done || pauza) return;
  const r = rozsahCheck();
  const p = porovnaj(v, zadanie.solution);
  const zle = r.cells ? p.zle.filter((i) => r.cells.includes(i)) : p.zle;
  const napisane = r.cells ? r.cells.filter((i) => v[i] && !jeDane(i)).length : napisaneHracom();
  if (!napisane) {
    stavEl.textContent = r.cells
      ? 'Nothing written down yet' + r.kde + '. Press Escape to let the burrow go, then Check reads the whole meadow.'
      : 'Nothing written down yet.';
    return;
  }
  checks++;
  ulozStav();
  if (!zle.length) {
    zmazOdhalenie();
    stavEl.textContent = 'Everything right so far' + r.kde + ': ' + napisane + (napisane === 1 ? ' number' : ' numbers') + ' and not one of them wrong.';
    track('game_check', { game: 'hares', wrong: 0 });
    return;
  }
  if (checkStav && !odhalene) {
    odhalene = true;
    for (const i of zle) bunky[i].classList.add('chyba');
    stavEl.textContent = 'The marked ' + (zle.length === 1 ? 'burrow does' : 'burrows do') + ' not hold ' + (zle.length === 1 ? 'that number' : 'those numbers') + ' in the finished meadow. Take them out and keep going.';
    checkBtn.textContent = 'Check';
    track('game_check', { game: 'hares', wrong: zle.length, revealed: true });
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
  track('game_check', { game: 'hares', wrong: zle.length, revealed: false });
}

/* ── Hint, in two steps ───────────────────────────────────────────────── *
 * The first press names the rule and the place and outlines the row, the
 * column and the block it reads, without saying what goes there; the second
 * press writes that one number and explains it in full (the sentence comes
 * from the solver itself, logika.mjs). A hint writes into a single burrow and
 * clears the marks of that burrow, exactly as a big number typed by hand
 * would. Every hint is counted and shown at the end. */
const VETY = {
  'wrong-number': (kde) => 'There is a number at ' + kde + ' that the finished meadow does not have there. Take it out before going on.',
  'naked-single': (kde) => 'Its row, its column, its block and the hares within reach leave the burrow at ' + kde + ' only one number.',
  'naked-single-leap': (kde) => 'The burrow at ' + kde + ' has one number left, and it is a knight’s leap that takes the last of the others away.',
  'naked-single-marks': (kde) => 'Once every number already on the board is taken out, the burrow at ' + kde + ' has a single one left.',
  'hidden-single': (kde) => 'A number that one row, column or block still owes fits only the burrow at ' + kde + '.',
  'hidden-single-leap': (kde) => 'A number one row, column or block still owes fits only ' + kde + ' once the knight’s leaps are counted in.',
  'hidden-single-marks': (kde) => 'A number missing from one row, column or block has just one burrow left for it, at ' + kde + '.',
  'pair': (kde) => 'Two burrows nearby hold two numbers between them, which takes those numbers away from ' + kde + '.',
  'pointing': (kde) => 'Inside one block a number is confined to a single line, and that settles the burrow at ' + kde + '.',
  'trial': (kde) => 'Write in each number the burrow at ' + kde + ' still allows and follow it one step: all but one run into a contradiction.',
  'reveal': (kde) => 'No named rule reaches from here, so this hint simply opens ' + kde + '.',
};
function ukazNapovedu() {
  if (done || pauza) return;
  if (tip && tipUkazany) {
    // second press: write it
    const t = tip;
    hints++;   // counted before the move, so the save inside it carries the new number
    const zmenilo = zmenaStavu(() => {
      for (const x of t.bunky) {
        v[x.i] = x.val;
        zr[x.i] = 0; zs[x.i] = 0;     // a hint fills the burrow, marks and all
        if (x.val) odstranObmedzene(x.i, x.val);
      }
    });
    const text = t.text;
    zmazTip(); zmazOdhalenie();
    track('game_hint', { game: 'hares', rule: t.pravidlo, layer: t.vrstva, applied: true });
    if (!zmenilo) { ulozStav(); ukazStav(); }
    if (!done) stavEl.textContent = text;
    return;
  }
  const h = napoveda(v, zadanie.givens, zadanie.solution, n, rules);
  if (!h) return;
  tip = h; tipUkazany = true;
  const i = h.bunky[0].i;
  for (const ui of J.unitOf[i]) for (const j of J.units[ui].cells) bunky[j].classList.add('tip-jednotka');
  for (const x of h.bunky) bunky[x.i].classList.add('tip');
  vyberJednu(i, true);
  const veta = VETY[h.pravidlo] || VETY.reveal;
  stavEl.textContent = veta(suradnice(i)) + ' Press Hint again to write it in.';
  hintBtn.textContent = 'Write it';
  track('game_hint', { game: 'hares', rule: h.pravidlo, layer: h.vrstva, applied: false });
}

function skontroluj() {
  if (!jeVyriesene(v, n, rules)) return false;
  sekundy = ubehnute();
  done = Date.now();
  start = null;
  zastavTikac();
  nastavNecinnost();
  doska.classList.add('hotovo');
  zmazTip(); zmazOdhalenie();
  vyber.clear();             // the finished meadow is green all over, not one picked burrow
  oznacVyber();
  ukazCas();
  zapisSeriu();
  ukazSeriu();
  ulozStav();
  ukazHistoriu();
  ukazPasik();
  track('game_solved', { game: 'hares', day: rezim === 'den' ? datum : sada + '/' + kSada, seconds: sekundy, hints, checks, level: zadanie.uroven });
  const kontajner = document.querySelector('.hra');
  if (kontajner) oslava(kontajner, { redukovany: !nastavenia.oslava || window.matchMedia('(prefers-reduced-motion: reduce)').matches });
  return true;
}

/* ── Moves ────────────────────────────────────────────────────────────── *
 * Every change to the board goes through zmenaStavu: it keeps the whole board
 * before and after, so Undo and Redo are one shared stack with no limit and
 * Restart is undone by a single Undo (ops/spec-hry-ux.md, part 3). */
function ukazTlacidla() {
  if (spatBtn) spatBtn.disabled = !undoStack.length || !!done;
  if (znovaBtn) znovaBtn.disabled = !redoStack.length || !!done;
  ukazRezim();
}
function rovnake(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function snimka() { return { v: v.slice(), p: zs.slice(), c: zr.slice(), f: fa.slice() }; }
function zmenaStavu(fn) {
  if (done || pauza) return false;
  const pred = snimka();
  fn();
  if (rovnake(v, pred.v) && rovnake(zs, pred.p) && rovnake(zr, pred.c) && rovnake(fa, pred.f)) return false;
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
/* Auto remove restricted notes, off by default (Andrej plays without it): a
 * number written in takes the same corner and centre mark out of every burrow
 * it now rules out, the row, the column, the block, the knight leaps and, on
 * the king days, the burrows touching it. */
function odstranObmedzene(i, d) {
  if (!nastavenia.autoOdstranZnacky) return;
  const p = J.peers[i];
  for (let k = 0; k < p.length; k++) { zr[p[k]] &= ~(1 << d); zs[p[k]] &= ~(1 << d); }
}

/* ── What the selection is ────────────────────────────────────────────── */
function upravnaBunka(i) { return i >= 0 && i < n * n && !jeDane(i); }
function vyberJednu(i, fokus) {
  if (i < 0 || i >= n * n) return;
  vyber.clear();
  vyber.add(i);
  postavKurzor(i, fokus);
  oznacVyber();
}
function pridajDoVyberu(i, fokus) {
  if (i < 0 || i >= n * n) return;
  vyber.add(i);
  postavKurzor(i, fokus);
  oznacVyber();
}
function prepniVoVybere(i, fokus) {
  if (i < 0 || i >= n * n) return;
  if (vyber.has(i)) vyber.delete(i); else vyber.add(i);
  postavKurzor(i, fokus);
  oznacVyber();
}
function zrusVyber() {
  vyber.clear();
  oznacVyber();
}
/* Priznak drzi focusin od toho, aby sa fokus, ktory posuva sama hra, tvaril
 * ako Tab dovnutra mriezky a sam nieco vybral. Plati pre kazdy fokus, ktory
 * si hra dava sama: pri kurzore aj pri navrate z tlacidla. Bez neho by
 * Ctrl+klik nikdy nevyprazdnil vyber na nulu: odobranie poslednej bunky
 * presunie fokus na nu a focusin by ju hned vratil spat do vyberu. */
let vraciamFokus = false;
/* Roving tabindex: exactly one burrow is in the tab order (APG grid pattern),
 * and it is the one the arrows move from. */
function postavKurzor(i, fokus) {
  if (i < 0 || i >= n * n) return;
  for (const b of bunky) b.tabIndex = -1;
  kurzor = i;
  bunky[i].tabIndex = 0;
  if (fokus) {
    vraciamFokus = true;
    try { bunky[i].focus({ preventScroll: true }); } finally { vraciamFokus = false; }
  }
}
/* Klik na tlacidlo si vezme fokus; toto ho vrati na dosku, aby klavesnica
 * hned fungovala dalej. */
function fokusNaDosku() {
  if (kurzor < 0 || !bunky[kurzor] || done) return;
  vraciamFokus = true;
  try { bunky[kurzor].focus({ preventScroll: true }); } finally { vraciamFokus = false; }
}

/* ── Writing into the selection ───────────────────────────────────────── *
 * A number with several burrows selected: in Normal it is written into all of
 * them and the given ones are skipped; in Corner and Centre it toggles the
 * mark in all of them (if every one has it, it goes; otherwise it is added);
 * in Colour it colours all of them. */
function ciele() {
  return [...vyber].filter((i) => i >= 0 && i < n * n);
}
function zapisNormal(d) {
  const c = ciele().filter(upravnaBunka);
  if (!c.length) return false;
  // A burrow that already holds notes takes the number anyway and hides them
  // ("Fill cell"); with "Add note" the number becomes a note there instead.
  if (nastavenia.znackyPridavat && c.every((i) => !v[i] && (zr[i] || zs[i]))) {
    return prepniZnacku(nastavenia.predvolenaCentre ? 'centre' : 'corner', d);
  }
  const vsetkyMaju = c.every((i) => v[i] === d);
  return zmenaStavu(() => {
    for (const i of c) {
      v[i] = vsetkyMaju ? 0 : d;
      if (!vsetkyMaju) odstranObmedzene(i, d);
    }
  });
}
function prepniZnacku(kde, d) {
  const pole = kde === 'corner' ? zr : zs;
  const c = ciele().filter(upravnaBunka);
  if (!c.length) return false;
  const vsetkyMaju = c.every((i) => pole[i] & (1 << d));
  return zmenaStavu(() => {
    for (const i of c) { if (vsetkyMaju) pole[i] &= ~(1 << d); else pole[i] |= 1 << d; }
  });
}
function zapisFarbu(d) {
  const c = ciele();
  if (!c.length) return false;
  const vsetkyMaju = c.every((i) => fa[i] === d);
  return zmenaStavu(() => { for (const i of c) fa[i] = vsetkyMaju ? 0 : d; });
}
/* One number, whichever mode is on right now (a held Shift or Ctrl counts). */
function zadaj(d, doBuniek) {
  if (done || pauza || !d) return false;
  const rez = aktivnyRezim();
  if (doBuniek) { vyber.clear(); for (const i of doBuniek) vyber.add(i); oznacVyber(); }
  if (!vyber.size) { stavEl.textContent = 'Pick a burrow first, then a number.'; return false; }
  if (rez === 'colour') return zapisFarbu(d > FARIEB ? FARIEB : d);
  if (d > n) return false;                      // six numbers on an easy day
  if (rez === 'corner') return prepniZnacku('corner', d);
  if (rez === 'centre') return prepniZnacku('centre', d);
  const dane = ciele().filter((i) => jeDane(i));
  const ok = zapisNormal(d);
  if (!ok && dane.length && !ciele().some(upravnaBunka)) stavEl.textContent = 'That number came with the meadow, it stays where it is.';
  return ok;
}
/* Delete, in the order the standard sets: big numbers first, then the marks of
 * the selected burrows (corner and centre together), then the colour. */
function zmazVybrane() {
  if (done || pauza || !vyber.size) return false;
  const c = ciele();
  const sCislom = c.filter((i) => v[i] && !jeDane(i));
  if (sCislom.length) return zmenaStavu(() => { for (const i of sCislom) v[i] = 0; });
  const soZnackami = c.filter((i) => zr[i] || zs[i]);
  if (soZnackami.length) return zmenaStavu(() => { for (const i of soZnackami) { zr[i] = 0; zs[i] = 0; } });
  const sFarbou = c.filter((i) => fa[i]);
  if (sFarbou.length) return zmenaStavu(() => { for (const i of sFarbou) fa[i] = 0; });
  return false;
}

function spat() {
  if (done || pauza || !undoStack.length) return;
  redoStack.push(snimka());
  const s = undoStack.pop();
  v = s.v; zs = s.p; zr = s.c; fa = s.f;
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) { ulozStav(); zivaKontrola(); }
  ukazStav();
  ukazTlacidla();
}
function znova() {
  if (done || pauza || !redoStack.length) return;
  undoStack.push(snimka());
  const s = redoStack.pop();
  v = s.v; zs = s.p; zr = s.c; fa = s.f;
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) { ulozStav(); zivaKontrola(); }
  ukazStav();
  ukazTlacidla();
}
/* Restart: the meadow goes back to the numbers it was given and everything
 * else goes, colours included; the clock keeps running (Andrej, 10. 9.:
 * clearing is a move, not a restart of the day). One Undo brings it all back. */
function prazdnaPlocha() { return zadanie.givens.slice(); }
function reset() {
  if (done || pauza) return;
  if (!niecoNaPloche()) return;
  if (nastavenia.potvrditReset && !window.confirm('Restart the whole meadow? Numbers, marks and colours go, the clock keeps running, and one Undo brings everything back.')) return;
  zmenaStavu(() => {
    v = prazdnaPlocha();
    zr = new Array(n * n).fill(0);
    zs = new Array(n * n).fill(0);
    fa = new Array(n * n).fill(0);
  });
}

/* ── Modes ────────────────────────────────────────────────────────────── *
 * Four buttons under the pad, Z X C V on the keyboard, Space cycles, and a
 * held Shift or Ctrl borrows Corner or Centre for as long as it is held. */
function ukazRezim() {
  const r = aktivnyRezim();
  if (rezimyEl) rezimyEl.querySelectorAll('button[data-rezim]').forEach((b) => {
    b.setAttribute('aria-pressed', b.dataset.rezim === r ? 'true' : 'false');
    b.classList.toggle('zap', b.dataset.rezim === r);
  });
  if (hraEl) hraEl.dataset.rezim = r;
  if (padEl) padEl.hidden = r === 'colour';
  if (farbyEl) farbyEl.hidden = r !== 'colour';
}
function nastavRezim(r) {
  if (!REZIMY.includes(r)) return;
  rezimZadania = r;
  zvolenaCifra = null;
  ukazRezim();
  ukazPad();
}
function cyklujRezim() {
  nastavRezim(REZIMY[(REZIMY.indexOf(rezimZadania) + 1) % REZIMY.length]);
}
/* N keeps its old job in a new world: marks, the other marks, back to Normal.
 * Which of the two comes first is "Default note style" (Corner by default). */
function cyklujZnacky() {
  const prvy = nastavenia.predvolenaCentre ? 'centre' : 'corner';
  const druhy = nastavenia.predvolenaCentre ? 'corner' : 'centre';
  nastavRezim(rezimZadania === prvy ? druhy : rezimZadania === druhy ? 'normal' : prvy);
}
if (rezimyEl) rezimyEl.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-rezim]');
  if (!b) return;
  nastavRezim(b.dataset.rezim);
  fokusNaDosku();
});

/* ── Pointer ──────────────────────────────────────────────────────────── *
 * A tap selects a burrow. Dragging across burrows selects all of them
 * ("Cell selection when dragging: select multiple cells"); with the setting on
 * single, the drag moves the one selected burrow instead. Ctrl or Cmd plus a
 * tap adds a burrow to the selection or takes it out again. In Digit first the
 * number chosen on the pad is written into every burrow the finger crosses. */
function bunkaPod(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const b = el && el.closest ? el.closest('.b') : null;
  return b && doska.contains(b) ? +b.dataset.i : -1;
}
let tah = null; // { id, malovanie }
doska.addEventListener('pointerdown', (e) => {
  if (done || pauza || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const i = bunkaPod(e);
  if (i < 0) return;
  e.preventDefault();
  try { doska.setPointerCapture(e.pointerId); } catch (err) { /* works without capture too, less smoothly */ }
  if (nastavenia.cifraPrva && zvolenaCifra !== null) {
    tah = { id: e.pointerId, malovanie: true };
    pouziCifruPrva(i);
    return;
  }
  tah = { id: e.pointerId, malovanie: false };
  if (e.ctrlKey || e.metaKey) prepniVoVybere(i, true);
  else vyberJednu(i, true);
});
doska.addEventListener('pointermove', (e) => {
  if (!tah || tah.id !== e.pointerId || done || pauza) return;
  const i = bunkaPod(e);
  if (i < 0) return;
  if (tah.malovanie) { if (i !== kurzor) pouziCifruPrva(i); return; }
  if (vyber.has(i) && i === kurzor) return;
  if (nastavenia.tahViac) pridajDoVyberu(i, false);
  else vyberJednu(i, false);
});
function koniecTahu(e) {
  if (!tah || tah.id !== e.pointerId) return;
  tah = null;
  try { doska.releasePointerCapture(e.pointerId); } catch (err) { /* nothing */ }
}
doska.addEventListener('pointerup', koniecTahu);
doska.addEventListener('pointercancel', (e) => { if (tah && tah.id === e.pointerId) tah = null; });
/* Digit first: the pad holds the number, the burrows take it one by one. */
function pouziCifruPrva(i) {
  postavKurzor(i, false);
  if (zvolenaCifra === 0) { vyber.clear(); vyber.add(i); oznacVyber(); zmazVybrane(); return; }
  zadaj(zvolenaCifra, [i]);
}
/* Tab into the board and the burrow that takes the focus is the selected one. */
doska.addEventListener('focusin', (e) => {
  const b = e.target && e.target.closest ? e.target.closest('.b') : null;
  if (!b) return;
  const i = +b.dataset.i;
  if (kurzor !== i) postavKurzor(i, false);
  if (!vyber.size && !vraciamFokus) { vyber.add(i); oznacVyber(); }
});

/* ── Keyboard ─────────────────────────────────────────────────────────── *
 * Arrows (and WASD) move the selection and wrap around the edge, Ctrl plus an
 * arrow widens it, Escape lets it go; 1 to 9 and the numeric keypad write in
 * whichever mode is on, Delete and Backspace clear in the order of the
 * standard, Z X C V pick a mode and Space cycles through them; U and Ctrl+Z
 * undo, R, Ctrl+Y and Ctrl+Shift+Z redo, P pauses and wakes the meadow. */
function posun(dr, dc) {
  const i = kurzor < 0 ? 0 : kurzor;
  const r = (i / n) | 0, c = i % n;
  return ((r + dr + n) % n) * n + ((c + dc + n) % n);
}
/* The physical key, not the character it produces: with Shift held down a
 * number key gives '%' on one layout and '5' on another, and a held Shift is
 * exactly how Corner is borrowed. e.code says which key it was. */
function cifraZKlavesu(e) {
  if (e.code && /^Numpad[1-9]$/.test(e.code)) return +e.code.slice(6);
  if (e.code && /^Digit[1-9]$/.test(e.code)) return +e.code.slice(5);
  if (e.key >= '1' && e.key <= '9') return +e.key;
  return 0;
}
/* The keys are read anywhere inside the game block, not only on the board
 * itself. The pad, Undo, Redo, Restart, Hint and Check are ordinary buttons:
 * pressing one moves the focus onto it, and a listener bound to the board
 * would go deaf until the player clicked a burrow again. Outside the game the
 * page keeps its own keys, so the arrows and the spacebar still scroll the
 * rules. Two things are left alone even inside: a text field, a checkbox or a
 * select keeps every key it is given, and a focused button, link or summary
 * keeps Space and Enter, which are how such a control is pressed. */
function pisePole(t) {
  const tag = (t && t.tagName ? t.tagName : '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || !!(t && t.isContentEditable);
}
function naOvladaci(t) {
  if (!t || !t.closest) return false;
  if (t.closest('.b')) return false;
  return !!t.closest('button, a, summary');
}
/* Where the game's keys apply. Inside the game block, but a link and the
 * Settings summary are left out of it: those are read, opened or followed, not
 * played with, and a modifier held over one of them (a Ctrl click on "How to
 * play", say) is the browser's gesture, not ours. Both the keyboard below and
 * the held modifiers above ask this one question, so what the mode buttons
 * show is always what the next number would do. */
function vHre(t) {
  if (!hraEl || !t || !hraEl.contains(t) || pisePole(t)) return false;
  return !(t.closest && t.closest('a, summary'));
}
/* Pause and back are the two keys that still work while the meadow sleeps, and
 * a meadow that opens paused has the focus nowhere yet, so those two also
 * count an untouched page as being in the game. Anywhere else (a link, the
 * rules) the key is not ours. */
function vHreAleboNikde(t) {
  return !t || t === document.body || t === document.documentElement || vHre(t);
}
/* One listener for every key of the game, so nothing is ever handled twice and
 * every key asks the same question about where the focus is. */
document.addEventListener('keydown', (e) => {
  if (!bunky.length) return;
  const k = e.key;
  const ctrl = e.ctrlKey || e.metaKey;
  // Pause first, before the guard below: it is the way back out of a pause.
  if (!ctrl && (k === 'p' || k === 'P') && vHreAleboNikde(e.target)) {
    if (pauza) pokracuj(); else if (!done) pozastav(false);
    e.preventDefault();
    return;
  }
  if (k === 'Escape' && pauza && vHreAleboNikde(e.target)) { pokracuj(); e.preventDefault(); return; }
  if (done || pauza) return;
  if (!vHre(e.target)) return;
  if ((k === ' ' || k === 'Spacebar' || k === 'Enter') && naOvladaci(e.target)) return;
  let ciel = -1;
  const smer = k === 'ArrowUp' || k === 'w' || k === 'W' ? [-1, 0]
    : k === 'ArrowDown' || k === 's' || k === 'S' ? [1, 0]
      : k === 'ArrowLeft' || k === 'a' || k === 'A' ? [0, -1]
        : k === 'ArrowRight' || k === 'd' || k === 'D' ? [0, 1] : null;
  if (smer && !(ctrl && k.length === 1)) {          // Ctrl+W and friends stay the browser's
    ciel = posun(smer[0], smer[1]);
    e.preventDefault();
    // Ctrl (Cmd) widens the selection, and only Ctrl: a held Shift is how
    // Corner is borrowed, and the standard gives the selection to Ctrl alone.
    if (ctrl) pridajDoVyberu(ciel, true); else vyberJednu(ciel, true);
    return;
  }
  // A number goes first, because a held Ctrl is how Centre is borrowed: it has
  // to reach the board before the guard that leaves Ctrl to the browser.
  const d = cifraZKlavesu(e);
  if (d) {
    if (nastavenia.lenPad) return;   // Onscreen input only: the pad writes, the keyboard does not
    zadaj(d);
    e.preventDefault();
    return;
  }
  // Undo and Redo: Ctrl+Z back, Ctrl+Y and Ctrl+Shift+Z forward, U and R
  // without a modifier. Ctrl+R is never taken: that is how a browser reloads a
  // page, and a game that swallows it is a game that traps you.
  if (ctrl && (k === 'z' || k === 'Z')) { if (e.shiftKey) znova(); else spat(); e.preventDefault(); return; }
  if (ctrl && (k === 'y' || k === 'Y')) { znova(); e.preventDefault(); return; }
  if (ctrl) return;                                  // the rest of Ctrl stays the browser's
  if (k === 'u' || k === 'U') { spat(); e.preventDefault(); return; }
  if (k === 'r' || k === 'R') { znova(); e.preventDefault(); return; }
  if (k === 'Home') { vyberJednu(((kurzor / n) | 0) * n, true); e.preventDefault(); return; }
  if (k === 'End') { vyberJednu(((kurzor / n) | 0) * n + (n - 1), true); e.preventDefault(); return; }
  // Escape lets the selection go, and nothing else: the focus stays on the
  // burrow the arrows move from, so the very next key still reaches the meadow.
  if (k === 'Escape') { zrusVyber(); e.preventDefault(); return; }
  if (k === 'z' || k === 'Z') { nastavRezim('normal'); e.preventDefault(); return; }
  if (k === 'x' || k === 'X') { nastavRezim('corner'); e.preventDefault(); return; }
  if (k === 'c' || k === 'C') { nastavRezim('centre'); e.preventDefault(); return; }
  if (k === 'v' || k === 'V') { nastavRezim('colour'); e.preventDefault(); return; }
  if (k === ' ') { cyklujRezim(); e.preventDefault(); return; }
  if (k === 'n' || k === 'N' || k === 'Enter') { cyklujZnacky(); e.preventDefault(); return; }
  if (k === 'Delete' || k === 'Backspace' || k === '0' || e.code === 'Digit0' || e.code === 'Numpad0' || e.code === 'NumpadDecimal') {
    if (nastavenia.lenPad) return;
    zmazVybrane(); e.preventDefault();
  }
});
/* Shift and Ctrl borrow a mode only while they are held down: let go and the
 * mode the player chose is back. The same guard as the keyboard, vHre: a
 * modifier pressed anywhere else on the page, in the Settings panel or over a
 * link, is none of the game's business, and lighting a mode button up there
 * would say the game is in a mode it is not in. Leaving the game block while a
 * modifier is held gives the mode back as well, and so does a window that
 * loses focus with a key down. */
function docasny(e) {
  const vonku = !vHre(e.target);
  const bol = docasnyRezim;
  docasnyRezim = vonku ? null
    : e.shiftKey ? 'corner' : (e.ctrlKey || e.metaKey) ? 'centre' : null;
  if (docasnyRezim !== bol) ukazRezim();
}
document.addEventListener('keydown', docasny, true);
document.addEventListener('keyup', docasny, true);
window.addEventListener('blur', () => { if (docasnyRezim) { docasnyRezim = null; ukazRezim(); } });

/* ── The pad ──────────────────────────────────────────────────────────── */
function padKlik(e) {
  const b = e.target.closest('button[data-d]');
  if (!b || done || pauza) return;
  const d = +b.dataset.d;
  if (nastavenia.cifraPrva) {
    zvolenaCifra = zvolenaCifra === d ? null : d;
    ukazPad();
    stavEl.textContent = zvolenaCifra === null ? 'No number chosen. Tap a number, then the burrows.'
      : zvolenaCifra === 0 ? 'Delete is chosen. Tap the burrows to empty them.'
        : 'Number ' + zvolenaCifra + ' is chosen. Tap the burrows.';
    return;
  }
  if (!vyber.size) { stavEl.textContent = 'Pick a burrow first, then a number.'; return; }
  if (!d) { zmazVybrane(); return; }
  zadaj(d);
}
/* Every one of these is a button, and a click leaves the focus on it. Handing
 * the focus back to the meadow is what keeps the keyboard alive: play with the
 * pad for a while, then reach for the arrow keys, and they still work. */
function sFokusom(fn) { return (e) => { fn(e); fokusNaDosku(); }; }
if (padEl) padEl.addEventListener('click', sFokusom(padKlik));
if (farbyEl) farbyEl.addEventListener('click', sFokusom(padKlik));
if (spatBtn) spatBtn.addEventListener('click', sFokusom(spat));
if (znovaBtn) znovaBtn.addEventListener('click', sFokusom(znova));
if (resetBtn) resetBtn.addEventListener('click', sFokusom(reset));
if (checkBtn) checkBtn.addEventListener('click', sFokusom(skontrolujStav));
if (hintBtn) hintBtn.addEventListener('click', sFokusom(ukazNapovedu));
if (pauzaBtn) pauzaBtn.addEventListener('click', () => pozastav(false));
if (pokracujBtn) pokracujBtn.addEventListener('click', sFokusom(pokracuj));
document.addEventListener('keydown', nastavNecinnost, true);
document.addEventListener('pointerdown', nastavNecinnost, true);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (nastavenia.pauzaPriOdchode && start && !done) pozastav(true); }
  else ukazCas();
});

/* ── The week strip ───────────────────────────────────────────────────── *
 * A finished meadow has two marks (ops/spec-hry-ux.md, part 8): solved, and
 * solved clean with no hint and no check. The clean one adds the class
 * `ciste` (a dot in the corner, so the difference is a shape and not only a
 * colour) and says so in the aria-label as well. */
function zacatePole(st) {
  if (!st) return false;
  const nieco = (x) => Array.isArray(x) && x.some((y) => y);
  return !!(st.z || nieco(st.p) || nieco(st.c) || nieco(st.f));
}
function triedaStavu(st) {
  if (st && st.done) return st.hints || st.checks ? ' hotove' : ' hotove ciste';
  return zacatePole(st) ? ' rozohrane' : '';
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
      const st = nacitaj('hares:p:' + sada + ':' + k);
      const a = document.createElement(k === kSada ? 'span' : 'a');
      a.className = 'den' + (k === kSada ? ' dnes' : '') + triedaStavu(st);
      if (k !== kSada) a.href = '/games/hares/practice/' + sada + '/' + k + '/';
      a.innerHTML = '<small>No.</small><b>' + k + '</b>';
      a.setAttribute('aria-label', 'Meadow ' + k + slovoStavu(st));
      if (k === kSada) a.setAttribute('aria-current', 'page');
      pasik.appendChild(a);
    }
    return;
  }
  const dni = tyzden(datum);
  dni.forEach((d, k) => {
    const st = nacitaj('hares:' + d);
    const buduci = d > dnes, pred = d < PRVY_DEN;
    const tag = d === datum || buduci || pred ? 'span' : 'a';
    const a = document.createElement(tag);
    a.className = 'den' + (d === datum ? ' dnes' : '') + (buduci || pred ? ' buduci' : '') + triedaStavu(st);
    if (tag === 'a') a.href = '/games/hares/' + d + '/';
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
  if (!nastavenia.zivaKontrola && !odhalene) { for (const b of bunky) b.classList.remove('chyba'); }
  zivaKontrola();
  if (!nastavenia.cifraPrva) zvolenaCifra = null;
  oznacVyber();
  ukazPad();
  ukazRezim();
  nastavNecinnost();
  ukazCas();
}
document.querySelectorAll('[data-nastavenie]').forEach((el) => {
  const kluc = el.getAttribute('data-nastavenie');
  el.checked = !!nastavenia[kluc];
  el.addEventListener('change', () => {
    nastavenia[kluc] = el.checked;
    ulozNastavenia();
    pouziNastavenia();
    track('game_setting', { game: 'hares', setting: kluc, on: el.checked });
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
  for (const k of vsetkyKluce('hares:')) {
    const d = k.slice('hares:'.length);
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
  if (!ziva) { try { localStorage.removeItem('hares:streak'); } catch (e) { /* nič */ } return; }
  uloz('hares:streak', s);
}
function odosliStav() {
  if (!ucet.prihlaseny()) return;
  ucet.hra.uloz('hares', { dni: stavVsetkychDni(), t: Date.now() }).catch(() => { /* sieťová chyba: lokálne ostáva pravdou */ });
}
let syncCakanie = null, syncPosledny = 0;
function naplanujOdoslanie() {
  if (!ucet.prihlaseny()) return;
  const zvysok = 2000 - (Date.now() - syncPosledny);
  if (zvysok <= 0) { syncPosledny = Date.now(); odosliStav(); return; }
  if (syncCakanie) return;
  syncCakanie = setTimeout(() => { syncCakanie = null; syncPosledny = Date.now(); odosliStav(); }, zvysok);
}
async function synchronizujUcet() {
  if (!ucet.prihlaseny()) return;
  let vzdialene;
  try { vzdialene = await ucet.hra.nacitaj('hares'); } catch (e) { return; /* sieťová chyba: lokálne ostáva pravdou */ }
  const diaDni = vzdialene && vzdialene.dni && typeof vzdialene.dni === 'object' ? vzdialene.dni : {};
  let zmenene = false;
  for (const [d, r] of Object.entries(diaDni)) {
    if (!isValidDate(d) || !r || typeof r !== 'object') continue;
    const kluc = 'hares:' + d;
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
        v = obnovPole(cerstve.v);
        zs = obnovMasky(cerstve.p);
        zr = obnovMasky(cerstve.c);
        fa = obnovFarby(cerstve.f);
        done = cerstve.done || null;
        hints = cerstve.hints || 0;
        checks = cerstve.checks || 0;
        sekundy = cerstve.sec || 0;
        undoStack = []; redoStack = [];
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
/* A saved board is trusted only where the puzzle leaves room: the given
 * numbers always come from the puzzle itself, so an old or damaged save can
 * never quietly change what the meadow started with. */
function obnovPole(ulozeneV) {
  const out = prazdnaPlocha();
  for (let i = 0; i < n * n; i++) {
    if (out[i]) continue;
    const d = ulozeneV[i];
    if (d >= 1 && d <= n) out[i] = d;
  }
  return out;
}
/* Marks and colours come back only where they make sense: a mask is kept for
 * the numbers this meadow has, a colour has to be one of the nine. A save from
 * before 11. 9. 2026 has one grid of notes in `p` and nothing in `c`, so it
 * simply reads back as the centre marks. */
function obnovMasky(pole) {
  const out = new Array(n * n).fill(0);
  if (!Array.isArray(pole) || pole.length !== n * n) return out;
  let plne = 0;
  for (let d = 1; d <= n; d++) plne |= 1 << d;
  for (let i = 0; i < n * n; i++) out[i] = (+pole[i] || 0) & plne;
  return out;
}
function obnovFarby(pole) {
  const out = new Array(n * n).fill(0);
  if (!Array.isArray(pole) || pole.length !== n * n) return out;
  for (let i = 0; i < n * n; i++) { const f = +pole[i] || 0; out[i] = f >= 1 && f <= FARIEB ? f : 0; }
  return out;
}
async function spusti() {
  if (jeBuduci) {
    datumEl.textContent = pekneDatum(datum);
    stavEl.textContent = 'This meadow opens on ' + pekneDatum(datum) + ' (Bratislava time). Come back then, or play today’s meadow.';
    doska.hidden = true;
    if (padEl) padEl.hidden = true;
    if (farbyEl) farbyEl.hidden = true;
    if (rezimyEl) rezimyEl.hidden = true;
    for (const b of [spatBtn, znovaBtn, resetBtn, checkBtn, hintBtn]) if (b) b.disabled = true;
    ukazPasik();
    return;
  }
  try {
    zadanie = await nacitajZadanie();
  } catch (e) {
    stavEl.textContent = 'The meadow could not be prepared. Please reload the page.';
    throw e;
  }
  n = zadanie.n;
  rules = zadanie.rules;
  J = jadro(n, rules);
  ulozene = nacitaj(KLUC);
  v = (ulozene && Array.isArray(ulozene.v) && ulozene.v.length === n * n) ? obnovPole(ulozene.v) : prazdnaPlocha();
  zs = obnovMasky(ulozene && ulozene.p);
  zr = obnovMasky(ulozene && ulozene.c);
  fa = obnovFarby(ulozene && ulozene.f);
  done = ulozene && ulozene.done ? ulozene.done : null;
  hints = ulozene && ulozene.hints ? ulozene.hints : 0;
  checks = ulozene && ulozene.checks ? ulozene.checks : 0;
  sekundy = ulozene && ulozene.sec ? ulozene.sec : 0;
  start = null;
  if (ulozene && ulozene.start && !done) {
    // The page was closed while the clock ran: count up to the last save, then
    // wait paused.
    const koniec = ulozene.t || ulozene.start;
    sekundy += Math.max(0, Math.floor((koniec - ulozene.start) / 1000));
  }
  postavMriezku();
  postavPad();
  ukazVsetko();
  pouziNastavenia();
  if (datumEl) datumEl.textContent = rezim === 'cvicenie' ? UROVNE[zadanie.uroven].label + ' practice ' + sada.split('-')[1] + ', meadow ' + kSada : pekneDatum(datum);
  if (urovenEl) urovenEl.textContent = UROVNE[zadanie.uroven].label + ' · ' + n + '×' + n + (rules.king ? ' · knight and touch' : ' · knight');
  if (done) doska.classList.add('hotovo');
  else if (niecoNaPloche()) pozastav(true);
  ukazCas();
  ukazSeriu();
  ukazHistoriu();
  ukazPasik();
  ukazStav();
  ukazTlacidla();
}
spusti().then(synchronizujUcet);
