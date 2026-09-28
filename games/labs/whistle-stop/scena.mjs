/* Whistle Stop M0: kreslenie scény kódom do vyrovnávacích plátien (GDD 4.1 až 4.4, 5.4).
   Všetko tu sa volá len pri zmene (stupeň fasády, deň a noc, rozmer, strata kontextu), nikdy každú snímku.
   Žiadne createPattern, tiene, filtre, source-in ani prechody farieb (poučenia Village pre Firefox).
   Svet: zem je y = 0, hore záporné y; pozemok budovy má šírku 720 (kamera.mjs POZEMOK). */
import { POZEMOK, KROK, dlzkaUlice } from './kamera.mjs';
import { nahoda } from './babky.mjs';

export const PISMO = '"ARLing Draw Text", system-ui, sans-serif';
export const OBRYS = 4;                 // hrúbka obrysu v jednotkách sveta
export const OKRAJ_BUDOVY = { x0: -80, x1: POZEMOK + 80, y0: -1640, y1: 60 };

// ---------- pomocné ----------

function obrys(ctx, P, w = OBRYS) { ctx.lineWidth = w; ctx.strokeStyle = P.atrament; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
function plocha(ctx, P, farba, w = OBRYS) { ctx.fillStyle = farba; ctx.fill(); obrys(ctx, P, w); }
// hrubka 0 = len výplň (lineWidth 0 plátno ignoruje a nechá predošlú hrúbku, preto sa obrys vtedy nekreslí vôbec)
function obdlz(ctx, P, x, y, w, h, farba, hrubka = OBRYS) {
  ctx.beginPath(); ctx.rect(x, y, w, h);
  if (hrubka > 0) plocha(ctx, P, farba, hrubka); else { ctx.fillStyle = farba; ctx.fill(); }
}

// Vláknina papiera: drobné svetlé a tmavé škvrnky v ploche, kreslené raz (nie vzorová výplň, GDD 4.1).
function vlaknina(ctx, x, y, w, h, hustota, seed, svetla, tmava) {
  const r = nahoda(seed);
  const n = Math.floor((w * h) / 1000 * hustota);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = r() < 0.5 ? svetla : tmava;
    ctx.globalAlpha = 0.18 + r() * 0.14;
    const d = 1.5 + r() * 3.5;
    ctx.fillRect(x + r() * w, y + r() * h, d, d * (0.4 + r() * 0.6));
  }
  ctx.globalAlpha = 1;
}

// Doskové steny: zvislé škáry ako tenké plné obdĺžniky (nie čiara vzorom).
function dosky(ctx, P, x, y, w, h, krok = 44, farba = null) {
  ctx.fillStyle = farba || P.hlina;
  for (let xx = x + krok; xx < x + w - 6; xx += krok) ctx.fillRect(xx - 1.2, y + 4, 2.4, h - 8);
}

function okno(ctx, P, x, y, w, h, noc, priecky = true) {
  obdlz(ctx, P, x - 10, y - 10, w + 20, h + 20, P.drevo);
  obdlz(ctx, P, x, y, w, h, noc ? P.lampa : P.nebo);
  if (!noc) { ctx.fillStyle = P.papier; ctx.globalAlpha = 0.55; ctx.fillRect(x + 8, y + 8, w * 0.18, h - 16); ctx.globalAlpha = 1; }
  if (priecky) { ctx.fillStyle = P.atrament; ctx.fillRect(x + w / 2 - 2.5, y, 5, h); ctx.fillRect(x, y + h / 2 - 2.5, w, 5); }
}

function stit(ctx, P, text, x, y, w, h, velkost) {
  obdlz(ctx, P, x, y, w, h, P.papier);
  ctx.fillStyle = P.atrament; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `600 ${velkost}px ${PISMO}`;
  let v = velkost;
  while (ctx.measureText(text).width > w - 36 && v > 20) { v -= 2; ctx.font = `600 ${v}px ${PISMO}`; }
  ctx.fillText(text, x + w / 2, y + h / 2 + v * 0.06);
}

// Postava za pultom v okne (hlava a plecia), pracovník obchodu.
function pracovnikVOkne(ctx, P, x, y, farba) {
  ctx.beginPath(); ctx.moveTo(x - 26, y + 60); ctx.lineTo(x - 20, y + 22); ctx.lineTo(x + 20, y + 22); ctx.lineTo(x + 26, y + 60); ctx.closePath();
  plocha(ctx, P, farba, 3);
  ctx.beginPath(); ctx.arc(x, y + 6, 15, 0, Math.PI * 2); plocha(ctx, P, '#D9A27A', 3);
  ctx.beginPath(); ctx.rect(x - 22, y - 12, 44, 5); ctx.moveTo(x - 12, y - 12); ctx.lineTo(x - 10, y - 26); ctx.lineTo(x + 10, y - 26); ctx.lineTo(x + 12, y - 12); plocha(ctx, P, P.hlina, 3);
}

