/* Tabla kapitoly 18 a obrazky okolo nej.
 *
 * Fariov pribeh (b10) su rytiny v jednom atramente, cervenom: je to spomienka
 * a Fariove slova, nie pritomnost (scenar-18.md, cast 2). Rim 1807 (b11) ma navyse
 * zltu pre plamen. Postavy rytin su siluety bez tvari (NAVRH); synovec "in full
 * costume" (r. 8497 az 8498). Kluc so zeleznym hrotom (r. 8460 az 8466) a prsten
 * s levou hlavou (r. 8467 az 8469) su len predmety, bez obete; smrt na prahu vinice
 * (r. 8509 az 8511) je prazdny prah, nikto na zemi (citlive miesto).
 * Vsetko ostatne (architektura, nabytok, kompozicia) je NAVRH. */
import { C, murivo } from './spolocne.js';

const W = 640, H = 360;
const R = (d) => ({ r: d });

/* doska rytiny: okraj papiera, odtlacok platne a tenka linka */
function doska(k) {
  const p = k.rect(34, 22, W - 68, H - 44);
  k.papier(k.rect(0, 0, W, H));
  k.fill(R(0.04), p);
  k.addStroke(R(0.8), p, 1.4);
  k.addStroke(R(0.35), k.rect(28, 16, W - 56, H - 32), 0.6);
  return p;
}
/* srafovanie tvaru: husta = tmava plocha, sparsa = svetla */
function sraf(k, p, d, uhol, rozteca) { k.hatch(R(Math.min(1, d * 1.5)), p, uhol == null ? 35 : uhol, rozteca || 3, 1.05); }
function krizom(k, p, d, rozteca) { sraf(k, p, d, 35, rozteca); sraf(k, p, d * 0.8, -40, rozteca); }
function obrys(k, p, lw) { k.addStroke(R(0.9), p, lw || 1); }

/* silueta v rucho: x, y = zem, h = vyska, o.klobuk: 'tiara', 'galero', 'baret', o.smer */
function silueta(k, x, y, h, o) {
  o = o || {};
  const s = h / 100, d = o.smer || 1;
  const X = (v) => x + v * s * d, Y = (v) => y - v * s;
  const P = (arr) => arr.map((v, i) => (i % 2 ? Y(v) : X(v)));
  const telo = k.blob(P(o.sedi ? [-20, 0, -22, 30, -18, 58, -12, 78, 0, 82, 12, 78, 18, 60, 30, 46, 34, 28, 20, 26, 22, 0] : [-17, 0, -18, 40, -14, 70, -10, 80, 0, 84, 10, 80, 14, 68, 17, 40, 19, 0]));
  k.fill(R(0.3), telo);
  sraf(k, telo, o.tma || 0.6, 60 * d, 2.4);
  obrys(k, telo);
  if (o.plast) { const pl = k.poly(P([-12, 80, 13, 80, 22, 30, -22, 30])); sraf(k, pl, 0.4, -30 * d, 3.4); obrys(k, pl, 0.8); }
  const hl = k.ell(X(1), Y(91), 8 * s, 9.5 * s);
  k.fill(R(0.1), hl);
  sraf(k, hl, 0.3, 80, 2.4);
  obrys(k, hl, 0.9);
  if (o.klobuk === 'tiara') {
    const t = k.blob(P([-7, 96, -6, 110, 0, 118, 6, 110, 7, 96]));
    k.fill(R(0.2), t); obrys(k, t, 0.9);
    for (const v of [100, 105, 110]) k.addStroke(R(0.8), k.poly(P([-6.5, v, 6.5, v]), true), 1.1);
    k.addStroke(R(0.9), k.poly(P([0, 118, 0, 123]), true), 1);
  }
  if (o.klobuk === 'galero') {
    const g = k.blob(P([-20, 96, -14, 99, -6, 104, 6, 104, 14, 99, 20, 96, 0, 94]));
    k.fill(R(0.7), g); obrys(k, g, 0.8);
    for (const z of [-1, 1]) k.addStroke(R(0.8), k.poly(P([15 * z, 97, 17 * z, 80, 16 * z, 66]), true), 0.8);
  }
  if (o.klobuk === 'baret') { const b = k.blob(P([-9, 96, -10, 102, 0, 106, 12, 101, 9, 96])); k.fill(R(0.85), b); }
  if (o.mec) k.stroke(R(0.95), k.poly(P([10, 40, 26, 6]), true), 1.6);
  if (o.pero) k.stroke(R(0.9), k.poly(P([22, 52, 34, 66]), true), 1);
  return telo;
}

