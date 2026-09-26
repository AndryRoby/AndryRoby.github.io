// UNSCORED: mapa súvislostí Lower Weir. Papierová rytina v nočnej hmle.
// Vrstvy: základ (rytina, okná, kartičky; kreslí sa raz, potom len zmenené obdĺžniky), polovičná kópia na oddialenie,
// hmla (0,25 px na jednotku, zväčšená bilineárne), nitky a efekty pri skladaní, kužele Správcu na samostatnom plátne.
// Kreslenie bez filtrov, tieňov, vzorov a source-in (Firefox). Pozri vizual-spec.md časti 5 a 10.

import { SVET, ULICE, RIEKA, URAD, STLPY, UZLY, KARTA, OKNO, postavSvet, obalKarty, rng, hash, uzol } from './svet.mjs';
import { kresba, tahyPo } from './kresby.mjs';
import { Track, PRESETS, springStep, springDisp, KRIVKY } from './pohyb.js';

export const P = {
  noc: '#11151B',
  papier: '#EFE6D2',
  karta: '#F6F0E1',
  atrament: '#1C1B19',
  tlmeny: '#5C574D',
  lampas: '#F2A541',
  lampasTmavy: '#8A4B0F',
  peciatka: '#A83A28',
  spravca: '#9CC9E8',
  spravcaAtrament: '#2F5F7F',
  oknoTma: '#26241F',
  priecka: '#FCE3B0',
};
const INK = (a) => `rgba(28,27,25,${a})`;
const W = SVET.w;
const H = SVET.h;
const TY = UZLY[0];
export const PISMO = { odboj: '"Courier Prime", "Courier New", monospace', spravca: '"Plex Mono", "IBM Plex Mono", monospace', nadpis: 'Fraunces, Georgia, serif' };

// ------------------------------------------------------------ pomocné kreslenie

/** Šrafy konvexného mnohouholníka (ploché pole x, y) rovnobežné s uhlom, krok v jednotkách. Len pridá do cesty. */
export function srafuj(ctx, poly, uhol, krok) {
  const dx = Math.cos(uhol);
  const dy = Math.sin(uhol);
  const nx = -dy;
  const ny = dx;
  const n = poly.length / 2;
  let pmin = Infinity;
  let pmax = -Infinity;
  for (let i = 0; i < n; i++) {
    const p = poly[2 * i] * nx + poly[2 * i + 1] * ny;
    if (p < pmin) pmin = p;
    if (p > pmax) pmax = p;
  }
  for (let p = Math.ceil(pmin / krok) * krok; p < pmax; p += krok) {
    let t0 = Infinity;
    let t1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = poly[2 * i];
      const ay = poly[2 * i + 1];
      const bx = poly[2 * j];
      const by = poly[2 * j + 1];
      const pa = ax * nx + ay * ny;
      const pb = bx * nx + by * ny;
      if (pa === pb || (pa - p) * (pb - p) > 0) continue;
      const u = (p - pa) / (pb - pa);
      const tt = (ax + (bx - ax) * u) * dx + (ay + (by - ay) * u) * dy;
      if (tt < t0) t0 = tt;
      if (tt > t1) t1 = tt;
    }
    if (t1 - t0 > 0.3) {
      ctx.moveTo(nx * p + dx * t0, ny * p + dy * t0);
      ctx.lineTo(nx * p + dx * t1, ny * p + dy * t1);
    }
  }
}

function poly(ctx, b) {
  ctx.moveTo(b[0], b[1]);
  for (let i = 2; i < b.length; i += 2) ctx.lineTo(b[i], b[i + 1]);
  ctx.closePath();
}

function text(ctx, s, x, y, o) {
  ctx.font = o.font;
  ctx.fillStyle = o.farba;
  ctx.textAlign = o.zarovnanie || 'center';
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = (o.rozostup || 0) + 'px';
  if (o.uhol) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.uhol);
    ctx.fillText(s, 0, 0);
    ctx.restore();
  } else ctx.fillText(s, x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

// ------------------------------------------------------------ rytina štvrte (v jednotkách sveta)

function kresliRieku(ctx) {
  const { hore, dole } = RIEKA;
  const r = rng(5);
  const splavX = (y) => 604 + ((y - hore) / (dole - hore)) * 72;
  // nábrežný múr
  ctx.lineCap = 'round';
  ctx.strokeStyle = P.atrament;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(14, 551.5);
  ctx.lineTo(986, 551.5);
  ctx.moveTo(14, hore);
  ctx.lineTo(986, hore);
  ctx.stroke();
  ctx.lineWidth = 0.45;
  ctx.strokeStyle = INK(0.7);
  ctx.beginPath();
  ctx.moveTo(14, 558.8);
  ctx.lineTo(986, 558.8);
  for (let x = 16; x < 986; x += 9) {
    ctx.moveTo(x, 551.5);
    ctx.lineTo(x, 558.8);
    ctx.moveTo(x + 4.5, 558.8);
    ctx.lineTo(x + 4.5, hore);
  }
  ctx.stroke();
  // voda: vodorovné čiary, husté pri brehoch, riedke v strede, pod splavom vlnité
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = INK(0.62);
  ctx.beginPath();
  for (let y = hore + 2.4; y < dole - 1; y += 2.5) {
    const d = Math.min(y - hore, dole - y) / ((dole - hore) / 2);
    const hustota = 0.95 - 0.62 * d;
    let x = 14 + r() * 6;
    while (x < 986) {
      const len = 4 + r() * 15;
      if (r() < hustota && !(x + len > RIEKA.lavka - 7 && x < RIEKA.lavka + 19)) {
        const sx = splavX(y);
        const dolu = x + len < sx - 7;
        const hore2 = x > sx + 7;
        if (dolu || hore2) {
          const v = dolu ? 0.9 : 0.25;
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + len / 2, y + (r() - 0.5) * v * 2, x + len, y);
        }
      }
      x += len + 1.5 + r() * 4.5;
    }
  }
  ctx.stroke();
  // pena pod splavom
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = INK(0.7);
  ctx.beginPath();
  for (let i = 0; i < 26; i++) {
    const y = hore + 6 + r() * (dole - hore - 12);
    const x = splavX(y) - 9 - r() * 26;
    ctx.moveTo(x - 2.5, y);
    ctx.quadraticCurveTo(x, y + 2.2, x + 2.5, y);
  }
  ctx.stroke();
  // splav: pás s priečnymi šrafami a stavidlami
  const [[ax, ay], [bx, by]] = RIEKA.splav;
  const dl = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / dl;
  const uy = (by - ay) / dl;
  const px = -uy * 5;
  const py = ux * 5;
  const pas = [ax + px, ay + py, bx + px, by + py, bx - px, by - py, ax - px, ay - py];
  ctx.fillStyle = P.papier;
  ctx.beginPath();
  poly(ctx, pas);
  ctx.fill();
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = P.atrament;
  ctx.stroke();
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  srafuj(ctx, pas, Math.atan2(py, px), 1.6);
  ctx.stroke();
  ctx.lineWidth = 0.8;
  ctx.fillStyle = P.papier;
  for (let i = 1; i <= 4; i++) {
    const cx = ax + ux * dl * (i / 5);
    const cy = ay + uy * dl * (i / 5);
    ctx.beginPath();
    ctx.rect(cx - 3, cy - 3, 6, 6);
    ctx.fill();
    ctx.stroke();
  }
  // lávka
  const L = RIEKA.lavka;
  ctx.fillStyle = P.papier;
  ctx.fillRect(L, hore, 12, dole - hore);
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = P.atrament;
  ctx.beginPath();
  ctx.moveTo(L, hore);
  ctx.lineTo(L, dole);
  ctx.moveTo(L + 12, hore);
  ctx.lineTo(L + 12, dole);
  ctx.stroke();
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  for (let y = hore + 1.5; y < dole; y += 2.3) {
    ctx.moveTo(L, y);
    ctx.lineTo(L + 12, y);
  }
  for (const y of [hore + 46, hore + 92]) {
    ctx.rect(L - 3, y - 2, 18, 4);
  }
  ctx.stroke();
  // člny
  ctx.lineWidth = 0.7;
  for (const [x, y, s] of [[176, 598, 1], [826, 592, -1], [468, 676, 1], [940, 650, -1]]) {
    ctx.fillStyle = P.papier;
    ctx.beginPath();
    ctx.moveTo(x - 15 * s, y);
    ctx.quadraticCurveTo(x - 4 * s, y + 7, x + 13 * s, y + 1);
    ctx.lineTo(x + 15 * s, y - 2.5);
    ctx.lineTo(x - 15 * s, y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.lineWidth = 0.4;
    for (let k = -10; k < 11; k += 2.2) {
      ctx.moveTo(x + k * s, y - 1.6);
      ctx.lineTo(x + (k + 1.2) * s, y + 3.2 - Math.abs(k) * 0.18);
    }
    ctx.stroke();
    ctx.lineWidth = 0.7;
  }
  // protiľahlý breh: čiara, trsy, stromy
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = P.atrament;
  ctx.beginPath();
  ctx.moveTo(14, dole);
  for (let x = 14; x <= 986; x += 12) ctx.lineTo(x, dole + Math.sin(x * 0.05) * 1.6);
  ctx.stroke();
  ctx.lineWidth = 0.45;
  ctx.strokeStyle = INK(0.7);
  ctx.beginPath();
  for (let i = 0; i < 150; i++) {
    const x = 16 + r() * 968;
    const y = dole + 5 + r() * 36;
    for (let k = -1; k <= 1; k++) {
      ctx.moveTo(x + k * 1.1, y);
      ctx.lineTo(x + k * 1.8, y - 2.5 - r() * 1.5);
    }
  }
  ctx.stroke();
}

function kresliStrom(ctx, s, r) {
  ctx.fillStyle = P.papier;
  ctx.strokeStyle = P.atrament;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y + s.r * 0.6);
  ctx.lineTo(s.x, s.y + s.r * 1.5);
  ctx.stroke();
  ctx.beginPath();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = s.r * (0.86 + 0.2 * hash(i, Math.round(s.x)));
    const x = s.x + Math.cos(a) * rr;
    const y = s.y + Math.sin(a) * rr * 0.9;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  const b = [];
  for (let i = 0; i < 10; i++) {
    const a = -0.9 + (i / 9) * 1.8;
    b.push(s.x + Math.cos(a) * s.r * 0.85, s.y + Math.sin(a) * s.r * 0.78);
  }
  b.push(s.x + s.r * 0.2, s.y);
  srafuj(ctx, b, Math.PI * 0.3, 1.3);
  ctx.stroke();
}

