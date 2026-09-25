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
 * vykresleny doklad) musia byt znak po znaku to, co z vzoru stranky vyrobi generator nizsie
 * (krok 1: prvych 12 riadkov XML, krok 3: nahlad.js), a to na kazdej stranke s postupom
 * vo vsetkych styroch jazykoch. Stiahnuty protokol musi mat nazov profilu a nazov suboru
 * v jazyku stranky (pravidla.mjs pisal pri XRechnung vsade "Nemecko").
 * usage: node --test products/arling-sk/efaktura/vzory.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { skontroluj, IMPLEMENTOVANE, platnyIban, protokol, nazovProfilu, NAZVY_PROFILOV_JAZYK } from './pravidla.mjs';
import { zUbl } from './z-ubl.mjs';
import { vytvorUbl } from './ubl.js';
import { parsujXml, hod } from './parser.mjs';
import { vykresliNahlad } from './nahlad.js';
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
      const profil = nazovProfilu(v, j);
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

/* Presne porovnanie. Kontrola poli vyssie da citatelnu hlasku, ale neodhali napriklad iny
 * datum, inu cenu, slovensky popis "Splatnost" alebo chybajuci riadok XML. Preto sa kroky 1
 * a 3 na kazdej stranke s postupom porovnavaju znak po znaku s tym, co z vzoru stranky vyrobi
 * ten isty generator, ktorym obrazky vznikli:
 *   krok 1: prvych 12 riadkov XML bez <?xml, znacky tucne (<b>), hodnoty kurzivou (<i>);
 *   krok 3: nahlad.js v malom DOM, z dokladu len hlavicka, strany a polozky. Obrazok je
 *   aria-hidden, preto nesmie pridavat nadpisy ani oblasti: header, section a article su div,
 *   h2 a h3 su p s triedou efa-t2 a efa-t3.
 * Typograficky skript meni na strankach niektore medzery na nezlomitelne (U+00A0, napriklad
 * v telefonnych cislach), porovnava sa preto po ich nahradeni obycajnou medzerou. */
function obrazokKroku1(xml) {
  const riadky = xml.split('\n').filter((r) => !r.startsWith('<?xml')).slice(0, 12);
  const telo = riadky.map((r) => {
    const par = /^(\s*)<([^>]+)>([^<]*)<\/([^>]+)>$/.exec(r);
    if (par) return par[1] + '<b>&lt;' + esc(par[2]) + '&gt;</b><i>' + esc(par[3]) + '</i><b>&lt;/' + esc(par[4]) + '&gt;</b>';
    const otv = /^(\s*)<([^>]+)>$/.exec(r);
    assert.ok(otv, 'krok 1: riadok vzoru, ktory generator nevie zapisat: ' + r);
    return otv[1] + '<b>&lt;' + esc(otv[2]) + '&gt;</b>';
  }).join('\n');
  return '<pre class="ef-xml" aria-hidden="true">' + telo + '</pre>';
}

function malyDom() {
  const vyrob = (meno) => ({
    meno, className: '', _t: '', deti: [],
    appendChild(d) { this.deti.push(d); return d; },
    removeChild(d) { this.deti.splice(this.deti.indexOf(d), 1); return d; },
    setAttribute() {},
    get firstChild() { return this.deti[0] || null; },
    set textContent(v) { this._t = String(v); this.deti = []; },
    get textContent() { return this._t + this.deti.map((d) => d.textContent).join(''); }
  });
  return { createElement: vyrob, createTextNode: (t) => { const u = vyrob('#text'); u.textContent = t; return u; } };
}
const STATICKY_TAG = { article: 'div', header: 'div', section: 'div', h2: 'p', h3: 'p' };
function htmlUzla(u) {
  if (u.meno === '#text') return esc(u._t);
  const tag = STATICKY_TAG[u.meno] || u.meno;
  const trieda = u.meno === 'h2' ? 'efa-t2' : u.meno === 'h3' ? 'efa-t3' : u.className;
  return '<' + tag + (trieda ? ' class="' + trieda + '"' : '') + '>' + esc(u._t) + u.deti.map(htmlUzla).join('') + '</' + tag + '>';
}
function obrazokKroku3(xml, jazyk) {
  const dom = malyDom();
  const ciel = dom.createElement('div');
  vykresliNahlad(parsujXml(xml).koren, ciel, jazyk, dom);
  const doklad = ciel.deti[0];
  assert.ok(doklad && doklad.className === 'efa-doklad', 'nahlad.js nevykreslil doklad');
  doklad.deti = doklad.deti.filter((d) => ['efa-hlavicka', 'efa-strany', 'efa-polozky'].includes(d.className));
  assert.equal(doklad.deti.length, 3, 'doklad nema hlavicku, strany a polozky');
  return '<div class="ef-vyrez-papier" aria-hidden="true">' + htmlUzla(doklad) + '</div>';
}

