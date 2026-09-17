/* Puzzle Post: predplatne mesacneho cisla hlavolamov.
 *
 * Na server neodchadza nic okrem overenia platby. Po navrate zo Stripe
 * (?session_id=...&plan=mesacne|rocne) sa worker spyta, ci je session
 * zaplatena a na aku sumu (GET /v1/kontrola/status, vracia paid,
 * amount_subtotal a livemode; ziadne osobne udaje). Rovnaky koncovy bod aj
 * rovnake spravanie ako products/arling-sk/puzzle-books/app.js.
 *
 * Rozdiel proti puzzle-books: tu sa nic neodomyka. Subory nie su na stranke,
 * chodia e-mailom z dorucovania (products/licence-service). Stranka po navrate
 * povie jedinu vec, ktora je pravdiva: platba presla, cislo pride e-mailom.
 * Preto tu nie je ziadny localStorage s odomknutim a ziadna mapa tajnych ciest.
 *
 * Zastupky odkazov: data-link a data-link-test v index.html su
 * {odkaz-mesacne}, {odkaz-rocne} a ich testove dvojicky, kym ich nedosadi
 * ops/puzzlepost/odkazy-do-stranky.mjs z ops/stripe/puzzle-post-odkazy.json.
 * Kym tam stoji zastupka, tlacidlo nikam nevedie a povie to nahlas; nikdy sa
 * nepresmeruje na nieco, co nie je odkaz Stripe.
 *
 * Udalosti do Umami (ak bezi): cena_videna, kupa_click, ukazka a k tomu
 * zaplatene. cena_videna a kupa_click maju spolocne meno s ostatnymi
 * produktmi kvoli reportu EUR na 100 navstev.
 */

import { posudPlatbu, cestaSuboru, platnyOdkaz, jeOdomknuty, odomkni, vykresliSubory, T as TT } from '../titul.js';

const API = 'https://arling-asistent.arling.workers.dev';

/* Jedno cislo bez predplatneho (4,90 EUR). Kupuje sa tym istym vzorom ako
   knihy hlavolamov: platobny odkaz Stripe, navrat s ?titul=...&session_id=...,
   overenie cez workera a potom odkazy na PDF pod neuhadnutelnym nazvom.

   Nazvy suborov su kopia ops/puzzlepost/tajne-cesty.json. Ked sa tam kluciky
   pregeneruju alebo pribudne dalsie cislo, musia sa prepisat aj tu, inak odkazy
   po zaplateni skoncia na 404. Kontroluje to test
   products/arling-sk/puzzle-post/cislo.test.mjs. */
const CISLO_ID = 'puzzle-post-2026-10';
const CENA_CISLA = 490;
const CISLO = {
  cesta: 'issues/',
  subory: [
    { file: 'puzzle-post-2026-10-eink-tzezxnaxbisjlg3o.pdf', format: 'eink', nazov: 'e-ink PDF, 157 x 210 mm', popis: '145 pages, 4.05 MB' },
    { file: 'puzzle-post-2026-10-a4-gijwli2vtjd4halo.pdf', format: 'a4', nazov: 'A4 PDF', popis: '145 pages, 4.19 MB' },
    { file: 'puzzle-post-2026-10-letter-qmycwomoyvectuir.pdf', format: 'letter', nazov: 'US Letter PDF', popis: '145 pages, 4.13 MB' },
  ],
};

/* Centy pred zlavovym kodom. Musia sediet s ops/stripe/puzzle-post.mjs. */
const CENY = { mesacne: 390, rocne: 2900 };
const NAJMENSIA = Math.min(CENY.mesacne, CENY.rocne);

const CAKAJUCA = 'post:cakajuca';

const T = {
  overujem: 'Checking the payment',
  zaplatene: '<b>Paid, check your e-mail.</b> The download links for the current issue are on their way to the address you paid with. The next issue arrives on the first of the month.',
  nedoslo: 'If nothing arrives within a few minutes, look in the spam folder and then write to andrej@arling.sk with the order number from the Stripe e-mail.',
  inaSuma: 'The payment went through, but not for an amount we recognise. Write to andrej@arling.sk and we will sort it out by hand.',
  nepotvrdene: 'We have not been able to confirm the payment yet. We keep trying; if you paid, this line changes as soon as Stripe answers. If it takes longer than a few minutes, write to andrej@arling.sk with the order number from the Stripe e-mail.',
  overZnova: 'Check again',
  zapina: 'The subscription is still being switched on. Write to andrej@arling.sk and we will send you the current issue.',
  testChyba: 'Test mode is on, but this plan has no test link yet. Run ops/stripe/puzzle-post.mjs --zapis in test mode, or open this page without ?test=1 to subscribe for real.',
  testCudzi: 'This is a payment from Stripe test mode. Nothing was paid and no issue is sent.',
  testPoznamka: '(Test mode: the payment was made in Stripe test mode, no money changed hands and no issue is sent.)',
};

