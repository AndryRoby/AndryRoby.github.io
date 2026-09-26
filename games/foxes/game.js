import '../kniha.mjs?v=1';
/* Foxes: the game page. One script for the daily lair, the archive days and
 * the practice sets; the page says which one it is:
 *
 *   <body data-den="YYYY-MM-DD">          an archive day (built page)
 *   <body data-sada="easy-1" data-k="3">  a practice lair
 *   nothing                               today's lair (or ?d=YYYY-MM-DD)
 *
 * The puzzle comes, in this order: from <script type="application/json"
 * id="zadanie"> embedded in a built page; from dni/YYYY-MM.json for the day;
 * or, when both are missing, built right here from the date. All three give
 * the same lair for the same date (plan.mjs, generator.mjs).
 *
 * Controls: pattern A of ops/spec-hry-ux.md (cells with values, selection as
 * in Cracking the Cryptic) with three written deviations (ops/spec-foxes.md
 * part 9): no Corner and no Colour mode; X is the cross "nobody here"; and a
 * piece stands on the board once, so putting it down elsewhere moves it. A
 * number typed with several cells picked goes in as a note.
 *
 * The board is three arrays over the cells (logika.mjs): k the piece or -1,
 * x the crosses, m the notes as one bit per piece. A piece hides the notes of
 * its cell without throwing them away (Fill cell), so Delete brings them back.
 *
 * Stored in localStorage (all in try/catch, private windows throw):
 *   foxes:YYYY-MM-DD      { k, x, m, ind, sec, start, done, hints, checks, t }
 *   foxes:p:<set>:<k>     the same for a practice lair
 *   foxes:streak          { posledny, pocet, odpusteneMesiac, odpustene }
 *   foxes:nastavenia      the settings panel
 * ind = which clues you struck out. Outgoing events via window.umami, if it
 * runs: game_solved, game_check, game_hint, game_setting, game_share. Nothing
 * else leaves the browser, unless the player is signed in (arling.sk account,
 * /style/ucet.js): then every day record is pushed to the account (throttled,
 * 2 s) and pulled back on load.
 */
import { zadaniePreDen, zadanieCvicenie, rozbal, tyzden, urovenDna, posunDen, pekneDatum, kratkyDatum, UROVNE, SADY, PRVY_DEN, DNI } from './plan.mjs';
import { todayBratislava, isValidDate, textIndicie, vetaRozuzlenia, menoKusu, menoKomory, struktura } from './generator.mjs';
// Which days still have a page of their own and what ?d= may hold: one rule
// for every game, /games/okno.mjs (the generators read the same file).
import { denZParametra, adresaDna, trvalaAdresaDna } from '../okno.mjs?v=1';
import { prazdnaPlocha, kopiaPlochy, jeVyriesene, porovnaj, napoveda, pouziNapovedu, autoKriz, polozKus } from './logika.mjs';
import { plochaHTML, legendaHTML, obsadenieHTML, indicieHTML, padHTML, uvodText, otazkaText, kusHTML, poznamkyHTML, popisBunky, coMenuje } from './plocha.mjs';
import * as ucet from '/style/ucet.js';
import { oslava } from '../oslava.js';
// The play screen (../hra-ui.js): the rule in one line over the board with a
// Rules panel and the board sized to the window. The buttons stay in the
// grid of chips below (.vstup), so they are not pinned here.
import { hraUi } from '../hra-ui.js?v=1';
hraUi({ pravidlo: 'One piece in every row and column, never on a stone. The fox alone in a chamber with the lost thing has it.' });

const $ = (id) => document.getElementById(id);
const doska = $('doska');
const padEl = $('pad');
const nastrojeEl = $('nastroje');
const legendaEl = $('legenda');
const stavEl = $('stav');
const rozuzlenieEl = $('rozuzlenie');
const casEl = $('cas');
const datumEl = $('datum');
const seriaEl = $('seria');
const spatBtn = $('spat');
const znovaBtn = $('znova');
const resetBtn = $('reset');
const checkBtn = $('check');
const hintBtn = $('hint');
const niktoBtn = $('nikto');
const poznamkyBtn = $('rezim-poznamky');
const zmazBtn = $('zmaz');
const pauzaBtn = $('pauza');
const pauzaBlok = $('pauza-blok');
const pokracujBtn = $('pokracuj');
const pauzaCas = $('pauza-cas');
const pasik = $('pasik');
const urovenEl = $('uroven');
const historiaEl = $('historia');
const indicieEl = $('indicie-zoznam');
const indicieBox = $('indicie');
const viacBtn = $('indicie-viac');
const otazkaEl = $('otazka');
const uvodEl = $('uvod');
const obsadenieEl = $('obsadenie');
const zdielanieEl = $('zdielanie');
const zdielajBtn = $('zdielaj');
const zdielanieStav = $('zdielanie-stav');
const zdielanieText = $('zdielanie-text');
const citacEl = $('citac');
const citacText = $('citac-text');
const citacPocet = $('citac-pocet');

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

/* ── Settings (ops/spec-foxes.md part 9) ──────────────────────────────── *
 * The standard's defaults: Show timer ON, Live check OFF, Auto pause ON,
 * Patterns with colors ON, Confirm before Clear ON, Celebration ON, Onscreen
 * input only OFF, dragging selects several cells; and three of our own: Auto
 * cross OFF (the standard's default, part 2), Strike used clues ON and
 * Highlight what a clue names ON. Reduced motion follows the system. */
const NASTAVENIA_KLUC = 'foxes:nastavenia';
const NASTAVENIA_PREDVOLENE = {
  casovac: true, zivaKontrola: false, pauzaPriOdchode: true, vzory: true, potvrditReset: true, oslava: true,
  lenPad: false, tahVyber: 'viac', autoKriz: false, preskrtnutie: true, zvyraznenie: true,
};
let nastavenia = Object.assign({}, NASTAVENIA_PREDVOLENE, nacitaj(NASTAVENIA_KLUC) || {});
function ulozNastavenia() { uloz(NASTAVENIA_KLUC, nastavenia); }

