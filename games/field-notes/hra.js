/* Field Notes: hra na stránke (M0, 26. 9. 2026).
 *
 * Strana zápisníka: 8 exemplárov jednej témy, mriežka 10 x 10. Nájdené slovo
 * dokreslí svoj exemplár perom, rozleje akvarel a ukáže jednu overenú vetu
 * s odkazom na zdroj. Hotová strana je plagát (dá sa stiahnuť ako SVG).
 *
 * Režimy: Today (rovnaká strana pre všetkých v daný kalendárny deň, lokálna
 * polnoc) a Endless (strany 1, 2, 3 … bez konca). Žiadna séria, žiadny
 * časovač na obrazovke, nič sa nestratí (ops/hry/portfolio/TOVAREN-HIER.md 6).
 *
 * Ovládanie: ťah prstom alebo myšou cez písmená; bez ťahania ťuk na prvé
 * a potom na posledné písmeno (WCAG 2.5.7); klávesnica: šípky, Enter alebo
 * medzerník na začiatok a koniec, Escape zruší, H nápoveda.
 *
 * Udalosti do Umami (ak beží): game_start, game_solved, game_hint,
 * game_setting, game_share, game_download, s vlastnosťou game: 'field-notes'.
 */
import { stranaDna, stranaNekonecna, pritiahni, cestaMedzi, najdiSlovo, rimske, OBTIAZNOST, VELKOST, ZACIATOK } from './motor.mjs';
import { svg as kresbaSvg, odtien } from './kresby.mjs';
import { TEMA } from './temy.mjs';
import { zvuk } from './zvuk.js';
import { portal } from './portal.mjs';
import { plagat, nazovSuboru } from './plagat.mjs';

const N = VELKOST;
const KLUC = 'fieldnotes:v1';
const HRA = 'field-notes';
const $ = (id) => document.getElementById(id);
const el = {
  list: $('fn-list'), oko: $('fn-oko'), titul: $('fn-titul'), dnes: $('fn-dnes'), nekonecne: $('fn-nekonecne'),
  vzorky: $('fn-vzorky'), fakt: $('fn-fakt'), obal: $('fn-doska-obal'), ram: $('fn-ram'), doska: $('fn-doska'), znacky: $('fn-znacky'),
  stopa: $('fn-stopa'), napoveda: $('fn-napoveda'), postup: $('fn-postup'), zvuk: $('fn-zvuk'),
  koniec: $('fn-koniec'), koniecNadpis: $('fn-koniec-nadpis'), koniecText: $('fn-koniec-text'), dalsia: $('fn-dalsia'),
  stiahni: $('fn-stiahni'), kopiruj: $('fn-kopiruj'), kopia: $('fn-kopia'), hlas: $('fn-hlas'),
};
const pohybMalo = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function track(meno, data) {
  try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(meno, Object.assign({ game: HRA }, data || {})); } catch (e) { /* štatistika nie je súčasť hry */ }
}
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const pad = (n) => String(n).padStart(2, '0');

/* ── Uloženie (len v tomto prehliadači) ────────────────────────────────── */
function nacitaj() {
  try {
    const t = JSON.parse(localStorage.getItem(KLUC) || 'null');
    if (t && typeof t === 'object') return Object.assign({ nastavenia: {}, dni: {}, strany: {}, cislo: 1, rezim: 'den', zbierka: {} }, t);
  } catch (e) { /* súkromné okno alebo zakázané úložisko: hra ide aj bez neho */ }
  return { nastavenia: {}, dni: {}, strany: {}, cislo: 1, rezim: 'den', zbierka: {} };
}
let ulozene = nacitaj();
function uloz() { try { localStorage.setItem(KLUC, JSON.stringify(ulozene)); } catch (e) { /* bez úložiska */ } }

