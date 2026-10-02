// Daystone: čistá logika stránky bez DOM (dni spolu, odkazy za #, otázka dňa).
// Rovnaký modul beží v prehliadači aj v node --test (daystone.test.mjs).
//
// Súkromie (zadanie 2. 10. 2026, KONCEPT 8.1): všetko, čo človek pošle, ide len v časti
// odkazu za #, ktorú prehliadač neposiela na server. Odkaz je base64url z UTF-8 JSON,
// teda ZAKÓDOVANÝ, nie zašifrovaný; kto má odkaz, prečíta ho (stránka to hovorí v FAQ).
import { OTAZKY, PODLA_ID } from './otazky.mjs';

export const MAX_ODPOVED = 280;
export const MAX_MENO = 24;
export const MAX_ODKAZ = 4000;
const DEN_MS = 86400000;

// Rodiny nálad a štyri hĺbky podľa KONCEPT 9.3; piata farba je okraj prechodu pri d4.
export const RODINY = [
  { id: 'bright', nazov: 'Bright', popis: 'Sunny, full of energy', farby: ['#FFF1B8', '#FFE07A', '#FFC94D', '#F5A623', '#E08E12'],
    pre: 'A bright day. A good moment to share something fun with them.' },
  { id: 'calm', nazov: 'Calm', popis: 'Steady and at ease', farby: ['#DDF7EE', '#B5EBD9', '#7FD8C0', '#3FB89E', '#2A9C84'],
    pre: 'A steady day. A short hello will land softly.' },
  { id: 'okay', nazov: 'Okay', popis: 'Somewhere in the middle', farby: ['#F1ECF8', '#E2D9F2', '#CDBFE8', '#A995D6', '#8C76C4'],
    pre: 'A middle kind of day. One kind word goes a long way.' },
  { id: 'tense', nazov: 'Tense', popis: 'A bit wound up', farby: ['#FFE6DC', '#FFC9B5', '#FFA586', '#F07A5A', '#DD6444'],
    pre: 'A wound up day. You do not need to fix anything. A little patience helps.' },
  { id: 'low', nazov: 'Low', popis: 'Quiet, low on battery', farby: ['#E3E8FF', '#C6D0FF', '#9DAEF5', '#6F83E0', '#5468C8'],
    pre: 'A quiet day. You do not need to fix anything. A short kind message is enough.' },
];
export const RODINA = new Map(RODINY.map((r) => [r.id, r]));
export const SILA = ['a touch', 'fairly', 'very', 'fully'];

// ---------- dátumy ----------

const RE_DATUM = /^(\d{4})-(\d{2})-(\d{2})$/;

export function priestupny(rok) {
  return (rok % 4 === 0 && rok % 100 !== 0) || rok % 400 === 0;
}

/** "RRRR-MM-DD" na {r, m, d, t}; t je polnoc UTC toho kalendárneho dňa. Neplatný dátum: null. */
export function parsujDatum(s) {
  if (typeof s !== 'string') return null;
  const m = RE_DATUM.exec(s.trim());
  if (!m) return null;
  const r = Number(m[1]), me = Number(m[2]), d = Number(m[3]);
  if (r < 1900 || r > 2999) return null;
  const t = Date.UTC(r, me - 1, d);
  const x = new Date(t);
  if (x.getUTCFullYear() !== r || x.getUTCMonth() !== me - 1 || x.getUTCDate() !== d) return null;
  return { r, m: me, d, t };
}

const dvoj = (n) => String(n).padStart(2, '0');
const naText = (r, m, d) => `${r}-${dvoj(m)}-${dvoj(d)}`;

