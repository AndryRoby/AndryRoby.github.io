/* Testy brány platby a testovacieho režimu e-faktúry.
 *
 * Prečo existuje: audit ops/stripe/audit-po-platbe-2026-09-21.md, nález N1.
 * Verejný parameter ?test=1 si vie zapnúť ktokoľvek, zaplatí kartou 4242 a
 * doteraz dostal ostré XML bez akéhokoľvek označenia. Od 21. 9. 2026 vydáva
 * testovací režim len výslovne označený testovací doklad.
 *
 * Čisté funkcie z app.js sa sem vyťahujú zo zdroja a spúšťajú v Node, takže sa
 * testuje presne ten kód, ktorý beží na stránke, bez prehliadača a bez siete.
 * usage: node --test products/arling-sk/efaktura/platba.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { vytvorUbl, prazdnaFaktura } from './ubl.js';
import { parsujXml } from './parser.mjs';

const TU = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(resolve(TU, 'app.js'), 'utf8');

/** Zdroj jednej pomenovanej funkcie z app.js aj s telom. */
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

const CENA_JEDNA = 290;
const CENA_30DNI = 990;
const jeNasaPlatba = new Function('CENA_JEDNA', 'CENA_30DNI',
  zdrojFunkcie('jeNasaPlatba') + '\nreturn jeNasaPlatba;')(CENA_JEDNA, CENA_30DNI);
const fakturaSTestomVPoznamke = new Function(
  zdrojFunkcie('fakturaSTestomVPoznamke') + '\nreturn fakturaSTestomVPoznamke;')();

test('ceny v app.js sú presne tie z registra ops/stripe/efaktura-odkazy.json', () => {
  assert.ok(APP.includes('const CENA_JEDNA = 290;'), 'cena jedného XML sa zmenila');
  assert.ok(APP.includes('const CENA_30DNI = 990;'), 'cena 30 dní sa zmenila');
});

test('živá platba na presnú sumu odomkne, každá iná suma nie', () => {
  const ziva = (suma) => jeNasaPlatba({ paid: true, livemode: true, currency: 'eur', amount_subtotal: suma }, false);
  assert.equal(ziva(290), 'jedna');
  assert.equal(ziva(990), '30dni');
  assert.equal(ziva(289), null);
  assert.equal(ziva(991), null);
  // Zaplatená kontrola za 149 € ani nič drahšie nesmie odomknúť e-faktúru.
  assert.equal(ziva(14900), null);
  assert.equal(ziva(3900), null, 'GDPR balík nie je e-faktúra');
});

test('iná mena neodomkne nič', () => {
  assert.equal(jeNasaPlatba({ paid: true, livemode: true, currency: 'czk', amount_subtotal: 290 }, false), null);
  assert.equal(jeNasaPlatba({ paid: true, livemode: true, amount_subtotal: 290 }, false), null, 'chýbajúca mena nie je eur');
});

test('nezaplatená alebo prázdna odpoveď nie je platba', () => {
  assert.equal(jeNasaPlatba({ paid: false, livemode: true, currency: 'eur', amount_subtotal: 290 }, false), null);
  assert.equal(jeNasaPlatba(null, false), null);
  assert.equal(jeNasaPlatba({}, false), null);
});

test('livemode musí sedieť s režimom prehliadača, v oboch smeroch', () => {
  const st = { paid: true, currency: 'eur', amount_subtotal: 290 };
  // Testovacia session v ostrom režime: nič.
  assert.equal(jeNasaPlatba({ ...st, livemode: false }, false), null);
  // Živá session v testovacom režime: tiež nič.
  assert.equal(jeNasaPlatba({ ...st, livemode: true }, true), null);
  // A naopak, keď si zodpovedajú.
  assert.equal(jeNasaPlatba({ ...st, livemode: true }, false), 'jedna');
  assert.equal(jeNasaPlatba({ ...st, livemode: false }, true), 'jedna');
});

test('amount_subtotal má prednosť pred amount_total, aby zľavový kód nerozbil bránu', () => {
  assert.equal(jeNasaPlatba({ paid: true, livemode: true, currency: 'eur', amount_subtotal: 990, amount_total: 490 }, false), '30dni');
  assert.equal(jeNasaPlatba({ paid: true, livemode: true, currency: 'eur', amount_total: 290 }, false), 'jedna', 'starší worker posiela len amount_total');
});

