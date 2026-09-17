/* Magpies (Nonogram) pre knihu: čísla nad stĺpcami a naľavo od riadkov, potom
   prázdna mriežka. Každá piata čiara je hrubá, inak sa na pätnástke stráca
   počítanie políčok. Riešenie je ten istý obrázok s vyplnenými políčkami. */
import { S, TENKA, HRUBA, obal, ciara, obdlznik, text } from './spolocne.mjs';

const P = 16;
const CS = 64; // šírka jedného políčka na číslo v okraji

function rozmery(p) {
  let mr = 1, mc = 1;
  for (const b of p.clues.rows) mr = Math.max(mr, b.length || 1);
  for (const b of p.clues.cols) mc = Math.max(mc, b.length || 1);
  const gl = mr * CS + 14, gt = mc * CS + 14;
  return { mr, mc, gl, gt, x0: P + gl, y0: P + gt, w: P * 2 + gl + p.n * S, h: P * 2 + gt + p.n * S };
}

function indicie(p, d) {
  const n = p.n, out = [];
  for (let r = 0; r < n; r++) {
    const b = p.clues.rows[r].length ? p.clues.rows[r] : [0];
    for (let k = 0; k < b.length; k++) {
      const x = d.x0 - (b.length - k) * CS + CS / 2;
      out.push(text(x, d.y0 + r * S + S / 2, b[k], 46));
    }
  }
  for (let c = 0; c < n; c++) {
    const b = p.clues.cols[c].length ? p.clues.cols[c] : [0];
    for (let k = 0; k < b.length; k++) {
      const y = d.y0 - (b.length - k) * CS + CS / 2;
      out.push(text(d.x0 + c * S + S / 2, y, b[k], 46));
    }
  }
  return out.join('');
}

function siet(p, d) {
  const n = p.n, out = [];
  for (let r = 1; r < n; r++) {
    const y = d.y0 + r * S;
    out.push(ciara(d.x0, y, d.x0 + n * S, y, r % 5 === 0 ? HRUBA : TENKA));
  }
  for (let c = 1; c < n; c++) {
    const x = d.x0 + c * S;
    out.push(ciara(x, d.y0, x, d.y0 + n * S, c % 5 === 0 ? HRUBA : TENKA));
  }
  out.push(obdlznik(d.x0, d.y0, n * S, n * S, 'none', '#000', HRUBA));
  return out.join('');
}

export function zadanie(p) {
  const d = rozmery(p);
  return obal(d.w, d.h, indicie(p, d) + siet(p, d));
}

/* Riešenie je len obrázok, bez čísel po okrajoch: čísla už nikto nepotrebuje
   a bez nich sa na šestinu strany zmestí obrázok o tretinu väčší. */
export function riesenie(p) {
  const n = p.n, w = n * S + 2 * P, d = { x0: P, y0: P }, out = [];
  for (let i = 0; i < n * n; i++) {
    if (!p.solution[i]) continue;
    const r = (i / n) | 0, c = i % n;
    out.push(obdlznik(P + c * S, P + r * S, S, S, '#000'));
  }
  return obal(w, w, out.join('') + siet(p, d));
}

export const popisMriezky = (p) => p.n + ' x ' + p.n;
