// kodfilm/hak.js: hák (prvá sekunda filmu pre siete) a formáty s bezpečnými zónami.
//
// Pravidlo háku: už snímka 0 ukazuje samotný produkt v pohybe (hotová doska, appka, výsledok) a jeho
// názov. Žiadny papier, žiadna výzva na ťuknutie, žiadne prázdne pozadie. Po 1,2 až 1,5 s hák odíde
// a film začne príbeh (produkt sa vyprázdni, zmenší alebo presunie do polohy príbehu).
// Plagát stránky (film.plagat) je čas uprostred háku: najsilnejší záber, názov čitateľný.
//
// Výkon: sprity názvu a vety sa kreslia raz (spriteNazvu, spriteRiadku), kresliNazov len skladá.

import { okno, ease, lerp } from './cas.js';
import { platno, pismo, zalom } from './kresba.js';

/**
 * Druh formátu podľa pomeru strán. Každý film podľa neho skladá rozloženie.
 *   vysoky 9:16 (Shorts, Reels, TikTok), portret 4:5 (Instagram a Facebook feed),
 *   stvorec 1:1, siroky 16:9 (YouTube, web). stlpec = rozloženie pod sebou (všetko okrem 16:9).
 */
export function format(W, H) {
  const pomer = H / W;
  const druh = pomer >= 1.6 ? 'vysoky' : pomer > 1.15 ? 'portret' : pomer >= 0.87 ? 'stvorec' : 'siroky';
  return { druh, pomer, stlpec: druh !== 'siroky' };
}

/**
 * Bezpečná zóna pre dôležitý text (názov, veta, tlačidlo, titulky).
 * 9:16: dolných 20 % a pravých 12 % prekrýva rozhranie Shorts a Reels (popis, tlačidlá), horných 8 %
 * hlavička. Text preto len v pásme x 12 až 88 % (súmerne, aby bol stred stredom) a y 8 až 80 %.
 * Ostatné formáty: okraj 6 % kratšej strany.
 */
export function zona(W, H) {
  const { druh } = format(W, H);
  let z;
  if (druh === 'vysoky') z = { x0: W * 0.12, x1: W * 0.88, y0: H * 0.08, y1: H * 0.8 };
  else if (druh === 'siroky') { const m = H * 0.06; z = { x0: W * 0.07, x1: W * 0.93, y0: m, y1: H - m }; } // 16:9: pravý okraj rovnaký ako ľavý (7 %)
  else { const m = Math.min(W, H) * 0.06; z = { x0: m, x1: W - m, y0: m, y1: H - m }; }
  return { ...z, w: z.x1 - z.x0, h: z.y1 - z.y0, cx: (z.x0 + z.x1) / 2 };
}

/** Najmenšie písmo, ktoré je na telefóne čitateľné: 36 px pri kratšej strane 1080. Drobnejšiu tlač nepoužívať. */
export const minPismo = (W, H) => Math.min(W, H) / 30;

/** Pri 9:16 smie názov (aj s priblížením háku) zaberať najviac 74 % šírky, aby ostal v páse 12 až 88 %. */
export const MAX_NAZOV_916 = 0.74;
const PRIBLIZENIE = 1.035; // priblíženie názvu v prvej sekunde háku

/** Sprite s textom (kreslí sa raz v pixeloch zariadenia, skladá sa v logických bodoch). */
export function sprite(dpr, w, h, kresli) {
  const c = platno(Math.ceil(w * dpr), Math.ceil(h * dpr)), x = c.getContext('2d');
  x.scale(dpr, dpr);
  kresli(x);
  return { c, w, h };
}

/** Najväčšia veľkosť písma do px, pri ktorej sa text zmestí do šírky w. */
export function zmestPismo(text, vaha, px, w) {
  const m = platno(4, 4).getContext('2d');
  m.font = pismo(vaha, px);
  const sirka = m.measureText(text).width;
  return sirka > w ? (px * w) / sirka : px;
}

/**
 * Názov produktu ako sprite (farebný prechod, jemný tieň) plus svetlá verzia na odlesk.
 * farby: zastávky prechodu zhora nadol. Vracia { c, w, h, svetly, px }.
 */