/* ── Which lair ───────────────────────────────────────────────────────── */
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
const KLUC = rezim === 'cvicenie' ? 'foxes:p:' + sada + ':' + kSada : 'foxes:' + datum;
// The root address always opens today's lair; once the date is settled,
// rewrite it to today's built page so a shared link points at the day.
if (rezim === 'den' && !body.dataset.den && jeDnes && !location.search) {
  try { history.replaceState(null, '', '/games/foxes/' + datum + '/'); } catch (e) { /* the address stays generic */ }
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

/* ── Loading the lair ─────────────────────────────────────────────────── */
function vlozene() {
  const el = $('zadanie');
  if (!el) return null;
  try { return rozbal(JSON.parse(el.textContent)); } catch (e) { return null; }
}
async function zTabulky(iso) {
  try {
    const r = await fetch('/games/foxes/dni/' + iso.slice(0, 7) + '.json', { cache: 'no-cache' });
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
let zadanie, S, n, V, plocha, ind, vety;
let start, done, sekundy, hints, checks, ulozene;
let undoStack = [];
let redoStack = [];
let vyber = new Set();        // the picked cells
let kurzor = -1;              // the cell the arrows move from, and the only one in the tab order
let poznamkovyRezim = false;  // Notes: a number writes a note
let tikac = null;
let necinnost = null;
let pauza = false;
let tip = null;               // the hint on screen after its first press
let zvyraznene = [];          // cells lit by the second press of Hint
let odhalene = false;         // Check's second step is showing the wrong marks
let checkStav = null;         // what the last Check saw
let vybranaVeta = -1;         // the clue whose names are outlined
let citacI = 0;               // the clue the one line reader under the board shows
let nedavneHinty = [];        // the hints taken, oldest first, as { cisla, kusy }: a clue used
                              // again on the same piece says "again" (logika.mjs napoveda)
const bunky = [];
const cipy = [];
const kamen = new Set();

/* ── Drawing ──────────────────────────────────────────────────────────── */
function merajBunku() {
  const w = doska.clientWidth;
  if (w > 0 && n) doska.style.setProperty('--cell', (w / n) + 'px');
}
if (window.ResizeObserver) new ResizeObserver(merajBunku).observe(doska);
else window.addEventListener('resize', merajBunku);

function postavPlochu() {
  document.documentElement.style.setProperty('--n', n);
  doska.style.setProperty('--n', n);
  doska.setAttribute('aria-label', 'Lair ' + n + ' by ' + n + ', ' + zadanie.K + ' chambers');
  if (doska.querySelectorAll('.b').length !== n * n) doska.innerHTML = plochaHTML(zadanie);
  bunky.length = 0;
  doska.querySelectorAll('.b').forEach((b) => { bunky[+b.dataset.i] = b; });
  kamen.clear();
  for (const c of zadanie.kamene) kamen.add(c);
  if (!legendaEl.querySelector('li')) legendaEl.innerHTML = legendaHTML(zadanie);
  if (padEl && padEl.querySelectorAll('.cip').length !== n) padEl.innerHTML = padHTML(zadanie);
  if (padEl) { padEl.dataset.n = String(n); padEl.style.setProperty('--kusov', n); }
  cipy.length = 0;
  if (padEl) padEl.querySelectorAll('.cip').forEach((b) => { cipy[+b.dataset.kus] = b; });
  indicieEl.innerHTML = indicieHTML(zadanie, vety);
  if (otazkaEl) otazkaEl.innerHTML = '<b>The question.</b> ' + otazkaText(zadanie);
  if (uvodEl) uvodEl.textContent = uvodText(zadanie);
  if (obsadenieEl) obsadenieEl.innerHTML = obsadenieHTML(zadanie);
  if (citacEl) citacEl.hidden = !vety.length;
  ukazViac();
  merajBunku();
}

function obsahBunky(c) {
  const p = plocha.k[c];
  if (p >= 0) return { html: kusHTML(zadanie, p), slovo: menoKusu(zadanie, p) };
  if (plocha.x[c]) return { html: '<span class="kriz"></span>', slovo: 'nobody' };
  if (plocha.m[c]) {
    const mena = [];
    for (let q = 0; q < n; q++) if ((plocha.m[c] >> q) & 1) mena.push(q === V ? zadanie.vec : zadanie.mena[q].charAt(0));
    return { html: poznamkyHTML(zadanie, plocha.m[c]), slovo: 'notes ' + mena.join(', ') };
  }
  return { html: '', slovo: 'empty' };
}
function ukazBunku(c) {
  const b = bunky[c];
  if (!b) return;
  const o = b.querySelector('.o');
  if (kamen.has(c)) { b.setAttribute('aria-label', popisBunky(zadanie, c) + ': stone'); return; }
  const x = obsahBunky(c);
  if (o && o.innerHTML !== x.html) o.innerHTML = x.html;
  b.setAttribute('aria-label', popisBunky(zadanie, c) + ': ' + x.slovo);
}
function oznacVyber() {
  for (const b of bunky) if (b) { b.classList.remove('vybrana'); b.removeAttribute('aria-selected'); b.tabIndex = -1; }
  for (const c of vyber) if (bunky[c]) { bunky[c].classList.add('vybrana'); bunky[c].setAttribute('aria-selected', 'true'); }
  const t = kurzor >= 0 && bunky[kurzor] ? bunky[kurzor] : bunky[0];
  if (t) t.tabIndex = 0;
}
function ukazVsetko() {
  for (let c = 0; c < n * n; c++) ukazBunku(c);
  ukazIndicie();
  oznacVyber();
  zivaKontrola();
}
function zmazTip() {
  for (const c of zvyraznene) if (bunky[c]) bunky[c].classList.remove('tip');
  zvyraznene = [];
  if (!tip) return;
  tip = null;
  for (const b of bunky) if (b) b.classList.remove('tip-oblast');
  for (const c of cipy) if (c) c.classList.remove('tip-kus');
  indicieEl.querySelectorAll('li').forEach((li) => li.classList.remove('tip-veta'));
  if (citacEl) citacEl.classList.remove('tip-veta');
  if (hintBtn) hintBtn.textContent = 'Hint';
}
function zmazOdhalenie() {
  if (!odhalene && !checkStav) return;
  odhalene = false; checkStav = null;
  for (const b of bunky) if (b) b.classList.remove('chyba');
  if (checkBtn) checkBtn.textContent = 'Check';
}
/* Live check is off by default; when it is on, a wrong fox or cross is
   marked as soon as it goes down, with the frame and the badge. */
function zivaKontrola() {
  if (!zadanie) return;
  if (!nastavenia.zivaKontrola) { if (!odhalene) for (const b of bunky) if (b) b.classList.remove('chyba'); return; }
  if (done) return;
  for (const b of bunky) if (b) b.classList.remove('chyba');
  for (const z of porovnaj(plocha, zadanie).zle) if (bunky[z.bunka]) bunky[z.bunka].classList.add('chyba');
}

/* ── The clues ────────────────────────────────────────────────────────── */
function ukazIndicie() {
  indicieEl.querySelectorAll('li').forEach((li) => {
    const i = +li.dataset.i;
    const b = li.querySelector('.veta');
    if (b) b.setAttribute('aria-pressed', ind[i] ? 'true' : 'false');
    li.classList.toggle('citana', i === vybranaVeta);
  });
  ukazCitac();
}
/* The reader under the board: one clue, its number and the count. It follows
   the list (a clue tapped there shows here), and its arrows outline what the
   clue names, as a tap in the list does, without striking it out. */
function ukazCitac() {
  if (!citacEl || !vety || !vety.length) return;
  citacI = Math.max(0, Math.min(citacI, vety.length - 1));
  citacText.innerHTML = '';
  const b = document.createElement('b');
  b.textContent = (citacI + 1) + '.';
  const s = document.createElement('span');
  s.textContent = vety[citacI];
  citacText.append(b, s);
  citacText.setAttribute('aria-pressed', ind && ind[citacI] ? 'true' : 'false');
  citacText.setAttribute('aria-label', 'Clue ' + (citacI + 1) + ': ' + vety[citacI]);
  if (citacPocet) citacPocet.textContent = (citacI + 1) + ' / ' + vety.length;
  citacEl.classList.toggle('hotova', !!(ind && ind[citacI]));
}
function posunCitac(o) {
  if (!vety || !vety.length) return;
  citacI = (citacI + o + vety.length) % vety.length;
  vybranaVeta = citacI;
  ukazIndicie();
  ukazVetuVPloche(vybranaVeta);
}
/* Outline what a clue names: its chamber, the cells with its mark, its edge,
   the cells next to a stone, and the chips of the pieces it is about. */
function ukazVetuVPloche(i) {
  for (const b of bunky) if (b) b.classList.remove('svit');
  for (const c of cipy) if (c) c.classList.remove('svit');
  if (!nastavenia.zvyraznenie || i < 0 || !zadanie.clues[i]) return;
  const x = coMenuje(zadanie, zadanie.clues[i], S);
  for (const c of x.bunky) if (bunky[c]) bunky[c].classList.add('svit');
  for (const p of x.kusy) if (cipy[p]) cipy[p].classList.add('svit');
}
function preskrtni(i) {
  citacI = i;
  vybranaVeta = vybranaVeta === i && !nastavenia.preskrtnutie ? -1 : i;
  if (nastavenia.preskrtnutie && !done && !pauza) {
    zmenaStavu(() => { ind[i] = ind[i] ? 0 : 1; });
  }
  ukazIndicie();
  ukazVetuVPloche(vybranaVeta);
}
function ukazViac() {
  if (!viacBtn || !indicieBox) return;
  const otvorene = indicieBox.classList.contains('rozbalene');
  viacBtn.setAttribute('aria-expanded', otvorene ? 'true' : 'false');
  viacBtn.textContent = otvorene ? 'Fewer' : (vety && vety.length ? 'All ' + vety.length : 'All clues');
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
   after a minute without a single move (ops/spec-hry-ux.md, part 6). */
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
  if (pauzaCas) pauzaCas.textContent = sekundy ? 'You have spent ' + slovaCas(sekundy) + ' so far.' : 'Your marks are kept; the clock continues when you resume.';
  if (pauzaBlok) pauzaBlok.hidden = false;
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
  spustiTikac();
  nastavNecinnost();
  ulozStav();
  ukazCas();
  ukazTlacidla();
}

/* ── Streak and history ───────────────────────────────────────────────── *
 * One missed day after five wins is forgiven, at most twice a month
 * (ops/spec-hry-ux.md part 8), the same step for playing and for the rebuild
 * after an account merge. Only a lair solved on its own day counts. */
const ODPUSTENI_ZA_MESIAC = 2;
function odpusteniVMesiaci(s, den) { return s && s.odpusteneMesiac === den.slice(0, 7) ? (s.odpustene || 0) : 0; }
function odpustitVieme(s, den) {
  if (!s || s.pocet < 5) return false;
  if (s.posledny !== posunDen(den, -2)) return false;
  return odpusteniVMesiaci(s, den) < ODPUSTENI_ZA_MESIAC;
}
function krokSerie(s, den) {
  const odpustene = odpusteniVMesiaci(s, den);
  let pocet = 1, minute = 0;
  if (s.posledny === posunDen(den, -1)) pocet = s.pocet + 1;
  else if (odpustitVieme(s, den)) { pocet = s.pocet + 1; minute = 1; }
  return { posledny: den, pocet, odpusteneMesiac: den.slice(0, 7), odpustene: odpustene + minute };
}
function ukazSeriu() {
  if (!seriaEl) return;
  const s = nacitaj('foxes:streak');
  if (!s || !s.pocet) { seriaEl.textContent = ''; return; }
  const ziva = s.posledny === dnes || s.posledny === posunDen(dnes, -1);
  const odpustime = !ziva && odpustitVieme(s, dnes);
  if (!ziva && !odpustime) { seriaEl.textContent = ''; return; }
  seriaEl.textContent = 'Streak: ' + s.pocet + (s.pocet === 1 ? ' day' : ' days') + (odpustime ? ', one missed day forgiven if you solve today' : '');
}
function zapisSeriu() {
  if (!jeDnes) return;
  const s = nacitaj('foxes:streak') || { posledny: null, pocet: 0 };
  if (s.posledny === datum) return;
  uloz('foxes:streak', krokSerie(s, datum));
}
function historiaDni() {
  const out = [];
  for (const k of vsetkyKluce('foxes:')) {
    const d = k.slice('foxes:'.length);
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
  historiaEl.innerHTML = '<b>Your lairs:</b> ' + h.length + ' solved' + (urovne ? ' (' + urovne + ')' : '') + (ciste ? ', ' + ciste + ' clean, with no hint and no check' : ', none clean yet')
    + (best ? ', best ' + formatCas(best.sec) + ' on ' + kratkyDatum(best.d) : '') + (priemer ? ', average ' + formatCas(priemer) : '') + '. <a href="/games/foxes/archive/">Archive and full history</a>.';
}

/* ── Saving ───────────────────────────────────────────────────────────── */
function ulozStav() {
  uloz(KLUC, { k: plocha.k.slice(), x: plocha.x.slice(), m: plocha.m.slice(), ind: ind.slice(), sec: sekundy, start, done, hints, checks, t: Date.now() });
  naplanujOdoslanie();
}
function vlozUlozene(st) {
  const C = n * n;
  plocha = prazdnaPlocha(zadanie);
  if (st && Array.isArray(st.k) && st.k.length === C) {
    const videne = new Set();
    for (let c = 0; c < C; c++) {
      const p = st.k[c];
      if (Number.isInteger(p) && p >= 0 && p < n && !videne.has(p) && !kamen.has(c)) { plocha.k[c] = p; videne.add(p); }
    }
  }
  if (st && Array.isArray(st.x) && st.x.length === C) for (let c = 0; c < C; c++) plocha.x[c] = st.x[c] && !kamen.has(c) ? 1 : 0;
  if (st && Array.isArray(st.m) && st.m.length === C) for (let c = 0; c < C; c++) plocha.m[c] = kamen.has(c) ? 0 : (st.m[c] | 0) & ((1 << n) - 1);
  ind = new Array(zadanie.clues.length).fill(0);
  if (st && Array.isArray(st.ind)) for (let i = 0; i < ind.length && i < st.ind.length; i++) ind[i] = st.ind[i] ? 1 : 0;
  done = st && st.done ? st.done : null;
  nedavneHinty = [];
  hints = st && st.hints ? st.hints : 0;
  checks = st && st.checks ? st.checks : 0;
  sekundy = st && st.sec ? st.sec : 0;
}
function jeRozohrane(st) {
  if (!st) return false;
  for (const k of ['x', 'm', 'ind']) if (Array.isArray(st[k]) && st[k].some((v) => v)) return true;
  return Array.isArray(st.k) && st.k.some((v) => v >= 0);
}

/* ── Moves, Undo and Redo ─────────────────────────────────────────────── *
 * Every change goes through zmenaStavu: it keeps the board and the struck
 * clues before and after, so Undo and Redo are one shared stack with no
 * limit, a move of a piece or a sweep of notes is a single step, and Clear is
 * undone by one Undo (ops/spec-hry-ux.md part 3). */
/* The hints taken travel with the board through Undo and Redo, so a hint
   taken back does not come back as "again". */
function snimka() { return { pl: kopiaPlochy(plocha), ind: ind.slice(), ned: nedavneHinty.slice() }; }
function rovnake(a, b) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
function rovnakaSnimka(a, b) { return rovnake(a.pl.k, b.pl.k) && rovnake(a.pl.x, b.pl.x) && rovnake(a.pl.m, b.pl.m) && rovnake(a.ind, b.ind); }
function obnovSnimku(s) { plocha = kopiaPlochy(s.pl); ind = s.ind.slice(); nedavneHinty = (s.ned || []).slice(); }
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
  if (!start && !done) { start = Date.now(); spustiTikac(); }
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) ulozStav();
  ukazStav();
  ukazCas();
  ukazTlacidla();
  nastavNecinnost();
}
function ukazTlacidla() {
  const zamknute = pauza || !!done;
  if (spatBtn) spatBtn.disabled = zamknute || !undoStack.length;
  if (znovaBtn) znovaBtn.disabled = zamknute || !redoStack.length;
  for (const b of [resetBtn, checkBtn, hintBtn]) if (b) b.disabled = zamknute;
  // The pad and the marks do nothing in a pause or on a solved lair, so they
  // are switched off too and look it (critic 25. 9., finding 10).
  for (const b of [...cipy, niktoBtn, poznamkyBtn, zmazBtn]) if (b) b.disabled = zamknute;
  if (poznamkyBtn) poznamkyBtn.setAttribute('aria-pressed', poznamkovyRezim ? 'true' : 'false');
}
function spat() {
  if (done || pauza || !undoStack.length) return;
  redoStack.push(snimka());
  obnovSnimku(undoStack.pop());
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) ulozStav();
  ukazStav();
  ukazTlacidla();
}
function znova() {
  if (done || pauza || !redoStack.length) return;
  undoStack.push(snimka());
  obnovSnimku(redoStack.pop());
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) ulozStav();
  ukazStav();
  ukazTlacidla();
}

