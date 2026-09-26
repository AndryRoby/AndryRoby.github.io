// Word Search film: kresliace pomôcky podľa skutočnej appky (products/word-search-android).
// Farby z Play.kt (Ink, Paper, Green, osem pásov), zvýrazňovače prepísané z Board.kt (highlight),
// písmo Nunito z appky (OFL, podmnožina Latin vo woff2 vedľa tohto súboru).
// Všetko statické sa kreslí raz do spritov; per snímka ostanú len čiary zvýraznenia a drawImage.

import { platno, pismo, zaoblene } from './engine/kresba.js';

export const RODINA = '"Nunito WS", system-ui, sans-serif';
export const nun = (vaha, px) => pismo(vaha, px, RODINA);

export const FARBA = {
  ink: '#203E45',
  paper: '#F5F2E9',
  green: '#137A68',
  greenDeep: '#0F6355',
  miss: '#DAD8CF',
  // Play.kt: bands, v poradí; slovo i dostane pás i % 8 (Board.kt: bands[i % bands.size])
  pasy: ['#9FDAC7', '#F1D580', '#C9B8EA', '#A9CEEE', '#F0B4AD', '#BDD993', '#EAC0DF', '#99D4D4'],
};

/** '#RRGGBB' + alfa -> 'rgba(...)'. */
export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Načíta Nunito z priečinka filmu (FontFace, CSP font-src 'self'). */
export async function nacitajPisma(zaklad) {
  if (typeof FontFace === 'undefined' || !document.fonts) return;
  const rezy = [['nunito-regular.woff2', '400'], ['nunito-semibold.woff2', '600'], ['nunito-bold.woff2', '700'], ['nunito-bold.woff2', '800']];
  await Promise.all(rezy.map(async ([f, vaha]) => {
    const ff = new FontFace('Nunito WS', `url(${new URL(f, zaklad).href})`, { weight: vaha });
    await ff.load();
    document.fonts.add(ff);
  })).catch(() => {});
}

/**
 * Písmeno dosky ako sprite c x c (logické body). Appka: Nunito SemiBold v Ink; písmeno nájdeného
 * slova je biele s obrysom Ink (šírka ťahu 10 % veľkosti písma, Board.kt: edge.strokeWidth=body*.10).
 */
export function spritePismena(ch, c, dpr, biele) {
  const S = Math.ceil(c * dpr);
  const cv = platno(S, S), x = cv.getContext('2d');
  x.scale(dpr, dpr);
  const body = c * 0.5;
  x.font = nun(600, body);
  x.textAlign = 'center';
  x.textBaseline = 'alphabetic';
  const m = x.measureText(ch);
  const base = c / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  if (biele) {
    x.lineJoin = 'round';
    x.strokeStyle = FARBA.ink;
    x.lineWidth = body * 0.1;
    x.strokeText(ch, c / 2, base);
    x.fillStyle = '#ffffff';
  } else x.fillStyle = FARBA.ink;
  x.fillText(ch, c / 2, base);
  return cv;
}

function ciara(x, farba, ax, ay, bx, by, sirka, hrot = 'round', pomlcky = null, posun = 0) {
  // nulová dĺžka by pri zaoblenom konci nemusela nakresliť nič: malý posun
  if (Math.abs(bx - ax) + Math.abs(by - ay) < 0.01) bx += 0.01;
  x.strokeStyle = farba;
  x.lineWidth = sirka;
  x.lineCap = hrot;
  if (pomlcky) { x.setLineDash(pomlcky); x.lineDashOffset = -posun; }
  x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke();
  if (pomlcky) { x.setLineDash([]); x.lineDashOffset = 0; }
}

export const STYLY = ['Classic', 'Chalk', 'Glow', 'Marker', 'Stitch', 'Ribbon'];

/**
 * Zvýraznenie nájdeného slova, prepis Board.kt highlight(): šesť štýlov.
 * farba '#RRGGBB', a (ax, ay) a b (bx, by) sú stredy prvej a poslednej bunky, step = veľkosť bunky.
 */
