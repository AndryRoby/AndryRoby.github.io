/* Bezplatná kontrola zoznamu partnerov proti zoznamu EÚ, celá v prehliadači.
 * Jediné sieťové volania: data/stand.json, data/eu-fsf.json, beispiel.csv
 * (všetko z tejto stránky) a počty pre Umami bez obsahu súboru.
 * Stráži to ops/saas/sankcie/test/web.test.mjs. */
import { nacitajSubor, odhadniStlpec, menaZoStlpca, MAX_RIADKOV } from './tabulka.js';
import { postavIndex, subjektyZJson, hladaj, dovodDe, PREDVOLENY_PRAH } from './zhoda.js';

const MIN_PRAH = 80;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cislo = (n) => new Intl.NumberFormat('de-DE').format(n);
const udalost = (meno, data) => { try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(meno, data); } catch { /* meranie nesmie zastaviť kontrolu */ } };
const pasmo = (n) => (n <= 25 ? '1-25' : n <= 100 ? '26-100' : n <= 500 ? '101-500' : '500+');
const pasmoZhod = (n) => (n === 0 ? '0' : n <= 3 ? '1-3' : '4+');
/* Počet partnerov (riadkov súboru) s aspoň jednou zhodou. */
const pocetPartnerov = (vysl) => new Set(vysl.map((x) => x.riadok)).size;

const stav = { stand: null, data: null, index: null, riadky: null, nazov: null, stlpec: 0, hlavicka: false, vysledky: null, prah: PREDVOLENY_PRAH, cas: null, orezane: false, pocet: 0 };

export function formatDatum(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || '');
  const f = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return f.format(d) + ' Uhr';
}
const formatDen = (iso) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));

function hlasenie(text, chyba = false) {
  const el = $('stav');
  el.className = 'sl-stav' + (chyba ? ' chyba' : '');
  el.textContent = text;
}

async function nacitajStand() {
  try {
    const r = await fetch('data/stand.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    stav.stand = await r.json();
    $('stand').innerHTML = 'EU-Liste: Datei der Kommission vom <b>' + esc(formatDatum(stav.stand.generovane)) + '</b>, ' + esc(cislo(stav.stand.subjekty)) + ' Einträge (' + esc(cislo(stav.stand.osoby)) + ' Personen, ' + esc(cislo(stav.stand.organizacie)) + ' Organisationen).';
  } catch {
    $('stand').textContent = 'Der Stand der EU-Liste konnte nicht geladen werden. Laden Sie die Seite neu; ohne Liste ist keine Prüfung möglich.';
  }
}

async function nacitajIndex() {
  if (stav.index) return;
  hlasenie('EU-Liste wird geladen (etwa 420 kB) und vorbereitet.');
  const r = await fetch('data/eu-fsf.json');
  if (!r.ok) throw new Error('Liste ' + r.status);
  const j = await r.json();
  if (stav.stand && j.v.sha256 !== stav.stand.sha256) throw new Error('Listenstand passt nicht zusammen. Bitte Seite neu laden.');
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
    const pismeno = k < 26 ? String.fromCharCode(65 + k) : 'Spalte ' + (k + 1);
    const ukazka = (prvy[k] || '').slice(0, 40);
    const o = document.createElement('option');
    o.value = String(k);
    o.textContent = 'Spalte ' + pismeno + (ukazka ? ': ' + ukazka : '');
    sel.appendChild(o);
  }
  sel.value = String(stav.stlpec);
  $('hlavicka').checked = stav.hlavicka;
}

