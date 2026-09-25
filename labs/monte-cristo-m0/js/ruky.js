/* Ruky: vyrez v kruhu pre ukony rukami (P8). Kresli sa na platno sceny az po svete,
 * z vytlacenych detailov (kulisy/detaily.js), takze aj detail ma raster a zrno.
 * d = { druh: 'harok' | 'zalozka' | 'plamen', p: 0 az 1, t: cas }. */
import { SVET } from './kulisy/vazenie.js';

const CX = 320, CY = 166, RR = 124;

/* tvar spaleneho okraja: z odsadenia druheho listu v knihe (r. 8679 az 8705), NAVRH vykladu */
let OKRAJ = null;
export function nastavOkraj(riadky) {
  OKRAJ = riadky.map((r) => Math.min(1, (49 - r.odsadenie - 3) / 49));
}

export function kresliDetail(ctx, s, B, d) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  /* stmavenie okolia, aby oko islo do kruhu */
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(120,118,150,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.beginPath(); ctx.arc(CX, CY, RR + 5, 0, Math.PI * 2);
  ctx.fillStyle = '#2f3561'; ctx.fill();
  ctx.beginPath(); ctx.arc(CX, CY, RR, 0, Math.PI * 2);
  ctx.fillStyle = d.druh === 'plamen' || d.druh === 'zalozka' ? '#e9c9a8' : '#e8e0cc';
  ctx.fill();
  ctx.clip();
  const img = (meno, x, y, sx = 1, sy = 1) => {
    const b = B.get(meno);
    if (!b) return;
    ctx.save();
    ctx.translate(x, y); ctx.scale(sx, sy);
    ctx.drawImage(b, 0, 0, b.width / s, b.height / s);
    ctx.restore();
  };
  if (d.druh === 'harok') {
    /* rozvinut valcek a drzat ho otvoreny; pusteny sa zvinie spat (r. 8259 az 8261) */
    const p = Math.max(0, Math.min(1, d.p));
    const x0 = CX - 140, sirka = 18 + p * 250;
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, CY - 100, sirka, 200); ctx.clip();
    img('det:harok', x0, CY - 90);
    ctx.restore();
    img('det:rolka', x0 + sirka - 14, CY - 92, 1, 1);
    /* lava ruka Fariova ho drzi za lavy okraj (NAVRH gesta) */
    ctx.fillStyle = '#c99a6b';
    ctx.beginPath(); ctx.ellipse(x0 - 2, CY + 6, 16, 26, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(47,53,97,.6)'; ctx.lineWidth = 0.8; ctx.stroke();
  } else if (d.druh === 'zalozka') {
    /* vytiahnut zazltnuty papier z breviara a skrutit ho (r. 8621 az 8625) */
    const p = Math.max(0, Math.min(1, d.p));
    const vytah = Math.min(1, p / 0.7), skrut = Math.max(0, (p - 0.7) / 0.3);
    ctx.save();
    ctx.translate(CX, CY + 10 - vytah * 96);
    ctx.scale(1 - skrut * 0.72, 1 - skrut * 0.1);
    ctx.rotate(skrut * 0.25);
    img('det:zalozka', -45, -40);
    ctx.restore();
    img('det:breviar', CX - 120, CY - 30);
  } else if (d.druh === 'pecat' || d.druh === 'list69') {
    /* kap. 69: zapecateny papier sa rozlomi a rozlozi; odporucaci list sa rozvinie. Text kniha nedava. */
    const p = Math.max(0, Math.min(1, d.p));
    if (d.druh === 'pecat') {
      ctx.save();
      ctx.translate(CX, CY);
      ctx.scale(1, 0.4 + 0.6 * p);
      img('det:pecat', -90, -60);
      ctx.restore();
      if (p > 0.35) {
        ctx.strokeStyle = 'rgba(120,30,40,.8)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(CX - 4, CY - 6); ctx.lineTo(CX + 1, CY); ctx.lineTo(CX - 2, CY + 7); ctx.stroke();
      }
    } else {
      ctx.save();
      ctx.translate(CX, CY);
      ctx.scale(0.25 + 0.75 * p, 1);
      img('det:list69', -80, -95);
      ctx.restore();
    }
  } else if (d.druh === 'plamen') {
    /* papier nad plamenom: zltkaste pismena sa objavuju, okraj horí (r. 8627 az 8634) */
    const p = Math.max(0, Math.min(1, d.p));
    const px = CX - 45, py = CY - 84, w = 90, h = 130;
    const rows = OKRAJ || [0.5];
    /* okraj ohna: hladka krivka cez body z odsadenia, s drobnym chvenim */
    const bod = (i) => {
      const f = rows[Math.max(0, Math.min(rows.length - 1, i))];
      const chvenie = Math.sin(i * 2.3) * 2.2 + Math.sin(i * 5.1) * 1.2;
      return px + w - (f * 0.58 * w + chvenie) * p;
    };
    const krivka = (path, spoj) => {
      if (spoj) path.lineTo(bod(0), py); else path.moveTo(bod(0), py);
      for (let i = 0; i < rows.length; i++) {
        const y0 = py + (h * i) / rows.length, y1 = py + (h * (i + 1)) / rows.length;
        path.quadraticCurveTo(bod(i), (y0 + y1) / 2, (bod(i) + bod(i + 1)) / 2, y1);
      }
    };
    const tvar = new Path2D();
    tvar.moveTo(px, py);
    krivka(tvar, true);
    tvar.lineTo(px, py + h);
    tvar.closePath();
    ctx.save();
    ctx.clip(tvar);
    img('det:zalozka', px, py);
    ctx.globalAlpha = Math.min(1, p * 1.5);
    img('det:pismena', px, py);
    ctx.globalAlpha = 1;
    /* zuhoľnatený lem pri okraji */
    const hrana = new Path2D();
    krivka(hrana);
    ctx.strokeStyle = 'rgba(70,40,30,.55)'; ctx.lineWidth = 9; ctx.stroke(hrana);
    ctx.strokeStyle = 'rgba(120,70,40,.4)'; ctx.lineWidth = 16; ctx.stroke(hrana);
    ctx.restore();
    const hr2 = new Path2D(); krivka(hr2);
    ctx.strokeStyle = 'rgba(35,25,30,.9)'; ctx.lineWidth = 1.6; ctx.stroke(hr2);
    /* dohasinajuce uhliky */
    const ug = ctx.createRadialGradient(CX, CY + RR - 6, 4, CX, CY + RR - 6, 90);
    ug.addColorStop(0, 'rgba(255,181,17,.95)'); ug.addColorStop(0.35, 'rgba(241,80,96,.8)'); ug.addColorStop(1, 'rgba(90,30,40,0)');
    ctx.fillStyle = ug;
    ctx.beginPath(); ctx.ellipse(CX, CY + RR - 4, 96, 46, 0, 0, Math.PI * 2); ctx.fill();
    /* plamen */
    if (!d.zhasnute) {
      const fx = px + w - 12 - p * 18, fy = py + h + 20;
      const kmit = Math.sin(d.t * 11) * 2 + Math.sin(d.t * 23) * 1.2;
      const g = ctx.createRadialGradient(fx, fy - 6, 1, fx, fy - 8, 24);
      g.addColorStop(0, 'rgba(255,244,190,.98)'); g.addColorStop(0.45, 'rgba(255,181,17,.8)'); g.addColorStop(1, 'rgba(241,80,96,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(fx - 10, fy + 8);
      ctx.quadraticCurveTo(fx - 13 + kmit, fy - 14, fx + kmit * 0.6, fy - 32 - kmit);
      ctx.quadraticCurveTo(fx + 13 + kmit, fy - 14, fx + 10, fy + 8);
      ctx.fill();
    }
  }
  ctx.restore();
  void SVET;
}
