// Word Search: Calm Word Puzzles, film na 20 sekúnd nakreslený a ozvučený kódom (kodfilm engine).
// Vzhľad podľa skutočnej appky: papier #F5F2E9, biela doska, písmená Nunito v Ink #203E45, pásy
// zvýraznenia z Play.kt, šesť štýlov zvýrazňovača z Board.kt, pilulka s písmenami nad doskou,
// zoznam slov ako čipy, karta dokončenej úrovne s mincami, ktoré sa počítajú nahlas.
// Scény: hák (hotová doska, prst ťahom nájde DAISY, názov od snímky 0), doska sa vyprázdni, prst
// nájde TULIP (vodorovne) a FERN (šikmo), potom ROSE (nahor) a DAISY, konfety a karta +15 coins,
// zvýraznenia prejdú štýlmi Chalk, Marker, Stitch, Ribbon, záver „Coming soon to Google Play“ a arling.sk.

import { okno, obmedz, lerp, ease, hash, obalka } from './engine/cas.js';
import { platno, zrno, zaoblene, zalom } from './engine/kresba.js';
import { hak, format, zona, sprite, vyvazZalom, minPismo } from './engine/hak.js';
import { FARBA, rgba, nun, nacitajPisma, spritePismena, zvyrazni, STYLY, spritePrsta, spritePilulky } from './pismena.js';

const DLZKA = 20;
const N = 6;

// Doska 6 x 6 z témy Garden (slová z ops/games/word-search/themes.tsv). Výplň je naša.
const MRIEZKA = ['DAISYE', 'KVCNUS', 'BXRKQO', 'GEHCWR', 'FTULIP', 'MKOAWB'];
// Zoznam slov abecedne ako v appke; slovo i má pás FARBA.pasy[i] (Board.kt: bands[i % size]).
const SLOVA = [
  { w: 'DAISY', z: [0, 0], k: [0, 4] }, // vodorovne
  { w: 'FERN', z: [4, 0], k: [1, 3] },  // šikmo nahor doprava
  { w: 'ROSE', z: [3, 5], k: [0, 5] },  // nahor
  { w: 'TULIP', z: [4, 1], k: [4, 5] }, // vodorovne
];
const bunky = (s) => {
  const dr = Math.sign(s.k[0] - s.z[0]), ds = Math.sign(s.k[1] - s.z[1]);
  return Array.from({ length: s.w.length }, (_, j) => [s.z[0] + dr * j, s.z[1] + ds * j]);
};
SLOVA.forEach((s) => { s.bunky = bunky(s); });
const ACCENT = FARBA.pasy[0]; // Garden je prvá téma: akcent ťahu je mätový pás (Board.kt accentOf)

// Kontrola pri načítaní: každé slovo naozaj leží na doske tam, kde ho film nájde.
(function over() {
  for (const s of SLOVA) {
    const txt = s.bunky.map(([r, c]) => MRIEZKA[r][c]).join('');
    if (txt !== s.w) throw new Error(`Word Search film: ${s.w} na doske nie je (${txt})`);
  }
})();

const HAK = hak({ drz: 1.3, odchod: 0.6 }); // hák do 1,9 s

// --- časová os (sekundy) ---
const T = {
  cistOd: 1.3, cistDo: 1.65,
  uiOd: 1.6, uiDo: 2.05,
  konfety: 9.25, kartaOd: 9.45, minceOd: 9.8, minceDo: 10.4, kartaDo: 11.7,
  // Glow (2) vo filme nie je: na telefóne po kompresii pôsobil ako rozmazanie, nie ako zámerný štýl
  styly: [[12.3, 1], [13.0, 3], [13.7, 4], [14.4, 5], [15.1, 0]],
  uiPrec: 15.45,
  presunOd: 15.55, presunDo: 16.35,
  vlna: 16.3,
  nazov: 16.15, veta: 16.6, veta2: 16.95, tlacidlo: 17.4, tiraz: 18.0,
};
// Ťahy prsta: slovo, príchod, ťah, odchod. Prvý ťah (hák) sa začína na snímke 0 už na doske.
const GESTA = [
  { s: 0, prichod: null, tahOd: 0.0, tahDo: 0.66, odchod: [0.74, 1.0] },
  { s: 3, prichod: [2.4, 2.8], tahOd: 2.85, tahDo: 3.75, odchod: [3.83, 4.2] },
  { s: 1, prichod: [5.1, 5.45], tahOd: 5.5, tahDo: 6.35, odchod: [6.43, 6.8] },
  { s: 2, prichod: [7.4, 7.7], tahOd: 7.75, tahDo: 8.2, odchod: null },
  { s: 0, prichod: [8.28, 8.58], tahOd: 8.62, tahDo: 9.05, odchod: [9.13, 9.5] },
];
GESTA.forEach((g) => { g.najdene = g.tahDo + 0.04; });
// Kedy je slovo nájdené v háku (-10 = už bolo) a v príbehu.
const HAK_NAJDENE = [GESTA[0].najdene, -10, -10, -10];
const NAJDENE = [];
GESTA.slice(1).forEach((g) => { NAJDENE[g.s] = g.najdene; });

/** Čas, keď ťah dosiahne j-te písmeno (inverzia ease.inOutSine). */
function casPismena(g, j) {
  const n = SLOVA[g.s].w.length;
  const p = j === 0 ? 0 : (j - 0.5) / (n - 1);
  return g.tahOd + (g.tahDo - g.tahOd) * (Math.acos(1 - 2 * p) / Math.PI);
}

const TITULKY = [
  { od: 2.2, do: 5.0, text: [['Swipe across the letters to '], ['find a word', FARBA.green], ['.']] },
  // appka: úrovne 1 až 3 len vodorovne a zvislo, od 4 aj šikmo, všetkých osem smerov od 13 a v dennej hádanke
  { od: 5.1, do: 7.9, text: [['Later levels hide words in '], ['all eight directions', FARBA.green], ['.']] },
  { od: 9.35, do: 11.95, text: [['Finish a level, '], ['earn coins', FARBA.green], ['.']] },
  { od: 12.15, do: 15.45, text: [['Coins unlock new '], ['highlighter styles', FARBA.green], ['.']] },
];

// ---------- stav vrstiev (prestavia sa pri zmene rozmeru) ----------
let L = null;

