/* Start hry: velkost platna, tlac vrstiev, uvodna stranka, vyber kapitoly, vstupy a nastavenia. */
import { Scena, MENA_SVETA } from './scena.js';
import { tlac } from './lis-klient.js';
import { vytvorSlucku } from './slucka.js';
import { vytvorVstup } from './vstup.js';
import { vytvorUI } from './ui.js';
import { vytvorPanely } from './panely.js';
import { Hra } from './hra.js';
import { ulozenie } from './ulozenie.js';
import { zvukPriprav, zvukNastav } from './zvuk.js';
import { TABLA } from './kulisy/tablo.js';
import { DETAILY } from './kulisy/detaily.js';
import { MENA69, TABLA69, DETAILY69 } from './kulisy/pariz.js';
import { DIELY69 } from './postavy69.js';
import * as R18 from './rezia18.js';
import * as R69 from './rezia69.js';

const koren = document.getElementById('mc');
const plocha = koren.querySelector('.mc-plocha');
const platno = document.getElementById('mc-platno');
const nacitava = document.getElementById('mc-nacitava');
const url = (p) => new URL('../' + p, import.meta.url).href;

const nastavenia = Object.assign({
  prepinac: false, znizeny: matchMedia('(prefers-reduced-motion: reduce)').matches,
  citatelne: false, riadky: true, zvuk: true, hlasitost: 0.7, bezCasu: false,
}, ulozenie.nastavenia());

const scena = new Scena(platno);
scena.st.kulisa = 'uvod';
let hra = null, bezi = false, kapitola = 18;
const KAPITOLY = { 18: { rezia: R18, data: null, kurziva: [], kniha: { od: 0, riadky: null } }, 69: { rezia: R69, data: null, kurziva: [], kniha: { od: 0, riadky: null } } };
const kap = () => KAPITOLY[kapitola];

/* co treba vytlacit pre kapitolu (svet, tabla, detaily, babky) */
const MENA = {
  18: () => [...MENA_SVETA, ...Object.keys(TABLA).filter((m) => m.startsWith('tablo') || m === 'mapa'), ...Object.keys(DETAILY).filter((m) => m.startsWith('det:'))],
  69: () => [...MENA69, ...Object.keys(DIELY69), ...Object.keys(TABLA69), ...Object.keys(DETAILY69)],
};
const POTREBNE = { 18: 'rez', 69: 'b69:rez' };

/* ── velkost: platno v celych zariadenovych pixeloch, mierka s najviac 2,6 ── */
let tlaceneS = 0, cakaTlac = 0;
const nacitane = new Set();
function rozmer() {
  const cw = plocha.clientWidth || 640;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let s = Math.min(2.6, Math.max(0.6, (cw * dpr) / 640));
  s = Math.round(640 * s) / 640;
  const w = Math.round(640 * s), h = Math.round(360 * s);
  if (platno.width !== w || platno.height !== h) { platno.width = w; platno.height = h; }
  scena.s = s;
  if (tlaceneS && Math.abs(s - tlaceneS) / tlaceneS > 0.12) {
    clearTimeout(cakaTlac);
    cakaTlac = setTimeout(() => pretlac(), 400);
  }
  slucka.vyziadaj();
}
const bunka = (s) => Math.max(2.6, s * 1.75);
async function vytlac(mena) {
  mena = mena.filter((m) => !nacitane.has(m));
  if (!mena.length) return;
  const s = scena.s;
  tlaceneS = tlaceneS || s;
  const mapa = await tlac(mena, s, bunka(s));
  if (Math.abs(scena.s - s) > 0.001) return vytlac(mena);
  scena.pridaj(mapa);
  mena.forEach((m) => nacitane.add(m));
  slucka.vyziadaj();
}
async function pretlac() {
  tlaceneS = scena.s;
  const mena = [...nacitane];
  const mapa = await tlac(mena, scena.s, bunka(scena.s));
  scena.pridaj(mapa);
  slucka.vyziadaj();
}
const tlacKapitoly = {};
function vytlacKapitolu(n) {
  if (!tlacKapitoly[n]) tlacKapitoly[n] = vytlac([`titul:${n}`, ...(n === 69 ? ['predtym69:1', 'predtym69:2', 'predtym69:3'] : [])]).then(() => vytlac(MENA[n]()));
  return tlacKapitoly[n];
}