/* stlpy, oblúky, rimsa: rimska architektura v rytine */
function arkada(k, x, y, w, h, n, d) {
  const sirka = w / n;
  for (let i = 0; i < n; i++) {
    const ox = x + i * sirka + sirka * 0.18, ow = sirka * 0.64;
    const p = k.P();
    p.moveTo(ox, y + h); p.lineTo(ox, y + h * 0.45); p.arc(ox + ow / 2, y + h * 0.45, ow / 2, Math.PI, 0); p.lineTo(ox + ow, y + h); p.closePath();
    k.fill(R(0.16), p);
    krizom(k, p, d, 2.4);
    obrys(k, p, 0.8);
  }
}

const tablo1 = {
  w: W, h: H, seed: 8407, atramenty: 'r', maska: false,
  draw(k) {
    const ram = doska(k);
    k.clip(ram, () => {
      sraf(k, k.rect(34, 22, W - 68, 170), 0.18, 0, 4.2);
      /* palac rodu Spada: rustika, tri poschodia okien, rimsa (NAVRH) */
      const fas = k.rect(150, 70, 340, 262);
      k.fill(R(0.08), fas);
      sraf(k, fas, 0.22, 90, 5);
      for (let y = 262; y < 332; y += 14) k.addStroke(R(0.7), k.poly([150, y, 490, y], true), 0.8);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
        const x = 170 + i * 54, y = 96 + j * 56;
        const o = k.rect(x, y, 26, 36);
        k.fill(R(0.2), o); krizom(k, o, 0.8, 2.2); obrys(k, o, 0.8);
        k.stroke(R(0.8), k.poly([x - 5, y - 4, x + 13, y - 13, x + 31, y - 4], true), 1);
      }
      const brana = k.P(); brana.moveTo(296, 332); brana.lineTo(296, 290); brana.arc(320, 290, 24, Math.PI, 0); brana.lineTo(344, 332); brana.closePath();
      k.fill(R(0.3), brana); krizom(k, brana, 0.85, 2); obrys(k, brana);
      k.fill(R(0.6), k.rect(140, 62, 360, 10));
      k.fill(R(0.4), k.rect(146, 72, 348, 5));
      /* erb nad branou */
      const erb = k.blob([306, 228, 334, 228, 334, 246, 320, 258, 306, 246]);
      k.fill(R(0.3), erb); obrys(k, erb);
      k.stroke(R(0.9), k.poly([312, 236, 328, 250], true), 1.2);
      /* ulica a drobne postavy */
      sraf(k, k.rect(34, 332, W - 68, 8), 0.5, 0, 2);
      silueta(k, 110, 334, 44, { tma: 0.6 });
      silueta(k, 540, 334, 40, { smer: -1, plast: true });
    });
    k.text(R(0.9), 'I', W / 2, H - 4, '600 12px Georgia, serif');
  },
};

const tablo2 = {
  w: W, h: H, seed: 8425, atramenty: 'r',
  draw(k) {
    const ram = doska(k);
    k.clip(ram, () => {
      sraf(k, k.rect(34, 22, W - 68, H - 44), 0.14, -20, 4.6);
      /* zaves a trn: pápež Alexander VI. a Cæsar Borgia ako siluety (NAVRH) */
      const zaves = k.poly([60, 22, 250, 22, 230, 90, 200, 60, 150, 110, 110, 70, 60, 120]);
      krizom(k, zaves, 0.5, 2.6); obrys(k, zaves, 0.8);
      const trn = k.poly([130, 330, 130, 150, 150, 130, 190, 130, 210, 150, 210, 330]);
      k.fill(R(0.2), trn); krizom(k, trn, 0.6, 2.4); obrys(k, trn);
      silueta(k, 172, 330, 150, { klobuk: 'tiara', sedi: true, tma: 0.5 });
      silueta(k, 470, 332, 190, { smer: -1, klobuk: 'baret', mec: true, plast: true, tma: 0.7 });
      /* dva kardinalske klobuky na podusku medzi nimi */
      const stol = k.rect(280, 280, 110, 52);
      k.fill(R(0.2), stol); sraf(k, stol, 0.6, 90, 3); obrys(k, stol);
      const pod = k.blob([278, 280, 300, 266, 370, 266, 392, 280]);
      k.fill(R(0.3), pod); obrys(k, pod);
      for (const x of [310, 360]) {
        const g = k.blob([x - 26, 262, x - 16, 256, x - 8, 244, x + 8, 244, x + 16, 256, x + 26, 262, x, 266]);
        k.fill(R(0.85), g); obrys(k, g, 0.8);
        k.stroke(R(0.8), k.poly([x - 20, 262, x - 24, 290], true), 0.8);
        k.stroke(R(0.8), k.poly([x + 20, 262, x + 24, 290], true), 0.8);
      }
    });
    k.text(R(0.9), 'II', W / 2, H - 4, '600 12px Georgia, serif');
  },
};

