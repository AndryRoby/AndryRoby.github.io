// ui.mjs: rozhranie kvízu „Týka sa ma e-faktúra?“ (SK aj EN, texty dodá štartovací modul).
//
// Zásady: jedna otázka na obrazovku, veľké tlačidlá, postup „Otázka 2 zo 6“, Späť (aj tlačidlo
// alebo gesto Späť v prehliadači cez history.pushState bez zmeny adresy), klávesnica (číslo
// vyberie odpoveď, Backspace vráti), čítačky (fokus na nadpis otázky, aria-pressed, aria-describedby).
// Žiadne vkladanie HTML reťazcov: všetko cez textContent. Žiadne inline štýly v HTML (CSP), šírku
// lišty nastavuje CSSOM (style.setProperty), čo CSP dovoľuje.
// Meranie: Umami (window.umami.track) s frontom, lebo Umami skript sa načíta až po tomto module.

import {
  MAX_OTAZOK, ZDROJE, DOKUMENTY, EXPERIMENT, KONTROLNA,
  prejdi, vyhodnot, otazka, udalostOtazky, UDALOSTI, cistyZdroj,
  priradVariantu, noveId, platneId, vynutenaVarianta,
} from './logika.mjs';

const KLUC_ID = 'arling_kviz_id';

function el(tag, trieda, text) {
  const e = document.createElement(tag);
  if (trieda) e.className = trieda;
  if (text != null) e.textContent = text;
  return e;
}

// ── Meranie ──────────────────────────────────────────────────────────────────
function vytvorMeranie(zaklad) {
  const front = [];
  let pokusy = 0;
  let casovac = null;
  const pripravene = () => typeof window.umami === 'object' && window.umami && typeof window.umami.track === 'function';
  function vyprazdni() {
    while (front.length && pripravene()) {
      const [n, d] = front.shift();
      try { window.umami.track(n, d); } catch (e) { /* meranie nikdy neblokuje kvíz */ }
    }
  }
  function cakaj() {
    if (casovac) return;
    casovac = setInterval(() => {
      pokusy += 1;
      if (pripravene()) { vyprazdni(); clearInterval(casovac); casovac = null; }
      else if (pokusy > 40) { clearInterval(casovac); casovac = null; front.length = 0; } // Umami blokované: vzdať po ~12 s
    }, 300);
  }
  return function sleduj(nazov, data) {
    front.push([nazov, Object.assign({}, zaklad, data || {})]);
    if (pripravene()) vyprazdni(); else cakaj();
  };
}

// ── Varianta ─────────────────────────────────────────────────────────────────
function zistiVariantu(parametre) {
  const vynutena = vynutenaVarianta(parametre.get('varianta'));
  if (vynutena) return { kod: vynutena, meranie: vynutena + '-nahlad' };
  if (!EXPERIMENT.zapnuty) return { kod: KONTROLNA, meranie: KONTROLNA }; // nič sa neukladá
  let id = null;
  if (EXPERIMENT.ulozitId) { try { id = localStorage.getItem(KLUC_ID); } catch (e) { id = null; } }
  if (!platneId(id)) {
    try { id = noveId((n) => crypto.getRandomValues(new Uint8Array(n))); } catch (e) { id = null; }
    if (id && EXPERIMENT.ulozitId) { try { localStorage.setItem(KLUC_ID, id); } catch (e) { /* bez úložiska: ID len pre túto návštevu */ } }
  }
  const kod = priradVariantu(id || '');
  return { kod, meranie: kod };
}