export function spriteNazvu(dpr, text, px, w, { zarovnanie = 'center', farby = ['#ffe7a6', '#f5bf4f', '#e09a2c'], tien = 'rgba(0,0,0,0.35)', vaha = 700 } = {}) {
  // rezerva 6 %: presah písmen a priblíženie háku (1,035) nesmú vyjsť z pásu w
  const vel = zmestPismo(text, vaha, px, w * 0.94);
  const h = vel * 1.15;
  const x0 = zarovnanie === 'center' ? w / 2 : zarovnanie === 'right' ? w : 0;
  const kresli = (farbyF, sTienom) => (x) => {
    x.font = pismo(vaha, vel); x.textBaseline = 'top'; x.textAlign = zarovnanie;
    if (sTienom) { x.fillStyle = tien; x.fillText(text, x0, vel * 0.06); }
    const g = x.createLinearGradient(0, 0, 0, vel);
    farbyF.forEach((f, i) => g.addColorStop(i / (farbyF.length - 1), f));
    x.fillStyle = g;
    x.fillText(text, x0, 0);
  };
  const s = sprite(dpr, w, h, kresli(farby, true));
  s.svetly = sprite(dpr, w, h, kresli(['rgba(255,255,255,0.95)', 'rgba(255,248,220,0.8)', 'rgba(255,240,200,0.6)'], false)).c;
  s.px = vel;
  const m = platno(4, 4).getContext('2d'); m.font = pismo(vaha, vel);
  s.textW = m.measureText(text).width; // šírka samotného textu (tvrdý limit v kresliNazov)
  return s;
}

/**
 * Vyvážené zalomenie: rovnaký počet riadkov ako pri šírke maxW, ale riadky čo najpodobnejšie dlhé
 * (žiadna sirota „row?“ na poslednom riadku). ctx musí mať nastavené písmo.
 */
export function vyvazZalom(ctx, text, maxW) {
  const riadky = zalom(ctx, text, maxW);
  if (riadky.length < 2) return riadky;
  let lo = maxW * 0.3, hi = maxW;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (zalom(ctx, text, mid).length <= riadky.length) hi = mid; else lo = mid;
  }
  return zalom(ctx, text, hi);
}

/** Riadok alebo odsek textu ako sprite, zalomený vyvážene do šírky w (najviac maxRiadkov). */
export function spriteRiadku(dpr, text, px, w, { vaha = 600, farba = '#eef1ff', zarovnanie = 'center', riadkovanie = 1.3, maxRiadkov = 2 } = {}) {
  const m = platno(4, 4).getContext('2d');
  let vel = px;
  m.font = pismo(vaha, vel);
  let riadky = vyvazZalom(m, text, w);
  // ak by bolo riadkov priveľa, zmenšiť písmo, kým sa zmestí
  while (riadky.length > maxRiadkov && vel > 8) { vel *= 0.94; m.font = pismo(vaha, vel); riadky = vyvazZalom(m, text, w); }
  const lh = vel * riadkovanie;
  const x0 = zarovnanie === 'center' ? w / 2 : zarovnanie === 'right' ? w : 0;
  const s = sprite(dpr, w, lh * (riadky.length - 1) + vel * 1.3, (x) => {
    x.font = pismo(vaha, vel); x.textBaseline = 'top'; x.textAlign = zarovnanie; x.fillStyle = farba;
    riadky.forEach((r, i) => x.fillText(r, x0, i * lh));
  });
  s.px = vel; s.riadky = riadky.length;
  return s;
}

/**
 * Hák: časovanie a kreslenie názvu v prvej sekunde.
 *   const H = hak({ drz: 1.3, odchod: 0.6 });  // hák trvá do H.koniec = 1.9 s
 *   H.vidno(t)   1 počas držania, počas odchodu klesne na 0
 *   H.navrat(t)  0 až do drz, potom 0..1 (produkt ide do polohy príbehu)
 *   H.kresliNazov(ctx, t, sp, x, y)  názov: od snímky 0 plne čitateľný, jemne sa priblíži,
 *                prejde po ňom odlesk, pri odchode mierne klesne a zmizne
 *   H.kresliRiadok(ctx, t, sp, x, y, oneskorenie)  druhý riadok (veta), odchádza o kúsok skôr
 *   H.zvuk(opt)  krátky úvodný akord so zvonmi od času 0 a švih pri odchode (udalosti partitúry)
 */
