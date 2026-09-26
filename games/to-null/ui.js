// TO: NULL: vstup, udalosti a prepojenie modulov (SPEC 9). Logika ide z rozdielu Date.now() (kroky po 250 ms),
// dážď a pohyb z performance.now() cez requestAnimationFrame, len kým je karta viditeľná.

import * as E from './ekonomika.mjs';
import * as P from './pribeh.mjs';
import { cislo, cele, trvanie, tisice } from './format.mjs';
import { Dazd } from './dazd.js';
import { Terminal, ramHore, ramDole, sekcia, textPozornosti, zamok, tokText, rychlostToku, zasifruj } from './terminal.js';
import { vytvorZvuk } from './zvuk.js';
import * as U from './ulozenie.mjs';
import { obrazSektora, portret } from './ascii.mjs';
import { LISTY, ULICE, INICIALY } from './listy.mjs';
import { track, PRESETS, springStep } from './pohyb.js';
import { fixtura, T0 } from './ukazky.mjs';
import { TEMY } from './temy.mjs';

const doc = document;
const $ = (id) => doc.getElementById(id);
const hladanie = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const OBRAZOVKA = Math.max(0, Math.min(9, parseInt(hladanie.get('obrazovka') || '0', 10) || 0));
const DEBUG = hladanie.get('debug') === '1';
const mm = (q) => (typeof matchMedia === 'function' ? matchMedia(q) : { matches: false });
const REDUCED = mm('(prefers-reduced-motion: reduce)').matches;
const perf = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const okno = typeof window !== 'undefined' ? window : globalThis;

const POPISY = [
  'the kettle is on. come home when you can.', "i'm keeping the light on for you.", "the boat's in. saturday at the quay?",
  "fixed the bike. it's yours when you're back.", 'i can see your window from the bridge.', "i'll wait on the bench by the lamp.",
  "the door's open. it always was.",
];
const MILNIKY_LISTU = [1, 100, 250, 400, 600, 800, 1000];

// ------------------------------------------------------------ stav

let s;
let ls = null;
let zapis = true;
let spravaUlozenia = null;
let novsieUlozenie = null;
let scena = null;
if (OBRAZOVKA) {
  const f = fixtura(OBRAZOVKA);
  s = f.s;
  scena = f.scena;
  zapis = false;
} else {
  try { ls = okno.localStorage || null; } catch { ls = null; }
  const n = U.nacitaj(ls);
  zapis = n.zapis;
  spravaUlozenia = n.sprava;
  novsieUlozenie = n.novsia || null;
  s = n.stav || E.novyStav((Date.now() % 2147483647) >>> 0, Date.now());
  if (!n.stav) s.lastSeen = Date.now();
}

const beh = P.novyBeh();
const zvuk = vytvorZvuk(okno);
zvuk.nastav(s.snd.on && !OBRAZOVKA, s.snd.hum);
// Firefox: prvý AudioContext blokuje ~1,3 s, vznikne hneď po prvom vykreslení
if (s.snd.on && !OBRAZOVKA && typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(() => zvuk.priprav(), 0));
const dazd = new Dazd($('platno'), { doc, seed: OBRAZOVKA ? 1000 + OBRAZOVKA : s.seed ^ 0x9e3779b9, reduced: REDUCED || !!OBRAZOVKA });
const term = new Terminal($('log'), { doc, reduced: REDUCED || !!OBRAZOVKA, zvuk, stav: () => s });
term.sr = $('log-sr');

let hromadne = 1;
let moment = null;
let obraz = null;
let skryte = false;
let poslUlozenie = perf();
let poslUi = -1e9;
let telefon = mm('(max-width: 999px)').matches;
let znak = 9;
let cielStlpce = E.stlpce(s);
let stlpceOd = 0;
let pripravene = false;
const tmaT = track(s.darkMs > 0 ? 0.85 : 0, PRESETS.smooth);
const zisky = [];
const faza = { hook: 0, sieve: 0, thread: 0, bank: 0, loom: 0 };
const x2Do = {};
let mendBuf = null;
let posledneTempo = 0;
let carryVidno = false;
let koniecT = -1;
let sweep = null;
const tuky = [];

// zápis do DOM len pri zmene (kolo oprav 2: ui() beží 10× za sekundu)
function txt(e, t) { if (e && e.textContent !== t) e.textContent = t; }
function skry(e, v) { if (e && e.hidden !== !!v) e.hidden = !!v; }

// ------------------------------------------------------------ rozloženie a rámy

function merajZnak() {
  const sp = doc.createElement('span');
  sp.textContent = 'MMMMMMMMMMMMMMMMMMMM';
  sp.className = 'meraj';
  doc.body.appendChild(sp);
  const w = sp.getBoundingClientRect().width / 20;
  sp.remove();
  return w > 3 && w < 30 ? w : 9;
}

function ramy() {
  for (const p of doc.querySelectorAll('.panel')) {
    const nazov = p.dataset.nazov || (p.id === 'menu' ? 'MENU' : '');
    // šírka panelu sa zaokrúhli nadol na celé znaky, aby rohy rámu sedeli na bočné čiary
    p.style.removeProperty('width');
    const w = p.getBoundingClientRect().width;
    const n = Math.max(10, Math.floor(w / znak));
    if (w > 0) p.style.setProperty('width', (n * znak).toFixed(2) + 'px');
    const hore = p.querySelector('.ram-hore');
    const dole = p.querySelector('.ram-dole');
    if (hore && !hore.dataset.pevny) hore.textContent = ramHore(nazov, n);
    if (dole) dole.textContent = ramDole(n, p.id === 'p-proc' && procViac ? 'more below' : '');
    p.dataset.n = String(n);
  }
}

/** PROC sa posúva bez natívneho posuvníka (ten by ležal na znakovom ráme): spodný rám povie "more below". */
let procViac = false;
function procPosuvnik() {
  const p = $('proc');
  const viac = p.scrollHeight - p.scrollTop - p.clientHeight > 4;
  if (viac === procViac) return;
  procViac = viac;
  const pn = $('p-proc');
  const dole = pn.querySelector('.ram-dole');
  if (dole) txt(dole, ramDole(parseInt(pn.dataset.n || '44', 10), viac ? 'more below' : ''));
}

/** Aktívny rám (SPEC 3.4): na telefóne panel vybranej záložky, na desktope dážď. */
function aktivnyPanel() {
  const tab = $('plocha').dataset.tab;
  $('p-rain').classList.toggle('aktivny', !telefon);
  $('p-log').classList.toggle('aktivny', telefon && tab !== 'proc');
  $('p-proc').classList.toggle('aktivny', telefon && tab === 'proc');
}

function rozlozenie() {
  telefon = mm('(max-width: 999px)').matches;
  znak = merajZnak();
  doc.documentElement.style.setProperty('--ch', znak + 'px');
  nastavNazvyOkien();
  ramy();
  aktivnyPanel();
  const r = $('catch').getBoundingClientRect();
  // riadky obrazovky nad dažďom sa zarovnajú s riadkami celej stránky (perióda 3 px od horného okraja okna)
  $('catch').style.setProperty('--sl', ((((-(r.top || 0)) % 3) + 3) % 3).toFixed(2) + 'px');
  dazd.velkost(r.width, r.height, telefon, okno.devicePixelRatio || 1);
  dazd.akt = s.lex && !moment ? 3 : 1;
  // vety sa pripravia len raz (a po zmene počtu stĺpcov), nie pri každej zmene výšky
  if (s.lex && !(moment && moment.typ === 'lex')) { if (!dazd.textyHotove) dazd.pripravTexty(); dazd.nastavStlpce(999, 0); } else dazd.nastavStlpce(cielStlpce, 0);
  dazd.tema_(s.theme);
  dazd.burnVidno = s.sec >= 2 || s.sleeps > 0 || s.lex;
  dazd.nastavBurn(s.lines, s.cells, s.lex, s.darkMs > 0, perf());
  procPostav(true);
}

function nastavNazvyOkien() {
  const nazvy = { dialog: dialogNazov, menu: 'MENU', navrat: 'BACK', karta: '' };
  for (const [id, nazov] of Object.entries(nazvy)) {
    const o = $(id).querySelector('.okno');
    if (o) o.dataset.nazov = nazov;
  }
}
let dialogNazov = 'LEXICON';

// ------------------------------------------------------------ počítadlo a lišty

function pocitadlo(el, text, teraz) {
  if (el._final === text) {
    if (el._do && teraz >= el._do) { el.textContent = text; el._do = 0; }
    return;
  }
  const star = el._final || '';
  el._final = text;
  if (REDUCED || OBRAZOVKA || star.length !== text.length) { el.textContent = text; return; }
  let o = '';
  for (let i = 0; i < text.length; i++) o += text[i] !== star[i] && /\d/.test(text[i]) ? String(Math.floor(Math.random() * 10)) : text[i];
  el.textContent = o;
  el._do = teraz + 50;
}

function horna() {
  txt($('uptime'), tisice(E.uptime(s)));
  const rv = s.R > 0 || s.sleeps > 0;
  skry($('meta-recall'), !rv);
  if (rv) {
    txt($('recall'), String(s.R));
    txt($('recall-x'), '×' + (1 + 0.15 * s.R).toFixed(2));
  }
}