/** Rozloženie: 9:16, 4:5 a 1:1 pod sebou (hlavička, doska, čipy, titulok), 16:9 doska vľavo, zvyšok vpravo. */
function rozlozenie(W, H) {
  const F = format(W, H), Z = zona(W, H), mp = minPismo(W, H); // drobná tlač najmenej 36 px pri 1080
  if (F.stlpec) {
    const s = Math.min(Z.w * 1.2, Z.h * 0.8);
    const velNad = s * 0.05, velPil = Math.max(s * 0.036, mp), velTit = s * 0.05;
    const hlavH = velNad * 1.2 + s * 0.012 + velPil * 1.55;
    const velCip = Math.max(s * 0.036, mp), velStit = Math.max(s * 0.03, mp), velMin = Math.max(s * 0.036, mp);
    const cipH = velMin * 1.3 + s * 0.014 + velCip * 2.1;
    const capH = velTit * 1.25 * 2 + velTit * 0.3;
    const g1 = s * 0.022, g2 = s * 0.03, g3 = s * 0.04;
    const B = Math.min(Z.w, Z.h - hlavH - g1 - g2 - cipH - g3 - capH);
    const spolu = hlavH + g1 + B + g2 + cipH + g3 + capH;
    const hy = Z.y0 + (Z.h - spolu) / 2;
    const by = hy + hlavH + g1, bx = (W - B) / 2;
    return { F, Z, s, stred: true, B, bx, by, velNad, velPil, velTit, velCip, velStit, velMin,
      // zoznam slov v celej šírke zóny (nie len dosky): čipy 36 px sa tak zmestia do jedného riadku aj v 1:1
      hx: bx, hw: B, hy, cx: Z.x0, cw: Z.w, cy: by + B + g2, tx: Z.x0, tw: Z.w, tyTit: by + B + g2 + cipH + g3, ex: Z.x0, ew: Z.w };
  }
  const s = Math.min(W * 0.55, H);
  const B = Math.min(H * 0.84, W * 0.46);
  const bx = Math.max(Z.x0, W * 0.07), by = (H - B) / 2;
  const tx = bx + B + W * 0.055, tw = Z.x1 - tx;
  const velNad = s * 0.056, velPil = Math.max(s * 0.036, mp), velTit = s * 0.054;
  const velCip = Math.max(s * 0.036, mp), velStit = Math.max(s * 0.03, mp), velMin = Math.max(s * 0.036, mp);
  const hlavH = velNad * 1.2 + s * 0.012 + velPil * 1.55;
  return { F, Z, s, stred: false, B, bx, by, velNad, velPil, velTit, velCip, velStit, velMin,
    hx: tx, hw: tw, hy: 0, cx: tx, cw: tw, cy: 0, tx, tw, tyTit: 0, hlavH, ex: tx, ew: tw };
}

function stavVrstiev(W, H, dpr, env) {
  const R = rozlozenie(W, H);
  const { B, bx, by } = R;
  const pad = B * 0.024, c = (B - 2 * pad) / N;
  R.pad = pad; R.c = c;
  R.stred_ = (r, s) => [bx + pad + (s + 0.5) * c, by + pad + (r + 0.5) * c];
  const Wd = Math.round(W * dpr), Hd = Math.round(H * dpr);

  // pozadie: papier appky a jemné teplé svetlo zhora
  const poz = platno(Wd, Hd), px = poz.getContext('2d');
  px.scale(dpr, dpr);
  px.fillStyle = FARBA.paper; px.fillRect(0, 0, W, H);
  const sv = px.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.3, Math.max(W, H) * 0.8);
  sv.addColorStop(0, 'rgba(255,253,246,0.7)'); sv.addColorStop(1, 'rgba(230,224,208,0.35)');
  px.fillStyle = sv; px.fillRect(0, 0, W, H);

  // doska: biely štvorec so zaoblením 22dp (Board.kt BoardFrame), jemný tieň len pre film
  const doska = platno(Wd, Hd), x = doska.getContext('2d');
  x.scale(dpr, dpr);
  x.save();
  x.shadowColor = 'rgba(32,62,69,0.10)'; x.shadowBlur = B * 0.05; x.shadowOffsetY = B * 0.015;
  zaoblene(x, bx, by, B, B, B * 0.06);
  x.fillStyle = '#ffffff'; x.fill();
  x.restore();

  const pismena = {};
  for (const ch of new Set(MRIEZKA.join(''))) pismena[ch] = { ink: spritePismena(ch, c, dpr, false), biele: spritePismena(ch, c, dpr, true) };
  const prst = spritePrsta(c, dpr);
  const zrna = zrno(3, Math.round(160 * dpr), 1, 11).map((z) => ({ z }));
  L = { W, H, dpr, R, poz, doska, pismena, prst, zrna };
  L.texty = stavTexty(W, H, dpr, R);
}

/** Riadok textu v Nunito ako sprite (vyvážené zalomenie, najviac maxRiadkov). */
function spriteRiadku(dpr, text, px, w, { vaha = 700, farba = FARBA.ink, zarovnanie = 'center', riadkovanie = 1.28, maxRiadkov = 2 } = {}) {
  const m = platno(4, 4).getContext('2d');
  let vel = px;
  m.font = nun(vaha, vel);
  let riadky = vyvazZalom(m, text, w);
  while (riadky.length > maxRiadkov && vel > 8) { vel *= 0.94; m.font = nun(vaha, vel); riadky = vyvazZalom(m, text, w); }
  const lh = vel * riadkovanie;
  const x0 = zarovnanie === 'center' ? w / 2 : zarovnanie === 'right' ? w : 0;
  const s = sprite(dpr, w, lh * (riadky.length - 1) + vel * 1.32, (x) => {
    x.font = nun(vaha, vel); x.textBaseline = 'top'; x.textAlign = zarovnanie; x.fillStyle = farba;
    riadky.forEach((r, i) => x.fillText(r, x0, i * lh));
  });
  s.px = vel; s.riadky = riadky.length;
  return s;
}

/** Názov ako sprite (Ink ako nadpis v appke) plus zelená verzia na odlesk háku. */
function spriteNazvu(dpr, text, px, w, zarovnanie) {
  const m = platno(4, 4).getContext('2d');
  m.font = nun(800, px);
  const sirka = m.measureText(text).width;
  // rezerva 6 %: priblíženie háku (1,035) a presah písmen nesmú vyjsť z pásu w (v 9:16 najviac 0,74 W)
  const vel = sirka > w * 0.94 ? (px * w * 0.94) / sirka : px;
  const h = vel * 1.22;
  const x0 = zarovnanie === 'center' ? w / 2 : 0;
  const kresli = (farba) => (x) => { x.font = nun(800, vel); x.textBaseline = 'top'; x.textAlign = zarovnanie; x.fillStyle = farba; x.fillText(text, x0, 0); };
  const s = sprite(dpr, w, h, kresli(FARBA.ink));
  s.svetly = sprite(dpr, w, h, kresli('#5b8f97')).c; // odlesk: svetlejší Ink, nie iná farba
  s.px = vel;
  s.textW = (sirka * vel) / px; // pre tvrdý limit v HAK.kresliNazov
  return s;
}

