/* Ukladanie do localStorage. Kazde citanie aj zapis je v try/catch: v sukromnom okne
   alebo so zakazanymi datami hra bezi z pamate a v pauze to povie. */
const KLUC = 'arling-mc-m0';
let pamat = null, ide = true;

function citaj() {
  if (pamat) return pamat;
  try { pamat = JSON.parse(localStorage.getItem(KLUC) || 'null'); } catch { ide = false; pamat = null; }
  if (!pamat || typeof pamat !== 'object' || pamat.v !== 1) pamat = { v: 1, nastavenia: (pamat && pamat.nastavenia) || {}, kapitoly: {} };
  return pamat;
}
function zapis() {
  try { localStorage.setItem(KLUC, JSON.stringify(pamat)); ide = true; } catch { ide = false; }
}
export const ulozenie = {
  funguje() { citaj(); try { localStorage.setItem(KLUC + '-t', '1'); localStorage.removeItem(KLUC + '-t'); return ide; } catch { return false; } },
  nastavenia() { return citaj().nastavenia || {}; },
  ulozNastavenia(n) { citaj().nastavenia = n; zapis(); },
  kapitola(n) { return citaj().kapitoly[n] || null; },
  ulozKapitolu(n, u) { citaj().kapitoly[n] = u; zapis(); },
  zmazKapitolu(n) { delete citaj().kapitoly[n]; zapis(); },
};
