// kodfilm/kresba.js: kresliace pomôcky. Papier, zrno, roztrhnutie papiera, typografia.
// Pravidlo výkonu: všetko, čo sa nehýbe, sa kreslí raz do offscreen plátna (vrstva) a potom sa len skladá.

import { nahoda, obmedz, ease } from './cas.js';

/** Nové plátno mimo obrazovky v pixeloch zariadenia. */
export function platno(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Cesta zaobleného obdĺžnika. */
export function zaoblene(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Papier: základná farba, veľké mapy (škvrny ako pri risografii), vlákna a jemný šum.
 * Kreslí sa raz, vracia plátno w x h (pixely zariadenia).
 */
export function papier(w, h, { farba = '#f3eee2', semienko = 7, vlakna = 1 } = {}) {
  const c = platno(w, h), x = c.getContext('2d');
  const r = nahoda(semienko);
  x.fillStyle = farba;
  x.fillRect(0, 0, w, h);
  const s = Math.sqrt(w * h) / 1000;
  // mapy: jemné svetlejšie a tmavšie oblasti
  for (let i = 0; i < 14; i++) {
    const cx = r() * w, cy = r() * h, rr = (120 + r() * 380) * s;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
    const tmava = r() < 0.5;
    g.addColorStop(0, tmava ? 'rgba(120,95,60,0.05)' : 'rgba(255,255,250,0.10)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  }
  // vlákna
  const n = Math.round(900 * vlakna * (w * h) / 1e6);
  x.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const px = r() * w, py = r() * h, d = (4 + r() * 18) * s * 1.4, u = r() * Math.PI * 2;
    x.strokeStyle = r() < 0.5 ? 'rgba(110,90,60,0.10)' : 'rgba(255,255,255,0.22)';
    x.lineWidth = Math.max(0.6, s * (0.4 + r() * 0.8));
    x.beginPath();
    x.moveTo(px, py);
    x.quadraticCurveTo(px + Math.cos(u + 0.6) * d * 0.5, py + Math.sin(u + 0.6) * d * 0.5, px + Math.cos(u) * d, py + Math.sin(u) * d);
    x.stroke();
  }
  // jemný šum po pixeloch
  const img = x.getImageData(0, 0, w, h), dt = img.data;
  for (let i = 0; i < dt.length; i += 4) {
    const z = (r() - 0.5) * 14;
    dt[i] += z; dt[i + 1] += z; dt[i + 2] += z * 0.9;
  }
  x.putImageData(img, 0, 0);
  return c;
}

/** Dlaždice filmového zrna (priehľadné, na skladanie cez vzor). */
export function zrno(pocet = 3, velkost = 192, sila = 1, semienko = 11) {
  const out = [];
  for (let k = 0; k < pocet; k++) {
    const c = platno(velkost, velkost), x = c.getContext('2d');
    const r = nahoda(semienko + k * 101);
    const img = x.createImageData(velkost, velkost), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = r() < 0.5 ? 0 : 255;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = Math.round(r() * 255 * 0.5 * sila);
    }
    x.putImageData(img, 0, 0);
    out.push(c);
  }
  return out;
}

/**
 * Tlač ako risograf: dve farby cez seba (multiply), mierne posunuté, s bodkovaným rastrom.
 * Volá sa pri stavbe vrstvy, nie každú snímku.
 */
export function risoText(ctx, text, x, y, { farby = ['#2c5fd6', '#e0452b'], posun = 3 } = {}) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = farby[0];
  ctx.fillText(text, x - posun, y - posun * 0.4);
  ctx.fillStyle = farby[1];
  ctx.fillText(text, x + posun, y + posun * 0.4);
  ctx.restore();
}

/** Písmo pre canvas. */
export const pismo = (vaha, px, rodina = '"ARLing Sans", system-ui, sans-serif') => `${vaha} ${Math.round(px * 10) / 10}px ${rodina}`;

/** Text s rozostupom písmen (ctx.letterSpacing, kde ho prehliadač má, inak po znakoch). */
export function textRozostup(ctx, text, x, y, rozostup) {
  if ('letterSpacing' in ctx) {
    const pred = ctx.letterSpacing;
    ctx.letterSpacing = `${rozostup}px`;
    ctx.fillText(text, x, y);
    ctx.letterSpacing = pred;
    return;
  }
  const zarovnanie = ctx.textAlign;
  let sirka = 0;
  for (const ch of text) sirka += ctx.measureText(ch).width + rozostup;
  sirka -= rozostup;
  let cx = zarovnanie === 'center' ? x - sirka / 2 : zarovnanie === 'right' ? x - sirka : x;
  ctx.textAlign = 'left';
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + rozostup; }
  ctx.textAlign = zarovnanie;
}

/** Zalomenie textu do riadkov s najväčšou šírkou maxW. */
export function zalom(ctx, text, maxW) {
  const slova = text.split(' '), riadky = [];
  let r = '';
  for (const s of slova) {
    const skusit = r ? r + ' ' + s : s;
    if (ctx.measureText(skusit).width > maxW && r) { riadky.push(r); r = s; } else r = skusit;
  }
  if (r) riadky.push(r);
  return riadky;
}

/** Najväčšia veľkosť písma (px), pri ktorej sa text zmestí do šírky. */
export function vhodnaVelkost(ctx, text, vaha, maxPx, maxW, rodina) {
  ctx.font = pismo(vaha, maxPx, rodina);
  const w = ctx.measureText(text).width;
  return w <= maxW ? maxPx : Math.max(8, maxPx * maxW / w);
}

