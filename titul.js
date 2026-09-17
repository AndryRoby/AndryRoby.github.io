/* Jednorazovy predaj jedneho titulu na hube (Morning Quiet, Ben-Hur,
 * The Count of Monte Cristo, cislo Puzzle Post).
 *
 * Rovnaky vzor ako products/arling-sk/puzzle-books/app.js, len pre jeden titul
 * na stranku a bez mapy hier:
 *   1. tlacidlo [data-titul] vedie na Stripe Payment Link (data-link, v testovom
 *      rezime data-link-test),
 *   2. Stripe vrati cloveka na stranku titulu s ?titul=<id>&session_id=cs_...,
 *   3. stranka sa spyta workera GET /v1/kontrola/status, ci je session
 *      zaplatena a na aku sumu (vracia paid, amount_subtotal, livemode; ziadne
 *      osobne udaje),
 *   4. po kladnej odpovedi sa odomknutie ulozi do localStorage a na stranke sa
 *      ukazu odkazy na subory.
 *
 * Vedome zjednodusenie bez servera: subory su staticke na GitHub Pages a chrani
 * ich len neuhadnutelny nazov priecinka (16 znakov nahody z
 * ops/design/tajne-cesty-tituly.json, do stranky ich dosadi
 * ops/design/tajne-cesty-titul.mjs do bloku <script type="application/json"
 * id="titul-data">). Odomknutie ten odkaz len ukaze, nevyrobi ho. Kto si odkaz
 * odlozi alebo si precita zdroj stranky, dostane sa k suborom aj bez platby.
 * Je to napisane aj v otazkach na stranke, aby to nikoho neprekvapilo.
 *
 * Tento subor sam od seba nic nerobi: stranka si zavola nastav(). Vdaka tomu sa
 * ciste funkcie daju testovat v Node (products/arling-sk/titul.test.mjs).
 */

export const API = 'https://arling-asistent.arling.workers.dev';
export const KLUC_ODOMKNUTE = 'titul:zaplatene';
export const KLUC_CAKAJUCA = 'titul:cakajuca';
export const KLUC_TEST = 'titul:test';

export const T = {
  overujem: 'Checking the payment',
  zaplatene: '<b>Paid, thank you.</b> The download links are below and stay in this browser.',
  inaSuma: 'The payment went through, but not for an amount we recognise. Write to andrej@arling.sk and we will sort it out by hand.',
  nepotvrdene: 'We have not been able to confirm the payment yet. We keep trying; if you paid, the files unlock as soon as Stripe answers. If it takes longer than a few minutes, write to andrej@arling.sk with the order number from the Stripe e-mail.',
  overZnova: 'Check again',
  zapina: 'Buying this title here is still being switched on. It is on sale on Etsy today, or write to andrej@arling.sk and we will send you the files.',
  testChyba: 'Test mode is on, but this title has no test link yet. Run ops/stripe/tituly.mjs --test --zapis, or open this page without ?test=1 to buy it for real.',
  testCudzi: 'This is a payment from Stripe test mode. It unlocks files only in the browser that started the test with ?test=1.',
  testPoznamka: '(Test mode: the payment was made in Stripe test mode, no money changed hands.)',
  bezCesty: 'The payment is confirmed, but the download is not switched on yet. Write to andrej@arling.sk with the order number from the Stripe e-mail and we will send you the files today.',
};

/* ── Ciste funkcie (testovane v Node) ──────────────────────────────────── */

/** Suma pred zlavovym kodom; starsi worker ju neposiela, vtedy plati amount_total. */
export function zakladnaSuma(st) {
  if (!st || typeof st !== 'object') return null;
  if (typeof st.amount_subtotal === 'number') return st.amount_subtotal;
  if (typeof st.amount_total === 'number') return st.amount_total;
  return null;
}

/** Rozhodnutie o jednej odpovedi workera. Vracia stav, nie text. */
export function posudPlatbu(st, cena) {
  if (!st || typeof st !== 'object') return { stav: 'caka' };
  if (!st.paid) return { stav: 'caka' };
  const suma = zakladnaSuma(st);
  if (typeof suma !== 'number') return { stav: 'inaSuma', test: st.livemode === false };
  if (suma < cena) return { stav: 'inaSuma', test: st.livemode === false };
  return { stav: 'zaplatene', test: st.livemode === false };
}

/** Zaznam o odomknuti z localStorage do rovnakeho tvaru, nech tam stalo cokolvek. */
export function stavZoZaznamu(raw) {
  let s = raw;
  if (typeof s === 'string') { try { s = JSON.parse(s); } catch (e) { s = null; } }
  if (!s || typeof s !== 'object') return { tituly: {}, test: false };
  const tituly = (s.tituly && typeof s.tituly === 'object') ? s.tituly : {};
  const von = {};
  for (const k of Object.keys(tituly)) if (tituly[k]) von[k] = true;
  return { tituly: von, test: !!s.test };
}

