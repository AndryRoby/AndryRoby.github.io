/* Swans (Masyu) pre knihu: mriežka políčok, biele a čierne labute, slučka cez
   stredy políčok. Slučka sa kreslí pod labute, takže čierna labuť ostane
   čierna a biela ostane prázdna aj tam, kadiaľ slučka prechádza. */
import { S, CIARA, SVETLA, obal, ciara, kruh, mriezka } from './spolocne.mjs';

const P = 16;

const stred = (r, c) => [P + c * S + S / 2, P + r * S + S / 2];

function labute(p, r) {
  const n = p.n, out = [];
  for (let i = 0; i < n * n; i++) {
    const k = p.pearls[i];
    if (!k) continue;
    const [x, y] = stred((i / n) | 0, i % n);
    if (k === 2) out.push(kruh(x, y, r, '#000'));
    else out.push(kruh(x, y, r, '#fff', '#000', 9));
  }
  return out.join('');
}

function slucka(p) {
  const n = p.n, e = p.solution, out = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n - 1; c++) {
      if (e.h[r * (n - 1) + c] === 1) {
        const a = stred(r, c), b = stred(r, c + 1);
        out.push(ciara(a[0], a[1], b[0], b[1], CIARA, '#000', 'round'));
      }
    }
  }
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n; c++) {
      if (e.v[r * n + c] === 1) {
        const a = stred(r, c), b = stred(r + 1, c);
        out.push(ciara(a[0], a[1], b[0], b[1], CIARA, '#000', 'round'));
      }
    }
  }
  return out.join('');
}

export function zadanie(p) {
  const w = p.n * S + 2 * P;
  return obal(w, w, mriezka(P, P, p.n) + labute(p, 34));
}

export function riesenie(p) {
  const w = p.n * S + 2 * P;
  const siet = mriezka(P, P, p.n, null, { tenkaFarba: SVETLA });
  return obal(w, w, siet + slucka(p) + labute(p, 30));
}

export const popisMriezky = (p) => p.n + ' x ' + p.n;
