// /web/ ARLing: weby na mieru (19. 11. 2026, A-325 v2, prerobené po kritika-web.md). ES modul nad ARLing Motion (/motion/, MIT).
// Momenty: vejár telefónov v hrdinovi (karty sa točia ako kolotoč, svetlo za vejárom má farbu ukážky vpredu, meno
// značky v jej písme), filter štýlov, na počítači riadky s pevným náhľadom vedľa (nič neprekrýva text), na mobile pás
// kariet, telefón naživo, pruhy rýchlosti, signál krokov, akordeón otázok a vstupy sekcií.
// Bez JS a pri obmedzenom pohybe je všetko v koncovom stave. Obrázky mimo prvej karty sa načítajú až po načítaní
// stránky alebo pri priblížení (nebránia LCP). Hodnoty z adresy (?z=) len zo zoznamu povolených ukážok, nikdy sa
// nevkladajú do stránky ako HTML (AGENTS.md bod 12).

const d = document;
const w = window;
d.documentElement.classList.add('js');
const mq = (q) => (w.matchMedia ? w.matchMedia(q) : { matches: false, addEventListener() {} });
const POKOJ = mq('(prefers-reduced-motion: reduce)');
const pokoj = () => POKOJ.matches;
const VSTUP = 'cubic-bezier(.23,1,.32,1)';
const POHYB = 'cubic-bezier(.77,0,.175,1)';
const N = '/web/nahlady/';
const FARBA = /^#[0-9a-f]{6}$/i;
const RGBA = /^rgba\(\d{1,3},\d{1,3},\d{1,3},(0|1|0?\.\d+)\)$/;
const SKUPINY = new Set(['odvazne', 'elegantne', 'hrave', 'pokojne']);
// Pevná medzera za jednopísmenovou predložkou alebo spojkou v textoch, ktoré skript vkladá (ako generátor stránky).
const nbsp = (t) => t.replace(/(^|\s)([aiouvkszAIOUVKSZ])\s+/g, '$1$2 ');
const ukazok = (n) => (n === 1 ? '1 ukážka' : n >= 2 && n <= 4 ? `${n} ukážky` : `${n} ukážok`);
// Čo netreba na prvé vykreslenie, až po načítaní stránky A po prvom vykreslení (dva snímky): na rýchlej sieti
// príde load skôr než prvé vykreslenie a ďalšie obrázky by sa inak stiahli pred LCP.
const poNacitani = (fn) => {
  const po = () => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(fn, 40)));
  if (d.readyState === 'complete') po();
  else w.addEventListener('load', po, { once: true });
};
// Čítanie rozloženia až po prvom vykreslení.
const poPrvomSnimku = (fn) => requestAnimationFrame(() => setTimeout(fn, 0));
const cakaj = (ms) => new Promise((r) => setTimeout(r, ms));
const doCasu = (p, ms) => Promise.race([p, cakaj(ms)]);

// Dáta ukážok čítame zo zoznamu v HTML (jeden zdroj, funguje aj bez JS).
const riadky = [...d.querySelectorAll('.riadok[data-slug]')];
const UKAZKY = riadky.map((li, i) => ({
  i,
  li,
  slug: li.dataset.slug,
  meno: li.dataset.meno || '',
  mesto: li.dataset.mesto || '',
  odbor: li.dataset.odbor || '',
  styl: li.dataset.stylMeno || '',
  farby: (li.dataset.farby || '').split(' ').filter((f) => FARBA.test(f)),
  pisma: li.dataset.pisma || '',
  znacka: li.dataset.znacka || '',
  ziara: RGBA.test(li.dataset.ziara || '') ? li.dataset.ziara : '',
  ziara2: RGBA.test(li.dataset.ziara2 || '') ? li.dataset.ziara2 : '',
  rozsah: li.dataset.rozsah || '',
  href: `/web/ukazky/${li.dataset.slug}/`,
}));
const POVOLENE = new Set(UKAZKY.map((u) => u.slug));
const podla = (slug) => UKAZKY.find((u) => u.slug === slug);

// Obrázok odložený cez <source media="(scripting: enabled)"> alebo data-srcset: uvoľniť a počkať na dekódovanie.
function uvolni(koren) {
  if (!koren) return Promise.resolve();
  const src = koren.querySelector('picture > source[media]');
  if (src) src.remove();
  const im = koren.querySelector('img');
  if (!im) return Promise.resolve();
  if (im.dataset.srcset) {
    im.srcset = im.dataset.srcset;
    im.src = im.dataset.srcset.split(' ')[0];
    delete im.dataset.srcset;
  }
  return (im.decode ? im.decode() : Promise.resolve()).catch(() => {});
}

// Písmo mena značky (malá podmnožina v /web/pisma/): načítať pred zobrazením, aby sa meno nepreblikovalo.
const pismaZnaciek = new Map();
function pismoZnacky(u) {
  if (!u || !d.fonts || !d.fonts.load) return Promise.resolve();
  if (!pismaZnaciek.has(u.slug)) {
    const text = (u.znacka || '').toLocaleUpperCase('sk') + (u.znacka || '');
    pismaZnaciek.set(u.slug, d.fonts.load(`400 32px "Znacka ${u.slug}"`, text).catch(() => {}));
  }
  return pismaZnaciek.get(u.slug);
}
// Trieda .z-<slug> na prvku (farba, sadzba, písmo), ostatné .z-* preč.
function nastavZnacku(el, u) {
  if (!el || !u) return;
  for (const c of [...el.classList]) if (c.startsWith('z-')) el.classList.remove(c);
  el.classList.add('z-' + u.slug);
  el.textContent = u.znacka;
}
function nastavBodky(koren, u) {
  if (!koren || !u) return;
  [...koren.querySelectorAll('.bodky i')].forEach((x, j) => { if (u.farby[j]) x.style.setProperty('--f', u.farby[j]); });
}

