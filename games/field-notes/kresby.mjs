/* Field Notes: kresby exemplárov, kreslené kódom (26. 9. 2026).
 *
 * Jeden štýl pre všetky témy: tenká sépiová linka ako perom v zápisníku
 * a akvarelové lazúry z jednej krabičky farieb (P). Lazúra je posunutá
 * o necelý bod mimo linky, ako keď sa štetec netrafí presne; okraj lazúry
 * je o odtieň tmavší, ako keď sa pigment usadí na hrane. Žiadne prechody
 * farieb, žiadne filtre, žiadne cudzie obrázky, žiadny raster.
 *
 * Každá kresba má tri vrstvy:
 *   w  lazúry (plochy a ťahy farbou), vidno ich až po nájdení slova,
 *   i  linky perom; pred nájdením sú to svetlé čiary ceruzkou, po nájdení sa
 *      „dokreslia“ perom (pathLength=1 a stroke-dashoffset v CSS),
 *   f  plné body (oko, zobák, tmavé škvrny), vidno ich po nájdení.
 * Všetko sú <path>, lebo pathLength na path funguje v Chrome aj vo Firefoxe.
 *
 * Plátno každej kresby je 100 x 70 jednotiek (viewBox), pomer bunky na strane.
 * Súbor nemá žiadnu závislosť na DOM, beží aj v Node (testy, plagát, náhľady).
 */

export const ATRAMENT = '#2b2521';
export const CERUZKA = '#a39a8c';
export const PAPIER = '#f4ecda';

/* Krabička farieb. Všetky kresby berú len odtiaľto, preto držia spolu. */
export const P = {
  lemon: '#e2bf45',
  ochre: '#c8953a',
  sienna: '#b0603a',
  vermilion: '#cf4a2e',
  alizarin: '#a3304a',
  rose: '#d9899a',
  violet: '#7a5496',
  ultramarine: '#30509c',
  cerulean: '#3a84b6',
  turquoise: '#4a9d9f',
  viridian: '#2d6b58',
  sap: '#6b8c34',
  olive: '#807c38',
  umber: '#74523a',
  payne: '#363f4f',
};

const f = (n) => {
  const v = Math.round(n * 10) / 10;
  return Object.is(v, -0) ? '0' : String(v);
};

/* ── Geometria ─────────────────────────────────────────────────────────── */

