/* Voles (Nurikabe) pre knihu: mriežka s číslami, v riešení je voda vyplnená
   sivou a ostrovy ostanú biele s číslom. Voda sa nekreslí načierno, ale strednou
   sivou: rozdiel medzi vodou a ostrovom je aj tak jednoznačný, ale sedemnásť
   strán s riešeniami nezožerie toner tomu, kto si PDF vytlačí doma. */
import { S, STREDNA, obal, obdlznik, mriezka, text } from './spolocne.mjs';

const P = 16;

function cisla(p) {
  const n = p.n, out = [];
  for (let i = 0; i < n * n; i++) {
    const k = p.clues[i];
    if (k == null) continue;
    const r = (i / n) | 0, c = i % n;
    out.push(text(P + c * S + S / 2, P + r * S + S / 2, k, k >= 10 ? 46 : 54,
      { tucne: true, farba: '#000' }));
  }
  return out.join('');
}

export function zadanie(p) {
  const w = p.n * S + 2 * P;
  return obal(w, w, mriezka(P, P, p.n) + cisla(p));
}

export function riesenie(p) {
  const n = p.n, w = n * S + 2 * P, out = [];
  for (let i = 0; i < n * n; i++) {
    if (p.solution[i] !== 1) continue;
    const r = (i / n) | 0, c = i % n;
    out.push(obdlznik(P + c * S, P + r * S, S, S, STREDNA));
  }
  return obal(w, w, out.join('') + mriezka(P, P, n) + cisla(p));
}

export const popisMriezky = (p) => p.n + ' x ' + p.n;
