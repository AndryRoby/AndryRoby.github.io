// TO: NULL: log, písací stroj, dešifrovanie, prietokové čiary a rámy zo znakov (SPEC 3.4, 4.1, 4.2).
// Kroky v termináli sú zámerne schodovité; plynulý je len posun logu (pružina smooth).

import { track, PRESETS } from './pohyb.js';
import { riadokPodlaId, textRiadku, PREDPONA } from './pribeh.mjs';
import { portret } from './ascii.mjs';

export const SIFRA_ZNAKY = '▒░▓█╤│┼═║╪┤├▌▐▀▄';
export const RYCHLOST = { gc: 14, keeper: 20, letter: 26, sys: 8, you: 14, card: 20, mended: 12, pre: 0 };
export const CITANIE = (znaky) => 2500 + 50 * znaky;
const MAX_RIADKOV = 60;
const MAX_TRVANIE = 900;

// ------------------------------------------------------------ čisté pomocníky (testovateľné)

/** Horný riadok rámu: ┌─[ LOG ]────┐ na presne n znakov. */
export function ramHore(nazov, n) {
  const hl = nazov ? `┌─[ ${nazov} ]` : '┌';
  return hl + '─'.repeat(Math.max(0, n - hl.length - 1)) + '┐';
}
export function ramDole(n, nazov = '') {
  if (!nazov || n < nazov.length + 8) return '└' + '─'.repeat(Math.max(0, n - 2)) + '┘';
  const hl = `└─[ ${nazov} ]`;
  return hl + '─'.repeat(Math.max(0, n - hl.length - 1)) + '┘';
}
export function sekcia(nazov, n) {
  const hl = `├─[ ${nazov} ]`;
  return hl + '─'.repeat(Math.max(0, n - hl.length - 1)) + '┤';
}

/** Lišta pozornosti: 8 buniek ▓ ▒ ░ a percento (stav nikdy len farbou). */
export function listaPozornosti(pct, n = 8) {
  const p = Math.max(0, Math.min(100, pct));
  const plne = Math.floor((p / 100) * n);
  const pol = (p / 100) * n - plne >= 0.5 && plne < n ? 1 : 0;
  return '▓'.repeat(plne) + '▒'.repeat(pol) + '░'.repeat(n - plne - pol);
}

/**
 * Text lišty attention alebo trust tak, aby sa riadok aj s tlačidlom zmestil do šírky RAIN bez pretečenia
 * (kolo oprav 2). znakov = šírka obsahu RAIN v znakoch, tlacidlo = znaky tlačidla. Rezerva 3 znaky:
 * vnútorný okraj tlačidla 8 px a medzera 12 px. Skracuje sa: celý text, bez slova, len percento.
 */
export function textPozornosti(nazov, pct, znakov, tlacidlo) {
  const p = Math.max(0, Math.min(100, pct));
  const bar = listaPozornosti(p);
  const cislo = `${Math.floor(p)}%`;
  const volne = znakov - tlacidlo - 3;
  for (const t of [`${nazov} ${bar} ${cislo}`, `${bar} ${cislo}`]) if (t.length <= volne) return t;
  return cislo;
}

/** Zámok brány [▓▓▓▒░░░░░░]. */
export function zamok(podiel, n = 10) {
  return '[' + listaPozornosti(podiel * 100, n) + ']';
}

/**
 * Prietoková čiara: 11 znakov ─ a šípka → k tempu, pakety · (1 až 24 kusov) alebo • (25+), 1 až 4 pakety podľa míľnika.
 * Bez kusov nie je čo ukázať (vizuálne kolo 3: holá čiara pod HOOK ×0 nič neznamenala), preto prázdny text (CSS ju skryje).
 */
export function tokText(faza, pocet, milniky, dlzka = 12) {
  if (pocet <= 0) return '';
  const n = dlzka - 1;
  const pakety = Math.min(4, 1 + milniky);
  const znak = pocet >= 25 ? '•' : '·';
  const r = new Array(n).fill('─');
  for (let i = 0; i < pakety; i++) {
    const pos = Math.floor(faza + (i * n) / pakety) % n;
    r[(pos + n) % n] = znak;
  }
  return r.join('') + '→';
}
export const rychlostToku = (tempo) => Math.max(0.5, Math.min(6, Math.log10(tempo + 1)));

/** Šifrovaný text rovnakej dĺžky (medzery ostanú). */
export function zasifruj(text, seed = 1) {
  let x = seed >>> 0 || 1;
  let o = '';
  for (const c of text) {
    if (c === ' ') { o += ' '; continue; }
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    o += SIFRA_ZNAKY[(x >>> 16) % SIFRA_ZNAKY.length];
  }
  return o;
}

