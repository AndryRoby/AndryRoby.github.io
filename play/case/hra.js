// Olive's Daily Case: hra v prehliadači (28. 9. 2026, Fable; pokus 2 po bráne Astry 2). Logika je v jadro.js
// (testy ops/games/denny-pripad/). Mriežky sú natívne tabuľky: jedna zastávka Tab na mriežku, šípky, Home a End.
// Ťuk na bunku: prázdne, krížik, fajka; fajka dá krížiky do riadku a stĺpca (dá sa vypnúť). Prípad sa uzavrie, keď má
// každý sused odpoveď v každej otázke; pomocné mriežky sú poznámky. Nápoveda nájde ďalší platný krok zo správnych
// značiek a povie, z čoho plynie. Postup, séria a čas sú len v tomto prehliadači.
import { pripadDna, novaMriezka, kopiaMriezky, daj, zapisBunku, napoveda, chyby, chybyOdpovedi, chybajuce, textStopy, ktoText, cisloPripadu, START } from './jadro.js';
import { ikona } from './ikony.js';

const $ = (s) => document.querySelector(s);
const KLUC = 'arling-case-v1';
const dnes = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const posun = (datum, dni) => new Date(Date.parse(datum + 'T12:00:00Z') + dni * 864e5).toISOString().slice(0, 10);
const JE_DATUM = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);

// ---------- úložisko (skontrolované; pri chybe bezpečné predvolené hodnoty) ----------
let ulozisko = true;
function nacitaj() {
  const u = { dni: {}, seria: 0, poslednyVyrieseny: null, milost: false, autoX: true, zvuk: false, zacate: {} };
  let data = null;
  try { localStorage.setItem(KLUC + '-test', '1'); localStorage.removeItem(KLUC + '-test'); } catch { ulozisko = false; }
  // poškodený záznam nie je zákaz ukladania: začne sa odznova a nový postup sa normálne uloží
  if (ulozisko) { try { data = JSON.parse(localStorage.getItem(KLUC) || 'null'); } catch { data = null; } }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (data.dni && typeof data.dni === 'object' && !Array.isArray(data.dni)) u.dni = data.dni;
    if (Number.isInteger(data.seria) && data.seria >= 0) u.seria = data.seria;
    if (JE_DATUM(data.poslednyVyrieseny)) u.poslednyVyrieseny = data.poslednyVyrieseny;
    for (const k of ['milost', 'autoX', 'zvuk']) if (typeof data[k] === 'boolean') u[k] = data[k];
    if (data.zacate && typeof data.zacate === 'object' && !Array.isArray(data.zacate)) u.zacate = data.zacate;
  }
  return u;
}
const U = nacitaj();
function uloz() {
  if (!ulozisko) return;
  try { localStorage.setItem(KLUC, JSON.stringify(U)); } catch { ulozisko = false; upozorniNaUlozisko(); }
}
function upozorniNaUlozisko() { const e = $('#case-ulozisko'); if (e) e.hidden = false; }

// ---------- prípad dňa (archív 7 dní; budúce len pri kontrole na PC) ----------
const DNES = dnes();
let DATUM = DNES;
const q = new URLSearchParams(location.search).get('d');
const lokalne = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
if (JE_DATUM(q) && q >= START && (lokalne || (q <= DNES && q >= posun(DNES, -7)))) DATUM = q;

const P = pripadDna(DATUM);
const KAT = { who: 'Who', what: 'Borrowed', where: 'Went to', when: 'Set off' };
const OTAZKA = { what: 'borrowed', where: 'went to', when: 'set off' };
const kratko = (s) => s.replace(/^the /, '');
const dvojice = [];
for (let a = 0; a < P.m; a++) for (let b = a + 1; b < P.m; b++) dvojice.push([a, b]);

