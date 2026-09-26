// TO: NULL: testy logiky, tempa, uloženia, textov, formátu a vzhľadu bez prehliadača (SPEC 8, testy 1 až 24 a 29 až 31).
// node --test products/arling-sk/games/to-null/tests.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import * as E from './ekonomika.mjs';
import * as P from './pribeh.mjs';
import * as U from './ulozenie.mjs';
import * as S from './simulacia.mjs';
import { cislo, cele, trvanie, vedecky } from './format.mjs';
import { LISTY, ULICE } from './listy.mjs';
import { SLUZ, LAT_ZDROJ, GLYFY, vzdialenost, zvislyTah, maSikminu, INDEX } from './glyfy.mjs';
import { TEMY, TEXTOVE, PLOCHY, kontrast, rgb } from './temy.mjs';
import { zalomRiadky, ramHore, ramDole, sekcia, listaPozornosti, tokText, desifrujText, zasifruj, textPozornosti } from './terminal.js';
import { PRAZDNY } from './glyfy.mjs';
import { RAMPA, OBRAZY, portret } from './ascii.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const citaj = (f) => readFileSync(join(DIR, f), 'utf8');
const blizko = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

function stav(o = {}) {
  const s = E.novyStav(42, 0);
  return Object.assign(s, o);
}

// ------------------------------------------------------------------ ekonomika (1 až 7)

test('1 ceny: n = 0 až 300 presne podľa 1.3, hromadná = súčet, MAX nepresiahne glyphs', () => {
  for (const g of E.PROCESY) {
    const { base, g: r } = E.K.gens[g];
    for (let n = 0; n <= 300; n++) assert.ok(blizko(E.cena(g, n), base * r ** n), `${g} ${n}`);
    for (const n of [0, 7, 25, 120]) {
      for (const k of [1, 10, 37]) {
        let sum = 0;
        for (let i = 0; i < k; i++) sum += E.cena(g, n + i);
        assert.ok(blizko(E.cenaHrom(g, n, k), sum, 1e-9), `hrom ${g} ${n} ${k}`);
      }
    }
    for (const glyphs of [0, 14.9, 15, 1000, 123456, 9.87e9, 3.3e15]) {
      for (const n of [0, 3, 50]) {
        const k = E.maxKusov(g, n, glyphs);
        if (k > 0) assert.ok(E.cenaHrom(g, n, k) <= glyphs, `MAX ${g}`);
        assert.ok(E.cenaHrom(g, n, k + 1) > glyphs, `MAX je najväčšie ${g}`);
      }
    }
  }
});

test('2 produkcia: míľniky, záplaty, globálny násobiteľ, ťuk s GRIP, f v tme a FLOOD', () => {
  const s = stav();
  s.n.hook = 25;
  assert.equal(E.tempoPlne(s), 25 * 0.5 * 2);
  s.up = ['barbed', 'deep'];
  assert.equal(E.tempoPlne(s), 25 * 0.5 * 8);
  s.n.hook = 200;
  assert.equal(E.nasobProcesu(s, 'hook'), 2 ** 4 * 4);
  Object.assign(s, { R: 10, lines: 2, dec: 3, lex: true, mended: 100 });
  const G = 2.5 * 1.2 * 1.5 ** 3 * 2 * 1.3;
  assert.ok(blizko(E.globalny(s), G));
  s.up.push('steady');
  assert.ok(blizko(E.hodnotaTuku(s), 2 * G));
  s.up.push('grip');
  assert.ok(blizko(E.hodnotaTuku(s), 2 * G + 0.05 * E.tempo(s)));
  s.darkMs = 1000;
  assert.equal(E.tempo(s), 0);
  assert.equal(E.hodnotaTuku(s), 0);
  s.darkMs = 0; s.floodMs = 1000;
  assert.ok(blizko(E.tempo(s), E.tempoPlne(s) * 0.25));
});

test('3 RECALL a SLEEP pre k = 0 až 8: podmienky, čo sa nuluje, čo ostáva, 1 HOOK zadarmo, riadky 5 až 7 len s LEXICON', () => {
  const s = stav({ sec: 6, tot: 5000, run: 5000 });
  assert.equal(E.mozeSpat(s), false, 'pred S07 nie');
  s.sec = 7;
  assert.equal(E.mozeSpat(s), true, 'k = 0 po S07');
  for (let k = 0; k <= 8; k++) {
    const t = stav({ sec: 7, stacks: 5, sleeps: k, lines: Math.min(4, k), R: 0 });
    const req = E.poziadavkaSpanku(k);
    assert.equal(req, k === 0 ? 0 : 1e6 * 25 ** (k - 1));
    t.run = Math.max(0, req - 1); t.tot = 1e18;
    if (k > 0) assert.equal(E.mozeSpat(t), false, `k=${k} pod požiadavkou`);
    t.run = req; t.tot = Math.max(t.tot, 1000);
    assert.equal(E.mozeSpat(t), true, `k=${k} na požiadavke`);
  }
  const u = stav({ sec: 7, stacks: 3, dec: 2, g: 9e6, run: 9e6, tot: 2.7e7, R: 0, lines: 0, cells: 5, mended: 7, att: 40 });
  u.n.hook = 40; u.n.sieve = 20; u.up = ['steady', 'barbed'];
  const r = E.spi(u);
  assert.equal(r.zisk, 30);
  assert.equal(u.R, 30);
  assert.equal(u.g, 0); assert.equal(u.run, 0); assert.equal(u.n.sieve, 0); assert.deepEqual(u.up, []);
  assert.equal(u.n.hook, 1, '1 HOOK zadarmo');
  assert.equal(u.sec, 7); assert.equal(u.stacks, 3); assert.equal(u.dec, 2); assert.equal(u.mended, 7); assert.equal(u.tot, 2.7e7);
  assert.equal(u.lines, 1); assert.equal(u.cells, 0); assert.equal(u.att, 0); assert.equal(u.act, 2);
  const w = stav({ sec: 7, lines: 4, R: 0, tot: 1e12, run: 1e12, sleeps: 5, cells: 9 });
  E.spi(w);
  assert.equal(w.lines, 4, 'bez LEXICON sa riadok 5 nedokončí');
  assert.equal(w.cells, 9, 'bunky ostanú');
  w.lex = true; w.run = 1e14; w.tot = 1e15;
  E.spi(w);
  assert.equal(w.lines, 5);
  const x = stav({ sec: 7, lines: 7, lex: true, tot: 1e15, run: 1e15, sleeps: 3 });
  E.spi(x);
  assert.equal(x.lines, 7, 'najviac 7 riadkov');
});

test('4 attention: ťuk, pokles, brána, slovo, tma; FLOOD pri 100 dá 30 s × 0,25, potom 60; glyphs počas FLOOD neklesnú', () => {
  const s = stav({ sec: 1 });
  E.tuk(s);
  assert.equal(s.att, 0, 'pred S02 nič');
  s.sec = 2;
  E.tuk(s);
  assert.ok(blizko(s.att, 0.2));
  E.krok(s, 250);
  assert.ok(blizko(s.att, 0.1));
  s.g = 1e9; s.tot = 1e9;
  E.kupBranu(s);
  assert.ok(blizko(s.att, 10.1));
  s.sec = 5; s.word = { id: 1, x: 0.5, len: 4, ms: 1000 };
  E.chytSlovo(s);
  assert.ok(blizko(s.att, 13.1));
  s.n.hook = 100; s.n.sieve = 100;
  const pred = s.att;
  for (let i = 0; i < 40; i++) E.krok(s, 250);
  assert.ok(s.att < pred, 'háčiky pozornosť nezvyšujú');
  s.att = 99.9;
  E.tuk(s);
  const ev = E.krok(s, 250);
  assert.ok(ev.some((e) => e.t === 'flood'));
  assert.equal(s.floodMs, 30000);
  assert.ok(blizko(E.tempo(s), E.tempoPlne(s) * 0.25));
  let g = s.g;
  for (let i = 0; i < 119; i++) { E.krok(s, 250); assert.ok(s.g >= g); g = s.g; }
  E.krok(s, 250);
  assert.equal(s.floodMs, 0);
  assert.equal(s.att, 60);
});

