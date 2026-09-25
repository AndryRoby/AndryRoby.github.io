/* Testy vzorovych faktur pre tlacidlo Nacitat vzor / Načíst vzor / Beispiel laden / Load sample.
 *
 * Preco existuje: 25. 9. 2026 Andrej napisal, ze "Beispiel laden" nacita vo vsetkych jazykoch
 * slovensku fakturu. V app.js platilo const VZOR = LANG === 'en' ? VZOR_XML_EN : VZOR_XML,
 * takze ceska aj nemecka stranka dostali Vzorovu dielnu z Banskej Bystrice. Odvtedy ma kazdy
 * jazyk svoj vzor: sk (Peppol, 23 %), cs (Peppol, CZK, 21 %), de (XRechnung 3.0, 19 %,
 * Leitweg-ID) a en (Peppol, prenesenie danovej povinnosti).
 *
 * Kazdy vzor sa berie priamo z app.js (rovnako ako tests.mjs taha VZOR_XML_EN) a prechadza
 * tou istou kontrolou, akou ho prezenie stranka (pravidla.mjs), tym istym prenosom do formulara
 * (z-ubl.mjs) a tym istym generatorom (ubl.js). Kontroluje sa aj staticky obrazok prikladu
 * vedla nastroja na ceskej a nemeckych strankach: musi ukazovat presne to, co kontrola
 * naozaj povie o vzore s dvoma chybami. Rovnako kroky 1 a 3 sekcie postupu (vyrez XML a
 * vykresleny doklad) musia byt z vzoru stranky, nie zo slovenskeho, a stiahnuty protokol
 * musi mat nazov profilu v jazyku stranky (pravidla.mjs pise pri XRechnung "Nemecko").
 * usage: node --test products/arling-sk/efaktura/vzory.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { skontroluj, IMPLEMENTOVANE, platnyIban, protokol } from './pravidla.mjs';
import { zUbl } from './z-ubl.mjs';
import { vytvorUbl } from './ubl.js';
import { parsujXml, hod } from './parser.mjs';
import { skontrolujLeitweg } from './leitweg-kontrola.mjs';

const APP = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const JAZYKY = ['sk', 'cs', 'de', 'en'];
const MENO_KONSTANTY = { sk: 'VZOR_XML', cs: 'VZOR_XML_CS', de: 'VZOR_XML_DE', en: 'VZOR_XML_EN' };
const PROFIL = { sk: 'peppol', cs: 'peppol', de: 'xrechnung', en: 'peppol' };

const kody = (v, zavaznost) => v.nalezy.filter((n) => n.zavaznost === zavaznost).map((n) => n.kod).sort();
const vypis = (v) => v.nalezy.map((n) => n.zavaznost + ' ' + n.kod + ': ' + n.sprava.sk).join(' | ');

/** XML zapisane natvrdo v app.js, presne ako ho nacita tlacidlo vzoru. */
function vzorZApp(meno) {
  const zac = APP.indexOf('const ' + meno + ' = `');
  assert.ok(zac > 0, 'app.js: ' + meno + ' sa nenasiel');
  return APP.slice(APP.indexOf('<?xml', zac), APP.indexOf('\n`;', zac) + 1);
}

/** Funkcia vzorSChybami z app.js, bez kopirovania jej tela do testu. */
const vzorSChybami = (() => {
  const zac = APP.indexOf('function vzorSChybami(x)');
  assert.ok(zac > 0, 'app.js: funkcia vzorSChybami sa nenasla');
  const kon = APP.indexOf('\n}\n', zac) + 2;
  return new Function('return ' + APP.slice(zac, kon))();
})();

/** Objekt z app.js v tvare const MENO = {...}[LANG] (podlaJazyka) alebo const MENO = {...};
 * vrati cely objekt pre vsetky jazyky. Objekt sa konci riadkom, ktory zacina znakom }. */
