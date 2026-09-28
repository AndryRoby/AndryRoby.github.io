/* Whistle Stop M0: slučka, vstup, kamera, bábky, karta budovy. Zapája logiku (stav.mjs), kreslenie (scena.mjs,
   babky.mjs) a zvuk (zvuk.mjs). Ekonomika beží v krokoch 100 ms z rozdielu času, kreslenie cez
   requestAnimationFrame zvlášť (GDD 5.2).
   Skladanie (pokus 2 brány M0, nález 1): nebo, hory, trať, ulica s budovami a popredie sú samostatné plátna v DOM,
   nakreslené raz pri zmene (rozmer, deň a noc, stupeň fasády). Švih kamery a paralaxa menia len `transform`
   týchto plátien, teda robí ich kompozítor, nie hlavné vlákno. Hlavné vlákno v snímke kreslí len bábky, častice,
   mince, otvorené dvere a obsluhu vo výklade do priehľadného #platno (maže len riadky, kde minule kreslilo).
   Rozmery sa čítajú z DOM len pri zmene okna a pri otvorení interiéru, nikdy v snímke. */
import { PRESETS, springStep } from '../../../motion/src/core.js';
import { OBCHOD, E, MIESTA, cenaUrovni, cenaManazera, stupenFasady, pracovnikov, dalsieCiele, prijemZaS, fmt } from './ekonomika.mjs';
import {
  novyStav, tukObchod, tukStudna, krok, kupUroven, najmiManazera, kupNabytok, offline, prijemTeraz,
  interierOtvoreny, cenaDalsiehoKusu
} from './stav.mjs';
import { vytvorUlozisko, pametoveUlozisko } from './ulozenie.mjs';
import { POZEMOK, KROK, stredBudovy, rozlozenie, cielSvihu, cielKlavesy } from './kamera.mjs';
import { paleta } from './paleta.mjs';
import { H as VYSKA_BABKY, kostym, spriteKostymu, novyChodec, krokBabky, kresliBabku, STAV } from './babky.mjs';
import {
  OKRAJ_BUDOVY, kresliObchod, kresliStudnu, kresliHolica, kresliLopatky, VETERNIK, kresliPodlahu, kresliKus,
  MIESTA_XY, PARALAXA, rozsahVrstvy, kresliHory, kresliTrat, kresliUlicu, kresliPopredie,
  vyskaObchodu, PISMO, kresliNebo, kresliMenovky, kresliClovekaZhora, DVERE_ULICA, VYKLAD
} from './scena.mjs';
import { prekazky, trasa, bodPohladu, DVERE as DVERE_TRASY, PREDAVAC_NAD, PRED_PULTOM, OD_KONCA_PULTU } from './trasy.mjs';
import { vytvorZvuk } from './zvuk.mjs';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), MERANIE = Q.has('meranie') || DEMO;
const POCET = 3, I_STUDNA = 0, I_OBCHOD = 1, I_HOLIC = 2;
const MANAZER = { meno: 'Hattie Boone', veta: '"Flour is fresh and the coffee is hot. I will keep the door open."' };
const MIESTO_MENA = ['I', 'II', 'III'];
const MENA_MIEST = MIESTA.map(x => x.meno);

const $ = (id) => document.getElementById(id);
const scena = $('scena'), platno = $('platno');
const EL = {
  nebo: $('v-nebo'), hory: $('v-hory'), trat: $('v-trat'), ulica: $('v-ulica'), zem: $('v-zem'), lopatky: $('v-lopatky'),
  obal: $('obal-obchod'), popredie: $('v-popredie'), interier: $('interier'), podlaha: $('i-podlaha'), zivy: $('i-zivy'), menovky: $('i-menovky'),
  b: [$('b-0'), $('b-1'), $('b-2')], dvere: $('v-dvere'), lista: $('lista'), listaPlna: $('lista-plna')
};
// Mince a nárazy vetra: malé DOM prvky, ich let je Web Animations API (kompozítor). Vytvoria sa raz.
const MINCE_EL = Array.from({ length: 12 }, () => { const d = document.createElement('div'); d.className = 'minca'; d.textContent = '$'; $('mince').appendChild(d); return d; });
const VIETOR_EL = Array.from({ length: 5 }, () => { const d = document.createElement('div'); d.className = 'naraz'; $('vietor').appendChild(d); return d; });
// kontexty živých plátien raz (statické vrstvy sú obrázky, pozri obraz())
const G = {};
function kontexty() {
  G.dyn = platno.getContext('2d'); G.dvere = EL.dvere.getContext('2d');
  G.zivy = EL.zivy.getContext('2d');
}
kontexty();
// Sprity (diely bábok, prach) sa kreslia do OffscreenCanvas a hneď sa z nich urobí ImageBitmap. Dôvod (stopa
// Chrome 28. 9., pokus 2): drawImage z plátna robí pri každom volaní snímku zdrojového plátna
// (Canvas2DResourceProvider::ProduceCanvasResource, 0,25 ms bez spomalenia, asi 11 volaní na snímku v pokoji,
// 40 a viac pri 6 chodcoch). Z ImageBitmap sa kreslí bez kópie.
const nove = (w, h) => {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(Math.max(1, w), Math.max(1, h));
  const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c;
};
const naBitmapu = (c) => (typeof c.transferToImageBitmap === 'function' ? c.transferToImageBitmap() : c);
function bitmapyKostymu(spr) {
  for (const k in spr.diely) spr.diely[k].c = naBitmapu(spr.diely[k].c);
  spr.vrece.c = naBitmapu(spr.vrece.c);
  return spr;
}

// ---------- zariadenie, znížený pohyb ----------
let slabe = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || Q.has('slabe');
// GDD 5.4: slabé zariadenie aj podľa času snímky (priemer intervalu nad 22 ms počas 2 s = hustota pixelov 1,5
// a polovica chodcov, raz a natrvalo).
let slabeSucet = 0, slabeN = 0;
function sledujSlabe(interval) {
  if (slabe || interval > 250) return;
  slabeSucet += interval; slabeN++;
  if (slabeN >= 120) {
    if (slabeSucet / slabeN > 22) { slabe = true; rozmer(); }
    slabeSucet = 0; slabeN = 0;
  }
}
const mqPohyb = matchMedia('(prefers-reduced-motion: reduce)');
let zniz = mqPohyb.matches;
mqPohyb.addEventListener?.('change', (e) => { zniz = e.matches; });

// ---------- stav a uloženie ----------
const ulozisko = DEMO ? vytvorUlozisko(pametoveUlozisko()) : (() => { try { return vytvorUlozisko(localStorage); } catch { return vytvorUlozisko(pametoveUlozisko({ zablokovane: true })); } })();
let s = (!Q.has('novy') && ulozisko.nacitaj(Date.now())) || novyStav(Date.now());
const navrat = offline(s, Date.now());
if (!ulozisko.funguje() && !DEMO) $('upozornenie').hidden = false;

const zvuk = vytvorZvuk();
let noc = false;

// ---------- rozloženie ----------
let W = 0, Hs = 0, dpr = 1, lay = null, m = 1, zem = 0, zemR = 0, yHore = 0;
let camX = stredBudovy(I_OBCHOD), camV = 0, camCiel = I_OBCHOD, aktivna = I_OBCHOD;
let P = paleta(false);
const r = (v) => Math.round(v * dpr) / dpr;          // CSS px zarovnané na celé pixely zariadenia (ostrosť vrstiev)

function rozmer() {
  W = scena.clientWidth; Hs = scena.clientHeight;
  dpr = Math.min(slabe ? 1.5 : 2, window.devicePixelRatio || 1);
  lay = rozlozenie(W, Hs, POCET);
  m = lay.mierka;
  zem = lay.jednaBudova ? Math.round(Hs * 0.6) : Math.round(Hs * 0.72);
  // na výšku sa obchod s jedným poschodím a štítom (1080) musí zmestiť pod hlavičku a nástroje (asi 120 px)
  if (lay.jednaBudova) m = Math.min(m, (zem - 125) / 1080);
  // počítač: ulica v ľavej časti, karta (400 px) vpravo dole ju nezakryje
  const karta = lay.jednaBudova ? 0 : 424;
  if (!lay.jednaBudova) m = Math.min((W - karta - 80) / (POCET * POZEMOK + (POCET - 1) * (KROK - POZEMOK)), (zem - 110) / 1180);
  zemR = r(zem);
  yHore = Math.min(OKRAJ_BUDOVY.y0, -(zem / m) - 120);   // horný okraj orezania obchodu: nad obrazovkou
  document.body.classList.toggle('jedna', lay.jednaBudova);
  if (!lay.jednaBudova) camX = (stredBudovy(0) + stredBudovy(POCET - 1)) / 2 + (karta / 2) / m;
  else camX = stredBudovy(camCiel);
  camV = 0;
  postavVsetko();
  if (interierOtvor) { cielInterieru(); postavInterier(); }
}

// ---------- predkreslené plátna (raz pri zmene) ----------
// Plátno v DOM na rozmer v CSS px; nastavenie šírky ho zároveň vymaže a zruší transformáciu kontextu.
function rozmerPlatna(c, wCss, hCss) {
  const w = Math.max(1, Math.ceil(wCss * dpr)), h = Math.max(1, Math.ceil(hCss * dpr));
  c.width = w; c.height = h; c.style.width = w / dpr + 'px'; c.style.height = h / dpr + 'px';
}
function poloz(el, x, y) { el.style.left = r(x) + 'px'; el.style.top = r(y) + 'px'; }

