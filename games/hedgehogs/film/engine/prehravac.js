// kodfilm/prehravac.js: prehrávač filmu nakresleného kódom.
// Výkon: requestAnimationFrame beží len počas prehrávania; mimo obrazovky (IntersectionObserver)
// a v skrytej karte (document.hidden) sa film aj zvuk pozastavia; devicePixelRatio najviac 2
// (na slabom zariadení 1.5); prefers-reduced-motion ukáže statický plagát.
// Render: window.__vykresli(t) kreslí presne snímku v čase t, window.__zvuk() vráti WAV v base64.

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
 *   odkazy(W, H) -> [{ x, y, w, h, href, text, od, udalost }] (neviditeľné, nad nakresleným tlačidlom),
 *   stredPlagatu(W, H) -> [x, y] voliteľne: kam dať tlačidlo prehrať (CSS --kf-play-x, --kf-play-y)
 * }
 * koren = element s [data-kf-platno] canvasom a voliteľnými ovládačmi:
 *   [data-kf-start], [data-kf-pauza], [data-kf-zvuk], [data-kf-znova], [data-kf-odkazy], [data-kf-titulok]
 */
export async function prehravac(film, koren, { render = false } = {}) {
  const platno = koren.querySelector('[data-kf-platno]');
  const ctx = platno.getContext('2d', { alpha: false });
  const $ = (s) => koren.querySelector(s);
  const ui = { start: $('[data-kf-start]'), pauza: $('[data-kf-pauza]'), zvuk: $('[data-kf-zvuk]'), znova: $('[data-kf-znova]'), odkazy: $('[data-kf-odkazy]'), titulok: $('[data-kf-titulok]') };
  const jadra = navigator.hardwareConcurrency || 8;
  const env = { render, slabe: !render && jadra <= 4, dpr: 1, W: 0, H: 0 };

  let stav = 'obal'; // obal | hra | pauza | koniec | plagat
  let t = 0, p0 = 0, raf = 0, zvuk = null, zvukZapnuty = true, skryte = false, mimo = false;
  let odkazyEl = [], poslednyTitulok = -1;
  const vykon = { snimky: 0, kresbaMs: 0, kresbaMax: 0, intervaly: [], bezi: false };
  Object.defineProperty(vykon, 'slabe', { get: () => env.slabe, enumerable: true });
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
      return { a, od: o.od ?? 0 };
    });
  }
  function ukazOdkazy(cas) {
    // odkaz len tam, kde je jeho tlačidlo nakreslené (na plagáte teda len ak plagát je po jeho čase)
    for (const o of odkazyEl) o.a.hidden = !(stav === 'koniec' || (stav !== 'obal' && cas >= o.od));
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

  async function spusti(odT = 0) {
    stoj();
    if (zvuk) { zvuk.zastav(); zvuk = null; }
    nastavStav('hra');
    t = odT;
    if (zvukZapnuty && film.zvuk) {
      zvuk = new ZivyZvuk(film.zvuk);
      const ok = await zvuk.spusti(odT).catch(() => false);
      if (!ok) { zvuk.zastav(); zvuk = null; }
    }
    p0 = zvuk ? zvuk.perfNula() : performance.now() - odT * 1000;
    behaj();
  }
  async function pozastav(interne) {
    if (stav !== 'hra') return;
    t = teraz();
    stoj();
    if (!interne) nastavStav('pauza');
    if (zvuk) await zvuk.pauza();
  }
  async function pokracuj() {
    if (stav === 'pauza') nastavStav('hra');
    if (stav !== 'hra' || skryte || mimo) return;
    if (zvuk) { await zvuk.pokracuj(); p0 = zvuk.perfNula(); } else p0 = performance.now() - t * 1000;
    behaj();
  }
  function koniec() {
    stoj();
    nastavStav('koniec');
    titulky(film.dlzka);
    const z = zvuk; zvuk = null;
    if (z) setTimeout(() => z.zastav(), 3500); // nech doznie dozvuk
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
      if (!zvukZapnuty && zvuk) { t = teraz(); zvuk.zastav(); zvuk = null; p0 = performance.now() - t * 1000; }
      else if (zvukZapnuty && stav === 'hra') spusti(teraz());
    });
  }

  if (!render) {
    document.addEventListener('visibilitychange', () => {
      skryte = document.hidden;
      if (skryte) pozastav(true); else pokracuj();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((z) => {
        mimo = !z[0].isIntersecting;
        if (mimo) pozastav(true); else pokracuj();
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
  return { spusti, pozastav: () => pozastav(false), pokracuj, env, vykon };
}
