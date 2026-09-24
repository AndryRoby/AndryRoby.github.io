// Klient pre zdieľanie do TikToku: PKCE, state, návrat z Login Kitu a volania nášho workera.
// Client secret ani access token sem nikdy neprídu. Worker vráti len zapečatenú reláciu (nahrať sa
// dá 15 min, zrušiť 24 h), ktorá ostáva v pamäti karty, nie v localStorage. Testy: tiktok.test.mjs.

export const API = 'https://arling-asistent.arling.workers.dev';
export const KANAL = 'arling-puzzle-video-tiktok';
export const MAX_VIDEO_BAJTOV = 30 * 1024 * 1024;
/** Chyby videa: relácia ostáva platná, tvorca môže video vyrobiť znova (rovnaký zoznam ako worker). */
export const CHYBY_VIDEA = ['video_too_large', 'video_too_small', 'video_format', 'video_length_mismatch'];
/** Stavy, po ktorých sa na TikTok už nečaká a prístup sa ruší. */
export const KONCOVE_STAVY = ['SEND_TO_USER_INBOX', 'PUBLISH_COMPLETE', 'FAILED'];

export function base64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** code_verifier: 64 náhodných bajtov ako base64url, 86 znakov z povolenej abecedy (43 až 128). */
export function novyVerifier(nahodne = (b) => crypto.getRandomValues(b)) {
  return base64url(nahodne(new Uint8Array(64)));
}

/** code_challenge = base64url(SHA-256(verifier)), metóda S256. */
export async function challengePre(verifier) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(h));
}

/** Prečíta návrat z TikToku (?code=&state=&scopes= alebo ?error=). Bez týchto parametrov vráti null. */
export function precitajNavrat(search) {
  const q = new URLSearchParams(search || '');
  if (!q.has('state') || (!q.has('code') && !q.has('error'))) return null;
  return {
    code: q.get('code') || '',
    state: q.get('state') || '',
    scopes: (q.get('scopes') || '').split(',').filter(Boolean),
    error: q.get('error') || '',
    errorDescription: (q.get('error_description') || '').slice(0, 200),
  };
}

/** State z návratu sa musí presne zhodovať s tým, ktorý táto karta poslala. */
export function stateSedi(ocakavany, prijaty) {
  if (typeof ocakavany !== 'string' || typeof prijaty !== 'string' || !ocakavany || ocakavany.length !== prijaty.length) return false;
  let rozdiel = 0;
  for (let i = 0; i < ocakavany.length; i++) rozdiel |= ocakavany.charCodeAt(i) ^ prijaty.charCodeAt(i);
  return rozdiel === 0;
}

export class ChybaZdielania extends Error {
  /** `revoked`: true alebo false, keď worker povedal, či pri tejto chybe už zrušil prístup; inak null. */
  constructor(kod, status = 0, revoked = null) {
    super(kod);
    this.kod = kod;
    this.status = status;
    this.revoked = revoked;
  }
}

async function volaj(fetchImpl, cesta, { telo, hlavicky = {}, surove = false } = {}) {
  let r;
  try {
    r = await fetchImpl(API + cesta, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: surove ? hlavicky : { 'Content-Type': 'application/json', ...hlavicky },
      body: surove ? telo : JSON.stringify(telo || {}),
    });
  } catch (e) {
    throw new ChybaZdielania('network', 0);
  }
  let obj = {};
  try { obj = await r.json(); } catch (e) { /* prázdne telo */ }
  if (!r.ok || !obj.ok) throw new ChybaZdielania(obj.error || 'http_' + r.status, r.status, typeof obj.revoked === 'boolean' ? obj.revoked : null);
  return obj;
}

export const zacni = (fetchImpl, challenge) => volaj(fetchImpl, '/v1/tiktok/start', { telo: { challenge } });
export const otvorRelaciu = (fetchImpl, { code, state, verifier }) => volaj(fetchImpl, '/v1/tiktok/session', { telo: { code, state, verifier } });
export const zistiStav = (fetchImpl, { session, publishId }) => volaj(fetchImpl, '/v1/tiktok/status', { telo: { session, publishId } });
export const zrus = (fetchImpl, session) => volaj(fetchImpl, '/v1/tiktok/cancel', { telo: { session } });

/**
 * Zrušenie pri zatváraní karty (pagehide): keepalive a text/plain, teda jednoduchá požiadavka bez
 * preflightu, ktorú prehliadač dokončí aj po zatvorení karty. Worker číta telo ako JSON bez ohľadu
 * na Content-Type a CORS pôvod overí z hlavičky Origin.
 */
export function poziadavkaZrusenia(session) {
  return [API + '/v1/tiktok/cancel', {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    keepalive: true,
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ session }),
  }];
}