test('testovacia platba dáva XML označené ako testovacie, vlastnú poznámku neprepíše', () => {
  const veta = 'TEST INVOICE: unlocked by a payment in Stripe test mode.';
  const bezPoznamky = fakturaSTestomVPoznamke({ cislo: 'A1' }, veta);
  assert.equal(bezPoznamky.poznamka, veta);
  assert.equal(bezPoznamky.cislo, 'A1', 'ostatné polia ostávajú');
  const sPoznamkou = fakturaSTestomVPoznamke({ poznamka: 'Ďakujeme za objednávku' }, veta);
  assert.equal(sPoznamkou.poznamka, veta + ' Ďakujeme za objednávku');
  // Pôvodný objekt sa nemení, takže sa neoznačí ani to, čo je na obrazovke.
  const f = { poznamka: 'pôvodná' };
  fakturaSTestomVPoznamke(f, veta);
  assert.equal(f.poznamka, 'pôvodná');
});

test('označenie sa v hotovom XML naozaj objaví v cbc:Note', () => {
  const veta = 'TEST INVOICE: unlocked by a payment in Stripe test mode, no money changed hands.';
  const f = prazdnaFaktura();
  f.cislo = 'TESTFA-1';
  const xml = vytvorUbl(fakturaSTestomVPoznamke(f, veta), { profil: 'peppol', jazyk: 'en' });
  assert.equal(parsujXml(xml).ok, true, 'označené XML musí ostať platné XML');
  assert.ok(xml.includes('<cbc:Note>' + veta + '</cbc:Note>'), 'veta o teste nie je v poznámke dokladu');
  // Ostré XML tú vetu nemá.
  assert.ok(!vytvorUbl(f, { profil: 'peppol', jazyk: 'en' }).includes('TEST INVOICE'));
});

test('app.js sťahuje v testovacom režime súbor s predponou TEST- a označeným XML', () => {
  assert.ok(APP.includes("const jeTest = testovyNakup();"), 'sťahovanie sa nepýta, či šlo o testovaciu platbu');
  assert.ok(APP.includes("const xml = jeTest ? oznacXmlAkoTest(faktura) : posledneXml;"), 'testovací režim stále sťahuje ostré XML');
  assert.ok(APP.includes("(jeTest ? 'TEST-' : '') + 'faktura-'"), 'názov testovacieho súboru nezačína na TEST-');
});

test('testovací nákup je len ten, ktorý odomkol testovací režim', () => {
  assert.ok(APP.includes('return !!odomknute() && testRezim();'), 'testovyNakup už neviaže test na odomknutie');
  // odomknute() žiada zhodu z.test s režimom aj predponu session id.
  assert.ok(APP.includes("z.test !== testRezim() || !z.session.startsWith(testRezim() ? 'cs_test_' : 'cs_live_')"),
    'odomknutie už neviaže session na režim prehliadača');
});

test('odkaz na návrat k nákupu nesie session id a v teste aj test=1', () => {
  const odkazNaNakup = new Function('nacitaj', 'location', 'URL',
    zdrojFunkcie('odkazNaNakup') + '\nreturn odkazNaNakup;');
  const adresa = 'https://arling.sk/efaktura/en/?session_id=cs_live_stare#cennik';
  const ziva = odkazNaNakup(() => ({ session: 'cs_live_abc123' }), { href: adresa }, URL)();
  assert.equal(ziva, 'https://arling.sk/efaktura/en/?session_id=cs_live_abc123');
  const testova = odkazNaNakup(() => ({ session: 'cs_test_abc123', test: true }), { href: adresa }, URL)();
  assert.equal(testova, 'https://arling.sk/efaktura/en/?session_id=cs_test_abc123&test=1');
  // Bez zaplatenia sa žiadny odkaz nevyrobí.
  assert.equal(odkazNaNakup(() => null, { href: adresa }, URL)(), '');
  assert.equal(odkazNaNakup(() => ({}), { href: adresa }, URL)(), '');
});
