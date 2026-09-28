/* Whistle Stop M0: uloženie (GDD 5.3). Dva sloty ws:a a ws:b striedavo, každý { v, t, s, h }, h = FNV-1a z JSON
   stavu. Pri načítaní vyhrá novší platný slot, poškodený sa ignoruje. Zablokované úložisko nezhodí hru.
   Úložisko sa podáva zvonka (v teste falošné), všetky prístupy sú v try/catch. */
import { VERZIA, zdravyStav } from './stav.mjs';

export const KLUCE = ['ws:a', 'ws:b'];

export function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

// Čo z uloženého stavu treba (bez pomocných polí ako tuky a bežiaci cyklus).
export function naUlozenie(s) {
  return { peniaze: s.peniaze, n: s.n, man: s.man, nab: s.nab.slice(), zarobok: s.zarobok, prvy: s.prvy, t: s.t, vedier: s.vedier };
}

export function vytvorUlozisko(ls) {
  let dalsi = 0, funguje = true;
  try { const k = '__ws_test'; ls.setItem(k, '1'); ls.removeItem(k); } catch { funguje = false; }
  return {
    funguje: () => funguje,
    uloz(s, teraz) {
      if (!funguje) return false;
      const data = naUlozenie(s);
      const json = JSON.stringify(data);
      const zaznam = JSON.stringify({ v: VERZIA, t: teraz, s: data, h: fnv1a(json) });
      try { ls.setItem(KLUCE[dalsi], zaznam); dalsi = 1 - dalsi; return true; } catch { funguje = false; return false; }
    },
    nacitaj(teraz) {
      let naj = null;
      for (let i = 0; i < KLUCE.length; i++) {
        let z;
        try { z = JSON.parse(ls.getItem(KLUCE[i]) || 'null'); } catch { z = null; }
        if (!z || typeof z !== 'object' || !z.s || fnv1a(JSON.stringify(z.s)) !== z.h) continue;
        const zm = migruj(z);
        if (!zm) continue;
        if (!naj || zm.t > naj.t) { naj = zm; dalsi = 1 - i; }
      }
      return naj ? zdravyStav(naj.s, teraz) : null;
    }
  };
}

// Migrácia podľa verzie (GDD 5.3). Zatiaľ len v1; neznáma novšia verzia sa nenačíta, aby ju staršia hra nezničila.
export function migruj(z) {
  if (z.v === 1) return z;
  return null;
}

// Falošné úložisko pre testy (a pre súkromné okno bez localStorage).
export function pametoveUlozisko({ zablokovane = false } = {}) {
  const m = new Map();
  return {
    getItem: (k) => { if (zablokovane) throw new Error('blocked'); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { if (zablokovane) throw new Error('blocked'); m.set(k, String(v)); },
    removeItem: (k) => { if (zablokovane) throw new Error('blocked'); m.delete(k); },
    _m: m
  };
}
