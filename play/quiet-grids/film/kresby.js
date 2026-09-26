// Quiet Grids film: kresliace pomôcky podľa skutočnej appky (products/hlavolamy-android).
// Farby sú čísla z core/Layout.kt (Ink) a core/Shop.kt (papier Paper), hlavy zvierat prepis
// Ui.kt animalHead (kresba v kóde, ktorú appka kreslí, keď nemá obrázok), písmo Nunito z appky.
// Všetko statické sa kreslí raz do spritov; per snímka ostanú drawImage a ťahy dosky.

import { platno, pismo, zaoblene } from './engine/kresba.js';
import { vyvazZalom } from './engine/hak.js';

export const RODINA = '"Nunito Grids", system-ui, sans-serif';
export const nun = (vaha, px) => pismo(vaha, px, RODINA);

/** core/Layout.kt Ink (INK, PAPER, GREEN, GREEN_DEEP, WARN, TEXT .78, MARK .64), core/Shop.kt papier Paper. */
export const FARBA = {
  ink: '#203E45', paper: '#F5F2E9', card: '#FFFFFF', green: '#137A68', greenDeep: '#0F6355', warn: '#9A3B2F',
  accent: '#9FDAC7', // Papers[0] accent (výplň políčka Picture Grid)
  text: 0.78, mark: 0.64,
  // Ink.types: jedna farba na typ v poradí manifestu (aj farba páru v Paths: typeColour(owner - 1))
  typy: ['#9FDAC7', '#F1D580', '#C9B8EA', '#A9CEEE', '#F0B4AD', '#BDD993', '#EAC0DF', '#99D4D4', '#D9C9A8', '#B9D7C0', '#E5CBA8'],
};

/** Animals.order a Animals.classic (core/Names.kt). */
export const ZVIERATA = [
  ['badgers', 'Killer Sudoku'], ['hares', 'Anti-knight Sudoku'], ['squirrels', 'Kakuro'], ['cranes', 'Hashi'],
  ['swans', 'Masyu'], ['magpies', 'Nonogram'], ['herons', 'Numberlink'], ['voles', 'Nurikabe'],
  ['otters', 'Slitherlink'], ['hedgehogs', 'Star Battle'], ['dormice', 'Logic grid'],
];
export const meno = (id) => id.slice(0, 1).toUpperCase() + id.slice(1); // Animals.display

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export async function nacitajPisma(zaklad) {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return;
  const rezy = [['nunito-regular.woff2', '400'], ['nunito-semibold.woff2', '600'], ['nunito-bold.woff2', '700'], ['nunito-bold.woff2', '800']];
  await Promise.all(rezy.map(async ([f, vaha]) => {
    const ff = new FontFace('Nunito Grids', `url(${new URL(f, zaklad).href})`, { weight: vaha });
    await ff.load();
    document.fonts.add(ff);
  })).catch(() => {});
}

export function sprite(dpr, w, h, kresli) {
  const c = platno(Math.ceil(w * dpr), Math.ceil(h * dpr)), x = c.getContext('2d');
  x.scale(dpr, dpr);
  kresli(x);
  return { c, w, h };
}

