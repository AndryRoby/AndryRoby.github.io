/* Puzzle books: predaj desiatich kníh hlavolamov ako PDF.
 *
 * Po návrate zo Stripe (?session_id=...&book=<hra>) sa worker spýta, či je
 * session zaplatená a na akú sumu (GET /v1/kontrola/status, vracia paid,
 * amount_subtotal a livemode; žiadne osobné údaje). Po kladnej odpovedi si
 * prehliadač zapamätá len číslo platby (localStorage books:relacie) a odkazy
 * na PDF si vypýta od licenčnej služby (GET /licence/api/purchase/links),
 * ktorá platbu overí v Stripe znova, podľa price id vie, ktorú knihu (alebo
 * všetkých desať) človek kúpil, a vráti podpísané odkazy s platnosťou 7 dní.
 * Pri každom ďalšom otvorení stránky sa pýta znova, takže odkazy sú čerstvé.
 * E-mail sa neposiela (tak to hovorí stránka aj obchod).
 *
 * Zlá správa prvá (25. 9. 2026): do vtedy tu stála mapa CESTY so 16-znakovými
 * kľúčikmi všetkých desiatich kníh a odkaz na PDF na GitHub Pages si stránka
 * skladala sama. Kto si otvoril tento súbor, stiahol si každú knihu bez platby.
 * Stránka odvtedy žiadnu cestu k PDF nepozná a náhradný odkaz nemá: keď služba
 * neodpovie, karta knihy povie, že odkazy sa nenačítali, dá tlačidlo Try again,
 * celé číslo platby a andrej@arling.sk. Čisté funkcie sú v knihy.js.
 *
 * Udalosti do Umami (ak beží) podľa ops/spec-puzzle-books.md: books_ukazka,
 * books_kupa_click, books_zaplatene, books_stiahnute; plus cena_videna, ktoré
 * majú spoločné meno s ostatnými produktmi kvôli reportu EUR na 100 návštev.
 */

import { API } from '../titul.js';
import {
  KNIHY, VSETKY, KLUC_RELACIE, KLUC_STARE, jeKniha, relacieZoZaznamu, pridajRelaciu,
  poradieRelacii, pokryta, stavKnihy, odkazyPlatby,
} from './knihy.js';

const CENA_KNIHA = 490;   // centy, jedna kniha
const CENA_VSETKY = 1990; // centy, všetkých desať

const CAKAJUCA = 'books:cakajuca';

const T = {
  overujem: 'Checking the payment',
  zaplateneJedna: (n) => '<b>Paid, thank you.</b> ' + n + ' is unlocked in this browser and the download links are on its card below.',
  zaplateneVsetky: '<b>Paid, thank you.</b> All ten books are unlocked in this browser and the download links are on their cards below.',
  zaplateneBezOdkazov: '<b>Paid, thank you.</b> The download links did not load just now. The card of the book below has a Try again button and the payment reference.',
  inaSuma: 'The payment went through, but not for an amount we recognise. Write to andrej@arling.sk and we will sort it out by hand.',
  nevieme: 'The payment went through, but the download links did not load just now, so this page cannot tell yet which book it was for. Wait a minute and press Try again. If nothing changes, write to andrej@arling.sk with the payment reference ',
  nepotvrdene: 'We have not been able to confirm the payment yet. We keep trying; if you paid, the books unlock as soon as Stripe answers. If it takes longer than a few minutes, write to andrej@arling.sk with the order number from the Stripe e-mail.',
  overZnova: 'Check again',
  zapina: 'Payment is still being switched on for this book. Write to andrej@arling.sk and we will send you the file.',
  testChyba: 'Test mode is on, but this book has no test link yet. Run ops/stripe/puzzle-books-test.mjs --zapis, or open this page without ?test=1 to buy it for real.',
  testCudzi: 'This is a payment from Stripe test mode. It unlocks books only in the browser that started the test with ?test=1.',
  testPoznamka: '(Test mode: the payment was made in Stripe test mode, no money changed hands.)',
  /* Karta knihy po zaplatení, kým nie sú odkazy. Nič sa nesľubuje okrem toho, čo vieme splniť. */
  zaplatene: 'Paid.',
  nacitavam: 'Loading your download links.',
  nenacitane: 'The download links did not load just now. Wait a minute and press Try again.',
  pomoc: 'If they still do not appear, write to andrej@arling.sk with the payment reference ',
  pomocKoniec: ' and we will send you the files.',
  znova: 'Try again',
  stareZnacka: 'Unlocked in this browser.',
  stare: 'The payment reference was not kept here, so this page cannot ask for the download links. Write to andrej@arling.sk with the order number from the Stripe e-mail and we will send you the files.',
};

