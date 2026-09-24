/* Testy prenosu XML do formulara: z-ubl.mjs a tlacidlo s poznamkou v app.js.
 *
 * Preco existuje: 7 dni v Umami (25. 9. 2026) = 61 navstev, 8 kontrol, 5 videnych cien,
 * 0 klikov na kupu. Kontrola pri chybach povedala len "Opravte ich a skuste znova" a clovek
 * odisiel. Novy krok: chybne XML -> formular -> oprava -> stiahnutie za existujucu cenu.
 * Testuje sa, ze prenos nic nevymysli, nic nestrati potichu a nic nepusti do HTML.
 *
 * Fixtury su nase vlastne (kopie builderov z tests.mjs, ktory sa neda importovat, lebo sa
 * spusta sam), plus davka.mjs, prazdnaFaktura z ubl.js a vzor z app.js.
 * usage: node --test products/arling-sk/efaktura/z-ubl.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { zUbl, skrat } from './z-ubl.mjs';
import { vytvorUbl, prepocitaj, prazdnaFaktura, cislo } from './ubl.js';
import { skontroluj } from './pravidla.mjs';
import { parsujXml } from './parser.mjs';
import { zostavDavku, VZOR_CSV } from './davka.mjs';

const APP = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const ZUBL_ZDROJ = readFileSync(new URL('./z-ubl.mjs', import.meta.url), 'utf8');
const JAZYKY = ['sk', 'cs', 'de', 'en'];
const chyby = (v) => v.nalezy.filter((n) => n.zavaznost === 'chyba').map((n) => n.kod);

// ---------------------------------------------------------------- fixtury

const IBAN_SK = 'SK3112000000198742637541';
const IBAN_DE = 'DE02120300000000202051';

// kopia z tests.mjs (generator pre SK, DE a CZ)
function fakturaSk() {
  return {
    typ: '380', profil: 'peppol', cislo: 'SK-2026-100',
    datumVystavenia: '2026-09-11', datumDodania: '2026-09-10', datumSplatnosti: '2026-09-25',
    mena: 'EUR', referenciaOdberatela: 'OBJ-1', variabilnySymbol: '2026100',
    poznamka: 'Fakturujeme podla zmluvy.',
    dodavatel: {
      nazov: 'ARLing vzor s. r. o.', ico: '11223344', icDph: 'SK1122334455',
      ulica: 'Slnecna 12', mesto: 'Bratislava', psc: '81101', krajina: 'SK',
      kontakt: 'Jana Vzorova', telefon: '+421 900 123 456', email: 'fakturacia@vzor.sk',
      iban: IBAN_SK, endpoint: '1122334455', endpointSchema: '0245'
    },
    odberatel: {
      nazov: 'Odberatel SK a. s.', ico: '99887766', icDph: 'SK9988776655',
      ulica: 'Nadrazna 5', mesto: 'Kosice', psc: '04001', krajina: 'SK',
      endpoint: '9988776655', endpointSchema: '0245'
    },
    sposobPlatby: '58',
    polozky: [
      { nazov: 'Konzultacie', mnozstvo: 7, jednotka: 'HUR', cena: 45, sadzba: 23, kategoria: 'S' },
      { nazov: 'Kniha', mnozstvo: 3, jednotka: 'C62', cena: 12.9, sadzba: 5, kategoria: 'S' }
    ]
  };
}

function fakturaDe() {
  const f = fakturaSk();
  return Object.assign(f, {
    profil: 'xrechnung', cislo: 'DE-2026-100', mena: 'EUR',
    referenciaOdberatela: '04011000-12345-03',
    dodavatel: Object.assign({}, f.dodavatel, {
      nazov: 'Muster Verkaeufer GmbH', icDph: 'DE123456789', krajina: 'DE',
      ulica: 'Hauptstrasse 3', mesto: 'Berlin', psc: '10115',
      email: 'rechnung@muster.de', telefon: '+49 30 123456', kontakt: 'Max Muster',
      iban: IBAN_DE, endpoint: 'DE123456789', endpointSchema: '9930'
    }),
    odberatel: Object.assign({}, f.odberatel, {
      nazov: 'Muster Amt', icDph: '', krajina: 'DE',
      ulica: 'Amtsweg 1', mesto: 'Bonn', psc: '53111',
      endpoint: '04011000-12345-03', endpointSchema: '0204'
    }),
    polozky: [
      { nazov: 'Beratungsleistung', mnozstvo: 4, jednotka: 'HUR', cena: 95, sadzba: 19, kategoria: 'S' },
      { nazov: 'Handbuch', mnozstvo: 2, jednotka: 'C62', cena: 24.5, sadzba: 7, kategoria: 'S' }
    ]
  });
}

function fakturaCz() {
  const f = fakturaSk();
  return Object.assign(f, {
    profil: 'peppol', cislo: 'CZ-2026-100', mena: 'CZK',
    dodavatel: Object.assign({}, f.dodavatel, {
      nazov: 'Vzorovy dodavatel s. r. o.', icDph: 'CZ12345678', krajina: 'CZ',
      ulica: 'Dlouha 7', mesto: 'Praha', psc: '11000',
      iban: 'CZ6508000000192000145399', endpoint: '0001234567895', endpointSchema: '0088'
    }),
    odberatel: Object.assign({}, f.odberatel, {
      nazov: 'Odberatel CZ s. r. o.', icDph: 'CZ87654321', krajina: 'CZ',
      ulica: 'Kratka 2', mesto: 'Brno', psc: '60200',
      endpoint: '0001234567901', endpointSchema: '0088'
    }),
    polozky: [
      { nazov: 'Sluzby', mnozstvo: 5, jednotka: 'HUR', cena: 1200, sadzba: 21, kategoria: 'S' },
      { nazov: 'Prirucka', mnozstvo: 1, jednotka: 'C62', cena: 349, sadzba: 12, kategoria: 'S' }
    ]
  });
}

/** Vsetky faktury z existujucich testov (tests.mjs 14 az 18, 35, 36; davka.test.mjs; platba.test.mjs) plus jedna plna. */
function fixtury() {
  const zoznam = [['SK', fakturaSk()], ['DE', fakturaDe()], ['CZ', fakturaCz()]];

  const dobropis = fakturaSk();
  Object.assign(dobropis, { typ: '381', cislo: 'SK-2026-D1', predchadzajucaFaktura: { cislo: 'SK-2026-100', datum: '2026-09-11' } });
  zoznam.push(['dobropis', dobropis]);

  const ae = fakturaSk();
  ae.cislo = 'SK-2026-AE';
  ae.polozky = [{ nazov: 'Stavebne prace', mnozstvo: 1, jednotka: 'C62', cena: 1000, sadzba: 0, kategoria: 'AE' }];
  zoznam.push(['prenesenie AE', ae]);

  const ic = fakturaSk();
  ic.cislo = 'SK-2026-IC';
  ic.odberatel = Object.assign({}, ic.odberatel, { krajina: 'AT', icDph: 'ATU12345678', mesto: 'Wien', psc: '1010' });
  ic.polozky = [{ nazov: 'Tovar do Rakuska', mnozstvo: 2, jednotka: 'C62', cena: 500, sadzba: 0, kategoria: 'K' }];
  zoznam.push(['dodanie do EU K', ic]);

  const hal = fakturaSk();
  hal.polozky = [
    { nazov: 'A', mnozstvo: 3, jednotka: 'C62', cena: 33.33, sadzba: 23, kategoria: 'S' },
    { nazov: 'B', mnozstvo: 7, jednotka: 'C62', cena: 1.015, sadzba: 23, kategoria: 'S' },
    { nazov: 'C', mnozstvo: 1, jednotka: 'C62', cena: 0.005, sadzba: 5, kategoria: 'S' }
  ];
  zoznam.push(['sucty na haliere', hal]);

  const zal = fakturaSk();
  zal.zaplatene = 100;
  zoznam.push(['zaloha', zal]);

  for (const kod of ['L', 'M']) {
    for (const sadzba of [0, 7]) {
      const f = fakturaSk();
      f.cislo = 'SK-2026-' + kod + sadzba;
      f.polozky = [{ nazov: 'Tovar ' + kod, mnozstvo: 2, jednotka: 'C62', cena: 50, sadzba, kategoria: kod }];
      zoznam.push([kod + ' ' + sadzba + ' %', f]);
    }
  }

  const pp = fakturaSk();
  pp.platobnePodmienky = 'Zahlbar innerhalb von 14 Tagen ohne Abzug.';
  zoznam.push(['vlastne platobne podmienky', pp]);

  // Vsetko, co generator vie zapisat, aj to, na co formular nema pole.
  const plna = fakturaSk();
  Object.assign(plna, {
    profil: 'en16931', cislo: 'SK-2026-PLNA', obdobieOd: '2026-09-01', obdobieDo: '2026-09-30',
    objednavka: 'PO-77', miestoDodania: { ulica: 'Skladova 3', mesto: 'Zilina', psc: '01001', krajina: 'SK' },
    kodOslobodenia: 'VATEX-EU-132', zaplatene: '12,50', sposobPlatby: '30'
  });
  plna.dodavatel = Object.assign({}, plna.dodavatel, {
    obchodneMeno: 'ARLing vzor', ulica2: 'Budova B', identifikator: 'DOD-1', identifikatorSchema: '0088',
    bic: 'TATRSKBX', iban: 'sk31 1200 0000 1987 4263 7541'
  });
  plna.odberatel = Object.assign({}, plna.odberatel, { email: 'nakup@odberatel.sk', kontakt: 'Peter Odberatel', telefon: '+421 2 000 000' });
  plna.polozky = [
    { nazov: 'Skolenie', popis: 'Dvojdnove skolenie', mnozstvo: '2,5', jednotka: 'DAY', cena: '400', sadzba: 0, kategoria: 'E', dovodOslobodenia: 'Oslobodene podla par. 37' },
    { nazov: 'Material', mnozstvo: 3, jednotka: 'C62', cena: 10, sadzba: 23, kategoria: 'S' },
    { nazov: 'Mimo DPH', mnozstvo: 1, jednotka: 'C62', cena: 5, sadzba: 0, kategoria: 'O' }
  ];
  zoznam.push(['plna', plna]);

  // platba.test.mjs: prazdna faktura s cislom
  const prazdna = prazdnaFaktura();
  prazdna.cislo = 'TESTFA-1';
  zoznam.push(['prazdna SK', prazdna]);
  const prazdnaDe = prazdnaFaktura('DE');
  prazdnaDe.cislo = 'TESTFA-2';
  zoznam.push(['prazdna DE', prazdnaDe]);

  // davka.test.mjs: zaklad dodavatela a vzorove CSV
  const zaklad = { profil: 'xrechnung', sposobPlatby: '58',
    dodavatel: { nazov: 'Fiktivny dodavatel', ulica: 'Vzorova 1', mesto: 'Berlin', psc: '10115', krajina: 'DE',
      ico: 'HRB12345', icDph: 'DE123456789', kontakt: 'Example Contact', email: 'invoice@example.com', telefon: '+49 30 1234567',
      iban: 'DE02120300000000202051', endpoint: 'DE123456789', endpointSchema: '9930' } };
  for (const profil of ['xrechnung', 'peppol']) {
    const v = zostavDavku(VZOR_CSV, Object.assign({}, zaklad, { profil }), 'en');
    v.faktury.forEach((f, i) => zoznam.push(['davka ' + profil + ' ' + (i + 1), f.faktura]));
  }
  return zoznam;
}

