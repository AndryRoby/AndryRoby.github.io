/* node --test products/arling-sk/puzzle-studio/jadro.test.mjs
 *
 * The two rules a customer would notice if they broke: the same account never
 * gets the same puzzle twice, and the free plan gets two a day. Both are pure
 * functions in jadro.mjs precisely so they can be checked here rather than by
 * clicking a page and hoping.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANY, ZADARMO, MAX_DAVKA, KLUC_VERZIA,
  jePlan, plan, smieTlacit, hash64, identitaZLicencie, identitaAnonymna,
  klucHlavolamu, normalizujSemeno, vezmiPoradia, kvotaStav, zostatok, povolenyPocet,
  dnesISO, nazovSuboru, kredit,
} from './jadro.mjs';

/* ── Plans ─────────────────────────────────────────────────────────────── */

test('the plan names are the ones the licence service signs', () => {
  assert.deepEqual(Object.keys(PLANY).sort(), [
    'puzzle-post-bulletin', 'puzzle-post-bulletin-pro', 'puzzle-studio-personal',
  ]);
  for (const meno of Object.keys(PLANY)) assert.equal(jePlan(meno), true);
});

test('anything that is not a plan falls back to the free tier', () => {
  for (const x of ['', null, undefined, 'sepa-pro', 'puzzle-post', 'PUZZLE-STUDIO-PERSONAL', 42]) {
    assert.equal(jePlan(x), false);
    assert.equal(plan(x), ZADARMO);
    assert.equal(plan(x).neobmedzene, false);
  }
});

test('only the bulletin plans carry a print licence', () => {
  assert.equal(smieTlacit('puzzle-studio-personal'), false);
  assert.equal(smieTlacit('puzzle-post-bulletin'), true);
  assert.equal(smieTlacit('puzzle-post-bulletin-pro'), true);
  assert.equal(smieTlacit(''), false);
});

test('the credit line never claims a print licence the plan does not have', () => {
  assert.ok(!/print licence/i.test(kredit('')));
  assert.ok(!/print licence/i.test(kredit('puzzle-studio-personal')));
  assert.match(kredit('puzzle-post-bulletin'), /Print licence for one publication/);
  for (const p of ['', 'puzzle-studio-personal', 'puzzle-post-bulletin']) {
    assert.match(kredit(p), /Puzzle by ARLing, arling\.sk/);
  }
});

/* ── Identity and hashing ──────────────────────────────────────────────── */

test('the hash is stable, 16 hex characters, and separates near misses', () => {
  assert.equal(hash64('andrej@arling.sk').length, 16);
  assert.match(hash64('andrej@arling.sk'), /^[0-9a-f]{16}$/);
  assert.equal(hash64('andrej@arling.sk'), hash64('andrej@arling.sk'));
  assert.notEqual(hash64('andrej@arling.sk'), hash64('andrej@arling.s'));
  assert.notEqual(hash64('ab'), hash64('ba'));
  assert.notEqual(hash64(''), hash64(' '));
});

test('a licence identity comes from the payload, not from the e-mail', () => {
  const p = { p: 'puzzle-studio-personal', e: '2026-10-18', m: '0123456789abcdef', s: 'xyz' };
  assert.equal(identitaZLicencie(p), 'e0123456789abcdef');
  assert.equal(identitaZLicencie({}), '');
  assert.equal(identitaZLicencie(null), '');
  assert.equal(identitaZLicencie({ m: 'short' }), '');
});

test('an anonymous identity is marked as one and is always 17 characters', () => {
  const a = identitaAnonymna('0123456789abcdef');
  assert.equal(a, 'a0123456789abcdef');
  assert.equal(identitaAnonymna('xy').length, 17);
  assert.equal(identitaAnonymna('').length, 17);
  assert.ok(identitaAnonymna('ffff').startsWith('a'));
});

/* ── Seed keys ─────────────────────────────────────────────────────────── */

