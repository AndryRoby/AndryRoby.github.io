/* Little Island Zoo: tests of the economy and of the house rules.
   node --test products/arling-sk/games/zoo/tests.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as E from './ekonomika.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const src = f => (existsSync(join(DIR, f)) ? readFileSync(join(DIR, f), 'utf8') : '');
const blizko = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));

/* a park with animals in every habitat, keepers where asked */
function park(n = [10, 5, 3, 2, 1, 1, 1], keepers = []) {
  const s = E.novyStav();
  n.forEach((x, i) => { s.d[i].n = x; s.d[i].k = keepers.includes(i); });
  return s;
}

test('prices: first animal, growth, and a bulk buy equal to single buys', () => {
  assert.equal(E.cena(0, 0), 5);
  assert.ok(blizko(E.cena(0, 1), 5 * 1.07));
  for (let i = 0; i < E.TIERY.length; i++) {
    for (const n of [0, 7, 42, 199]) {
      let sum = 0;
      for (let k = 0; k < 13; k++) sum += E.cena(i, n + k);
      assert.ok(blizko(E.cena(i, n, 13), sum, 1e-11), `tier ${i} n ${n}`);
    }
  }
  assert.equal(E.cena(0, 5, 0), 0);
});

test('maxKupit buys exactly as many as the coins allow', () => {
  for (let i = 0; i < E.TIERY.length; i++) {
    for (const n of [0, 3, 30, 120]) {
      for (const f of [0.5, 1, 1.0000001, 7.3, 1e3, 1e9]) {
        const coins = E.cena(i, n) * f;
        const m = E.maxKupit(i, n, coins);
        assert.ok(E.cena(i, n, m) <= coins, `over: tier ${i} n ${n} f ${f}`);
        assert.ok(E.cena(i, n, m + 1) > coins, `under: tier ${i} n ${n} f ${f}`);
      }
    }
  }
  assert.equal(E.maxKupit(0, 0, 4.99), 0);
  assert.equal(E.maxKupit(0, 0, NaN), 0);
});

test('milestones double a habitat at 25, 50, 100 ... then every 100 past 500', () => {
  assert.equal(E.milnikov(24), 0);
  assert.equal(E.milnikov(25), 1);
  assert.equal(E.milnikov(50), 2);
  assert.equal(E.milnikov(500), 9);
  assert.equal(E.milnikov(599), 9);
  assert.equal(E.milnikov(600), 10);
  assert.equal(E.milnikov(1000), 14);
  assert.equal(E.dalsiMilnik(0), 25);
  assert.equal(E.dalsiMilnik(25), 50);
  assert.equal(E.dalsiMilnik(500), 600);
  assert.equal(E.dalsiMilnik(650), 700);
  assert.equal(E.predoslyMilnik(0), 0);
  assert.equal(E.predoslyMilnik(60), 50);
  assert.equal(E.predoslyMilnik(650), 600);
  const s = park([25, 0, 0, 0, 0, 0, 0]);
  assert.equal(E.prijemDruhu(s, 0), 25 * 0.5 * 2);
});

test('income: friends add 10 % each, studies x3 per habitat and x2 for the park', () => {
  const s = park([1, 0, 0, 0, 0, 0, 0]);
  assert.equal(E.prijemDruhu(s, 0), 0.5);
  s.priatelia = 10;
  assert.ok(blizko(E.prijemDruhu(s, 0), 1));
  s.priatelia = 0; s.st = ['a0'];
  assert.ok(blizko(E.prijemDruhu(s, 0), 1.5));
  s.st = ['a0', 'park-map'];
  assert.ok(blizko(E.prijemDruhu(s, 0), 3));
  assert.equal(E.prijemDruhu(s, 1), 0);
});

test('time: one step of 60 s equals sixty steps of 1 s (keepers), boxes stop when full', () => {
  const s = park([40, 12, 3, 0, 0, 0, 0], [0, 1, 2]);
  let a = E.tik(s, 60), b = s;
  for (let k = 0; k < 60; k++) b = E.tik(b, 1);
  assert.ok(blizko(a.mince, b.mince, 1e-12));
  assert.ok(blizko(a.zarobene, b.zarobene, 1e-12));
  const t = park([40, 0, 0, 0, 0, 0, 0]);
  const full = E.tik(t, 1000);
  assert.ok(blizko(full.d[0].box, E.kapacitaBoxu(t, 0)));
  assert.equal(full.mince, t.mince, 'no keeper, nothing comes in by itself');
  assert.deepEqual(E.tik(t, -5), E.tik(t, 0));
  assert.deepEqual(E.tik(t, NaN), E.tik(t, 0));
});

