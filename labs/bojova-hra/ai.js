// Tumble Dojo: súper. Vidí len to, čo hráč, reaguje najskôr po 160 ms, pred výpadom sa nadýchne,
// kombinácie skúša tými istými vstupmi ako človek; šum zo semienka.
import { C, HZ, I, CH, LU, LR, BI, BR, BRR, SI, SS, SR, ST, OUT, TAP, GI, GH, GR, HD, BP, SPI, SPR, vstup, rng } from './sim.js';
import { O, PB, CO, FE, FL, TH, DP, RP, GW, PT, BL, ET, OTVARA } from './kombo.js';

const VSETKY = [PB, CO, FE, FL, TH, DP, RP, GW, PT, BL, ET];
export const mnozina = (z) => { const m = new Uint8Array(13); for (const k of z) m[k] = 1; return m; };
export const UROVNE = {
  easy: { rMin: 0.40, rMax: 0.40, nadych: 0.30, spravne: 0.36, cakMin: 0.2, cakMax: 0.5, bok: 0.2, chmat: 0.9, kombo: 0, jit: 0, set: mnozina([]), dup: false, max2: false, zapri: 0.3 },
  normal: { rMin: 0.24, rMax: 0.24, nadych: 0.17, spravne: 0.6, cakMin: 0.3, cakMax: 0.75, bok: 0.3, chmat: 0.65, kombo: 0.35, jit: 0.045, set: mnozina([PB, CO, FE, FL, DP, RP, TH]), dup: false, max2: true, zapri: 0.4 },
  hard: { rMin: 0.20, rMax: 0.20, nadych: 0.13, spravne: 0.60, cakMin: 0.15, cakMax: 0.5, bok: 0.2, chmat: 0.7, kombo: 0.55, jit: 0.020, set: mnozina(VSETKY), dup: true, max2: false, zapri: 0.3 }
};
// hráčsky bot pre simuláciu
export const BOT = { rMin: 0.18, rMax: 0.35, nadych: 0.12, spravne: 0.7, cakMin: 0.25, cakMax: 0.8, bok: 0.25, chmat: 0.5, kombo: 0.4, jit: 0.030, set: mnozina(VSETKY), dup: true, max2: false, zapri: 0.2 };
// nováčik a špecialista: test-pomoc.mjs
const skusET = (ai) => (ai.par.etSanca ? ai.par.set[ET] === 1 && ai.r() < ai.par.etSanca : chce(ai, ET));