test('the key namespace is separate from the daily games and the books', () => {
  const k = klucHlavolamu({ identita: 'e0123456789abcdef', druh: 'badgers', uroven: 'hard', velkost: 9, poradie: 7 });
  assert.ok(k.startsWith(KLUC_VERZIA + ':'));
  assert.ok(!/^\d{4}-\d{2}-\d{2}/.test(k));
  assert.ok(!k.startsWith('book:'));
  assert.ok(!k.startsWith('practice/'));
});

test('two puzzles of one account never share a key', () => {
  const zaklad = { identita: 'e0123456789abcdef', druh: 'otters', uroven: 'medium', velkost: 6 };
  const videne = new Set();
  for (let i = 0; i < 500; i++) videne.add(klucHlavolamu({ ...zaklad, poradie: i }));
  assert.equal(videne.size, 500);
});

test('two accounts on the same counter get different keys', () => {
  const a = klucHlavolamu({ identita: 'e1111111111111111', druh: 'swans', uroven: 'easy', velkost: 6, poradie: 1 });
  const b = klucHlavolamu({ identita: 'e2222222222222222', druh: 'swans', uroven: 'easy', velkost: 6, poradie: 1 });
  assert.notEqual(a, b);
});

test('kind, difficulty and size all change the key', () => {
  const z = { identita: 'e1', druh: 'voles', uroven: 'easy', velkost: 6, poradie: 3 };
  assert.notEqual(klucHlavolamu(z), klucHlavolamu({ ...z, druh: 'swans' }));
  assert.notEqual(klucHlavolamu(z), klucHlavolamu({ ...z, uroven: 'hard' }));
  assert.notEqual(klucHlavolamu(z), klucHlavolamu({ ...z, velkost: 8 }));
});

test('a seed word makes the key reproducible and account independent', () => {
  const a = klucHlavolamu({ identita: 'e1111111111111111', druh: 'magpies', uroven: 'easy', velkost: 8, poradie: 1, semeno: 'Autumn 2026' });
  const b = klucHlavolamu({ identita: 'e2222222222222222', druh: 'magpies', uroven: 'easy', velkost: 8, poradie: 1, semeno: ' autumn   2026 ' });
  assert.equal(a, b);
  assert.ok(a.indexOf(':seed:') > 0);
  assert.ok(a.indexOf('e1111111111111111') < 0);
});

test('a seed word still gives a different key for every position', () => {
  const z = { identita: 'e1', druh: 'magpies', uroven: 'easy', velkost: 8, semeno: 'autumn' };
  const videne = new Set();
  for (let i = 1; i <= 20; i++) videne.add(klucHlavolamu({ ...z, poradie: i }));
  assert.equal(videne.size, 20);
});

test('a seed word is normalised, cut and stripped of anything odd', () => {
  assert.equal(normalizujSemeno('  Autumn   2026 '), 'autumn-2026');
  assert.equal(normalizujSemeno('St. Martin’s / week'), 'st.-martins-week');
  assert.equal(normalizujSemeno('x'.repeat(200)).length, 48);
  assert.equal(normalizujSemeno(''), '');
  assert.equal(normalizujSemeno('   '), '');
});

/* ── The counter ───────────────────────────────────────────────────────── */

test('the counter only goes up and never hands out a number twice', () => {
  let ulozene = null;
  const videne = [];
  for (let k = 0; k < 10; k++) {
    const r = vezmiPoradia(ulozene, 3);
    videne.push(...r.poradia);
    ulozene = String(r.nove);
  }
  assert.equal(videne.length, 30);
  assert.equal(new Set(videne).size, 30);
  assert.equal(ulozene, '30');
});

test('a lost or damaged counter starts again rather than refusing to work', () => {
  for (const zle of [null, undefined, '', 'nonsense', '-5', '0', NaN, {}]) {
    const r = vezmiPoradia(zle, 2);
    assert.deepEqual(r.poradia, [0, 1]);
    assert.equal(r.nove, 2);
  }
});