// Statický obrázok (nebo, vrstvy, zem, budovy, lopatky): kreslí sa raz do OffscreenCanvas, zakóduje sa mimo
// snímky (convertToBlob) a zobrazí v <img>. Dôvod (stopa Chrome 28. 9., pokus 2): každé <canvas> v stránke
// prehliadač kopíruje kompozítoru pri každom commite, aj nezmenené (11 plátien = 11 kópií na snímku, asi 1 ms
// každá pri 4x spomalení); obrázok sa rastruje raz. Kým sa nový obrázok nedekóduje, ostáva starý.
const OBRAZY = new Map();                              // img -> { gen, url }
// Plátno na kreslenie sa pre ten istý obrázok a rozmer používa znova (convertToBlob si obsah odfotí hneď pri
// volaní): nové plátno 2 MB pri každej kúpe kusu nahromadilo pamäť a Firefox potom raz zastal na 147 až 187 ms.
const PLATNA_OBRAZOV = new Map();                      // img -> OffscreenCanvas
function obraz(img, wCss, hCss) {
  const w = Math.max(1, Math.ceil(wCss * dpr)), h = Math.max(1, Math.ceil(hCss * dpr));
  let c = PLATNA_OBRAZOV.get(img);
  if (!c || c.width !== w || c.height !== h) { c = nove(w, h); PLATNA_OBRAZOV.set(img, c); }
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); g.globalAlpha = 1;
  return { g, zobraz: () => zobrazObraz(img, c, w / dpr, h / dpr) };
}
function zobrazObraz(img, c, wCss, hCss) {
  const z = OBRAZY.get(img) || { gen: 0, url: '' };
  const gen = ++z.gen; OBRAZY.set(img, z);
  const blob = c.convertToBlob ? c.convertToBlob() : new Promise((res) => c.toBlob(res));
  return blob.then((b) => {
    if (z.gen !== gen) return;
    const url = URL.createObjectURL(b), t = new Image();
    t.src = url;
    return t.decode().catch(() => {}).then(() => {
      if (z.gen !== gen) { URL.revokeObjectURL(url); return; }
      img.style.width = wCss + 'px'; img.style.height = hCss + 'px'; img.src = url;
      if (z.url) URL.revokeObjectURL(z.url);
      z.url = url;
    });
  });
}

// vrstvy paralaxy: { el, p, x0 } (x0 = svetová x ľavého okraja obrázka)
let VRSTVY = [];
function vrstva(el, p, y0, y1, kresli) {
  const camMin = lay.jednaBudova ? stredBudovy(0) : camX, camMax = lay.jednaBudova ? stredBudovy(POCET - 1) : camX;
  const { x0, x1 } = rozsahVrstvy(p, camMin, camMax, W / 2 / m);
  const o = obraz(el, (x1 - x0) * m, (y1 - y0) * m), k = m * dpr;
  o.g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
  kresli(o.g, x0, x1);
  o.zobraz();
  poloz(el, 0, zem + y0 * m);
  return { el, p, x0 };
}

const budovyY0 = [0, 0, 0], kluce = ['', '', ''];
function budovaY0(i, st) { return i === I_OBCHOD ? -(vyskaObchodu(st) + 90) : i === I_STUDNA ? -900 : -860; }

// Budovy sú deti skupiny #v-ulica (paralaxa 1): skupina má počiatok v bode sveta (0, 0), deti sú na svojich
// miestach v CSS px, pri švihu sa posúva len skupina.
function postavBudovu(i) {
  const st = stupenFasady(s.n);
  const kluc = i === I_OBCHOD ? `${st}|${noc}|${pracovnikov(s.n)}|${s.man}|${m}|${dpr}|${yHore}` : `${noc}|${m}|${dpr}`;
  if (kluce[i] === kluc) return Promise.resolve();
  kluce[i] = kluc;
  const O = OKRAJ_BUDOVY, k = m * dpr, y0 = budovaY0(i, st), c = EL.b[i];
  const o = obraz(c, (O.x1 - O.x0) * m, (O.y1 - y0) * m), g = o.g;
  g.setTransform(k, 0, 0, k, -O.x0 * k, -y0 * k);
  if (i === I_OBCHOD) kresliObchod(g, P, st, { noc, pracovnici: pracovnikov(s.n), man: s.man });
  else if (i === I_STUDNA) kresliStudnu(g, P, { noc });
  else kresliHolica(g, P, { noc });
  budovyY0[i] = y0;
  // poloha a lišta sa nastavia, až keď je nový obrázok hotový (inak by starý na chvíľu stál na novom mieste)
  return o.zobraz().then(() => {
    // bod otáčania ťuku: stred pozemku pri zemi
    c.style.transformOrigin = `${(POZEMOK / 2 - O.x0) * m}px ${-y0 * m}px`;
    if (i === I_OBCHOD) {
      // obal orezáva obchod pri zemi (rast fasády vyjde zdola) a nad obrazovkou (zdvihnutie pri interiéri)
      poloz(EL.obal, (KROK + O.x0) * m, yHore * m);
      EL.obal.style.width = r((O.x1 - O.x0) * m) + 'px'; EL.obal.style.height = r((6 - yHore) * m) + 'px';
      poloz(c, 0, (y0 - yHore) * m);
      // lišta cyklu nad dverami (búda: nad okienkom pri dverách 480, od štítu nad dverami 360)
      const lx = DVERE_OBCHODU() - 70, ly = st <= 1 ? -300 : -350, hh = Math.max(4, Math.round(14 * m * dpr)) / dpr;
      poloz(EL.lista, lx * m - 2, ly * m - 2);                       // rám 2 px (border), vnútri výplň
      EL.lista.style.width = r(140 * m) + 4 + 'px'; EL.lista.style.height = r(hh) + 4 + 'px';
      EL.listaPlna.style.width = r(140 * m) + 'px'; EL.listaPlna.style.height = r(hh) + 'px';
    } else poloz(c, (i * KROK + O.x0) * m, y0 * m);
  });
}

let kostymy = [], prachSpr = null;
const PAS_Y0 = -165, PAS_Y1 = 112;                 // pás chodcov vo svete (klobúk na chodníku pri dverách až chodidlá)
const DV = { x0: 50, x1: 430, y0: -432, y1: 6 };  // plátno dverí a výkladu, súradnice pozemku obchodu
let pasY0 = 0, dvereKreslene = false;
function postavVsetko() {
  P = paleta(noc);
  const k = m * dpr;
  // nebo: celé okno, stojí (paralaxa 0)
  const on = obraz(EL.nebo, W, Hs); on.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  kresliNebo(on.g, P, W, Hs, zem - 470 * m, noc); on.zobraz();
  VRSTVY = [
    vrstva(EL.hory, PARALAXA[0], -1260, -430, (g, a, b) => kresliHory(g, P, a, b, noc)),
    vrstva(EL.trat, PARALAXA[1], -560, -270, (g, a, b) => kresliTrat(g, P, a, b)),
    vrstva(EL.popredie, PARALAXA[3], 120, 340, (g, a, b) => kresliPopredie(g, P, a, b))
  ];
  // ulica: skupina s počiatkom v zemi, pás cesty až po spodok okna
  EL.ulica.style.top = zemR + 'px';
  const camMin = lay.jednaBudova ? stredBudovy(0) : camX, camMax = lay.jednaBudova ? stredBudovy(POCET - 1) : camX;
  const u = rozsahVrstvy(1, camMin, camMax, W / 2 / m), dole = (Hs - zem) / m + 40;
  const oz = obraz(EL.zem, (u.x1 - u.x0) * m, (dole + 62) * m);
  oz.g.setTransform(k, 0, 0, k, -u.x0 * k, 62 * k);
  kresliUlicu(oz.g, P, u.x0, u.x1); oz.zobraz();
  poloz(EL.zem, u.x0 * m, -62 * m);
  kluce[0] = kluce[1] = kluce[2] = '';
  for (let i = 0; i < POCET; i++) postavBudovu(i);
  // lopatky veterníka: malý obrázok, otáča ho kompozítor
  const rl = Math.ceil(VETERNIK.r * m) + 4;
  const ol = obraz(EL.lopatky, 2 * rl, 2 * rl);
  ol.g.setTransform(k, 0, 0, k, rl * dpr, rl * dpr); kresliLopatky(ol.g, P); ol.zobraz();
  poloz(EL.lopatky, (I_STUDNA * KROK + VETERNIK.x) * m - rl, VETERNIK.y * m - rl);
  // Živé plátno je len pás chodcov (svet y PAS_Y0 až PAS_Y1): prehliadač ho po každej snímke kopíruje
  // kompozítoru (stopa Chrome 28. 9.: pri celom okne to bolo 4,4 s z 8 s hlavného vlákna pri 4x spomalení).
  rozmerPlatna(platno, W, (PAS_Y1 - PAS_Y0) * m); poloz(platno, 0, zem + PAS_Y0 * m);
  pasY0 = Math.round(r(zem + PAS_Y0 * m) * dpr);
  // dvere a výklad obchodu: malé plátno v skupine ulice, kreslí sa len počas obsluhy
  rozmerPlatna(EL.dvere, (DV.x1 - DV.x0) * m, (DV.y1 - DV.y0) * m); poloz(EL.dvere, (KROK + DV.x0) * m, DV.y0 * m);
  dvereKreslene = true;
  const pr = Math.ceil(10 * dpr);
  prachSpr = nove(2 * pr, 2 * pr);
  const gp = prachSpr.getContext('2d'); gp.beginPath(); gp.arc(pr, pr, pr - 1, 0, Math.PI * 2); gp.fillStyle = P.piesok; gp.fill();
  prachSpr = naBitmapu(prachSpr);
  // kostýmy bábok: 10 kombinácií, každý diel raz
  kostymy = [];
  for (let i = 0; i < 10; i++) kostymy.push(bitmapyKostymu(spriteKostymu(kostym(1009 + i * 7919), P, m * dpr * 1.05, nove)));
  if (interierOtvor || anim.interierT >= 0) postavInterier();
  camKresl = NaN; trObchod = ['', '', ''];
}