const NPL = 12, H1 = 1, H0 = 2, B1 = 3, B0 = 4, BOK = 5, CHM = 6, DUP = 7, CHOD = 8;
const F_FLANK = 1, F_FINTA = 2;
export function novaAI(p, par, seed) {
  return { p, par, r: rng(seed), os: -1, ul: 0, at: 0, oCh: 0, hold: false, brace: false, walk: 0, side: 0, grab: false, stomp: false,
    next: 0, otv: 0, pt: new Int32Array(NPL).fill(-1), pc: new Int8Array(NPL), pv: new Int8Array(NPL), mst: -1, mlh: false, zam: 0, blizko: false, kUsed: new Uint8Array(13), evN: 0 };
}
// prvá iniciatíva po štarte kola je náhodná (Hare vyráža skôr)
export function zacniKolo(ai) {
  ai.otv = 0; ai.os = -1; ai.ul = 0; ai.hold = ai.brace = false; ai.walk = 0; ai.pt.fill(-1); ai.zam = 0; ai.mst = -1; ai.mlh = false;
  ai.next = ai.par.start ? kroky(ai, 0.1, ai.par.start) : kroky(ai, 0.4, 1.4);
}
const kroky = (ai, a, b) => Math.round((a + ai.r() * (b - a)) * HZ);
const jit = (ai) => Math.round((ai.r() * 2 - 1) * ai.par.jit * HZ);
function reakcia(ai) { const k = kroky(ai, ai.par.rMin, ai.par.rMax); return k < 20 ? 20 : k; }   // nikdy pod 160 ms
const pauza = (ai, s) => { const k = kroky(ai, ai.par.cakMin, ai.par.cakMax); ai.next = s.step + (s.step > 15 * HZ ? k >> 1 : k); };
function chce(ai, k) {
  const P = ai.par;
  return P.set[k] === 1 && P.kombo > 0 && ai.r() < P.kombo && !(P.max2 && ai.kUsed[k] >= 2);
}
function plan(ai, at, c, v) { for (let i = 0; i < NPL; i++) if (ai.pt[i] < 0) { ai.pt[i] = at; ai.pc[i] = c; ai.pv[i] = v; return; } }
function zrus(ai) { ai.pt.fill(-1); ai.zam = 0; }
function plany(ai) { for (let i = 0; i < NPL; i++) if (ai.pt[i] >= 0) return true; return false; }
function vykonaj(ai, n) {
  for (let i = 0; i < NPL; i++) {
    if (ai.pt[i] < 0 || ai.pt[i] > n) continue;
    const v = ai.pv[i];
    switch (ai.pc[i]) {
      case H1: ai.hold = true; break;
      case H0: ai.hold = false; break;
      case B1: ai.brace = true; break;
      case B0: ai.brace = false; break;
      case BOK: ai.side = v; break;
      case CHM: ai.grab = true; break;
      case DUP: ai.stomp = true; break;
      case CHOD: ai.walk = v; break;
    }
    ai.pt[i] = -1;
  }
}
const vzdial = (m, o) => { const dx = o.x - m.x, dy = o.y - m.y; return Math.sqrt(dx * dx + dy * dy); };
const priKraji = (s, m, k) => m.x * m.x + m.y * m.y > (s.rr - k) * (s.rr - k);
// o koľko krokov narazí letiaci výpad súpera; -1 ak nejde k nám
function doDotyku(me, o) {
  const dx = me.x - o.x, dy = me.y - o.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
  const v = ((o.vx - me.vx) * dx + (o.vy - me.vy) * dy) / d;
  if (v < 0.2) return -1;
  const gap = d - 2 * C.R;
  return gap <= 0 ? 0 : Math.round(gap / v * HZ);
}
// odhad dotyku nabíjajúceho súpera, ak pustí o `za` krokov
function odhadDotyku(me, o, za) {
  const ch = Math.min(C.CH1, o.ch + za), v = C.V0 + (C.V1 - C.V0) * (Math.max(ch, C.CH0) - C.CH0) / (C.CH1 - C.CH0);
  const gap = vzdial(me, o) - 2 * C.R;
  return za + Math.round((gap > 0 ? gap : 0) / v * HZ);
}
// smer úkroku, po ktorom súper skončí bližšie k okraju
function stranaHodu(me, o) {
  let dx = o.x - me.x, dy = o.y - me.y; const d = Math.sqrt(dx * dx + dy * dy) || 1; dx /= d; dy /= d;
  const px = -dy, py = dx, ax = me.x + px, ay = me.y + py, bx = me.x - px, by = me.y - py;
  const plus = ax * ax + ay * ay >= bx * bx + by * by;
  const sx = px > 1e-9 ? 1 : px < -1e-9 ? -1 : (py > 0 ? 1 : -1);
  return plus ? sx : -sx;
}
function stranaKStredu(me, o) { return -stranaHodu(me, o); }
// výpad tlačí 0,25 s rýchlosťou v0
function nabi(ai, s, me, o, rychlo, extra) {
  const gap = vzdial(me, o) - 2 * C.R;
  const treba = (gap + 0.05) / 0.25, ch0 = rychlo ? C.V0 : C.V0 + ai.r() * (C.V1 - C.V0), v = treba > ch0 ? treba : ch0;
  const min = Math.max(C.CH0, Math.round(ai.par.nadych * HZ));
  let ch = C.CH0 + (v - C.V0) / (C.V1 - C.V0) * (C.CH1 - C.CH0);
  ch = ch < min ? min : ch > C.CH1 ? C.CH1 : ch;
  let od = s.step;
  if (me.st === BI || me.st === BR) { ai.brace = false; od += C.BREC + 1; }
  ai.hold = true; plan(ai, od + Math.round(ch) + 1 + (extra || 0), H0, 0);
}
function stlac(ai, at) { plan(ai, at, H1, 0); plan(ai, at + 3, H0, 0); }

