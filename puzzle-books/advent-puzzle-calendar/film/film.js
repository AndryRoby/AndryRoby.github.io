// Advent Puzzle Calendar 2026: film na 20 sekúnd pre tlačiteľný adventný kalendár hlavolamov (Etsy,
// 4,90 €), nakreslený a ozvučený kódom (kodfilm engine). Vizuálny jazyk kalendára: tmavá zelená noc,
// krémový papier, červená #b3261e a zlatá #e2b85a z PDF a obrázkov ponuky (products/hlavolamy-advent).
//
// Pokus 2 po bráne (Astra, 28. 9.): hlavným predmetom od snímky 0 do konca je jeden skutočný list PDF
// (1. december), žiadny kalendár s dvierkami. Za listom ležia dva ďalšie listy (stoh výtlačkov).
//
// Scény: hák (list 1. decembra so zadaniami a vyriešeným zvončekom, červený štítok PRINTABLE PDF, názov,
// ponuka „24 days, 48 logic puzzles“ a arlingpuzzles.etsy.com, všetko v plnom kontraste 3 s), červené bunky
// odídu a list sa pružinou priblíži, Nonogram sa sám vyrieši riadok po riadku (skutočné zadanie zo
// zadania.json, skutočný riadkový riešič, žiadne hádanie), zvonček sa rozhojdá, list sa otočí na zadnú
// stranu (Hashi z 1. decembra) a späť, mriežka a zadania sa vrátia, list sa vráti na miesto háku a záver
// má presne zloženie háku (posledná snímka = snímka 0), ponuka a adresa opäť aspoň 3 s v plnom kontraste.
//
// Film ukazuje riešenie len jedného hlavolamu (Nonogram 1. decembra). Listy v stohu majú prázdne mriežky.

import { okno, obmedz, lerp, ease, hash, obalka } from './engine/cas.js';
import { platno, zrno, zaoblene, pismo } from './engine/kresba.js';
import { hak, format, zona, sprite, spriteRiadku, minPismo, MAX_NAZOV_916 } from './engine/hak.js';

const DLZKA = 20;
const SERIF = '"ARLing Serif", Georgia, serif';
const SANS = '"ARLing Sans", system-ui, sans-serif';

// Farby z kalendára (kniha.mjs: CERV, ZLATA, obálka #0b2419, #123a2a, #0d2c20, sneh #f3efe6).
const FARBY = {
  noc0: '#0b2419', noc1: '#123a2a', noc2: '#0d2c20', svetlo: '#1e5a42',
  cervena: '#b3261e', zlata: '#e2b85a', zlataTmava: '#c8942e',
  krem: '#f6efdf', kremTmavy: '#d9ceb6', papier: '#fbf8f1', papierStoh: '#efe8d8', sneh: '#f3efe6',
  ink: '#1b1a17', linka: '#a79f91', text: '#fbf6ea', text2: '#e9e0cc',
};

// Fakty vo filme. Zdroje (test.mjs ich porovná): products/hlavolamy-advent/zadania.json (deň 1:
// Nonogram „Bell“ 10 x 10, zadanie aj riešenie, Hashi 7 x 7), texty.mjs (24 dní, 48 hlavolamov, druhy),
// etsy/en/etsy.json a etsy/de/etsy.json (ponuky naživo), etsy/en/ponuka.json (cena), obchod
// arlingpuzzles.etsy.com (ops/social/zasobnik-q4.mjs ETSY_OBCHOD).
export const FAKTY = {
  dni: 24,
  hlavolamov: 48,
  den: 1,
  meno: 'Bell',
  n: 10,
  riadky: [[2], [4], [6], [6], [6], [8], [8], [10], [10], [2]],
  stlpce: [[2], [4], [7], [8], [10], [10], [8], [7], [4], [2]],
  riesenie: '0000110000000111100000111111000011111100001111110001111111100111111110111111111111111111110000110000',
  hashiN: 7,
  ostrovy: [{ r: 0, c: 0, n: 1 }, { r: 0, c: 2, n: 1 }, { r: 0, c: 4, n: 1 }, { r: 2, c: 2, n: 4 }, { r: 2, c: 4, n: 6 }, { r: 2, c: 6, n: 1 }, { r: 5, c: 0, n: 3 }, { r: 5, c: 2, n: 3 }, { r: 5, c: 4, n: 3 }, { r: 5, c: 6, n: 1 }],
  zadne: ['Hashi', 'Kakuro', 'Slitherlink'],
  obchod: 'arlingpuzzles.etsy.com',
  ponukaEn: 4583815695,
  ponukaDe: 4583815851,
  url: 'https://www.etsy.com/listing/4583815695/printable-puzzle-advent-calendar-2026-48',
  cena: '4.90',
  // Nonogramy 10 x 10 v dňoch 1 až 8, 15 x 15 v dňoch 9 až 24 (texty.mjs uvod, zadania.json)
  malychDni: 8,
};

const KICKER = 'ADVENT 2026';
const NAZOV = 'Puzzle Calendar';
const ZNACKA = 'PRINTABLE PDF';
const VETA = '24 days, 48 logic puzzles';
const HLAVICKA = 'December 1';

// Hák: texty v plnom kontraste do drz - 0,15 - oneskorenie (veta 3,09 s, adresa 3,13 s), preč v 3,55 s.
const HAK = hak({ drz: 3.3, odchod: 0.6 });
const PRIBLIZENIE_HAKU = 1.035; // engine/hak.js PRIBLIZENIE (neexportuje ho); záver sa k nemu priblíži
const PREKMIT = 0.8; // outBack so s = 0,8 prekmitne o 2,3 % (skill arling-film: najviac 3 %)

// ---------- riadkový riešič (skutočné riešenie bez hádania) ----------

/** Všetky rozloženia blokov v riadku, ktoré sedia so známymi bunkami; vráti prienik (-1 = nevieme). */
export function riesRiadok(bloky, bunky) {
  const n = bunky.length;
  let spolu = null;
  const rek = (i, od, acc) => {
    if (i === bloky.length) {
      const r = acc.concat(Array(n - acc.length).fill(0));
      for (let k = 0; k < n; k++) if (bunky[k] !== -1 && bunky[k] !== r[k]) return;
      if (!spolu) spolu = r.slice(); else for (let k = 0; k < n; k++) if (spolu[k] !== r[k]) spolu[k] = -1;
      return;
    }
    const b = bloky[i];
    for (let s = od; s + b <= n; s++) {
      const a = acc.concat(Array(s - acc.length).fill(0), Array(b).fill(1));
      if (i < bloky.length - 1) { if (s + b < n) rek(i + 1, s + b + 1, a.concat([0])); } else rek(i + 1, s + b, a);
    }
  };
  rek(0, 0, []);
  return spolu;
}

/** Riadky, potom stĺpce, dokola; zapíše len kroky, ktoré niečo zistili. */
export function riesNonogram(riadky, stlpce) {
  const N = riadky.length, g = Array(N * N).fill(-1), kroky = [];
  for (let kolo = 0; kolo < 20 && g.includes(-1); kolo++) {
    let zmena = false;
    for (const [typ, zoz] of [['r', riadky], ['c', stlpce]]) for (let i = 0; i < N; i++) {
      const idx = Array.from({ length: N }, (_, k) => (typ === 'r' ? i * N + k : k * N + i));
      const b = idx.map((j) => g[j]);
      const r = riesRiadok(zoz[i], b);
      if (!r) throw new Error('Nonogram nemá riešenie');
      const nove = [];
      idx.forEach((j, k) => { if (b[k] === -1 && r[k] !== -1) { g[j] = r[k]; nove.push({ j, v: r[k], k }); } });
      if (nove.length) { kroky.push({ typ, i, nove }); zmena = true; }
    }
    if (!zmena) break;
  }
  return { g, kroky };
}

const RIESENIE = riesNonogram(FAKTY.riadky, FAKTY.stlpce);
if (RIESENIE.g.join('') !== FAKTY.riesenie) throw new Error('Advent film: riadkový riešič nedal riešenie zo zadania.json');

// ---------- časová os (sekundy) ----------