/** Riadok s rozostupom písmen (malé zelené nadpisy ako WORDS TO FIND v appke). */
function spriteRozostup(dpr, text, px, farba, vaha = 600) {
  const m = platno(4, 4).getContext('2d');
  m.font = nun(vaha, px);
  if ('letterSpacing' in m) m.letterSpacing = `${px * 0.18}px`;
  const w = m.measureText(text).width + px * 0.4, h = px * 1.3;
  return sprite(dpr, w, h, (x) => {
    x.font = nun(vaha, px);
    if ('letterSpacing' in x) x.letterSpacing = `${px * 0.18}px`;
    x.textBaseline = 'top'; x.fillStyle = farba; x.fillText(text, 0, px * 0.1);
  });
}

function stavTexty(W, H, dpr, R) {
  const s = R.s, zar = R.stred ? 'center' : 'left', Z = R.Z;
  const m = platno(4, 4).getContext('2d');

  // --- titulky s farebným slovom (vyvážené zalomenie, bez siroty) ---
  const velTit = R.velTit, lh = velTit * 1.25;
  const titulky = TITULKY.map((tt) => {
    const cely = tt.text.map((a) => a[0]).join('');
    m.font = nun(700, velTit);
    const riadky = vyvazZalom(m, cely, R.tw);
    return { ...tt, sp: sprite(dpr, R.tw, lh * riadky.length + velTit * 0.35, (x) => {
      x.font = nun(700, velTit); x.textBaseline = 'top';
      const farbaZnaku = [];
      tt.text.forEach(([txt, f]) => { for (const _ of txt) farbaZnaku.push(f || FARBA.ink); });
      let idx = 0;
      riadky.forEach((riadok, ri) => {
        const w = x.measureText(riadok).width;
        let px = R.stred ? (R.tw - w) / 2 : 0;
        for (const ch of riadok) {
          while (cely[idx] !== ch && idx < cely.length) idx++;
          x.fillStyle = farbaZnaku[idx] || FARBA.ink;
          x.fillText(ch, px, ri * lh);
          px += x.measureText(ch).width;
          idx++;
        }
      });
    }) };
  });

  // --- hlavička príbehu: názov témy, počet nájdených, pilulka s písmenami ---
  const nadpis = spriteRiadku(dpr, 'Garden', R.velNad, R.hw * 0.6, { vaha: 800, zarovnanie: zar, maxRiadkov: 1 });
  const pocty = [0, 1, 2, 3, 4].map((n) => spriteRiadku(dpr, `${n}/4`, R.velNad * 0.72, R.velNad * 3, { vaha: 800, zarovnanie: 'right', maxRiadkov: 1 }));
  const pilulky = {};
  for (const sl of SLOVA) {
    for (let j = 1; j <= sl.w.length; j++) pilulky[`t:${sl.w}:${j}`] = spritePilulky(dpr, sl.w.slice(0, j), R.velPil, ACCENT, FARBA.ink);
    pilulky[`n:${sl.w}`] = spritePilulky(dpr, sl.w, R.velPil, FARBA.green, '#ffffff');
  }
  STYLY.forEach((st) => { pilulky[`s:${st}`] = spritePilulky(dpr, st.toUpperCase(), R.velPil, FARBA.ink, '#ffffff'); });

  // --- zoznam slov: WORDS TO FIND, mince, čipy (biely čip; nájdený = pás, prečiarknutý) ---
  const stitok = spriteRozostup(dpr, 'WORDS TO FIND', R.velStit, FARBA.green);
  const mince = [];
  for (let n = 50; n <= 65; n++) {
    mince.push(sprite(dpr, R.velMin * 7, R.velMin * 1.3, (x) => {
      x.font = nun(800, R.velMin); x.textBaseline = 'middle'; x.textAlign = 'right';
      x.fillStyle = FARBA.green;
      const txt = `${n} coins`, w = x.measureText(txt).width;
      x.fillText(txt, R.velMin * 7, R.velMin * 0.68);
      x.beginPath(); x.arc(R.velMin * 7 - w - R.velMin * 0.55, R.velMin * 0.66, R.velMin * 0.22, 0, Math.PI * 2); x.fill();
    }));
  }
  const vc = R.velCip, ch = vc * 2.1;
  const cipy = SLOVA.map((sl, i) => {
    m.font = nun(800, vc);
    const w = m.measureText(sl.w).width + vc * 1.7;
    const kresli = (najdeny) => (x) => {
      zaoblene(x, 0, 0, w, ch, ch * 0.3);
      x.fillStyle = najdeny ? rgba(FARBA.pasy[i], 0.62) : '#ffffff'; x.fill();
      x.font = nun(800, vc); x.textBaseline = 'middle'; x.textAlign = 'center';
      x.fillStyle = najdeny ? rgba(FARBA.ink, 0.55) : FARBA.ink;
      x.fillText(sl.w, w / 2, ch / 2 + vc * 0.05);
      if (najdeny) { x.fillRect(vc * 0.75, ch / 2 - vc * 0.05, w - vc * 1.5, Math.max(1, vc * 0.1)); }
    };
    return { w, h: ch, ink: sprite(dpr, w, ch, kresli(false)), hotovo: sprite(dpr, w, ch, kresli(true)) };
  });
  // rozloženie čipov do riadkov v šírke cw (v stĺpci na stred, na šírku vľavo)
  const medz = vc * 0.55, riadkyCipov = [[]];
  let sirka = 0;
  cipy.forEach((cp) => {
    const r = riadkyCipov[riadkyCipov.length - 1];
    if (r.length && sirka + medz + cp.w > R.cw) { riadkyCipov.push([cp]); sirka = cp.w; } else { r.push(cp); sirka += (r.length > 1 ? medz : 0) + cp.w; }
  });
  const cipH = R.velMin * 1.3 + s * 0.014 + riadkyCipov.length * ch + (riadkyCipov.length - 1) * medz;
  // v stĺpci rátalo rozloženie s jedným riadkom čipov; ak sa zalomia, titulok ide nižšie (nikdy cez čipy)
  if (R.stred && riadkyCipov.length > 1) R.tyTit += (riadkyCipov.length - 1) * (ch + medz);

  // na šírku: pravý stĺpec (hlavička, zoznam, titulok) zvislo na stred dosky
  if (!R.stred) {
    const capH = lh * 2 + velTit * 0.35;
    const spolu = R.hlavH + s * 0.05 + cipH + s * 0.07 + capH;
    R.hy = R.by + (R.B - spolu) / 2;
    R.cy = R.hy + R.hlavH + s * 0.05;
    R.tyTit = R.cy + cipH + s * 0.07;
  }
  const polohyCipov = new Array(cipy.length);
  let yc = R.cy + R.velMin * 1.3 + s * 0.014, k = 0;
  for (const r of riadkyCipov) {
    const rw = r.reduce((a, cp) => a + cp.w, 0) + medz * (r.length - 1);
    let xc = R.stred ? R.cx + (R.cw - rw) / 2 : R.cx;
    for (const cp of r) { polohyCipov[k++] = [xc, yc]; xc += cp.w + medz; }
    yc += ch + medz;
  }

  // --- karta dokončenej úrovne (MainActivity: Paper, zaoblenie 24dp, tieň) ---
  // karta zakryje celé dva dolné riadky (šírka vnútra dosky), aby z pásov nevytŕčali zvyšky
  const c = R.c, kw = R.B - 2 * R.pad, kh = c * 2.02;
  const karta = sprite(dpr, kw + c * 0.6, kh + c * 0.6, (x) => {
    x.translate(c * 0.3, c * 0.2);
    x.save();
    x.shadowColor = 'rgba(32,62,69,0.22)'; x.shadowBlur = c * 0.25; x.shadowOffsetY = c * 0.06;
    zaoblene(x, 0, 0, kw, kh, c * 0.3);
    x.fillStyle = FARBA.paper; x.fill();
    x.restore();
    x.font = nun(800, c * 0.33); x.textBaseline = 'top'; x.textAlign = 'left'; x.fillStyle = FARBA.ink;
    x.fillText('Level complete', c * 0.36, c * 0.3);
    x.font = nun(600, c * 0.24); x.fillStyle = FARBA.green;
    x.fillText('Every word found!', c * 0.36, c * 0.74);
    // pruh kapitoly (ako LinearProgressIndicator na karte): len dráha, bez vymysleného stavu
    zaoblene(x, c * 0.36, kh - c * 0.27, kw - c * 0.72, c * 0.07, c * 0.035);
    x.fillStyle = rgba(FARBA.green, 0.18); x.fill();
  });
  karta.kw = kw; karta.kh = kh;
  const plus = [];
  for (let n = 0; n <= 15; n++) {
    plus.push(sprite(dpr, c * 3.2, c * 0.52, (x) => {
      x.font = nun(800, c * 0.4); x.textBaseline = 'top'; x.textAlign = 'left'; x.fillStyle = FARBA.green;
      x.fillText(`+${n} coins`, 0, c * 0.04);
    }));
  }

  // --- záver (a hák v rovnakom zložení): názov, vety, tlačidlo, tiráž ---
  const nazov = spriteNazvu(dpr, 'Word Search', s * (R.stred ? 0.15 : 0.13), R.ew, zar);
  const veta = spriteRiadku(dpr, 'Find a word. Find your flow.', s * (R.stred ? 0.058 : 0.054), R.ew, { zarovnanie: zar, maxRiadkov: 1 });
  const mp = minPismo(W, H);
  const veta2 = spriteRiadku(dpr, 'Calm word puzzles in 150 topics.', Math.max(s * 0.04, mp), R.ew, { vaha: 600, farba: FARBA.green, zarovnanie: zar, maxRiadkov: 2 });
  // Appka ešte nie je v Google Play: len nápis bez pilulky a bez ▶ (nesmie vyzerať ako odznak obchodu),
  // pod ním čitateľná adresa (aspoň 40 px pri 1080). Veta pre vývojárov vypadla.
  const TXT = 'Coming soon to Google Play';
  m.font = nun(800, 100);
  const kB = m.measureText(TXT).width / 100;
  const velB = Math.max(mp * 1.1, Math.min(s * (R.stred ? 0.046 : 0.042), R.ew / kB));
  m.font = nun(800, velB);
  const bw = Math.min(R.ew, m.measureText(TXT).width), bh = velB * 1.35;
  const tlacidlo = sprite(dpr, bw + 8, bh + 8, (x) => {
    x.translate(4, 4);
    x.font = nun(800, velB); x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillStyle = rgba(FARBA.ink, 0.8);
    x.fillText(TXT, 0, bh / 2 + velB * 0.04);
  });
  const tiraz = spriteRiadku(dpr, 'arling.sk', Math.max(s * 0.07, mp * 1.25), R.ew, { vaha: 800, farba: FARBA.green, zarovnanie: zar, maxRiadkov: 1 });

  const gap = s * 0.03;
  const blokH = nazov.h + gap * 0.4 + veta.h + gap * 0.15 + veta2.h + gap + tlacidlo.h + gap * 0.4 + tiraz.h;
  let ey;
  if (R.stred) {
    const gB = s * 0.05;
    R.B2 = Math.min(R.B * 0.92, Z.h - blokH - gB);
    R.by2 = Z.y0 + (Z.h - (R.B2 + gB + blokH)) / 2;
    R.bx2 = (W - R.B2) / 2;
    ey = R.by2 + R.B2 + gB;
  } else {
    R.B2 = R.B; R.bx2 = R.bx; R.by2 = R.by;
    ey = Math.max(Z.y0, (H - blokH) / 2);
  }
  const pozicie = {};
  let y = ey;
  pozicie.nazov = y; y += nazov.h + gap * 0.4;
  pozicie.veta = y; y += veta.h + gap * 0.15;
  pozicie.veta2 = y; y += veta2.h + gap;
  pozicie.tlacidlo = y; y += tlacidlo.h + gap * 0.4;
  pozicie.tiraz = y;
  const btnX = R.stred ? (W - bw) / 2 : R.ex;
  return { titulky, nadpis, pocty, pilulky, stitok, mince, cipy, polohyCipov, karta, plus, nazov, veta, veta2, tiraz, tlacidlo, pozicie, btn: { x: btnX, y: pozicie.tlacidlo + 4, w: bw, h: bh } };
}

