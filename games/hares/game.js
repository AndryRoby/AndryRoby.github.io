/* Hares: the game page. One script for the daily meadow, the archive days and
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
 * The player's board is two flat n*n arrays:
 *   v   0 for an empty burrow, 1 to n for a number in it; the numbers the
 *       puzzle gives away are part of v from the start and never change
 *   pz  the small notes as a bit mask (bit d means the note d is showing)
 *
 * Stored in localStorage (all in try/catch, private windows throw):
 *   hares:YYYY-MM-DD     { v, p, sec, start, done, hints, checks, t }
 *   hares:p:<set>:<k>    the same for a practice meadow
 *   hares:streak         { posledny: YYYY-MM-DD, pocet }
 *   hares:nastavenia     the settings panel
 * sec = seconds spent before the current run, start = ms when the current run
 * began (null while paused or before the first move), done = ms of the solve,
 * hints and checks = help used, t = ms of the last save. The history line is
 * counted from the day records themselves, there is no separate one.
 * Outgoing events via window.umami, if it runs: game_solved, game_check,
 * game_hint, game_share, game_setting. Nothing else leaves the browser, unless
 * the player is signed in (arling.sk account, /style/ucet.js): then every
 * hares:YYYY-MM-DD save is also pushed to the account (throttled, 2s) and
 * pulled back on load, so the streak and history follow across devices. Signed
 * out, nothing changes; a signed-in sync that fails over the network fails
 * silently, this browser's copy stays the truth.
 */
import { zadaniePreDen, zadanieCvicenie, rozbal, tyzden, urovenDna, posunDen, pekneDatum, kratkyDatum, UROVNE, SADY, PRVY_DEN, DNI } from './plan.mjs';
import { todayBratislava, isValidDate, jadro } from './generator.mjs';
import { jeVyriesene, porovnaj, napoveda } from './logika.mjs';
import * as ucet from '/style/ucet.js';

const $ = (id) => document.getElementById(id);
const hraEl = $('hra');
const doska = $('doska');
const padEl = $('pad');
const stavEl = $('stav');
const casEl = $('cas');
const datumEl = $('datum');
const seriaEl = $('seria');
const poznamkyBtn = $('poznamky');
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
const zdielanieEl = $('zdielanie');
const zdielajBtn = $('zdielaj');
const zdielanieStav = $('zdielanie-stav');
const zdielanieText = $('zdielanie-text');
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
const NASTAVENIA_KLUC = 'hares:nastavenia';
// Auto notes and Live check are off by default: the notes are the player's own,
// and nothing turns red while you play (Andrej, 10. 9.); Check is the only
// judge before the last burrow is filled.
// dosah = the shading of what a hare can reach from the picked burrow. The
// specification asks for it as a help that can be switched off, so it is on by
// default and it never says whether anything is right (ops/spec-hares.md).
// lenPad = "Onscreen input only": the pad under the meadow writes, the number
// keys of a physical keyboard do not (ops/spec-hry-ux.md, part 7). Arrows,
// Escape, Undo, Redo and Pause keep working, so the game stays reachable from
// the keyboard even with it on.
const NASTAVENIA_PREDVOLENE = { casovac: true, pauzaPriOdchode: true, zvyrazniRovnake: true, dosah: true, autoPoznamky: false, zivaKontrola: false, lenPad: false, potvrditReset: true };
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
const KLUC = rezim === 'cvicenie' ? 'hares:p:' + sada + ':' + kSada : 'hares:' + datum;
// The root address always opens today's meadow; once the date is settled,
// rewrite it to today's built page so the address bar and a shared link point
// at the day itself (Andrej, 10. 9.). Only the plain root qualifies: a built
// archive day already names its date, a practice page its set, and a page
// opened with ?d= keeps that query untouched.
if (rezim === 'den' && !body.dataset.den && jeDnes && !location.search) {
  try { history.replaceState(null, '', '/games/hares/' + datum + '/'); } catch (e) { /* the address stays generic; the game still works */ }
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
    const r = await fetch('/games/hares/dni/' + iso.slice(0, 7) + '.json', { cache: 'no-cache' });
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
let zadanie, n, rules, J, v, pz, start, done, sekundy, hints, checks, ulozene;
let undoStack = [];
let redoStack = [];
let vybrana = -1;           // the burrow the pad and the keyboard write into
let poznamkyRezim = false;  // Notes: the pad writes the small numbers
let tikac = null;
let necinnost = null;
let pauza = false;
let tip = null;             // the hint on screen, cleared by the next move
let tipUkazany = false;
let odhalene = false;       // Check's second step is showing the wrong numbers
let checkStav = null;       // what the last Check saw, so the second press can reveal it
const bunky = [];           // the burrow elements, by cell index

/* ── Drawing ──────────────────────────────────────────────────────────── */
function suradnice(i) { return 'row ' + (((i / n) | 0) + 1) + ', column ' + ((i % n) + 1); }
function jeDane(i) { return !!zadanie.givens[i]; }

function postavMriezku() {
  document.documentElement.style.setProperty('--n', n);
  doska.setAttribute('aria-label', 'Meadow grid ' + n + ' by ' + n);
  doska.textContent = '';
  bunky.length = 0;
  const frag = document.createDocumentFragment();
  for (let r = 0; r < n; r++) {
    const riadok = document.createElement('div');
    riadok.className = 'riadok';
    riadok.setAttribute('role', 'row');
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const b = document.createElement('button');
      b.type = 'button';
      // The two lines a burrow draws: none at the outer edge, a thick one at a
      // block edge, a thin one everywhere else.
      const l = c === 0 ? ' l0' : c % J.bw === 0 ? ' l2' : '';
      const t = r === 0 ? ' t0' : r % J.bh === 0 ? ' t2' : '';
      b.className = 'b' + l + t + (zadanie.givens[i] ? ' dane' : '');
      b.dataset.i = i;
      b.dataset.v = '0';
      b.setAttribute('role', 'gridcell');
      b.tabIndex = -1;
      const cif = document.createElement('span');
      cif.className = 'cif';
      b.appendChild(cif);
      const p = document.createElement('span');
      p.className = 'pozn';
      for (let d = 1; d <= n; d++) { const s = document.createElement('i'); s.textContent = d; p.appendChild(s); }
      b.appendChild(p);
      riadok.appendChild(b);
      bunky.push(b);
    }
    frag.appendChild(riadok);
  }
  doska.appendChild(frag);
  bunky[0].tabIndex = 0;
  merajBunku();
  popisZadania();
}
/* The pad carries as many keys as the meadow has numbers, six on Monday and
 * nine from Wednesday, plus the one that empties a burrow. */