// Doby 120 BPM (0,5 s): reset 3,3 (odchod háku), riešenie od 4,0, zvonček 9,0, otočenie 11,5, záver 15,0.
const T = {
  resetOd: 3.3, rastOd: 3.45,
  riesOd: 4.0, riesDo: 8.8,
  hotovo: 9.0, mriezkaPrec: 0.4, zvonOd: 9.15,
  flipTextPrec: 11.2, flipOd: 11.5, flipDo: 12.1,
  ostrovyOd: 12.2, ostrovyKrok: 0.06, ostrovTrv: 0.3,
  // čísla ostrovov odídu pred otočením späť (počas otáčania nie je na liste text)
  zadnyTextPrec: 14.3, spatOd: 14.55, spatDo: 14.85,
  obnovaOd: 14.9, zmensiOd: 14.9,
  nazov: 15.0, znacka: 15.5, veta: 15.9, url: 16.0, nazovBlizsieOd: 16.2,
};
// odkaz nad pilulkou adresy: v háku, kým je pilulka na obraze (odíde v drz + 0,25 = 3,55 s), a od záveru
const CASY_ODKAZU = [[0, HAK.drz + 0.25], [T.url, Infinity]];
// titulky: rýchly nábeh a odchod, plný kontrast aspoň slová / 3 + 0,5 s (test.mjs)
const TIT_NABEH = 0.12, TIT_DOBEH = 0.14;
const KROKY = RIESENIE.kroky.map((k, i, a) => {
  // prvé kroky pomalšie (divák pochopí pravidlo), ďalšie zrýchlia
  const f = (x) => Math.pow(x, 0.82);
  const od = T.riesOd + (T.riesDo - T.riesOd) * f(i / a.length);
  const dokedy = T.riesOd + (T.riesDo - T.riesOd) * f((i + 1) / a.length);
  return { ...k, od, do: dokedy };
});
// čas, kedy sa bunka j objaví
const KEDY = new Map();
for (const k of KROKY) {
  const trv = k.do - k.od;
  k.nove.forEach((b, q) => KEDY.set(b.j, { t: k.od + trv * 0.25 + (trv * 0.6 * q) / Math.max(1, k.nove.length), v: b.v }));
}

// Titulky na plátne nadväzujú bez medzier; prvý príde, keď texty háku odišli (3,55 s), posledný odíde pred
// záverom (15,0 s). V páse titulkov sú v háku a závere názov a ponuka, nikdy naraz s titulkom.
const TITULKY = [
  { od: 3.65, do: 6.45, text: 'December 1: find the picture.' },
  { od: 6.45, do: 9.0, text: 'Line by line, without guessing.' },
  { od: 9.0, do: 11.8, text: 'A bell. 23 more to find.' },
  { od: 11.8, do: 14.95, text: 'On the back: Hashi, Kakuro or Slitherlink.' },
];

let L = null;

// ---------- pomôcky ----------

function sirka(text, vaha, px, rodina = SANS) {
  const m = platno(4, 4).getContext('2d');
  m.font = pismo(vaha, px, rodina);
  return m.measureText(text).width;
}

/** Tlmená pružina v uzavretom tvare: 0 pred štartom, 1 po ustálení, prekmit 2,8 % (zeta 0,75). */
function pruzina(tau, omega = 11, zeta = 0.75) {
  if (tau <= 0) return 0;
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * omega * tau) * (Math.cos(wd * tau) + ((zeta * omega) / wd) * Math.sin(wd * tau));
}

/** Názov v pätkovom písme ako sprite s odleskom (rozhranie ako spriteNazvu: c, w, h, svetly, textW). */
function spriteTitulu(dpr, riadky, px, w, zarovnanie) {
  const najsirsi = Math.max(...riadky.map((r) => sirka(r, 600, px, SERIF)));
  const vel = najsirsi > w * 0.92 ? (px * w * 0.92) / najsirsi : px;
  const lh = vel * 1.06, h = lh * (riadky.length - 1) + vel * 1.2;
  const x0 = zarovnanie === 'center' ? w / 2 : 0;
  const kresli = (farby, tien) => (x) => {
    x.font = pismo(600, vel, SERIF); x.textBaseline = 'top'; x.textAlign = zarovnanie;
    riadky.forEach((r, i) => {
      if (tien) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillText(r, x0, i * lh + vel * 0.05); }
      const g = x.createLinearGradient(0, i * lh, 0, i * lh + vel);
      farby.forEach((f, j) => g.addColorStop(j / (farby.length - 1), f));
      x.fillStyle = g;
      x.fillText(r, x0, i * lh);
    });
  };
  const s = sprite(dpr, w, h, kresli(['#fffaf0', '#f5eddb', '#e6d6b4'], true));
  const sv = sprite(dpr, w, h, kresli(['rgba(255,255,255,0.95)', 'rgba(255,244,214,0.85)', 'rgba(255,232,180,0.6)'], false));
  sv.c.bezKontroly = true; // odlesk je ten istý text ako názov (test.mjs ho nepočíta druhý raz)
  s.svetly = sv.c;
  s.px = vel;
  s.textW = Math.max(...riadky.map((r) => sirka(r, 600, vel, SERIF)));
  return s;
}

/** Jeden riadok textu; ak je širší ako maxW, písmo sa zmenší (nie pod mp). */
function spriteTextu(dpr, text, px, vaha, farba, rodina = SANS, maxW = Infinity, mp = 0) {
  const tw = sirka(text, vaha, px, rodina);
  if (tw * 1.02 > maxW) px = Math.max(mp, (px * maxW) / (tw * 1.02));
  const w = sirka(text, vaha, px, rodina) + px * 0.2, h = px * 1.3;
  const s = sprite(dpr, w, h, (x) => {
    x.font = pismo(vaha, px, rodina); x.textBaseline = 'top'; x.textAlign = 'center'; x.fillStyle = farba;
    x.fillText(text, w / 2, px * 0.12);
  });
  s.px = px;
  return s;
}

/**
 * Červený štítok PRINTABLE PDF s ikonou listu (obdĺžnik so zahnutým rohom). Ak sa do maxW nezmestí ani pri
 * najmenšom písme, dva riadky bez ikony (PRINTABLE / PDF).
 */
function spriteZnacky(dpr, text, px0, maxW, mp) {
  let px = px0;
  const jeden = (p) => { const pad = p * 0.62, ik = p * 0.74, med = p * 0.42; return { pad, ik, med, w: pad * 2 + ik + med + sirka(text, 700, p), h: p * 1.72 }; };
  let r = jeden(px);
  if (r.w > maxW) { px = Math.max(mp, (px * maxW) / r.w * 0.98); r = jeden(px); }
  const riadky = r.w > maxW ? text.split(' ') : [text];
  const m = 2;
  let w, h;
  if (riadky.length === 1) { w = r.w; h = r.h; }
  else { const pad = px * 0.62; w = pad * 2 + Math.max(...riadky.map((q) => sirka(q, 700, px))); h = px * 1.18 * riadky.length + px * 0.55; }
  const s = sprite(dpr, w + 2 * m, h + 2 * m, (x) => {
    zaoblene(x, m, m, w, h, Math.min(h * 0.24, px * 0.42));
    x.fillStyle = FARBY.cervena; x.fill();
    zaoblene(x, m + px * 0.11, m + px * 0.11, w - px * 0.22, h - px * 0.22, Math.min(h * 0.2, px * 0.34));
    x.lineWidth = Math.max(1.5, px * 0.045); x.strokeStyle = 'rgba(255,226,170,0.55)'; x.stroke();
    x.font = pismo(700, px); x.textBaseline = 'middle'; x.fillStyle = FARBY.text;
    if (riadky.length === 1) {
      // ikona: list so zahnutým rohom a dvoma riadkami
      const ix = m + r.pad, iy = m + (h - r.ik * 1.2) / 2, iw = r.ik * 0.86, ih = r.ik * 1.2, roh = iw * 0.34;
      x.beginPath();
      x.moveTo(ix, iy); x.lineTo(ix + iw - roh, iy); x.lineTo(ix + iw, iy + roh); x.lineTo(ix + iw, iy + ih); x.lineTo(ix, iy + ih); x.closePath();
      x.fillStyle = FARBY.papier; x.fill();
      x.beginPath(); x.moveTo(ix + iw - roh, iy); x.lineTo(ix + iw - roh, iy + roh); x.lineTo(ix + iw, iy + roh); x.closePath();
      x.fillStyle = FARBY.kremTmavy; x.fill();
      x.fillStyle = FARBY.cervena;
      for (let i = 0; i < 3; i++) x.fillRect(ix + iw * 0.18, iy + ih * (0.42 + i * 0.17), iw * (i === 2 ? 0.4 : 0.64), Math.max(1, ih * 0.07));
      x.fillStyle = FARBY.text; x.textAlign = 'left';
      x.fillText(text, ix + r.ik + r.med, m + h / 2 + px * 0.04);
    } else {
      x.textAlign = 'center';
      riadky.forEach((q, i) => x.fillText(q, m + w / 2, m + px * 0.28 + px * 1.18 * (i + 0.5) + px * 0.04));
    }
  });
  s.px = px;
  return s;
}