// ---------- stav v čase t (čisté funkcie) ----------

/** 1 = koncová poloha dosky (hák a záver), 0 = poloha príbehu. */
function polohaKonca(t) {
  if (t < HAK.koniec) return 1 - HAK.navrat(t);
  return ease.inOutCubic(okno(t, T.presunOd, T.presunDo));
}
/** Viditeľnosť rozhrania príbehu (hlavička, zoznam slov, titulky). */
const viditelnostUI = (t) => Math.min(ease.outCubic(okno(t, T.uiOd, T.uiDo)), 1 - ease.inOutQuad(okno(t, T.uiPrec, T.uiPrec + 0.4)));

/** Nájdenie slova i v čase t: null, alebo { f (čas nájdenia), g (rast pásu 0..1), a (alfa) }. */
function najdenie(i, t) {
  let f, a = 1;
  if (t < T.cistDo) {
    f = HAK_NAJDENE[i];
    a = 1 - ease.inOutQuad(okno(t, T.cistOd, T.cistDo));
  } else f = NAJDENE[i];
  if (f == null || t < f || a <= 0) return null;
  return { f, g: f < 0 ? 1 : ease.outCubic(okno(t, f, f + 0.25)), a };
}
const pocetNajdenych = (t) => (t < T.cistDo ? 0 : NAJDENE.filter((f) => f <= t).length);

