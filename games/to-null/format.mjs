// TO: NULL: formát čísel a trvania (SPEC 8, test 23). Pravidlo 16: K/M/B/T do 10^15, potom vedecký zápis.

const PRIPONY = ['', 'K', 'M', 'B', 'T'];

function over(x) {
  if (typeof x !== 'number' || Number.isNaN(x)) throw new Error('format: NaN');
  if (!Number.isFinite(x)) throw new Error('format: nekonečno');
}

function ciarky(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Číslo pre hráča: do 100 jedno desatinné miesto (ak treba), do 10 000 celé s čiarkami, potom 3 platné číslice. */
export function cislo(x) {
  over(x);
  if (x < 0) return '-' + cislo(-x);
  if (x < 100) {
    const r = Math.round(x * 10) / 10;
    if (r >= 100) return '100';
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }
  if (x < 10000) return ciarky(Math.floor(x));
  if (x >= 1e15) return vedecky(x);
  let e = Math.floor(Math.log10(x) / 3);
  for (let pokus = 0; pokus < 2; pokus++) {
    if (e >= PRIPONY.length) return vedecky(x);
    const m = x / 10 ** (3 * e);
    const des = m < 10 ? 2 : m < 100 ? 1 : 0;
    const s = m.toFixed(des);
    if (parseFloat(s) >= 1000) { e++; continue; }
    return s + PRIPONY[e];
  }
  return vedecky(x);
}

/** Celé množstvo (počítadlo GLYPHS): pod 10 000 bez desatín. */
export function cele(x) {
  over(x);
  if (x < 10000) return ciarky(Math.floor(Math.max(0, x)));
  return cislo(x);
}

export function vedecky(x) {
  over(x);
  let e = Math.floor(Math.log10(x));
  let m = x / 10 ** e;
  if (Number(m.toFixed(2)) >= 10) { e++; m = x / 10 ** e; }
  return m.toFixed(2) + 'e' + e;
}

/** Trvanie v sekundách: 22 320 → "6h 12m", 125 → "2m 5s", 40 → "40s". */
export function trvanie(sek) {
  over(sek);
  const s = Math.max(0, Math.floor(sek));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** Časová značka hry m:ss (simulácia a debug). */
export function mss(sek) {
  const s = Math.max(0, Math.round(sek));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Číslo s čiarkou tisícov bez skracovania (11,204; 14,625). */
export function tisice(n) {
  over(n);
  return ciarky(Math.floor(n));
}