export function zvyrazni(x, farba, ax, ay, bx, by, step, styl, alfa = 1) {
  if (alfa <= 0) return;
  const f = (a) => rgba(farba, a * alfa);
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
  const nx = d > 0 ? -dy / d : 0, ny = d > 0 ? dx / d : 1;
  switch (styl) {
    case 1: // Chalk: ťah rozbitý na zrno dvoma prechodmi pomlčiek
      ciara(x, f(0.5), ax, ay, bx, by, step * 0.76);
      ciara(x, f(0.42), ax, ay, bx, by, step * 0.7, 'round', [step * 0.07, step * 0.05], step * 0.03);
      ciara(x, f(0.34), ax, ay, bx, by, step * 0.44, 'round', [step * 0.04, step * 0.09], step * 0.06);
      break;
    case 2: // Glow: mäkká žiara pod jasnejším jadrom
      ciara(x, f(0.14), ax, ay, bx, by, step * 1.1);
      ciara(x, f(0.24), ax, ay, bx, by, step * 0.92);
      ciara(x, f(0.9), ax, ay, bx, by, step * 0.6);
      ciara(x, `rgba(255,255,255,${0.3 * alfa})`, ax, ay, bx, by, step * 0.22);
      break;
    case 3: { // Marker: plochý hrot dvakrát, druhý ťah mierne vedľa
      const o = step * 0.07;
      ciara(x, f(0.62), ax - nx * o, ay - ny * o, bx - nx * o, by - ny * o, step * 0.62, 'square');
      ciara(x, f(0.48), ax + nx * o, ay + ny * o, bx + nx * o, by + ny * o, step * 0.54, 'square');
      break;
    }
    case 4: { // Stitch: bledý pás a stehy po oboch okrajoch
      const o = step * 0.27, nit = [step * 0.16, step * 0.12];
      ciara(x, f(0.38), ax, ay, bx, by, step * 0.78);
      ciara(x, f(1), ax - nx * o, ay - ny * o, bx - nx * o, by - ny * o, step * 0.075, 'round', nit, step * 0.05);
      ciara(x, f(1), ax + nx * o, ay + ny * o, bx + nx * o, by + ny * o, step * 0.075, 'round', nit, step * 0.05);
      break;
    }
    case 5: { // Ribbon: plný pás a svetlejší prúžok po každej strane
      const o = step * 0.24, b = `rgba(255,255,255,${0.55 * alfa})`;
      ciara(x, f(1), ax, ay, bx, by, step * 0.74);
      ciara(x, b, ax - nx * o, ay - ny * o, bx - nx * o, by - ny * o, step * 0.06);
      ciara(x, b, ax + nx * o, ay + ny * o, bx + nx * o, by + ny * o, step * 0.06);
      break;
    }
    default: // Classic
      ciara(x, f(1), ax, ay, bx, by, step * 0.78);
  }
}

/**
 * Prst ako sprite: pohľad zhora na ukazovák, ktorý prichádza zdola sprava. Hrot (miesto dotyku) je
 * v bode sprite.hrot; kreslí sa otočený o sprite.uhol. Tieň je zapečený, per snímka žiadne rozmazanie.
 */
