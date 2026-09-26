// UNSCORED M1: rozhranie. DOM, čísla, nákupy, rozhovory, prechod aktu, neprítomnosť, uloženie, statické obrazovky.
// Logika je v ekonomika.mjs (čistá), texty v pribeh.mjs, mapa v mapa.js. Animuje sa len transform a opacity.

import * as E from './ekonomika.mjs';
import * as PR from './pribeh.mjs';
import { Mapa } from './mapa.js';
import { uzol } from './svet.mjs';
import { Zvuk } from './zvuk.js';
import { UKAZKY } from './ukazky.mjs';

const $ = (id) => document.getElementById(id);
const mqPohyb = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
const mqPC = typeof matchMedia === 'function' ? matchMedia('(min-width: 900px)') : { matches: false };
let znizeny = !!mqPohyb.matches;
const slabe = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
const parameter = new URLSearchParams(location.search).get('obrazovka');
const UKAZKA = parameter && UKAZKY[parameter] ? UKAZKY[parameter] : null;

const NASTROJ_TEXT = {
  zapisnik: ['Notebook', '+1 whisper per tap'],
  krieda: ['Chalk', 'Listeners x2'],
  bicykel: ['Bicycle', 'Couriers carry x2'],
  pisaci: ['Typewriter', 'Unlocks printers'],
  kopirak: ['Carbon paper', 'Printers x3'],
  zadna: ['Back room', 'Attention fades x2. Knocks take half as many.'],
};
const ROLA = { p: 'Listener', k: 'Courier', t: 'Printer' };
// Čo uzol priniesol, aby moment výsledku povedal aj číslo (štítok pri kartičke).
const UZOL_BONUS = { zapisnik: '+1 whisper per tap.', krieda: 'Listeners x2.', bicykel: 'Couriers carry x2.', pisaci: 'Printers unlocked.', kopirak: 'Printers x3.', zadna: 'Attention fades x2.', kurier: 'Paper unlocked.', bunka: 'Attention is on you now.' };
// Krátky text do ponuky nad klávesom (na telefóne najviac dva riadky).
const NASTROJ_KRATKO = { zapisnik: '+1 per tap', krieda: 'Listeners x2', bicykel: 'Couriers x2', pisaci: 'Unlocks printers', kopirak: 'Printers x3', zadna: 'Attention fades x2' };

// Uzly mapy a kedy sa odhalia (tretí prvok: míľnik, kamera sa oddiali).
const UZLY_PODMIENKY = [
  ['sused', (s) => s.stat.maxLudi >= 1],
  ['ulica', (s) => s.stat.maxLudi >= 5, true],
  ['kurier', (s) => s.kupeneK >= 1 || s.kurieri >= 1],
  ['zapisnik', (s) => E.ma(s, 'zapisnik')],
  ['krieda', (s) => E.ma(s, 'krieda')],
  ['bunka', (s) => s.akt >= 2, true],
  ['bicykel', (s) => E.ma(s, 'bicykel')],
  ['mira', (s) => !!s.voditka.mira],
  ['pisaci', (s) => E.ma(s, 'pisaci')],
  ['tlaciar', (s) => s.kupeneT >= 1 || s.tlaciari >= 1],
  ['tomas', (s) => !!s.voditka.tomas],
  ['ruth', (s) => !!s.voditka.ruth],
  ['weir', (s) => s.stat.maxLudi >= 50, true],
  ['kopirak', (s) => E.ma(s, 'kopirak')],
  ['zadna', (s) => E.ma(s, 'zadna')],
];

// ------------------------------------------------------------ úložisko (každé čítanie aj zápis v try/catch)

const LS = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();
const uloziste = LS || { getItem() { throw new Error('bez úložiska'); }, setItem() { throw new Error('bez úložiska'); }, removeItem() {} };

let s = E.novyStav();
let mozeUkladat = true;
let navratNaStarte = null;
let zvuk = null;
let mapa = null;
let nasobok = 1;
const odhalene = new Set();

function el(tag, trieda, text) {
  const e = document.createElement(tag);
  if (trieda) e.className = trieda;
  if (text !== undefined) e.textContent = text;
  return e;
}

function ikona(id) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', '#' + id);
  svg.appendChild(use);
  return svg;
}

function animuj(e, snimky, o) {
  if (znizeny || !e || typeof e.animate !== 'function') return null;
  try {
    return e.animate(snimky, o);
  } catch {
    return null;
  }
}

const reflow = (e) => e && e.getBoundingClientRect();

// ------------------------------------------------------------ ukladanie

let casovacUlozenia = 0;
function uloz() {
  if (UKAZKA) return;
  const ok = E.uloz(uloziste, s);
  if (!ok && mozeUkladat) {
    mozeUkladat = false;
    $('neuklada').hidden = false;
  }
}
function ulozNeskor() {
  if (UKAZKA || casovacUlozenia) return;
  casovacUlozenia = setTimeout(() => {
    casovacUlozenia = 0;
    uloz();
  }, 1000);
}

// ------------------------------------------------------------ rádio ZERO a oznamy Správcu

const radio = {
  rad: [],
  bezi: false,
  push(text) {
    this.rad.push(text);
    if (!this.bezi) this.dalsi();
  },
  dalsi() {
    const text = this.rad.shift();
    if (text === undefined) {
      this.bezi = false;
      return;
    }
    this.bezi = true;
    const p = $('radio-text');
    $('radio-sr').textContent = 'Zero: ' + text;
    if (zvuk) zvuk.radio();
    if (znizeny) {
      p.textContent = text;
      setTimeout(() => this.dalsi(), PR.casCitania(text) * 1000);
      return;
    }
    let i = 0;
    p.textContent = '';
    const t = document.createTextNode('');
    const kurzor = el('span', 'kurzor');
    p.append(t, kurzor);
    const krok = () => {
      i = Math.min(text.length, i + 1);
      t.nodeValue = text.slice(0, i);
      if (i < text.length) setTimeout(krok, 24);
      else {
        kurzor.remove();
        setTimeout(() => this.dalsi(), PR.casCitania(text) * 1000);
      }
    };
    krok();
  },
};

