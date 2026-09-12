import '../kniha.mjs?v=1';
/* Badgers: the game page. One script for the daily sett, the archive days and
 * the practice sets; the page says which one it is:
 *
 *   <body data-den="YYYY-MM-DD">          an archive day (built page)
 *   <body data-sada="easy-1" data-k="3">  a practice sett
 *   nothing                               today's sett (or ?d=YYYY-MM-DD)
 *
 * The puzzle itself comes, in this order: from <script type="application/json"
 * id="zadanie"> embedded in a built page; from dni/YYYY-MM.json for the day;
 * or, when both are missing, generated right here from the date. All three give
 * the same sett for the same date (plan.mjs, generator.mjs).
 *
 * The board is always drawn here from the puzzle, so a built page only has to
 * carry the packed puzzle for the browser and a line of text for readers
 * without JavaScript.
 *
 * The player's board is four flat n*n arrays (ops/spec-hry-spolocne.md, the
 * Cracking the Cryptic control standard of 11. 9. 2026):
 *   v    0 for an empty cell, 1 to n for the big number written in it
 *   cr   the corner marks as a bit mask (bit d means the mark d is there)
 *   ce   the centre marks as a bit mask
 *   col  0, or 1 to 9 for one of the nine cell colours
 * A big number hides the marks of its own cell, it does not throw them away
 * ("Number entry with noted cells: Fill cell"), so Delete brings them back.
 *
 * Stored in localStorage (all in try/catch, private windows throw):
 *   badgers:YYYY-MM-DD     { v, cr, ce, col, sec, start, done, hints, checks, t }
 *   badgers:p:<set>:<k>    the same for a practice sett
 *   badgers:streak         { posledny: YYYY-MM-DD, pocet }
 *   badgers:nastavenia     the settings panel
 * sec = seconds spent before the current run, start = ms when the current run
 * began (null while paused or before the first move), done = ms of the solve,
 * hints and checks = help used, t = ms of the last save. A save written before
 * 11. 9. 2026 carries one note grid as `p`; it is read back as centre marks.
 * The history line is counted from the day records themselves.
 * Outgoing events via window.umami, if it runs: game_solved, game_check,
 * game_hint, game_share, game_setting. Nothing else leaves the browser, unless
 * the player is signed in (arling.sk account, /style/ucet.js): then every
 * badgers:YYYY-MM-DD save is also pushed to the account (throttled, 2s) and
 * pulled back on load, so the streak and history follow across devices. Signed
 * out, nothing changes; a signed-in sync that fails over the network fails
 * silently, this browser's copy stays the truth.
 */