function postavPad() {
  if (!padEl) return;
  padEl.style.setProperty('--pad', n + 1);
  padEl.textContent = '';
  for (let d = 1; d <= n; d++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.d = d;
    b.textContent = d;
    padEl.appendChild(b);
  }
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'zmaz';
  del.dataset.d = 0;
  del.textContent = 'Del';
  del.setAttribute('aria-label', 'Empty the burrow');
  padEl.appendChild(del);
}
/* Every number on the board is drawn from --cell, the measured width of one
 * burrow, so a nine by nine on a phone reads the same way as a six by six on
 * a desktop. */
function merajBunku() {
  const w = doska.clientWidth;
  if (w > 0 && n) doska.style.setProperty('--cell', (w / n) + 'px');
}
if (window.ResizeObserver) new ResizeObserver(merajBunku).observe(doska);
else window.addEventListener('resize', merajBunku);

/* The numbers the meadow starts with, as plain text for a screen reader: the
 * grid itself only tells the shape, not what it already holds. */
function popisZadania() {
  if (!cislaText) return;
  const casti = [];
  let dane = 0;
  for (let r = 0; r < n; r++) {
    const kus = [];
    for (let c = 0; c < n; c++) { const d = zadanie.givens[r * n + c]; if (d) { kus.push(d + ' in column ' + (c + 1)); dane++; } }
    if (kus.length) casti.push('Row ' + (r + 1) + ': ' + kus.join(', '));
  }
  const extra = rules.king ? ' Today both the knight leap rule and the touching rule are on.' : ' Today the knight leap rule is on.';
  cislaText.textContent = 'The meadow, ' + n + ' by ' + n + ', with ' + dane + ' numbers given.' + extra + ' ' + casti.join('. ') + '.';
}
function ukazBunku(i) {
  const b = bunky[i];
  if (!b) return;
  const val = v[i] || 0;
  b.dataset.v = String(val);
  b.firstChild.textContent = val ? String(val) : '';
  const noty = b.querySelector('.pozn').children;
  for (let d = 1; d <= n; d++) noty[d - 1].classList.toggle('on', !val && !!(pz[i] & (1 << d)));
  const zoznam = [];
  if (!val) for (let d = 1; d <= n; d++) if (pz[i] & (1 << d)) zoznam.push(d);
  b.setAttribute('aria-label', suradnice(i) + ', ' + (val ? (jeDane(i) ? val + ', given' : String(val)) : zoznam.length ? 'empty, noted ' + zoznam.join(' ') : 'empty'));
}
/* A soft visual cue only, not a judgement: a row, a column or a block that is
 * full and uses no number twice goes quiet. It says nothing about whether the
 * numbers are RIGHT (Andrej, 10. 9.: nothing turns red while playing; only
 * Check judges). */
function oznacSplnene() {
  const tichych = new Uint8Array(n * n);
  for (const u of J.units) {
    let m = 0, ok = true;
    for (const i of u.cells) {
      const d = v[i];
      if (!(d >= 1 && d <= n) || (m & (1 << d))) { ok = false; break; }
      m |= 1 << d;
    }
    if (ok) for (const i of u.cells) tichych[i]++;
  }
  // A finished row, column or block quietens all of its own burrows, which is
  // what the player sees: the line they just closed steps back.
  for (let i = 0; i < n * n; i++) bunky[i].classList.toggle('stlmena', tichych[i] > 0);
}
/* The picked burrow, its row, column and block, what a hare can reach from it,
 * and (when the setting is on) every burrow that holds the same number. */
function oznacVyber() {
  for (const b of bunky) b.classList.remove('vybrana', 'jednotka', 'rovnaka', 'dosah');
  if (vybrana < 0 || !bunky[vybrana]) return;
  for (const ui of J.unitOf[vybrana]) for (const i of J.units[ui].cells) bunky[i].classList.add('jednotka');
  if (nastavenia.dosah) {
    for (const i of J.skok[vybrana]) bunky[i].classList.add('dosah');
    for (const i of J.kral[vybrana]) bunky[i].classList.add('dosah');
  }
  if (nastavenia.zvyrazniRovnake && v[vybrana]) {
    for (let i = 0; i < n * n; i++) if (v[i] === v[vybrana]) bunky[i].classList.add('rovnaka');
  }
  bunky[vybrana].classList.add('vybrana');
}
/* A number that already sits in every burrow it can have is spent; the key
 * goes quiet but keeps working, in case one of them has to come back out. */
