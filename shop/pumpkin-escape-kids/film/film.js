// The Pumpkin Fair Mix-Up: film na 21 sekúnd pre tlačiteľnú únikovú hru pre deti (6,90 €), nakreslený
// a ozvučený kódom (kodfilm engine). Postavy, vozík, obrázky kariet a kódu sú tie isté SVG ako v PDF
// sade (kresby.js); karty, odznak a certifikát sú zjednodušené (kreslí ich film podľa rozloženia sady).
// Scény: hák (červený vozík s kusom sady v korbe: karta 1 s Olive a cvičným kódom, vejár troch
// prehnutých kariet; štítok „Where is Big Marigold?“, názov od snímky 0), jarmok (Farmer Juniper a
// Olive the Owl, stopy kolies), sedem hier jarmoku v reťazi (premiešané poradie), obrázkový kód naživo
// (len cvičné slovo OWL, ktoré sada sama ukazuje), Answer Board so skrytými odpoveďami a karta, ktorá
// sa otvorí, odznak a certifikát, záver v rovnakom zložení ako hák.
// Nič neprezradí, kde je Big Marigold, kto ju odviezol, ani žiadnu odpoveď karty 1 až 7.

import { okno, obmedz, lerp, ease, hash, obalka } from './engine/cas.js';
import { platno, papier, zrno, zaoblene, pismo } from './engine/kresba.js';
import { hak, format, zona, sprite, spriteRiadku, zmestPismo, minPismo, MAX_NAZOV_916 } from './engine/hak.js';
import { KRESBY } from './kresby.js';

const DLZKA = 21;
const SERIF = '"ARLing Serif", Georgia, serif';
// Farby zo sady (ops/produkty/pumpkin-escape-kids/kresby.mjs, FARBY), pozadie teplý papier.
const FARBY = {
  ink: '#1b1a17', ink2: '#3d3934', linka: '#8f877a', svetla: '#d9d2c4', akcent: '#b5501f',
  papier: '#ffffff', krem: '#f6ecd2', koza: '#efe2cc', soft: '#fbf4e8', tekvica: '#ec8f3e', tekvicaTmava: '#c96a28',
  cervena: '#c8452c', zelena: '#8cb563', zelenaTmava: '#5d8a42', slama: '#ecc86a', hnedaSvetla: '#cfae86',
  hnedaTmava: '#7a5a3e', sedaTmava: '#6d665e', sedaSvetla: '#dedad3', trava: '#dfe8cc', sede: 'rgba(143,135,122,0.32)',
};

// Fakty vo filme. Zdroje: ops/produkty/pumpkin-escape-kids/pripad.mjs (HRA, KOD, CVIK, ZAMKY),
// ops/stripe/sady.mjs (suma 690), stránka shop/pumpkin-escape-kids/index.html. test.mjs ich porovná.
export const FAKTY = {
  nazov: 'The Pumpkin Fair Mix-Up',
  podnazov: 'A printable Halloween escape room for kids',
  vek: '6 to 10',
  hracov: '2 to 8',
  cena: '6.90',
  hier: 7,
  cvik: 'OWL',
  // obrázkový kód karty 1: dvojice z kľúča, ktoré film ukazuje (kite, heart, cloud = cvičné OWL)
  kluc: [['hat', 'A'], ['kite', 'O'], ['sun', 'T'], ['heart', 'W'], ['bell', 'I'], ['cloud', 'L']],
  cvikObrazky: ['kite', 'heart', 'cloud'],
  // sedem hier: karta 1 leží na stole (Olive's coded note), karty 2 až 7 sú prehnuté s obrázkom na páse.
  // Poradie 2 až 7 je zámerne premiešané: skutočné poradie (pripad.mjs ZAMKY) je kľúč rodiča a film ho
  // nesmie ukázať (test.mjs overí tú istú množinu, iné poradie a žiadnu dvojicu susedov zo sady).
  karty: ['nota', 'mitten', 'acorn', 'pinecone', 'pear', 'basket', 'leaf'],
  // náklad vozíka v háku a závere: vejár troch prehnutých kariet za kartou 1
  naklad: ['pinecone', 'acorn', 'mitten'],
  // karta, ktorú film otvorí: obrázok za odpoveďou karty 1 (ZAMKY[0].otvori) a jej postava (Mrs Bramble)
  otvorena: 'acorn', postava: 'bramble',
  // riadky Answer Board vo filme: odpovede sú skryté sivými pásmi, poradie obrázkov nie je poradie v sade
  board: ['scarf', 'feather', 'acorn', 'boot', 'pear'],
};
const NAZOV = ['The Pumpkin Fair', 'Mix-Up'];
const INFO = `Ages ${FAKTY.vek}, ${FAKTY.hracov} players`;
const CENA = `${FAKTY.cena} € at arling.sk/shop`;
// štítok na rúčke: neutrálna otázka (v príbehu zmizol vozík aj s tekvicou, tento vozík nesie sadu)
const STITOK = ['Where is', 'Big Marigold?'];

const HAK = hak({ drz: 1.3, odchod: 0.6 }); // hák do 1,9 s
// Priblíženie názvu na snímke 0 (engine/hak.js, PRIBLIZENIE = 1,035; engine ho neexportuje). Záver sa
// k nemu pomaly priblíži, aby posledná snímka bola snímkou 0 (test.mjs porovná obe snímky).
const PRIBLIZENIE_HAKU = 1.035;

// --- časová os (sekundy) ---
const T = {
  // hák: vozík so sadou stojí, štítok sa hojdá; štítok zmizne spolu s textom, potom vozík odíde doprava
  stitokPrecOd: 1.12, stitokPrecDo: 1.36, vozPrecOd: 1.32, vozPrecDo: 1.95,
  // jarmok: Juniper príde zľava, Olive vyskočí, bublina s otáznikom
  aOd: 1.85, junDo: 2.4, oliOd: 2.15, oliDo: 2.6, bublinaOd: 2.7, aPrecOd: 4.1, aPrecDo: 4.5,
  // sedem hier: karty dopadnú, potom sa spoja článkami reťaze
  bOd: 4.45, bKrok: 0.19, bLet: 0.42, retazOd: 6.02, retazKrok: 0.09, bPrecOd: 6.8, bPrecDo: 7.2,
  // obrázkový kód: karta 1 sa zväčší, dlaždice, kľúč, tri písmená OWL
  cOd: 6.95, cRastDo: 7.5, dlazdiceOd: 7.45, dlazdiceKrok: 0.15, klucOd: 7.95, klucKrok: 0.07,
  // prvé písmeno hneď po kľúči (kľúč je hotový v 8,35 s), titulok s OWL až keď OWL stojí v okienkach
  pismena: [8.75, 9.45, 10.15], letTrv: 0.45, owl: 10.65, cPrecOd: 12.4, cPrecDo: 12.75,
  // Answer Board a karta, ktorá sa otvorí
  eOd: 12.8, eRastDo: 13.2, riadokOd: 13.5, riadokDo: 13.95, kartaOd: 13.9, kartaDopad: 14.3, rozlozOd: 14.45, rozlozDo: 14.95,
  ePrecOd: 14.95, ePrecDo: 15.3,
  // odznak a certifikát
  fOd: 15.35, odznakDo: 15.75, certOd: 15.7, certDo: 16.1, stuhaOd: 16.25, fPrecOd: 17.45, fPrecDo: 17.82,
  // záver (rovnaké zloženie ako hák)
  vozOd: 17.85, vozDo: 18.6, stitokOd: 18.6, nazov: 18.15, veta: 18.55, info: 18.8, cena: 19.15, lesk: 19.75,
  // názov sa po vynorení pomaly priblíži na mierku snímky 0 (slučka bez skoku)
  nazovBlizsieOd: 19.0,
};

// Titulky na plátne: nadväzujú bez medzier, čas čítania aspoň slová / 3 + 0,5 s (test.mjs).
const TITULKY = [
  { od: 1.9, do: 4.45, text: 'The prize pumpkin has gone missing.' },
  { od: 4.45, do: 7.05, text: 'Seven fair games in a chain.' },
  // výsledok OWL až po dopade posledného písmena (T.owl), nie skôr
  { od: 7.05, do: 10.65, text: 'Warm up with Olive’s picture code.' },
  { od: 10.65, do: 12.7, text: 'The word is OWL.' },
  { od: 12.7, do: 15.3, text: 'Every answer opens the next card.' },
  { od: 15.3, do: 17.85, text: 'Fair Helper badges and certificates, too.' },
];

// Prekmit pohybu najviac 3 % (skill arling-film, bod 6): outBack so s = 0,8 prekmitne o 2,3 %.
const PREKMIT = 0.8;

// Kyvadlá a slučky: periódy delia dĺžku filmu, takže posledná snímka nadväzuje na prvú.
const kyv = (t, amp, perioda, faza = 0) => amp * Math.sin((2 * Math.PI * t) / perioda + faza);

let L = null;
let OBR = {}; // načítané SVG obrázky

(function over() {
  const kluc = Object.fromEntries(FAKTY.kluc);
  if (FAKTY.cvikObrazky.map((o) => kluc[o]).join('') !== FAKTY.cvik) throw new Error('Pumpkin film: cvičné slovo nesedí s kľúčom');
  if (!FAKTY.board.includes(FAKTY.otvorena)) throw new Error('Pumpkin film: Answer Board bez otvorenej karty');
})();

function obrazok(x, meno, dx, dy, dw, dh) {
  const o = OBR[meno];
  if (o) x.drawImage(o, dx, dy, dw, dh);
}

/** Šírka textu daným písmom. */
function sirka(text, vaha, px, rodina) {
  const m = platno(4, 4).getContext('2d');
  m.font = pismo(vaha, px, rodina);
  return m.measureText(text).width;
}
/** Najväčšie písmo do px, pri ktorom sa text zmestí do w, nie menšie ako min (rozloženie ráta s min). */
function pismoDo(text, vaha, px, w, min, rodina) {
  const s = sirka(text, vaha, px, rodina);
  return Math.max(min, s > w ? (px * w) / s : px);
}

// ---------- rozloženie ----------

function rozlozenie(W, H) {
  const F = format(W, H), Z = zona(W, H), s = Math.min(W, H);
  // mp: najmenšie písmo s rezervou 5 % (sprite sa kreslí do celých pixelov a skladá o chlp menší,
  // karty s textom sa zjavujú z mierky 0,96)
  const R = { F, Z, s, W, H, stred: F.stlpec, mp: minPismo(W, H) * 1.05 };
  // šnúra lampiónov hore (len výzdoba, text začína pod ňou)
  R.lamp = { y0: H * 0.012, prehyb: s * 0.03, vys: s * 0.055 };
  R.lamp.dole = R.lamp.y0 + R.lamp.prehyb + R.lamp.vys * 1.15;
  R.hore = Math.max(Z.y0, R.lamp.dole + s * 0.015);
  if (F.stlpec) {
    R.capPx = s * (F.druh === 'vysoky' ? 0.05 : 0.046);
    R.cap = { x: Z.x0, y: R.hore, w: Z.w };
    const ay = R.cap.y + R.capPx * 1.3 * 2 + s * 0.03;
    R.A = { x: Z.x0, y: ay, w: Z.w, h: Z.y1 - ay };
  } else {
    const colX = W * 0.6;
    R.capPx = s * 0.05;
    R.cap = { x: colX, y: Z.y0 + Z.h * 0.32, w: Z.x1 - colX };
    R.A = { x: Z.x0, y: R.hore, w: colX - Z.x0 - W * 0.03, h: Z.y1 - R.hore };
  }
  R.vysoka = R.A.h > R.A.w * 1.15; // plocha na výšku: veci pod sebou, inak vedľa seba
  return R;
}

// ---------- sprity ----------

/** Karta papiera s tieňom (kresli dostane ctx s počiatkom v rohu karty). */
function karta(dpr, w, h, kresli, { farba = FARBY.papier, r = 0.03 } = {}) {
  const c = sprite(dpr, w, h, (x) => {
    zaoblene(x, 0, 0, w, h, Math.min(w, h) * r);
    x.fillStyle = farba; x.fill();
    x.save(); x.clip();
    kresli(x);
    x.restore();
    zaoblene(x, 0.5, 0.5, w - 1, h - 1, Math.min(w, h) * r);
    x.strokeStyle = 'rgba(60,40,20,0.22)'; x.lineWidth = 1.2; x.stroke();
  });
  const b = Math.max(w, h) * 0.08;
  const tien = sprite(dpr, w + 2 * b, h + 2 * b, (x) => {
    x.shadowColor = 'rgba(70,45,20,0.6)'; x.shadowBlur = b * 0.5 * dpr; x.shadowOffsetX = 0; x.shadowOffsetY = 0;
    zaoblene(x, b, b, w, h, Math.min(w, h) * r);
    x.fillStyle = 'rgba(70,45,20,0.4)'; x.fill();
  });
  return { c: c.c, w, h, tien: tien.c, b };
}

