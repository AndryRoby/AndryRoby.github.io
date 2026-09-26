// Prism 5: film na 14 sekúnd, nakreslený a ozvučený kódom (kodfilm engine).
// Klasické pravidlá: každý z 5 drahokamov raz v každom riadku a stĺpci. Žiadne oblasti, žiadna námraza.
// Scény: hák (drahokamy od snímky 0 padajú do mriežky a poskladajú dosku vedľa názvu, vlna svetla),
// 9 drahokamov vyskočí a ostane zadanie (16), pravidlo, dedukcia „kam v tomto riadku patrí hviezda“
// cez stĺpce, dokončenie, vlna, názov, nápis „Coming soon to Google Play“ a adresa arling.sk.

import { okno, obmedz, lerp, ease, hash, obalka } from './engine/cas.js';
import { platno, zrno, zaoblene, pismo, textRozostup } from './engine/kresba.js';
import { hak, format, zona, sprite, spriteNazvu, spriteRiadku, vyvazZalom, minPismo } from './engine/hak.js';
import { spriteDrahokamu, iskra, FARBA } from './drahokamy.js';

const DLZKA = 14;

// Platný latinský štvorec 5 x 5: každý drahokam raz v každom riadku aj stĺpci.
// C Circle, D Diamond, Q Square, S Star, T Triangle.
const RIESENIE = ['QTDCS', 'DCSTQ', 'CSTQD', 'TDQSC', 'SQCDT'];
const TONY = { C: 'C5', D: 'D5', Q: 'E5', S: 'G5', T: 'A5' };

const HAK = hak({ drz: 1.3, odchod: 0.6 }); // hák do 1,9 s

// --- časová os (sekundy) ---
// Verzia 3 (kritika 25. 9. v noci): žiadny stojaci „slide“ ani prázdna mriežka. Snímka 0: drahokamy
// práve padajú do mriežky po uhlopriečkach a vedľa názvu poskladajú dosku (hotová do 0,55 s), prejde
// po nej svetlo. Pri odchode háku z hotovej dosky vyskočí 9 drahokamov a ostane rovno zadanie
// (16 drahokamov); titulok pravidla prichádza pri 1,8 s. Film je o 4 s kratší (14 s).
const T = {
  hakPad0: -0.2, hakKrok: 0.09, hakPad: 0.3, // uhlopriečka d dopadne v čase hakPad0 + d * hakKrok
  hakVlna: [0.5, 1.3],
  cistOd: 1.3, cistKrok: 0.05, cistDo: 1.95,
  stitokOd: 1.5,
  tlmOd: 3.55, duchOd: 3.9,
  luce: [4.4, 4.8, 5.2], lucTrvanie: 0.5,
  pulz: 5.75, hviezdaOd: 6.25, hviezdaTrvanie: 0.26,
  tlmDo: 6.75,
  finOd: 6.95, finKrok: 0.14, finTrvanie: 0.22,
  vlnaOd: 8.15, vlnaDo: 9.25,
  presunOd: 8.9, presunDo: 9.75,
  nazov: 9.55, veta: 10.05, veta2: 10.45, tlacidlo: 11.0, adresa: 11.45,
};

// Dedukcia v riadku 3 (štvrtý zhora): riadok potrebuje hviezdu. Voľné sú stĺpce 1 až 4 (index 0 až 3),
// ale stĺpce 1, 2 a 3 už hviezdu majú (bunky 4,0; 2,1; 1,2), takže ostane jediná bunka 3,3.
const RAD = 3;
const CIEL = [3, 3];
// Poradie dopadu 16 drahokamov pred dedukciou [riadok, stĺpec]. V riadku 3 je z nich len 3,4 (Circle).
const PAD = [[2, 0], [0, 2], [1, 4], [4, 1], [0, 4], [2, 2], [1, 1], [3, 4], [4, 0], [0, 1], [1, 2], [4, 3], [2, 1], [0, 3], [1, 3], [2, 4]];
const FINALE = [[0, 0], [1, 0], [3, 0], [3, 1], [2, 3], [3, 2], [4, 2], [4, 4]];
const FIN_TONY = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6'];
const DUCHOVIA = [[3, 0], [3, 1], [3, 2], [3, 3]];
// Lúče z hviezd pozdĺž celého stĺpca: zdroj, koniec, bunky duchov, ktoré lúč zhasne.
const LUCE = [
  { z: [4, 0], k: [0, 0], zhasne: [[3, 0]] },
  { z: [2, 1], k: [4, 1], zhasne: [[3, 1]] },
  { z: [1, 2], k: [4, 2], zhasne: [[3, 2]] },
];

