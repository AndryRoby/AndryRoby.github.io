/* Hra: spaja jadro (dej a stav), reziu kapitoly, scenu, rozhranie a vstup.
 * Jadro povie, aky krok je na rade; hra ho ukaze a vysledok hraca posle spat. */
import { Jadro } from './jadro.js';
import * as R18 from './rezia18.js';
import { POZY, chodza, plazenie, vlecenie, mix } from './postavy.js';
import { POZY69 } from './postavy69.js';
import { zvuk } from './zvuk.js';
import { spustiM19 } from './mech/m19.js';
import { spustiPrevlek } from './mech/prevlek.js';
import { spustiUder } from './mech/uder.js';
import { spustiKontrolu, htmlKniha, htmlPasik } from './mech/svedkovia.js';
import { hlavaHerca } from './scena69.js';
import { nastavOkraj } from './ruky.js';
import { formatuj, riadky, esc } from './ui.js';
import { SVET } from './kulisy/vazenie.js';

const cakaj = (ms) => new Promise((r) => setTimeout(r, ms));
const POCUVANIE = {
  o_kroky: { zvuk: () => zvuk.kroky(-0.8, 7), smer: -0.8, auto: 6 },
  o_guverner: { zvuk: () => zvuk.hlasy(0.6), smer: 0.6, volitelne: true },
  o_vlecenie: { zvuk: () => zvuk.vlecenie(0.8), smer: 0.8, auto: 5 },
};
/* Kto hovori pri tone a karte (vlastny text rozhrania) */
const KTO_EN = { busoni: 'Busoni', wilmore: 'Wilmore' };

export class Hra {
  constructor(o) {
    Object.assign(this, o);
    this.R = o.rezia || R18;
    this.P = this.R.KAPITOLA === 69 ? POZY69 : POZY;
    this.zvuk = zvuk;
    for (const [id, p] of Object.entries(this.R.POCUVANIE || {})) POCUVANIE[id] = { zvuk: () => zvuk[p.zvuk](p.smer), smer: p.smer, auto: p.auto, volitelne: p.volitelne };
    this.rezim = null;
    this.akc = null;
    this.anim = new Map();
    this.pozT = 0;
    this.pocT = 0;
    this.textOd = 0;
    this.zachytTeraz = false;
    this.lokacia = '';
    const druhy = this.data.beaty.flatMap((b) => b.kroky).find((k) => k.id === 'list_druhy');
    if (druhy) nastavOkraj(druhy.riadky);
  }

  /* ── start a ulozenie ── */
  start(ulozene) {
    this.lokacia = '';
    this.j = new Jadro(this.data, { na: (u) => this.udalost(u), ulozene });
    this.j.postup();
    this.zobraz();
    this.kvapky();
  }
  uloz() { this.ulozenie.ulozKapitolu(this.data.kapitola, this.j.uloz()); }

  udalost(u) {
    if (u.typ === 'beat') { this.nastavBeat(u.beat); if (this.j) this.uloz(); }
    else if (u.typ === 'dennik') {
      const d = this.data.dennik.find((q) => q.id === u.id);
      this.ui.toast(u.id.startsWith('H') ? 'Faria’s words, in your journal' : d && d.otazka ? 'A question for your journal' : /^U\d/.test(u.id) ? 'A clue, in your journal' : 'Noted in your journal');
      this.panely.obnov();
    } else if (u.typ === 'uzavrete') { this.ui.toast('A question in your journal is answered'); this.panely.obnov(); }
    else if (u.typ === 'kontrolny_bod' || u.typ === 'uloz') this.uloz();
    else if (u.typ === 'okno') this.obnovCiele();
  }

  /* ── rezia beatu ── */
  nastavBeat(beat) {
    const r = this.R.BEATY[beat.id];
    if (!r) return;
    const sc = this.scena, st = sc.st;
    const sKamerou = r.kulisa === 'svet' || r.kulisa === 'dom';
    const lok = r.kulisa + ':' + (sKamerou ? (r.svet || '') + (r.kam.sleduj ? 'e' : r.kam.x) : r.tablo || '');
    const strih = lok !== this.lokacia && !(r.kulisa === 'tablo' && this.lokacia.startsWith('tablo:tablo:') && r.tablo !== 'tablo:1807' && r.tablo !== 'tablo:69prolog');
    this.lokacia = lok;
    sc.detail = null;
    for (const an of this.anim.values()) if (an.res) an.res();
    this.anim.clear();
    if (r.kulisa === 'tablo') {
      if (strih) { st.clona = 1; sc.odclon(0.8); }
      sc.tablo(r.tablo, strih ? 0 : 0.9);
    } else if (r.kulisa === 'mapa69' || r.kulisa === 'villefort') {
      st.kulisa = r.kulisa;
      if (r.kulisa === 'mapa69') Object.assign(st.m69, { kocar: 0, kocar2: 0, grof: 0 });
      if (r.kulisa === 'villefort') st.vlampa = 1;
      st.clona = 1; sc.odclon(0.9);
    } else {
      st.kulisa = r.kulisa;
      if (r.svet) st.svet = r.svet;
      if (r.dom) Object.assign(st.dom, r.dom);
      st.kam.sleduj = r.kam.sleduj || null;
      if (!r.kam.sleduj) st.kam.ciel = r.kam.x;
      for (const [meno, h] of Object.entries(r.herci || {})) {
        const a = st.herci[meno];
        a.vid = !!h.vid;
        if (!h.vid) continue;
        if (h.cesta) { this.naCestu(meno, h.cesta, h.u || 0); continue; }
        Object.assign(a, { x: h.x, y: h.y, smer: h.smer, poza: this.P[h.poza], rek: h.rek || null });
        if (meno === 'grof') {
          const v = this.R.vrstvyGrofa ? this.R.vrstvyGrofa(beat.id, this.j) : h.vrstvy;
          Object.assign(a, { vrstvy: new Set(v || []), okuliareNaOciach: !!h.okuliare, golierDole: !!h.golier, strhava: 0 });
        }
      }
      if (strih) {
        st.clona = 1; sc.odclon(0.7);
        const sirka = r.kulisa === 'dom' ? sc.sirka() : SVET.w;
        if (st.kam.sleduj) { const h = st.herci[st.kam.sleduj]; st.kam.ciel = Math.max(0, Math.min(sirka - 640, h.x - 320)); }
        st.kam.x = st.kam.ciel; st.kam.v = 0;
        Object.assign(st.svetlo, r.svetlo);
        if (r.kulisa === 'svet') { st.kamen = r.kamen; st.rohoz = r.rohoz; }
      } else sc.svetlo(r.svetlo, 1.4);
    }
    zvuk.dron(!!r.dron);
    this.opis(r.opis);
    this.slucka.zobud();
  }
  opis(t) { if (t) this.platnoOpis.textContent = t; }