// ?z=<slug>: človek prišiel z ukážky. Zvýrazniť ju, začať ňou vejár a poslať ju do dotazníka (?ukazka=).
// Od cenníka 4.1 (SPEC 2.4) to isté pri ?ukazka=<slug> bez ?z= (odkaz z úvodu do kalkulačky).
let zdroj = null;
try {
  const q = new URLSearchParams(w.location.search);
  const z = q.get('z') || q.get('ukazka');
  if (z && POVOLENE.has(z)) zdroj = z;
} catch (e) { zdroj = null; }
function nastavDotaznik(param, hodnota, odkazy) {
  for (const a of odkazy || d.querySelectorAll('a[href^="/web/dotaznik/"]')) {
    const u = new URL(a.getAttribute('href'), w.location.origin);
    if (hodnota) u.searchParams.set(param, hodnota); else u.searchParams.delete(param);
    a.setAttribute('href', u.pathname + u.search + u.hash);
  }
}
// Ktorou ukážkou vejár v hrdinovi začne pri ?z=. Ukážka e-shopu (data-rozsah="eshop") dopredu nejde: hrdina hovorí
// „Web, ktorý vyzerá ako vy. Nie ako šablóna.“, kým e-shop na Shoptete má vzhľad šablóny Shoptetu (podmienky 7c,
// pred-fb nález 1). Zvýraznenie v zozname a ?ukazka= pre dotazník ostávajú. Neznáma ukážka alebo chyba: prvá (0).
// Samovoľné točenie (brána p1 G1 odp. 1, 20. 11. 2026): dalsiaVejara preskočí ukážky e-shopu, takže pod tým istým
// nadpisom nikdy nie je vpredu košík; v zozname, v páse a pri ručnom ovládaní (šípky, ťahanie, klik) ostávajú.
// Jedno kolo (koloVejara) má toľko výmen, koľko je ukážok mimo e-shopu, a skončí tam, kde začalo. Chybné dáta alebo
// žiadna ukážka mimo e-shopu: vejár ostane stáť na k (nič nepríde dopredu), prázdny zoznam 0.
// Čisté funkcie medzi značkami číta test ops/weby-na-mieru/v2/front-20/pred-fb/testy/web-vejar-eshop.test.mjs.
// @start-zaciatok
function startVejara(ukazky, slug) {
  if (!slug || !Array.isArray(ukazky)) return 0;
  const z = ukazky.findIndex((u) => u && u.slug === slug);
  if (z <= 0 || ukazky[z].rozsah === 'eshop') return 0;
  return z;
}
function dalsiaVejara(ukazky, k) {
  const n = Array.isArray(ukazky) ? ukazky.length : 0;
  if (!n) return 0;
  const od = Number.isInteger(k) ? ((k % n) + n) % n : 0;
  for (let j = 1; j <= n; j++) {
    const i = (od + j) % n;
    if (ukazky[i] && ukazky[i].rozsah !== 'eshop') return i;
  }
  return od;
}
function koloVejara(ukazky) {
  return Array.isArray(ukazky) ? ukazky.filter((u) => u && u.rozsah !== 'eshop').length : 0;
}
// @start-koniec
if (zdroj) {
  nastavDotaznik('ukazka', zdroj);
  const li = d.getElementById('u-' + zdroj);
  const meta = li && li.querySelector('.riadok-meta');
  if (meta) {
    li.classList.add('z-tejto');
    const em = d.createElement('em');
    em.textContent = 'Túto ukážku ste si práve pozreli';
    meta.appendChild(em);
  }
}

// Prenos utm z adresy /web/ do každého odkazu na /web/dotaznik/ (KONTRAKT.md 4.10, front-20 20. 11. 2026): len kľúče
// z UTM_KLUCE, v hodnote ostanú len znaky A-Z a-z 0-9 _ . : - a najviac 40 znakov; fbclid, gclid a iné parametre nikdy.
// Od pred-fb (20. 11. 2026, nález 46) aj do odkazov na /web/ukazky/, aby ich ukážka mohla vrátiť na /web/?z=.
// Existujúce parametre odkazu (ukazka, styl, kotva) ostávajú. Čisté funkcie medzi značkami číta test
// ops/weby-na-mieru/v2/front-20/testy/utm.test.mjs.
// @utm-zaciatok
const UTM_KLUCE = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
const UTM_ODKAZY = 'a[href^="/web/dotaznik/"], a[href^="/web/ukazky/"]';
function utmZAdresy(search) {
  const p = new URLSearchParams(search || '');
  const pary = [];
  for (const k of UTM_KLUCE) {
    const v = p.get(k);
    if (v === null) continue;
    const ciste = v.replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 40);
    if (ciste) pary.push([k, ciste]);
  }
  return pary;
}
function sUtm(href, pary, origin) {
  const u = new URL(href, origin);
  for (const [k, v] of pary) u.searchParams.set(k, v);
  return u.pathname + u.search + u.hash;
}
function prenesUtm(doc, search, origin) {
  const pary = utmZAdresy(search);
  if (!pary.length) return 0;
  const odkazy = doc.querySelectorAll(UTM_ODKAZY);
  for (const a of odkazy) a.setAttribute('href', sUtm(a.getAttribute('href'), pary, origin));
  return odkazy.length;
}
// @utm-koniec
try { prenesUtm(d, w.location.search, w.location.origin); } catch (e) { /* odkazy ostanú bez utm */ }

// Hlavička a mobilná ponuka (ako úvod hubu).
const hlava = d.getElementById('hlava');
const posun = () => hlava && hlava.classList.toggle('posunute', w.scrollY > 8);
w.addEventListener('scroll', posun, { passive: true });
posun();
const mob = d.getElementById('mob');
const mobBtn = d.querySelector('.menu-mob');
const mobZavri = mob && mob.querySelector('.mob-zavri');
if (mob && mobBtn && mobZavri) {
  const pozadie = [hlava, d.getElementById('obsah'), d.querySelector('.pata')];
  const otvor = (e) => {
    if (e) e.preventDefault();
    mob.classList.add('otvorene');
    mobBtn.setAttribute('aria-expanded', 'true');
    d.body.style.overflow = 'hidden';
    pozadie.forEach((x) => { if (x) x.inert = true; });
    setTimeout(() => mobZavri.focus(), 40);
  };
  const zavri = (e, vratFokus = true) => {
    if (e) e.preventDefault();
    mob.classList.remove('otvorene');
    mobBtn.setAttribute('aria-expanded', 'false');
    d.body.style.overflow = '';
    pozadie.forEach((x) => { if (x) x.inert = false; });
    if (vratFokus) mobBtn.focus();
  };
  mobBtn.addEventListener('click', otvor);
  mobZavri.addEventListener('click', zavri);
  [mobBtn, mobZavri].forEach((b) => b.addEventListener('keydown', (e) => { if (e.key === ' ') { e.preventDefault(); b.click(); } }));
  mob.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (a && a !== mobZavri && mob.classList.contains('otvorene')) zavri(null, false);
  });
  d.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mob.classList.contains('otvorene')) zavri(); });
}

