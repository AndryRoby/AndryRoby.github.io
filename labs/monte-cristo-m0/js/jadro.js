/* Jadro hry: stavovy automat nad datami kapitoly (format mc-m0-kapitola/1).
 *
 * Bez DOM a bez canvasu, takze ho spusta prehliadac aj testovacie roboty v Node.
 * Jadro pozna len kroky a vysledky hraca; obraz, dialog a zvuk len pocuvaju
 * udalosti (na) a posielaju spat vysledok kroku (vyries).
 *
 * Kroky, ktore cakaju na hraca: titulok, predtym, co_vies, replika, rozpravanie,
 * dokument, pocuvanie, akcia, ton, volba_karty, mechanika, usudok, poznamka_hracovi, koniec.
 * Kroky, ktore jadro vybavi samo: pozornost (otvori okno do konca beatu), zapis, kontrolny_bod.
 * Specifikacia je ops/monte-cristo/m0/testy/dohratie.test.mjs a technika.md cast 2. */

export const VERZIA_ULOZENIA = 1;
const CAKA = new Set(['titulok', 'predtym', 'co_vies', 'replika', 'rozpravanie', 'dokument', 'pocuvanie', 'akcia', 'ton', 'volba_karty', 'mechanika', 'usudok', 'poznamka_hracovi', 'koniec']);

export function linearizuj(data) {
  const kroky = [];
  const body = new Map();
  const zaciatokBeatu = new Map();
  data.beaty.forEach((b, bi) => {
    zaciatokBeatu.set(b.id, kroky.length);
    if (b.kontrolny_bod) body.set(b.kontrolny_bod, kroky.length);
    b.kroky.forEach((k) => {
      if (k.typ === 'kontrolny_bod') body.set(k.id, kroky.length);
      if (k.kontrolny_bod_pred) body.set(k.kontrolny_bod_pred, kroky.length);
      kroky.push({ beat: b, bi, k });
    });
  });
  return { kroky, body, zaciatokBeatu };
}

const novyStav = (n) => ({
  kapitola: n, i: 0, ton: {}, dennik: new Set(), poc: new Set(), otvorene: new Set(), vrstvy: new Set(),
  naucene: new Set(), karty: {}, uzavrete: {}, pokusy: {}, zachytene: new Set(), dohrane: false, bod: null, snimky: {},
});

export class Jadro {
  constructor(data, o = {}) {
    this.data = data;
    Object.assign(this, linearizuj(data));
    this.na = o.na || (() => {});
    this.st = novyStav(data.kapitola);
    this.dennikIds = new Set(data.dennik.map((d) => d.id));
    this.okna = new Map(); // otvorene okna Pozornosti v tomto beate: id kroku -> krok
    this.beatIdx = -1;
    this.tahov = 0;
    if (o.ulozene) this.nacitaj(o.ulozene);
  }

  /* ── podmienky a zapisy ─────────────────────────────────────────── */
  plati(ak) {
    if (!ak) return true;
    const neg = ak.startsWith('!');
    const [druh, zvysok] = (neg ? ak.slice(1) : ak).split(':');
    let v;
    if (druh === 'ton') { const [id, hod] = zvysok.split('='); v = this.st.ton[id] === hod; }
    else if (druh === 'dennik') v = this.st.dennik.has(zvysok);
    else if (druh === 'pocuvanie') v = this.st.poc.has(zvysok);
    else throw new Error('neznama podmienka ' + ak);
    return neg ? !v : v;
  }
  zapis(id) {
    if (!id || this.st.dennik.has(id)) return;
    if (!this.dennikIds.has(id)) throw new Error('dennik ' + id + ' neexistuje');
    this.st.dennik.add(id);
    this.na({ typ: 'dennik', id });
  }

  /* ── pohyb po krokoch ───────────────────────────────────────────── */
  aktualny() { return this.kroky[this.st.i] || null; }

  // Vybavi automaticke kroky a zastavi na kroku, ktory caka na hraca.
  postup() {
    for (;;) {
      if (++this.tahov > 100000) throw new Error('jadro: priliz vela krokov');
      const x = this.kroky[this.st.i];
      if (!x) return null;
      if (x.bi !== this.beatIdx) this.vstupDoBeatu(x);
      const k = x.k;
      if (!this.plati(k.ak)) { this.st.i++; continue; }
      if (k.kontrolny_bod_pred && this.st.bod !== k.kontrolny_bod_pred) this.kontrolnyBod(k.kontrolny_bod_pred);
      if (CAKA.has(k.typ)) return x;
      if (k.typ === 'pozornost') { this.okna.set(k.id, k); this.na({ typ: 'okno', krok: k }); }
      else if (k.typ === 'zapis') {
        if (k.uzavri) { this.st.uzavrete[k.dennik] = k.en || ''; this.na({ typ: 'uzavrete', id: k.dennik, en: k.en }); }
        else this.zapis(k.dennik);
      } else if (k.typ === 'kontrolny_bod') this.kontrolnyBod(k.id);
      this.st.i++;
    }
  }