test('a tap empties the box into the coins and counts it as earned', () => {
  const t = E.tik(park([40, 0, 0, 0, 0, 0, 0]), 10);
  const box = t.d[0].box;
  assert.ok(box > 0);
  const r = E.zber(t, 0);
  assert.equal(r.zisk, box);
  assert.equal(r.stav.d[0].box, 0);
  assert.ok(blizko(r.stav.mince, t.mince + box));
  assert.ok(blizko(r.stav.zarobene, t.zarobene + box));
  assert.equal(t.d[0].box, box, 'the old state is untouched');
});

test('away: all coins up to a cap of 4 hours, more with friends, never negative', () => {
  const s = park([30, 10, 0, 0, 0, 0, 0], [0, 1]);
  const r = E.offline(s, 10 * 3600);
  assert.equal(r.strop, 4 * 3600);
  assert.equal(r.sekundy, 4 * 3600);
  assert.equal(r.odrezane, 6 * 3600);
  assert.ok(blizko(r.zisk, E.prijemSamo(s) * 4 * 3600));
  assert.equal(E.offline(s, -3600).zisk, 0);
  assert.equal(E.offline(s, NaN).zisk, 0);
  const f = { ...s, priatelia: 400 };
  assert.equal(E.stropOffline(f), 10 * 3600);
  assert.equal(E.stropOffline({ ...s, priatelia: 24 }), 5 * 3600);
  // habitats without a keeper only fill their box while away
  const g = park([30, 10, 0, 0, 0, 0, 0], [0]);
  const q = E.offline(g, 3600);
  assert.ok(blizko(q.zisk, E.prijemDruhu(g, 0) * 3600));
  assert.ok(blizko(q.stav.d[1].box, E.kapacitaBoxu(g, 1)));
});

test('buying: coins go down, locked habitats wait, a milestone is reported', () => {
  const s = E.novyStav();
  assert.equal(E.kup(s, 2, 1).ok, false, 'habitat 3 is locked while 2 is empty');
  const r = E.kup(s, 0, 1);
  assert.ok(r.ok);
  assert.ok(blizko(r.stav.mince, 10 - 5 * 1.07));
  assert.equal(r.stav.d[0].n, 2);
  assert.equal(E.kup(r.stav, 1, 1).ok, false, 'not enough coins');
  const rich = { ...park([24, 0, 0, 0, 0, 0, 0]), mince: 1e6 };
  const m = E.kup(rich, 0, 1);
  assert.ok(m.milnik);
  const nov = E.kup(rich, 1, 1);
  assert.ok(nov.ok && nov.novy);
});

test('a keeper empties the box first and then works for good', () => {
  const s = E.tik({ ...park([10, 0, 0, 0, 0, 0, 0]), mince: 100 }, 5);
  const box = s.d[0].box;
  const r = E.najmi(s, 0);
  assert.ok(r.ok);
  assert.ok(r.stav.d[0].k);
  assert.ok(blizko(r.stav.mince, 100 + box - E.cenaStrazcu(0)));
  assert.equal(E.najmi(r.stav, 0).ok, false, 'only one keeper');
  assert.equal(E.najmi({ ...E.novyStav(), mince: 1e9 }, 3).ok, false, 'no keeper for an empty habitat');
});

test('studies: bought once, only for built habitats, and they cost what the list says', () => {
  const s = { ...park([10, 0, 0, 0, 0, 0, 0]), mince: 1e12 };
  const list = E.studie(s);
  assert.equal(list.length, E.TIERY.length * 2 + E.STUDIE_PARK.length);
  for (let k = 1; k < list.length; k++) assert.ok(list[k - 1].cena <= list[k].cena, 'sorted by price');
  const a = E.kupStudiu(s, 'a0');
  assert.ok(a.ok);
  assert.equal(a.stav.mince, 1e12 - 5 * E.STUDIA_A);
  assert.equal(E.kupStudiu(a.stav, 'a0').ok, false);
  assert.equal(E.kupStudiu(s, 'a3').ok, false, 'habitat 4 not built yet');
  assert.equal(E.kupStudiu(s, 'nonsense').ok, false);
});