function $(id) { return document.getElementById(id); }
function track(name, data) { try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, data); } catch (e) { /* nič */ } }
function nacitaj(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function uloz(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bez úložiska to beží ďalej */ } }
function zabudni(k) { try { localStorage.removeItem(k); } catch (e) { /* nič */ } }

const stavPlatby = $('stav-platby');
const nazvy = {};
for (const li of document.querySelectorAll('li[data-kniha]')) nazvy[li.dataset.kniha] = li.dataset.nazov || li.dataset.kniha;

/* Pôvodný obsah bloku .stiahnut každej karty (veta a dva odkazy bez adresy).
   Adresy doň dosadí až odpoveď licenčnej služby. */
const sablony = {};
for (const li of document.querySelectorAll('li[data-kniha]')) {
  const blok = li.querySelector('.stiahnut');
  if (blok) sablony[li.dataset.kniha] = blok.cloneNode(true);
}

let relacie = relacieZoZaznamu(nacitaj(KLUC_RELACIE));
const vysledky = {};

function stavy() {
  const stare = nacitaj(KLUC_STARE);
  const von = {};
  for (const k of KNIHY) von[k] = stavKnihy(k, { relacie, vysledky, stare });
  return von;
}

function tucne(text) { const b = document.createElement('b'); b.textContent = text; return b; }

function tlacidloZnova(sids) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn btn-line';
  b.textContent = T.znova;
  b.addEventListener('click', () => { b.disabled = true; nacitajOdkazy(sids); });
  return b;
}

/* Blok .stiahnut jednej karty podľa stavu z knihy.js. */
function vykresliKnihu(li, st) {
  const kniha = li.dataset.kniha;
  const blok = li.querySelector('.stiahnut');
  const kup = li.querySelector('[data-link]');
  const zamknuta = st.stav === 'zamknuta';
  if (kup) kup.hidden = !zamknuta;
  if (!blok) return;
  blok.hidden = zamknuta;
  if (zamknuta) return;
  blok.textContent = '';
  if (st.stav === 'odkazy') {
    const vzor = sablony[kniha];
    if (vzor) for (const uzol of Array.from(vzor.childNodes)) blok.appendChild(uzol.cloneNode(true));
    for (const a of blok.querySelectorAll('a[data-format]')) {
      const s = st.subory[a.dataset.format];
      if (s) { a.setAttribute('href', s.href); a.hidden = false; } else { a.removeAttribute('href'); a.hidden = true; }
    }
    return;
  }
  if (st.stav === 'caka') { blok.append(tucne(T.zaplatene), ' ' + T.nacitavam); return; }
  if (st.stav === 'chyba') {
    blok.append(tucne(T.zaplatene), ' ' + T.nenacitane + ' ', tlacidloZnova(st.relacie), ' ' + T.pomoc, tucne(st.relacie[0]), T.pomocKoniec);
    return;
  }
  blok.append(tucne(T.stareZnacka), ' ' + T.stare);
}

