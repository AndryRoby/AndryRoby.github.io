import '../kniha.mjs?v=1';
/* Beavers: the game page. One script for the daily pond, the archive days and
 * the practice sets; the page says which one it is:
 *
 *   <body data-den="YYYY-MM-DD">          an archive day (built page)
 *   <body data-sada="easy-1" data-k="3">  a practice pond
 *   nothing                               today's pond (or ?d=YYYY-MM-DD)
 *
 * The puzzle itself comes, in this order: from <script type="application/json"
 * id="zadanie"> embedded in a built page; from dni/YYYY-MM.json for the day;
 * or, when both are missing, generated right here from the date. All three
 * give the same pond for the same date (plan.mjs, generator.mjs).
 *
 * The player's board is one flat n*n array:
 *   v   0 an empty cell, 1 a lodge, 2 grass (the player's note that no lodge
 *       goes there). A tree cell is part of the puzzle and stays 0 for ever.
 * Only the lodges decide the puzzle: to the rules grass and an empty cell are
 * the same thing (logika.mjs).
 *
 * Controls, pattern D of ops/spec-hry-ux.md: a tap takes a cell through
 * grass, a lodge and back to empty; right click or Shift and click goes one
 * step back; a drag (8 px) sweeps the mark the first cell got over empty
 * cells only, never over another mark and never over a tree. Keyboard:
 * arrows move (over trees too, for a screen reader), Space or Enter cycles,
 * X grass, B lodge, Delete or Backspace clears, U or Ctrl+Z undo, R or
 * Ctrl+Shift+Z redo, P pause, Escape drops a stroke in progress. Ctrl+R is
 * never taken over: it reloads the page.
 *
 * Stored in localStorage (all in try/catch, private windows throw):
 *   beavers:YYYY-MM-DD     { v, sec, start, done, hints, checks, t, u, r }
 *   beavers:p:<set>:<k>    the same for a practice pond
 *   beavers:streak         { posledny: YYYY-MM-DD, pocet }
 *   beavers:nastavenia     the settings panel
 * sec = seconds spent before the current run, start = ms when the current run
 * began (null while paused or before the first move), done = ms of the solve,
 * hints and checks = help used, t = ms of the last save, u and r = the Undo
 * and Redo stacks (the last 200 boards each, as strings of digits; only while
 * the pond is in play, and never sent to the account).
 * Outgoing events via window.umami, if it runs: game_solved, game_check,
 * game_hint, game_setting, game_share. Nothing else leaves the browser, unless
 * the player is signed in (arling.sk account, /style/ucet.js): then every
 * beavers:YYYY-MM-DD save is also pushed to the account (throttled, 2 s) and
 * pulled back on load, so the streak and history follow across devices.
 */
import { zadaniePreDen, zadanieCvicenie, rozbal, tyzden, urovenDna, posunDen, pekneDatum, kratkyDatum, UROVNE, SADY, PRVY_DEN, DNI } from './plan.mjs';
import { todayBratislava, isValidDate } from './generator.mjs';
// Which days still have a page of their own and what ?d= may hold: one rule
// for all the games, /games/okno.mjs (the generators read the same file).
import { denZParametra, adresaDna, trvalaAdresaDna } from '../okno.mjs?v=1';
import { jeVyriesene, cislaSedia, porovnaj, napoveda, autoTrava } from './logika.mjs';
import * as ucet from '/style/ucet.js';
import { oslava } from '../oslava.js';
// The play screen (../hra-ui.js): the rule in one line over the board with a
// Rules panel, the buttons pinned in reach, the board sized to the window.
import { hraUi } from '../hra-ui.js?v=1';
hraUi({ pravidlo: 'Each tree gets its own lodge beside it. Lodges never touch, even at a corner. Numbers count lodges per line.' });

const $ = (id) => document.getElementById(id);
const doska = $('doska');
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
const urovenEl = $('uroven');
const historiaEl = $('historia');
const cislaText = $('cisla-text');
const zdielanieEl = $('zdielanie');
const zdielajBtn = $('zdielaj');
const zdielanieStav = $('zdielanie-stav');
const zdielanieText = $('zdielanie-text');

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

/* ── Settings ─────────────────────────────────────────────────────────── */
const NASTAVENIA_KLUC = 'beavers:nastavenia';
// Auto grass and Live check are off by default: the grass is the player's own,
// and nothing turns red while you play (Andrej, 10. 9.); Check is the only
// judge before the pond is finished.
const NASTAVENIA_PREDVOLENE = { casovac: true, pauzaPriOdchode: true, potvrditReset: true, oslava: true, autoTrava: false, zivaKontrola: false };
let nastavenia = Object.assign({}, NASTAVENIA_PREDVOLENE, nacitaj(NASTAVENIA_KLUC) || {});
function ulozNastavenia() { uloz(NASTAVENIA_KLUC, nastavenia); }

