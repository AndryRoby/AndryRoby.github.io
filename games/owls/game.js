import '../kniha.mjs?v=1';
/* Owls: the game page. One script for the daily roost, the archive days and
 * the practice sets; the page says which one it is:
 *
 *   <body data-den="YYYY-MM-DD">          an archive day (built page)
 *   <body data-sada="easy-1" data-k="3">  a practice tree
 *   nothing                               today's roost (or ?d=YYYY-MM-DD)
 *
 * The puzzle itself comes, in this order: from <script type="application/json"
 * id="zadanie"> embedded in a built page; from dni/YYYY-MM.json for the day;
 * or, when both are missing, generated right here from the date. All three
 * give the same tree for the same date (plan.mjs, generator.mjs).
 *
 * The player's board is one flat n*n array:
 *   v   0 an empty branch, 1 a day owl, 2 a night owl.
 * The owls that came with the tree are in v too and never change. Tapping
 * goes around empty, day, night, empty (pattern D of ops/spec-hry-ux.md, with
 * the one written deviation of ops/spec-owls.md part 7: there is no note in
 * this genre, both owls are answers).
 *
 * Stored in localStorage (all in try/catch, private windows throw):
 *   owls:YYYY-MM-DD     { v, sec, start, done, hints, checks, t }
 *   owls:p:<set>:<k>    the same for a practice tree
 *   owls:streak         { posledny: YYYY-MM-DD, pocet }
 *   owls:nastavenia     the settings panel
 * The stored v holds only the player's own owls (0 where an owl came with the
 * tree), so "started" means the player placed something. sec = seconds spent
 * before the current run, start = ms when the current run began (null while
 * paused or before the first move), done = ms of the solve, hints and checks
 * = help used, t = ms of the last save.
 * Outgoing events via window.umami, if it runs: game_solved, game_check,
 * game_hint, game_setting, game_share. Nothing else leaves the browser, unless
 * the player is signed in (arling.sk account, /style/ucet.js): then every
 * owls:YYYY-MM-DD save is also pushed to the account (throttled, 2s) and
 * pulled back on load, so the streak and history follow across devices.
 */
import { zadaniePreDen, zadanieCvicenie, rozbal, tyzden, urovenDna, posunDen, pekneDatum, kratkyDatum, UROVNE, SADY, PRVY_DEN, DNI } from './plan.mjs';
import { todayBratislava, isValidDate } from './generator.mjs';
// Which days still have a page of their own and what ?d= may hold: one rule
// for all the games, /games/okno.mjs (the generators read the same file).
import { denZParametra, adresaDna, trvalaAdresaDna } from '../okno.mjs?v=1';
import { jeVyriesene, porovnaj, napoveda } from './logika.mjs';
import * as ucet from '/style/ucet.js';
import { oslava } from '../oslava.js';
// The play screen (../hra-ui.js): the rule in one line over the board with a
// Rules panel, the buttons pinned in reach, the board sized to the window.
import { hraUi } from '../hra-ui.js?v=1';
hraUi({ pravidlo: 'Half day, half night owls in every row and column. Never three alike in a line, no two rows or columns alike.' });

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
const popisEl = $('doska-popis');
const poctyKurzor = $('pocty-kurzor');
const tipRam = $('tip-ram');
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
const zacate = (st) => !!(st && Array.isArray(st.v) && st.v.some((x) => x));

/* ── Settings ─────────────────────────────────────────────────────────── */
const NASTAVENIA_KLUC = 'owls:nastavenia';
// Live check is off: nothing turns red while you play (Andrej, 10. 9.), Check
// is the only judge. Show counts and the row and column outline are on
// (ops/spec-owls.md part 7, open question 4); both only read the tree as it
// is, never the answer.
const NASTAVENIA_PREDVOLENE = { casovac: true, pauzaPriOdchode: true, pocty: true, kriz: true, vzory: true, zivaKontrola: false, potvrditReset: true, oslava: true };
let nastavenia = Object.assign({}, NASTAVENIA_PREDVOLENE, nacitaj(NASTAVENIA_KLUC) || {});
function ulozNastavenia() { uloz(NASTAVENIA_KLUC, nastavenia); }