async function spracuj(nazov, bajty, zdroj) {
  $('ergebnis').hidden = true;
  stav.nazov = nazov;
  try {
    stav.riadky = await nacitajSubor(nazov, bajty);
  } catch (e) {
    if (e && e.message === 'XLS') hlasenie('Alte .xls-Dateien können wir nicht lesen. Speichern Sie die Datei in Excel als .xlsx oder als „CSV UTF-8“ und laden Sie sie erneut.', true);
    else hlasenie('Die Datei konnte nicht gelesen werden. Unterstützt werden .xlsx und .csv. Speichern Sie die Tabelle notfalls als „CSV UTF-8“.', true);
    return;
  }
  if (!stav.riadky.length) { hlasenie('Die Datei ist leer. Wählen Sie eine Tabelle mit Namen.', true); return; }
  const o = odhadniStlpec(stav.riadky);
  stav.stlpec = o.stlpec;
  stav.hlavicka = o.hlavicka;
  naplnStlpce();
  udalost(zdroj === 'vzor' ? 'sank_vzor' : 'sank_subor', { riadky: pasmo(stav.riadky.length) });
  await kontroluj(true);
  if (zdroj === 'vzor' && stav.vysledky) hlasenie('Fertig. Die Beispielliste ist erfunden, bis auf zwei Namen, die so oder ähnlich auf der EU-Liste stehen.');
}

