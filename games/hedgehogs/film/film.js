// Hedgehogs: film na 19 sekúnd, nakreslený a ozvučený kódom (kodfilm engine).
// Pravidlá hry: dvaja ježkovia v každom riadku, stĺpci a záhone, nikdy sa nedotýkajú, ani rohom.
// Scény: hák (vyriešená záhrada v pohybe, ježkovia poskakujú vo vlne svetla, názov od snímky 0),
// ježkovia sa schovajú, 10 ježkov dopadne, dedukcia v riadku 3 (bodliny a plný stĺpec vylúčia
// šesť buniek, ostane jedna), dokončenie, vlna, názov a „Free at arling.sk/games“.
//
// Záhrada je archívny deň 2026-06-01 (Easy, 8 x 8) z generátora hry (games/hedgehogs/dni/2026-06.json).
// Jedinečnosť riešenia overil solve() z generator.mjs (1 riešenie, úplné prehľadanie), pravidlá
// checkSolution() aj jeVyriesene() z logika.mjs; film pri načítaní overí pravidlá a dedukciu znova.

import { okno, obmedz, lerp, ease, hash, obalka } from './engine/cas.js';
import { platno, zrno, zaoblene, pismo, textRozostup } from './engine/kresba.js';
import { hak, format, zona, sprite, spriteNazvu, spriteRiadku, vyvazZalom, minPismo } from './engine/hak.js';
import { spriteJezka, iskra } from './jezko.js';

const DLZKA = 19;
const N = 8, STARS = 2;
const ZAHONY = 'AABBBBBCAABCBBCCAACCCCCDEAFFFFDDEEFGGFFDEEFFGFDDEEGGGHHDGGGHHHHD';
const RIESENIE = [1, 3, 13, 15, 17, 19, 29, 31, 32, 34, 44, 46, 48, 50, 60, 62];
const zahon = (i) => ZAHONY.charCodeAt(i) - 65;
const rad = (i) => (i / N) | 0, stl = (i) => i % N;
const dotyk = (a, b) => a !== b && Math.abs(rad(a) - rad(b)) <= 1 && Math.abs(stl(a) - stl(b)) <= 1;

const HAK = hak({ drz: 1.3, odchod: 0.6 }); // hák do 1,9 s

// Kamera háku: snímka 0 je priblížená na dvoch veľkých ježkov (32 a 34), do 1,15 s sa vzdiali na celú
// záhradu; názov je pod záhradou viditeľný od snímky 0. Na konci sa kamera znova priblíži, takže
// posledná snímka nadväzuje na snímku 0 (slučka bez skoku). Priblíženie je orezané na rám záhrady.
const KAMERA = 2.2;
const FOKUS = [4.5, 1.95]; // stred kamery v bunkách [riadok, stĺpec]: ježkovia 32 a 34 celí v zábere
const SKOK_HAKU = 34;     // ježko, ktorý na snímke 0 poskočí

// --- časová os (sekundy) ---
const T = {
  hakVlna: [-0.45, 0.95],
  kameraHak: [0.08, 1.15], kameraKoniec: [18.15, 19],
  cistOd: 1.3, cistDo: 1.95,
  stitokOd: 1.5,
  padOd: 2.0, padKrok: 0.36, padTrvanie: 0.32,
  tlmOd: 6.2, duchOd: 6.5,
  zony: [8.15, 8.5, 8.85], zonaTrv: 0.35,
  stlpecOd: 9.65, lucOd: 9.85, lucTrvanie: 0.6,
  pulz: 10.95, jezOd: 11.45, jezTrvanie: 0.26,
  tlmDo: 11.95,
  finOd: 12.2, finKrok: 0.15, finTrvanie: 0.22,
  vlnaOd: 13.2, vlnaDo: 14.3,
  presunOd: 13.95, presunDo: 14.8,
  nazov: 14.6, veta: 15.1, veta2: 15.5, tlacidlo: 16.0, tiraz: 16.7,
};

// Stav pred dedukciou: 10 ježkov z riešenia v poradí dopadu (poradie je naše, kvôli hudbe).
const PAD = [32, 3, 62, 19, 48, 1, 29, 60, 31, 50];
// Dedukcia v riadku 3 (index 2): riadok potrebuje dvoch ježkov, jeden (bunka 19) už stojí.
const RAD = 2, CIEL = 17;
const DUCHOVIA = [16, 17, 18, 20, 21, 22, 23];
// Bodliny: bunky, ktoré sa dotýkajú ježka, ostanú prázdne. Zóny okolo 19, 29 a 31.
const ZONY = [19, 29, 31];
// Stĺpec 1 (index 0) už má dvoch ježkov (32 a 48), takže bunka 16 ostane prázdna.
const STLPEC = 0, STLPEC_JEZKOVIA = [32, 48];
const FINALE = [13, 15, 34, 44, 46];
// tóny podľa riadku (G pentatonika, vyšší riadok vyšší tón)
const TON_RIADKU = ['E6', 'D6', 'B5', 'A5', 'G5', 'E5', 'D5', 'B4'];

// Kedy bunka v riadku dedukcie zhasne (stane sa z nej bodka) a prečo.
const casVylucenia = {};
ZONY.forEach((h, k) => {
  for (const i of DUCHOVIA) if (casVylucenia[i] == null && dotyk(h, i)) casVylucenia[i] = { t: T.zony[k] + 0.22, dovod: 'dotyk' };
});
casVylucenia[16] = { t: T.lucOd + ((rad(48) - RAD) / rad(48)) * T.lucTrvanie, dovod: 'stlpec' };

// Kontrola pri načítaní: platné riešenie a dedukcia, ktorá z pravidiel naozaj vyplýva.
(function over() {
  const chyba = (m) => { throw new Error('Hedgehogs film: ' + m); };
  const pocet = (f) => { const m = new Map(); for (const i of RIESENIE) m.set(f(i), (m.get(f(i)) || 0) + 1); return m; };
  for (const f of [rad, stl, zahon]) { const m = pocet(f); if (m.size !== N || [...m.values()].some((x) => x !== STARS)) chyba('riešenie nemá 2 v každom riadku, stĺpci a záhone'); }
  for (const a of RIESENIE) for (const b of RIESENIE) if (dotyk(a, b)) chyba('ježkovia sa dotýkajú');
  const S = new Set(PAD);
  if (PAD.some((i) => !RIESENIE.includes(i))) chyba('stav pred dedukciou nie je z riešenia');
  const vRiadku = PAD.filter((i) => rad(i) === RAD).length;
  if (vRiadku !== STARS - 1) chyba('riadok dedukcie nepotrebuje práve jedného ježka');
  const stlC = new Array(N).fill(0), zahC = new Map();
  for (const i of S) { stlC[stl(i)]++; zahC.set(zahon(i), (zahC.get(zahon(i)) || 0) + 1); }
  const volne = [];
  for (let c = 0; c < N; c++) {
    const i = RAD * N + c;
    if (S.has(i)) continue;
    const vylucena = PAD.some((h) => dotyk(h, i)) || stlC[c] >= STARS || (zahC.get(zahon(i)) || 0) >= STARS;
    if (!vylucena) volne.push(i);
    if (vylucena !== (casVylucenia[i] != null)) chyba('film vylučuje inú bunku, než vyplýva z pravidiel: ' + i);
  }
  if (volne.length !== 1 || volne[0] !== CIEL || !RIESENIE.includes(CIEL)) chyba('dedukcia nevedie k jedinej bunke');
  if (STLPEC_JEZKOVIA.some((i) => !S.has(i) || stl(i) !== STLPEC)) chyba('plný stĺpec nesedí');
  const vsetko = new Set([...PAD, CIEL, ...FINALE]);
  if (vsetko.size !== RIESENIE.length || RIESENIE.some((i) => !vsetko.has(i))) chyba('dopady nepokrývajú riešenie');
})();