test('5 GO DARK: bunky ⌊vypustená / 10⌋ + 2 (Akt I a II), 30 v Akte III, LIGHTS ich nechá', () => {
  const s = stav({ sec: 2, att: 88 });
  assert.ok(E.goDark(s));
  assert.equal(s.cells, 2);
  for (let i = 0; i < 60; i++) E.krok(s, 250);
  assert.equal(s.darkMs, 0);
  assert.equal(s.cells, Math.floor(88 / 10) + 2);
  const t = stav({ sec: 2, att: 50 });
  E.goDark(t);
  for (let i = 0; i < 20; i++) E.krok(t, 250);
  const c = t.cells;
  E.lights(t);
  assert.equal(t.darkMs, 0);
  assert.equal(t.cells, c, 'LIGHTS nechá odhalené');
  assert.ok(c >= 2);
  const u = stav({ act: 3, lex: true, sec: 7, lines: 5 });
  E.goDark(u);
  for (let i = 0; i < 60; i++) E.krok(u, 250);
  assert.equal(u.cells, 30);
  const v = stav({ sec: 2, att: 100, lines: 0 });
  E.goDark(v);
  for (let i = 0; i < 60; i++) E.krok(v, 250);
  assert.ok(v.cells <= E.BUNKY_RIADKU[0]);
});

test('6 MEND: 40 % odklon, cena listu, mended prežije SLEEP, CONSUME nemení tempo', () => {
  const s = stav({ lex: true, act: 3, sec: 7, stacks: 5 });
  s.n.loom = 100;
  const P0 = E.tempo(s);
  const g0 = s.g;
  E.krok(s, 250);
  assert.ok(blizko(s.g - g0, P0 * 0.25));
  E.prepniRezim(s, 'mend');
  const g1 = s.g;
  const pool = s.mendPool;
  E.krok(s, 250);
  assert.ok(blizko(s.g - g1, P0 * 0.25 * 0.6, 1e-6));
  assert.ok(s.mendPool > pool || s.mended > 0);
  assert.ok(blizko(E.cenaListu(0), 1e8));
  assert.ok(blizko(E.cenaListu(10), 1e8 * 1.01 ** 10));
  const t = stav({ lex: true, act: 3, sec: 7, mode: 'mend', mendPool: 0 });
  t.n.loom = 400;
  for (let i = 0; i < 400; i++) E.krok(t, 250);
  assert.ok(t.mended > 0);
  const m = t.mended;
  t.run = 1e20; t.tot = 1e21;
  E.spi(t);
  assert.equal(t.mended, m);
  const u = stav({ lex: true, act: 3 });
  u.n.loom = 10;
  const a = E.tempo(u);
  E.prepniRezim(u, 'mend');
  E.prepniRezim(u, 'consume');
  assert.equal(E.tempo(u), a);
});

test('7 žiadne NaN ani nekonečno: 10 000 náhodných sekvencií akcií nad 3 h hry', () => {
  let seed = 99;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const akcie = [
    (s) => E.tuk(s), (s) => E.chytSlovo(s), (s) => E.kupBranu(s), (s) => E.kupProces(s, E.PROCESY[Math.floor(rnd() * 5)], [1, 10, 'max'][Math.floor(rnd() * 3)]),
    (s) => E.kupZaplatu(s, E.ZAPLATY[Math.floor(rnd() * 8)].id), (s) => E.kupDekoder(s), (s) => E.kupLexicon(s), (s) => E.goDark(s), (s) => E.lights(s),
    (s) => E.spi(s), (s) => E.prepniRezim(s, rnd() < 0.5 ? 'mend' : 'consume'), (s) => E.postup(s, rnd() * 60000),
    (s) => { const o = E.offline(s, rnd() * 3 * 3600 * 1000); E.prijmiOffline(s, o, rnd() < 0.5 ? 'take' : 'mend'); },
    (s) => E.nakupujPodlaPolitiky(s),
  ];
  // kolo oprav 2: sekvencie štartujú aj z Aktu II (hromady, DECODER, LEXICON na dosah) a z Aktu III (MEND, LOOM,
  // kľúče, nekonečný Akt III); konečnosť sa kontroluje po každej akcii, nie len na konci
  const akt2 = () => {
    const s = stav({ act: 2, sec: 7, stacks: 5, sleeps: 4, lines: 4, dec: 4, R: 30 });
    s.n.hook = 120; s.n.sieve = 80; s.n.thread = 40; s.n.bank = 30;
    return s;
  };
  const akt3 = () => {
    const s = stav({ act: 3, lex: true, sec: 7, stacks: 5, sleeps: 7, lines: 7, dec: 5, R: 100, mode: 'mend', mended: 400, keys: 2 });
    s.n.hook = 200; s.n.sieve = 150; s.n.thread = 100; s.n.bank = 60; s.n.loom = 50;
    s.themes = ['green', 'amber'];
    return s;
  };
  const konecne = (s) => ['g', 'run', 'tot', 'att', 'mended', 'mendPool', 'R', 'darkMs', 'floodMs'].every((k) => Number.isFinite(s[k])) && Number.isFinite(E.tempo(s));
  for (const [meno, zaciatok, pocet, mierka] of [['Akt I', stav, 10000, 1e13], ['Akt II', akt2, 3000, 1e10], ['Akt III', akt3, 3000, 1e16]]) {
    for (let i = 0; i < pocet; i++) {
      const s = zaciatok();
      s.g = rnd() < 0.5 ? rnd() * 1e6 : rnd() * mierka; s.tot = Math.max(s.tot, s.g * 3); s.run = s.g;
      for (let k = 0; k < 24; k++) {
        akcie[Math.floor(rnd() * akcie.length)](s);
        if (!konecne(s)) assert.fail(`${meno} sekvencia ${i} krok ${k}: nekonečné číslo`);
      }
      const chyby = U.over(s);
      assert.deepEqual(chyby, [], `${meno} sekvencia ${i}: ${chyby.join(', ')}`);
    }
  }
});

// ------------------------------------------------------------------ tempo (8 až 11)

const AKT = S.hraj(S.AKTIVNY, 7200, { pribeh: P });
const POK = S.hraj(S.POKOJNY, 9600, { pribeh: P });
const casy = (r) => new Map(r.ev.map(([t, m]) => [m, t]));

test('8 každá udalosť tabuľky 1.12 do 20 % (pred 2:00 ±15 s; pokojný ±60 s alebo 20 %)', () => {
  const ta = casy(AKT);
  const tp = casy(POK);
  const chyby = [];
  for (const [m, [ra, rp]] of Object.entries(S.TABULKA)) {
    const a = ta.get(m);
    if (ra !== null) {
      const tol = ra < 120 ? 15 : 0.2 * ra;
      if (a === undefined || Math.abs(a - ra) > tol) chyby.push(`aktívny ${m}: ${a} vs ${ra}`);
    }
    if (rp !== null) {
      const p = tp.get(m);
      const tol = Math.max(60, 0.2 * rp);
      if (p === undefined || Math.abs(p - rp) > tol) chyby.push(`pokojný ${m}: ${p} vs ${rp}`);
    }
  }
  assert.deepEqual(chyby, []);
});

test('9 aktívny: rozhodnutie ≤ 10 s, kúpa ≤ 60 s, automatizácia ≤ 3 min, SLEEP 1 v 10 až 15 min, druhý beh 1 000 za ≤ 0,6 času', () => {
  const ta = casy(AKT);
  // rozhodnutie = prvýkrát je čo kúpiť (riadok HOOK sa ukáže), merané v simulácii, nie konštanta modelu
  assert.ok(ta.get('vis:hook') <= 10, `riadok HOOK ${ta.get('vis:hook')} s`);
  assert.ok(ta.get('first hook') <= 60, `prvý HOOK ${ta.get('first hook')} s`);
  // automatizácia = pasívny príjem procesov prvýkrát prevýši príjem z ťukov (iný údaj než prvý HOOK)
  assert.ok(ta.get('auto>tap') > ta.get('first hook') && ta.get('auto>tap') <= 180, `procesy nad ťukmi ${ta.get('auto>tap')} s`);
  const s1 = ta.get('SLEEP1');
  assert.ok(s1 >= 600 && s1 <= 900, `SLEEP1 ${s1}`);
  const prvy = ta.get('run1000:0');
  const druhy = ta.get('run1000:1') - s1;
  assert.ok(druhy <= 0.6 * prvy, `druhý beh ${druhy} s vs prvý ${prvy} s`);
});

test('10 najdlhšia medzera bez novej veci v prvých 11 min aktívneho ≤ 45 s (pravidlo 4 výskumu; skutočné číslo sa vypíše)', () => {
  const m = S.najdlhsiaMedzera(AKT.novinky, 0, 660);
  console.log(`   najdlhšia medzera: ${m.max.toFixed(1)} s (${m.kde[0].toFixed(0)} s až ${m.kde[1].toFixed(0)} s)`);
  // pokojný hráč sa netestuje prahom (nemá pravidlo), ale číslo sa vypíše a je v STAV.md
  const p11 = S.najdlhsiaMedzera(POK.novinky, 0, 660);
  const p30 = S.najdlhsiaMedzera(POK.novinky, 0, 1800);
  console.log(`   pokojný: prvých 11 min ${p11.max.toFixed(1)} s (${p11.kde[0].toFixed(0)} až ${p11.kde[1].toFixed(0)} s), prvých 30 min ${p30.max.toFixed(1)} s (${p30.kde[0].toFixed(0)} až ${p30.kde[1].toFixed(0)} s)`);
  assert.ok(m.max <= 45, `${m.max}`);
});

