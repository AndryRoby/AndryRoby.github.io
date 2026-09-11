/* Puzzle books: predaj desiatich kníh hlavolamov ako PDF.
 *
 * Na server neodchádza nič okrem overenia platby. Po návrate zo Stripe
 * (?session_id=...&book=<hra>) sa worker spýta, či je session zaplatená a na
 * akú sumu (GET /v1/kontrola/status, vracia paid, amount_subtotal a
 * livemode; žiadne osobné údaje). Odomknutie sa uloží do localStorage ako
 * books:zaplatene, aby sa knihy dali stiahnuť aj neskôr z toho istého
 * prehliadača.
 *
 * Vedomé zjednodušenie bez servera: PDF sú statické súbory na GitHub Pages
 * a chráni ich len neuhádnuteľný názov (16 znakov náhody z
 * ops/puzzle-books/tajne-cesty.json, mapa je nižšie ako CESTY). Odomknutie
 * ten odkaz len ukáže, nevyrobí ho. Kto si odkaz odloží alebo prečíta tento
 * súbor, dostane sa k PDF aj bez platby. Je to napísané aj v otázkach na
 * stránke, aby to nikoho neprekvapilo.
 *
 * Udalosti do Umami (ak beží) podľa ops/spec-puzzle-books.md: books_ukazka,
 * books_kupa_click, books_zaplatene, books_stiahnute; plus cena_videna, ktoré
 * majú spoločné meno s ostatnými produktmi kvôli reportu EUR na 100 návštev.
 */

const API = 'https://arling-asistent.arling.workers.dev';
const CENA_KNIHA = 490;   // centy, jedna kniha
const CENA_VSETKY = 1990; // centy, všetkých desať

/* Kópia ops/puzzle-books/tajne-cesty.json. Keď sa tam kľúče pregenerujú,
   treba ich prepísať aj tu, inak odkazy po zaplatení skončia na 404. */
const CESTY = {
  hedgehogs: 'awofzgxvhnmpe6er',
  magpies: 'ctgcdypfy7yjvi4z',
  otters: 'po2uoukvnwpzhofc',
  squirrels: 'rh04ihdltoe16t3p',
  cranes: '7mspsg4tyujtueib',
  swans: 'puvldxxrwrawatdf',
  voles: 'm4fliz722eczg9xs',
  badgers: 'kegarxuyqg8ftyx1',
  herons: 'bw9aautuf06mew6s',
  hares: 'txupryy9unfraopa',
};
const KNIHY = Object.keys(CESTY);

const KLUC = 'books:zaplatene';
const CAKAJUCA = 'books:cakajuca';

const T = {
  overujem: 'Checking the payment',
  zaplateneJedna: (n) => '<b>Paid, thank you.</b> ' + n + ' is unlocked in this browser and the download links are on its card below.',
  zaplateneVsetky: '<b>Paid, thank you.</b> All ten books are unlocked in this browser and the download links are on their cards below.',
  inaSuma: 'The payment went through, but not for an amount we recognise. Write to andrej@arling.sk and we will sort it out by hand.',
  nevieme: 'The payment went through, but we cannot tell which book it was for. Write to andrej@arling.sk with the order number from the Stripe e-mail and we will unlock it.',
  nepotvrdene: 'We have not been able to confirm the payment yet. We keep trying; if you paid, the books unlock as soon as Stripe answers. If it takes longer than a few minutes, write to andrej@arling.sk with the order number from the Stripe e-mail.',
  overZnova: 'Check again',
  zapina: 'Payment is still being switched on for this book. Write to andrej@arling.sk and we will send you the file.',
  testCudzi: 'This is a payment from Stripe test mode. It unlocks books only in the browser that started the test with ?test=1.',
  testPoznamka: '(Test mode: the payment was made in Stripe test mode, no money changed hands.)',
};

function $(id) { return document.getElementById(id); }
function track(name, data) { try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, data); } catch (e) { /* nič */ } }
function nacitaj(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function uloz(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bez úložiska to beží ďalej */ } }
function zabudni(k) { try { localStorage.removeItem(k); } catch (e) { /* nič */ } }

const stavPlatby = $('stav-platby');
const nazvy = {};
for (const li of document.querySelectorAll('li[data-kniha]')) nazvy[li.dataset.kniha] = li.dataset.nazov || li.dataset.kniha;

