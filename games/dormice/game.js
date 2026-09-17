import '../kniha.mjs?v=1';
/* Dormice: the game page. One script for the daily copse, the archive days
 * and the practice sets; the page says which one it is:
 *
 *   <body data-den="YYYY-MM-DD">          an archive day (built page)
 *   <body data-sada="easy-1" data-k="3">  a practice puzzle
 *   nothing                               today's copse (or ?d=YYYY-MM-DD)
 *
 * The puzzle itself comes, in this order: from <script type="application/json"
 * id="zadanie"> embedded in a built page; from dni/YYYY-MM.json for the day;
 * or, when both are missing, built right here from the date. All three give
 * the same puzzle for the same date (plan.mjs, generator.mjs).
 *
 * The board is one N by N array of marks per small table, keyed 'a,b' with
 * a < b over the category indices, and a square holds 0 for empty, 1 for a
 * tick and -1 for a cross (logika.mjs). Two deliberate departures from
 * ops/spec-hry-ux.md, both written down in ops/spec-hra-detektiv.md part 5
 * and settled by Andrej:
 *   1. the tap cycle is empty, cross, tick, empty, so the cross comes first:
 *      at four categories of four there are 24 ticks and 72 crosses, so
 *      starting with the tick would cost 72 extra taps a puzzle;
 *   2. Auto cross is ON by default, because filling the rest of a row and a
 *      column in after a tick is bookkeeping without a decision. Carry across
 *      stays OFF whatever happens, since that one is a deduction the player
 *      has not seen.
 *
 * Stored in localStorage (all in try/catch, private windows throw):
 *   dormice:YYYY-MM-DD       { v, ind, sec, start, done, hints, checks, t }
 *   dormice:p:<set>:<k>      the same for a practice puzzle
 *   dormice:streak           { posledny: YYYY-MM-DD, pocet }
 *   dormice:settings         the settings panel
 * v = the marks, one array per table; ind = which clues you struck out.
 * Outgoing events via window.umami, if it runs: game_solved, game_check,
 * game_hint, game_setting, game_share. Nothing else leaves the browser,
 * unless the player is signed in (arling.sk account, /style/ucet.js): then
 * every save is also pushed to the account (throttled, 2s) and pulled back on
 * load, so the streak and history follow across devices.
 */
import { zadaniePreDen, zadanieCvicenie, rozbal, tyzden, denVTyzdni, urovenDna, posunDen, pekneDatum, kratkyDatum, UROVNE, SADY, PRVY_DEN, DNI } from './plan.mjs';
import { todayBratislava, isValidDate, textIndicie, vetaRozuzlenia, polozka } from './generator.mjs';
import { tabulky, klucTabulky, prazdnaPlocha, jeVyriesene, porovnaj, napoveda, autoKriz, carryAcross } from './logika.mjs';
import { plochaHTML, pocetPolicok, legendaHTML, indicieHTML, otazkaText } from './plocha.mjs';
import * as ucet from '/style/ucet.js';
import { oslava } from '../oslava.js';

const $ = (id) => document.getElementById(id);
const doska = $('doska');
const stavEl = $('stav');
const rozuzlenieEl = $('rozuzlenie');
const casEl = $('cas');
const datumEl = $('datum');
const seriaEl = $('seria');
const spatBtn = $('spat');
const vpredBtn = $('vpred');
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
const legendaEl = $('legenda');
const indicieEl = $('indicie-zoznam');
const indicieBox = $('indicie');
const viacBtn = $('indicie-viac');
const otazkaEl = $('otazka');
const citacEl = $('citac');
const citacText = $('citac-text');
const citacPocet = $('citac-pocet');
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
/* Has anything been marked? Used by the week strip, the archive and the
   account merge, where a saved board is a plain object of arrays. */
function maZnacky(st) {
  if (!st || !st.v || typeof st.v !== 'object') return false;
  for (const k of Object.keys(st.v)) if (Array.isArray(st.v[k]) && st.v[k].some((x) => x)) return true;
  return !!(st.ind && st.ind.some((x) => x));
}

/* ── Settings ─────────────────────────────────────────────────────────── */
const NASTAVENIA_KLUC = 'dormice:settings';
// No live judging: nothing turns red while you play; Check is the only judge.
// autoKriz ON is the written deviation from ops/spec-hry-ux.md part 2.
const NASTAVENIA_PREDVOLENE = {
  autoKriz: true, carryAcross: false, zvyraznenie: true, preskrtnutie: true,
  casovac: true, potvrditReset: true, pauzaPriOdchode: true, oslava: true,
};
let nastavenia = Object.assign({}, NASTAVENIA_PREDVOLENE, nacitaj(NASTAVENIA_KLUC) || {});
function ulozNastavenia() { uloz(NASTAVENIA_KLUC, nastavenia); }