function pocitajKomba(ai, s) {
  while (ai.evN < s.evN) {
    if (s.evN - ai.evN > 64) ai.evN = s.evN - 64;
    const i = (ai.evN & 63) * 3;
    if (s.ev[i + 1] === ai.p) { ai.kUsed[s.ev[i]]++; if (OTVARA[s.ev[i]] && ai.r() < ai.par.spravne + 0.3) ai.otv = s.step; }
    ai.evN++;
  }
}

// obrana proti letiacemu výpadu, ktorý narazí o c krokov
function obranaLet(ai, s, me, o, c) {
  const n = s.step, P = ai.par;
  if (priKraji(s, me, 0.3) && skusET(ai) && c >= 1) { plan(ai, n + c + 3 + Math.abs(jit(ai)), BOK, stranaKStredu(me, o)); return; }
  // Hedgehog: proti letiacemu výpadu sa zaprie vždy
  if (P.vzdyZapri && c >= 2) { ai.brace = true; plan(ai, n + c + 40, B0, 0); return; }
  if (c < 7) return;
  // Otter: úkrok namiesto odpovede
  if (P.uhyb && ai.r() < P.uhyb) { ai.side = stranaKStredu(me, o); return; }
  if (ai.r() >= P.spravne) return;
  if (priKraji(s, me, 0.32) || ai.r() < P.bok * 0.5) { ai.side = stranaKStredu(me, o); return; }
  if (chce(ai, PT)) { plan(ai, n + Math.max(0, c - 6 + jit(ai)), CHM, 0); return; }
  if (!priKraji(s, me, 0.45) && chce(ai, GW)) { ai.walk = 2; plan(ai, n + Math.max(0, c - 18 + jit(ai)), B1, 0); plan(ai, n + c + 30, B0, 0); plan(ai, n + c + 2, CHOD, 0); return; }
  ai.brace = true; plan(ai, n + c + 40, B0, 0);
  if (chce(ai, CO)) stlac(ai, n + Math.max(0, c - 3 + jit(ai)));
}