/* Stav odomknutia: { vsetky: bool, knihy: { hedgehogs: true, ... } } */
function stav() {
  const s = nacitaj(KLUC);
  if (!s || typeof s !== 'object') return { vsetky: false, knihy: {} };
  return { vsetky: !!s.vsetky, knihy: (s.knihy && typeof s.knihy === 'object') ? s.knihy : {}, test: !!s.test };
}
function odomknuta(kluc) { const s = stav(); return s.vsetky || !!s.knihy[kluc]; }
function odomkni(kluc, data) {
  const s = stav();
  if (kluc === 'all') s.vsetky = true; else s.knihy[kluc] = true;
  s.t = Date.now();
  if (data && data.test) s.test = true;
  uloz(KLUC, s);
}

function pdfOdkaz(kluc, format) { return 'pdf/' + kluc + '-' + format + '-' + CESTY[kluc] + '.pdf'; }

/* Odkazy na PDF sa stavajú až tu, nie v HTML: kým kniha nie je odomknutá,
   neuhádnuteľný názov na stránke nikde nestojí. */
function prekresli() {
  for (const li of document.querySelectorAll('li[data-kniha]')) {
    const kluc = li.dataset.kniha;
    const hotovo = odomknuta(kluc);
    const kup = li.querySelector('.kupit');
    const blok = li.querySelector('.stiahnut');
    if (kup) kup.hidden = hotovo;
    if (!blok) continue;
    blok.hidden = !hotovo;
    if (!hotovo) continue;
    for (const a of blok.querySelectorAll('a[data-format]')) {
      const f = a.dataset.format;
      if (a.getAttribute('href') !== pdfOdkaz(kluc, f)) a.setAttribute('href', pdfOdkaz(kluc, f));
    }
  }
  const s = stav();
  const vsetkyBtn = $('kupit-vsetky');
  const vsetkyHotovo = s.vsetky || KNIHY.every((k) => s.knihy[k]);
  if (vsetkyBtn) vsetkyBtn.hidden = vsetkyHotovo;
  const hlaska = $('cena-hotovo');
  if (hlaska) hlaska.hidden = !vsetkyHotovo;
}

/* Test mód: ?test=1 prepne tento prehliadač na Stripe test mód (nácvik,
   testovacia karta 4242..., žiadne peniaze). Tlačidlá potom idú na
   data-link-test a návrat s cs_test_... sa prijme len v tomto prehliadači. */
function testRezim() {
  try {
    if (new URL(location.href).searchParams.get('test') === '1') sessionStorage.setItem('books:test', '1');
    return sessionStorage.getItem('books:test') === '1';
  } catch (e) { return false; }
}
function odkazNaKupu(btn) {
  const u = (testRezim() ? btn.dataset.linkTest : btn.dataset.link) || '';
  return u && u.startsWith('https://') ? u : '';
}

