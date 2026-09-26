// Päť drahokamov Prism 5 nakreslených kódom (fazety, lesk, žiara). Kreslia sa raz do spritu.
// Kódy: C Circle (rubín), D Diamond (zafír), Q Square (smaragd), S Star (ametyst), T Triangle (topás).

import { platno } from './engine/kresba.js';

const SVETLO = -Math.PI * 0.75; // svetlo zhora zľava

const FARBY = {
  C: { tmava: [96, 4, 18], svetla: [255, 120, 125], zvon: '#ff4f5e' },
  D: { tmava: [10, 44, 150], svetla: [140, 195, 255], zvon: '#4d8dff' },
  Q: { tmava: [8, 104, 76], svetla: [170, 255, 225], zvon: '#34e0aa' },
  S: { tmava: [70, 20, 140], svetla: [226, 190, 255], zvon: '#b57bff' },
  T: { tmava: [196, 104, 0], svetla: [255, 238, 150], zvon: '#ffc233' },
};
export const FARBA = Object.fromEntries(Object.entries(FARBY).map(([k, v]) => [k, v.zvon]));

const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const zmiesaj = (a, b, p) => [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p, a[2] + (b[2] - a[2]) * p];

function tvar(kod) {
  if (kod === 'D') return [[0, -1], [0.8, 0], [0, 1], [-0.8, 0]];
  if (kod === 'Q') {
    const a = 0.84, b = 0.56;
    return [[-b, -a], [b, -a], [a, -b], [a, b], [b, a], [-b, a], [-a, b], [-a, -b]];
  }
  if (kod === 'T') return [[0, -0.92], [0.96, 0.74], [-0.96, 0.74]];
  if (kod === 'S') {
    const p = [];
    for (let i = 0; i < 10; i++) {
      const u = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.44 : 1;
      p.push([Math.cos(u) * r, Math.sin(u) * r + 0.06]);
    }
    return p;
  }
  return null;
}

function fazetovy(x, kod, f) {
  const body = tvar(kod);
  const cx = body.reduce((s, b) => s + b[0], 0) / body.length, cy = body.reduce((s, b) => s + b[1], 0) / body.length;
  const stol = kod === 'S' ? 0.0 : kod === 'T' ? 0.44 : 0.52;
  const vnutro = body.map(([px, py]) => [cx + (px - cx) * stol, cy + (py - cy) * stol]);
  // fazety medzi vonkajším okrajom a stolom
  for (let i = 0; i < body.length; i++) {
    const j = (i + 1) % body.length;
    const mx = (body[i][0] + body[j][0]) / 2 - cx, my = (body[i][1] + body[j][1]) / 2 - cy;
    const uhol = Math.atan2(my, mx);
    let jas = 0.5 + 0.5 * Math.cos(uhol - SVETLO);
    if (kod === 'S') jas = 0.2 + 0.8 * (i % 2 ? jas * 0.75 : Math.min(1, jas * 1.1 + 0.1));
    x.beginPath();
    x.moveTo(body[i][0], body[i][1]);
    x.lineTo(body[j][0], body[j][1]);
    x.lineTo(vnutro[j][0], vnutro[j][1]);
    x.lineTo(vnutro[i][0], vnutro[i][1]);
    x.closePath();
    x.fillStyle = rgb(zmiesaj(f.tmava, f.svetla, 0.12 + jas * 0.78));
    x.fill();
  }
  if (stol > 0) {
    x.beginPath();
    vnutro.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
    x.closePath();
    const g = x.createLinearGradient(-0.5, -0.6, 0.5, 0.6);
    g.addColorStop(0, rgb(zmiesaj(f.tmava, f.svetla, 0.85)));
    g.addColorStop(1, rgb(zmiesaj(f.tmava, f.svetla, 0.42)));
    x.fillStyle = g;
    x.fill();
  }
  // hrany fazet
  x.strokeStyle = rgb(f.svetla, 0.55);
  x.lineWidth = 0.022;
  x.lineJoin = 'round';
  x.beginPath();
  body.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
  x.closePath();
  x.stroke();
  x.strokeStyle = rgb(f.svetla, 0.3);
  x.beginPath();
  for (let i = 0; i < body.length; i++) { x.moveTo(body[i][0], body[i][1]); x.lineTo(vnutro[i][0], vnutro[i][1]); }
  if (stol > 0) { vnutro.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); }
  x.stroke();
}