// ---------------------------------------------------------------- hrdina: vejár telefónov
const scena = d.getElementById('scena');
const vejarEl = d.getElementById('vejar');
if (scena && vejarEl && UKAZKY.length) vejar();

function vejar() {
  const n = UKAZKY.length;
  const karty = [];
  for (const a of vejarEl.querySelectorAll('.karta')) karty[Number(a.dataset.i)] = a;
  if (karty.length !== n || karty.some((a, i) => !a || a.dataset.slug !== UKAZKY[i].slug)) return;
  const pas = vejarEl.querySelector('.vejar-pas');
  const popisEl = d.getElementById('popis');
  const znackaEl = d.getElementById('popis-znacka');
  const metaEl = d.getElementById('popis-meta');
  const textEl = d.getElementById('popis-text');
  const stylEl = d.getElementById('popis-styl');
  const cisloEl = d.getElementById('popis-cislo');
  const stavEl = d.getElementById('vejar-stav');
  const spat = d.getElementById('vejar-spat');
  const dalej = d.getElementById('vejar-dalej');
  const stop = d.getElementById('stop-pohyb');
  const ziary = [...d.querySelectorAll('.ziara i')];
  const MOBIL = mq('(max-width: 640px)');
  const JEMNY = mq('(hover: hover) and (pointer: fine)');
  let k = 0;
  let otvoreny = false;
  let vymen = 0;
  let timer = 0;
  let naplanovane = 0;
  let zostava = 0;
  let poradiePopisu = 0;
  const stav = { mys: false, fokus: false, mimo: false, skryte: d.hidden, stop: false, koniec: false, rucne: false };

  const poz = (i) => {
    const r = (i - k + n) % n;
    if (r <= 3) return r;
    if (r >= n - 3) return r - n;
    return null;
  };
  // Koľko kariet na každú stranu je vidieť (podľa šablóny): mobil a 1024 až 1279 px po jednej, inak po dve.
  const UZKE = mq('(max-width: 640px), (min-width: 1024px) and (max-width: 1279px)');
  const strany = () => (UZKE.matches ? 1 : 2);
  const viditelna = (p) => p !== null && Math.abs(p) <= strany();

  // Rozloženie kariet podľa k. Obrázky sa uvoľnia len viditeľným kartám a jednej, ktorá príde na rad
  // (pri točení dopredu vpravo), a až keď je stránka načítaná; skryté karty nič nesťahujú.
  function rozloz() {
    const s = strany();
    for (let i = 0; i < n; i++) {
      const a = karty[i];
      const p = poz(i);
      a.dataset.poz = p === null ? 'x' : String(p);
      if (p === 0) { a.removeAttribute('tabindex'); a.removeAttribute('aria-hidden'); } else { a.tabIndex = -1; a.setAttribute('aria-hidden', 'true'); }
      if (otvoreny && p !== null && (Math.abs(p) <= s || p === s + 1)) uvolni(a);
    }
  }

  // Svetlo za vejárom: dve vrstvy sa prelínajú, nová dostane farbu ukážky vpredu.
  let ziaraZap = 0;
  function ziara(u) {
    if (ziary.length < 2 || !u.ziara) return;
    const dalsia = ziary[1 - ziaraZap];
    dalsia.style.setProperty('--zf', u.ziara);
    dalsia.style.setProperty('--zf2', u.ziara2 || u.ziara);
    dalsia.classList.add('zap');
    ziary[ziaraZap].classList.remove('zap');
    ziaraZap = 1 - ziaraZap;
  }

  // Popis pod vejárom: meno značky v jej písme a farbe, mesto a odbor, štýl, farby, poradie.
  async function popis(u, hned) {
    const moje = ++poradiePopisu;
    if (!znackaEl) return;
    if (hned || pokoj()) {
      nastavZnacku(znackaEl, u);
      if (textEl) textEl.textContent = nbsp(`${u.mesto} · ${u.odbor}`);
      if (stylEl) stylEl.textContent = `štýl ${u.styl}`;
      nastavBodky(metaEl, u);
      if (cisloEl) cisloEl.textContent = String(u.i + 1);
      return;
    }
    znackaEl.classList.add('mizne');
    if (metaEl) metaEl.classList.add('mizne');
    await Promise.all([cakaj(200), doCasu(pismoZnacky(u), 700)]);
    if (moje !== poradiePopisu) return;
    nastavZnacku(znackaEl, u);
    if (textEl) textEl.textContent = nbsp(`${u.mesto} · ${u.odbor}`);
    if (stylEl) stylEl.textContent = `štýl ${u.styl}`;
    nastavBodky(metaEl, u);
    if (cisloEl) cisloEl.textContent = String(u.i + 1);
    znackaEl.classList.remove('mizne');
    znackaEl.classList.add('prichadza');
    void znackaEl.offsetWidth;
    znackaEl.classList.remove('prichadza');
    if (metaEl) metaEl.classList.remove('mizne');
  }

  function prepni(novy, rucne) {
    const fokusNaKarte = d.activeElement && d.activeElement.classList && d.activeElement.classList.contains('karta');
    k = (novy % n + n) % n;
    const u = UKAZKY[k];
    rozloz();
    // fokus nesmie ostať na karte, ktorá sa práve skryla pred čítačkou (aria-hidden): prejde na novú prednú
    if (fokusNaKarte) karty[k].focus({ preventScroll: true });
    popis(u, false);
    ziara(u);
    if (stavEl) {
      stavEl.setAttribute('aria-live', rucne ? 'polite' : 'off');
      stavEl.textContent = `${u.meno}, ${u.mesto}, ${k + 1} z ${n}`;
    }
    // písmo značky, ktorá príde pri točení, vopred
    pismoZnacky(UKAZKY[dalsiaVejara(UKAZKY, k)]);
  }

  // Ručné ovládanie zastaví samovoľné točenie (WCAG 2.2.2) a prepínač to ukáže.
  function rucne() {
    stav.rucne = true;
    if (stop) stop.checked = true;
    aktualizuj();
  }
  if (spat) spat.addEventListener('click', () => { rucne(); prepni(k - 1, true); });
  if (dalej) dalej.addEventListener('click', () => { rucne(); prepni(k + 1, true); });
  scena.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('.stop')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); rucne(); prepni(k + 1, true); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); rucne(); prepni(k - 1, true); }
  });

  // Klik na bočnú kartu ju pritiahne dopredu; klik na prednú otvorí ukážku.
  let tahal = false;
  vejarEl.addEventListener('click', (e) => {
    const a = e.target.closest('.karta');
    if (!a) return;
    if (tahal) { e.preventDefault(); tahal = false; return; }
    const p = Number(a.dataset.poz);
    if (a.dataset.poz !== '0') {
      e.preventDefault();
      if (!Number.isNaN(p) && viditelna(p)) { rucne(); prepni(k + p, true); }
    }
  });

  // Potiahnutie prstom (aj myšou): pás ide za prstom, po pustení sa vejár pootočí o jednu kartu.
  let start = null;
  vejarEl.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    tahal = false;
  });
  vejarEl.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!tahal && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      tahal = true;
      vejarEl.classList.add('taha');
      try { vejarEl.setPointerCapture(e.pointerId); } catch (er) { /* bez zachytenia */ }
    }
    if (tahal && pas) pas.style.transform = `translate3d(${(dx * 0.55).toFixed(1)}px,0,0)`;
  });
  const pusti = (e) => {
    if (!start || (e && e.pointerId !== start.id)) return;
    const dx = e ? e.clientX - start.x : 0;
    start = null;
    vejarEl.classList.remove('taha');
    if (pas) pas.style.transform = '';
    if (!tahal) return;
    if (Math.abs(dx) >= 40) { rucne(); prepni(k + (dx < 0 ? 1 : -1), true); }
    // klik, ktorý po ťahaní príde, sa zahodí (tahal ostane true do kliku)
    setTimeout(() => { tahal = false; }, 350);
  };
  vejarEl.addEventListener('pointerup', pusti);
  vejarEl.addEventListener('pointercancel', () => { start = null; vejarEl.classList.remove('taha'); if (pas) pas.style.transform = ''; });

  // Samovoľné točenie: jedno kolo (výmeny len medzi ukážkami mimo e-shopu, dalsiaVejara a koloVejara), potom pokoj (N8).
  // Pauza: myš nad scénou, fokus v nej, mimo obrazu, skrytá karta prehliadača, prepínač Zastaviť pohyb, ručné ovládanie,
  // obmedzený pohyb.
  const kolo = koloVejara(UKAZKY);
  const stoji = () => stav.mys || stav.fokus || stav.mimo || stav.skryte || stav.stop || stav.koniec || stav.rucne || pokoj() || !otvoreny || !kolo;
  const interval = () => (MOBIL.matches ? 2600 : 2900);
  function planuj(ms) {
    clearTimeout(timer);
    naplanovane = performance.now() + ms;
    timer = setTimeout(krok, ms);
  }
  function aktualizuj() {
    const s = stoji();
    scena.classList.toggle('stoji', s);
    if (s) {
      if (timer) { zostava = Math.max(400, naplanovane - performance.now()); clearTimeout(timer); timer = 0; }
    } else if (!timer) {
      planuj(zostava || interval());
      zostava = 0;
    }
  }
  function krok() {
    timer = 0;
    if (stoji()) return;
    prepni(dalsiaVejara(UKAZKY, k), false);
    vymen += 1;
    if (vymen >= kolo) {
      stav.koniec = true;
      if (stop) stop.checked = true;
    }
    aktualizuj();
  }
  scena.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { stav.mys = true; aktualizuj(); } });
  scena.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { stav.mys = false; aktualizuj(); } });
  scena.addEventListener('focusin', () => { stav.fokus = true; aktualizuj(); });
  scena.addEventListener('focusout', (e) => { if (!scena.contains(e.relatedTarget)) { stav.fokus = false; aktualizuj(); } });
  d.addEventListener('visibilitychange', () => { stav.skryte = d.hidden; aktualizuj(); });
  if ('IntersectionObserver' in w) new IntersectionObserver((z) => { stav.mimo = !z[z.length - 1].isIntersecting; aktualizuj(); }, { threshold: 0.2 }).observe(vejarEl);
  if (stop) {
    stop.addEventListener('change', () => {
      stav.stop = stop.checked;
      if (!stop.checked) { stav.koniec = false; stav.rucne = false; vymen = 0; }
      aktualizuj();
    });
  }

  // Jemné naklonenie vejára za myšou na počítači (len transform, pružne doznie; pri obmedzenom pohybe nie).
  const hrdinaEl = d.querySelector('.hrdina');
  if (hrdinaEl && JEMNY.matches && !pokoj()) {
    let cx = 0; let cy = 0; let tx = 0; let ty = 0; let beh = 0;
    const kresli = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      vejarEl.style.transform = `perspective(1800px) rotateY(${(cx * 5).toFixed(2)}deg) rotateX(${(-cy * 3).toFixed(2)}deg)`;
      if (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) beh = requestAnimationFrame(kresli);
      else { beh = 0; if (!tx && !ty) vejarEl.style.transform = ''; }
    };
    hrdinaEl.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || MOBIL.matches) return;
      const r = vejarEl.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2 + 200)));
      ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2 + 200)));
      if (!beh) beh = requestAnimationFrame(kresli);
    });
    hrdinaEl.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (!beh) beh = requestAnimationFrame(kresli); });
  }

  // Štart: ?z= posunie vejár bez animácie; po načítaní stránky sa uvoľnia obrázky bočných kariet, vejár sa otvorí
  // a meno značky sa ukáže vo svojom písme. Potom začne jedno kolo samovoľného točenia.
  if (zdroj) {
    const z = startVejara(UKAZKY, zdroj);
    if (z > 0) {
      vejarEl.classList.add('bez');
      k = z;
      rozloz();
      uvolni(karty[k]);
      popis(UKAZKY[k], true);
      ziara(UKAZKY[k]);
      requestAnimationFrame(() => requestAnimationFrame(() => vejarEl.classList.remove('bez')));
    }
  }
  const u0 = UKAZKY[k];
  const ukazPopis = () => doCasu(pismoZnacky(u0), 1200).then(() => {
    if (popisEl) popisEl.classList.add('znacky', 'pripravena');
  });
  poNacitani(async () => {
    const s = strany();
    const bocne = [];
    for (let i = 0; i < n; i++) {
      const p = poz(i);
      if (p !== null && p !== 0 && Math.abs(p) <= s) bocne.push(uvolni(karty[i]));
    }
    await Promise.all([doCasu(Promise.all(bocne), 2500), ukazPopis()]);
    otvoreny = true;
    vejarEl.classList.add('otvoreny');
    rozloz();
    pismoZnacky(UKAZKY[dalsiaVejara(UKAZKY, k)]);
    if (!pokoj()) { zostava = 1500; aktualizuj(); }
  });
  if (UZKE.addEventListener) UZKE.addEventListener('change', () => { if (otvoreny) rozloz(); });
}

