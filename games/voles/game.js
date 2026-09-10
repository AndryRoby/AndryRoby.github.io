/* Voles: the game page. One script for the daily meadow, the archive days and
 * the practice sets; the page says which one it is:
 *
 *   <body data-den="YYYY-MM-DD">          an archive day (built page)
 *   <body data-sada="easy-1" data-k="3">  a practice meadow
 *   nothing                               today's meadow (or ?d=YYYY-MM-DD)
 *
 * The puzzle itself comes, in this order: from <script type="application/json"
 * id="zadanie"> embedded in a built page; from dni/YYYY-MM.json for the day;
 * or, when both are missing, generated right here from the date. All three
 * give the same meadow for the same date (plan.mjs, generator.mjs).
 *
 * The board is always drawn here from the puzzle, so a built page only has to
 * carry the packed puzzle for the browser and a line of text for readers
 * without JavaScript.
 *
 * The player's board is one flat n*n array:
 *   v   0 an untouched cell, 1 water (shaded), 2 a dot (the player's note
 *       that the cell is dry). A cell with a number is dry by definition and
 *       is never in play, so it stays 0 for ever.
 * Only the shading decides the puzzle: to the rules a dot and an untouched
 * cell mean the same thing (logika.mjs).
 *
 * Stored in localStorage (all in try/catch, private windows throw):
 *   voles:YYYY-MM-DD     { v, sec, start, done, hints, checks, t }
 *   voles:p:<set>:<k>    the same for a practice meadow
 *   voles:streak         { posledny: YYYY-MM-DD, pocet }
 *   voles:nastavenia     the settings panel
 * sec = seconds spent before the current run, start = ms when the current run
 * began (null while paused or before the first move), done = ms of the solve,
 * hints and checks = help used, t = ms of the last save. The history line is
 * counted from the day records themselves, there is no separate one.
 * Outgoing events via window.umami, if it runs: game_solved, game_check,
 * game_hint, game_setting. Nothing else leaves the browser, unless the player
 * is signed in (arling.sk account, /style/ucet.js): then every voles:YYYY-MM-DD
 * save is also pushed to the account (throttled, 2s) and pulled back on load,
 * so the streak and history follow across devices. Signed out, nothing
 * changes; a signed-in sync that fails over the network fails silently, this
 * browser's copy stays the truth.
 */
import { zadaniePreDen, zadanieCvicenie, rozbal, tyzden, urovenDna, posunDen, pekneDatum, kratkyDatum, UROVNE, SADY, PRVY_DEN, DNI } from './plan.mjs';
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
const znovaBtn = $('znova');
const resetBtn = $('reset');
const checkBtn = $('check');
const hintBtn = $('hint');
const zdielajBtn = $('zdielaj');
const zdielajStavEl = $('zdielaj-stav');
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
const NASTAVENIA_KLUC = 'voles:nastavenia';
// Auto water and Live check are off by default: the shading is the player's
// own, and nothing turns red while you play (Andrej, 10. 9.); Check is the
// only judge before the last cell is marked.
const NASTAVENIA_PREDVOLENE = { casovac: true, pauzaPriOdchode: true, zvyrazniOstrov: true, autoVoda: false, zivaKontrola: false, potvrditReset: true };
let nastavenia = Object.assign({}, NASTAVENIA_PREDVOLENE, nacitaj(NASTAVENIA_KLUC) || {});
function ulozNastavenia() { uloz(NASTAVENIA_KLUC, nastavenia); }