const tablo3 = {
  w: W, h: H, seed: 8434, atramenty: 'r',
  draw(k) {
    const ram = doska(k);
    k.clip(ram, () => {
      sraf(k, k.rect(34, 22, W - 68, H - 44), 0.12, 15, 4.8);
      arkada(k, 34, 40, W - 68, 250, 5, 0.3);
      k.fill(R(0.1), k.rect(34, 290, W - 68, 50));
      sraf(k, k.rect(34, 290, W - 68, 50), 0.3, 0, 3);
      /* dvaja buduci kardinali: Rospigliosi a Spada, obaja v klobukoch */
      silueta(k, 210, 318, 180, { klobuk: 'galero', plast: true, tma: 0.6 });
      silueta(k, 430, 318, 184, { smer: -1, klobuk: 'galero', plast: true, tma: 0.66 });
    });
    k.text(R(0.95), 'ROSPIGLIOSI', 210, 334, '600 11px Georgia, serif');
    k.text(R(0.95), 'CÆSAR SPADA', 430, 334, '600 11px Georgia, serif');
    k.text(R(0.9), 'III', W / 2, H - 4, '600 12px Georgia, serif');
  },
};

const tablo4 = {
  w: W, h: H, seed: 8454, atramenty: 'r',
  draw(k) {
    const ram = doska(k);
    k.clip(ram, () => {
      /* len predmety: kluc so zeleznym hrotom a prsten s levou hlavou, na obruse */
      krizom(k, k.rect(34, 22, W - 68, H - 44), 0.3, 3.6);
      const obrus = k.poly([60, 200, 580, 200, 610, 338, 30, 338]);
      k.fill(R(0.04), obrus);
      sraf(k, obrus, 0.16, 0, 5);
      obrys(k, obrus, 0.8);
      /* kluc */
      const kr = k.P();
      kr.arc(170, 250, 28, 0, Math.PI * 2);
      kr.moveTo(186, 250); kr.arc(170, 250, 16, 0, Math.PI * 2, true);
      k.fill(R(0.7), kr, { rule: 'evenodd' }); obrys(k, kr, 0.9);
      const drzak = k.rect(196, 244, 190, 12);
      k.fill(R(0.7), drzak); obrys(k, drzak, 0.9);
      const zub = k.poly([340, 256, 340, 282, 354, 282, 354, 270, 366, 270, 366, 256]);
      k.fill(R(0.7), zub); obrys(k, zub, 0.9);
      /* maly zelezny hrot pri rukovati (r. 8462) */
      k.fill(R(0.95), k.poly([200, 244, 206, 232, 212, 244]));
      /* prsten s levou hlavou */
      const pr = k.P(); pr.arc(470, 262, 30, 0, Math.PI * 2); pr.moveTo(492, 262); pr.arc(470, 262, 22, 0, Math.PI * 2, true);
      k.fill(R(0.55), pr, { rule: 'evenodd' }); obrys(k, pr, 0.9);
      const lev = k.blob([450, 236, 456, 214, 470, 206, 486, 214, 490, 236, 470, 244]);
      k.fill(R(0.4), lev); krizom(k, lev, 0.6, 2); obrys(k, lev, 1);
      k.fill(R(0.95), k.circ(462, 222, 2)); k.fill(R(0.95), k.circ(478, 222, 2));
      k.stroke(R(0.9), k.poly([464, 234, 470, 238, 476, 234], true), 1);
      const hriva = k.P();
      for (let i = 0; i < 9; i++) { const a = -2.7 + i * 0.3; hriva.moveTo(470 + Math.cos(a) * 18, 226 + Math.sin(a) * 18); hriva.lineTo(470 + Math.cos(a) * 25, 226 + Math.sin(a) * 25); }
      k.addStroke(R(0.8), hriva, 1);
      /* dva stoly v pozadi: pozvanie na veceru */
      for (const x of [140, 420]) { const c = k.poly([x, 110, x + 80, 110, x + 70, 180, x + 10, 180]); k.fill(R(0.1), c); sraf(k, c, 0.4, 90, 3); obrys(k, c, 0.7); }
    });
    k.text(R(0.9), 'IV', W / 2, H - 4, '600 12px Georgia, serif');
  },
};

