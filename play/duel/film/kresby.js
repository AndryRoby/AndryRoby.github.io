// Duel film: kresliace pomôcky podľa skutočnej appky (products/duel-android).
// Farby sú tokeny Ui.kt a téma dosky Night z Draw.kt, ikony sú prepis IconSpec z Icons.kt (tá istá
// mriežka 48 x 48, ťah 4 a 2, zaoblené konce), písmo Nunito z appky (OFL, podmnožina Latin vo woff2).
// Všetko statické sa kreslí raz do spritov; per snímka ostanú len drawImage a pár ťahov.

import { platno, pismo, zaoblene, zalom } from './engine/kresba.js';
import { vyvazZalom } from './engine/hak.js';

export const RODINA = '"Nunito Duel", system-ui, sans-serif';
export const nun = (vaha, px) => pismo(vaha, px, RODINA);

/** Ui.kt:12-28 (chróm) a Draw.kt:29 (téma night, doska). */
export const FARBA = {
  bg: '#101116', surface: '#1B1D27', surface2: '#272A38', outline: '#3A3E52',
  text: '#FFF6E5', textMuted: '#B8B5C8', accent: '#FFD23F', onAccent: '#1A1400',
  good: '#3DDC97', bad: '#FF5C7A',
  p1: '#FF9F1C', onP1: '#1F1300', p2: '#3DA5FF', onP2: '#00172E',
  // téma night: panel, paper, accent (Ink.GREEN), warm, cool; Ink.PURPLE a Ink.WHITE sú pevné
  panel: '#1C1E2A', paper: '#FFF6E5', green: '#3DDC97', warm: '#FFD23F', cool: '#7CC4FF', purple: '#B79CFF', white: '#FFFFFF',
  // rodiny (Ui.kt Families.ink): REFLEX a VISUAL
  reflex: '#FF5C7A', visual: '#3DDC97',
};

/** '#RRGGBB' + alfa -> 'rgba(...)'. */
export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Načíta Nunito z priečinka filmu (FontFace, CSP font-src 'self'). */
export async function nacitajPisma(zaklad) {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return;
  const rezy = [['nunito-regular.woff2', '400'], ['nunito-semibold.woff2', '600'], ['nunito-bold.woff2', '700'], ['nunito-bold.woff2', '800']];
  await Promise.all(rezy.map(async ([f, vaha]) => {
    const ff = new FontFace('Nunito Duel', `url(${new URL(f, zaklad).href})`, { weight: vaha });
    await ff.load();
    document.fonts.add(ff);
  })).catch(() => {});
}

// ---------- ikony (Icons.kt) ----------

/** IconArt z Icons.kt, len tie, ktoré film kreslí. Zápis je presne ten z appky. */
export const IKONY = {
  light: 'R 8,12 32,24 r5 s b; R 13,17 22,14 r2 f a; L 24,3 24,7 t a; L 11,5 13,8.5 t a; L 37,5 35,8.5 t a; L 24,36 24,42 t b; L 18,42 30,42 s b',
  oddone: 'L 7,14 21,14 s b; PL 16,9 21,14 16,19 s b; L 27,14 41,14 s b; PL 36,9 41,14 36,19 s b; L 7,34 21,34 s b; PL 16,29 21,34 16,39 s b; L 34,41 34,27 s a; PL 29,32 34,27 39,32 s a',
  bigger: 'C 18,24 14 f a; PL 12,24 17,29 25,19 s b; C 38,33 6 s b',
  playerOne: 'C 24,24 20 f',
  playerTwo: 'PG 24,4 44,24 24,44 4,24 f',
  rematch: 'A 24,24 15 30 300 s; PL 37,16 37,24 45,24 t',
};

