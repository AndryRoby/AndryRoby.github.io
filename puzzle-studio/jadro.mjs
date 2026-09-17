/* Puzzle Studio: the rules that decide what gets generated and how much of it.
 *
 * Everything here is a pure function of its arguments. No DOM, no storage, no
 * network, no imports. That is deliberate: the seed key decides which puzzle a
 * person gets, and the quota decides whether they get one at all, so both have
 * to be testable in Node without a browser (jadro.test.mjs, node --test).
 *
 * Three ideas live here.
 *
 * 1. The seed key. Every generator in products/arling-sk/games/<game>/ takes a
 *    key string and turns it into a puzzle deterministically (generateSeeded).
 *    The daily games use the date as the key and the books use
 *    "book:<game>:<number>:<size>". Studio uses a third namespace that starts
 *    with "studio:v1:", so a studio puzzle can only ever collide with a daily
 *    or a book puzzle by accident, never by construction. The honest limit of
 *    that promise is written on the page: on a small grid there are only so
 *    many puzzles, so two different keys can still land on the same one.
 *
 * 2. Never the same puzzle twice for the same account. The key carries an
 *    identity (a short hash of the licence e-mail, or a random id kept in this
 *    browser) and a counter that only ever goes up and is kept in
 *    localStorage. Two puzzles of one account therefore never share a key.
 *    The one exception is asked for out loud: a seed word switches to a
 *    reproducible key, which is the whole point of typing one.
 *
 * 3. The courtesy quota. Without a licence the page generates two puzzles a
 *    day, counted in this browser. It is a courtesy limit and the page says
 *    so: anyone who clears site data gets two more. It is not a lock, it is a
 *    way of asking.
 */

/* ── Plans ─────────────────────────────────────────────────────────────
   The names are the plan strings the licence service signs into the licence
   payload ("p"), so they have to match PLANS_JSON on the service exactly.
   puzzle-post-bulletin and puzzle-post-bulletin-pro already exist; Fable adds
   puzzle-studio-personal after this page ships. */
export const PLANY = {
  'puzzle-studio-personal': {
    nazov: 'Personal',
    cena: 'from 4.90 € a month',
    neobmedzene: true,
    kreditPovinny: false,
    tlacovaLicencia: false,
    popis: 'Unlimited puzzles for your own use, at home, in a classroom or in a club. The credit line is optional.',
  },
  'puzzle-post-bulletin': {
    nazov: 'Bulletin',
    cena: '19 € a month',
    neobmedzene: true,
    kreditPovinny: false,
    tlacovaLicencia: true,
    popis: 'Everything in Personal plus a print licence for one publication, and the weekly sheet by e-mail.',
  },
  'puzzle-post-bulletin-pro': {
    nazov: 'Bulletin Pro',
    cena: '39 € a month',
    neobmedzene: true,
    kreditPovinny: false,
    tlacovaLicencia: true,
    popis: 'Everything in Bulletin, with the larger weekly sheet and the solutions page.',
  },
};

/* The free tier is not a plan on the licence service: it is the absence of one. */
export const ZADARMO = {
  nazov: 'Free',
  cena: 'no account',
  neobmedzene: false,
  kreditPovinny: true,
  tlacovaLicencia: false,
  denne: 2,
};

export const MAX_DAVKA = 20;
export const KLUC_VERZIA = 'studio:v1';

/** @returns {boolean} true when this plan name is one the page accepts. */
export function jePlan(meno) {
  return typeof meno === 'string' && Object.prototype.hasOwnProperty.call(PLANY, meno);
}

/** The plan record for a name, or the free tier for anything else. */
export function plan(meno) {
  return jePlan(meno) ? PLANY[meno] : ZADARMO;
}

/** @returns {boolean} may this plan put a puzzle in a printed publication? */
export function smieTlacit(meno) {
  return !!plan(meno).tlacovaLicencia;
}

/* ── Hashing ───────────────────────────────────────────────────────────
   FNV-1a over UTF-16 code units, two lanes, written out as 16 hex digits.
   Not a cryptographic hash and it is not used as one: it turns an e-mail into
   a short stable label so the same account keeps the same key namespace on
   every device, without the e-mail itself ever appearing in a key. The licence
   payload already carries sha256(email)[:16] as "m"; when that is available it
   is used instead, and this is the fallback for the anonymous case. */
export function hash64(s) {
  const t = String(s);
  let a = 0x811c9dc5, b = 0x01000193;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    a ^= c; a = Math.imul(a, 0x01000193) >>> 0;
    b = (b + c) >>> 0; b = Math.imul(b ^ (b >>> 13), 0x85ebca6b) >>> 0;
  }
  const hex = (x) => (x >>> 0).toString(16).padStart(8, '0');
  return hex(a) + hex(b);
}

/* ── Identity ──────────────────────────────────────────────────────────
   What goes into the key so that two accounts never share a sequence. With a
   licence it is the "m" field of the payload (sha256 of the e-mail, cut to 16
   characters, made by the licence service), so the same person gets the same
   namespace in every browser they activate. Without one it is a random id
   made once in this browser. */
export function identitaZLicencie(payload) {
  if (payload && typeof payload.m === 'string' && payload.m.length >= 8) return 'e' + payload.m.slice(0, 16);
  return '';
}