import { zadaniePreDen, zadanieCvicenie, rozbal, tyzden, urovenDna, posunDen, pekneDatum, kratkyDatum, UROVNE, SADY, PRVY_DEN, DNI } from './plan.mjs';
import { todayBratislava, isValidDate, jednotky, blokoveRozmery } from './generator.mjs';
import { jeVyriesene, porovnaj, napoveda } from './logika.mjs';
import * as ucet from '/style/ucet.js';
import { oslava } from '../oslava.js';

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
const ohradyText = $('ohrady-text');

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
 * The list and the defaults are the ones Andrej plays with, in the order the
 * standard writes them (ops/spec-hry-spolocne.md, "Vzor A ... ako Cracking the
 * Cryptic"). Nothing turns red while you play, no note is removed behind your
 * back, and matching numbers are not lit up.
 *   ovladanie        Control method: 'vyber' (cell first) or 'cislo' (digit first)
 *   casovac          Display timer
 *   zvyrazniRovnake  Highlight matching numbers
 *   tahVyber         Cell selection when dragging: 'viac' or 'jedno'
 *   zapisSoZnackami  Number entry with noted cells: 'fill' or 'note'
 *   zivaKontrola     Highlight errors (our Live check)
 *   stylZnaciek      Default note style: 'corner' or 'centre'
 *   autoOdstranZnacky  Auto remove restricted notes
 *   pauzaPriOdchode  Auto pause
 *   lenPad           Onscreen input only
 *   potvrditReset    Confirm before Restart
 */
const NASTAVENIA_KLUC = 'badgers:nastavenia';
const NASTAVENIA_PREDVOLENE = {
  ovladanie: 'vyber', casovac: true, zvyrazniRovnake: false, tahVyber: 'viac',
  zapisSoZnackami: 'fill', zivaKontrola: false, stylZnaciek: 'corner',
  autoOdstranZnacky: false, pauzaPriOdchode: true, lenPad: false, potvrditReset: true, oslava: true,
};
let nastavenia = Object.assign({}, NASTAVENIA_PREDVOLENE, nacitaj(NASTAVENIA_KLUC) || {});
function ulozNastavenia() { uloz(NASTAVENIA_KLUC, nastavenia); }

/* ── Which sett ───────────────────────────────────────────────────────── */
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
const KLUC = rezim === 'cvicenie' ? 'badgers:p:' + sada + ':' + kSada : 'badgers:' + datum;
// The root address always opens today's sett; once the date is settled, rewrite
// it to today's built page so the address bar and a shared link point at the
// day itself (Andrej, 10. 9.). Only the plain root qualifies: a built archive
// day already names its date, a practice page its set, and a page opened with
// ?d= keeps that query untouched.
if (rezim === 'den' && !body.dataset.den && jeDnes && !location.search) {
  try { history.replaceState(null, '', '/games/badgers/' + datum + '/'); } catch (e) { /* the address stays generic; the game still works */ }
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

/* ── Loading the sett ─────────────────────────────────────────────────── */
function vlozene() {
  const el = $('zadanie');
  if (!el) return null;
  try { return rozbal(JSON.parse(el.textContent)); } catch (e) { return null; }
}
async function zTabulky(iso) {
  try {
    const r = await fetch('/games/badgers/dni/' + iso.slice(0, 7) + '.json', { cache: 'no-cache' });
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
let zadanie, n, v, cr, ce, col, start, done, sekundy, hints, checks, ulozene;
let cages = [];             // { sum, cells }
let ohradaBunky = [];       // cage index by cell index
let jedn = [];              // rows, columns and blocks (generator.jednotky)
let bunkaJedn = [];         // the three unit indexes of every cell
let undoStack = [];
let redoStack = [];
let vyber = new Set();      // the picked cells, as a set of cell indexes
let kurzor = -1;            // the cell the arrows move from; also the roving tabindex
let rezimZapisu = 'normal'; // 'normal', 'corner', 'centre' or 'colour'
let aktivnaCifra = 0;       // Digit first: the number waiting on the pad (0 none, -1 Delete)
let tikac = null;
let necinnost = null;
let pauza = false;
let tip = null;             // the hint on screen, cleared by the next move
let tipUkazany = false;
let odhalene = false;       // Check's second step is showing the wrong numbers
let checkStav = null;       // what the last Check saw, so the second press can reveal it
const bunky = [];           // the cell elements, by cell index
const sucty = [];           // the total <span> of a cage, by its first cell index
const KLAVES_REZIM = { z: 'normal', x: 'corner', c: 'centre', v: 'colour' };
const REZIMY = ['normal', 'corner', 'centre', 'colour'];

/* ── Drawing ──────────────────────────────────────────────────────────── */
function suradnice(i) { return 'row ' + (((i / n) | 0) + 1) + ', column ' + ((i % n) + 1); }
/* Rows, columns, blocks and cages, worked out once from the puzzle so that
 * drawing, the marks and Check all read the same board. */
function pripravMriezku() {
  jedn = jednotky(n);
  bunkaJedn = new Array(n * n);
  for (let i = 0; i < n * n; i++) bunkaJedn[i] = [];
  jedn.forEach((u, k) => { for (const i of u.cells) bunkaJedn[i].push(k); });
  ohradaBunky = new Array(n * n).fill(-1);
  cages.forEach((cage, k) => { for (const i of cage.cells) ohradaBunky[i] = k; });
}
function postavMriezku() {
  const { vyska, sirka } = blokoveRozmery(n);
  document.documentElement.style.setProperty('--n', n);
  doska.setAttribute('aria-label', 'Badger grid ' + n + ' by ' + n);
  doska.textContent = '';
  bunky.length = 0; sucty.length = 0;
  const frag = document.createDocumentFragment();
  for (let r = 0; r < n; r++) {
    const riadok = document.createElement('div');
    riadok.className = 'riadok';
    riadok.setAttribute('role', 'row');
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const k = ohradaBunky[i];
      const cage = cages[k];
      const maSucet = !!(cage && cage.cells[0] === i);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'b' + (r === 0 ? ' r0' : '') + (c === 0 ? ' c0' : '')
        + (r > 0 && r % vyska === 0 ? ' bt' : '') + (c > 0 && c % sirka === 0 ? ' bl' : '')
        + (maSucet ? ' s' : '');
      b.dataset.i = i;
      b.dataset.v = '0';
      b.setAttribute('role', 'gridcell');
      b.tabIndex = -1;
      // the dotted outline: a side wherever the neighbour belongs to another cage
      const o = document.createElement('i');
      let strany = 'ohr';
      if (r === 0 || ohradaBunky[i - n] !== k) strany += ' ot';
      if (r === n - 1 || ohradaBunky[i + n] !== k) strany += ' ob';
      if (c === 0 || ohradaBunky[i - 1] !== k) strany += ' ol';
      if (c === n - 1 || ohradaBunky[i + 1] !== k) strany += ' or';
      o.className = strany;
      b.appendChild(o);
      if (maSucet) {
        const s = document.createElement('span');
        s.className = 'sucet';
        s.textContent = cage.sum;
        b.appendChild(s);
        sucty[i] = s;
      }
      const cif = document.createElement('span');
      cif.className = 'cif';
      b.appendChild(cif);
      // nine corner slots, filled in the sudokupad order (top left, top right,
      // bottom left, bottom right, top, bottom, left, right, middle)
      const rohy = document.createElement('span');
      rohy.className = 'rohy';
      for (let d = 0; d < 9; d++) rohy.appendChild(document.createElement('i'));
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
  ukazPad();
  bunky[0].tabIndex = 0;
  merajBunku();
  popisOhrad();
}
/* The pad carries 1 to n and Delete while a number or a mark is being written,
 * and all nine colours in Colour mode, whatever the size of the sett. */
function ukazPad() {
  if (!padEl) return;
  const farby = rezimZapisu === 'colour';
  const najvyssia = farby ? 9 : n;
  padEl.style.setProperty('--pad', najvyssia + 1);
  for (const t of padEl.querySelectorAll('button[data-d]')) {
    const d = +t.dataset.d;
    t.hidden = d > najvyssia;
    // Only "Digit first" has a number that stays picked up, so only there does
    // a pad key have a pressed state to announce.
    if (nastavenia.ovladanie === 'cislo') t.setAttribute('aria-pressed', aktivnaCifra === (d || -1) ? 'true' : 'false');
    else t.removeAttribute('aria-pressed');
  }
}
/* Every number on the board is drawn from --cell, the measured width of one
 * cell, so a nine by nine on a phone reads the same way as a six by six on a
 * desktop. */
function merajBunku() {
  const w = doska.clientWidth;
  if (w > 0 && n) doska.style.setProperty('--cell', (w / n) + 'px');
}
if (window.ResizeObserver) new ResizeObserver(merajBunku).observe(doska);
else window.addEventListener('resize', merajBunku);

/* The cages as plain text for a screen reader: the drawing itself only tells
 * the shape of the sett, not what it asks for. */
function popisOhrad() {
  if (!ohradyText) return;
  const casti = cages.map((cage) => cage.sum + ' in ' + cage.cells.length + (cage.cells.length === 1 ? ' cell from ' : ' cells from ') + suradnice(cage.cells[0]));
  ohradyText.textContent = 'The cages of the sett, ' + n + ' by ' + n + ', ' + cages.length + ' cages in all. ' + casti.join('. ') + '.';
}
const MENA_FARIEB = ['', 'stone', 'blue', 'teal', 'green', 'olive', 'amber', 'red', 'plum', 'indigo'];
function cifryMasky(m) {
  const out = [];
  for (let d = 1; d <= 9; d++) if (m & (1 << d)) out.push(d);
  return out;
}
function ukazBunku(i) {
  const b = bunky[i];
  if (!b) return;
  const val = v[i] || 0;
  b.dataset.v = String(val);
  if (col[i]) b.setAttribute('data-c', String(col[i])); else b.removeAttribute('data-c');
  b.querySelector('.cif').textContent = val ? String(val) : '';
  const rohy = b.querySelector('.rohy').children;
  const zoznamR = cifryMasky(cr[i]);
  for (let k = 0; k < 9; k++) rohy[k].textContent = k < zoznamR.length ? String(zoznamR[k]) : '';
  const stred = b.querySelector('.stred');
  const zoznamC = cifryMasky(ce[i]);
  stred.textContent = zoznamC.join('');
  stred.dataset.p = String(zoznamC.length);
  const cage = cages[ohradaBunky[i]];
  const casti = [];
  if (val) casti.push(String(val));
  else {
    casti.push('empty');
    if (zoznamR.length) casti.push('corner ' + zoznamR.join(' '));
    if (zoznamC.length) casti.push('centre ' + zoznamC.join(' '));
  }
  if (col[i]) casti.push(MENA_FARIEB[col[i]]);
  b.setAttribute('aria-label', suradnice(i) + ', cage of ' + (cage ? cage.sum : '?') + ', ' + casti.join(', '));
}
/* A soft visual cue only, not a judgement: a cage whose cells are all filled,
 * add up to its total and use no number twice goes quiet. It says nothing about
 * whether the numbers are RIGHT (Andrej, 10. 9.: nothing turns red while
 * playing; only Check judges). */
function ohradaSplnena(cage) {
  let sum = 0, pouzite = 0;
  for (const i of cage.cells) {
    const d = v[i];
    if (!d) return false;
    if (pouzite & (1 << d)) return false;
    pouzite |= 1 << d;
    sum += d;
  }
  return sum === cage.sum;
}
function oznacSplnene() {
  for (const cage of cages) {
    const ok = ohradaSplnena(cage);
    for (const i of cage.cells) if (bunky[i]) bunky[i].classList.toggle('stlmena', ok);
  }
}
/* The picked cells. The row, the column and the block are shaded only when a
 * single cell is picked: with a whole run selected the shading would cover half
 * the sett and say nothing. The cage is never shaded: the standard says reach
 * shading (knight, king, cage) is never drawn, in Andrej's own words, "nechcem
 * tie ukazovania". Matching numbers light up only when the setting asks for it
 * (off by default, the way Andrej plays). */
function oznacVyber() {
  for (const b of bunky) if (b) { b.classList.remove('vybrana', 'linia', 'rovnaka'); b.removeAttribute('aria-selected'); }
  if (!bunky.length) return;
  if (vyber.size === 1) {
    const i = [...vyber][0];
    for (const k of bunkaJedn[i]) for (const j of jedn[k].cells) if (bunky[j]) bunky[j].classList.add('linia');
  }
  if (nastavenia.zvyrazniRovnake && kurzor >= 0 && v[kurzor]) {
    for (let i = 0; i < n * n; i++) if (bunky[i] && v[i] === v[kurzor]) bunky[i].classList.add('rovnaka');
  }
  for (const i of vyber) if (bunky[i]) { bunky[i].classList.add('vybrana'); bunky[i].setAttribute('aria-selected', 'true'); }
  for (const b of bunky) if (b) b.tabIndex = -1;
  const t = kurzor >= 0 && bunky[kurzor] ? bunky[kurzor] : bunky[0];
  if (t) t.tabIndex = 0;
}
function ukazVsetko() {
  for (let i = 0; i < n * n; i++) ukazBunku(i);
  oznacSplnene();
  oznacVyber();
}
function zmazTip() {
  if (!tip) return;
  tip = null; tipUkazany = false;
  for (const b of bunky) if (b) b.classList.remove('tip', 'tip-ohrada');
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
  const s = nacitaj('badgers:streak');
  if (!s || !s.pocet) { seriaEl.textContent = ''; return; }
  const ziva = s.posledny === dnes || s.posledny === posunDen(dnes, -1);
  const odpustime = !ziva && odpustitVieme(s, dnes);
  if (!ziva && !odpustime) { seriaEl.textContent = ''; return; }
  seriaEl.textContent = 'Streak: ' + s.pocet + (s.pocet === 1 ? ' day' : ' days')
    + (odpustime ? ', one missed day forgiven if you solve today' : '');
}
function zapisSeriu() {
  // Only a sett solved on its own day counts: the archive is for practice.
  if (!jeDnes) return;
  const s = nacitaj('badgers:streak') || { posledny: null, pocet: 0 };
  if (s.posledny === datum) return;
  uloz('badgers:streak', krokSerie(s, datum));
}
/* Every solved day in this browser, newest first. */
function historiaDni() {
  const out = [];
  for (const k of vsetkyKluce('badgers:')) {
    const d = k.slice('badgers:'.length);
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
  historiaEl.innerHTML = '<b>Your setts:</b> ' + h.length + ' solved' + (urovne ? ' (' + urovne + ')' : '') + (ciste ? ', ' + ciste + ' clean, with no hint and no check' : ', none clean yet')
    + (best ? ', best ' + formatCas(best.sec) + ' on ' + kratkyDatum(best.d) : '') + (priemer ? ', average ' + formatCas(priemer) : '') + '. <a href="/games/badgers/archive/">Archive and full history</a>.';
}

/* ── Saving and solving ───────────────────────────────────────────────── *
 * The saved record carries the four boards. A record written before the
 * Cracking the Cryptic controls has one note grid under `p`; it comes back as
 * centre marks, which is what that grid always was. */
function ulozStav() { uloz(KLUC, { v, cr, ce, col, sec: sekundy, start, done, hints, checks, t: Date.now() }); naplanujOdoslanie(); }
function poleZoZaznamu(rec, kluc, dlzka, zaloha) {
  if (rec && Array.isArray(rec[kluc]) && rec[kluc].length === dlzka) return rec[kluc].slice();
  if (zaloha && rec && Array.isArray(rec[zaloha]) && rec[zaloha].length === dlzka) return rec[zaloha].slice();
  return new Array(dlzka).fill(0);
}
function nacitajDoDosky(rec) {
  const dlzka = n * n;
  v = poleZoZaznamu(rec, 'v', dlzka);
  cr = poleZoZaznamu(rec, 'cr', dlzka);
  ce = poleZoZaznamu(rec, 'ce', dlzka, 'p');   // the old single note grid was the centre one
  col = poleZoZaznamu(rec, 'col', dlzka);
}

function ukazStav() {
  oznacSplnene();
  stavEl.classList.toggle('ok', !!done);
  if (zdielanieEl) zdielanieEl.hidden = !done;   // Share only after the sett is finished
  if (done) {
    const s = sekundy ? ' in ' + formatCas(sekundy) : '';
    const pomoc = [];
    if (hints) pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
    if (checks) pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
    const hn = pomoc.length ? ' with ' + pomoc.join(' and ') : ' without a hint or a check';
    const seria = jeDnes ? (nacitaj('badgers:streak') || {}).pocet || 0 : 0;
    stavEl.innerHTML = '<b>Solved</b>' + s + hn + '. ' + (pomoc.length ? 'The badgers have their sett in order.' : 'A clean sett: the badgers are impressed.')
      + (jeDnes ? ' A new sett arrives at midnight, Bratislava time.' : '')
      + (seria >= 1 ? '<span class="oslava-streak">Day ' + seria + ' of your streak.</span>' : '')
      + '<span class="oslava-dalej"><a href="/games/badgers/practice/">Practice sets</a></span>';
    return;
  }
  const napisane = v.reduce((a, x) => a + (x ? 1 : 0), 0);
  if (!napisane) { stavEl.textContent = 'Pick a cell, then a number from the pad.'; return; }
  if (napisane === n * n) { stavEl.textContent = 'Every cell holds a number, but the sett is not right yet. Check shows where.'; return; }
  stavEl.textContent = '';
}

/* ── Share ────────────────────────────────────────────────────────────── *
 * A voluntary step after the sett is finished (ops/spec-hry-ux.md, part 8).
 * The text carries which sett it was, the time, the hints and checks used and
 * a map of where the cages start, with not one number in it, so it cannot spoil
 * the puzzle for whoever reads it. Nothing is sent anywhere; the text only goes
 * to the clipboard, and when the browser refuses that, into a box the player
 * can copy by hand. */
const ZNAK_ROH = '\u{1F7EB}';     // hneda kocka: prve policko ohrady
const ZNAK_POLE = '\u{2B1C}';     // biela kocka: ostatne policka
function odkazNaSett() {
  const b = 'https://arling.sk/games/badgers/';
  if (rezim === 'cvicenie') return b + 'practice/' + sada + '/' + (kSada === 1 ? '' : kSada + '/');
  return jeDnes ? b : b + datum + '/';
}
function textNaZdielanie() {
  const zaciatky = new Set(cages.map((cage) => cage.cells[0]));
  const riadky = [];
  for (let r = 0; r < n; r++) {
    let s = '';
    for (let c = 0; c < n; c++) s += zaciatky.has(r * n + c) ? ZNAK_ROH : ZNAK_POLE;
    riadky.push(s);
  }
  const kto = rezim === 'cvicenie' ? 'Badgers practice ' + sada + ', sett ' + kSada : 'Badgers ' + datum;
  const pomoc = [];
  if (hints) pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
  if (checks) pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
  return kto + ' · ' + UROVNE[zadanie.uroven].label + '\n'
    + riadky.join('\n') + '\n'
    + 'Solved' + (sekundy ? ' in ' + formatCas(sekundy) : '') + (pomoc.length ? ' with ' + pomoc.join(' and ') : ', clean: no hint, no check') + '\n'
    + odkazNaSett();
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
  track('game_share', { game: 'badgers', copied: ok, level: zadanie.uroven });
});

/* ── Check, in two steps ──────────────────────────────────────────────── *
 * The first press says how many numbers are wrong and in which rows; only the
 * second press marks them. The puzzle stays a puzzle unless you ask twice. When
 * cells are picked, only their rows, columns and blocks are checked, which is
 * how a crossword checks one word (ops/spec-hry-ux.md, part 4). */
function rozsahCheck() {
  if (vyber.size) {
    const set = new Set();
    for (const b of vyber) for (const k of bunkaJedn[b]) for (const i of jedn[k].cells) set.add(i);
    const cells = [...set];
    if (cells.some((i) => v[i])) return { cells, kde: vyber.size === 1 ? ' in the row, the column and the block of the cell you picked' : ' in the rows, the columns and the blocks of the cells you picked' };
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
    track('game_check', { game: 'badgers', wrong: 0 });
    return;
  }
  if (checkStav && !odhalene) {
    odhalene = true;
    for (const i of zle) if (bunky[i]) bunky[i].classList.add('chyba');
    stavEl.textContent = 'The marked ' + (zle.length === 1 ? 'cell does' : 'cells do') + ' not hold ' + (zle.length === 1 ? 'that number' : 'those numbers') + ' in the finished sett. Take them out and keep going.';
    checkBtn.textContent = 'Check';
    track('game_check', { game: 'badgers', wrong: zle.length, revealed: true });
    return;
  }
  // The rough area may be a row, a column or a block (ops/spec-hry-ux.md,
  // part 4); we name whichever of the three needs fewest of them, so mistakes
  // stacked in one column are told as that one column instead of four rows,
  // and mistakes sitting in one block as that one block instead of three rows
  // and three columns. Rows win a tie, then columns, then blocks.
  const riadky = [], stlpce = [], bloky = [];
  for (const i of zle) {
    const rr = ((i / n) | 0) + 1, cc = (i % n) + 1;
    const kb = bunkaJedn[i].find((k) => jedn[k].druh === 'block');
    const bb = kb === undefined ? 0 : jedn[kb].cislo + 1;
    if (!riadky.includes(rr)) riadky.push(rr);
    if (!stlpce.includes(cc)) stlpce.push(cc);
    if (!bloky.includes(bb)) bloky.push(bb);
  }
  const skupiny = [{ zoz: riadky, slovo: 'row ' }, { zoz: stlpce, slovo: 'column ' }, { zoz: bloky, slovo: 'block ' }];
  const naj = skupiny.reduce((a, b) => (b.zoz.length < a.zoz.length ? b : a));
  const kde = naj.zoz.sort((a, b) => a - b).map((k) => naj.slovo + k);
  checkStav = { zle: zle.length };
  stavEl.textContent = 'There ' + (zle.length === 1 ? 'is 1 number that is wrong' : 'are ' + zle.length + ' numbers that are wrong') + r.kde
    + ', in ' + zoznamSlov(kde.slice(0, 4)) + (kde.length > 4 ? ' and elsewhere' : '') + '. Press Check again to show where.';
  checkBtn.textContent = 'Show';
  track('game_check', { game: 'badgers', wrong: zle.length, revealed: false });
}

/* ── Hint, in two steps ───────────────────────────────────────────────── *
 * The first press names the rule and the place and outlines the cage it reads,
 * without saying what goes there; the second press writes that one number and
 * explains it in full. Writing it clears the marks of that one cell, the same
 * way a big number does. Every hint is counted and shown at the end. */
const VETY = {
  'wrong-number': (kde) => 'There is a number in ' + kde + ' that the finished sett does not have there. Take it out before going on.',
  'single-cell-cage': (kde) => 'The cage around ' + kde + ' holds that one cell only, so its total is the number itself.',
  'single-combo': (kde) => 'The total of the cage around ' + kde + ' can be made in only one way, and that settles this cell.',
  'naked-single': (kde) => 'The row, the column, the block and the cage together leave ' + kde + ' a single number.',
  'hidden-single': (kde) => 'One number has only one place left in a row, a column or a block, and that place is ' + kde + '.',
  'unit-sum-in': (kde) => 'Every row, column and block adds up to the same total. The cages lying inside one of them leave a single cell over, and it is ' + kde + '.',
  'unit-sum-out': (kde) => 'The cages reaching into one row, column or block stick out by a single cell, and it is ' + kde + '.',
  'pair': (kde) => 'Two cells nearby hold two numbers between them, which takes those numbers away from ' + kde + '.',
  'cage-sum': (kde) => 'Every way of making a cage total that the rows, the columns and the blocks still allow leaves the same number for ' + kde + '.',
  'cage-in-unit': (kde) => 'A cage lying inside one row, column or block keeps its numbers for itself, which settles ' + kde + '.',
  'trial': (kde) => 'Write in each number ' + kde + ' still allows and follow the plain rules: all but one run into a contradiction.',
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
        cr[x.i] = 0;
        ce[x.i] = 0;
        if (x.val && nastavenia.autoOdstranZnacky) odstranObmedzene(x.i, x.val);
      }
    });
    const text = t.druh === 'chyba' ? t.text.replace('Clear it before going on.', 'It is cleared now.') : t.text;
    zmazTip(); zmazOdhalenie();
    track('game_hint', { game: 'badgers', rule: t.pravidlo, layer: t.vrstva, applied: true });
    if (!zmenilo) { ulozStav(); ukazStav(); }
    if (!done) stavEl.textContent = text;
    return;
  }
  const h = napoveda(v, cages, zadanie.solution, n);
  if (!h) return;
  tip = h; tipUkazany = true;
  const i = h.bunky[0].i;
  const cage = cages[ohradaBunky[i]];
  if (cage) for (const j of cage.cells) if (bunky[j]) bunky[j].classList.add('tip-ohrada');
  for (const x of h.bunky) if (bunky[x.i]) bunky[x.i].classList.add('tip');
  vyberJednu(i, true);
  const veta = VETY[h.pravidlo] || VETY.reveal;
  const chyba = h.druh === 'chyba';
  stavEl.textContent = veta(suradnice(i)) + (chyba ? ' Press Hint again to clear it.' : ' Press Hint again to write it in.');
  hintBtn.textContent = chyba ? 'Clear it' : 'Write it';
  track('game_hint', { game: 'badgers', rule: h.pravidlo, layer: h.vrstva, applied: false });
}

function skontroluj() {
  if (!jeVyriesene(v, cages, n)) return false;
  sekundy = ubehnute();
  done = Date.now();
  start = null;
  zastavTikac();
  nastavNecinnost();
  doska.classList.add('hotovo');
  zmazTip(); zmazOdhalenie();
  vyber.clear(); kurzor = -1;   // the finished sett is green all over, not one picked cell
  oznacVyber();
  ukazCas();
  zapisSeriu();
  ukazSeriu();
  ulozStav();
  ukazHistoriu();
  ukazPasik();
  track('game_solved', { game: 'badgers', day: rezim === 'den' ? datum : sada + '/' + kSada, seconds: sekundy, hints, checks, level: zadanie.uroven });
  const kontajner = document.querySelector('.hra');
  if (kontajner) oslava(kontajner, { redukovany: !nastavenia.oslava || window.matchMedia('(prefers-reduced-motion: reduce)').matches });
  return true;
}

/* ── Moves ────────────────────────────────────────────────────────────── *
 * Every change to the board goes through zmenaStavu: it keeps all four boards
 * before and after, so Undo and Redo are one shared stack with no limit and
 * Restart is undone by a single Undo (ops/spec-hry-ux.md, part 3). */
function ukazTlacidla() {
  if (spatBtn) spatBtn.disabled = !undoStack.length || !!done;
  if (znovaBtn) znovaBtn.disabled = !redoStack.length || !!done;
  if (rezimyEl) for (const b of rezimyEl.querySelectorAll('button[data-rezim]')) b.setAttribute('aria-pressed', b.dataset.rezim === rezimZapisu ? 'true' : 'false');
  if (hraEl) hraEl.dataset.rezim = rezimZapisu;
}
function rovnake(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function snimka() { return { v: v.slice(), cr: cr.slice(), ce: ce.slice(), col: col.slice() }; }
function rovnakaSnimka(a, b) { return rovnake(a.v, b.v) && rovnake(a.cr, b.cr) && rovnake(a.ce, b.ce) && rovnake(a.col, b.col); }
function obnovSnimku(s) { v = s.v.slice(); cr = s.cr.slice(); ce = s.ce.slice(); col = s.col.slice(); }
function zmenaStavu(fn) {
  if (done || pauza) return false;
  const pred = snimka();
  fn();
  if (rovnakaSnimka(snimka(), pred)) return false;
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
/* Auto remove restricted notes, off by default (the way Andrej plays). With it
 * on, a big number takes its own value out of the corner and centre marks of
 * every other cell of its row, its column, its block and its cage. */
function odstranObmedzene(i, d) {
  const bit = ~(1 << d);
  for (const k of bunkaJedn[i]) for (const j of jedn[k].cells) if (j !== i) { cr[j] &= bit; ce[j] &= bit; }
  const cage = cages[ohradaBunky[i]];
  if (cage) for (const j of cage.cells) if (j !== i) { cr[j] &= bit; ce[j] &= bit; }
}

/* ── Selection ────────────────────────────────────────────────────────── *
 * A click or a tap picks one cell; a drag across the sett picks every cell it
 * runs over; Ctrl (Cmd) plus a click adds one or takes it away; the arrows walk
 * and wrap round the edge, Ctrl plus an arrow widens the selection, Escape lets
 * everything go. The selection is a set of cell indexes, `kurzor` the cell the
 * arrows move from and the only one in the page tab order. */
function vyberJednu(i, fokus) {
  if (i < 0 || !bunky[i]) return;
  vyber = new Set([i]);
  kurzor = i;
  oznacVyber();
  if (fokus) bunky[i].focus({ preventScroll: true });
}
function zrusVyber() {
  if (!vyber.size) return;
  const b = kurzor >= 0 ? bunky[kurzor] : null;
  vyber.clear();
  oznacVyber();
  if (b) b.blur();
}
function dalsia(i, dr, dc) {
  const r = (((i / n) | 0) + dr + n) % n, c = ((i % n) + dc + n) % n;
  return r * n + c;
}
function posunKurzor(dr, dc, rozsir) {
  const zac = kurzor >= 0 && bunky[kurzor] ? kurzor : 0;
  const i = vyber.size || kurzor >= 0 ? dalsia(zac, dr, dc) : zac;
  if (rozsir) vyber.add(i); else vyber = new Set([i]);
  kurzor = i;
  oznacVyber();
  if (bunky[i]) bunky[i].focus({ preventScroll: true });
}

/* ── Writing ──────────────────────────────────────────────────────────── *
 * A number with several cells picked: in Normal it goes into all of them, in
 * Corner and Centre it toggles the mark in all of them (if every one has it,
 * it comes off, otherwise it goes on), in Colour it paints all of them. The
 * same number again takes it back, so the way out is always one press. */
function ucinnyRezim(e) {
  if (!e) return rezimZapisu;
  const ctrl = e.ctrlKey || e.metaKey;
  if (e.shiftKey && !ctrl) return 'corner';
  if (ctrl && !e.shiftKey) return 'centre';
  return rezimZapisu;
}
function zapis(d, rezimZ, ciele) {
  const ciel = ciele || [...vyber];
  if (!ciel.length || !d || done || pauza) return;
  const r = rezimZ || rezimZapisu;
  if (r === 'colour') {
    if (d > 9) return;
    const vsetky = ciel.every((i) => col[i] === d);
    zmenaStavu(() => { for (const i of ciel) col[i] = vsetky ? 0 : d; });
    return;
  }
  if (d > n) return;
  if (r === 'normal') {
    // "Add note": a digit typed into a cell that already carries marks becomes
    // a mark of the default style instead of overwriting the cell. "Fill cell",
    // the default, writes the number and only hides the marks.
    if (nastavenia.zapisSoZnackami === 'note' && ciel.some((i) => !v[i] && (cr[i] || ce[i]))) {
      zapis(d, nastavenia.stylZnaciek === 'centre' ? 'centre' : 'corner', ciel);
      return;
    }
    const vsetky = ciel.every((i) => v[i] === d);
    zmenaStavu(() => {
      for (const i of ciel) {
        v[i] = vsetky ? 0 : d;
        if (!vsetky && nastavenia.autoOdstranZnacky) odstranObmedzene(i, d);
      }
    });
    return;
  }
  const pole = r === 'corner' ? cr : ce;
  const vsetky = ciel.every((i) => pole[i] & (1 << d));
  zmenaStavu(() => { for (const i of ciel) { if (vsetky) pole[i] &= ~(1 << d); else pole[i] |= 1 << d; } });
}
/* Delete and Backspace, in the one order the standard sets, the same in every
 * mode: if any picked cell holds a big number, the big numbers go; otherwise,
 * if any holds marks, the marks go (corner and centre together); otherwise the
 * colour goes. The entry mode does not change this order. */
function zmaz(ciele) {
  const ciel = ciele || [...vyber];
  if (!ciel.length || done || pauza) return;
  if (ciel.some((i) => v[i])) { zmenaStavu(() => { for (const i of ciel) v[i] = 0; }); return; }
  if (ciel.some((i) => cr[i] || ce[i])) { zmenaStavu(() => { for (const i of ciel) { cr[i] = 0; ce[i] = 0; } }); return; }
  zmenaStavu(() => { for (const i of ciel) col[i] = 0; });
}

function spat() {
  if (done || pauza || !undoStack.length) return;
  redoStack.push(snimka());
  obnovSnimku(undoStack.pop());
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) { ulozStav(); zivaKontrola(); }
  ukazStav();
  ukazTlacidla();
}
function znova() {
  if (done || pauza || !redoStack.length) return;
  undoStack.push(snimka());
  obnovSnimku(redoStack.pop());
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) { ulozStav(); zivaKontrola(); }
  ukazStav();
  ukazTlacidla();
}
/* Restart: the sett as it started, colours and marks included, the clock still
 * running (Andrej, 10. 9.: clearing is a move, not a restart of the day). One
 * Undo brings everything back. */
function reset() {
  if (done || pauza) return;
  if (v.every((x) => !x) && cr.every((x) => !x) && ce.every((x) => !x) && col.every((x) => !x)) return;
  if (nastavenia.potvrditReset && !window.confirm('Restart the sett? Numbers, marks and colours go; the clock keeps running and one Undo brings them back.')) return;
  zmenaStavu(() => {
    v = new Array(n * n).fill(0);
    cr = new Array(n * n).fill(0);
    ce = new Array(n * n).fill(0);
    col = new Array(n * n).fill(0);
  });
}

/* ── Pointer ──────────────────────────────────────────────────────────── *
 * A tap picks a cell, a drag picks every cell it runs over (the setting "Cell
 * selection when dragging"), Ctrl or Cmd plus a click adds one to the selection
 * or takes it away. With "Digit first" the number waiting on the pad is written
 * into every cell the pointer touches. */
function bunkaPod(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const b = el && el.closest ? el.closest('.b') : null;
  return b && doska.contains(b) ? +b.dataset.i : -1;
}
function pouziAktivnu(ciel, e) {
  if (nastavenia.ovladanie !== 'cislo' || !aktivnaCifra) return;
  if (aktivnaCifra === -1) zmaz(ciel);
  else zapis(aktivnaCifra, ucinnyRezim(e), ciel);
}
let tah = null; // { id, odoberali }
doska.addEventListener('pointerdown', (e) => {
  if (done || pauza || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const i = bunkaPod(e);
  if (i < 0) return;
  const ctrl = e.ctrlKey || e.metaKey;
  let odoberali = false;
  if (ctrl) {
    if (vyber.has(i)) { vyber.delete(i); odoberali = true; } else vyber.add(i);
  } else {
    vyber = new Set([i]);
  }
  kurzor = i;
  oznacVyber();
  if (bunky[i]) bunky[i].focus({ preventScroll: true });
  tah = { id: e.pointerId, odoberali };
  try { doska.setPointerCapture(e.pointerId); } catch (err) { /* works without capture too, less smoothly */ }
  if (!odoberali) pouziAktivnu([i], e);
  e.preventDefault();
});
doska.addEventListener('pointermove', (e) => {
  if (!tah || tah.id !== e.pointerId || done || pauza) return;
  if (nastavenia.tahVyber !== 'viac') return;
  const i = bunkaPod(e);
  if (i < 0) return;
  if (tah.odoberali) { if (!vyber.has(i)) return; vyber.delete(i); kurzor = i; oznacVyber(); return; }
  if (vyber.has(i) && kurzor === i) return;
  const nova = !vyber.has(i);
  vyber.add(i);
  kurzor = i;
  oznacVyber();
  if (nova) pouziAktivnu([i], e);
});
function koniecTahu(e) {
  if (!tah || tah.id !== e.pointerId) return;
  tah = null;
  try { doska.releasePointerCapture(e.pointerId); } catch (err) { /* nothing */ }
}
doska.addEventListener('pointerup', koniecTahu);
doska.addEventListener('pointercancel', (e) => { if (tah && tah.id === e.pointerId) tah = null; });
doska.addEventListener('contextmenu', (e) => e.preventDefault());
/* Tab into the board and the cell that takes the focus is the picked one. The
 * drag sets `kurzor` before it moves the focus, so this never undoes it. */
doska.addEventListener('focusin', (e) => {
  const b = e.target && e.target.closest ? e.target.closest('.b') : null;
  if (!b) return;
  const i = +b.dataset.i;
  if (i !== kurzor) vyberJednu(i, false);
});

/* ── Modes ────────────────────────────────────────────────────────────── *
 * Four buttons under the pad and four keys: Z Normal, X Corner, C Centre,
 * V Colour. Space walks round all four, N walks round the three that write
 * numbers. Holding Shift means Corner and holding Ctrl means Centre for as
 * long as the key is down, without changing the button. */
function nastavRezim(r) {
  if (!REZIMY.includes(r) || rezimZapisu === r) return;
  rezimZapisu = r;
  ukazPad();
  ukazTlacidla();
}
function cyklusRezimu(len3) {
  const zoz = len3 ? ['normal', nastavenia.stylZnaciek === 'centre' ? 'centre' : 'corner', nastavenia.stylZnaciek === 'centre' ? 'corner' : 'centre'] : REZIMY;
  const k = zoz.indexOf(rezimZapisu);
  nastavRezim(zoz[(k + 1) % zoz.length]);
}
if (rezimyEl) rezimyEl.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-rezim]');
  if (!b) return;
  nastavRezim(b.dataset.rezim);
  vratFokus();
});