/** Karta v polohe (stred cx, cy), otočená o rot stupňov, mierka k, výška nad stolom v (0 leží). */
function kresliKartu(x, k, cx, cy, rot, mierka = 1, v = 0, alfa = 1) {
  const w = k.w * mierka, h = k.h * mierka, b = k.b * mierka;
  if (alfa <= 0) return;
  x.save();
  x.globalAlpha = alfa * (0.7 - v * 0.3);
  const off = (0.01 + v * 0.07) * w;
  x.translate(cx + off * 0.5, cy + off);
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

/** Sprite s textom, ktorý sa zjaví z mierky 0,96: nikdy nepresiahne svoju konečnú plochu a písmo
 *  neklesne pod minimum (rozloženie ráta s rezervou 5 %). */
const ZJAV = 0.96;
function kresliVyskoc(x, sp, cx, cy, p, alfa = 1) {
  if (p <= 0 || alfa <= 0) return;
  const k = lerp(ZJAV, 1, ease.outCubic(p));
  x.save();
  x.globalAlpha = alfa * obmedz(p * 1.8);
  x.drawImage(sp.c, cx - (sp.w * k) / 2, cy - (sp.h * k) / 2, sp.w * k, sp.h * k);
  x.restore();
}

/** Koleso vozíka ako v sade (kresby.mjs, koleso): tmavý obruč, svetlý stred, 6 lúčov, červený náboj. */
function koleso(dpr, r) {
  const d = r * 2.2;
  return sprite(dpr, d, d, (x) => {
    x.translate(d / 2, d / 2);
    const lw = r * 0.14;
    x.lineJoin = 'round';
    x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fillStyle = FARBY.sedaTmava; x.fill();
    x.strokeStyle = FARBY.ink; x.lineWidth = lw; x.stroke();
    x.beginPath(); x.arc(0, 0, r * 0.78, 0, Math.PI * 2); x.fillStyle = FARBY.sedaSvetla; x.fill();
    x.lineWidth = lw * 0.5; x.stroke();
    x.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; x.moveTo(0, 0); x.lineTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78); }
    x.lineWidth = lw * 0.55; x.stroke();
    x.beginPath(); x.arc(0, 0, r * 0.2, 0, Math.PI * 2); x.fillStyle = FARBY.cervena; x.fill();
    x.lineWidth = lw * 0.5; x.stroke();
  });
}

// ---------- vrstvy ----------

function stavVrstiev(W, H, dpr, env) {
  const R = rozlozenie(W, H);
  const Wd = Math.round(W * dpr), Hd = Math.round(H * dpr);

  // pozadie: teplý papier, jemný kopec trávy dole, šnúra lampiónov hore (raz)
  const poz = platno(Wd, Hd), px = poz.getContext('2d');
  const pap = papier(Math.max(2, Math.round(Wd / 2)), Math.max(2, Math.round(Hd / 2)), { farba: '#f7eedb', semienko: 5 });
  px.drawImage(pap, 0, 0, Wd, Hd);
  px.scale(dpr, dpr);
  const g = px.createLinearGradient(0, H * 0.35, 0, H);
  g.addColorStop(0, 'rgba(236,200,106,0)'); g.addColorStop(1, 'rgba(226,186,120,0.28)');
  px.fillStyle = g; px.fillRect(0, 0, W, H);
  const kopec = H - R.s * 0.075;
  px.beginPath();
  px.moveTo(0, H); px.lineTo(0, kopec);
  px.quadraticCurveTo(W * 0.3, kopec - R.s * 0.035, W * 0.55, kopec - R.s * 0.006);
  px.quadraticCurveTo(W * 0.8, kopec + R.s * 0.02, W, kopec - R.s * 0.02);
  px.lineTo(W, H); px.closePath();
  px.fillStyle = 'rgba(210,225,188,0.75)'; px.fill();
  // šnúra: parabola cez celú šírku
  const Lp = R.lamp;
  const snura = (xx) => Lp.y0 + Lp.prehyb * (1 - Math.pow((xx - W / 2) / (W * 0.52), 2));
  px.beginPath();
  for (let xx = -10; xx <= W + 10; xx += 12) { const yy = snura(xx); if (xx === -10) px.moveTo(xx, yy); else px.lineTo(xx, yy); }
  px.strokeStyle = FARBY.linka; px.lineWidth = Math.max(1.2, R.s * 0.0028); px.stroke();
  const vg = px.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.4, W / 2, H * 0.45, Math.max(W, H) * 0.8);
  vg.addColorStop(0, 'rgba(90,60,30,0)'); vg.addColorStop(1, 'rgba(90,60,30,0.14)');
  px.fillStyle = vg; px.fillRect(0, 0, W, H);

  L = { W, H, dpr, R, poz };
  // lampióny: sprity troch farieb, polohy na šnúre
  const lw = Lp.vys * (12 / 18);
  const lampSp = ['lampionA', 'lampionB', 'lampionC'].map((m) => sprite(dpr, lw, Lp.vys, (x) => obrazok(x, m, 0, 0, lw, Lp.vys)));
  const n = Math.max(5, Math.round(W / (R.s * 0.15)));
  L.lampiony = Array.from({ length: n }, (_, i) => { const xx = (W * (i + 0.5)) / n; return { x: xx, y: snura(xx), sp: lampSp[i % 3], faza: i * 0.9 }; });
  // lístie (padá celý film, za obsahom)
  L.listy = [FARBY.tekvica, FARBY.cervena, FARBY.slama].map((f) => stavList(dpr, R.s * 0.03, f));

  L.texty = stavTexty(W, H, dpr, R);
  L.voz = stavVoz(dpr, L.texty.plocha, R);
  stavJarmok(dpr, R);
  stavKarty(dpr, R);
  stavKod(dpr, R);
  stavBoard(dpr, R);
  stavOdznak(dpr, R);
  L.zrna = zrno(3, Math.round(160 * dpr), 1, 11).map((z) => ({ z }));
}

/** List (jesenný) ako sprite: dve krivky a žilka. */
function stavList(dpr, d, farba) {
  return sprite(dpr, d, d * 0.62, (x) => {
    const w = d, h = d * 0.62;
    x.beginPath();
    x.moveTo(w * 0.02, h / 2);
    x.quadraticCurveTo(w * 0.45, -h * 0.25, w * 0.98, h / 2);
    x.quadraticCurveTo(w * 0.45, h * 1.25, w * 0.02, h / 2);
    x.closePath();
    x.fillStyle = farba; x.fill();
    x.strokeStyle = 'rgba(27,26,23,0.55)'; x.lineWidth = Math.max(0.8, d * 0.04); x.stroke();
    x.beginPath(); x.moveTo(w * 0.1, h / 2); x.lineTo(w * 0.85, h / 2); x.stroke();
  });
}

/** Hák a záver: názov (2 riadky, pätkové písmo ako nadpisy sady), veta, vek a hráči, štítok s cenou. */
function stavTexty(W, H, dpr, R) {
  const { Z, s, F, mp } = R;
  const zar = R.stred ? 'center' : 'left';
  const colX = R.stred ? Z.x0 : R.cap.x, colW = R.stred ? Z.w : R.cap.w;
  const maxPx = F.druh === 'vysoky' ? s * 0.11 : F.druh === 'portret' ? s * 0.088 : F.druh === 'stvorec' ? s * 0.075 : s * 0.085;
  let velN = maxPx;
  // rezerva 6 %: priblíženie háku a presah písmen (v 9:16 názov najviac 0,74 šírky)
  for (const r of NAZOV) velN = Math.min(velN, pismoDo(r, 600, maxPx, colW * 0.94, 1, SERIF));
  const lhN = velN * 1.06;
  const nazovH = lhN * NAZOV.length + velN * 0.14;
  const kresliNazov = (farby) => (x) => {
    x.font = pismo(600, velN, SERIF); x.textBaseline = 'top'; x.textAlign = zar;
    const ax = zar === 'center' ? colW / 2 : 0;
    NAZOV.forEach((r, i) => {
      if (farby) { x.fillStyle = farby[i]; x.fillText(r, ax, i * lhN); return; }
      x.fillStyle = 'rgba(140,90,40,0.16)'; x.fillText(r, ax, i * lhN + velN * 0.04);
      x.fillStyle = i === 0 ? FARBY.ink : FARBY.akcent; x.fillText(r, ax, i * lhN);
    });
  };
  const nazov = sprite(dpr, colW, nazovH, kresliNazov(null));
  const lesk = sprite(dpr, colW, nazovH, kresliNazov(['rgba(255,236,190,0.9)', 'rgba(255,226,170,0.95)']));
  lesk.c.bezKontroly = true; // odlesk je ten istý text ako názov (test ho nepočíta dvakrát)
  nazov.svetly = lesk.c;
  nazov.textW = Math.max(...NAZOV.map((r) => sirka(r, 600, velN, SERIF)));
  // mierka názvu na snímke 0 aj s tvrdým limitom háku pre 9:16 (engine/hak.js kresliNazov)
  let priblizenie0 = PRIBLIZENIE_HAKU;
  if (H / W >= 1.6 && nazov.textW * priblizenie0 > W * MAX_NAZOV_916) priblizenie0 = (W * MAX_NAZOV_916) / nazov.textW;
  const vetaPx = F.druh === 'stvorec' || F.druh === 'portret'
    ? pismoDo(FAKTY.podnazov, 600, s * 0.042, colW, mp) // 1:1 a 4:5: veta na jeden riadok (miesto pre vozík)
    : s * (R.stred ? 0.046 : 0.04);
  const veta = spriteRiadku(dpr, FAKTY.podnazov, vetaPx, colW, { vaha: 600, farba: FARBY.ink, zarovnanie: zar, maxRiadkov: 2 });
  const info = spriteRiadku(dpr, INFO, Math.max(mp, s * 0.038), colW, { vaha: 600, farba: FARBY.ink2, zarovnanie: zar, maxRiadkov: 1 });
  // štítok s cenou: tvar pilulky, ale je to len nápis s odkazom na stránku sady (nie „buy now“)
  let velC = Math.max(mp, s * (R.stred ? 0.042 : 0.036));
  velC = Math.max(mp, Math.min(velC, zmestPismo(CENA, 700, velC, colW * 0.9 - velC * 2.2)));
  const cw = sirka(CENA, 700, velC) + velC * 2.2, ch = velC * 2.2;
  const cena = sprite(dpr, cw + 8, ch + 8, (x) => {
    x.translate(4, 4);
    zaoblene(x, 0, 0, cw, ch, ch / 2);
    const gg = x.createLinearGradient(0, 0, 0, ch);
    gg.addColorStop(0, '#cf6a2e'); gg.addColorStop(1, '#a8451a');
    x.fillStyle = gg; x.fill();
    x.strokeStyle = 'rgba(120,45,15,0.55)'; x.lineWidth = 1.5; x.stroke();
    x.font = pismo(700, velC); x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillStyle = '#fff8ec';
    x.fillText(CENA, cw / 2, ch / 2 + velC * 0.04);
  });

  const g1 = s * 0.024, g2 = s * 0.02, g3 = s * 0.012, g4 = s * 0.022;
  const poz = {};
  let plocha;
  if (R.stred) {
    const pevne = nazovH + g1 + g2 + veta.h + g3 + info.h + g4 + cena.h;
    // 1:1 a 4:5: štítok s cenou aspoň 10 % nad spodnou hranou (9:16 má spodok zóny na 80 %)
    const spodok = F.druh === 'vysoky' ? Z.y1 : Math.min(Z.y1, H * 0.9);
    // rezerva nad názvom: priblíženie háku (1,035) ho zväčšuje od stredu aj nahor
    const hore = R.hore + nazovH * 0.025;
    let y = hore;
    poz.nazov = y; y += nazovH + g1;
    const hA = spodok - hore - pevne;
    plocha = { x: Z.x0, y, w: Z.w, h: hA };
    y += hA + g2;
    poz.veta = y; y += veta.h + g3;
    poz.info = y; y += info.h + g4;
    poz.cena = y;
  } else {
    const blok = nazovH + g1 * 1.4 + veta.h + g3 * 1.5 + info.h + g4 * 1.4 + cena.h;
    let y = Z.y0 + (Z.h - blok) / 2;
    poz.nazov = y; y += nazovH + g1 * 1.4;
    poz.veta = y; y += veta.h + g3 * 1.5;
    poz.info = y; y += info.h + g4 * 1.4;
    poz.cena = y;
    plocha = R.A;
  }
  const cx = R.stred ? (W - cena.w) / 2 : colX;
  const titulky = TITULKY.map((tt) => ({ ...tt, sp: spriteRiadku(dpr, tt.text, R.capPx, R.cap.w, { vaha: 600, farba: FARBY.ink, zarovnanie: zar, maxRiadkov: 2 }) }));
  return { nazov, priblizenie0, veta, info, cena, poz, colX, plocha, titulky, btn: { x: cx + 4, y: poz.cena + 4, w: cw, h: ch } };
}