/* ── Which pond ───────────────────────────────────────────────────────── */
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
  // ?d= opens one day on this page; that is how a day too old to have a page
  // of its own is played. Only a real date from the first day to today passes.
  try { const d = denZParametra(new URL(location.href).searchParams.get('d'), PRVY_DEN, dnes); if (d) datum = d; } catch (e) { /* today */ }
}
const jeDnes = rezim === 'den' && datum === dnes;
const jeBuduci = rezim === 'den' && datum > dnes;
const KLUC = rezim === 'cvicenie' ? 'beavers:p:' + sada + ':' + kSada : 'beavers:' + datum;
// The root address always opens today's pond; once the date is settled,
// rewrite it to today's built page so the address bar and a shared link point
// at the day itself (Andrej, 10. 9.). Only the plain root qualifies.
if (rezim === 'den' && !body.dataset.den && jeDnes && !location.search) {
  try { history.replaceState(null, '', '/games/beavers/' + datum + '/'); } catch (e) { /* the address stays generic; the game still works */ }
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

/* ── Loading the pond ─────────────────────────────────────────────────── */
function vlozene() {
  const el = $('zadanie');
  if (!el) return null;
  try { return rozbal(JSON.parse(el.textContent)); } catch (e) { return null; }
}
async function zTabulky(iso) {
  try {
    const r = await fetch('/games/beavers/dni/' + iso.slice(0, 7) + '.json', { cache: 'no-cache' });
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
let zadanie, n, C, jeStrom, v, start, done, sekundy, hints, checks, ulozene;
let undoStack = [];
let redoStack = [];
let kurzor = 0;             // the cell the keyboard is standing on
let tikac = null;
let necinnost = null;
let pauza = false;
let tip = null;             // the hint on screen, cleared by the next move
let tipKroky = [];          // cells the second press of Hint just marked
let odhalene = false;       // Check's second step is showing the wrong cells
let checkStav = null;       // what the last Check saw, so the second press can reveal it
const bunky = [];
const hlavRiadkov = [];
const hlavStlpcov = [];

/* ── Drawing ──────────────────────────────────────────────────────────── */
function suradnice(i) { return 'row ' + (((i / n) | 0) + 1) + ', column ' + ((i % n) + 1); }
function postavMriezku() {
  document.documentElement.style.setProperty('--n', n);
  doska.style.setProperty('--n', n);
  doska.setAttribute('aria-label', 'Pond grid ' + n + ' by ' + n);
  doska.textContent = '';
  bunky.length = 0; hlavRiadkov.length = 0; hlavStlpcov.length = 0;
  const frag = document.createDocumentFragment();
  const hlavicky = document.createElement('div');
  hlavicky.className = 'riadok';
  hlavicky.setAttribute('role', 'row');
  const roh = document.createElement('div');
  roh.className = 'h roh';
  roh.setAttribute('aria-hidden', 'true');
  hlavicky.appendChild(roh);
  for (let c = 0; c < n; c++) {
    const h = document.createElement('div');
    h.className = 'h hc';
    h.setAttribute('role', 'columnheader');
    h.textContent = String(zadanie.cols[c]);
    h.setAttribute('aria-label', 'Column ' + (c + 1) + ': ' + zadanie.cols[c] + (zadanie.cols[c] === 1 ? ' lodge' : ' lodges'));
    hlavicky.appendChild(h);
    hlavStlpcov.push(h);
  }
  frag.appendChild(hlavicky);
  for (let r = 0; r < n; r++) {
    const riadok = document.createElement('div');
    riadok.className = 'riadok';
    riadok.setAttribute('role', 'row');
    const hr = document.createElement('div');
    hr.className = 'h hr';
    hr.setAttribute('role', 'rowheader');
    hr.textContent = String(zadanie.rows[r]);
    hr.setAttribute('aria-label', 'Row ' + (r + 1) + ': ' + zadanie.rows[r] + (zadanie.rows[r] === 1 ? ' lodge' : ' lodges'));
    riadok.appendChild(hr);
    hlavRiadkov.push(hr);
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'b' + (r === 0 ? ' r0' : '') + (c === 0 ? ' c0' : '') + (jeStrom[i] ? ' strom' : '');
      b.dataset.i = i;
      b.dataset.v = '0';
      b.setAttribute('role', 'gridcell');
      b.tabIndex = i === 0 ? 0 : -1;
      if (jeStrom[i]) b.setAttribute('aria-disabled', 'true');
      const ik = document.createElement('i');
      ik.className = 'ikona';
      b.appendChild(ik);
      riadok.appendChild(b);
      bunky.push(b);
    }
    frag.appendChild(riadok);
  }
  doska.appendChild(frag);
  kurzor = 0;
  merajBunku();
  popisCisel();
}
/* The numbers and marks are drawn from --cell, the measured width of one
 * cell, so a fourteen by fourteen on a phone reads the same way as an eight
 * by eight on a desktop. */
function merajBunku() {
  const b = bunky[0];
  if (!b) return;
  const w = b.getBoundingClientRect().width;
  if (w > 0) doska.style.setProperty('--cell', w + 'px');
}
if (window.ResizeObserver) new ResizeObserver(merajBunku).observe(doska);
else window.addEventListener('resize', merajBunku);

/* The pond as plain text for a screen reader. */
function popisCisel() {
  if (!cislaText) return;
  cislaText.textContent = 'The pond, ' + n + ' by ' + n + ', with ' + zadanie.trees.length + ' trees and as many lodges to place. '
    + 'Lodges by row, from the top: ' + zadanie.rows.join(', ') + '. By column, from the left: ' + zadanie.cols.join(', ') + '.';
}
const NAZVY = ['empty', 'lodge', 'grass'];
function ukazBunku(i) {
  const b = bunky[i];
  if (!b) return;
  if (jeStrom[i]) { b.dataset.v = '0'; b.setAttribute('aria-label', 'Row ' + (((i / n) | 0) + 1) + ', column ' + ((i % n) + 1) + ', tree'); return; }
  const val = v[i] || 0;
  b.dataset.v = String(val);
  b.setAttribute('aria-label', 'Row ' + (((i / n) | 0) + 1) + ', column ' + ((i % n) + 1) + ', ' + NAZVY[val]);
}
/* A soft cue only, not a judgement: a line goes quiet once it holds exactly
 * its number of lodges AND has no empty cell left (the rest is grass or
 * trees), that is once the player has finished it. Only counting the lodges
 * would dim every 0 from the very start, and a 0 is the best way into a pond;
 * it would also light it up again the moment a lodge landed there, a live
 * mistake signal. It says nothing about whether the lodges are the RIGHT
 * cells (Andrej, 10. 9.: nothing turns red while playing; only Check judges).
 * A finished pond goes quiet everywhere. */
function oznacSuciatka() {
  for (let r = 0; r < n; r++) {
    let s = 0, prazdne = 0;
    for (let c = 0; c < n; c++) { const i = r * n + c; if (v[i] === 1) s++; else if (!v[i] && !jeStrom[i]) prazdne++; }
    hlavRiadkov[r].classList.toggle('zhotovo', !!done || (s === zadanie.rows[r] && !prazdne));
    hlavRiadkov[r].classList.toggle('nad', !!nastavenia.zivaKontrola && !done && s > zadanie.rows[r]);
  }
  for (let c = 0; c < n; c++) {
    let s = 0, prazdne = 0;
    for (let r = 0; r < n; r++) { const i = r * n + c; if (v[i] === 1) s++; else if (!v[i] && !jeStrom[i]) prazdne++; }
    hlavStlpcov[c].classList.toggle('zhotovo', !!done || (s === zadanie.cols[c] && !prazdne));
    hlavStlpcov[c].classList.toggle('nad', !!nastavenia.zivaKontrola && !done && s > zadanie.cols[c]);
  }
}
/* Live check (off by default): lodges that touch get the mistake frame, by
 * the rules alone, never by the solution. */
function zivaKontrola() {
  for (const b of bunky) b.classList.remove('ziva');
  if (!nastavenia.zivaKontrola || done || !zadanie) return;
  for (let i = 0; i < C; i++) {
    if (v[i] !== 1) continue;
    const r = (i / n) | 0, c = i % n;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      if (v[rr * n + cc] === 1) bunky[i].classList.add('ziva');
    }
  }
}
function ukazVsetko() {
  for (let i = 0; i < C; i++) ukazBunku(i);
  oznacSuciatka();
  zivaKontrola();
}
function zmazTip() {
  if (!tip && !tipKroky.length) return;
  tip = null; tipKroky = [];
  for (const b of bunky) {
    b.classList.remove('tip', 'tip-jednotka', 'tip-retaz');
    const ik = b.firstChild;
    if (ik && ik.dataset && ik.dataset.krok) delete ik.dataset.krok;
  }
  for (const h of hlavRiadkov) h.classList.remove('tip-jednotka');
  for (const h of hlavStlpcov) h.classList.remove('tip-jednotka');
  if (hintBtn) hintBtn.textContent = 'Hint';
}
function zmazOdhalenie() {
  if (!odhalene && !checkStav) return;
  odhalene = false; checkStav = null;
  for (const b of bunky) b.classList.remove('chyba');
  if (checkBtn) checkBtn.textContent = 'Check';
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
  if (done || pauza || !zadanie) return;
  if (start) { sekundy = ubehnute(); start = null; }
  pauza = true;
  zrusTah();
  zastavTikac();
  nastavNecinnost();
  ulozStav();
  ukazCas();
  ukazTlacidla();
  if (pauzaCas) pauzaCas.textContent = sekundy ? 'You have spent ' + slovaCas(sekundy) + ' so far.' : 'Your marks are kept; the clock continues when you resume.';
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
  ukazTlacidla();
}

/* ── Streak and history ───────────────────────────────────────────────── */
/* The streak line under the buttons belongs to today's pond only (an archive
 * day or a practice pond never counts), and once today's pond is solved the
 * result panel says it ("Day N of your streak."), so it is not said twice. */
function ukazSeriu() {
  if (!seriaEl) return;
  const s = nacitaj('beavers:streak');
  if (!jeDnes || done || !s || !s.pocet) { seriaEl.textContent = ''; return; }
  const ziva = s.posledny === dnes || s.posledny === posunDen(dnes, -1);
  seriaEl.textContent = ziva ? 'Streak: ' + s.pocet + (s.pocet === 1 ? ' day' : ' days') : '';
}
function zapisSeriu() {
  // Only a pond solved on its own day counts: the archive is for practice.
  if (!jeDnes) return;
  const s = nacitaj('beavers:streak') || { posledny: null, pocet: 0 };
  if (s.posledny === datum) return;
  const pocet = s.posledny === posunDen(datum, -1) ? s.pocet + 1 : 1;
  uloz('beavers:streak', { posledny: datum, pocet });
}
/* Every solved day in this browser, newest first. */
function historiaDni() {
  const out = [];
  for (const k of vsetkyKluce('beavers:')) {
    const d = k.slice('beavers:'.length);
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
  historiaEl.innerHTML = '<b>Your ponds:</b> ' + h.length + ' solved' + (urovne ? ' (' + urovne + ')' : '') + (ciste ? ', ' + ciste + ' clean, with no hint and no check' : ', none clean yet')
    + (best ? ', best ' + formatCas(best.sec) + ' on ' + kratkyDatum(best.d) : '') + (priemer ? ', average ' + formatCas(priemer) : '') + '. <a href="/games/beavers/archive/">Archive and full history</a>.';
}

/* ── Saving and solving ───────────────────────────────────────────────── */
/* The Undo history is saved too (ops/spec-beavers.md, part 9), so Undo works
 * after a reload: the last UNDO_ULOZENE boards of each stack as strings of
 * digits, and only while the pond is in play (a solved pond has no Undo). It
 * stays in this browser; the account gets the board without it. */
const UNDO_ULOZENE = 200;
const naRetazec = (a) => a.join('');
function ulozStav() {
  const stav = { v, sec: sekundy, start, done, hints, checks, t: Date.now() };
  if (!done && undoStack.length) stav.u = undoStack.slice(-UNDO_ULOZENE).map(naRetazec);
  if (!done && redoStack.length) stav.r = redoStack.slice(-UNDO_ULOZENE).map(naRetazec);
  uloz(KLUC, stav);
  naplanujOdoslanie();
}
/* A saved board of the history back to an array; null when it does not fit
 * this pond (a tree is always 0, a cell is 0, 1 or 2). */
function zRetazca(s) {
  if (typeof s !== 'string' || s.length !== C || !/^[012]+$/.test(s)) return null;
  return Array.from(s, (ch, i) => (jeStrom[i] ? 0 : +ch));
}

function ukazStav() {
  stavEl.classList.toggle('ok', !!done);
  if (zdielanieEl) zdielanieEl.hidden = !done;   // Share only after the pond is finished
  if (done) {
    const s = sekundy ? ' in ' + formatCas(sekundy) : '';
    const pomoc = [];
    if (hints) pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
    if (checks) pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
    const hn = pomoc.length ? ' with ' + pomoc.join(' and ') : ' without a hint or a check';
    const seria = jeDnes ? (nacitaj('beavers:streak') || {}).pocet || 0 : 0;
    stavEl.innerHTML = '<b>Solved</b>' + s + hn + '. Every tree has its own lodge.'
      + (jeDnes ? ' A new pond arrives at midnight, Bratislava time.' : '')
      + (seria >= 1 ? '<span class="oslava-streak">Day ' + seria + ' of your streak.</span>' : '')
      + '<span class="oslava-dalej"><a href="/games/beavers/practice/">Practice sets</a></span>';
    return;
  }
  const oznacenych = v.some((x) => x);
  if (!oznacenych) { stavEl.textContent = 'Tap a cell for grass, again for a lodge, again to clear it.'; return; }
  // The moment of a finished game, not a live check: the numbers are all met
  // and the pond is still not solved, so say so without any red.
  if (cislaSedia(v, zadanie)) { stavEl.textContent = 'Every number is met, but not every tree has its own lodge yet. Check shows where.'; return; }
  stavEl.textContent = '';
}

/* ── Check, in two steps ──────────────────────────────────────────────── *
 * The first press says how many marks are wrong and roughly where (one row,
 * one column or a band of rows); only the second press marks them. The whole
 * pond is checked: pattern D has no selection to narrow it to. One check is
 * counted per board: the second press only shows what the first one found,
 * and pressing again on the same board repeats the answer without counting
 * it again (the second review, 25. 9.: one check came out as "3 checks").
 * Every move clears the check (zmazOdhalenie), so a new board is a new one. */
/* The rough area: one row, one column, a band of rows no wider than half the
 * pond, or else the rows by name, at most three and "elsewhere" (as Voles),
 * because "in rows 1 to 12" on a twelve by twelve says nothing at all.
 * Returns { kde, zoznam }: zoznam is true for the list of rows. */
function oblast(zle) {
  const rr = [...new Set(zle.map((i) => (i / n) | 0))].sort((a, b) => a - b);
  const cc = [...new Set(zle.map((i) => i % n))];
  if (rr.length === 1) return { kde: 'in row ' + (rr[0] + 1), zoznam: false };
  if (cc.length === 1) return { kde: 'in column ' + (cc[0] + 1), zoznam: false };
  const rmin = rr[0], rmax = rr[rr.length - 1];
  if (rmax - rmin + 1 <= n / 2) return { kde: 'in rows ' + (rmin + 1) + ' to ' + (rmax + 1), zoznam: false };
  const mena = rr.map((r) => String(r + 1));
  return { kde: 'in rows ' + (mena.length > 4 ? mena.slice(0, 3).join(', ') + ' and elsewhere' : zoznamSlov(mena)), zoznam: true };
}
const vetaOznacenych = (k) => 'The marked ' + (k === 1 ? 'cell is not' : 'cells are not') + ' like that in the finished pond. Fix ' + (k === 1 ? 'it' : 'them') + ' and keep going.';
function skontrolujStav() {
  if (done || pauza || !zadanie) return;
  const plocha = v.join('');
  if (checkStav && checkStav.plocha === plocha) {
    // the same board as the check before: its second step, or its answer again
    if (!checkStav.zle.length) { stavEl.textContent = 'Nothing wrong so far.'; return; }
    if (!odhalene) {
      odhalene = true;
      for (const i of checkStav.zle) bunky[i].classList.add('chyba');
      checkBtn.textContent = 'Check';
      track('game_check', { game: 'beavers', wrong: checkStav.zle.length, revealed: true });
    }
    stavEl.textContent = vetaOznacenych(checkStav.zle.length);
    return;
  }
  const p = porovnaj(v, zadanie.solution);
  const zle = p.zleHrady.concat(p.zlaTrava).sort((a, b) => a - b);
  if (!p.hrady && !p.trava) { stavEl.textContent = 'Nothing on the pond yet.'; return; }
  zmazOdhalenie();
  checks++;
  ulozStav();
  checkStav = { plocha, zle };
  if (!zle.length) {
    stavEl.textContent = 'Nothing wrong so far.';
    track('game_check', { game: 'beavers', wrong: 0 });
    return;
  }
  const { kde, zoznam } = oblast(zle);
  stavEl.textContent = (zle.length === 1 ? 'One mark is wrong, ' + kde + '.'
    : zoznam ? zle.length + ' of your marks are wrong, ' + kde + '.'
    : zle.length + ' of your marks are wrong. ' + (zle.length === 2 ? 'Both are ' : 'All ' + zle.length + ' are ') + kde + '.')
    + ' Press Check again to show which.';
  checkBtn.textContent = 'Show';
  track('game_check', { game: 'beavers', wrong: zle.length, revealed: false });
}

/* ── Hint, in two steps ───────────────────────────────────────────────── *
 * The first press says where to look and which technique, without the value,
 * and outlines the object (a tree, a line, a lodge); the second press marks
 * the cells of the step, explains it in full and fills in exactly that one
 * step. With a mistake on the pond the hint goes to the first mistake. Every
 * hint is counted and shown at the end, and it counts on the FIRST press:
 * the sentence alone already says where to look and which technique, so a
 * player who reads it and then makes the move by hand has had help (the
 * second review, 25. 9.: counting only the second press let a pond marked
 * "clean" be solved hint by hint). The second press of the same hint is not
 * counted again. A trial (Sunday) also marks the steps of its chain 1, 2, 3
 * and outlines where the rule breaks, so the sentence can be checked on the
 * pond. */
function ukazNapovedu() {
  if (done || pauza || !zadanie) return;
  if (tip) {
    const t = tip;
    const zmenilo = zmenaStavu(() => {
      for (const i of t.bunky) if (!jeStrom[i]) v[i] = t.hodnota;
      if (nastavenia.autoTrava && t.hodnota === 1) for (const i of t.bunky) doplnTravu(i);
    });
    zmazTip(); zmazOdhalenie();
    track('game_hint', { game: 'beavers', rule: t.pravidlo, layer: t.vrstva, applied: true });
    if (!zmenilo) { ulozStav(); ukazStav(); }
    if (!done) {
      tipKroky = t.bunky.slice();
      for (const i of tipKroky) bunky[i].classList.add('tip');
      if (t.retaz) {
        t.retaz.forEach((x, j) => {
          for (const i of x.bunky) {
            if (jeStrom[i] || !bunky[i]) continue;
            bunky[i].classList.add('tip-retaz');
            bunky[i].firstChild.dataset.krok = String(j + 1);
            tipKroky.push(i);
          }
        });
      }
      if (t.spor) {
        for (const i of t.spor.bunky) if (bunky[i]) bunky[i].classList.add('tip-jednotka');
        if (t.spor.rad >= 0) (t.spor.rad < n ? hlavRiadkov[t.spor.rad] : hlavStlpcov[t.spor.rad - n]).classList.add('tip-jednotka');
      }
      stavEl.textContent = t.text;
    }
    return;
  }
  const h = napoveda(v, zadanie, zadanie.solution);
  if (!h) return;
  zmazTip();
  hints++;
  ulozStav();
  tip = h;
  for (const i of h.obrys || []) bunky[i].classList.add('tip-jednotka');
  if (h.rad >= 0) (h.rad < n ? hlavRiadkov[h.rad] : hlavStlpcov[h.rad - n]).classList.add('tip-jednotka');
  const prvy = (h.obrys && h.obrys.length ? h.obrys : h.bunky)[0];
  zameraj(prvy, false);
  stavEl.textContent = h.kde + ' Press Hint again to see the step.';
  hintBtn.textContent = 'Show step';
  track('game_hint', { game: 'beavers', rule: h.pravidlo, layer: h.vrstva, applied: false });
}

function skontroluj() {
  if (!jeVyriesene(v, zadanie)) return false;
  sekundy = ubehnute();
  done = Date.now();
  start = null;
  zastavTikac();
  nastavNecinnost();
  doska.classList.add('hotovo');
  zmazTip(); zmazOdhalenie();
  oznacSuciatka();
  zivaKontrola();
  ukazCas();
  zapisSeriu();
  ukazSeriu();
  ulozStav();
  ukazHistoriu();
  ukazPasik();
  track('game_solved', { game: 'beavers', day: rezim === 'den' ? datum : sada + '/' + kSada, seconds: sekundy, hints, checks, level: zadanie.uroven });
  const kontajner = document.querySelector('.hra');
  const redukovany = !nastavenia.oslava || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (kontajner) oslava(kontajner, { redukovany });
  // On a wide screen a twelve by twelve is about 640 px tall, so the result,
  // Share and the week strip land under the edge of the window: bring the
  // result into view, scrolling only as far as needed. Only here, at the
  // moment of solving, never when an already solved day loads.
  ukazStav();
  const ciel = zdielanieEl && !zdielanieEl.hidden ? zdielanieEl : stavEl;
  try { requestAnimationFrame(() => ciel.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })); } catch (e) { /* an old browser: the panel is still there below */ }
  return true;
}