/* ── Which tree ───────────────────────────────────────────────────────── */
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
  // ?d= opens one day on this page; that is how a day too old to have a page of
  // its own is played. Only a real date from the first day to today passes.
  try { const d = denZParametra(new URL(location.href).searchParams.get('d'), PRVY_DEN, dnes); if (d) datum = d; } catch (e) { /* today */ }
}
const jeDnes = rezim === 'den' && datum === dnes;
const jeBuduci = rezim === 'den' && datum > dnes;
const KLUC = rezim === 'cvicenie' ? 'owls:p:' + sada + ':' + kSada : 'owls:' + datum;
// The root address always opens today's roost; once the date is settled,
// rewrite it to today's built page so a shared link points at the day itself.
if (rezim === 'den' && !body.dataset.den && jeDnes && !location.search) {
  try { history.replaceState(null, '', '/games/owls/' + datum + '/'); } catch (e) { /* the address stays generic; the game still works */ }
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

/* ── Loading the tree ─────────────────────────────────────────────────── */
function vlozene() {
  const el = $('zadanie');
  if (!el) return null;
  try { return rozbal(JSON.parse(el.textContent)); } catch (e) { return null; }
}
async function zTabulky(iso) {
  try {
    const r = await fetch('/games/owls/dni/' + iso.slice(0, 7) + '.json', { cache: 'no-cache' });
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
let zadanie, n, C, dane, v, start, done, sekundy, hints, checks, ulozene;
let undoStack = [];
let redoStack = [];
let kurzor = -1;            // the branch the keyboard is standing on
let tikac = null;
let necinnost = null;
let pauza = false;
let tip = null;             // the first press of Hint, waiting for the second
let odhalene = false;       // Check's second step is showing the wrong owls
let checkStav = null;       // what the last Check saw, so the second press can reveal it
const bunky = [];           // the branch buttons, by cell index
const pocitadlaR = [];      // the count beside each row
const pocitadlaS = [];      // the count under each column

/* ── Drawing ──────────────────────────────────────────────────────────── */
const NAZVY = ['empty branch', 'day owl', 'night owl'];
function suradnice(i) { return 'row ' + (((i / n) | 0) + 1) + ', column ' + ((i % n) + 1); }
const jeDana = (i) => zadanie.givens[i] != null;
function postavMriezku() {
  document.documentElement.style.setProperty('--n', n);
  doska.style.setProperty('--n', n);
  doska.setAttribute('aria-label', 'Tree ' + n + ' by ' + n);
  doska.setAttribute('aria-rowcount', String(n));
  doska.setAttribute('aria-colcount', String(n));
  doska.textContent = '';
  bunky.length = 0; pocitadlaR.length = 0; pocitadlaS.length = 0;
  const frag = document.createDocumentFragment();
  for (let r = 0; r < n; r++) {
    const riadok = document.createElement('div');
    riadok.className = 'riadok';
    riadok.setAttribute('role', 'row');
    riadok.setAttribute('aria-rowindex', String(r + 1));
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'b' + (r === 0 ? ' r0' : '') + (c === 0 ? ' c0' : '') + (jeDana(i) ? ' dana' : '');
      b.dataset.i = i;
      b.dataset.v = String(v[i] || 0);
      b.setAttribute('role', 'gridcell');
      b.setAttribute('aria-colindex', String(c + 1));
      if (jeDana(i)) b.setAttribute('aria-readonly', 'true');
      b.tabIndex = -1;
      const ik = document.createElement('i');
      ik.className = 'ikona';
      b.appendChild(ik);
      riadok.appendChild(b);
      bunky.push(b);
    }
    const pr = document.createElement('div');
    pr.className = 'pr';
    pr.setAttribute('aria-hidden', 'true');
    riadok.appendChild(pr);
    pocitadlaR.push(pr);
    frag.appendChild(riadok);
  }
  const spodok = document.createElement('div');
  spodok.className = 'riadok';
  spodok.setAttribute('aria-hidden', 'true');
  for (let c = 0; c < n; c++) {
    const ps = document.createElement('div');
    ps.className = 'ps' + (c === 0 ? ' c0' : '');
    spodok.appendChild(ps);
    pocitadlaS.push(ps);
  }
  const roh = document.createElement('div');
  roh.className = 'roh';
  spodok.appendChild(roh);
  frag.appendChild(spodok);
  doska.appendChild(frag);
  bunky[0].tabIndex = 0;
  if (popisEl) {
    let d = 0, nn = 0;
    for (const x of zadanie.givens) { if (x === 0) d++; else if (x === 1) nn++; }
    popisEl.textContent = 'The tree, ' + n + ' by ' + n + ', starts with ' + d + (d === 1 ? ' day owl' : ' day owls') + ' and ' + nn + (nn === 1 ? ' night owl' : ' night owls') + ' on their branches. Arrow keys move between branches.';
  }
  merajBunku();
}
/* Everything on the tree is drawn from --cell, the measured width of one
 * branch, so a twelve by twelve on a phone reads like a six by six. */
function merajBunku() {
  const b = bunky[0];
  if (!b) return;
  const w = b.getBoundingClientRect().width;
  if (w > 0) doska.style.setProperty('--cell', w + 'px');
  if (tipRam && !tipRam.hidden && ramBunky) postavRam(ramBunky);
}
if (window.ResizeObserver) new ResizeObserver(merajBunku).observe(doska);
else window.addEventListener('resize', merajBunku);

function ukazBunku(i) {
  const b = bunky[i];
  if (!b) return;
  const val = v[i] || 0;
  b.dataset.v = String(val);
  b.setAttribute('aria-label', 'Row ' + (((i / n) | 0) + 1) + ', column ' + ((i % n) + 1) + ': ' + NAZVY[val] + (jeDana(i) ? ', given' : ''));
}

/* ── Counts, and a line that keeps the rules going quiet ──────────────── *
 * The counts read only the tree as it is (the player's owls and the given
 * ones), never the solution. A line goes quiet when it is full, balanced, has
 * no three alike side by side and is not a copy of another full line of its
 * kind: it keeps the rules, which says nothing about being the answer. */
function linia(L) {
  const out = [];
  for (let k = 0; k < n; k++) out.push(L < n ? L * n + k : k * n + (L - n));
  return out;
}
function poctyLinie(L) {
  let d = 0, nn = 0;
  for (const i of linia(L)) { if (v[i] === 1) d++; else if (v[i] === 2) nn++; }
  return { d, nn };
}
function podpisLinie(L) {
  let s = '';
  for (const i of linia(L)) { if (!v[i]) return null; s += v[i]; }
  return s;
}
function linieSplnene() {
  const ok = new Uint8Array(2 * n);
  const podpisy = [];
  for (let L = 0; L < 2 * n; L++) podpisy.push(podpisLinie(L));
  for (let L = 0; L < 2 * n; L++) {
    const s = podpisy[L];
    if (!s) continue;
    const { d, nn } = poctyLinie(L);
    if (d !== n / 2 || nn !== n / 2) continue;
    if (/111|222/.test(s)) continue;
    const zac = L < n ? 0 : n;
    let dvojca = false;
    for (let M = zac; M < zac + n; M++) if (M !== L && podpisy[M] === s) { dvojca = true; break; }
    if (!dvojca) ok[L] = 1;
  }
  return ok;
}
function textPoctov(el, p) {
  el.innerHTML = '<i class="pd">' + p.d + '</i><i class="pn">' + p.nn + '</i>';
}
function ukazPocty() {
  if (!zadanie) return;
  const ok = linieSplnene();
  for (let r = 0; r < n; r++) { const el = pocitadlaR[r]; if (!el) continue; textPoctov(el, poctyLinie(r)); el.classList.toggle('splnene', !!ok[r]); }
  for (let c = 0; c < n; c++) { const el = pocitadlaS[c]; if (!el) continue; textPoctov(el, poctyLinie(n + c)); el.classList.toggle('splnene', !!ok[n + c]); }
  ukazPoctyKurzora();
}
/* Under 360 px the strip is gone (CSS), and this line says the same for the
 * row and the column of the cursor. */
function ukazPoctyKurzora() {
  if (!poctyKurzor) return;
  poctyKurzor.hidden = !nastavenia.pocty;
  if (!nastavenia.pocty || kurzor < 0 || done) { poctyKurzor.textContent = ''; return; }
  const r = (kurzor / n) | 0, c = kurzor % n;
  const a = poctyLinie(r), b = poctyLinie(n + c);
  poctyKurzor.textContent = 'Row ' + (r + 1) + ': ' + a.d + ' day, ' + a.nn + ' night. Column ' + (c + 1) + ': ' + b.d + ' day, ' + b.nn + ' night.';
}
/* The row and the column of the cursor, as an outline. */
function oznacKriz() {
  for (const b of bunky) b.classList.remove('kriz');
  if (!nastavenia.kriz || done || kurzor < 0) return;
  const r = (kurzor / n) | 0, c = kurzor % n;
  for (const i of linia(r)) if (i !== kurzor) bunky[i].classList.add('kriz');
  for (const i of linia(n + c)) if (i !== kurzor) bunky[i].classList.add('kriz');
}
function ukazVsetko() {
  for (let i = 0; i < C; i++) ukazBunku(i);
  ukazPocty();
  oznacKriz();
}

/* ── The hint outline ─────────────────────────────────────────────────── */
let ramBunky = null;
function postavRam(cells) {
  if (!tipRam || !cells.length) return;
  ramBunky = cells;
  const obal = tipRam.parentElement.getBoundingClientRect();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const i of cells) {
    const q = bunky[i].getBoundingClientRect();
    x0 = Math.min(x0, q.left); y0 = Math.min(y0, q.top); x1 = Math.max(x1, q.right); y1 = Math.max(y1, q.bottom);
  }
  tipRam.style.left = (x0 - obal.left - 1) + 'px';
  tipRam.style.top = (y0 - obal.top - 1) + 'px';
  tipRam.style.width = (x1 - x0 + 2) + 'px';
  tipRam.style.height = (y1 - y0 + 2) + 'px';
  tipRam.hidden = false;
}
/* The number of a trial's step on a branch it would fill (see ukazNapovedu). */
function oznacKrok(i, k) {
  const b = bunky[i];
  if (!b) return;
  b.classList.add('krok');
  const ik = b.querySelector('.ikona');
  if (ik) ik.setAttribute('data-krok', String(k));
}
function zmazTip() {
  tip = null;
  for (const b of bunky) {
    b.classList.remove('tip');
    if (b.classList.contains('krok')) {
      b.classList.remove('krok');
      const ik = b.querySelector('.ikona');
      if (ik) ik.removeAttribute('data-krok');
    }
  }
  if (tipRam) tipRam.hidden = true;
  ramBunky = null;
  if (hintBtn) hintBtn.textContent = 'Hint';
}
function zmazOdhalenie() {
  if (!odhalene && !checkStav) return;
  odhalene = false; checkStav = null;
  for (const b of bunky) b.classList.remove('chyba');
  if (checkBtn) checkBtn.textContent = 'Check';
}
/* Live check is off by default; when it is on, a wrong owl is marked as soon
 * as it is placed, with a dashed frame and a cross, not by colour alone. */
function zivaKontrola() {
  if (!nastavenia.zivaKontrola || done || !zadanie) return;
  if (!odhalene) for (const b of bunky) b.classList.remove('chyba');
  for (const i of porovnaj(v, zadanie.solution, zadanie.givens).zle) bunky[i].classList.add('chyba');
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
  ukonciTah();
  ulozStav();
  ukazCas();
  if (pauzaCas) pauzaCas.textContent = sekundy ? 'You have spent ' + slovaCas(sekundy) + ' so far.' : 'Your owls are kept; the clock continues when you resume.';
  if (pauzaBlok) pauzaBlok.hidden = false;
  if (tipRam) tipRam.hidden = true;
  doska.classList.add('pauza');
  ukazTlacidla();
  if (!auto && pokracujBtn) pokracujBtn.focus();
}
function pokracuj() {
  if (!pauza) return;
  pauza = false;
  start = Date.now();
  if (pauzaBlok) pauzaBlok.hidden = true;
  doska.classList.remove('pauza');
  if (ramBunky) postavRam(ramBunky);
  spustiTikac();
  nastavNecinnost();
  ulozStav();
  ukazCas();
  ukazTlacidla();
}

/* ── Streak and history ───────────────────────────────────────────────── */
function ukazSeriu() {
  if (!seriaEl) return;
  const s = nacitaj('owls:streak');
  if (!s || !s.pocet) { seriaEl.textContent = ''; return; }
  const ziva = s.posledny === dnes || s.posledny === posunDen(dnes, -1);
  seriaEl.textContent = ziva ? 'Streak: ' + s.pocet + (s.pocet === 1 ? ' day' : ' days') : '';
}
function zapisSeriu() {
  // Only a roost solved on its own day counts: the archive is for practice.
  if (!jeDnes) return;
  const s = nacitaj('owls:streak') || { posledny: null, pocet: 0 };
  if (s.posledny === datum) return;
  const pocet = s.posledny === posunDen(datum, -1) ? s.pocet + 1 : 1;
  uloz('owls:streak', { posledny: datum, pocet });
}
/* Every solved day in this browser, newest first. */
function historiaDni() {
  const out = [];
  for (const k of vsetkyKluce('owls:')) {
    const d = k.slice('owls:'.length);
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
  historiaEl.innerHTML = '<b>Your roosts:</b> ' + h.length + ' solved' + (urovne ? ' (' + urovne + ')' : '') + (ciste ? ', ' + ciste + ' clean, with no hint and no check' : ', none clean yet')
    + (best ? ', best ' + formatCas(best.sec) + ' on ' + kratkyDatum(best.d) : '') + (priemer ? ', average ' + formatCas(priemer) : '') + '. <a href="/games/owls/archive/">Archive and full history</a>.';
}

/* ── Saving and solving ───────────────────────────────────────────────── */
function lenHrac() { return v.map((x, i) => (jeDana(i) ? 0 : x)); }
function ulozStav() { uloz(KLUC, { v: lenHrac(), sec: sekundy, start, done, hints, checks, t: Date.now() }); naplanujOdoslanie(); }
function mahrac() { for (let i = 0; i < C; i++) if (v[i] && !jeDana(i)) return true; return false; }

function ukazStav() {
  stavEl.classList.toggle('ok', !!done);
  if (zdielanieEl) zdielanieEl.hidden = !done;
  if (done) {
    const s = sekundy ? ' in ' + formatCas(sekundy) : '';
    const pomoc = [];
    if (hints) pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
    if (checks) pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
    const hn = pomoc.length ? ' with ' + pomoc.join(' and ') : ' without a hint or a check';
    const seria = jeDnes ? (nacitaj('owls:streak') || {}).pocet || 0 : 0;
    stavEl.innerHTML = '<b>Solved</b>' + s + hn + '. ' + (pomoc.length ? 'Every row and every column is in balance.' : 'A clean tree: not a hint, not a check.')
      + (jeDnes ? ' A new roost arrives at midnight, Bratislava time.' : '')
      + (seria >= 1 ? '<span class="oslava-streak">Day ' + seria + ' of your streak.</span>' : '')
      + '<span class="oslava-dalej"><a href="/games/owls/practice/">Practice sets</a></span>';
    return;
  }
  if (!mahrac()) { stavEl.textContent = 'Tap an empty branch for a day owl, again for a night owl, once more to clear it.'; return; }
  if (v.every((x) => x)) { stavEl.textContent = 'Every branch has an owl, but the tree does not work out yet. Check shows where.'; return; }
  stavEl.textContent = '';
}

/* ── Check, in two steps ──────────────────────────────────────────────── *
 * The first press says how many owls are wrong and in which rows; only the
 * second press marks them. An empty branch and a given owl are never judged. */
function skontrolujStav() {
  if (done || pauza) return;
  const p = porovnaj(v, zadanie.solution, zadanie.givens);
  if (!p.sovy) { stavEl.textContent = 'Nothing on the tree yet.'; return; }
  // The wrong owls are already marked and nothing has moved since (every move
  // clears the marks): say so, and neither ask for another press nor count
  // another check. Until 25. 9. a third press started the two steps over and
  // added a check each time.
  if (odhalene && p.zle.length) {
    stavEl.textContent = p.zle.length === 1 ? 'The marked owl is still wrong. Clear it and keep going.' : 'The marked owls are still wrong. Clear them and keep going.';
    return;
  }
  checks++;
  ulozStav();
  if (!p.zle.length) {
    zmazOdhalenie();
    stavEl.textContent = 'Everything right so far: ' + p.sovy + (p.sovy === 1 ? ' owl' : ' owls') + ', and not one of them wrong.';
    track('game_check', { game: 'owls', wrong: 0 });
    return;
  }
  if (checkStav && !odhalene) {
    odhalene = true;
    for (const i of p.zle) bunky[i].classList.add('chyba');
    stavEl.textContent = p.zle.length === 1
      ? 'The marked owl is not like that in the finished tree. Clear it and keep going.'
      : 'The marked owls are not like that in the finished tree. Clear them and keep going.';
    checkBtn.textContent = 'Check';
    track('game_check', { game: 'owls', wrong: p.zle.length, revealed: true });
    return;
  }
  const riadky = [];
  for (const i of p.zle) { const s = 'row ' + (((i / n) | 0) + 1); if (!riadky.includes(s)) riadky.push(s); }
  checkStav = { zle: p.zle.length };
  stavEl.textContent = 'There ' + (p.zle.length === 1 ? 'is 1 owl that is wrong' : 'are ' + p.zle.length + ' owls that are wrong')
    + ', in ' + zoznamSlov(riadky.slice(0, 4)) + (riadky.length > 4 ? ' and elsewhere' : '') + '. Press Check again to show where.';
  checkBtn.textContent = 'Show';
  track('game_check', { game: 'owls', wrong: p.zle.length, revealed: false });
}

/* ── Hint, in two steps ───────────────────────────────────────────────── *
 * The first press outlines the row or column the step reads (or the branch of
 * a trial, or the row of a wrong owl) and names the technique without saying
 * which kind of owl; the second press does that one step, rings the owls it
 * placed and explains it in full. Every hint is counted and shown at the end. */
function ukazNapovedu() {
  if (done || pauza) return;
  if (tip) {
    const t = tip;
    hints++;   // counted before the move, so the save inside it carries the new number
    const zmenilo = zmenaStavu(() => {
      t.bunky.forEach((i, j) => { if (!jeDana(i)) v[i] = t.hodnoty[j]; });
    });
    if (!zmenilo) { ulozStav(); ukazStav(); }
    track('game_hint', { game: 'owls', rule: t.pravidlo, layer: t.vrstva, applied: true });
    if (done) return;
    stavEl.textContent = t.text2;
    // what the step did stays in view until the next move
    if (t.retaz) {
      // A trial: text2 names the chain Step 1, Step 2 ...; the empty branches
      // each step would fill carry that number, and the outline goes round
      // the line that breaks. Nothing of the chain is placed: it is only
      // supposed (review of 25. 9., round 2).
      postavRam(linia(t.sporLinia));
      t.retaz.forEach((cells, j) => { for (const i of cells) oznacKrok(i, j + 1); });
    } else postavRam(t.typ === 'cell' || t.druh === 'chyba' ? t.bunky : linia(t.linia));
    for (const i of t.bunky) bunky[i].classList.add('tip');
    return;
  }
  const h = napoveda(v, zadanie.givens, zadanie.solution, n);
  if (!h) return;
  zmazOdhalenie();
  tip = h;
  if (h.typ === 'cell') { postavRam(h.bunky); zameraj(h.bunky[0], false); }
  else postavRam(linia(h.linia));
  const viac = h.bunky.length > 1;
  stavEl.textContent = h.text1 + (h.druh === 'chyba' ? ' Press Hint again to take it off.' : ' Press Hint again to place ' + (viac ? 'the owls.' : 'the owl.'));
  hintBtn.textContent = h.druh === 'chyba' ? 'Take it off' : viac ? 'Place them' : 'Place it';
  track('game_hint', { game: 'owls', rule: h.pravidlo, layer: h.vrstva, applied: false });
}

function skontroluj() {
  if (!jeVyriesene(v, zadanie.givens, n)) return false;
  sekundy = ubehnute();
  done = Date.now();
  start = null;
  zastavTikac();
  nastavNecinnost();
  doska.classList.add('hotovo');
  zmazTip(); zmazOdhalenie();
  // the keyboard cursor would otherwise stay lit on the last branch
  const aktivny = document.activeElement;
  if (aktivny && aktivny !== doska && doska.contains(aktivny)) aktivny.blur();
  oznacKriz();
  ukazPoctyKurzora();
  ukazCas();
  ukazTlacidla();
  zapisSeriu();
  ukazSeriu();
  ulozStav();
  ukazHistoriu();
  ukazPasik();
  track('game_solved', { game: 'owls', day: rezim === 'den' ? datum : sada + '/' + kSada, seconds: sekundy, hints, checks, level: zadanie.uroven });
  const kontajner = document.querySelector('.hra');
  if (kontajner) oslava(kontajner, { redukovany: !nastavenia.oslava || window.matchMedia('(prefers-reduced-motion: reduce)').matches });
  return true;
}

/* ── Share ────────────────────────────────────────────────────────────── *
 * A voluntary step after the tree is solved (ops/spec-hry-ux.md, part 8). One
 * plain line: the game, the day, the level, the time, the help used and the
 * link. No grid: in this genre a grid of the player's owls IS the answer.
 * Nothing is sent anywhere; the text only reaches the clipboard. */
function odkazNaZadanie() {
  const b = 'arling.sk/games/owls/';
  if (rezim === 'cvicenie') return b + 'practice/' + sada + '/' + (kSada === 1 ? '' : kSada + '/');
  return jeDnes ? b : trvalaAdresaDna(b, datum);   // ?d=, so the link still opens after the day's page is gone
}
function textNaZdielanie() {
  const kto = rezim === 'cvicenie' ? UROVNE[zadanie.uroven].label + ' practice ' + sada.split('-')[1] + ', tree ' + kSada : kratkyDatum(datum);
  return 'Owls, ' + kto + ', ' + UROVNE[zadanie.uroven].label + ', ' + formatCas(sekundy || 0) + ', '
    + hints + (hints === 1 ? ' hint' : ' hints') + ', ' + checks + (checks === 1 ? ' check' : ' checks') + ', ' + odkazNaZadanie();
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
    ? 'Copied. It holds no owl and no branch, and nothing was sent anywhere.'
    : 'This browser would not let the page copy for you. Here is the text, take it from the box.';
  if (zdielanieText) {
    zdielanieText.value = text;
    zdielanieText.hidden = ok;
    if (!ok) { zdielanieText.focus(); zdielanieText.select(); }
  }
  track('game_share', { game: 'owls', copied: ok, level: zadanie.uroven });
});

/* ── Moves ────────────────────────────────────────────────────────────── *
 * Every change to the board goes through zmenaStavu: it keeps the whole board
 * before and after, so Undo and Redo are one shared stack with no limit and
 * Clear is undone by a single Undo (ops/spec-hry-ux.md, part 3). A drag over
 * many branches is one entry: davka collects the board as it was when the
 * stroke began and the end of the stroke files it. */
let davka = null;
/* A solved tree has nothing left to undo, clear, hint or check, and a paused
   one waits for Resume (the review of 25. 9. found them looking pressable
   during the pause and doing nothing), so those buttons go quiet. */
function ukazTlacidla() {
  const ticho = !!done || pauza;
  if (spatBtn) spatBtn.disabled = !undoStack.length || ticho;
  if (znovaBtn) znovaBtn.disabled = !redoStack.length || ticho;
  for (const b of [resetBtn, hintBtn, checkBtn]) if (b) b.disabled = ticho;
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
  ukazVsetko();
  zmazTip(); zmazOdhalenie();
  if (!skontroluj()) { ulozStav(); zivaKontrola(); }
  ukazStav();
  ukazCas();
  ukazTlacidla();
  nastavNecinnost();
}
function nastav(i, hodnota) {
  if (done || pauza || i < 0 || !bunky[i] || jeDana(i)) return;
  if (v[i] === hodnota) return;
  zmenaStavu(() => { v[i] = hodnota; });
}
/* One tap takes the branch through day owl, night owl and back to empty, so
 * the way back is always one tap away (ops/spec-owls.md part 7). */
const dalsi = (x) => ((x || 0) + 1) % 3;
const predosly = (x) => ((x || 0) + 2) % 3;
function prepni(i) { if (bunky[i] && !jeDana(i)) nastav(i, dalsi(v[i])); }

function spat() {
  if (done || pauza || !undoStack.length) return;
  redoStack.push(v.slice());
  v = undoStack.pop();
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) { ulozStav(); zivaKontrola(); }
  ukazStav();
  ukazTlacidla();
}
function znova() {
  if (done || pauza || !redoStack.length) return;
  undoStack.push(v.slice());
  v = redoStack.pop();
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) { ulozStav(); zivaKontrola(); }
  ukazStav();
  ukazTlacidla();
}
/* Clear: only the given owls stay, the clock keeps running (Andrej, 10. 9.:
 * clearing is a move, not a restart). One Undo brings every owl back. */
