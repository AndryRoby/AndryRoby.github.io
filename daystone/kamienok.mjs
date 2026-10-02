// Daystone: lesklé kamienky kreslené kódom (KONCEPT 9.3), jeden recept pre SVG na stránke
// aj pre canvas na karte. Vrstvy: kontaktný tieň, radiálny prechod d(n) do d(n+1) zo
// stredu 35 % zľava a 30 % zhora, okrajové svetlo vpravo hore, odlesk vľavo hore otočený
// o -20 stupňov, tvár len očami a obočím. Žiadne AI obrázky, žiadne fotky.
import { RODINA } from './logika.mjs';

const INK = '#2A2238';

// Tvary v štvorci 100 x 100; každá rodina má iný tvar, nielen farbu (R77).
export const TVARY = {
  bright: { d: 'M50 12C73 12 90 30 90 52C90 75 73 92 50 92C27 92 10 75 10 52C10 30 27 12 50 12Z', oci: [41, 50, 59, 50] },
  calm: { d: 'M52 24C77 23 97 38 96 57C95 76 74 89 49 89C24 89 4 76 4 57C4 39 26 25 52 24Z', oci: [40, 54, 60, 54] },
  okay: { d: 'M34 15C50 13 64 13 71 15C84 18 88 26 88 39C89 52 89 62 87 72C85 84 78 90 66 90C54 91 44 91 32 90C20 89 13 82 12 70C11 58 11 48 12 37C13 25 21 17 34 15Z', oci: [40, 51, 60, 51] },
  tense: { d: 'M17 40C29 25 51 15 70 15C86 17 92 37 91 57C90 78 73 92 51 92C29 92 11 80 10 62C9 53 12 46 17 40Z', oci: [42, 53, 62, 53] },
  low: { d: 'M26 9C42 22 86 40 86 64C86 82 72 94 53 94C33 94 18 80 18 60C18 42 21 25 26 9Z', oci: [43, 62, 62, 62] },
};

const farby = (rodina, hlbka) => {
  const f = RODINA.get(rodina)?.farby || RODINA.get('calm').farby;
  const h = Math.min(4, Math.max(1, hlbka | 0));
  return [f[h - 1], f[h]];
};

let pocitadlo = 0;

/** SVG značky jedného kamienka (len z našich konštánt, bez textu od človeka). */
export function svgKamienok(rodina, hlbka = 3, { tvar = true, x, y, s, trieda = '' } = {}) {
  const t = TVARY[rodina] || TVARY.calm;
  const [c0, c1] = farby(rodina, hlbka);
  const id = `ks${++pocitadlo}`;
  const [x1, y1, x2, y2] = t.oci;
  const tvarSvg = tvar
    ? `<g fill="${INK}"><ellipse cx="${x1}" cy="${y1}" rx="3.4" ry="5.2"/><ellipse cx="${x2}" cy="${y2}" rx="3.4" ry="5.2"/></g>`
      + `<g fill="#fff"><circle cx="${x1 + 1.2}" cy="${y1 - 2}" r="1.2"/><circle cx="${x2 + 1.2}" cy="${y2 - 2}" r="1.2"/></g>`
      + `<path d="M${x1 - 5} ${y1 - 10}Q${x1} ${y1 - 13} ${x1 + 4} ${y1 - 10}M${x2 - 4} ${y2 - 10}Q${x2} ${y2 - 13} ${x2 + 5} ${y2 - 10}" stroke="${INK}" stroke-opacity=".85" stroke-width="2.6" stroke-linecap="round" fill="none"/>`
    : '';
  const poloha = s ? ` x="${x}" y="${y}" width="${s}" height="${s * 1.04}"` : '';
  return `<svg viewBox="0 0 100 104" aria-hidden="true" focusable="false"${poloha}${trieda ? ` class="${trieda}"` : ''}>`
    + `<defs>`
    + `<radialGradient id="${id}z" cx="35" cy="30" r="72" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></radialGradient>`
    + `<radialGradient id="${id}o" cx="82" cy="18" r="46" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`
    + `<radialGradient id="${id}l"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`
    + `<radialGradient id="${id}t"><stop offset="0" stop-color="${INK}" stop-opacity=".22"/><stop offset="1" stop-color="${INK}" stop-opacity="0"/></radialGradient>`
    + `<clipPath id="${id}c"><path d="${t.d}"/></clipPath>`
    + `</defs>`
    + `<ellipse cx="50" cy="96" rx="40" ry="7.5" fill="url(#${id}t)"/>`
    + `<path d="${t.d}" fill="url(#${id}z)"/>`
    + `<g clip-path="url(#${id}c)"><rect width="100" height="100" fill="url(#${id}o)"/>`
    + `<ellipse cx="34" cy="31" rx="17.5" ry="10" transform="rotate(-20 34 31)" fill="url(#${id}l)"/></g>`
    + tvarSvg
    + `</svg>`;
}

/** Ten istý kamienok do canvasu; (x, y) je ľavý horný roh, s je veľkosť strany. */
export function kresliKamienok(ctx, rodina, hlbka, x, y, s, { tvar = true } = {}) {
  const t = TVARY[rodina] || TVARY.calm;
  const [c0, c1] = farby(rodina, hlbka);
  const cesta = new Path2D(t.d);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);

  ctx.save();
  ctx.translate(50, 96);
  ctx.scale(1, 0.18);
  const tien = ctx.createRadialGradient(0, 0, 0, 0, 0, 42);
  tien.addColorStop(0, 'rgba(42,34,56,.22)');
  tien.addColorStop(1, 'rgba(42,34,56,0)');
  ctx.fillStyle = tien;
  ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  const zaklad = ctx.createRadialGradient(35, 30, 0, 35, 30, 72);
  zaklad.addColorStop(0, c0);
  zaklad.addColorStop(1, c1);
  ctx.fillStyle = zaklad;
  ctx.fill(cesta);

  ctx.save();
  ctx.clip(cesta);
  const okraj = ctx.createRadialGradient(82, 18, 0, 82, 18, 46);
  okraj.addColorStop(0, 'rgba(255,255,255,.34)');
  okraj.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = okraj;
  ctx.fillRect(0, 0, 100, 100);
  ctx.translate(34, 31);
  ctx.rotate(-20 * Math.PI / 180);
  ctx.scale(1, 10 / 17.5);
  const lesk = ctx.createRadialGradient(0, 0, 0, 0, 0, 17.5);
  lesk.addColorStop(0, 'rgba(255,255,255,.85)');
  lesk.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lesk;
  ctx.beginPath(); ctx.arc(0, 0, 17.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  if (tvar) {
    const [x1, y1, x2, y2] = t.oci;
    ctx.fillStyle = INK;
    for (const [ox, oy] of [[x1, y1], [x2, y2]]) { ctx.beginPath(); ctx.ellipse(ox, oy, 3.4, 5.2, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#fff';
    for (const [ox, oy] of [[x1, y1], [x2, y2]]) { ctx.beginPath(); ctx.arc(ox + 1.2, oy - 2, 1.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = 'rgba(42,34,56,.85)';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.stroke(new Path2D(`M${x1 - 5} ${y1 - 10}Q${x1} ${y1 - 13} ${x1 + 4} ${y1 - 10}M${x2 - 4} ${y2 - 10}Q${x2} ${y2 - 13} ${x2 + 5} ${y2 - 10}`));
  }
  ctx.restore();
}