/** Štýl zvýrazňovača v čase t: [predchádzajúci, aktuálny, prechod 0..1]. */
function stylV(t) {
  let pred = 0, akt = 0, od = -1;
  for (const [ts, st] of T.styly) if (t >= ts) { pred = akt; akt = st; od = ts; }
  return [pred, akt, od < 0 ? 1 : ease.inOutQuad(okno(t, od, od + 0.22)), od];
}

/** Aktívny ťah v čase t: { g, j (posledné dosiahnuté písmeno), tr (čas od jeho dosiahnutia) } alebo null. */
function tahV(t) {
  for (const g of GESTA) {
    if (t < g.tahOd || t >= g.najdene) continue;
    const n = SLOVA[g.s].w.length;
    const p = ease.inOutSine(okno(t, g.tahOd, g.tahDo));
    const j = Math.min(n - 1, Math.round(p * (n - 1)));
    return { g, j, tr: t - casPismena(g, j) };
  }
  return null;
}

/** Poloha prsta: { x, y, a (alfa), tlak } v súradniciach príbehu alebo null. */
function prstV(t) {
  const { R } = L, c = R.c;
  const stred = ([r, s]) => R.stred_(r, s);
  // prst prichádza a odchádza sprava zdola, nie zdola: nesmie ísť cez čipy a titulok pod doskou
  const von = (bunka) => { const [x, y] = stred(bunka); return [x + c * 1.8, y + c * 1.0]; };
  for (let i = 0; i < GESTA.length; i++) {
    const g = GESTA[i], sl = SLOVA[g.s], dalsi = GESTA[i + 1];
    const zac = g.prichod ? g.prichod[0] : -99;
    const kon = g.odchod ? g.odchod[1] : dalsi.prichod[0];
    if (t < zac || t >= kon) continue;
    const z = stred(sl.z), k = stred(sl.k);
    if (g.prichod && t < g.prichod[1]) {
      const pred = GESTA[i - 1];
      const odkial = pred && !pred.odchod ? stred(SLOVA[pred.s].k) : von(sl.z);
      const q = ease.inOutCubic(okno(t, g.prichod[0], g.prichod[1]));
      const a = pred && !pred.odchod ? 1 : ease.outCubic(okno(t, g.prichod[0], g.prichod[0] + 0.2));
      return { x: lerp(odkial[0], z[0], q), y: lerp(odkial[1], z[1], q), a, tlak: 0 };
    }
    if (t < g.tahOd) return { x: z[0], y: z[1], a: 1, tlak: okno(t, g.prichod ? g.prichod[1] : -1, g.tahOd) };
    if (t < g.tahDo) { const q = ease.inOutSine(okno(t, g.tahOd, g.tahDo)); return { x: lerp(z[0], k[0], q), y: lerp(z[1], k[1], q), a: 1, tlak: 1 }; }
    if (!g.odchod) return { x: k[0], y: k[1], a: 1, tlak: 1 - okno(t, g.tahDo, g.tahDo + 0.06) };
    if (t < g.odchod[0]) return { x: k[0], y: k[1], a: 1, tlak: 1 - okno(t, g.tahDo, g.odchod[0]) };
    const v = von(sl.k), q = ease.inCubic(okno(t, g.odchod[0], g.odchod[1]));
    return { x: lerp(k[0], v[0], q), y: lerp(k[1], v[1], q), a: 1 - ease.inQuad(okno(t, g.odchod[0] + (g.odchod[1] - g.odchod[0]) * 0.35, g.odchod[1])), tlak: 0 };
  }
  return null;
}

// ---------- kreslenie ----------

function kresliZvyraznenia(x, t) {
  const { R } = L, c = R.c;
  const [pred, akt, q] = stylV(t);
  SLOVA.forEach((sl, i) => {
    const n = najdenie(i, t);
    if (!n) return;
    const [ax, ay] = R.stred_(...sl.z), [bx, by] = R.stred_(...sl.k);
    const ex = lerp(ax, bx, n.g), ey = lerp(ay, by, n.g);
    if (q < 1) zvyrazni(x, FARBA.pasy[i], ax, ay, ex, ey, c, pred, n.a * (1 - q));
    zvyrazni(x, FARBA.pasy[i], ax, ay, ex, ey, c, akt, n.a * (q < 1 ? q : 1));
  });
  // ťah pod prstom: akcent témy s alfou 0,7 (Board.kt), od prvej po poslednú dosiahnutú bunku
  const tah = tahV(t);
  if (tah) {
    const sl = SLOVA[tah.g.s], [ax, ay] = R.stred_(...sl.z), [bx, by] = R.stred_(...sl.bunky[tah.j]);
    zvyrazni(x, ACCENT, ax, ay, bx, by, c, akt, 0.7);
  }
}