// Kontrola pri načítaní: riešenie je latinský štvorec a dedukcia sedí so stavom pred ňou.
(function over() {
  for (let i = 0; i < 5; i++) {
    const riadok = new Set(RIESENIE[i]), stlpec = new Set(RIESENIE.map((r) => r[i]));
    if (riadok.size !== 5 || stlpec.size !== 5) throw new Error('Prism 5 film: riešenie nie je latinský štvorec');
  }
  const pred = new Set(PAD.map(([r, s]) => `${r}${s}`));
  for (const [r, s] of DUCHOVIA) if (pred.has(`${r}${s}`)) throw new Error('Prism 5 film: duch na plnej bunke');
  for (const l of LUCE) {
    if (RIESENIE[l.z[0]][l.z[1]] !== 'S' || !pred.has(`${l.z[0]}${l.z[1]}`)) throw new Error('Prism 5 film: lúč nezačína na hviezde');
    if (l.zhasne.some(([, s]) => s !== l.z[1])) throw new Error('Prism 5 film: lúč zhasína mimo stĺpca');
  }
  if (RIESENIE[CIEL[0]][CIEL[1]] !== 'S') throw new Error('Prism 5 film: cieľ nie je hviezda');
})();

// Kedy ktorá bunka dostane drahokam (čas dopadu) a v akom poradí. Zadanie (PAD) ostane stáť od háku.
const casDopadu = {};
PAD.forEach(([r, s], i) => { casDopadu[`${r}${s}`] = { od: -99, trv: 0.3, i, zadanie: true }; });
// Drahokamy, ktoré pri odchode háku vyskočia (nie sú v zadaní): poradie po uhlopriečkach.
const VYSKOCIA = [];
for (let d = 0; d <= 8; d++) for (let r = 0; r < 5; r++) { const s = d - r; if (s >= 0 && s < 5 && !PAD.some(([a, b]) => a === r && b === s)) VYSKOCIA.push(`${r}${s}`); }
const casVyskoku = Object.fromEntries(VYSKOCIA.map((k, i) => [k, T.cistOd + i * T.cistKrok]));
casDopadu[`${CIEL[0]}${CIEL[1]}`] = { od: T.hviezdaOd, trv: T.hviezdaTrvanie, i: 99, hlavna: true };
FINALE.forEach(([r, s], i) => { casDopadu[`${r}${s}`] = { od: T.finOd + i * T.finKrok, trv: T.finTrvanie, i: 100 + i }; });
const casZhasnutia = {};
LUCE.forEach((l, i) => {
  const od = T.luce[i];
  const dlz = Math.abs(l.k[0] - l.z[0]);
  for (const [r, s] of l.zhasne) casZhasnutia[`${r}${s}`] = od + (Math.abs(r - l.z[0]) / dlz) * T.lucTrvanie;
});

// Titulky nadväzujú bez medzier.
const TITULKY = [
  { od: 1.45, do: 3.75, text: [['Every row and every column holds each gem '], ['once', '#f1c56a'], ['.']] },
  { od: 3.75, do: 5.6, text: [['Where can the '], ['star', '#c9a2ff'], [' go in this row?']] },
  { od: 5.6, do: 7.9, text: [['Only one place for the '], ['star', '#c9a2ff'], ['.']] },
];

// ---------- stav vrstiev (prestavia sa pri zmene rozmeru) ----------
let L = null;