/* Put piece p down in the one picked cell, or take it back when it is
   already there. With several cells picked the number goes in as a note:
   a piece can only be in one place. */
function vlozKus(p, akoPoznamku) {
  if (done || pauza || p < 0 || p >= n) return;
  const ciel = [...vyber];
  if (!ciel.length) { stavEl.textContent = 'Pick a cell first, then a fox.'; return; }
  if (akoPoznamku || poznamkovyRezim) { prepniPoznamku(p, ciel); return; }
  if (ciel.length > 1) {
    prepniPoznamku(p, ciel);
    stavEl.textContent = p === V ? 'The ' + zadanie.vec + ' can only be in one place, so this went in as a note.' : 'One fox can only be in one place, so this went in as a note.';
    return;
  }
  const c = ciel[0];
  if (kamen.has(c)) { stavEl.textContent = 'Nobody can be on a stone.'; return; }
  if (plocha.k[c] === p) { zmenaStavu(() => { plocha.k[c] = -1; }); return; }
  zmenaStavu(() => {
    plocha = polozKus(plocha, zadanie, p, c);
    if (nastavenia.autoKriz) for (const d of autoKriz(plocha, zadanie, c)) plocha.x[d] = 1;
  });
}
function prepniPoznamku(p, ciel) {
  const cele = ciel.filter((c) => !kamen.has(c));
  if (!cele.length) { stavEl.textContent = 'Nobody can be on a stone.'; return; }
  const vsetky = cele.every((c) => (plocha.m[c] >> p) & 1);
  zmenaStavu(() => { for (const c of cele) { if (vsetky) plocha.m[c] &= ~(1 << p); else plocha.m[c] |= 1 << p; } });
}
/* Nobody: the cross goes on every picked cell that has no piece, or comes off
   when all of them have it already. */
