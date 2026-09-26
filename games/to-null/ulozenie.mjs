// TO: NULL: uloženie, migrácie, export a import (SPEC 6). Čisté funkcie; úložisko sa podáva zvonka.
// Každé čítanie a zápis je v try/catch: bez úložiska hra beží ďalej, len neukladá.

import { VERZIA, novyStav, ZAPLATY, PROCESY } from './ekonomika.mjs';

export const KLUC = 'tonull.save';
export const KLUC_ZLE = 'tonull.save.bad';
export const PREDPONA = 'TONULL1.';

/** Migrácie: MIGRACIE[v](stav) vráti stav verzie v + 1. */
export const MIGRACIE = {
  0: (o) => {
    // v0 (prvý prototyp): glyphs, lifetime, recall, hooks; bez beats a stats.
    const s = novyStav(o.seed || 1, o.t0 || 0);
    s.g = o.glyphs || 0;
    s.run = o.run || o.glyphs || 0;
    s.tot = o.lifetime || 0;
    s.R = o.recall || 0;
    s.n.hook = o.hooks || 0;
    s.sec = o.sectors || 0;
    s.lastSeen = o.lastSeen || 0;
    s.v = 1;
    return s;
  },
};

const CISLA = ['g', 'run', 'tot', 'R', 'sleeps', 'lines', 'cells', 'att', 'darkMs', 'floodMs', 'mended', 'mendPool', 'mendMs', 'keys', 'dec', 'sec', 'stacks', 'rng', 'seed', 'lastSeen', 't0', 'act'];
const MAXIMA = { att: 100, dec: 5, sec: 7, stacks: 5, keys: 3, lines: 7, act: 3, darkMs: 15000, floodMs: 30000 };

const ok = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;

/** Hlasy, ktoré log pozná (terminal.js RYCHLOST a 'none'). */
const HLASY = ['gc', 'keeper', 'letter', 'sys', 'you', 'card', 'mended', 'pre', 'none'];

/** Položka logu: {id: reťazec} alebo {h: známy hlas, t: reťazec} alebo {h: 'pre', seed: číslo}. */
function zaznamLogu(z) {
  if (!z || typeof z !== 'object' || Array.isArray(z)) return false;
  if ('id' in z) return typeof z.id === 'string' && z.id.length > 0 && z.id.length <= 40;
  if (!HLASY.includes(z.h)) return false;
  if (z.h === 'pre' && z.t === undefined) return ok(z.seed);
  return typeof z.t === 'string' && z.t.length <= 400;
}

/** Overí stav; vráti zoznam chýb (prázdny = platný). */
export function over(s) {
  const e = [];
  if (!s || typeof s !== 'object') return ['nie je objekt'];
  for (const k of CISLA) {
    if (!ok(s[k])) e.push(`${k} neplatné`);
    else if (k in MAXIMA && s[k] > MAXIMA[k]) e.push(`${k} nad maximum`);
  }
  if (!s.n || typeof s.n !== 'object') e.push('n chýba');
  else for (const g of PROCESY) if (!ok(s.n[g]) || !Number.isInteger(s.n[g])) e.push(`n.${g} neplatné`);
  if (!Array.isArray(s.up) || s.up.some((u) => !ZAPLATY.some((z) => z.id === u))) e.push('up neznáme ID');
  if (!Array.isArray(s.themes) || s.themes.some((t) => !['green', 'amber', 'rose'].includes(t))) e.push('themes neznáme');
  if (!['green', 'amber', 'rose'].includes(s.theme)) e.push('theme neznáma');
  if (!['consume', 'mend'].includes(s.mode)) e.push('mode neznámy');
  if (!Array.isArray(s.beats) || s.beats.some((b) => typeof b !== 'string')) e.push('beats');
  // kolo oprav 2: položky logu sa pri štarte obnovujú; zlá položka by hodila výnimku pred napojením MENU
  if (!Array.isArray(s.log) || s.log.some((z) => !zaznamLogu(z))) e.push('log');
  if (!s.stats || typeof s.stats !== 'object') e.push('stats');
  else for (const [k, v] of Object.entries(s.stats)) if (!ok(v)) e.push(`stats.${k} neplatné`);
  if (!s.dk || typeof s.dk !== 'object' || !ok(s.dk.base) || !ok(s.dk.drained) || !ok(s.dk.ms)) e.push('dk');
  if (!s.snd || typeof s.snd !== 'object' || typeof s.snd.on !== 'boolean' || typeof s.snd.hum !== 'boolean') e.push('snd');
  if (s.cmp !== null && s.cmp !== undefined && (!ok(s.cmp.m0) || !ok(s.cmp.c) || !ok(s.cmp.m))) e.push('cmp');
  // slovo v daždi a príznaky (kolo oprav 1: import s word.ms = null dal NaN a slová sa už neobjavili)
  if (s.word !== null && s.word !== undefined) {
    const w = s.word;
    if (typeof w !== 'object' || !Number.isInteger(w.id) || w.id < 0 || !ok(w.x) || w.x > 1 || !Number.isInteger(w.len) || w.len < 1 || w.len > 12 || typeof w.ms !== 'number' || !Number.isFinite(w.ms)) e.push('word');
  }
  if (!Number.isInteger(s.wid) || s.wid < 0) e.push('wid');
  if (typeof s.w5 !== 'number' || !Number.isFinite(s.w5) || s.w5 < -1) e.push('w5');
  if (!Number.isInteger(s.floodRun) || s.floodRun < -1) e.push('floodRun');
  for (const k of ['wordTut', 'ended', 'lex']) if (typeof s[k] !== 'boolean') e.push(k);
  if (s.pending !== null && s.pending !== undefined) {
    const p = s.pending;
    if (typeof p !== 'object' || !ok(p.dt) || !ok(p.zisk) || !ok(p.listy)) e.push('pending');
  }
  return e;
}