function objektZApp(meno, podlaJazyka) {
  const zac = APP.indexOf('const ' + meno + ' = {');
  assert.ok(zac > 0, 'app.js: ' + meno + ' sa nenasiel');
  const koniec = APP.indexOf(podlaJazyka ? '\n}[LANG]' : '\n};', zac);
  assert.ok(koniec > zac, 'app.js: koniec ' + meno + ' sa nenasiel');
  return new Function('return ' + APP.slice(zac + ('const ' + meno + ' = ').length, koniec + 2))();
}

// rovnaky vypocet ako POCET_PRAVIDIEL v app.js
const PRED_PROFILOM = ['XML-01', 'XML-02', 'CII-01'];
const jePeppol = (k) => k.indexOf('PEPPOL-') === 0;
const jeNemecky = (k) => /^BR-DE-|^BR-DEX-|^BR-TMP-/.test(k);
const JADRO = IMPLEMENTOVANE.filter((k) => !jePeppol(k) && !jeNemecky(k) && PRED_PROFILOM.indexOf(k) === -1).length;
const pocetPravidiel = (p) => JADRO + (p === 'peppol' ? IMPLEMENTOVANE.filter(jePeppol).length : 0) + (p === 'xrechnung' ? IMPLEMENTOVANE.filter(jeNemecky).length : 0);

// ---------------------------------------------------------------- vyber vzoru podla jazyka

test('kazdy jazyk ma vlastny vzor a vlastny nazov suboru', () => {
  const riadok = /const VZORY = \{([^}]*)\};/.exec(APP);
  assert.ok(riadok, 'app.js: const VZORY sa nenasiel');
  const mapa = Object.fromEntries(riadok[1].split(',').map((c) => c.split(':').map((s) => s.trim())));
  for (const j of JAZYKY) assert.equal(mapa[j], MENO_KONSTANTY[j], 'jazyk ' + j + ' nacita ' + mapa[j]);
  assert.match(APP, /const VZOR = VZORY\[LANG\] \|\| VZOR_XML;/);
  assert.ok(!/const VZOR = LANG === 'en' \? VZOR_XML_EN : VZOR_XML/.test(APP), 'stary vyber vzoru (len en a sk) je spat');

  const mena = objektZApp('MENA_VZORU', true);
  assert.deepEqual(mena.sk[0], 'vzor-efaktura.xml');
  assert.deepEqual(mena.cs[0], 'vzorova-faktura.xml');
  assert.deepEqual(mena.de[0], 'beispielrechnung.xml');
  assert.deepEqual(mena.en[0], 'sample-e-invoice.xml');
  for (const j of JAZYKY) assert.ok(mena[j][1] && mena[j][1].endsWith('.xml') && mena[j][1] !== mena[j][0], 'vzor s chybami pre ' + j);
  // nacitajVzor berie meno z tejto tabulky, nie natvrdo
  assert.match(APP, /const meno = sChybami && VZOR_CHYBY \? MENA_VZORU\[1\] : MENA_VZORU\[0\];/);

  // styri rozne vzory
  const xml = JAZYKY.map((j) => vzorZApp(MENO_KONSTANTY[j]));
  assert.equal(new Set(xml).size, 4, 'niektore jazyky maju rovnaky vzor');
});

test('vzory su v jazyku stranky, nie po slovensky', () => {
  const de = vzorZApp('VZOR_XML_DE');
  const cs = vzorZApp('VZOR_XML_CS');
  assert.ok(de.includes('<cbc:Note>Musterrechnung von arling.sk/efaktura/de/. Alle Daten sind erfunden.</cbc:Note>'));
  assert.ok(cs.includes('<cbc:Note>Vzorová faktura z arling.sk/efaktura/cs/. Údaje jsou vymyšlené.</cbc:Note>'));
  for (const [j, x] of [['de', de], ['cs', cs]]) {
    for (const sk of ['Vzorová dielna', 'Banská Bystrica', 'Košice', 'Údaje sú vymyslené', 'Splatnosť', 'SK3112000000198742637541', 'schemeID="0245"', '<cbc:IdentificationCode>SK</cbc:IdentificationCode>']) {
      assert.ok(!x.includes(sk), j + ' vzor obsahuje slovensky udaj: ' + sk);
    }
  }
  assert.ok(de.includes('<cbc:Note>Zahlbar innerhalb von 14 Tagen ohne Abzug.</cbc:Note>'), 'nemecke platobne podmienky');
  assert.ok(cs.includes('<cbc:Note>Splatnost 14 dní od data vystavení.</cbc:Note>'), 'ceske platobne podmienky');
  // texty vzoru bez pomlciek (em dash, en dash)
  const POMLCKA = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
  for (const j of JAZYKY) assert.ok(!POMLCKA.test(vzorZApp(MENO_KONSTANTY[j])), j + ' vzor ma pomlcku');
});