/** Adresa obchodu v zlatej pilulke. */
function spritePilulky(dpr, text, px) {
  const tw = sirka(text, 700, px), ph = px * 1.9, pw = tw + px * 1.6, m = 2;
  const s = sprite(dpr, pw + 2 * m, ph + 2 * m, (x) => {
    zaoblene(x, m, m, pw, ph, ph / 2);
    x.fillStyle = 'rgba(7,22,15,0.55)'; x.fill();
    x.lineWidth = Math.max(2, px * 0.06); x.strokeStyle = FARBY.zlata; x.stroke();
    x.font = pismo(700, px); x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillStyle = FARBY.text;
    x.fillText(text, m + pw / 2, m + ph / 2 + px * 0.04);
  });
  s.px = px; s.pw = pw; s.ph = ph; s.m = m;
  return s;
}

function hviezda(x, cx, cy, r, uhol = 0) {
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = uhol - Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r;
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
    if (i) x.lineTo(px, py); else x.moveTo(px, py);
  }
  x.closePath();
}

// ---------- rozloženie ----------

function rozlozenie(W, H) {
  const F = format(W, H), Z = zona(W, H), s = Math.min(W, H);
  const mp = minPismo(W, H) * 1.05; // rezerva 5 % (sprity v celých pixeloch)
  const R = { F, Z, s, W, H, mp };
  const vys = F.druh === 'vysoky';
  R.kPx = Math.max(mp, s * 0.04);
  R.bPx = Math.max(mp, s * 0.05);
  R.lPx = Math.max(mp, s * (vys ? 0.047 : 0.042));
  R.uPx = Math.max(mp, s * 0.042);
  R.cPx = Math.max(mp, s * (vys ? 0.05 : 0.044));
  R.tPx = F.druh === 'siroky' ? s * 0.12 : s * (vys ? 0.105 : 0.088);
  R.hviezdy = [{ x: W - s * 0.1, y: s * 0.1, r: s * 0.042 }, { x: W - s * 0.055, y: s * 0.2, r: s * 0.018 }];
  // 4:5: štítok je v riadku s ADVENT 2026 až po pravý okraj zóny, hviezdy idú vedľa listu (kontrola p2, 1 s)
  if (F.druh === 'portret') R.hviezdy = [{ x: W - s * 0.07, y: H * 0.3, r: s * 0.04 }, { x: W - s * 0.04, y: H * 0.38, r: s * 0.017 }];
  return R;
}

/** Rozloženie listu (hlavička, zadania, mriežka N x N) v oblasti obl, v strede oblasti. */
function list(R, obl) {
  const { s, mp } = R;
  const pad = s * 0.032, hH = Math.max(mp * 1.6, s * 0.06), gapH = s * 0.02;
  const f0 = (46 * s) / 1080;
  const rozmer = (c) => {
    const f = Math.max(mp, Math.min(f0, c * 0.62));
    const cc = f * 1.45, cr = f * 1.3;
    return { f, cc, cr, w: 2 * pad + cc + 10 * c, h: 2 * pad + hH + gapH + cr + 10 * c };
  };
  // dno bunky 20 px pri kratšej strane 1080 (render), úmerne menšie na malom plátne stránky (telefón ~350 px);
  // pevných 20 px tam list nafúklo do textov háku a film nenaštartoval
  let c = 120;
  const dno = Math.min(20, (20 * s) / 1080);
  while (c > dno) { const r = rozmer(c); if (r.w <= obl.w && r.h <= obl.h) break; c -= 0.5; }
  const r = rozmer(c);
  const P = { c, f: r.f, cc: r.cc, cr: r.cr, pad, hH, gapH, w: r.w, h: r.h };
  P.x = obl.x + (obl.w - P.w) / 2; P.y = obl.y + (obl.h - P.h) / 2;
  P.gx = pad + r.cc; P.gy = pad + hH + gapH + r.cr; // mriežka v súradniciach listu
  P.okraj = s * 0.022; // okraj spritu na tieň
  return P;
}

// ---------- vrstvy ----------

function kresliObsahListu(x, P, R, druh, mierka = 1, papier = FARBY.papier) {
  const { s } = R;
  const { w, h, pad, hH, gx, gy, c } = P;
  x.save();
  x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = s * 0.02; x.shadowOffsetY = s * 0.006;
  x.fillStyle = papier;
  x.fillRect(0, 0, w, h);
  x.restore();
  // hlavička ako v PDF: červený krúžok s číslom dňa a tenká červená linka
  x.fillStyle = FARBY.cervena;
  x.beginPath(); x.arc(pad + hH / 2, pad + hH / 2, hH / 2, 0, Math.PI * 2); x.fill();
  x.fillRect(pad, pad + hH + P.gapH * 0.35, w - 2 * pad, Math.max(1, s * 0.0022));
  hviezda(x, w - pad - hH * 0.3, pad + hH * 0.45, hH * 0.28);
  x.fillStyle = FARBY.zlataTmava; x.fill();
  if (druh === 'n10' || druh === 'n15') {
    const N = druh === 'n10' ? 10 : 15, k = (10 * c) / N;
    const tenka = Math.max(1, s * 0.0014, 0.7 / mierka), hruba = Math.max(1.5, s * 0.0034, 1.2 / mierka);
    x.strokeStyle = FARBY.linka; x.lineWidth = tenka;
    x.beginPath();
    for (let i = 1; i < N; i++) {
      if (i % 5 === 0) continue;
      x.moveTo(gx + i * k, gy); x.lineTo(gx + i * k, gy + N * k);
      x.moveTo(gx, gy + i * k); x.lineTo(gx + N * k, gy + i * k);
    }
    x.stroke();
    x.strokeStyle = FARBY.ink; x.lineWidth = hruba;
    x.beginPath();
    for (let i = 0; i <= N; i += 5) {
      x.moveTo(gx + i * k, gy); x.lineTo(gx + i * k, gy + N * k);
      x.moveTo(gx, gy + i * k); x.lineTo(gx + N * k, gy + i * k);
    }
    x.stroke();
  }
}

/** List ako sprite; mierka = rozlíšenie (list sa v príbehu zväčší až na K, aby ostal ostrý). */
function spriteListu(dpr, P, R, druh, mierka = 1, papier) {
  const o = P.okraj;
  return sprite(dpr, (P.w + 2 * o) * mierka, (P.h + 2 * o) * mierka, (x) => {
    x.scale(mierka, mierka);
    x.translate(o, o);
    kresliObsahListu(x, P, R, druh, mierka, papier);
  });
}