// Náklad vozíka v jednotkách kresby vozíka (100 x 58, korba x 4 až 68, horná hrana korby y 20,8):
// vejár troch prehnutých kariet okolo osi v korbe (spodky kariet sú skryté za korbou, vidno len pásy
// s obrázkom, ako keď rodič drží kôpku) a pred nimi karta 1 so spodkom v korbe.
const NAKLAD = {
  os: [36, 34], d: 34, uhly: [-36, 0, 36], pasW: 32,
  nota: { cx: 36, cy: 17, w: 42, rot: -3 },
  hore: 14, // koľko jednotiek nad hornou hranou kresby vozíka (y 0) náklad siaha
};

/** Červený vozík (kresba zo sady) s kusom sady v korbe, otáčajúce sa kolesá, štítok na rúčke. */
function stavVoz(dpr, P, R) {
  const { s, mp } = R;
  const tpx = Math.max(mp, s * (R.F.druh === 'vysoky' ? 0.042 : 0.037));
  const pad = tpx * 0.55, dierka = tpx * 0.62, lh = tpx * 1.22;
  const Tw = Math.max(sirka(STITOK[0], 600, tpx), sirka(STITOK[1], 700, tpx)) + pad * 2;
  const Th = dierka + lh * 2 + pad * 0.9;
  const rez = tpx * 0.42;
  const stitok = sprite(dpr, Tw + 8, Th + 8, (x) => {
    x.translate(4, 4);
    x.beginPath();
    x.moveTo(rez, 0); x.lineTo(Tw - rez, 0); x.lineTo(Tw, rez); x.lineTo(Tw, Th); x.lineTo(0, Th); x.lineTo(0, rez); x.closePath();
    x.fillStyle = FARBY.krem; x.fill();
    x.strokeStyle = FARBY.ink; x.lineWidth = Math.max(1.5, tpx * 0.05); x.lineJoin = 'round'; x.stroke();
    x.beginPath(); x.arc(Tw / 2, dierka * 0.5, tpx * 0.2, 0, Math.PI * 2); x.strokeStyle = FARBY.akcent; x.lineWidth = tpx * 0.07; x.stroke();
    x.beginPath(); x.arc(Tw / 2, dierka * 0.5, tpx * 0.1, 0, Math.PI * 2); x.fillStyle = '#e9dcc0'; x.fill();
    x.textAlign = 'center'; x.textBaseline = 'top';
    x.font = pismo(600, tpx); x.fillStyle = FARBY.ink; x.fillText(STITOK[0], Tw / 2, dierka);
    x.font = pismo(700, tpx); x.fillStyle = FARBY.akcent; x.fillText(STITOK[1], Tw / 2, dierka + lh);
  });
  stitok.w0 = Tw; stitok.h0 = Th;

  // mierka u (jednotka kresby vozíka 100 x 58): skupina = vozík + náklad nad korbou + štítok pod rúčkou
  const HORE = NAKLAD.hore, SNURA = 6, RUCKA = [91, 10.2];
  const Pw = P.w * 0.94, Ph = P.h * 0.94;
  const uW = Math.min((Pw - Tw / 2) / RUCKA[0], Pw / 100);
  const uH1 = Ph / (58 + HORE), uH2 = (Ph - Th) / (HORE + RUCKA[1] + SNURA);
  const uH = uH1 * 58 >= uH1 * (RUCKA[1] + SNURA) + Th ? uH1 : uH2;
  const u = Math.max(1, Math.min(uW, uH, (P.w * 0.86) / 100));
  const vl = Math.min(0, RUCKA[0] * u - Tw / 2), vp = Math.max(100 * u, RUCKA[0] * u + Tw / 2);
  const vh = -HORE * u, vd = Math.max(58 * u, (RUCKA[1] + SNURA) * u + Th);
  const x0 = P.x + (P.w - (vp - vl)) / 2 - vl, y0 = P.y + (P.h - (vd - vh)) / 2 - vh;
  const telo = sprite(dpr, 100 * u, 58 * u, (x) => obrazok(x, 'vozik', 0, 0, 100 * u, 58 * u));
  const rK = 10.88 * u;
  // náklad: karta 1 (tá istá ako v scéne siedmich hier) a tri prehnuté karty, bez textu
  const N = NAKLAD, pw = N.pasW * u, ph = pw / 1.42, nw = N.nota.w * u, nh = nw / 1.42;
  const naklad = {
    pasy: FAKTY.naklad.map((id, i) => {
      const a = (N.uhly[i] * Math.PI) / 180;
      return { k: kartaPas(dpr, id, pw, ph), x: (N.os[0] + N.d * Math.sin(a)) * u, y: (N.os[1] - N.d * Math.cos(a)) * u, rot: N.uhly[i] };
    }),
    nota: { k: kartaNota(dpr, nw, nh), x: N.nota.cx * u, y: N.nota.cy * u, rot: N.nota.rot },
  };
  return {
    u, x0, y0, telo, stitok, koleso: koleso(dpr, rK), rK, naklad,
    kolesa: [[16.8 * u, 43.8 * u], [55.2 * u, 43.8 * u]],
    rucka: [RUCKA[0] * u, RUCKA[1] * u], snura: SNURA * u,
    stred: [x0 + 50 * u, y0 + 20 * u],
  };
}

/** Jarmok: Farmer Juniper, Olive the Owl, stopy kolies, bublina s otáznikom, dve malé tekvice. */
function stavJarmok(dpr, R) {
  const A = R.A;
  const cs = R.vysoka ? Math.min(A.w * 0.44, A.h * 0.32) : Math.min(A.w * 0.34, A.h * 0.46);
  const gy = A.y + A.h * (R.vysoka ? 0.66 : R.stred ? 0.6 : 0.64);
  const jun = sprite(dpr, cs, cs, (x) => obrazok(x, 'juniper', 0, 0, cs, cs));
  const oli = sprite(dpr, cs * 0.92, cs * 0.92, (x) => obrazok(x, 'olive', 0, 0, cs * 0.92, cs * 0.92));
  const tA = sprite(dpr, cs * 0.34, cs * 0.34 * 0.9, (x) => obrazok(x, 'tekvicaA', 0, 0, cs * 0.34, cs * 0.34 * 0.9));
  const tB = sprite(dpr, cs * 0.26, cs * 0.26 * 0.9, (x) => obrazok(x, 'tekvicaB', 0, 0, cs * 0.26, cs * 0.26 * 0.9));
  const br = cs * 0.14, bpx = Math.max(R.mp, br * 1.25);
  const bublina = sprite(dpr, br * 2.9, br * 2.9, (x) => {
    const c = br * 1.3;
    x.fillStyle = '#fffdf8'; x.strokeStyle = FARBY.ink; x.lineWidth = Math.max(1.5, br * 0.07);
    x.beginPath(); x.arc(c, c, br, 0, Math.PI * 2); x.fill(); x.stroke();
    x.beginPath(); x.arc(c - br * 0.85, c + br * 1.05, br * 0.2, 0, Math.PI * 2); x.fill(); x.stroke();
    x.beginPath(); x.arc(c - br * 1.15, c + br * 1.4, br * 0.11, 0, Math.PI * 2); x.fill(); x.stroke();
    x.font = pismo(700, bpx); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = FARBY.akcent;
    x.fillText('?', c, c + bpx * 0.04);
  });
  const jx = A.x + A.w * 0.27, ox = A.x + A.w * 0.76;
  L.jarmok = {
    cs, gy, jun, oli, tA, tB, bublina, br,
    jx, ox, bx: jx + cs * 0.3, by: gy - cs * 1.02,
    stopy: { x0: A.x + A.w * 0.4, x1: R.W + R.s * 0.05, y: gy + cs * 0.015, d: cs * 0.09 },
    tAx: A.x + A.w * 0.5, tBx: A.x + A.w * 0.57,
  };
}

/** Sedem hier: karta 1 (Olive's coded note, leží na stole) a 6 prehnutých kariet s obrázkom na páse. */
function stavKarty(dpr, R) {
  const A = R.A;
  // na výšku 2 stĺpce (väčšie karty), inak 3; poradie hadovito: reťaz ide doprava, dole, doľava, dole
  const dva = R.vysoka;
  const cw = dva ? Math.min(A.w / 2.45, (A.h / 4.9) * 1.42) : Math.min(A.w / 3.5, (A.h / 3.7) * 1.42);
  const ch = cw / 1.42, gx = cw * 0.22, gy = ch * 0.3;
  const cx = A.x + A.w / 2, cy = A.y + A.h / 2;
  const riadky = dva ? [[0, 1], [3, 2], [4, 5], [6]] : [[0, 1, 2], [5, 4, 3], [6]];
  const pol = [];
  riadky.forEach((r, ri) => r.forEach((k, j) => {
    const n = r.length;
    pol[k] = { x: cx + (j - (n - 1) / 2) * (cw + gx), y: cy + (ri - (riadky.length - 1) / 2) * (ch + gy) };
  }));
  const sp = FAKTY.karty.map((id) => (id === 'nota' ? kartaNota(dpr, cw, ch) : kartaPas(dpr, id, cw, ch)));
  L.karty = { cw, ch, pol, sp, rot: [-3, 2, -1.5, 2.5, -2, 1.5, -1] };
}

/** Karta 1 zo strany 4: Olive a riadok obrázkového kódu (tu len cvičné kite, heart, cloud). */
function kartaNota(dpr, w, h) {
  return karta(dpr, w, h, (x) => {
    const p = w * 0.07;
    obrazok(x, 'olive', p * 0.6, h * 0.08, h * 0.62, h * 0.62);
    const i = (w - h * 0.62 - p * 2.2) / 3.3;
    FAKTY.cvikObrazky.forEach((o, j) => {
      const ix = h * 0.62 + p * 1.2 + j * i * 1.1, iy = h * 0.2;
      zaoblene(x, ix, iy, i, i, i * 0.14); x.fillStyle = '#fff'; x.fill(); x.strokeStyle = FARBY.linka; x.lineWidth = 1; x.stroke();
      obrazok(x, o, ix + i * 0.1, iy + i * 0.1, i * 0.8, i * 0.8);
      x.setLineDash([i * 0.1, i * 0.07]);
      zaoblene(x, ix + i * 0.15, iy + i * 1.15, i * 0.7, i * 0.55, i * 0.08); x.stroke();
      x.setLineDash([]);
    });
    x.fillStyle = FARBY.sede;
    [0.78, 0.86].forEach((f, j) => { zaoblene(x, p, h * f, (w - 2 * p) * (j ? 0.6 : 0.9), h * 0.045, h * 0.02); x.fill(); });
  }, { farba: FARBY.soft });
}

/** Prehnutá karta: pás s obrázkom navrchu, čiarkovaná línia prehnutia, prázdny rub, spinka. */
function kartaPas(dpr, id, w, h) {
  const pas = h * 0.42;
  return karta(dpr, w, h, (x) => {
    x.fillStyle = '#fffaf1'; x.fillRect(0, 0, w, pas);
    const i = pas * 0.78;
    obrazok(x, id, (w - i) / 2, (pas - i) / 2, i, i);
    x.strokeStyle = FARBY.akcent; x.lineWidth = Math.max(1, h * 0.012); x.setLineDash([h * 0.04, h * 0.03]);
    x.beginPath(); x.moveTo(0, pas); x.lineTo(w, pas); x.stroke(); x.setLineDash([]);
    x.fillStyle = 'rgba(239,226,204,0.55)'; x.fillRect(0, pas, w, h - pas);
    // spinka na okraji
    x.strokeStyle = FARBY.sedaTmava; x.lineWidth = Math.max(1.2, h * 0.018); x.lineCap = 'round';
    const sx = w * 0.84, sy = pas + h * 0.02;
    x.beginPath(); x.moveTo(sx, sy + h * 0.16); x.lineTo(sx, sy - h * 0.02); x.arc(sx + h * 0.035, sy - h * 0.02, h * 0.035, Math.PI, 0); x.lineTo(sx + h * 0.07, sy + h * 0.12); x.stroke();
  });
}