/** Stav dešifrovania v čase dt: ustálené znaky zľava 18 ms na znak, zvyšok náhodný (každých 40 ms), spolu najviac 600 ms. */
export function desifrujText(text, dt, rnd = Math.random, maxMs = 600) {
  const n = text.length;
  const naZnak = n > 0 ? Math.min(18, maxMs / n) : 18;
  const hotove = Math.floor(dt / naZnak);
  if (hotove >= n) return text;
  let o = text.slice(0, hotove);
  for (let i = hotove; i < n; i++) o += text[i] === ' ' ? ' ' : SIFRA_ZNAKY[Math.floor(rnd() * SIFRA_ZNAKY.length)];
  return o;
}

/** Zalomenie po slovách (test 18: každý hlas najviac 2 riadky po 38 znakov). */
export function zalomRiadky(text, w = 38) {
  const out = [];
  let r = '';
  for (const s of text.split(' ')) {
    if (!r) r = s;
    else if (r.length + 1 + s.length <= w) r += ' ' + s;
    else { out.push(r); r = s; }
    while (r.length > w) { out.push(r.slice(0, w)); r = r.slice(w); }
  }
  if (r) out.push(r);
  return out;
}

// ------------------------------------------------------------ terminál (DOM)

export class Terminal {
  constructor(el, o = {}) {
    this.el = el;
    this.doc = o.doc || document;
    this.reduced = !!o.reduced;
    this.zvuk = o.zvuk || null;
    this.stav = o.stav;
    this.fronta = [];
    this.aktual = null;
    this.pauza = false;
    this.poslKoniec = -1e9;
    this.poslStart = -1e9;
    this.poslCitanie = 0;
    this.posun = track(0, PRESETS.smooth);
    this.sifry = new Map();
    // pás hlasu na telefóne má vlastnú frontu: nový hlas smie prepísať predchádzajúci najskôr po CITANIE(dĺžka)
    // od jeho dopísania (SPEC 4.2, platí aj bez zníženého pohybu); log medzitým píše ďalej
    this.pasFronta = [];
    this.pas = null;
    this.onRiadok = null;
    this.glitchy = [];
  }

  /** Text riadku logu podľa aktuálneho stavu (KEEPER sa číta podľa DECODER). */
  text(z) {
    if (z.id) {
      const r = riadokPodlaId(z.id);
      if (!r) return { h: 'sys', t: '' };
      return { h: r.h, t: textRiadku(r, this.stav()), id: z.id };
    }
    if (z.h === 'pre' && z.t === undefined) return { h: 'pre', t: portret(z.seed || 1).join('\n'), seed: z.seed };
    return { h: z.h, t: z.t, seed: z.seed };
  }

  _riadokEl(h, predpona) {
    const d = this.doc.createElement('div');
    d.className = 'r r-' + h;
    if (predpona) {
      const p = this.doc.createElement('span');
      p.className = 'p';
      p.textContent = predpona + ' ';
      d.appendChild(p);
    }
    const t = this.doc.createElement('span');
    t.className = 't';
    d.appendChild(t);
    return { d, t };
  }

  _vloz(d, teraz) {
    this.el.appendChild(d);
    while (this.el.children.length > MAX_RIADKOV) this.el.children[0].remove();
    if (!this.reduced) {
      const h = d.offsetHeight || 20;
      this.posun.jump(this.posun.at(teraz / 1000) + h).to(teraz / 1000, 0);
    }
  }

  /** Pridá riadok do fronty písacieho stroja. z = záznam logu ({id} alebo {h, t}). */
  pridaj(z, o = {}) {
    this.fronta.push({ z, o });
  }

  /** Okamžitý riadok (odpoveď príkazu, obnova logu). */
  hned(z, teraz = 0, animuj = true) {
    const { h, t, seed } = this.text(z);
    const { d, t: tel } = this._riadokEl(h === 'pre' ? 'letter' : h, PREDPONA[h]);
    if (h === 'pre') {
      const pre = this.doc.createElement('span');
      pre.className = 'portret';
      pre.textContent = t;
      d.appendChild(pre);
      void seed;
    } else tel.textContent = t;
    if (z.id) d.dataset.id = z.id;
    this._vloz(d, animuj ? teraz : 0);
    this._sr(h, t);
    return d;
  }

  _sr(h, t) {
    if (!this.sr || h === 'pre' || h === 'none') return;
    const p = this.doc.createElement('p');
    p.textContent = (PREDPONA[h] ? PREDPONA[h] + ' ' : '') + t;
    this.sr.appendChild(p);
    while (this.sr.children.length > 6) this.sr.children[0].remove();
  }