/* ── The pad ──────────────────────────────────────────────────────────── *
 * With "Selection" (the default) a tap on the pad writes into the picked cells.
 * With "Digit first" it only picks the number up; the taps on the sett that
 * follow write it, and the number stays picked up. */
padEl.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-d]');
  if (!b || done || pauza) return;
  const d = +b.dataset.d;
  if (nastavenia.ovladanie === 'cislo') {
    const nova = d || -1;
    aktivnaCifra = aktivnaCifra === nova ? 0 : nova;
    ukazPad();
    stavEl.textContent = aktivnaCifra ? (aktivnaCifra === -1 ? 'Delete is picked up: tap the cells to empty.' : 'Number ' + aktivnaCifra + ' is picked up: tap the cells to write it.') : '';
    return;
  }
  if (!vyber.size) { stavEl.textContent = 'Pick a cell first, then a number.'; return; }
  if (d) zapis(d, ucinnyRezim(e)); else zmaz();
  vratFokus();
});
padEl.addEventListener('contextmenu', (e) => { if (e.target.closest('button[data-d]')) e.preventDefault(); });
/* Každé tlačidlo mimo plochy vráti fókus na vybranú bunku: kto klikne myšou a
 * potom píše z klávesnice, nemá o šípky ani o cifry prísť. */