/** Obrázkový kód: tri dlaždice (kite, heart, cloud), prázdne okienka, kľúč so 6 dvojicami, Olive. */
function stavKod(dpr, R) {
  const A = R.A, mp = R.mp;
  const pad = Math.min(A.w, A.h) * 0.05;
  const vn = { x: A.x + pad, y: A.y + pad, w: A.w - 2 * pad, h: A.h - 2 * pad };
  const vert = A.h > A.w * 1.0;
  let TA, KA, OA = null;
  if (vert) {
    TA = { x: vn.x, y: vn.y, w: vn.w, h: vn.h * 0.37 };
    KA = { x: vn.x, y: vn.y + vn.h * 0.41, w: vn.w, h: vn.h * 0.33 };
    OA = { x: vn.x, y: vn.y + vn.h * 0.76, w: vn.w, h: vn.h * 0.24 };
  } else {
    TA = { x: vn.x, y: vn.y, w: vn.w * 0.58, h: vn.h };
    KA = { x: vn.x + vn.w * 0.63, y: vn.y, w: vn.w * 0.37, h: vn.h };
  }
  // dlaždice a okienka
  const tw = Math.min(TA.w / 3.3, TA.h / 1.82), tg = tw * 0.15;
  const bw = tw * 0.66, bgap = tw * 0.14;
  const blokH = tw + bgap + bw;
  const ty = TA.y + (TA.h - blokH) / 2;
  const dlazdice = FAKTY.cvikObrazky.map((o, i) => {
    const x = TA.x + TA.w / 2 + (i - 1) * (tw + tg) - tw / 2;
    return { o, x, y: ty, box: { x: x + (tw - bw) / 2, y: ty + tw + bgap, w: bw } };
  });
  const tileSp = FAKTY.cvikObrazky.map((o) => sprite(dpr, tw, tw, (x) => {
    zaoblene(x, 1, 1, tw - 2, tw - 2, tw * 0.12); x.fillStyle = '#fffdf8'; x.fill();
    x.strokeStyle = FARBY.ink; x.lineWidth = Math.max(1.5, tw * 0.018); x.stroke();
    obrazok(x, o, tw * 0.12, tw * 0.12, tw * 0.76, tw * 0.76);
  }));
  const bpx = Math.max(mp, bw * 0.62);
  const pismena = {};
  for (const ch of FAKTY.cvik) {
    pismena[ch] = sprite(dpr, bw, bw, (x) => {
      x.font = pismo(700, bpx); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = FARBY.akcent;
      x.fillText(ch, bw / 2, bw / 2 + bpx * 0.05);
    });
  }
  // kľúč: nadpis a 6 dvojíc (obrázok + písmeno)
  const hpx = Math.max(mp, Math.min(R.s * 0.04, KA.w * 0.1));
  const stlp = vert ? 3 : 2, rad = Math.ceil(FAKTY.kluc.length / stlp);
  const hh = hpx * 1.7;
  const ew = KA.w / stlp, eh = Math.min((KA.h - hh) / rad, ew * 0.62);
  const ki = Math.min(eh * 0.8, ew * 0.46);
  const kpx = Math.max(mp, ki * 0.62);
  const klucH = hh + eh * rad;
  const ky = KA.y + (KA.h - klucH) / 2;
  const polozky = FAKTY.kluc.map(([o, p], i) => {
    const c = i % stlp, r = Math.floor(i / stlp);
    const ex = KA.x + c * ew, ey = ky + hh + r * eh;
    const ix = ex + (ew - (ki + ki * 0.25 + kpx * 0.8)) / 2;
    return { o, p, ix, iy: ey + (eh - ki) / 2, ki, px: ix + ki * 1.25 + kpx * 0.4, py: ey + eh / 2 };
  });
  const klucSp = sprite(dpr, KA.w, klucH, (x) => {
    x.font = pismo(700, hpx); x.textAlign = 'center'; x.textBaseline = 'top'; x.fillStyle = FARBY.akcent;
    x.fillText('CODE KEY', KA.w / 2, 0);
    x.strokeStyle = 'rgba(143,135,122,0.45)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(KA.w * 0.1, hh - hpx * 0.3); x.lineTo(KA.w * 0.9, hh - hpx * 0.3); x.stroke();
    for (const e of polozky) {
      obrazok(x, e.o, e.ix - KA.x, e.iy - ky, e.ki, e.ki);
      x.font = pismo(700, kpx); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = FARBY.ink;
      x.fillText(e.p, e.px - KA.x, e.py - ky + kpx * 0.04);
    }
  });
  // podklad: papier karty 1 (zväčší sa z karty 1 v mriežke)
  const podklad = karta(dpr, A.w, A.h, () => {}, { farba: FARBY.soft, r: 0.025 });
  const os = OA ? Math.min(OA.h, OA.w * 0.4) : 0;
  const olive = OA ? sprite(dpr, os, os, (x) => obrazok(x, 'olive', 0, 0, os, os)) : null;
  L.kod = {
    podklad, dlazdice, tileSp, tw, bw, bpx, pismena, polozky, klucSp, KA: { x: KA.x, y: ky, w: KA.w, h: klucH }, kpx,
    olive, oPos: OA ? { x: OA.x + OA.w / 2, y: OA.y + OA.h / 2 } : null,
  };
}

/** Answer Board (odpovede skryté sivými pásmi) a prehnutá karta Acorn, ktorá sa otvorí. */
function stavBoard(dpr, R) {
  const A = R.A, mp = R.mp;
  let BA, CA;
  if (R.vysoka) {
    BA = { x: A.x, y: A.y, w: A.w, h: A.h * 0.5 };
    CA = { x: A.x, y: A.y + A.h * 0.53, w: A.w, h: A.h * 0.47 };
  } else {
    BA = { x: A.x, y: A.y, w: A.w * 0.52, h: A.h };
    CA = { x: A.x + A.w * 0.55, y: A.y, w: A.w * 0.45, h: A.h };
  }
  // tabuľa
  const bw = Math.min(BA.w, BA.h * 1.25) * 0.96;
  const hpx = pismoDo('Olive’s Answer Board', 600, R.s * 0.046, bw * 0.84, mp, SERIF);
  const pad = bw * 0.07, hh = hpx * 1.8;
  const n = FAKTY.board.length;
  const rh = Math.min(bw * 0.15, (BA.h * 0.96 - pad * 2 - hh) / n);
  const bh = pad * 2 + hh + rh * n;
  const ic = rh * 0.74;
  const riadky = FAKTY.board.map((o, i) => ({ o, y: pad + hh + i * rh, f: [0.5, 0.38, 0.44, 0.56, 0.34][i] }));
  const tabula = karta(dpr, bw, bh, (x) => {
    x.font = pismo(600, hpx, SERIF); x.textAlign = 'center'; x.textBaseline = 'top'; x.fillStyle = FARBY.ink;
    x.fillText('Olive’s Answer Board', bw / 2, pad);
    for (const r of riadky) {
      const sy = r.y + rh / 2;
      x.fillStyle = FARBY.sede;
      zaoblene(x, pad, sy - rh * 0.14, (bw - pad * 2 - ic * 1.5) * r.f, rh * 0.28, rh * 0.12); x.fill();
      x.strokeStyle = 'rgba(143,135,122,0.6)'; x.lineWidth = Math.max(1, rh * 0.03); x.setLineDash([rh * 0.04, rh * 0.09]);
      x.beginPath(); x.moveTo(pad + (bw - pad * 2 - ic * 1.5) * r.f + rh * 0.2, sy); x.lineTo(bw - pad - ic * 1.25, sy); x.stroke(); x.setLineDash([]);
      if (r.o !== FAKTY.otvorena) obrazok(x, r.o, bw - pad - ic, sy - ic / 2, ic, ic);
      x.strokeStyle = 'rgba(143,135,122,0.25)'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(pad, r.y + rh); x.lineTo(bw - pad, r.y + rh); x.stroke();
    }
  }, { farba: FARBY.soft, r: 0.03 });
  const ikona = sprite(dpr, ic, ic, (x) => obrazok(x, FAKTY.otvorena, 0, 0, ic, ic));
  const bx = BA.x + (BA.w - bw) / 2, by = BA.y + (BA.h - bh) / 2;
  const zv = riadky.findIndex((r) => r.o === FAKTY.otvorena);
  // karta: prehnutá má výšku ch, otvorená ch + (ch - pas)
  const pasF = 0.36;
  const ch = Math.min(CA.h * 0.94 / (2 - pasF), (CA.w * 0.92) / 1.42), cw = ch * 1.42, pas = ch * pasF, klap = ch - pas;
  const hornaSp = karta(dpr, cw, ch, (x) => {
    x.fillStyle = '#fffaf1'; x.fillRect(0, 0, cw, pas);
    const i = pas * 0.78;
    obrazok(x, FAKTY.otvorena, (cw - i) / 2, (pas - i) / 2, i, i);
    x.strokeStyle = FARBY.akcent; x.lineWidth = Math.max(1, ch * 0.012); x.setLineDash([ch * 0.04, ch * 0.03]);
    x.beginPath(); x.moveTo(0, pas); x.lineTo(cw, pas); x.stroke(); x.setLineDash([]);
    // horná polovica karty: číslo hry a zadanie (skryté ako na náhľadoch sady)
    x.fillStyle = FARBY.akcent; x.beginPath(); x.arc(cw * 0.1, pas + klap * 0.3, klap * 0.13, 0, Math.PI * 2); x.fill();
    x.fillStyle = FARBY.sede;
    [[0.2, 0.22, 0.55], [0.2, 0.42, 0.7], [0.06, 0.66, 0.86], [0.06, 0.82, 0.6]].forEach(([fx, fy, fw]) => { zaoblene(x, cw * fx, pas + klap * fy, cw * fw, klap * 0.09, klap * 0.04); x.fill(); });
  });
  const klapPredok = sprite(dpr, cw, klap, (x) => {
    zaoblene(x, 0, 0, cw, klap, cw * 0.02); x.fillStyle = FARBY.papier; x.fill();
    obrazok(x, FAKTY.postava, cw * 0.05, klap * 0.06, klap * 0.88, klap * 0.88);
    x.fillStyle = FARBY.sede;
    [0.2, 0.38, 0.56, 0.74].forEach((fy, j) => { zaoblene(x, cw * 0.05 + klap * 0.98, klap * fy, (cw * 0.9 - klap * 0.98) * [0.95, 0.8, 0.9, 0.55][j], klap * 0.08, klap * 0.04); x.fill(); });
    x.strokeStyle = 'rgba(60,40,20,0.22)'; x.lineWidth = 1.2; zaoblene(x, 0.5, 0.5, cw - 1, klap - 1, cw * 0.02); x.stroke();
  });
  const klapRub = sprite(dpr, cw, klap, (x) => {
    zaoblene(x, 0, 0, cw, klap, cw * 0.02); x.fillStyle = '#f3e7d2'; x.fill();
    x.strokeStyle = 'rgba(60,40,20,0.22)'; x.lineWidth = 1.2; zaoblene(x, 0.5, 0.5, cw - 1, klap - 1, cw * 0.02); x.stroke();
  });
  L.board = {
    tabula, bx, by, bw, bh, riadky, rh, ic, ikona, zv, pad,
    karta: { hornaSp, klapPredok, klapRub, cw, ch, pas, klap, x: CA.x + (CA.w - cw) / 2, y: CA.y + (CA.h - (ch + klap)) / 2 },
  };
}