function vinica(k, prah) {
  sraf(k, k.rect(34, 22, W - 68, 200), prah ? 0.3 : 0.14, 0, prah ? 3 : 4.4);
  /* pergola s viničom */
  for (const x of [90, 250, 410, 570]) { const s = k.rect(x - 5, 110, 10, 180); k.fill(R(0.2), s); sraf(k, s, 0.7, 90, 2); obrys(k, s, 0.7); }
  k.fill(R(0.7), k.rect(60, 104, 540, 8));
  for (let i = 0; i < 44; i++) {
    const x = k.R(50, 610), y = k.R(70, 118), r = k.R(6, 14);
    const l = k.blob([x - r, y, x - r * 0.3, y - r * 0.8, x + r, y - r * 0.4, x + r * 0.7, y + r * 0.6, x - r * 0.2, y + r * 0.7]);
    k.fill(R(0.1), l); sraf(k, l, 0.5, k.R(-60, 60), 2.2); obrys(k, l, 0.5);
  }
  for (let i = 0; i < 9; i++) { const x = k.R(70, 590); for (let j = 0; j < 5; j++) k.fill(R(0.85), k.circ(x + (j % 2) * 4, 124 + j * 5, 2.6)); }
  k.fill(R(0.06), k.rect(34, 290, W - 68, 50));
  sraf(k, k.rect(34, 290, W - 68, 50), 0.28, 0, 3.4);
}

const tablo5 = {
  w: W, h: H, seed: 8480, atramenty: 'r',
  draw(k) {
    const ram = doska(k);
    k.clip(ram, () => {
      vinica(k, false);
      /* stol prestrety vo vinici pri San Pierdarena (r. 8480 az 8481) */
      const st = k.rect(200, 236, 250, 54);
      k.fill(R(0.03), st); sraf(k, st, 0.2, 90, 6); obrys(k, st);
      k.fill(R(0.3), k.rect(196, 230, 258, 8));
      for (const x of [230, 280, 330, 380, 420]) { k.stroke(R(0.8), k.poly([x, 230, x, 214], true), 1.2); k.fill(R(0.6), k.ell(x, 212, 5, 2.5)); }
      /* synovec "in full costume" (r. 8497 az 8498) prichadza k stolu */
      silueta(k, 520, 318, 170, { smer: -1, klobuk: 'baret', plast: true, pero: true, tma: 0.55 });
      /* list a pero: Spada pise zavet (r. 8485 az 8486) */
      k.fill(R(0.05), k.poly([250, 226, 290, 222, 294, 230, 254, 234]));
      k.stroke(R(0.9), k.poly([286, 224, 300, 206], true), 1);
    });
    k.text(R(0.9), 'V', W / 2, H - 4, '600 12px Georgia, serif');
  },
};

const tablo5b = {
  w: W, h: H, seed: 8509, atramenty: 'r',
  draw(k) {
    const ram = doska(k);
    k.clip(ram, () => {
      vinica(k, true);
      /* prazdny prah vinice: brana, schod, nikto (smrt je strih, citlive miesto) */
      const brana = k.P(); brana.moveTo(260, 300); brana.lineTo(260, 170); brana.arc(320, 170, 60, Math.PI, 0); brana.lineTo(380, 300); brana.closePath();
      const stena = k.rect(160, 110, 320, 190);
      k.fill(R(0.2), stena); krizom(k, stena, 0.5, 2.6);
      k.fill(R(0.03), brana);
      sraf(k, brana, 0.12, 0, 6);
      obrys(k, brana, 1.2);
      k.fill(R(0.4), k.rect(248, 298, 144, 10));
      obrys(k, k.rect(248, 298, 144, 10), 0.8);
    });
    k.text(R(0.9), 'V', W / 2, H - 4, '600 12px Georgia, serif');
  },
};

