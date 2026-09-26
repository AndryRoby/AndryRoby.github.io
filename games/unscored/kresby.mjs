// UNSCORED: kresby perom na kartičkách uzlov. Čistý modul bez DOM.
// Súradnice v jednotkách sveta, stred kartičky je 0,0; kartička má 64 x 52, kresba sa drží v x -27..27, y -22..12.
// Príkazy: M x y, L x y, Q cx cy x y, C c1x c1y c2x c2y x y, Z, O cx cy r (kruh), E cx cy rx ry (elipsa).
// Každý podťah (M, O, E) je jeden ťah pera; pero kreslí ťahy po dĺžke v poradí zápisu.

export const KRESBY = {
  ty: 'M -15 -21 L 15 -21 L 15 8 L -15 8 Z M -12.5 -18.5 L 12.5 -18.5 L 12.5 5.5 L -12.5 5.5 Z M -19 8 L 19 8 M -18 11 L 18 11 O 0 -9 4.4 M -9.5 5.5 Q -9 -2.5 0 -3 Q 9 -2.5 9.5 5.5 M -12.5 -12 L -8 -12 M 8 -12 L 12.5 -12',
  sused: 'M -11 -22 L 11 -22 L 11 11 L -11 11 Z M -8 -19 L 8 -19 L 8 -6 L -8 -6 Z M -8 -3 L 8 -3 L 8 8 L -8 8 Z O 5.2 1 1.3 M -3.5 -15.5 L 3.5 -15.5 L 3.5 -10.5 L -3.5 -10.5 Z M -22 11 L 22 11 M 17 -17 L 17 -10 M 14.5 -10 L 19.5 -10 L 18.5 -5 L 15.5 -5 Z',
  ulica: 'M 9 11 L 9 -15 M 5 11 L 13 11 M 9 -15 Q 9 -20 14 -20 L 16 -20 M 13.5 -20 L 19.5 -20 L 18.5 -14 L 14.5 -14 Z M -25 -11 L -2 -11 L -2 -2 L -25 -2 Z M -2 -6.5 L 9 -6.5 M -21.5 -6.5 L -6 -6.5 M -26 11 L 0 11',
  kurier: 'M -16 -4 L 16 -4 L 14 11 L -14 11 Z M -16 -4 L -13 -9 L 13 -9 L 16 -4 M -10 -9 Q 0 -27 10 -9 M -3 -4 L -3 1.5 L 3 1.5 L 3 -4 M -8 -9 L -6 -17 L 6 -15 L 5 -9 M -4.5 -13.5 L 2.5 -12.5',
  zapisnik: 'M -25 -13 Q -12 -17 0 -13 Q 12 -17 25 -13 L 25 9 Q 12 5 0 9 Q -12 5 -25 9 Z M 0 -13 L 0 9 M -21 -8 L -4 -9 M -21 -4 L -4 -5 M -21 0 L -6 -1 M -21 4 L -9 3 M 4 -9 L 21 -8 M 4 -5 L 19 -4 M 4 -1 L 13 0 M 11 4 L 25 -10 L 27 -8 L 13 6 Z',
  krieda: 'M -12 -22 L 12 -22 L 12 11 L -12 11 Z M -4 -22 L -4 11 M 4 -22 L 4 11 O 0 -9 5.5 M -18 11 L 18 11 M 16 8 L 24 3 L 25.5 5.5 L 17.5 10 Z',
  bunka: 'E 0 -4 14 7.5 O 0 -16.5 3.2 O -17 -9 3.2 O 17 -9 3.2 O -12 7 3.2 O 12 7 3.2 M -3 -6 L 3 -6 L 2 -2 L -2 -2 Z M 3 -5 Q 5.5 -5 5 -3',
  bicykel: 'O -14 3 8.5 O 14 3 8.5 M 0 3 L -4 -8 L 10 -8 L 0 3 L -14 3 L -4 -8 M 10 -8 L 14 3 M -7 -10 L -1 -10 M 10 -8 L 9 -13 L 13.5 -13 M 12 -11 L 20 -11 L 19 -5 L 13 -5 Z M 14 -11 L 13 -15 L 18 -15 L 18 -11',
  mira: 'M -25 -20 L -9 -20 L -9 0 L -25 0 Z M -17 -20 L -17 0 M -25 -10 L -9 -10 O 4 -8 5.5 M -1.5 -13 L 9.5 -13 L 8.5 -17.5 L -0.5 -17.5 Z M -9 11 Q -8 -1 4 -1.5 Q 16 -1 17 11 M -1 0.5 Q 0 7 4 7 Q 8 7 9 0.5 O 4 7.5 1.2',
  pisaci: 'M -21 11 L 21 11 L 17 -3 L -17 -3 Z M -19 -3 L 19 -3 L 19 -8 L -19 -8 Z O -21.5 -5.5 2.5 O 21.5 -5.5 2.5 M -9 -8 L -9 -22 L 9 -22 L 9 -8 M -6 -18 L 6 -18 M -6 -15 L 3 -15 M -6 -12 L 5 -12 O -12 2 1.3 O -7 2 1.3 O -2 2 1.3 O 3 2 1.3 O 8 2 1.3 O 13 2 1.3 O -9.5 6.5 1.3 O -4.5 6.5 1.3 O 0.5 6.5 1.3 O 5.5 6.5 1.3 O 10.5 6.5 1.3',
  tlaciar: 'M -23 -3 L 3 -7 L 7 9 L -19 13 Z M -21 -6 L 5 -10 L 6 -6 M -19 -9 L 7 -13 L 8 -9 M -19 1 L 0 -2 M -18 5 L 2 2 M -17 9 L -3 7 M 11 -21 L 25 -17 L 21 -5 L 8 -9 Z M 13 -17 L 22 -14 M 12 -13 L 20 -11 M 1 -16 Q 4 -20 8 -19',
  tomas: 'M -21 11 L -13 -20 M -11 11 L -3 -20 M -19.4 5 L -9.4 5 M -17.8 -1 L -7.8 -1 M -16.2 -7 L -6.2 -7 M -14.6 -13 L -4.6 -13 M 13 11 L 13 -10 M 8 11 L 18 11 M 5 -20 L 22 -16 L 20 -9 L 3 -13 Z O 2.5 -16.5 2.2 M 13 -10 L 13 -11.5',
  ruth: 'M -25 -19 L 25 -19 L 25 5 L -25 5 Z M -25 -11 L 25 -11 M -25 -3 L 25 -3 M -15 -19 L -15 5 M -5 -19 L -5 5 M 5 -19 L 5 5 M 15 -19 L 15 5 M -20 -15 L -19 -15 M -11 -7 L -9 -7 M 9 -15 L 11 -15 M 19 1 L 21 1 M 0 -7 L 1 -7 M -19 8 L 13 8 L 13 11.5 L -19 11.5 Z M 13 8 L 17 8 L 17 11.5 L 13 11.5',
  kopirak: 'M -8 -22 L 21 -22 L 21 3 L 17 3 M -13 -19 L 16 -19 L 16 6 L 12 6 M -18 -16 L 11 -16 L 11 10 L -18 10 Z M -14 -11 L 6 -11 M -14 -7 L 7 -7 M -14 -3 L 4 -3 M -14 1 L 6 1 M -14 5 L 0 5 M 13 -19 L 16 -16 M 13 -15 L 16 -12 M 13 -11 L 16 -8 M 13 -7 L 16 -4 M 13 -3 L 16 0',
  weir: 'M -24 -2 L 24 -2 M -24 2 L 24 2 M -12 -2 L -12 -16 M 12 -2 L 12 -16 M -14 -16 L 14 -16 O 0 -10 5 M 0 -15 L 0 -5 M -5 -10 L 5 -10 M -24 7 Q -18 4 -12 7 Q -6 10 0 7 Q 6 4 12 7 Q 18 10 24 7 M -20 11 Q -14 8 -8 11 Q -2 14 4 11 Q 10 8 16 11',
  zadna: 'M -14 11 L -14 -22 L 14 -22 L 14 11 M -14 -22 L -3 -19 L -3 13 L -14 11 M -6 -3 L -6 -1 M 2 3 L 11 3 M 3 3 L 3 11 M 10 3 L 10 11 M 10 3 L 10 -7 L 12 -7 M -22 11 L 22 11',
};

