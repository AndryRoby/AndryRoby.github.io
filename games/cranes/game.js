/* Cranes: the game page. One script for the daily water, the archive days
 * and the practice sets; the page says which one it is:
 *
 *   <body data-den="YYYY-MM-DD">          an archive day (built page)
 *   <body data-sada="easy-1" data-k="3">  a practice water
 *   nothing                               today's water (or ?d=YYYY-MM-DD)
 *
 * The puzzle itself comes, in this order: from <script type="application/json"
 * id="zadanie"> embedded in a built page; from dni/YYYY-MM.json for the day;
 * or, when both are missing, generated right here from the date. All three
 * give the same water for the same date (plan.mjs, generator.mjs).
 *
 * The board is one SVG, always drawn here from the puzzle, so a built page
 * only has to carry the numbers for readers without JavaScript.
 *
 * Marks are two flat arrays, one entry per pair of sandbanks that stand in
 * line, in the order graf() lists them (generator.mjs):
 *   v[e]  how many walkways the player has drawn there: 0, 1 or 2,
 *   x[e]  the player's own note that no walkway will ever run there.
 * Only `v` is ever handed to the rules (logika.mjs). The note is never checked
 * and never required: it is there for the same reason a person puts a pencil
 * cross on paper. It shows only while the pair carries no walkway.
 *
 * Stored in localStorage (all in try/catch, private windows throw):
 *   cranes:YYYY-MM-DD        { v, x, sec, start, done, hints, checks, t }
 *   cranes:p:<set>:<k>       the same for a practice water
 *   cranes:streak            { posledny: YYYY-MM-DD, pocet, mrazy }
 *   cranes:nastavenia        the settings panel
 * sec = seconds spent before the current run, start = ms when the current
 * run began (null while paused or before the first move), done = ms of the
 * solve, hints and checks = help used, t = ms of the last save. The history
 * line is counted from the day records themselves, there is no separate one.
 * Outgoing events via window.umami, if it runs: game_solved, game_check,
 * game_hint, game_setting. Nothing else leaves the browser, unless the
 * player is signed in (arling.sk account, /style/ucet.js): then every
 * cranes:YYYY-MM-DD save is also pushed to the account (throttled, 2s)
 * and pulled back on load, so the streak and history follow across
 * devices. Signed out, nothing changes; a signed-in sync that fails over
 * the network fails silently, this browser's copy stays the truth.
 */
import { zadaniePreDen, zadanieCvicenie, rozbal, tyzden, urovenDna, posunDen, pekneDatum, kratkyDatum, UROVNE, SADY, PRVY_DEN, DNI } from './plan.mjs';
import { todayBratislava, isValidDate, graf } from './generator.mjs';
import { jeVyriesene, porovnaj, napoveda } from './logika.mjs';
import * as ucet from '/style/ucet.js';

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
const zdielajBtn = $('zdielaj');
const zdielaneEl = $('zdielane');
const pauzaBtn = $('pauza');
const pauzaBlok = $('pauza-blok');
const pokracujBtn = $('pokracuj');
const pauzaCas = $('pauza-cas');
const pasik = $('pasik');
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

/* ── Settings ─────────────────────────────────────────────────────────── */
const NASTAVENIA_KLUC = 'cranes:nastavenia';
// Auto notes and Live check are off by default: the notes are the player's
// own, and nothing turns red while you play (Andrej, 10. 9.); Check is the
// only judge before the last walkway is in place.
const NASTAVENIA_PREDVOLENE = { casovac: true, pauzaPriOdchode: true, autoZnacky: false, zivaKontrola: false, potvrditReset: true };
let nastavenia = Object.assign({}, NASTAVENIA_PREDVOLENE, nacitaj(NASTAVENIA_KLUC) || {});
function ulozNastavenia() { uloz(NASTAVENIA_KLUC, nastavenia); }