/** Rozloženie podľa pomeru strán: 9:16, 4:5 a 1:1 pod sebou, 16:9 doska vľavo a text vpravo. */
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
  const pad = B * 0.028, c = (B - 2 * pad) / 5;
  R.pad = pad; R.c = c;
  R.bunka = (r, s) => [bx + pad + s * c, by + pad + r * c];
  R.stredBunky = (r, s) => [bx + pad + (s + 0.5) * c, by + pad + (r + 0.5) * c];
  const Wd = Math.round(W * dpr), Hd = Math.round(H * dpr);

  // pozadie: tmavomodrý prechod ako v appke a vinetácia
  const poz = platno(Wd, Hd), px = poz.getContext('2d');
  px.scale(dpr, dpr);
  const g = px.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0e1535'); g.addColorStop(0.55, '#0a1029'); g.addColorStop(1, '#060816');
  px.fillStyle = g; px.fillRect(0, 0, W, H);
  const vg = px.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  px.fillStyle = vg; px.fillRect(0, 0, W, H);

  // žiara za doskou (ide s doskou, lebo doska sa v háku a na konci posúva)
  const ziara = platno(Wd, Hd), zx = ziara.getContext('2d');
  zx.scale(dpr, dpr);
  const zg = zx.createRadialGradient(bx + B / 2, by + B / 2, B * 0.1, bx + B / 2, by + B / 2, B * 0.95);
  zg.addColorStop(0, 'rgba(60,90,200,0.20)'); zg.addColorStop(1, 'rgba(60,90,200,0)');
  zx.fillStyle = zg; zx.fillRect(0, 0, W, H);

  // doska: 25 rovnakých bridlicových buniek s kovovým rámom, bez oblastí
  const doska = platno(Wd, Hd), x = doska.getContext('2d');
  x.scale(dpr, dpr);
  zaoblene(x, bx - B * 0.012, by - B * 0.012, B * 1.024, B * 1.024, B * 0.035);
  x.fillStyle = '#080c20'; x.fill();
  for (let r = 0; r < 5; r++) for (let s = 0; s < 5; s++) {
    const [cx, cy] = R.bunka(r, s), i = c * 0.045, w = c - 2 * i;
    const gg = x.createLinearGradient(cx, cy, cx, cy + c);
    gg.addColorStop(0, (r + s) % 2 ? '#1b2452' : '#1e2a5c'); gg.addColorStop(1, '#0b0f22');
    zaoblene(x, cx + i, cy + i, w, w, c * 0.09);
    x.fillStyle = gg; x.fill();
    x.lineWidth = Math.max(1, c * 0.022);
    x.strokeStyle = 'rgba(190,200,230,0.42)'; x.stroke();
    zaoblene(x, cx + i + c * 0.04, cy + i + c * 0.04, w - c * 0.08, w - c * 0.08, c * 0.06);
    x.lineWidth = Math.max(0.8, c * 0.012);
    x.strokeStyle = 'rgba(0,0,0,0.45)'; x.stroke();
    x.fillStyle = 'rgba(210,220,245,0.5)';
    for (const [ax, ay] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { x.beginPath(); x.arc(cx + i + c * 0.035 + ax * (w - c * 0.07), cy + i + c * 0.035 + ay * (w - c * 0.07), c * 0.012, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(255,255,255,0.08)'; x.lineWidth = c * 0.02;
    x.beginPath(); x.moveTo(cx + i + c * 0.1, cy + i + c * 0.03); x.lineTo(cx + c - i - c * 0.1, cy + i + c * 0.03); x.stroke();
  }
  // zlatý rám celej dosky (jediná zlatá čiara, oblasti už nie sú)
  const zlata = x.createLinearGradient(bx, by, bx + B, by + B);
  zlata.addColorStop(0, '#ffe3a0'); zlata.addColorStop(0.45, '#e2ac52'); zlata.addColorStop(1, '#f7d27f');
  zaoblene(x, bx + pad, by + pad, B - 2 * pad, B - 2 * pad, c * 0.1);
  x.lineWidth = c * 0.1; x.strokeStyle = 'rgba(240,190,90,0.10)'; x.stroke();
  x.lineWidth = c * 0.05; x.strokeStyle = zlata; x.stroke();

  const sprity = {};
  for (const k of 'CDQST') sprity[k] = spriteDrahokamu(k, Math.round(c * dpr));
  const zrna = zrno(3, Math.round(160 * dpr), 1, 11).map((z) => ({ z }));
  L = { W, H, dpr, R, poz, ziara, doska, sprity, zrna };
  L.texty = stavTexty(W, H, dpr, R);
}

/** Titulky, názov, vety a štítok sa kreslia raz do spritov; tu sa dopočíta aj koncová poloha dosky. */
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
      tt.text.forEach(([txt, f]) => { for (const _ of txt) farbaZnaku.push(f || '#eef1ff'); });
      let idx = 0;
      riadky.forEach((riadok, ri) => {
        const w = x.measureText(riadok).width;
        let px = R.stred ? (R.tw - w) / 2 : 0;
        for (const ch of riadok) {
          while (cely[idx] !== ch && idx < cely.length) idx++;
          x.fillStyle = farbaZnaku[idx] || '#eef1ff';
          x.fillText(ch, px, ri * lh);
          px += x.measureText(ch).width;
          idx++;
        }
      });
    }) };
  });
  const nazov = spriteNazvu(dpr, 'Prism 5', s * (R.stred ? 0.16 : 0.15), R.ew, { zarovnanie: zar });
  const veta = spriteRiadku(dpr, 'Five gems. One daily grid.', s * (R.stred ? 0.06 : 0.056), R.ew, { zarovnanie: zar, maxRiadkov: 1 });
  const veta2 = spriteRiadku(dpr, 'Each gem once in every row and column.', Math.max(s * 0.04, minPismo(W, H)), R.ew, { vaha: 400, farba: '#b3bbe0', zarovnanie: zar, maxRiadkov: 2 });
  // Appka ešte nie je v Google Play: len nápis bez pilulky a bez ▶ (nesmie vyzerať ako odznak obchodu),
  // pod ním čitateľná adresa (aspoň 40 px pri 1080). Veta pre vývojárov vypadla.
  const TXT = 'Coming soon to Google Play';
  const mer = platno(4, 4).getContext('2d');
  mer.font = pismo(700, 100);
  const kB = mer.measureText(TXT).width / 100;
  const velB = Math.max(minPismo(W, H) * 1.1, Math.min(s * (R.stred ? 0.05 : 0.044), R.ew / kB));
  mer.font = pismo(700, velB);
  const bw = Math.min(R.ew, mer.measureText(TXT).width), bh = velB * 1.35;
  const tlacidlo = sprite(dpr, bw + 8, bh + 8, (x) => {
    x.translate(4, 4);
    x.font = pismo(700, velB); x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillStyle = '#5eeaea';
    x.fillText(TXT, 0, bh / 2 + velB * 0.04);
  });
  const adresa = spriteNazvu(dpr, 'arling.sk', Math.max(s * 0.07, minPismo(W, H) * 1.25), R.ew, { zarovnanie: zar, farby: ['#fff3cf', '#f1c56a', '#d9a441'], vaha: 700 });
  const velS = Math.max(s * 0.036, minPismo(W, H));
  const stitokW = R.stred ? W : R.tw;
  const stitok = sprite(dpr, stitokW, velS * 1.6, (x) => {
    x.font = pismo(600, velS); x.textBaseline = 'top'; x.textAlign = zar; x.fillStyle = 'rgba(241,197,106,0.95)';
    textRozostup(x, 'DAILY GEM PUZZLE', R.stred ? W / 2 : 0, 0, velS * 0.16);
  });
  const tiraz = adresa;

  // záverečný blok (a hák, ktorý používa to isté zloženie): názov, vety, nápis „Coming soon“, adresa
  const gap = s * 0.03;
  const blokH = nazov.h + gap * 0.5 + veta.h + gap * 0.2 + veta2.h + gap + tlacidlo.h + gap * 0.5 + tiraz.h;
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
  pozicie.tlacidlo = y; y += tlacidlo.h + gap * 0.5;
  pozicie.tiraz = y;
  const btnX = R.stred ? (W - bw) / 2 : R.ex;
  return { titulky, nazov, veta, veta2, tlacidlo, tiraz, stitok, pozicie, btn: { x: btnX, y: pozicie.tlacidlo + 4, w: bw, h: bh } };
}