const tablo6 = {
  w: W, h: H, seed: 8513, atramenty: 'r',
  draw(k) {
    const ram = doska(k);
    k.clip(ram, () => {
      krizom(k, k.rect(34, 22, W - 68, H - 44), 0.34, 3.2);
      /* recnik a breviar so zlatymi rohmi (r. 8517) */
      const pult = k.poly([250, 336, 270, 250, 370, 250, 390, 336]);
      k.fill(R(0.2), pult); sraf(k, pult, 0.6, 90, 2.6); obrys(k, pult);
      const doska2 = k.poly([200, 250, 440, 250, 470, 210, 170, 210]);
      k.fill(R(0.3), doska2); obrys(k, doska2);
      const kniha = k.poly([200, 208, 316, 190, 320, 70, 204, 88]);
      const kniha2 = k.poly([324, 190, 440, 208, 436, 88, 320, 70]);
      for (const p of [kniha, kniha2]) { k.cut(p, 1); k.fill(R(0.04), p); obrys(k, p, 1.1); }
      /* goticke riadky */
      for (let i = 0; i < 11; i++) {
        k.stroke(R(0.7), k.poly([214, 102 + i * 8.6 - i * 0.8, 306, 90 + i * 8.6], true), 1.6);
        k.stroke(R(0.7), k.poly([334, 90 + i * 8.6, 426, 102 + i * 8.6 - i * 0.8], true), 1.6);
      }
      k.fill(R(0.9), k.poly([214, 104, 228, 102, 228, 122, 214, 124]));
      /* zlate rohy */
      for (const [x, y] of [[204, 88], [200, 208], [440, 208], [436, 88]]) k.fill(R(0.8), k.circ(x, y, 8));
      k.fill(R(0.9), k.rect(318, 70, 8, 122));
      /* zazltnuty list ako zalozka */
      k.fill(R(0.2), k.poly([370, 70, 386, 70, 390, 40, 372, 44]));
      obrys(k, k.poly([370, 70, 386, 70, 390, 40, 372, 44]), 0.8);
    });
    k.text(R(0.9), 'VI', W / 2, H - 4, '600 12px Georgia, serif');
  },
};

/* Rim 1807: Fariova pracovna, tma o siestej, sviecka a dohasinajuce uhliky (r. 8613 az 8623). */
const tablo1807 = {
  w: W, h: H, seed: 8598, atramenty: 'ry',
  draw(k) {
    const ram = doska(k);
    k.clip(ram, () => {
      k.fill({ r: 0.5, y: 0.1 }, k.rect(34, 22, W - 68, H - 44));
      krizom(k, k.rect(34, 22, W - 68, H - 44), 0.42, 3.2);
      /* posledne svetlo od uhlikov na podlahe a stene */
      k.cut(k.ell(505, 330, 260, 90), k.rad(505, 330, 0, 260, [0, 0.35], [1, 0]));
      k.add({ y: k.rad(505, 330, 0, 260, [0, 0.4], [1, 0]) }, k.ell(505, 330, 260, 90));
      /* krb s dohasinajucimi uhlikmi */
      const krb = k.rect(430, 150, 150, 180);
      k.fill({ r: 0.5, y: 0.1 }, krb); obrys(k, krb);
      const ust = k.P(); ust.moveTo(456, 330); ust.lineTo(456, 220); ust.arc(505, 220, 49, Math.PI, 0); ust.lineTo(554, 330); ust.closePath();
      k.fill({ r: 0.95, y: 0.2 }, ust);
      k.cut(k.ell(505, 318, 60, 26), k.rad(505, 318, 0, 60, [0, 0.8], [1, 0]));
      k.add({ y: k.rad(505, 318, 0, 60, [0, 0.9], [1, 0]), r: k.rad(505, 318, 0, 60, [0, 0.5], [1, 0.2]) }, k.ell(505, 318, 60, 26));
      for (let i = 0; i < 14; i++) k.fill({ y: 0.9, r: 0.7 }, k.circ(k.R(478, 532), k.R(314, 326), k.R(2, 4)));
      k.fill({ r: 0.9, y: 0.3 }, k.rect(420, 140, 170, 12));
      /* hodiny (tvar NAVRH) */
      const hod = k.rect(80, 70, 44, 110);
      k.fill({ r: 0.6, y: 0.2 }, hod); obrys(k, hod);
      k.cut(k.circ(102, 98, 16), 0.7);
      k.addStroke({ r: 0.95 }, k.circ(102, 98, 16), 1);
      k.stroke({ r: 0.95 }, k.poly([102, 98, 102, 86], true), 1.4);
      k.stroke({ r: 0.95 }, k.poly([102, 98, 102, 110], true), 1);
      /* stol s papiermi (palac predany cudzincovi, r. 8600 az 8604) */
      const st = k.rect(140, 236, 240, 12);
      k.fill({ r: 0.8, y: 0.3 }, st); obrys(k, st);
      for (const x of [150, 360]) k.fill({ r: 0.85, y: 0.2 }, k.rect(x, 248, 10, 84));
      for (let i = 0; i < 7; i++) { const x = k.R(170, 340), y = k.R(222, 232); const p = k.poly([x, y, x + 34, y - 3, x + 36, y + 6, x + 2, y + 9]); k.fill({ r: 0.2, y: 0.25 }, p); obrys(k, p, 0.5); }
      /* breviar so zazltnutou zalozkou (r. 8621 az 8623) */
      const br = k.poly([300, 234, 352, 230, 354, 214, 302, 218]);
      k.fill({ r: 0.9, y: 0.4 }, br); obrys(k, br);
      k.fill({ y: 0.8, r: 0.2 }, k.poly([330, 216, 338, 216, 340, 200, 332, 202]));
      /* Faria zaspal nad papiermi, hlavu v dlaniach (NAVRH siluety) */
      silueta(k, 230, 250, 110, { sedi: true, tma: 0.7 });
      /* voskova sviecka zatial nezapalena */
      k.fill({ y: 0.3, r: 0.1 }, k.rect(186, 206, 7, 28));
    });
    k.text({ r: 0.9 }, '1807', W / 2, H - 4, '600 12px Georgia, serif');
  },
};