/* ── Stav strany ───────────────────────────────────────────────────────── */
let rezim = ulozene.rezim === 'strana' ? 'strana' : 'den';
let datum = dnesLokalne();
let strana = null;
let zaznam = null;       // uložený stav tejto strany
let najdene = new Set();
let rada = null;         // { k, krok }
let kotva = -1;          // bunka, od ktorej sa ťuká bez ťahania
let tah = null;          // prebiehajúci ťah
let kurzor = 0;          // bunka s fokusom klávesnice
let hotovo = false;
let zacate = false;
let poslednyVstup = 0;

function dnesLokalne() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const MESIACE = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function peknyDatum(d) { const [y, m, dd] = d.split('-').map(Number); return `${dd} ${MESIACE[m - 1]} ${y}`; }
function kratkyDatum(d) { const [, m, dd] = d.split('-').map(Number); return `${dd} ${MESIACE[m - 1]}`; }
function nadpisStrany() { return rezim === 'den' ? peknyDatum(datum) : 'Plate ' + rimske(strana ? Number(strana.kluc) : ulozene.cislo); }

/* Parametre adresy: ?day=YYYY-MM-DD (archív, nie do budúcnosti) alebo ?plate=N. */
(function () {
  const q = new URLSearchParams(location.search);
  const d = q.get('day'), p = q.get('plate');
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= ZACIATOK && d <= dnesLokalne()) { rezim = 'den'; datum = d; }
  else if (p && /^\d{1,6}$/.test(p) && Number(p) >= 1) { rezim = 'strana'; ulozene.cislo = Number(p); }
})();

function zaznamStrany() {
  if (rezim === 'den') return (ulozene.dni[datum] = ulozene.dni[datum] || { najdene: [], napovedy: 0, sekundy: 0, hotovo: false });
  const k = String(ulozene.cislo);
  return (ulozene.strany[k] = ulozene.strany[k] || { najdene: [], napovedy: 0, sekundy: 0, hotovo: false });
}

/* ── Vykreslenie ───────────────────────────────────────────────────────── */
function nacitajStranu() {
  strana = rezim === 'den' ? stranaDna(datum) : stranaNekonecna(ulozene.cislo);
  zaznam = zaznamStrany();
  najdene = new Set();
  strana.slova.forEach((s, k) => { if (zaznam.najdene.includes(s.slovo)) najdene.add(k); });
  hotovo = najdene.size === strana.slova.length;
  rada = null; kotva = -1; tah = null; zacate = false;
  kurzor = 0;

  el.dnes.setAttribute('aria-pressed', String(rezim === 'den'));
  el.nekonecne.setAttribute('aria-pressed', String(rezim === 'strana'));
  el.oko.innerHTML = `Field Notes<span>${esc(rezim === 'den' ? kratkyDatum(datum) : 'Plate ' + rimske(Number(strana.kluc)))}</span>`;
  el.titul.textContent = strana.nazov;
  document.title = `${strana.nazov} · Field Notes · ARLing`;

  el.vzorky.innerHTML = strana.slova.map((s, k) => `
    <li class="vz${najdene.has(k) ? ' najdene hned' : ''}" data-k="${k}">
      <button type="button" class="vz-tl" data-k="${k}" aria-describedby="vz-f-${k}">
        ${kresbaSvg(s.kresba)}
        <span class="vz-meno${s.slovo.length >= 9 ? ' dlhe' : ''}">${s.slovo}</span><span class="fn-sr" id="vz-s-${k}">${najdene.has(k) ? ', found' : ', not found yet'}</span>
      </button>
      <p class="vz-fakt" id="vz-f-${k}">${najdene.has(k) ? faktHtml(s) : ''}</p>
    </li>`).join('');

  let html = '';
  for (let r = 0; r < N; r++) {
    html += `<div class="fn-riadok" role="row">`;
    for (let c = 0; c < N; c++) {
      const i = r * N + c;
      html += `<div class="fn-b" role="gridcell" id="fn-b${i}" tabindex="${i === kurzor ? 0 : -1}" aria-label="${strana.pismena[i]}, row ${r + 1}, column ${c + 1}">${strana.pismena[i]}</div>`;
    }
    html += '</div>';
  }
  el.doska.innerHTML = html;
  el.doska.setAttribute('aria-label', `Letter grid, ${N} by ${N}. ${OBTIAZNOST[strana.obtiaznost].popis}`);
  el.znacky.innerHTML = '<g id="fn-z-najdene"></g><g id="fn-z-rada"></g><g id="fn-z-tah"></g>';
  najdene.forEach((k) => pridajOdtlacok(k, false));
  ukazPostup();
  if (hotovo) ukazPlagat(false);
  else {
    el.list.classList.remove('hotovo');
    el.fakt.innerHTML = `<span class="tiche">Find the names of the specimens in the grid. Drag across the letters, or tap the first and the last letter.</span>`;
  }
  el.stopa.hidden = true;
  rozloz();
}

