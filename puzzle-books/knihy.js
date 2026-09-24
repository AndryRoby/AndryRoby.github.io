/* Knihy hlavolamov: ciste funkcie stranky arling.sk/puzzle-books/ (bez DOM).
 *
 * Zla sprava prva (25. 9. 2026): do vtedy app.js niesol mapu CESTY so
 * 16-znakovymi klucikmi vsetkych desiatich knih a adresu PDF na GitHub Pages
 * si skladal sam z kniha, format a klucik. Kto si otvoril zdroj stranky,
 * stiahol si kazdu knihu bez platby. Odomknutie odkaz len ukazalo.
 *
 * Odteraz stranka ziadnu cestu k PDF nepozna. Po overenej platbe sa pyta
 * licencnej sluzby, GET /licence/api/purchase/links?session_id=cs_...; ta
 * overi platbu v Stripe, podla price id zisti, ktora kniha (alebo vsetkych
 * desat) sa kupila, a vrati podpisane odkazy na /licence/api/download s
 * platnostou 7 dni. Kazdy subor v odpovedi nesie "kniha" a "format", takze
 * stranka vie, na ktoru kartu odkaz patri. V prehliadaci ostava len cislo
 * platby (session id) a pri kazdom otvoreni stranky sa pyta na cerstve odkazy.
 * Mapa knih v sluzbe: products/licence-service/puzzle_books.json.
 *
 * Tento subor nic nespusta sam, aby sa dal testovat v Node
 * (products/arling-sk/puzzle-books/knihy.test.mjs). DOM a udalosti su v app.js.
 */

import { LICENCIE, platnaAdresaSuboru } from '../titul.js';

/* Kluce kariet (li[data-kniha]) v poradi ops/puzzle-books/hry.mjs. */
export const KNIHY = Object.freeze(['hedgehogs', 'magpies', 'otters', 'squirrels', 'cranes', 'swans', 'voles', 'badgers', 'herons', 'hares']);
export const VSETKY = 'all';
export const FORMATY = Object.freeze(['a4', 'letter']);

/* Platby v tomto prehliadaci: { "<session id>": { kniha, test, t } }. */
export const KLUC_RELACIE = 'books:relacie';
/* Odomknutie spred 25. 9. 2026 bez cisla platby ({ vsetky, knihy }). Uz sa nezapisuje, len cita. */
export const KLUC_STARE = 'books:zaplatene';

/* Tvar Checkout Session id, ten isty ako SESSION_ID_RE v licencnej sluzbe. */
const SESSION_RE = /^cs_[A-Za-z0-9_]{1,116}$/;

export function jeKniha(k) { return KNIHY.includes(k); }
export function platnaSession(sid) { return typeof sid === 'string' && SESSION_RE.test(sid); }