const rozobrane = new Map();
function rozober(zdroj) {
  if (rozobrane.has(zdroj)) return rozobrane.get(zdroj);
  const ops = zdroj.split(';').map((s) => s.trim()).filter(Boolean).map((text) => {
    const casti = text.split(/[ ,]+/).filter(Boolean);
    let druh = casti[0], vypln = 'STROKE', akcent = false;
    const v = [];
    for (const c of casti.slice(1)) {
      if (c === 'f') vypln = 'FILL';
      else if (c === 's') vypln = 'STROKE';
      else if (c === 't') vypln = 'THIN';
      else if (c === 'a') akcent = true;
      else if (c === 'b') akcent = false;
      else if (c[0] === 'r' && c.length > 1) v.push(Number(c.slice(1)));
      else v.push(Number(c));
    }
    if (druh === 'L') druh = 'PL';
    return { druh, v, vypln, akcent };
  });
  rozobrane.set(zdroj, ops);
  return ops;
}

/** DrawScope.icon z Icons.kt: mierka = šírka / 48, ťah 4 alebo 2, zaoblené konce a spoje. */
export function ikona(x, zdroj, bx, by, velkost, zaklad, akcent = zaklad) {
  const m = velkost / 48;
  x.save();
  x.lineCap = 'round'; x.lineJoin = 'round';
  for (const op of rozober(zdroj)) {
    const farba = op.akcent ? akcent : zaklad;
    const v = op.v;
    x.lineWidth = (op.vypln === 'THIN' ? 2 : 4) * m;
    x.fillStyle = farba; x.strokeStyle = farba;
    const X = (q) => bx + q * m, Y = (q) => by + q * m;
    x.beginPath();
    if (op.druh === 'PL' || op.druh === 'PG') {
      for (let i = 0; i + 1 < v.length; i += 2) (i === 0 ? x.moveTo(X(v[0]), Y(v[1])) : x.lineTo(X(v[i]), Y(v[i + 1])));
      if (op.druh === 'PG') x.closePath();
    } else if (op.druh === 'C') {
      x.arc(X(v[0]), Y(v[1]), v[2] * m, 0, Math.PI * 2);
    } else if (op.druh === 'O') {
      x.ellipse(X(v[0]), Y(v[1]), v[2] * m, v[3] * m, 0, 0, Math.PI * 2);
    } else if (op.druh === 'A') {
      const a0 = (v[3] * Math.PI) / 180, a1 = ((v[3] + v[4]) * Math.PI) / 180;
      x.arc(X(v[0]), Y(v[1]), v[2] * m, a0, a1, v[4] < 0);
    } else if (op.druh === 'R') {
      zaoblene(x, X(v[0]), Y(v[1]), v[2] * m, v[3] * m, (v[4] || 0) * m);
    }
    if (op.vypln === 'FILL') x.fill(); else x.stroke();
  }
  x.restore();
}

// ---------- sprity ----------

/** Sprite v pixeloch zariadenia; w, h v logických bodoch. */
export function sprite(dpr, w, h, kresli) {
  const c = platno(Math.ceil(w * dpr), Math.ceil(h * dpr)), x = c.getContext('2d');
  x.scale(dpr, dpr);
  kresli(x);
  return { c, w, h };
}

/**
 * Riadok alebo odsek textu v Nunito ako sprite, vyvážene zalomený do šírky w (najviac maxRiadkov).
 * Písmo sa nikdy nezmenší pod minPx: ak sa text nezmestí, pribudne riadok (appka zalamuje tiež).
 */
export function spriteTextu(dpr, text, px, w, { vaha = 700, farba = FARBA.text, zarovnanie = 'center', riadkovanie = 1.22, maxRiadkov = 2, minPx = 0 } = {}) {
  const m = platno(4, 4).getContext('2d');
  let vel = px;
  m.font = nun(vaha, vel);
  let riadky = vyvazZalom(m, text, w);
  while (riadky.length > maxRiadkov && vel * 0.95 >= minPx) { vel *= 0.95; m.font = nun(vaha, vel); riadky = vyvazZalom(m, text, w); }
  const lh = vel * riadkovanie;
  let sirka = 0;
  for (const r of riadky) sirka = Math.max(sirka, m.measureText(r).width);
  const x0 = zarovnanie === 'center' ? w / 2 : zarovnanie === 'right' ? w : 0;
  const s = sprite(dpr, w, lh * (riadky.length - 1) + vel * 1.3, (x) => {
    x.font = nun(vaha, vel); x.textBaseline = 'top'; x.textAlign = zarovnanie; x.fillStyle = farba;
    riadky.forEach((r, i) => x.fillText(r, x0, i * lh + vel * 0.08));
  });
  s.px = vel; s.riadky = riadky.length; s.textW = sirka;
  return s;
}