const oznam = {
  rad: [],
  bezi: false,
  push(text) {
    this.rad.push(text);
    if (!this.bezi) this.dalsi();
  },
  dalsi() {
    const text = this.rad.shift();
    const b = $('oznam');
    if (text === undefined) {
      this.bezi = false;
      return;
    }
    this.bezi = true;
    b.textContent = text;
    reflow(b);
    b.classList.add('vidno');
    setTimeout(() => {
      b.classList.remove('vidno');
      setTimeout(() => {
        if (!this.rad.length) b.textContent = '';
        this.dalsi();
      }, 320);
    }, (PR.casCitania(text) + 0.3) * 1000);
  },
};

// ------------------------------------------------------------ čísla: úder písacieho stroja

const zobrazene = new Map();
function pisCislo(e, text) {
  const pred = zobrazene.get(e);
  if (pred === text) return;
  zobrazene.set(e, text);
  if (!pred || pred.length !== text.length || znizeny) {
    e.textContent = '';
    for (const ch of text) e.appendChild(el('span', '', ch));
    return;
  }
  const deti = e.children;
  for (let i = 0; i < text.length; i++) {
    if (pred[i] !== text[i] && deti[i]) {
      deti[i].textContent = text[i];
      animuj(deti[i], [{ transform: 'translateY(1px)', opacity: 0.55 }, { transform: 'none', opacity: 1 }], { duration: 60, easing: 'linear' });
    }
  }
}

function tok(n, jednotka) {
  if (Math.abs(n) < 0.05) return '';
  const znam = n < 0 ? '-' : '+';
  const a = Math.abs(n);
  return `${znam}${a < 10 ? a.toFixed(1) : PR.cislo(a)}${jednotka}`;
}