// Kedy ktorý ježko dopadne.
const casDopadu = {};
PAD.forEach((i, k) => { casDopadu[i] = { od: T.padOd + k * T.padKrok, trv: T.padTrvanie }; });
casDopadu[CIEL] = { od: T.jezOd, trv: T.jezTrvanie, hlavny: true };
FINALE.forEach((i, k) => { casDopadu[i] = { od: T.finOd + k * T.finKrok, trv: T.finTrvanie }; });

const ORANZ = '#ff8a5c', ZLTA = '#facc15', ZLATA = '#f1c56a';
// Titulky nadväzujú bez medzier (koniec jedného = začiatok ďalšieho, len krátke prelínanie).
const TITULKY = [
  { od: 1.45, do: 6.3, text: [['Two', ORANZ], [' hedgehogs in every row, column and flowerbed.']] },
  { od: 6.3, do: 8.05, text: [['Where does '], ['this row', ZLTA], ['’s second hedgehog go?']] },
  { od: 8.05, do: 9.6, text: [['Not '], ['next to', ORANZ], [' a hedgehog, not even at a corner.']] },
  { od: 9.6, do: 10.95, text: [['Not in a '], ['column', ZLATA], [' that already has two.']] },
  { od: 10.95, do: 12.25, text: [['Only '], ['one cell', ZLTA], [' is left.']] },
  { od: 12.25, do: 14.2, text: [['Five more, and the garden is '], ['solved', ORANZ], ['.']] },
];

// farby záhonov ako v hre (index.html, .b[data-reg]), o niečo sýtejšie pre video
const TONY_ZAHONOV = ['242,100,60', '94,207,154', '96,165,250', '250,204,21', '192,132,252', '244,114,182', '45,212,191', '251,146,60'];

// ---------- stav vrstiev (prestavia sa pri zmene rozmeru) ----------
let L = null;

/** Rozloženie podľa pomeru strán: 9:16, 4:5 a 1:1 pod sebou, 16:9 záhrada vľavo a text vpravo. */
function rozlozenie(W, H) {
  const F = format(W, H), Z = zona(W, H);
  if (F.stlpec) {
    const s = Math.min(Z.w * 1.2, Z.h * 0.8);
    const stitokH = s * 0.028 * 1.6, velTit = s * 0.058, capH = velTit * 1.25 * 2 + velTit * 0.4;
    const g1 = s * 0.03, g2 = s * 0.035;
    const B = Math.min(W * 0.8, Z.w * 1.05, Z.h - stitokH - g1 - g2 - capH);
    const top = Z.y0 + (Z.h - (stitokH + g1 + B + g2 + capH)) / 2;
    const by = top + stitokH + g1, bx = (W - B) / 2;
    return { F, Z, s, stred: true, B, bx, by, tx: Z.x0, tw: Z.w, ex: Z.x0, ew: Z.w, tyTit: by + B + g2, stitokY: top, velTit };
  }
  const s = Math.min(W * 0.55, H);
  const B = Math.min(H * 0.8, W * 0.44);
  const bx = Math.max(Z.x0, W * 0.07), by = (H - B) / 2;
  const tx = bx + B + W * 0.06, tw = Z.x1 - tx;
  return { F, Z, s, stred: false, B, bx, by, tx, tw, ex: tx, ew: tw, tyTit: by + B * 0.4, stitokY: by + B * 0.02, velTit: s * 0.062 };
}

function stavVrstiev(W, H, dpr, env) {
  const R = rozlozenie(W, H);
  const { B, bx, by } = R;
  const pad = B * 0.018, c = (B - 2 * pad) / N;
  R.pad = pad; R.c = c;
  R.bunka = (i) => [bx + pad + stl(i) * c, by + pad + rad(i) * c];
  R.stredBunky = (i) => [bx + pad + (stl(i) + 0.5) * c, by + pad + (rad(i) + 0.5) * c];
  const Wd = Math.round(W * dpr), Hd = Math.round(H * dpr);

  // pozadie: teplá tma hubu (#0a0908) s vinetáciou
  const poz = platno(Wd, Hd), px = poz.getContext('2d');
  px.scale(dpr, dpr);
  const g = px.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#15110d'); g.addColorStop(0.55, '#0c0a08'); g.addColorStop(1, '#070605');
  px.fillStyle = g; px.fillRect(0, 0, W, H);
  const vg = px.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  px.fillStyle = vg; px.fillRect(0, 0, W, H);

  // žiara za záhradou (ide so záhradou)
  const ziara = platno(Wd, Hd), zx = ziara.getContext('2d');
  zx.scale(dpr, dpr);
  const zg = zx.createRadialGradient(bx + B / 2, by + B / 2, B * 0.1, bx + B / 2, by + B / 2, B * 0.95);
  zg.addColorStop(0, 'rgba(242,100,60,0.13)'); zg.addColorStop(1, 'rgba(242,100,60,0)');
  zx.fillStyle = zg; zx.fillRect(0, 0, W, H);

  // texty najprv: dopočítajú koncovú polohu záhrady (R.B2), podľa nej je ostrá verzia pre kameru
  const texty = stavTexty(W, H, dpr, R);

  // záhrada: raz v bežnom rozlíšení a raz ostrejšie pre priblíženie kamery v háku a na konci
  const doska = platno(Wd, Hd), dx = doska.getContext('2d');
  dx.scale(dpr, dpr);
  kresliZahradu(dx, R, true);
  const okraj = B * 0.03, mHD = KAMERA * (R.B2 / B) * dpr;
  const doskaHD = platno(Math.ceil((B + 2 * okraj) * mHD), Math.ceil((B + 2 * okraj) * mHD)), hx = doskaHD.getContext('2d');
  hx.scale(mHD, mHD); hx.translate(-(bx - okraj), -(by - okraj));
  kresliZahradu(hx, R, false);

  const jezko = spriteJezka(Math.round(c * 1.2 * dpr));
  const jezkoHD = spriteJezka(Math.round(c * 1.2 * mHD));
  const zrna = zrno(3, Math.round(160 * dpr), 1, 11).map((z) => ({ z }));
  L = { W, H, dpr, R, poz, ziara, doska, doskaHD: { c: doskaHD, x: bx - okraj, y: by - okraj, w: B + 2 * okraj }, jezko, jezkoHD, zrna, texty };
}