// ---------------------------------------------------------------- ukážky: filter, pevný náhľad (počítač), pás kariet (mobil)
const ukazkyTelo = d.querySelector('.ukazky-telo');
const zoznam = d.getElementById('riadky');
const PAS = mq('(max-width: 1023px)');
const NAHLAD_MQ = mq('(min-width: 1024px)');
let nahladUkaz = null;

if (ukazkyTelo && zoznam && riadky.length) {
  // Obrázky riadkov a písma mien sa načítajú, až keď je zoznam blízko (na počítači všetky malé, v páse postupne).
  let blizko = false;
  const pasIo = 'IntersectionObserver' in w ? new IntersectionObserver((z) => {
    for (const x of z) if (x.isIntersecting) { uvolni(x.target); pasIo.unobserve(x.target); }
  }, { root: zoznam, rootMargin: '0px 320px 0px 320px' }) : null;
  const priblizenie = () => {
    if (blizko) return;
    blizko = true;
    ukazkyTelo.classList.add('znacky');
    if (PAS.matches && pasIo) riadky.forEach((li) => pasIo.observe(li));
    else riadky.forEach((li) => uvolni(li));
    if (nahladUkaz && NAHLAD_MQ.matches) nahladUkaz(zdroj ? podla(zdroj) : UKAZKY[0], true);
  };
  if ('IntersectionObserver' in w) {
    // až po načítaní stránky (nesúperí s prvou obrazovkou) a keď je zoznam do 200 px pod oknom; pri 400 px sa na počítači
    // s výškou okna 900 (zoznam 395 px pod oknom) sťahovalo všetkých 15 dlaždíc a náhľad hneď pri prvom načítaní (V, 19. 11.)
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { io.disconnect(); poNacitani(priblizenie); } }, { rootMargin: '0px 0px 200px 0px' });
    io.observe(ukazkyTelo);
  } else poNacitani(priblizenie);
  // Keď sa zmení rozloženie (otočenie tabletu), riadky v novom režime dostanú svoje obrázky.
  PAS.addEventListener && PAS.addEventListener('change', () => { if (blizko) riadky.forEach((li) => uvolni(li)); });
}