// ---------------------------------------------------------------- cisty vzor

for (const j of JAZYKY) {
  test('cisty vzor ' + j + ': 0 chyb, 0 varovani, spravny profil', () => {
    const xml = vzorZApp(MENO_KONSTANTY[j]);
    const v = skontroluj(xml);
    assert.equal(v.typ, 'Invoice');
    assert.equal(v.profil, PROFIL[j], 'profil ' + v.profil);
    assert.equal(v.sumar.chyby, 0, vypis(v));
    assert.equal(v.sumar.varovania, 0, vypis(v));
    assert.equal(v.sumar.informacie, 0, vypis(v));
    // IBAN plati (mod 97), inak by verzia s chybami nemala presne jednu chybu v IBAN
    const d = parsujXml(xml).koren;
    assert.equal(platnyIban(hod(d, 'cac:PaymentMeans/cac:PayeeFinancialAccount/cbc:ID')), true);
  });
}

test('nemecky vzor je XRechnung 3.0 pre verejneho odberatela s Leitweg-ID', () => {
  const xml = vzorZApp('VZOR_XML_DE');
  const d = parsujXml(xml).koren;
  assert.equal(hod(d, 'cbc:CustomizationID'), 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0');
  assert.equal(hod(d, 'cbc:BuyerReference'), '991-33333TEST-33');
  assert.equal(skontrolujLeitweg(hod(d, 'cbc:BuyerReference')).ok, true, 'Leitweg-ID ma zlu kontrolnu cislicu');
  assert.ok(xml.includes('<cbc:EndpointID schemeID="0204">991-33333TEST-33</cbc:EndpointID>'), 'odberatel ma Leitweg-ID ako elektronicku adresu');
  assert.ok(xml.includes('<cbc:EndpointID schemeID="9930">DE123456789</cbc:EndpointID>'), 'dodavatel ma USt-IdNr. ako elektronicku adresu');
  assert.equal(hod(d, 'cac:PaymentMeans/cbc:PaymentMeansCode'), '58');
  assert.equal(hod(d, 'cbc:DocumentCurrencyCode'), 'EUR');
  assert.equal(hod(d, 'cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:ID'), 'S');
  assert.equal(hod(d, 'cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:Percent'), '19.00');
  assert.equal(hod(d, 'cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount'), '450.00');
  // kontakt dodavatela (BR-DE-2, BR-DE-5 az BR-DE-7)
  for (const p of ['cbc:Name', 'cbc:Telephone', 'cbc:ElectronicMail']) {
    assert.notEqual(hod(d, 'cac:AccountingSupplierParty/cac:Party/cac:Contact/' + p), '', 'kontakt dodavatela: ' + p);
  }
  // XRechnung vynutena aj rucne: pravidla BR-DE-* nesmu nic hlasit
  const v = skontroluj(xml, { profil: 'xrechnung' });
  assert.deepEqual(v.nalezy.map((n) => n.kod), []);
});

test('cesky vzor je Peppol v korunach so sadzbou 21 %', () => {
  const xml = vzorZApp('VZOR_XML_CS');
  const d = parsujXml(xml).koren;
  assert.equal(hod(d, 'cbc:CustomizationID'), 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0');
  assert.equal(hod(d, 'cbc:DocumentCurrencyCode'), 'CZK');
  assert.equal(hod(d, 'cac:AccountingSupplierParty/cac:Party/cac:PostalAddress/cac:Country/cbc:IdentificationCode'), 'CZ');
  assert.equal(hod(d, 'cac:AccountingCustomerParty/cac:Party/cac:PostalAddress/cac:Country/cbc:IdentificationCode'), 'CZ');
  assert.equal(hod(d, 'cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:Percent'), '21.00');
  assert.ok(hod(d, 'cac:PaymentMeans/cac:PayeeFinancialAccount/cbc:ID').startsWith('CZ'));
  // vsetky sumy su v mene dokladu
  assert.ok(!/currencyID="(?!CZK")/.test(xml), 'suma v inej mene nez CZK');
});

// ---------------------------------------------------------------- vzor s chybami

for (const j of JAZYKY) {
  test('vzor s chybami ' + j + ': presne 2 chyby, BR-CO-15 a ARL-IBAN', () => {
    const cisty = vzorZApp(MENO_KONSTANTY[j]);
    const xml = vzorSChybami(cisty);
    assert.ok(xml, 'vzorSChybami vratila null, nenasla sumy alebo IBAN');
    assert.notEqual(xml, cisty);
    const v = skontroluj(xml);
    assert.equal(v.profil, PROFIL[j]);
    assert.deepEqual(kody(v, 'chyba'), ['ARL-IBAN', 'BR-CO-15'], vypis(v));
    // Pri SEPA prevode v XRechnung hlasi zly IBAN aj BR-DE-19, ale len ako varovanie.
    assert.deepEqual(kody(v, 'varovanie'), j === 'de' ? ['BR-DE-19'] : [], vypis(v));
    assert.deepEqual(kody(v, 'informacia'), [], vypis(v));
  });
}

// ---------------------------------------------------------------- prenos do formulara

for (const j of JAZYKY) {
  test('prenos do formulara ' + j + ': nic sa nestrati, nic sa nezmeni, nove XML prejde kontrolou', () => {
    const xml = vzorZApp(MENO_KONSTANTY[j]);
    const z = zUbl(xml, { jazyk: j });
    assert.equal(z.ok, true, z.chyba && z.chyba.sk);
    assert.deepEqual(z.neprenesene, [], j + ': ' + JSON.stringify(z.neprenesene));
    assert.deepEqual(z.rozdiely, [], j + ': ' + JSON.stringify(z.rozdiely));
    assert.equal(z.faktura.profil, PROFIL[j]);
    assert.equal(z.faktura.cislo, '2026-0142');
    assert.equal(z.faktura.polozky.length, 2);
    const nove = vytvorUbl(z.faktura, { profil: z.faktura.profil || 'peppol', jazyk: j });
    const v = skontroluj(nove);
    assert.equal(v.profil, PROFIL[j]);
    assert.equal(v.sumar.chyby, 0, vypis(v));
    assert.equal(v.sumar.varovania, 0, vypis(v));
  });
}

test('prenos nemeckeho a ceskeho vzoru nesie udaje v jazyku stranky', () => {
  const de = zUbl(vzorZApp('VZOR_XML_DE'), { jazyk: 'de' }).faktura;
  assert.equal(de.dodavatel.nazov, 'Musterwerkstatt GmbH');
  assert.equal(de.dodavatel.krajina, 'DE');
  assert.equal(de.referenciaOdberatela, '991-33333TEST-33');
  assert.equal(de.odberatel.endpointSchema, '0204');
  assert.equal(de.polozky[0].sadzba, 19);
  assert.equal(de.platobnePodmienky, 'Zahlbar innerhalb von 14 Tagen ohne Abzug.');
  const cs = zUbl(vzorZApp('VZOR_XML_CS'), { jazyk: 'cs' }).faktura;
  assert.equal(cs.dodavatel.nazov, 'Vzorová dílna s.r.o.');
  assert.equal(cs.mena, 'CZK');
  assert.equal(cs.polozky[0].sadzba, 21);
  assert.equal(cs.platobnePodmienky, 'Splatnost 14 dní od data vystavení.');
});

test('vzor s chybami sa prenesie aj s chybou v IBAN a so sumou, ktoru formular prepocita', () => {
  for (const j of ['cs', 'de']) {
    const xml = vzorSChybami(vzorZApp(MENO_KONSTANTY[j]));
    const z = zUbl(xml, { jazyk: j });
    assert.equal(z.ok, true);
    assert.deepEqual(z.neprenesene, []);
    assert.deepEqual(z.rozdiely.map((r) => r.kod).sort(), ['cac:LegalMonetaryTotal/cbc:PayableAmount', 'cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount']);
    const po = skontroluj(vytvorUbl(z.faktura, { profil: z.faktura.profil, jazyk: j }));
    assert.deepEqual(kody(po, 'chyba'), ['ARL-IBAN'], 'po prenose ostane len chyba v IBAN: ' + vypis(po));
  }
});

// ---------------------------------------------------------------- staticky obrazok prikladu

/* Ramik "Beispiel" / "Ukázka" vedla nastroja kresli vysledok kontroly vzoru s chybami.
 * Veta, hodnota a pocty v nom musia byt presne tie, ktore kontrola naozaj vrati. */
const STRANKY = {
  de: ['de/index.html', 'de/csv-xrechnung/index.html', 'de/e-rechnung-freiberufler/index.html', 'de/xrechnung-erstellen/index.html', 'de/xrechnung-validator/index.html'],
  cs: ['cs/index.html'],
};
const T_ALL = (() => {
  const tvar3 = (n, jeden, malo, vela) => (n === 1 ? jeden : n >= 2 && n <= 4 ? malo : vela);
  const tvar2 = (n, jeden, viac) => (n === 1 ? jeden : viac);
  const zac = APP.indexOf('const T = {');
  const kon = APP.indexOf('}[LANG];', zac);
  return new Function('tvar2', 'tvar3', 'return ' + APP.slice(zac + 'const T = '.length, kon + 1))(tvar2, tvar3);
})();
const NAZOV_PROFILU = objektZApp('NAZOV_PROFILU');

for (const j of ['de', 'cs']) {
  for (const cesta of STRANKY[j]) {
    test('obrazok prikladu na ' + cesta + ' sedi s kontrolou vzoru s chybami', () => {
      const html = readFileSync(new URL('./' + cesta, import.meta.url), 'utf8');
      const zac = html.indexOf('<div class="ef-ukazka"');
      assert.ok(zac > 0, 'ramik ef-ukazka sa nenasiel');
      const ukazka = html.slice(zac, html.indexOf('<div id="sumar">', zac));
      const v = skontroluj(vzorSChybami(vzorZApp(MENO_KONSTANTY[j])));
      const T = T_ALL[j];
      const s = v.sumar;
      const profil = (NAZOV_PROFILU[j] || {})[v.profil] || v.profilNazov;
      assert.ok(ukazka.includes('<p class="sumar-stav je-chyba">' + T.maChyby(s.chyby) + '</p>'), 'veta o poctu chyb');
      assert.ok(ukazka.includes('<p class="sumar-meta"><span>' + T.sumarProfil + ': ' + profil + '</span><span>' + T.sumarTyp + ': ' + v.typ + '</span><span>'
        + s.chyby + ' ' + T.sumarChyby(s.chyby) + '</span><span>' + s.varovania + ' ' + T.sumarVarovania(s.varovania) + '</span><span>'
        + s.informacie + ' ' + T.sumarInformacie(s.informacie) + '</span></p>'), 'riadok s profilom a poctami');
      assert.ok(ukazka.includes('<p class="sumar-meta sumar-pravidla">' + T.sumarPravidla(pocetPravidiel(v.profil)) + '</p>'), 'pocet pravidiel');
      for (const n of v.nalezy) {
        assert.ok(ukazka.includes('<span class="nalez-znacka">' + T.zavaznost[n.zavaznost] + '</span><code class="nalez-kod">' + n.kod + '</code>'), 'nalez ' + n.kod);
        assert.ok(ukazka.includes('<p class="nalez-veta">' + n.sprava[j] + '</p>'), 'veta nalezu ' + n.kod);
        assert.ok(ukazka.includes('<code>' + n.hodnota + '</code>'), 'hodnota nalezu ' + n.kod);
      }
      assert.equal((ukazka.match(/<article class="nalez /g) || []).length, v.nalezy.length, 'pocet nalezov v obrazku');
      // v obrazku ani vo vyreze nalezu nesmie ostat slovensky vzor
      assert.ok(!html.includes('553.5') && !html.includes('SK3112000000198742637542'), 'na stranke ostala suma alebo IBAN zo slovenskeho vzoru');
    });
  }
}

// ---------------------------------------------------------------- kroky 1 a 3 sekcie postupu

/* Krok 1 ukazuje vyrez XML vzoru (znacky tucne, hodnoty kurzivou), krok 3 vykresleny doklad
 * z nahlad.js. Do 25. 9. to bol na nemeckych a ceskej stranke slovensky vzor (Vzorova dielna,
 * Banska Bystrica, 23 %), hoci tlacidlo vzoru uz nacitalo nemecky alebo cesky. */
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const SLOVENSKY_VZOR = ['Vzorová dielna', 'Údaje sú vymyslené', 'Banská Bystrica', 'Krivánska', 'Košice', 'Odberateľ',
  'SK2120000001', 'SK2130000002', '(0245)', '23.00 %', 'Servis obrábacieho', 'Náhradné ložiská', 'vzorovadielna.sk'];

for (const j of ['de', 'cs']) {
  for (const cesta of STRANKY[j]) {
    test('kroky 1 a 3 na ' + cesta + ' ukazuju vzor stranky, nie slovensky', () => {
      const html = readFileSync(new URL('./' + cesta, import.meta.url), 'utf8');
      const zac = html.indexOf('<ol class="ef-kroky">');
      assert.ok(zac > 0, 'sekcia ef-kroky sa nenasla');
      const kroky = html.slice(zac, html.indexOf('</ol>', zac));
      const k1 = kroky.slice(kroky.indexOf('ef-k1'), kroky.indexOf('ef-k2'));
      const k3 = kroky.slice(kroky.indexOf('ef-k3'));
      assert.ok(k1.includes('<pre class="ef-xml"') && k3.includes('<div class="efa-doklad">'), 'krok 1 alebo 3 nema obrazok');

      const xml = vzorZApp(MENO_KONSTANTY[j]);
      const d = parsujXml(xml).koren;
      for (const p of ['cbc:CustomizationID', 'cbc:Note', 'cbc:DocumentCurrencyCode', 'cbc:BuyerReference']) {
        assert.ok(k1.includes('<i>' + esc(hod(d, p)) + '</i>'), 'krok 1: chyba ' + p + ' zo vzoru stranky');
      }
      const strana = (s) => hod(d, s + '/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName');
      assert.ok(k3.includes('<p class="efa-nazov">' + esc(strana('cac:AccountingSupplierParty')) + '</p>'), 'krok 3: dodavatel');
      assert.ok(k3.includes('<p class="efa-nazov">' + esc(strana('cac:AccountingCustomerParty')) + '</p>'), 'krok 3: odberatel');
      assert.ok(k3.includes('<span class="efa-hodnota">' + esc(hod(d, 'cbc:BuyerReference')) + '</span>'), 'krok 3: referencia odberatela');
      const polozky = [...xml.matchAll(/<cac:InvoiceLine>[\s\S]*?<cac:Item>[\s\S]*?<cbc:Name>([^<]*)<\/cbc:Name>/g)].map((m) => m[1]);
      assert.equal(polozky.length, 2);
      for (const n of polozky) assert.ok(k3.includes('<td>' + esc(n) + '</td>'), 'krok 3: polozka ' + n);
      const sadzba = hod(d, 'cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:Percent');
      assert.equal((k3.match(new RegExp('<td>' + sadzba.replace('.', '\\.') + ' % S</td>', 'g')) || []).length, 2, 'krok 3: sadzba ' + sadzba);
      const mena = hod(d, 'cbc:DocumentCurrencyCode');
      assert.ok(!new RegExp(' (?!' + mena + '<)[A-Z]{3}</td>').test(k3), 'krok 3: suma v inej mene nez ' + mena);

      for (const sk of SLOVENSKY_VZOR) assert.ok(!html.includes(sk), cesta + ' obsahuje slovensky vzor: ' + sk);
      // nemecky vzor ma v BuyerReference Leitweg-ID; OBJ-2026-77 je referencia slovenskeho (a ceskeho) vzoru
      if (j === 'de') assert.ok(!html.includes('OBJ-2026-77'), cesta + ' obsahuje referenciu slovenskeho vzoru');
    });
  }
}

// ---------------------------------------------------------------- protokol na stiahnutie

/* Funkcia protokolStranky z app.js pre dany jazyk stranky, bez kopirovania jej tela do testu.
 * nazovProfilu sa berie tiez z app.js, NAZOV_PROFILU je objekt z app.js vytiahnuty vyssie. */
function protokolPreJazyk(lang) {
  const zacN = APP.indexOf('const nazovProfilu = ');
  assert.ok(zacN > 0, 'app.js: nazovProfilu sa nenasiel');
  const nazov = APP.slice(zacN + 'const nazovProfilu = '.length, APP.indexOf(';\n', zacN));
  const zacP = APP.indexOf('function protokolStranky(v)');
  assert.ok(zacP > 0, 'app.js: funkcia protokolStranky sa nenasla');
  const telo = APP.slice(zacP, APP.indexOf('\n}\n', zacP) + 2);
  return new Function('protokol', 'NAZOV_PROFILU', 'LANG', 'nazovSuboru',
    'const nazovProfilu = ' + nazov + ';\nreturn ' + telo)(protokol, NAZOV_PROFILU, lang, 'vzor.xml');
}
const riadokProfilu = (text) => text.split('\n').find((r) => /^Profile?: /.test(r));

test('protokol na stiahnutie ma nazov profilu v jazyku stranky', () => {
  // obe tlacidla (Stiahnut protokol, Kopirovat) idu cez protokolStranky, nie priamo cez protokol()
  assert.ok(!/protokol\(poslednyVysledok/.test(APP), 'tlacidlo vola protokol() bez prelozeneho nazvu profilu');
  assert.equal((APP.match(/protokolStranky\(poslednyVysledok\)/g) || []).length, 2, 'Stiahnut aj Kopirovat');

  const de = skontroluj(vzorZApp('VZOR_XML_DE'));
  const pDe = protokolPreJazyk('de')(de);
  assert.equal(riadokProfilu(pDe), 'Profil: XRechnung 3.x (Deutschland)');
  assert.ok(!pDe.includes('Nemecko'), 'nemecky protokol obsahuje slovenske Nemecko');
  assert.ok(pDe.startsWith('Prüfprotokoll E-Rechnung\nvzor.xml\n'), 'hlavicka a nazov suboru');
  assert.equal(riadokProfilu(protokolPreJazyk('cs')(de)), 'Profil: XRechnung 3.x (Německo)');
  assert.equal(riadokProfilu(protokolPreJazyk('en')(de)), 'Profile: XRechnung 3.x (Germany)');
  assert.equal(riadokProfilu(protokolPreJazyk('sk')(de)), 'Profil: XRechnung 3.x (Nemecko)');
  // Peppol je vlastne meno a ostava v kazdom jazyku
  assert.equal(riadokProfilu(protokolPreJazyk('cs')(skontroluj(vzorZApp('VZOR_XML_CS')))), 'Profil: Peppol BIS Billing 3.0');
  // vysledok kontroly sa nemeni, preklad je len v kopii pre protokol
  assert.equal(de.profilNazov, 'XRechnung 3.x (Nemecko)');
  // nalezy s chybami idu do protokolu po nemecky
  const sChybami = protokolPreJazyk('de')(skontroluj(vzorSChybami(vzorZApp('VZOR_XML_DE'))));
  assert.ok(sChybami.includes('Fehler: 2, Warnungen: 1, Hinweise: 0'), sChybami);
  assert.ok(sChybami.includes('[FEHLER] BR-CO-15') && sChybami.includes('[FEHLER] ARL-IBAN') && sChybami.includes('[WARNUNG] BR-DE-19'));
});