function stavVrstiev(W, H, dpr, env) {
  const R = rozlozenie(W, H);
  const { F, Z, s, mp } = R;
  L = { R, W, H, dpr };

  // pozadie: tmavozelená noc s jemným svetlom vpravo hore, vinetou a snehovým závejom dole
  const poz = platno(W * dpr, H * dpr), px = poz.getContext('2d');
  px.scale(dpr, dpr);
  const g = px.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, FARBY.noc0); g.addColorStop(0.7, FARBY.noc1); g.addColorStop(1, FARBY.noc2);
  px.fillStyle = g; px.fillRect(0, 0, W, H);
  const rg = px.createRadialGradient(W * 0.85, H * 0.08, 0, W * 0.85, H * 0.08, Math.max(W, H) * 0.7);
  rg.addColorStop(0, 'rgba(30,90,66,0.75)'); rg.addColorStop(1, 'rgba(30,90,66,0)');
  px.fillStyle = rg; px.fillRect(0, 0, W, H);
  const vg = px.createRadialGradient(W / 2, H / 2, s * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  px.fillStyle = vg; px.fillRect(0, 0, W, H);
  const zy = H - s * 0.05;
  px.beginPath();
  px.moveTo(0, zy);
  px.bezierCurveTo(W * 0.3, zy - s * 0.025, W * 0.55, zy + s * 0.012, W, zy - s * 0.01);
  px.lineTo(W, H); px.lineTo(0, H); px.closePath();
  px.fillStyle = FARBY.sneh; px.globalAlpha = 0.93; px.fill(); px.globalAlpha = 1;
  L.poz = poz;

  // rozloženie háku a záveru podľa formátu:
  //   stlpec (9:16, 4:5): ADVENT 2026, názov, štítok, list, ponuka, adresa pod sebou; štítok vedľa ADVENT 2026, ak
  //     by list v samostatnom riadku vyšiel príliš malý (4:5). Titulky v páse nad listom, list v príbehu rastie nadol.
  //   siroky (16:9): list vľavo, texty vpravo pod sebou; titulky v stĺpci textov.
  //   stvorec (1:1): list vľavo hore, vpravo ADVENT 2026, názov a štítok, pod listom ponuka a adresa; titulky pod listom.
  const g1 = s * 0.008, g2 = s * 0.022, g3 = s * 0.026;
  const P = {};
  const druh = F.druh === 'siroky' ? 'siroky' : F.druh === 'stvorec' ? 'stvorec' : 'stlpec';
  L.druh = druh;
  L.url = spritePilulky(dpr, FAKTY.obchod, R.uPx);
  let LI, titPas, zarTit;
  const stredX = (w) => Z.x0 + (Z.w - w) / 2;
  if (druh === 'stlpec') {
    R.zar = 'center'; zarTit = 'center';
    L.kicker = spriteTextu(dpr, KICKER, R.kPx, 700, FARBY.zlata);
    L.nazov = spriteTitulu(dpr, [NAZOV], R.tPx, Z.w, 'center');
    L.znacka = spriteZnacky(dpr, ZNACKA, R.bPx, Z.w, mp);
    L.veta = spriteRiadku(dpr, VETA, R.lPx, Z.w, { vaha: 600, farba: FARBY.text2, zarovnanie: 'center', maxRiadkov: 2 });
    // pri odchode háku klesne adresa o 40 % svojej výšky (kresliRiadok): aj vtedy ostane v zóne
    const spodok = F.druh === 'vysoky' ? Z.y1 - s * 0.01 - L.url.h * 0.42 : Math.min(Z.y1 - L.url.h * 0.42, H * 0.9);
    P.url = { x: stredX(L.url.w), y: spodok - L.url.h };
    P.veta = { x: Z.x0, y: P.url.y - g2 - L.veta.h };
    const samostatne = () => {
      const Q = {};
      let y = Z.y0;
      Q.kicker = { x: stredX(L.kicker.w), y }; y += L.kicker.h + g1;
      Q.nazov = { x: Z.x0, y }; y += L.nazov.h + g2;
      Q.znacka = { x: stredX(L.znacka.w), y }; y += L.znacka.h + g3;
      return { Q, LI: list(R, { x: Z.x0, y, w: Z.w, h: P.veta.y - g3 - y }) };
    };
    const vRiadku = () => {
      const Q = {}, rh = Math.max(L.kicker.h, L.znacka.h), med = s * 0.03;
      const x0 = stredX(L.kicker.w + med + L.znacka.w);
      Q.kicker = { x: x0, y: Z.y0 + (rh - L.kicker.h) / 2 };
      Q.znacka = { x: x0 + L.kicker.w + med, y: Z.y0 + (rh - L.znacka.h) / 2 };
      const y0 = Z.y0 + rh + g1;
      Q.nazov = { x: Z.x0, y: y0 };
      const y = y0 + L.nazov.h + g3;
      return { Q, LI: list(R, { x: Z.x0, y, w: Z.w, h: P.veta.y - g3 - y }) };
    };
    let v = samostatne();
    // prah 52 px pri kratšej strane 1080 (render), úmerne na menšom plátne, aby web ukázal rovnaké rozloženie
    if (v.LI.c < (52 * s) / 1080 && L.kicker.w + s * 0.03 + L.znacka.w <= Z.w) v = vRiadku();
    Object.assign(P, v.Q);
    LI = v.LI;
    const dole = Math.max(P.kicker.y + L.kicker.h, P.nazov.y + L.nazov.h, P.znacka.y + L.znacka.h);
    titPas = { x: Z.x0, y: Z.y0, w: Z.w, h: LI.y - s * 0.02 - Z.y0 };
    if (dole > LI.y) throw new Error('Advent film: texty háku zasahujú do listu');
    // v príbehu list rastie od horného okraja nadol (pás titulkov nad ním ostáva voľný)
    L.K = Math.max(1, Math.min((Z.y1 - LI.y) / LI.h, Z.w / LI.w, 1.12));
    L.kotva = { x: LI.x + LI.w / 2, y: LI.y };
  } else if (druh === 'siroky') {
    R.zar = 'left'; zarTit = 'left';
    const x0 = Z.x0 + Z.w * 0.62, w = Z.x1 - x0;
    L.kicker = spriteTextu(dpr, KICKER, R.kPx, 700, FARBY.zlata);
    L.nazov = spriteTitulu(dpr, ['Puzzle', 'Calendar'], R.tPx, w, 'left');
    L.znacka = spriteZnacky(dpr, ZNACKA, R.bPx, w, mp);
    L.veta = spriteRiadku(dpr, VETA, R.lPx, w, { vaha: 600, farba: FARBY.text2, zarovnanie: 'left', maxRiadkov: 2 });
    const spolu = L.kicker.h + g1 + L.nazov.h + g2 + L.znacka.h + g2 + L.veta.h + g2 * 1.4 + L.url.h;
    let y = Z.y0 + (Z.h - spolu) / 2;
    P.kicker = { x: x0 - L.kicker.px * 0.1, y }; y += L.kicker.h + g1;
    P.nazov = { x: x0, y }; y += L.nazov.h + g2;
    P.znacka = { x: x0, y }; y += L.znacka.h + g2;
    P.veta = { x: x0, y }; y += L.veta.h + g2 * 1.4;
    P.url = { x: x0, y };
    LI = list(R, { x: Z.x0, y: Z.y0, w: Z.w * 0.57, h: Z.h });
    titPas = { x: x0, y: Z.y0, w, h: Z.h };
    L.K = 1;
    L.kotva = { x: LI.x, y: LI.y };
  } else {
    R.zar = 'left'; zarTit = 'left';
    const x0 = Z.x0 + Z.w * 0.67, w = Z.x1 - x0;
    L.kicker = spriteTextu(dpr, KICKER, R.kPx, 700, FARBY.zlata, SANS, w, mp);
    L.nazov = spriteTitulu(dpr, ['Puzzle', 'Calendar'], R.tPx * 1.1, w, 'left');
    L.znacka = spriteZnacky(dpr, ZNACKA, R.bPx, w, mp);
    L.veta = spriteRiadku(dpr, VETA, R.lPx, Z.w, { vaha: 600, farba: FARBY.text2, zarovnanie: 'left', maxRiadkov: 1 });
    P.url = { x: Z.x0, y: Math.min(Z.y1 - L.url.h * 0.42, H * 0.9) - L.url.h };
    P.veta = { x: Z.x0, y: P.url.y - g2 - L.veta.h };
    LI = list(R, { x: Z.x0, y: Z.y0, w: x0 - s * 0.03 - Z.x0, h: P.veta.y - g3 - Z.y0 });
    LI.x = Z.x0; LI.y = Z.y0;
    const spolu = L.kicker.h + g1 + L.nazov.h + g2 * 1.4 + L.znacka.h;
    let y = LI.y + (LI.h - spolu) / 2;
    P.kicker = { x: x0 - L.kicker.px * 0.1, y }; y += L.kicker.h + g1;
    P.nazov = { x: x0, y }; y += L.nazov.h + g2 * 1.4;
    P.znacka = { x: x0, y };
    const y0 = LI.y + LI.h + s * 0.02;
    titPas = { x: Z.x0, y: y0, w: Z.w, h: Z.y1 - y0 };
    L.K = 1;
    L.kotva = { x: LI.x, y: LI.y };
  }
  L.P = P;
  L.LI = LI;
  R.titPas = titPas;
  L.btn = { x: P.url.x + L.url.m, y: P.url.y + L.url.m, w: L.url.pw, h: L.url.ph };

  // titulky
  L.titulky = TITULKY.map((x) => {
    const sp = spriteRiadku(dpr, x.text, R.cPx, titPas.w, { vaha: 600, farba: FARBY.text, zarovnanie: zarTit, maxRiadkov: 2 });
    return { ...x, sp, y: titPas.y + (titPas.h - sp.h) / 2 };
  });

  // list (predná strana s Nonogramom, zadná s Hashi); rozlíšenie na najväčšiu mierku príbehu
  const K = L.K;
  L.list10 = spriteListu(dpr, LI, R, 'n10', K);
  L.listPrazdny = spriteListu(dpr, LI, R, 'prazdny', K);
  L.stoh = spriteListu(dpr, LI, R, 'n15', K, FARBY.papierStoh);
  // zvonček: skutočné riešenie ako červené bunky
  const c = LI.c;
  L.zvon = sprite(dpr * K, 10 * c, 10 * c, (x) => {
    x.fillStyle = FARBY.cervena;
    for (let j = 0; j < 100; j++) if (FAKTY.riesenie[j] === '1') x.fillRect((j % 10) * c - 0.4, Math.floor(j / 10) * c - 0.4, c + 0.8, c + 0.8);
  });
  // hlavička a zadania (text)
  L.hlavicka = sprite(dpr * K, LI.w, LI.pad + LI.hH + 4, (x) => {
    const fb = Math.max(mp, LI.hH * 0.62);
    x.font = pismo(700, fb, SANS); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = FARBY.papier;
    x.fillText(String(FAKTY.den), LI.pad + LI.hH / 2, LI.pad + LI.hH / 2 + fb * 0.04);
    const fh = Math.max(mp, LI.hH * 0.78);
    x.font = pismo(600, fh, SERIF); x.textAlign = 'left'; x.fillStyle = FARBY.ink;
    x.fillText(HLAVICKA, LI.pad + LI.hH + s * 0.018, LI.pad + LI.hH / 2 + fh * 0.04);
  });
  L.zadania = sprite(dpr * K, LI.w, LI.h, (x) => {
    x.font = pismo(600, LI.f, SANS); x.fillStyle = FARBY.ink;
    x.textAlign = 'right'; x.textBaseline = 'middle';
    FAKTY.riadky.forEach((b, r) => x.fillText(b.join(' '), LI.gx - LI.f * 0.25, LI.gy + (r + 0.5) * c));
    x.textAlign = 'center'; x.textBaseline = 'bottom';
    FAKTY.stlpce.forEach((b, k) => x.fillText(b.join(' '), LI.gx + (k + 0.5) * c, LI.gy - LI.f * 0.12));
  });
  // Hashi na zadnej strane: 7 x 7 v ploche zadaní a mriežky
  const plochaW = LI.cc + 10 * c, plochaH = LI.cr + 10 * c;
  const hc = Math.min(plochaW, plochaH) / FAKTY.hashiN;
  const hx = LI.pad + (plochaW - hc * FAKTY.hashiN) / 2, hy = LI.pad + LI.hH + LI.gapH + (plochaH - hc * FAKTY.hashiN) / 2;
  L.hashi = { hc, hx, hy };
  const fd = Math.max(mp, hc * 0.46);
  L.ostrovy = FAKTY.ostrovy.map((o) => {
    const sp = spriteTextu(dpr * K, String(o.n), fd, 700, FARBY.ink);
    return { ...o, sp, cx: hx + (o.c + 0.5) * hc, cy: hy + (o.r + 0.5) * hc };
  });
  L.listZadny = sprite(dpr, (LI.w + 2 * LI.okraj) * K, (LI.h + 2 * LI.okraj) * K, (x) => {
    x.scale(K, K);
    x.translate(LI.okraj, LI.okraj);
    kresliObsahListu(x, LI, R, 'prazdny', K);
    for (const o of L.ostrovy) kresliOstrov(x, o.cx, o.cy, hc * 0.38, s);
  });

  L.zrna = zrno(3, 192, 1, 11).map((z) => ({ z }));
  L.priblizenie0 = PRIBLIZENIE_HAKU;
  if (F.druh === 'vysoky' && L.nazov.textW * PRIBLIZENIE_HAKU > W * MAX_NAZOV_916) L.priblizenie0 = (W * MAX_NAZOV_916) / L.nazov.textW;
  L.slabe = !!env.slabe;
}

