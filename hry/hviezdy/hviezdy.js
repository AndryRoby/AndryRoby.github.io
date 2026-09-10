/* Hviezdy: stránka hry. Zadanie počíta generator.mjs priamo v prehliadači,
 * tento súbor ho len vykreslí a stará sa o ťahy, čas, uloženie a sériu.
 *
 * Čo sa ukladá (localStorage, všetko v try/catch, lebo v súkromnom okne
 * alebo pri zakázanom úložisku prístup hádže):
 *   hviezdy:YYYY-MM-DD   { v: stav políčok, start: ms prvého ťahu, done: ms
 *                          vyriešenia alebo null, sec: sekundy riešenia }
 *   hviezdy:seria        { posledny: YYYY-MM-DD, pocet }
 * Von ide jediná udalosť: hra_vyriesena cez window.umami, ak Umami beží.
 *
 * Parameter ?d=YYYY-MM-DD otvorí zadanie iného dňa (na kontrolu zajtrajška).
 */
import { generate, todayBratislava, isValidDate, checkSolution } from './generator.mjs';

const N = 8;
const STARS = 1;
const doska = document.getElementById('doska');
const stavEl = document.getElementById('stav');
const casEl = document.getElementById('cas');
const datumEl = document.getElementById('datum');
const seriaEl = document.getElementById('seria');
const spatBtn = document.getElementById('spat');
const vymazBtn = document.getElementById('vymaz');

/* ── Úložisko ─────────────────────────────────────────────────────────── */
function nacitaj(kluc) {
  try {
    const s = localStorage.getItem(kluc);
    return s ? JSON.parse(s) : null;
  } catch (e) { return null; }
}
function uloz(kluc, hodnota) {
  try { localStorage.setItem(kluc, JSON.stringify(hodnota)); } catch (e) { /* bez úložiska hra beží ďalej */ }
}

/* ── Dátum ────────────────────────────────────────────────────────────── */
function vybranyDatum() {
  try {
    const d = new URL(location.href).searchParams.get('d');
    if (d && isValidDate(d)) return d;
  } catch (e) { /* bez parametra */ }
  return todayBratislava();
}
function predchadzajuciDen(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) - 86400000);
  return t.toISOString().slice(0, 10);
}
function pekneDatum(iso) {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    const s = new Intl.DateTimeFormat('sk-SK', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(y, m - 1, d)));
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch (e) { return iso; }
}
function formatCas(sek) {
  const m = Math.floor(sek / 60), s = sek % 60;
  return m + ':' + String(s).padStart(2, '0');
}
function dniSlovo(n) {
  if (n === 1) return '1 deň';
  if (n >= 2 && n <= 4) return n + ' dni';
  return n + ' dní';
}

/* ── Stav hry ─────────────────────────────────────────────────────────── */
const datum = vybranyDatum();
const KLUC = 'hviezdy:' + datum;
let zadanie;
try {
  zadanie = generate(datum, { n: N, stars: STARS });
} catch (e) {
  stavEl.textContent = 'Zadanie sa nepodarilo pripraviť. Skúste stránku načítať znova.';
  throw e;
}
const n = zadanie.n;
const ulozene = nacitaj(KLUC);
let v = (ulozene && Array.isArray(ulozene.v) && ulozene.v.length === n * n) ? ulozene.v.slice() : new Array(n * n).fill(0);
let start = ulozene && ulozene.start ? ulozene.start : null;
let done = ulozene && ulozene.done ? ulozene.done : null;
let sekundy = ulozene && ulozene.sec ? ulozene.sec : 0;
const historia = [];
let fokus = 0;
let tikac = null;