function precitaj(raw) {
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function cielPlatby(kniha) { return kniha === VSETKY || jeKniha(kniha) ? kniha : ''; }

/** Platby z localStorage v bezpecnom tvare. Cudzie kluce a hodnoty sa zahodia. */
export function relacieZoZaznamu(raw) {
  const s = precitaj(raw);
  const von = {};
  if (!s || typeof s !== 'object' || Array.isArray(s)) return von;
  for (const [sid, v] of Object.entries(s)) {
    if (!platnaSession(sid) || !v || typeof v !== 'object') continue;
    von[sid] = { kniha: cielPlatby(v.kniha), test: !!v.test, t: Number(v.t) || 0 };
  }
  return von;
}

/** Nova alebo obnovena platba. Neznama kniha ('') neprepise uz znamu. */
export function pridajRelaciu(relacie, sid, kniha, test, teraz = Date.now()) {
  const von = { ...relacieZoZaznamu(relacie) };
  if (!platnaSession(sid)) return von;
  const stara = von[sid];
  von[sid] = { kniha: cielPlatby(kniha) || (stara ? stara.kniha : ''), test: !!test || !!(stara && stara.test), t: teraz };
  return von;
}

/** Stare odomknutie spred 25. 9. 2026 (bez cisla platby). */
export function stareOdomknutie(raw) {
  const s = precitaj(raw);
  const knihy = {};
  if (!s || typeof s !== 'object') return { vsetky: false, knihy };
  if (s.knihy && typeof s.knihy === 'object') for (const k of KNIHY) if (s.knihy[k]) knihy[k] = true;
  return { vsetky: !!s.vsetky, knihy };
}

/** Knihy, ktore platba podla ulozeneho zaznamu kupila (kym neodpovie sluzba). */
export function knihyRelacie(zaznam) {
  if (!zaznam) return [];
  if (zaznam.kniha === VSETKY) return [...KNIHY];
  return jeKniha(zaznam.kniha) ? [zaznam.kniha] : [];
}

/** Poradie dotazov na sluzbu: balik vsetkych prvy (jeden dotaz pokryje vsetko), potom novsie. */
export function poradieRelacii(relacie) {
  return Object.entries(relacieZoZaznamu(relacie))
    .sort((a, b) => (Number(b[1].kniha === VSETKY) - Number(a[1].kniha === VSETKY)) || (b[1].t - a[1].t))
    .map(([sid]) => sid);
}

/**
 * Odpoved GET /purchase/links rozdelena podla knihy a formatu:
 * { otters: { a4: { href, nazov }, letter: { href, nazov } } }.
 * Berie sa len absolutny https odkaz, ktory prejde platnaAdresaSuboru z titul.js
 * (homelab alebo arling.sk); relativna cesta zo sluzby by viedla na hub.
 */
export function suboryPodlaKnihy(odpoved) {
  const von = {};
  if (!odpoved || typeof odpoved !== 'object' || odpoved.ok !== true || !Array.isArray(odpoved.files)) return von;
  for (const f of odpoved.files) {
    if (!f || typeof f !== 'object' || !jeKniha(f.kniha) || !FORMATY.includes(f.format)) continue;
    const href = platnaAdresaSuboru(f.url);
    if (!href || !href.startsWith('https://')) continue;
    (von[f.kniha] = von[f.kniha] || {})[f.format] = { href, nazov: String(f.label || '').trim() };
  }
  return von;
}

/** Su vsetky knihy tejto platby uz pokryte odkazmi z inej odpovede? Potom sa netreba pytat. */
export function pokryta(zaznam, vysledky) {
  const knihy = knihyRelacie(zaznam);
  if (!knihy.length) return false;
  const odpovede = Object.values(vysledky || {});
  return knihy.every((k) => odpovede.some((v) => v && v.ok && v.knihy && v.knihy[k]));
}

/**
 * Stav jednej knihy na stranke. vysledky: { sid: { ok: true, knihy } | { ok: false, dovod } },
 * chybajuci kluc znamena "este sa pyta".
 *   'odkazy'      sluzba dala odkazy (subory: { a4, letter })
 *   'caka'        zaplatene, na odkazy sa prave pyta (relacie: [sid])
 *   'chyba'       zaplatene, sluzba odkazy nedala (relacie: [sid])
 *   'bez-relacie' odomknute v tomto prehliadaci pred 25. 9. 2026, cislo platby tu nie je
 *   'zamknuta'    nekupena
 * Platba, na ktoru sluzba odpovedala bez tejto knihy, ju neodomkne: plati odpoved
 * sluzby, nie parameter book v navratovej adrese.
 */
export function stavKnihy(kniha, { relacie = {}, vysledky = {}, stare = null } = {}) {
  const r = relacieZoZaznamu(relacie);
  for (const sid of Object.keys(r)) {
    const v = vysledky[sid];
    if (v && v.ok && v.knihy && v.knihy[kniha]) return { stav: 'odkazy', subory: v.knihy[kniha], session: sid };
  }
  const cakaju = [];
  const chyby = [];
  for (const [sid, z] of Object.entries(r)) {
    const v = vysledky[sid];
    if (v && v.ok) continue;
    if (!knihyRelacie(z).includes(kniha)) continue;
    (v && v.ok === false ? chyby : cakaju).push(sid);
  }
  if (cakaju.length) return { stav: 'caka', relacie: cakaju };
  if (chyby.length) return { stav: 'chyba', relacie: chyby };
  const s = stareOdomknutie(stare);
  if (s.vsetky || s.knihy[kniha]) return { stav: 'bez-relacie' };
  return { stav: 'zamknuta' };
}

/**
 * Jeden dotaz na licencnu sluzbu. Vracia { ok: true, knihy } alebo { ok: false, dovod }
 * a nikdy nevyhodi vynimku. fetch sa da podstrcit (volby.fetch) kvoli testom.
 */
export async function odkazyPlatby(sid, volby = {}) {
  const vlastny = Object.prototype.hasOwnProperty.call(volby, 'fetch');
  const posli = vlastny ? volby.fetch : (typeof fetch === 'function' ? fetch : null);
  if (!posli || !platnaSession(sid)) return { ok: false, dovod: 'siet' };
  try {
    const r = await posli(LICENCIE + '/purchase/links?session_id=' + encodeURIComponent(sid));
    if (!r) return { ok: false, dovod: 'siet' };
    let telo = null;
    try { telo = await r.json(); } catch (e) { telo = null; }
    if (!r.ok) return { ok: false, dovod: telo && typeof telo.reason === 'string' ? telo.reason : 'http-' + r.status };
    const knihy = suboryPodlaKnihy(telo);
    if (!Object.keys(knihy).length) return { ok: false, dovod: 'prazdne' };
    return { ok: true, knihy };
  } catch (e) {
    return { ok: false, dovod: 'siet' };
  }
}
