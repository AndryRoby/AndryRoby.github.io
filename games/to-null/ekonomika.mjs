// TO: NULL: ekonomika M1 ako čisté funkcie (SPEC 1.2 až 1.11). Konštanty z ops/hry/matrix-incremental/sim-referencia.mjs.
// Čas sa vždy dodáva zvonka v ms (rozdiel Date.now()), nikdy sa nepočítajú tiky (pravidlo 13).
// Funkcie, ktoré menia stav, zapisujú udalosti do poľa ev (UI z nich robí pohyb a zvuk).

export const VERZIA = 1;
export const UPTIME0 = 14622;
export const KROK_MS = 250;
export const OFFLINE_OD_MS = 60000;
export const OFFLINE_STROP_MS = 8 * 3600 * 1000;

export const K = {
  gens: {
    hook: { base: 15, g: 1.12, p: 0.5 },
    sieve: { base: 150, g: 1.13, p: 4 },
    thread: { base: 2500, g: 1.14, p: 32 },
    bank: { base: 40000, g: 1.15, p: 300 },
    loom: { base: 2.5e6, g: 1.15, p: 3000 },
  },
  sectors: [30, 200, 800, 2500, 6000, 12000, 22000],
  stacks: [40e3, 250e3, 3e6, 20e6, 120e6],
  lexicon: 500e6,
  decoder: { base: 150e3, g: 12, mult: 1.5, max: 5 },
  recallDiv: 1000, recallEff: 0.15,
  burnEff: 0.10, burnMax: 7,
  lexMult: 2,
  milestones: [25, 50, 100, 200],
  tapBase: 1, gripFrac: 0.05, tapMaxS: 10,
  att: { perTap: 0.2, decay: 0.4, breach: 10, word: 3, darkMs: 15000, darkDrain: 6, floodMs: 30000, floodMult: 0.25, after: 60 },
  word: { chance: 0.03, mult: 10, ms: 1600, tutMs: 25000 },
  mend: { share: 0.4, cost0: 1e8, cg: 1.01, eff: 0.003, keys: [100, 400, 1000] },
  offline: { rate: 0.5 },
};

export const PROCESY = ['hook', 'sieve', 'thread', 'bank', 'loom'];
export const MENO_PROCESU = { hook: 'HOOK', sieve: 'SIEVE', thread: 'THREAD', bank: 'DECODER BANK', loom: 'LOOM' };

/** Záplaty v poradí tabuľky 1.6 (toto je aj nákupné poradie modelov hráča). */
export const ZAPLATY = [
  { id: 'steady', meno: 'STEADY HAND', cena: 60, popis: 'each tap +1', vidno: (s) => s.n.hook >= 1 && s.sec >= 1 },
  { id: 'barbed', meno: 'BARBED HOOKS', cena: 400, popis: 'hooks ×2', vidno: (s) => s.n.hook >= 10 },
  { id: 'grip', meno: 'GRIP', cena: 2500, popis: 'taps pull 5% of pace', vidno: (s) => s.sec >= 4 },
  { id: 'mesh', meno: 'FINE MESH', cena: 3000, popis: 'sieves ×2', vidno: (s) => s.n.sieve >= 10 },
  { id: 'deep', meno: 'DEEP HOOKS', cena: 25000, popis: 'hooks ×2', vidno: (s) => s.n.hook >= 50 },
  { id: 'taut', meno: 'TAUT THREAD', cena: 60000, popis: 'threads ×2', vidno: (s) => s.n.thread >= 10 },
  { id: 'warm', meno: 'WARM BANKS', cena: 1.2e6, popis: 'banks ×2', vidno: (s) => s.n.bank >= 10 },
  { id: 'weave', meno: 'WEAVE', cena: 60e6, popis: 'looms ×2', vidno: (s) => s.n.loom >= 10 },
];
const ZAPLATA_PROCESU = { barbed: 'hook', deep: 'hook', mesh: 'sieve', taut: 'thread', warm: 'bank', weave: 'loom' };