function gula(x, f) {
  const g = x.createRadialGradient(-0.32, -0.36, 0.04, 0, 0, 1.02);
  g.addColorStop(0, 'rgb(255,214,214)');
  g.addColorStop(0.2, rgb(zmiesaj(f.tmava, f.svetla, 0.9)));
  g.addColorStop(0.55, 'rgb(222,22,42)');
  g.addColorStop(0.86, rgb(f.tmava));
  g.addColorStop(1, 'rgb(60,2,10)');
  x.fillStyle = g;
  x.beginPath(); x.arc(0, 0, 0.88, 0, Math.PI * 2); x.fill();
  // odrazené svetlo dole
  x.save();
  x.beginPath(); x.arc(0, 0, 0.88, 0, Math.PI * 2); x.clip();
  const o = x.createRadialGradient(0.2, 0.95, 0.05, 0.2, 0.95, 0.7);
  o.addColorStop(0, 'rgba(255,150,160,0.55)'); o.addColorStop(1, 'rgba(255,150,160,0)');
  x.fillStyle = o; x.fillRect(-1, -1, 2, 2);
  x.restore();
  x.strokeStyle = 'rgba(255,140,150,0.45)'; x.lineWidth = 0.03;
  x.beginPath(); x.arc(0, 0, 0.87, 0, Math.PI * 2); x.stroke();
}

function lesk(x, kod) {
  // mäkký odlesk a malá iskra hore vľavo
  const [lx, ly] = kod === 'C' ? [-0.34, -0.42] : kod === 'T' ? [-0.12, -0.2] : kod === 'S' ? [-0.12, -0.3] : [-0.26, -0.32];
  x.save();
  x.translate(lx, ly); x.rotate(-0.6); x.scale(1, 0.55);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 0.3);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.beginPath(); x.arc(0, 0, 0.3, 0, Math.PI * 2); x.fill();
  x.restore();
  iskra(x, lx + 0.02, ly - 0.02, 0.2, 0.95);
}

/** Štvorcípa iskra (glint), kreslí sa aj za behu. */
export function iskra(x, cx, cy, r, alfa = 1, farba = '255,255,255') {
  x.fillStyle = `rgba(${farba},${alfa})`;
  x.beginPath();
  x.moveTo(cx, cy - r); x.quadraticCurveTo(cx, cy, cx + r * 0.28, cy);
  x.quadraticCurveTo(cx, cy, cx, cy + r); x.quadraticCurveTo(cx, cy, cx - r * 0.28, cy);
  x.quadraticCurveTo(cx, cy, cx, cy - r);
  x.moveTo(cx - r * 0.7, cy); x.quadraticCurveTo(cx, cy, cx, cy - r * 0.2);
  x.quadraticCurveTo(cx, cy, cx + r * 0.7, cy); x.quadraticCurveTo(cx, cy, cx, cy + r * 0.2);
  x.quadraticCurveTo(cx, cy, cx - r * 0.7, cy);
  x.fill();
}

/**
 * Sprite drahokamu: plátno velkost x velkost (pixely zariadenia), drahokam s polomerom ~0.36 plátna,
 * so žiarou a tieňom. Kreslí sa raz pri stavbe vrstiev.
 */
export function spriteDrahokamu(kod, velkost) {
  const c = platno(velkost, velkost), x = c.getContext('2d'), f = FARBY[kod];
  x.translate(velkost / 2, velkost / 2);
  x.scale(velkost * 0.385, velkost * 0.385);
  // žiara
  const z = x.createRadialGradient(0, 0.05, 0.2, 0, 0.05, 1.35);
  z.addColorStop(0, rgb(f.svetla, 0.28)); z.addColorStop(1, rgb(f.svetla, 0));
  x.fillStyle = z; x.fillRect(-1.4, -1.4, 2.8, 2.8);
  // tieň
  x.save(); x.translate(0.05, 0.9); x.scale(1, 0.22);
  const t = x.createRadialGradient(0, 0, 0, 0, 0, 0.8);
  t.addColorStop(0, 'rgba(0,0,0,0.5)'); t.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = t; x.beginPath(); x.arc(0, 0, 0.8, 0, Math.PI * 2); x.fill();
  x.restore();
  if (kod === 'C') gula(x, f); else fazetovy(x, kod, f);
  lesk(x, kod);
  return c;
}
