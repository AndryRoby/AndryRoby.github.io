/* Spoločné kreslenie pre knihy hlavolamov.
 *
 * Prečo vlastný renderer a nie ten zo stránky: stránka kreslí do DOM, farebne,
 * s hover stavmi a s CSS premennými motívu. Kniha potrebuje čisté SVG, ktoré
 * Chrome vytlačí do PDF ako vektor: len čierna, biela a dva odtiene sivej,
 * hrubé čiary na hraniciach blokov a čísla, ktoré ostanú čitateľné aj vtedy,
 * keď je hlavolam na strane malý.
 *
 * Jednotky: jedno políčko je S = 100 jednotiek. SVG nemá width ani height,
 * len viewBox, takže o veľkosť na strane sa stará CSS. Hrúbky čiar sú preto
 * uvedené v tých istých jednotkách a zmenšia sa spolu s obrázkom.
 *
 * Kontrast na papieri (merané na 600 dpi tlači aj na náhľadoch):
 *   TENKA 4    mriežka vnútri bloku
 *   HRUBA 12   hranica bloku a okraj dosky
 *   CIARA 13   nakreslená slučka alebo cesta v riešení
 * Sivé: SVETLA #d7d7d7 (výplň políčka, ktorá nesmie prekryť číslo),
 *       STREDNA #9a9a9a (čísla zadania na strane s riešením),
 *       TMAVA #333 (zaplavená plocha).
 */

export const S = 100;
export const TENKA = 4;
export const HRUBA = 12;
export const CIARA = 13;
export const SVETLA = '#d7d7d7';
export const STREDNA = '#8e8e8e';
export const TMAVA = '#323232';

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* Číslo do SVG: najviac tri desatinné miesta a bez koncových núl, aby sa
   súbor zbytočne nenafukoval (PDF má strop 8 MB). */
export function c(x) {
  const v = Math.round(x * 1000) / 1000;
  return String(v);
}

export function obal(w, h, telo) {
  return '<svg class="p" viewBox="0 0 ' + c(w) + ' ' + c(h) + '" xmlns="http://www.w3.org/2000/svg"'
    + ' preserveAspectRatio="xMidYMid meet" shape-rendering="geometricPrecision">' + telo + '</svg>';
}

export function ciara(x1, y1, x2, y2, w, farba = '#000', cap = 'square') {
  return '<line x1="' + c(x1) + '" y1="' + c(y1) + '" x2="' + c(x2) + '" y2="' + c(y2)
    + '" stroke="' + farba + '" stroke-width="' + c(w) + '" stroke-linecap="' + cap + '"/>';
}

export function obdlznik(x, y, w, h, vypln, obrys, sirka) {
  return '<rect x="' + c(x) + '" y="' + c(y) + '" width="' + c(w) + '" height="' + c(h) + '"'
    + ' fill="' + (vypln || 'none') + '"'
    + (obrys ? ' stroke="' + obrys + '" stroke-width="' + c(sirka || TENKA) + '"' : '') + '/>';
}

export function kruh(cx, cy, r, vypln, obrys, sirka) {
  return '<circle cx="' + c(cx) + '" cy="' + c(cy) + '" r="' + c(r) + '"'
    + ' fill="' + (vypln || 'none') + '"'
    + (obrys ? ' stroke="' + obrys + '" stroke-width="' + c(sirka || TENKA) + '"' : '') + '/>';
}

/* Text v strede bodu. Čísla sú vždy zarovnané na stred oboch osí, lebo
   dominant-baseline central drží aj vtedy, keď je v poli jednociferné aj
   dvojciferné číslo. */
export function text(x, y, s, velkost, opts = {}) {
  const kotva = opts.kotva || 'middle';
  const zaklad = opts.zaklad || 'central';
  return '<text x="' + c(x) + '" y="' + c(y) + '" font-size="' + c(velkost) + '"'
    + ' text-anchor="' + kotva + '" dominant-baseline="' + zaklad + '"'
    + ' fill="' + (opts.farba || '#000') + '"'
    + (opts.tucne ? ' font-weight="700"' : '')
    + (opts.medzera ? ' letter-spacing="' + c(opts.medzera) + '"' : '')
    + '>' + esc(s) + '</text>';
}

/* Mriežka n x n políčok s ľavým horným rohom v (x0, y0).
   hrube(r, c, smer) povie, či je daná vnútorná čiara hrubá: smer 'h' je
   vodorovná čiara nad riadkom r, smer 'v' zvislá čiara vľavo od stĺpca c. */