function vratFokus() {
  if (kurzor >= 0 && bunky[kurzor]) bunky[kurzor].focus({ preventScroll: true });
}
if (spatBtn) spatBtn.addEventListener('click', () => { spat(); vratFokus(); });
if (znovaBtn) znovaBtn.addEventListener('click', () => { znova(); vratFokus(); });
if (resetBtn) resetBtn.addEventListener('click', () => { reset(); vratFokus(); });
if (checkBtn) checkBtn.addEventListener('click', () => { skontrolujStav(); vratFokus(); });
if (hintBtn) hintBtn.addEventListener('click', () => { ukazNapovedu(); vratFokus(); });
if (pauzaBtn) pauzaBtn.addEventListener('click', () => pozastav(false));
if (pokracujBtn) pokracujBtn.addEventListener('click', pokracuj);

/* ── Keyboard ─────────────────────────────────────────────────────────── *
 * One listener for the whole page, so the keys keep working after a click on
 * Undo or on the pad. Fields and the Settings summary keep their own keys.
 *   arrows, WASD   move the selection, wrapping round the edge
 *   Ctrl + arrow   widen the selection
 *   Escape         let the selection go
 *   1 to 9, numpad write in the mode that is on (Shift Corner, Ctrl Centre)
 *   Delete, Backspace, 0   numbers, then marks, then colour
 *   Z X C V        Normal, Corner, Centre, Colour; Space walks round all four,
 *                  N round the three that write numbers
 *   U, Ctrl+Z      undo;  R, Ctrl+Y, Ctrl+Shift+Z  redo
 *   P              pause, and the way back out of one. Ctrl+R is never taken:
 *                  it reloads the page.
 */
