// Detective kit: film na 20 sekúnd pre tlačiteľnú hru „The Case of the Missing Birthday Cake“ (6,90 EUR),
// nakreslený a ozvučený kódom (kodfilm engine). Kresby sú tie isté SVG ako v PDF sade (kresby.js).
// Scény: hák (karty dôkazov padajú na stôl, názov od snímky 0), prípad (prázdny tanier pri okne),
// päť podozrivých, jedna stopa (blanité stopy: Olive nebola pri okne), kódový kotúč (cvičný kód zo sady),
// zapečatený list s odpoveďou, záver v rovnakom zložení ako hák. Vinník sa nikde neprezradí.

import { okno, obmedz, lerp, ease, hash, obalka } from './engine/cas.js';
import { platno, zrno, zaoblene, pismo, zalom } from './engine/kresba.js';
import { hak, format, zona, sprite, spriteRiadku, zmestPismo, minPismo } from './engine/hak.js';
import { KRESBY } from './kresby.js';

const DLZKA = 20;
const SERIF = '"ARLing Serif", Georgia, serif';
const FARBY = {
  papier: '#fbf7ee', ink: '#1b1a17', ink2: '#4a4741', linka: '#8f877a', svetla: '#d9d2c4',
  akcent: '#b23a1d', akcentSvetly: '#f08a64', krem: '#f5ead6', tlmeny: '#cdbb9f', obalka: '#eee1c4', vosk: '#b8321c',
};

const HAK = hak({ drz: 1.3, odchod: 0.6 }); // hák do 1,9 s

// --- časová os (sekundy) ---
const T = {
  // Hák: štyri karty už ležia na stole (ako na konci), karta 2 v strede práve padá z výšky (bez letu
  // cez text a mimo pravých 12 %). Na konci sa tá istá karta zdvihne (zdvihOd až DLZKA), takže
  // posledná snímka nadväzuje na snímku 0 a slučka nemá skok.
  hakDopad: [-9, -9, -9, -9, 0.34], let: 0.45, padVyska: 0.34, zdvihOd: 19.35,
  hakPrec: 1.3, // karty odídu zo stola
  fotoOd: 1.6, fotoDopad: 2.0, fotoPrecOd: 3.35, fotoPrecDo: 3.75,
  podOd: 3.6, podKrok: 0.3, podLet: 0.36,
  stopaPresunOd: 6.4, stopaPresunDo: 7.0, kartaOd: 6.5, kartaDopad: 6.92,
  lupaOd: 6.95, lupaTahOd: 7.15, lupaTahDo: 8.15, lupaDo: 8.45,
  tlmOd: 8.3, nitOd: 8.35, nitDo: 8.85, zdvih: 8.55, peciatka: 9.05, peciatkaDopad: 9.27,
  stopaPrecOd: 10.3, stopaPrecDo: 10.7,
  kotucOd: 10.55, kotucDo: 11.0, krokOd: 11.15, krok: 0.17, dekOd: 12.2, dekKrok: 0.19, kotucPrecOd: 14.05, kotucPrecDo: 14.4,
  listOd: 14.2, listDopad: 14.58, pulz: [15.05, 15.5], listPrecOd: 16.0, listPrecDo: 16.4,
  koniecDopad: [16.55, 16.7, 16.85, 17.0, 17.2],
  kicker: 17.2, nazov: 17.3, veta: 17.75, cena: 18.15, lesk: 18.7,
};

// Karty dôkazov zo sady (čísla a nadpisy ako v PDF). Text stopy sa vo filme neukazuje (ako na náhľadoch).
const DOKAZY = [
  { cislo: 1, kresba: 'foto', nadpis: 'Granny’s photo' },
  { cislo: 2, kresba: 'stopy', nadpis: 'Footprints in the soil' },
  { cislo: 3, kresba: 'listok', nadpis: 'Mr Heron’s note' },
  { cislo: 4, kresba: 'parapet', nadpis: 'A ring on the windowsill' },
  { cislo: 5, kresba: 'blato', nadpis: 'Marks in the mud' },
];
// Rozloženie kariet na stole v jednotkách šírky karty (výška 1,3). Poradie = poradie dopadu (posledná navrchu).
const STOL = [
  { k: 0, dx: -1.05, dy: -0.38, rot: -8 },
  { k: 2, dx: 1.05, dy: -0.42, rot: 7 },
  { k: 3, dx: -0.62, dy: 0.55, rot: 5 },
  { k: 4, dx: 0.64, dy: 0.5, rot: -5 },
  { k: 1, dx: 0.0, dy: -0.1, rot: -2 },
];
// Podozriví zo sady (karty podozrivých v PDF). Olive je jediná s blanitými nohami (karta stopy 2).
const PODOZRIVI = [
  { id: 'hazel', meno: 'Hazel', zviera: 'the Hedgehog', nosi: 'a yellow apron', nohy: 'small paws' },
  { id: 'milo', meno: 'Milo', zviera: 'the Magpie', nosi: 'a blue bow tie', nohy: 'thin bird feet' },
  { id: 'olive', meno: 'Olive', zviera: 'the Otter', nosi: 'a green scarf', nohy: 'webbed feet' },
  { id: 'scout', meno: 'Scout', zviera: 'the Squirrel', nosi: 'a red cap', nohy: 'paws with sharp claws' },
  { id: 'rufus', meno: 'Rufus', zviera: 'the Hare', nosi: 'a blue and white striped jumper', nohy: 'very long back feet' },
];
const OLIVE = 2;
const POD_ROT = [-2, 1.5, -1, 2, -1.5];
// Cvičný kód zo strany s kotúčom (pripad.mjs, CVIK): kľúč 5, HONEY CAKE. Nie je to Dotin odkaz (karta 8).
const KLUC = 5, OTVORENY = 'HONEY CAKE';
const KOD = OTVORENY.replace(/[A-Z]/g, (c) => String.fromCharCode(65 + ((c.charCodeAt(0) - 65 + KLUC) % 26)));

(function over() {
  if (KOD !== 'MTSJD HFPJ') throw new Error('Detective film: kód nesedí so sadou');
  if (PODOZRIVI.filter((p) => p.nohy.includes('webbed')).length !== 1 || !PODOZRIVI[OLIVE].nohy.includes('webbed')) throw new Error('Detective film: blany');
})();

const TITULKY = [
  { od: 1.95, do: 3.5, text: 'Granny Badger’s birthday cake has vanished.' },
  { od: 3.8, do: 6.35, text: 'Five helpers. Only one was at the kitchen window.' },
  { od: 6.75, do: 8.3, text: 'Clue 2: webbed footprints in the vegetable patch.' },
  { od: 8.45, do: 10.35, text: 'Only Olive has webbed feet. She was not at the window.' },
  { od: 10.75, do: 14.05, text: 'Turn the code wheel and crack the secret code.' },
  { od: 14.4, do: 16.05, text: 'The answer waits in a sealed letter.' },
];

let L = null;
let OBR = {}; // načítané SVG obrázky

/** Text s rozostupom po znakoch. Nie cez ctx.letterSpacing: v Chrome rozostup po návrate na 0px
 *  ostal na ďalších textoch toho istého plátna (nadpisy kariet boli roztiahnuté a pretekali). */
function rozostup(x, text, px0, py, r) {
  const zar = x.textAlign;
  let sirka = -r;
  for (const ch of text) sirka += x.measureText(ch).width + r;
  let cx = zar === 'center' ? px0 - sirka / 2 : zar === 'right' ? px0 - sirka : px0;
  x.textAlign = 'left';
  for (const ch of text) { x.fillText(ch, cx, py); cx += x.measureText(ch).width + r; }
  x.textAlign = zar;
}

/** Ako zmestPismo z enginu, ale meria pätkové písmo (názov a nadpisy kariet sú pätkové ako v sade). */
function zmestSerif(text, vaha, px, w) {
  const m = platno(4, 4).getContext('2d');
  m.font = pismo(vaha, px, SERIF);
  const sirka = m.measureText(text).width;
  return sirka > w ? (px * w) / sirka : px;
}

// ---------- rozloženie ----------

function rozlozenie(W, H) {
  const F = format(W, H), Z = zona(W, H), s = Math.min(W, H);
  const R = { F, Z, s, W, H, stred: F.stlpec };
  if (F.stlpec) {
    R.capPx = s * (F.druh === 'vysoky' ? 0.05 : 0.046);
    R.cap = { x: Z.x0, y: Z.y0 + s * 0.005, w: Z.w };
    const capH = R.capPx * 1.3 * 2;
    const ay = R.cap.y + capH + s * 0.035;
    R.A = { x: W * 0.06, y: ay, w: W * 0.88, h: Z.y1 - ay };
  } else {
    const colX = W * 0.6;
    R.capPx = s * 0.05;
    R.cap = { x: colX, y: Z.y0 + Z.h * 0.3, w: Z.x1 - colX };
    R.A = { x: Z.x0, y: Z.y0, w: colX - Z.x0 - W * 0.03, h: Z.h };
  }
  return R;
}

// ---------- sprity ----------