async function kontroluj(prvy = false) {
  const mena = menaZoStlpca(stav.riadky, stav.stlpec, stav.hlavicka);
  if (!mena.length) {
    const veta = 'In der gewählten Spalte stehen keine Namen. Wählen Sie im Ergebnis eine andere Spalte.';
    hlasenie(veta, true);
    stav.vysledky = null;
    $('ergebnis').hidden = false;
    vykresli();
    $('prazdne').hidden = false;
    $('prazdne').textContent = veta;
    return;
  }
  stav.orezane = mena.length > MAX_RIADKOV;
  const praca = mena.slice(0, MAX_RIADKOV);
  try {
    await nacitajIndex();
  } catch (e) {
    hlasenie('Die EU-Liste konnte nicht geladen werden (' + (e && e.message ? e.message : 'Fehler') + '). Ihre Datei wurde nicht verschickt. Bitte später erneut versuchen.', true);
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
    $('stav-text').textContent = cislo(Math.min(i + DAVKA, praca.length)) + ' von ' + cislo(praca.length) + ' Namen geprüft.';
    $('stav-pruh').value = Math.min(i + DAVKA, praca.length);
    await new Promise((ok) => setTimeout(ok, 0));
  }
  stav.vysledky = vysledky;
  stav.pocet = praca.length;
  stav.cas = new Date();
  hlasenie('Fertig. ' + cislo(praca.length) + ' Namen geprüft.');
  $('ergebnis').hidden = false;
  vykresli();
  const nad = vysledky.filter((v) => v.zhody.some((z) => z.skore >= stav.prah)).length;
  if (prvy) udalost('sank_kontrola', { zhody: pasmoZhod(nad), riadky: pasmo(praca.length) });
  if (prvy) $('ergebnis').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

export function riadkyVysledku(vysledky, prah, subjekty) {
  const out = [];
  for (const v of vysledky || []) {
    for (const z of v.zhody) {
      if (z.skore < prah) continue;
      const [eu, typ, program, akt, odkaz] = subjekty[z.subjekt];
      const url = /^https?:\/\//i.test(odkaz || '') ? odkaz : null; // len http(s) z dát EÚ, nič iné do href
      out.push({ riadok: v.riadok, meno: v.meno, skore: z.skore, alias: z.alias, eu, typ: typ === 'P' ? 'Person' : typ === 'E' ? 'Organisation' : String(typ || ''), program, akt, url, dovod: dovodDe(z) });
    }
  }
  return out;
}

function vykresli() {
  const tb = $('riadky');
  const riadky = stav.vysledky && stav.data ? riadkyVysledku(stav.vysledky, stav.prah, stav.data.s) : [];
  const partneri = pocetPartnerov(riadky);
  const v = stav.data ? stav.data.v : null;
  if (stav.vysledky) {
    $('suhrn').innerHTML = '<b>' + esc(cislo(stav.pocet)) + '</b> Namen aus „' + esc(stav.nazov) + '“ geprüft. '
      + (partneri ? '<b>' + esc(cislo(partneri)) + '</b> ' + (partneri === 1 ? 'Name hat' : 'Namen haben') + ' einen Treffer ab Score ' + stav.prah + ' zur Prüfung.' : 'Kein Treffer ab Score ' + stav.prah + '.')
      + (stav.orezane ? ' Geprüft wurden nur die ersten ' + cislo(MAX_RIADKOV) + ' Namen.' : '');
  } else $('suhrn').textContent = '';
  tb.innerHTML = riadky.map((r) => '<tr>'
    + '<td class="sl-cislo" data-th="Zeile">' + esc(r.riadok) + '</td>'
    + '<td data-th="Name in Ihrer Liste">' + esc(r.meno) + '</td>'
    + '<td data-th="Score"><span class="sl-skore">' + esc(r.skore) + '</span></td>'
    + '<td data-th="Eintrag in der EU-Liste"><span class="sl-meno">' + esc(r.alias) + '</span>'
    + '<span class="sl-ref">' + esc(r.eu) + ', ' + esc(r.typ) + ', Programm ' + esc(r.program)
    + (r.url ? ', <a href="' + esc(r.url) + '" rel="noopener">Rechtsakt ' + esc(r.akt) + '</a>' : ', ' + esc(r.akt)) + '</span></td>'
    + '<td data-th="Grund">' + esc(r.dovod) + '</td></tr>').join('');
  $('tab-obal').hidden = !riadky.length;
  const prazdne = $('prazdne');
  prazdne.hidden = Boolean(riadky.length) || !stav.vysledky;
  prazdne.textContent = 'Kein Name aus Ihrer Liste erreicht Score ' + stav.prah + '. Das heißt nicht, dass keiner Ihrer Partner betroffen ist: geprüft wurde nur die EU-Finanzsanktionsliste, und Schreibweisen, die zu stark abweichen, erkennt das Werkzeug nicht. Mit dem Regler können Sie die Schwelle bis 80 senken.';
  $('verzia').innerHTML = v ? 'Geprüft gegen: EU-Finanzsanktionsliste, Datei der Europäischen Kommission vom ' + esc(formatDatum(v.generovane))
    + ', ' + esc(cislo(v.subjekty)) + ' Einträge, SHA-256 <code>' + esc(v.sha256) + '</code>'
    + (v.stiahnute ? ', von uns heruntergeladen am ' + esc(formatDen(v.stiahnute)) : '')
    + '. Prüfung am ' + esc(stav.cas ? formatDatum(stav.cas.toISOString()) : '') + ' in diesem Browser.' : '';
  $('export').disabled = !stav.vysledky;
}

export function csvVysledku(riadky, v, cas) {
  const pole = (x) => { const s = String(x ?? ''); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const hlava = ['Zeile', 'Name in Ihrer Liste', 'Score', 'Name in der EU-Liste', 'EU-Referenz', 'Typ', 'Programm', 'Rechtsakt', 'Link zum Rechtsakt', 'Grund', 'Listendatei vom', 'SHA-256 der Listendatei', 'Prüfung am'];
  const riadok = (r) => [r.riadok, r.meno, r.skore, r.alias, r.eu, r.typ, r.program, r.akt, r.url, r.dovod, v.generovane, v.sha256, cas];
  const telo = riadky.length ? riadky.map((r) => riadok(r).map(pole).join(';')) : [['', 'Kein Treffer', '', '', '', '', '', '', '', '', v.generovane, v.sha256, cas].map(pole).join(';')];
  return '﻿' + [hlava.join(';'), ...telo].join('\r\n') + '\r\n';
}

function stiahni() {
  if (!stav.vysledky || !stav.data) return;
  const riadky = riadkyVysledku(stav.vysledky, stav.prah, stav.data.s);
  const text = csvVysledku(riadky, stav.data.v, stav.cas.toISOString());
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = 'sanktionslisten-pruefung-' + stav.cas.toISOString().slice(0, 10) + '.csv';
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
  // Klik myšou na plochu mimo tlačidiel otvorí výber; klávesnica ide cez tlačidlo „Datei wählen“.
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
      const r = await fetch('beispiel.csv');
      if (!r.ok) throw new Error(String(r.status));
      await spracuj('beispiel.csv', await r.arrayBuffer(), 'vzor');
    } catch { hlasenie('Die Beispielliste konnte nicht geladen werden.', true); }
  });
  $('stlpec').addEventListener('change', async () => { stav.stlpec = Number($('stlpec').value); await kontroluj(); });
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