/* ── Which water ──────────────────────────────────────────────────────── */
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
const KLUC = rezim === 'cvicenie' ? 'cranes:p:' + sada + ':' + kSada : 'cranes:' + datum;
// The root address always opens today's water; once the date is settled,
// rewrite it to today's built page so the address bar and a shared link
// point at the day itself (Andrej, 10. 9.). Only the plain root qualifies:
// a built archive day already names its date, a practice page its set, and
// a page opened with ?d= keeps that query untouched.
if (rezim === 'den' && !body.dataset.den && jeDnes && !location.search) {
  try { history.replaceState(null, '', '/games/cranes/' + datum + '/'); } catch (e) { /* the address stays generic; the game still works */ }
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

/* ── Loading the water ────────────────────────────────────────────────── */
function vlozene() {
  const el = $('zadanie');
  if (!el) return null;
  try { return rozbal(JSON.parse(el.textContent)); } catch (e) { return null; }
}
async function zTabulky(iso) {
  try {
    const r = await fetch('/games/cranes/dni/' + iso.slice(0, 7) + '.json', { cache: 'no-cache' });
    if (!r.ok) return null;
    const t = await r.json();
    const z = Array.isArray(t) ? t.find((y) => y.d === iso) : null;
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
let zadanie, n, g, v, x, start, done, sekundy, hints, checks, ulozene;
let undoStack = [];
let redoStack = [];
let fokusI = 0;             // the keyboard cursor: which sandbank it sits on
let poslednySmer = 1;       // for Enter, X and Delete without an arrow (east)
let tikac = null;
let necinnost = null;
let pauza = false;
let tip = null;             // the hint on screen, cleared by the next move
let odhalene = false;       // Check's second step is showing the wrong walkways
let checkStav = null;       // what the last Check saw, so the second press can reveal it
const hranyEl = [];
const ostrovyEl = [];
const kruhyEl = [];

/* ── Drawing ──────────────────────────────────────────────────────────── *
 * One step of the grid of sandbank places is S units of the viewBox, and the
 * board is exactly n steps across with every place in the middle of its own
 * step. The board scales to whatever width it gets: at 390 px a thirteen by
 * thirteen still gives 30 px per step, so the strip of water a tap can land
 * on is 30 px wide, over the 24 px the standard asks for (ops/spec-hry-ux.md,
 * part 9, and ops/spec-cranes.md). */
const S = 40, R = 15, ODSTUP = 5;
let W = 360;
function bodX(c) { return S / 2 + c * S; }
function bodY(r) { return S / 2 + r * S; }
function stredX(i) { return bodX(zadanie.islands[i].c); }
function stredY(i) { return bodY(zadanie.islands[i].r); }
/* Where the walkways of one pair are drawn: the line between the two middles,
 * and the two lines a step to either side of it for a double walkway. */
function usek(e) {
  const a = g.pary[e].a, b = g.pary[e].b, vod = g.pary[e].vodorovna;
  const x1 = stredX(a), y1 = stredY(a), x2 = stredX(b), y2 = stredY(b);
  return { x1, y1, x2, y2, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, dx: vod ? 0 : ODSTUP, dy: vod ? ODSTUP : 0 };
}
function ciara(trieda, x1, y1, x2, y2) {
  return '<line class="' + trieda + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
}
function postavMriezku() {
  W = n * S;
  document.documentElement.style.setProperty('--n', n);
  doska.setAttribute('viewBox', '0 0 ' + W + ' ' + W);
  doska.setAttribute('aria-label', 'Water grid ' + n + ' by ' + n);
  const k = [];
  k.push('<g class="plocha" role="presentation">');
  // every place a sandbank could stand, as a faint dot
  k.push('<g class="mriezka" aria-hidden="true">');
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) k.push('<circle cx="' + bodX(c) + '" cy="' + bodY(r) + '" r="1.6"/>');
  k.push('</g>');
  // one group per pair: one walkway, two walkways, the note, and a ring for
  // a hint or a mistake. Drawn before the sandbanks, so the ends go under them.
  k.push('<g class="lavky" aria-hidden="true">');
  for (let e = 0; e < g.E; e++) {
    const p = usek(e);
    // data-a, data-b and the middle of the stretch are on the group so that a
    // test (and a person poking at the page) can find a pair without redoing
    // the geometry by hand
    k.push('<g class="h" data-e="' + e + '" data-v="0" data-x="0" data-a="' + g.pary[e].a + '" data-b="' + g.pary[e].b + '" data-cx="' + p.cx + '" data-cy="' + p.cy + '">'
      + ciara('nahlad', p.x1, p.y1, p.x2, p.y2)
      + ciara('l0', p.x1, p.y1, p.x2, p.y2)
      + ciara('l1', p.x1 + p.dx, p.y1 + p.dy, p.x2 + p.dx, p.y2 + p.dy)
      + ciara('l2', p.x1 - p.dx, p.y1 - p.dy, p.x2 - p.dx, p.y2 - p.dy)
      + '<path class="krizik" d="M' + (p.cx - 6) + ' ' + (p.cy - 6) + 'L' + (p.cx + 6) + ' ' + (p.cy + 6) + 'M' + (p.cx - 6) + ' ' + (p.cy + 6) + 'L' + (p.cx + 6) + ' ' + (p.cy - 6) + '"/>'
      + '<circle class="znak" cx="' + p.cx + '" cy="' + p.cy + '" r="13"/>'
      + '</g>');
  }
  k.push('</g>');
  // the sandbanks: the grid the keyboard walks on, one row per row of the water
  k.push('<g class="ostrovy" role="presentation">');
  let r = -1;
  for (let i = 0; i < g.C; i++) {
    const o = zadanie.islands[i];
    if (o.r !== r) { if (r >= 0) k.push('</g>'); r = o.r; k.push('<g role="row" aria-rowindex="' + (r + 1) + '">'); }
    k.push('<g class="ostrov" data-i="' + i + '">'
      + '<circle class="prstenec" cx="' + stredX(i) + '" cy="' + stredY(i) + '" r="' + (R + 5) + '"/>'
      + '<circle class="kruh" role="gridcell" aria-colindex="' + (o.c + 1) + '" data-i="' + i + '" tabindex="' + (i === 0 ? 0 : -1) + '" cx="' + stredX(i) + '" cy="' + stredY(i) + '" r="' + R + '"></circle>'
      + '<text class="cislo" x="' + stredX(i) + '" y="' + stredY(i) + '">' + o.n + '</text>'
      + '</g>');
  }
  if (r >= 0) k.push('</g>');
  k.push('</g>');
  k.push('<circle class="kurzor" id="kurzor" cx="' + stredX(0) + '" cy="' + stredY(0) + '" r="' + (R + 6) + '"/>');
  k.push('</g>');
  doska.innerHTML = k.join('');
  hranyEl.length = 0; ostrovyEl.length = 0; kruhyEl.length = 0;
  doska.querySelectorAll('.h').forEach((el) => hranyEl.push(el));
  doska.querySelectorAll('.ostrov').forEach((el) => { ostrovyEl[+el.dataset.i] = el; });
  doska.querySelectorAll('.kruh').forEach((el) => { kruhyEl[+el.dataset.i] = el; });
  popisCisel();
}
/* The sandbanks as plain text for a screen reader: the drawing itself only
 * tells the shape of the water, not what it asks for. */
function popisCisel() {
  if (!cislaText) return;
  const riadky = [];
  let r = -1, kus = [];
  for (let i = 0; i < g.C; i++) {
    const o = zadanie.islands[i];
    if (o.r !== r) { if (kus.length) riadky.push('row ' + (r + 1) + ': ' + kus.join(', ')); r = o.r; kus = []; }
    kus.push('column ' + (o.c + 1) + ' asks for ' + o.n);
  }
  if (kus.length) riadky.push('row ' + (r + 1) + ': ' + kus.join(', '));
  cislaText.textContent = 'The sandbanks, ' + g.C + ' of them on a grid ' + n + ' by ' + n + '. ' + riadky.join('. ') + '.';
}
const SMERY = ['north', 'east', 'south', 'west'];   // the order of graf().susedia
function fraza(val) { return val === 0 ? 'no walkway' : val === 1 ? 'one walkway' : 'two walkways'; }
function popisOstrova(i) {
  const o = zadanie.islands[i];
  const lavky = [], noty = [];
  for (let d = 0; d < 4; d++) {
    const j = g.susedia[i][d];
    if (j < 0) continue;
    const e = g.indexPary(i, j);
    if (e < 0) continue;
    if (v[e] > 0) lavky.push(fraza(v[e]) + ' ' + SMERY[d]);
    else if (x[e]) noty.push(SMERY[d]);
  }
  const casti = ['sandbank row ' + (o.r + 1) + ', column ' + (o.c + 1) + ', asks for ' + o.n];
  casti.push(lavky.length ? lavky.join(', ') : 'no walkways yet');
  if (noty.length) casti.push('noted as never joined ' + noty.join(' and '));
  return casti.join(', ');
}
function ukazHranu(e) {
  const el = hranyEl[e];
  if (!el) return;
  if (el.getAttribute('data-v') !== String(v[e])) el.setAttribute('data-v', v[e]);
  if (el.getAttribute('data-x') !== String(x[e])) el.setAttribute('data-x', x[e]);
}
/* A soft visual cue only, not a judgement: a sandbank that already carries as
 * many walkways as its number goes quiet. It says nothing about whether they
 * are the RIGHT walkways (Andrej, 10. 9.: nothing turns red while playing;
 * only Check judges). */
function oznacSplnene() {
  for (let i = 0; i < g.C; i++) {
    const el = ostrovyEl[i];
    if (!el) continue;
    let s = 0;
    for (const e of g.hraneOstrova[i]) s += v[e];
    el.classList.toggle('splnene', s === zadanie.islands[i].n);
  }
}
function ukazVsetko() {
  for (let e = 0; e < g.E; e++) ukazHranu(e);
  oznacSplnene();
  if (kruhyEl[fokusI]) kruhyEl[fokusI].setAttribute('aria-label', popisOstrova(fokusI));
}
function zmazTip() {
  if (!tip) return;
  tip = null;
  for (const el of hranyEl) el.classList.remove('tip');
  for (const el of ostrovyEl) if (el) el.classList.remove('tip');
  if (hintBtn) hintBtn.textContent = 'Hint';
}
function zmazOdhalenie() {
  if (!odhalene && !checkStav) return;
  odhalene = false; checkStav = null;
  for (const el of hranyEl) el.classList.remove('chyba');
  for (const el of ostrovyEl) if (el) el.classList.remove('chyba');
  if (checkBtn) checkBtn.textContent = 'Check';
}
/* Live check is off by default; when it is on, a walkway that does not belong
 * is shown as soon as it appears, with a ring and a broken line, not by
 * colour alone. */
function zivaKontrola() {
  if (!nastavenia.zivaKontrola || done || !zadanie) return;
  const p = porovnaj(v, zadanie.bridges, zadanie.islands, n, g);
  for (const e of p.zleDvojice) hranyEl[e].classList.add('chyba');
  for (const e of p.krizenia) hranyEl[e].classList.add('chyba');
  for (const i of p.prekrocene) if (ostrovyEl[i]) ostrovyEl[i].classList.add('chyba');
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
  if (pauzaCas) pauzaCas.textContent = sekundy ? 'You have spent ' + slovaCas(sekundy) + ' so far.' : 'Your walkways are kept; the clock continues when you resume.';
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
  const s = nacitaj('cranes:streak');
  if (!s || !s.pocet) { seriaEl.textContent = ''; return; }
  const ziva = s.posledny === dnes || s.posledny === posunDen(dnes, -1);
  if (!ziva) { seriaEl.textContent = ''; return; }
  const mrazy = s.mrazy || 0;
  seriaEl.textContent = 'Streak: ' + s.pocet + (s.pocet === 1 ? ' day' : ' days')
    + (mrazy ? ', ' + mrazy + (mrazy === 1 ? ' missed day forgiven' : ' missed days forgiven') : '');
}
function zapisSeriu() {
  // Only a water finished on its own day counts: the archive is for practice.
  // The streak is always counted from the finished days themselves, never
  // added up as a stored number, so a merge from the account cannot leave it
  // wrong (prepocitajSeriu below).
  if (!jeDnes) return;
  prepocitajSeriu();
}
/* Every finished day in this browser, newest first. */
function historiaDni() {
  const out = [];
  for (const k of vsetkyKluce('cranes:')) {
    const d = k.slice('cranes:'.length);
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
  const best = h.reduce((a, y) => (y.sec && (!a || y.sec < a.sec) ? y : a), null);
  const ciste = h.filter((y) => !y.hints && !y.checks).length;
  const podlaUrovne = {};
  for (const y of h) { const u = UROVNE[urovenDna(y.d)].label.toLowerCase(); podlaUrovne[u] = (podlaUrovne[u] || 0) + 1; }
  const urovne = Object.keys(podlaUrovne).map((u) => podlaUrovne[u] + ' ' + u).join(', ');
  const priemer = Math.round(h.reduce((a, y) => a + (y.sec || 0), 0) / h.length);
  historiaEl.hidden = false;
  historiaEl.innerHTML = '<b>Your waters:</b> ' + h.length + ' finished' + (urovne ? ' (' + urovne + ')' : '') + (ciste ? ', ' + ciste + ' clean, with no hint and no check' : ', none clean yet')
    + (best ? ', best ' + formatCas(best.sec) + ' on ' + kratkyDatum(best.d) : '') + (priemer ? ', average ' + formatCas(priemer) : '') + '. <a href="/games/cranes/archive/">Archive and full history</a>.';
}

/* ── Saving and solving ───────────────────────────────────────────────── */
function ulozStav() { uloz(KLUC, { v, x, sec: sekundy, start, done, hints, checks, t: Date.now() }); naplanujOdoslanie(); }

function ukazStav() {
  oznacSplnene();
  stavEl.classList.toggle('ok', !!done);
  if (done) {
    const s = sekundy ? ' in ' + formatCas(sekundy) : '';
    const pomoc = [];
    if (hints) pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
    if (checks) pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
    const hn = pomoc.length ? ' with ' + pomoc.join(' and ') : ' without a hint or a check';
    stavEl.innerHTML = '<b>Solved</b>' + s + hn + '. ' + (pomoc.length ? 'The cranes can walk the whole water.' : 'A clean water: the cranes are impressed.')
      + (jeDnes ? ' A new water arrives at midnight, Bratislava time.' : '');
    return;
  }
  const oznacenych = v.some((y) => y !== 0);
  if (!oznacenych) { stavEl.textContent = 'Tap the water between two sandbanks to lay a walkway, tap again for a second one. Drag from one sandbank to another to join them.'; return; }
  let splnene = 0;
  for (let i = 0; i < g.C; i++) {
    let s = 0;
    for (const e of g.hraneOstrova[i]) s += v[e];
    if (s === zadanie.islands[i].n) splnene++;
  }
  if (splnene === g.C) { stavEl.textContent = 'Every sandbank has as many walkways as its number, but they are not all in one piece yet. Check shows where.'; return; }
  stavEl.textContent = '';
}

/* Where a pair sits, in words: the first press of Check says only how many
 * walkways are wrong and in which part of the water. */
function oblastHrany(e) {
  const p = usek(e);
  return (p.cy < W / 2 ? 'top ' : 'bottom ') + (p.cx < W / 2 ? 'left' : 'right');
}
function zoznamSlov(a) {
  if (a.length === 1) return a[0];
  if (a.length === 2) return a[0] + ' and ' + a[1];
  return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
}
/* Check, in two steps. The first press says how many walkways are wrong and
 * roughly where; only the second press shows which. The puzzle stays a puzzle
 * unless you ask twice. */
function skontrolujStav() {
  if (done || pauza) return;
  const p = porovnaj(v, zadanie.bridges, zadanie.islands, n, g);
  if (!p.lavky) { stavEl.textContent = 'Nothing on the board yet.'; return; }
  // A crossing and a sandbank over its number are wrong on their own, without
  // the solution: those are the two things a player can see once pointed at.
  const zle = new Set(p.zleDvojice);
  for (const e of p.krizenia) zle.add(e);
  checks++;
  ulozStav();
  if (!zle.size && !p.prekrocene.length) {
    zmazOdhalenie();
    stavEl.textContent = 'Everything on the board is right so far: ' + p.lavky + (p.lavky === 1 ? ' walkway' : ' walkways') + ' in place.';
    track('game_check', { game: 'cranes', wrong: 0 });
    return;
  }
  const casti = [];
  if (zle.size) casti.push(zle.size + (zle.size === 1 ? ' pair of sandbanks joined wrongly' : ' pairs of sandbanks joined wrongly'));
  if (p.krizenia.length) casti.push('walkways that cross');
  if (p.prekrocene.length) casti.push(p.prekrocene.length + (p.prekrocene.length === 1 ? ' sandbank over its number' : ' sandbanks over their numbers'));
  const pocet = zle.size;
  if (checkStav && !odhalene) {
    odhalene = true;
    for (const e of zle) hranyEl[e].classList.add('chyba');
    for (const i of p.prekrocene) if (ostrovyEl[i]) ostrovyEl[i].classList.add('chyba');
    stavEl.textContent = 'The ringed walkways do not belong: ' + casti.join(', ') + '. Take them off and keep going.';
    checkBtn.textContent = 'Check';
    track('game_check', { game: 'cranes', wrong: pocet, revealed: true });
    return;
  }
  const oblasti = [];
  for (const e of zle) { const o = oblastHrany(e); if (!oblasti.includes(o)) oblasti.push(o); }
  checkStav = { pocet };
  stavEl.textContent = 'There ' + (pocet === 1 ? 'is 1 mistake' : 'are ' + pocet + ' mistakes') + ' on the board: ' + casti.join(', ')
    + ', in the ' + zoznamSlov(oblasti) + ' of the water. Press Check again to show where.';
  checkBtn.textContent = 'Show';
  track('game_check', { game: 'cranes', wrong: pocet, revealed: false });
}

/* Hint, in two steps too: the first press names the rule and the place and
 * rings the pair it is about, without saying what goes there; the second
 * press builds that one step. Every hint is counted and shown at the end. */
function ukazNapovedu() {
  if (done || pauza) return;
  if (tip) {
    // second press: build it
    const t = tip;
    hints++;   // counted before the move, so the save inside it carries the new number
    const zmenilo = zmenaStavu(() => {
      for (const d of t.dvojice) {
        v[d.e] = d.val;
        // a pair the rule rules out gets the note, so the step is visible
        x[d.e] = d.val === 0 ? 1 : 0;
      }
    });
    zmazTip(); zmazOdhalenie();
    track('game_hint', { game: 'cranes', kind: t.druh, rule: t.pravidlo, layer: t.vrstva, applied: true });
    if (!zmenilo) { ulozStav(); ukazStav(); }
    if (!done) stavEl.textContent = t.text;   // now the whole sentence, count and all
    return;
  }
  const h = napoveda(v, zadanie.islands, zadanie.bridges, n, g);
  if (!h) return;
  tip = h;
  for (const d of h.dvojice) {
    if (hranyEl[d.e]) hranyEl[d.e].classList.add('tip');
    if (ostrovyEl[d.a]) ostrovyEl[d.a].classList.add('tip');
    if (ostrovyEl[d.b]) ostrovyEl[d.b].classList.add('tip');
  }
  // The first press names the rule and the place but keeps the count to
  // itself: every rule sentence that ends in a count says it after
  // " That settles" (generator.mjs, dodatok), and that tail waits for the
  // second press (ops/spec-hry-ux.md, part 5).
  const chvost = h.text.indexOf(' That settles');
  stavEl.textContent = (chvost > 0 ? h.text.slice(0, chvost) : h.text) + ' Press Hint again to build it.';
  hintBtn.textContent = 'Build it';
  track('game_hint', { game: 'cranes', kind: h.druh, rule: h.pravidlo, layer: h.vrstva, applied: false });
}

function skontroluj() {
  if (!jeVyriesene(v, zadanie.islands, n, g)) return false;
  sekundy = ubehnute();
  done = Date.now();
  start = null;
  zastavTikac();
  nastavNecinnost();
  doska.classList.add('hotovo');
  zmazTip(); zmazOdhalenie();
  ukazCas();
  ulozStav();                 // the streak is counted from the saved days
  zapisSeriu();
  ukazSeriu();
  ukazHistoriu();
  ukazPasik();
  track('game_solved', { game: 'cranes', day: rezim === 'den' ? datum : sada + '/' + kSada, seconds: sekundy, hints, checks, level: zadanie.uroven });
  return true;
}

/* ── Moves ────────────────────────────────────────────────────────────── *
 * Every change to the board goes through zmenaStavu: it keeps the whole board
 * before and after, so Undo and Redo are one shared stack with no limit and
 * Clear is undone by a single Undo (ops/spec-hry-ux.md, part 3). */
function ukazTlacidla() {
  if (spatBtn) spatBtn.disabled = !undoStack.length || !!done;
  if (znovaBtn) znovaBtn.disabled = !redoStack.length || !!done;
  if (zdielajBtn) zdielajBtn.hidden = !done;
}

/* ── Share ────────────────────────────────────────────────────────────── *
 * A voluntary step after the water is finished. One line: which water, the
 * time and how much help was taken. Never the board and never a grid of the
 * player's marks: in this game the marks are the answer, so a grid would be
 * the spoiler itself (ops/spec-hry-ux.md, part 8). */
function textZdielania() {
  const uroven = zadanie && zadanie.uroven && UROVNE[zadanie.uroven] ? UROVNE[zadanie.uroven].label : '';
  const kto = rezim === 'cvicenie'
    ? 'Cranes practice, ' + (uroven || sada) + ' no. ' + kSada
    : 'Cranes ' + datum + (uroven ? ', ' + uroven : '');
  const pomoc = hints || checks
    ? hints + (hints === 1 ? ' hint' : ' hints') + ', ' + checks + (checks === 1 ? ' check' : ' checks')
    : 'no hint, no check';
  const odkaz = rezim === 'cvicenie'
    ? 'https://arling.sk/games/cranes/practice/' + sada + '/' + (kSada === 1 ? '' : kSada + '/')
    : 'https://arling.sk/games/cranes/' + (jeDnes ? '' : datum + '/');
  return kto + '\nSolved in ' + formatCas(sekundy) + ', ' + pomoc + '.\n' + odkaz;
}
function skopiruj(t) {
  try {
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}
async function zdielaj() {
  if (!done) return;
  const t = textZdielania();
  let ok = false;
  try { await navigator.clipboard.writeText(t); ok = true; } catch (e) { ok = skopiruj(t); }
  if (!zdielaneEl) return;
  zdielaneEl.textContent = ok ? 'Copied.' : 'Copying is blocked here. Your line: ' + t.split('\n').join(' ');
  if (ok) setTimeout(() => { if (zdielaneEl.textContent === 'Copied.') zdielaneEl.textContent = ''; }, 4000);
}
if (zdielajBtn) zdielajBtn.addEventListener('click', zdielaj);
function snimka() { return { v: v.slice(), x: x.slice() }; }
function obnov(s) { v = s.v.slice(); x = s.x.slice(); }
function rovnake(a, b) {
  if (a.v.length !== b.v.length) return false;
  for (let i = 0; i < a.v.length; i++) if (a.v[i] !== b.v[i] || a.x[i] !== b.x[i]) return false;
  return true;
}
function zmenaStavu(fn) {
  if (done || pauza) return false;
  const pred = snimka();
  fn();
  if (rovnake(pred, snimka())) return false;
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
/* Auto notes, off by default: a sandbank that has all its walkways, and a
 * pair whose line is already crossed by a walkway, get the note that no
 * walkway will ever run there. One move in the history. */
function dopluZnacky() {
  for (let i = 0; i < g.C; i++) {
    let s = 0;
    for (const e of g.hraneOstrova[i]) s += v[e];
    if (s === zadanie.islands[i].n) for (const e of g.hraneOstrova[i]) if (v[e] === 0) x[e] = 1;
  }
  for (let e = 0; e < g.E; e++) {
    if (v[e] < 1) continue;
    for (const f of g.krizenia[e]) if (v[f] === 0) x[f] = 1;
  }
}
function nastav(e, hodnota) {
  if (done || pauza || e < 0 || (v[e] === hodnota && !(hodnota > 0 && x[e]))) return;
  zmenaStavu(() => {
    v[e] = hodnota;
    if (hodnota > 0) x[e] = 0;          // a walkway takes the note away
    if (nastavenia.autoZnacky) dopluZnacky();
  });
}
function prepni(e) { if (e >= 0) nastav(e, (v[e] + 1) % 3); }
/* The note is the player's own: it toggles freely and never touches a
 * walkway that is already there. */
function prepniZnacku(e) {
  if (done || pauza || e < 0) return;
  zmenaStavu(() => { x[e] = x[e] ? 0 : 1; });
}

function spat() {
  if (done || pauza || !undoStack.length) return;
  redoStack.push(snimka());
  obnov(undoStack.pop());
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) { ulozStav(); zivaKontrola(); }
  ukazStav();
  ukazTlacidla();
}
function znova() {
  if (done || pauza || !redoStack.length) return;
  undoStack.push(snimka());
  obnov(redoStack.pop());
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) { ulozStav(); zivaKontrola(); }
  ukazStav();
  ukazTlacidla();
}
/* Clear: an empty water, the clock keeps running (Andrej, 10. 9.: clearing is
 * a move, not a restart). One Undo brings every walkway and note back. */
function reset() {
  if (done || pauza) return;
  if (v.every((y) => y === 0) && x.every((y) => y === 0)) return;
  if (nastavenia.potvrditReset && !window.confirm('Clear the whole water? The clock keeps running and one Undo brings your walkways back.')) return;
  zmenaStavu(() => { v = new Array(g.E).fill(0); x = new Array(g.E).fill(0); });
}

/* ── Pointer ──────────────────────────────────────────────────────────── *
 * Which pair a press means is worked out from the distance to the line, not
 * from the shapes: where two pairs cross, the nearer line wins, and a press
 * on a sandbank is a press on the sandbank, not on the water behind it.
 * A tap on the water moves the pair on: one walkway, two, none. A drag from
 * one sandbank straight to another joins that pair the same way. A drag that
 * starts on the water paints the value a single tap on the first pair would
 * have set, over every pair it crosses that is still empty. */
function doDosky(ev) {
  const b = doska.getBoundingClientRect();
  if (!b.width) return null;
  const k = W / b.width;
  return { x: (ev.clientX - b.left) * k, y: (ev.clientY - b.top) * k };
}
function ostrovPod(p) {
  if (!p) return -1;
  let naj = -1, najd = (R + 3) * (R + 3);
  for (let i = 0; i < g.C; i++) {
    const dx = p.x - stredX(i), dy = p.y - stredY(i), d = dx * dx + dy * dy;
    if (d < najd) { najd = d; naj = i; }
  }
  return naj;
}
function vzdialenostOdUseku(p, u) {
  const dx = u.x2 - u.x1, dy = u.y2 - u.y1;
  const dl = dx * dx + dy * dy;
  let t = dl ? ((p.x - u.x1) * dx + (p.y - u.y1) * dy) / dl : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = u.x1 + t * dx - p.x, qy = u.y1 + t * dy - p.y;
  return Math.sqrt(qx * qx + qy * qy);
}
function paraPod(p) {
  if (!p) return -1;
  let naj = -1, najd = S / 2;
  for (let e = 0; e < g.E; e++) {
    const d = vzdialenostOdUseku(p, usek(e));
    if (d < najd) { najd = d; naj = e; }
  }
  return naj;
}
let podKurzorom = -1;
function ukazPod(e) {
  if (podKurzorom === e) return;
  if (podKurzorom >= 0 && hranyEl[podKurzorom]) hranyEl[podKurzorom].classList.remove('pod');
  podKurzorom = e;
  if (e >= 0 && hranyEl[e]) hranyEl[e].classList.add('pod');
}
let tah = null; // { typ, e, i, hodnota, maloval, id, znacka }
doska.addEventListener('pointerdown', (ev) => {
  if (done || pauza) return;
  if (ev.pointerType === 'mouse' && ev.button !== 0 && ev.button !== 2) return;
  const p = doDosky(ev);
  const i = ostrovPod(p);
  const znacka = ev.shiftKey || (ev.pointerType === 'mouse' && ev.button === 2);
  if (i >= 0) {
    tah = { typ: 'ostrov', i, maloval: false, id: ev.pointerId, znacka };
    zameraj(i);
  } else {
    const e = paraPod(p);
    if (e < 0) return;
    tah = { typ: 'para', e, hodnota: (v[e] + 1) % 3, maloval: false, id: ev.pointerId, znacka };
    kurzorNaParu(e);
  }
  try { doska.setPointerCapture(ev.pointerId); } catch (err) { /* works without capture too, less smoothly */ }
  ev.preventDefault();
});
doska.addEventListener('pointermove', (ev) => {
  const p = doDosky(ev);
  if (!tah || tah.id !== ev.pointerId) { if (ev.pointerType === 'mouse' && !done && !pauza) ukazPod(ostrovPod(p) >= 0 ? -1 : paraPod(p)); return; }
  if (done || pauza) return;
  if (tah.typ === 'ostrov') { tah.maloval = true; return; }
  const e = paraPod(p);
  if (e < 0 || (e === tah.e && !tah.maloval)) return;
  if (!tah.maloval) { tah.maloval = true; if (tah.znacka) prepniZnacku(tah.e); else nastav(tah.e, tah.hodnota); }
  if (tah.znacka) { if (!x[e] && v[e] === 0) prepniZnacku(e); }
  else if (tah.hodnota !== 0 && v[e] === 0) nastav(e, tah.hodnota);
  else if (tah.hodnota === 0 && v[e] !== 0) nastav(e, 0);
});
function koniecTahu(ev) {
  if (!tah || tah.id !== ev.pointerId) return;
  const t = tah;
  tah = null;
  try { doska.releasePointerCapture(ev.pointerId); } catch (err) { /* nothing */ }
  if (done || pauza) return;
  if (t.typ === 'ostrov') {
    const j = ostrovPod(doDosky(ev));
    if (j >= 0 && j !== t.i) {
      const e = g.indexPary(t.i, j);
      if (e >= 0) { if (t.znacka) prepniZnacku(e); else prepni(e); kurzorNaParu(e); }
    }
    return;
  }
  if (!t.maloval) { if (t.znacka) prepniZnacku(t.e); else prepni(t.e); }
}
doska.addEventListener('pointerup', koniecTahu);
doska.addEventListener('pointercancel', (ev) => { if (tah && tah.id === ev.pointerId) tah = null; });
doska.addEventListener('pointerleave', () => { if (!tah) ukazPod(-1); });
// The right button is the shortcut for the note, so no menu here.
doska.addEventListener('contextmenu', (ev) => ev.preventDefault());

/* ── Keyboard ─────────────────────────────────────────────────────────── *
 * The cursor walks from sandbank to sandbank. Ctrl plus arrow lays a walkway
 * in that direction and pressing again moves it on to two and then to none,
 * Shift plus arrow notes that pair as never joined
 * (ops/spec-hry-ux.md, pattern B2). */
function zameraj(i) {
  if (i < 0 || i >= g.C) return;
  if (kruhyEl[fokusI]) kruhyEl[fokusI].tabIndex = -1;
  fokusI = i;
  const el = kruhyEl[i];
  if (!el) return;
  el.tabIndex = 0;
  el.setAttribute('aria-label', popisOstrova(i));
  el.focus({ preventScroll: true });
  const k = $('kurzor');
  if (k) { k.setAttribute('cx', stredX(i)); k.setAttribute('cy', stredY(i)); k.setAttribute('r', R + 6); }
}
/* The cursor follows the hand too, so the keyboard carries on where the mouse
 * left off; it does not steal the focus. */
function kurzorNaParu(e) {
  const i = g.pary[e].a;
  if (kruhyEl[fokusI]) kruhyEl[fokusI].tabIndex = -1;
  fokusI = i;
  if (kruhyEl[i]) kruhyEl[i].tabIndex = 0;
  const k = $('kurzor');
  if (k) { k.setAttribute('cx', stredX(i)); k.setAttribute('cy', stredY(i)); }
}
function vSmere(i, d) {
  const j = g.susedia[i][d];
  return j < 0 ? { e: -1, j: -1 } : { e: g.indexPary(i, j), j };
}
const KLAVES_SMER = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
doska.addEventListener('keydown', (ev) => {
  if (done || pauza) return;
  const d = KLAVES_SMER[ev.key];
  if (d !== undefined) {
    poslednySmer = d;
    const t = vSmere(fokusI, d);
    if (ev.ctrlKey || ev.metaKey) { if (t.e >= 0) { prepni(t.e); zameraj(fokusI); } }
    else if (ev.shiftKey) { if (t.e >= 0) { prepniZnacku(t.e); zameraj(fokusI); } }
    else if (t.j >= 0) zameraj(t.j);
    ev.preventDefault();
    return;
  }
  switch (ev.key) {
    case 'Enter': case ' ': {
      const t = vSmere(fokusI, poslednySmer);
      if (t.e >= 0) { prepni(t.e); zameraj(fokusI); }
      ev.preventDefault();
      break;
    }
    case 'x': case 'X': {
      const t = vSmere(fokusI, poslednySmer);
      if (t.e >= 0) { prepniZnacku(t.e); zameraj(fokusI); }
      ev.preventDefault();
      break;
    }
    case 'Delete': case 'Backspace': case '0': {
      const t = vSmere(fokusI, poslednySmer);
      if (t.e >= 0) { nastav(t.e, 0); zameraj(fokusI); }
      ev.preventDefault();
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
document.addEventListener('keydown', (ev) => {
  if (ev.target && /input|textarea|select/i.test(ev.target.tagName || '')) return;
  const ctrl = ev.ctrlKey || ev.metaKey;
  if (ctrl && (ev.key === 'z' || ev.key === 'Z')) { if (ev.shiftKey) znova(); else spat(); ev.preventDefault(); return; }
  if (ctrl && (ev.key === 'r' || ev.key === 'R')) { znova(); ev.preventDefault(); return; }
  if (ctrl) return;
  if (ev.key === 'u' || ev.key === 'U') { spat(); ev.preventDefault(); return; }
  if (ev.key === 'r' || ev.key === 'R') { znova(); ev.preventDefault(); return; }
  if (ev.key === 'Escape' && pauza) { pokracuj(); return; }
  if (ev.key === 'p' || ev.key === 'P') { if (pauza) pokracuj(); else pozastav(false); }
});
document.addEventListener('keydown', nastavNecinnost, true);
document.addEventListener('pointerdown', nastavNecinnost, true);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (nastavenia.pauzaPriOdchode && start && !done) pozastav(true); }
  else ukazCas();
});

/* ── The week strip ───────────────────────────────────────────────────── *
 * A finished water carries one of two marks: clean, with no hint and no
 * check, or finished with help. Both are said in words as well, so the ring
 * is never the only carrier (ops/spec-hry-ux.md, part 8). */
const jeCiste = (st) => !!(st && st.done && !st.hints && !st.checks);
function triedaStavu(st) {
  if (st && st.done) return jeCiste(st) ? ' hotove ciste' : ' hotove';
  return st && st.v && st.v.some((y) => y) ? ' rozohrane' : '';
}
function popisStavu(st) {
  if (!st || !st.done) return '';
  return jeCiste(st) ? ', solved clean' : ', solved with help';
}
function ukazPasik() {
  if (!pasik) return;
  pasik.textContent = '';
  if (rezim === 'cvicenie') {
    const s = SADY.find((y) => y.id === sada);
    for (let k = 1; k <= s.pocet; k++) {
      const st = nacitaj('cranes:p:' + sada + ':' + k);
      const a = document.createElement(k === kSada ? 'span' : 'a');
      a.className = 'den' + (k === kSada ? ' dnes' : '') + triedaStavu(st);
      // The first water of a set lives at the set's own address, without a
      // number, exactly as postav.mjs builds it.
      if (k !== kSada) a.href = '/games/cranes/practice/' + sada + '/' + (k === 1 ? '' : k + '/');
      a.innerHTML = '<small>No.</small><b>' + k + '</b>';
      a.setAttribute('aria-label', 'Water ' + k + popisStavu(st));
      if (k === kSada) a.setAttribute('aria-current', 'page');
      pasik.appendChild(a);
    }
    return;
  }
  const dni = tyzden(datum);
  dni.forEach((d, k) => {
    const st = nacitaj('cranes:' + d);
    const buduci = d > dnes, pred = d < PRVY_DEN;
    const tag = d === datum || buduci || pred ? 'span' : 'a';
    const a = document.createElement(tag);
    a.className = 'den' + (d === datum ? ' dnes' : '') + (buduci || pred ? ' buduci' : '') + triedaStavu(st);
    if (tag === 'a') a.href = '/games/cranes/' + d + '/';
    a.innerHTML = '<small>' + DNI[k] + '</small><b>' + Number(d.slice(8)) + '</b>';
    a.title = pekneDatum(d) + ', ' + UROVNE[urovenDna(d)].label + (buduci ? ' (not yet)' : '');
    a.setAttribute('aria-label', a.title + popisStavu(st));
    if (d === datum) a.setAttribute('aria-current', 'page');
    pasik.appendChild(a);
  });
}

/* ── Settings panel ───────────────────────────────────────────────────── */
const casBlok = $('cas-blok');
function pouziNastavenia() {
  if (casBlok) casBlok.hidden = !nastavenia.casovac;
  if (!nastavenia.zivaKontrola && !odhalene) {
    for (const el of hranyEl) el.classList.remove('chyba');
    for (const el of ostrovyEl) if (el) el.classList.remove('chyba');
  }
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
    track('game_setting', { game: 'cranes', setting: kluc, on: el.checked });
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
  for (const k of vsetkyKluce('cranes:')) {
    const d = k.slice('cranes:'.length);
    if (!isValidDate(d)) continue;
    const s = nacitaj(k);
    if (s) out[d] = s;
  }
  return out;
}
function zlucStavDna(lokalny, vzdialeny) {
  if (!vzdialeny) return lokalny;
  if (!lokalny) return vzdialeny;
  const y = (vzdialeny.t || 0) >= (lokalny.t || 0) ? vzdialeny : lokalny;
  const hotovo = lokalny.done || vzdialeny.done || null;
  return hotovo && !y.done ? Object.assign({}, y, { done: hotovo }) : y;
}
/* The streak, counted backwards from today over the finished days. One missed
 * day is forgiven after five days in a row (a streak freeze), at most twice in
 * the same calendar month, and two missed days in a row end it whatever came
 * before (ops/spec-hry-ux.md, part 8). Frozen days are not counted as wins,
 * they are only stepped over. */
const PRED_MRAZOM = 5, MRAZOV_ZA_MESIAC = 2;
function seriaZDni(dni) {
  let d = dni[dnes] && dni[dnes].done ? dnes : posunDen(dnes, -1);
  let pocet = 0, mrazy = 0;
  const vMesiaci = {};
  while (d >= PRVY_DEN) {
    if (dni[d] && dni[d].done) { pocet++; d = posunDen(d, -1); continue; }
    const m = d.slice(0, 7);
    if ((vMesiaci[m] || 0) >= MRAZOV_ZA_MESIAC) break;
    let p = posunDen(d, -1), pred = 0;
    while (pred < PRED_MRAZOM && dni[p] && dni[p].done) { pred++; p = posunDen(p, -1); }
    if (pred < PRED_MRAZOM) break;
    vMesiaci[m] = (vMesiaci[m] || 0) + 1;
    mrazy++;
    d = posunDen(d, -1);
  }
  return { pocet, mrazy };
}
function prepocitajSeriu() {
  const dni = stavVsetkychDni();
  const s = seriaZDni(dni);
  if (!s.pocet) { try { localStorage.removeItem('cranes:streak'); } catch (e) { /* nič */ } return; }
  uloz('cranes:streak', { posledny: dni[dnes] && dni[dnes].done ? dnes : posunDen(dnes, -1), pocet: s.pocet, mrazy: s.mrazy });
}
function odosliStav() {
  if (!ucet.prihlaseny()) return;
  ucet.hra.uloz('cranes', { dni: stavVsetkychDni(), t: Date.now() }).catch(() => { /* sieťová chyba: lokálne ostáva pravdou */ });
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
  try { vzdialene = await ucet.hra.nacitaj('cranes'); } catch (e) { return; /* sieťová chyba: lokálne ostáva pravdou */ }
  const diaDni = vzdialene && vzdialene.dni && typeof vzdialene.dni === 'object' ? vzdialene.dni : {};
  let zmenene = false;
  for (const [d, r] of Object.entries(diaDni)) {
    if (!isValidDate(d) || !r || typeof r !== 'object') continue;
    const kluc = 'cranes:' + d;
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
        x = Array.isArray(cerstve.x) && cerstve.x.length === g.E ? cerstve.x.slice() : new Array(g.E).fill(0);
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
  // push back too: a day finished only in this browser (or a done just merged in) reaches the account right away
  odosliStav();
}

/* ── Start ────────────────────────────────────────────────────────────── */
async function spusti() {
  if (jeBuduci) {
    datumEl.textContent = pekneDatum(datum);
    stavEl.textContent = 'This water opens on ' + pekneDatum(datum) + ' (Bratislava time). Come back then, or play today’s water.';
    doska.setAttribute('hidden', '');   // an SVG needs the attribute, see index.html
    for (const b of [spatBtn, znovaBtn, resetBtn, checkBtn, hintBtn]) if (b) b.disabled = true;
    ukazPasik();
    return;
  }
  try {
    zadanie = await nacitajZadanie();
  } catch (e) {
    stavEl.textContent = 'The water could not be prepared. Please reload the page.';
    throw e;
  }
  n = zadanie.n;
  g = graf(zadanie.islands, n);
  ulozene = nacitaj(KLUC);
  v = (ulozene && Array.isArray(ulozene.v) && ulozene.v.length === g.E) ? ulozene.v.slice() : new Array(g.E).fill(0);
  x = (ulozene && Array.isArray(ulozene.x) && ulozene.x.length === g.E) ? ulozene.x.slice() : new Array(g.E).fill(0);
  done = ulozene && ulozene.done ? ulozene.done : null;
  hints = ulozene && ulozene.hints ? ulozene.hints : 0;
  checks = ulozene && ulozene.checks ? ulozene.checks : 0;
  sekundy = ulozene && ulozene.sec ? ulozene.sec : 0;
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
  if (datumEl) datumEl.textContent = rezim === 'cvicenie' ? UROVNE[zadanie.uroven].label + ' practice ' + sada.split('-')[1] + ', water ' + kSada : pekneDatum(datum);
  if (urovenEl) urovenEl.textContent = UROVNE[zadanie.uroven].label + ' · ' + n + '×' + n;
  if (done) doska.classList.add('hotovo');
  else if (v.some((y) => y) || x.some((y) => y)) pozastav(true);
  ukazCas();
  ukazSeriu();
  ukazHistoriu();
  ukazPasik();
  ukazStav();
  ukazTlacidla();
}
spusti().then(synchronizujUcet);