  naCestu(meno, cesta, u) {
    const body = Array.isArray(cesta) ? cesta : this.R.CESTY[cesta];
    const dl = [0];
    for (let i = 1; i < body.length; i++) dl.push(dl[i - 1] + Math.hypot(body[i].x - body[i - 1].x, body[i].y - body[i - 1].y));
    this.cesta = { meno, body, dl, u, ciel: null, faza: 0 };
    this.polozNaCestu();
  }
  polozNaCestu() {
    const c = this.cesta;
    const { body, dl } = c;
    const u = Math.max(0, Math.min(dl.at(-1), c.u));
    let i = 1;
    while (i < body.length - 1 && dl[i] < u) i++;
    const a = body[i - 1], b = body[i];
    const q = (u - dl[i - 1]) / Math.max(0.001, dl[i] - dl[i - 1]);
    const h = this.scena.st.herci[c.meno];
    h.x = a.x + (b.x - a.x) * q;
    h.y = a.y + (b.y - a.y) * q;
    const smerCesty = Math.sign(b.x - a.x) || Math.sign(body.at(-1).x - body[0].x);
    if (c.posledny) h.smer = c.posledny > 0 ? smerCesty : -smerCesty;
    else h.smer = smerCesty;
    const m = b.m === 'plaz' || a.m === 'plaz' && q < 0.5 ? 'plaz' : 'chod';
    if (m === 'plaz') { h.poza = Object.assign({}, plazenie(c.faza), { otoc: Math.max(-0.4, Math.min(0.4, Math.atan2(b.y - a.y, Math.abs(b.x - a.x) + 0.01))) }); }
    else h.poza = c.hybe ? chodza(c.faza) : (c.stojPoza || POZY.stoj);
    h.vid = true;
    /* druhy herec ide za prvym po tej istej ceste (odprevadenie hosta) */
    if (c.nasleduje) this.polozNasledovnika(c);
  }
  polozNasledovnika(c) {
    const n = c.nasleduje, h = this.scena.st.herci[n.meno];
    const u = Math.max(0, Math.min(c.dl.at(-1), c.u + n.odstup));
    let i = 1;
    while (i < c.body.length - 1 && c.dl[i] < u) i++;
    const a = c.body[i - 1], b = c.body[i];
    const q = (u - c.dl[i - 1]) / Math.max(0.001, c.dl[i] - c.dl[i - 1]);
    h.x = a.x + (b.x - a.x) * q;
    h.y = a.y + (b.y - a.y) * q;
    h.smer = Math.sign(b.x - a.x) || h.smer;
    h.poza = c.hybe ? chodza(c.faza + 1.3) : POZY.stoj;
    h.vid = true;
  }
  /* automaticka chodza po ceste (bez hraca), napriklad host po schodoch */
  chodCestou(meno, body, hotovo) {
    const dl = [0];
    for (let i = 1; i < body.length; i++) dl.push(dl[i - 1] + Math.hypot(body[i].x - body[i - 1].x, body[i].y - body[i - 1].y));
    this.anim.set(meno, { druh: 'cesta', body, dl, u: 0, faza: 0, res: hotovo || (() => {}) });
    this.slucka.zobud();
  }
  dokonciCestu(meno, body) {
    const an = this.anim.get(meno);
    if (an && an.druh === 'cesta') { this.anim.delete(meno); }
    const h = this.scena.st.herci[meno], b = body.at(-1), a = body.at(-2);
    Object.assign(h, { x: b.x, y: b.y, smer: Math.sign(b.x - a.x) || h.smer, poza: POZY.stoj, vid: true });
  }

  /* ── zobrazenie kroku ── */
  zobraz() {
    const x = this.j.aktualny();
    this.x = x;
    this.akc = null;
    this.ui.vyzva(null);
    this.ui.volby(null);
    this.ui.dalej(false);
    this.zachytTeraz = false;
    this.ui.ucho(false);
    clearTimeout(this.pocCas);
    if (!x) return;
    const k = x.k;
    if (this.R.KAPITOLA !== 69) {
      if (k.typ === 'replika' && x.beat.id === 'b10') { const t = this.R.tabloPreKrok(k); if (t) this.scena.tablo(t); }
      if (k.typ === 'replika' && k.r && k.r[0] === 8613) this.ui.titulok(zvuk.hodiny(6), 0);
      if (k.typ === 'replika' && k.r && k.r[0] === 8798) zvuk.dron(false, true);
    }
    if (this.R.priKroku) this.R.priKroku(x, this);
    this.pokracuj = null;
    this.poKarte = null;
    switch (k.typ) {
      case 'titulok': this.stranka(this.htmlTitul(k)); break;
      case 'predtym': this.stranka(this.htmlPredtym(k), true); break;
      case 'co_vies': this.stranka(this.htmlCoVies(k)); break;
      case 'poznamka_hracovi':
        /* poznamky len pre nas (sk, bez en) hrac nevidi */
        if (!k.en) { this.rezim = 'prechod'; setTimeout(() => { if (this.x === x) this.dalej(); }, 0); return; }
        this.stranka(`<div class="mc-stranka"><p>${esc(k.en || '')}</p><button type="button" class="mc-btn" data-dalej>Continue</button></div>`); break;
      case 'volba_karty': this.karty(k); break;
      case 'usudok': this.usudok(k); break;
      case 'replika': case 'rozpravanie':
        this.rezim = 'text';
        this.textOd = performance.now();
        this.ui.replika(k);
        if (k.zachyt) { this.ui.ucho(true); this.pocT = 0; }
        break;
      case 'dokument': this.dokument(k); break;
      case 'pocuvanie': this.pocuvanie(k); break;
      case 'akcia': this.akcia(k); break;
      case 'ton': this.ton(k); break;
      case 'mechanika': this.mechanika(k); break;
      case 'koniec': this.koniec(); break;
      default: this.rezim = 'text'; this.ui.vlastny(esc(k.en || k.typ)); this.ui.dalej(true);
    }
    this.obnovCiele();
    this.slucka.zobud();
  }
  dalej(v) {
    this.ui.vrstva(null);
    this.ui.volby(null);
    const res = this.j.vyries(v || {});
    if (res && res.navrat) { this.navrat(res); return; }
    this.zobraz();
  }
  /* neuspech s cenou: hra povie preco a vrati hraca na kontrolny bod (jadro uz je tam) */
  navrat(res) {
    this.lokacia = '';
    const f = this.R.NAVRATY && this.R.NAVRATY[res.preco];
    const text = f ? f(res) : 'Back to the last checkpoint.';
    this.rezim = 'navrat';
    this.ui.vycisti();
    zvuk.papier(0.6);
    const d = this.ui.vrstva(`<div class="mc-stranka mc-navrat"><p class="mc-kap">Not as the book has it</p><p>${esc(text)}</p><button type="button" class="mc-btn" data-dalej>Try again</button></div>`, 'mc-kniha');
    const b = d.querySelector('[data-dalej]');
    b.addEventListener('click', () => { this.ui.vrstva(null); this.zobraz(); });
    setTimeout(() => b.focus({ preventScroll: true }), 40);
  }