/** Odznak Fair Helper (ako strana 14) a certifikát Official Fair Helper (ako strana 15). */
function stavOdznak(dpr, R) {
  const A = R.A, mp = R.mp;
  let ow, cw;
  if (R.vysoka) {
    ow = Math.min(A.w * 0.8, (A.h * 0.42) * (85 / 54));
    cw = Math.min(A.w * 0.56, A.h * 0.5 * 0.74);
  } else {
    ow = Math.min(A.w * 0.52, A.h * 0.62 * (85 / 54));
    cw = Math.min(A.w * 0.38, A.h * 0.9 * 0.74);
  }
  const oh = ow * (54 / 85), chh = cw / 0.74;
  const tpx = Math.max(mp, ow * 0.1), lpx = Math.max(mp, ow * 0.058);
  const odznak = karta(dpr, ow, oh, (x) => {
    const p = ow * 0.06;
    x.strokeStyle = 'rgba(143,135,122,0.7)'; x.lineWidth = Math.max(1, ow * 0.004); x.setLineDash([ow * 0.012, ow * 0.009]);
    zaoblene(x, p * 0.4, p * 0.4, ow - p * 0.8, oh - p * 0.8, ow * 0.02); x.stroke(); x.setLineDash([]);
    obrazok(x, 'tekvicka', p, p * 0.9, tpx * 1.05, tpx * 1.05);
    x.font = pismo(600, tpx, SERIF); x.fillStyle = FARBY.ink; x.textAlign = 'left'; x.textBaseline = 'top';
    x.fillText('Fair Helper', p + tpx * 1.25, p);
    const lx = p, lw = ow * 0.6 - p;
    [['NAME', 0.44], ['COSTUME', 0.72]].forEach(([t, fy]) => {
      x.font = pismo(700, lpx); x.fillStyle = FARBY.ink2; x.fillText(t, lx, oh * fy - lpx * 1.1);
      x.strokeStyle = FARBY.linka; x.lineWidth = Math.max(1, ow * 0.004);
      x.beginPath(); x.moveTo(lx, oh * fy + lpx * 0.5); x.lineTo(lx + lw, oh * fy + lpx * 0.5); x.stroke();
    });
    const fx = ow * 0.66, fw = ow * 0.28, fy0 = oh * 0.3, fh = oh * 0.36;
    x.strokeStyle = FARBY.ink; x.lineWidth = Math.max(1.2, ow * 0.004); x.strokeRect(fx, fy0, fw, fh);
    obrazok(x, 'pecat', fx + fw * 0.12, fy0 + fh + oh * 0.02, fw * 0.76, fw * 0.76);
  });
  const cpx = Math.max(mp, cw * 0.11);
  const cert = karta(dpr, cw, chh, (x) => {
    const p = cw * 0.07;
    x.strokeStyle = FARBY.akcent; x.lineWidth = Math.max(1.2, cw * 0.008);
    zaoblene(x, p * 0.5, p * 0.5, cw - p, chh - p, cw * 0.03); x.stroke();
    const ps = cw * 0.3;
    obrazok(x, 'pecat', (cw - ps) / 2, p * 1.1, ps, ps);
    x.font = pismo(600, cpx, SERIF); x.fillStyle = FARBY.ink; x.textAlign = 'center'; x.textBaseline = 'top';
    x.fillText('Official', cw / 2, p * 1.1 + ps + cw * 0.04);
    x.fillText('Fair Helper', cw / 2, p * 1.1 + ps + cw * 0.04 + cpx * 1.18);
    x.strokeStyle = FARBY.linka; x.lineWidth = Math.max(1, cw * 0.005);
    const ly = p * 1.1 + ps + cw * 0.08 + cpx * 2.5;
    x.beginPath(); x.moveTo(cw * 0.18, ly); x.lineTo(cw * 0.82, ly); x.stroke();
  }, { farba: '#fffdf8' });
  const ss = cw * 0.3;
  const stuha = sprite(dpr, ss, ss, (x) => obrazok(x, 'stuha', 0, 0, ss, ss));
  let o, c;
  if (R.vysoka) {
    const spolu = oh + chh + A.h * 0.05;
    const y0 = A.y + (A.h - spolu) / 2;
    o = { x: A.x + A.w / 2, y: y0 + oh / 2 };
    c = { x: A.x + A.w / 2, y: y0 + oh + A.h * 0.05 + chh / 2 };
  } else {
    const g = A.w * 0.05, spolu = ow + g + cw;
    const x0 = A.x + (A.w - spolu) / 2;
    o = { x: x0 + ow / 2, y: A.y + A.h / 2 };
    c = { x: x0 + ow + g + cw / 2, y: A.y + A.h / 2 };
  }
  L.odznak = { odznak, cert, stuha, o, c, ow, oh, cw, chh, ss };
}

// ---------- kreslenie ----------

function kresliLampiony(x, t) {
  const L2 = L.lampiony;
  for (const l of L2) {
    const u = ((kyv(t, 5, 3, l.faza)) * Math.PI) / 180;
    x.save(); x.translate(l.x, l.y); x.rotate(u);
    x.drawImage(l.sp.c, -l.sp.w / 2, 0, l.sp.w, l.sp.h);
    x.restore();
  }
}

function kresliListy(x, t, env) {
  const n = env.slabe ? 5 : 10, W = L.W, H = L.H;
  for (let i = 0; i < n; i++) {
    const f = ((t / 7 + hash(i, 1)) % 1 + 1) % 1; // perióda 7 s (21 = 3 x 7)
    const y = -H * 0.06 + f * H * 1.12;
    const xx = hash(i, 2) * W + kyv(t, R_(0.04), 3.5, i * 1.7) + f * W * 0.08 - W * 0.04;
    const rot = kyv(t, 0.9, 3, i) + hash(i, 3) * 6;
    const sp = L.listy[i % 3], k = 0.7 + hash(i, 4) * 0.7;
    x.save(); x.globalAlpha = 0.8; x.translate(xx, y); x.rotate(rot);
    x.drawImage(sp.c, (-sp.w * k) / 2, (-sp.h * k) / 2, sp.w * k, sp.h * k);
    x.restore();
  }
}
const R_ = (f) => L.R.s * f;

/** Poloha vozíka: dx (posun doprava), viditeľnosť štítka, uhol štítka. */
function stavVozika(t) {
  const V = L.voz;
  const von = L.W - V.x0 + L.W * 0.12, dnu = V.x0 + 100 * V.u + L.W * 0.12;
  let dx = null, stitok = 0, uhol = kyv(t, 3, 2.1); // kyvadlo 2,1 s (21 = 10 x 2,1)
  if (t < T.vozPrecDo) {
    dx = ease.inCubic(okno(t, T.vozPrecOd, T.vozPrecDo)) * von;
    stitok = t < T.stitokPrecDo ? 1 - ease.inOutCubic(okno(t, T.stitokPrecOd, T.stitokPrecDo)) : 0;
  } else if (t >= T.vozOd) {
    dx = -(1 - ease.outCubic(okno(t, T.vozOd, T.vozDo))) * dnu;
    if (t >= T.stitokOd) {
      const tau = t - T.stitokOd, k = 6;
      stitok = obmedz(tau / 0.15);
      uhol += 55 * (1 + k * tau) * Math.exp(-k * tau); // štítok sa zavesí zľava, bez prekmitu doprava
    }
  }
  return { dx, stitok, uhol };
}

function kresliVozik(x, t) {
  const S = stavVozika(t);
  if (S.dx === null) return;
  const V = L.voz, u = V.u;
  const ox = V.x0 + S.dx, oy = V.y0;
  // jemné pohupnutie pri zastavení (záver) a pri rozbehu (hák)
  let hop = 0;
  if (t >= T.vozOd) { const q = t - T.vozDo; if (q > 0 && q < 0.5) hop = Math.sin((q / 0.5) * Math.PI) * u * 0.8 * (1 - q / 0.5); }
  // tieň
  x.save();
  x.fillStyle = 'rgba(90,60,30,0.16)';
  x.beginPath(); x.ellipse(ox + 40 * u, oy + 55.5 * u, 44 * u, 3.2 * u, 0, 0, Math.PI * 2); x.fill();
  x.restore();
  // náklad: kus sady v korbe (karty sa v jazde jemne kývu, perióda 3 s delí dĺžku filmu); spodky
  // kariet zakryje korba, ktorá sa kreslí až po nich
  const N = V.naklad, kyvK = kyv(t, 1.2, 3);
  for (const p of N.pasy) kresliKartu(x, p.k, ox + p.x, oy + p.y - hop, p.rot + kyvK, 1, 0, 1);
  kresliKartu(x, N.nota.k, ox + N.nota.x, oy + N.nota.y - hop, N.nota.rot + kyvK * 0.5, 1, 0, 1);
  x.drawImage(V.telo.c, ox, oy - hop, V.telo.w, V.telo.h);
  // kolesá sa točia podľa prejdenej dráhy
  const uhol = S.dx / V.rK;
  for (const [kx, ky] of V.kolesa) {
    x.save(); x.translate(ox + kx, oy + ky - hop); x.rotate(uhol);
    x.drawImage(V.koleso.c, -V.koleso.w / 2, -V.koleso.h / 2, V.koleso.w, V.koleso.h);
    x.restore();
  }
  // štítok na rúčke (v háku ostáva na mieste, kým zmizne; v závere sa zavesí po zastavení)
  if (S.stitok > 0) {
    const gx = V.x0 + (t < T.vozPrecDo ? 0 : S.dx) + V.rucka[0], gy = oy + V.rucka[1] - hop;
    const st = V.stitok, a = (S.uhol * Math.PI) / 180;
    x.save();
    x.globalAlpha = S.stitok;
    x.translate(gx, gy); x.rotate(a);
    x.strokeStyle = FARBY.hnedaTmava; x.lineWidth = Math.max(1.5, u * 0.35);
    x.beginPath(); x.moveTo(0, 0); x.lineTo(0, V.snura + st.h0 * 0.08); x.stroke();
    x.drawImage(st.c, -st.w / 2, V.snura - 4, st.w, st.h);
    x.restore();
  }
}

function kresliJarmok(x, t) {
  if (t < T.aOd || t > T.aPrecDo) return;
  const J = L.jarmok, cs = J.cs;
  const prec = ease.inCubic(okno(t, T.aPrecOd, T.aPrecDo));
  const alfa = 1 - prec, dy = prec * cs * 0.15;
  x.save();
  x.globalAlpha = alfa;
  // stopy kolies: čiarkované, od miesta vozíka doprava z obrazu
  const S = J.stopy, pr = ease.outCubic(okno(t, T.aOd, T.aOd + 0.6));
  x.strokeStyle = 'rgba(122,90,62,0.55)'; x.lineWidth = Math.max(2, cs * 0.018); x.lineCap = 'round';
  x.setLineDash([cs * 0.05, cs * 0.04]);
  x.lineDashOffset = -((t / DLZKA) * 21 * cs * 0.09);
  for (const k of [0, 1]) {
    x.beginPath();
    x.moveTo(S.x0, S.y + k * S.d + dy);
    x.quadraticCurveTo(lerp(S.x0, S.x1, 0.5), S.y + k * S.d - cs * 0.04 + dy, lerp(S.x0, S.x1, pr), S.y + k * S.d + cs * 0.03 + dy);
    x.stroke();
  }
  x.setLineDash([]);
  // tekvičky
  x.drawImage(J.tA.c, J.tAx - J.tA.w / 2, J.gy - J.tA.h + dy, J.tA.w, J.tA.h);
  x.drawImage(J.tB.c, J.tBx - J.tB.w / 2, J.gy - J.tB.h + dy, J.tB.w, J.tB.h);
  // Juniper príde zľava a jemne poskakuje
  const pj = ease.outCubic(okno(t, T.aOd, T.junDo));
  const hopJ = Math.abs(Math.sin(((t - T.aOd) / 0.5) * Math.PI)) * cs * 0.03 * (pj < 1 ? 1 : 0.3);
  const jx = lerp(-cs, J.jx, pj);
  x.drawImage(J.jun.c, jx - cs / 2, J.gy - cs * 0.97 - hopJ + dy, cs, cs);
  // Olive vyskočí na svojom mieste
  const po = okno(t, T.oliOd, T.oliDo);
  if (po > 0) {
    const k = lerp(0.4, 1, ease.outBack(po, PREKMIT)), os = J.oli.w;
    const hopO = Math.max(0, Math.sin(((t - T.oliDo) / 0.7) * Math.PI)) * cs * 0.025 * (t > T.oliDo ? 1 : 0);
    x.save(); x.globalAlpha = alfa * obmedz(po * 3);
    x.translate(J.ox, J.gy + dy - hopO); x.scale(k, k);
    x.drawImage(J.oli.c, -os / 2, -os * 0.97, os, os);
    x.restore();
  }
  x.restore();
  // bublina s otáznikom (text: bez presahu, zjaví sa zmenšená)
  const pb = okno(t, T.bublinaOd, T.bublinaOd + 0.3);
  if (pb > 0) kresliVyskoc(x, J.bublina, J.bx + J.bublina.w * 0.05, J.by + dy, pb, alfa);
}