for (const btn of document.querySelectorAll('[data-link]')) {
  btn.addEventListener('click', () => {
    const kniha = btn.dataset.kniha || 'all';
    track('books_kupa_click', { kniha: kniha, cena: kniha === 'all' ? CENA_VSETKY : CENA_KNIHA, produkt: 'books' });
    const u = odkazNaKupu(btn);
    if (!u) { stavPlatby.textContent = T.zapina; stavPlatby.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    location.href = u;
  });
}
for (const a of document.querySelectorAll('a[data-ukazka]')) {
  a.addEventListener('click', () => track('books_ukazka', { kniha: a.dataset.ukazka, produkt: 'books' }));
}
for (const a of document.querySelectorAll('a[data-format]')) {
  a.addEventListener('click', () => {
    const li = a.closest('li[data-kniha]');
    track('books_stiahnute', { kniha: li ? li.dataset.kniha : '', format: a.dataset.format, produkt: 'books' });
  });
}

/* Cena videná: spoločné meno s ostatnými produktmi (report EUR na 100 návštev). */
(function sledujCenu() {
  const el = $('cena');
  if (!el || typeof IntersectionObserver !== 'function') return;
  const io = new IntersectionObserver((z) => {
    for (const e of z) if (e.isIntersecting) { track('cena_videna', { produkt: 'books' }); io.disconnect(); }
  }, { threshold: 0.4 });
  io.observe(el);
})();

/* Po návrate zo Stripe: session_id hovorí, ktorá platba, book hovorí, čo sa
   kupovalo. Kým odpoveď nie je jasné áno alebo jasné nie, session ostáva v
   localStorage, aby sa pri výpadku siete alebo obnovení stránky nestratila. */
let overovanie = null;
async function overPlatbu(sid, kniha, test, pokus) {
  stavPlatby.textContent = T.overujem + (pokus > 1 ? ' (' + pokus + ')' : '');
  let st = null, siet = false;
  try {
    const r = await fetch(API + '/v1/kontrola/status?session_id=' + encodeURIComponent(sid));
    if (r.ok) st = await r.json();
    else if (r.status >= 500 || r.status === 429) siet = true;
  } catch (e) { siet = true; }
  // Suma pred zľavovým kódom; starší worker ju neposiela, vtedy platí amount_total.
  const zaklad = st && typeof st.amount_subtotal === 'number' ? st.amount_subtotal : st && st.amount_total;
  if (st && st.paid && typeof zaklad === 'number') {
    const jeTest = st.livemode === false;
    let ciel = kniha;
    // Bez parametra book sa dá spoľahlivo poznať len balík podľa sumy.
    if (!ciel && zaklad >= CENA_VSETKY) ciel = 'all';
    const treba = ciel === 'all' ? CENA_VSETKY : CENA_KNIHA;
    if (ciel && zaklad >= treba) {
      odomkni(ciel, { test: jeTest });
      zabudni(CAKAJUCA);
      stavPlatby.innerHTML = (ciel === 'all' ? T.zaplateneVsetky : T.zaplateneJedna(nazvy[ciel] || ciel)) + (jeTest ? ' ' + T.testPoznamka : '');
      track('books_zaplatene', { kniha: ciel, test: jeTest, produkt: 'books' });
      prekresli();
      const li = ciel === 'all' ? document.getElementById('knihy') : document.querySelector('li[data-kniha="' + ciel + '"]');
      if (li) li.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }
    zabudni(CAKAJUCA);
    stavPlatby.textContent = ciel ? T.inaSuma : T.nevieme;
    return false;
  }
  if (st && st.paid) { zabudni(CAKAJUCA); stavPlatby.textContent = T.inaSuma; return false; }
  if (st && !st.paid && !siet) {
    // Stripe odpovedal, že zaplatené nie je. Payment link vracia späť až po
    // úspešnej platbe, takže je to skoro vždy oneskorenie; čakáme ďalej.
    siet = true;
  }
  uloz(CAKAJUCA, { session: sid, kniha: kniha || '', test: !!test, t: Date.now() });
  const dalsi = Math.min(30000, 3000 * pokus);
  stavPlatby.innerHTML = T.nepotvrdene + ' <button type="button" class="btn btn-line" id="over-znova">' + T.overZnova + '</button>';
  const btn = $('over-znova');
  if (btn) btn.addEventListener('click', () => { clearTimeout(overovanie); overPlatbu(sid, kniha, test, 1); });
  if (pokus < 8) overovanie = setTimeout(() => overPlatbu(sid, kniha, test, pokus + 1), dalsi);
  return false;
}

async function poNavrate() {
  let sid = '', kniha = '';
  try {
    const q = new URL(location.href).searchParams;
    sid = q.get('session_id') || '';
    kniha = q.get('book') || '';
  } catch (e) { /* nič */ }
  if (kniha !== 'all' && !CESTY[kniha]) kniha = ''; // cudzí alebo chýbajúci parameter book
  const test = testRezim(); // pred zahodením dotazu: ?test=1 môže stáť vedľa session_id
  if (sid) history.replaceState(null, '', location.pathname);
  if (!sid) {
    const c = nacitaj(CAKAJUCA);
    if (c && c.session) {
      sid = c.session;
      kniha = c.kniha || '';
      if (c.test) { try { sessionStorage.setItem('books:test', '1'); } catch (e) { /* nič */ } }
      if (kniha && odomknuta(kniha)) return;
    }
  }
  if (!sid) return;
  if (sid.startsWith('cs_test_') && !testRezim()) { stavPlatby.textContent = T.testCudzi; return; }
  overPlatbu(sid, kniha, testRezim(), 1);
}

prekresli();
poNavrate();
