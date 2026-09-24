/* Testy brány platby, testovacieho označenia a návratu k nákupu (GDPR balík).
 *
 * Prečo existuje: audit ops/stripe/audit-po-platbe-2026-09-21.md, nálezy N1
 * a N5. Brána porovnávala sumu cez >= a nekontrolovala livemode, takže balík
 * odomkla aj zaplatená kontrola za 149 € a každá testovacia platba; a kto
 * zaplatil v jednom prehliadači, nemal odtiaľ žiadnu cestu späť.
 *
 * Čisté kusy z app.js sa sem vyťahujú zo zdroja a spúšťajú v Node, takže sa
 * testuje presne ten kód, ktorý beží na stránke. Žiadny prehliadač, žiadna sieť.
 * usage: node --test products/arling-sk/gdpr-dokumenty/platba.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const TU = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(resolve(TU, 'app.js'), 'utf8');
/* Zoznam súm, ktoré balík odomykajú, sa číta zo zdroja app.js, nie sa sem
   prepisuje ručne: test má byť zrkadlo kódu, nie druhý názor. */
const CENY_CENTY = JSON.parse((APP.match(/const CENY_CENTY = (\[[^\]]*\]);/) || [, 'null'])[1]);

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

/* Podmienka brány stojí v overPlatbu ako jeden výraz. Vytiahne sa zo zdroja
   a spustí nad podstrčenými hodnotami, aby test nezapisoval vlastnú kópiu. */
const PODMIENKA = (() => {
  const od = APP.indexOf('if (st && st.paid && typeof zaklad === ');
  assert.ok(od > 0, 'app.js: podmienka brány platby sa nenašla');
  const koniec = APP.indexOf(') {', od);
  return APP.slice(od + 4, koniec);
})();
const brana = new Function('st', 'testRezim', 'CENY_CENTY', `
  const zaklad = st && typeof st.amount_subtotal === 'number' ? st.amount_subtotal : st && st.amount_total;
  return !!(${PODMIENKA});
`);
const prijme = (st, jeTest = false) => brana(st, () => jeTest, CENY_CENTY);

/* Zoznam smie obsahovať len cenu, ktorá je dnes na stránke (39 € z registra
   ops/stripe/gdpr-39-odkazy.json), a cenu 49 €, ktorá je pripravená na zmenu
   z 22. 9. 2026 (ops/stripe/zmena-cien-2026-09-22.md). Každé ďalšie číslo by
   znamenalo, že balík odomyká niečo, čo nie je tento balík. */
test('zoznam cien v app.js drží cenu z registra a nepúšťa nič navyše', () => {
  assert.deepEqual(CENY_CENTY, [3900, 4900], 'zoznam cien balíka sa zmenil');
  assert.ok(APP.includes('const CENA_CENTY = CENY_CENTY[0];'), 'cena pre meranie nie je prvá zo zoznamu');
});

test('živá platba na cenu zo zoznamu odomkne, iná suma nie', () => {
  const ziva = (suma) => prijme({ paid: true, livemode: true, currency: 'eur', amount_subtotal: suma });
  assert.equal(ziva(3900), true);
  assert.equal(ziva(4900), true, 'pripravená cena 49 € musí odomknúť hneď, ako ju Stripe vydá');
  assert.equal(ziva(3899), false);
  assert.equal(ziva(3901), false);
  assert.equal(ziva(4901), false);
  // Vedľajší účinok starého ">=": zaplatená kontrola za 149 € odomkla aj GDPR.
  assert.equal(ziva(14900), false);
  assert.equal(ziva(2900), false, 'oprava pain.001 nie je GDPR balík');
});

test('zľavový kód UCTOVNIK bránu nerozbije: porovnáva sa suma pred zľavou', () => {
  assert.equal(prijme({ paid: true, livemode: true, currency: 'eur', amount_subtotal: 3900, amount_total: 2900 }), true);
});

test('testovacia platba neodomkne ostrý balík a živá neodomkne testovací', () => {
  const st = { paid: true, currency: 'eur', amount_subtotal: 3900 };
  assert.equal(prijme({ ...st, livemode: false }, false), false, 'test v ostrom režime');
  assert.equal(prijme({ ...st, livemode: true }, true), false, 'živá v testovacom režime');
  assert.equal(prijme({ ...st, livemode: false }, true), true);
  assert.equal(prijme({ ...st, livemode: true }, false), true);
});