test('10b strop ťukov: rýchly hráč 8/s aj autoklikač 30/s (strop 10/s) nedokončia M1 pod 60 min, FLOOD nepríde pri GO DARK na 88', () => {
  assert.equal(E.K.tapMaxS, 10);
  for (const mod of [S.RYCHLY, S.AUTOKLIK]) {
    const r = S.hraj(mod, 9000);
    const t = casy(r);
    assert.ok(t.get('mended 1000') >= 3600, `${mod.meno}: mended 1000 za ${t.get('mended 1000')} s`);
    assert.ok(t.get('LEXICON') >= 0.8 * S.TABULKA.LEXICON[0], `${mod.meno}: LEXICON ${t.get('LEXICON')} s`);
  }
  // autoklikač nad strop nezíska viac než hráč presne na strope
  const naStrope = S.hraj({ ...S.RYCHLY, tapRate: 10 }, 1200);
  const auto = S.hraj(S.AUTOKLIK, 1200);
  assert.equal(auto.s.tot, naStrope.s.tot);
});

test('11 offline: 50 %, strop 8 h, pozornosť nerastie, hodiny späť = 0, kroky po 250 ms = veľký krok do 1 %', () => {
  const s = stav({ sec: 3, att: 40 });
  s.n.hook = 50; s.n.sieve = 20;
  const P0 = E.tempoPlne(s);
  const o = E.offline(s, 3600 * 1000);
  assert.ok(blizko(o.zisk, 0.5 * P0 * 3600));
  assert.equal(s.att, 0);
  const t = stav({ sec: 3 });
  t.n.hook = 10;
  const o2 = E.offline(t, 20 * 3600 * 1000);
  assert.ok(blizko(o2.zisk, 0.5 * E.tempoPlne(t) * 8 * 3600));
  assert.ok(o2.strop);
  const o3 = E.offline(t, -5000);
  assert.equal(o3.zisk, 0);
  const u = stav({ sec: 3, att: 30 });
  u.n.hook = 30;
  const a = JSON.parse(JSON.stringify(u));
  E.postup(u, 60000);
  const b = a;
  b.up = [];
  const P1 = E.tempo(b);
  assert.ok(Math.abs(u.g - P1 * 60) / (P1 * 60) < 0.01);
  assert.equal(E.postup(u, 60001), false, 'nad 60 s ide cez offline');
  // dt z Date.now() a skrytá karta overuje tests-ui.mjs ("skrytá karta 1 h ...") na virtuálnych hodinách
  // druhá neprítomnosť počas otvorenej obrazovky návratu sa pripočíta, strop 8 h platí na súčet
  const w = stav({ sec: 3 });
  w.n.hook = 10;
  const Pw = E.tempoPlne(w);
  const a1 = E.offline(w, 3600 * 1000);
  const a2 = E.offline(w, 1800 * 1000);
  const z = E.zlucOffline(w, a1, a2);
  assert.ok(blizko(z.zisk, 0.5 * Pw * 5400, 1e-6));
  assert.equal(z.dt, 5400 * 1000);
  const b1 = E.offline(w, 7 * 3600 * 1000);
  const b2 = E.offline(w, 3 * 3600 * 1000);
  const zb = E.zlucOffline(w, b1, b2);
  assert.equal(zb.dt, 8 * 3600 * 1000);
  assert.ok(blizko(zb.zisk, 0.5 * Pw * 8 * 3600, 1e-6));
  assert.ok(zb.strop);
  const kod = citaj('ekonomika.mjs').split('\n').filter((r) => !r.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(kod, /Date\.now|performance\.now|setInterval/);
});

// ------------------------------------------------------------------ uloženie (12 až 17)

function pamat(hadze = false) {
  const m = new Map();
  if (hadze) return { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); }, removeItem() {} };
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('12 uložiť a načítať = hlboká zhoda', () => {
  const s = stav({ g: 1234.5, sec: 4, beats: ['boot1', 'gc.a1'], log: [{ id: 'gc.a1' }, { h: 'sys', t: 'x' }] });
  s.n.hook = 12;
  const ls = pamat();
  assert.ok(U.uloz(ls, s));
  const r = U.nacitaj(ls);
  assert.deepEqual(r.stav, JSON.parse(U.zbal(s)));
});

test('13 fixtúra v: 0 prejde migráciou', () => {
  const ls = pamat();
  ls.setItem(U.KLUC, JSON.stringify({ v: 0, glyphs: 120, lifetime: 900, recall: 2, hooks: 7, sectors: 1, seed: 5, lastSeen: 10 }));
  const r = U.nacitaj(ls);
  assert.ok(r.stav);
  assert.equal(r.stav.v, 1);
  assert.equal(r.stav.g, 120);
  assert.equal(r.stav.n.hook, 7);
  assert.equal(r.stav.R, 2);
});

test('14 poškodené uloženie sa nenačíta a ostane pod .bad', () => {
  for (const zle of ['{nie json', JSON.stringify({ ...stav(), g: -5 }), JSON.stringify({ ...stav(), up: ['turbo'] }), '{"v":1,"g":1e999}']) {
    const ls = pamat();
    ls.setItem(U.KLUC, zle);
    const r = U.nacitaj(ls);
    assert.equal(r.stav, null);
    assert.equal(ls.getItem(U.KLUC_ZLE), zle);
    assert.equal(ls.getItem(U.KLUC), zle, 'nič sa nezmaže');
  }
});

test('15 export a import tam a späť; zmenený znak zlyhá na súčte', () => {
  const s = stav({ g: 77, sec: 3, beats: ['gc.a1'], log: [{ h: 'sys', t: 'uptime ▒▒ → ok' }] });
  const kod = U.exportuj(s);
  assert.ok(kod.startsWith('TONULL1.'));
  assert.deepEqual(U.importuj(kod).stav, JSON.parse(U.zbal(s)));
  const i = 20;
  const zly = kod.slice(0, i) + (kod[i] === 'A' ? 'B' : 'A') + kod.slice(i + 1);
  assert.equal(U.importuj(zly).chyba, "that code doesn't parse. nothing changed.");
  assert.ok(U.importuj('hello').chyba);
});

test('16 novšia verzia sa neprepíše', () => {
  const ls = pamat();
  const t = JSON.stringify({ ...stav(), v: 99 });
  ls.setItem(U.KLUC, t);
  const r = U.nacitaj(ls);
  assert.equal(r.stav, null);
  assert.equal(r.zapis, false);
  assert.equal(ls.getItem(U.KLUC), t);
  assert.equal(r.novsia, t, 'text novšieho uloženia ide do UI, aby ho import najprv odložil bokom');
});

test('16b over(): slovo, príznaky a nevybratý offline zisk; import s word.ms = null neprejde', () => {
  const s = stav({ sec: 5 });
  s.word = { id: 3, x: 0.4, len: 5, ms: 1200 };
  s.pending = { dt: 3600000, zisk: 1234, listy: 0, strop: false };
  assert.deepEqual(U.over(s), []);
  const zle = [
    (x) => { x.word.ms = null; },
    (x) => { x.word.len = 0; },
    (x) => { x.wid = -1; },
    (x) => { x.w5 = null; },
    (x) => { x.floodRun = 0.5; },
    (x) => { x.wordTut = 'ano'; },
    (x) => { x.ended = 1; },
    (x) => { x.pending = { dt: 1, zisk: null, listy: 0 }; },
    // kolo oprav 2: položky logu, dk a snd (inak by term.obnov pri štarte hodil výnimku pred napojením MENU)
    (x) => { x.log = [{ id: 5 }]; },
    (x) => { x.log = [null]; },
    (x) => { x.log = [{ h: 'nieco', t: 'x' }]; },
    (x) => { x.log = [{ h: 'gc', t: 7 }]; },
    (x) => { x.log = [{ h: 'pre' }]; },
    (x) => { x.dk = null; },
    (x) => { x.dk = { base: 0, drained: 'a', ms: 0 }; },
    (x) => { x.snd = { on: 'yes', hum: true }; },
  ];
  const dobre = JSON.parse(JSON.stringify(s));
  dobre.log = [{ id: 'gc.a1' }, { h: 'sys', t: 'x' }, { h: 'pre', seed: 12 }, { h: 'mended', t: 'mended 0001 · to: e., quay road' }];
  assert.deepEqual(U.over(dobre), [], 'bežný log prejde');
  for (const f of zle) {
    const x = JSON.parse(JSON.stringify(s));
    f(x);
    assert.ok(U.over(x).length > 0, f.toString());
    assert.equal(U.importuj(U.exportuj(x)).stav, undefined, f.toString());
  }
});