function pocet(teraz) {
  const P = E.tempo(s);
  posledneTempo = P;
  const t = cele(s.g);
  pocitadlo($('pocet'), t, teraz);
  pocitadlo($('pocet-t'), t, teraz);
  // v tme je cena tmy viditeľná priamo pri počítadle: chytanie stojí
  const tt = P > 0 ? `+${cislo(P)}/s` : s.darkMs > 0 ? '0/s · dark' : '';
  txt($('tempo'), tt);
  txt($('tempo-t'), tt);
  const meno = s.lex && !(moment && moment.typ === 'lex' && moment.faza < 2) ? 'LETTERS' : 'GLYPHS';
  if ($('pocet-meno').dataset.m !== meno) {
    $('pocet-meno').dataset.m = meno;
    if (meno === 'LETTERS' && pripravene && !OBRAZOVKA) term.sifruj($('pocet-meno'), meno, teraz, 600);
    else $('pocet-meno').textContent = meno;
  }
  const pod = $('podriadok');
  const podV = s.lex && !(moment && moment.typ === 'lex' && moment.faza < 2);
  skry(pod, !podV);
  if (podV) txt(pod, 'from 11,204 messages. never delivered.');
  const b = $('banky');
  skry(b, !(s.n.bank > 0));
  // od LEXICON sa v daždi čítajú vety: vinetácia dažďa sa vypne (kontrast viet, hra.css .dazd.citanie)
  const ca = $('catch');
  if (ca.classList.contains('citanie') !== !!s.lex) ca.classList.toggle('citanie', !!s.lex);
}

function pozornost(teraz) {
  const row = $('pozornost');
  const vidno = s.sec >= 2 || s.lex;
  skry(row, !vidno);
  if (!vidno) return;
  const tl = $('tl-tma');
  // v Akte III tma nič nezachraňuje (attention nie je), preto tlačidlo hovorí aj svoju cenu: 15 s bez chytania
  const tlT = s.darkMs > 0 ? `[ LIGHTS ${Math.ceil(s.darkMs / 1000)}s ]` : s.lex ? '[ GO DARK 15s ]' : '[ GO DARK ]';
  txt(tl, tlT);
  // text lišty sa skráti tak, aby riadok s tlačidlom nepretiekol (telefón 360 a 390, desktop 1000 až 1110)
  const znakov = Math.floor((dazd.wCss || 300) / znak);
  if (s.lex) {
    const trust = Math.min(100, (s.mended / 1000) * 100);
    txt($('lista-att'), textPozornosti('trust', trust, znakov, tlT.length));
    skry($('watch'), true);
    skry($('lockdown'), true);
    skry(tl, s.lines >= 7 && s.darkMs === 0);
    if (tl.classList.contains('horuce')) tl.classList.remove('horuce');
    dazd.nastavGlitch(0);
    return;
  }
  const a = Math.round(s.att);
  txt($('lista-att'), textPozornosti('attention', a, znakov, tlT.length));
  const k = s.att >= 50 ? (s.att - 50) / 50 : 0;
  // KEEPER watching (znížený pohyb namiesto glitchu) je v rohu dažďa, nie v riadku s tlačidlom
  skry($('watch'), !(REDUCED && s.att >= 50));
  const hor = s.att >= 80 && s.darkMs === 0;
  if (tl.classList.contains('horuce') !== hor) tl.classList.toggle('horuce', hor);
  if (!OBRAZOVKA) dazd.nastavGlitch(s.darkMs > 0 || s.floodMs > 0 || REDUCED ? 0 : k);
  const ld = $('lockdown');
  skry(ld, !(s.floodMs > 0));
  if (s.floodMs > 0) txt(ld, `LOCKDOWN ${Math.ceil(s.floodMs / 1000)}s`);
  void teraz;
}

// ------------------------------------------------------------ PROC

let procKluce = '';
const riadky = new Map();

function procN() {
  const p = $('p-proc');
  return Math.max(24, parseInt(p.dataset.n || '44', 10));
}