function ukazPad() {
  if (!padEl) return;
  const pocty = new Array(n + 1).fill(0);
  for (let i = 0; i < n * n; i++) if (v[i]) pocty[v[i]]++;
  padEl.querySelectorAll('button[data-d]').forEach((b) => {
    const d = +b.dataset.d;
    b.classList.toggle('hotova', !!d && pocty[d] >= n);
  });
}
function ukazVsetko() {
  for (let i = 0; i < n * n; i++) ukazBunku(i);
  oznacSplnene();
  oznacVyber();
  ukazPad();
}
function zmazTip() {
  if (!tip) return;
  tip = null; tipUkazany = false;
  for (const b of bunky) b.classList.remove('tip', 'tip-jednotka');
  if (hintBtn) hintBtn.textContent = 'Hint';
}
function zmazOdhalenie() {
  if (!odhalene && !checkStav) return;
  odhalene = false; checkStav = null;
  for (const b of bunky) b.classList.remove('chyba');
  if (checkBtn) checkBtn.textContent = 'Check';
}
/* Live check is off by default; when it is on, a wrong number is marked as
 * soon as it is written, with a frame and a mark, not by colour alone. */
function zivaKontrola() {
  if (!nastavenia.zivaKontrola || done || !zadanie) return;
  const p = porovnaj(v, zadanie.solution);
  for (const i of p.zle) bunky[i].classList.add('chyba');
}

/* ── What still fits in a burrow ──────────────────────────────────────── *
 * Used by Auto notes: a number fits when no burrow that this one must differ
 * from already holds it. That is the whole reading a person does here, the
 * row, the column, the block, the knight leaps and, on the king days, the
 * touching burrows, all in one list (generator.mjs, jadro().peers). */