/** Záhrada v súradniciach príbehu: karta, tónované záhony, tenké čiary, hrubé hranice záhonov (ako v hre). */
function kresliZahradu(x, R, sTienom) {
  const { B, bx, by, pad, c } = R;
  x.save();
  if (sTienom) { x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = B * 0.05; x.shadowOffsetY = B * 0.015; }
  zaoblene(x, bx, by, B, B, B * 0.022);
  x.fillStyle = '#221c17'; x.fill();
  x.restore();
  x.save();
  zaoblene(x, bx + pad, by + pad, B - 2 * pad, B - 2 * pad, B * 0.012); x.clip();
  // záhony svetlejšie ako v prvej verzii (0,16), aby záhrada nepôsobila ponuro
  for (let i = 0; i < N * N; i++) {
    const [cx, cy] = R.bunka(i);
    x.fillStyle = `rgba(${TONY_ZAHONOV[zahon(i)]},0.3)`;
    x.fillRect(cx, cy, c + 0.5, c + 0.5);
  }
  // jemná textúra trávy: krátke čiarky podľa hashu (statické)
  x.strokeStyle = 'rgba(255,255,255,0.035)'; x.lineWidth = Math.max(0.6, c * 0.012); x.lineCap = 'round';
  for (let i = 0; i < N * N; i++) {
    const [cx, cy] = R.bunka(i);
    for (let j = 0; j < 5; j++) {
      const u = cx + c * (0.12 + 0.76 * hash(i, j)), v = cy + c * (0.2 + 0.7 * hash(j, i + 90));
      x.beginPath(); x.moveTo(u, v); x.lineTo(u + c * 0.02, v - c * 0.07); x.stroke();
    }
  }
  x.strokeStyle = 'rgba(255,255,255,0.11)'; x.lineWidth = Math.max(1, c * 0.012);
  for (let k = 1; k < N; k++) {
    const a = bx + pad + k * c, b = by + pad + k * c;
    x.beginPath(); x.moveTo(a, by + pad); x.lineTo(a, by + B - pad); x.stroke();
    x.beginPath(); x.moveTo(bx + pad, b); x.lineTo(bx + B - pad, b); x.stroke();
  }
  x.strokeStyle = 'rgba(250,250,250,0.88)'; x.lineWidth = c * 0.045; x.lineCap = 'round';
  x.beginPath();
  for (let i = 0; i < N * N; i++) {
    const [cx, cy] = R.bunka(i);
    if (stl(i) < N - 1 && zahon(i) !== zahon(i + 1)) { x.moveTo(cx + c, cy); x.lineTo(cx + c, cy + c); }
    if (rad(i) < N - 1 && zahon(i) !== zahon(i + N)) { x.moveTo(cx, cy + c); x.lineTo(cx + c, cy + c); }
  }
  x.stroke();
  x.restore();
  zaoblene(x, bx + pad, by + pad, B - 2 * pad, B - 2 * pad, B * 0.012);
  x.lineWidth = c * 0.05; x.strokeStyle = 'rgba(250,250,250,0.92)'; x.stroke();
}

/** Titulky, názov, vety, tlačidlo a štítok sa kreslia raz do spritov; tu sa dopočíta aj koncová poloha záhrady. */
function stavTexty(W, H, dpr, R) {
  const s = R.s, zar = R.stred ? 'center' : 'left', Z = R.Z;
  const velTit = R.velTit;
  const titulky = TITULKY.map((tt) => {
    const cely = tt.text.map((a) => a[0]).join('');
    const m = platno(4, 4).getContext('2d');
    m.font = pismo(600, velTit);
    const riadky = vyvazZalom(m, cely, R.tw);
    const lh = velTit * 1.25;
    return { ...tt, sp: sprite(dpr, R.tw, lh * riadky.length + velTit * 0.4, (x) => {
      x.font = pismo(600, velTit); x.textBaseline = 'top';
      const farbaZnaku = [];
      tt.text.forEach(([txt, f]) => { for (const _ of txt) farbaZnaku.push(f || '#f4efe9'); });
      let idx = 0;
      riadky.forEach((riadok, ri) => {
        const w = x.measureText(riadok).width;
        let px = R.stred ? (R.tw - w) / 2 : 0;
        for (const ch of riadok) {
          while (cely[idx] !== ch && idx < cely.length) idx++;
          x.fillStyle = farbaZnaku[idx] || '#f4efe9';
          x.fillText(ch, px, ri * lh);
          px += x.measureText(ch).width;
          idx++;
        }
      });
    }) };
  });
  const farbyNazvu = ['#ffd2b8', '#ff8a5c', '#e2552c'];
  const nazov = spriteNazvu(dpr, 'Hedgehogs', s * (R.stred ? 0.15 : 0.14), R.ew, { zarovnanie: zar, farby: farbyNazvu });
  const veta = spriteRiadku(dpr, 'A new garden every day.', s * (R.stred ? 0.06 : 0.056), R.ew, { zarovnanie: zar, maxRiadkov: 1, farba: '#f4efe9' });
  // drobná tlač len od 36 px pri 1080 (minPismo); tiráž pre vývojárov vypadla, na mobile sa nedala čítať
  const veta2 = spriteRiadku(dpr, 'Two hedgehogs in every row, column and flowerbed, never touching.', Math.max(s * 0.04, minPismo(W, H)), R.ew, { vaha: 400, farba: '#c9c2bb', zarovnanie: zar, maxRiadkov: 2 });

  // tlačidlo „Free at arling.sk/games“: akcentová pilulka ako tlačidlá hubu, šípka vpravo
  const TXT = 'Free at arling.sk/games';
  const mer = platno(4, 4).getContext('2d');
  mer.font = pismo(700, 100);
  const kB = mer.measureText(TXT).width / 100;
  const velB = Math.min(s * (R.stred ? 0.052 : 0.046), (R.ew - 8) / (kB + 3.6));
  mer.font = pismo(700, velB);
  const bw = Math.min(R.ew, mer.measureText(TXT).width + velB * 3.6), bh = velB * 2.4;
  const tlacidlo = sprite(dpr, bw + 8, bh + 8, (x) => {
    x.translate(4, 4);
    zaoblene(x, 0, 0, bw, bh, bh / 2);
    const gg = x.createLinearGradient(0, 0, 0, bh);
    gg.addColorStop(0, '#ff8559'); gg.addColorStop(1, '#e4532b');
    x.fillStyle = gg; x.fill();
    x.fillStyle = '#1a0c06';
    x.font = pismo(700, velB); x.textBaseline = 'middle'; x.textAlign = 'left';
    x.fillText(TXT, velB * 1.1, bh / 2 + velB * 0.04);
    const ax = bw - velB * 1.35, ay = bh / 2, r = velB * 0.42;
    x.strokeStyle = '#1a0c06'; x.lineWidth = velB * 0.14; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(ax - r, ay); x.lineTo(ax + r, ay); x.moveTo(ax + r * 0.2, ay - r * 0.75); x.lineTo(ax + r, ay); x.lineTo(ax + r * 0.2, ay + r * 0.75); x.stroke();
  });
  const velS = Math.max(s * 0.036, minPismo(W, H));
  const stitokW = R.stred ? W : R.tw;
  const stitok = sprite(dpr, stitokW, velS * 1.6, (x) => {
    x.font = pismo(600, velS); x.textBaseline = 'top'; x.textAlign = zar; x.fillStyle = 'rgba(255,150,110,0.95)';
    textRozostup(x, 'DAILY LOGIC PUZZLE', R.stred ? W / 2 : 0, 0, velS * 0.16);
  });

  // záverečný blok (a hák, ktorý používa to isté zloženie): názov, vety, tlačidlo
  const gap = s * 0.03;
  const blokH = nazov.h + gap * 0.5 + veta.h + gap * 0.2 + veta2.h + gap + tlacidlo.h;
  let ey;
  if (R.stred) {
    const gB = s * 0.045;
    R.B2 = Math.min(R.B * 0.8, Z.h - blokH - gB);
    R.by2 = Z.y0 + (Z.h - (R.B2 + gB + blokH)) / 2;
    R.bx2 = (W - R.B2) / 2;
    ey = R.by2 + R.B2 + gB;
  } else {
    R.B2 = R.B; R.bx2 = R.bx; R.by2 = R.by;
    ey = Math.max(Z.y0, (H - blokH) / 2);
  }
  const pozicie = {};
  let y = ey;
  pozicie.nazov = y; y += nazov.h + gap * 0.5;
  pozicie.veta = y; y += veta.h + gap * 0.2;
  pozicie.veta2 = y; y += veta2.h + gap;
  pozicie.tlacidlo = y;
  const btnX = R.stred ? (W - bw) / 2 : R.ex;
  return { titulky, nazov, veta, veta2, tlacidlo, stitok, pozicie, btn: { x: btnX, y: pozicie.tlacidlo + 4, w: bw, h: bh } };
}