/** Polia, ktore generator zapisuje, musia po prenose sediet s povodnou fakturou. */
function overPolia(f, g, popis) {
  const typ = String(f.typ || '380');
  assert.equal(g.typ, typ, popis + ': typ');
  assert.equal(g.profil, f.profil || 'peppol', popis + ': profil');
  for (const k of ['cislo', 'datumVystavenia', 'datumDodania', 'mena', 'poznamka', 'variabilnySymbol', 'referenciaOdberatela',
    'objednavka', 'obdobieOd', 'obdobieDo', 'sposobPlatby', 'platobnePodmienky', 'kodOslobodenia']) {
    if (f[k] !== undefined && f[k] !== null && String(f[k]) !== '') assert.equal(g[k], String(f[k]), popis + ': ' + k);
  }
  if (typ !== '381' && f.datumSplatnosti) assert.equal(g.datumSplatnosti, f.datumSplatnosti, popis + ': datumSplatnosti');
  assert.equal(cislo(g.zaplatene), cislo(f.zaplatene), popis + ': zaplatene');
  if (f.predchadzajucaFaktura) assert.deepEqual(g.predchadzajucaFaktura, f.predchadzajucaFaktura, popis + ': predchadzajucaFaktura');
  if (f.miestoDodania) assert.deepEqual(g.miestoDodania, f.miestoDodania, popis + ': miestoDodania');
  const POLIA = ['nazov', 'ico', 'icDph', 'ulica', 'ulica2', 'mesto', 'psc', 'krajina', 'email', 'telefon', 'kontakt',
    'iban', 'bic', 'endpoint', 'endpointSchema', 'obchodneMeno', 'identifikator', 'identifikatorSchema'];
  for (const strana of ['dodavatel', 'odberatel']) {
    const a = f[strana] || {};
    const b = g[strana];
    for (const k of POLIA) {
      if (!a[k]) continue;
      if (k === 'endpointSchema' && !a.endpoint) continue;
      if (k === 'bic' && !a.iban) continue;
      if ((k === 'iban' || k === 'bic') && strana === 'odberatel') continue;
      if ((k === 'identifikator' || k === 'identifikatorSchema') && !(a.identifikator && a.identifikatorSchema)) continue;
      if (strana === 'odberatel' && (k === 'kontakt' || k === 'telefon') && !a.email) continue;
      const cakane = k === 'iban' ? String(a[k]).replace(/\s+/g, '').toUpperCase() : String(a[k]);
      assert.equal(b[k], cakane, popis + ': ' + strana + '.' + k);
    }
  }
  assert.equal(g.polozky.length, f.polozky.length, popis + ': pocet poloziek');
  f.polozky.forEach((p, i) => {
    const q = g.polozky[i];
    const kat = p.kategoria || 'S';
    assert.equal(q.nazov, p.nazov || '', popis + ': nazov ' + i);
    assert.equal(q.popis || '', p.popis || '', popis + ': popis ' + i);
    assert.equal(q.jednotka, p.jednotka || 'C62', popis + ': jednotka ' + i);
    assert.equal(q.kategoria, kat, popis + ': kategoria ' + i);
    assert.equal(cislo(q.mnozstvo), cislo(p.mnozstvo), popis + ': mnozstvo ' + i);
    assert.equal(cislo(q.cena), cislo(p.cena), popis + ': cena ' + i);
    if (kat !== 'O') assert.equal(cislo(q.sadzba), cislo(p.sadzba), popis + ': sadzba ' + i);
    if (p.dovodOslobodenia) assert.equal(q.dovodOslobodenia, p.dovodOslobodenia, popis + ': dovod ' + i);
  });
}