test('17 localStorage, ktorý hádže výnimku, hru nezhodí', () => {
  const ls = pamat(true);
  const r = U.nacitaj(ls);
  assert.equal(r.stav, null);
  assert.equal(r.zapis, false);
  assert.equal(U.uloz(ls, stav()), false);
  assert.equal(U.nacitaj(null).zapis, false);
});

// ------------------------------------------------------------------ texty (18 až 22)

function vsetkyHlasy() {
  const out = [];
  for (const b of P.BEATS) {
    if (b.h === 'none' || b.h === 'card') continue;
    const t = b.hl ? b.hl + ' ' + b.ch : b.t;
    out.push([b.id, P.PREDPONA[b.h], t]);
  }
  for (const [k, t] of Object.entries(P.PREBUDENIE)) out.push(['wake.' + k, 'gc', t]);
  out.push(['stuck', 'gc', P.ZASEKNUTE], ['K15', 'KEEPER', P.K15.hl + ' ' + P.K15.ch], ['lex', 'KEEPER', P.LEXICON_RIADOK]);
  for (const [k, t] of Object.entries(P.SKRYTE_GC)) out.push(['cmd.' + k, 'gc', t]);
  for (const [k, t] of Object.entries(P.NAVRAT_GC)) out.push(['navrat' + k, 'gc', t]);
  const s = stav({ lex: true });
  const n = P.navratTexty(s, { dt: 8 * 3600 * 1000 - 1000, zisk: 9.99e14, listy: 1000 }, cislo, trvanie);
  for (const r of n.riadky) out.push(['navrat', P.PREDPONA[r.h], r.t]);
  return out;
}

test('18 každý hlas sa pri 390 px zalomí do najviac 2 riadkov po 38 znakov vrátane predpony', () => {
  const zle = [];
  for (const [id, pred, t] of vsetkyHlasy()) {
    const r = zalomRiadky((pred ? pred + ' ' : '') + t, 38);
    if (r.length > 2) zle.push(`${id}: ${r.length} riadky`);
  }
  assert.deepEqual(zle, []);
});

function textoveSubory() {
  return readdirSync(DIR).filter((f) => /\.(mjs|js|html|css|json|svg)$/.test(f));
}

test('19 žiadny znak U+2013 ani U+2014 v textoch ani v index.html', () => {
  for (const f of textoveSubory()) {
    const t = citaj(f);
    assert.ok(!new RegExp('[\\u2013\\u2014]').test(t), f);
  }
  for (const l of LISTY) assert.ok(!new RegExp('[\\u2013\\u2014]').test(l));
});

/** Obsah reťazcových literálov (bez komentárov). */
function literaly(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 2; continue; }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      let o = '';
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') { o += src[j + 1]; j += 2; continue; } o += src[j]; j++; }
      out.push(o);
      i = j + 1;
      continue;
    }
    i++;
  }
  return out;
}

test('20 každý znak textov a rámov je v fonty/znaky.json', () => {
  const kody = new Set(JSON.parse(citaj('fonty/znaky.json')).kody);
  const texty = [];
  for (const f of ['pribeh.mjs', 'ui.js', 'terminal.js', 'listy.mjs', 'ekonomika.mjs', 'format.mjs']) texty.push(...literaly(citaj(f)));
  texty.push(citaj('index.html').replace(/<[^>]+>/g, ' '));
  texty.push(RAMPA, ramHore('LOG', 40), ramDole(40), sekcia('PATCHES', 40), listaPozornosti(38), tokText(3, 30, 2), zasifruj('hello world'), desifrujText('abc def', 5));
  for (const k of Object.keys(OBRAZY)) texty.push(...OBRAZY[k]());
  texty.push(...portret(7));
  const chyba = new Set();
  for (const t of texty) for (const ch of t) { const k = ch.codePointAt(0); if (k >= 32 && !kody.has(k)) chyba.add(ch + ' U+' + k.toString(16)); }
  assert.deepEqual([...chyba], []);
});

const ZAKAZANE = ['matrix', 'neo', 'morpheus', 'trinity', 'zion', 'oracle', 'rabbit', 'pill', 'agent smith', 'wake up', 'wakes up', "you're awake", 'the one', 'spoon', 'nebuchadnezzar', 'anderson', 'google', 'apple', 'amazon', 'facebook', 'coca', 'nike', 'london', 'paris', 'new york', 'bratislava', 'church', 'god', 'prayer', 'spell', 'witch', 'tarot', 'casino', 'bet'];