/* Predtym: tri obrazky (zachvat v noci, kvapky, prebudenie), 200 x 150 kazdy. */
function malyRam(k, w, h) { k.papier(k.rect(0, 0, w, h)); const p = k.rect(6, 6, w - 12, h - 12); return p; }
const predtym1 = {
  w: 200, h: 150, seed: 8105,
  draw(k) {
    const p = malyRam(k, 200, 150);
    k.clip(p, () => {
      k.fill({ b: 0.95, r: 0.5, y: 0.1 }, k.rect(0, 0, 200, 150));
      k.cut(k.rect(130, 24, 22, 28), 0.8);
      k.fill({ b: 0.3 }, k.rect(130, 24, 22, 28));
      k.fill(C.zelezo, k.rect(140, 24, 2, 28));
      k.fill({ y: 0.5, r: 0.3, b: 0.5 }, k.rect(20, 104, 150, 12));
      const t = k.blob([34, 104, 50, 88, 100, 84, 150, 90, 160, 104]);
      k.fill({ y: 0.3, r: 0.3, b: 0.6 }, t);
      k.fill({ b: 0.1, y: 0.05 }, k.ell(46, 90, 10, 8));
    });
  },
};
const predtym2 = {
  w: 200, h: 150, seed: 8123,
  draw(k) {
    const p = malyRam(k, 200, 150);
    k.clip(p, () => {
      k.fill({ b: 0.8, r: 0.4, y: 0.2 }, k.rect(0, 0, 200, 150));
      k.cut(k.circ(100, 70, 60), k.rad(100, 70, 0, 60, [0, 0.7], [1, 0]));
      k.add({ y: k.rad(100, 70, 0, 60, [0, 0.6], [1, 0]) }, k.circ(100, 70, 60));
      const f = k.blob([90, 30, 110, 30, 112, 44, 122, 60, 122, 92, 78, 92, 78, 60, 88, 44]);
      k.fill({ b: 0.25, y: 0.1 }, f);
      k.fill({ r: 0.85, y: 0.3 }, k.poly([80, 70, 120, 70, 122, 92, 78, 92]));
      k.addStroke({ b: 0.8, r: 0.5 }, f, 1);
      for (const [x, y] of [[100, 108], [100, 122]]) k.fill({ r: 0.9, y: 0.3 }, k.blob([x, y - 5, x + 3, y, x, y + 3, x - 3, y]));
    });
  },
};
const predtym3 = {
  w: 200, h: 150, seed: 8170,
  draw(k) {
    const p = malyRam(k, 200, 150);
    k.clip(p, () => {
      k.fill({ b: 0.62, r: 0.3, y: 0.2 }, k.rect(0, 0, 200, 150));
      k.cut(k.rect(0, 0, 200, 150), k.lin(0, 0, 200, 0, [0, 0.7], [0.5, 0.2], [1, 0]));
      k.add({ y: k.lin(0, 0, 200, 0, [0, 0.5], [1, 0]) }, k.rect(0, 0, 200, 150));
      /* profil starca: jedno oko otvorene, polovica tela v tieni */
      const tvar = k.blob([70, 120, 66, 70, 84, 40, 118, 38, 132, 58, 136, 70, 146, 80, 134, 86, 132, 100, 110, 118]);
      k.fill({ y: 0.34, r: 0.24, b: 0.1 }, tvar);
      k.fill({ b: 0.08, y: 0.03 }, k.blob([62, 110, 58, 60, 80, 34, 116, 32, 124, 42, 96, 46, 80, 70, 82, 116]));
      k.fill({ b: 0.95, r: 0.8, y: 0.48 }, k.blob([104, 104, 132, 96, 136, 130, 118, 150, 100, 150]));
      k.fill({ b: 0.5, r: 0.2 }, k.poly([112, 60, 132, 58, 132, 63, 112, 64]));
      k.fill({ b: 1, r: 0.9, y: 0.4 }, k.circ(124, 70, 2.6));
      k.add({ b: 0.5, r: 0.2 }, k.rect(0, 100, 200, 50));
    });
  },
};