/** Karta s tieňom: sprite papiera (kresli dostane ctx s počiatkom v rohu karty) a mäkký tieň. */
function karta(dpr, w, h, kresli, { farba = FARBY.papier, r = 0.025 } = {}) {
  const c = sprite(dpr, w, h, (x) => {
    zaoblene(x, 0, 0, w, h, w * r);
    x.fillStyle = farba; x.fill();
    x.save(); x.clip();
    kresli(x);
    x.restore();
    zaoblene(x, 0.5, 0.5, w - 1, h - 1, w * r);
    x.strokeStyle = 'rgba(40,25,10,0.18)'; x.lineWidth = 1; x.stroke();
  });
  const b = Math.max(w, h) * 0.08;
  const tien = sprite(dpr, w + 2 * b, h + 2 * b, (x) => {
    x.shadowColor = 'rgba(0,0,0,0.85)'; x.shadowBlur = b * 0.55 * dpr; x.shadowOffsetX = 0; x.shadowOffsetY = 0;
    zaoblene(x, b, b, w, h, w * r);
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.fill();
  });
  return { c: c.c, w, h, tien: tien.c, b };
}

function obrazok(x, meno, dx, dy, dw, dh) {
  const o = OBR[meno];
  if (o) x.drawImage(o, dx, dy, dw, dh);
}

