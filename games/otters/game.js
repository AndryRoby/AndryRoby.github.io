import '../kniha.mjs?v=1';
/* Otters: the game page. One script for the daily river, the archive days
 * and the practice sets; the page says which one it is:
 *
 *   <body data-den="YYYY-MM-DD">          an archive day (built page)
 *   <body data-sada="easy-1" data-k="3">  a practice river
 *   nothing                               today's river (or ?d=YYYY-MM-DD)
 *
 * The puzzle itself comes, in this order: from <script type="application/json"
 * id="zadanie"> embedded in a built page; from dni/YYYY-MM.json for the day;
 * or, when both are missing, generated right here from the date. All three
 * give the same river for the same date (plan.mjs, generator.mjs).
 *
 * The board is one SVG, always drawn here from the puzzle, so a built page
 * only has to carry the numbers for readers without JavaScript.
 *
 * Marks (`v`) are one flat array of E = 2n(n+1) values in the solver's edge
 * order (generator.mjs, geometria): the (n+1)*n horizontal sides first, then
 * the n*(n+1) vertical ones. 0 untouched, 1 a line of the river, 2 a cross.
 *
 * Stored in localStorage (all in try/catch, private windows throw):
 *   otters:YYYY-MM-DD        { v, sec, start, done, hints, checks, t }
 *   otters:p:<set>:<k>       the same for a practice river
 *   otters:streak            { posledny: YYYY-MM-DD, pocet }
 *   otters:nastavenia        the settings panel
 * sec = seconds spent before the current run, start = ms when the current
 * run began (null while paused or before the first move), done = ms of the
 * solve, hints and checks = help used, t = ms of the last save. The history
 * line is counted from the day records themselves, there is no separate one.
 * Outgoing events via window.umami, if it runs: game_solved, game_check,
 * game_hint, game_setting. Nothing else leaves the browser, unless the
 * player is signed in (arling.sk account, /style/ucet.js): then every
 * otters:YYYY-MM-DD save is also pushed to the account (throttled, 2s)
 * and pulled back on load, so the streak and history follow across
 * devices. Signed out, nothing changes; a signed-in sync that fails over
 * the network fails silently, this browser's copy stays the truth.
 */
import { zadaniePreDen, zadanieCvicenie, rozbal, tyzden, urovenDna, posunDen, pekneDatum, kratkyDatum, UROVNE, SADY, PRVY_DEN, DNI } from './plan.mjs';
import { todayBratislava, isValidDate, geometria } from './generator.mjs';
import { jeVyriesene, porovnaj, napoveda } from './logika.mjs';
import * as ucet from '/style/ucet.js';
import { oslava } from '../oslava.js';

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
const zdielanieEl = $('zdielanie');
const zdielajBtn = $('zdielaj');
const zdielanieStav = $('zdielanie-stav');
const zdielanieText = $('zdielanie-text');
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

/* ── Settings ─────────────────────────────────────────────────────────── */
const NASTAVENIA_KLUC = 'otters:nastavenia';
// Auto crosses and Live check are off by default: the crosses are the
// player's own notes, and nothing turns red while you play (Andrej, 10. 9.);
// Check is the only judge before the river closes.
const NASTAVENIA_PREDVOLENE = { casovac: true, pauzaPriOdchode: true, autoKrizky: false, zivaKontrola: false, potvrditReset: true, oslava: true };
let nastavenia = Object.assign({}, NASTAVENIA_PREDVOLENE, nacitaj(NASTAVENIA_KLUC) || {});
function ulozNastavenia() { uloz(NASTAVENIA_KLUC, nastavenia); }

/* ── Which river ──────────────────────────────────────────────────────── */
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
// Koreňová stránka /games/otters/ prepíše adresu na dnešný deň (bez presmerovania),
// aby zdieľaný odkaz viedol na konkrétny deň; stránky dní, cvičenia a ?d= ostávajú.
if (rezim === 'den' && !body.dataset.den && jeDnes && !location.search) {
  try { history.replaceState(null, '', '/games/otters/' + datum + '/'); } catch (e) { /* adresa ostane všeobecná, hra beží ďalej */ }
}
const KLUC = rezim === 'cvicenie' ? 'otters:p:' + sada + ':' + kSada : 'otters:' + datum;

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