/* ── Share ────────────────────────────────────────────────────────────── *
 * A voluntary step after the pond is finished (ops/spec-hry-ux.md, part 8).
 * The text names the pond, the level, the time and the help used, with no
 * cell of the solution in it. The text itself only goes to the clipboard, and
 * when the browser refuses that, into a box to copy; the statistics get the
 * event game_share (copied or not, and the level), nothing of the text. */
function textNaZdielanie() {
  const kto = rezim === 'cvicenie' ? 'Beavers practice ' + sada.replace('-', ' ') + ', pond ' + kSada : 'Beavers, ' + kratkyDatum(datum);
  const odkaz = rezim === 'cvicenie'
    ? 'arling.sk/games/beavers/practice/' + sada + '/' + (kSada > 1 ? kSada + '/' : '')
    : jeDnes ? 'arling.sk/games/beavers' : trvalaAdresaDna('arling.sk/games/beavers/', datum);   // ?d=, so the link still opens after the day's page is gone
  return kto + ', ' + UROVNE[zadanie.uroven].label + ', ' + formatCas(sekundy || 0) + ', '
    + hints + (hints === 1 ? ' hint' : ' hints') + ', ' + checks + (checks === 1 ? ' check' : ' checks') + ', ' + odkaz;
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
    ? 'Copied. It says nothing about the cells, and the text went only to your clipboard.'
    : 'This browser would not let the page copy for you. Here is the text, take it from the box.';
  if (zdielanieText) {
    zdielanieText.value = text;
    zdielanieText.hidden = ok;
    if (!ok) { zdielanieText.focus(); zdielanieText.select(); }
  }
  track('game_share', { game: 'beavers', copied: ok, level: zadanie.uroven });
});