function kresliOstrov(x, cx, cy, r, s) {
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2);
  x.fillStyle = '#ffffff'; x.fill();
  x.lineWidth = Math.max(2, s * 0.004); x.strokeStyle = FARBY.ink; x.stroke();
}

// ---------- mierka listu (pružina) ----------

/** 1 v háku a závere, K v príbehu: jedna pružina nahor v rastOd a jedna nadol v zmensiOd (súčet, nie reštart). */
function mierkaListu(t) {
  return 1 + (L.K - 1) * (pruzina(t - T.rastOd) - pruzina(t - T.zmensiOd));
}

// ---------- sneh a hviezdy (periódy delia dĺžku filmu: slučka bez skoku) ----------

function kresliSneh(x, t) {
  const { W, H, R } = L, s = R.s, n = L.slabe ? 34 : 70, vys = H + 40;
  const skupiny = [[], [], []];
  for (let i = 0; i < n; i++) {
    const m = hash(i, 3) < 0.35 ? 2 : 1;
    const y = ((hash(i, 2) * vys + (m * vys * t) / DLZKA) % vys) - 20;
    const x0 = hash(i, 1) * W + s * 0.012 * Math.sin((2 * Math.PI * t) / (DLZKA / (1 + (i % 3))) + hash(i, 6) * 6.28);
    skupiny[i % 3].push([x0, y, s * (0.0022 + 0.0042 * hash(i, 4)) * (m === 2 ? 1.2 : 1)]);
  }
  skupiny.forEach((sk, k) => {
    x.fillStyle = `rgba(255,255,255,${[0.35, 0.55, 0.8][k]})`;
    x.beginPath();
    for (const [a, b, r] of sk) { x.moveTo(a + r, b); x.arc(a, b, r, 0, Math.PI * 2); }
    x.fill();
  });
  L.R.hviezdy.forEach((h, i) => {
    const r = h.r * (1 + 0.08 * Math.sin((2 * Math.PI * t) / (DLZKA / 6) + i * 2));
    hviezda(x, h.x, h.y, r, 0.05 * Math.sin((2 * Math.PI * t) / (DLZKA / 4)));
    x.fillStyle = i ? 'rgba(226,184,90,0.7)' : FARBY.zlata; x.fill();
  });
}

// ---------- list: hák, reset, riešenie, zvonček, otočenie, Hashi, obnova ----------

/** Fáza odlesku po liste: spojitá cez slučku (koniec filmu pokračuje do začiatku). */
function lesk(t) {
  const u = t < 5 ? t : t - DLZKA;
  const q = (u + 0.9) / 2.2;
  return q > 0 && q < 1 ? q : null;
}

function kresliStoh(x) {
  const LI = L.LI, o = LI.okraj, s = L.R.s, sp = L.stoh;
  const cx = LI.x + LI.w / 2, cy = LI.y + LI.h / 2;
  // rohy otočených listov vyjdú najviac o 1,5 % kratšej strany (medzera k textom je 2,6 %)
  for (const [uh, dx, dy] of [[-0.036, -s * 0.014, -s * 0.002], [0.026, s * 0.012, -s * 0.004]]) {
    x.save();
    x.translate(cx + dx, cy + dy); x.rotate(uh); x.translate(-cx, -cy);
    x.drawImage(sp.c, LI.x - o, LI.y - o, LI.w + 2 * o, LI.h + 2 * o);
    x.restore();
  }
}

