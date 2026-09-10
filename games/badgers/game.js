/* Badgers: the game page. One script for the daily sett, the archive days and
 * the practice sets; the page says which one it is:
 *
 *   <body data-den="YYYY-MM-DD">          an archive day (built page)
 *   <body data-sada="easy-1" data-k="3">  a practice sett
 *   nothing                               today's sett (or ?d=YYYY-MM-DD)
 *
 * The puzzle itself comes, in this order: from <script type="application/json"
 * id="zadanie"> embedded in a built page; from dni/YYYY-MM.json for the day;
 * or, when both are missing, generated right here from the date. All three give
 * the same sett for the same date (plan.mjs, generator.mjs).
 *
 * The board is always drawn here from the puzzle, so a built page only has to
 * carry the packed puzzle for the browser and a line of text for readers
 * without JavaScript.
 *
 * The player's board is two flat n*n arrays:
 *   v   0 for an empty cell, 1 to n for a number written in it
 *   pz  the small notes as a bit mask (bit d means the note d is showing)
 *
 * Stored in localStorage (all in try/catch, private windows throw):
 *   badgers:YYYY-MM-DD     { v, p, sec, start, done, hints, checks, t }
 *   badgers:p:<set>:<k>    the same for a practice sett
 *   badgers:streak         { posledny: YYYY-MM-DD, pocet }
 *   badgers:nastavenia     the settings panel
 * sec = seconds spent before the current run, start = ms when the current run
 * began (null while paused or before the first move), done = ms of the solve,
 * hints and checks = help used, t = ms of the last save. The history line is
 * counted from the day records themselves, there is no separate one.
 * Outgoing events via window.umami, if it runs: game_solved, game_check,
 * game_hint, game_share, game_setting. Nothing else leaves the browser, unless
 * the player is signed in (arling.sk account, /style/ucet.js): then every
 * badgers:YYYY-MM-DD save is also pushed to the account (throttled, 2s) and
 * pulled back on load, so the streak and history follow across devices. Signed
 * out, nothing changes; a signed-in sync that fails over the network fails
 * silently, this browser's copy stays the truth.
 */
import { zadaniePreDen, zadanieCvicenie, rozbal, tyzden, urovenDna, posunDen, pekneDatum, kratkyDatum, UROVNE, SADY, PRVY_DEN, DNI } from './plan.mjs';
import { todayBratislava, isValidDate, jednotky, blokoveRozmery } from './generator.mjs';
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
const ohradyText = $('ohrady-text');

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
const NASTAVENIA_KLUC = 'badgers:nastavenia';
// Auto notes and Live check are off by default: the notes are the player's own,
// and nothing turns red while you play (Andrej, 10. 9.); Check is the only
// judge before the last cell is filled.
// lenPad = "Onscreen input only": the pad under the sett writes, the number
// keys of a physical keyboard do not (ops/spec-hry-ux.md, part 7). Arrows,
// Escape, Undo, Redo and Pause keep working, so the game stays reachable from
// the keyboard even with it on.
const NASTAVENIA_PREDVOLENE = { casovac: true, pauzaPriOdchode: true, zvyrazniRovnake: true, autoPoznamky: false, zivaKontrola: false, lenPad: false, potvrditReset: true };
let nastavenia = Object.assign({}, NASTAVENIA_PREDVOLENE, nacitaj(NASTAVENIA_KLUC) || {});
function ulozNastavenia() { uloz(NASTAVENIA_KLUC, nastavenia); }