function reaguj(ai, s, me, o, u) {
  const P = ai.par, n = s.step, volny = me.st === I || me.st === CH || me.st === TAP, zap = me.st === BR || me.st === BI;
  if (u === 1 && o.st === CH) {                         // súper nabíja
    // Crane pri povraze čaká na tlak a otočí sa
    if (P.etSanca && volny && priKraji(s, me, 0.3) && skusET(ai)) {
      const za = o.runN > 30 ? C.CH1 - o.ch : kroky(ai, 0.15, 0.4) - (n - ai.oCh);   // kto sa rozbieha, pustí pri plnom nabití
      plan(ai, n + odhadDotyku(me, o, za > 0 ? za : 0) + 3 + Math.abs(jit(ai)), BOK, stranaKStredu(me, o)); return;
    }
    if ((volny || zap) && ai.r() < P.zapri) { if (me.st === CH) zrus(ai); ai.hold = false; ai.brace = true; return; }
    if (ai.r() < P.spravne) {
      if (me.st === CH) { ai.hold = false; zrus(ai); }
      const za = kroky(ai, 0.15, 0.4) - (n - ai.oCh), zaK = za > 0 ? za : 0, c = odhadDotyku(me, o, zaK);
      if (priKraji(s, me, 0.3) || ai.r() < P.bok) { plan(ai, n + zaK, BOK, stranaKStredu(me, o)); pauza(ai, s); return; }
      if (chce(ai, PT)) { plan(ai, n + Math.max(0, c - 6 + jit(ai)), CHM, 0); return; }
      if (!priKraji(s, me, 0.45) && chce(ai, GW)) { plan(ai, n + Math.max(0, c - 16 + jit(ai)), CHOD, 2); plan(ai, n + Math.max(0, c - 15 + jit(ai)), B1, 0); plan(ai, n + c + 30, B0, 0); plan(ai, n + c + 2, CHOD, 0); return; }
      if (ai.r() < 0.5 || chce(ai, PB)) plan(ai, n + Math.max(0, c - 12 + jit(ai)), B1, 0); else ai.brace = true;
      plan(ai, n + c + 45, B0, 0);
      if (chce(ai, CO)) stlac(ai, n + Math.max(0, c - 3 + jit(ai)));
    } else if (ai.r() < 0.5 && !ai.hold && volny) nabi(ai, s, me, o, true, 0);
  } else if (u === 4 && o.st === LU && !o.lh) {         // súper letí
    if (ai.brace || plany(ai)) return;
    const c = doDotyku(me, o);
    if (c >= 0 && (volny || zap)) obranaLet(ai, s, me, o, c);
  } else if (u === 2 && (o.st === BI || o.st === BR)) { // súper zapiera
    if (me.st === CH && me.ch >= O.FE_MIN - 2 && chce(ai, FE)) { ai.side = ai.r() < 0.5 ? 1 : -1; ai.zam = F_FINTA; zrus(ai); ai.zam = F_FINTA; return; }
    if (!volny || ai.hold) return;
    const gap = vzdial(me, o) - 2 * C.R;
    if (gap < 0.1 && ai.r() < P.chmat + 0.2) { ai.grab = true; pauza(ai, s); return; }
    if (ai.r() < P.spravne) {
      ai.side = ai.r() < 0.5 ? 1 : -1;
      ai.zam = chce(ai, FL) ? F_FLANK : 0;
      pauza(ai, s);
    } else if (ai.r() < 0.4) nabi(ai, s, me, o, false, 0);
    else pauza(ai, s);
  } else if (u === 3 && (o.st === ST || o.st === LR || o.st === GR || o.st === SPR) && (volny || zap) && !ai.hold && ai.r() < P.spravne + 0.3) {
    zrus(ai); nabi(ai, s, me, o, true, 0);             // súper je vychýlený: trestať
  } else if (u === 5 && o.st === GI && volny && ai.r() < P.spravne) {
    ai.side = stranaKStredu(me, o);                    // chmat do prázdna
  } else if (u === 6 && o.st === SPI && (volny || zap) && ai.r() < P.spravne) {
    const zost = O.SP_IN - o.t;
    if (zost > 9) { ai.brace = true; plan(ai, n + zost + 20, B0, 0); } else ai.side = stranaKStredu(me, o);
  } else if (u === 7 && o.st === BP && me.st === HD) {
    ai.brace = true; plan(ai, n + O.BL_DUR, B0, 0);    // za pás: zaprieť sa
  } else if (u === 8 && (P.etSanca || ai.r() < P.spravne) && skusET(ai) && priKraji(s, me, O.ET_EDGE) && vzdial(me, o) < 2 * C.R + 0.03) {
    ai.side = stranaKStredu(me, o);                    // tlačia ma na povraz: otočka
  } else if (u === 9 && volny && !ai.hold && !plany(ai) && ai.r() < P.spravne) {
    const gap = vzdial(me, o) - 2 * C.R;               // súper prichádza na dosah chmatu
    if (gap < 0.045 && ai.r() < P.chmat) ai.grab = true;
    else if (ai.r() < 0.5) nabi(ai, s, me, o, true, 0);
    else ai.side = stranaKStredu(me, o);
    pauza(ai, s);
  }
}