/* ── Loading the river ────────────────────────────────────────────────── */
function vlozene() {
  const el = $('zadanie');
  if (!el) return null;
  try { return rozbal(JSON.parse(el.textContent)); } catch (e) { return null; }
}
async function zTabulky(iso) {
  try {
    const r = await fetch('/games/otters/dni/' + iso.slice(0, 7) + '.json', { cache: 'no-cache' });
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
let zadanie, n, g, v, start, done, sekundy, hints, checks, ulozene;
let undoStack = [];
let redoStack = [];
let fokusD = 0;             // the keyboard cursor: which dot it sits on
let poslednySmer = 'right'; // for X and Delete without a modifier
let kreslenie = null;       // Enter: a run along the sides, { pred }
let tikac = null;
let necinnost = null;
let pauza = false;
let tip = null;             // the hint on screen, cleared by the next move
let tipHrany = [];          // sides ringed by the hint's second step, cleared by the next move
let odhalene = false;       // Check's second step is showing the wrong marks
let checkStav = null;       // what the last Check saw, so the second press can reveal it
const hranyEl = [];
const bodkyEl = [];
const cislaEl = [];

/* ── Drawing ──────────────────────────────────────────────────────────── *
 * One square of the marsh is S units of the viewBox, the border M. The
 * board scales to whatever width it gets, so a nine by nine still gives
 * every side a hit area well over the 24 px the standard asks for at
 * 390 px (ops/spec-hry-ux.md, part 9). */
const S = 40, M = 22;
function poloha(e) {
  const x = M + g.edgeC[e] * S, y = M + g.edgeR[e] * S;
  return g.edgeTyp[e] === 0
    ? { x1: x, y1: y, x2: x + S, y2: y, cx: x + S / 2, cy: y }
    : { x1: x, y1: y, x2: x, y2: y + S, cx: x, cy: y + S / 2 };
}
function bodX(c) { return M + c * S; }
function bodY(r) { return M + r * S; }
function postavMriezku() {
  const W = n * S + 2 * M;
  document.documentElement.style.setProperty('--n', n);
  doska.setAttribute('viewBox', '0 0 ' + W + ' ' + W);
  doska.setAttribute('aria-label', 'River grid ' + n + ' by ' + n);
  const k = [];
  k.push('<g class="plocha" role="presentation">');
  k.push('<g class="voda" id="voda" aria-hidden="true"></g>');
  // every side the river could take, as a hairline
  k.push('<g class="mriezka" aria-hidden="true">');
  for (let e = 0; e < g.E; e++) {
    const p = poloha(e);
    k.push('<line class="slaba" x1="' + p.x1 + '" y1="' + p.y1 + '" x2="' + p.x2 + '" y2="' + p.y2 + '"/>');
  }
  k.push('</g>');
  // the numbers, in the middle of their patch
  k.push('<g class="cisla" aria-hidden="true">');
  for (let i = 0; i < g.C; i++) {
    if (zadanie.clues[i] == null) continue;
    const r = Math.floor(i / n), c = i % n;
    k.push('<text class="cislo" data-i="' + i + '" x="' + (bodX(c) + S / 2) + '" y="' + (bodY(r) + S / 2) + '">' + zadanie.clues[i] + '</text>');
  }
  k.push('</g>');
  // the dots: the grid the keyboard walks on, one row of gridcells per row of dots
  k.push('<g class="bodky" role="presentation">');
  for (let r = 0; r <= n; r++) {
    k.push('<g role="row">');
    for (let c = 0; c <= n; c++) {
      const d = r * (n + 1) + c;
      k.push('<circle class="bodka" role="gridcell" data-d="' + d + '" tabindex="' + (d === 0 ? 0 : -1) + '" cx="' + bodX(c) + '" cy="' + bodY(r) + '" r="2.8"></circle>');
    }
    k.push('</g>');
  }
  k.push('</g>');
  // one group per side: the river line, the cross, and a ring for a hint or a mistake
  k.push('<g class="ciary" aria-hidden="true">');
  for (let e = 0; e < g.E; e++) {
    const p = poloha(e);
    k.push('<g class="h" data-e="' + e + '" data-v="0">'
      + '<line class="ciara" x1="' + p.x1 + '" y1="' + p.y1 + '" x2="' + p.x2 + '" y2="' + p.y2 + '"/>'
      + '<path class="krizik" d="M' + (p.cx - 5) + ' ' + (p.cy - 5) + 'L' + (p.cx + 5) + ' ' + (p.cy + 5) + 'M' + (p.cx - 5) + ' ' + (p.cy + 5) + 'L' + (p.cx + 5) + ' ' + (p.cy - 5) + '"/>'
      + '<circle class="znak" cx="' + p.cx + '" cy="' + p.cy + '" r="11"/>'
      + '</g>');
  }
  k.push('</g>');
  k.push('<circle class="kurzor" id="kurzor" cx="' + bodX(0) + '" cy="' + bodY(0) + '" r="9"/>');
  // the hit areas: a diamond around every side, together tiling the whole
  // board, so a tap always lands on the side nearest to the finger
  k.push('<g class="hity" aria-hidden="true">');
  for (let e = 0; e < g.E; e++) {
    const p = poloha(e), h = S / 2;
    k.push('<polygon class="hit" data-e="' + e + '" points="' + (p.cx - h) + ',' + p.cy + ' ' + p.cx + ',' + (p.cy - h) + ' ' + (p.cx + h) + ',' + p.cy + ' ' + p.cx + ',' + (p.cy + h) + '"/>');
  }
  k.push('</g></g>');
  doska.innerHTML = k.join('');
  hranyEl.length = 0; bodkyEl.length = 0; cislaEl.length = 0;
  doska.querySelectorAll('.h').forEach((el) => hranyEl.push(el));
  doska.querySelectorAll('.bodka').forEach((el) => bodkyEl.push(el));
  doska.querySelectorAll('.cislo').forEach((el) => { cislaEl[+el.dataset.i] = el; });
  popisCisel();
}
/* The numbers as plain text for a screen reader: the drawing itself only
 * tells the shape of the marsh, not what it asks for. */
function popisCisel() {
  if (!cislaText) return;
  const riadky = [];
  for (let r = 0; r < n; r++) {
    const c = [];
    for (let i = 0; i < n; i++) { const x = zadanie.clues[r * n + i]; c.push(x == null ? 'blank' : String(x)); }
    riadky.push('row ' + (r + 1) + ': ' + c.join(', '));
  }
  cislaText.textContent = 'The numbers of the marsh, ' + n + ' by ' + n + '. ' + riadky.join('. ') + '.';
}
const SMERY = ['up', 'right', 'down', 'left'];   // the order of geometria.dotEdges
function popisBodky(d) {
  const r = Math.floor(d / (n + 1)), c = d % (n + 1);
  const ciary = [], krizky = [];
  for (let m = 0; m < 4; m++) {
    const e = g.dotEdges[4 * d + m];
    if (e < 0) continue;
    if (v[e] === 1) ciary.push(SMERY[m]); else if (v[e] === 2) krizky.push(SMERY[m]);
  }
  const casti = ['dot row ' + (r + 1) + ', column ' + (c + 1)];
  casti.push(ciary.length ? 'river ' + ciary.join(' and ') : 'no river yet');
  if (krizky.length) casti.push('crossed ' + krizky.join(' and '));
  return casti.join(', ');
}
function ukazHranu(e) {
  const el = hranyEl[e];
  if (el && el.getAttribute('data-v') !== String(v[e])) el.setAttribute('data-v', v[e]);
}
/* A soft visual cue only, not a judgement: a number whose sides already
 * carry as many lines as it asks for goes quiet. It says nothing about
 * whether they are the RIGHT sides (Andrej, 10. 9.: nothing turns red while
 * playing; only Check judges).
 * A 0 is satisfied by an empty board, so on an untouched marsh it would go
 * quiet before the player did anything. Nothing goes quiet until the first
 * line is drawn: an untouched board reads as one piece. */
function oznacSplnene() {
  let zacate = false;
  for (let e = 0; e < g.E; e++) if (v[e] === 1) { zacate = true; break; }
  for (let i = 0; i < g.C; i++) {
    const el = cislaEl[i];
    if (!el) continue;
    let L = 0;
    for (let m = 0; m < 4; m++) if (v[g.cellEdges[4 * i + m]] === 1) L++;
    el.classList.toggle('splnene', zacate && L === zadanie.clues[i]);
  }
}
function ukazVsetko() {
  for (let e = 0; e < g.E; e++) ukazHranu(e);
  oznacSplnene();
  if (bodkyEl[fokusD]) bodkyEl[fokusD].setAttribute('aria-label', popisBodky(fokusD));
}
/* When the river is closed, the water inside it is coloured in: a cell is
 * inside when an odd number of vertical lines stands to its left. */
function nakresliVodu() {
  const el = $('voda');
  if (!el) return;
  const kus = [];
  for (let r = 0; r < n; r++) {
    let vnutri = false;
    for (let c = 0; c < n; c++) {
      if (v[g.vId(r, c)] === 1) vnutri = !vnutri;
      if (vnutri) kus.push('<rect x="' + bodX(c) + '" y="' + bodY(r) + '" width="' + S + '" height="' + S + '"/>');
    }
  }
  el.innerHTML = kus.join('');
}
function zmazTip() {
  if (!tip && !tipHrany.length) return;
  tip = null;
  tipHrany = [];
  for (const el of hranyEl) el.classList.remove('tip');
  if (hintBtn) hintBtn.textContent = 'Hint';
}
function zmazOdhalenie() {
  if (!odhalene && !checkStav) return;
  odhalene = false; checkStav = null;
  for (const el of hranyEl) el.classList.remove('chyba');
  if (checkBtn) checkBtn.textContent = 'Check';
}
/* Live check is off by default; when it is on, a wrong mark is shown as soon
 * as it appears, with a ring and a broken line, not by colour alone. */
function zivaKontrola() {
  if (!nastavenia.zivaKontrola || done || !zadanie) return;
  const p = porovnaj(v, zadanie.solution);
  for (const e of p.zleCiary) hranyEl[e].classList.add('chyba');
  for (const e of p.zleKrizky) hranyEl[e].classList.add('chyba');
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
}

/* ── Streak and history ───────────────────────────────────────────────── */
function ukazSeriu() {
  if (!seriaEl) return;
  const s = nacitaj('otters:streak');
  if (!s || !s.pocet) { seriaEl.textContent = ''; return; }
  const ziva = s.posledny === dnes || s.posledny === posunDen(dnes, -1);
  seriaEl.textContent = ziva ? 'Streak: ' + s.pocet + (s.pocet === 1 ? ' day' : ' days') : '';
}
function zapisSeriu() {
  // Only a river finished on its own day counts: the archive is for practice.
  if (!jeDnes) return;
  const s = nacitaj('otters:streak') || { posledny: null, pocet: 0 };
  if (s.posledny === datum) return;
  const pocet = s.posledny === posunDen(datum, -1) ? s.pocet + 1 : 1;
  uloz('otters:streak', { posledny: datum, pocet });
}
/* Every finished day in this browser, newest first. */
function historiaDni() {
  const out = [];
  for (const k of vsetkyKluce('otters:')) {
    const d = k.slice('otters:'.length);
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
  historiaEl.innerHTML = '<b>Your rivers:</b> ' + h.length + ' finished' + (urovne ? ' (' + urovne + ')' : '') + (ciste ? ', ' + ciste + ' clean, with no hint and no check' : ', none clean yet')
    + (best ? ', best ' + formatCas(best.sec) + ' on ' + kratkyDatum(best.d) : '') + (priemer ? ', average ' + formatCas(priemer) : '') + '. <a href="/games/otters/archive/">Archive and full history</a>.';
}

/* ── Saving and solving ───────────────────────────────────────────────── */
function ulozStav() { uloz(KLUC, { v, sec: sekundy, start, done, hints, checks, t: Date.now() }); naplanujOdoslanie(); }

function ukazStav() {
  oznacSplnene();
  stavEl.classList.toggle('ok', !!done);
  if (zdielanieEl) zdielanieEl.hidden = !done;   // Share only after the river is finished
  if (done) {
    const s = sekundy ? ' in ' + formatCas(sekundy) : '';
    const pomoc = [];
    if (hints) pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
    if (checks) pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
    const hn = pomoc.length ? ' with ' + pomoc.join(' and ') : ' without a hint or a check';
    const seria = jeDnes ? (nacitaj('otters:streak') || {}).pocet || 0 : 0;
    stavEl.innerHTML = '<b>Solved</b>' + s + hn + '. ' + (pomoc.length ? 'The otters have their river.' : 'A clean river: the otters are impressed.')
      + (jeDnes ? ' A new river arrives at midnight, Bratislava time.' : '')
      + (seria >= 1 ? '<span class="oslava-streak">Day ' + seria + ' of your streak.</span>' : '')
      + '<span class="oslava-dalej"><a href="/games/otters/practice/">Practice sets</a></span>';
    return;
  }
  const oznacenych = v.some((x) => x !== 0);
  if (!oznacenych) { stavEl.textContent = 'Tap a line between two dots to draw it. Tap again for a cross (no line here), tap once more to clear.'; return; }
  let splnene = 0, spolu = 0;
  for (let i = 0; i < g.C; i++) {
    if (zadanie.clues[i] == null) continue;
    spolu++;
    let L = 0;
    for (let m = 0; m < 4; m++) if (v[g.cellEdges[4 * i + m]] === 1) L++;
    if (L === zadanie.clues[i]) splnene++;
  }
  if (spolu && splnene === spolu) { stavEl.textContent = 'Every number has as many lines as it asks for, but the river is not one closed loop yet. Check shows where.'; return; }
  stavEl.textContent = '';
}

/* Where a mark sits, in words: the first press of Check says only how many
 * marks are wrong and in which part of the marsh. */
function oblastHrany(e) {
  const x = g.edgeTyp[e] === 0 ? g.edgeC[e] + 0.5 : g.edgeC[e];
  const y = g.edgeTyp[e] === 0 ? g.edgeR[e] : g.edgeR[e] + 0.5;
  return (y < n / 2 ? 'top ' : 'bottom ') + (x < n / 2 ? 'left' : 'right');
}
function zoznamSlov(a) {
  if (a.length === 1) return a[0];
  if (a.length === 2) return a[0] + ' and ' + a[1];
  return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
}
/* Check, in two steps. The first press says how many marks are wrong and
 * roughly where; only the second press shows which sides. The puzzle stays
 * a puzzle unless you ask twice. */
function skontrolujStav() {
  if (done || pauza) return;
  const p = porovnaj(v, zadanie.solution);
  const zle = p.zleCiary.length + p.zleKrizky.length;
  if (!p.ciary && !p.krizky) { stavEl.textContent = 'Nothing on the board yet.'; return; }
  checks++;
  ulozStav();
  if (!zle) {
    zmazOdhalenie();
    stavEl.textContent = 'Everything on the board is right so far: ' + p.ciary + (p.ciary === 1 ? ' line' : ' lines') + ' and ' + p.krizky + (p.krizky === 1 ? ' cross' : ' crosses') + '.';
    track('game_check', { game: 'otters', wrong: 0 });
    return;
  }
  const popis = [];
  if (p.zleCiary.length) popis.push(p.zleCiary.length + (p.zleCiary.length === 1 ? ' line' : ' lines'));
  if (p.zleKrizky.length) popis.push(p.zleKrizky.length + (p.zleKrizky.length === 1 ? ' cross' : ' crosses'));
  if (checkStav && !odhalene) {
    odhalene = true;
    for (const e of p.zleCiary) hranyEl[e].classList.add('chyba');
    for (const e of p.zleKrizky) hranyEl[e].classList.add('chyba');
    stavEl.textContent = 'The ringed sides are wrong: ' + popis.join(' and ') + '. Take them off and keep going.';
    checkBtn.textContent = 'Check';
    track('game_check', { game: 'otters', wrong: zle, revealed: true });
    return;
  }
  const oblasti = [];
  for (const e of p.zleCiary.concat(p.zleKrizky)) { const o = oblastHrany(e); if (!oblasti.includes(o)) oblasti.push(o); }
  checkStav = { zle };
  stavEl.textContent = 'There ' + (zle === 1 ? 'is 1 mistake' : 'are ' + zle + ' mistakes') + ' on the board: ' + popis.join(' and ')
    + ', in the ' + zoznamSlov(oblasti) + ' of the marsh. Press Check again to show where.';
  checkBtn.textContent = 'Show';
  track('game_check', { game: 'otters', wrong: zle, revealed: false });
}

/* Hint, in two steps too: the first press only names the rule and the place
 * in words, and points at nothing on the board; the second press rings the
 * sides it means and draws that one step (ops/spec-hry-ux.md, part 5). Every
 * hint is counted and shown at the end. */
function ukazNapovedu() {
  if (done || pauza) return;
  if (tip) {
    // second press: ring the sides and draw them
    const t = tip;
    hints++;   // counted before the move, so the save inside it carries the new number
    const zmenilo = zmenaStavu(() => { for (const h of t.hrany) v[h.i] = h.val; });
    zmazTip(); zmazOdhalenie();
    // after the move, because drawing it clears the rings of the hint before
    tipHrany = t.hrany.map((h) => h.i).filter((i) => hranyEl[i]);
    if (!done) for (const i of tipHrany) hranyEl[i].classList.add('tip');
    else tipHrany = [];
    track('game_hint', { game: 'otters', kind: t.druh, rule: t.pravidlo, layer: t.vrstva, applied: true });
    if (!zmenilo) ulozStav();
    if (!done) stavEl.textContent = t.text + ' Drawn on the ringed ' + (t.hrany.length === 1 ? 'side' : 'sides') + '.';
    else ukazStav();
    return;
  }
  zmazTip();   // rings left by the step before go away before the new sentence
  const h = napoveda(v, zadanie.clues, zadanie.solution, n);
  if (!h) return;
  tip = h;
  stavEl.textContent = h.text + ' Press Hint again to show which sides and draw it.';
  hintBtn.textContent = 'Draw it';   // short, or the fifth button drops to its own line
  track('game_hint', { game: 'otters', kind: h.druh, rule: h.pravidlo, layer: h.vrstva, applied: false });
}

/* ── Share ────────────────────────────────────────────────────────────── *
 * A voluntary step after the river is finished (ops/spec-hry-ux.md, part 8).
 * The text names the river, the time and the hints and checks used, with no
 * line of the solution in it, so it cannot spoil the puzzle for whoever
 * reads it. Nothing is sent anywhere; the text only goes to the clipboard,
 * and when the browser refuses that, into a box to copy by hand. */
function odkazNaRieku() {
  const b = 'https://arling.sk/games/otters/';
  if (rezim === 'cvicenie') return b + 'practice/' + sada + '/' + (kSada === 1 ? '' : kSada + '/');
  return jeDnes ? b : b + datum + '/';
}
function textNaZdielanie() {
  const kto = rezim === 'cvicenie' ? 'Otters practice ' + sada + ', river ' + kSada : 'Otters ' + datum;
  const pomoc = [];
  if (hints) pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
  if (checks) pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
  return kto + ' · ' + UROVNE[zadanie.uroven].label + '\n'
    + 'Solved' + (sekundy ? ' in ' + formatCas(sekundy) : '') + (pomoc.length ? ' with ' + pomoc.join(' and ') : ', clean: no hint, no check') + '\n'
    + odkazNaRieku();
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
    ? 'Copied. It says nothing about the lines, and nothing was sent anywhere.'
    : 'This browser would not let the page copy for you. Here is the text, take it from the box.';
  if (zdielanieText) {
    zdielanieText.value = text;
    zdielanieText.hidden = ok;
    if (!ok) { zdielanieText.focus(); zdielanieText.select(); }
  }
  track('game_share', { game: 'otters', copied: ok, level: zadanie.uroven });
});

function skontroluj() {
  if (!jeVyriesene(v, zadanie.clues, n)) return false;
  sekundy = ubehnute();
  done = Date.now();
  start = null;
  zastavTikac();
  nastavNecinnost();
  doska.classList.add('hotovo');
  zmazTip(); zmazOdhalenie();
  nakresliVodu();
  ukazCas();
  zapisSeriu();
  ukazSeriu();
  ulozStav();
  ukazHistoriu();
  ukazPasik();
  track('game_solved', { game: 'otters', day: rezim === 'den' ? datum : sada + '/' + kSada, seconds: sekundy, hints, checks, level: zadanie.uroven });
  const kontajner = document.querySelector('.hra');
  if (kontajner) oslava(kontajner, { redukovany: !nastavenia.oslava || window.matchMedia('(prefers-reduced-motion: reduce)').matches });
  return true;
}

/* ── Moves ────────────────────────────────────────────────────────────── *
 * Every change to the board goes through zmenaStavu: it keeps the whole
 * board before and after, so Undo and Redo are one shared stack with no
 * limit and Clear is undone by a single Undo (ops/spec-hry-ux.md, part 3). */
function ukazTlacidla() {
  if (spatBtn) spatBtn.disabled = !undoStack.length || !!done;
  if (znovaBtn) znovaBtn.disabled = !redoStack.length || !!done;
}
function zmenaStavu(fn) {
  if (done || pauza) return false;
  const pred = v.slice();
  fn();
  let rovnake = v.length === pred.length;
  if (rovnake) for (let i = 0; i < v.length; i++) if (v[i] !== pred[i]) { rovnake = false; break; }
  if (rovnake) return false;
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
/* Auto crosses, off by default: a number that has all its lines, and a dot
 * that already has two, cross whatever is left. One move in the history. */
function dopluKrizky() {
  for (let i = 0; i < g.C; i++) {
    const k = zadanie.clues[i];
    if (k == null) continue;
    let L = 0;
    for (let m = 0; m < 4; m++) if (v[g.cellEdges[4 * i + m]] === 1) L++;
    if (L === k) for (let m = 0; m < 4; m++) { const e = g.cellEdges[4 * i + m]; if (v[e] === 0) v[e] = 2; }
  }
  for (let d = 0; d < g.D; d++) {
    let L = 0;
    for (let m = 0; m < 4; m++) { const e = g.dotEdges[4 * d + m]; if (e >= 0 && v[e] === 1) L++; }
    if (L === 2) for (let m = 0; m < 4; m++) { const e = g.dotEdges[4 * d + m]; if (e >= 0 && v[e] === 0) v[e] = 2; }
  }
}
function nastav(i, hodnota) {
  if (done || pauza || i < 0 || v[i] === hodnota) return;
  zmenaStavu(() => { v[i] = hodnota; if (nastavenia.autoKrizky) dopluKrizky(); });
}
function prepni(i) { if (i >= 0) nastav(i, (v[i] + 1) % 3); }

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
/* Clear: an empty marsh, the clock keeps running (Andrej, 10. 9.: clearing
 * is a move, not a restart). One Undo brings every mark back. */
function reset() {
  if (done || pauza) return;
  if (v.every((x) => x === 0)) return;
  if (nastavenia.potvrditReset && !window.confirm('Clear the whole marsh? The clock keeps running and one Undo brings your marks back.')) return;
  zmenaStavu(() => { v = new Array(g.E).fill(0); });
}

/* ── Pointer ──────────────────────────────────────────────────────────── *
 * Clicking only, no drag and drop (Andrej, 10. 9.): a tap moves a side on,
 * empty, river, cross, empty. Only a pointerup on the very side the pointer
 * went down on counts as a tap; a finger or mouse that moves off that side
 * before release cancels it, so pointer move never draws anything. */
function hranaPod(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const h = el && el.closest ? el.closest('.hit') : null;
  return h && doska.contains(h) ? +h.dataset.e : -1;
}
let tah = null; // { edge, id } where a tap began; leaving that side cancels it
doska.addEventListener('pointerdown', (e) => {
  if (done || pauza || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const i = hranaPod(e);
  if (i < 0) return;
  tah = { edge: i, id: e.pointerId };
  try { doska.setPointerCapture(e.pointerId); } catch (err) { /* works without capture too, less smoothly */ }
  kurzorNaHranu(i);
  e.preventDefault();
});
doska.addEventListener('pointermove', (e) => {
  if (!tah || tah.id !== e.pointerId) return;
  if (hranaPod(e) !== tah.edge) tah = null;   // left the side: no tap, nothing drawn
});
function koniecTahu(e) {
  if (!tah || tah.id !== e.pointerId) return;
  const t = tah;
  tah = null;
  try { doska.releasePointerCapture(e.pointerId); } catch (err) { /* nothing */ }
  if (!done && !pauza) prepni(t.edge);
}
doska.addEventListener('pointerup', koniecTahu);
doska.addEventListener('pointercancel', (e) => { if (tah && tah.id === e.pointerId) tah = null; });

/* ── Keyboard ─────────────────────────────────────────────────────────── *
 * The cursor walks the dots. Ctrl plus arrow draws or removes the river in
 * that direction and moves along, Shift plus arrow crosses it, Enter starts
 * a run the arrows steer, Escape or Space cancels the run
 * (ops/spec-hry-ux.md, pattern B1). */
function zameraj(d) {
  if (d < 0 || d >= bodkyEl.length) return;
  if (bodkyEl[fokusD]) bodkyEl[fokusD].tabIndex = -1;
  fokusD = d;
  const el = bodkyEl[d];
  if (!el) return;
  el.tabIndex = 0;
  el.setAttribute('aria-label', popisBodky(d));
  el.focus({ preventScroll: true });
  const k = $('kurzor');
  if (k) { k.setAttribute('cx', bodX(d % (n + 1))); k.setAttribute('cy', bodY(Math.floor(d / (n + 1)))); }
}
/* The cursor follows the mouse too, so the keyboard carries on where the
 * hand left off; it does not steal the focus. */
function kurzorNaHranu(e) {
  const d = g.edgeDots[2 * e];
  if (bodkyEl[fokusD]) bodkyEl[fokusD].tabIndex = -1;
  fokusD = d;
  if (bodkyEl[d]) bodkyEl[d].tabIndex = 0;
  const k = $('kurzor');
  if (k) { k.setAttribute('cx', bodX(d % (n + 1))); k.setAttribute('cy', bodY(Math.floor(d / (n + 1)))); }
}
function vSmere(d, smer) {
  const r = Math.floor(d / (n + 1)), c = d % (n + 1);
  if (smer === 'up') return r > 0 ? { e: g.vId(r - 1, c), d: d - (n + 1) } : { e: -1, d: -1 };
  if (smer === 'down') return r < n ? { e: g.vId(r, c), d: d + (n + 1) } : { e: -1, d: -1 };
  if (smer === 'left') return c > 0 ? { e: g.hId(r, c - 1), d: d - 1 } : { e: -1, d: -1 };
  return c < n ? { e: g.hId(r, c), d: d + 1 } : { e: -1, d: -1 };
}
function zrusKreslenie(vratit) {
  if (!kreslenie) return;
  const pred = kreslenie.pred;
  kreslenie = null;
  if (vratit) zmenaStavu(() => { v = pred.slice(); });
  ukazStav();
}
const KLAVES_SMER = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
doska.addEventListener('keydown', (e) => {
  if (done || pauza) return;
  const smer = KLAVES_SMER[e.key];
  if (smer) {
    poslednySmer = smer;
    const t = vSmere(fokusD, smer);
    if (e.ctrlKey || e.metaKey) { if (t.e >= 0) { nastav(t.e, v[t.e] === 1 ? 0 : 1); zameraj(t.d); } }
    else if (e.shiftKey) { if (t.e >= 0) nastav(t.e, v[t.e] === 2 ? 0 : 2); }
    else if (kreslenie) { if (t.e >= 0) { nastav(t.e, 1); zameraj(t.d); } }
    else if (t.d >= 0) zameraj(t.d);
    e.preventDefault();
    return;
  }
  switch (e.key) {
    case 'Enter':
      if (kreslenie) { kreslenie = null; stavEl.textContent = ''; }
      else { kreslenie = { pred: v.slice() }; stavEl.textContent = 'Drawing a run: the arrows follow the river, Enter ends it, Escape takes it back.'; }
      e.preventDefault();
      break;
    case ' ':
      if (kreslenie) { zrusKreslenie(true); e.preventDefault(); }
      break;
    case 'Escape':
      if (kreslenie) { zrusKreslenie(true); e.preventDefault(); }
      break;
    case 'x': case 'X': {
      const t = vSmere(fokusD, poslednySmer);
      if (t.e >= 0) nastav(t.e, v[t.e] === 2 ? 0 : 2);
      e.preventDefault();
      break;
    }
    case 'Delete': case 'Backspace': case '0': {
      const t = vSmere(fokusD, poslednySmer);
      if (t.e >= 0) nastav(t.e, 0);
      e.preventDefault();
      break;
    }
    default: break;
  }
});
if (spatBtn) spatBtn.addEventListener('click', spat);
if (znovaBtn) znovaBtn.addEventListener('click', znova);
if (resetBtn) resetBtn.addEventListener('click', reset);
if (checkBtn) checkBtn.addEventListener('click', skontrolujStav);
if (hintBtn) hintBtn.addEventListener('click', ukazNapovedu);
if (pauzaBtn) pauzaBtn.addEventListener('click', () => pozastav(false));
if (pokracujBtn) pokracujBtn.addEventListener('click', pokracuj);
/* Undo and Redo are the scheme every one of these games shares:
 * U and Ctrl+Z back, R, Ctrl+R and Ctrl+Shift+Z forward. */
document.addEventListener('keydown', (e) => {
  if (e.target && /input|textarea|select/i.test(e.target.tagName || '')) return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && (e.key === 'z' || e.key === 'Z')) { if (e.shiftKey) znova(); else spat(); e.preventDefault(); return; }
  if (ctrl && (e.key === 'r' || e.key === 'R')) { znova(); e.preventDefault(); return; }
  if (ctrl) return;
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
      const st = nacitaj('otters:p:' + sada + ':' + k);
      const a = document.createElement(k === kSada ? 'span' : 'a');
      a.className = 'den' + (k === kSada ? ' dnes' : '') + (st && st.done ? ' hotove' : st && st.v && st.v.some((x) => x) ? ' rozohrane' : '');
      if (k !== kSada) a.href = '/games/otters/practice/' + sada + '/' + k + '/';
      a.innerHTML = '<small>No.</small><b>' + k + '</b>';
      a.setAttribute('aria-label', 'River ' + k + (st && st.done ? ', solved' : ''));
      if (k === kSada) a.setAttribute('aria-current', 'page');
      pasik.appendChild(a);
    }
    return;
  }
  const dni = tyzden(datum);
  dni.forEach((d, k) => {
    const st = nacitaj('otters:' + d);
    const buduci = d > dnes, pred = d < PRVY_DEN;
    const tag = d === datum || buduci || pred ? 'span' : 'a';
    const a = document.createElement(tag);
    a.className = 'den' + (d === datum ? ' dnes' : '') + (buduci || pred ? ' buduci' : '') + (st && st.done ? ' hotove' : st && st.v && st.v.some((x) => x) ? ' rozohrane' : '');
    if (tag === 'a') a.href = '/games/otters/' + d + '/';
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
  if (!nastavenia.zivaKontrola && !odhalene) { for (const el of hranyEl) el.classList.remove('chyba'); }
  zivaKontrola();
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
    track('game_setting', { game: 'otters', setting: kluc, on: el.checked });
  });
});

/* ── Account sync (only when signed in, silent otherwise) ────────────────
 * The account stores one object per game: { dni: { 'YYYY-MM-DD': stav }, t }.
 * On merge, for each day the record with the higher `t` wins, but a `done`
 * on either side is never dropped (a slightly older save should not un-solve
 * a day). The streak is then rebuilt from the merged finished days instead of
 * trusted as a stored number, so a merge can never leave it wrong. */
function stavVsetkychDni() {
  const out = {};
  for (const k of vsetkyKluce('otters:')) {
    const d = k.slice('otters:'.length);
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
  if (!pocet) { try { localStorage.removeItem('otters:streak'); } catch (e) { /* nič */ } return; }
  uloz('otters:streak', { posledny: dni[dnes] && dni[dnes].done ? dnes : posunDen(dnes, -1), pocet });
}
function odosliStav() {
  if (!ucet.prihlaseny()) return;
  ucet.hra.uloz('otters', { dni: stavVsetkychDni(), t: Date.now() }).catch(() => { /* sieťová chyba: lokálne ostáva pravdou */ });
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
  try { vzdialene = await ucet.hra.nacitaj('otters'); } catch (e) { return; /* sieťová chyba: lokálne ostáva pravdou */ }
  const diaDni = vzdialene && vzdialene.dni && typeof vzdialene.dni === 'object' ? vzdialene.dni : {};
  let zmenene = false;
  for (const [d, r] of Object.entries(diaDni)) {
    if (!isValidDate(d) || !r || typeof r !== 'object') continue;
    const kluc = 'otters:' + d;
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
      if (cerstve && Array.isArray(cerstve.v) && g && cerstve.v.length === g.E && (cerstve.t || 0) > ((ulozene && ulozene.t) || 0)) {
        ulozene = cerstve;
        v = cerstve.v.slice();
        done = cerstve.done || null;
        hints = cerstve.hints || 0;
        checks = cerstve.checks || 0;
        sekundy = cerstve.sec || 0;
        undoStack = []; redoStack = [];
        ukazVsetko();
        if (done) { doska.classList.add('hotovo'); nakresliVodu(); zastavTikac(); }
        ukazStav();
        ukazCas();
        ukazTlacidla();
      }
    }
  }
  // push back too: a day finished only in this browser (or a done just merged in) reaches the account right away
  odosliStav();
}

/* ── Start ────────────────────────────────────────────────────────────── */
async function spusti() {
  if (jeBuduci) {
    datumEl.textContent = pekneDatum(datum);
    stavEl.textContent = 'This river opens on ' + pekneDatum(datum) + ' (Bratislava time). Come back then, or play today\'s river.';
    doska.setAttribute('hidden', '');   // an SVG needs the attribute, see index.html
    for (const b of [spatBtn, znovaBtn, resetBtn, checkBtn, hintBtn]) if (b) b.disabled = true;
    ukazPasik();
    return;
  }
  try {
    zadanie = await nacitajZadanie();
  } catch (e) {
    stavEl.textContent = 'The river could not be prepared. Please reload the page.';
    throw e;
  }
  n = zadanie.n;
  g = geometria(n);
  ulozene = nacitaj(KLUC);
  v = (ulozene && Array.isArray(ulozene.v) && ulozene.v.length === g.E) ? ulozene.v.slice() : new Array(g.E).fill(0);
  done = ulozene && ulozene.done ? ulozene.done : null;
  hints = ulozene && ulozene.hints ? ulozene.hints : 0;
  checks = ulozene && ulozene.checks ? ulozene.checks : 0;
  sekundy = ulozene && ulozene.sec ? ulozene.sec : 0;
  start = null;
  if (ulozene && ulozene.start && !done) {
    // The page was closed while the clock ran: count up to the last save,
    // then wait paused. Older saves (before the pause feature) had no `t`.
    const koniec = ulozene.t || ulozene.start;
    sekundy += Math.max(0, Math.floor((koniec - ulozene.start) / 1000));
  }
  postavMriezku();
  ukazVsetko();
  pouziNastavenia();
  if (datumEl) datumEl.textContent = rezim === 'cvicenie' ? UROVNE[zadanie.uroven].label + ' practice ' + sada.split('-')[1] + ', river ' + kSada : pekneDatum(datum);
  if (urovenEl) urovenEl.textContent = UROVNE[zadanie.uroven].label + ' · ' + n + '×' + n;
  if (done) { doska.classList.add('hotovo'); nakresliVodu(); }
  else if (v.some((x) => x)) pozastav(true);
  ukazCas();
  ukazSeriu();
  ukazHistoriu();
  ukazPasik();
  ukazStav();
  ukazTlacidla();
}
spusti().then(synchronizujUcet);