export function spusti(T, koren = document.getElementById('kviz')) {
  if (!koren) return;
  const parametre = new URLSearchParams(location.search);
  const varianta = zistiVariantu(parametre);
  const sleduj = vytvorMeranie({ jazyk: T.jazyk, varianta: varianta.meranie });
  const redukovanyPohyb = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [uvL, uvP] = T.ui.uvodzovky || ['„', '“'];

  const videne = new Set();
  const zodpovedane = new Set();
  let kolo = 1;
  let dosiahnutyVysledok = false;
  let odchodOdoslany = false;
  let aktualneCislo = 1;
  let hlbka = 0;
  let stav = { kviz: true, hlbka: 0, cesta: ['q1'], odpovede: {}, vysledok: false };
  const pamat = {}; // posledná odpoveď na každú otázku, aby Späť ukázal predchádzajúcu voľbu
  let zamknute = false;

  document.body.classList.add('kv-js');
  koren.classList.add('kv-karta-js');

  // ── História prehliadača ──
  function uloz(novy, pridat) {
    stav = novy;
    try {
      if (pridat) { hlbka += 1; stav.hlbka = hlbka; history.pushState(stav, ''); }
      else { stav.hlbka = hlbka; history.replaceState(stav, ''); }
    } catch (e) { /* bez histórie funguje Späť ručne */ }
  }
  window.addEventListener('popstate', (e) => {
    const s = e.state;
    // Položky bez nášho stavu vznikajú skokom na kotvu (napr. „Prejsť na obsah“). Tie kvíz nemenia.
    if (!s || !s.kviz || !Array.isArray(s.cesta)) return;
    hlbka = s.hlbka || 0;
    stav = s;
    vykresli(true);
  });

  function textOtazky(id) {
    const t = T.otazky[id];
    if (id === EXPERIMENT.otazka && varianta.kod !== KONTROLNA && t.varianty && t.varianty[varianta.kod]) {
      return Object.assign({}, t, t.varianty[varianta.kod]);
    }
    return t;
  }

  // ── Otázka ──
  function vykresliOtazku(id, presunFokus) {
    const o = otazka(id);
    const t = textOtazky(id);
    aktualneCislo = o.cislo;
    koren.replaceChildren();
    koren.dataset.krok = 'otazka';
    document.body.classList.toggle('kv-bezi', o.cislo > 1);

    const hlava = el('div', 'kv-hlava');
    const postup = el('p', 'kv-postup', T.ui.postup(o.cislo, MAX_OTAZOK));
    postup.id = 'kv-postup';
    const lista = el('div', 'kv-lista');
    lista.setAttribute('aria-hidden', 'true');
    const naplnenie = el('span');
    lista.append(naplnenie);
    naplnenie.style.setProperty('--podiel', String(o.cislo / MAX_OTAZOK));
    hlava.append(postup, lista);

    const nadpis = el('h2', 'kv-otazka', t.nadpis);
    nadpis.id = 'kv-otazka';
    nadpis.tabIndex = -1;
    const popisy = ['kv-postup'];
    let pomoc = null;
    if (t.pomoc) { pomoc = el('p', 'kv-pomoc', t.pomoc); pomoc.id = 'kv-pomoc'; popisy.push('kv-pomoc'); }
    nadpis.setAttribute('aria-describedby', popisy.join(' '));

    const skupina = el('div', 'kv-moznosti');
    skupina.setAttribute('role', 'group');
    skupina.setAttribute('aria-labelledby', 'kv-otazka');
    o.moznosti.forEach((kod, i) => {
      const m = t.moznosti[kod];
      const b = el('button', 'kv-moznost');
      b.type = 'button';
      b.dataset.kod = kod;
      const zvolena = pamat[id] === kod;
      b.setAttribute('aria-pressed', zvolena ? 'true' : 'false');
      const kluc = el('span', 'kv-kluc', String(i + 1));
      kluc.setAttribute('aria-hidden', 'true');
      const obsah = el('span', 'kv-moznost-text');
      obsah.append(el('span', 'kv-moznost-hlavny', m.text));
      if (m.pomoc) obsah.append(el('span', 'kv-moznost-pomoc', m.pomoc));
      b.append(kluc, obsah);
      b.addEventListener('click', () => vyber(id, kod, b));
      skupina.append(b);
    });

    const spodok = el('div', 'kv-spodok');
    if (o.cislo > 1) {
      const spat = el('button', 'kv-spat', T.ui.spat);
      spat.type = 'button';
      spat.addEventListener('click', spatKrok);
      spodok.append(spat);
    }
    const klavesy = el('p', 'kv-klavesy', T.ui.klavesy);
    spodok.append(klavesy);

    koren.append(hlava, nadpis);
    if (pomoc) koren.append(pomoc);
    koren.append(skupina, spodok);

    if (!videne.has(o.cislo)) {
      videne.add(o.cislo);
      sleduj(udalostOtazky(o.cislo, 'view'), { otazka: o.cislo, kolo });
    }
    if (presunFokus) zameraj(nadpis);
  }

  function vyber(id, kod, tlacidlo) {
    if (zamknute) return;
    zamknute = true;
    const o = otazka(id);
    koren.querySelectorAll('.kv-moznost').forEach((b) => b.setAttribute('aria-pressed', b === tlacidlo ? 'true' : 'false'));
    pamat[id] = kod;
    if (!zodpovedane.has(o.cislo)) {
      zodpovedane.add(o.cislo);
      sleduj(udalostOtazky(o.cislo, 'answer'), { otazka: o.cislo, odpoved: kod, kolo });
    }
    const odpovede = Object.assign({}, stav.odpovede, { [id]: kod });
    const p = prejdi(odpovede);
    const novy = { kviz: true, cesta: p.cesta, odpovede: p.ciste, vysledok: p.hotovo };
    setTimeout(() => {
      zamknute = false;
      uloz(novy, true);
      vykresli(true);
    }, redukovanyPohyb ? 0 : 160);
  }

  function spatKrok() {
    const zKroku = stav.vysledok ? 'vysledok' : String(aktualneCislo);
    sleduj(UDALOSTI.spat, { z_kroku: zKroku, kolo });
    if (hlbka > 0) { try { history.back(); return; } catch (e) { /* ručne nižšie */ } }
    // Ručný návrat bez histórie: zahodiť poslednú otázku cesty.
    const cesta = stav.cesta.slice();
    if (stav.vysledok) { uloz(Object.assign({}, stav, { vysledok: false }), false); }
    else if (cesta.length > 1) {
      cesta.pop();
      const odpovede = Object.assign({}, stav.odpovede);
      delete odpovede[cesta[cesta.length - 1]];
      uloz({ kviz: true, cesta, odpovede, vysledok: false }, false);
    }
    vykresli(true);
  }

  function znova(zSegmentu) {
    sleduj(UDALOSTI.znova, { z_segmentu: zSegmentu, kolo });
    kolo += 1;
    Object.keys(pamat).forEach((k) => delete pamat[k]);
    uloz({ kviz: true, cesta: ['q1'], odpovede: {}, vysledok: false }, true);
    vykresli(true);
  }

  // ── Výsledok ──
  function vykresliVysledok(presunFokus) {
    const v = vyhodnot(stav.odpovede);
    if (!v) { uloz({ kviz: true, cesta: ['q1'], odpovede: {}, vysledok: false }, false); vykresli(presunFokus); return; }
    const ts = T.segmenty[v.segment];
    koren.replaceChildren();
    koren.dataset.krok = 'vysledok';
    document.body.classList.add('kv-bezi');
    dosiahnutyVysledok = true;

    // Čísla odkazov podľa prvého výskytu zdroja.
    const cisla = new Map();
    v.zdroje.forEach((id, i) => cisla.set(id, i + 1));

    const stitok = el('p', 'kv-stitok', T.ui.vysledok);
    const nadpis = el('h2', 'kv-vysledok-nadpis', ts.nadpis);
    nadpis.id = 'kv-vysledok-nadpis';
    nadpis.tabIndex = -1;
    const istota = el('p', 'kv-istota kv-istota-' + v.istota, T.ui.istota[v.istota]);
    koren.append(stitok, nadpis, istota);

    const telo = el('div', 'kv-telo');
    for (const b of v.bloky) {
      if (b.typ === 'uvod') telo.append(odsek(T.tykaSaUvod[b.index], b.zdroje, cisla));
      else if (b.typ === 'segment') telo.append(odsek(ts.odseky[b.index], b.zdroje, cisla));
    }
    koren.append(telo);

    // Výzvy hneď po hlavnom texte, poznámky až za nimi (nad ohybom má byť ďalší krok).
    const vyzvy = el('div', 'kv-vyzvy');
    vyzvy.append(el('h3', 'kv-vyzvy-nadpis', T.ui.coRobit));
    v.ciele.forEach((c) => {
      const tc = T.ciele[c.ciel];
      const riadok = el('div', c.poradie === 'hlavna' ? 'kv-vyzva kv-vyzva-hlavna' : 'kv-vyzva');
      let akcia;
      if (c.ciel === 'znova') {
        akcia = el('button', c.poradie === 'hlavna' ? 'kv-cta' : 'kv-odkaz', tc.text);
        akcia.type = 'button';
        akcia.addEventListener('click', () => znova(v.segment));
      } else {
        akcia = el('a', c.poradie === 'hlavna' ? 'kv-cta' : 'kv-odkaz', tc.text);
        akcia.href = tc.href;
        akcia.dataset.umamiEvent = UDALOSTI.vyzva;
        akcia.dataset.umamiEventSegment = v.segment;
        akcia.dataset.umamiEventCiel = c.ciel;
        akcia.dataset.umamiEventCena = c.cena;
        akcia.dataset.umamiEventPoradie = c.poradie;
        akcia.dataset.umamiEventJazyk = T.jazyk;
        akcia.dataset.umamiEventVarianta = varianta.meranie;
      }
      riadok.append(akcia);
      if (tc.popis) riadok.append(el('p', 'kv-vyzva-popis', tc.popis));
      vyzvy.append(riadok);
    });
    koren.append(vyzvy);

    const pozn = v.bloky.filter((b) => b.typ === 'poznamka');
    if (pozn.length) {
      const obal = el('div', 'kv-poznamky');
      for (const b of pozn) {
        const tp = T.poznamky[b.id];
        if (tp.rozbalit) {
          const d = el('details', 'kv-pozn kv-pozn-rozbal');
          d.append(el('summary', null, tp.nadpis), odsek(tp.text, b.zdroje, cisla));
          obal.append(d);
        } else {
          const d = el('div', 'kv-pozn');
          d.append(el('h3', null, tp.nadpis), odsek(tp.text, b.zdroje, cisla));
          obal.append(d);
        }
      }
      koren.append(obal);
    }

    koren.append(zoznamZdrojov(v.zdroje, cisla));
    koren.append(suhrnOdpovedi(v));

    sleduj(UDALOSTI.vysledok, Object.assign({ segment: v.segment, istota: v.istota, kolo }, v.odpovede));
    if (presunFokus) zameraj(nadpis);
  }

  function odsek(text, zdroje, cisla) {
    const p = el('p', 'kv-odsek', text);
    if (zdroje && zdroje.length) {
      p.append(' ');
      const ref = el('span', 'kv-ref');
      ref.append('[');
      zdroje.forEach((id, i) => {
        if (i) ref.append(', ');
        const a = el('a', 'kv-ref-a', String(cisla.get(id)));
        a.href = '#kv-z-' + cisla.get(id);
        ref.append(a);
      });
      ref.append(']');
      p.append(ref);
    }
    return p;
  }

  function zoznamZdrojov(zdroje, cisla) {
    const d = el('details', 'kv-zdroje');
    d.id = 'kv-zdroje';
    d.append(el('summary', null, `${T.ui.zdrojeNadpis} (${zdroje.length})`));
    d.append(el('p', 'kv-zdroje-uvod', T.ui.zdrojeUvod));
    const ol = el('ol', 'kv-zdroje-zoznam');
    for (const id of zdroje) {
      const z = ZDROJE[id];
      const li = el('li');
      li.id = 'kv-z-' + cisla.get(id);
      const doc = el('span', 'kv-zdroj-dok', T.dokumenty[z.dok]);
      li.append(doc);
      if (z.dok === 'faq') li.append(', ' + T.miesto(z));
      const tz = (T.zdroje && T.zdroje[id]) || {};
      const citat = (T.citaty && T.citaty[id]) || tz.citat || (z.dok === 'faq' ? z.citat : null);
      if (citat) {
        const q = el('q', 'kv-citat');
        q.textContent = citat;
        li.append(': ', uvL, q, uvP);
        if (T.citaty && T.citaty[id] && T.ui.preklad) li.append(' ' + T.ui.preklad);
      } else if (tz.popis) {
        li.append(': ' + tz.popis);
      }
      li.append(' ');
      const a = el('a', 'kv-zdroj-odkaz', T.ui.otvorit);
      a.href = odkazZdroja(z);
      if (z.dok !== 'arling') { a.target = '_blank'; a.rel = 'noopener'; }
      a.dataset.umamiEvent = UDALOSTI.zdroj;
      a.dataset.umamiEventZdroj = id;
      a.dataset.umamiEventJazyk = T.jazyk;
      li.append(a);
      ol.append(li);
    }
    d.append(ol);
    return d;
  }

  function odkazZdroja(z) {
    if (z.dok === 'arling') return (T.jazyk === 'en' ? '/efaktura/en/' : '/efaktura/') + (z.kotva || '');
    const url = DOKUMENTY[z.dok];
    return z.dok === 'faq' && z.strana ? url + '#page=' + z.strana : url;
  }

  function suhrnOdpovedi(v) {
    const d = el('details', 'kv-odpovede');
    d.append(el('summary', null, T.ui.odpovedeNadpis));
    const dl = el('dl');
    for (const id of Object.keys(v.odpovede)) {
      const t = T.otazky[id];
      dl.append(el('dt', null, t.nadpis), el('dd', null, t.moznosti[v.odpovede[id]].text));
    }
    d.append(dl);
    const akcie = el('div', 'kv-odpovede-akcie');
    const zmenit = el('button', 'kv-odkaz', T.ui.zmenit);
    zmenit.type = 'button';
    zmenit.addEventListener('click', spatKrok);
    const odznova = el('button', 'kv-odkaz', T.ui.znova);
    odznova.type = 'button';
    odznova.addEventListener('click', () => znova(v.segment));
    akcie.append(zmenit, odznova);
    d.append(akcie);
    return d;
  }

  function zameraj(prvok) {
    try { prvok.focus({ preventScroll: true }); } catch (e) { prvok.focus(); }
    const hore = koren.getBoundingClientRect().top;
    if (hore < 0 || hore > window.innerHeight * 0.6) {
      koren.scrollIntoView({ block: 'start', behavior: redukovanyPohyb ? 'auto' : 'smooth' });
    }
  }

  function vykresli(presunFokus) {
    if (stav.vysledok) vykresliVysledok(presunFokus);
    else vykresliOtazku(stav.cesta[stav.cesta.length - 1] || 'q1', presunFokus);
  }

  // Odkaz na zdroj v texte otvorí zbalený zoznam zdrojov a posunie sa k položke.
  // Bez skoku na kotvu, aby nevznikla položka histórie bez stavu kvízu.
  koren.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a.kv-ref-a');
    if (!a) return;
    e.preventDefault();
    const d = koren.querySelector('#kv-zdroje');
    if (d) d.open = true;
    const ciel = koren.querySelector(a.getAttribute('href'));
    if (!ciel) return;
    ciel.tabIndex = -1;
    ciel.scrollIntoView({ block: 'center', behavior: redukovanyPohyb ? 'auto' : 'smooth' });
    try { ciel.focus({ preventScroll: true }); } catch (err) { ciel.focus(); }
  });

  // ── Klávesnica ──
  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const cie = e.target;
    if (cie && (cie.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(cie.tagName))) return;
    if (cie && cie !== document.body && !koren.contains(cie)) return;
    if (e.key === 'Backspace') {
      if (stav.vysledok || stav.cesta.length > 1) { e.preventDefault(); spatKrok(); }
      return;
    }
    if (stav.vysledok) return;
    if (/^[1-9]$/.test(e.key)) {
      const tlacidla = koren.querySelectorAll('.kv-moznost');
      const b = tlacidla[Number(e.key) - 1];
      if (b) { e.preventDefault(); b.click(); }
    }
  });

  // ── Odchod pred výsledkom (najlepšie úsilie, pozri MERANIE.md) ──
  function odchod() {
    if (odchodOdoslany || dosiahnutyVysledok) return;
    odchodOdoslany = true;
    sleduj(UDALOSTI.odchod, { posledna_otazka: aktualneCislo, kolo });
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') odchod(); });
  window.addEventListener('pagehide', odchod);

  // ── Štart ──
  // Po návrate tlačidlom Späť z nástroja (bfcache alebo obnovená história) pokračujeme v uloženom stave.
  const predosly = history.state;
  if (predosly && predosly.kviz && Array.isArray(predosly.cesta)) {
    hlbka = predosly.hlbka || 0;
    stav = predosly;
    const p = prejdi(stav.odpovede);
    Object.assign(pamat, p.ciste);
  } else {
    uloz(stav, false);
  }
  sleduj(UDALOSTI.start, { z: cistyZdroj(parametre.get('z')) });
  vykresli(false);
}