/** Karta dôkazu (pomer 1 : 1,3) ako v sade: číslo, EVIDENCE, nadpis, kresba, skrytý text. */
function kartaDokazu(dpr, d, w) {
  const h = w * 1.3, p = w * 0.07;
  const geo = { kx: p, ky: h * 0.25, kw: w - 2 * p, kh: (w - 2 * p) / 2 };
  const k = karta(dpr, w, h, (x) => {
    const r = w * 0.05;
    x.fillStyle = FARBY.akcent;
    x.beginPath(); x.arc(p + r, p + r, r, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.font = pismo(700, r * 1.15); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(String(d.cislo), p + r, p + r * 1.04);
    x.fillStyle = FARBY.akcent; x.textAlign = 'left'; x.font = pismo(700, w * 0.042);
    rozostup(x,'EVIDENCE', p + r * 2 + w * 0.03, p + r * 1.02, w * 0.008);
    const vel = zmestSerif(d.nadpis, 600, w * 0.08, w - 2 * p);
    x.font = pismo(600, vel, SERIF); x.fillStyle = FARBY.ink; x.textBaseline = 'top';
    x.fillText(d.nadpis, p, p + r * 2 + w * 0.035);
    obrazok(x, d.kresba, geo.kx, geo.ky, geo.kw, geo.kh);
    // text stopy je skrytý (ako na náhľadoch sady): sivé pásy
    x.fillStyle = 'rgba(143,135,122,0.28)';
    const y0 = geo.ky + geo.kh + h * 0.05, lh = h * 0.052;
    [1, 0.93, 0.97, 0.58].forEach((f, i) => { zaoblene(x, p, y0 + i * lh, (w - 2 * p) * f, lh * 0.45, lh * 0.2); x.fill(); });
    x.fillStyle = FARBY.akcent; x.font = pismo(700, w * 0.03); x.textBaseline = 'top';
    rozostup(x,'DETECTIVE TIP', p, h - p - w * 0.075, w * 0.006);
    x.fillStyle = 'rgba(143,135,122,0.28)';
    zaoblene(x, p, h - p - w * 0.03, (w - 2 * p) * 0.8, lh * 0.4, lh * 0.2); x.fill();
  });
  k.geo = geo;
  return k;
}

/** Karta podozrivého (pomer 1 : 1,25): SUSPECT, meno, zviera, kresba, WEARS a FEET. */
function kartaPodozriveho(dpr, pd, w) {
  const h = w * 1.25, p = w * 0.07;
  return karta(dpr, w, h, (x) => {
    x.fillStyle = FARBY.akcent; x.font = pismo(700, w * 0.045); x.textBaseline = 'top'; x.textAlign = 'left';
    rozostup(x,'SUSPECT', p, p, w * 0.01);
    const vel = w * 0.1;
    x.font = pismo(600, vel, SERIF); x.fillStyle = FARBY.ink;
    x.fillText(pd.meno, p, p + w * 0.07);
    const mw = x.measureText(pd.meno).width;
    x.font = pismo('italic 400', vel * 0.55, SERIF); x.fillStyle = FARBY.ink2;
    x.fillText(pd.zviera, p + mw + w * 0.03, p + w * 0.07 + vel * 0.38);
    const dh = h * 0.46, dw = dh * 160 / 124;
    obrazok(x, pd.id, (w - dw) / 2, h * 0.24, dw, dh);
    const riadok = (y, stitok, text) => {
      x.strokeStyle = 'rgba(143,135,122,0.35)'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(p, y - w * 0.025); x.lineTo(w - p, y - w * 0.025); x.stroke();
      x.fillStyle = FARBY.linka; x.font = pismo(700, w * 0.036);
      rozostup(x,stitok, p, y + w * 0.012, w * 0.006);
      const tw = w - 2 * p - w * 0.2;
      const v2 = zmestPismo(text, 500, w * 0.058, tw);
      x.fillStyle = FARBY.ink; x.font = pismo(500, v2);
      x.fillText(text, p + w * 0.2, y);
    };
    riadok(h * 0.74, 'WEARS', pd.nosi);
    riadok(h * 0.85, 'FEET', pd.nohy);
  });
}

function stavVrstiev(W, H, dpr, env) {
  const R = rozlozenie(W, H);
  const Wd = Math.round(W * dpr), Hd = Math.round(H * dpr);

  // stôl: tmavý orech, lampa a vinetácia (raz)
  const poz = platno(Wd, Hd), px = poz.getContext('2d');
  px.scale(dpr, dpr);
  const g = px.createLinearGradient(0, 0, W * 0.3, H);
  g.addColorStop(0, '#34241a'); g.addColorStop(1, '#1f150e');
  px.fillStyle = g; px.fillRect(0, 0, W, H);
  // letokruhy: dlhé vlnité čiary so semienkom
  const sk = Math.max(W, H) / 1000;
  for (let i = 0; i < 70; i++) {
    const y0 = hash(i, 1) * H * 1.1 - H * 0.05, amp = (6 + hash(i, 2) * 22) * sk, f = 0.002 + hash(i, 3) * 0.004;
    px.strokeStyle = hash(i, 4) < 0.5 ? `rgba(12,6,2,${0.12 + hash(i, 5) * 0.14})` : `rgba(120,80,50,${0.05 + hash(i, 5) * 0.06})`;
    px.lineWidth = (0.8 + hash(i, 6) * 2.4) * sk;
    px.beginPath();
    for (let xx = -20; xx <= W + 20; xx += 24) {
      const yy = y0 + Math.sin(xx * f + i) * amp + Math.sin(xx * f * 2.7 + i * 3) * amp * 0.3 + xx * 0.05;
      if (xx === -20) px.moveTo(xx, yy); else px.lineTo(xx, yy);
    }
    px.stroke();
  }
  const lx = W * 0.5, ly = H * (R.stred ? 0.42 : 0.45);
  const lg = px.createRadialGradient(lx, ly, 0, lx, ly, Math.max(W, H) * 0.7);
  lg.addColorStop(0, 'rgba(255,214,150,0.20)'); lg.addColorStop(0.5, 'rgba(255,190,120,0.07)'); lg.addColorStop(1, 'rgba(255,190,120,0)');
  px.fillStyle = lg; px.fillRect(0, 0, W, H);
  const vg = px.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  px.fillStyle = vg; px.fillRect(0, 0, W, H);

  L = { W, H, dpr, R, poz };
  L.texty = stavTexty(W, H, dpr, R);
  stavStol(dpr, R);
  stavFoto(dpr, R);
  stavPodozrivi(dpr, R);
  stavKotuc(dpr, R);
  stavList(dpr, R);
  L.zrna = zrno(3, Math.round(160 * dpr), 1, 11).map((z) => ({ z }));
}

/** Hák a záver: kicker, názov, veta, štítok s cenou; plocha pre karty na stole. */
function stavTexty(W, H, dpr, R) {
  const { Z, s, F } = R;
  const zar = R.stred ? 'center' : 'left';
  const colX = R.stred ? Z.x0 : R.cap.x, colW = R.stred ? Z.w : R.cap.w;
  const dvaRiadky = F.druh !== 'stvorec';
  const riadky = dvaRiadky ? ['Missing', 'Birthday Cake'] : ['Missing Birthday Cake'];
  const maxPx = F.druh === 'vysoky' ? s * 0.118 : F.druh === 'portret' ? s * 0.105 : F.druh === 'stvorec' ? s * 0.088 : s * 0.1;
  let velN = maxPx;
  // rezerva 6 %: priblíženie háku a presah písmen (v 9:16 názov najviac 0,74 šírky)
  for (const r of riadky) velN = Math.min(velN, zmestSerif(r, 600, maxPx, colW * 0.94));
  const velK = Math.max(s * 0.036, minPismo(W, H));
  const kickerH = velK * 1.6, lhN = velN * 1.05;
  const nazovH = lhN * riadky.length + velN * 0.12;
  const kresliNazov = (farby) => (x) => {
    x.font = pismo(600, velN, SERIF); x.textBaseline = 'top'; x.textAlign = zar;
    const ax = zar === 'center' ? colW / 2 : 0;
    riadky.forEach((r, i) => {
      const g = x.createLinearGradient(0, i * lhN, 0, i * lhN + velN);
      farby.forEach((f, j) => g.addColorStop(j / (farby.length - 1), f));
      if (farby === FN) { x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillText(r, ax, i * lhN + velN * 0.05); }
      x.fillStyle = g; x.fillText(r, ax, i * lhN);
    });
  };
  const FN = ['#fff7e8', '#f3dfb9', '#e4c28a'];
  const nazov = sprite(dpr, colW, nazovH, kresliNazov(FN));
  nazov.svetly = sprite(dpr, colW, nazovH, kresliNazov(['rgba(255,255,255,0.95)', 'rgba(255,250,235,0.85)', 'rgba(255,240,210,0.65)'])).c;
  { const m = platno(4, 4).getContext('2d'); m.font = pismo(600, velN, SERIF); nazov.textW = Math.max(...riadky.map((r) => m.measureText(r).width)); }
  const kicker = sprite(dpr, colW, kickerH, (x) => {
    x.font = pismo(700, velK); x.textBaseline = 'top'; x.textAlign = zar; x.fillStyle = FARBY.akcentSvetly;
    rozostup(x,'THE CASE OF THE', zar === 'center' ? colW / 2 : 0, 0, velK * 0.28);
  });
  const veta = spriteRiadku(dpr, 'Printable detective party game, ages 8 to 12.', s * (R.stred ? 0.046 : 0.04), colW, { vaha: 600, farba: FARBY.krem, zarovnanie: zar, maxRiadkov: 2 });
  // štítok s cenou: ten istý tvar ako tlačidlo, ale je to len nápis s odkazom na stránku sady
  const TXT = '6.90 EUR at arling.sk/shop';
  let velC = s * (R.stred ? 0.044 : 0.038);
  velC = Math.min(velC, zmestPismo(TXT, 700, velC, colW - velC * 2.4));
  const m = platno(4, 4).getContext('2d'); m.font = pismo(700, velC);
  const cw = m.measureText(TXT).width + velC * 2.2, ch = velC * 2.3;
  const cena = sprite(dpr, cw + 8, ch + 8, (x) => {
    x.translate(4, 4);
    zaoblene(x, 0, 0, cw, ch, ch / 2);
    const gg = x.createLinearGradient(0, 0, 0, ch);
    gg.addColorStop(0, '#d2553a'); gg.addColorStop(1, '#a8341b');
    x.fillStyle = gg; x.fill();
    x.strokeStyle = 'rgba(255,230,200,0.55)'; x.lineWidth = 1.5; x.stroke();
    x.font = pismo(700, velC); x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillStyle = '#fff6ea';
    x.fillText(TXT, cw / 2, ch / 2 + velC * 0.04);
  });

  const g1 = s * 0.03, g2 = s * 0.028, g3 = s * 0.028;
  const poz = {};
  let plocha;
  if (R.stred) {
    const pevne = kickerH + nazovH + g1 + g2 + veta.h + g3 + cena.h;
    // 1:1 a 4:5: výzva s cenou aspoň 10 % nad spodnou hranou (9:16 má spodok zóny na 80 %)
    const spodok = F.druh === 'vysoky' ? Z.y1 : Math.min(Z.y1, H * 0.9);
    let y = Z.y0;
    poz.kicker = y; y += kickerH;
    poz.nazov = y; y += nazovH + g1;
    const hA = spodok - Z.y0 - pevne;
    // karty ostanú v páse textu (pri 9:16 nič v pravých 12 %, ani počas pádu)
    plocha = { x: Z.x0, y, w: Z.w, h: hA };
    y += hA + g2;
    poz.veta = y; y += veta.h + g3;
    poz.cena = y;
  } else {
    const blok = kickerH + nazovH + g1 + veta.h + g3 * 1.4 + cena.h;
    let y = (H - blok) / 2;
    poz.kicker = y; y += kickerH;
    poz.nazov = y; y += nazovH + g1;
    poz.veta = y; y += veta.h + g3 * 1.4;
    poz.cena = y;
    plocha = R.A;
  }
  const cx = R.stred ? (W - cena.w) / 2 : colX;
  const titulky = TITULKY.map((tt) => ({ ...tt, sp: spriteRiadku(dpr, tt.text, R.capPx, R.cap.w, { vaha: 600, farba: FARBY.krem, zarovnanie: zar, maxRiadkov: 2 }) }));
  return { nazov, kicker, veta, cena, poz, colX, plocha, titulky, btn: { x: cx + 4, y: poz.cena + 4, w: cw, h: ch } };
}

/** Karty dôkazov na stole (hák a záver). */
function stavStol(dpr, R) {
  const P = L.texty.plocha;
  const u = Math.min(P.w / 3.45, P.h / 2.55);
  const cx = P.x + P.w / 2, cy = P.y + P.h / 2 - u * 0.07;
  L.stol = { u, cx, cy, karty: DOKAZY.map((d) => kartaDokazu(dpr, d, u)) };
}

/** Fotka kuchynského okna (kresba karty 4 zo sady: prázdny tanier a omrvinky). */
function stavFoto(dpr, R) {
  const A = R.A;
  const pw = Math.min(A.w * 0.86, (A.h * 0.8) / 0.7);
  const ph = pw * 0.7, m = pw * 0.05;
  const sp = karta(dpr, pw, ph, (x) => {
    x.fillStyle = '#eef4f8'; x.fillRect(m, m, pw - 2 * m, (pw - 2 * m) / 2);
    obrazok(x, 'parapet', m, m, pw - 2 * m, (pw - 2 * m) / 2);
    x.font = pismo('italic 400', pw * 0.05, SERIF); x.fillStyle = FARBY.ink2; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('The kitchen window at 3:20', pw / 2, m + (pw - 2 * m) / 2 + (ph - m - (pw - 2 * m) / 2) / 2);
  }, { farba: '#fdfbf6', r: 0.012 });
  L.foto = { sp, cx: A.x + A.w / 2, cy: A.y + A.h * 0.46 };
}

function mriezka(obd, cw) {
  const ch = cw * 1.25, g = cw * 0.1;
  const cx = obd.x + obd.w / 2, cy = obd.y + obd.h / 2;
  return [0, 1, 2, 3, 4].map((i) => {
    const hore = i < 3;
    const x = hore ? cx + (i - 1) * (cw + g) : cx + (i === 3 ? -1 : 1) * (cw + g) / 2;
    const y = cy + (hore ? -1 : 1) * (ch + g) / 2;
    return { x, y };
  });
}

/** Podozriví: mriežka 3 + 2 v scéne 3, menšia mriežka vedľa karty stopy v scéne 4. */
function stavPodozrivi(dpr, R) {
  const A = R.A;
  const cw = Math.min(A.w / 3.25, A.h / 2.62);
  const g1 = mriezka(A, cw);
  // scéna stopy: rozdelenie plochy (na výšku: karta hore, podozriví dole; inak karta vľavo)
  let E, S;
  if (A.h > A.w * 1.05) {
    E = { x: A.x, y: A.y, w: A.w, h: A.h * 0.43 };
    S = { x: A.x, y: A.y + A.h * 0.46, w: A.w, h: A.h * 0.54 };
  } else {
    E = { x: A.x, y: A.y, w: A.w * 0.4, h: A.h };
    S = { x: A.x + A.w * 0.41, y: A.y, w: A.w * 0.59, h: A.h };
  }
  const cw2 = Math.min(S.w / 3.25, S.h / 2.62);
  const g2 = mriezka(S, cw2);
  const ew = Math.min(E.w * 0.86, (E.h * 0.94) / 1.3);
  const karta2 = kartaDokazu(dpr, DOKAZY[1], ew);
  // lupa: kresba stôp vo vyššom rozlíšení
  const m = 1.9;
  const velka = sprite(dpr, karta2.geo.kw * m, karta2.geo.kh * m, (x) => obrazok(x, 'stopy', 0, 0, karta2.geo.kw * m, karta2.geo.kh * m));
  const rL = ew * 0.2;
  const lupa = sprite(dpr, rL * 4.2, rL * 4.2, (x) => {
    const c = rL * 1.5;
    x.lineCap = 'round';
    x.strokeStyle = '#3a2616'; x.lineWidth = rL * 0.34;
    x.beginPath(); x.moveTo(c + rL * 0.8, c + rL * 0.8); x.lineTo(c + rL * 2.35, c + rL * 2.35); x.stroke();
    x.strokeStyle = '#6b4a2e'; x.lineWidth = rL * 0.22;
    x.beginPath(); x.moveTo(c + rL * 0.85, c + rL * 0.85); x.lineTo(c + rL * 2.3, c + rL * 2.3); x.stroke();
    const gg = x.createLinearGradient(c - rL, c - rL, c + rL, c + rL);
    gg.addColorStop(0, '#f6d58e'); gg.addColorStop(0.5, '#b8862f'); gg.addColorStop(1, '#e8c070');
    x.strokeStyle = gg; x.lineWidth = rL * 0.16;
    x.beginPath(); x.arc(c, c, rL, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = rL * 0.05;
    x.beginPath(); x.arc(c, c, rL * 0.8, Math.PI * 1.1, Math.PI * 1.45); x.stroke();
  });
  lupa.stred = rL * 1.5;
  // pečiatka
  const pw = cw2 * 0.84, ph = pw * 0.3;
  const peciatka = sprite(dpr, pw, ph, (x) => {
    zaoblene(x, pw * 0.02, pw * 0.02, pw * 0.96, ph - pw * 0.04, pw * 0.04);
    x.fillStyle = 'rgba(253,246,236,0.9)'; x.fill();
    x.strokeStyle = 'rgba(190,40,25,0.92)'; x.lineWidth = pw * 0.025;
    zaoblene(x, pw * 0.02, pw * 0.02, pw * 0.96, ph - pw * 0.04, pw * 0.04); x.stroke();
    x.lineWidth = pw * 0.01;
    zaoblene(x, pw * 0.05, pw * 0.05, pw * 0.9, ph - pw * 0.1, pw * 0.03); x.stroke();
    x.fillStyle = 'rgba(190,40,25,0.95)'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const v = zmestPismo('NOT AT THE WINDOW', 700, ph * 0.36, pw * 0.8);
    x.font = pismo(700, v);
    rozostup(x,'NOT AT THE WINDOW', pw / 2, ph / 2 + v * 0.04, v * 0.05);
  });
  L.pod = {
    cw, cw2, g1, g2, E, S, karta2, ew, velka, m, rL, lupa, peciatka,
    karty: PODOZRIVI.map((p) => kartaPodozriveho(dpr, p, cw)),
    e: { x: E.x + E.w / 2, y: E.y + E.h / 2 },
  };
}

/** Kódový kotúč zo sady: vonkajší kruh stojí, vnútorný sa točí. Rady s kódom a odpoveďou. */
function stavKotuc(dpr, R) {
  const A = R.A, s = R.s;
  let D, cx, cy, b, rx, ry1;
  if (R.stred) {
    b = Math.min(A.w / 11.4, s * 0.068);
    const kodH = b * 1.18 * 2 + b * 0.3;
    D = Math.min(A.w * 0.8, A.h - kodH - s * 0.05);
    cx = A.x + A.w / 2; cy = A.y + D / 2 + (A.h - D - kodH - s * 0.04) * 0.35;
    rx = cx - (b * 1.12 * 10 - b * 0.12) / 2;
    ry1 = cy + D / 2 + s * 0.04;
  } else {
    D = Math.min(A.w, A.h) * 0.88;
    cx = A.x + A.w / 2; cy = A.y + A.h / 2;
    b = Math.min(R.cap.w / 11.4, s * 0.06);
    rx = R.cap.x;
    ry1 = R.cap.y + R.capPx * 1.3 * 2 + s * 0.05;
  }
  const Rr = D / 2, krok = (Math.PI * 2) / 26;
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const vonk = sprite(dpr, D, D, (x) => {
    x.translate(Rr, Rr);
    x.beginPath(); x.arc(0, 0, Rr, 0, Math.PI * 2); x.fillStyle = '#fdfaf2'; x.fill();
    x.strokeStyle = FARBY.ink; x.lineWidth = Rr * 0.012; x.stroke();
    x.beginPath(); x.arc(0, 0, Rr * 0.72, 0, Math.PI * 2); x.stroke();
    x.font = pismo(700, Rr * 0.1); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = FARBY.ink;
    for (let i = 0; i < 26; i++) {
      const a = i * krok;
      x.save(); x.rotate(a); x.fillText(ABC[i], 0, -Rr * 0.86); x.restore();
      x.save(); x.rotate(a + krok / 2);
      x.strokeStyle = 'rgba(27,26,23,0.35)'; x.lineWidth = Rr * 0.006;
      x.beginPath(); x.moveTo(0, -Rr * 0.74); x.lineTo(0, -Rr * 0.98); x.stroke(); x.restore();
    }
  });
  const vnut = sprite(dpr, D, D, (x) => {
    x.translate(Rr, Rr);
    x.beginPath(); x.arc(0, 0, Rr * 0.7, 0, Math.PI * 2); x.fillStyle = '#f3ecdc'; x.fill();
    x.strokeStyle = FARBY.ink; x.lineWidth = Rr * 0.012; x.stroke();
    x.beginPath(); x.arc(0, 0, Rr * 0.5, 0, Math.PI * 2); x.strokeStyle = 'rgba(27,26,23,0.4)'; x.lineWidth = Rr * 0.006; x.stroke();
    x.font = pismo(700, Rr * 0.085); x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i < 26; i++) {
      x.save(); x.rotate(i * krok);
      x.fillStyle = i === 0 ? FARBY.akcent : FARBY.ink2;
      x.fillText(ABC[i], 0, -Rr * 0.6); x.restore();
    }
    x.fillStyle = FARBY.akcent;
    x.beginPath(); x.arc(0, 0, Rr * 0.03, 0, Math.PI * 2); x.fill();
  });
  const kluc = sprite(dpr, Rr * 0.8, Rr * 0.3, (x) => {
    x.font = pismo(700, Rr * 0.075); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = FARBY.akcent;
    rozostup(x,'KEY 5', Rr * 0.4, Rr * 0.08, Rr * 0.01);
    x.font = pismo(500, Rr * 0.05); x.fillStyle = FARBY.ink2;
    x.fillText('inner A under F', Rr * 0.4, Rr * 0.19);
  });
  const krokX = b * 1.12;
  const radKod = sprite(dpr, krokX * 10, b, (x) => {
    for (let i = 0; i < 10; i++) {
      const ch = KOD[i]; if (ch === ' ') continue;
      zaoblene(x, i * krokX, 0, b, b, b * 0.12); x.fillStyle = FARBY.papier; x.fill();
      x.font = pismo(700, b * 0.56); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = FARBY.ink;
      x.fillText(ch, i * krokX + b / 2, b / 2 + b * 0.03);
    }
  });
  const radPrazdny = sprite(dpr, krokX * 10, b, (x) => {
    for (let i = 0; i < 10; i++) {
      if (KOD[i] === ' ') continue;
      zaoblene(x, i * krokX + 1, 1, b - 2, b - 2, b * 0.12);
      x.strokeStyle = 'rgba(245,234,214,0.55)'; x.lineWidth = 2; x.setLineDash([b * 0.12, b * 0.08]); x.stroke();
    }
  });
  const pismena = {};
  for (const ch of new Set(OTVORENY.replace(/ /g, ''))) {
    pismena[ch] = sprite(dpr, b, b, (x) => {
      zaoblene(x, 0, 0, b, b, b * 0.12); x.fillStyle = '#fff3dc'; x.fill();
      x.font = pismo(700, b * 0.58); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = FARBY.akcent;
      x.fillText(ch, b / 2, b / 2 + b * 0.03);
    });
  }
  L.kotuc = { D, Rr, cx, cy, krok, vonk, vnut, kluc, b, krokX, rx, ry1, ry2: ry1 + b * 1.3, radKod, radPrazdny, pismena };
}

/** Zapečatený list: „Top secret“, text zo sady, vosková pečať s otáznikom. */
function stavList(dpr, R) {
  const A = R.A;
  const w = Math.min(A.w * 0.86, (A.h * 0.8) / 0.64), h = w * 0.64;
  const sp = karta(dpr, w, h, (x) => {
    x.fillStyle = 'rgba(120,90,50,0.08)';
    x.beginPath(); x.moveTo(0, 0); x.lineTo(w / 2, h * 0.5); x.lineTo(w, 0); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(90,65,35,0.35)'; x.lineWidth = w * 0.004;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(w / 2, h * 0.5); x.lineTo(w, 0); x.stroke();
    x.beginPath(); x.moveTo(0, h); x.lineTo(w * 0.36, h * 0.62); x.moveTo(w, h); x.lineTo(w * 0.64, h * 0.62); x.strokeStyle = 'rgba(90,65,35,0.18)'; x.stroke();
    x.textAlign = 'center'; x.textBaseline = 'top';
    x.font = pismo(600, w * 0.075, SERIF); x.fillStyle = FARBY.ink;
    x.fillText('Top secret', w / 2, h * 0.64);
    x.font = pismo(400, w * 0.033); x.fillStyle = FARBY.ink2;
    const r = zalom(x, 'A letter from the helper who was at the kitchen window.', w * 0.7);
    r.forEach((t, i) => x.fillText(t, w / 2, h * 0.78 + i * w * 0.042));
  }, { farba: FARBY.obalka, r: 0.018 });
  const rs = h * 0.12;
  const pecat = sprite(dpr, rs * 2.4, rs * 2.4, (x) => {
    const c = rs * 1.2;
    x.fillStyle = '#8f2412';
    x.beginPath();
    for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2, rr = rs * (1.02 + (i % 2 ? 0.06 : 0) + hash(i, 9) * 0.05); x.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr); }
    x.fill();
    const gg = x.createRadialGradient(c - rs * 0.3, c - rs * 0.3, rs * 0.1, c, c, rs);
    gg.addColorStop(0, '#d9492c'); gg.addColorStop(1, FARBY.vosk);
    x.fillStyle = gg; x.beginPath(); x.arc(c, c, rs * 0.86, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(80,15,5,0.5)'; x.lineWidth = rs * 0.05; x.beginPath(); x.arc(c, c, rs * 0.66, 0, Math.PI * 2); x.stroke();
    x.font = pismo(600, rs * 0.95, SERIF); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(255,225,200,0.92)';
    x.fillText('?', c, c + rs * 0.05);
  });
  L.list = { sp, pecat, w, h, cx: A.x + A.w / 2, cy: A.y + A.h * 0.47 };
}