function kresliUlice(ctx) {
  const s = ULICE.sirka / 2;
  const X = ULICE.zvisle.map((u) => u.x);
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = INK(0.8);
  ctx.beginPath();
  for (const u of ULICE.vodorovne) {
    let x0 = 14;
    for (const xv of [...X, 986 + s]) {
      const x1 = xv - s;
      ctx.moveTo(x0, u.y - s);
      ctx.lineTo(x1, u.y - s);
      if (u.y !== 540) {
        ctx.moveTo(x0, u.y + s);
        ctx.lineTo(x1, u.y + s);
      }
      x0 = xv + s;
    }
  }
  const Y = [14 - s, ...ULICE.vodorovne.map((u) => u.y)];
  for (const z of ULICE.zvisle) {
    for (let i = 0; i < Y.length - 1; i++) {
      ctx.moveTo(z.x - s, Y[i] + s);
      ctx.lineTo(z.x - s, Y[i + 1] - s);
      ctx.moveTo(z.x + s, Y[i] + s);
      ctx.lineTo(z.x + s, Y[i + 1] - s);
    }
  }
  ctx.stroke();
  // dlažba: riedke bodky
  const r = rng(99);
  ctx.fillStyle = INK(0.26);
  for (const u of ULICE.vodorovne) {
    for (let x = 16; x < 984; x += 3.6) {
      for (let k = -2; k <= 2; k++) if (r() < 0.42) ctx.fillRect(x + r() * 1.5, u.y + k * 3.7 + r() * 1.2, 0.9, 0.7);
    }
  }
  for (const z of ULICE.zvisle) {
    for (let y = 16; y < 529; y += 3.6) {
      if (ULICE.vodorovne.some((u) => Math.abs(u.y - y) < s)) continue;
      for (let k = -2; k <= 2; k++) if (r() < 0.42) ctx.fillRect(z.x + k * 3.7 + r() * 1.2, y + r() * 1.5, 0.7, 0.9);
    }
  }
  // mená ulíc
  const o = { font: `8px ${PISMO.odboj}`, farba: P.tlmeny, rozostup: 1.6 };
  text(ctx, 'KILN LANE', 285, 193, o);
  text(ctx, 'KILN LANE', 795, 193, o);
  text(ctx, 'LAMP STREET', 285, 363, o);
  text(ctx, 'LAMP STREET', 795, 363, o);
  text(ctx, 'WEIR STREET', 470, 543, o);
  text(ctx, 'WEIR STREET', 820, 543, o);
  const v = { ...o, uhol: -Math.PI / 2 };
  text(ctx, 'MILL STAIR', 153, 450, v);
  text(ctx, "TANNER'S ROW", 423, 275, v);
  text(ctx, 'SLUICE LANE', 693, 450, v);
  text(ctx, 'FERRY STEPS', 903, 275, v);
}

function kresliZahrady(ctx, zahrady) {
  const r = rng(41);
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = INK(0.75);
  ctx.beginPath();
  for (const z of zahrady) {
    // živý plot: oblúčiky, medzi nimi nízky plot so stĺpikmi
    let x = z.x;
    while (x < z.x + z.w - 4) {
      const plot = r() < 0.35;
      const dl = 14 + r() * 26;
      const x1 = Math.min(z.x + z.w, x + dl);
      if (plot) {
        ctx.moveTo(x, z.y + 3.2);
        ctx.lineTo(x1, z.y + 3.2);
        for (let px = x; px <= x1; px += 4) {
          ctx.moveTo(px, z.y + 1.2);
          ctx.lineTo(px, z.y + 4.6);
        }
      } else {
        ctx.moveTo(x, z.y + 4.6);
        for (let px = x; px < x1 - 1; px += 3.1) ctx.quadraticCurveTo(px + 1.55, z.y + 0.6 + r() * 1.2, px + 3.1, z.y + 4.6);
      }
      x = x1 + 2 + r() * 6;
    }
  }
  ctx.stroke();
}

function kresliUrad(ctx) {
  const u = URAD;
  ctx.fillStyle = P.papier;
  ctx.fillRect(u.x - 4, u.y - 8, u.w + 8, u.h + 8);
  ctx.fillStyle = 'rgba(156,201,232,0.34)';
  ctx.fillRect(u.x, u.y, u.w, u.h);
  ctx.strokeStyle = P.spravcaAtrament;
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  for (let x = u.x + 9; x < u.x + u.w; x += 9) {
    ctx.moveTo(x, u.y);
    ctx.lineTo(x, u.y + u.h);
  }
  for (let y = u.y + 13; y < u.y + u.h; y += 13) {
    ctx.moveTo(u.x, y);
    ctx.lineTo(u.x + u.w, y);
  }
  ctx.stroke();
  ctx.lineWidth = 1.1;
  ctx.strokeRect(u.x, u.y, u.w, u.h);
  ctx.strokeRect(u.x - 4, u.y - 8, u.w + 8, 8);
  ctx.fillStyle = P.papier;
  ctx.fillRect(u.x + u.w / 2 - 12, u.y + u.h - 16, 24, 16);
  ctx.strokeRect(u.x + u.w / 2 - 12, u.y + u.h - 16, 24, 16);
  text(ctx, 'CIVIC CREDIT OFFICE', u.x + u.w / 2, u.y - 1.6, { font: `500 5.4px ${PISMO.spravca}`, farba: P.papier, rozostup: 1.2 });
  // námestie pred úradom
  ctx.lineWidth = 0.35;
  ctx.strokeStyle = 'rgba(47,95,127,0.55)';
  ctx.beginPath();
  for (let x = u.x - 10; x <= u.x + u.w + 10; x += 6) {
    ctx.moveTo(x, u.y + u.h + 2);
    ctx.lineTo(x, 178);
  }
  ctx.moveTo(u.x - 10, u.y + u.h + 8);
  ctx.lineTo(u.x + u.w + 10, u.y + u.h + 8);
  ctx.stroke();
}