/** Cesta k platenemu suboru. Prazdny retazec, kym tajna cesta nie je dosadena. */
export function cestaSuboru(data, file) {
  const cesta = data && typeof data.cesta === 'string' ? data.cesta : '';
  if (!cesta || !file) return '';
  return cesta.replace(/\/*$/, '/') + encodeURIComponent(file);
}

/** Na Stripe sa ide len cez odkaz Stripe. Prazdna alebo cudzia hodnota nikam nevedie. */
export function platnyOdkaz(url) {
  const u = String(url || '');
  return /^https:\/\/buy\.stripe\.com\//.test(u) ? u : '';
}

/** Titul z navratovej adresy sa prijme len vtedy, ked patri tejto stranke. */
export function titulZDotazu(hodnota, mojTitul) {
  const t = String(hodnota || '');
  return t && t === mojTitul ? t : '';
}

/* ── Stranka ───────────────────────────────────────────────────────────── */

function bezpecneNacitaj(store, k) { try { return store ? store.getItem(k) : null; } catch (e) { return null; } }
function bezpecneUloz(store, k, v) { try { if (store) store.setItem(k, v); } catch (e) { /* bez uloziska to bezi dalej */ } }
function bezpecneZabudni(store, k) { try { if (store) store.removeItem(k); } catch (e) { /* nic */ } }
function track(name, data) { try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, data); } catch (e) { /* nic */ } }

/** Udaje titulu z bloku <script type="application/json" id="titul-data">. */
export function nacitajUdaje(doc) {
  const el = (doc || document).getElementById('titul-data');
  if (!el) return null;
  try { return JSON.parse(el.textContent || '{}'); } catch (e) { return null; }
}

/** Je tento prehliadac v testovom rezime Stripe? ?test=1 ho zapne na reláciu. */
export function testRezim() {
  try {
    if (new URL(location.href).searchParams.get('test') === '1') sessionStorage.setItem(KLUC_TEST, '1');
    return sessionStorage.getItem(KLUC_TEST) === '1';
  } catch (e) { return false; }
}

export function odomknute() {
  return stavZoZaznamu(bezpecneNacitaj(typeof localStorage === 'undefined' ? null : localStorage, KLUC_ODOMKNUTE));
}

export function jeOdomknuty(id) {
  return !!odomknute().tituly[id];
}

export function odomkni(id, jeTest) {
  const s = odomknute();
  s.tituly[id] = true;
  if (jeTest) s.test = true;
  s.t = Date.now();
  bezpecneUloz(typeof localStorage === 'undefined' ? null : localStorage, KLUC_ODOMKNUTE, JSON.stringify(s));
}

/** Odkazy na subory sa stavaju az tu: kym titul nie je odomknuty, tajna cesta na stranke nikde nestoji. */
export function vykresliSubory(koren, data) {
  if (!koren) return;
  const zoznam = (data && Array.isArray(data.subory)) ? data.subory : [];
  const ul = koren.querySelector('ul');
  if (!ul) return;
  ul.textContent = '';
  for (const s of zoznam) {
    const href = cestaSuboru(data, s.file);
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.setAttribute('href', href || '#');
    a.setAttribute('download', '');
    a.dataset.format = s.format || '';
    a.textContent = s.nazov || s.file;
    if (!href) { a.removeAttribute('download'); a.setAttribute('aria-disabled', 'true'); }
    li.appendChild(a);
    if (s.popis) { const i = document.createElement('span'); i.textContent = ' ' + s.popis; li.appendChild(i); }
    ul.appendChild(li);
  }
}

/**
 * Cela obsluha jednej stranky titulu.
 * volby: { data, tlacidlo, stav, blokSuborov, poPlatbe }
 */