// Pevný náhľad vedľa riadkov (od 1024 px): ukážka pod myšou alebo s fokusom, obraz sa v ráme pomaly posúva.
const nahladEl = d.getElementById('nahlad');
if (nahladEl && riadky.length) {
  const ram = nahladEl.querySelector('.nahlad-ram');
  const znackaN = d.getElementById('nahlad-znacka');
  const stylN = d.getElementById('nahlad-styl');
  const pismaN = d.getElementById('nahlad-pisma');
  let aktivny = null;
  let poradie = 0;
  nahladUkaz = async (u, prvy) => {
    if (!u || (u.slug === aktivny && !prvy)) return;
    aktivny = u.slug;
    const moje = ++poradie;
    riadky.forEach((li) => li.classList.toggle('aktivny', li.dataset.slug === u.slug && !prvy));
    let im = ram.querySelector('img');
    const src = ram.querySelector('picture > source[media]');
    if (src) src.remove();
    if (!prvy) im.classList.add('mizne');
    const nove = new Image();
    nove.alt = '';
    nove.width = 560;
    nove.height = 700;
    nove.decoding = 'async';
    nove.sizes = im.getAttribute('sizes') || '(min-width: 1600px) 577px, (min-width: 1280px) 493px, calc((100vw - 96px) * 5 / 12)';
    nove.srcset = [400, 493, 577, 620, 740, 866, 986, 1160, 1480, 1740].map((s) => `${N}${u.slug}-kurzor-${s}.webp ${s}w`).join(', ');
    nove.src = `${N}${u.slug}-kurzor-493.webp`;
    await Promise.all([doCasu(nove.decode ? nove.decode().catch(() => {}) : Promise.resolve(), 1500), prvy ? null : cakaj(140), pismoZnacky(u)]);
    if (moje !== poradie) return;
    im = ram.querySelector('img');
    nahladEl.classList.remove('posuva');
    nove.className = 'mizne';
    im.replaceWith(nove);
    nastavZnacku(znackaN, u);
    if (stylN) stylN.textContent = `štýl ${u.styl}`;
    if (pismaN) pismaN.textContent = nbsp(`Písma ${u.pisma}`);
    nahladEl.style.setProperty('--nahlad-h', `${ram.clientHeight}px`);
    void nove.offsetWidth;
    nove.classList.remove('mizne');
    if (!pokoj()) nahladEl.classList.add('posuva');
  };
  for (const li of riadky) {
    const a = li.querySelector('.riadok-a');
    const u = podla(li.dataset.slug);
    a.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && NAHLAD_MQ.matches) nahladUkaz(u); });
    a.addEventListener('focus', () => { if (NAHLAD_MQ.matches) nahladUkaz(u); });
  }
  w.addEventListener('resize', () => nahladEl.style.setProperty('--nahlad-h', `${ram.clientHeight}px`), { passive: true });
}

