/* Pôvod návštevy pre predaj kníh hlavolamov (arling.sk/puzzle-books/).
 *
 * Načo: keď niekto príde z videa alebo pinu s UTM v adrese a kúpi knihu, objednávka v Stripe má
 * niesť, odkiaľ prišiel (PLAN ops/strategia/organicky-rast-2026-10/PLAN.md, časť 2.5, riadok 4b).
 *
 * Cesta kupujúceho: video, krátka adresa /v/<kód>/, stránka knihy s UTM, tlačidlo kúpy, polica
 * /puzzle-books/, kde platbu robí app.js. Stránky kníh app.js nenačítavajú (potrebuje prvky police),
 * ich tlačidlo vedie na /puzzle-books/#<hra> bez UTM, takže pôvod sa po ceste strácal. Tento malý
 * súbor preto beží na každej stránke kníh (vkladá ho ops/seo/landingy.mjs a rovnaký obal stránok
 * ponúk len na Etsy) a polica ho načíta z app.js: UTM z adresy zapamätá v sessionStorage a app.js
 * z nich pri kliknutí na kúpu urobí client_reference_id odkazu Stripe. Import v app.js je dynamický
 * a jeho chyba sa zahodí, takže keď tento súbor chýba alebo ho blokátor zahodí, polica predáva ďalej.
 *
 * Tvar referencie: <zdroj>_<kampan>_<obsah>, napríklad youtube_f3_stars (utm_source, utm_campaign,
 * utm_content; chýbajúca časť sa vynechá). Len znaky A-Z a-z 0-9 _ -, najviac 200 znakov (podmienky
 * Stripe pre client_reference_id v odkaze platby, https://docs.stripe.com/payment-links/url-parameters).
 * Bez UTM sa k odkazu neprilepí nič.
 *
 * Čo sa ukladá: len päť polí utm_*, každé očistené na tie isté znaky a najviac 80 znakov. Žiadne
 * osobné údaje, nič sa nikam neposiela (súbor nevolá sieť), úložisko je sessionStorage, teda len
 * karta prehliadača a zmizne s ňou. Kľúč a tvar sú rovnaké ako v /titul.js a /olive/obchod.js, takže
 * sa príchod pamätá v celom hube. UTM z adresy majú prednosť pred uloženými. Keď zápis zlyhá, stará
 * hodnota sa zmaže, aby sa nákup nepripísal starej kampani. Bez úložiska (súkromný režim, blokované)
 * kúpa ide bez referencie, nič sa nerozbije.
 *
 * Súbor v Node nič nespúšťa (testy: products/arling-sk/puzzle-books/utm.test.mjs); v prehliadači
 * zapamätá príchod hneď pri načítaní.
 */

export const UTM_POLIA = Object.freeze(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']);
export const UTM_KLUC = 'arling_utm';
export const NAJVIAC_HODNOTA = 80;
export const NAJVIAC_REFERENCIA = 200;
/* Ktoré polia tvoria referenciu a v akom poradí. */
const CASTI_REFERENCIE = Object.freeze(['utm_source', 'utm_campaign', 'utm_content']);
const LEN_STRIPE = /^https:\/\/buy\.stripe\.com\//;

/** Jedna hodnota UTM: len znaky A-Z a-z 0-9 _ -, zakázané preč, najviac 80 znakov. Nie text dá ''. */
export function cistaHodnota(v) {
  return typeof v === 'string' ? v.replace(/[^A-Za-z0-9_-]/g, '').slice(0, NAJVIAC_HODNOTA) : '';
}

/** UTM z adresy stránky. Zlá adresa alebo žiadne UTM dá {}. */
export function utmZAdresy(adresa) {
  const u = {};
  try {
    const q = new URL(adresa).searchParams;
    for (const k of UTM_POLIA) { const v = cistaHodnota(q.get(k)); if (v) u[k] = v; }
  } catch (e) { /* zlá adresa: bez UTM */ }
  return u;
}

/** UTM z textu v úložisku (JSON) alebo z objektu, vždy znova očistené: cudzí kľúč ani zlý znak neprejde. */
export function utmZUlozenia(raw) {
  let s = raw;
  if (typeof s === 'string') { try { s = JSON.parse(s); } catch (e) { s = null; } }
  const u = {};
  if (!s || typeof s !== 'object' || Array.isArray(s)) return u;
  for (const k of UTM_POLIA) { const v = cistaHodnota(s[k]); if (v) u[k] = v; }
  return u;
}

/** Príchod tejto návštevy: UTM z adresy majú prednosť, uložené sa použijú len keď v adrese nie sú. */
export function prichod(adresa, ulozene) {
  const zAdresy = utmZAdresy(adresa);
  if (Object.keys(zAdresy).length) return { utm: zAdresy, zAdresy: true };
  return { utm: utmZUlozenia(ulozene), zAdresy: false };
}

/** Referencia pre Stripe z utm_source, utm_campaign a utm_content; '' keď žiadna z nich nie je. */
export function referencia(utm) {
  const u = utm && typeof utm === 'object' ? utm : {};
  return CASTI_REFERENCIE.map((k) => cistaHodnota(u[k])).filter(Boolean).join('_').slice(0, NAJVIAC_REFERENCIA);
}

/** Odkaz Stripe s client_reference_id. Mení len odkazy na buy.stripe.com (živé aj test_); bez UTM alebo
 *  pri inej adrese vráti odkaz presne taký, aký prišiel. */
export function odkazSReferenciou(odkaz, utm) {
  const ref = referencia(utm);
  if (!ref || typeof odkaz !== 'string' || !LEN_STRIPE.test(odkaz)) return odkaz;
  try {
    const url = new URL(odkaz);
    url.searchParams.set('client_reference_id', ref);
    return url.toString();
  } catch (e) { return odkaz; }
}

function ulozisko() {
  try { return sessionStorage; } catch (e) { return null; }
}

/**
 * Zapamätá príchod a vráti UTM tejto návštevy. Nikdy nevyhodí výnimku.
 * UTM z adresy sa uložia; keď v adrese nie sú, vezmú sa uložené. Parametre sú len kvôli testom.
 */
export function zapamatajPrichod({ adresa, uloziste } = {}) {
  const url = adresa !== undefined ? adresa : (typeof location !== 'undefined' ? location.href : '');
  const st = uloziste !== undefined ? uloziste : ulozisko();
  let ulozene = null;
  try { ulozene = st ? st.getItem(UTM_KLUC) : null; } catch (e) { ulozene = null; }
  const p = prichod(url, ulozene);
  if (p.zAdresy && st) {
    // Keď zápis novej kampane zlyhá, stará sa zmaže, aby ďalšia stránka nepripísala nákup starej kampani.
    try { st.setItem(UTM_KLUC, JSON.stringify(p.utm)); }
    catch (e) { try { st.removeItem(UTM_KLUC); } catch (e2) { /* úložisko nefunguje, nič sa neobnoví */ } }
  }
  return p.utm;
}

let navsteva = null;

/** UTM tejto návštevy, spočítané raz pri načítaní modulu (potom sa dotaz v adrese môže zmeniť, príchod ostáva). */
export function utmNavstevy() {
  if (!navsteva) navsteva = zapamatajPrichod();
  return navsteva;
}

if (typeof document !== 'undefined') utmNavstevy();