/* ── Which meadow ─────────────────────────────────────────────────────── */
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
const KLUC = rezim === 'cvicenie' ? 'voles:p:' + sada + ':' + kSada : 'voles:' + datum;
// The root address always opens today's meadow; once the date is settled,
// rewrite it to today's built page so the address bar and a shared link
// point at the day itself (Andrej, 10. 9.). Only the plain root qualifies:
// a built archive day already names its date, a practice page its set, and
// a page opened with ?d= keeps that query untouched.
if (rezim === 'den' && !body.dataset.den && jeDnes && !location.search) {
  try { history.replaceState(null, '', '/games/voles/' + datum + '/'); } catch (e) { /* the address stays generic; the game still works */ }
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

/* ── Loading the meadow ───────────────────────────────────────────────── */
function vlozene() {
  const el = $('zadanie');
  if (!el) return null;
  try { return rozbal(JSON.parse(el.textContent)); } catch (e) { return null; }
}
async function zTabulky(iso) {
  try {
    const r = await fetch('/games/voles/dni/' + iso.slice(0, 7) + '.json', { cache: 'no-cache' });
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
let zadanie, n, C, clues, v, start, done, sekundy, hints, checks, ulozene;
let vodyCelkom = 0;         // how many cells the finished meadow has under water
let undoStack = [];
let redoStack = [];
let kurzor = -1;            // the cell the keyboard is standing on
let tikac = null;
let necinnost = null;
let pauza = false;
let tip = null;             // the hint on screen, cleared by the next move
let tipUkazany = false;
let odhalene = false;       // Check's second step is showing the wrong cells
let checkStav = null;       // what the last Check saw, so the second press can reveal it
const bunky = [];           // the marking buttons, by cell index (null on a number)
const kmene = [];           // the number cells, by cell index (null elsewhere)

/* ── Drawing ──────────────────────────────────────────────────────────── */
function suradnice(i) { return 'row ' + (((i / n) | 0) + 1) + ', column ' + ((i % n) + 1); }
/* The four side neighbours of a cell, minus the ones off the meadow. */
function susedia(i) {
  const r = (i / n) | 0, c = i % n, out = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}
function postavMriezku() {
  document.documentElement.style.setProperty('--n', n);
  doska.setAttribute('aria-label', 'Meadow ' + n + ' by ' + n);
  doska.textContent = '';
  bunky.length = 0; kmene.length = 0;
  const frag = document.createDocumentFragment();
  for (let r = 0; r < n; r++) {
    const riadok = document.createElement('div');
    riadok.className = 'riadok';
    riadok.setAttribute('role', 'row');
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const okraj = (r === 0 ? ' r0' : '') + (c === 0 ? ' c0' : '');
      if (clues[i] != null) {
        const k = document.createElement('div');
        k.className = 'k' + okraj;
        k.dataset.i = i;
        k.setAttribute('role', 'gridcell');
        k.textContent = String(clues[i]);
        k.setAttribute('aria-label', suradnice(i) + ', a family of ' + clues[i] + (clues[i] === 1 ? ' cell' : ' cells'));
        riadok.appendChild(k);
        bunky.push(null); kmene.push(k);
      } else {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'b' + okraj;
        b.dataset.i = i;
        b.dataset.v = '0';
        b.setAttribute('role', 'gridcell');
        b.tabIndex = -1;
        const ik = document.createElement('i');
        ik.className = 'ikona';
        b.appendChild(ik);
        riadok.appendChild(b);
        bunky.push(b); kmene.push(null);
      }
    }
    frag.appendChild(riadok);
  }
  doska.appendChild(frag);
  const prva = bunky.find((x) => x);
  if (prva) prva.tabIndex = 0;
  merajBunku();
  popisCisel();
}
/* Every number on the board is drawn from --cell, the measured width of one
 * cell, so a twelve by twelve on a phone reads the same way as a six by six
 * on a desktop. */
function merajBunku() {
  const w = doska.clientWidth;
  if (w > 0 && n) doska.style.setProperty('--cell', (w / n) + 'px');
}
if (window.ResizeObserver) new ResizeObserver(merajBunku).observe(doska);
else window.addEventListener('resize', merajBunku);

/* The numbers as plain text for a screen reader: the drawing itself only
 * tells the shape of the meadow, not what it asks for. */
function popisCisel() {
  if (!cislaText) return;
  const casti = [];
  for (let i = 0; i < C; i++) if (clues[i] != null) casti.push(clues[i] + ' in ' + suradnice(i));
  cislaText.textContent = 'The meadow, ' + n + ' by ' + n + ', with ' + casti.length + ' families in all. ' + casti.join('. ') + '.';
}
const NAZVY = ['not marked', 'water', 'a dot for dry land'];
function ukazBunku(i) {
  const b = bunky[i];
  if (!b) return;
  const val = v[i] || 0;
  b.dataset.v = String(val);
  b.setAttribute('aria-label', suradnice(i) + ', ' + NAZVY[val]);
}

/* ── The pieces of dry land ───────────────────────────────────────────── *
 * Everything that is not shaded counts as dry, which is exactly how the rules
 * read it (logika.mjs). Returns one entry per piece: its cells, how many
 * numbers it holds and what the single number says. A piece is by definition
 * everything dry that hangs together, so whatever touches it from outside is
 * water already: there is nothing else to check for "shut in". */
function kusySuse() {
  const videne = new Uint8Array(C);
  const out = [];
  for (let i = 0; i < C; i++) {
    if (v[i] === 1 || videne[i]) continue;
    const cells = [i];
    videne[i] = 1;
    let cisel = 0, hodnota = -1;
    for (let q = 0; q < cells.length; q++) {
      const x = cells[q];
      if (clues[x] != null) { cisel++; hodnota = clues[x]; }
      for (const y of susedia(x)) if (v[y] !== 1 && !videne[y]) { videne[y] = 1; cells.push(y); }
    }
    out.push({ cells, cisel, hodnota });
  }
  return out;
}
/* A soft visual cue only, not a judgement: a piece of dry land that holds one
 * number, has exactly that many cells and is shut in by water goes quiet. It
 * says nothing about whether it is in the RIGHT place (Andrej, 10. 9.:
 * nothing turns red while playing, only Check judges). */
function oznacSplnene() {
  for (const b of bunky) if (b) b.classList.remove('stlmena');
  for (const k of kmene) if (k) k.classList.remove('stlmena');
  for (const kus of kusySuse()) {
    if (kus.cisel !== 1 || kus.cells.length !== kus.hodnota) continue;
    for (const x of kus.cells) { const el = bunky[x] || kmene[x]; if (el) el.classList.add('stlmena'); }
  }
}
/* The piece of dry land the cursor is standing on, when the setting is on. */
function oznacVyber() {
  for (const b of bunky) if (b) b.classList.remove('ostrov');
  for (const k of kmene) if (k) k.classList.remove('ostrov');
  if (done || kurzor < 0 || !nastavenia.zvyrazniOstrov || v[kurzor] === 1) return;
  const videne = new Set([kurzor]);
  const front = [kurzor];
  while (front.length) {
    const x = front.pop();
    for (const y of susedia(x)) if (v[y] !== 1 && !videne.has(y)) { videne.add(y); front.push(y); }
  }
  if (videne.size > C / 2) return;   // the whole meadow is still dry: nothing to point at
  for (const x of videne) { const el = bunky[x] || kmene[x]; if (el) el.classList.add('ostrov'); }
}
function ukazVsetko() {
  for (let i = 0; i < C; i++) ukazBunku(i);
  oznacSplnene();
  oznacVyber();
}
function zmazTip() {
  if (!tip) return;
  tip = null; tipUkazany = false;
  for (const b of bunky) if (b) b.classList.remove('tip', 'tip-okolie');
  for (const k of kmene) if (k) k.classList.remove('tip-okolie');
  if (hintBtn) hintBtn.textContent = 'Hint';
}
function zmazOdhalenie() {
  if (!odhalene && !checkStav) return;
  odhalene = false; checkStav = null;
  for (const b of bunky) if (b) b.classList.remove('chyba');
  if (checkBtn) checkBtn.textContent = 'Check';
}
/* Live check is off by default; when it is on, a wrong mark is marked as soon
 * as it is made, with a frame and a sign, not by colour alone. */
function zivaKontrola() {
  if (!nastavenia.zivaKontrola || done || !zadanie) return;
  // the marks it left last time go first, or a corrected cell would keep its
  // red frame for ever
  if (!odhalene) for (const b of bunky) if (b) b.classList.remove('chyba');
  const p = porovnaj(v, zadanie.solution);
  for (const i of p.zlaVoda.concat(p.zleBodky)) if (bunky[i]) bunky[i].classList.add('chyba');
}

/* ── Auto water ───────────────────────────────────────────────────────── *
 * Off by default. When an island the player has staked out with dots already
 * has as many cells as its number allows, every open cell beside it is water.
 * It reads only what the player has claimed, never the solution, and it lands
 * in the history as part of the move that finished the island. */
function doplnAutoVodu() {
  const videne = new Uint8Array(C);
  for (let i = 0; i < C; i++) {
    if (videne[i] || (clues[i] == null && v[i] !== 2)) continue;
    const cells = [i];
    videne[i] = 1;
    let cisel = 0, hodnota = -1;
    for (let q = 0; q < cells.length; q++) {
      const x = cells[q];
      if (clues[x] != null) { cisel++; hodnota = clues[x]; }
      for (const y of susedia(x)) {
        if (videne[y] || (clues[y] == null && v[y] !== 2)) continue;
        videne[y] = 1; cells.push(y);
      }
    }
    if (cisel !== 1 || cells.length !== hodnota) continue;
    for (const x of cells) for (const y of susedia(x)) if (clues[y] == null && v[y] === 0) v[y] = 1;
  }
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
  const s = nacitaj('voles:streak');
  if (!s || !s.pocet) { seriaEl.textContent = ''; return; }
  const ziva = s.posledny === dnes || s.posledny === posunDen(dnes, -1);
  seriaEl.textContent = ziva ? 'Streak: ' + s.pocet + (s.pocet === 1 ? ' day' : ' days') : '';
}
function zapisSeriu() {
  // Only a meadow solved on its own day counts: the archive is for practice.
  if (!jeDnes) return;
  const s = nacitaj('voles:streak') || { posledny: null, pocet: 0 };
  if (s.posledny === datum) return;
  const pocet = s.posledny === posunDen(datum, -1) ? s.pocet + 1 : 1;
  uloz('voles:streak', { posledny: datum, pocet });
}
/* Every solved day in this browser, newest first. */
function historiaDni() {
  const out = [];
  for (const k of vsetkyKluce('voles:')) {
    const d = k.slice('voles:'.length);
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
  historiaEl.innerHTML = '<b>Your meadows:</b> ' + h.length + ' solved' + (urovne ? ' (' + urovne + ')' : '') + (ciste ? ', ' + ciste + ' clean, with no hint and no check' : ', none clean yet')
    + (best ? ', best ' + formatCas(best.sec) + ' on ' + kratkyDatum(best.d) : '') + (priemer ? ', average ' + formatCas(priemer) : '') + '. <a href="/games/voles/archive/">Archive and full history</a>.';
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
    stavEl.innerHTML = '<b>Solved</b>' + s + hn + '. ' + (pomoc.length ? 'Every family is dry.' : 'A clean meadow: the voles are impressed.')
      + (jeDnes ? ' A new meadow arrives at midnight, Bratislava time.' : '');
    return;
  }
  let voda = 0, bodky = 0;
  for (let i = 0; i < C; i++) { if (v[i] === 1) voda++; else if (v[i] === 2) bodky++; }
  if (!voda && !bodky) { stavEl.textContent = 'Tap a cell to flood it, again for a dot, again to clear it.'; return; }
  if (voda >= vodyCelkom) { stavEl.textContent = 'You have shaded as much water as the numbers allow, but the meadow does not work out yet. Check shows where.'; return; }
  stavEl.textContent = '';
}

/* ── Check, in two steps ──────────────────────────────────────────────── *
 * The first press says how many marks are wrong and in which rows; only the
 * second press marks them. The meadow stays a puzzle unless you ask twice. */
function skontrolujStav() {
  if (done || pauza) return;
  const p = porovnaj(v, zadanie.solution);
  const zle = p.zlaVoda.concat(p.zleBodky);
  const oznacene = p.voda + p.bodky;
  if (!oznacene) { stavEl.textContent = 'Nothing on the meadow yet.'; return; }
  checks++;
  ulozStav();
  if (!zle.length) {
    zmazOdhalenie();
    const casti = [];
    if (p.voda) casti.push(p.voda + (p.voda === 1 ? ' cell shaded' : ' cells shaded'));
    if (p.bodky) casti.push(p.bodky + (p.bodky === 1 ? ' dot' : ' dots'));
    stavEl.textContent = 'Everything right so far: ' + zoznamSlov(casti) + ', and not one of them wrong.';
    track('game_check', { game: 'voles', wrong: 0 });
    return;
  }
  if (checkStav && !odhalene) {
    odhalene = true;
    for (const i of zle) if (bunky[i]) bunky[i].classList.add('chyba');
    stavEl.textContent = 'The marked ' + (zle.length === 1 ? 'cell is not' : 'cells are not') + ' like that in the finished meadow. Clear ' + (zle.length === 1 ? 'it' : 'them') + ' and keep going.';
    checkBtn.textContent = 'Check';
    track('game_check', { game: 'voles', wrong: zle.length, revealed: true });
    return;
  }
  const riadky = [];
  for (const i of zle) { const s = 'row ' + (((i / n) | 0) + 1); if (!riadky.includes(s)) riadky.push(s); }
  checkStav = { zle: zle.length };
  stavEl.textContent = 'There ' + (zle.length === 1 ? 'is 1 mark that is wrong' : 'are ' + zle.length + ' marks that are wrong')
    + ', in ' + zoznamSlov(riadky.slice(0, 4)) + (riadky.length > 4 ? ' and elsewhere' : '') + '. Press Check again to show where.';
  checkBtn.textContent = 'Show';
  track('game_check', { game: 'voles', wrong: zle.length, revealed: false });
}

/* ── Hint, in two steps ───────────────────────────────────────────────── *
 * The first press names the rule and the place and lights the corner of the
 * meadow it reads, without saying whether the cell goes under water or stays
 * dry; the second press marks that one cell and explains it in full. Every
 * hint is counted and shown at the end. */
const VETY = {
  'wrong-water': (kde) => 'There is shading in ' + kde + ' that the finished meadow does not have. Take it off before going on.',
  'wrong-dot': (kde) => 'There is a dot in ' + kde + ' that the finished meadow does not have. Take it off before going on.',
  'one-alone': (kde) => 'A family of 1 stands beside ' + kde + ', and a 1 has its whole island already.',
  'between-numbers': (kde) => 'The cell in ' + kde + ' sits between two different numbers, and one cell cannot belong to two families.',
  'island-done': (kde) => 'The island beside ' + kde + ' already has all the cells its number allows.',
  'all-islands-found': (kde) => 'Every family already has an island of the right size, so what is left over near ' + kde + ' is settled.',
  'all-water-found': (kde) => 'The water already has every cell the numbers leave it, so ' + kde + ' is settled.',
  'unreachable': (kde) => 'No number is close enough to reach ' + kde + ', even counting straight across the meadow.',
  'no-path': (kde) => 'No number can get to ' + kde + ' without crossing water or another island.',
  'water-2x2': (kde) => 'Three cells of a two by two block around ' + kde + ' are already shaded, and water never fills a whole block of four.',
  'island-one-way': (kde) => 'The island beside ' + kde + ' is not finished and has only one cell left to grow into.',
  'water-one-way': (kde) => 'The piece of water beside ' + kde + ' has only one way out, and all the water has to hang together.',
  'would-join': (kde) => 'The cell in ' + kde + ' touches two islands that already have their own numbers, and islands never touch by a side.',
  'too-big': (kde) => 'Taking the cell in ' + kde + ' would give an island more cells than its number allows.',
  'too-big-any': (kde) => 'Taking the cell in ' + kde + ' would join the pieces beside it into an island bigger than any number left.',
  'trial-water': (kde) => 'Try the cell in ' + kde + ' both ways and follow the plain rules: one of the two ends in nonsense.',
  'trial-island': (kde) => 'Try the cell in ' + kde + ' both ways and follow the plain rules: one of the two ends in nonsense.',
  'reveal': (kde) => 'No named rule reaches from here, so this hint simply settles ' + kde + '.',
};
function ukazNapovedu() {
  if (done || pauza) return;
  if (tip && tipUkazany) {
    // second press: mark it
    const t = tip;
    hints++;   // counted before the move, so the save inside it carries the new number
    const zmenilo = zmenaStavu(() => {
      for (const x of t.bunky) if (clues[x.i] == null) v[x.i] = x.val;
      if (nastavenia.autoVoda) doplnAutoVodu();
    });
    const text = t.text;
    zmazTip(); zmazOdhalenie();
    track('game_hint', { game: 'voles', rule: t.pravidlo, layer: t.vrstva, applied: true });
    if (!zmenilo) { ulozStav(); ukazStav(); }
    if (!done) stavEl.textContent = text;
    return;
  }
  const h = napoveda(v, clues, zadanie.solution, n);
  if (!h) return;
  tip = h; tipUkazany = true;
  const ciel = new Set(h.bunky.map((x) => x.i));
  for (const x of h.bunky) if (bunky[x.i]) bunky[x.i].classList.add('tip');
  // the block around the cells, so the eye knows where to look without being
  // told what goes there
  for (const x of h.bunky) {
    const r = (x.i / n) | 0, c = x.i % n;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        const j = rr * n + cc;
        if (ciel.has(j)) continue;
        const el = bunky[j] || kmene[j];
        if (el) el.classList.add('tip-okolie');
      }
    }
  }
  zameraj(h.bunky[0].i, false);
  const veta = VETY[h.pravidlo] || VETY.reveal;
  stavEl.textContent = veta(suradnice(h.bunky[0].i)) + ' Press Hint again to mark it.';
  hintBtn.textContent = 'Mark it';
  track('game_hint', { game: 'voles', rule: h.pravidlo, layer: h.vrstva, applied: false });
}