/* Titul kapitoly: polospaleny papier s niekolkymi riadkami. */
const titul18 = {
  w: 300, h: 140, seed: 8253, maska: true,
  draw(k) {
    const p = k.blob([10, 20, 120, 12, 196, 18, 212, 40, 196, 60, 220, 84, 200, 104, 214, 124, 120, 130, 16, 126, 8, 70]);
    k.fill(C.plat, p);
    k.fill({ y: 0.5, r: 0.5, b: 0.5 }, k.blob([196, 18, 212, 40, 196, 60, 220, 84, 200, 104, 214, 124, 206, 126, 190, 104, 206, 84, 184, 60, 200, 40, 186, 18]));
    k.add({ y: 0.3, r: 0.2 }, k.blob([160, 16, 196, 18, 212, 40, 196, 60, 220, 84, 200, 104, 214, 124, 170, 128, 180, 70]));
    for (let i = 0; i < 8; i++) {
      const l = 26 + ((i * 37) % 60);
      k.stroke(C.hrdza, k.poly([24, 32 + i * 12, 24 + 150 - l * 0.5, 32 + i * 12], true), 2);
    }
    k.addStroke({ b: 0.7, r: 0.5, y: 0.3 }, p, 0.8);
  },
};

/* Mapa Stredomoria (NAVRH kresby): od Marseille po Monte Cristo. Projekcia:
   x = (dlzka - 3) * 60 + 20, y = (44,6 - sirka) * 85. */
export const MAPA = {
  bod: (lon, lat) => [(lon - 3) * 60 + 20, (44.6 - lat) * 85],
  If: [5.325, 43.28], MonteCristo: [10.31, 42.33],
};
const mapa = {
  w: W, h: H, seed: 1815,
  draw(k) {
    const B = (arr) => arr.flatMap(([a, b]) => MAPA.bod(a, b));
    k.papier(k.rect(0, 0, W, H));
    /* more: jemne vodorovne tahy */
    k.fill({ b: 0.26, y: 0.04 }, k.rect(0, 0, W, H));
    k.hatch({ b: 0.18 }, k.rect(0, 0, W, H), 0, 5, 0.5, { vlna: 1.2 });
    const zem = { y: 0.46, r: 0.18, b: 0.1 };
    const pobrezie = B([[3, 43.3], [4, 43.5], [4.8, 43.4], [5.37, 43.3], [6, 43.1], [6.6, 43.2], [7.3, 43.7], [8, 43.9], [8.9, 44.4], [9.8, 44.1], [10.3, 43.5], [10.5, 43], [11.1, 42.4], [11.8, 42.1], [12.4, 41.7], [13.2, 41.2], [13.2, 44.8], [3, 44.8]]);
    const ostrovy = [
      B([[9.4, 43], [9.5, 42.6], [9.55, 42.1], [9.4, 41.7], [9.2, 41.4], [8.8, 41.6], [8.6, 41.9], [8.6, 42.3], [8.7, 42.6], [9.1, 42.7], [9.35, 43]]),
      B([[9.2, 41.25], [9.6, 41], [9.8, 40.6], [9.7, 40.3], [8.2, 40.3], [8.2, 40.9], [8.5, 41], [9.2, 41.25]]),
      B([[10.1, 42.8], [10.4, 42.85], [10.45, 42.75], [10.2, 42.72]]),
    ];
    /* pobrezne linky ako na starych mapach, potom zem */
    for (const o of [pobrezie, ...ostrovy]) k.addStroke({ b: 0.3 }, k.poly(o), 9);
    for (const o of [pobrezie, ...ostrovy]) { const p = k.poly(o); k.fill(zem, p); k.hatch({ r: 0.2, y: 0.2 }, p, 50, 4, 0.5); k.addStroke({ b: 0.8, r: 0.5, y: 0.3 }, p, 1); }
    const [mx, my] = MAPA.bod(...MAPA.MonteCristo);
    k.fill(zem, k.circ(mx, my, 4.2)); k.addStroke({ b: 0.8, r: 0.5 }, k.circ(mx, my, 4.2), 1);
    const [ix, iy] = MAPA.bod(...MAPA.If);
    k.fill({ b: 0.9, r: 0.6 }, k.circ(ix, iy + 5, 2.4));
    const t = (s, lon, lat, dx, dy, al, it) => { const [x, y] = MAPA.bod(lon, lat); k.text({ b: 0.9, r: 0.7, y: 0.4 }, s, x + dx, y + dy, (it ? 'italic ' : '') + '13px Georgia, serif', al || 'left'); };
    t('Marseilles', 5.37, 43.3, 4, -8, 'left');
    t('Château d’If', 5.325, 43.28, 0, 22, 'center', true);
    t('Elba', 10.3, 42.8, 16, 4);
    t('Piombino', 10.5, 43, 8, -2);
    t('Monte Cristo', 10.31, 42.33, 10, 20, 'left', true);
    t('Corsica', 9.05, 42.2, 0, 0, 'center', true);
    t('Rome', 12.48, 41.9, 0, -10, 'center');
    k.fill({ b: 0.9, r: 0.7 }, k.circ(...MAPA.bod(12.48, 41.9), 2.4));
    k.fill({ b: 0.9, r: 0.7 }, k.circ(...MAPA.bod(5.37, 43.3), 2));
    /* ruzica vetrov */
    const [rx, ry] = [560, 300];
    k.fill({ r: 0.8 }, k.poly([rx, ry - 26, rx + 5, ry, rx, ry + 26, rx - 5, ry]));
    k.fill({ r: 0.5 }, k.poly([rx - 26, ry, rx, ry - 5, rx + 26, ry, rx, ry + 5]));
    k.text({ r: 0.9 }, 'N', rx, ry - 30, '600 11px Georgia, serif', 'center');
  },
};

