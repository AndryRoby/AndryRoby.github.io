// Stop at the right frame: jadro hry aj videí (ops/video/sim/filmy/stop.js). Úroveň je čistá funkcia
// čísla (semienko = číslo úrovne), poloha predmetu je funkcia celej snímky pri 60 fps, takže video
// aj hra ukážu tú istú úroveň snímku po snímke. Svet v logických bodoch 1080 x 1920.
// Predmety sú naše a kreslené kódom: drahokam z Prism 5, lampáš, papierové lietadlo, kniha
// hlavolamov, kocka, plachetnica.

import { spriteDrahokamu } from '../prism5/film/drahokamy.js';

export const FPS = 60, POCET = 50, SW = 1080, SH = 1920;
// Plachetnica (lod) vypadla 28. 9.: v presnej snímke nesadla do obrysu (ops/ai/kontrola/2026-09-28-stop-frame.md B2); jej miesto berie drahokam, ostatné úrovne ostali rovnaké ako vo videách.
export const PREDMETY = ['drahokam', 'lampas', 'lietadlo', 'kniha', 'kocka', 'drahokam'];
export const MENA = { drahokam: 'star gem', lampas: 'lantern', lietadlo: 'paper plane', kniha: 'puzzle book', kocka: 'cube', lod: 'sailboat' };
export const POLE = { x0: 60, x1: 1020, y0: 470, y1: 1250 }; // hracia plocha (cieľ leží vnútri)
export const MEDZERA = 24; // snímky medzi prechodmi, keď je predmet mimo obrazu