function reset() {
  if (done || pauza || !mahrac()) return;
  if (nastavenia.potvrditReset && !window.confirm('Clear every owl you placed? The clock keeps running and one Undo brings them back.')) return;
  zmenaStavu(() => { v = zadanie.givens.map((x) => (x == null ? 0 : x + 1)); });
}

/* ── Pointer ──────────────────────────────────────────────────────────── *
 * A tap moves the branch one step around the cycle; a right click or Shift
 * and a click one step back. A drag spreads the state the first branch got,
 * and only over empty branches, so it never turns an owl into the other kind;
 * a drag that started by clearing takes the player's owls off. A given owl
 * only takes the cursor. */
function bunkaPod(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const b = el && el.closest ? el.closest('.b') : null;
  return b && doska.contains(b) ? +b.dataset.i : -1;
}
let tah = null; // { start, maloval, hodnota, id }
function ukonciTah() {
  if (!tah) return;
  tah = null;
  if (davka && davka.pred) { undoStack.push(davka.pred); redoStack.length = 0; ukazTlacidla(); }
  davka = null;
}
doska.addEventListener('pointerdown', (e) => {
  if (done || pauza) return;
  if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
  const i = bunkaPod(e);
  if (i < 0) return;
  zameraj(i, true);
  e.preventDefault();
  if (jeDana(i)) return;
  const spat1 = e.shiftKey || (e.pointerType === 'mouse' && e.button === 2);
  tah = { start: i, maloval: false, hodnota: spat1 ? predosly(v[i]) : dalsi(v[i]), id: e.pointerId };
  davka = { pred: null };
  try { doska.setPointerCapture(e.pointerId); } catch (err) { /* works without capture too, less smoothly */ }
});
doska.addEventListener('pointermove', (e) => {
  if (!tah || tah.id !== e.pointerId || done || pauza) return;
  const i = bunkaPod(e);
  if (i < 0 || jeDana(i)) return;
  if (!tah.maloval) {
    if (i === tah.start) return;
    tah.maloval = true;
    nastav(tah.start, tah.hodnota);
  }
  if (tah.hodnota === 0 ? v[i] !== 0 : v[i] === 0) nastav(i, tah.hodnota);
});
function koniecTahu(e) {
  if (!tah || tah.id !== e.pointerId) return;
  const t = tah;
  if (!t.maloval) {
    tah = null; davka = null;
    nastav(t.start, t.hodnota);
  } else ukonciTah();
  try { doska.releasePointerCapture(e.pointerId); } catch (err) { /* nothing */ }
}
doska.addEventListener('pointerup', koniecTahu);
doska.addEventListener('pointercancel', (e) => { if (tah && tah.id === e.pointerId) ukonciTah(); });
doska.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('.b')) e.preventDefault(); });
/* Tab into the tree and the branch that takes the focus is the one the
 * keyboard works on. */