// Filter štýlov (segmentový prepínač z /motion/), na počítači riadky FLIP 300 ms, v páse návrat na začiatok.
const filterObal = d.querySelector('.filter-obal');
if (filterObal && riadky.length) {
  const koren = filterObal.querySelector('.filter');
  const pocetEl = d.getElementById('filter-pocet');
  const nieJe = d.getElementById('nie-je-odkaz');
  const filtruj = (v) => {
    if (v !== 'vsetky' && !SKUPINY.has(v)) return;
    const pred = new Map(riadky.map((li) => [li, li.hidden ? null : li.getBoundingClientRect().top]));
    let n = 0;
    for (const li of riadky) {
      const ok = v === 'vsetky' || li.dataset.styl === v;
      li.hidden = !ok;
      if (ok) n += 1;
    }
    if (pocetEl) pocetEl.textContent = ukazok(n);
    // štýl patrí len odkazu na dotazník; odkaz do kalkulačky (#kalkulacka) ostáva na tejto stránke bez parametrov
    if (nieJe && (nieJe.getAttribute('href') || '').startsWith('/web/dotaznik/')) nastavDotaznik('styl', v === 'vsetky' ? null : v, [nieJe]);
    if (PAS.matches) {
      zoznam.scrollTo({ left: 0, behavior: pokoj() ? 'auto' : 'smooth' });
      riadky.forEach((li) => { if (!li.hidden) uvolni(li); });
      return;
    }
    const prvy = riadky.find((li) => !li.hidden);
    if (prvy && nahladUkaz) nahladUkaz(podla(prvy.dataset.slug));
    if (pokoj()) return;
    for (const li of riadky) {
      if (li.hidden) continue;
      const a = pred.get(li);
      const b = li.getBoundingClientRect().top;
      if (a === null) li.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: VSTUP });
      else if (Math.abs(a - b) > 1) li.animate([{ transform: `translateY(${a - b}px)` }, { transform: 'none' }], { duration: 300, easing: VSTUP });
    }
  };
  let hotovy = false;
  const vytvor = () => {
    if (hotovy) return;
    hotovy = true;
    // Miesto pre prepínač je v rozložení od začiatku (visibility), takže jeho zobrazenie nič neposunie.
    import('/motion/components/segmented/segmented.js').then(({ createSegmented }) => {
      createSegmented({ root: koren, onChange: (i, v) => filtruj(v) });
      filterObal.classList.remove('cak');
    }).catch(() => {});
  };
  if ('IntersectionObserver' in w) {
    const blizko = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { blizko.disconnect(); vytvor(); } }, { rootMargin: '0px 0px 200px 0px' });
    blizko.observe(d.getElementById('ukazky') || filterObal);
  } else poNacitani(vytvor);
}

// Šípky pásu kariet (mobil a tablet, aj pre myš bez vodorovného posunu).
const pasSpat = d.getElementById('pas-spat');
const pasDalej = d.getElementById('pas-dalej');
if (zoznam && pasSpat && pasDalej) {
  const krok = () => {
    const li = riadky.find((x) => !x.hidden);
    return li ? li.getBoundingClientRect().width + 16 : 240;
  };
  const stavSipok = () => {
    pasSpat.disabled = zoznam.scrollLeft < 4;
    pasDalej.disabled = zoznam.scrollLeft + zoznam.clientWidth >= zoznam.scrollWidth - 4;
  };
  pasSpat.addEventListener('click', () => zoznam.scrollBy({ left: -krok(), behavior: pokoj() ? 'auto' : 'smooth' }));
  pasDalej.addEventListener('click', () => zoznam.scrollBy({ left: krok(), behavior: pokoj() ? 'auto' : 'smooth' }));
  zoznam.addEventListener('scroll', () => requestAnimationFrame(stavSipok), { passive: true });
  w.addEventListener('resize', stavSipok, { passive: true });
  poPrvomSnimku(stavSipok);
}

// ---------------------------------------------------------------- mobil: dlhé zoznamy zbalené s tlačidlom (S9)
const UZKY = mq('(max-width: 760px)');
function zbalovac(cielEl, tlacidlo) {
  if (!cielEl || !tlacidlo) return;
  let otvorene = false;
  const nastav = () => {
    const zbal = UZKY.matches && !otvorene;
    cielEl.classList.toggle('zbalene', zbal);
    tlacidlo.hidden = !UZKY.matches;
    tlacidlo.setAttribute('aria-expanded', String(!zbal));
  };
  const text = tlacidlo.textContent;
  tlacidlo.addEventListener('click', () => {
    otvorene = !otvorene;
    tlacidlo.textContent = otvorene ? 'Zbaliť' : text;
    nastav();
  });
  if (UZKY.addEventListener) UZKY.addEventListener('change', nastav);
  nastav();
}
zbalovac(d.getElementById('fakty'), d.getElementById('fakty-viac'));
zbalovac(d.querySelector('.pruhy-obal'), d.getElementById('pruhy-viac'));

// ---------------------------------------------------------------- telefón naživo (od 1024 px, rám až po kliknutí)
const telVelky = d.getElementById('tel-velky');
if (telVelky) {
  const obal = d.getElementById('nazivo-tel');
  const obrazovka = telVelky.querySelector('.tel-obr');
  let plagat = telVelky.querySelector('.tel-plagat');
  const spustit = d.getElementById('spustit');
  const cela = d.getElementById('nazivo-cela');
  const radia = [...d.querySelectorAll('input[name="nazivo"]')];
  let vybrany = (radia.find((r) => r.checked) || {}).value || UKAZKY[0].slug;
  let ram = null;
  let poradie = 0;
  const nacitajRam = (u) => {
    ram.classList.remove('nacitane');
    ram.title = `Ukážka ${u.meno} naživo`;
    ram.src = u.href;
  };
  const vyber = async (slug) => {
    const u = podla(slug);
    if (!u) return;
    vybrany = slug;
    const moje = ++poradie;
    spustit.setAttribute('data-umami-event-target', slug);
    // odkaz sa mení po štarte, preto utm z adresy znova (inak by ho prenos pri štarte stratil, nález 46)
    let celaHref = u.href;
    try { celaHref = sUtm(u.href, utmZAdresy(w.location.search), w.location.origin); } catch (e) { celaHref = u.href; }
    cela.setAttribute('href', celaHref);
    cela.setAttribute('data-umami-event-target', slug);
    const nove = plagat.cloneNode(false);
    nove.removeAttribute('loading');
    nove.sizes = '286px';
    nove.srcset = [218, 251, 286, 316, 360, 400, 452, 502, 572, 654, 753, 858, 960].map((s) => `${N}${slug}-telefon-${s}.webp ${s}w`).join(', ');
    nove.src = `${N}${slug}-telefon-286.webp`;
    nove.alt = `Náhľad ukážky ${u.meno} v telefóne`;
    try { await nove.decode(); } catch (e) { /* zobrazí sa po načítaní */ }
    if (moje !== poradie) return;
    nove.classList.add('nove');
    plagat.after(nove);
    if (!pokoj()) {
      try { await nove.animate([{ clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 420, easing: POHYB }).finished; } catch (e) { /* prerušené */ }
    }
    if (moje !== poradie) { nove.remove(); return; }
    plagat.remove();
    nove.classList.remove('nove');
    plagat = nove;
    if (ram) nacitajRam(u);
  };
  radia.forEach((r) => r.addEventListener('change', () => { if (r.checked && POVOLENE.has(r.value)) vyber(r.value); }));
  spustit.addEventListener('click', () => {
    const u = podla(vybrany);
    if (!u) return;
    if (!ram) {
      ram = d.createElement('iframe');
      ram.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      ram.addEventListener('load', () => ram.classList.add('nacitane'));
      obrazovka.append(ram);
    }
    nacitajRam(u);
    if (obal) obal.classList.add('bezi');
  });
}

// ---------------------------------------------------------------- rýchlosť: pruhy rastú a čísla sa pretočia, raz
const pruhy = [...d.querySelectorAll('.pruhy li')];
if (pruhy.length && !pokoj() && 'IntersectionObserver' in w) poPrvomSnimku(() => {
  if (pruhy[0].getBoundingClientRect().top <= w.innerHeight) return;
  const ciary = pruhy.map((li) => li.querySelector('i'));
  ciary.forEach((c) => { if (c) c.style.transform = 'scaleX(0)'; });
  let cisla = null;
  const priprav = () => {
    if (!cisla) cisla = import('/motion/components/number/number.js').then((m) => m.createNumber).catch(() => null);
    return cisla;
  };
  const zoz = d.querySelector('.pruhy');
  const blizko = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { blizko.disconnect(); priprav(); } }, { rootMargin: '0px 0px 900px 0px' });
  blizko.observe(zoz);
  const io = new IntersectionObserver((e) => {
    if (!e.some((x) => x.isIntersecting)) return;
    io.disconnect();
    ciary.forEach((c, i) => {
      if (!c) return;
      c.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 900, delay: i * 70, easing: VSTUP, fill: 'backwards' });
      c.style.transform = '';
    });
    priprav().then((createNumber) => {
      if (!createNumber) return;
      pruhy.forEach((li, i) => {
        const el = li.querySelector('[data-cislo]');
        const ciel = Number(el.getAttribute('data-cislo'));
        const num = createNumber({ el, value: 0, decimals: 0, locale: 'sk' });
        setTimeout(() => num.set(ciel), 40 + i * 70);
      });
    });
  }, { threshold: 0.25 });
  io.observe(zoz);
});