/** XML zapisane natvrdo v app.js (vzor pre tlacidlo Nacitat vzor / Beispiel laden / Load sample). */
function vzorZApp(meno) {
  const zac = APP.indexOf('const ' + meno + ' = `');
  assert.ok(zac > 0, 'app.js: ' + meno + ' sa nenasiel');
  return APP.slice(APP.indexOf('<?xml', zac), APP.indexOf('\n`;', zac) + 1);
}

/* Vzorova faktura s dvoma chybami, presne ako ju stranka ukazuje v ramiku "Ukazka"
 * (index.html, ef-ukazka: "Nasli sme 2 chyby", BR-CO-15 so sumou 553.51 a ARL-IBAN s ...542).
 * Suma s DPH aj suma na uhradu su 553.51, preto BR-CO-16 neplati a chyby su presne dve.
 * Tlacidlo Nacitat vzor nacita bezchybny VZOR_XML; verziu s chybami stranka len kresli. */
function vzorSChybami() {
  return vzorZApp('VZOR_XML')
    .replace('<cbc:TaxInclusiveAmount currencyID="EUR">553.50</cbc:TaxInclusiveAmount>', '<cbc:TaxInclusiveAmount currencyID="EUR">553.51</cbc:TaxInclusiveAmount>')
    .replace('<cbc:PayableAmount currencyID="EUR">553.50</cbc:PayableAmount>', '<cbc:PayableAmount currencyID="EUR">553.51</cbc:PayableAmount>')
    .replace('<cbc:ID>SK3112000000198742637541</cbc:ID>', '<cbc:ID>SK3112000000198742637542</cbc:ID>');
}

// ---------------------------------------------------------------- (a) spatny chod

test('(a) spatny chod: zUbl(vytvorUbl(f)) sedi s f vo vsetkych podporovanych poliach a dava to iste XML', () => {
  const zoznam = fixtury();
  assert.ok(zoznam.length >= 20, 'fixtur je ' + zoznam.length);
  for (const [meno, f] of zoznam) {
    for (const jazyk of JAZYKY) {
      const popis = meno + ' [' + jazyk + ']';
      const xml = vytvorUbl(f, { jazyk });
      const v = zUbl(xml, { jazyk });
      assert.equal(v.ok, true, popis + ': ' + (v.chyba && v.chyba.sk));
      assert.equal(vytvorUbl(v.faktura, { jazyk }), xml, popis + ': nove XML sa lisi od povodneho');
      assert.deepEqual(prepocitaj(v.faktura), prepocitaj(f), popis + ': prepocet sa lisi');
      overPolia(f, v.faktura, popis);
      assert.deepEqual(v.neprenesene, [], popis + ': z nasho XML sa nesmie nic stratit');
      assert.deepEqual(v.rozdiely, [], popis + ': nase XML nesmie mat rozdiely');
    }
  }
});

test('(a) text splatnosti, ktory napisal generator, ostane prazdny a zmeni sa so splatnostou', () => {
  const f = fakturaSk();
  const v = zUbl(vytvorUbl(f, { jazyk: 'de' }), { jazyk: 'de' });
  assert.equal(v.faktura.platobnePodmienky, '');
  v.faktura.datumSplatnosti = '2026-10-05';
  assert.ok(vytvorUbl(v.faktura, { jazyk: 'de' }).includes('<cbc:Note>Fällig am 2026-10-05</cbc:Note>'));
  // vlastny text cloveka sa nikdy nezahodi
  const g = fakturaSk();
  g.platobnePodmienky = 'Splatnosť 2026-09-25, inak penále.';
  assert.equal(zUbl(vytvorUbl(g), { jazyk: 'sk' }).faktura.platobnePodmienky, 'Splatnosť 2026-09-25, inak penále.');
});