// ---------- interiér: priblížený panel (nález 3 brány M0) ----------
// Pri otvorení sa fasáda zdvihne a pôdorys obchodu sa zo svojho miesta na ulici zväčší do voľnej plochy
// (mobil: medzi hlavičkou a kartou, počítač: vľavo od karty), mierka mI. Predmety majú menovky a vyberajú sa
// ťuknutím aj myšou priamo v pôdoryse.
const IT = { x: 0, y: 0 }; let mI = 1;
const OKRAJ_I = 6;                                   // okraj plátna interiéru v jednotkách sveta (obrys steny)
function cielInterieru() {
  karta();                                           // karta už v režime interiéru, aby mala konečnú výšku
  const kr = $('karta').getBoundingClientRect(), nr = document.querySelector('.nastroje').getBoundingClientRect();
  let x0, x1, y1;
  const y0 = nr.bottom + 14;
  if (lay.jednaBudova) { x0 = 12; x1 = W - 12; y1 = kr.top - 12; } else { x0 = 24; x1 = kr.left - 24; y1 = Hs - 24; }
  mI = Math.max(0.2, Math.min((x1 - x0) / (POZEMOK + 2 * OKRAJ_I), (y1 - y0) / (540 + 2 * OKRAJ_I), 1.15));
  IT.x = r(x0 + (x1 - x0 - (POZEMOK + 2 * OKRAJ_I) * mI) / 2);
  IT.y = r(y0 + Math.max(0, (y1 - y0 - (540 + 2 * OKRAJ_I) * mI) / 2));
  poloz(EL.interier, IT.x, IT.y);
}
// Podlaha s nábytkom je obrázok ako ostatné statické vrstvy (pokus 3 brány M0: prekreslenie plátna podlahy
// v DOM pri kúpe kusu dalo vo Firefoxe raz za reláciu snímku 147 až 187 ms mimo JS). Kým sa nový obrázok
// nedekóduje, živá vrstva drží kupovaný kus nakreslený (anim.nabytokDrz), aby nezmizol.
let podlahaGen = 0;
function postavInterier() {
  const k = mI * dpr, w = (POZEMOK + 2 * OKRAJ_I) * mI, h = (540 + 2 * OKRAJ_I) * mI;
  // rozmer živého plátna len pri zmene (nastavenie šírky plátno znova alokuje)
  if (EL.zivy.width !== Math.max(1, Math.ceil(w * dpr)) || EL.zivy.height !== Math.max(1, Math.ceil(h * dpr))) {
    rozmerPlatna(EL.zivy, w, h);
    EL.interier.style.width = EL.zivy.style.width; EL.interier.style.height = EL.zivy.style.height;
  }
  const op = obraz(EL.podlaha, w, h), g = op.g;
  g.setTransform(k, 0, 0, k, OKRAJ_I * k, (540 + OKRAJ_I) * k);
  kresliPodlahu(g, P);
  for (let i = 0; i < 6; i++) if (i !== anim.nabytokMiesto || anim.nabytokT < 0) kresliKus(g, P, i, s.nab[i]);
  const gen = ++podlahaGen;
  const hotovo = [op.zobraz().then(() => { if (gen === podlahaGen) anim.nabytokDrz = false; })];
  // Menovky aspoň 16 px na obrazovke (na počítači 17 px) sú v samostatnom obrázku NAD živou vrstvou s ľuďmi
  // (nález 2 brány M0 pokus 2: zákazník zakrýval „Counter“). Obrázok, nie plátno: kompozítor ho nekopíruje
  // pri každom commite. Prekreslí sa len pri zmene rozmeru, farieb alebo stupňov (na počítači ich ukazuje).
  const kluc = `${w}|${h}|${dpr}|${noc}|${lay.jednaBudova ? '' : s.nab.join()}`;
  if (kluc !== menovkyKluc) {
    menovkyKluc = kluc;
    const o = obraz(EL.menovky, w, h);
    o.g.setTransform(k, 0, 0, k, OKRAJ_I * k, (540 + OKRAJ_I) * k);
    const stitky = kresliMenovky(o.g, P, s.nab, MENA_MIEST, (lay.jednaBudova ? 16 : 17) / mI, !lay.jednaBudova);
    hotovo.push(o.zobraz());
    // kde ľudia stoja pri kuse, nie pod menovkou (ak by pri kuse také miesto nebolo, ostane pôvodné)
    POHLAD = MIESTA_XY.map((q, i) => bodPohladu(q, PREKAZKY, stitky) || POHLAD[i]);
  }
  return Promise.all(hotovo);                        // obrázky podlahy a menoviek sú dekódované
}
let menovkyKluc = '';

// ---------- animácie (bez alokácií v snímke: pevné polia a objekty) ----------
const anim = { tukT: -1, tukBudova: -1, rastT: -1, rastDy: 0, interierT: -1, interierSmer: 0, interierCaka: false, nabytokMiesto: -1, nabytokT: -1, nabytokDrz: false, uhol: 0, vreceT: -1 };
let interierOtvor = false;

// Minca: oblúk 40 px hore (krivka príchodu), potom k počítadlu vpravo hore (ease-in-out), spolu 750 ms.
// Let beží na kompozítore (Web Animations API); hlavné vlákno ho len spustí.
let mincaI = 0;
const LET_MINCE = { duration: 750 };
function pustiMincu(wx, wy) {
  if (zniz) return;
  const el = MINCE_EL[mincaI++ % MINCE_EL.length];
  const x0 = gxOff + wx * m - 13, y0 = zemR + wy * m - 13;
  el.animate([
    { transform: `translate3d(${x0}px,${y0}px,0)`, visibility: 'visible', easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    { transform: `translate3d(${x0}px,${y0 - 40}px,0)`, visibility: 'visible', offset: 0.53, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' },
    { transform: `translate3d(${cielMinceX - 13}px,${cielMinceY - 13}px,0)`, visibility: 'visible' }
  ], LET_MINCE);
}
const PRACH = Array.from({ length: 40 }, () => ({ aktivny: false, t: 0, x: 0, y: 0, r: 1, vx: 0 }));
function pustiPrach(wx, wy, r = 1, vx = 0) {
  if (zniz) return;
  const p = PRACH.find(x => !x.aktivny); if (!p) return;
  p.aktivny = true; p.t = 0; p.x = wx; p.y = wy; p.r = r; p.vx = vx;
}
// Náraz vetra: 3 až 5 krátkych čiar papiera preletí oblohou za 1,2 s (lineárne, stály pohyb), kompozítor.
let dalsiVietor = 8;
function pustiVietor() {
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const el = VIETOR_EL[i], d = 24 + Math.random() * 30, x = -Math.random() * 120 - d, y = zem - (120 + Math.random() * 260);
    el.style.width = Math.round(d) + 'px';
    el.animate([
      { transform: `translate3d(${x}px,${y}px,0)`, visibility: 'visible' },
      { transform: `translate3d(${x + W * 0.9 + 100}px,${y}px,0)`, visibility: 'visible' }
    ], { duration: 1200 });
  }
}

// ---------- chodci a zákazníci obchodu (nález 3: príchod, obsluha, odchod s tovarom) ----------
const maxChodcov = () => Math.floor((lay && lay.jednaBudova ? 6 : 14) * (slabe ? 0.5 : 1));
const CHODCI = Array.from({ length: 14 }, (_, i) => novyChodec(i));
const DVERE_OBCHODU = () => I_OBCHOD * KROK + (stupenFasady(s.n) <= 1 ? 480 : 360);
const Y_ULICA = 96, Y_DVERE = 8;
// Kde zákazníka obslúžia: búda (stupeň 1) cez okienko pri pulte, od štítu (stupeň 2) dnu cez dvere.
const bodSluzby = () => I_OBCHOD * KROK + (stupenFasady(s.n) <= 1 ? 205 : 360);
// Časová os obsluhy (s): vystúpi ku dverám 0,4, vo výklade príde k pultu 0,35, predavač podá vrece v 0,75 až
// 1,1 (let vreca 0,35), odíde od pultu 1,1 až 1,45, vyjde 0,4. Spolu asi 2,25 s, jeden cyklus obchodu je 2 s.
const T_HORE = 0.4, T_PODA = 0.75, T_VRECE = 0.35, T_DNU = 1.45, T_VON = 0.4;
let sluzbaB = null;

function hustota() {
  const pr = prijemTeraz(s) || (s.cyklus >= 0 ? prijemZaS(s.n, s.nab) * 0.5 : 0);
  return Math.max(2, Math.min(maxChodcov(), 2 + Math.floor(Math.log10(1 + pr) * 1.6)));
}

function okrajPohladu() { const pol = W / 2 / m; return { a: camX - pol - 160, b: camX + pol + 160 }; }

function spawn(b, zStrany) {
  const o = okrajPohladu();
  b.aktivny = true; b.stav = STAV.IDE; b.nesie = false; b.y = Y_ULICA;
  b.smer = zStrany === undefined ? (Math.random() < 0.5 ? 1 : -1) : zStrany;
  b.x = b.smer > 0 ? o.a : o.b;
  b.v = (0.32 + Math.random() * 0.11) * VYSKA_BABKY;
  b.kostym = Math.floor(Math.random() * kostymy.length);
  b.faza = Math.random(); b.hy = 0; b.hv = 0;
}

// Pošle k obchodu najbližšieho chodca bez tovaru (najviac 3 naraz na ceste alebo v rade).
function posliKDveram() {
  if (stupenFasady(s.n) < 1) return;
  let naCeste = 0;
  for (const b of CHODCI) if (b.aktivny && (b.stav === STAV.K_DVERAM || b.stav === STAV.RAD)) naCeste++;
  if (naCeste >= 3) return;
  const dx = bodSluzby();
  let naj = null, d = Infinity;
  for (const b of CHODCI) if (b.aktivny && (b.stav === STAV.IDE || b.stav === STAV.STOJI) && !b.nesie) { const q = Math.abs(b.x - dx); if (q < d) { d = q; naj = b; } }
  if (!naj || d > W / m) {
    naj = CHODCI.find(b => !b.aktivny && b.i < maxChodcov());
    if (!naj) return;
    spawn(naj, camX < dx ? -1 : 1);
  }
  naj.stav = STAV.K_DVERAM; naj.cielX = dx; naj.smer = naj.x < dx ? 1 : -1;
}

function uvolniSluzbu() {
  sluzbaB = null;
  // rad sa pohne: kto čakal, ide k dverám; prvý dôjde a na rad príde, ostatní sa zastavia znova
  for (const b of CHODCI) if (b.aktivny && b.stav === STAV.RAD) { b.stav = STAV.K_DVERAM; b.smer = b.x < b.cielX ? 1 : -1; }
}

const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);