function vstupnePole(t) {
  if (!t) return false;
  if (t.isContentEditable) return true;
  return /^(input|textarea|select|summary|option)$/i.test(t.tagName || '');
}
document.addEventListener('keydown', (e) => {
  const t = e.target;
  if (vstupnePole(t)) return;
  const ctrl = e.ctrlKey || e.metaKey;
  // Undo and Redo first: Ctrl plus a letter is never a mode key, and Ctrl+R
  // stays the browser's own reload.
  if (ctrl && (e.key === 'z' || e.key === 'Z')) { if (e.shiftKey) znova(); else spat(); e.preventDefault(); return; }
  if (ctrl && (e.key === 'y' || e.key === 'Y')) { znova(); e.preventDefault(); return; }
  if (e.key === 'Escape') {
    if (pauza) { pokracuj(); return; }
    if (vyber.size) { zrusVyber(); e.preventDefault(); }
    return;
  }
  // Pause both ways, and before the guard below, because it is also the way
  // back out of a pause. It used to sit in a second listener of its own, which
  // meant one press of P ran through both: the first put the sett to sleep and
  // the second woke it again in the same keystroke, so P never paused at all.
  if (!ctrl && (e.key === 'p' || e.key === 'P')) {
    if (pauza) pokracuj(); else if (!done) pozastav(false);
    e.preventDefault();
    return;
  }
  if (done || pauza) return;
  const vDoske = !!(t && t.closest && t.closest('#doska'));
  const kod = e.code || '';
  // moving the selection
  const smery = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  const wasd = { KeyW: [-1, 0], KeyS: [1, 0], KeyA: [0, -1], KeyD: [0, 1] };
  const smer = smery[e.key] || (!ctrl && !e.shiftKey && !e.altKey ? wasd[kod] : null);
  if (smer) { posunKurzor(smer[0], smer[1], ctrl); e.preventDefault(); return; }
  // numbers, from the row of digits or from the numeric keypad
  const cifra = /^[0-9]$/.test(e.key) ? +e.key : (/^Numpad[0-9]$/.test(kod) ? +kod.slice(6) : -1);
  if (cifra >= 0 && !e.altKey) {
    if (nastavenia.lenPad) return;   // Onscreen input only: the pad writes, the keyboard does not
    const r = ucinnyRezim(e);
    if (nastavenia.ovladanie === 'cislo') { aktivnaCifra = cifra || -1; ukazPad(); }
    if (!vyber.size) { if (nastavenia.ovladanie !== 'cislo') stavEl.textContent = 'Pick a cell first, then a number.'; e.preventDefault(); return; }
    if (cifra) zapis(cifra, r); else zmaz();
    e.preventDefault();
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (nastavenia.lenPad) return;
    if (nastavenia.ovladanie === 'cislo') { aktivnaCifra = -1; ukazPad(); }
    zmaz();
    e.preventDefault();
    return;
  }
  if (ctrl) return;    // Ctrl plus anything else belongs to the browser
  if (e.key === ' ' || kod === 'Space') {
    if (!vDoske && t && t.tagName === 'BUTTON') return;   // Space still presses a button
    cyklusRezimu(false); e.preventDefault(); return;
  }
  const r = KLAVES_REZIM[(e.key || '').toLowerCase()];
  if (r) { nastavRezim(r); e.preventDefault(); return; }
  if (e.key === 'n' || e.key === 'N' || (e.key === 'Enter' && vDoske)) { cyklusRezimu(true); e.preventDefault(); return; }
  if (e.key === 'u' || e.key === 'U') { spat(); e.preventDefault(); return; }
  if (e.key === 'r' || e.key === 'R') { znova(); e.preventDefault(); return; }
});
document.addEventListener('keydown', nastavNecinnost, true);
document.addEventListener('pointerdown', nastavNecinnost, true);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (nastavenia.pauzaPriOdchode && start && !done) pozastav(true); }
  else ukazCas();
});