/** Text s farebnými slovami: casti = [['text'], ['slovo', farba], ...], vyvážene zalomený. */
export function spriteFarebny(dpr, casti, px, w, { vaha = 700, farba = FARBA.text, zarovnanie = 'center', riadkovanie = 1.25 } = {}) {
  const m = platno(4, 4).getContext('2d');
  m.font = nun(vaha, px);
  const cely = casti.map((a) => a[0]).join('');
  const riadky = vyvazZalom(m, cely, w);
  const lh = px * riadkovanie;
  const farbaZnaku = [];
  casti.forEach(([txt, f]) => { for (const _ of txt) farbaZnaku.push(f || farba); });
  return sprite(dpr, w, lh * riadky.length + px * 0.35, (x) => {
    x.font = nun(vaha, px); x.textBaseline = 'top'; x.textAlign = 'left';
    let idx = 0;
    riadky.forEach((riadok, ri) => {
      const sirka = x.measureText(riadok).width;
      let cx = zarovnanie === 'center' ? (w - sirka) / 2 : 0;
      // po úsekoch rovnakej farby (menej volaní, bez rozostupu po znakoch)
      let usek = '', f0 = null;
      const vypis = () => { if (!usek) return; x.fillStyle = f0; x.fillText(usek, cx, ri * lh + px * 0.08); cx += x.measureText(usek).width; usek = ''; };
      for (const ch of riadok) {
        while (idx < cely.length && cely[idx] !== ch) idx++;
        const f = farbaZnaku[idx] || farba;
        if (f !== f0) { vypis(); f0 = f; }
        usek += ch; idx++;
      }
      vypis();
    });
  });
}

// ---------- palec ----------

/**
 * Palec pri pohľade zhora ako sprite (logické jednotky = dp obrazovky telefónu, sprite v px).
 * Hrot smeruje nahor; bod dotyku je sprite.hrot. Tieň je zapečený, per snímka žiadne rozmazanie.
 * ton: 'svetly' (hráč Orange) alebo 'tmavy' (hráč Blue), dve rôzne ruky.
 */