/* Hladká krivka cez body (Catmull-Rom na Bézier). Bod [x, y, 1] je ostrý roh. */
export function hladka(body, uzavreta = true) {
  const n = body.length;
  if (n < 2) return '';
  const bod = (k) => (uzavreta ? body[(k + n) % n] : body[Math.max(0, Math.min(n - 1, k))]);
  let d = `M${f(body[0][0])} ${f(body[0][1])}`;
  const koniec = uzavreta ? n : n - 1;
  for (let k = 0; k < koniec; k++) {
    const p0 = bod(k - 1), p1 = bod(k), p2 = bod(k + 1), p3 = bod(k + 2);
    const c1 = p1[2] ? p1 : [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = p2[2] ? p2 : [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return uzavreta ? d + 'Z' : d;
}
const ciara = (body) => hladka(body, false);
const lomena = (body) => body.map((p, k) => `${k ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join('');
const usecka = (a, b) => `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`;

export function kruh(cx, cy, r) {
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
}
export function elipsa(cx, cy, rx, ry, uhol = 0) {
  const a = (uhol * Math.PI) / 180, dx = Math.cos(a) * rx, dy = Math.sin(a) * rx;
  return `M${f(cx - dx)} ${f(cy - dy)}A${f(rx)} ${f(ry)} ${f(uhol)} 1 0 ${f(cx + dx)} ${f(cy + dy)}A${f(rx)} ${f(ry)} ${f(uhol)} 1 0 ${f(cx - dx)} ${f(cy - dy)}Z`;
}
/* Tieň gule na pravej strane: kosáčik medzi okrajom a elipsou. */
function tien(cx, cy, r, k = 0.55) {
  return `M${f(cx)} ${f(cy - r)}A${f(r)} ${f(r)} 0 0 1 ${f(cx)} ${f(cy + r)}A${f(r * k)} ${f(r)} 0 0 0 ${f(cx)} ${f(cy - r)}Z`;
}
/* Vodorovný pás v kruhu medzi y1 a y2. */
function pas(cx, cy, r, y1, y2) {
  const x1 = Math.sqrt(Math.max(0, r * r - (y1 - cy) ** 2));
  const x2 = Math.sqrt(Math.max(0, r * r - (y2 - cy) ** 2));
  return `M${f(cx - x1)} ${f(y1)}L${f(cx + x1)} ${f(y1)}A${f(r)} ${f(r)} 0 0 1 ${f(cx + x2)} ${f(y2)}L${f(cx - x2)} ${f(y2)}A${f(r)} ${f(r)} 0 0 1 ${f(cx - x1)} ${f(y1)}Z`;
}
/* Vlnitá čiara naprieč kruhom vo výške y. */
function vlna(cx, cy, r, y, amp = 0.5, vln = 3, okraj = 0.8) {
  const x = Math.sqrt(Math.max(0, r * r - (y - cy) ** 2)) * okraj;
  const body = [];
  for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    body.push([cx - x + 2 * x * t, y + amp * Math.sin(t * Math.PI * vln)]);
  }
  return ciara(body);
}
/* Deterministický „náhodný“ rozptyl pre tŕne, čiarky a bodky. */
function rozptyl(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function otoc(p, c, stupne) {
  const a = (stupne * Math.PI) / 180, x = p[0] - c[0], y = p[1] - c[1];
  return [c[0] + x * Math.cos(a) - y * Math.sin(a), c[1] + x * Math.sin(a) + y * Math.cos(a)];
}
/* Z vzoriek krivky nechá len viditeľné úseky (to, čo niečo nezakrýva). */
function viditelne(body, skryty) {
  const useky = [];
  let akt = [];
  for (const p of body) {
    if (skryty(p)) {
      if (akt.length > 1) useky.push(akt);
      akt = [];
    } else akt.push(p);
  }
  if (akt.length > 1) useky.push(akt);
  return useky.map(lomena).join('');
}

/* List: os od základne a po špičku b, polšírka sirka(s), s od 0 po 1.
   zuby = počet zúbkov na stranu (ostré), amp = ich hĺbka ako podiel šírky. */
function list(a, b, sirka, { n = 40, ohyb = 0, zuby = 0, amp = 0.1, lomeny = false } = {}) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const nn = [-u[1], u[0]];
  const os = (s) => {
    const o = ohyb * L * Math.sin(Math.PI * s);
    return [a[0] + u[0] * L * s + nn[0] * o, a[1] + u[1] * L * s + nn[1] * o];
  };
  const pocet = zuby ? zuby * 2 : n;
  const lava = [], prava = [];
  for (let k = 1; k < pocet; k++) {
    const s = k / pocet;
    let w = sirka(s), roh = 0;
    if (zuby) {
      if (k % 2 === 1) { w *= 1 + amp; roh = 1; } else w *= 1 - amp * 0.6;
    }
    const p = os(s);
    lava.push([p[0] + nn[0] * w, p[1] + nn[1] * w, roh]);
    prava.push([p[0] - nn[0] * w, p[1] - nn[1] * w, roh]);
  }
  // Drobné listy (ihlice) stačí lomenou čiarou: pri 2 až 3 px sa krivka nerozozná a cesta je 3x kratšia.
  const tvar = lomeny ? (b) => lomena(b) + 'Z' : hladka;
  const obrys = tvar([[a[0], a[1], 1], ...lava, [b[0], b[1], 1], ...prava.slice().reverse()]);
  const osBody = [];
  for (let k = 0; k <= 12; k++) osBody.push(os((k / 12) * 0.96));
  const polovica = tvar([[a[0], a[1], 1], ...lava, [b[0], b[1], 1], ...osBody.slice().reverse()]);
  return { obrys, polovica, stred: ciara(osBody), os, nn, sirka };
}
/* Viac malých tvarov do jednej cesty (spoločná výplň, jeden uzol v DOM). */
const spoj = (zoznam, kluc) => zoznam.map((x) => x[kluc]).join('');

/* Bočné žilky listu, rovné, ako na herbárovej tabuli. */
function zilky(lst, pocet, { od = 0.12, po = 0.86, sklon = 0.12, dlzka = 0.82 } = {}) {
  let d = '';
  for (let k = 0; k < pocet; k++) {
    const s = od + ((po - od) * k) / Math.max(1, pocet - 1);
    const p = lst.os(s), s2 = Math.min(0.97, s + sklon), q = lst.os(s2), w = lst.sirka(s2) * dlzka;
    for (const str of [1, -1]) d += usecka(p, [q[0] + lst.nn[0] * w * str, q[1] + lst.nn[1] * w * str]);
  }
  return d;
}

/* ── Zápis vrstiev ─────────────────────────────────────────────────────── */
const W = (d, farba, o = 0.5) => ({ d, farba, o });                 // lazúra plochou
const WS = (d, farba, o = 0.5, s = 1.6) => ({ d, farba, o, s });     // lazúra ťahom
const I = (d, s = 1) => ({ d, s });                                  // linka perom
const F = (d, farba = 'ink') => ({ d, farba });                      // plný bod
const PAP = (d) => ({ d, farba: 'papier', o: 1 });                   // krycia biela (papier)

/* Obežná dráha za planétou (len tam, kde ju planéta nezakrýva). Dráha sa nezväčšuje
   s planétou (pevne), jej medzera sa dopočíta až v kresba() podľa mierky planéty. */
function draha(cx, cy, r) {
  return { d: '', s: 0.45, draha: [cx, cy, r], pevne: 1 };
}
function drahaCesta(cx, cy, r) {
  const A = [3, 53], B = [50, 17], C = [97, 39];
  const body = [];
  for (let k = 0; k <= 60; k++) {
    const t = k / 60, m = 1 - t;
    body.push([m * m * A[0] + 2 * m * t * B[0] + t * t * C[0], m * m * A[1] + 2 * m * t * B[1] + t * t * C[1]]);
  }
  return viditelne(body, (p) => Math.hypot(p[0] - cx, p[1] - cy) < r + 2.2);
}
/* Malé planéty sa kreslia väčšie, aby boli na 80 px čitateľné. Hrúbka čiar ostáva. */
const zvacsi = (k, m) => Object.assign(k, { mierka: m });

/* ══ The Solar System ═════════════════════════════════════════════════════ */

function slnko() {
  const c = [50, 35], r = 20;
  let luce = '';
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI * 2) / 16 + 0.1, r2 = k % 2 ? 25.5 : 29;
    luce += usecka([c[0] + Math.cos(a) * 23.2, c[1] + Math.sin(a) * 23.2], [c[0] + Math.cos(a) * r2, c[1] + Math.sin(a) * r2]);
  }
  return {
    w: [W(kruh(50, 35, r), 'lemon', 0.6), W(kruh(50, 35, r), 'ochre', 0.22), W(tien(50, 35, r, 0.5), 'vermilion', 0.2), W(kruh(44, 30, 7), 'lemon', 0.25)],
    i: [I(kruh(50, 35, r), 1.1), I(luce, 0.8), I(ciara([[56, 22.6], [61, 25.4], [64.4, 30]]), 0.45)],
    f: [F(elipsa(56.4, 40.6, 1.5, 1), 'umber'), F(kruh(59.2, 42.2, 0.7), 'umber'), F(elipsa(43.6, 27.6, 0.9, 0.7), 'umber')],
  };
}

function merkur() {
  const cx = 50, cy = 35, r = 12;
  const krat = [[46, 31, 2.4], [54.5, 39.5, 1.8], [52, 29.5, 1.1], [44.5, 39.5, 1.4], [57.5, 33, 0.9], [49, 43, 0.8]];
  return {
    w: [W(kruh(cx, cy, r), 'umber', 0.3), W(kruh(cx, cy, r), 'payne', 0.14), W(tien(cx, cy, r), 'payne', 0.3),
      W(kruh(46, 31, 2.4), 'umber', 0.25), W(kruh(54.5, 39.5, 1.8), 'umber', 0.25)],
    i: [draha(cx, cy, r), I(kruh(cx, cy, r), 1), ...krat.map(([x, y, rr]) => I(kruh(x, y, rr), 0.55))],
    f: [],
  };
}

function venusa() {
  const cx = 50, cy = 35, r = 17;
  return {
    w: [W(kruh(cx, cy, r), 'ochre', 0.34), W(kruh(cx, cy, r), 'lemon', 0.22), W(pas(cx, cy, r, 27, 31), 'sienna', 0.14),
      W(pas(cx, cy, r, 38, 42.5), 'sienna', 0.12), W(tien(cx, cy, r), 'sienna', 0.26)],
    i: [draha(cx, cy, r), I(kruh(cx, cy, r), 1),
      I(ciara([[37, 28.5], [44, 26.6], [53, 28.6], [61, 27.4]]), 0.5),
      I(ciara([[35, 36], [44, 34.2], [52, 37], [63, 35.2]]), 0.5),
      I(ciara([[39, 43.5], [47, 45.4], [57.5, 42.6]]), 0.5)],
    f: [],
  };
}

function zem() {
  const cx = 50, cy = 35, r = 19.5;
  const afrika = hladka([[40.5, 31.5], [45, 29.6], [50, 30.2], [54, 29.2], [57, 32], [60, 35.6, 1], [57.6, 37.2], [56.2, 42], [53.2, 48, 1], [51.2, 46.6], [49.6, 42], [48.4, 38.4], [45, 37.2], [41.2, 35.6], [39.8, 33.4]]);
  const europa = hladka([[41.2, 27.6, 1], [41.2, 24.8], [44.4, 24.2], [45.2, 22], [47.8, 21], [49.6, 19.4], [51.2, 19.6], [52.6, 17.2], [55, 16.8], [56.2, 18.6], [54.8, 20.4], [57, 20.6], [60.8, 21], [62.6, 24.4], [59, 25.6], [56.6, 25.2], [55.8, 27, 1], [54.4, 25.6], [52.6, 24.8], [53.8, 27.8, 1], [52.4, 27.6], [50.8, 25], [48.4, 25.4], [46, 26.4], [44.4, 27.8]]);
  const arabia = hladka([[58.4, 29], [61.4, 30], [63.4, 33.2], [60.4, 34.2], [58.8, 31.6]]);
  const pust = hladka([[42, 31.4], [50, 30.6], [55, 30.4], [56.2, 33.2], [50, 34.6], [43.4, 34.2]]);
  return {
    w: [W(kruh(cx, cy, r), 'cerulean', 0.42), W(kruh(cx, cy, r), 'ultramarine', 0.16), W(afrika, 'sap', 0.55), W(europa, 'sap', 0.5),
      W(arabia, 'ochre', 0.5), W(pust, 'ochre', 0.45), W(tien(cx, cy, r, 0.5), 'payne', 0.26)],
    i: [draha(cx, cy, r), I(kruh(cx, cy, r), 1.1), I(afrika, 0.65), I(europa, 0.65), I(arabia, 0.6),
      I(ciara([[34, 41], [38.4, 43], [44, 42]]), 0.45), I(ciara([[59, 46.4], [63, 44.6], [66.2, 45.2]]), 0.45), I(ciara([[36, 24.4], [40, 22]]), 0.45)],
    f: [],
  };
}

function mesiac() {
  const cx = 50, cy = 35, r = 19;
  const mare = (x, y, rr, seed) => {
    const nah = rozptyl(seed), body = [];
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2, q = rr * (0.78 + nah() * 0.4);
      body.push([x + Math.cos(a) * q, y + Math.sin(a) * q * 0.86]);
    }
    return hladka(body);
  };
  const moria = [mare(42.5, 28.5, 5.4, 3), mare(54, 27, 3.6, 7), mare(58, 33.5, 4.2, 11), mare(38.5, 38, 6.2, 19), mare(49, 44.5, 3.4, 23)];
  const krat = [[45.5, 47.8, 1.6], [40.5, 29.6, 1.1], [61, 42.4, 1.4], [52.5, 37.6, 0.9], [34.6, 34.4, 1], [58.6, 24.6, 0.8]];
  let luce = '';
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.4;
    luce += usecka([45.5 + Math.cos(a) * 2.4, 47.8 + Math.sin(a) * 2.4], [45.5 + Math.cos(a) * 5.4, 47.8 + Math.sin(a) * 5.4]);
  }
  return {
    w: [W(kruh(cx, cy, r), 'payne', 0.12), W(kruh(cx, cy, r), 'ochre', 0.08), ...moria.map((d) => W(d, 'payne', 0.26))],
    i: [I(kruh(cx, cy, r), 1), ...moria.map((d) => I(d, 0.4)), ...krat.map(([x, y, rr]) => I(kruh(x, y, rr), 0.55)), I(luce, 0.35)],
    f: [],
  };
}

function mars() {
  const cx = 50, cy = 35, r = 14.5;
  const tmava1 = hladka([[53, 33], [57, 34.5], [58.6, 38.6], [55.4, 40], [53.6, 37]]);
  const tmava2 = hladka([[42, 39], [46.6, 38.4], [49, 42.4], [45, 44.4], [41.6, 42.2]]);
  const cap = elipsa(50, 23.6, 5, 1.9);
  return {
    w: [W(kruh(cx, cy, r), 'sienna', 0.55), W(kruh(cx, cy, r), 'vermilion', 0.2), W(tmava1, 'umber', 0.35), W(tmava2, 'umber', 0.32),
      W(tien(cx, cy, r), 'umber', 0.28), PAP(cap)],
    i: [draha(cx, cy, r), I(kruh(cx, cy, r), 1), I(cap, 0.55), I(ciara([[41.4, 32.6], [46.4, 33.8], [52.6, 33.2], [57, 35.4]]), 0.6),
      I(kruh(41.2, 29.4, 1.9), 0.55), I(kruh(41.2, 29.4, 0.7), 0.4)],
    f: [],
  };
}

function jupiter() {
  const cx = 50, cy = 35, r = 23;
  const pasy = [[17, 20.6, 'sienna', 0.32], [24.6, 28.8, 'sienna', 0.45], [37.6, 42.4, 'sienna', 0.45], [46.4, 49.8, 'umber', 0.3], [53, 56.4, 'sienna', 0.22]];
  const ciary = [20.6, 24.6, 28.8, 37.6, 42.4, 46.4, 49.8];
  const skvrna = elipsa(58.5, 44.8, 4.8, 2.6);
  return {
    w: [W(kruh(cx, cy, r), 'ochre', 0.34), ...pasy.map(([a, b, c, o]) => W(pas(cx, cy, r, a, b), c, o)), W(skvrna, 'vermilion', 0.6), W(tien(cx, cy, r, 0.6), 'umber', 0.2)],
    i: [I(kruh(cx, cy, r), 1.15), ...ciary.map((y, k) => I(vlna(cx, cy, r, y, 0.45, 3 + (k % 3), 0.92), 0.45)), I(skvrna, 0.6)],
    f: [],
  };
}

function saturn() {
  const c = [50, 35], r = 13.5, uhol = -13;
  const vonkajsi = [33, 8.6], cassini = [26.5, 6.8], vnutorny = [20.5, 5.2];
  // Všetko sa počíta v rovine prstenca (nenaklonenej) a až potom otočí.
  const vpas = (x, y, [rx, ry]) => (x / rx) ** 2 + (y / ry) ** 2 <= 1;
  const vPrednomPase = (x, y) => y > 0 && vpas(x, y, vonkajsi) && !vpas(x, y, vnutorny);
  const vPlanete = (x, y) => x * x + y * y < r * r;
  const vzorkaElipsy = ([rx, ry]) => {
    const b = [];
    for (let k = 0; k <= 120; k++) { const a = (k / 120) * Math.PI * 2; b.push([Math.cos(a) * rx, Math.sin(a) * ry]); }
    return b;
  };
  const doSveta = (b) => b.map(([x, y]) => otoc([x + c[0], y + c[1]], c, uhol));
  const krivkaPrstenca = (e) => {
    const lok = vzorkaElipsy(e);
    const d = viditelne(lok, ([x, y]) => y < 0 && vPlanete(x, y));
    return d ? rebuild(d) : '';
  };
  // viditelne vracia path v lokálnych súradniciach; prepočítame ho bodmi
  function rebuild(d) {
    return d.replace(/([ML])(-?[\d.]+) (-?[\d.]+)/g, (_, cmd, x, y) => {
      const p = otoc([+x + c[0], +y + c[1]], c, uhol);
      return `${cmd}${f(p[0])} ${f(p[1])}`;
    });
  }
  const obrysPlanety = [];
  for (let k = 0; k <= 140; k++) { const a = (k / 140) * Math.PI * 2; obrysPlanety.push([Math.cos(a) * r, Math.sin(a) * r]); }
  const planetaInk = rebuild(viditelne(obrysPlanety, ([x, y]) => vPrednomPase(x, y)));
  const pasyInk = [-6.5, -2, 4.5].map((y0) => {
    const b = [];
    const x0 = Math.sqrt(r * r - y0 * y0) * 0.9;
    for (let k = 0; k <= 16; k++) { const x = -x0 + (2 * x0 * k) / 16; b.push([x, y0 + 0.4 * Math.sin(k)]); }
    return rebuild(viditelne(b, ([x, y]) => vPrednomPase(x, y)));
  }).join('');
  // Lazúry: celý prstenec, na ňom krycí papier planéty, planéta, predná polovica prstenca.
  const prstenecCely = (e1, e2) => {
    const a = doSveta(vzorkaElipsy(e1)), b = doSveta(vzorkaElipsy(e2)).reverse();
    return lomena(a) + 'Z' + lomena(b) + 'Z';
  };
  const prstenecPredny = (e1, e2) => {
    const pol = (e) => { const b = []; for (let k = 0; k <= 60; k++) { const a = (k / 60) * Math.PI; b.push([Math.cos(a) * e[0], Math.sin(a) * e[1]]); } return b; };
    return lomena([...doSveta(pol(e1)), ...doSveta(pol(e2)).reverse()]) + 'Z';
  };
  const planetaD = kruh(c[0], c[1], r);
  const pasPlanety = (y1, y2) => pas(c[0], c[1], r, c[1] + y1, c[1] + y2);
  return {
    w: [
      { d: prstenecCely(vonkajsi, cassini), farba: 'umber', o: 0.3, evenodd: 1 },
      { d: prstenecCely(cassini, vnutorny), farba: 'ochre', o: 0.42, evenodd: 1 },
      PAP(planetaD),
      W(planetaD, 'ochre', 0.42), W(pasPlanety(-8, -4.5), 'sienna', 0.3), W(pasPlanety(-1, 2.5), 'sienna', 0.22), W(tien(c[0], c[1], r), 'umber', 0.24),
      PAP(prstenecPredny(vonkajsi, vnutorny)),
      W(prstenecPredny(vonkajsi, cassini), 'umber', 0.3), W(prstenecPredny(cassini, vnutorny), 'ochre', 0.42),
    ],
    i: [I(planetaInk, 1), I(pasyInk, 0.45), I(krivkaPrstenca(vonkajsi), 0.8), I(krivkaPrstenca(cassini), 0.45), I(krivkaPrstenca(vnutorny), 0.7)],
    f: [],
  };
}

function uran() {
  const cx = 50, cy = 35, r = 15.5;
  return {
    w: [W(kruh(cx, cy, r), 'turquoise', 0.36), W(kruh(cx, cy, r), 'cerulean', 0.16), W(tien(cx, cy, r), 'payne', 0.2)],
    i: [draha(cx, cy, r), I(kruh(cx, cy, r), 1), I(ciara([[45.6, 21], [44, 35], [45.6, 49]]), 0.45), I(ciara([[55, 21.4], [56.6, 35], [55, 48.6]]), 0.45)],
    f: [F(kruh(50.8, 21.2, 0.9), 'turquoise')],
  };
}

function neptun() {
  const cx = 50, cy = 35, r = 15.5;
  const skvrna = elipsa(45, 31, 3.8, 2.2, -8);
  return {
    w: [W(kruh(cx, cy, r), 'ultramarine', 0.5), W(kruh(cx, cy, r), 'cerulean', 0.2), W(skvrna, 'payne', 0.45), W(tien(cx, cy, r), 'payne', 0.3),
      PAP(elipsa(56, 39.6, 3.6, 0.9, -4)), PAP(elipsa(43.4, 36.2, 2.2, 0.6))],
    i: [draha(cx, cy, r), I(kruh(cx, cy, r), 1), I(skvrna, 0.5), I(ciara([[38.4, 27], [46, 25.4], [56, 26.6]]), 0.45), I(ciara([[40, 44], [50, 46], [60, 44.4]]), 0.45)],
    f: [],
  };
}

/* ══ Trees of the Forest ══════════════════════════════════════════════════ */

function zalud(x, y, uhol, m = 1) {
  const tr = (b) => b.map(([px, py, k]) => { const p = otoc([x + px * m, y + py * m], [x, y], uhol); return [p[0], p[1], k]; });
  const orech = hladka(tr([[-4.2, 2], [-4.4, 7], [-2.6, 11.2], [0, 12.8, 1], [2.6, 11.2], [4.4, 7], [4.2, 2]]));
  const cap = hladka(tr([[-5.2, 2.6, 1], [-5, -0.8], [-2.6, -2.8], [2.6, -2.8], [5, -0.8], [5.2, 2.6, 1], [2, 3.6], [-2, 3.6]]));
  const supiny = [-1.4, 0.8].map((yy) => ciara(tr([[-4.2, yy], [-2.8, yy + 0.9], [-1.4, yy], [0, yy + 0.9], [1.4, yy], [2.8, yy + 0.9], [4.2, yy]]))).join('');
  const stopka = ciara(tr([[0, -2.8], [0.4, -5.6]]));
  return { orech, cap, supiny, stopka, tr };
}

function dub() {
  const env = (s) => Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.02)), 0.7) * (0.55 + 0.45 * s);
  const lob = (s) => 0.34 + 0.66 * Math.pow(Math.abs(Math.sin(Math.PI * 4 * s + 0.3)), 0.5);
  const sir = (s) => 14.5 * env(s) * lob(s);
  const lst = list([18, 60], [56, 8], sir, { n: 96, ohyb: 0.03 });
  const z1 = zalud(72, 38, -12, 1.3), z2 = zalud(85, 43, 10, 1.3);
  const vrch1 = z1.tr([[0, -5.6]])[0], vrch2 = z2.tr([[0, -5.6]])[0];
  const stopka = ciara([[60, 26], [65, 29], [vrch1[0], vrch1[1]]]) + ciara([[65, 29], [76, 32], [vrch2[0], vrch2[1]]]);
  let zilkyD = '';
  for (const s of [0.101, 0.351, 0.601, 0.851]) {
    const p = lst.os(Math.max(0.03, s - 0.05)), q = lst.os(s);
    for (const str of [1, -1]) zilkyD += usecka(p, [q[0] + lst.nn[0] * sir(s) * 0.78 * str, q[1] + lst.nn[1] * sir(s) * 0.78 * str]);
  }
  return {
    w: [W(lst.obrys, 'sap', 0.5), W(lst.polovica, 'olive', 0.26), W(elipsa(47, 21, 4, 2.6, -50), 'ochre', 0.22),
      W(z1.orech, 'ochre', 0.55), W(z2.orech, 'ochre', 0.5), W(z1.orech, 'sienna', 0.18), W(z1.cap, 'umber', 0.45), W(z2.cap, 'umber', 0.45),
      WS(stopka, 'sap', 0.4, 1.8)],
    i: [I(lst.obrys, 0.9), I(lst.stred + usecka([18, 60], [14.6, 64.4]), 0.8), I(zilkyD, 0.45), I(stopka, 0.7),
      I(z1.orech, 0.7), I(z1.cap, 0.75), I(z1.supiny, 0.4), I(z2.orech, 0.7), I(z2.cap, 0.75), I(z2.supiny, 0.4)],
    f: [F(kruh(...z1.tr([[0, 12.9]])[0].slice(0, 2), 0.55), 'umber'), F(kruh(...z2.tr([[0, 12.9]])[0].slice(0, 2), 0.55), 'umber')],
  };
}

function breza() {
  const vetvicka = [[4, 14], [28, 17.4], [54, 22.6], [84, 24.6], [97, 23.6]];
  const env = (s) => (s < 0.28 ? Math.pow(s / 0.28, 0.55) : Math.pow((1 - s) / 0.72, 1.15));
  const l1 = list([34, 26], [38, 58], (s) => 10.5 * env(s), { zuby: 13, amp: 0.1, ohyb: 0.03 });
  const l2 = list([62, 30], [73, 55], (s) => 8.2 * env(s), { zuby: 11, amp: 0.11, ohyb: -0.04 });
  const jahnada = list([88, 26], [90, 56], (s) => 2.5 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.15 + s * 0.9)), 0.4), { n: 20 });
  let supinky = '';
  for (let k = 0; k < 9; k++) {
    const s = 0.1 + k * 0.095, p = jahnada.os(s);
    supinky += ciara([[p[0] - 2, p[1] - 0.6], [p[0], p[1] + 0.9], [p[0] + 2, p[1] - 0.6]]);
  }
  return {
    w: [W(l1.obrys, 'sap', 0.46), W(l1.obrys, 'lemon', 0.18), W(l1.polovica, 'olive', 0.18), W(l2.obrys, 'sap', 0.46), W(l2.obrys, 'lemon', 0.2),
      W(jahnada.obrys, 'ochre', 0.45), W(jahnada.obrys, 'umber', 0.2), WS(ciara(vetvicka), 'umber', 0.4, 1.6)],
    i: [I(ciara(vetvicka), 0.9), I(ciara([[33, 18.2], [33.4, 22], [34, 26]]), 0.6), I(ciara([[60.6, 23.4], [61, 26.6], [62, 30]]), 0.6),
      I(ciara([[87.4, 24.4], [87.8, 25.4], [88, 26]]), 0.6),
      I(l1.obrys, 0.8), I(l1.stred, 0.6), I(zilky(l1, 6, { od: 0.1, po: 0.76, sklon: 0.14 }), 0.4),
      I(l2.obrys, 0.8), I(l2.stred, 0.6), I(zilky(l2, 5, { od: 0.1, po: 0.74, sklon: 0.14 }), 0.4),
      I(jahnada.obrys, 0.7), I(supinky, 0.4),
      I(usecka([14, 15.2], [14.6, 17]) + usecka([46, 20.6], [46.4, 22.4]) + usecka([74, 23.8], [74.2, 25.6]), 0.5)],
    f: [],
  };
}

function buk() {
  const vetvicka = [[3, 62], [22, 57], [44, 58.4], [70, 56.4], [97, 60]];
  const env = (s) => Math.pow(Math.sin(Math.PI * s), 0.75) * (0.8 + 0.2 * Math.sin(Math.PI * s * 0.9));
  const sir = (s) => 12 * env(s) * (1 + 0.045 * Math.sin(Math.PI * 2 * 8 * s));
  const lst = list([20, 52], [58, 10], sir, { n: 64, ohyb: 0.04 });
  // Otvorená bukvica: štyri chlopne ako kalich, v strede dva trojboké oriešky.
  const zaklad = [80, 51.6];
  const uhly = [-170, -137, -43, -10];
  const chlopne = uhly.map((uh) => {
    const tr = (b) => b.map(([x, y, k]) => { const p = otoc([zaklad[0] + x, zaklad[1] + y], zaklad, uh); return [p[0], p[1], k]; });
    return hladka(tr([[0, 0, 1], [4, -2.2], [10, -3], [15, -1.4], [17, 0, 1], [15, 1.4], [10, 3], [4, 2.2]]));
  });
  let trne = '';
  uhly.forEach((uh) => {
    for (let k = 0; k < 5; k++) {
      const x = 4.6 + k * 2.4;
      for (const str of [-1, 1]) {
        const y = str * (2.4 + (k === 2 ? 0.4 : 0) - (k === 4 ? 0.9 : 0));
        const a = otoc([zaklad[0] + x, zaklad[1] + y], zaklad, uh), b = otoc([zaklad[0] + x + 0.8, zaklad[1] + y + str * 1.5], zaklad, uh);
        trne += usecka(a, b);
      }
    }
  });
  const orech1 = hladka([[75.4, 49.6, 1], [77.8, 37.6, 1], [80.2, 49.8, 1]]);
  const orech2 = hladka([[79.4, 49.8, 1], [82.4, 38.4, 1], [84.6, 49.6, 1]]);
  const hrany = usecka([77.8, 38.4], [78, 49]) + usecka([82.4, 39.2], [82.2, 49]);
  return {
    w: [W(lst.obrys, 'sap', 0.48), W(lst.polovica, 'viridian', 0.18), ...chlopne.map((d) => W(d, 'umber', 0.38)),
      W(orech1, 'sienna', 0.6), W(orech2, 'sienna', 0.5), WS(ciara(vetvicka), 'umber', 0.4, 1.8)],
    i: [I(ciara(vetvicka), 0.9), I(ciara([[22, 57], [20.6, 54.6], [20, 52]]), 0.7), I(ciara([[72, 56.2], [76, 54.2], [80, 51.6]]), 0.7),
      I(lst.obrys, 0.85), I(lst.stred, 0.65), I(zilky(lst, 8, { od: 0.1, po: 0.84, sklon: 0.1, dlzka: 0.88 }), 0.42),
      ...chlopne.map((d) => I(d, 0.65)), I(trne, 0.38), I(orech1, 0.7), I(orech2, 0.7), I(hrany, 0.35)],
    f: [],
  };
}

function borovica() {
  const vetva = [[8, 12], [26, 22], [44, 30], [64, 34], [94, 36]];
  const osV = (t) => {
    const k = Math.min(vetva.length - 2, Math.floor(t * (vetva.length - 1)));
    const u = t * (vetva.length - 1) - k, a = vetva[k], b = vetva[k + 1];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  };
  const nah = rozptyl(5);
  let ihlice = '';
  for (let k = 0; k < 11; k++) {
    const t = 0.05 + k * 0.085, p = osV(t);
    for (const str of [-1, 1]) {
      const uh = (str < 0 ? -58 : 62) + (nah() - 0.5) * 14, dl = 13 + nah() * 5;
      const a = (uh * Math.PI) / 180 + 0.35;
      const q = [p[0] + Math.cos(a) * dl, p[1] + Math.sin(a) * dl * (str < 0 ? 1 : 1)];
      const m = [p[0] + Math.cos(a) * dl * 0.5 + str * 0.8, p[1] + Math.sin(a) * dl * 0.5 - 0.6];
      ihlice += ciara([p, m, q]);
      const q2 = [q[0] + 1.6 * str, q[1] + 0.8];
      ihlice += ciara([p, [m[0] + 0.9 * str, m[1] + 0.5], q2]);
    }
  }
  // Šiška visí pod vetvou, šupiny v posunutých radoch.
  const c = [50, 50], rx = 8.4, ry = 13.2, uhol = 12;
  const tr = (b) => b.map(([x, y, kk]) => { const p = otoc([c[0] + x, c[1] + y], c, uhol); return [p[0], p[1], kk]; });
  const sisObrys = hladka(tr([[0, -ry], [rx * 0.8, -ry * 0.7], [rx, -ry * 0.1], [rx * 0.86, ry * 0.5], [rx * 0.4, ry * 0.92], [0, ry, 1], [-rx * 0.4, ry * 0.92], [-rx * 0.86, ry * 0.5], [-rx, -ry * 0.1], [-rx * 0.8, -ry * 0.7]]));
  let supiny = '';
  for (let rad = 0; rad < 7; rad++) {
    const y = -ry * 0.72 + rad * 3.6;
    const sirka = rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)) * 0.95;
    const n = Math.max(2, Math.round(sirka / 2.2));
    const krok = (2 * sirka) / n, pos = rad % 2 ? krok / 2 : 0;
    for (let k = 0; k < n; k++) {
      const x = -sirka + pos + k * krok;
      if (x + krok > sirka + 0.5) break;
      supiny += ciara(tr([[x, y], [x + krok / 2, y + 2.2], [x + krok, y]]));
    }
  }
  const stopka = ciara([[46, 31.6], [47.4, 34.6], [48, 37]]);
  return {
    w: [WS(ihlice, 'sap', 0.5, 1.4), WS(ihlice, 'viridian', 0.25, 0.9), W(sisObrys, 'umber', 0.5), W(sisObrys, 'sienna', 0.25),
      W(hladka(tr([[2, -ry * 0.8], [rx * 0.8, -ry * 0.5], [rx * 0.9, ry * 0.4], [rx * 0.3, ry * 0.9], [3, 0]])), 'umber', 0.2), WS(ciara(vetva), 'umber', 0.45, 2.4)],
    i: [I(ciara(vetva), 1), I(ihlice, 0.35), I(stopka, 0.8), I(sisObrys, 0.8), I(supiny, 0.5)],
    f: [],
  };
}

function vrba() {
  const vetva = [[6, 8], [28, 17], [52, 28], [76, 42], [95, 58]];
  const bodV = (t) => {
    const k = Math.min(vetva.length - 2, Math.floor(t * (vetva.length - 1)));
    const u = t * (vetva.length - 1) - k, a = vetva[k], b = vetva[k + 1];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  };
  const listy = [];
  const polohy = [[0.12, 1, 28], [0.24, -1, 26], [0.37, 1, 29], [0.5, -1, 27], [0.63, 1, 27], [0.76, -1, 24], [0.88, 1, 20]];
  for (const [t, str, dl] of polohy) {
    const p = bodV(t);
    const uh = str > 0 ? 100 : 18;
    const a = (uh * Math.PI) / 180;
    const b = [p[0] + Math.cos(a) * dl, p[1] + Math.sin(a) * dl];
    const env = (s) => Math.pow(Math.sin(Math.PI * s), 0.85) * (s < 0.35 ? 0.75 + s * 0.7 : 1);
    listy.push(list(p, b, (s) => 3.3 * env(s), { zuby: 8, amp: 0.05, ohyb: str * 0.06 }));
  }
  return {
    // Malé listy sa spájajú do jednej cesty na vrstvu: menej uzlov v DOM, pero ich kreslí po jednom.
    w: [W(spoj(listy.filter((_, k) => !(k % 2)), 'obrys'), 'sap', 0.46), W(spoj(listy.filter((_, k) => k % 2), 'obrys'), 'olive', 0.46),
      W(spoj(listy.filter((_, k) => !(k % 2)), 'polovica'), 'viridian', 0.14), W(spoj(listy.filter((_, k) => k % 2), 'polovica'), 'payne', 0.14),
      WS(ciara(vetva), 'umber', 0.4, 1.8), WS(ciara(vetva), 'ochre', 0.25, 1)],
    i: [I(ciara(vetva), 0.9), I(spoj(listy, 'obrys'), 0.7), I(spoj(listy, 'stred'), 0.45)],
    f: [],
  };
}

function javor() {
  const c = [36, 38];
  const laloky = [[-90, 19.5, 17], [-148, 17, 16], [-32, 17, 16], [-205, 11.5, 14], [25, 11.5, 14]];
  const nah = rozptyl(17);
  const zub = [];
  for (let k = 0; k < 200; k++) zub.push(nah());
  const polomer = (stupne) => {
    let r = 6.2;
    for (const [s, A, sig] of laloky) {
      let d = Math.abs(((stupne - s + 540) % 360) - 180);
      r += A * Math.exp(-d / sig);
    }
    return r;
  };
  const body = [];
  const N = 180;
  for (let k = 0; k < N; k++) {
    const st = -270 + 5 + (k * 350) / N; // okolo, s medzerou dole pre stopku
    let r = polomer(st);
    if (k % 6 === 3) r *= 1.05 + zub[k] * 0.03; else if (k % 6 === 0) r *= 0.97;
    const a = (st * Math.PI) / 180;
    body.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
  }
  body.push([c[0] + 0.6, c[1] + 4.4], [c[0] - 0.6, c[1] + 4.4]);
  const obrys = lomena(body) + 'Z';
  let zily = '';
  for (const [s, A] of laloky) {
    const a = (s * Math.PI) / 180, r = 6.2 + A * 0.94;
    zily += ciara([[c[0], c[1] + 2], [c[0] + Math.cos(a) * r * 0.5 + Math.cos(a + 1.57) * 0.6, c[1] + Math.sin(a) * r * 0.5], [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]]);
  }
  const stopka = ciara([[c[0], c[1] + 4], [c[0] + 1.4, c[1] + 14], [c[0] + 4, c[1] + 25]]);
  // Nažka: dve semená s krídlami, spojené do písmena V.
  const kridlo = (x, y, uh, str) => {
    const m = 1.3;
    const tr = (b) => b.map(([px, py, kk]) => { const p = otoc([x + px * m, y + py * str * m], [x, y], uh); return [p[0], p[1], kk]; });
    return {
      obrys: hladka(tr([[0, 0, 1], [3, -2.6], [9, -4.4], [16, -4.8], [20.4, -3], [19, 0.2], [13, 1.6], [6, 2.4], [2.4, 2.6]])),
      seme: hladka(tr([[-0.6, -1.8], [2.8, -2.6], [4.8, -0.2], [2.8, 2.4], [-0.4, 1.8]])),
      zilky: ciara(tr([[4.6, -1.2], [11, -2.4], [18, -2.8]])) + ciara(tr([[5, 0.6], [11.6, -0.4], [17.4, -1]])),
    };
  };
  const k1 = kridlo(76, 56, -112, 1), k2 = kridlo(78, 56.6, -64, -1);
  return {
    w: [W(obrys, 'vermilion', 0.42), W(obrys, 'ochre', 0.32), W(kruh(c[0] - 3, c[1] - 3, 7.5), 'alizarin', 0.16),
      W(k1.obrys, 'ochre', 0.4), W(k2.obrys, 'ochre', 0.4), W(k1.seme, 'sienna', 0.45), W(k2.seme, 'sienna', 0.45), WS(stopka, 'alizarin', 0.35, 1.6)],
    i: [I(obrys, 0.8), I(zily, 0.5), I(stopka, 0.75), I(k1.obrys, 0.7), I(k2.obrys, 0.7), I(k1.seme, 0.6), I(k2.seme, 0.6), I(k1.zilky + k2.zilky, 0.35),
      I(ciara([[77, 55.4], [77.8, 51], [80, 46.4]]), 0.6)],
    f: [],
  };
}

function gastan() {
  const env = (s) => Math.pow(Math.sin(Math.PI * s), 0.62) * (s < 0.2 ? 0.8 + s : 1);
  const lst = list([9, 60], [60, 9], (s) => 8.6 * env(s), { zuby: 17, amp: 0.13, ohyb: 0.05 });
  const c = [76, 50], r = 9.6;
  const nah = rozptyl(29);
  let bodliny = '';
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * Math.PI * 2;
    const st = (a * 180) / Math.PI;
    if (st > 212 && st < 330) continue;
    const r1 = r - 1.2 + nah() * 1.2, r2 = r + 2.2 + nah() * 1.8, sk = (nah() - 0.5) * 0.35;
    bodliny += usecka([c[0] + Math.cos(a) * r1, c[1] + Math.sin(a) * r1], [c[0] + Math.cos(a + sk) * r2, c[1] + Math.sin(a + sk) * r2]);
  }
  for (let k = 0; k < 16; k++) {
    const a = nah() * Math.PI * 2, q = nah() * (r - 2.4);
    const p = [c[0] + Math.cos(a) * q, c[1] + Math.sin(a) * q];
    if (p[1] < c[1] - 3) continue;
    bodliny += usecka(p, [p[0] + (nah() - 0.5) * 2.4, p[1] - 1.6 - nah()]);
  }
  const orech = hladka([[70.4, 43.4], [71.2, 37.4], [74.4, 33.6], [76.6, 30.8, 1], [78.6, 33.6], [82.2, 37.2], [83, 43.2], [76.8, 45]]);
  const svetla = hladka([[71.4, 43.2], [76.6, 44.8], [82.4, 43], [81.8, 45.6], [76.6, 46.8], [71.8, 45.6]]);
  return {
    w: [W(lst.obrys, 'sap', 0.48), W(lst.polovica, 'viridian', 0.2), W(kruh(c[0], c[1], r + 1), 'sap', 0.32), W(kruh(c[0], c[1], r + 1), 'ochre', 0.28),
      W(orech, 'sienna', 0.62), W(orech, 'umber', 0.28), W(svetla, 'ochre', 0.3)],
    i: [I(lst.obrys, 0.8), I(lst.stred + usecka([9, 60], [6.4, 63.4]), 0.7), I(zilky(lst, 13, { od: 0.07, po: 0.9, sklon: 0.06, dlzka: 0.98 }), 0.38),
      I(bodliny, 0.4), I(orech, 0.75), I(ciara([[74.8, 36], [74, 40.4], [74.6, 43.6]]), 0.35), I(ciara([[62, 28], [68, 36], [72, 42]]), 0.6)],
    f: [],
  };
}

function jasen() {
  const rachis = [[6, 62], [22, 50], [38, 38], [52, 27], [64, 17]];
  const bodR = (t) => {
    const k = Math.min(rachis.length - 2, Math.floor(t * (rachis.length - 1)));
    const u = t * (rachis.length - 1) - k, a = rachis[k], b = rachis[k + 1];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  };
  const env = (s) => Math.pow(Math.sin(Math.PI * s), 0.7) * (s < 0.3 ? 0.7 + s : 1);
  const listky = [];
  for (const [t, dl] of [[0.3, 15], [0.5, 16], [0.7, 15], [0.88, 13]]) {
    const p = bodR(t);
    for (const [uh, str] of [[-128, 1], [22, -1]]) {
      const a = (uh * Math.PI) / 180;
      listky.push(list(p, [p[0] + Math.cos(a) * dl, p[1] + Math.sin(a) * dl], (s) => 3.4 * env(s), { zuby: 7, amp: 0.1, ohyb: 0.05 * str }));
    }
  }
  const koniec = bodR(1);
  listky.push(list(koniec, [koniec[0] + 9, koniec[1] - 12], (s) => 3.6 * env(s), { zuby: 7, amp: 0.1 }));
  // Nažky (kľúče) visia v strapci.
  const kluc = (x, y, uh) => {
    const tr = (b) => b.map(([px, py, kk]) => { const p = otoc([x + px, y + py], [x, y], uh); return [p[0], p[1], kk]; });
    return { obrys: hladka(tr([[0, 0, 1], [1.8, 2], [2.4, 8], [2, 14], [0.4, 17.4, 1], [-1.4, 14], [-1.6, 8], [-1.2, 2]])), seme: hladka(tr([[0, 1.2], [1.1, 3], [1, 6.4], [0, 7.4], [-0.9, 6.4], [-0.8, 3]])) };
  };
  const vrcholy = [[77, 30, 26], [81, 31.6, 9], [85, 31.2, -8], [89, 29.4, -24]];
  const kluce = vrcholy.map(([x, y, u]) => kluc(x, y, u));
  const stopky = ciara([[58.4, 21.8], [70, 21.6], [83, 26.4]]) + vrcholy.map(([x, y]) => ciara([[83, 26.4], [(83 + x) / 2, 27.2], [x, y]])).join('');
  return {
    w: [W(spoj(listky.filter((_, k) => k % 3 === 0), 'obrys'), 'olive', 0.46), W(spoj(listky.filter((_, k) => k % 3 !== 0), 'obrys'), 'sap', 0.46), W(spoj(listky, 'polovica'), 'viridian', 0.14),
      ...kluce.map((k) => W(k.obrys, 'ochre', 0.4)), ...kluce.map((k) => W(k.seme, 'sap', 0.35)), WS(ciara(rachis), 'olive', 0.4, 1.8)],
    i: [I(ciara(rachis), 0.9), I(spoj(listky, 'obrys'), 0.65), I(spoj(listky, 'stred'), 0.4), I(spoj(kluce, 'obrys'), 0.6), I(spoj(kluce, 'seme'), 0.4), I(stopky, 0.6)],
    f: [],
  };
}

function tis() {
  const vetva = [[5, 48], [26, 38], [50, 31], [74, 28], [96, 29]];
  const bodV = (t) => {
    const k = Math.min(vetva.length - 2, Math.floor(t * (vetva.length - 1)));
    const u = t * (vetva.length - 1) - k, a = vetva[k], b = vetva[k + 1];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, Math.atan2(b[1] - a[1], b[0] - a[0])];
  };
  const ihlice = [];
  for (let k = 0; k < 17; k++) {
    const t = 0.04 + k * 0.057, [x, y, smer] = bodV(t);
    for (const str of [-1, 1]) {
      const uh = smer + str * (1.05 - t * 0.25), dl = 10.5 - Math.abs(t - 0.5) * 5;
      const b = [x + Math.cos(uh) * dl, y + Math.sin(uh) * dl];
      ihlice.push(list([x, y], b, (s) => 1.25 * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.08)), 0.35), { n: 5, lomeny: true }));
    }
  }
  const mieska = (x, y, r) => ({
    obal: hladka([[x - r, y - r * 0.2], [x - r * 0.72, y + r * 0.7], [x, y + r], [x + r * 0.72, y + r * 0.7], [x + r, y - r * 0.2], [x + r * 0.55, y - r * 0.85], [x, y - r * 0.95], [x - r * 0.55, y - r * 0.85]]),
    otvor: elipsa(x, y + r * 0.25, r * 0.42, r * 0.36),
    stopka: ciara([[x, y - r * 0.95], [x - 0.3, y - r * 1.4], [x - 0.8, y - r * 1.9]]),
  });
  const m1 = mieska(38, 52, 4.4), m2 = mieska(56, 47, 4.1);
  return {
    w: [W(spoj(ihlice, 'obrys'), 'viridian', 0.55), W(spoj(ihlice, 'polovica'), 'payne', 0.12), W(m1.obal, 'vermilion', 0.7), W(m2.obal, 'vermilion', 0.7),
      W(m1.obal, 'alizarin', 0.25), W(m2.obal, 'alizarin', 0.2), WS(ciara(vetva), 'umber', 0.45, 2)],
    i: [I(ciara(vetva), 0.9), I(spoj(ihlice, 'obrys'), 0.45), I(m1.obal, 0.7), I(m2.obal, 0.7), I(m1.stopka + m2.stopka, 0.6)],
    f: [F(m1.otvor, 'payne'), F(m2.otvor, 'payne'), PAP(kruh(36.6, 50, 0.8)), PAP(kruh(54.8, 45.2, 0.75))],
  };
}

function cezmina() {
  const ostny = (a, b, pocet, sirka) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], nn = [-u[1], u[0]];
    const os = (s) => [a[0] + u[0] * L * s, a[1] + u[1] * L * s];
    const sir = (s) => sirka * Math.pow(Math.sin(Math.PI * s), 0.7);
    const lava = [], prava = [];
    const n = pocet * 2;
    for (let k = 1; k < n; k++) {
      const s = k / n, p = os(s), hrot = k % 2 === 1;
      const w = sir(s) * (hrot ? 1.28 : 0.72), posun = hrot ? 0.035 : 0;
      const q = os(s + posun);
      lava.push([q[0] + nn[0] * w, q[1] + nn[1] * w, hrot ? 1 : 0]);
      prava.push([q[0] - nn[0] * w, q[1] - nn[1] * w, hrot ? 1 : 0]);
      void p;
    }
    const obrys = hladka([[a[0], a[1], 1], ...lava, [b[0] + u[0] * 2, b[1] + u[1] * 2, 1], ...prava.reverse()]);
    const stred = [];
    for (let k = 0; k <= 10; k++) stred.push(os((k / 10) * 0.96));
    return { obrys, stred: ciara(stred), lesk: ciara([os(0.25), [os(0.45)[0] + nn[0] * sirka * 0.4, os(0.45)[1] + nn[1] * sirka * 0.4], os(0.7)]) };
  };
  const l1 = ostny([46, 44], [12, 12], 4, 9.4);
  const l2 = ostny([52, 44], [90, 26], 4, 8.6);
  const bobule = [[43.6, 51.6, 4.3], [52, 50.6, 4.2], [47.6, 58.4, 4.1]];
  return {
    w: [W(l1.obrys, 'viridian', 0.56), W(l1.obrys, 'sap', 0.16), W(l2.obrys, 'viridian', 0.56), W(l2.obrys, 'sap', 0.2),
      ...bobule.map(([x, y, r]) => W(kruh(x, y, r), 'vermilion', 0.72)), ...bobule.map(([x, y, r]) => W(tien(x, y, r, 0.4), 'alizarin', 0.35)),
      WS(l1.lesk + l2.lesk, 'papier', 0.9, 1.2)],
    i: [I(l1.obrys, 0.8), I(l1.stred, 0.55), I(l2.obrys, 0.8), I(l2.stred, 0.55), ...bobule.map(([x, y, r]) => I(kruh(x, y, r), 0.75)),
      I(ciara([[46, 44], [47, 46.4], [47.6, 48]]) + ciara([[52, 44], [51, 46]]), 0.6)],
    f: [...bobule.map(([x, y, r]) => F(kruh(x + r * 0.15, y + r * 0.62, 0.55), 'ink')), ...bobule.map(([x, y, r]) => PAP(kruh(x - r * 0.38, y - r * 0.38, 0.8)))],
  };
}

/* ══ Birds of Europe ══════════════════════════════════════════════════════ */

const oko = (x, y, r = 1.3) => [F(kruh(x, y, r), 'ink'), PAP(kruh(x + r * 0.32, y - r * 0.32, r * 0.32))];
const posun = (body, dx, dy) => body.map(([x, y, k]) => [x + dx, y + dy, k]);

function cervienka() {
  const vetvicka = [[3, 58], [30, 57], [60, 59], [97, 55]];
  const obrys = hladka([[21.6, 27.4, 1], [27.4, 25.4], [29.8, 21.6], [35.6, 19], [42, 20.6], [50, 24.6], [58, 29.6], [63.4, 35], [74, 40.8], [79.4, 43.8, 1], [77.4, 47.2, 1], [65, 44.6], [58, 49.2], [48, 52.4], [42.4, 52.4], [35, 49.4], [30, 43.4], [27, 35.4], [26.4, 29.8], [26.8, 28.6, 1]]);
  const hrud = hladka([[27.6, 25.2], [30.6, 22.6], [34.4, 25.6], [37.6, 30.4], [40.4, 36.6], [41, 43.4], [38.4, 49.2], [34.6, 48.6], [30.2, 43], [27.4, 35.4], [26.6, 29.6]]);
  const vrch = hladka([[29.8, 21.6], [35.6, 19], [42, 20.6], [50, 24.6], [58, 29.6], [63.4, 35], [74, 40.8], [79.4, 43.8, 1], [77.4, 47.2, 1], [65, 44.6], [58, 45], [50, 40.6], [42.4, 33], [36.4, 27.4], [32.6, 23.6]]);
  const kridlo = hladka([[44, 30], [52, 30.2], [60, 35], [66.4, 41.4], [60, 43.4], [50.4, 42.4], [45, 37.4]]);
  const perie = ciara([[55.4, 39], [58, 41.6]]) + ciara([[59, 38.6], [62, 41.8]]) + ciara([[51.6, 39.4], [53.8, 42.2]]);
  const nohy = ciara([[44, 52.2], [43.4, 55.4], [42.6, 57.8]]) + ciara([[48, 51.8], [48.4, 55], [48.6, 58.2]]) + usecka([40.4, 58.4], [45, 57.8]) + usecka([46.6, 58.4], [51, 58.6]);
  return {
    w: [W(obrys, 'payne', 0.08), W(vrch, 'umber', 0.4), W(vrch, 'olive', 0.22), W(hrud, 'vermilion', 0.55), W(hrud, 'ochre', 0.3), W(kridlo, 'umber', 0.3),
      W(hladka([[21.6, 27.4, 1], [26.8, 25.6], [26.6, 28.8]]), 'umber', 0.6), WS(ciara(vetvicka), 'umber', 0.45, 2.2), WS(nohy, 'sienna', 0.4, 1.2)],
    i: [I(obrys, 1), I(hrud, 0.45), I(kridlo, 0.6), I(perie, 0.45), I(usecka([22.4, 27.6], [26.6, 27.6]), 0.5), I(ciara(vetvicka), 1), I(nohy, 0.6)],
    f: oko(32.2, 26.4, 1.45),
  };
}

function oriesok() {
  const kamen = hladka([[16, 70], [20, 61.6], [30, 57.4], [48, 56.4], [64, 57.2], [78, 60.6], [84, 70]], false);
  const obrys = hladka([[72, 33, 1], [66.4, 31.6], [64, 28.8], [59, 26.8], [53, 27.6], [46, 29.6], [41, 28], [38, 21], [37, 15.6, 1], [33.4, 16.4, 1], [34.6, 23], [36.4, 32], [37.2, 38.4], [40.2, 46], [48, 50.6], [56, 49.2], [62, 44.6], [65.6, 38.6], [66.2, 34.4], [66.8, 33.6, 1]]);
  const vrch = hladka([[64, 28.8], [59, 26.8], [53, 27.6], [46, 29.6], [41, 28], [38, 21], [37, 15.6, 1], [33.4, 16.4, 1], [34.6, 23], [36.4, 32], [37.2, 38.4], [40.2, 45], [46, 42], [51, 37], [56, 33.4], [61.6, 31.4]]);
  const kridlo = hladka([[42, 33], [48, 32.4], [54, 35], [52, 40.4], [45, 43], [40.6, 40]]);
  let pruhy = '';
  for (let k = 0; k < 5; k++) pruhy += usecka([34.6 + k * 0.3, 19 + k * 2.6], [37.6 + k * 0.4, 18.6 + k * 2.6]);
  for (let k = 0; k < 4; k++) pruhy += usecka([43 + k * 2.5, 34 + k * 0.6], [42 + k * 2.5, 37.4 + k * 0.6]);
  for (let k = 0; k < 3; k++) pruhy += usecka([44 + k * 3, 45.4 - k * 0.4], [46 + k * 3, 46.4 - k * 0.4]);
  const mach = hladka([[26, 58.6], [34, 56.2], [44, 55.8], [50, 57.4], [40, 58.8], [30, 59.8]]);
  const nohy = ciara([[47, 50.4], [46.4, 54], [45.4, 57]]) + ciara([[51.4, 50.2], [52, 53.6], [52.6, 56.8]]) + usecka([43, 57.2], [47.4, 56.8]) + usecka([50.6, 57], [55, 57.2]);
  return {
    w: [W(obrys, 'ochre', 0.36), W(vrch, 'umber', 0.46), W(vrch, 'sienna', 0.2), W(kridlo, 'umber', 0.25),
      WS(ciara([[60, 29.6], [56, 29.8], [52.4, 30.6]]), 'papier', 1, 1.3), W(kamen + 'Z', 'payne', 0.16), W(mach, 'sap', 0.5), WS(nohy, 'sienna', 0.4, 1.1)],
    i: [I(obrys, 1), I(kridlo, 0.55), I(pruhy, 0.42), I(ciara([[60, 29.6], [56, 29.8], [52.4, 30.6]]), 0.35), I(usecka([67, 33.2], [71.4, 33.1]), 0.45), I(kamen, 0.9), I(mach, 0.45), I(nohy, 0.6)],
    f: oko(61.4, 31.2, 1.25),
  };
}

function straka() {
  const obrys = hladka([[9.6, 25.6, 1], [16, 23.2], [18.6, 20], [23, 18], [28, 19.4], [38, 25], [50, 32], [70, 36.6], [95, 40, 1], [95.6, 43.6, 1], [72, 41.8], [54, 40.6], [44, 43.2], [36, 42.6], [27, 37.2], [19.6, 30.6], [16.8, 27.2], [16, 26.6, 1]]);
  const brucho = hladka([[31.6, 36.6], [37.6, 33.4], [45, 34.2], [51, 38], [49.6, 41.8], [44, 42.8], [36, 42], [30.4, 39.2]]);
  const plece = hladka([[32.6, 26.6], [40, 27.2], [46.6, 30.6], [43.4, 32.4], [36.6, 31.4]]);
  const kridlo = hladka([[44.6, 31.6], [52, 33], [63, 37], [57, 39.6], [48, 37.6]]);
  const chvost = hladka([[62, 37.4], [95, 40.4], [95.2, 43], [64, 41]]);
  const nohy = ciara([[38, 42.8], [37.4, 46.8], [36.8, 50.4]]) + ciara([[42, 43], [42.4, 47], [42.8, 50.6]]) + usecka([34.4, 50.8], [39, 50.4]) + usecka([40.6, 50.8], [45, 51]);
  return {
    w: [W(obrys, 'payne', 0.62), W(chvost, 'viridian', 0.32), W(chvost, 'ultramarine', 0.18), W(kridlo, 'ultramarine', 0.36), W(kridlo, 'viridian', 0.2),
      PAP(brucho), PAP(plece), W(brucho, 'payne', 0.06), WS(ciara([[18, 51.4], [44, 50.6], [70, 52.6]]), 'umber', 0.45, 2.2)],
    i: [I(obrys, 1), I(brucho, 0.6), I(plece, 0.6), I(kridlo, 0.5), I(usecka([66, 38.8], [94, 41.8]), 0.4), I(usecka([10.6, 25.8], [16.4, 25.4]), 0.45),
      I(ciara([[18, 51.4], [44, 50.6], [70, 52.6]]), 1), I(nohy, 0.6)],
    f: [F(kruh(19.8, 23.6, 1.3), 'ink'), PAP(kruh(20.2, 23.2, 0.45))],
  };
}

function volavka() {
  const obrys = hladka([[11.6, 17.4, 1], [24, 13.8], [26, 11.4], [29, 10.2], [32, 12.8], [31.4, 18], [30.4, 24], [33, 30], [40, 33], [52, 35.8], [64, 44, 1], [60, 46.2], [50, 48], [42, 46], [36, 41], [31, 35], [27.2, 27], [27.4, 20.4], [26.6, 16.8], [24.6, 16.4, 1]]);
  const chrbat = hladka([[38.4, 32.8], [52, 35.6], [64, 44, 1], [58, 45.6], [48, 43.4], [40.4, 38.4]]);
  const zobak = hladka([[11.6, 17.4, 1], [24, 13.8], [24.6, 16.4, 1]]);
  const pruh = hladka([[26.6, 13], [29.4, 11.2], [32, 11.6], [40.4, 12.6, 1], [32.4, 13.4], [29, 14.2]]);
  const voda = hladka([[4, 70], [4, 63.4], [20, 62.6], [40, 63.6], [62, 62.6], [96, 63.6], [96, 70]]);
  const nohy = ciara([[48.6, 47.8], [47.8, 56], [46.8, 64]]) + ciara([[53, 47.4], [54.8, 56], [56, 64.4]]);
  let pasiky = '';
  for (let k = 0; k < 3; k++) pasiky += usecka([28.2 + k * 0.4, 22 + k * 4.4], [28.9 + k * 0.5, 23.6 + k * 4.4]);
  return {
    w: [W(obrys, 'payne', 0.1), W(chrbat, 'payne', 0.34), W(chrbat, 'ultramarine', 0.08), W(zobak, 'ochre', 0.62), W(zobak, 'lemon', 0.3), W(pruh, 'payne', 0.7),
      W(voda, 'cerulean', 0.2), WS(nohy, 'ochre', 0.45, 1.8)],
    i: [I(obrys, 0.95), I(chrbat, 0.5), I(pruh, 0.5), I(usecka([12.6, 17.2], [24.2, 15.4]), 0.45), I(pasiky, 0.45), I(nohy, 0.8),
      I(ciara([[30, 64], [40, 63.2], [52, 64.4]]) + ciara([[57, 65.8], [66, 65], [78, 65.8]]) + ciara([[18, 67.4], [27, 66.8]]), 0.45),
      I(ciara([[40, 33], [46, 38], [52, 40.6], [60, 43.6]]), 0.35)],
    f: oko(27, 13.6, 0.9),
  };
}

function lastovicka() {
  const obrys = hladka([[21.6, 33.8, 1], [26.6, 30.6], [31, 29.8], [40, 31.8], [52, 35], [58, 36.6], [86, 32.4, 1], [60.6, 38.8], [62.4, 40.2, 1], [84.6, 48, 1], [59.6, 41.8], [54, 40.8], [44, 40.8], [34, 40], [27.6, 37.6], [24.4, 35.4]]);
  const kridloZadne = hladka([[35.4, 31.6], [33.2, 23], [35.4, 13], [40.6, 3.4, 1], [42.4, 12.4], [44, 22], [44.6, 31.2]]);
  const kridloPredne = hladka([[42.4, 31.6], [50, 22.4], [62, 14.2], [82.4, 6.6, 1], [70.6, 16.4], [58.4, 26.4], [51.6, 34]]);
  const vrch = hladka([[24, 32.4], [26.6, 30.6], [31, 29.8], [40, 31.8], [52, 35], [58, 36.6], [86, 32.4, 1], [60.6, 38.8], [62.4, 40.2, 1], [84.6, 48, 1], [59.6, 41.8], [54, 39.4], [44, 36.4], [34, 35], [28, 34.6]]);
  const hrdlo = hladka([[22.6, 33.6], [25.4, 31.8], [27.6, 33], [28.4, 35.4], [30.6, 37.6], [27.4, 37.6], [24.4, 35.4]]);
  const perie = ciara([[38, 12], [40.8, 20]]) + ciara([[36.6, 18], [39.4, 26]]) + ciara([[64, 17.4], [58, 24]]) + ciara([[72, 12.8], [64.4, 20.2]]);
  return {
    w: [W(obrys, 'ochre', 0.14), W(vrch, 'ultramarine', 0.5), W(vrch, 'payne', 0.3), W(kridloZadne, 'ultramarine', 0.38), W(kridloZadne, 'payne', 0.34),
      W(kridloPredne, 'ultramarine', 0.46), W(kridloPredne, 'payne', 0.3), W(hrdlo, 'vermilion', 0.62), W(hrdlo, 'sienna', 0.2)],
    i: [I(kridloZadne, 0.85), I(obrys, 1), I(kridloPredne, 0.9), I(hrdlo, 0.4), I(perie, 0.4), I(usecka([22.4, 33.8], [25.6, 33.8]), 0.4)],
    f: oko(28.4, 32.8, 1.05),
  };
}

function rybarik() {
  const obrys = hladka([[5.6, 30, 1], [22, 26.6], [25, 23], [31, 21], [37, 22.6], [45, 27], [54, 35], [62, 41], [66.4, 45, 1], [61, 46.6, 1], [54, 45], [48, 48], [41, 48.6], [34, 45], [28, 38], [24, 32], [22, 30.2, 1]]);
  const vrch = hladka([[22.6, 26.8], [25, 23], [31, 21], [37, 22.6], [45, 27], [54, 35], [62, 41], [66.4, 45, 1], [61, 46.6, 1], [54, 42], [46, 35], [38, 29.4], [31, 27.6], [26, 27.8]]);
  const spodok = hladka([[33.6, 45], [41, 48.6], [48, 48], [54, 45], [55, 40.4], [47, 36], [40, 34], [33, 36.6]]);
  const lico = hladka([[24.6, 27.8], [29, 28], [32.6, 29], [31, 31.2], [26.6, 30.8]]);
  const skvrna = hladka([[33, 30], [37, 29], [38.2, 32.6], [34, 33.2]]);
  const zobak = hladka([[5.6, 30, 1], [22, 26.6], [22, 30.2, 1]]);
  const palica = [[30, 55.6], [56, 51.6], [97, 47]];
  const nohy = usecka([44, 48.4], [44.6, 52.8]) + usecka([48.4, 47.8], [49.2, 52.2]);
  let bodky = '';
  for (const [x, y] of [[28, 23.4], [31.4, 22.6], [34.6, 23.2], [30, 25.2], [33.4, 25.4]]) bodky += kruh(x, y, 0.45);
  return {
    w: [W(vrch, 'cerulean', 0.58), W(vrch, 'turquoise', 0.34), W(hladka([[46, 35], [54, 36.4], [60, 42], [55, 43]]), 'viridian', 0.3), W(spodok, 'sienna', 0.55),
      W(spodok, 'vermilion', 0.22), W(lico, 'sienna', 0.55), PAP(skvrna), W(zobak, 'payne', 0.72), WS(ciara(palica), 'umber', 0.45, 2.4), WS(nohy, 'vermilion', 0.7, 1.2),
      W(hladka([[4, 70], [4, 62], [30, 61.2], [60, 62], [96, 61], [96, 70]]), 'cerulean', 0.16)],
    i: [I(obrys, 1), I(vrch, 0.4), I(lico, 0.45), I(skvrna, 0.5), I(usecka([6.6, 29.8], [22, 28.6]), 0.45), I(ciara(palica), 1), I(nohy, 0.6),
      I(ciara([[12, 63.4], [22, 62.6], [34, 63.6]]) + ciara([[60, 65.4], [72, 64.4], [84, 65.6]]), 0.45)],
    f: [...oko(27.2, 26.2, 1.3), ...bodky.split('Z').filter(Boolean).map((d) => ({ d: d + 'Z', farba: 'turquoise' }))],
  };
}

function sova() {
  const obrys = hladka([[50, 6.2], [60, 7.6], [66, 15], [65.4, 25], [66.2, 31], [68, 42], [66, 52], [60.4, 60, 1], [50, 62], [39.6, 60, 1], [34, 52], [32, 42], [33.8, 31], [34.6, 25], [34, 15], [40, 7.6]]);
  const tvar = hladka([[50, 10.6, 1], [56, 8.4], [62, 12], [63.6, 19], [60, 27], [55, 32], [50, 37, 1], [45, 32], [40, 27], [36.4, 19], [38, 12], [44, 8.4]]);
  const kridloL = hladka([[34, 31], [38.4, 34], [41, 44], [42, 55], [39.6, 60, 1], [34, 52], [32, 42]]);
  const kridloP = hladka([[66, 31], [61.6, 34], [59, 44], [58, 55], [60.4, 60, 1], [66, 52], [68, 42]]);
  const zobak = hladka([[50, 22.6], [51.2, 25.4], [50.4, 28.6, 1], [49.4, 25.4]]);
  const kol = hladka([[38, 70], [40, 60.4], [60, 60.4], [62, 70]], false);
  const nah = rozptyl(71);
  let skvrny = '';
  for (let k = 0; k < 14; k++) {
    const str = k % 2 ? 1 : -1, x = 50 + str * (11 + nah() * 5.5), y = 36 + nah() * 20;
    skvrny += kruh(x, y, 0.35);
  }
  let skvrnyHrud = '';
  for (let k = 0; k < 7; k++) skvrnyHrud += kruh(45 + nah() * 10, 41 + nah() * 14, 0.3);
  return {
    w: [W(obrys, 'ochre', 0.44), W(obrys, 'umber', 0.1), W(kridloL, 'ochre', 0.3), W(kridloP, 'ochre', 0.3), W(kridloL, 'payne', 0.1), W(kridloP, 'payne', 0.1),
      PAP(hladka([[42, 34], [50, 37.6], [58, 34], [59, 44], [57, 56], [50, 60], [43, 56], [41, 44]])), PAP(tvar), W(tvar, 'ochre', 0.08), WS(tvar, 'ochre', 0.55, 1.4),
      W(zobak, 'ochre', 0.4), W(kol + 'Z', 'umber', 0.36)],
    i: [I(obrys, 1), I(tvar, 0.8), I(kridloL, 0.55), I(kridloP, 0.55), I(zobak, 0.6), I(ciara([[50, 11], [50, 22]]), 0.35), I(kol, 0.9),
      I(ciara([[44, 64], [45, 70]]) + ciara([[55, 63], [54.4, 68]]), 0.4), I(ciara([[45, 59.4], [45.6, 61.6]]) + ciara([[47.4, 59.6], [47.6, 61.8]]) + ciara([[52.6, 59.6], [52.4, 61.8]]) + ciara([[55, 59.4], [54.4, 61.6]]), 0.6)],
    f: [F(elipsa(44.6, 20, 2.1, 2.7), 'ink'), F(elipsa(55.4, 20, 2.1, 2.7), 'ink'), PAP(kruh(45.2, 19, 0.6)), PAP(kruh(56, 19, 0.6)),
      ...skvrny.split('Z').filter(Boolean).map((d) => ({ d: d + 'Z', farba: 'payne' })), ...skvrnyHrud.split('Z').filter(Boolean).map((d) => ({ d: d + 'Z', farba: 'umber' }))],
  };
}

function bocian() {
  const telo = hladka([[2.6, 39.4, 1], [10, 36.4], [15.4, 33], [19, 32], [22, 33.4], [30, 36], [40, 35.4], [52, 36], [62, 38.6], [68.4, 40.6, 1], [63, 44], [52, 46], [40, 45], [30, 42], [21, 38.8], [15.6, 38], [10, 38.8, 1]]);
  const kridloP = hladka([[46, 36.2], [54, 24], [62, 14], [78, 4, 1], [79.6, 9, 1], [83, 8, 1], [82.4, 13.6, 1], [86, 13, 1], [83.6, 17.6, 1], [86.4, 18.6, 1], [78, 22.4], [72, 26], [64, 32], [56, 38]]);
  const ciernaP = hladka([[68, 18], [78, 4, 1], [79.6, 9, 1], [83, 8, 1], [82.4, 13.6, 1], [86, 13, 1], [83.6, 17.6, 1], [86.4, 18.6, 1], [78, 22.4], [72, 26], [64, 32], [56, 38], [58.6, 32.6], [64, 25.4]]);
  const kridloZ = hladka([[43.4, 36.2], [40, 26], [36, 17], [22, 7.6, 1], [22.6, 12.6, 1], [17.6, 12, 1], [19.4, 16.6, 1], [15.4, 16.6, 1], [18.6, 20.4, 1], [15.6, 21.8, 1], [24, 24.4], [32, 30], [37, 35.6]]);
  const ciernaZ = hladka([[31, 15], [22, 7.6, 1], [22.6, 12.6, 1], [17.6, 12, 1], [19.4, 16.6, 1], [15.4, 16.6, 1], [18.6, 20.4, 1], [15.6, 21.8, 1], [24, 24.4], [32, 30], [37, 35.6], [36.4, 29.6], [33.6, 22]]);
  const zobak = hladka([[2.6, 39.4, 1], [10, 36.4], [10, 38.8, 1]]);
  const nohy = usecka([62, 43], [94.6, 45.4]) + usecka([61.6, 44], [93.4, 48.2]);
  return {
    w: [W(kridloZ, 'payne', 0.06), W(ciernaZ, 'payne', 0.66), W(telo, 'payne', 0.06), W(kridloP, 'payne', 0.06), W(ciernaP, 'payne', 0.7),
      W(zobak, 'vermilion', 0.72), WS(nohy, 'vermilion', 0.62, 1.7)],
    i: [I(kridloZ, 0.85), I(ciernaZ, 0.4), I(telo, 1), I(kridloP, 0.9), I(ciernaP, 0.4), I(usecka([3.6, 39.2], [10, 37.8]), 0.4), I(nohy, 0.55),
      I(ciara([[60, 20.4], [70, 13]]) + ciara([[31, 20], [25, 14.6]]), 0.35)],
    f: [F(kruh(17.6, 34.8, 0.8), 'ink')],
  };
}

function papuchalk() {
  const obrys = hladka([[16, 27, 1], [18.6, 23.2], [24, 19.6], [26.6, 16.4], [32, 14.8], [38, 16.6], [42, 22], [45, 32], [46.6, 42], [48, 49, 1], [44, 50.6], [40, 52.6], [32, 52], [26.6, 45], [24.6, 37], [24.8, 31], [24, 28.4], [22.4, 29.6], [19, 28.8]]);
  const lico = hladka([[24.4, 20.6], [28, 18.4], [34, 19.8], [36.6, 25.6], [33, 29.6], [27, 30], [24.6, 27.6]]);
  const brucho = hladka([[26.6, 36], [33, 34.6], [38.6, 33], [40.4, 40], [40.6, 47], [38, 51.6], [32, 51.2], [27.4, 45]]);
  const zobak = hladka([[24, 19.6], [18.6, 23.2], [16, 27, 1], [19, 28.8], [22.4, 29.6], [24, 28.4]]);
  const zaklad = hladka([[24, 19.6], [22.2, 21.2], [21.8, 27.4], [22.4, 29.6], [24, 28.4]]);
  const kamen = hladka([[14, 70], [18, 60], [30, 57.4], [50, 57], [64, 60.4], [70, 70]], false);
  const nohy = ciara([[35, 52.4], [34.4, 55], [33.6, 57.4]]) + usecka([30.4, 58.2], [37, 58.4]) + ciara([[39, 52.6], [39.6, 55.2], [40.4, 57.4]]) + usecka([37.6, 58.4], [43.6, 58.2]);
  const trava = ciara([[56, 58], [57.4, 52], [58, 49.2]]) + ciara([[58.6, 58.4], [61, 53], [63.4, 50.6]]) + ciara([[60, 58.6], [60.4, 54.4]]);
  return {
    w: [W(obrys, 'payne', 0.68), PAP(lico), PAP(brucho), W(lico, 'payne', 0.1), W(zobak, 'vermilion', 0.72), W(zaklad, 'payne', 0.3), WS(usecka([22.2, 21], [21.8, 28.2]), 'lemon', 0.8, 1),
      W(kamen + 'Z', 'payne', 0.16), W(kamen + 'Z', 'umber', 0.12), WS(nohy, 'vermilion', 0.7, 1.5), WS(trava, 'sap', 0.6, 1.4)],
    i: [I(obrys, 1), I(lico, 0.5), I(brucho, 0.5), I(zobak, 0.7), I(ciara([[19.6, 23.4], [20.4, 25.6], [19.8, 28.2]]) + ciara([[17.6, 25.2], [18.2, 27.6]]), 0.4),
      I(usecka([31.2, 23.2], [35, 24.4]), 0.45), I(kamen, 0.9), I(nohy, 0.6), I(trava, 0.5)],
    f: [...oko(29.4, 22.4, 1.05), F(kruh(58.2, 48.6, 1.3), 'rose'), F(kruh(63.8, 50, 1.2), 'rose'), F(kruh(60.8, 51.6, 0.9), 'rose')],
  };
}

function stehlik() {
  // Tvar vychádza z červienky (zrkadlovo), je štíhlejší a má vidlicový chvost.
  const obrys = hladka([[60.4, 27.4, 1], [54.6, 25.4], [52.2, 21.6], [46.4, 19.2], [40, 20.6], [32, 24.6], [24, 29.6], [18.6, 34.6], [10, 39.2], [3.4, 41.2, 1], [7.6, 42.8, 1], [4.8, 45.8, 1], [16, 44.6],
    [24, 48.6], [34, 51.8], [39.6, 51.8], [47, 48.8], [52, 43.4], [55, 35.4], [55.6, 29.8], [55.2, 28.8, 1]]);
  const zobak = hladka([[60.4, 27.4, 1], [54.8, 25.6], [55.4, 29.2, 1]]);
  const tvar = hladka([[54.6, 25.4], [52.2, 23.2], [49.6, 24], [48.8, 27.4], [50.6, 30.8], [53.8, 31.8], [55.6, 29.8]]);
  const cap = hladka([[52.4, 22.4], [46.4, 19.2], [40, 20.6], [37.4, 22.6], [41.6, 23.8], [46.2, 23.4], [49.6, 24.2]]);
  const pasHlavy = hladka([[40, 20.8], [37.4, 22.6], [37.2, 27.8], [39.4, 32.6], [42.8, 34.2], [43.4, 30], [42, 25.2]]);
  const vrch = hladka([[38.6, 27], [32, 24.6], [24, 29.6], [18.6, 34.6], [22, 37.6], [30, 38.6], [38, 36.4], [41.6, 34.2]]);
  const bok = hladka([[43.6, 34.8], [49, 35], [53.6, 38.4], [52, 43.4], [47.6, 44.4], [44.2, 40.6]]);
  const kridlo = hladka([[37, 31], [30, 31.4], [22, 35], [14, 40.4], [9.6, 42.6], [18, 43], [26, 41.8], [34, 38.6], [38.4, 35]]);
  const pruh = hladka([[35.6, 32.8], [28, 34], [20.4, 38], [22.6, 40], [30, 37.4], [36.6, 35.4]]);
  const chvost = hladka([[18.6, 34.8], [10, 39.2], [3.4, 41.2, 1], [7.6, 42.8, 1], [4.8, 45.8, 1], [16, 44.6], [20, 41.4]]);
  const stonka = [[2, 68], [20, 62], [36, 58.4], [56, 53.6], [72, 45.6], [85.6, 36.6]];
  const hlava = elipsa(87, 32, 5.6, 4.8);
  let listence = '';
  for (let k = 0; k < 7; k++) {
    const x = 82.4 + k * 1.55;
    listence += ciara([[x, 36], [x + 0.4, 32.2], [x + (k - 3) * 0.55, 28.4]]);
  }
  let chmyri = '';
  for (let k = 0; k < 13; k++) {
    const a = ((-150 + k * 10) * Math.PI) / 180;
    chmyri += usecka([87 + Math.cos(a) * 3, 28 + Math.sin(a) * 1.6], [87 + Math.cos(a) * 8.6, 27 + Math.sin(a) * 10.6]);
  }
  const nohy = ciara([[38, 51.6], [38.6, 55], [39.4, 57.8]]) + ciara([[34.4, 51.4], [34, 55], [33.6, 58.4]]) + usecka([37, 58.4], [42, 57.4]) + usecka([31.4, 59], [36, 58.2]);
  return {
    w: [W(obrys, 'ochre', 0.1), W(vrch, 'ochre', 0.36), W(vrch, 'sienna', 0.16), W(bok, 'ochre', 0.32), W(bok, 'sienna', 0.12), W(tvar, 'alizarin', 0.74), W(tvar, 'vermilion', 0.2),
      W(cap, 'payne', 0.78), W(pasHlavy, 'payne', 0.72), W(kridlo, 'payne', 0.72), W(chvost, 'payne', 0.7), W(pruh, 'lemon', 0.88), W(pruh, 'ochre', 0.2), W(zobak, 'rose', 0.35),
      WS(ciara(stonka), 'sap', 0.5, 2.2), W(hlava, 'sap', 0.45), WS(chmyri, 'violet', 0.55, 1.4), WS(chmyri, 'rose', 0.3, 0.8), WS(nohy, 'rose', 0.5, 1.1)],
    i: [I(obrys, 1), I(tvar, 0.45), I(cap, 0.45), I(kridlo, 0.55), I(pruh, 0.45), I(usecka([55.6, 27.4], [59.4, 27.4]), 0.4), I(ciara(stonka), 0.9), I(hlava, 0.7), I(listence, 0.4),
      I(chmyri, 0.35), I(nohy, 0.6)],
    f: [...oko(49.8, 26.6, 1.15), PAP(kruh(15.6, 41.4, 0.6)), PAP(kruh(19.2, 41.2, 0.55)), PAP(kruh(8.6, 43.6, 0.5))],
  };
}

/* ══ Spoločné pre témy M1 (26. 9. 2026) ═══════════════════════════════════ */

const mnoho = (body) => lomena(body) + 'Z';
/* Body Catmull-Rom krivky (rovnaká krivka ako hladka), keď treba obrys okolo osi alebo zakrývanie. */
function vzorky(body, n = 10, uzavreta = false) {
  const N = body.length, out = [];
  const bod = (k) => (uzavreta ? body[(k + N) % N] : body[Math.max(0, Math.min(N - 1, k))]);
  const koniec = uzavreta ? N : N - 1;
  for (let k = 0; k < koniec; k++) {
    const p0 = bod(k - 1), p1 = bod(k), p2 = bod(k + 1), p3 = bod(k + 2);
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((i) => 0.5 * (2 * p1[i] + (p2[i] - p0[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (3 * p1[i] - p0[i] - 3 * p2[i] + p3[i]) * t3)));
    }
  }
  if (!uzavreta) out.push([body[N - 1][0], body[N - 1][1]]);
  return out;
}
/* Rúrka okolo osi (hladká krivka cez body). r je číslo alebo funkcia r(s), s od 0 po 1 po dĺžke.
   Vráti výplň (obrys) a oba okraje ako body, aby sa dali čiastočne zakryť (viditelne). */
function rurka(os, r, n = 10) {
  const b = vzorky(os, n);
  const d = [0];
  for (let k = 1; k < b.length; k++) d.push(d[k - 1] + Math.hypot(b[k][0] - b[k - 1][0], b[k][1] - b[k - 1][1]));
  const L = d[d.length - 1] || 1;
  const A = [], B = [];
  b.forEach((p, k) => {
    const a = b[Math.max(0, k - 1)], c = b[Math.min(b.length - 1, k + 1)];
    const dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const w = typeof r === 'function' ? r(d[k] / L) : r;
    A.push([p[0] - (dy / l) * w, p[1] + (dx / l) * w]);
    B.push([p[0] + (dy / l) * w, p[1] - (dx / l) * w]);
  });
  return { obrys: mnoho([...A, ...B.slice().reverse()]), A, B, os: b };
}
/* Bod v mnohouholníku (lúč), na zakrývanie čiar tým, čo leží pred nimi. */
function vnutri(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
/* Miestne súradnice do plátna: posun do (cx, cy), mierka m, otočenie o uhol (stupne, v smere hodín). */
const umiestni = (cx, cy, uhol = 0, m = 1) => (body) => body.map(([x, y, k]) => {
  const p = otoc([cx + x * m, cy + y * m], [cx, cy], uhol);
  return k ? [p[0], p[1], k] : [p[0], p[1]];
});
/* Súmerný obrys z pravej polovice (od osi hore po os dole). */
const zrkadlo = (pol) => [...pol, ...pol.slice(1, -1).reverse().map(([x, y, k]) => (k ? [-x, y, k] : [-x, y]))];
const cesty = (zoznam) => zoznam.join('');

/* ══ Musical Instruments ══════════════════════════════════════════════════ */

function husle() {
  // Miestne súradnice: os huslí zvislo, 0 je stred korpusu, y dole k podbradníku.
  const T = umiestni(36, 42, 40, 1.05);
  const Y = (b) => T(b.map(([x, y, k]) => (k ? [x, y - 19, k] : [x, y - 19])));
  const pol = [[0, 0], [4.6, 0.5], [8, 2.6], [9.3, 6.4], [8.8, 10], [7.4, 12.4, 1], [5.8, 14.2], [5.3, 17], [5.8, 19.8], [7.6, 21.6, 1], [10.2, 24.2], [11.2, 28.4], [10.6, 32.6], [8, 35.8], [4.2, 37.4], [0, 37.8]];
  const obrys = hladka(Y(zrkadlo(pol)));
  const lemovka = hladka(Y(zrkadlo(pol).map(([x, y]) => [x * 0.88, 19 + (y - 19) * 0.93])));
  const hmatnik = mnoho(Y([[-1.2, -14], [1.2, -14], [1.9, 14.6], [-1.9, 14.6]]));
  const krk = mnoho(Y([[-1.3, -14], [1.3, -14], [1.4, 0.2], [-1.4, 0.2]]));
  const hlavica = hladka(Y([[0, -14.2, 1], [1.5, -15], [1.5, -21], [2.2, -23], [1.6, -25.2], [0, -25.8], [-1.6, -25.2], [-2.2, -23], [-1.5, -21], [-1.5, -15]]));
  const zavitok = hladka(Y([[0, -21.6], [1, -22.4], [0.9, -24], [0, -24.6], [-0.9, -24], [-1, -22.4]]));
  const koliky = cesty([-15.6, -18.6].map((y) => ciara(Y([[1.5, y], [3.4, y - 0.3]])) + ciara(Y([[-1.5, y + 1.4], [-3.4, y + 1.1]]))));
  const hlavicky = [[3.9, -15.9], [3.9, -18.9], [-3.9, -14.5], [-3.9, -17.5]].map(([x, y]) => hladka(Y([[x - 0.9, y], [x, y - 0.8], [x + 0.9, y], [x, y + 0.8]])));
  const struny = cesty([-0.9, -0.3, 0.3, 0.9].map((x) => lomena(Y([[x, -14], [x * 1.9, 21.4], [x * 1.3, 25.6]]))));
  const kobylka = ciara(Y([[-3.6, 21.9], [0, 21.1], [3.6, 21.9]]));
  const struniak = hladka(Y([[-1.5, 25.4], [1.5, 25.4], [2.5, 33.4], [1.4, 35.6], [-1.4, 35.6], [-2.5, 33.4]]));
  const efy = [1, -1].map((s) => ciara(Y([[4.1 * s, 16], [4.9 * s, 18], [5.2 * s, 21.6], [5.5 * s, 24.6], [6 * s, 26.4]])));
  const ocka = [[4.1, 16], [6, 26.4], [-4.1, 16], [-6, 26.4]].map(([x, y]) => { const p = Y([[x, y]])[0]; return F(kruh(p[0], p[1], 0.55)); });
  // Sláčik vedľa huslí: prútik s miernym prehnutím, žinnie, žabka a hlavička.
  const S = umiestni(36.7, 66.1, -50, 1);
  const prut = ciara(S([[-1, 2.3], [20, 1.5], [40, 1.2], [60, 1.6], [72.4, 2.5]]));
  const zine = usecka(...S([[3, 0], [70, 0]]));
  const zabka = mnoho(S([[1, 0], [8.6, 0], [8, 1.8], [1.2, 2.4]]));
  const spicka = mnoho(S([[69.4, 0], [72.8, 0.2], [73.2, 2.6], [70.8, 2.2]]));
  return {
    w: [W(obrys, 'sienna', 0.5), W(obrys, 'ochre', 0.32), W(lemovka, 'vermilion', 0.12), W(hlavica, 'sienna', 0.5), W(krk, 'ochre', 0.4),
      W(hmatnik, 'payne', 0.78), W(struniak, 'payne', 0.78), ...hlavicky.map((d) => W(d, 'payne', 0.7)), WS(kobylka, 'ochre', 0.7, 1.2),
      WS(prut, 'umber', 0.55, 1.3), W(zabka, 'payne', 0.75), W(spicka, 'ochre', 0.5)],
    i: [I(obrys, 1), I(lemovka, 0.3), I(hlavica, 0.7), I(zavitok, 0.45), I(koliky, 0.6), ...hlavicky.map((d) => I(d, 0.5)), I(hmatnik, 0.6), I(struny, 0.22),
      I(kobylka, 0.6), I(struniak, 0.6), I(efy.join(''), 0.55), I(prut, 0.7), I(zine, 0.3), I(zabka, 0.5), I(spicka, 0.5)],
    f: [...ocka, F(kruh(...S([[5, 1.2]])[0], 0.5), 'papier')],
  };
}

function gitara() {
  const T = umiestni(58, 52, -40, 0.86);
  const Y = (b) => T(b.map(([x, y, k]) => (k ? [x, y - 21.6, k] : [x, y - 21.6])));
  const pol = [[0, 0], [5, 0.3], [9.6, 2.4], [11.6, 6.4], [11, 11], [9.2, 14.6], [8.8, 17.4], [10.4, 21], [13.2, 25.4], [14.4, 31], [13.4, 36.4], [10.2, 40.4], [5.4, 42.6], [0, 43.2]];
  const obrys = hladka(Y(zrkadlo(pol)));
  const lem = hladka(Y(zrkadlo(pol).map(([x, y]) => [x * 0.9, 21.6 + (y - 21.6) * 0.95])));
  const s = Y([[0, 15]])[0];
  const m = 0.86;
  const krk = mnoho(Y([[-1.6, -30], [1.6, -30], [2, 11], [-2, 11]]));
  const hlava = hladka(Y([[-1.8, -30, 1], [1.8, -30, 1], [2.6, -40.4, 1], [0, -41.6], [-2.6, -40.4, 1]]));
  const drazky = mnoho(Y([[-1, -38.6], [-0.6, -38.6], [-0.6, -32], [-1, -32]])) + mnoho(Y([[0.6, -38.6], [1, -38.6], [1, -32], [0.6, -32]]));
  const koliky = cesty([-32.6, -35.2, -37.8].map((y) => usecka(...Y([[2.3, y], [4.6, y]])) + usecka(...Y([[-2.3, y], [-4.6, y]]))));
  const hlavicky = [-32.6, -35.2, -37.8].flatMap((y) => [4.9, -4.9].map((x) => { const p = Y([[x, y]])[0]; return elipsa(p[0], p[1], 1.1, 0.7, -40); }));
  let prazce = '';
  for (let k = 1; k <= 12; k++) { const y = -30 + 61 * (1 - Math.pow(2, -k / 12)); prazce += usecka(...Y([[-1.7, y], [1.7, y]])); }
  const struny = cesty([-1.1, -0.66, -0.22, 0.22, 0.66, 1.1].map((x) => usecka(...Y([[x, -30], [x * 2.1, 31]]))));
  const kobylka = mnoho(Y([[-5.8, 30], [5.8, 30], [5.8, 32.6], [-5.8, 32.6]]));
  return {
    w: [W(obrys, 'ochre', 0.46), W(obrys, 'lemon', 0.22), W(lem, 'sienna', 0.1), W(kruh(s[0], s[1], 5.8 * m), 'turquoise', 0.35), W(kruh(s[0], s[1], 5.8 * m), 'sienna', 0.2),
      PAP(kruh(s[0], s[1], 4.5 * m)), W(krk, 'umber', 0.55), W(krk, 'payne', 0.3), W(hlava, 'umber', 0.55), W(kobylka, 'umber', 0.6)],
    i: [I(obrys, 1), I(lem, 0.3), I(kruh(s[0], s[1], 5.8 * m), 0.4), I(kruh(s[0], s[1], 5 * m), 0.3), I(kruh(s[0], s[1], 4.4 * m), 0.7), I(krk, 0.7), I(prazce, 0.3),
      I(hlava, 0.7), I(drazky, 0.4), I(koliky, 0.5), I(hlavicky.join(''), 0.45), I(kobylka, 0.6), I(struny, 0.2)],
    f: [F(kruh(s[0], s[1], 4.2 * m), 'payne')],
  };
}

function harfa() {
  // Stĺp vľavo, krk hore v tvare S, ozvučnica šikmo; každá C struna červená a F modrá ako na skutočnej harfe.
  const krkY = (x) => 8 + (x - 30) * 0.32 + 3 * Math.sin(((x - 30) / 50) * Math.PI * 2);
  const A = [80.5, 25], B = [35.4, 61.2];
  const osY = (x) => A[1] + ((A[0] - x) * (B[1] - A[1])) / (A[0] - B[0]);
  const krkHore = [], krkDole = [];
  for (let x = 28; x <= 83; x += 2.5) { krkHore.push([x, krkY(x) - 1.6]); krkDole.push([x, krkY(x) + 1.6]); }
  const krk = hladka([...krkHore, [84.6, krkY(83) + 1], ...krkDole.slice().reverse()]);
  const d = [(B[0] - A[0]) / Math.hypot(B[0] - A[0], B[1] - A[1]), (B[1] - A[1]) / Math.hypot(B[0] - A[0], B[1] - A[1])], n = [-d[1], d[0]];
  const vonka = [];
  const LS = Math.hypot(B[0] - A[0], B[1] - A[1]);
  for (let k = 0; k <= 10; k++) { const t = k / 10, w = 2.2 + 6 * t * t; vonka.push([A[0] + d[0] * LS * t - n[0] * w, A[1] + d[1] * LS * t - n[1] * w]); }
  const ozvucnica = hladka([[A[0] - 0.6, A[1] - 1.4, 1], ...vonka, [B[0] + 3, B[1] + 0.6, 1], [B[0] - 0.6, B[1], 1]]);
  const stlp = hladka([[28.4, 12, 1], [31.8, 12, 1], [31.6, 56], [33.6, 60.6, 1], [26.4, 60.6, 1], [28.6, 56]]);
  const hlavica = hladka([[27, 12.4], [25.2, 9], [26.4, 5.6], [30, 4.2], [33, 5.8], [33.4, 9.4], [32.6, 12.4]]);
  const slimak = hladka([[29.6, 9.4], [28.2, 8.2], [28.8, 6.6], [30.6, 6.8], [30.8, 8.4]], false);
  const podstavec = hladka([[24, 60.6, 1], [52, 60.6, 1], [53, 64.4, 1], [23, 64.4, 1]]);
  const nozicky = mnoho([[25, 64.4], [28, 64.4], [27.4, 66.4], [25.4, 66.4]]) + mnoho([[47.4, 64.4], [50.4, 64.4], [50, 66.4], [48, 66.4]]);
  const pedale = cesty([34, 37.4, 40.8, 44.2].map((x) => usecka([x, 64.4], [x + 1.2, 67.2])));
  const struny = [], cervene = [], modre = [];
  let k = 0;
  for (let x = 36.4; x <= 78.5; x += 2.1, k++) {
    const u = usecka([x, krkY(x) + 1.6], [x, osY(x)]);
    if (k % 7 === 0) cervene.push(u); else if (k % 7 === 3) modre.push(u); else struny.push(u);
  }
  return {
    w: [W(stlp, 'ochre', 0.5), W(stlp, 'lemon', 0.3), W(hlavica, 'ochre', 0.55), W(krk, 'ochre', 0.5), W(krk, 'lemon', 0.25), W(ozvucnica, 'sienna', 0.55), W(ozvucnica, 'umber', 0.2),
      W(podstavec, 'umber', 0.5), W(nozicky, 'umber', 0.6), WS(cervene.join(''), 'vermilion', 0.7, 0.8), WS(modre.join(''), 'ultramarine', 0.6, 0.8)],
    i: [I(stlp, 0.9), I(usecka([30.1, 14], [30.1, 55]), 0.3), I(hlavica, 0.8), I(slimak, 0.45), I(krk, 0.85), I(ozvucnica, 0.9), I(podstavec, 0.8), I(nozicky, 0.6), I(pedale, 0.6),
      I(struny.join(''), 0.22), I(cervene.join(''), 0.3), I(modre.join(''), 0.3), I(ciara([[A[0] - 2, A[1] + 3.4], [B[0] + 2.4, B[1] - 3]]), 0.35)],
    f: [],
  };
}

function klavir() {
  // Krídlo zo šikma spredu sprava: klaviatúra, vnútro so strunami, veko otvorené k divákovi, tri nohy.
  const s = 1.15, x0 = 25, y0 = 44;
  const P = (u, v, h = 0) => [x0 + s * (0.75 * u + 0.62 * v), y0 + s * (0.33 * u - 0.33 * v - h)];
  const H = 6.5, th = (56 * Math.PI) / 180;
  const plan = [[0, 0], [34, 0], [34, 6], ...vzorky([[34, 6], [33, 14], [30, 22], [24, 32], [17, 42], [12, 50], [9.6, 56], [7, 60.4], [3.6, 61.6], [0.8, 60], [0, 57]], 4).slice(1)];
  const hore = plan.map(([u, v]) => P(u, v, H));
  const veko = plan.map(([u, v]) => P(u * Math.cos(th), v, H + u * Math.sin(th)));
  const skryte = (p) => vnutri(p, veko);
  // Bok od pravého predného rohu po chvost, medzi výškou 0 a H.
  const bok = plan.slice(1);
  const bokPlocha = mnoho([...bok.map(([u, v]) => P(u, v, H)), ...bok.slice().reverse().map(([u, v]) => P(u, v, 0))]);
  const predok = mnoho([P(0, 0, H), P(34, 0, H), P(34, 0, 0), P(0, 0, 0)]);
  // Struny vo vnútri, rovnobežne so stenou vľavo; zlatý rám; kde ich zakrýva veko, nekreslia sa.
  let struny = '';
  for (let u = 3; u <= 31; u += 2.8) {
    const vMax = u < 10 ? 54 : u < 20 ? 44 - (u - 10) * 0.9 : 34 - (u - 20) * 1.6;
    const body = [];
    for (let v = 3; v <= vMax; v += 2) body.push(P(u, v, H - 0.5));
    struny += viditelne(body, skryte);
  }
  const vnutroHrana = viditelne(vzorky(plan.map(([u, v]) => [u * 0.93 + 1.2, v * 0.94 + 1.4]), 3, true).map(([u, v]) => P(u, v, H)), skryte);
  // Klaviatúra pred skriňou: biele klávesy, čierne po dvoch a troch.
  const kl = [P(1.4, -7, H - 1.4), P(32.6, -7, H - 1.4), P(32.6, 0, H - 1.4), P(1.4, 0, H - 1.4)];
  const klPredok = mnoho([P(1.4, -7, H - 1.4), P(32.6, -7, H - 1.4), P(32.6, -7, H - 3.4), P(1.4, -7, H - 3.4)]);
  const bielych = 21, wk = 31.2 / bielych;
  let ciarky = '', cierne = '';
  for (let k = 1; k < bielych; k++) ciarky += usecka(P(1.4 + k * wk, -7, H - 1.4), P(1.4 + k * wk, 0, H - 1.4));
  for (let k = 1; k < bielych; k++) {
    if ([0, 3].includes(k % 7)) continue;
    const u = 1.4 + k * wk;
    cierne += mnoho([P(u - wk * 0.3, -2.8, H - 0.6), P(u + wk * 0.3, -2.8, H - 0.6), P(u + wk * 0.3, 0, H - 0.6), P(u - wk * 0.3, 0, H - 0.6)]);
  }
  const lice = mnoho([P(0, -7.6, H), P(1.4, -7.6, H), P(1.4, 0, H), P(0, 0, H)]) + mnoho([P(32.6, -7.6, H), P(34, -7.6, H), P(34, 0, H), P(32.6, 0, H)]);
  const noha = (u, v) => { const a = P(u, v, 0); return mnoho([[a[0] - 1.1, a[1]], [a[0] + 1.1, a[1]], [a[0] + 0.75, a[1] + 11 * s], [a[0] - 0.75, a[1] + 11 * s]]); };
  const nohy = [noha(1.6, -1), noha(32.4, -1), noha(6, 53)];
  const lyra = P(17, -2, 0);
  const pedal = mnoho([[lyra[0] - 1.1, lyra[1]], [lyra[0] + 1.1, lyra[1]], [lyra[0] + 1.5, lyra[1] + 10.4 * s], [lyra[0] - 1.5, lyra[1] + 10.4 * s]]);
  const podpera = usecka(P(31.6, 16, H), P(29 * Math.cos(th), 16, H + 29 * Math.sin(th)));
  const vekoLesk = ciara([P(26 * Math.cos(th), 6, H + 26 * Math.sin(th)), P(20 * Math.cos(th), 26, H + 20 * Math.sin(th)), P(10 * Math.cos(th), 44, H + 10 * Math.sin(th))]);
  return {
    w: [W(mnoho(hore), 'ochre', 0.4), W(mnoho(hore), 'lemon', 0.24), W(bokPlocha, 'payne', 0.78), W(predok, 'payne', 0.7), W(lice, 'payne', 0.8), ...nohy.map((d) => W(d, 'payne', 0.78)),
      W(pedal, 'payne', 0.7), PAP(mnoho(veko)), W(mnoho(veko), 'payne', 0.62), W(mnoho(veko), 'ultramarine', 0.1), WS(vekoLesk, 'papier', 0.5, 1.2), PAP(mnoho(kl)), W(klPredok, 'payne', 0.7)],
    i: [I(mnoho(veko), 0.9), I(viditelne([...hore, hore[0]], skryte), 0.9), I(vnutroHrana, 0.3), I(struny, 0.22), I(lomena(bok.map(([u, v]) => P(u, v, 0))), 0.9),
      I(usecka(P(34, 0, H), P(34, 0, 0)) + usecka(P(0, 0, H), P(0, 0, 0)), 0.7), I(mnoho(kl), 0.6), I(ciarky, 0.3), I(klPredok, 0.5), I(lice, 0.6), ...nohy.map((d) => I(d, 0.6)),
      I(pedal, 0.5), I(podpera, 0.7)],
    f: [F(cierne, 'ink')],
  };
}

function trubka() {
  const r = 1.25;
  const ventily = [40.4, 46.6, 52.8];
  const vVentile = (p) => ventily.some((x) => Math.abs(p[0] - x) < 2.3 && p[1] > 24.4 && p[1] < 46.6);
  const kresliRurku = (t) => viditelne(t.A, vVentile) + viditelne(t.B, vVentile);
  const napust = rurka([[9.6, 28.4], [24, 28.4], [38, 28.4], [55, 28.4]], 1.05, 4);
  const spodna = rurka([[56, 42.4], [36, 42.4], [22, 42.4], [16.6, 42.4], [12.8, 40.4], [12, 37.8], [13.4, 35.4], [16.6, 34], [22, 34], [40, 34], [58, 34]], r, 6);
  const RB = (x) => (x < 60 ? r : r + Math.pow((x - 60) / 34, 3.2) * 10.6);
  const horna = [], dolna = [];
  for (let x = 56; x <= 94; x += 1) { horna.push([x, 34 - RB(x)]); dolna.push([x, 34 + RB(x)]); }
  const korpus = mnoho([...horna, ...dolna.slice().reverse()]);
  const okraj = elipsa(94.2, 34, 1.6, RB(94) + 0.2);
  const hubica = hladka([[3.2, 26.6, 1], [5, 27.4], [9.8, 27.8], [9.8, 29, 1], [5, 29.4], [3.2, 30.2, 1]]);
  const kryty = ventily.map((x) => mnoho([[x - 2.3, 25], [x + 2.3, 25], [x + 2.3, 46], [x - 2.3, 46]]));
  const viecka = ventily.map((x) => mnoho([[x - 2.7, 23.6], [x + 2.7, 23.6], [x + 2.7, 25.2], [x - 2.7, 25.2]]) + mnoho([[x - 2.7, 45.8], [x + 2.7, 45.8], [x + 2.7, 47.6], [x - 2.7, 47.6]]));
  const stopky = cesty(ventily.map((x) => usecka([x - 0.5, 23.6], [x - 0.5, 19.4]) + usecka([x + 0.5, 23.6], [x + 0.5, 19.4])));
  const tlacidla = ventily.map((x) => elipsa(x, 18.6, 2.5, 1));
  const tretia = rurka([[53, 46.6], [53, 50.4], [56, 52.2], [59, 50.4], [59, 42]], 0.9, 4);
  const lesk = ciara([[62, 32.6], [74, 32.6], [84, 31], [90, 27.4]]);
  return {
    w: [W(spodna.obrys, 'ochre', 0.45), W(spodna.obrys, 'lemon', 0.3), W(napust.obrys, 'ochre', 0.45), W(napust.obrys, 'lemon', 0.3), W(tretia.obrys, 'ochre', 0.45),
      W(korpus, 'ochre', 0.45), W(korpus, 'lemon', 0.3), W(okraj, 'sienna', 0.4), W(okraj, 'ochre', 0.4), W(hubica, 'payne', 0.3), W(hubica, 'ochre', 0.3),
      ...kryty.map((d) => W(d, 'ochre', 0.5)), ...kryty.map((d) => W(d, 'lemon', 0.25)), ...viecka.map((d) => W(d, 'ochre', 0.6)), WS(lesk, 'papier', 0.9, 0.9)],
    i: [I(kresliRurku(spodna), 0.8), I(kresliRurku(napust), 0.8), I(lomena(tretia.A) + lomena(tretia.B), 0.6), I(lomena(horna) + lomena(dolna), 0.9), I(okraj, 0.9), I(hubica, 0.7),
      ...kryty.map((d) => I(d, 0.7)), ...viecka.map((d) => I(d, 0.6)), I(stopky, 0.5), ...tlacidla.map((d) => I(d, 0.6))],
    f: tlacidla.map((d) => PAP(d)),
  };
}

function flauta() {
  const T = umiestni(3, 53, -20, 1);
  const trup = hladka(T([[0.4, -2.1, 1], [96, -2.1, 1], [96, 2.1, 1], [0.4, 2.1, 1]]));
  const korunka = hladka(T([[-1.6, -1.4, 1], [0.6, -1.9, 1], [0.6, 1.9, 1], [-1.6, 1.4, 1]]));
  const pery = elipsa(...T([[9, -0.2]])[0], 3, 2.2, -20);
  const otvor = elipsa(...T([[9, -0.4]])[0], 1.2, 0.7, -20);
  const kruzky = cesty([27.6, 28.8, 73.4, 74.6].map((x) => usecka(...T([[x, -1.8], [x, 1.8]]))));
  const kl = [35, 39.6, 44.2, 48.8, 53.4, 58, 62.6, 67.2];
  const klapky = kl.map((x) => { const p = T([[x, -0.3]])[0]; return kruh(p[0], p[1], 1.5); });
  const diery = [39.6, 44.2, 53.4, 58].map((x) => { const p = T([[x, -0.3]])[0]; return kruh(p[0], p[1], 0.55); });
  const tyc = usecka(...T([[33, -2.6], [70, -2.6]])) + cesty(kl.map((x) => usecka(...T([[x, -1.6], [x, -2.6]]))));
  const nozne = [79, 84, 89].map((x) => { const p = T([[x, 0.4]])[0]; return elipsa(p[0], p[1], 1.9, 1.3, -20); });
  const lesk = usecka(...T([[2, -0.9], [95, -0.9]]));
  return {
    w: [W(trup, 'payne', 0.2), W(trup, 'cerulean', 0.1), W(korunka, 'payne', 0.35), W(pery, 'payne', 0.25), ...klapky.map((d) => W(d, 'payne', 0.3)), ...nozne.map((d) => W(d, 'payne', 0.3)),
      WS(lesk, 'papier', 1, 0.7)],
    i: [I(trup, 0.9), I(korunka, 0.7), I(pery, 0.7), I(kruzky, 0.45), ...klapky.map((d) => I(d, 0.55)), I(tyc, 0.4), ...nozne.map((d) => I(d, 0.5))],
    f: [F(otvor, 'payne'), ...diery.map((d) => F(d, 'payne'))],
  };
}

function bubon() {
  const c = 50, rx = 25, ry = 7, yh = 27, yd = 53;
  const obluk = (y, od = 0, po = Math.PI) => { const b = []; for (let k = 0; k <= 24; k++) { const a = od + ((po - od) * k) / 24; b.push([c + Math.cos(a) * rx, y + Math.sin(a) * ry]); } return b; };
  const telo = mnoho([...obluk(yh + 3.6), ...obluk(yd - 3.6).reverse()]);
  const ramHore = mnoho([...obluk(yh - 1.4), ...obluk(yh + 3.6).reverse()]) ;
  const ramDole = mnoho([...obluk(yd - 3.6), ...obluk(yd + 1.4).reverse()]);
  const blana = elipsa(c, yh - 1.4, rx, ry);
  const cik = [];
  for (let k = 0; k <= 10; k++) {
    const a = (k / 10) * Math.PI;
    cik.push([c + Math.cos(a) * rx * 0.99, (k % 2 ? yd - 3.6 : yh + 3.6) + Math.sin(a) * ry]);
  }
  const ucha = [];
  for (let k = 1; k < 10; k += 2) {
    const a = (k / 10) * Math.PI, x = c + Math.cos(a) * rx, y = yd - 7.4 + Math.sin(a) * ry;
    ucha.push(mnoho([[x - 1.2, y], [x + 1.2, y], [x + 1, y + 2.6], [x - 1, y + 2.6]]));
  }
  const palicka = (a, b) => { const t = rurka([a, b], (s) => 0.55 + s * 0.35, 2); return { t, hlava: kruh(a[0], a[1], 1.1) }; };
  const p1 = palicka([33, 13.4], [8, 2.6]), p2 = palicka([64, 13], [90, 3.4]);
  return {
    w: [W(telo, 'ultramarine', 0.46), W(telo, 'payne', 0.12), W(ramHore, 'vermilion', 0.62), W(ramDole, 'vermilion', 0.62), W(blana, 'ochre', 0.12),
      WS(lomena(cik), 'lemon', 0.8, 1), ...ucha.map((d) => W(d, 'umber', 0.5)), W(p1.t.obrys, 'ochre', 0.5), W(p2.t.obrys, 'ochre', 0.5), W(p1.t.obrys, 'umber', 0.2), W(p2.t.obrys, 'umber', 0.2)],
    i: [I(blana, 0.9), I(lomena(obluk(yh + 3.6)), 0.7), I(lomena([[c - rx, yh - 1.4], [c - rx, yd + 1.4]]) + lomena([[c + rx, yh - 1.4], [c + rx, yd + 1.4]]), 0.9),
      I(lomena(obluk(yd - 3.6)), 0.7), I(lomena(obluk(yd + 1.4)), 0.9), I(lomena(cik), 0.5), ...ucha.map((d) => I(d, 0.45)),
      I(p1.t.obrys, 0.6), I(p2.t.obrys, 0.6), I(p1.hlava + p2.hlava, 0.6), I(elipsa(c, yh - 1.4, rx * 0.93, ry * 0.9), 0.3)],
    f: [],
  };
}

function akordeon() {
  const lx = 12, lx2 = 27, px = 59, px2 = 73;
  const lava = hladka([[lx + 2, 16, 1], [lx2, 15.4, 1], [lx2, 57.6, 1], [lx + 2, 57, 1], [lx, 54, 1], [lx, 19, 1]]);
  const prava = hladka([[px, 12.6, 1], [px2, 12, 1], [px2, 61, 1], [px, 60.4, 1]]);
  const mech = [];
  const zahyby = 9;
  for (let k = 0; k <= zahyby; k++) {
    const x = lx2 + ((px - lx2) * k) / zahyby;
    const t = k / zahyby, top = 15.4 - 2.8 * t, bot = 57.6 + 2.8 * t;
    mech.push([x, top + (k % 2 ? 1.6 : 0), x, bot - (k % 2 ? 1.6 : 0)]);
  }
  const mechObrys = mnoho([...mech.map(([x, y]) => [x, y]), ...mech.slice().reverse().map(([x, , , y]) => [x, y])]);
  const hrany = cesty(mech.slice(1, -1).map(([x, y1, , y2]) => usecka([x, y1], [x, y2])));
  const tmave = mech.slice(0, -1).filter((_, k) => k % 2 === 0).map(([x, y1, , y2], k) => { const n = mech[k * 2 + 1]; return mnoho([[x, y1], [n[0], n[1]], [n[0], n[3]], [x, y2]]); });
  const klavesy = mnoho([[px2, 13.6], [px2 + 12, 14.6], [px2 + 12, 59.4], [px2, 60.4]]);
  let biele = '', cierne = '';
  const nk = 17;
  for (let k = 1; k < nk; k++) { const t = k / nk; biele += usecka([px2, 13.6 + 46.8 * t], [px2 + 12, 14.6 + 44.8 * t]); }
  for (let k = 1; k < nk; k++) {
    if ([0, 3].includes(k % 7)) continue;
    const t = k / nk, y1 = 13.6 + 46.8 * t;
    cierne += mnoho([[px2, y1 - 0.9], [px2 + 6.4, y1 - 0.75], [px2 + 6.4, y1 + 0.75], [px2, y1 + 0.9]]);
  }
  let gombiky = '';
  for (let r = 0; r < 8; r++) for (let s = 0; s < 3; s++) gombiky += kruh(lx + 3.8 + s * 3.4 + (r % 2) * 1.7, 21 + r * 4.6, 0.95);
  const mriezka = hladka([[px + 2.4, 20], [px2 - 2.4, 19.6], [px2 - 2.4, 36], [px + 2.4, 36.2]]);
  let ornament = '';
  for (let k = 0; k < 4; k++) ornament += ciara([[px + 3.6, 22.4 + k * 3.4], [px + 7, 21 + k * 3.4], [px2 - 3.6, 22.4 + k * 3.4]]);
  return {
    w: [W(lava, 'alizarin', 0.55), W(lava, 'vermilion', 0.2), W(prava, 'alizarin', 0.55), W(prava, 'vermilion', 0.2), W(mechObrys, 'payne', 0.22), ...tmave.map((d) => W(d, 'payne', 0.5)),
      W(mriezka, 'lemon', 0.5), W(mriezka, 'ochre', 0.2), PAP(klavesy), W(klavesy, 'ochre', 0.08)],
    i: [I(lava, 0.9), I(prava, 0.9), I(mechObrys, 0.8), I(hrany, 0.45), I(klavesy, 0.7), I(biele, 0.3), I(mriezka, 0.5), I(ornament, 0.4),
      I(usecka([lx2 - 2.4, 18], [lx2 - 2.4, 55]), 0.3), I(gombiky, 0.35)],
    f: [F(cierne, 'ink'), F(gombiky, 'papier')],
  };
}

function xylofon() {
  const n = 8;
  const tyce = [];
  for (let k = 0; k < n; k++) {
    const x = 11 + k * 9.6, w = 7.2, y1 = 7 + k * 2.3, y2 = 48 - k * 1.7;
    tyce.push({ x, w, y1, y2, d: hladka([[x, y1 + 1.2], [x + 0.8, y1, 1], [x + w - 0.8, y1, 1], [x + w, y1 + 1.2], [x + w, y2 - 1.2], [x + w - 0.8, y2, 1], [x + 0.8, y2, 1], [x, y2 - 1.2]]) });
  }
  const lista = (f1) => { const a = tyce[0], b = tyce[n - 1]; const ya = f1(a), yb = f1(b); return mnoho([[a.x - 3, ya - 1.3], [b.x + b.w + 3, yb - 1.3], [b.x + b.w + 3, yb + 1.3], [a.x - 3, ya + 1.3]]); };
  const lh = lista((t) => t.y1 + (t.y2 - t.y1) * 0.22), ld = lista((t) => t.y1 + (t.y2 - t.y1) * 0.78);
  const klince = tyce.flatMap((t) => [0.22, 0.78].map((q) => kruh(t.x + t.w / 2, t.y1 + (t.y2 - t.y1) * q, 0.55)));
  const palicka = (a, b) => ({ t: rurka([a, b], 0.45, 2), h: kruh(b[0], b[1], 2.4) });
  const p1 = palicka([46, 66.4], [74, 54.4]), p2 = palicka([58, 67.4], [88, 60.8]);
  return {
    w: [W(lh, 'umber', 0.55), W(ld, 'umber', 0.55), ...tyce.map((t, k) => W(t.d, k % 2 ? 'sienna' : 'ochre', 0.5)), ...tyce.map((t) => W(t.d, 'sienna', 0.2)),
      W(p1.t.obrys + p2.t.obrys, 'ochre', 0.5), PAP(p1.h), PAP(p2.h), W(p1.h, 'vermilion', 0.6), W(p2.h, 'vermilion', 0.6)],
    i: [I(lh, 0.6), I(ld, 0.6), ...tyce.map((t) => I(t.d, 0.8)), I(p1.t.obrys + p2.t.obrys, 0.5), I(p1.h, 0.7), I(p2.h, 0.7)],
    f: [F(klince.join(''), 'umber')],
  };
}

function saxofon() {
  const os = [[33.6, 16], [34.6, 28], [36.4, 42], [39.2, 51.4], [43.6, 57.6], [49.6, 59.2], [54.6, 55.6], [57.2, 48], [58.2, 39], [58.6, 30]];
  const R = (s) => (s < 0.86 ? 1.9 + s * 3.2 : 1.9 + 0.86 * 3.2 + Math.pow((s - 0.86) / 0.14, 2) * 5.4);
  const telo = rurka(os, R, 8);
  const krk = rurka([[33.6, 16.6], [33.2, 12.4], [30.4, 9.2], [26, 8.6], [22.4, 9.4]], (s) => 1.6 - s * 0.7, 6);
  const hubicka = hladka([[22.8, 8.4, 1], [18.6, 8.4], [15.8, 9.4, 1], [18.6, 10.6], [22.8, 10.4, 1]]);
  const koniec = telo.os[telo.os.length - 1], predK = telo.os[telo.os.length - 4];
  const uh = (Math.atan2(koniec[1] - predK[1], koniec[0] - predK[0]) * 180) / Math.PI + 90;
  const ustie = elipsa(koniec[0], koniec[1], R(1), 1.8, uh);
  const klapky = [0.1, 0.18, 0.26, 0.34, 0.42, 0.5].map((q) => {
    const k = Math.round(q * (telo.os.length - 1)), p = telo.os[k], a = telo.A[k];
    return kruh(p[0] + (a[0] - p[0]) * 0.45, p[1] + (a[1] - p[1]) * 0.45, 1.25);
  });
  const velka = (() => { const k = Math.round(0.78 * (telo.os.length - 1)), p = telo.os[k], b = telo.B[k]; return kruh(p[0] + (b[0] - p[0]) * 0.35, p[1] + (b[1] - p[1]) * 0.35, 2.1); })();
  const tyc = lomena(telo.A.slice(Math.round(0.08 * telo.A.length), Math.round(0.56 * telo.A.length)).map(([x, y], k, pole) => { const p = telo.os[Math.round(0.08 * telo.A.length) + k]; return [x + (x - p[0]) * 0.35, y + (y - p[1]) * 0.35]; }));
  const lesk = lomena(telo.os.slice(4, Math.round(telo.os.length * 0.8)).map(([x, y], k) => { const b = telo.B[k + 4]; return [x + (b[0] - x) * 0.5, y + (b[1] - y) * 0.5]; }));
  return {
    w: [W(telo.obrys, 'ochre', 0.48), W(telo.obrys, 'lemon', 0.3), W(krk.obrys, 'ochre', 0.48), W(krk.obrys, 'lemon', 0.3), W(hubicka, 'payne', 0.75), W(ustie, 'sienna', 0.45),
      WS(lesk, 'papier', 0.85, 1)],
    i: [I(lomena(telo.A) + lomena(telo.B), 0.9), I(lomena(krk.A) + lomena(krk.B), 0.8), I(hubicka, 0.7), I(ustie, 0.9), ...klapky.map((d) => I(d, 0.55)), I(velka, 0.6), I(tyc, 0.4),
      I(usecka([22.9, 8.2], [22.9, 10.6]) + usecka([24.1, 8.3], [24.1, 10.4]), 0.5)],
    f: [...klapky.map((d) => PAP(d)), PAP(velka)],
  };
}

/* ══ Ocean Life ═══════════════════════════════════════════════════════════ */

function plejtvak() {
  const obrys = hladka([[4.6, 35.4, 1], [9, 31.4], [17, 28.8], [30, 27.4], [46, 27.6], [60, 29.4], [68.4, 31.4], [71.6, 29.2, 1], [74, 31.8], [80, 34.4], [85, 32.6], [90.6, 27], [96, 23.4, 1],
    [93.6, 30.4], [88.6, 36.4, 1], [93.8, 42.4], [96.2, 49.6, 1], [89.6, 44.4], [84.4, 39.2], [79, 38.8], [70, 41], [56, 43], [40, 44], [26, 43], [16, 41.2], [9, 38.6]]);
  const brucho = hladka([[9.4, 38.6], [16, 38.2], [26, 39.6], [40, 41.2], [52, 41.6], [56, 43], [40, 44], [26, 43], [16, 41.2]]);
  const pysk = ciara([[5.4, 35.8], [12, 36.6], [20, 36.8], [25.4, 35.6]]);
  const ryhy = cesty([0, 1, 2, 3].map((k) => ciara([[11 + k * 1.2, 38.6 + k * 0.8], [22, 39.6 + k * 0.9], [34 + k * 1.4, 41 + k * 0.7]])));
  const plutva = hladka([[30, 41.6, 1], [36, 44.6], [43.4, 50.2, 1], [39.4, 49.4], [31.6, 44.8]]);
  const nah = rozptyl(41);
  let skvrny = '';
  for (let k = 0; k < 16; k++) skvrny += elipsa(26 + nah() * 50, 30 + nah() * 7, 0.9 + nah() * 0.8, 0.5 + nah() * 0.3, -6);
  return {
    w: [W(obrys, 'ultramarine', 0.34), W(obrys, 'payne', 0.3), PAP(brucho), W(brucho, 'cerulean', 0.14), W(plutva, 'payne', 0.42), W(skvrny, 'cerulean', 0.35),
      W(hladka([[60, 30], [74, 32.4], [84, 34.4], [74, 38.6], [62, 40]]), 'payne', 0.16)],
    i: [I(obrys, 1), I(pysk, 0.6), I(ryhy, 0.3), I(plutva, 0.7), I(ciara([[20, 60], [30, 59.2], [40, 60.2]]) + ciara([[56, 63], [68, 62.2], [80, 63.2]]) + ciara([[34, 14], [44, 13.2], [52, 14.2]]), 0.35)],
    f: [F(kruh(24, 34.2, 0.75), 'ink'), F(kruh(58, 17, 0.9), 'papier'), F(kruh(61, 13.4, 0.6), 'papier')],
  };
}

function delfin() {
  const os = [[16, 54], [24, 42.6], [34, 33.4], [46, 27.6], [58, 26.4], [69, 28.8], [78, 33], [85, 37.6], [90.4, 40.6]];
  const R = (s) => (s < 0.55 ? 1.2 + Math.pow(s / 0.55, 0.8) * 5.8 : s < 0.82 ? 7 - ((s - 0.55) / 0.27) * 2.2 : s < 0.9 ? 4.8 - ((s - 0.82) / 0.08) * 2.6 : 2.2 - ((s - 0.9) / 0.1) * 1.2);
  const t = rurka(os, R, 8);
  const n = t.os.length, bod = (q) => Math.round(q * (n - 1));
  const chrbat = t.B[bod(0.5)], chrbat2 = t.B[bod(0.62)];
  const plutva = hladka([[chrbat[0] - 3, chrbat[1] + 0.6, 1], [chrbat[0] - 1, chrbat[1] - 5], [chrbat[0] - 3.6, chrbat[1] - 11, 1], [chrbat2[0] - 2, chrbat2[1] - 3], [chrbat2[0] + 1, chrbat2[1] + 0.4, 1]]);
  const hrud = t.A[bod(0.66)];
  const prsna = hladka([[hrud[0] + 2, hrud[1] - 1, 1], [hrud[0] - 3, hrud[1] + 4], [hrud[0] - 7.4, hrud[1] + 8.4, 1], [hrud[0] - 2, hrud[1] + 5], [hrud[0] - 4, hrud[1] - 0.8, 1]]);
  const chvost = hladka([[16.4, 52.6, 1], [11, 51], [4.6, 52.6, 1], [9.4, 55.4], [15, 56.4], [16.4, 62.6, 1], [19.6, 56.6], [17.6, 54]]);
  const od = bod(0.3), po = bod(0.93);
  const vnut = [];
  for (let j = po - 1; j >= od; j--) { const p = t.os[j], b = t.A[j]; vnut.push([p[0] + (b[0] - p[0]) * 0.25, p[1] + (b[1] - p[1]) * 0.25]); }
  const brucho = mnoho([...t.A.slice(od, po), ...vnut]);
  const oko0 = t.os[bod(0.83)], okoA = t.B[bod(0.83)];
  const e = [oko0[0] + (okoA[0] - oko0[0]) * 0.2, oko0[1] + (okoA[1] - oko0[1]) * 0.2];
  const usta = lomena(t.os.slice(bod(0.9), n).map((p, k) => { const b = t.A[bod(0.9) + k]; return [p[0] + (b[0] - p[0]) * 0.3, p[1] + (b[1] - p[1]) * 0.3]; }));
  const voda = ciara([[2, 62], [10, 61], [20, 62.4], [30, 61.6]]) + ciara([[40, 64.6], [54, 63.8], [66, 64.8]]) + ciara([[74, 60.4], [86, 59.6], [97, 60.4]]);
  const kvapky = [[24, 58.6, 0.8], [27, 55, 0.6], [11, 58, 0.7], [21, 63.4, 0.5], [8, 62.6, 0.5]].map(([x, y, r]) => kruh(x, y, r)).join('');
  return {
    w: [W(t.obrys, 'payne', 0.42), W(t.obrys, 'cerulean', 0.16), W(plutva, 'payne', 0.5), W(chvost, 'payne', 0.5), W(prsna, 'payne', 0.5), PAP(brucho), W(brucho, 'rose', 0.1),
      W(hladka([[2, 69, 1], [2, 62, 1], [20, 61.4], [50, 63.6], [80, 60], [98, 60.6, 1], [98, 69, 1]]), 'cerulean', 0.18)],
    i: [I(plutva, 0.8), I(chvost, 0.9), I(lomena(t.A) + lomena(t.B), 1), I(usecka(t.A[n - 1], t.B[n - 1]), 0.8), I(prsna, 0.7), I(usta, 0.5), I(voda, 0.45), I(kvapky, 0.4)],
    f: oko(e[0], e[1], 0.9),
  };
}

function zralok() {
  const obrys = hladka([[5, 37.4, 1], [9, 33], [18, 30.2], [32, 28.6], [38, 27.8, 1], [44, 18], [47.4, 11.4, 1], [48.6, 20], [51, 27, 1], [62, 28.4], [74, 31.4], [82, 33.6], [89, 25], [96.6, 14.4, 1],
    [93, 26.4], [89.4, 35.4, 1], [94.6, 45.4, 1], [86, 39.6], [80, 39], [72.6, 40.4, 1], [70, 43.8, 1], [66.4, 41.6], [58, 43.2], [52, 44.6, 1], [48, 48.4, 1], [45.2, 45.2], [36, 45.4], [24, 44.4], [14, 42.6], [8, 40.2]]);
  const brucho = hladka([[6, 38.6], [12, 38.2], [20, 39.4], [32, 39.6], [46, 39.4], [60, 38.4], [72, 36.4], [80, 36], [80, 39], [72.6, 40.4], [66.4, 41.6], [58, 43.2], [45.2, 45.2], [36, 45.4], [24, 44.4], [14, 42.6], [8, 40.2]]);
  const prsna = hladka([[31, 42.4, 1], [38, 45.6], [46.4, 57, 1], [39.4, 51.4], [30, 45.4]]);
  const ziabre = cesty([0, 1, 2, 3, 4].map((k) => ciara([[24 + k * 2.2, 33.8 + k * 0.2], [24.6 + k * 2.2, 37], [24 + k * 2.2, 40.4 - k * 0.1]])));
  const usta = ciara([[9.2, 41], [14, 41.6], [19, 41.2]]);
  return {
    w: [W(obrys, 'payne', 0.5), W(obrys, 'ultramarine', 0.14), PAP(brucho), W(brucho, 'payne', 0.05), W(prsna, 'payne', 0.5)],
    i: [I(obrys, 1), I(ciara([[6, 38.6], [12, 38.2], [20, 39.4], [32, 39.6], [46, 39.4], [60, 38.4], [72, 36.4], [80, 36]]), 0.4), I(prsna, 0.8), I(ziabre, 0.5), I(usta, 0.55),
      I(ciara([[18, 62], [30, 61.2], [42, 62.2]]) + ciara([[60, 60], [72, 59.2], [82, 60.2]]), 0.35)],
    f: oko(15, 34.4, 0.95),
  };
}

function chobotnica() {
  const plast = hladka([[50, 4.6], [58, 6.4], [62.6, 12.4], [62.6, 20], [59.6, 27], [56.4, 31.4], [50, 33], [43.6, 31.4], [40.4, 27], [37.4, 20], [37.4, 12.4], [42, 6.4]]);
  const ramena = [
    [[44, 31], [32, 33.4], [21, 38.4], [12.4, 45.6], [10.4, 52.4], [14.4, 55.2], [17.4, 51.6]],
    [[46, 33], [38, 41], [31.6, 50], [29.6, 58.4], [33.4, 62.6], [37.4, 59.6]],
    [[49, 33.6], [47, 44], [45.2, 54], [46.4, 62.4], [51, 64.4], [53, 60.4]],
    [[52, 33.4], [57, 43], [62, 51.4], [61.4, 58.6], [57, 59.4], [56.4, 55]],
    [[55, 32.4], [64, 38.4], [73, 45.4], [78, 53], [76, 58.4], [71.6, 56.4]],
    [[57, 30.6], [68, 32], [80, 35.4], [88.6, 40.6], [91.6, 46.6], [88, 48.6]],
    [[42.4, 29.6], [34, 27.4], [24, 27.4], [15.4, 24.6], [12, 19.6], [15.6, 17]],
    [[58, 29], [67, 25.6], [77, 25], [85, 21.4], [87.6, 16], [84, 14.4]],
  ];
  const rr = ramena.map((b, k) => rurka(b, (s) => (k > 5 ? 2.2 : 2.8) * Math.pow(1 - s * 0.88, 1.1) + 0.25, 7));
  const prisavky = [0, 1, 2, 3, 4, 5].map((k) => {
    const t = rr[k];
    let d = '';
    for (let j = 6; j < t.os.length - 6; j += 4) { const a = t.os[j], b = t.B[j]; d += kruh(a[0] + (b[0] - a[0]) * 0.55, a[1] + (b[1] - a[1]) * 0.55, Math.max(0.3, 0.7 - j * 0.012)); }
    return d;
  }).join('');
  const skvrny = [[46, 12, 1.4], [54, 10, 1.1], [56.6, 17.6, 1.3], [44, 20, 1.2], [51, 22, 0.9]].map(([x, y, r]) => kruh(x, y, r)).join('');
  return {
    w: [...rr.slice(6).map((t) => W(t.obrys, 'sienna', 0.45)), ...rr.slice(0, 6).map((t) => W(t.obrys, 'vermilion', 0.46)), ...rr.slice(0, 6).map((t) => W(t.obrys, 'ochre', 0.14)),
      PAP(plast), W(plast, 'vermilion', 0.5), W(plast, 'ochre', 0.18), W(tien(50, 18, 13.6, 0.5), 'alizarin', 0.2), W(skvrny, 'alizarin', 0.3)],
    i: [...rr.slice(6).map((t) => I(lomena(t.A) + lomena(t.B), 0.6)), ...rr.slice(0, 6).map((t) => I(lomena(t.A) + lomena(t.B), 0.75)), I(plast, 0.95), I(prisavky, 0.3),
      I(elipsa(44.6, 26.4, 2.6, 2.1) + elipsa(55.4, 26.4, 2.6, 2.1), 0.7)],
    f: [PAP(elipsa(44.6, 26.4, 2.4, 1.9)), PAP(elipsa(55.4, 26.4, 2.4, 1.9)), F(elipsa(44.6, 26.6, 1.5, 0.6), 'ink'), F(elipsa(55.4, 26.6, 1.5, 0.6), 'ink')],
  };
}

function korytnacka() {
  const T = umiestni(48, 35.4, -24, 1.12);
  const H = (b) => hladka(T(b));
  const pancier = H([[-17, 0], [-15, -8], [-8, -12.6], [2, -13.4], [11, -11], [16.4, -5], [17.4, 0], [16.4, 5], [11, 11], [2, 13.4], [-8, 12.6], [-15, 8]]);
  const hlava = H([[15.4, -3.2], [20, -4.4], [24.6, -3.6], [27.6, -1.4], [28.4, 0, 1], [27.6, 1.4], [24.6, 3.6], [20, 4.4], [15.4, 3.2]]);
  const plutvaL = H([[8, -9.6, 1], [5.4, -16], [0, -22.4], [-7, -26.6], [-12.6, -27.6, 1], [-8, -23], [-3.4, -17.4], [-0.4, -12.4, 1]]);
  const plutvaP = H([[8, 9.6, 1], [5.4, 16], [0, 22.4], [-7, 26.6], [-12.6, 27.6, 1], [-8, 23], [-3.4, 17.4], [-0.4, 12.4, 1]]);
  const zadnaL = H([[-12, -8.4, 1], [-17, -11], [-22.4, -11.4, 1], [-19, -7.6], [-15.4, -5.4, 1]]);
  const zadnaP = H([[-12, 8.4, 1], [-17, 11], [-22.4, 11.4, 1], [-19, 7.6], [-15.4, 5.4, 1]]);
  const chvost = H([[-16.4, -1.2, 1], [-20.6, 0, 1], [-16.4, 1.2, 1]]);
  const stred = [[-14, 0], [-7.6, 0], [-1.2, 0], [5.2, 0], [11.4, 0]];
  let stity = '';
  for (let k = 0; k < 5; k++) stity += mnoho(T([[stred[k][0] - 3, -3.2], [stred[k][0] + 3, -3.6], [stred[k][0] + 4.4, 0], [stred[k][0] + 3, 3.6], [stred[k][0] - 3, 3.2], [stred[k][0] - 4.4, 0]]));
  let rebra = '';
  for (const x of [-9.6, -3.4, 2.8, 8.6]) for (const s of [-1, 1]) rebra += usecka(...T([[x, 3.4 * s], [x - 1.4, 12.2 * s]]));
  const okraj = H([[-15, 0], [-13.4, -6.6], [-7.4, -10.8], [2, -11.6], [10, -9.6], [14.6, -4.4], [15.4, 0], [14.6, 4.4], [10, 9.6], [2, 11.6], [-7.4, 10.8], [-13.4, 6.6]]);
  const oci = T([[23.4, -2.4], [23.4, 2.4]]);
  const supinky = cesty([[20, -1.6], [20, 1.6], [23, 0], [17.6, 0]].map(([x, y]) => mnoho(T([[x - 1.1, y], [x, y - 0.9], [x + 1.1, y], [x, y + 0.9]]))));
  const stredPanciera = T([[0, 0]])[0], mp = 1.12 / 1.28;
  return {
    w: [W(plutvaL, 'sap', 0.4), W(plutvaP, 'sap', 0.4), W(zadnaL, 'sap', 0.4), W(zadnaP, 'sap', 0.4), W(hlava, 'sap', 0.42), W(hlava, 'ochre', 0.18), W(chvost, 'sap', 0.4),
      W(pancier, 'olive', 0.5), W(pancier, 'ochre', 0.28), W(stity, 'umber', 0.2), W(tien(stredPanciera[0], stredPanciera[1], 14 * mp, 0.6), 'umber', 0.12)],
    i: [I(plutvaL, 0.8), I(plutvaP, 0.8), I(zadnaL, 0.7), I(zadnaP, 0.7), I(hlava, 0.8), I(chvost, 0.6), I(pancier, 1), I(okraj, 0.4), I(stity, 0.5), I(rebra, 0.45), I(supinky, 0.3)],
    f: [F(kruh(oci[0][0], oci[0][1], 0.75), 'ink'), F(kruh(oci[1][0], oci[1][1], 0.75), 'ink')],
  };
}

function meduza() {
  const c = 50;
  const kraj = [];
  for (let k = 0; k <= 10; k++) kraj.push([31 + k * 3.8, 29.4 + (k % 2 ? 1.6 : 0), k % 2 ? 0 : 1]);
  const zvon = hladka([[31, 29.4, 1], [31.6, 22], [36, 14.4], [43, 10], [50, 8.8], [57, 10], [64, 14.4], [68.4, 22], [69, 29.4, 1], ...kraj.slice(1, -1).reverse()]);
  const gonady = [[-6, -1.6], [6, -1.6], [-2.6, 3.2], [2.6, 3.2]].map(([dx, dy]) => elipsa(c + dx, 20 + dy, 3.2, 2.4, dx * 8));
  const ramena = [[46, 30, -4], [49, 30.6, -1], [51.6, 30.6, 2], [54.6, 30, 5]].map(([x, y, sk]) => {
    const body = [];
    for (let k = 0; k <= 8; k++) body.push([x + sk * (k / 8) * 1.4 + Math.sin(k * 1.3 + x) * 1.6, y + k * 3.6]);
    return rurka(body, (s) => 1.6 - s * 0.9 + 0.5 * Math.abs(Math.sin(s * 22)), 5);
  });
  const chapadla = [];
  for (let k = 0; k <= 10; k++) {
    const x = 31.4 + k * 3.72, body = [];
    for (let j = 0; j <= 7; j++) body.push([x + Math.sin(j * 0.9 + k) * 1.3 + (x - c) * j * 0.02, 30.4 + j * 5]);
    chapadla.push(ciara(body));
  }
  return {
    w: [W(zvon, 'rose', 0.32), W(zvon, 'violet', 0.1), ...gonady.map((d) => W(d, 'violet', 0.35)), ...ramena.map((t) => W(t.obrys, 'rose', 0.38)), ...ramena.map((t) => W(t.obrys, 'violet', 0.12)),
      W(hladka([[36, 16], [43, 11.6], [50, 10.6], [57, 11.6], [64, 16], [57, 14.4], [50, 13.8], [43, 14.4]]), 'papier', 1), WS(chapadla.join(''), 'rose', 0.4, 0.8)],
    i: [I(zvon, 0.95), ...gonady.map((d) => I(d, 0.5)), ...ramena.map((t) => I(lomena(t.A) + lomena(t.B), 0.55)), I(chapadla.join(''), 0.3), I(ciara([[33, 26], [50, 27.6], [67, 26]]), 0.3)],
    f: [],
  };
}

function hviezdica() {
  const c = [50, 35], n = 5, zaklad = -100;
  const body = [];
  const zahnutie = [0, 6, -4, 3, -7];
  const bodR = (deg, rad) => { const x = (deg * Math.PI) / 180; return [c[0] + Math.cos(x) * rad, c[1] + Math.sin(x) * rad * 0.94]; };
  for (let k = 0; k < n; k++) {
    const a = zaklad + (k * 360) / n + zahnutie[k];
    body.push(bodR(a - 36, 10.2), bodR(a - 15, 17), bodR(a - 7, 25), bodR(a - 2.4, 29.4), bodR(a + 3, 29.8), bodR(a + 7.6, 25.4), bodR(a + 15, 17.4));
  }
  const obrys = hladka(body);
  let bodky = '', stredy = '';
  for (let k = 0; k < n; k++) {
    const a = zaklad + (k * 360) / n + zahnutie[k];
    for (let j = 1; j <= 6; j++) {
      const rad = 3.6 + j * 3.9, p = bodR(a, rad);
      stredy += kruh(p[0], p[1], Math.max(0.45, 1.15 - j * 0.12));
      if (j < 5) for (const sk of [-1, 1]) { const q = bodR(a + sk * (15 - j * 1.6), rad + 1); bodky += kruh(q[0], q[1], 0.5); }
    }
  }
  const tien2 = hladka(body.map(([x, y]) => [x + 1.4, y + 1.8]));
  return {
    w: [W(tien2, 'umber', 0.12), W(obrys, 'vermilion', 0.5), W(obrys, 'ochre', 0.3), W(kruh(c[0], c[1], 7), 'alizarin', 0.14)],
    i: [I(obrys, 1), I(kruh(c[0], c[1], 1.5), 0.4)],
    f: [F(stredy, 'papier'), F(bodky, 'umber')],
  };
}

function konik() {
  const os = [[46.6, 16], [45, 23.4], [42.6, 31], [42.6, 39], [46, 45.6], [50.4, 51.6], [50.8, 58.6], [46.6, 62.8], [41.6, 61.4], [40.6, 56.8], [44.4, 55.2], [46.8, 57.4]];
  const R = (s) => (s < 0.12 ? 5 + s * 18 : s < 0.34 ? 7.2 - (s - 0.12) * 6 : Math.max(0.5, 5.9 - (s - 0.34) * 9.2));
  const t = rurka(os, R, 8);
  const hlava = hladka([[24.6, 12.2, 1], [30, 11.4], [35.6, 9.6], [38.6, 6.8], [43, 5.8], [47.6, 8.4], [49.4, 12.6], [49, 17], [45.6, 19.4], [40.4, 16.6], [36, 15], [30, 14.6], [24.6, 14.8, 1]]);
  const korunka = lomena([[39.8, 6.6], [40.2, 3.4], [41.6, 5.8], [43, 2.8], [44.2, 5.8], [46, 4], [46.2, 7.4]]);
  const n = t.os.length;
  let kruzky = '';
  for (let k = 3; k < n - 10; k += 3) kruzky += usecka(t.A[k], t.B[k]);
  const chrbatB = t.B[Math.round(n * 0.28)], chrbatB2 = t.B[Math.round(n * 0.4)];
  const plutva = hladka([[chrbatB[0] - 0.4, chrbatB[1], 1], [chrbatB[0] + 5.4, chrbatB[1] + 1], [chrbatB2[0] + 5, chrbatB2[1] - 1], [chrbatB2[0] - 0.4, chrbatB2[1], 1]]);
  let luce = '';
  for (let k = 1; k < 5; k++) { const q = k / 5; luce += usecka([chrbatB[0] + (chrbatB2[0] - chrbatB[0]) * q, chrbatB[1] + (chrbatB2[1] - chrbatB[1]) * q], [chrbatB[0] + 5.2 + (chrbatB2[0] - chrbatB[0]) * q, chrbatB[1] + 1 + (chrbatB2[1] - 2 - chrbatB[1]) * q]); }
  const trava = [[18, 70, 14, 40, 18, 12], [24, 70, 28, 48, 22, 30], [74, 70, 70, 44, 78, 20], [80, 70, 86, 50, 82, 34]].map(([x1, y1, x2, y2, x3, y3]) => rurka([[x1, y1], [x2, y2], [x3, y3]], (s) => 1.6 * (1 - s) + 0.3, 6));
  return {
    w: [...trava.map((r) => W(r.obrys, 'sap', 0.35)), W(t.obrys, 'ochre', 0.5), W(t.obrys, 'lemon', 0.26), W(hlava, 'ochre', 0.5), W(hlava, 'lemon', 0.26), W(plutva, 'lemon', 0.3),
      W(hladka([[41, 25], [42.6, 31], [42.6, 39], [45, 43], [43.6, 36], [43.4, 30]]), 'sienna', 0.3)],
    i: [...trava.map((r) => I(lomena(r.A) + lomena(r.B), 0.4)), I(lomena(t.A) + lomena(t.B), 0.95), I(usecka(t.A[n - 1], t.B[n - 1]), 0.6), I(hlava, 0.95), I(korunka, 0.6), I(kruzky, 0.35),
      I(plutva, 0.6), I(luce, 0.3)],
    f: oko(42.4, 10.6, 1),
  };
}

function krab() {
  const pancier = hladka([[33, 38], [34, 32], [38.4, 28.4], [44, 26.8], [50, 26.4], [56, 26.8], [61.6, 28.4], [66, 32], [67, 38], [63.4, 44.6], [56, 48.4], [50, 49], [44, 48.4], [36.6, 44.6]]);
  let zuby = '';
  for (let k = 0; k < 4; k++) for (const s of [-1, 1]) { const x = 50 + s * (8 + k * 3.6), y = 27.2 + k * k * 0.55; zuby += lomena([[x - s * 1.4, y + 0.2], [x + s * 0.4, y - 1.6], [x + s * 1.6, y + 0.6]]); }
  const oci = [[46, 26.6], [54, 26.6]];
  const stopky = cesty(oci.map(([x, y]) => usecka([x, y], [x + (x < 50 ? -1 : 1), y - 5.4])));
  const noha = (s, k) => {
    // Štyri páry nôh vejárovito: predné smerujú von a hore, zadné dozadu a dole.
    const x0 = 50 + s * (15.4 - k * 0.8), y0 = 34 + k * 3.8;
    const b = [[x0, y0], [x0 + s * (9 - k * 0.6), y0 - 5 + k * 2.2], [x0 + s * (15 - k * 2.2), y0 + 3 + k * 3.4], [x0 + s * (17.6 - k * 3.6), y0 + 9 + k * 3.8]];
    return rurka(b, (q) => 1.4 - q * 0.9, 3);
  };
  const nohy = [0, 1, 2, 3].flatMap((k) => [noha(-1, k), noha(1, k)]);
  const klepeto = (s) => {
    const T = (b) => b.map(([x, y, k]) => (k ? [50 + s * x, y, k] : [50 + s * x, y]));
    const rameno = rurka(T([[14, 31], [21, 26], [25, 20.4]]), 1.9, 4);
    const dlan = hladka(T([[21.6, 20.6, 1], [22.4, 15.6], [26, 12], [30.4, 10.8], [34.4, 12.2], [36.6, 9], [38.6, 4.4, 1], [38.4, 10], [36.6, 15], [32.4, 19.2], [27.6, 22.6], [23.4, 22.6]]));
    const prst = hladka(T([[31, 12.2, 1], [30.6, 7.4], [31.8, 3.6, 1], [33.4, 7], [33.4, 11.4, 1]]));
    return { rameno, dlan, prst };
  };
  const kl = [klepeto(-1), klepeto(1)];
  return {
    w: [...nohy.map((t) => W(t.obrys, 'vermilion', 0.46)), ...kl.map((k) => W(k.rameno.obrys, 'vermilion', 0.5)), ...kl.flatMap((k) => [W(k.dlan, 'vermilion', 0.56), W(k.prst, 'vermilion', 0.5)]),
      W(pancier, 'vermilion', 0.55), W(pancier, 'sienna', 0.22), W(hladka([[40, 30], [50, 28.6], [60, 30], [56, 34], [44, 34]]), 'ochre', 0.2)],
    i: [...nohy.map((t) => I(lomena(t.A) + lomena(t.B), 0.6)), ...kl.map((k) => I(lomena(k.rameno.A) + lomena(k.rameno.B), 0.7)), ...kl.flatMap((k) => [I(k.dlan, 0.85), I(k.prst, 0.8)]),
      I(pancier, 1), I(zuby, 0.5), I(stopky, 0.7), I(ciara([[42, 36], [50, 38.6], [58, 36]]), 0.35)],
    f: oci.map(([x, y]) => F(kruh(x + (x < 50 ? -1 : 1), y - 6, 1.2), 'ink')),
  };
}

function mroz() {
  const telo = hladka([[11, 38.6], [13, 32], [17.6, 27.6], [24, 25.4], [32, 25.6], [44, 23.4], [56, 25.4], [68, 31.4], [78, 39], [85, 44.6], [91.4, 45.4, 1], [95.6, 50.4, 1], [88, 52.4], [80, 55],
    [64, 56.6], [46, 56.6], [38, 56], [34, 58.8, 1], [24.6, 58.6, 1], [27.4, 54], [22, 50.4], [16, 46], [12.4, 43]]);
  const cumak = hladka([[10.4, 38.6], [12.2, 35], [16, 34.2], [20.6, 36], [22, 40.2], [20, 44.2], [15.4, 45.2], [11.6, 43.4]]);
  const kly = [[14.4, 43.6, 12.6, 61.4], [18.8, 44.2, 18.4, 62.4]].map(([x1, y1, x2, y2]) => hladka([[x1 - 1.2, y1, 1], [x1 + 1.3, y1, 1], [x2 + 0.9, y2 - 4], [x2, y2, 1], [x2 - 0.8, y2 - 4.4]]));
  let fuzy = '';
  for (let k = 0; k < 6; k++) fuzy += usecka([12 + k * 1.5, 38.6 + (k % 2) * 1.8], [7 + k * 1.8, 41 + k * 1.2]);
  let bodky = '';
  for (let k = 0; k < 9; k++) bodky += kruh(12.6 + (k % 3) * 2.6, 37 + Math.floor(k / 3) * 2.2, 0.35);
  const zahyby = ciara([[27, 28.4], [28.6, 36], [27.6, 44]]) + ciara([[33, 27.4], [34.4, 34]]) + ciara([[60, 30], [58, 36]]);
  const lad = hladka([[2, 56.6, 1], [98, 56.6, 1], [96, 63.4, 1], [4, 63.4, 1]]);
  return {
    w: [W(lad, 'cerulean', 0.16), PAP(telo), W(telo, 'sienna', 0.42), W(telo, 'rose', 0.3), W(hladka([[40, 48], [60, 46], [80, 50], [80, 55], [64, 56.6], [46, 56.6], [38, 56]]), 'umber', 0.2),
      W(cumak, 'rose', 0.35), ...kly.map((d) => PAP(d)), ...kly.map((d) => W(d, 'ochre', 0.2)), W(hladka([[0, 70, 1], [0, 64.4, 1], [100, 64.4, 1], [100, 70, 1]]), 'cerulean', 0.3)],
    i: [I(telo, 1), I(cumak, 0.7), ...kly.map((d) => I(d, 0.8)), I(fuzy, 0.3), I(zahyby, 0.35), I(lad, 0.6), I(ciara([[8, 66.6], [20, 66], [32, 66.8]]) + ciara([[60, 67.6], [74, 67], [88, 67.8]]), 0.4)],
    f: [...oko(22.6, 31.6, 0.8), F(bodky, 'umber')],
  };
}

/* ══ Great Inventions ═════════════════════════════════════════════════════ */

/* Body elipsy (na zakrývanie a hrubé kolesá). */
function elipsaBody(cx, cy, rx, ry, n = 48, uhol = 0) {
  const b = [];
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; b.push(otoc([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry], [cx, cy], uhol)); }
  return b;
}

function koleso() {
  // Dve plné drevené kolesá na jednej osi, ako koleso z Ľubľanského močiara: dosky, štvorcová diera, os.
  const pred = elipsaBody(35, 37, 14, 25), zad = elipsaBody(75, 28, 9.4, 17);
  const hrubka = elipsaBody(38.4, 36, 14, 25), hrubkaZ = elipsaBody(77.4, 27.4, 9.4, 17);
  const skryte = (p) => vnutri(p, pred);
  const os = rurka([[36, 37], [60, 32], [83, 27.2]], 1.9, 3);
  const osVid = viditelne(os.A, skryte) + viditelne(os.B, skryte);
  const skryteZ = (p) => vnutri(p, pred) || (vnutri(p, zad) && false);
  const dosky = cesty([-5, 5].map((dx) => viditelne(vzorky([[35 + dx, 12], [35 + dx * 1.02, 37], [35 + dx, 62]], 6), (p) => !vnutri(p, pred))));
  const letokruhy = cesty([[26, 22, 27, 34], [44, 44, 43, 56], [29, 46, 28, 54], [42, 18, 43, 26]].map(([x1, y1, x2, y2]) => ciara([[x1, y1], [x1 + 1.2, (y1 + y2) / 2], [x2, y2]])));
  const diera = mnoho([[32.8, 34.6], [37.2, 34.6], [37.2, 39.4], [32.8, 39.4]]);
  const koniecOsi = mnoho([[33.4, 35.3], [36.6, 35.3], [36.6, 38.7], [33.4, 38.7]]);
  const hrubkaVid = viditelne([...hrubka, hrubka[0]], skryte);
  const hrubkaZVid = viditelne([...hrubkaZ, hrubkaZ[0]], (p) => vnutri(p, zad) || vnutri(p, pred));
  const zem = ciara([[4, 63.6], [30, 62.6], [60, 63], [96, 62]]);
  return {
    w: [W(mnoho(hrubkaZ), 'umber', 0.45), W(mnoho(zad), 'ochre', 0.45), W(mnoho(zad), 'umber', 0.2), W(os.obrys, 'umber', 0.55), W(mnoho(hrubka), 'umber', 0.5),
      PAP(mnoho(pred)), W(mnoho(pred), 'ochre', 0.48), W(mnoho(pred), 'sienna', 0.16), W(diera, 'payne', 0.5), W(koniecOsi, 'umber', 0.6)],
    i: [I(hrubkaZVid, 0.7), I(lomena([...zad, zad[0]].filter((p) => !vnutri(p, pred))), 0.8), I(osVid, 0.8), I(hrubkaVid, 0.8), I(mnoho(pred), 1), I(dosky, 0.45), I(letokruhy, 0.3),
      I(diera, 0.6), I(koniecOsi, 0.5), I(zem, 0.35)],
    f: [],
  };
}

function dalekohlad() {
  const tubus = rurka([[16, 45.6], [50, 30.4], [84, 15.2]], (s) => 2.5 + s * 1.5 + (s > 0.86 ? 0.6 : 0), 3);
  const n = tubus.os.length, q = (s) => Math.round(s * (n - 1));
  const kruzky = cesty([0.3, 0.56, 0.86].map((s) => usecka(tubus.A[q(s)], tubus.B[q(s)])));
  const okular = rurka([[16.4, 45.4], [10.4, 48.2]], 1.3, 2);
  const hladacik = rurka([[40, 30.8], [58, 22.8]], 0.9, 2);
  const nozky = cesty([[40, 36.4], [60, 32.6]].map(([x, y]) => usecka([x, y], [x + 1, y - 3.2])));
  const hlava = hladka([[44.4, 36.4, 1], [53.6, 36.4, 1], [53, 40.6, 1], [45, 40.6, 1]]);
  const vidlica = lomena([[46.4, 36.4], [46.8, 31.4]]) + lomena([[51.6, 36.4], [52, 29.4]]);
  const noha = (a, b) => rurka([a, b], 1.05, 2);
  const nohy = [noha([47, 41], [28, 67]), noha([51, 41], [68, 67]), noha([49, 41], [50, 68.6])];
  const objektiv = elipsa(tubus.os[n - 1][0], tubus.os[n - 1][1], 1.3, 4.6, -24);
  return {
    w: [...nohy.map((r) => W(r.obrys, 'umber', 0.5)), W(hlava, 'umber', 0.6), W(tubus.obrys, 'ochre', 0.48), W(tubus.obrys, 'lemon', 0.28), W(okular.obrys, 'payne', 0.55),
      W(hladacik.obrys, 'ochre', 0.5), W(objektiv, 'cerulean', 0.35), WS(lomena(tubus.os.slice(2, n - 2).map((p, k) => { const a = tubus.B[k + 2]; return [p[0] + (a[0] - p[0]) * 0.5, p[1] + (a[1] - p[1]) * 0.5]; })), 'papier', 0.8, 0.9)],
    i: [...nohy.map((r) => I(lomena(r.A) + lomena(r.B), 0.6)), I(hlava, 0.7), I(vidlica, 0.6), I(tubus.obrys, 0.95), I(kruzky, 0.5), I(okular.obrys, 0.7), I(hladacik.obrys, 0.6), I(nozky, 0.5), I(objektiv, 0.7)],
    f: [],
  };
}

function telefon() {
  const telo = hladka([[20, 60.4, 1], [80, 60.4, 1], [75, 44], [69, 33.6], [62, 31], [38, 31], [31, 33.6], [25, 44]]);
  const podstava = hladka([[17.6, 60.4, 1], [82.4, 60.4, 1], [82.4, 63, 1], [17.6, 63, 1]]);
  const c = [50, 47.4], r = 10.6;
  const diery = [];
  for (let k = 0; k < 10; k++) { const a = ((-60 - k * 28) * Math.PI) / 180; diery.push(kruh(c[0] + Math.cos(a) * 7.4, c[1] + Math.sin(a) * 7.4, 1.5)); }
  const zarazka = ciara([[c[0] + 9.8, c[1] + 3.4], [c[0] + 12.2, c[1] + 5.8]]);
  const sluchadlo = hladka([[13, 26.4, 1], [14.6, 21.4], [20, 18.4], [30, 17.2], [50, 16.6], [70, 17.2], [80, 18.4], [85.4, 21.4], [87, 26.4, 1], [85.6, 30.6, 1], [74, 30.6, 1], [72.4, 26], [66, 23.4],
    [50, 22.8], [34, 23.4], [27.6, 26], [26, 30.6, 1], [14.4, 30.6, 1]]);
  const vidlicky = lomena([[33.6, 31], [33.6, 26.6], [37, 25.6]]) + lomena([[66.4, 31], [66.4, 26.6], [63, 25.6]]);
  const snura = [];
  for (let k = 0; k <= 60; k++) { const t = k / 60; snura.push([20.4 - t * 12 + Math.cos(t * 50) * 1.6, 56 - t * 24 + Math.sin(t * 50) * 1.6]); }
  return {
    w: [W(podstava, 'payne', 0.7), W(telo, 'payne', 0.66), W(sluchadlo, 'payne', 0.7), PAP(kruh(c[0], c[1], r)), W(kruh(c[0], c[1], r), 'ochre', 0.2), PAP(kruh(c[0], c[1], 3.6)),
      W(kruh(c[0], c[1], 3.6), 'vermilion', 0.35), WS(ciara([[34, 34], [40, 32.6], [50, 32.4]]), 'papier', 0.6, 1), WS(ciara([[20, 19.6], [30, 18.4], [44, 18]]), 'papier', 0.55, 1)],
    i: [I(podstava, 0.8), I(telo, 0.95), I(sluchadlo, 0.95), I(vidlicky, 0.7), I(kruh(c[0], c[1], r), 0.8), ...diery.map((d) => I(d, 0.5)), I(kruh(c[0], c[1], 3.6), 0.5), I(zarazka, 0.7),
      I(lomena(snura), 0.4)],
    f: diery.map((d) => F(d, 'payne')),
  };
}

function mikroskop() {
  const podstava = hladka([[26, 64.6, 1], [28.4, 59.4], [40, 57.6], [66, 57.6], [72, 59.6], [72.6, 64.6, 1]]);
  const stlpik = hladka([[60.6, 57.8, 1], [60.6, 44, 1], [65.4, 44, 1], [65.4, 57.8, 1]]);
  const rameno = hladka([[60.8, 45, 1], [62.6, 36], [61.6, 27], [57, 19.6], [51.2, 15.4, 1], [48.6, 19.6, 1], [53.4, 23.6], [56.6, 29.4], [57.2, 37], [56, 44.4, 1]]);
  const tubus = rurka([[45.6, 9], [44, 22], [42.4, 33.4]], 3.4, 3);
  const okular = hladka([[43.2, 9.4, 1], [43.6, 3.6, 1], [49, 4.2, 1], [48.4, 10, 1]]);
  const objektiv = hladka([[39.4, 33.4, 1], [45.6, 34.2, 1], [44, 39.4, 1], [41, 39.2, 1]]);
  const stolik = hladka([[22, 41.6, 1], [62, 41.6, 1], [62, 44.6, 1], [22, 44.6, 1]]);
  const sklicko = mnoho([[33, 40.4], [51, 40.4], [51, 41.6], [33, 41.6]]);
  const zrkadlo = elipsa(42.6, 51.4, 4.6, 2.4, -14);
  const drziak = lomena([[37.4, 52], [37, 46.4]]) + lomena([[47.8, 50.2], [48.4, 46.4]]);
  const koliesko = kruh(62.6, 26.6, 3.6);
  return {
    w: [W(podstava, 'payne', 0.66), W(stlpik, 'ochre', 0.5), W(rameno, 'ochre', 0.5), W(rameno, 'lemon', 0.25), W(tubus.obrys, 'ochre', 0.48), W(tubus.obrys, 'lemon', 0.28),
      W(okular, 'payne', 0.5), W(objektiv, 'ochre', 0.55), W(stolik, 'payne', 0.62), W(sklicko, 'cerulean', 0.3), W(zrkadlo, 'cerulean', 0.4), W(koliesko, 'ochre', 0.55)],
    i: [I(podstava, 0.9), I(stlpik, 0.7), I(rameno, 0.85), I(tubus.obrys, 0.9), I(usecka(tubus.A[2], tubus.B[2]) + usecka(tubus.A[5], tubus.B[5]), 0.4), I(okular, 0.7), I(objektiv, 0.7),
      I(stolik, 0.8), I(sklicko, 0.5), I(zrkadlo, 0.7), I(drziak, 0.6), I(koliesko, 0.6), I(kruh(62.6, 26.6, 1.2), 0.4)],
    f: [F(kruh(40.8, 43.1, 0.5), 'papier')],
  };
}

function fotoaparat() {
  const zadna = hladka([[15, 14.6, 1], [30, 17, 1], [30, 51, 1], [15, 55.4, 1]]);
  const zadnaV = hladka([[17.4, 18.2, 1], [27.6, 19.8, 1], [27.6, 48.8, 1], [17.4, 51.6, 1]]);
  const mech = [];
  const zahyby = 8;
  for (let k = 0; k <= zahyby; k++) {
    const t = k / zahyby, x = 30 + t * 30, hore = 18 + t * 7, dole = 50 - t * 6;
    mech.push([x, hore + (k % 2 ? 1.4 : 0), x, dole - (k % 2 ? 1.4 : 0)]);
  }
  const mechObrys = mnoho([...mech.map(([x, y]) => [x, y]), ...mech.slice().reverse().map(([x, , , y]) => [x, y])]);
  const zahybyD = cesty(mech.slice(1, -1).map(([x, y1, , y2]) => usecka([x, y1], [x, y2])));
  const predna = hladka([[60, 21.6, 1], [66, 20.6, 1], [66, 48, 1], [60, 47, 1]]);
  const objektiv = rurka([[66, 34.2], [80, 34.2]], (s) => 6.4 - s * 1.6, 2);
  const sklo = elipsa(80, 34.2, 1.7, 4.8);
  const doska = hladka([[10, 55, 1], [74, 50.4, 1], [78, 53.4, 1], [14, 58.6, 1]]);
  const nohy = [[[34, 57.4], [22, 69]], [[40, 57], [56, 69]], [[37, 57.4], [38, 69.6]]].map(([a, b]) => rurka([a, b], 0.9, 2));
  return {
    w: [...nohy.map((r) => W(r.obrys, 'umber', 0.5)), W(doska, 'sienna', 0.5), W(doska, 'ochre', 0.2), W(mechObrys, 'alizarin', 0.42), W(mechObrys, 'payne', 0.2),
      ...mech.slice(0, -1).filter((_, k) => k % 2 === 0).map(([x, y1, , y2], k) => { const nn = mech[k * 2 + 1]; return W(mnoho([[x, y1], [nn[0], nn[1]], [nn[0], nn[3]], [x, y2]]), 'payne', 0.3); }),
      W(zadna, 'sienna', 0.55), W(zadna, 'ochre', 0.2), W(zadnaV, 'payne', 0.2), W(zadnaV, 'cerulean', 0.1), W(predna, 'sienna', 0.55), W(objektiv.obrys, 'ochre', 0.55), W(objektiv.obrys, 'lemon', 0.25),
      W(sklo, 'cerulean', 0.4)],
    i: [...nohy.map((r) => I(lomena(r.A) + lomena(r.B), 0.6)), I(doska, 0.8), I(mechObrys, 0.8), I(zahybyD, 0.4), I(zadna, 0.9), I(zadnaV, 0.5), I(predna, 0.9), I(objektiv.obrys, 0.85),
      I(usecka(objektiv.A[1], objektiv.B[1]), 0.4), I(sklo, 0.7)],
    f: [F(kruh(79.4, 32, 0.7), 'papier')],
  };
}

function bicykel() {
  const zk = [25, 46], pk = [76, 46], R = 15.4;
  const pedal = [49, 48];
  const koleso2 = ([x, y]) => {
    let luce = '';
    for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; luce += usecka([x + Math.cos(a) * 1.4, y + Math.sin(a) * 1.4], [x + Math.cos(a + 0.2) * (R - 2), y + Math.sin(a + 0.2) * (R - 2)]); }
    return { plast: kruh(x, y, R) + kruh(x, y, R - 2.2), vonka: kruh(x, y, R), vnutro: kruh(x, y, R - 2.2), luce };
  };
  const k1 = koleso2(zk), k2 = koleso2(pk);
  const sedlo = [43, 25], hlava = [69, 26];
  const ram = [
    rurka([pedal, sedlo], 1.1, 2), rurka([pedal, [68.4, 29.6]], 1.2, 2), rurka([[43.6, 27.6], hlava], 1.05, 2),
    rurka([pedal, zk], 0.8, 2), rurka([[43.4, 28], zk], 0.75, 2), rurka([hlava, [70.4, 31], [74, 40], pk], 0.9, 4),
  ];
  const riadidla = ciara([[69, 26], [67.6, 20.4], [63, 18.6], [59.4, 19.6]]);
  const sedadlo = hladka([[36.4, 22.8, 1], [41, 20.8], [47, 21], [48.4, 22.6, 1], [44, 24.4], [38, 24.4]]);
  const prevodnik = kruh(pedal[0], pedal[1], 4.2);
  const retaz = usecka([pedal[0], pedal[1] - 4.2], [zk[0], zk[1] - 2]) + usecka([pedal[0], pedal[1] + 4.2], [zk[0], zk[1] + 2]);
  const klucka = usecka(pedal, [pedal[0] + 4.4, pedal[1] + 6.4]) + usecka([pedal[0] + 2.4, pedal[1] + 6.6], [pedal[0] + 6.8, pedal[1] + 6.2]);
  return {
    w: [WS(k1.plast, 'payne', 0.6, 1.2), WS(k2.plast, 'payne', 0.6, 1.2), ...ram.map((r) => W(r.obrys, 'viridian', 0.62)), W(sedadlo, 'umber', 0.62), W(prevodnik, 'ochre', 0.4)],
    i: [I(k1.vonka + k1.vnutro, 0.8), I(k2.vonka + k2.vnutro, 0.8), I(k1.luce + k2.luce, 0.2), ...ram.map((r) => I(r.obrys, 0.6)), I(riadidla, 0.8), I(sedadlo, 0.7), I(prevodnik, 0.6), I(retaz, 0.35),
      I(klucka, 0.7), I(kruh(zk[0], zk[1], 2) + kruh(pk[0], pk[1], 1.4), 0.5)],
    f: [F(kruh(zk[0], zk[1], 0.7), 'ink'), F(kruh(pk[0], pk[1], 0.7), 'ink'), F(elipsa(59.2, 19.6, 1.6, 1), 'umber')],
  };
}

function ziarovka() {
  const sklo = hladka([[42.2, 44.4, 1], [41.4, 38.6], [37, 32.6], [34.6, 25], [36.6, 16.4], [42.4, 10.4], [50, 8.4], [57.6, 10.4], [63.4, 16.4], [65.4, 25], [63, 32.6], [58.6, 38.6], [57.8, 44.4, 1]]);
  const patica = hladka([[42.2, 44.4, 1], [57.8, 44.4, 1], [57.2, 57, 1], [53.6, 59.4, 1], [46.4, 59.4, 1], [42.8, 57, 1]]);
  const zavity = cesty([46.6, 49.4, 52.2, 55].map((y) => ciara([[42.4, y], [50, y + 1.2], [57.6, y]])));
  const kontakt = hladka([[46.4, 59.4, 1], [53.6, 59.4, 1], [52, 62.4], [48, 62.4]]);
  const drotky = ciara([[47.6, 44], [46.6, 36], [44.4, 25]]) + ciara([[52.4, 44], [53.4, 36], [55.6, 25]]) + usecka([50, 44.4], [50, 30]);
  const vlakno = [];
  for (let k = 0; k <= 36; k++) { const t = k / 36; vlakno.push([44.4 + t * 11.2, 25 - Math.sin(t * Math.PI) * 3.6 + Math.sin(t * Math.PI * 18) * 0.9]); }
  let luce = '';
  for (let k = 0; k < 11; k++) { const a = ((-200 + k * 22) * Math.PI) / 180; luce += usecka([50 + Math.cos(a) * 21, 24 + Math.sin(a) * 19.6], [50 + Math.cos(a) * 25.6, 24 + Math.sin(a) * 23.4]); }
  return {
    w: [W(sklo, 'lemon', 0.22), W(sklo, 'cerulean', 0.05), W(kruh(50, 23.4, 7.6), 'lemon', 0.4), W(patica, 'ochre', 0.48), W(patica, 'payne', 0.12), W(kontakt, 'payne', 0.6),
      WS(ciara([[39.6, 20], [42, 14], [47, 11.2]]), 'papier', 1, 1.4), WS(luce, 'lemon', 0.9, 1.4), WS(lomena(vlakno), 'vermilion', 0.6, 1.1)],
    i: [I(sklo, 0.95), I(patica, 0.85), I(zavity, 0.5), I(kontakt, 0.6), I(drotky, 0.4), I(lomena(vlakno), 0.6), I(luce, 0.45)],
    f: [],
  };
}

function gramofon() {
  const vrch = mnoho([[16, 49.4], [54, 49.4], [63, 43], [25, 43]]);
  const predok = mnoho([[16, 49.4], [54, 49.4], [54, 62.6], [16, 62.6]]);
  const bok = mnoho([[54, 49.4], [63, 43], [63, 56], [54, 62.6]]);
  const platna = elipsa(38.6, 46.4, 16.4, 3.4);
  const nalepka = elipsa(38.6, 46.4, 4, 0.9);
  const lievik = [];
  const krk = [[57.6, 44.4], [60.6, 37.4], [63.2, 29.8], [67.8, 22.4], [74.6, 16.2], [83.6, 11]];
  const t = rurka(krk, (s) => 0.9 + Math.pow(s, 2.1) * 12.4, 6);
  const koniec = t.os[t.os.length - 1];
  const ustie = elipsa(koniec[0], koniec[1], 13, 4.6, 60);
  let platky = '';
  for (const q of [0.25, 0.5, 0.75]) platky += lomena(t.os.map((p, k) => { const a = t.A[k], b = t.B[k]; return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q]; }).slice(Math.round(t.os.length * 0.3)));
  const ramienko = ciara([[57.6, 44.4], [52, 44.8], [46.6, 45.8]]);
  const hlavicka = kruh(45.6, 46, 1.6);
  const klucka = lomena([[63, 50], [67.4, 50.6], [68, 55]]) + kruh(68, 55.8, 0.9);
  void lievik;
  return {
    w: [W(predok, 'sienna', 0.55), W(bok, 'umber', 0.58), W(vrch, 'ochre', 0.4), W(vrch, 'sienna', 0.2), W(platna, 'payne', 0.78), W(nalepka, 'vermilion', 0.6),
      W(t.obrys, 'ochre', 0.5), W(t.obrys, 'lemon', 0.28), W(ustie, 'sienna', 0.4), W(ustie, 'ochre', 0.3), W(kruh(45.6, 46, 1.6), 'ochre', 0.6)],
    i: [I(predok, 0.85), I(bok, 0.8), I(vrch, 0.7), I(platna, 0.7), I(mnoho([[21, 52.6], [49, 52.6], [49, 59.6], [21, 59.6]]), 0.35), I(lomena(t.A) + lomena(t.B), 0.9), I(platky, 0.3), I(ustie, 0.9),
      I(ramienko, 0.7), I(hlavicka, 0.6), I(klucka, 0.6)],
    f: [],
  };
}

function balon() {
  const obal = hladka([[50, 3.6], [60, 5.6], [67, 12], [69, 21], [67, 31], [62.4, 40], [57.4, 47], [56, 51.4, 1], [44, 51.4, 1], [42.6, 47], [37.6, 40], [33, 31], [31, 21], [33, 12], [40, 5.6]]);
  const vzorkyO = vzorky([[50, 3.6], [60, 5.6], [67, 12], [69, 21], [67, 31], [62.4, 40], [57.4, 47], [56, 51.4], [44, 51.4], [42.6, 47], [37.6, 40], [33, 31], [31, 21], [33, 12], [40, 5.6]], 6, true);
  const sirkaV = (y) => { const xs = vzorkyO.filter((p) => Math.abs(p[1] - y) < 1.2).map((p) => p[0]); return xs.length ? [Math.min(...xs), Math.max(...xs)] : [50, 50]; };
  let pruhy = '';
  for (const q of [-0.62, -0.3, 0, 0.3, 0.62]) {
    const b = [];
    for (let y = 5; y <= 51; y += 2) { const [a, c] = sirkaV(y); b.push([50 + ((c - a) / 2) * q * (0.96 + 0.04 * Math.cos(y)), y]); }
    pruhy += ciara(b);
  }
  const pas = (y1, y2) => { const [a1, c1] = sirkaV(y1), [a2, c2] = sirkaV(y2); return hladka([[a1 + 0.3, y1], [(a1 + c1) / 2, y1 + 1.2], [c1 - 0.3, y1], [c2 - 0.3, y2], [(a2 + c2) / 2, y2 + 1.2], [a2 + 0.3, y2]]); };
  const pasy = [pas(15.4, 18.4), pas(32.6, 35.6), pas(44.4, 46.6)];
  let ornamenty = '';
  for (const [x, y] of [[40, 25], [50, 25.8], [60, 25], [44.6, 40], [55.4, 40]]) ornamenty += kruh(x, y, 1.6);
  const galeria = hladka([[40.4, 51.4, 1], [59.6, 51.4, 1], [61.4, 57.4, 1], [38.6, 57.4, 1]]);
  const lana = lomena([[44, 51.4], [41, 51.4]]);
  const oblak = (x, y, m) => hladka([[x - 9 * m, y + 2 * m], [x - 7 * m, y - 1.6 * m], [x - 3 * m, y - 3 * m], [x + 1 * m, y - 4.4 * m], [x + 5.4 * m, y - 2.4 * m], [x + 9 * m, y + 0.4 * m], [x + 8 * m, y + 2.4 * m, 1], [x - 8.6 * m, y + 2.6 * m, 1]]);
  const o1 = oblak(16, 42, 1), o2 = oblak(84, 20, 0.8);
  return {
    w: [PAP(o1), W(o1, 'cerulean', 0.08), PAP(o2), W(o2, 'cerulean', 0.08), W(obal, 'ultramarine', 0.5), W(obal, 'cerulean', 0.14), ...pasy.map((d) => W(d, 'lemon', 0.6)), ...pasy.map((d) => W(d, 'ochre', 0.2)),
      W(ornamenty, 'lemon', 0.7), W(galeria, 'ochre', 0.5), W(galeria, 'umber', 0.25), W(tien(50, 26, 20, 0.5), 'payne', 0.12)],
    i: [I(o1, 0.45), I(o2, 0.45), I(obal, 1), I(pruhy, 0.3), ...pasy.map((d) => I(d, 0.55)), I(ornamenty, 0.45), I(galeria, 0.8), I(lana, 0.4),
      I(usecka([43.4, 51.4], [46, 57.4]) + usecka([56.6, 51.4], [54, 57.4]) + usecka([50, 51.4], [50, 57.4]), 0.35)],
    f: [],
  };
}

function hodiny() {
  const stit = hladka([[32, 11.6, 1], [50, 3, 1], [68, 11.6, 1]]) ;
  const hore = hladka([[33.6, 11.4, 1], [66.4, 11.4, 1], [66.4, 39.4, 1], [33.6, 39.4, 1]]);
  const dole = hladka([[37.4, 39.4, 1], [62.6, 39.4, 1], [62.6, 61.4, 1], [58, 64.6, 1], [42, 64.6, 1], [37.4, 61.4, 1]]);
  const sklo = hladka([[40.6, 42.4, 1], [59.4, 42.4, 1], [59.4, 59.6, 1], [40.6, 59.6, 1]]);
  const c = [50, 25.4], r = 10.6;
  let ryhy = '';
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; ryhy += usecka([c[0] + Math.cos(a) * (r - 2.6), c[1] + Math.sin(a) * (r - 2.6)], [c[0] + Math.cos(a) * (r - 1), c[1] + Math.sin(a) * (r - 1)]); }
  const rucicky = usecka(c, [c[0] - 4.2, c[1] - 2.6]) + usecka(c, [c[0] + 3.4, c[1] - 7.4]);
  const kyvadlo = usecka([50, 40], [50, 53.2]);
  const zavazie = kruh(50, 55, 3.4);
  const hrot = hladka([[46.6, 64.6, 1], [53.4, 64.6, 1], [50, 68.4, 1]]);
  return {
    w: [W(stit, 'sienna', 0.55), W(hore, 'sienna', 0.55), W(hore, 'umber', 0.24), W(dole, 'sienna', 0.55), W(dole, 'umber', 0.24), W(hrot, 'umber', 0.5), PAP(sklo), W(sklo, 'cerulean', 0.1),
      PAP(kruh(c[0], c[1], r)), W(kruh(c[0], c[1], r + 1.4), 'ochre', 0.5), PAP(kruh(c[0], c[1], r - 0.2)), W(kruh(c[0], c[1], r - 0.2), 'lemon', 0.08), WS(kyvadlo, 'ochre', 0.7, 1.1),
      W(zavazie, 'ochre', 0.6), W(zavazie, 'lemon', 0.3)],
    i: [I(stit + usecka([32, 11.6], [68, 11.6]), 0.85), I(hore, 0.9), I(dole, 0.9), I(sklo, 0.6), I(kruh(c[0], c[1], r + 1.4), 0.7), I(kruh(c[0], c[1], r - 0.2), 0.5), I(ryhy, 0.6), I(rucicky, 0.85),
      I(kyvadlo, 0.5), I(zavazie, 0.7), I(hrot, 0.6), I(kruh(50, 7.6, 1.6), 0.5)],
    f: [F(kruh(c[0], c[1], 0.8), 'ink'), F(kruh(48.8, 53.8, 0.9), 'papier')],
  };
}

/* ══ Mountains of the World ═══════════════════════════════════════════════ */
/* Hory ako na starých porovnávacích tabuliach výšok: obrys, osvetlená ľavá stena,
   tienená pravá, sneh je nenamaľovaný papier s modrastým tieňom. Každá má svoj znak
   (vlajka mrakov, roh, pravidelný kužeľ, dym, dva vrcholy, smreky, pásy hornín, prstenec mrakov, červená skala, záliv). */

const horaBody = (body, spodok) => [[body[0][0] - 3, spodok, 1], ...body.map(([x, y, k]) => [x, y, k === undefined ? 1 : k]), [body[body.length - 1][0] + 3, spodok, 1]];
const hora = (body, spodok = 62) => hladka(horaBody(body, spodok));
/* Obrys hory perom len po hrebeni (bez spodnej hrany), aby hora stála na zemi, nie v krabici. */
const hranaHory = (body, spodok = 62) => hladka(horaBody(body, spodok), false);
const zemLinia = (y = 62, od = 3, po = 97) => ciara([[od, y], [(od + po) / 2, y - 0.4], [po, y + 0.2]]);
function smrek(x, y, v) {
  const b = [[x, y - v, 1]];
  for (let k = 1; k <= 3; k++) { const t = k / 3; b.push([x + v * 0.3 * t + 0.6, y - v + v * t * 0.95, 1], [x + v * 0.14 * t, y - v + v * t * 0.8, 1]); }
  const p = b.slice(1).map(([px, py]) => [2 * x - px, py, 1]).reverse();
  return hladka([...b, [x + 0.4, y, 1], [x - 0.4, y, 1], ...p]);
}

function everest() {
  const zadnaB = [[4, 54], [18, 40], [30, 29], [40, 17], [48.4, 8.6], [55, 16], [62, 25.4], [67, 22], [74, 17.6], [82, 26], [90, 36], [97, 46]];
  const zadna = hora(zadnaB, 62), zadnaH = hranaHory(zadnaB, 62);
  const prednaB = [[3, 50], [12, 43], [22, 35.4], [30, 38.6], [40, 36.4], [52, 41], [62, 38], [74, 43.6], [86, 42], [97, 50]];
  const predna = hora(prednaB, 62), prednaH = hranaHory(prednaB, 62);
  const tienE = hladka([[48.4, 8.6, 1], [55, 16], [62, 25.4], [56, 33], [50, 30], [47, 20]]);
  const tienL = hladka([[74, 17.6, 1], [82, 26], [90, 36], [84, 40], [76, 34], [74, 24]]);
  const sneh = hladka([[40.6, 17.4], [44, 13], [48.4, 8.6, 1], [53, 13.4], [52, 18], [49, 22.4], [46.4, 19.6], [43.4, 22.6]]);
  const vlajka = hladka([[49.4, 9.4, 1], [56, 7], [66, 5.4], [78, 5.6], [92, 4.4, 1], [84, 7.6], [72, 9.6], [60, 11], [53, 12.6]]);
  const rebra = ciara([[48.4, 8.6], [47.4, 18], [50, 30]]) + ciara([[40, 17], [37, 25], [38, 33]]) + ciara([[74, 17.6], [74.6, 26], [76, 34]]);
  const pasy = ciara([[42, 23], [46, 21.6], [52, 24]]) + ciara([[39, 28], [45, 27], [53, 29.4]]);
  return {
    w: [W(zadna, 'payne', 0.14), W(zadna, 'ochre', 0.1), W(tienE, 'payne', 0.32), W(tienL, 'payne', 0.3), W(tienE, 'ultramarine', 0.1), PAP(sneh), W(sneh, 'cerulean', 0.08),
      W(predna, 'umber', 0.3), W(predna, 'payne', 0.2), W(vlajka, 'cerulean', 0.12)],
    i: [I(zadnaH, 0.9), I(vlajka, 0.45), I(rebra, 0.45), I(pasy, 0.35), I(prednaH, 0.8), I(zemLinia(), 0.5)],
    f: [],
  };
}

function matterhorn() {
  const obrysB = [[6, 60], [18, 52], [30, 42], [39, 30], [45, 19], [49, 10.6], [52.4, 5.2, 1], [55.4, 7.4], [56.6, 12.6], [58.4, 16.4], [62, 24], [70, 35], [80, 45], [96, 56]];
  const obrys = hora(obrysB, 62), obrysH = hranaHory(obrysB, 62);
  const hrebenH = ciara([[52.4, 5.2], [53.6, 14], [56, 26], [59.6, 40], [62, 54], [63, 62]]);
  const tien = hladka([[52.4, 5.2, 1], [55.4, 7.4], [56.6, 12.6], [58.4, 16.4], [62, 24], [70, 35], [80, 45], [96, 56], [96, 62, 1], [63, 62, 1], [62, 54], [59.6, 40], [56, 26], [53.6, 14]]);
  const skvrny = [[[44, 24], [48, 22.6], [50, 26], [46.6, 28.4]], [[38, 34], [42.4, 32.6], [44, 36.6], [39.6, 37.6]], [[57.6, 22], [61, 25.4], [58.4, 27.6]], [[64, 34], [69.4, 38.6], [65, 40]],
    [[49.6, 12], [52, 11], [52.4, 16], [50.6, 17]], [[30, 46], [34, 44.6], [35, 48]]].map((b) => hladka(b));
  const luka = hladka([[3, 62, 1], [3, 55], [14, 53], [26, 56.6], [40, 54.4], [54, 58], [70, 55], [84, 57.4], [97, 54], [97, 62, 1]]);
  const stromy = [[20, 60.6, 5], [25, 61.4, 4], [74, 60.6, 5.4], [79.4, 61.2, 4.2], [84, 60.8, 3.6]].map(([x, y, v]) => smrek(x, y, v));
  return {
    w: [W(obrys, 'ochre', 0.2), W(obrys, 'umber', 0.12), W(tien, 'payne', 0.42), ...skvrny.map((d) => PAP(d)), ...skvrny.map((d) => W(d, 'cerulean', 0.1)), W(luka, 'sap', 0.42),
      ...stromy.map((d) => W(d, 'viridian', 0.6))],
    i: [I(obrysH, 0.95), I(hrebenH, 0.5), ...skvrny.map((d) => I(d, 0.3)), I(ciara([[3, 55], [14, 53], [26, 56.6], [40, 54.4], [54, 58], [70, 55], [84, 57.4], [97, 54]]), 0.5), ...stromy.map((d) => I(d, 0.5))],
    f: [],
  };
}

function fuji() {
  const obrysB = [[4, 60], [18, 53.4], [30, 43.6], [38, 32], [42.4, 21], [44.4, 15.2], [47, 14.2], [50, 15.2], [53, 14], [55.6, 15.4], [57.8, 21], [62.2, 32], [70, 43.6], [82, 53.4], [96, 60]];
  const obrys = hora(obrysB, 62), obrysH = hranaHory(obrysB, 62);
  const sneh = hladka([[42.4, 21, 0], [44.4, 15.2], [47, 14.2], [50, 15.2], [53, 14], [55.6, 15.4], [57.8, 21], [59.4, 25.4], [58, 31, 1], [56.6, 25.6], [54.6, 33.4, 1], [52.6, 26], [50.4, 34.4, 1],
    [48.4, 26.6], [46, 32.6, 1], [44.4, 26], [41.4, 30.6, 1], [40.6, 25.4]]);
  const tien = hladka([[53, 14, 1], [55.6, 15.4], [57.8, 21], [62.2, 32], [70, 43.6], [82, 53.4], [96, 60], [96, 62, 1], [58, 62, 1], [56, 44], [54.4, 30]]);
  const oblak = hladka([[8, 47, 1], [20, 45], [34, 44.4], [48, 45.4], [60, 44.2], [74, 45], [90, 46.2, 1], [78, 48], [62, 47.6], [46, 48.6], [30, 48.2], [16, 48.6]]);
  const jazero = hladka([[3, 62, 1], [97, 62, 1], [97, 67, 1], [3, 67, 1]]);
  return {
    w: [W(obrys, 'ultramarine', 0.34), W(obrys, 'cerulean', 0.18), W(tien, 'payne', 0.22), PAP(sneh), W(sneh, 'cerulean', 0.08), PAP(oblak), W(jazero, 'cerulean', 0.22)],
    i: [I(obrysH, 0.95), I(ciara([[59.4, 25.4], [58, 31], [56.6, 25.6], [54.6, 33.4], [52.6, 26], [50.4, 34.4], [48.4, 26.6], [46, 32.6], [44.4, 26], [41.4, 30.6], [40.6, 25.4]]), 0.5),
      I(oblak, 0.45), I(ciara([[10, 64.6], [24, 64], [36, 64.8]]) + ciara([[60, 65.4], [74, 64.8], [88, 65.4]]), 0.4)],
    f: [],
  };
}

function etna() {
  const obrysB = [[2, 58], [12, 52], [24, 43], [34, 34.4], [42, 27.6], [46, 24.6], [49.4, 25.6], [52, 23.4], [56.4, 24.2], [60, 27.4], [68, 34], [80, 43], [92, 51.4], [98, 55]];
  const obrys = hora(obrysB, 62), obrysH = hranaHory(obrysB, 62);
  const tien = hladka([[56.4, 24.2, 1], [60, 27.4], [68, 34], [80, 43], [92, 51.4], [98, 55], [98, 62, 1], [60, 62, 1], [58, 42], [57, 30]]);
  const dym = hladka([[50, 23, 1], [48, 18], [50, 13], [55, 10.6], [58, 6.6], [64, 4.4], [70, 5.4], [76, 3.4], [83, 5], [86, 9.4], [80, 11.6], [72, 11], [66, 13.4], [60, 15], [56, 18.4], [54.4, 23, 1]]);
  const lava = rurka([[57.4, 26.4], [60, 32], [59, 38], [63, 44], [66, 50]], (s) => 1.3 - s * 0.6, 5);
  const sneh = [hladka([[44, 27.4], [47, 25.6], [49, 27.6], [46.6, 30.4], [44.4, 31]]), hladka([[36, 35.6], [40, 33], [41, 36.4], [37.6, 38]]), hladka([[52, 25.4], [55, 25.2], [54, 29.6], [52.4, 29]])];
  const krovie = hladka([[3, 62, 1], [3, 57], [16, 53.6], [30, 56], [46, 55.6], [60, 57.6], [76, 55.4], [97, 57.6], [97, 62, 1]]);
  return {
    w: [W(obrys, 'umber', 0.36), W(obrys, 'sienna', 0.14), W(tien, 'payne', 0.3), ...sneh.map((d) => PAP(d)), W(dym, 'payne', 0.22), W(dym, 'umber', 0.08), W(lava.obrys, 'vermilion', 0.72),
      W(krovie, 'olive', 0.36), W(krovie, 'sap', 0.2)],
    i: [I(obrysH, 0.95), I(dym, 0.5), I(ciara([[60, 8.6], [66, 8], [72, 8.6]]) + ciara([[53, 15], [57, 13.4]]), 0.3), I(lomena(lava.A) + lomena(lava.B), 0.35), ...sneh.map((d) => I(d, 0.3)),
      I(ciara([[3, 57], [16, 53.6], [30, 56], [46, 55.6], [60, 57.6], [76, 55.4], [97, 57.6]]), 0.45)],
    f: [],
  };
}

function elbrus() {
  const obrysB = [[3, 56], [14, 46], [24, 34], [30, 22], [34.6, 15], [38.6, 12.2], [43, 14], [47, 19.4], [51, 21.6], [55.4, 19], [59.6, 14.6], [63.4, 13.2], [67.6, 15.4], [72, 22], [80, 32], [90, 44], [97, 52]];
  const obrys = hora(obrysB, 62), obrysH = hranaHory(obrysB, 62);
  const sneh = hladka([[22.4, 37, 0], [26, 30], [30, 22], [34.6, 15], [38.6, 12.2], [43, 14], [47, 19.4], [51, 21.6], [55.4, 19], [59.6, 14.6], [63.4, 13.2], [67.6, 15.4], [72, 22], [78, 29.6],
    [82, 35.6], [76, 36, 1], [72, 42, 1], [66, 36.4, 1], [60, 44, 1], [54, 37, 1], [48, 43, 1], [42, 36.6, 1], [36, 42, 1], [30, 36, 1]]);
  const tien = hladka([[38.6, 12.2, 1], [43, 14], [47, 19.4], [51, 21.6], [50, 30], [44, 38], [40, 26]]) + hladka([[63.4, 13.2, 1], [67.6, 15.4], [72, 22], [80, 32], [90, 44], [97, 52], [97, 62, 1], [70, 62, 1], [68, 44], [66, 30]]);
  const skaly = hladka([[3, 62, 1], [3, 58], [14, 51], [26, 47], [40, 50], [52, 46], [66, 50], [80, 47.6], [97, 54], [97, 62, 1]]);
  return {
    w: [W(obrys, 'umber', 0.3), W(obrys, 'olive', 0.12), PAP(sneh), W(sneh, 'cerulean', 0.06), W(tien, 'cerulean', 0.2), W(tien, 'ultramarine', 0.08), W(skaly, 'payne', 0.36), W(skaly, 'umber', 0.16)],
    i: [I(obrysH, 0.95), I(ciara([[82, 35.6], [76, 36], [72, 42], [66, 36.4], [60, 44], [54, 37], [48, 43], [42, 36.6], [36, 42], [30, 36], [22.4, 37]]), 0.45),
      I(ciara([[38.6, 12.2], [40, 20], [44, 30]]) + ciara([[63.4, 13.2], [64.4, 22], [67, 32]]), 0.35), I(ciara([[3, 58], [14, 51], [26, 47], [40, 50], [52, 46], [66, 50], [80, 47.6], [97, 54]]), 0.7)],
    f: [],
  };
}

function denali() {
  const obrysB = [[3, 52], [12, 44], [20, 36], [28, 26], [34, 18], [39, 14.4], [44, 17], [49, 13], [55.4, 8.2], [61, 11], [66, 16.6], [72, 22], [80, 30], [88, 38], [97, 46]];
  const obrys = hora(obrysB, 60), obrysH = hranaHory(obrysB, 60);
  const tien = hladka([[55.4, 8.2, 1], [61, 11], [66, 16.6], [72, 22], [80, 30], [88, 38], [97, 46], [97, 60, 1], [66, 60, 1], [62, 42], [58, 24]]);
  const skaly = [[33, 24, 30, 36], [42, 20, 42, 32], [47, 17, 50, 30], [62, 16, 64, 30], [70, 24, 73, 36], [24, 34, 22, 44]].map(([x1, y1, x2, y2]) => hladka([[x1, y1, 1], [x1 + 1.6, (y1 + y2) / 2], [x2 + 0.6, y2, 1], [x2 - 1, (y1 + y2) / 2 + 2]]));
  const lad = ciara([[36, 52], [44, 44], [50, 36], [54, 28]]) + ciara([[62, 50], [60, 40], [58, 32]]);
  const tundra = hladka([[3, 65, 1], [3, 56], [20, 54], [40, 55.6], [60, 53.6], [80, 55.4], [97, 54], [97, 65, 1]]);
  const stromy = [[10, 62, 7], [15.6, 63, 5.6], [21, 62.4, 6.4], [70, 62.6, 6], [76, 61.8, 7.4], [82, 62.8, 5.4], [88.6, 62.2, 6.6], [93, 63, 4.8]].map(([x, y, v]) => smrek(x, y, v));
  return {
    w: [W(obrys, 'cerulean', 0.08), W(tien, 'cerulean', 0.22), W(tien, 'payne', 0.12), ...skaly.map((d) => W(d, 'payne', 0.42)), W(tundra, 'ochre', 0.38), W(tundra, 'olive', 0.26),
      ...stromy.map((d) => W(d, 'viridian', 0.66))],
    i: [I(obrysH, 0.95), ...skaly.map((d) => I(d, 0.35)), I(lad, 0.3), I(ciara([[3, 56], [20, 54], [40, 55.6], [60, 53.6], [80, 55.4], [97, 54]]), 0.5), ...stromy.map((d) => I(d, 0.5))],
    f: [],
  };
}

function aconcagua() {
  const obrysB = [[3, 56], [14, 48], [24, 40], [32, 30], [40, 20], [46, 13], [51.6, 9, 1], [55, 11.6], [60, 17], [68, 26], [74, 30], [82, 38], [90, 46], [97, 52]];
  const obrys = hora(obrysB, 62), obrysH = hranaHory(obrysB, 62);
  const tien = hladka([[51.6, 9, 1], [55, 11.6], [60, 17], [68, 26], [74, 30], [82, 38], [90, 46], [97, 52], [97, 62, 1], [60, 62, 1], [58, 40], [55, 22]]);
  const vrstvy = [0, 1, 2, 3, 4].map((k) => ciara([[18 + k * 4, 46 - k * 6.4], [30 + k * 3, 44 - k * 6], [44 + k * 2, 46 - k * 6.8], [54, 47 - k * 7]]));
  const pasy = [hladka([[22, 44], [34, 41], [48, 43.4], [55, 43], [55, 48], [44, 48.6], [30, 47.6], [20, 48.4]]), hladka([[30, 32], [40, 29], [50, 30.6], [56, 30], [56, 35], [46, 35.6], [34, 35.4], [28, 36]])];
  const sneh = [hladka([[46.6, 13.4], [51.6, 9, 1], [55, 11.6], [57.6, 15], [54, 17], [52, 21, 1], [50, 16.4], [47, 18.6]]), hladka([[62, 22], [66, 25.4], [64, 30], [60, 26]]), hladka([[70, 30], [74, 31.6], [72, 35]])];
  const dolina = hladka([[3, 62, 1], [3, 57.6], [20, 56], [40, 58], [60, 55.6], [80, 58], [97, 56.6], [97, 62, 1]]);
  const kriky = [[12, 58], [30, 59.4], [66, 58.4], [86, 59.6]].map(([x, y]) => kruh(x, y, 1.4)).join('');
  return {
    w: [W(obrys, 'ochre', 0.4), W(obrys, 'sienna', 0.16), ...pasy.map((d) => W(d, 'sienna', 0.3)), W(tien, 'umber', 0.36), W(tien, 'payne', 0.12), ...sneh.map((d) => PAP(d)), ...sneh.map((d) => W(d, 'cerulean', 0.08)),
      W(dolina, 'ochre', 0.3), W(kriky, 'olive', 0.55)],
    i: [I(obrysH, 0.95), I(vrstvy.join(''), 0.3), ...sneh.map((d) => I(d, 0.35)), I(ciara([[51.6, 9], [53, 22], [58, 40], [60, 62]]), 0.4), I(ciara([[3, 57.6], [20, 56], [40, 58], [60, 55.6], [80, 58], [97, 56.6]]), 0.5), I(kriky, 0.4)],
    f: [],
  };
}

function olymp() {
  const obrysB = [[3, 54], [12, 44], [20, 38], [26, 30], [31, 26.6], [36, 20], [40, 22.4], [45, 13.4], [48, 11, 1], [51, 14.6], [54, 12.4], [57, 15.4], [61, 21], [66, 19.4], [72, 26], [80, 32], [88, 40], [97, 50]];
  const obrys = hora(obrysB, 62), obrysH = hranaHory(obrysB, 62);
  const tien = hladka([[48, 11, 1], [51, 14.6], [54, 12.4], [57, 15.4], [61, 21], [66, 19.4], [72, 26], [80, 32], [88, 40], [97, 50], [97, 62, 1], [56, 62, 1], [54, 38], [50, 24]]);
  const hrany = ciara([[36, 20], [38, 30], [36, 40]]) + ciara([[48, 11], [49, 22], [50, 32]]) + ciara([[66, 19.4], [66, 28], [68, 36]]) + ciara([[26, 30], [28, 38]]);
  const mrak = hladka([[8, 36, 1], [16, 32.6], [24, 33.4], [30, 30.4], [40, 32], [50, 29.4], [60, 31.6], [70, 29.6], [80, 32.6], [92, 33.6, 1], [84, 36.4], [72, 37.6], [60, 36.6], [48, 38.4], [36, 37.2], [24, 38.4], [14, 37.8]]);
  const les = hladka([[3, 62, 1], [3, 50], [10, 47], [18, 48.6], [26, 45], [34, 48], [44, 45.4], [54, 48.6], [64, 46], [74, 48.4], [84, 46], [97, 50], [97, 62, 1]]);
  let koruny = '';
  for (let k = 0; k < 16; k++) koruny += ciara([[5 + k * 6, 55 + (k % 3)], [7.4 + k * 6, 52.4 + (k % 3)], [9.8 + k * 6, 55 + (k % 3)]]);
  return {
    w: [W(obrys, 'payne', 0.2), W(obrys, 'ochre', 0.1), W(tien, 'payne', 0.3), PAP(mrak), W(mrak, 'cerulean', 0.06), W(les, 'viridian', 0.46), W(les, 'sap', 0.2)],
    i: [I(obrysH, 0.95), I(hrany, 0.35), I(mrak, 0.5), I(ciara([[3, 50], [10, 47], [18, 48.6], [26, 45], [34, 48], [44, 45.4], [54, 48.6], [64, 46], [74, 48.4], [84, 46], [97, 50]]), 0.55), I(koruny, 0.35)],
    f: [],
  };
}

function uluru() {
  const skala = hladka([[8, 56, 1], [10, 48], [13, 40], [17, 34.4], [22, 31.6], [32, 30.6], [44, 29.6], [56, 30.8], [68, 31], [78, 33], [85, 37], [89, 44], [91, 50], [92.6, 56, 1]]);
  const tien = hladka([[70, 31.4], [78, 33], [85, 37], [89, 44], [91, 50], [92.6, 56, 1], [72, 56, 1], [74, 44]]);
  let ryhy = '';
  for (const x of [20, 27, 35, 43, 52, 60, 67, 76, 83]) ryhy += ciara([[x, 33 + (x > 70 ? 2 : 0)], [x + 0.8, 42], [x - 0.4, 50], [x + 0.4, 55.6]]);
  const jaskyne = [elipsa(30, 45, 2, 1.1), elipsa(58, 40, 1.6, 0.9), elipsa(80, 47, 1.4, 0.8)];
  const puzt = hladka([[2, 64, 1], [2, 56, 1], [30, 55.4], [60, 56.4], [98, 55.6, 1], [98, 64, 1]]);
  const trsy = [[10, 60], [24, 62], [44, 60.6], [62, 62.4], [80, 60.2], [92, 62]].map(([x, y]) => {
    let d = '';
    for (let k = -3; k <= 3; k++) d += usecka([x + k * 0.3, y], [x + k * 1.2, y - 3 + Math.abs(k) * 0.5]);
    return d;
  }).join('');
  return {
    w: [W(puzt, 'ochre', 0.4), W(puzt, 'sienna', 0.12), W(skala, 'vermilion', 0.5), W(skala, 'sienna', 0.36), W(tien, 'alizarin', 0.3), W(tien, 'umber', 0.2), WS(trsy, 'olive', 0.7, 1),
      ...jaskyne.map((d) => W(d, 'umber', 0.6))],
    i: [I(skala, 0.95), I(ryhy, 0.35), ...jaskyne.map((d) => I(d, 0.4)), I(ciara([[2, 56], [30, 55.4], [60, 56.4], [98, 55.6]]), 0.5), I(trsy, 0.45)],
    f: [],
  };
}

function vezuv() {
  const obrysB = [[2, 52], [10, 45], [18, 38], [26, 31], [30, 29, 1], [34, 31], [38, 35.4], [42, 32], [48, 25], [53, 20.4, 1], [58, 21.4], [63, 20.2, 1], [68, 25], [76, 33], [86, 41.6], [98, 48]];
  const obrys = hora(obrysB, 58), obrysH = hranaHory(obrysB, 58);
  const tien = hladka([[63, 20.2, 1], [68, 25], [76, 33], [86, 41.6], [98, 48], [98, 58, 1], [64, 58, 1], [64, 40]]) + hladka([[30, 29, 1], [34, 31], [38, 35.4], [36, 44], [31, 40]]);
  const krater = ciara([[53, 20.4], [57.6, 22.2], [63, 20.2]]);
  const zaliv = hladka([[2, 58, 1], [98, 58, 1], [98, 68, 1], [2, 68, 1]]);
  const vlny = ciara([[10, 61.4], [20, 60.8], [30, 61.6]]) + ciara([[50, 64.4], [62, 63.8], [72, 64.6]]) + ciara([[78, 60.6], [88, 60], [96, 60.8]]);
  const lod = hladka([[36, 61.4, 1], [44, 61.4, 1], [42.4, 63.4, 1], [37.4, 63.4, 1]]);
  const plachta = hladka([[40.4, 61, 1], [40.4, 52.6, 1], [45, 60.4, 1]]);
  const kmen = rurka([[14, 58.4], [15, 50], [17.4, 42]], 0.8, 3);
  const koruna = hladka([[6, 42], [9, 37.6], [15, 35.6], [22, 36], [27, 39.4], [24, 42.4], [16, 43], [10, 43.4]]);
  return {
    w: [W(obrys, 'olive', 0.3), W(obrys, 'umber', 0.2), W(tien, 'payne', 0.3), W(zaliv, 'cerulean', 0.34), W(zaliv, 'ultramarine', 0.08), W(lod, 'umber', 0.5), PAP(plachta),
      W(kmen.obrys, 'umber', 0.6), W(koruna, 'viridian', 0.56), W(koruna, 'sap', 0.2)],
    i: [I(obrysH, 0.95), I(krater, 0.6), I(ciara([[20, 44], [30, 40], [38, 42], [48, 34], [58, 30]]), 0.3), I(vlny, 0.4), I(lod, 0.6), I(plachta, 0.6), I(lomena(kmen.A) + lomena(kmen.B), 0.6), I(koruna, 0.7)],
    f: [],
  };
}

/* ══ Garden Vegetables ════════════════════════════════════════════════════ */

function mrkva() {
  const koren = rurka([[33, 29], [46, 39], [60, 49], [73, 57.6], [85, 64]], (s) => 7.4 * Math.pow(1 - s, 0.85) + 0.3, 6);
  const n = koren.os.length;
  let kruzky = '';
  for (const q of [0.14, 0.26, 0.38, 0.5, 0.62, 0.74]) { const k = Math.round(q * (n - 1)); const a = koren.A[k], b = koren.B[k], p = koren.os[k]; kruzky += ciara([[a[0] + (p[0] - a[0]) * 0.15, a[1] + (p[1] - a[1]) * 0.15], [p[0] + 0.8, p[1] + 1], [a[0] + (b[0] - a[0]) * (q > 0.4 ? 0.55 : 0.45), a[1] + (b[1] - a[1]) * (q > 0.4 ? 0.55 : 0.45)]]); }
  const vlasky = cesty([0.3, 0.55, 0.8].map((q) => { const k = Math.round(q * (n - 1)); const b = koren.B[k]; return usecka(b, [b[0] + 1.6, b[1] + 2.4]); }));
  const stonky = [[[33, 29], [27, 21], [21, 13], [16, 6]], [[33, 29], [32, 19], [34, 8]], [[33, 29], [24, 26], [14, 24], [6, 25]], [[33, 29], [41, 21], [48, 15]]];
  let listky = '', stonkyD = '';
  stonky.forEach((b) => {
    const v = vzorky(b, 6);
    stonkyD += lomena(v);
    for (let k = 3; k < v.length - 1; k += 2) {
      const p = v[k], q = v[k + 1], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1;
      for (const s of [1, -1]) {
        const a = Math.atan2(dy, dx) + s * 0.9;
        const koniec = [p[0] + Math.cos(a) * 4, p[1] + Math.sin(a) * 4];
        listky += hladka([[p[0], p[1], 1], [(p[0] + koniec[0]) / 2 + (-dy / l) * 0.9 * s, (p[1] + koniec[1]) / 2 + (dx / l) * 0.9 * s], [koniec[0], koniec[1], 1], [(p[0] + koniec[0]) / 2 - (-dy / l) * 0.5 * s, (p[1] + koniec[1]) / 2 - (dx / l) * 0.5 * s]]);
      }
    }
  });
  return {
    w: [WS(stonkyD, 'sap', 0.6, 1.2), W(listky, 'sap', 0.46), W(listky, 'lemon', 0.14), W(koren.obrys, 'vermilion', 0.46), W(koren.obrys, 'ochre', 0.42),
      W(mnoho([...koren.B.slice(0, n - 2), ...koren.os.slice(0, n - 2).reverse()]), 'sienna', 0.16)],
    i: [I(stonkyD, 0.55), I(listky, 0.25), I(koren.obrys, 0.95), I(kruzky, 0.35), I(vlasky, 0.4)],
    f: [],
  };
}

function zemiak() {
  const cely = hladka([[18, 38], [21, 30.4], [28, 26], [37, 25.6], [46, 27], [54, 26.6], [59.4, 30.6], [60.4, 37.6], [57, 45], [49, 49.6], [38, 50.6], [27, 49], [20.4, 44.6]]);
  const ocka = [[29, 33], [43, 31], [52, 37.4], [34, 43.6], [24.4, 40]].map(([x, y]) => ciara([[x - 1.4, y + 0.3], [x, y - 0.6], [x + 1.4, y + 0.3]])).join('');
  const bodky = [[36, 36, 0.3], [46, 42, 0.3], [40, 29.6, 0.25], [55, 33, 0.3], [30, 46, 0.25], [22, 36, 0.25]].map(([x, y, r]) => kruh(x, y, r)).join('');
  const polka = hladka([[56, 52], [59, 45.6], [66, 42.4], [74, 42], [82, 44.4], [86.6, 50], [85, 56.6], [78, 60.6], [68, 61], [60, 58.4]]);
  const duzina = hladka([[58.6, 52], [61, 46.8], [67, 44.4], [74, 44], [81, 46.2], [84.4, 50.6], [83, 55.8], [77, 59], [68.4, 59.2], [61.6, 57]]);
  const vnutro = hladka([[64, 52], [67, 48.6], [74, 47.8], [80, 50.4], [79, 54.6], [72, 56.6], [66, 55.6]]);
  const pod = hladka([[20, 51.6], [40, 53.4], [58, 51], [60, 54], [40, 56], [22, 54.6]]);
  return {
    w: [W(pod, 'umber', 0.14), W(cely, 'ochre', 0.46), W(cely, 'umber', 0.24), W(hladka([[46, 28], [54, 27.6], [59, 31], [59.6, 38], [56, 45], [48, 48.4], [52, 40], [52, 33]]), 'umber', 0.16), W(polka, 'umber', 0.5), PAP(duzina), W(duzina, 'lemon', 0.3), W(vnutro, 'lemon', 0.18)],
    i: [I(cely, 0.95), I(ocka, 0.55), I(polka, 0.9), I(duzina, 0.5), I(vnutro, 0.25)],
    f: [F(bodky, 'umber')],
  };
}

function paradajka() {
  const c1 = [42, 42], c2 = [74, 46];
  const obrysT = (c, rx, ry) => { const b = []; for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 - Math.PI / 2, zub = k % 2 ? 1 : 0.955; b.push([c[0] + Math.cos(a) * rx * zub, c[1] + Math.sin(a) * ry * (k === 0 ? 0.86 : 1)]); } return hladka(b); };
  const t1 = obrysT(c1, 18, 15.4), t2 = obrysT(c2, 12, 10.4);
  const t2body = elipsaBody(c2[0], c2[1], 12, 10.4);
  const skryte = (p) => vnutri(p, elipsaBody(c1[0], c1[1], 18, 15.4));
  const kalich = (c, v) => {
    const b = [];
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 - Math.PI / 2 + 0.3; b.push([c[0] + Math.cos(a - 0.35) * v * 0.18, c[1] - v * 0.86 + Math.sin(a - 0.35) * v * 0.1], [c[0] + Math.cos(a) * v * 0.62, c[1] - v * 0.86 + Math.sin(a) * v * 0.3, 1]); }
    return hladka(b);
  };
  const k1 = kalich(c1, 15.4), k2 = kalich(c2, 10.4);
  const ryhy = ciara([[c1[0] - 4, c1[1] - 12], [c1[0] - 7, c1[1] - 4], [c1[0] - 6, c1[1] + 4]]) + ciara([[c1[0] + 4, c1[1] - 12], [c1[0] + 7, c1[1] - 4], [c1[0] + 6.4, c1[1] + 2]]);
  const stonka = ciara([[c1[0], c1[1] - 13.4], [c1[0] + 2, c1[1] - 20], [58, 18], [c2[0] - 2, c2[1] - 14], [c2[0], c2[1] - 9]]);
  return {
    w: [W(t2, 'vermilion', 0.55), W(t2, 'alizarin', 0.2), PAP(t1), W(t1, 'vermilion', 0.62), W(t1, 'alizarin', 0.14), W(tien(c1[0], c1[1], 17, 0.6), 'alizarin', 0.2), WS(stonka, 'sap', 0.6, 1.4),
      W(k1, 'sap', 0.6), W(k2, 'sap', 0.6), W(elipsa(c1[0] - 7, c1[1] - 5, 3.2, 2, -30), 'papier', 0.9), W(elipsa(c2[0] - 4.6, c2[1] - 3.6, 2, 1.2, -30), 'papier', 0.9)],
    i: [I(viditelne([...t2body, t2body[0]], skryte), 0.85), I(t1, 0.95), I(ryhy, 0.3), I(stonka, 0.6), I(k1, 0.6), I(k2, 0.6)],
    f: [],
  };
}

function cibula() {
  const cela = hladka([[36.6, 12.4, 1], [39.6, 12.4, 1], [40, 20], [45, 27], [52, 33.6], [55, 42], [52, 51], [44, 56.6], [38, 57.6], [32, 56.6], [24, 51], [21, 42], [24, 33.6], [31, 27], [36.2, 20]]);
  const suche = ciara([[37, 12.4], [35, 7], [31.6, 4]]) + ciara([[39, 12.4], [41.4, 6.6], [45, 3.6]]);
  const suplinky = ciara([[38, 14], [36, 26], [29, 36], [27, 46], [32, 55]]) + ciara([[38, 14], [40, 26], [47, 36], [49.4, 46], [44.6, 55.4]]) + ciara([[38, 16], [38.2, 30], [38, 44], [38, 57]]);
  let korienky = '';
  for (let k = -3; k <= 3; k++) korienky += ciara([[38 + k * 1.2, 57.4], [38 + k * 1.9, 60.6], [38 + k * 2.4 + (k % 2), 63.4]]);
  const polka = hladka([[58, 57, 1], [59.6, 48], [64, 40.6], [71, 35.4], [74, 30, 1], [77, 35.4], [84, 40.6], [88.4, 48], [90, 57, 1]]);
  let kruzky2 = '';
  for (let k = 1; k <= 4; k++) { const q = k / 5; kruzky2 += ciara([[58 + 16 * q * 0.99, 57], [59.6 + 14.4 * q, 57 - 9 * (1 - q)], [64 + 10 * q, 57 - 16.4 * (1 - q)], [74, 30 + 27 * q], [84 - 10 * q, 57 - 16.4 * (1 - q)], [88.4 - 14.4 * q, 57 - 9 * (1 - q)], [90 - 16 * q, 57]]); }
  return {
    w: [W(cela, 'ochre', 0.5), W(cela, 'sienna', 0.3), W(tien(38, 42, 16, 0.6), 'sienna', 0.2), WS(suche, 'ochre', 0.6, 1.2), PAP(polka), W(polka, 'violet', 0.2), W(polka, 'rose', 0.14)],
    i: [I(cela, 0.95), I(suche, 0.55), I(suplinky, 0.35), I(korienky, 0.4), I(polka, 0.9), I(kruzky2, 0.35), I(usecka([56, 57.2], [92, 57.2]), 0.5)],
    f: [],
  };
}

function hrach() {
  const struk = hladka([[12, 50, 1], [22, 44.4], [36, 38.4], [52, 33.4], [68, 29], [82, 25.4], [89, 24.4, 1], [84, 30.6], [70, 37], [54, 42.4], [38, 47.4], [24, 51.6], [16, 53]]);
  const vnutro = hladka([[16, 50.4, 1], [26, 45.6], [40, 40.6], [56, 36.2], [72, 32], [85, 27.6, 1], [80, 31.4], [66, 35.6], [52, 39.6], [36, 44.6], [22, 49.4]]);
  const hrasky = [[26, 47, 3.3], [35.6, 44, 3.5], [45.4, 41.2, 3.6], [55.2, 38.4, 3.6], [64.8, 35.8, 3.4], [74, 33.2, 3.1]];
  const stopka = ciara([[12, 50], [8, 47], [6, 42]]);
  const ulak = [];
  for (let k = 0; k <= 40; k++) { const t = k / 40, a = t * Math.PI * 3.2, r = 5.4 * (1 - t * 0.8); ulak.push([10 + t * 6 + Math.cos(a) * r, 34 - t * 16 + Math.sin(a) * r]); }
  const list1 = list([6, 42], [20, 30], (s) => 4.6 * Math.pow(Math.sin(Math.PI * s), 0.8), { ohyb: 0.06 });
  const list2 = list([6, 42], [-2 + 6, 26], (s) => 3.6 * Math.pow(Math.sin(Math.PI * s), 0.8), { ohyb: -0.08 });
  return {
    w: [W(list1.obrys, 'sap', 0.46), W(list2.obrys, 'sap', 0.46), W(struk, 'sap', 0.5), W(struk, 'lemon', 0.2), W(vnutro, 'lemon', 0.24), W(vnutro, 'sap', 0.14),
      PAP(hrasky.map(([x, y, r]) => kruh(x, y, r)).join('')), W(hrasky.map(([x, y, r]) => kruh(x, y, r)).join(''), 'sap', 0.55), W(hrasky.map(([x, y, r]) => kruh(x, y, r)).join(''), 'lemon', 0.3),
      W(hrasky.map(([x, y, r]) => tien(x, y, r, 0.5)).join(''), 'viridian', 0.3)],
    i: [I(list1.obrys, 0.6), I(list1.stred, 0.35), I(list2.obrys, 0.6), I(list2.stred, 0.35), I(struk, 0.95), I(vnutro, 0.4), I(hrasky.map(([x, y, r]) => kruh(x, y, r)).join(''), 0.7), I(stopka, 0.7), I(lomena(ulak), 0.5)],
    f: [PAP(hrasky.map(([x, y, r]) => kruh(x - r * 0.35, y - r * 0.35, r * 0.25)).join(''))],
  };
}

function kapusta() {
  const c = [50, 38];
  const vonka = hladka([[22, 44], [20, 34], [24, 24], [32, 17.4], [42, 14], [50, 14.6], [58, 14], [68, 17.4], [76, 24], [80, 34], [78, 44], [72, 52], [62, 57.6], [50, 59], [38, 57.6], [28, 52]]);
  const hlavicka = hladka([[36, 30], [40, 22], [48, 18.4], [56, 19], [63, 23.6], [65, 31], [60, 36.6], [50, 38.4], [40, 36.4]]);
  const listL = hladka([[22, 44, 1], [20, 34], [24, 24], [32, 17.4], [36, 30], [40, 40], [44, 50], [40, 56.4], [30, 53]]);
  const listP = hladka([[78, 44, 1], [80, 34], [76, 24], [68, 17.4], [64, 30], [60, 40], [56, 50], [60, 56.4], [70, 53]]);
  const listD = hladka([[30, 50], [38, 45], [50, 43], [62, 45], [70, 50], [62, 57.6], [50, 59], [38, 57.6]]);
  const zilky = ciara([[26, 46], [31, 36], [34, 24]]) + ciara([[74, 46], [69, 36], [66, 24]]) + ciara([[50, 58], [50, 50], [50, 44]]) +
    cesty([[29, 40, 23, 36], [31, 33, 26, 28], [71, 40, 77, 36], [69, 33, 74, 28], [50, 52, 42, 48], [50, 52, 58, 48]].map(([x1, y1, x2, y2]) => usecka([x1, y1], [x2, y2])));
  const zahyby = ciara([[42, 24], [48, 22], [55, 24]]) + ciara([[40, 30], [50, 27.4], [60, 30]]);
  return {
    w: [W(vonka, 'sap', 0.46), W(vonka, 'turquoise', 0.2), W(hlavicka, 'lemon', 0.3), W(hlavicka, 'sap', 0.24), W(listL, 'viridian', 0.2), W(listP, 'viridian', 0.24), W(listD, 'viridian', 0.16),
      WS(zilky, 'papier', 0.8, 1.1)],
    i: [I(vonka, 0.95), I(hlavicka, 0.7), I(listL, 0.55), I(listP, 0.55), I(listD, 0.55), I(zilky, 0.35), I(zahyby, 0.35), I(ciara([[18, 60], [50, 61], [82, 60]]), 0.3)],
    f: [],
  };
}

function tekvica() {
  const rebra = [[28.6, 45, 11, 13.6], [71.4, 45, 11, 13.6], [38.6, 44, 12.6, 15.8], [61.4, 44, 12.6, 15.8], [50, 43.4, 11.4, 17]];
  const body = rebra.map(([x, y, rx, ry]) => elipsaBody(x, y, rx, ry, 40));
  const poradie = [0, 1, 2, 3, 4];
  const skrytePre = (k) => (p) => (k === 0 ? [2, 4] : k === 1 ? [3, 4] : k === 2 ? [4] : k === 3 ? [4] : []).some((j) => vnutri(p, body[j]));
  const ink = poradie.map((k) => viditelne([...body[k], body[k][0]], skrytePre(k)));
  const stonka = hladka([[47.4, 28.6, 1], [47.6, 22], [50.4, 17.4], [55.6, 14.4], [57.4, 16.6], [53.6, 20], [52.4, 24.4], [52.8, 28.4, 1]]);
  const ulak = [];
  for (let k = 0; k <= 30; k++) { const t = k / 30, a = t * Math.PI * 3, r = 4 * (1 - t * 0.7); ulak.push([58 + t * 10 + Math.cos(a) * r, 18 - t * 4 + Math.sin(a) * r]); }
  return {
    w: [...poradie.map((k) => PAP(mnoho(body[k]))), ...poradie.map((k) => W(mnoho(body[k]), 'ochre', 0.5)), ...poradie.map((k) => W(mnoho(body[k]), 'vermilion', k === 4 ? 0.34 : 0.28)),
      W(mnoho(body[1]), 'sienna', 0.14), W(stonka, 'olive', 0.55), W(stonka, 'sap', 0.2)],
    i: [...ink.map((d) => I(d, 0.85)), I(stonka, 0.8), I(ciara([[49.4, 22], [51.6, 18.6], [55, 16]]), 0.35), I(lomena(ulak), 0.45), I(ciara([[12, 60.6], [50, 61.6], [88, 60.6]]), 0.3)],
    f: [],
  };
}

function cvikla() {
  const c = [44, 43];
  const koren = hladka([[31, 42], [32.6, 34.6], [38, 30.4], [44, 29.6], [50, 30.4], [55.4, 34.6], [57, 42], [55, 49.6], [50, 54.4], [47.4, 58], [46.6, 64, 1], [44.6, 58.4], [38, 54.4], [33, 49.6]]);
  const pruziky = ciara([[36, 36], [35.4, 42], [38, 49]]) + ciara([[52, 36], [53, 43], [50, 49]]);
  const listy = [[[43, 30], [28, 6]], [[45, 30], [54, 3]], [[46, 30.6], [76, 12]]].map(([a, b]) => list(a, b, (s) => 6 * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.1)), 0.9) * (s < 0.3 ? s / 0.3 : 1), { ohyb: 0.05 }));
  const stonky = listy.map((l) => l.stred).join('');
  const zilky2 = listy.map((l) => zilky(l, 4, { od: 0.35, po: 0.8, sklon: 0.12 })).join('');
  const platok = [78, 52];
  let kruzky3 = '';
  for (const r of [2.4, 4.6, 6.6]) kruzky3 += elipsa(platok[0], platok[1], r, r * 0.92);
  return {
    w: [...listy.map((l) => W(l.obrys, 'sap', 0.46)), ...listy.map((l) => W(l.polovica, 'viridian', 0.2)), WS(stonky, 'alizarin', 0.6, 1.1), W(koren, 'alizarin', 0.6), W(koren, 'violet', 0.34),
      W(tien(c[0], c[1], 13, 0.6), 'payne', 0.14), W(elipsa(platok[0], platok[1], 8.6, 8), 'alizarin', 0.5), W(elipsa(platok[0], platok[1], 8.6, 8), 'violet', 0.16)],
    i: [...listy.map((l) => I(l.obrys, 0.7)), I(stonky, 0.5), I(zilky2, 0.3), I(koren, 0.95), I(pruziky, 0.35), I(elipsa(platok[0], platok[1], 8.6, 8), 0.8), I(kruzky3, 0.35)],
    f: [],
  };
}

function brokolica() {
  const ruzicka = (x, y, r, seed) => {
    const nah = rozptyl(seed), b = [];
    const n = 11;
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, q = r * (0.9 + nah() * 0.16); b.push([x + Math.cos(a) * q, y + Math.sin(a) * q * 0.9]); }
    let d = '';
    for (let k = 0; k < n; k++) { const p = b[k], q = b[(k + 1) % n], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], o = [m[0] + (m[0] - x) * 0.16, m[1] + (m[1] - y) * 0.16]; d += (k ? '' : `M${f(p[0])} ${f(p[1])}`) + `Q${f(o[0])} ${f(o[1])} ${f(q[0])} ${f(q[1])}`; }
    return d + 'Z';
  };
  const ruze = [[30, 30, 10, 3], [70, 30, 10, 5], [40, 20, 11, 7], [60, 20, 11, 9], [50, 30, 12, 11], [36, 36, 8, 13], [64, 36, 8, 15], [50, 13, 9, 17]];
  const stonka = hladka([[44, 66, 1], [45, 52], [42, 44], [36, 38, 1], [40, 38], [46, 42], [50, 38, 1], [54, 42], [60, 38, 1], [64, 38], [58, 44], [55, 52], [56, 66, 1]]);
  const nah = rozptyl(23);
  let bodky = '';
  for (let k = 0; k < 40; k++) { const x = 24 + nah() * 52, y = 8 + nah() * 34; if (Math.hypot((x - 50) / 26, (y - 26) / 18) < 1) bodky += kruh(x, y, 0.45); }
  const list2 = list([46, 54], [26, 50], (s) => 3.4 * Math.pow(Math.sin(Math.PI * s), 0.8), { ohyb: 0.1 });
  return {
    w: [W(list2.obrys, 'sap', 0.4), W(stonka, 'sap', 0.46), W(stonka, 'lemon', 0.2), ...ruze.map(([x, y, r, s]) => PAP(ruzicka(x, y, r, s))), ...ruze.map(([x, y, r, s]) => W(ruzicka(x, y, r, s), 'viridian', 0.5)),
      ...ruze.map(([x, y, r, s]) => W(ruzicka(x, y, r, s), 'sap', 0.22))],
    i: [I(list2.obrys, 0.5), I(stonka, 0.85), I(ciara([[48, 62], [49, 52], [47, 45]]) + ciara([[52, 62], [52.6, 52], [55, 45]]), 0.3), ...ruze.map(([x, y, r, s]) => I(ruzicka(x, y, r, s), 0.7))],
    f: [F(bodky, 'viridian')],
  };
}

function baklazan() {
  const t = rurka([[29, 22], [40, 30], [54, 40], [68, 50], [80, 57]], (s) => 4.4 + Math.sin(Math.min(1, s * 1.15) * Math.PI * 0.62) * 9.6, 6);
  const m = t.os.length, b = t.os[m - 1], a = t.os[m - 3];
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / d, (b[1] - a[1]) / d], nn = [-u[1], u[0]];
  const rk = 4.4 + Math.sin(Math.min(1, 1.15) * Math.PI * 0.62) * 9.6;
  const obluk = [];
  for (let k = 1; k < 10; k++) { const al = (k / 10) * Math.PI; obluk.push([b[0] + nn[0] * rk * Math.cos(al) + u[0] * rk * 0.8 * Math.sin(al), b[1] + nn[1] * rk * Math.cos(al) + u[1] * rk * 0.8 * Math.sin(al)]); }
  const zaciatok = [];
  const b0 = t.os[0];
  for (let k = 1; k < 8; k++) { const al = (k / 8) * Math.PI; zaciatok.push([b0[0] - nn[0] * 4.4 * Math.cos(al) - u[0] * 3 * Math.sin(al), b0[1] - nn[1] * 4.4 * Math.cos(al) - u[1] * 3 * Math.sin(al)]); }
  const telo = mnoho([...t.A, ...obluk, ...t.B.slice().reverse(), ...zaciatok]);
  const kalich = hladka([[22, 18, 1], [27, 20.6], [30, 17, 1], [31.6, 22.4], [38.4, 26, 1], [33.4, 27.6], [36, 34.6, 1], [30, 29.4], [24.4, 33, 1], [26, 27], [20, 25, 1], [25, 23]]);
  const stopka = rurka([[25, 21], [20, 15.6], [18.4, 10]], 1.4, 3);
  const lesk = ciara(t.os.slice(Math.round(m * 0.35), Math.round(m * 0.8)).map((p, k) => { const bb = t.B[Math.round(m * 0.35) + k]; return [p[0] + (bb[0] - p[0]) * 0.55, p[1] + (bb[1] - p[1]) * 0.55]; }));
  return {
    w: [W(telo, 'violet', 0.62), W(telo, 'payne', 0.3), WS(lesk, 'papier', 0.7, 1.6), W(kalich, 'sap', 0.56), W(kalich, 'olive', 0.2), W(stopka.obrys, 'olive', 0.6)],
    i: [I(telo, 0.95), I(kalich, 0.75), I(lomena(stopka.A) + lomena(stopka.B), 0.7), I(ciara([[20, 62], [50, 63], [88, 62]]), 0.3)],
    f: [],
  };
}

/* ══ Minerals and Gems ════════════════════════════════════════════════════ */

/* Šesťboký hranol s hrotom (kremeň, ametyst): obrys, hrany, ľavá a pravá stena. */
function hranol(x, y, uhol, L, w) {
  const T = umiestni(x, y, uhol, 1);
  const hrot = -L - w * 1.35;
  return {
    obrys: mnoho(T([[-w, 0], [-w, -L], [0, hrot], [w, -L], [w, 0]])),
    hrany: usecka(...T([[-w * 0.38, 0.2], [-w * 0.38, -L - w * 0.22]])) + usecka(...T([[w * 0.38, 0.2], [w * 0.38, -L - w * 0.22]])) +
      lomena(T([[-w, -L], [-w * 0.38, -L - w * 0.22], [w * 0.38, -L - w * 0.22], [w, -L]])) + usecka(...T([[-w * 0.38, -L - w * 0.22], [0, hrot]])) + usecka(...T([[w * 0.38, -L - w * 0.22], [0, hrot]])),
    lava: mnoho(T([[-w, 0], [-w, -L], [-w * 0.38, -L - w * 0.22], [-w * 0.38, 0]])),
    prava: mnoho(T([[w * 0.38, 0], [w * 0.38, -L - w * 0.22], [w, -L], [w, 0]])),
    hrotP: mnoho(T([[w * 0.38, -L - w * 0.22], [w, -L], [0, hrot]])),
    ryhy: cesty([0.25, 0.45, 0.65].map((q) => usecka(...T([[-w * 0.3, -L * q], [w * 0.3, -L * q - 0.3]])))),
  };
}

function kremen() {
  const kr = [[36, 56, -24, 22, 4.6], [62, 56, 22, 20, 4.2], [44, 57, -6, 34, 5.6], [54, 57, 8, 28, 5], [28, 58, -44, 14, 3.4], [71, 58, 42, 13, 3.2]].map((a) => hranol(...a));
  const kamen = hladka([[16, 64], [20, 56.6], [30, 54], [44, 55.4], [58, 54.2], [72, 55.6], [84, 58.6], [86, 64.4], [70, 67.4], [50, 68], [30, 67.4]]);
  return {
    // Menej uzlov v DOM: rovnaká vrstva všetkých kryštálov je jedna cesta.
    w: [W(kamen, 'umber', 0.4), W(kamen, 'payne', 0.2), PAP(spoj(kr, 'obrys')), W(spoj(kr, 'obrys'), 'cerulean', 0.06), W(spoj(kr, 'prava'), 'payne', 0.14),
      W(spoj(kr, 'hrotP'), 'payne', 0.12), W(spoj(kr, 'lava'), 'cerulean', 0.05)],
    i: [I(kamen, 0.8), I(spoj(kr, 'obrys'), 0.85), I(spoj(kr, 'hrany'), 0.35), I(spoj(kr, 'ryhy'), 0.2)],
    f: [],
  };
}

function diamant() {
  const tabula = [[39, 19], [61, 19]];
  const obrys = hladka([[39, 19, 1], [61, 19, 1], [76, 31, 1], [50, 60, 1], [24, 31, 1]]);
  const fazety = lomena([[24, 31], [39, 19]]) + lomena([[76, 31], [61, 19]]) + usecka([24, 31], [76, 31]) +
    lomena([[24, 31], [33, 22.6], [42.6, 31], [50, 19], [57.4, 31], [67, 22.6], [76, 31]]) + lomena([[33, 22.6], [39, 19]]) + lomena([[67, 22.6], [61, 19]]) +
    cesty([30, 40, 50, 60, 70].map((x) => usecka([x, 31], [50, 60]))) + lomena([[36, 31], [44, 44], [50, 60]]) + lomena([[64, 31], [56, 44], [50, 60]]);
  const iskry = [[16, 18, 4], [84, 22, 3.4], [80, 50, 2.6], [20, 48, 2.4]].map(([x, y, r]) => hladka([[x, y - r, 1], [x + r * 0.2, y - r * 0.2], [x + r, y, 1], [x + r * 0.2, y + r * 0.2], [x, y + r, 1], [x - r * 0.2, y + r * 0.2], [x - r, y, 1], [x - r * 0.2, y - r * 0.2]])).join('');
  return {
    w: [PAP(obrys), W(obrys, 'cerulean', 0.12), W(mnoho([[50, 31.8], [76, 31], [50, 60]]), 'payne', 0.12), W(mnoho([[24, 31], [36, 31], [44, 44], [50, 60]]), 'cerulean', 0.14),
      W(mnoho([[39, 19], [50, 19], [42.6, 31], [33, 22.6]]), 'cerulean', 0.1), W(mnoho([[61, 19], [67, 22.6], [76, 31], [64, 31]]), 'payne', 0.1), W(iskry, 'lemon', 0.5)],
    i: [I(obrys, 0.95), I(fazety, 0.35), I(iskry, 0.45), I(usecka(...tabula), 0.6)],
    f: [],
  };
}

function rubin() {
  const c = [50, 36], rx = 25, ry = 19;
  const g = elipsaBody(c[0], c[1], rx, ry, 16), t = elipsaBody(c[0], c[1], rx * 0.44, ry * 0.44, 8, 22.5);
  const stred = elipsaBody(c[0], c[1], rx * 0.74, ry * 0.74, 8);
  let fazety = '';
  for (let k = 0; k < 8; k++) {
    fazety += usecka(t[k], stred[k]) + usecka(stred[k], g[k * 2]) + usecka(stred[k], g[(k * 2 + 1) % 16]) + usecka(stred[k], g[(k * 2 + 15) % 16]);
  }
  const tmave = [0, 2, 4, 6].map((k) => mnoho([t[k], stred[k], g[k * 2], g[(k * 2 + 1) % 16], stred[(k + 1) % 8], t[(k + 1) % 8]]));
  return {
    w: [W(mnoho(g), 'alizarin', 0.62), W(mnoho(g), 'vermilion', 0.24), ...tmave.map((d) => W(d, 'alizarin', 0.3)), W(mnoho(t), 'vermilion', 0.2),
      W(elipsa(c[0] - 6, c[1] - 5, 5, 2.4, -20), 'papier', 0.8), W(hladka([[28, 60, 1], [72, 60, 1], [66, 63, 1], [34, 63, 1]]), 'umber', 0.1)],
    i: [I(mnoho(g), 0.95), I(mnoho(t), 0.55), I(mnoho(stred), 0.25), I(fazety, 0.3)],
    f: [],
  };
}

function smaragd() {
  const oktagon = (w, h, r) => mnoho([[50 - w + r, 36 - h], [50 + w - r, 36 - h], [50 + w, 36 - h + r], [50 + w, 36 + h - r], [50 + w - r, 36 + h], [50 - w + r, 36 + h], [50 - w, 36 + h - r], [50 - w, 36 - h + r]]);
  const kroky = [[27, 19, 6], [22, 15, 4.9], [17.4, 11.4, 3.8], [12.8, 7.8, 2.8]];
  const rohy = cesty([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => usecka([50 + sx * 25, 36 + sy * 17], [50 + sx * 11.4, 36 + sy * 6.4])));
  const inkluzie = ciara([[44, 33], [46, 34.6], [45, 36.4]]) + ciara([[55, 38], [57.4, 37], [58, 39]]) + ciara([[50, 31], [51.6, 32.4]]);
  return {
    w: [W(oktagon(...kroky[0]), 'viridian', 0.56), W(oktagon(...kroky[0]), 'sap', 0.18), W(oktagon(...kroky[1]), 'viridian', 0.2), W(oktagon(...kroky[3]), 'turquoise', 0.2),
      W(mnoho([[23, 17], [77, 17], [72, 21], [28, 21]]), 'papier', 0.4), W(hladka([[28, 58, 1], [72, 58, 1], [66, 61, 1], [34, 61, 1]]), 'umber', 0.1)],
    i: [I(oktagon(...kroky[0]), 0.95), I(oktagon(...kroky[1]), 0.4), I(oktagon(...kroky[2]), 0.35), I(oktagon(...kroky[3]), 0.5), I(rohy, 0.3), I(inkluzie, 0.3)],
    f: [],
  };
}

function zafir() {
  // Surový kryštál korundu v tvare súdka (šesťboký, zúžený k obom koncom) a pred ním malý brúsený kameň.
  const c = 40, hore = 11, dole = 58, stred = 35;
  // Hranatý obrys (rovné steny, zrezané konce), aby to bol kryštál, nie váza; celý mierne naklonený.
  const sir = (y) => (y < 25 ? 6.4 + ((y - hore) / 14) * 5 : y > 44 ? 11.4 - ((y - 44) / 14) * 5 : 11.4);
  const R = (p) => otoc(p, [c, stred], -14);
  const hrany = (q) => [hore, 25, 44, dole].map((y) => R([c + sir(y) * q, y]));
  const lava = hrany(-1), prava = hrany(1), lh = hrany(-0.42), ph = hrany(0.42);
  const obrys = mnoho([...lava, ...prava.slice().reverse()]);
  const vrch = mnoho([[c - sir(hore), hore], [c - sir(hore) * 0.42, hore - 2.2], [c + sir(hore) * 0.42, hore - 2.2], [c + sir(hore), hore], [c + sir(hore) * 0.42, hore + 1.6], [c - sir(hore) * 0.42, hore + 1.6]].map(R));
  const ryhy = cesty([15, 19, 23, 29, 40, 48, 52].map((y) => usecka(R([c - sir(y) * 0.95, y]), R([c + sir(y) * 0.95, y]))));
  const pasS = mnoho([R([c - 11.4, 30]), R([c + 11.4, 30]), R([c + 11.4, 38]), R([c - 11.4, 38])]);
  const tienP = mnoho([...ph, ...prava.slice().reverse()]);
  const g = elipsaBody(74, 50, 12, 8.6, 12), t = elipsaBody(74, 50, 5.4, 3.8, 6, 30);
  let fazety = '';
  for (let k = 0; k < 6; k++) fazety += usecka(t[k], g[k * 2]) + usecka(t[k], g[(k * 2 + 1) % 12]);
  return {
    w: [W(hladka([[20, 60, 1], [92, 60, 1], [84, 63.4, 1], [26, 63.4, 1]]), 'umber', 0.1), W(obrys, 'ultramarine', 0.5), W(obrys, 'cerulean', 0.2), W(pasS, 'ultramarine', 0.2), W(tienP, 'payne', 0.2),
      PAP(vrch), W(vrch, 'cerulean', 0.3), W(mnoho(g), 'ultramarine', 0.55), W(mnoho(g), 'cerulean', 0.2), W(mnoho(t), 'cerulean', 0.2), W(elipsa(70, 47.6, 3, 1.2, -10), 'papier', 0.8)],
    i: [I(obrys, 0.95), I(lomena(lh) + lomena(ph), 0.4), I(vrch, 0.7), I(ryhy, 0.22), I(mnoho(g), 0.9), I(mnoho(t), 0.5), I(fazety, 0.3)],
    f: [],
  };
}

function ametyst() {
  const obal = hladka([[14, 38], [18, 24], [30, 14], [48, 10], [66, 12.6], [80, 22], [86, 36], [82, 50], [68, 59], [50, 62], [32, 59], [18, 50]]);
  const biela = hladka([[20, 38], [23.4, 26.4], [33, 18.6], [48, 15.4], [64, 17.6], [76, 25.6], [80.6, 36.6], [77, 47.6], [65.4, 54.4], [50, 56.6], [34, 54.4], [23, 47]]);
  const dutina = vzorky([[25, 38], [28, 29], [36, 22.6], [48, 20], [62, 21.6], [72, 28], [75.6, 37], [72.6, 45.6], [63.4, 51], [50, 52.6], [36.4, 50.6], [27.6, 45]], 3, true);
  const c = [50, 37];
  const hroty = dutina.filter((_, k) => k % 2 === 0).map((p, k) => {
    const d = [c[0] - p[0], c[1] - p[1]], l = Math.hypot(...d), u = [d[0] / l, d[1] / l], nn = [-u[1], u[0]];
    const dl = l * (0.5 + (k % 3) * 0.12), w = 3 + (k % 2);
    return mnoho([[p[0] + nn[0] * w, p[1] + nn[1] * w], [p[0] + u[0] * dl, p[1] + u[1] * dl], [p[0] - nn[0] * w, p[1] - nn[1] * w]]);
  });
  const stredy = [[44, 34], [54, 32], [50, 41], [58, 40], [42, 42]].map(([x, y]) => hladka([[x - 2.4, y + 1.6, 1], [x, y - 3, 1], [x + 2.4, y + 1.6, 1]]));
  return {
    w: [W(obal, 'umber', 0.45), W(obal, 'payne', 0.2), PAP(biela), W(biela, 'payne', 0.05), W(mnoho(dutina), 'violet', 0.46), W(hroty.filter((_, k) => k % 2).join(''), 'violet', 0.3), W(hroty.filter((_, k) => !(k % 2)).join(''), 'rose', 0.2),
      W(stredy.join(''), 'violet', 0.36)],
    i: [I(obal, 0.95), I(biela, 0.4), I(mnoho(dutina), 0.5), I(hroty.join(''), 0.35), I(stredy.join(''), 0.4)],
    f: [],
  };
}

function pyrit() {
  const kocka = (x, y, a, uh = 0) => {
    const T = umiestni(x, y, uh, 1);
    const h = a * 0.5, v = a;
    const vrch = T([[0, -v * 0.5 - h], [a, -v * 0.5], [0, -v * 0.5 + h], [-a, -v * 0.5]]);
    const lava = T([[-a, -v * 0.5], [0, -v * 0.5 + h], [0, v * 0.5 + h], [-a, v * 0.5]]);
    const prava = T([[0, -v * 0.5 + h], [a, -v * 0.5], [a, v * 0.5], [0, v * 0.5 + h]]);
    let ryhy = '';
    for (let k = 1; k < 5; k++) { const q = k / 5; ryhy += usecka([lava[0][0] + (lava[1][0] - lava[0][0]) * q, lava[0][1] + (lava[1][1] - lava[0][1]) * q], [lava[3][0] + (lava[2][0] - lava[3][0]) * q, lava[3][1] + (lava[2][1] - lava[3][1]) * q]); }
    for (let k = 1; k < 5; k++) { const q = k / 5; ryhy += usecka([vrch[0][0] + (vrch[1][0] - vrch[0][0]) * q, vrch[0][1] + (vrch[1][1] - vrch[0][1]) * q], [vrch[3][0] + (vrch[2][0] - vrch[3][0]) * q, vrch[3][1] + (vrch[2][1] - vrch[3][1]) * q]); }
    return { vrch: mnoho(vrch), lava: mnoho(lava), prava: mnoho(prava), obrys: mnoho([vrch[0], vrch[1], prava[2], prava[3], lava[3], lava[0]]), ryhy };
  };
  const kocky = [kocka(66, 40, 12, 6), kocka(34, 42, 11, -8), kocka(50, 34, 15, 0), kocka(47, 52, 9, 4)];
  const kamen = hladka([[14, 62], [20, 55], [34, 53], [50, 55], [68, 53], [84, 56], [88, 63], [68, 66.6], [46, 67], [26, 66]]);
  return {
    w: [W(kamen, 'payne', 0.3), W(kamen, 'umber', 0.2), ...kocky.flatMap((k) => [PAP(k.obrys), W(k.vrch, 'lemon', 0.5), W(k.vrch, 'ochre', 0.2), W(k.lava, 'ochre', 0.5), W(k.lava, 'lemon', 0.2),
      W(k.prava, 'ochre', 0.46), W(k.prava, 'payne', 0.3)])],
    i: [I(kamen, 0.7), ...kocky.flatMap((k) => [I(k.obrys, 0.9), I(k.vrch + k.lava + k.prava, 0.45), I(k.ryhy, 0.2)])],
    f: [],
  };
}

function malachit() {
  const baza = [[16, 36], [20, 24], [32, 15], [48, 12.6], [64, 14], [78, 22], [85, 34], [82, 46], [70, 54.6], [52, 57.6], [34, 55.6], [21, 48]];
  const doska = hladka(baza);
  const hrana = hladka([[16, 36], [16.4, 40], [21, 52.6], [34, 60], [52, 62], [70, 59], [82, 50.6], [85, 38], [85, 34], [82, 46], [70, 54.6], [52, 57.6], [34, 55.6], [21, 48]]);
  const oka = [[42, 30], [64, 38]];
  const pasy = [];
  for (let k = 1; k <= 7; k++) {
    const q = 1 - k * 0.12;
    pasy.push(hladka(baza.map(([x, y], j) => { const o = oka[x < 53 ? 0 : 1]; return [o[0] + (x - o[0]) * q + Math.sin(j * 1.7 + k) * 0.9, o[1] + (y - o[1]) * q + Math.cos(j * 1.3 + k) * 0.7]; })));
  }
  const oko1 = [1.6, 3.4, 5.4].map((r) => elipsa(oka[0][0], oka[0][1], r * 1.2, r)).join(''), oko2 = [1.4, 3, 4.8].map((r) => elipsa(oka[1][0], oka[1][1], r * 1.2, r)).join('');
  return {
    w: [W(hrana, 'viridian', 0.62), W(hrana, 'payne', 0.2), W(doska, 'sap', 0.4), W(doska, 'turquoise', 0.14), ...pasy.map((d, k) => W(d, k % 2 ? 'viridian' : 'sap', k % 2 ? 0.22 : 0.12)),
      W(elipsa(oka[0][0], oka[0][1], 6.5, 5.4), 'viridian', 0.4), W(elipsa(oka[1][0], oka[1][1], 5.8, 4.8), 'viridian', 0.4)],
    i: [I(hrana, 0.85), I(doska, 0.95), ...pasy.map((d) => I(d, 0.22)), I(oko1 + oko2, 0.3)],
    f: [],
  };
}

function tyrkys() {
  const nuget = (body) => hladka(body);
  const n1 = nuget([[22, 40], [25, 30], [34, 24], [46, 23], [54, 28], [58, 36], [56, 46], [48, 52], [36, 53], [26, 49]]);
  const n2 = nuget([[58, 50], [60, 42], [67, 37.4], [76, 37], [83, 41], [85, 49], [81, 56], [72, 59], [63, 57.6]]);
  const nah = rozptyl(61);
  const siet = (cx, cy, rx, ry, n) => {
    let d = '';
    for (let k = 0; k < n; k++) {
      const a = nah() * Math.PI * 2, r = Math.sqrt(nah()) * 0.8;
      const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
      d += ciara([[x, y], [x + (nah() - 0.5) * 7, y + (nah() - 0.5) * 5], [x + (nah() - 0.5) * 11, y + (nah() - 0.5) * 8]]);
    }
    return d;
  };
  const zily = siet(40, 38, 15, 12, 9) + siet(72, 48, 11, 9, 6);
  return {
    w: [W(n1, 'turquoise', 0.56), W(n1, 'cerulean', 0.16), W(n2, 'turquoise', 0.5), W(n2, 'sap', 0.14), WS(zily, 'umber', 0.5, 0.9), W(elipsa(36, 30, 6, 2.4, -20), 'papier', 0.6),
      W(hladka([[18, 56, 1], [88, 60, 1], [80, 63, 1], [24, 59.4, 1]]), 'umber', 0.1)],
    i: [I(n1, 0.95), I(n2, 0.9), I(zily, 0.35)],
    f: [],
  };
}

function opal() {
  const c = [50, 36];
  const obrys = elipsa(c[0], c[1], 27, 19);
  const farby = ['cerulean', 'turquoise', 'sap', 'lemon', 'vermilion', 'violet', 'cerulean', 'sap', 'rose', 'turquoise', 'lemon', 'ultramarine'];
  const nah = rozptyl(83);
  const skvrny = [];
  for (let k = 0; k < 26; k++) {
    const a = nah() * Math.PI * 2, r = Math.sqrt(nah()) * 0.82;
    const x = c[0] + Math.cos(a) * 27 * r, y = c[1] + Math.sin(a) * 19 * r, s = 3.6 + nah() * 3.6, uh = nah() * 3;
    const b = [];
    for (let j = 0; j < 5; j++) { const al = uh + (j / 5) * Math.PI * 2; b.push([x + Math.cos(al) * s * (0.7 + nah() * 0.5), y + Math.sin(al) * s * 0.7 * (0.7 + nah() * 0.5)]); }
    skvrny.push([mnoho(b), farby[k % farby.length]]);
  }
  return {
    w: [PAP(obrys), W(obrys, 'cerulean', 0.16), ...skvrny.map(([d, fa]) => W(d, fa, 0.5)), W(elipsa(c[0] - 8, c[1] - 8, 11, 3.6, -14), 'papier', 0.75), W(hladka([[26, 58, 1], [74, 58, 1], [68, 61.6, 1], [32, 61.6, 1]]), 'umber', 0.1)],
    i: [I(obrys, 0.95), I(elipsa(c[0], c[1], 24.6, 16.8), 0.25)],
    f: [],
  };
}

/* ── Register ──────────────────────────────────────────────────────────── */

const TVORCA = {
  sun: slnko, mercury: () => zvacsi(merkur(), 1.32), venus: () => zvacsi(venusa(), 1.14), earth: () => zvacsi(zem(), 1.1), moon: () => zvacsi(mesiac(), 1.06),
  mars: () => zvacsi(mars(), 1.24), jupiter, saturn, uranus: () => zvacsi(uran(), 1.14), neptune: () => zvacsi(neptun(), 1.14),
  oak: dub, birch: breza, beech: buk, pine: borovica, willow: vrba, maple: javor, chestnut: gastan, ash: jasen, yew: tis, holly: cezmina,
  robin: cervienka, wren: oriesok, magpie: straka, heron: volavka, swallow: lastovicka, kingfisher: rybarik, owl: sova, stork: bocian, puffin: papuchalk, goldfinch: stehlik,
  violin: husle, guitar: gitara, harp: harfa, piano: klavir, trumpet: trubka, flute: flauta, drum: bubon, accordion: akordeon, xylophone: xylofon, saxophone: saxofon,
  whale: plejtvak, dolphin: delfin, shark: zralok, octopus: chobotnica, turtle: korytnacka, jellyfish: meduza, starfish: hviezdica, seahorse: konik, crab: krab, walrus: mroz,
  wheel: koleso, telescope: dalekohlad, telephone: telefon, microscope: mikroskop, camera: fotoaparat, bicycle: bicykel, lightbulb: ziarovka, gramophone: gramofon, balloon: balon, clock: hodiny,
  everest, matterhorn, fuji, etna, elbrus, denali, aconcagua, olympus: olymp, uluru, vesuvius: vezuv,
  carrot: mrkva, potato: zemiak, tomato: paradajka, onion: cibula, pea: hrach, cabbage: kapusta, pumpkin: tekvica, beetroot: cvikla, broccoli: brokolica, aubergine: baklazan,
  quartz: kremen, diamond: diamant, ruby: rubin, emerald: smaragd, sapphire: zafir, amethyst: ametyst, pyrite: pyrit, malachite: malachit, turquoise: tyrkys, opal,
};

const cache = new Map();
export function kresba(id) {
  if (!cache.has(id)) {
    const t = TVORCA[id];
    if (!t) throw new Error('Kresba neexistuje: ' + id);
    const k = t();
    const m = k.mierka || 1;
    for (const x of k.i) if (x.draha) x.d = drahaCesta(x.draha[0], x.draha[1], x.draha[2] * m);
    cache.set(id, k);
  }
  return cache.get(id);
}
export const ZOZNAM_KRESIEB = Object.keys(TVORCA);

/* Farba odtlačku v mriežke pre dané slovo: prvá výrazná lazúra kresby. */
export function odtien(id) {
  const k = kresba(id);
  const prva = k.w.find((x) => x.farba !== 'papier' && x.farba !== 'payne' && x.o >= 0.4) || k.w.find((x) => x.farba !== 'papier');
  return P[prva.farba] || P.ochre;
}

/* SVG kresby.
 *   stav 'hra'    všetky vrstvy, stav riadi CSS (ceruzka, dokreslenie, lazúry)
 *   stav 'hotovo' len lazúry, pero a body (plagát, náhľad)
 *   stav 'skica'  len ceruzka (náhľad nenájdeného exemplára)
 *   stav 'obrys'  len linky perom a čierne body, bez farieb (omaľovánka v tlačovom balíku)
 * papier: farba krycej bielej. V hre je to CSS premenná, aby sedela s papierom strany.
 * hrubka: násobok hrúbky pera (tlač v malej mierke potrebuje o niečo hrubšiu linku). */
export function svg(id, { stav = 'hra', papier = 'var(--fn-papier,' + PAPIER + ')', trieda = 'kr', pridaj = '', hrubka = 1 } = {}) {
  const k = kresba(id);
  const farba = (x) => (x === 'ink' ? ATRAMENT : x === 'papier' ? null : P[x]);
  const styl = (x) => (x === 'papier' ? (papier.startsWith('var(') ? ` style="fill:${papier};stroke:${papier}"` : ` fill="${papier}" stroke="${papier}"`) : '');
  // Zväčšená kresba (malé planéty): všetko okrem dráhy ide do skupiny s mierkou,
  // hrúbky čiar sa delia mierkou, aby linka ostala rovnako tenká ako inde.
  const m = k.mierka || 1;
  const sw = (s) => +(s / m).toFixed(3);
  const skup = (polozky, fn) => {
    const zv = polozky.filter((x) => !x.pevne).map(fn).join('');
    const pv = polozky.filter((x) => x.pevne).map(fn).join('');
    return m === 1 ? zv + pv : `<g transform="translate(50 35) scale(${m}) translate(-50 -35)">${zv}</g>${pv}`;
  };
  const lazura = skup(k.w, (x) => {
    if (x.s) {
      if (x.farba === 'papier') return `<path d="${x.d}" fill="none"${papier.startsWith('var(') ? ` style="stroke:${papier}"` : ` stroke="${papier}"`} stroke-width="${sw(x.s)}" stroke-linecap="round"/>`;
      return `<path d="${x.d}" fill="none" stroke="${farba(x.farba)}" stroke-opacity="${x.o}" stroke-width="${sw(x.s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    if (x.farba === 'papier') return `<path d="${x.d}"${styl('papier')} stroke-width="${sw(0.3)}"/>`;
    const ev = x.evenodd ? ' fill-rule="evenodd"' : '';
    return `<path d="${x.d}"${ev} fill="${farba(x.farba)}" fill-opacity="${x.o}" stroke="${farba(x.farba)}" stroke-opacity="${Math.min(0.85, x.o * 0.9).toFixed(2)}" stroke-width="${sw(0.7)}"/>`;
  });
  const body = skup(k.f, (x) => (x.farba === 'papier' ? `<path d="${x.d}"${styl('papier')} stroke-width="${sw(0.2)}"/>` : `<path d="${x.d}" fill="${farba(x.farba)}"/>`));
  const pero = (dlzka, h = 1) => skup(k.i.filter((x) => x.d), (x) => `<path d="${x.d}" stroke-width="${+((x.pevne ? x.s : sw(x.s)) * h).toFixed(3)}"${dlzka ? ' pathLength="1"' : ''}/>`);
  const w = `<g class="kr-w" transform="translate(.6 .45)">${lazura}</g>`;
  const f2 = `<g class="kr-f">${body}</g>`;
  const ceruzka = `<g class="kr-p" fill="none" stroke="${CERUZKA}" stroke-linecap="round" stroke-linejoin="round">${pero(false)}</g>`;
  const atrament = `<g class="kr-i" fill="none" stroke="${ATRAMENT}" stroke-linecap="round" stroke-linejoin="round">${pero(stav === 'hra')}</g>`;
  let vnutro;
  if (stav === 'skica') vnutro = ceruzka;
  else if (stav === 'obrys') {
    const bodky = skup(k.f.filter((x) => x.farba === 'ink'), (x) => `<path d="${x.d}" fill="${ATRAMENT}"/>`);
    vnutro = `<g class="kr-o" fill="none" stroke="${ATRAMENT}" stroke-linecap="round" stroke-linejoin="round">${pero(false, hrubka)}</g><g>${bodky}</g>`;
  }
  else if (stav === 'hotovo') vnutro = w + atrament + f2;
  else vnutro = w + ceruzka + atrament + f2;
  return `<svg class="${trieda}" viewBox="0 0 100 70" aria-hidden="true" focusable="false"${pridaj}>${vnutro}</svg>`;
}