  /* ── stranky knihy ── */
  stranka(html) {
    this.rezim = 'stranka';
    this.ui.vycisti();
    const d = this.ui.vrstva(html, 'mc-kniha');
    d.querySelectorAll('[data-dalej]').forEach((b) => b.addEventListener('click', () => this.dalej()));
    d.querySelectorAll('canvas[data-kresba]').forEach((c) => {
      const b = this.scena.B.get(c.dataset.kresba);
      if (!b) return;
      c.width = b.width; c.height = b.height;
      c.getContext('2d').drawImage(b, 0, 0);
    });
    const b = d.querySelector('[data-dalej]');
    if (b) setTimeout(() => b.focus({ preventScroll: true }), 40);
  }
  htmlTitul(k) {
    const [n, ...zvysok] = k.text.split('. ');
    return `<div class="mc-stranka mc-titul"><canvas data-kresba="titul:${this.data.kapitola}" class="mc-vineta" aria-hidden="true"></canvas>
      <p class="mc-kap">${esc(n)}.</p><h2>${esc(zvysok.join('. '))}</h2>
      <p class="mc-zdroj">Alexandre Dumas, <i>The Count of Monte Cristo</i>, 1844 to 1846. Every line in this chapter is the book’s own, with its line number.</p>
      <p><span class="mc-chip">${riadky(k.r)}</span></p>
      <button type="button" class="mc-btn" data-dalej>Begin</button></div>`;
  }
  htmlPredtym(k) {
    return `<div class="mc-stranka mc-predtym"><p class="mc-kap">Before</p>
      <ol class="mc-tri">${k.en.map((t, i) => `<li><canvas data-kresba="${this.data.kapitola === 69 ? 'predtym69:' : 'predtym:'}${i + 1}" aria-hidden="true"></canvas><p>${esc(t)}</p></li>`).join('')}</ol>
      <button type="button" class="mc-btn" data-dalej>Continue</button></div>`;
  }
  htmlCoVies(k) {
    return `<div class="mc-stranka mc-covies"><p class="mc-kap">What you know</p>
      <ul>${k.en.map((t) => `<li>${esc(t.en)} <span class="mc-chip">${riadky(t.r)}</span></li>`).join('')}</ul>
      <button type="button" class="mc-btn" data-dalej>Continue</button></div>`;
  }