// ---------- kreslenie snímky ----------

/** 1 = koncová poloha záhrady (hák a záver), 0 = poloha príbehu. */
function polohaKonca(t) {
  if (t < HAK.koniec) return 1 - HAK.navrat(t);
  return ease.inOutCubic(okno(t, T.presunOd, T.presunDo));
}

/** Sila svetelnej vlny v bunke i (0..1) počas okna [od, do]. */
function silaVlny(t, i, od, dokedy) {
  if (t < od || t > dokedy + 0.1) return 0;
  const p = ease.inOutSine(okno(t, od, dokedy));
  const poz = lerp(-0.35 * N, 2 * N + 0.35 * N, p);
  return Math.exp(-Math.pow((stl(i) + 0.5 + rad(i) + 0.5 - poz) / 1.1, 2));
}

/** Poskok ježka na hotovej záhrade: vlna svetla, dýchanie a občasný skok (hák a záver). */
function poskok(t, i, env) {
  let skok = Math.max(silaVlny(t, i, T.hakVlna[0], T.hakVlna[1]), silaVlny(t, i, T.vlnaOd, T.vlnaDo));
  // občasný skok jedného ježka na hotovej záhrade (hák aj záver, aby slučka sedela)
  const per = env.slabe ? 1.4 : 0.7;
  const zaciatok = t < T.cistOd ? -0.6 : T.vlnaDo;
  if (t >= zaciatok) {
    const n = Math.floor((t - zaciatok) / per);
    for (let j = Math.max(0, n - 1); j <= n; j++) {
      const q = (t - zaciatok - j * per) / 0.45;
      if (q < 0 || q > 1) continue;
      if (RIESENIE[Math.floor(hash(j, 5) * RIESENIE.length)] === i) skok = Math.max(skok, Math.sin(Math.PI * q));
    }
  }
  // veľký ježko v priblížení háku poskočí hneď od snímky 0
  if (i === SKOK_HAKU && t < 0.55) skok = Math.max(skok, Math.sin(Math.PI * okno(t, 0, 0.55)));
  const dych = Math.sin((t * 0.9 + hash(i, 2)) * Math.PI * 2) * 0.022;
  return { dy: -skok * 0.2, sx: 1 + dych - skok * 0.05, sy: 1 - dych + skok * 0.07 };
}

function kresliJezka(x, cx, cy, w, h, alfa = 1) {
  if (w <= 0.5 || alfa <= 0.003) return;
  x.globalAlpha = alfa;
  x.drawImage(L.aktJezko || L.jezko, cx - w / 2, cy - h / 2, w, h);
  x.globalAlpha = 1;
}

/** Priblíženie kamery (1 = celá záhrada): v háku sa vzdiali, na konci sa znova priblíži (slučka). */
function kamera(t) {
  if (t < T.kameraHak[1]) return lerp(KAMERA, 1, ease.inOutCubic(okno(t, T.kameraHak[0], T.kameraHak[1])));
  if (t > T.kameraKoniec[0]) return lerp(1, KAMERA, ease.inOutCubic(okno(t, T.kameraKoniec[0], T.kameraKoniec[1])));
  return 1;
}
// Brucho ježka je v spritu 0,235 výšky pod stredom; pri stlačení ostáva brucho na mieste.
const BRUCHO = 0.235;
function kresliJezkaNaZemi(x, cx, zem, w, h, dy, alfa) { kresliJezka(x, cx, zem - BRUCHO * h + dy, w, h, alfa); }