function krokChodcov(dt) {
  const o = okrajPohladu(), chcem = hustota();
  let aktivnych = 0, vRade = 0;
  for (const b of CHODCI) if (b.aktivny) { aktivnych++; if (b.stav === STAV.RAD) vRade++; }
  if (aktivnych < chcem) { const b = CHODCI.find(x => !x.aktivny && x.i < maxChodcov()); if (b) spawn(b); }
  for (const b of CHODCI) {
    if (!b.aktivny) continue;
    switch (b.stav) {
      case STAV.STOJI:
        b.cas -= dt; if (b.cas <= 0) b.stav = STAV.IDE; krokBabky(b, dt); break;
      case STAV.RAD:
        krokBabky(b, dt); break;
      case STAV.HORE: {
        // krok na chodník ku dverám (alebo k pultu búdy), nohy kráčajú na mieste
        b.cas += dt; b.faza += dt * 1.6;
        const e = easeOut(Math.min(1, b.cas / T_HORE));
        b.y = Y_ULICA + (Y_DVERE - Y_ULICA) * e;
        if (b.cas >= T_HORE) { b.y = Y_DVERE; b.stav = stupenFasady(s.n) <= 1 ? STAV.PULT : STAV.DNU; b.cas = 0; if (b.stav === STAV.PULT) b.smer = -1; }
        break;
      }
      case STAV.DNU: case STAV.PULT:
        b.cas += dt;
        if (b.stav === STAV.PULT) krokBabky(b, dt);
        if (b.cas >= T_PODA && anim.vreceT < 0 && !b.nesie) anim.vreceT = 0;
        if (b.cas >= T_DNU) { b.nesie = true; b.stav = STAV.VON; b.cas = 0; b.smer = Math.random() < 0.5 ? 1 : -1; }
        break;
      case STAV.VON: {
        b.cas += dt; b.faza += dt * 1.6;
        const e = easeOut(Math.min(1, b.cas / T_VON));
        b.y = Y_DVERE + (Y_ULICA - Y_DVERE) * e;
        if (b.cas >= T_VON) { b.y = Y_ULICA; b.stav = STAV.IDE; uvolniSluzbu(); }
        break;
      }
      default: {
        const dopad = krokBabky(b, dt);
        if (dopad && Math.random() < 0.35) pustiPrach(b.x - b.smer * 10, 92, 0.6);
        if (b.stav === STAV.K_DVERAM) {
          const ostava = (b.cielX - b.x) * b.smer;
          const radOdstup = 64 + 52 * vRade;
          if (sluzbaB && ostava <= radOdstup) { b.stav = STAV.RAD; vRade++; }   // zastaví sa, kde je (bez skoku späť)
          else if (ostava <= 0) {
            b.x = b.cielX;
            if (sluzbaB) { b.x = b.cielX - b.smer * radOdstup; b.stav = STAV.RAD; vRade++; }
            else { sluzbaB = b; b.stav = STAV.HORE; b.cas = 0; }
          }
        } else if (Math.random() < dt / 25) { b.stav = STAV.STOJI; b.cas = 0.5 + Math.random() * 1.5; }
        if (b.stav === STAV.IDE && (b.x < o.a - 200 || b.x > o.b + 200)) b.aktivny = false;
      }
    }
  }
  if (anim.vreceT >= 0) {
    anim.vreceT += dt;
    if (anim.vreceT >= T_VRECE) { anim.vreceT = -1; if (sluzbaB) sluzbaB.nesie = true; }
  }
}

// Dvere sú otvorené, kým zákazník vchádza alebo vychádza (stupeň 2 a vyššie).
function dvereOtvorene() {
  const b = sluzbaB;
  if (!b || stupenFasady(s.n) < 2) return false;
  return (b.stav === STAV.HORE && b.cas > T_HORE * 0.45) || (b.stav === STAV.DNU && (b.cas < 0.25 || b.cas > T_DNU - 0.2)) || (b.stav === STAV.VON && b.cas < T_VON * 0.7);
}

// Ľudia v interiéri zhora: prídu od dverí k pultu, predavač ich obslúži (dostanú vrece), pozrú si kus nábytku
// a odídu dverami. Predavač sa za pultom presúva k tomu, koho obsluhuje.
// Trasy vedú okolo pultu a nábytku (trasy.mjs, nález 1 brány M0 pokus 2): body trasy sa spočítajú raz pri
// novom cieli, v snímke sa len ide k ďalšiemu bodu.
const PREKAZKY = prekazky(MIESTA_XY);
let POHLAD = MIESTA_XY.map((q) => bodPohladu(q, PREKAZKY));   // po nakreslení menoviek aj mimo nich
const PULT = MIESTA_XY[0], Y_PRED_PULTOM = PULT.y + PULT.h + PRED_PULTOM, PK = OD_KONCA_PULTU;
const LUDIA_DNU = Array.from({ length: 3 }, (_, i) => ({ x: DVERE_TRASY.x, y: DVERE_TRASY.y, trasa: [], ti: 0, uhol: -Math.PI / 2, stav: 0, cas: 0.3 + i * 1.5, nesie: false, k: i }));
const PREDAVAC = { x: 360, y: PULT.y - PREDAVAC_NAD, cx: 360, uhol: Math.PI / 2 };
const KABATY_DNU = ['skala', 'salvia', 'drevo'], KLOBUKY_DNU = ['atrament', 'hlina', 'papier'];
function chod(l, x, y) {
  l.trasa = trasa(l.x, l.y, x, y, PREKAZKY) || [[x, y]]; l.ti = 0;
}
function krokLudi(dt) {
  let obsluhuje = -1;
  for (const l of LUDIA_DNU) {
    if (l.ti < l.trasa.length) {
      const c = l.trasa[l.ti], dx = c[0] - l.x, dy = c[1] - l.y, d = Math.hypot(dx, dy);
      if (d > 2) { const v = Math.min(d, 120 * dt); l.x += dx / d * v; l.y += dy / d * v; l.uhol = Math.atan2(dy, dx); continue; }
      l.x = c[0]; l.y = c[1]; l.ti++;
      if (l.ti < l.trasa.length) continue;
    }
    if (l.stav === 2 && obsluhuje < 0) obsluhuje = l.k;
    if ((l.cas -= dt) > 0) continue;
    if (l.stav === 0) { l.x = DVERE_TRASY.x; l.y = DVERE_TRASY.y; l.nesie = false; chod(l, PULT.x + PK + Math.random() * (PULT.w - 2 * PK), Y_PRED_PULTOM); l.stav = 1; l.cas = 0; }
    else if (l.stav === 1) { l.stav = 2; l.cas = 1.1; l.uhol = -Math.PI / 2; }
    else if (l.stav === 2) {
      l.nesie = true;
      const kusy = s.nab.reduce((a, x, i) => (x > 0 && i > 0 ? a.concat(i) : a), []);
      if (kusy.length && Math.random() < 0.7) {
        const q = POHLAD[kusy[Math.floor(Math.random() * kusy.length)]];
        chod(l, q.x, q.y); l.stav = 3; l.cas = 0.9;
      } else { chod(l, DVERE_TRASY.x, DVERE_TRASY.y); l.stav = 4; l.cas = 0; }
    } else if (l.stav === 3) { chod(l, DVERE_TRASY.x, DVERE_TRASY.y); l.stav = 4; l.cas = 0; }
    else if (l.stav === 4) { l.stav = 0; l.cas = 0.4 + Math.random() * 1.6; }
  }
  // predavač za pultom ide k zákazníkovi pri pulte
  if (obsluhuje >= 0) PREDAVAC.cx = Math.max(PULT.x + PK, Math.min(PULT.x + PULT.w - PK, LUDIA_DNU[obsluhuje].x));
  const d = PREDAVAC.cx - PREDAVAC.x;
  if (Math.abs(d) > 1) PREDAVAC.x += Math.sign(d) * Math.min(Math.abs(d), 90 * dt);
}