// ---------- kreslenie snímky ----------

/** 1 = koncová poloha dosky (hák a záver), 0 = poloha príbehu. */
function polohaKonca(t) {
  if (t < HAK.koniec) return 1 - HAK.navrat(t);
  return ease.inOutCubic(okno(t, T.presunOd, T.presunDo));
}

function kresliDrahokamy(x, t, env) {
  const { R, sprity } = L;
  const c = R.c;
  for (let r = 0; r < 5; r++) for (let s = 0; s < 5; s++) {
    const k = RIESENIE[r][s];
    const [cx, cy] = R.stredBunky(r, s);
    if (t < T.cistDo) {
      // hák: drahokamy padajú do mriežky po uhlopriečkach (od snímky 0), doska sa poskladá do 0,55 s
      const dopad = T.hakPad0 + (r + s) * T.hakKrok, pf = okno(t, dopad - T.hakPad, dopad);
      if (pf <= 0) continue;
      if (pf < 1 || t - dopad < 0.45) {
        const pad = ease.inQuad(pf), po = t - dopad;
        let sx = 1, sy = 1;
        if (po >= 0 && po < 0.22) { const q = po / 0.22, sq = Math.sin(Math.PI * q) * (1 - q) * 0.16; sx = 1 + sq; sy = 1 - sq; }
        const y = cy - (1 - pad) * c * 1.1;
        x.globalAlpha = obmedz(pf * 3);
        x.drawImage(sprity[k], cx - (c * sx) / 2, y - (c * sy) / 2 + (c - c * sy) * 0.3, c * sx, c * sy);
        x.globalAlpha = 1;
        if (po >= 0 && po < 0.45) {
          const q = po / 0.45;
          x.strokeStyle = FARBA[k]; x.globalAlpha = (1 - q) * 0.5;
          x.lineWidth = c * 0.03 * (1 - q) + 0.5;
          x.beginPath(); x.arc(cx, cy, c * (0.28 + q * 0.36), 0, Math.PI * 2); x.stroke();
          x.globalAlpha = 1;
        }
        continue;
      }
      // zadanie ostáva stáť, ostatné drahokamy po uhlopriečkach vyskočia a zmiznú
      const t0 = casVyskoku[`${r}${s}`];
      const p = t0 == null ? 0 : okno(t, t0, t0 + 0.3);
      if (p >= 1) continue;
      const hore = p < 0.35 ? ease.outQuad(p / 0.35) : 1;
      const dole = p < 0.35 ? 0 : ease.inCubic((p - 0.35) / 0.65);
      const sc = (1 + 0.14 * hore) * (1 - dole);
      const w = c * sc;
      if (w > 0.5) {
        x.globalAlpha = 1 - dole * 0.6;
        x.drawImage(sprity[k], cx - w / 2, cy - w / 2 - c * 0.18 * hore, w, w);
        x.globalAlpha = 1;
      }
      if (p > 0.3) {
        const q = okno(p, 0.3, 1), n = env.slabe ? 2 : 4;
        for (let j = 0; j < n; j++) {
          const u = hash(r * 11 + s, j + 40) * Math.PI * 2, dist = c * (0.2 + ease.outCubic(q) * 0.45);
          iskra(x, cx + Math.cos(u) * dist, cy + Math.sin(u) * dist - c * 0.18, c * 0.05 * (1 - q) + 0.3, (1 - q) * 0.85);
        }
      }
      continue;
    }
    const d = casDopadu[`${r}${s}`];
    if (!d || t < d.od) continue;
    const p = okno(t, d.od, d.od + d.trv);
    const pad = ease.inQuad(p);
    const y = cy - (1 - pad) * c * (d.hlavna ? 1.6 : 0.95);
    let sx = 1, sy = 1;
    const po = t - (d.od + d.trv);
    if (po >= 0 && po < 0.22) { const q = po / 0.22, sq = Math.sin(Math.PI * q) * (1 - q) * (d.hlavna ? 0.22 : 0.14); sx = 1 + sq; sy = 1 - sq; }
    x.globalAlpha = obmedz(p * 3);
    const w = c * sx, h = c * sy;
    x.drawImage(sprity[k], cx - w / 2, y - h / 2 + (c - h) * 0.3, w, h);
    x.globalAlpha = 1;
    if (po >= 0 && po < 0.5) {
      const q = po / 0.5;
      x.strokeStyle = FARBA[k];
      x.globalAlpha = (1 - q) * 0.55;
      x.lineWidth = c * 0.03 * (1 - q) + 0.5;
      x.beginPath(); x.arc(cx, cy, c * (0.28 + q * (d.hlavna ? 0.7 : 0.38)), 0, Math.PI * 2); x.stroke();
      x.globalAlpha = 1;
    }
    const n = d.hlavna ? 12 : env.slabe ? 2 : 5, trvI = d.hlavna ? 0.9 : 0.5;
    if (po >= 0 && po < trvI) {
      const q = po / trvI;
      for (let j = 0; j < n; j++) {
        const u = hash(r * 7 + s, j) * Math.PI * 2, v = 0.5 + hash(j, r * 5 + s) * 0.6;
        const dist = c * (0.3 + ease.outCubic(q) * v * (d.hlavna ? 1.1 : 0.55));
        iskra(x, cx + Math.cos(u) * dist, cy + Math.sin(u) * dist, c * 0.06 * (1 - q) + 0.3, (1 - q) * 0.9);
      }
    }
  }
}