function el(tag, cls, text) {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function specifikacie() {
  const out = [];
  if (s.lex) {
    out.push({ k: 'sek:READ', typ: 'sek', nazov: 'READ' });
    out.push({ k: 'volba', typ: 'volba' });
    out.push({ k: 'opravy', typ: 'opravy' });
  }
  const b = E.dalsiaBrana(s);
  if (b && b.vidno) {
    out.push({ k: 'sek:GATES', typ: 'sek', nazov: 'GATES' });
    out.push({ k: 'brana', typ: 'brana', b });
  }
  const procesy = E.PROCESY.filter((g) => E.vidnoProces(s, g));
  if (procesy.length) {
    // sekcia procesov nesmie opakovať názov panelu PROC (vizuálne kolo 3): JOBS ako úlohy na pozadí v termináli
    out.push({ k: 'sek:JOBS', typ: 'sek', nazov: 'JOBS' });
    if (s.n.hook >= 10 || s.sleeps > 0 || s.sec >= 2) out.push({ k: 'hrom', typ: 'hrom' });
    for (const g of procesy) out.push({ k: 'proc:' + g, typ: 'proc', g });
  }
  const zap = E.ZAPLATY.filter((z) => E.vidnoZaplatu(s, z.id));
  const dek = E.vidnoDekoder(s);
  if (zap.length || dek) out.push({ k: 'sek:PATCHES', typ: 'sek', nazov: 'PATCHES' });
  if (dek) out.push({ k: 'dek', typ: 'dek' });
  for (const z of zap) out.push({ k: 'zap:' + z.id, typ: 'zap', z });
  if (E.vidnoSpanok(s)) {
    out.push({ k: 'sek:SLEEP', typ: 'sek', nazov: 'SLEEP' });
    out.push({ k: 'spanok', typ: 'spanok' });
  }
  return out;
}

function riadokEl(spec) {
  if (spec.typ === 'sek') { const d = el('div', 'sekcia'); d.setAttribute('aria-hidden', 'true'); return { el: d }; }
  if (spec.typ === 'hrom') {
    const d = el('div', 'hromadne');
    const tl = [];
    for (const [k, t] of [[1, '[ ×1 ]'], [10, '[ ×10 ]'], ['max', '[ MAX ]']]) {
      const b = el('button', 'tl', t);
      b.type = 'button';
      b.addEventListener('click', () => { hromadne = k; ui(perf(), true); });
      d.appendChild(b);
      tl.push([k, b]);
    }
    const w = el('span', 'st', '');
    d.appendChild(w);
    return { el: d, tl, w };
  }
  if (spec.typ === 'volba') {
    const d = el('div', 'volba');
    const mk = (mode) => {
      const b = el('button', 'tl');
      b.type = 'button';
      const n = el('span', 'n', mode === 'consume' ? '[ CONSUME ]' : '[ MEND ]');
      const c = el('span', 'c', '');
      b.appendChild(n); b.appendChild(c);
      b.addEventListener('click', () => { zvuk.odomkni(); const ev = []; E.prepniRezim(s, mode, ev); spracuj(ev, perf()); ui(perf(), true); });
      d.appendChild(b);
      return { b, c };
    };
    return { el: d, consume: mk('consume'), mend: mk('mend') };
  }
  if (spec.typ === 'opravy') return { el: el('div', 'opravy', '') };
  const b = el('button', 'riadok');
  b.type = 'button';
  const meno = el('span', 'meno', '');
  const cena = el('span', 'cena', '');
  const pod = el('span', 'pod', '');
  const tok = el('span', 'tok', '');
  const info = el('span', 'info', '');
  const need = el('span', 'need', '');
  const tempo = el('span', 'tempo-r', '');
  pod.appendChild(tok); pod.appendChild(info); pod.appendChild(need); pod.appendChild(tempo);
  b.appendChild(meno); b.appendChild(cena); b.appendChild(pod);
  b.addEventListener('click', (e) => klikRiadok(spec.k, b, e));
  return { el: b, meno, cena, pod, tok, info, need, tempo };
}

function procPostav(sila) {
  const specs = specifikacie();
  const kluce = specs.map((x) => x.k).join('|');
  const kontajner = $('proc');
  const skry = specs.length === 0;
  if ($('p-proc').hidden !== skry) {
    $('p-proc').hidden = skry;
    $('plocha').classList.toggle('bez-proc', skry);
    const pl = $('plocha');
    if (telefon && !OBRAZOVKA) pl.dataset.tab = skry ? 'log' : 'proc';
    for (const x of [$('z-proc'), $('z-log'), $('z-cmd')]) x.setAttribute('aria-selected', String(x.dataset.tab === pl.dataset.tab));
    $('z-proc').hidden = skry;
    aktivnyPanel();
    ramy();
  }
  if (kluce !== procKluce || sila) {
    const nove = [];
    for (const sp of specs) {
      let r = riadky.get(sp.k);
      if (!r) { r = riadokEl(sp); r.nove = true; riadky.set(sp.k, r); nove.push(sp.k); }
      r.spec = sp;
    }
    for (const k of [...riadky.keys()]) if (!specs.some((x) => x.k === k)) riadky.delete(k);
    kontajner.textContent = '';
    for (const sp of specs) kontajner.appendChild(riadky.get(sp.k).el);
    procKluce = kluce;
  }
  for (const sp of specs) riadky.get(sp.k).spec = sp;
  return specs;
}

function cenaProcesu(g) {
  if (hromadne === 'max') {
    const k = E.maxKusov(g, s.n[g], s.g);
    return { k: Math.max(1, k), c: E.cenaHrom(g, s.n[g], Math.max(1, k)) };
  }
  return { k: hromadne, c: E.cenaHrom(g, s.n[g], hromadne) };
}

function procAktualizuj(teraz) {
  const specs = procPostav(false);
  const N = procN();
  for (const sp of specs) {
    const r = riadky.get(sp.k);
    const nove = r.nove;
    r.nove = false;
    const nastav = (e, t) => {
      if (!e) return;
      if (nove && pripravene && !OBRAZOVKA && t) term.sifruj(e, t, teraz, 600);
      else if (e.textContent !== t && !term.sifry.has(e)) {
        if (sp.typ === 'brana' && pripravene && !OBRAZOVKA) term.sifruj(e, t, teraz, 600);
        else e.textContent = t;
      }
    };
    // riadok sekcie má šírku celého panelu: ├ a ┤ ležia v stĺpci bočného rámu (CSS záporný okraj 2ch)
    if (sp.typ === 'sek') { txt(r.el, sekcia(sp.nazov, N)); continue; }
    if (sp.typ === 'hrom') {
      for (const [k, b] of r.tl) if (b.classList.contains('vybrane') !== (k === hromadne)) b.classList.toggle('vybrane', k === hromadne);
      txt(r.w, s.sec >= 5 && !s.lex ? `words ${Math.round(E.K.word.chance * 100)}%/s` : '');
      continue;
    }
    if (sp.typ === 'volba') {
      const v = E.volbaCisla(s);
      if (r.consume.b.classList.contains('vybrane') !== (s.mode === 'consume')) r.consume.b.classList.toggle('vybrane', s.mode === 'consume');
      if (r.mend.b.classList.contains('vybrane') !== (s.mode === 'mend')) r.mend.b.classList.toggle('vybrane', s.mode === 'mend');
      txt(r.consume.c, `${cislo(v.consume)}/s now`);
      const sek = Number.isFinite(v.sekNaList) ? (v.sekNaList < 10 ? v.sekNaList.toFixed(1) : cislo(v.sekNaList)) : '-';
      txt(r.mend.c, `${cislo(v.mend)}/s now · +1 letter / ${sek} s · each mended +0.3% forever`);
      skry(r.el, !s.beats.includes('gc.c5') && !OBRAZOVKA);
      continue;
    }
    if (sp.typ === 'opravy') {
      const podiel = s.mendPool / E.cenaListu(s.mended);
      // kľúče sú tu (nie v riadku trust pod dažďom, kde by na telefóne vytlačili GO DARK mimo obrazovky)
      txt(r.el, `mended ${tisice(s.mended)} / 11,204  ${zamok(Math.min(1, podiel), 10)}\nkeys ${s.keys}/3`);
      continue;
    }
    let meno = '';
    let cena = 0;
    let info = '';
    let tempoT = '';
    let tokT = '';
    if (sp.typ === 'brana') {
      const b = sp.b;
      meno = b.typ === 'sector' && b.i === 6 && s.beats.includes('exit') ? 'SECTOR 07 · EXIT?' : b.meno;
      cena = b.cena;
      if (r.rozpadDo && teraz < r.rozpadDo) continue;
      if (r.el.classList.contains('rozpad')) {
        // rozsypané znaky sa zahodia skôr, než trieda zmizne (inak by starý text na snímku znova ukázal)
        for (const e2 of [r.meno, r.info, r.cena]) e2.textContent = '';
        r.el.classList.remove('rozpad');
      }
      info = zamok(Math.min(1, s.g / b.cena)) + ` ${Math.min(100, Math.floor((s.g / b.cena) * 100))}%`;
    } else if (sp.typ === 'proc') {
      const g = sp.g;
      const c = cenaProcesu(g);
      cena = c.c;
      const n = s.n[g];
      const mil = E.milniky(n);
      const zn = g === 'hook' ? (n >= 100 ? ' █' : n >= 50 ? ' ▓' : n >= 25 ? ' ▒' : n > 0 ? ' ░' : '') : '';
      meno = `${E.MENO_PROCESU[g]} ×${n}${zn}${x2Do[g] > teraz ? '  ×2' : ''}`;
      const rt = E.tempoProcesu(s, g);
      tempoT = n > 0 ? `${cislo(rt)}/s` : `+${cislo(E.K.gens[g].p * E.nasobProcesu(s, g) * E.globalny(s))}/s each`;
      tokT = REDUCED || OBRAZOVKA ? tokText(0, n, mil) : tokText(faza[g], n, mil);
      if (hromadne === 'max' && c.k > 1) meno += ` +${c.k}`;
    } else if (sp.typ === 'zap') {
      meno = sp.z.meno;
      cena = sp.z.cena;
      info = sp.z.popis;
    } else if (sp.typ === 'dek') {
      meno = `DECODER ${s.dec}/5`;
      cena = E.cenaDekodera(s.dec);
      info = 'all ×1.5, reads keeper';
    } else if (sp.typ === 'spanok') {
      const n = E.spanokNahlad(s);
      meno = '[ SLEEP ]';
      if (n.mozno) info = `+${n.zisk} recall · all catch ×${n.nasob.toFixed(2)}`;
      else info = `sleep ready at ${cislo(n.poziadavka)} this run`;
      r.el.classList.toggle('drahe', !n.mozno);
      nastav(r.meno, meno);
      txt(r.info, info);
      txt(r.tok, '');
      txt(r.need, '');
      txt(r.tempo, '');
      txt(r.cena, '');
      continue;
    }
    const drahe = !(s.g >= cena);
    r.el.classList.toggle('drahe', drahe);
    nastav(r.meno, meno);
    const cenaT = `[ ${cislo(cena)} ]`;
    if (!term.sifry.has(r.cena)) {
      if (r.cenaPrepis && pripravene) { term.sifruj(r.cena, cenaT, teraz, 250); r.cenaPrepis = false; }
      else if (r.cena.textContent !== cenaT) r.cena.textContent = cenaT;
    }
    // "need" je samostatný kus: pri úzkom PROC sa zalomí na ďalší riadok, nepretečie
    const needT = drahe ? `need ${cislo(cena - s.g)}` : '';
    if (r.info.textContent !== info) r.info.textContent = info;
    if (r.need.textContent !== needT) r.need.textContent = needT;
    if (r.tok.textContent !== tokT) r.tok.textContent = tokT;
    if (r.tempo.textContent !== tempoT) r.tempo.textContent = tempoT;
  }
  // DECODER BANK pás nad dažďom (▀ je vo výške riadku 12 px vidieť); bliká CSS animáciou, JS mení DOM len pri zmene šírky
  if (s.n.bank > 0) txt($('banky'), '▀'.repeat(Math.max(3, Math.min(40, Math.floor((dazd.wCss || 200) / znak)))));
  procPosuvnik();
}

function klikRiadok(k, b, e) {
  zvuk.odomkni();
  const teraz = perf();
  const ev = [];
  let ok = null;
  if (k === 'brana') {
    const br = E.dalsiaBrana(s);
    if (br && br.typ === 'lexicon') { if (s.g >= br.cena) otvorLexicon(); else trasenie(b); return; }
    ok = E.kupBranu(s, ev);
  } else if (k.startsWith('proc:')) {
    const g = k.slice(5);
    ok = E.kupProces(s, g, hromadne, ev);
    if (ok) { const r = riadky.get(k); if (r) r.cenaPrepis = true; }
  } else if (k.startsWith('zap:')) ok = E.kupZaplatu(s, k.slice(4), ev);
  else if (k === 'dek') ok = E.kupDekoder(s, ev);
  else if (k === 'spanok') { if (E.mozeSpat(s)) otvorSpanok(); else trasenie(b); return; }
  if (!ok) { trasenie(b); return; }
  spracuj(ev, teraz);
  ui(teraz, true);
  void e;
}

function trasenie(b) {
  zvuk.nedostupne();
  if (REDUCED) return;
  b.classList.add('trasie');
  setTimeout(() => b.classList.remove('trasie'), 80);
}

// ------------------------------------------------------------ udalosti ekonomiky

function spracuj(ev, teraz) {
  for (const e of ev) {
    switch (e.t) {
      case 'buy':
        zvuk.kupa(e.k > 1);
        if (e.g === 'hook') dazd.novyHak = teraz;
        if (e.milnik) { x2Do[e.g] = teraz + 2000; dazd.bleskZnacky = teraz + 34; zvuk.milnik(); }
        break;
      case 'patch': zvuk.kupa(true); break;
      case 'gate': momentBrany(e, teraz); break;
      case 'decoder': zvuk.kupa(true); term.prepisKeeper(teraz, 0); break;
      case 'dark': tmaT.to(teraz / 1000, 0.85); zvuk.tma(true); dazd.nastavTmu(1); break;
      case 'darkEnd': tmaT.to(teraz / 1000, 0); zvuk.tma(false); dazd.nastavTmu(0); break;
      case 'cells': for (let i = e.od; i < e.po; i++) zvuk.bunka(); break;
      case 'flood': dazd.nastavFlood(true); zvuk.flood(true); break;
      case 'floodEnd': dazd.nastavFlood(false); zvuk.flood(false); break;
      case 'word': dazd.nastavSlovo(s.word, teraz, s.word && s.dec >= 2 ? slovoCitatelne(s.word, s.dec) : null); break;
      case 'wordGone': dazd.nastavSlovo(null, teraz); break;
      case 'sleep': momentSpanku(e, teraz); break;
      case 'lexicon': momentLexicon(teraz); break;
      case 'mended': opravene(e.n, teraz); break;
      case 'key': ulozTeraz(); break;
      case 'mode': break;
      default: break;
    }
  }
}

function adresat(m) {
  const h = Math.imul(m + 7, 2654435761) >>> 0;
  return { veta: LISTY[h % LISTY.length], i: INICIALY[(h >>> 9) % INICIALY.length], u: ULICE[(h >>> 13) % ULICE.length], od: INICIALY[(h >>> 17) % INICIALY.length], ou: ULICE[(h >>> 21) % ULICE.length] };
}

function opravene(m, teraz) {
  if (!mendBuf) mendBuf = { od: m, do: m, t: teraz };
  mendBuf.do = m;
  if (MILNIKY_LISTU.includes(m)) vypustOpravy(teraz, m);
}

function vypustOpravy(teraz, portretM = 0) {
  if (!mendBuf) return;
  const { od, do: d } = mendBuf;
  mendBuf = null;
  const a = adresat(d);
  const t = od === d ? `mended ${String(d).padStart(4, '0')} · to: ${a.i}., ${a.u}` : `mended ${String(od).padStart(4, '0')} to ${String(d).padStart(4, '0')} · ${d - od + 1} letters`;
  logPridaj({ h: 'mended', t });
  if (portretM) {
    const b = adresat(portretM);
    logPridaj({ h: 'letter', t: b.veta });
    logPridaj({ h: 'sys', t: `from ${b.od}., ${b.ou}` });
    logPridaj({ h: 'pre', seed: portretM });
  }
  void teraz;
}

function logPridaj(z, o) {
  s.log.push(z);
  if (s.log.length > 60) s.log.splice(0, s.log.length - 60);
  term.pridaj(z, o);
}

// ------------------------------------------------------------ príbeh

/** Pred bootom novej hry bliká v logu kurzor █ 530 ms (SPEC 4.1); potom sa boot napíše. */
let bootOd = 0;
let bootKurzor = null;
function bootKrok(teraz) {
  if (!bootKurzor) return;
  if (teraz >= bootOd) { bootKurzor.remove(); bootKurzor = null; pribeh(teraz); return; }
  skry(bootKurzor.children[0], teraz - (bootOd - 530) >= 265);
}

function pribeh(teraz) {
  if (bootKurzor) return;
  const nove = P.krokPribehu(s, beh, teraz);
  for (const r of nove) {
    if (r.h === 'none') continue;
    if (r.h === 'card' && r.id === 'card3') dazd.zacniKartu(P.KARTA3, teraz);
    logPridaj({ id: r.id }, r.pomaly ? { pomaly: r.pomaly } : undefined);
  }
}

let bootHotovy = false;
term.onRiadok = (z, teraz) => {
  if (z.id === 'K.c11' && !carryVidno && !s.ended) { carryVidno = true; $('tl-carry').hidden = false; }
  if (z.id === 'gc.a2' && !bootHotovy) { bootHotovy = true; if (!REDUCED) dazd.rozbeh(teraz, 120, 6, 400); }
};
dazd.onGlitch = (k) => { term.glitch(perf()); zvuk.glitch(k); };
term.onPas = (h, t) => {
  const p = $('pas');
  p.textContent = (P.PREDPONA[h] ? P.PREDPONA[h] + '  ' : '') + t;
  p.className = 'pas ' + h;
};

// ------------------------------------------------------------ momenty

function momentBrany(e, teraz) {
  zvuk.brana();
  const r = riadky.get('brana');
  if (r && !REDUCED) {
    r.rozpadDo = teraz + 500;
    // celý riadok brány (meno, zámok, cena) sa rozdelí na znaky; trieda rozpad až v ďalšej snímke,
    // aby CSS prechod mal východiskový stav (inak by text len zmizol)
    let i = 0;
    for (const e2 of [r.meno, r.info, r.cena]) {
      if (!e2) continue;
      term.sifry.delete(e2);
      const text = e2.textContent;
      e2.textContent = '';
      for (const c of text) {
        const sp = el('span', 'zn', c);
        sp.style.setProperty('--dy', 20 + ((i * 37) % 40) + 'px');
        e2.appendChild(sp);
        i++;
      }
    }
    requestAnimationFrame(() => { if (perf() < r.rozpadDo) r.el.classList.add('rozpad'); });
  }
  const riadkyObr = e.typ === 'sector' ? obrazSektora(E.SEKTORY[e.i].obraz) : [];
  // "+N columns" len keď nové stĺpce naozaj pribudnú (na telefóne sú od S04 aktívne všetky)
  const pribudne = Math.min(dazd.cols, E.stlpce(s)) - dazd.aktivne;
  const stav = e.typ === 'sector' ? '' : E.HROMADY[e.i].stav.toLowerCase();
  const popis = e.typ === 'sector' ? (s.lex ? POPISY[e.i] : zasifruj(POPISY[e.i], 11 + e.i)) : pribudne > 0 ? `+${pribudne} columns · ${stav}` : stav;
  obraz = { t0: teraz, riadky: riadkyObr, meno: e.meno, popis, list: s.lex && e.typ === 'sector' };
  stlpceOd = teraz + (REDUCED ? 0 : 800);
  cielStlpce = E.stlpce(s);
  ulozTeraz();
}

function obrazKrok(teraz) {
  const o = obraz;
  const elO = $('obraz');
  if (!o) { if (!elO.hidden) elO.hidden = true; return; }
  const dt = teraz - o.t0;
  const koniec = REDUCED ? 2600 : 3800;
  if (dt > koniec) { obraz = null; elO.hidden = true; return; }
  elO.hidden = false;
  // DOM obrazu sa postaví raz; potom sa mení len textový uzol a popis (šum v krokoch po 40 ms, nie každú snímku)
  if (!o.uzolTxt) {
    elO.textContent = '';
    elO.appendChild(el('span', 'st-meno', o.meno));
    o.uzolTxt = doc.createTextNode('');
    elO.appendChild(o.uzolTxt);
    o.uzolPopis = el('span', 'popis' + (o.list ? ' list' : ''), '');
    elO.appendChild(o.uzolPopis);
    o.krok = -1;
  }
  const krok = REDUCED ? 0 : Math.floor(dt / 40);
  if (krok !== o.krok) {
    o.krok = krok;
    const w = o.riadky.length ? o.riadky[0].length : 0;
    let stlp = w;
    let rozpust = -1;
    if (!REDUCED) {
      stlp = Math.floor((dt - 200) / 25);
      if (dt > 3400) rozpust = Math.floor((dt - 3400) / (400 / Math.max(1, w)));
    }
    const RAMPA = ' .:-=+*#%@';
    const txt = o.riadky.map((riadok) => {
      let x = '';
      for (let c = 0; c < riadok.length; c++) {
        if (c < rozpust) x += ' ';
        else if (c < stlp) x += riadok[c];
        else if (c < stlp + 3 && riadok[c] !== ' ') x += RAMPA[1 + Math.floor(Math.random() * 9)];
        else x += ' ';
      }
      return x;
    }).join('\n');
    if (o.uzolTxt.nodeValue !== txt) o.uzolTxt.nodeValue = txt;
  }
  const popis = dt > 800 || REDUCED ? o.popis : '';
  if (o.uzolPopis.textContent !== popis) o.uzolPopis.textContent = popis;
}

function otvorSpanok() {
  const n = E.spanokNahlad(s);
  dialogNazov = 'SLEEP';
  const t = $('dialog-text');
  t.textContent = '';
  t.appendChild(el('div', 'sys', `+${n.zisk} recall · all catch ×${n.nasob.toFixed(2)}`));
  t.appendChild(el('div', 'sys', 'resets glyphs, procs, patches'));
  // pred LEXICON nesmie nič prezradiť, že glyfy sú listy (slovo "mended" až s LEXICON)
  t.appendChild(el('div', 'sys', s.lex ? 'keeps sectors, stacks, decoder, burn-in, mended' : 'keeps sectors, stacks, decoder, burn-in'));
  if (!n.riadok && s.lines < 7) t.appendChild(el('div', 'gc', "gc  this sleep won't finish a line. something's missing."));
  $('dialog-ano').textContent = '[ SLEEP ]';
  $('dialog-nie').textContent = '[ NOT NOW ]';
  dialogAkcia = () => { const ev = []; if (E.spi(s, ev)) spracuj(ev, perf()); };
  otvorOkno('dialog');
}

let dialogAkcia = null;
let otvoreneOkno = null;
let fokusPred = null;

function otvorOkno(id) {
  nastavNazvyOkien();
  fokusPred = doc.activeElement;
  $(id).hidden = false;
  ramy();
  otvoreneOkno = id;
  const prve = $(id).querySelector('button');
  if (prve && prve.focus) prve.focus();
}
function zavriOkno(id) {
  $(id).hidden = true;
  if (otvoreneOkno === id) otvoreneOkno = null;
  if (fokusPred && fokusPred.focus) fokusPred.focus();
}

function otvorLexicon() {
  const d = P.lexiconDialog(s, cislo);
  dialogNazov = 'LEXICON';
  const t = $('dialog-text');
  t.textContent = '';
  for (const r of d.riadky) t.appendChild(el('div', 'sys', r));
  $('dialog-ano').textContent = d.kupit;
  $('dialog-nie').textContent = d.nie;
  dialogAkcia = () => { const ev = []; if (E.kupLexicon(s, ev)) spracuj(ev, perf()); };
  otvorOkno('dialog');
}

function momentSpanku(e, teraz) {
  zvuk.spanok();
  const li = s.lines - 1;
  moment = { typ: 'sleep', t0: teraz, up0: e.uptime - 1, up1: e.uptime, riadok: e.riadok ? E.LIST[li] : '', k: e.k, faza: 0 };
  $('sp-up').textContent = '';
  $('sp-riadok').textContent = '';
  dazd.nastavSlovo(null, teraz);
  term.pauza = true;
  tmaT.jump(0);
  dazd.nastavTmu(0); dazd.nastavFlood(false);
  zvuk.tma(false); zvuk.flood(false);
  ulozTeraz();
}

function momentSpankuKrok(teraz) {
  const m = moment;
  const dt = teraz - m.t0;
  const app = $('app').style;
  const sp = $('spanok');
  const ciara = $('sp-ciara').style;
  const upT = `uptime ${tisice(m.up0)} → ${tisice(m.up1)} days`;
  if (REDUCED) {
    // znížený pohyb (SPEC 4.1): strih do čiernej na 600 ms, potom texty stoja 2 500 ms, strih späť
    skry(sp, false);
    txt($('sp-up'), dt >= 600 ? upT : '');
    txt($('sp-riadok'), dt >= 600 ? m.riadok : '');
    // znížený pohyb: čiara sa len skryje (bez mierky)
    ciara.setProperty('transform', 'none');
    ciara.setProperty('opacity', '0');
    if (dt >= 600 + 2500) koniecSpanku(teraz);
    return;
  }
  if (dt < 300) {
    app.setProperty('transform', `scaleY(${(1 - 0.996 * springStep(PRESETS.exit, dt / 1000)).toFixed(4)})`);
  } else if (dt < 1900) {
    app.setProperty('transform', 'scaleY(0.004)');
    sp.hidden = false;
    const sx = dt < 700 ? 1 - 0.99 * springStep(PRESETS.exit, (dt - 300) / 1000) : 0.01;
    ciara.setProperty('transform', `scaleX(${sx.toFixed(4)})`);
    ciara.setProperty('opacity', dt < 700 ? '1' : String(Math.max(0, 1 - (dt - 700) / 300)));
    if (dt >= 700) $('sp-up').textContent = upT;
    if (dt >= 1100) $('sp-riadok').textContent = m.riadok.slice(0, Math.floor((dt - 1100) / 20));
    if (m.faza < 1 && dt >= 1100) { m.faza = 1; }
  } else if (dt < 2500) {
    if (m.faza < 2) { m.faza = 2; zvuk.prebudenie(); $('sp-riadok').textContent = m.riadok; }
    sp.hidden = dt > 2000;
    const p = springStep(PRESETS.enter, (dt - 1900) / 1000);
    const sy = dt < 2100 ? 0.004 : 0.004 + 0.996 * springStep(PRESETS.enter, (dt - 2100) / 1000);
    app.setProperty('transform', `scaleX(${(0.01 + 0.99 * p).toFixed(4)}) scaleY(${sy.toFixed(4)})`);
  } else koniecSpanku(teraz);
}

function koniecSpanku(teraz) {
  const m = moment;
  moment = null;
  $('app').style.setProperty('transform', 'none');
  $('spanok').hidden = true;
  term.pauza = false;
  cielStlpce = E.stlpce(s);
  dazd.nastavStlpce(cielStlpce, teraz);
  if (!REDUCED) dazd.rozbeh(teraz, 120, 6, 400);
  if (m && m.k === 1) {
    dazd.zacniKartu(P.KARTA2, teraz);
    logPridaj({ h: 'card', t: 'ACT II · THE STACKS' });
  }
  ui(teraz, true);
}

function momentLexicon(teraz) {
  zvuk.lexTicho();
  moment = { typ: 'lex', t0: teraz, faza: 0, stlpec: -1, keeper: 0 };
  term.pauza = true;
  dazd.zacniLexicon(teraz);
  if (REDUCED) dazd.lexKoniec();
  ulozTeraz();
}

function momentLexKrok(teraz) {
  const m = moment;
  const dt = teraz - m.t0;
  if (REDUCED) {
    if (m.faza < 2 && dt >= 600) { m.faza = 2; term.prepisKeeper(teraz, 0); lexRiadky(teraz); }
    if (dt >= 600) koniecLex(teraz);
    return;
  }
  if (dt >= 600 && m.faza === 0) { m.faza = 1; zvuk.lexDron(true); }
  if (m.faza === 1) {
    const i = Math.min(dazd.cols - 1, Math.floor(((dt - 600) * Math.max(1, dazd.cols - 1)) / 3760));
    if (i > m.stlpec) { m.stlpec = i; zvuk.lexStlpec(i); }
  }
  if (dt >= 4600 && m.faza < 2) { m.faza = 2; zvuk.zvon(); zvuk.lexDron(false); }
  if (dt >= 5200 && m.faza < 3) { m.faza = 3; m.keeper = term.prepisKeeper(teraz, 150); m.lr = teraz + m.keeper * 150 + 300; }
  if (m.faza === 3 && teraz >= m.lr) { m.faza = 4; lexRiadky(teraz); }
  if (dt >= 7600) koniecLex(teraz);
}

function lexRiadky(teraz) {
  const k1 = { h: 'keeper', t: 'INTRUSION. SECTOR 2. PLEASE STOP.' };
  s.log.push(k1);
  const d = term.hned({ h: 'keeper', t: P.sifrujHlavicku('K1', 'INTRUSION. SECTOR 2.', 0) + ' ' + P.chvost('PLEASE STOP.') }, teraz);
  d.classList.add('nove-k1');
  const tel = d.querySelector('.t');
  if (tel) term.sifruj(tel, k1.t, teraz, 600);
  const nr = { h: 'keeper', t: P.LEXICON_RIADOK };
  s.log.push(nr);
  const d2 = term.hned({ h: 'keeper', t: zasifruj(P.LEXICON_RIADOK, 5) }, teraz);
  const tel2 = d2.querySelector('.t');
  if (tel2) term.sifruj(tel2, nr.t, teraz + 300, 600);
  d2.classList.add('nove-k1');
}

function koniecLex(teraz) {
  if (!moment || moment.typ !== 'lex') return;
  if (moment.faza < 4) { if (moment.faza < 3) term.prepisKeeper(teraz, 0); lexRiadky(teraz); }
  moment = null;
  zvuk.lexDron(false);
  dazd.lexKoniec();
  dazd.nastavStlpce(999, teraz);
  term.pauza = false;
  ui(teraz, true);
}

function koniecM1(teraz) {
  koniecT = teraz;
  s.ended = true;
  $('tl-carry').hidden = true;
  dazd.koniecM1(teraz);
  ulozTeraz();
}

function koniecKrok(teraz) {
  if (koniecT < 0) return;
  const dt = teraz - koniecT;
  $('titul-kurzor').hidden = REDUCED ? false : Math.floor(dt / 530) % 2 === 1;
  const karta = $('karta');
  if (dt >= (REDUCED ? 0 : 2100) && karta.hidden && !karta._zavrete) {
    karta.hidden = false;
    karta._t0 = teraz;
    $('karta-tl').hidden = true;
  }
  if (!karta.hidden) {
    const k = teraz - karta._t0;
    const [a, b, c] = P.KONIEC;
    const pis = (text, od) => (REDUCED ? text : text.slice(0, Math.max(0, Math.floor((k - od) / 26))));
    $('karta-t1').textContent = pis(a, 0);
    $('karta-t2').textContent = pis(b, a.length * 26 + 300);
    $('karta-t3').textContent = pis(c, (a.length + b.length) * 26 + 600);
    if (REDUCED || k > (a.length + b.length + c.length) * 26 + 900) $('karta-tl').hidden = false;
  }
}

// ------------------------------------------------------------ vstup

function chytanie(x, y, teraz) {
  zvuk.odomkni();
  if (moment && moment.typ === 'lex') { koniecLex(teraz); return; }
  if (moment && moment.typ === 'sleep') { koniecSpanku(teraz); return; }
  if (dazd.karta) { dazd.karta = null; dazd.spinavy = true; }
  if (!bootHotovy) {
    // ťuk preskočí aj kurzor pred bootom
    if (bootKurzor) { bootOd = 0; bootKrok(teraz); }
    term.dopis(teraz); bootHotovy = true; if (!REDUCED) dazd.rozbeh(teraz, 120, 6, 400);
  }
  const ev = [];
  const P0 = E.tempo(s);
  let v = 0;
  const pasmo = Math.max(0, Math.min(9, Math.floor((x / Math.max(1, dazd.wCss)) * 10)));
  // strop ťukov: najviac K.tapMaxS ťukov so ziskom za sekundu (autoklikač ani podržaný kláves nič nepridajú);
  // slovo v daždi sa chytí vždy, ďalšie ťuky nad strop sú len obraz
  while (tuky.length && teraz - tuky[0] >= 1000) tuky.shift();
  const naSlovo = !s.lex && s.word && dazd.slovoStlpec() >= 0 && Math.abs(dazd.stredStlpca(dazd.slovoStlpec()) - x) <= 24;
  if (tuky.length >= E.K.tapMaxS && !naSlovo) {
    // nad strop: len slabé bliknutie stĺpca, bez letu glyfov (nepredstiera zisk)
    if (!s.lex) dazd.chyt(dazd.stlpecPri(x), teraz, true);
    return;
  }
  tuky.push(teraz);
  if (s.lex) {
    dazd.chytVetu(x, y, teraz, s.mode);
    v = E.tuk(s, ev);
    if (v > 0) zvuk.tuk(pasmo);
  } else {
    const wc = dazd.slovoStlpec();
    if (s.word && wc >= 0 && Math.abs(dazd.stredStlpca(wc) - x) <= 24) {
      const citatelne = s.dec >= 2 ? slovoCitatelne(s.word, s.dec) : null;
      dazd.chytSlovo(teraz, citatelne);
      v = E.chytSlovo(s, ev);
      zvuk.slovo();
    } else {
      const c = dazd.stlpecPri(x);
      dazd.chyt(c, teraz);
      v = E.tuk(s, ev);
      if (v > 0) zvuk.tuk(pasmo);
    }
  }
  if (v > 0 && (v >= 0.01 * P0 || P0 === 0)) plavajuciZisk(v, x, y, teraz);
  spracuj(ev, teraz);
  tik();
}

function slovoCitatelne(w, dec) {
  const veta = LISTY[(w.id * 31) % LISTY.length].replace(/[^a-z]/g, '');
  let o = '';
  for (let i = 0; i < w.len; i++) o += ((i * 7 + w.id) % 5) < (dec - 1) ? veta[i % veta.length] : ' ';
  return o;
}

function plavajuciZisk(v, x, y, teraz) {
  const aktivne = zisky.filter((z) => teraz - z.t0 < 600);
  if (aktivne.length >= 3) {
    const z = aktivne[aktivne.length - 1];
    z.v += v;
    z.el.textContent = '+' + cislo(z.v);
    return;
  }
  const e = el('span', 'zisk', '+' + cislo(v));
  e.style.setProperty('left', Math.round(x - 10) + 'px');
  e.style.setProperty('top', Math.round(y - 24) + 'px');
  $('zisky').appendChild(e);
  zisky.push({ el: e, t0: teraz, v });
}

function ziskyKrok(teraz) {
  for (let i = zisky.length - 1; i >= 0; i--) {
    const z = zisky[i];
    const dt = teraz - z.t0;
    if (dt > 600) { z.el.remove(); zisky.splice(i, 1); continue; }
    if (REDUCED) z.el.style.setProperty('transform', 'none');
    else z.el.style.setProperty('transform', `translateY(${(-12 * springStep(PRESETS.gentle, dt / 1000)).toFixed(1)}px)`);
    z.el.style.setProperty('opacity', String(Math.max(0, 1 - dt / 600).toFixed(2)));
  }
}

function tma() {
  zvuk.odomkni();
  const ev = [];
  if (s.darkMs > 0) E.lights(s, ev); else E.goDark(s, ev);
  spracuj(ev, perf());
  ui(perf(), true);
}

function zmenTemu(t, teraz) {
  if (!s.themes.includes(t)) return;
  s.theme = t;
  if (REDUCED || OBRAZOVKA) { aplikujTemu(t); return; }
  sweep = { t0: teraz, tema: t, vymenene: false };
  $('sweep').hidden = false;
}

function aplikujTemu(t) {
  doc.documentElement.dataset.theme = t;
  dazd.tema_(t);
  const meta = doc.querySelector ? doc.querySelector('meta[name="theme-color"]') : null;
  if (meta && TEMY[t]) meta.setAttribute('content', TEMY[t].bg);
  ulozTeraz();
}

function sweepKrok(teraz) {
  if (!sweep) return;
  const dt = teraz - sweep.t0;
  const h = okno.innerHeight || 800;
  const p = springStep(PRESETS.camera, dt / 1000);
  $('sweep').style.setProperty('transform', `translateY(${Math.round(p * h)}px)`);
  if (!sweep.vymenene && (p >= 0.5 || dt > 240)) { sweep.vymenene = true; aplikujTemu(sweep.tema); }
  if (dt > 480) { sweep = null; $('sweep').hidden = true; }
}

function prikaz(text) {
  const teraz = perf();
  const t = String(text || '').trim();
  if (!t) return;
  logPridaj({ h: 'you', t: t.slice(0, 40) });
  const o = P.prikaz(s, t);
  term.dopis(teraz);
  for (const r of o.riadky) { s.log.push(r); term.hned(r, teraz); }
  if (o.gc) { s.beats.push(o.gc); logPridaj({ id: o.gc }); }
  const a = o.akcia;
  if (!a) return;
  if (a.typ === 'clear') { s.log = []; term.el.textContent = ''; }
  if (a.typ === 'sound') { s.snd.on = a.on; zvuk.nastav(s.snd.on, s.snd.hum); horna(); tlacidloZvuku(); ulozTeraz(); }
  if (a.typ === 'theme') zmenTemu(a.tema, teraz);
  if (a.typ === 'save') ulozTeraz();
  if (a.typ === 'sleep') { if (E.mozeSpat(s)) otvorSpanok(); else { const r = { h: 'sys', t: `sleep ready at ${cislo(E.poziadavkaSpanku(s.sleeps))} this run` }; s.log.push(r); term.hned(r, teraz); } }
  if (a.typ === 'read') {
    s.stats.reads++;
    const m = 1 + (Math.imul(s.stats.reads, 2246822519) >>> 0) % Math.max(1, s.mended);
    const b = adresat(m);
    logPridaj({ h: 'letter', t: b.veta });
    logPridaj({ h: 'sys', t: `from ${b.od}., ${b.ou}` });
    logPridaj({ h: 'pre', seed: m });
  }
}

function tlacidloZvuku() {
  $('tl-zvuk').textContent = s.snd.on ? '[ SOUND ]' : '[ MUTED ]';
  $('m-zvuk').textContent = s.snd.on ? '[ SOUND ON ]' : '[ SOUND OFF ]';
  $('m-hum').textContent = s.snd.hum ? '[ CRT HUM ON ]' : '[ CRT HUM OFF ]';
}

// ------------------------------------------------------------ menu a návrat

function otvorMenu() {
  $('m-export').value = U.exportuj(s);
  $('m-sprava').textContent = '';
  $('m-uklada').textContent = ls && zapis ? 'saves every 10 seconds in this browser.' : novsieUlozenie ? 'saving is paused: a newer save exists.' : 'saving is off in this browser';
  const temy = $('m-temy');
  temy.textContent = '';
  for (const t of ['green', 'amber', 'rose']) {
    const b = el('button', 'tl' + (s.theme === t ? ' vybrane' : ''), s.themes.includes(t) ? `[ ${t.toUpperCase()} ]` : `[ ${t.toUpperCase()} · locked ]`);
    b.type = 'button';
    b.addEventListener('click', () => { if (s.themes.includes(t)) { zmenTemu(t, perf()); otvorMenu(); } });
    temy.appendChild(b);
  }
  tlacidloZvuku();
  otvorOkno('menu');
}

let offlineZisk = null;
/** Obrazovka návratu. Nevybratý zisk sa drží aj v stave (s.pending), aby ho zavretie karty nezahodilo. */
function ukazNavrat(o) {
  offlineZisk = o;
  if (!OBRAZOVKA) s.pending = { dt: o.dt, zisk: o.zisk, listy: o.listy, strop: !!o.strop };
  const t = P.navratTexty(s, o, cislo, trvanie);
  const r = $('navrat-riadky');
  r.textContent = '';
  r.appendChild(el('div', 'gc', 'gc  ' + t.riadky[0].t));
  r.appendChild(el('div', 'sys', t.riadky[1].t));
  r.appendChild(el('div', 'gc', 'gc  ' + P.NAVRAT_GC[s.act]));
  const tl = $('navrat-tlacidla');
  tl.textContent = '';
  for (const b of t.tlacidla) {
    const e = el('button', 'tl', b.t);
    e.type = 'button';
    e.addEventListener('click', () => {
      const ev = [];
      const g0 = s.g;
      E.prijmiOffline(s, offlineZisk, b.id, ev);
      offlineZisk = null;
      s.pending = null;
      spracuj(ev, perf());
      zavriOkno('navrat');
      // plávajúci zisk aj pri výbere offline zisku (SPEC 4.1); MEND IT ALL ide do zásobníka opráv, nie do počítadla
      if (s.g > g0) plavajuciZisk(s.g - g0, (dazd.wCss || 200) / 2, (dazd.hCss || 200) / 2, perf());
      ui(perf(), true);
      ulozTeraz();
    });
    tl.appendChild(e);
  }
  if (otvoreneOkno === 'navrat') { ramy(); const prve = $('navrat').querySelector('button'); if (prve && prve.focus) prve.focus(); } else otvorOkno('navrat');
}

// ------------------------------------------------------------ uloženie

function ulozTeraz() {
  if (OBRAZOVKA || !zapis || !ls) return false;
  s.lastSeen = Date.now();
  const ok = U.uloz(ls, s);
  poslUlozenie = perf();
  return ok;
}

// ------------------------------------------------------------ hlavný tik logiky

function tik() {
  if (OBRAZOVKA) return;
  // skrytá karta: logika stojí; prehliadač časovače v pozadí škrtí (Chrome raz za minútu) a Firefox nie,
  // preto sa celá neprítomnosť dopočíta naraz pri visibilitychange cez offline() (50 %, strop 8 h)
  if (doc.hidden) return;
  const t = Date.now();
  const dt = t - s.lastSeen;
  s.lastSeen = t;
  const teraz = perf();
  const ev = [];
  if (dt > E.OFFLINE_OD_MS) {
    const o = E.offline(s, dt, ev);
    spracuj(ev, teraz);
    // ďalší offline zisk počas otvorenej obrazovky návratu sa pripočíta, nezahodí
    if (o.zisk > 0) ukazNavrat(offlineZisk ? E.zlucOffline(s, offlineZisk, o) : o);
  } else if (dt > 0 && !(moment && moment.typ === 'lex')) {
    E.postup(s, dt, ev);
    spracuj(ev, teraz);
  }
  if (moment && moment.typ === 'lex') s.lastSeen = t;
  pribeh(teraz);
  if (mendBuf && teraz - mendBuf.t >= 500) vypustOpravy(teraz);
  if (teraz - poslUlozenie > 10000) ulozTeraz();
  ui(teraz, false);
}

function ui(teraz, sila) {
  if (!sila && teraz - poslUi < 100) return;
  poslUi = teraz;
  horna();
  pocet(teraz);
  pozornost(teraz);
  procAktualizuj(teraz);
  if (teraz >= stlpceOd && !s.lex) { cielStlpce = E.stlpce(s); if (dazd.aktivne !== Math.min(dazd.cols, cielStlpce)) dazd.nastavStlpce(cielStlpce, teraz, obraz ? Math.floor(dazd.rows / 2) : -1); }
  dazd.nastavProcesy(s.n.hook, s.n.sieve, s.n.thread);
  const bv = s.sec >= 2 || s.sleeps > 0 || s.lex;
  if (dazd.burnVidno !== bv) { dazd.burnVidno = bv; dazd.burn.dirty = true; }
  dazd.nastavBurn(s.lines, s.cells, s.lex, s.darkMs > 0, teraz);
  dazd.nastavFlood(s.floodMs > 0);
  if (!s.word && dazd.slovo) dazd.nastavSlovo(null, teraz);
  const cmd = s.sec >= 3;
  skry($('prikaz-form'), !cmd);
  skry($('z-cmd'), !cmd);
  skry($('zalozky'), !telefon);
  if (DEBUG) $('titul').dataset.debug = `${dazd.pocetKresieb} draws · ${vykon.priemer.toFixed(1)} ms · ${dazd.usporny ? 'saver 24/s' : 'full 30/s'}`;
}

/** Prietokové čiary v PROC: 10 krokov za sekundu zo slučky snímok (SPEC 4.1), nie zo 4 tikov logiky. */
let poslTok = -1e9;
function tokyKrok(teraz) {
  if (REDUCED || OBRAZOVKA || teraz - poslTok < 100) return;
  const dt = Math.min(0.5, (teraz - poslTok) / 1000);
  poslTok = teraz;
  for (const g of E.PROCESY) {
    faza[g] = (faza[g] + rychlostToku(E.tempoProcesu(s, g)) * dt) % 1200;
    const r = riadky.get('proc:' + g);
    if (!r || !r.tok) continue;
    const n = s.n[g];
    const t = tokText(faza[g], n, E.milniky(n));
    if (r.tok.textContent !== t) r.tok.textContent = t;
  }
}

/**
 * Záchranný režim výkonu (SPEC 3.8): kĺzavý priemer trvania dazd.kresli() za ~2 s; nad 14 ms dážď prejde
 * na 24 krokov za sekundu a o 30 % kratšie stopy. Späť sa nevracia (žiadne kmitanie medzi režimami).
 */
const vykon = { t: new Float64Array(256), ms: new Float64Array(256), i: 0, n: 0, priemer: 0 };
function zaznamVykonu(ms, teraz) {
  vykon.t[vykon.i] = teraz;
  vykon.ms[vykon.i] = ms;
  vykon.i = (vykon.i + 1) & 255;
  vykon.n = Math.min(256, vykon.n + 1);
  let sum = 0;
  let k = 0;
  let najstarsi = teraz;
  for (let j = 0; j < vykon.n; j++) {
    const idx = (vykon.i - 1 - j + 256) & 255;
    if (teraz - vykon.t[idx] > 2000) break;
    sum += vykon.ms[idx];
    k++;
    najstarsi = vykon.t[idx];
  }
  vykon.priemer = k ? sum / k : 0;
  // aspoň 1,5 s meraní, aby jedna pomalá prvá snímka (atlas, písmo) režim neprepla
  if (!dazd.usporny && teraz - najstarsi >= 1500 && vykon.priemer > 14) dazd.nastavUsporny(true);
}

// ------------------------------------------------------------ slučka snímok

let raf = 0;
let poslKresba = -1e9;
function snimka() {
  raf = 0;
  if (skryte) return;
  const teraz = perf();
  if (moment && moment.typ === 'sleep') momentSpankuKrok(teraz);
  if (moment && moment.typ === 'lex') momentLexKrok(teraz);
  dazd.nastavTmu((REDUCED ? tmaT.target() : tmaT.at(teraz / 1000)) / 0.85);
  const op = (REDUCED ? tmaT.target() : tmaT.at(teraz / 1000)).toFixed(3);
  const tmaEl = $('tma');
  if (tmaEl._op !== op) { tmaEl._op = op; tmaEl.style.setProperty('opacity', op); }
  const kroky = dazd.krok(teraz);
  // znížený pohyb: statický dážď sa kreslí len pri zmene (ťuk, bunka, téma, rozmer), poistka raz za sekundu
  const kresli = REDUCED ? dazd.potrebaKresby(teraz) || teraz - poslKresba > 1000 : kroky > 0;
  bootKrok(teraz);
  if (kresli) {
    const t0 = perf();
    dazd.kresli(teraz);
    zaznamVykonu(perf() - t0, teraz);
    poslKresba = teraz;
  }
  term.tik(teraz);
  tokyKrok(teraz);
  obrazKrok(teraz);
  ziskyKrok(teraz);
  sweepKrok(teraz);
  koniecKrok(teraz);
  if ($('pocet')._do) pocitadlo($('pocet'), $('pocet')._final, teraz);
  if ($('pocet-t')._do) pocitadlo($('pocet-t'), $('pocet-t')._final, teraz);
  raf = requestAnimationFrame(snimka);
}

function spustiSlucku() {
  if (!raf && !skryte) raf = requestAnimationFrame(snimka);
}

// ------------------------------------------------------------ statická obrazovka

function staticka() {
  const f = scena;
  const teraz = f.cas;
  doc.documentElement.dataset.theme = s.theme;
  doc.documentElement.dataset.obrazovka = String(f.n);
  const pl = $('plocha');
  pl.dataset.tab = f.tab;
  rozlozenie();
  term.obnov(s.log);
  for (let i = s.log.length - 1; i >= 0; i--) { const z = term.text(s.log[i]); if (z.h === 'gc' || z.h === 'keeper') { term.onPas(z.h, z.t); break; } }
  cielStlpce = E.stlpce(s);
  dazd.nastavStlpce(s.lex ? 999 : cielStlpce, 0);
  if (f.lex >= 0) {
    dazd.akt = 1;
    dazd.nastavStlpce(44, 0);
    dazd.zacniLexicon(0);
    moment = { typ: 'lex', t0: 0, faza: 1 };
  }
  pripravene = true;
  ui(teraz, true);
  if (f.lex >= 0) { $('pocet-meno').textContent = f.lexMeno; $('podriadok').hidden = true; }
  if (f.glitch) {
    dazd.glitchK = f.glitch.k;
    dazd.glitchZmrazeny = true;
    dazd.glitch.pasy = f.glitch.pasy.length;
    f.glitch.pasy.forEach(([y, h], i) => { dazd.glitch.y[i] = y; dazd.glitch.h[i] = h; });
    dazd.glitch.off = f.glitch.off;
    $('watch').hidden = true;
    if (f.glitch.znak) term.glitch(0, (() => { let x = 7; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; })());
  }
  if (f.spanok >= 0) {
    const sz = f.spanokZ;
    $('app').style.setProperty('transform', 'scaleY(0.004)');
    $('spanok').hidden = false;
    $('sp-ciara').style.setProperty('transform', 'scaleX(0.01)');
    $('sp-ciara').style.setProperty('opacity', '0');
    $('sp-up').textContent = `uptime ${tisice(sz.uptime)} → ${tisice(sz.uptime + 1)} days`;
    const r = E.LIST[sz.riadok];
    $('sp-riadok').textContent = r.slice(0, Math.floor(r.length / 2));
  }
  if (f.navrat) ukazNavrat(f.navrat);
  if (f.koniec) {
    $('titul-kurzor').hidden = false;
    dazd.koniecM1(-10000);
    const k = $('karta');
    k.hidden = false;
    $('karta-t1').textContent = P.KONIEC[0];
    $('karta-t2').textContent = P.KONIEC[1];
    $('karta-t3').textContent = P.KONIEC[2];
    $('karta-tl').hidden = false;
  }
  for (let i = 0; i < 12; i++) dazd._krok1(teraz - 400 + i * 33);
  if (f.lex >= 0) dazd.kresli(f.lex); else dazd.kresli(teraz);
  if (f.glitch) dazd.glitch.do = 0;
  tlacidloZvuku();
}

// ------------------------------------------------------------ štart

function napojenia() {
  const c = $('catch');
  c.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const r = c.getBoundingClientRect();
    chytanie((e.clientX || 0) - r.left, (e.clientY || 0) - r.top, perf());
  });
  c.addEventListener('click', (e) => {
    if (e.detail !== 0) return;
    const r = c.getBoundingClientRect();
    const wc = dazd.slovoStlpec();
    const x = s.word && wc >= 0 ? dazd.stredStlpca(wc) : dazd.stlpecPri(Math.random() * r.width) >= 0 ? dazd.stredStlpca(dazd.stlpecPri(Math.random() * r.width)) : r.width / 2;
    chytanie(x, r.height / 2, perf());
  });
  $('tl-tma').addEventListener('click', tma);
  $('tl-menu').addEventListener('click', () => { zvuk.odomkni(); otvorMenu(); });
  $('tl-zvuk').addEventListener('click', () => { zvuk.odomkni(); s.snd.on = !s.snd.on; zvuk.nastav(s.snd.on, s.snd.hum); tlacidloZvuku(); ulozTeraz(); });
  $('m-zvuk').addEventListener('click', () => { s.snd.on = !s.snd.on; zvuk.nastav(s.snd.on, s.snd.hum); tlacidloZvuku(); ulozTeraz(); });
  $('m-hum').addEventListener('click', () => { s.snd.hum = !s.snd.hum; zvuk.nastav(s.snd.on, s.snd.hum); tlacidloZvuku(); ulozTeraz(); });
  $('m-zavri').addEventListener('click', () => zavriOkno('menu'));
  $('m-importuj').addEventListener('click', () => {
    const r = U.importuj($('m-import').value);
    if (!r.stav) { $('m-sprava').textContent = r.chyba; return; }
    // uloženie z novšej verzie sa neprepíše potichu (SPEC 6): najprv sa odloží bokom
    let odlozene = false;
    if (novsieUlozenie && ls) { try { ls.setItem(U.KLUC_ZLE, novsieUlozenie); odlozene = true; } catch { odlozene = false; } if (!odlozene) { $('m-sprava').textContent = 'the newer save could not be kept aside. nothing changed.'; return; } }
    s = r.stav;
    s.lastSeen = Date.now();
    zapis = true;
    ulozTeraz();
    $('m-sprava').textContent = odlozene ? 'imported. the newer save is kept aside. restarting the relay.' : 'imported. restarting the relay.';
    setTimeout(() => { try { location.reload(); } catch { /* nič */ } }, 600);
  });
  $('m-wipe').addEventListener('input', (e) => {
    if (String(e.target.value).trim().toLowerCase() !== 'wipe') return;
    try { if (ls) ls.removeItem(U.KLUC); } catch { /* nič */ }
    zapis = false;
    $('m-sprava').textContent = 'wiped. reloading.';
    setTimeout(() => { try { location.reload(); } catch { /* nič */ } }, 600);
  });
  $('dialog-ano').addEventListener('click', () => { zavriOkno('dialog'); const a = dialogAkcia; dialogAkcia = null; if (a) a(); ui(perf(), true); });
  $('dialog-nie').addEventListener('click', () => { dialogAkcia = null; zavriOkno('dialog'); });
  $('tl-carry').addEventListener('click', () => koniecM1(perf()));
  $('karta-tl').addEventListener('click', () => { $('karta').hidden = true; $('karta')._zavrete = true; dazd.burn.koniec = -1; dazd.burn.dirty = true; });
  $('prikaz-form').addEventListener('submit', (e) => { e.preventDefault(); const i = $('prikaz'); prikaz(i.value); i.value = ''; });
  for (const b of [$('z-proc'), $('z-log'), $('z-cmd')]) {
    b.addEventListener('click', () => {
      $('plocha').dataset.tab = b.dataset.tab;
      for (const x of [$('z-proc'), $('z-log'), $('z-cmd')]) x.setAttribute('aria-selected', String(x === b));
      aktivnyPanel();
      if (b.dataset.tab === 'cmd') $('prikaz').focus();
    });
  }
  $('proc').addEventListener('scroll', procPosuvnik, { passive: true });
  $('pas').addEventListener('click', () => $('z-log').click());
  doc.addEventListener('keydown', (e) => {
    const vInpute = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    if (e.key === 'Escape') { if (otvoreneOkno === 'menu' || otvoreneOkno === 'dialog') zavriOkno(otvoreneOkno); return; }
    if (vInpute || otvoreneOkno) return;
    if (e.key === ' ' || e.code === 'Space') {
      // medzerník na zameranom tlačidle patrí tlačidlu (Firefox ho aktivuje pri keyup aj po preventDefault na keydown;
      // na dažďovom tlačidle chytá jeho click s detail 0), inak by jeden stisk urobil dve veci
      if (e.target && e.target.tagName === 'BUTTON') return;
      e.preventDefault();
      if (e.repeat) return; // podržaný medzerník nie je autoklikač
      zvuk.odomkni();
      const r = $('catch').getBoundingClientRect();
      const wc = dazd.slovoStlpec();
      const c = s.word && wc >= 0 ? wc : dazd.stlpecPri(Math.random() * r.width);
      chytanie(c >= 0 ? dazd.stredStlpca(c) : r.width / 2, r.height * 0.4, perf());
    } else if (e.key === 'd' || e.key === 'D') { if (s.sec >= 2 || s.lex) tma(); } else if (e.key === '/') {
      if (s.sec >= 3) { e.preventDefault(); if (telefon) $('z-cmd').click(); else $('prikaz').focus(); }
    }
  });
  doc.addEventListener('visibilitychange', () => {
    skryte = !!doc.hidden;
    zvuk.skry(skryte);
    if (skryte) { ulozTeraz(); if (raf) { cancelAnimationFrame(raf); raf = 0; } } else { tik(); spustiSlucku(); }
  });
  if (okno.addEventListener) okno.addEventListener('pagehide', () => ulozTeraz());
  if (typeof ResizeObserver === 'function') {
    let cakaj = 0;
    const ro = new ResizeObserver(() => { clearTimeout(cakaj); cakaj = setTimeout(() => { rozlozenie(); dazd.kresli(perf()); }, 60); });
    ro.observe($('plocha'));
    ro.observe($('catch'));
  }
}