// Manažér sedí na stoličke vedľa dverí (najatý človek, ktorý ťuká za hráča).
function manazer(ctx, P, x) {
  obdlz(ctx, P, x - 30, -70, 60, 10, P.drevo, 3);
  obdlz(ctx, P, x - 26, -60, 8, 60, P.drevo, 3); obdlz(ctx, P, x + 18, -60, 8, 60, P.drevo, 3);
  obdlz(ctx, P, x + 18, -150, 8, 80, P.drevo, 3);
  ctx.beginPath(); ctx.moveTo(x - 20, -72); ctx.lineTo(x - 44, -72); ctx.lineTo(x - 46, -4); ctx.lineTo(x - 34, -4); ctx.lineTo(x - 32, -60); ctx.lineTo(x - 10, -60); ctx.closePath(); plocha(ctx, P, P.atrament, 3);
  ctx.beginPath(); ctx.moveTo(x - 20, -72); ctx.lineTo(x - 16, -132); ctx.lineTo(x + 14, -132); ctx.lineTo(x + 16, -72); ctx.closePath(); plocha(ctx, P, P.skala, 3);
  ctx.beginPath(); ctx.arc(x, -148, 14, 0, Math.PI * 2); plocha(ctx, P, '#B7825C', 3);
  ctx.beginPath(); ctx.ellipse(x, -160, 26, 5, 0, 0, Math.PI * 2); ctx.moveTo(x - 10, -160); ctx.lineTo(x - 8, -178); ctx.lineTo(x + 8, -178); ctx.lineTo(x + 10, -160); plocha(ctx, P, P.papier, 3);
}

// ---------- budovy ----------

// Výška stien obchodu podľa stupňa fasády (GDD 2.6): prízemie 540, poschodie 300.
export function poschodiObchodu(stupen) { return stupen >= 7 ? 2 : stupen >= 4 ? 1 : 0; }
export function vyskaObchodu(stupen) {
  if (stupen <= 0) return 60;
  if (stupen === 1) return 440;
  return 540 + 300 * poschodiObchodu(stupen) + 240;
}