function kresliDedukciu(x, t) {
  const { R, sprity } = L;
  const c = R.c;
  const [rx, ry] = R.bunka(RAD, 0);
  // stlmenie všetkého okrem riadku 3 a troch hviezd, z ktorých pôjdu lúče
  const tlm = Math.min(ease.outCubic(okno(t, T.tlmOd, T.tlmOd + 0.4)), 1 - ease.inOutQuad(okno(t, T.tlmDo, T.tlmDo + 0.5)));
  if (tlm > 0) {
    x.save();
    const p = new Path2D();
    p.rect(0, 0, L.W, L.H);
    p.rect(rx, ry, c * 5, c);
    for (const l of LUCE) { const [sx, sy] = R.bunka(l.z[0], l.z[1]); p.rect(sx, sy, c, c); }
    x.fillStyle = `rgba(4,6,18,${0.62 * tlm})`;
    x.fill(p, 'evenodd');
    zaoblene(x, rx + c * 0.02, ry + c * 0.02, c * 4.96, c * 0.96, c * 0.1);
    x.strokeStyle = `rgba(201,162,255,${0.6 * tlm})`;
    x.lineWidth = c * 0.05;
    x.stroke();
    x.restore();
  }
  if (t < T.duchOd || t > T.hviezdaOd + 0.3) return;
  // duchovia hviezdy vo voľných bunkách riadku
  DUCHOVIA.forEach(([r, s], i) => {
    const zjav = ease.outCubic(okno(t, T.duchOd + i * 0.06, T.duchOd + i * 0.06 + 0.3));
    const zh = casZhasnutia[`${r}${s}`];
    const zmiz = zh != null ? ease.inQuad(okno(t, zh, zh + 0.3)) : 0;
    const ciel = r === CIEL[0] && s === CIEL[1];
    let a = 0.42 * zjav * (1 - zmiz);
    let mierka = 0.7 * (1 - zmiz * 0.4);
    if (ciel) {
      const pul = okno(t, T.pulz, T.hviezdaOd);
      a = lerp(0.42 * zjav, 0.75, pul) * (1 - okno(t, T.hviezdaOd, T.hviezdaOd + 0.2));
      mierka = 0.7 + 0.08 * Math.sin(pul * Math.PI * 4);
    }
    if (a <= 0.003) return;
    const [cx, cy] = R.stredBunky(r, s), w = c * mierka;
    x.globalAlpha = a;
    x.drawImage(sprity.S, cx - w / 2, cy - w / 2, w, w);
    x.globalAlpha = 1;
    if (zh != null && t >= zh && t < zh + 0.3) {
      const q = (t - zh) / 0.3, d = c * 0.18;
      x.strokeStyle = `rgba(255,120,140,${(1 - q) * 0.8})`;
      x.lineWidth = c * 0.035;
      x.beginPath(); x.moveTo(cx - d, cy - d); x.lineTo(cx + d, cy + d); x.moveTo(cx + d, cy - d); x.lineTo(cx - d, cy + d); x.stroke();
    }
  });
  if (t >= T.pulz && t < T.hviezdaOd + 0.2) {
    const [cx, cy] = R.stredBunky(CIEL[0], CIEL[1]);
    for (let j = 0; j < 2; j++) {
      const q = ((t - T.pulz) / 0.55 + j * 0.5) % 1;
      x.strokeStyle = `rgba(214,180,255,${(1 - q) * 0.7})`;
      x.lineWidth = c * 0.03;
      x.beginPath(); x.arc(cx, cy, c * (0.3 + q * 0.35), 0, Math.PI * 2); x.stroke();
    }
  }
  // lúče z hviezd pozdĺž ich stĺpcov
  x.save();
  x.globalCompositeOperation = 'lighter';
  x.lineCap = 'round';
  LUCE.forEach((l, i) => {
    const od = T.luce[i];
    const p = ease.inOutQuad(okno(t, od, od + T.lucTrvanie));
    const zhas = 1 - okno(t, od + T.lucTrvanie, od + T.lucTrvanie + 0.45);
    if (p <= 0 || zhas <= 0) return;
    const [x1, y1] = R.stredBunky(l.z[0], l.z[1]), [x2, y2] = R.stredBunky(l.k[0], l.k[1]);
    const hx = lerp(x1, x2, p), hy = lerp(y1, y2, p);
    const g = x.createLinearGradient(x1, y1, hx + 0.01, hy + 0.01);
    g.addColorStop(0, 'rgba(181,123,255,0)');
    g.addColorStop(1, `rgba(214,180,255,${0.9 * zhas})`);
    x.strokeStyle = g;
    x.lineWidth = c * 0.09;
    x.beginPath(); x.moveTo(x1, y1); x.lineTo(hx, hy); x.stroke();
    x.lineWidth = c * 0.025;
    x.strokeStyle = `rgba(255,255,255,${0.8 * zhas})`;
    x.beginPath(); x.moveTo(lerp(x1, hx, 0.6), lerp(y1, hy, 0.6)); x.lineTo(hx, hy); x.stroke();
    if (p < 1) iskra(x, hx, hy, c * 0.16, 0.95 * zhas, '235,215,255');
  });
  x.restore();
}