  /** Posun, písací stroj a dešifrovanie; volá sa z hlavnej slučky. */
  tik(teraz) {
    // posun logu
    if (!this.reduced) {
      const v = this.posun.at(teraz / 1000);
      const s = this.el.style;
      const tr = Math.abs(v) < 0.2 ? 'none' : `translateY(${v.toFixed(1)}px)`;
      if (s && s.setProperty && this._tr !== tr) { this._tr = tr; s.setProperty('transform', tr); }
      if (this.posun.settled(teraz / 1000)) this.posun.compact(teraz / 1000);
    }
    // písací stroj
    const a = this.aktual;
    if (a) {
      const n = this.reduced ? a.full.length : Math.min(a.full.length, Math.floor((teraz - a.t0) / a.ms));
      if (n !== a.n) {
        if (this.zvuk && !this.reduced && a.h !== 'keeper') for (let i = a.n; i < n; i += 2) this.zvuk.pis(a.h === 'sys');
        a.n = n;
        a.el.textContent = a.full.slice(0, n) + (n < a.full.length ? '█' : '');
      }
      if (n >= a.full.length) {
        a.el.textContent = a.full;
        this.aktual = null;
        this.poslKoniec = teraz;
        this.poslH = a.h;
        this._sr(a.h, a.full);
        if (this.onRiadok) this.onRiadok(a.z, teraz);
      }
    }
    if (!this.aktual && !this.pauza && this.fronta.length) {
      const hlas = (h) => h === 'gc' || h === 'keeper';
      const dalsi = this.fronta[0];
      const { h } = this.text(dalsi.z);
      // po systémovom riadku kratšia pauza 120 ms (boot aj s kurzorom 530 ms ostane do 2,4 s, SPEC 4.1)
      const cakaj = this.reduced && hlas(h) ? Math.max(this.poslStart + this.poslCitanie, this.poslKoniec) : this.poslKoniec + (this.poslH === 'sys' ? 120 : 260);
      if (teraz >= cakaj) {
        this.fronta.shift();
        this._zacni(dalsi, teraz);
      }
    }
    this._pasTik(teraz);
    // dešifrovanie (krok 40 ms)
    for (const [el, d] of this.sifry) {
      if (teraz - d.krok < 40 && teraz - d.t0 < d.max) continue;
      d.krok = teraz;
      const txt = this.reduced ? d.text : desifrujText(d.text, teraz - d.t0, Math.random, d.max);
      el.textContent = txt;
      if (txt === d.text) this.sifry.delete(el);
    }
    // glitch v logu: po 80 ms vrátiť znaky
    for (let i = this.glitchy.length - 1; i >= 0; i--) {
      const g = this.glitchy[i];
      if (teraz >= g.do) { if (g.el.textContent === g.zly) g.el.textContent = g.povodny; this.glitchy.splice(i, 1); }
    }
  }

  _zacni(polozka, teraz) {
    const { z, o } = polozka;
    const { h, t } = this.text(z);
    if (h === 'none') { if (this.onRiadok) this.onRiadok(z, teraz); return; }
    if (h === 'pre') { this.hned(z, teraz); this.poslKoniec = teraz; if (this.onRiadok) this.onRiadok(z, teraz); return; }
    const { d, t: tel } = this._riadokEl(h, PREDPONA[h]);
    if (z.id) d.dataset.id = z.id;
    if (o.trieda) d.classList.add(o.trieda);
    this._vloz(d, teraz);
    const zaklad = o.pomaly || RYCHLOST[h] || 14;
    const ms = Math.max(1, Math.min(zaklad, MAX_TRVANIE / Math.max(1, t.length)));
    this.aktual = { z, h, full: t, el: tel, t0: teraz, ms: o.pomaly ? o.pomaly : ms, n: -1 };
    this.poslStart = teraz;
    this.poslCitanie = h === 'gc' || h === 'keeper' ? CITANIE(t.length) : h === 'sys' ? 400 : 0;
    if (h === 'keeper' && this.zvuk) this.zvuk.keeper();
    if (h === 'letter' && this.zvuk) this.zvuk.list();
    this._pasPridaj(h, t, this.aktual.ms);
    this.tik(teraz);
  }

  /** Hlas do fronty pásu (gc a KEEPER). Fronta má strop 6; najstarší čakajúci riadok ostane v logu. */
  _pasPridaj(h, t, ms) {
    if (h !== 'gc' && h !== 'keeper') return;
    this.pasFronta.push({ h, full: t, ms: Math.max(1, ms || 14) });
    while (this.pasFronta.length > 6) this.pasFronta.shift();
  }