doska.addEventListener('focusin', (e) => {
  const b = e.target && e.target.closest ? e.target.closest('.b') : null;
  if (!b) return;
  const i = +b.dataset.i;
  if (i !== kurzor) { kurzor = i; oznacKriz(); ukazPoctyKurzora(); }
});

/* ── Keyboard ─────────────────────────────────────────────────────────── *
 * Arrows walk from branch to branch and wrap at the edge, Space or Enter goes
 * around the cycle, D or 1 a day owl, N or 2 a night owl, Delete, Backspace
 * or 0 clears, Escape lets go (ops/spec-owls.md part 7). */
function zameraj(i, fokus) {
  if (i < 0 || !bunky[i]) return;
  for (const b of bunky) b.tabIndex = -1;
  kurzor = i;
  bunky[i].tabIndex = 0;
  if (fokus) bunky[i].focus({ preventScroll: true });
  oznacKriz();
  ukazPoctyKurzora();
}
function posun(i, dr, dc) {
  const r = (((i / n) | 0) + dr + n) % n, c = ((i % n) + dc + n) % n;
  return r * n + c;
}
doska.addEventListener('keydown', (e) => {
  if (done || pauza) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  // The key belongs to the branch that has the focus. The cursor follows the
  // focus through focusin, but a browser whose window is not in front (a
  // second screen, a headless test) may skip that event, so the branch is
  // read from the event itself and the cursor is only the fallback.
  const cil = e.target && e.target.closest ? e.target.closest('.b') : null;
  const i = cil && doska.contains(cil) ? +cil.dataset.i : kurzor;
  if (i < 0 || !bunky[i]) return;
  if (i !== kurzor) zameraj(i, false);
  let ciel = -1;
  switch (e.key) {
    case 'ArrowUp': ciel = posun(i, -1, 0); break;
    case 'ArrowDown': ciel = posun(i, 1, 0); break;
    case 'ArrowLeft': ciel = posun(i, 0, -1); break;
    case 'ArrowRight': ciel = posun(i, 0, 1); break;
    case ' ': case 'Enter': prepni(i); e.preventDefault(); return;
    case 'd': case 'D': case '1': nastav(i, 1); e.preventDefault(); return;
    case 'n': case 'N': case '2': nastav(i, 2); e.preventDefault(); return;
    case 'Delete': case 'Backspace': case '0': nastav(i, 0); e.preventDefault(); return;
    case 'Escape': {
      if (tah) { ukonciTah(); e.preventDefault(); return; }
      const b = bunky[kurzor];
      kurzor = -1; oznacKriz(); ukazPoctyKurzora();
      if (b) b.blur();
      e.preventDefault();
      return;
    }
    default: return;
  }
  e.preventDefault();
  if (ciel >= 0) zameraj(ciel, true);
});
if (spatBtn) spatBtn.addEventListener('click', spat);
if (znovaBtn) znovaBtn.addEventListener('click', znova);
if (resetBtn) resetBtn.addEventListener('click', reset);
if (checkBtn) checkBtn.addEventListener('click', skontrolujStav);
if (hintBtn) hintBtn.addEventListener('click', ukazNapovedu);
if (pauzaBtn) pauzaBtn.addEventListener('click', () => pozastav(false));
if (pokracujBtn) pokracujBtn.addEventListener('click', pokracuj);
/* Undo and Redo: U and Ctrl+Z back, R, Ctrl+Y and Ctrl+Shift+Z forward.
 * Ctrl+R is never taken: it stays the browser's reload. */