function moznostiBunky(i) {
  let m = 0;
  for (let d = 1; d <= n; d++) m |= 1 << d;
  const p = J.peers[i];
  for (let k = 0; k < p.length; k++) { const d = v[p[k]]; if (d) m &= ~(1 << d); }
  return m;
}
function doplnPoznamky() {
  for (let i = 0; i < n * n; i++) pz[i] = v[i] ? 0 : moznostiBunky(i);
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
  if (pauzaCas) pauzaCas.textContent = sekundy ? 'You have spent ' + slovaCas(sekundy) + ' so far.' : 'Your numbers are kept; the clock continues when you resume.';
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
/* Jeden zmeškaný deň po piatich výhrach séria odpustí, najviac dva razy za
 * mesiac (ops/spec-hry-ux.md, časť 8). Odpustenie sa minie až vtedy, keď hráč
 * po vynechanom dni naozaj vyrieši; do záznamu sa ukladá mesiac a počet
 * odpustení v ňom, takže nový mesiac začína znova s dvoma. */
const ODPUSTENI_ZA_MESIAC = 2;
function odpusteniVMesiaci(s, den) {
  return s && s.odpusteneMesiac === den.slice(0, 7) ? (s.odpustene || 0) : 0;
}
function odpustitVieme(s, den) {
  if (!s || s.pocet < 5) return false;
  if (s.posledny !== posunDen(den, -2)) return false;   // presne jeden vynechaný deň
  return odpusteniVMesiaci(s, den) < ODPUSTENI_ZA_MESIAC;
}
/* Jeden krok série: k záznamu `s` pridá vyriešený deň `den`. Rovnaké pravidlo
 * používa zápis po vyriešení aj prepočet po zlúčení s účtom, takže sa tie dve
 * cesty nemôžu rozísť. */
function krokSerie(s, den) {
  const odpustene = odpusteniVMesiaci(s, den);
  let pocet = 1, minute = 0;
  if (s.posledny === posunDen(den, -1)) pocet = s.pocet + 1;
  else if (odpustitVieme(s, den)) { pocet = s.pocet + 1; minute = 1; }
  return { posledny: den, pocet, odpusteneMesiac: den.slice(0, 7), odpustene: odpustene + minute };
}
function ukazSeriu() {
  if (!seriaEl) return;
  const s = nacitaj('hares:streak');
  if (!s || !s.pocet) { seriaEl.textContent = ''; return; }
  const ziva = s.posledny === dnes || s.posledny === posunDen(dnes, -1);
  const odpustime = !ziva && odpustitVieme(s, dnes);
  if (!ziva && !odpustime) { seriaEl.textContent = ''; return; }
  seriaEl.textContent = 'Streak: ' + s.pocet + (s.pocet === 1 ? ' day' : ' days')
    + (odpustime ? ', one missed day forgiven if you solve today' : '');
}
function zapisSeriu() {
  // Only a meadow solved on its own day counts: the archive is for practice.
  if (!jeDnes) return;
  const s = nacitaj('hares:streak') || { posledny: null, pocet: 0 };
  if (s.posledny === datum) return;
  uloz('hares:streak', krokSerie(s, datum));
}
/* Every solved day in this browser, newest first. */
function historiaDni() {
  const out = [];
  for (const k of vsetkyKluce('hares:')) {
    const d = k.slice('hares:'.length);
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
    + (best ? ', best ' + formatCas(best.sec) + ' on ' + kratkyDatum(best.d) : '') + (priemer ? ', average ' + formatCas(priemer) : '') + '. <a href="/games/hares/archive/">Archive and full history</a>.';
}

/* ── Saving and solving ───────────────────────────────────────────────── */
/* `z` is how many numbers the player wrote themselves. The saved board holds
 * the given numbers as well, so without it the week strip could not tell an
 * untouched meadow from one somebody had started. */
function ulozStav() { uloz(KLUC, { v, p: pz, z: napisaneHracom(), sec: sekundy, start, done, hints, checks, t: Date.now() }); naplanujOdoslanie(); }

function napisaneHracom() {
  let k = 0;
  for (let i = 0; i < n * n; i++) if (v[i] && !jeDane(i)) k++;
  return k;
}
function ukazStav() {
  oznacSplnene();
  stavEl.classList.toggle('ok', !!done);
  if (zdielanieEl) zdielanieEl.hidden = !done;   // Share only after the meadow is finished
  if (done) {
    const s = sekundy ? ' in ' + formatCas(sekundy) : '';
    const pomoc = [];
    if (hints) pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
    if (checks) pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
    const hn = pomoc.length ? ' with ' + pomoc.join(' and ') : ' without a hint or a check';
    stavEl.innerHTML = '<b>Solved</b>' + s + hn + '. ' + (pomoc.length ? 'The hares have their meadow.' : 'A clean meadow: the hares are impressed.')
      + (jeDnes ? ' A new meadow arrives at midnight, Bratislava time.' : '');
    return;
  }
  if (!napisaneHracom()) { stavEl.textContent = 'Pick a burrow, then a number from the pad.'; return; }
  let prazdne = 0;
  for (let i = 0; i < n * n; i++) if (!v[i]) prazdne++;
  if (!prazdne) { stavEl.textContent = 'Every burrow holds a number, but the meadow is not right yet. Check shows where.'; return; }
  stavEl.textContent = '';
}

/* ── Share ────────────────────────────────────────────────────────────── *
 * A voluntary step after the meadow is finished (ops/spec-hry-ux.md, part 8).
 * The text carries which meadow it was, the time, the hints and checks used
 * and the shape of what was given, with not one number in it, so it cannot
 * spoil the puzzle for whoever reads it. Nothing is sent anywhere; the text
 * only goes to the clipboard, and when the browser refuses that, into a box
 * the player can copy by hand. */
const ZNAK_DANE = '\u{1F7EB}';    // hneda kocka: burrow the meadow gave away
const ZNAK_PRAZDNE = '\u{2B1C}';  // biela kocka: burrow the player filled in
function odkazNaLuku() {
  const b = 'https://arling.sk/games/hares/';
  if (rezim === 'cvicenie') return b + 'practice/' + sada + '/' + (kSada === 1 ? '' : kSada + '/');
  return jeDnes ? b : b + datum + '/';
}
function textNaZdielanie() {
  const riadky = [];
  for (let r = 0; r < n; r++) {
    let s = '';
    for (let c = 0; c < n; c++) s += zadanie.givens[r * n + c] ? ZNAK_DANE : ZNAK_PRAZDNE;
    riadky.push(s);
  }
  const kto = rezim === 'cvicenie' ? 'Hares practice ' + sada + ', meadow ' + kSada : 'Hares ' + datum;
  const pomoc = [];
  if (hints) pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
  if (checks) pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
  return kto + ' · ' + UROVNE[zadanie.uroven].label + (rules.king ? ', knight and touch' : ', knight') + '\n'
    + riadky.join('\n') + '\n'
    + 'Solved' + (sekundy ? ' in ' + formatCas(sekundy) : '') + (pomoc.length ? ' with ' + pomoc.join(' and ') : ', clean: no hint, no check') + '\n'
    + odkazNaLuku();
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
    ? 'Copied. It says nothing about the numbers, and nothing was sent anywhere.'
    : 'This browser would not let the page copy for you. Here is the text, take it from the box.';
  if (zdielanieText) {
    zdielanieText.value = text;
    zdielanieText.hidden = ok;
    if (!ok) { zdielanieText.focus(); zdielanieText.select(); }
  }
  track('game_share', { game: 'hares', copied: ok, level: zadanie.uroven });
});

/* ── Check, in two steps ──────────────────────────────────────────────── *
 * The first press says how many numbers are wrong and in which rows; only the
 * second press marks them. The puzzle stays a puzzle unless you ask twice.
 * When a burrow is picked, only its row, its column and its block are checked,
 * which is how a crossword checks one word; with no burrow picked, the whole
 * meadow (ops/spec-hry-ux.md, part 4). The narrowing holds even when the
 * player has written nothing in that row, column or block yet: Check then says
 * so and names the scope, instead of quietly judging the whole meadow the
 * player did not ask about. */
function rozsahCheck() {
  if (vybrana < 0) return { cells: null, kde: '' };
  const set = new Set();
  for (const ui of J.unitOf[vybrana]) for (const i of J.units[ui].cells) set.add(i);
  return { cells: [...set], kde: ' in the row, the column and the block of the burrow you picked' };
}
function skontrolujStav() {
  if (done || pauza) return;
  const r = rozsahCheck();
  const p = porovnaj(v, zadanie.solution);
  const zle = r.cells ? p.zle.filter((i) => r.cells.includes(i)) : p.zle;
  const napisane = r.cells ? r.cells.filter((i) => v[i] && !jeDane(i)).length : napisaneHracom();
  if (!napisane) {
    stavEl.textContent = r.cells
      ? 'Nothing written down yet' + r.kde + '. Press Escape to let the burrow go, then Check reads the whole meadow.'
      : 'Nothing written down yet.';
    return;
  }
  checks++;
  ulozStav();
  if (!zle.length) {
    zmazOdhalenie();
    stavEl.textContent = 'Everything right so far' + r.kde + ': ' + napisane + (napisane === 1 ? ' number' : ' numbers') + ' and not one of them wrong.';
    track('game_check', { game: 'hares', wrong: 0 });
    return;
  }
  if (checkStav && !odhalene) {
    odhalene = true;
    for (const i of zle) bunky[i].classList.add('chyba');
    stavEl.textContent = 'The marked ' + (zle.length === 1 ? 'burrow does' : 'burrows do') + ' not hold ' + (zle.length === 1 ? 'that number' : 'those numbers') + ' in the finished meadow. Take them out and keep going.';
    checkBtn.textContent = 'Check';
    track('game_check', { game: 'hares', wrong: zle.length, revealed: true });
    return;
  }
  // The rough area may be a row or a column (ops/spec-hry-ux.md, part 4); we
  // name whichever side needs fewer of them, so mistakes stacked in one column
  // are told as that one column instead of four separate rows.
  const riadky = [], stlpce = [];
  for (const i of zle) {
    const rr = ((i / n) | 0) + 1, cc = (i % n) + 1;
    if (!riadky.includes(rr)) riadky.push(rr);
    if (!stlpce.includes(cc)) stlpce.push(cc);
  }
  const poRiadkoch = riadky.length <= stlpce.length;
  const kde = (poRiadkoch ? riadky : stlpce).sort((a, b) => a - b).map((k) => (poRiadkoch ? 'row ' : 'column ') + k);
  checkStav = { zle: zle.length };
  stavEl.textContent = 'There ' + (zle.length === 1 ? 'is 1 number that is wrong' : 'are ' + zle.length + ' numbers that are wrong') + r.kde
    + ', in ' + zoznamSlov(kde.slice(0, 4)) + (kde.length > 4 ? ' and elsewhere' : '') + '. Press Check again to show where.';
  checkBtn.textContent = 'Show';
  track('game_check', { game: 'hares', wrong: zle.length, revealed: false });
}

/* ── Hint, in two steps ───────────────────────────────────────────────── *
 * The first press names the rule and the place and outlines the row, the
 * column and the block it reads, without saying what goes there; the second
 * press writes that one number and explains it in full (the sentence comes
 * from the solver itself, logika.mjs). Every hint is counted and shown at the
 * end. */
const VETY = {
  'wrong-number': (kde) => 'There is a number at ' + kde + ' that the finished meadow does not have there. Take it out before going on.',
  'naked-single': (kde) => 'Its row, its column, its block and the hares within reach leave the burrow at ' + kde + ' only one number.',
  'naked-single-leap': (kde) => 'The burrow at ' + kde + ' has one number left, and it is a knight’s leap that takes the last of the others away.',
  'naked-single-marks': (kde) => 'Once every number already on the board is taken out, the burrow at ' + kde + ' has a single one left.',
  'hidden-single': (kde) => 'A number that one row, column or block still owes fits only the burrow at ' + kde + '.',
  'hidden-single-leap': (kde) => 'A number one row, column or block still owes fits only ' + kde + ' once the knight’s leaps are counted in.',
  'hidden-single-marks': (kde) => 'A number missing from one row, column or block has just one burrow left for it, at ' + kde + '.',
  'pair': (kde) => 'Two burrows nearby hold two numbers between them, which takes those numbers away from ' + kde + '.',
  'pointing': (kde) => 'Inside one block a number is confined to a single line, and that settles the burrow at ' + kde + '.',
  'trial': (kde) => 'Write in each number the burrow at ' + kde + ' still allows and follow it one step: all but one run into a contradiction.',
  'reveal': (kde) => 'No named rule reaches from here, so this hint simply opens ' + kde + '.',
};
function ukazNapovedu() {
  if (done || pauza) return;
  if (tip && tipUkazany) {
    // second press: write it
    const t = tip;
    hints++;   // counted before the move, so the save inside it carries the new number
    const zmenilo = zmenaStavu(() => {
      for (const x of t.bunky) {
        v[x.i] = x.val;
        pz[x.i] = 0;
        if (x.val) vyskrtniPoznamky(x.i, x.val);
      }
      if (nastavenia.autoPoznamky) doplnPoznamky();
    });
    const text = t.text;
    zmazTip(); zmazOdhalenie();
    track('game_hint', { game: 'hares', rule: t.pravidlo, layer: t.vrstva, applied: true });
    if (!zmenilo) { ulozStav(); ukazStav(); }
    if (!done) stavEl.textContent = text;
    return;
  }
  const h = napoveda(v, zadanie.givens, zadanie.solution, n, rules);
  if (!h) return;
  tip = h; tipUkazany = true;
  const i = h.bunky[0].i;
  for (const ui of J.unitOf[i]) for (const j of J.units[ui].cells) bunky[j].classList.add('tip-jednotka');
  for (const x of h.bunky) bunky[x.i].classList.add('tip');
  zameraj(i, false);
  const veta = VETY[h.pravidlo] || VETY.reveal;
  stavEl.textContent = veta(suradnice(i)) + ' Press Hint again to write it in.';
  hintBtn.textContent = 'Write it';
  track('game_hint', { game: 'hares', rule: h.pravidlo, layer: h.vrstva, applied: false });
}

function skontroluj() {
  if (!jeVyriesene(v, n, rules)) return false;
  sekundy = ubehnute();
  done = Date.now();
  start = null;
  zastavTikac();
  nastavNecinnost();
  doska.classList.add('hotovo');
  zmazTip(); zmazOdhalenie();
  vybrana = -1;              // the finished meadow is green all over, not one picked burrow
  oznacVyber();
  ukazCas();
  zapisSeriu();
  ukazSeriu();
  ulozStav();
  ukazHistoriu();
  ukazPasik();
  track('game_solved', { game: 'hares', day: rezim === 'den' ? datum : sada + '/' + kSada, seconds: sekundy, hints, checks, level: zadanie.uroven });
  return true;
}

/* ── Moves ────────────────────────────────────────────────────────────── *
 * Every change to the board goes through zmenaStavu: it keeps the whole board
 * before and after, so Undo and Redo are one shared stack with no limit and
 * Clear is undone by a single Undo (ops/spec-hry-ux.md, part 3). */
function ukazTlacidla() {
  if (spatBtn) spatBtn.disabled = !undoStack.length || !!done;
  if (znovaBtn) znovaBtn.disabled = !redoStack.length || !!done;
  if (poznamkyBtn) poznamkyBtn.setAttribute('aria-pressed', poznamkyRezim ? 'true' : 'false');
  if (hraEl) hraEl.classList.toggle('poznamky', poznamkyRezim);
}
function rovnake(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function zmenaStavu(fn) {
  if (done || pauza) return false;
  const pred = { v: v.slice(), p: pz.slice() };
  fn();
  if (rovnake(v, pred.v) && rovnake(pz, pred.p)) return false;
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
/* Writing a number takes it out of the notes of every burrow it now rules
 * out: the row, the column, the block, the knight leaps and, on the king
 * days, the burrows touching it (ops/spec-hry-ux.md, part 2). */
function vyskrtniPoznamky(i, d) {
  const p = J.peers[i];
  for (let k = 0; k < p.length; k++) pz[p[k]] &= ~(1 << d);
}
function nastav(i, d) {
  if (done || pauza || i < 0 || i >= n * n || jeDane(i)) return;
  if (v[i] === d && !pz[i]) return;
  zmenaStavu(() => {
    v[i] = d;
    pz[i] = 0;              // a number and its notes go together
    if (d) vyskrtniPoznamky(i, d);
    if (nastavenia.autoPoznamky) doplnPoznamky();
  });
}
function prepniPoznamku(i, d) {
  if (done || pauza || i < 0 || i >= n * n || jeDane(i) || !d) return;
  zmenaStavu(() => { v[i] = 0; pz[i] ^= 1 << d; });
}
/* The pad and the keyboard write the same way: the same number again takes it
 * back, so the way to an empty burrow is always one tap (part 1). */
function zapis(d) {
  if (vybrana < 0) return;
  if (jeDane(vybrana)) { stavEl.textContent = 'That number came with the meadow, it stays where it is.'; return; }
  if (!d) { nastav(vybrana, 0); return; }
  if (poznamkyRezim) { prepniPoznamku(vybrana, d); return; }
  nastav(vybrana, v[vybrana] === d ? 0 : d);
}
/* Ten istý zápis s otočeným režimom. Shift plus cifra a dlhé podržanie cifry
 * na pade robia to isté: v Notes mode zapíšu skutočnú hodnotu, mimo neho
 * poznámku, a režim pritom neprepnú (ops/spec-hry-ux.md, časti 1 a 2).
 * Dané políčko vysvetlí, prečo sa nedá prepísať, presne ako zapis(), a vráti
 * false, aby volajúci nehlásil úspech, ktorý sa nestal. */
function zapisOpacne(d) {
  if (vybrana < 0 || !d) return false;
  if (jeDane(vybrana)) { stavEl.textContent = 'That number came with the meadow, it stays where it is.'; return false; }
  if (poznamkyRezim) nastav(vybrana, v[vybrana] === d ? 0 : d);
  else prepniPoznamku(vybrana, d);
  return true;
}

function spat() {
  if (done || pauza || !undoStack.length) return;
  redoStack.push({ v: v.slice(), p: pz.slice() });
  const s = undoStack.pop();
  v = s.v; pz = s.p;
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) { ulozStav(); zivaKontrola(); }
  ukazStav();
  ukazTlacidla();
}
function znova() {
  if (done || pauza || !redoStack.length) return;
  undoStack.push({ v: v.slice(), p: pz.slice() });
  const s = redoStack.pop();
  v = s.v; pz = s.p;
  zmazTip(); zmazOdhalenie();
  ukazVsetko();
  if (!skontroluj()) { ulozStav(); zivaKontrola(); }
  ukazStav();
  ukazTlacidla();
}
/* Clear: the meadow goes back to the numbers it was given, the clock keeps
 * running (Andrej, 10. 9.: clearing is a move, not a restart). One Undo
 * brings every number back. */
function prazdnaPlocha() { return zadanie.givens.slice(); }
function reset() {
  if (done || pauza) return;
  if (!napisaneHracom() && pz.every((x) => !x)) return;
  if (nastavenia.potvrditReset && !window.confirm('Clear the whole meadow? The clock keeps running and one Undo brings your numbers back.')) return;
  zmenaStavu(() => { v = prazdnaPlocha(); pz = new Array(n * n).fill(0); });
}

/* ── Pointer ──────────────────────────────────────────────────────────── *
 * A tap picks a burrow. A drag that starts on a burrow which already holds a
 * number writes that same number into the empty burrows it runs over, and
 * touches nothing that is already written (ops/spec-hry-ux.md, pattern A). */
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
  tah = { start: i, maloval: false, hodnota: v[i] || 0, id: e.pointerId };
  try { doska.setPointerCapture(e.pointerId); } catch (err) { /* works without capture too, less smoothly */ }
  e.preventDefault();
});
doska.addEventListener('pointermove', (e) => {
  if (!tah || tah.id !== e.pointerId || done || pauza || !tah.hodnota) return;
  const i = bunkaPod(e);
  if (i < 0 || i === tah.start) return;
  tah.maloval = true;
  if (!v[i]) nastav(i, tah.hodnota);
});
function koniecTahu(e) {
  if (!tah || tah.id !== e.pointerId) return;
  tah = null;
  try { doska.releasePointerCapture(e.pointerId); } catch (err) { /* nothing */ }
}
doska.addEventListener('pointerup', koniecTahu);
doska.addEventListener('pointercancel', (e) => { if (tah && tah.id === e.pointerId) tah = null; });
/* Tab into the board and the burrow that takes the focus is the picked one. */
doska.addEventListener('focusin', (e) => {
  const b = e.target && e.target.closest ? e.target.closest('.b') : null;
  if (!b) return;
  const i = +b.dataset.i;
  if (i !== vybrana) { vybrana = i; oznacVyber(); }
});