function skontroluj() {
  if (!jeVyriesene(v, clues, n)) return false;
  sekundy = ubehnute();
  done = Date.now();
  start = null;
  zastavTikac();
  nastavNecinnost();
  doska.classList.add('hotovo');
  zmazTip(); zmazOdhalenie();
  oznacSplnene();
  oznacVyber();
  ukazCas();
  zapisSeriu();
  ukazSeriu();
  ulozStav();
  ukazHistoriu();
  ukazPasik();
  track('game_solved', { game: 'voles', day: rezim === 'den' ? datum : sada + '/' + kSada, seconds: sekundy, hints, checks, level: zadanie.uroven });
  return true;
}

/* ── Copy result ──────────────────────────────────────────────────────── *
 * A voluntary step after the meadow is solved (ops/spec-hry-ux.md, part 8).
 * The standard also mentions a grid of the player's own marks; in a shading
 * puzzle that grid IS the answer, so it is left out on purpose. What goes on
 * the clipboard is the meadow, the time, the help used and the link, and none
 * of it tells anybody where the water lies. Nothing is sent anywhere: the text
 * only reaches the clipboard, the player decides where it goes from there. */
function textNaZdielanie() {
  const kto = rezim === 'cvicenie'
    ? UROVNE[zadanie.uroven].label + ' practice ' + sada.split('-')[1] + ', meadow ' + kSada
    : pekneDatum(datum);
  const odkaz = 'https://arling.sk/games/voles/' + (rezim === 'cvicenie'
    ? 'practice/' + sada + '/' + (kSada > 1 ? kSada + '/' : '')
    : datum + '/');
  const pomoc = [];
  if (hints) pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
  if (checks) pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
  return 'Voles, ' + kto + ' (' + UROVNE[zadanie.uroven].label + ', ' + n + 'x' + n + ')\n'
    + 'Solved' + (sekundy ? ' in ' + formatCas(sekundy) : '') + (pomoc.length ? ' with ' + zoznamSlov(pomoc) : ', no hint and no check') + '.\n'
    + odkaz + '\n';
}
// The old way out: clipboard.writeText needs a secure context, and a page
// opened from a file or over plain http does not have one.
function skopirujStaro(text) {
  try {
    const t = document.createElement('textarea');
    t.value = text;
    t.setAttribute('readonly', '');
    t.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(t);
    return ok;
  } catch (e) { return false; }
}
let zdielajCasovac = null;
async function zdielaj() {
  if (!done || !zdielajBtn) return;
  const text = textNaZdielanie();
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { ok = skopirujStaro(text); }
  zdielajBtn.textContent = ok ? 'Copied' : 'Press Ctrl+C';
  if (!ok) window.prompt('Copy your result:', text);
  if (zdielajStavEl) zdielajStavEl.textContent = ok ? 'Your result is on the clipboard.' : 'The clipboard is not available here.';
  clearTimeout(zdielajCasovac);
  zdielajCasovac = setTimeout(() => {
    zdielajBtn.textContent = 'Copy result';
    if (zdielajStavEl) zdielajStavEl.textContent = '';
  }, 3000);
}