  vstupDoBeatu(x) {
    this.beatIdx = x.bi;
    this.okna.clear();
    if (x.beat.kontrolny_bod && this.st.i === this.zaciatokBeatu.get(x.beat.id)) this.kontrolnyBod(x.beat.kontrolny_bod);
    this.na({ typ: 'beat', beat: x.beat });
  }

  kontrolnyBod(id) {
    this.st.bod = id;
    this.st.snimky[id] = { ton: { ...this.st.ton }, vrstvy: [...this.st.vrstvy], karty: { ...this.st.karty } };
    this.na({ typ: 'kontrolny_bod', id });
  }

  // Navrat na kontrolny bod: index a stav z bodu; Dennik sa nevracia (co hrac zistil, ostane).
  vrat(bod, preco) {
    if (!this.body.has(bod)) throw new Error('navrat na neexistujuci bod ' + bod);
    const s = this.st.snimky[bod];
    if (s) { this.st.ton = { ...s.ton }; this.st.vrstvy = new Set(s.vrstvy); this.st.karty = { ...s.karty }; }
    this.st.i = this.body.get(bod);
    this.st.bod = bod;
    this.beatIdx = -1;
    this.na({ typ: 'navrat', bod, preco });
  }

  /* Pozornost: hrac si vsimol ciel okna v aktualnom beate (aj ciel, ku ktoremu
     dej este nedosiel, napriklad riadok listu, ktory prave cita). */
  vsimni(id) {
    const x = this.kroky[this.st.i];
    if (!x) return false;
    const k = this.okna.get(id) || x.beat.kroky.find((q) => q.typ === 'pozornost' && q.id === id);
    if (!k || !this.plati(k.ak)) return false;
    const nove = k.dennik && !this.st.dennik.has(k.dennik);
    this.zapis(k.dennik);
    return nove;
  }
  // Okna Pozornosti, ktore su v aktualnom beate k dispozicii (vratane tych, ku ktorym dej ide).
  ciele() {
    const x = this.kroky[this.st.i];
    if (!x) return [];
    return x.beat.kroky.filter((q) => q.typ === 'pozornost' && this.plati(q.ak));
  }