function nahoda(s) {
  let a = (s * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const medzi = (r, a, b) => a + (b - a) * r();

/** Úroveň 1 až 50. Easy (1 až 25): okno 3 snímok (cieľ ±1). Impossible (26 až 50): presne 1 snímka. */
export function uroven(n) {
  n = Math.max(1, Math.min(POCET, n | 0));
  const r = nahoda(n * 7919 + 13);
  const predmet = PREDMETY[(n - 1) % PREDMETY.length];
  const tazka = n > 25, i = (n - 1) % 25;
  const T = Math.round(tazka ? 104 - i * 1.2 : 150 - i * 1.6); // snímky jedného prechodu
  const doprava = r() < 0.5;
  const sx = doprava ? -1 : 1; // odkiaľ letí: -1 zľava
  const yA = medzi(r, 700, 1150), yB = medzi(r, 700, 1150);
  const hore = r() < 0.7; // oblúk hore (hod) alebo dolu
  const c1y = hore ? medzi(r, 440, 700) : medzi(r, 960, 1160), c2y = hore ? medzi(r, 440, 700) : medzi(r, 960, 1160);
  const plavba = predmet === 'lod';
  const A = [SW / 2 + sx * 800, plavba ? 1000 : yA], B = [SW / 2 - sx * 800, plavba ? 1000 : yB];
  const C1 = [SW / 2 + sx * medzi(r, 180, 420), plavba ? 900 : c1y], C2 = [SW / 2 - sx * medzi(r, 180, 420), plavba ? 1100 : c2y];
  const spin = (tazka ? medzi(r, 2.2, 3.4) : medzi(r, 1.1, 2.0)) * Math.PI * (r() < 0.5 ? -1 : 1);
  const U = { n, predmet, tazka, obtiaznost: tazka ? 'Impossible' : 'Easy', tolerancia: tazka ? 0 : 1, T, cyklus: T + MEDZERA,
    A, B, C1, C2, uhol0: medzi(r, -Math.PI, Math.PI), spin, faza: medzi(r, 0, Math.PI * 2), R: predmet === 'lod' ? 200 : 180 };
  // cieľ: jedna zo 6 snímok prechodu najbližších k stredu plochy
  const sx0 = (POLE.x0 + POLE.x1) / 2, sy0 = (POLE.y0 + POLE.y1) / 2, kandidati = [];
  for (let f = Math.round(T * 0.3); f <= Math.round(T * 0.7); f++) { const p = poloha(U, f); kandidati.push([Math.hypot(p.x - sx0, (p.y - sy0) * 0.8), f]); }
  kandidati.sort((a, b) => a[0] - b[0]);
  U.ciel = kandidati[Math.floor(r() * 6)][1];
  U.obrys = poloha(U, U.ciel);
  return U;
}

const bez = (a, b, c, d, u) => { const v = 1 - u; return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d; };
const bezD = (a, b, c, d, u) => { const v = 1 - u; return 3 * v * v * (b - a) + 6 * v * u * (c - b) + 3 * u * u * (d - c); };

/** Poloha v snímke f prechodu (celé číslo). Mimo 0..T-1 je predmet mimo obrazu (null). */
export function poloha(U, f) {
  if (f < 0 || f >= U.T) return null;
  const u = f / (U.T - 1);
  const x = bez(U.A[0], U.C1[0], U.C2[0], U.B[0], u);
  let y = bez(U.A[1], U.C1[1], U.C2[1], U.B[1], u);
  let uhol;
  if (U.predmet === 'lietadlo') {
    uhol = Math.atan2(bezD(U.A[1], U.C1[1], U.C2[1], U.B[1], u), bezD(U.A[0], U.C1[0], U.C2[0], U.B[0], u)) + 0.12 * Math.sin(u * 9 + U.faza);
  } else if (U.predmet === 'lod') {
    y += 70 * Math.sin(u * Math.PI * 3 + U.faza);
    uhol = 0.42 * Math.sin(u * Math.PI * 4 + U.faza) * (U.tazka ? 1.3 : 1);
  } else if (U.predmet === 'lampas') {
    uhol = 0.7 * Math.sin(u * Math.PI * (U.tazka ? 5 : 3) + U.faza);
  } else uhol = U.uhol0 + U.spin * u;
  return { x, y, uhol };
}

/** Rozdiel dvoch polôh v pixeloch (posun stredu + oblúk otočenia na okraji predmetu). */
export function rozdiel(U, p, q) {
  if (!p || !q) return Infinity;
  let da = Math.abs(p.uhol - q.uhol) % (Math.PI * 2);
  if (da > Math.PI) da = Math.PI * 2 - da;
  return Math.hypot(p.x - q.x, p.y - q.y) + da * U.R;
}

/** Vyhodnotenie zastavenia v snímke f cyklu: { od: snímky od cieľa (+ neskoro), sadne }. */
export function vyhodnot(U, f) {
  const d = f - U.ciel;
  return { od: d, sadne: Math.abs(d) <= U.tolerancia, presne: d === 0 };
}

export function vetaVysledku(d) {
  if (d === 0) return 'Perfect frame.';
  const n = Math.abs(d);
  return `${n} frame${n === 1 ? '' : 's'} ${d < 0 ? 'early' : 'late'}.`;
}

// ---------- kreslenie ----------

const HVIEZDA = (() => { // tvar 'S' z Prism 5 (drahokamy.js), jednotka = 0,385 spritu
  const p = [];
  for (let i = 0; i < 10; i++) { const u = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.44 : 1; p.push([Math.cos(u) * r, Math.sin(u) * r + 0.06]); }
  return p;
})();
const poly = (x, body) => { x.moveTo(body[0][0], body[0][1]); for (let i = 1; i < body.length; i++) x.lineTo(body[i][0], body[i][1]); x.closePath(); };
const LIETADLO = [[1.05, 0], [-0.85, -0.78], [-0.52, 0], [-0.85, 0.78]];
const KOCKA = [[0, -1], [0.87, -0.5], [0.87, 0.5], [0, 1], [-0.87, 0.5], [-0.87, -0.5]];
const LOD = [[-1, 0.28], [-0.06, 0.28], [-0.06, -1.02], [0.06, -1.02], [0.82, 0.14], [0.82, 0.28], [1.02, 0.28], [0.72, 0.62], [-0.72, 0.62]];

/** Obrys (silueta) predmetu v jednotkových súradniciach, do aktuálnej cesty. */
export function cestaPredmetu(x, predmet) {
  if (predmet === 'drahokam') poly(x, HVIEZDA);
  else if (predmet === 'lietadlo') poly(x, LIETADLO);
  else if (predmet === 'kocka') poly(x, KOCKA);
  else if (predmet === 'lod') poly(x, LOD);
  else if (predmet === 'kniha') { const w = 0.74, h = 1, r = 0.08; x.moveTo(-w + r, -h); x.lineTo(w - r, -h); x.quadraticCurveTo(w, -h, w, -h + r); x.lineTo(w, h - r); x.quadraticCurveTo(w, h, w - r, h); x.lineTo(-w + r, h); x.quadraticCurveTo(-w, h, -w, h - r); x.lineTo(-w, -h + r); x.quadraticCurveTo(-w, -h, -w + r, -h); x.closePath(); }
  else if (predmet === 'lampas') {
    // ucho, horná strieška, telo, spodok a strapec ako jeden obrys
    x.moveTo(-0.16, -0.98); x.quadraticCurveTo(0, -1.18, 0.16, -0.98); x.lineTo(0.16, -0.86); x.lineTo(0.42, -0.86); x.lineTo(0.42, -0.72);
    x.bezierCurveTo(0.86, -0.56, 0.86, 0.5, 0.42, 0.66); x.lineTo(0.42, 0.8); x.lineTo(0.08, 0.8); x.lineTo(0.05, 1.06); x.lineTo(-0.05, 1.06); x.lineTo(-0.08, 0.8);
    x.lineTo(-0.42, 0.8); x.lineTo(-0.42, 0.66); x.bezierCurveTo(-0.86, 0.5, -0.86, -0.56, -0.42, -0.72); x.lineTo(-0.42, -0.86); x.lineTo(-0.16, -0.86); x.closePath();
  }
}

const cache = new Map();
function drahokamSprite(px) {
  const k = 'd' + px;
  if (!cache.has(k)) cache.set(k, spriteDrahokamu('S', px));
  return cache.get(k);
}

/** Predmet v unit súradniciach (volajúci nastaví translate, rotate, scale(R)). px = veľkosť v pixeloch zariadenia. */
function vyplnPredmetu(x, predmet, px) {
  x.lineJoin = 'round';
  if (predmet === 'drahokam') {
    const s = 1 / 0.385;
    x.drawImage(drahokamSprite(Math.max(32, Math.round(px * s))), -s / 2, -s / 2, s, s);
    return;
  }
  if (predmet === 'lietadlo') {
    x.fillStyle = '#f4efe4'; x.beginPath(); poly(x, [[1.05, 0], [-0.85, -0.78], [-0.52, 0]]); x.fill();
    x.fillStyle = '#c9c2b4'; x.beginPath(); poly(x, [[1.05, 0], [-0.52, 0], [-0.85, 0.78]]); x.fill();
    x.fillStyle = '#9d97aa'; x.beginPath(); poly(x, [[1.05, 0], [-0.52, 0], [-0.62, 0.16]]); x.fill();
    x.strokeStyle = 'rgba(40,40,70,0.55)'; x.lineWidth = 0.03; x.beginPath(); x.moveTo(1.05, 0); x.lineTo(-0.52, 0); x.stroke();
    return;
  }
  if (predmet === 'kocka') {
    const [a, b, c, d, e, f] = KOCKA, o = [0, 0];
    x.fillStyle = '#8fc0ff'; x.beginPath(); poly(x, [a, b, o, f]); x.fill();
    x.fillStyle = '#3f74e0'; x.beginPath(); poly(x, [o, b, c, d]); x.fill();
    x.fillStyle = '#1d3f9e'; x.beginPath(); poly(x, [o, d, e, f]); x.fill();
    x.strokeStyle = 'rgba(210,230,255,0.7)'; x.lineWidth = 0.035; x.beginPath(); poly(x, KOCKA); x.moveTo(0, 0); x.lineTo(b[0], b[1]); x.moveTo(0, 0); x.lineTo(d[0], d[1]); x.moveTo(0, 0); x.lineTo(f[0], f[1]); x.stroke();
    // bodky kocky: 1 hore, 2 vpravo, 3 vľavo (izometricky)
    const bod = (px2, py2, sx2, sy2, rot) => { x.save(); x.translate(px2, py2); x.rotate(rot); x.scale(sx2, sy2); x.beginPath(); x.arc(0, 0, 0.11, 0, Math.PI * 2); x.restore(); x.fill(); };
    x.fillStyle = '#f4efe4'; bod(0, -0.5, 1.2, 0.7, 0);
    const pr = (u, v) => [u * 0.87, -0.5 * u + v]; // pravá stena: u 0..1 doprava, v 0..1 dolu (od stredu)
    const le = (u, v) => [-u * 0.87, -0.5 * u + v];
    for (const [u, v] of [[0.28, 0.36], [0.62, 0.66]]) { const [p1, p2] = pr(u, v + 0.14); bod(p1, p2, 0.75, 1.05, -0.52); }
    for (const [u, v] of [[0.25, 0.32], [0.5, 0.52], [0.75, 0.72]]) { const [p1, p2] = le(u, v + 0.12); bod(p1, p2, 0.75, 1.05, 0.52); }
    return;
  }
  if (predmet === 'lod') {
    x.fillStyle = '#e8c77a'; x.beginPath(); poly(x, [[0.06, -0.96], [0.8, 0.14], [0.06, 0.14]]); x.fill();
    x.fillStyle = '#f4efe4'; x.beginPath(); poly(x, [[-0.1, -0.78], [-0.1, 0.14], [-0.72, 0.14]]); x.fill();
    x.fillStyle = '#6b4a2e'; x.fillRect(-0.06, -1.02, 0.12, 1.3);
    x.fillStyle = '#ff4f5e'; x.beginPath(); poly(x, [[0.06, -1.02], [0.32, -0.94], [0.06, -0.86]]); x.fill();
    const g = x.createLinearGradient(0, 0.28, 0, 0.62); g.addColorStop(0, '#4d8dff'); g.addColorStop(1, '#1b3a8a');
    x.fillStyle = g; x.beginPath(); poly(x, [[-1, 0.28], [1.02, 0.28], [0.72, 0.62], [-0.72, 0.62]]); x.fill();
    x.fillStyle = 'rgba(244,239,228,0.9)'; x.fillRect(-0.88, 0.34, 1.78, 0.05);
    return;
  }
  if (predmet === 'kniha') {
    x.fillStyle = '#ff4f5e'; x.beginPath(); cestaPredmetu(x, 'kniha'); x.fill();
    x.fillStyle = '#b8243a'; x.fillRect(-0.74, -1, 0.16, 2);
    x.fillStyle = '#f4efe4'; x.fillRect(-0.44, -0.8, 1.02, 0.2);
    x.fillStyle = '#b8243a'; x.fillRect(-0.36, -0.74, 0.6, 0.08);
    // mriežka 4 x 4 s drahokamami (kniha hlavolamov)
    const n = 4, s = 0.25, x0 = -0.44, y0 = -0.4;
    x.fillStyle = 'rgba(20,12,30,0.35)'; x.fillRect(x0, y0, n * s, n * s);
    x.strokeStyle = '#f4efe4'; x.lineWidth = 0.025; x.beginPath();
    for (let i = 0; i <= n; i++) { x.moveTo(x0 + i * s, y0); x.lineTo(x0 + i * s, y0 + n * s); x.moveTo(x0, y0 + i * s); x.lineTo(x0 + n * s, y0 + i * s); }
    x.stroke();
    const farby = ['#ffc233', '#34e0aa', '#4d8dff', '#b57bff'];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i * 3 + j * 5) % 3 !== 1) { x.fillStyle = farby[(i + j * 2) % 4]; x.beginPath(); x.arc(x0 + (j + 0.5) * s, y0 + (i + 0.5) * s, 0.075, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = '#f4efe4'; x.fillRect(-0.44, 0.74, 0.7, 0.07);
    return;
  }
  if (predmet === 'lampas') {
    const g = x.createRadialGradient(-0.12, -0.1, 0.05, 0, 0, 0.9);
    g.addColorStop(0, '#fff3c0'); g.addColorStop(0.5, '#ffc233'); g.addColorStop(1, '#d9620f');
    x.fillStyle = g; x.beginPath(); x.moveTo(-0.42, -0.72); x.bezierCurveTo(-0.86, -0.56, -0.86, 0.5, -0.42, 0.66); x.lineTo(0.42, 0.66); x.bezierCurveTo(0.86, 0.5, 0.86, -0.56, 0.42, -0.72); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(160,60,10,0.55)'; x.lineWidth = 0.03; x.beginPath();
    for (const k of [-0.34, 0, 0.34]) { x.moveTo(k * 0.9, -0.72); x.quadraticCurveTo(k * 1.9, -0.03, k * 0.9, 0.66); }
    x.stroke();
    x.fillStyle = '#2a1d3f'; x.fillRect(-0.42, -0.86, 0.84, 0.16); x.fillRect(-0.42, 0.64, 0.84, 0.16);
    x.strokeStyle = '#2a1d3f'; x.lineWidth = 0.07; x.beginPath(); x.moveTo(-0.12, -0.88); x.quadraticCurveTo(0, -1.12, 0.12, -0.88); x.stroke();
    x.fillStyle = '#ff4f5e'; x.fillRect(-0.05, 0.8, 0.1, 0.26);
  }
}

const ZIARA = { drahokam: '181,123,255', lampas: '255,194,51', lietadlo: '244,239,228', kniha: '255,79,94', kocka: '77,141,255', lod: '77,141,255' };

/** Nakreslí predmet v polohe p. m = mierka logických bodov na pixely zariadenia (na veľkosť spritu). */
export function kresliPredmet(ctx, U, p, m = 1) {
  if (!p) return;
  ctx.save();
  ctx.translate(p.x, p.y); ctx.rotate(p.uhol); ctx.scale(U.R, U.R);
  if (U.predmet === 'lampas') { // svetlo lampáša
    const z = ctx.createRadialGradient(0, 0, 0.2, 0, 0, 1.9); z.addColorStop(0, 'rgba(255,194,51,0.35)'); z.addColorStop(1, 'rgba(255,194,51,0)');
    ctx.fillStyle = z; ctx.fillRect(-2, -2, 4, 4);
  }
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 24 * m; ctx.shadowOffsetY = 10 * m;
  if (U.predmet !== 'drahokam' && U.predmet !== 'lampas') { ctx.fillStyle = 'rgba(0,0,0,0.01)'; ctx.beginPath(); cestaPredmetu(ctx, U.predmet); ctx.fill(); }
  ctx.shadowColor = 'transparent';
  vyplnPredmetu(ctx, U.predmet, U.R * m);
  ctx.restore();
}

/** Obrys cieľa. stav 0 = biely čakajúci, 1 = zasiahnutý (zlatý so žiarou). */
export function kresliObrys(ctx, U, { alfa = 1, sirka = 7, zasah = 0, cas = 0, p = U.obrys } = {}) {
  ctx.save();
  ctx.translate(p.x, p.y); ctx.rotate(p.uhol); ctx.scale(U.R, U.R);
  ctx.beginPath(); cestaPredmetu(ctx, U.predmet);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = alfa; ctx.lineJoin = 'round';
  if (zasah > 0) {
    ctx.shadowColor = `rgba(232,199,122,${0.9 * zasah})`; ctx.shadowBlur = 40 * zasah;
    ctx.strokeStyle = `rgba(232,199,122,${zasah})`; ctx.lineWidth = sirka * (1 + 0.6 * zasah); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = alfa * (1 - zasah);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = sirka + 6; ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${0.86 + 0.14 * Math.sin(cas * 6)})`; ctx.lineWidth = sirka; ctx.stroke();
  ctx.restore();
}

export const ZIARA_FARBA = ZIARA;