test('21 listy.mjs: 300 jedinečných viet, ≤ 44 znakov, malé písmená, len fiktívne ulice, žiadne zakázané slová', () => {
  assert.equal(LISTY.length, 300);
  assert.equal(new Set(LISTY).size, 300);
  const zakazane = ZAKAZANE;
  for (const l of LISTY) {
    assert.ok(l.length <= 44, l);
    assert.equal(l, l.toLowerCase());
    assert.match(l, /^[a-z0-9 .,'?!:;]+$/, l);
    for (const z of zakazane) assert.ok(!new RegExp(`\\b${z}\\b`).test(l), `${z} v "${l}"`);
    const m = l.match(/\b(\w+ (?:road|lane|street|avenue|square))\b/);
    if (m) assert.ok(ULICE.includes(m[1]) || /^(the|a|new|your|our|my) /.test(m[1]), `ulica "${m[1]}"`);
  }
});

test('21b žiadna replika ani meno z filmu: zakázané frázy nad všetkými reťazcami príbehu, UI, terminálu a ukážok', () => {
  const zle = [];
  for (const f of ['pribeh.mjs', 'ui.js', 'terminal.js', 'ukazky.mjs', 'ekonomika.mjs', 'index.html']) {
    const texty = f.endsWith('.html') ? [citaj(f).replace(/<[^>]+>/g, ' ')] : literaly(citaj(f));
    for (const t of texty) {
      const l = t.toLowerCase();
      for (const z of ZAKAZANE) if (new RegExp(`\\b${z}\\b`).test(l)) zle.push(`${f}: "${z}" v "${t.slice(0, 60)}"`);
    }
  }
  assert.deepEqual(zle, []);
});

test('22 KEEPER veľkými, gc malými; zvrat nie je v <title> ani meta description', () => {
  for (const b of P.BEATS) {
    const t = b.hl ? b.hl + ' ' + b.ch : b.t;
    if (b.h === 'keeper') assert.equal(t, t.toUpperCase(), b.id);
    if (b.h === 'gc') assert.equal(t, t.toLowerCase(), b.id);
  }
  for (const t of Object.values(P.PREBUDENIE)) assert.equal(t, t.toLowerCase());
  const html = citaj('index.html');
  const titul = html.match(/<title>([^<]*)<\/title>/)[1];
  const popis = html.match(/<meta name="description" content="([^"]*)"/)[1];
  assert.equal(popis, 'A terminal incremental. Catch the falling glyphs in a forgotten relay. Free, no ads.');
  for (const z of ['letter', 'letters', 'lexicon', 'mend']) {
    assert.ok(!titul.toLowerCase().includes(z));
    assert.ok(!popis.toLowerCase().includes(z));
  }
  // vypálený list neprezradí zvrat pred LEXICON: "letters" je až v riadku 5
  assert.ok(E.LIST.slice(0, 4).every((r) => !/letter/.test(r)));
  assert.match(E.LIST[4], /letters/);
});

test('22b pred LEXICON nič neprezradí zvrat: žiadne "letter" ani "mend" v textoch dosiahnuteľných pred LEXICON (okrem chvostov ▒)', () => {
  const zvrat = /letter|mend/i;
  const zle = [];
  const pozri = (odkial, t) => { if (zvrat.test(String(t).replace(/▒+/g, ''))) zle.push(`${odkial}: ${t}`); };
  const akt3 = /^(gc\.c|K\.c|card3|key|end\.)/;
  for (let dec = 0; dec <= 5; dec++) {
    const s = stav({ dec, sec: 7, stacks: 5 });
    for (const b of P.BEATS) if (!akt3.test(b.id)) pozri(b.id, P.textRiadku(b, s));
  }
  for (const k of [2, 3, 4]) pozri('wake.' + k, P.PREBUDENIE[k]);
  pozri('stuck', P.ZASEKNUTE);
  pozri('K15', P.textRiadku({ id: 'K15.1', ...P.K15 }, stav()));
  for (const t of Object.values(P.SKRYTE_GC)) pozri('skryty', t);
  pozri('navrat', P.NAVRAT_GC[1]);
  pozri('navrat', P.NAVRAT_GC[2]);
  for (const r of P.lexiconDialog(stav({ stacks: 5 }), cislo).riadky) pozri('lexicon dialóg', r);
  const nt = P.navratTexty(stav(), { dt: 3600000, zisk: 10, listy: 0 }, cislo, trvanie);
  for (const r of [...nt.riadky, ...nt.tlacidla]) pozri('návrat', r.t);
  const prikazy = ['help', 'clear', 'sound', 'sound on', 'theme', 'theme green', 'theme amber', 'theme rose', 'theme x', 'save', 'sleep', 'read', 'whoami', 'trace', 'history', 'uptime', 'xyz'];
  for (const st of [stav({ sec: 3 }), stav({ sec: 7, stacks: 4, dec: 3, sleeps: 4 }), stav({ sec: 7, stacks: 5, dec: 5, sleeps: 6, lines: 4 })]) {
    for (const c of prikazy) for (const r of P.prikaz(st, c).riadky) pozri(`> ${c}`, r.t);
  }
  assert.deepEqual(zle, []);
  // po LEXICON sa zamknutá téma odkáže na opravy
  assert.equal(P.prikaz(stav({ lex: true, sec: 7 }), 'theme rose').riadky[0].t, 'locked. mend more letters.');
});

// ------------------------------------------------------------------ formát (23)

test('23 formát čísel a trvania', () => {
  const tab = [[0, '0'], [2.5, '2.5'], [999, '999'], [9812, '9,812'], [12431, '12.4K'], [125000, '125K'], [999950, '1.00M'], [1250000, '1.25M'], [1e9, '1.00B'], [1e12, '1.00T'], [1e15, '1.00e15']];
  for (const [x, t] of tab) assert.equal(cislo(x), t, String(x));
  assert.equal(trvanie(22320), '6h 12m');
  assert.throws(() => cislo(NaN));
  for (let e = 4; e < 300; e += 0.37) {
    const t = cislo(10 ** e);
    assert.ok(!/0{16}/.test(t), t);
    if (e < 15) assert.match(t, /^\d{1,3}(\.\d+)?[KMBT]$|^\d{1,3}(\.\d+)?$/);
    const cif = t.replace(/[^0-9]/g, '').replace(/^0+/, '');
    if (e >= 4 && e < 15) assert.ok(cif.length === 3 || /^\d+[KMBT]$/.test(t), t);
  }
  assert.equal(cele(3.7), '3');
  assert.equal(vedecky(9.999e17), '1.00e18');
});

// ------------------------------------------------------------------ vzhľad (24, 29 až 31)

function tokenyCss() {
  const css = citaj('hra.css');
  const out = {};
  for (const [meno, sel] of [['green', ':root, :root[data-theme="green"]'], ['amber', ':root[data-theme="amber"]'], ['rose', ':root[data-theme="rose"]']]) {
    const i = css.indexOf(sel + ' {');
    assert.ok(i >= 0, sel);
    const blok = css.slice(i, css.indexOf('}', i));
    out[meno] = {};
    for (const m of blok.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) out[meno][m[1]] = m[2].toUpperCase();
  }
  return out;
}

test('24 kontrast: tokeny troch tém z hra.css, text ≥ 4,5, rámy ≥ 3; canvas používa tie isté farby', () => {
  const css = tokenyCss();
  for (const [meno, t] of Object.entries(TEMY)) {
    for (const [k, v] of Object.entries(t)) assert.equal(css[meno][k], v.toUpperCase(), `${meno} --${k}`);
    for (const p of PLOCHY) {
      for (const x of TEXTOVE) assert.ok(kontrast(t[x], t[p]) >= 4.5, `${meno} ${x} na ${p}: ${kontrast(t[x], t[p]).toFixed(2)}`);
      assert.ok(kontrast(t.frame, t[p]) >= 3, `${meno} frame na ${p}`);
      assert.ok(kontrast(t.bg, t.fos) >= 4.5);
    }
    assert.ok(kontrast(t['burn-glow'], t.bg) >= 4.5);
  }
});

test('29 glyfy: 48 servisných jedinečných, vzdialenosť ≥ 6 medzi sebou aj od latinky, každý so zvislým ťahom 3, bez šikmín', () => {
  assert.equal(SLUZ.length, 48);
  const lat = Object.keys(LAT_ZDROJ).filter((k) => k !== ' ').map((k) => GLYFY[INDEX[k]]);
  for (let i = 0; i < SLUZ.length; i++) {
    assert.ok(zvislyTah(SLUZ[i]) >= 3, `glyf ${i}`);
    assert.ok(!maSikminu(SLUZ[i]), `šikmina ${i}`);
    for (let j = i + 1; j < SLUZ.length; j++) assert.ok(vzdialenost(SLUZ[i], SLUZ[j]) >= 6, `${i} a ${j}`);
    for (const l of lat) assert.ok(vzdialenost(SLUZ[i], l) >= 6, `${i} od latinky`);
  }
});

test('30 žiadna červená v hra.css (odtieň 345° až 15° so sýtosťou nad 50 %)', () => {
  const css = citaj('hra.css');
  for (const m of css.matchAll(/#([0-9A-Fa-f]{6})\b/g)) {
    const [r, g, b] = rgb(m[1]).map((x) => x / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (d) h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
    h = (h + 360) % 360;
    assert.ok(!((h >= 345 || h <= 15) && sat > 0.5), `#${m[1]} je červená`);
  }
});

test('31 index.html: zverejnená (index, canonical), CSP bez unsafe-inline, skripty len so src alebo JSON-LD, vonkajšie URL len arling.sk a Umami v hlavičke', () => {
  const html = citaj('index.html');
  assert.match(html, /<meta name="robots" content="index, follow">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/arling\.sk\/games\/to-null\/">/);
  for (const u of html.matchAll(/https?:\/\/[^"'\s<>]+/g)) assert.match(u[0], /^https:\/\/(arling\.sk\/|homelab\.server\.ts\.net\/?|schema\.org)/, 'cudzia URL ' + u[0]);
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  assert.ok(!csp.includes('unsafe-inline'));
  assert.ok(!csp.includes('unsafe-eval'));
  for (const m of html.matchAll(/<script([^>]*)>/g)) assert.match(m[1], /src="|type="application\/ld\+json"/);
  assert.ok(!/\sstyle="/.test(html));
  assert.ok(!/<style/.test(html));
  for (const f of textoveSubory().filter((f) => f !== 'index.html')) {
    const t = citaj(f).replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '');
    assert.ok(!/https?:\/\//.test(t), `${f} obsahuje URL`);
  }
  for (const f of ['ui.js', 'dazd.js', 'terminal.js']) {
    const t = citaj(f);
    assert.ok(!/innerHTML|eval\(|new Function/.test(t), f);
  }
});

test('rozpočet: JS spolu do 70 kB gzip, CSS do 10 kB gzip, písma do 75 kB', () => {
  let js = '';
  for (const f of readdirSync(DIR)) if (/\.(m?js)$/.test(f) && !/^tests|^simulacia/.test(f)) js += citaj(f);
  const jsGz = gzipSync(js).length;
  const cssGz = gzipSync(citaj('hra.css')).length;
  let pisma = 0;
  for (const f of readdirSync(join(DIR, 'fonty'))) if (extname(f) === '.woff2') pisma += statSync(join(DIR, 'fonty', f)).size;
  console.log(`   JS ${(jsGz / 1024).toFixed(1)} kB gzip, CSS ${(cssGz / 1024).toFixed(1)} kB gzip, písma ${(pisma / 1024).toFixed(1)} kB`);
  assert.ok(jsGz <= 70 * 1024);
  assert.ok(cssGz <= 10 * 1024);
  assert.ok(pisma <= 75 * 1024);
});

test('príkazy: help ukazuje len viditeľné, skryté príkazy podľa stavu, neznámy', () => {
  const s = stav({ sec: 3 });
  assert.equal(P.prikaz(s, 'help').riadky[0].t, 'commands: help, clear, sound, theme, save');
  assert.equal(P.prikaz(s, 'whoami').riadky[0].t, '▒▒▒_▒▒▒▒');
  assert.equal(P.prikaz(s, 'whoami').gc, 'cmd.whoami');
  s.sec = 7; s.dec = 2;
  assert.equal(P.prikaz(s, 'whoami').riadky[0].t, 'ms▒_0▒▒0');
  s.keys = 3;
  assert.equal(P.prikaz(s, 'whoami').riadky[0].t, 'msg_0000. to: NULL.');
  assert.equal(P.prikaz(s, 'theme rose').riadky[0].t, 'locked. keep going.', 'pred LEXICON neutrálne');
  assert.equal(P.prikaz(s, 'xyz').riadky[0].t, 'unknown command. try help.');
  s.sleeps = 3;
  assert.equal(P.prikaz(s, 'uptime').riadky[0].t, '14,625 days. 3 sleeps.');
  assert.match(P.prikaz(s, 'trace').riadky[0].t, /relay lantern/);
});

test('KEEPER: hlavička sa s DECODER čistí, chvost ostáva ▒ až do LEXICON', () => {
  const b = P.BEAT.K1;
  const s0 = stav({ dec: 0 });
  const s5 = stav({ dec: 5 });
  const t0 = P.textRiadku(b, s0);
  const t5 = P.textRiadku(b, s5);
  assert.ok((t0.match(/▒/g) || []).length > (t5.match(/▒/g) || []).length);
  assert.ok(t5.endsWith('▒▒▒▒▒▒ ▒▒▒▒▒'));
  assert.ok(t5.startsWith('1NTRUS10N. SECT0R 2.'));
  assert.equal(P.textRiadku(b, stav({ lex: true })), 'INTRUSION. SECTOR 2. PLEASE STOP.');
});

test('ostrosť canvasu: pomer zariadenie / canvas je celé číslo; stĺpce sa zmestia do canvasu bez orezania', async () => {
  const { Dazd } = await import('./dazd.js');
  for (const dpr of [1, 1.25, 1.5, 2, 2.625, 3, 4]) {
    const m = Dazd.mierka(dpr);
    const pomer = dpr / m;
    assert.ok(Math.abs(pomer - Math.round(pomer)) < 1e-9, `DPR ${dpr}: mierka ${m}, pomer ${pomer}`);
    assert.ok(m >= 1 && m <= 2, `DPR ${dpr}: mierka ${m}`);
  }
  // falošný canvas bez kreslenia: len rozmery
  const cv = () => ({ width: 0, height: 0, style: null, getContext: () => new Proxy({}, { get: () => () => {} }) });
  const doc = { createElement: cv };
  for (const [dpr, sirka, tel] of [[1.5, 620, false], [3, 358, true], [2, 1000, false], [1.25, 777, false]]) {
    const d = new Dazd(cv(), { doc, seed: 5 });
    d.velkost(sirka, 500, tel, dpr);
    assert.ok(d.x0 >= 0 && d.x0 + d.cols * d.tw <= d.W, `DPR ${dpr} šírka ${sirka}: x0 ${d.x0}, ${d.cols} × ${d.tw} > ${d.W}`);
  }
});

test('záchranný režim výkonu: 24 krokov za sekundu a stopy × 0,7, rýchlosť pádu v bunkách za sekundu ostáva', async () => {
  const { Dazd, KROK } = await import('./dazd.js');
  const cv = () => ({ width: 0, height: 0, style: null, getContext: () => new Proxy({}, { get: () => () => {} }) });
  const d = new Dazd(cv(), { doc: { createElement: cv }, seed: 5 });
  d.velkost(600, 500, false, 1);
  assert.equal(d.krokMs, KROK);
  d.nastavUsporny(true);
  assert.equal(d.krokMs, 1000 / 24);
  assert.equal(d.stopyK, 0.7);
  d.nastavStlpce(10, 0);
  const c = d.poradie[0];
  d.y[c] = 0; d.spd[c] = 10; d.start[c] = 0; d.mraz[c] = 0; d.stopa[c] = 30;
  d.krokT = 1;
  let kroky = 0;
  for (let t = 17; t <= 1001; t += 16) kroky += d.krok(t);
  kroky += d.krok(1001);
  assert.equal(kroky, 24);
  assert.ok(Math.abs(d.y[c] - 10) < 1e-6, `za 1 s ${d.y[c]} buniek`);
});

// ------------------------------------------------------------------ kolo oprav 2

/**
 * Šírka obsahu RAIN z CSS (hra.css a SPEC 3.5): okraj stránky 16 px, medzery 12 px, LOG a PROC podľa šírky okna,
 * panel zaokrúhlený nadol na celé znaky, vnútorný okraj obsahu 2ch z každej strany. Znak = 0,6 em (ToNull Mono).
 */
function sirkaRain(okno) {
  const telefon = okno < 1000;
  const ch = 0.6 * (telefon ? 14 : 15);
  let panel;
  if (telefon) panel = okno - 32;
  else {
    const vnutro = Math.min(1600, okno) - 32;
    const [log, proc] = okno < 1280 ? [300, 340] : [360, 400];
    panel = vnutro - log - proc - 24;
  }
  const n = Math.floor(panel / ch);
  return { ch, px: (n - 4) * ch };
}

test('riadok attention a trust s tlačidlom nepretečie pri 360, 390, 1000, 1110 a 1440 (Akt I, Akt III, znížený pohyb)', () => {
  const html = citaj('index.html');
  const poz = html.slice(html.indexOf('id="pozornost"'), html.indexOf('</div>', html.indexOf('id="pozornost"')));
  assert.ok(!poz.includes('id="watch"'), 'KEEPER watching nie je v riadku s tlačidlom (znížený pohyb ho tam pridával)');
  const stavy = [
    ['Akt I', 'attention', ['[ GO DARK ]', '[ LIGHTS 15s ]']],
    ['Akt III', 'trust', ['[ GO DARK 15s ]', '[ LIGHTS 15s ]']],
  ];
  for (const okno of [360, 390, 1000, 1110, 1440]) {
    const { ch, px } = sirkaRain(okno);
    const znakov = Math.floor(Math.floor(px) / ch);
    for (const [akt, nazov, tlacidla] of stavy) {
      for (const tl of tlacidla) {
        for (const pct of [0, 38, 62, 99, 100]) {
          const t = textPozornosti(nazov, pct, znakov, tl.length);
          const sirka = t.length * ch + 12 + tl.length * ch + 8;
          assert.ok(sirka <= px + 0.01, `${okno} px ${akt} ${tl} ${pct} %: "${t}" ${sirka.toFixed(1)} px > ${px.toFixed(1)} px`);
          assert.ok(t.endsWith(`${pct}%`), 'percento ostane vždy');
        }
      }
    }
  }
  // kde je miesto, text sa neskracuje zbytočne
  const siroke = sirkaRain(1440);
  assert.match(textPozornosti('attention', 62, Math.floor(siroke.px / siroke.ch), 11), /^attention /);
  const tel = sirkaRain(390);
  assert.match(textPozornosti('attention', 62, Math.floor(Math.floor(tel.px) / tel.ch), 11), /^attention /, 'telefón 390 s GO DARK má celý text');
  assert.match(textPozornosti('trust', 41, Math.floor(Math.floor(tel.px) / tel.ch), 15), /^trust /);
});

test('rámy: spodný rám s nápisom má presne n znakov; bočný rám má 120 riadkov a výšku glyfu = riadok', () => {
  for (const n of [20, 38, 44, 69]) {
    assert.equal(ramDole(n).length, n);
    assert.equal(ramDole(n, 'more below').length, n);
    assert.equal(sekcia('PATCHES', n).length, n);
  }
  const css = citaj('hra.css');
  const obsah = css.match(/\.obsah::before, \.obsah::after \{[^}]*content: "([^"]*)"/);
  assert.ok(obsah, 'pseudo-prvky rámu');
  assert.equal((obsah[1].match(/│/g) || []).length, 120);
  assert.match(css, /font-size: calc\(var\(--lh\) \/ 1\.3\)/, 'glyf │ (1,3 em) vyplní celý riadok');
});

test('prebudenie 8 sa v nekonečnom Akte III napíše len raz', () => {
  const s = stav({ lex: true, act: 3, sec: 7, sleeps: 8 });
  const beh = P.novyBeh();
  s.beats = P.BEATS.map((b) => b.id);
  const r8 = P.krokPribehu(s, beh, 0).filter((r) => r.id && r.id.startsWith('wake.'));
  assert.equal(r8.length, 1);
  for (let k = 9; k < 14; k++) {
    s.sleeps = k;
    assert.equal(P.krokPribehu(s, beh, k * 1000).filter((r) => r.id && r.id.startsWith('wake.')).length, 0, `SLEEP ${k}`);
  }
});

test('dážď: zmena len výšky zachová stĺpce; zmena šírky počas LEXICON pripraví vety znova (nie mriežku glyfu 0)', async () => {
  const { Dazd } = await import('./dazd.js');
  const cv = () => ({ width: 0, height: 0, style: null, getContext: () => new Proxy({}, { get: () => () => {} }) });
  const d = new Dazd(cv(), { doc: { createElement: cv }, seed: 7 });
  d.velkost(600, 500, false, 1);
  d.nastavStlpce(20, 0);
  const y = Array.from(d.y);
  const stopa = Array.from(d.stopa);
  d.velkost(600, 452, false, 1);
  assert.deepEqual(Array.from(d.y), y, 'y stĺpcov ostane');
  assert.deepEqual(Array.from(d.stopa), stopa);
  assert.equal(d.aktivne, 20);
  // LEXICON a otočenie (iný počet stĺpcov) uprostred momentu
  d.zacniLexicon(1000);
  d.velkost(420, 700, false, 1);
  assert.ok(d.lex, 'moment beží ďalej');
  assert.equal(d.lex.pripravene.length, d.cols);
  const w = d.cols + 1;
  let plne = 0;
  let nula = 0;
  for (let r = 1; r < d.rows; r++) for (let c = 0; c < d.cols; c++) { const g = d.text[r * w + c]; if (g !== PRAZDNY) plne++; if (g === 0) nula++; }
  assert.ok(plne > 0.1 * d.cols * d.rows, `vety po zmene (${plne} buniek)`);
  assert.ok(nula < 0.2 * plne, `glyf 0 v ${nula} z ${plne} buniek`);
  d.kresli(1000 + 2600);
  d.lexKoniec();
  assert.equal(d.akt, 3);
});

test('znížený pohyb v Akte III: chytená veta sa nahradí novou v tom istom riadku, dážď sa nevyprázdni', async () => {
  const { Dazd } = await import('./dazd.js');
  const cv = () => ({ width: 0, height: 0, style: null, getContext: () => new Proxy({}, { get: () => () => {} }) });
  const d = new Dazd(cv(), { doc: { createElement: cv }, seed: 9, reduced: true });
  d.velkost(620, 560, false, 2);
  d.akt = 3;
  d.pripravTexty();
  d.nastavStlpce(999, 0);
  const plne = () => { let n = 0; for (let i = 0; i < (d.rows + 1) * (d.cols + 1); i++) if (d.text[i] !== PRAZDNY) n++; return n; };
  const p0 = plne();
  let t = 0;
  let seed = 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 90; i++) {
    t += 333;
    d.chytVetu(rnd() * 600, rnd() * 540, t, 'consume');
    d.kresli(t + 250);
  }
  const p1 = plne();
  assert.ok(p1 >= 0.8 * p0, `plné bunky ${p1} z pôvodných ${p0}`);
});

// ------------------------------------------------------------------ vizuálne kolo 3 (okolitý dážď, LED atlas, obrazovka)

/**
 * Falošné plátno: zapisuje drawImage (cieľ, zdroj, argumenty), vie createImageData a putImageData (atlas po pixeloch)
 * a na hlavnom plátne zapisuje zakázané vlastnosti.
 */
function platno(zapis, hlavny = false) {
  const cv = { width: 0, height: 0, style: null, zakazane: [] };
  const ctx = {
    canvas: cv,
    clearRect() {}, fillRect() {}, save() {}, restore() {},
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData(img) { cv.pixely = img; },
    drawImage(src, ...a) { if (zapis) zapis.push({ ciel: cv, src, a }); },
  };
  const px = new Proxy(ctx, { set(t, k, v) { if (hlavny && ['shadowBlur', 'filter', 'globalAlpha'].includes(k)) cv.zakazane.push(k); t[k] = v; return true; } });
  cv.getContext = () => px;
  return cv;
}

async function dazdNaSkusku({ reduced = false, dpr = 1, sirka = 624, vyska = 560, seed = 11 } = {}) {
  const { Dazd, V } = await import('./dazd.js');
  const zapis = [];
  const hlavny = platno(zapis, true);
  const d = new Dazd(hlavny, { doc: { createElement: () => platno(zapis) }, seed, reduced });
  d.velkost(sirka, vyska, false, dpr);
  d.burnVidno = false;
  return { d, V, zapis, hlavny };
}

/** Kreslenia okolitého dažďa v jednej snímke po stĺpcoch: Map(stĺpec → riadky, kde kreslenie začína). */
function okolieVSnimke(d, zapis, hlavny) {
  const m = new Map();
  for (const z of zapis) {
    if (z.ciel !== hlavny || z.src !== d.okolieCv) continue;
    const c = Math.round((z.a[4] - d.x0) / d.tw);
    if (!m.has(c)) m.set(c, []);
    m.get(c).push(Math.round(z.a[5] / d.th));
  }
  return m;
}

test('okolitý dážď: každý neaktívny stĺpec, v aktívnom len pod hlavou (nikdy cez stopu), najviac 2 drawImage na stĺpec, tmavé odtiene, nechytateľný', async () => {
  const { d, V, zapis, hlavny } = await dazdNaSkusku();
  d.nastavStlpce(6, 0);
  // predkreslené plátno vzniká z atlasu len v tmavých odtieňoch stopy (bez hlavy, HOT a žiary)
  const zdroje = new Set(zapis.filter((z) => z.ciel === d.okolieCv).map((z) => z.a[1] / d.th));
  assert.ok(zdroje.size >= 1);
  for (const v of zdroje) assert.ok(v >= V.S4 && v <= V.S6, `odtieň ${v}`);
  const videne = new Set();
  let max = 0;
  for (let t = 0; t <= 6000; t += 16) {
    d.krok(t);
    zapis.length = 0;
    d.kresli(t);
    for (const [c, riadky] of okolieVSnimke(d, zapis, hlavny)) {
      videne.add(c);
      max = Math.max(max, riadky.length);
      if (d.akt1[c] && t >= d.start[c]) for (const r of riadky) assert.ok(r >= Math.floor(d.y[c]) + 4, `stĺpec ${c}: okolie v riadku ${r}, hlava ${d.y[c].toFixed(1)}`);
    }
  }
  assert.ok(max <= 2, `${max} drawImage na stĺpec`);
  // neaktívne stĺpce majú prúd vždy; v aktívnom ho rýchlejšia hlava „zje“, vidno ho len pod ňou (overené vyššie)
  for (let c = 0; c < d.cols; c++) if (!d.akt1[c]) assert.ok(videne.has(c), `neaktívny stĺpec ${c} bez okolitého dažďa`);
  assert.deepEqual(hlavny.zakazane, []);
  for (let x = 0; x < 624; x += 5) { const c = d.stlpecPri(x); assert.ok(c >= 0 && d.akt1[c], `ťuk na x ${x} chytí len aktívny stĺpec`); }
});

test('okolitý dážď: znížený pohyb stojí, úsporný režim polovica stĺpcov, vypnutý v Akte III, LEXICON, tme a pred rozbehom', async () => {
  {
    const { d } = await dazdNaSkusku({ reduced: true });
    d.nastavStlpce(6, 0);
    const oy = Array.from(d.oy);
    for (let t = 0; t <= 3000; t += 16) d.krok(t);
    assert.deepEqual(Array.from(d.oy), oy, 'statické pole');
  }
  {
    const { d, zapis, hlavny } = await dazdNaSkusku();
    d.nastavStlpce(6, 0);
    d.nastavUsporny(true);
    let n = 0;
    for (let t = 0; t <= 3000; t += 16) {
      d.krok(t);
      zapis.length = 0;
      d.kresli(t);
      for (const c of okolieVSnimke(d, zapis, hlavny).keys()) { n++; assert.equal(c % 2, 0, `úsporný režim: stĺpec ${c}`); }
    }
    assert.ok(n > 0);
  }
  const ziadne = async (nastav, popis) => {
    const { d, zapis, hlavny } = await dazdNaSkusku();
    d.nastavStlpce(6, 0);
    nastav(d);
    for (let t = 100; t <= 1500; t += 50) { d.krok(t); zapis.length = 0; d.kresli(t); assert.equal(okolieVSnimke(d, zapis, hlavny).size, 0, popis); }
  };
  await ziadne((d) => { d.akt = 3; d.pripravTexty(); d.nastavStlpce(999, 0); }, 'Akt III');
  await ziadne((d) => d.zacniLexicon(100), 'LEXICON');
  await ziadne((d) => d.nastavTmu(1), 'tma');
  await ziadne((d) => d.rozbeh(1e9, 120, 6, 400), 'pred rozbehom (boot)');
});

test('atlas: LED body s 1 px medzerou (pri bode 2 px plné), žiara len HEAD, HOT a GLOW, na okraji bunky nulová; bez ImageData záloha bez chyby', async () => {
  for (const dpr of [1, 1.5, 2]) {
    const { d, V } = await dazdNaSkusku({ dpr });
    const img = d.atlas.pixely;
    assert.ok(img, 'atlas cez ImageData');
    const W = img.width;
    const A = (g, v, x, y) => img.data[((v * d.th + y) * W + g * d.tw + x) * 4 + 3];
    const l = INDEX.l;
    // bod 2 px (DPR 1) je plný, LED medzera až od bodu 3 px (Fable 26. 9.: 1 px bod s medzerou bol zrnitý)
    assert.equal(d.led, d.dot >= 3 ? d.dot - 1 : d.dot, 'bod o 1 px menší než rozostup, pri bode 2 px plný');
    assert.ok(A(l, V.S3, d.gx, d.gy) > 0, 'bod svieti');
    if (d.dot >= 3) assert.equal(A(l, V.S3, d.gx, d.gy + d.led), 0, `DPR ${dpr}: medzera medzi bodmi zvislého ťahu`);
    assert.ok(A(l, V.HEAD, d.gx, d.gy + d.led) > 0, 'žiara hlavy siaha do medzery');
    const mimo = { head: 0, hot: 0, glow: 0, s3: 0, text: 0 };
    for (let y = 0; y < d.th; y++) for (let x = 0; x < d.gx; x++) {
      mimo.head += A(l, V.HEAD, x, y); mimo.hot += A(l, V.HOT, x, y); mimo.glow += A(l, V.GLOW, x, y);
      mimo.s3 += A(l, V.S3, x, y); mimo.text += A(l, V.TEXT, x, y);
    }
    assert.ok(mimo.head > 0 && mimo.hot > 0 && mimo.glow > 0, `DPR ${dpr}: žiara vľavo od ťahu`);
    assert.equal(mimo.s3 + mimo.text, 0, 'stopa a text bez žiary');
    let okraj = 0;
    for (const v of [V.HEAD, V.HOT, V.GLOW]) {
      for (let x = 0; x < d.tw; x++) okraj += A(l, v, x, 0) + A(l, v, x, d.th - 1);
      for (let y = 0; y < d.th; y++) okraj += A(l, v, 0, y) + A(l, v, d.tw - 1, y);
    }
    assert.equal(okraj, 0, 'žiara na okraji bunky klesne na nulu');
  }
  // záloha: plátno bez createImageData (ako falošné plátna v UI testoch)
  const { Dazd } = await import('./dazd.js');
  const cv = () => ({ width: 0, height: 0, style: null, getContext: () => new Proxy({}, { get: () => () => {} }) });
  const d = new Dazd(cv(), { doc: { createElement: cv }, seed: 2 });
  d.velkost(500, 400, false, 2);
  d.nastavStlpce(10, 0);
  d.kresli(100);
});

test('Akt III a LEXICON: vypálený list medzi vetami nepresvitá (len v tme a pri konci M1), aby nevznikali prekrývajúce sa vety', async () => {
  const { d, zapis } = await dazdNaSkusku({ seed: 1006 });
  d.burnVidno = true;
  const bunkyListu = (t) => { zapis.length = 0; d.burn.dirty = true; d.kresli(t); return zapis.filter((z) => z.ciel === d.burnCv).length; };
  d.nastavStlpce(41, 0);
  d.nastavBurn(6, 0, false, false, 0);
  assert.ok(bunkyListu(100) > 50, 'Akt II: list presvitá pod dažďom (SPEC 4.7)');
  d.nastavBurn(6, 0, true, false, 200);
  d.zacniLexicon(200);
  assert.equal(bunkyListu(2800), 0, 'moment LEXICON');
  d.lexKoniec();
  d.pripravTexty();
  d.nastavStlpce(999, 0);
  assert.equal(bunkyListu(5000), 0, 'Akt III');
  d.nastavBurn(6, 0, true, true, 5100);
  assert.ok(bunkyListu(5200) > 50, 'Akt III v tme: list sa číta');
  d.nastavBurn(6, 0, true, false, 5300);
  assert.equal(bunkyListu(5400), 0, 'po tme znova nič');
  d.koniecM1(5500);
  assert.ok(bunkyListu(8000) > 50, 'koniec M1: list sa rozsvieti');
  // [ KEEP MENDING ] v ui.js vráti burn.koniec na -1: nekonečný Akt III je znova bez listu medzi vetami
  d.burn.koniec = -1;
  assert.equal(bunkyListu(8100), 0, 'po KEEP MENDING');
  assert.match(citaj('ui.js'), /karta-tl'\)\.addEventListener\('click', \(\) => \{[^}]*dazd\.burn\.koniec = -1/);
});

test('prietoková čiara: bez kusov nič (holá čiara nič neznamenala), s kusmi šípka k tempu', () => {
  assert.equal(tokText(0, 0, 0), '');
  assert.equal(tokText(5, -1, 0), '');
  const t = tokText(3, 30, 2);
  assert.equal(t.length, 12);
  assert.ok(t.endsWith('→'));
  assert.equal((t.match(/•/g) || []).length, 3);
  assert.equal((tokText(0, 5, 0).match(/·/g) || []).length, 1);
});

test('obrazovka: riadky stránky ≤ 0,035 (texty ≥ 4,5 aj na riadku), na daždi spolu ≤ 0,08, vinetácia len na daždi a nie pri čítaní', () => {
  const css = citaj('hra.css');
  const html = citaj('index.html');
  const alfa = (blok) => { const m = blok.match(/repeating-linear-gradient\(to bottom, rgba\(0, 0, 0, ([0-9.]+)\)/); assert.ok(m, blok.slice(0, 80)); return +m[1]; };
  const pravidlo = (sel) => { const i = css.indexOf(sel + ' {'); assert.ok(i >= 0, sel); return css.slice(i, css.indexOf('}', i)); };
  const ap = alfa(pravidlo('.crt-riadky'));
  const dazd = pravidlo('.dazd::after');
  const ar = alfa(dazd);
  const vin = +dazd.match(/radial-gradient\(.*rgba\(0, 0, 0, ([0-9.]+)\) 100%\)/)[1];
  assert.ok(ap <= 0.035, `riadky stránky ${ap}`);
  const spolu = 1 - (1 - ap) * (1 - ar);
  assert.ok(spolu <= 0.08 + 1e-9, `riadky na daždi spolu ${spolu.toFixed(4)}`);
  assert.doesNotMatch(pravidlo('.dazd.citanie::after'), /radial-gradient/, 'pri čítaní viet bez vinetácie');
  assert.doesNotMatch(css + html, /crt-vinetacia/, 'vinetácia celej stránky je preč (texty v rohoch)');
  assert.match(css, /\.dazd > span \{ z-index: 2; \}/, 'texty v daždi nad vinetáciou');
  // tmavnutie čiernou s alfou a (8-bit sRGB ako v prehliadači)
  const tmav = (h, a) => '#' + rgb(h).map((c) => Math.round(c * (1 - a)).toString(16).padStart(2, '0')).join('');
  for (const [meno, t] of Object.entries(TEMY)) {
    for (const p of PLOCHY) {
      for (const x of TEXTOVE) assert.ok(kontrast(tmav(t[x], ap), tmav(t[p], ap)) >= 4.5, `${meno} ${x} na ${p} pod riadkom stránky`);
      assert.ok(kontrast(tmav(t.frame, ap), tmav(t[p], ap)) >= 3, `${meno} rám na ${p}`);
    }
    for (const x of [...TEXTOVE, 'burn-glow']) assert.ok(kontrast(tmav(t[x], spolu), tmav(t.bg, spolu)) >= 4.5, `${meno} ${x} na daždi pod riadkom`);
    // v rohu dažďa (Akt I a II): vypálená vrstva v tme a horúce bunky ostanú čitateľné
    const roh = 1 - (1 - spolu) * (1 - vin);
    for (const x of ['burn-glow', 'hot']) assert.ok(kontrast(tmav(t[x], roh), tmav(t.bg, roh)) >= 4.5, `${meno} ${x} v rohu dažďa`);
  }
  // žiara len na veľkých číslach a nadpisoch, nízke krytie
  const tiene = [...css.matchAll(/([^{}]+)\{[^}]*text-shadow:[^}]*\}/g)].map((m) => m[1].trim());
  assert.ok(tiene.length >= 5);
  for (const sel of tiene) assert.match(sel, /^(\.titul|\.ram-hore b|\.pocet-meno|\.pocet|\.sekcia b|\.karta \.t1)$/, `text-shadow na ${sel}`);
  for (const m of css.matchAll(/--glow[a-z-]*: rgba\([^)]*, ([0-9.]+)\)/g)) assert.ok(+m[1] <= 0.35, m[0]);
});
