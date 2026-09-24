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

/* Netesniaca brána (ops/stripe/zmena-cien-2026-09-22.md, časť 6). Do 24. 9.
 * sa odomknutie ukladalo s t: Date.now() v okamihu OVERENIA, takže každé
 * otvorenie návratového odkazu (stránka ho sama ponúka aj s mailto) spustilo
 * 24 hodín alebo 30 dní odznova: jedna platba 2,90 € bola trvalá licencia.
 * Platnosť sa odteraz počíta od created zo Stripe session, ktoré vracia worker. */
const PLATNOST = { jedna: 24 * 3600 * 1000, '30dni': 30 * 86400 * 1000 };
const zaciatokPlatnosti = new Function(
  zdrojFunkcie('zaciatokPlatnosti') + '\nreturn zaciatokPlatnosti;')();
const platnostDo = new Function('PLATNOST',
  zdrojFunkcie('platnostDo') + '\nreturn platnostDo;')(PLATNOST);

test('platnosť začína časom platby zo Stripe (created), nie okamihom overenia', () => {
  const zaplatene = Date.UTC(2026, 8, 20, 10, 0, 0);
  const teraz = Date.UTC(2026, 8, 24, 10, 0, 0);
  assert.equal(zaciatokPlatnosti({ created: zaplatene / 1000 }, teraz), zaplatene);
});

test('návratový odkaz otvorený po 25 hodinách už 24-hodinové odomknutie neobnoví', () => {
  const zaplatene = Date.UTC(2026, 8, 20, 10, 0, 0);
  const teraz = zaplatene + 25 * 3600 * 1000;
  const t = zaciatokPlatnosti({ created: zaplatene / 1000 }, teraz);
  assert.ok(platnostDo(t, 'jedna') < teraz, 'jedna platba 2,90 € sa znova odomkla na ďalších 24 hodín');
  // Počas platnosti sa odomkne normálne, v inom prehliadači tiež.
  const skoro = zaplatene + 23 * 3600 * 1000;
  assert.ok(platnostDo(zaciatokPlatnosti({ created: zaplatene / 1000 }, skoro), 'jedna') > skoro);
});

test('30 dní platí od platby: na 31. deň odkaz neodomkne, na 29. áno', () => {
  const zaplatene = Date.UTC(2026, 8, 1, 8, 0, 0);
  const st = { created: zaplatene / 1000 };
  const den = 86400 * 1000;
  assert.ok(platnostDo(zaciatokPlatnosti(st, zaplatene + 31 * den), '30dni') < zaplatene + 31 * den);
  assert.ok(platnostDo(zaciatokPlatnosti(st, zaplatene + 29 * den), '30dni') > zaplatene + 29 * den);
});

test('čas z budúcnosti platnosť nepredĺži, chýbajúci created (starší worker) berie okamih overenia', () => {
  const teraz = Date.UTC(2026, 8, 24, 12, 0, 0);
  assert.equal(zaciatokPlatnosti({ created: teraz / 1000 + 86400 }, teraz), teraz, 'created v budúcnosti');
  assert.equal(zaciatokPlatnosti({}, teraz), teraz);
  assert.equal(zaciatokPlatnosti({ created: null }, teraz), teraz);
  assert.equal(zaciatokPlatnosti({ created: 'x' }, teraz), teraz);
  assert.equal(zaciatokPlatnosti(null, teraz), teraz);
});

test('app.js ukladá odomknutie s časom platby a po skončení platnosti nič neuloží', () => {
  assert.ok(!APP.includes("uloz('efaktura:zaplatene', { session: sid, t: Date.now()"),
    'odomknutie sa stále ukladá s časom overenia, odkaz ho obnovuje donekonečna');
  assert.ok(APP.includes('const t = zaciatokPlatnosti(st, teraz);'), 'overPlatbu nepočíta začiatok platnosti z platby');
  assert.ok(APP.includes('if (teraz >= platnostDo(t, typ))'), 'overPlatbu nekontroluje, či platnosť už skončila');
  assert.equal((APP.match(/platnostSkoncila: \(d\) =>/g) || []).length, 4, 'veta o skončenej platnosti nie je vo všetkých štyroch jazykoch');
});

test('testovaciu platbu, ktorú worker odmietol (test_disabled), stránka neopakuje a povie to', () => {
  assert.ok(APP.includes("if (st && st.reason === 'test_disabled') {"), 'odmietnutý test by sa overoval dookola ako oneskorená platba');
  assert.equal((APP.match(/testZakazany: '/g) || []).length, 4, 'veta testZakazany nie je vo všetkých štyroch jazykoch');
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
