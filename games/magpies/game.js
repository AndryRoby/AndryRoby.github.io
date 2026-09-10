/* Magpies: the game page. One script for the daily picture, the archive
 * days and the practice sets; the page says which one it is:
 *
 *   <body data-den="YYYY-MM-DD">          an archive day (built page)
 *   <body data-sada="easy-1" data-k="3">  a practice picture
 *   nothing                               today's picture (or ?d=YYYY-MM-DD)
 *
 * The picture itself comes, in this order: from <script type="application/json"
 * id="zadanie"> embedded in a built page; from dni/YYYY-MM.json for the day;
 * or, when both are missing, generated right here from the date. All three
 * give the same picture for the same date (plan.mjs, generator.mjs).
 *
 * Stored in localStorage (all in try/catch, private windows throw):
 *   magpies:YYYY-MM-DD       { v, sec, start, done, hints, t }
 *   magpies:p:<set>:<k>      the same for a practice picture
 *   magpies:streak           { posledny: YYYY-MM-DD, pocet }
 *   magpies:settings         the settings panel
 * sec = seconds spent before the current run, start = ms when the current
 * run began (null while paused or before the first move), done = ms of the
 * solve, hints = hints used, t = ms of the last save.
 * Outgoing events via window.umami, if it runs: game_solved, game_check,
 * game_hint, game_setting. Nothing else leaves the browser, unless the
 * player is signed in (arling.sk account, /style/ucet.js): then every
 * magpies:YYYY-MM-DD save is also pushed to the account (throttled, 2s)
 * and pulled back on load, so the streak and history follow across
 * devices. Signed out, nothing changes; a signed-in sync that fails over
 * the network fails silently, this browser's copy stays the truth.
 */
import { zadaniePreDen, zadanieCvicenie, rozbal, tyzden, denVTyzdni, urovenDna, posunDen, pekneDatum, kratkyDatum, UROVNE, SADY, PRVY_DEN, DNI } from './plan.mjs';
import { todayBratislava, isValidDate } from './generator.mjs';
import { jeVyriesene, porovnaj, napoveda } from './logika.mjs';
import * as ucet from '/style/ucet.js';

const $ = (id) => document.getElementById(id);
const doska = $('doska');
const stavEl = $('stav');
const casEl = $('cas');
const datumEl = $('datum');
const seriaEl = $('seria');
const spatBtn = $('spat');
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
const NASTAVENIA_KLUC = 'magpies:settings';
// No live judging: nothing turns red while you play (Andrej, 10. 9.); Check is the only judge before the picture is full.
const NASTAVENIA_PREDVOLENE = { casovac: true, potvrditReset: true, pauzaPriOdchode: true };
let nastavenia = Object.assign({}, NASTAVENIA_PREDVOLENE, nacitaj(NASTAVENIA_KLUC) || {});
function ulozNastavenia() { uloz(NASTAVENIA_KLUC, nastavenia); }