function faktHtml(s) {
  // Meno pred vetou len vtedy, keď ho veta sama nemá („Jupiter. Jupiter has …“ by sa opakovalo).
  const meno = s.meno.toLowerCase().replace(/^the /, '');
  const predpona = s.fakt.toLowerCase().includes(meno) ? '' : `<i>${esc(s.meno)}.</i> `;
  return `${predpona}${esc(s.fakt)} <a href="${esc(s.zdroj)}" target="_blank" rel="noopener">Source</a>`;
}
function ukazPostup() {
  const n = strana.slova.length;
  el.postup.innerHTML = `${najdene.size} of ${n} found<br><span>${esc(OBTIAZNOST[strana.obtiaznost].meno)}</span>`;
}

/* Kapsula cez bunky cesty v súradniciach mriežky (bunka = 1). */
function kapsula(cesta, trieda, farba) {
  const a = cesta[0], b = cesta[cesta.length - 1];
  const ax = (a % N) + 0.5, ay = ((a / N) | 0) + 0.5, bx = (b % N) + 0.5, by = ((b / N) | 0) + 0.5;
  const dl = Math.hypot(bx - ax, by - ay), uhol = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
  const h = 0.76;
  const vypln = farba ? ` fill="${farba}" fill-opacity=".3" stroke="${farba}" stroke-opacity=".8" stroke-width=".05"` : '';
  return `<g transform="translate(${ax.toFixed(2)} ${ay.toFixed(2)}) rotate(${uhol.toFixed(1)})"><rect class="${trieda}" x="${-h / 2}" y="${-h / 2}" width="${(dl + h).toFixed(3)}" height="${h}" rx="${h / 2}"${vypln}/></g>`;
}
function pridajOdtlacok(k, animuj) {
  const s = strana.slova[k];
  const g = $('fn-z-najdene');
  g.insertAdjacentHTML('beforeend', kapsula(s.cesta, animuj && !pohybMalo() ? 'fn-odtlacok' : '', odtien(s.kresba)));
}