const okolie = (je, ma) => {
  let i = 0;
  while (i < je.length && i < ma.length && je[i] === ma[i]) i++;
  return 'na stranke "' + je.slice(Math.max(0, i - 50), i + 50) + '", ma byt "' + ma.slice(Math.max(0, i - 50), i + 50) + '"';
};
/** Kroky 1 a 3 stranky proti generatoru. Vrati zoznam rozdielov, prazdny znamena, ze sedia. */
function rozdielyKrokov(surove, jazyk) {
  const html = surove.replace(/ /g, ' ');
  const zac = html.indexOf('<ol class="ef-kroky">');
  if (zac < 0) return ['sekcia ef-kroky sa nenasla'];
  const kroky = html.slice(zac, html.indexOf('</ol>', zac));
  const k1 = kroky.slice(kroky.indexOf('ef-k1'), kroky.indexOf('ef-k2'));
  const k3 = kroky.slice(kroky.indexOf('ef-k3'));
  const xml = vzorZApp(MENO_KONSTANTY[jazyk]);
  const r = [];
  const ocak1 = obrazokKroku1(xml);
  const z1 = k1.indexOf('<pre class="ef-xml"');
  const je1 = z1 < 0 ? '' : k1.slice(z1, k1.indexOf('</pre>', z1) + '</pre>'.length);
  if (je1 !== ocak1) r.push('krok 1: ' + okolie(je1, ocak1));
  const ocak3 = obrazokKroku3(xml, jazyk);
  const z3 = k3.indexOf('<div class="ef-vyrez-papier"');
  const je3 = z3 < 0 ? '' : k3.slice(z3, z3 + ocak3.length);
  if (je3 !== ocak3) r.push('krok 3: ' + okolie(je3, ocak3));
  // za dokladom uz nic: len koniec ramika ef-vyrez a polozky zoznamu
  else if (!/^<\/div><\/li>\s*$/.test(k3.slice(z3 + ocak3.length))) r.push('krok 3: za dokladom je nieco navyse');
  return r;
}