export const SEKTORY = [
  { meno: 'SECTOR 01', obraz: 'kettle' }, { meno: 'SECTOR 02', obraz: 'lamp' }, { meno: 'SECTOR 03', obraz: 'crane' },
  { meno: 'SECTOR 04', obraz: 'bike' }, { meno: 'SECTOR 05', obraz: 'window' }, { meno: 'SECTOR 06', obraz: 'bench' },
  { meno: 'SECTOR 07', obraz: 'door' },
];
export const HROMADY = [
  { meno: 'STACK A', stav: 'UNCLAIMED' }, { meno: 'STACK B', stav: 'RETURN TO SENDER' }, { meno: 'STACK C', stav: 'POSTAGE DUE' },
  { meno: 'STACK D', stav: 'ADDRESS UNKNOWN' }, { meno: 'STACK E', stav: 'HELD FOR PICKUP' },
];

/** Vypálený list msg_0000 (SPEC 2.6). Riadok 8 je M2. */
export const LIST = [
  'to whoever keeps this place running after tonight.',
  'they switch us off at six. the new network takes over.',
  'the keeper will be scared. be kind to it.',
  'gc will do what it was told. it always does.',
  'there are 11,204 letters in here nobody came back for.',
  "meridian won't take old headers. so i'm leaving them with you.",
  "if you can, carry them home. if you can't, keep them warm.",
];
export const BUNKY_RIADKU = LIST.map((t) => t.replace(/ /g, '').length);

// ------------------------------------------------------------------ stav

export function novyStav(seed = 1, teraz = 0) {
  return {
    v: VERZIA, seed: seed >>> 0, rng: (seed >>> 0) || 1, t0: teraz, lastSeen: teraz, act: 1,
    g: 0, run: 0, tot: 0,
    n: { hook: 0, sieve: 0, thread: 0, bank: 0, loom: 0 },
    up: [], sec: 0, stacks: 0, dec: 0, lex: false, R: 0, sleeps: 0, lines: 0, cells: 0,
    att: 0, darkMs: 0, floodMs: 0, dk: { base: 0, drained: 0, ms: 0 },
    mode: 'consume', mended: 0, mendPool: 0, mendMs: 0, cmp: null,
    keys: 0, themes: ['green'], theme: 'green', snd: { on: true, hum: true },
    word: null, wordTut: false, w5: -1, wid: 0,
    beats: [], log: [],
    stats: { taps: 0, words: 0, darks: 0, floods: 0, playMs: 0, mends: 0, consumes: 0, reads: 0 },
    floodRun: -1, ended: false,
    pending: null,
  };
}

