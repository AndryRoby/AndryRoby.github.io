// Testy klienta TikTok toku (tiktok.mjs): PKCE, state, návrat z Login Kitu, chyby a limity.
// Posledný test prejde celý tok proti skutočnému workeru z products/arling-asistent (s dvojníkom TikToku),
// ak je v pracovnej kópii; hub ako samostatný repozitár ho preskočí.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

import {
  API, MAX_VIDEO_BAJTOV, base64url, novyVerifier, challengePre, precitajNavrat, stateSedi,
  zacni, otvorRelaciu, nahraj, zistiStav, zrus, sprava, vetaStavu, vetaPristupu, poziadavkaZrusenia, ChybaZdielania,
  CHYBY_VIDEA, KONCOVE_STAVY,
} from './tiktok.mjs';

const TU = dirname(fileURLToPath(import.meta.url));

test('PKCE: verifier má 86 znakov z povolenej abecedy a je zakaždým iný', () => {
  const a = novyVerifier();
  const b = novyVerifier();
  assert.match(a, /^[A-Za-z0-9_-]{86}$/);
  assert.ok(a.length >= 43 && a.length <= 128);
  assert.notEqual(a, b);
});

test('PKCE: challenge S256 podľa príkladu z RFC 7636, príloha B', async () => {
  assert.equal(await challengePre('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  assert.match(await challengePre(novyVerifier()), /^[A-Za-z0-9_-]{43}$/);
  assert.equal(base64url(new Uint8Array([251, 255])), '-_8');
});

test('návrat z TikToku: kód, state, rozsahy aj chyba', () => {
  assert.deepEqual(precitajNavrat('?code=abc%2A1&scopes=user.info.basic,video.upload&state=s1'), {
    code: 'abc*1', state: 's1', scopes: ['user.info.basic', 'video.upload'], error: '', errorDescription: '',
  });
  const zrusene = precitajNavrat('?error=access_denied&error_description=The+user+denied&state=s1');
  assert.equal(zrusene.error, 'access_denied');
  assert.equal(zrusene.code, '');
  assert.equal(precitajNavrat('?kind=otters'), null);
  assert.equal(precitajNavrat('?code=abc'), null, 'bez state to nie je náš návrat');
  assert.equal(precitajNavrat(''), null);
});

test('state: len presná zhoda', () => {
  assert.ok(stateSedi('abc.def', 'abc.def'));
  assert.ok(!stateSedi('abc.def', 'abc.deg'));
  assert.ok(!stateSedi('abc.def', 'abc.de'));
  assert.ok(!stateSedi('', ''));
  assert.ok(!stateSedi(undefined, 'x'));
  assert.ok(!stateSedi('x', null));
});

/** Dvojník fetch pre worker: zaznamená volania, odpovie podľa mapy. */
function falosnyWorker(mapa) {
  const volania = [];
  const fetchImpl = async (url, init) => {
    volania.push({ url, init });
    const z = mapa[url.replace(API, '')];
    if (z instanceof Error) throw z;
    return new Response(JSON.stringify(z.telo), { status: z.status || 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetchImpl, volania };
}

test('volania workera: správne adresy, bez cookies, video ako surové telo s hlavičkou relácie', async () => {
  const w = falosnyWorker({
    '/v1/tiktok/start': { telo: { ok: true, state: 's', authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/?x=1' } },
    '/v1/tiktok/session': { telo: { ok: true, session: 'pecat', displayName: 'Ann' } },
    '/v1/tiktok/upload': { telo: { ok: true, publishId: 'p1', status: 'SEND_TO_USER_INBOX', revoked: true } },
    '/v1/tiktok/status': { telo: { ok: true, status: 'SEND_TO_USER_INBOX', revoked: true } },
    '/v1/tiktok/cancel': { telo: { ok: true, revoked: true } },
  });
  assert.equal((await zacni(w.fetchImpl, 'c'.repeat(43))).state, 's');
  assert.equal((await otvorRelaciu(w.fetchImpl, { code: 'k', state: 's', verifier: 'v' })).displayName, 'Ann');
  const blob = new Blob([new Uint8Array(1000)], { type: 'video/mp4' });
  assert.equal((await nahraj(w.fetchImpl, { session: 'pecat', blob })).publishId, 'p1');
  await zistiStav(w.fetchImpl, { session: 'pecat', publishId: 'p1' });
  await zrus(w.fetchImpl, 'pecat');
  assert.deepEqual(w.volania.map((v) => v.url), ['start', 'session', 'upload', 'status', 'cancel'].map((c) => `${API}/v1/tiktok/${c}`));
  for (const v of w.volania) {
    assert.equal(v.init.method, 'POST');
    assert.equal(v.init.credentials, 'omit');
  }
  const up = w.volania[2].init;
  assert.equal(up.body, blob);
  assert.equal(up.headers['X-TikTok-Session'], 'pecat');
  assert.equal(up.headers['Content-Type'], 'video/mp4');
  assert.deepEqual(JSON.parse(w.volania[1].init.body), { code: 'k', state: 's', verifier: 'v' });
});

test('chyby: kód z workera, výpadok siete a limit veľkosti ešte pred odoslaním', async () => {
  const w = falosnyWorker({
    '/v1/tiktok/start': { status: 429, telo: { error: 'rate_limited' } },
    '/v1/tiktok/session': new TypeError('Failed to fetch'),
    '/v1/tiktok/upload': { status: 429, telo: { error: 'spam_risk_too_many_pending_share' } },
  });
  await assert.rejects(zacni(w.fetchImpl, 'c'), (e) => e instanceof ChybaZdielania && e.kod === 'rate_limited' && e.status === 429);
  await assert.rejects(otvorRelaciu(w.fetchImpl, {}), (e) => e.kod === 'network');
  await assert.rejects(nahraj(w.fetchImpl, { session: 's', blob: new Blob([new Uint8Array(10)]) }), (e) => e.kod === 'spam_risk_too_many_pending_share');
  const pred = w.volania.length;
  const velky = { size: MAX_VIDEO_BAJTOV + 1, type: 'video/mp4' };
  await assert.rejects(nahraj(w.fetchImpl, { session: 's', blob: velky }), (e) => e.kod === 'video_too_large');
  await assert.rejects(nahraj(w.fetchImpl, { session: 's', blob: null }), (e) => e.kod === 'video_empty');
  assert.equal(w.volania.length, pred, 'príliš veľké alebo prázdne video sa vôbec neposiela');
});

test('každá chyba má ľudskú vetu bez pomlčiek a neznáma dostane všeobecnú', () => {
  const kody = ['network', 'tiktok_unavailable', 'rate_limited', 'daily_cap', 'access_denied', 'state_mismatch', 'state_invalid', 'state_expired', 'state_used',
    'pkce_mismatch', 'code_rejected', 'scope_missing', 'session_expired', 'session_invalid', 'video_too_large', 'video_too_small', 'video_format',
    'spam_risk_too_many_pending_share', 'spam_risk_user_banned_from_posting', 'scope_not_authorized', 'access_token_invalid', 'rate_limit_exceeded',
    'upload_failed', 'popup_blocked', 'timeout', 'video_length_mismatch', 'still_processing', 'still_processing_next'];
  const vseobecna = sprava('nieco_nove');
  for (const k of kody) {
    const s = sprava(k);
    assert.notEqual(s, vseobecna, k);
    assert.ok(!/[–—]/.test(s), k);
  }
  for (const st of ['SEND_TO_USER_INBOX', 'PUBLISH_COMPLETE', 'PROCESSING_UPLOAD', 'FAILED', 'X']) assert.ok(vetaStavu(st).length > 10);
  assert.match(vetaStavu('SEND_TO_USER_INBOX'), /inbox/);
  for (const r of [true, false, null]) assert.ok(!/[–—]/.test(vetaPristupu(r)) && vetaPristupu(r).length > 20);
  assert.match(vetaPristupu(false), /24 hours/);
  assert.match(sprava('video_too_large'), /30 MB/);
});

test('limit 30 MB, chyby videa a koncové stavy rovnaké ako vo workeri', async () => {
  assert.equal(MAX_VIDEO_BAJTOV, 30 * 1024 * 1024);
  assert.deepEqual(KONCOVE_STAVY, ['SEND_TO_USER_INBOX', 'PUBLISH_COMPLETE', 'FAILED']);
  const w = join(TU, '..', '..', 'arling-asistent', 'worker', 'src', 'tiktok-share.js');
  if (existsSync(w)) {
    const m = await import(pathToFileURL(w).href);
    assert.equal(m.MAX_VIDEO_BAJTOV, MAX_VIDEO_BAJTOV);
    assert.deepEqual(m.CHYBY_VIDEA, CHYBY_VIDEA);
  }
});

test('chyba nesie revoked z workera; zrušenie pri odchode je jednoduchá keepalive požiadavka', async () => {
  const w = falosnyWorker({ '/v1/tiktok/upload': { status: 429, telo: { error: 'rate_limited', revoked: true } }, '/v1/tiktok/start': { status: 503, telo: { error: 'tiktok_unavailable' } } });
  await assert.rejects(nahraj(w.fetchImpl, { session: 's', blob: new Blob([new Uint8Array(10)]) }), (e) => e.kod === 'rate_limited' && e.revoked === true);
  await assert.rejects(zacni(w.fetchImpl, 'c'), (e) => e.revoked === null);
  const [url, init] = poziadavkaZrusenia('pecat');
  assert.equal(url, API + '/v1/tiktok/cancel');
  assert.equal(init.keepalive, true);
  assert.equal(init.credentials, 'omit');
  assert.match(init.headers['Content-Type'], /^text\/plain/);
  assert.deepEqual(JSON.parse(init.body), { session: 'pecat' });
});

// --------------------------------------------------------------------------- celý tok s workerom

const WORKER = join(TU, '..', '..', 'arling-asistent', 'worker', 'src', 'index.js');

test('celý tok: prehliadač, worker a dvojník TikToku', { skip: !existsSync(WORKER) && 'worker nie je v pracovnej kópii' }, async () => {
  const { default: worker } = await import(pathToFileURL(WORKER).href);
  const tiktok = [];
  const json = (o) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });
  const ok = { code: 'ok', message: '', log_id: 'x' };
  const kv = new Map();
  const env = {
    TIKTOK_CLIENT_KEY: 'awkey',
    TIKTOK_CLIENT_SECRET: 'tajomstvo-na-test-0123456789abcdef',
    ASISTENT_CACHE: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); }, delete: async (k) => { kv.delete(k); } },
    cakaj: async () => {},
    fetchImpl: async (url, init) => {
      tiktok.push(String(url));
      if (url.endsWith('/v2/oauth/token/')) return json({ access_token: 'act.x', scope: 'user.info.basic,video.upload', open_id: 'o' });
      if (url.includes('/v2/user/info/')) return json({ data: { user: { display_name: 'Ann Teaches' } }, error: ok });
      if (url.endsWith('/inbox/video/init/')) return json({ data: { publish_id: 'pid', upload_url: 'https://open-upload.tiktokapis.com/u' }, error: ok });
      if (url.startsWith('https://open-upload.tiktokapis.com/')) return new Response(null, { status: 201 });
      if (url.endsWith('/status/fetch/')) return json({ data: { status: 'SEND_TO_USER_INBOX' }, error: ok });
      if (url.endsWith('/revoke/')) return json({});
      return new Response('', { status: 404 });
    },
  };
  // Prehliadač: fetch ide cez worker.fetch s pôvodom arling.sk.
  const prehliadac = async (url, init) => {
    const headers = new Headers(init.headers);
    headers.set('Origin', 'https://arling.sk');
    headers.set('CF-Connecting-IP', '198.51.100.9');
    return worker.fetch(new Request(url, { method: init.method, headers, body: init.body }), env, {});
  };

  const verifier = novyVerifier();
  const start = await zacni(prehliadac, await challengePre(verifier));
  const u = new URL(start.authorizeUrl);
  assert.equal(u.searchParams.get('scope'), 'user.info.basic,video.upload');
  // TikTok by vrátil prehliadač na redirect_uri s kódom a tým istým state.
  const navrat = precitajNavrat(`?code=kod1&scopes=user.info.basic%2Cvideo.upload&state=${encodeURIComponent(u.searchParams.get('state'))}`);
  assert.ok(stateSedi(start.state, navrat.state));
  const rel = await otvorRelaciu(prehliadac, { code: navrat.code, state: navrat.state, verifier });
  assert.equal(rel.displayName, 'Ann Teaches');
  const mp4 = new Uint8Array(40 * 1024);
  mp4.set([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70]);
  const vysledok = await nahraj(prehliadac, { session: rel.session, blob: new Blob([mp4], { type: 'video/mp4' }) });
  assert.deepEqual([vysledok.status, vysledok.revoked], ['SEND_TO_USER_INBOX', true]);
  assert.ok(tiktok.some((x) => x.endsWith('/revoke/')));
  // Druhé použitie toho istého kódu a state neprejde.
  await assert.rejects(otvorRelaciu(prehliadac, { code: navrat.code, state: navrat.state, verifier }), (e) => e.kod === 'state_used');

  // Zrušenie pri zatváraní karty (text/plain, bez preflightu) worker prijme a token zruší.
  const druha = await otvorRelaciu(prehliadac, await (async () => {
    const v2 = novyVerifier();
    const s2 = await zacni(prehliadac, await challengePre(v2));
    return { code: 'kod2', state: s2.state, verifier: v2 };
  })());
  const pred = tiktok.filter((x) => x.endsWith('/revoke/')).length;
  const [url, init] = poziadavkaZrusenia(druha.session);
  const odpoved = await (await prehliadac(url, init)).json();
  assert.deepEqual([odpoved.ok, odpoved.revoked], [true, true]);
  assert.equal(tiktok.filter((x) => x.endsWith('/revoke/')).length, pred + 1);
});