// ---------- stav ----------
const platny = (z) => z && typeof z === 'object' && Array.isArray(z.preskrtnute) && Number.isFinite(z.napovedy) && Number.isFinite(z.ms) && typeof z.vyriesene === 'boolean';
if (!platny(U.dni[DATUM])) U.dni[DATUM] = { bunky: null, preskrtnute: [], napovedy: 0, ms: 0, vyriesene: false };
const zaznam = U.dni[DATUM];
let stav = novaMriezka(P.n, P.m);
if (zaznam.bunky && typeof zaznam.bunky === 'object') for (const k in stav.rel) {
  const b = zaznam.bunky[k];
  if (Array.isArray(b) && b.length === stav.rel[k].length && b.every((x) => x === 0 || x === 1 || x === -1)) stav.rel[k] = Int8Array.from(b);
}
const historia = [];
let aktivna = 0, zvyraznena = null, premisy = [], casStart = performance.now();
const casSpolu = () => (zaznam.vyriesene ? zaznam.ms : zaznam.ms + (performance.now() - casStart));
const ulozStav = () => {
  zaznam.bunky = {}; for (const k in stav.rel) zaznam.bunky[k] = Array.from(stav.rel[k]);
  zaznam.ms = casSpolu(); casStart = performance.now(); uloz();
};
const hodiny = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const sledu = (nazov, data) => { try { window.umami?.track(nazov, data); } catch { /* bez štatistík */ } };

// ---------- texty ----------
const zoznamSlov = (a, spojka = 'and') => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' ' + spojka + ' ' + a[a.length - 1]);
const maleZaciatok = (s) => s.replace(/^Whoever/, 'whoever');
function fakt(a, i, b, j, v) {
  const [x, y] = a < b ? [[a, i], [b, j]] : [[b, j], [a, i]];
  return textStopy(P, { typ: v === 1 ? 'rovnaky' : 'rozny', e: [x, y] }).replace(/\.$/, '');
}
function moznosti(c, idx) {
  const k = P.kategorie[c], x = idx.map((v) => k.polozky[v]);
  if (k.id === 'what') return 'borrowed ' + zoznamSlov(x, 'or');
  if (k.id === 'where') return 'gone to ' + zoznamSlov(x, 'or');
  if (k.id === 'when') return 'set off at ' + zoznamSlov(x, 'or');
  return 'been ' + zoznamSlov(x, 'or');
}
const Kto = (E) => { const t = ktoText(P, E); return t[0].toUpperCase() + t.slice(1); };
// Vysvetlenie kroku z jeho premís (jadro.js vyvod).
function vysvetli(k) {
  const zaver = fakt(k.a, k.i, k.b, k.j, k.v);
  if (typeof k.dovod === 'number') {
    const st = P.stopy[k.dovod], n = k.dovod + 1, cit = `Clue ${n}: “${st.text}”`;
    if (st.typ === 'rovnaky' || st.typ === 'rozny') return `Clue ${n} says it directly: ${zaver}.`;
    if (st.typ === 'jedenZ' && k.nie) return `${cit} You already know ${maleZaciatok(fakt(...k.nie, -1))}, so ${maleZaciatok(zaver)}.`;
    if ((st.typ === 'skor' || st.typ === 'hodinaPo') && k.iny) return `${cit} ${Kto(k.iny)} can only have ${moznosti(P.T, k.moznosti)}, so ${maleZaciatok(zaver)}.`;
    if (st.typ === 'skor' || st.typ === 'hodinaPo') return `${cit} It compares two different people, so ${maleZaciatok(zaver)}.`;
    return `${cit} So ${maleZaciatok(zaver)}.`;
  }
  if (k.dovod === 'riadok') return `You already know ${maleZaciatok(fakt(...k.ano, 1))}. Every row and column has just one match, so ${maleZaciatok(zaver)}.`;
  if (k.dovod === 'posledna') {
    const kde = k.os === 'riadok' ? P.kategorie[k.a].polozky[k.i] : P.kategorie[k.b].polozky[k.j];
    return `Every other option for ${kde} is ruled out, so ${maleZaciatok(zaver)}.`;
  }
  if (k.dovod === 'spojenie') return `You already know ${maleZaciatok(fakt(...k.link, 1))} and ${maleZaciatok(fakt(...k.znama))}. Both are the same person, so ${maleZaciatok(zaver)}.`;
  if (k.dovod === 'vylucenie') return `${Kto([k.a, k.i])} can only have ${moznosti(k.kat, k.moz1)}, and ${ktoText(P, [k.b, k.j])} only ${moznosti(k.kat, k.moz2).replace(/^(borrowed|gone to|set off at|been) /, '')}. Nothing matches, so they are different people: ${maleZaciatok(zaver)}.`;
  return zaver + '.';
}