/* ── slucka ── */
const slucka = vytvorSlucku((dt, t) => {
  const a = hra && bezi ? hra.update(dt, t) : false;
  const b = scena.snimka(dt, t);
  if (bezi && (scena.st.kulisa === 'svet' || scena.st.kulisa === 'dom')) nacitava.hidden = scena.B.has(POTREBNE[kapitola]);
  return a || b;
}, { okolie: !nastavenia.znizeny });
new ResizeObserver(rozmer).observe(plocha);

/* ── rozhranie ── */
const ui = vytvorUI(koren, { get kurziva() { return kap().kurziva; } });
const panely = vytvorPanely(koren, {
  get data() { return kap().data; },
  nastavenia,
  stav: () => (hra && hra.j ? hra.j.st : { dennik: new Set(), uzavrete: {}, dohrane: false }),
  jadro: () => (hra && hra.j ? hra.j : null),
  kniha: () => kap().kniha,
  historia: () => ui.historia(),
  ulozenieIde: () => ulozenie.funguje(),
  naNastavenia: aplikuj,
  naZnova: () => zacni(kapitola, null),
  naTitul: () => titul(),
});
function aplikuj(n) {
  koren.classList.toggle('mc-citatelne', !!n.citatelne);
  koren.classList.toggle('mc-bez-riadkov', !n.riadky);
  scena.znizeny = !!n.znizeny;
  scena.st.dych = !n.znizeny;
  koren.classList.toggle('mc-znizeny', !!n.znizeny);
  slucka.okolie(!n.znizeny);
  zvukNastav(n.hlasitost, !n.zvuk);
  ulozenie.ulozNastavenia(n);
  slucka.vyziadaj();
}
aplikuj(nastavenia);

let druhVstupu = 'klav';
window.addEventListener('keydown', () => { druhVstupu = 'klav'; if (hra) hra.vstupDruh = 'klav'; }, true);
window.addEventListener('pointerdown', (e) => { druhVstupu = e.pointerType === 'touch' ? 'dotyk' : 'klav'; if (hra) hra.vstupDruh = druhVstupu; }, true);

const vstup = vytvorVstup(koren, platno, nastavenia, (a, d) => {
  zvukPriprav();
  slucka.zobud();
  if (a === 'gamepad') { druhVstupu = d ? 'pad' : 'klav'; if (hra) hra.vstupDruh = druhVstupu; return; }
  if (typeof d === 'number' && a !== 'volba') { druhVstupu = 'pad'; if (hra) hra.vstupDruh = 'pad'; }
  /* gamepad A na tlacidle s fokusom (karty, vrstvy prevleku, stranky, Dennik) ho stlaci */
  if (a === 'interakcia' && typeof d === 'number') {
    const f = document.activeElement;
    if (f && f.matches && f.matches('button') && koren.contains(f) && !f.closest('.mc-drz') && !f.closest('.mc-ikony')) { f.click(); return; }
  }
  const otv = panely.otvoreny();
  if (otv) {
    if (a === 'pauza' || (a === 'dennik' && otv.id === 'mc-dennik') || (a === 'spat' && otv.id === 'mc-historia')) panely.zavri();
    return;
  }
  if (a === 'pauza') { panely.pauza(); return; }
  if (!bezi) { if (a === 'interakcia' && document.activeElement === plocha) zacni(18, ulozenie.kapitola(18)); return; }
  if (a === 'dennik') { panely.dennik(); return; }
  if (a === 'spat' && hra.rezim !== 'm19') { panely.historia(); return; }
  hra.vstupAkcia(a, d);
});
vstup.drzaneTlacidlo(document.getElementById('mc-oko'), 'pozornost');
vstup.drzaneTlacidlo(document.getElementById('mc-ucho'), 'pocuvanie');
document.getElementById('mc-b-dennik').addEventListener('click', () => { if (bezi) panely.dennik(); });
document.getElementById('mc-b-pauza').addEventListener('click', () => panely.pauza());
document.getElementById('mc-dalej').addEventListener('click', () => { zvukPriprav(); if (hra && bezi) hra.vstupAkcia('interakcia'); });
koren.querySelector('.mc-pas').addEventListener('click', (e) => { if (e.target.closest('[data-zachyt]') && hra) hra.zachytKlik(); });

