// TO: NULL: simulácia tempa nad skutočnou ekonomikou hry (SPEC 1.12, testy 8 až 10).
// Spustenie: node products/arling-sk/games/to-null/simulacia.mjs
// Modely hráča presne podľa SPEC 1.12. Slová v daždi idú cez skutočný deterministický generátor hry
// (aktívny chytí 4 z 5, teda 80 %), nie cez očakávanú hodnotu.

import * as E from './ekonomika.mjs';
import { mss } from './format.mjs';

export const AKTIVNY = { meno: 'active', tapRate: 3, firstTap: 4, check: 1, goDark: 88, words: true };
export const POKOJNY = { meno: 'calm', tapRate: 0.4, firstTap: 6, check: 60, goDark: 88, words: false };
/** Kolo oprav 1: rýchly hráč s 8 ťukmi za sekundu (pod stropom K.tapMaxS = 10) a autoklikač 30/s (strop ho zreže na 10). */
export const RYCHLY = { meno: 'fast', tapRate: 8, firstTap: 3, check: 1, goDark: 88, words: true };
export const AUTOKLIK = { meno: 'autoclick', tapRate: 30, firstTap: 3, check: 1, goDark: 88, words: true };

/** Tabuľka udalostí SPEC 1.12 v sekundách (aktívny, pokojný). */
export const TABULKA = {
  'first hook': [9, 60], S01: [38, 120], 'up:steady': [48, 180], 'first sieve': [65, 360], S02: [90, 300],
  'up:barbed': [164, 600], S03: [244, 480], S04: [414, 720], 'up:grip': [443, 900], 'first dark': [415, null],
  S05: [528, 840], S06: [570, 960], S07: [654, 1140], SLEEP1: [655, 1200], 'first thread': [765, 1560],
  'STACK A': [945, 1740], SLEEP2: [1065, 2100], decoder1: [1335, 1920], 'STACK B': [1366, 2040],
  SLEEP3: [1583, 2880], 'STACK C': [1708, 2760], 'STACK D': [1850, 3300], SLEEP4: [1994, 3660],
  'STACK E': [2115, 3540], LEXICON: [2324, 4080], SLEEP5: [2426, 4320], decoder5: [2464, 4200],
  'mended 100': [2494, 4523], SLEEP6: [2631, 4800], 'mended 400': [2730, 5048], SLEEP7: [3231, 5880],
  'mended 800': [3838, 6689], SLEEP8: [4873, 8520], 'mended 1000': [5408, 8940],
};

/**
 * Prehrá model hráča. opt.pribeh: modul pribeh.mjs (ak je daný, počíta aj príbehové udalosti pre test medzier).
 * Vracia { s, ev: [[t, meno]], darks, floods, novinky: [t...] }.
 */
export function hraj(model, T = 7200, opt = {}) {
  const s = E.novyStav(opt.seed || 7, 0);
  const out = [];
  const prve = new Set();
  const zapis = (t, m) => { if (!prve.has(m)) { prve.add(m); out.push([t, m]); } };
  const novinky = [];
  const dt = 100;
  let dalsiaKontrola = 0;
  let tukAcc = 0;
  let slova = 0;
  let poslSlovo = 0;
  const beh = opt.pribeh ? opt.pribeh.novyBeh() : null;
  for (let i = 0; i * dt < T * 1000; i++) {
    const tms = i * dt;
    const t = tms / 1000;
    const ev = [];
    E.krok(s, dt, ev);
    if (t >= model.firstTap && s.darkMs === 0) {
      // strop ťukov so ziskom ako v UI (ui.js chytanie): najviac K.tapMaxS za sekundu
      tukAcc += Math.min(model.tapRate, E.K.tapMaxS) * (dt / 1000);
      while (tukAcc >= 1) { tukAcc -= 1; E.tuk(s, ev); }
    }
    // automatizácia: pasívny príjem procesov prvýkrát prevýši príjem z ťukov
    if (!prve.has('auto>tap') && s.n.hook > 0 && E.tempo(s) >= Math.min(model.tapRate, E.K.tapMaxS) * E.hodnotaTuku(s)) zapis(t, 'auto>tap');
    if (s.word && s.word.id !== poslSlovo) {
      poslSlovo = s.word.id;
      slova++;
      if (model.words && slova % 5 !== 0) E.chytSlovo(s, ev);
    }
    if (t >= dalsiaKontrola - 1e-9) {
      dalsiaKontrola += model.check;
      if (s.act < 3 && s.sec >= 2 && s.att >= model.goDark && s.darkMs === 0) E.goDark(s, ev);
      if (E.mozeSpat(s)) E.spi(s, ev);
      E.nakupujPodlaPolitiky(s, ev);
      if (s.lex && s.mode !== 'mend' && model.mend !== false) E.prepniRezim(s, 'mend', ev);
    }
    for (const e of ev) {
      let m = null;
      if (e.t === 'buy' && e.prvy) m = 'first ' + e.g;
      else if (e.t === 'buy' && e.milnik) m = e.g + ' x' + e.milnik;
      else if (e.t === 'gate' && e.typ === 'sector') m = 'S0' + (e.i + 1);
      else if (e.t === 'gate' && e.typ === 'stack') m = 'STACK ' + 'ABCDE'[e.i];
      else if (e.t === 'patch') m = 'up:' + e.id;
      else if (e.t === 'decoder') m = 'decoder' + e.u;
      else if (e.t === 'lexicon') m = 'LEXICON';
      else if (e.t === 'sleep') m = 'SLEEP' + e.k;
      else if (e.t === 'dark') m = 'first dark';
      else if (e.t === 'flood') m = 'FLOOD';
      else if (e.t === 'mended' && [1, 100, 250, 400, 600, 800, 1000].includes(e.n)) m = 'mended ' + e.n;
      if (m) {
        const nove = !prve.has(m);
        zapis(t, m);
        if (nove && !/^(hook|sieve|thread|bank|loom) x/.test(m)) novinky.push(t);
        else if (nove) novinky.push(t);
      }
    }
    if (s.run >= 1000) zapis(t, 'run1000:' + s.sleeps);
    // nové riadky v rozhraní (brána, záplata, proces, DECODER, SLEEP) sú tiež nová vec
    const vid = [];
    const b = E.dalsiaBrana(s);
    if (b && b.vidno) vid.push('vis:' + b.meno);
    for (const z of E.ZAPLATY) if (E.vidnoZaplatu(s, z.id)) vid.push('vis:' + z.id);
    for (const g of E.PROCESY) if (E.vidnoProces(s, g)) vid.push('vis:' + g);
    if (E.vidnoDekoder(s)) vid.push('vis:decoder');
    if (E.vidnoSpanok(s)) vid.push('vis:sleep');
    for (const m of vid) if (!prve.has(m)) { zapis(t, m); novinky.push(t); }
    if (beh) {
      const riadky = opt.pribeh.krokPribehu(s, beh, tms);
      for (const r of riadky) { novinky.push(t); zapis(t, 'beat ' + r.id); }
    }
  }
  return { s, ev: out, darks: s.stats.darks, floods: s.stats.floods, novinky: [...new Set(novinky)].sort((a, b) => a - b) };
}

