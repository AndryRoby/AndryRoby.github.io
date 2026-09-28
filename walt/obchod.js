/* Obchody postáv (arling.sk/walt/, /june/, /olive/), STAV-40, 28. 9. 2026.
 * Zdroj: ops/strategia/instagram/obchody/spolocne/obchod.js, do priečinkov postáv ho kopíruje postav.mjs.
 *
 * Výber položky (?p=), jedno tlačidlo na kúpu, texty o platbe a doručení podľa kanála vybranej
 * položky ([data-kanal]), atribúcia client_reference_id = ig_<postava>_<produkt> (nikdy gads_,
 * STRANKY-POSTAV.md 1.3), udalosti Umami s produktom a jeden pohybový moment.
 *
 * STAV-56 (po 3 pokusoch brány): stránky postáv nemajú testovací režim. Každý odkaz na platbu je
 * už v statickom HTML živý odkaz svojej položky (generuje ho postav.mjs týmito istými funkciami);
 * skript pri zmene voľby prepne tlačidlo na živý odkaz inej položky a doplní UTM z príchodu.
 * Nákup sa testuje na vlastných stránkach produktov (/titul.js), nie tu.
 *
 * STAV-57 (posudok ops/ai/kontrola/2026-09-28-stranky-postav-jednoduche.md, nález P1): progresívne
 * vylepšenie. Statické HTML nemá výber: každý produkt má vlastné tlačidlo so živým odkazom
 * (.kupa-polozka), prepínače sú disabled a hidden, spoločné tlačidlo #kupit je v skrytom #kupa-jedna.
 * Až keď skript úspešne nastaví prvú voľbu, zapne prepínače, ukáže #kupit a skryje tlačidlá produktov.
 * Pri chybe počas zapínania vráti statický stav, takže tlačidlo nikdy nekúpi iný produkt, než je vidieť.
 * Nález P2: odkaz v detaile nesie ?postava=<postava> a aktuálne UTM (adresa má prednosť, úložisko je
 * len doplnok), stránka produktu (/titul.js) z toho spraví ig_<postava>_<titul>.
 */
const UTM_POLIA = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
export const POSTAVY = ['walt', 'june', 'olive'];

/** Z hodnoty ?p= vyberie platnú voľbu tejto stránky, inak predvolenú. */
export function volbaZAdresy(adresa, volby, predvolena) {
  let p = '';
  try { p = new URL(adresa).searchParams.get('p') || ''; } catch (e) { p = ''; }
  const platna = !!p && Object.prototype.hasOwnProperty.call(volby, p);
  return { p: platna ? p : predvolena, neplatne: !!p && !platna };
}

export function utmZAdresy(adresa) {
  const u = {};
  try {
    const q = new URL(adresa).searchParams;
    for (const k of UTM_POLIA) { const v = q.get(k); if (v) u[k] = v.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80); }
  } catch (e) { /* bez UTM */ }
  return u;
}

export function referencia(postava, p) {
  return ('ig_' + postava + '_' + p).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 200);
}

/** Kam vedie tlačidlo. Stripe: len buy.stripe.com, s client_reference_id a UTM. Etsy: len etsy.com. */
export function odkazNaKupu(volba, { postava, p, utm = {} } = {}) {
  if (!volba) return '';
  if (volba.typ === 'etsy') return /^https:\/\/www\.etsy\.com\/listing\/\d+$/.test(volba.etsy || '') ? volba.etsy : '';
  if (!/^https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+$/.test(volba.odkaz || '')) return '';
  const url = new URL(volba.odkaz);
  url.searchParams.set('client_reference_id', referencia(postava, p));
  for (const k of Object.keys(utm)) if (UTM_POLIA.includes(k)) url.searchParams.set(k, utm[k]);
  return url.toString();
}

export function textTlacidla(volba) {
  if (!volba) return '';
  return (volba.typ === 'etsy' ? 'Buy on Etsy' : 'Buy ' + volba.kratko) + ' · ' + volba.cena + ' €';
}

/* Celý stav tlačidla pre jednu voľbu: živý odkaz Stripe alebo ponuka Etsy; chýbajúci či neplatný
 * odkaz dá vypnuté tlačidlo bez href. */
export function stavNakupu(volba, { postava, p, utm = {} } = {}) {
  if (!volba) return { href: '', text: '', kanal: '', vypnute: true };
  const kanal = volba.typ === 'etsy' ? 'etsy' : 'stripe';
  const href = odkazNaKupu(volba, { postava, p, utm });
  if (!href) return { href: '', text: 'Not available right now', kanal, vypnute: true };
  return { href, text: textTlacidla(volba), kanal, vypnute: false };
}

/* Kam vedie odkaz v detaile produktu. druh 'stranka': vlastná stránka produktu na arling.sk (ako cesta,
 * s ?postava=<postava> a UTM, aby tam kúpa dostala ig_<postava>_<titul>). druh 'etsy': ponuka Etsy.
 * Neplatná adresa: vypnuté. */