/* ── Keyboard ─────────────────────────────────────────────────────────── *
 * Arrows walk from burrow to burrow, the number keys write, Shift plus a
 * number writes a note without leaving the pad, N or Enter switches notes,
 * Delete empties the burrow, Escape lets it go (pattern A). */
function zameraj(i, fokus) {
  if (i < 0 || i >= n * n) return;
  for (const b of bunky) b.tabIndex = -1;
  vybrana = i;
  bunky[i].tabIndex = 0;
  if (fokus) bunky[i].focus({ preventScroll: true });
  oznacVyber();
}
doska.addEventListener('keydown', (e) => {
  if (done || pauza) return;
  const i = vybrana;
  if (i < 0) return;
  const r = (i / n) | 0, c = i % n;
  let ciel = -1;
  switch (e.key) {
    case 'ArrowUp': ciel = ((r + n - 1) % n) * n + c; break;
    case 'ArrowDown': ciel = ((r + 1) % n) * n + c; break;
    case 'ArrowLeft': ciel = r * n + ((c + n - 1) % n); break;
    case 'ArrowRight': ciel = r * n + ((c + 1) % n); break;
    case 'Home': ciel = r * n; break;
    case 'End': ciel = r * n + (n - 1); break;
    case 'Enter': case 'n': case 'N':
      poznamkyRezim = !poznamkyRezim; ukazTlacidla(); e.preventDefault(); return;
    case 'Escape':
      { const b = bunky[i]; vybrana = -1; oznacVyber(); if (b) b.blur(); e.preventDefault(); }
      return;
    case 'Delete': case 'Backspace': case '0':
      if (nastavenia.lenPad) return;   // Onscreen input only: the pad writes, the keyboard does not
      zapis(0); e.preventDefault(); return;
    case ' ':
      e.preventDefault(); return;
    default:
      if (e.key >= '1' && e.key <= String(n)) {
        if (nastavenia.lenPad) return;
        const d = +e.key;
        if (e.shiftKey) zapisOpacne(d); else zapis(d);
        e.preventDefault();
      }
      return;
  }
  e.preventDefault();
  if (ciel >= 0) zameraj(ciel, true);
});
/* Dlhé podržanie cifry na pade. Na dotyku niet klávesy Shift, takže podržanie
 * je jediný ekvivalent Shift plus cifra: v Notes mode zapíše skutočnú hodnotu,
 * mimo neho poznámku (ops/spec-hry-ux.md, časť 2). Nie je to jediná cesta
 * k ničomu, režim prepne tlačidlo Notes jedným tapom (časť 9). */