/** Miestny kalendárny dátum v danom pásme (bez pásma: pásmo prehliadača). */
export function dnesnyDatum(teraz = new Date(), pasmo) {
  const casti = new Intl.DateTimeFormat('en-US', { timeZone: pasmo, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(teraz);
  const v = (typ) => Number(casti.find((c) => c.type === typ).value);
  return naText(v('year'), v('month'), v('day'));
}

/** Počet celých kalendárnych dní medzi dvoma dátumami. Ráta sa z kalendárnych dní, nie z hodín,
 * preto prechod na letný čas ani pásmo výsledok nemení. */
export function dniMedzi(od, do_) {
  const a = parsujDatum(od), b = parsujDatum(do_);
  if (!a || !b) return null;
  return Math.round((b.t - a.t) / DEN_MS);
}

export function pridajDni(datum, n) {
  const a = parsujDatum(datum);
  if (!a) return null;
  const x = new Date(a.t + n * DEN_MS);
  return naText(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate());
}

/** Výročie v danom roku; kto začal 29. 2., má v nepriestupnom roku výročie 28. 2. */
export function vyrocie(od, rok) {
  const a = parsujDatum(od);
  if (!a) return null;
  if (a.m === 2 && a.d === 29 && !priestupny(rok)) return naText(rok, 2, 28);
  return naText(rok, a.m, a.d);
}

/** Roky a zvyšné dni ako pri narodeninách. */
export function rokyADni(od, dnes) {
  const a = parsujDatum(od), b = parsujDatum(dnes);
  if (!a || !b || b.t < a.t) return null;
  let roky = b.r - a.r;
  if (parsujDatum(vyrocie(od, a.r + roky)).t > b.t) roky -= 1;
  return { roky, dni: dniMedzi(vyrocie(od, a.r + roky), dnes) };
}

const MILNIKY = [50, 100, 200, 300, 365, 500, 730, 1000];

/** Najbližší okrúhly deň po dnešku: najprv pevné míľniky, potom každých 500. */
export function dalsiMilnik(od, dnes) {
  const n = dniMedzi(od, dnes);
  if (n === null || n < 0) return null;
  let den = MILNIKY.find((x) => x > n);
  if (!den) den = (Math.floor(n / 500) + 1) * 500;
  return { den, datum: pridajDni(od, den), zostava: den - n };
}

/** Výsledok počítadla pre UI, s chybou slovami zákazníka (R69, R73). */
export function spocitaj(od, dnes) {
  if (!od) return { chyba: 'Pick the date you got together.' };
  if (!parsujDatum(od)) return { chyba: 'That date does not exist. Check the day and month.' };
  const n = dniMedzi(od, dnes);
  if (n < 0) return { chyba: 'That date is still ahead of us. Pick a day in the past.' };
  const { roky, dni: zvysok } = rokyADni(od, dnes);
  return { dni: n, roky, zvysok, milnik: dalsiMilnik(od, dnes) };
}

export const cislo = (n) => new Intl.NumberFormat('en-US').format(n);

export function peknyDatum(datum) {
  const a = parsujDatum(datum);
  if (!a) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(a.t));
}

export function vetaRokov({ roky, dni }) {
  const r = roky === 1 ? '1 year' : `${cislo(roky)} years`;
  const d = dni === 1 ? '1 day' : `${cislo(dni)} days`;
  if (roky === 0) return d;
  if (dni === 0) return `exactly ${r}`;
  return `${r} and ${d}`;
}

// ---------- text od človeka ----------

export const pocetZnakov = (s) => Array.from(s).length;

/** Očistí text: NFC, bez riadiacich znakov, orezané medzery; riadky len v odpovedi (najviac 2 prázdne za sebou). */
export function cistyText(s, viacRiadkov = false) {
  if (typeof s !== 'string') return '';
  let t = s.normalize('NFC').replace(/\r\n?/g, '\n');
  t = viacRiadkov ? t.replace(/[\u0000-\u0009\u000B-\u001F\u007F\u2028\u2029]/g, '') : t.replace(/[\u0000-\u001F\u007F\u2028\u2029]/g, ' ');
  if (viacRiadkov) t = t.replace(/\n{3,}/g, '\n\n');
  else t = t.replace(/\s+/g, ' ');
  return t.trim();
}

// ---------- base64url z UTF-8 ----------

export function naBase64url(text) {
  const bajty = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bajty.length; i += 0x8000) bin += String.fromCharCode(...bajty.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Späť na text; pri čomkoľvek zlom (nepovolený znak, zlé UTF-8, príliš dlhé) vráti null. */
export function zBase64url(s) {
  if (typeof s !== 'string' || !s || s.length > MAX_ODKAZ || !/^[A-Za-z0-9_-]+$/.test(s) || s.length % 4 === 1) return null;
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
    const bajty = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bajty);
  } catch {
    return null;
  }
}

function zJson(s) {
  const text = zBase64url(s);
  if (text === null) return null;
  try {
    const o = JSON.parse(text);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
  } catch {
    return null;
  }
}

// ---------- odkazy ----------

class ChybaOdkazu extends Error {}

function overMeno(n) {
  if (n === undefined || n === null || n === '') return '';
  const t = cistyText(n);
  if (typeof n !== 'string' || pocetZnakov(t) > MAX_MENO) throw new ChybaOdkazu(`Keep the name under ${MAX_MENO} characters.`);
  return t;
}