/* ── Moves ────────────────────────────────────────────────────────────── *
 * Every change to the board goes through zmenaStavu: it keeps the whole board
 * before, so Undo and Redo are one shared stack with no limit and Clear is
 * undone by a single Undo (ops/spec-hry-ux.md, part 3). A drag over many
 * cells, with the grass Auto grass adds, is one entry: davka collects the
 * board as it was when the stroke began and the end of the stroke files it. */
let davka = null;
/* A button that would do nothing looks it: after the pond is solved and while
 * it is paused every button waits, and Clear also on an empty pond. */
function ukazTlacidla() {
  const stoji = !!done || pauza || !zadanie;
  if (spatBtn) spatBtn.disabled = stoji || !undoStack.length;
  if (znovaBtn) znovaBtn.disabled = stoji || !redoStack.length;
  if (resetBtn) resetBtn.disabled = stoji || !v || v.every((x) => !x);
  if (hintBtn) hintBtn.disabled = stoji;
  if (checkBtn) checkBtn.disabled = stoji;
}
function rovnake(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function zmenaStavu(fn) {
  if (done || pauza) return false;
  const pred = v.slice();
  fn();
  if (rovnake(v, pred)) return false;
  if (davka) { if (!davka.pred) davka.pred = pred; }
  else undoStack.push(pred);
  redoStack.length = 0;
  poTahu();
  return true;
}
function poTahu() {
  if (!start) { start = Date.now(); spustiTikac(); }
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) ulozStav();
  ukazStav();
  ukazCas();
  ukazTlacidla();
  nastavNecinnost();
}
/* Auto grass around a lodge just placed (a setting, off by default). */
function doplnTravu(i) {
  for (const x of autoTrava(v, zadanie, i)) v[x] = 2;
}
function nastav(i, hodnota) {
  if (done || pauza || i < 0 || jeStrom[i]) return;
  if (v[i] === hodnota) return;
  zmenaStavu(() => {
    v[i] = hodnota;
    if (hodnota === 1 && nastavenia.autoTrava) doplnTravu(i);
  });
}
/* One tap takes the cell through grass, a lodge and back to empty; grass
 * comes first because it is the mark used most (about six cells in ten). */