// vlastné telo (bez reakčného času)
function prechod(ai, s, me, o) {
  const n = s.step;
  if (me.st === ST) { zrus(ai); ai.hold = ai.brace = false; ai.walk = 0; return; }
  if (me.st === GH) {
    const von = me.fx * o.x + me.fy * o.y > 0;         // súper stojí medzi mnou a okrajom
    if (von && chce(ai, BL)) stlac(ai, n + Math.max(1, 8 + jit(ai)));
    else if (chce(ai, TH)) plan(ai, n + Math.max(1, 8 + jit(ai)), BOK, stranaHodu(me, o));
    else if (chce(ai, BL)) stlac(ai, n + Math.max(1, 8 + jit(ai)));
    else { plan(ai, n + C.GHOLD - 2, H1, 0); plan(ai, n + C.GHOLD + 18, H0, 0); }   // po pustení hneď výpad
    return;
  }
  if (me.st === HD) { zrus(ai); ai.hold = ai.brace = false; if (ai.r() < ai.par.spravne) plan(ai, n + Math.max(C.GESC, reakcia(ai)), BOK, stranaKStredu(me, o)); return; }
  if (me.st === SR) {
    if (ai.zam === F_FLANK) stlac(ai, n);
    else if (ai.zam === F_FINTA) ai.hold = false;
    ai.zam = 0;
  }
}

function iniciativa(ai, s, me, o) {
  const P = ai.par, n = s.step, d = vzdial(me, o), gap = d - 2 * C.R;
  if (P.dup && me.sila >= O.SILA && d < O.SP_R - 0.1 && o.st !== BR && o.st !== BI && o.st !== SI && o.st !== SS) { ai.stomp = true; pauza(ai, s); return; }
  // súper stojí zapretý: obísť ho
  if ((o.st === BR || o.st === BI) && gap < 0.3 && chce(ai, FL)) { ai.side = ai.r() < 0.5 ? 1 : -1; ai.zam = F_FLANK; pauza(ai, s); return; }
  if (priKraji(s, me, P.lano ? 0.12 : 0.3)) { ai.walk = 3; plan(ai, n + kroky(ai, 0.25, 0.45), CHOD, 0); ai.next = n + 30; return; }
  // Crane: cúva k povrazu a čaká tam na tlak
  if (P.lano && !priKraji(s, me, 0.3) && ai.r() < P.lano) { ai.walk = 2; plan(ai, n + kroky(ai, 0.3, 0.6), CHOD, 0); ai.next = n + 40; return; }
  // Otter: kĺže sa do strany namiesto útoku
  if (P.uhyb && gap < 0.24 && ai.r() < P.uhyb * 0.5) { ai.side = ai.r() < 0.5 ? 1 : -1; pauza(ai, s); return; }
  if (gap > 0.24 && ai.r() < 0.7) {
    if (chce(ai, RP)) {                                 // rozbeh: chôdza k súperovi, potom výpad v pohybe
      ai.walk = 1; const t = n + 4 + kroky(ai, 0, 0.1), r = t + Math.max(O.RP_WALK, C.CH1) + 3;
      plan(ai, t, H1, 0); plan(ai, r, H0, 0); plan(ai, r + 4, CHOD, 0);
      ai.next = r + 10; return;
    }
    ai.walk = 1; plan(ai, n + kroky(ai, 0.15, 0.4), CHOD, 0); ai.next = n + 20; return;
  }
  if (gap < 0.16 && ai.r() < P.chmat) {                // dôjsť na dosah a chytiť za pás
    if (gap < 0.045) ai.grab = true; else { ai.walk = 1; const t = n + Math.round((gap - 0.03) / C.WV * HZ) + 4; plan(ai, t, CHM, 0); plan(ai, t, CHOD, 0); }
    pauza(ai, s); return;
  }
  nabi(ai, s, me, o, !!P.rychly, P.navnada ? kroky(ai, 0.2, P.navnada) : 0); pauza(ai, s);   // Magpie drží nabitie dlhšie (návnada)
}

