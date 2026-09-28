/* Bezplatná kontrola zoznamu partnerov proti zoznamu EÚ, celá v prehliadači.
 * Jediné sieťové volania: data/stand.json, data/eu-fsf.json a ukážkový
 * zoznam (beispiel.csv, ukazka.csv alebo example.csv), všetko zo složky
 * /sanktionslisten/ na tomto webe, a počty pre Umami bez obsahu súboru.
 * Ten istý skript beží na /sanktionslisten/ (DE), /sankcny-zoznam/ (SK)
 * a /sanctions-check/ (EN); jazyk určuje <html lang>, texty sú v texty.js.
 * Súbory sa načítajú relatívne k tomuto modulu, nie k stránke.
 * Stráži to ops/saas/sankcie/test/web.test.mjs. */
import { nacitajSubor, odhadniStlpec, menaZoStlpca, MAX_RIADKOV } from './tabulka.js?v=20260927h';
import { postavIndex, subjektyZJson, hladaj, PREDVOLENY_PRAH } from './zhoda.js';
import { jazykStranky, textyPre, VZOR, cisloV, formatDatumV, formatDenV, dovodV } from './texty.js';

const MIN_PRAH = 80;
const JAZYK = jazykStranky(typeof document !== 'undefined' ? document.documentElement.lang : 'de');
const T = textyPre(JAZYK);
const zdroj = (subor) => new URL(subor, import.meta.url).href;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cislo = (n) => cisloV(JAZYK, n);
const udalost = (meno, data) => { try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(meno, data); } catch { /* meranie nesmie zastaviť kontrolu */ } };
const pasmo = (n) => (n <= 25 ? '1-25' : n <= 100 ? '26-100' : n <= 500 ? '101-500' : '500+');
const pasmoZhod = (n) => (n === 0 ? '0' : n <= 3 ? '1-3' : '4+');
/* Počet partnerov (riadkov súboru) s aspoň jednou zhodou. */
const pocetPartnerov = (vysl) => new Set(vysl.map((x) => x.riadok)).size;

const stav = { stand: null, data: null, index: null, riadky: null, nazov: null, stlpec: 0, spojit: null, hlavicka: false, vysledky: null, prah: PREDVOLENY_PRAH, cas: null, orezane: false, pocet: 0 };

/* Dátum a čas zoznamu v jazyku stránky (predvolene nemecky, čas Berlína). */
export function formatDatum(iso, jazyk = 'de') {
  return formatDatumV(jazyk, iso);
}

function hlasenie(text, chyba = false) {
  const el = $('stav');
  el.className = 'sl-stav' + (chyba ? ' chyba' : '');
  el.textContent = text;
}