const DRZANIE_MS = 500;
let padCasovac = 0;
let padDrzane = null;   // tlačidlo, ktoré práve drží prst alebo myš
let padDlhe = false;    // podržanie už zapísalo, nasledujúci click sa zahodí
function ukonciDrzanie() {
  if (padCasovac) { clearTimeout(padCasovac); padCasovac = 0; }
  if (padDrzane) { padDrzane.classList.remove('drzane'); padDrzane = null; }
}
padEl.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('button[data-d]');
  ukonciDrzanie();
  padDlhe = false;
  if (!b || done || pauza) return;
  const d = +b.dataset.d;
  if (!d) return;                 // Del nemá čo otáčať
  padDrzane = b;
  b.classList.add('drzane');
  padCasovac = setTimeout(() => {
    padCasovac = 0;
    padDlhe = true;
    ukonciDrzanie();
    if (done || pauza) return;
    if (vybrana < 0) { stavEl.textContent = 'Pick a burrow first, then hold a number.'; return; }
    // Hlásenie až po skutočnom zápise: na danom políčku zapisOpacne nič
    // nenapíše a samo povie prečo.
    if (!zapisOpacne(d)) return;
    stavEl.textContent = poznamkyRezim
      ? 'Held: written as a number, not a note.'
      : 'Held: written as a note, not a number.';
  }, DRZANIE_MS);
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) padEl.addEventListener(ev, ukonciDrzanie);
// Prst zišiel z tlačidla, na ktorom začal: podržanie sa ruší, nezapíše cudziu cifru
padEl.addEventListener('pointermove', (e) => {
  if (padDrzane && e.target.closest('button[data-d]') !== padDrzane) ukonciDrzanie();
});
padEl.addEventListener('contextmenu', (e) => { if (e.target.closest('button[data-d]')) e.preventDefault(); });
padEl.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-d]');
  if (!b) return;
  if (padDlhe) { padDlhe = false; return; }   // podržanie už zapísalo
  if (vybrana < 0) { stavEl.textContent = 'Pick a burrow first, then a number.'; return; }
  zapis(+b.dataset.d);
});
/* Tlačidlo Notes vráti fókus na vybrané políčko: kto prepne režim myšou a
 * potom píše z klávesnice, nemá o cifry prísť (cifry počúva plocha). */