function smer(ai, s, me, o) {
  const w = ai.walk;
  if (!w) return;
  let dx, dy;
  if (w === 3) { dx = -me.x; dy = -me.y; }
  else { dx = o.x - me.x; dy = o.y - me.y; if (w === 2) { dx = -dx; dy = -dy; } }
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-6) { JX = JY = 0; return; }
  dx /= d; dy /= d;
  if (w !== 3 && priKraji(s, me, 0.12) && dx * me.x + dy * me.y > 0) { JX = JY = 0; return; }   // nevyjsť z ringu chôdzou
  JX = Math.round(dx * 127); JY = Math.round(dy * 127);
}
let JX = 0, JY = 0;

export function aiKrok(ai, s) {
  const me = ai.p ? s.b : s.a, o = ai.p ? s.a : s.b, n = s.step;
  if (s.win >= 0 || me.st === OUT) { vstup(s, ai.p, false, false, 0, false, false, 0, 0); return; }
  ai.side = 0; ai.grab = false; ai.stomp = false;
  pocitajKomba(ai, s);
  vykonaj(ai, n);
  if (me.st !== ai.mst) { ai.mst = me.st; prechod(ai, s, me, o); }
  // K6: vlastný výpad sa dotkol, hneď druhý
  const lh = me.st === LU && me.lh;
  if (lh && !ai.mlh && chce(ai, DP)) { zrus(ai); ai.hold = false; stlac(ai, n + Math.max(1, 5 + jit(ai))); }
  ai.mlh = lh;
  // čo súper začal robiť, spracuje až po reakčnom čase
  if (o.st !== ai.os) {
    ai.os = o.st;
    const st = o.st;
    const u = st === CH ? 1 : st === BI ? 2 : st === ST || st === LR || st === GR || st === SPR ? 3 : st === LU ? 4 : st === GI ? 5 : st === SPI ? 6 : st === BP ? 7 : 0;
    if (u) { ai.ul = u; ai.at = n + reakcia(ai); if (u === 1) ai.oCh = n; }
  }
  // tlačia ma pri okraji
  if (!ai.ul && me.edgeAt === n - 1 && (me.st === I || me.st === ST || me.st === BR) && ai.par.set[ET]) { ai.ul = 8; ai.at = n + reakcia(ai); }
  // súper kráča na dosah chmatu, raz za priblíženie
  const gp = vzdial(me, o) - 2 * C.R;
  if (gp > 0.2) ai.blizko = false;
  else if (!ai.blizko && !ai.ul && gp < 0.14 && (o.wx * (me.x - o.x) + o.wy * (me.y - o.y)) > 0.1 * (gp + 2 * C.R)) { ai.blizko = true; ai.ul = 9; ai.at = n + reakcia(ai); }
  if (ai.ul && n >= ai.at) { const u = ai.ul; ai.ul = 0; reaguj(ai, s, me, o, u); }
  // vlastná kombinácia otvorila súpera: hneď krátky výpad (COMBO FINISH)
  if (ai.otv && n - ai.otv < O.OP_DUR && o.opU >= n && (me.st === I || me.st === TAP || me.st === BR || me.st === BRR) && !ai.hold) {
    ai.otv = 0; zrus(ai); ai.brace = false; ai.walk = 1; nabi(ai, s, me, o, true, 0);
  } else if (ai.otv && n - ai.otv >= O.OP_DUR) ai.otv = 0;
  if (!plany(ai) && !ai.hold && !ai.brace && !ai.zam && me.st === I && n >= ai.next) iniciativa(ai, s, me, o);
  if (ai.brace && !plany(ai) && o.st !== CH && o.st !== LU && o.st !== BP && me.st === BR && me.t > 30) ai.brace = false;
  JX = JY = 0; smer(ai, s, me, o);
  vstup(s, ai.p, ai.hold, ai.brace, ai.side, ai.grab, ai.stomp, JX, JY);
}