test('a batch is never larger than the maximum or smaller than one', () => {
  assert.equal(vezmiPoradia(0, 99).poradia.length, MAX_DAVKA);
  assert.equal(vezmiPoradia(0, 0).poradia.length, 1);
  assert.equal(vezmiPoradia(0, -3).poradia.length, 1);
  assert.equal(vezmiPoradia(0, 'x').poradia.length, 1);
});

/* ── The quota ─────────────────────────────────────────────────────────── */

test('the free plan gets two a day and the count resets the next day', () => {
  let stav = null;
  const dnes = '2026-09-18';
  let r = povolenyPocet(stav, dnes, '', 1);
  assert.equal(r.pocet, 1);
  assert.equal(r.zostatok, 1);
  stav = r.stav;
  r = povolenyPocet(stav, dnes, '', 1);
  assert.equal(r.pocet, 1);
  assert.equal(r.zostatok, 0);
  stav = r.stav;
  r = povolenyPocet(stav, dnes, '', 1);
  assert.equal(r.pocet, 0);
  assert.equal(zostatok(stav, dnes, ''), 0);
  assert.equal(zostatok(stav, '2026-09-19', ''), ZADARMO.denne);
});

test('asking for more than is left gives what is left, not a refusal', () => {
  const r = povolenyPocet({ den: '2026-09-18', pocet: 1 }, '2026-09-18', '', 10);
  assert.equal(r.pocet, 1);
  assert.equal(r.orezane, true);
  assert.equal(r.stav.pocet, 2);
});

test('a paid plan is not counted at all', () => {
  for (const p of Object.keys(PLANY)) {
    const r = povolenyPocet({ den: '2026-09-18', pocet: 999 }, '2026-09-18', p, 20);
    assert.equal(r.pocet, 20);
    assert.equal(r.zostatok, Infinity);
    assert.equal(zostatok({ den: '2026-09-18', pocet: 999 }, '2026-09-18', p), Infinity);
  }
});

test('a damaged quota record is read as an empty day, not as a free pass', () => {
  for (const zle of [null, 'x', 42, { den: 'yesterday', pocet: 'lots' }, { pocet: -3 }]) {
    const s = kvotaStav(zle, '2026-09-18');
    assert.equal(s.den, '2026-09-18');
    assert.equal(s.pocet, 0);
  }
  const prenesene = kvotaStav({ den: '2026-09-18', pocet: 2 }, '2026-09-18');
  assert.equal(prenesene.pocet, 2);
});

test('today is a real date in the Bratislava day', () => {
  assert.match(dnesISO(), /^\d{4}-\d{2}-\d{2}$/);
  // Midnight UTC on this date is 01:00 or 02:00 in Bratislava, so the
  // Bratislava day is already the 18th.
  assert.equal(dnesISO(new Date('2026-09-18T00:30:00Z')), '2026-09-18');
  assert.equal(dnesISO(new Date('2026-09-17T23:30:00Z')), '2026-09-18');
});

/* ── File names ────────────────────────────────────────────────────────── */

test('a file name says what the file is and stays safe for a disk', () => {
  assert.equal(
    nazovSuboru({ druh: 'badgers', uroven: 'hard', velkost: 9, poradie: 3, pripona: 'png' }),
    'arling-badgers-hard-9-3.png',
  );
  assert.equal(
    nazovSuboru({ druh: 'badgers', uroven: 'hard', velkost: 9, poradie: 3, riesenie: true, pripona: 'svg' }),
    'arling-badgers-hard-9-solution-3.svg',
  );
  assert.match(nazovSuboru({ druh: 'a b/c', uroven: '..', poradie: 0, pripona: 'svg' }), /^[a-z0-9.\-]+$/);
});

test('two puzzles of one batch never share a file name', () => {
  const mena = new Set();
  for (let i = 1; i <= MAX_DAVKA; i++) {
    for (const r of [false, true]) {
      mena.add(nazovSuboru({ druh: 'otters', uroven: 'easy', velkost: 5, poradie: i, riesenie: r, pripona: 'svg' }));
    }
  }
  assert.equal(mena.size, MAX_DAVKA * 2);
});