export function spritePalca(pxNaDp, ton) {
  const T = ton === 'tmavy'
    ? { kraj: '#8a573b', stred: '#b77d5a', svetlo: '#c9926d', obrys: 'rgba(70,36,20,0.5)', necht: ['#e7c4ad', '#cf9f86'], tien: 'rgba(0,0,0,0.42)' }
    : { kraj: '#d29a78', stred: '#f1c7aa', svetlo: '#f7d8c2', obrys: 'rgba(140,84,58,0.45)', necht: ['#fbe8dc', '#eec7b4'], tien: 'rgba(0,0,0,0.38)' };
  // Palec je dlhý (1000 dp), aby jeho koniec bol vždy mimo záberu, aj keď je telefón v háku menší:
  // odrezaný „plávajúci“ palec by v zábere pôsobil zle.
  const fw = 74, L = 1000, okraj = 34, roz = 0.55; // roz: o koľko sa k dlani rozšíri
  const w = fw * (1 + roz) + okraj * 2, h = L + okraj * 2;
  const c = platno(Math.ceil(w * pxNaDp), Math.ceil(h * pxNaDp)), x = c.getContext('2d');
  x.scale(pxNaDp, pxNaDp);
  const x0 = okraj + (fw * roz) / 2, y0 = okraj;
  const tvar = () => {
    // hrot je mierne plochý polovičný ovál, od kĺbu sa palec rozširuje k dlani
    x.beginPath();
    x.moveTo(x0, y0 + fw * 0.55);
    x.bezierCurveTo(x0, y0 + fw * 0.05, x0 + fw, y0 + fw * 0.05, x0 + fw, y0 + fw * 0.55);
    x.lineTo(x0 + fw * 1.06, y0 + fw * 2.6);
    x.quadraticCurveTo(x0 + fw * (1 + roz / 2), y0 + fw * 4.2, x0 + fw * (1 + roz / 2), y0 + L);
    x.lineTo(x0 - (fw * roz) / 2, y0 + L);
    x.quadraticCurveTo(x0 - (fw * roz) / 2, y0 + fw * 4.2, x0 - fw * 0.06, y0 + fw * 2.6);
    x.closePath();
  };
  x.save();
  x.shadowColor = T.tien; x.shadowBlur = 16; x.shadowOffsetX = 7; x.shadowOffsetY = 10;
  tvar(); x.fillStyle = T.stred; x.fill();
  x.restore();
  const g = x.createLinearGradient(x0 - (fw * roz) / 2, 0, x0 + fw * (1 + roz / 2), 0);
  g.addColorStop(0, T.kraj); g.addColorStop(0.34, T.stred); g.addColorStop(0.56, T.svetlo); g.addColorStop(1, T.kraj);
  tvar(); x.fillStyle = g; x.fill();
  x.lineWidth = 1.3; x.strokeStyle = T.obrys; x.stroke();
  // necht
  const nw = fw * 0.6, nh = fw * 0.66, nx = x0 + (fw - nw) / 2, ny = y0 + fw * 0.12;
  x.beginPath();
  x.moveTo(nx, ny + nh);
  x.lineTo(nx, ny + nw * 0.45);
  x.bezierCurveTo(nx, ny - nw * 0.05, nx + nw, ny - nw * 0.05, nx + nw, ny + nw * 0.45);
  x.lineTo(nx + nw, ny + nh);
  x.quadraticCurveTo(nx + nw / 2, ny + nh + nw * 0.16, nx, ny + nh);
  const gn = x.createLinearGradient(nx, ny, nx + nw, ny + nh);
  gn.addColorStop(0, T.necht[0]); gn.addColorStop(1, T.necht[1]);
  x.fillStyle = gn; x.fill();
  x.lineWidth = 1; x.strokeStyle = T.obrys; x.stroke();
  x.beginPath(); x.moveTo(nx + nw * 0.28, ny + nw * 0.25); x.quadraticCurveTo(nx + nw * 0.2, ny + nh * 0.5, nx + nw * 0.28, ny + nh * 0.82);
  x.lineWidth = 2.2; x.strokeStyle = 'rgba(255,255,255,0.5)'; x.stroke();
  // záhyby kĺbu
  x.strokeStyle = T.obrys; x.lineWidth = 1.2;
  for (const k of [1.72, 1.88]) {
    x.beginPath(); x.moveTo(x0 + fw * 0.2, y0 + fw * k); x.quadraticCurveTo(x0 + fw * 0.5, y0 + fw * (k + 0.08), x0 + fw * 0.8, y0 + fw * k); x.stroke();
  }
  // os palca v pixeloch spritu: test.mjs podľa nej overí, že palec nikdy nezakryje text mimo telefónu
  c.palec = { hrot: [(x0 + fw / 2) * pxNaDp, y0 * pxNaDp], koniec: [(x0 + fw / 2) * pxNaDp, (y0 + L) * pxNaDp], pol: ((fw * (1 + roz)) / 2) * pxNaDp };
  return { c, w, h, hrot: [x0 + fw / 2, y0 + fw * 0.34] };
}

/** Zaoblený obdĺžnik vyplnený farbou (pomôcka, aby kreslenie nebolo samé beginPath). */
export function obdlznik(x, px, py, w, h, r, farba) {
  zaoblene(x, px, py, w, h, Math.max(0, r));
  x.fillStyle = farba; x.fill();
}

export { zalom };