/** Mierka písmena: rastie písmeno pod prstom a písmená práve nájdeného slova stúpnu vo vlne. */
function kresliPismena(x, t) {
  const { R, pismena } = L, c = R.c;
  const biele = new Map(), vlna = new Map();
  SLOVA.forEach((sl, i) => {
    const n = najdenie(i, t);
    if (!n) return;
    sl.bunky.forEach(([r, s], j) => {
      const k = r * N + s;
      biele.set(k, Math.max(biele.get(k) || 0, n.a));
      if (n.f >= 0) {
        const q = okno(t, n.f + j * 0.06, n.f + j * 0.06 + 0.32);
        if (q > 0 && q < 1) vlna.set(k, Math.max(vlna.get(k) || 1, 1 + 0.24 * Math.sin(Math.PI * q)));
      }
    });
  });
  // záverečná vlna po celej doske (po uhlopriečkach), keď doska dosadne na koniec
  if (t > T.vlna && t < T.vlna + 1.2) {
    for (let r = 0; r < N; r++) for (let s = 0; s < N; s++) {
      const q = okno(t, T.vlna + (r + s) * 0.06, T.vlna + (r + s) * 0.06 + 0.4);
      if (q > 0 && q < 1) { const k = r * N + s; vlna.set(k, Math.max(vlna.get(k) || 1, 1 + 0.14 * Math.sin(Math.PI * q))); }
    }
  }
  const tah = tahV(t);
  let hlava = -1, rastHlavy = 1;
  if (tah) {
    const [r, s] = SLOVA[tah.g.s].bunky[tah.j];
    hlava = r * N + s;
    rastHlavy = 1.12 + 0.1 * (1 - ease.outCubic(okno(tah.tr, 0, 0.18)));
  }
  for (let r = 0; r < N; r++) for (let s = 0; s < N; s++) {
    const k = r * N + s, ch = MRIEZKA[r][s];
    const [cx, cy] = R.stred_(r, s);
    const m = k === hlava ? rastHlavy : vlna.get(k) || 1;
    const w = c * m;
    const b = biele.get(k) || 0;
    if (b < 1) x.drawImage(pismena[ch].ink, cx - w / 2, cy - w / 2, w, w);
    if (b > 0) {
      x.globalAlpha = b;
      x.drawImage(pismena[ch].biele, cx - w / 2, cy - w / 2, w, w);
      x.globalAlpha = 1;
    }
  }
}

function kresliPrst(x, t) {
  const p = prstV(t);
  if (!p || p.a <= 0) return;
  const { R, prst } = L, c = R.c;
  // ťuknutie: zelený kruh pod prstom (Board.kt: drawCircle(Green alfa .25, step*.4))
  if (p.tlak > 0) {
    x.fillStyle = rgba(FARBA.green, 0.22 * p.tlak * p.a);
    x.beginPath(); x.arc(p.x, p.y, c * (0.34 + 0.08 * p.tlak), 0, Math.PI * 2); x.fill();
  }
  const mierka = 1.05 - 0.05 * p.tlak;
  x.save();
  x.globalAlpha = p.a;
  x.translate(p.x + c * 0.05, p.y + c * 0.12);
  x.rotate(prst.uhol);
  x.scale(mierka, mierka);
  x.drawImage(prst.c, -prst.hrot[0], -prst.hrot[1], prst.w, prst.h);
  x.restore();
}

/** Konfety pri dokončení (Board.kt celebration): 36 krížikov vo farbách pásov, zlatý rez uhlov. */
function kresliKonfety(x, t) {
  const q = okno(t, T.konfety, T.konfety + 1.0);
  if (q <= 0 || q >= 1) return;
  const { R } = L, c = R.c, W = R.B - 2 * R.pad, x0 = R.bx + R.pad, y0 = R.by + R.pad;
  const e = ease.outCubic(q);
  x.lineCap = 'round';
  for (let i = 0; i < 36; i++) {
    const u = i * 2.39996, rad = W * (0.1 + 0.5 * e);
    const px = x0 + W / 2 + Math.cos(u) * rad, py = y0 + W / 2 + Math.sin(u) * rad + q * q * c;
    const r = c * 0.075 * (1 - q * 0.5);
    x.strokeStyle = rgba(FARBA.pasy[i % 8], 1 - q);
    x.lineWidth = r * 0.6 * 1.6;
    x.beginPath(); x.moveTo(px - r * 1.6, py); x.lineTo(px + r * 1.6, py); x.moveTo(px, py - r * 1.6); x.lineTo(px, py + r * 1.6); x.stroke();
  }
}

function kresliKartu(x, t) {
  const a = obalka(t, T.kartaOd, T.kartaDo, 0.35, 0.35);
  if (a <= 0) return;
  const { R, texty } = L, c = R.c, k = texty.karta;
  const vstup = ease.outCubic(okno(t, T.kartaOd, T.kartaOd + 0.4)), von = ease.inCubic(okno(t, T.kartaDo - 0.35, T.kartaDo));
  const kx = R.bx + R.pad, ky = R.by + R.pad + c * 3.92 + (1 - vstup) * c * 0.5 + von * c * 0.4;
  x.globalAlpha = a;
  x.drawImage(k.c, kx - c * 0.3, ky - c * 0.2, k.w, k.h);
  const n = Math.round(15 * okno(t, T.minceOd, T.minceDo));
  const sp = texty.plus[n];
  x.drawImage(sp.c, kx + c * 0.36, ky + c * 1.08, sp.w, sp.h);
  // pruh kapitoly sa naplní o jednu úroveň z desiatich (jedna úroveň = desatina kapitoly)
  const pr = ease.inOutCubic(okno(t, T.minceOd, T.minceOd + 0.6)) * 0.1;
  if (pr > 0) {
    zaoblene(x, kx + c * 0.36, ky + k.kh - c * 0.27, Math.max(c * 0.07, (k.kw - c * 0.72) * pr), c * 0.07, c * 0.035);
    x.fillStyle = FARBA.green; x.fill();
  }
  x.globalAlpha = 1;
}