function kresliJezkov(x, t, env) {
  const { R } = L;
  const c = R.c, vel = c * 1.2;
  for (const i of RIESENIE) {
    const [cx, cy] = R.stredBunky(i);
    if (t < T.cistDo) {
      // hák: hotová záhrada v pohybe; potom ježkovia po uhlopriečkach vyskočia a schovajú sa
      const t0 = T.cistOd + (rad(i) + stl(i)) * 0.03;
      const p = okno(t, t0, t0 + 0.32);
      if (p >= 1) continue;
      const m = poskok(t, i, env);
      const hore = p < 0.35 ? ease.outQuad(p / 0.35) : 1;
      const dole = p < 0.35 ? 0 : ease.inCubic((p - 0.35) / 0.65);
      const sc = (1 + 0.12 * hore) * (1 - dole);
      // tieň pod ježkom
      x.fillStyle = `rgba(0,0,0,${0.28 * (1 - dole)})`;
      x.beginPath(); x.ellipse(cx, cy + c * 0.27, c * 0.26 * (1 + m.dy), c * 0.06, 0, 0, 7); x.fill();
      const w = vel * sc * m.sx, hh = vel * sc * m.sy;
      kresliJezkaNaZemi(x, cx, cy + BRUCHO * vel, w, hh, (m.dy - 0.2 * hore) * c, 1 - dole * 0.6);
      if (p > 0.3) {
        const q = okno(p, 0.3, 1), n = env.slabe ? 2 : 4;
        for (let j = 0; j < n; j++) {
          const u = hash(i, j + 40) * Math.PI * 2, dist = c * (0.2 + ease.outCubic(q) * 0.45);
          iskra(x, cx + Math.cos(u) * dist, cy + Math.sin(u) * dist - c * 0.15, c * 0.05 * (1 - q) + 0.3, (1 - q) * 0.8);
        }
      }
      continue;
    }
    const d = casDopadu[i];
    if (!d || t < d.od) continue;
    const p = okno(t, d.od, d.od + d.trv);
    const pad = ease.inQuad(p);
    const y = cy - (1 - pad) * c * (d.hlavny ? 1.6 : 0.95);
    let sx = 1, sy = 1, dy = 0;
    const po = t - (d.od + d.trv);
    if (po >= 0 && po < 0.22) { const q = po / 0.22, sq = Math.sin(Math.PI * q) * (1 - q) * (d.hlavny ? 0.22 : 0.14); sx = 1 + sq; sy = 1 - sq; }
    if (t >= T.vlnaOd) { const m = poskok(t, i, env); sx *= m.sx; sy *= m.sy; dy = m.dy * c; }
    // tieň
    x.fillStyle = `rgba(0,0,0,${0.28 * obmedz(p * 2)})`;
    x.beginPath(); x.ellipse(cx, cy + c * 0.27, c * 0.26, c * 0.06, 0, 0, 7); x.fill();
    kresliJezkaNaZemi(x, cx, y + BRUCHO * vel, vel * sx, vel * sy, dy, obmedz(p * 3));
    if (po >= 0 && po < 0.5) {
      const q = po / 0.5;
      x.strokeStyle = `rgba(255,138,92,${(1 - q) * 0.6})`;
      x.lineWidth = c * 0.03 * (1 - q) + 0.5;
      x.beginPath(); x.arc(cx, cy, c * (0.3 + q * (d.hlavny ? 0.75 : 0.38)), 0, Math.PI * 2); x.stroke();
    }
    const n = d.hlavny ? 12 : env.slabe ? 2 : 5, trvI = d.hlavny ? 0.9 : 0.5;
    if (po >= 0 && po < trvI) {
      const q = po / trvI;
      for (let j = 0; j < n; j++) {
        const u = hash(i * 7, j) * Math.PI * 2, v = 0.5 + hash(j, i * 5) * 0.6;
        const dist = c * (0.3 + ease.outCubic(q) * v * (d.hlavny ? 1.1 : 0.55));
        iskra(x, cx + Math.cos(u) * dist, cy + Math.sin(u) * dist, c * 0.06 * (1 - q) + 0.3, (1 - q) * 0.9, d.hlavny ? '255,236,170' : '255,226,204');
      }
    }
  }
}

