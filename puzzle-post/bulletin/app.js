/* Puzzle Post Bulletin: tyzdenna strana hlavolamu pre tlacene bulletiny.
 *
 * Na server neodchadza nic okrem overenia platby. Po navrate zo Stripe
 * (?subscribed=1&session_id=...&plan=bulletin-mesacne|bulletin-rocne|
 * pro-mesacne|pro-rocne) sa worker spyta, ci je session zaplatena a na aku
 * sumu (GET /v1/kontrola/status, vracia paid, amount_subtotal a livemode;
 * ziadne osobne udaje). Rovnaky koncovy bod aj rovnake spravanie ako
 * products/arling-sk/puzzle-post/app.js.
 *
 * Tu sa nic neodomyka a ziadne subory na stranke nie su. Po overenej platbe sa
 * stranka spyta licencnej sluzby na odkazy tohto tyzdna
 * (GET /licence/api/purchase/links?session_id=cs_..., spolocny kod je v
 * /titul.js) a ked odpovie, ukaze panel "Your first sheet" so styrmi odkazmi.
 * Ked sluzba nebezi alebo este nie je nasadena, ostava povodna veta: platba
 * presla, prva strana pride e-mailom. Nic sa netvrdi bez dokazu.
 *
 * subscribed=1 bez session_id nie je dokaz o platbe (kazdy si tu adresu vie
 * napisat sam), preto v tom pripade stranka nepovie "zaplatene", ale len to,
 * ze e-mail je na ceste, ak sa platba naozaj stala.
 *
 * Zastupky odkazov: data-link a data-link-test v index.html su prazdne, kym
 * ich nedosadi ops/stripe/puzzle-post-bulletin.mjs --zapis. Kym su prazdne,
 * tlacidlo nikam nevedie a povie to nahlas; nikdy sa nepresmeruje na nieco,
 * co nie je odkaz Stripe.
 *
 * Udalosti do Umami (ak bezi): cena_videna, kupa_click, ukazka a zaplatene.
 * cena_videna a kupa_click maju spolocne meno s ostatnymi produktmi kvoli
 * reportu EUR na 100 navstev.
 */

import { odkazyZoSluzby, vykresliPanel } from '../../titul.js';

const API = 'https://arling-asistent.arling.workers.dev';

/* Centy pred zlavovym kodom. Musia sediet s ops/stripe/puzzle-post-bulletin.mjs. */
const CENY = { 'bulletin-mesacne': 1900, 'bulletin-rocne': 19000, 'pro-mesacne': 3900, 'pro-rocne': 39000 };
/* Vsetky styri sumy: ked navratova adresa plan nenesie, platba sa prijme len
   vtedy, ked sa rovna niektorej z nich. Ziadne "aspon tolko". */
const SUMY = Object.keys(CENY).map(function (k) { return CENY[k]; });

const CAKAJUCA = 'bulletin:cakajuca';

const T = {
  overujem: 'Checking the payment',
  zaplatene: '<b>Paid, check your e-mail.</b> The links for the current week are on their way to the address you paid with. The next sheet arrives on Monday.',
  nedoslo: 'If nothing arrives within a few minutes, look in the spam folder and then write to andrej@arling.sk with the order number from the Stripe e-mail.',
  bezSession: 'If you have just paid, the e-mail with this week’s links is on its way to the address you paid with. Nothing here confirms a payment on its own, so if no e-mail arrives within a few minutes, write to andrej@arling.sk.',
  inaSuma: 'The payment went through, but not for an amount we recognise. Write to andrej@arling.sk and we will sort it out by hand.',
  nepotvrdene: 'We have not been able to confirm the payment yet. We keep trying; if you paid, this line changes as soon as Stripe answers. If it takes longer than a few minutes, write to andrej@arling.sk with the order number from the Stripe e-mail.',
  overZnova: 'Check again',
  zapina: 'The subscription is still being switched on. Write to andrej@arling.sk and we will send you this week’s sheet.',
  testChyba: 'Test mode is on, but this plan has no test link yet. Run ops/stripe/puzzle-post-bulletin.mjs --zapis in test mode, or open this page without ?test=1 to subscribe for real.',
  testCudzi: 'This is a payment from Stripe test mode. No money was taken; the e-mail with this week’s sheet is sent in test mode too.',
  testPoznamka: '(Test mode: the payment was made in Stripe test mode, no money is taken; the e-mail with the sheet is sent in test mode too.)',
  prvaStrana: 'Your first sheet',
  tyzden: (t) => 'The files of week ' + t + '. Every following Monday they arrive by e-mail.',
};