test('(a) co generator zapise bez pola vo formulari, zoznam skryte povie', () => {
  const plna = fixtury().find(([m]) => m === 'plna')[1];
  const v = zUbl(vytvorUbl(plna), { jazyk: 'sk' });
  const texty = v.skryte.map((x) => x.text);
  for (const t of ['popis položky', 'fakturačné obdobie', 'číslo objednávky', 'miesto dodania', 'obchodné meno', 'doplnok adresy', 'identifikátor strany', 'kontaktná osoba odberateľa', 'dôvod oslobodenia od DPH', 'kód dôvodu oslobodenia']) {
    assert.ok(texty.includes(t), 'chyba v skryte: ' + t + ' | ' + texty.join(', '));
  }
  assert.deepEqual(zUbl(vytvorUbl(fakturaSk()), { jazyk: 'sk' }).skryte, [], 'bezna faktura nema skryte udaje');
});

test('(a) 1000 riadkov sa prenesie rychlo a bez straty', () => {
  const f = fakturaSk();
  f.polozky = Array.from({ length: 1000 }, (_, i) => ({ nazov: 'Polozka ' + (i + 1), mnozstvo: 1 + (i % 3), jednotka: 'C62', cena: 1 + (i % 37) / 10, sadzba: i % 2 ? 23 : 5, kategoria: 'S' }));
  const xml = vytvorUbl(f);
  const t0 = Date.now();
  const v = zUbl(xml);
  const trvanie = Date.now() - t0;
  assert.equal(vytvorUbl(v.faktura), xml);
  assert.deepEqual(v.neprenesene, []);
  assert.ok(trvanie < 5000, 'trvalo ' + trvanie + ' ms');
});

// ---------------------------------------------------------------- (b) vzor s chybami

test('(b) vzor stranky bez chyb sa prenesie cely a ostane bez chyby', () => {
  for (const [meno, jazyk] of [['VZOR_XML', 'sk'], ['VZOR_XML', 'cs'], ['VZOR_XML', 'de'], ['VZOR_XML_EN', 'en']]) {
    const xml = vzorZApp(meno);
    assert.equal(skontroluj(xml).sumar.chyby, 0, meno + ' ma byt bez chyby');
    const v = zUbl(xml, { jazyk });
    assert.equal(v.ok, true);
    assert.deepEqual(v.neprenesene, [], meno + ': nic sa nema stratit');
    assert.deepEqual(v.rozdiely, [], meno + ': nic sa nema zmenit');
    assert.equal(v.faktura.cislo, '2026-0142');
    assert.equal(v.faktura.polozky.length, 2);
    assert.equal(skontroluj(vytvorUbl(v.faktura, { profil: v.faktura.profil || 'peppol', jazyk })).sumar.chyby, 0, meno + ': po prenose vznikla chyba');
  }
  const sk = zUbl(vzorZApp('VZOR_XML'), { jazyk: 'sk' }).faktura;
  assert.equal(sk.dodavatel.nazov, 'Vzorová dielna s. r. o.');
  assert.equal(sk.polozky[0].jednotka, 'HUR');
  assert.equal(sk.polozky[0].sadzba, 23);
  assert.equal(sk.platobnePodmienky, 'Splatnosť 14 dní od vystavenia.');
});

test('(b) vzor s chybami z ukazky: chybne hodnoty su po prenose vidiet, nie potichu opravene', () => {
  const xml = vzorSChybami();
  const povodne = chyby(skontroluj(xml));
  assert.deepEqual(povodne.slice().sort(), ['ARL-IBAN', 'BR-CO-15'], 'ukazka na stranke hovori o 2 chybach: ' + povodne.join(', '));
  const v = zUbl(xml, { jazyk: 'sk' });
  assert.equal(v.ok, true);
  // zly IBAN ide do formulara tak, ako je, a kontrola formulara ho stale hlasi
  assert.equal(v.faktura.dodavatel.iban, 'SK3112000000198742637542');
  const poPrenose = chyby(skontroluj(vytvorUbl(v.faktura, { profil: v.faktura.profil || 'peppol', jazyk: 'sk' })));
  assert.ok(poPrenose.includes('ARL-IBAN'), 'chyba IBAN zmizla: ' + poPrenose.join(', '));
  // sumu s DPH formular prepocita z poloziek; poznamka to musi povedat aj s oboma cislami
  const suma = v.rozdiely.find((r) => r.kod === 'cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount');
  assert.ok(suma, 'rozdiel v sume s DPH chyba: ' + JSON.stringify(v.rozdiely));
  assert.equal(suma.druh, 'zmena');
  assert.equal(suma.vSubore, '553.51');
  assert.equal(suma.formular, '553.50');
  assert.equal(suma.text, 'suma s DPH');
  const uhrada = v.rozdiely.find((r) => r.kod === 'cac:LegalMonetaryTotal/cbc:PayableAmount');
  assert.ok(uhrada && uhrada.vSubore === '553.51' && uhrada.formular === '553.50', JSON.stringify(v.rozdiely));
  assert.equal(v.rozdiely.length, 2, 'ine rozdiely tu nie su: ' + JSON.stringify(v.rozdiely));
  assert.equal(zUbl(xml, { jazyk: 'de' }).rozdiely.find((r) => r.kod === suma.kod).text, 'Gesamtbetrag brutto');
  assert.deepEqual(v.neprenesene, []);
});