// ---------- kreslenie ----------

/** Karta v polohe (cx, cy stred), otočená o rot stupňov, mierka k, výška nad stolom v (0 leží). */
function kresliKartu(x, k, cx, cy, rot, mierka = 1, v = 0, alfa = 1, sirka = k.w) {
  const f = sirka / k.w;
  const w = k.w * f * mierka, h = k.h * f * mierka, b = k.b * f * mierka;
  x.save();
  x.globalAlpha = alfa * (0.8 - v * 0.35);
  const off = (0.012 + v * 0.09) * w;
  x.translate(cx + off * 0.6, cy + off);
  x.rotate((rot * Math.PI) / 180);
  x.drawImage(k.tien, -w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b);
  x.restore();
  x.save();
  x.globalAlpha = alfa;
  x.translate(cx, cy);
  x.rotate((rot * Math.PI) / 180);
  x.drawImage(k.c, -w / 2, -h / 2, w, h);
  x.restore();
}

/** Let karty na stôl: odkiaľ (smer von z obrazu), mierka z 1,55 na 1, dopad s malým pruženín. */
function letKarty(t, dopad, trv, dx, dy, rot, { zdola = false, od = 1.55 } = {}) {
  const p = okno(t, dopad - trv, dopad);
  if (p <= 0) return null;
  // zdola: karta priletí zospodu a zboku, nikdy cez názov nad kartami (hák a záver)
  const ex = zdola ? dx + (dx >= 0 ? 0.45 : -0.45) : dx, ey = zdola ? 1.3 : dy - 0.3;
  const d = Math.hypot(ex, ey) || 1;
  const smer = [ex / d, ey / d];
  const pp = ease.outCubic(p);
  const vzd = (1 - pp) * Math.max(L.W, L.H) * 0.75;
  let mierka = lerp(od, 1, ease.inQuad(p));
  const po = t - dopad;
  if (po >= 0 && po < 0.25) mierka *= 1 - Math.sin(Math.PI * (po / 0.25)) * 0.025 * (1 - po / 0.25);
  return { ox: smer[0] * vzd, oy: smer[1] * vzd, mierka, rot: rot + (1 - pp) * (dx >= 0 ? 24 : -24), v: 1 - ease.inQuad(p), p };
}