export function cielDetailu(volba, druh, { postava = '', utm = {} } = {}) {
  if (!volba) return { href: '', vypnute: true };
  if (druh === 'etsy') {
    return /^https:\/\/www\.etsy\.com\/listing\/\d+$/.test(volba.etsy || '') ? { href: volba.etsy, vypnute: false } : { href: '', vypnute: true };
  }
  if (druh !== 'stranka') return { href: '', vypnute: true };
  let url;
  try { url = new URL(volba.stranka || '', 'https://arling.sk/'); } catch (e) { return { href: '', vypnute: true }; }
  if (url.origin !== 'https://arling.sk' || !/^\/[a-z0-9/-]+\/$/.test(url.pathname)) return { href: '', vypnute: true };
  const q = new URLSearchParams();
  if (POSTAVY.includes(postava)) q.set('postava', postava);
  for (const k of UTM_POLIA) if (utm[k]) q.set(k, String(utm[k]).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80));
  const s = q.toString();
  return { href: url.pathname + (s ? '?' + s : ''), vypnute: false };
}

function track(meno, data) {
  try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(meno, data); } catch (e) { /* nič */ }
}
function nacitaj(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
// Pri zlyhaní zápisu sa stará hodnota zmaže, aby sa neobnovila stará kampaň (brána 28. 9., stranky-postav-bez-pamate-pokus2).
function uloz(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { try { sessionStorage.removeItem(k); } catch (e2) { /* bez úložiska */ } } }

function spusti() {
  const el = document.getElementById('obchod-data');
  if (!el) return;
  let data;
  try { data = JSON.parse(el.textContent); } catch (e) { return; }
  const { postava, volby, predvolena } = data;

  // aktuálne UTM z adresy majú prednosť; úložisko len doplní UTM z príchodu, keď v adrese nie sú
  const utmTeraz = utmZAdresy(location.href);
  let utm = utmTeraz;
  if (Object.keys(utmTeraz).length) uloz('arling_utm', JSON.stringify(utmTeraz));
  else { try { utm = JSON.parse(nacitaj('arling_utm') || '{}') || {}; } catch (e) { utm = {}; } }

  const tlacidlo = document.getElementById('kupit');
  const jedna = document.getElementById('kupa-jedna');
  const pod = document.getElementById('kupa-pod');
  const velky = document.getElementById('nahlad-velky');
  const obchod = document.getElementById('obchod');
  const radia = [...document.querySelectorAll('input[name="volba"]')];
  if (!tlacidlo || !jedna || !radia.length) return;

  /* Statický stav (bez skriptu, alebo keď zapnutie zlyhá): tlačidlo pri každom produkte, žiadny výber,
   * všetky detaily a texty oboch kanálov. Zapnutý: výber, jedno tlačidlo, detail a texty vybranej položky. */
  function prepni(zapnute) {
    for (const r of radia) {
      if (zapnute) { r.removeAttribute('disabled'); r.hidden = false; }
      else { r.setAttribute('disabled', ''); r.hidden = true; r.checked = false; }
    }
    jedna.hidden = !zapnute;
    for (const e of document.querySelectorAll('.kupa-polozka')) e.hidden = zapnute;
    for (const e of document.querySelectorAll('[data-len-bez-js]')) e.hidden = zapnute;
    for (const e of document.querySelectorAll('[data-len-s-js]')) e.hidden = !zapnute;
    if (!zapnute) for (const e of document.querySelectorAll('[data-kanal], .detail')) if (e !== tlacidlo) e.hidden = false;
    if (obchod) { if (zapnute) obchod.classList.add('s-vyberom'); else obchod.classList.remove('s-vyberom'); }
  }

  function vyber(p, zdroj) {
    const v = volby[p];
    if (!v) return;
    for (const r of radia) r.checked = r.value === p;
    const s = stavNakupu(v, { postava, p, utm });
    tlacidlo.textContent = s.text;
    // nikdy neponechať predchádzajúci href (iný produkt)
    if (s.vypnute) { tlacidlo.removeAttribute('href'); tlacidlo.setAttribute('aria-disabled', 'true'); tlacidlo.classList.add('vypnute'); }
    else { tlacidlo.href = s.href; tlacidlo.removeAttribute('aria-disabled'); tlacidlo.classList.remove('vypnute'); }
    tlacidlo.dataset.p = p;
    tlacidlo.dataset.kanal = s.kanal;
    // platba, doručenie a vrátenie opisujú len kanál vybranej položky (Stripe alebo Etsy)
    for (const el of document.querySelectorAll('[data-kanal]')) if (el !== tlacidlo) el.hidden = el.dataset.kanal !== s.kanal;
    if (pod) pod.innerHTML = '';
    if (pod) for (const n of document.getElementById('pod-' + p).content.cloneNode(true).childNodes) pod.appendChild(n);
    for (const d of document.querySelectorAll('.detail')) {
      d.hidden = d.dataset.p !== p;
      // strany práve zobrazenej položky sa načítajú hneď, nie až pri posune
      if (!d.hidden) for (const img of d.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager';
    }
    if (velky) {
      const img = velky.querySelector('img');
      img.src = v.velky; img.alt = v.velkyAlt; img.width = v.velkyW; img.height = v.velkyH;
      velky.querySelector('figcaption').textContent = v.velkyPopis;
    }
    if (zdroj === 'klik') {
      const q = new URL(location.href);
      q.searchParams.set('p', p);
      try { history.replaceState(null, '', q.pathname + q.search + q.hash); } catch (e) { /* nič */ }
      track('postava-volba', { postava, produkt: p });
    }
  }

  const start = volbaZAdresy(location.href, volby, predvolena);
  try {
    // odkazy v detaile nesú postavu a aktuálne UTM na stránku produktu (nález P2)
    for (const a of document.querySelectorAll('a[data-ciel="stranka"]')) {
      const c = cielDetailu(volby[a.dataset.p], 'stranka', { postava, utm });
      if (!c.vypnute) a.href = c.href;
    }
    prepni(true);
    vyber(start.p, 'start');
    for (const r of radia) r.addEventListener('change', () => { if (r.checked) vyber(r.value, 'klik'); });
  } catch (e) {
    prepni(false);
    return;
  }

  // Návrat z pokladne priamo sem (budúce Payment Links postáv s návratom na /<postava>/?p=…&session_id=…).
  // Platbu tu neoverujeme, preto len pravdivá veta o e-maile, bez sťahovania.
  const sid = new URL(location.href).searchParams.get('session_id') || '';
  const navrat = document.getElementById('navrat');
  if (/^cs_live_[A-Za-z0-9]+$/.test(sid) && navrat) {
    navrat.hidden = false;
    navrat.querySelector('[data-objednavka]').textContent = sid.slice(-8);
    track('postava-navrat', { postava, produkt: start.p });
  }
  track('postava-zobrazenie', { postava, produkt: start.p, p_neplatne: start.neplatne, utm_campaign: utm.utm_campaign || '', utm_content: utm.utm_content || '' });
  if (start.neplatne) track('postava-volba', { postava, produkt: start.p, p_neplatne: true });

  tlacidlo.addEventListener('click', (e) => {
    if (tlacidlo.getAttribute('aria-disabled') === 'true') { e.preventDefault(); return; }
    const p = tlacidlo.dataset.p;
    track('postava-kupit', { postava, produkt: p, kanal: volby[p].typ });
  });

  moment(data.moment);
}

/* Jeden pohybový moment: spustí sa raz, keď je z polovice na obrazovke. Pri zníženom pohybe
 * je hneď hotový stav (trieda .hotovo bez prechodov). Len transform a opacity; čísla v zošite
 * June sa menia cez requestAnimationFrame (text, nie rozloženie). */
function moment(typ) {
  const koren = document.querySelector('[data-moment]');
  if (!koren) return;
  const ticho = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ciele = [koren, ...koren.querySelectorAll('[data-moment-cast]')];
  const suma = koren.querySelector('[data-suma]');
  const hotovo = () => { for (const c of ciele) c.classList.add('hotovo'); if (suma) suma.textContent = suma.dataset.suma; };
  if (ticho || typeof IntersectionObserver !== 'function') { hotovo(); return; }
  // STAV-57: bez skriptu je moment v konečnom stave; do počiatočného sa prepne bez prechodu
  for (const c of ciele) c.classList.add('pripravene', 'bez-prechodu');
  void koren.offsetWidth;
  requestAnimationFrame(() => requestAnimationFrame(() => { for (const c of ciele) c.classList.remove('bez-prechodu'); }));
  const io = new IntersectionObserver((z) => {
    for (const e of z) {
      if (!e.isIntersecting) continue;
      io.disconnect();
      for (const c of ciele) c.classList.add('hraj');
      if (suma) spocitaj(suma);
      track('postava-moment', { moment: typ });
    }
  }, { threshold: 0.5 });
  io.observe(koren);
}

function spocitaj(el) {
  const ciel = Number(el.dataset.suma);
  const zaciatok = performance.now() + 700;
  const trvanie = 900;
  el.textContent = '0.00';
  const krok = (t) => {
    const x = Math.min(1, Math.max(0, (t - zaciatok) / trvanie));
    const k = 1 - Math.pow(1 - x, 3);
    el.textContent = (ciel * k).toFixed(2);
    if (x < 1) requestAnimationFrame(krok); else el.textContent = ciel.toFixed(2);
  };
  requestAnimationFrame(krok);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', spusti); else spusti();
}