const DALSI = [2, 0, 1];     // empty -> grass -> lodge -> empty
const PREDOSLY = [1, 2, 0];  // empty -> lodge -> grass -> empty
function prepni(i, spat) {
  if (jeStrom[i]) return;
  nastav(i, (spat ? PREDOSLY : DALSI)[v[i] || 0]);
}

function spatKrok() {
  if (done || pauza || !undoStack.length) return;
  redoStack.push(v.slice());
  v = undoStack.pop();
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) ulozStav();
  ukazStav();
  ukazTlacidla();
}
function znova() {
  if (done || pauza || !redoStack.length) return;
  undoStack.push(v.slice());
  v = redoStack.pop();
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) ulozStav();
  ukazStav();
  ukazTlacidla();
}
/* Clear: an empty pond, the trees stay, the clock keeps running (Andrej,
 * 10. 9.: clearing is a move, not a restart). One Undo brings it all back. */
function reset() {
  if (done || pauza) return;
  if (v.every((x) => !x)) return;
  if (nastavenia.potvrditReset && !window.confirm('Clear the whole pond? The trees stay, the clock keeps running and one Undo brings your marks back.')) return;
  zmenaStavu(() => { v = new Array(C).fill(0); });
}

/* ── Pointer ──────────────────────────────────────────────────────────── *
 * A tap moves the cell one step around the cycle; right click or Shift and
 * click one step back (a shortcut only, never the only way). A drag starts
 * after 8 px and sweeps the mark the first cell got onto empty cells only:
 * it never changes a cell that carries another mark, never a tree. A stroke
 * that started by clearing a mark clears that same kind of mark on its way. */
