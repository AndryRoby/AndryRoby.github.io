// kodfilm/prehravac.js: prehrávač filmu nakresleného kódom.
// Výkon: requestAnimationFrame beží len počas prehrávania; mimo obrazovky (IntersectionObserver)
// a v skrytej karte (document.hidden) sa film aj zvuk pozastavia; devicePixelRatio najviac 2
// (na slabom zariadení 1.5); prefers-reduced-motion ukáže statický plagát.
// Render: window.__vykresli(t) kreslí presne snímku v čase t, window.__zvuk() vráti WAV v base64.
// Ovládače (28. 9. 2026, brána filmov pokus 2): Sound počas pauzy nemení zastavený čas, Resume
// pokračuje presne odtiaľ; dozvuk po konci ostáva ovládateľný, Sound off aj Play again ho zastavia hneď.
// Súbehy (pokus 3): po každom await platí len najnovší krok (token), zvukové pauzy a obnovy idú za sebou
// a keď zvuk medzitým vypli, film pokračuje zo zastaveného času na hodinách výkonu.

import { ZivyZvuk, renderOffline, wav, base64 } from './zvuk.js';

const redukovany = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Odkazy nad plátnom sú neviditeľné: tlačidlo je nakreslené vo filme, odkaz nad ním len zachytí klik.
// Globálne štýly stránky (napr. a:hover { color } a a { text-decoration }) majú vyššiu špecificitu ako
// jedna trieda, preto: vložený štýl na každom odkaze (prebije každé pravidlo bez !important) plus
// konštruovaný štýl pre :focus-visible (rámik len pri klávesnici). Konštruovaný štýl nepodlieha CSP.
const CSS_ODKAZOV = `.kf-odkazy>a.kf-odkaz,.kf-odkazy>a.kf-odkaz:hover,.kf-odkazy>a.kf-odkaz:visited,.kf-odkazy>a.kf-odkaz:active{color:transparent!important;text-decoration:none!important;text-shadow:none!important;background:transparent!important;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.kf-odkazy>a.kf-odkaz:focus{outline:none}
.kf-odkazy>a.kf-odkaz:focus-visible{outline:3px solid #fff;outline-offset:3px;box-shadow:0 0 0 6px rgba(0,0,0,.55)}`;
let stylyVlozene = false;
function vlozStyly() {
  if (stylyVlozene) return;
  stylyVlozene = true;
  try {
    const s = new CSSStyleSheet();
    s.replaceSync(CSS_ODKAZOV);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, s];
  } catch { /* starý prehliadač: ostane vložený štýl na odkaze */ }
}
const STYL_ODKAZU = { color: 'transparent', textDecoration: 'none', textShadow: 'none', background: 'transparent', cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', userSelect: 'none', webkitTapHighlightColor: 'transparent' };

/**
 * film = {
 *   dlzka, plagat (čas plagátu pred ťuknutím aj pri zníženom pohybe), zvuk: [udalosti], titulky: [{ od, text }],
 *   pripravit(env) async (písma), vrstvy(W, H, dpr, env), kresli(ctx, t, W, H, env),
 *   odkazy(W, H) -> [{ x, y, w, h, href, text, od, casy, udalost }] (neviditeľné, nad nakresleným tlačidlom;
 *     casy = [[od, do], ...] okná, keď je tlačidlo nakreslené, inak jedno okno od `od` do konca),
 *   stredPlagatu(W, H) -> [x, y] voliteľne: kam dať tlačidlo prehrať (CSS --kf-play-x, --kf-play-y)
 * }
 * koren = element s [data-kf-platno] canvasom a voliteľnými ovládačmi:
 *   [data-kf-start], [data-kf-pauza], [data-kf-zvuk], [data-kf-znova], [data-kf-odkazy], [data-kf-titulok]
 * ovladace = voliteľný element, kde sa hľadá ovládač, ktorý nie je v koreni (lišta pod filmom, titulok)
 */
export async function prehravac(film, koren, { render = false, ovladace = null } = {}) {
  const platno = koren.querySelector('[data-kf-platno]');
  const ctx = platno.getContext('2d', { alpha: false });
  const $ = (s) => koren.querySelector(s) ?? ovladace?.querySelector(s) ?? null;
  const ui = { start: $('[data-kf-start]'), pauza: $('[data-kf-pauza]'), zvuk: $('[data-kf-zvuk]'), znova: $('[data-kf-znova]'), odkazy: $('[data-kf-odkazy]'), titulok: $('[data-kf-titulok]') };
  const jadra = navigator.hardwareConcurrency || 8;
  const env = { render, slabe: !render && jadra <= 4, dpr: 1, W: 0, H: 0 };

  let stav = 'obal'; // obal | hra | pauza | koniec | plagat
  let t = 0, p0 = 0, raf = 0, zvuk = null, zvukZapnuty = true, skryte = false, mimo = false;
  let odkazyEl = [], poslednyTitulok = -1;
  // doznieva: zvuk po konci filmu, kým nedoznie dozvuk (ovládateľný až do odpojenia);
  // zvukCaka: Sound on počas pauzy, zvuk sa rozbehne pri pokračovaní; beh: poradie spustení;
  // krok: token posledného Play, Pause alebo Resume; rozbieha: beh, ktorého zvuk sa ešte rozbieha
  let doznieva = null, casovacDozvuku = 0, zvukCaka = false, beh = 0, krok = 0, rozbieha = 0;
  // suspend a resume jedného zvuku za sebou: Resume počká na prebiehajúcu Pause a naopak;
  // zlyhanie na zavretom kontexte (Sound off počas čakania) film nezastaví
  let frontaZvuku = Promise.resolve();
  const doFronty = (z, pauza) => (frontaZvuku = frontaZvuku.then(() => (pauza ? z.pauza() : z.pokracuj())).catch(() => {}));
  const vykon = { snimky: 0, kresbaMs: 0, kresbaMax: 0, intervaly: [], bezi: false };
  Object.defineProperty(vykon, 'slabe', { get: () => env.slabe, enumerable: true });
  // pre testy ovládačov: filmový čas a stav zvukových kontextov (hrajúci a doznievajúci)
  Object.defineProperty(vykon, 'cas', { get: () => t, enumerable: true });
  Object.defineProperty(vykon, 'zvuk', { get: () => ({ hra: zvuk?.ctx?.state ?? null, doznieva: doznieva?.ctx?.state ?? null }), enumerable: true });
  window.__vykon = vykon;

  if (film.pripravit) await film.pripravit(env);

  function rozmer() {
    const r = platno.getBoundingClientRect();
    const W = render ? window.innerWidth : Math.max(1, Math.round(r.width));
    const H = render ? window.innerHeight : Math.max(1, Math.round(r.height));
    const dpr = render ? (window.devicePixelRatio || 1) : Math.min(env.slabe ? 1.5 : 2, window.devicePixelRatio || 1);
    if (W === env.W && H === env.H && dpr === env.dpr) return false;
    Object.assign(env, { W, H, dpr });
    platno.width = Math.round(W * dpr);
    platno.height = Math.round(H * dpr);
    film.vrstvy(W, H, dpr, env);
    postavOdkazy();
    // tlačidlo prehrať na plagáte: film povie, kde je stred najsilnejšieho záberu (napr. stred dosky)
    if (!render && film.stredPlagatu) {
      const [px, py] = film.stredPlagatu(W, H);
      koren.style.setProperty('--kf-play-x', `${((px / W) * 100).toFixed(2)}%`);
      koren.style.setProperty('--kf-play-y', `${((py / H) * 100).toFixed(2)}%`);
    }
    return true;
  }

  function kresli(cas) {
    const a = performance.now();
    ctx.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
    film.kresli(ctx, cas, env.W, env.H, env);
    const d = performance.now() - a;
    vykon.snimky++; vykon.kresbaMs += d; if (d > vykon.kresbaMax) vykon.kresbaMax = d;
    ukazOdkazy(cas);
  }

  function postavOdkazy() {
    if (!ui.odkazy || !film.odkazy) return;
    ui.odkazy.textContent = '';
    odkazyEl = film.odkazy(env.W, env.H).map((o) => {
      const a = document.createElement('a');
      a.href = o.href;
      a.textContent = o.text;
      a.className = 'kf-odkaz';
      if (o.udalost) a.setAttribute('data-umami-event', o.udalost);
      if (/^https?:/.test(o.href) && !o.href.includes(location.host)) a.rel = 'noopener';
      Object.assign(a.style, STYL_ODKAZU, { position: 'absolute', display: 'block', pointerEvents: 'auto', left: `${(o.x / env.W) * 100}%`, top: `${(o.y / env.H) * 100}%`, width: `${(o.w / env.W) * 100}%`, height: `${(o.h / env.H) * 100}%` });
      a.hidden = true;
      ui.odkazy.appendChild(a);
      // casy: [[od, do], ...] okná, keď je tlačidlo nakreslené; bez nich jedno okno od o.od do konca
      return { a, casy: o.casy ?? [[o.od ?? 0, Infinity]] };
    });
  }
  function ukazOdkazy(cas) {
    // odkaz len tam, kde je jeho tlačidlo nakreslené (na plagáte teda len ak plagát padne do okna);
    // aj na plagáte pred ťuknutím: odkaz leží nad tlačidlom spustenia, klik mimo neho film spustí
    for (const o of odkazyEl) o.a.hidden = !(stav === 'koniec' || o.casy.some(([a, b]) => cas >= a && cas < b));
  }
  function titulky(cas) {
    if (!ui.titulok || !film.titulky) return;
    let i = -1;
    film.titulky.forEach((x, j) => { if (cas >= x.od) i = j; });
    if (i !== poslednyTitulok) { poslednyTitulok = i; ui.titulok.textContent = i >= 0 ? film.titulky[i].text : ''; }
  }

  function nastavStav(s) {
    stav = s;
    koren.dataset.kfStav = s;
    if (ui.pauza) { ui.pauza.textContent = s === 'pauza' ? 'Resume' : 'Pause'; ui.pauza.hidden = !(s === 'hra' || s === 'pauza'); }
    if (ui.znova) ui.znova.hidden = s !== 'koniec';
    if (ui.start) ui.start.hidden = !(s === 'obal' || s === 'plagat');
  }

  // --- hodiny: zvukové (ak hrá zvuk), inak performance.now ---
  const teraz = () => (performance.now() - p0) / 1000;

  function snimka(now) {
    raf = 0;
    if (stav !== 'hra') return;
    const posledna = vykon._posledna;
    if (posledna) { vykon.intervaly.push(now - posledna); if (vykon.intervaly.length > 900) vykon.intervaly.shift(); }
    vykon._posledna = now;
    t = Math.max(0, teraz());
    if (zvuk) zvuk.tik(t);
    if (t >= film.dlzka) {
      t = film.dlzka;
      kresli(t);
      koniec();
      return;
    }
    kresli(t);
    titulky(t);
    sledujSlabe();
    raf = requestAnimationFrame(snimka);
  }
  function behaj() { if (!raf && stav === 'hra' && !skryte && !mimo) { vykon._posledna = 0; vykon.bezi = true; raf = requestAnimationFrame(snimka); } }
  function stoj() { if (raf) cancelAnimationFrame(raf); raf = 0; vykon.bezi = false; }

  // Slabé zariadenie: ak priemerný interval snímok po rozbehu prekročí 22 ms, film uberie jemné animácie.
  function sledujSlabe() {
    if (env.slabe || env.render) return;
    const iv = vykon.intervaly;
    if (iv.length < 75) return;
    const posl = iv.slice(-45);
    const priemer = posl.reduce((a, b) => a + b, 0) / posl.length;
    if (priemer > 22) env.slabe = true;
  }

  function zastavDozvuk() {
    clearTimeout(casovacDozvuku);
    casovacDozvuku = 0;
    if (doznieva) { doznieva.zastav(); doznieva = null; }
  }

  // Filmový čas sa z hodín číta len keď film naozaj beží (raf); v pauze platí uložené t.
  async function spusti(odT = 0) {
    const moj = ++beh;
    krok++;
    rozbieha = 0;
    stoj();
    zastavDozvuk();
    zvukCaka = false;
    if (zvuk) { zvuk.zastav(); zvuk = null; }
    nastavStav('hra');
    t = odT;
    p0 = performance.now() - odT * 1000; // kým sa zvuk rozbieha, hodiny výkonu
    if (zvukZapnuty && film.zvuk) {
      const z = new ZivyZvuk(film.zvuk);
      zvuk = z;
      rozbieha = moj;
      const ok = await z.spusti(odT).catch(() => false);
      if (moj !== beh) { z.zastav(); if (zvuk === z) zvuk = null; return; } // medzitým nové spustenie
      rozbieha = 0;
      if (zvuk !== z || !ok) { z.zastav(); if (zvuk === z) zvuk = null; } // medzitým Sound off, alebo zvuk nejde
    }
    // medzitým Pause, skrytá karta alebo film mimo obrazovky: čas drží pozastav(), zvuk stojí s filmom
    if (stav !== 'hra' || skryte || mimo) { if (zvuk) await doFronty(zvuk, true); return; }
    if (zvukCaka && !zvuk) return spusti(t);
    p0 = zvuk?.ctx ? zvuk.perfNula() : performance.now() - t * 1000;
    behaj();
  }
  async function pozastav(interne) {
    if (stav !== 'hra') return;
    krok++;
    if (raf) t = teraz();
    stoj();
    if (!interne) nastavStav('pauza');
    // počas rozbehu zvuku ho zastaví až spusti(), inak by suspend predbehol jeho resume
    if (zvuk && !rozbieha) await doFronty(zvuk, true);
  }
  // interne = návrat karty alebo filmu do obrazovky: pauzu od používateľa nezruší
  async function pokracuj(interne = false) {
    if (stav === 'pauza') { if (interne) return; nastavStav('hra'); }
    if (stav !== 'hra' || skryte || mimo || raf) return;
    if (rozbieha) return; // zvuk sa ešte rozbieha: film rozbehne spusti() po jeho dokončení
    if (zvukCaka && !zvuk) return spusti(t); // Sound on počas pauzy: zvuk od zastaveného času
    const moj = ++krok, z = zvuk;
    if (z) await doFronty(z, false);
    // medzitým Pause, Play again, skrytá karta alebo film mimo obrazovky: platí novší krok
    if (moj !== krok || stav !== 'hra' || skryte || mimo || raf) return;
    if (zvukCaka && !zvuk) return spusti(t); // medzitým Sound off a Sound on
    // medzitým Sound off: zvuk je preč, film ide zo zastaveného času na hodinách výkonu
    p0 = z && zvuk === z && z.ctx ? z.perfNula() : performance.now() - t * 1000;
    behaj();
  }
  function koniec() {
    stoj();
    nastavStav('koniec');
    titulky(film.dlzka);
    // nech doznie dozvuk; referencia ostáva, Sound off aj Play again ho zastavia hneď
    zastavDozvuk();
    doznieva = zvuk;
    zvuk = null;
    if (doznieva) casovacDozvuku = setTimeout(zastavDozvuk, 3500);
  }

  // --- ovládače ---
  if (ui.start) ui.start.addEventListener('click', () => spusti(0));
  if (ui.znova) ui.znova.addEventListener('click', () => spusti(film.bezObalu ?? 0));
  if (ui.pauza) ui.pauza.addEventListener('click', () => (stav === 'hra' ? pozastav(false) : pokracuj()));
  if (ui.zvuk) {
    const nastavZvuk = () => { ui.zvuk.setAttribute('aria-pressed', String(zvukZapnuty)); ui.zvuk.textContent = zvukZapnuty ? 'Sound on' : 'Sound off'; };
    nastavZvuk();
    ui.zvuk.addEventListener('click', () => {
      zvukZapnuty = !zvukZapnuty;
      nastavZvuk();
      if (!zvukZapnuty) {
        zvukCaka = false;
        zastavDozvuk();
        if (zvuk) {
          if (raf) t = teraz(); // v pauze ostáva uložený čas
          zvuk.zastav();
          zvuk = null;
          p0 = performance.now() - t * 1000;
        }
      } else if (stav === 'hra' && raf) spusti(teraz());
      else if (stav === 'hra' || stav === 'pauza') zvukCaka = true;
    });
  }

  if (!render) {
    document.addEventListener('visibilitychange', () => {
      skryte = document.hidden;
      if (skryte) pozastav(true); else pokracuj(true);
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((z) => {
        mimo = !z[0].isIntersecting;
        if (mimo) pozastav(true); else pokracuj(true);
      }, { threshold: 0.2 }).observe(platno);
    }
    let casovacRozmeru = 0;
    new ResizeObserver(() => {
      clearTimeout(casovacRozmeru);
      casovacRozmeru = setTimeout(() => { if (rozmer() && stav !== 'hra') kresli(t); }, 120);
    }).observe(platno);
  }

  // --- rozhranie pre render ---
  window.__vykresli = (cas) => { rozmer(); t = cas; kresli(cas); return true; };
  window.__zvuk = async ({ od = 0, do: dokedy = film.dlzka } = {}) => base64(wav(await renderOffline(film.zvuk || [], dokedy), od, dokedy));
  window.__film = { dlzka: film.dlzka, plagat: film.plagat };

  if (!render) vlozStyly();
  rozmer();
  // Pred ťuknutím stránka ukazuje plagát (film.plagat = najsilnejší záber, typicky stred háku),
  // nie snímku 0. Pri zníženom pohybe ostane plagát aj s viditeľnými odkazmi, film len na želanie.
  if (!render && film.plagat != null) t = film.plagat;
  if (!render && redukovany() && film.plagat != null) {
    nastavStav('plagat');
    if (ui.start) ui.start.dataset.kfPohyb = 'redukovany';
  } else nastavStav('obal');
  kresli(t);
  window.__pripraveny = true;
  return { spusti, pozastav: () => pozastav(false), pokracuj: () => pokracuj(), env, vykon };
}