  /* ── listy (P3) ── */
  dokument(k) {
    this.rezim = 'list';
    zvuk.papier(1);
    const CIELE = this.R.CIELE;
    const ciele = this.j.ciele().filter((c) => CIELE[c.id] && CIELE[c.id].list);
    const cieleR = new Map(ciele.map((c) => [CIELE[c.id].list, c]));
    let telo = '', popis = '', trieda = '';
    if (k.id === 'sprava_boville') { popis = 'The note from M. de Boville'; trieda = 'sprava'; }
    if (k.id === 'podrobnosti') { popis = 'The details, received the following evening'; trieda = 'sprava'; }
    if (k.id === 'ranny_utrzok') { popis = 'The paper, read in the morning'; trieda = 'ranny'; }
    if (k.id === 'list_spaleny') { popis = 'The same paper in the evening, its ink the colour of rust'; trieda = 'spaleny'; }
    if (k.id === 'list_druhy') { popis = 'Faria’s second leaf'; trieda = 'druhy'; }
    if (k.id === 'zavet') { popis = 'The two fragments together'; trieda = 'zavet'; }
    if (k.id === 'zavet') {
      const druhy = this.data.beaty.flatMap((b) => b.kroky).find((q) => q.id === 'list_druhy').riadky.map((r) => r.text.replace(/^\.\.\./, ''));
      telo = k.riadky.map((r) => {
        let h = esc(r.text);
        for (const d of druhy) { const e = esc(d); const i = h.indexOf(e); if (i >= 0) h = h.slice(0, i) + '<em>' + e + '</em>' + h.slice(i + e.length); }
        return `<p class="mc-lr">${h} <span class="mc-chip">${riadky(r.r)}</span></p>`;
      }).join('');
    } else {
      telo = k.riadky.map((r) => {
        const c = cieleR.get(r.r[0]);
        const cls = c ? ` mc-lciel${this.j.st.dennik.has(c.dennik) ? ' hotovy' : ''}` : '';
        return `<p class="mc-lr${cls}" ${c ? `data-ciel="${c.id}" tabindex="0"` : ''}>${esc(r.text)}</p>`;
      }).join('');
    }
    const r0 = k.riadky[0].r[0], r1 = k.riadky.at(-1).r[1];
    const d = this.ui.vrstva(`<div class="mc-harok mc-h-${trieda}" role="document" aria-label="${esc(popis)}">
        <p class="mc-harok-popis">${esc(popis)} <span class="mc-chip">${riadky([r0, r1])}</span></p>
        <div class="mc-harok-text">${telo}</div></div>
        <button type="button" class="mc-btn mc-odloz" data-dalej>Put the paper down</button>`, 'mc-listy');
    d.querySelectorAll('[data-ciel]').forEach((p) => {
      const f = () => { if (this.j.vsimni(p.dataset.ciel)) { p.classList.add('hotovy'); } };
      p.addEventListener('click', f);
      p.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f(); } });
    });
    d.querySelector('[data-dalej]').addEventListener('click', () => this.dalej());
    setTimeout(() => d.querySelector('[data-dalej]').focus({ preventScroll: true }), 40);
  }

  /* ── pocuvanie (P2) ── */
  pocuvanie(k) {
    this.rezim = 'pocuvanie';
    const p = POCUVANIE[k.id] || { zvuk: () => '', smer: 0, auto: 4 };
    this.poc = { k, p, hotovy: false };
    this.pocT = 0;
    this.ui.ucho(true);
    this.ui.vycisti();
    if (p.volitelne) {
      this.ui.vyzva(`${this.klav('S', 'B')} Stay and listen`);
      this.ui.dalej(true, 'Go on');
      this.ui.titulok(p.zvuk(), p.smer);
    } else {
      this.ui.vyzva(`${this.klav('S', 'B')} Listen`);
      this.pocCas = setTimeout(() => this.dokonciPocuvanie(false), p.auto * 1000);
    }
  }
  dokonciPocuvanie(pocuval) {
    const P = this.poc;
    if (!P || P.hotovy) return;
    P.hotovy = true;
    clearTimeout(this.pocCas);
    if (!P.p.volitelne) this.ui.titulok(P.p.zvuk(), P.p.smer);
    this.ui.ucho(false);
    this.ui.vyzva(null);
    setTimeout(() => { if (this.poc === P) { this.poc = null; this.dalej({ pocuval }); } }, pocuval && !P.p.volitelne ? 1400 : 900);
  }

  /* ── ton ── */
  ton(k) {
    this.rezim = 'volba';
    this.ui.vlastny(`<span class="mc-otazka">How does ${this.R.TON_KTO || 'Edmond'} say it?</span>`);
    this.ui.volby(k.moznosti.map((m) => m.en), (i) => this.vyberTon(k, i));
  }
  vyberTon(k, i) {
    const m = k.moznosti[i];
    if (!m || this.rezim !== 'volba') return;
    const g = this.R.GESTA[k.id + ':' + m.id];
    if (g) for (const [meno, h] of Object.entries(g)) {
      const a = this.scena.st.herci[meno];
      if (h.poza) this.pozaNa(meno, this.P[h.poza], 0.6);
      if ('rek' in h) a.rek = h.rek && Object.keys(h.rek).length ? h.rek : (h.rek === null ? null : a.rek);
    }
    this.dalej({ moznost: m.id });
  }
  pozaNa(meno, poza, trvanie) {
    const a = this.scena.st.herci[meno];
    const od = a.poza || poza;
    this.anim.set(meno, { druh: 'poza', od, na: poza, t: 0, trvanie: this.scena.znizeny ? 0.01 : trvanie });
  }

  /* ── kapitola 69: karty svedkov, usudok, prevlek, uder, Kniha svedkov ── */
  najdiKrok(id) { const x = this.j.kroky.find((q) => q.k.id === id); return x ? x.k : null; }
  karty(k) {
    this.rezim = 'karty';
    this.ui.vycisti();
    const kto = k.id.startsWith('W') ? 'wilmore' : 'busoni';
    const st = this.j.st;
    const zle = k.karty.filter((c) => (c.druh === 'persona' || c.druh === 'ozvena') && st.naucene.has(c.id));
    const ponuka = k.karty.filter((c) => !zle.includes(c));
    const ceruzka = zle.length >= 2 || (zle.length >= 1 && k.karty.length === 2);
    this.ui.vlastny(`${htmlPasik(this.data, this.j, k.riadok_knihy_svedkov, kto === 'busoni' ? 'l' : 'p')}<span class="mc-otazka">What does ${KTO_EN[kto]} answer?</span>`);
    this.ui.karty(ponuka.map((c) => ({
      id: c.id, text: c.text, r: c.r, kto: c.rozpravanie ? 'kniha' : kto,
      ceruzka: ceruzka && c.druh === 'spravna',
      pozn: c.napoveda_z && st.dennik.has(c.napoveda_z) ? c.dovod_en : null,
    })), (id) => this.vyberKartu(k, id, kto));
    this.ui.vyzva(`${this.klav('1 2 3', '↕ A')} choose a sentence from the book`);
  }
  vyberKartu(k, id, kto) {
    if (this.rezim !== 'karty') return;
    const c = k.karty.find((q) => q.id === id);
    if (!c) return;
    this.ui.volby(null);
    this.ui.vyzva(null);
    this.rezim = 'text';
    this.textOd = performance.now();
    if (c.druh === 'persona' || c.druh === 'ozvena') {
      /* zla karta sa nevyslovi: polozi sa do Knihy svedkov s dovodom, vyslanec sa spyta znova */
      this.j.vyries({ karta: id });
      zvuk.papier(0.5);
      const kr = c.text.split(/\s+/).length > 14 ? c.text.split(/\s+/).slice(0, 14).join(' ') + ' …' : c.text;
      this.ui.vlastny(`<span class="mc-odlozena"><span class="mc-odl-h">Laid in the Book of Witnesses, unsaid</span><s>“${esc(kr)}”</s> <span class="mc-chip">${riadky(c.r)}</span><em>${esc(c.dovod_en)}</em></span>`);
      this.ui.dalej(true, 'The envoy asks again');
      this.pokracuj = () => this.zopakujOtazku(k);
      this.panely.obnov();
      return;
    }
    /* spravna alebo strukturalna: veta z knihy zaznie */
    this.ui.replika({ typ: c.rozpravanie ? 'rozpravanie' : 'replika', kto, text: c.text, r: c.r });
    if (c.druh === 'spravna') {
      const riadok = this.data.kniha_svedkov.riadky.find((q) => q.id === k.riadok_knihy_svedkov);
      if (riadok) this.ui.toast(`Book of Witnesses: ${riadok.en}, the ${kto === 'busoni' ? 'friend' : 'enemy'}’s half`);
    }
    this.poKarte = { karta: id };
  }
  zopakujOtazku(k) {
    const q = (k.otazka || '').split('|').filter(Boolean).map((id) => this.najdiKrok(id)).find((q) => q && this.j.plati(q.ak));
    this.rezim = 'text';
    this.textOd = performance.now();
    if (q) this.ui.replika(q);
    else { this.ui.vlastny('<span class="mc-otazka">The envoy waits for another answer.</span>'); this.ui.dalej(true); }
    this.pokracuj = () => this.karty(k);
  }
  usudok(k) {
    this.rezim = 'usudok';
    this.ui.vycisti();
    const stopy = k.stopy.filter((s) => this.j.st.dennik.has(s)).map((s) => this.data.dennik.find((d) => d.id === s).en.replace(/^Clue: /, ''));
    this.ui.vlastny(`<span class="mc-otazka">${esc(k.otazka_en)}</span><span class="mc-stopy">${stopy.length ? stopy.map((t) => `<span>${esc(t)}</span>`).join('') : '<span>You noticed no clues this time. Guess, or look closer when you play again.</span>'}</span>`);
    this.ui.volby(k.moznosti_en, (i) => this.vyberUsudok(k, i));
  }
  vyberUsudok(k, i) {
    if (this.rezim !== 'usudok' || !k.moznosti_en[i]) return;
    this.ui.toast(i === k.spravne ? 'You suspect it. The book has not said it yet.' : 'The question stays open in your journal. The book will answer it.');
    this.dalej({ odpoved: i });
  }
  prevlek(vrstvy, rezim, naKoniec) {
    this.rezim = 'prevlek';
    this.ui.vycisti();
    this.ui.vlastny(rezim === 'wilmore'
      ? '<span class="mc-otazka">Ten minutes before ten. The envoy waits beyond the door, and Lord Wilmore is precise.</span>'
      : '<span class="mc-otazka">The visitor is expected at eight. Put on the abbé.</span>');
    const g = this.scena.st.herci.grof;
    this.pv = spustiPrevlek({
      el: this.ui.volbyPanel(), vrstvy, rezim, en: this.R.VRSTVY_EN || {}, zvuk, minut: 10,
      naZmenu: (v) => {
        g.vrstvy = new Set(v);
        this.pozaNa('grof', this.P.obliekanie || POZY.stoj, 0.22);
        clearTimeout(this.pvCas);
        this.pvCas = setTimeout(() => this.pozaNa('grof', this.P.stoj, 0.35), 260);
        this.slucka.zobud();
      },
      naKoniec: (vysl) => {
        const pv = this.pv; this.pv = null;
        if (pv) pv.zavri();
        this.ui.volby(null);
        this.ui.vyzva(null);
        naKoniec(vysl);
      },
    });
    this.ui.vyzva(`${this.klav('1 to ' + vrstvy.length, '↕ A')} put on or take off`);
  }
  uder() {
    this.rezim = 'uder';
    this.ui.vycisti();
    this.ui.vlastny('<span class="mc-otazka">Lord Wilmore returns as the clock strikes.</span>');
    this.ud = spustiUder({
      el: this.ui.volbyPanel(), zvuk, bezCasu: !!(this.nastavenia && this.nastavenia.bezCasu), znizeny: this.scena.znizeny,
      titulok: (t, s) => this.ui.titulok(t, s),
      naVysledok: ({ vcas, uder }) => {
        const ud = this.ud; this.ud = null;
        if (ud) ud.zavri();
        this.ui.volby(null);
        this.ui.vyzva(null);
        if (vcas && uder === 5) this.j.zapis('D09');
        if (vcas) this.ui.toast(uder === 5 ? 'At the fifth stroke, as the book says' : `On stroke ${uder}: punctual`);
        this.dalej({ vcas });
      },
    });
    if (!(this.nastavenia && this.nastavenia.bezCasu)) this.ui.vyzva(`${this.klav('E', 'A')} open the door on a stroke`);
  }
  kontrola() {
    this.rezim = 'kontrola';
    this.ui.vycisti();
    const d = this.ui.vrstva('<div class="mc-kt"></div>', 'mc-listy mc-sv-vrstva');
    this.kt = spustiKontrolu({
      koren: d.querySelector('.mc-kt'), data: this.data, j: this.j, zvuk, znizeny: this.scena.znizeny,
      naKoniec: () => { const kt = this.kt; this.kt = null; if (kt) kt.zavri(); this.dalej({}); },
    });
  }
  knihaSvedkov() {
    this.rezim = 'kniha';
    this.ui.vycisti();
    zvuk.papier(0.8);
    const d = this.ui.vrstva(`${htmlKniha(this.data, this.j, { trieda: 'mc-sv-nova' })}<p class="mc-akcie"><button type="button" class="mc-btn" data-zavri>Close the book</button></p>`, 'mc-listy mc-sv-vrstva');
    const b = d.querySelector('[data-zavri]');
    b.addEventListener('click', () => { this.ui.vrstva(null); this.hotovaAkcia(); });
    setTimeout(() => b.focus({ preventScroll: true }), 40);
  }

  /* ── M19 ── */
  mechanika(k) {
    if (k.id === 'M54_prevlek') { this.prevlek(k.vrstvy, 'wilmore', (v) => this.dalej(v)); return; }
    if (k.id === 'c08_uder') { this.uder(); return; }
    if (k.id === 'M54_kontrola') { this.kontrola(); return; }
    if (k.id !== 'M19') { this.dalej({}); return; }
    this.rezim = 'm19';
    this.ui.vycisti();
    this.ui.vrstva(null);
    this.ui.vrstvaEl.className = 'mc-vrstva mc-aktivna mc-m19';
    this.ui.vrstvaEl.closest('.mc').classList.add('mc-m19-rezim', 'mc-vrstva-zap');
    this.m19 = spustiM19({
      koren: this.ui.vrstvaEl, data: this.data, krok: k, dennik: this.j.st.dennik, zvuk,
      naKontrolu: () => this.j.vyries({ ok: false }),
      naKoniec: () => { this.m19.zavri(); this.m19 = null; this.dalej({ ok: true }); },
      oznam: (t) => this.ui.toast(t),
    });
    this.ui.vyzva(`${this.klav('↑↓', '↕')} line ${this.klav('←→', 'LB RB')} fragment ${this.klav('E', 'A')} place ${this.klav('F', 'LT')} what you heard`);
  }

  /* ── ukony (P8, chodza) ── */
  akcia(k) {
    const def = this.R.AKCIE[k.id];
    this.rezim = 'akcia';
    this.ui.vycisti();
    if (!def) { this.dalej({ ok: true }); return; }
    const st = this.scena.st;
    this.akc = { k, def, p: 0, drzane: 0, hotove: false, t: 0 };
    if (def.druh === 'prevlek') { this.prevlek(k.vrstvy, def.rezim, () => { this.rezim = 'akcia'; this.hotovaAkcia(); }); return; }
    if (def.druh === 'kniha') { this.knihaSvedkov(); return; }
    if (def.druh === 'cesta') {
      const kto = def.kto || 'edmond';
      if (!this.cesta || this.cesta.meno !== kto || def.cesta !== this.cesta.menoCesty) this.naCestu(kto, def.cesta, 0);
      this.cesta.menoCesty = def.cesta;
      if (def.nasleduje) this.cesta.nasleduje = def.nasleduje;
      if (kto !== 'edmond') this.cesta.stojPoza = this.P.stojRuky || POZY.stoj;
      this.polozNaCestu();
      st.kam.sleduj = kto;
      const body = this.R.CESTY[def.cesta];
      const vpravo = body.at(-1).x > body[0].x;
      this.ui.vyzva(`${this.klav(vpravo ? 'D' : 'A', vpravo ? '→' : '←')} ${esc(def.vyzva || (vpravo ? 'Crawl to Faria’s cell' : 'Back to your cell'))}`);
    } else if (def.druh === 'drzat') {
      this.ui.vyzva(`${this.klav('E', 'A')} ${esc(def.vyzva)}<span class="mc-postup" aria-hidden="true"></span>`);
      this.ui.postup(0);
      if (def.detail) this.scena.detail = { druh: def.detail, p: 0, t: 0 };
      if (def.pomoc) {
        Object.assign(st.herci.faria, { vid: true, x: SVET.otvorE[1] + 8, y: SVET.podlaha, smer: -1, poza: vlecenie(0), rek: null });
        Object.assign(st.herci.edmond, { vid: true, x: 452, y: SVET.podlaha, smer: 1, poza: Object.assign({}, POZY.kolena, { ramZ: [1.2, 0.3], ramP: [1.1, 0.4] }) });
      }
      if (def.objatie) { st.herci.faria.rek = null; this.pozaNa('faria', POZY.sedNatiahnuty, 0.9); }
      if (def.cakanie) { st.herci.edmond.poza = POZY.sedDlane; }
    } else if (def.druh === 'nejst') {
      Object.assign(st.herci.edmond, { x: 150, poza: POZY.stoj, smer: 1 });
      this.ui.vyzva(`${this.klav('D', '→')} Go to Faria ${this.klav('E', 'A')} ${'hold to stay'}<span class="mc-postup" aria-hidden="true"></span>`);
      this.ui.postup(0);
    } else if (def.druh === 'stlacit') {
      this.ui.vyzva(`${this.klav('E', 'A')} ${esc(def.vyzva)}`);
    }
  }
  klav(k, pad) {
    const g = this.vstupDruh === 'pad' ? pad : this.vstupDruh === 'dotyk' ? null : k;
    return g ? `<kbd>${esc(g)}</kbd>` : '';
  }

  async hotovaAkcia(v) {
    if (!this.akc || this.akc.hotove) return;
    this.akc.hotove = true;
    const k = this.akc.k, st = this.scena.st, sc = this.scena;
    this.ui.vyzva(null);
    if (k.id === 'a_plazit_rano') {
      this.ui.titulok(zvuk.kamen(), 0.2);
      sc.tween(st, 'kamen', 1, 0.9);
      await cakaj(500);
      this.cesta = null;
      Object.assign(st.herci.edmond, { x: 952, y: SVET.podlaha, smer: 1, poza: POZY.kolena });
      st.kam.sleduj = null; st.kam.ciel = 760;
      await cakaj(350);
      await this.chod('edmond', 1070, POZY.kolena);
    } else if (k.id === 'a_plazit_spat') {
      this.cesta = null;
    } else if (k.id === 'a_sadnut') {
      await sc.clona(0.35);
      Object.assign(st.herci.faria, { vid: true, x: 112, y: SVET.podlaha, smer: 1, poza: POZY.sedPapier, rek: null });
      Object.assign(st.herci.edmond, { vid: true, x: 250, y: SVET.podlaha, smer: -1, poza: POZY.sedStolicka });
      sc.odclon(0.5);
    } else if (k.id === 'a_nejst') {
      if (v === 'isiel') {
        await cakaj(500);
        await this.chod('edmond', 150, POZY.stoj);
      }
      st.herci.edmond.x = 118;
      this.pozaNa('edmond', POZY.sedDlane, 0.7);
      await cakaj(700);
    } else if (k.id === 'a_plamen') {
      if (sc.detail) sc.detail.zhasnute = true;
      await cakaj(600);
    } else if (k.id === 'a_zalozka') {
      await cakaj(300);
    }
    if (this.R.poAkcii) {
      if (this.akc && this.akc.def.druh === 'cesta') this.cesta = null;
      await this.R.poAkcii(k.id, this, v);
    }
    if (!this.j || this.x.k !== k) return;
    if (k.id !== 'a_plamen') sc.detail = null;
    this.slucka.zobud();
    this.dalej({ ok: true });
  }

  /* automaticka chodza postavy na x; na konci poza */
  chod(meno, x, pozaNaKonci) {
    return new Promise((res) => {
      const a = this.scena.st.herci[meno];
      a.smer = x > a.x ? 1 : -1;
      this.anim.set(meno, { druh: 'chod', x, faza: 0, konec: pozaNaKonci, res });
      this.slucka.zobud();
    });
  }

  /* ── vstupy z vstup.js ── */
  vstupAkcia(a, d) {
    if (a === 'zobud') return;
    if (this.m19 && this.rezim === 'm19') { if (this.m19.akcia(a)) return; }
    const r = this.rezim;
    if (a === 'volba' && r === 'volba') { this.vyberTon(this.x.k, d - 1); return; }
    if ((a === 'hore' || a === 'dole') && ['volba', 'karty', 'usudok', 'prevlek', 'uder'].includes(r)) { this.ui.focusVolba(a === 'hore' ? -1 : 1); return; }
    if (a === 'volba' && (r === 'karty' || r === 'usudok')) { const b = this.ui.volbyEl.querySelectorAll('button')[d - 1]; if (b) b.click(); return; }
    if (a === 'volba' && r === 'prevlek' && this.pv) { this.pv.volba(d); return; }
    if (r === 'uder' && this.ud) {
      if (a === 'volba') { this.ud.volba(d); return; }
      if (a === 'interakcia' || (a === 'klik' && d)) { this.ud.stlac(); return; }
    }
    if (r === 'navrat' && (a === 'klik' || a === 'interakcia')) { this.ui.vrstva(null); this.zobraz(); return; }
    if (a === 'interakcia' || a === 'klik') {
      if (r === 'text' && performance.now() - this.textOd > 220) {
        if (a === 'klik' && d && this.klikNaZachyt) { this.klikNaZachyt = false; return; }
        if (this.pokracuj) { const f = this.pokracuj; this.pokracuj = null; f(); return; }
        this.dalej(Object.assign({ zachytene: this.zachytTeraz }, this.poKarte || {}));
        return;
      }
      if (r === 'stranka' && a === 'klik') { this.dalej(); return; }
      if (r === 'pocuvanie' && this.poc && this.poc.p.volitelne && a === 'interakcia') { this.dokonciPocuvanie(false); return; }
      if (r === 'akcia' && this.akc) {
        const def = this.akc.def;
        if (def.druh === 'stlacit') { this.hotovaAkcia(); return; }
        if (def.druh === 'cesta') {
          if (a === 'interakcia' && this.akc.naKonci) { this.hotovaAkcia(); return; }
          if (a === 'klik' && d) {
            const w = this.scena.zObrazovky(d.x, d.y);
            const c = this.cesta;
            if (c) { let best = 0, bd = 1e9; c.body.forEach((b, i) => { const dd = Math.abs(b.x - w.x); if (dd < bd) { bd = dd; best = i; } }); c.ciel = c.dl[best]; if (this.akc.naKonci && best === c.body.length - 1) this.hotovaAkcia(); }
          }
          return;
        }
        if (def.druh === 'nejst' && a === 'klik' && d) { this.nejstCiel = this.scena.zObrazovky(d.x, d.y).x; return; }
      }
      return;
    }
    if (a === 'pocuvanie:start') {
      if (r === 'text' && this.x && this.x.k.zachyt) this.pocT = 0;
      this.ui.drziUcho(true);
    }
    if (a === 'pocuvanie:stop') this.ui.drziUcho(false);
    if (a === 'pozornost:start') { this.pozT = 0; this.pozOd = 0; this.ui.drziOko(true); this.obnovCiele(); if (r === 'list') this.ui.vrstvaEl.classList.add('mc-pozornost'); }
    if (a === 'pozornost:stop') { this.ui.drziOko(false); this.obnovCiele(); this.ui.vrstvaEl.classList.remove('mc-pozornost'); }
    if (a === 'dlhy-dotyk' && r !== 'akcia') { this.vstup.drzi.pocuvanie = true; this.ui.drziUcho(true); }
    if (a === 'dlhy-dotyk:stop') { this.vstup.drzi.pocuvanie = false; this.ui.drziUcho(false); }
    this.slucka.zobud();
  }
  zachytKlik() {
    if (this.rezim === 'text' && this.x && this.x.k.zachyt && !this.zachytTeraz) { this.zachytTeraz = true; this.ui.zachytene(); this.ui.toast('Faria’s words, in your journal'); }
  }

  /* ── ciele Pozornosti ── */
  otvoreneCiele() {
    if (!this.j) return [];
    const C = this.R.CIELE, x = this.j.aktualny();
    return this.j.ciele().filter((c) => {
      const d = C[c.id];
      if (!d || this.j.st.dennik.has(c.dennik)) return false;
      /* okno len pocas urcitych krokov (cervenanie, ruka pred ocami) */
      if (d.kroky && !(x && d.kroky.includes(x.k.id))) return false;
      return true;
    });
  }
  obnovCiele() {
    const otv = this.otvoreneCiele();
    this.ui.oko(otv.length > 0);
    const drzi = this.vstup.drzi.pozornost;
    if (!drzi || !this.scena.maKameru() || this.rezim === 'list') { this.ui.ciele([]); return; }
    const C = this.R.CIELE, st = this.scena.st;
    this.ui.ciele(otv.filter((c) => !C[c.id].list).map((c) => {
      const d = C[c.id];
      let wx = d.x, wy = d.y;
      if (d.herec) { const hl = hlavaHerca(st.herci[d.herec], d.herec); wx = hl.x; wy = hl.y; }
      const p = this.scena.naObrazovku(wx, wy);
      return { id: c.id, en: d.en, x: p.x, y: p.y, nad: d.nad };
    }), (id) => { if (this.j.vsimni(id)) this.obnovCiele(); });
  }

  /* ── snimka: vsetko, co sa hybe ── */
  update(dt, t) {
    let hybe = false;
    const st = this.scena.st, vs = this.vstup;
    vs.citajPad();
    /* Pozornost: drzanie postupne zapise otvorene ciele */
    if (vs.drzi.pozornost && this.rezim !== 'm19') {
      const otv = this.otvoreneCiele();
      if (otv.length) {
        const ted = performance.now();
        if (!this.pozOd) this.pozOd = ted;
        this.pozT = (ted - this.pozOd) / 1000;
        hybe = true;
        if (this.pozT > 0.8) {
          this.pozOd = ted;
          const c = otv[0];
          if (this.j.vsimni(c.id)) {
            const el = this.ui.vrstvaEl.querySelector(`[data-ciel="${c.id}"]`);
            if (el) el.classList.add('hotovy');
          }
          this.obnovCiele();
        }
      }
    }
    /* Pocuvanie: zachytena veta, okno pocuvania */
    if (!vs.drzi.pocuvanie) this.pocOd = 0;
    if (vs.drzi.pocuvanie) {
      const ted = performance.now();
      if (!this.pocOd) this.pocOd = ted;
      const drzane = (ted - this.pocOd) / 1000;
      if (this.rezim === 'text' && this.x && this.x.k.zachyt && !this.zachytTeraz) {
        hybe = true;
        if (drzane > 0.5) this.zachytKlik();
      }
      if (this.rezim === 'pocuvanie' && this.poc && !this.poc.hotovy) {
        hybe = true;
        if (drzane > (this.poc.p.volitelne ? 1 : 0.6)) this.dokonciPocuvanie(true);
      }
    }
    /* ukony */
    const A = this.akc;
    if (A && !A.hotove) {
      const def = A.def;
      if (def.druh === 'cesta' && this.cesta) {
        const c = this.cesta;
        const smerCesty = Math.sign(c.body.at(-1).x - c.body[0].x);
        let du = 0;
        const os = vs.os();
        if (os) { du = os * smerCesty; c.ciel = null; } else if (c.ciel != null) { const d = c.ciel - c.u; du = Math.abs(d) < 1 ? 0 : Math.sign(d); if (!du) c.ciel = null; }
        const hc = this.scena.st.herci[c.meno];
        const plaz = hc.poza && hc.poza.trup > 1;
        const v = plaz ? 34 : 58;
        c.hybe = !!du;
        if (du) {
          c.posledny = du > 0 ? 1 : -1;
          c.u = Math.max(0, Math.min(c.dl.at(-1), c.u + du * v * dt));
          c.faza += dt * (plaz ? 4.2 : 7.4) * Math.abs(du);
          hybe = true;
          if (plaz && Math.floor(c.faza / Math.PI) !== c.krokZv) { c.krokZv = Math.floor(c.faza / Math.PI); }
        }
        this.polozNaCestu();
        if (def.koniecX != null && st.herci.edmond.x < def.koniecX) this.hotovaAkcia();
        if (def.samoKoniec && c.u >= c.dl.at(-1) - 0.5) this.hotovaAkcia();
        if (def.cesta === 'spat') {
          if (c.u > c.dl[2] - 4 && !c.zavrete) {
            c.zavrete = true;
            this.ui.titulok(zvuk.kamen(), 0.6);
            this.scena.tween(st, 'kamen', 0, 1.1);
            this.scena.tween(st, 'rohoz', 1, 1.6);
            this.scena.svetlo({ tma: 0.5 }, 1.6);
          }
        }
        if (def.koniec && c.u >= c.dl.at(-1) - 0.5 && !A.naKonci) {
          A.naKonci = true;
          this.ui.vyzva(`${this.klav('E', 'A')} ${esc(def.vyzvaKoniec)}`);
        }
      } else if (def.druh === 'drzat') {
        const drzi = vs.drzi.ruky;
        const p0 = A.p;
        if (drzi || A.auto) A.p = Math.min(1, A.p + dt / def.trvanie);
        else if (def.vratit) A.p = Math.max(0, A.p - dt / def.vratit);
        if (def.auto && !drzi && A.p > 0.12) A.auto = true;
        if (A.p !== p0) { hybe = true; this.ui.postup(A.p); if (def.detail === 'harok' && Math.random() < dt * 3) zvuk.papier(0.3); }
        if (this.scena.detail) { this.scena.detail.p = A.p; this.scena.detail.t = t; hybe = true; }
        if (def.detail === 'plamen' && A.p > 0 && !A.zvuk) { A.zvuk = true; this.ui.titulok(zvuk.plamen(4), 0); zvuk.praskanie(4); }
        if (def.cakanie) {
          const f = A.p * 3;
          const sv = st.svetlo;
          sv.E1 = Math.max(0, 0.55 * (1 - f));
          sv.E2 = Math.max(0, 0.5 * (1 - Math.abs(f - 1)));
          sv.E3 = Math.max(0, 0.48 * (1 - Math.abs(f - 2)));
          sv.Ev = Math.max(0, 0.55 * (f - 2));
          sv.tint = 0.05 + 0.4 * Math.max(0, f - 1.8) / 1.2;
        }
        if (def.pomoc) {
          const f = st.herci.faria;
          f.x = SVET.otvorE[1] + 8 - A.p * 62;
          if (A.p !== p0) { A.faza = (A.faza || 0) + dt * 3; f.poza = vlecenie(A.faza); if (Math.random() < dt * 0.8) zvuk.vlecenie(0.3); }
        }
        if (def.objatie) {
          const e = st.herci.edmond;
          e.poza = mix(POZY.sedStolicka, POZY.objatie, A.p);
          e.x = 250 - A.p * 44;
        }
        if (def.efekt && this.R.efekt && A.p !== p0) this.R.efekt(def.efekt, A.p, this);
        if (A.p >= 1) {
          A.drzane += dt; hybe = true;
          if (!def.udrzat || A.drzane >= def.udrzat) this.hotovaAkcia();
        } else A.drzane = 0;
      } else if (def.druh === 'nejst') {
        const e = st.herci.edmond;
        let os = vs.os();
        if (!os && this.nejstCiel != null) { const d = this.nejstCiel - e.x; os = Math.abs(d) < 2 ? 0 : Math.sign(d); if (!os) this.nejstCiel = null; }
        if (os) {
          e.x = Math.max(60, Math.min(480, e.x + os * 50 * dt));
          e.smer = os > 0 ? 1 : -1;
          A.faza = (A.faza || 0) + dt * 7;
          e.poza = chodza(A.faza);
          hybe = true;
          if (e.x > 462) { this.nejstCiel = null; e.poza = POZY.stoj; this.hotovaAkcia('isiel'); }
        } else if (e.poza !== POZY.stoj && !vs.drzi.ruky) e.poza = POZY.stoj;
        if (vs.drzi.ruky) { A.p = Math.min(1, A.p + dt / 1.4); this.ui.postup(A.p); hybe = true; if (A.p >= 1) this.hotovaAkcia('cakal'); }
        else if (A.p > 0) { A.p = Math.max(0, A.p - dt); this.ui.postup(A.p); hybe = true; }
      }
    }
    /* animacie postav */
    for (const [meno, an] of this.anim) {
      const a = st.herci[meno];
      hybe = true;
      if (an.druh === 'poza') {
        an.t += dt;
        const q = Math.min(1, an.t / an.trvanie);
        a.poza = mix(an.od, an.na, q * q * (3 - 2 * q));
        if (q >= 1) { a.poza = an.na; this.anim.delete(meno); }
      } else if (an.druh === 'cesta') {
        an.u = Math.min(an.dl.at(-1), an.u + 52 * dt);
        an.faza += dt * 7.4;
        let i = 1;
        while (i < an.body.length - 1 && an.dl[i] < an.u) i++;
        const b0 = an.body[i - 1], b1 = an.body[i];
        const q = (an.u - an.dl[i - 1]) / Math.max(0.001, an.dl[i] - an.dl[i - 1]);
        a.x = b0.x + (b1.x - b0.x) * q; a.y = b0.y + (b1.y - b0.y) * q;
        a.smer = Math.sign(b1.x - b0.x) || a.smer;
        a.poza = chodza(an.faza);
        if (an.u >= an.dl.at(-1)) { a.poza = POZY.stoj; this.anim.delete(meno); an.res(); }
      } else if (an.druh === 'chod') {
        const d = an.x - a.x;
        const v = 52 * dt;
        an.faza += dt * 7.4;
        if (Math.abs(d) <= v) { a.x = an.x; a.poza = an.konec || POZY.stoj; this.anim.delete(meno); an.res(); }
        else { a.x += Math.sign(d) * v; a.smer = Math.sign(d); a.poza = chodza(an.faza, meno === 'faria'); }
      }
    }
    if (vs.drzi.pozornost && this.scena.maKameru() && hybe) this.obnovCiele();
    return hybe;
  }

  /* ── koniec kapitoly ── */
  koniec() {
    if (this.R.KAPITOLA === 69) { this.koniec69(); return; }
    this.rezim = 'koniec';
    const sc = this.scena;
    this.ui.vrstvaEl.closest('.mc').classList.add('mc-titul-rezim');
    sc.st.clona = 1;
    sc.st.kulisa = 'mapa';
    sc.st.mapaCesta = 0;
    sc.detail = null;
    sc.odclon(0.9);
    sc.tween(sc.st, 'mapaCesta', 1, 5.5);
    zvuk.dron(false);
    this.opis('A map of the Mediterranean, from Marseilles and the Château d’If to the small island of Monte Cristo. A dotted line in red ink draws itself from the prison to the island.');
    this.j.vyries({});
    this.panely.obnov();
    const d = this.ui.vrstva(`<div class="mc-stranka mc-koniec"><p class="mc-kap">End of chapter 18</p><h2>The Treasure</h2>
      <p>The whole chapter is now open in your journal, as Dumas wrote it.</p>
      <p class="mc-akcie"><button type="button" class="mc-btn" data-kniha>Read chapter 18</button><button type="button" class="mc-btn mc-btn-tichy" data-znova>Play it again</button><button type="button" class="mc-btn mc-btn-tichy" data-titul>Title page</button></p></div>`, 'mc-kniha mc-koniec-vrstva');
    d.querySelector('[data-kniha]').addEventListener('click', () => this.panely.dennik('kniha'));
    d.querySelector('[data-znova]').addEventListener('click', () => this.naZnova());
    d.querySelector('[data-titul]').addEventListener('click', () => this.naTitul());
    setTimeout(() => d.querySelector('[data-kniha]').focus({ preventScroll: true }), 60);
    this.ui.vycisti();
  }

  /* Koniec kapitoly 69: Villefort spi, lampa zhasne, ostane len modry atrament. */
  koniec69() {
    this.rezim = 'koniec';
    const sc = this.scena;
    this.ui.vrstvaEl.closest('.mc').classList.add('mc-titul-rezim');
    sc.st.kulisa = 'villefort';
    sc.detail = null;
    sc.tween(sc.st, 'vlampa', 0, sc.znizeny ? 0 : 4.5);
    zvuk.dron(false);
    this.opis('Night in the house of M. de Villefort. The lamp goes out and only the blue ink is left. He sleeps.');
    this.j.vyries({});
    this.panely.obnov();
    const d = this.ui.vrstva(`<div class="mc-stranka mc-koniec"><p class="mc-kap">End of chapter 69</p><h2>The Inquiry</h2>
      <p>The envoy was Villefort himself, and for the first time since the dinner at Auteuil he sleeps. Two witnesses, one quiet answer. The whole chapter is now open in your journal.</p>
      <p class="mc-akcie"><button type="button" class="mc-btn" data-kniha>Read chapter 69</button><button type="button" class="mc-btn mc-btn-tichy" data-svedkovia>Book of Witnesses</button><button type="button" class="mc-btn mc-btn-tichy" data-znova>Play it again</button><button type="button" class="mc-btn mc-btn-tichy" data-titul>Title page</button></p></div>`, 'mc-kniha mc-koniec-vrstva');
    d.querySelector('[data-kniha]').addEventListener('click', () => this.panely.dennik('kniha'));
    d.querySelector('[data-svedkovia]').addEventListener('click', () => this.panely.dennik('faria'));
    d.querySelector('[data-znova]').addEventListener('click', () => this.naZnova());
    d.querySelector('[data-titul]').addEventListener('click', () => this.naTitul());
    setTimeout(() => d.querySelector('[data-kniha]').focus({ preventScroll: true }), 60);
    this.ui.vycisti();
  }

  /* kvapky vody v stene: zriedka, nepravidelne, len v celach */
  kvapky() {
    clearTimeout(this.kvCas);
    const dalsia = () => {
      this.kvCas = setTimeout(() => {
        if (!document.hidden && this.scena.st.kulisa === 'svet') zvuk.kvapka();
        dalsia();
      }, 7000 + Math.random() * 9000);
    };
    dalsia();
  }
  zastav() {
    clearTimeout(this.kvCas); clearTimeout(this.pocCas); clearTimeout(this.pvCas);
    if (this.m19) { this.m19.zavri(); this.m19 = null; }
    for (const m of ['pv', 'ud', 'kt']) if (this[m]) { this[m].zavri(); this[m] = null; }
    this.ui.volby(null);
    this.ui.vrstva(null); this.akc = null; this.anim.clear(); this.j = null;
  }
}
export { formatuj };