export function nahraj(fetchImpl, { session, blob }) {
  if (!blob || !blob.size) return Promise.reject(new ChybaZdielania('video_empty'));
  if (blob.size > MAX_VIDEO_BAJTOV) return Promise.reject(new ChybaZdielania('video_too_large', 413));
  return volaj(fetchImpl, '/v1/tiktok/upload', {
    surove: true,
    telo: blob,
    hlavicky: { 'Content-Type': blob.type || 'video/mp4', 'X-TikTok-Session': session },
  });
}

/** Ľudská veta ku každému kódu, ktorý môže prísť od workera alebo z TikToku. */
const SPRAVY = {
  network: 'We could not reach our server. Check your connection and try again.',
  tiktok_unavailable: 'Sharing to TikTok is not switched on yet. You can still download the video and upload it in the TikTok app.',
  rate_limited: 'Too many tries from this connection in a short time. Wait an hour and try again, or download the video instead.',
  daily_cap: 'Today’s sharing limit for the whole tool is used up. Download the video and upload it in the TikTok app, or try tomorrow.',
  access_denied: 'You cancelled the TikTok sign-in. Nothing was sent.',
  state_mismatch: 'The answer from TikTok did not belong to this page, so we ignored it. Please try again.',
  state_invalid: 'The sign-in could not be checked. Please try again.',
  state_expired: 'The sign-in took longer than 10 minutes. Please try again.',
  state_used: 'This sign-in was already used. Please try again.',
  pkce_mismatch: 'The sign-in could not be checked. Please try again.',
  code_rejected: 'TikTok did not accept the sign-in. Please try again.',
  scope_missing: 'Without the permission to upload a draft we cannot send the video. Try again and keep that box ticked, or download the video.',
  session_expired: 'Your TikTok sign-in expired after 15 minutes. Sign in again to send the video.',
  session_invalid: 'Your TikTok sign-in is no longer valid. Sign in again to send the video.',
  video_too_large: 'The video is larger than 30 MB. Choose a shorter countdown and try again.',
  video_length_mismatch: 'The video did not arrive whole. Please send it again.',
  video_too_small: 'The video looks empty. Make it again and retry.',
  video_format: 'TikTok accepts MP4 or WebM, and this file is neither. Make the video again.',
  spam_risk_too_many_pending_share: 'Your TikTok inbox already has 5 drafts from apps in the last 24 hours. Post or delete them in TikTok, then try again.',
  spam_risk_user_banned_from_posting: 'TikTok does not allow this account to post right now.',
  scope_not_authorized: 'TikTok says this app may not upload to your account. Sign in again and allow the upload.',
  access_token_invalid: 'Your TikTok sign-in expired. Sign in again.',
  rate_limit_exceeded: 'TikTok asked us to slow down. Wait a minute and try again.',
  upload_failed: 'The upload to TikTok broke off. Please try again.',
  popup_blocked: 'Your browser blocked the TikTok window. Allow pop-ups for arling.sk, or continue in this tab.',
  timeout: 'We did not hear back from TikTok. Close the TikTok window and try again.',
  still_processing: 'TikTok is still processing the video, or did not tell us how far it got. It usually reaches your inbox within minutes.',
  still_processing_next: 'Press Check again in a few minutes, and we revoke the permission as soon as TikTok confirms. If you close this page first, we revoke it then, and the draft may not arrive. You can also remove ARLing under the apps you allowed in your TikTok settings.',
};

export function sprava(kod) {
  return SPRAVY[kod] || 'Something went wrong on the way to TikTok. Please try again, or download the video and upload it yourself.';
}

/**
 * Veta o tom, čo sa stalo s prístupom. `revoked`: true (TikTok potvrdil zrušenie), false (nepotvrdil),
 * null (ešte sme nerušili, lebo TikTok video spracúva).
 */
export function vetaPristupu(revoked) {
  if (revoked === true) return 'The permission you gave us is revoked at TikTok.';
  if (revoked === false) return 'We asked TikTok to revoke the permission but got no confirmation. It ends by itself within 24 hours, and you can remove ARLing now under the apps you allowed in your TikTok settings.';
  return 'We have not revoked the permission yet, because that can stop TikTok from finishing the draft.';
}

/** Stav z TikToku po slovách pre človeka. */
export function vetaStavu(status, failReason) {
  switch (status) {
    case 'SEND_TO_USER_INBOX': return 'The draft is in your TikTok inbox. Open TikTok, tap the notification, then edit and post it yourself.';
    case 'PUBLISH_COMPLETE': return 'TikTok reports the video as posted.';
    case 'PROCESSING_UPLOAD': return 'TikTok is still processing the video. This can take a few minutes.';
    case 'FAILED': return `TikTok could not process the video${failReason ? ` (${failReason})` : ''}. Make it again or download it.`;
    default: return 'TikTok has the file and is working on it.';
  }
}