/** Doplní chýbajúce polia z nového stavu (nové polia v rámci tej istej verzie). */
function dopln(s) {
  const z = novyStav(s.seed || 1, s.t0 || 0);
  for (const [k, v] of Object.entries(z)) if (!(k in s)) s[k] = v;
  for (const [k, v] of Object.entries(z.stats)) if (!(k in s.stats)) s.stats[k] = v;
  if (!s.snd || typeof s.snd !== 'object') s.snd = { on: true, hum: true };
  return s;
}

/**
 * Z textu uloženia urobí stav. Vracia { stav } alebo { chyba: 'zle'|'novsia', text }.
 */
export function rozbal(text) {
  let o;
  try { o = JSON.parse(text); } catch { return { chyba: 'zle' }; }
  if (!o || typeof o !== 'object' || !Number.isInteger(o.v)) return { chyba: 'zle' };
  if (o.v > VERZIA) return { chyba: 'novsia' };
  let s = o;
  try {
    while (s.v < VERZIA) {
      const m = MIGRACIE[s.v];
      if (!m) return { chyba: 'zle' };
      s = m(s);
    }
  } catch { return { chyba: 'zle' }; }
  if (!s.stats || typeof s.stats !== 'object') return { chyba: 'zle' };
  dopln(s);
  const e = over(s);
  if (e.length) return { chyba: 'zle', e };
  return { stav: s };
}

export function zbal(s) {
  const kopia = { ...s, v: VERZIA };
  kopia.log = (s.log || []).slice(-60);
  return JSON.stringify(kopia);
}

/**
 * Načíta z úložiska. Vracia { stav|null, sprava|null, zapis: bool (smie sa zapisovať), uloziste: bool }.
 */
export function nacitaj(ls) {
  let text = null;
  try { text = ls ? ls.getItem(KLUC) : null; } catch { return { stav: null, sprava: 'saving is off in this browser', zapis: false, uloziste: false }; }
  if (!ls) return { stav: null, sprava: 'saving is off in this browser', zapis: false, uloziste: false };
  if (text === null) return { stav: null, sprava: null, zapis: true, uloziste: true };
  const r = rozbal(text);
  if (r.stav) return { stav: r.stav, sprava: null, zapis: true, uloziste: true };
  if (r.chyba === 'novsia') return { stav: null, sprava: 'this save is from a newer version. it was not touched. export it from the menu.', zapis: false, uloziste: true, novsia: text };
  try { ls.setItem(KLUC_ZLE, text); } catch { /* nič */ }
  return { stav: null, sprava: 'the old save did not parse. it is kept aside. starting fresh.', zapis: true, uloziste: true };
}

export function uloz(ls, s) {
  try { ls.setItem(KLUC, zbal(s)); return true; } catch { return false; }
}

// ------------------------------------------------------------------ export a import

export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function b64url(str) {
  const bajty = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bajty) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function odB64url(s) {
  const b = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b);
  const bajty = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bajty[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: true }).decode(bajty);
}

export function exportuj(s) {
  const telo = b64url(zbal(s));
  return PREDPONA + telo + '.' + fnv1a(telo);
}

/** Import: overí predponu, súčet, JSON, verziu a hodnoty. Vracia { stav } alebo { chyba }. */
export function importuj(kod) {
  const zla = { chyba: "that code doesn't parse. nothing changed." };
  const k = String(kod || '').trim();
  if (!k.startsWith(PREDPONA)) return zla;
  const zvysok = k.slice(PREDPONA.length);
  const bod = zvysok.lastIndexOf('.');
  if (bod < 1) return zla;
  const telo = zvysok.slice(0, bod);
  const sucet = zvysok.slice(bod + 1);
  if (!/^[0-9a-f]{8}$/.test(sucet) || fnv1a(telo) !== sucet) return zla;
  let json;
  try { json = odB64url(telo); } catch { return zla; }
  const r = rozbal(json);
  if (!r.stav) return r.chyba === 'novsia' ? { chyba: 'that code is from a newer version. nothing changed.' } : zla;
  return { stav: r.stav };
}