/** Svetelná vlna po uhlopriečke hotovej dosky v okne [od, do]. */
function kresliVlnu(x, t, od, dokedy) {
  if (t < od || t > dokedy + 0.1) return;
  const { R, sprity } = L;
  const { B, bx, by, c } = R;
  const p = ease.inOutSine(okno(t, od, dokedy));
  const poz = lerp(-B * 0.35, B * 2 + B * 0.35, p);
  x.save();
  x.globalCompositeOperation = 'lighter';
  for (let r = 0; r < 5; r++) for (let s = 0; s < 5; s++) {
    const [cx, cy] = R.stredBunky(r, s);
    const sila = Math.exp(-Math.pow(((cx - bx) + (cy - by) - poz) / (c * 1.1), 2));
    if (sila < 0.02) continue;
    const [px, py] = R.bunka(r, s);
    zaoblene(x, px + c * 0.05, py + c * 0.05, c * 0.9, c * 0.9, c * 0.09);
    x.fillStyle = `rgba(120,230,230,${0.16 * sila})`;
    x.fill();
    x.globalAlpha = 0.55 * sila;
    x.drawImage(sprity[RIESENIE[r][s]], cx - c / 2, cy - c / 2, c, c);
    x.globalAlpha = 1;
  }
  const z = Math.sin(Math.PI * okno(t, od, dokedy + 0.1));
  zaoblene(x, bx + R.pad, by + R.pad, B - 2 * R.pad, B - 2 * R.pad, c * 0.1);
  x.strokeStyle = `rgba(255,214,130,${0.5 * z})`;
  x.lineWidth = c * 0.14;
  x.stroke();
  x.restore();
}

/** Tiché iskry na hotovej doske (hák a záver; na slabom zariadení zriedka). */
const VSETKY = Array.from({ length: 25 }, (_, i) => [(i / 5) | 0, i % 5]);
function kresliTrblietky(x, t, env, od, dokedy, perioda, bunky = VSETKY) {
  if (t < od || t > dokedy) return;
  const c = L.R.c;
  perioda = env.slabe ? perioda * 2.2 : perioda;
  const n = Math.floor((t - od) / perioda);
  for (let j = Math.max(0, n - 2); j <= n; j++) {
    const q = (t - od - j * perioda) / 0.9;
    if (q < 0 || q > 1) continue;
    const [r, s] = bunky[Math.floor(hash(j, 3) * bunky.length)];
    const [cx, cy] = L.R.stredBunky(r, s);
    iskra(x, cx - c * 0.16, cy - c * 0.18, c * 0.14 * Math.sin(Math.PI * q), 0.9 * Math.sin(Math.PI * q));
  }
}

function kresliTexty(x, t) {
  const { R, texty } = L;
  const { titulky, pozicie } = texty;
  // hák: názov a veta od prvej snímky na mieste záverečného bloku
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
    const a = obalka(t, tt.od, tt.do, 0.35, 0.3);
    if (a <= 0) continue;
    const vstup = ease.outCubic(okno(t, tt.od, tt.od + 0.45));
    x.globalAlpha = a;
    x.drawImage(tt.sp.c, R.tx, R.tyTit + (1 - vstup) * R.s * 0.02, tt.sp.w, tt.sp.h);
    x.globalAlpha = 1;
  }
  // záver: názov stúpa spoza masky, potom vety a štítok
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
    x.globalAlpha = 1;
  }
  // adresa arling.sk: vyjde ako názov, v slučke ostáva
  vyjdi(texty.tiraz, T.adresa, pozicie.tiraz, 0.6);
}