function bunkaPod(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const b = el && el.closest ? el.closest('.b') : null;
  return b && doska.contains(b) ? +b.dataset.i : -1;
}
let tah = null; // { start, maloval, hodnota, povodna, id, x, y }
function zrusTah(vratit) {
  if (!tah) return;
  const t = tah;
  tah = null;
  try { doska.releasePointerCapture(t.id); } catch (err) { /* nothing */ }
  if (vratit && davka && davka.pred) {
    v = davka.pred;
    davka = null;
    ukazVsetko();
    ulozStav();
    ukazStav();
    ukazTlacidla();
    return;
  }
  // The stroke's Undo entry is filed only now, after its last save: save
  // again so a reload keeps it.
  if (davka && davka.pred) { undoStack.push(davka.pred); redoStack.length = 0; if (!done) ulozStav(); ukazTlacidla(); }
  davka = null;
}
doska.addEventListener('contextmenu', (e) => { if (e.target && e.target.closest && e.target.closest('.b')) e.preventDefault(); });
doska.addEventListener('pointerdown', (e) => {
  if (done || pauza || !zadanie) return;
  const i = bunkaPod(e);
  if (i < 0) return;
  // A tap moves the roving tabindex only, like Magpies: focusing the cell
  // left an orange frame on the last tapped lodge, which after the solve
  // looked like a mark on a wrong one (the review, 26. 9.). Only when a cell
  // already has the focus (a keyboard player clicking) does the focus follow.
  zameraj(i, doska.contains(document.activeElement));
  if (jeStrom[i]) return;
  if (e.pointerType === 'mouse' && e.button === 2) { prepni(i, true); e.preventDefault(); return; }
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (e.shiftKey) { prepni(i, true); e.preventDefault(); return; }
  tah = { start: i, maloval: false, hodnota: DALSI[v[i] || 0], povodna: v[i] || 0, id: e.pointerId, x: e.clientX, y: e.clientY };
  davka = { pred: null };
  try { doska.setPointerCapture(e.pointerId); } catch (err) { /* works without capture too, less smoothly */ }
  e.preventDefault();
});
doska.addEventListener('pointermove', (e) => {
  if (!tah || tah.id !== e.pointerId || done || pauza) return;
  if (!tah.maloval && Math.hypot(e.clientX - tah.x, e.clientY - tah.y) < 8) return;
  const i = bunkaPod(e);
  if (i < 0) return;
  if (!tah.maloval) {
    if (i === tah.start) return;
    tah.maloval = true;
    nastav(tah.start, tah.hodnota);
  }
  if (jeStrom[i] || i === tah.start) return;
  if (tah.hodnota !== 0 && v[i] === 0) nastav(i, tah.hodnota);
  else if (tah.hodnota === 0 && tah.povodna && v[i] === tah.povodna) nastav(i, 0);
});
function koniecTahu(e) {
  if (!tah || tah.id !== e.pointerId) return;
  const t = tah;
  if (!t.maloval) prepni(t.start, false);
  zrusTah(false);
}
doska.addEventListener('pointerup', koniecTahu);
doska.addEventListener('pointercancel', (e) => { if (tah && tah.id === e.pointerId) zrusTah(false); });