document.addEventListener('keydown', (e) => {
  if (e.target && /input|textarea|select/i.test(e.target.tagName || '')) return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && (e.key === 'z' || e.key === 'Z')) { if (e.shiftKey) znova(); else spat(); e.preventDefault(); return; }
  if (ctrl && (e.key === 'y' || e.key === 'Y')) { znova(); e.preventDefault(); return; }
  if (ctrl || e.altKey) return;
  // a key the tree has already used for an owl is not a command as well
  if (e.defaultPrevented) return;
  if (e.key === 'u' || e.key === 'U') { spat(); e.preventDefault(); return; }
  if (e.key === 'r' || e.key === 'R') { znova(); e.preventDefault(); return; }
  if (e.key === 'Escape' && pauza) { pokracuj(); return; }
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
      const st = nacitaj('owls:p:' + sada + ':' + k);
      const a = document.createElement(k === kSada ? 'span' : 'a');
      a.className = 'den' + (k === kSada ? ' dnes' : '') + (st && st.done ? ' hotove' : zacate(st) ? ' rozohrane' : '');
      if (k !== kSada) a.href = '/games/owls/practice/' + sada + '/' + (k === 1 ? '' : k + '/');
      a.innerHTML = '<small>No.</small><b>' + k + '</b>';
      a.setAttribute('aria-label', 'Tree ' + k + (st && st.done ? ', solved' : ''));
      if (k === kSada) a.setAttribute('aria-current', 'page');
      pasik.appendChild(a);
    }
    return;
  }
  const dni = tyzden(datum);
  dni.forEach((d, k) => {
    const st = nacitaj('owls:' + d);
    const buduci = d > dnes, pred = d < PRVY_DEN;
    const tag = d === datum || buduci || pred ? 'span' : 'a';
    const a = document.createElement(tag);
    a.className = 'den' + (d === datum ? ' dnes' : '') + (buduci || pred ? ' buduci' : '') + (st && st.done ? ' hotove' : zacate(st) ? ' rozohrane' : '');
    if (tag === 'a') a.href = adresaDna('/games/owls/', d, dnes);
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
  doska.classList.toggle('bez-poctov', !nastavenia.pocty);
  doska.classList.toggle('vzory', !!nastavenia.vzory);
  if (!nastavenia.zivaKontrola && !odhalene) { for (const b of bunky) b.classList.remove('chyba'); }
  zivaKontrola();
  oznacKriz();
  ukazPoctyKurzora();
  nastavNecinnost();
  ukazCas();
  merajBunku();
}
document.querySelectorAll('[data-nastavenie]').forEach((el) => {
  const kluc = el.getAttribute('data-nastavenie');
  el.checked = !!nastavenia[kluc];
  el.addEventListener('change', () => {
    nastavenia[kluc] = el.checked;
    ulozNastavenia();
    pouziNastavenia();
    track('game_setting', { game: 'owls', setting: kluc, on: el.checked });
  });
});

/* ── Account sync (only when signed in, silent otherwise) ────────────────
 * The account stores one object per game: { dni: { 'YYYY-MM-DD': stav }, t }.
 * On merge, for each day the record with the higher `t` wins, but a `done` on
 * either side is never dropped. The streak is then rebuilt from the merged
 * solved days instead of trusted as a stored number. */
function stavVsetkychDni() {
  const out = {};
  for (const k of vsetkyKluce('owls:')) {
    const d = k.slice('owls:'.length);
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
function prepocitajSeriu() {
  const dni = stavVsetkychDni();
  let d = dni[dnes] && dni[dnes].done ? dnes : posunDen(dnes, -1);
  let pocet = 0;
  while (dni[d] && dni[d].done) { pocet++; d = posunDen(d, -1); }
  if (!pocet) { try { localStorage.removeItem('owls:streak'); } catch (e) { /* nothing */ } return; }
  uloz('owls:streak', { posledny: dni[dnes] && dni[dnes].done ? dnes : posunDen(dnes, -1), pocet });
}
function odosliStav() {
  if (!ucet.prihlaseny()) return;
  ucet.hra.uloz('owls', { dni: stavVsetkychDni(), t: Date.now() }).catch(() => { /* network error: this browser stays the truth */ });
}
let syncCakanie = null, syncPosledny = 0;
function naplanujOdoslanie() {
  if (!ucet.prihlaseny()) return;
  const zvysok = 2000 - (Date.now() - syncPosledny);
  if (zvysok <= 0) { syncPosledny = Date.now(); odosliStav(); return; }
  if (syncCakanie) return;
  syncCakanie = setTimeout(() => { syncCakanie = null; syncPosledny = Date.now(); odosliStav(); }, zvysok);
}
/* The saved player's owls laid over the givens; anything that does not fit
 * the tree (a different size, a strange value) is dropped. */
function doskaZUlozenej(st) {
  const out = zadanie.givens.map((x) => (x == null ? 0 : x + 1));
  if (st && Array.isArray(st.v) && st.v.length === C) {
    for (let i = 0; i < C; i++) if (!jeDana(i) && (st.v[i] === 1 || st.v[i] === 2)) out[i] = st.v[i];
  }
  return out;
}
async function synchronizujUcet() {
  if (!ucet.prihlaseny()) return;
  let vzdialene;
  try { vzdialene = await ucet.hra.nacitaj('owls'); } catch (e) { return; /* network error: this browser stays the truth */ }
  const diaDni = vzdialene && vzdialene.dni && typeof vzdialene.dni === 'object' ? vzdialene.dni : {};
  let zmenene = false;
  for (const [d, r] of Object.entries(diaDni)) {
    if (!isValidDate(d) || !r || typeof r !== 'object') continue;
    const kluc = 'owls:' + d;
    const l = nacitaj(kluc);
    const scelene = zlucStavDna(l, r);
    if (!l || JSON.stringify(l) !== JSON.stringify(scelene)) { uloz(kluc, scelene); zmenene = true; }
  }
  if (zmenene) {
    prepocitajSeriu();
    ukazSeriu();
    ukazHistoriu();
    ukazPasik();
    if (rezim === 'den' && !done && zadanie) {
      const cerstve = nacitaj(KLUC);
      if (cerstve && Array.isArray(cerstve.v) && cerstve.v.length === C && (cerstve.t || 0) > ((ulozene && ulozene.t) || 0)) {
        ulozene = cerstve;
        v = doskaZUlozenej(cerstve);
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
  // push back too: a day solved only in this browser reaches the account at once
  odosliStav();
}

/* ── Start ────────────────────────────────────────────────────────────── */
async function spusti() {
  if (jeBuduci) {
    datumEl.textContent = pekneDatum(datum);
    stavEl.textContent = 'This roost opens on ' + pekneDatum(datum) + ' (Bratislava time). Come back then, or play today’s roost.';
    doska.hidden = true;
    for (const b of [spatBtn, znovaBtn, resetBtn, checkBtn, hintBtn]) if (b) b.disabled = true;
    ukazPasik();
    return;
  }
  try {
    zadanie = await nacitajZadanie();
  } catch (e) {
    stavEl.textContent = 'The tree could not be prepared. Please reload the page.';
    throw e;
  }
  n = zadanie.n;
  C = n * n;
  ulozene = nacitaj(KLUC);
  v = doskaZUlozenej(ulozene);
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
  if (datumEl) datumEl.textContent = rezim === 'cvicenie' ? UROVNE[zadanie.uroven].label + ' practice ' + sada.split('-')[1] + ', tree ' + kSada : pekneDatum(datum);
  if (urovenEl) urovenEl.textContent = UROVNE[zadanie.uroven].label + ' · ' + n + '×' + n;
  if (done) doska.classList.add('hotovo');
  else if (mahrac()) pozastav(true);
  ukazCas();
  ukazSeriu();
  ukazHistoriu();
  ukazPasik();
  ukazStav();
  ukazTlacidla();
}
spusti().then(synchronizujUcet);
