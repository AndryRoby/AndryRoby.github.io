// Testy Daystone: node --test products/arling-sk/daystone/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parsujDatum, dnesnyDatum, dniMedzi, rokyADni, vyrocie, dalsiMilnik, spocitaj, cislo, vetaRokov,
  naBase64url, zBase64url, odkazFarby, odkazOtazky, citajHash, otazkaDna, PORADIE, MAX_ODPOVED, MAX_ODKAZ, cistyText,
} from './logika.mjs';
import { OTAZKY, TONY } from './otazky.mjs';

const POMLCKY = /[‒–—―−]/;

test('dni: obyčajný výpočet a čísla s čiarkou', () => {
  assert.equal(dniMedzi('2023-06-14', '2026-10-02'), 1206);
  assert.equal(dniMedzi('2026-10-02', '2026-10-02'), 0);
  assert.equal(cislo(1204), '1,204');
});

test('dni: priestupný rok a 29. 2.', () => {
  assert.equal(dniMedzi('2024-02-28', '2024-03-01'), 2);
  assert.equal(dniMedzi('2023-02-28', '2023-03-01'), 1);
  assert.equal(parsujDatum('2023-02-29'), null);
  assert.ok(parsujDatum('2024-02-29'));
  assert.equal(parsujDatum('1900-02-29'), null);
  assert.ok(parsujDatum('2000-02-29'));
  assert.equal(vyrocie('2024-02-29', 2025), '2025-02-28');
  assert.equal(vyrocie('2024-02-29', 2028), '2028-02-29');
  assert.deepEqual(rokyADni('2024-02-29', '2025-02-27'), { roky: 0, dni: 364 });
  assert.deepEqual(rokyADni('2024-02-29', '2025-02-28'), { roky: 1, dni: 0 });
  assert.deepEqual(rokyADni('2020-02-29', '2026-10-02'), { roky: 6, dni: dniMedzi('2026-02-28', '2026-10-02') });
});

test('dni: prechod na letný a zimný čas nemení počet', () => {
  // Európa: 29. 3. 2026 o 2:00 na 3:00 a 25. 10. 2026 o 3:00 na 2:00; USA 8. 3. 2026
  assert.equal(dniMedzi('2026-03-28', '2026-03-30'), 2);
  assert.equal(dniMedzi('2026-10-24', '2026-10-26'), 2);
  assert.equal(dniMedzi('2026-03-07', '2026-03-09'), 2);
  assert.equal(dniMedzi('2026-01-01', '2026-12-31'), 364);
});

test('dni: počíta sa podľa miestneho dátumu v pásme človeka', () => {
  const t = new Date('2026-03-29T00:30:00Z');
  assert.equal(dnesnyDatum(t, 'Europe/Bratislava'), '2026-03-29');
  assert.equal(dnesnyDatum(t, 'America/Los_Angeles'), '2026-03-28');
  assert.equal(dnesnyDatum(t, 'Pacific/Auckland'), '2026-03-29');
  // tesne po polnoci letného času v Bratislave (22:30 UTC = 0:30 SELČ nasledujúceho dňa)
  const leto = new Date('2026-03-30T22:30:00Z');
  assert.equal(dnesnyDatum(leto, 'Europe/Bratislava'), '2026-03-31');
  assert.equal(dniMedzi('2026-03-01', dnesnyDatum(leto, 'Europe/Bratislava')), 30);
  assert.equal(dniMedzi('2026-03-01', dnesnyDatum(leto, 'America/New_York')), 29);
});

test('dni: chyby slovami a budúcnosť', () => {
  assert.match(spocitaj('', '2026-10-02').chyba, /Pick the date/);
  assert.match(spocitaj('2026-02-30', '2026-10-02').chyba, /does not exist/);
  assert.match(spocitaj('2027-01-01', '2026-10-02').chyba, /ahead/);
  assert.equal(parsujDatum('2026-1-2'), null);
  assert.equal(parsujDatum('nonsense'), null);
  assert.equal(parsujDatum(42), null);
  const v = spocitaj('2023-06-14', '2026-10-02');
  assert.equal(v.dni, 1206);
  assert.equal(v.roky, 3);
  assert.equal(v.zvysok, 110);
  assert.equal(vetaRokov({ roky: v.roky, dni: v.zvysok }), '3 years and 110 days');
});

test('dni: ďalší míľnik', () => {
  assert.deepEqual(dalsiMilnik('2026-09-02', '2026-10-02'), { den: 50, datum: '2026-10-22', zostava: 20 });
  assert.equal(dalsiMilnik('2023-06-14', '2026-10-02').den, 1500);
  assert.equal(dalsiMilnik('2010-01-01', '2026-10-02').den, 6500);
});