function kresliList(x, t) {
  const LI = L.LI, k = mierkaListu(t);
  x.save();
  if (Math.abs(k - 1) > 1e-6) { x.translate(L.kotva.x, L.kotva.y); x.scale(k, k); x.translate(-L.kotva.x, -L.kotva.y); }
  kresliStoh(x);
  const X = LI.x, Y = LI.y, o = LI.okraj, c = LI.c, s = L.R.s;
  const plny = (sp) => x.drawImage(sp.c, X - o, Y - o, LI.w + 2 * o, LI.h + 2 * o);
  const zvon = () => x.drawImage(L.zvon.c, X + LI.gx, Y + LI.gy, 10 * c, 10 * c);
  if (t >= T.flipOd && t < T.flipDo) {
    // otočenie listu na zadnú stranu (bez textu: texty odišli pred otočením). Zadná strana je pri otáčaní
    // prázdna, ostrovy Hashi na nej vzniknú až po otočení (pokus 3: v 12,1 s už neblikne desať kruhov)
    const q = okno(t, T.flipOd, T.flipDo), sx = Math.cos(Math.PI * ease.inOutSine(q)), cx = X + LI.w / 2;
    x.translate(cx, 0); x.scale(Math.max(0.02, Math.abs(sx)), 1); x.translate(-cx, 0);
    plny(L.listPrazdny);
    if (sx > 0) zvon();
  } else if (t >= T.flipDo && t < T.spatOd) {
    // zadná strana: Hashi z 1. decembra, ostrovy vyskočia jeden po druhom
    plny(L.listPrazdny);
    const hc = L.hashi.hc;
    const aT = obmedz((t - T.flipDo) / 0.3) * (1 - obmedz((t - T.zadnyTextPrec) / 0.2));
    L.ostrovy.forEach((ost, i) => {
      const p = okno(t, T.ostrovyOd + i * T.ostrovyKrok, T.ostrovyOd + i * T.ostrovyKrok + T.ostrovTrv);
      if (p <= 0) return;
      kresliOstrov(x, X + ost.cx, Y + ost.cy, Math.max(0, hc * 0.38 * ease.outBack(p, PREKMIT)), s);
      const a = obmedz((p - 0.6) / 0.4) * aT;
      if (a > 0) {
        x.save(); x.globalAlpha = a;
        x.drawImage(ost.sp.c, X + ost.cx - ost.sp.w / 2, Y + ost.cy - ost.sp.h / 2 + ost.sp.px * 0.02, ost.sp.w, ost.sp.h);
        x.restore();
      }
    });
    if (aT > 0) { x.save(); x.globalAlpha = aT; x.drawImage(L.hlavicka.c, X, Y, LI.w, L.hlavicka.h); x.restore(); }
  } else if (t >= T.spatOd && t < T.spatDo) {
    // otočenie späť na prednú stranu so zvončekom (to isté zúženie podľa kosínusu, bez textu)
    const q = okno(t, T.spatOd, T.spatDo), sx = Math.cos(Math.PI * ease.inOutSine(q)), cx = X + LI.w / 2;
    x.translate(cx, 0); x.scale(Math.max(0.02, Math.abs(sx)), 1); x.translate(-cx, 0);
    if (sx > 0) plny(L.listZadny); else { plny(L.listPrazdny); zvon(); }
  } else if (t < T.resetOd || t >= T.spatDo) {
    // hák a záver: hotový list (mriežka, zadania, zvonček); v závere sa mriežka a zadania vrátia
    const gA = t < T.resetOd ? 1 : obmedz((t - T.obnovaOd) / 0.4);
    const tA = t < T.resetOd ? 1 : obmedz((t - T.obnovaOd - 0.15) / 0.35);
    if (gA < 1) {
      plny(L.listPrazdny);
      if (gA > 0) { x.save(); x.globalAlpha = gA; plny(L.list10); x.restore(); }
    } else plny(L.list10);
    zvon();
    if (tA > 0) {
      x.save(); x.globalAlpha = tA;
      x.drawImage(L.hlavicka.c, X, Y, LI.w, L.hlavicka.h);
      x.drawImage(L.zadania.c, X, Y, LI.w, LI.h);
      x.restore();
    }
    // teplý odlesk prejde po liste (koniec slučky pokračuje do začiatku)
    const q = lesk(t);
    if (q !== null) {
      x.save();
      x.beginPath(); x.rect(X, Y, LI.w, LI.h); x.clip();
      const bx = X + lerp(-0.35, 1.35, ease.inOutSine(q)) * LI.w, bw = LI.w * 0.22;
      x.transform(1, 0, -0.35, 1, (Y + LI.h / 2) * 0.35, 0);
      const lg = x.createLinearGradient(bx - bw, 0, bx + bw, 0);
      const a = (0.26 * Math.sin(Math.PI * q)).toFixed(3);
      lg.addColorStop(0, 'rgba(255,240,205,0)'); lg.addColorStop(0.5, `rgba(255,240,205,${a})`); lg.addColorStop(1, 'rgba(255,240,205,0)');
      x.fillStyle = lg; x.fillRect(bx - bw, Y, 2 * bw, LI.h);
      x.restore();
    }
  } else {
    kresliPrednu(x, t, X, Y);
  }
  x.restore();
}

/** Predná strana od resetu po otočenie: bunky zvončeka odídu, riešenie, zvonček sa rozhojdá. */
function kresliPrednu(x, t, X, Y) {
  const LI = L.LI, o = LI.okraj, c = LI.c, s = L.R.s;
  const gx = X + LI.gx, gy = Y + LI.gy;
  // mriežka zmizne po vyriešení, zvonček ostane
  const mp = obmedz((t - T.hotovo) / T.mriezkaPrec);
  if (mp > 0) x.drawImage(L.listPrazdny.c, X - o, Y - o, LI.w + 2 * o, LI.h + 2 * o);
  if (mp < 1) { x.save(); x.globalAlpha = 1 - mp; x.drawImage(L.list10.c, X - o, Y - o, LI.w + 2 * o, LI.h + 2 * o); x.restore(); }
  // zvýraznenie riadku alebo stĺpca, ktorý riešič práve prechádza (aj jeho zadanie)
  const krok = KROKY.find((k) => t >= k.od && t < k.do);
  if (krok) {
    const p = okno(t, krok.od, krok.do), a = 0.3 * Math.sin(Math.PI * obmedz(p * 1.2));
    x.fillStyle = `rgba(226,184,90,${a.toFixed(3)})`;
    if (krok.typ === 'r') x.fillRect(X + LI.pad * 0.5, gy + krok.i * c, LI.gx - LI.pad * 0.5 + 10 * c, c);
    else x.fillRect(gx + krok.i * c, Y + LI.pad + LI.hH + LI.gapH * 0.6, c, LI.cr + 10 * c - LI.gapH * 0.1);
  }
  if (t < T.hotovo) {
    x.fillStyle = FARBY.cervena;
    // reset: bunky zvončeka z háku sa zmrštia v šikmej vlne zhora (od resetOd, 0,45 s)
    if (t < T.riesOd) {
      for (let j = 0; j < 100; j++) {
        if (FAKTY.riesenie[j] !== '1') continue;
        const r = Math.floor(j / 10), cc = j % 10, d = (r + cc) / 18;
        const p = ease.inOutCubic(okno(t, T.resetOd + d * 0.3, T.resetOd + d * 0.3 + 0.18));
        if (p >= 1) continue;
        const w = c * (1 - p) + 0.8;
        x.fillRect(gx + cc * c + (c - w) / 2, gy + r * c + (c - w) / 2, w, w);
      }
    }
    for (const [j, b] of KEDY) {
      if (b.v !== 1) continue;
      const p = okno(t, b.t, b.t + 0.22);
      if (p <= 0) continue;
      const k = ease.outBack(p, PREKMIT), r = Math.floor(j / 10), cc = j % 10;
      const w = c * k;
      x.fillRect(gx + cc * c + (c - w) / 2, gy + r * c + (c - w) / 2, w, w);
    }
  } else {
    // zvonček sa rozhojdá okolo horného stredu
    const tz = t - T.zvonOd;
    const u = tz > 0 ? 0.13 * Math.sin((2 * Math.PI * tz) / 0.8) * Math.exp(-tz * 1.5) : 0;
    const pvx = gx + 5 * c, pvy = gy;
    x.save();
    x.translate(pvx, pvy); x.rotate(u); x.translate(-pvx, -pvy);
    x.drawImage(L.zvon.c, gx, gy, 10 * c, 10 * c);
    x.restore();
    // zlaté iskry z obrázka
    const ti = t - T.hotovo;
    if (ti < 1.2) {
      x.fillStyle = FARBY.zlata;
      x.beginPath();
      for (let i = 0; i < 20; i++) {
        const uh = hash(i, 11) * Math.PI * 2, v = 0.4 + 0.6 * hash(i, 12);
        const d = ease.outCubic(obmedz(ti / 1.2)) * 6.5 * c * v, r = s * 0.006 * (1 - ti / 1.2);
        if (r <= 0) continue;
        const px = gx + 5 * c + Math.cos(uh) * d, py = gy + 5 * c + Math.sin(uh) * d;
        x.moveTo(px + r, py); x.arc(px, py, r, 0, Math.PI * 2);
      }
      x.fill();
    }
  }
  // prázdne bunky: bodky (po vyriešení zmiznú s mriežkou)
  if (mp < 1) {
    x.fillStyle = `rgba(85,85,85,${(1 - mp).toFixed(3)})`;
    x.beginPath();
    for (const [j, b] of KEDY) {
      if (b.v !== 0) continue;
      const p = okno(t, b.t, b.t + 0.18);
      if (p <= 0) continue;
      const r = Math.floor(j / 10), cc = j % 10, rr = c * 0.09 * ease.outCubic(p);
      x.moveTo(gx + (cc + 0.5) * c + rr, gy + (r + 0.5) * c); x.arc(gx + (cc + 0.5) * c, gy + (r + 0.5) * c, rr, 0, Math.PI * 2);
    }
    x.fill();
  }
  // texty listu: sú na liste od háku, odídu pred otočením
  const aT = 1 - obmedz((t - T.flipTextPrec) / 0.25);
  if (aT > 0) {
    x.save(); x.globalAlpha = aT;
    x.drawImage(L.hlavicka.c, X, Y, LI.w, L.hlavicka.h);
    x.drawImage(L.zadania.c, X, Y, LI.w, LI.h);
    x.restore();
  }
}