function kresliZrno(x, t, env) {
  const i = env.slabe ? 0 : Math.abs(Math.floor(t * 12)) % 3;
  const z = L.zrna[i];
  if (!z.vzor) z.vzor = x.createPattern(z.z, 'repeat');
  x.save();
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 0.045;
  x.fillStyle = z.vzor;
  x.fillRect(0, 0, L.W * L.dpr, L.H * L.dpr);
  x.restore();
}

const film = {
  dlzka: DLZKA,
  plagat: 1.0,
  titulky: [
    { od: 0, text: 'Prism 5. Gems drop into a 5 by 5 grid and build a solved board, and a wave of light runs across it. Five gems. One daily grid. Each gem once in every row and column.' },
    { od: 1.3, text: 'Nine gems pop out and sixteen stay: the puzzle.' },
    { od: 1.45, text: 'Every row and every column holds each gem once.' },
    { od: 3.75, text: 'Where can the star go in this row?' },
    { od: 5.6, text: 'Only one place for the star. The other free cells share a column with a star.' },
    { od: 8.15, text: 'The grid is solved and a wave of light runs across it.' },
    { od: 9.55, text: 'Prism 5. Five gems. One daily grid. Each gem once in every row and column. Coming soon to Google Play. arling.sk' },
  ],
  async pripravit() {
    if (document.fonts && document.fonts.load) {
      await Promise.all([document.fonts.load(pismo(700, 40)), document.fonts.load(pismo(600, 40)), document.fonts.load(pismo(500, 40)), document.fonts.load(pismo(400, 40))]).catch(() => {});
    }
  },
  vrstvy: stavVrstiev,
  kresli(x, t, W, H, env) {
    x.drawImage(L.poz, 0, 0, W, H);
    // skupina dosky: v háku a na konci menšia v koncovej polohe, počas príbehu veľká
    const R = L.R, pp = polohaKonca(t);
    const k = lerp(1, R.B2 / R.B, pp);
    x.save();
    if (pp > 0) { x.translate(lerp(R.bx, R.bx2, pp) - R.bx * k, lerp(R.by, R.by2, pp) - R.by * k); x.scale(k, k); }
    x.drawImage(L.ziara, 0, 0, W, H);
    x.drawImage(L.doska, 0, 0, W, H);
    kresliDrahokamy(x, t, env);
    if (t >= T.tlmOd && t < T.tlmDo + 0.6) kresliDedukciu(x, t);
    kresliVlnu(x, t, T.hakVlna[0], T.hakVlna[1]);
    kresliVlnu(x, t, T.vlnaOd, T.vlnaDo);
    kresliTrblietky(x, t, env, 0.45, T.cistOd, 0.25);
    kresliTrblietky(x, t, env, 1.95, T.tlmOd, 0.4, PAD); // zadanie nestojí mŕtve, kým beží titulok pravidla
    kresliTrblietky(x, t, env, T.vlnaDo, DLZKA, 0.7);
    x.restore();
    kresliTexty(x, t);
    kresliZrno(x, t, env);
  },
  // tlačidlo prehrať na plagáte: stred dosky v koncovej polohe
  stredPlagatu() { const R = L.R; return [R.bx2 + R.B2 / 2, R.by2 + R.B2 / 2]; },
  // Prism 5 ešte nie je v Google Play: štítok nevedie do obchodu, ale na odsek o appke na tejto stránke.
  odkazy() {
    const b = L.texty.btn;
    return [{ x: b.x, y: b.y, w: b.w, h: b.h, href: '#about', text: 'Coming soon to Google Play. About Prism 5', od: T.tlacidlo, udalost: 'prism5_film_about' }];
  },
  zvuk: partitura(),
};

