/* Spolocne miesanie atramentov a drobne kusy, ktore kresli viac kulis.
 * y = zlta, r = cervena, b = modra; hodnota je hustota 0 az 1 (nad 0,86 plna plocha). */

export const C = {
  kamen: { b: 0.42, r: 0.17, y: 0.2 },
  kamenTien: { b: 0.62, r: 0.32, y: 0.22 },
  rez: { b: 0.98, r: 0.52, y: 0.22 },
  rezSvetly: { b: 0.2, r: 0.12, y: 0.05 },
  zem: { b: 0.66, r: 0.48, y: 0.36 },
  dlazba: { b: 0.6, r: 0.34, y: 0.3 },
  drevo: { y: 0.62, r: 0.5, b: 0.42 },
  drevoTm: { y: 0.55, r: 0.6, b: 0.66 },
  slama: { y: 0.72, r: 0.3, b: 0.12 },
  plat: { y: 0.2, r: 0.06, b: 0.06 },
  handra: { y: 0.34, r: 0.3, b: 0.4 },
  kozaFaria: { y: 0.36, r: 0.28, b: 0.08 },
  koza: { y: 0.4, r: 0.3, b: 0.06 },
  atrament: { b: 1, r: 0.92, y: 0.45 },
  tma: { b: 0.92, r: 0.7, y: 0.3 },
  zlato: { y: 0.95, r: 0.16 },
  oranz: { y: 0.85, r: 0.62 },
  cervena: { r: 0.92 },
  hrdza: { r: 0.78, y: 0.42, b: 0.12 },
  nebo: { b: 0.2, y: 0.04 },
  zelezo: { b: 0.8, r: 0.62, y: 0.4 },
};

/* Muriva: rady kvadrov s maltou, kazdy kamen s vlastnym odtienom. */
export function murivo(k, x, y, w, h, vyska, zaklad, o) {
  o = o || {};
  const malta = o.malta == null ? 0.3 : o.malta;
  const spary = k.P();
  for (let yy = y, rad = 0; yy < y + h; yy += vyska, rad++) {
    let xx = x - (rad % 2 ? vyska * 0.8 : 0);
    spary.moveTo(x, yy); spary.lineTo(x + w, yy + k.R(-0.6, 0.6));
    while (xx < x + w) {
      const bw = vyska * k.R(1.3, 2.4);
      const p = k.blob([
        xx, yy, xx + bw * 0.5, yy + k.R(-0.6, 0.6), xx + bw, yy,
        xx + bw + k.R(-0.6, 0.6), yy + vyska * 0.5, xx + bw, yy + vyska,
        xx + bw * 0.5, yy + vyska + k.R(-0.6, 0.6), xx, yy + vyska, xx + k.R(-0.6, 0.6), yy + vyska * 0.5,
      ]);
      const t = k.R(-0.22, 0.18);
      k.add({ b: zaklad.b * (0.3 + t), r: zaklad.r * (0.3 + t), y: zaklad.y * (0.3 + t) }, p);
      /* spodna hrana kvadra v tieni */
      k.addStroke({ b: 0.22, r: 0.08 }, k.poly([xx + 1.5, yy + vyska - 1.3, xx + bw - 1.5, yy + vyska - 1.3], true), 1.6);
      if (k.rnd() < 0.35) k.add({ b: 0.12, y: 0.05 }, k.circ(xx + bw * k.R(0.2, 0.8), yy + vyska * k.R(0.3, 0.7), k.R(0.8, 2.2)));
      spary.moveTo(xx + bw, yy); spary.lineTo(xx + bw + k.R(-0.5, 0.5), yy + vyska);
      xx += bw;
    }
  }
  /* malta: svetlejsie spary */
  k.clip(k.rect(x, y, w, h), () => k.cut(spary, malta, 0.9));
}

/* Slama: kratke tahy v smere, ktory si lozko pamata. */
export function slama(k, x0, y0, x1, y1, n, farba) {
  const p = k.P();
  for (let i = 0; i < n; i++) {
    const x = k.R(x0, x1), y = k.R(y0, y1), a = k.R(-0.45, 0.45), l = k.R(5, 11);
    p.moveTo(x, y); p.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
  }
  k.addStroke(farba || { y: 0.9, r: 0.5, b: 0.2 }, p, 0.8);
}

/* Rez stenou: tmava hmota s rovnobeznym srafovanim ako v architektonickom reze. */
export function rez(k, p, o) {
  o = o || {};
  k.fill(o.farba || C.rez, p);
  k.hatch(null, p, 45, o.rozteca || 4.6, 0.6, { cut: o.svetlo || 0.2 });
}

/* Polyline s bodmi [x,y,...] na obrys pasu sirky w (pre chodbu a jej orezanie). */
export function pas(body, w) {
  const L = [], Rr = [];
  const n = body.length / 2;
  for (let i = 0; i < n; i++) {
    const x = body[i * 2], y = body[i * 2 + 1];
    const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
    const dx = body[i1 * 2] - body[i0 * 2], dy = body[i1 * 2 + 1] - body[i0 * 2 + 1];
    const d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d;
    L.push(x + nx * w / 2, y + ny * w / 2);
    Rr.unshift(y - ny * w / 2); Rr.unshift(x - nx * w / 2);
  }
  return L.concat(Rr);
}
