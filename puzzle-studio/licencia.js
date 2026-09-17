/* Puzzle Studio: the licence, done the same way the bank tools already do it.
 *
 * Nothing new is invented here. The signature check, the parsing, the Ed25519
 * public key and the claim call all come from
 * products/arling-sk/bankove-nastroje/licence.js, imported by URL from the
 * same origin. This file adds only the three things that are specific to this
 * page:
 *
 *   1. which plan names count (Personal, Bulletin, Bulletin Pro, from
 *      jadro.mjs, which is also what the Stripe script and the tests read),
 *   2. where the key is kept, and how a key bought on another ARLing page is
 *      found without being told about it,
 *   3. renewal, because these are subscriptions: a licence is signed with an
 *      expiry a few weeks out and has to be refreshed while the subscription
 *      is still being paid for.
 *
 * What leaves the browser, in full: one GET to the licence service with a
 * Stripe Checkout session id, on the way back from paying, and one more of
 * the same when the licence is close to expiring. Nothing else. No puzzle, no
 * seed, no e-mail address, no count of what was generated.
 */
import { parse, isValid, claim, ed25519Supported, todayIso } from '../bankove-nastroje/licence.js';
import { PLANY, jePlan, identitaZLicencie } from './jadro.mjs';

export { ed25519Supported, todayIso };

export const SLUZBA = 'https://homelab.tailbf8f27.ts.net/licence/api';
export const PREDPONA = 'arling_licence_';
export const KLUC_SESSION = 'puzzle-studio:session';
/* Refresh this many days before the signed expiry. A monthly subscription is
 * signed for a little over a month at a time, so a week of slack means a
 * person who opens the page once a week never sees it lapse. */
export const DNI_PRED = 7;

function citaj(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function pis(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function zmaz(k) { try { localStorage.removeItem(k); } catch (e) { /* no storage, no problem */ } }

/** Every arling_licence_* key in this browser, newest convention first. */
function ulozeneKluce() {
  const von = [];
  for (const p of Object.keys(PLANY)) {
    const v = citaj(PREDPONA + p);
    if (v) von.push(v);
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k.indexOf(PREDPONA) !== 0) continue;
      const v = citaj(k);
      if (v && von.indexOf(v) < 0) von.push(v);
    }
  } catch (e) { /* storage blocked: nothing to scan */ }
  return von;
}

/**
 * The licence this browser holds, if any.
 * @returns {Promise<{plan:string, exp:string, licencia:string, identita:string, dovod:string}|null>}
 */
export async function nacitaj() {
  for (const raw of ulozeneKluce()) {
    const rozobrate = parse(raw);
    if (!rozobrate || !jePlan(rozobrate.payload.p)) continue;
    const v = await isValid(rozobrate, { plan: rozobrate.payload.p });
    if (!v.valid) continue;
    return {
      plan: rozobrate.payload.p,
      exp: rozobrate.payload.e,
      licencia: raw,
      identita: identitaZLicencie(rozobrate.payload),
      dovod: 'ok',
    };
  }
  return null;
}

/** Why a stored key is being refused, for the one line the page shows. */
export async function precoNie() {
  for (const raw of ulozeneKluce()) {
    const rozobrate = parse(raw);
    if (!rozobrate) return 'malformed';
    if (!jePlan(rozobrate.payload.p)) return 'plan';
    const v = await isValid(rozobrate, { plan: rozobrate.payload.p });
    if (!v.valid) return v.reason;
  }
  return '';
}

function uloz(licencia, plan, session) {
  pis(PREDPONA + plan, licencia);
  if (session) pis(KLUC_SESSION, session);
}

export function odstran() {
  for (const p of Object.keys(PLANY)) zmaz(PREDPONA + p);
  zmaz(KLUC_SESSION);
}

/* ── After paying ──────────────────────────────────────────────────────
 * Stripe sends the buyer back to /puzzle-studio/?session_id=cs_...&plan=...
 * The session id is handed to the licence service, which asks Stripe whether
 * it was paid and, if it was, signs a licence for the plan its price belongs
 * to. The plan in the query string is never trusted: what counts is the plan
 * the service signed.
 */
export async function prevezmi(sessionId) {
  const r = await claim(sessionId);
  if (!r || !r.ok || !r.licence) return { ok: false, chyba: (r && r.error) || 'network' };
  const rozobrate = parse(r.licence);
  if (!rozobrate || !jePlan(rozobrate.payload.p)) return { ok: false, chyba: 'plan' };
  const v = await isValid(rozobrate, { plan: rozobrate.payload.p });
  if (!v.valid) return { ok: false, chyba: v.reason };
  uloz(r.licence, rozobrate.payload.p, sessionId);
  return { ok: true, plan: rozobrate.payload.p, exp: rozobrate.payload.e, licencia: r.licence };
}

/* ── Renewal ───────────────────────────────────────────────────────────
 * /api/renew is the same handler as /api/claim on the licence service: given
 * the session id of a subscription it looks at the subscription's current
 * state and signs a licence with a fresh expiry, or refuses if the
 * subscription has been cancelled. So renewal costs one request and needs no
 * account and no password.
 */
export function trebaObnovit(exp, dnes = todayIso()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(exp))) return true;
  const ms = Date.parse(exp + 'T00:00:00Z') - Date.parse(dnes + 'T00:00:00Z');
  return ms <= DNI_PRED * 86400000;
}

export async function obnov() {
  const sid = citaj(KLUC_SESSION);
  if (!sid) return { ok: false, chyba: 'no-session' };
  let data = null;
  try {
    const res = await fetch(SLUZBA + '/renew?session_id=' + encodeURIComponent(sid));
    data = await res.json();
  } catch (e) {
    return { ok: false, chyba: 'network' };
  }
  if (!data || !data.ok || !data.licence) return { ok: false, chyba: (data && data.error) || 'refused' };
  const rozobrate = parse(data.licence);
  if (!rozobrate || !jePlan(rozobrate.payload.p)) return { ok: false, chyba: 'plan' };
  const v = await isValid(rozobrate, { plan: rozobrate.payload.p });
  if (!v.valid) return { ok: false, chyba: v.reason };
  uloz(data.licence, rozobrate.payload.p, sid);
  return { ok: true, plan: rozobrate.payload.p, exp: rozobrate.payload.e };
}

/** A licence key typed in by hand, from a receipt or another computer. */
export async function vloz(text) {
  const raw = String(text || '').trim();
  const rozobrate = parse(raw);
  if (!rozobrate) return { ok: false, chyba: 'malformed' };
  if (!jePlan(rozobrate.payload.p)) return { ok: false, chyba: 'plan' };
  const v = await isValid(rozobrate, { plan: rozobrate.payload.p });
  if (!v.valid) return { ok: false, chyba: v.reason };
  uloz(raw, rozobrate.payload.p, '');
  return { ok: true, plan: rozobrate.payload.p, exp: rozobrate.payload.e };
}
