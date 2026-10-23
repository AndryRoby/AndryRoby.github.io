/* Testy bloku „Poslať si výsledok e-mailom“ na kontrole e-faktúry (relácia 205, SPEC 3, 5.2, 7.2).
 *
 * Prečo existuje: stránka sľubuje, že súbor neopustí prehliadač. Na server smie ísť len zhrnutie
 * z bieleho zoznamu (profil, typ, počty, kódy pravidiel). Testuje sa, že v ňom nie je IBAN, meno,
 * číslo faktúry, xpath ani názov súboru, že blok nejde pod vzor ani pod poškodené XML, že stránka
 * bez feed-monitor v connect-src blok neukáže, že starší import ani staršie poOdoslani neprepíšu
 * novší výsledok (bod 12a) a že ponuka odberu FAQ je samostatný súhlas.
 * usage: node --test products/arling-sk/efaktura/vysledok-blok.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  blokSmie, zhrnutieVysledku, kodDoZhrnutia, cspPovoluje, cspStranky, riadicBloku, nacitavacModulu,
  MODUL_BLOKU, POVOD_WORKERA, MAX_PRAVIDIEL, adresaOdberuFaq, ukazPonukuFaq, TEXTY_FAQ, nacitajPriVstupe, UDALOSTI_VSTUPU,
  pridajTlacidloEmailu, posunNaBlok,
} from './vysledok-blok.mjs';
import { skontroluj } from './pravidla.mjs';
import { vytvorUbl } from './ubl.js';
import { telo, ZDROJ } from './zmeny-faq/odber.js';

const TU = fileURLToPath(new URL('.', import.meta.url));
const APP = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const odtlacok = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 8);

function zdrojFunkcie(meno) {
  const od = APP.indexOf('function ' + meno + '(');
  assert.ok(od > 0, 'app.js: funkcia ' + meno + ' sa nenašla');
  let hlbka = 0;
  for (let j = APP.indexOf('{', od); j < APP.length; j++) {
    if (APP[j] === '{') hlbka += 1;
    else if (APP[j] === '}') { hlbka -= 1; if (hlbka === 0) return APP.slice(od, j + 1); }
  }
  throw new Error('app.js: telo funkcie ' + meno + ' sa neskončilo');
}

// ---------------------------------------------------------------- faktúra s osobnými údajmi

const IBAN_ZLY = 'SK3112000000198742637542'; // preklep v poslednej číslici, mod 97 neprejde
const MENO = 'Jana Vzorova';
const FIRMA = 'Tajna Firma Dodavatel s. r. o.';
const ODBERATEL = 'Odberatel Novak a. s.';
const CISLO = 'FA-2026-778899';
const NAZOV_SUBORU = 'faktura-novak-778899.xml';
function faktura() {
  return {
    typ: '380', profil: 'peppol', cislo: CISLO,
    datumVystavenia: '2026-09-11', datumDodania: '2026-09-10', datumSplatnosti: '2026-09-25',
    mena: 'EUR', referenciaOdberatela: 'OBJ-1', variabilnySymbol: '2026100', poznamka: 'Fakturujeme podla zmluvy.',
    dodavatel: {
      nazov: FIRMA, ico: '11223344', icDph: 'SK1122334455', ulica: 'Slnecna 12', mesto: 'Bratislava', psc: '81101',
      krajina: 'SK', kontakt: MENO, telefon: '+421 900 123 456', email: 'jana.vzorova@vzor.sk',
      iban: IBAN_ZLY, endpoint: '1122334455', endpointSchema: '0245',
    },
    odberatel: { nazov: ODBERATEL, ico: '99887766', icDph: 'SK9988776655', ulica: 'Nadrazna 5', mesto: 'Kosice', psc: '04001', krajina: 'SK', endpoint: '9988776655', endpointSchema: '0245' },
    sposobPlatby: '58',
    polozky: [{ nazov: 'Konzultacie', mnozstvo: 7, jednotka: 'HUR', cena: 45, sadzba: 23, kategoria: 'S' }],
  };
}

test('zhrnutie faktúry s IBAN a menom neobsahuje žiadnu hodnotu z faktúry ani názov súboru', () => {
  const xml = vytvorUbl(faktura(), { profil: 'peppol', jazyk: 'sk' });
  const v = skontroluj(xml);
  // Predpoklad testu: výsledok sám údaje z faktúry nesie (hodnota aj správa), inak by test nič nedokazoval.
  const iban = v.nalezy.find((n) => n.kod === 'ARL-IBAN');
  assert.ok(iban, 'vzorová faktúra mala dať nález ARL-IBAN');
  assert.ok(JSON.stringify(v).includes(IBAN_ZLY), 'výsledok kontroly by mal IBAN obsahovať (hodnota, správa)');
  const z = zhrnutieVysledku(v);
  const telo = JSON.stringify(z);
  for (const zakazane of [IBAN_ZLY, MENO, FIRMA, ODBERATEL, CISLO, NAZOV_SUBORU, '1122334455', 'jana.vzorova', '/Invoice', 'cac:', 'cbc:']) {
    assert.ok(!telo.includes(zakazane), 'zhrnutie obsahuje údaj z faktúry: ' + zakazane);
  }
  // Len polia z bieleho zoznamu, v pravidlách len kód, závažnosť a počet.
  assert.deepEqual(Object.keys(z), ['profil', 'typ', 'chyby', 'varovania', 'informacie', 'pravidla']);
  for (const p of z.pravidla) assert.deepEqual(Object.keys(p), ['kod', 'zavaznost', 'pocet']);
  assert.ok(z.pravidla.some((p) => p.kod === 'ARL-IBAN' && p.zavaznost === 'chyba' && p.pocet === 1));
  assert.equal(z.typ, 'Invoice');
  assert.equal(z.profil, 'peppol');
  assert.equal(z.chyby, v.sumar.chyby);
});

test('app.js posiela do bloku len zhrnutie, nikdy výsledok, názov súboru ani XML', () => {
  const f = zdrojFunkcie('ukazBlokEmailu');
  assert.ok(f.includes("r.ukaz({ nastroj: 'efaktura', jazyk: LANG, vysledok, poOdoslani:"), 'volanie ukaz nemá tvar zo SPEC 5.2');
  assert.ok(f.includes('zhrnutieVysledku(v)'), 'blok nedostáva zhrnutie z vysledok-blok.mjs');
  for (const zakazane of ['nazovSuboru', 'xmlText', 'protokol(', 'poslednyVysledok', 'sprava', 'hodnota', 'xpath']) {
    assert.ok(!f.includes(zakazane), 'ukazBlokEmailu pracuje s ' + zakazane);
  }
});

test('zoskupenie nálezov podľa kódu: počet, najvážnejšia závažnosť, poradie a strop 60', () => {
  const n = (kod, zavaznost, extra) => Object.assign({ kod, zavaznost, xpath: '/Invoice/x', hodnota: 'TAJNE', sprava: { sk: 'TAJNE' } }, extra);
  const v = {
    profil: 'xrechnung', typ: 'Invoice',
    nalezy: [n('BR-CO-15', 'varovanie'), n('BR-01', 'informacia'), n('BR-CO-15', 'chyba'), n('BR-CO-15', 'varovanie'),
      n('BR-DE-23-a', 'chyba'), n('zle kod', 'chyba'), n('<b>X</b>', 'chyba'), n('BR-02', 'neznama'), null],
    sumar: { chyby: 3.7, varovania: -2, informacie: 5000 },
  };
  const z = zhrnutieVysledku(v);
  assert.deepEqual(z.pravidla, [
    { kod: 'BR-CO-15', zavaznost: 'chyba', pocet: 3 },
    { kod: 'BR-DE-23-a', zavaznost: 'chyba', pocet: 1 },
    { kod: 'BR-01', zavaznost: 'informacia', pocet: 1 },
  ]);
  assert.equal(z.chyby, 3);
  assert.equal(z.varovania, 0);
  assert.equal(z.informacie, 1000);
  assert.ok(!JSON.stringify(z).includes('TAJNE'));
  const vela = { profil: 'peppol', typ: 'CreditNote', sumar: {}, nalezy: [] };
  for (let i = 0; i < 80; i++) vela.nalezy.push(n('BR-' + (100 + i), 'chyba'));
  for (let i = 0; i < 1500; i++) vela.nalezy.push(n('BR-CO-10', 'varovanie'));
  const zv = zhrnutieVysledku(vela);
  assert.equal(zv.pravidla.length, MAX_PRAVIDIEL);
  assert.ok(zv.pravidla.every((p) => p.zavaznost === 'chyba'), 'chyby majú prednosť pred varovaniami');
  assert.equal(zhrnutieVysledku({ profil: 'peppol', typ: 'Invoice', sumar: {}, nalezy: Array(1500).fill(n('BR-CO-10', 'varovanie')) }).pravidla[0].pocet, 1000);
  assert.equal(zhrnutieVysledku({ profil: 'cudzi', typ: 'Invoice', nalezy: [] }).profil, 'neznamy');
});

test('kódy XRechnung s malou príponou ostanú v oficiálnom zápise (O1 po V1 N1: worker podľa nich nájde normatívne znenie)', () => {
  assert.equal(kodDoZhrnutia('BR-DE-25-b'), 'BR-DE-25-b');
  assert.equal(kodDoZhrnutia('BR-DE-CVD-06-a'), 'BR-DE-CVD-06-a');
  assert.equal(kodDoZhrnutia('br-de-25-b'), '', 'malé písmená celého kódu validátor nevydáva');
  assert.equal(kodDoZhrnutia('BR-DE-25-ab'), '');
  assert.equal(kodDoZhrnutia('PEPPOL-EN16931-R001'), 'PEPPOL-EN16931-R001');
  assert.equal(kodDoZhrnutia('ARL-SK-DIC-TVAR'), 'ARL-SK-DIC-TVAR');
  assert.equal(kodDoZhrnutia('1BR'), '');
  assert.equal(kodDoZhrnutia('BR CO'), '');
  assert.equal(kodDoZhrnutia('A' + 'B'.repeat(40)), '');
  assert.equal(kodDoZhrnutia(undefined), '');
});

test('blok len pod skutočným výsledkom Invoice, CreditNote a CII, nie pod vzorom, chybaXml ani nic', () => {
  assert.equal(blokSmie({ typ: 'Invoice' }, false), true);
  assert.equal(blokSmie({ typ: 'CreditNote' }, false), true);
  assert.equal(blokSmie({ typ: 'CII' }, false), true);
  assert.equal(blokSmie({ typ: 'Invoice' }, true), false, 'vzor');
  assert.equal(blokSmie({ typ: 'chybaXml' }, false), false);
  assert.equal(blokSmie({ typ: 'nic' }, false), false);
  assert.equal(blokSmie(null, false), false);
  assert.equal(zhrnutieVysledku({ typ: 'chybaXml', nalezy: [], sumar: {} }), null);
  // Skutočné vstupy: poškodené XML a CII.
  assert.equal(blokSmie(skontroluj('<Invoice><nedokoncene'), false), false);
  const cii = skontroluj('<?xml version="1.0"?><rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"></rsm:CrossIndustryInvoice>');
  assert.equal(cii.typ, 'CII');
  assert.equal(blokSmie(cii, false), true);
  assert.equal(zhrnutieVysledku(cii).typ, 'CII');
});

test('poistka CSP: blok len keď connect-src obsahuje presne pôvod feed-monitor', () => {
  const zaklad = "default-src 'self'; script-src 'self' https://api.arling.workers.dev; connect-src 'self' https://api.arling.workers.dev";
  assert.equal(cspPovoluje(zaklad), false);
  assert.equal(cspPovoluje(zaklad + ' ' + POVOD_WORKERA + "; img-src 'self'"), true);
  assert.equal(cspPovoluje(zaklad + ' ' + POVOD_WORKERA + '.zly.sk'), false, 'predpona iného hostiteľa');
  assert.equal(cspPovoluje("script-src 'self' " + POVOD_WORKERA + "; connect-src 'self'"), false, 'pôvod len v script-src');
  assert.equal(cspPovoluje("default-src 'self' " + POVOD_WORKERA), false, 'bez connect-src');
  assert.equal(cspPovoluje(''), false);
  const meta = (he, c) => ({ getAttribute: (k) => (k === 'http-equiv' ? he : k === 'content' ? c : null) });
  const doc = (zoznam) => ({ querySelectorAll: () => zoznam });
  assert.equal(cspStranky(doc([meta('Content-Security-Policy', 'x')])), 'x');
  assert.equal(cspStranky(doc([meta('content-security-policy', 'y')])), 'y');
  assert.equal(cspStranky(doc([meta('refresh', 'z')])), '');
  assert.ok(zdrojFunkcie('riadicEmailu').includes('cspPovoluje(cspStranky(document))'), 'app.js nekontroluje CSP pred vložením bloku');
});

// ---------------------------------------------------------------- stránky

function stranky() {
  const out = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) { if (!['pravidla', 'regeln', 'rules', 'kviz', 'zmeny-faq'].includes(n)) walk(p); }
      else if (n === 'index.html') out.push(p);
    }
  };
  walk(TU);
  return out.filter((p) => readFileSync(p, 'utf8').includes('id="sumar"'));
}

test('všetkých 20 stránok s #sumar: feed-monitor v connect-src a app.js s aktuálnym odtlačkom', () => {
  const zoznam = stranky();
  assert.equal(zoznam.length, 20, 'počet stránok s kontrolou sa zmenil');
  const verzia = odtlacok(new URL('./app.js', import.meta.url));
  for (const p of zoznam) {
    const h = readFileSync(p, 'utf8');
    const csp = (h.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
    assert.ok(cspPovoluje(csp), p + ': connect-src bez ' + POVOD_WORKERA);
    const v = [...h.matchAll(/\/efaktura\/app\.js\?v=([0-9a-f]+)/g)].map((m) => m[1]);
    assert.ok(v.length >= 1, p + ': app.js sa nenačítava');
    for (const x of v) assert.equal(x, verzia, p + ': app.js ?v= nesedí s obsahom');
  }
});

// ---------------------------------------------------------------- P3 brány 205: vety o odosielaní a ukladaní

// Absolútne vety, ktoré by po bloku výsledku e-mailom klamali (ide adresa a zhrnutie a do odoslania sa uložia).
const ABSOLUTNE = /jediná vec|jediné, čo|Exactly one thing|einzige Sache|jediná věc|nič neukladáme|store nothing|speichern nichts|nic neukládáme|neukladáme vaše údaje|neukládáme vaše údaje|speichern Ihre Daten nicht/;
// Výnimka presne v znení brány (ops/ai/kontrola/2026-10-23-vysledok-emailom-205.md, P3 pokusu 1 a N1 pokusu 2:
// do odoslania len v databáze, kópia odoslaného e-mailu ostáva v našej pošte, zásady časť 3).
const VYNIMKA = {
  sk: 'Výnimka: ak si pod výsledkom dobrovoľne necháte poslať výsledok e-mailom, odíde vaša e-mailová adresa a zhrnutie (profil, počty a kódy pravidiel, nikdy súbor) a do odoslania ich uložíme v databáze; kópia odoslaného e-mailu ostáva v našej pošte (zásady, časť 3).',
  en: 'One exception: if you choose to have the result emailed below the check, your email address and a summary (profile, counts and rule codes, never the file) go to our server and are kept in our database until the email is sent; a copy of the sent email stays in our mailbox (privacy policy, section 3).',
  de: 'Eine Ausnahme: Wenn Sie sich das Ergebnis unter der Prüfung freiwillig per E-Mail senden lassen, gehen Ihre E-Mail-Adresse und eine Zusammenfassung (Profil, Anzahlen und Regelcodes, nie die Datei) an unseren Server und werden bis zum Versand in unserer Datenbank gespeichert; eine Kopie der gesendeten E-Mail bleibt in unserem Postfach (Datenschutzerklärung, Teil 3).',
  cs: 'Výjimka: pokud si pod výsledkem dobrovolně necháte poslat výsledek e-mailem, odejde vaše e-mailová adresa a shrnutí (profil, počty a kódy pravidel, nikdy soubor) a do odeslání je uložíme v databázi; kopie odeslaného e-mailu zůstává v naší poště (zásady, část 3).',
};
const NIC = { sk: 'nič neukladáme', en: 'store nothing', de: 'speichern nichts', cs: 'nic neukládáme' };
const OKREM = { sk: 'nič neukladáme okrem výsledku e-mailom, o ktorý požiadate', en: 'store nothing except the emailed result you ask for', de: 'speichern nichts außer dem Ergebnis per E-Mail, das Sie anfordern', cs: 'nic neukládáme kromě výsledku e-mailem, o který požádáte' };
const POLOZKA = {
  sk: ['Výsledok e-mailom.', 'Len ak oň pod výsledkom požiadate: adresa a zhrnutie (profil, počty, kódy pravidiel), nikdy súbor.', '/privacy/#vysledok-emailom'],
  en: ['Result by email.', 'Only if you ask for it below the result: your address and a summary (profile, counts, rule codes), never the file.', '/privacy/en/#vysledok-emailom'],
  de: ['Ergebnis per E-Mail.', 'Nur wenn Sie es unter dem Ergebnis anfordern: Ihre Adresse und eine Zusammenfassung (Profil, Anzahlen, Regelcodes), nie die Datei.', '/privacy/de/#vysledok-emailom'],
  cs: ['Výsledek e-mailem.', 'Jen pokud o něj pod výsledkem požádáte: adresa a shrnutí (profil, počty, kódy pravidel), nikdy soubor.', '/privacy/#vysledok-emailom'],
};
const jazykStranky = (p) => (p.replace(/\\/g, '/').match(/\/efaktura\/(en|de|cs)\//) || [])[1] || 'sk';
const odkry = (s) => s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const retazceLd = (x, out = []) => { if (typeof x === 'string') out.push(x); else if (x && typeof x === 'object') for (const v of Object.values(x)) retazceLd(v, out); return out; };

test('P3: na 20 stránkach s #sumar žiadna absolútna veta o serveri a ukladaní bez výnimky v tom istom odseku alebo odpovedi; FAQ v HTML = JSON-LD', () => {
  const zoznam = stranky();
  assert.equal(zoznam.length, 20);
  let vety = 0, vetyLd = 0, faq = 0;
  for (const p of zoznam) {
    const h = readFileSync(p, 'utf8');
    const j = jazykStranky(p);
    const telo = h.replace(/<script[\s\S]*?<\/script>/g, '');
    // Každý odsek, položka, odpoveď a nadpis zvlášť: výnimka musí byť v tom istom odseku, nie inde na stránke.
    for (const m of telo.matchAll(/<(p|li|dd|h2|h3|summary|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
      const t = odkry(m[2]);
      if (!ABSOLUTNE.test(t)) continue;
      vety += 1;
      assert.ok(t.includes(VYNIMKA[j]), p + ': veta bez výnimky v tom istom odseku: ' + t.slice(0, 160));
      if (t.includes(NIC[j])) assert.ok(t.includes(OKREM[j]), p + ': „' + NIC[j] + '“ bez „' + OKREM[j] + '“');
    }
    const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    for (const s of ld.flatMap((x) => retazceLd(x))) {
      if (!ABSOLUTNE.test(s)) continue;
      vetyLd += 1;
      assert.ok(s.includes(VYNIMKA[j]), p + ': JSON-LD bez výnimky: ' + s.slice(0, 160));
      if (s.includes(NIC[j])) assert.ok(s.includes(OKREM[j]), p + ': JSON-LD „' + NIC[j] + '“ bez „' + OKREM[j] + '“');
    }
    // FAQ: každá otázka JSON-LD má v HTML rovnakú otázku aj odpoveď (text bez značiek) a naopak.
    const ldFaq = ld.flatMap((x) => (x['@graph'] || [x])).filter((y) => y['@type'] === 'FAQPage').flatMap((f) => f.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]));
    const htmlFaq = [...h.matchAll(/<details class="otazka"><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map((m) => [odkry(m[1]), odkry(m[2])]);
    assert.ok(ldFaq.length > 0, p + ': bez FAQ v JSON-LD');
    assert.deepEqual(htmlFaq, ldFaq, p + ': FAQ v HTML a v JSON-LD sa líšia');
    faq += ldFaq.length;
  }
  // 14 odsekov a odpovedí na 11 stránkach a 7 odpovedí v JSON-LD (stav 23. 10. 2026); menej = test stratil, čo stráži.
  assert.ok(vety >= 14, 'test nenašiel vety, ktoré má strážiť (' + vety + ')');
  assert.ok(vetyLd >= 7, 'test nenašiel vety v JSON-LD (' + vetyLd + ')');
  assert.ok(faq >= 120);
});

test('P3: zoznam „Ide na server“ (13 stránok) má položku výsledku e-mailom s odkazom na zásady v jazyku a súhrn pod ním vetu o nej', () => {
  let n = 0;
  for (const p of stranky()) {
    const h = readFileSync(p, 'utf8');
    if (!h.includes('class="ef-udaje"')) continue;
    n += 1;
    const j = jazykStranky(p);
    const [nadpis, veta, odkaz] = POLOZKA[j];
    const server = (h.match(/<div class="ef-server[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '';
    const polozky = [...server.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
    const moja = polozky.find((x) => x.includes('<b>' + nadpis + '</b>'));
    assert.ok(moja, p + ': v zozname „Ide na server“ chýba ' + nadpis);
    assert.ok(odkry(moja).includes(nadpis + ' ' + veta), p + ': text položky: ' + odkry(moja));
    assert.ok(moja.includes('<a href="' + odkaz + '">'), p + ': odkaz na zásady v jazyku ' + odkaz);
    assert.equal(polozky.filter((x) => x.includes(nadpis)).length, 1, p + ': položka dvakrát');
    // Súhrn pod zoznamami: odsek data-efaktura-privacy patrí generátoru ops/marketing/efaktura-dopyt.mjs, preto
    // veta o výsledku e-mailom stojí vo vlastnom odseku hneď za ním (generátor ho neprepíše).
    const suhrn = h.indexOf('<p data-efaktura-privacy>');
    const vlastny = h.indexOf('<p data-efaktura-vysledok>');
    assert.ok(suhrn > 0 && vlastny > suhrn && h.slice(suhrn, vlastny).split('</p>').length === 2, p + ': veta o výsledku e-mailom nie je hneď za súhrnom');
    assert.ok(/nikdy súbor|never the file|nie die Datei|nikdy soubor/.test(h.slice(vlastny, h.indexOf('</p>', vlastny))), p + ': súhrn nehovorí, že súbor neodchádza');
  }
  assert.equal(n, 13, 'počet stránok so zoznamom „Ide na server“ sa zmenil');
  for (const z of ['', 'en/', 'de/']) assert.ok(readFileSync(join(TU, '..', 'privacy', z, 'index.html'), 'utf8').includes('id="vysledok-emailom"'), 'kotva #vysledok-emailom v zásadách ' + z);
});

test('P3: generátor prístavných stránok (ops/efaktura/pristavne.json) má v FAQ tie isté vety s výnimkou ako stránky', () => {
  const zaznamy = JSON.parse(readFileSync(join(TU, '..', '..', '..', 'ops', 'efaktura', 'pristavne.json'), 'utf8'));
  let n = 0;
  for (const s of zaznamy) {
    for (const [, a] of s.faq) {
      if (!ABSOLUTNE.test(a)) continue;
      n += 1;
      assert.ok(a.includes(VYNIMKA[s.lang]), s.lang + '/' + s.slug + ': FAQ v pristavne.json bez výnimky');
      if (a.includes(NIC[s.lang])) assert.ok(a.includes(OKREM[s.lang]), s.lang + '/' + s.slug + ': bez „' + OKREM[s.lang] + '“');
    }
    // Stránka, ktorú generátor vyrába (nie ručná), má v JSON-LD presne FAQ zo súboru, takže nový beh výnimku nezmaže.
    if (s.rucne) continue;
    const h = readFileSync(join(TU, s.lang, s.slug, 'index.html'), 'utf8');
    const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const ldFaq = ld.flatMap((x) => (x['@graph'] || [x])).filter((y) => y['@type'] === 'FAQPage').flatMap((f) => f.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]));
    for (const [q, a] of s.faq) if (ABSOLUTNE.test(a)) assert.deepEqual(ldFaq.find((x) => x[0] === q), [q, a], s.lang + '/' + s.slug + ': odpoveď na stránke iná než v pristavne.json');
  }
  assert.equal(n, 4, 'počet viet s výnimkou v pristavne.json');
});

// ---------------------------------------------------------------- N1 brány 205 (pokus 2): „do odoslania“ len v databáze

// Kópia e-mailu s adresou a zhrnutím ostáva v Odoslaných (zásady, časť 3), preto veta „do odoslania ich uložíme“ bez
// „v databáze“ a bez vety o kópii nie je pravdivá. Test číta každú vetu o uložení do odoslania zvlášť, nielen presné
// znenie výnimky, takže zachytí aj novú vetu s iným slovosledom.
const DO_ODOSLANIA = /do odoslania|until the email is sent|until it is sent|bis zum Versand|bis es gesendet|do odeslání/;
const DATABAZA = { sk: /v databáze/, en: /in our database/, de: /in unserer Datenbank/, cs: /v databázi/ };
const KOPIA = {
  sk: 'kópia odoslaného e-mailu ostáva v našej pošte', en: 'a copy of the sent email stays in our mailbox',
  de: 'eine Kopie der gesendeten E-Mail bleibt in unserem Postfach', cs: 'kopie odeslaného e-mailu zůstává v naší poště',
};
const vetyO = (t) => t.split(/(?<=[.!?])\s+/).filter((v) => DO_ODOSLANIA.test(v) && /e-?mail/i.test(v));

test('N1: každá veta o uložení do odoslania na 20 stránkach s #sumar (HTML aj JSON-LD) a v pristavne.json hovorí „v databáze“ a o kópii v našej pošte', () => {
  let html = 0, ld = 0, gen = 0;
  const over = (veta, j, kde) => {
    assert.match(veta, DATABAZA[j], kde + ': veta o uložení bez „' + DATABAZA[j].source + '“: ' + veta);
    assert.ok(veta.includes(KOPIA[j]), kde + ': veta o uložení bez vety o kópii e-mailu: ' + veta);
    assert.ok(veta.indexOf(KOPIA[j]) > veta.search(DATABAZA[j]), kde + ': kópia má nasledovať za databázou: ' + veta);
  };
  for (const p of stranky()) {
    const h = readFileSync(p, 'utf8');
    const j = jazykStranky(p);
    const telo = odkry(h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<\/(p|li|dd|h2|h3|summary|figcaption)>/g, ' '));
    for (const v of vetyO(telo)) { html += 1; over(v, j, p); }
    const ldr = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => retazceLd(JSON.parse(m[1])));
    for (const s of ldr) for (const v of vetyO(s)) { ld += 1; over(v, j, p + ' JSON-LD'); }
  }
  const zaznamy = JSON.parse(readFileSync(join(TU, '..', '..', '..', 'ops', 'efaktura', 'pristavne.json'), 'utf8'));
  for (const s of zaznamy) for (const [, a] of s.faq) for (const v of vetyO(a)) { gen += 1; over(v, s.lang, 'pristavne.json ' + s.lang + '/' + s.slug); }
  // Stav 23. 10. 2026: 14 odsekov a odpovedí v HTML, 7 odpovedí v JSON-LD na 11 stránkach, 4 odpovede v pristavne.json.
  assert.equal(html, 14, 'počet viet o uložení v HTML');
  assert.equal(ld, 7, 'počet viet o uložení v JSON-LD');
  assert.equal(gen, 4, 'počet viet o uložení v pristavne.json');
});

test('import vysledok-blok.mjs v app.js nesie odtlačok obsahu a modul hubu verziu 1', () => {
  const m = APP.match(/from '\.\/vysledok-blok\.mjs\?v=([0-9a-f]+)'/);
  assert.ok(m, 'app.js neimportuje vysledok-blok.mjs s ?v=');
  assert.equal(m[1], odtlacok(new URL('./vysledok-blok.mjs', import.meta.url)), 'zmenený vysledok-blok.mjs bez nového ?v=');
  assert.equal(MODUL_BLOKU, '/vysledok/vysledok-email.js?v=1');
});

// ---------------------------------------------------------------- P4 brány 205: miesto za #nalezy, tlačidlo v #akcie

// Malý falošný DOM: deti, súrodenci, jednoduché zložené selektory (tag, .trieda, #id, [atribút="hodnota"]).
class Uzol {
  constructor(tag, doc) {
    Object.assign(this, { tagName: tag.toUpperCase(), ownerDocument: doc, children: [], parentNode: null, attrs: {}, hidden: false, className: '', id: '', textContent: '', type: '', zoznam: {}, fokus: 0, fokusMoznosti: null, posuny: [] });
  }
  get nextSibling() { const p = this.parentNode; return p ? p.children[p.children.indexOf(this) + 1] || null : null; }
  get firstChild() { return this.children[0] || null; }
  appendChild(c) { return this.insertBefore(c, null); }
  insertBefore(c, ref) {
    if (c.parentNode) c.parentNode.removeChild(c);
    const i = ref ? this.children.indexOf(ref) : -1;
    if (ref && i === -1) throw new Error('insertBefore: ref nie je dieťa');
    if (i === -1) this.children.push(c); else this.children.splice(i, 0, c);
    c.parentNode = this;
    return c;
  }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; }
  replaceChildren(...n) { for (const c of [...this.children]) this.removeChild(c); for (const c of n) this.appendChild(c); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t, f) { (this.zoznam[t] ||= []).push(f); }
  click() { for (const f of this.zoznam.click || []) f({ type: 'click', target: this }); }
  focus(o) { this.fokus += 1; this.fokusMoznosti = o === undefined ? null : o; this.ownerDocument.activeElement = this; }
  scrollIntoView(o) { this.posuny.push(o); }
  matches(sel) {
    const m = /^([a-z0-9]*)((?:[.#][\w-]+)*)((?:\[[\w-]+="[^"]*"\])*)$/i.exec(sel.trim());
    if (!m) throw new Error('falošný DOM nepozná selektor ' + sel);
    if (m[1] && m[1].toUpperCase() !== this.tagName) return false;
    for (const [, druh, meno] of m[2].matchAll(/([.#])([\w-]+)/g)) {
      if (druh === '#' && this.id !== meno) return false;
      if (druh === '.' && !this.className.split(/\s+/).includes(meno)) return false;
    }
    for (const [, k, v] of m[3].matchAll(/\[([\w-]+)="([^"]*)"\]/g)) if (this.getAttribute(k) !== v) return false;
    return true;
  }
  querySelector(sel) { for (const c of this.children) { if (c.matches(sel)) return c; const q = c.querySelector(sel); if (q) return q; } return null; }
}
function falosnaStranka({ sk = true } = {}) {
  const doc = { activeElement: null };
  doc.createElement = (t) => new Uzol(t, doc);
  doc.body = new Uzol('body', doc);
  doc.getElementById = (id) => { const najdi = (u) => { if (u.id === id) return u; for (const c of u.children) { const x = najdi(c); if (x) return x; } return null; }; return najdi(doc.body); };
  const pridaj = (rodic, tag, id, trieda = '') => { const e = doc.createElement(tag); e.id = id; e.className = trieda; rodic.appendChild(e); return e; };
  const ram = pridaj(doc.body, 'div', 'vysledok', 'ef-pravy');
  pridaj(ram, 'div', 'sumar');
  pridaj(ram, 'aside', 'opakovanie-cta', 'ef-opak');
  pridaj(ram, 'div', 'kupa-vysledok-blok', 'kupa-vysledok');
  const akcie = pridaj(ram, 'div', 'akcie', 'akcie');
  pridaj(akcie, 'button', 'protokol', 'btn btn-line');
  pridaj(akcie, 'button', 'kopirovat', 'btn btn-line');
  const nalezy = pridaj(ram, 'div', 'nalezy');
  pridaj(nalezy, 'article', '', 'nalez nalez-chyba');
  pridaj(nalezy, 'article', '', 'nalez nalez-varovanie');
  const faqOdber = sk ? pridaj(ram, 'aside', 'faq-odber', 'ef-opak ef-faq') : null;
  return { doc, ram, akcie, nalezy, faqOdber };
}
// Modul hubu tak, ako blok vykresľuje vysledok-email.js: sekcia, formulár s poľom (a pascou s tabindex -1), stav hotovo
// s nadpisom tabindex -1. Vracia odpoved (false = zhrnutie odmietnuté).
function falosnyHub() {
  const m = { volania: [], odpoved: true, casti: null };
  m.ukaz = (miesto, data) => {
    m.volania.push(['ukaz', data]);
    const d = miesto.ownerDocument;
    miesto.replaceChildren(); miesto.hidden = true;
    if (m.odpoved === false) return false;
    const sek = d.createElement('section'); sek.className = 'vys-email';
    const uvod = d.createElement('div'); uvod.className = 'vys-uvod';
    const pasca = d.createElement('div'); pasca.className = 'vys-pasca'; pasca.hidden = true;
    const pi = d.createElement('input'); pi.className = 'pasca'; pi.setAttribute('tabindex', '-1'); pasca.appendChild(pi);
    const pole = d.createElement('input'); pole.className = 'vys-pole';
    uvod.appendChild(pole); uvod.appendChild(pasca);
    const hotovo = d.createElement('div'); hotovo.className = 'vys-hotovo'; hotovo.hidden = true;
    const h = d.createElement('h3'); h.className = 'vys-nadpis'; h.setAttribute('tabindex', '-1'); hotovo.appendChild(h);
    sek.appendChild(uvod); sek.appendChild(hotovo);
    miesto.appendChild(sek); miesto.hidden = false;
    m.casti = { sek, uvod, pole, pi, hotovo, h };
    return true;
  };
  m.skry = (miesto) => { m.volania.push(['skry']); miesto.replaceChildren(); miesto.hidden = true; };
  return m;
}
const TEXT_TLACIDLA = { sk: 'Poslať e-mailom', en: 'Email it', de: 'Per E-Mail senden', cs: 'Poslat e-mailem' };
// Skutočné funkcie app.js (riadicEmailu, ukazBlokEmailu, skryBlokEmailu, klikPoslatEmailom) nad falošnou stránkou.
function appBlok({ stranka, nacitaj, jazyk = 'sk', csp = true, ticho = false }) {
  const mena = ['riadicEmailu', 'klikPoslatEmailom', 'redukovanyPohyb', 'zavriPonukuFaq', 'skryBlokEmailu', 'ukazBlokEmailu'];
  const kod = 'let blokEmailu = null;\n' + mena.map(zdrojFunkcie).join('\n') + '\nreturn { ' + mena.join(', ') + ', blok: () => blokEmailu };';
  const okno = { matchMedia: (q) => ({ matches: ticho && q === '(prefers-reduced-motion: reduce)' }) };
  const z = {
    $: (id) => stranka.doc.getElementById(id),
    el: (meno, trieda, text) => { const e = stranka.doc.createElement(meno); if (trieda) e.className = trieda; if (text) e.textContent = String(text); return e; },
    cspPovoluje: () => csp, cspStranky: () => '', document: stranka.doc, window: okno, riadicBloku, nacitajModulBloku: nacitaj,
    pridajTlacidloEmailu, posunNaBlok, T: { poslatEmailom: TEXT_TLACIDLA[jazyk] }, vstupJeUkazka: false, LANG: jazyk,
    ponukniFaq: () => {}, blokSmie, zhrnutieVysledku, vycisti: (u) => { while (u && u.firstChild) u.removeChild(u.firstChild); },
  };
  return new Function(...Object.keys(z), kod)(...Object.values(z));
}
const VYSLEDOK_S_CHYBOU = { profil: 'peppol', typ: 'Invoice', sumar: { chyby: 1, varovania: 1, informacie: 0 }, nalezy: [{ kod: 'BR-CO-15', zavaznost: 'chyba' }, { kod: 'BR-CO-10', zavaznost: 'varovanie' }] };
const tik = () => new Promise((ok) => setTimeout(ok, 0));

test('P4: miesto za #nalezy (pred #faq-odber), tlačidlo „Poslať e-mailom“ v #akcie, klik = posun a fokus na pole', async () => {
  const s = falosnaStranka();
  const hub = falosnyHub();
  const d = odlozene();
  const app = appBlok({ stranka: s, nacitaj: () => d.p });
  assert.equal(s.doc.getElementById('ef-vysledok-email'), null, 'miesto pred výsledkom');
  app.ukazBlokEmailu(VYSLEDOK_S_CHYBOU);
  const miesto = s.doc.getElementById('ef-vysledok-email');
  const faq = s.doc.getElementById('ef-vysledok-faq');
  assert.ok(miesto && faq, 'miesto a ponuka FAQ');
  assert.equal(s.nalezy.nextSibling, miesto, 'miesto nie je hneď za #nalezy');
  assert.equal(miesto.nextSibling, faq, 'ponuka FAQ nie je hneď pod miestom');
  assert.equal(faq.nextSibling, s.faqOdber, 'blok má stáť pred #faq-odber');
  assert.ok(s.ram.children.indexOf(miesto) > s.ram.children.indexOf(s.akcie), 'blok nad akciami');
  // Tlačidlo: tretie v #akcie, rodina btn btn-line, viditeľné hneď s výsledkom (rad akcií sa neprestaví neskôr).
  const tl = s.doc.getElementById('ef-poslat-email');
  assert.ok(tl, 'tlačidlo v #akcie chýba');
  assert.equal(tl.parentNode, s.akcie);
  assert.deepEqual(s.akcie.children.map((x) => x.id), ['protokol', 'kopirovat', 'ef-poslat-email']);
  assert.equal(tl.tagName, 'BUTTON');
  assert.equal(tl.type, 'button');
  assert.equal(tl.className, 'btn btn-line');
  assert.equal(tl.textContent, 'Poslať e-mailom');
  assert.equal(tl.getAttribute('aria-controls'), 'ef-vysledok-email');
  assert.equal(tl.hidden, false, 'tlačidlo sa neukázalo spolu s výsledkom');
  // Klik, kým sa modul ešte načítava: posun a fokus hneď po vykreslení bloku.
  tl.click();
  assert.equal(s.doc.activeElement, null, 'fokus pred vykreslením bloku');
  d.ok(hub); await tik();
  const c = hub.casti;
  assert.equal(s.doc.activeElement, c.pole, 'klik nedal fokus do poľa e-mailu');
  assert.deepEqual(c.pole.fokusMoznosti, { preventScroll: true }, 'fokus by druhýkrát posunul stránku');
  assert.deepEqual(c.sek.posuny, [{ behavior: 'smooth', block: 'start' }]);
  // Klik po vykreslení: hneď, v tej istej úlohe (mobilná klávesnica sa otvorí len pri fokuse v obsluhe kliku).
  tl.click();
  assert.equal(c.pole.fokus, 2, 'druhý klik nedal fokus hneď');
  assert.equal(c.sek.posuny.length, 2);
  // Stav „Skontrolujte schránku“: formulár je skrytý, fokus dostane nadpis stavu, nie pasca s tabindex -1.
  c.uvod.hidden = true; c.hotovo.hidden = false;
  tl.click();
  assert.equal(s.doc.activeElement, c.h, 'fokus nie je na nadpise stavu');
  assert.equal(c.pi.fokus, 0, 'fokus na pasci');
  // Nová kontrola (skry): tlačidlo zmizne a klik nikam neposunie.
  app.skryBlokEmailu();
  assert.equal(tl.hidden, true, 'tlačidlo ostalo pri skrytom bloku');
  assert.equal(miesto.hidden, true);
  const pred = c.sek.posuny.length;
  tl.click(); await tik();
  assert.equal(c.sek.posuny.length, pred, 'klik pri skrytom bloku posúval');
  // Ďalší výsledok použije to isté miesto a to isté tlačidlo.
  app.ukazBlokEmailu(VYSLEDOK_S_CHYBOU); await tik();
  assert.equal(tl.hidden, false);
  assert.equal((s.akcie.children.filter((x) => x.id === 'ef-poslat-email')).length, 1, 'druhé tlačidlo');
  assert.equal(s.ram.children.filter((x) => x.id === 'ef-vysledok-email').length, 1, 'druhé miesto');
});

test('P4: pri zníženom pohybe posun bez animácie; tlačidlo je v jazyku stránky', async () => {
  for (const jazyk of ['sk', 'en', 'de', 'cs']) {
    const s = falosnaStranka({ sk: jazyk === 'sk' });
    const hub = falosnyHub();
    const app = appBlok({ stranka: s, nacitaj: () => Promise.resolve(hub), jazyk, ticho: true });
    app.ukazBlokEmailu(VYSLEDOK_S_CHYBOU); await tik();
    const tl = s.doc.getElementById('ef-poslat-email');
    assert.equal(tl.textContent, TEXT_TLACIDLA[jazyk], jazyk);
    tl.click();
    assert.deepEqual(hub.casti.sek.posuny, [{ behavior: 'instant', block: 'start' }], jazyk + ': znížený pohyb s animáciou');
    assert.equal(s.doc.activeElement, hub.casti.pole);
  }
  // Texty tlačidla priamo v app.js (T pre sk, cs, de, en v tomto poradí).
  assert.deepEqual([...APP.matchAll(/poslatEmailom: '([^']+)'/g)].map((m) => m[1]), ['Poslať e-mailom', 'Poslat e-mailem', 'Per E-Mail senden', 'Email it']);
});

test('P4: tlačidlo len za podmienok bloku (blokSmie, CSP); keď sa blok neukáže, tlačidlo zmizne; starý klik nič nespraví', async () => {
  // Vzor, poškodené XML: bez miesta aj bez tlačidla.
  const s1 = falosnaStranka();
  const a1 = appBlok({ stranka: s1, nacitaj: () => Promise.resolve(falosnyHub()) });
  a1.ukazBlokEmailu({ typ: 'chybaXml', nalezy: [], sumar: {} });
  assert.equal(s1.doc.getElementById('ef-poslat-email'), null);
  assert.equal(s1.doc.getElementById('ef-vysledok-email'), null);
  // CSP stránky nepustí feed-monitor: blok ani tlačidlo.
  const s2 = falosnaStranka();
  appBlok({ stranka: s2, nacitaj: () => Promise.resolve(falosnyHub()), csp: false }).ukazBlokEmailu(VYSLEDOK_S_CHYBOU);
  assert.equal(s2.doc.getElementById('ef-poslat-email'), null, 'tlačidlo bez CSP');
  assert.equal(s2.doc.getElementById('ef-vysledok-email'), null);
  // Modul zhrnutie odmietne, alebo sa nenačíta: tlačidlo nevedie nikam, preto zmizne.
  for (const nacitaj of [() => { const h = falosnyHub(); h.odpoved = false; return Promise.resolve(h); }, () => Promise.reject(new Error('siet'))]) {
    const s = falosnaStranka();
    const a = appBlok({ stranka: s, nacitaj });
    a.ukazBlokEmailu(VYSLEDOK_S_CHYBOU);
    assert.equal(s.doc.getElementById('ef-poslat-email').hidden, false);
    await tik();
    assert.equal(s.doc.getElementById('ef-poslat-email').hidden, true, 'tlačidlo ostalo bez bloku');
  }
  // Bod 12a: klik počas načítania, potom nový výsledok skôr než modul príde; starý klik nič neposunie ani nefokusuje,
  // nový blok sa ukáže a ďalší klik už funguje.
  const s3 = falosnaStranka();
  const hub = falosnyHub();
  const d = odlozene();
  const a3 = appBlok({ stranka: s3, nacitaj: () => d.p });
  a3.ukazBlokEmailu(VYSLEDOK_S_CHYBOU);
  s3.doc.getElementById('ef-poslat-email').click();
  a3.skryBlokEmailu();
  a3.ukazBlokEmailu(VYSLEDOK_S_CHYBOU);
  d.ok(hub); await tik();
  assert.equal(hub.volania.filter((x) => x[0] === 'ukaz').length, 1, 'ukázať sa mal len nový blok');
  assert.equal(s3.doc.activeElement, null, 'starý klik dal fokus');
  assert.equal(hub.casti.sek.posuny.length, 0, 'starý klik posunul stránku');
  s3.doc.getElementById('ef-poslat-email').click();
  assert.equal(s3.doc.activeElement, hub.casti.pole);
});

test('app.js: skry pri novom vstupe a pri každej novej kontrole, blok a tlačidlo až s výsledkom, nie pod vzorom', () => {
  assert.ok(zdrojFunkcie('prijmiText').includes('skryBlokEmailu();'), 'nový vstup blok neskryje');
  const k = zdrojFunkcie('spustiKontrolu');
  assert.ok(k.indexOf('skryBlokEmailu();') !== -1 && k.indexOf('skryBlokEmailu();') < k.indexOf('skontroluj(xmlText)'), 'kontrola neskryje starý blok pred novým výsledkom');
  assert.ok(k.indexOf('ukazBlokEmailu(v);') > k.indexOf('akcie.hidden = false'), 'blok sa ukazuje pred vykreslením výsledku');
  assert.ok(k.indexOf('ukazBlokEmailu(v);') > k.indexOf('cielNalezy.appendChild(riadokNalezu(n))'), 'blok pred nálezmi');
  assert.ok(zdrojFunkcie('ukazBlokEmailu').includes('blokSmie(v, vstupJeUkazka)'), 'blok sa ukáže aj pod vzorom');
  assert.ok(zdrojFunkcie('riadicEmailu').includes('nalezy.parentNode.insertBefore(miesto, nalezy.nextSibling)'), 'miesto nie je hneď za #nalezy');
  // Tlačidlo má triedu .btn (display:inline-flex v paper.css), atribút hidden ho skryje len s pravidlom [hidden] !important.
  for (const p of stranky()) {
    const h = readFileSync(p, 'utf8');
    assert.ok(/\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/.test(h), p + ': bez pravidla [hidden]{display:none !important}');
    assert.ok(h.indexOf('id="akcie"') > 0 && h.indexOf('id="akcie"') < h.indexOf('id="nalezy"'), p + ': #akcie nie je nad #nalezy');
  }
});

// ---------------------------------------------------------------- poradie (bod 12a)

function odlozene() { let ok, zle; const p = new Promise((a, b) => { ok = a; zle = b; }); return { p, ok, zle }; }
function falosnyModul() {
  const zaznam = [];
  return { zaznam, ukaz: (miesto, data) => zaznam.push(['ukaz', data]), skry: () => zaznam.push(['skry']) };
}

test('neskorý import: skry a nový výsledok pred načítaním modulu, ukáže sa len nový', async () => {
  const d = odlozene();
  const m = falosnyModul();
  const miesto = { hidden: true };
  const r = riadicBloku({ nacitaj: () => d.p, miesto });
  const a = r.ukaz({ vysledok: 'A' });
  r.skry();
  const b = r.ukaz({ vysledok: 'B' });
  d.ok(m);
  assert.equal(await a, false);
  assert.equal(await b, true);
  assert.deepEqual(m.zaznam.filter((x) => x[0] === 'ukaz').map((x) => x[1].vysledok), ['B']);
  assert.equal(miesto.hidden, false);
});

test('neskorý import po skry: nič sa neukáže a miesto ostane skryté', async () => {
  const d = odlozene();
  const m = falosnyModul();
  const miesto = { hidden: true };
  const r = riadicBloku({ nacitaj: () => d.p, miesto });
  const a = r.ukaz({ vysledok: 'A' });
  r.skry();
  d.ok(m);
  assert.equal(await a, false);
  assert.equal(m.zaznam.length, 0);
  assert.equal(miesto.hidden, true);
});

test('odpoveď (poOdoslani) zo staršieho bloku po novom výsledku sa zahodí, novšia prejde', async () => {
  const m = falosnyModul();
  const miesto = { hidden: true };
  const r = riadicBloku({ nacitaj: () => Promise.resolve(m), miesto });
  const volane = [];
  await r.ukaz({ vysledok: 'A', poOdoslani: (e) => volane.push('A:' + e) });
  const staryPo = m.zaznam[0][1].poOdoslani;
  await r.ukaz({ vysledok: 'B', poOdoslani: (e) => volane.push('B:' + e) });
  staryPo('a@b.sk'); // odpoveď na staršie odoslanie prišla až po novom výsledku
  assert.deepEqual(volane, []);
  m.zaznam[1][1].poOdoslani('c@d.sk');
  assert.deepEqual(volane, ['B:c@d.sk']);
  // Odpoveď pred novým výsledkom prejde normálne.
  const m2 = falosnyModul();
  const r2 = riadicBloku({ nacitaj: () => Promise.resolve(m2), miesto: { hidden: true } });
  const volane2 = [];
  await r2.ukaz({ vysledok: 'A', poOdoslani: (e) => volane2.push(e) });
  m2.zaznam[0][1].poOdoslani('x@y.sk');
  await r2.ukaz({ vysledok: 'B' });
  assert.deepEqual(volane2, ['x@y.sk']);
});

test('skry po zobrazení zavolá skry modulu; chyba importu sa ticho ignoruje', async () => {
  const m = falosnyModul();
  const miesto = { hidden: true };
  const r = riadicBloku({ nacitaj: () => Promise.resolve(m), miesto });
  await r.ukaz({ vysledok: 'A' });
  r.skry();
  assert.deepEqual(m.zaznam.map((x) => x[0]), ['ukaz', 'skry']);
  assert.equal(miesto.hidden, true);
  const zly = riadicBloku({ nacitaj: () => Promise.reject(new Error('404')), miesto: { hidden: true } });
  assert.equal(await zly.ukaz({ vysledok: 'A' }), false);
  const hadze = riadicBloku({ nacitaj: () => { throw new Error('sync'); }, miesto: { hidden: true } });
  assert.equal(await hadze.ukaz({ vysledok: 'A' }), false);
});

// ---------------------------------------------------------------- odber FAQ

class Prvok {
  constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.hidden = false; this.disabled = false; this.textContent = ''; this.className = ''; this.parentNode = null; this.zoznam = {}; }
  get firstChild() { return this.children[0] || null; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t, f) { (this.zoznam[t] = this.zoznam[t] || []).push(f); }
  klik() { return Promise.all((this.zoznam.click || []).map((f) => f())); }
  focus() { this.fokus = true; }
}
const falosnyDoc = { createElement: (t) => new Prvok(t) };

test('ponuka FAQ: samostatné tlačidlo, nič predvyplnené, dvojklik pošle raz, po úspechu skryje rámček', async () => {
  const ciel = new Prvok('div');
  ciel.appendChild(new Prvok('p')); // zvyšok z predošlého zobrazenia sa vyčistí
  const d = odlozene();
  let poslane = 0, skryte = 0;
  const { tlacidlo, hotovo, chyba } = ukazPonukuFaq({ doc: falosnyDoc, ciel, posli: () => { poslane += 1; return d.p; }, poUspechu: () => { skryte += 1; } });
  assert.equal(ciel.children.length, 5, 'otázka, tlačidlo, poznámka so zásadami (O1 V3 V6), hotovo, chyba');
  assert.equal(ciel.children[0].textContent, TEXTY_FAQ.otazka);
  assert.equal(tlacidlo.textContent, 'Upozorniť ma aj na FAQ');
  assert.equal(tlacidlo.type, 'button');
  assert.ok(!ciel.children.some((c) => c.tagName === 'input'), 'žiadne zaškrtávacie pole ani predvyplnené pole');
  assert.equal(hotovo.hidden, true);
  const k1 = tlacidlo.klik();
  const k2 = tlacidlo.klik();
  d.ok(true);
  await Promise.all([k1, k2]);
  assert.equal(poslane, 1, 'dvojklik poslal odber dvakrát');
  assert.equal(skryte, 1);
  assert.equal(hotovo.hidden, false);
  assert.equal(hotovo.textContent, 'Hotovo, potvrďte aj tento odber odkazom v e-maile.');
  assert.equal(tlacidlo.hidden, true);
  await tlacidlo.klik();
  assert.equal(poslane, 1, 'po úspechu sa už nič neposiela');
});

test('ponuka FAQ: chyba nechá tlačidlo, rámček neskryje a ďalší pokus pošle znova', async () => {
  const ciel = new Prvok('div');
  let poslane = 0, skryte = 0;
  const odpovede = [() => false, () => Promise.reject(new Error('siet')), () => true];
  const { tlacidlo, hotovo, chyba } = ukazPonukuFaq({ doc: falosnyDoc, ciel, posli: () => odpovede[poslane++](), poUspechu: () => { skryte += 1; } });
  await tlacidlo.klik();
  assert.equal(chyba.hidden, false);
  assert.equal(tlacidlo.disabled, false);
  assert.equal(skryte, 0);
  await tlacidlo.klik();
  assert.equal(chyba.hidden, false, 'výnimka siete je tiež chyba');
  await tlacidlo.klik();
  assert.equal(poslane, 3);
  assert.equal(skryte, 1);
  assert.equal(hotovo.hidden, false);
  assert.equal(chyba.hidden, true);
});

test('odber FAQ ide cez existujúce posli a telo na zdroj efaktura-faq, len na SK stránke s #faq-odber', () => {
  const f = zdrojFunkcie('ponukniFaq');
  assert.ok(f.includes("LANG !== 'sk' || !ramcek || !src || !email"), 'ponuka FAQ nie je obmedzená na SK stránku s rámčekom');
  assert.ok(f.includes('m.posli(m.telo(email, m.ZDROJ))'), 'odber nejde cez posli a telo z odber.js');
  assert.ok(f.includes('ramcek.hidden = true'), 'po úspechu sa #faq-odber neskryje');
  assert.deepEqual(telo(' Jana@Firma.SK ', ZDROJ), { email: 'jana@firma.sk', source: 'efaktura-faq', lang: 'sk', hp: '' });
  // Rovnaká adresa skriptu ako na stránke, aby sa nezapojil druhý modul (dvojité odoslanie formulára).
  const sk = readFileSync(join(TU, 'index.html'), 'utf8');
  const src = (sk.match(/src="(\/efaktura\/zmeny-faq\/odber\.js\?v=[0-9a-f]+)"/) || [])[1];
  assert.ok(src, 'SK stránka nenačítava odber.js');
  const skript = (s) => ({ getAttribute: (k) => (k === 'src' ? s : null) });
  assert.equal(adresaOdberuFaq({ querySelectorAll: () => [skript('/style/vzhlad.js?v=1'), skript(src)] }), src);
  assert.equal(adresaOdberuFaq({ querySelectorAll: () => [skript('https://zle.sk/efaktura/zmeny-faq/odber.js')] }), '');
  assert.equal(adresaOdberuFaq({ querySelectorAll: () => [] }), '');
  for (const j of ['en', 'de', 'cs']) assert.ok(!readFileSync(join(TU, j, 'index.html'), 'utf8').includes('id="faq-odber"'), j + ' má rámček FAQ');
});

// ---------------------------------------------------------------- O1 (oprava po overení V1 až V4)

test('O1 V2 V2: „Zmeniť adresu“ v bloku zavrie ponuku FAQ (bola viazaná na starú adresu) a odber sa už nepošle', async () => {
  const ciel = new Prvok('div');
  const zmenit = new Prvok('button');
  let poslane = 0, zatvorene = 0;
  const { tlacidlo } = ukazPonukuFaq({ doc: falosnyDoc, ciel, posli: () => { poslane += 1; return Promise.resolve(true); }, poUspechu: () => {}, zmenit, poZatvoreni: () => { zatvorene += 1; } });
  assert.equal(ciel.hidden, false);
  await zmenit.klik();
  assert.equal(ciel.hidden, true);
  assert.equal(ciel.children.length, 0, 'ponuka sa vyčistí');
  assert.equal(zatvorene, 1);
  await tlacidlo.klik();
  assert.equal(poslane, 0, 'po zmene adresy odber na starú adresu neodíde');
  // Odpoveď odberu, ktorý bežal počas kliknutia na „Zmeniť adresu“, ponuku znova neukáže.
  const ciel2 = new Prvok('div'), zmenit2 = new Prvok('button');
  const d = odlozene();
  let uspech = 0;
  const p2 = ukazPonukuFaq({ doc: falosnyDoc, ciel: ciel2, posli: () => d.p, poUspechu: () => { uspech += 1; }, zmenit: zmenit2 });
  const k = p2.tlacidlo.klik();
  await zmenit2.klik();
  d.ok(true);
  await k;
  assert.equal(uspech, 0);
  assert.equal(ciel2.hidden, true);
  assert.equal(p2.hotovo.hidden, true);
  // app.js odovzdá tlačidlo bloku.
  const f = zdrojFunkcie('ponukniFaq');
  assert.ok(f.includes("zmenit: document.querySelector('#ef-vysledok-email .vys-zmenit')"), 'app.js neodovzdá „Zmeniť adresu“');
});

test('O1 V3 V6: samostatný súhlas FAQ má pod tlačidlom poznámku a odkaz na zásady (odsek o FAQ)', () => {
  const ciel = new Prvok('div');
  const { tlacidlo, poznamka } = ukazPonukuFaq({ doc: falosnyDoc, ciel, posli: () => true, poUspechu: () => {} });
  const i = ciel.children.indexOf(tlacidlo);
  assert.equal(ciel.children[i + 1], poznamka, 'poznámka priamo pod tlačidlom');
  assert.equal(poznamka.textContent, TEXTY_FAQ.poznamka + ' ');
  const a = poznamka.children[0];
  assert.equal(a.tagName, 'a');
  assert.equal(a.getAttribute('href'), '/privacy/#s3');
  assert.equal(a.textContent, 'Ochrana údajov');
  assert.ok(readFileSync(join(TU, '..', 'privacy', 'index.html'), 'utf8').includes('id="s3"'), 'kotva #s3 v zásadách');
});

test('O1 V3 D8: kým je ukázaná nová ponuka FAQ, starý rámik #faq-odber je skrytý (nie vybratý) a po zatvorení sa vráti', () => {
  const f = zdrojFunkcie('ponukniFaq');
  assert.ok(f.indexOf('ramcek.hidden = true;') < f.indexOf('ukazPonukuFaq('), 'rámik sa neskryje pred ponukou');
  assert.ok(f.includes('ramcek.hidden = ramcekPredtym'), 'rámik sa po zatvorení nevráti');
  assert.ok(zdrojFunkcie('zavriPonukuFaq').includes('r.vratRamcek()'));
  assert.ok(zdrojFunkcie('skryBlokEmailu').includes('zavriPonukuFaq(blokEmailu)'));
});

test('O1 V2 D2: zlyhaný import modulu sa nezapamätá, ďalší výsledok blok ukáže; úspešný sa načíta raz', async () => {
  const m = falosnyModul();
  let pokusy = 0;
  const nacitaj = nacitavacModulu(() => { pokusy += 1; return pokusy === 1 ? Promise.reject(new Error('siet')) : Promise.resolve(m); });
  const miesto = { hidden: true };
  const r = riadicBloku({ nacitaj, miesto });
  assert.equal(await r.ukaz({ vysledok: 'A' }), false);
  assert.equal(await r.ukaz({ vysledok: 'B' }), true);
  assert.equal(await r.ukaz({ vysledok: 'C' }), true);
  assert.equal(pokusy, 2, 'po úspechu sa modul už nenačíta znova');
  assert.deepEqual(m.zaznam.filter((x) => x[0] === 'ukaz').map((x) => x[1].vysledok), ['B', 'C']);
  const hadze = nacitavacModulu(() => { throw new Error('sync'); });
  await assert.rejects(hadze());
  assert.ok(APP.includes('const nacitajModulBloku = nacitavacModulu(() => import(MODUL_BLOKU));'));
  assert.ok(zdrojFunkcie('riadicEmailu').includes('nacitaj: nacitajModulBloku'));
});

test('O1 V2 D1: modul bloku sa začne načítavať pri vstupe (nie až pod výsledkom), nie pod vzorom', () => {
  const f = zdrojFunkcie('prijmiText');
  const i = f.indexOf('nacitajModulBloku()');
  assert.ok(i > 0, 'prijmiText modul vopred nenačíta');
  assert.ok(i < f.indexOf('spustiKontrolu()'), 'načítanie až po kontrole');
  assert.ok(f.slice(f.lastIndexOf('\n', i), i).includes('!vstupJeUkazka'), 'načíta sa aj pod vzorom');
});

test('K1-1 (O2): modul bloku sa začne načítavať pri prvej práci so vstupom (ťuk, fokus, kláves, vloženie, pretiahnutie), raz, nie pri vzore', () => {
  // Falošný document so zachytávajúcimi poslucháčmi; cieľ udalosti pozná len selektory svojej cesty (closest).
  const pripravDoc = () => {
    const posluchaci = {};
    const doc = {
      addEventListener: (u, f, c) => { assert.equal(c, true, 'zachytávanie (iný poslucháč ho nezastaví)'); (posluchaci[u] ||= []).push(f); },
      removeEventListener: (u, f) => { posluchaci[u] = (posluchaci[u] || []).filter((x) => x !== f); },
    };
    const vyvolaj = (type, cesta) => { const target = cesta ? { closest: (sel) => (sel.split(',').some((s) => cesta.includes(s.trim())) ? {} : null) } : null; for (const f of [...(posluchaci[type] || [])]) f({ type, target }); };
    return { doc, posluchaci, vyvolaj };
  };
  const NASTAV = { ciel: '#vstup, #hero-subor, #hero-citat', vynechaj: '#vzor, #hero-vzor' };
  const { doc, posluchaci, vyvolaj } = pripravDoc();
  let volania = 0;
  nacitajPriVstupe({ doc, ...NASTAV, nacitaj: () => { volania += 1; return Promise.reject(new Error('výpadok siete')); } });
  assert.deepEqual(Object.keys(posluchaci).sort(), [...UDALOSTI_VSTUPU].sort());
  vyvolaj('pointerdown', ['#vzor', '#vstup']);
  vyvolaj('focusin', ['#hero-vzor']);
  vyvolaj('keydown', ['#cennik']);
  vyvolaj('input', ['#formular']);
  assert.equal(volania, 0, 'vzor ani iná časť stránky modul nenačíta');
  vyvolaj('focusin', ['#xml', '#vstup']);
  assert.equal(volania, 1, 'fokus do poľa XML načíta modul');
  vyvolaj('input', ['#xml', '#vstup']); vyvolaj('pointerdown', ['#spustit', '#vstup']); vyvolaj('dragenter', null);
  assert.equal(volania, 1, 'najviac raz');
  assert.ok(UDALOSTI_VSTUPU.every((u) => (posluchaci[u] || []).length === 0), 'po načítaní sa poslucháči odpoja');
  // Každý spôsob vstupu sám osebe: ťuk na dropzone, kláves, vloženie, tlačidlo v hero, pretiahnutie súboru nad stránku.
  for (const [typ, cesta] of [['pointerdown', ['#dropzone', '#vstup']], ['keydown', ['#dropzone', '#vstup']], ['paste', ['#xml', '#vstup']], ['pointerdown', ['#hero-subor']], ['dragenter', null]]) {
    const d = pripravDoc();
    let n = 0;
    nacitajPriVstupe({ doc: d.doc, ...NASTAV, nacitaj: () => { n += 1; return null; } });
    d.vyvolaj(typ, cesta);
    assert.equal(n, 1, typ + ' ' + JSON.stringify(cesta));
  }
  // Chyba načítania nesmie zhodiť stránku; bez document alebo funkcie nič.
  const d2 = pripravDoc();
  nacitajPriVstupe({ doc: d2.doc, ...NASTAV, nacitaj: () => { throw new Error('x'); } });
  assert.doesNotThrow(() => d2.vyvolaj('focusin', ['#xml', '#vstup']));
  assert.equal(typeof nacitajPriVstupe({ doc: null, ...NASTAV, nacitaj: () => null }), 'function');
  // app.js: zapojené na celý vstup a tlačidlá hero, mimo vzoru, len keď CSP pustí odoslanie.
  const i = APP.indexOf('nacitajPriVstupe({');
  assert.ok(i > APP.indexOf('const nacitajModulBloku = '), 'app.js nezapojí predčasné načítanie');
  const volanie = APP.slice(i, APP.indexOf('});', i));
  assert.ok(volanie.includes("ciel: '#vstup, #hero-subor, #hero-citat'") && volanie.includes("vynechaj: '#vzor, #hero-vzor'"), volanie);
  assert.ok(/cspPovoluje\(cspStranky\(document\)\) \? nacitajModulBloku\(\)/.test(volanie), volanie);
});

test('O1 V1 N1 / V3 V3: BR-DE-23-a ide stránkou, jadrom hubu aj workerom v oficiálnom zápise a e-mail má normatívne znenie', async () => {
  const jadro = await import('../vysledok/vysledok-jadro.mjs');
  const { cisteZhrnutie } = await import('../../feed-doctor/monitor/src/vysledok.mjs');
  const { vysledokEmail } = await import('../../feed-doctor/monitor/src/vysledok-mail.mjs');
  const v = { profil: 'xrechnung', typ: 'Invoice', sumar: { chyby: 1, varovania: 0, informacie: 0 }, nalezy: [{ kod: 'BR-DE-23-a', zavaznost: 'chyba' }] };
  const z = jadro.zhrnutie('efaktura', zhrnutieVysledku(v));
  assert.deepEqual(z.pravidla, [{ kod: 'BR-DE-23-a', zavaznost: 'chyba', pocet: 1 }]);
  const w = cisteZhrnutie('efaktura', z);
  const m = vysledokEmail({ nastroj: 'efaktura', jazyk: 'de', data: w, vytvorene: '2026-10-23T06:00:00Z' });
  assert.ok(m.text.includes('BR-DE-23-a: Fehler, 1 Vorkommen\nWortlaut der Regel: [BR-DE-23-a]'), m.text);
  assert.ok(!m.text.includes('BR-DE-23-A'));
});