// ---------- ekonomika a deje ----------
let akumulator = 0, poslednyCas = performance.now(), mincaPocitadlo = 0, dalsieUlozenie = 5;
let zobrazene = s.peniaze, zobrazeneV = 0;

function tik(dt) {
  akumulator += dt;
  while (akumulator >= 0.1) {
    akumulator -= 0.1;
    const r = krok(s, 0.1);
    if (r.cyklov) {
      pustiMincu(DVERE_OBCHODU(), stupenFasady(s.n) <= 1 ? -280 : -320);
      if (s.man) posliKDveram();
      if (!s.man || (++mincaPocitadlo % 3 === 0)) zvuk.minca();
    }
    dalsieUlozenie -= 0.1;
    if (dalsieUlozenie <= 0) { dalsieUlozenie = 5; uloz(); }
  }
}

function uloz() { s.t = Date.now(); ulozisko.uloz(s, Date.now()); }

function tukniBudovu(i) {
  zvuk.start(); zvuk.zobud();
  anim.tukT = 0; anim.tukBudova = i;
  if (i === I_OBCHOD) {
    const r = tukObchod(s, performance.now());
    if (r.typ === 'start') { zvuk.tuk(1); posliKDveram(); }
    else if (r.typ === 'minca') { zvuk.tuk(1); pustiMincu(DVERE_OBCHODU(), -320); }
    else zvuk.tlmeny();
  } else if (i === I_STUDNA) { tukStudna(s); zvuk.vedro(); pustiPrach(360, -10, 1.2); }
  else zvuk.tlmeny();
  if (aktivna !== i) vyber(i);
}

function vyber(i) {
  aktivna = i;
  if (lay.jednaBudova) { camCiel = i; }
  if (i !== I_OBCHOD && interierOtvor) prepniInterier(false);
  kartaZmenena = true;
}

let kupX = 1;
function kup() {
  zvuk.start();
  const r = kupUroven(s, kupX);
  if (!r) { zvuk.tlmeny(); return; }
  zvuk.kupa();
  anim.tukT = 0; anim.tukBudova = I_OBCHOD;
  if (r.fasada) {
    const predV = vyskaObchodu(stupenFasady(s.n - kupX)), noveV = vyskaObchodu(stupenFasady(s.n));
    anim.rastDy = Math.max(60, noveV - predV);
    // nový modul vyjde zdola, keď je jeho obrázok hotový (dekódovanie trvá pár snímok)
    postavBudovu(I_OBCHOD).then(() => { anim.rastT = zniz ? -1 : 0; });
    zvuk.milnik();
    for (let k = 0; k < 8; k++) pustiPrach(I_OBCHOD * KROK + (k % 2 ? POZEMOK + 20 : -20), -10 - k * 6, 1.3, (k % 2 ? 40 : -40));
    uloz();
  } else if (pracovnikov(s.n) !== pracovnikov(s.n - kupX)) postavBudovu(I_OBCHOD);
  kartaZmenena = true;
}

function najmi() {
  zvuk.start();
  if (!najmiManazera(s)) { zvuk.tlmeny(); return; }
  zvuk.najatie(); postavBudovu(I_OBCHOD); uloz(); kartaZmenena = true;
  $('veta').textContent = MANAZER.veta; $('veta').hidden = false;
  setTimeout(() => { $('veta').hidden = true; }, 6000);   // veta manažéra len pri najatí, potom karta ostane krátka
}

let vybraneMiesto = 0, hoverMiesto = -1;
function kupKus(i) {
  zvuk.start();
  const r = kupNabytok(s, i);
  if (!r) { zvuk.tlmeny(); return; }
  zvuk.nabytok();
  anim.nabytokMiesto = i; anim.nabytokT = zniz ? -1 : 0;
  postavInterier();
  // prvý človek, ktorý práve nič nerobí, si nový kus do 2 s pozrie
  const l = LUDIA_DNU.find(x => x.stav === 0 || x.stav === 4) || LUDIA_DNU[0];
  const q = POHLAD[i];
  if (i > 0) { if (l.stav === 0) { l.x = DVERE_TRASY.x; l.y = DVERE_TRASY.y; } chod(l, q.x, q.y); l.stav = 3; l.cas = 1.2; }
  uloz(); kartaZmenena = true;
}

function prepniInterier(otvor) {
  if (otvor && !interierOtvoreny(s)) return;
  if (otvor === interierOtvor) return;
  interierOtvor = otvor;
  document.body.classList.toggle('dnu', otvor);
  hoverMiesto = -1;
  kartaZmenena = true;
  if (!otvor) { anim.interierCaka = false; anim.interierT = zniz ? -1 : 0; anim.interierSmer = -1; return; }
  // pôdorys vyjde zo stopy obchodu, až keď sú obrázky podlahy a menoviek dekódované (1 až 3 snímky)
  cielInterieru(); anim.interierCaka = true;
  postavInterier().then(() => {
    if (!interierOtvor || !anim.interierCaka) return;
    anim.interierCaka = false; anim.interierT = zniz ? -1 : 0; anim.interierSmer = 1;
    zvuk.fasada();
  });
}

function interierP() {
  if (anim.interierCaka) return 0;
  return anim.interierT < 0 ? (interierOtvor ? 1 : 0) : (anim.interierSmer > 0 ? springStep(PRESETS.enter, anim.interierT) : 1 - springStep(PRESETS.enter, anim.interierT));
}

// ---------- skladanie snímky: len transformácie predkreslených plátien ----------
let gxOff = 0, camKresl = NaN, uholKresl = NaN, intKresl = NaN;
let trObchod = ['', '', ''];
const sx = (wx) => Math.round((gxOff + wx * m) * dpr);
const sy = (wy) => Math.round((zemR + wy * m) * dpr);

function polohaVrstiev() {
  gxOff = r(W / 2 - camX * m);
  if (camX === camKresl) return;
  camKresl = camX;
  for (let i = 0; i < VRSTVY.length; i++) {
    const L = VRSTVY[i];
    L.el.style.transform = `translate3d(${r(W / 2 + (L.x0 - camX * L.p) * m)}px,0,0)`;
  }
  EL.ulica.style.transform = `translate3d(${gxOff}px,0,0)`;
}

function transformBudov(intP) {
  const tukS = anim.tukT >= 0 && anim.tukT < 0.15 && !zniz ? 1 - 0.03 * Math.sin(Math.PI * anim.tukT / 0.15) : 1;
  for (let i = 0; i < POCET; i++) {
    let dy = 0, sc = anim.tukBudova === i ? tukS : 1;
    if (i === I_OBCHOD) {
      if (anim.rastT >= 0) dy = (1 - springStep(PRESETS.enter, anim.rastT)) * anim.rastDy * m;
      if (intP > 0) dy -= intP * (zem + 60);           // fasáda sa zdvihne nad obrazovku
    }
    const t = dy !== 0 || sc !== 1 ? `translate3d(0,${dy.toFixed(1)}px,0) scale(${sc.toFixed(4)})` : 'none';
    if (t !== trObchod[i]) { EL.b[i].style.transform = t; trObchod[i] = t; }
  }
  if (!zniz && anim.uhol !== uholKresl) {
    const lx = gxOff + (I_STUDNA * KROK + VETERNIK.x) * m, rl = VETERNIK.r * m;
    if (lx > -rl && lx < W + rl) { EL.lopatky.style.transform = `rotate(${anim.uhol.toFixed(3)}rad)`; uholKresl = anim.uhol; }
  }
}

function transformInterieru(intP) {
  if (intP === intKresl) return;
  intKresl = intP;
  if (intP <= 0) { if (!EL.interier.hidden) EL.interier.hidden = true; return; }
  if (EL.interier.hidden) EL.interier.hidden = false;
  if (intP >= 1) { EL.interier.style.transform = 'none'; return; }
  // FLIP: zo stopy obchodu na ulici (mierka m) do cieľa (mierka mI), len transform
  const s0 = m / mI, fx = gxOff + (I_OBCHOD * KROK - OKRAJ_I) * m, fy = zemR - (540 + OKRAJ_I) * m;
  const sc = s0 + (1 - s0) * intP;
  EL.interier.style.transform = `translate3d(${((fx - IT.x) * (1 - intP)).toFixed(1)}px,${((fy - IT.y) * (1 - intP)).toFixed(1)}px,0) scale(${sc.toFixed(4)})`;
}