/* Vsetky stranky s postupom. Jazyk vzoru je podla priecinka (cs, de, en), inak slovensky. */
const STRANKY_S_POSTUPOM = [
  'index.html',
  'cs/index.html',
  'de/index.html', 'de/csv-xrechnung/index.html', 'de/e-rechnung-freiberufler/index.html',
  'de/xrechnung-erstellen/index.html', 'de/xrechnung-validator/index.html',
  'en/index.html', 'en/csv-to-invoice/index.html', 'en/e-invoice-small-business/index.html',
  'en/peppol-invoice-generator/index.html', 'en/peppol-validator/index.html', 'en/ubl-invoice-example/index.html'
];
const jazykCesty = (cesta) => (/^(cs|de|en)\//.exec(cesta) || [])[1] || 'sk';

test('zoznam stranok s postupom je uplny (nova stranka s krokmi sa bez testu nepreklzne)', () => {
  const najdene = readdirSync(new URL('./', import.meta.url), { recursive: true })
    .map((p) => String(p).replace(/\\/g, '/'))
    .filter((p) => p.endsWith('index.html') && !p.startsWith('node_modules/'))
    .filter((p) => readFileSync(new URL('./' + p, import.meta.url), 'utf8').includes('<ol class="ef-kroky">'))
    .sort();
  assert.deepEqual(najdene, [...STRANKY_S_POSTUPOM].sort());
});

for (const cesta of STRANKY_S_POSTUPOM) {
  const j = jazykCesty(cesta);
  test('kroky 1 a 3 na ' + cesta + ' su znak po znaku obrazok ' + MENO_KONSTANTY[j], () => {
    const html = readFileSync(new URL('./' + cesta, import.meta.url), 'utf8');
    assert.deepEqual(rozdielyKrokov(html, j), []);
  });
}

test('presne porovnanie krokov zachyti aj drobnu zmenu (kontrola samotneho testu)', () => {
  const html = readFileSync(new URL('./de/index.html', import.meta.url), 'utf8');
  assert.deepEqual(rozdielyKrokov(html, 'de'), []);
  const zac = html.indexOf('<ol class="ef-kroky">');
  const kon = html.indexOf('</ol>', zac);
  // zmeny, ktore kontrola poli vyssie prepusti (overene 25. 9. 2026 mutaciami kritika)
  const ZMENY = [
    ['<span class="efa-hodnota">2026-09-25</span>', '<span class="efa-hodnota">2026-10-31</span>'],
    ['<td>45.00 EUR</td>', '<td>55.00 EUR</td>'],
    ['<p class="efa-adresa">04109 Leipzig</p>', '<p class="efa-adresa">974 01 Banska Bystrica</p>'],
    ['<span class="efa-hodnota">DE123456789</span>', '<span class="efa-hodnota">SK9999999999</span>'],
    ['<p class="efa-t2">Rechnung 2026-0142</p>', '<p class="efa-t2">Faktura 2026-0142</p>'],
    ['<span class="efa-popis">Fällig am</span>', '<span class="efa-popis">Splatnost</span>'],
    ['<i>2026-09-11</i>', '<i>2026-09-12</i>'],
    ['  <b>&lt;cbc:ProfileID&gt;</b><i>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</i><b>&lt;/cbc:ProfileID&gt;</b>\n', ''],
    ['</table></div></div></div>', '</table></div><p>navyse</p></div></div>'],
    ['</table></div></div></div></div></li>', '</table></div></div></div><p>navyse</p></div></li>']
  ];
  for (const [co, zaCo] of ZMENY) {
    const i = html.indexOf(co, zac);
    assert.ok(i > zac && i < kon, 'zmena sa v krokoch nenasla: ' + co);
    const zmenene = html.slice(0, i) + zaCo + html.slice(i + co.length);
    assert.notDeepEqual(rozdielyKrokov(zmenene, 'de'), [], 'test neodhalil zmenu na ' + zaCo);
  }
});

// ---------------------------------------------------------------- protokol na stiahnutie

const riadokProfilu = (text) => text.split('\n').find((r) => /^Profile?: /.test(r));

test('suhrn aj protokol maju nazov profilu v jazyku stranky, z jedneho miesta v pravidla.mjs', () => {
  // app.js nema vlastnu kopiu nazvov: suhrn bere nazovProfilu z pravidla.mjs, obe tlacidla
  // (Stiahnut protokol, Kopirovat) volaju protokol() s jazykom stranky
  assert.ok(!/NAZOV_PROFILU|protokolStranky/.test(APP), 'app.js ma znova vlastne nazvy profilov alebo obal protokolu');
  assert.match(APP, /import \{[^}]*\bnazovProfilu\b[^}]*\} from '\.\/pravidla\.mjs';/);
  assert.ok(APP.includes("T.sumarProfil + ': ' + nazovProfilu(v, LANG)"), 'suhrn na obrazovke');
  assert.equal((APP.match(/protokol\(poslednyVysledok, LANG, nazovSuboru\)/g) || []).length, 2, 'Stiahnut aj Kopirovat');

  const de = skontroluj(vzorZApp('VZOR_XML_DE'));
  const pDe = protokol(de, 'de', 'beispielrechnung.xml');
  assert.equal(riadokProfilu(pDe), 'Profil: XRechnung 3.x (Deutschland)');
  assert.ok(!pDe.includes('Nemecko'), 'nemecky protokol obsahuje slovenske Nemecko');
  assert.ok(pDe.startsWith('Prüfprotokoll E-Rechnung\nbeispielrechnung.xml\n'), 'hlavicka a nazov suboru');
  assert.equal(riadokProfilu(protokol(de, 'cs')), 'Profil: XRechnung 3.x (Německo)');
  assert.equal(riadokProfilu(protokol(de, 'en')), 'Profile: XRechnung 3.x (Germany)');
  assert.equal(riadokProfilu(protokol(de, 'sk')), 'Profil: XRechnung 3.x (Nemecko)');
  assert.equal(riadokProfilu(protokol(de)), 'Profil: XRechnung 3.x (Nemecko)', 'bez jazyka je protokol slovensky');
  // suhrn na obrazovke a protokol ukazuju ten isty nazov, kazdy jazyk ma nazov kazdeho profilu
  for (const j of JAZYKY) {
    assert.equal(riadokProfilu(protokol(de, j)).split(': ')[1], nazovProfilu(de, j), j);
    assert.deepEqual(Object.keys(NAZVY_PROFILOV_JAZYK[j]).sort(), ['en16931', 'neznamy', 'peppol', 'xrechnung'], j);
  }
  // Peppol je vlastne meno a ostava v kazdom jazyku
  assert.equal(riadokProfilu(protokol(skontroluj(vzorZApp('VZOR_XML_CS')), 'cs')), 'Profil: Peppol BIS Billing 3.0');
  // vysledok kontroly sa nemeni: profilNazov ostava slovensky, profilNazovEn anglicky
  assert.equal(de.profilNazov, 'XRechnung 3.x (Nemecko)');
  assert.equal(de.profilNazovEn, 'XRechnung 3.x (Germany)');
  // nalezy s chybami idu do protokolu po nemecky
  const sChybami = protokol(skontroluj(vzorSChybami(vzorZApp('VZOR_XML_DE'))), 'de');
  assert.ok(sChybami.includes('Fehler: 2, Warnungen: 1, Hinweise: 0'), sChybami);
  assert.ok(sChybami.includes('[FEHLER] BR-CO-15') && sChybami.includes('[FEHLER] ARL-IBAN') && sChybami.includes('[WARNUNG] BR-DE-19'));
});