function prepniKriz() {
  if (done || pauza) return;
  const ciel = [...vyber].filter((c) => !kamen.has(c) && plocha.k[c] < 0);
  if (!vyber.size) { stavEl.textContent = 'Pick a cell first, then Nobody.'; return; }
  if (!ciel.length) { stavEl.textContent = [...vyber].some((c) => kamen.has(c)) ? 'A stone needs no cross: nobody can be on it anyway.' : 'Take the fox off first.'; return; }
  const vsetky = ciel.every((c) => plocha.x[c]);
  zmenaStavu(() => { for (const c of ciel) plocha.x[c] = vsetky ? 0 : 1; });
}
/* Delete and Backspace in the order of the standard: the pieces first, then
   the notes, then the crosses. */
function zmaz() {
  if (done || pauza) return;
  const ciel = [...vyber];
  if (!ciel.length) return;
  if (ciel.some((c) => plocha.k[c] >= 0)) { zmenaStavu(() => { for (const c of ciel) plocha.k[c] = -1; }); return; }
  if (ciel.some((c) => plocha.m[c])) { zmenaStavu(() => { for (const c of ciel) plocha.m[c] = 0; }); return; }
  zmenaStavu(() => { for (const c of ciel) plocha.x[c] = 0; });
}
/* Clear: an empty board, struck clues too; the clock keeps running and one
   Undo brings it all back. */
function reset() {
  if (done || pauza) return;
  if (!jeRozohrane({ k: plocha.k, x: plocha.x, m: plocha.m, ind })) return;
  if (nastavenia.potvrditReset && !window.confirm('Clear the whole lair? The clock keeps running, and one Undo brings it back.')) return;
  zmenaStavu(() => { plocha = prazdnaPlocha(zadanie); ind = new Array(zadanie.clues.length).fill(0); nedavneHinty = []; });
}
function prepniRezim() {
  poznamkovyRezim = !poznamkovyRezim;
  ukazTlacidla();
  stavEl.textContent = poznamkovyRezim ? 'Notes are on: a fox now goes in as a small letter.' : 'Notes are off: a fox now goes in whole.';
}