function prekresli() {
  const s = stavy();
  for (const li of document.querySelectorAll('li[data-kniha]')) vykresliKnihu(li, s[li.dataset.kniha] || { stav: 'zamknuta' });
  const vsetkyHotovo = KNIHY.every((k) => s[k].stav !== 'zamknuta');
  const vsetkyBtn = $('kupit-vsetky');
  if (vsetkyBtn) vsetkyBtn.hidden = vsetkyHotovo;
  // Hláška hovorí, že odkazy sú pri každej knihe, takže sa ukáže, až keď tam naozaj sú.
  const hlaska = $('cena-hotovo');
  if (hlaska) hlaska.hidden = !KNIHY.every((k) => s[k].stav === 'odkazy');
}

/* Odkazy od licenčnej služby pre platby v tomto prehliadači, jedna po druhej
   (služba má limit 10 dopytov za minútu na adresu). Balík všetkých ide prvý;
   platba, ktorej knihy už pokryla iná odpoveď, sa nepýta. `len` obmedzí dopyt
   na vymenované platby (tlačidlo Try again). Volania idú v rade za sebou. */
let bezi = null;
async function nacitajOdkazy(len = null) {
  while (bezi) { try { await bezi; } catch (e) { /* ďalej */ } }
  bezi = (async () => {
    for (const sid of poradieRelacii(relacie)) {
      if (len && !len.includes(sid)) continue;
      if (vysledky[sid] && vysledky[sid].ok) continue;
      if (pokryta(relacie[sid], vysledky)) continue;
      delete vysledky[sid];
      prekresli();
      vysledky[sid] = await odkazyPlatby(sid);
      prekresli();
    }
  })();
  try { await bezi; } finally { bezi = null; }
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

/* Odznak sa ukáže len v testovom režime, aby nikto nepovažoval testovú
   platbu za skutočnú. V živom režime ostáva schovaný. */
const VETA_ODZNAKU = 'Every buy button leads to Stripe test mode. Use the card 4242 4242 4242 4242, any future date and any CVC. No money is taken and nothing is ordered.';
/* V HTML je od 25. 9. 2026 len prázdny skrytý #test-odznak: skrytú vetu o test
   mode a karte 4242 čítali nástroje AI ako fakt o stránke (audit
   ops/audit/2026-09-25-celkovy/00-AUDIT.md, akcia 5). Text sa vloží až tu. */
function naplnOdznak(el, veta) {
  const d = el.ownerDocument;
  if (!d || el.firstChild) return;
  const b = d.createElement('b');
  b.textContent = 'Test mode';
  el.append(b, veta);
}
function ukazTestOdznak() {
  const el = $('test-odznak');
  if (!el) return;
  el.hidden = !testRezim();
  if (!el.hidden) naplnOdznak(el, VETA_ODZNAKU);
}
ukazTestOdznak();

for (const btn of document.querySelectorAll('[data-link]')) {
  btn.addEventListener('click', () => {
    const kniha = btn.dataset.kniha || VSETKY;
    track('books_kupa_click', { kniha: kniha, cena: kniha === VSETKY ? CENA_VSETKY : CENA_KNIHA, produkt: 'books' });
    const u = odkazNaKupu(btn);
    if (!u) { stavPlatby.textContent = testRezim() ? T.testChyba : T.zapina; stavPlatby.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    location.href = u;
  });
}
for (const a of document.querySelectorAll('a[data-ukazka]')) {
  a.addEventListener('click', () => track('books_ukazka', { kniha: a.dataset.ukazka, produkt: 'books' }));
}
/* Odkazy na PDF sa vykresľujú znova pri každej odpovedi služby, preto jeden
   poslucháč na celom zozname namiesto poslucháča na každom odkaze. */
const zoznamKnih = $('knihy');
if (zoznamKnih) {
  zoznamKnih.addEventListener('click', (e) => {
    const a = e.target && typeof e.target.closest === 'function' ? e.target.closest('a[data-format]') : null;
    if (!a || !a.getAttribute('href')) return;
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

/* Riadok stavu po zaplatení podľa toho, čo naozaj povedala služba. */
function hlaskaPoZaplateni(sid, jeTest) {
  const v = vysledky[sid];
  const poznamka = jeTest ? ' ' + T.testPoznamka : '';
  if (v && v.ok) {
    const knihy = KNIHY.filter((k) => v.knihy[k]);
    stavPlatby.innerHTML = (knihy.length === KNIHY.length ? T.zaplateneVsetky : T.zaplateneJedna(knihy.map((k) => nazvy[k] || k).join(', '))) + poznamka;
    return knihy;
  }
  if (relacie[sid] && relacie[sid].kniha) {
    stavPlatby.innerHTML = T.zaplateneBezOdkazov + poznamka;
    return relacie[sid].kniha === VSETKY ? [...KNIHY] : [relacie[sid].kniha];
  }
  // Kniha z návratovej adresy chýba a služba neodpovedala: tlačidlo a číslo platby sem.
  stavPlatby.textContent = '';
  stavPlatby.append(T.nevieme, tucne(sid), '. ');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn btn-line';
  b.textContent = T.znova;
  b.addEventListener('click', async () => { b.disabled = true; await nacitajOdkazy([sid]); hlaskaPoZaplateni(sid, jeTest); });
  stavPlatby.append(b);
  return [];
}

/* Po návrate zo Stripe: session_id hovorí, ktorá platba, book hovorí, čo sa
   kupovalo. Kým odpoveď workera nie je jasné áno alebo jasné nie, session
   ostáva v localStorage, aby sa pri výpadku siete alebo obnovení stránky
   nestratila. Ktoré knihy sa odomknú, rozhoduje nakoniec licenčná služba. */
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
  if (st && st.paid && typeof zaklad === 'number' && zaklad >= CENA_KNIHA) {
    const jeTest = st.livemode === false;
    let ciel = kniha;
    // Bez parametra book sa dá spoľahlivo poznať len balík podľa sumy; inak povie služba.
    if (!ciel && zaklad >= CENA_VSETKY) ciel = VSETKY;
    if (ciel === VSETKY && zaklad < CENA_VSETKY) ciel = '';
    relacie = pridajRelaciu(relacie, sid, ciel, jeTest);
    uloz(KLUC_RELACIE, relacie);
    zabudni(CAKAJUCA);
    track('books_zaplatene', { kniha: ciel || '?', test: jeTest, produkt: 'books' });
    prekresli();
    await nacitajOdkazy([sid]);
    const knihy = hlaskaPoZaplateni(sid, jeTest);
    const li = knihy.length > 1 ? $('knihy') : (knihy.length ? document.querySelector('li[data-kniha="' + knihy[0] + '"]') : null);
    if (li) li.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
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
  if (kniha !== VSETKY && !jeKniha(kniha)) kniha = ''; // cudzí alebo chýbajúci parameter book
  const test = testRezim(); // pred zahodením dotazu: ?test=1 môže stáť vedľa session_id
  if (sid) history.replaceState(null, '', location.pathname);
  if (!sid) {
    const c = nacitaj(CAKAJUCA);
    if (c && c.session) {
      sid = c.session;
      kniha = c.kniha || '';
      if (c.test) { try { sessionStorage.setItem('books:test', '1'); } catch (e) { /* nič */ } }
      if (relacie[sid]) { zabudni(CAKAJUCA); return; }
    }
  }
  if (!sid) return;
  if (sid.startsWith('cs_test_') && !testRezim()) { stavPlatby.textContent = T.testCudzi; return; }
  overPlatbu(sid, kniha, testRezim(), 1);
}

prekresli();
nacitajOdkazy().then(() => {
  // Platba bez známej knihy (návrat bez parametra book), na ktorú služba zatiaľ
  // neodpovedala, nemá kartu, kde by sa ukázala. Povie sa to v riadku stavu,
  // ak ho práve nepíše overovanie návratu zo Stripe.
  if (stavPlatby.textContent) return;
  for (const [sid, z] of Object.entries(relacie)) {
    if (!z.kniha && vysledky[sid] && !vysledky[sid].ok) { hlaskaPoZaplateni(sid, z.test); break; }
  }
});
poNavrate();