export function kresliObchod(ctx, P, st, { noc = false, pracovnici = 1, man = false } = {}) {
  if (st === 0) {
    for (const x of [60, 300, 420, 660]) obdlz(ctx, P, x - 6, -60, 12, 64, P.drevo, 3);
    ctx.beginPath(); ctx.moveTo(60, -50); ctx.lineTo(660, -50); obrys(ctx, P, 2);
    return;
  }
  if (st === 1) {
    // drevená búda so stieškou a okienkom, tabuľka STORE
    ctx.beginPath(); ctx.moveTo(90, -330); ctx.lineTo(630, -330); ctx.lineTo(630, 0); ctx.lineTo(90, 0); ctx.closePath(); plocha(ctx, P, P.drevo);
    vlaknina(ctx, 90, -330, 540, 330, 1.2, 11, P.piesok, P.hlina);
    dosky(ctx, P, 90, -330, 540, 330, 45);
    ctx.beginPath(); ctx.moveTo(60, -318); ctx.lineTo(360, -420); ctx.lineTo(660, -318); ctx.closePath(); plocha(ctx, P, P.hlina);
    okno(ctx, P, 150, -230, 150, 110, noc);
    ctx.beginPath(); ctx.moveTo(130, -250); ctx.lineTo(320, -250); ctx.lineTo(340, -210); ctx.lineTo(110, -210); ctx.closePath(); plocha(ctx, P, P.skala);
    obdlz(ctx, P, 420, -250, 120, 250, P.hlina);
    obdlz(ctx, P, 80, -120, 240, 26, P.drevo);        // pult pred okienkom
    for (let i = 0; i < Math.min(2, pracovnici); i++) pracovnikVOkne(ctx, P, 195 + i * 60, -210, P.salvia);
    stit(ctx, P, 'STORE', 360 - 110, -400, 220, 60, 40);
    if (man) manazer(ctx, P, 590);
    return;
  }
  const posch = poschodiObchodu(st);
  const hore = -540 - 300 * posch;
  const tehla = st >= 6, farebna = st >= 5;
  const stena = farebna ? P.papier : P.drevo;
  // prízemie
  obdlz(ctx, P, 0, -540, POZEMOK, 540, tehla ? P.skala : stena);
  if (tehla) {
    ctx.fillStyle = P.hlina;
    for (let r = 0, y = -540 + 36; y < 0; y += 36, r++) {
      ctx.fillRect(4, y - 1.5, POZEMOK - 8, 3);
      for (let x = (r % 2 ? 40 : 0) + 80; x < POZEMOK; x += 80) ctx.fillRect(x - 1.5, y - 36 + 3, 3, 30);
    }
  } else {
    vlaknina(ctx, 0, -540, POZEMOK, 540, 1.0, 21, P.papier, P.hlina);
    dosky(ctx, P, 0, -540, POZEMOK, 540, 48, farebna ? P.piesok : P.hlina);
  }
  // poschodia
  for (let p = 0; p < posch; p++) {
    const y = -540 - 300 * (p + 1);
    obdlz(ctx, P, 20, y, POZEMOK - 40, 300, stena);
    vlaknina(ctx, 20, y, POZEMOK - 40, 300, 1.0, 31 + p, P.papier, P.hlina);
    dosky(ctx, P, 20, y, POZEMOK - 40, 300, 48, farebna ? P.piesok : P.hlina);
    for (const x of [90, 300, 510]) okno(ctx, P, x, y + 70, 120, 150, noc);
    obdlz(ctx, P, 10, y + 288, POZEMOK - 20, 16, P.hlina);
  }
  // falošné čelo so štítom
  ctx.beginPath();
  ctx.moveTo(30, hore); ctx.lineTo(30, hore - 180); ctx.lineTo(160, hore - 180); ctx.lineTo(200, hore - 240);
  ctx.lineTo(520, hore - 240); ctx.lineTo(560, hore - 180); ctx.lineTo(690, hore - 180); ctx.lineTo(690, hore); ctx.closePath();
  plocha(ctx, P, farebna ? P.skala : P.drevo);
  vlaknina(ctx, 30, hore - 240, 660, 240, 1.0, 41, P.papier, P.hlina);
  stit(ctx, P, 'GENERAL STORE', 110, hore - 200, 500, 120, 64);
  // výklady a dvere
  okno(ctx, P, 60, -420, 200, 220, noc, false);
  okno(ctx, P, 460, -420, 200, 220, noc, false);
  // tovar vo výkladoch: police s pohármi, vrecami a plechovkami
  const rt = nahoda(61);
  for (const wx of [60, 460]) for (const py of [-352, -268]) {
    ctx.fillStyle = P.hlina; ctx.fillRect(wx, py, 200, 8);
    for (let x = wx + 10; x < wx + 186;) {
      const w = 16 + rt() * 18, h = 20 + rt() * 34, c = [P.skala, P.salvia, P.papier, P.lampa, P.drevo][Math.floor(rt() * 5)];
      obdlz(ctx, P, x, py - h, w, h, c, 2);
      x += w + 4 + rt() * 10;
    }
  }
  // markízy nad výkladmi: ploché pásy papiera a skaly
  if (st === 2) for (const wx of [50, 450]) {   // od verandy (25) kryje výklady jej strieška
    for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? P.papier : P.skala; ctx.fillRect(wx + k * 220 / 6, -470, 220 / 6 + 0.5, 44); }
    ctx.beginPath(); ctx.rect(wx, -470, 220, 44); obrys(ctx, P, 3);
  }
  for (let i = 0; i < pracovnici; i++) pracovnikVOkne(ctx, P, 110 + (i % 2) * 100 + (i >= 2 ? 360 : 0), -330, i % 2 ? P.skala : P.salvia);
  obdlz(ctx, P, 40, -200, 240, 22, P.drevo); obdlz(ctx, P, 440, -200, 240, 22, P.drevo);   // parapety a pult
  obdlz(ctx, P, 300, -300, 120, 300, P.hlina);
  obdlz(ctx, P, 318, -280, 84, 110, noc ? P.lampa : P.nebo, 3);
  ctx.beginPath(); ctx.arc(396, -140, 6, 0, Math.PI * 2); plocha(ctx, P, P.lampa, 2);
  // tovar na chodníku: vrecia múky pri dverách a sud s lopatkou
  for (const [x, y, c] of [[250, -70, P.papier], [226, -40, P.papier], [270, -40, P.piesok]]) {
    ctx.beginPath(); ctx.moveTo(x - 18, y + 40); ctx.lineTo(x - 14, y + 4); ctx.quadraticCurveTo(x, y - 8, x + 14, y + 4); ctx.lineTo(x + 18, y + 40); ctx.closePath(); plocha(ctx, P, c, 3);
  }
  obdlz(ctx, P, 440, -96, 70, 96, P.drevo, 3); ctx.fillStyle = P.atrament; ctx.fillRect(440, -74, 70, 5); ctx.fillRect(440, -30, 70, 5);
  obdlz(ctx, P, 446, -104, 58, 12, P.lampa, 3);
  // veranda so stĺpmi
  if (st >= 3) {
    // strieška verandy nad výkladmi (pod poschodím), stĺpy mimo okien
    ctx.beginPath(); ctx.moveTo(-40, -512); ctx.lineTo(POZEMOK + 40, -512); ctx.lineTo(POZEMOK + 60, -474); ctx.lineTo(-60, -474); ctx.closePath();
    plocha(ctx, P, farebna ? P.hlina : P.skala);
    ctx.fillStyle = P.atrament; for (let x = -40; x < POZEMOK + 40; x += 40) ctx.fillRect(x, -474, 3, 10);
    for (const x of [-26, 284, 436, POZEMOK + 26]) obdlz(ctx, P, x - 9, -474, 18, 474, P.drevo, 3);
    ctx.beginPath(); ctx.moveTo(360, -474); ctx.lineTo(360, -448); obrys(ctx, P, 3);
    ctx.beginPath(); ctx.rect(346, -448, 28, 34); plocha(ctx, P, noc ? P.lampa : P.papier, 3);
  }
  // balkón s zábradlím na prvom poschodí
  if (st >= 5 && posch >= 1) {
    obdlz(ctx, P, -10, -566, POZEMOK + 20, 20, P.hlina);
    ctx.fillStyle = P.atrament;
    for (let x = 0; x <= POZEMOK; x += 30) ctx.fillRect(x - 2.5, -640, 5, 76);
    obdlz(ctx, P, -10, -650, POZEMOK + 20, 12, P.drevo, 3);
  }
  if (man) manazer(ctx, P, 560);
}

