/* Herons (Numberlink) pre knihu: mriežka, hniezda ako čísla v krúžku, cesty
   v riešení ako hrubé čiary medzi stredmi políčok. Cesta sa dá zrekonštruovať
   priamo z riešenia: pravidlá zakazujú, aby sa cesta sama seba dotkla bokom,
   takže dve susedné políčka s tým istým číslom sú vždy za sebou idúce kroky
   tej istej cesty. */
import { S, CIARA, SVETLA, obal, ciara, kruh, mriezka, text } from './spolocne.mjs';

const P = 16;

const stred = (r, c) => [P + c * S + S / 2, P + r * S + S / 2];

function hniezda(p, r) {
  const n = p.n, out = [];
  for (let i = 0; i < n * n; i++) {
    const k = p.ends[i];
    if (!k) continue;
    const [x, y] = stred((i / n) | 0, i % n);
    out.push(kruh(x, y, r, '#fff', '#000', 8));
    out.push(text(x, y, k, k >= 10 ? 42 : 50, { tucne: true }));
  }
  return out.join('');
}

function cesty(p) {
  const n = p.n, s = p.solution, out = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      if (!s[i]) continue;
      if (c + 1 < n && s[i + 1] === s[i]) {
        const a = stred(r, c), b = stred(r, c + 1);
        out.push(ciara(a[0], a[1], b[0], b[1], CIARA, '#000', 'round'));
      }
      if (r + 1 < n && s[i + n] === s[i]) {
        const a = stred(r, c), b = stred(r + 1, c);
        out.push(ciara(a[0], a[1], b[0], b[1], CIARA, '#000', 'round'));
      }
    }
  }
  return out.join('');
}

export function zadanie(p) {
  const w = p.n * S + 2 * P;
  return obal(w, w, mriezka(P, P, p.n) + hniezda(p, 36));
}

export function riesenie(p) {
  const w = p.n * S + 2 * P;
  const siet = mriezka(P, P, p.n, null, { tenkaFarba: SVETLA });
  return obal(w, w, siet + cesty(p) + hniezda(p, 32));
}

export const popisMriezky = (p) => p.n + ' x ' + p.n;
