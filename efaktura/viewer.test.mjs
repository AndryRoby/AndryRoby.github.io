/* Testy relácie 246: stránka XRechnung Viewer (/efaktura/de/xrechnung-viewer/) a zmeny v app.js, na ktorých stojí.
 *
 * (a) Náhľad povie, prečo doklad nevykreslil: PDF (napríklad ZUGFeRD), CII, poškodené XML (veta parsera v jazyku
 *     stránky) alebo iný hlavný prvok. Predtým dostali všetky štyri prípady tú istú vetu „len UBL 2.1“.
 * (b) Meranie raz na vstup: efaktura_nahlad, efaktura_cii a efaktura_nahlad_odmietnute sa pošlú raz na súbor, nie pri
 *     každom prepnutí záložky; CII sa počíta raz, či ho človek načítal v náhľade alebo v kontrole.
 * (c) Prepnutie na Kontrolu skontroluje súbor načítaný v náhľade (nález 24 kontroly inej AI pri 219), raz na vstup.
 *     Mutačná kontrola: prepni() bez nového riadku kontrolu nespustí, test by teda bez opravy zlyhal.
 * (d) Stránka: H1, title, canonical na seba, bez hreflang, JSON-LD (SoftwareApplication, FAQPage = FAQ v HTML),
 *     predvolená záložka Vorschau, poctivá veta o CII, platený krok s existujúcou udalosťou, odkazy, sitemap, llms.txt.
 * Opravy po bráne 246 (ops/ai/kontrola/2026-10-26-246-xrechnung-viewer.md, pokus 1), každá s mutáciou:
 * (f) P1 kotvy: záložku prepne len kotva panela (štart aj hashchange), iná kotva nechá záložku a kontrolu nespustí.
 * (e) P3 príliš veľký súbor zneplatní čítanie predošlého súboru (v oboch poradiach odpovedí).
 * (g) P4 meno vloženého XML: po vzore a vložení vlastného XML stav aj protokol hlásia „eingefuegt.xml“.
 * (h) P5 doklad na mobile: bunky tabuliek nesú data-th, CSS skladá riadky do blokov len na obrazovke (tlač A4 ostáva).
 * (i) R55 zápis: nemecké dátumy a sumy bez zaokrúhlenia, IBAN po štyroch; ostatné jazyky bez zmeny zápisu súm.
 * (j) R8 parser: neplatná znaková referencia je chyba v štyroch jazykoch, nie RangeError.
 * (k) R2 a R4 meranie: videnie ceny aj v cenníku (miesto), CII v kontrole nie je „ok“.
 * Opravy po bráne 246 (pokus 2, ops/ai/kontrola/2026-10-26-246-xrechnung-viewer.md, nálezy N1 a N2):
 * (h) N1 doklad v ráme: bloky dokladu podľa šírky rámu (container query), nie okna; tabuľka len tam, kde sa zmestí
 *     (zmerané šírky rámu 246/sirky.mjs), takže pri 1081 až 1290 px nie je stĺpec Nettobetrag za posuvníkom.
 * (l) N2 riadok súčtov generátora píše sumu ako doklad pod ním (nemecky 1.234,50 €), SK, CS a EN bez zmeny.
 * Funkcie sa ťahajú zo zdroja app.js a spúšťajú v Node so zástupnými závislosťami (ako trenie.test.mjs).
 * usage: node --test products/arling-sk/efaktura/viewer.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parsujXml } from './parser.mjs';
import { vykresliNahlad, zapisSumy, TEXTY_NAHLADU } from './nahlad.js';
import { vytvorUbl, prepocitaj, prazdnaFaktura, zCentov } from './ubl.js';

const TU = fileURLToPath(new URL('.', import.meta.url));
const HUB = join(TU, '..');
const APP = readFileSync(new URL('./app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const STRANKA = readFileSync(join(TU, 'de', 'xrechnung-viewer', 'index.html'), 'utf8').replace(/\r\n/g, '\n');

function zdrojFunkcie(meno, zdroj = APP) {
  const od = zdroj.indexOf('function ' + meno + '(');
  assert.ok(od >= 0, 'app.js: funkcia ' + meno + ' sa nenašla');
  let hlbka = 0;
  for (let j = zdroj.indexOf('{', od); j < zdroj.length; j++) {
    if (zdroj[j] === '{') hlbka += 1;
    else if (zdroj[j] === '}') { hlbka -= 1; if (hlbka === 0) return zdroj.slice(od, j + 1); }
  }
  throw new Error('app.js: telo funkcie ' + meno + ' sa neskončilo');
}
// Texty T z app.js (rovnaký výber ako test 35 v tests.mjs).
const T_ALL = (() => {
  const zac = APP.indexOf('const T = {');
  const kon = APP.indexOf('}[LANG];', zac);
  const tvar3 = (n, a, b, c) => (n === 1 ? a : n >= 2 && n <= 4 ? b : c);
  const tvar2 = (n, a, b) => (n === 1 ? a : b);
  return new Function('tvar2', 'tvar3', 'return ' + APP.slice(zac + 'const T = '.length, kon + 1))(tvar2, tvar3);
})();
const VZOR_DE = (() => {
  const zac = APP.indexOf('const VZOR_XML_DE = `');
  return APP.slice(APP.indexOf('<?xml', zac), APP.indexOf('\n`;', zac));
})();
const CII = '<?xml version="1.0" encoding="UTF-8"?>\n<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"><rsm:ExchangedDocument/></rsm:CrossIndustryInvoice>';
const PDF = '%PDF-1.7\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog >>\nendobj\n';

// ---------------------------------------------------------------- zástupná stránka pre náhľad

class Uzol {
  constructor() { this.deti = []; this.textContent = ''; this.hidden = true; }
  get firstChild() { return this.deti[0] || null; }
  removeChild(d) { this.deti.splice(this.deti.indexOf(d), 1); return d; }
  appendChild(d) { this.deti.push(d); return d; }
}

function nahlad(lang = 'de') {
  const prvky = { doklad: new Uzol(), 'nahlad-stav': new Uzol(), pdf: new Uzol() };
  const udalosti = [];
  const parsovania = { n: 0 };
  const parsuj = (t) => { parsovania.n += 1; return parsujXml(t); };
  const vykresli = (koren, ciel) => { ciel.appendChild({ koren: koren.local }); };
  const telo = 'let xmlText = ""; let vstupJeUkazka = false; let vstupCislo = 0; const zmerane = new Set();\n'
    + ['zmerajRaz', 'vycisti', 'vykresliVstupnyDoklad', 'dovodBezNahladu'].map((m) => zdrojFunkcie(m)).join('\n')
    + '\nreturn { nacitaj: (t, u) => { vstupCislo += 1; xmlText = t; vstupJeUkazka = !!u; }, vykresli: vykresliVstupnyDoklad, zmerajRaz };';
  const api = new Function('$', 'T', 'LANG', 'parsujXml', 'vykresliNahlad', 'track', telo)(
    (id) => prvky[id] || null, T_ALL[lang], lang, parsuj, vykresli, (n, d) => udalosti.push([n, d]));
  return Object.assign(api, { prvky, udalosti, parsovania });
}

// ---------------------------------------------------------------- (a) prečo sa doklad nevykreslil

test('(a) PDF: veta o ZUGFeRD a PDF, súbor sa ako XML ani nečíta, jedna udalosť s dôvodom pdf', () => {
  const s = nahlad('de');
  s.nacitaj(PDF);
  s.vykresli();
  assert.equal(s.prvky['nahlad-stav'].textContent, T_ALL.de.pdfNahlad);
  assert.equal(s.parsovania.n, 0, 'PDF sa nemá parsovať ako XML');
  assert.equal(s.prvky.doklad.deti.length, 0);
  assert.equal(s.prvky.pdf.hidden, true, 'tlačidlo PDF pri odmietnutom súbore');
  assert.deepEqual(s.udalosti, [['efaktura_nahlad_odmietnute', { dovod: 'pdf', produkt: 'efaktura', jazyk: 'de' }]]);
});

test('(a) CII: vlastná veta o CII namiesto „len UBL“ a udalosť efaktura_cii z náhľadu', () => {
  const s = nahlad('de');
  s.nacitaj(CII);
  s.vykresli();
  assert.equal(s.prvky['nahlad-stav'].textContent, T_ALL.de.ciiNahlad);
  assert.notEqual(T_ALL.de.ciiNahlad, T_ALL.de.typNieJeUbl);
  assert.deepEqual(s.udalosti, [['efaktura_cii', { miesto: 'nahlad', produkt: 'efaktura', jazyk: 'de' }]]);
});

test('(a) poškodené XML: veta parsera v jazyku stránky (predtým „len UBL 2.1“), udalosť s dôvodom xml', () => {
  for (const lang of ['de', 'en', 'sk', 'cs']) {
    const s = nahlad(lang);
    const zle = '<Invoice><cbc:ID>1</Invoice>';
    s.nacitaj(zle);
    s.vykresli();
    const ocakavana = parsujXml(zle).chyba[lang];
    assert.ok(ocakavana && ocakavana.length > 10);
    assert.equal(s.prvky['nahlad-stav'].textContent, ocakavana, lang);
    assert.deepEqual(s.udalosti.map((u) => [u[0], u[1].dovod]), [['efaktura_nahlad_odmietnute', 'xml']]);
  }
});

test('(a) iný hlavný prvok: pôvodná veta typNieJeUbl a udalosť s dôvodom koren', () => {
  const s = nahlad('de');
  s.nacitaj('<?xml version="1.0"?><Order xmlns="urn:example:order"><ID>7</ID></Order>');
  s.vykresli();
  assert.equal(s.prvky['nahlad-stav'].textContent, T_ALL.de.typNieJeUbl);
  assert.deepEqual(s.udalosti.map((u) => [u[0], u[1].dovod]), [['efaktura_nahlad_odmietnute', 'koren']]);
});

test('(a) UBL: doklad sa vykreslí, tlačidlo PDF sa ukáže a stav je prázdny', () => {
  const s = nahlad('de');
  s.nacitaj(VZOR_DE, true);
  s.vykresli();
  assert.equal(s.prvky.doklad.deti.length, 1);
  assert.equal(s.prvky.doklad.deti[0].koren, 'Invoice');
  assert.equal(s.prvky['nahlad-stav'].textContent, '');
  assert.equal(s.prvky.pdf.hidden, false);
});

test('(a) texty: ciiNahlad a pdfNahlad vo všetkých štyroch jazykoch, bez pomlčiek, nemecké menujú UBL 2.1 a CII', () => {
  for (const lang of ['sk', 'cs', 'de', 'en']) {
    for (const k of ['ciiNahlad', 'pdfNahlad']) {
      const v = T_ALL[lang][k];
      assert.ok(typeof v === 'string' && v.length > 60, lang + '.' + k);
      assert.ok(!/[–—]/.test(v), lang + '.' + k + ' má pomlčku');
      assert.ok(v.includes('UBL 2.1') && v.includes('CII'), lang + '.' + k + ' nemenuje UBL 2.1 a CII');
    }
  }
  assert.ok(T_ALL.de.ciiNahlad.includes('CrossIndustryInvoice'));
  assert.ok(/ZUGFeRD/.test(T_ALL.de.pdfNahlad) && /PDF/.test(T_ALL.de.pdfNahlad));
});

// ---------------------------------------------------------------- (b) meranie raz na vstup

test('(b) efaktura_nahlad raz na vstup aj pri opakovanom vykreslení (prepínanie záložiek), nový vstup novú udalosť', () => {
  const s = nahlad('de');
  s.nacitaj(VZOR_DE, true);
  s.vykresli();
  s.vykresli();
  s.vykresli();
  assert.deepEqual(s.udalosti, [['efaktura_nahlad', { vzor: true, produkt: 'efaktura', jazyk: 'de' }]]);
  s.nacitaj(VZOR_DE, false);
  s.vykresli();
  assert.deepEqual(s.udalosti.map((u) => u[1].vzor), [true, false], 'vlastný súbor po vzore sa nezapočítal');
});

test('(b) CII sa počíta raz na vstup, aj keď ho potom skontroluje záložka Kontrola', () => {
  const s = nahlad('de');
  s.nacitaj(CII);
  s.vykresli();
  // Ten istý riadok, aký je v spustiKontrolu().
  assert.equal(s.zmerajRaz('efaktura_cii', { miesto: 'kontrola', produkt: 'efaktura', jazyk: 'de' }), false);
  assert.equal(s.udalosti.filter((u) => u[0] === 'efaktura_cii').length, 1);
  assert.ok(zdrojFunkcie('spustiKontrolu').includes("if (v.typ === 'CII') zmerajRaz('efaktura_cii', { miesto: 'kontrola', produkt: 'efaktura', jazyk: LANG });"),
    'kontrola CII nepočíta');
  assert.ok(zdrojFunkcie('prijmiText').includes('vstupCislo += 1;'), 'nový vstup nedostane nové číslo');
});

test('(b) do udalostí nejde nič zo súboru (len druh výsledku)', () => {
  const s = nahlad('de');
  for (const t of [PDF, CII, '<a><b></a>', VZOR_DE]) { s.nacitaj(t); s.vykresli(); }
  const text = JSON.stringify(s.udalosti);
  for (const zakazane of ['Musterwerkstatt', '2026-0142', 'DE123456789', 'CrossIndustryInvoice', '%PDF']) assert.ok(!text.includes(zakazane), zakazane);
  for (const [, d] of s.udalosti) assert.deepEqual(Object.keys(d).filter((k) => !['dovod', 'miesto', 'vzor', 'produkt', 'jazyk'].includes(k)), []);
});

// ---------------------------------------------------------------- (c) Kontrola po prepnutí

function prepinac(zdrojPrepni) {
  const telo = 'let aktivna = "nahlad"; const PANELY = ["kontrola", "nahlad", "vytvorit"]; const vstupBlok = null;\n'
    + 'let xmlText = ""; let vstupCislo = 0; let kontrolaVstupu = -1; let kontroly = 0;\n'
    + 'function vykresliVstupnyDoklad() {} function prekresliGenerator() {}\n'
    + 'function spustiKontrolu() { kontroly += 1; kontrolaVstupu = vstupCislo; }\n'
    + zdrojPrepni
    + '\nreturn { prepni, nacitaj: (t) => { vstupCislo += 1; xmlText = t; }, kontroly: () => kontroly };';
  return new Function('$', 'document', 'history', telo)(() => null, { querySelector: () => null }, { replaceState() {} });
}

test('(c) súbor z náhľadu sa pri prepnutí na Kontrolu skontroluje raz, nový súbor znova', () => {
  assert.ok(zdrojFunkcie('spustiKontrolu').includes('kontrolaVstupu = vstupCislo;'), 'kontrola si nezapíše, ktorý vstup skontrolovala');
  const p = prepinac(zdrojFunkcie('prepni'));
  p.prepni('kontrola');
  assert.equal(p.kontroly(), 0, 'bez súboru sa nemá nič kontrolovať');
  p.nacitaj(CII);
  p.prepni('kontrola');
  assert.equal(p.kontroly(), 1);
  p.prepni('nahlad');
  p.prepni('kontrola');
  assert.equal(p.kontroly(), 1, 'ten istý súbor sa skontroloval znova');
  p.nacitaj(VZOR_DE);
  p.prepni('kontrola');
  assert.equal(p.kontroly(), 2);
});

test('(c) mutácia: prepni() bez opravy kontrolu nespustí (test by bez opravy zlyhal)', () => {
  const riadok = "  if (meno === 'kontrola' && xmlText.trim() && kontrolaVstupu !== vstupCislo) spustiKontrolu();\n";
  const zdroj = zdrojFunkcie('prepni');
  assert.ok(zdroj.includes(riadok), 'riadok opravy sa v prepni() nenašiel');
  const bez = prepinac(zdroj.replace(riadok, ''));
  bez.nacitaj(CII);
  bez.prepni('kontrola');
  assert.equal(bez.kontroly(), 0);
});

// ---------------------------------------------------------------- (e) súbeh pri čítaní súboru (AGENTS.md bod 12a)

function citanie(zdroj) {
  const citace = [];
  class Citac { readAsText(f) { this.f = f; citace.push(this); } }
  const prijate = [];
  const telo = 'let citanieCislo = 0; const MAX_MB = 12;\n'
    + 'function prijmiText(t, n) { citanieCislo += 1; prijate.push(n); }\n'
    + 'function stavVstupu() {}\n'
    + zdroj
    + '\nreturn { prijmiSubor, vloz: (t) => prijmiText(t, "vlozene.xml") };';
  const api = new Function('FileReader', 'T', 'prijate', telo)(Citac, { prilisVelky: () => '', citam: '', nacitajteSubor: '' }, prijate);
  const subor = (meno) => ({ name: meno, size: 100 });
  return { ...api, subor, citace, prijate, dokonci: (i) => { citace[i].result = '<x/>'; citace[i].onload(); } };
}

test('(e) dva súbory rýchlo po sebe: prijme sa len posledný vybraný, v oboch poradiach odpovedí', () => {
  assert.ok(zdrojFunkcie('prijmiText').includes('citanieCislo += 1;'), 'prijatý vstup nezvýši poradie čítania');
  const zdroj = zdrojFunkcie('prijmiSubor');
  for (const poradie of [[1, 0], [0, 1]]) {
    const c = citanie(zdroj);
    c.prijmiSubor(c.subor('a.xml'));
    c.prijmiSubor(c.subor('b.xml'));
    for (const i of poradie) c.dokonci(i);
    assert.deepEqual(c.prijate, ['b.xml'], 'poradie odpovedí ' + poradie.join(','));
  }
});

test('(e) vložené XML počas čítania súboru: neskorá odpoveď súboru ho neprepíše', () => {
  const c = citanie(zdrojFunkcie('prijmiSubor'));
  c.prijmiSubor(c.subor('a.xml'));
  c.vloz('<Invoice/>');
  c.dokonci(0);
  assert.deepEqual(c.prijate, ['vlozene.xml']);
});

test('(e) mutácia: prijmiSubor bez kontroly poradia prijme starú odpoveď (test by bez opravy zlyhal)', () => {
  const zdroj = zdrojFunkcie('prijmiSubor');
  const bez = zdroj.replace("r.onload = () => { if (moje === citanieCislo) prijmiText(String(r.result || ''), f.name); };", "r.onload = () => prijmiText(String(r.result || ''), f.name);");
  assert.notEqual(bez, zdroj, 'riadok opravy sa v prijmiSubor() nenašiel');
  const c = citanie(bez);
  c.prijmiSubor(c.subor('a.xml'));
  c.prijmiSubor(c.subor('b.xml'));
  c.dokonci(1);
  c.dokonci(0);
  assert.deepEqual(c.prijate, ['b.xml', 'a.xml']);
});

// P3 brány 246: príliš veľký súbor je tiež novší vstup. Zástupca zapisuje hlášky stavu, aby bolo vidno, čo človek číta.
function citanieSoStavom(zdroj) {
  const citace = [];
  class Citac { readAsText(f) { this.f = f; citace.push(this); } }
  const prijate = [], stavy = [];
  const telo = 'let citanieCislo = 0; const MAX_MB = 12;\n'
    + 'function prijmiText(t, n) { citanieCislo += 1; prijate.push(n); stavVstupu("Geladen: " + n); }\n'
    + 'function stavVstupu(s) { stavy.push(s); }\n'
    + zdroj
    + '\nreturn { prijmiSubor };';
  const T = { prilisVelky: (mb) => 'zu groß (' + mb + ' MB)', citam: 'wird gelesen', nacitajteSubor: 'bitte laden' };
  const api = new Function('FileReader', 'T', 'prijate', 'stavy', telo)(Citac, T, prijate, stavy);
  return {
    ...api, citace, prijate, stavy,
    maly: (meno) => ({ name: meno, size: 2048 }),
    velky: (meno) => ({ name: meno, size: 13 * 1024 * 1024 }),
    dokonci: (i) => { citace[i].result = '<x/>'; citace[i].onload(); },
    stav: () => stavy[stavy.length - 1],
  };
}

test('(e) P3: príliš veľký súbor zneplatní čítanie predošlého, v oboch poradiach odpovede', () => {
  const zdroj = zdrojFunkcie('prijmiSubor');
  // Poradie 1: a.xml sa číta, človek vyberie príliš veľký b.xml, až potom dôjde odpoveď a.xml.
  const c = citanieSoStavom(zdroj);
  c.prijmiSubor(c.maly('a.xml'));
  c.prijmiSubor(c.velky('b.xml'));
  assert.equal(c.citace.length, 1, 'príliš veľký súbor sa nemá čítať');
  c.dokonci(0);
  assert.deepEqual(c.prijate, [], 'neskorá odpoveď a.xml prepísala odmietnutie b.xml');
  assert.equal(c.stav(), 'zu groß (12 MB)');
  // Poradie 2: odpoveď a.xml príde ešte pred výberom b.xml: a.xml platí, potom hláška o b.xml.
  const d = citanieSoStavom(zdroj);
  d.prijmiSubor(d.maly('a.xml'));
  d.dokonci(0);
  d.prijmiSubor(d.velky('b.xml'));
  assert.deepEqual(d.prijate, ['a.xml']);
  assert.equal(d.stav(), 'zu groß (12 MB)');
  // Najprv príliš veľký, potom platný súbor: platný sa prijme.
  const e = citanieSoStavom(zdroj);
  e.prijmiSubor(e.velky('b.xml'));
  e.prijmiSubor(e.maly('a.xml'));
  e.dokonci(0);
  assert.deepEqual(e.prijate, ['a.xml']);
  assert.equal(e.stav(), 'Geladen: a.xml');
});

test('(e) P3 mutácia: poradie až po kontrole veľkosti (pôvodný kód) prijme neskorú odpoveď a.xml', () => {
  const zdroj = zdrojFunkcie('prijmiSubor');
  const oprava = '  const moje = ++citanieCislo;\n  if (f.size > MAX_MB * 1024 * 1024) { stavVstupu(T.prilisVelky(MAX_MB)); return; }\n  stavVstupu(T.citam);\n';
  assert.ok(zdroj.includes(oprava), 'riadky opravy P3 sa v prijmiSubor() nenašli');
  const povodny = zdroj.replace(oprava, '  if (f.size > MAX_MB * 1024 * 1024) { stavVstupu(T.prilisVelky(MAX_MB)); return; }\n  stavVstupu(T.citam);\n  const moje = ++citanieCislo;\n');
  const c = citanieSoStavom(povodny);
  c.prijmiSubor(c.maly('a.xml'));
  c.prijmiSubor(c.velky('b.xml'));
  c.dokonci(0);
  assert.deepEqual(c.prijate, ['a.xml'], 'pôvodný kód mal chybu prijať; test by ju inak neodhalil');
  assert.equal(c.stav(), 'Geladen: a.xml');
});

// ---------------------------------------------------------------- (f) P1 kotvy a záložky

// Skutočný kód zo zdroja app.js: PANELY, panelZKotvy(), prepni() a celý štart záložiek (poslucháči tlačidiel,
// hashchange, klik na odkaz panela a riadok štartu) so zástupnými závislosťami.
const PANELY_ZDROJ = (APP.match(/const PANELY = \[[^\]]*\];/) || [])[0];
const START_ZDROJ = (() => {
  const od = APP.indexOf("for (const b of document.querySelectorAll('.zalozka')) {");
  const riadok = APP.indexOf('\nprepni(', od);
  assert.ok(od > 0 && riadok > od, 'štart záložiek sa v app.js nenašiel');
  return APP.slice(od, APP.indexOf('\n', riadok + 1));
})();
const HASHCHANGE_NOVY = "window.addEventListener('hashchange', () => { const m = panelZKotvy(location.hash); if (!m) return; prepni(m, false); kNastroju(); });";
const START_NOVY = "prepni(panelZKotvy(location.hash) || document.body.dataset.efakturaStart || 'kontrola', false);";
// Pôvodné riadky pred opravou P1 (na mutáciu).
const HASHCHANGE_POVODNY = "window.addEventListener('hashchange', () => { const m = (location.hash || '').replace('#', ''); prepni(m, false); if (PANELY.includes(m)) kNastroju(); });";
const START_POVODNY = "prepni((location.hash || '').replace('#', '') || document.body.dataset.efakturaStart || 'kontrola', false);";

function zalozky(startZdroj, { hash = '', start } = {}) {
  const posluchaci = {};
  const panely = { 'panel-kontrola': { hidden: false }, 'panel-nahlad': { hidden: true }, 'panel-vytvorit': { hidden: true } };
  const location = { hash };
  const document = { querySelectorAll: () => [], querySelector: () => null, body: { dataset: start ? { efakturaStart: start } : {} } };
  const window = { addEventListener: (typ, f) => { posluchaci[typ] = f; } };
  const telo = PANELY_ZDROJ + '\nlet aktivna = "kontrola"; const vstupBlok = null; let xmlText = ""; let vstupCislo = 0; let kontrolaVstupu = -1;\n'
    + 'let kontroly = 0, posuny = 0;\n'
    + 'function spustiKontrolu() { kontroly += 1; kontrolaVstupu = vstupCislo; }\n'
    + 'function vykresliVstupnyDoklad() {} function prekresliGenerator() {} function postavFormular() {}\n'
    + 'function kNastroju() { posuny += 1; }\n'
    + zdrojFunkcie('panelZKotvy') + '\n' + zdrojFunkcie('prepni') + '\n' + startZdroj
    + '\nreturn { stav: () => ({ aktivna, kontroly, posuny }), nacitaj: (t) => { vstupCislo += 1; xmlText = t; } };';
  const api = new Function('$', 'document', 'window', 'location', 'history', telo)((id) => panely[id] || null, document, window, location, { replaceState() {} });
  return {
    ...api, panely, location,
    kotva(h) { location.hash = h; posluchaci.hashchange(); return api.stav(); },
  };
}

test('(f) P1 štart: kotva, ktorá nie je panel, nechá záložku podľa data-efaktura-start', () => {
  assert.ok(START_ZDROJ.includes(START_NOVY) && START_ZDROJ.includes(HASHCHANGE_NOVY), 'štart alebo hashchange nemá opravu P1');
  for (const hash of ['', '#otazky', '#arling-obsah', '#selbst-erstellen', '#cennik', '#nahlad-zivy']) {
    assert.equal(zalozky(START_ZDROJ, { hash, start: 'nahlad' }).stav().aktivna, 'nahlad', 'viewer s kotvou ' + hash);
    assert.equal(zalozky(START_ZDROJ, { hash }).stav().aktivna, 'kontrola', 'stránka bez data-efaktura-start s kotvou ' + hash);
  }
  assert.equal(zalozky(START_ZDROJ, { hash: '#pole-leitweg', start: 'vytvorit' }).stav().aktivna, 'vytvorit', 'Leitweg-ID s kotvou poľa');
  assert.equal(zalozky(START_ZDROJ, { hash: '#vytvorit', start: 'nahlad' }).stav().aktivna, 'vytvorit');
  assert.equal(zalozky(START_ZDROJ, { hash: '#kontrola', start: 'nahlad' }).stav().aktivna, 'kontrola');
  assert.equal(zalozky(START_ZDROJ, { hash: '#nahlad' }).stav().aktivna, 'nahlad');
});

test('(f) P1 hashchange: „Preise im Detail“, skip odkaz a #otazky nechajú Vorschau a nespustia kontrolu', () => {
  const z = zalozky(START_ZDROJ, { start: 'nahlad' });
  z.nacitaj(CII);
  for (const h of ['#selbst-erstellen', '#arling-obsah', '#otazky', '', '#nieco']) {
    assert.deepEqual(z.kotva(h), { aktivna: 'nahlad', kontroly: 0, posuny: 0 }, 'kotva ' + h);
    assert.equal(z.panely['panel-nahlad'].hidden, false);
  }
  // Kotvy panelov prepínajú a posúvajú k nástroju; kontrola beží raz na vstup.
  assert.deepEqual(z.kotva('#vytvorit'), { aktivna: 'vytvorit', kontroly: 0, posuny: 1 });
  assert.equal(z.panely['panel-vytvorit'].hidden, false);
  // Erstellen otvorený: odkaz na cenník formulár neskryje.
  assert.deepEqual(z.kotva('#selbst-erstellen'), { aktivna: 'vytvorit', kontroly: 0, posuny: 1 });
  assert.equal(z.panely['panel-vytvorit'].hidden, false, 'formulár sa skryl');
  assert.deepEqual(z.kotva('#kontrola'), { aktivna: 'kontrola', kontroly: 1, posuny: 2 });
  assert.deepEqual(z.kotva('#nahlad'), { aktivna: 'nahlad', kontroly: 1, posuny: 3 });
});

test('(f) P1 mutácia: pôvodný hashchange a štart prepnú Vorschau na Prüfung a spustia kontrolu', () => {
  const povodny = START_ZDROJ.replace(HASHCHANGE_NOVY, HASHCHANGE_POVODNY).replace(START_NOVY, START_POVODNY);
  assert.notEqual(povodny, START_ZDROJ);
  const z = zalozky(povodny, { start: 'nahlad' });
  z.nacitaj(CII);
  assert.deepEqual(z.kotva('#selbst-erstellen'), { aktivna: 'kontrola', kontroly: 1, posuny: 0 }, 'pôvodný kód mal chybu ukázať');
  assert.equal(zalozky(povodny, { hash: '#otazky', start: 'nahlad' }).stav().aktivna, 'kontrola');
});

// ---------------------------------------------------------------- (g) P4 meno vloženého XML

const SPUSTIT_ZDROJ = (() => {
  const od = APP.indexOf("if (spustit) spustit.addEventListener('click', () => {");
  assert.ok(od > 0, 'obsluha tlačidla vloženého XML sa nenašla');
  const telo = APP.slice(APP.indexOf('{', od) + 1, APP.indexOf('\n  });', od));
  return telo;
})();
const VLASTNE = VZOR_DE.replace(/2026-0142/g, 'RE-77').replace('Musterwerkstatt GmbH', 'Holzbau Krause GmbH');

function vlozene(zdrojObsluhy) {
  const prvky = { xml: { value: '' }, 'vstup-stav': { textContent: '' } };
  const telo = 'let xmlText = ""; let nazovSuboru = ""; let vstupJeUkazka = false; let vstupCislo = 0; let citanieCislo = 0; let aktivna = "nahlad";\n'
    + 'const VZOR = ' + JSON.stringify(VZOR_DE) + '; const VZOR_CHYBY = null;\n'
    + 'function skryBlokEmailu() {} function cspPovoluje() { return false; } function cspStranky() { return ""; }\n'
    + 'function nacitajModulBloku() { return Promise.resolve(); } function vykresliVstupnyDoklad() {} function spustiKontrolu() {}\n'
    + ['stavVstupu', 'prijmiText', 'menoVlozeneho'].map((m) => zdrojFunkcie(m)).join('\n')
    + '\nfunction otvorVlozene() {' + zdrojObsluhy + '\n}'
    + '\nreturn { prijmiText, otvorVlozene, nazov: () => nazovSuboru };';
  const api = new Function('$', 'T', 'track', 'document', 'LANG', telo)((id) => prvky[id] || null, T_ALL.de, () => {}, {}, 'de');
  return { ...api, prvky, stav: () => prvky['vstup-stav'].textContent };
}

test('(g) P4: po „Beispiel ansehen“ a vložení vlastného XML stav aj protokol hlásia eingefuegt.xml', () => {
  assert.ok(SPUSTIT_ZDROJ.includes('prijmiText(t, menoVlozeneho(t));'));
  const v = vlozene(SPUSTIT_ZDROJ);
  v.prijmiText(VZOR_DE, 'beispielrechnung.xml', true);
  assert.ok(v.stav().includes('beispielrechnung.xml'));
  v.prvky.xml.value = VLASTNE;
  v.otvorVlozene();
  assert.ok(v.stav().startsWith('Geladen: eingefuegt.xml ('), v.stav());
  assert.equal(v.nazov(), 'eingefuegt.xml', 'protokol(poslednyVysledok, LANG, nazovSuboru) dostane meno vzoru');
  // Ten istý súbor znova otvorený (pole nezmenené) ostáva pod svojím menom, aj keď textarea vráti CRLF ako LF.
  v.prijmiText(VLASTNE.replace(/\n/g, '\r\n'), 'rechnung-77.xml');
  v.prvky.xml.value = VLASTNE;
  v.otvorVlozene();
  assert.equal(v.nazov(), 'rechnung-77.xml');
  // Prázdne pole: nič sa nenačíta, meno ostáva.
  v.prvky.xml.value = '  ';
  v.otvorVlozene();
  assert.equal(v.stav(), T_ALL.de.nacitajteSubor);
  assert.equal(v.nazov(), 'rechnung-77.xml');
});

test('(g) P4 mutácia: pôvodné „nazovSuboru || T.vlozeneMeno“ ukáže meno vzoru', () => {
  const povodny = SPUSTIT_ZDROJ.replace('prijmiText(t, menoVlozeneho(t));', 'prijmiText(t, nazovSuboru || T.vlozeneMeno);');
  assert.notEqual(povodny, SPUSTIT_ZDROJ);
  const v = vlozene(povodny);
  v.prijmiText(VZOR_DE, 'beispielrechnung.xml', true);
  v.prvky.xml.value = VLASTNE;
  v.otvorVlozene();
  assert.equal(v.nazov(), 'beispielrechnung.xml', 'pôvodný kód mal chybu ukázať');
});

// ---------------------------------------------------------------- (h) P5 doklad na mobile

// Malý DOM, ktorý si pamätá atribúty a vie vypísať text (ako tests.mjs).
function domSAtributmi() {
  const vyrob = (meno) => ({
    meno, className: '', _t: '', deti: [], atr: {},
    appendChild(d) { this.deti.push(d); return d; },
    removeChild(d) { this.deti.splice(this.deti.indexOf(d), 1); return d; },
    setAttribute(k, v) { this.atr[k] = String(v); },
    get firstChild() { return this.deti[0] || null; },
    set textContent(v) { this._t = String(v); this.deti = []; },
    get textContent() { return this._t + this.deti.map((d) => d.textContent).join('|'); },
  });
  return { createElement: vyrob, createTextNode: (t) => { const u = vyrob('#text'); u._t = String(t); return u; } };
}
const vsetky =(u, meno, out = []) => { if (u.meno === meno) out.push(u); for (const d of u.deti) vsetky(d, meno, out); return out; };
const vzorZApp = (konst) => { const z = APP.indexOf('const ' + konst + ' = `'); return APP.slice(APP.indexOf('<?xml', z), APP.indexOf('\n`;', z)); };
function vykresli(xml, jazyk) {
  const dom = domSAtributmi();
  const ciel = dom.createElement('div');
  vykresliNahlad(parsujXml(xml).koren, ciel, jazyk, dom);
  return ciel;
}

test('(h) P5: každá bunka tabuliek dokladu nesie data-th s popisom svojho stĺpca, vo všetkých štyroch jazykoch', () => {
  for (const [jazyk, konst] of [['sk', 'VZOR_XML'], ['cs', 'VZOR_XML_CS'], ['de', 'VZOR_XML_DE'], ['en', 'VZOR_XML_EN']]) {
    const tabulky = vsetky(vykresli(vzorZApp(konst), jazyk), 'table');
    assert.equal(tabulky.length, 2, jazyk + ': Positionen a Steueraufschlüsselung');
    for (const t of tabulky) {
      const hlavicky = vsetky(t, 'th').map((th) => th._t);
      const riadky = vsetky(t, 'tr').filter((tr) => vsetky(tr, 'td').length);
      assert.ok(riadky.length >= 1);
      for (const tr of riadky) assert.deepEqual(vsetky(tr, 'td').map((td) => td.atr['data-th']), hlavicky, jazyk);
    }
  }
});

const CSS_V4 = readFileSync(new URL('./efaktura-v4.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function blokMedia(css, hlavicka) {
  const od = css.indexOf(hlavicka);
  if (od < 0) return '';
  let hlbka = 0;
  for (let j = css.indexOf('{', od); j < css.length; j++) {
    if (css[j] === '{') hlbka += 1;
    else if (css[j] === '}') { hlbka -= 1; if (hlbka === 0) return css.slice(od, j + 1); }
  }
  return '';
}

test('(h) P5: CSS skladá riadky dokladu v ráme do blokov len na obrazovke do 600 px, tlač A4 ostáva tabuľkou', () => {
  const blok = blokMedia(CSS_V4, '@media screen and (max-width:600px){\n  .efv4 .doklad-obal .efa-tabulka{');
  assert.ok(blok, 'blok pre doklad na mobile chýba');
  for (const pravidlo of ['.efv4 .doklad-obal .efa-tabulka{display:block;width:100%;min-width:0;', '.efv4 .doklad-obal .efa-tabulka thead{display:none}',
    '.efv4 .doklad-obal .efa-tabulka tr{display:grid;grid-template-columns:minmax(0,max-content) minmax(0,1fr);',
    '.efv4 .doklad-obal .efa-tabulka td{grid-column:1/-1;display:grid;grid-template-columns:minmax(92px,40%) minmax(0,1fr);grid-template-columns:subgrid;',
    '.efv4 .doklad-obal .efa-tabulka td::before{content:attr(data-th);display:block;', '.efv4 .doklad-obal .efa-tabulka td:empty{display:none}']) {
    assert.ok(blok.includes(pravidlo), 'chýba ' + pravidlo);
  }
  // .doklad-obal .efa-tabulka sa mimo bloku pre obrazovku (a rovnakého bloku @container od N1, nižšie) nikde nemení
  // (výrez .ef-vyrez-papier a tlač ostávajú tabuľkou).
  const kontajner = blokMedia(CSS_V4, '@container doklad (max-width:');
  assert.equal(CSS_V4.split('.doklad-obal .efa-tabulka').length - 1,
    blok.split('.doklad-obal .efa-tabulka').length - 1 + kontajner.split('.doklad-obal .efa-tabulka').length - 1);
  const tlac = blokMedia(CSS_V4, '@media print{');
  assert.ok(tlac.includes('#tlac .efa-tabulka') && !/efa-tabulka[^{]*\{[^}]*display:block/.test(tlac), 'tlač by dostala bloky');
  // Stránka viewera má to isté pravidlo v kritickom CSS (prvé vykreslenie na 390 px) a ukážka nesie data-th.
  assert.ok(/<style data-kriticke>[\s\S]*@media screen and \(max-width:600px\)\{\.efv4 \.doklad-obal \.efa-tabulka\{display:block[\s\S]*?<\/style>/.test(STRANKA));
  const ukazka = STRANKA.slice(STRANKA.indexOf('<div class="doklad-obal ef-viewer-ukazka"'), STRANKA.indexOf('<section class="panel" id="panel-vytvorit"'));
  const bunky = (ukazka.match(/<td\b/g) || []).length;
  assert.ok(bunky >= 12);
  assert.equal((ukazka.match(/<td data-th="[^"]+">/g) || []).length, bunky, 'bunka ukážky bez data-th');
});

// ---------------------------------------------------------------- (h) N1 doklad v ráme pri šírkach notebooku

// N1 brány (pokus 2): pri oknách 1081 až 1290 px bol pravý stĺpec dokladu (Nettobetrag) za posuvníkom rámu, pri 1100 px celý
// schovaný (a živý náhľad generátora pri 900 až 1000 px). Príčina: bloky s popiskami sa zapínali podľa šírky okna (do 600 px),
// no tabuľka potrebuje obsah rámu aspoň taký široký, ako je jej najmenšia šírka, a rám je pri týchto oknách užší.
// Model: pravidlá, ktoré skladajú tabuľku do blokov, platia pri okne do X px (@media screen) alebo pri obsahu rámu do Y px
// (@container doklad). Šírky obsahu rámu sú zmerané v Chrome skriptom ops/druhy-ucet/246/sirky.mjs (snimky/sirky.json,
// 26. 10. 2026): náhľad na vieweri a na rozcestníkoch (dva stĺpce od 1081 px) a živý náhľad generátora (od 900 px).
const RAM_NAHLAD = { 390: 273, 600: 460, 601: 461, 700: 549, 800: 636, 1000: 804, 1081: 416, 1100: 424, 1150: 443, 1200: 463, 1240: 478,
  1280: 493, 1300: 500, 1366: 526, 1440: 558, 1536: 601, 1920: 633 };
const RAM_GENERATOR = { 390: 307, 600: 494, 601: 495, 700: 583, 800: 670, 900: 388, 1000: 433, 1100: 478, 1150: 500, 1200: 523, 1240: 541,
  1280: 558, 1300: 567, 1366: 597, 1440: 633, 1536: 681, 1920: 714 };
// Najmenšia šírka tabuľky Positionen v tabuľkovom režime (min-content) s pravidlom overflow-wrap:anywhere: nemecký, slovenský
// a český vzor 497 px, anglický 524 px (bez pravidla nemecký 534 px a doklad s 30-znakovým slovom 610 px). Najväčšia zo štyroch.
const TABULKA_MIN = 524;
function sirkyBlokov(css) {
  const zachyt = (re) => [...css.matchAll(re)].map((m) => Number(m[1]));
  return {
    media: zachyt(/@media screen and \(max-width:(\d+)px\)\{\n\s+\.efv4 \.doklad-obal \.efa-tabulka\{/g),
    kontajner: zachyt(/@container doklad \(max-width:(\d+)px\)\{\n\s+\.efv4 \.doklad-obal \.efa-tabulka\{/g),
  };
}
const jeBlok = (css, okno, obsahRamu) => { const s = sirkyBlokov(css); return s.media.some((x) => okno <= x) || s.kontajner.some((x) => obsahRamu <= x); };
const nezmestene = (css) => [['náhľad', RAM_NAHLAD], ['generátor', RAM_GENERATOR]].flatMap(([druh, ramy]) => Object.entries(ramy)
  .filter(([okno, obsah]) => !jeBlok(css, Number(okno), obsah) && obsah < TABULKA_MIN).map(([okno, obsah]) => druh + ' ' + okno + ' px (rám ' + obsah + ' px)'));

test('(h) N1: rám dokladu je kontajner a bloky sa zapínajú podľa šírky rámu: tabuľka sa zobrazí len tam, kde sa zmestí', () => {
  // Rám je kontajner s menom doklad (v plnom CSS aj v kritickom CSS viewera).
  assert.ok(/\.efv4 \.doklad-obal\{[^}]*container:doklad\/inline-size[^}]*\}/.test(CSS_V4), 'rám dokladu nie je kontajner');
  assert.ok(/<style data-kriticke>[\s\S]*\.efv4 \.doklad-obal\{[^}]*container:doklad\/inline-size[^}]*\}[\s\S]*?<\/style>/.test(STRANKA), 'kritické CSS viewera nemá kontajner');
  // Blok @container má tie isté pravidlá ako @media pre mobil (bez komentárov a medzier).
  const media = blokMedia(CSS_V4, '@media screen and (max-width:600px){\n  .efv4 .doklad-obal .efa-tabulka{');
  const kontajner = blokMedia(CSS_V4, '@container doklad (max-width:');
  assert.ok(media && kontajner, 'blok @media alebo @container chýba');
  const telo = (b) => b.slice(b.indexOf('{') + 1, b.lastIndexOf('}')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
  assert.equal(telo(kontajner), telo(media), 'pravidlá @container a @media sa rozišli');
  // Pravidlá blokov sú len pod .doklad-obal: tlač ide cez #tlac mimo rámu a ostáva tabuľkou.
  for (const pravidlo of telo(kontajner).split('} ').map((x) => x.trim()).filter(Boolean)) assert.ok(pravidlo.startsWith('.efv4 .doklad-obal .efa-tabulka'), pravidlo.slice(0, 60));
  // Sumy sa nelámu len tam, kde tabuľku v úzkom ráme zachráni container query (poistka pre prehliadač bez nich).
  assert.ok(/@supports \(container-type:inline-size\)\{\n\s+body\.efv4 \.efa-polozky \.efa-tabulka td:nth-child\(n\+5\),[^{}]*\{white-space:nowrap\}\n\}/.test(CSS_V4), 'nowrap nie je pod @supports');
  assert.ok(!/(^|\n)body\.efv4 \.efa-polozky \.efa-tabulka td:nth-child\(n\+5\)/.test(CSS_V4), 'nowrap ostal aj mimo @supports');
  const prah = sirkyBlokov(CSS_V4).kontajner;
  assert.equal(prah.length, 1);
  assert.ok(prah[0] >= TABULKA_MIN && prah[0] < RAM_NAHLAD[1440], 'prah blokov ' + prah[0] + ' px: od najmenšej šírky tabuľky ' + TABULKA_MIN + ' px, pod šírku rámu pri 1440 px (' + RAM_NAHLAD[1440] + ' px)');
  // Zmerané šírky: kde nie sú bloky, tam sa tabuľka zmestí.
  assert.deepEqual(nezmestene(CSS_V4), []);
  // Vzhľad: mobil a notebook do 1366 px bloky, od 1440 px tabuľka (ako schválila brána); široké okno s jedným stĺpcom tabuľka.
  for (const [okno, obsah] of [[390, 273], [1081, 416], [1100, 424], [1280, 493], [1366, 526]]) assert.ok(jeBlok(CSS_V4, okno, obsah), okno + ' px má byť blok');
  for (const [okno, obsah] of [[800, 636], [1000, 804], [1440, 558], [1536, 601], [1920, 633]]) assert.ok(!jeBlok(CSS_V4, okno, obsah), okno + ' px má byť tabuľka');
});

test('(h) N1 mutácia: bez bloku @container (stav po P5) je pri 1081 až 1300 px tabuľka širšia než rám, aj v generátore pri 900 až 1200 px', () => {
  const kontajner = blokMedia(CSS_V4, '@container doklad (max-width:');
  const bez = CSS_V4.replace(kontajner, '');
  assert.notEqual(bez, CSS_V4);
  const zle = nezmestene(bez);
  for (const ma of ['náhľad 1081 px', 'náhľad 1100 px', 'náhľad 1280 px', 'náhľad 1300 px', 'generátor 900 px', 'generátor 1000 px', 'generátor 1100 px', 'generátor 1200 px']) {
    assert.ok(zle.some((z) => z.startsWith(ma)), 'bez opravy má zlyhať: ' + ma);
  }
  assert.deepEqual(sirkyBlokov(bez).kontajner, []);
  assert.deepEqual(sirkyBlokov(bez).media, [600]);
});

test('(h) N1: dlhé slovo v názve položky, kategórii a dôvode oslobodenia sa láme (overflow-wrap:anywhere), stĺpce sedia s popiskami vo všetkých jazykoch', () => {
  // Bez tohto pravidla by 30-znakové slovo (Softwareentwicklungsleistungen) dalo tabuľku 610 px a pri okne 1440 px (rám 558 px)
  // by sa rám posúval (zmerané v Chrome, 246/sirky.mjs, variant dlhy).
  const pravidlo = 'body.efv4 .efa-polozky .efa-tabulka td:nth-child(2),body.efv4 .efa-rozpis .efa-tabulka td:nth-child(1),body.efv4 .efa-rozpis .efa-tabulka td:nth-child(5){overflow-wrap:anywhere}';
  assert.ok(CSS_V4.includes(pravidlo), 'pravidlo pre dlhé slovo chýba v efaktura-v4.css');
  assert.ok(STRANKA.includes(pravidlo), 'kritické CSS viewera nemá pravidlo pre dlhé slovo');
  // Poradie stĺpcov sa berie z nahlad.js: Bezeichnung je druhý stĺpec položiek, Kategorie a Befreiungsgrund prvý a piaty stĺpec rozpisu.
  for (const [jazyk, konst] of [['sk', 'VZOR_XML'], ['cs', 'VZOR_XML_CS'], ['de', 'VZOR_XML_DE'], ['en', 'VZOR_XML_EN']]) {
    const t = TEXTY_NAHLADU[jazyk];
    const [polozky, rozpis] = vsetky(vykresli(vzorZApp(konst), jazyk), 'table');
    const hlavicky = (tab) => vsetky(tab, 'th').map((th) => th._t);
    assert.equal(hlavicky(polozky).length, 7, jazyk);
    assert.equal(hlavicky(rozpis).length, 5, jazyk);
    assert.equal(hlavicky(polozky)[1], t.pNazov, jazyk + ': druhý stĺpec položiek');
    assert.equal(hlavicky(rozpis)[0], t.rKategoria, jazyk + ': prvý stĺpec rozpisu');
    assert.equal(hlavicky(rozpis)[4], t.rDovod, jazyk + ': piaty stĺpec rozpisu');
  }
});

// ---------------------------------------------------------------- (i) R55 zápis dátumov, súm a IBAN

const VZOR_DE_ROZSIRENY = VZOR_DE
  .replace('<cbc:BuyerReference>991-33333TEST-33</cbc:BuyerReference>', '<cbc:BuyerReference>991-33333TEST-33</cbc:BuyerReference>\n  <cac:InvoicePeriod><cbc:StartDate>2026-09-01</cbc:StartDate><cbc:EndDate>2026-09-30</cbc:EndDate></cac:InvoicePeriod>\n  <cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>2026-0100</cbc:ID><cbc:IssueDate>2026-08-01</cbc:IssueDate></cac:InvoiceDocumentReference></cac:BillingReference>')
  .replace('<cbc:PriceAmount currencyID="EUR">45.00</cbc:PriceAmount>', '<cbc:PriceAmount currencyID="EUR">12.3456</cbc:PriceAmount>')
  .replace('<cbc:InvoicedQuantity unitCode="C62">4</cbc:InvoicedQuantity>', '<cbc:InvoicedQuantity unitCode="C62">1250.5</cbc:InvoicedQuantity>')
  .replace('<cbc:PayableAmount currencyID="EUR">535.50</cbc:PayableAmount>', '<cbc:PayableRoundingAmount currencyID="EUR">-0.01</cbc:PayableRoundingAmount>\n    <cbc:PayableAmount currencyID="EUR">1234567.80</cbc:PayableAmount>');

test('(i) R55: nemecký doklad píše dátumy 11.09.2026 a sumy 1.234,50 € bez zaokrúhlenia, IBAN po štyroch', () => {
  assert.notEqual(VZOR_DE_ROZSIRENY.split('12.3456').length, 1, 'úprava vzoru sa neuplatnila');
  const text = vykresli(VZOR_DE_ROZSIRENY, 'de').textContent;
  for (const ma of ['11.09.2026', '10.09.2026', '25.09.2026', '01.09.2026 bis 30.09.2026', '2026-0100, 01.08.2026',
    '12,3456\u00a0€', '45,00\u00a0€', '270,00\u00a0€', '1.234.567,80\u00a0€', '-0,01\u00a0€', '85,50\u00a0€', '19,00\u00a0% S', '19,00\u00a0%',
    '1.250,5', 'DE89 3704 0044 0532 0130 00', 'Rechnung 2026-0142', '991-33333TEST-33']) {
    assert.ok(text.includes(ma), 'chýba ' + JSON.stringify(ma));
  }
  for (const nema of ['2026-09-11', '45.00', 'EUR', '12.3456', 'DE89370400440532013000']) assert.ok(!text.includes(nema), 'ostalo ' + nema);
  // Iná mena ostáva kódom, v nemeckom zápise.
  const chf = vykresli(VZOR_DE.replace(/currencyID="EUR"/g, 'currencyID="CHF"').replace('<cbc:DocumentCurrencyCode>EUR', '<cbc:DocumentCurrencyCode>CHF'), 'de').textContent;
  assert.ok(chf.includes('450,00\u00a0CHF') && !chf.includes('€'));
});

test('(i) R55: ostatné jazyky ostávajú pri zápise zo súboru, IBAN je po skupinách všade', () => {
  const sk = vykresli(VZOR_DE, 'sk').textContent;
  for (const ma of ['2026-09-11', '45.00 EUR', '19.00 % S', '535.50 EUR', 'DE89 3704 0044 0532 0130 00']) assert.ok(sk.includes(ma), 'sk: ' + ma);
  const en = vykresli(vzorZApp('VZOR_XML_EN'), 'en').textContent;
  assert.ok(!/\d,\d{2}\u00a0/.test(en) && /\d{4}-\d{2}-\d{2}/.test(en), 'en dostal nemecký zápis');
});

// ---------------------------------------------------------------- (j) R8 parser: neplatné znakové referencie

test('(j) R8: neplatná znaková referencia je chyba v štyroch jazykoch, nie výnimka; platné ostávajú', () => {
  for (const zle of ['&#x110000;', '&#-5;', '&#99999999;', '&#xD800;', '&#0;', '&#12abc;', '&#x;']) {
    let p;
    assert.doesNotThrow(() => { p = parsujXml('<Invoice><cbc:Note>a' + zle + 'b</cbc:Note></Invoice>'); }, zle);
    assert.equal(p.ok, false, zle);
    for (const j of ['sk', 'cs', 'de', 'en']) assert.ok(p.chyba[j] && p.chyba[j].includes(zle), zle + ' ' + j);
  }
  for (const [dobre, znak] of [['&#x20AC;', '€'], ['&#65;', 'A'], ['&#x1F600;', '\u{1F600}'], ['&#9;', '\t'], ['&#xE000;', '\uE000']]) {
    const p = parsujXml('<Invoice>' + dobre + '</Invoice>');
    assert.equal(p.ok, true, dobre);
    assert.equal(p.koren._text, znak, dobre);
  }
  // Náhľad ukáže vetu parsera a starý doklad zmizne (predtým výnimka preletela a v ráme ostal predošlý doklad).
  const s = nahlad('de');
  s.nacitaj(VZOR_DE, true);
  s.vykresli();
  assert.equal(s.prvky.doklad.deti.length, 1);
  s.nacitaj('<Invoice><cbc:Note>&#x110000;</cbc:Note></Invoice>');
  assert.doesNotThrow(() => s.vykresli());
  assert.equal(s.prvky.doklad.deti.length, 0);
  assert.ok(s.prvky['nahlad-stav'].textContent.startsWith('Ungültige Zeichenreferenz &#x110000;'));
});

// ---------------------------------------------------------------- (k) R2 a R4 meranie

function cenaVidena() {
  const pozorovatelia = [];
  class IO {
    constructor(cb, moznosti) { this.cb = cb; this.moznosti = moznosti; this.ciele = new Set(); pozorovatelia.push(this); }
    observe(t) { this.ciele.add(t); }
    unobserve(t) { this.ciele.delete(t); }
    disconnect() { this.ciele.clear(); }
  }
  const brana = { id: 'brana' }, cennik = { id: 'cennik' };
  const udalosti = [];
  const window = { IntersectionObserver: IO, innerHeight: 844 };
  const document = { querySelector: (s) => (s === '.ef-cennik' ? cennik : null) };
  new Function('$', 'document', 'window', 'IntersectionObserver', 'track', 'LANG', zdrojFunkcie('sledujCenuVidenu') + '\nsledujCenuVidenu();')(
    (id) => (id === 'brana' ? brana : null), document, window, IO, (n, d) => udalosti.push([n, d]), 'de');
  const vidno = (ciel, pomer, vyska) => { for (const p of pozorovatelia) if (p.ciele.has(ciel)) p.cb([{ target: ciel, isIntersecting: pomer > 0, intersectionRatio: pomer, intersectionRect: { height: vyska } }]); };
  return { brana, cennik, udalosti, vidno, pozorovatelia };
}

test('(k) R2: cena_videna aj pre cenník pod nástrojom, raz na miesto, s vlastnosťou miesto', () => {
  const c = cenaVidena();
  assert.equal(c.pozorovatelia.length, 1);
  assert.deepEqual([...c.pozorovatelia[0].ciele].map((x) => x.id), ['brana', 'cennik']);
  c.vidno(c.cennik, 0.3, 200);
  assert.deepEqual(c.udalosti, [], 'tretina malého cenníka nie je videnie ceny');
  c.vidno(c.cennik, 0.6, 400);
  c.vidno(c.cennik, 1, 640);
  assert.deepEqual(c.udalosti, [['cena_videna', { miesto: 'cennik', produkt: 'efaktura', jazyk: 'de' }]]);
  // Platobný blok generátora vyšší než okno: stačí polovica okna.
  c.vidno(c.brana, 0.3, 500);
  assert.deepEqual(c.udalosti.map((u) => u[1].miesto), ['cennik', 'generator']);
});

test('(k) R4: CII v kontrole nie je „ok“, ide s výsledkom cii', () => {
  assert.ok(zdrojFunkcie('spustiKontrolu').includes("track('efaktura_kontrola', { vysledok: v.typ === 'CII' ? 'cii' : s.chyby ? 'chyby' : 'ok',"));
});

// ---------------------------------------------------------------- (l) N2 riadok súčtov nad živým náhľadom generátora

// Skutočná vypisSucty z app.js (s el a vycisti) nad malým DOM; zapisSumy, zCentov, prepocitaj a vytvorUbl sú skutočné.
function suctyZApp(jazyk, zdroj = zdrojFunkcie('vypisSucty')) {
  const dom = domSAtributmi();
  const el = new Function('document', zdrojFunkcie('el') + '\nreturn el;')(dom);
  const vycisti = new Function(zdrojFunkcie('vycisti') + '\nreturn vycisti;')();
  const vypis = new Function('el', 'vycisti', 'document', 'zCentov', 'zapisSumy', 'LANG', 'T', zdroj + '\nreturn vypisSucty;')(el, vycisti, dom, zCentov, zapisSumy, jazyk, T_ALL[jazyk]);
  const ciel = dom.createElement('p');
  return { dom, ciel, vypis: (v, mena) => vypis(ciel, v, mena), riadky: () => ciel.deti.map((s) => s.deti.map((d) => d.textContent).join('')) };
}
const NB = ' ';
const SUCTY = { zakladCenty: 123450, danCenty: 23456, sDphCenty: 146906, naUhraduCenty: 146906 };

test('(l) N2: riadok súčtov píše na nemeckej stránke 1.234,50 € ako náhľad, SK, CS a EN ostávajú pri 1234.50 EUR', () => {
  const de = suctyZApp('de');
  de.vypis(SUCTY, 'EUR');
  assert.deepEqual(de.riadky(), ['Netto: 1.234,50' + NB + '€', 'USt.: 234,56' + NB + '€', 'Brutto: 1.469,06' + NB + '€', 'Zahlbetrag: 1.469,06' + NB + '€']);
  // Prázdny formulár (stav z pokusu brány: „0.00 EUR“ nad náhľadom s „0,00 €“), záporná suma a iná mena kódom.
  de.vypis({ zakladCenty: 0, danCenty: 0, sDphCenty: 0, naUhraduCenty: 0 }, 'EUR');
  assert.deepEqual(de.riadky().map((r) => r.split(': ')[1]), Array(4).fill('0,00' + NB + '€'));
  de.vypis({ ...SUCTY, naUhraduCenty: -1205 }, 'CHF');
  assert.deepEqual(de.riadky().map((r) => r.split(': ')[1]), ['1.234,50' + NB + 'CHF', '234,56' + NB + 'CHF', '1.469,06' + NB + 'CHF', '-12,05' + NB + 'CHF']);
  for (const [jazyk, mena] of [['sk', 'EUR'], ['cs', 'CZK'], ['en', 'EUR']]) {
    const s = suctyZApp(jazyk);
    s.vypis(SUCTY, mena);
    const t = T_ALL[jazyk];
    assert.deepEqual(s.riadky(), [t.suctyZaklad + ': 1234.50 ' + mena, t.suctyDph + ': 234.56 ' + mena, t.suctySpolu + ': 1469.06 ' + mena, t.suctyUhrada + ': 1469.06 ' + mena], jazyk);
  }
});

test('(l) N2: riadok súčtov a doklad pod ním píšu tú istú sumu rovnako, vo všetkých štyroch jazykoch', () => {
  const f = prazdnaFaktura('DE');
  f.cislo = 'RE-2026-1';
  f.dodavatel.nazov = 'Musterwerkstatt GmbH';
  f.odberatel.nazov = 'Beispielkunde AG';
  f.polozky = [{ nazov: 'Wartung', mnozstvo: 3, jednotka: 'C62', cena: 411.5, sadzba: 19, kategoria: 'S' },
    { nazov: 'Ersatzteil', mnozstvo: 2, jednotka: 'C62', cena: 1250.25, sadzba: 19, kategoria: 'S' }];
  f.zaplatene = 100;
  const v = prepocitaj(f);
  assert.ok(v.zakladCenty >= 100000 && v.danCenty > 0 && v.naUhraduCenty !== v.sDphCenty, 'vzor má mať tisíce, DPH aj zálohu');
  for (const jazyk of ['sk', 'cs', 'de', 'en']) {
    const p = parsujXml(vytvorUbl(f, { profil: 'peppol', jazyk }));
    assert.equal(p.ok, true, jazyk);
    const dom = domSAtributmi();
    const doklad = dom.createElement('div');
    vykresliNahlad(p.koren, doklad, jazyk, dom);
    const text = doklad.textContent;
    const s = suctyZApp(jazyk);
    s.vypis(v, 'EUR');
    const hodnoty = s.riadky().map((r) => r.split(': ')[1]);
    assert.equal(hodnoty.length, 4);
    for (const h of hodnoty) assert.ok(text.includes(h), jazyk + ': doklad nepíše „' + h + '“ tak ako riadok súčtov');
    assert.equal(new Set(hodnoty).size, 4, jazyk + ': základ, DPH, spolu a na úhradu sa majú líšiť');
  }
});

test('(l) N2: prekresliGenerator volá vypisSucty a starý zápis zCentov + mena je preč; mutácia ukáže starý nemecký zápis', () => {
  assert.ok(zdrojFunkcie('prekresliGenerator').includes("vypisSucty(sucty, prepocitaj(faktura), faktura.mena || 'EUR')"));
  assert.ok(!APP.includes("zCentov(c) + ' ' + mena"), 'starý zápis sumy v riadku súčtov ostal');
  const zdroj = zdrojFunkcie('vypisSucty');
  const novy = "zapisSumy(zCentov(c), mena, LANG)";
  assert.ok(zdroj.includes(novy), 'oprava sa vo vypisSucty nenašla');
  const bez = suctyZApp('de', zdroj.replace(novy, "zCentov(c) + ' ' + mena"));
  bez.vypis(SUCTY, 'EUR');
  assert.equal(bez.riadky()[0], 'Netto: 1234.50 EUR', 'pôvodný kód mal chybu ukázať');
});

// ---------------------------------------------------------------- (d) stránka

const odkry = (s) => s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const ld = [...STRANKA.matchAll(/<script type="application\/ld\+json">\n?([\s\S]*?)\n?<\/script>/g)].map((m) => JSON.parse(m[1]));
const graf = ld.flatMap((x) => x['@graph'] || [x]);
const hlavny = STRANKA.slice(STRANKA.indexOf('<main'), STRANKA.indexOf('</main>'));

test('(d) hlava: title, description, canonical na seba, bez hreflang, og:url', () => {
  const title = (STRANKA.match(/<title>([^<]*)<\/title>/) || [])[1];
  assert.equal(title, 'XRechnung Viewer: online anzeigen, kostenlos | ARLing');
  assert.ok(title.length <= 60);
  const desc = (STRANKA.match(/<meta name="description" content="([^"]*)">/) || [])[1];
  assert.ok(desc && desc.length <= 155 && /CII/.test(desc) && /UBL/.test(desc), desc);
  assert.ok(STRANKA.includes('<link rel="canonical" href="https://arling.sk/efaktura/de/xrechnung-viewer/">'));
  assert.ok(STRANKA.includes('<meta property="og:url" content="https://arling.sk/efaktura/de/xrechnung-viewer/">'));
  assert.ok(!/hreflang=/.test(STRANKA), 'hreflang len pri skutočnom preklade');
  assert.ok(STRANKA.includes('<html lang="de">'));
});

test('(d) H1 presne podľa zadania 246 a práve jedno', () => {
  const h1 = [...STRANKA.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  assert.equal(h1.length, 1);
  assert.equal(odkry(h1[0][1]).replace(/\s+/g, ' ').trim(), 'XRechnung Viewer: XRechnung online anzeigen, kostenlos');
});

test('(d) JSON-LD: SoftwareApplication zadarmo na tejto adrese a FAQPage zhodná s FAQ v HTML', () => {
  const app = graf.find((x) => x['@type'] === 'SoftwareApplication');
  assert.ok(app);
  assert.equal(app.name, 'XRechnung Viewer');
  assert.equal(app.url, 'https://arling.sk/efaktura/de/xrechnung-viewer/');
  assert.deepEqual(app.offers.map((o) => o.price), ['0']);
  assert.ok(/CII/.test(app.description) && /noch nicht/.test(app.description), 'popis v JSON-LD sľubuje viac, než náhľad vie');
  const faq = graf.find((x) => x['@type'] === 'FAQPage').mainEntity.map((q) => [q.name, q.acceptedAnswer.text]);
  const html = [...STRANKA.matchAll(/<details class="otazka"><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map((m) => [odkry(m[1]), odkry(m[2])]);
  assert.ok(faq.length >= 6);
  assert.deepEqual(html, faq);
  for (const [q] of faq) assert.ok(q.endsWith('?'), q);
});

test('(d) nástroj: predvolená záložka Vorschau, vstup v náhľade, ostatné panely skryté, ukážka dokladu so skrytím', () => {
  assert.ok(STRANKA.includes('<body class="noc efv4" data-efaktura-start="nahlad">'));
  assert.ok(STRANKA.includes('<section class="ef-hero" id="hero" data-tab="nahlad"'));
  assert.ok(STRANKA.includes('<button type="button" class="zalozka aktivna" data-tab="nahlad" role="tab" aria-selected="true">Vorschau</button>'));
  assert.ok(STRANKA.includes('<section class="panel" id="panel-nahlad">'));
  assert.ok(STRANKA.includes('<section class="panel" id="panel-kontrola" hidden>'));
  assert.ok(STRANKA.includes('<section class="panel" id="panel-vytvorit" hidden>'));
  const vstup = STRANKA.indexOf('id="vstup"');
  assert.ok(vstup > STRANKA.indexOf('id="panel-nahlad"') && vstup < STRANKA.indexOf('id="panel-vytvorit"'), '#vstup nie je v náhľade');
  assert.equal((STRANKA.match(/id="vstup"/g) || []).length, 1);
  assert.ok(STRANKA.includes('<div class="doklad-obal" id="doklad"></div>\n                <div class="doklad-obal ef-viewer-ukazka"'), 'ukážka nestojí hneď za #doklad (pravidlo #doklad:not(:empty)+…)');
  assert.ok(STRANKA.includes('.efv4 #doklad:not(:empty)+.ef-viewer-ukazka{display:none}'));
  assert.ok(STRANKA.includes('.efv4 .ef-mriezka:has(#xml:not(:placeholder-shown)) .ef-viewer-ukazka{display:none}'));
  assert.ok(/<textarea id="xml"[^>]*placeholder="/.test(STRANKA), 'pole XML bez placeholder (pravidlo :placeholder-shown)');
  assert.ok(STRANKA.includes('<p class="efa-t2">Rechnung 2026-0142</p>'), 'ukážka nie je výstup nahlad.js zo vzoru');
  assert.ok(!/<footer\b/.test(hlavny), '<footer> v obsahu by obal.mjs prepísal pätou webu');
  assert.ok(!/<h[1-3]\b[^>]*>\s*Rechnung 2026-0142/.test(hlavny), 'ukážka má nadpisy');
});

test('(d) poctivosť: CII a ZUGFeRD výslovne „noch nicht“, žiadna pomlčka, platený krok s existujúcou udalosťou', () => {
  const text = odkry(hlavny).replace(/\s+/g, ' ');
  assert.ok(text.includes('CII zeigen wir noch nicht an'), 'hero nehovorí, že CII nezobrazíme');
  assert.ok(text.includes('Eine CII-Datei erkennt er und sagt es Ihnen; als Beleg darstellen kann er sie noch nicht.'));
  assert.ok(text.includes('ZUGFeRD oder Factur-X'));
  // Opravy po bráne (R5, R6): bez „zeichnet“, bez tvrdenia o početnosti CII, „die XML-Datei“ a „das PDF“.
  assert.ok(!/\bzeichnet\b|\bMeist\b|\bmeist\b|gewöhnliche/.test(text), 'ostal preklad alebo tvrdenie o početnosti');
  assert.ok(!/\b(?:eine|der|die|einer) PDF(?![-\w])|\b(?:der|die|einer|eine) XML(?![-\w])/.test(text), 'nejednotne XML-Datei alebo PDF');
  assert.ok(STRANKA.includes('<span id="nahlad-stav" aria-live="polite">'), '#nahlad-stav bez aria-live (R7)');
  assert.ok(!/[–—]/.test(odkry(hlavny.replace(/<script[\s\S]*?<\/script>/g, ''))), 'pomlčka v texte stránky');
  // Platený krok: riadok cenníka s udalosťou efaktura_cena_klik (existuje na /efaktura/de/) vedie do generátora.
  assert.ok(STRANKA.includes('href="#vytvorit" data-umami-event="efaktura_cena_klik" data-umami-event-miesto="viewer" data-umami-event-riadok="jedna"'));
  assert.ok(STRANKA.includes('id="kupa-jedna"') && STRANKA.includes('id="kupa-30dni"'), 'generátor s platbou chýba');
  assert.ok(STRANKA.includes('data-umami-event="efaktura_zaver_cta"'));
  // Ceny ako v ops/efaktura/ceny.mjs a na /efaktura/de/.
  assert.ok(text.includes('2,90 € zzgl. MwSt.') && text.includes('3,45 € inkl. 19 % MwSt. in Deutschland'));
  assert.ok(!/Stripe (?:als|ist) (?:Verkäufer|Merchant)/.test(text), 'nesprávna veta o predajcovi');
});

test('(d) interné odkazy: všetkých 6 nemeckých stránok e-faktúry odkazuje na viewer práve raz', () => {
  for (const rel of ['index.html', 'xrechnung-validator/index.html', 'xrechnung-erstellen/index.html', 'e-rechnung-freiberufler/index.html', 'csv-xrechnung/index.html', 'leitweg-id/index.html']) {
    const h = readFileSync(join(TU, 'de', rel), 'utf8');
    assert.equal((h.match(/href="\/efaktura\/de\/xrechnung-viewer\/"/g) || []).length, 1, rel);
  }
});

test('(d) sitemap-pages.xml a llms.txt: adresa práve raz, llms.txt nesľubuje CII', () => {
  const sm = readFileSync(join(HUB, 'sitemap-pages.xml'), 'utf8');
  assert.equal((sm.match(/<loc>https:\/\/arling\.sk\/efaktura\/de\/xrechnung-viewer\/<\/loc>/g) || []).length, 1);
  const llms = readFileSync(join(HUB, 'llms.txt'), 'utf8');
  const riadok = llms.split(/\r?\n/).filter((r) => r.includes('https://arling.sk/efaktura/de/xrechnung-viewer/'));
  assert.equal(riadok.length, 1);
  assert.ok(/CII/.test(riadok[0]) && /not displayed yet/.test(riadok[0]), riadok[0]);
});

test('(d) app.js na stránke s aktuálnym odtlačkom obsahu', () => {
  const verzia = createHash('sha256').update(readFileSync(new URL('./app.js', import.meta.url))).digest('hex').slice(0, 8);
  const v = [...STRANKA.matchAll(/\/efaktura\/app\.js\?v=([0-9a-f]+)/g)].map((m) => m[1]);
  assert.ok(v.length >= 1);
  for (const x of v) assert.equal(x, verzia);
});