function kresliDom(ctx, d) {
  const top = d.zem - d.h;
  const roof = d.stit
    ? [d.x - 0.5, top, d.x + d.w / 2, top - d.strecha - 3, d.x + d.w + 0.5, top]
    : [d.x - 1, top, d.x + 2.5, top - d.strecha, d.x + d.w - 2.5, top - d.strecha, d.x + d.w + 1, top];
  ctx.fillStyle = P.papier;
  ctx.beginPath();
  poly(ctx, roof);
  ctx.fill();
  ctx.fillRect(d.x, top, d.w, d.h);
  // strecha
  ctx.lineWidth = 0.42;
  ctx.strokeStyle = INK(0.58);
  ctx.beginPath();
  srafuj(ctx, roof, d.stit ? -Math.PI * 0.28 : Math.PI * 0.36, 1.55);
  ctx.stroke();
  // tieň na pravej časti fasády
  if (d.tien) {
    const x0 = d.x + d.w * 0.7;
    ctx.lineWidth = 0.38;
    ctx.strokeStyle = INK(0.42);
    ctx.beginPath();
    for (let x = x0; x < d.x + d.w - 0.3; x += 1.35) {
      ctx.moveTo(x, top + 0.6);
      ctx.lineTo(x, d.zem);
    }
    ctx.stroke();
  }
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = P.atrament;
  ctx.beginPath();
  poly(ctx, roof);
  ctx.rect(d.x, top, d.w, d.h);
  ctx.moveTo(d.x - 0.8, top + 0.6);
  ctx.lineTo(d.x + d.w + 0.8, top + 0.6);
  ctx.stroke();
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(d.x, d.zem - 12.5);
  ctx.lineTo(d.x + d.w, d.zem - 12.5);
  ctx.stroke();
  if (d.komin && !d.stit) {
    const cx = d.x + d.w * 0.68;
    ctx.fillStyle = P.papier;
    ctx.fillRect(cx, top - d.strecha - 5, 3.6, 6.5);
    ctx.lineWidth = 0.6;
    ctx.strokeRect(cx, top - d.strecha - 5, 3.6, 6.5);
  }
  // dvere
  ctx.fillStyle = P.oknoTma;
  ctx.fillRect(d.x + 3, d.zem - 9.5, 4.6, 9.5);
}

/** Okno: 0 tma, 1 svieti; mierka rozsvietenia s (0..1.1) kreslí jantár zo stredu. */
export function kresliOkno(ctx, o, s = 0, alfa = 1) {
  ctx.fillStyle = P.oknoTma;
  ctx.fillRect(o.x, o.y, OKNO.w, OKNO.h);
  if (s <= 0) return;
  const w = OKNO.w * s;
  const h = OKNO.h * s;
  const x = o.x + (OKNO.w - w) / 2;
  const y = o.y + (OKNO.h - h) / 2;
  ctx.globalAlpha = alfa;
  ctx.fillStyle = P.lampas;
  ctx.fillRect(x, y, w, h);
  if (s > 0.8) {
    ctx.fillStyle = P.priecka;
    ctx.fillRect(o.x + OKNO.w / 2 - 0.3, o.y + 0.5, 0.6, OKNO.h - 1);
    ctx.fillRect(o.x + 0.5, o.y + OKNO.h * 0.42 - 0.3, OKNO.w - 1, 0.6);
  }
  ctx.globalAlpha = 1;
}

function kresliStlp(ctx, s) {
  ctx.strokeStyle = P.spravcaAtrament;
  ctx.fillStyle = P.papier;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
  ctx.moveTo(s.x, s.y - 2.2);
  ctx.lineTo(s.x, s.y - 14);
  ctx.stroke();
  ctx.save();
  ctx.translate(s.x, s.y - 14);
  ctx.rotate(s.uhol);
  ctx.beginPath();
  ctx.rect(-2, -2, 8, 4);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(6, 0, 1.2, 0, Math.PI * 2);
  ctx.fillStyle = P.spravcaAtrament;
  ctx.fill();
  ctx.restore();
}

function kresliRam(ctx) {
  ctx.strokeStyle = P.atrament;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.lineWidth = 0.5;
  ctx.strokeRect(12.5, 12.5, W - 25, H - 25);
  // súradnice ako na starej mape
  const o = { font: `6px ${PISMO.odboj}`, farba: P.tlmeny };
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const x = 12.5 + (i + 0.5) * ((W - 25) / 10);
    text(ctx, 'ABCDEFGHIJ'[i], x, 11.4, o);
    ctx.moveTo(12.5 + i * ((W - 25) / 10), 8);
    ctx.lineTo(12.5 + i * ((W - 25) / 10), 12.5);
  }
  for (let i = 0; i < 7; i++) {
    const y = 12.5 + (i + 0.5) * ((H - 25) / 7);
    text(ctx, String(i + 1), 10.3, y + 2, o);
    ctx.moveTo(8, 12.5 + i * ((H - 25) / 7));
    ctx.lineTo(12.5, 12.5 + i * ((H - 25) / 7));
  }
  ctx.stroke();
  // kartuša
  const k = { x: 742, y: 646, w: 226, h: 88 };
  ctx.fillStyle = P.papier;
  ctx.fillRect(k.x, k.y, k.w, k.h);
  ctx.lineWidth = 1.3;
  ctx.strokeRect(k.x, k.y, k.w, k.h);
  ctx.lineWidth = 0.45;
  ctx.strokeRect(k.x + 3.5, k.y + 3.5, k.w - 7, k.h - 7);
  text(ctx, 'LOWER WEIR', k.x + k.w / 2, k.y + 34, { font: `600 25px ${PISMO.nadpis}`, farba: P.atrament, rozostup: 3 });
  text(ctx, 'Ward 7 of the City of Aetheria', k.x + k.w / 2, k.y + 50, { font: `7.5px ${PISMO.odboj}`, farba: P.tlmeny });
  text(ctx, 'surveyed by hand, 2049', k.x + k.w / 2, k.y + 60, { font: `7.5px ${PISMO.odboj}`, farba: P.tlmeny });
  const sx = k.x + 58;
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? P.papier : P.atrament;
    ctx.fillRect(sx + i * 27.5, k.y + 68, 27.5, 3.2);
  }
  ctx.strokeRect(sx, k.y + 68, 110, 3.2);
  text(ctx, '0', sx, k.y + 80, { font: `6px ${PISMO.odboj}`, farba: P.tlmeny });
  text(ctx, '100 yards', sx + 110, k.y + 80, { font: `6px ${PISMO.odboj}`, farba: P.tlmeny });
  // sever
  const cx = 44;
  const cy = 628;
  ctx.fillStyle = P.papier;
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - 11);
  ctx.lineTo(cx + 3.2, cy + 5);
  ctx.lineTo(cx, cy + 2.5);
  ctx.lineTo(cx - 3.2, cy + 5);
  ctx.closePath();
  ctx.fillStyle = P.atrament;
  ctx.fill();
  text(ctx, 'N', cx, cy + 22, { font: `700 7px ${PISMO.odboj}`, farba: P.atrament });
}