/* ── The result panel ─────────────────────────────────────────────────── */
function ukazStav() {
  stavEl.classList.toggle('ok', !!done);
  if (zdielanieEl) zdielanieEl.hidden = !done;
  if (done) {
    const s = sekundy ? ' in ' + formatCas(sekundy) : '';
    const pomoc = [];
    if (hints) pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
    if (checks) pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
    const hn = pomoc.length ? ' with ' + pomoc.join(' and ') : ' without a hint or a check';
    const seria = jeDnes ? (nacitaj('foxes:streak') || {}).pocet || 0 : 0;
    stavEl.innerHTML = '<b>Solved</b>' + s + hn + '. Every fox is in its place.' + (jeDnes ? ' A new lair arrives at midnight, Bratislava time.' : '')
      + (seria >= 1 ? '<span class="oslava-streak">Day ' + seria + ' of your streak.</span>' : '')
      + '<span class="oslava-dalej"><a href="/games/foxes/practice/">Practice sets</a></span>';
    ukazRozuzlenie();
    return;
  }
  if (rozuzlenieEl) { rozuzlenieEl.hidden = true; rozuzlenieEl.textContent = ''; }
  const polozene = plocha.k.filter((p) => p >= 0).length;
  if (!polozene && !plocha.x.some((x) => x) && !plocha.m.some((x) => x)) { stavEl.textContent = 'Read a clue, pick a cell, then a fox from the row under the board.'; return; }
  if (polozene === n) { stavEl.textContent = 'Everyone is placed, but the lair is not right yet. Check shows where.'; return; }
  // A message from the move before does not outlive the next move; the
  // callers that have something to say write it after the move.
  stavEl.textContent = '';
}
/* The reward of the genre, and it is nowhere in the page before the lair is
   solved: one sentence, in bold. */
function ukazRozuzlenie() {
  if (!rozuzlenieEl) return;
  rozuzlenieEl.innerHTML = '<p>' + vetaRozuzlenia(zadanie) + '</p>';
  rozuzlenieEl.hidden = false;
}

/* ── Check, in two steps ──────────────────────────────────────────────── *
 * Wrong foxes and wrong crosses are counted, never notes. The first press
 * says how many and roughly where (rows, columns or chambers, whichever takes
 * fewest words); the second marks them. With several cells picked only those
 * are checked. A third press on a board that has not changed says so and does
 * not count again. */
function podpisPlochy() { return plocha.k.join(',') + '|' + plocha.x.join(''); }
function skontrolujStav() {
  if (done || pauza) return;
  const len = vyber.size > 1 ? new Set(vyber) : null;
  const p = porovnaj(plocha, zadanie, len);
  const uvod = len ? 'Among the cells you picked: ' : '';
  if (!p.lisky && !p.vec && !p.kriziky) { stavEl.textContent = uvod + 'Nothing on the board yet.'; return; }
  const podpis = podpisPlochy() + (len ? '|' + [...len].join(',') : '');
  if (p.zle.length && odhalene && checkStav && checkStav.podpis === podpis) {
    stavEl.textContent = 'The marked ones are still wrong. Clear them and keep going.';
    return;
  }
  checks++;
  ulozStav();
  if (!p.zle.length) {
    zmazOdhalenie();
    const casti = [];
    if (p.lisky) casti.push(p.lisky + (p.lisky === 1 ? ' fox' : ' foxes') + ' placed');
    if (p.vec) casti.push('the ' + zadanie.vec + ' placed');
    if (p.kriziky) casti.push(p.kriziky + (p.kriziky === 1 ? ' cross' : ' crosses'));
    const vsetko = p.lisky + p.vec + p.kriziky;
    stavEl.textContent = uvod + (vsetko === 1
      ? 'Right so far: ' + casti[0] + ', and it fits the finished lair.'
      : 'Everything right so far: ' + zoznamSlov(casti) + ', not one of them wrong.');
    track('game_check', { game: 'foxes', wrong: 0 });
    return;
  }
  if (checkStav && !odhalene && checkStav.podpis === podpis) {
    odhalene = true;
    for (const z of p.zle) if (bunky[z.bunka]) bunky[z.bunka].classList.add('chyba');
    stavEl.textContent = 'The marked ones do not fit the finished lair. Clear them and keep going.';
    checkBtn.textContent = 'Check';
    track('game_check', { game: 'foxes', wrong: p.zle.length, revealed: true });
    return;
  }
  const riadky = [], stlpce = [], komory = [];
  for (const z of p.zle) {
    const r = ((z.bunka / n) | 0) + 1, s = (z.bunka % n) + 1, k = zadanie.komory[z.bunka];
    if (!riadky.includes(r)) riadky.push(r);
    if (!stlpce.includes(s)) stlpce.push(s);
    if (!komory.includes(k)) komory.push(k);
  }
  const skupiny = [
    { pocet: riadky.length, mena: riadky.sort((a, b) => a - b).map((r) => 'row ' + r) },
    { pocet: stlpce.length, mena: stlpce.sort((a, b) => a - b).map((s) => 'column ' + s) },
    { pocet: komory.length, mena: komory.map((k) => menoKomory(zadanie, k)) },
  ];
  const naj = skupiny.reduce((a, b) => (b.pocet < a.pocet ? b : a));
  const kde = naj.mena.slice(0, 4);
  checkStav = { podpis };
  stavEl.textContent = uvod + (p.zle.length === 1 ? '1 of your marks is wrong' : p.zle.length + ' of your marks are wrong') + ', in '
    + zoznamSlov(kde) + (naj.mena.length > 4 ? ' and elsewhere' : '') + '. Press Check again to show where.';
  checkBtn.textContent = 'Show';
  track('game_check', { game: 'foxes', wrong: p.zle.length, revealed: false });
}

/* ── Hint, in two steps ───────────────────────────────────────────────── *
 * The first press says which clue or technique and outlines where to look,
 * without naming the fox; the second takes exactly that one step (a fox put
 * down, notes written, or cells crossed) and explains it in full. A wrong
 * mark comes first. Every hint is counted and shown at the end. */