function partitura() {
  const u = [];
  // hák: zvuk od prvej snímky, pri odchode švih
  u.push(...HAK.zvuk({ akord: ['C3', 'G3', 'E4', 'G4'], zvony: ['C5', 'G5', 'C6'] }));
  // hák: dopad drahokamov po uhlopriečkach, stúpajúca pentatonika (uhlopriečky, ktoré dopadnú od snímky 0)
  const PENTA = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6'];
  for (let d = 0; d <= 8; d++) {
    const t = T.hakPad0 + d * T.hakKrok;
    if (t < 0) continue;
    u.push({ t, typ: 'zvon', f: PENTA[d], pomer: 2, index: 0.9, dlzka: 1.0, hlas: 0.1, pan: -0.4 + d * 0.1, dozvuk: 0.35 });
    u.push({ t, typ: 'tuk', f: 190, dlzka: 0.06, hlas: 0.05, pan: -0.4 + d * 0.1 });
  }
  // deväť drahokamov vyskočí: krátke klesajúce zvončeky
  ['C6', 'A5', 'G5', 'E5', 'D5'].forEach((f, i) => u.push({ t: T.cistOd + 0.04 + i * 0.09, typ: 'zvon', f, index: 0.5, dlzka: 0.5, hlas: 0.045, pan: 0.4 - i * 0.2, dozvuk: 0.3 }));
  // plocha pod pravidlom
  u.push({ t: 1.75, typ: 'pad', noty: ['C3', 'G3', 'D4', 'E4'], dlzka: 2.2, nabeh: 0.8, dobeh: 0.8, hlas: 0.14, filter: 650, filter2: 1300 });
  u.push({ t: 1.85, typ: 'zvon', f: 'C4', dlzka: 2.2, hlas: 0.08, index: 0.5, dozvuk: 0.5 });
  // dedukcia
  u.push({ t: T.tlmOd - 0.15, typ: 'pad', noty: ['A2', 'E3', 'G3', 'C4'], dlzka: 3.2, nabeh: 0.6, dobeh: 0.6, hlas: 0.14, filter: 600 });
  u.push({ t: T.duchOd, typ: 'glis', f0: 'E6', f1: 'B6', dlzka: 0.4, hlas: 0.02, dozvuk: 0.6 });
  T.luce.forEach((t) => u.push({ t, typ: 'glis', f0: 'G4', f1: 'G5', dlzka: 0.45, hlas: 0.045, tvar: 'triangle', dozvuk: 0.35 }));
  Object.values(casZhasnutia).forEach((t) => u.push({ t, typ: 'zvon', f: 'E4', index: 0.3, dlzka: 0.45, hlas: 0.07, dozvuk: 0.2 }));
  u.push({ t: T.pulz, typ: 'zvon', f: 'G4', index: 0.4, dlzka: 1.2, hlas: 0.08, dozvuk: 0.5 });
  u.push({ t: T.pulz + 0.28, typ: 'zvon', f: 'D5', index: 0.4, dlzka: 1.0, hlas: 0.05, dozvuk: 0.5 });
  const dopadH = T.hviezdaOd + T.hviezdaTrvanie;
  u.push({ t: T.hviezdaOd + 0.05, typ: 'pad', noty: ['F2', 'C3', 'A3', 'E4'], dlzka: 2.2, nabeh: 0.25, dobeh: 0.6, hlas: 0.14, filter: 900 });
  u.push({ t: dopadH, typ: 'zvon', f: 'G5', index: 1.4, dlzka: 2.6, hlas: 0.22, dozvuk: 0.5 });
  u.push({ t: dopadH, typ: 'zvon', f: 'G6', pomer: 3.5, index: 0.8, dlzka: 2.0, hlas: 0.07, dozvuk: 0.6 });
  u.push({ t: dopadH, typ: 'tuk', f: 120, dlzka: 0.22, hlas: 0.18 });
  u.push({ t: dopadH, typ: 'sum', filter: 'highpass', f0: 6000, f1: 9000, dlzka: 1.2, hlas: 0.04, dozvuk: 0.6 });
  // dokončenie
  FINALE.forEach((_, i) => u.push({ t: T.finOd + i * T.finKrok + T.finTrvanie, typ: 'zvon', f: FIN_TONY[i], index: 0.9, dlzka: 1.2, hlas: 0.12, pan: -0.4 + i * 0.11, dozvuk: 0.35 }));
  // svetelná vlna
  u.push({ t: T.vlnaOd - 0.5, typ: 'sum', filter: 'highpass', f0: 1800, f1: 8000, q: 0.5, dlzka: 0.5, nabeh: 0.5, tvar: 'narast', hlas: 0.07, dozvuk: 0.3 });
  ['C6', 'D6', 'E6', 'G6', 'A6', 'C7'].forEach((n, i) => u.push({ t: T.vlnaOd + i * 0.07, typ: 'zvon', f: n, index: 0.6, dlzka: 1.8, hlas: 0.06, pan: -0.5 + i * 0.2, dozvuk: 0.6 }));
  u.push({ t: T.vlnaOd, typ: 'pad', noty: ['C2', 'G2', 'E3', 'G3', 'D4', 'E4'], dlzka: 5.3, nabeh: 0.25, dobeh: 3.2, hlas: 0.2, filter: 1700, filter2: 800 });
  // názov a štítok
  u.push({ t: T.nazov, typ: 'zvon', f: 'C4', index: 0.5, dlzka: 3.5, hlas: 0.14, dozvuk: 0.55 });
  u.push({ t: T.nazov + 0.02, typ: 'zvon', f: 'G4', index: 0.4, dlzka: 3.0, hlas: 0.06, dozvuk: 0.55 });
  u.push({ t: T.veta, typ: 'zvon', f: 'E5', index: 0.4, dlzka: 1.6, hlas: 0.05, dozvuk: 0.5 });
  u.push({ t: T.tlacidlo + 0.1, typ: 'tuk', f: 320, dlzka: 0.07, hlas: 0.06 });
  u.push({ t: T.tlacidlo + 0.1, typ: 'zvon', f: 'E6', index: 0.5, dlzka: 0.9, hlas: 0.05, dozvuk: 0.5 });
  return u;
}

export default film;