/* ── Rozloženie: strana sa zmestí do okna bez posúvania ────────────────── */
function rozloz() {
  // Hlavička webu je pevná a <main> má pod ňu odsadenie, preto sa meria vrch strany
  // v dokumente: pri návrate hore je presne tam, kde ju hráč uvidí.
  const vrch = el.list.getBoundingClientRect().top + window.scrollY;
  const siroke = window.innerWidth >= 900;
  const okraj = siroke ? 14 : 10;
  const vyska = Math.max(540, Math.floor(window.innerHeight - vrch - okraj));
  el.list.style.setProperty('--fn-vyska', vyska + 'px');
  requestAnimationFrame(nastavBunku);
}
function nastavBunku() {
  if (hotovo) return;
  const w = el.obal.clientWidth, h = el.obal.clientHeight;
  if (!w || !h) return;
  const b = Math.max(22, Math.min(62, Math.floor(Math.min(w, h) / N)));
  el.list.style.setProperty('--bunka', b + 'px');
  const siroke = window.innerWidth >= 900;
  el.list.classList.toggle('dvojstrana', siroke);
  if (siroke) {
    const lr = el.list.getBoundingClientRect(), or = el.obal.getBoundingClientRect();
    el.list.style.setProperty('--fn-hrbet', Math.round(or.left - lr.left - 18) + 'px');
  }
}
let casovacRozlozenia = 0;
let poslednaSirka = window.innerWidth, poslednaVyska = window.innerHeight;
window.addEventListener('resize', () => {
  // Na telefóne sa pri posune schováva lišta prehliadača a mení výšku okna. Kvôli tomu
  // sa mriežka nemá pod prstom zväčšovať; prepočet len pri zmene šírky alebo veľkej zmene výšky.
  const w = window.innerWidth, h = window.innerHeight;
  if (w === poslednaSirka && Math.abs(h - poslednaVyska) < 140) return;
  poslednaSirka = w; poslednaVyska = h;
  clearTimeout(casovacRozlozenia);
  casovacRozlozenia = setTimeout(rozloz, 60);
});
if ('ResizeObserver' in window) new ResizeObserver(() => nastavBunku()).observe(el.obal);

/* ── Vstup ─────────────────────────────────────────────────────────────── */
function aktivita() {
  const t = performance.now();
  if (poslednyVstup && t - poslednyVstup < 60000 && !document.hidden) zaznam.sekundy += (t - poslednyVstup) / 1000;
  poslednyVstup = t;
  if (!zacate) { zacate = true; track('game_start', { mode: rezim === 'den' ? 'day' : 'endless', plate: strana.kluc, theme: strana.tema }); }
}
document.addEventListener('visibilitychange', () => { poslednyVstup = 0; });

function bodVBunkach(e) {
  const r = el.doska.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * N, ((e.clientY - r.top) / r.height) * N];
}
function bunkaZBodu(e) {
  const [x, y] = bodVBunkach(e);
  if (x < 0 || y < 0 || x >= N || y >= N) return -1;
  return Math.floor(y) * N + Math.floor(x);
}
function textCesty(cesta) { return cesta.map((c) => strana.pismena[c]).join(''); }

function kresliTah(cesta, trieda = 'fn-tah') {
  const g = $('fn-z-tah');
  g.innerHTML = cesta && cesta.length ? kapsula(cesta, trieda) : '';
  document.querySelectorAll('.fn-b.v-tahu').forEach((b) => b.classList.remove('v-tahu'));
  if (cesta) cesta.forEach((c) => $('fn-b' + c).classList.add('v-tahu'));
}
function kresliKotvu() {
  const g = $('fn-z-tah');
  if (kotva < 0) { g.innerHTML = ''; return; }
  const x = (kotva % N) + 0.5, y = ((kotva / N) | 0) + 0.5;
  g.innerHTML = `<circle class="fn-kotva" cx="${x}" cy="${y}" r=".4"/>`;
}
function ukazStopu(text, trieda = '') {
  el.stopa.textContent = text;
  el.stopa.className = 'fn-stopa' + (trieda ? ' ' + trieda : '');
  el.stopa.hidden = !text;
}
let casovacStopy = 0;
function skryStopuNeskor(ms) { clearTimeout(casovacStopy); casovacStopy = setTimeout(() => { el.stopa.hidden = true; }, ms); }