async function nacitajStand() {
  try {
    const r = await fetch(zdroj('data/stand.json'), { cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    stav.stand = await r.json();
    $('stand').innerHTML = T.standHtml(esc(formatDatum(stav.stand.generovane, JAZYK)), esc(cislo(stav.stand.subjekty)), esc(cislo(stav.stand.osoby)), esc(cislo(stav.stand.organizacie)));
  } catch {
    $('stand').textContent = T.standChyba;
  }
}

async function nacitajIndex() {
  if (stav.index) return;
  hlasenie(T.nacitavam);
  const r = await fetch(zdroj('data/eu-fsf.json'));
  if (!r.ok) throw new Error(T.zoznam + ' ' + r.status);
  const j = await r.json();
  if (stav.stand && j.v.sha256 !== stav.stand.sha256) throw new Error(T.nesedi);
  stav.data = j;
  await new Promise((ok) => setTimeout(ok, 0));
  stav.index = postavIndex(subjektyZJson(j));
}

function naplnStlpce() {
  const sel = $('stlpec');
  const prvy = stav.riadky[0] || [];
  const pocet = Math.max(...stav.riadky.slice(0, 50).map((r) => r.length), 1);
  sel.innerHTML = '';
  for (let k = 0; k < pocet; k++) {
    const pismeno = k < 26 ? String.fromCharCode(65 + k) : String(k + 1);
    const ukazka = (prvy[k] || '').slice(0, 40);
    const o = document.createElement('option');
    o.value = String(k);
    o.textContent = T.stlpec + ' ' + pismeno + (ukazka ? ': ' + ukazka : '');
    sel.appendChild(o);
  }
  // Meno a priezvisko v dvoch stĺpcoch sa kontrolujú spolu (tabulka.js odhadniStlpec, spojit).
  if (stav.spojit !== null) {
    const pis = (k) => (k < 26 ? String.fromCharCode(65 + k) : String(k + 1));
    const o = document.createElement('option');
    o.value = stav.stlpec + '+' + stav.spojit;
    o.textContent = T.stlpec + ' ' + pis(stav.stlpec) + ' + ' + pis(stav.spojit) + ': ' + [(prvy[stav.stlpec] || ''), (prvy[stav.spojit] || '')].join(' + ').slice(0, 40);
    sel.appendChild(o);
  }
  sel.value = stav.spojit !== null ? stav.stlpec + '+' + stav.spojit : String(stav.stlpec);
  $('hlavicka').checked = stav.hlavicka;
}

async function spracuj(nazov, bajty, zdrojSuboru) {
  $('ergebnis').hidden = true;
  stav.nazov = nazov;
  try {
    stav.riadky = await nacitajSubor(nazov, bajty);
  } catch (e) {
    if (e && e.message === 'XLS') hlasenie(T.chybaXls, true);
    else hlasenie(T.chybaSubor, true);
    return;
  }
  if (!stav.riadky.length) { hlasenie(T.prazdny, true); return; }
  const o = odhadniStlpec(stav.riadky);
  stav.stlpec = o.stlpec;
  stav.spojit = o.spojit ?? null;
  stav.hlavicka = o.hlavicka;
  naplnStlpce();
  udalost(zdrojSuboru === 'vzor' ? 'sank_vzor' : 'sank_subor', { riadky: pasmo(stav.riadky.length) });
  await kontroluj(true);
  if (zdrojSuboru === 'vzor' && stav.vysledky) hlasenie(T.vzorHotovo);
}

async function kontroluj(prvy = false) {
  const mena = menaZoStlpca(stav.riadky, stav.stlpec, stav.hlavicka, stav.spojit);
  if (!mena.length) {
    hlasenie(T.bezMien, true);
    stav.vysledky = null;
    $('ergebnis').hidden = false;
    vykresli();
    $('prazdne').hidden = false;
    $('prazdne').textContent = T.bezMien;
    return;
  }
  stav.orezane = mena.length > MAX_RIADKOV;
  const praca = mena.slice(0, MAX_RIADKOV);
  try {
    await nacitajIndex();
  } catch (e) {
    hlasenie(T.chybaZoznamu(e && e.message ? e.message : T.chyba), true);
    return;
  }
  const el = $('stav');
  el.className = 'sl-stav';
  el.innerHTML = '<span id="stav-text"></span><progress id="stav-pruh" max="' + praca.length + '" value="0"></progress>';
  const vysledky = [];
  const DAVKA = 250;
  for (let i = 0; i < praca.length; i += DAVKA) {
    for (const m of praca.slice(i, i + DAVKA)) {
      vysledky.push({ ...m, zhody: hladaj(stav.index, m.meno, { prah: MIN_PRAH, max: 3 }) });
    }
    $('stav-text').textContent = T.priebeh(cislo(Math.min(i + DAVKA, praca.length)), cislo(praca.length));
    $('stav-pruh').value = Math.min(i + DAVKA, praca.length);
    await new Promise((ok) => setTimeout(ok, 0));
  }
  stav.vysledky = vysledky;
  stav.pocet = praca.length;
  stav.cas = new Date();
  hlasenie(T.hotovo(cislo(praca.length)));
  $('ergebnis').hidden = false;
  vykresli();
  const nad = vysledky.filter((v) => v.zhody.some((z) => z.skore >= stav.prah)).length;
  if (prvy) udalost('sank_kontrola', { zhody: pasmoZhod(nad), riadky: pasmo(praca.length) });
  if (prvy) $('ergebnis').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

export function riadkyVysledku(vysledky, prah, subjekty, jazyk = 'de') {
  const t = textyPre(jazyk);
  const out = [];
  for (const v of vysledky || []) {
    for (const z of v.zhody) {
      if (z.skore < prah) continue;
      const [eu, typ, program, akt, odkaz] = subjekty[z.subjekt];
      const url = /^https?:\/\//i.test(odkaz || '') ? odkaz : null; // len http(s) z dát EÚ, nič iné do href
      out.push({ riadok: v.riadok, meno: v.meno, skore: z.skore, alias: z.alias, eu, typ: typ === 'P' ? t.typP : typ === 'E' ? t.typE : String(typ || ''), program, akt, url, dovod: dovodV(jazyk, z) });
    }
  }
  return out;
}

function vykresli() {
  const tb = $('riadky');
  const riadky = stav.vysledky && stav.data ? riadkyVysledku(stav.vysledky, stav.prah, stav.data.s, JAZYK) : [];
  const partneri = pocetPartnerov(riadky);
  const v = stav.data ? stav.data.v : null;
  if (stav.vysledky) {
    $('suhrn').innerHTML = T.suhrnHtml(esc(cislo(stav.pocet)), esc(stav.nazov), partneri ? esc(cislo(partneri)) : '', partneri === 1, stav.prah, stav.orezane ? cislo(MAX_RIADKOV) : '');
  } else $('suhrn').textContent = '';
  const [thRiadok, thMeno, thSkore, thZoznam, thDovod] = T.th;
  tb.innerHTML = riadky.map((r) => '<tr>'
    + '<td class="sl-cislo" data-th="' + esc(thRiadok) + '">' + esc(r.riadok) + '</td>'
    + '<td data-th="' + esc(thMeno) + '">' + esc(r.meno) + '</td>'
    + '<td data-th="' + esc(thSkore) + '"><span class="sl-skore">' + esc(r.skore) + '</span></td>'
    + '<td data-th="' + esc(thZoznam) + '"><span class="sl-meno">' + esc(r.alias) + '</span>'
    + '<span class="sl-ref">' + esc(r.eu) + ', ' + esc(r.typ) + ', ' + esc(T.program) + ' ' + esc(r.program)
    + (r.url ? ', <a href="' + esc(r.url) + '" rel="noopener">' + esc(T.akt) + ' ' + esc(r.akt) + '</a>' : ', ' + esc(r.akt)) + '</span></td>'
    + '<td data-th="' + esc(thDovod) + '">' + esc(r.dovod) + '</td></tr>').join('');
  $('tab-obal').hidden = !riadky.length;
  const prazdne = $('prazdne');
  prazdne.hidden = Boolean(riadky.length) || !stav.vysledky;
  prazdne.textContent = T.prazdne(stav.prah);
  $('verzia').innerHTML = v ? T.verziaHtml(esc(formatDatum(v.generovane, JAZYK)), esc(cislo(v.subjekty)), esc(v.sha256),
    v.stiahnute ? esc(formatDenV(JAZYK, v.stiahnute)) : '', esc(stav.cas ? formatDatum(stav.cas.toISOString(), JAZYK) : '')) : '';
  $('export').disabled = !stav.vysledky;
}

export function csvVysledku(riadky, v, cas, jazyk = 'de') {
  const t = textyPre(jazyk);
  const pole = (x) => { const s = String(x ?? ''); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const riadok = (r) => [r.riadok, r.meno, r.skore, r.alias, r.eu, r.typ, r.program, r.akt, r.url, r.dovod, v.generovane, v.sha256, cas];
  const telo = riadky.length ? riadky.map((r) => riadok(r).map(pole).join(';')) : [['', t.csvNic, '', '', '', '', '', '', '', '', v.generovane, v.sha256, cas].map(pole).join(';')];
  return '﻿' + [t.csv.join(';'), ...telo].join('\r\n') + '\r\n';
}

function stiahni() {
  if (!stav.vysledky || !stav.data) return;
  const riadky = riadkyVysledku(stav.vysledky, stav.prah, stav.data.s, JAZYK);
  const text = csvVysledku(riadky, stav.data.v, stav.cas.toISOString(), JAZYK);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = T.subor + stav.cas.toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  udalost('sank_export', { zhody: pasmoZhod(pocetPartnerov(riadky)) });
}

function zapoj() {
  const vstup = $('subor');
  const drop = $('drop');
  const otvor = () => vstup.click();
  $('vybrat').addEventListener('click', (e) => { e.stopPropagation(); otvor(); });
  // Klik myšou na plochu mimo tlačidiel otvorí výber; klávesnica ide cez tlačidlo výberu súboru.
  drop.addEventListener('click', (e) => { if (!e.target.closest('button')) otvor(); });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('nad'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('nad'));
  drop.addEventListener('drop', async (e) => {
    e.preventDefault();
    drop.classList.remove('nad');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) await spracuj(f.name, await f.arrayBuffer(), 'subor');
  });
  vstup.addEventListener('change', async () => {
    const f = vstup.files && vstup.files[0];
    if (f) await spracuj(f.name, await f.arrayBuffer(), 'subor');
    vstup.value = '';
  });
  $('vzor').addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      const r = await fetch(zdroj(VZOR[JAZYK]));
      if (!r.ok) throw new Error(String(r.status));
      await spracuj(VZOR[JAZYK], await r.arrayBuffer(), 'vzor');
    } catch { hlasenie(T.vzorChyba, true); }
  });
  $('stlpec').addEventListener('change', async () => { const [a, b] = $('stlpec').value.split('+'); stav.stlpec = Number(a); stav.spojit = b === undefined ? null : Number(b); await kontroluj(); });
  $('hlavicka').addEventListener('change', async () => { stav.hlavicka = $('hlavicka').checked; await kontroluj(); });
  $('prah').addEventListener('input', () => { stav.prah = Number($('prah').value); $('prah-hodnota').textContent = String(stav.prah); vykresli(); });
  $('export').addEventListener('click', stiahni);
  $('znova').addEventListener('click', () => { $('pruefen').scrollIntoView({ block: 'start' }); otvor(); });
  $('zaujem').addEventListener('click', () => {
    udalost('sank_straz_klik', { zhody: stav.vysledky ? pasmoZhod(pocetPartnerov(riadkyVysledku(stav.vysledky, stav.prah, stav.data.s))) : 'bez' });
    $('zaujem').disabled = true;
    $('zaujem-dik').hidden = false;
  });
}

if (typeof document !== 'undefined' && document.getElementById('kontrola')) {
  zapoj();
  nacitajStand();
}
