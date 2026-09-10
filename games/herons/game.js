/* Herons: the game page. One script for the daily marsh, the archive days and
 * the practice sets; the page says which one it is:
 *
 *   <body data-den="YYYY-MM-DD">          an archive day (built page)
 *   <body data-sada="easy-1" data-k="3">  a practice marsh
 *   nothing                               today's marsh (or ?d=YYYY-MM-DD)
 *
 * The puzzle itself comes, in this order: from <script type="application/json"
 * id="zadanie"> embedded in a built page; from dni/YYYY-MM.json for the day;
 * or, when both are missing, generated right here from the date. All three
 * give the same marsh for the same date (plan.mjs, generator.mjs).
 *
 * The board is one SVG, always drawn here from the puzzle, so a built page
 * only has to carry the nests for readers without JavaScript.
 *
 * The player's board is one flat array, one entry per cell of the marsh:
 *   0  no path runs through this cell yet,
 *   k  the cell belongs to the path of the pair k.
 * That is exactly what logika.mjs reads, and it is all a person can see, so
 * Check and Hint speak in cells too. The order of the cells along a path is
 * not stored: it is walked out of the board itself (retazCez) whenever a drag
 * needs it, which keeps a hint that drops a single cell somewhere and a path
 * drawn by hand the same kind of thing.
 *
 * Stored in localStorage (all in try/catch, private windows throw):
 *   herons:YYYY-MM-DD       { v, sec, start, done, hints, checks, t }
 *   herons:p:<set>:<k>      the same for a practice marsh
 *   herons:streak           { posledny: YYYY-MM-DD, pocet, mrazy }
 *   herons:nastavenia       the settings panel
 * sec = seconds spent before the current run, start = ms when the current run
 * began (null while paused or before the first move), done = ms of the solve,
 * hints and checks = help used, t = ms of the last save. The history line is
 * counted from the day records themselves, there is no separate one.
 * Outgoing events via window.umami, if it runs: game_solved, game_check,
 * game_hint, game_setting. Nothing else leaves the browser, unless the player
 * is signed in (arling.sk account, /style/ucet.js): then every herons:YYYY-MM-DD
 * save is also pushed to the account (throttled, 2s) and pulled back on load,
 * so the streak and history follow across devices. Signed out, nothing
 * changes; a signed-in sync that fails over the network fails silently, this
 * browser's copy stays the truth.
 */
import { zadaniePreDen, zadanieCvicenie, rozbal, tyzden, urovenDna, posunDen, pekneDatum, kratkyDatum, UROVNE, SADY, PRVY_DEN, DNI } from './plan.mjs';
import { todayBratislava, isValidDate, geometria } from './generator.mjs';
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
const hniezdaText = $('hniezda-text');

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
const NASTAVENIA_KLUC = 'herons:nastavenia';
// Live check is off by default: nothing turns red while you play (Andrej,
// 10. 9.); Check is the only judge before the marsh is finished.
const NASTAVENIA_PREDVOLENE = { casovac: true, pauzaPriOdchode: true, zvyraznenie: true, zivaKontrola: false, potvrditReset: true };
let nastavenia = Object.assign({}, NASTAVENIA_PREDVOLENE, nacitaj(NASTAVENIA_KLUC) || {});
function ulozNastavenia() { uloz(NASTAVENIA_KLUC, nastavenia); }