function $(id) { return document.getElementById(id); }
function track(name, data) { try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, data); } catch (e) { /* nic */ } }
function nacitaj(k) { try { const s = sessionStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function uloz(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bez uloziska to bezi dalej */ } }
function zabudni(k) { try { sessionStorage.removeItem(k); } catch (e) { /* nic */ } }

const stavPlatby = $('stav-platby');

/* Test mod: ?test=1 prepne tento prehliadac na Stripe test mod (nacvik,
   testovacia karta 4242..., ziadne peniaze). Tlacidla potom idu na
   data-link-test a navrat s cs_test_... sa prijme len v tomto prehliadaci. */
function testRezim() {
  try {
    if (new URL(location.href).searchParams.get('test') === '1') sessionStorage.setItem('post:test', '1');
    return sessionStorage.getItem('post:test') === '1';
  } catch (e) { return false; }
}
function odkazNaKupu(btn) {
  const u = (testRezim() ? btn.dataset.linkTest : btn.dataset.link) || '';
  return u.startsWith('https://') ? u : '';
}

/* Odznak sa ukaze len v testovom rezime, aby nikto nepovazoval testovu
   platbu za skutocnu. V zivom rezime ostava schovany. */
(function ukazTestOdznak() {
  const el = $('test-odznak');
  if (el) el.hidden = !testRezim();
  /* Test mod: tlacidla predplatneho su na zivej stranke skryte (hidden) do konca testu;
     s ?test=1 sa ukazu, aby sa dal spravit skusobny nakup bez penazi. */
  if (testRezim()) for (const b of document.querySelectorAll('#kupit-mesacne, #kupit-rocne')) b.hidden = false;
})();

for (const btn of document.querySelectorAll('[data-plan]')) {
  btn.addEventListener('click', () => {
    const plan = btn.dataset.plan;
    track('kupa_click', { plan: plan, cena: CENY[plan] || 0, produkt: 'puzzle-post' });
    const u = odkazNaKupu(btn);
    if (!u) {
      stavPlatby.textContent = testRezim() ? T.testChyba : T.zapina;
      stavPlatby.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    location.href = u;
  });
}
for (const a of document.querySelectorAll('a[data-ukazka]')) {
  a.addEventListener('click', () => track('ukazka', { kde: a.dataset.ukazka, produkt: 'puzzle-post' }));
}

/* Cena videna: spolocne meno s ostatnymi produktmi (report EUR na 100 navstev). */
(function sledujCenu() {
  const el = $('price');
  if (!el || typeof IntersectionObserver !== 'function') return;
  const io = new IntersectionObserver((z) => {
    for (const e of z) if (e.isIntersecting) { track('cena_videna', { produkt: 'puzzle-post' }); io.disconnect(); }
  }, { threshold: 0.4 });
  io.observe(el);
})();

/* Po navrate zo Stripe. Kym odpoved nie je jasne ano alebo jasne nie, session
   ostava v sessionStorage, aby sa pri vypadku siete alebo obnoveni stranky
   nestratila. */
let overovanie = null;
async function overPlatbu(sid, plan, pokus) {
  stavPlatby.textContent = T.overujem + (pokus > 1 ? ' (' + pokus + ')' : '');
  let st = null, siet = false;
  try {
    const r = await fetch(API + '/v1/kontrola/status?session_id=' + encodeURIComponent(sid));
    if (r.ok) st = await r.json();
    else if (r.status >= 500 || r.status === 429) siet = true;
  } catch (e) { siet = true; }
  // Suma pred zlavovym kodom; starsi worker ju neposiela, vtedy plati amount_total.
  const zaklad = st && typeof st.amount_subtotal === 'number' ? st.amount_subtotal : st && st.amount_total;
  if (st && st.paid) {
    const jeTest = st.livemode === false;
    const treba = CENY[plan] || NAJMENSIA;
    if (typeof zaklad === 'number' && zaklad >= treba) {
      zabudni(CAKAJUCA);
      stavPlatby.innerHTML = T.zaplatene + (jeTest ? ' ' + T.testPoznamka : '') + ' ' + T.nedoslo;
      track('zaplatene', { plan: plan || '', test: jeTest, produkt: 'puzzle-post' });
      return true;
    }
    zabudni(CAKAJUCA);
    stavPlatby.textContent = T.inaSuma;
    return false;
  }
  if (st && !st.paid && !siet) {
    // Stripe odpovedal, ze zaplatene nie je. Checkout vracia spat az po
    // uspesnej platbe, takze je to skoro vzdy oneskorenie; cakame dalej.
    siet = true;
  }
  uloz(CAKAJUCA, { session: sid, plan: plan || '', t: Date.now() });
  const dalsi = Math.min(30000, 3000 * pokus);
  stavPlatby.innerHTML = T.nepotvrdene + '<br><button type="button" class="btn btn-line" id="over-znova">' + T.overZnova + '</button>';
  const btn = $('over-znova');
  if (btn) btn.addEventListener('click', () => { clearTimeout(overovanie); overPlatbu(sid, plan, 1); });
  if (pokus < 8) overovanie = setTimeout(() => overPlatbu(sid, plan, pokus + 1), dalsi);
  return false;
}

/* ── Jedno cislo ──────────────────────────────────────────────────────────
   Bezi vedla predplatneho na tej istej stranke, ale ma vlastny riadok stavu
   (#stav-cisla) aj vlastny blok odkazov (#cislo-hotovo), aby sa hlaska o
   predplatnom a hlaska o jednom cisle nikdy neprepisali navzajom. */
const stavCisla = $('stav-cisla');
const blokCisla = $('cislo-hotovo');

function prekresliCislo() {
  const hotovo = jeOdomknuty(CISLO_ID);
  if (blokCisla) {
    blokCisla.hidden = !hotovo;
    if (hotovo) vykresliSubory(blokCisla, CISLO);
  }
  for (const b of document.querySelectorAll('[data-titul="' + CISLO_ID + '"]')) b.hidden = hotovo;
}

for (const btn of document.querySelectorAll('[data-titul]')) {
  btn.addEventListener('click', () => {
    track('kupa_click', { titul: btn.dataset.titul, cena: CENA_CISLA, produkt: 'puzzle-post' });
    const u = platnyOdkaz(testRezim() ? btn.dataset.linkTest : btn.dataset.link);
    if (!u) {
      if (stavCisla) { stavCisla.textContent = testRezim() ? TT.testChyba : TT.zapina; stavCisla.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      return;
    }
    location.href = u;
  });
}

let overovanieCisla = null;
async function overCislo(sid, pokus) {
  if (stavCisla) stavCisla.textContent = TT.overujem + (pokus > 1 ? ' (' + pokus + ')' : '');
  let st = null;
  try {
    const r = await fetch(API + '/v1/kontrola/status?session_id=' + encodeURIComponent(sid));
    if (r.ok) st = await r.json();
  } catch (e) { /* siet, skusame dalej */ }
  const v = posudPlatbu(st, CENA_CISLA);
  if (v.stav === 'zaplatene') {
    odomkni(CISLO_ID, v.test);
    zabudni(CAKAJUCA);
    if (stavCisla) stavCisla.innerHTML = TT.zaplatene + (v.test ? ' ' + TT.testPoznamka : '');
    track('zaplatene', { titul: CISLO_ID, test: !!v.test, produkt: 'puzzle-post' });
    prekresliCislo();
    if (blokCisla) blokCisla.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }
  if (v.stav === 'inaSuma') {
    zabudni(CAKAJUCA);
    if (stavCisla) stavCisla.textContent = TT.inaSuma;
    return false;
  }
  uloz(CAKAJUCA, { session: sid, titul: CISLO_ID, t: Date.now() });
  if (stavCisla) {
    stavCisla.innerHTML = TT.nepotvrdene + '<br><button type="button" class="btn btn-line" id="over-cislo-znova">' + TT.overZnova + '</button>';
    const b = $('over-cislo-znova');
    if (b) b.addEventListener('click', () => { clearTimeout(overovanieCisla); overCislo(sid, 1); });
  }
  if (pokus < 8) overovanieCisla = setTimeout(() => overCislo(sid, pokus + 1), Math.min(30000, 3000 * pokus));
  return false;
}

async function poNavrate() {
  let sid = '', plan = '', titul = '';
  try {
    const q = new URL(location.href).searchParams;
    sid = q.get('session_id') || '';
    plan = q.get('plan') || '';
    titul = q.get('titul') || '';
  } catch (e) { /* nic */ }
  if (!CENY[plan]) plan = ''; // cudzi alebo chybajuci parameter plan
  testRezim(); // pred zahodenim dotazu: ?test=1 moze stat vedla session_id
  if (sid) history.replaceState(null, '', location.pathname);
  if (!sid) {
    const c = nacitaj(CAKAJUCA);
    if (c && c.session) { sid = c.session; plan = c.plan || ''; titul = c.titul || ''; }
  }
  if (!sid) return;
  // Navrat z nakupu jedneho cisla nesie titul; predplatne nesie plan.
  if (titul && titul !== CISLO_ID) return;
  if (sid.startsWith('cs_test_') && !testRezim()) {
    const el = titul ? stavCisla : stavPlatby;
    if (el) el.textContent = T.testCudzi;
    return;
  }
  if (titul === CISLO_ID) { overCislo(sid, 1); return; }
  overPlatbu(sid, plan, 1);
}

prekresliCislo();
poNavrate();
