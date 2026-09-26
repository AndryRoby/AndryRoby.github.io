// Ježko pre film Hedgehogs: ten istý obrys ako v hre (games/hedgehogs/index.html, --hviezda),
// nakreslený kódom raz do spritu (telo, bodliny, tvár, oko, nos, žiara), potom sa len skladá.

import { platno } from './engine/kresba.js';

// Obrys z hry, súradnice v poli 24 x 24 (bodliny hore, hlava vpravo, rovné brucho).
const OBRYS = [
  [3.4, 14.0], [1.2, 12.3], [3.9, 11.4], [2.3, 9.0], [5.2, 9.1], [4.6, 6.3], [7.2, 7.4], [7.6, 4.6], [9.7, 6.5],
  [11.0, 4.0], [12.3, 6.5], [14.4, 4.6], [14.8, 7.4], [17.4, 6.3], [16.8, 9.1], [19.7, 9.0], [18.1, 11.4],
  [20.8, 12.3], [18.6, 14.0], [20.8, 13.4], [23.2, 15.2], [21.6, 17.6], [19.4, 19.5], [3.2, 19.5], [1.4, 17.4],
];
const HROTY = [1, 3, 5, 7, 9, 11, 13, 15, 17]; // indexy špičiek bodlín

/** Sprite ježka veľkosti px (štvorec). Ježko zaberá asi 68 % šírky, zvyšok je miesto na žiaru. */
export function spriteJezka(px, { telo = ['#ffb08a', '#f2643c', '#b8401d'], ziara = 'rgba(242,100,60,0.55)' } = {}) {
  const c = platno(px, px), x = c.getContext('2d');
  const k = (px * 0.68) / 22, ox = px / 2 - 12.2 * k, oy = px / 2 - 11.9 * k;
  const bod = ([a, b]) => [ox + a * k, oy + b * k];
  const cesta = new Path2D();
  OBRYS.forEach((p, i) => { const [a, b] = bod(p); if (i) cesta.lineTo(a, b); else cesta.moveTo(a, b); });
  cesta.closePath();
  // žiara ako v hre (drop-shadow v akcentovej farbe)
  x.save();
  x.shadowColor = ziara; x.shadowBlur = px * 0.1;
  x.fillStyle = telo[1]; x.fill(cesta);
  x.restore();
  // telo s prechodom
  const g = x.createLinearGradient(0, oy + 4 * k, 0, oy + 19.5 * k);
  g.addColorStop(0, telo[0]); g.addColorStop(0.45, telo[1]); g.addColorStop(1, telo[2]);
  x.fillStyle = g; x.fill(cesta);
  x.save();
  x.clip(cesta);
  // bodliny: tmavšie čiary zo stredu chrbta k špičkám
  const [sx, sy] = bod([11.2, 15.5]);
  x.strokeStyle = 'rgba(90,24,6,0.42)'; x.lineWidth = Math.max(0.6, k * 0.55); x.lineCap = 'round';
  for (const i of HROTY) { const [a, b] = bod(OBRYS[i]); x.beginPath(); x.moveTo(sx + (a - sx) * 0.35, sy + (b - sy) * 0.35); x.lineTo(sx + (a - sx) * 0.92, sy + (b - sy) * 0.92); x.stroke(); }
  // svetlá tvár a brucho
  const [fx, fy] = bod([20.2, 16.4]);
  const tv = x.createRadialGradient(fx, fy, 0, fx, fy, 4.2 * k);
  tv.addColorStop(0, 'rgba(255,226,204,0.95)'); tv.addColorStop(1, 'rgba(255,214,186,0)');
  x.fillStyle = tv; x.fillRect(0, 0, px, px);
  // odlesk na chrbte
  const [hx, hy] = bod([9, 8]);
  const od = x.createRadialGradient(hx, hy, 0, hx, hy, 6 * k);
  od.addColorStop(0, 'rgba(255,240,225,0.35)'); od.addColorStop(1, 'rgba(255,240,225,0)');
  x.fillStyle = od; x.fillRect(0, 0, px, px);
  x.restore();
  // oko s iskrou, nos, labky
  const [ex, ey] = bod([18.6, 15.6]);
  x.fillStyle = '#1a0c06'; x.beginPath(); x.arc(ex, ey, 1.2 * k, 0, 7); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.9)'; x.beginPath(); x.arc(ex + 0.35 * k, ey - 0.4 * k, 0.38 * k, 0, 7); x.fill();
  const [nx, ny] = bod([22.7, 15.5]);
  x.fillStyle = '#2a1008'; x.beginPath(); x.arc(nx, ny, 0.95 * k, 0, 7); x.fill();
  x.fillStyle = '#6e2a12';
  for (const a of [6.5, 15.5]) { const [lx, ly] = bod([a, 19.6]); x.beginPath(); x.ellipse(lx, ly, 1.4 * k, 0.6 * k, 0, 0, 7); x.fill(); }
  return c;
}

/** Štvorcípa iskra (glint), kreslí sa aj za behu. */
export function iskra(x, cx, cy, r, alfa = 1, farba = '255,236,214') {
  if (r <= 0 || alfa <= 0) return;
  x.fillStyle = `rgba(${farba},${alfa})`;
  x.beginPath();
  x.moveTo(cx, cy - r); x.quadraticCurveTo(cx, cy, cx + r * 0.28, cy);
  x.quadraticCurveTo(cx, cy, cx, cy + r); x.quadraticCurveTo(cx, cy, cx - r * 0.28, cy);
  x.quadraticCurveTo(cx, cy, cx, cy - r);
  x.fill();
  x.beginPath();
  x.moveTo(cx - r * 0.7, cy); x.quadraticCurveTo(cx, cy, cx, cy - r * 0.2);
  x.quadraticCurveTo(cx, cy, cx + r * 0.7, cy); x.quadraticCurveTo(cx, cy, cx, cy + r * 0.2);
  x.quadraticCurveTo(cx, cy, cx - r * 0.7, cy);
  x.fill();
}