export function kresliStudnu(ctx, P, { noc = false } = {}) {
  // veža veterníka (bez lopatiek, tie sa točia zvlášť)
  ctx.fillStyle = P.atrament;
  const nohy = [[470, 0, 540, -700], [650, 0, 580, -700]];
  for (const [x0, y0, x1, y1] of nohy) { ctx.beginPath(); ctx.moveTo(x0 - 7, y0); ctx.lineTo(x1 - 5, y1); ctx.lineTo(x1 + 5, y1); ctx.lineTo(x0 + 7, y0); ctx.closePath(); plocha(ctx, P, P.drevo, 3); }
  for (let i = 1; i < 6; i++) {
    const t = i / 6, y = -700 * t, xa = 470 + (540 - 470) * t, xb = 650 + (580 - 650) * t;
    ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y - 110); ctx.lineWidth = 4; ctx.strokeStyle = P.hlina; ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(560, -720); ctx.lineTo(700, -700); ctx.lineTo(700, -660); ctx.lineTo(560, -690); ctx.closePath(); plocha(ctx, P, P.skala, 3);   // chvost
  // drevená nádrž
  obdlz(ctx, P, 90, -330, 170, 150, P.drevo);
  ctx.fillStyle = P.atrament; ctx.fillRect(90, -300, 170, 5); ctx.fillRect(90, -220, 170, 5);
  obdlz(ctx, P, 100, -180, 12, 180, P.drevo, 3); obdlz(ctx, P, 238, -180, 12, 180, P.drevo, 3);
  // kamenná studňa so strieškou
  obdlz(ctx, P, 250, -120, 220, 120, P.piesok);
  const r = nahoda(7);
  for (let row = 0; row < 3; row++) for (let i = 0; i < 5; i++) {
    const x = 256 + i * 43 + (row % 2) * 20, y = -114 + row * 38;
    if (x + 36 > 466) continue;
    ctx.beginPath(); ctx.rect(x, y, 34 + r() * 4, 30); plocha(ctx, P, row % 2 ? P.papier : P.piesok, 2);
  }
  obdlz(ctx, P, 270, -330, 14, 212, P.drevo, 3); obdlz(ctx, P, 436, -330, 14, 212, P.drevo, 3);
  ctx.beginPath(); ctx.moveTo(240, -320); ctx.lineTo(360, -400); ctx.lineTo(480, -320); ctx.closePath(); plocha(ctx, P, P.hlina);
  obdlz(ctx, P, 280, -266, 160, 12, P.drevo, 3);
  ctx.beginPath(); ctx.moveTo(360, -254); ctx.lineTo(360, -200); ctx.lineWidth = 3; ctx.strokeStyle = P.atrament; ctx.stroke();
  obdlz(ctx, P, 340, -200, 40, 36, P.drevo, 3);
  // koryto pre kone
  obdlz(ctx, P, 520, -60, 160, 50, P.drevo); obdlz(ctx, P, 530, -54, 140, 12, noc ? P.noc : P.nebo, 2);
  stit(ctx, P, 'WELL', 300, -470, 120, 50, 34);
}

// Lopatky veterníka: nakreslia sa raz do malého plátna a snímka ich len otáča.
export const VETERNIK = { x: 560, y: -720, r: 150 };
export function kresliLopatky(ctx, P) {
  for (let i = 0; i < 12; i++) {
    ctx.save(); ctx.rotate(i * Math.PI / 6);
    ctx.beginPath(); ctx.moveTo(12, -8); ctx.lineTo(VETERNIK.r, -20); ctx.lineTo(VETERNIK.r, 20); ctx.lineTo(12, 8); ctx.closePath();
    plocha(ctx, P, i % 2 ? P.papier : P.piesok, 3);
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); plocha(ctx, P, P.hlina, 3);
}

export function kresliHolica(ctx, P, { noc = false } = {}) {
  // steny holiča v šalvii (nie v nebi: v noci by splynuli s oblohou)
  obdlz(ctx, P, 0, -540, POZEMOK, 540, P.salvia);
  vlaknina(ctx, 0, -540, POZEMOK, 540, 1.0, 51, P.papier, P.hlina);
  dosky(ctx, P, 0, -540, POZEMOK, 540, 48, P.hlina);
  ctx.beginPath();
  ctx.moveTo(30, -540); ctx.lineTo(30, -700); ctx.lineTo(250, -700); ctx.lineTo(290, -770); ctx.lineTo(430, -770);
  ctx.lineTo(470, -700); ctx.lineTo(690, -700); ctx.lineTo(690, -540); ctx.closePath(); plocha(ctx, P, P.drevo);
  stit(ctx, P, 'BARBER', 170, -730, 380, 110, 70);
  // zatvorené okenice a dvere
  for (const x of [70, 470]) {
    obdlz(ctx, P, x, -420, 180, 220, P.drevo);
    ctx.fillStyle = P.hlina; for (let y = -400; y < -210; y += 26) ctx.fillRect(x + 8, y, 164, 5);
    ctx.fillStyle = P.atrament; ctx.fillRect(x + 88, -420, 4, 220);
  }
  obdlz(ctx, P, 300, -300, 120, 300, P.hlina);
  // pruhovaný stĺp holiča (statické pruhy, bez otáčania, obchod je zatvorený)
  obdlz(ctx, P, 272, -330, 22, 200, P.papier, 3);
  ctx.fillStyle = P.skala;
  for (let y = -322; y < -140; y += 36) { ctx.beginPath(); ctx.moveTo(274, y); ctx.lineTo(292, y - 14); ctx.lineTo(292, y); ctx.lineTo(274, y + 14); ctx.closePath(); ctx.fill(); }
  // tabuľka na dverách (vysvetlenie je v karte, tu len jedno slovo, čitateľné aj pri malej mierke)
  ctx.save(); ctx.translate(360, -215); ctx.rotate(-0.06);
  obdlz(ctx, P, -80, -34, 160, 68, P.papier, 3);
  ctx.fillStyle = P.atrament; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `600 36px ${PISMO}`; ctx.fillText('CLOSED', 0, 2);
  ctx.restore();
  if (noc) { ctx.beginPath(); ctx.arc(150, -470, 12, 0, Math.PI * 2); plocha(ctx, P, P.lampa, 3); }
}