export function hak({ drz = 1.3, odchod = 0.6, lesk = [0.12, 0.95] } = {}) {
  const koniec = drz + odchod;
  // Text odchádza skôr a rýchlejšie (drz - 0,15 až drz + 0,25) ako produkt (drz až koniec), aby sa
  // produkt, ktorý rastie do polohy príbehu, nikdy neprekryl s názvom. Plagát voľ pred drz - 0,15.
  const von = (t, o = 0) => ease.inOutCubic(okno(t, drz - 0.15 - o, drz + 0.25 - o));
  return {
    drz, odchod, koniec,
    vidno: (t) => 1 - von(t),
    navrat: (t) => ease.inOutCubic(okno(t, drz, koniec)),
    kresliNazov(x, t, sp, px, py) {
      if (t >= koniec) return;
      const v = von(t);
      let priblizenie = lerp(PRIBLIZENIE, 1, ease.outCubic(okno(t, 0, drz)));
      // tvrdý limit pre 9:16: text aj s priblížením najviac MAX_NAZOV_916 šírky plátna (sprite.textW)
      if (sp.textW) {
        const a = Math.abs(x.getTransform().a) || 1, Wl = x.canvas.width / a, Hl = x.canvas.height / a;
        if (Hl / Wl >= 1.6 && sp.textW * priblizenie > Wl * MAX_NAZOV_916) priblizenie = (Wl * MAX_NAZOV_916) / sp.textW;
      }
      const cx = px + sp.w / 2, cy = py + sp.h / 2;
      x.save();
      x.globalAlpha = 1 - v;
      x.translate(cx, cy + v * sp.h * 0.25);
      x.scale(priblizenie * (1 - v * 0.06), priblizenie * (1 - v * 0.06));
      x.translate(-cx, -cy);
      x.drawImage(sp.c, px, py, sp.w, sp.h);
      // odlesk: šikmý pás prejde raz zľava doprava
      const q = okno(t, lesk[0], lesk[1]);
      if (sp.svetly && q > 0 && q < 1) {
        const bx = px + lerp(-0.2, 1.2, ease.inOutSine(q)) * sp.w, sirka = sp.h * 0.55, sklon = sp.h * 0.35;
        x.beginPath();
        x.moveTo(bx - sirka / 2 + sklon, py); x.lineTo(bx + sirka / 2 + sklon, py);
        x.lineTo(bx + sirka / 2 - sklon, py + sp.h); x.lineTo(bx - sirka / 2 - sklon, py + sp.h);
        x.closePath();
        x.clip();
        x.globalAlpha = (1 - v) * 0.85 * Math.sin(Math.PI * q);
        x.drawImage(sp.svetly, px, py, sp.w, sp.h);
      }
      x.restore();
    },
    kresliRiadok(x, t, sp, px, py, oneskorenie = 0.08) {
      if (t >= koniec) return;
      const v = von(t, oneskorenie);
      if (v >= 1) return;
      x.save();
      x.globalAlpha = 1 - v;
      x.drawImage(sp.c, px, py + v * sp.h * 0.4, sp.w, sp.h);
      x.restore();
    },
    zvuk({ akord = ['C3', 'G3', 'E4', 'G4'], zvony = ['C5', 'G5', 'C6'], hlas = 1 } = {}) {
      const u = [];
      // zvuk od prvej snímky: krátky dopad, akord s rýchlym nábehom, zvony, trblietanie
      u.push({ t: 0, typ: 'tuk', f: 90, dlzka: 0.3, hlas: 0.22 * hlas });
      u.push({ t: 0, typ: 'pad', noty: akord, dlzka: drz + 0.9, nabeh: 0.05, dobeh: 0.8, hlas: 0.2 * hlas, filter: 1500, filter2: 700 });
      zvony.forEach((f, i) => u.push({ t: 0.02 + i * 0.09, typ: 'zvon', f, index: 0.8, dlzka: 1.6, hlas: (0.13 - i * 0.02) * hlas, pan: -0.3 + i * 0.3, dozvuk: 0.5 }));
      u.push({ t: 0.05, typ: 'sum', filter: 'highpass', f0: 5000, f1: 9000, dlzka: 1.0, hlas: 0.035 * hlas, dozvuk: 0.5 });
      // odchod: švih nadol
      u.push({ t: drz - 0.05, typ: 'sum', filter: 'bandpass', f0: 3000, f1: 500, q: 0.7, dlzka: odchod + 0.1, nabeh: 0.15, tvar: 'narast', hlas: 0.12 * hlas, dozvuk: 0.2 });
      u.push({ t: drz, typ: 'glis', f0: zvony[zvony.length - 1], f1: zvony[0], dlzka: odchod, hlas: 0.03 * hlas, dozvuk: 0.4 });
      return u;
    },
  };
}