// ---------- živé plátno ulice ----------
// Dvere a výklad: malé plátno v skupine ulice (súradnice pozemku obchodu). Kreslí sa len počas obsluhy;
// keď nie je čo ukázať, zmaže sa raz a potom sa ho snímka nedotkne (prehliadač ho nekopíruje).
function kresliDvere(intP) {
  const b = sluzbaB, st = stupenFasady(s.n);
  const otvorene = intP === 0 && dvereOtvorene();
  const vyklad = intP === 0 && b && b.stav === STAV.DNU && st >= 2;
  const vrece = intP === 0 && anim.vreceT >= 0 && b;
  if (!otvorene && !vyklad && !vrece) {
    // skryté plátno prehliadač kompozítoru nekopíruje
    if (dvereKreslene) { G.dvere.setTransform(1, 0, 0, 1, 0, 0); G.dvere.clearRect(0, 0, EL.dvere.width, EL.dvere.height); EL.dvere.style.visibility = 'hidden'; dvereKreslene = false; }
    return;
  }
  const g = G.dvere, k = m * dpr;
  const X = (wx) => Math.round((wx - DV.x0) * k), Y = (wy) => Math.round((wy - DV.y0) * k);
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, EL.dvere.width, EL.dvere.height);
  if (!dvereKreslene) { EL.dvere.style.visibility = 'visible'; dvereKreslene = true; }
  if (otvorene) {
    // tmavý otvor (v noci svetlo zvnútra) a úzke krídlo pri pánte
    const x0 = X(DVERE_ULICA.x0), x1 = X(DVERE_ULICA.x1), y0 = Y(DVERE_ULICA.y0), y1 = Y(0);
    g.fillStyle = noc ? P.lampa : P.atrament; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    const w = Math.max(3, Math.round(20 * k));
    g.fillStyle = P.hlina; g.fillRect(x0 - Math.round(4 * k), y0, w, y1 - y0);
    g.fillStyle = P.atrament; g.fillRect(x0 - Math.round(4 * k) + w, y0, Math.max(1, Math.round(3 * k)), y1 - y0);
  }
  if (vyklad) {
    // vo výklade: príde k pultu, predavač podá vrece, odíde k dverám
    const t = b.cas;
    let x, smer;
    if (t < 0.35) { x = 250 - 90 * easeOut(t / 0.35); smer = -1; }
    else if (t < 1.1) { x = 160; smer = -1; }
    else { x = 160 + 100 * Math.min(1, (t - 1.1) / 0.35); smer = 1; }
    const pSmer = b.smer; b.smer = smer;
    g.save(); g.beginPath();
    g.rect(X(VYKLAD.x0), Y(VYKLAD.y0), X(VYKLAD.x1) - X(VYKLAD.x0), Y(VYKLAD.y1) - Y(VYKLAD.y0)); g.clip();
    // v mierke predavačov vo výklade (hlava 15 jednotiek, bábka má 10): hlava v ich výške, pod pultom orezaný
    kresliBabku(g, kostymy[b.kostym], b, X(x), Y(-144), k * 1.5);
    g.restore(); b.smer = pSmer;
  }
  if (vrece) {
    // vrece letí od predavača k zákazníkovi po oblúku
    const e = easeOut(anim.vreceT / T_VRECE), spr = kostymy[b.kostym], vr = spr.vrece;
    let ax, ay, bx, by;
    const vm = st >= 2 ? 1.5 : 1.2;
    if (st >= 2) { ax = 128; ay = -296; bx = 146; by = -282; } else { ax = 205; ay = -150; bx = 215; by = -70; }
    g.setTransform(k * vm, 0, 0, k * vm, X(ax + (bx - ax) * e), Y(ay + (by - ay) * e - 34 * Math.sin(Math.PI * e)));
    g.drawImage(vr.c, -vr.ox / spr.s, -vr.oy / spr.s, vr.w / spr.s, vr.h / spr.s);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
}

// Lišta cyklu nad dverami: len transform výplne (scaleX), mení sa iba pri behu cyklu.
let listaKresl = -2;
function lista(intP) {
  const p = intP === 0 && s.cyklus >= 0 ? Math.min(1, s.cyklus / OBCHOD.t) : -1;
  const q = p < 0 ? -1 : Math.round(p * 140 * m * dpr) / (140 * m * dpr);
  if (q === listaKresl) return;
  if ((q < 0) !== (listaKresl < 0)) EL.lista.classList.toggle('bezi', q >= 0);
  if (q >= 0) EL.listaPlna.style.transform = `scaleX(${q.toFixed(4)})`;
  listaKresl = q;
}