/* Zaciatok hry: Château d'If na skale za sumraku (NAVRH kompozicie). */
const uvod = {
  w: W, h: H, seed: 172,
  draw(k) {
    k.fill({ b: k.lin(0, 0, 0, 230, [0, 0.9], [0.6, 0.55], [1, 0.3]), r: k.lin(0, 0, 0, 230, [0, 0.4], [1, 0.5]), y: k.lin(0, 0, 0, 230, [0, 0.05], [1, 0.35]) }, k.rect(0, 0, W, 240));
    const [mx, my] = [468, 54];
    k.cut(k.circ(mx, my, 70), k.rad(mx, my, 20, 70, [0, 0.3], [1, 0]));
    k.cut(k.circ(mx, my, 22), 1);
    k.fill({ y: 0.25 }, k.circ(mx, my, 22));
    k.fill({ b: 0.95, r: 0.5, y: 0.12 }, k.rect(0, 232, W, 128));
    k.hatch(null, k.rect(0, 238, W, 122), 0, 6, 0.8, { cut: 0.25, vlna: 1.4 });
    /* mesacna cesta na vode: prerusovane odlesky */
    for (let y = 240; y < 360; y += 6) {
      const sirka = 8 + (y - 240) * 0.5;
      for (let i = 0; i < 3; i++) { const x = mx + k.R(-sirka, sirka); k.cut(k.rect(x, y, k.R(6, 16 + (y - 240) * 0.1), 1.6), 0.7); k.add({ y: 0.4 }, k.rect(x, y, 10, 1.6)); }
    }
    /* skala a pevnost (NAVRH kompozicie) */
    const X = 176;
    const skala = k.blob([150 + X, 244, 180 + X, 212, 230 + X, 196, 300 + X, 190, 360 + X, 200, 410 + X, 222, 440 + X, 246, 300 + X, 252]);
    k.fill({ b: 0.95, r: 0.72, y: 0.4 }, skala);
    const h = { b: 0.9, r: 0.7, y: 0.36 };
    k.fill(h, k.rect(200 + X, 150, 180, 52));
    k.fill(h, k.rect(250 + X, 104, 60, 60));
    k.fill(h, k.rect(318 + X, 124, 40, 40));
    for (let x = 200; x < 380; x += 12) k.fill(h, k.rect(x + X, 144, 7, 7));
    for (let x = 250; x < 310; x += 12) k.fill(h, k.rect(x + X, 98, 7, 7));
    k.fill({ y: 0.9, r: 0.4 }, k.rect(274 + X, 124, 5, 8));
    k.add({ b: 0.3 }, k.rect(200 + X, 150, 60, 52));
  },
};

export const TABLA = {
  'tablo:1': tablo1, 'tablo:2': tablo2, 'tablo:3': tablo3, 'tablo:4': tablo4, 'tablo:5': tablo5, 'tablo:5b': tablo5b, 'tablo:6': tablo6,
  'tablo:1807': tablo1807, 'predtym:1': predtym1, 'predtym:2': predtym2, 'predtym:3': predtym3, 'titul:18': titul18, mapa, uvod,
};
void murivo;