/* ── Which puzzle ─────────────────────────────────────────────────────── */
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
const KLUC = rezim === 'cvicenie' ? 'dormice:p:' + sada + ':' + kSada : 'dormice:' + datum;
// The root address always opens today's copse; once the date is settled,
// rewrite it to today's built page so the address bar and a shared link point
// at the day itself.
if (rezim === 'den' && !body.dataset.den && jeDnes && !location.search) {
  try { history.replaceState(null, '', '/games/dormice/' + datum + '/'); } catch (e) { /* the address stays generic; the game still works */ }
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

/* ── Loading the puzzle ───────────────────────────────────────────────── */
function vlozene() {
  const el = $('zadanie');
  if (!el) return null;
  try { return rozbal(JSON.parse(el.textContent)); } catch (e) { return null; }
}
async function zTabulky(iso) {
  try {
    const r = await fetch('/games/dormice/dni/' + iso.slice(0, 7) + '.json', { cache: 'no-cache' });
    if (!r.ok) return null;
    const t = await r.json();
    const z = Array.isArray(t) ? t.find((x) => x.d === iso) : null;
    return z ? rozbal(z) : null;
  } catch (e) { return null; }
}
async function nacitajZadanie() {
  const v = vlozene();
  if (v) return v;
  if (rezim === 'cvicenie') return zadanieCvicenie(sada, kSada);
  return (await zTabulky(datum)) || zadaniePreDen(datum);
}

/* ── State ────────────────────────────────────────────────────────────── */
let zadanie, N, K, plocha, vety, preskrtnute;
let start, done, sekundy, hints, checks, ulozene;
const historia = [];   // one chronological stack for marks, strikes and automatics
const buducnost = [];  // what Undo took back, for Redo
let fokus = 0;
let tikac = null;
let pauza = false;
let tip = null;          // the hint on screen, cleared by the next move
let odhalene = false;    // Check's second step is showing the wrong ticks
let checkStav = null;    // what the last Check saw, so the second press can reveal it
let vybranaPolozka = null; // [category, index] highlighted across every table
let citacI = 0;          // which clue the one line reader is on
const bunky = [];
let mriezka = [];        // [row][col] -> button or null, for the arrow keys

/* ── Drawing ──────────────────────────────────────────────────────────── */
const NAZVY_ZNACIEK = { '-1': 'cross', 0: 'empty', 1: 'tick' };
function hodnota(t, r, c) { return plocha[t][r * N + c]; }
/* t:r:c -> the button, built once, because Undo, Check and Hint all need to
   find a square by its place in a table rather than by its tab order. */
const mapaBuniek = new Map();
function bunkaZa(t, r, c) { return mapaBuniek.get(t + ':' + r + ':' + c) || null; }

function postavPlochu() {
  doska.style.setProperty('--stlpcov', (K - 1) * N);
  doska.setAttribute('aria-label', 'Logic grid, ' + K + ' categories of ' + N + ' items');
  if (doska.querySelectorAll('.b').length !== pocetPolicok(zadanie)) doska.innerHTML = plochaHTML(zadanie);
  bunky.length = 0;
  doska.querySelectorAll('.b').forEach((b) => {
    b.type = 'button';
    b.setAttribute('role', 'gridcell');
    bunky[+b.dataset.i] = b;
  });
  const sirka = (K - 1) * N;
  mriezka = Array.from({ length: sirka }, () => new Array(sirka).fill(null));
  for (const b of bunky) mriezka[+b.dataset.rr][+b.dataset.cc] = b;
  mapaBuniek.clear();
  for (const b of bunky) mapaBuniek.set(b.dataset.t + ':' + b.dataset.r + ':' + b.dataset.c, b);
  bunky.forEach((b, i) => { b.tabIndex = i === 0 ? 0 : -1; });
  fokus = 0;
  legendaEl.innerHTML = legendaHTML(zadanie);
  indicieEl.innerHTML = indicieHTML(zadanie, vety);
  otazkaEl.innerHTML = '<b>The question.</b> ' + otazkaText(zadanie);
  if (citacEl) citacEl.hidden = !vety.length;
  ukazViac();
}

function ukazBunku(b) {
  const t = b.dataset.t, r = +b.dataset.r, c = +b.dataset.c;
  const v = hodnota(t, r, c);
  b.dataset.v = v;
  b.setAttribute('aria-label', polozka(zadanie, +b.dataset.ra, +b.dataset.rx) + ', '
    + polozka(zadanie, +b.dataset.ca, +b.dataset.cy) + ', ' + NAZVY_ZNACIEK[v]);
}
function ukazVsetko() { for (const b of bunky) ukazBunku(b); ukazIndicie(); ukazCitac(); }

function zmazTip() {
  if (!tip) return;
  tip = null;
  for (const b of bunky) b.classList.remove('tip');
  indicieEl.querySelectorAll('li').forEach((li) => li.classList.remove('tip-veta'));
  if (hintBtn) hintBtn.textContent = 'Hint';
}
function zmazOdhalenie() {
  if (!odhalene && !checkStav) return;
  odhalene = false; checkStav = null;
  for (const b of bunky) b.classList.remove('chyba');
  if (checkBtn) checkBtn.textContent = 'Check';
}

/* ── Highlighting one item everywhere it appears ──────────────────────── */
function ukazVyber() {
  const on = nastavenia.zvyraznenie && vybranaPolozka;
  for (const b of bunky) {
    const patri = on && ((+b.dataset.ra === vybranaPolozka[0] && +b.dataset.rx === vybranaPolozka[1])
      || (+b.dataset.ca === vybranaPolozka[0] && +b.dataset.cy === vybranaPolozka[1]));
    b.classList.toggle('riadok-svit', !!patri);
  }
  doska.querySelectorAll('.h[data-a]').forEach((h) => {
    h.classList.toggle('vybrane', !!(on && +h.dataset.a === vybranaPolozka[0] && +h.dataset.x === vybranaPolozka[1]));
  });
  legendaEl.querySelectorAll('.pol').forEach((el) => {
    el.classList.toggle('vybrane', !!(on && +el.dataset.a === vybranaPolozka[0] && +el.dataset.x === vybranaPolozka[1]));
  });
}
function vyberPolozku(a, x) {
  if (vybranaPolozka && vybranaPolozka[0] === a && vybranaPolozka[1] === x) vybranaPolozka = null;
  else vybranaPolozka = [a, x];
  ukazVyber();
}

/* ── The clues ────────────────────────────────────────────────────────── *
 * The whole list is on the page, because the way a person solves one of
 * these is to run down every clue looking for the one they can use now, so a
 * one line reader alone would make that scan dearer. The reader under the
 * board is there for the phone, where the list is a scroll away. */
function polozkyIndicie(cl) {
  const out = cl.it.map(([a, i]) => [a, i]);
  if (cl.t === 'E') { for (let y = 0; y < N; y++) if (cl.s & (1 << y)) out.push([cl.c, y]); }
  return out;
}
function ukazVetuVPloche(i) {
  doska.querySelectorAll('.h[data-a]').forEach((h) => h.classList.remove('veta-svit'));
  if (i < 0 || !zadanie.clues[i]) return;
  for (const [a, x] of polozkyIndicie(zadanie.clues[i])) {
    doska.querySelectorAll('.h[data-a="' + a + '"][data-x="' + x + '"]').forEach((h) => h.classList.add('veta-svit'));
  }
}
function ukazIndicie() {
  let citana = null;
  indicieEl.querySelectorAll('li').forEach((li) => {
    const i = +li.dataset.i;
    const b = li.querySelector('.veta');
    if (b) b.setAttribute('aria-pressed', preskrtnute[i] ? 'true' : 'false');
    li.classList.toggle('citana', i === citacI);
    if (i === citacI) citana = li;
  });
  dorolujNaVetu(citana);
}
/* On a phone the list is a three line block that scrolls (see the note in the
   page CSS), so the sentence the reader under the board is showing has to be
   brought into that block. Only the block scrolls, never the page: the board
   must not move under the player's thumb. */
function dorolujNaVetu(li) {
  if (!li || indicieEl.scrollHeight <= indicieEl.clientHeight + 1) return;
  const ram = indicieEl.getBoundingClientRect();
  const veta = li.getBoundingClientRect();
  if (veta.top < ram.top) indicieEl.scrollTop += veta.top - ram.top;
  else if (veta.bottom > ram.bottom) indicieEl.scrollTop += veta.bottom - ram.bottom;
}
function ukazCitac() {
  if (!citacEl || !vety.length) return;
  citacI = Math.max(0, Math.min(citacI, vety.length - 1));
  citacText.textContent = vety[citacI];
  citacPocet.textContent = (citacI + 1) + ' / ' + vety.length;
  citacEl.classList.toggle('hotova', !!preskrtnute[citacI]);
  ukazIndicie();
  ukazVetuVPloche(citacI);
}
function preskrtni(i) {
  if (!nastavenia.preskrtnutie || done || pauza) { citacI = i; ukazCitac(); return; }
  zapisTah({ bunky: [], indicie: [{ i, pred: preskrtnute[i] ? 1 : 0, po: preskrtnute[i] ? 0 : 1 }] });
  citacI = i;
  ukazCitac();
}

/* ── Moves, Undo and Redo ─────────────────────────────────────────────── *
 * One chronological stack for marks, struck clues and the automatics, which
 * go in as part of the move that caused them, so a tick and the crosses it
 * brought with it come back in a single Undo. */
function pouziTah(zmena, dopredu) {
  for (const b of zmena.bunky) {
    plocha[b.t][b.r * N + b.c] = dopredu ? b.po : b.pred;
  }
  for (const c of zmena.indicie || []) preskrtnute[c.i] = dopredu ? c.po : c.pred;
  for (const b of zmena.bunky) { const el = bunkaZa(b.t, b.r, b.c); if (el) ukazBunku(el); }
  ukazIndicie();
  ukazCitac();
}
function zapisTah(zmena) {
  if (!zmena.bunky.length && !(zmena.indicie && zmena.indicie.length)) return false;
  pouziTah(zmena, true);
  historia.push(zmena);
  buducnost.length = 0;
  if (!start && !done) { start = Date.now(); spustiTikac(); }
  zmazTip(); zmazOdhalenie();
  if (!skontroluj()) ulozStav();
  ukazStav();
  ukazCas();
  ukazTlacidla();
  return true;
}
function ukazTlacidla() {
  if (spatBtn) spatBtn.disabled = historia.length === 0;
  if (vpredBtn) vpredBtn.disabled = buducnost.length === 0;
}
function spat() {
  if (done || pauza || !historia.length) return;
  const z = historia.pop();
  pouziTah(z, false);
  buducnost.push(z);
  zmazTip(); zmazOdhalenie();
  ulozStav(); ukazStav(); ukazTlacidla();
}
function vpred() {
  if (done || pauza || !buducnost.length) return;
  const z = buducnost.pop();
  pouziTah(z, true);
  historia.push(z);
  zmazTip(); zmazOdhalenie();
  ulozStav(); ukazStav(); ukazTlacidla();
}

/* The next state of a square. The cross comes first on purpose: there are
   N-1 crosses for every tick, so a cycle that started with the tick would
   cost dozens of extra taps a puzzle. */
function dalsia(v) { return v === 0 ? -1 : v === -1 ? 1 : 0; }

/* One move, with whatever the automatics add to it, as a single step. */
function zmenaPreBunku(t, r, c, novaH) {
  const stara = hodnota(t, r, c);
  if (stara === novaH) return { bunky: [] };
  const zmeny = [{ t, r, c, pred: stara, po: novaH }];
  if (novaH === 1) {
    const [a, b] = t.split(',').map(Number);
    // The automatics read the board as it will be, so apply the tick first
    // and take it back before the change list is handed on.
    plocha[t][r * N + c] = 1;
    const doplnky = [];
    if (nastavenia.autoKriz) doplnky.push(...autoKriz(plocha, zadanie, a, b, r, c));
    if (nastavenia.carryAcross) doplnky.push(...carryAcross(plocha, zadanie, a, b, r, c));
    plocha[t][r * N + c] = stara;
    const videne = new Set([t + ':' + r + ':' + c]);
    for (const d of doplnky) {
      const kt = klucTabulky(d.tab[0], d.tab[1]);
      const kluc = kt + ':' + d.r + ':' + d.c;
      if (videne.has(kluc)) continue;
      const pred = hodnota(kt, d.r, d.c);
      if (pred === d.val) continue;
      videne.add(kluc);
      zmeny.push({ t: kt, r: d.r, c: d.c, pred, po: d.val });
    }
  }
  return { bunky: zmeny, indicie: [] };
}
function tah(b, novaH) {
  if (done || pauza) return;
  zapisTah(zmenaPreBunku(b.dataset.t, +b.dataset.r, +b.dataset.c, novaH));
}
function prepni(b) { tah(b, dalsia(hodnota(b.dataset.t, +b.dataset.r, +b.dataset.c))); }

/* Clear: an empty board, the clock keeps running, and one Undo brings it all
   back, struck clues included. */
function reset() {
  if (done || pauza) return;
  const zmeny = [];
  for (const b of bunky) {
    const v = hodnota(b.dataset.t, +b.dataset.r, +b.dataset.c);
    if (v !== 0) zmeny.push({ t: b.dataset.t, r: +b.dataset.r, c: +b.dataset.c, pred: v, po: 0 });
  }
  const ind = [];
  for (let i = 0; i < preskrtnute.length; i++) if (preskrtnute[i]) ind.push({ i, pred: 1, po: 0 });
  if (!zmeny.length && !ind.length) return;
  if (nastavenia.potvrditReset && !window.confirm('Clear the whole grid? The clock keeps running, and one Undo brings it back.')) return;
  zapisTah({ bunky: zmeny, indicie: ind });
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
function pozastav(auto) {
  if (done || pauza) return;
  if (start) { sekundy = ubehnute(); start = null; }
  pauza = true;
  zastavTikac();
  ulozStav();
  ukazCas();
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
  ulozStav();
  ukazCas();
}
/* The second trigger of the automatic pause: a minute without any input. */
let necinnostOd = Date.now();
function dotyk() { necinnostOd = Date.now(); }
setInterval(() => {
  if (!nastavenia.pauzaPriOdchode || pauza || done || !start) return;
  if (Date.now() - necinnostOd > 60000) pozastav(true);
}, 5000);

/* ── Streak and history ───────────────────────────────────────────────── */
function ukazSeriu() {
  if (!seriaEl) return;
  const s = nacitaj('dormice:streak');
  if (!s || !s.pocet) { seriaEl.textContent = ''; return; }
  const ziva = s.posledny === dnes || s.posledny === posunDen(dnes, -1);
  seriaEl.textContent = ziva ? 'Streak: ' + s.pocet + (s.pocet === 1 ? ' day' : ' days') : '';
}
function zapisSeriu() {
  // Only a copse solved on its own day counts: the archive is for practice.
  if (!jeDnes) return;
  const s = nacitaj('dormice:streak') || { posledny: null, pocet: 0 };
  if (s.posledny === datum) return;
  const pocet = s.posledny === posunDen(datum, -1) ? s.pocet + 1 : 1;
  uloz('dormice:streak', { posledny: datum, pocet });
}
function historiaDni() {
  const out = [];
  for (const k of vsetkyKluce('dormice:')) {
    const d = k.slice('dormice:'.length);
    if (!isValidDate(d)) continue;
    const s = nacitaj(k);
    if (s && s.done) out.push({ d, sec: s.sec || 0, hints: s.hints || 0 });
  }
  return out.sort((a, b) => (a.d < b.d ? 1 : -1));
}
function ukazHistoriu() {
  if (!historiaEl) return;
  const h = historiaDni();
  if (!h.length) { historiaEl.hidden = true; return; }
  const best = h.reduce((a, x) => (x.sec && (!a || x.sec < a.sec) ? x : a), null);
  const bezNapovedy = h.filter((x) => !x.hints).length;
  const podlaUrovne = {};
  for (const x of h) { const u = UROVNE[urovenDna(x.d)].label.toLowerCase(); podlaUrovne[u] = (podlaUrovne[u] || 0) + 1; }
  const urovne = Object.keys(podlaUrovne).map((u) => podlaUrovne[u] + ' ' + u).join(', ');
  const priemer = Math.round(h.reduce((a, x) => a + (x.sec || 0), 0) / h.length);
  historiaEl.hidden = false;
  historiaEl.innerHTML = '<b>Your copses:</b> ' + h.length + ' solved' + (urovne ? ' (' + urovne + ')' : '') + (bezNapovedy !== h.length ? ', ' + bezNapovedy + ' without hints' : ', all without hints')
    + (best ? ', best ' + formatCas(best.sec) + ' on ' + kratkyDatum(best.d) : '') + (priemer ? ', average ' + formatCas(priemer) : '') + '. <a href="/games/dormice/archive/">Archive and full history</a>.';
}

/* ── Saving ───────────────────────────────────────────────────────────── */
function ulozStav() {
  const v = {};
  for (const k of Object.keys(plocha)) v[k] = plocha[k].slice();
  uloz(KLUC, { v, ind: preskrtnute.slice(), sec: sekundy, start, done, hints, checks, t: Date.now() });
  naplanujOdoslanie();
}

/* ── The result panel ─────────────────────────────────────────────────── */
function nazovTabulky(a, b) {
  return zadanie.cats[a].label.toLowerCase() + ' and ' + zadanie.cats[b].label.toLowerCase() + ' table';
}
function ukazStav() {
  stavEl.classList.toggle('ok', !!done);
  if (zdielanieEl) zdielanieEl.hidden = !done;
  if (done) {
    const s = sekundy ? ' in ' + formatCas(sekundy) : '';
    const pomoc = [];
    if (hints) pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
    if (checks) pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
    const hn = pomoc.length ? ' with ' + pomoc.join(' and ') : ' without a hint or a check';
    const seria = jeDnes ? (nacitaj('dormice:streak') || {}).pocet || 0 : 0;
    stavEl.innerHTML = '<b>Solved</b>' + s + hn + '. The copse is accounted for.' + (jeDnes ? ' A new one arrives at midnight.' : '')
      + (seria >= 1 ? '<span class="oslava-streak">Day ' + seria + ' of your streak.</span>' : '')
      + '<span class="oslava-dalej"><a href="/games/dormice/practice/">Practice sets</a></span>';
    ukazRozuzlenie();
    return;
  }
  if (rozuzlenieEl) { rozuzlenieEl.hidden = true; rozuzlenieEl.textContent = ''; }
  const oznacenych = bunky.some((b) => hodnota(b.dataset.t, +b.dataset.r, +b.dataset.c) !== 0);
  if (!oznacenych) { stavEl.textContent = 'Read a clue, then tap a square: once for a cross, twice for a tick.'; return; }
  const fajky = porovnaj(plocha, zadanie).fajky;
  const treba = N * (K - 1);
  if (fajky >= treba) { stavEl.textContent = 'All ' + treba + ' ticks are down. Fill the rest of the squares with crosses, or use Check if something does not add up.'; return; }
  stavEl.textContent = '';
}
/* The reward of the genre, and it is nowhere in the page before the puzzle is
   finished: one sentence of the answer, then the table in full names. */
function ukazRozuzlenie() {
  if (!rozuzlenieEl) return;
  const riadky = [];
  for (let x = 0; x < N; x++) {
    const bunkyR = [];
    for (let a = 0; a < K; a++) {
      const meno = zadanie.cats[a].items[zadanie.solution[a][x]];
      // data-th is what the paper system prints over the value once a row
      // becomes a card, under 600 px.
      bunkyR.push('<td data-th="' + zadanie.cats[a].label + '">' + (a === 0 ? '<b>' + meno + '</b>' : meno) + '</td>');
    }
    riadky.push('<tr>' + bunkyR.join('') + '</tr>');
  }
  const hlava = zadanie.cats.map((c) => '<th>' + c.label + '</th>').join('');
  rozuzlenieEl.innerHTML = '<p>' + vetaRozuzlenia(zadanie) + '</p>'
    + '<table><thead><tr>' + hlava + '</tr></thead><tbody>' + riadky.join('') + '</tbody></table>';
  rozuzlenieEl.hidden = false;
}

/* ── Check, in two steps ──────────────────────────────────────────────── *
 * Only wrong ticks are counted, never crosses: one wrong tick poisons dozens
 * of squares through the carry between tables, so a raw count of marks would
 * tell a player who made a single mistake that they have forty. The coarse
 * area for this pattern is the pair of categories, that is one small table.
 * When a square is selected, only its table is checked. */
function skontrolujStav() {
  if (done) return;
  // When the board holds the focus, the square the cursor is on picks the
  // table and only that one is checked (ops/spec-hry-ux.md, part 4).
  const vybrana = bunky[fokus] && doska.contains(document.activeElement) ? bunky[fokus].dataset.t : null;
  const p = porovnaj(plocha, zadanie);
  const uvod = vybrana ? 'In the ' + nazovTabulky(...vybrana.split(',').map(Number)) + ': ' : '';
  let zle = p.zle;
  if (vybrana) zle = zle.filter((z) => klucTabulky(z.tab[0], z.tab[1]) === vybrana);
  if (!p.fajky) { stavEl.textContent = 'No ticks on the board yet, and crosses are never judged.'; return; }
  checks++;
  ulozStav();
  if (!zle.length) {
    zmazOdhalenie();
    stavEl.textContent = uvod + 'every tick is right so far: ' + p.fajky + (p.fajky === 1 ? ' tick' : ' ticks') + ' of ' + (N * (K - 1)) + ' on the board.';
    track('game_check', { game: 'dormice', wrong: 0 });
    return;
  }
  const tabs = [...new Set(zle.map((z) => klucTabulky(z.tab[0], z.tab[1])))];
  const kde = tabs.length === 1
    ? (zle.length === 1 ? 'It is in the ' : 'They are all in the ') + nazovTabulky(...tabs[0].split(',').map(Number)) + '.'
    : 'They are spread over ' + tabs.length + ' of the tables.';
  if (checkStav && !odhalene) {
    odhalene = true;
    for (const z of zle) {
      const el = bunkaZa(klucTabulky(z.tab[0], z.tab[1]), z.r, z.c);
      if (el) el.classList.add('chyba');
    }
    stavEl.textContent = 'The marked ticks are the wrong ones. Take them out and keep going.';
    checkBtn.textContent = 'Check';
    track('game_check', { game: 'dormice', wrong: zle.length, revealed: true });
    return;
  }
  checkStav = { zle: zle.length };
  stavEl.textContent = uvod + (zle.length === 1 ? 'one of your ticks is wrong. ' : zle.length + ' of your ticks are wrong. ') + kde + ' Press Check again to show which.';
  checkBtn.textContent = 'Show';
  track('game_check', { game: 'dormice', wrong: zle.length, revealed: false });
}

/* ── Hint, in two steps ───────────────────────────────────────────────── *
 * The first press names the technique and the place and never the value; the
 * second fills in exactly one square and stops short of the automatics, so
 * one hint cannot finish the puzzle and leave the counter saying one. */
const TECHNIKY = {
  'cross-out': 'A tick you have already placed crosses one more square out',
  'last-square': 'One row there has a single square left without a cross',
  'row-single': 'One row there has a single square left without a cross',
  'column-single': 'One item there has a single place left',
  'carry-across': 'A tick you have already placed carries into',
  'no-shared-partner': 'Two rows there have nothing left in common',
  'through-the-middle': 'Everything still open in the middle table rules the same thing out in',
  'naked-set': 'A few rows there take the same items between them',
  trial: 'Testing one square there until a clue breaks settles it',
  reveal: 'No simple step is left',
  'wrong-tick': 'There is a wrong tick on the board',
};
function vetaMiesta(h) {
  const t = h.bunky[0] ? h.bunky[0].tab : null;
  const meno = t ? nazovTabulky(t[0], t[1]) : 'board';
  if (h.druh === 'chyba') return 'There is a tick in the ' + meno + ' that the clues rule out. Press Hint again to take it out.';
  if (typeof h.indicia === 'number' && h.indicia >= 0) {
    return 'Clue ' + (h.indicia + 1) + ', with what you already have, settles one square in the ' + meno + '. Press Hint again to fill it in.';
  }
  const t2 = TECHNIKY[h.pravidlo] || 'One square follows from what is already there';
  const spojka = h.pravidlo === 'carry-across' || h.pravidlo === 'through-the-middle' ? ' the ' + meno + '.' : ', in the ' + meno + '.';
  return t2 + spojka + ' Press Hint again to fill it in.';
}
function ukazNapovedu() {
  if (done || pauza) return;
  if (tip) {
    const h = tip;
    const b = h.bunky[0];
    if (b) {
      const kt = klucTabulky(b.tab[0], b.tab[1]);
      // napoveda speaks the solver's language: 1 is a tick, 0 a cross, and
      // -1 on a mistake means "clear this tick".
      const cielova = h.druh === 'chyba' ? 0 : (b.val === 1 ? 1 : -1);
      zapisTah(zmenaPreBunku(kt, b.r, b.c, cielova));
    }
    hints++;
    zmazTip(); zmazOdhalenie();
    if (!done) { stavEl.textContent = h.text; ulozStav(); }
    track('game_hint', { game: 'dormice', kind: h.pravidlo, applied: true });
    ukazCas();
    return;
  }
  const h = napoveda(plocha, zadanie);
  if (!h) return;
  tip = h;
  for (const b of h.bunky.slice(0, 1)) {
    const el = bunkaZa(klucTabulky(b.tab[0], b.tab[1]), b.r, b.c);
    if (el) el.classList.add('tip');
  }
  if (typeof h.indicia === 'number' && h.indicia >= 0) {
    const li = indicieEl.querySelector('li[data-i="' + h.indicia + '"]');
    if (li) li.classList.add('tip-veta');
    citacI = h.indicia;
    ukazCitac();
  }
  stavEl.textContent = vetaMiesta(h);
  hintBtn.textContent = 'Fill in';
  track('game_hint', { game: 'dormice', kind: h.pravidlo, applied: false });
}

/* ── Share ────────────────────────────────────────────────────────────── *
 * Plain text, no grid of marks and no name from the answer, so it cannot
 * spoil the puzzle for whoever reads it. Nothing is sent anywhere. */
function odkazNaZadanie() {
  const b = 'https://arling.sk/games/dormice/';
  if (rezim === 'cvicenie') return b + 'practice/' + sada + '/' + (kSada === 1 ? '' : kSada + '/');
  return jeDnes ? b : b + datum + '/';
}
function textNaZdielanie() {
  const kto = rezim === 'cvicenie' ? 'Dormice practice ' + sada + ', copse ' + kSada : 'Dormice ' + kratkyDatum(datum);
  const pomoc = [];
  pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
  pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
  return kto + ' · ' + UROVNE[zadanie.uroven].label + '\n'
    + 'Solved' + (sekundy ? ' in ' + formatCas(sekundy) : '') + ', ' + pomoc.join(', ') + '\n'
    + odkazNaZadanie();
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
    ? 'Copied. It names nobody and no square, and nothing was sent anywhere.'
    : 'This browser would not let the page copy for you. Here is the text, take it from the box.';
  if (zdielanieText) {
    zdielanieText.value = text;
    zdielanieText.hidden = ok;
    if (!ok) { zdielanieText.focus(); zdielanieText.select(); }
  }
  track('game_share', { game: 'dormice', copied: ok, level: zadanie.uroven });
});

/* ── Finished ─────────────────────────────────────────────────────────── */
function skontroluj() {
  if (!jeVyriesene(plocha, zadanie)) return false;
  sekundy = ubehnute();
  done = Date.now();
  start = null;
  zastavTikac();
  doska.classList.add('hotovo');
  zmazTip(); zmazOdhalenie();
  ukazCas();
  zapisSeriu();
  ukazSeriu();
  ulozStav();
  ukazHistoriu();
  ukazPasik();
  track('game_solved', { game: 'dormice', day: rezim === 'den' ? datum : sada + '/' + kSada, seconds: sekundy, hints, checks, level: zadanie.uroven });
  const kontajner = document.querySelector('.hra');
  if (kontajner) oslava(kontajner, { redukovany: !nastavenia.oslava || window.matchMedia('(prefers-reduced-motion: reduce)').matches });
  return true;
}

/* ── Pointer and keyboard ─────────────────────────────────────────────── *
 * A drag sweeps crosses only, and only over squares that are still empty: a
 * tick cannot repeat down a row anyway, so sweeping one would always be a
 * mistake. The whole sweep is one step in the Undo stack. */
let tah2 = null;
function bunkaPod(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const b = el && el.closest ? el.closest('.b') : null;
  return b && doska.contains(b) ? b : null;
}
function zameraj(b) {
  if (!b) return;
  bunky[fokus].tabIndex = -1;
  fokus = +b.dataset.i;
  b.tabIndex = 0;
  b.focus();
}
doska.addEventListener('pointerdown', (e) => {
  dotyk();
  const h = e.target.closest ? e.target.closest('.h[data-a]') : null;
  if (h) { vyberPolozku(+h.dataset.a, +h.dataset.x); e.preventDefault(); return; }
  if (done || pauza || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const b = bunkaPod(e);
  if (!b) return;
  const v = hodnota(b.dataset.t, +b.dataset.r, +b.dataset.c);
  // Shift or the right button is a shortcut one step back, never the only way.
  const spat1 = e.shiftKey || (e.pointerType === 'mouse' && e.button === 2);
  tah2 = { start: b, maloval: false, hodnota: spat1 ? (v === 0 ? 1 : v === 1 ? -1 : 0) : dalsia(v), id: e.pointerId, zmeny: [] };
  try { doska.setPointerCapture(e.pointerId); } catch (err) { /* works without capture too, less smoothly */ }
  if (bunky[fokus] !== b) { bunky[fokus].tabIndex = -1; fokus = +b.dataset.i; b.tabIndex = 0; }
  e.preventDefault();
});
doska.addEventListener('pointermove', (e) => {
  if (!tah2 || tah2.id !== e.pointerId || done || pauza || tah2.hodnota !== -1) return;
  const b = bunkaPod(e);
  if (!b || (b === tah2.start && !tah2.maloval)) return;
  if (!tah2.maloval) {
    tah2.maloval = true;
    const z = zmenaPreBunku(tah2.start.dataset.t, +tah2.start.dataset.r, +tah2.start.dataset.c, -1);
    for (const x of z.bunky) { plocha[x.t][x.r * N + x.c] = x.po; tah2.zmeny.push(x); }
    ukazBunku(tah2.start);
  }
  if (hodnota(b.dataset.t, +b.dataset.r, +b.dataset.c) !== 0) return;
  const z = zmenaPreBunku(b.dataset.t, +b.dataset.r, +b.dataset.c, -1);
  for (const x of z.bunky) { plocha[x.t][x.r * N + x.c] = x.po; tah2.zmeny.push(x); }
  ukazBunku(b);
});
function koniecTahu(e) {
  if (!tah2 || tah2.id !== e.pointerId) return;
  const t = tah2;
  tah2 = null;
  try { doska.releasePointerCapture(e.pointerId); } catch (err) { /* nothing */ }
  if (done || pauza) return;
  if (t.maloval) {
    // The sweep is already on the board; put it back and let zapisTah do it
    // properly, so the whole sweep is a single step.
    for (let i = t.zmeny.length - 1; i >= 0; i--) plocha[t.zmeny[i].t][t.zmeny[i].r * N + t.zmeny[i].c] = t.zmeny[i].pred;
    zapisTah({ bunky: t.zmeny, indicie: [] });
    return;
  }
  tah(t.start, t.hodnota);
}
doska.addEventListener('pointerup', koniecTahu);
doska.addEventListener('pointercancel', (e) => { if (tah2 && tah2.id === e.pointerId) tah2 = null; });
doska.addEventListener('contextmenu', (e) => { if (e.target.closest('.b')) e.preventDefault(); });

/* Arrows walk the whole staircase, skipping the empty corners and wrapping at
   the edge; [ and ] jump to the previous or next small table. */
function posun(b, dr, dc) {
  const sirka = (K - 1) * N;
  let r = +b.dataset.rr, c = +b.dataset.cc;
  for (let i = 0; i < sirka; i++) {
    r = (r + dr + sirka) % sirka;
    c = (c + dc + sirka) % sirka;
    if (mriezka[r][c]) return mriezka[r][c];
  }
  return b;
}
function skokTabulka(b, smer) {
  const zoznam = tabulky(K).map(([a, x]) => klucTabulky(a, x));
  const i = zoznam.indexOf(b.dataset.t);
  const dlzka = zoznam.length;
  for (let krok = 1; krok <= dlzka; krok++) {
    const el = bunkaZa(zoznam[((i + smer * krok) % dlzka + dlzka) % dlzka], 0, 0);
    if (el) return el;
  }
  return b;
}
doska.addEventListener('keydown', (e) => {
  const b = e.target.closest ? e.target.closest('.b') : null;
  if (!b) return;
  dotyk();
  switch (e.key) {
    case 'ArrowUp': zameraj(posun(b, -1, 0)); break;
    case 'ArrowDown': zameraj(posun(b, 1, 0)); break;
    case 'ArrowLeft': zameraj(posun(b, 0, -1)); break;
    case 'ArrowRight': zameraj(posun(b, 0, 1)); break;
    case '[': zameraj(skokTabulka(b, -1)); break;
    case ']': zameraj(skokTabulka(b, 1)); break;
    case ' ': case 'Enter': prepni(b); break;
    case 'x': case 'X': tah(b, -1); break;
    case 'd': case 'D': tah(b, 1); break;
    case 'Delete': case 'Backspace': tah(b, 0); break;
    case 'Escape': vybranaPolozka = null; ukazVyber(); b.blur(); break;
    default: return;
  }
  e.preventDefault();
});
if (spatBtn) spatBtn.addEventListener('click', spat);
if (vpredBtn) vpredBtn.addEventListener('click', vpred);
if (resetBtn) resetBtn.addEventListener('click', reset);
if (checkBtn) checkBtn.addEventListener('click', skontrolujStav);
if (hintBtn) hintBtn.addEventListener('click', ukazNapovedu);
if (pauzaBtn) pauzaBtn.addEventListener('click', () => pozastav(false));
if (pokracujBtn) pokracujBtn.addEventListener('click', pokracuj);
document.addEventListener('keydown', (e) => {
  dotyk();
  if (e.target && /input|textarea/i.test(e.target.tagName)) return;
  if (e.key === 'Escape' && pauza) { pokracuj(); return; }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.shiftKey ? vpred() : spat(); e.preventDefault(); return; }
  if (e.ctrlKey || e.metaKey) return;          // Ctrl+R stays the browser's reload
  if (e.key === 'u' || e.key === 'U') { spat(); return; }
  if (e.key === 'r' || e.key === 'R') { vpred(); return; }
  if (e.key === 'p' || e.key === 'P') { if (pauza) pokracuj(); else pozastav(false); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (nastavenia.pauzaPriOdchode && start && !done) pozastav(true); }
  else { dotyk(); ukazCas(); }
});
if (indicieEl) {
  indicieEl.addEventListener('click', (e) => {
    const b = e.target.closest('.veta');
    if (!b) return;
    dotyk();
    preskrtni(+b.dataset.i);
  });
  indicieEl.addEventListener('mouseover', (e) => {
    const li = e.target.closest('li');
    if (li) ukazVetuVPloche(+li.dataset.i);
  });
  indicieEl.addEventListener('mouseleave', () => ukazVetuVPloche(citacI));
}
/* The clue block opens and closes on the phone. The label carries the count,
   because `All six` says what is behind the button and `All clues` does not.
   The state is not stored: the block starts closed on every day page, so the
   board is the first thing on the screen. */
function ukazViac() {
  if (!viacBtn || !indicieBox) return;
  const otvorene = indicieBox.classList.contains('rozbalene');
  viacBtn.setAttribute('aria-expanded', otvorene ? 'true' : 'false');
  viacBtn.textContent = otvorene ? 'Fewer' : (vety.length ? 'All ' + vety.length : 'All clues');
}
if (viacBtn && indicieBox) viacBtn.addEventListener('click', () => {
  indicieBox.classList.toggle('rozbalene');
  ukazViac();
});
if (legendaEl) legendaEl.addEventListener('click', (e) => {
  const el = e.target.closest('.pol');
  if (el) { dotyk(); vyberPolozku(+el.dataset.a, +el.dataset.x); }
});
if (citacEl) {
  $('citac-spat').addEventListener('click', () => { citacI = (citacI - 1 + vety.length) % vety.length; ukazCitac(); });
  $('citac-dalej').addEventListener('click', () => { citacI = (citacI + 1) % vety.length; ukazCitac(); });
  citacText.addEventListener('click', () => preskrtni(citacI));
}

/* ── The week strip ───────────────────────────────────────────────────── */
function ukazPasik() {
  if (!pasik) return;
  pasik.textContent = '';
  if (rezim === 'cvicenie') {
    const s = SADY.find((x) => x.id === sada);
    for (let k = 1; k <= s.pocet; k++) {
      const st = nacitaj('dormice:p:' + sada + ':' + k);
      const a = document.createElement(k === kSada ? 'span' : 'a');
      a.className = 'den' + (k === kSada ? ' dnes' : '') + (st && st.done ? ' hotove' : maZnacky(st) ? ' rozohrane' : '');
      if (k !== kSada) a.href = '/games/dormice/practice/' + sada + '/' + k + '/';
      a.innerHTML = '<small>No.</small><b>' + k + '</b>';
      a.setAttribute('aria-label', 'Copse ' + k + (st && st.done ? ', solved' : ''));
      if (k === kSada) a.setAttribute('aria-current', 'page');
      pasik.appendChild(a);
    }
    return;
  }
  const dni = tyzden(datum);
  dni.forEach((d, k) => {
    const st = nacitaj('dormice:' + d);
    const buduci = d > dnes, pred = d < PRVY_DEN;
    const tag = d === datum || buduci || pred ? 'span' : 'a';
    const a = document.createElement(tag);
    a.className = 'den' + (d === datum ? ' dnes' : '') + (buduci || pred ? ' buduci' : '') + (st && st.done ? ' hotove' : maZnacky(st) ? ' rozohrane' : '');
    if (tag === 'a') a.href = '/games/dormice/' + d + '/';
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
  ukazVyber();
  ukazCas();
}
document.querySelectorAll('[data-nastavenie]').forEach((el) => {
  const kluc = el.getAttribute('data-nastavenie');
  el.checked = !!nastavenia[kluc];
  el.addEventListener('change', () => {
    nastavenia[kluc] = el.checked;
    ulozNastavenia();
    pouziNastavenia();
    track('game_setting', { game: 'dormice', setting: kluc, on: el.checked });
  });
});

/* ── Account sync (only when signed in, silent otherwise) ─────────────── */
function stavVsetkychDni() {
  const out = {};
  for (const k of vsetkyKluce('dormice:')) {
    const d = k.slice('dormice:'.length);
    if (!isValidDate(d)) continue;
    const s = nacitaj(k);
    if (s) out[d] = s;
  }
  return out;
}
function zlucStavDna(lokalny, vzdialeny) {
  if (!vzdialeny) return lokalny;
  if (!lokalny) return vzdialeny;
  const v = (vzdialeny.t || 0) >= (lokalny.t || 0) ? vzdialeny : lokalny;
  const hotovo = lokalny.done || vzdialeny.done || null;
  return hotovo && !v.done ? Object.assign({}, v, { done: hotovo }) : v;
}
function prepocitajSeriu() {
  const dni = stavVsetkychDni();
  let d = dni[dnes] && dni[dnes].done ? dnes : posunDen(dnes, -1);
  let pocet = 0;
  while (dni[d] && dni[d].done) { pocet++; d = posunDen(d, -1); }
  if (!pocet) { try { localStorage.removeItem('dormice:streak'); } catch (e) { /* nič */ } return; }
  uloz('dormice:streak', { posledny: dni[dnes] && dni[dnes].done ? dnes : posunDen(dnes, -1), pocet });
}
function odosliStav() {
  if (!ucet.prihlaseny()) return;
  ucet.hra.uloz('dormice', { dni: stavVsetkychDni(), t: Date.now() }).catch(() => { /* sieťová chyba: lokálne ostáva pravdou */ });
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
  try { vzdialene = await ucet.hra.nacitaj('dormice'); } catch (e) { return; /* sieťová chyba: lokálne ostáva pravdou */ }
  const diaDni = vzdialene && vzdialene.dni && typeof vzdialene.dni === 'object' ? vzdialene.dni : {};
  let zmenene = false;
  for (const [d, r] of Object.entries(diaDni)) {
    if (!isValidDate(d) || !r || typeof r !== 'object') continue;
    const kluc = 'dormice:' + d;
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
      if (cerstve && cerstve.v && (cerstve.t || 0) > ((ulozene && ulozene.t) || 0)) {
        ulozene = cerstve;
        vlozUlozene(cerstve);
        ukazVsetko();
        if (done) { doska.classList.add('hotovo'); zastavTikac(); }
        ukazStav();
        ukazCas();
      }
    }
  }
  odosliStav();
}

/* ── Start ────────────────────────────────────────────────────────────── */
function vlozUlozene(st) {
  plocha = prazdnaPlocha(zadanie);
  if (st && st.v && typeof st.v === 'object') {
    for (const t of Object.keys(plocha)) {
      const u = st.v[t];
      if (Array.isArray(u) && u.length === N * N) for (let i = 0; i < u.length; i++) plocha[t][i] = u[i] === 1 ? 1 : u[i] === -1 ? -1 : 0;
    }
  }
  preskrtnute = new Array(zadanie.clues.length).fill(0);
  if (st && Array.isArray(st.ind)) for (let i = 0; i < preskrtnute.length && i < st.ind.length; i++) preskrtnute[i] = st.ind[i] ? 1 : 0;
  done = st && st.done ? st.done : null;
  hints = st && st.hints ? st.hints : 0;
  checks = st && st.checks ? st.checks : 0;
  sekundy = st && st.sec ? st.sec : 0;
}

async function spusti() {
  if (jeBuduci) {
    datumEl.textContent = pekneDatum(datum);
    stavEl.textContent = 'This copse opens on ' + pekneDatum(datum) + ' (Bratislava time). Come back then, or play today’s copse.';
    doska.hidden = true;
    for (const b of [spatBtn, vpredBtn, resetBtn, checkBtn, hintBtn]) if (b) b.disabled = true;
    ukazPasik();
    return;
  }
  try {
    zadanie = await nacitajZadanie();
  } catch (e) {
    stavEl.textContent = 'The copse could not be prepared. Please reload the page.';
    throw e;
  }
  N = zadanie.N; K = zadanie.k;
  vety = zadanie.clues.map((cl) => textIndicie(zadanie, cl));
  ulozene = nacitaj(KLUC);
  vlozUlozene(ulozene);
  start = null;
  if (ulozene && ulozene.start && !done) {
    // The page was closed while the clock ran: count up to the last save,
    // then wait paused.
    const koniec = ulozene.t || ulozene.start;
    sekundy += Math.max(0, Math.floor((koniec - ulozene.start) / 1000));
  }
  postavPlochu();
  ukazVsetko();
  pouziNastavenia();
  if (datumEl) datumEl.textContent = rezim === 'cvicenie' ? UROVNE[zadanie.uroven].label + ' practice ' + sada.split('-')[1] + ', copse ' + kSada : pekneDatum(datum);
  if (urovenEl) urovenEl.textContent = UROVNE[zadanie.uroven].label + ' · ' + K + ' × ' + N;
  if (done) doska.classList.add('hotovo');
  else if (bunky.some((b) => hodnota(b.dataset.t, +b.dataset.r, +b.dataset.c) !== 0)) pozastav(true);
  ukazCas();
  ukazSeriu();
  ukazHistoriu();
  ukazPasik();
  ukazStav();
  ukazTlacidla();
}
spusti().then(synchronizujUcet);
