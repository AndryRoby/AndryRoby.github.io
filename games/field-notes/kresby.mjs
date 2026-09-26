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

/* ── Register ──────────────────────────────────────────────────────────── */

const TVORCA = {
  sun: slnko, mercury: () => zvacsi(merkur(), 1.32), venus: () => zvacsi(venusa(), 1.14), earth: () => zvacsi(zem(), 1.1), moon: () => zvacsi(mesiac(), 1.06),
  mars: () => zvacsi(mars(), 1.24), jupiter, saturn, uranus: () => zvacsi(uran(), 1.14), neptune: () => zvacsi(neptun(), 1.14),
  oak: dub, birch: breza, beech: buk, pine: borovica, willow: vrba, maple: javor, chestnut: gastan, ash: jasen, yew: tis, holly: cezmina,
  robin: cervienka, wren: oriesok, magpie: straka, heron: volavka, swallow: lastovicka, kingfisher: rybarik, owl: sova, stork: bocian, puffin: papuchalk, goldfinch: stehlik,
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
 * papier: farba krycej bielej. V hre je to CSS premenná, aby sedela s papierom strany. */
export function svg(id, { stav = 'hra', papier = 'var(--fn-papier,' + PAPIER + ')', trieda = 'kr', pridaj = '' } = {}) {
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
  const pero = (dlzka) => skup(k.i.filter((x) => x.d), (x) => `<path d="${x.d}" stroke-width="${x.pevne ? x.s : sw(x.s)}"${dlzka ? ' pathLength="1"' : ''}/>`);
  const w = `<g class="kr-w" transform="translate(.6 .45)">${lazura}</g>`;
  const f2 = `<g class="kr-f">${body}</g>`;
  const ceruzka = `<g class="kr-p" fill="none" stroke="${CERUZKA}" stroke-linecap="round" stroke-linejoin="round">${pero(false)}</g>`;
  const atrament = `<g class="kr-i" fill="none" stroke="${ATRAMENT}" stroke-linecap="round" stroke-linejoin="round">${pero(stav === 'hra')}</g>`;
  let vnutro;
  if (stav === 'skica') vnutro = ceruzka;
  else if (stav === 'hotovo') vnutro = w + atrament + f2;
  else vnutro = w + ceruzka + atrament + f2;
  return `<svg class="${trieda}" viewBox="0 0 100 70" aria-hidden="true" focusable="false"${pridaj}>${vnutro}</svg>`;
}
