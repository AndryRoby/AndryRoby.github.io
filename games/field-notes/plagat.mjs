/* Field Notes: hotová strana ako plagát na stiahnutie (SVG, pomer A4).
 * Čistý modul bez DOM, beží aj v Node (test). Písmo je Georgia, lebo
 * stiahnutý súbor nemá naše webové písma; kresby sú tie isté ako v hre. */
import { svg, PAPIER, ATRAMENT } from './kresby.mjs';

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function zalom(text, naRiadok) {
  const slova = String(text).split(/\s+/);
  const riadky = [];
  let akt = '';
  for (const s of slova) {
    if (!akt) akt = s;
    else if ((akt + ' ' + s).length <= naRiadok) akt += ' ' + s;
    else { riadky.push(akt); akt = s; }
  }
  if (akt) riadky.push(akt);
  return riadky;
}

export function nazovSuboru(strana) {
  const tema = strana.nazov.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `field-notes-${tema}-${strana.druh === 'den' ? strana.kluc : 'plate-' + strana.kluc}.svg`;
}

/* nadpis: riadok pod titulom, napríklad „Plate XIV“ alebo „26 September 2026“. */
export function plagat(strana, { nadpis = '' } = {}) {
  const W = 1000, H = 1414;
  const serif = "Georgia, 'Times New Roman', serif";
  const vnutro = (s) => s.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  let telo = '';
  strana.slova.forEach((s, k) => {
    const stlpec = k % 2, riadok = Math.floor(k / 2);
    const x = 70 + stlpec * 440, y = 236 + riadok * 282;
    telo += `<g transform="translate(${x + 60} ${y}) scale(2.6)">${vnutro(svg(s.kresba, { stav: 'hotovo', papier: PAPIER }))}</g>`;
    telo += `<text x="${x}" y="${y + 206}" font-family="${serif}" font-size="23" font-style="italic" fill="${ATRAMENT}"><tspan font-size="15" font-style="normal" letter-spacing="2" fill="#665c4d">${k + 1}.  </tspan>${esc(s.meno)}</text>`;
    zalom(s.fakt, 50).slice(0, 3).forEach((r, j) => {
      telo += `<text x="${x}" y="${y + 232 + j * 21}" font-family="${serif}" font-size="15.5" fill="${ATRAMENT}">${esc(r)}</text>`;
    });
  });
  const hlava =
    `<text x="${W / 2}" y="92" text-anchor="middle" font-family="${serif}" font-size="15" letter-spacing="6" fill="#665c4d">FIELD NOTES</text>` +
    `<text x="${W / 2}" y="150" text-anchor="middle" font-family="${serif}" font-size="46" fill="${ATRAMENT}">${esc(strana.nazov)}</text>` +
    `<text x="${W / 2}" y="186" text-anchor="middle" font-family="${serif}" font-size="18" font-style="italic" fill="#665c4d">${esc(nadpis)}</text>` +
    `<line x1="120" y1="206" x2="880" y2="206" stroke="#cfc3a8" stroke-width="1.2"/>`;
  const pata =
    `<line x1="120" y1="1352" x2="880" y2="1352" stroke="#cfc3a8" stroke-width="1.2"/>` +
    `<text x="${W / 2}" y="1380" text-anchor="middle" font-family="${serif}" font-size="13" fill="#665c4d">Drawn in code by ARLing. Facts from Wikipedia, each with its page at arling.sk/games/field-notes/</text>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<title>${esc('Field Notes: ' + strana.nazov)}</title>` +
    `<rect width="${W}" height="${H}" fill="${PAPIER}"/><rect x="24" y="24" width="${W - 48}" height="${H - 48}" fill="none" stroke="#cfc3a8" stroke-width="1.5"/>` +
    hlava + telo + pata + '</svg>';
}