const TLACIDLO = { poloz: 'Place it', poznamky: 'Write notes', kriz: 'Cross out', chyba: 'Take it off', odhalenie: 'Place it', oboje: 'Mark it' };
const POKYN = { poloz: 'to put it down', poznamky: 'to write the notes', kriz: 'to cross those cells out', chyba: 'to take it off', odhalenie: 'to put it down', oboje: 'to write the notes and the crosses' };
/* One step can leave notes and crosses at once; the second press writes both. */
function druhTlacidla(h) { return h.druh === 'poznamky' && h.kriz && h.kriz.length ? 'oboje' : h.druh; }
function ukazNapovedu() {
  if (done || pauza) return;
  if (tip) {
    const h = tip;
    hints++;
    const zmenilo = zmenaStavu(() => {
      plocha = pouziNapovedu(plocha, zadanie, h);
      nedavneHinty.push({ cisla: h.cisla || [h.cislo], kusy: (h.zapisy || []).map((z) => z.kus) });
      if (nedavneHinty.length > 12) nedavneHinty.shift();
    });
    if (!zmenilo) ulozStav();
    if (!done) {
      stavEl.textContent = h.text2;
      zvyraznene = h.druh === 'chyba' ? [] : h.bunky.slice();
      for (const c of zvyraznene) if (bunky[c]) bunky[c].classList.add('tip');
    }
    track('game_hint', { game: 'foxes', rule: h.pravidlo, layer: h.vrstva, applied: true });
    return;
  }
  const h = napoveda(plocha, zadanie, { nedavne: nedavneHinty });
  if (!h) return;
  zmazTip();
  tip = h;
  for (const c of h.oblast) if (bunky[c]) bunky[c].classList.add('tip-oblast');
  // The chips of the pieces the clue names: a clue about two pieces often
  // has nothing on the board yet to outline (critic 25. 9., round 2, finding 4).
  for (const p of h.tipKusy || []) if (cipy[p]) cipy[p].classList.add('tip-kus');
  if (h.cislo >= 0) {
    const li = indicieEl.querySelector('li[data-i="' + h.cislo + '"]');
    if (li) li.classList.add('tip-veta');
    // The reader under the board shows the clue the hint reads, so on a
    // phone it is next to the board without scrolling up.
    citacI = h.cislo;
    ukazCitac();
    if (citacEl) citacEl.classList.add('tip-veta');
  }
  const druh = druhTlacidla(h);
  stavEl.textContent = h.text1 + ' Press Hint again ' + POKYN[druh] + '.';
  hintBtn.textContent = TLACIDLO[druh] || 'Hint';
  track('game_hint', { game: 'foxes', rule: h.pravidlo, layer: h.vrstva, applied: false });
}

/* ── Finished ─────────────────────────────────────────────────────────── */
function skontroluj() {
  if (!jeVyriesene(plocha, zadanie)) return false;
  sekundy = ubehnute();
  done = Date.now();
  start = null;
  zastavTikac();
  nastavNecinnost();
  doska.classList.add('hotovo');
  zmazTip(); zmazOdhalenie();
  for (const b of bunky) if (b) b.classList.remove('chyba');
  vyber.clear(); kurzor = -1;
  oznacVyber();
  ukazCas();
  zapisSeriu();
  ukazSeriu();
  ulozStav();
  ukazHistoriu();
  ukazPasik();
  ukazTlacidla();
  track('game_solved', { game: 'foxes', day: rezim === 'den' ? datum : sada + '/' + kSada, seconds: sekundy, hints, checks, level: zadanie.uroven });
  const kontajner = document.querySelector('.hra#hra') || document.querySelector('div.hra');
  if (kontajner) oslava(kontajner, { redukovany: !nastavenia.oslava || window.matchMedia('(prefers-reduced-motion: reduce)').matches });
  return true;
}

/* ── Share ────────────────────────────────────────────────────────────── *
 * Plain text: the game, the day, the level, the time and the help used, and
 * a link. No grid and no name, so it spoils nothing. Nothing is sent. */
function odkazNaLair() {
  const b = 'arling.sk/games/foxes';
  if (rezim === 'cvicenie') return b + '/practice/' + sada + '/' + (kSada === 1 ? '' : kSada + '/');
  return jeDnes ? b : trvalaAdresaDna(b + '/', datum);
}
function textNaZdielanie() {
  // "Foxes practice, easy set 1, lair 3", never the internal id easy-1.
  const kto = rezim === 'cvicenie'
    ? 'Foxes practice, ' + UROVNE[zadanie.uroven].label.toLowerCase() + ' set ' + sada.split('-')[1] + ', lair ' + kSada
    : 'Foxes, ' + kratkyDatum(datum) + ', ' + UROVNE[zadanie.uroven].label;
  return kto + ', ' + formatCas(sekundy || 0) + ', '
    + hints + (hints === 1 ? ' hint' : ' hints') + ', ' + checks + (checks === 1 ? ' check' : ' checks') + ', ' + odkazNaLair();
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
    ? 'Copied. It names nobody and no cell, and nothing was sent anywhere.'
    : 'This browser would not let the page copy for you. Here is the text, take it from the box.';
  if (zdielanieText) {
    zdielanieText.value = text;
    zdielanieText.hidden = ok;
    if (!ok) { zdielanieText.focus(); zdielanieText.select(); }
  }
  track('game_share', { game: 'foxes', copied: ok, level: zadanie.uroven });
});