/* ── uvodna stranka ── */
const startHtml = document.getElementById('mc-vrstva').innerHTML;
function titul() {
  if (hra) hra.zastav();
  bezi = false;
  scena.st.kulisa = 'uvod';
  scena.detail = null;
  ui.vycisti(); ui.vyzva(null); ui.dalej(false); ui.volby(null);
  const v = document.getElementById('mc-vrstva');
  v.className = 'mc-vrstva mc-aktivna mc-start-vrstva';
  v.innerHTML = startHtml;
  napojStart();
  slucka.vyziadaj();
}
function napojStart() {
  const v = document.getElementById('mc-vrstva');
  koren.classList.add('mc-vrstva-zap', 'mc-titul-rezim');
  for (const n of [18, 69]) {
    const u = ulozenie.kapitola(n);
    const pok = v.querySelector(`[data-pokracuj="${n}"]`);
    if (pok) {
      if (u && !u.dohrane && u.index > 0) pok.hidden = false;
      pok.addEventListener('click', () => zacni(n, ulozenie.kapitola(n)));
    }
    const b = v.querySelector(`[data-kap="${n}"]`);
    if (b) {
      b.addEventListener('click', () => zacni(n, null));
      /* kapitolu, na ktoru hrac mieri, zacni tlacit hned */
      b.addEventListener('pointerenter', () => vytlacKapitolu(n).catch(() => {}));
      b.addEventListener('focus', () => vytlacKapitolu(n).catch(() => {}));
    }
  }
  v.querySelector('[data-nastavenia]').addEventListener('click', () => panely.pauza());
}

async function nacitajData(n) {
  const K = KAPITOLY[n];
  if (K.data) return;
  const [d, k, t] = await Promise.all([
    fetch(url(`data/data-${n}.json`)).then((r) => r.json()),
    fetch(url(`data/kurziva-${n}.json`)).then((r) => r.json()).catch(() => []),
    fetch(url(`kniha/${n}.txt`)).then((r) => r.text()).catch(() => null),
  ]);
  K.data = d; K.kurziva = k;
  K.kniha = { od: d.rozsah_riadkov[0], riadky: t ? t.replace(/\n$/, '').split('\n') : null };
}

async function zacni(n, ulozene) {
  zvukPriprav();
  kapitola = n;
  await nacitajData(n);
  const tlacene = vytlacKapitolu(n);
  if (!nacitane.has(POTREBNE[n])) nacitava.hidden = false;
  /* titulna stranka kapitoly potrebuje svoju vinetu skor, nez ju ukaze */
  await Promise.race([tlacene, new Promise((r) => setTimeout(r, 1500))]);
  if (hra) hra.zastav();
  if (!ulozene) ulozenie.zmazKapitolu(n);
  const K = kap();
  hra = new Hra({ data: K.data, kurziva: K.kurziva, rezia: K.rezia, nastavenia, scena, ui, slucka, vstup, panely, ulozenie, platnoOpis: document.getElementById('mc-opis') });
  hra.vstupDruh = druhVstupu;
  hra.naZnova = () => zacni(n, null);
  hra.naTitul = () => titul();
  bezi = true;
  koren.classList.remove('mc-vrstva-zap', 'mc-titul-rezim');
  ui.vrstva(null);
  plocha.focus({ preventScroll: true });
  hra.start(ulozene && ulozene.kapitola === n ? ulozene : null);
}

/* ── tlac v poradi: uvod, svet kapitoly 18, potom kapitola 69 v pozadi ── */
rozmer();
napojStart();
(async () => {
  try {
    await vytlac(['uvod', 'titul:18', 'predtym:1', 'predtym:2', 'predtym:3']);
    await vytlacKapitolu(18);
    await vytlacKapitolu(69);
    window.__m0.vytlacene = true;
  } catch (e) {
    console.error(e);
    nacitava.hidden = false;
    nacitava.textContent = 'The scene could not be printed in this browser.';
  }
})();
nacitajData(18).catch(() => {});
window.__m0hra = () => hra;
window.__m0zacni = (n, u) => zacni(n, u || null);