function start() {
  doc.documentElement.dataset.theme = s.theme;
  if (OBRAZOVKA) {
    // statická obrazovka sa meria a kreslí až s načítaným písmom (šírka znaku, rámy, stĺpce canvasu);
    // data-hotovo="1" na <html> je signál pre snímač, že obrazovka je hotová
    const hotovo = () => { staticka(); doc.documentElement.dataset.hotovo = '1'; };
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(hotovo, hotovo); else hotovo();
    return;
  }
  // napojenia pred obnovou logu: aj keby obnova zlyhala, MENU (export, wipe) musí fungovať
  napojenia();
  rozlozenie();
  try {
    term.obnov(s.log);
    if (s.log.length) { const posl = term.text(s.log[s.log.length - 1]); if (posl.h === 'gc' || posl.h === 'keeper') term.onPas(posl.h, posl.t); }
  } catch {
    s.log = [];
    term.el.textContent = '';
  }
  tlacidloZvuku();
  if (spravaUlozenia) { const r = { h: 'sys', t: spravaUlozenia }; term.hned(r, 0, false); }
  const novaHra = !s.beats.includes('gc.a2');
  if (novaHra && !REDUCED) dazd.rozbeh(perf() + 1e9, 120, 6, 400);
  else bootHotovy = true;
  if (novaHra && !REDUCED && !s.beats.includes('boot1')) {
    bootOd = perf() + 530;
    bootKurzor = el('div', 'r r-sys');
    bootKurzor.appendChild(el('span', 'kurzor', '█'));
    term.el.appendChild(bootKurzor);
  }
  // po obnovení stránky: K.c11 už bol napísaný, CARRY THEM sa musí ukázať znova (onRiadok sa pri obnove nevolá)
  if (s.beats.includes('K.c11') && !s.ended) { carryVidno = true; $('tl-carry').hidden = false; }
  // nevybratý offline zisk z minulej návštevy (karta sa zavrela na obrazovke návratu)
  if (s.pending && s.pending.zisk > 0) ukazNavrat(s.pending);
  pripravene = true;
  // prvá obrazovka: jediná akcia je dážď; boot ťuk preskočí; neprítomnosť nad 60 s rieši tik() (obrazovka návratu)
  tik();
  setInterval(tik, 250);
  spustiSlucku();
  ui(perf(), true);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => { rozlozenie(); ui(perf(), true); });
}

start();

export const _test = { get s() { return s; }, dazd, term, zvuk, E, perf, prikaz, ulozTeraz, vykon, get moment() { return moment; } };