/* ── Selection ────────────────────────────────────────────────────────── *
 * A tap picks one cell, a drag picks every cell it runs over, Ctrl (Cmd)
 * plus a click adds one or takes it away; the arrows walk and wrap round the
 * edge, Ctrl plus an arrow widens the selection, Escape lets go. A stone can
 * be picked (the cursor may stand on it), but nothing is written on it. */
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
function bunkaPod(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const b = el && el.closest ? el.closest('.b') : null;
  return b && doska.contains(b) ? +b.dataset.i : -1;
}
let tah = null;
doska.addEventListener('pointerdown', (e) => {
  if (done || pauza || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const i = bunkaPod(e);
  if (i < 0) return;
  const ctrl = e.ctrlKey || e.metaKey;
  let odoberali = false;
  if (ctrl) { if (vyber.has(i)) { vyber.delete(i); odoberali = true; } else vyber.add(i); }
  else vyber = new Set([i]);
  kurzor = i;
  oznacVyber();
  if (bunky[i]) bunky[i].focus({ preventScroll: true });
  tah = { id: e.pointerId, odoberali };
  try { doska.setPointerCapture(e.pointerId); } catch (err) { /* works without capture too */ }
  e.preventDefault();
});
doska.addEventListener('pointermove', (e) => {
  if (!tah || tah.id !== e.pointerId || done || pauza || nastavenia.tahVyber !== 'viac') return;
  const i = bunkaPod(e);
  if (i < 0) return;
  if (tah.odoberali) { if (vyber.has(i)) { vyber.delete(i); kurzor = i; oznacVyber(); } return; }
  if (vyber.has(i) && kurzor === i) return;
  vyber.add(i);
  kurzor = i;
  oznacVyber();
});
function koniecTahu(e) {
  if (!tah || tah.id !== e.pointerId) return;
  tah = null;
  try { doska.releasePointerCapture(e.pointerId); } catch (err) { /* nothing */ }
}
doska.addEventListener('pointerup', koniecTahu);
doska.addEventListener('pointercancel', (e) => { if (tah && tah.id === e.pointerId) tah = null; });
doska.addEventListener('contextmenu', (e) => e.preventDefault());
doska.addEventListener('focusin', (e) => {
  const b = e.target && e.target.closest ? e.target.closest('.b') : null;
  if (!b) return;
  const i = +b.dataset.i;
  if (i !== kurzor) vyberJednu(i, false);
});

/* ── The pad ──────────────────────────────────────────────────────────── */
function vratFokus() { if (kurzor >= 0 && bunky[kurzor]) bunky[kurzor].focus({ preventScroll: true }); }
if (padEl) {
  padEl.addEventListener('click', (e) => {
    const b = e.target.closest('.cip');
    if (!b || done || pauza) return;
    vlozKus(+b.dataset.kus, false);
    vratFokus();
  });
  padEl.addEventListener('contextmenu', (e) => { if (e.target.closest('.cip')) e.preventDefault(); });
}
if (niktoBtn) niktoBtn.addEventListener('click', () => { prepniKriz(); vratFokus(); });
if (poznamkyBtn) poznamkyBtn.addEventListener('click', () => { prepniRezim(); vratFokus(); });
if (zmazBtn) zmazBtn.addEventListener('click', () => { zmaz(); vratFokus(); });
if (spatBtn) spatBtn.addEventListener('click', () => { spat(); vratFokus(); });
if (znovaBtn) znovaBtn.addEventListener('click', () => { znova(); vratFokus(); });
if (resetBtn) resetBtn.addEventListener('click', () => { reset(); vratFokus(); });
/* The sentence of Hint and Check under the buttons: when it runs past the
   bottom of the window (a long hint on a phone with its toolbars, or a low
   laptop screen), the page moves just enough to show all of it, and not at
   all when it is already in view (critic 26. 9.: at 390 x 700 the sentence
   began under the edge). */
function stavNaOci() {
  const el = done ? (rozuzlenieEl && !rozuzlenieEl.hidden ? rozuzlenieEl : stavEl) : stavEl;
  if (!el || !el.textContent) return;
  const r = el.getBoundingClientRect();
  const vyska = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  if (r.bottom <= vyska && r.top >= 0) return;
  const pokojne = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: 'nearest', behavior: pokojne ? 'auto' : 'smooth' });
}
if (checkBtn) checkBtn.addEventListener('click', () => { skontrolujStav(); vratFokus(); stavNaOci(); });
if (hintBtn) hintBtn.addEventListener('click', () => { ukazNapovedu(); vratFokus(); stavNaOci(); });
if (pauzaBtn) pauzaBtn.addEventListener('click', () => pozastav(false));
if (pokracujBtn) pokracujBtn.addEventListener('click', pokracuj);

/* ── Keyboard ─────────────────────────────────────────────────────────── *
 * One listener for the whole page. Fields and the Settings summary keep
 * their own keys.
 *   arrows, WASD        move the selection, wrapping round the edge
 *   Ctrl + arrow        widen the selection
 *   Escape              let the selection go (or resume from a pause)
 *   1 to n, numpad      put the piece down (Shift, or Notes on: a note)
 *   X                   a cross, "nobody here"
 *   N, Enter            Notes on and off
 *   Delete, Backspace   the pieces, then the notes, then the crosses
 *   U, Ctrl+Z           undo;  R, Ctrl+Y, Ctrl+Shift+Z  redo
 *   H, C                Hint and Check (each still in two presses)
 *   P                   pause and resume. Ctrl+R is never taken: it reloads. */
function vstupnePole(t) {
  if (!t) return false;
  if (t.isContentEditable) return true;
  return /^(input|textarea|select|summary|option)$/i.test(t.tagName || '');
}
document.addEventListener('keydown', (e) => {
  const t = e.target;
  if (vstupnePole(t)) return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && (e.key === 'z' || e.key === 'Z')) { if (e.shiftKey) znova(); else spat(); e.preventDefault(); return; }
  if (ctrl && (e.key === 'y' || e.key === 'Y')) { znova(); e.preventDefault(); return; }
  if (e.key === 'Escape') {
    if (pauza) { pokracuj(); return; }
    if (vyber.size) { zrusVyber(); e.preventDefault(); }
    return;
  }
  if (!ctrl && (e.key === 'p' || e.key === 'P')) {
    if (pauza) pokracuj(); else if (!done) pozastav(false);
    e.preventDefault();
    return;
  }
  if (done || pauza || !zadanie) return;
  const vDoske = !!(t && t.closest && t.closest('#doska'));
  const kod = e.code || '';
  const smery = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  const wasd = { KeyW: [-1, 0], KeyS: [1, 0], KeyA: [0, -1], KeyD: [0, 1] };
  const smer = smery[e.key] || (!ctrl && !e.shiftKey && !e.altKey ? wasd[kod] : null);
  if (smer) { posunKurzor(smer[0], smer[1], ctrl); e.preventDefault(); return; }
  // A number from the row of digits or the keypad; e.code, because Shift and
  // a digit gives a symbol in e.key.
  const cifra = /^Digit[0-9]$/.test(kod) ? +kod.slice(5) : /^Numpad[0-9]$/.test(kod) ? +kod.slice(6) : (/^[0-9]$/.test(e.key) ? +e.key : -1);
  if (cifra >= 1 && !ctrl && !e.altKey) {
    if (nastavenia.lenPad) return;
    if (cifra <= n) vlozKus(cifra - 1, e.shiftKey);
    e.preventDefault();
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') { if (!nastavenia.lenPad) zmaz(); e.preventDefault(); return; }
  if (ctrl) return;
  if (e.key === 'x' || e.key === 'X') { prepniKriz(); e.preventDefault(); return; }
  if (e.key === 'n' || e.key === 'N' || (e.key === 'Enter' && vDoske)) { prepniRezim(); e.preventDefault(); return; }
  if (e.key === 'u' || e.key === 'U') { spat(); e.preventDefault(); return; }
  if (e.key === 'r' || e.key === 'R') { znova(); e.preventDefault(); return; }
  // Hint and Check from the keyboard, so a wide screen never has to scroll
  // to them (critic 25. 9., round 2, finding 2). Both keep their two steps.
  if (e.key === 'h' || e.key === 'H') { ukazNapovedu(); stavNaOci(); e.preventDefault(); return; }
  if (e.key === 'c' || e.key === 'C') { skontrolujStav(); stavNaOci(); e.preventDefault(); return; }
});
document.addEventListener('keydown', nastavNecinnost, true);
document.addEventListener('pointerdown', nastavNecinnost, true);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (nastavenia.pauzaPriOdchode && start && !done) pozastav(true); }
  else ukazCas();
});
if (indicieEl) {
  indicieEl.addEventListener('click', (e) => {
    const b = e.target.closest('.veta');
    if (!b) return;
    preskrtni(+b.dataset.i);
  });
  indicieEl.addEventListener('mouseover', (e) => {
    const li = e.target.closest('li[data-i]');
    if (li) ukazVetuVPloche(+li.dataset.i);
  });
  indicieEl.addEventListener('mouseleave', () => ukazVetuVPloche(vybranaVeta));
}
if (viacBtn && indicieBox) viacBtn.addEventListener('click', () => { indicieBox.classList.toggle('rozbalene'); ukazViac(); });
if (citacEl) {
  $('citac-spat').addEventListener('click', () => posunCitac(-1));
  $('citac-dalej').addEventListener('click', () => posunCitac(1));
  citacText.addEventListener('click', () => { if (vety && vety.length) preskrtni(citacI); });
}