function kresliUI(x, t) {
  const a = viditelnostUI(t);
  if (a <= 0) return;
  const { R, texty } = L;
  x.globalAlpha = a;
  // hlavička: téma, počet
  const nd = texty.nadpis;
  x.drawImage(nd.c, R.stred ? R.hx + (R.hw - nd.w) / 2 : R.hx, R.hy, nd.w, nd.h);
  const pc = texty.pocty[pocetNajdenych(t)];
  x.drawImage(pc.c, R.hx + R.hw - pc.w - R.s * 0.005, R.hy + R.velNad * 0.22, pc.w, pc.h);
  // pilulka: písmená pod prstom, verdikt, alebo názov štýlu zvýrazňovača
  const yP = R.hy + R.velNad * 1.2 + R.s * 0.012;
  let pil = null, mierka = 1, pa = 1;
  const tah = tahV(t);
  if (tah) pil = texty.pilulky[`t:${SLOVA[tah.g.s].w}:${tah.j + 1}`];
  else {
    for (const g of GESTA.slice(1)) {
      const d = t - g.najdene;
      if (d >= 0 && d < 0.72) { pil = texty.pilulky[`n:${SLOVA[g.s].w}`]; mierka = 1 + 0.12 * Math.sin(Math.PI * obmedz(d / 0.2)); pa = 1 - okno(d, 0.56, 0.72); }
    }
    const [, akt, , od] = stylV(t);
    if (od > 0 && t < T.uiPrec + 0.4) { pil = texty.pilulky[`s:${STYLY[akt]}`]; const d = t - od; mierka = 1 + 0.1 * Math.sin(Math.PI * obmedz(d / 0.22)); pa = 1; }
  }
  if (pil && pa > 0) {
    const w = pil.w * mierka, h = pil.h * mierka;
    const px = R.stred ? R.hx + R.hw / 2 - w / 2 : R.hx - (w - pil.w) / 2;
    x.globalAlpha = a * pa;
    x.drawImage(pil.c, px, yP + (pil.h - h) / 2, w, h);
    x.globalAlpha = a;
  }
  // zoznam slov
  const st = texty.stitok;
  x.drawImage(st.c, R.cx + (R.stred ? R.s * 0.012 : 0), R.cy + R.velMin * 0.2, st.w, st.h);
  const n = 50 + Math.round(15 * okno(t, T.minceOd, T.minceDo));
  const mn = texty.mince[n - 50];
  x.drawImage(mn.c, R.cx + R.cw - mn.w - (R.stred ? R.s * 0.012 : 0), R.cy, mn.w, mn.h);
  texty.cipy.forEach((cp, i) => {
    const [px, py] = texty.polohyCipov[i];
    const f = NAJDENE[i], q = t >= f ? ease.outCubic(okno(t, f + 0.1, f + 0.35)) : 0;
    if (q < 1) x.drawImage(cp.ink.c, px, py, cp.w, cp.h);
    if (q > 0) { x.globalAlpha = a * q; x.drawImage(cp.hotovo.c, px, py, cp.w, cp.h); x.globalAlpha = a; }
  });
  x.globalAlpha = 1;
}

