/* Detaily pre ukony rukami (vyrez v kruhu) a pohyblive rekvizity sveta.
 * Papier "which, from being constantly rolled into a small compass, had the form of
 * a cylinder" (r. 8259 az 8261); goticke pismo a zvlastny atrament (r. 8267 az 8269);
 * zazltnuty papier v breviari ako zalozka (r. 8621 az 8623); zltkaste pismena v ohni
 * (r. 8627 az 8628). Kamen vchodu a rohoz (r. 8364 az 8366). Tvary su NAVRH. */
import { C } from './spolocne.js';

const hrana = (k, x, y0, y1, amp, n) => {
  const out = [];
  for (let i = 0; i <= n; i++) out.push(x + (i % 2 ? amp : -amp * 0.4) * (0.5 + k.rnd()), y0 + ((y1 - y0) * i) / n);
  return out;
};

/* Harok v detaile: polospaleny, s gotickymi riadkami, bez citatelneho textu
   (text ranneho utrzku hrac cita v liste, doslovne). */
export const harok = {
  w: 280, h: 180, seed: 8259, maska: true,
  draw(k) {
    const pravy = hrana(k, 232, 8, 172, 10, 14);
    const p = k.poly([8, 10, 150, 6, 228, 8, ...pravy, 230, 172, 120, 176, 10, 170]);
    k.fill({ y: 0.26, r: 0.08, b: 0.06 }, p);
    k.add({ y: k.lin(8, 0, 240, 0, [0, 0], [0.7, 0.12], [1, 0.4]), r: k.lin(8, 0, 240, 0, [0.6, 0], [1, 0.4]), b: k.lin(8, 0, 240, 0, [0.8, 0], [1, 0.3]) }, p);
    /* spaleny okraj */
    k.addStroke({ b: 0.8, r: 0.7, y: 0.5 }, k.poly(pravy, true), 3.2);
    const riadky = k.P();
    for (let i = 0; i < 12; i++) {
      const y = 24 + i * 12.4;
      let x = 22;
      const koniec = 200 + k.R(-30, 18);
      while (x < koniec) { const w = k.R(10, 30); riadky.moveTo(x, y); riadky.lineTo(Math.min(x + w, koniec), y); x += w + k.R(4, 7); }
    }
    k.addStroke({ r: 0.78, y: 0.4, b: 0.14 }, riadky, 3.4);
    const vl = k.P();
    for (let i = 0; i < 12; i++) { const y = 24 + i * 12.4; for (let x = 24; x < 190; x += k.R(5, 9)) { vl.moveTo(x, y - 3.4); vl.lineTo(x, y + 2.2); } }
    k.addStroke({ r: 0.6, y: 0.3 }, vl, 0.8);
    /* zlomy papiera od valceka */
    const zl = k.P();
    for (const x of [60, 118, 176]) { zl.moveTo(x, 8); zl.lineTo(x + 2, 172); }
    k.addStroke({ b: 0.12, r: 0.04 }, zl, 1.2);
  },
};
/* valcek, do ktoreho sa harok zvija */
export const rolka = {
  w: 30, h: 184, seed: 8260, maska: true,
  draw(k) {
    const p = k.rect(5, 4, 20, 176);
    k.fill({ y: k.lin(5, 0, 25, 0, [0, 0.3], [0.5, 0.18], [1, 0.4]), r: 0.1, b: k.lin(5, 0, 25, 0, [0, 0.2], [0.5, 0.04], [1, 0.34]) }, p);
    k.fill({ y: 0.3, r: 0.18, b: 0.24 }, k.ell(15, 4, 10, 3.6));
    k.addStroke({ b: 0.7, r: 0.5 }, k.ell(15, 4, 10, 3.6), 0.8);
    k.addStroke({ b: 0.7, r: 0.5 }, p, 0.8);
  },
};

export const breviar = {
  w: 240, h: 150, seed: 8517, maska: true,
  draw(k) {
    const obal = k.poly([20, 120, 220, 120, 230, 138, 10, 138]);
    k.fill({ r: 0.85, b: 0.6, y: 0.3 }, obal);
    const strany = k.poly([24, 60, 216, 60, 222, 120, 18, 120]);
    k.fill({ y: 0.24, r: 0.06 }, strany);
    const l = k.P();
    for (let y = 66; y < 118; y += 3.4) { l.moveTo(22, y); l.lineTo(218, y + 0.4); }
    k.addStroke({ y: 0.3, r: 0.14, b: 0.1 }, l, 0.6);
    const vrch = k.poly([14, 60, 226, 60, 216, 44, 24, 44]);
    k.fill({ r: 0.9, b: 0.62, y: 0.32 }, vrch);
    for (const [x, y] of [[20, 58], [220, 58], [12, 132], [228, 132]]) k.fill(C.zlato, k.poly([x - 9, y - 7, x + 9, y - 7, x + 9, y + 7, x - 9, y + 7]));
    k.fill(C.zlato, k.rect(112, 44, 16, 94));
    k.addStroke(C.atrament, obal, 0.8);
    k.addStroke(C.atrament, vrch, 0.8);
  },
};
export const zalozka = {
  w: 90, h: 130, seed: 8622, maska: true,
  draw(k) {
    const p = k.poly([10, 6, 78, 4, 82, 124, 8, 126]);
    k.fill({ y: 0.46, r: 0.12, b: 0.06 }, p);
    k.add({ y: k.lin(0, 0, 0, 130, [0, 0.2], [1, 0]), r: 0.06 }, p);
    k.addStroke({ y: 0.6, r: 0.3, b: 0.2 }, p, 0.8);
  },
};
/* zltkaste pismena, ktore sa v ohni objavia (r. 8627 az 8628) */
export const pismena = {
  w: 90, h: 130, seed: 8628, maska: true,
  draw(k) {
    const r = k.P();
    for (let i = 0; i < 12; i++) {
      const y = 16 + i * 9, koniec = 72 - (i % 3) * 9;
      for (let x = 16; x < koniec; x += k.R(3, 6)) { r.moveTo(x, y - 3); r.lineTo(x + k.R(-0.6, 0.6), y + 1.6); }
    }
    k.stroke({ y: 0.98, r: 0.62, b: 0.28 }, r, 1.5);
  },
};

/* Kamen v podlahe Fariovej cely a rohoz, ktorou ho Faria prikryva. */
export const kamenF = {
  w: 44, h: 10, seed: 8364, maska: true,
  draw(k) {
    const p = k.poly([1, 1, 43, 1, 42, 9, 2, 9]);
    k.fill(C.dlazba, p);
    k.cut(k.rect(1, 1, 42, 1.2), 0.5);
    k.addStroke(C.atrament, p, 0.8);
  },
};
export const rohoz = {
  w: 60, h: 6, seed: 8366, maska: true,
  draw(k) {
    const p = k.blob([1, 5, 3, 1.4, 30, 0.6, 57, 1.4, 59, 5]);
    k.fill({ y: 0.66, r: 0.34, b: 0.2 }, p);
    const s = k.P();
    for (let x = 4; x < 57; x += 3) { s.moveTo(x, 1.5); s.lineTo(x + 1, 5); }
    k.addStroke({ y: 0.4, r: 0.4, b: 0.36 }, s, 0.6);
  },
};

export const DETAILY = { 'det:harok': harok, 'det:rolka': rolka, 'det:breviar': breviar, 'det:zalozka': zalozka, 'det:pismena': pismena, 'rek:kamen': kamenF, 'rek:rohoz': rohoz };