test('(b) co v subore chyba, ostane prazdne; co generator doplni sam, je v rozdieloch', () => {
  const xml = vzorZApp('VZOR_XML')
    .replace('  <cbc:BuyerReference>OBJ-2026-77</cbc:BuyerReference>\n', '')
    .replace('<cbc:CompanyID>36000002</cbc:CompanyID>', '')
    .replace('<cac:Country>\n          <cbc:IdentificationCode>SK</cbc:IdentificationCode>\n        </cac:Country>\n      </cac:PostalAddress>\n      <cac:PartyTaxScheme>\n        <cbc:CompanyID>SK2130000002</cbc:CompanyID>',
      '</cac:PostalAddress>\n      <cac:PartyTaxScheme>\n        <cbc:CompanyID>SK2130000002</cbc:CompanyID>')
    .replace('<cbc:IssueDate>2026-09-11</cbc:IssueDate>', '<cbc:IssueDate>11.09.2026</cbc:IssueDate>')
    .replace('<cbc:ID>S</cbc:ID>\n        <cbc:Percent>23.00</cbc:Percent>\n        <cac:TaxScheme>\n          <cbc:ID>VAT</cbc:ID>\n        </cac:TaxScheme>\n      </cac:ClassifiedTaxCategory>\n    </cac:Item>\n    <cac:Price>\n      <cbc:PriceAmount currencyID="EUR">45.00</cbc:PriceAmount>\n    </cac:Price>\n  </cac:InvoiceLine>\n  <cac:InvoiceLine>\n    <cbc:ID>2</cbc:ID>',
      '<cbc:ID>S</cbc:ID>\n        <cbc:Percent>20.00</cbc:Percent>\n        <cac:TaxScheme>\n          <cbc:ID>VAT</cbc:ID>\n        </cac:TaxScheme>\n      </cac:ClassifiedTaxCategory>\n    </cac:Item>\n    <cac:Price>\n      <cbc:PriceAmount currencyID="EUR">45.00</cbc:PriceAmount>\n    </cac:Price>\n  </cac:InvoiceLine>\n  <cac:InvoiceLine>\n    <cbc:ID>2</cbc:ID>');
  assert.ok(!xml.includes('OBJ-2026-77') && xml.includes('11.09.2026') && xml.includes('20.00'), 'uprava vzoru sa nepodarila');
  const v = zUbl(xml, { jazyk: 'sk' });
  const f = v.faktura;
  assert.equal(f.referenciaOdberatela, '');
  assert.equal(f.odberatel.ico, '');
  assert.equal(f.odberatel.krajina, '', 'chybajuca krajina sa nesmie vymysliet');
  assert.equal(f.datumVystavenia, '11.09.2026', 'zly datum sa nesmie prepisat');
  assert.equal(f.polozky[0].sadzba, 20, 'sadzba 20 % sa nesmie potichu zmenit na 23 %');
  const krajina = v.rozdiely.find((r) => r.druh === 'doplnene' && r.kod.endsWith('cac:Country/cbc:IdentificationCode'));
  assert.ok(krajina, 'nie je povedane, ze generator doplni krajinu: ' + JSON.stringify(v.rozdiely));
  assert.equal(krajina.formular, 'SK');
  assert.equal(krajina.text, 'krajina (odberateľ)');
  // kontrola formulara tieto chyby stale vidi
  const k = chyby(skontroluj(vytvorUbl(f, { profil: f.profil || 'peppol', jazyk: 'sk' })));
  assert.ok(k.length > 0, 'po prenose zmizli vsetky chyby');
});

// ---------------------------------------------------------------- (c) dobropis

const MP = ' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"' +
  ' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"';

// kopia F2_DOBROPIS z tests.mjs
const DOBROPIS = `<?xml version="1.0" encoding="UTF-8"?>
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"${MP}>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>2026-D001</cbc:ID>
  <cbc:IssueDate>2026-09-12</cbc:IssueDate>
  <cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>OBJ-2026-77</cbc:BuyerReference>
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>2026-0001</cbc:ID>
      <cbc:IssueDate>2026-09-11</cbc:IssueDate>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0245">1234567890</cbc:EndpointID>
      <cac:PostalAddress>
        <cbc:StreetName>Slnecna 12</cbc:StreetName>
        <cbc:CityName>Bratislava</cbc:CityName>
        <cbc:PostalZone>81101</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>SK</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>SK2020000000</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Vzorovy dodavatel s. r. o.</cbc:RegistrationName>
        <cbc:CompanyID>12345678</cbc:CompanyID>
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:Name>Jana Vzorova</cbc:Name>
        <cbc:Telephone>+421 900 123 456</cbc:Telephone>
        <cbc:ElectronicMail>fakturacia@vzor.sk</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0245">9876543210</cbc:EndpointID>
      <cac:PostalAddress>
        <cbc:StreetName>Nadrazna 5</cbc:StreetName>
        <cbc:CityName>Kosice</cbc:CityName>
        <cbc:PostalZone>04001</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>SK</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>SK2023456789</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Vzorovy odberatel a. s.</cbc:RegistrationName>
        <cbc:CompanyID>87654321</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount><cbc:ID>${IBAN_SK}</cbc:ID></cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:PaymentTerms>
    <cbc:Note>Dobropis k fakture 2026-0001.</cbc:Note>
  </cac:PaymentTerms>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">11.50</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">50.00</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">11.50</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>23.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">50.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">50.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">61.50</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">61.50</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:CreditNoteLine>
    <cbc:ID>1</cbc:ID>
    <cbc:CreditedQuantity unitCode="C62">2</cbc:CreditedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">50.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>Licencia na nastroj, vratenie</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>23.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">25.00</cbc:PriceAmount></cac:Price>
  </cac:CreditNoteLine>
</CreditNote>
`;

test('(c) dobropis (CreditNote) sa prenesie ako dobropis', () => {
  assert.equal(skontroluj(DOBROPIS).sumar.chyby, 0);
  const v = zUbl(DOBROPIS, { jazyk: 'sk' });
  assert.equal(v.ok, true);
  const f = v.faktura;
  assert.equal(f.typ, '381');
  assert.equal(f.cislo, '2026-D001');
  assert.deepEqual(f.predchadzajucaFaktura, { cislo: '2026-0001', datum: '2026-09-11' });
  assert.equal(f.polozky.length, 1);
  assert.equal(f.polozky[0].mnozstvo, 2);
  assert.equal(f.polozky[0].nazov, 'Licencia na nastroj, vratenie');
  assert.equal(f.platobnePodmienky, 'Dobropis k fakture 2026-0001.');
  assert.equal(f.datumSplatnosti, '');
  assert.deepEqual(v.neprenesene, []);
  assert.deepEqual(v.rozdiely, []);
  const nove = vytvorUbl(f, { profil: f.profil, jazyk: 'sk' });
  assert.ok(nove.includes('<CreditNote ') && nove.includes('<cac:CreditNoteLine>') && nove.includes('<cbc:CreditedQuantity unitCode="C62">2</cbc:CreditedQuantity>'));
  assert.equal(skontroluj(nove).sumar.chyby, 0);
});

test('(c) dobropis s inym typom nez 381 povie, ze formular z neho urobi fakturu', () => {
  const v = zUbl(DOBROPIS.replace('<cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>', '<cbc:CreditNoteTypeCode>396</cbc:CreditNoteTypeCode>'), { jazyk: 'sk' });
  assert.equal(v.faktura.typ, '396', 'typ zo suboru sa nemeni');
  const druh = v.rozdiely.find((r) => r.kod === 'druh-dokladu');
  assert.ok(druh, JSON.stringify(v.rozdiely));
  assert.ok(druh.veta.includes('CreditNote') && druh.veta.includes('Invoice') && druh.veta.includes('381'), druh.veta);
});