function nadychni(e) {
  animuj(e, [{ transform: 'scale(1)' }, { transform: 'scale(1.04)', offset: 0.43 }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
}

// ------------------------------------------------------------ vykreslenie

let poslRender = 0;
let casovacRender = 0;
function render(hned = false) {
  const teraz = performance.now();
  if (!hned && teraz - poslRender < 100) {
    if (!casovacRender) casovacRender = setTimeout(() => {
      casovacRender = 0;
      render(true);
    }, 100 - (teraz - poslRender));
    return;
  }
  poslRender = teraz;
  const f = E.toky(s);
  pisCislo($('h-sepoty'), PR.cislo(s.sepoty));
  $('t-sepoty').textContent = tok(f.sepoty, '/s');
  pisCislo($('h-ludia'), PR.cislo(E.ludia(s)));
  $('t-ludia').textContent = s.stichnuti > 0 ? `${s.stichnuti} quiet` : f.ludiaZaMinutu > 0 ? tok(f.ludiaZaMinutu, '/min') : '';
  const cp = $('c-papier');
  if (cp.classList.contains('zamknute') && s.odomknute.papier) animuj(cp, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
  cp.classList.toggle('zamknute', !s.odomknute.papier);
  pisCislo($('h-papier'), PR.cislo(s.papier));
  $('t-papier').textContent = s.odomknute.papier ? tok(f.papier, '/s') : '';
  // pozornosť (Správcovo číslo: len prelínanie, studené a presné)
  const poz = $('pozornost');
  if (poz.hidden && s.akt >= 2) {
    poz.hidden = false;
    animuj(poz, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'linear' });
  }
  poz.hidden = s.akt < 2;
  $('pozornost-napln').style.transform = `scaleX(${Math.min(1, s.pozornost / 100).toFixed(3)})`;
  $('pozornost-cislo').textContent = String(Math.floor(s.pozornost));
  poz.classList.toggle('hlasno', s.pozornost >= 70);
  renderNakupy();
  renderPonuka();
  renderZoznamy();
  if ($('rozhovor').classList.contains('otvorene')) obnovRozhovor();
  if (mapa) {
    mapa.nastavLudi(E.ludia(s));
    mapa.nastavPozornost(s.pozornost, s.potichu > 0);
    polohaVoditka();
  }
}

function pocetKusov(rola) {
  if (nasobok === 'max') return Math.max(1, E.maxKusov(s, rola));
  return nasobok;
}

function renderNakupy() {
  for (const b of document.querySelectorAll('.nakup')) {
    const rola = b.dataset.rola;
    const zamknuty = (rola === 'k' && !s.odomknute.kurier) || (rola === 't' && !E.ma(s, 'pisaci'));
    const cenaEl = b.querySelector('.nakup-cena');
    const poz = b.querySelector('.nakup-pozornost');
    b.classList.toggle('zamknuty', zamknuty);
    if (zamknuty) {
      // na telefóne má lístok 98 px: krátky náznak, celé vysvetlenie povie ZERO po ťuku
      const text = rola === 'k' ? `${Math.min(s.posluchaci, 8)}/8` : 'tool';
      if (cenaEl.dataset.t !== text) {
        cenaEl.dataset.t = text;
        cenaEl.textContent = '';
        cenaEl.append(ikona('i-zamok'), text);
      }
      poz.textContent = rola === 'k' ? 'Comes at 8 listeners.' : 'Needs the Typewriter tool.';
      b.classList.remove('nemozno');
      b.setAttribute('aria-label', `${ROLA[rola]}, locked. ${poz.textContent}`);
      continue;
    }
    const n = pocetKusov(rola);
    const c = E.cena(s, rola, n);
    const mam = s[E.zdroj(rola)];
    const ticho = s.potichu > 0 && rola !== 't';
    const ide = mam >= c && E.mozeKupit(s, rola);
    b.classList.toggle('nemozno', !ide);
    const pz = s.bonusy.nahlad && s.akt >= 2 ? E.pozornostZaNakup(s, rola, n) : 0;
    const text = PR.cena(c) + '|' + pz;
    if (cenaEl.dataset.t !== text) {
      cenaEl.dataset.t = text;
      cenaEl.textContent = '';
      cenaEl.append(ikona(rola === 't' ? 'i-papier' : 'i-sepot'), PR.cena(c));
      // náhľad pozornosti (Tomas): na telefóne skrátene v riadku ceny, na počítači celým riadkom
      if (pz > 0) cenaEl.append(el('span', 'poz-m', ` +${pz}`));
    }
    b.querySelector('.nakup-postup').style.transform = `scaleX(${ide ? 0 : Math.min(1, mam / c).toFixed(3)})`;
    poz.textContent = ticho ? 'Quiet for now.' : pz > 0 ? `+${pz} attention` : '';
    b.setAttribute('aria-label', `Invite ${n} ${ROLA[rola]}${n > 1 ? 's' : ''} for ${PR.cena(c)} ${rola === 't' ? 'paper' : 'whispers'}${ide ? '' : ', not enough yet'}`);
  }
  const t = nasobok === 'max' ? 'Max' : 'x' + nasobok;
  for (const b of document.querySelectorAll('.nasobok')) b.textContent = t;
}

// Ponuka: jedno miesto nad klávesom Whisper.
let ponukaKluc = '';
function vyberPonuku() {
  // poradie: ticho beží, hrozí zaklopanie, čakajúce vodítko, nový nástroj, hlasno, cieľ rozdelenia
  if (s.potichu > 0) return { typ: 'ticho', kluc: 'ticho' };
  if (s.akt >= 2 && s.pozornost >= 80) return { typ: 'hlasno', kluc: 'hlasno' };
  if (s.voditkoCaka) return { typ: 'voditko', kluc: 'v' + s.voditkoCaka };
  const n = E.NASTROJE.find((x) => E.nastrojViditelny(s, x.id) && s.papier >= x.cena);
  if (n) return { typ: 'nastroj', kluc: 'n' + n.id, id: n.id };
  if (s.akt >= 2 && s.pozornost >= 60) return { typ: 'hlasno', kluc: 'hlasno' };
  return { typ: 'rozdelenie', kluc: 'r' };
}

function renderPonuka() {
  const p = vyberPonuku();
  const obal = $('ponuka');
  if (p.kluc !== ponukaKluc) {
    ponukaKluc = p.kluc;
    obal.textContent = '';
    let e;
    if (p.typ === 'voditko') {
      const v = PR.VODITKA_TEXT[s.voditkoCaka];
      e = el('button', 'ponuka-list svetlo');
      e.type = 'button';
      const t = el('span', 'ponuka-text');
      t.append(el('b', '', 'A light is on. '), `${v.meno}, ${v.riadok.split(',')[0]}`);
      e.append(t, el('span', 'ponuka-akcia', 'Visit'));
      e.addEventListener('click', otvorRozhovor);
    } else if (p.typ === 'ticho') {
      e = el('div', 'ponuka-list ticho');
      const t = el('span', 'ponuka-text');
      t.append(el('b', '', 'Quiet. '), el('span', 'ticho-s', ''), el('span', 'ponuka-postup'));
      t.lastChild.appendChild(el('i'));
      e.append(t);
    } else if (p.typ === 'hlasno') {
      e = el('button', 'ponuka-list');
      e.type = 'button';
      const t = el('span', 'ponuka-text');
      t.append(el('b', '', 'Too loud. '), 'Printers and invites pause for 30 s.');
      e.append(t, el('span', 'ponuka-akcia', 'Go quiet'));
      e.addEventListener('click', potichu);
    } else if (p.typ === 'nastroj') {
      const [meno, opis] = NASTROJ_TEXT[p.id];
      const n = E.NASTROJE.find((x) => x.id === p.id);
      e = el('button', 'ponuka-list');
      e.type = 'button';
      const t = el('span', 'ponuka-text');
      t.append(el('b', '', meno + '. '), NASTROJ_KRATKO[p.id]);
      const a = el('span', 'ponuka-akcia');
      a.append(ikona('i-papier'), ' ' + PR.cena(n.cena));
      e.append(t, a);
      e.setAttribute('aria-label', `Buy ${meno} for ${n.cena} paper: ${opis}`);
      e.addEventListener('click', () => kupNastroj(p.id));
    } else {
      e = el('div', 'ponuka-list zamknuta');
      e.append(ikona('i-zamok'));
      const t = el('span', 'ponuka-text');
      t.append(el('b', '', 'Split the cell. '), el('span', 'rozd-s', ''), el('span', 'ponuka-postup'));
      t.lastChild.appendChild(el('i'));
      e.append(t);
    }
    obal.appendChild(e);
    if (!UKAZKA) animuj(e, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
  }
  if (p.typ === 'ticho') {
    obal.querySelector('.ticho-s').textContent = `Waiting ${Math.ceil(s.potichu)} s`;
    obal.querySelector('.ponuka-postup i').style.transform = `scaleX(${(s.potichu / E.K.potichu.trvanie).toFixed(3)})`;
  } else if (p.typ === 'rozdelenie') {
    const hotovo = s.pridaniVBehu >= E.K.rozdelenie;
    obal.querySelector('.rozd-s').textContent = hotovo ? 'Next chapter.' : `${Math.min(s.pridaniVBehu, 150)} of 150`;
    obal.querySelector('.ponuka-postup i').style.transform = `scaleX(${Math.min(1, s.pridaniVBehu / E.K.rozdelenie).toFixed(3)})`;
  }
}

let zoznamyCas = 0;
let klucNastrojov = '';
let klucLudi = '';
function renderZoznamy(hned = false) {
  const otvorene = $('zoznamy').classList.contains('otvorene') || mqPC.matches || UKAZKA;
  const bodka = E.NASTROJE.some((x) => E.nastrojViditelny(s, x.id) && s.papier >= x.cena);
  $('z-nastroje').classList.toggle('bodka', bodka);
  if (!otvorene) return;
  // nástroje sa prestavia len keď sa zmení, čo sa dá kúpiť (fokus a kurzor ostanú)
  const kn = E.NASTROJE.map((n) => (E.ma(s, n.id) ? 'm' : E.nastrojViditelny(s, n.id) ? (s.papier >= n.cena ? 'k' : 'v') : '-')).join('');
  if (hned || kn !== klucNastrojov) {
    klucNastrojov = kn;
    renderNastroje();
  }
  $('rozdelenie-stav').textContent = s.pridaniVBehu >= E.K.rozdelenie ? 'Ready when the next chapter is built.' : `${Math.min(s.pridaniVBehu, 150)} of 150 people this run`;
  const teraz = performance.now();
  const kl = `${s.posluchaci}/${s.kurieri}/${s.tlaciari}/${s.stichnuti}/${s.pridaniVBehu}/${Object.keys(s.voditka).join()}`;
  if (!hned && (kl === klucLudi || teraz - zoznamyCas < 1000)) return;
  zoznamyCas = teraz;
  klucLudi = kl;
  renderLudia();
}

function renderNastroje() {
  const ul = $('nastroje-zoznam');
  ul.textContent = '';
  let pocet = 0;
  for (const n of E.NASTROJE) {
    const mam = E.ma(s, n.id);
    if (!mam && !E.nastrojViditelny(s, n.id)) continue;
    pocet++;
    const [meno, opis] = NASTROJ_TEXT[n.id];
    const li = el('li');
    li.append(el('span', 'nastroj-meno', meno), el('span', 'nastroj-opis', opis));
    if (mam) li.append(el('span', 'nastroj-mam', 'OWNED'));
    else {
      const b = el('button', 'nastroj-tl');
      b.type = 'button';
      b.append(ikona('i-papier'), PR.cena(n.cena));
      b.disabled = s.papier < n.cena;
      b.setAttribute('aria-label', `Buy ${meno} for ${n.cena} paper`);
      b.addEventListener('click', () => kupNastroj(n.id));
      li.append(b);
    }
    ul.appendChild(li);
  }
  $('nastroje-nic').hidden = pocet > 0;
}

function renderLudia() {
  const casti = [];
  const mn = (n, j) => `${n} ${j}${n === 1 ? '' : 's'}`;
  casti.push(mn(s.posluchaci, 'listener'));
  if (s.odomknute.kurier) casti.push(mn(s.kurieri, 'courier'));
  if (s.tlaciari) casti.push(mn(s.tlaciari, 'printer'));
  if (s.stichnuti) casti.push(`${s.stichnuti} quiet`);
  $('roly').textContent = casti.join(' · ');
  const postavy = $('postavy');
  postavy.textContent = '';
  for (const [id, volba] of Object.entries(s.voditka)) {
    const v = PR.VODITKA_TEXT[id];
    if (!v) continue;
    const li = el('li');
    li.append(el('b', '', v.meno), `, ${v.riadok}`, el('span', 'bonus', v.volby[volba].bonus));
    postavy.appendChild(li);
  }
  const nedavni = $('nedavni');
  nedavni.textContent = '';
  const n = Math.min(8, s.pridaniVBehu);
  $('h-nedavni').hidden = n === 0;
  for (let i = s.pridaniVBehu - 1; i >= s.pridaniVBehu - n; i--) {
    const o = PR.osoba(i);
    const li = el('li');
    li.append(el('b', '', o.meno), `, ${o.vek}, ${o.praca}`, el('span', '', o.pribeh));
    nedavni.appendChild(li);
  }
}

// ------------------------------------------------------------ udalosti hry

function spracuj(ev) {
  let novyClovek = 0;
  for (const e of ev) {
    if (e.typ === 'kup' && e.rola !== 't') novyClovek += e.pocet;
    else if (e.typ === 'kup' || e.typ === 'tlac' || e.typ === 'navrat') novyClovek++;
    else if (e.typ === 'klop') {
      if (mapa) mapa.klop();
      if (zvuk) zvuk.klop(2);
    } else if (e.typ === 'akt' && e.akt === 2) prechodAktu(2);
    else if (e.typ === 'voditko' && zvuk) zvuk.zvoncek(0.1);
    else if (e.typ === 'milnik') lietajListok('Listeners x2', stredMapy(), $('h-sepoty'));
    else if (e.typ === 'prepocet') lietajListok('Listeners x2 for 3 min', stredMapy(), $('h-sepoty'));
  }
  if (novyClovek && zvuk) zvuk.zvoncek();
  for (const v of PR.vety(s, ev)) (v.kto === PR.ZERO ? radio : oznam).push(v.text);
  odhalUzly(false);
  if (mapa) mapa.vodítko(s.voditkoCaka);
  if (ev.some((e) => e.typ !== 'tuk')) ulozNeskor();
  render(ev.some((e) => e.typ === 'tuk' || e.typ === 'kup' || e.typ === 'nastroj' || e.typ === 'voditkoVzate' || e.typ === 'potichu'));
}

function odhalUzly(hned) {
  // počas prechodu aktu čaká mapa, aby hráč videl odhalenie až po zložení listu
  if (!mapa || (prechodBezi && !hned)) return;
  for (const [id, ked, milnik] of UZLY_PODMIENKY) {
    if (odhalene.has(id) || !ked(s)) continue;
    odhalene.add(id);
    mapa.odhalUzol(id, hned ? { hned: true, tichy: true } : {});
    if (milnik && !hned) mapa.milnik();
  }
}

// ------------------------------------------------------------ činy

const plus = [];
let plusI = 0;
function plusJeden(x, h) {
  if (znizeny) return;
  const obal = $('plus');
  if (!plus.length) for (let i = 0; i < 6; i++) plus.push(obal.appendChild(el('span')));
  const e = plus[plusI++ % plus.length];
  e.textContent = '+' + h;
  const w = obal.getBoundingClientRect().width;
  const px = Math.max(12, Math.min(w - 40, x - 12));
  // tuš na papieri nad klávesom (na tmavom klávese by nebol vidieť)
  animuj(e, [{ transform: `translate(${px}px, -20px)`, opacity: 1 }, { transform: `translate(${px}px, -38px)`, opacity: 0 }], { duration: 520, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
}

function sepkaj(x) {
  if (UKAZKA) return;
  zvuk.odomkni();
  zvuk.tuk();
  const ev = E.tuk(s);
  if (mapa) {
    mapa.vlna();
    mapa.zobud();
  }
  const r = $('sepkaj').getBoundingClientRect();
  plusJeden(x === undefined ? r.width / 2 : x - r.left, E.hodnotaTuku(s));
  spracuj(ev);
}

let poslNapoveda = 0;
function kupRolu(rola) {
  if (UKAZKA) return;
  zvuk.odomkni();
  const zamknuty = (rola === 'k' && !s.odomknute.kurier) || (rola === 't' && !E.ma(s, 'pisaci'));
  if (zamknuty) {
    const t = performance.now();
    if (t - poslNapoveda > 8000) {
      poslNapoveda = t;
      radio.push(rola === 'k' ? 'couriers come when eight people listen to you.' : 'printers need a typewriter first. look at your tools.');
    }
    return;
  }
  const ev = [];
  const k = E.kup(s, rola, pocetKusov(rola), ev);
  if (mapa) mapa.zobud();
  if (k) spracuj(ev);
}

function kupNastroj(id) {
  if (UKAZKA) return;
  zvuk.odomkni();
  const ev = [];
  if (E.kupNastroj(s, id, ev)) {
    zvuk.klop(1);
    spracuj(ev);
    renderZoznamy(true);
  }
}

function potichu() {
  if (UKAZKA) return;
  const ev = [];
  if (E.potichu(s, ev)) spracuj(ev);
}

// ------------------------------------------------------------ dialógy

let otvorilo = null;
const dialogy = ['rozhovor', 'nastavenia', 'zoznamy'];

function otvorDialog(id) {
  otvorilo = document.activeElement;
  const d = $(id);
  const z = $('zaves');
  z.hidden = false;
  d.hidden = false;
  reflow(d);
  d.classList.add('otvorene');
  z.classList.add('vidno');
  const prvy = d.querySelector('button:not(:disabled):not(.zavriet), textarea') || d.querySelector('button');
  if (prvy && !UKAZKA) setTimeout(() => prvy.focus({ preventScroll: true }), 30);
}

function zatvorDialog(id) {
  const d = $(id);
  if (!d.classList.contains('otvorene')) return;
  d.classList.remove('otvorene');
  const ine = dialogy.some((x) => x !== id && $(x).classList.contains('otvorene'));
  if (!ine) $('zaves').classList.remove('vidno');
  setTimeout(() => {
    if (!d.classList.contains('otvorene') && id !== 'zoznamy') d.hidden = true;
    if (!dialogy.some((x) => $(x).classList.contains('otvorene'))) $('zaves').hidden = true;
  }, 240);
  if (otvorilo && otvorilo.focus) otvorilo.focus({ preventScroll: true });
}

function otvorZoznam(ktory) {
  if (mqPC.matches) {
    $(ktory).scrollIntoView({ behavior: znizeny ? 'auto' : 'smooth', block: 'start' });
    return;
  }
  $('zoznamy').dataset.list = ktory;
  // na telefóne je zoznam spodný list (dialóg), na počítači obyčajná časť stĺpca
  $('zoznamy').setAttribute('role', 'dialog');
  otvorDialog('zoznamy');
  renderZoznamy(true);
}

function otvorRozhovor() {
  const id = s.voditkoCaka;
  if (!id) return;
  const v = PR.VODITKA_TEXT[id];
  const c = E.voditko(id).cena;
  $('r-meno').textContent = v.meno;
  $('r-riadok').textContent = v.riadok;
  $('r-hacik').textContent = v.hacik;
  $('r-uvod').textContent = v.uvod;
  for (const b of document.querySelectorAll('.r-volba')) {
    const o = v.volby[b.dataset.volba];
    b.querySelector('.r-volba-text').textContent = o.text;
    b.querySelector('.r-volba-bonus').textContent = o.bonus;
  }
  obnovRozhovor(c);
  $('r-peciatka').classList.remove('dopadla');
  otvorDialog('rozhovor');
}

/** Cena rozhovoru a voľby sa obnovujú, kým je list otvorený (šepoty pribúdajú aj počas čítania). */
function obnovRozhovor(c = s.voditkoCaka ? E.voditko(s.voditkoCaka).cena : 0) {
  if (!s.voditkoCaka || $('r-peciatka').classList.contains('dopadla')) return;
  const ide = s.sepoty >= c;
  $('r-cena').textContent = `Talking costs ${PR.cena(c)} whispers. ` + (ide ? `You have ${PR.cislo(s.sepoty)}.` : `You need ${PR.cena(c - s.sepoty)} more.`);
  for (const b of document.querySelectorAll('.r-volba')) b.disabled = !ide;
}

function vyberVolbu(volba) {
  const id = s.voditkoCaka;
  const ev = [];
  if (!E.vyberVoditko(s, volba, ev)) return;
  zvuk.odomkni();
  $('r-peciatka').classList.add('dopadla');
  zvuk.klop(1);
  const v = PR.VODITKA_TEXT[id];
  setTimeout(() => {
    zatvorDialog('rozhovor');
    spracuj(ev);
    const pridane = ev.find((e) => e.typ === 'voditkoVzate');
    setTimeout(() => lietajListok(`+${pridane ? pridane.pridane : 2} listeners`, bodUzla(id), $('h-ludia')), znizeny ? 0 : 900);
    setTimeout(() => radio.push(v.volby[volba].po), znizeny ? 0 : 1400);
  }, znizeny ? 0 : 350);
}

function stredMapy() {
  const r = $('mapa').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height * 0.6 };
}

function bodUzla(id) {
  const u = uzol(id);
  const r = $('mapa').getBoundingClientRect();
  if (!mapa || !u) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const p = mapa.naObrazovku(u.x, u.y);
  return { x: r.left + Math.max(0, Math.min(r.width, p.x)), y: r.top + Math.max(0, Math.min(r.height, p.y)) };
}

function lietajListok(text, od, cielEl) {
  if (!cielEl) return;
  const ciel = cielEl.getBoundingClientRect();
  if (znizeny) {
    nadychni(cielEl);
    return;
  }
  const e = el('span', '', text);
  $('let').appendChild(e);
  const w = e.getBoundingClientRect().width || 120;
  const x0 = od.x - w / 2;
  const y0 = od.y - 10;
  const x1 = ciel.left;
  const y1 = ciel.top;
  const mx = (x0 + x1) / 2;
  const my = Math.min(y0, y1) - 60;
  const a = animuj(
    e,
    [
      { transform: `translate(${x0}px, ${y0}px) rotate(-3deg)`, opacity: 1 },
      { transform: `translate(${mx}px, ${my}px) rotate(2deg)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${x1 + (x1 - mx) * 0.03}px, ${y1 + (y1 - my) * 0.03}px) rotate(0deg)`, opacity: 1, offset: 0.85 },
      { transform: `translate(${x1}px, ${y1}px)`, opacity: 0 },
    ],
    { duration: 440, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'forwards' },
  );
  const koniec = () => {
    e.remove();
    nadychni(cielEl);
  };
  if (a) a.onfinish = koniec;
  else koniec();
}

// ------------------------------------------------------------ prechod aktu

let prechodBezi = null;
function prechodAktu(n, zastavene = false) {
  const a = PR.AKTY[n];
  if (!a) return;
  const p = $('prechod');
  const list = $('prechod-list');
  const c = $('prechod-cislo');
  const naz = $('prechod-nazov');
  const pec = $('prechod-peciatka');
  const zero = $('prechod-zero');
  c.textContent = '';
  naz.textContent = '';
  pec.textContent = `${a.cislo} · ${a.nazov}`;
  pec.classList.remove('dopadla');
  zero.textContent = '';
  p.classList.remove('sklada');
  p.hidden = false;
  reflow(p);
  p.classList.add('vidno');
  if (zastavene || znizeny) {
    c.textContent = a.cislo;
    naz.textContent = a.nazov;
    pec.classList.add('dopadla');
    zero.textContent = a.zero;
    if (zastavene) return;
  }
  const casovace = [];
  const po = (ms, fn) => casovace.push(setTimeout(fn, ms));
  const zatvor = () => {
    casovace.forEach(clearTimeout);
    p.removeEventListener('click', zatvor);
    prechodBezi = null;
    p.classList.add('sklada');
    setTimeout(() => {
      p.hidden = true;
      p.classList.remove('vidno', 'sklada');
      render(true);
    }, znizeny ? 200 : 330);
  };
  prechodBezi = zatvor;
  p.addEventListener('click', zatvor);
  if (znizeny) {
    po(2600, zatvor);
    return;
  }
  const pis = (e, text, od) => {
    for (let i = 1; i <= text.length; i++) po(od + i * 30, () => {
      e.textContent = text.slice(0, i);
      if (text[i - 1] !== ' ') zvuk.tuk();
    });
    return od + text.length * 30;
  };
  let t = pis(c, a.cislo, 380);
  t = pis(naz, a.nazov, t + 60);
  po(t + 120, () => {
    pec.classList.add('dopadla');
    zvuk.klop(1);
  });
  po(t + 240, () => (zero.textContent = a.zero));
  po(Math.max(2300, t + 1100), zatvor);
  void list;
}

// ------------------------------------------------------------ návrat po neprítomnosti

function trvanie(sekundy) {
  const h = Math.floor(sekundy / 3600);
  const m = Math.floor((sekundy % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h} h ${m} min`;
}

let poslednySuhrn = null;
function ukazNavrat(sum) {
  if (!sum || sum.sekundy < 60) return;
  poslednySuhrn = sum;
  $('navrat-hlavne').textContent = '';
  $('navrat-hlavne').append('Your people talked to ', el('b', '', PR.cislo(sum.rozhovory)), ' others.');
  const r = [];
  if (sum.sepoty >= 1) r.push(`+${PR.cislo(sum.sepoty)} whispers`);
  if (sum.papier >= 1) r.push(`+${PR.cislo(sum.papier)} paper`);
  if (sum.vratili) r.push(`${sum.vratili} quiet ${sum.vratili === 1 ? 'one' : 'ones'} came back`);
  let text = r.join(' · ') + '. ';
  text += `You were gone ${trvanie(sum.sekundy)}. Printers waited for you.`;
  if (sum.orezane) text += ' The city only remembers the last 8 hours.';
  $('navrat-riadky').textContent = text;
  const n = $('navrat');
  n.hidden = false;
  if (!UKAZKA) setTimeout(() => $('navrat-tl').focus({ preventScroll: true }), 30);
}

function zatvorNavrat() {
  const n = $('navrat');
  if (n.hidden) return;
  const r = n.querySelector('.navrat-list').getBoundingClientRect();
  n.hidden = true;
  const listok = poslednySuhrn && poslednySuhrn.sepoty >= 1 ? `+${PR.cislo(poslednySuhrn.sepoty)} whispers` : '+ paper';
  lietajListok(listok, { x: r.left + r.width / 2, y: r.top + r.height / 2 }, $('h-sepoty'));
  render(true);
}

// ------------------------------------------------------------ nastavenia

let resetCas = 0;
function otvorNastavenia() {
  $('n-kod').value = E.exportKod(s);
  $('n-sprava').textContent = mozeUkladat ? '' : 'This window cannot save. Copy the code to keep your progress.';
  otvorDialog('nastavenia');
}

function nastavZvuk(zap) {
  for (const b of [$('tl-zvuk'), $('n-zvuk')]) b.setAttribute('aria-pressed', zap ? 'true' : 'false');
  $('n-zvuk').textContent = zap ? 'Sound: on' : 'Sound: off';
  $('tl-zvuk').setAttribute('aria-label', zap ? 'Sound on' : 'Sound off');
}

// ------------------------------------------------------------ štítky uzlov na mape

let stitok = null;
function ukazStitok(u, cas) {
  const obal = $('stitky');
  if (!stitok) stitok = obal.appendChild(el('div', 'stitok'));
  stitok.textContent = u.stitok;
  const volba = s.voditka[u.id];
  const bonus = volba && PR.VODITKA_TEXT[u.id] ? PR.VODITKA_TEXT[u.id].volby[volba].bonus + '.' : UZOL_BONUS[u.id];
  if (bonus) stitok.append(' ', el('b', '', bonus.charAt(0).toUpperCase() + bonus.slice(1)));
  stitok.dataset.id = u.id;
  stitok.style.opacity = '1';
  polohaStitku();
  animuj(stitok, [{ opacity: 0, transform: stitok.style.transform + ' translateY(6px)' }, { opacity: 1, transform: stitok.style.transform }], { duration: 240, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
  clearTimeout(stitok.casovac);
  stitok.casovac = setTimeout(() => {
    const a = animuj(stitok, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'linear' });
    const skry = () => {
      stitok.style.opacity = '0';
      stitok.dataset.id = '';
    };
    if (a) a.onfinish = skry;
    else skry();
  }, (UKAZKA ? 600 : cas) * 1000);
}

function polohaStitku() {
  if (!stitok || !stitok.dataset.id || !mapa) return;
  const u = uzol(stitok.dataset.id);
  const p = mapa.naObrazovku(u.x, u.y - 30);
  const r = $('mapa').getBoundingClientRect();
  const w = stitok.offsetWidth || 200;
  const h = stitok.offsetHeight || 60;
  const hore = mqPC.matches ? 64 : 8;
  const x = Math.max(8, Math.min(r.width - w - 8, p.x - w / 2));
  const y = Math.max(hore, Math.min(r.height - h - 12, p.y - h - 10));
  stitok.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

function polohaVoditka() {
  const b = $('voditko-bod');
  if (!s.voditkoCaka || !mapa) {
    b.hidden = true;
    return;
  }
  const u = uzol(s.voditkoCaka);
  const p = mapa.naObrazovku(u.x, u.y);
  const r = $('mapa').getBoundingClientRect();
  const vidno = p.x > 0 && p.y > 0 && p.x < r.width && p.y < r.height;
  b.hidden = !vidno;
  b.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
  b.setAttribute('aria-label', `A light is on: visit ${PR.VODITKA_TEXT[s.voditkoCaka].meno}`);
}

function popisMapy() {
  const n = E.ludia(s);
  $('mapa').setAttribute('aria-label', `Map of Lower Weir. ${n} warm ${n === 1 ? 'window' : 'windows'}. ${odhalene.size + 1} cards pinned.`);
}

// ------------------------------------------------------------ slučka a viditeľnosť

let posl = performance.now();
let skryteOd = null;

function tik() {
  const teraz = performance.now();
  const dt = (teraz - posl) / 1000;
  posl = teraz;
  if (document.hidden || UKAZKA) return;
  if (dt > 2) {
    const sum = E.nepritomnost(s, dt);
    if (dt > 60) ukazNavrat(sum);
    spracuj([]);
    return;
  }
  const ev = E.krok(s, Math.min(dt, 1));
  spracuj(ev);
}

function viditelnost() {
  if (UKAZKA) return;
  if (document.hidden) {
    skryteOd = Date.now();
    uloz();
    if (mapa) mapa.skryta(true);
  } else {
    posl = performance.now();
    if (skryteOd !== null) {
      const gap = (Date.now() - skryteOd) / 1000;
      skryteOd = null;
      if (gap > 2) {
        const sum = E.nepritomnost(s, gap);
        if (gap > 60) ukazNavrat(sum);
      }
    }
    if (mapa) mapa.skryta(false);
    spracuj([]);
  }
}

// ------------------------------------------------------------ vstup

function naviaz() {
  const k = $('sepkaj');
  k.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    k.classList.add('dole');
    sepkaj(e.clientX);
  });
  const hore = () => k.classList.remove('dole');
  k.addEventListener('pointerup', hore);
  k.addEventListener('pointercancel', hore);
  k.addEventListener('pointerleave', hore);
  k.addEventListener('click', (e) => {
    if (e.detail === 0) sepkaj();
  });
  k.addEventListener('contextmenu', (e) => e.preventDefault());

  for (const b of document.querySelectorAll('.nakup')) {
    b.addEventListener('pointerdown', () => b.classList.add('dole'));
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(t, () => b.classList.remove('dole'));
    b.addEventListener('click', () => kupRolu(b.dataset.rola));
  }
  for (const b of document.querySelectorAll('.nasobok')) {
    b.addEventListener('click', () => {
      nasobok = nasobok === 1 ? 10 : nasobok === 10 ? 'max' : 1;
      render(true);
    });
  }
  for (const b of document.querySelectorAll('.zalozka')) b.addEventListener('click', () => otvorZoznam(b.dataset.list));
  $('zavriet-zoznamy').addEventListener('click', () => zatvorDialog('zoznamy'));
  $('zavriet-rozhovor').addEventListener('click', () => zatvorDialog('rozhovor'));
  $('zavriet-nastavenia').addEventListener('click', () => zatvorDialog('nastavenia'));
  $('zaves').addEventListener('click', () => dialogy.forEach(zatvorDialog));
  for (const b of document.querySelectorAll('.r-volba')) {
    b.addEventListener('pointerdown', () => b.classList.add('dole'));
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(t, () => b.classList.remove('dole'));
    b.addEventListener('click', () => vyberVolbu(b.dataset.volba));
  }
  $('voditko-bod').addEventListener('click', otvorRozhovor);
  $('tl-zvuk').addEventListener('click', () => {
    zvuk.odomkni();
    nastavZvuk(zvuk.prepni());
  });
  $('n-zvuk').addEventListener('click', () => {
    zvuk.odomkni();
    nastavZvuk(zvuk.prepni());
  });
  $('tl-menu').addEventListener('click', otvorNastavenia);
  $('n-kopirovat').addEventListener('click', async () => {
    const kod = $('n-kod').value;
    try {
      await navigator.clipboard.writeText(kod);
      $('n-sprava').textContent = 'Copied. Keep it somewhere safe.';
    } catch {
      $('n-kod').select();
      $('n-sprava').textContent = 'Select the code and copy it.';
    }
  });
  $('n-nacitat').addEventListener('click', () => {
    const r = E.importKod($('n-kod').value);
    if (!r.stav) {
      $('n-sprava').textContent = r.chyba === 'verzia' ? 'That code is from a newer version.' : 'That code does not look right.';
      return;
    }
    s = r.stav;
    uloz();
    location.reload();
  });
  $('n-reset').addEventListener('click', () => {
    const t = performance.now();
    if (t - resetCas > 4000) {
      resetCas = t;
      $('n-reset').textContent = 'Tap again to erase everything';
      setTimeout(() => ($('n-reset').textContent = 'Start over'), 4000);
      return;
    }
    try {
      uloziste.removeItem(E.KLUC);
    } catch {
      /* nič */
    }
    s = E.novyStav();
    mozeUkladat = false;
    location.reload();
  });
  $('navrat-tl').addEventListener('click', zatvorNavrat);
  $('navrat').addEventListener('click', (e) => {
    if (e.target === $('navrat')) zatvorNavrat();
  });
  $('mapa').addEventListener('click', (e) => {
    if (!mapa) return;
    const r = $('mapa').getBoundingClientRect();
    const u = mapa.uzolNa(e.clientX - r.left, e.clientY - r.top);
    mapa.zobud();
    if (u) ukazStitok(u, PR.casCitania(u.stitok));
  });
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const pole = t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT');
    if (e.key === 'Escape') {
      if (prechodBezi) prechodBezi();
      zatvorNavrat();
      dialogy.forEach(zatvorDialog);
      return;
    }
    if (e.key === 'Tab') {
      // fokus ostáva v otvorenom dialógu
      const d = ['rozhovor', 'nastavenia', 'navrat'].map($).find((x) => !x.hidden && (x.id === 'navrat' || x.classList.contains('otvorene')));
      if (d) {
        const f = d.querySelectorAll('button:not(:disabled), textarea');
        if (f.length) {
          const prvy = f[0];
          const posledny = f[f.length - 1];
          if (e.shiftKey && document.activeElement === prvy) {
            e.preventDefault();
            posledny.focus();
          } else if (!e.shiftKey && document.activeElement === posledny) {
            e.preventDefault();
            prvy.focus();
          }
        }
      }
      return;
    }
    if (pole || e.ctrlKey || e.metaKey || e.altKey) return;
    if (prechodBezi && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      prechodBezi();
      return;
    }
    const dialog = dialogy.some((x) => $(x).classList.contains('otvorene')) || !$('navrat').hidden;
    if (e.key === ' ' || e.code === 'Space') {
      if (t && t.tagName === 'BUTTON') return;
      e.preventDefault();
      if (!e.repeat && !dialog) {
        const k = $('sepkaj');
        k.classList.add('dole');
        setTimeout(() => k.classList.remove('dole'), 90);
        sepkaj();
      }
      return;
    }
    if (dialog || e.repeat) return;
    if (e.key === '1') kupRolu('p');
    else if (e.key === '2') kupRolu('k');
    else if (e.key === '3') kupRolu('t');
    else if (e.key === 't' || e.key === 'T') otvorZoznam('nastroje');
    else if (e.key === 'p' || e.key === 'P') otvorZoznam('ludia');
    else if (e.key === 'q' || e.key === 'Q') potichu();
    else return;
    if (mapa) mapa.zobud();
  });
  document.addEventListener('pointerup', () => zvuk.prebud());
  document.addEventListener('keyup', () => zvuk.prebud());
  document.addEventListener('visibilitychange', viditelnost);
  addEventListener('pagehide', uloz);
  if (mqPohyb.addEventListener) mqPohyb.addEventListener('change', () => {
    znizeny = !!mqPohyb.matches;
    if (mapa) mapa.reduced = znizeny;
  });
  if (mqPC.addEventListener) mqPC.addEventListener('change', () => {
    if (!mapa) return;
    mapa.okraje.hore = mqPC.matches ? 56 : 0;
    mapa.velkost();
    renderZoznamy(true);
  });
}

// ------------------------------------------------------------ štart

async function pismaPripravene() {
  if (!document.fonts || !document.fonts.load) return;
  const nacitaj = Promise.all([
    document.fonts.load('400 8px "Courier Prime"'),
    document.fonts.load('700 8px "Courier Prime"'),
    document.fonts.load('500 8px "Plex Mono"'),
    document.fonts.load('600 8px Fraunces'),
  ]).catch(() => {});
  await Promise.race([nacitaj, new Promise((r) => setTimeout(r, 1500))]);
}

async function start() {
  zvuk = new Zvuk();
  nastavZvuk(zvuk.zapnuty);
  if (UKAZKA) {
    s = UKAZKA.stav();
    znizeny = true;
    document.documentElement.dataset.obrazovka = parameter;
  } else {
    const n = E.nacitajZ(uloziste);
    if (n.stav) {
      s = n.stav;
      const gap = (Date.now() - n.ulozene) / 1000;
      if (gap > 2) navratNaStarte = E.nepritomnost(s, gap);
    } else if (n.chyba === 'uloziste') {
      mozeUkladat = false;
      $('neuklada').hidden = false;
    } else if (n.chyba) {
      try {
        uloziste.setItem(E.KLUC + '.poskodene', uloziste.getItem(E.KLUC));
      } catch {
        /* nič */
      }
      radio.push('your old notes were unreadable. we start again. i kept a copy.');
    }
    // vety, ktoré už padli, sa neopakujú; posledná veta ZERO ostane v rádiu
  }
  naviaz();
  render(true);
  // mapa
  mapa = new Mapa($('mapa'), $('kuzele'), {
    reduced: znizeny || !!mqPohyb.matches,
    slabe,
    naUzol: (u, cas) => ukazStitok(u, cas),
    poKamere: () => {
      polohaStitku();
      polohaVoditka();
    },
  });
  mapa.okraje.hore = mqPC.matches ? 56 : 0;
  if (UKAZKA) {
    mapa.reduced = !!mqPohyb.matches;
    mapa.zmraz(UKAZKA.kuzele || 3.2);
  }
  odhalUzly(true);
  mapa.nastavLudi(E.ludia(s), { hned: true });
  mapa.vodítko(s.voditkoCaka);
  mapa.nastavPozornost(s.pozornost, s.potichu > 0);
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => mapa.pripravena && mapa.velkost()).observe($('mapa-obal'));
  await pismaPripravene();
  await mapa.init();
  polohaVoditka();
  popisMapy();
  if (UKAZKA) return ukazkaHotova();
  // úvod: prvé vety padnú hneď v prvom kroku; pri návrate ukážeme poslednú vetu ZERO
  if (s.hra > 0 && !radio.bezi) {
    const posledna = [...PR.SPUSTACE].reverse().find((x) => x.kto === PR.ZERO && s.videne[x.id]);
    if (posledna) $('radio-text').textContent = posledna.text;
  }
  if (navratNaStarte) ukazNavrat(navratNaStarte);
  setInterval(tik, 250);
  setInterval(uloz, 10000);
  setInterval(popisMapy, 5000);
}

function ukazkaHotova() {
  const u = UKAZKA;
  $('radio-text').textContent = u.radio || '';
  if (u.oznam) {
    $('oznam').textContent = u.oznam;
    $('oznam').classList.add('vidno');
  }
  render(true);
  renderZoznamy(true);
  if (u.prechod) prechodAktu(u.prechod, true);
  if (u.navrat) ukazNavrat(u.navrat);
  if (u.rozhovor) otvorRozhovor();
  if (u.zoznam) otvorZoznam(u.zoznam);
}

start();