/** Kroky kreslenia základu v poradí (najprv okolie hráča). Každý krok je funkcia(ctx) v jednotkách sveta. */
export function krokyZakladu(svet, zrno) {
  const kroky = [];
  kroky.push((ctx) => {
    ctx.fillStyle = P.papier;
    ctx.fillRect(0, 0, W, H);
    if (zrno) {
      const t = zrno.width / 2;
      for (let y = 0; y < H; y += t) for (let x = 0; x < W; x += t) ctx.drawImage(zrno, x, y, t, t);
    }
    const r = rng(31);
    ctx.fillStyle = 'rgba(120,86,40,0.035)';
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.arc(r() * W, r() * H, 6 + r() * 18, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  kroky.push((ctx) => {
    kresliUlice(ctx);
    kresliZahrady(ctx, svet.zahrady);
  });
  const domy = svet.domy.map((d, i) => ({ d, i, v: Math.hypot(d.x + d.w / 2 - TY.x, d.zem - TY.y) })).sort((a, b) => a.v - b.v);
  const oknaDomu = new Map();
  for (const o of svet.okna) {
    if (!oknaDomu.has(o.dom)) oknaDomu.set(o.dom, []);
    oknaDomu.get(o.dom).push(o);
  }
  for (let i = 0; i < domy.length; i += 14) {
    const cast = domy.slice(i, i + 14);
    kroky.push((ctx) => {
      for (const { d, i: di } of cast) {
        kresliDom(ctx, d);
        for (const o of oknaDomu.get(di) || []) kresliOkno(ctx, o, 0);
      }
    });
    if (i === 28) kroky.push((ctx) => kresliUrad(ctx));
  }
  kroky.push((ctx) => {
    kresliRieku(ctx);
    const r = rng(8);
    for (const s of svet.stromy) kresliStrom(ctx, s, r);
  });
  kroky.push((ctx) => {
    for (const s of STLPY) kresliStlp(ctx, s);
    kresliRam(ctx);
  });
  return kroky;
}

// ------------------------------------------------------------ kartička uzla

const SPENDLIK = { x: 0, y: -KARTA.h / 2 + 3 };

export function bodSpendlika(u) {
  const a = (u.rot * Math.PI) / 180;
  return { x: u.x + SPENDLIK.x * Math.cos(a) - SPENDLIK.y * Math.sin(a), y: u.y + SPENDLIK.x * Math.sin(a) + SPENDLIK.y * Math.cos(a) };
}

/** Kartička: mierka m (položenie), pero p (0..1), text a pečiatka na konci. */
export function kresliKartu(ctx, u, m = 1, p = 1) {
  const k = kresba(u.id);
  ctx.save();
  ctx.translate(u.x, u.y);
  ctx.rotate((u.rot * Math.PI) / 180);
  ctx.scale(m, m);
  const w = KARTA.w;
  const h = KARTA.h;
  ctx.fillStyle = P.karta;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = P.atrament;
  ctx.lineWidth = 0.7;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = INK(0.45);
  ctx.lineWidth = 0.35;
  ctx.strokeRect(-w / 2 + 2.5, -h / 2 + 2.5, w - 5, h - 5);
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 6, 14);
  ctx.lineTo(w / 2 - 6, 14);
  ctx.stroke();
  if (p > 0) {
    ctx.strokeStyle = P.atrament;
    ctx.lineWidth = 1.05;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    tahyPo(ctx, k, k.spolu * Math.min(1, p / 0.82));
    ctx.stroke();
  }
  if (p > 0.82) {
    const n = Math.ceil(u.popis.length * Math.min(1, (p - 0.82) / 0.16));
    text(ctx, u.popis.slice(0, n), 0, 21, { font: `7px ${PISMO.odboj}`, farba: P.atrament });
  }
  if (u.id === 'ty' && p >= 0.99) {
    ctx.save();
    ctx.translate(19.5, -13.5);
    ctx.rotate(-0.22);
    ctx.strokeStyle = P.peciatka;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
    ctx.stroke();
    text(ctx, '0', 0, 3.6, { font: `700 10px ${PISMO.odboj}`, farba: P.peciatka });
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------ hmla

function platno(w, h) {
  if (typeof OffscreenCanvas === 'function' && typeof document === 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

class Mlha {
  constructor(F = 0.25) {
    this.F = F;
    this.w = Math.ceil(W * F);
    this.h = Math.ceil(H * F);
    this.stat = platno(this.w, this.h);
    this.disp = platno(this.w, this.h);
    this.anim = [];
    this.sprite = platno(64, 64);
    const s = this.sprite.getContext('2d');
    const g = s.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.55, 'rgba(0,0,0,1)');
    g.addColorStop(0.72, 'rgba(0,0,0,0.78)');
    g.addColorStop(0.86, 'rgba(0,0,0,0.36)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    s.fillStyle = g;
    s.fillRect(0, 0, 64, 64);
    this._textura();
  }

  _textura() {
    const c = this.stat.getContext('2d');
    const img = c.createImageData(this.w, this.h);
    const sum = (x, y, bunka, seed) => {
      const gx = Math.floor(x / bunka);
      const gy = Math.floor(y / bunka);
      const fx = x / bunka - gx;
      const fy = y / bunka - gy;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const a = hash(gx + gy * 131, seed);
      const b = hash(gx + 1 + gy * 131, seed);
      const d = hash(gx + (gy + 1) * 131, seed);
      const e = hash(gx + 1 + (gy + 1) * 131, seed);
      return a + (b - a) * sx + (d - a) * sy + (a - b - d + e) * sx * sy;
    };
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const n1 = sum(x, y, 14, 3);
        const n2 = sum(x, y, 5, 9);
        const i = (y * this.w + x) * 4;
        const m = n2 * 0.6 + n1 * 0.4;
        img.data[i] = 17 + m * 12;
        img.data[i + 1] = 21 + m * 15;
        img.data[i + 2] = 27 + m * 20;
        img.data[i + 3] = 255 * Math.min(1, 0.93 + 0.05 * n1 + 0.025 * n2);
      }
    }
    c.putImageData(img, 0, 0);
  }

  diera(x, y, r) {
    const c = this.stat.getContext('2d');
    c.globalCompositeOperation = 'destination-out';
    c.drawImage(this.sprite, (x - r) * this.F, (y - r) * this.F, 2 * r * this.F, 2 * r * this.F);
    c.globalCompositeOperation = 'source-over';
  }

  animuj(x, y, r, t0) {
    this.anim.push({ x, y, r, t0 });
  }

  /** Vráti plátno hmly v čase t; dokončené diery zapečie. Do `spinave` pridá obdĺžniky, ktoré sa menia. */
  platno(t, spinave) {
    if (!this.anim.length) return this.stat;
    let bezi = false;
    for (let i = this.anim.length - 1; i >= 0; i--) {
      const a = this.anim[i];
      if (t < a.t0) {
        bezi = true;
        continue;
      }
      if (springStep(PRESETS.gentle, t - a.t0) >= 1) {
        this.diera(a.x, a.y, a.r);
        this.anim.splice(i, 1);
      } else bezi = true;
      if (spinave) spinave.push(a.x - a.r, a.y - a.r, 2 * a.r, 2 * a.r);
    }
    if (!bezi) return this.stat;
    const c = this.disp.getContext('2d');
    c.globalCompositeOperation = 'copy';
    c.drawImage(this.stat, 0, 0);
    c.globalCompositeOperation = 'destination-out';
    for (const a of this.anim) {
      if (t < a.t0) continue;
      const r = a.r * springStep(PRESETS.gentle, t - a.t0);
      if (r > 0.5) c.drawImage(this.sprite, (a.x - r) * this.F, (a.y - r) * this.F, 2 * r * this.F, 2 * r * this.F);
    }
    c.globalCompositeOperation = 'source-over';
    return this.disp;
  }

  bezi() {
    return this.anim.length > 0;
  }
}

// ------------------------------------------------------------ mapa na obrazovke

const citanie = (s) => s.split(/\s+/).length / 3 + 1.2;

export class Mapa {
  constructor(cv, kuzele, o = {}) {
    this.cv = cv;
    this.ctx = cv.getContext('2d', { alpha: false });
    this.kc = kuzele;
    this.kctx = kuzele ? kuzele.getContext('2d') : null;
    this.reduced = !!o.reduced;
    this.slabe = !!o.slabe;
    this.S = this.slabe ? 1.5 : 2;
    this.naUzol = o.naUzol || (() => {});
    this.poKamere = o.poKamere || (() => {});
    this.svet = postavSvet();
    this.okna = this.svet.okna;
    this.poradie = this.svet.poradieOkien;
    this.svietia = 0;
    this.odhaleneOkna = 0;
    this.uzly = new Set();
    this.piny = new Map();
    this.nitky = [];
    this.anim = [];
    this.vlny = [];
    this.plan = [];
    this.fronta = [];
    this.volnyOd = 0;
    this.vodit = null;
    this.pozornost = 0;
    this.potichu = false;
    this.klopT = -99;
    this.aktivita = this.cas();
    this.okraje = { hore: 0, dole: 0 };
    this.zmrazene = false;
    this.pripravena = false;
    this.cam = { x: new Track(TY.x, PRESETS.camera), y: new Track(TY.y, PRESETS.camera), lk: new Track(0, PRESETS.camera) };
    this.kam = { cx: TY.x, cy: TY.y, k: 1 };
    this.raf = 0;
    this.poslKuzel = 0;
    this.snimky = [];
    this._tick = this._tick.bind(this);
  }

  cas() {
    return performance.now() / 1000;
  }

  /** Vytvorí plátna, začne kresliť základ po kúskoch. Vracia Promise, ktorý sa splní po celom základe. */
  async init() {
    const S = this.S;
    this.base = platno(Math.ceil(W * S), Math.ceil(H * S));
    this.bctx = this.base.getContext('2d');
    this.base2 = platno(Math.ceil((W * S) / 2), Math.ceil((H * S) / 2));
    this.b2ctx = this.base2.getContext('2d');
    this.mlha = new Mlha();
    this.mlha.diera(TY.x, TY.y, 95);
    this.velkost();
    this.bctx.fillStyle = P.papier;
    this.bctx.fillRect(0, 0, this.base.width, this.base.height);
    const zrno = this._zrno();
    const kroky = krokyZakladu(this.svet, zrno);
    const S2 = S;
    let i = 0;
    await new Promise((hotovo) => {
      const krok = () => {
        const t0 = performance.now();
        while (i < kroky.length && performance.now() - t0 < 8) {
          this.bctx.setTransform(S2, 0, 0, S2, 0, 0);
          kroky[i++](this.bctx);
        }
        this.bctx.setTransform(1, 0, 0, 1, 0, 0);
        if (i < kroky.length) setTimeout(krok, 0);
        else hotovo();
      };
      krok();
    });
    this._kartaHned(uzol('ty'));
    this.uzly.add('ty');
    this.piny.set('ty', -99);
    this.b2ctx.drawImage(this.base, 0, 0, this.base2.width, this.base2.height);
    this.pripravena = true;
    if (this.cielLudi !== undefined) {
      const n = this.cielLudi;
      this.cielLudi = undefined;
      this.nastavLudi(n, { hned: true });
    }
    this._fronta();
    this._skoc(this._ramNa(this._domov()));
    this.plne = true;
    this.kick();
  }

  _zrno() {
    const c = platno(128, 128);
    const x = c.getContext('2d');
    const img = x.createImageData(128, 128);
    const r = rng(17);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = r();
      if (v < 0.34) {
        img.data[i] = 70;
        img.data[i + 1] = 55;
        img.data[i + 2] = 35;
        img.data[i + 3] = r() * 16;
      } else if (v > 0.965) {
        img.data[i] = 255;
        img.data[i + 1] = 252;
        img.data[i + 2] = 240;
        img.data[i + 3] = 30 + r() * 30;
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  velkost() {
    const r = this.cv.getBoundingClientRect();
    const dprMax = this.slabe ? 1.5 : 2;
    this.dpr = Math.min(dprMax, window.devicePixelRatio || 1);
    this.vw = Math.max(1, Math.round(r.width));
    this.vh = Math.max(1, Math.round(r.height));
    this.cv.width = Math.round(this.vw * this.dpr);
    this.cv.height = Math.round(this.vh * this.dpr);
    if (this.kc) {
      this.kS = Math.min(this.dpr, 1.5) * 0.5;
      this.kc.width = Math.max(1, Math.round(this.vw * this.kS));
      this.kc.height = Math.max(1, Math.round(this.vh * this.kS));
    }
    if (this.pripravena) {
      this._skoc(this._ramNa(this._domov()));
      this.plne = true;
      this.poslKuzel = 0;
      this.kick();
    }
  }

  // ---------------------------------------------------------- kamera

  _kMax() {
    return (this.S * 1.5) / this.dpr;
  }

  _kMin() {
    return Math.min(this.vw / (W + 40), (this.vh - this.okraje.hore - this.okraje.dole) / (H + 40));
  }

  _domov() {
    let x0 = TY.x - 110;
    let y0 = TY.y - 100;
    let x1 = TY.x + 110;
    let y1 = TY.y + 100;
    const pridaj = (x, y, r) => {
      if (x - r < x0) x0 = x - r;
      if (y - r < y0) y0 = y - r;
      if (x + r > x1) x1 = x + r;
      if (y + r > y1) y1 = y + r;
    };
    for (const id of this.uzly) {
      const u = uzol(id);
      pridaj(u.x, u.y, 60);
    }
    for (let i = 0; i < this.odhaleneOkna; i++) {
      const o = this.okna[this.poradie[i]];
      pridaj(o.cx, o.cy, 26);
    }
    const w = x1 - x0;
    const h = y1 - y0;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const rw = Math.max(360, w * 1.12);
    const rh = Math.max(300, h * 1.12);
    return { x: cx - rw / 2, y: cy - rh / 2, w: rw, h: rh };
  }

  _ramNa(r) {
    const vh = this.vh - this.okraje.hore - this.okraje.dole;
    let k = Math.min(this.vw / r.w, vh / r.h);
    k = Math.max(this._kMin(), Math.min(this._kMax(), k));
    let cx = r.x + r.w / 2;
    let cy = r.y + r.h / 2;
    const pw = this.vw / k / 2;
    const ph = vh / k / 2;
    cx = pw * 2 >= W ? W / 2 : Math.max(pw - 10, Math.min(W - pw + 10, cx));
    cy = ph * 2 >= H ? H / 2 : Math.max(ph - 10, Math.min(H - ph + 10, cy));
    // stred v obraze je posunutý o okraje (pásik Správcu cez vrch mapy)
    cy -= (this.okraje.hore - this.okraje.dole) / 2 / k;
    return { cx, cy, k };
  }

  _skoc(c) {
    this.cam.x.jump(c.cx);
    this.cam.y.jump(c.cy);
    this.cam.lk.jump(Math.log(c.k));
  }

  _kamera(t, c, sp = PRESETS.camera) {
    if (this.reduced || this.zmrazene) return this._skoc(c);
    this.cam.x.to(t, c.cx, sp);
    this.cam.y.to(t, c.cy, sp);
    this.cam.lk.to(t, Math.log(c.k), sp);
    this.kick();
  }

  naObrazovku(x, y) {
    const { cx, cy, k } = this.kam;
    return { x: (x - cx) * k + this.vw / 2, y: (y - cy) * k + this.vh / 2, k };
  }

  zObrazovky(sx, sy) {
    const { cx, cy, k } = this.kam;
    return { x: (sx - this.vw / 2) / k + cx, y: (sy - this.vh / 2) / k + cy };
  }

  /** Uzol pod bodom obrazovky (ťuk na kartičku). */
  uzolNa(sx, sy) {
    const p = this.zObrazovky(sx, sy);
    for (const id of this.uzly) {
      const u = uzol(id);
      if (Math.abs(p.x - u.x) < KARTA.w / 2 + 4 && Math.abs(p.y - u.y) < KARTA.h / 2 + 4) return u;
    }
    return null;
  }

  // ---------------------------------------------------------- udalosti z hry

  zobud() {
    this.aktivita = this.cas();
    this.kick();
  }

  /** Počet ľudí = počet rozsvietených okien. Nové sa rozsvietia postupne, ubudnuté zhasnú. */
  nastavLudi(n, o = {}) {
    n = Math.max(0, Math.min(this.okna.length, Math.floor(n)));
    if (this.pripravena && n === this.svietia) return;
    if (!this.pripravena) {
      this.cielLudi = n;
      return;
    }
    const t = this.cas();
    const hned = o.hned || this.reduced || this.zmrazene;
    if (n > this.svietia) {
      let bezi = this.anim.filter((a) => a.typ === 'okno').length;
      let j = 0;
      for (let i = this.svietia; i < n; i++) {
        const okno = this.okna[this.poradie[i]];
        if (!hned && bezi < 10) {
          this.anim.push({ typ: 'okno', okno, t0: t + j * 0.07, zap: true });
          bezi++;
          j++;
        } else this._okno(okno, 1);
        if (i >= this.odhaleneOkna) {
          if (!hned && j < 12) this.mlha.animuj(okno.cx, okno.cy, 30, t + j * 0.07);
          else this.mlha.diera(okno.cx, okno.cy, 30);
        }
      }
      if (n > this.odhaleneOkna) this.odhaleneOkna = n;
      if (hned) this.plne = true;
    } else if (n < this.svietia) {
      let j = 0;
      for (let i = this.svietia - 1; i >= n; i--) {
        const okno = this.okna[this.poradie[i]];
        this.anim = this.anim.filter((a) => a.okno !== okno);
        if (hned) this._okno(okno, 0);
        else this.anim.push({ typ: 'okno', okno, t0: t + 0.35 + j++ * 0.04, zap: false });
      }
      if (hned) this.plne = true;
    }
    this.svietia = n;
    this.kick();
  }

  /** Odhalí uzol: kamera, hmla, kartička perom, nitka, štítok. Viac uzlov ide za sebou. */
  odhalUzol(id, o = {}) {
    if (this.uzly.has(id) || this.fronta.some((f) => f.id === id)) return;
    if (!this.pripravena || o.hned || this.reduced || this.zmrazene) {
      this.fronta.push({ id, hned: true, tichy: !!o.tichy });
      if (this.pripravena) this._fronta();
      return;
    }
    this.fronta.push({ id, kamera: o.kamera !== false });
    this._fronta();
  }

  _fronta() {
    if (!this.pripravena) return;
    const t = this.cas();
    while (this.fronta.length && (this.fronta[0].hned || t >= this.volnyOd)) {
      const f = this.fronta.shift();
      if (f.hned) this._uzolHned(f.id, f.tichy);
      else {
        this._uzolAnim(f.id, t, f.kamera);
        this.volnyOd = t + 1.7;
        break;
      }
    }
    if (this.fronta.length) this._naCas(this.volnyOd, () => this._fronta());
    this.kick();
  }

  _uzolHned(id, tichy) {
    const u = uzol(id);
    this.uzly.add(id);
    this.mlha.diera(u.x, u.y, 85);
    this._kartaHned(u);
    this.piny.set(id, -99);
    if (u.rodic) this.nitky.push({ od: this.uzly.has(u.rodic) ? u.rodic : 'ty', do: id, t0: -99 });
    this._skoc(this._ramNa(this._domov()));
    this.plne = true;
    if (!this.zmrazene && !tichy) this.naUzol(u, citanie(u.stitok));
  }

  _uzolAnim(id, t, kamera) {
    const u = uzol(id);
    this.uzly.add(id);
    if (kamera) {
      const dom = this._ramNa(this._domov());
      const f = this._ramNa({ x: u.x - 150, y: u.y - 115, w: 300, h: 230 });
      f.k = Math.min(f.k, dom.k * 1.4);
      this._kamera(t, f.k < dom.k ? dom : f);
    }
    this.mlha.animuj(u.x, u.y, 85, t + 0.1);
    this._kartaAnim(u, t + 0.25);
    this.piny.set(id, t + 0.97);
    if (u.rodic) this.nitky.push({ od: this.uzly.has(u.rodic) ? u.rodic : 'ty', do: id, t0: t + 0.97 });
    this._naCas(t + 1.0, () => this.naUzol(u, citanie(u.stitok)));
    if (kamera) {
      this.navrat = t + 2.4 + citanie(u.stitok);
      this._naCas(this.navrat, () => {
        if (this.cas() >= this.navrat - 0.01) this._kamera(this.cas(), this._ramNa(this._domov()));
      });
    }
  }

  /** Míľnik: oddialenie na celý odkrytý obraz. */
  milnik() {
    const t = Math.max(this.cas(), this.volnyOd - 0.3);
    this.navrat = t;
    this._naCas(t, () => this._kamera(this.cas(), this._ramNa(this._domov()), PRESETS.cameraFar));
  }

  vlna() {
    if (this.reduced || this.zmrazene || !this.pripravena) return;
    const t = this.cas();
    if (this.vlny.length >= 3) this.vlny.shift();
    this.vlny.push(t);
    this.kick();
  }

  /** Čakajúce vodítko: teplé svetlo v hmle na mieste postavy. null zruší. */
  vodítko(id) {
    const u = id ? uzol(id) : null;
    if (u === this.vodit) return;
    const stare = this.vodit;
    this.vodit = u;
    if (stare) this.naSkladanie = { x: stare.x - 16, y: stare.y - 16, w: 32, h: 32 };
    this.plne = !stare;
    this.kick();
  }

  nastavPozornost(v, potichu) {
    this.pozornost = v;
    this.potichu = !!potichu;
  }

  klop() {
    this.klopT = this.cas();
    this.zobud();
  }

  zmraz(tKuzele = 3.2) {
    this.zmrazene = true;
    this.tZmraz = tKuzele;
  }

  skryta(ano) {
    this.skryte = ano;
    if (ano && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    if (!ano) {
      this.plne = true;
      this.kick();
    }
  }

  // ---------------------------------------------------------- základ: okná a kartičky

  _pixRect(x, y, w, h) {
    const S = this.S;
    const bx = Math.max(0, Math.floor((x * S) / 2) * 2);
    const by = Math.max(0, Math.floor((y * S) / 2) * 2);
    const bw = Math.min(this.base.width - bx, Math.ceil(((x + w) * S - bx) / 2) * 2 + 2);
    const bh = Math.min(this.base.height - by, Math.ceil(((y + h) * S - by) / 2) * 2 + 2);
    return { bx, by, bw, bh };
  }

  _b2(x, y, w, h) {
    const { bx, by, bw, bh } = this._pixRect(x, y, w, h);
    if (bw <= 0 || bh <= 0) return;
    this.b2ctx.drawImage(this.base, bx, by, bw, bh, bx / 2, by / 2, bw / 2, bh / 2);
  }

  _okno(o, s, alfa = 1) {
    const c = this.bctx;
    c.setTransform(this.S, 0, 0, this.S, 0, 0);
    kresliOkno(c, o, s, alfa);
    c.setTransform(1, 0, 0, 1, 0, 0);
    this._b2(o.x - 1, o.y - 1, OKNO.w + 2, OKNO.h + 2);
  }

  _kartaHned(u) {
    const c = this.bctx;
    c.setTransform(this.S, 0, 0, this.S, 0, 0);
    kresliKartu(c, u, 1, 1);
    c.setTransform(1, 0, 0, 1, 0, 0);
    const b = obalKarty(u, 3);
    this._b2(b.x, b.y, b.w, b.h);
  }

  _kartaAnim(u, t0) {
    const b = obalKarty(u, 3);
    const r = this._pixRect(b.x, b.y, b.w, b.h);
    const zal = platno(r.bw, r.bh);
    zal.getContext('2d').drawImage(this.base, r.bx, r.by, r.bw, r.bh, 0, 0, r.bw, r.bh);
    this.anim.push({ typ: 'karta', u, t0, zal, r, b });
  }

  _naCas(t, fn) {
    this.plan.push({ t, fn });
    this.plan.sort((a, b) => a.t - b.t);
    this.kick();
  }

  // ---------------------------------------------------------- slučka

  kick() {
    if (this.raf || this.skryte || typeof requestAnimationFrame !== 'function') return;
    this.raf = requestAnimationFrame(this._tick);
  }

  _tick() {
    this.raf = 0;
    if (!this.pripravena || this.skryte) return;
    const t0 = performance.now();
    const t = this.zmrazene ? 0 : t0 / 1000;
    while (this.plan.length && this.plan[0].t <= t) this.plan.shift().fn();
    if (this.cielLudi !== undefined) {
      const n = this.cielLudi;
      this.cielLudi = undefined;
      this.nastavLudi(n, { hned: true });
    }
    const spinave = [];
    // kamera
    let hybe = false;
    if (!this.zmrazene) {
      const cx = this.cam.x.at(t);
      const cy = this.cam.y.at(t);
      const k = Math.exp(this.cam.lk.at(t));
      hybe = Math.abs(cx - this.kam.cx) * k > 0.02 || Math.abs(cy - this.kam.cy) * k > 0.02 || Math.abs(k / this.kam.k - 1) > 0.0002;
      this.kam = { cx, cy, k };
      for (const tr of [this.cam.x, this.cam.y, this.cam.lk]) tr.compact(t);
    } else {
      this.kam = { cx: this.cam.x.target(), cy: this.cam.y.target(), k: Math.exp(this.cam.lk.target()) };
    }
    // animácie základu
    const S = this.S;
    for (let i = this.anim.length - 1; i >= 0; i--) {
      const a = this.anim[i];
      const tt = t - a.t0;
      if (tt < 0) continue;
      if (a.typ === 'okno') {
        if (a.zap) {
          const p = Math.min(1, tt / 0.4);
          this._okno(a.okno, 0.6 + 0.4 * KRIVKY.nastup(p));
          spinave.push(a.okno.x - 8, a.okno.y - 8, OKNO.w + 16, OKNO.h + 16);
          if (tt >= 0.62) {
            this._okno(a.okno, 1);
            this.anim.splice(i, 1);
          }
        } else {
          const p = Math.min(1, tt / 0.3);
          this._okno(a.okno, 0);
          if (p < 1) this._okno(a.okno, 1, 1 - p);
          spinave.push(a.okno.x - 1, a.okno.y - 1, OKNO.w + 2, OKNO.h + 2);
          if (p >= 1) this.anim.splice(i, 1);
        }
      } else if (a.typ === 'karta') {
        const m = 0.92 + 0.08 * KRIVKY.nastup(Math.min(1, tt / 0.12));
        const p = KRIVKY.sinus(Math.min(1, Math.max(0, (tt - 0.12) / 0.6)));
        const c = this.bctx;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.drawImage(a.zal, a.r.bx, a.r.by);
        c.setTransform(S, 0, 0, S, 0, 0);
        kresliKartu(c, a.u, m, p);
        c.setTransform(1, 0, 0, 1, 0, 0);
        this._b2(a.b.x, a.b.y, a.b.w, a.b.h);
        spinave.push(a.b.x, a.b.y, a.b.w, a.b.h);
        if (tt >= 0.74) this.anim.splice(i, 1);
      }
    }
    // hmla
    const mlha = this.mlha.platno(t, spinave);
    // nitky, špendlíky, vlny, vodítko
    for (const n of this.nitky) {
      const tt = t - n.t0;
      if (tt >= 0 && tt < 1.6) {
        const a = bodSpendlika(uzol(n.od));
        const b = bodSpendlika(uzol(n.do));
        spinave.push(Math.min(a.x, b.x) - 6, Math.min(a.y, b.y) - 6, Math.abs(a.x - b.x) + 12, Math.abs(a.y - b.y) + 60);
      }
    }
    for (const [id, t1] of this.piny) {
      if (t - t1 >= 0 && t - t1 < 0.2) {
        const p = bodSpendlika(uzol(id));
        spinave.push(p.x - 6, p.y - 6, 12, 12);
      }
    }
    this.vlny = this.vlny.filter((v) => t - v < 0.7);
    if (this.vlny.length) spinave.push(TY.x - 56, TY.y - 66, 112, 112);
    const pulz = !!this.vodit && !this.reduced && !this.zmrazene && t - this.aktivita < 40;
    // pulz vodítka beží len keď je hráč pri hre; po zastavení sa raz dokreslí plné svetlo
    if (this.vodit && (pulz || this.pulzBol)) spinave.push(this.vodit.x - 16, this.vodit.y - 16, 32, 32);
    this.pulzBol = pulz;
    if (this.naSkladanie) {
      const r = this.naSkladanie;
      spinave.push(r.x, r.y, r.w, r.h);
      this.naSkladanie = null;
    }
    // skladanie
    if (this.plne || hybe) {
      this._sloz(null, t, mlha);
      this.plne = false;
      this.poKamere(this.kam);
    } else if (spinave.length) {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (let i = 0; i < spinave.length; i += 4) {
        x0 = Math.min(x0, spinave[i]);
        y0 = Math.min(y0, spinave[i + 1]);
        x1 = Math.max(x1, spinave[i] + spinave[i + 2]);
        y1 = Math.max(y1, spinave[i + 1] + spinave[i + 3]);
      }
      this._sloz({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, t, mlha);
    }
    // kužele
    const bdie = !this.reduced && t - this.aktivita < 40;
    const fps = this.slabe ? 15 : 30;
    if (this.kc && (this.zmrazene || hybe || this.poslKuzel === 0 || (bdie && t - this.poslKuzel >= 1 / fps) || t - this.klopT < 1.4)) {
      this._kuzele(this.zmrazene ? this.tZmraz : t);
      this.poslKuzel = t || 0.001;
    }
    // meranie snímky (slabé zariadenie)
    const trvanie = performance.now() - t0;
    this.snimky.push(trvanie);
    if (this.snimky.length >= 60) {
      const avg = this.snimky.reduce((a, b) => a + b, 0) / this.snimky.length;
      this.snimky.length = 0;
      if (avg > 9 && !this.slabe) this.slabe = true;
    }
    const aktivne = this.anim.length || this.mlha.bezi() || this.plan.length || this.vlny.length || !this._kamPokoj(t) || spinave.length || pulz || bdie || t - this.klopT < 1.4;
    if (aktivne && !this.zmrazene) this.kick();
  }

  _kamPokoj(t) {
    return this.cam.x.settled(t) && this.cam.y.settled(t) && this.cam.lk.settled(t);
  }

  _sloz(r, t, mlha) {
    const c = this.ctx;
    const d = this.dpr;
    const { cx, cy, k } = this.kam;
    c.save();
    c.setTransform(d, 0, 0, d, 0, 0);
    if (r) {
      const sx0 = Math.max(0, Math.floor((r.x - cx) * k + this.vw / 2) - 2);
      const sy0 = Math.max(0, Math.floor((r.y - cy) * k + this.vh / 2) - 2);
      const sx1 = Math.min(this.vw, Math.ceil((r.x + r.w - cx) * k + this.vw / 2) + 2);
      const sy1 = Math.min(this.vh, Math.ceil((r.y + r.h - cy) * k + this.vh / 2) + 2);
      if (sx1 <= sx0 || sy1 <= sy0) {
        c.restore();
        return;
      }
      c.beginPath();
      c.rect(sx0, sy0, sx1 - sx0, sy1 - sy0);
      c.clip();
      c.fillStyle = P.noc;
      c.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
    } else {
      c.fillStyle = P.noc;
      c.fillRect(0, 0, this.vw, this.vh);
    }
    c.setTransform(k * d, 0, 0, k * d, (this.vw / 2 - cx * k) * d, (this.vh / 2 - cy * k) * d);
    c.imageSmoothingEnabled = true;
    const zdroj = k * d < 1.0 ? this.base2 : this.base;
    c.drawImage(zdroj, 0, 0, W, H);
    c.drawImage(mlha, 0, 0, W, H);
    // nitky
    c.lineCap = 'round';
    c.strokeStyle = P.peciatka;
    c.lineWidth = Math.max(1.2, 1.1 / k);
    for (const n of this.nitky) {
      const tt = t - n.t0;
      if (tt < 0) continue;
      const a = bodSpendlika(uzol(n.od));
      const b = bodSpendlika(uzol(n.do));
      const dl = Math.hypot(b.x - a.x, b.y - a.y);
      const pokoj = 4 + dl * 0.05;
      const rast = this.reduced || n.t0 < 0 ? 1 : Math.min(1, tt / 0.25);
      const prehyb = pokoj + (rast < 1 ? 36 : 36 * springDisp(PRESETS.thread, tt - 0.25, 1, 0));
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2 + prehyb;
      c.beginPath();
      c.moveTo(a.x, a.y);
      if (rast >= 1) c.quadraticCurveTo(mx, my, b.x, b.y);
      else {
        // rastie po krivke od rodiča
        const u = rast;
        const qx = a.x + (mx - a.x) * u;
        const qy = a.y + (my - a.y) * u;
        const rx = (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * mx + u * u * b.x;
        const ry = (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * my + u * u * b.y;
        c.quadraticCurveTo(qx, qy, rx, ry);
      }
      c.stroke();
    }
    // špendlíky
    for (const [id, t1] of this.piny) {
      const tt = t - t1;
      if (tt < 0) continue;
      const p = bodSpendlika(uzol(id));
      const m = t1 < 0 || this.reduced ? 1 : KRIVKY.nastup(Math.min(1, tt / 0.09));
      const rr = Math.max(2.3, 2.4 / k) * m;
      c.fillStyle = P.peciatka;
      c.beginPath();
      c.arc(p.x, p.y, rr, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,240,220,0.7)';
      c.beginPath();
      c.arc(p.x - rr * 0.3, p.y - rr * 0.3, rr * 0.32, 0, Math.PI * 2);
      c.fill();
    }
    // žiara nových okien
    for (const a of this.anim) {
      if (a.typ !== 'okno' || !a.zap) continue;
      const tt = t - a.t0;
      if (tt < 0) continue;
      const al = 0.35 * (1 - Math.min(1, tt / 0.6));
      if (al <= 0) continue;
      const o = a.okno;
      c.fillStyle = `rgba(242,165,65,${al.toFixed(3)})`;
      c.fillRect(o.x - 3, o.y - 3, OKNO.w + 6, OKNO.h + 6);
      c.fillStyle = `rgba(242,165,65,${(al * 0.5).toFixed(3)})`;
      c.fillRect(o.x - 6.5, o.y - 6.5, OKNO.w + 13, OKNO.h + 13);
    }
    // vlny šepotu z tvojho okna
    c.strokeStyle = P.lampas;
    for (const v of this.vlny) {
      for (let j = 0; j < 2; j++) {
        const p = (t - v - j * 0.12) / 0.5;
        if (p <= 0 || p >= 1) continue;
        c.globalAlpha = 0.7 * (1 - p);
        c.lineWidth = Math.max(1.3, 1.2 / k);
        c.beginPath();
        c.arc(TY.x, TY.y - 6, 12 + 40 * KRIVKY.prichod(p), -Math.PI * 0.95, -Math.PI * 0.05);
        c.stroke();
      }
    }
    c.globalAlpha = 1;
    // vodítko: teplé svetlo v hmle
    if (this.vodit) {
      const u = this.vodit;
      const bdie = !this.reduced && !this.zmrazene && t - this.aktivita < 40;
      const f = bdie ? 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 1.1) : 1;
      c.fillStyle = `rgba(242,165,65,${(0.18 + 0.2 * f).toFixed(3)})`;
      c.fillRect(u.x - 9, u.y - 11, 18, 22);
      c.fillStyle = `rgba(242,165,65,${(0.45 + 0.55 * f).toFixed(3)})`;
      c.fillRect(u.x - OKNO.w, u.y - OKNO.h, OKNO.w * 2, OKNO.h * 2);
      c.strokeStyle = `rgba(242,165,65,${(0.35 + 0.4 * f).toFixed(3)})`;
      c.lineWidth = Math.max(1.2, 1.2 / k);
      c.beginPath();
      c.arc(u.x, u.y, 13 + 2 * f, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
  }

  _kuzele(t) {
    const c = this.kctx;
    const s = this.kS;
    const { cx, cy, k } = this.kam;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.kc.width, this.kc.height);
    c.setTransform(k * s, 0, 0, k * s, (this.vw / 2 - cx * k) * s, (this.vh / 2 - cy * k) * s);
    const z = 1 + Math.min(100, this.pozornost) / 100;
    const rychlost = this.potichu ? 0.6 : this.pozornost > 50 ? 1.5 : 1;
    if (!this.reduced) {
      c.save();
      c.beginPath();
      c.rect(-200, -200, W + 400, H + 400);
      c.arc(TY.x, TY.y, 42, 0, Math.PI * 2);
      c.clip('evenodd');
      for (const st of STLPY) {
        const a = st.uhol + st.rozkmit * Math.sin((t * rychlost * Math.PI * 2) / st.perioda + st.faza);
        const pol = 0.24;
        c.beginPath();
        c.moveTo(st.x, st.y - 14);
        c.arc(st.x, st.y - 14, st.dlzka, a - pol, a + pol);
        c.closePath();
        c.fillStyle = `rgba(156,201,232,${(0.12 * z).toFixed(3)})`;
        c.fill();
        c.beginPath();
        c.moveTo(st.x, st.y - 14);
        c.lineTo(st.x + Math.cos(a + pol) * st.dlzka, st.y - 14 + Math.sin(a + pol) * st.dlzka);
        c.strokeStyle = `rgba(156,201,232,${(0.34 * z).toFixed(3)})`;
        c.lineWidth = 1.4 / (k * s);
        c.stroke();
      }
      // zaklopanie: jasný kužeľ prejde štvrťou
      const tk = t - this.klopT;
      if (tk >= 0 && tk < 1.3) {
        const st = STLPY[1];
        const a = Math.PI * 0.72 + (tk / 1.3) * Math.PI * 0.62;
        c.beginPath();
        c.moveTo(st.x, st.y - 14);
        c.arc(st.x, st.y - 14, 460, a - 0.2, a + 0.2);
        c.closePath();
        c.fillStyle = `rgba(232,241,248,${(0.28 * Math.sin((tk / 1.3) * Math.PI)).toFixed(3)})`;
        c.fill();
      }
      c.restore();
    }
    // šošovky kamier: chladné body, vidno ich aj v hmle
    c.fillStyle = P.spravca;
    for (const st of STLPY) {
      c.beginPath();
      c.arc(st.x, st.y - 14, Math.max(2, 2.2 / (k * s) / 2), 0, Math.PI * 2);
      c.fill();
    }
  }
}