/* ── Which picture ────────────────────────────────────────────────────── */
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
const KLUC = rezim === 'cvicenie' ? 'magpies:p:' + sada + ':' + kSada : 'magpies:' + datum;
// The root address always opens today's picture; once the date is settled,
// rewrite it to today's built page so the address bar and a shared link
// point at the day itself (Andrej, 10. 9.). Only the plain root qualifies:
// a built archive day already names its date, a practice page its set, and
// a page opened with ?d= keeps that query untouched.
if (rezim === 'den' && !body.dataset.den && jeDnes && !location.search) {
  try { history.replaceState(null, '', '/games/magpies/' + datum + '/'); } catch (e) { /* the address stays generic; the game still works */ }
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

/* ── Loading the picture ──────────────────────────────────────────────── */
function vlozene() {
  const el = $('zadanie');
  if (!el) return null;
  try { return rozbal(JSON.parse(el.textContent)); } catch (e) { return null; }
}
async function zTabulky(iso) {
  try {
    const r = await fetch('/games/magpies/dni/' + iso.slice(0, 7) + '.json', { cache: 'no-cache' });
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
let zadanie, n, v, start, done, sekundy, hints, ulozene;
const historia = [];
let fokus = 0;
let tikac = null;
let pauza = false;
let tip = null;          // the hint on screen, cleared by the next move
let odhalene = false;    // Check's second step is showing wrong cells
let checkStav = null;    // what the last Check saw, so the second press can reveal it
const bunky = [];
const hlavRiadkov = [];
const hlavStlpcov = [];

/* ── Drawing ──────────────────────────────────────────────────────────── */
function klucoveCisla(blocks) {
  return blocks.length ? blocks.map((x) => '<span>' + x + '</span>').join('') : '<span>0</span>';
}
function velkostHlaviciek() {
  // The header column is sized to its own content by CSS (max-content), so
  // this only has to pick a font small enough that a Sunday fifteen by
  // fifteen still fits at 390 px; the column-header row stacks numbers, so
  // it gets a slightly smaller size still.
  let maxBlokov = 1;
  for (const col of zadanie.clues.cols) if (col.length > maxBlokov) maxBlokov = col.length;
  for (const row of zadanie.clues.rows) if (row.length > maxBlokov) maxBlokov = row.length;
  const hrFont = n <= 8 ? 12 : n <= 10 ? 11.5 : n <= 12 ? 10 : 9;
  const hcFont = Math.max(7, hrFont - (maxBlokov > 5 ? 2.5 : 1.5));
  doska.style.setProperty('--hr-font', hrFont + 'px');
  doska.style.setProperty('--hc-font', hcFont + 'px');
}
function postavMriezku() {
  doska.style.setProperty('--n', n);
  doska.setAttribute('aria-label', 'Picture grid ' + n + ' by ' + n);
  velkostHlaviciek();
  const hotove = doska.querySelectorAll('.b');
  if (hotove.length === n * n) {
    // A built page: the cells and headers are already in the HTML, only roles are missing.
    hotove.forEach((b, i) => { b.type = 'button'; b.setAttribute('role', 'gridcell'); b.tabIndex = i === 0 ? 0 : -1; bunky.push(b); });
    doska.querySelectorAll('.h.hr').forEach((h) => hlavRiadkov.push(h));
    doska.querySelectorAll('.h.hc').forEach((h) => hlavStlpcov.push(h));
    return;
  }
  doska.textContent = '';
  const frag = document.createDocumentFragment();
  const hlavicky = document.createElement('div');
  hlavicky.className = 'riadok';
  hlavicky.setAttribute('role', 'row');
  const roh = document.createElement('div');
  roh.className = 'h roh';
  hlavicky.appendChild(roh);
  for (let c = 0; c < n; c++) {
    const h = document.createElement('div');
    h.className = 'h hc';
    h.innerHTML = klucoveCisla(zadanie.clues.cols[c]);
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
    hr.innerHTML = klucoveCisla(zadanie.clues.rows[r]);
    riadok.appendChild(hr);
    hlavRiadkov.push(hr);
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'b';
      b.dataset.i = i;
      b.setAttribute('role', 'gridcell');
      b.tabIndex = i === 0 ? 0 : -1;
      if (r === 0) b.classList.add('r0');
      if (c === 0) b.classList.add('c0');
      riadok.appendChild(b);
      bunky.push(b);
    }
    frag.appendChild(riadok);
  }
  doska.appendChild(frag);
}
const NAZVY = ['empty', 'filled', 'cross'];
function ukazBunku(i) {
  const b = bunky[i];
  b.dataset.v = v[i];
  b.setAttribute('aria-label', 'row ' + (Math.floor(i / n) + 1) + ', column ' + ((i % n) + 1) + ', ' + NAZVY[v[i]]);
}
function sucetBlokov(blocks) { return blocks.reduce((a, x) => a + x, 0); }
function oznacSuciatka() {
  // A soft visual cue only, not a judgement: how many cells are filled in a
  // row or column against how many its numbers add up to. It says nothing
  // about whether they are the RIGHT cells (Andrej, 10. 9.: nothing turns
  // red while playing; only Check judges).
  for (let r = 0; r < n; r++) {
    let s = 0; for (let c = 0; c < n; c++) if (v[r * n + c] === 1) s++;
    hlavRiadkov[r].classList.toggle('zhotovo', s === sucetBlokov(zadanie.clues.rows[r]));
  }
  for (let c = 0; c < n; c++) {
    let s = 0; for (let r = 0; r < n; r++) if (v[r * n + c] === 1) s++;
    hlavStlpcov[c].classList.toggle('zhotovo', s === sucetBlokov(zadanie.clues.cols[c]));
  }
}
function ukazVsetko() { for (let i = 0; i < n * n; i++) ukazBunku(i); oznacSuciatka(); }
function zmazTip() {
  if (!tip) return;
  tip = null;
  for (const b of bunky) b.classList.remove('tip', 'tip-jednotka');
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

/* ── Streak and history ───────────────────────────────────────────────── */
function ukazSeriu() {
  if (!seriaEl) return;
  const s = nacitaj('magpies:streak');
  if (!s || !s.pocet) { seriaEl.textContent = ''; return; }
  const ziva = s.posledny === dnes || s.posledny === posunDen(dnes, -1);
  seriaEl.textContent = ziva ? 'Streak: ' + s.pocet + (s.pocet === 1 ? ' day' : ' days') : '';
}
function zapisSeriu() {
  // Only a picture solved on its own day counts: the archive is for practice.
  if (!jeDnes) return;
  const s = nacitaj('magpies:streak') || { posledny: null, pocet: 0 };
  if (s.posledny === datum) return;
  const pocet = s.posledny === posunDen(datum, -1) ? s.pocet + 1 : 1;
  uloz('magpies:streak', { posledny: datum, pocet });
}
/* Every solved day in this browser, newest first. */
function historiaDni() {
  const out = [];
  for (const k of vsetkyKluce('magpies:')) {
    const d = k.slice('magpies:'.length);
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
  historiaEl.innerHTML = '<b>Your pictures:</b> ' + h.length + ' solved' + (urovne ? ' (' + urovne + ')' : '') + (bezNapovedy !== h.length ? ', ' + bezNapovedy + ' without hints' : ', all without hints')
    + (best ? ', best ' + formatCas(best.sec) + ' on ' + kratkyDatum(best.d) : '') + (priemer ? ', average ' + formatCas(priemer) : '') + '. <a href="/games/magpies/archive/">Archive and full history</a>.';
}

/* ── Saving and solving ───────────────────────────────────────────────── */
function ulozStav() { uloz(KLUC, { v, sec: sekundy, start, done, hints, t: Date.now() }); naplanujOdoslanie(); }

function ukazStav() {
  oznacSuciatka();
  stavEl.classList.toggle('ok', !!done);
  if (done) {
    const s = sekundy ? ' in ' + formatCas(sekundy) : '';
    const hn = hints ? ' with ' + hints + (hints === 1 ? ' hint' : ' hints') : ' without hints';
    stavEl.innerHTML = '<b>Solved</b>' + s + hn + '. The magpies are pleased.' + (jeDnes ? ' A new picture arrives at midnight.' : '');
    return;
  }
  const vyplnenych = v.reduce((a, x) => a + (x === 1 ? 1 : 0), 0);
  const oznacenych = v.some((x) => x !== 0);
  if (!oznacenych) { stavEl.textContent = 'Tap a cell to fill it, tap again for a cross. Drag to sweep.'; return; }
  const celkom = zadanie.clues.rows.reduce((a, b) => a + sucetBlokov(b), 0);
  if (vyplnenych === celkom) { stavEl.textContent = 'All ' + celkom + ' cells the numbers ask for are filled, but the picture is not right yet. Check shows where.'; return; }
  stavEl.textContent = '';
}

/* Check, in two steps. The first press says whether anything is wrong and
 * how much; only the second press shows which cells. The puzzle stays a
 * puzzle unless you ask twice. */
function skontrolujStav() {
  if (done) return;
  const p = porovnaj(v, zadanie.solution);
  const zle = p.zleVyplnene.length + p.zleKrizky.length;
  if (!p.vyplnene && !p.krizky) { stavEl.textContent = 'Nothing on the board yet.'; return; }
  if (!zle) {
    zmazOdhalenie();
    stavEl.textContent = 'Everything on the board is right so far: ' + p.vyplnene + (p.vyplnene === 1 ? ' filled cell' : ' filled cells') + ' and ' + p.krizky + (p.krizky === 1 ? ' cross' : ' crosses') + '.';
    track('game_check', { game: 'magpies', wrong: 0 });
    return;
  }
  const popis = [];
  if (p.zleVyplnene.length) popis.push(p.zleVyplnene.length + (p.zleVyplnene.length === 1 ? ' filled cell' : ' filled cells'));
  if (p.zleKrizky.length) popis.push(p.zleKrizky.length + (p.zleKrizky.length === 1 ? ' cross' : ' crosses'));
  if (checkStav && !odhalene) {
    odhalene = true;
    for (const i of p.zleVyplnene) bunky[i].classList.add('chyba');
    for (const i of p.zleKrizky) bunky[i].classList.add('chyba');
    stavEl.textContent = 'The marked cells are wrong: ' + popis.join(' and ') + '. Fix them and keep going.';
    checkBtn.textContent = 'Check';
    track('game_check', { game: 'magpies', wrong: zle, revealed: true });
    return;
  }
  checkStav = { zle };
  stavEl.textContent = 'There ' + (zle === 1 ? 'is 1 mistake' : 'are ' + zle + ' mistakes') + ' on the board: ' + popis.join(' and ') + '. Press Check again to show where.';
  checkBtn.textContent = 'Show';
  track('game_check', { game: 'magpies', wrong: zle, revealed: false });
}

/* Which cells to outline for a row/column hint: the whole line, computed
 * here since napoveda only names the line (druh, cislo), not its cells. */
function jednotkaPreHint(h) {
  if (h.druh === 'riadok') { const r = h.cislo - 1; return Array.from({ length: n }, (_, c) => r * n + c); }
  if (h.druh === 'stlpec') { const c = h.cislo - 1; return Array.from({ length: n }, (_, r) => r * n + c); }
  return [];
}
/* Hint, in two steps too: the first press outlines and explains, the second
 * press fills the marks in. Every hint is counted and shown at the end. */
function ukazNapovedu() {
  if (done) return;
  if (tip) {
    // second press: apply
    const pred = v.slice();
    let zmena = false;
    for (const i of tip.bunky) if (v[i] !== tip.hodnota) { v[i] = tip.hodnota; ukazBunku(i); zmena = true; }
    if (zmena) {
      if (!start) { start = Date.now(); spustiTikac(); }
      historia.push({ cele: pred });
      spatBtn.disabled = false;
    }
    hints++;
    const t = tip; zmazTip(); zmazOdhalenie();
    track('game_hint', { game: 'magpies', kind: t.druh, applied: true });
    if (!skontroluj()) ulozStav();
    ukazStav();
    ukazCas();
    return;
  }
  const h = napoveda(v, zadanie.clues, zadanie.solution);
  if (!h) return;
  tip = h;
  for (const i of jednotkaPreHint(h)) bunky[i].classList.add('tip-jednotka');
  for (const i of h.bunky) bunky[i].classList.add('tip');
  if (h.druh === 'riadok') hlavRiadkov[h.cislo - 1].classList.add('tip-jednotka');
  if (h.druh === 'stlpec') hlavStlpcov[h.cislo - 1].classList.add('tip-jednotka');
  stavEl.textContent = h.text + ' Press Hint again to fill it in.';
  hintBtn.textContent = 'Fill in';
  track('game_hint', { game: 'magpies', kind: h.druh, applied: false });
}

function skontroluj() {
  if (!jeVyriesene(v, zadanie.clues)) return false;
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
  track('game_solved', { game: 'magpies', day: rezim === 'den' ? datum : sada + '/' + kSada, seconds: sekundy, hints, level: zadanie.uroven });
  return true;
}

/* ── Moves ────────────────────────────────────────────────────────────── */
function nastav(i, hodnota, doHistorie = true) {
  if (done || pauza) return;
  if (v[i] === hodnota) return;
  const pred = v[i];
  v[i] = hodnota;
  if (!start) { start = Date.now(); spustiTikac(); }
  ukazBunku(i);
  if (doHistorie) historia.push({ i, z: pred });
  zmazTip(); zmazOdhalenie();
  if (!skontroluj()) ulozStav();
  ukazStav();
  ukazCas();
  spatBtn.disabled = historia.length === 0;
}
function prepni(i) { nastav(i, (v[i] + 1) % 3); }

function spat() {
  if (done || pauza || !historia.length) return;
  const h = historia.pop();
  if (h.cele) { v = h.cele; ukazVsetko(); }
  else { v[h.i] = h.z; ukazBunku(h.i); }
  zmazTip(); zmazOdhalenie();
  ulozStav();
  ukazStav();
  spatBtn.disabled = historia.length === 0;
}
/* Clear: an empty grid, the clock keeps running (Andrej, 10. 9.: clearing
 * is a move, not a restart). Undo cannot bring the marks back. */
function reset() {
  if (done || pauza) return;
  if (v.every((x) => x === 0)) return;
  if (nastavenia.potvrditReset && !window.confirm('Clear the whole picture? The clock keeps running and Undo cannot bring the marks back.')) return;
  v = new Array(n * n).fill(0);
  historia.length = 0;
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  ulozStav();
  ukazStav();
  ukazCas();
  spatBtn.disabled = true;
}

/* ── Keyboard and pointer ─────────────────────────────────────────────── *
 * A drag paints with whatever a single tap on the FIRST cell would have set
 * it to (fill or cross), and only touches cells that are still empty: it
 * never changes a cell that already carries the other kind of mark. When
 * the first cell already carries a cross, a tap there clears it; that is a
 * single-cell move and the drag does not sweep any further (Andrej, 10. 9.). */
function zameraj(i) {
  bunky[fokus].tabIndex = -1;
  fokus = i;
  bunky[i].tabIndex = 0;
  bunky[i].focus();
}
let tah = null; // { start, maloval, hodnota, id }
function bunkaPod(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const b = el && el.closest ? el.closest('.b') : null;
  return b && doska.contains(b) ? +b.dataset.i : -1;
}
doska.addEventListener('pointerdown', (e) => {
  if (done || pauza || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const i = bunkaPod(e);
  if (i < 0) return;
  tah = { start: i, maloval: false, hodnota: (v[i] + 1) % 3, id: e.pointerId };
  try { doska.setPointerCapture(e.pointerId); } catch (err) { /* works without capture too, less smoothly */ }
  if (fokus !== i) { bunky[fokus].tabIndex = -1; fokus = i; bunky[i].tabIndex = 0; }
  e.preventDefault();
});
doska.addEventListener('pointermove', (e) => {
  if (!tah || tah.id !== e.pointerId || done || pauza || tah.hodnota === 0) return;
  const i = bunkaPod(e);
  if (i < 0 || (i === tah.start && !tah.maloval)) return;
  if (!tah.maloval) {
    tah.maloval = true;
    nastav(tah.start, tah.hodnota);
  }
  if (v[i] === 0) nastav(i, tah.hodnota);
});
function koniecTahu(e) {
  if (!tah || tah.id !== e.pointerId) return;
  const t = tah;
  tah = null;
  try { doska.releasePointerCapture(e.pointerId); } catch (err) { /* nothing */ }
  if (!t.maloval && !done && !pauza) prepni(t.start);
}
doska.addEventListener('pointerup', koniecTahu);
doska.addEventListener('pointercancel', (e) => { if (tah && tah.id === e.pointerId) tah = null; });
doska.addEventListener('keydown', (e) => {
  const b = e.target.closest('.b');
  if (!b) return;
  const i = +b.dataset.i;
  const r = Math.floor(i / n), c = i % n;
  let cielova = null;
  switch (e.key) {
    case 'ArrowUp': cielova = ((r + n - 1) % n) * n + c; break;
    case 'ArrowDown': cielova = ((r + 1) % n) * n + c; break;
    case 'ArrowLeft': cielova = r * n + (c + n - 1) % n; break;
    case 'ArrowRight': cielova = r * n + (c + 1) % n; break;
    case 'Home': cielova = r * n; break;
    case 'End': cielova = r * n + n - 1; break;
    case ' ': case 'Enter': prepni(i); e.preventDefault(); return;
    case 'f': case 'F': case '1': nastav(i, 1); e.preventDefault(); return;
    case 'x': case 'X': case '2': nastav(i, 2); e.preventDefault(); return;
    case 'Delete': case 'Backspace': case '0': nastav(i, 0); e.preventDefault(); return;
    default: return;
  }
  e.preventDefault();
  zameraj(cielova);
});
spatBtn.addEventListener('click', spat);
if (resetBtn) resetBtn.addEventListener('click', reset);
if (checkBtn) checkBtn.addEventListener('click', skontrolujStav);
if (hintBtn) hintBtn.addEventListener('click', ukazNapovedu);
if (pauzaBtn) pauzaBtn.addEventListener('click', () => pozastav(false));
if (pokracujBtn) pokracujBtn.addEventListener('click', pokracuj);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && pauza) pokracuj();
  else if (e.key === 'p' || e.key === 'P') { if (e.target && /input|textarea/i.test(e.target.tagName)) return; if (pauza) pokracuj(); else pozastav(false); }
});
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
      const st = nacitaj('magpies:p:' + sada + ':' + k);
      const a = document.createElement(k === kSada ? 'span' : 'a');
      a.className = 'den' + (k === kSada ? ' dnes' : '') + (st && st.done ? ' hotove' : st && st.v && st.v.some((x) => x) ? ' rozohrane' : '');
      if (k !== kSada) a.href = '/games/magpies/practice/' + sada + '/' + k + '/';
      a.innerHTML = '<small>No.</small><b>' + k + '</b>';
      a.setAttribute('aria-label', 'Picture ' + k + (st && st.done ? ', solved' : ''));
      if (k === kSada) a.setAttribute('aria-current', 'page');
      pasik.appendChild(a);
    }
    return;
  }
  const dni = tyzden(datum);
  dni.forEach((d, k) => {
    const st = nacitaj('magpies:' + d);
    const buduci = d > dnes, pred = d < PRVY_DEN;
    const tag = d === datum || buduci || pred ? 'span' : 'a';
    const a = document.createElement(tag);
    a.className = 'den' + (d === datum ? ' dnes' : '') + (buduci || pred ? ' buduci' : '') + (st && st.done ? ' hotove' : st && st.v && st.v.some((x) => x) ? ' rozohrane' : '');
    if (tag === 'a') a.href = '/games/magpies/' + d + '/';
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
  ukazCas();
}
document.querySelectorAll('[data-nastavenie]').forEach((el) => {
  const kluc = el.getAttribute('data-nastavenie');
  el.checked = !!nastavenia[kluc];
  el.addEventListener('change', () => {
    nastavenia[kluc] = el.checked;
    ulozNastavenia();
    pouziNastavenia();
    track('game_setting', { game: 'magpies', setting: kluc, on: el.checked });
  });
});

/* ── Account sync (only when signed in, silent otherwise) ────────────────
 * The account stores one object per game: { dni: { 'YYYY-MM-DD': stav }, t }.
 * On merge, for each day the record with the higher `t` wins, but a `done`
 * on either side is never dropped (a slightly older save should not un-solve
 * a day). The streak is then rebuilt from the merged solved days instead of
 * trusted as a stored number, so a merge can never leave it wrong. */
function stavVsetkychDni() {
  const out = {};
  for (const k of vsetkyKluce('magpies:')) {
    const d = k.slice('magpies:'.length);
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
  const done = lokalny.done || vzdialeny.done || null;
  return done && !v.done ? Object.assign({}, v, { done }) : v;
}
function prepocitajSeriu() {
  const dni = stavVsetkychDni();
  let d = dni[dnes] && dni[dnes].done ? dnes : posunDen(dnes, -1);
  let pocet = 0;
  while (dni[d] && dni[d].done) { pocet++; d = posunDen(d, -1); }
  if (!pocet) { try { localStorage.removeItem('magpies:streak'); } catch (e) { /* nič */ } return; }
  uloz('magpies:streak', { posledny: dni[dnes] && dni[dnes].done ? dnes : posunDen(dnes, -1), pocet });
}
function odosliStav() {
  if (!ucet.prihlaseny()) return;
  ucet.hra.uloz('magpies', { dni: stavVsetkychDni(), t: Date.now() }).catch(() => { /* sieťová chyba: lokálne ostáva pravdou */ });
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
  try { vzdialene = await ucet.hra.nacitaj('magpies'); } catch (e) { return; /* sieťová chyba: lokálne ostáva pravdou */ }
  const diaDni = vzdialene && vzdialene.dni && typeof vzdialene.dni === 'object' ? vzdialene.dni : {};
  let zmenene = false;
  for (const [d, r] of Object.entries(diaDni)) {
    if (!isValidDate(d) || !r || typeof r !== 'object') continue;
    const kluc = 'magpies:' + d;
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
        v = cerstve.v.slice();
        done = cerstve.done || null;
        hints = cerstve.hints || 0;
        sekundy = cerstve.sec || 0;
        ukazVsetko();
        if (done) { doska.classList.add('hotovo'); zastavTikac(); }
        ukazStav();
        ukazCas();
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
    stavEl.textContent = 'This picture opens on ' + pekneDatum(datum) + ' (Bratislava time). Come back then, or play today’s picture.';
    doska.hidden = true;
    for (const b of [spatBtn, resetBtn, checkBtn, hintBtn]) if (b) b.disabled = true;
    ukazPasik();
    return;
  }
  try {
    zadanie = await nacitajZadanie();
  } catch (e) {
    stavEl.textContent = 'The picture could not be prepared. Please reload the page.';
    throw e;
  }
  n = zadanie.n;
  ulozene = nacitaj(KLUC);
  v = (ulozene && Array.isArray(ulozene.v) && ulozene.v.length === n * n) ? ulozene.v.slice() : new Array(n * n).fill(0);
  done = ulozene && ulozene.done ? ulozene.done : null;
  hints = ulozene && ulozene.hints ? ulozene.hints : 0;
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
  if (datumEl) datumEl.textContent = rezim === 'cvicenie' ? UROVNE[zadanie.uroven].label + ' practice ' + sada.split('-')[1] + ', picture ' + kSada : pekneDatum(datum);
  if (urovenEl) urovenEl.textContent = UROVNE[zadanie.uroven].label + ' · ' + n + '×' + n;
  if (done) doska.classList.add('hotovo');
  else if (v.some((x) => x)) pozastav(true);
  ukazCas();
  ukazSeriu();
  ukazHistoriu();
  ukazPasik();
  ukazStav();
  spatBtn.disabled = true;
}
spusti().then(synchronizujUcet);