/** Najdlhšia medzera bez novej veci v intervale [0, do] sekúnd. */
export function najdlhsiaMedzera(novinky, od, doS) {
  let posl = od;
  let max = 0;
  let kde = [od, od];
  for (const t of novinky) {
    if (t < od) continue;
    if (t > doS) break;
    if (t - posl > max) { max = t - posl; kde = [posl, t]; }
    posl = t;
  }
  if (doS - posl > max) { max = doS - posl; kde = [posl, doS]; }
  return { max, kde };
}

export function tabulka(akt, pok) {
  const riadky = [];
  const ta = new Map(akt.ev.map(([t, m]) => [m, t]));
  const tp = new Map(pok.ev.map(([t, m]) => [m, t]));
  for (const [m, [ra, rp]] of Object.entries(TABULKA)) {
    const a = ta.get(m);
    const p = tp.get(m);
    riadky.push({ m, ra, a, rp, p });
  }
  return riadky;
}

const hlavny = typeof process !== 'undefined' && (process.argv[1] || '').replace(/\\/g, '/').endsWith('to-null/simulacia.mjs');
if (hlavny) {
  const pribeh = await import('./pribeh.mjs').catch(() => null);
  const akt = hraj(AKTIVNY, 10000, { pribeh });
  const pok = hraj(POKOJNY, 10000, { pribeh });
  const f = (x) => (x === undefined || x === null ? '-' : mss(x));
  const pct = (a, r) => (a === undefined || r === null ? '' : `${a >= r ? '+' : ''}${Math.round(((a - r) / r) * 100)}%`);
  console.log('udalosť          ref.akt  sim.akt   odch.  ref.pok  sim.pok   odch.');
  for (const r of tabulka(akt, pok)) {
    console.log(r.m.padEnd(15), f(r.ra).padStart(8), f(r.a).padStart(8), pct(r.a, r.ra).padStart(7), f(r.rp).padStart(8), f(r.p).padStart(8), pct(r.p, r.rp).padStart(7));
  }
  console.log(`aktívny: GO DARK ${akt.darks}×, FLOOD ${akt.floods}×; pokojný: GO DARK ${pok.darks}×, FLOOD ${pok.floods}×`);
  const m = najdlhsiaMedzera(akt.novinky, 0, 660);
  console.log(`najdlhšia medzera v prvých 11 min (aktívny): ${m.max.toFixed(1)} s (${mss(m.kde[0])} až ${mss(m.kde[1])})`);
  const ta = new Map(akt.ev.map(([t, x]) => [x, t]));
  console.log(`aktívny: HOOK riadok ${f(ta.get('vis:hook'))}, prvý HOOK ${f(ta.get('first hook'))}, procesy prevýšia ťuky ${f(ta.get('auto>tap'))}`);
  for (const mod of [RYCHLY, AUTOKLIK]) {
    const r = hraj(mod, 10000);
    const tr = new Map(r.ev.map(([t, x]) => [x, t]));
    console.log(`${mod.meno} (${mod.tapRate} ťukov/s, strop ${E.K.tapMaxS}): S07 ${f(tr.get('S07'))}, LEXICON ${f(tr.get('LEXICON'))}, mended 1000 ${f(tr.get('mended 1000'))}, GO DARK ${r.darks}×, FLOOD ${r.floods}×`);
  }
}