// ---------- interiér obchodu zhora (GDD 2.7) ----------

// Miesta nábytku v pôdoryse (v jednotkách pozemku, pôdorys zaberá x 0..720, y -540..0). Rozostavené tak, aby
// okolo pultu viedli uličky vľavo aj vpravo a za pultom chodba k policiam, skladu a peci, každá širšia než
// človek s vrecom (trasy.mjs, pokus 3 brány M0: v pokuse 2 zákazník prechádzal cez pult).
export const MIESTA_XY = [
  { x: 180, y: -300, w: 320, h: 64 },    // Counter
  { x: 40, y: -512, w: 250, h: 52 },     // Shelves
  { x: 574, y: -176, w: 116, h: 150 },   // Barrels (pravý dolný roh)
  { x: 40, y: -130, w: 90, h: 96 },      // Scale (ľavý dolný roh)
  { x: 580, y: -420, w: 110, h: 100 },   // Stove (pravá stena)
  { x: 316, y: -512, w: 220, h: 60 }     // Storeroom
];
export const DVERE_INTERIER = { x: 360, y: -20 };

export function kresliPodlahu(ctx, P) {
  obdlz(ctx, P, 0, -540, POZEMOK, 540, P.hlina, 6);
  obdlz(ctx, P, 24, -516, POZEMOK - 48, 492, P.piesok, 3);
  ctx.fillStyle = P.drevo;
  for (let y = -516 + 30; y < -24; y += 30) ctx.fillRect(24, y - 1.2, POZEMOK - 48, 2.4);
  const r = nahoda(99);
  for (let y = -516, row = 0; y < -24; y += 30, row++) for (let x = 24 + r() * 140; x < POZEMOK - 24; x += 140 + r() * 90) ctx.fillRect(x - 1.2, y, 2.4, 30);
  vlaknina(ctx, 24, -516, POZEMOK - 48, 492, 0.8, 101, P.papier, P.hlina);
  obdlz(ctx, P, 310, -26, 100, 30, P.drevo, 3);     // prah dverí
}

function kruh(ctx, P, x, y, r, farba, w = 3) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); plocha(ctx, P, farba, w); }