export function spritePrsta(c, dpr) {
  const fw = c * 0.66, L = c * 2.5, m = c * 0.5;
  const w = fw + 2 * m, h = L + 2 * m;
  const cv = platno(Math.ceil(w * dpr), Math.ceil(h * dpr)), x = cv.getContext('2d');
  x.scale(dpr, dpr);
  const x0 = m, y0 = m;
  const tvar = () => {
    x.beginPath();
    x.moveTo(x0, y0 + fw / 2);
    x.arc(x0 + fw / 2, y0 + fw / 2, fw / 2, Math.PI, 0);
    x.lineTo(x0 + fw * 1.04, y0 + L);
    x.lineTo(x0 - fw * 0.04, y0 + L);
    x.closePath();
  };
  // tieň (zapečený raz)
  x.save();
  x.shadowColor = 'rgba(32,62,69,0.28)';
  x.shadowBlur = c * 0.22;
  x.shadowOffsetX = c * 0.1;
  x.shadowOffsetY = c * 0.12;
  tvar(); x.fillStyle = '#e3b394'; x.fill();
  x.restore();
  // koža: prechod naprieč prstom (okraje tmavšie, stred svetlejší)
  const g = x.createLinearGradient(x0, 0, x0 + fw, 0);
  g.addColorStop(0, '#d9a283'); g.addColorStop(0.35, '#f3cbb0'); g.addColorStop(0.62, '#f0c4a7'); g.addColorStop(1, '#cf9676');
  tvar(); x.fillStyle = g; x.fill();
  x.lineWidth = c * 0.018; x.strokeStyle = 'rgba(150,90,62,0.45)'; x.stroke();
  // necht pri hrote
  const nw = fw * 0.6, nh = fw * 0.72, nx = x0 + (fw - nw) / 2, ny = y0 + fw * 0.1;
  x.beginPath();
  x.moveTo(nx, ny + nh);
  x.lineTo(nx, ny + nw / 2);
  x.arc(nx + nw / 2, ny + nw / 2, nw / 2, Math.PI, 0);
  x.lineTo(nx + nw, ny + nh);
  x.quadraticCurveTo(nx + nw / 2, ny + nh + nw * 0.18, nx, ny + nh);
  const gn = x.createLinearGradient(nx, ny, nx + nw, ny + nh);
  gn.addColorStop(0, '#fbe6db'); gn.addColorStop(1, '#efc9b8');
  x.fillStyle = gn; x.fill();
  x.lineWidth = c * 0.014; x.strokeStyle = 'rgba(160,100,80,0.45)'; x.stroke();
  x.beginPath(); x.moveTo(nx + nw * 0.3, ny + nw * 0.2); x.quadraticCurveTo(nx + nw * 0.22, ny + nh * 0.5, nx + nw * 0.3, ny + nh * 0.8);
  x.lineWidth = c * 0.03; x.strokeStyle = 'rgba(255,255,255,0.55)'; x.stroke();
  // záhyby kĺbu
  x.strokeStyle = 'rgba(150,90,62,0.35)'; x.lineWidth = c * 0.016;
  for (const k of [1.72, 1.86]) {
    x.beginPath(); x.moveTo(x0 + fw * 0.22, y0 + fw * k); x.quadraticCurveTo(x0 + fw * 0.5, y0 + fw * (k + 0.07), x0 + fw * 0.78, y0 + fw * k); x.stroke();
  }
  return { c: cv, w, h, hrot: [x0 + fw / 2, y0 + fw * 0.3], uhol: -0.5 };
}

/** Pilulka s písmenami nad doskou (Board.kt TracePill): Nunito Bold, rozostup 2sp, zaoblenie 11dp. */
export function spritePilulky(dpr, text, px, vypln, farbaTextu) {
  const m = platno(4, 4).getContext('2d');
  m.font = nun(700, px);
  if ('letterSpacing' in m) m.letterSpacing = `${px * 0.14}px`;
  const tw = m.measureText(text).width;
  const w = tw + px * 1.6, h = px * 1.55;
  const cv = platno(Math.ceil(w * dpr), Math.ceil(h * dpr)), x = cv.getContext('2d');
  x.scale(dpr, dpr);
  zaoblene(x, 0, 0, w, h, h * 0.42);
  x.fillStyle = vypln; x.fill();
  x.font = nun(700, px);
  if ('letterSpacing' in x) x.letterSpacing = `${px * 0.14}px`;
  x.textBaseline = 'middle'; x.textAlign = 'left';
  x.fillStyle = farbaTextu;
  x.fillText(text, px * 0.8 + px * 0.07, h / 2 + px * 0.05);
  return { c: cv, w, h };
}