// ---------- hlavička, stopy ----------
function hlavicka() {
  $('#case-cislo').textContent = `Case #${P.cislo}`;
  const d = new Date(DATUM + 'T12:00:00Z');
  $('#case-datum').textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  $('#case-velkost').textContent = `${P.n} neighbours, ${P.m - 1} questions each`;
  const kto = P.kategorie[0].polozky;
  const otazky = P.kategorie.slice(1).map((k) => ({ what: 'what they borrowed', where: 'where they went', when: 'when they set off' }[k.id]));
  $('#case-uvod').textContent = `${zoznamSlov(kto)} all left early this morning, each with something borrowed from the village hall. Help me work out ${zoznamSlov(otazky)}.`;
  if (DATUM !== DNES) $('#case-archiv').hidden = false;
}
function stopy() {
  const ol = $('#case-stopy');
  ol.textContent = '';
  P.stopy.forEach((st, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'case-stopa'; btn.dataset.i = i;
    btn.setAttribute('aria-pressed', zaznam.preskrtnute.includes(i) ? 'true' : 'false');
    const veci = st.e.filter((E) => P.kategorie[E[0]].id === 'what').map((E) => P.kategorie[E[0]].polozky[E[1]]);
    btn.innerHTML = `<span class="case-stopa-c">${i + 1}</span><span class="case-stopa-t"></span><span class="case-stopa-ik">${veci.map((v) => ikona(v)).join('')}</span>`;
    btn.querySelector('.case-stopa-t').textContent = st.text;
    btn.addEventListener('click', () => {
      const j = zaznam.preskrtnute.indexOf(i);
      if (j >= 0) zaznam.preskrtnute.splice(j, 1); else zaznam.preskrtnute.push(i);
      btn.setAttribute('aria-pressed', j >= 0 ? 'false' : 'true');
      uloz();
    });
    li.append(btn);
    ol.append(li);
  });
}

