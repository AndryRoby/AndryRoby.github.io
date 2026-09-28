/* Whistle Stop: paleta ôsmich atramentov púšte (GDD 4.1) a jej nočná podoba. Noc je výmena farieb
   vo vyrovnávacích plátnach, nie poloprehľadná vrstva cez scénu (GDD 4.4, 5.4). */

export const DEN = {
  papier: '#F3E6CC', piesok: '#E2B878', skala: '#B4472E', hlina: '#6B2E22', salvia: '#7F8F5E',
  nebo: '#8DB4C8', noc: '#1F2640', atrament: '#2A1D16', lampa: '#F4B63F', drevo: '#8F5E3A'
};

// Noc: tie isté tokeny, stmavené v tóne noci (zmes s #1F2640), okná a lampy svietia plnou lampou.
export const NOC = {
  papier: '#8C8A92', piesok: '#6F6A6E', skala: '#5C3440', hlina: '#3A2530', salvia: '#43504F',
  nebo: '#1F2640', noc: '#1F2640', atrament: '#15121A', lampa: '#F4B63F', drevo: '#4C3A3F'
};

export function paleta(noc) { return noc ? NOC : DEN; }

// Relatívna svietivosť a kontrast podľa WCAG 2.x (test kontrastu ako MapTest v Prism 5).
function kanal(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
export function svietivost(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * kanal((n >> 16) & 255) + 0.7152 * kanal((n >> 8) & 255) + 0.0722 * kanal(n & 255);
}
export function kontrast(a, b) {
  const x = svietivost(a), y = svietivost(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