/** Rozloží zápis na ťahy (polyline) s dĺžkami. Vracia { tahy: [{ body: number[], dlzka }], spolu }. */
export function rozloz(zapis) {
  const t = zapis.trim().split(/\s+/);
  const tahy = [];
  let akt = null;
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  const n = () => parseFloat(t[i++]);
  let i = 0;
  const novy = (px, py) => {
    akt = [px, py];
    tahy.push(akt);
    x = sx = px;
    y = sy = py;
  };
  const ciara = (px, py) => {
    akt.push(px, py);
    x = px;
    y = py;
  };
  while (i < t.length) {
    const c = t[i++];
    if (c === 'M') novy(n(), n());
    else if (c === 'L') ciara(n(), n());
    else if (c === 'Z') ciara(sx, sy);
    else if (c === 'Q') {
      const [cx, cy, ex, ey] = [n(), n(), n(), n()];
      const x0 = x;
      const y0 = y;
      for (let k = 1; k <= 10; k++) {
        const u = k / 10;
        ciara((1 - u) ** 2 * x0 + 2 * (1 - u) * u * cx + u * u * ex, (1 - u) ** 2 * y0 + 2 * (1 - u) * u * cy + u * u * ey);
      }
    } else if (c === 'C') {
      const [c1x, c1y, c2x, c2y, ex, ey] = [n(), n(), n(), n(), n(), n()];
      const x0 = x;
      const y0 = y;
      for (let k = 1; k <= 12; k++) {
        const u = k / 12;
        const a = (1 - u) ** 3;
        const b = 3 * (1 - u) ** 2 * u;
        const d = 3 * (1 - u) * u * u;
        const e = u ** 3;
        ciara(a * x0 + b * c1x + d * c2x + e * ex, a * y0 + b * c1y + d * c2y + e * ey);
      }
    } else if (c === 'O' || c === 'E') {
      const cx = n();
      const cy = n();
      const rx = n();
      const ry = c === 'E' ? n() : rx;
      const kroky = Math.max(12, Math.round((rx + ry) * 2.2));
      // kruh začína hore a ide v smere hodín, ako by ho kreslila ruka
      novy(cx, cy - ry);
      for (let k = 1; k <= kroky; k++) {
        const a = -Math.PI / 2 + (k / kroky) * Math.PI * 2;
        ciara(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
      }
    } else {
      throw new Error('kresba: neznámy príkaz ' + c);
    }
  }
  let spolu = 0;
  const out = tahy.map((b) => {
    let d = 0;
    for (let k = 2; k < b.length; k += 2) d += Math.hypot(b[k] - b[k - 2], b[k + 1] - b[k - 1]);
    spolu += d;
    return { body: b, dlzka: d };
  });
  return { tahy: out, spolu };
}

const cache = new Map();
export function kresba(id) {
  if (!cache.has(id)) cache.set(id, rozloz(KRESBY[id]));
  return cache.get(id);
}

/** Pridá do cesty ťahy do dĺžky `po` (v jednotkách). Nealokuje. */
export function tahyPo(ctx, k, po) {
  let zvysok = po;
  for (let j = 0; j < k.tahy.length && zvysok > 0; j++) {
    const { body, dlzka } = k.tahy[j];
    ctx.moveTo(body[0], body[1]);
    if (zvysok >= dlzka) {
      for (let m = 2; m < body.length; m += 2) ctx.lineTo(body[m], body[m + 1]);
      zvysok -= dlzka;
      continue;
    }
    for (let m = 2; m < body.length; m += 2) {
      const d = Math.hypot(body[m] - body[m - 2], body[m + 1] - body[m - 1]);
      if (zvysok >= d) {
        ctx.lineTo(body[m], body[m + 1]);
        zvysok -= d;
      } else {
        const u = d > 0 ? zvysok / d : 0;
        ctx.lineTo(body[m - 2] + (body[m] - body[m - 2]) * u, body[m - 1] + (body[m + 1] - body[m - 1]) * u);
        zvysok = 0;
        break;
      }
    }
  }
}