/** An anonymous identity from random bytes the caller supplies (crypto). */
export function identitaAnonymna(nahodneHex) {
  const t = String(nahodneHex || '').replace(/[^0-9a-f]/gi, '').toLowerCase();
  return 'a' + (t.length >= 16 ? t.slice(0, 16) : hash64(t + ':' + t.length));
}

/* ── Seed keys ─────────────────────────────────────────────────────────
   Two shapes, and which one is used is a choice the person makes by typing a
   seed word or not.

     studio:v1:<identity>:<kind>:<level>:<size>:<counter>
       the never repeated one. The counter is kept in localStorage and only
       goes up, so no two puzzles of one identity ever share a key.

     studio:v1:seed:<word>:<kind>:<level>:<size>:<index>
       the reproducible one. Everyone who types the same word gets the same
       puzzles, which is the reason to type one: to send a colleague the same
       sheet without sending the file.

   The key is passed straight to generateSeeded, which hashes it (seedFromString)
   into the state of a mulberry32 generator. */
export function klucHlavolamu(o) {
  const druh = String(o.druh);
  const uroven = String(o.uroven);
  const velkost = String(o.velkost);
  if (o.semeno) {
    return KLUC_VERZIA + ':seed:' + normalizujSemeno(o.semeno) + ':' + druh + ':' + uroven + ':' + velkost + ':' + o.poradie;
  }
  return KLUC_VERZIA + ':' + String(o.identita) + ':' + druh + ':' + uroven + ':' + velkost + ':' + o.poradie;
}

/* A seed word is normalised so that "Autumn 2026", "autumn 2026" and
   " AUTUMN  2026 " are the same seed: people retype these by hand. */
export function normalizujSemeno(s) {
  return String(s).trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_.]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
}

/* ── The counter that never goes back ──────────────────────────────────
   Takes the stored counter and how many puzzles are wanted, and gives back
   the numbers to use and the counter to store. Anything unreadable in storage
   is treated as zero: losing the counter costs a repeat at worst, and
   refusing to generate would cost a customer. */
export function vezmiPoradia(ulozene, kolko) {
  const od = Number.isFinite(Number(ulozene)) && Number(ulozene) > 0 ? Math.floor(Number(ulozene)) : 0;
  const n = Math.max(1, Math.min(MAX_DAVKA, Math.floor(Number(kolko) || 1)));
  const poradia = [];
  for (let i = 0; i < n; i++) poradia.push(od + i);
  return { poradia, nove: od + n };
}

/* ── The courtesy quota ────────────────────────────────────────────────
   State is { den: 'YYYY-MM-DD', pocet: n }. A new day resets the count. */
export function kvotaStav(ulozene, dnes) {
  const s = ulozene && typeof ulozene === 'object' ? ulozene : {};
  const den = /^\d{4}-\d{2}-\d{2}$/.test(s.den) ? s.den : '';
  const pocet = Number.isFinite(Number(s.pocet)) && Number(s.pocet) > 0 ? Math.floor(Number(s.pocet)) : 0;
  if (den !== dnes) return { den: dnes, pocet: 0 };
  return { den, pocet };
}

/** How many free puzzles are left today. Paid plans are not counted at all. */
export function zostatok(ulozene, dnes, planMeno) {
  if (plan(planMeno).neobmedzene) return Infinity;
  const s = kvotaStav(ulozene, dnes);
  return Math.max(0, ZADARMO.denne - s.pocet);
}

/* How many of the requested puzzles may be made now, and what the stored
   state becomes afterwards. Returning fewer than asked is on purpose: someone
   with one left who asks for five gets one and a plain sentence, not a
   refusal. */
export function povolenyPocet(ulozene, dnes, planMeno, chce) {
  const n = Math.max(1, Math.min(MAX_DAVKA, Math.floor(Number(chce) || 1)));
  if (plan(planMeno).neobmedzene) return { pocet: n, stav: kvotaStav(ulozene, dnes), zostatok: Infinity, orezane: false };
  const s = kvotaStav(ulozene, dnes);
  const volne = Math.max(0, ZADARMO.denne - s.pocet);
  const pocet = Math.min(n, volne);
  return {
    pocet,
    stav: { den: dnes, pocet: s.pocet + pocet },
    zostatok: volne - pocet,
    orezane: pocet < n,
  };
}

/** Today in Bratislava as YYYY-MM-DD, the same clock the daily games use. */
export function dnesISO(now = new Date()) {
  const t = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Bratislava' }));
  const p = (x) => String(x).padStart(2, '0');
  return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate());
}

/* ── File names ────────────────────────────────────────────────────────
   Every downloaded file says what it is without being opened, and two puzzles
   of one batch never share a name. */
export function nazovSuboru(o) {
  const cast = [
    'arling',
    String(o.druh || 'puzzle'),
    String(o.uroven || ''),
    o.velkost ? String(o.velkost) : '',
    o.riesenie ? 'solution' : '',
    String(o.poradie == null ? '' : o.poradie),
  ].filter(Boolean).map((x) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  return cast.join('-') + '.' + String(o.pripona || 'svg');
}

/* The line that goes under a free puzzle and into every ZIP. Kept here because
   the page, the print sheet and the ZIP all have to say the same thing. */
export function kredit(planMeno) {
  const p = plan(planMeno);
  if (p.tlacovaLicencia) return 'Puzzle by ARLing, arling.sk. Print licence for one publication.';
  if (p.neobmedzene) return 'Puzzle by ARLing, arling.sk';
  return 'Puzzle by ARLing, arling.sk';
}