// ---------------------------------------------------------------- postup: signál krokmi, raz
const kroky = d.querySelector('.kroky');
if (kroky && !pokoj() && 'IntersectionObserver' in w) poPrvomSnimku(() => {
  if (kroky.getBoundingClientRect().top <= w.innerHeight) return;
  kroky.classList.add('pred');
  const io = new IntersectionObserver((e) => {
    if (!e.some((x) => x.isIntersecting)) return;
    io.disconnect();
    kroky.classList.remove('pred');
    kroky.classList.add('hra');
  }, { threshold: 0.5 });
  io.observe(kroky);
});

// ---------------------------------------------------------------- otázky: akordeón s výškou 300 ms (natívne <details>)
for (const det of d.querySelectorAll('.faq details')) {
  const sum = det.querySelector('summary');
  const obsah = det.querySelector('.odpoved');
  if (!sum || !obsah) continue;
  sum.addEventListener('click', (e) => {
    if (pokoj() || !obsah.animate) return;
    e.preventDefault();
    if (det.dataset.anim) return;
    det.dataset.anim = '1';
    obsah.style.overflow = 'hidden';
    const hotovo = () => { obsah.style.overflow = ''; det.classList.remove('zatvara'); delete det.dataset.anim; };
    if (det.open) {
      det.classList.add('zatvara');
      const a = obsah.animate([{ height: obsah.offsetHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 240, easing: VSTUP });
      a.onfinish = () => { det.open = false; hotovo(); };
      a.oncancel = hotovo;
    } else {
      det.open = true;
      const a = obsah.animate([{ height: '0px', opacity: 0 }, { height: obsah.offsetHeight + 'px', opacity: 1 }], { duration: 300, easing: VSTUP });
      a.onfinish = hotovo;
      a.oncancel = hotovo;
    }
  });
}
if (w.location.hash.startsWith('#otazka-')) {
  // Poškodená kotva (napríklad samotné %) by v decodeURIComponent hodila URIError a zastavila zvyšok modulu.
  let id = '';
  try { id = decodeURIComponent(w.location.hash.slice(1)); } catch (e) { id = ''; }
  const det = id ? d.getElementById(id) : null;
  if (det && det.tagName === 'DETAILS') det.open = true;
}

// ---------------------------------------------------------------- vstupy sekcií (ako úvod hubu): rozmazanie, posun, mierka, raz
// Knižnica pohybu (/motion/src/core.js) sa načíta až po prvom vykreslení: prvky pod ohybom sa skryjú, až keď je pripravená.
if (!pokoj() && 'IntersectionObserver' in w) poNacitani(() => import('/motion/src/core.js').then(({ presence, driver }) => {
  const prvky = [...d.querySelectorAll('[data-vstup]')].filter((el) => el.getBoundingClientRect().top > w.innerHeight * 0.9);
  if (!prvky.length) return;
  const stavy = new Map(prvky.map((el) => [el, presence(false, { blur: 8, dyIn: 18, scaleFrom: 0.97 })]));
  const vstup = (el, s) => {
    el.style.opacity = String(s.opacity);
    el.style.filter = s.blur > 0.05 ? `blur(${s.blur.toFixed(2)}px)` : '';
    el.style.transform = `translateY(${s.y.toFixed(2)}px) scale(${s.scale.toFixed(4)})`;
  };
  const vstupene = new Set();
  const kresli = driver((t) => {
    for (const [el, p] of stavy) {
      if (vstupene.has(el) && p.settled(t)) {
        el.style.opacity = '';
        el.style.filter = '';
        el.style.transform = '';
        stavy.delete(el);
        continue;
      }
      vstup(el, p.at(t));
    }
  });
  kresli.busy = (t) => [...stavy.entries()].some(([el, p]) => vstupene.has(el) && !p.settled(t));
  for (const [el, p] of stavy) vstup(el, p.at(0));
  const io = new IntersectionObserver((e) => {
    const t0 = kresli.now();
    const nove = e.filter((x) => x.isIntersecting).map((x) => x.target);
    nove.forEach((el, i) => {
      const p = stavy.get(el);
      if (p) { p.enter(t0 + i * 0.07); vstupene.add(el); }
      io.unobserve(el);
    });
    if (nove.length) kresli.kick();
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
  prvky.forEach((el) => io.observe(el));
}).catch(() => {}));

// ---------------------------------------------------------------- lepiaca lišta na mobile a Späť na začiatok
// Lišta sa ukáže, keď hlavné tlačidlo hrdinu odíde z obrazovky hore; skrytá pri balíkoch cenníka, kalkulačke (nesmie
// zakryť pole dopytu), závere a päte.
const akcie = d.querySelector('.hrdina .akcie');
const hrdinaSekcia = d.querySelector('.hrdina');
const lista = d.getElementById('lista');
const hore = d.getElementById('hore-tl');
if (akcie && hrdinaSekcia && 'IntersectionObserver' in w) {
  let zaTlacidlom = false;
  let zaHrdinom = false;
  const zakryte = new Set();
  const nastav = () => {
    if (lista) {
      const v = zaTlacidlom && zakryte.size === 0;
      lista.classList.toggle('ukaz', v);
      lista.inert = !v;
      lista.setAttribute('aria-hidden', String(!v));
    }
    if (hore) hore.classList.toggle('ukaz', zaHrdinom);
  };
  new IntersectionObserver((z) => {
    const x = z[z.length - 1];
    zaTlacidlom = !x.isIntersecting && x.boundingClientRect.top < 0;
    nastav();
  }).observe(akcie);
  new IntersectionObserver((z) => {
    const x = z[z.length - 1];
    zaHrdinom = !x.isIntersecting && x.boundingClientRect.top < 0;
    nastav();
  }).observe(hrdinaSekcia);
  const io = new IntersectionObserver((z) => {
    for (const x of z) { if (x.isIntersecting) zakryte.add(x.target); else zakryte.delete(x.target); }
    nastav();
  });
  [d.querySelector('.baliky'), d.getElementById('kalkulacka'), d.getElementById('kontakt'), d.querySelector('.pata')].forEach((el) => { if (el) io.observe(el); });
}

// ---------------------------------------------------------------- kalkulačka a krátky dopyt (cenník 4.1, SPEC 3.3)
// Modul /web/kalkulacka.js a dáta /web/cennik.js sa načítajú lenivo, až keď je kalkulačka do 900 px pod oknom, pri kotve
// #kalkulacka alebo #dopyt, pri ?ukazka= alebo ?b= v adrese, alebo pri prvom dotyku výzvy, ktorá do kalkulačky vedie
// (pri štarte stránky nepribudne žiadna práca, R15). Adresy modulov sú v atribútoch sekcie, ktoré píše generátor, a berú
// sa len v presnom tvare /web/<súbor>.js?v=<8 znakov>. Keď sa modul nenačíta, sekcia ukáže vetu s cenníkom a e-mailom.
const kalkEl = d.getElementById('kalkulacka');
const KALK_MODUL = /^\/web\/kalkulacka\.js\?v=[0-9a-f]{8}$/;
const KALK_CENNIK = /^\/web\/cennik\.js\?v=[0-9a-f]{8}$/;
const KALK_BALIKY = new Set(['jednostrankovy', 'firemny', 'referencie', 'eshop']);
let kalkSlub = null;
function kalkulacka() {
  if (kalkSlub) return kalkSlub;
  const m = kalkEl ? kalkEl.getAttribute('data-modul') || '' : '';
  const c = kalkEl ? kalkEl.getAttribute('data-cennik') || '' : '';
  if (!KALK_MODUL.test(m) || !KALK_CENNIK.test(c)) {
    if (kalkEl) kalkEl.classList.add('kalk-chyba');
    kalkSlub = Promise.resolve(null);
    return kalkSlub;
  }
  kalkSlub = import(c).then(() => import(m)).then((mod) => {
    const api = mod.spusti(kalkEl, {});
    if (!api) throw new Error('kalkulačka sa nespustila');
    return api;
  }).catch(() => {
    kalkEl.classList.add('kalk-chyba');
    return null;
  });
  return kalkSlub;
}
if (kalkEl) {
  let q = null;
  try { q = new URLSearchParams(w.location.search); } catch (e) { q = null; }
  // Kontrola 23. 11. 2026: predvoľba z adresy (?b=, ?ukazka=) po spustení modulu zmení výšku formulára nad #dopyt, a keď
  // prehliadač posunul stránku na kotvu skôr, cieľ skončil o 90 až 250 px nižšie alebo pod hlavičkou (Chrome aj Firefox).
  // Kotva do kalkulačky sa preto po spustení zarovná znova, ešte pred ďalším snímkom, ale len kým človek nezasiahol
  // (koliesko, dotyk, kláves, klik): staršia operácia neprepíše novší stav (AGENTS 12).
  let zasah = false;
  for (const t of ['wheel', 'touchstart', 'keydown', 'pointerdown']) w.addEventListener(t, () => { zasah = true; }, { once: true, passive: true, capture: true });
  const zarovnaj = (api) => {
    const k = w.location.hash.slice(1);
    const el = api && !zasah && /^(kalkulacka|dopyt)$/.test(k) ? d.getElementById(k) : null;
    if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' });
  };
  if (/^#(kalkulacka|dopyt)$/.test(w.location.hash) || (q && (q.has('ukazka') || q.has('b')))) poPrvomSnimku(() => kalkulacka().then(zarovnaj));
  if ('IntersectionObserver' in w) {
    const io = new IntersectionObserver((z) => { if (z.some((x) => x.isIntersecting)) { io.disconnect(); kalkulacka(); } }, { rootMargin: '0px 0px 900px 0px' });
    io.observe(kalkEl);
  } else poNacitani(kalkulacka);
  const VYZVA = 'a[href="#kalkulacka"], a[href="#dopyt"], a[data-balik]';
  d.addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest(VYZVA)) kalkulacka(); }, { passive: true });
  d.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest(VYZVA);
    if (!a) return;
    const b = a.getAttribute('data-balik');
    kalkulacka().then((api) => { if (api && b && KALK_BALIKY.has(b)) api.balik(b); });
  });
  w.addEventListener('hashchange', () => { if (/^#(kalkulacka|dopyt)$/.test(w.location.hash)) kalkulacka(); });
}
if (hore) {
  hore.addEventListener('click', () => {
    w.scrollTo({ top: 0, behavior: pokoj() ? 'auto' : 'smooth' });
    const h1 = d.getElementById('nadpis');
    if (h1) {
      h1.setAttribute('tabindex', '-1');
      h1.focus({ preventScroll: true });
      h1.addEventListener('blur', () => h1.removeAttribute('tabindex'), { once: true });
    }
  });
}