// ---------- mriežky (natívne tabuľky) ----------
const nazovBunky = (a, i, b, j) => `${P.kategorie[a].polozky[i]} and ${P.kategorie[b].polozky[j]}`;
function mriezky() {
  const karty = $('#case-karty'), obal = $('#case-mriezky');
  karty.textContent = ''; obal.textContent = '';
  dvojice.forEach(([a, b], x) => {
    const tab = document.createElement('button');
    tab.type = 'button'; tab.className = 'case-karta'; tab.setAttribute('role', 'tab');
    tab.id = 'case-karta-' + x; tab.setAttribute('aria-controls', 'case-m-' + x);
    tab.textContent = `${KAT[P.kategorie[a].id]} · ${KAT[P.kategorie[b].id]}`;
    tab.addEventListener('click', () => { aktivna = x; oznacKartu(); });
    karty.append(tab);

    const sek = document.createElement('div');
    sek.className = 'case-m'; sek.id = 'case-m-' + x; sek.setAttribute('role', 'tabpanel'); sek.setAttribute('aria-labelledby', tab.id);
    const t = document.createElement('table');
    t.className = 'case-tab';
    const cap = document.createElement('caption');
    cap.textContent = `${KAT[P.kategorie[a].id]} and ${KAT[P.kategorie[b].id].toLowerCase()}`;
    t.append(cap);
    const hl = document.createElement('thead'), hr = document.createElement('tr');
    hr.append(Object.assign(document.createElement('td'), { className: 'case-roh' }));
    P.kategorie[b].polozky.forEach((nm, j) => {
      const th = document.createElement('th');
      th.scope = 'col'; th.className = 'case-hs'; th.dataset.j = j;
      th.innerHTML = '<span></span>'; th.firstChild.textContent = kratko(nm);
      hr.append(th);
    });
    hl.append(hr); t.append(hl);
    const telo = document.createElement('tbody');
    P.kategorie[a].polozky.forEach((nm, i) => {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row'; th.className = 'case-hr'; th.dataset.i = i; th.textContent = kratko(nm);
      tr.append(th);
      for (let j = 0; j < P.n; j++) {
        const td = document.createElement('td');
        const c = document.createElement('button');
        c.type = 'button'; c.className = 'case-b'; c.tabIndex = i === 0 && j === 0 ? 0 : -1;
        c.dataset.a = a; c.dataset.i = i; c.dataset.b = b; c.dataset.j = j;
        c.addEventListener('click', () => tuk(a, i, b, j));
        c.addEventListener('focus', () => { t.querySelectorAll('.case-b').forEach((e) => { e.tabIndex = -1; }); c.tabIndex = 0; krizZvyrazni(t, i, j, true); });
        c.addEventListener('blur', () => krizZvyrazni(t, i, j, false));
        c.addEventListener('pointerenter', () => krizZvyrazni(t, i, j, true));
        c.addEventListener('pointerleave', () => krizZvyrazni(t, i, j, false));
        td.append(c); tr.append(td);
      }
      telo.append(tr);
    });
    t.append(telo);
    t.addEventListener('keydown', (e) => {
      const c = e.target.closest('.case-b'); if (!c) return;
      let i = +c.dataset.i, j = +c.dataset.j;
      if (e.key === 'ArrowRight') j = Math.min(P.n - 1, j + 1);
      else if (e.key === 'ArrowLeft') j = Math.max(0, j - 1);
      else if (e.key === 'ArrowDown') i = Math.min(P.n - 1, i + 1);
      else if (e.key === 'ArrowUp') i = Math.max(0, i - 1);
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = P.n - 1;
      else return;
      e.preventDefault();
      t.querySelector(`.case-b[data-i="${i}"][data-j="${j}"]`).focus();
    });
    sek.append(t);
    obal.append(sek);
  });
  oznacKartu();
  prekresli();
}
function krizZvyrazni(t, i, j, zap) {
  t.querySelectorAll(`.case-hr[data-i="${i}"], .case-hs[data-j="${j}"]`).forEach((e) => e.classList.toggle('je', zap));
}
function oznacKartu() {
  document.querySelectorAll('.case-karta').forEach((e, x) => { e.setAttribute('aria-selected', x === aktivna ? 'true' : 'false'); e.tabIndex = x === aktivna ? 0 : -1; });
  document.querySelectorAll('.case-m').forEach((e, x) => e.classList.toggle('aktivna', x === aktivna));
  const k = document.getElementById('case-karta-' + aktivna), pas = k && k.parentElement;
  if (pas && pas.scrollWidth > pas.clientWidth) pas.scrollTo({ left: k.offsetLeft - pas.offsetLeft - (pas.clientWidth - k.offsetWidth) / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
const jeBunka = (x, a, i, b, j) => x && ((x[0] === a && x[1] === i && x[2] === b && x[3] === j) || (x[0] === b && x[1] === j && x[2] === a && x[3] === i));
function prekresli() {
  document.querySelectorAll('.case-b').forEach((c) => {
    const a = +c.dataset.a, i = +c.dataset.i, b = +c.dataset.b, j = +c.dataset.j;
    const s = daj(stav, a, i, b, j);
    c.dataset.s = s === 1 ? 'ano' : s === -1 ? 'nie' : '';
    c.setAttribute('aria-label', `${nazovBunky(a, i, b, j)}: ${s === 1 ? 'match' : s === -1 ? 'ruled out' : 'empty'}`);
    c.classList.toggle('hint', !!zvyraznena && jeBunka([zvyraznena.a, zvyraznena.i, zvyraznena.b, zvyraznena.j], a, i, b, j));
    c.classList.toggle('premisa', premisy.some((x) => jeBunka(x, a, i, b, j)));
  });
  dvojice.forEach(([a, b], x) => {
    let plna = true;
    for (let i = 0; i < P.n && plna; i++) { let f = 0; for (let j = 0; j < P.n; j++) if (daj(stav, a, i, b, j) === 1) f++; if (f !== 1) plna = false; }
    const k = $('#case-karta-' + x); if (k) k.classList.toggle('plna', plna);
  });
  odpovede();
  const chyba = chybajuce(P, stav);
  $('#case-over').disabled = !!chyba.length || zaznam.vyriesene;
  $('#case-spat').disabled = !historia.length || zaznam.vyriesene;
  const ch = $('#case-chyba');
  if (zaznam.vyriesene) ch.textContent = '';
  else if (chyba.length) {
    const podla = {};
    for (const x of chyba) (podla[x.i] ||= []).push(OTAZKA[P.kategorie[x.b].id]);
    const casti = Object.entries(podla).map(([i, o]) => `${P.kategorie[0].polozky[i]} (${zoznamSlov(o)})`);
    ch.textContent = `To close the case, answer: ${zoznamSlov(casti)}.`;
  } else ch.textContent = 'Every neighbour has an answer. Close the case to check it.';
}
// Odpovede: pre každého suseda, čo už má fajku.
function odpovede() {
  const t = $('#case-tabula');
  t.textContent = '';
  P.kategorie[0].polozky.forEach((meno, i) => {
    const r = document.createElement('li');
    const m = document.createElement('span'); m.className = 'case-t-meno'; m.textContent = meno;
    const casti = document.createElement('span'); casti.className = 'case-t-casti';
    for (let b = 1; b < P.m; b++) {
      let x = null;
      for (let j = 0; j < P.n; j++) if (daj(stav, 0, i, b, j) === 1) x = P.kategorie[b].polozky[j];
      const k = P.kategorie[b].id, s = document.createElement('span');
      if (x) {
        s.className = 'case-t-ok';
        s.innerHTML = k === 'what' ? ikona(x, 'case-ik case-ik-s') : '';
        s.append(k === 'where' ? 'to ' + x : k === 'when' ? 'at ' + x : kratko(x));
      } else { s.className = 'case-t-nic'; s.textContent = OTAZKA[k] + ' ?'; }
      casti.append(s);
    }
    r.append(m, casti);
    t.append(r);
  });
}

// ---------- ťuk ----------
function tuk(a, i, b, j) {
  if (zaznam.vyriesene) return;
  historia.push(kopiaMriezky(stav));
  if (historia.length > 300) historia.shift();
  const s = daj(stav, a, i, b, j);
  const nove = s === 0 ? -1 : s === -1 ? 1 : 0;
  zapisBunku(stav, a, i, b, j, nove);
  if (nove === 1 && U.autoX) {
    for (let k = 0; k < P.n; k++) {
      if (k !== j && daj(stav, a, i, b, k) === 0) zapisBunku(stav, a, i, b, k, -1);
      if (k !== i && daj(stav, a, k, b, j) === 0) zapisBunku(stav, a, k, b, j, -1);
    }
  }
  if (!U.zacate[DATUM]) { U.zacate[DATUM] = true; sledu('case_start', { cislo: P.cislo }); }
  // text nápovedy ostáva (bunky sa pod prstom neposunú); keď hráč urobí, čo radila, povie to na tom istom mieste
  if (zvyraznena && zvyraznena.v !== undefined && jeBunka([zvyraznena.a, zvyraznena.i, zvyraznena.b, zvyraznena.j], a, i, b, j) && daj(stav, a, i, b, j) === zvyraznena.v) {
    zvyraznena = null; premisy = [];
    sprava('Done. Tap Hint whenever you want the next step.');
  }
  zvuk(nove === 1 ? 660 : nove === -1 ? 330 : 0);
  ulozStav();
  prekresli();
}

// ---------- nápoveda ----------
// Ťuk mení bunku v kruhu prázdne, krížik, fajka; koľko ťukov treba z aktuálneho stavu do cieľového.
const PORADIE = [0, -1, 1];
const tukov = (z, na) => (PORADIE.indexOf(na) - PORADIE.indexOf(z) + 3) % 3;
const slovom = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : 'three times');
function pokyn(a, i, b, j, v) {
  const n = tukov(daj(stav, a, i, b, j), v);
  const ciel = v === 1 ? 'a match' : v === -1 ? 'ruled out' : 'empty';
  return n ? `Tap it ${slovom(n)} so it shows ${ciel}.` : '';
}
function ukazNaMriezke(a, b) {
  aktivna = dvojice.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
  oznacKartu();
  prepniPanel('mriezka');
}
// Výška prilepených líšt nad obsahom (lišta hubu, na mobile aj prepínač): pod ňou musí byť text nápovedy.
function hornaHrana() {
  let h = 0;
  for (const el of [document.querySelector('header.site-header'), document.querySelector('.case-prepinac')]) {
    if (!el) continue;
    const r = el.getBoundingClientRect(), st = getComputedStyle(el);
    if ((st.position === 'sticky' || st.position === 'fixed') && r.bottom > 0 && r.top < 200) h = Math.max(h, r.bottom);
  }
  return h;
}
// Nápoveda: vysvetlenie aj cieľová bunka naraz v pohľade (text je hneď nad mriežkou s bunkou).
function ukazNapovedu() {
  const msg = $('#case-sprava'), bunka = document.querySelector('.case-b.hint');
  if (!msg || !bunka) return;
  const hore = hornaHrana() + 10, rm = msg.getBoundingClientRect(), rb = bunka.getBoundingClientRect();
  let posun = 0;
  if (rm.top < hore) posun = rm.top - hore;
  else if (rb.bottom > window.innerHeight - 16) posun = Math.min(rm.top - hore, rb.bottom - (window.innerHeight - 16));
  if (posun) window.scrollBy({ top: posun, behavior: 'instant' });
}
function napovedaKlik() {
  if (zaznam.vyriesene) return;
  // najprv zlé značky v odpovediach, potom v pomocných mriežkach (tie nie sú povinné, ale nápoveda ich opraví)
  const zle = [...chybyOdpovedi(P, stav), ...chyby(P, stav).filter((c) => c.a !== 0)];
  zaznam.napovedy++;
  if (zle.length) {
    const c = zle[0];
    const s = daj(stav, c.a, c.i, c.b, c.j);
    const spravne = s === 1 ? -1 : 1; // zlá fajka má byť krížik, zlý krížik je v riešení fajka
    zvyraznena = { ...c, v: spravne }; premisy = [];
    ukazNaMriezke(c.a, c.b); prekresli();
    sprava(`This mark does not fit the clues: ${nazovBunky(c.a, c.i, c.b, c.j)} ${s === 1 ? 'is not a match' : 'is a match'}. ${pokyn(c.a, c.i, c.b, c.j, spravne)}`, true);
    ukazNapovedu();
    ulozStav();
    return;
  }
  const h = napoveda(P, stav);
  if (!h) { sprava('Everything you can work out is already on the grid.'); ulozStav(); return; }
  const [a, i, b, j] = h.a < h.b ? [h.a, h.i, h.b, h.j] : [h.b, h.j, h.a, h.i];
  zvyraznena = { a, i, b, j, v: h.v };
  premisy = [h.ano, h.link, h.znama, h.nie].filter(Boolean).map((x) => x.slice(0, 4));
  ukazNaMriezke(a, b); prekresli();
  sprava(vysvetli(h) + ' ' + pokyn(a, i, b, j, h.v), true);
  ukazNapovedu();
  sledu('case_hint', { cislo: P.cislo });
  ulozStav();
}

// ---------- kontrola a koniec ----------
function over() {
  const zle = chybyOdpovedi(P, stav);
  if (zle.length) {
    $('#case-chyba').textContent = zle.length === 1 ? 'Close, but one answer does not fit the clues. A hint shows which one.' : `Close, but ${zle.length} marks in your answers do not fit the clues. A hint shows the first one.`;
    zvuk(220);
    return;
  }
  zaznam.ms = casSpolu();
  zaznam.vyriesene = true;
  zaznam.denny = DATUM === DNES;
  if (zaznam.denny && U.poslednyVyrieseny !== DNES) {
    // Séria: jeden vynechaný deň sa odpustí (návrat, nie dokonalosť); text to povie.
    if (U.poslednyVyrieseny === posun(DNES, -1)) { U.seria++; U.milost = false; }
    else if (U.poslednyVyrieseny === posun(DNES, -2)) { U.seria++; U.milost = true; }
    else { U.seria = 1; U.milost = false; }
    U.poslednyVyrieseny = DNES;
  }
  historia.length = 0;
  ulozStav();
  koniec(true);
  sledu('case_solved', { cislo: P.cislo, napovedy: zaznam.napovedy });
}
function textSerie() {
  if (!zaznam.denny) return 'This is an archive case, so it does not change your daily streak.';
  if (U.seria <= 1) return 'This is day one of your streak.';
  return `Your streak: ${U.seria} cases${U.milost ? ', with one missed day forgiven' : ''}.`;
}
function koniec(animuj) {
  const box = $('#case-koniec');
  box.hidden = false;
  $('#case-cas').textContent = hodiny(zaznam.ms);
  $('#case-nap').textContent = zaznam.napovedy === 1 ? '1 hint' : `${zaznam.napovedy} hints`;
  $('#case-seria').textContent = textSerie();
  const ul = $('#case-riesenie'); ul.textContent = '';
  P.kategorie[0].polozky.forEach((meno, i) => {
    const casti = P.kategorie.slice(1).map((k, x) => {
      const v = k.polozky[P.riesenie[x + 1][i]];
      return k.id === 'what' ? `borrowed ${v}` : k.id === 'where' ? `went to ${v}` : `set off at ${v}`;
    });
    ul.append(Object.assign(document.createElement('li'), { textContent: `${meno} ${zoznamSlov(casti)}.` }));
  });
  // Olive uzavrie prípad jednou vetou o prvej veci dňa.
  const vec = P.kategorie[1].polozky[0], kto = P.riesenie[1].indexOf(0), meno = P.kategorie[0].polozky[kto];
  const kam = P.kategorie.findIndex((k) => k.id === 'where');
  const miesto = kam > 0 ? ` at ${P.kategorie[kam].polozky[P.riesenie[kam][kto]]}` : '';
  $('#case-olive-veta').textContent = meno === 'Olive'
    ? `So it was me with ${vec}${miesto} all along. I should read my own notes. Case closed, see you tomorrow.`
    : `So ${meno} had ${vec}${miesto} all along. Everything is back where it belongs. Case closed, see you tomorrow.`;
  document.body.classList.add('case-hotovo');
  if (animuj) {
    box.classList.add('pecat'); zvukPeciatky();
    $('#case-koniec-h').focus({ preventScroll: true });
    box.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  prekresli();
}
function zdielaj() {
  const seria = zaznam.denny && U.seria > 1 ? ` Streak: ${U.seria} cases.` : '';
  const t = `Olive's Daily Case #${P.cislo}: closed in ${hodiny(zaznam.ms)} with ${zaznam.napovedy === 1 ? '1 hint' : zaznam.napovedy + ' hints'}.${seria} https://arling.sk/play/case/`;
  const tl = $('#case-zdielaj');
  const hotove = () => { tl.textContent = 'Copied'; setTimeout(() => { tl.textContent = 'Share my result'; }, 1800); };
  sledu('case_share', { cislo: P.cislo });
  if (navigator.share) { navigator.share({ text: t }).catch(() => {}); return; }
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(t).then(hotove, () => sprava(t));
  else sprava(t);
}

// ---------- panely na mobile (Stopy a Mriežka, každý si pamätá svoju polohu) ----------
const polohy = {};
const uzke = () => matchMedia('(max-width: 979px)').matches;
function prepniPanel(p) {
  const telo = $('.case-telo');
  const stary = telo.dataset.panel;
  document.querySelectorAll('.case-prepinac [role="tab"]').forEach((b) => b.setAttribute('aria-selected', b.dataset.panel === p ? 'true' : 'false'));
  telo.dataset.panel = p;
  if (!uzke() || stary === p) return;
  polohy[stary] = window.scrollY;
  const hore = $('.case-prepinac').getBoundingClientRect().top + window.scrollY - 72;
  window.scrollTo({ top: polohy[p] ?? Math.min(window.scrollY, hore), behavior: 'auto' });
}

// ---------- drobnosti ----------
// Text nápovedy: pri novej nápovede ide k aktívnej mriežke (na počítači sú viditeľné všetky) a drží si výšku,
// aby sa bunky pod prstom neposúvali, kým hráč ťuká.
function sprava(t, nova = false) {
  const el = $('#case-sprava');
  if (nova) {
    const m = document.getElementById('case-m-' + aktivna);
    if (m && el.parentElement !== m) m.prepend(el);
    el.style.minHeight = '';
    el.textContent = t;
    el.style.minHeight = el.offsetHeight + 'px';
  } else el.textContent = t;
}
let ac = null;
function zvuk(f) {
  if (!f || !U.zvuk) return;
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain(), k = ac.currentTime;
    o.type = 'triangle'; o.frequency.setValueAtTime(f, k);
    g.gain.setValueAtTime(0, k); g.gain.linearRampToValueAtTime(0.05, k + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, k + 0.12);
    o.connect(g).connect(ac.destination); o.start(k); o.stop(k + 0.14);
  } catch { /* bez zvuku */ }
}
function zvukPeciatky() { zvuk(140); setTimeout(() => zvuk(523), 90); setTimeout(() => zvuk(784), 220); }
function dalsiPripad() {
  const teraz = new Date(), polnoc = new Date(teraz); polnoc.setHours(24, 0, 0, 0);
  const min = Math.round((polnoc - teraz) / 6e4);
  $('#case-dalsi').textContent = `The next case opens in ${Math.floor(min / 60)} h ${min % 60} min.`;
}
function archiv() {
  const ul = $('#case-dni'); ul.textContent = '';
  for (let k = 1; k <= 7; k++) {
    const d = posun(DNES, -k);
    if (d < START) break;
    const a = document.createElement('a');
    a.href = '?d=' + d;
    a.textContent = `#${cisloPripadu(d)}`;
    if (U.dni[d]?.vyriesene) { a.classList.add('vyriesene'); a.setAttribute('aria-label', `Case ${cisloPripadu(d)}, solved`); }
    const li = document.createElement('li'); li.append(a); ul.append(li);
  }
  $('#case-archiv-blok').hidden = !ul.children.length;
}

// ---------- štart ----------
hlavicka();
stopy();
mriezky();
dalsiPripad();
archiv();
if (!ulozisko) upozorniNaUlozisko();
$('.case-telo').dataset.panel = 'stopy';
document.querySelectorAll('.case-prepinac [role="tab"]').forEach((b) => b.addEventListener('click', () => prepniPanel(b.dataset.panel)));
$('#case-auto').checked = U.autoX;
$('#case-auto').addEventListener('change', (e) => { U.autoX = e.target.checked; uloz(); });
const zvukTl = $('#case-zvuk');
const ukazZvuk = () => { zvukTl.setAttribute('aria-pressed', U.zvuk ? 'true' : 'false'); zvukTl.textContent = U.zvuk ? 'Sound on' : 'Sound off'; };
ukazZvuk();
zvukTl.addEventListener('click', () => { U.zvuk = !U.zvuk; ukazZvuk(); uloz(); });
$('#case-spat').addEventListener('click', () => { if (!historia.length) return; stav = historia.pop(); ulozStav(); prekresli(); });
$('#case-napoveda').addEventListener('click', napovedaKlik);
$('#case-over').addEventListener('click', over);
$('#case-zdielaj').addEventListener('click', zdielaj);
$('#case-karty').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  aktivna = (aktivna + (e.key === 'ArrowRight' ? 1 : dvojice.length - 1)) % dvojice.length;
  oznacKartu(); $('#case-karta-' + aktivna).focus();
});
setInterval(() => { if (!zaznam.vyriesene) $('#case-hodiny').textContent = hodiny(casSpolu()); dalsiPripad(); }, 1000);
document.addEventListener('visibilitychange', () => { if (document.hidden) ulozStav(); else casStart = performance.now(); });
if (zaznam.vyriesene) koniec(false);
document.body.classList.add('case-pripravene');