/** Deterministický generátor (mulberry32) nad stavom; stav rng sa ukladá. */
export function nahoda(s) {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ------------------------------------------------------------------ ceny a produkcia

export const cena = (g, n) => K.gens[g].base * K.gens[g].g ** n;

/** Hromadná cena k kusov od n: base · r^n · (r^k − 1) / (r − 1). */
export function cenaHrom(g, n, k) {
  const { base, g: r } = K.gens[g];
  return base * r ** n * (r ** k - 1) / (r - 1);
}

/** Najväčšie k, ktoré hráč zaplatí (MAX); 0 ak ani jeden kus. */
export function maxKusov(g, n, glyphs) {
  const { base, g: r } = K.gens[g];
  const c0 = base * r ** n;
  if (!(glyphs >= c0)) return 0;
  let k = Math.floor(Math.log(glyphs * (r - 1) / c0 + 1) / Math.log(r));
  while (k > 0 && cenaHrom(g, n, k) > glyphs) k--;
  while (cenaHrom(g, n, k + 1) <= glyphs) k++;
  return k;
}

export const maZaplatu = (s, id) => s.up.includes(id);
export const milniky = (n) => K.milestones.reduce((a, m) => a + (n >= m ? 1 : 0), 0);

export function nasobProcesu(s, g) {
  let m = 2 ** milniky(s.n[g]);
  for (const [z, pg] of Object.entries(ZAPLATA_PROCESU)) if (pg === g && maZaplatu(s, z)) m *= 2;
  return m;
}

export function globalny(s) {
  return (1 + K.recallEff * s.R) * (1 + K.burnEff * s.lines) * K.decoder.mult ** s.dec
    * (s.lex ? K.lexMult : 1) * (1 + K.mend.eff * s.mended);
}

/** Tempo jedného procesu (gl/s) bez f. */
export const tempoProcesu = (s, g) => s.n[g] * K.gens[g].p * nasobProcesu(s, g) * globalny(s);

/** Tempo všetkých procesov bez f (plné). */
export function tempoPlne(s) {
  let p = 0;
  for (const g of PROCESY) p += s.n[g] * K.gens[g].p * nasobProcesu(s, g);
  return p * globalny(s);
}

export const faktor = (s) => (s.darkMs > 0 ? 0 : s.floodMs > 0 ? K.att.floodMult : 1);
/** Tempo P = Σ · G · f (SPEC 1.3). */
export const tempo = (s) => tempoPlne(s) * faktor(s);

/** Ťuk: (1 + STEADY) · G · f + (GRIP ? 0,05 · P : 0). */
export function hodnotaTuku(s) {
  const f = faktor(s);
  return (K.tapBase + (maZaplatu(s, 'steady') ? 1 : 0)) * globalny(s) * f + (maZaplatu(s, 'grip') ? K.gripFrac * tempo(s) : 0);
}

export const stlpce = (s) => (s.lex ? 999 : 6 + 4 * s.sec + 2 * s.stacks);
export const utlm = (s) => s.act < 3 && s.sec >= 2;
export const uptime = (s) => UPTIME0 + s.sleeps;

// ------------------------------------------------------------------ zarábanie a MEND

function zarob(s, x) {
  if (!(x > 0)) return;
  s.g += x; s.run += x; s.tot += x;
}

export const cenaListu = (m) => K.mend.cost0 * K.mend.cg ** m;

function pridajOpravy(s, x, ev) {
  if (!(x > 0)) return;
  s.mendPool += x;
  for (let i = 0; i < 100000; i++) {
    const c = cenaListu(s.mended);
    if (s.mendPool < c) break;
    s.mendPool -= c;
    s.mended++;
    ev.push({ t: 'mended', n: s.mended });
    const ki = K.mend.keys.indexOf(s.mended);
    if (ki >= 0 && s.keys < ki + 1) {
      s.keys = ki + 1;
      if (ki === 0 && !s.themes.includes('amber')) s.themes.push('amber');
      if (ki === 1 && !s.themes.includes('rose')) s.themes.push('rose');
      ev.push({ t: 'key', k: s.keys });
    }
  }
}

/** Prijatie zisku s ohľadom na režim MEND (odklon 40 %). Vracia, koľko šlo do LETTERS/GLYPHS. */
function prijmi(s, x, ev) {
  if (!(x > 0)) return 0;
  if (s.lex && s.mode === 'mend') {
    const div = x * K.mend.share;
    pridajOpravy(s, div, ev);
    zarob(s, x - div);
    return x - div;
  }
  zarob(s, x);
  return x;
}

// ------------------------------------------------------------------ krok logiky

/** Jeden krok logiky najviac 250 ms. */
export function krok(s, ms, ev = []) {
  if (!(ms > 0)) return ev;
  ms = Math.min(ms, KROK_MS);
  const dt = ms / 1000;
  const P = tempo(s);
  if (s.lex && s.mode === 'mend') {
    s.mendMs += ms;
    if (s.cmp) {
      s.cmp.m += P * (1 - K.mend.share) * dt;
      s.cmp.c += (P / (1 + K.mend.eff * s.mended)) * (1 + K.mend.eff * s.cmp.m0) * dt;
    }
  }
  prijmi(s, P * dt, ev);

  // FLOOD sa kontroluje pred poklesom, aby ťuk, ktorý dorazí na 100, naozaj zaplavil
  const zaplava = s.floodMs === 0 && s.darkMs === 0 && utlm(s) && s.att >= 100;
  // pozornosť (len Akt I a II, od S02)
  if (utlm(s)) s.att = Math.max(0, s.att - K.att.decay * dt);
  else s.att = 0;

  if (s.darkMs > 0) {
    const drain = Math.min(s.att, K.att.darkDrain * dt);
    s.att -= drain;
    s.dk.drained += drain;
    s.dk.ms += ms;
    odhalBunky(s, ev);
    s.darkMs = Math.max(0, s.darkMs - ms);
    if (s.darkMs === 0) ev.push({ t: 'darkEnd' });
  }
  if (s.floodMs > 0) {
    s.floodMs = Math.max(0, s.floodMs - ms);
    if (s.floodMs === 0) { s.att = Math.min(s.att, K.att.after); ev.push({ t: 'floodEnd' }); }
    else s.att = Math.min(s.att, 100);
  } else if (zaplava || (utlm(s) && s.att >= 100)) {
    s.floodMs = K.att.floodMs;
    s.att = 100;
    s.stats.floods++;
    s.word = null;
    ev.push({ t: 'flood' });
  }

  // slovo v daždi (od S05, 3 %/s, deterministicky)
  if (s.word) {
    s.word.ms -= ms;
    if (s.word.ms <= 0) { s.word = null; ev.push({ t: 'wordGone' }); }
  }
  if (s.act < 3 && s.sec >= 5 && !s.word && s.darkMs === 0) {
    if (s.w5 < 0) s.w5 = s.stats.playMs;
    const tut = !s.wordTut && s.stats.playMs - s.w5 >= K.word.tutMs;
    if (tut || (s.wordTut && nahoda(s) < K.word.chance * dt)) {
      s.wordTut = true;
      s.wid++;
      s.word = { id: s.wid, x: nahoda(s), len: 3 + Math.floor(nahoda(s) * 6), ms: K.word.ms };
      ev.push({ t: 'word', id: s.wid });
    }
  }
  s.stats.playMs += ms;
  return ev;
}

/** Postup o ms: do 60 s po krokoch 250 ms. Nad 60 s vracia false (ide cez offline()). */
export function postup(s, ms, ev = []) {
  if (!(ms > 0)) return true;
  if (ms > OFFLINE_OD_MS) return false;
  let zvysok = ms;
  while (zvysok > 0) {
    const k = Math.min(KROK_MS, zvysok);
    krok(s, k, ev);
    zvysok -= k;
  }
  return true;
}

// ------------------------------------------------------------------ činy hráča

export function tuk(s, ev = []) {
  if (s.darkMs > 0) return 0;
  const v = hodnotaTuku(s);
  prijmi(s, v, ev);
  s.stats.taps++;
  if (utlm(s)) s.att = Math.min(100, s.att + K.att.perTap);
  return v;
}

export function chytSlovo(s, ev = []) {
  if (!s.word || s.darkMs > 0) return 0;
  const v = K.word.mult * tempo(s);
  prijmi(s, v, ev);
  s.stats.words++;
  s.word = null;
  if (utlm(s)) s.att = Math.min(100, s.att + K.att.word);
  return v;
}

export const vidnoProces = (s, g) => ({
  hook: s.tot >= 10 || s.n.hook > 0 || s.sleeps > 0,
  sieve: s.sec >= 1,
  thread: s.sleeps >= 1,
  bank: s.stacks >= 1,
  loom: s.lex,
})[g];

export function kupProces(s, g, kolko = 1, ev = []) {
  if (!vidnoProces(s, g)) return null;
  const k = kolko === 'max' ? maxKusov(g, s.n[g], s.g) : kolko;
  if (!(k >= 1)) return null;
  const c = cenaHrom(g, s.n[g], k);
  if (!(s.g >= c)) return null;
  const pred = milniky(s.n[g]);
  s.g -= c;
  s.n[g] += k;
  const r = { g, k, c, prvy: s.n[g] === k, milnik: milniky(s.n[g]) > pred ? s.n[g] : 0 };
  ev.push({ t: 'buy', ...r });
  return r;
}

export function vidnoZaplatu(s, id) {
  const z = ZAPLATY.find((x) => x.id === id);
  return !!z && !maZaplatu(s, id) && z.vidno(s);
}

export function kupZaplatu(s, id, ev = []) {
  const z = ZAPLATY.find((x) => x.id === id);
  if (!z || !vidnoZaplatu(s, id) || !(s.g >= z.cena)) return null;
  s.g -= z.cena;
  s.up.push(id);
  ev.push({ t: 'patch', id });
  return z;
}

/** Najbližšia brána: sektor, hromada alebo LEXICON (null, keď nič). */
export function dalsiaBrana(s) {
  if (s.sec < 7) {
    const cena0 = K.sectors[s.sec];
    return { typ: 'sector', i: s.sec, meno: SEKTORY[s.sec].meno, cena: cena0, vidno: s.tot >= cena0 / 2 };
  }
  if (s.sleeps < 1) return null;
  if (s.stacks < 5) {
    const h = HROMADY[s.stacks];
    return { typ: 'stack', i: s.stacks, meno: `${h.meno} · ${h.stav}`, cena: K.stacks[s.stacks], vidno: true };
  }
  if (!s.lex) return { typ: 'lexicon', i: 0, meno: 'LEXICON', cena: K.lexicon, vidno: true };
  return null;
}

/** Sektor alebo hromada (LEXICON ide len cez kupLexicon po dialógu). */
export function kupBranu(s, ev = []) {
  const b = dalsiaBrana(s);
  if (!b || b.typ === 'lexicon' || !b.vidno || !(s.g >= b.cena)) return null;
  s.g -= b.cena;
  if (b.typ === 'sector') s.sec++;
  else s.stacks++;
  if (s.sec >= 2 && s.act < 3) s.att = Math.min(100, s.att + K.att.breach);
  if (s.sec === 5 && b.typ === 'sector') s.w5 = s.stats.playMs;
  ev.push({ t: 'gate', ...b });
  return b;
}

export const cenaDekodera = (u) => K.decoder.base * K.decoder.g ** u;
export const vidnoDekoder = (s) => s.stacks >= 1 && s.dec < K.decoder.max;

export function kupDekoder(s, ev = []) {
  if (!vidnoDekoder(s)) return null;
  const c = cenaDekodera(s.dec);
  if (!(s.g >= c)) return null;
  s.g -= c;
  s.dec++;
  ev.push({ t: 'decoder', u: s.dec });
  return s.dec;
}

export function kupLexicon(s, ev = []) {
  const b = dalsiaBrana(s);
  if (!b || b.typ !== 'lexicon' || !(s.g >= b.cena)) return false;
  s.g -= b.cena;
  s.lex = true;
  s.act = 3;
  s.att = 0;
  s.floodMs = 0;
  s.word = null;
  ev.push({ t: 'lexicon' });
  return true;
}

export function prepniRezim(s, mode, ev = []) {
  if (!s.lex || (mode !== 'mend' && mode !== 'consume') || s.mode === mode) return false;
  s.mode = mode;
  if (mode === 'mend') {
    s.stats.mends++;
    if (!s.cmp) s.cmp = { m0: s.mended, c: 0, m: 0 };
  } else s.stats.consumes++;
  ev.push({ t: 'mode', mode });
  return true;
}

/** Čísla voľby CONSUME a MEND (SPEC 1.10): všetko vždy vidieť. */
export function volbaCisla(s) {
  const P = tempoPlne(s);
  const c = cenaListu(s.mended);
  const div = P * K.mend.share;
  return { consume: P, mend: P - div, sekNaList: div > 0 ? c / div : Infinity, bonus: K.mend.eff };
}

// ------------------------------------------------------------------ GO DARK a vypálená vrstva

export const mozeTmu = (s) => s.darkMs === 0 && (s.sec >= 2 || s.act === 3);

function odhalBunky(s, ev) {
  if (s.lines >= K.burnMax) return;
  const max = BUNKY_RIADKU[s.lines];
  const ciel = s.act === 3
    ? Math.min(30, Math.ceil((30 * s.dk.ms) / K.att.darkMs))
    : Math.floor(s.dk.drained / 10) + 2;
  const nove = Math.min(max, s.dk.base + ciel);
  if (nove > s.cells) {
    const pred = s.cells;
    s.cells = nove;
    ev.push({ t: 'cells', od: pred, po: nove });
  }
}

export function goDark(s, ev = []) {
  if (!mozeTmu(s)) return false;
  s.darkMs = K.att.darkMs;
  s.dk = { base: s.cells, drained: 0, ms: 0 };
  s.stats.darks++;
  s.word = null;
  odhalBunky(s, ev);
  ev.push({ t: 'dark' });
  return true;
}

/** [ LIGHTS ]: tma skončí skôr, odhalené bunky ostávajú. */
export function lights(s, ev = []) {
  if (s.darkMs === 0) return false;
  s.darkMs = 0;
  ev.push({ t: 'darkEnd', early: true });
  return true;
}

// ------------------------------------------------------------------ SLEEP

export const poziadavkaSpanku = (k) => (k === 0 ? 0 : 1e6 * 25 ** (k - 1));
export const recallZisk = (s) => Math.max(0, Math.floor(Math.cbrt(s.tot / K.recallDiv)) - s.R);
export const vidnoSpanok = (s) => s.sec >= 7;
export const mozeSpat = (s) => vidnoSpanok(s) && s.run >= poziadavkaSpanku(s.sleeps) && recallZisk(s) >= 1;
/** Dokončí SLEEP ďalší riadok listu? Riadky 5 až 7 len s LEXICON. */
export const spanokDokonciRiadok = (s) => s.lines < K.burnMax && (s.lines < 4 || s.lex);

/** Čísla pred potvrdením SLEEP (SPEC 1.9). */
export function spanokNahlad(s) {
  const zisk = recallZisk(s);
  const riadok = spanokDokonciRiadok(s);
  const g0 = globalny(s);
  const s2 = { ...s, R: s.R + zisk, lines: s.lines + (riadok ? 1 : 0) };
  return { zisk, riadok, nasob: globalny(s2) / g0, poziadavka: poziadavkaSpanku(s.sleeps), mozno: mozeSpat(s) };
}

export function spi(s, ev = []) {
  if (!mozeSpat(s)) return null;
  const zisk = recallZisk(s);
  const riadok = spanokDokonciRiadok(s);
  s.R += zisk;
  s.sleeps++;
  if (riadok) { s.lines++; s.cells = 0; }
  s.g = 0; s.run = 0;
  for (const g of PROCESY) s.n[g] = 0;
  s.n.hook = 1;
  s.up = [];
  s.att = 0; s.darkMs = 0; s.floodMs = 0; s.word = null;
  if (s.act === 1) s.act = 2;
  const r = { zisk, riadok, k: s.sleeps, uptime: uptime(s) };
  ev.push({ t: 'sleep', ...r });
  return r;
}

// ------------------------------------------------------------------ offline (SPEC 1.11)

/** Dobehne neprítomnosť: pozornosť len klesá, tma a FLOOD skončia. Vracia zisk na výber (ešte nepripísaný). */
export function offline(s, dtMs, ev = []) {
  const dt = Math.max(0, Math.min(Number.isFinite(dtMs) ? dtMs : 0, OFFLINE_STROP_MS));
  const zisk = K.offline.rate * tempoPlne(s) * (dt / 1000);
  if (s.darkMs > 0) {
    const zostava = Math.min(s.darkMs, dt);
    const drain = Math.min(s.att, K.att.darkDrain * (zostava / 1000));
    s.att -= drain;
    s.dk.drained += drain;
    s.dk.ms += zostava;
    odhalBunky(s, ev);
    s.darkMs = 0;
  }
  if (s.floodMs > 0) { s.floodMs = 0; s.att = Math.min(s.att, K.att.after); }
  if (utlm(s)) s.att = Math.max(0, s.att - K.att.decay * (dt / 1000));
  else s.att = 0;
  s.word = null;
  return { dt, zisk, listy: listyZa(s, zisk), strop: dtMs > OFFLINE_STROP_MS };
}

/** Koľko listov by opravil celý zisk (pre tlačidlo MEND IT ALL). */
function listyZa(s, zisk) {
  if (!s.lex) return 0;
  let pool = s.mendPool + zisk;
  let m = s.mended;
  for (let i = 0; i < 100000 && pool >= cenaListu(m); i++) { pool -= cenaListu(m); m++; }
  return m - s.mended;
}

/**
 * Zlúči dva offline zisky (druhá neprítomnosť prišla, kým bola obrazovka návratu otvorená, napr. karta v pozadí).
 * Strop 8 h platí na súčet: z druhého zisku sa započíta len čas, ktorý ešte ostal pod stropom.
 */
export function zlucOffline(s, a, b) {
  if (!a) return b;
  if (!b) return a;
  const ostava = Math.max(0, OFFLINE_STROP_MS - a.dt);
  const dtB = Math.min(b.dt, ostava);
  const ziskB = b.dt > 0 ? b.zisk * (dtB / b.dt) : 0;
  const zisk = a.zisk + ziskB;
  return { dt: a.dt + dtB, zisk, listy: listyZa(s, zisk), strop: !!(a.strop || b.strop || b.dt > ostava) };
}

/** Voľba na obrazovke návratu: 'take' (Akt I, II; v Akte III AS LETTERS) alebo 'mend' (MEND IT ALL). */
export function prijmiOffline(s, o, volba, ev = []) {
  if (!o || !(o.zisk > 0)) return 0;
  if (volba === 'mend' && s.lex) { pridajOpravy(s, o.zisk, ev); return 0; }
  zarob(s, o.zisk);
  return o.zisk;
}

// ------------------------------------------------------------------ nákupná politika modelov (SPEC 1.12)

/** Sektor, hromada, LEXICON, záplaty v poradí 1.6, DECODER, potom proces s najkratšou návratnosťou. */
export function nakupujPodlaPolitiky(s, ev = []) {
  for (let i = 0; i < 10000; i++) {
    if (kupBranu(s, ev)) continue;
    const b = dalsiaBrana(s);
    if (b && b.typ === 'lexicon' && s.g >= b.cena) { kupLexicon(s, ev); continue; }
    let kupil = false;
    for (const z of ZAPLATY) if (kupZaplatu(s, z.id, ev)) { kupil = true; break; }
    if (kupil) continue;
    if (kupDekoder(s, ev)) continue;
    let best = null;
    let bv = Infinity;
    for (const g of PROCESY) {
      if (!vidnoProces(s, g)) continue;
      const v = cena(g, s.n[g]) / (K.gens[g].p * nasobProcesu(s, g));
      if (v < bv) { bv = v; best = g; }
    }
    if (best && kupProces(s, best, 1, ev)) continue;
    break;
  }
}