/** Text ako sprite, vyvážene zalomený; písmo sa nikdy nezmenší pod minPx. */
export function spriteTextu(dpr, text, px, w, { vaha = 700, farba = FARBA.ink, zarovnanie = 'center', riadkovanie = 1.22, maxRiadkov = 2, minPx = 0 } = {}) {
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

/** Text s farebnými slovami: casti = [['text'], ['slovo', farba], ...]. */
export function spriteFarebny(dpr, casti, px, w, { vaha = 700, farba = FARBA.ink, zarovnanie = 'center', riadkovanie = 1.25 } = {}) {
  const m = platno(4, 4).getContext('2d');
  m.font = nun(vaha, px);
  const cely = casti.map((a) => a[0]).join('');
  const riadky = vyvazZalom(m, cely, w);
  const lh = px * riadkovanie;
  const farbaZnaku = [];
  casti.forEach(([txt, f]) => { for (const _ of txt) farbaZnaku.push(f || farba); });
  const s = sprite(dpr, w, lh * riadky.length + px * 0.35, (x) => {
    x.font = nun(vaha, px); x.textBaseline = 'top'; x.textAlign = 'left';
    let idx = 0;
    riadky.forEach((riadok, ri) => {
      const sirka = x.measureText(riadok).width;
      let cx = zarovnanie === 'center' ? (w - sirka) / 2 : 0;
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
  s.riadky = riadky.length;
  return s;
}

// ---------- hlava zvieraťa (Ui.kt animalHead) ----------

/**
 * Znak typu: disk vo farbe typu a hlava zvieraťa, prepis Ui.kt animalHead (kresba v kóde).
 * Appka ukazuje namiesto hlavy Andrejovu kresbu (PNG), ak ju má; film kreslí záložný znak z kódu.
 */
export function znak(x, id, farba, cx0, cy0, s) {
  const ink = rgba(FARBA.ink, 0.88), paper = FARBA.paper;
  x.save();
  x.beginPath(); x.arc(cx0, cy0, s / 2, 0, Math.PI * 2); x.fillStyle = farba; x.fill();
  const cx = cx0, cy = cy0 - s / 2 + s * 0.54, r = s * 0.21, line = s * 0.055;
  x.fillStyle = ink; x.strokeStyle = ink; x.lineCap = 'round';
  const kruh = (px, py, rr, f = ink) => { x.beginPath(); x.arc(px, py, Math.max(0, rr), 0, Math.PI * 2); x.fillStyle = f; x.fill(); };
  const ucho = (dx, dy, rr) => kruh(cx + dx * s, cy + dy * s, rr);
  const hlava = (rr = r) => kruh(cx, cy, rr);
  const ciara = (ax, ay, bx, by, w) => { x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.lineWidth = w; x.stroke(); };
  const zobak = (dlzka, hrubka) => { x.beginPath(); x.moveTo(cx + r * 0.6, cy - hrubka * s); x.lineTo(cx + dlzka * s, cy); x.lineTo(cx + r * 0.6, cy + hrubka * s); x.closePath(); x.fillStyle = ink; x.fill(); };
  switch (id) {
    case 'badgers': ucho(-0.155, -0.145, s * 0.065); ucho(0.155, -0.145, s * 0.065); hlava(); x.fillStyle = paper; x.fillRect(cx - s * 0.035, cy - r, s * 0.07, r * 1.9); break;
    case 'hares': for (const dx of [-0.085, 0.085]) ciara(cx + dx * s, cy - r * 0.6, cx + dx * s * 1.5, cy - s * 0.36, line * 1.5); hlava(r * 0.92); break;
    case 'squirrels':
      x.beginPath(); x.moveTo(cx + r * 0.7, cy + r * 0.5); x.bezierCurveTo(cx + s * 0.34, cy + r * 0.2, cx + s * 0.30, cy - s * 0.30, cx + s * 0.02, cy - s * 0.26);
      x.lineWidth = line * 1.7; x.stroke(); ucho(-0.12, -0.155, s * 0.055); hlava(r * 0.86); break;
    case 'cranes': ciara(cx - s * 0.10, cy + s * 0.26, cx - s * 0.02, cy, line * 1.3); hlava(r * 0.62); zobak(0.36, 0.030); ciara(cx - r * 0.5, cy - r * 0.5, cx - s * 0.20, cy - s * 0.14, line); break;
    case 'swans':
      x.beginPath(); x.moveTo(cx - s * 0.14, cy + s * 0.28); x.bezierCurveTo(cx + s * 0.12, cy + s * 0.20, cx - s * 0.14, cy - s * 0.06, cx - s * 0.01, cy - s * 0.10);
      x.lineWidth = line * 1.4; x.stroke(); kruh(cx, cy - s * 0.10, r * 0.58);
      x.beginPath(); x.moveTo(cx + r * 0.35, cy - s * 0.13); x.lineTo(cx + s * 0.20, cy - s * 0.09); x.lineTo(cx + r * 0.35, cy - s * 0.06); x.closePath(); x.fillStyle = ink; x.fill(); break;
    case 'magpies': hlava(); kruh(cx - r * 0.30, cy + r * 0.26, r * 0.42, paper); zobak(0.34, 0.038); break;
    case 'herons': hlava(r * 0.66); zobak(0.40, 0.026); ciara(cx - r * 0.4, cy - r * 0.55, cx - s * 0.26, cy - s * 0.20, line * 0.9); ciara(cx - r * 0.2, cy + r * 0.6, cx - s * 0.06, cy + s * 0.26, line * 1.1); break;
    case 'voles': ucho(-0.15, -0.13, s * 0.075); ucho(0.15, -0.13, s * 0.075); hlava(r * 0.96); kruh(cx + r * 0.55, cy + r * 0.35, s * 0.03, paper); break;
    case 'otters':
      ucho(-0.16, -0.12, s * 0.05); ucho(0.16, -0.12, s * 0.05); hlava(); kruh(cx, cy + r * 0.42, r * 0.46, paper);
      for (let k = -1; k <= 1; k++) ciara(cx + r * 0.5, cy + r * 0.42 + k * s * 0.035, cx + s * 0.26, cy + r * 0.42 + k * s * 0.06, line * 0.5); break;
    case 'hedgehogs':
      for (let k = 0; k <= 6; k++) { const a = ((-160 + k * 20) * Math.PI) / 180; ciara(cx + r * 0.92 * Math.cos(a), cy + r * 0.92 * Math.sin(a), cx + r * 1.62 * Math.cos(a), cy + r * 1.62 * Math.sin(a), line * 0.8); }
      hlava(r * 0.94); kruh(cx + r * 0.5, cy + r * 0.3, s * 0.028, paper); break;
    default:
      ucho(-0.17, -0.10, s * 0.095); ucho(0.17, -0.10, s * 0.095); hlava(r * 0.9);
      x.beginPath(); x.moveTo(cx - r * 0.8, cy + r * 0.8); x.bezierCurveTo(cx - s * 0.30, cy + s * 0.24, cx - s * 0.30, cy - s * 0.02, cx - s * 0.12, cy - s * 0.04);
      x.lineWidth = line * 0.8; x.stroke();
  }
  x.restore();
}

// ---------- prst ----------

/**
 * Ukazovák pri pohľade zhora ako sprite (logické jednotky = px príbehu, sprite v px zariadenia).
 * Hrot smeruje nahor, bod dotyku je sprite.hrot. Prst je dlhý, aby jeho koniec bol vždy mimo záberu.
 */
export function spritePrsta(sirka, dpr) {
  const fw = sirka, L = sirka * 14, okraj = sirka * 0.45, roz = 0.35;
  const w = fw * (1 + roz) + okraj * 2, h = L + okraj * 2;
  const c = platno(Math.ceil(w * dpr), Math.ceil(h * dpr)), x = c.getContext('2d');
  x.scale(dpr, dpr);
  const x0 = okraj + (fw * roz) / 2, y0 = okraj;
  const tvar = () => {
    x.beginPath();
    x.moveTo(x0, y0 + fw * 0.5);
    x.arc(x0 + fw / 2, y0 + fw / 2, fw / 2, Math.PI, 0);
    x.lineTo(x0 + fw * 1.04, y0 + fw * 3.2);
    x.quadraticCurveTo(x0 + fw * (1 + roz / 2), y0 + fw * 5, x0 + fw * (1 + roz / 2), y0 + L);
    x.lineTo(x0 - (fw * roz) / 2, y0 + L);
    x.quadraticCurveTo(x0 - (fw * roz) / 2, y0 + fw * 5, x0 - fw * 0.04, y0 + fw * 3.2);
    x.closePath();
  };
  x.save();
  x.shadowColor = 'rgba(32,62,69,0.26)'; x.shadowBlur = fw * 0.35; x.shadowOffsetX = fw * 0.14; x.shadowOffsetY = fw * 0.18;
  tvar(); x.fillStyle = '#e3b394'; x.fill();
  x.restore();
  const g = x.createLinearGradient(x0 - (fw * roz) / 2, 0, x0 + fw * (1 + roz / 2), 0);
  g.addColorStop(0, '#d9a283'); g.addColorStop(0.36, '#f3cbb0'); g.addColorStop(0.6, '#f0c4a7'); g.addColorStop(1, '#cf9676');
  tvar(); x.fillStyle = g; x.fill();
  x.lineWidth = fw * 0.025; x.strokeStyle = 'rgba(150,90,62,0.45)'; x.stroke();
  const nw = fw * 0.6, nh = fw * 0.72, nx = x0 + (fw - nw) / 2, ny = y0 + fw * 0.1;
  x.beginPath();
  x.moveTo(nx, ny + nh); x.lineTo(nx, ny + nw / 2);
  x.arc(nx + nw / 2, ny + nw / 2, nw / 2, Math.PI, 0);
  x.lineTo(nx + nw, ny + nh);
  x.quadraticCurveTo(nx + nw / 2, ny + nh + nw * 0.18, nx, ny + nh);
  const gn = x.createLinearGradient(nx, ny, nx + nw, ny + nh);
  gn.addColorStop(0, '#fbe6db'); gn.addColorStop(1, '#efc9b8');
  x.fillStyle = gn; x.fill();
  x.lineWidth = fw * 0.02; x.strokeStyle = 'rgba(160,100,80,0.45)'; x.stroke();
  x.strokeStyle = 'rgba(150,90,62,0.35)'; x.lineWidth = fw * 0.024;
  for (const k of [1.72, 1.86, 3.3, 3.42]) {
    x.beginPath(); x.moveTo(x0 + fw * 0.22, y0 + fw * k); x.quadraticCurveTo(x0 + fw * 0.5, y0 + fw * (k + 0.07), x0 + fw * 0.78, y0 + fw * k); x.stroke();
  }
  c.palec = { hrot: [(x0 + fw / 2) * dpr, y0 * dpr], koniec: [(x0 + fw / 2) * dpr, (y0 + L) * dpr], pol: ((fw * (1 + roz)) / 2) * dpr };
  return { c, w, h, hrot: [x0 + fw / 2, y0 + fw * 0.3] };
}

export { zaoblene };