// ---------------------------------------------------------------- (d) CII a ine subory

const CII = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100">
  <rsm:ExchangedDocument>
    <ram:ID>CII-2026-1</ram:ID>
  </rsm:ExchangedDocument>
</rsm:CrossIndustryInvoice>
`;

test('(d) CII vrati jasnu chybu vo vsetkych styroch jazykoch, nie polovicny formular', () => {
  assert.equal(skontroluj(CII).typ, 'CII');
  for (const jazyk of JAZYKY) {
    const v = zUbl(CII, { jazyk });
    assert.equal(v.ok, false);
    assert.equal(v.faktura, null);
    assert.equal(v.chyba.kod, 'cii');
    assert.ok(v.chyba.text.includes('CII') && v.chyba.text.includes('UBL 2.1'), v.chyba.text);
    assert.equal(v.chyba.text, v.chyba[jazyk]);
  }
});

test('(d) nie XML, prazdny vstup a iny hlavny prvok tiez vratia chybu, nikdy vynimku', () => {
  assert.equal(zUbl('Toto nie je faktura.').chyba.kod, 'xml');
  assert.equal(zUbl('').chyba.kod, 'xml');
  assert.equal(zUbl(null).chyba.kod, 'xml');
  const ina = zUbl('<Order xmlns="urn:oasis:names:specification:ubl:schema:xsd:Order-2"><ID>1</ID></Order>', { jazyk: 'en' });
  assert.equal(ina.chyba.kod, 'koren');
  assert.ok(ina.chyba.text.includes('Order'));
  // poskodene kusy spravneho XML: ziadna vynimka
  const xml = vytvorUbl(fakturaSk());
  let padov = 0;
  for (let i = 0; i < 120; i += 1) {
    const rez = Math.floor((xml.length * i) / 120);
    for (const kus of [xml.slice(0, rez), xml.slice(rez), xml.slice(0, rez) + xml.slice(rez + 40)]) {
      try {
        const v = zUbl(kus);
        assert.equal(typeof v.ok, 'boolean');
      } catch (e) { padov += 1; }
    }
  }
  assert.equal(padov, 0);
});

// ---------------------------------------------------------------- (e) co formular nevie

test('(e) priloha, zlava k dokladu, druha dodacia adresa a kod polozky su v neprenesene', () => {
  const xml = vytvorUbl(fakturaSk())
    .replace('  <cbc:BuyerReference>OBJ-1</cbc:BuyerReference>\n', '  <cbc:BuyerReference>OBJ-1</cbc:BuyerReference>\n'
      + '  <cbc:TaxPointDate>2026-09-10</cbc:TaxPointDate>\n'
      + '  <cac:AdditionalDocumentReference><cbc:ID>ZML-1</cbc:ID><cac:Attachment>'
      + '<cbc:EmbeddedDocumentBinaryObject mimeCode="application/pdf" filename="zmluva.pdf">JVBERi0xLjQK</cbc:EmbeddedDocumentBinaryObject>'
      + '</cac:Attachment></cac:AdditionalDocumentReference>\n')
    .replace('  </cac:Delivery>\n', '  </cac:Delivery>\n  <cac:Delivery><cbc:ActualDeliveryDate>2026-09-12</cbc:ActualDeliveryDate>'
      + '<cac:DeliveryLocation><cac:Address><cbc:StreetName>Skladova 1</cbc:StreetName><cbc:CityName>Trnava</cbc:CityName>'
      + '<cac:Country><cbc:IdentificationCode>SK</cbc:IdentificationCode></cac:Country></cac:Address></cac:DeliveryLocation></cac:Delivery>\n')
    .replace('  <cac:TaxTotal>\n', '  <cac:AllowanceCharge><cbc:ChargeIndicator>false</cbc:ChargeIndicator><cbc:Amount currencyID="EUR">10.00</cbc:Amount>'
      + '<cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>23</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:AllowanceCharge>\n  <cac:TaxTotal>\n')
    .replace('<cbc:Name>Konzultacie</cbc:Name>', '<cbc:Name>Konzultacie</cbc:Name><cac:SellersItemIdentification><cbc:ID>ART-7</cbc:ID></cac:SellersItemIdentification>');
  assert.equal(parsujXml(xml).ok, true);
  const v = zUbl(xml, { jazyk: 'sk' });
  assert.equal(v.ok, true);
  const podlaKodu = Object.fromEntries(v.neprenesene.map((x) => [x.kod, x]));
  assert.equal(podlaKodu['cac:AdditionalDocumentReference'].text, 'príloha alebo odkaz na dokument');
  assert.equal(podlaKodu['cac:AdditionalDocumentReference'].pocet, 1, 'jedna priloha, hoci ma viac prvkov a atributov');
  assert.equal(podlaKodu['cac:AllowanceCharge'].text, 'zľava alebo príplatok k celému dokladu');
  assert.equal(podlaKodu['cbc:TaxPointDate'].text, 'dátum zdaniteľného plnenia');
  assert.equal(podlaKodu['cbc:TaxPointDate'].priklad, '2026-09-10');
  assert.equal(podlaKodu['cac:InvoiceLine/cac:Item/cac:SellersItemIdentification'].text, 'kód položky u dodávateľa (riadok 1)');
  assert.equal(podlaKodu['cac:Delivery/cac:DeliveryLocation'].text, 'miesto dodania (dodanie)');
  assert.equal(podlaKodu['cac:Delivery/cbc:ActualDeliveryDate'].priklad, '2026-09-12');
  // co formular vie, sa prenieslo aj tak
  assert.equal(v.faktura.cislo, 'SK-2026-100');
  assert.equal(v.faktura.datumDodania, '2026-09-10');
  assert.equal(v.faktura.polozky[0].nazov, 'Konzultacie');
  // texty su v jazyku stranky
  const en = Object.fromEntries(zUbl(xml, { jazyk: 'en' }).neprenesene.map((x) => [x.kod, x.text]));
  assert.equal(en['cac:AdditionalDocumentReference'], 'attachment or document reference');
  assert.equal(en['cac:AllowanceCharge'], 'allowance or charge on the whole document');
  const de = Object.fromEntries(zUbl(xml, { jazyk: 'de' }).neprenesene.map((x) => [x.kod, x.text]));
  assert.equal(de['cac:InvoiceLine/cac:Item/cac:SellersItemIdentification'], 'Artikelnummer des Verkäufers (Position 1)');
});

test('(e) viac poznamok sa spoji do jednej a prazdne prvky sa ohlasia', () => {
  const xml = vytvorUbl(fakturaSk())
    .replace('<cbc:Note>Fakturujeme podla zmluvy.</cbc:Note>', '<cbc:Note>Prva.</cbc:Note>\n  <cbc:Note>Druha.</cbc:Note>\n  <cbc:AccountingCost></cbc:AccountingCost>');
  const v = zUbl(xml, { jazyk: 'sk' });
  assert.equal(v.faktura.poznamka, 'Prva. Druha.');
  assert.ok(v.rozdiely.some((r) => r.kod === 'poznamky' && r.pocet === 2), JSON.stringify(v.rozdiely));
  assert.ok(v.rozdiely.some((r) => r.kod === 'prazdne' && r.pocet === 1), JSON.stringify(v.rozdiely));
  assert.deepEqual(v.neprenesene, []);
});

test('(e) rozne kody oslobodenia, ktore formular neudrzi, su povedane', () => {
  const f = fakturaSk();
  f.polozky = [
    { nazov: 'A', mnozstvo: 1, jednotka: 'C62', cena: 10, sadzba: 0, kategoria: 'E', dovodOslobodenia: 'Par. 37' },
    { nazov: 'B', mnozstvo: 1, jednotka: 'C62', cena: 10, sadzba: 0, kategoria: 'AE' }
  ];
  const xml = vytvorUbl(f).replace('<cbc:TaxExemptionReason>Par. 37</cbc:TaxExemptionReason>', '<cbc:TaxExemptionReasonCode>VATEX-EU-132</cbc:TaxExemptionReasonCode><cbc:TaxExemptionReason>Par. 37</cbc:TaxExemptionReason>');
  const v = zUbl(xml, { jazyk: 'sk' });
  assert.equal(v.faktura.kodOslobodenia, undefined, 'dva rozne kody sa do jedneho pola nezmestia');
  assert.ok(v.neprenesene.some((x) => x.kod.endsWith('cbc:TaxExemptionReasonCode')), JSON.stringify(v.neprenesene));
});

// ---------------------------------------------------------------- (f) nebezpecny vstup

/** Maly DOM bez prehliadaca. innerHTML hned zlyha, aby test odhalil kazde jeho pouzitie. */
function malyDom() {
  const vyrob = (meno) => ({
    meno, className: '', id: '', type: '', deti: [], atr: {}, posluchaci: {}, _text: '',
    appendChild(d) { this.deti.push(d); return d; },
    setAttribute(k, v) { this.atr[k] = String(v); },
    addEventListener(t, f) { this.posluchaci[t] = f; },
    set textContent(v) { this._text = String(v); this.deti = []; },
    get textContent() { return this._text + this.deti.map((d) => d.textContent).join(''); },
    set innerHTML(v) { throw new Error('innerHTML sa v poznamke nesmie pouzit'); },
    get innerHTML() { throw new Error('innerHTML sa v poznamke nesmie pouzit'); }
  });
  return { createElement: vyrob, createTextNode: (t) => { const u = vyrob('#text'); u.textContent = t; return u; } };
}

/** Zdroj jednej pomenovanej funkcie z app.js aj s telom (ako v platba.test.mjs). */
function zdrojFunkcie(meno) {
  const od = APP.indexOf('function ' + meno + '(');
  assert.ok(od > 0, 'app.js: funkcia ' + meno + ' sa nenasla');
  let hlbka = 0;
  for (let j = APP.indexOf('{', od); j < APP.length; j++) {
    if (APP[j] === '{') hlbka += 1;
    else if (APP[j] === '}') { hlbka -= 1; if (hlbka === 0) return APP.slice(od, j + 1); }
  }
  throw new Error('app.js: telo funkcie ' + meno + ' sa neskoncilo');
}

/** Objekt T zo vsetkych styroch jazykov, rovnako ako v tests.mjs (test 35). */
function textyApp() {
  const zac = APP.indexOf('const T = {');
  const kon = APP.indexOf('}[LANG];', zac);
  const tvar3 = (n, jeden, malo, vela) => (n === 1 ? jeden : n >= 2 && n <= 4 ? malo : vela);
  const tvar2 = (n, jeden, viac) => (n === 1 ? jeden : viac);
  return new Function('tvar2', 'tvar3', 'return ' + APP.slice(zac + 'const T = '.length, kon + 1))(tvar2, tvar3);
}

test('(f) znacky a velmi dlhe retazce prejdu ako text: v datach cele, v XML escapovane, v poznamke skratene', () => {
  const f = fakturaSk();
  f.polozky[0].nazov = '<img src=x onerror=alert(1)>';
  f.dodavatel.nazov = '"><svg onload=alert(1)>';
  f.poznamka = '<script>alert(1)</script>' + 'x'.repeat(200000);
  const xml = vytvorUbl(f).replace('  <cbc:BuyerReference>OBJ-1</cbc:BuyerReference>\n',
    '  <cbc:BuyerReference>OBJ-1</cbc:BuyerReference>\n  <cbc:AccountingCost>&lt;b onclick="x()"&gt;' + 'A'.repeat(100000) + '&lt;/b&gt;</cbc:AccountingCost>\n');
  const v = zUbl(xml, { jazyk: 'sk' });
  assert.equal(v.ok, true);
  // data sa nemenia ani neskracuju (skratit sa smie len zobrazenie)
  assert.equal(v.faktura.polozky[0].nazov, '<img src=x onerror=alert(1)>');
  assert.equal(v.faktura.dodavatel.nazov, '"><svg onload=alert(1)>');
  assert.equal(v.faktura.poznamka.length, f.poznamka.length);
  const nove = vytvorUbl(v.faktura);
  assert.ok(nove.includes('&lt;img src=x onerror=alert(1)&gt;') && !nove.includes('<img'), 'XML nie je escapovane');
  assert.ok(nove.includes('&lt;script&gt;') && !nove.includes('<script>'));
  assert.equal(parsujXml(nove).ok, true);
  const nezname = v.neprenesene.find((x) => x.kod === 'cbc:AccountingCost');
  assert.ok(nezname && nezname.priklad.startsWith('<b onclick="x()">'), JSON.stringify(v.neprenesene).slice(0, 200));

  // poznamka z app.js: len el() a textContent, nic ako HTML, dlhe hodnoty skratene
  const dok = malyDom();
  const el = new Function('document', zdrojFunkcie('el') + '\nreturn el;')(dok);
  const T = textyApp().sk;
  const postav = new Function('el', 'T', 'skrat', zdrojFunkcie('postavPoznamkuPrenosu') + '\nreturn postavPoznamkuPrenosu;')(el, T, skrat);
  const poz = el('div', 'prenos');
  v.rozdiely.push({ druh: 'zmena', kod: 'x', text: 'názov položky', veta: '', pocet: 1, vSubore: '<img src=x onerror=alert(1)>' + 'y'.repeat(5000), formular: 'z'.repeat(5000) });
  postav(poz, v, v.faktura.polozky.length, true);
  const text = poz.textContent;
  assert.ok(text.includes('<b onclick="x()">'), 'znacka sa ma ukazat ako obycajny text');
  assert.ok(text.includes('<img src=x onerror=alert(1)>'));
  const polozky = [];
  const chod = (u) => { if (u.meno === 'li') polozky.push(u.textContent); u.deti.forEach(chod); };
  chod(poz);
  assert.ok(polozky.length >= 2);
  for (const t of polozky) assert.ok(t.length < 300, 'polozka poznamky je dlha ' + t.length + ' znakov');
  assert.ok(text.includes(T.prenosCena(true)));

  // ziadna cast prenosu nepise HTML
  for (const meno of ['tlacidloDoFormulara', 'doFormulara', 'ukazPrenos', 'postavPoznamkuPrenosu', 'kontrolaFormulara', 'zrusPrenos', 'doplnNeznamu']) {
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(zdrojFunkcie(meno)), meno + ' pise HTML');
  }
});

test('(f) skrat necha kratky text a z dlheho ukaze zaciatok aj koniec', () => {
  assert.equal(skrat('SK31'), 'SK31');
  const dlhy = 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_2.3';
  const s = skrat(dlhy);
  assert.equal(s.length, 60);
  assert.ok(s.startsWith('urn:cen.eu') && s.endsWith('xrechnung_2.3') && s.includes('…'), s);
  assert.equal(skrat(null), '');
});

// ---------------------------------------------------------------- tlacidlo a texty v app.js

test('tlacidlo je pri chybach aj bez chyb, s inym textom, a spusti sa z vysledku kontroly', () => {
  const dok = malyDom();
  const el = new Function('document', zdrojFunkcie('el') + '\nreturn el;')(dok);
  const T = textyApp().de;
  let volane = null;
  const tlacidlo = new Function('el', 'T', 'doFormulara', zdrojFunkcie('tlacidloDoFormulara') + '\nreturn tlacidloDoFormulara;')(el, T, (text, n) => { volane = [text, n]; });
  const sChybami = tlacidlo(2, '<Invoice/>');
  assert.equal(sChybami.deti[0].textContent, 'Im Formular öffnen und korrigieren');
  assert.ok(sChybami.deti[0].className.includes('btn-solid'));
  assert.equal(sChybami.deti[0].id, 'do-formulara');
  assert.equal(sChybami.deti[1].textContent, T.doFormularaPomoc);
  sChybami.deti[0].posluchaci.click();
  assert.deepEqual(volane, ['<Invoice/>', 2]);
  const bez = tlacidlo(0, '<Invoice/>');
  assert.equal(bez.deti[0].textContent, 'Im Formular bearbeiten');
  assert.ok(bez.deti[0].className.includes('btn-line'));
  // tlacidlo sa kresli v spustiKontrolu hned pod suhrnom, len pre UBL (Invoice alebo CreditNote)
  const kontrola = zdrojFunkcie('spustiKontrolu');
  assert.ok(kontrola.includes('if (bezaliPravidla) cielSumar.appendChild(tlacidloDoFormulara(s.chyby, xmlText));'));
  assert.ok(APP.includes("track('efaktura_do_formulara', { chyby: pocetChyb,"), 'udalost Umami chyba');
  assert.ok(APP.includes("import { zUbl, skrat } from './z-ubl.mjs';"));
});

test('texty prenosu su vo vsetkych styroch jazykoch, bez pomlciek a s cenami z tlacidiel platby', () => {
  const T = textyApp();
  const NOVE = ['doFormulara', 'doFormularaBezChyb', 'doFormularaPomoc', 'prepisatNavrh', 'prenosNejde', 'prenosNadpis',
    'prenosPrenieslo', 'prenosVsetko', 'prenosNeprenieslo', 'prenosRozdiely', 'prenosVSubore', 'prenosDoplni',
    'prenosDalsie', 'prenosSkryte', 'prenosPrazdne', 'prenosKontrola', 'prenosCena', 'opravaZostava'];
  const cena = (s) => (s.match(/\d+[.,]\d{2} €/) || [''])[0];
  for (const jazyk of JAZYKY) {
    const t = T[jazyk];
    for (const k of NOVE) {
      const hodnoty = typeof t[k] === 'function' ? [t[k](1, 'b'), t[k](3, 'b'), t[k](true), t[k](false)] : [t[k]];
      for (const h of hodnoty) {
        assert.equal(typeof h, 'string', jazyk + '.' + k);
        assert.ok(h.trim().length > 0, jazyk + '.' + k + ' je prazdne');
        assert.ok(!/[–—]/.test(h), jazyk + '.' + k + ' ma pomlcku: ' + h);
      }
    }
    const jedna = cena(t.kupaJedna);
    const trid = cena(t.kupa30);
    assert.ok(jedna && trid, jazyk + ': ceny v tlacidlach platby sa nenasli');
    assert.ok(t.prenosCena(true).includes(jedna) && t.prenosCena(true).includes(trid), jazyk + ': cena v poznamke nesedi s tlacidlami platby');
    assert.ok(t.doFormularaPomoc.includes(jedna), jazyk + ': cena pod tlacidlom nesedi');
  }
  assert.ok(!/[–—]/.test(ZUBL_ZDROJ), 'z-ubl.mjs ma pomlcku');
});