/* ── Which marsh ──────────────────────────────────────────────────────── */
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
const KLUC = rezim === 'cvicenie' ? 'herons:p:' + sada + ':' + kSada : 'herons:' + datum;
// The root address always opens today's marsh; once the date is settled,
// rewrite it to today's built page so the address bar and a shared link
// point at the day itself (Andrej, 10. 9.). Only the plain root qualifies:
// a built archive day already names its date, a practice page its set, and
// a page opened with ?d= keeps that query untouched.
if (rezim === 'den' && !body.dataset.den && jeDnes && !location.search) {
  try { history.replaceState(null, '', '/games/herons/' + datum + '/'); } catch (e) { /* the address stays generic; the game still works */ }
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

/* ── Loading the marsh ────────────────────────────────────────────────── */
function vlozene() {
  const el = $('zadanie');
  if (!el) return null;
  try { return rozbal(JSON.parse(el.textContent)); } catch (e) { return null; }
}
async function zTabulky(iso) {
  try {
    const r = await fetch('/games/herons/dni/' + iso.slice(0, 7) + '.json', { cache: 'no-cache' });
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
let zadanie, n, g, K, ends, v, start, done, sekundy, hints, checks, ulozene;
let undoStack = [];
let redoStack = [];
let fokusI = 0;             // the keyboard cursor: which cell it sits on
let kresba = null;          // { pair, cesta:[cells] } while a path is being drawn
let tikac = null;
let necinnost = null;
let pauza = false;
let tip = null;             // the hint on screen, cleared by the next move
let odhalene = false;       // Check's second step is showing the wrong cells
let checkStav = null;       // what the last Check saw, so the second press can reveal it
const polickaEl = [];
const poliaEl = [];
const ruzeEl = [];

/* ── Drawing ──────────────────────────────────────────────────────────── *
 * One cell is S units of the viewBox and the board is exactly n cells across,
 * so it scales to whatever width it gets. At 390 px an eight by eight marsh
 * gives 48 px per cell, over the 40 px the specification asks for and well
 * over the 24 px target the standard asks for (ops/spec-hry-ux.md, part 9). */
const S = 40, R = 14;
let W = 240;
function stlpec(i) { return i % n; }
function riadok(i) { return (i / n) | 0; }
function cx(i) { return S / 2 + stlpec(i) * S; }
function cy(i) { return S / 2 + riadok(i) * S; }
function sused(i, d) { return g.cellSused[(i << 2) + d]; }
function suSusedia(i, j) {
  for (let d = 0; d < 4; d++) if (sused(i, d) === j) return true;
  return false;
}
function postavMriezku() {
  W = n * S;
  document.documentElement.style.setProperty('--n', n);
  doska.setAttribute('viewBox', '0 0 ' + W + ' ' + W);
  doska.setAttribute('aria-label', 'Marsh grid ' + n + ' by ' + n);
  const k = [];
  k.push('<g class="plocha" role="presentation">');
  k.push('<g class="mriezka" aria-hidden="true">');
  for (let i = 1; i < n; i++) {
    k.push('<line x1="' + (i * S) + '" y1="0" x2="' + (i * S) + '" y2="' + W + '"/>');
    k.push('<line x1="0" y1="' + (i * S) + '" x2="' + W + '" y2="' + (i * S) + '"/>');
  }
  k.push('</g>');
  // one group per cell: the piece of path that runs through it, the nest that
  // may sit on it, and a ring for a hint or a mistake. The row groups carry
  // the grid roles, so a screen reader walks the marsh row by row.
  for (let r = 0; r < n; r++) {
    k.push('<g role="row" aria-rowindex="' + (r + 1) + '">');
    for (let c = 0; c < n; c++) {
      const i = r * n + c, p = ends[i];
      k.push('<g class="policko" data-i="' + i + '" data-p="0">'
        + '<rect class="pole" role="gridcell" aria-colindex="' + (c + 1) + '" data-i="' + i + '" tabindex="' + (i === 0 ? 0 : -1) + '" x="' + (c * S) + '" y="' + (r * S) + '" width="' + S + '" height="' + S + '"></rect>'
        + '<path class="ruz" data-i="' + i + '" d=""/>'
        + (p ? '<circle class="hniezdo p' + p + '" cx="' + cx(i) + '" cy="' + cy(i) + '" r="' + R + '"/><text class="cislo" x="' + cx(i) + '" y="' + (cy(i) + 0.5) + '">' + p + '</text>' : '')
        + '<rect class="znak" x="' + (c * S + 4) + '" y="' + (r * S + 4) + '" width="' + (S - 8) + '" height="' + (S - 8) + '" rx="8"/>'
        + '<circle class="podklad" cx="' + (c * S + 10) + '" cy="' + (r * S + 10) + '" r="7.5"/>'
        + '<path class="krizik" d="M' + (c * S + 6.5) + ' ' + (r * S + 6.5) + 'L' + (c * S + 13.5) + ' ' + (r * S + 13.5)
        + 'M' + (c * S + 13.5) + ' ' + (r * S + 6.5) + 'L' + (c * S + 6.5) + ' ' + (r * S + 13.5) + '"/>'
        + '</g>');
    }
    k.push('</g>');
  }
  k.push('<rect class="kotva" id="kotva" x="3" y="3" width="' + (S - 6) + '" height="' + (S - 6) + '" rx="7"/>');
  k.push('<rect class="kurzor" id="kurzor" x="3" y="3" width="' + (S - 6) + '" height="' + (S - 6) + '" rx="7"/>');
  k.push('</g>');
  doska.innerHTML = k.join('');
  polickaEl.length = 0; poliaEl.length = 0; ruzeEl.length = 0;
  doska.querySelectorAll('.policko').forEach((el) => { polickaEl[+el.dataset.i] = el; });
  doska.querySelectorAll('.pole').forEach((el) => { poliaEl[+el.dataset.i] = el; });
  doska.querySelectorAll('.ruz').forEach((el) => { ruzeEl[+el.dataset.i] = el; });
  popisHniezd();
}
/* The nests as plain text for a screen reader: the drawing itself only tells
 * the shape of the marsh, not what it asks for. */
function popisHniezd() {
  if (!hniezdaText) return;
  const kde = [];
  for (let p = 1; p <= K; p++) {
    const m = [];
    for (let i = 0; i < g.C; i++) if (ends[i] === p) m.push('row ' + (riadok(i) + 1) + ' column ' + (stlpec(i) + 1));
    if (m.length) kde.push('pair ' + p + ' at ' + m.join(' and '));
  }
  hniezdaText.textContent = 'The marsh, ' + n + ' by ' + n + ' cells, with ' + K + ' pairs of nests: ' + kde.join('; ') + '.';
}
function popisPolicka(i) {
  const casti = ['row ' + (riadok(i) + 1) + ', column ' + (stlpec(i) + 1)];
  if (ends[i]) casti.push('nest ' + ends[i]);
  casti.push(v[i] ? 'path ' + v[i] : ends[i] ? 'no path drawn out of it yet' : 'empty');
  return casti.join(', ');
}
/* Which path a cell shows. A nest always belongs to its own pair, whether the
 * player has drawn anything out of it or not, so the drawing joins up to it
 * without a gap and a marsh finished by hints alone looks finished. `v` itself
 * stays the player's own work: what is only a nest is not something Check ever
 * counts, and a board with nothing but nests still counts as untouched. */
function par(i) { return v[i] || ends[i]; }

/* The chain of cells one path is drawn as, walked out of the board itself.
 * vetva goes from `i` through `prvy` and on for as long as there is exactly
 * one way to carry on, so a fork stops it rather than sending it the wrong
 * way. */
function vetva(i, prvy) {
  const k = v[i];
  const out = [];
  const videne = new Set([i]);
  let pred = i, cur = prvy;
  while (cur >= 0 && !videne.has(cur)) {
    out.push(cur); videne.add(cur);
    let dalsi = -1, pocet = 0;
    for (let d = 0; d < 4; d++) {
      const j = sused(cur, d);
      if (j >= 0 && j !== pred && v[j] === k) { if (dalsi < 0) dalsi = j; pocet++; }
    }
    if (pocet !== 1) break;
    pred = cur; cur = dalsi;
  }
  return out;
}
/* The whole chain that runs through the cell i, a nest end first when it has
 * one, so the first cell is where the path starts. */
function retazCez(i) {
  const k = v[i];
  if (!k) return [i];
  const susedia = [];
  for (let d = 0; d < 4; d++) { const j = sused(i, d); if (j >= 0 && v[j] === k) susedia.push(j); }
  if (!susedia.length) return [i];
  const a = vetva(i, susedia[0]);
  const b = susedia.length > 1 ? vetva(i, susedia[1]) : [];
  const retaz = b.slice().reverse().concat([i], a);
  if (ends[retaz[0]] !== k && ends[retaz[retaz.length - 1]] === k) retaz.reverse();
  return retaz;
}
/* Which pairs have both their nests joined by one run of cells. A soft cue
 * only: it says nothing about whether the rest of the marsh is right (Andrej,
 * 10. 9.: nothing turns red while playing; only Check judges). */
function hotoveDvojice() {
  const out = new Uint8Array(K + 1);
  for (let p = 1; p <= K; p++) {
    const h = [];
    for (let i = 0; i < g.C; i++) if (ends[i] === p) h.push(i);
    if (h.length !== 2) continue;
    const videne = new Uint8Array(g.C);
    const q = [h[0]];
    videne[h[0]] = 1;
    for (let t = 0; t < q.length; t++) {
      const b = q[t] << 2;
      for (let d = 0; d < 4; d++) {
        const y = g.cellSused[b + d];
        if (y < 0 || videne[y] || par(y) !== p) continue;
        videne[y] = 1; q.push(y);
      }
    }
    if (videne[h[1]]) out[p] = 1;
  }
  return out;
}
function cestaD(i) {
  const p = par(i);
  if (!p) return '';
  const x = cx(i), y = cy(i);
  // a lone cell is the dot the round cap draws; every neighbour on the same
  // path adds an arm to the middle of the side between them
  let d = 'M' + x + ' ' + y + 'L' + x + ' ' + y;
  for (let s = 0; s < 4; s++) {
    const j = sused(i, s);
    if (j < 0 || par(j) !== p) continue;
    const ax = s === 1 ? x + S / 2 : s === 3 ? x - S / 2 : x;
    const ay = s === 0 ? y - S / 2 : s === 2 ? y + S / 2 : y;
    d += 'M' + x + ' ' + y + 'L' + ax + ' ' + ay;
  }
  return d;
}
function ukazVsetko() {
  const hotove = hotoveDvojice();
  for (let i = 0; i < g.C; i++) {
    const el = polickaEl[i];
    if (!el) continue;
    const p = par(i);
    if (el.getAttribute('data-p') !== String(p)) el.setAttribute('data-p', p);
    const d = cestaD(i);
    if (ruzeEl[i] && ruzeEl[i].getAttribute('d') !== d) ruzeEl[i].setAttribute('d', d);
    el.classList.toggle('hotova', !!(p && hotove[p]));
    el.classList.toggle('aktivny', !!(kresba && p === kresba.pair));
  }
  doska.classList.toggle('zvyraznit', !!(nastavenia.zvyraznenie && kresba && !done));
  if (poliaEl[fokusI]) poliaEl[fokusI].setAttribute('aria-label', popisPolicka(fokusI));
}
function zmazTip() {
  if (!tip) return;
  tip = null;
  for (const el of polickaEl) if (el) el.classList.remove('tip');
  if (hintBtn) hintBtn.textContent = 'Hint';
}
function zmazOdhalenie() {
  if (!odhalene && !checkStav) return;
  odhalene = false; checkStav = null;
  for (const el of polickaEl) if (el) el.classList.remove('chyba');
  if (checkBtn) checkBtn.textContent = 'Check';
}
/* Live check is off by default; when it is on, a cell that belongs to another
 * path is shown as soon as it is drawn, with a ring and a broken line, not by
 * colour alone. */
function zivaKontrola() {
  if (!nastavenia.zivaKontrola || done || !zadanie) return;
  const p = porovnaj(v, zadanie.solution);
  for (const i of p.zle) if (polickaEl[i]) polickaEl[i].classList.add('chyba');
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
  zrusKresbu();
  zastavTikac();
  nastavNecinnost();
  ulozStav();
  ukazCas();
  if (pauzaCas) pauzaCas.textContent = sekundy ? 'You have spent ' + slovaCas(sekundy) + ' so far.' : 'Your paths are kept; the clock continues when you resume.';
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
  const s = nacitaj('herons:streak');
  if (!s || !s.pocet) { seriaEl.textContent = ''; return; }
  const ziva = s.posledny === dnes || s.posledny === posunDen(dnes, -1);
  if (!ziva) { seriaEl.textContent = ''; return; }
  const mrazy = s.mrazy || 0;
  seriaEl.textContent = 'Streak: ' + s.pocet + (s.pocet === 1 ? ' day' : ' days')
    + (mrazy ? ', ' + mrazy + (mrazy === 1 ? ' missed day forgiven' : ' missed days forgiven') : '');
}
function zapisSeriu() {
  // Only a marsh finished on its own day counts: the archive is for practice.
  // The streak is always counted from the finished days themselves, never
  // added up as a stored number, so a merge from the account cannot leave it
  // wrong (prepocitajSeriu below).
  if (!jeDnes) return;
  prepocitajSeriu();
}
/* Every finished day in this browser, newest first. */
function historiaDni() {
  const out = [];
  for (const k of vsetkyKluce('herons:')) {
    const d = k.slice('herons:'.length);
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
  historiaEl.innerHTML = '<b>Your marshes:</b> ' + h.length + ' finished' + (urovne ? ' (' + urovne + ')' : '') + (ciste ? ', ' + ciste + ' clean, with no hint and no check' : ', none clean yet')
    + (best ? ', best ' + formatCas(best.sec) + ' on ' + kratkyDatum(best.d) : '') + (priemer ? ', average ' + formatCas(priemer) : '') + '. <a href="/games/herons/archive/">Archive and full history</a>.';
}

/* ── Saving and solving ───────────────────────────────────────────────── */
function ulozStav() { uloz(KLUC, { v, sec: sekundy, start, done, hints, checks, t: Date.now() }); naplanujOdoslanie(); }

function ukazStav() {
  stavEl.classList.toggle('ok', !!done);
  if (done) {
    const s = sekundy ? ' in ' + formatCas(sekundy) : '';
    const pomoc = [];
    if (hints) pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
    if (checks) pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
    const hn = pomoc.length ? ' with ' + pomoc.join(' and ') : ' without a hint or a check';
    stavEl.innerHTML = '<b>Solved</b>' + s + hn + '. ' + (pomoc.length ? 'Every heron is home.' : 'A clean marsh: every heron is home.')
      + (jeDnes ? ' A new marsh arrives at midnight, Bratislava time.' : '');
    return;
  }
  if (!v.some((y) => y)) { stavEl.textContent = 'Press on a nest and drag to draw its path, or tap the nest and then one cell after another.'; return; }
  const hotove = hotoveDvojice();
  let spojenych = 0;
  for (let p = 1; p <= K; p++) if (hotove[p]) spojenych++;
  let prazdnych = 0;
  for (let i = 0; i < g.C; i++) if (!par(i)) prazdnych++;
  if (spojenych === K && prazdnych) {
    stavEl.textContent = 'Every pair is joined, but ' + prazdnych + (prazdnych === 1 ? ' cell of the marsh is' : ' cells of the marsh are') + ' still unused. Every cell has to belong to a path.';
    return;
  }
  if (spojenych === K && !prazdnych) { stavEl.textContent = 'Every pair is joined and every cell is used, but a path still runs beside itself somewhere. Check shows where.'; return; }
  stavEl.textContent = spojenych ? spojenych + ' of ' + K + (spojenych === 1 ? ' pair joined.' : ' pairs joined.') : '';
}

/* Where a cell sits, in words. Herons is pattern C, so the first press of
 * Check names a third of the path in the order it runs from the nest, not a
 * quadrant of the board (ops/spec-hry-ux.md, part 4). */
const TRETINY = ['first third', 'middle third', 'last third'];
function tretinaBunky(i) {
  const p = v[i];
  if (!p) return '';
  const retaz = retazCez(i);
  const m = retaz.indexOf(i);
  if (m < 0 || retaz.length < 3) return '';
  return TRETINY[Math.min(2, Math.floor((m * 3) / retaz.length))];
}
function zoznamSlov(a) {
  if (a.length === 1) return a[0];
  if (a.length === 2) return a[0] + ' and ' + a[1];
  return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
}
/* Check, in two steps. The first press says how many cells are wrong and
 * roughly where; only the second press shows which. The puzzle stays a puzzle
 * unless you ask twice. */
function skontrolujStav() {
  if (done || pauza) return;
  const p = porovnaj(v, zadanie.solution);
  if (!p.vyplnene) { stavEl.textContent = 'Nothing on the board yet.'; return; }
  checks++;
  ulozStav();
  if (!p.zle.length) {
    zmazOdhalenie();
    stavEl.textContent = 'Everything on the board is right so far: ' + p.vyplnene + (p.vyplnene === 1 ? ' cell' : ' cells') + ' in place.';
    track('game_check', { game: 'herons', wrong: 0 });
    return;
  }
  const kolko = p.zle.length + (p.zle.length === 1 ? ' cell belongs to another path' : ' cells belong to another path');
  if (checkStav && !odhalene) {
    odhalene = true;
    for (const i of p.zle) if (polickaEl[i]) polickaEl[i].classList.add('chyba');
    stavEl.textContent = 'The ringed cells belong to another path: ' + kolko + '. Clear them and keep going.';
    checkBtn.textContent = 'Check';
    track('game_check', { game: 'herons', wrong: p.zle.length, revealed: true });
    return;
  }
  const kde = [];
  for (const i of p.zle) {
    const t = tretinaBunky(i);
    const s = t ? 'the ' + t + ' of path ' + v[i] : 'path ' + v[i];
    if (!kde.includes(s)) kde.push(s);
  }
  checkStav = { pocet: p.zle.length };
  stavEl.textContent = 'There ' + (p.zle.length === 1 ? 'is 1 mistake' : 'are ' + p.zle.length + ' mistakes') + ' on the board: ' + kolko
    + (kde.length ? ', in ' + zoznamSlov(kde) : '') + '. Press Check again to show where.';
  checkBtn.textContent = 'Show';
  track('game_check', { game: 'herons', wrong: p.zle.length, revealed: false });
}

/* The first press of Hint names the technique and the place but not what goes
 * there: every rule sentence turns at ", so ", and that tail waits for the
 * second press (ops/spec-hry-ux.md, part 5). */
function bezHodnoty(text) {
  const k = text.lastIndexOf(', so ');
  return k > 0 ? text.slice(0, k) + '.' : text;
}
/* Hint, in two steps too: the first press names the rule and rings the cells
 * it is about; the second press draws that one step. Every hint is counted and
 * shown at the end. */
function ukazNapovedu() {
  if (done || pauza) return;
  if (tip) {
    // second press: draw it
    const t = tip;
    hints++;   // counted before the move, so the save inside it carries the new number
    const zmenilo = zmenaStavu(() => {
      for (const b of t.bunky) {
        if (!b.pair) { odrezOd(b.i); continue; }
        if (v[b.i] && v[b.i] !== b.pair) odrezOd(b.i);
        v[b.i] = b.pair;
      }
    });
    zmazTip(); zmazOdhalenie();
    track('game_hint', { game: 'herons', kind: t.druh, rule: t.pravidlo, layer: t.vrstva, applied: true });
    if (!zmenilo) { ulozStav(); ukazStav(); }
    if (!done) stavEl.textContent = t.text;   // now the whole sentence
    return;
  }
  const h = napoveda(v, ends, zadanie.solution, n);
  if (!h) return;
  tip = h;
  for (const b of h.bunky) if (polickaEl[b.i]) polickaEl[b.i].classList.add('tip');
  stavEl.textContent = bezHodnoty(h.text) + ' Press Hint again to draw it.';
  hintBtn.textContent = 'Draw it';
  track('game_hint', { game: 'herons', kind: h.druh, rule: h.pravidlo, layer: h.vrstva, applied: false });
}

function skontroluj() {
  if (!jeVyriesene(v, ends, n)) return false;
  sekundy = ubehnute();
  done = Date.now();
  start = null;
  zrusKresbu();
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
  track('game_solved', { game: 'herons', day: rezim === 'den' ? datum : sada + '/' + kSada, seconds: sekundy, hints, checks, level: zadanie.uroven });
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
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) { ulozStav(); zivaKontrola(); }
  ukazStav();
  ukazCas();
  ukazTlacidla();
  nastavNecinnost();
}
/* Take one cell away from the path it belongs to. Whatever hangs off that cell
 * with no nest of its own left to hang from goes with it: a path that reaches
 * no nest is not a path any more. A run that still ends in a nest stays, so
 * cutting a finished path in half leaves both halves on the board. */
function odrezOd(j) {
  const k = v[j];
  if (!k) return;
  v[j] = 0;
  for (let d = 0; d < 4; d++) {
    const x = sused(j, d);
    if (x < 0 || v[x] !== k) continue;
    const kom = [x];
    const videne = new Set([x]);
    let maHniezdo = ends[x] === k;
    for (let t = 0; t < kom.length; t++) {
      for (let d2 = 0; d2 < 4; d2++) {
        const y = sused(kom[t], d2);
        if (y < 0 || videne.has(y) || v[y] !== k) continue;
        videne.add(y); kom.push(y);
        if (ends[y] === k) maHniezdo = true;
      }
    }
    if (!maHniezdo) for (const c of kom) v[c] = 0;
  }
}
function zrusKresbu() {
  if (!kresba) return;
  kresba = null;
  ukazKotvu(-1);
  doska.classList.remove('zvyraznit');
  for (const el of polickaEl) if (el) el.classList.remove('aktivny');
}
function ukazKotvu(i) {
  const el = $('kotva');
  doska.classList.toggle('kotvi', i >= 0);
  if (el && i >= 0) { el.setAttribute('x', stlpec(i) * S + 3); el.setAttribute('y', riadok(i) * S + 3); }
}
function kresbaKoniec() { return kresba ? kresba.cesta[kresba.cesta.length - 1] : -1; }
/* Start drawing at the cell i. On a nest the whole run that already leaves it
 * is picked up, so the next step carries on where the path ended; in the
 * middle of a path only the part up to that cell is kept and the rest waits in
 * `chvost`, which the first step then rubs out (dragging over your own path
 * shortens it, ops/spec-herons.md). */
function zacniKresbu(i) {
  const k = v[i] || ends[i];
  if (!k) return false;
  if (!v[i]) zmenaStavu(() => { v[i] = k; });
  const retaz = retazCez(i);
  const m = retaz.indexOf(i);
  if (ends[i] === k) kresba = { pair: k, cesta: retaz.slice(), chvost: [] };
  else kresba = { pair: k, cesta: retaz.slice(0, m + 1), chvost: retaz.slice(m + 1) };
  ukazKotvu(kresbaKoniec());
  ukazVsetko();
  return true;
}
/* One step of a path from the cell the drawing sits on to a neighbouring cell
 * j. Stepping back over the cell just drawn rubs it out; stepping onto a cell
 * of the same path shortens the path to it; stepping onto a cell another path
 * uses takes it away from that one. Nests of other pairs are never taken, and
 * a path that has reached its own second nest does not go on. */
function krokDo(j) {
  if (!kresba || done || pauza) return false;
  const c = kresba.cesta, k = kresba.pair;
  const i = c[c.length - 1];
  if (j < 0 || j === i || !suSusedia(i, j)) return false;
  if (kresba.chvost && kresba.chvost.length) {
    const chvost = kresba.chvost;
    kresba.chvost = [];
    zmenaStavu(() => { for (const x of chvost) v[x] = 0; });
  }
  if (c.length >= 2 && j === c[c.length - 2]) {
    zmenaStavu(() => { v[i] = 0; });
    c.pop();
    ukazKotvu(kresbaKoniec());
    return true;
  }
  const m = c.indexOf(j);
  if (m >= 0) {
    zmenaStavu(() => { for (let x = m + 1; x < c.length; x++) v[c[x]] = 0; });
    c.length = m + 1;
    ukazKotvu(kresbaKoniec());
    return true;
  }
  if (ends[j] && ends[j] !== k) return false;
  if (ends[i] === k && c.length > 1) return false;
  zmenaStavu(() => { if (v[j] && v[j] !== k) odrezOd(j); v[j] = k; });
  c.push(j);
  ukazKotvu(kresbaKoniec());
  ukazVsetko();
  return true;
}

function spat() {
  if (done || pauza || !undoStack.length) return;
  redoStack.push(snimka());
  v = undoStack.pop();
  zrusKresbu();
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
  zrusKresbu();
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) { ulozStav(); zivaKontrola(); }
  ukazStav();
  ukazTlacidla();
}
/* Clear: an empty marsh, the clock keeps running (Andrej, 10. 9.: clearing is
 * a move, not a restart). One Undo brings every path back. */
function reset() {
  if (done || pauza) return;
  if (!v.some((y) => y)) return;
  if (nastavenia.potvrditReset && !window.confirm('Clear the whole marsh? The clock keeps running and one Undo brings your paths back.')) return;
  zrusKresbu();
  zmenaStavu(() => { v = new Array(g.C).fill(0); });
}

/* ── Share ────────────────────────────────────────────────────────────── *
 * A voluntary step after the marsh is finished. One line: which marsh, the
 * time and how much help was taken. Never the board and never the paths: in
 * this game the paths are the whole answer (ops/spec-hry-ux.md, part 8). */
function textZdielania() {
  const uroven = zadanie && zadanie.uroven && UROVNE[zadanie.uroven] ? UROVNE[zadanie.uroven].label : '';
  const kto = rezim === 'cvicenie'
    ? 'Herons practice, ' + (uroven || sada) + ' no. ' + kSada
    : 'Herons ' + datum + (uroven ? ', ' + uroven : '');
  const pomoc = hints || checks
    ? hints + (hints === 1 ? ' hint' : ' hints') + ', ' + checks + (checks === 1 ? ' check' : ' checks')
    : 'no hint, no check';
  const odkaz = rezim === 'cvicenie'
    ? 'https://arling.sk/games/herons/practice/' + sada + '/' + (kSada === 1 ? '' : kSada + '/')
    : 'https://arling.sk/games/herons/' + (jeDnes ? '' : datum + '/');
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

/* ── Pointer ──────────────────────────────────────────────────────────── *
 * Press on a nest and drag, and the path follows the finger from cell to cell.
 * For anyone who cannot drag, a tap on a nest starts the path and a tap on
 * each neighbouring cell carries it on, a tap on the same cell twice stops
 * (WCAG 2.5.7). A tap on a cell of a path clears it from that cell on. */
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
let tah = null; // { i, id, maloval, zacate, mrtvy }
doska.addEventListener('pointerdown', (ev) => {
  if (done || pauza) return;
  if (ev.pointerType === 'mouse' && ev.button !== 0) return;
  const i = bunkaPod(doDosky(ev));
  if (i < 0) return;
  tah = { i, id: ev.pointerId, maloval: false, zacate: false, mrtvy: false };
  zameraj(i);
  try { doska.setPointerCapture(ev.pointerId); } catch (err) { /* works without capture too, less smoothly */ }
  ev.preventDefault();
});
doska.addEventListener('pointermove', (ev) => {
  if (!tah || tah.id !== ev.pointerId || done || pauza || tah.mrtvy) return;
  const j = bunkaPod(doDosky(ev));
  if (j < 0 || j === tah.i) return;
  if (!tah.zacate) {
    // the first real movement decides what the drag is: it carries on from the
    // path the drawing already sits on, or it starts a new one under the finger
    tah.zacate = true;
    if (!(kresba && kresbaKoniec() === tah.i) && !zacniKresbu(tah.i)) { tah.mrtvy = true; return; }
  }
  tah.maloval = true;
  krokDo(j);
  tah.i = kresbaKoniec();
});
function koniecTahu(ev) {
  if (!tah || tah.id !== ev.pointerId) return;
  const t = tah;
  tah = null;
  try { doska.releasePointerCapture(ev.pointerId); } catch (err) { /* nothing */ }
  if (done || pauza) return;
  if (t.maloval) { zrusKresbu(); ukazVsetko(); return; }
  tuk(t.i);
}
doska.addEventListener('pointerup', koniecTahu);
doska.addEventListener('pointercancel', (ev) => { if (tah && tah.id === ev.pointerId) tah = null; });
function tuk(i) {
  if (kresba) {
    const koniec = kresbaKoniec();
    if (i === koniec) { zrusKresbu(); ukazVsetko(); ukazStav(); return; }
    if (suSusedia(koniec, i)) { krokDo(i); return; }
  }
  if (ends[i]) { zrusKresbu(); zacniKresbu(i); return; }
  if (v[i]) {
    // a tap on a cell of a path clears it from there on, and the drawing waits
    // on the cell before it so the next tap can carry on
    const retaz = retazCez(i);
    const m = retaz.indexOf(i);
    zrusKresbu();
    zmenaStavu(() => { odrezOd(i); });
    if (m > 0 && v[retaz[m - 1]]) zacniKresbu(retaz[m - 1]);
    return;
  }
  zrusKresbu();
  ukazVsetko();
  stavEl.textContent = 'Paths start at a nest. Press on one of the numbered nests and drag, or tap it and then tap on.';
}

/* ── Keyboard ─────────────────────────────────────────────────────────── *
 * The cursor walks from cell to cell. Enter starts drawing on the cell it sits
 * on and the arrows then carry the path along; Enter again or Escape stops
 * (ops/spec-hry-ux.md, pattern C). Delete clears the path from the cursor on. */
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
const KLAVES_SMER = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
doska.addEventListener('keydown', (ev) => {
  if (done || pauza) return;
  const d = KLAVES_SMER[ev.key];
  if (d !== undefined) {
    const j = sused(fokusI, d);
    if (j >= 0) {
      if (kresba && kresbaKoniec() === fokusI) { if (krokDo(j)) zameraj(kresbaKoniec()); else zameraj(j); }
      else zameraj(j);
    }
    ev.preventDefault();
    return;
  }
  switch (ev.key) {
    case 'Enter': case ' ':
      if (kresba && kresbaKoniec() === fokusI) { zrusKresbu(); ukazVsetko(); ukazStav(); }
      else if (zacniKresbu(fokusI)) {
        zameraj(kresbaKoniec());
        stavEl.textContent = 'Drawing path ' + kresba.pair + '. The arrows carry it on, Enter or Escape stops.';
      } else stavEl.textContent = 'Paths start at a nest. Move the cursor onto a numbered nest and press Enter.';
      ev.preventDefault();
      break;
    case 'Delete': case 'Backspace': case '0':
      if (v[fokusI]) { zrusKresbu(); zmenaStavu(() => { odrezOd(fokusI); }); }
      ev.preventDefault();
      break;
    case 'Escape':
      if (kresba) { zrusKresbu(); ukazVsetko(); ukazStav(); ev.preventDefault(); }
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
      const st = nacitaj('herons:p:' + sada + ':' + k);
      const a = document.createElement(k === kSada ? 'span' : 'a');
      a.className = 'den' + (k === kSada ? ' dnes' : '') + (st && st.done ? ' hotove' : st && st.v && st.v.some((y) => y) ? ' rozohrane' : '');
      if (k !== kSada) a.href = '/games/herons/practice/' + sada + '/' + k + '/';
      a.innerHTML = '<small>No.</small><b>' + k + '</b>';
      a.setAttribute('aria-label', 'Marsh ' + k + (st && st.done ? ', solved' : ''));
      if (k === kSada) a.setAttribute('aria-current', 'page');
      pasik.appendChild(a);
    }
    return;
  }
  const dni = tyzden(datum);
  dni.forEach((d, k) => {
    const st = nacitaj('herons:' + d);
    const buduci = d > dnes, pred = d < PRVY_DEN;
    const tag = d === datum || buduci || pred ? 'span' : 'a';
    const a = document.createElement(tag);
    a.className = 'den' + (d === datum ? ' dnes' : '') + (buduci || pred ? ' buduci' : '') + (st && st.done ? ' hotove' : st && st.v && st.v.some((y) => y) ? ' rozohrane' : '');
    if (tag === 'a') a.href = '/games/herons/' + d + '/';
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
    for (const el of polickaEl) if (el) el.classList.remove('chyba');
  }
  if (!nastavenia.zvyraznenie) doska.classList.remove('zvyraznit');
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
    track('game_setting', { game: 'herons', setting: kluc, on: el.checked });
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
  for (const k of vsetkyKluce('herons:')) {
    const d = k.slice('herons:'.length);
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
  if (!s.pocet) { try { localStorage.removeItem('herons:streak'); } catch (e) { /* nič */ } return; }
  uloz('herons:streak', { posledny: dni[dnes] && dni[dnes].done ? dnes : posunDen(dnes, -1), pocet: s.pocet, mrazy: s.mrazy });
}
function odosliStav() {
  if (!ucet.prihlaseny()) return;
  ucet.hra.uloz('herons', { dni: stavVsetkychDni(), t: Date.now() }).catch(() => { /* sieťová chyba: lokálne ostáva pravdou */ });
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
  try { vzdialene = await ucet.hra.nacitaj('herons'); } catch (e) { return; /* sieťová chyba: lokálne ostáva pravdou */ }
  const diaDni = vzdialene && vzdialene.dni && typeof vzdialene.dni === 'object' ? vzdialene.dni : {};
  let zmenene = false;
  for (const [d, r] of Object.entries(diaDni)) {
    if (!isValidDate(d) || !r || typeof r !== 'object') continue;
    const kluc = 'herons:' + d;
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
      if (cerstve && Array.isArray(cerstve.v) && g && cerstve.v.length === g.C && (cerstve.t || 0) > ((ulozene && ulozene.t) || 0)) {
        ulozene = cerstve;
        v = cerstve.v.slice();
        done = cerstve.done || null;
        hints = cerstve.hints || 0;
        checks = cerstve.checks || 0;
        sekundy = cerstve.sec || 0;
        undoStack = []; redoStack = [];
        zrusKresbu();
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
    stavEl.textContent = 'This marsh opens on ' + pekneDatum(datum) + ' (Bratislava time). Come back then, or play today’s marsh.';
    doska.setAttribute('hidden', '');   // an SVG needs the attribute, see index.html
    for (const b of [spatBtn, znovaBtn, resetBtn, checkBtn, hintBtn]) if (b) b.disabled = true;
    ukazPasik();
    return;
  }
  try {
    zadanie = await nacitajZadanie();
  } catch (e) {
    stavEl.textContent = 'The marsh could not be prepared. Please reload the page.';
    throw e;
  }
  n = zadanie.n;
  g = geometria(n);
  ends = zadanie.ends;
  K = 0;
  for (const x of ends) if (x > K) K = x;
  ulozene = nacitaj(KLUC);
  v = (ulozene && Array.isArray(ulozene.v) && ulozene.v.length === g.C) ? ulozene.v.slice() : new Array(g.C).fill(0);
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
  if (datumEl) datumEl.textContent = rezim === 'cvicenie' ? UROVNE[zadanie.uroven].label + ' practice ' + sada.split('-')[1] + ', marsh ' + kSada : pekneDatum(datum);
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