/** Prach pri dopade (bezstavovo z času). */
function prach(x, t, dopad, cx, cy, r, sem, env) {
  const po = t - dopad;
  if (po < 0 || po > 0.5) return;
  const q = po / 0.5, n = env.slabe ? 4 : 9;
  x.fillStyle = `rgba(255,236,205,${0.35 * (1 - q)})`;
  for (let j = 0; j < n; j++) {
    const u = hash(sem, j) * Math.PI * 2, d = r * (0.55 + ease.outCubic(q) * (0.25 + hash(j, sem) * 0.3));
    x.beginPath(); x.arc(cx + Math.cos(u) * d, cy + Math.sin(u) * d * 0.8, r * 0.018 * (1 - q) + 0.5, 0, Math.PI * 2); x.fill();
  }
}

/** Výška karty 2 nad stolom (0 leží, 1 vo výške snímky 0): pád v háku, zdvih na konci pred slučkou. */
function vyskaKarty(t) {
  if (t < 3) return 1 - ease.inQuad(okno(t, 0, T.padVyska));
  return ease.inOutSine(okno(t, T.zdvihOd, DLZKA));
}

function kresliStol(x, t, env) {
  const S = L.stol;
  const vHaku = t < 3;
  if (!vHaku && t < T.koniecDopad[0] - T.let) return;
  STOL.forEach((st, i) => {
    const dopad = vHaku ? T.hakDopad[i] : T.koniecDopad[i];
    let l;
    if (i === STOL.length - 1 && (vHaku || t >= T.zdvihOd)) {
      // karta 2 padá kolmo zhora na svoje miesto (len mierka a tieň), nikdy nejde cez text
      const h = vyskaKarty(t);
      const po = t - T.padVyska;
      let mierka = 1 + 0.26 * h;
      if (vHaku && po >= 0 && po < 0.25) mierka *= 1 - Math.sin(Math.PI * (po / 0.25)) * 0.025 * (1 - po / 0.25);
      l = { ox: 0, oy: -h * S.u * 0.08, mierka, rot: st.rot + h * 7, v: h };
    } else {
      l = letKarty(t, dopad, T.let, st.dx, st.dy, st.rot, { zdola: true, od: 1.3 });
    }
    if (!l) return;
    let cx = S.cx + st.dx * S.u + l.ox, cy = S.cy + st.dy * S.u + l.oy, rot = l.rot;
    if (vHaku && t > T.hakPrec) {
      // hák odchádza: karty sa zosunú zo stola von, každá svojím smerom
      const q = ease.inCubic(okno(t, T.hakPrec + i * 0.04, T.hakPrec + 0.5 + i * 0.04));
      if (q >= 1) return;
      const d = Math.hypot(st.dx, st.dy) || 1, sm = st.dx === 0 ? [0.35, 1] : [st.dx / d, st.dy / d];
      cx += sm[0] * q * Math.max(L.W, L.H) * 0.9; cy += sm[1] * q * Math.max(L.W, L.H) * 0.9; rot += q * (st.dx >= 0 ? 18 : -18);
    }
    kresliKartu(x, S.karty[st.k], cx, cy, rot, l.mierka, l.v);
    prach(x, t, dopad, S.cx + st.dx * S.u, S.cy + st.dy * S.u, S.u * 0.9, 40 + i, env);
  });
}

function kresliFoto(x, t, env) {
  if (t < T.fotoOd || t > T.fotoPrecDo) return;
  const F = L.foto;
  // zboku (zľava), nie zhora: nikdy neprejde cez titulok; odíde doprava
  const l = letKarty(t, T.fotoDopad, T.fotoDopad - T.fotoOd, -1, 0.3, -2.5, { od: 1.2 });
  if (!l) return;
  let cx = F.cx + l.ox, cy = F.cy + l.oy, rot = l.rot;
  const q = ease.inCubic(okno(t, T.fotoPrecOd, T.fotoPrecDo));
  cx += q * L.W * 1.1; cy -= q * L.H * 0.1; rot -= q * 14;
  kresliKartu(x, F.sp, cx, cy, rot, l.mierka, l.v);
  prach(x, t, T.fotoDopad, F.cx, F.cy, F.sp.w * 0.55, 7, env);
}

function kresliPodozrivych(x, t, env) {
  if (t < T.podOd - 0.05 || t > T.stopaPrecDo) return;
  const P = L.pod;
  const presun = ease.inOutCubic(okno(t, T.stopaPresunOd, T.stopaPresunDo));
  const prec = ease.inCubic(okno(t, T.stopaPrecOd, T.stopaPrecDo));
  const tlm = ease.outCubic(okno(t, T.tlmOd, T.tlmOd + 0.4));
  const zdvih = ease.outBack(okno(t, T.zdvih, T.zdvih + 0.35), 2);
  const poradie = [0, 1, 3, 4, 2]; // Olive navrchu (kvôli zdvihu a pečiatke)
  for (const i of poradie) {
    const dopad = T.podOd + i * T.podKrok + T.podLet;
    const p = okno(t, dopad - T.podLet, dopad);
    if (p <= 0) continue;
    const pp = ease.outCubic(p);
    const a = P.g1[i], b = P.g2[i];
    let cx = lerp(a.x, b.x, presun), cy = lerp(a.y, b.y, presun);
    const sirka = lerp(P.cw, P.cw2, presun);
    // rozdávanie zdola ako z balíčka
    cx = lerp(L.W / 2, cx, pp); cy = lerp(L.H * 1.25, cy, pp);
    let rot = POD_ROT[i] + (1 - pp) * (i % 2 ? 30 : -30);
    let mierka = 1, v = (1 - pp) * 0.6;
    const po = t - dopad;
    if (po >= 0 && po < 0.22) mierka = 1 - Math.sin(Math.PI * (po / 0.22)) * 0.03;
    if (i === OLIVE) { mierka *= 1 + 0.08 * zdvih; v += 0.35 * zdvih; rot = lerp(rot, 0, obmedz(zdvih)); }
    cy += prec * L.H * 0.08;
    const alfa = 1 - prec;
    kresliKartu(x, P.karty[i], cx, cy, rot, mierka, v, alfa, sirka);
    if (tlm > 0 && i !== OLIVE) {
      const w = sirka, h = sirka * 1.25;
      x.save(); x.translate(cx, cy); x.rotate((rot * Math.PI) / 180);
      x.globalAlpha = alfa * tlm * 0.6; x.fillStyle = '#140c07';
      zaoblene(x, -w / 2, -h / 2, w, h, w * 0.025); x.fill();
      x.restore();
    }
    if (i === OLIVE) {
      // pečiatka „NOT AT THE WINDOW“
      const q = okno(t, T.peciatka, T.peciatkaDopad);
      if (q > 0) {
        const pc = P.peciatka, k = lerp(1.9, 1, ease.inQuad(q)) * (sirka / P.cw2) * mierka;
        // nad vydrou (horná, prázdna časť kresby), nezakryje ani vydru, ani riadok FEET
        x.save(); x.translate(cx + sirka * 0.03, cy - sirka * 1.25 * 0.19); x.rotate(((rot - 8) * Math.PI) / 180);
        x.globalAlpha = alfa * obmedz(q * 2.5);
        x.drawImage(pc.c, (-pc.w * k) / 2, (-pc.h * k) / 2, pc.w * k, pc.h * k);
        x.restore();
      }
    }
    if (presun === 0) prach(x, t, dopad, a.x, a.y, P.cw * 0.7, 60 + i, env);
  }
}