function kresliTexty(x, t) {
  const { R, texty } = L;
  const { titulky, pozicie } = texty;
  // hák: názov a vety od prvej snímky na mieste záverečného bloku
  if (t < HAK.koniec) {
    HAK.kresliNazov(x, t, texty.nazov, R.ex, pozicie.nazov);
    HAK.kresliRiadok(x, t, texty.veta, R.ex, pozicie.veta);
    HAK.kresliRiadok(x, t, texty.veta2, R.ex, pozicie.veta2, 0.14);
  }
  for (const tt of titulky) {
    const a = obalka(t, tt.od, tt.do, 0.35, 0.3);
    if (a <= 0) continue;
    const vstup = ease.outCubic(okno(t, tt.od, tt.od + 0.45));
    x.globalAlpha = a;
    x.drawImage(tt.sp.c, R.tx, R.tyTit + (1 - vstup) * R.s * 0.02, tt.sp.w, tt.sp.h);
    x.globalAlpha = 1;
  }
  // záver: názov stúpa spoza masky, potom vety, tlačidlo a tiráž
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
  // adresa arling.sk
  vyjdi(texty.tiraz, T.tiraz, pozicie.tiraz, 0.6);
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

const film = {
  dlzka: DLZKA,
  plagat: 1.0,
  titulky: [
    { od: 0, text: 'Word Search. A finger swipes across the top row of a letter board and finds the word daisy. Find a word. Find your flow. Calm word puzzles in 150 topics.' },
    { od: 1.3, text: 'The highlights fade and the board of the Garden topic is ready. Four words to find: daisy, fern, rose, tulip.' },
    { od: 2.2, text: 'Swipe across the letters to find a word. The finger finds tulip.' },
    { od: 5.1, text: 'Later levels hide words in all eight directions. The finger finds fern on a diagonal.' },
    { od: 7.4, text: 'Rose runs upward, then daisy across the top. Every word is found.' },
    { od: 9.35, text: 'Level complete. Finish a level, earn coins: plus 15 coins, counted out one by one.' },
    { od: 12.15, text: 'Coins unlock new highlighter styles: Chalk, Marker, Stitch and Ribbon, then Classic again.' },
    { od: 16.15, text: 'Word Search. Find a word. Find your flow. Calm word puzzles in 150 topics. Coming soon to Google Play. arling.sk' },
  ],
  async pripravit() {
    await nacitajPisma(import.meta.url);
    if (document.fonts && document.fonts.load) {
      await Promise.all([400, 600, 700, 800].map((v) => document.fonts.load(nun(v, 40)))).catch(() => {});
    }
  },
  vrstvy: stavVrstiev,
  kresli(x, t, W, H, env) {
    x.drawImage(L.poz, 0, 0, W, H);
    kresliUI(x, t);
    // skupina dosky: v háku a na konci menšia v koncovej polohe, počas príbehu veľká
    const R = L.R, pp = polohaKonca(t);
    const k = lerp(1, R.B2 / R.B, pp);
    x.save();
    if (pp > 0) { x.translate(lerp(R.bx, R.bx2, pp) - R.bx * k, lerp(R.by, R.by2, pp) - R.by * k); x.scale(k, k); }
    x.drawImage(L.doska, 0, 0, W, H);
    kresliZvyraznenia(x, t);
    kresliKonfety(x, t);
    kresliPismena(x, t);
    kresliKartu(x, t);
    kresliPrst(x, t);
    x.restore();
    kresliTexty(x, t);
    kresliZrno(x, t, env);
  },
  // tlačidlo prehrať na plagáte: stred dosky v koncovej polohe
  stredPlagatu() { const R = L.R; return [R.bx2 + R.B2 / 2, R.by2 + R.B2 / 2]; },
  // Word Search ešte nie je v Google Play: tlačidlo nevedie do obchodu, ale na odsek o appke na tejto stránke.
  odkazy() {
    const b = L.texty.btn;
    return [{ x: b.x, y: b.y, w: b.w, h: b.h, href: '#about', text: 'Coming soon to Google Play. About Word Search', od: T.tlacidlo, udalost: 'word_search_film_about' }];
  },
  zvuk: partitura(),
};

function partitura() {
  const u = [];
  const PENTA = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6'];
  // hák: zvuk od prvej snímky (engine), pod ním tóny písmen DAISY
  u.push(...HAK.zvuk({ akord: ['C3', 'G3', 'E4', 'G4'], zvony: ['C5', 'G5', 'C6'], hlas: 0.8 }));
  // ťahy: každé dosiahnuté písmeno svoj tón (pentatonika nahor), nájdené slovo akord a ťuk
  GESTA.forEach((g, gi) => {
    const sl = SLOVA[g.s];
    for (let j = 0; j < sl.w.length; j++) {
      const t = casPismena(g, j) + (gi === 0 && j === 0 ? 0.03 : 0);
      u.push({ t, typ: 'zvon', f: PENTA[j], pomer: 3, index: 0.35, dlzka: 0.45, hlas: 0.07, pan: -0.3 + j * 0.15, dozvuk: 0.25 });
      u.push({ t, typ: 'tuk', f: 420, dlzka: 0.04, hlas: 0.03 });
    }
    const t = g.najdene;
    ['C5', 'E5', 'G5'].forEach((f, i) => u.push({ t: t + i * 0.03, typ: 'zvon', f, index: 0.8, dlzka: 1.4, hlas: 0.09, pan: -0.2 + i * 0.2, dozvuk: 0.45 }));
    u.push({ t: t + 0.09, typ: 'zvon', f: 'C6', pomer: 3.5, index: 0.6, dlzka: 1.0, hlas: 0.04, dozvuk: 0.5 });
    u.push({ t, typ: 'tuk', f: 200, dlzka: 0.1, hlas: 0.08 });
  });
  // hák odchádza: doska sa vyprázdni
  ['G5', 'E5', 'D5', 'C5'].forEach((f, i) => u.push({ t: T.cistOd + 0.03 + i * 0.07, typ: 'zvon', f, index: 0.4, dlzka: 0.5, hlas: 0.035, pan: 0.3 - i * 0.2, dozvuk: 0.3 }));
  // plochy pod príbehom: C, potom Am pri šikmom slove, F pred dokončením, C na karte
  u.push({ t: 1.8, typ: 'pad', noty: ['C3', 'G3', 'E4', 'G4'], dlzka: 3.6, nabeh: 1.0, dobeh: 1.0, hlas: 0.12, filter: 800, filter2: 1200 });
  u.push({ t: 4.9, typ: 'pad', noty: ['A2', 'E3', 'C4', 'E4'], dlzka: 3.0, nabeh: 0.8, dobeh: 0.9, hlas: 0.12, filter: 800 });
  u.push({ t: 7.3, typ: 'pad', noty: ['F2', 'C3', 'A3', 'E4'], dlzka: 2.3, nabeh: 0.6, dobeh: 0.6, hlas: 0.12, filter: 900 });
  // dokončenie: zvonkohra úrovne, trblietanie konfiet
  ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((f, i) => u.push({ t: T.konfety + i * 0.08, typ: 'zvon', f, index: 0.9, dlzka: 1.6, hlas: 0.1 - i * 0.01, pan: -0.4 + i * 0.2, dozvuk: 0.55 }));
  u.push({ t: T.konfety, typ: 'sum', filter: 'highpass', f0: 6000, f1: 9000, dlzka: 1.1, hlas: 0.035, dozvuk: 0.6 });
  u.push({ t: T.konfety, typ: 'pad', noty: ['C3', 'G3', 'E4', 'G4', 'D5'], dlzka: 3.0, nabeh: 0.2, dobeh: 1.6, hlas: 0.16, filter: 1500, filter2: 900 });
  // mince sa počítajú nahlas ako v appke (Feel.coinTicks: 15 mincí = 3 ťuky, o dva poltóny vyššie)
  for (let k = 0; k < 3; k++) {
    const f = 880 * Math.pow(2, (-5 + 2 * k) / 12);
    u.push({ t: T.minceOd + k * 0.2, typ: 'zvon', f, pomer: 2, index: 0.5, dlzka: 0.35, hlas: 0.09, dozvuk: 0.2 });
    u.push({ t: T.minceOd + k * 0.2, typ: 'tuk', f: 700, dlzka: 0.03, hlas: 0.04 });
  }
  // zvýrazňovače: každá zmena štýlu švih a tón
  u.push({ t: 12.1, typ: 'pad', noty: ['C3', 'G3', 'D4', 'E4'], dlzka: 3.6, nabeh: 0.7, dobeh: 1.0, hlas: 0.11, filter: 1000 });
  const TONY_STYLOV = ['G5', 'A5', 'C6', 'D6', 'E6', 'C6'];
  T.styly.forEach(([t], i) => {
    u.push({ t: t - 0.04, typ: 'sum', filter: 'bandpass', f0: 1800, f1: 5200, q: 0.8, dlzka: 0.24, nabeh: 0.08, tvar: 'narast', hlas: 0.05, dozvuk: 0.2 });
    u.push({ t, typ: 'zvon', f: TONY_STYLOV[i], index: 0.6, dlzka: 0.9, hlas: 0.06, pan: -0.4 + i * 0.16, dozvuk: 0.45 });
  });
  // presun do záveru, názov a tlačidlo
  u.push({ t: T.presunOd, typ: 'sum', filter: 'bandpass', f0: 900, f1: 3000, q: 0.6, dlzka: 0.6, nabeh: 0.3, tvar: 'narast', hlas: 0.05, dozvuk: 0.3 });
  u.push({ t: T.nazov, typ: 'pad', noty: ['C2', 'G2', 'E3', 'G3', 'D4', 'E4'], dlzka: 3.8, nabeh: 0.3, dobeh: 2.4, hlas: 0.18, filter: 1500, filter2: 800 });
  ['C6', 'D6', 'E6', 'G6', 'A6', 'C7'].forEach((n, i) => u.push({ t: T.vlna + i * 0.08, typ: 'zvon', f: n, index: 0.5, dlzka: 1.6, hlas: 0.04, pan: -0.5 + i * 0.2, dozvuk: 0.6 }));
  u.push({ t: T.nazov, typ: 'zvon', f: 'C4', index: 0.5, dlzka: 3.5, hlas: 0.13, dozvuk: 0.55 });
  u.push({ t: T.nazov + 0.02, typ: 'zvon', f: 'G4', index: 0.4, dlzka: 3.0, hlas: 0.06, dozvuk: 0.55 });
  u.push({ t: T.veta, typ: 'zvon', f: 'E5', index: 0.4, dlzka: 1.6, hlas: 0.05, dozvuk: 0.5 });
  u.push({ t: T.tlacidlo + 0.1, typ: 'tuk', f: 320, dlzka: 0.07, hlas: 0.06 });
  u.push({ t: T.tlacidlo + 0.1, typ: 'zvon', f: 'E6', index: 0.5, dlzka: 0.9, hlas: 0.05, dozvuk: 0.5 });
  return u;
}

export default film;
