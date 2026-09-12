import '../kniha.mjs?v=1';
/* Swans: the game page. One script for the daily lake, the archive days and
 * the practice sets; the page says which one it is:
 *
 *   <body data-den="YYYY-MM-DD">          an archive day (built page)
 *   <body data-sada="easy-1" data-k="3">  a practice lake
 *   nothing                               today's lake (or ?d=YYYY-MM-DD)
 *
 * The puzzle itself comes, in this order: from <script type="application/json"
 * id="zadanie"> embedded in a built page; from dni/YYYY-MM.json for the day;
 * or, when both are missing, generated right here from the date. All three
 * give the same lake for the same date (plan.mjs, generator.mjs).
 *
 * The board is one SVG, always drawn here from the puzzle, so a built page
 * only has to carry the swans for readers without JavaScript.
 *
 * Marks are one flat array, one entry per step between two neighbouring cells,
 * in the order geometria() lists them (generator.mjs: the n*(n-1) horizontal
 * steps first, then the (n-1)*n vertical ones):
 *   0  untouched,
 *   1  a line, the loop runs from one cell to the other,
 *   2  a cross, the player's own note that it does not.
 * The cross is never checked and never required: it is there for the same
 * reason a person puts a pencil cross on paper.
 *
 * Stored in localStorage (all in try/catch, private windows throw):
 *   swans:YYYY-MM-DD        { v, sec, start, done, hints, checks, t }
 *   swans:p:<set>:<k>       the same for a practice lake
 *   swans:streak            { posledny: YYYY-MM-DD, pocet, mrazy }
 *   swans:nastavenia        the settings panel
 * sec = seconds spent before the current run, start = ms when the current run
 * began (null while paused or before the first move), done = ms of the solve,
 * hints and checks = help used, t = ms of the last save. The history line is
 * counted from the day records themselves, there is no separate one.
 * Outgoing events via window.umami, if it runs: game_solved, game_check,
 * game_hint, game_setting. Nothing else leaves the browser, unless the player
 * is signed in (arling.sk account, /style/ucet.js): then every swans:YYYY-MM-DD
 * save is also pushed to the account (throttled, 2s) and pulled back on load,
 * so the streak and history follow across devices. Signed out, nothing
 * changes; a signed-in sync that fails over the network fails silently, this
 * browser's copy stays the truth.
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
const zdielajBtn = $('zdielaj');
const zdielaneEl = $('zdielane');
const pauzaBtn = $('pauza');
const pauzaBlok = $('pauza-blok');
const pokracujBtn = $('pokracuj');
const pauzaCas = $('pauza-cas');
const pasik = $('pasik');
const urovenEl = $('uroven');
const historiaEl = $('historia');
const labuteText = $('labute-text');

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
const NASTAVENIA_KLUC = 'swans:nastavenia';
// Auto exclude and Live check are off by default: the crosses are the
// player's own, and nothing turns red while you play (Andrej, 10. 9.); Check
// is the only judge before the loop is closed.
const NASTAVENIA_PREDVOLENE = { casovac: true, pauzaPriOdchode: true, autoKrizky: false, zivaKontrola: false, potvrditReset: true, oslava: true };
let nastavenia = Object.assign({}, NASTAVENIA_PREDVOLENE, nacitaj(NASTAVENIA_KLUC) || {});
function ulozNastavenia() { uloz(NASTAVENIA_KLUC, nastavenia); }

/* ── Which lake ───────────────────────────────────────────────────────── */
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
const KLUC = rezim === 'cvicenie' ? 'swans:p:' + sada + ':' + kSada : 'swans:' + datum;
// The root address always opens today's lake; once the date is settled,
// rewrite it to today's built page so the address bar and a shared link
// point at the day itself (Andrej, 10. 9.). Only the plain root qualifies:
// a built archive day already names its date, a practice page its set, and
// a page opened with ?d= keeps that query untouched.
if (rezim === 'den' && !body.dataset.den && jeDnes && !location.search) {
  try { history.replaceState(null, '', '/games/swans/' + datum + '/'); } catch (e) { /* the address stays generic; the game still works */ }
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

/* ── Loading the lake ─────────────────────────────────────────────────── */
function vlozene() {
  const el = $('zadanie');
  if (!el) return null;
  try { return rozbal(JSON.parse(el.textContent)); } catch (e) { return null; }
}
async function zTabulky(iso) {
  try {
    const r = await fetch('/games/swans/dni/' + iso.slice(0, 7) + '.json', { cache: 'no-cache' });
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
let zadanie, n, g, v, start, done, sekundy, hints, checks, ulozene;
let undoStack = [];
let redoStack = [];
let fokusI = 0;             // the keyboard cursor: which cell it sits on
let poslednySmer = 1;       // for Space, X and Delete without an arrow (east)
let kreslim = false;        // the keyboard is drawing the loop
let kotva = -1;             // tap by tap drawing: the cell the next tap draws from
let tikac = null;
let necinnost = null;
let pauza = false;
let tip = null;             // the hint on screen, cleared by the next move
let odhalene = false;       // Check's second step is showing the wrong marks
let checkStav = null;       // what the last Check saw, so the second press can reveal it
const hranyEl = [];
const polickaEl = [];
const poliaEl = [];

/* ── Drawing ──────────────────────────────────────────────────────────── *
 * One cell is S units of the viewBox and the board is exactly n cells across,
 * so it scales to whatever width it gets. At 390 px a ten by ten still gives
 * 39 px per cell, and the two nearest places a tap can land on (the middle of
 * a horizontal step and the middle of the vertical one beside it) are 0.707
 * of a cell apart, which is 27 px, over the 24 px the standard asks for
 * (ops/spec-hry-ux.md, part 9, and ops/spec-swans.md). */
const S = 40, R = 11;
let W = 280;
function stlpec(i) { return i % n; }
function riadok(i) { return (i / n) | 0; }
function cx(i) { return S / 2 + stlpec(i) * S; }
function cy(i) { return S / 2 + riadok(i) * S; }
function bunkaA(e) { return g.edgeCells[2 * e]; }
function bunkaB(e) { return g.edgeCells[2 * e + 1]; }
function stredHranyX(e) { return (cx(bunkaA(e)) + cx(bunkaB(e))) / 2; }
function stredHranyY(e) { return (cy(bunkaA(e)) + cy(bunkaB(e))) / 2; }
function ciara(trieda, x1, y1, x2, y2) {
  return '<line class="' + trieda + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
}
function postavMriezku() {
  W = n * S;
  document.documentElement.style.setProperty('--n', n);
  doska.setAttribute('viewBox', '0 0 ' + W + ' ' + W);
  doska.setAttribute('aria-label', 'Lake grid ' + n + ' by ' + n);
  const k = [];
  k.push('<g class="plocha" role="presentation">');
  // the water the finished loop fills, drawn under everything
  k.push('<path class="voda" id="voda" d="" aria-hidden="true"/>');
  // the faint grid of cells
  k.push('<g class="mriezka" aria-hidden="true">');
  for (let i = 1; i < n; i++) {
    k.push(ciara('', i * S, 0, i * S, W));
    k.push(ciara('', 0, i * S, W, i * S));
  }
  k.push('</g>');
  // the cells: the grid the keyboard walks on, one row per row of the lake.
  // The swans sit here, under the loop, the way they do on paper.
  k.push('<g class="policka" role="presentation">');
  for (let r = 0; r < n; r++) {
    k.push('<g role="row" aria-rowindex="' + (r + 1) + '">');
    for (let c = 0; c < n; c++) {
      const i = r * n + c, p = zadanie.pearls[i];
      k.push('<g class="policko" data-i="' + i + '">'
        + '<rect class="pole" role="gridcell" aria-colindex="' + (c + 1) + '" data-i="' + i + '" tabindex="' + (i === 0 ? 0 : -1) + '" x="' + (c * S) + '" y="' + (r * S) + '" width="' + S + '" height="' + S + '"></rect>'
        + '<circle class="prstenec" cx="' + cx(i) + '" cy="' + cy(i) + '" r="' + (R + 5) + '"/>'
        + (p ? '<circle class="labut ' + (p === 1 ? 'biela' : 'cierna') + '" cx="' + cx(i) + '" cy="' + cy(i) + '" r="' + R + '"/>' : '')
        + '</g>');
    }
    k.push('</g>');
  }
  k.push('</g>');
  // one group per step between two neighbouring cells: the line, the cross,
  // and a ring for a hint or a mistake. data-cx and data-cy carry the middle
  // of the step, so a test (and a person poking at the page) can find it
  // without redoing the geometry by hand.
  k.push('<g class="ciary" aria-hidden="true">');
  for (let e = 0; e < g.E; e++) {
    const a = bunkaA(e), b = bunkaB(e);
    const mx = stredHranyX(e), my = stredHranyY(e);
    k.push('<g class="h" data-e="' + e + '" data-v="0" data-cx="' + mx + '" data-cy="' + my + '">'
      + ciara('nahlad', cx(a), cy(a), cx(b), cy(b))
      + ciara('l0', cx(a), cy(a), cx(b), cy(b))
      + '<path class="krizik" d="M' + (mx - 6) + ' ' + (my - 6) + 'L' + (mx + 6) + ' ' + (my + 6) + 'M' + (mx - 6) + ' ' + (my + 6) + 'L' + (mx + 6) + ' ' + (my - 6) + '"/>'
      + '<circle class="znak" cx="' + mx + '" cy="' + my + '" r="12"/>'
      + '</g>');
  }
  k.push('</g>');
  k.push('<rect class="kotva" id="kotva" x="3" y="3" width="' + (S - 6) + '" height="' + (S - 6) + '" rx="7"/>');
  k.push('<rect class="kurzor" id="kurzor" x="3" y="3" width="' + (S - 6) + '" height="' + (S - 6) + '" rx="7"/>');
  k.push('</g>');
  doska.innerHTML = k.join('');
  hranyEl.length = 0; polickaEl.length = 0; poliaEl.length = 0;
  doska.querySelectorAll('.h').forEach((el) => { hranyEl[+el.dataset.e] = el; });
  doska.querySelectorAll('.policko').forEach((el) => { polickaEl[+el.dataset.i] = el; });
  doska.querySelectorAll('.pole').forEach((el) => { poliaEl[+el.dataset.i] = el; });
  popisLabuti();
}
/* The swans as plain text for a screen reader: the drawing itself only tells
 * the shape of the lake, not what it asks for. */
function popisLabuti() {
  if (!labuteText) return;
  const biele = [], cierne = [];
  for (let i = 0; i < g.C; i++) {
    const p = zadanie.pearls[i];
    if (!p) continue;
    (p === 1 ? biele : cierne).push('row ' + (riadok(i) + 1) + ' column ' + (stlpec(i) + 1));
  }
  const casti = ['The lake, ' + n + ' by ' + n + ' cells, with ' + (biele.length + cierne.length) + ' swans'];
  if (biele.length) casti.push('white swans at ' + biele.join(', '));
  if (cierne.length) casti.push('black swans at ' + cierne.join(', '));
  labuteText.textContent = casti.join('. ') + '.';
}
const SMERY = ['north', 'east', 'south', 'west'];   // the order of geometria().cellEdges
/* The directions a line leaves this cell in, lowest first. Two opposite
 * directions differ by 2, so straight means s[1] - s[0] === 2. */
function smeryCiar(i) {
  const out = [];
  for (let d = 0; d < 4; d++) { const e = g.cellEdges[(i << 2) + d]; if (e >= 0 && v[e] === 1) out.push(d); }
  return out;
}
function popisPolicka(i) {
  const p = zadanie.pearls[i];
  const casti = ['row ' + (riadok(i) + 1) + ', column ' + (stlpec(i) + 1)];
  casti.push(p === 1 ? 'white swan' : p === 2 ? 'black swan' : 'open water');
  const ciary = [], krizky = [];
  for (let d = 0; d < 4; d++) {
    const e = g.cellEdges[(i << 2) + d];
    if (e < 0) continue;
    if (v[e] === 1) ciary.push(SMERY[d]);
    else if (v[e] === 2) krizky.push(SMERY[d]);
  }
  casti.push(ciary.length ? 'the loop runs ' + ciary.join(' and ') : 'no line yet');
  if (krizky.length) casti.push('crossed ' + krizky.join(' and '));
  return casti.join(', ');
}
function ukazHranu(e) {
  const el = hranyEl[e];
  if (!el) return;
  if (el.getAttribute('data-v') !== String(v[e])) el.setAttribute('data-v', v[e]);
}
/* A soft visual cue only, not a judgement: a swan that already has the shape
 * it asks for goes quiet. It says nothing about whether the rest of the loop
 * is right (Andrej, 10. 9.: nothing turns red while playing; only Check
 * judges). */
function splnena(i) {
  const p = zadanie.pearls[i];
  if (!p) return false;
  const s = smeryCiar(i);
  if (s.length !== 2) return false;
  const rovno = s[1] - s[0] === 2;
  if (p === 1) {
    if (!rovno) return false;
    for (const d of s) {
      const j = g.cellSused[(i << 2) + d];
      if (j < 0) continue;
      const t = smeryCiar(j);
      if (t.length === 2 && t[1] - t[0] !== 2) return true;
    }
    return false;
  }
  if (rovno) return false;
  for (const d of s) {
    const j = g.cellSused[(i << 2) + d];
    if (j < 0) return false;
    const t = smeryCiar(j);
    if (t.length !== 2 || t[1] - t[0] !== 2) return false;
    const e2 = g.cellEdges[(j << 2) + d];
    if (e2 < 0 || v[e2] !== 1) return false;
  }
  return true;
}
function oznacSplnene() {
  for (let i = 0; i < g.C; i++) {
    const el = polickaEl[i];
    if (el) el.classList.toggle('splnene', splnena(i));
  }
}
/* The finished loop as one closed shape, so the water inside it can be
 * filled. Walked from the first cell that carries two lines. */
function vodaCesta() {
  let zaciatok = -1;
  for (let i = 0; i < g.C && zaciatok < 0; i++) if (smeryCiar(i).length === 2) zaciatok = i;
  if (zaciatok < 0) return '';
  const body = [];
  let i = zaciatok, pred = -1;
  for (let krok = 0; krok <= g.C; krok++) {
    body.push(cx(i) + ' ' + cy(i));
    let dalsi = -1;
    for (const d of smeryCiar(i)) { const j = g.cellSused[(i << 2) + d]; if (j !== pred) { dalsi = j; break; } }
    if (dalsi < 0) break;
    pred = i; i = dalsi;
    if (i === zaciatok) break;
  }
  return 'M' + body.join('L') + 'Z';
}
function ukazVsetko() {
  for (let e = 0; e < g.E; e++) ukazHranu(e);
  oznacSplnene();
  const voda = $('voda');
  if (voda) voda.setAttribute('d', done ? vodaCesta() : '');
  if (poliaEl[fokusI]) poliaEl[fokusI].setAttribute('aria-label', popisPolicka(fokusI));
}
function zmazTip() {
  if (!tip) return;
  tip = null;
  for (const el of hranyEl) if (el) el.classList.remove('tip');
  for (const el of polickaEl) if (el) el.classList.remove('tip');
  if (hintBtn) hintBtn.textContent = 'Hint';
}
function zmazOdhalenie() {
  if (!odhalene && !checkStav) return;
  odhalene = false; checkStav = null;
  for (const el of hranyEl) if (el) el.classList.remove('chyba');
  for (const el of polickaEl) if (el) el.classList.remove('chyba');
  if (checkBtn) checkBtn.textContent = 'Check';
}
/* Live check is off by default; when it is on, a mark that does not belong is
 * shown as soon as it appears, with a ring and a broken line, not by colour
 * alone. */
function zivaKontrola() {
  if (!nastavenia.zivaKontrola || done || !zadanie) return;
  const p = porovnaj(v, zadanie.solution);
  for (const e of p.zleCiary) if (hranyEl[e]) hranyEl[e].classList.add('chyba');
  for (const e of p.zleKrizky) if (hranyEl[e]) hranyEl[e].classList.add('chyba');
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
  kreslim = false;
  zrusKotvu();
  zastavTikac();
  nastavNecinnost();
  ulozStav();
  ukazCas();
  if (pauzaCas) pauzaCas.textContent = sekundy ? 'You have spent ' + slovaCas(sekundy) + ' so far.' : 'Your lines are kept; the clock continues when you resume.';
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
  const s = nacitaj('swans:streak');
  if (!s || !s.pocet) { seriaEl.textContent = ''; return; }
  const ziva = s.posledny === dnes || s.posledny === posunDen(dnes, -1);
  if (!ziva) { seriaEl.textContent = ''; return; }
  const mrazy = s.mrazy || 0;
  seriaEl.textContent = 'Streak: ' + s.pocet + (s.pocet === 1 ? ' day' : ' days')
    + (mrazy ? ', ' + mrazy + (mrazy === 1 ? ' missed day forgiven' : ' missed days forgiven') : '');
}
function zapisSeriu() {
  // Only a lake finished on its own day counts: the archive is for practice.
  // The streak is always counted from the finished days themselves, never
  // added up as a stored number, so a merge from the account cannot leave it
  // wrong (prepocitajSeriu below).
  if (!jeDnes) return;
  prepocitajSeriu();
}
/* Every finished day in this browser, newest first. */
function historiaDni() {
  const out = [];
  for (const k of vsetkyKluce('swans:')) {
    const d = k.slice('swans:'.length);
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
  historiaEl.innerHTML = '<b>Your lakes:</b> ' + h.length + ' finished' + (urovne ? ' (' + urovne + ')' : '') + (ciste ? ', ' + ciste + ' clean, with no hint and no check' : ', none clean yet')
    + (best ? ', best ' + formatCas(best.sec) + ' on ' + kratkyDatum(best.d) : '') + (priemer ? ', average ' + formatCas(priemer) : '') + '. <a href="/games/swans/archive/">Archive and full history</a>.';
}

/* ── Saving and solving ───────────────────────────────────────────────── */
function ulozStav() { uloz(KLUC, { v, sec: sekundy, start, done, hints, checks, t: Date.now() }); naplanujOdoslanie(); }

function ukazStav() {
  oznacSplnene();
  stavEl.classList.toggle('ok', !!done);
  if (done) {
    const s = sekundy ? ' in ' + formatCas(sekundy) : '';
    const pomoc = [];
    if (hints) pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
    if (checks) pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
    const hn = pomoc.length ? ' with ' + pomoc.join(' and ') : ' without a hint or a check';
    const seria = jeDnes ? (nacitaj('swans:streak') || {}).pocet || 0 : 0;
    stavEl.innerHTML = '<b>Solved</b>' + s + hn + '. ' + (pomoc.length ? 'The swans have their lake.' : 'A clean lake: the swans are impressed.')
      + (jeDnes ? ' A new lake arrives at midnight, Bratislava time.' : '')
      + (seria >= 1 ? '<span class="oslava-streak">Day ' + seria + ' of your streak.</span>' : '')
      + '<span class="oslava-dalej"><a href="/games/swans/practice/">Practice sets</a></span>';
    return;
  }
  const oznacenych = v.some((y) => y !== 0);
  if (!oznacenych) { stavEl.textContent = 'Drag from cell to cell to draw the loop, or tap the gap between two cells: a line, then a cross, then nothing.'; return; }
  let vsetky = true;
  for (let i = 0; i < g.C && vsetky; i++) if (zadanie.pearls[i] && !splnena(i)) vsetky = false;
  if (vsetky) { stavEl.textContent = 'Every swan has the shape it asks for, but the loop is not one closed ring yet. Check shows where.'; return; }
  stavEl.textContent = '';
}

/* Where a step sits, in words. Swans is pattern C, so the first press of
 * Check names a third of the path in the order it was drawn, not a quadrant
 * of the board (ops/spec-hry-ux.md, part 4). The walk starts at an open end
 * of what the player has drawn, so the same board always gives the same
 * thirds, also after a reload. */
const TRETINY = ['first third', 'middle third', 'last third'];
function cestaPoradie() {
  const poradie = new Int32Array(g.C).fill(-1);   // policko -> jeho miesto na ceste
  const sCiarou = [];
  for (let i = 0; i < g.C; i++) if (smeryCiar(i).length) sCiarou.push(i);
  if (!sCiarou.length) return null;
  // najprv otvorene konce, potom zvysok (uzavrety kruh nema koniec)
  const starty = sCiarou.filter((i) => smeryCiar(i).length === 1).concat(sCiarou);
  let k = 0;
  for (const s of starty) {
    if (poradie[s] >= 0) continue;
    const zasobnik = [s];
    while (zasobnik.length) {
      const i = zasobnik.pop();
      if (poradie[i] >= 0) continue;
      poradie[i] = k++;
      const dalsie = [];
      for (const d of smeryCiar(i)) { const j = g.cellSused[(i << 2) + d]; if (j >= 0 && poradie[j] < 0) dalsie.push(j); }
      for (let z = dalsie.length - 1; z >= 0; z--) zasobnik.push(dalsie[z]);
    }
  }
  return { poradie, dlzka: k };
}
/* A line takes the place of the earlier of its two cells; a cross sits beside
 * the path, so it borrows the place of the nearest cell on it. */
function oblastHrany(e, c) {
  if (!c) return '';
  const a = bunkaA(e), b = bunkaB(e);
  let m = -1;
  if (c.poradie[a] >= 0 && c.poradie[b] >= 0) m = Math.min(c.poradie[a], c.poradie[b]);
  else if (c.poradie[a] >= 0) m = c.poradie[a];
  else if (c.poradie[b] >= 0) m = c.poradie[b];
  else {
    let najd = Infinity;
    for (let i = 0; i < g.C; i++) {
      if (c.poradie[i] < 0) continue;
      const d = Math.min(Math.abs(riadok(i) - riadok(a)) + Math.abs(stlpec(i) - stlpec(a)),
                         Math.abs(riadok(i) - riadok(b)) + Math.abs(stlpec(i) - stlpec(b)));
      if (d < najd) { najd = d; m = c.poradie[i]; }
    }
  }
  if (m < 0) return '';
  return TRETINY[Math.min(2, Math.floor((m * 3) / c.dlzka))];
}
function zoznamSlov(a) {
  if (a.length === 1) return a[0];
  if (a.length === 2) return a[0] + ' and ' + a[1];
  return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
}
/* Check, in two steps. The first press says how many marks are wrong and
 * roughly where; only the second press shows which. The puzzle stays a puzzle
 * unless you ask twice. */
function skontrolujStav() {
  if (done || pauza) return;
  const p = porovnaj(v, zadanie.solution);
  if (!p.ciary && !p.krizky) { stavEl.textContent = 'Nothing on the board yet.'; return; }
  checks++;
  ulozStav();
  const zle = p.zleCiary.concat(p.zleKrizky);
  if (!zle.length) {
    zmazOdhalenie();
    const casti = [];
    if (p.ciary) casti.push(p.ciary + (p.ciary === 1 ? ' line' : ' lines'));
    if (p.krizky) casti.push(p.krizky + (p.krizky === 1 ? ' cross' : ' crosses'));
    stavEl.textContent = 'Everything on the board is right so far: ' + casti.join(' and ') + ' in place.';
    track('game_check', { game: 'swans', wrong: 0 });
    return;
  }
  const casti = [];
  if (p.zleCiary.length) casti.push(p.zleCiary.length + (p.zleCiary.length === 1 ? ' line where the loop does not run' : ' lines where the loop does not run'));
  if (p.zleKrizky.length) casti.push(p.zleKrizky.length + (p.zleKrizky.length === 1 ? ' cross where it does' : ' crosses where it does'));
  if (checkStav && !odhalene) {
    odhalene = true;
    for (const e of zle) if (hranyEl[e]) hranyEl[e].classList.add('chyba');
    stavEl.textContent = 'The ringed marks do not belong: ' + casti.join(', ') + '. Take them off and keep going.';
    checkBtn.textContent = 'Check';
    track('game_check', { game: 'swans', wrong: zle.length, revealed: true });
    return;
  }
  const c = cestaPoradie();
  const oblasti = [];
  for (const e of zle) { const o = oblastHrany(e, c); if (o && !oblasti.includes(o)) oblasti.push(o); }
  oblasti.sort((x, y) => TRETINY.indexOf(x) - TRETINY.indexOf(y));
  checkStav = { pocet: zle.length };
  // Bez jedinej ciary este niet cesty, na ktorej by sa dala tretina pomenovat.
  stavEl.textContent = 'There ' + (zle.length === 1 ? 'is 1 mistake' : 'are ' + zle.length + ' mistakes') + ' on the board: ' + casti.join(', ')
    + (oblasti.length ? ', in the ' + zoznamSlov(oblasti) + ' of the path you have drawn' : '') + '. Press Check again to show where.';
  checkBtn.textContent = 'Show';
  track('game_check', { game: 'swans', wrong: zle.length, revealed: false });
}

/* The first press of Hint names the technique and the place but not what goes
 * there: every rule sentence turns at ", so ", and that tail waits for the
 * second press (ops/spec-hry-ux.md, part 5). */
function bezHodnoty(text) {
  const k = text.lastIndexOf(', so ');
  return k > 0 ? text.slice(0, k) + '.' : text;
}
/* Hint, in two steps too: the first press names the rule and the place and
 * rings the step it is about; the second press draws that one step. Every
 * hint is counted and shown at the end. */
function ukazNapovedu() {
  if (done || pauza) return;
  if (tip) {
    // second press: draw it
    const t = tip;
    hints++;   // counted before the move, so the save inside it carries the new number
    const zmenilo = zmenaStavu(() => { for (const h of t.hrany) v[h.i] = h.val; });
    zmazTip(); zmazOdhalenie();
    track('game_hint', { game: 'swans', kind: t.druh, rule: t.pravidlo, layer: t.vrstva, applied: true });
    if (!zmenilo) { ulozStav(); ukazStav(); }
    if (!done) stavEl.textContent = t.text;   // now the whole sentence
    return;
  }
  const h = napoveda(v, zadanie.pearls, zadanie.solution, n);
  if (!h) return;
  tip = h;
  for (const x of h.hrany) {
    if (hranyEl[x.i]) hranyEl[x.i].classList.add('tip');
    if (polickaEl[bunkaA(x.i)]) polickaEl[bunkaA(x.i)].classList.add('tip');
    if (polickaEl[bunkaB(x.i)]) polickaEl[bunkaB(x.i)].classList.add('tip');
  }
  stavEl.textContent = bezHodnoty(h.text) + ' Press Hint again to draw it.';
  hintBtn.textContent = 'Draw it';
  track('game_hint', { game: 'swans', kind: h.druh, rule: h.pravidlo, layer: h.vrstva, applied: false });
}

function skontroluj() {
  if (!jeVyriesene(v, zadanie.pearls, n)) return false;
  sekundy = ubehnute();
  done = Date.now();
  start = null;
  kreslim = false;
  zrusKotvu();
  zastavTikac();
  nastavNecinnost();
  doska.classList.add('hotovo');
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  ukazCas();
  ulozStav();                 // the streak is counted from the saved days
  zapisSeriu();
  ukazSeriu();
  ukazHistoriu();
  ukazPasik();
  track('game_solved', { game: 'swans', day: rezim === 'den' ? datum : sada + '/' + kSada, seconds: sekundy, hints, checks, level: zadanie.uroven });
  const kontajner = document.querySelector('.hra');
  if (kontajner) oslava(kontajner, { redukovany: !nastavenia.oslava || window.matchMedia('(prefers-reduced-motion: reduce)').matches });
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
 * A voluntary step after the lake is finished. One line: which lake, the time
 * and how much help was taken. Never the board and never a grid of the
 * player's marks: in this game the marks are the loop, so a grid would be the
 * spoiler itself (ops/spec-hry-ux.md, part 8). */
function textZdielania() {
  const uroven = zadanie && zadanie.uroven && UROVNE[zadanie.uroven] ? UROVNE[zadanie.uroven].label : '';
  const kto = rezim === 'cvicenie'
    ? 'Swans practice, ' + (uroven || sada) + ' no. ' + kSada
    : 'Swans ' + datum + (uroven ? ', ' + uroven : '');
  const pomoc = hints || checks
    ? hints + (hints === 1 ? ' hint' : ' hints') + ', ' + checks + (checks === 1 ? ' check' : ' checks')
    : 'no hint, no check';
  const odkaz = rezim === 'cvicenie'
    ? 'https://arling.sk/games/swans/practice/' + sada + '/' + (kSada === 1 ? '' : kSada + '/')
    : 'https://arling.sk/games/swans/' + (jeDnes ? '' : datum + '/');
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
function snimka() { return v.slice(); }
function rovnake(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function zmenaStavu(fn) {
  if (done || pauza) return false;
  const pred = snimka();
  fn();
  if (rovnake(pred, v)) return false;
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
/* Auto exclude, off by default: a cell the loop already passes through has no
 * room for a third line, so its other sides get the cross. One move in the
 * history. */
function dopluKrizky() {
  for (let i = 0; i < g.C; i++) {
    if (smeryCiar(i).length !== 2) continue;
    for (let d = 0; d < 4; d++) { const e = g.cellEdges[(i << 2) + d]; if (e >= 0 && v[e] === 0) v[e] = 2; }
  }
}
function nastav(e, hodnota) {
  if (done || pauza || e < 0 || v[e] === hodnota) return;
  zmenaStavu(() => { v[e] = hodnota; if (nastavenia.autoKrizky) dopluKrizky(); });
}
function prepni(e) { if (e >= 0) nastav(e, (v[e] + 1) % 3); }

function spat() {
  if (done || pauza || !undoStack.length) return;
  redoStack.push(snimka());
  v = undoStack.pop();
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) { ulozStav(); zivaKontrola(); }
  ukazStav();
  ukazTlacidla();
}
function znova() {
  if (done || pauza || !redoStack.length) return;
  undoStack.push(snimka());
  v = redoStack.pop();
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) { ulozStav(); zivaKontrola(); }
  ukazStav();
  ukazTlacidla();
}
/* Clear: an empty lake, the clock keeps running (Andrej, 10. 9.: clearing is
 * a move, not a restart). One Undo brings every line and cross back. */
function reset() {
  if (done || pauza) return;
  if (v.every((y) => y === 0)) return;
  if (nastavenia.potvrditReset && !window.confirm('Clear the whole lake? The clock keeps running and one Undo brings your lines back.')) return;
  zrusKotvu();
  zmenaStavu(() => { v = new Array(g.E).fill(0); });
}

/* ── Pointer ──────────────────────────────────────────────────────────── *
 * A press in the middle of a cell starts the loop there: drag on and the loop
 * follows, drag back along it and it rubs out. A press anywhere else means
 * the nearest step between two cells, and a tap there goes through line,
 * cross and nothing. For anyone who cannot drag, a tap in a cell and then a
 * tap in a neighbouring one draws the step between them (WCAG 2.5.7). */
function doDosky(ev) {
  const b = doska.getBoundingClientRect();
  if (!b.width) return null;
  const k = W / b.width;
  return { x: (ev.clientX - b.left) * k, y: (ev.clientY - b.top) * k };
}
function bunkaPod(p) {
  if (!p) return -1;
  const c = Math.floor(p.x / S), r = Math.floor(p.y / S);
  if (r < 0 || c < 0 || r >= n || c >= n) return -1;
  return r * n + c;
}
function stredBunkyPod(p) {
  const i = bunkaPod(p);
  if (i < 0) return -1;
  const dx = p.x - cx(i), dy = p.y - cy(i);
  return dx * dx + dy * dy <= (S * 0.32) * (S * 0.32) ? i : -1;
}
function hranaPod(p) {
  if (!p) return -1;
  let naj = -1, najd = S * 0.62;
  for (let e = 0; e < g.E; e++) {
    const dx = p.x - stredHranyX(e), dy = p.y - stredHranyY(e);
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < najd) { najd = d; naj = e; }
  }
  return naj;
}
function smerMedzi(i, j) {
  for (let d = 0; d < 4; d++) if (g.cellSused[(i << 2) + d] === j) return d;
  return -1;
}
function ukazKotvu(i) {
  kotva = i;
  const el = $('kotva');
  if (!el) return;
  doska.classList.toggle('kotvi', i >= 0);
  if (i >= 0) { el.setAttribute('x', stlpec(i) * S + 3); el.setAttribute('y', riadok(i) * S + 3); }
}
function zrusKotvu() { ukazKotvu(-1); }
let podKurzorom = -1;
function ukazPod(e) {
  if (podKurzorom === e) return;
  if (podKurzorom >= 0 && hranyEl[podKurzorom]) hranyEl[podKurzorom].classList.remove('pod');
  podKurzorom = e;
  if (e >= 0 && hranyEl[e]) hranyEl[e].classList.add('pod');
}
/* One step of a drag along the cells. Two things rub the loop out, and both
 * are the same gesture the other way round: turning back over the step just
 * drawn, and starting a drag on a step that already carries a line. The rest
 * of the drag then keeps whatever it started with, the way a smear keeps the
 * state it began in (ops/spec-hry-ux.md, part 1). */
function kresliDo(t, j) {
  const cesta = t.cesta;
  const i = cesta[cesta.length - 1];
  if (j === i) return;
  const d = smerMedzi(i, j);
  if (d < 0) return;
  const e = g.cellEdges[(i << 2) + d];
  if (e < 0) return;
  if (cesta.length >= 2 && j === cesta[cesta.length - 2] && v[e] === 1) {
    nastav(e, 0);
    cesta.pop();
    return;
  }
  if (!t.rezim) t.rezim = v[e] === 1 ? 'maz' : 'kresli';
  if (t.rezim === 'maz') { if (v[e] === 1) nastav(e, 0); }
  else if (v[e] !== 1) nastav(e, 1);
  cesta.push(j);
}
let tah = null; // { typ, e, i, cesta, hodnota, maloval, id }
doska.addEventListener('pointerdown', (ev) => {
  if (done || pauza) return;
  if (ev.pointerType === 'mouse' && ev.button !== 0) return;
  const p = doDosky(ev);
  const i = stredBunkyPod(p);
  if (i >= 0) {
    tah = { typ: 'cesta', i, cesta: [i], rezim: null, maloval: false, id: ev.pointerId };
    zameraj(i);
  } else {
    const e = hranaPod(p);
    if (e < 0) return;
    tah = { typ: 'hrana', e, hodnota: (v[e] + 1) % 3, maloval: false, id: ev.pointerId };
    kurzorNaHranu(e);
  }
  try { doska.setPointerCapture(ev.pointerId); } catch (err) { /* works without capture too, less smoothly */ }
  ev.preventDefault();
});
doska.addEventListener('pointermove', (ev) => {
  const p = doDosky(ev);
  if (!tah || tah.id !== ev.pointerId) { if (ev.pointerType === 'mouse' && !done && !pauza) ukazPod(stredBunkyPod(p) >= 0 ? -1 : hranaPod(p)); return; }
  if (done || pauza) return;
  if (tah.typ === 'cesta') {
    const j = bunkaPod(p);
    if (j < 0 || j === tah.cesta[tah.cesta.length - 1]) return;
    tah.maloval = true;
    kresliDo(tah, j);
    return;
  }
  const e = hranaPod(p);
  if (e < 0 || (e === tah.e && !tah.maloval)) return;
  if (!tah.maloval) { tah.maloval = true; nastav(tah.e, tah.hodnota); }
  if (tah.hodnota !== 0 && v[e] === 0) nastav(e, tah.hodnota);
  else if (tah.hodnota === 0 && v[e] !== 0) nastav(e, 0);
});
function koniecTahu(ev) {
  if (!tah || tah.id !== ev.pointerId) return;
  const t = tah;
  tah = null;
  try { doska.releasePointerCapture(ev.pointerId); } catch (err) { /* nothing */ }
  if (done || pauza) return;
  if (t.typ === 'cesta') {
    if (t.maloval) { zrusKotvu(); return; }
    // a plain tap in a cell: the tap by tap way of drawing
    if (kotva < 0 || kotva === t.i) { ukazKotvu(kotva === t.i ? -1 : t.i); return; }
    const d = smerMedzi(kotva, t.i);
    if (d < 0) { ukazKotvu(t.i); return; }
    const e = g.cellEdges[(kotva << 2) + d];
    if (e >= 0) nastav(e, v[e] === 1 ? 0 : 1);
    ukazKotvu(t.i);
    return;
  }
  if (!t.maloval) prepni(t.e);
}
doska.addEventListener('pointerup', koniecTahu);
doska.addEventListener('pointercancel', (ev) => { if (tah && tah.id === ev.pointerId) tah = null; });
doska.addEventListener('pointerleave', () => { if (!tah) ukazPod(-1); });

/* ── Keyboard ─────────────────────────────────────────────────────────── *
 * The cursor walks from cell to cell. Enter starts drawing and the arrows
 * then extend the loop; Enter again or Escape stops (ops/spec-hry-ux.md,
 * pattern C). Space, X and Delete work on the direction used last, so the
 * cross has a key of its own. */
function zameraj(i) {
  if (i < 0 || i >= g.C) return;
  if (poliaEl[fokusI]) poliaEl[fokusI].tabIndex = -1;
  fokusI = i;
  const el = poliaEl[i];
  if (!el) return;
  el.tabIndex = 0;
  el.setAttribute('aria-label', popisPolicka(i));
  el.focus({ preventScroll: true });
  const k = $('kurzor');
  if (k) { k.setAttribute('x', stlpec(i) * S + 3); k.setAttribute('y', riadok(i) * S + 3); }
}
/* The cursor follows the hand too, so the keyboard carries on where the mouse
 * left off; it does not steal the focus. */
function kurzorNaHranu(e) {
  const i = bunkaA(e);
  if (poliaEl[fokusI]) poliaEl[fokusI].tabIndex = -1;
  fokusI = i;
  if (poliaEl[i]) poliaEl[i].tabIndex = 0;
  const k = $('kurzor');
  if (k) { k.setAttribute('x', stlpec(i) * S + 3); k.setAttribute('y', riadok(i) * S + 3); }
}
/* Tab, a click or a screen reader can land on a cell without going through
 * zameraj, so the cursor follows the focus wherever it comes from. */
doska.addEventListener('focusin', (ev) => {
  const el = ev.target;
  if (!el || !el.classList || !el.classList.contains('pole')) return;
  const i = +el.dataset.i;
  if (!(i >= 0) || i === fokusI) return;
  if (poliaEl[fokusI]) poliaEl[fokusI].tabIndex = -1;
  fokusI = i;
  el.tabIndex = 0;
  el.setAttribute('aria-label', popisPolicka(i));
  const k = $('kurzor');
  if (k) { k.setAttribute('x', stlpec(i) * S + 3); k.setAttribute('y', riadok(i) * S + 3); }
});
function hranaVSmere(i, d) {
  const e = g.cellEdges[(i << 2) + d];
  return { e: e === undefined ? -1 : e, j: g.cellSused[(i << 2) + d] };
}
const KLAVES_SMER = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
doska.addEventListener('keydown', (ev) => {
  if (done || pauza) return;
  const d = KLAVES_SMER[ev.key];
  if (d !== undefined) {
    poslednySmer = d;
    const t = hranaVSmere(fokusI, d);
    if (kreslim) {
      if (t.e >= 0) { nastav(t.e, v[t.e] === 1 ? 0 : 1); zameraj(t.j); }
    } else if (ev.ctrlKey || ev.metaKey) {
      if (t.e >= 0) { prepni(t.e); zameraj(fokusI); }
    } else if (ev.shiftKey) {
      if (t.e >= 0) { nastav(t.e, v[t.e] === 2 ? 0 : 2); zameraj(fokusI); }
    } else if (t.j >= 0) zameraj(t.j);
    ev.preventDefault();
    return;
  }
  switch (ev.key) {
    case 'Enter':
      kreslim = !kreslim;
      zrusKotvu();
      stavEl.textContent = kreslim ? 'Drawing from row ' + (riadok(fokusI) + 1) + ', column ' + (stlpec(fokusI) + 1) + '. The arrows extend the loop, Enter or Escape stops.' : '';
      if (!kreslim) ukazStav();
      ev.preventDefault();
      break;
    case ' ': {
      const t = hranaVSmere(fokusI, poslednySmer);
      if (t.e >= 0) { prepni(t.e); zameraj(fokusI); }
      ev.preventDefault();
      break;
    }
    case 'x': case 'X': {
      const t = hranaVSmere(fokusI, poslednySmer);
      if (t.e >= 0) { nastav(t.e, v[t.e] === 2 ? 0 : 2); zameraj(fokusI); }
      ev.preventDefault();
      break;
    }
    case 'Delete': case 'Backspace': case '0': {
      const t = hranaVSmere(fokusI, poslednySmer);
      if (t.e >= 0) { nastav(t.e, 0); zameraj(fokusI); }
      ev.preventDefault();
      break;
    }
    case 'Escape':
      if (kreslim || kotva >= 0) { kreslim = false; zrusKotvu(); ukazStav(); ev.preventDefault(); }
      break;
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

/* ── The week strip ───────────────────────────────────────────────────── */
function ukazPasik() {
  if (!pasik) return;
  pasik.textContent = '';
  if (rezim === 'cvicenie') {
    const s = SADY.find((y) => y.id === sada);
    for (let k = 1; k <= s.pocet; k++) {
      const st = nacitaj('swans:p:' + sada + ':' + k);
      const a = document.createElement(k === kSada ? 'span' : 'a');
      a.className = 'den' + (k === kSada ? ' dnes' : '') + (st && st.done ? ' hotove' : st && st.v && st.v.some((y) => y) ? ' rozohrane' : '');
      if (k !== kSada) a.href = '/games/swans/practice/' + sada + '/' + k + '/';
      a.innerHTML = '<small>No.</small><b>' + k + '</b>';
      a.setAttribute('aria-label', 'Lake ' + k + (st && st.done ? ', solved' : ''));
      if (k === kSada) a.setAttribute('aria-current', 'page');
      pasik.appendChild(a);
    }
    return;
  }
  const dni = tyzden(datum);
  dni.forEach((d, k) => {
    const st = nacitaj('swans:' + d);
    const buduci = d > dnes, pred = d < PRVY_DEN;
    const tag = d === datum || buduci || pred ? 'span' : 'a';
    const a = document.createElement(tag);
    a.className = 'den' + (d === datum ? ' dnes' : '') + (buduci || pred ? ' buduci' : '') + (st && st.done ? ' hotove' : st && st.v && st.v.some((y) => y) ? ' rozohrane' : '');
    if (tag === 'a') a.href = '/games/swans/' + d + '/';
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
  if (!nastavenia.zivaKontrola && !odhalene) {
    for (const el of hranyEl) if (el) el.classList.remove('chyba');
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
    track('game_setting', { game: 'swans', setting: kluc, on: el.checked });
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
  for (const k of vsetkyKluce('swans:')) {
    const d = k.slice('swans:'.length);
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
  if (!s.pocet) { try { localStorage.removeItem('swans:streak'); } catch (e) { /* nič */ } return; }
  uloz('swans:streak', { posledny: dni[dnes] && dni[dnes].done ? dnes : posunDen(dnes, -1), pocet: s.pocet, mrazy: s.mrazy });
}
function odosliStav() {
  if (!ucet.prihlaseny()) return;
  ucet.hra.uloz('swans', { dni: stavVsetkychDni(), t: Date.now() }).catch(() => { /* sieťová chyba: lokálne ostáva pravdou */ });
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
  try { vzdialene = await ucet.hra.nacitaj('swans'); } catch (e) { return; /* sieťová chyba: lokálne ostáva pravdou */ }
  const diaDni = vzdialene && vzdialene.dni && typeof vzdialene.dni === 'object' ? vzdialene.dni : {};
  let zmenene = false;
  for (const [d, r] of Object.entries(diaDni)) {
    if (!isValidDate(d) || !r || typeof r !== 'object') continue;
    const kluc = 'swans:' + d;
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
    stavEl.textContent = 'This lake opens on ' + pekneDatum(datum) + ' (Bratislava time). Come back then, or play today’s lake.';
    doska.setAttribute('hidden', '');   // an SVG needs the attribute, see index.html
    for (const b of [spatBtn, znovaBtn, resetBtn, checkBtn, hintBtn]) if (b) b.disabled = true;
    ukazPasik();
    return;
  }
  try {
    zadanie = await nacitajZadanie();
  } catch (e) {
    stavEl.textContent = 'The lake could not be prepared. Please reload the page.';
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
    // then wait paused.
    const koniec = ulozene.t || ulozene.start;
    sekundy += Math.max(0, Math.floor((koniec - ulozene.start) / 1000));
  }
  postavMriezku();
  ukazVsetko();
  pouziNastavenia();
  if (datumEl) datumEl.textContent = rezim === 'cvicenie' ? UROVNE[zadanie.uroven].label + ' practice ' + sada.split('-')[1] + ', lake ' + kSada : pekneDatum(datum);
  if (urovenEl) urovenEl.textContent = UROVNE[zadanie.uroven].label + ' · ' + n + '×' + n;
  if (done) doska.classList.add('hotovo');
  else if (v.some((y) => y)) pozastav(true);
  ukazCas();
  ukazSeriu();
  ukazHistoriu();
  ukazPasik();
  ukazStav();
  ukazTlacidla();
}
spusti().then(synchronizujUcet);