/* ── Moves ────────────────────────────────────────────────────────────── *
 * Every change to the board goes through zmenaStavu: it keeps the whole board
 * before and after, so Undo and Redo are one shared stack with no limit and
 * Clear is undone by a single Undo (ops/spec-hry-ux.md, part 3). A drag over
 * many cells is one entry: davka collects the board as it was when the stroke
 * began and pointerup files it. */
let davka = null;
function ukazTlacidla() {
  if (spatBtn) spatBtn.disabled = !undoStack.length || !!done;
  if (znovaBtn) znovaBtn.disabled = !redoStack.length || !!done;
  // Copy result belongs to the finish, so it is not in the row until then.
  if (zdielajBtn) zdielajBtn.hidden = !done;
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
  if (done || pauza || i < 0 || !bunky[i]) return;
  if (v[i] === hodnota) return;
  zmenaStavu(() => {
    v[i] = hodnota;
    if (nastavenia.autoVoda) doplnAutoVodu();
  });
}
/* One tap takes the cell through water, a dot and back to nothing, so the way
 * back is always one tap away (ops/spec-hry-ux.md, pattern D). */
function prepni(i) {
  if (!bunky[i]) return;
  nastav(i, ((v[i] || 0) + 1) % 3);
}

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
/* Clear: an empty meadow, the clock keeps running (Andrej, 10. 9.: clearing
 * is a move, not a restart). One Undo brings every mark back. */