/* ── Vykreslenie ──────────────────────────────────────────────────────── */
const bunky = [];
function postavMriezku() {
  doska.style.setProperty('--n', n);
  doska.textContent = '';
  const frag = document.createDocumentFragment();
  for (let r = 0; r < n; r++) {
    // riadok je len pre čítačky (role="row"); rozloženie robí mriežka rodiča cez display:contents
    const riadok = document.createElement('div');
    riadok.className = 'riadok';
    riadok.setAttribute('role', 'row');
    frag.appendChild(riadok);
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
      if (r > 0 && zadanie.regions[r - 1][c] !== zadanie.regions[r][c]) b.classList.add('bt');
      if (c > 0 && zadanie.regions[r][c - 1] !== zadanie.regions[r][c]) b.classList.add('bl');
      riadok.appendChild(b);
      bunky.push(b);
    }
  }
  doska.appendChild(frag);
}
const NAZVY = ['prázdne', 'bodka', 'hviezda'];
function ukazBunku(i) {
  const b = bunky[i];
  b.dataset.v = v[i];
  const r = Math.floor(i / n) + 1, c = (i % n) + 1;
  b.setAttribute('aria-label', 'riadok ' + r + ', stĺpec ' + c + ', ' + NAZVY[v[i]]);
}
function ukazVsetko() {
  for (let i = 0; i < n * n; i++) ukazBunku(i);
  oznacKonflikty();
}

/* Hviezdy, ktoré porušujú pravidlo, dostanú červenú. Bodky sa nekontrolujú. */
function oznacKonflikty() {
  const grid = v.map((x) => (x === 2 ? 1 : 0));
  const zle = new Set();
  const stars = [];
  for (let i = 0; i < n * n; i++) if (grid[i] === 1) stars.push(i);
  const rowC = new Array(n).fill(0), colC = new Array(n).fill(0), regC = new Array(n).fill(0);
  for (const i of stars) { rowC[Math.floor(i / n)]++; colC[i % n]++; regC[zadanie.regions[Math.floor(i / n)][i % n]]++; }
  for (const i of stars) {
    const r = Math.floor(i / n), c = i % n;
    if (rowC[r] > STARS || colC[c] > STARS || regC[zadanie.regions[r][c]] > STARS) zle.add(i);
  }
  for (let a = 0; a < stars.length; a++) for (let b = a + 1; b < stars.length; b++) {
    const x = stars[a], y = stars[b];
    if (Math.abs(Math.floor(x / n) - Math.floor(y / n)) <= 1 && Math.abs((x % n) - (y % n)) <= 1) { zle.add(x); zle.add(y); }
  }
  for (let i = 0; i < n * n; i++) bunky[i].classList.toggle('zle', zle.has(i));
  return { stars: stars.length, zle: zle.size };
}

/* ── Čas ──────────────────────────────────────────────────────────────── */
function ubehnute() {
  if (done) return sekundy;
  if (!start) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}
function ukazCas() { casEl.textContent = formatCas(ubehnute()); }
function spustiTikac() {
  if (tikac || done || !start) return;
  tikac = setInterval(ukazCas, 1000);
}
function zastavTikac() { if (tikac) { clearInterval(tikac); tikac = null; } }

/* ── Séria ────────────────────────────────────────────────────────────── */
function ukazSeriu() {
  const s = nacitaj('hviezdy:seria');
  if (!s || !s.pocet) { seriaEl.textContent = ''; return; }
  seriaEl.textContent = 'Séria: ' + dniSlovo(s.pocet);
}
function zapisSeriu() {
  const s = nacitaj('hviezdy:seria') || { posledny: null, pocet: 0 };
  if (s.posledny === datum) return;
  const pocet = s.posledny === predchadzajuciDen(datum) ? s.pocet + 1 : 1;
  uloz('hviezdy:seria', { posledny: datum, pocet });
}

/* ── Uloženie a vyhodnotenie ──────────────────────────────────────────── */
function ulozStav() { uloz(KLUC, { v, start, done, sec: sekundy }); }

function ukazStav() {
  const k = oznacKonflikty();
  stavEl.classList.toggle('ok', !!done);
  if (done) {
    stavEl.innerHTML = '<b>Vyriešené</b> za ' + formatCas(sekundy) + '. Zajtra bude nové zadanie.';
    return;
  }
  if (k.zle) { stavEl.textContent = 'Červená hviezda porušuje pravidlo.'; return; }
  const zvysok = n * STARS - k.stars;
  if (zvysok === n * STARS) { stavEl.textContent = 'Položte ' + n + ' hviezd.'; return; }
  if (zvysok > 0) stavEl.textContent = 'Ešte ' + (zvysok === 1 ? '1 hviezda' : zvysok <= 4 ? zvysok + ' hviezdy' : zvysok + ' hviezd') + '.';
  else stavEl.textContent = 'Hviezd je ' + n + ', ale riešenie ešte nesedí.';
}