// ---------- texty háku, titulky, záver ----------

function kresliTexty(x, t) {
  const P = L.P;
  // texty háku sú preč v 3,55 s (HAK.vidno = 0); ďalej sa nekreslia, aby prvý titulok mohol prísť hneď
  if (t < HAK.koniec && HAK.vidno(t) > 0) {
    HAK.kresliNazov(x, t, L.nazov, P.nazov.x, P.nazov.y);
    HAK.kresliRiadok(x, t, L.kicker, P.kicker.x, P.kicker.y, 0.1);
    HAK.kresliRiadok(x, t, L.znacka, P.znacka.x, P.znacka.y, 0.04);
    HAK.kresliRiadok(x, t, L.veta, P.veta.x, P.veta.y, 0.06);
    HAK.kresliRiadok(x, t, L.url, P.url.x, P.url.y, 0.02);
  }
  for (const tt of L.titulky) {
    const a = obalka(t, tt.od, tt.do, TIT_NABEH, TIT_DOBEH);
    if (a <= 0) continue;
    const vstup = ease.outCubic(okno(t, tt.od, tt.od + 0.25));
    x.save(); x.globalAlpha = a;
    x.drawImage(tt.sp.c, L.R.titPas.x, tt.y + (1 - vstup) * L.R.s * 0.012, tt.sp.w, tt.sp.h);
    x.restore();
  }
  // záver: rovnaké zloženie ako hák; názov sa do poslednej snímky priblíži na mierku snímky 0
  const vyjdi = (sp, od, px0, y, trv = 0.6) => {
    const p = ease.outCubic(okno(t, od, od + trv));
    if (p <= 0) return;
    x.save();
    x.globalAlpha = obmedz(p * 1.4);
    x.drawImage(sp.c, px0, y + (1 - p) * sp.h * 0.25, sp.w, sp.h);
    x.restore();
  };
  if (t >= T.nazov) {
    const sp = L.nazov, k = lerp(1, L.priblizenie0, ease.inOutSine(okno(t, T.nazovBlizsieOd, DLZKA)));
    const scx = P.nazov.x + sp.w / 2, scy = P.nazov.y + sp.h / 2;
    x.save(); x.translate(scx, scy); x.scale(k, k); x.translate(-scx, -scy);
    vyjdi(sp, T.nazov, P.nazov.x, P.nazov.y, 0.75);
    x.restore();
  }
  vyjdi(L.kicker, T.nazov, P.kicker.x, P.kicker.y);
  vyjdi(L.znacka, T.znacka, P.znacka.x, P.znacka.y, 0.5);
  vyjdi(L.veta, T.veta, P.veta.x, P.veta.y);
  vyjdi(L.url, T.url, P.url.x, P.url.y, 0.5);
}

function kresliZrno(x, t, env) {
  const i = env.slabe ? 0 : Math.abs(Math.floor(t * 12)) % 3;
  const z = L.zrna[i];
  if (!z.vzor) z.vzor = x.createPattern(z.z, 'repeat');
  x.save();
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 0.03;
  x.fillStyle = z.vzor;
  x.fillRect(0, 0, L.W * L.dpr, L.H * L.dpr);
  x.restore();
}

// ---------- film ----------

const film = {
  dlzka: DLZKA,
  // plagát: stred háku, list s hlavolamom, štítok PRINTABLE PDF, názov, ponuka a adresa v plnom kontraste
  plagat: 1.0,
  titulky: [
    { od: 0, text: 'Puzzle Calendar, Advent 2026. The printed sheet for December 1 on a dark green night, snow falling: a Nonogram with its row and column numbers, filled in as a red bell. Two more sheets lie under it. A red label says printable PDF. 24 days, 48 logic puzzles. arlingpuzzles.etsy.com.' },
    { od: 3.3, text: 'The red cells clear and the sheet comes closer. December 1: find the picture.' },
    { od: 4.0, text: 'The Nonogram solves itself line by line, without guessing. Each row or column lights up, and the cells it proves turn red or get a dot.' },
    { od: 9.0, text: 'The grid disappears and the picture is a bell, which swings. 23 more pictures wait on the other sheets.' },
    { od: 11.5, text: 'The sheet turns over. On the back is the Hashi puzzle for December 1. Other days have Kakuro or Slitherlink. The sheet turns back to the bell.' },
    { od: 14.9, text: 'The grid and the numbers come back. Puzzle Calendar, Advent 2026. Printable PDF. 24 days, 48 logic puzzles. arlingpuzzles.etsy.com.' },
  ],
  async pripravit() {
    if (document.fonts && document.fonts.load) {
      await Promise.all([
        document.fonts.load(pismo(700, 40)), document.fonts.load(pismo(600, 40)),
        document.fonts.load(pismo(600, 40, SERIF)),
      ]).catch(() => {});
    }
  },
  vrstvy: stavVrstiev,
  kresli(x, t, W, H, env) {
    x.drawImage(L.poz, 0, 0, W, H);
    kresliSneh(x, t);
    kresliList(x, t);
    kresliTexty(x, t);
    kresliZrno(x, t, env);
  },
  stredPlagatu() { return [L.LI.x + L.LI.w / 2, L.LI.y + L.LI.h / 2]; },
  // pilulka s adresou obchodu vedie na ponuku kalendára na Etsy; odkaz je aktívny vždy, keď je pilulka
  // nakreslená: v háku (aj na statickom plagáte 1,0 s pri zníženom pohybe) a od záveru do konca (pokus 3)
  odkazy() {
    const b = L.btn;
    return [{ x: b.x, y: b.y, w: b.w, h: b.h, href: FAKTY.url, text: 'Advent Puzzle Calendar 2026 on Etsy', casy: CASY_ODKAZU, udalost: 'advent_film_to_etsy' }];
  },
  zvuk: partitura(),
  kontrola: {
    titulky: TITULKY,
    titObalka: { nabeh: TIT_NABEH, dobeh: TIT_DOBEH },
    texty: [KICKER, NAZOV, ZNACKA, VETA, FAKTY.obchod, HLAVICKA, ...TITULKY.map((x) => x.text)],
    ponuka: { znacka: ZNACKA, veta: VETA, adresa: FAKTY.obchod },
    kroky: KROKY,
    riesenie: RIESENIE.g,
    T,
    sprity: () => L && {
      poz: L.poz, listy: [L.list10.c, L.listPrazdny.c, L.listZadny.c], stoh: L.stoh.c,
      nazov: L.nazov.c, kicker: L.kicker.c, znacka: L.znacka.c, veta: L.veta.c, url: L.url.c,
      zadania: L.zadania.c, hlavicka: L.hlavicka.c, zvon: L.zvon.c, cisla: L.ostrovy.map((o) => o.sp.c),
    },
    rozlozenie: () => L && { druh: L.druh, list: { x: L.LI.x, y: L.LI.y, w: L.LI.w, h: L.LI.h, c: L.LI.c, f: L.LI.f }, K: L.K, ostrovR: L.hashi.hc * 0.38 },
    farbaBunky: FARBY.cervena,
    casyOdkazu: CASY_ODKAZU,
  },
};