test('nezaplatená, prázdna alebo cudzia mena neodomkne nič', () => {
  assert.equal(prijme({ paid: false, livemode: true, currency: 'eur', amount_subtotal: 3900 }), false);
  assert.equal(prijme(null), false);
  assert.equal(prijme({ paid: true, livemode: true, currency: 'czk', amount_subtotal: 3900 }), false);
  assert.equal(prijme({ paid: true, livemode: true, amount_subtotal: 3900 }), false, 'chýbajúca mena nie je eur');
});

test('testovacia platba označí dokumenty ako testovacie', () => {
  const testovyNakup = new Function('nacitaj',
    zdrojFunkcie('testovyNakup') + '\nreturn testovyNakup;');
  assert.equal(testovyNakup(() => ({ session: 'cs_test_a', test: true }))(), true);
  assert.equal(testovyNakup(() => ({ session: 'cs_live_a' }))(), false);
  assert.equal(testovyNakup(() => ({ session: 'cs_live_a', test: false }))(), false);
  assert.equal(testovyNakup(() => null)(), false);
  // Pätka dokumentu aj názov súboru nesú označenie testu.
  assert.ok(APP.includes("(testovyNakup() ? ' ' + T.testVodoznak : '')"), 'pätka dokumentu nenesie vetu o teste');
  assert.ok(APP.includes("function subor(x) { return (testovyNakup() ? 'TEST-' : '')"), 'názov DOCX nezačína na TEST-');
  assert.ok(APP.includes("stiahni((testovyNakup() ? 'TEST-' : '') + 'gdpr-dokumenty-'"), 'názov ZIP nezačína na TEST-');
});

/* Od 21. 9. worker testovaciu platbu cudzej adresy odmieta (paid false,
   reason test_disabled). Stránka to predtým brala ako oneskorenie Stripe a
   osemkrát overovala s vetou „ak ste zaplatili, dokumenty sa odomknú“. */
test('testovaciu platbu, ktorú worker odmietol (test_disabled), stránka neopakuje a povie to', () => {
  assert.ok(APP.includes("if (st && st.reason === 'test_disabled') {"), 'odmietnutý test by sa overoval dookola');
  assert.ok(APP.indexOf("st.reason === 'test_disabled'") < APP.indexOf('if (st && !st.paid && !siet)'), 'kontrola dôvodu musí byť pred opakovaním');
  assert.equal((APP.match(/testZakazany: '/g) || []).length, 3, 'veta testZakazany nie je vo všetkých troch jazykoch');
});

test('veta o testovacom výtlačku je vo všetkých troch jazykoch', () => {
  assert.equal((APP.match(/testVodoznak:/g) || []).length, 3);
  for (const kus of ['TESTOVACÍ VÝTLAČOK', 'TESTOVACÍ VÝTISK', 'TESTAUSDRUCK']) {
    assert.ok(APP.includes(kus), 'chýba znenie ' + kus);
  }
});

test('odkaz na návrat k nákupu nesie session id a v teste aj test=1', () => {
  const odkazNaNakup = new Function('nacitaj', 'location', 'URL',
    zdrojFunkcie('odkazNaNakup') + '\nreturn odkazNaNakup;');
  const adresa = 'https://arling.sk/gdpr-dokumenty/cs/?session_id=cs_live_stare#stiahnut';
  assert.equal(odkazNaNakup(() => ({ session: 'cs_live_abc' }), { href: adresa }, URL)(),
    'https://arling.sk/gdpr-dokumenty/cs/?session_id=cs_live_abc');
  assert.equal(odkazNaNakup(() => ({ session: 'cs_test_abc', test: true }), { href: adresa }, URL)(),
    'https://arling.sk/gdpr-dokumenty/cs/?session_id=cs_test_abc&test=1');
  assert.equal(odkazNaNakup(() => null, { href: adresa }, URL)(), '');
});

test('obrazovka s odkazom hovorí pravdu o tom, kde dokument žije, a e-mail neposiela server', () => {
  assert.ok(APP.includes("mail.href = 'mailto:?subject='"), 'tlačidlo neotvára poštového klienta cez mailto:');
  assert.ok(!APP.includes('/v1/mail/'), 'na stránke nesmie byť odosielanie e-mailu zo servera');
  assert.equal((APP.match(/odkazPravda:/g) || []).length, 3, 'veta pravdy chýba v niektorom jazyku');
  for (const kus of ['len v tomto prehliadači', 'jen v tomto prohlížeči', 'nur in diesem Browser']) {
    assert.ok(APP.includes(kus), 'chýba znenie ' + kus);
  }
  assert.ok(APP.includes('postavOdkazSpat()'), 'obrazovka sa po odomknutí nestavia');
});