// ---------- Roztrhnutie papiera (prechod na otvorenie filmu) ----------

const trhlinyCache = new Map();

/** Trhlina: zubatá čiara zhora nadol, body [x, y] plus vlákna na okraji. Počíta sa raz pre rozmer. */
function trhlina(W, H, semienko) {
  const kluc = `${W}x${H}:${semienko}`;
  if (trhlinyCache.has(kluc)) return trhlinyCache.get(kluc);
  const r = nahoda(semienko);
  const kroky = 64, body = [];
  let x = W * (0.47 + r() * 0.06), dx = 0;
  const s = Math.min(W, H);
  for (let i = 0; i <= kroky; i++) {
    const y = (i / kroky) * H;
    dx = dx * 0.55 + (r() - 0.5) * s * 0.05;
    x += dx * 0.5 + (W * 0.5 - x) * 0.04;
    const zub = (r() - 0.5) * s * 0.012;
    body.push([x + zub, y]);
  }
  body[0][1] = -2; body[kroky][1] = H + 2;
  // vlákna na roztrhnutom okraji (krátke chĺpky kolmo na trhlinu)
  const vlakna = [];
  for (let i = 0; i < 260; i++) {
    const f = r(), j = Math.min(kroky - 1, Math.floor(f * kroky));
    const a = body[j], b = body[j + 1], u = f * kroky - j;
    vlakna.push({ x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, d: s * (0.004 + r() * 0.012), uhol: (r() - 0.5) * 1.2, strana: r() < 0.5 ? -1 : 1 });
  }
  const t = { body, vlakna };
  trhlinyCache.set(kluc, t);
  return t;
}

/**
 * Roztrhnutie papiera cez celú plochu. Pod ním už musí byť nakreslená scéna.
 * obal = plátno s papierom (rozmer W x H v logických bodoch, kreslí sa škálované).
 * p 0..1: 0 celý papier, 0 až 0.38 trhlina beží zhora nadol a mierne sa otvára,
 * 0.38 až 1 polovice odletia do strán s pootočením.
 */
export function roztrhnutie(ctx, obal, p, W, H, { semienko = 5, okraj = '#fffdf7', tien = 'rgba(0,0,0,0.35)' } = {}) {
  if (p >= 1) return;
  if (p <= 0) { ctx.drawImage(obal, 0, 0, W, H); return; }
  const { body, vlakna } = trhlina(W, H, semienko);
  const s = Math.min(W, H);
  const pTrh = obmedz(p / 0.38), pLet = obmedz((p - 0.38) / 0.62);
  const medzera = s * 0.018 * ease.outQuad(pTrh);
  // posun bodu i: trhlina sa otvára tam, kam už dobehla
  const posun = (y) => {
    const f = pTrh * 1.15 - y / H;
    return f <= 0 ? 0 : medzera * obmedz(f * 5);
  };
  const e = ease.inCubic(pLet);
  const polovice = [
    { strana: -1, pivotX: 0, uhol: -0.16 * e, tx: -W * 0.75 * e },
    { strana: 1, pivotX: W, uhol: 0.19 * e, tx: W * 0.75 * e },
  ];
  for (const pol of polovice) {
    ctx.save();
    ctx.translate(pol.pivotX + pol.tx, H * 1.1);
    ctx.rotate(pol.uhol);
    ctx.translate(-pol.pivotX, -H * 1.1);
    const cesta = new Path2D();
    const okrajX = pol.strana < 0 ? -W : 2 * W;
    cesta.moveTo(okrajX, -H);
    for (const [x, y] of body) cesta.lineTo(x + pol.strana * posun(y), y);
    cesta.lineTo(okrajX, 2 * H);
    cesta.closePath();
    // lacný tieň bez rozmazania: tá istá plocha posunutá, pod polovicou
    if (pLet > 0) {
      ctx.save();
      ctx.translate(pol.strana * s * 0.012 * (0.4 + e), s * 0.01);
      ctx.fillStyle = tien;
      ctx.globalAlpha = 0.5 + 0.5 * (1 - e);
      ctx.fill(cesta);
      ctx.restore();
    }
    ctx.save();
    ctx.clip(cesta);
    ctx.drawImage(obal, 0, 0, W, H);
    ctx.restore();
    // svetlý roztrhnutý okraj a vlákna (len tam, kde už je trhlina)
    const hranica = pTrh * 1.15 * H;
    ctx.strokeStyle = okraj;
    ctx.lineWidth = s * 0.006;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let zac = false;
    for (const [x, y] of body) {
      if (y > hranica) break;
      const px = x + pol.strana * posun(y) - pol.strana * s * 0.002;
      if (!zac) { ctx.moveTo(px, y); zac = true; } else ctx.lineTo(px, y);
    }
    ctx.stroke();
    ctx.lineWidth = Math.max(0.7, s * 0.0014);
    ctx.beginPath();
    for (const v of vlakna) {
      if (v.y > hranica || v.strana !== pol.strana) continue;
      const bx = v.x + pol.strana * posun(v.y);
      ctx.moveTo(bx, v.y);
      ctx.lineTo(bx - pol.strana * Math.cos(v.uhol) * v.d, v.y + Math.sin(v.uhol) * v.d);
    }
    ctx.stroke();
    ctx.restore();
  }
}