function kresliStopu(x, t, env) {
  if (t < T.kartaOd || t > T.stopaPrecDo) return;
  const P = L.pod, k = P.karta2;
  const l = letKarty(t, T.kartaDopad, T.kartaDopad - T.kartaOd, -1, 0.3, 0, { od: 1.2 }); // zľava, nie cez titulok
  if (!l) return;
  const prec = ease.inCubic(okno(t, T.stopaPrecOd, T.stopaPrecDo));
  const cx = P.e.x + l.ox, cy = P.e.y + l.oy + prec * L.H * 0.08;
  kresliKartu(x, k, cx, cy, l.rot, l.mierka, l.v, 1 - prec);
  prach(x, t, T.kartaDopad, P.e.x, P.e.y, k.w * 0.7, 3, env);
  const x0 = P.e.x - k.w / 2, y0 = P.e.y - k.h / 2;
  const G = k.geo;
  // lupa prejde po stopách
  const zjav = ease.outBack(okno(t, T.lupaOd, T.lupaOd + 0.3), 1.6) * (1 - ease.inCubic(okno(t, T.lupaDo - 0.25, T.lupaDo)));
  if (zjav > 0.01 && t < T.lupaDo) {
    const q = ease.inOutSine(okno(t, T.lupaTahOd, T.lupaTahDo));
    const lx = x0 + G.kx + G.kw * lerp(0.28, 0.72, q), ly = y0 + G.ky + G.kh * (0.66 + Math.sin(q * Math.PI * 2) * 0.06);
    const r = P.rL * zjav, m = P.m;
    x.save();
    x.beginPath(); x.arc(lx, ly, r, 0, Math.PI * 2); x.clip();
    x.fillStyle = FARBY.papier; x.fillRect(lx - r, ly - r, 2 * r, 2 * r);
    const kx = x0 + G.kx, ky = y0 + G.ky;
    x.drawImage(P.velka.c, lx - (lx - kx) * m, ly - (ly - ky) * m, G.kw * m, G.kh * m);
    const gg = x.createRadialGradient(lx - r * 0.3, ly - r * 0.4, 0, lx, ly, r);
    gg.addColorStop(0, 'rgba(255,255,255,0.22)'); gg.addColorStop(1, 'rgba(180,210,230,0.08)');
    x.fillStyle = gg; x.fillRect(lx - r, ly - r, 2 * r, 2 * r);
    x.restore();
    const lp = P.lupa, sc = zjav;
    x.drawImage(lp.c, lx - lp.stred * sc, ly - lp.stred * sc, lp.w * sc, lp.h * sc);
  }
  // červená niť od stôp k Olive
  const pn = ease.inOutCubic(okno(t, T.nitOd, T.nitDo));
  if (pn > 0) {
    const ax = x0 + G.kx + G.kw * 0.55, ay = y0 + G.ky + G.kh * 0.7;
    // koniec nite: špendlík v pravom hornom rohu karty Olive (nezakryje meno)
    const o = P.g2[OLIVE], bx = o.x + P.cw2 * 0.34, by = o.y - P.cw2 * 1.25 * 0.44;
    const mx = (ax + bx) / 2, my = Math.max(ay, by) + Math.abs(bx - ax) * 0.12 + P.cw2 * 0.15;
    x.save();
    x.globalAlpha = 1 - prec;
    x.strokeStyle = '#d23b22'; x.lineWidth = Math.max(2, P.ew * 0.012); x.lineCap = 'round';
    const n = 40, kon = Math.max(1, Math.round(n * pn));
    x.beginPath();
    for (let i = 0; i <= kon; i++) {
      const u = i / n, px = (1 - u) * (1 - u) * ax + 2 * u * (1 - u) * mx + u * u * bx, py = (1 - u) * (1 - u) * ay + 2 * u * (1 - u) * my + u * u * by;
      if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
    }
    x.stroke();
    const spendlik = (px, py) => {
      x.fillStyle = '#c8321c'; x.beginPath(); x.arc(px, py, P.ew * 0.028, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.6)'; x.beginPath(); x.arc(px - P.ew * 0.009, py - P.ew * 0.009, P.ew * 0.008, 0, Math.PI * 2); x.fill();
    };
    spendlik(ax, ay);
    if (pn >= 1) spendlik(bx, by);
    x.restore();
  }
}

function uholKodu(i) {
  const ch = KOD.replace(/ /g, '')[i];
  return (ch.charCodeAt(0) - 65) * L.kotuc.krok;
}

