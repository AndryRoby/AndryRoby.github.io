/* Hares (Anti-knight Sudoku) pre knihu: obyčajná mriežka čísel s hrubými
   hranicami blokov. Zadané čísla sú tučné, dopísané v riešení tenké, takže
   na strane s riešeniami je vidieť, čo hráč skutočne doplnil. */
import { S, obal, mriezka, text } from './spolocne.mjs';

const P = 16;

function blok(n) {
  const bh = n === 6 ? 2 : 3, bw = 3;
  return (r, c, smer) => (smer === 'h' ? r % bh === 0 : c % bw === 0);
}

function cisla(p, vsetky) {
  const n = p.n, out = [];
  for (let i = 0; i < n * n; i++) {
    const dane = p.givens[i];
    const v = vsetky ? p.solution[i] : dane;
    if (!v) continue;
    const r = (i / n) | 0, c = i % n;
    out.push(text(P + c * S + S / 2, P + r * S + S / 2, v, 56, { tucne: !!dane }));
  }
  return out.join('');
}

export function zadanie(p) {
  const w = p.n * S + 2 * P;
  return obal(w, w, mriezka(P, P, p.n, blok(p.n)) + cisla(p, false));
}

export function riesenie(p) {
  const w = p.n * S + 2 * P;
  return obal(w, w, mriezka(P, P, p.n, blok(p.n)) + cisla(p, true));
}

export const popisMriezky = (p) => p.n + ' x ' + p.n;