test('odkaz: diakritika a emoji prejdú tam a späť', () => {
  const texty = ['Ďakujem, že si. Čaj s tebou je najlepší 🫖', 'Ich höre gern zu. 💛👩‍❤️‍👨', 'Привет, ты мой человек', '愛してる'];
  for (const t of texty) assert.equal(zBase64url(naBase64url(t)), t);
  const hash = odkazOtazky({ q: OTAZKY[0].id, a: 'Pomalé ráno 🌧️ a čaj', n: 'Ľubka', d: '2026-10-02' });
  assert.match(hash, /^#q=[A-Za-z0-9_-]+$/);
  const s = citajHash(hash);
  assert.equal(s.typ, 'otazka');
  assert.equal(s.data.a, 'Pomalé ráno 🌧️ a čaj');
  assert.equal(s.data.n, 'Ľubka');
});

test('odkaz: farba, odpoveď späť a otázka späť', () => {
  const f = citajHash(odkazFarby({ f: 'calm', h: 3, n: 'Sam', d: '2026-10-02' }));
  assert.deepEqual(f, { typ: 'farba', data: { v: 1, f: 'calm', h: 3, n: 'Sam', d: '2026-10-02' } });
  const spat = citajHash(odkazFarby({ f: 'low', h: 1, n: 'Zoë', d: '2026-10-02', spat: { f: 'calm', h: 3, n: 'Sam' } }));
  assert.deepEqual(spat.data.r, { f: 'calm', h: 3, n: 'Sam' });
  const q = citajHash(odkazOtazky({ q: 'cozy-01', a: 'A', d: '2026-10-02', b: 'B ❤️', m: 'Alex' }));
  assert.equal(q.data.b, 'B ❤️');
  assert.equal(q.data.m, 'Alex');
  assert.equal(citajHash('#days'), null);
  assert.equal(citajHash(''), null);
});

test('odkaz: zlý vstup nikdy nespadne, vráti chybu', () => {
  for (const zly of ['#q=', '#q=%%%', '#q=abc', '#c=e30', '#q=' + naBase64url('[1,2]'), '#q=' + naBase64url('null'),
    '#c=' + naBase64url(JSON.stringify({ v: 1, f: 'purple', h: 2 })), '#c=' + naBase64url(JSON.stringify({ v: 1, f: 'calm', h: 9 })),
    '#c=' + naBase64url(JSON.stringify({ v: 2, f: 'calm', h: 2 })), '#q=' + naBase64url(JSON.stringify({ v: 1, q: 'nie-je', a: 'x' })),
    '#q=' + naBase64url(JSON.stringify({ v: 1, q: 'cozy-01', a: 12 })), '#q=' + naBase64url(JSON.stringify({ v: 1, q: 'cozy-01', a: '' })),
    '#c=' + naBase64url(JSON.stringify({ v: 1, f: 'calm', h: 2, r: 'x' })), '#c=' + naBase64url(JSON.stringify({ v: 1, f: 'calm', h: 2, d: '2026-02-30' })),
    '#q=' + naBase64url('{"v":1,"q":"cozy-01","a":"ok","n":{"x":1}}'), '#q=////', '#q=' + '_'.repeat(5)]) {
    assert.deepEqual(citajHash(zly), { typ: 'chyba' }, zly);
  }
  // neplatné UTF-8 (osamelý bajt 0xFF)
  assert.equal(zBase64url('_w'), null);
  // príliš dlhý odkaz
  assert.equal(zBase64url('A'.repeat(MAX_ODKAZ + 4)), null);
  assert.deepEqual(citajHash('#q=' + 'A'.repeat(MAX_ODKAZ + 4)), { typ: 'chyba' });
});

test('odkaz: limit 280 znakov, emoji sa rátajú ako jeden znak', () => {
  const presne = '💛'.repeat(MAX_ODPOVED);
  assert.ok(citajHash(odkazOtazky({ q: 'cozy-01', a: presne })).data.a === presne);
  assert.throws(() => odkazOtazky({ q: 'cozy-01', a: 'a'.repeat(MAX_ODPOVED + 1) }), /under 280/);
  assert.throws(() => odkazOtazky({ q: 'cozy-01', a: '   ' }), /few words/);
  assert.throws(() => odkazOtazky({ q: 'cozy-01', a: 'ok', n: 'x'.repeat(25) }), /name/);
  assert.throws(() => odkazFarby({ f: 'calm', h: 0 }), /strong/);
  // podvrhnutý odkaz s dlhou odpoveďou sa nezobrazí
  const dlhy = '#q=' + naBase64url(JSON.stringify({ v: 1, q: 'cozy-01', a: 'a'.repeat(MAX_ODPOVED + 1) }));
  assert.deepEqual(citajHash(dlhy), { typ: 'chyba' });
  // najdlhší možný odkaz (dve odpovede plné emoji a mená) sa zmestí
  const max = odkazOtazky({ q: 'cozy-01', a: '👩‍❤️‍👨'.repeat(40), n: 'Ľ'.repeat(24), b: '🫖'.repeat(MAX_ODPOVED), m: 'Ž'.repeat(24), d: '2026-10-02' });
  assert.ok(max.length < MAX_ODKAZ, String(max.length));
});

test('text: riadiace znaky preč, riadky v odpovedi ostanú', () => {
  assert.equal(cistyText('  Sam\u0000\n Alex  '), 'Sam Alex');
  assert.equal(cistyText('a\r\n\n\n\nb', true), 'a\n\nb');
  assert.equal(cistyText('é', false), 'é');
});

test('otázky: aspoň 90, bez duplikátov, dĺžky, bez pomlčiek a zakázaných slov', () => {
  assert.ok(OTAZKY.length >= 90, String(OTAZKY.length));
  assert.equal(new Set(OTAZKY.map((o) => o.id)).size, OTAZKY.length);
  const normal = (t) => t.toLowerCase().replace(/[^a-z ]/g, '').trim();
  assert.equal(new Set(OTAZKY.map((o) => normal(o.text))).size, OTAZKY.length, 'duplicitný text');
  const zakazane = /\b(sex|sexy|position|kinky|spicy|foreplay|nude|naked|bed ?room|period|cycle|pregnan|health|sick|ill|diet|weight|salary|debt|money you|your money|income|ex|exes|divorce|cheat|death|die|died|grave|fight|argue|jealous|therapy|diagnose|narcissist|gaslight|streak|score|test|you should|help her|let him|her|him|she|he)\b/i;
  for (const o of OTAZKY) {
    assert.ok(o.text.length >= 20 && o.text.length <= 110, `${o.id} dĺžka ${o.text.length}`);
    assert.ok(!POMLCKY.test(o.text), `${o.id} pomlčka`);
    assert.ok(!/ - /.test(o.text), `${o.id} spojovník ako pomlčka`);
    assert.ok(!zakazane.test(o.text), `${o.id}: ${o.text}`);
    assert.ok(/[?.]$/.test(o.text), `${o.id} koniec vety`);
    assert.ok(TONY[o.ton], o.id);
  }
  for (const ton of Object.keys(TONY)) assert.ok(OTAZKY.filter((o) => o.ton === ton).length >= 12, ton);
});

test('otázka dňa: deterministická, rovnaká pre všetkých, iná zajtra, posun cyklí', () => {
  assert.equal(otazkaDna('2026-10-02').id, otazkaDna('2026-10-02').id);
  assert.notEqual(otazkaDna('2026-10-02').id, otazkaDna('2026-10-03').id);
  assert.equal(otazkaDna('2026-10-02', 1).id, otazkaDna('2026-10-03').id);
  assert.equal(otazkaDna('2026-10-02', PORADIE.length).id, otazkaDna('2026-10-02').id);
  assert.equal(otazkaDna('nie'), null);
  // celé kolo bez opakovania
  const kolo = new Set(Array.from({ length: PORADIE.length }, (_, i) => otazkaDna('2026-10-02', i).id));
  assert.equal(kolo.size, OTAZKY.length);
  // susedné dni nemajú rovnaký tón príliš často (premiešanie funguje)
  let rovnake = 0;
  for (let i = 0; i < PORADIE.length - 1; i++) if (PORADIE[i].ton === PORADIE[i + 1].ton) rovnake++;
  assert.ok(rovnake < PORADIE.length / 3, String(rovnake));
  // pevné semienko: zmena by zmenila otázku dňa pre ľudí s odkazom zo včera
  assert.equal(otazkaDna('2026-10-02').id, PORADIE[Math.floor(Date.UTC(2026, 9, 2) / 86400000) % PORADIE.length].id);
});

test('stránka: žiadne em ani en pomlčky v texte pre ľudí, Umami bez časti za #, žiadne vložené skripty', () => {
  for (const subor of ['index.html', 'app.mjs', 'logika.mjs', 'otazky.mjs', 'karta.mjs']) {
    const t = readFileSync(new URL(subor, import.meta.url), 'utf8');
    assert.ok(!POMLCKY.test(t), `${subor} má pomlčku`);
  }
  const html = readFileSync(new URL('index.html', import.meta.url), 'utf8');
  assert.match(html, /data-exclude-hash="true"/);
  assert.doesNotMatch(html, /data-exclude-search/, 'utm_source musí ostať v meraní');
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)];
  assert.equal(inline.length, 0, 'CSP nemá hash, vložený skript by bol mŕtvy');
  assert.doesNotMatch(html, /paper\.css|hub\.css/, 'vlastný vzhľad, nie tmavý hub');
  for (const u of ['daystone_calc', 'daystone_card_share', 'daystone_color_send', 'daystone_card_open', 'daystone_card_reply',
    'daystone_q_answer', 'daystone_q_send', 'daystone_q_open', 'daystone_q_reveal', 'daystone_q_reply', 'daystone_app_interest']) {
    assert.ok(readFileSync(new URL('app.mjs', import.meta.url), 'utf8').includes(`'${u}'`), u);
  }
  // text od človeka nikdy cez innerHTML
  const app = readFileSync(new URL('app.mjs', import.meta.url), 'utf8');
  assert.equal((app.match(/\.innerHTML\s*=/g) || []).length, 1, 'innerHTML len v zKonstanty');
  assert.match(app, /function zKonstanty\(markup\) \{\n  const t = document\.createElement\('template'\);\n  t\.innerHTML = markup;/);
});
