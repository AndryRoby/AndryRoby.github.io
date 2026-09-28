(function (root) {
  'use strict';
  var FORMATY = {
    'web-4x5': { W: 1080, H: 1350, telo: 46, stitok: 38, male: 34 },
    'web-1x1': { W: 1080, H: 1080, telo: 26, stitok: 24, male: 24 },
    'web-16x9': { W: 1920, H: 1080, telo: 38, stitok: 32, male: 30 },
  };
  function formatZoSirky(w) { return w < 600 ? 'web-4x5' : w < 720 ? 'web-1x1' : 'web-16x9'; }
  function formatZPomeru(s) {
    var m = /([\d.]+)\s*\/\s*([\d.]+)/.exec(String(s || ''));
    var r = m ? parseFloat(m[1]) / parseFloat(m[2]) : /^[\d.]+$/.test(String(s).trim()) ? parseFloat(s) : NaN;
    if (!(r > 0)) return null;
    if (r < 0.9) return 'web-4x5';
    if (r < 1.3) return 'web-1x1';
    return 'web-16x9';
  }
  function mierka(sirkaBoxu, W) { return sirkaBoxu / W; }
  function rozlozenie(format) {
    var F = FORMATY[format] || FORMATY['web-16x9'];
    var m = Math.min(F.W, F.H) * 0.06;
    var safe = { x: m, y: m, w: F.W - 2 * m, h: F.H - 2 * m };
    return { format: format, W: F.W, H: F.H, safe: safe, margin: m, fill: 0.94, tall: false, telo: F.telo, stitok: F.stitok, male: F.male };
  }
  function zastavkaZPolohy(stredY, vyska, n, predosla, pasmo) {
    if (n <= 1) return 0;
    pasmo = pasmo == null ? 24 : pasmo;
    var pos = 0.8 * vyska - stredY;
    var seg = (0.6 * vyska) / n;
    var raw = Math.max(0, Math.min(n - 1, Math.floor(pos / seg)));
    if (predosla == null || raw === predosla) return raw;
    var c = raw;
    if (raw > predosla) { while (c > predosla && pos - c * seg < pasmo) c--; }
    else { while (c < predosla && (c + 1) * seg - pos < pasmo) c++; }
    return c;
  }
  function krokDobehu(t, ciel, dt, v) {
    if (t < ciel) return Math.min(ciel, t + dt * Math.max(1, v || 1));
    if (t > ciel) return Math.max(ciel, t - dt * Math.max(2, v || 2));
    return t;
  }
  var MAX_DOBEH = 1.2;
  var MAX_DOBEH_OD = 3.2;
  function rychlostDobehu(t, ciel, max) {
    var d = Math.abs(ciel - t);
    max = max || MAX_DOBEH;
    return ciel >= t ? Math.max(1, d / max) : Math.max(2, d / max);
  }
  function cestaKZastavke(t, z, i, D, vpred) {
    var ciel = z[i].t, potom = z[i].t, skok = t, max = MAX_DOBEH;
    var od = z[i].od;
    if (vpred && ciel < t - 1e-9) { ciel += D; } // cez koniec slučky: čas D + t_i vyzerá ako t_i
    if (ciel > t + 1e-9) {
      if (od != null) {
        var odC = od <= z[i].t ? od + (ciel - z[i].t) : od; // od zastávky 0 leží na konci slučky
        if (odC > t && odC < ciel) skok = odC;
        max = MAX_DOBEH_OD;
      }
    } else if (ciel < t - 1e-9) {
      var dalsia = z[i + 1];
      if (dalsia && dalsia.od != null && dalsia.od > z[i].t) {
        if (t > dalsia.t) skok = dalsia.t;
        ciel = dalsia.od;
        max = MAX_DOBEH_OD;
      }
    }
    return { skok: skok, ciel: ciel, potom: potom, max: max };
  }
  function aktualnaZastavka(t, zastavky) {
    var i = 0;
    for (var k = 0; k < zastavky.length; k++) if (zastavky[k].t <= t + 1e-6) i = k;
    return i;
  }
  function vyberRezim(o) {
    if (o.znizeny) return 'pokoj';
    if (o.skoky) return 'skoky';
    return o.dotyk ? 'posun' : 'auto';
  }
  function zapisovac() {
    return function (el, vlastnost, hodnota) {
      var c = el.__pw || (el.__pw = {});
      if (c[vlastnost] === hodnota) return false;
      c[vlastnost] = hodnota;
      el.style.setProperty(vlastnost, hodnota);
      return true;
    };
  }
  function citaj(uloz, kluc) { try { return uloz ? uloz.getItem(kluc) : null; } catch (e) { return null; } }
  function zapis(uloz, kluc, hodnota) { try { if (uloz) { if (hodnota == null) uloz.removeItem(kluc); else uloz.setItem(kluc, hodnota); } return true; } catch (e) { return false; } }
  function Videne() { this.od = null; this.hotovo = false; }
  Videne.prototype.krok = function (pomer, ms) {
    if (this.hotovo) return false;
    if (pomer < 0.5) { this.od = null; return false; }
    if (this.od == null) this.od = ms;
    if (ms - this.od >= 1000) { this.hotovo = true; return true; }
    return false;
  };
  function vyberZivu(zoznam) {
    var best = null;
    for (var i = 0; i < zoznam.length; i++) {
      var z = zoznam[i];
      if (z.pomer >= 0.5 && (!best || z.pomer > best.pomer)) best = z;
    }
    return best ? best.id : null;
  }
  function Logika(o) {
    this.D = o.duration;
    this.z = o.zastavky && o.zastavky.length ? o.zastavky : [{ t: 0, nazov: '' }];
    this.vyzva = o.vyzva == null ? this.z.length - 1 : o.vyzva;
    this.plagat = o.plagat || 0;
    this.slucky = o.slucky == null ? 2 : o.slucky;
    this.rezim = o.rezim || 'auto';
    this.zaklad = o.zaklad || (this.rezim === 'posun' ? 'posun' : 'auto');
    this.t = this.z[this.plagat].t;
    this.zivy = false;
    this.pauza = !!o.pauza;
    this.hotovo = false;
    this.rucne = false;
    this.ciel = null;
    this.skokCas = 0;
    this.skokKrok = 0;
    this._zacni(this.t);
    this._zmena = true;
  }
  Logika.prototype._zacni = function (t0) {
    var tv = this.z[this.vyzva].t;
    var D = this.D;
    this.tAbs = t0;
    this.koniec = t0 + this.slucky * D + ((((tv - t0) % D) + D) % D);
  };
  Logika.prototype.zastavka = function () { return this.ciel != null && this.cielIndex != null ? this.cielIndex : aktualnaZastavka(this.t, this.z); };
  Logika.prototype.bezi = function () {
    if (this.pauza || !this.zivy) return false;
    if (this.rezim === 'pokoj') return false;
    if (this.ciel != null) return this.rezim !== 'skoky';
    if (this.rezim === 'auto' || (this.rezim === 'skoky' && this.zaklad === 'auto')) return !this.hotovo && !this.rucne;
    return false;
  };
  Logika.prototype.naZastavku = function (i, rucne, vpred) {
    i = Math.max(0, Math.min(this.z.length - 1, i));
    if (rucne) this.rucne = true;
    var t = this.z[i].t;
    this.potom = null;
    if (this.rezim === 'pokoj' || this.rezim === 'skoky' || this.pauza) {
      this.ciel = null;
      if (this.t !== t) { this.t = t; this._zmena = true; }
      return;
    }
    this.cielIndex = i;
    if (t === this.t) { this.ciel = null; this.rychlost = 1; return; }
    var c = cestaKZastavke(this.t, this.z, i, this.D, vpred);
    if (c.skok !== this.t) this.t = c.skok;
    this.ciel = c.ciel === this.t ? null : c.ciel;
    if (this.ciel == null) { this.t = c.potom; return; }
    this.potom = c.potom !== c.ciel ? c.potom : null;
    this.rychlost = rychlostDobehu(this.t, this.ciel, c.max);
  };
  Logika.prototype.prepniPauzu = function () {
    this.pauza = !this.pauza;
    if (this.pauza) this.ciel = null;
    return this.pauza;
  };
  Logika.prototype.stavTlacidla = function () {
    if (this.pauza) return 'hraj';
    if (this.rezim === 'pokoj') return 'pauza';
    if (this.zaklad === 'auto' || this.rezim === 'auto') {
      if (this.hotovo) return 'znova';
      if (this.rucne && this.ciel == null) return 'hraj';
    }
    return 'pauza';
  };
  Logika.prototype.pokracuj = function () {
    this.rucne = false;
    this.ciel = null;
    var tv = this.z[this.vyzva].t, D = this.D;
    this.tAbs = this.t;
    this.koniec = this.t + D + ((((tv - this.t) % D) + D) % D);
  };
  Logika.prototype.znova = function () {
    this.hotovo = false;
    this.rucne = false;
    this.pauza = false;
    this.ciel = null;
    this.t = 0;
    this.tAbs = 0;
    this.koniec = this.z[this.vyzva].t;
    this._zmena = true;
  };
  Logika.prototype.tik = function (dt) {
    var pred = this.t;
    if (this._zmena) { this._zmena = false; return this.t; }
    if (this.pauza || !this.zivy || this.rezim === 'pokoj') return null;
    if (this.ciel != null && this.rezim !== 'skoky') {
      this.t = krokDobehu(this.t, this.ciel, dt, this.rychlost);
      if (this.t === this.ciel) {
        this.ciel = null;
        if (this.potom != null) { this.t = this.potom; this.potom = null; }
      }
      this.tAbs = this.t;
      return this.t !== pred ? this.t : null;
    }
    if (this.rucne || this.hotovo) return null;
    if (this.rezim === 'auto') {
      this.tAbs = Math.min(this.koniec, this.tAbs + dt);
      if (this.tAbs >= this.koniec) { this.hotovo = true; this.t = this.z[this.vyzva].t; }
      else this.t = ((this.tAbs % this.D) + this.D) % this.D;
      return this.t !== pred ? this.t : null;
    }
    if (this.rezim === 'skoky' && this.zaklad === 'auto') {
      this.skokCas += dt;
      if (this.skokCas < 2.4) return null;
      this.skokCas = 0;
      this.skokKrok++;
      var n = this.z.length;
      if (this.skokKrok >= this.slucky * n + this.vyzva) { this.hotovo = true; this.t = this.z[this.vyzva].t; }
      else this.t = this.z[(this.plagat + this.skokKrok) % n].t;
      return this.t !== pred ? this.t : null;
    }
    return null;
  };
  var jadro = {
    FORMATY: FORMATY, formatZoSirky: formatZoSirky, formatZPomeru: formatZPomeru, mierka: mierka, rozlozenie: rozlozenie,
    zastavkaZPolohy: zastavkaZPolohy, krokDobehu: krokDobehu, rychlostDobehu: rychlostDobehu, MAX_DOBEH: MAX_DOBEH, MAX_DOBEH_OD: MAX_DOBEH_OD,
    cestaKZastavke: cestaKZastavke, aktualnaZastavka: aktualnaZastavka, vyberRezim: vyberRezim,
    zapisovac: zapisovac, citaj: citaj, zapis: zapis, Videne: Videne, vyberZivu: vyberZivu, Logika: Logika,
  };
  var doc = root.document;
  var P = root.Pohyb;
  if (!doc || !P) {
    if (typeof module !== 'undefined' && module.exports) module.exports = { _jadro: jadro };
    if (!doc) return;
  }
  var TEMY = {
    video: { platno: '#ECEAE6', papier: '#FFFFFF', ink: '#111111', vyzva: '#111111', vyzvaText: '#FFFFFF', tichy: '#77736C', linka: '#DCD9D3', text: '#111111', textNaInk: '#FFFFFF', tichyNaPapieri: '#77736C', textNaPlatne: '#111111' },
    noc: { platno: 'transparent', papier: '#F4F1EC', ink: '#1C1815', vyzva: '#F2643C', vyzvaText: '#1B0E08', tichy: '#A8A4A0', linka: 'rgba(255,255,255,.14)', text: '#141413', textNaInk: '#FAFAFA', tichyNaPapieri: '#5E5D59', textNaPlatne: '#FAFAFA' },
    papier: { platno: 'transparent', papier: '#FFFFFF', ink: '#141413', vyzva: '#B23A1D', vyzvaText: '#FFFFFF', tichy: '#5E5D59', linka: '#E4E2D8', text: '#141413', textNaInk: '#FAF9F5', tichyNaPapieri: '#5E5D59', textNaPlatne: '#141413' },
  };
  if (P) {
    if (!P.TEMY) P.TEMY = TEMY;
    if (!P._sceny) P._sceny = {};
    if (!P.scena) P.scena = function (slug, def) { P._sceny[slug] = def; };
    if (!P.WEB) P.WEB = { blur: 4 };
  }
  function mq(q) { try { return !!(root.matchMedia && root.matchMedia(q).matches); } catch (e) { return false; } }
  function uloziste() { try { return root.localStorage; } catch (e) { return null; } }
  function sleduj(meno, data) {
    try { if (root.umami && typeof root.umami.track === 'function') root.umami.track(meno, data); } catch (e) { /* meranie nesmie nič zhodiť */ }
  }
  var TEXTY = {
    pauza: { sk: 'Pozastaviť animáciu', cs: 'Pozastavit animaci', en: 'Pause animation', de: 'Animation anhalten' },
    hraj: { sk: 'Prehrať animáciu', cs: 'Přehrát animaci', en: 'Play animation', de: 'Animation abspielen' },
    znova: { sk: 'Prehrať znova', cs: 'Přehrát znovu', en: 'Play again', de: 'Erneut abspielen' },
    kroky: { sk: 'Kroky', cs: 'Kroky', en: 'Steps', de: 'Schritte' },
  };
  function text(k, lang) { var l = String(lang || 'en').slice(0, 2); return TEXTY[k][l] || TEXTY[k].en; }
  var IKONY = {
    pauza: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M8 5v14M16 5v14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    hraj: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
    znova: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  var vykon = (root.__vykon = root.__vykon || { snimky: 0, js: [], dlhe: 0, sceny: 0 });
  function zaznamenaj(ms) {
    vykon.snimky++;
    vykon.js.push(Math.round(ms * 100) / 100);
    if (vykon.js.length > 600) vykon.js.shift();
  }
  function WebStage(okno, format) {
    var R = rozlozenie(format);
    this.W = R.W; this.H = R.H; this.safe = R.safe; this.layout = R; this.format = format;
    this.unit = Math.min(R.W, R.H) / 1080; this.tall = false; this.q = {}; this.render = false; this.web = true;
    var el = doc.createElement('div');
    el.className = 'pohyb-stage';
    el.style.setProperty('width', R.W + 'px');
    el.style.setProperty('height', R.H + 'px');
    var world = doc.createElement('div');
    world.className = 'pohyb-world';
    var overlay = doc.createElement('div');
    overlay.className = 'pohyb-overlay';
    el.appendChild(world);
    el.appendChild(overlay);
    okno.appendChild(el);
    this.el = el; this.world = world; this.overlay = overlay;
  }
  WebStage.prototype.mierka = function (k) { this.el.style.setProperty('transform', 'scale(' + k.toFixed(5) + ')'); };
  WebStage.prototype.znic = function () { if (this.el.parentNode) this.el.parentNode.removeChild(this.el); };
  var zapisuj = zapisovac();
  var sceny = [];
  var zariadenie = mq('(pointer: coarse)') ? 'mobil' : 'pc';
  function Scena(fig) {
    this.fig = fig;
    this.okno = fig.querySelector('.pohyb-okno');
    this.slug = fig.getAttribute('data-pohyb');
    this.lang = fig.getAttribute('data-lang') || doc.documentElement.getAttribute('lang') || 'en';
    this.miesto = fig.getAttribute('data-miesto') || '';
    this.tema = fig.getAttribute('data-tema') || 'noc';
    this.kapitola = fig.getAttribute('data-kapitola') || null;
    this.vyzvaEl = fig.querySelector('.pohyb-vyzva');
    this.ovladanie = fig.querySelector('.pohyb-ovladanie');
    this.pauzaBtn = fig.querySelector('.pohyb-pauza');
    this.zastavkyEl = fig.querySelector('.pohyb-zastavky');
    this.pomer = 0;
    this.videne = new Videne();
    this.raf = 0;
    this.posledna = 0;
    this.slabe = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4) || false;
    this.snimky = [];
    this.stav = 'caka';
    this.posunZapnuty = false;
    this.okno.setAttribute('data-tema', this.tema);
    var self = this;
    this._tik = function (now) { self.tik(now); };
    fig.querySelectorAll('[data-umami-event]').forEach(function (a) { a.setAttribute('data-umami-event-zariadenie', zariadenie); });
  }
  Scena.prototype.nacitaj = function () {
    if (this.stav !== 'caka') return;
    this.stav = 'nacitava';
    var self = this;
    if (P._sceny[this.slug]) { this.postav(); return; }
    var styl = this.fig.getAttribute('data-styl');
    if (styl && !doc.querySelector('link[data-pohyb-styl="' + this.slug + '"]')) {
      var l = doc.createElement('link');
      l.rel = 'stylesheet'; l.href = styl; l.setAttribute('data-pohyb-styl', this.slug);
      doc.head.appendChild(l);
    }
    var src = this.fig.getAttribute('data-skript');
    if (!src) { this.stav = 'chyba'; return; }
    var s = doc.createElement('script');
    s.src = src; s.async = true;
    s.onload = function () { if (P._sceny[self.slug]) self.postav(); else self.stav = 'chyba'; };
    s.onerror = function () { self.stav = 'chyba'; };
    doc.body.appendChild(s);
  };
  Scena.prototype.rezim = function () {
    return vyberRezim({ znizeny: mq('(prefers-reduced-motion: reduce)'), skoky: this.skoky, dotyk: mq('(hover: none) and (pointer: coarse)') });
  };
  Scena.prototype.format = function () {
    var f = null;
    try { f = formatZPomeru(root.getComputedStyle(this.okno).aspectRatio); } catch (e) { /* starý prehliadač */ }
    return f || formatZoSirky(this.okno.clientWidth);
  };
  Scena.prototype.postav = function () {
    var def = P._sceny[this.slug];
    var t = this.logika ? this.logika.t : null;
    if (this.stage) this.stage.znic();
    this.fmt = this.format();
    this.stage = new WebStage(this.okno, this.fmt);
    var o = { lang: this.lang, format: this.fmt, web: true, tema: P.TEMY[this.tema] || P.TEMY.noc, temaMeno: this.tema, slabe: !!this.slabe, kapitola: this.kapitola, blur: this.slabe ? 0 : P.WEB.blur };
    this.inst = def.postav(this.stage, o);
    this.stage.el.classList.toggle('pohyb-slabe', !!this.slabe);
    var rez = this.rezim();
    var pauza = citaj(uloziste(), 'pohyb.pauza') === '1';
    if (!this.logika) {
      this.logika = new Logika({ duration: this.inst.duration, zastavky: this.inst.zastavky, vyzva: this.inst.vyzva, plagat: this.inst.plagat, rezim: rez, pauza: pauza,
        zaklad: mq('(hover: none) and (pointer: coarse)') ? 'posun' : 'auto' });
    } else {
      this.logika.D = this.inst.duration;
      this.logika.z = this.inst.zastavky;
      this.logika.t = t;
      this.logika._zmena = true;
    }
    this.merajRozmer();
    if (!this.ovladanieHotove) this.postavOvladanie();
    this.stav = 'hotova';
    this.kresli(this.logika.t);
    this.fig.classList.add('pohyb-hotova');
    this.logika._zmena = false;
    vykon.sceny = sceny.filter(function (s) { return s.stav === 'hotova'; }).length;
    koordinuj();
    this.sledujVidene();
  };
  Scena.prototype.merajRozmer = function () {
    var w = this.okno.clientWidth;
    this.k = mierka(w, this.stage.W);
    this.stage.mierka(this.k);
    this.oknoX = this.okno.offsetLeft;
    this.oknoY = this.okno.offsetTop;
  };
  Scena.prototype.zmenaRozmeru = function () {
    if (this.stav !== 'hotova') return;
    if (this.format() !== this.fmt) { this.postav(); return; }
    this.merajRozmer();
    this.kresli(this.logika.t);
  };
  Scena.prototype.postavOvladanie = function () {
    var self = this, L = this.logika;
    this.ovladanieHotove = true;
    if (this.zastavkyEl) {
      this.zastavkyEl.setAttribute('aria-label', text('kroky', this.lang));
      this.zastavkyBtn = L.z.map(function (z, i) {
        var b = doc.createElement('button');
        b.type = 'button';
        b.className = 'pohyb-zastavka';
        b.textContent = z.nazov;
        b.addEventListener('click', function () { self.naZastavku(i, true); });
        self.zastavkyEl.appendChild(b);
        return b;
      });
    }
    if (this.pauzaBtn) {
      this.pauzaBtn.addEventListener('click', function () {
        var stav = self._pauzaStav;
        if (stav === 'znova') L.znova();
        else if (stav === 'hraj' && !L.pauza) L.pokracuj();
        else {
          var p = L.prepniPauzu();
          if (p) sleduj('pohyb_pauza', { scena: self.slug, miesto: self.miesto, zariadenie: zariadenie });
          zapis(uloziste(), 'pohyb.pauza', p ? '1' : null);
        }
        self.obnovPauzu();
        self.spusti();
      });
    }
    this.okno.addEventListener('click', function () {
      if (L.rezim === 'posun' || (L.rezim === 'skoky' && L.zaklad === 'posun')) self.naZastavku((L.zastavka() + 1) % L.z.length, false, true);
      else if (self.pauzaBtn) self.pauzaBtn.click();
    });
    if (this.ovladanie) this.ovladanie.hidden = false;
    this.obnovPauzu();
    if (root.PohybUI && this.zastavkyEl) {
      this.zastavkyEl.setAttribute('data-pu-zalozky', '');
      root.PohybUI.zalozky(this.zastavkyEl);
    }
  };
  Scena.prototype.obnovPauzu = function () {
    if (!this.pauzaBtn) return;
    var L = this.logika;
    var skry = L.rezim === 'pokoj';
    if (this.pauzaBtn.hidden !== skry) this.pauzaBtn.hidden = skry;
    var stav = L.stavTlacidla();
    if (this._pauzaStav === stav) return;
    this._pauzaStav = stav;
    this.pauzaBtn.innerHTML = IKONY[stav];
    this.pauzaBtn.setAttribute('aria-label', text(stav, this.lang));
    this.pauzaBtn.setAttribute('title', text(stav, this.lang));
    this.pauzaBtn.setAttribute('aria-pressed', L.pauza ? 'true' : 'false');
  };
  Scena.prototype.naZastavku = function (i, rucne, vpred) {
    this.logika.naZastavku(i, rucne, vpred);
    this.logika._zmena = false;
    this.kresli(this.logika.t);
    this.spusti();
  };
  Scena.prototype.kresli = function (t) {
    if (!this.inst) return;
    this.inst.seek(t);
    var i = this.logika.zastavka();
    if (this.zastavkyBtn && this._zast !== i) {
      this._zast = i;
      this.zastavkyBtn.forEach(function (b, k) { if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    }
    this.odkazy(t);
    this.obnovPauzu();
  };
  Scena.prototype.odkazy = function (t) {
    var a = this.vyzvaEl;
    if (!a) return;
    var r = this.inst.odkazy ? this.inst.odkazy(t) : null;
    r = r && r[0];
    if (!r) { if (!a.hidden) a.hidden = true; return; }
    if (a.hidden) a.hidden = false;
    if (r.href && a.getAttribute('href') !== r.href) a.setAttribute('href', r.href);
    var k = this.k;
    zapisuj(a, 'left', (this.oknoX + r.x * k).toFixed(1) + 'px');
    zapisuj(a, 'top', (this.oknoY + r.y * k).toFixed(1) + 'px');
    zapisuj(a, 'width', (r.w * k).toFixed(1) + 'px');
    zapisuj(a, 'height', (r.h * k).toFixed(1) + 'px');
  };
  Scena.prototype.spusti = function () {
    if (this.stav !== 'hotova' || this.raf || doc.hidden) return;
    if (!this.logika.bezi()) return;
    this.posledna = 0;
    this.raf = root.requestAnimationFrame(this._tik);
  };
  Scena.prototype.zastav = function () {
    if (this.raf) root.cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.posledna = 0;
  };
  Scena.prototype.tik = function (now) {
    this.raf = 0;
    var dt = this.posledna ? Math.min((now - this.posledna) / 1000, 0.1) : 1 / 60;
    var dtMs = this.posledna ? now - this.posledna : 0;
    this.posledna = now;
    var t0 = root.performance ? root.performance.now() : 0;
    var t = this.logika.tik(dt);
    if (t != null) this.kresli(t);
    else this.obnovPauzu();
    if (root.performance) zaznamenaj(root.performance.now() - t0);
    this.strazVykon(dtMs);
    if (this.logika.bezi()) this.raf = root.requestAnimationFrame(this._tik);
    else this.posledna = 0;
  };
  Scena.prototype.strazVykon = function (dtMs) {
    if (!dtMs || this.skoky) return;
    this.snimky.push(dtMs);
    if (this.snimky.length < 60) return;
    var sum = 0;
    for (var i = 0; i < this.snimky.length; i++) sum += this.snimky[i];
    var avg = sum / this.snimky.length;
    this.snimky = [];
    if (!this.slabe && avg > 22) { this.slabe = true; this.postav(); }
    else if (this.slabe && avg > 28) { this.skoky = true; this.logika.rezim = 'skoky'; this.logika.ciel = null; }
  };
  var posunCakaj = false;
  var posunBol = false; // prvé načítanie ukáže plagát, prst vedie až po prvom posune
  function koordinuj() {
    var ziva = vyberZivu(sceny.filter(function (s) { return s.stav === 'hotova'; }).map(function (s, i) { return { id: s, pomer: s.pomer }; }));
    sceny.forEach(function (s) {
      if (!s.logika) return;
      var bol = s.logika.zivy;
      s.logika.zivy = s === ziva && !doc.hidden;
      if (s.logika.zivy) s.spusti();
      else if (bol) s.zastav();
    });
  }
  function priPosune() {
    if (posunCakaj) return;
    posunCakaj = true;
    root.requestAnimationFrame(function () {
      posunCakaj = false;
      var vyska = root.innerHeight;
      var ciele = [];
      sceny.forEach(function (s) {
        if (s.stav !== 'hotova' || !s.logika.zivy || s.logika.pauza) return;
        var L = s.logika;
        if (!(L.rezim === 'posun' || (L.rezim === 'skoky' && L.zaklad === 'posun'))) return;
        var r = s.okno.getBoundingClientRect();
        ciele.push([s, zastavkaZPolohy(r.top + r.height / 2, vyska, L.z.length, s._posunZast)]);
      });
      ciele.forEach(function (c) {
        var s = c[0], i = c[1];
        s.posunZapnuty = true;
        if (s._posunZast === i) return;
        s._posunZast = i;
        s.naZastavku(i, false);
      });
    });
  }
  function start() {
    if (!P) return;
    var figs = doc.querySelectorAll('figure.pohyb[data-pohyb]');
    if (!figs.length) return;
    for (var i = 0; i < figs.length; i++) sceny.push(new Scena(figs[i]));
    if (!root.IntersectionObserver) { sceny.forEach(function (s) { s.nacitaj(); }); return; }
    var blizko = new root.IntersectionObserver(function (zaznamy) {
      zaznamy.forEach(function (z) {
        if (!z.isIntersecting) return;
        var s = najdi(z.target);
        if (s) { s.nacitaj(); blizko.unobserve(z.target); }
      });
    }, { rootMargin: '50% 0px 50% 0px' });
    var vidno = new root.IntersectionObserver(function (zaznamy) {
      zaznamy.forEach(function (z) {
        var s = najdi(z.target);
        if (!s) return;
        s.pomer = z.isIntersecting ? z.intersectionRatio : 0;
        s.sledujVidene();
      });
      koordinuj();
      if (posunBol) priPosune();
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    sceny.forEach(function (s) { blizko.observe(s.okno); vidno.observe(s.okno); });
    root.addEventListener('scroll', function () { posunBol = true; priPosune(); }, { passive: true });
    doc.addEventListener('visibilitychange', koordinuj);
    if (root.ResizeObserver) {
      var ro = new root.ResizeObserver(function (zaznamy) { zaznamy.forEach(function (z) { var s = najdi(z.target); if (s) s.zmenaRozmeru(); }); });
      sceny.forEach(function (s) { ro.observe(s.okno); });
    }
    try {
      var m = root.matchMedia('(prefers-reduced-motion: reduce)');
      var zmena = function () { sceny.forEach(function (s) { if (s.logika) { s.logika.rezim = s.rezim(); s.zastav(); s.spusti(); } }); };
      if (m.addEventListener) m.addEventListener('change', zmena);
    } catch (e) { /* bez zmeny */ }
  }
  function najdi(okno) { for (var i = 0; i < sceny.length; i++) if (sceny[i].okno === okno) return sceny[i]; return null; }
  Scena.prototype.sledujVidene = function () {
    var self = this;
    root.clearTimeout(this._videneCas);
    if (this.videne.hotovo || this.stav !== 'hotova') return;
    var ms = Date.now();
    if (this.videne.krok(this.pomer, ms)) return this.hlasVidene();
    if (this.pomer >= 0.5) this._videneCas = root.setTimeout(function () { if (self.videne.krok(self.pomer, Date.now())) self.hlasVidene(); }, 1010);
  };
  Scena.prototype.hlasVidene = function () {
    sleduj('pohyb_videne', { scena: this.slug, miesto: this.miesto, zariadenie: zariadenie, rezim: this.logika.rezim, jazyk: this.lang });
    var slug = this.slug;
    doc.querySelectorAll('[data-pohyb-vyzva]').forEach(function (el) { el.setAttribute('data-umami-event-pohyb', slug); });
  };
  root.PohybWeb = { _jadro: jadro, sceny: sceny, TEMY: TEMY };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof window !== 'undefined' ? window : globalThis);