function kresliKarty(x, t, env) {
  if (t < T.bOd || t > T.cRastDo) return;
  const K = L.karty;
  const prec = ease.inCubic(okno(t, T.bPrecOd, T.bPrecDo));
  // články reťaze medzi kartami v poradí (pod kartami, viditeľné v medzerách)
  for (let i = 0; i < 6; i++) {
    const q = okno(t, T.retazOd + i * T.retazKrok, T.retazOd + i * T.retazKrok + 0.2);
    if (q <= 0) continue;
    const a = K.pol[i], b = K.pol[i + 1];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, u = Math.atan2(b.y - a.y, b.x - a.x);
    const r = K.ch * 0.09 * ease.outBack(q, PREKMIT);
    x.save(); x.globalAlpha = 1 - prec; x.translate(mx, my); x.rotate(u);
    x.strokeStyle = FARBY.akcent; x.lineWidth = Math.max(2, K.ch * 0.03);
    x.beginPath(); x.ellipse(-r * 0.7, 0, r, r * 0.55, 0, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.ellipse(r * 0.7, 0, r, r * 0.55, 0, 0, Math.PI * 2); x.stroke();
    x.restore();
  }
  FAKTY.karty.forEach((id, i) => {
    const dopad = T.bOd + i * T.bKrok + T.bLet;
    const p = okno(t, dopad - T.bLet, dopad);
    if (p <= 0) return;
    const pp = ease.outCubic(p);
    const c = K.pol[i];
    let cx = lerp(L.W * 0.5 + (i - 3) * K.cw * 0.2, c.x, pp), cy = lerp(L.H * 1.2, c.y, pp);
    let rot = K.rot[i] + (1 - pp) * (i % 2 ? 24 : -24);
    let mierka = lerp(1.25, 1, pp), v = (1 - pp) * 0.8, alfa = 1;
    const po = t - dopad;
    if (po >= 0 && po < 0.22) mierka *= 1 - Math.sin(Math.PI * (po / 0.22)) * 0.03;
    // žiarenie pri spojení reťaze
    if (i === 0) {
      // karta 1 sa v scéne kódu zväčší do podkladu (kresliKod), tu len zmizne
      alfa = 1 - okno(t, T.cOd, T.cOd + 0.25);
    } else {
      cy += prec * L.H * 0.1; alfa = 1 - prec; rot += prec * (i % 2 ? 8 : -8);
    }
    if (alfa <= 0) return;
    kresliKartu(x, K.sp[i], cx, cy, rot, mierka, v, alfa);
  });
}

function kresliKod(x, t) {
  if (t < T.cOd || t > T.cPrecDo) return;
  const K = L.kod, A = L.R.A, K0 = L.karty;
  const rast = ease.inOutCubic(okno(t, T.cOd, T.cRastDo));
  const prec = ease.inCubic(okno(t, T.cPrecOd, T.cPrecDo));
  // podklad rastie z karty 1 v mriežke do plochy scény
  const c0 = K0.pol[0];
  const w = lerp(K0.cw, A.w, rast), h = lerp(K0.ch, A.h, rast);
  const cx = lerp(c0.x, A.x + A.w / 2, rast), cy = lerp(c0.y, A.y + A.h / 2, rast);
  const pk = K.podklad;
  const alfaP = obmedz((t - T.cOd) / 0.15) * (1 - prec);
  if (alfaP > 0) {
    x.save(); x.globalAlpha = alfaP * 0.7; x.drawImage(pk.tien, cx - w / 2 - pk.b * (w / pk.w), cy - h / 2 - pk.b * (h / pk.h), w + 2 * pk.b * (w / pk.w), h + 2 * pk.b * (h / pk.h)); x.restore();
    x.save(); x.globalAlpha = alfaP; x.drawImage(pk.c, cx - w / 2, cy - h / 2, w, h); x.restore();
  }
  if (t < T.dlazdiceOd || prec >= 1) return;
  const alfa = 1 - prec;
  // dlaždice a okienka
  K.dlazdice.forEach((d, i) => {
    const q = okno(t, T.dlazdiceOd + i * T.dlazdiceKrok, T.dlazdiceOd + i * T.dlazdiceKrok + 0.35);
    if (q <= 0) return;
    const k = lerp(0.5, 1, ease.outBack(q, PREKMIT));
    x.save(); x.globalAlpha = alfa * obmedz(q * 2.5);
    x.translate(d.x + K.tw / 2, d.y + K.tw / 2); x.scale(k, k);
    x.drawImage(K.tileSp[i].c, -K.tw / 2, -K.tw / 2, K.tw, K.tw);
    x.restore();
    // prázdne okienko pod obrázkom
    x.save(); x.globalAlpha = alfa * obmedz(q * 2.5);
    x.strokeStyle = FARBY.ink; x.lineWidth = Math.max(1.5, K.bw * 0.03); x.setLineDash([K.bw * 0.08, K.bw * 0.06]);
    zaoblene(x, d.box.x, d.box.y, d.box.w, d.box.w, d.box.w * 0.1); x.stroke(); x.setLineDash([]);
    x.restore();
  });
  // kľúč
  const qk = okno(t, T.klucOd, T.klucOd + 0.4);
  if (qk > 0) {
    const KA = K.KA;
    x.save(); x.globalAlpha = alfa * obmedz(qk * 1.8);
    x.drawImage(K.klucSp.c, KA.x, KA.y + (1 - ease.outCubic(qk)) * 0, KA.w, KA.h);
    x.restore();
  }
  // Olive (na výšku) sa pozerá pod kódom, pri OWL poskočí
  if (K.olive) {
    const qo = okno(t, T.klucOd + 0.2, T.klucOd + 0.6);
    if (qo > 0) {
      const hop = Math.max(0, Math.sin(((t - T.owl) / 0.45) * Math.PI)) * (t > T.owl && t < T.owl + 0.9 ? 1 : 0) * K.olive.h * 0.08;
      x.save(); x.globalAlpha = alfa * obmedz(qo * 2);
      x.drawImage(K.olive.c, K.oPos.x - K.olive.w / 2, K.oPos.y - K.olive.h / 2 - hop, K.olive.w, K.olive.h);
      x.restore();
    }
  }
  // písmená: krúžok na dvojici v kľúči, písmeno preletí do okienka
  FAKTY.cvikObrazky.forEach((o, i) => {
    const e = K.polozky.find((p) => p.o === o), d = K.dlazdice[i];
    const t0 = T.pismena[i];
    const kr = obalka(t, t0 - 0.25, t0 + T.letTrv + 0.3, 0.2, 0.3);
    if (kr > 0) {
      x.save(); x.globalAlpha = alfa * kr;
      x.strokeStyle = FARBY.akcent; x.lineWidth = Math.max(2, e.ki * 0.06);
      x.beginPath(); x.arc(e.ix + e.ki / 2, e.iy + e.ki / 2, e.ki * 0.62, 0, Math.PI * 2 * ease.outCubic(okno(t, t0 - 0.25, t0))); x.stroke();
      x.restore();
      // dlaždica s tým istým obrázkom sa rozsvieti
      x.save(); x.globalAlpha = alfa * kr * 0.9;
      x.strokeStyle = FARBY.tekvica; x.lineWidth = Math.max(3, K.tw * 0.035);
      zaoblene(x, d.x - K.tw * 0.03, d.y - K.tw * 0.03, K.tw * 1.06, K.tw * 1.06, K.tw * 0.14); x.stroke();
      x.restore();
    }
    const q = okno(t, t0, t0 + T.letTrv);
    if (q <= 0) return;
    const bx = d.box.x + d.box.w / 2, by = d.box.y + d.box.w / 2;
    // čiarkovaný oblúk od dvojice v kľúči k okienku (text nikam neletí, takže nič neprekryje)
    const ax = e.ix + e.ki / 2, ay = e.iy + e.ki / 2;
    const mx = (ax + bx) / 2 + (by - ay) * 0.18, my = (ay + by) / 2 - Math.abs(bx - ax) * 0.12 - K.bw * 0.2;
    const kon = obmedz(q * 1.25), sl = obalka(t, t0, t0 + T.letTrv + 0.5, 0.05, 0.4);
    if (sl > 0) {
      x.save(); x.globalAlpha = alfa * sl;
      x.strokeStyle = FARBY.tekvica; x.lineWidth = Math.max(2.5, K.bw * 0.035); x.lineCap = 'round'; x.setLineDash([K.bw * 0.06, K.bw * 0.07]);
      x.beginPath();
      const nk = 30, kk = Math.max(1, Math.round(nk * ease.inOutCubic(kon)));
      for (let j = 0; j <= kk; j++) {
        const u = j / nk, px = (1 - u) * (1 - u) * ax + 2 * u * (1 - u) * mx + u * u * bx, py = (1 - u) * (1 - u) * ay + 2 * u * (1 - u) * my + u * u * by;
        if (j === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke(); x.setLineDash([]);
      x.restore();
    }
    // písmeno sa v okienku zjaví, keď oblúk dorazí (mierka 0,96 až 1,04 a späť, v rámci okienka)
    const z = okno(t, t0 + T.letTrv * 0.8, t0 + T.letTrv + 0.3);
    if (z <= 0) return;
    const sp = K.pismena[FAKTY.cvik[i]];
    const k = z < 0.4 ? lerp(ZJAV, 1.04, ease.outCubic(z / 0.4)) : lerp(1.04, 1, ease.inOutSine((z - 0.4) / 0.6));
    x.save(); x.globalAlpha = alfa * obmedz(z * 3);
    x.drawImage(sp.c, bx - (sp.w * k) / 2, by - (sp.h * k) / 2, sp.w * k, sp.h * k);
    x.restore();
  });
  // OWL: žiara okolo troch okienok a iskry
  const z = okno(t, T.owl, T.owl + 0.7);
  if (z > 0 && z < 1) {
    const d0 = K.dlazdice[0].box, d2 = K.dlazdice[2].box;
    x.save(); x.globalAlpha = alfa * Math.sin(Math.PI * z);
    x.strokeStyle = '#f2b35a'; x.lineWidth = Math.max(3, K.bw * 0.06);
    zaoblene(x, d0.x - K.bw * 0.12, d0.y - K.bw * 0.12, d2.x + d2.w - d0.x + K.bw * 0.24, K.bw * 1.24, K.bw * 0.2); x.stroke();
    x.fillStyle = '#f2b35a';
    for (let j = 0; j < 10; j++) {
      const u = hash(j, 71) * Math.PI * 2, dd = K.bw * (0.9 + ease.outCubic(z) * (0.6 + hash(j, 72) * 0.8));
      const sx = (d0.x + d2.x + d2.w) / 2 + Math.cos(u) * dd * 1.6, sy = d0.y + K.bw / 2 + Math.sin(u) * dd * 0.7;
      x.beginPath(); x.arc(sx, sy, K.bw * 0.04 * (1 - z) + 1, 0, Math.PI * 2); x.fill();
    }
    x.restore();
  }
}

function kresliBoard(x, t) {
  if (t < T.eOd || t > T.ePrecDo) return;
  const B = L.board;
  const prec = ease.inCubic(okno(t, T.ePrecOd, T.ePrecDo));
  const alfa = 1 - prec;
  const tb = B.tabula;
  const p = okno(t, T.eOd, T.eRastDo);
  // tabuľa sa zjaví zmenšená (text nikdy nevyjde zo svojej plochy)
  if (p > 0) {
    const k = lerp(ZJAV, 1, ease.outCubic(p));
    const cx = B.bx + B.bw / 2, cy = B.by + B.bh / 2;
    x.save(); x.globalAlpha = alfa * obmedz(p * 1.8) * 0.7;
    x.drawImage(tb.tien, cx - (B.bw / 2 + tb.b) * k, cy - (B.bh / 2 + tb.b) * k, (B.bw + 2 * tb.b) * k, (B.bh + 2 * tb.b) * k);
    x.restore();
    kresliVyskoc(x, { c: tb.c, w: B.bw, h: B.bh }, cx, cy, p, alfa);
    // riadok s obrázkom Acorn: ceruzkou zakrúžkovaný, obrázok poskočí
    const r = B.riadky[B.zv];
    const ry = B.by + r.y, q = okno(t, T.riadokOd, T.riadokDo);
    const ix = B.bx + B.bw - B.pad - B.ic, iy = ry + B.rh / 2 - B.ic / 2;
    const k2 = 1 + Math.sin(Math.PI * okno(t, T.riadokDo, T.riadokDo + 0.3)) * 0.25;
    x.save(); x.globalAlpha = alfa * obmedz(p * 1.8);
    x.translate(ix + B.ic / 2, iy + B.ic / 2); x.scale(k * k2, k * k2);
    x.drawImage(B.ikona.c, -B.ic / 2, -B.ic / 2, B.ic, B.ic);
    x.restore();
    if (q > 0) {
      x.save(); x.globalAlpha = alfa;
      x.strokeStyle = FARBY.akcent; x.lineWidth = Math.max(2.5, B.rh * 0.05); x.lineCap = 'round';
      const ex = B.bx + B.bw / 2, ey = ry + B.rh / 2, erx = B.bw * 0.47, ery = B.rh * 0.5;
      x.beginPath(); x.ellipse(ex, ey, erx, ery, -0.02, Math.PI * 0.9, Math.PI * 0.9 + Math.PI * 2.1 * ease.inOutSine(q)); x.stroke();
      x.restore();
    }
  }
  // karta Acorn priletí sprava (bez textu) a otvorí sa
  const C = B.karta;
  const pc = okno(t, T.kartaOd, T.kartaDopad);
  if (pc <= 0) return;
  const pp = ease.outCubic(pc);
  // na výšku priletí sprava; na šírku je vpravo titulok, preto zospodu (kontrolná snímka 16:9 v 14,0 s: karta cez text)
  const zospodu = !L.R.F.stlpec;
  const ox = zospodu ? C.x + prec * L.W * 0.05 : lerp(L.W + C.cw * 0.2, C.x, pp) + prec * L.W * 0.05;
  const oy = zospodu ? lerp(L.H + C.ch * 0.2, C.y, pp) : C.y + (1 - pp) * C.ch * 0.2;
  const rot = (1 - pp) * 12;
  x.save(); x.globalAlpha = alfa;
  x.translate(ox + C.cw / 2, oy + C.ch / 2); x.rotate((rot * Math.PI) / 180); x.translate(-C.cw / 2, -C.ch / 2);
  x.globalAlpha = alfa * 0.6;
  x.drawImage(C.hornaSp.tien, -C.hornaSp.b, -C.hornaSp.b + C.ch * 0.03, C.cw + 2 * C.hornaSp.b, C.ch + 2 * C.hornaSp.b);
  x.globalAlpha = alfa;
  x.drawImage(C.hornaSp.c, 0, 0, C.cw, C.ch);
  // klapka: zložená prekrýva hornú polovicu pod pásom, pri otvorení sa preklopí dole cez líniu prehnutia
  const u = ease.inOutCubic(okno(t, T.rozlozOd, T.rozlozDo)); // 0 zložená, 1 otvorená
  const cos = Math.cos(Math.PI * u); // 1 hore (rub), -1 dole (predok)
  if (cos > 0) {
    const vh = C.klap * cos;
    x.drawImage(C.klapRub.c, 0, C.ch - vh, C.cw, vh);
    x.fillStyle = `rgba(90,60,30,${0.12 * (1 - cos)})`; x.fillRect(0, C.ch - vh, C.cw, vh);
  } else if (cos < 0) {
    const vh = C.klap * -cos;
    x.drawImage(C.klapPredok.c, 0, C.ch, C.cw, vh);
    x.fillStyle = `rgba(90,60,30,${0.14 * (1 + cos)})`; x.fillRect(0, C.ch, C.cw, vh);
  }
  x.restore();
}

function kresliOdznak(x, t) {
  if (t < T.fOd || t > T.fPrecDo) return;
  const O = L.odznak;
  const prec = ease.inCubic(okno(t, T.fPrecOd, T.fPrecDo));
  const alfa = 1 - prec;
  const karticka = (k, stred, p, rot) => {
    if (p <= 0) return;
    const m = lerp(ZJAV, 1, ease.outCubic(p));
    x.save(); x.globalAlpha = alfa * obmedz(p * 1.8) * 0.7;
    x.translate(stred.x, stred.y); x.rotate((rot * Math.PI) / 180); x.scale(m, m);
    x.drawImage(k.tien, -k.w / 2 - k.b, -k.h / 2 - k.b + k.h * 0.02, k.w + 2 * k.b, k.h + 2 * k.b);
    x.globalAlpha = alfa * obmedz(p * 1.8);
    x.drawImage(k.c, -k.w / 2, -k.h / 2, k.w, k.h);
    x.restore();
  };
  karticka(O.odznak, O.o, okno(t, T.fOd, T.odznakDo), -1.2);
  karticka(O.cert, O.c, okno(t, T.certOd, T.certDo), 1);
  // modrá stuha víťaza pripne sa na certifikát (bez textu, smie poskočiť)
  const ps = okno(t, T.stuhaOd, T.stuhaOd + 0.35);
  if (ps > 0) {
    const k = ease.outBack(ps, PREKMIT);
    x.save(); x.globalAlpha = alfa * obmedz(ps * 3);
    x.translate(O.c.x + O.cw * 0.28, O.c.y + O.chh * 0.3); x.rotate(((1 - ps) * -25 * Math.PI) / 180); x.scale(k, k);
    x.drawImage(O.stuha.c, -O.ss / 2, -O.ss / 2, O.ss, O.ss);
    x.restore();
  }
}

function kresliTexty(x, t) {
  const { R, texty } = L;
  const { poz, colX } = texty;
  const tx = R.stred ? R.Z.x0 : colX;
  const cx = R.stred ? (L.W - texty.veta.w) / 2 : colX;
  if (t < HAK.koniec) {
    HAK.kresliNazov(x, t, texty.nazov, tx, poz.nazov);
    // veta, vek a cena odídu spolu len zoslabnutím (bez posunu: nič nevyjde zo zóny ani na suseda)
    const v = ease.inOutCubic(okno(t, HAK.drz - 0.3, HAK.drz + 0.1));
    if (v < 1) {
      x.save(); x.globalAlpha = 1 - v;
      x.drawImage(texty.veta.c, cx, poz.veta, texty.veta.w, texty.veta.h);
      x.drawImage(texty.info.c, cx, poz.info, texty.info.w, texty.info.h);
      // cena už v háku: snímka 0 má rovnaké zloženie ako záver (slučka bez skoku, ponuka hneď viditeľná)
      x.drawImage(texty.cena.c, texty.btn.x - 4, texty.btn.y - 4, texty.cena.w, texty.cena.h);
      x.restore();
    }
  }
  for (const tt of texty.titulky) {
    const a = obalka(t, tt.od, tt.do, 0.3, 0.3);
    if (a <= 0) continue;
    const vstup = ease.outCubic(okno(t, tt.od, tt.od + 0.4));
    x.globalAlpha = a;
    x.drawImage(tt.sp.c, R.cap.x, R.cap.y + (1 - vstup) * R.s * 0.015, tt.sp.w, tt.sp.h);
    x.globalAlpha = 1;
  }
  // záver: texty sa vynoria bez masky (nikdy nie sú napoly zakryté)
  const vyjdi = (sp, od, px0, y, trv = 0.6) => {
    const p = ease.outCubic(okno(t, od, od + trv));
    if (p <= 0) return;
    x.save();
    x.globalAlpha = obmedz(p * 1.4);
    x.drawImage(sp.c, px0, y + (1 - p) * sp.h * 0.25, sp.w, sp.h); // zdola: názov hore nikdy nevyjde nad zónu
    x.restore();
  };
  // názov: vynorí sa v mierke 1, potom sa do poslednej snímky pomaly priblíži na mierku snímky 0
  // (okolo toho istého stredu ako v háku), takže slučka nadväzuje bez skoku
  if (t >= T.nazov) {
    const sp = texty.nazov, k = lerp(1, texty.priblizenie0, ease.inOutSine(okno(t, T.nazovBlizsieOd, DLZKA)));
    const scx = tx + sp.w / 2, scy = poz.nazov + sp.h / 2;
    x.save(); x.translate(scx, scy); x.scale(k, k); x.translate(-scx, -scy);
    vyjdi(sp, T.nazov, tx, poz.nazov, 0.75);
    x.restore();
  }
  vyjdi(texty.veta, T.veta, cx, poz.veta);
  vyjdi(texty.info, T.info, cx, poz.info);
  const pb = okno(t, T.cena, T.cena + 0.5);
  if (pb > 0) {
    const b = texty.cena, sc = ZJAV + (1 - ZJAV) * ease.outBack(pb, PREKMIT);
    const { x: bx0, y: by0, w, h } = texty.btn;
    const ccx = bx0 + w / 2, ccy = by0 + h / 2;
    x.globalAlpha = obmedz(pb * 2);
    x.drawImage(b.c, ccx - (b.w * sc) / 2, ccy - (b.h * sc) / 2, b.w * sc, b.h * sc);
    const q = okno(t, T.lesk, T.lesk + 0.7);
    if (q > 0 && q < 1) {
      x.save();
      zaoblene(x, bx0, by0, w, h, h / 2); x.clip();
      x.globalCompositeOperation = 'lighter';
      const lx = lerp(bx0 - w * 0.3, bx0 + w * 1.3, ease.inOutSine(q));
      const g = x.createLinearGradient(lx - w * 0.15, 0, lx + w * 0.15, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.28)'); g.addColorStop(1, 'rgba(255,255,255,0)');
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
  x.globalAlpha = 0.035;
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
    { od: 0, text: 'The Pumpkin Fair Mix-Up. A red wagon carries the cards of the kit: Olive’s coded note in front and three folded cards behind it. A tag on the handle asks: Where is Big Marigold? A printable Halloween escape room for kids, ages 6 to 10, 2 to 8 players. 6.90 euros at arling.sk/shop.' },
    { od: 1.9, text: 'The wagon rolls away. Farmer Juniper the hedgehog and Olive the Owl look at the wheel tracks. The prize pumpkin has gone missing.' },
    { od: 4.45, text: 'Seven fair games land on the table: Olive’s coded note and six folded cards, with an acorn, a basket, a leaf, a mitten, a pear and a pinecone. Chain links join them.' },
    { od: 7.05, text: 'Olive’s coded note grows. Three pictures, a kite, a heart and a cloud, and a code key.' },
    { od: 8.75, text: 'The warm up from the kit, solved one picture at a time: kite is O, heart is W, cloud is L. The word is OWL.' },
    { od: 12.7, text: 'Olive’s Answer Board with the answers hidden. One row with an acorn is circled, and the folded Acorn card opens to show Mrs Bramble.' },
    { od: 15.3, text: 'A Fair Helper badge and an Official Fair Helper certificate with a blue ribbon.' },
    { od: 17.85, text: 'The red wagon rolls back in with the cards, and the tag asks again: Where is Big Marigold? The Pumpkin Fair Mix-Up. A printable Halloween escape room for kids, ages 6 to 10, 2 to 8 players. 6.90 euros at arling.sk/shop.' },
  ],
  async pripravit() {
    if (document.fonts && document.fonts.load) {
      await Promise.all([
        document.fonts.load(pismo(700, 40)), document.fonts.load(pismo(600, 40)),
        document.fonts.load(pismo(600, 40, SERIF)), document.fonts.load(pismo(400, 40, SERIF)),
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
    kresliListy(x, t, env);
    kresliLampiony(x, t);
    kresliVozik(x, t);
    kresliJarmok(x, t);
    kresliKarty(x, t, env);
    kresliKod(x, t);
    kresliBoard(x, t);
    kresliOdznak(x, t);
    kresliTexty(x, t);
    kresliZrno(x, t, env);
  },
  stredPlagatu() { return L.voz.stred; },
  // štítok s cenou vedie na stránku sady (tam je nákup aj náhľad všetkých 16 strán)
  odkazy() {
    const b = L.texty.btn;
    return [{ x: b.x, y: b.y, w: b.w, h: b.h, href: '/shop/pumpkin-escape-kids/', text: 'The Pumpkin Fair Mix-Up, 6.90 €', od: T.cena, udalost: 'pumpkin_film_to_kit' }];
  },
  zvuk: partitura(),
  // pre test.mjs: titulky na plátne, všetky texty filmu, rozloženie
  kontrola: {
    titulky: TITULKY,
    texty: [...NAZOV, FAKTY.podnazov, INFO, CENA, ...STITOK, '?', 'CODE KEY', 'Olive’s Answer Board', 'Fair Helper', 'NAME', 'COSTUME', 'Official',
      ...FAKTY.kluc.map(([, p]) => p), ...TITULKY.map((x) => x.text)],
    rozlozenie: () => L && { A: L.R.A, cap: L.R.cap, plocha: L.texty.plocha, voz: { u: L.voz.u, x0: L.voz.x0, y0: L.voz.y0 } },
    T,
  },
};

function partitura() {
  const u = [];
  // hák: teplý durový akord, zvony, drevený ťuk; zvuk od snímky 0
  u.push(...HAK.zvuk({ akord: ['C3', 'G3', 'E4', 'A4'], zvony: ['E5', 'G5', 'C6'] }));
  const svih = (t, pan, hlas = 1) => u.push({ t, typ: 'sum', filter: 'bandpass', f0: 700, f1: 2600, q: 0.8, dlzka: 0.32, nabeh: 0.28, tvar: 'narast', hlas: 0.045 * hlas, pan, dozvuk: 0.15 });
  const dopad = (t, pan, hlas = 1) => {
    u.push({ t, typ: 'tuk', f: 150, dlzka: 0.12, hlas: 0.12 * hlas, pan });
    u.push({ t, typ: 'sum', filter: 'bandpass', f0: 2400, f1: 900, q: 0.9, dlzka: 0.12, hlas: 0.06 * hlas, pan, dozvuk: 0.12 });
  };
  // kolesá vozíka: drevené ťuky po kamienkoch (odchod v háku, príchod v závere)
  const kolesa = (od, dokedy, pan0, pan1, hlas) => {
    for (let t = od, i = 0; t < dokedy; t += 0.085, i++) {
      const q = (t - od) / (dokedy - od);
      u.push({ t, typ: 'tuk', f: i % 2 ? 210 : 175, dlzka: 0.05, hlas: 0.05 * hlas * (1 - q * 0.6), pan: lerp(pan0, pan1, q) });
    }
  };
  kolesa(T.vozPrecOd + 0.05, T.vozPrecDo, 0, 0.7, 1);
  // pochod jarmoku: jemný basový ťuk na dobu a vysoký na medzidobu (120 BPM), pod celým príbehom
  for (let t = 2.0; t < 17.8; t += 0.5) {
    u.push({ t, typ: 'tuk', f: 98, dlzka: 0.14, hlas: 0.05 });
    u.push({ t: t + 0.25, typ: 'tuk', f: 392, dlzka: 0.04, hlas: 0.018, pan: 0.2 });
  }
  // A: jarmok (Am7, zvedavo, ale teplo)
  u.push({ t: 1.9, typ: 'pad', noty: ['A2', 'E3', 'C4', 'G4'], dlzka: 2.6, nabeh: 0.4, dobeh: 0.7, hlas: 0.12, filter: 900 });
  u.push({ t: T.junDo, typ: 'tuk', f: 120, dlzka: 0.12, hlas: 0.1, pan: -0.3 });
  u.push({ t: T.oliDo - 0.15, typ: 'zvon', f: 'G5', index: 0.6, dlzka: 1.0, hlas: 0.08, pan: 0.3, dozvuk: 0.4 });
  u.push({ t: T.oliDo - 0.05, typ: 'zvon', f: 'C6', index: 0.6, dlzka: 1.0, hlas: 0.06, pan: 0.3, dozvuk: 0.4 });
  u.push({ t: T.bublinaOd + 0.05, typ: 'glis', f0: 'E5', f1: 'A5', dlzka: 0.22, hlas: 0.05, dozvuk: 0.3 });
  // B: sedem hier (Fmaj7), každá karta svoj tón z pentatoniky, potom cinknutie článkov reťaze
  u.push({ t: 4.4, typ: 'pad', noty: ['F2', 'C3', 'A3', 'E4'], dlzka: 2.9, nabeh: 0.5, dobeh: 0.8, hlas: 0.12, filter: 1000 });
  ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6'].forEach((f, i) => {
    const d = T.bOd + i * T.bKrok + T.bLet;
    svih(d - T.bLet, (i - 3) * 0.15, 0.7);
    dopad(d, (i - 3) * 0.15, 0.8);
    u.push({ t: d, typ: 'zvon', f, index: 0.9, dlzka: 1.1, hlas: 0.09, pan: (i - 3) * 0.15, dozvuk: 0.35 });
  });
  for (let i = 0; i < 6; i++) u.push({ t: T.retazOd + i * T.retazKrok + 0.05, typ: 'tuk', f: 1800 + i * 120, dlzka: 0.03, hlas: 0.05, pan: -0.3 + i * 0.12 });
  u.push({ t: T.retazOd + 0.6, typ: 'sum', filter: 'highpass', f0: 5000, f1: 9000, dlzka: 0.7, hlas: 0.03, dozvuk: 0.5 });
  // C a D: obrázkový kód (C dur), dlaždice, kľúč, tri písmená stúpajú, OWL
  u.push({ t: T.cOd, typ: 'sum', filter: 'bandpass', f0: 500, f1: 2200, q: 0.7, dlzka: 0.45, nabeh: 0.35, tvar: 'narast', hlas: 0.05 });
  u.push({ t: 7.0, typ: 'pad', noty: ['C3', 'G3', 'E4', 'D5'], dlzka: 2.9, nabeh: 0.5, dobeh: 0.7, hlas: 0.11, filter: 1100 });
  ['G4', 'C5', 'E5'].forEach((f, i) => u.push({ t: T.dlazdiceOd + i * T.dlazdiceKrok + 0.12, typ: 'zvon', f, index: 0.7, dlzka: 0.9, hlas: 0.07, pan: (i - 1) * 0.3, dozvuk: 0.35 }));
  for (let i = 0; i < 6; i++) u.push({ t: T.klucOd + i * T.klucKrok, typ: 'tuk', f: 900 + i * 80, dlzka: 0.03, hlas: 0.03 });
  u.push({ t: T.pismena[0] - 0.3, typ: 'pad', noty: ['F2', 'C3', 'A3', 'G4'], dlzka: T.owl - T.pismena[0], nabeh: 0.4, dobeh: 0.6, hlas: 0.1, filter: 1000 });
  ['E5', 'G5', 'C6'].forEach((f, i) => {
    const t0 = T.pismena[i];
    u.push({ t: t0 - 0.25, typ: 'sum', filter: 'bandpass', f0: 3200, f1: 3600, q: 2, dlzka: 0.22, hlas: 0.025, pan: 0.2 }); // ceruzka krúžkuje
    u.push({ t: t0, typ: 'glis', f0: 'C5', f1: f, dlzka: T.letTrv * 0.9, hlas: 0.03, dozvuk: 0.3 });
    u.push({ t: t0 + T.letTrv, typ: 'zvon', f, index: 0.9, dlzka: 1.2, hlas: 0.11, pan: (i - 1) * 0.3, dozvuk: 0.4 });
    u.push({ t: t0 + T.letTrv, typ: 'tuk', f: 330, dlzka: 0.05, hlas: 0.05 });
  });
  u.push({ t: T.owl - 0.3, typ: 'pad', noty: ['C3', 'G3', 'E4', 'G4'], dlzka: 1.6, nabeh: 0.2, dobeh: 0.8, hlas: 0.12, filter: 1500 });
  u.push({ t: T.owl, typ: 'zvon', f: 'C6', pomer: 3.5, index: 0.7, dlzka: 1.6, hlas: 0.08, dozvuk: 0.6 });
  u.push({ t: T.owl + 0.12, typ: 'zvon', f: 'G6', index: 0.5, dlzka: 1.2, hlas: 0.04, dozvuk: 0.6 });
  u.push({ t: T.owl, typ: 'sum', filter: 'highpass', f0: 5000, f1: 9000, dlzka: 0.8, hlas: 0.03, dozvuk: 0.6 });
  // E: Answer Board a karta (Am, potom F pri otvorení)
  u.push({ t: 12.7, typ: 'pad', noty: ['A2', 'E3', 'C4', 'E4'], dlzka: 1.9, nabeh: 0.4, dobeh: 0.6, hlas: 0.11, filter: 900 });
  u.push({ t: T.eOd, typ: 'tuk', f: 140, dlzka: 0.1, hlas: 0.08 });
  u.push({ t: T.riadokOd, typ: 'sum', filter: 'bandpass', f0: 2800, f1: 3400, q: 2, dlzka: T.riadokDo - T.riadokOd, hlas: 0.025 });
  u.push({ t: T.riadokDo, typ: 'zvon', f: 'A5', index: 1, dlzka: 1.2, hlas: 0.1, dozvuk: 0.4 });
  svih(T.kartaOd, 0.4);
  dopad(T.kartaDopad, 0.2, 0.8);
  u.push({ t: 14.4, typ: 'pad', noty: ['F2', 'C3', 'A3', 'C4'], dlzka: 1.1, nabeh: 0.2, dobeh: 0.5, hlas: 0.11, filter: 1100 });
  u.push({ t: T.rozlozOd, typ: 'praskot', dlzka: 0.3, hlas: 0.18, f: 2200, hustota: 90, semienko: 31 });
  u.push({ t: T.rozlozDo - 0.1, typ: 'zvon', f: 'C6', index: 0.7, dlzka: 1.2, hlas: 0.09, dozvuk: 0.5 });
  // F: odznak, certifikát, stuha (F dur, potom G pred záverom)
  u.push({ t: 15.3, typ: 'pad', noty: ['F2', 'C3', 'A3', 'F4'], dlzka: 1.4, nabeh: 0.3, dobeh: 0.5, hlas: 0.12, filter: 1100 });
  u.push({ t: 16.6, typ: 'pad', noty: ['G2', 'D3', 'B3', 'G4'], dlzka: 1.4, nabeh: 0.3, dobeh: 0.6, hlas: 0.11, filter: 1100 });
  dopad(T.odznakDo - 0.1, -0.2, 0.8);
  u.push({ t: T.odznakDo - 0.1, typ: 'zvon', f: 'E5', index: 0.7, dlzka: 1.0, hlas: 0.08, pan: -0.2, dozvuk: 0.4 });
  dopad(T.certDo - 0.1, 0.2, 0.8);
  u.push({ t: T.certDo - 0.1, typ: 'zvon', f: 'G5', index: 0.7, dlzka: 1.0, hlas: 0.08, pan: 0.2, dozvuk: 0.4 });
  u.push({ t: T.stuhaOd + 0.2, typ: 'zvon', f: 'C6', index: 0.8, dlzka: 1.4, hlas: 0.1, pan: 0.2, dozvuk: 0.5 });
  u.push({ t: T.stuhaOd + 0.2, typ: 'sum', filter: 'highpass', f0: 5000, f1: 9000, dlzka: 0.7, hlas: 0.03, dozvuk: 0.5 });
  // záver: vozík sa vráti, akord C dur, zvony na názov a cenu
  kolesa(T.vozOd + 0.05, T.vozDo - 0.05, -0.7, 0, 0.9);
  u.push({ t: T.vozDo, typ: 'tuk', f: 110, dlzka: 0.16, hlas: 0.14 });
  u.push({ t: T.stitokOd + 0.1, typ: 'glis', f0: 'G5', f1: 'E5', dlzka: 0.25, hlas: 0.035, dozvuk: 0.3 });
  u.push({ t: T.nazov, typ: 'pad', noty: ['C3', 'G3', 'E4', 'G4'], dlzka: 2.85, nabeh: 0.3, dobeh: 1.4, hlas: 0.16, filter: 1500, filter2: 800 });
  u.push({ t: T.nazov, typ: 'zvon', f: 'C4', index: 0.5, dlzka: 2.4, hlas: 0.12, dozvuk: 0.55 });
  u.push({ t: T.nazov + 0.02, typ: 'zvon', f: 'G4', index: 0.4, dlzka: 2.2, hlas: 0.06, dozvuk: 0.55 });
  u.push({ t: T.veta, typ: 'zvon', f: 'E5', index: 0.4, dlzka: 1.3, hlas: 0.05, dozvuk: 0.5 });
  u.push({ t: T.cena + 0.1, typ: 'tuk', f: 320, dlzka: 0.07, hlas: 0.06 });
  u.push({ t: T.cena + 0.1, typ: 'zvon', f: 'G5', index: 0.5, dlzka: 1.0, hlas: 0.06, dozvuk: 0.5 });
  u.push({ t: T.lesk, typ: 'zvon', f: 'C6', index: 0.5, dlzka: 1.0, hlas: 0.035, dozvuk: 0.6 });
  return u.filter((e) => e.t >= 0 && e.t < DLZKA);
}

export default film;