// Jeden kus nábytku zhora v stupni 0 (prázdne miesto) až 3. Volá sa pri prekreslení interiéru a počas 312 ms
// dosadnutia nového kusu (vtedy priamo do živého plátna interiéru, jediný kus). Tvary sú z veci, ktoré obchod
// naozaj mal (pokladňa, poháre, sudy s vekom, váha s miskami, liatinová pec s rúrou, debny a vrecia), aby sa daly
// rozoznať aj bez menovky (nález 3 brány M0).
export function kresliKus(ctx, P, i, stupen) {
  const m = MIESTA_XY[i];
  if (stupen <= 0) {
    ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.rect(m.x, m.y, m.w, m.h); ctx.lineWidth = 3; ctx.strokeStyle = P.hlina; ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(m.x + m.w / 2 - 12, m.y + m.h / 2); ctx.lineTo(m.x + m.w / 2 + 12, m.y + m.h / 2);
    ctx.moveTo(m.x + m.w / 2, m.y + m.h / 2 - 12); ctx.lineTo(m.x + m.w / 2, m.y + m.h / 2 + 12); ctx.lineWidth = 4; ctx.strokeStyle = P.hlina; ctx.stroke();
    return;
  }
  if (i === 0) {   // pult: doska s pokladňou, poháre s cukríkmi, od II mlynček na kávu, od III mosadzná lampa
    obdlz(ctx, P, m.x, m.y, m.w, m.h, P.drevo);
    ctx.fillStyle = P.hlina; for (let y = m.y + 16; y < m.y + m.h - 4; y += 16) ctx.fillRect(m.x + 4, y - 1, m.w - 8, 2);
    obdlz(ctx, P, m.x + m.w - 74, m.y + 8, 60, 46, P.atrament, 3);                 // pokladňa
    ctx.fillStyle = P.lampa; for (let k = 0; k < 6; k++) ctx.fillRect(m.x + m.w - 68 + (k % 3) * 18, m.y + 16 + Math.floor(k / 3) * 16, 12, 10);
    for (let k = 0; k < 2 + stupen; k++) kruh(ctx, P, m.x + 28 + k * 30, m.y + m.h / 2, 12, [P.papier, P.salvia, P.skala][k % 3], 2);
    if (stupen >= 2) { kruh(ctx, P, m.x + 190, m.y + m.h / 2, 18, P.hlina); ctx.fillStyle = P.atrament; ctx.fillRect(m.x + 174, m.y + m.h / 2 - 2, 32, 4); }
    if (stupen >= 3) { kruh(ctx, P, m.x + 226, m.y + m.h / 2, 16, P.lampa); kruh(ctx, P, m.x + 226, m.y + m.h / 2, 6, P.papier, 2); }
  } else if (i === 1) {   // police pri stene: rady pohárov s viečkami zhora
    obdlz(ctx, P, m.x, m.y, m.w, m.h, P.drevo);
    const n = 2 + stupen * 2, krok = (m.w - 24) / n;
    for (let k = 0; k < n; k++) { const x = m.x + 12 + krok * (k + 0.5); kruh(ctx, P, x, m.y + m.h / 2, Math.min(15, krok / 2 - 2), [P.papier, P.lampa, P.salvia, P.skala][(k + stupen) % 4], 2); ctx.fillStyle = P.atrament; ctx.fillRect(x - 3, m.y + m.h / 2 - 3, 6, 6); }
  } else if (i === 5) {   // sklad: debny s krížom a vrecia múky
    obdlz(ctx, P, m.x, m.y, m.w, m.h, P.hlina);
    const n = 2 + stupen * 2, w = (m.w - 16) / n;
    for (let k = 0; k < n; k++) {
      const x = m.x + 8 + k * w;
      if (k % 2 === 0) { obdlz(ctx, P, x + 3, m.y + 10, w - 6, m.h - 20, P.drevo, 3); ctx.beginPath(); ctx.moveTo(x + 6, m.y + 13); ctx.lineTo(x + w - 6, m.y + m.h - 13); ctx.moveTo(x + w - 6, m.y + 13); ctx.lineTo(x + 6, m.y + m.h - 13); obrys(ctx, P, 3); }
      else { ctx.beginPath(); ctx.ellipse(x + w / 2, m.y + m.h / 2, w / 2 - 4, m.h / 2 - 12, 0, 0, Math.PI * 2); plocha(ctx, P, P.papier, 3); ctx.fillStyle = P.hlina; ctx.fillRect(x + w / 2 - 6, m.y + m.h / 2 - 2, 12, 4); }
    }
  } else if (i === 2) {   // sudy zhora: obruč, veko z dosiek
    const n = stupen * 2;
    for (let k = 0; k < n; k++) {
      const cx = m.x + 30 + (k % 2) * 56, cy = m.y + 26 + Math.floor(k / 2) * 48;
      kruh(ctx, P, cx, cy, 24, P.drevo);
      ctx.beginPath(); ctx.arc(cx, cy, 17, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = P.hlina; ctx.stroke();
      ctx.fillStyle = P.hlina; ctx.fillRect(cx - 16, cy - 6, 32, 2); ctx.fillRect(cx - 16, cy + 4, 32, 2);
    }
  } else if (i === 3) {   // váha: stolík, rameno a dve misky; od II závažia, od III druhá malá váha
    obdlz(ctx, P, m.x + 6, m.y + 14, m.w - 12, m.h - 22, P.drevo);
    ctx.fillStyle = P.atrament; ctx.fillRect(m.x + 24, m.y + 44, m.w - 48, 6);
    kruh(ctx, P, m.x + 26, m.y + 47, 17, P.lampa); kruh(ctx, P, m.x + m.w - 26, m.y + 47, 17, P.lampa);
    kruh(ctx, P, m.x + m.w / 2, m.y + 47, 6, P.atrament, 2);
    if (stupen >= 2) for (let k = 0; k < 3; k++) obdlz(ctx, P, m.x + 18 + k * 20, m.y + 72, 12 + k * 2, 10, P.atrament, 2);
    if (stupen >= 3) kruh(ctx, P, m.x + m.w - 18, m.y + 24, 10, P.papier, 2);
  } else if (i === 4) {   // liatinová pec: platne, rúra do komína; od II kanvica na kávu, od III žeravé dvierka
    obdlz(ctx, P, m.x, m.y, m.w, m.h, P.atrament);
    kruh(ctx, P, m.x + 32, m.y + 34, 20, P.skala); kruh(ctx, P, m.x + 32, m.y + 34, 9, P.atrament, 2);
    kruh(ctx, P, m.x + 80, m.y + 30, 14, P.hlina, 3);                              // rúra do komína
    if (stupen >= 2) { kruh(ctx, P, m.x + 74, m.y + 70, 14, P.papier); obdlz(ctx, P, m.x + 86, m.y + 67, 14, 6, P.papier, 2); }
    if (stupen >= 3) obdlz(ctx, P, m.x + 14, m.y + m.h - 18, m.w - 28, 12, P.lampa, 2);
    else obdlz(ctx, P, m.x + 14, m.y + m.h - 18, m.w - 28, 12, P.hlina, 2);
  }
}

// Menovky miest v priblíženom interiéri: text vo veľkosti `pismo` jednotiek sveta (hra ju volí tak, aby na
// obrazovke mala 16 px a viac). Papierový štítok s obrysom pod kusom, pri stene nad ním.
export const RIMSKE = ['', 'I', 'II', 'III'];
// sUrovnou: na počítači „Counter II“, na úzkom mobile len meno (stupeň ukazuje kresba kusu aj karta), inak by sa
// štítky pri hornej stene pri 16 px prekrývali (test v vzhlad.test.mjs).
export function kresliMenovky(ctx, P, nab, mena, pismo, sUrovnou = true) {
  ctx.font = `600 ${pismo}px ${PISMO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const hotove = [];
  for (let i = 0; i < MIESTA_XY.length; i++) {
    const q = MIESTA_XY[i], text = nab[i] && sUrovnou ? `${mena[i]} ${RIMSKE[nab[i]]}` : mena[i];
    const w = ctx.measureText(text).width + pismo * 0.9, h = pismo * 1.5;
    // 18 jednotiek od kusu: rámik výberu (12 jednotiek okolo kusu) menovku nezakryje
    let x = q.x + q.w / 2 - w / 2, y = q.y + q.h + 18;
    if (y + h > -28) y = q.y - h - 18;
    x = Math.max(30, Math.min(POZEMOK - 30 - w, x));
    // na úzkom mobile sa štítky pri hornej stene prekrývajú: posunúť nižšie pod predošlý
    for (let znova = true; znova;) {
      znova = false;
      for (const r of hotove) if (x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y) { y = r.y + r.h + 4; znova = true; }
    }
    hotove.push({ x, y, w, h });
    ctx.beginPath(); ctx.rect(x, y, w, h); plocha(ctx, P, P.papier, Math.max(2, pismo * 0.1));
    ctx.fillStyle = P.atrament; ctx.fillText(text, x + w / 2, y + h / 2 + pismo * 0.05);
  }
  return hotove;                                     // obdĺžniky štítkov: ľudia pri kusoch nestoja pod nimi
}

// Človek zhora (interiér): plecia ako elipsa naprieč smerom chôdze, klobúk so strechou, vrece v ruke.
// Transformáciu (poloha, otočenie do smeru) nastaví volajúci; tu sa kreslí okolo bodu 0, 0 so smerom +x.
export function kresliClovekaZhora(ctx, P, kabat, klobuk, nesie, predavac = false) {
  ctx.beginPath(); ctx.ellipse(0, 0, 13, 27, 0, 0, Math.PI * 2); plocha(ctx, P, kabat, 3);
  if (predavac) { ctx.beginPath(); ctx.ellipse(6, 0, 7, 16, 0, 0, Math.PI * 2); plocha(ctx, P, P.papier, 2); }
  if (predavac) { kruh(ctx, P, 0, 0, 13, P.hlina, 3); return; }
  kruh(ctx, P, 0, 0, 21, klobuk, 3);
  kruh(ctx, P, 0, 0, 11, klobuk === P.atrament ? P.hlina : P.drevo, 3);
  // vrece v ruke nad plecom (kreslí sa posledné, aby bolo vidno): celý človek sa zmestí do polomeru 29
  // (trasy.mjs POLOMER, test v vzhlad.test.mjs)
  if (nesie) { kruh(ctx, P, 4, 18, 9, P.papier, 3); ctx.fillStyle = P.hlina; ctx.fillRect(-1, 17, 10, 3); }
}

// Otvorené dvere obchodu (stupeň 2 a vyššie): tmavý otvor (v noci svetlo zvnútra) a úzke krídlo pri pánte.
export const DVERE_ULICA = { x0: 304, x1: 416, y0: -296 };
// Výklad vľavo od dverí: tu vidno zákazníka pri pulte (orezanie po líniu pultu).
export const VYKLAD = { x0: 62, x1: 258, y0: -418, y1: -262 };

// ---------- kulisy a paralaxa (GDD 4.4) ----------

// Vrstvy: 0 vzdialené stolové hory (0,15), 1 kopce s traťou a telegrafom (0,55), 2 ulica (1,0), 3 popredie (1,25).
export const PARALAXA = [0.15, 0.55, 1.0, 1.25];

// Rozsah jednej vrstvy vo svete, aby pokryla všetky polohy kamery: kamera od stredu prvej po stred poslednej budovy.
export function rozsahVrstvy(p, camMin, camMax, polSirkySveta) {
  return { x0: camMin * p - polSirkySveta - 200, x1: camMax * p + polSirkySveta + 200 };
}

export function kresliHory(ctx, P, x0, x1, noc) {
  const r = nahoda(301);
  // nebo za horami je v samostatnej vrstve; tu stolové hory s tieňovou stranou
  for (let x = x0 - 200; x < x1 + 200;) {
    // ďaleko, preto nízko: vrchy 110 až 330 nad obzorom, aby nepôsobili ako steny za budovami
    const w = 220 + r() * 460, h = 110 + r() * 220, top = -470 - h, sklon = 26 + r() * 40;
    ctx.beginPath(); ctx.moveTo(x, -470); ctx.lineTo(x + sklon, top); ctx.lineTo(x + w - sklon, top); ctx.lineTo(x + w, -470); ctx.closePath();
    plocha(ctx, P, P.skala, 5);
    ctx.beginPath(); ctx.moveTo(x + w * 0.62, top); ctx.lineTo(x + w - sklon, top); ctx.lineTo(x + w, -470); ctx.lineTo(x + w * 0.7, -470); ctx.closePath();
    ctx.fillStyle = P.hlina; ctx.fill();
    ctx.fillStyle = P.hlina; for (let k = 1; k < 3; k++) ctx.fillRect(x + sklon * 0.5, top + k * (h / 3), w * 0.55, 3);
    vlaknina(ctx, x, top, w, h, 0.6, 311 + Math.floor(x), P.piesok, P.hlina);
    x += w * (0.9 + r() * 0.9);
  }
  obdlz(ctx, P, x0 - 300, -480, x1 - x0 + 600, 40, noc ? P.hlina : P.piesok, 0);
}

export function kresliTrat(ctx, P, x0, x1) {
  // nízke kopce, trať a telegrafné stĺpy (trať sa bude hýbať s postupom až v M1)
  ctx.beginPath(); ctx.moveTo(x0 - 300, -300);
  const r = nahoda(401);
  for (let x = x0 - 300; x <= x1 + 300; x += 180) ctx.lineTo(x, -420 + r() * 60);
  ctx.lineTo(x1 + 300, -300); ctx.closePath(); plocha(ctx, P, P.salvia, 5);
  obdlz(ctx, P, x0 - 300, -330, x1 - x0 + 600, 60, P.piesok, 0);
  ctx.fillStyle = P.atrament; ctx.fillRect(x0 - 300, -334, x1 - x0 + 600, 5); ctx.fillRect(x0 - 300, -318, x1 - x0 + 600, 5);
  ctx.fillStyle = P.hlina; for (let x = x0 - 300; x < x1 + 300; x += 28) ctx.fillRect(x, -338, 8, 26);
  for (let x = Math.floor(x0 / 420) * 420; x < x1 + 300; x += 420) {
    ctx.fillStyle = P.atrament; ctx.fillRect(x - 4, -520, 8, 190); ctx.fillRect(x - 26, -510, 52, 6);
  }
  ctx.beginPath();
  for (let x = Math.floor(x0 / 420) * 420; x < x1 + 300; x += 420) { ctx.moveTo(x - 22, -508); ctx.quadraticCurveTo(x + 188, -470, x + 398, -508); }
  ctx.lineWidth = 2; ctx.strokeStyle = P.atrament; ctx.stroke();
}

export function kresliUlicu(ctx, P, x0, x1) {
  obdlz(ctx, P, x0 - 300, -62, x1 - x0 + 600, 1200, P.piesok, 0);   // od hornej hrany vrstvy (−60), inak ostane čierny pás
  vlaknina(ctx, x0 - 300, -40, x1 - x0 + 600, 700, 0.9, 501, P.papier, P.drevo);
  // chodník z dosiek pred budovami a koľaje vozov
  obdlz(ctx, P, x0 - 300, -4, x1 - x0 + 600, 34, P.drevo, 3);
  ctx.fillStyle = P.hlina; for (let x = x0 - 300; x < x1 + 300; x += 60) ctx.fillRect(x, -2, 3, 30);
  ctx.fillStyle = P.drevo; ctx.fillRect(x0 - 300, 190, x1 - x0 + 600, 5); ctx.fillRect(x0 - 300, 250, x1 - x0 + 600, 5);
}

export function kresliPopredie(ctx, P, x0, x1) {
  const r = nahoda(601);
  for (let x = x0 + 120; x < x1; x += 700 + r() * 600) {
    const typ = Math.floor(r() * 3), y = 330;
    if (typ === 0) {   // kaktus
      obdlz(ctx, P, x - 16, y - 170, 32, 170, P.salvia);
      obdlz(ctx, P, x - 56, y - 120, 22, 60, P.salvia); obdlz(ctx, P, x - 56, y - 72, 44, 18, P.salvia);
      obdlz(ctx, P, x + 34, y - 140, 22, 70, P.salvia); obdlz(ctx, P, x + 12, y - 88, 44, 18, P.salvia);
    } else if (typ === 1) {   // sudy
      for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.rect(x + k * 70 - 30, y - 96, 60, 96); plocha(ctx, P, P.drevo); ctx.fillStyle = P.atrament; ctx.fillRect(x + k * 70 - 30, y - 70, 60, 5); ctx.fillRect(x + k * 70 - 30, y - 30, 60, 5); }
    } else {   // kôl na uväzovanie koní
      obdlz(ctx, P, x - 90, y - 90, 180, 16, P.drevo); obdlz(ctx, P, x - 80, y - 90, 14, 90, P.drevo, 3); obdlz(ctx, P, x + 66, y - 90, 14, 90, P.drevo, 3);
    }
  }
}

// Nebo: ploché pásy (žiadny prechod), slnko alebo mesiac a hviezdy. Kreslí sa do plátna veľkosti obrazovky.
export function kresliNebo(ctx, P, W, H, horizont, noc) {
  ctx.fillStyle = noc ? P.noc : P.nebo; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = noc ? '#2A3252' : '#A9C6D2'; ctx.fillRect(0, horizont - H * 0.22, W, H * 0.22 + 2);
  ctx.fillStyle = noc ? '#353B5C' : '#E9D7B4'; ctx.fillRect(0, horizont - H * 0.09, W, H);
  if (noc) {
    const r = nahoda(701);
    ctx.fillStyle = P.papier;
    for (let i = 0; i < 90; i++) { const d = r() < 0.15 ? 3 : 2; ctx.fillRect(Math.round(r() * W), Math.round(r() * (horizont - H * 0.12)), d, d); }
    const my = Math.max(190, horizont - H * 0.34);
    ctx.beginPath(); ctx.arc(W * 0.78, my, Math.max(14, W * 0.028), 0, Math.PI * 2); ctx.fillStyle = P.papier; ctx.fill();
    ctx.beginPath(); ctx.arc(W * 0.78 + Math.max(6, W * 0.012), my - 3, Math.max(12, W * 0.025), 0, Math.PI * 2); ctx.fillStyle = P.noc; ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(W * 0.8, Math.max(190, horizont - H * 0.3), Math.max(18, W * 0.032), 0, Math.PI * 2); ctx.fillStyle = P.lampa; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = P.atrament; ctx.stroke();
  }
}

export { POZEMOK, KROK, dlzkaUlice };