el.doska.addEventListener('pointerdown', (e) => {
  if (hotovo || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const c = bunkaZBodu(e);
  if (c < 0) return;
  e.preventDefault();
  try { el.doska.setPointerCapture(e.pointerId); } catch (err) { /* staršie prehliadače */ }
  aktivita();
  tah = { id: e.pointerId, start: c, cesta: [c], x0: e.clientX, y0: e.clientY, pohyb: false };
  kurzor = c; nastavKurzor(false);
  kresliTah(tah.cesta);
  ukazStopu(textCesty(tah.cesta));
  clearTimeout(casovacStopy);
});
el.doska.addEventListener('pointermove', (e) => {
  if (!tah || e.pointerId !== tah.id) return;
  if (!tah.pohyb && Math.hypot(e.clientX - tah.x0, e.clientY - tah.y0) > 7) tah.pohyb = true;
  if (!tah.pohyb) return;
  const [x, y] = bodVBunkach(e);
  const cesta = pritiahni(N, tah.start, x, y);
  if (cesta.length !== tah.cesta.length || cesta[cesta.length - 1] !== tah.cesta[tah.cesta.length - 1]) {
    tah.cesta = cesta;
    kresliTah(cesta);
    ukazStopu(textCesty(cesta));
    zvuk.tik();
  }
});
function koniecTahu(e) {
  if (!tah || e.pointerId !== tah.id) return;
  const t = tah;
  tah = null;
  if (!t.pohyb || t.cesta.length < 2) {
    kresliTah(null);
    tukni(t.start);
    return;
  }
  kotva = -1;
  skus(t.cesta);
}
el.doska.addEventListener('pointerup', koniecTahu);
// Záloha, keby prehliadač nedovolil zachytiť ukazovateľ a prst skončil mimo mriežky.
window.addEventListener('pointerup', koniecTahu);
el.doska.addEventListener('pointercancel', (e) => { if (tah && e.pointerId === tah.id) { tah = null; kresliTah(null); el.stopa.hidden = true; } });

/* Ťuknutie: prvé ťuknutie označí začiatok, druhé koniec (bez ťahania). */
function tukni(c) {
  if (kotva < 0) {
    kotva = c;
    kresliKotvu();
    ukazStopu(strana.pismena[c]);
    oznam(`Start at ${strana.pismena[c]}. Now tap or choose the last letter of the word.`);
    return;
  }
  if (kotva === c) { kotva = -1; kresliKotvu(); el.stopa.hidden = true; return; }
  const cesta = cestaMedzi(N, kotva, c);
  if (!cesta) {
    kotva = c;
    kresliKotvu();
    ukazStopu(strana.pismena[c]);
    return;
  }
  kotva = -1;
  skus(cesta);
}

function skus(cesta) {
  const k = najdiSlovo(strana, cesta);
  const text = textCesty(cesta);
  if (k >= 0 && !najdene.has(k)) {
    kresliTah(null);
    ukazStopu(strana.slova[k].slovo, 'ano');
    skryStopuNeskor(900);
    najdi(k);
    return;
  }
  if (k >= 0) {
    kresliTah(null);
    ukazStopu(text, 'nie');
    skryStopuNeskor(700);
    oznam(`${strana.slova[k].slovo} is already on the page.`);
    return;
  }
  // Nie je to slovo zo strany: stopa jemne zmizne, nič sa nepočíta, nič nečervenie.
  kresliTah(cesta, 'fn-tah fn-chyba');
  ukazStopu(text, 'nie');
  skryStopuNeskor(600);
  setTimeout(() => { if (!tah) kresliTah(null); if (kotva >= 0) kresliKotvu(); }, pohybMalo() ? 0 : 330);
}

function najdi(k) {
  const s = strana.slova[k];
  najdene.add(k);
  if (!zaznam.najdene.includes(s.slovo)) zaznam.najdene.push(s.slovo);
  const zb = (ulozene.zbierka[strana.tema] = ulozene.zbierka[strana.tema] || []);
  if (!zb.includes(s.slovo)) zb.push(s.slovo);
  if (rada && rada.k === k) { rada = null; $('fn-z-rada').innerHTML = ''; }
  pridajOdtlacok(k, true);
  const li = el.vzorky.querySelector(`li[data-k="${k}"]`);
  li.classList.remove('hned');
  // Nová trieda až po ďalšom snímku, aby sa prechod pera naozaj spustil.
  requestAnimationFrame(() => requestAnimationFrame(() => li.classList.add('najdene')));
  $('vz-s-' + k).textContent = ', found';
  $('vz-f-' + k).innerHTML = faktHtml(s);
  el.fakt.innerHTML = faktHtml(s);
  oznam(`Found ${s.slovo}, ${najdene.size} of ${strana.slova.length}. ${s.meno}. ${s.fakt}`);
  zvuk.najdene(najdene.size - 1);
  ukazPostup();
  if (najdene.size === strana.slova.length) dokonci();
  uloz();
}

function dokonci() {
  hotovo = true;
  zaznam.hotovo = true;
  zaznam.sekundy = Math.round(zaznam.sekundy);
  uloz();
  track('game_solved', { mode: rezim === 'den' ? 'day' : 'endless', plate: strana.kluc, theme: strana.tema, seconds: zaznam.sekundy, hints: zaznam.napovedy });
  zvuk.hotovo();
  kotva = -1; kresliTah(null);
  setTimeout(() => ukazPlagat(true), pohybMalo() ? 400 : 1900);
}

function ukazPlagat(animuj) {
  const tema = TEMA[strana.tema];
  const zb = (ulozene.zbierka[strana.tema] || []).length;
  const n = strana.slova.length;
  const zvysok = tema.slova.length - zb;
  el.koniecNadpis.textContent = 'This page is complete.';
  el.koniecText.textContent = `All ${n} specimens are in your notebook, with ${zaznam.napovedy ? zaznam.napovedy + ' hint' + (zaznam.napovedy > 1 ? 's' : '') : 'no hints'}. `
    + (zvysok > 0 ? `You have collected ${zb} of the ${tema.slova.length} specimens of ${tema.nazov} so far; the others turn up on later pages.` : `You have collected all ${tema.slova.length} specimens of ${tema.nazov}.`);
  el.dalsia.textContent = rezim === 'den' ? 'Try the endless pages' : `Next page: Plate ${rimske(Number(strana.kluc) + 1)}`;
  el.kopia.hidden = true;
  el.kopiruj.querySelector('span').textContent = 'Copy a note';
  const zobraz = () => {
    el.list.classList.remove('odchod');
    el.list.classList.add('hotovo');
    el.vzorky.querySelectorAll('li').forEach((li) => li.classList.add('hned'));
    if (animuj) { el.koniecNadpis.setAttribute('tabindex', '-1'); el.koniecNadpis.focus({ preventScroll: true }); }
  };
  if (animuj && !pohybMalo()) { el.list.classList.add('odchod'); setTimeout(zobraz, 360); } else zobraz();
}

/* ── Nápoveda (zadarmo, bez limitu; video len v rozhraní, na webe vypnuté) ─ */
function napoveda() {
  if (hotovo) return;
  aktivita();
  const zvysne = strana.slova.map((_, k) => k).filter((k) => !najdene.has(k));
  if (!zvysne.length) return;
  if (!rada || najdene.has(rada.k)) rada = { k: zvysne[0], krok: 0 };
  // Budúci Android alebo portál: tu by sa pri minutých minciach ponúkol list nápovedy
  // s dvoma rovnakými tlačidlami (portal.mjs). Na webe je reklamaPovolena false.
  if (portal.reklamaPovolena) { /* zámerne prázdne na webe */ }
  rada.krok = Math.min(2, rada.krok + 1);
  zaznam.napovedy += 1;
  uloz();
  const s = strana.slova[rada.k];
  const g = $('fn-z-rada');
  const a = s.cesta[0];
  if (rada.krok === 1) {
    g.innerHTML = `<circle class="fn-rada" cx="${(a % N) + 0.5}" cy="${((a / N) | 0) + 0.5}" r=".44"/>`;
    el.fakt.innerHTML = `<b>${esc(s.slovo)}</b> <span class="tiche">starts at the circled letter.</span>`;
    oznam(`${s.slovo} starts at row ${((a / N) | 0) + 1}, column ${(a % N) + 1}.`);
  } else {
    g.innerHTML = kapsula(s.cesta, 'fn-rada');
    el.fakt.innerHTML = `<b>${esc(s.slovo)}</b> <span class="tiche">runs along the dashed line. Trace it to add it to the page.</span>`;
    const b = s.cesta[s.cesta.length - 1];
    oznam(`${s.slovo} runs from row ${((a / N) | 0) + 1}, column ${(a % N) + 1} to row ${((b / N) | 0) + 1}, column ${(b % N) + 1}.`);
  }
  track('game_hint', { step: rada.krok, plate: strana.kluc });
}
el.napoveda.addEventListener('click', napoveda);

/* Ťuk na exemplár: nájdený ukáže svoj fakt, nenájdený povie, čo hľadať. */
el.vzorky.addEventListener('click', (e) => {
  const b = e.target.closest('.vz-tl');
  if (!b || hotovo) return;
  const k = Number(b.dataset.k), s = strana.slova[k];
  el.vzorky.querySelectorAll('li.ukazane').forEach((li) => li.classList.remove('ukazane'));
  b.parentElement.classList.add('ukazane');
  if (najdene.has(k)) el.fakt.innerHTML = faktHtml(s);
  else el.fakt.innerHTML = `<span class="tiche">Find</span> <b>${esc(s.slovo)}</b> <span class="tiche">in the grid. It can cross other words.</span>`;
});

/* ── Klávesnica na mriežke ─────────────────────────────────────────────── */
function nastavKurzor(fokus = true) {
  const pred = el.doska.querySelector('.fn-b[tabindex="0"]');
  if (pred) pred.tabIndex = -1;
  const b = $('fn-b' + kurzor);
  b.tabIndex = 0;
  if (fokus) b.focus({ preventScroll: true });
  if (kotva >= 0 && fokus) {
    const cesta = cestaMedzi(N, kotva, kurzor);
    if (cesta && cesta.length > 1) { kresliTah(cesta); ukazStopu(textCesty(cesta)); }
    else { kresliTah(null); kresliKotvu(); ukazStopu(strana.pismena[kotva]); }
  }
}
/* Fokus prišiel na bunku inak než šípkou (Tab, klik): kurzor ide s ním. */
el.doska.addEventListener('focusin', (e) => {
  const id = e.target && e.target.id;
  if (!id || !id.startsWith('fn-b')) return;
  const c = Number(id.slice(4));
  if (c === kurzor) return;
  const pred = el.doska.querySelector('.fn-b[tabindex="0"]');
  if (pred && pred !== e.target) pred.tabIndex = -1;
  e.target.tabIndex = 0;
  kurzor = c;
});
el.doska.addEventListener('keydown', (e) => {
  if (hotovo) return;
  const x = kurzor % N, y = (kurzor / N) | 0;
  let novy = -1;
  switch (e.key) {
    case 'ArrowLeft': novy = x > 0 ? kurzor - 1 : kurzor; break;
    case 'ArrowRight': novy = x < N - 1 ? kurzor + 1 : kurzor; break;
    case 'ArrowUp': novy = y > 0 ? kurzor - N : kurzor; break;
    case 'ArrowDown': novy = y < N - 1 ? kurzor + N : kurzor; break;
    case 'Home': novy = y * N; break;
    case 'End': novy = y * N + N - 1; break;
    case 'Enter': case ' ':
      e.preventDefault(); aktivita();
      if (kotva < 0) { kotva = kurzor; kresliKotvu(); ukazStopu(strana.pismena[kurzor]); oznam(`Start at ${strana.pismena[kurzor]}. Move to the last letter and press Enter.`); }
      else if (kotva === kurzor) { kotva = -1; kresliTah(null); el.stopa.hidden = true; oznam('Selection cleared.'); }
      else {
        const cesta = cestaMedzi(N, kotva, kurzor);
        if (!cesta) { oznam('Those two letters are not in a straight line. Try another letter.'); return; }
        kotva = -1;
        skus(cesta);
      }
      return;
    case 'Escape': kotva = -1; kresliTah(null); el.stopa.hidden = true; return;
    case 'h': case 'H': e.preventDefault(); napoveda(); return;
    default: return;
  }
  e.preventDefault();
  kurzor = novy;
  nastavKurzor(true);
});

function oznam(text) {
  el.hlas.textContent = '';
  setTimeout(() => { el.hlas.textContent = text; }, 30);
}

/* ── Režimy, ďalšia strana, zvuk, plagát, zdieľanie ────────────────────── */
function prepni(novy) {
  if (novy === rezim) return;
  rezim = novy;
  ulozene.rezim = rezim;
  if (rezim === 'den') datum = dnesLokalne();
  uloz();
  aktualizujAdresu();
  nacitajStranu();
}
function aktualizujAdresu() {
  try {
    const u = new URL(location.href);
    u.searchParams.delete('day'); u.searchParams.delete('plate');
    if (rezim === 'strana') u.searchParams.set('plate', String(ulozene.cislo));
    history.replaceState(null, '', u.pathname + (u.search ? u.search : '') + u.hash);
  } catch (e) { /* bez History API */ }
}
el.dnes.addEventListener('click', () => prepni('den'));
el.nekonecne.addEventListener('click', () => prepni('strana'));
el.dalsia.addEventListener('click', () => {
  if (rezim === 'den') prepni('strana');
  else {
    ulozene.cislo = Number(strana.kluc) + 1;
    uloz();
    aktualizujAdresu();
    nacitajStranu();
  }
  // Plagát bol dlhý; nová strana začína hore, pod hlavičkou webu.
  window.scrollTo({ top: 0, behavior: pohybMalo() ? 'auto' : 'smooth' });
});

function nastavZvuk(on) {
  zvuk.nastav(on);
  el.zvuk.setAttribute('aria-pressed', String(on));
  el.zvuk.querySelector('span').textContent = on ? 'Sound on' : 'Sound off';
}
el.zvuk.addEventListener('click', () => {
  const on = el.zvuk.getAttribute('aria-pressed') !== 'true';
  ulozene.nastavenia.zvuk = on;
  uloz();
  nastavZvuk(on);
  track('game_setting', { setting: 'sound', on });
});

el.stiahni.addEventListener('click', () => {
  const text = plagat(strana, { nadpis: nadpisStrany() });
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  const a = document.createElement('a');
  a.href = url; a.download = nazovSuboru(strana);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  track('game_download', { plate: strana.kluc, theme: strana.tema });
});
el.kopiruj.addEventListener('click', () => {
  const n = strana.slova.length, h = zaznam.napovedy;
  const text = `Field Notes, ${nadpisStrany()}: ${strana.nazov}\n${n} of ${n} specimens found, ${h ? h + (h > 1 ? ' hints' : ' hint') : 'no hints'}\nhttps://arling.sk/games/field-notes/`;
  const hotove = (ok) => {
    el.kopiruj.querySelector('span').textContent = ok ? 'Copied' : 'Copy a note';
    if (!ok) { el.kopia.hidden = false; el.kopia.value = text; el.kopia.select(); }
    track('game_share', { copied: ok, plate: strana.kluc });
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => hotove(true), () => hotove(false));
  else hotove(false);
});

/* ── Štart ─────────────────────────────────────────────────────────────── */
nastavZvuk(false);
if (ulozene.nastavenia.zvuk) {
  // Zvuk sa smie zapnúť až po geste hráča; do prvého ťuku ostáva tichý.
  el.zvuk.setAttribute('aria-pressed', 'true');
  el.zvuk.querySelector('span').textContent = 'Sound on';
  const raz = () => { nastavZvuk(true); window.removeEventListener('pointerdown', raz, true); window.removeEventListener('keydown', raz, true); };
  window.addEventListener('pointerdown', raz, true);
  window.addEventListener('keydown', raz, true);
}
nacitajStranu();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(rozloz);