/* ── The week strip ───────────────────────────────────────────────────── *
 * A finished lair has two marks (ops/spec-hry-ux.md part 8): solved, and
 * solved clean with no hint and no check, which also gets the dot. */
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
      const st = nacitaj('foxes:p:' + sada + ':' + k);
      const a = document.createElement(k === kSada ? 'span' : 'a');
      a.className = 'den' + (k === kSada ? ' dnes' : '') + triedaStavu(st);
      if (k !== kSada) a.href = '/games/foxes/practice/' + sada + '/' + (k === 1 ? '' : k + '/');
      a.innerHTML = '<small>No.</small><b>' + k + '</b>';
      a.setAttribute('aria-label', 'Lair ' + k + slovoStavu(st));
      if (k === kSada) a.setAttribute('aria-current', 'page');
      pasik.appendChild(a);
    }
    return;
  }
  tyzden(datum).forEach((d, k) => {
    const st = nacitaj('foxes:' + d);
    const buduci = d > dnes, pred = d < PRVY_DEN;
    const tag = d === datum || buduci || pred ? 'span' : 'a';
    const a = document.createElement(tag);
    a.className = 'den' + (d === datum ? ' dnes' : '') + (buduci || pred ? ' buduci' : '') + triedaStavu(st);
    if (tag === 'a') a.href = adresaDna('/games/foxes/', d, dnes);
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
  doska.classList.toggle('vzory', !!nastavenia.vzory);
  if (legendaEl) legendaEl.classList.toggle('vzory', !!nastavenia.vzory);
  if (zadanie) { zivaKontrola(); ukazVetuVPloche(vybranaVeta); }
  nastavNecinnost();
  ukazCas();
}
document.querySelectorAll('[data-nastavenie]').forEach((el) => {
  const kluc = el.getAttribute('data-nastavenie');
  const zaskrtavatko = el.type === 'checkbox';
  if (zaskrtavatko) el.checked = !!nastavenia[kluc];
  else el.value = String(nastavenia[kluc]);
  el.addEventListener('change', () => {
    const hodnota = zaskrtavatko ? el.checked : el.value;
    nastavenia[kluc] = hodnota;
    ulozNastavenia();
    pouziNastavenia();
    track('game_setting', { game: 'foxes', setting: kluc, value: String(hodnota) });
  });
});

/* ── Account sync (only when signed in, silent otherwise) ─────────────── */
function stavVsetkychDni() {
  const out = {};
  for (const k of vsetkyKluce('foxes:')) {
    const d = k.slice('foxes:'.length);
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
  const hotove = Object.keys(dni).filter((d) => isValidDate(d) && d <= dnes && dni[d].done).sort();
  let s = { posledny: null, pocet: 0, odpusteneMesiac: null, odpustene: 0 };
  for (const d of hotove) s = krokSerie(s, d);
  const ziva = s.pocet && (s.posledny === dnes || s.posledny === posunDen(dnes, -1) || odpustitVieme(s, dnes));
  if (!ziva) { try { localStorage.removeItem('foxes:streak'); } catch (e) { /* nothing */ } return; }
  uloz('foxes:streak', s);
}
function odosliStav() {
  if (!ucet.prihlaseny()) return;
  ucet.hra.uloz('foxes', { dni: stavVsetkychDni(), t: Date.now() }).catch(() => { /* network error: this browser stays the truth */ });
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
  try { vzdialene = await ucet.hra.nacitaj('foxes'); } catch (e) { return; }
  const diaDni = vzdialene && vzdialene.dni && typeof vzdialene.dni === 'object' ? vzdialene.dni : {};
  let zmenene = false;
  for (const [d, r] of Object.entries(diaDni)) {
    if (!isValidDate(d) || !r || typeof r !== 'object') continue;
    const kluc = 'foxes:' + d;
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
      if (cerstve && (cerstve.t || 0) > ((ulozene && ulozene.t) || 0)) {
        ulozene = cerstve;
        vlozUlozene(cerstve);
        undoStack = []; redoStack = [];
        ukazVsetko();
        if (done) { doska.classList.add('hotovo'); zastavTikac(); }
        ukazStav();
        ukazCas();
        ukazTlacidla();
      }
    }
  }
  odosliStav();
}

/* ── Start ────────────────────────────────────────────────────────────── */
async function spusti() {
  if (jeBuduci) {
    datumEl.textContent = pekneDatum(datum);
    stavEl.textContent = 'This lair opens on ' + pekneDatum(datum) + ' (Bratislava time). Come back then, or play today’s lair.';
    doska.hidden = true;
    for (const el of [padEl, nastrojeEl, legendaEl, citacEl]) if (el) el.hidden = true;
    for (const b of [spatBtn, znovaBtn, resetBtn, checkBtn, hintBtn]) if (b) b.disabled = true;
    ukazPasik();
    return;
  }
  try {
    zadanie = await nacitajZadanie();
  } catch (e) {
    stavEl.textContent = 'The lair could not be prepared. Please reload the page.';
    throw e;
  }
  n = zadanie.n; V = n - 1;
  S = struktura(zadanie);
  vety = zadanie.clues.map((cl) => textIndicie(zadanie, cl));
  for (const c of zadanie.kamene) kamen.add(c);
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
  if (datumEl) datumEl.textContent = rezim === 'cvicenie' ? UROVNE[zadanie.uroven].label + ' practice ' + sada.split('-')[1] + ', lair ' + kSada : pekneDatum(datum);
  if (urovenEl) urovenEl.textContent = UROVNE[zadanie.uroven].label + ' · ' + n + ' × ' + n;
  if (done) doska.classList.add('hotovo');
  else if (jeRozohrane({ k: plocha.k, x: plocha.x, m: plocha.m, ind })) pozastav(true);
  ukazCas();
  ukazSeriu();
  ukazHistoriu();
  ukazPasik();
  ukazStav();
  ukazTlacidla();
}
spusti().then(synchronizujUcet);