test('vlozene XML a stiahnuty protokol maju nazov suboru v jazyku stranky', () => {
  assert.ok(APP.includes('prijmiText(t, nazovSuboru || T.vlozeneMeno);'), 'vlozeny text nema nazov z T');
  assert.ok(APP.includes('stiahni(T.menoProtokolu, protokol(poslednyVysledok, LANG, nazovSuboru));'), 'protokol sa nestahuje pod nazvom z T');
  assert.ok(!/'protokol-efaktura\.txt', protokol|\|\| 'vlozene\.xml'/.test(APP), 'natvrdo slovensky nazov suboru');
  const OCAKAVANE = {
    sk: ['vlozene.xml', 'protokol-efaktura.txt'],
    cs: ['vlozene.xml', 'protokol-e-faktury.txt'],
    de: ['eingefuegt.xml', 'pruefprotokoll-e-rechnung.txt'],
    en: ['pasted.xml', 'e-invoice-check-report.txt']
  };
  for (const j of JAZYKY) assert.deepEqual([T_ALL[j].vlozeneMeno, T_ALL[j].menoProtokolu], OCAKAVANE[j], j);
  const v = skontroluj(vzorZApp('VZOR_XML_DE'));
  assert.ok(protokol(v, 'de', T_ALL.de.vlozeneMeno).startsWith('Prüfprotokoll E-Rechnung\neingefuegt.xml\n'));
});

test('neznamy profil ma v kazdom jazyku spravny nazov s diakritikou', () => {
  const v = skontroluj('<Invoice><cbc:ID>1</cbc:ID></Faktura>');
  assert.deepEqual(v.nalezy.map((n) => n.kod), ['XML-01']);
  assert.equal(v.profilNazov, 'neznámy profil');
  const OCAKAVANE = { sk: 'neznámy profil', cs: 'neznámý profil', de: 'unbekanntes Profil', en: 'unknown profile' };
  for (const j of JAZYKY) {
    assert.equal(nazovProfilu(v, j), OCAKAVANE[j], j);
    assert.ok(protokol(v, j).includes(': ' + OCAKAVANE[j] + '\n'), j + ': protokol');
  }
});