if (poznamkyBtn) poznamkyBtn.addEventListener('click', () => {
  poznamkyRezim = !poznamkyRezim; ukazTlacidla();
  if (vybrana >= 0) bunky[vybrana].focus({ preventScroll: true });
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

/* ── The week strip ───────────────────────────────────────────────────── *
 * A finished meadow has two marks (ops/spec-hry-ux.md, part 8): solved, and
 * solved clean with no hint and no check. The clean one adds the class
 * `ciste` (a dot in the corner, so the difference is a shape and not only a
 * colour) and says so in the aria-label as well. */
function zacatePole(st) {
  if (!st) return false;
  return !!(st.z || (Array.isArray(st.p) && st.p.some((x) => x)));
}
function triedaStavu(st) {
  if (st && st.done) return st.hints || st.checks ? ' hotove' : ' hotove ciste';
  return zacatePole(st) ? ' rozohrane' : '';
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
      const st = nacitaj('hares:p:' + sada + ':' + k);
      const a = document.createElement(k === kSada ? 'span' : 'a');
      a.className = 'den' + (k === kSada ? ' dnes' : '') + triedaStavu(st);
      if (k !== kSada) a.href = '/games/hares/practice/' + sada + '/' + k + '/';
      a.innerHTML = '<small>No.</small><b>' + k + '</b>';
      a.setAttribute('aria-label', 'Meadow ' + k + slovoStavu(st));
      if (k === kSada) a.setAttribute('aria-current', 'page');
      pasik.appendChild(a);
    }
    return;
  }
  const dni = tyzden(datum);
  dni.forEach((d, k) => {
    const st = nacitaj('hares:' + d);
    const buduci = d > dnes, pred = d < PRVY_DEN;
    const tag = d === datum || buduci || pred ? 'span' : 'a';
    const a = document.createElement(tag);
    a.className = 'den' + (d === datum ? ' dnes' : '') + (buduci || pred ? ' buduci' : '') + triedaStavu(st);
    if (tag === 'a') a.href = '/games/hares/' + d + '/';
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
  if (!nastavenia.zivaKontrola && !odhalene) { for (const b of bunky) b.classList.remove('chyba'); }
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
    // Auto notes, switched on, fills the whole board at once: one move in the
    // history, exactly like any other (ops/spec-hry-ux.md, part 2).
    if (kluc === 'autoPoznamky' && el.checked && zadanie && !done && !pauza) zmenaStavu(doplnPoznamky);
    pouziNastavenia();
    track('game_setting', { game: 'hares', setting: kluc, on: el.checked });
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
  for (const k of vsetkyKluce('hares:')) {
    const d = k.slice('hares:'.length);
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
/* Po zlúčení s účtom sa séria počíta znova z vyriešených dní, od najstaršieho
 * a tým istým krokom ako pri hraní, takže odpustené dni prežijú aj prepočet.
 * Séria žije, kým je posledný vyriešený deň dnešok alebo včerajšok, prípadne
 * predvčerajšok s voľným odpustením. */
function prepocitajSeriu() {
  const dni = stavVsetkychDni();
  const hotove = Object.keys(dni).filter((d) => isValidDate(d) && d <= dnes && dni[d].done).sort();
  let s = { posledny: null, pocet: 0, odpusteneMesiac: null, odpustene: 0 };
  for (const d of hotove) s = krokSerie(s, d);
  const ziva = s.pocet && (s.posledny === dnes || s.posledny === posunDen(dnes, -1) || odpustitVieme(s, dnes));
  if (!ziva) { try { localStorage.removeItem('hares:streak'); } catch (e) { /* nič */ } return; }
  uloz('hares:streak', s);
}
function odosliStav() {
  if (!ucet.prihlaseny()) return;
  ucet.hra.uloz('hares', { dni: stavVsetkychDni(), t: Date.now() }).catch(() => { /* sieťová chyba: lokálne ostáva pravdou */ });
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
  try { vzdialene = await ucet.hra.nacitaj('hares'); } catch (e) { return; /* sieťová chyba: lokálne ostáva pravdou */ }
  const diaDni = vzdialene && vzdialene.dni && typeof vzdialene.dni === 'object' ? vzdialene.dni : {};
  let zmenene = false;
  for (const [d, r] of Object.entries(diaDni)) {
    if (!isValidDate(d) || !r || typeof r !== 'object') continue;
    const kluc = 'hares:' + d;
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
        v = obnovPole(cerstve.v);
        pz = Array.isArray(cerstve.p) && cerstve.p.length === n * n ? cerstve.p.slice() : new Array(n * n).fill(0);
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
  // push back too: a day solved only in this browser (or a done just merged in) reaches the account right away
  odosliStav();
}

/* ── Start ────────────────────────────────────────────────────────────── */
/* A saved board is trusted only where the puzzle leaves room: the given
 * numbers always come from the puzzle itself, so an old or damaged save can
 * never quietly change what the meadow started with. */
function obnovPole(ulozeneV) {
  const out = prazdnaPlocha();
  for (let i = 0; i < n * n; i++) {
    if (out[i]) continue;
    const d = ulozeneV[i];
    if (d >= 1 && d <= n) out[i] = d;
  }
  return out;
}
async function spusti() {
  if (jeBuduci) {
    datumEl.textContent = pekneDatum(datum);
    stavEl.textContent = 'This meadow opens on ' + pekneDatum(datum) + ' (Bratislava time). Come back then, or play today’s meadow.';
    doska.hidden = true;
    if (padEl) padEl.hidden = true;
    for (const b of [poznamkyBtn, spatBtn, znovaBtn, resetBtn, checkBtn, hintBtn]) if (b) b.disabled = true;
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
  rules = zadanie.rules;
  J = jadro(n, rules);
  ulozene = nacitaj(KLUC);
  v = (ulozene && Array.isArray(ulozene.v) && ulozene.v.length === n * n) ? obnovPole(ulozene.v) : prazdnaPlocha();
  pz = (ulozene && Array.isArray(ulozene.p) && ulozene.p.length === n * n) ? ulozene.p.slice() : new Array(n * n).fill(0);
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
  postavPad();
  ukazVsetko();
  pouziNastavenia();
  if (datumEl) datumEl.textContent = rezim === 'cvicenie' ? UROVNE[zadanie.uroven].label + ' practice ' + sada.split('-')[1] + ', meadow ' + kSada : pekneDatum(datum);
  if (urovenEl) urovenEl.textContent = UROVNE[zadanie.uroven].label + ' · ' + n + '×' + n + (rules.king ? ' · knight and touch' : ' · knight');
  if (done) doska.classList.add('hotovo');
  else if (napisaneHracom() || pz.some((x) => x)) pozastav(true);
  ukazCas();
  ukazSeriu();
  ukazHistoriu();
  ukazPasik();
  ukazStav();
  ukazTlacidla();
}
spusti().then(synchronizujUcet);
