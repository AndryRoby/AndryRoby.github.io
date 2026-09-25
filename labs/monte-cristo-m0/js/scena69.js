/* Skladanie sceny kapitoly 69: dom v reze (Busoni, Wilmore), mapa Parize, Villefort.
 * Kresli sa len na poziadanie (slucka.js), statické vrstvy su vytlacene raz (lis), svetlo
 * je vytlacena ziara s priehladnostou a tma jedno nasobenie cez celu snimku. */
import { SVETY69, MAPA69 } from './kulisy/pariz.js';
import { kresliBabku69, KOSTI69, MIERKA69 } from './postavy69.js';

export const HERCI69 = ['komornik', 'sluha', 'vyslanec', 'grof'];

/* priblizna poloha hlavy herca vo svete (pre ciele Pozornosti a svetlo na tvari) */
export function hlavaHerca(h, meno) {
  const K = KOSTI69[meno] || KOSTI69.grof;
  const p = h.poza || { boky: 48, trup: 0 };
  const vyska = (p.boky + K.trup * Math.cos(p.trup || 0) + 13) * MIERKA69;
  return { x: h.x + (h.smer || 1) * (Math.sin(p.trup || 0) * K.trup * MIERKA69 + 3), y: h.y - vyska };
}

export function kresliDom(sc) {
  const { ctx, s, st, B } = sc;
  const W = sc.platno.width, H = sc.platno.height;
  const sv = SVETY69[st.svet];
  if (!sv) return;
  const pre = st.svet === 'busoni' ? 'b69' : 'w69';
  const cam = Math.round(st.kam.x * s);
  const img = (meno, x, y, o) => {
    const b = B.get(meno);
    if (!b) return;
    if (o && o.alfa != null) { if (o.alfa <= 0.01) return; ctx.globalAlpha = Math.min(1, o.alfa); }
    if (o && o.sx) { ctx.save(); ctx.translate(Math.round(x * s), Math.round(y * s)); ctx.scale(o.sx, 1); ctx.drawImage(b, 0, 0); ctx.restore(); }
    else ctx.drawImage(b, Math.round(x * s), Math.round(y * s));
    ctx.globalAlpha = 1;
  };
  const zadna = B.get(pre + ':zadna'), rez = B.get(pre + ':rez');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (zadna) ctx.drawImage(zadna, -cam, 0);
  ctx.setTransform(1, 0, 0, 1, -cam, 0);
  const d = st.dom;
  const g = st.herci.grof;
  const v = g.vrstvy || new Set();
  if (st.svet === 'busoni') {
    img('rek69:kocar', d.kocarX, 318 - 96);
    /* dvere: zavrete kridlo na fasade, otvorene sa priklopi k zarubni */
    const [d0] = sv.dvere;
    if (d.dvere < 0.5) { img('rek69:dvere', d0 - 1, 229); if (d.okienko > 0.5) img('rek69:okienkoOtv', d0 + 13, 237); }
    else img('rek69:dvere', d0 - 1, 229, { sx: 0.22 });
    /* vesiak v spalni, okuliare na klacadle */
    const sp0 = sv.spalna[0];
    if (!v.has('rucho')) img('rek69:rucho', sp0 + 225, 74);
    if (!v.has('kapuca')) img('rek69:kapuca', sp0 + 229, 70);
    if (!v.has('okuliare') && !g.okuliareNaOciach) img('rek69:okuliare', sp0 + 44, 142);
    /* lampa na stole, pri zdvihnutom tienidle sa prelina do naklonenej */
    if (d.lampa) {
      const lx = d.lampaX - 22, ly = sv.stol[2] - 44;
      const t = st.svetlo.tienidlo || 0;
      img('rek69:lampa', lx, ly, { alfa: 1 - t });
      img('rek69:lampaHore', lx, ly, { alfa: t });
    }
  } else {
    const P = sv.podlaha;
    if (!v.has('kabat')) img('rek69:w_kabat', 339, P - 136);
    if (!v.has('vesta')) img('rek69:w_vesta', 298, P - 64);
    if (!v.has('nohavice')) img('rek69:w_nohavice', 280, P - 36);
    if (!v.has('vlasy')) img('rek69:w_parochna', 232, P - 74);
    if (!['bokombrady', 'celust', 'jazva'].every((q) => v.has(q))) img('rek69:w_skatulka', 256, P - 53);
    const [dv0] = sv.dvere;
    img('rek69:dvereW', dv0, P - 122, d.dvereW > 0.5 ? { sx: 0.2 } : null);
  }
  /* svetlo pod postavami: ziara lampy a kuzel na tvar hosta */
  const sl = st.svetlo;
  if (st.svet === 'busoni' && d.lampa) {
    const lx = d.lampaX, ly = sv.stol[2] - 10;
    img('luc69:lampa', lx - 130, ly - 118, { alfa: (sl.lampa || 0) * (1 - 0.45 * (sl.tienidlo || 0)) });
    img('luc69:clona', lx - 152, ly - 72, { alfa: (sl.tienidlo || 0) * (sl.lampa || 0) });
  }
  if (st.svet === 'wilmore') for (const [lx, ly] of sv.lampy) img('luc69:matne', lx - 45, ly - 39, { alfa: sl.lampy || 0 });
  /* herci */
  const dych = st.dych && !sc.znizeny ? Math.sin(sc.cas * 1.4) : 0;
  for (const meno of HERCI69) {
    const h = st.herci[meno];
    if (!h || !h.vid || !h.poza) continue;
    const p = dych ? Object.assign({}, h.poza, { trup: h.poza.trup + dych * 0.01, hlava: h.poza.hlava - dych * 0.008 }) : h.poza;
    kresliBabku69(ctx, sc.Bobj || (sc.Bobj = {}), meno, p, h.x, h.y, h.smer, s, h);
  }
  if (rez) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(rez, -cam, 0); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  /* tvar vyslanca: cervenanie (U1) a "prepalenie" v plnom svetle tienidla */
  const vy = st.herci.vyslanec;
  if (vy && vy.vid && vy.poza) {
    const hl = hlavaHerca(vy, 'vyslanec');
    const x = (hl.x - st.kam.x) * s, y = hl.y * s;
    if ((sl.cervenie || 0) > 0.01) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgba(241,80,96,${(0.55 * sl.cervenie).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(x + 2 * s * (vy.smer || 1), y + 2 * s, 5 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    if ((sl.tienidlo || 0) > 0.01 && st.svet === 'busoni') {
      const gr = ctx.createRadialGradient(x, y, 1, x, y, 12 * s);
      gr.addColorStop(0, `rgba(250,244,226,${(0.82 * sl.tienidlo).toFixed(3)})`);
      gr.addColorStop(1, 'rgba(250,244,226,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(x - 12 * s, y - 12 * s, 24 * s, 24 * s);
    }
  }
  /* vecer: nasobenie farbou, v Busoniho izbe tma okolo lampy */
  const t = sl.tint || 0;
  if (t > 0.01) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(${Math.round(255 - 60 * t)},${Math.round(255 - 80 * t)},${Math.round(255 - 30 * t)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }
  const tm = sl.tma || 0;
  if (tm > 0.01) {
    ctx.globalCompositeOperation = 'multiply';
    const tmava = `rgb(${Math.round(255 - 185 * tm)},${Math.round(255 - 180 * tm)},${Math.round(255 - 130 * tm)})`;
    if (st.svet === 'busoni' && d.lampa && (sl.lampa || 0) > 0.05) {
      const tv = sl.tienidlo || 0;
      const cx = ((d.lampaX - 26 * tv) - st.kam.x) * s, cy = (sv.stol[2] - 24) * s;
      const gr = ctx.createRadialGradient(cx, cy, 30 * s, cx, cy, (190 + 30 * tv) * s);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.35, `rgb(${Math.round(255 - 70 * tm)},${Math.round(255 - 66 * tm)},${Math.round(255 - 40 * tm)})`);
      gr.addColorStop(1, tmava);
      ctx.fillStyle = gr;
    } else ctx.fillStyle = tmava;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }
}

/* Mapa Parize: kocar vyslanca cervenou bodkovanou, gróf modrou (NAVRH trasy). */
export function kresliMapu69(sc) {
  const { ctx, s, st, B } = sc;
  const m = B.get('mapa69');
  if (m) ctx.drawImage(m, 0, 0);
  const M = st.m69 || {};
  const [ax, ay] = MAPA69.bod(...MAPA69.ferou), [bx, by] = MAPA69.bod(...MAPA69.villefort), [cx, cy] = MAPA69.bod(...MAPA69.fontaine);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  const bodky = (body, p, farba, r) => {
    const n = 36, kolko = Math.floor(n * Math.max(0, Math.min(1, p)));
    ctx.fillStyle = farba;
    for (let i = 1; i <= kolko; i++) {
      const q = i / n, u = 1 - q;
      const [x0, y0, x1, y1, x2, y2] = body;
      const x = u * u * x0 + 2 * u * q * x1 + q * q * x2, y = u * u * y0 + 2 * u * q * y1 + q * q * y2;
      ctx.beginPath(); ctx.arc(Math.round(x * s), Math.round(y * s), r * s, 0, Math.PI * 2); ctx.fill();
    }
  };
  /* rano a vecer: z Rue Férou rovno k Villefortovi, o hodinu do Rue Fontaine-Saint-Georges */
  bodky([ax, ay, (ax + bx) / 2 - 20, (ay + by) / 2 + 30, bx, by], M.kocar || 0, 'rgb(241,80,96)', 1.9);
  bodky([bx, by, (bx + cx) / 2 - 6, (by + cy) / 2 - 20, cx, cy], M.kocar2 || 0, 'rgb(241,80,96)', 1.9);
  /* gróf: druha ciara atramentu, modra */
  bodky([ax, ay, ax + 60, (ay + cy) / 2, cx, cy], M.grof || 0, 'rgb(50,85,164)', 2.1);
  ctx.globalCompositeOperation = 'source-over';
}

/* Villefort spi: lampa zhasne a ostane len modry atrament. */
export function kresliVillefort(sc) {
  const { ctx, st, B } = sc;
  const b = B.get('tablo:69vb'), f = B.get('tablo:69v');
  if (b) ctx.drawImage(b, 0, 0);
  if (f) { ctx.globalAlpha = Math.max(0, Math.min(1, st.vlampa == null ? 1 : st.vlampa)); ctx.drawImage(f, 0, 0); ctx.globalAlpha = 1; }
}