/** Dedukcia v riadku 3: stlmenie, duchovia, zóny bodlín, lúč plného stĺpca, jediná bunka. */
function kresliDedukciu(x, t) {
  const { R } = L;
  const c = R.c;
  const [rx, ry] = R.bunka(RAD * N);
  const tlm = Math.min(ease.outCubic(okno(t, T.tlmOd, T.tlmOd + 0.4)), 1 - ease.inOutQuad(okno(t, T.tlmDo, T.tlmDo + 0.5)));
  if (tlm > 0) {
    x.save();
    const p = new Path2D();
    p.rect(0, 0, L.W, L.H);
    p.rect(rx, ry, c * N, c);
    for (const i of [29, 31]) { const [sx, sy] = R.bunka(i); p.rect(sx, sy, c, c); }
    const stlp = okno(t, T.stlpecOd - 0.2, T.stlpecOd + 0.2);
    for (const i of STLPEC_JEZKOVIA) { const [sx, sy] = R.bunka(i); p.rect(sx, sy, c, c); }
    x.fillStyle = `rgba(6,5,4,${0.64 * tlm})`;
    x.fill(p, 'evenodd');
    // riadok ako v hre pri nápovede: prerušovaný žltý rámik
    x.setLineDash([c * 0.14, c * 0.09]);
    zaoblene(x, rx + c * 0.03, ry + c * 0.03, c * N - c * 0.06, c * 0.94, c * 0.1);
    x.strokeStyle = `rgba(250,204,21,${0.85 * tlm})`;
    x.lineWidth = c * 0.045;
    x.stroke();
    // stĺpec, ktorý už má dvoch
    if (stlp > 0) {
      const [sx0, sy0] = R.bunka(STLPEC);
      zaoblene(x, sx0 + c * 0.05, sy0 + c * 0.05, c * 0.9, c * N - c * 0.1, c * 0.12);
      x.strokeStyle = `rgba(241,197,106,${0.8 * tlm * stlp})`;
      x.stroke();
    }
    x.setLineDash([]);
    x.restore();
  }
  if (t < T.duchOd) return;
  // zóny bodlín okolo troch ježkov: 3 x 3 bunky, ktoré sa ježka dotýkajú
  ZONY.forEach((h, k) => {
    const tz = T.zony[k];
    const p = ease.outBack(okno(t, tz, tz + T.zonaTrv), 1.4);
    const a = obmedz(okno(t, tz, tz + 0.15)) * (1 - okno(t, tz + 0.75, tz + 1.05));
    if (a <= 0) return;
    const [cx, cy] = R.stredBunky(h);
    const pol = c * 1.5 * p;
    if (pol < c * 0.2) return; // na začiatku je zóna menšia ako zaoblenie (arcTo so záporným polomerom by padol)
    const x0 = Math.max(cx - pol, R.bx + R.pad), x1 = Math.min(cx + pol, R.bx + R.B - R.pad);
    const y0 = Math.max(cy - pol, R.by + R.pad), y1 = Math.min(cy + pol, R.by + R.B - R.pad);
    zaoblene(x, x0 + c * 0.04, y0 + c * 0.04, x1 - x0 - c * 0.08, y1 - y0 - c * 0.08, c * 0.22);
    x.fillStyle = `rgba(242,100,60,${0.2 * a})`; x.fill();
    x.strokeStyle = `rgba(255,150,110,${0.9 * a})`; x.lineWidth = c * 0.04; x.stroke();
    // bodliny: krátke lúče z ježka smerom k ôsmim susedom, len vnútri zóny a záhrady
    x.save();
    x.beginPath(); x.rect(x0, y0, x1 - x0, y1 - y0); x.clip();
    x.strokeStyle = `rgba(255,190,160,${0.7 * a})`; x.lineWidth = c * 0.025; x.lineCap = 'round';
    for (let j = 0; j < 8; j++) {
      const u = (j / 8) * Math.PI * 2, r0 = c * 0.5, r1 = c * (0.5 + 0.3 * obmedz(p));
      x.beginPath(); x.moveTo(cx + Math.cos(u) * r0, cy + Math.sin(u) * r0); x.lineTo(cx + Math.cos(u) * r1, cy + Math.sin(u) * r1); x.stroke();
    }
    x.restore();
  });
  // lúč pozdĺž stĺpca s dvoma ježkami
  {
    const p = ease.inOutQuad(okno(t, T.lucOd, T.lucOd + T.lucTrvanie));
    const zhas = 1 - okno(t, T.lucOd + T.lucTrvanie, T.lucOd + T.lucTrvanie + 0.5);
    if (p > 0 && zhas > 0) {
      x.save();
      x.globalCompositeOperation = 'lighter';
      x.lineCap = 'round';
      const [x1, y1] = R.stredBunky(48), [, y2] = R.stredBunky(STLPEC);
      const hy = lerp(y1, y2, p);
      const g = x.createLinearGradient(x1, y1, x1, hy - 0.01);
      g.addColorStop(0, 'rgba(241,160,80,0)'); g.addColorStop(1, `rgba(255,214,150,${0.9 * zhas})`);
      x.strokeStyle = g; x.lineWidth = c * 0.09;
      x.beginPath(); x.moveTo(x1, y1); x.lineTo(x1, hy); x.stroke();
      x.lineWidth = c * 0.025; x.strokeStyle = `rgba(255,255,255,${0.8 * zhas})`;
      x.beginPath(); x.moveTo(x1, lerp(y1, hy, 0.6)); x.lineTo(x1, hy); x.stroke();
      if (p < 1) iskra(x, x1, hy, c * 0.16, 0.95 * zhas, '255,236,200');
      x.restore();
    }
  }
  if (t > T.vlnaOd + 0.4) return;
  // duchovia vo voľných bunkách riadku; vylúčené bunky blysnú červeným krížikom a stanú sa bodkou (ako v hre)
  const koniecBodiek = 1 - okno(t, T.vlnaOd, T.vlnaOd + 0.4);
  DUCHOVIA.forEach((i, k) => {
    const [cx, cy] = R.stredBunky(i);
    const zjav = ease.outCubic(okno(t, T.duchOd + k * 0.06, T.duchOd + k * 0.06 + 0.3));
    const vyl = casVylucenia[i];
    if (i === CIEL) {
      if (t >= T.jezOd + 0.2) return;
      const pul = okno(t, T.pulz, T.jezOd);
      const a = lerp(0.36 * zjav, 0.8, pul) * (1 - okno(t, T.jezOd, T.jezOd + 0.2));
      const m = 0.9 + 0.08 * Math.sin(pul * Math.PI * 4);
      kresliJezka(x, cx, cy, c * m, c * m, a);
      return;
    }
    const zmiz = vyl ? ease.inQuad(okno(t, vyl.t, vyl.t + 0.3)) : 0;
    const a = 0.36 * zjav * (1 - zmiz);
    if (a > 0.003 && t < T.tlmDo + 0.5) kresliJezka(x, cx, cy, c * 0.9 * (1 - zmiz * 0.4), c * 0.9 * (1 - zmiz * 0.4), a * (1 - okno(t, T.tlmDo, T.tlmDo + 0.4)));
    if (!vyl || t < vyl.t) return;
    if (t < vyl.t + 0.35) {
      const q = (t - vyl.t) / 0.35, dd = c * 0.2;
      x.strokeStyle = `rgba(255,123,123,${(1 - q) * 0.9})`;
      x.lineWidth = c * 0.045; x.lineCap = 'round';
      x.beginPath(); x.moveTo(cx - dd, cy - dd); x.lineTo(cx + dd, cy + dd); x.moveTo(cx + dd, cy - dd); x.lineTo(cx - dd, cy + dd); x.stroke();
    }
    const b = ease.outBack(okno(t, vyl.t + 0.15, vyl.t + 0.4), 2) * koniecBodiek;
    if (b > 0) { x.fillStyle = `rgba(160,156,150,${0.85 * Math.min(1, b)})`; x.beginPath(); x.arc(cx, cy, c * 0.075 * b, 0, 7); x.fill(); }
  });
  // pulz jedinej ostávajúcej bunky (žltý kruh ako nápoveda v hre)
  if (t >= T.pulz && t < T.jezOd + 0.2) {
    const [cx, cy] = R.stredBunky(CIEL);
    for (let j = 0; j < 2; j++) {
      const q = ((t - T.pulz) / 0.55 + j * 0.5) % 1;
      x.strokeStyle = `rgba(250,204,21,${(1 - q) * 0.8})`;
      x.lineWidth = c * 0.035;
      x.beginPath(); x.arc(cx, cy, c * (0.32 + q * 0.35), 0, Math.PI * 2); x.stroke();
    }
  }
}

/** Svetelná vlna po uhlopriečke hotovej záhrady v okne [od, do]; pri riešení rám zazelenie (ako „hotovo“ v hre). */
function kresliVlnu(x, t, od, dokedy, zelena) {
  if (t < od || t > dokedy + 0.1) return;
  const { R } = L;
  const { B, bx, by, c } = R;
  x.save();
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < N * N; i++) {
    const sila = silaVlny(t, i, od, dokedy);
    if (sila < 0.02) continue;
    const [px, py] = R.bunka(i);
    x.fillStyle = `rgba(255,200,150,${0.13 * sila})`;
    x.fillRect(px + c * 0.04, py + c * 0.04, c * 0.92, c * 0.92);
  }
  const z = Math.sin(Math.PI * okno(t, od, dokedy + 0.1));
  zaoblene(x, bx + R.pad, by + R.pad, B - 2 * R.pad, B - 2 * R.pad, B * 0.012);
  x.strokeStyle = zelena ? `rgba(94,207,154,${0.6 * z})` : `rgba(255,170,120,${0.45 * z})`;
  x.lineWidth = c * 0.14;
  x.stroke();
  x.restore();
}