export function nastav(volby = {}) {
  const data = volby.data || nacitajUdaje(document);
  if (!data || !data.titul) return null;
  const cena = Number(data.cena) || 490;
  const stavEl = volby.stav || document.getElementById('stav-platby');
  const blok = volby.blokSuborov || document.getElementById('subory-hotovo');
  const test = testRezim();

  const odznak = document.getElementById('test-odznak');
  if (odznak) odznak.hidden = !test;

  function prekresli() {
    const hotovo = jeOdomknuty(data.titul);
    if (blok) {
      blok.hidden = !hotovo;
      if (hotovo) vykresliSubory(blok, data);
    }
    for (const b of document.querySelectorAll('[data-titul="' + data.titul + '"]')) b.hidden = hotovo;
    const kupa = document.getElementById('kupa-hotova');
    if (kupa) kupa.hidden = !hotovo;
  }

  for (const btn of document.querySelectorAll('[data-titul]')) {
    btn.addEventListener('click', () => {
      track('kupa_click', { titul: btn.dataset.titul, cena: cena, produkt: data.produkt || data.titul });
      const u = platnyOdkaz(test ? btn.dataset.linkTest : btn.dataset.link);
      if (!u) {
        if (stavEl) { stavEl.textContent = test ? T.testChyba : T.zapina; stavEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        return;
      }
      location.href = u;
    });
  }
  for (const a of document.querySelectorAll('a[data-ukazka]')) {
    a.addEventListener('click', () => track('ukazka', { kde: a.dataset.ukazka, produkt: data.produkt || data.titul }));
  }

  /* Cena videna: spolocne meno s ostatnymi produktmi (report EUR na 100 navstev). */
  const cenaEl = document.getElementById('price');
  if (cenaEl && typeof IntersectionObserver === 'function') {
    const io = new IntersectionObserver((z) => {
      for (const e of z) if (e.isIntersecting) { track('cena_videna', { produkt: data.produkt || data.titul }); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(cenaEl);
  }

  let cakanie = null;
  async function over(sid, pokus) {
    if (stavEl) stavEl.textContent = T.overujem + (pokus > 1 ? ' (' + pokus + ')' : '');
    let st = null, siet = false;
    try {
      const r = await fetch(API + '/v1/kontrola/status?session_id=' + encodeURIComponent(sid));
      if (r.ok) st = await r.json();
      else if (r.status >= 500 || r.status === 429) siet = true;
    } catch (e) { siet = true; }
    const v = posudPlatbu(st, cena);
    if (v.stav === 'zaplatene') {
      odomkni(data.titul, v.test);
      bezpecneZabudni(typeof localStorage === 'undefined' ? null : localStorage, KLUC_CAKAJUCA);
      const maCestu = !!cestaSuboru(data, (data.subory && data.subory[0] && data.subory[0].file) || '');
      if (stavEl) stavEl.innerHTML = (maCestu ? T.zaplatene : T.bezCesty) + (v.test ? ' ' + T.testPoznamka : '');
      track('zaplatene', { titul: data.titul, test: !!v.test, produkt: data.produkt || data.titul });
      prekresli();
      if (blok && maCestu) blok.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof volby.poPlatbe === 'function') volby.poPlatbe(v);
      return true;
    }
    if (v.stav === 'inaSuma') {
      bezpecneZabudni(typeof localStorage === 'undefined' ? null : localStorage, KLUC_CAKAJUCA);
      if (stavEl) stavEl.textContent = T.inaSuma;
      return false;
    }
    // Stripe odpovedal, ze zaplatene nie je, alebo neodpovedal. Payment link
    // vracia spat az po uspesnej platbe, takze je to skoro vzdy oneskorenie.
    bezpecneUloz(typeof localStorage === 'undefined' ? null : localStorage, KLUC_CAKAJUCA, JSON.stringify({ session: sid, titul: data.titul, test: test, t: Date.now() }));
    if (stavEl) {
      stavEl.innerHTML = T.nepotvrdene + ' <button type="button" class="btn btn-line" id="over-znova">' + T.overZnova + '</button>';
      const b = document.getElementById('over-znova');
      if (b) b.addEventListener('click', () => { clearTimeout(cakanie); over(sid, 1); });
    }
    if (pokus < 8) cakanie = setTimeout(() => over(sid, pokus + 1), Math.min(30000, 3000 * pokus));
    return false;
  }

  function poNavrate() {
    let sid = '', titulVDotaze = '', cudziTitul = false;
    try {
      const q = new URL(location.href).searchParams;
      sid = q.get('session_id') || '';
      titulVDotaze = q.get('titul') || '';
      cudziTitul = !!titulVDotaze && !titulZDotazu(titulVDotaze, data.titul);
    } catch (e) { /* nic */ }
    if (sid) history.replaceState(null, '', location.pathname);
    // Navrat zo Stripe vedie vzdy na stranku toho titulu, ktory sa kupoval.
    // Ked v adrese stoji cudzi titul, je to rucne upravena adresa a nic sa neodomyka.
    if (cudziTitul) return;
    if (!sid) {
      const c = bezpecneNacitaj(typeof localStorage === 'undefined' ? null : localStorage, KLUC_CAKAJUCA);
      let z = null;
      try { z = c ? JSON.parse(c) : null; } catch (e) { z = null; }
      if (z && z.session && z.titul === data.titul && !jeOdomknuty(data.titul)) sid = z.session;
    }
    if (!sid) return;
    if (sid.startsWith('cs_test_') && !test) { if (stavEl) stavEl.textContent = T.testCudzi; return; }
    over(sid, 1);
  }

  prekresli();
  poNavrate();
  return { prekresli, over };
}