  /* Vysledok aktualneho kroku. v podla typu:
     replika {zachytene}, pocuvanie {pocuval}, ton {moznost}, volba_karty {karta},
     mechanika M19 {ok}, M54_prevlek {vrstvy}, c08_uder {vcas}, usudok {odpoved}.
     Vrati objekt s tym, co sa stalo (pre rozhranie), a posunie sa na dalsi cakajuci krok. */
  vyries(v = {}) {
    const x = this.kroky[this.st.i];
    if (!x) return { koniec: true };
    const k = x.k;
    const vysl = {};
    switch (k.typ) {
      case 'replika':
        if (k.zachyt && v.zachytene) { this.st.zachytene.add(k.zachyt.dennik); this.zapis(k.zachyt.dennik); vysl.zachytene = k.zachyt.dennik; }
        break;
      case 'pocuvanie':
        if (v.pocuval) { this.st.poc.add(k.id); if (k.dennik) this.zapis(k.dennik); vysl.pocuval = true; }
        break;
      case 'ton': {
        const m = k.moznosti.find((q) => q.id === v.moznost) || k.moznosti[0];
        this.st.ton[k.id] = m.id;
        (m.nasledok.dennik || []).forEach((d) => this.zapis(d));
        vysl.moznost = m;
        this.na({ typ: 'uloz' });
        break;
      }
      case 'volba_karty': {
        const c = k.karty.find((q) => q.id === v.karta);
        if (!c) throw new Error('karta ' + v.karta + ' neexistuje');
        this.st.karty[k.id] = c.id;
        if (c.druh === 'persona' || c.druh === 'ozvena') {
          this.st.naucene.add(c.id);
          this.na({ typ: 'zla_karta', krok: k, karta: c });
          return { zla: c };
        }
        if (c.druh === 'strukturalna') {
          this.st.naucene.add(c.id);
          this.st.otvorene.add(k.riadok_knihy_svedkov);
          this.st.i = this.kroky.findIndex((q) => q.k.id === c.chybna_vetva.pokracuj_od);
          this.na({ typ: 'uloz' });
          this.postup();
          return { strukturalna: c };
        }
        this.st.otvorene.delete(k.riadok_knihy_svedkov);
        this.na({ typ: 'uloz' });
        break;
      }
      case 'mechanika':
        if (k.id === 'M19') {
          this.st.pokusy.M19 = (this.st.pokusy.M19 || 0) + (v.ok ? 0 : 1);
          if (!v.ok) return { opakuj: true };
        } else if (k.id === 'M54_prevlek') {
          this.st.vrstvy = new Set(v.vrstvy || []);
          /* neuspech s cenou (data-69 neuspech): chyba viditelna vrstva alebo minuty dosli skor, nez bol hotovy.
             Chybajuca jazva sa tu neprezradi, prejavi sa az pri ukone a_golier. */
          const chyba = k.vrstvy.filter((q) => !q.skryta && !this.st.vrstvy.has(q.id)).map((q) => q.id);
          if (chyba.length || v.neskoro) {
            const bod = x.beat.kontrolny_bod || 'S6';
            this.vrat(bod, v.neskoro ? 'neskoro' : 'prevlek');
            this.postup();
            return { navrat: bod, preco: v.neskoro ? 'neskoro' : 'prevlek', chybaju: chyba };
          }
        } else if (k.id === 'c08_uder') {
          if (!v.vcas) { this.st.otvorene.add('S_presnost'); this.vrat('S6b', 'uder'); this.postup(); return { navrat: 'S6b', preco: 'uder' }; }
          this.st.otvorene.delete('S_presnost');
        } else if (k.id === 'M54_kontrola') {
          const otv = [...this.st.otvorene];
          if (otv.length) { const bod = k.navraty[otv[0]]; this.vrat(bod, 'kontrola ' + otv[0]); this.postup(); return { navrat: bod, preco: otv[0] }; }
        }
        break;
      case 'akcia':
        if (k.podmienka_uspechu === 'vrstva:jazva' && !this.st.vrstvy.has('jazva')) { this.vrat('S6', 'jazva'); this.postup(); return { navrat: 'S6', preco: 'jazva' }; }
        break;
      case 'usudok':
        if (v.odpoved === k.spravne) { this.zapis(this.dennikIds.has(k.id) ? k.id : null); this.st.naucene.add(k.id); vysl.spravne = true; }
        break;
      case 'koniec':
        this.st.dohrane = true;
        this.na({ typ: 'koniec' });
        this.na({ typ: 'uloz' });
        return { koniec: true };
    }
    this.st.i++;
    this.postup();
    return vysl;
  }

  /* ── ukladanie ─────────────────────────────────────────────────── */
  // Ulozi sa zaciatok aktualneho beatu (rezia beatu sa tak vzdy postavi celá).
  uloz() {
    const x = this.kroky[this.st.i];
    const i = x ? this.zaciatokBeatu.get(x.beat.id) : this.kroky.length;
    const s = this.st;
    return {
      v: VERZIA_ULOZENIA, kapitola: s.kapitola, index: i, bod: s.bod, ton: s.ton, dennik: [...s.dennik], poc: [...s.poc],
      karty: s.karty, otvorene: [...s.otvorene], vrstvy: [...s.vrstvy], naucene: [...s.naucene], uzavrete: s.uzavrete,
      pokusy: s.pokusy, zachytene: [...s.zachytene], dohrane: s.dohrane, snimky: s.snimky,
    };
  }
  nacitaj(u) {
    if (!u || u.v !== VERZIA_ULOZENIA || u.kapitola !== this.data.kapitola) return false;
    const s = novyStav(this.data.kapitola);
    s.i = Math.max(0, Math.min(this.kroky.length, u.index | 0));
    s.bod = u.bod || null;
    s.ton = u.ton || {};
    s.dennik = new Set((u.dennik || []).filter((d) => this.dennikIds.has(d)));
    s.poc = new Set(u.poc || []);
    s.karty = u.karty || {};
    s.otvorene = new Set(u.otvorene || []);
    s.vrstvy = new Set(u.vrstvy || []);
    s.naucene = new Set(u.naucene || []);
    s.uzavrete = u.uzavrete || {};
    s.pokusy = u.pokusy || {};
    s.zachytene = new Set(u.zachytene || []);
    s.dohrane = !!u.dohrane;
    s.snimky = u.snimky || {};
    this.st = s;
    this.beatIdx = -1;
    return true;
  }
}