test('the voyage: friends from coins earned, a new island, a small start', () => {
  assert.equal(E.priateliaZa(0), 0);
  assert.equal(E.priateliaZa(25 * E.PRIATELIA_E0), 5);
  assert.equal(E.priateliaZa(25 * E.PRIATELIA_E0 - 1), 4);
  assert.equal(E.priateliaZa(100 * E.PRIATELIA_E0), 10);
  let prev = 0;
  for (let e = 1e9; e < 1e30; e *= 3.7) { const f = E.priateliaZa(e); assert.ok(f >= prev); prev = f; }
  const s = { ...park([80, 60, 40, 20, 10, 5, 1], [0, 1, 2]), mince: 5e12, zarobene: 24 * E.PRIATELIA_E0, spolu: 9e12, st: ['a0'] };
  assert.equal(E.plavba(s).ok, false, 'fewer than 5 friends: no voyage');
  s.zarobene = 30 * E.PRIATELIA_E0; s.priatelia = 3; s.boost = 600;
  const r = E.plavba(s);
  assert.ok(r.ok);
  assert.equal(r.priatelia, 5);
  assert.equal(r.stav.priatelia, 8);
  assert.equal(r.stav.ostrov, 1);
  assert.equal(r.stav.plavby, 1);
  assert.equal(r.stav.mince, E.START_MINCE);
  assert.equal(r.stav.zarobene, 0);
  assert.equal(r.stav.spolu, 9e12);
  assert.equal(r.stav.boost, 600, 'a banked boost is never lost');
  assert.deepEqual(r.stav.d.map(x => x.n), [1, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(r.stav.st, []);
  assert.equal(E.ostrov(1).meno, 'Reed Isle');
  assert.equal(E.ostrov(2).meno, 'Meadow Isle II');
  assert.equal(E.ostrov(3).druhy[0], 'magpies');
});

test('saving: round trip, and anything broken falls back safely', () => {
  let s = E.kup({ ...park([30, 12, 4, 0, 0, 0, 0], [0]), mince: 1e5, st: ['a0'] }, 1, 3).stav;
  s = E.tik(s, 7);
  assert.deepEqual(E.nacitaj(E.serializuj(s)), s);
  assert.deepEqual(E.nacitaj('{not json'), E.novyStav());
  assert.deepEqual(E.nacitaj(''), E.novyStav());
  assert.deepEqual(E.nacitaj('null'), E.novyStav());
  assert.deepEqual(E.nacitaj(JSON.stringify({ ...s, v: 99 })), E.novyStav());
  const bad = JSON.parse(E.serializuj(s));
  bad.mince = -50; bad.priatelia = 2.7; bad.d[1].n = 3.9; bad.d[3].k = true; bad.st = ['a0', 'a0', 'hack'];
  bad.d[0].box = 1e99; bad.boost = 1e9; bad.videa = { den: '2026-09-26', n: 99 };
  const q = E.nacitaj(JSON.stringify(bad));
  assert.equal(q.mince, E.START_MINCE);
  assert.equal(q.priatelia, 2);
  assert.equal(q.d[1].n, 3);
  assert.equal(q.d[3].k, false, 'no keeper in an empty habitat');
  assert.deepEqual(q.st, ['a0']);
  assert.ok(q.d[0].box <= E.kapacitaBoxu(q, 0) * E.VIDEO.nasobok);
  assert.equal(q.boost, E.VIDEO.stropSekund);
  assert.equal(q.videa.n, E.VIDEO.zaDen);
  const zero = JSON.parse(E.serializuj(E.novyStav())); zero.d[0].n = 0;
  assert.equal(E.nacitaj(JSON.stringify(zero)).d[0].n, 1, 'the first habitat always has its hedgehog');
});

test('numbers for people', () => {
  assert.equal(E.formatuj(0), '0');
  assert.equal(E.formatuj(5.57), '5.5');
  assert.equal(E.formatuj(999), '999');
  assert.equal(E.formatuj(1000), '1.00 K');
  assert.equal(E.formatuj(1234), '1.23 K');
  assert.equal(E.formatuj(12345), '12.3 K');
  assert.equal(E.formatuj(123456), '123 K');
  assert.equal(E.formatuj(999999), '999 K', 'rounded down, never more than there is');
  assert.equal(E.formatuj(1e6), '1.00 M');
  assert.equal(E.formatuj(2.5e12), '2.50 T');
  assert.equal(E.formatuj(1e15), '1.00 aa');
  assert.equal(E.formatuj(1e18), '1.00 ab');
  assert.equal(E.formatuj(Infinity), 'a lot');
  assert.equal(E.formatujCas(59), '59 s');
  assert.equal(E.formatujCas(125), '2 min 5 s');
  assert.equal(E.formatujCas(3 * 3600 + 120), '3 h 2 min');
  for (let x = 1; x < 1e300; x *= 13.7) assert.ok(E.formatuj(x).length <= 8, E.formatuj(x));
});

test('numbers never reach Infinity', () => {
  const s = { ...park([2000, 2000, 2000, 2000, 2000, 2000, 2000], [0, 1, 2, 3, 4, 5, 6]), priatelia: 1e12 };
  const r = E.tik(s, 1e9);
  assert.ok(Number.isFinite(r.mince) && Number.isFinite(r.zarobene) && Number.isFinite(r.spolu));
  assert.ok(Number.isFinite(E.priateliaZa(r.zarobene)));
});

/* ── The house rules (TOVAREN-HIER.md 7): tests, not promises ─────────── */
test('rules: the video gives the same fixed reward, at most 5 a day, never by itself', () => {
  const s = park([10, 0, 0, 0, 0, 0, 0]);
  let x = s;
  for (let k = 0; k < 5; k++) { const r = E.odmenaVidea(x, 'boost', '2026-09-26'); assert.ok(r.ok); x = r.stav; }
  assert.equal(x.boost, E.VIDEO.stropSekund, '30 minutes each, 2 hours at most banked');
  assert.equal(E.odmenaVidea(x, 'boost', '2026-09-26').ok, false, 'sixth video the same day');
  assert.ok(E.odmenaVidea(x, 'boost', '2026-09-27').ok, 'a new day');
  const o = E.odmenaVidea(s, 'offline', '2026-09-26', 1234);
  assert.equal(o.stav.mince, s.mince + 1234);
  assert.equal(E.odmenaVidea(s, 'mystery box', '2026-09-26').ok, false);
  const b = E.tik({ ...park([10, 0, 0, 0, 0, 0, 0], [0]), boost: 30 }, 60);
  assert.ok(blizko(b.mince - E.START_MINCE, E.prijemDruhu(b, 0) * (30 * 2 + 30)));
});

test('rules: no randomness, no clock in the economy; no ad calls and the video flag is off', () => {
  const eko = src('ekonomika.mjs');
  assert.ok(!/Math\.random/.test(eko));
  assert.ok(!/Date\.now|new Date|performance\.now/.test(eko));
  const hra = src('hra.js');
  if (hra) {
    assert.ok(!/Math\.random/.test(hra), 'the page draws with a seeded hash, never a dice');
    assert.ok(!/Math\.random/.test(src('scena.js')), 'the island is drawn from a seeded hash');
    assert.ok(/const REKLAMA_ZAPNUTA = false;/.test(hra), 'rewarded video interface present but off');
  }
  for (const f of ['hra.js', 'scena.js', 'index.html', 'ekonomika.mjs']) {
    const t = src(f);
    assert.ok(!/requestAd|showAd|adsbygoogle|googletag|admob/i.test(t), `${f}: no ad network calls`);
  }
});

test('rules: no energy, no lives, no countdown to an offer, no dashes in player text', () => {
  const words = /\b(energy|lives|hurry|only today|limited time|last chance|expires|don't miss|loot ?box|mystery box|spin|jackpot|gems)\b/i;
  for (const f of ['hra.js', 'scena.js', 'index.html', 'ekonomika.mjs']) {
    const t = src(f);
    if (!t) continue;
    const texts = [...t.matchAll(/'([^'\n]{3,})'|"([^"\n]{3,})"|`([^`\n]{3,})`|>([^<>\n]{3,})</g)].map(m => m[1] || m[2] || m[3] || m[4]);
    for (const s of texts) {
      assert.ok(!words.test(s), `${f}: pressure word in "${s}"`);
      assert.ok(!/[–—]/.test(s), `${f}: dash in "${s}"`);
    }
  }
});

test('pacing guard: a plain player builds habitat 3 in 10 minutes and not all 7 in 15', () => {
  let s = E.novyStav();
  let t = 0, all = null, third = null;
  while (t < 3600) {
    s = E.tik(s, 1); t++;
    if (t % 10 === 0) s = E.zberVsetko(s).stav;
    for (let g = 0; g < 50; g++) {
      let done = false;
      for (let i = E.TIERY.length - 1; i >= 0 && !done; i--) {
        if (s.d[i].n && !s.d[i].k && s.mince >= E.cenaStrazcu(i) && E.cenaStrazcu(i) <= 120 * E.prijemDruhu(s, i)) { s = E.najmi(s, i).stav; done = true; }
        else if (E.odomknuty(s, i) && s.mince >= E.cena(i, s.d[i].n)) { s = E.kup(s, i, 1).stav; done = true; }
      }
      if (!done) break;
    }
    if (third == null && s.d[2].n) third = t;
    if (all == null && s.d[6].n) all = t;
  }
  assert.ok(third != null && third <= 600, `habitat 3 at ${third} s`);
  assert.ok(all == null || all >= 900, `all seven at ${all} s`);
});
