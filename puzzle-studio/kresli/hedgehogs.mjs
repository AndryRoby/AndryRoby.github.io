/* Hedgehogs (Star Battle, dve hviezdy) pre knihu: mriežka s hrubými hranicami
   záhonov, v riešení hviezdy. Hviezda je nakreslená cesta, nie znak z písma,
   takže vyzerá rovnako na každom stroji aj v PDF. */
import { S, obal, mriezka, hviezda } from './spolocne.mjs';

const P = 16;

/* regions je pole n riadkov s číslom záhona pre každé políčko. Hrubá je tá
   vnútorná čiara, ktorá delí dva rôzne záhony. */
function hranice(p) {
  const g = p.regions;
  return (r, c, smer) => (smer === 'h' ? g[r - 1][c] !== g[r][c] : g[r][c - 1] !== g[r][c]);
}

export function zadanie(p) {
  const w = p.n * S + 2 * P;
  return obal(w, w, mriezka(P, P, p.n, hranice(p)));
}

export function riesenie(p) {
  const n = p.n, w = n * S + 2 * P, out = [mriezka(P, P, n, hranice(p))];
  for (let i = 0; i < n * n; i++) {
    if (!p.solution[i]) continue;
    const r = (i / n) | 0, c = i % n;
    out.push(hviezda(P + c * S + S / 2, P + r * S + S / 2, 34));
  }
  return obal(w, w, out.join(''));
}

export const popisMriezky = (p) => p.n + ' x ' + p.n;