// Pás chodcov: celé plátno je nízke (asi 100 px), preto sa maže celé.
function kresliZive(intP) {
  const ctx = G.dyn, Wd = platno.width;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, Wd, platno.height);
  const km = m * dpr;
  const py = (wy) => sy(wy) - pasY0;
  // chodci: najprv tí na chodníku pri dverách (sú ďalej), potom ulica
  for (let pas = 0; pas < 2; pas++) {
    for (const b of CHODCI) {
      if (!b.aktivny || b.stav === STAV.DNU) continue;
      if ((b.y < Y_ULICA - 1) !== (pas === 0)) continue;
      const X = sx(b.x);
      if (X < -100 || X > Wd + 100) continue;
      const hlbka = 1 - 0.06 * (Y_ULICA - b.y) / (Y_ULICA - Y_DVERE);
      kresliBabku(ctx, kostymy[b.kostym], b, X, py(b.y), km * hlbka);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // prach spod nôh a z okrajov rastúcej fasády
  for (const p of PRACH) {
    if (!p.aktivny) continue;
    const t = p.t / 0.5, rr = (6 + 14 * t) * p.r * km;
    ctx.globalAlpha = 0.55 * (1 - t);
    ctx.drawImage(prachSpr, sx(p.x + p.vx * p.t) - rr / 2, py(p.y - 20 * t) - rr / 2, rr, rr);
  }
  ctx.globalAlpha = 1;
  kresliDvere(intP);
  lista(intP);
}

// ---------- živé plátno interiéru (malé, len keď je interiér otvorený) ----------
function kresliInterierZivy() {
  const g = G.zivy, k = mI * dpr, ox = OKRAJ_I * k, oy = (540 + OKRAJ_I) * k;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, EL.zivy.width, EL.zivy.height);
  // výber a prejdenie myšou: obrys lampou okolo miesta
  for (let pas = 0; pas < 2; pas++) {
    const i = pas ? vybraneMiesto : hoverMiesto;
    if (i < 0 || (pas === 0 && i === vybraneMiesto)) continue;
    const q = MIESTA_XY[i];
    g.setTransform(k, 0, 0, k, ox, oy);
    g.beginPath(); g.rect(q.x - 12, q.y - 12, q.w + 24, q.h + 24);
    g.lineWidth = (pas ? 5 : 3) / mI * (lay.jednaBudova ? 1 : 1.2); g.strokeStyle = pas ? P.lampa : P.hlina;
    if (!pas) g.setLineDash([8 / mI, 6 / mI]);
    g.stroke(); g.setLineDash([]);
  }
  if ((anim.nabytokT >= 0 || anim.nabytokDrz) && anim.nabytokMiesto >= 0) {
    const sc = anim.nabytokT >= 0 ? 0.85 + 0.15 * springStep(PRESETS.press, anim.nabytokT) : 1, q = MIESTA_XY[anim.nabytokMiesto];
    const cx = q.x + q.w / 2, cy = q.y + q.h / 2;
    g.setTransform(k * sc, 0, 0, k * sc, ox + cx * k, oy + cy * k);
    g.translate(-cx, -cy);
    kresliKus(g, P, anim.nabytokMiesto, s.nab[anim.nabytokMiesto]);
  }
  // predavač za pultom a zákazníci
  const cs = Math.cos(PREDAVAC.uhol), sn = Math.sin(PREDAVAC.uhol);
  g.setTransform(k * cs, k * sn, -k * sn, k * cs, ox + PREDAVAC.x * k, oy + PREDAVAC.y * k);
  kresliClovekaZhora(g, P, P.salvia, P.hlina, false, true);
  for (const l of LUDIA_DNU) {
    if (l.stav === 0) continue;
    const c = Math.cos(l.uhol), n = Math.sin(l.uhol);
    g.setTransform(k * c, k * n, -k * n, k * c, ox + l.x * k, oy + l.y * k);
    kresliClovekaZhora(g, P, P[KABATY_DNU[l.k]], P[KLOBUKY_DNU[l.k]], l.nesie);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}

let cielMinceX = 0, cielMinceY = 0;

function krokAnim(dt) {
  if (anim.tukT >= 0) { anim.tukT += dt; if (anim.tukT > 0.2) anim.tukT = -1; }
  if (anim.rastT >= 0) { anim.rastT += dt; if (anim.rastT > 0.9) anim.rastT = -1; }
  if (anim.interierT >= 0) { anim.interierT += dt; if (anim.interierT > 0.9) anim.interierT = -1; }
  if (anim.nabytokT >= 0) { anim.nabytokT += dt; if (anim.nabytokT > 0.5) { anim.nabytokT = -1; anim.nabytokDrz = true; postavInterier(); } }
  if (!zniz) anim.uhol += dt * (0.6 + 0.4 * Math.sin(performance.now() / 4000));
  for (const p of PRACH) if (p.aktivny && (p.t += dt) > 0.5) p.aktivny = false;
  if (!zniz && (dalsiVietor -= dt) <= 0) { dalsiVietor = 8 + Math.random() * 12; pustiVietor(); }
  // kamera: kritická pružina camera (0,62; 1), bez prekmitu
  if (lay.jednaBudova && !tahanie) {
    const ciel = stredBudovy(camCiel);
    if (zniz) { camX = ciel; camV = 0; }
    else {
      const w = 2 * Math.PI / PRESETS.camera.response;
      for (let k = 0; k < 4; k++) { const h = dt / 4; camV += (-w * w * (camX - ciel) - 2 * w * camV) * h; camX += camV * h; }
      if (Math.abs(camX - ciel) < 0.05 && Math.abs(camV) < 0.5) { camX = ciel; camV = 0; }
    }
  }
}

function kresli() {
  polohaVrstiev();
  const intP = interierP();
  transformBudov(intP);
  transformInterieru(intP);
  kresliZive(intP);
  if (intP > 0) kresliInterierZivy();
}

// ---------- karta budovy (DOM, mení sa len pri zmene) ----------
let kartaZmenena = true;
function nastav(el, text) { if (el.textContent !== text) el.textContent = text; }
function nastavTl(el, text, povolene) { nastav(el, text); if (el.disabled === povolene) el.disabled = !povolene; }

function karta() {
  const k = $('karta');
  const mod = interierOtvor ? 'interier' : ['studna', 'obchod', 'holic'][aktivna];
  if (k.dataset.mod !== mod) { k.dataset.mod = mod; kartaZmenena = true; }
  if (mod === 'obchod') {
    nastav($('k-meno'), 'General Store');
    const pr = prijemZaS(s.n, s.nab);
    nastav($('k-uroven'), `Level ${s.n}`);
    nastav($('k-prijem'), s.man ? `$${fmt(pr)}/s, runs by itself` : `$${fmt(pr * OBCHOD.t)} per customer. Tap the store.`);
    // najbližšia zmena vzhľadu a najbližší míľnik príjmu zvlášť (nález 4 brány M0)
    nastav($('k-dalsie'), dalsieCiele(s.n).riadky.join('\n'));
    nastavTl($('k-kup'), `Buy ${kupX}  $${fmt(cenaUrovni(s.n, kupX))}`, s.peniaze >= cenaUrovni(s.n, kupX));
    $('k-x1').setAttribute('aria-pressed', String(kupX === 1)); $('k-x10').setAttribute('aria-pressed', String(kupX === 10));
    if (s.man) { $('k-najmi').hidden = true; nastav($('k-manazer'), `Manager: ${MANAZER.meno}`); $('k-manazer').hidden = false; }
    else { $('k-najmi').hidden = false; $('k-manazer').hidden = true; nastavTl($('k-najmi'), `Hire a manager  $${fmt(cenaManazera())}`, s.peniaze >= cenaManazera()); }
    nastavTl($('k-interier'), interierOtvoreny(s) ? 'Interior' : `Interior at level ${E.nabytok.odUrovne}`, interierOtvoreny(s));
  } else if (mod === 'interier') {
    nastav($('k-meno'), 'Inside the store');
    const i = vybraneMiesto, st = s.nab[i], cena = cenaDalsiehoKusu(s);
    nastav($('k-uroven'), `${MIESTA[i].meno} ${st ? MIESTO_MENA[st - 1] : '(empty)'}`);
    nastav($('k-prijem'), st >= 3 ? 'Fully furnished.' : `${MIESTA[i].meno} ${MIESTO_MENA[st]}: store income x1.25`);
    nastav($('k-dalsie'), `Store income now $${fmt(prijemZaS(s.n, s.nab))}/s`);
    nastavTl($('k-kus'), st >= 3 ? 'Done' : `Buy  $${fmt(cena)}`, st < 3 && s.peniaze >= cena);
    const tl = $('k-miesta').children;
    for (let j = 0; j < 6; j++) { nastav(tl[j], `${MIESTA[j].meno} ${s.nab[j] ? MIESTO_MENA[s.nab[j] - 1] : ''}`.trim()); tl[j].setAttribute('aria-pressed', String(j === i)); }
  } else if (mod === 'studna') {
    nastav($('k-meno'), 'Well');
    nastav($('k-uroven'), s.vedier ? `${s.vedier} buckets drawn` : 'The reason this town exists');
    nastav($('k-prijem'), 'Tap to draw a bucket. In the next build, water limits the whole street.');
    nastav($('k-dalsie'), '');
  } else {
    nastav($('k-meno'), 'Barber');
    nastav($('k-uroven'), 'Closed');
    nastav($('k-prijem'), 'Opens in the next build. In this test only the General Store works.');
    nastav($('k-dalsie'), '');
  }
  kartaZmenena = false;
}

// ---------- počítadlo peňazí (pružina snappy) ----------
function krokPocitadla(dt) {
  const ciel = s.peniaze;
  if (zniz || Math.abs(ciel - zobrazene) > Math.max(1e6, ciel * 10)) { zobrazene = ciel; zobrazeneV = 0; }
  else {
    const w = 2 * Math.PI / PRESETS.snappy.response, z = PRESETS.snappy.damping;
    zobrazeneV += (-w * w * (zobrazene - ciel) - 2 * z * w * zobrazeneV) * dt; zobrazene += zobrazeneV * dt;
    if (Math.abs(zobrazene - ciel) < 0.5) { zobrazene = ciel; zobrazeneV = 0; }
  }
  nastav($('suma'), '$' + fmt(Math.max(0, Math.floor(zobrazene))));
  nastav($('zaS'), s.man ? `$${fmt(prijemTeraz(s))}/s` : 'tap to serve');
}

// ---------- slučka ----------
let posledneKreslenie = 0, poslednyVstup = performance.now(), bezi = true, kartaCas = 0;
const MER = { IV: new Float32Array(20000), JS: new Float32Array(20000), n: 0, posledne: 0, spicky: [] };
if (MERANIE) window.__ws = { get IV() { return MER.IV; }, get JS() { return MER.JS; }, get n() { return MER.n; }, get spicky() { return MER.spicky; }, reset() { MER.n = 0; MER.posledne = 0; MER.spicky.length = 0; for (const k in DEMO_POCTY) DEMO_POCTY[k] = 0; }, get stav() { return s; }, get slabe() { return slabe; }, get dpr() { return dpr; },
  obnov() { kluce[0] = kluce[1] = kluce[2] = ''; postavVsetko(); kartaZmenena = true; }, interier(o) { prepniInterier(o); }, vyber(i) { camCiel = i; vyber(i); },
  miesto(i) { vybraneMiesto = i; kartaZmenena = true; }, get sluzba() { return sluzbaB ? { stav: sluzbaB.stav, cas: sluzbaB.cas, x: sluzbaB.x, y: sluzbaB.y, nesie: sluzbaB.nesie } : null; },
  get it() { return { x: IT.x, y: IT.y, mI, sirka: (POZEMOK + 2 * OKRAJ_I) * mI, vyska: (540 + 2 * OKRAJ_I) * mI, okraj: OKRAJ_I, miesta: MIESTA_XY }; },
  get otvoreny() { return interierOtvor; }, get obchod() { return { x: gxOff + (I_OBCHOD * KROK + POZEMOK / 2) * m, y: zemR - 200 * m }; }, get vybrane() { return vybraneMiesto; }, posli() { posliKDveram(); },
  get demo() { return { ...DEMO_POCTY }; },
  get ludia() { return LUDIA_DNU.map((l) => ({ stav: l.stav, x: Math.round(l.x), y: Math.round(l.y), nesie: l.nesie })); } };

function snimka(teraz) {
  if (!bezi) return;
  requestAnimationFrame(snimka);
  const necinne = teraz - poslednyVstup;
  // bez obmedzenia pri hraní; po 30 s bez vstupu 30 snímok za s, po 3 min 15 (GDD 5.4)
  const cielFps = DEMO ? 0 : necinne > 180000 ? 15 : necinne > 30000 ? 30 : 0;
  if (cielFps && teraz - posledneKreslenie < 1000 / cielFps - 2) return;
  const dt = Math.min(0.1, (teraz - (posledneKreslenie || teraz)) / 1000);
  if (MERANIE && MER.posledne) {
    MER.IV[MER.n % 20000] = teraz - MER.posledne;
    // špičky nad 50 ms aj s tým, čo sa vtedy dialo (fáza scenára interiéru, otvorený interiér)
    if (teraz - MER.posledne > 50 && MER.spicky.length < 20) MER.spicky.push({ ms: Math.round(teraz - MER.posledne), n: MER.n, faza: +demoIntT.toFixed(2), dnu: interierOtvor, anim: anim.interierT >= 0 });
  }
  const t0 = performance.now();
  if (posledneKreslenie && !cielFps) sledujSlabe(teraz - posledneKreslenie);
  posledneKreslenie = teraz;
  tik((teraz - poslednyCas) / 1000); poslednyCas = teraz;
  krokAnim(dt); krokChodcov(dt); if (interierOtvor || anim.interierT >= 0) krokLudi(dt);
  if (!zniz) zvuk.vrzganie(1);
  kresli();
  krokPocitadla(dt);
  kartaCas -= dt;
  if (kartaZmenena || kartaCas <= 0) { karta(); kartaCas = 0.2; }
  if (DEMO) demo(dt);
  if (MERANIE) { if (MER.posledne) { MER.JS[MER.n % 20000] = performance.now() - t0; MER.n++; } MER.posledne = teraz; }
}

// ---------- vstup ----------
// #scena vypĺňa celé okno (position fixed, inset 0), preto clientX a clientY sú priamo súradnice scény:
// žiadne čítanie rozloženia pri dotyku.
let tahanie = false, tahStart = 0, tahCam = 0, tahPosun = 0;
const VZORKY = Array.from({ length: 8 }, () => [0, 0]); let vzN = 0;
function naSvet(clientX, clientY) { return { x: camX + (clientX - W / 2) / m, y: (clientY - zem) / m }; }
function trafBudovu(w) {
  for (let i = 0; i < POCET; i++) { const x0 = i * KROK; if (w.x >= x0 - 40 && w.x <= x0 + POZEMOK + 40 && w.y <= 40 && w.y >= -1400) return i; }
  return -1;
}
// bod obrazovky na miesto v pôdoryse interiéru (-1 mimo); tolerancia 16 jednotiek, na mobile 24
function trafMiesto(clientX, clientY) {
  const lx = (clientX - IT.x) / mI - OKRAJ_I, ly = (clientY - IT.y) / mI - OKRAJ_I - 540, t = lay.jednaBudova ? 24 : 16;
  for (let i = 0; i < 6; i++) { const q = MIESTA_XY[i]; if (lx >= q.x - t && lx <= q.x + q.w + t && ly >= q.y - t && ly <= q.y + q.h + t) return i; }
  return -1;
}
function vzorka(t, x) { const v = VZORKY[vzN % 8]; v[0] = t; v[1] = x; vzN++; }
scena.addEventListener('pointerdown', (e) => {
  poslednyVstup = performance.now();
  try { scena.setPointerCapture(e.pointerId); } catch { /* syntetická udalosť alebo starý prehliadač */ }
  tahanie = lay.jednaBudova && !interierOtvor; tahStart = e.clientX; tahCam = camX; tahPosun = 0; vzN = 0; vzorka(performance.now(), camX); camV = 0;
});
scena.addEventListener('pointermove', (e) => {
  if (interierOtvor && e.pointerType === 'mouse') {
    const i = trafMiesto(e.clientX, e.clientY);
    if (i !== hoverMiesto) { hoverMiesto = i; EL.interier.style.cursor = i >= 0 ? 'pointer' : 'default'; }
  }
  if (!tahanie) return;
  tahPosun = e.clientX - tahStart;
  camX = tahCam - tahPosun / m;
  vzorka(performance.now(), camX);
});
scena.addEventListener('pointerup', (e) => {
  poslednyVstup = performance.now();
  const bolTah = Math.abs(tahPosun) > 8;
  if (tahanie) {
    tahanie = false;
    if (bolTah) {
      const n = Math.min(vzN, 8), a = VZORKY[(vzN - n) % 8], b = VZORKY[(vzN - 1) % 8], dtt = Math.max(16, b[0] - a[0]);
      const v = (b[1] - a[1]) / dtt * 1000;
      camV = zniz ? 0 : v * 0.35;
      const i = cielSvihu(camX, v, camCiel, POCET);
      if (i !== camCiel) { camCiel = i; vyber(i); }
      return;
    }
  }
  if (bolTah) return;
  if (interierOtvor) {
    const i = trafMiesto(e.clientX, e.clientY);
    if (i >= 0) { vybraneMiesto = i; kartaZmenena = true; zvuk.start(); zvuk.tuk(3); }
    return;
  }
  const i = trafBudovu(naSvet(e.clientX, e.clientY));
  if (i >= 0) tukniBudovu(i);
});
scena.addEventListener('pointercancel', () => { tahanie = false; });
scena.addEventListener('pointerleave', () => { if (hoverMiesto >= 0) { hoverMiesto = -1; } });
scena.addEventListener('keydown', (e) => {
  poslednyVstup = performance.now();
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!interierOtvor) tukniBudovu(aktivna); return; }
  const i = cielKlavesy(e.key, aktivna, POCET);
  if (i !== aktivna) { e.preventDefault(); camCiel = i; vyber(i); }
});
window.addEventListener('keydown', (e) => { if (e.target === document.body && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { const i = cielKlavesy(e.key, aktivna, POCET); camCiel = i; vyber(i); } });

$('vlavo').addEventListener('click', () => { poslednyVstup = performance.now(); const i = Math.max(0, aktivna - 1); camCiel = i; vyber(i); });
$('vpravo').addEventListener('click', () => { poslednyVstup = performance.now(); const i = Math.min(POCET - 1, aktivna + 1); camCiel = i; vyber(i); });
$('k-kup').addEventListener('click', () => { poslednyVstup = performance.now(); kup(); });
$('k-x1').addEventListener('click', () => { kupX = 1; kartaZmenena = true; });
$('k-x10').addEventListener('click', () => { kupX = 10; kartaZmenena = true; });
$('k-najmi').addEventListener('click', () => { poslednyVstup = performance.now(); najmi(); });
$('k-interier').addEventListener('click', () => { poslednyVstup = performance.now(); prepniInterier(true); });
$('k-spat').addEventListener('click', () => { poslednyVstup = performance.now(); prepniInterier(false); });
$('k-kus').addEventListener('click', () => { poslednyVstup = performance.now(); kupKus(vybraneMiesto); });
[...$('k-miesta').children].forEach((b, j) => b.addEventListener('click', () => { vybraneMiesto = j; kartaZmenena = true; }));
$('k-tuk').addEventListener('click', () => { poslednyVstup = performance.now(); tukniBudovu(aktivna); });
$('zvuk').addEventListener('click', () => {
  zvuk.start(); zvuk.prepni(!zvuk.zapnuty);
  $('zvuk').setAttribute('aria-pressed', String(zvuk.zapnuty)); nastav($('zvuk'), zvuk.zapnuty ? 'Sound on' : 'Sound off');
});
$('noc').addEventListener('click', () => {
  noc = !noc; document.body.classList.toggle('noc', noc);
  $('noc').setAttribute('aria-pressed', String(noc)); nastav($('noc'), noc ? 'Day' : 'Night');
  postavVsetko();
});

// ---------- životný cyklus stránky ----------
function schovane() { uloz(); zvuk.uspi(); bezi = false; }
function viditelne() {
  const r = offline(s, Date.now());
  if (r.suma > 0) ukazSpravu(`While you were away: $${fmt(r.suma)}${r.strop ? ' (3 h limit)' : ''}`);
  poslednyCas = performance.now(); posledneKreslenie = 0; zvuk.zobud();
  if (!bezi) { bezi = true; requestAnimationFrame(snimka); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) schovane(); else viditelne(); });