function partitura() {
  const u = [];
  // hák: teplý C dur so zvonmi a jemné rolničky (krátke vysoké ťuky)
  u.push(...HAK.zvuk({ akord: ['C3', 'G3', 'E4', 'G4'], zvony: ['E5', 'G5', 'C6'] }));
  for (let i = 0; i < 7; i++) u.push({ t: 0.08 + i * 0.13, typ: 'tuk', f: 2600 + (i % 3) * 420, dlzka: 0.04, hlas: 0.018, pan: -0.4 + (i % 4) * 0.25 });
  // hák drží 3 s: tichý pad a rolničky na dobe 1,5 s, aby hák nestíchol
  u.push({ t: 1.5, typ: 'pad', noty: ['C3', 'E4', 'G4', 'D5'], dlzka: 1.9, nabeh: 0.4, dobeh: 0.6, hlas: 0.07, filter: 1200 });
  for (let i = 0; i < 4; i++) u.push({ t: 1.5 + i * 0.13, typ: 'tuk', f: 2800 + (i % 2) * 380, dlzka: 0.04, hlas: 0.014, pan: 0.3 - i * 0.2 });
  // reset: bunky zvončeka odídu (klesajúce ťuky), list sa priblíži (šum nahor)
  for (let i = 0; i < 6; i++) u.push({ t: T.resetOd + 0.05 + i * 0.07, typ: 'tuk', f: 1800 - i * 180, dlzka: 0.04, hlas: 0.03, pan: -0.3 + i * 0.12 });
  u.push({ t: T.rastOd, typ: 'sum', filter: 'bandpass', f0: 600, f1: 2200, q: 0.7, dlzka: 0.5, nabeh: 0.3, tvar: 'narast', hlas: 0.045 });
  // pulz 120 BPM pod príbehom
  for (let t = 3.5; t < 14.9; t += 0.5) {
    u.push({ t, typ: 'tuk', f: 98, dlzka: 0.14, hlas: 0.04 });
    u.push({ t: t + 0.25, typ: 'tuk', f: 392, dlzka: 0.04, hlas: 0.014, pan: 0.2 });
  }
  u.push({ t: 3.5, typ: 'pad', noty: ['A2', 'E3', 'C4', 'G4'], dlzka: 2.2, nabeh: 0.4, dobeh: 0.6, hlas: 0.11, filter: 900 });
  u.push({ t: 5.5, typ: 'pad', noty: ['F2', 'C3', 'A3', 'E4'], dlzka: 1.9, nabeh: 0.4, dobeh: 0.6, hlas: 0.11, filter: 1000 });
  u.push({ t: 7.0, typ: 'pad', noty: ['C3', 'G3', 'E4', 'D5'], dlzka: 1.2, nabeh: 0.4, dobeh: 0.5, hlas: 0.1, filter: 1100 });
  u.push({ t: 8.0, typ: 'pad', noty: ['G2', 'D3', 'B3', 'G4'], dlzka: 1.1, nabeh: 0.4, dobeh: 0.5, hlas: 0.1, filter: 1100 });
  // riešenie: každý krok svoj tón (riadky stúpajú, stĺpce klesajú), ceruzka na papieri
  const tony = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6'];
  KROKY.forEach((k, i) => {
    const f = k.typ === 'r' ? tony[k.i] : tony[9 - k.i];
    const t = k.od + (k.do - k.od) * 0.25;
    u.push({ t, typ: 'zvon', f, index: 0.7, dlzka: 0.8, hlas: 0.055, pan: k.typ === 'r' ? -0.2 : 0.2, dozvuk: 0.35 });
    u.push({ t, typ: 'sum', filter: 'bandpass', f0: 3000, f1: 3500, q: 2, dlzka: Math.min(0.2, (k.do - k.od) * 0.6), hlas: 0.018, pan: (i % 2 ? 0.15 : -0.15) });
  });
  // hotovo: zvonček (neharmonický pomer ako skutočný zvon), hojdanie a C dur
  u.push({ t: T.hotovo, typ: 'pad', noty: ['C3', 'G3', 'E4', 'G4'], dlzka: 2.6, nabeh: 0.15, dobeh: 1.0, hlas: 0.13, filter: 1500 });
  u.push({ t: T.hotovo, typ: 'zvon', f: 'C6', pomer: 3.5, index: 0.7, dlzka: 2.0, hlas: 0.09, dozvuk: 0.6 });
  u.push({ t: T.hotovo + 0.02, typ: 'zvon', f: 'G5', index: 0.5, dlzka: 1.8, hlas: 0.05, dozvuk: 0.6 });
  u.push({ t: T.hotovo, typ: 'sum', filter: 'highpass', f0: 5000, f1: 9000, dlzka: 0.9, hlas: 0.03, dozvuk: 0.6 });
  [0.4, 0.8, 1.2].forEach((d, i) => u.push({ t: T.zvonOd + d, typ: 'zvon', f: i % 2 ? 'G5' : 'C6', pomer: 3.5, index: 0.6, dlzka: 1.2, hlas: 0.06 * Math.exp(-d * 1.5), pan: i % 2 ? 0.25 : -0.25, dozvuk: 0.5 }));
  // otočenie listu a ostrovy Hashi
  u.push({ t: T.flipOd - 0.3, typ: 'pad', noty: ['F2', 'C3', 'A3', 'C4'], dlzka: 3.2, nabeh: 0.4, dobeh: 0.7, hlas: 0.1, filter: 1000 });
  u.push({ t: T.flipOd, typ: 'sum', filter: 'bandpass', f0: 800, f1: 3000, q: 0.8, dlzka: T.flipDo - T.flipOd, nabeh: 0.4, tvar: 'narast', hlas: 0.05 });
  FAKTY.ostrovy.forEach((o, i) => {
    const t = T.ostrovyOd + i * T.ostrovyKrok + 0.1;
    u.push({ t, typ: 'tuk', f: 400 + i * 40, dlzka: 0.05, hlas: 0.045, pan: (o.c - 3) * 0.1 });
  });
  u.push({ t: T.ostrovyOd + 0.7, typ: 'zvon', f: 'E6', index: 0.5, dlzka: 1.0, hlas: 0.04, dozvuk: 0.5 });
  u.push({ t: T.spatOd, typ: 'sum', filter: 'bandpass', f0: 3000, f1: 900, q: 0.8, dlzka: T.spatDo - T.spatOd, nabeh: 0.15, tvar: 'narast', hlas: 0.04 });
  // obnova: mriežka a zadania sa vrátia, list sa vráti na miesto háku
  u.push({ t: T.zmensiOd, typ: 'sum', filter: 'bandpass', f0: 2600, f1: 500, q: 0.7, dlzka: 0.6, nabeh: 0.2, tvar: 'narast', hlas: 0.045 });
  u.push({ t: T.obnovaOd + 0.05, typ: 'pad', noty: ['G2', 'D3', 'B3', 'D4'], dlzka: 1.0, nabeh: 0.3, dobeh: 0.5, hlas: 0.09, filter: 1000 });
  // záver: C dur, zvony na názov, štítok a adresu, tichý pad a rolničky do konca (šev slučky)
  u.push({ t: T.nazov, typ: 'pad', noty: ['C3', 'G3', 'E4', 'G4'], dlzka: 2.2, nabeh: 0.3, dobeh: 1.0, hlas: 0.14, filter: 1500, filter2: 800 });
  u.push({ t: T.nazov, typ: 'zvon', f: 'C5', index: 0.5, dlzka: 1.8, hlas: 0.08, dozvuk: 0.55 });
  u.push({ t: T.znacka, typ: 'zvon', f: 'E5', index: 0.4, dlzka: 1.3, hlas: 0.05, dozvuk: 0.5 });
  u.push({ t: T.url + 0.1, typ: 'zvon', f: 'G5', index: 0.5, dlzka: 1.0, hlas: 0.05, dozvuk: 0.5 });
  u.push({ t: 17.0, typ: 'pad', noty: ['C3', 'E4', 'G4', 'D5'], dlzka: 2.8, nabeh: 0.5, dobeh: 1.0, hlas: 0.07, filter: 1200 });
  for (let i = 0; i < 4; i++) u.push({ t: 18.0 + i * 0.13, typ: 'tuk', f: 2600 + (i % 2) * 420, dlzka: 0.04, hlas: 0.014, pan: -0.3 + i * 0.2 });
  return u.filter((e) => e.t >= 0 && e.t < DLZKA);
}

export default film;