export function mriezka(x0, y0, n, hrube, opts = {}) {
  const tf = opts.tenkaFarba || '#000';
  const out = [];
  for (let r = 1; r < n; r++) {
    const y = y0 + r * S;
    if (!(hrube && hrube(r, 0, 'h'))) out.push(ciara(x0, y, x0 + n * S, y, TENKA, tf));
  }
  for (let k = 1; k < n; k++) {
    const x = x0 + k * S;
    if (!(hrube && hrube(0, k, 'v'))) out.push(ciara(x, y0, x, y0 + n * S, TENKA, tf));
  }
  if (hrube) {
    for (let r = 1; r < n; r++) {
      const y = y0 + r * S;
      let zac = -1;
      for (let k = 0; k <= n; k++) {
        const je = k < n && hrube(r, k, 'h');
        if (je && zac < 0) zac = k;
        if (!je && zac >= 0) { out.push(ciara(x0 + zac * S, y, x0 + k * S, y, HRUBA)); zac = -1; }
      }
    }
    for (let k = 1; k < n; k++) {
      const x = x0 + k * S;
      let zac = -1;
      for (let r = 0; r <= n; r++) {
        const je = r < n && hrube(r, k, 'v');
        if (je && zac < 0) zac = r;
        if (!je && zac >= 0) { out.push(ciara(x, y0 + zac * S, x, y0 + r * S, HRUBA)); zac = -1; }
      }
    }
  }
  out.push(obdlznik(x0, y0, n * S, n * S, 'none', '#000', HRUBA));
  return out.join('');
}

/* Päťcípa hviezda so stredom (cx, cy) a polomerom r. Používajú ju Hedgehogs
   v riešení; nakreslená ako plná cesta, lebo znak hviezdy z písma by sa na
   rôznych strojoch posadil inak. */
export function hviezda(cx, cy, r) {
  const body = [];
  for (let i = 0; i < 10; i++) {
    const uhol = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.42;
    body.push(c(cx + rr * Math.cos(uhol)) + ',' + c(cy + rr * Math.sin(uhol)));
  }
  return '<polygon points="' + body.join(' ') + '" fill="#000"/>';
}

/* Prerušovaný obrys ohrady (Badgers). `vOhrade(r, c)` povie, či políčko patrí
   do tej istej ohrady. Kreslí sa odsadene o `odsun` dovnútra políčka, takže
   dve susedné ohrady majú medzi sebou viditeľnú medzeru aj po tlači. */
export function obrysOhrady(x0, y0, cells, n, odsun, dash) {
  const vnutri = new Set(cells);
  const je = (r, k) => r >= 0 && k >= 0 && r < n && k < n && vnutri.has(r * n + k);
  const usek = [];
  for (const i of cells) {
    const r = (i / n) | 0, k = i % n;
    const lx = x0 + k * S, ty = y0 + r * S, rx = lx + S, by = ty + S;
    const ix = lx + odsun, iy = ty + odsun, ax = rx - odsun, ay = by - odsun;
    const hore = je(r - 1, k), dole = je(r + 1, k), vlavo = je(r, k - 1), vpravo = je(r, k + 1);
    if (!hore) usek.push([vlavo ? lx : ix, iy, vpravo ? rx : ax, iy]);
    if (!dole) usek.push([vlavo ? lx : ix, ay, vpravo ? rx : ax, ay]);
    if (!vlavo) usek.push([ix, hore ? ty : iy, ix, dole ? by : ay]);
    if (!vpravo) usek.push([ax, hore ? ty : iy, ax, dole ? by : ay]);
    // vnútorné rohy: dve susedné políčka sú v ohrade, ale to za rohom nie je
    if (hore && vlavo && !je(r - 1, k - 1)) { usek.push([lx, iy, ix, iy]); usek.push([ix, ty, ix, iy]); }
    if (hore && vpravo && !je(r - 1, k + 1)) { usek.push([ax, iy, rx, iy]); usek.push([ax, ty, ax, iy]); }
    if (dole && vlavo && !je(r + 1, k - 1)) { usek.push([lx, ay, ix, ay]); usek.push([ix, ay, ix, by]); }
    if (dole && vpravo && !je(r + 1, k + 1)) { usek.push([ax, ay, rx, ay]); usek.push([ax, ay, ax, by]); }
  }
  const d = usek.map((u) => 'M' + c(u[0]) + ' ' + c(u[1]) + 'L' + c(u[2]) + ' ' + c(u[3])).join('');
  return '<path d="' + d + '" fill="none" stroke="#000" stroke-width="5" stroke-dasharray="'
    + (dash || '13 11') + '" stroke-linecap="butt"/>';
}