/* ── Keyboard ─────────────────────────────────────────────────────────── */
function zameraj(i, fokus) {
  if (i < 0 || !bunky[i]) return;
  if (bunky[kurzor]) bunky[kurzor].tabIndex = -1;
  kurzor = i;
  bunky[i].tabIndex = 0;
  if (fokus) bunky[i].focus({ preventScroll: true });
}
doska.addEventListener('focusin', (e) => {
  const b = e.target && e.target.closest ? e.target.closest('.b') : null;
  if (!b) return;
  const i = +b.dataset.i;
  if (i !== kurzor) zameraj(i, false);
});
doska.addEventListener('keydown', (e) => {
  if (done || pauza || !zadanie) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  // The cell the key came from, not only the remembered cursor: a window
  // without system focus never sends focusin, and then kurzor would lag.
  const zdroj = e.target && e.target.closest ? e.target.closest('.b') : null;
  if (zdroj && doska.contains(zdroj) && +zdroj.dataset.i !== kurzor) zameraj(+zdroj.dataset.i, false);
  const i = kurzor;
  const r = (i / n) | 0, c = i % n;
  let ciel = -1;
  switch (e.key) {
    case 'ArrowUp': ciel = ((r + n - 1) % n) * n + c; break;
    case 'ArrowDown': ciel = ((r + 1) % n) * n + c; break;
    case 'ArrowLeft': ciel = r * n + (c + n - 1) % n; break;
    case 'ArrowRight': ciel = r * n + (c + 1) % n; break;
    case 'Home': ciel = r * n; break;
    case 'End': ciel = r * n + n - 1; break;
    case ' ': case 'Enter': prepni(i, false); e.preventDefault(); return;
    case 'x': case 'X': nastav(i, 2); e.preventDefault(); return;
    case 'b': case 'B': nastav(i, 1); e.preventDefault(); return;
    case 'Delete': case 'Backspace': nastav(i, 0); e.preventDefault(); return;
    default: return;
  }
  e.preventDefault();
  if (ciel >= 0) zameraj(ciel, true);
});
if (spatBtn) spatBtn.addEventListener('click', spatKrok);
if (znovaBtn) znovaBtn.addEventListener('click', znova);
if (resetBtn) resetBtn.addEventListener('click', reset);
if (checkBtn) checkBtn.addEventListener('click', skontrolujStav);
if (hintBtn) hintBtn.addEventListener('click', ukazNapovedu);
if (pauzaBtn) pauzaBtn.addEventListener('click', () => pozastav(false));
if (pokracujBtn) pokracujBtn.addEventListener('click', pokracuj);
/* Undo and Redo: U and Ctrl+Z back, R and Ctrl+Shift+Z forward. Ctrl+R is
 * left to the browser: it reloads the page, and a game must not take that. */
document.addEventListener('keydown', (e) => {
  if (e.target && /input|textarea|select/i.test(e.target.tagName || '')) return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && (e.key === 'z' || e.key === 'Z')) { if (e.shiftKey) znova(); else spatKrok(); e.preventDefault(); return; }
  if (ctrl || e.altKey) return;
  if (e.defaultPrevented) return;
  if (e.key === 'Escape') {
    if (tah) { zrusTah(true); e.preventDefault(); return; }
    if (pauza) { pokracuj(); return; }
    return;
  }
  if (e.key === 'u' || e.key === 'U') { spatKrok(); e.preventDefault(); return; }
  if (e.key === 'r' || e.key === 'R') { znova(); e.preventDefault(); return; }
  if (e.key === 'p' || e.key === 'P') { if (pauza) pokracuj(); else pozastav(false); }
});
document.addEventListener('keydown', nastavNecinnost, true);
document.addEventListener('pointerdown', nastavNecinnost, true);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (nastavenia.pauzaPriOdchode && start && !done) pozastav(true); }
  else ukazCas();
});

/* ── The week strip ───────────────────────────────────────────────────── */
function ukazPasik() {
  if (!pasik) return;
  pasik.textContent = '';
  if (rezim === 'cvicenie') {
    const s = SADY.find((x) => x.id === sada);
    for (let k = 1; k <= s.pocet; k++) {
      const st = nacitaj('beavers:p:' + sada + ':' + k);
      const a = document.createElement(k === kSada ? 'span' : 'a');
      a.className = 'den' + (k === kSada ? ' dnes' : '') + (st && st.done ? ' hotove' : st && st.v && st.v.some((x) => x) ? ' rozohrane' : '');
      if (k !== kSada) a.href = '/games/beavers/practice/' + sada + '/' + (k === 1 ? '' : k + '/');
      a.innerHTML = '<small>No.</small><b>' + k + '</b>';
      a.setAttribute('aria-label', 'Pond ' + k + (st && st.done ? ', solved' : ''));
      if (k === kSada) a.setAttribute('aria-current', 'page');
      pasik.appendChild(a);
    }
    return;
  }
  tyzden(datum).forEach((d, k) => {
    const st = nacitaj('beavers:' + d);
    const buduci = d > dnes, pred = d < PRVY_DEN;
    const tag = d === datum || buduci || pred ? 'span' : 'a';
    const a = document.createElement(tag);
    a.className = 'den' + (d === datum ? ' dnes' : '') + (buduci || pred ? ' buduci' : '') + (st && st.done ? ' hotove' : st && st.v && st.v.some((x) => x) ? ' rozohrane' : '');
    if (tag === 'a') a.href = adresaDna('/games/beavers/', d, dnes);
    a.innerHTML = '<small>' + DNI[k] + '</small><b>' + Number(d.slice(8)) + '</b>';
    a.title = pekneDatum(d) + ', ' + UROVNE[urovenDna(d)].label + (buduci ? ' (not yet)' : '');
    a.setAttribute('aria-label', a.title + (st && st.done ? ', solved' : ''));
    if (d === datum) a.setAttribute('aria-current', 'page');
    pasik.appendChild(a);
  });
}

/* ── Settings panel ───────────────────────────────────────────────────── */
const casBlok = $('cas-blok');
function pouziNastavenia() {
  if (casBlok) casBlok.hidden = !nastavenia.casovac;
  if (zadanie) { oznacSuciatka(); zivaKontrola(); }
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
    track('game_setting', { game: 'beavers', setting: kluc, on: el.checked });
  });
});