function skontroluj() {
  const grid = v.map((x) => (x === 2 ? 1 : 0));
  let pocet = 0;
  for (const x of grid) pocet += x;
  if (pocet !== n * STARS) return false;
  if (checkSolution(zadanie.regions, STARS, grid).length) return false;
  done = Date.now();
  sekundy = start ? Math.max(1, Math.round((done - start) / 1000)) : 0;
  zastavTikac();
  doska.classList.add('hotovo');
  ukazCas();
  zapisSeriu();
  ukazSeriu();
  ulozStav();
  try {
    if (window.umami && typeof window.umami.track === 'function') {
      window.umami.track('hra_vyriesena', { den: datum, sekundy });
    }
  } catch (e) { /* štatistika nie je súčasť hry */ }
  return true;
}

/* ── Ťahy ─────────────────────────────────────────────────────────────── */
function nastav(i, hodnota, doHistorie = true) {
  if (done) return;
  if (v[i] === hodnota) return;
  if (doHistorie) historia.push({ i, z: v[i] });
  v[i] = hodnota;
  if (!start) { start = Date.now(); spustiTikac(); }
  ukazBunku(i);
  if (!skontroluj()) ulozStav();
  ukazStav();
  spatBtn.disabled = historia.length === 0;
}
function prepni(i) { nastav(i, (v[i] + 1) % 3); }

function spat() {
  if (done || !historia.length) return;
  const h = historia.pop();
  if (h.cele) { v = h.cele; ukazVsetko(); }
  else { v[h.i] = h.z; ukazBunku(h.i); }
  ulozStav();
  ukazStav();
  spatBtn.disabled = historia.length === 0;
}
function vymaz() {
  if (done) return;
  if (v.every((x) => x === 0)) return;
  historia.push({ cele: v.slice() });
  v = new Array(n * n).fill(0);
  ukazVsetko();
  ulozStav();
  ukazStav();
  spatBtn.disabled = false;
}

/* ── Klávesnica: jeden aktívny tabulátor, šípky po mriežke ────────────── */
function zameraj(i) {
  bunky[fokus].tabIndex = -1;
  fokus = i;
  bunky[i].tabIndex = 0;
  bunky[i].focus();
}
doska.addEventListener('click', (e) => {
  const b = e.target.closest('.b');
  if (!b) return;
  const i = +b.dataset.i;
  if (fokus !== i) { bunky[fokus].tabIndex = -1; fokus = i; b.tabIndex = 0; }
  prepni(i);
});
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
    case 'x': case 'X': case '.': case ',': case '1': nastav(i, 1); e.preventDefault(); return;
    case 's': case 'S': case '*': case '2': nastav(i, 2); e.preventDefault(); return;
    case 'Delete': case 'Backspace': case '0': nastav(i, 0); e.preventDefault(); return;
    default: return;
  }
  e.preventDefault();
  zameraj(cielova);
});
spatBtn.addEventListener('click', spat);
vymazBtn.addEventListener('click', vymaz);

/* ── Pravidlá v angličtine ────────────────────────────────────────────── */
const prepniJazyk = document.getElementById('prepni-jazyk');
const pravidlaSk = document.getElementById('pravidla-sk');
const pravidlaEn = document.getElementById('pravidla-en');
if (prepniJazyk && pravidlaSk && pravidlaEn) {
  prepniJazyk.addEventListener('click', () => {
    const en = pravidlaEn.hidden;
    pravidlaEn.hidden = !en;
    pravidlaSk.hidden = en;
    prepniJazyk.setAttribute('aria-pressed', en ? 'true' : 'false');
    prepniJazyk.textContent = en ? 'Pravidlá po slovensky' : 'Rules in English';
  });
}

/* ── Štart ────────────────────────────────────────────────────────────── */
postavMriezku();
ukazVsetko();
datumEl.textContent = pekneDatum(datum);
if (done) doska.classList.add('hotovo');
ukazCas();
spustiTikac();
ukazSeriu();
ukazStav();
spatBtn.disabled = true;
document.addEventListener('visibilitychange', () => { if (!document.hidden) ukazCas(); });