/* ── Which sett ───────────────────────────────────────────────────────── */
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
const KLUC = rezim === 'cvicenie' ? 'badgers:p:' + sada + ':' + kSada : 'badgers:' + datum;
// The root address always opens today's sett; once the date is settled, rewrite
// it to today's built page so the address bar and a shared link point at the
// day itself (Andrej, 10. 9.). Only the plain root qualifies: a built archive
// day already names its date, a practice page its set, and a page opened with
// ?d= keeps that query untouched.
if (rezim === 'den' && !body.dataset.den && jeDnes && !location.search) {
  try { history.replaceState(null, '', '/games/badgers/' + datum + '/'); } catch (e) { /* the address stays generic; the game still works */ }
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

/* ── Loading the sett ─────────────────────────────────────────────────── */
function vlozene() {
  const el = $('zadanie');
  if (!el) return null;
  try { return rozbal(JSON.parse(el.textContent)); } catch (e) { return null; }
}
async function zTabulky(iso) {
  try {
    const r = await fetch('/games/badgers/dni/' + iso.slice(0, 7) + '.json', { cache: 'no-cache' });
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
let zadanie, n, v, pz, start, done, sekundy, hints, checks, ulozene;
let cages = [];             // { sum, cells }
let ohradaBunky = [];       // cage index by cell index
let jedn = [];              // rows, columns and blocks (generator.jednotky)
let bunkaJedn = [];         // the three unit indexes of every cell
let undoStack = [];
let redoStack = [];
let vybrana = -1;           // the cell the pad and the keyboard write into
let poznamkyRezim = false;  // Notes: the pad writes the small numbers
let tikac = null;
let necinnost = null;
let pauza = false;
let tip = null;             // the hint on screen, cleared by the next move
let tipUkazany = false;
let odhalene = false;       // Check's second step is showing the wrong numbers
let checkStav = null;       // what the last Check saw, so the second press can reveal it
const bunky = [];           // the cell elements, by cell index
const sucty = [];           // the total <span> of a cage, by its first cell index

/* ── Drawing ──────────────────────────────────────────────────────────── */
function suradnice(i) { return 'row ' + (((i / n) | 0) + 1) + ', column ' + ((i % n) + 1); }
/* Rows, columns, blocks and cages, worked out once from the puzzle so that
 * drawing, the notes and Check all read the same board. */
function pripravMriezku() {
  jedn = jednotky(n);
  bunkaJedn = new Array(n * n);
  for (let i = 0; i < n * n; i++) bunkaJedn[i] = [];
  jedn.forEach((u, k) => { for (const i of u.cells) bunkaJedn[i].push(k); });
  ohradaBunky = new Array(n * n).fill(-1);
  cages.forEach((cage, k) => { for (const i of cage.cells) ohradaBunky[i] = k; });
}
function postavMriezku() {
  const { vyska, sirka } = blokoveRozmery(n);
  document.documentElement.style.setProperty('--n', n);
  if (padEl) padEl.style.setProperty('--pad', n + 1);
  doska.setAttribute('aria-label', 'Badger grid ' + n + ' by ' + n);
  doska.textContent = '';
  bunky.length = 0; sucty.length = 0;
  const frag = document.createDocumentFragment();
  for (let r = 0; r < n; r++) {
    const riadok = document.createElement('div');
    riadok.className = 'riadok';
    riadok.setAttribute('role', 'row');
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const k = ohradaBunky[i];
      const cage = cages[k];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'b' + (r === 0 ? ' r0' : '') + (c === 0 ? ' c0' : '')
        + (r > 0 && r % vyska === 0 ? ' bt' : '') + (c > 0 && c % sirka === 0 ? ' bl' : '');
      b.dataset.i = i;
      b.dataset.v = '0';
      b.setAttribute('role', 'gridcell');
      b.tabIndex = -1;
      // the dotted outline: a side wherever the neighbour belongs to another cage
      const o = document.createElement('i');
      let strany = 'ohr';
      if (r === 0 || ohradaBunky[i - n] !== k) strany += ' ot';
      if (r === n - 1 || ohradaBunky[i + n] !== k) strany += ' ob';
      if (c === 0 || ohradaBunky[i - 1] !== k) strany += ' ol';
      if (c === n - 1 || ohradaBunky[i + 1] !== k) strany += ' or';
      o.className = strany;
      b.appendChild(o);
      if (cage && cage.cells[0] === i) {
        const s = document.createElement('span');
        s.className = 'sucet';
        s.textContent = cage.sum;
        b.appendChild(s);
        sucty[i] = s;
      }
      const cif = document.createElement('span');
      cif.className = 'cif';
      b.appendChild(cif);
      const p = document.createElement('span');
      p.className = 'pozn';
      for (let d = 1; d <= n; d++) { const t = document.createElement('i'); t.textContent = d; p.appendChild(t); }
      b.appendChild(p);
      riadok.appendChild(b);
      bunky.push(b);
    }
    frag.appendChild(riadok);
  }
  doska.appendChild(frag);
  if (padEl) for (const t of padEl.querySelectorAll('button[data-d]')) t.hidden = +t.dataset.d > n;
  bunky[0].tabIndex = 0;
  merajBunku();
  popisOhrad();
}
/* Every number on the board is drawn from --cell, the measured width of one
 * cell, so a nine by nine on a phone reads the same way as a six by six on a
 * desktop. */
function merajBunku() {
  const w = doska.clientWidth;
  if (w > 0 && n) doska.style.setProperty('--cell', (w / n) + 'px');
}
if (window.ResizeObserver) new ResizeObserver(merajBunku).observe(doska);
else window.addEventListener('resize', merajBunku);

/* The cages as plain text for a screen reader: the drawing itself only tells
 * the shape of the sett, not what it asks for. */
function popisOhrad() {
  if (!ohradyText) return;
  const casti = cages.map((cage) => cage.sum + ' in ' + cage.cells.length + (cage.cells.length === 1 ? ' cell from ' : ' cells from ') + suradnice(cage.cells[0]));
  ohradyText.textContent = 'The cages of the sett, ' + n + ' by ' + n + ', ' + cages.length + ' cages in all. ' + casti.join('. ') + '.';
}
function ukazBunku(i) {
  const b = bunky[i];
  if (!b) return;
  const val = v[i] || 0;
  b.dataset.v = String(val);
  b.querySelector('.cif').textContent = val ? String(val) : '';
  const noty = b.querySelector('.pozn').children;
  for (let d = 1; d <= n; d++) noty[d - 1].classList.toggle('on', !val && !!(pz[i] & (1 << d)));
  const zoznam = [];
  if (!val) for (let d = 1; d <= n; d++) if (pz[i] & (1 << d)) zoznam.push(d);
  const cage = cages[ohradaBunky[i]];
  b.setAttribute('aria-label', suradnice(i) + ', cage of ' + (cage ? cage.sum : '?') + ', ' + (val ? String(val) : zoznam.length ? 'empty, noted ' + zoznam.join(' ') : 'empty'));
}
/* A soft visual cue only, not a judgement: a cage whose cells are all filled,
 * add up to its total and use no number twice goes quiet. It says nothing about
 * whether the numbers are RIGHT (Andrej, 10. 9.: nothing turns red while
 * playing; only Check judges). */
function ohradaSplnena(cage) {
  let sum = 0, pouzite = 0;
  for (const i of cage.cells) {
    const d = v[i];
    if (!d) return false;
    if (pouzite & (1 << d)) return false;
    pouzite |= 1 << d;
    sum += d;
  }
  return sum === cage.sum;
}
function oznacSplnene() {
  for (const cage of cages) {
    const ok = ohradaSplnena(cage);
    for (const i of cage.cells) if (bunky[i]) bunky[i].classList.toggle('stlmena', ok);
  }
}
/* The picked cell, its row, column and block, and (when the setting is on)
 * every cell that holds the same number. */
function oznacVyber() {
  for (const b of bunky) if (b) b.classList.remove('vybrana', 'linia', 'rovnaka');
  if (vybrana < 0 || !bunky[vybrana]) return;
  for (const k of bunkaJedn[vybrana]) for (const i of jedn[k].cells) if (bunky[i]) bunky[i].classList.add('linia');
  if (nastavenia.zvyrazniRovnake && v[vybrana]) {
    for (let i = 0; i < n * n; i++) if (bunky[i] && v[i] === v[vybrana]) bunky[i].classList.add('rovnaka');
  }
  bunky[vybrana].classList.add('vybrana');
}
function ukazVsetko() {
  for (let i = 0; i < n * n; i++) ukazBunku(i);
  oznacSplnene();
  oznacVyber();
}
function zmazTip() {
  if (!tip) return;
  tip = null; tipUkazany = false;
  for (const b of bunky) if (b) b.classList.remove('tip', 'tip-ohrada');
  if (hintBtn) hintBtn.textContent = 'Hint';
}
function zmazOdhalenie() {
  if (!odhalene && !checkStav) return;
  odhalene = false; checkStav = null;
  for (const b of bunky) if (b) b.classList.remove('chyba');
  if (checkBtn) checkBtn.textContent = 'Check';
}
/* Live check is off by default; when it is on, a wrong number is marked as soon
 * as it is written, with a frame and a mark, not by colour alone. */
function zivaKontrola() {
  if (!nastavenia.zivaKontrola || done || !zadanie) return;
  const p = porovnaj(v, zadanie.solution);
  for (const i of p.zle) if (bunky[i]) bunky[i].classList.add('chyba');
}

/* ── What still fits in a cell ────────────────────────────────────────── *
 * Used by Auto notes: a number fits when the row, the column, the block and the
 * cage of the cell do not already hold it, and when what is left of the cage
 * total can still be made out of numbers the cage has not used. Honest but
 * plain: it is the same reading a person does, not the full solver. */
function medzeSuctu(pocet, pouzite) {
  let lo = 0, hi = 0, a = 0, b = 0;
  for (let d = 1; d <= n && a < pocet; d++) if (!(pouzite & (1 << d))) { lo += d; a++; }
  for (let d = n; d >= 1 && b < pocet; d--) if (!(pouzite & (1 << d))) { hi += d; b++; }
  return a < pocet || b < pocet ? null : { lo, hi };
}
function moznostiBunky(i) {
  let zakaz = 0;
  for (const k of bunkaJedn[i]) for (const j of jedn[k].cells) if (j !== i && v[j]) zakaz |= 1 << v[j];
  const cage = cages[ohradaBunky[i]];
  let sucet = 0, prazdne = 0, pouzite = 0;
  if (cage) {
    for (const j of cage.cells) {
      if (j === i) continue;
      if (v[j]) { pouzite |= 1 << v[j]; sucet += v[j]; } else prazdne++;
    }
  }
  zakaz |= pouzite;
  let m = 0;
  for (let d = 1; d <= n; d++) {
    if (zakaz & (1 << d)) continue;
    if (cage) {
      const zvysok = cage.sum - sucet - d;
      if (!prazdne) { if (zvysok !== 0) continue; }
      else {
        const g = medzeSuctu(prazdne, pouzite | (1 << d));
        if (!g || zvysok < g.lo || zvysok > g.hi) continue;
      }
    }
    m |= 1 << d;
  }
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
  const s = nacitaj('badgers:streak');
  if (!s || !s.pocet) { seriaEl.textContent = ''; return; }
  const ziva = s.posledny === dnes || s.posledny === posunDen(dnes, -1);
  const odpustime = !ziva && odpustitVieme(s, dnes);
  if (!ziva && !odpustime) { seriaEl.textContent = ''; return; }
  seriaEl.textContent = 'Streak: ' + s.pocet + (s.pocet === 1 ? ' day' : ' days')
    + (odpustime ? ', one missed day forgiven if you solve today' : '');
}
function zapisSeriu() {
  // Only a sett solved on its own day counts: the archive is for practice.
  if (!jeDnes) return;
  const s = nacitaj('badgers:streak') || { posledny: null, pocet: 0 };
  if (s.posledny === datum) return;
  uloz('badgers:streak', krokSerie(s, datum));
}
/* Every solved day in this browser, newest first. */
function historiaDni() {
  const out = [];
  for (const k of vsetkyKluce('badgers:')) {
    const d = k.slice('badgers:'.length);
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
  historiaEl.innerHTML = '<b>Your setts:</b> ' + h.length + ' solved' + (urovne ? ' (' + urovne + ')' : '') + (ciste ? ', ' + ciste + ' clean, with no hint and no check' : ', none clean yet')
    + (best ? ', best ' + formatCas(best.sec) + ' on ' + kratkyDatum(best.d) : '') + (priemer ? ', average ' + formatCas(priemer) : '') + '. <a href="/games/badgers/archive/">Archive and full history</a>.';
}

/* ── Saving and solving ───────────────────────────────────────────────── */
function ulozStav() { uloz(KLUC, { v, p: pz, sec: sekundy, start, done, hints, checks, t: Date.now() }); naplanujOdoslanie(); }

function ukazStav() {
  oznacSplnene();
  stavEl.classList.toggle('ok', !!done);
  if (zdielanieEl) zdielanieEl.hidden = !done;   // Share only after the sett is finished
  if (done) {
    const s = sekundy ? ' in ' + formatCas(sekundy) : '';
    const pomoc = [];
    if (hints) pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
    if (checks) pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
    const hn = pomoc.length ? ' with ' + pomoc.join(' and ') : ' without a hint or a check';
    stavEl.innerHTML = '<b>Solved</b>' + s + hn + '. ' + (pomoc.length ? 'The badgers have their sett in order.' : 'A clean sett: the badgers are impressed.')
      + (jeDnes ? ' A new sett arrives at midnight, Bratislava time.' : '');
    return;
  }
  const napisane = v.reduce((a, x) => a + (x ? 1 : 0), 0);
  if (!napisane) { stavEl.textContent = 'Pick a cell, then a number from the pad.'; return; }
  if (napisane === n * n) { stavEl.textContent = 'Every cell holds a number, but the sett is not right yet. Check shows where.'; return; }
  stavEl.textContent = '';
}

/* ── Share ────────────────────────────────────────────────────────────── *
 * A voluntary step after the sett is finished (ops/spec-hry-ux.md, part 8).
 * The text carries which sett it was, the time, the hints and checks used and
 * a map of where the cages start, with not one number in it, so it cannot spoil
 * the puzzle for whoever reads it. Nothing is sent anywhere; the text only goes
 * to the clipboard, and when the browser refuses that, into a box the player
 * can copy by hand. */
const ZNAK_ROH = '\u{1F7EB}';     // hneda kocka: prve policko ohrady
const ZNAK_POLE = '\u{2B1C}';     // biela kocka: ostatne policka
function odkazNaSett() {
  const b = 'https://arling.sk/games/badgers/';
  if (rezim === 'cvicenie') return b + 'practice/' + sada + '/' + (kSada === 1 ? '' : kSada + '/');
  return jeDnes ? b : b + datum + '/';
}
function textNaZdielanie() {
  const zaciatky = new Set(cages.map((cage) => cage.cells[0]));
  const riadky = [];
  for (let r = 0; r < n; r++) {
    let s = '';
    for (let c = 0; c < n; c++) s += zaciatky.has(r * n + c) ? ZNAK_ROH : ZNAK_POLE;
    riadky.push(s);
  }
  const kto = rezim === 'cvicenie' ? 'Badgers practice ' + sada + ', sett ' + kSada : 'Badgers ' + datum;
  const pomoc = [];
  if (hints) pomoc.push(hints + (hints === 1 ? ' hint' : ' hints'));
  if (checks) pomoc.push(checks + (checks === 1 ? ' check' : ' checks'));
  return kto + ' · ' + UROVNE[zadanie.uroven].label + '\n'
    + riadky.join('\n') + '\n'
    + 'Solved' + (sekundy ? ' in ' + formatCas(sekundy) : '') + (pomoc.length ? ' with ' + pomoc.join(' and ') : ', clean: no hint, no check') + '\n'
    + odkazNaSett();
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
  track('game_share', { game: 'badgers', copied: ok, level: zadanie.uroven });
});

/* ── Check, in two steps ──────────────────────────────────────────────── *
 * The first press says how many numbers are wrong and in which rows; only the
 * second press marks them. The puzzle stays a puzzle unless you ask twice. When
 * a cell is picked, only its row, column and block are checked, which is how a
 * crossword checks one word (ops/spec-hry-ux.md, part 4). */
function rozsahCheck() {
  if (vybrana >= 0 && bunky[vybrana]) {
    const set = new Set();
    for (const k of bunkaJedn[vybrana]) for (const i of jedn[k].cells) set.add(i);
    const cells = [...set];
    if (cells.some((i) => v[i])) return { cells, kde: ' in the row, the column and the block of the cell you picked' };
  }
  return { cells: null, kde: '' };
}
function skontrolujStav() {
  if (done || pauza) return;
  const r = rozsahCheck();
  const p = porovnaj(v, zadanie.solution);
  const zle = r.cells ? p.zle.filter((i) => r.cells.includes(i)) : p.zle;
  const napisane = r.cells ? r.cells.filter((i) => v[i]).length : p.vyplnene;
  if (!napisane) { stavEl.textContent = 'Nothing written down yet.'; return; }
  checks++;
  ulozStav();
  if (!zle.length) {
    zmazOdhalenie();
    stavEl.textContent = 'Everything right so far' + r.kde + ': ' + napisane + (napisane === 1 ? ' number' : ' numbers') + ' and not one of them wrong.';
    track('game_check', { game: 'badgers', wrong: 0 });
    return;
  }
  if (checkStav && !odhalene) {
    odhalene = true;
    for (const i of zle) if (bunky[i]) bunky[i].classList.add('chyba');
    stavEl.textContent = 'The marked ' + (zle.length === 1 ? 'cell does' : 'cells do') + ' not hold ' + (zle.length === 1 ? 'that number' : 'those numbers') + ' in the finished sett. Take them out and keep going.';
    checkBtn.textContent = 'Check';
    track('game_check', { game: 'badgers', wrong: zle.length, revealed: true });
    return;
  }
  // The rough area may be a row, a column or a block (ops/spec-hry-ux.md,
  // part 4); we name whichever of the three needs fewest of them, so mistakes
  // stacked in one column are told as that one column instead of four rows,
  // and mistakes sitting in one block as that one block instead of three rows
  // and three columns. Rows win a tie, then columns, then blocks.
  const riadky = [], stlpce = [], bloky = [];
  for (const i of zle) {
    const rr = ((i / n) | 0) + 1, cc = (i % n) + 1;
    const kb = bunkaJedn[i].find((k) => jedn[k].druh === 'block');
    const bb = kb === undefined ? 0 : jedn[kb].cislo + 1;
    if (!riadky.includes(rr)) riadky.push(rr);
    if (!stlpce.includes(cc)) stlpce.push(cc);
    if (!bloky.includes(bb)) bloky.push(bb);
  }
  const skupiny = [{ zoz: riadky, slovo: 'row ' }, { zoz: stlpce, slovo: 'column ' }, { zoz: bloky, slovo: 'block ' }];
  const naj = skupiny.reduce((a, b) => (b.zoz.length < a.zoz.length ? b : a));
  const kde = naj.zoz.sort((a, b) => a - b).map((k) => naj.slovo + k);
  checkStav = { zle: zle.length };
  stavEl.textContent = 'There ' + (zle.length === 1 ? 'is 1 number that is wrong' : 'are ' + zle.length + ' numbers that are wrong') + r.kde
    + ', in ' + zoznamSlov(kde.slice(0, 4)) + (kde.length > 4 ? ' and elsewhere' : '') + '. Press Check again to show where.';
  checkBtn.textContent = 'Show';
  track('game_check', { game: 'badgers', wrong: zle.length, revealed: false });
}

/* ── Hint, in two steps ───────────────────────────────────────────────── *
 * The first press names the rule and the place and outlines the cage it reads,
 * without saying what goes there; the second press writes that one number and
 * explains it in full. Every hint is counted and shown at the end. */
const VETY = {
  'wrong-number': (kde) => 'There is a number in ' + kde + ' that the finished sett does not have there. Take it out before going on.',
  'single-cell-cage': (kde) => 'The cage around ' + kde + ' holds that one cell only, so its total is the number itself.',
  'single-combo': (kde) => 'The total of the cage around ' + kde + ' can be made in only one way, and that settles this cell.',
  'naked-single': (kde) => 'The row, the column, the block and the cage together leave ' + kde + ' a single number.',
  'hidden-single': (kde) => 'One number has only one place left in a row, a column or a block, and that place is ' + kde + '.',
  'unit-sum-in': (kde) => 'Every row, column and block adds up to the same total. The cages lying inside one of them leave a single cell over, and it is ' + kde + '.',
  'unit-sum-out': (kde) => 'The cages reaching into one row, column or block stick out by a single cell, and it is ' + kde + '.',
  'pair': (kde) => 'Two cells nearby hold two numbers between them, which takes those numbers away from ' + kde + '.',
  'cage-sum': (kde) => 'Every way of making a cage total that the rows, the columns and the blocks still allow leaves the same number for ' + kde + '.',
  'cage-in-unit': (kde) => 'A cage lying inside one row, column or block keeps its numbers for itself, which settles ' + kde + '.',
  'trial': (kde) => 'Write in each number ' + kde + ' still allows and follow the plain rules: all but one run into a contradiction.',
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
    const text = t.druh === 'chyba' ? t.text.replace('Clear it before going on.', 'It is cleared now.') : t.text;
    zmazTip(); zmazOdhalenie();
    track('game_hint', { game: 'badgers', rule: t.pravidlo, layer: t.vrstva, applied: true });
    if (!zmenilo) { ulozStav(); ukazStav(); }
    if (!done) stavEl.textContent = text;
    return;
  }
  const h = napoveda(v, cages, zadanie.solution, n);
  if (!h) return;
  tip = h; tipUkazany = true;
  const i = h.bunky[0].i;
  const cage = cages[ohradaBunky[i]];
  if (cage) for (const j of cage.cells) if (bunky[j]) bunky[j].classList.add('tip-ohrada');
  for (const x of h.bunky) if (bunky[x.i]) bunky[x.i].classList.add('tip');
  zameraj(i, false);
  const veta = VETY[h.pravidlo] || VETY.reveal;
  const chyba = h.druh === 'chyba';
  stavEl.textContent = veta(suradnice(i)) + (chyba ? ' Press Hint again to clear it.' : ' Press Hint again to write it in.');
  hintBtn.textContent = chyba ? 'Clear it' : 'Write it';
  track('game_hint', { game: 'badgers', rule: h.pravidlo, layer: h.vrstva, applied: false });
}

function skontroluj() {
  if (!jeVyriesene(v, cages, n)) return false;
  sekundy = ubehnute();
  done = Date.now();
  start = null;
  zastavTikac();
  nastavNecinnost();
  doska.classList.add('hotovo');
  zmazTip(); zmazOdhalenie();
  vybrana = -1;              // the finished sett is green all over, not one picked cell
  oznacVyber();
  ukazCas();
  zapisSeriu();
  ukazSeriu();
  ulozStav();
  ukazHistoriu();
  ukazPasik();
  track('game_solved', { game: 'badgers', day: rezim === 'den' ? datum : sada + '/' + kSada, seconds: sekundy, hints, checks, level: zadanie.uroven });
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
/* Writing a number takes it out of the notes of every other cell of its row,
 * its column, its block and its cage: no number repeats in any of them
 * (ops/spec-hry-ux.md, part 2). */
function vyskrtniPoznamky(i, d) {
  for (const k of bunkaJedn[i]) for (const j of jedn[k].cells) if (j !== i) pz[j] &= ~(1 << d);
  const cage = cages[ohradaBunky[i]];
  if (cage) for (const j of cage.cells) if (j !== i) pz[j] &= ~(1 << d);
}
function nastav(i, d) {
  if (done || pauza || i < 0 || !bunky[i]) return;
  if (v[i] === d && !pz[i]) return;
  zmenaStavu(() => {
    v[i] = d;
    pz[i] = 0;              // a number and its notes go together
    if (d) vyskrtniPoznamky(i, d);
    if (nastavenia.autoPoznamky) doplnPoznamky();
  });
}
function prepniPoznamku(i, d) {
  if (done || pauza || i < 0 || !bunky[i] || !d) return;
  zmenaStavu(() => { v[i] = 0; pz[i] ^= 1 << d; });
}
/* The pad and the keyboard write the same way: the same number again takes it
 * back, so the way to an empty cell is always one tap (part 1). */
function zapis(d) {
  if (vybrana < 0 || !bunky[vybrana]) return;
  if (!d) { nastav(vybrana, 0); return; }
  if (d > n) return;
  if (poznamkyRezim) { prepniPoznamku(vybrana, d); return; }
  nastav(vybrana, v[vybrana] === d ? 0 : d);
}
/* Ten istý zápis s otočeným režimom. Shift plus cifra a dlhé podržanie cifry na
 * pade robia to isté: v Notes mode zapíšu skutočnú hodnotu, mimo neho poznámku,
 * a režim pritom neprepnú (ops/spec-hry-ux.md, časti 1 a 2). */
function zapisOpacne(d) {
  if (vybrana < 0 || !bunky[vybrana] || !d || d > n) return;
  if (poznamkyRezim) nastav(vybrana, v[vybrana] === d ? 0 : d);
  else prepniPoznamku(vybrana, d);
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
/* Clear: an empty sett, the clock keeps running (Andrej, 10. 9.: clearing is a
 * move, not a restart). One Undo brings every number back. */
function reset() {
  if (done || pauza) return;
  if (v.every((x) => !x) && pz.every((x) => !x)) return;
  if (nastavenia.potvrditReset && !window.confirm('Clear the whole sett? The clock keeps running and one Undo brings your numbers back.')) return;
  zmenaStavu(() => { v = new Array(n * n).fill(0); pz = new Array(n * n).fill(0); });
}

/* ── Pointer ──────────────────────────────────────────────────────────── *
 * A tap picks a cell. A drag that starts on a cell which already holds a number
 * writes that same number into the empty cells it runs over, and touches
 * nothing that is already written (ops/spec-hry-ux.md, pattern A). */
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
/* Tab into the board and the cell that takes the focus is the picked one. */
doska.addEventListener('focusin', (e) => {
  const b = e.target && e.target.closest ? e.target.closest('.b') : null;
  if (!b) return;
  const i = +b.dataset.i;
  if (i !== vybrana) { vybrana = i; oznacVyber(); }
});

/* ── Keyboard ─────────────────────────────────────────────────────────── *
 * Arrows walk from cell to cell, the digits write, Shift plus a digit writes a
 * note without leaving the pad, N or Enter switches notes, Delete empties the
 * cell, Escape lets it go (pattern A). */
function zameraj(i, fokus) {
  if (i < 0 || !bunky[i]) return;
  for (const b of bunky) if (b) b.tabIndex = -1;
  vybrana = i;
  bunky[i].tabIndex = 0;
  if (fokus) bunky[i].focus({ preventScroll: true });
  oznacVyber();
}
function dalsia(i, dr, dc) {
  const r = (((i / n) | 0) + dr + n) % n, c = ((i % n) + dc + n) % n;
  return r * n + c;
}
doska.addEventListener('keydown', (e) => {
  if (done || pauza) return;
  const i = vybrana;
  let ciel = -1;
  switch (e.key) {
    case 'ArrowUp': ciel = dalsia(i, -1, 0); break;
    case 'ArrowDown': ciel = dalsia(i, 1, 0); break;
    case 'ArrowLeft': ciel = dalsia(i, 0, -1); break;
    case 'ArrowRight': ciel = dalsia(i, 0, 1); break;
    case 'Enter': case 'n': case 'N':
      poznamkyRezim = !poznamkyRezim; ukazTlacidla(); e.preventDefault(); return;
    case 'Escape':
      if (vybrana >= 0) { const b = bunky[vybrana]; vybrana = -1; oznacVyber(); if (b) b.blur(); e.preventDefault(); }
      return;
    case 'Delete': case 'Backspace': case '0':
      if (nastavenia.lenPad) return;   // Onscreen input only: the pad writes, the keyboard does not
      zapis(0); e.preventDefault(); return;
    case ' ':
      e.preventDefault(); return;
    default:
      if (e.key >= '1' && e.key <= '9') {
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
    if (vybrana < 0) { stavEl.textContent = 'Pick a cell first, then hold a number.'; return; }
    zapisOpacne(d);
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
/* Každé tlačidlo mimo plochy vráti fókus na vybranú bunku: kto klikne myšou a
 * potom píše z klávesnice, nemá o šípky ani o cifry prísť (tie počúva plocha). */
function vratFokus() {
  if (vybrana >= 0 && bunky[vybrana]) bunky[vybrana].focus({ preventScroll: true });
}
padEl.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-d]');
  if (!b) return;
  if (padDlhe) { padDlhe = false; return; }   // podržanie už zapísalo
  if (vybrana < 0) { stavEl.textContent = 'Pick a cell first, then a number.'; return; }
  zapis(+b.dataset.d);
  vratFokus();
});
if (poznamkyBtn) poznamkyBtn.addEventListener('click', () => {
  poznamkyRezim = !poznamkyRezim; ukazTlacidla();
  vratFokus();
});
if (spatBtn) spatBtn.addEventListener('click', () => { spat(); vratFokus(); });
if (znovaBtn) znovaBtn.addEventListener('click', () => { znova(); vratFokus(); });
if (resetBtn) resetBtn.addEventListener('click', () => { reset(); vratFokus(); });
if (checkBtn) checkBtn.addEventListener('click', () => { skontrolujStav(); vratFokus(); });
if (hintBtn) hintBtn.addEventListener('click', () => { ukazNapovedu(); vratFokus(); });
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
 * A finished sett has two marks (ops/spec-hry-ux.md, part 8): solved, and
 * solved clean with no hint and no check. The clean one adds the class `ciste`
 * (a dot in the corner, so the difference is a shape and not only a colour) and
 * says so in the aria-label as well. */
function triedaStavu(st) {
  if (st && st.done) return st.hints || st.checks ? ' hotove' : ' hotove ciste';
  return st && st.v && st.v.some((x) => x) ? ' rozohrane' : '';
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
      const st = nacitaj('badgers:p:' + sada + ':' + k);
      const a = document.createElement(k === kSada ? 'span' : 'a');
      a.className = 'den' + (k === kSada ? ' dnes' : '') + triedaStavu(st);
      if (k !== kSada) a.href = '/games/badgers/practice/' + sada + '/' + k + '/';
      a.innerHTML = '<small>No.</small><b>' + k + '</b>';
      a.setAttribute('aria-label', 'Sett ' + k + slovoStavu(st));
      if (k === kSada) a.setAttribute('aria-current', 'page');
      pasik.appendChild(a);
    }
    return;
  }
  const dni = tyzden(datum);
  dni.forEach((d, k) => {
    const st = nacitaj('badgers:' + d);
    const buduci = d > dnes, pred = d < PRVY_DEN;
    const tag = d === datum || buduci || pred ? 'span' : 'a';
    const a = document.createElement(tag);
    a.className = 'den' + (d === datum ? ' dnes' : '') + (buduci || pred ? ' buduci' : '') + triedaStavu(st);
    if (tag === 'a') a.href = '/games/badgers/' + d + '/';
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
    // Auto notes, switched on, fills the whole board at once: one move in the
    // history, exactly like any other (ops/spec-hry-ux.md, part 2).
    if (kluc === 'autoPoznamky' && el.checked && zadanie && !done && !pauza) zmenaStavu(doplnPoznamky);
    pouziNastavenia();
    track('game_setting', { game: 'badgers', setting: kluc, on: el.checked });
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
  for (const k of vsetkyKluce('badgers:')) {
    const d = k.slice('badgers:'.length);
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
  if (!ziva) { try { localStorage.removeItem('badgers:streak'); } catch (e) { /* nič */ } return; }
  uloz('badgers:streak', s);
}
function odosliStav() {
  if (!ucet.prihlaseny()) return;
  ucet.hra.uloz('badgers', { dni: stavVsetkychDni(), t: Date.now() }).catch(() => { /* sieťová chyba: lokálne ostáva pravdou */ });
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
  try { vzdialene = await ucet.hra.nacitaj('badgers'); } catch (e) { return; /* sieťová chyba: lokálne ostáva pravdou */ }
  const diaDni = vzdialene && vzdialene.dni && typeof vzdialene.dni === 'object' ? vzdialene.dni : {};
  let zmenene = false;
  for (const [d, r] of Object.entries(diaDni)) {
    if (!isValidDate(d) || !r || typeof r !== 'object') continue;
    const kluc = 'badgers:' + d;
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
async function spusti() {
  if (jeBuduci) {
    datumEl.textContent = pekneDatum(datum);
    stavEl.textContent = 'This sett opens on ' + pekneDatum(datum) + ' (Bratislava time). Come back then, or play today’s sett.';
    doska.hidden = true;
    if (padEl) padEl.hidden = true;
    for (const b of [poznamkyBtn, spatBtn, znovaBtn, resetBtn, checkBtn, hintBtn]) if (b) b.disabled = true;
    ukazPasik();
    return;
  }
  try {
    zadanie = await nacitajZadanie();
  } catch (e) {
    stavEl.textContent = 'The sett could not be prepared. Please reload the page.';
    throw e;
  }
  n = zadanie.n;
  cages = zadanie.cages;
  pripravMriezku();
  ulozene = nacitaj(KLUC);
  v = (ulozene && Array.isArray(ulozene.v) && ulozene.v.length === n * n) ? ulozene.v.slice() : new Array(n * n).fill(0);
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
  ukazVsetko();
  pouziNastavenia();
  if (datumEl) datumEl.textContent = rezim === 'cvicenie' ? UROVNE[zadanie.uroven].label + ' practice ' + sada.split('-')[1] + ', sett ' + kSada : pekneDatum(datum);
  if (urovenEl) urovenEl.textContent = UROVNE[zadanie.uroven].label + ' · ' + n + '×' + n;
  if (done) doska.classList.add('hotovo');
  else if (v.some((x) => x) || pz.some((x) => x)) pozastav(true);
  ukazCas();
  ukazSeriu();
  ukazHistoriu();
  ukazPasik();
  ukazStav();
  ukazTlacidla();
}
spusti().then(synchronizujUcet);