function $(id) { return document.getElementById(id); }
function track(name, data) { try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, data); } catch (e) { /* nic */ } }
function nacitaj(k) { try { const s = sessionStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function uloz(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bez uloziska to bezi dalej */ } }
function zabudni(k) { try { sessionStorage.removeItem(k); } catch (e) { /* nic */ } }

const stavPlatby = $('stav-platby');
const blokPrvej = $('prva-strana');

/* Test mod: ?test=1 prepne tento prehliadac na Stripe test mod (nacvik,
   testovacia karta 4242..., ziadne peniaze). Tlacidla potom idu na
   data-link-test a navrat s cs_test_... sa prijme len v tomto prehliadaci. */
function testRezim() {
  try {
    if (new URL(location.href).searchParams.get('test') === '1') sessionStorage.setItem('bulletin:test', '1');
    return sessionStorage.getItem('bulletin:test') === '1';
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
})();

for (const btn of document.querySelectorAll('[data-plan]')) {
  btn.addEventListener('click', () => {
    const plan = btn.dataset.plan;
    track('kupa_click', { plan: plan, cena: CENY[plan] || 0, produkt: 'puzzle-post-bulletin' });
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
  a.addEventListener('click', () => track('ukazka', { kde: a.dataset.ukazka, produkt: 'puzzle-post-bulletin' }));
}

/* Cena videna: spolocne meno s ostatnymi produktmi (report EUR na 100 navstev). */
(function sledujCenu() {
  const el = $('price');
  if (!el || typeof IntersectionObserver !== 'function') return;
  const io = new IntersectionObserver((z) => {
    for (const e of z) if (e.isIntersecting) { track('cena_videna', { produkt: 'puzzle-post-bulletin' }); io.disconnect(); }
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
    // Presna suma z registra, nie "aspon tolko": inak by zaplatena kontrola za
    // 149 EUR alebo hocijaka drahsia session odomkla aj tuto stranku (nalez N1
    // auditu z 21. 9. 2026). Ked plan v adrese chyba, prijme sa ktorakolvek zo
    // styroch cien registra. livemode musi sediet s rezimom tohto prehliadaca:
    // testovaci rezim nikdy nepotvrdi zivu platbu a naopak.
    const sediSuma = typeof zaklad === 'number' && (plan ? zaklad === CENY[plan] : SUMY.includes(zaklad));
    if (sediSuma && st.livemode === !testRezim() && st.currency === 'eur') {
      zabudni(CAKAJUCA);
      stavPlatby.innerHTML = T.zaplatene + (jeTest ? ' ' + T.testPoznamka : '') + ' ' + T.nedoslo;
      track('zaplatene', { plan: plan || '', test: jeTest, produkt: 'puzzle-post-bulletin' });
      await ukazPrvuStranu(sid, jeTest);
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

/* Prva strana hned na stranke, ked licencna sluzba odpovie. Panel je ten isty
   ako pri jednorazovych tituloch, len s vlastnym nadpisom; ked sluzba nebezi,
   nestane sa nic a ostane veta o e-maile. */
async function ukazPrvuStranu(sid, jeTest) {
  if (!blokPrvej) return null;
  const zo = await odkazyZoSluzby(sid);
  if (!zo || !zo.subory.length) return null;
  vykresliPanel(blokPrvej, {
    nadpis: T.prvaStrana,
    poznamka: zo.tyzden ? T.tyzden(zo.tyzden) : '',
    subory: zo.subory,
    email: zo.email,
    // Veta o e-maile len ked to sluzba potvrdi (nalez N8 auditu z 21. 9. 2026).
    emailed: zo.emailed,
    session: sid,
    test: jeTest,
  });
  blokPrvej.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return zo;
}

async function poNavrate() {
  let sid = '', plan = '', prisiel = false;
  try {
    const q = new URL(location.href).searchParams;
    sid = q.get('session_id') || '';
    plan = q.get('plan') || '';
    prisiel = q.get('subscribed') === '1';
  } catch (e) { /* nic */ }
  if (!CENY[plan]) plan = ''; // cudzi alebo chybajuci parameter plan
  testRezim(); // pred zahodenim dotazu: ?test=1 moze stat vedla session_id
  if (sid || prisiel) history.replaceState(null, '', location.pathname);
  if (!sid) {
    const c = nacitaj(CAKAJUCA);
    if (c && c.session) { sid = c.session; plan = c.plan || ''; }
  }
  if (!sid) {
    // subscribed=1 sam o sebe nie je dokaz o platbe.
    if (prisiel) stavPlatby.textContent = T.bezSession;
    return;
  }
  if (sid.startsWith('cs_test_') && !testRezim()) { stavPlatby.textContent = T.testCudzi; return; }
  overPlatbu(sid, plan, 1);
}

poNavrate();