/* ── Account sync (only when signed in, silent otherwise) ────────────────
 * The account stores one object per game: { dni: { 'YYYY-MM-DD': stav }, t }.
 * On merge, for each day the record with the higher `t` wins, but a `done` on
 * either side is never dropped. The streak is then rebuilt from the merged
 * solved days instead of trusted as a stored number. */
function stavVsetkychDni() {
  const out = {};
  for (const k of vsetkyKluce('beavers:')) {
    const d = k.slice('beavers:'.length);
    if (!isValidDate(d)) continue;
    const s = nacitaj(k);
    if (s) out[d] = s;
  }
  return out;
}
function zlucStavDna(lokalny, vzdialeny) {
  if (!vzdialeny) return lokalny;
  if (!lokalny) return vzdialeny;
  let x = (vzdialeny.t || 0) >= (lokalny.t || 0) ? vzdialeny : lokalny;
  const hotovo = lokalny.done || vzdialeny.done || null;
  if (hotovo && !x.done) x = Object.assign({}, x, { done: hotovo });
  // The Undo history never goes to the account: keep this browser's own while
  // the account holds the very same board.
  if (x !== lokalny && !x.done && (lokalny.u || lokalny.r) && JSON.stringify(x.v) === JSON.stringify(lokalny.v)) {
    x = Object.assign({}, x, { u: lokalny.u, r: lokalny.r });
  }
  return x;
}
/* What goes to the account: every day without its Undo history. */
function bezHistorie(dni) {
  const out = {};
  for (const [d, s] of Object.entries(dni)) {
    const kopia = Object.assign({}, s);
    delete kopia.u; delete kopia.r;
    out[d] = kopia;
  }
  return out;
}
function prepocitajSeriu() {
  const dni = stavVsetkychDni();
  let d = dni[dnes] && dni[dnes].done ? dnes : posunDen(dnes, -1);
  let pocet = 0;
  while (dni[d] && dni[d].done) { pocet++; d = posunDen(d, -1); }
  if (!pocet) { try { localStorage.removeItem('beavers:streak'); } catch (e) { /* nič */ } return; }
  uloz('beavers:streak', { posledny: dni[dnes] && dni[dnes].done ? dnes : posunDen(dnes, -1), pocet });
}
function odosliStav() {
  if (!ucet.prihlaseny()) return;
  ucet.hra.uloz('beavers', { dni: bezHistorie(stavVsetkychDni()), t: Date.now() }).catch(() => { /* sieťová chyba: lokálne ostáva pravdou */ });
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
  try { vzdialene = await ucet.hra.nacitaj('beavers'); } catch (e) { return; /* sieťová chyba: lokálne ostáva pravdou */ }
  const diaDni = vzdialene && vzdialene.dni && typeof vzdialene.dni === 'object' ? vzdialene.dni : {};
  let zmenene = false;
  for (const [d, r] of Object.entries(diaDni)) {
    if (!isValidDate(d) || !r || typeof r !== 'object') continue;
    const kluc = 'beavers:' + d;
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
      if (cerstve && Array.isArray(cerstve.v) && n && cerstve.v.length === C && (cerstve.t || 0) > ((ulozene && ulozene.t) || 0)) {
        ulozene = cerstve;
        v = cerstve.v.map((x, i) => (jeStrom[i] ? 0 : x === 1 || x === 2 ? x : 0));
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
  // push back too: a day solved only in this browser reaches the account right away
  odosliStav();
}

/* ── Start ────────────────────────────────────────────────────────────── */
async function spusti() {
  if (jeBuduci) {
    datumEl.textContent = pekneDatum(datum);
    stavEl.textContent = 'This pond opens on ' + pekneDatum(datum) + ' (Bratislava time). Come back then, or play today’s pond.';
    doska.hidden = true;
    for (const b of [spatBtn, znovaBtn, resetBtn, checkBtn, hintBtn]) if (b) b.disabled = true;
    ukazPasik();
    return;
  }
  try {
    zadanie = await nacitajZadanie();
  } catch (e) {
    stavEl.textContent = 'The pond could not be prepared. Please reload the page.';
    throw e;
  }
  n = zadanie.n;
  C = n * n;
  jeStrom = new Uint8Array(C);
  for (const t of zadanie.trees) jeStrom[t] = 1;
  ulozene = nacitaj(KLUC);
  v = (ulozene && Array.isArray(ulozene.v) && ulozene.v.length === C)
    ? ulozene.v.map((x, i) => (jeStrom[i] ? 0 : x === 1 || x === 2 ? x : 0))
    : new Array(C).fill(0);
  done = ulozene && ulozene.done ? ulozene.done : null;
  hints = ulozene && ulozene.hints ? ulozene.hints : 0;
  checks = ulozene && ulozene.checks ? ulozene.checks : 0;
  sekundy = ulozene && ulozene.sec ? ulozene.sec : 0;
  // Undo and Redo pick up where they were before the reload.
  undoStack = !done && ulozene && Array.isArray(ulozene.u) ? ulozene.u.map(zRetazca).filter(Boolean) : [];
  redoStack = !done && ulozene && Array.isArray(ulozene.r) ? ulozene.r.map(zRetazca).filter(Boolean) : [];
  start = null;
  if (ulozene && ulozene.start && !done) {
    // The page was closed while the clock ran: count up to the last save,
    // then wait paused.
    const koniec = ulozene.t || ulozene.start;
    sekundy += Math.max(0, Math.floor((koniec - ulozene.start) / 1000));
  }
  postavMriezku();
  ukazVsetko();
  pouziNastavenia();
  if (datumEl) datumEl.textContent = rezim === 'cvicenie' ? UROVNE[zadanie.uroven].label + ' practice ' + sada.split('-')[1] + ', pond ' + kSada : pekneDatum(datum);
  if (urovenEl) urovenEl.textContent = UROVNE[zadanie.uroven].label + ' · ' + n + '×' + n;
  if (done) doska.classList.add('hotovo');
  else if (v.some((x) => x)) pozastav(true);
  ukazCas();
  ukazSeriu();
  ukazHistoriu();
  ukazPasik();
  ukazStav();
  ukazTlacidla();
}
spusti().then(synchronizujUcet);