function kresliKotuc(x, t) {
  if (t < T.kotucOd || t > T.kotucPrecDo) return;
  const K = L.kotuc;
  const pr = ease.outCubic(okno(t, T.kotucOd, T.kotucDo));
  const prec = ease.inCubic(okno(t, T.kotucPrecOd, T.kotucPrecDo));
  const mierka = lerp(0.55, 1, pr) * (1 - prec * 0.2);
  const cely = (1 - pr) * -1.2 + prec * 0.6;
  const alfa = obmedz(pr * 1.6) * (1 - prec);
  // vnútorný kruh: 5 krokov (kľúč 5), každý s cvaknutím
  let th = 0;
  for (let k = 0; k < KLUC; k++) th += ease.inOutCubic(okno(t, T.krokOd + k * T.krok, T.krokOd + k * T.krok + T.krok * 0.75));
  th *= K.krok;
  const D = K.D * mierka;
  x.save();
  x.globalAlpha = alfa;
  // tieň
  x.fillStyle = 'rgba(0,0,0,0.35)';
  x.beginPath(); x.arc(K.cx + D * 0.02, K.cy + D * 0.03, D / 2, 0, Math.PI * 2); x.fill();
  x.translate(K.cx, K.cy);
  x.rotate(cely);
  x.drawImage(K.vonk.c, -D / 2, -D / 2, D, D);
  x.save(); x.rotate(th); x.drawImage(K.vnut.c, -D / 2, -D / 2, D, D); x.restore();
  // ukazovateľ: výsek cez oba kruhy na písmene kódu
  const pa = obalka(t, T.dekOd - 0.2, T.kotucPrecOd, 0.2, 0.25);
  if (pa > 0) {
    const n = 9;
    let fi = uholKodu(0);
    for (let i = 1; i < n; i++) {
      const di = T.dekOd + i * T.dekKrok;
      const q = ease.inOutCubic(okno(t, di - T.dekKrok * 0.6, di - T.dekKrok * 0.05));
      if (q <= 0) break;
      let a0 = uholKodu(i - 1), a1 = uholKodu(i);
      let d = a1 - a0; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      fi = a0 + d * q;
    }
    const R = D / 2, w = K.krok * 0.55;
    x.rotate(fi);
    x.globalAlpha = alfa * pa;
    x.beginPath(); x.arc(0, 0, R * 0.99, -Math.PI / 2 - w, -Math.PI / 2 + w); x.arc(0, 0, R * 0.5, -Math.PI / 2 + w, -Math.PI / 2 - w, true); x.closePath();
    x.fillStyle = 'rgba(210,59,34,0.16)'; x.fill();
    x.strokeStyle = 'rgba(190,45,25,0.9)'; x.lineWidth = R * 0.014; x.stroke();
    x.beginPath(); x.arc(0, -R * 0.86, R * 0.075, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.arc(0, -R * 0.6, R * 0.065, 0, Math.PI * 2); x.stroke();
  }
  x.restore();
  // kľúč v strede
  const ka = obalka(t, T.krokOd - 0.05, T.kotucPrecOd, 0.3, 0.3) * alfa;
  if (ka > 0) { x.globalAlpha = ka; const kk = K.kluc, sc = mierka; x.drawImage(kk.c, K.cx - (kk.w * sc) / 2, K.cy + K.Rr * 0.12 * sc, kk.w * sc, kk.h * sc); x.globalAlpha = 1; }
  // rady: kód a odpoveď
  const ra = obmedz(okno(t, T.kotucOd + 0.25, T.kotucOd + 0.6)) * (1 - prec);
  if (ra > 0) {
    x.globalAlpha = ra;
    x.drawImage(K.radKod.c, K.rx, K.ry1, K.radKod.w, K.radKod.h);
    x.drawImage(K.radPrazdny.c, K.rx, K.ry2, K.radPrazdny.w, K.radPrazdny.h);
    let j = 0;
    for (let i = 0; i < 10; i++) {
      const ch = OTVORENY[i];
      if (ch === ' ') continue;
      const di = T.dekOd + j * T.dekKrok; j++;
      const q = okno(t, di, di + 0.16);
      if (q <= 0) continue;
      const sp = K.pismena[ch], sc = 1 + (1 - ease.outBack(q, 2.4)) * 0.4;
      const bx = K.rx + i * K.krokX + K.b / 2, by = K.ry2 + K.b / 2;
      x.globalAlpha = ra * obmedz(q * 3);
      x.drawImage(sp.c, bx - (K.b * sc) / 2, by - (K.b * sc) / 2, K.b * sc, K.b * sc);
    }
    // hotovo: záblesk po celej odpovedi
    const z = okno(t, T.dekOd + 8 * T.dekKrok + 0.15, T.dekOd + 8 * T.dekKrok + 0.75);
    if (z > 0 && z < 1) {
      x.globalAlpha = ra * Math.sin(Math.PI * z) * 0.8;
      x.strokeStyle = '#ffd98a'; x.lineWidth = K.b * 0.06;
      zaoblene(x, K.rx - K.b * 0.12, K.ry2 - K.b * 0.12, K.krokX * 10 - K.b * 0.12 + K.b * 0.24 - K.krokX + K.b, K.b * 1.24, K.b * 0.2);
      x.stroke();
    }
    x.globalAlpha = 1;
  }
}

function kresliList(x, t, env) {
  if (t < T.listOd || t > T.listPrecDo) return;
  const Ls = L.list;
  const l = letKarty(t, T.listDopad, T.listDopad - T.listOd, 1, 0.3, 1.5, { od: 1.2 }); // sprava, odíde doľava
  if (!l) return;
  const q = ease.inCubic(okno(t, T.listPrecOd, T.listPrecDo));
  const cx = Ls.cx + l.ox - q * L.W * 1.1, cy = Ls.cy + l.oy - q * L.H * 0.05, rot = l.rot + q * 12;
  kresliKartu(x, Ls.sp, cx, cy, rot, l.mierka, l.v);
  prach(x, t, T.listDopad, Ls.cx, Ls.cy, Ls.w * 0.55, 11, env);
  let pul = 0;
  for (const p of T.pulz) { const u = okno(t, p, p + 0.35); if (u > 0 && u < 1) pul = Math.max(pul, Math.sin(Math.PI * u)); }
  const pc = Ls.pecat, k = l.mierka * (1 + 0.12 * pul);
  x.save(); x.translate(cx, cy); x.rotate((rot * Math.PI) / 180);
  const py = -Ls.h * l.mierka / 2 + Ls.h * 0.5 * l.mierka;
  if (pul > 0) {
    const gg = x.createRadialGradient(0, py, 0, 0, py, pc.w * 0.9);
    gg.addColorStop(0, `rgba(255,120,80,${0.3 * pul})`); gg.addColorStop(1, 'rgba(255,120,80,0)');
    x.fillStyle = gg; x.fillRect(-pc.w, py - pc.w, pc.w * 2, pc.w * 2);
  }
  x.drawImage(pc.c, (-pc.w * k) / 2, py - (pc.h * k) / 2, pc.w * k, pc.h * k);
  x.restore();
}

function kresliTexty(x, t) {
  const { R, texty } = L;
  const { poz, colX } = texty;
  const tx = R.stred ? R.Z.x0 : colX;
  if (t < HAK.koniec) {
    HAK.kresliRiadok(x, t, texty.kicker, tx, poz.kicker, -0.04);
    HAK.kresliNazov(x, t, texty.nazov, tx, poz.nazov);
    HAK.kresliRiadok(x, t, texty.veta, tx, poz.veta, 0.1);
    // cena už v háku: snímka 0 má rovnaké zloženie ako záver (slučka bez skoku, ponuka hneď viditeľná)
    HAK.kresliRiadok(x, t, texty.cena, texty.btn.x - 4, texty.btn.y - 4, 0.14);
  }
  for (const tt of texty.titulky) {
    const a = obalka(t, tt.od, tt.do, 0.3, 0.3);
    if (a <= 0) continue;
    const vstup = ease.outCubic(okno(t, tt.od, tt.od + 0.4));
    x.globalAlpha = a;
    x.drawImage(tt.sp.c, R.cap.x, R.cap.y + (1 - vstup) * R.s * 0.02, tt.sp.w, tt.sp.h);
    x.globalAlpha = 1;
  }
  const vyjdi = (sp, od, y, trv = 0.6) => {
    const p = ease.outCubic(okno(t, od, od + trv));
    if (p <= 0) return;
    x.save();
    x.beginPath(); x.rect(tx - 10, y - 6, sp.w + 20, sp.h + 12); x.clip();
    x.globalAlpha = obmedz(p * 1.5);
    x.drawImage(sp.c, tx, y + (1 - p) * sp.h * 0.9, sp.w, sp.h);
    x.restore();
  };
  vyjdi(texty.kicker, T.kicker, poz.kicker, 0.5);
  vyjdi(texty.nazov, T.nazov, poz.nazov, 0.75);
  vyjdi(texty.veta, T.veta, poz.veta);
  const pb = okno(t, T.cena, T.cena + 0.5);
  if (pb > 0) {
    const b = texty.cena, sc = 0.85 + 0.15 * ease.outBack(pb, 2.2);
    const { x: bx0, y: by0, w, h } = texty.btn;
    const cx = bx0 + w / 2, cy = by0 + h / 2;
    x.globalAlpha = obmedz(pb * 2);
    x.drawImage(b.c, cx - (b.w * sc) / 2, cy - (b.h * sc) / 2, b.w * sc, b.h * sc);
    const q = okno(t, T.lesk, T.lesk + 0.7);
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
  x.globalAlpha = 0.05;
  x.fillStyle = z.vzor;
  x.fillRect(0, 0, L.W * L.dpr, L.H * L.dpr);
  x.restore();
}

function nacitajObrazok(svg) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

const film = {
  dlzka: DLZKA,
  plagat: 1.0,
  titulky: [
    { od: 0, text: 'The Case of the Missing Birthday Cake. Evidence cards lie on a wooden table and one more drops onto them. Printable detective party game, ages 8 to 12. 6.90 EUR at arling.sk/shop.' },
    { od: 1.95, text: 'A photo of the kitchen window with an empty cake plate. Granny Badger’s birthday cake has vanished.' },
    { od: 3.8, text: 'Five suspect cards: Hazel the Hedgehog, Milo the Magpie, Olive the Otter, Scout the Squirrel and Rufus the Hare. Only one was at the kitchen window.' },
    { od: 6.75, text: 'Evidence card 2, footprints in the soil. A magnifying glass shows webbed footprints in the vegetable patch.' },
    { od: 8.45, text: 'A red thread runs to Olive, the only helper with webbed feet. A stamp says not at the window.' },
    { od: 10.75, text: 'The code wheel turns to key 5 and cracks a practice code: M T S J D H F P J becomes HONEY CAKE.' },
    { od: 14.4, text: 'A sealed envelope marked Top secret: a letter from the helper who was at the kitchen window. The answer waits inside.' },
    { od: 16.55, text: 'The Case of the Missing Birthday Cake. Printable detective party game, ages 8 to 12. 6.90 EUR at arling.sk/shop.' },
  ],
  async pripravit() {
    if (document.fonts && document.fonts.load) {
      await Promise.all([
        document.fonts.load(pismo(700, 40)), document.fonts.load(pismo(600, 40)), document.fonts.load(pismo(500, 40)), document.fonts.load(pismo(400, 40)),
        document.fonts.load(pismo(600, 40, SERIF)), document.fonts.load(pismo(400, 40, SERIF)), document.fonts.load(pismo('italic 400', 40, SERIF)),
      ]).catch(() => {});
    }
    const mena = Object.keys(KRESBY);
    const obr = await Promise.all(mena.map((m) => nacitajObrazok(KRESBY[m].svg)));
    OBR = {};
    mena.forEach((m, i) => { if (obr[i]) OBR[m] = obr[i]; });
  },
  vrstvy: stavVrstiev,
  kresli(x, t, W, H, env) {
    x.drawImage(L.poz, 0, 0, W, H);
    kresliStol(x, t, env);
    kresliFoto(x, t, env);
    kresliPodozrivych(x, t, env);
    kresliStopu(x, t, env);
    kresliKotuc(x, t);
    kresliList(x, t, env);
    kresliTexty(x, t);
    kresliZrno(x, t, env);
  },
  stredPlagatu() { const S = L.stol; return [S.cx, S.cy]; },
  // štítok s cenou vedie na stránku sady (tam je nákup aj všetkých 15 strán)
  odkazy() {
    const b = L.texty.btn;
    return [{ x: b.x, y: b.y, w: b.w, h: b.h, href: '/shop/detective-kit/', text: 'The detective kit, 6.90 EUR', od: T.cena, udalost: 'detective_film_to_kit' }];
  },
  zvuk: partitura(),
};

function partitura() {
  const u = [];
  // hák: tajomný akord a mol, zvony, dopady kariet od snímky 0
  u.push(...HAK.zvuk({ akord: ['A2', 'E3', 'C4', 'E4'], zvony: ['A4', 'E5', 'A5'] }));
  const dopadKarty = (t, pan, hlas = 1) => {
    u.push({ t, typ: 'tuk', f: 92, dlzka: 0.2, hlas: 0.2 * hlas, pan });
    u.push({ t, typ: 'sum', filter: 'bandpass', f0: 2400, f1: 900, q: 0.9, dlzka: 0.14, hlas: 0.09 * hlas, pan, dozvuk: 0.15 });
  };
  const svih = (t, pan, hlas = 1) => u.push({ t, typ: 'sum', filter: 'bandpass', f0: 700, f1: 2600, q: 0.8, dlzka: 0.32, nabeh: 0.28, tvar: 'narast', hlas: 0.05 * hlas, pan, dozvuk: 0.15 });
  T.hakDopad.forEach((d, i) => {
    const pan = STOL[i].dx * 0.3;
    if (d - 0.3 >= 0) svih(d - 0.3, pan);
    if (d >= 0) dopadKarty(d, pan);
  });
  // fotka okna
  svih(T.fotoOd, 0.1);
  dopadKarty(T.fotoDopad, 0);
  u.push({ t: 1.9, typ: 'pad', noty: ['A2', 'E3', 'G3', 'C4'], dlzka: 1.9, nabeh: 0.4, dobeh: 0.6, hlas: 0.12, filter: 700 });
  u.push({ t: T.fotoDopad + 0.05, typ: 'zvon', f: 'E5', index: 0.6, dlzka: 1.6, hlas: 0.07, dozvuk: 0.6 });
  u.push({ t: T.fotoDopad + 0.35, typ: 'zvon', f: 'C5', index: 0.6, dlzka: 1.6, hlas: 0.05, dozvuk: 0.6 });
  u.push({ t: T.fotoPrecOd, typ: 'sum', filter: 'bandpass', f0: 2600, f1: 600, q: 0.7, dlzka: 0.4, nabeh: 0.1, tvar: 'narast', hlas: 0.06, dozvuk: 0.2 });
  // podozriví: každý svoj tón z pentatoniky
  u.push({ t: 3.55, typ: 'pad', noty: ['C3', 'G3', 'E4'], dlzka: 3.0, nabeh: 0.6, dobeh: 0.8, hlas: 0.12, filter: 900 });
  ['A4', 'C5', 'D5', 'E5', 'G5'].forEach((f, i) => {
    const d = T.podOd + i * T.podKrok + T.podLet;
    svih(d - T.podLet, (i - 2) * 0.2, 0.7);
    u.push({ t: d, typ: 'zvon', f, index: 0.9, dlzka: 1.2, hlas: 0.11, pan: (i - 2) * 0.2, dozvuk: 0.35 });
    u.push({ t: d, typ: 'tuk', f: 150, dlzka: 0.08, hlas: 0.07, pan: (i - 2) * 0.2 });
  });
  // stopa
  u.push({ t: 6.45, typ: 'pad', noty: ['A2', 'E3', 'C4', 'D4'], dlzka: 4.2, nabeh: 0.5, dobeh: 0.9, hlas: 0.13, filter: 650, filter2: 1000 });
  svih(T.kartaOd, 0);
  dopadKarty(T.kartaDopad, 0, 0.8);
  u.push({ t: T.lupaOd + 0.1, typ: 'glis', f0: 'C5', f1: 'G5', dlzka: 0.35, hlas: 0.04, dozvuk: 0.5 });
  u.push({ t: T.lupaTahOd, typ: 'sum', filter: 'bandpass', f0: 1200, f1: 1800, q: 1.2, dlzka: 1.0, nabeh: 0.4, tvar: 'narast', hlas: 0.025, dozvuk: 0.3 });
  u.push({ t: T.nitOd, typ: 'glis', f0: 'E4', f1: 'A4', dlzka: 0.5, hlas: 0.05, tvar: 'triangle', dozvuk: 0.35 });
  u.push({ t: T.zdvih + 0.1, typ: 'zvon', f: 'A5', index: 1.1, dlzka: 1.4, hlas: 0.12, dozvuk: 0.45 });
  u.push({ t: T.peciatkaDopad, typ: 'tuk', f: 68, dlzka: 0.32, hlas: 0.3 });
  u.push({ t: T.peciatkaDopad, typ: 'sum', filter: 'lowpass', f0: 1400, f1: 300, dlzka: 0.2, hlas: 0.1 });
  u.push({ t: T.peciatkaDopad + 0.02, typ: 'zvon', f: 'E4', index: 0.5, dlzka: 1.4, hlas: 0.08, dozvuk: 0.5 });
  // kotúč: príchod, päť cvaknutí, dekódovanie stúpajúcou pentatonikou
  u.push({ t: T.kotucOd, typ: 'sum', filter: 'bandpass', f0: 500, f1: 2200, q: 0.7, dlzka: 0.45, nabeh: 0.35, tvar: 'narast', hlas: 0.06 });
  u.push({ t: 10.6, typ: 'pad', noty: ['F2', 'C3', 'A3', 'E4'], dlzka: 3.6, nabeh: 0.5, dobeh: 0.8, hlas: 0.12, filter: 900 });
  for (let k = 0; k < KLUC; k++) {
    const t = T.krokOd + k * T.krok + T.krok * 0.7;
    u.push({ t, typ: 'tuk', f: 2200, dlzka: 0.025, hlas: 0.09, pan: 0.15 });
    u.push({ t, typ: 'sum', filter: 'highpass', f0: 4000, f1: 6000, dlzka: 0.03, hlas: 0.04 });
  }
  ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6'].forEach((f, i) => u.push({ t: T.dekOd + i * T.dekKrok + 0.02, typ: 'zvon', f, index: 0.8, dlzka: 1.0, hlas: 0.1, pan: -0.4 + i * 0.1, dozvuk: 0.35 }));
  const hotovo = T.dekOd + 8 * T.dekKrok + 0.15;
  u.push({ t: hotovo, typ: 'sum', filter: 'highpass', f0: 5000, f1: 9000, dlzka: 0.9, hlas: 0.035, dozvuk: 0.6 });
  u.push({ t: hotovo, typ: 'zvon', f: 'C6', pomer: 3.5, index: 0.7, dlzka: 1.6, hlas: 0.06, dozvuk: 0.6 });
  // zapečatený list: nízky akord, dva údery srdca pečate
  svih(T.listOd, -0.1);
  dopadKarty(T.listDopad, 0);
  u.push({ t: 14.2, typ: 'pad', noty: ['D3', 'A3', 'F4'], dlzka: 2.3, nabeh: 0.4, dobeh: 0.7, hlas: 0.12, filter: 700 });
  for (const p of T.pulz) {
    u.push({ t: p, typ: 'tuk', f: 58, dlzka: 0.22, hlas: 0.2 });
    u.push({ t: p + 0.16, typ: 'tuk', f: 52, dlzka: 0.2, hlas: 0.12 });
  }
  u.push({ t: T.listPrecOd, typ: 'sum', filter: 'bandpass', f0: 2600, f1: 600, q: 0.7, dlzka: 0.4, nabeh: 0.1, tvar: 'narast', hlas: 0.05, dozvuk: 0.2 });
  // záver: karty znova na stôl, názov, cena
  T.koniecDopad.forEach((d, i) => { svih(d - 0.3, STOL[i].dx * 0.3, 0.8); dopadKarty(d, STOL[i].dx * 0.3, 0.85); });
  u.push({ t: T.kicker, typ: 'pad', noty: ['C3', 'G3', 'E4', 'G4'], dlzka: 2.8, nabeh: 0.3, dobeh: 1.6, hlas: 0.17, filter: 1500, filter2: 800 });
  u.push({ t: T.nazov, typ: 'zvon', f: 'C4', index: 0.5, dlzka: 2.6, hlas: 0.14, dozvuk: 0.55 });
  u.push({ t: T.nazov + 0.02, typ: 'zvon', f: 'G4', index: 0.4, dlzka: 2.4, hlas: 0.06, dozvuk: 0.55 });
  u.push({ t: T.veta, typ: 'zvon', f: 'E5', index: 0.4, dlzka: 1.4, hlas: 0.05, dozvuk: 0.5 });
  u.push({ t: T.cena + 0.1, typ: 'tuk', f: 320, dlzka: 0.07, hlas: 0.06 });
  u.push({ t: T.cena + 0.1, typ: 'zvon', f: 'G5', index: 0.5, dlzka: 1.0, hlas: 0.06, dozvuk: 0.5 });
  u.push({ t: T.lesk, typ: 'zvon', f: 'C6', index: 0.5, dlzka: 1.0, hlas: 0.035, dozvuk: 0.6 });
  // karta 2 sa zdvihne pred slučkou (na snímke 0 znova dopadne)
  svih(T.zdvihOd, 0, 0.6);
  return u.filter((e) => e.t >= 0 && e.t < DLZKA);
}

export default film;