function overOdpoved(a) {
  const t = cistyText(a, true);
  if (!t) throw new ChybaOdkazu('Write a few words first.');
  if (pocetZnakov(t) > MAX_ODPOVED) throw new ChybaOdkazu(`Keep it under ${MAX_ODPOVED} characters.`);
  return t;
}

function overFarbu(f, h) {
  if (!RODINA.has(f)) throw new ChybaOdkazu('Pick a color first.');
  if (!Number.isInteger(h) || h < 1 || h > 4) throw new ChybaOdkazu('Pick how strong the color is.');
  return { f, h };
}

function overDatum(d) {
  if (d === undefined || d === null || d === '') return undefined;
  if (!parsujDatum(d)) throw new ChybaOdkazu('Bad date.');
  return d;
}

const bezPrazdnych = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''));

function zostavOdkaz(predpona, data) {
  const kod = naBase64url(JSON.stringify(data));
  if (kod.length > MAX_ODKAZ) throw new ChybaOdkazu('That is too long for a link. Shorten your answer a little.');
  return `#${predpona}=${kod}`;
}

/** Farba dňa. spat = farba, na ktorú človek odpovedá (partner posiela svoju späť). */
export function normalizujFarbu({ f, h, n, d, spat } = {}) {
  const o = { v: 1, ...overFarbu(f, h), n: overMeno(n), d: overDatum(d) };
  if (spat !== undefined && (!spat || typeof spat !== 'object')) throw new ChybaOdkazu('Bad reply.');
  if (spat) o.r = bezPrazdnych({ ...overFarbu(spat.f, spat.h), n: overMeno(spat.n) });
  return bezPrazdnych(o);
}

export function odkazFarby(vstup) {
  return zostavOdkaz('c', normalizujFarbu(vstup));
}

/** Otázka. b a m sú odpoveď a meno toho, kto odpovedá späť. */
export function normalizujOtazku({ q, a, n, d, b, m } = {}) {
  if (!PODLA_ID.has(q)) throw new ChybaOdkazu('Unknown question.');
  const o = { v: 1, q, a: overOdpoved(a), n: overMeno(n), d: overDatum(d) };
  if (b !== undefined) { o.b = overOdpoved(b); o.m = overMeno(m); }
  return bezPrazdnych(o);
}

export function odkazOtazky(vstup) {
  return zostavOdkaz('q', normalizujOtazku(vstup));
}

const bezpecne = (fn, o) => {
  try {
    return fn(o);
  } catch (e) {
    if (e instanceof ChybaOdkazu || e instanceof TypeError) return null;
    throw e;
  }
};

/** Prečíta časť za # (s mriežkou alebo bez). Bez dát: null; zlé dáta: { typ: 'chyba' }. */
export function citajHash(hash) {
  if (typeof hash !== 'string') return null;
  const h = hash.replace(/^#/, '');
  const m = /^([cq])=(.*)$/s.exec(h);
  if (!m) return null;
  const o = zJson(m[2]);
  if (!o || o.v !== 1) return { typ: 'chyba' };
  if (m[1] === 'c') {
    const r = bezpecne(normalizujFarbu, { f: o.f, h: o.h, n: o.n, d: o.d, spat: o.r });
    return r ? { typ: 'farba', data: r } : { typ: 'chyba' };
  }
  const r = bezpecne(normalizujOtazku, { q: o.q, a: o.a, n: o.n, d: o.d, b: o.b, m: o.m });
  return r ? { typ: 'otazka', data: r } : { typ: 'chyba' };
}

export function jeChybaOdkazu(e) {
  return e instanceof ChybaOdkazu;
}

// ---------- otázka dňa ----------

// Pevné premiešanie (mulberry32 so stálym semienkom), aby sa tóny striedali a poradie
// bolo pre všetkých rovnaké. Semienko sa nemení, inak by sa zmenila otázka dňa.
function premiesaj(pole, semienko) {
  let a = semienko >>> 0;
  const nahoda = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const p = pole.slice();
  for (let i = p.length - 1; i > 0; i--) {
    const j = Math.floor(nahoda() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

export const PORADIE = premiesaj(OTAZKY, 20261002);

/** Otázka pre miestny dátum; posun je „Another question“ (1, 2, ...). */
export function otazkaDna(datum, posun = 0) {
  const a = parsujDatum(datum);
  if (!a) return null;
  const n = PORADIE.length;
  const den = Math.floor(a.t / DEN_MS);
  return PORADIE[(((den + posun) % n) + n) % n];
}