function kresliTexty(x, t) {
  const { R, texty } = L;
  const { titulky, pozicie } = texty;
  if (t < HAK.koniec) {
    HAK.kresliNazov(x, t, texty.nazov, R.ex, pozicie.nazov);
    HAK.kresliRiadok(x, t, texty.veta, R.ex, pozicie.veta);
    HAK.kresliRiadok(x, t, texty.veta2, R.ex, pozicie.veta2, 0.14);
  }
  const st = obalka(t, T.stitokOd, T.nazov - 0.1, 0.6, 0.5);
  if (st > 0) {
    x.globalAlpha = st;
    const sp = texty.stitok;
    x.drawImage(sp.c, R.stred ? 0 : R.tx, R.stitokY, sp.w, sp.h);
    x.globalAlpha = 1;
  }
  for (const tt of titulky) {
    const a = obalka(t, tt.od, tt.do, 0.3, 0.25);
    if (a <= 0) continue;
    const vstup = ease.outCubic(okno(t, tt.od, tt.od + 0.4));
    x.globalAlpha = a;
    x.drawImage(tt.sp.c, R.tx, R.tyTit + (1 - vstup) * R.s * 0.02, tt.sp.w, tt.sp.h);
    x.globalAlpha = 1;
  }
  const vyjdi = (sp, od, y, trv = 0.6) => {
    const p = ease.outCubic(okno(t, od, od + trv));
    if (p <= 0) return;
    x.save();
    x.beginPath(); x.rect(R.ex - 10, y - 4, sp.w + 20, sp.h + 8); x.clip();
    x.globalAlpha = obmedz(p * 1.5);
    x.drawImage(sp.c, R.ex, y + (1 - p) * sp.h * 0.9, sp.w, sp.h);
    x.restore();
  };
  vyjdi(texty.nazov, T.nazov, pozicie.nazov, 0.75);
  vyjdi(texty.veta, T.veta, pozicie.veta);
  vyjdi(texty.veta2, T.veta2, pozicie.veta2);
  const pb = okno(t, T.tlacidlo, T.tlacidlo + 0.5);
  if (pb > 0) {
    const b = texty.tlacidlo, sc = 0.85 + 0.15 * ease.outBack(pb, 2.2);
    const { x: bx0, y: by0, w, h } = texty.btn;
    const cx = bx0 + w / 2, cy = by0 + h / 2;
    x.globalAlpha = obmedz(pb * 2);
    x.drawImage(b.c, cx - (b.w * sc) / 2, cy - (b.h * sc) / 2, b.w * sc, b.h * sc);
    const q = okno(t, T.tlacidlo + 0.5, T.tlacidlo + 1.2);
    if (q > 0 && q < 1) {
      x.save();
      zaoblene(x, bx0, by0, w, h, h / 2); x.clip();
      x.globalCompositeOperation = 'lighter';
      const lx = lerp(bx0 - w * 0.3, bx0 + w * 1.3, ease.inOutSine(q));
      const g = x.createLinearGradient(lx - w * 0.15, 0, lx + w * 0.15, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(bx0, by0, w, h);
      x.restore();
    }
    x.globalAlpha = 1;
  }
}

function kresliZrno(x, t, env) {
  const i = env.slabe ? 0 : Math.abs(Math.floor(t * 12)) % 3;
  const z = L.zrna[i];
  if (!z.vzor) z.vzor = x.createPattern(z.z, 'repeat');
  x.save();
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 0.04;
  x.fillStyle = z.vzor;
  x.fillRect(0, 0, L.W * L.dpr, L.H * L.dpr);
  x.restore();
}

const film = {
  dlzka: DLZKA,
  plagat: 1.0,
  titulky: [
    { od: 0, text: 'Hedgehogs. Close up, a big hedgehog hops in its garden, then the view pulls back to the whole solved garden of eight by eight cells. A new garden every day. Two hedgehogs in every row, column and flowerbed, never touching.' },
    { od: 1.3, text: 'The hedgehogs hide and the garden is empty.' },
    { od: 1.45, text: 'Two hedgehogs in every row, column and flowerbed. Ten hedgehogs drop in one by one.' },
    { od: 6.3, text: 'Where does this row’s second hedgehog go?' },
    { od: 8.05, text: 'Not next to a hedgehog, not even at a corner. Five cells touch a hedgehog and stay empty.' },
    { od: 9.6, text: 'Not in a column that already has two. One more cell stays empty.' },
    { od: 10.95, text: 'Only one cell is left, and the hedgehog drops in.' },
    { od: 12.2, text: 'Five more, and the garden is solved. A wave of light runs across it.' },
    { od: 14.6, text: 'Hedgehogs. A new garden every day. Free at arling.sk/games. At the end the view moves close to the hedgehogs again.' },
  ],
  async pripravit() {
    if (document.fonts && document.fonts.load) {
      await Promise.all([document.fonts.load(pismo(700, 40)), document.fonts.load(pismo(600, 40)), document.fonts.load(pismo(500, 40)), document.fonts.load(pismo(400, 40))]).catch(() => {});
    }
  },
  vrstvy: stavVrstiev,
  kresli(x, t, W, H, env) {
    x.drawImage(L.poz, 0, 0, W, H);
    const R = L.R, pp = polohaKonca(t);
    const k = lerp(1, R.B2 / R.B, pp);
    const bxs = lerp(R.bx, R.bx2, pp), bys = lerp(R.by, R.by2, pp), Bs = R.B * k; // záhrada na obrazovke
    const posun = () => { if (pp > 0) { x.translate(bxs - R.bx * k, bys - R.by * k); x.scale(k, k); } };
    const z = kamera(t);
    L.aktJezko = z > 1.02 ? L.jezkoHD : L.jezko;
    x.save(); posun(); x.drawImage(L.ziara, 0, 0, W, H); x.restore();
    x.save();
    if (z > 1.0005) {
      // kamera: priblíženie okolo FOKUS, orezané na rám záhrady (text pod záhradou ostáva celý)
      zaoblene(x, bxs, bys, Bs, Bs, Bs * 0.022); x.clip();
      const pol = Bs / (2 * z);
      const sx = obmedz(bxs + (R.pad + FOKUS[1] * R.c) * k, bxs + pol, bxs + Bs - pol);
      const sy = obmedz(bys + (R.pad + FOKUS[0] * R.c) * k, bys + pol, bys + Bs - pol);
      x.translate(sx, sy); x.scale(z, z); x.translate(-sx, -sy);
    }
    posun();
    if (z > 1.02) { const D = L.doskaHD; x.drawImage(D.c, D.x, D.y, D.w, D.w); }
    else x.drawImage(L.doska, 0, 0, W, H);
    kresliVlnu(x, t, T.hakVlna[0], T.hakVlna[1], false);
    kresliVlnu(x, t, T.vlnaOd, T.vlnaDo, true);
    kresliJezkov(x, t, env);
    // stlmenie ide cez ježkov (stlmí aj ich), zóny, duchovia a krížiky sú nad ním
    if (t >= T.tlmOd && t < T.vlnaOd + 0.5) kresliDedukciu(x, t);
    x.restore();
    kresliTexty(x, t);
    kresliZrno(x, t, env);
  },
  // tlačidlo prehrať na plagáte: stred záhrady v koncovej polohe
  stredPlagatu() { const R = L.R; return [R.bx2 + R.B2 / 2, R.by2 + R.B2 / 2]; },
  odkazy() {
    const b = L.texty.btn;
    return [{ x: b.x, y: b.y, w: b.w, h: b.h, href: '/games/hedgehogs/', text: 'Play Hedgehogs free at arling.sk/games', od: T.tlacidlo, udalost: 'hedgehogs_film_play' }];
  },
  zvuk: partitura(),
};

function partitura() {
  const u = [];
  // hák: zvuk od prvej snímky (G dur), pri odchode švih
  u.push(...HAK.zvuk({ akord: ['G2', 'D3', 'B3', 'D4'], zvony: ['G5', 'D6', 'G6'] }));
  // poskoky vo vlne háku: jemné ťuky podľa uhlopriečky
  [0.1, 0.3, 0.5, 0.7].forEach((t, k) => u.push({ t, typ: 'tuk', f: 260 + k * 40, dlzka: 0.06, hlas: 0.035, pan: -0.4 + k * 0.27 }));
  // ježkovia sa schovajú: krátke klesajúce zvončeky
  ['G6', 'E6', 'D6', 'B5', 'A5'].forEach((f, i) => u.push({ t: T.cistOd + 0.04 + i * 0.07, typ: 'zvon', f, index: 0.5, dlzka: 0.5, hlas: 0.045, pan: 0.4 - i * 0.2, dozvuk: 0.3 }));
  // plocha pod príbehom
  u.push({ t: 1.85, typ: 'pad', noty: ['G2', 'D3', 'A3', 'B3'], dlzka: 4.6, nabeh: 1.0, dobeh: 1.0, hlas: 0.14, filter: 650, filter2: 1300 });
  u.push({ t: 2.1, typ: 'zvon', f: 'G3', dlzka: 2.2, hlas: 0.08, index: 0.5, dozvuk: 0.5 });
  // dopad ježkov: tón podľa riadku, mäkký ťuk
  PAD.forEach((i) => {
    const d = casDopadu[i], t = d.od + d.trv;
    u.push({ t, typ: 'zvon', f: TON_RIADKU[rad(i)], pomer: 2, index: 0.9, dlzka: 1.2, hlas: 0.14, pan: (stl(i) - 3.5) * 0.12, dozvuk: 0.3 });
    u.push({ t, typ: 'tuk', f: 170, dlzka: 0.08, hlas: 0.08, pan: (stl(i) - 3.5) * 0.12 });
  });
  // dedukcia: napätie (Em), duchovia, zóny bodlín, krížiky, lúč stĺpca
  u.push({ t: T.tlmOd - 0.15, typ: 'pad', noty: ['E2', 'B2', 'D3', 'G3'], dlzka: 5.4, nabeh: 0.6, dobeh: 0.8, hlas: 0.14, filter: 600 });
  u.push({ t: T.duchOd, typ: 'glis', f0: 'D6', f1: 'A6', dlzka: 0.4, hlas: 0.02, dozvuk: 0.6 });
  T.zony.forEach((t, k) => {
    u.push({ t, typ: 'sum', filter: 'bandpass', f0: 2500, f1: 5200, q: 2, dlzka: 0.22, hlas: 0.05, dozvuk: 0.2 });
    u.push({ t, typ: 'zvon', f: ['B4', 'D5', 'E5'][k], index: 0.5, dlzka: 0.8, hlas: 0.07, pan: -0.2 + k * 0.2, dozvuk: 0.35 });
  });
  Object.values(casVylucenia).forEach((v) => u.push({ t: v.t, typ: 'zvon', f: 'E4', index: 0.3, dlzka: 0.45, hlas: 0.06, dozvuk: 0.2 }));
  u.push({ t: T.lucOd, typ: 'glis', f0: 'D4', f1: 'D5', dlzka: T.lucTrvanie, hlas: 0.045, tvar: 'triangle', dozvuk: 0.35 });
  u.push({ t: T.pulz, typ: 'zvon', f: 'D4', index: 0.4, dlzka: 1.2, hlas: 0.08, dozvuk: 0.5 });
  u.push({ t: T.pulz + 0.28, typ: 'zvon', f: 'A4', index: 0.4, dlzka: 1.0, hlas: 0.05, dozvuk: 0.5 });
  const dopad = T.jezOd + T.jezTrvanie;
  u.push({ t: T.jezOd + 0.05, typ: 'pad', noty: ['C2', 'G2', 'E3', 'B3'], dlzka: 2.0, nabeh: 0.25, dobeh: 0.6, hlas: 0.14, filter: 900 });
  u.push({ t: dopad, typ: 'zvon', f: 'D5', index: 1.4, dlzka: 2.6, hlas: 0.22, dozvuk: 0.5 });
  u.push({ t: dopad, typ: 'zvon', f: 'D6', pomer: 3.5, index: 0.8, dlzka: 2.0, hlas: 0.07, dozvuk: 0.6 });
  u.push({ t: dopad, typ: 'tuk', f: 120, dlzka: 0.22, hlas: 0.18 });
  u.push({ t: dopad, typ: 'sum', filter: 'highpass', f0: 6000, f1: 9000, dlzka: 1.2, hlas: 0.04, dozvuk: 0.6 });
  // dokončenie
  FINALE.forEach((i, k) => u.push({ t: T.finOd + k * T.finKrok + T.finTrvanie, typ: 'zvon', f: ['G5', 'A5', 'B5', 'D6', 'E6'][k], index: 0.9, dlzka: 1.2, hlas: 0.12, pan: -0.4 + k * 0.2, dozvuk: 0.35 }));
  // svetelná vlna a poskoky
  u.push({ t: T.vlnaOd - 0.5, typ: 'sum', filter: 'highpass', f0: 1800, f1: 8000, q: 0.5, dlzka: 0.5, nabeh: 0.5, tvar: 'narast', hlas: 0.07, dozvuk: 0.3 });
  ['G6', 'A6', 'B6', 'D7', 'E7', 'G7'].forEach((n, i) => u.push({ t: T.vlnaOd + i * 0.07, typ: 'zvon', f: n, index: 0.6, dlzka: 1.8, hlas: 0.05, pan: -0.5 + i * 0.2, dozvuk: 0.6 }));
  u.push({ t: T.vlnaOd, typ: 'pad', noty: ['G1', 'D2', 'B2', 'D3', 'A3', 'B3'], dlzka: 5.5, nabeh: 0.25, dobeh: 3.2, hlas: 0.2, filter: 1700, filter2: 800 });
  // názov a tlačidlo
  u.push({ t: T.nazov, typ: 'zvon', f: 'G3', index: 0.5, dlzka: 3.5, hlas: 0.14, dozvuk: 0.55 });
  u.push({ t: T.nazov + 0.02, typ: 'zvon', f: 'D4', index: 0.4, dlzka: 3.0, hlas: 0.06, dozvuk: 0.55 });
  u.push({ t: T.veta, typ: 'zvon', f: 'B4', index: 0.4, dlzka: 1.6, hlas: 0.05, dozvuk: 0.5 });
  u.push({ t: T.tlacidlo + 0.1, typ: 'tuk', f: 320, dlzka: 0.07, hlas: 0.06 });
  u.push({ t: T.tlacidlo + 0.1, typ: 'zvon', f: 'B5', index: 0.5, dlzka: 0.9, hlas: 0.05, dozvuk: 0.5 });
  return u;
}

export default film;
