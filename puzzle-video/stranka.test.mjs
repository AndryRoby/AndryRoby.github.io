// Kontrola stránky bez prehliadača: prvky, na ktoré siaha app.mjs, CSP, žiadne vložené skripty ani štýly,
// žiadne pomlčky v texte, odkazy na zásady a podmienky, mp4-muxer s licenciou.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const TU = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(TU, 'index.html'), 'utf8');
const app = readFileSync(join(TU, 'app.mjs'), 'utf8');

test('každé id, ktoré app.mjs hľadá, na stránke je', () => {
  const idcka = new Set([...app.matchAll(/\$\('([a-z0-9-]+)'\)/g)].map((m) => m[1]));
  assert.ok(idcka.size > 20);
  for (const id of idcka) assert.match(html, new RegExp(`id="${id}"`), id);
});

test('CSP: len vlastné skripty, spojenie len na náš worker, blob na náhľad videa', () => {
  const csp = (/http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html) || [])[1];
  assert.ok(csp);
  // Okrem vlastných skriptov len naša Umami analytika na homelabe (vkladá ops/design/obal.mjs).
  assert.match(csp, /script-src 'self'( https:\/\/homelab\.tailbf8f27\.ts\.net)?(;|\s'sha256)/);
  assert.match(csp, /connect-src 'self' https:\/\/arling-asistent\.arling\.workers\.dev( https:\/\/homelab\.tailbf8f27\.ts\.net)?;/);
  assert.match(csp, /img-src [^;]*blob:/);
  assert.match(csp, /media-src [^;]*blob:/);
  assert.ok(!/unsafe-inline|unsafe-eval/.test(csp));
});

test('žiadny vložený skript okrem JSON-LD a žiadny atribút style', () => {
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (m[2].trim()) assert.match(m[1], /type="application\/ld\+json"/, m[0].slice(0, 80));
  }
  assert.ok(!/\sstyle="/.test(html));
  assert.ok(!/\son[a-z]+="/.test(html), 'žiadne onclick a podobne');
});

test('text pre ľudí bez dlhej a strednej pomlčky, stránka po anglicky', () => {
  for (const subor of ['index.html', 'app.mjs', 'tiktok.mjs', 'scena.mjs', 'puzzle-video.css']) {
    assert.ok(!/[–—]/.test(readFileSync(join(TU, subor), 'utf8')), subor);
  }
  assert.match(html, /<html lang="en">/);
});

test('zásady, podmienky, kreditný riadok a licencia mp4-muxer', () => {
  assert.match(html, /href="\/privacy\/en\/"/);
  assert.match(html, /href="\/podmienky\/en\/"/);
  assert.match(html, /Puzzle by ARLing, arling\.sk/);
  assert.match(html, /user\.info\.basic/);
  assert.match(html, /video\.upload/);
  assert.ok(existsSync(join(TU, 'vendor', 'mp4-muxer.mjs')));
  assert.match(readFileSync(join(TU, 'vendor', 'mp4-muxer.LICENSE.txt'), 'utf8'), /^MIT License/);
  assert.match(readFileSync(join(TU, 'koder.mjs'), 'utf8'), /from '\.\/vendor\/mp4-muxer\.mjs'/);
});

test('súhlas pred odoslaním: tlačidlo TikToku je na začiatku vypnuté a potvrdenie účtu skryté', () => {
  assert.match(html, /id="tiktok-prihlas" disabled/);
  assert.match(html, /id="potvrd" hidden/);
  assert.match(html, /<input type="checkbox" id="suhlas">/);
  assert.ok(!/id="suhlas" checked/.test(html));
});

test('id prvkov oboch výrob (UI_STIAHNUTIE, UI_TIKTOK) sú na stránke', () => {
  const bloky = [...app.matchAll(/const UI_[A-Z]+ = \{([^}]+)\}/g)];
  assert.equal(bloky.length, 2);
  for (const [, telo] of bloky) {
    for (const [, id] of telo.matchAll(/'([a-z0-9-]+)'/g)) assert.match(html, new RegExp(`id="${id}"`), id);
  }
});

test('do TikToku ide kópia bez kreditu, ktorú tvorca videl v náhľade, nikdy stiahnuté video', () => {
  assert.match(app, /vyrobVariant\(false, UI_TIKTOK\)/);
  assert.match(app, /vyrobVariant\(true, UI_STIAHNUTIE\)/);
  assert.match(app, /tt\.nahraj\(fetch, \{ session, blob: ttVideo\.blob \}\)/);
  assert.ok(!/nahraj\(fetch, \{[^}]*video\.blob/.test(app), 'stiahnuté video s kreditom sa do TikToku neposiela');
  assert.match(app, /\$\('tiktok-video'\)\.src = ttVideo\.url/);
  assert.match(html, /id="tiktok-video"/);
  // Súhlas je až za náhľadom kópie.
  assert.ok(html.indexOf('id="tiktok-video"') < html.indexOf('id="suhlas"'));
});

test('texty sú pravdivé: kredit len v stiahnutom videu, odtlačok IP je pseudonymizovaný, logy Cloudflare spomenuté', () => {
  for (const stare of ['does not let you take it off', 'no watermark besides', 'Nothing that identifies you', 'one-way fingerprint', 'never the address itself', 'The permission ends when the upload is done']) {
    assert.ok(!html.includes(stare), stare);
  }
  assert.match(html, /every frame of the video you download carries/);
  assert.match(html, /pseudonymised fingerprint/);
  assert.match(html, /legitimate interest/);
  assert.match(html, /Cloudflare keeps technical logs/);
  assert.match(html, /\/api\/#licence/);
  assert.match(html, /entirely up to you/);
});

test('CSP hash zodpovedá JSON-LD', async () => {
  const { createHash } = await import('node:crypto');
  const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1];
  const hash = createHash('sha256').update(ld).digest('base64');
  assert.ok(html.includes(`'sha256-${hash}'`));
});