  /** Písací stroj pásu a čas na čítanie: ďalší hlas až po CITANIE(dĺžka) od dopísania predchádzajúceho. */
  _pasTik(teraz) {
    for (let k = 0; k < 2; k++) {
      const p = this.pas;
      if (p && p.n < p.full.length) {
        const n = this.reduced ? p.full.length : Math.min(p.full.length, Math.floor((teraz - p.t0) / p.ms));
        if (n !== p.n) {
          p.n = n;
          if (this.onPas) this.onPas(p.h, p.full.slice(0, n) + (n < p.full.length ? '█' : ''));
          if (n >= p.full.length) p.koniec = teraz;
        }
      }
      const volno = !p || (p.n >= p.full.length && teraz >= p.koniec + CITANIE(p.full.length));
      if (!volno || !this.pasFronta.length) return;
      const d = this.pasFronta.shift();
      this.pas = { h: d.h, full: d.full, ms: d.ms, t0: teraz, n: -1, koniec: 0 };
    }
  }

  /** Kým pás drží hlas (píše ho alebo plynie čas na čítanie), vráti jeho text; inak null (pre testy a ladenie). */
  pasDrzi(teraz) {
    const p = this.pas;
    if (!p) return null;
    return p.n < p.full.length || teraz < p.koniec + CITANIE(p.full.length) ? p.full : null;
  }

  /** Dopíše všetko vo fronte hneď (statické obrazovky, preskočenie). */
  dopis(teraz = 0) {
    if (this.aktual) { this.aktual.el.textContent = this.aktual.full; const z = this.aktual.z; this._sr(this.aktual.h, this.aktual.full); this.aktual = null; if (this.onRiadok) this.onRiadok(z, teraz); }
    while (this.fronta.length) {
      const { z, o } = this.fronta.shift();
      const { h } = this.text(z);
      if (h === 'none') { if (this.onRiadok) this.onRiadok(z, teraz); continue; }
      const d = this.hned(z, 0, false);
      if (o.trieda) d.classList.add(o.trieda);
      const tx = this.text(z);
      this._pasPridaj(tx.h, tx.t, 1);
      if (this.onRiadok) this.onRiadok(z, teraz);
    }
  }

  /** Obnoví celý log zo záznamov (pri štarte, DECODER, LEXICON). */
  obnov(zaznamy) {
    this.el.textContent = '';
    for (const z of zaznamy.slice(-MAX_RIADKOV)) this.hned(z, 0, false);
  }

  /** Prepíše KEEPERove riadky podľa stavu (DECODER vyčistí hlavičky); s dešifrovaním. oneskorenie = ms medzi riadkami. */
  prepisKeeper(teraz, oneskorenie = 0) {
    const riadky = [...this.el.children].filter((d) => d.dataset && d.dataset.id && riadokPodlaId(d.dataset.id) && riadokPodlaId(d.dataset.id).h === 'keeper').reverse();
    riadky.forEach((d, i) => {
      const r = riadokPodlaId(d.dataset.id);
      const t = textRiadku(r, this.stav());
      const tel = d.querySelector('.t');
      if (!tel || tel.textContent === t) return;
      this.sifruj(tel, t, teraz + i * oneskorenie, 600);
    });
    return riadky.length;
  }

  sifruj(el, text, teraz, max = 600) {
    if (this.reduced) { el.textContent = text; return; }
    this.sifry.set(el, { text, t0: teraz, krok: -1e9, max });
  }

  /** Glitch: 1 až 3 znaky vo viditeľných riadkoch sa na 80 ms zamenia za ▒. */
  glitch(teraz, rnd = Math.random) {
    const deti = this.el.children;
    if (!deti.length) return;
    const kolko = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < kolko; k++) {
      const d = deti[Math.max(0, deti.length - 1 - Math.floor(rnd() * Math.min(8, deti.length)))];
      const el = d.querySelector('.t');
      if (!el || this.sifry.has(el) || (this.aktual && this.aktual.el === el)) continue;
      const t = el.textContent;
      if (t.length < 2) continue;
      const i = Math.floor(rnd() * t.length);
      if (t[i] === ' ') continue;
      const zly = t.slice(0, i) + '▒' + t.slice(i + 1);
      el.textContent = zly;
      this.glitchy.push({ el, povodny: t, zly, do: teraz + 80 });
    }
  }

  prazdna() { return !this.aktual && !this.fronta.length; }
}