/* ── The week strip ───────────────────────────────────────────────────── *
 * A finished sett has two marks (ops/spec-hry-ux.md, part 8): solved, and
 * solved clean with no hint and no check. The clean one adds the class `ciste`
 * (a dot in the corner, so the difference is a shape and not only a colour) and
 * says so in the aria-label as well. */
function jeRozohrane(st) {
  if (!st) return false;
  for (const k of ['v', 'cr', 'ce', 'col', 'p']) if (Array.isArray(st[k]) && st[k].some((x) => x)) return true;
  return false;
}
function triedaStavu(st) {
  if (st && st.done) return st.hints || st.checks ? ' hotove' : ' hotove ciste';
  return jeRozohrane(st) ? ' rozohrane' : '';
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
      const st = nacitaj('badgers:p:' + sada + ':' + k);
      const a = document.createElement(k === kSada ? 'span' : 'a');
      a.className = 'den' + (k === kSada ? ' dnes' : '') + triedaStavu(st);
      if (k !== kSada) a.href = '/games/badgers/practice/' + sada + '/' + k + '/';
      a.innerHTML = '<small>No.</small><b>' + k + '</b>';
      a.setAttribute('aria-label', 'Sett ' + k + slovoStavu(st));
      if (k === kSada) a.setAttribute('aria-current', 'page');
      pasik.appendChild(a);
    }
    return;
  }
  const dni = tyzden(datum);
  dni.forEach((d, k) => {
    const st = nacitaj('badgers:' + d);
    const buduci = d > dnes, pred = d < PRVY_DEN;
    const tag = d === datum || buduci || pred ? 'span' : 'a';
    const a = document.createElement(tag);
    a.className = 'den' + (d === datum ? ' dnes' : '') + (buduci || pred ? ' buduci' : '') + triedaStavu(st);
    if (tag === 'a') a.href = '/games/badgers/' + d + '/';
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
  if (nastavenia.ovladanie !== 'cislo') aktivnaCifra = 0;
  zivaKontrola();
  ukazPad();
  oznacVyber();
  nastavNecinnost();
  ukazCas();
}
document.querySelectorAll('[data-nastavenie]').forEach((el) => {
  const kluc = el.getAttribute('data-nastavenie');
  const jeZaskrtavatko = el.type === 'checkbox';
  if (jeZaskrtavatko) el.checked = !!nastavenia[kluc];
  else el.value = String(nastavenia[kluc]);
  el.addEventListener('change', () => {
    const hodnota = jeZaskrtavatko ? el.checked : el.value;
    nastavenia[kluc] = hodnota;
    ulozNastavenia();
    pouziNastavenia();
    track('game_setting', { game: 'badgers', setting: kluc, value: String(hodnota) });
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
  for (const k of vsetkyKluce('badgers:')) {
    const d = k.slice('badgers:'.length);
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
  if (!ziva) { try { localStorage.removeItem('badgers:streak'); } catch (e) { /* nič */ } return; }
  uloz('badgers:streak', s);
}
function odosliStav() {
  if (!ucet.prihlaseny()) return;
  ucet.hra.uloz('badgers', { dni: stavVsetkychDni(), t: Date.now() }).catch(() => { /* sieťová chyba: lokálne ostáva pravdou */ });
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
  try { vzdialene = await ucet.hra.nacitaj('badgers'); } catch (e) { return; /* sieťová chyba: lokálne ostáva pravdou */ }
  const diaDni = vzdialene && vzdialene.dni && typeof vzdialene.dni === 'object' ? vzdialene.dni : {};
  let zmenene = false;
  for (const [d, r] of Object.entries(diaDni)) {
    if (!isValidDate(d) || !r || typeof r !== 'object') continue;
    const kluc = 'badgers:' + d;
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
        nacitajDoDosky(cerstve);
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
async function spusti() {
  if (jeBuduci) {
    datumEl.textContent = pekneDatum(datum);
    stavEl.textContent = 'This sett opens on ' + pekneDatum(datum) + ' (Bratislava time). Come back then, or play today’s sett.';
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
    stavEl.textContent = 'The sett could not be prepared. Please reload the page.';
    throw e;
  }
  n = zadanie.n;
  cages = zadanie.cages;
  pripravMriezku();
  ulozene = nacitaj(KLUC);
  nacitajDoDosky(ulozene);
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
  ukazVsetko();
  pouziNastavenia();
  if (datumEl) datumEl.textContent = rezim === 'cvicenie' ? UROVNE[zadanie.uroven].label + ' practice ' + sada.split('-')[1] + ', sett ' + kSada : pekneDatum(datum);
  if (urovenEl) urovenEl.textContent = UROVNE[zadanie.uroven].label + ' · ' + n + '×' + n;
  if (done) doska.classList.add('hotovo');
  else if (jeRozohrane({ v, cr, ce, col })) pozastav(true);
  ukazCas();
  ukazSeriu();
  ukazHistoriu();
  ukazPasik();
  ukazStav();
  ukazTlacidla();
}
spusti().then(synchronizujUcet);