window.addEventListener('pagehide', () => uloz());
window.addEventListener('pageshow', (e) => { if (e.persisted) { postavVsetko(); viditelne(); } });
// strata kontextu ktoréhokoľvek plátna: po obnove prekresliť všetko
for (const c of scena.querySelectorAll('canvas')) {
  c.addEventListener('contextlost', (e) => { e.preventDefault(); });
  c.addEventListener('contextrestored', () => { kontexty(); postavVsetko(); });
}
let casRozmer = 0;
window.addEventListener('resize', () => { clearTimeout(casRozmer); casRozmer = setTimeout(() => { rozmer(); cielMince(); }, 120); });

function ukazSpravu(text) {
  const el = $('sprava'); el.textContent = text; el.hidden = false;
  clearTimeout(ukazSpravu.t); ukazSpravu.t = setTimeout(() => { el.hidden = true; }, 4000);
}

// cieľ mincí: počítadlo peňazí vpravo hore (rozmer sa číta len pri štarte a zmene okna)
function cielMince() { const r = $('suma').getBoundingClientRect(); cielMinceX = r.left + r.width / 2; cielMinceY = r.top + r.height / 2; }

// ---------- demo (meranie výkonu: hrá samo, švihá medzi budovami) ----------
let demoT = 0, demoSvih = 0;
// ?demo&interier (nález 3 brány M0 pokus 2): cyklus 10 s na meranie otvoreného interiéru. V 0,5 s otvorenie
// (FLIP), zákazníci chodia a obsluhujú, v 2, 3,5, 5 a 6,5 s kúpa kusu nábytku (dosadnutie, prekreslenie
// podlahy a menoviek, človek ide pozrieť), v 8 s návrat na ulicu, potom 2 s ulica.
const DEMO_INT = DEMO && Q.has('interier');
let demoIntT = 0, demoIntKus = 0, demoIntKrok = 0;
const DEMO_POCTY = { otvorenia: 0, kupy: 0, navraty: 0, snimokDnu: 0 };   // dôkaz v meraní, že scenár bežal
function demoInterier(dt) {
  const pred = demoIntT; demoIntT = (demoIntT + dt) % 10;
  const preslo = (t) => (pred < t && demoIntT >= t) || (demoIntT < pred && (pred < t || demoIntT >= t));
  if (interierOtvor) DEMO_POCTY.snimokDnu++;
  if (preslo(0.5)) { prepniInterier(true); DEMO_POCTY.otvorenia++; }
  for (const t of [2, 3.5, 5, 6.5]) if (preslo(t)) {
    if (s.nab.every((x) => x >= 3)) { s.nab = [1, 0, 0, 0, 0, 0]; postavInterier(); }
    let i = demoIntKus;
    for (let k = 0; k < 6 && s.nab[i] >= 3; k++) i = (i + 1) % 6;
    vybraneMiesto = i; kupKus(i); DEMO_POCTY.kupy++; demoIntKus = (i + 1 + (demoIntKrok++ % 2)) % 6;
  }
  if (preslo(8)) { prepniInterier(false); DEMO_POCTY.navraty++; }
}
function demo(dt) {
  if (DEMO_INT) { demoInterier(dt); return; }
  demoT += dt; demoSvih += dt;
  if (s.peniaze < 1e5 && demoT > 0.3) { demoT = 0; tukniBudovu(I_OBCHOD); }
  if (s.peniaze >= cenaUrovni(s.n, 10)) kup();
  if (!s.man && s.peniaze >= cenaManazera()) najmi();
  if (lay.jednaBudova && demoSvih > 2.2) { demoSvih = 0; const i = (camCiel + 1) % POCET; camCiel = i; vyber(i); }
}
if (DEMO) { s.peniaze = 2000; kupX = 10; }
if (DEMO_INT) { s.n = 60; s.man = true; s.cyklus = 0; s.peniaze = 1e15; s.nab = [1, 0, 0, 0, 0, 0]; }

// ---------- štart ----------
rozmer(); cielMince();
if (navrat.suma > 0) ukazSpravu(`While you were away: $${fmt(navrat.suma)}${navrat.strop ? ' (3 h limit)' : ''}`);
if (document.fonts && document.fonts.load) {
  Promise.all([document.fonts.load(`600 64px "ARLing Draw Text"`, 'GENERAL STORE'), document.fonts.load(`500 16px "ARLing Draw Text"`, 'Level')])
    .then(() => { kluce[0] = kluce[1] = kluce[2] = ''; postavVsetko(); }).catch(() => {});
}
requestAnimationFrame(snimka);