function reset() {
  if (done || pauza) return;
  if (v.every((x) => !x)) return;
  if (nastavenia.potvrditReset && !window.confirm('Clear the whole meadow? The clock keeps running and one Undo brings your marks back.')) return;
  zmenaStavu(() => { v = new Array(C).fill(0); });
}

/* ── Pointer ──────────────────────────────────────────────────────────── *
 * A tap moves the cell one step around the cycle. A drag smears the state the
 * first cell was taken to: while drawing it only fills cells that are still
 * empty, so a stroke never wipes marks you placed with care, and a stroke
 * that started on a dot (so it clears) rubs out everything it passes. */
function bunkaPod(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const b = el && el.closest ? el.closest('.b') : null;
  return b && doska.contains(b) ? +b.dataset.i : -1;
}
let tah = null; // { start, maloval, hodnota, id }
doska.addEventListener('pointerdown', (e) => {
  if (done || pauza || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const i = bunkaPod(e);
  if (i < 0) return;
  zameraj(i, true);
  tah = { start: i, maloval: false, hodnota: ((v[i] || 0) + 1) % 3, id: e.pointerId };
  davka = { pred: null };
  try { doska.setPointerCapture(e.pointerId); } catch (err) { /* works without capture too, less smoothly */ }
  e.preventDefault();
});
doska.addEventListener('pointermove', (e) => {
  if (!tah || tah.id !== e.pointerId || done || pauza) return;
  const i = bunkaPod(e);
  if (i < 0) return;
  if (!tah.maloval) {
    if (i === tah.start) return;
    tah.maloval = true;
    nastav(tah.start, tah.hodnota);
  }
  if (tah.hodnota === 0 || v[i] === 0) nastav(i, tah.hodnota);
});
function koniecTahu(e) {
  if (!tah || tah.id !== e.pointerId) return;
  if (!tah.maloval) prepni(tah.start);
  tah = null;
  if (davka && davka.pred) { undoStack.push(davka.pred); redoStack.length = 0; ukazTlacidla(); }
  davka = null;
  try { doska.releasePointerCapture(e.pointerId); } catch (err) { /* nothing */ }
}
doska.addEventListener('pointerup', koniecTahu);
doska.addEventListener('pointercancel', (e) => {
  if (!tah || tah.id !== e.pointerId) return;
  tah = null;
  if (davka && davka.pred) { undoStack.push(davka.pred); redoStack.length = 0; ukazTlacidla(); }
  davka = null;
});
/* Tab into the board and the cell that takes the focus is the one the
 * keyboard works on. */
doska.addEventListener('focusin', (e) => {
  const b = e.target && e.target.closest ? e.target.closest('.b') : null;
  if (!b) return;
  const i = +b.dataset.i;
  if (i !== kurzor) { kurzor = i; oznacVyber(); }
});

/* ── Keyboard ─────────────────────────────────────────────────────────── *
 * Arrows walk from cell to cell (numbers are stepped over), Space or Enter
 * takes the cell around the cycle, W floods it, X puts a dot, Delete clears
 * it and Escape lets it go (ops/spec-hry-ux.md, pattern D). */
function zameraj(i, fokus) {
  if (i < 0 || !bunky[i]) return;
  for (const b of bunky) if (b) b.tabIndex = -1;
  kurzor = i;
  bunky[i].tabIndex = 0;
  if (fokus) bunky[i].focus({ preventScroll: true });
  oznacVyber();
}
function dalsia(i, dr, dc) {
  let r = (i / n) | 0, c = i % n;
  for (let k = 0; k < n; k++) {
    r = (r + dr + n) % n; c = (c + dc + n) % n;
    const j = r * n + c;
    if (bunky[j]) return j;
  }
  return -1;
}
doska.addEventListener('keydown', (e) => {
  if (done || pauza) return;
  const i = kurzor;
  if (i < 0) return;
  let ciel = -1;
  switch (e.key) {
    case 'ArrowUp': ciel = dalsia(i, -1, 0); break;
    case 'ArrowDown': ciel = dalsia(i, 1, 0); break;
    case 'ArrowLeft': ciel = dalsia(i, 0, -1); break;
    case 'ArrowRight': ciel = dalsia(i, 0, 1); break;
    case ' ': case 'Enter': prepni(i); e.preventDefault(); return;
    case 'w': case 'W': case 'v': case 'V': case '1': nastav(i, 1); e.preventDefault(); return;
    case 'x': case 'X': case 'd': case 'D': case '2': nastav(i, 2); e.preventDefault(); return;
    case 'Delete': case 'Backspace': case '0': nastav(i, 0); e.preventDefault(); return;
    case 'Escape': {
      const b = bunky[kurzor];
      kurzor = -1; oznacVyber();
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
if (zdielajBtn) zdielajBtn.addEventListener('click', zdielaj);
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
  // a key the board has already used as a mark is not a command as well
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
      const st = nacitaj('voles:p:' + sada + ':' + k);
      const a = document.createElement(k === kSada ? 'span' : 'a');
      a.className = 'den' + (k === kSada ? ' dnes' : '') + (st && st.done ? ' hotove' : st && st.v && st.v.some((x) => x) ? ' rozohrane' : '');
      if (k !== kSada) a.href = '/games/voles/practice/' + sada + '/' + k + '/';
      a.innerHTML = '<small>No.</small><b>' + k + '</b>';
      a.setAttribute('aria-label', 'Meadow ' + k + (st && st.done ? ', solved' : ''));
      if (k === kSada) a.setAttribute('aria-current', 'page');
      pasik.appendChild(a);
    }
    return;
  }
  const dni = tyzden(datum);
  dni.forEach((d, k) => {
    const st = nacitaj('voles:' + d);
    const buduci = d > dnes, pred = d < PRVY_DEN;
    const tag = d === datum || buduci || pred ? 'span' : 'a';
    const a = document.createElement(tag);
    a.className = 'den' + (d === datum ? ' dnes' : '') + (buduci || pred ? ' buduci' : '') + (st && st.done ? ' hotove' : st && st.v && st.v.some((x) => x) ? ' rozohrane' : '');
    if (tag === 'a') a.href = '/games/voles/' + d + '/';
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
  if (!nastavenia.zivaKontrola && !odhalene) { for (const b of bunky) if (b) b.classList.remove('chyba'); }
  zivaKontrola();
  oznacVyber();
  nastavNecinnost();
  ukazCas();
}
document.querySelectorAll('[data-nastavenie]').forEach((el) => {
  const kluc = el.getAttribute('data-nastavenie');
  el.checked = !!nastavenia[kluc];
  el.addEventListener('change', () => {
    nastavenia[kluc] = el.checked;
    ulozNastavenia();
    // Auto water, switched on, shades around every finished island at once:
    // one move in the history, exactly like any other (part 2 of the standard).
    if (kluc === 'autoVoda' && el.checked && zadanie && !done && !pauza) zmenaStavu(doplnAutoVodu);
    pouziNastavenia();
    track('game_setting', { game: 'voles', setting: kluc, on: el.checked });
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
  for (const k of vsetkyKluce('voles:')) {
    const d = k.slice('voles:'.length);
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
  if (!pocet) { try { localStorage.removeItem('voles:streak'); } catch (e) { /* nič */ } return; }
  uloz('voles:streak', { posledny: dni[dnes] && dni[dnes].done ? dnes : posunDen(dnes, -1), pocet });
}
function odosliStav() {
  if (!ucet.prihlaseny()) return;
  ucet.hra.uloz('voles', { dni: stavVsetkychDni(), t: Date.now() }).catch(() => { /* sieťová chyba: lokálne ostáva pravdou */ });
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
  try { vzdialene = await ucet.hra.nacitaj('voles'); } catch (e) { return; /* sieťová chyba: lokálne ostáva pravdou */ }
  const diaDni = vzdialene && vzdialene.dni && typeof vzdialene.dni === 'object' ? vzdialene.dni : {};
  let zmenene = false;
  for (const [d, r] of Object.entries(diaDni)) {
    if (!isValidDate(d) || !r || typeof r !== 'object') continue;
    const kluc = 'voles:' + d;
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
  // push back too: a day solved only in this browser (or a done just merged
  // in) reaches the account right away
  odosliStav();
}

/* ── Start ────────────────────────────────────────────────────────────── */
async function spusti() {
  if (jeBuduci) {
    datumEl.textContent = pekneDatum(datum);
    stavEl.textContent = 'This meadow opens on ' + pekneDatum(datum) + ' (Bratislava time). Come back then, or play today’s meadow.';
    doska.hidden = true;
    for (const b of [spatBtn, znovaBtn, resetBtn, checkBtn, hintBtn]) if (b) b.disabled = true;
    ukazPasik();
    return;
  }
  try {
    zadanie = await nacitajZadanie();
  } catch (e) {
    stavEl.textContent = 'The meadow could not be prepared. Please reload the page.';
    throw e;
  }
  n = zadanie.n;
  C = n * n;
  clues = zadanie.clues;
  vodyCelkom = C;
  for (const x of clues) if (x != null) vodyCelkom -= x;
  ulozene = nacitaj(KLUC);
  v = (ulozene && Array.isArray(ulozene.v) && ulozene.v.length === C) ? ulozene.v.slice() : new Array(C).fill(0);
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
  if (datumEl) datumEl.textContent = rezim === 'cvicenie' ? UROVNE[zadanie.uroven].label + ' practice ' + sada.split('-')[1] + ', meadow ' + kSada : pekneDatum(datum);
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
