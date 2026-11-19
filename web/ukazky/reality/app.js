// Reality Hradba (ukážka webu od ARLing, vymyslená realitná kancelária v Nitre).
// Úvod: žalúzie sa naklopia a vytiahnu až po dekódovaní úvodnej fotky a načítaní písma, potom sa lamely a pásy svetla
// hýbu s posunom. Ponuka: filtre (na mobile v spodnom okne), plynulé preusporiadanie, prepínač zoznam a mapa, rýchle
// hľadanie v úvode. Kalkulačka splátky, okná na volanie, lišta na mobile a stav otvorenia kancelárie.
// Detail ponuky (galéria, pôdorys) je v detail.js a načíta sa neskôr. Nič sa neodosiela, žiadne knižnice.
// Bez skriptu stránka funguje: žalúzie sú vytiahnuté, karty, mapa s odkazmi na karty, kontakty a hodiny sú v HTML.
(function () {
  'use strict';

  var NB = ' ';
  var html = document.documentElement;
  var pokojQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function pokoj() { return !!pokojQ.matches; }
  function teraz() { return window.performance && performance.now ? performance.now() : 0; }
  function $(s, k) { return (k || document).querySelector(s); }
  function $$(s, k) { return Array.prototype.slice.call((k || document).querySelectorAll(s)); }
  function mq(q) { return window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener: function () {} }; }

  // Pevná medzera za jednopísmenovými predložkami a spojkami a medzi číslom a jednotkou v textoch zo skriptu
  function nb(s) {
    var r = /(^|[\s(„])([vkszouaiVKSZOUAI]) (?=\S)/g;
    s = s.replace(r, '$1$2' + NB).replace(r, '$1$2' + NB);
    return s.replace(/(\d) (?=(€|%|m²|rokov|roky|rok|izby|izieb|km|minút)(?![a-zA-Záäčďéíĺľňóôŕšťúýž]))/g, '$1' + NB);
  }
  var FMT = {};
  function cislo(n, des) {
    des = des || 0;
    if (!FMT[des]) {
      try { FMT[des] = new Intl.NumberFormat('sk-SK', { minimumFractionDigits: des, maximumFractionDigits: des }); }
      catch (e) { FMT[des] = { format: function (x) { return x.toFixed(des).replace('.', ','); } }; }
    }
    return FMT[des].format(Number(n)).replace(/\s/g, NB);
  }
  function euro(n) { return cislo(Math.round(n)) + NB + '€'; }
  function plocha(n) { return cislo(n, n % 1 ? 1 : 0) + NB + 'm²'; }
  function tvar(n, jeden, dva, pat) { return n === 1 ? jeden : (n >= 2 && n <= 4 ? dva : pat); }
  function el(meno, attr, text) {
    var e = document.createElement(meno);
    if (attr) Object.keys(attr).forEach(function (k) { e.setAttribute(k, attr[k]); });
    if (text != null) e.textContent = text;
    return e;
  }
  function skryPopover(p) { if (p && p.hidePopover) { try { p.hidePopover(); } catch (e) {} } }

  var MAKLERI = {
    kancelaria: { nadpis: 'Zavolať do kancelárie', kto: 'Reality Hradba, Baštová 7, Nitra. Pondelok až štvrtok 9:00 až 17:30, piatok do 16:00.', mail: 'kancelaria@reality-hradba.example' },
    simona: { meno: 'Simona', dativ: 'Simone', znak: 'S', rola: 'maklérka, byty v Starom meste, na Klokočine a Dieloch', nadpis: 'Zavolať Simone', kto: 'Simona, maklérka pre byty v Starom meste, na Klokočine a Dieloch', mail: 'simona@reality-hradba.example' },
    tomas: { meno: 'Tomáš', dativ: 'Tomášovi', znak: 'T', rola: 'maklér, domy a byty na Zobore, v Dražovciach a na Chrenovej', nadpis: 'Zavolať Tomášovi', kto: 'Tomáš, maklér pre domy a byty na Zobore, v Dražovciach a na Chrenovej', mail: 'tomas@reality-hradba.example' },
    veronika: { meno: 'Veronika', dativ: 'Veronike', znak: 'V', rola: 'maklérka, novostavby a prvé bývanie', nadpis: 'Zavolať Veronike', kto: 'Veronika, maklérka pre novostavby a prvé bývanie, Čermáň a Lužianky', mail: 'veronika@reality-hradba.example' }
  };
  var KALK = { vlastne: 20, roky: 30, sadzba: 3.9 };
  function splatka(uver, sadzba, roky) {
    var r = sadzba / 100 / 12, n = roky * 12;
    if (!r) return uver / n;
    return uver * r / (1 - Math.pow(1 + r, -n));
  }

  // ---------- Úvod: písmo, fotka, žalúzie a svetlo ----------
  var hrdina = $('#hrdina');
  (function () {
    if (!hrdina) return;
    // Skript beží neskoro (pomalé zariadenie): CSS poistka už mohla text aj žalúzie ukázať, preto bez druhého pohybu
    var neskoro = teraz() > 2400;
    hrdina.classList.add('js');
    var stav = { pismo: false, foto: false, spustene: false };

    function ukazText() {
      if (stav.pismo) return;
      stav.pismo = true;
      if (neskoro || teraz() > 2500) html.classList.add('neskoro');
      html.classList.add('pismo');
      // po dobehnutí vstupu (najdlhší prvok 4 x 90 ms + 780 ms) ostane text bez animácie v koncovom stave
      setTimeout(function () { html.classList.add('uvod-hotovy'); }, 1300);
      skus();
    }
    function fotoHotova() {
      if (stav.foto) return;
      stav.foto = true;
      skus();
    }
    function skus() {
      if (stav.spustene || !stav.pismo || !stav.foto) return;
      stav.spustene = true;
      if (pokoj() || neskoro || teraz() > 3500) {
        hrdina.classList.add('otvara', 'vytiahnute', 'pokoj');
        zapniPosun();
        return;
      }
      // Dva snímky medzi pridaním tried, aby prehliadač naozaj vykreslil zatvorené žalúzie a naklopenie bolo vidieť
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          hrdina.classList.add('otvara');
          setTimeout(function () { hrdina.classList.add('vytiahnute'); }, 600);
          setTimeout(function () { hrdina.classList.add('pokoj'); zapniPosun(); }, 1750);
        });
      });
    }

    // Písmo: po načítaní nadpisového aj textového, najneskôr 1,2 s od začiatku načítania stránky
    if (pokoj() || neskoro || !(document.fonts && document.fonts.load)) ukazText();
    else {
      setTimeout(ukazText, Math.max(0, 1200 - teraz()));
      Promise.all([document.fonts.load('520 48px "Hradba Titul"'), document.fonts.load('400 16px "Hradba Text"')]).then(ukazText, ukazText);
    }
    // Fotka: až po dekódovaní obrázka, ktorý prehliadač vybral (na mobile orez na výšku), najneskôr po 4 s
    var foto = $('.okno-foto');
    function dekoduj() { (foto.decode ? foto.decode() : Promise.resolve()).then(fotoHotova, fotoHotova); }
    if (!foto) fotoHotova();
    else if (foto.complete && foto.naturalWidth) dekoduj();
    else {
      foto.addEventListener('load', dekoduj, { once: true });
      foto.addEventListener('error', fotoHotova, { once: true });
    }
    setTimeout(function () { ukazText(); fotoHotova(); }, Math.max(0, 4000 - teraz()));
  })();

  // Pri posune sa lamely žalúzií naklápajú a pásy svetla sa posúvajú (len transform, len keď je úvod alebo kapitola v obraze)
  var posunZapnuty = false;
  function zapniPosun() {
    if (posunZapnuty || pokoj() || !hrdina) return;
    posunZapnuty = true;
    var zal = $('.zaluzia', hrdina), svUvod = $('.svetlo', hrdina);
    var predat = $('#predat'), svPredat = predat ? $('.svetlo', predat) : null;
    var miery = {};
    function zmeraj() {
      var y = window.scrollY || window.pageYOffset || 0;
      var r = hrdina.getBoundingClientRect();
      miery.hTop = r.top + y; miery.hV = r.height || 1;
      if (predat) { var p = predat.getBoundingClientRect(); miery.pTop = p.top + y; miery.pV = p.height || 1; }
      miery.okno = window.innerHeight || 800;
    }
    zmeraj();
    var vidno = { h: true, p: false }, beh = false;
    function krok() {
      beh = false;
      var y = window.scrollY || window.pageYOffset || 0;
      if (vidno.h) {
        var t = Math.min(1, Math.max(0, (y - miery.hTop + 60) / miery.hV));
        if (zal) zal.style.setProperty('--naklon', (72 - 38 * t).toFixed(1));
        if (svUvod) { svUvod.style.setProperty('--posun', (t * 150).toFixed(1)); svUvod.style.opacity = (1 - .55 * t).toFixed(3); }
      }
      if (vidno.p && svPredat) {
        var u = (y + miery.okno - miery.pTop) / (miery.pV + miery.okno);
        svPredat.style.setProperty('--posun', (Math.min(1, Math.max(0, u)) * 160 - 80).toFixed(1));
      }
    }
    function naPosun() { if (!beh && (vidno.h || vidno.p)) { beh = true; requestAnimationFrame(krok); } }
    window.addEventListener('scroll', naPosun, { passive: true });
    window.addEventListener('resize', function () { zmeraj(); naPosun(); }, { passive: true });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (z) { z.forEach(function (e) { if (e.target === hrdina) vidno.h = e.isIntersecting; else vidno.p = e.isIntersecting; }); zmeraj(); naPosun(); })
        .observe(hrdina);
      if (predat) new IntersectionObserver(function (z) { vidno.p = z[0].isIntersecting; zmeraj(); naPosun(); }).observe(predat);
    } else { vidno.p = true; }
    krok();
  }

  // ---------- Hlavička po posune, lišta na mobile až po úvode ----------
  (function () {
    var hlava = $('#hlava'), pas = $('.pas');
    if (hlava && pas && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (z) { hlava.classList.toggle('posunute', !z[0].isIntersecting); }).observe(pas);
    }
    var lista = $('.lista');
    if (!lista) return;
    if (hrdina && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (z) { lista.classList.toggle('ukazana', z[0].intersectionRatio < 0.3); }, { threshold: [0, 0.3, 0.6, 1] }).observe(hrdina);
    } else lista.classList.add('ukazana');
  })();

  // ---------- Okná na volanie a menu ----------
  (function () {
    var okno = $('#okno-volat');
    if (!okno) return;
    var nadpis = $('#okno-volat-nadpis'), kto = $('#okno-volat-kto'), mail = $('#okno-volat-mail');
    $$('[data-volat]').forEach(function (b) {
      b.addEventListener('click', function () {
        var m = MAKLERI[b.getAttribute('data-volat')] || MAKLERI.kancelaria;
        nadpis.textContent = nb(m.nadpis);
        kto.textContent = nb(m.kto);
        mail.setAttribute('href', 'mailto:' + m.mail);
        if (b.closest('#okno-ocenenie')) skryPopover($('#okno-ocenenie'));
      });
    });
    var menu = $('#okno-menu');
    if (menu) $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { skryPopover(menu); }); });
  })();

  // ---------- Ponuka: filtre, poradie, mapa ----------
  var kontajner = $('#karty');
  var karty = $$('.karta', kontajner);
  var piny = $$('.pin[data-detail]');
  var prazdne = $('#prazdne');
  var stav = { izby: '', cena: Infinity, lok: '', poradie: '' };
  var CENA_MAX = 460000;

  function udaje(k) {
    return { id: +k.getAttribute('data-id'), izby: +k.getAttribute('data-izby'), cena: +k.getAttribute('data-cena'), plocha: +k.getAttribute('data-plocha'), lok: k.getAttribute('data-lok') };
  }
  function vyhovuje(u, s) {
    if (s.izby) { var i = +s.izby; if (i >= 4 ? u.izby < 4 : u.izby !== i) return false; }
    if (u.cena > s.cena) return false;
    if (s.lok && u.lok !== s.lok) return false;
    return true;
  }
  function pocetZhod(s) { return karty.filter(function (k) { return vyhovuje(udaje(k), s); }).length; }
  function textZobraz(n) { return n ? 'Zobraziť ' + n + NB + tvar(n, 'ponuku', 'ponuky', 'ponúk') : 'Zatiaľ nič, ukázať možnosti'; }

  function nastavVyplnRozsahu(r) {
    var p = (r.value - r.min) / (r.max - r.min) * 100;
    r.style.setProperty('--p', p + '%');
  }

  var fIzby = $$('input[name="f-izby"]'), fCena = $('#f-cena'), fCenaV = $('#f-cena-hodnota'), fLok = $('#f-lok'), fPoradie = $('#f-poradie');
  var vysledok = $('#vysledok'), zrusit = $('#f-zrusit'), filtre = $('#filtre'), pocetFiltrov = $('#filtre-pocet'), hotovoText = $('#f-hotovo-text');

  function textCeny(v) { return v >= CENA_MAX ? 'bez limitu' : 'do' + NB + euro(v); }

  function synchronizujOvladanie() {
    fIzby.forEach(function (r) { r.checked = r.value === stav.izby; });
    var v = isFinite(stav.cena) ? Math.min(stav.cena, CENA_MAX) : CENA_MAX;
    if (fCena) { fCena.value = v; nastavVyplnRozsahu(fCena); fCena.setAttribute('aria-valuetext', textCeny(v)); }
    if (fCenaV) fCenaV.textContent = textCeny(v);
    if (fLok) fLok.value = stav.lok;
    if (fPoradie) fPoradie.value = stav.poradie;
  }

  function aplikuj(animuj) {
    if (!kontajner) return;
    var pred = new Map();
    if (animuj && !pokoj()) karty.forEach(function (k) { if (!k.hidden && k.offsetParent) pred.set(k, k.getBoundingClientRect()); });

    var zoradene = karty.slice().sort(function (a, b) {
      var x = udaje(a), y = udaje(b);
      switch (stav.poradie) {
        case 'lacne': return x.cena - y.cena;
        case 'drahe': return y.cena - x.cena;
        case 'plocha': return y.plocha - x.plocha;
        case 'm2': return x.cena / x.plocha - y.cena / y.plocha;
        default: return x.id - y.id;
      }
    });
    var n = 0;
    zoradene.forEach(function (k) {
      kontajner.insertBefore(k, prazdne);
      var ok = vyhovuje(udaje(k), stav);
      k.hidden = !ok;
      if (ok) n++;
    });
    piny.forEach(function (p) {
      var k = $('#ponuka-' + p.getAttribute('data-detail'));
      p.hidden = !k || k.hidden;
    });
    if (prazdne) prazdne.hidden = n > 0;

    var aktivne = (stav.izby ? 1 : 0) + (isFinite(stav.cena) ? 1 : 0) + (stav.lok ? 1 : 0);
    if (vysledok) {
      vysledok.textContent = '';
      if (!aktivne) {
        vysledok.appendChild(el('strong', null, karty.length + NB + 'nehnuteľností'));
        vysledok.appendChild(document.createTextNode(' v' + NB + 'ponuke'));
      } else {
        vysledok.appendChild(document.createTextNode('Zobrazujeme '));
        vysledok.appendChild(el('strong', null, String(n)));
        vysledok.appendChild(document.createTextNode(' z' + NB + karty.length + NB + 'nehnuteľností'));
      }
    }
    if (zrusit) zrusit.hidden = !aktivne;
    if (pocetFiltrov) { pocetFiltrov.hidden = !aktivne; pocetFiltrov.textContent = String(aktivne); }
    if (hotovoText) hotovoText.textContent = textZobraz(n);

    if (animuj && !pokoj() && typeof Element.prototype.animate === 'function') {
      karty.forEach(function (k) {
        if (k.hidden || !k.offsetParent) return;
        var b = pred.get(k), a = k.getBoundingClientRect();
        if (b) {
          var dx = b.left - a.left, dy = b.top - a.top;
          if (Math.abs(dx) > 1 || Math.abs(dy) > 1) k.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.23,1,.32,1)' });
        } else {
          k.animate([{ opacity: 0, transform: 'translateY(10px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.23,1,.32,1)' });
        }
      });
    }
  }

  function vycisti() {
    stav = { izby: '', cena: Infinity, lok: '', poradie: stav.poradie };
    synchronizujOvladanie();
    aplikuj(true);
  }

  if (kontajner) {
    fIzby.forEach(function (r) { r.addEventListener('change', function () { stav.izby = r.value; aplikuj(true); }); });
    if (fCena) {
      fCena.addEventListener('input', function () {
        var v = +fCena.value;
        stav.cena = v >= CENA_MAX ? Infinity : v;
        nastavVyplnRozsahu(fCena);
        fCena.setAttribute('aria-valuetext', textCeny(v));
        if (fCenaV) fCenaV.textContent = textCeny(v);
        aplikuj(true);
      });
    }
    if (fLok) fLok.addEventListener('change', function () { stav.lok = fLok.value; aplikuj(true); });
    if (fPoradie) fPoradie.addEventListener('change', function () { stav.poradie = fPoradie.value; aplikuj(true); });
    if (zrusit) zrusit.addEventListener('click', vycisti);
    var zo = $('#f-zrusit-okno');
    if (zo) zo.addEventListener('click', vycisti);
    var pz = $('#prazdne-zrusit');
    if (pz) pz.addEventListener('click', function () {
      vycisti();
      var f = mq('(min-width: 900px)').matches ? $('.filtre input') : $('#filtre-otvor');
      if (f) f.focus();
    });

    // Karta a číslo na mape sa zvýraznia navzájom
    function zvyrazni(id, zap) {
      var k = $('#ponuka-' + id), p = $('.pin[data-detail="' + id + '"]');
      if (k) k.classList.toggle('zvyraznena', zap);
      if (p) p.classList.toggle('aktivny', zap);
    }
    karty.forEach(function (k) {
      var id = k.getAttribute('data-id');
      k.addEventListener('pointerenter', function () { zvyrazni(id, true); });
      k.addEventListener('pointerleave', function () { zvyrazni(id, false); });
      k.addEventListener('focusin', function () { zvyrazni(id, true); });
      k.addEventListener('focusout', function () { zvyrazni(id, false); });
    });
    piny.forEach(function (p) {
      var id = p.getAttribute('data-detail');
      p.addEventListener('pointerenter', function () { zvyrazni(id, true); });
      p.addEventListener('pointerleave', function () { zvyrazni(id, false); });
      p.addEventListener('focus', function () { zvyrazni(id, true); });
      p.addEventListener('blur', function () { zvyrazni(id, false); });
    });
  }

  // Filtre na mobile v spodnom okne: po otvorení fokus na izby, po „Zobraziť“ posun na výsledky; na počítači sú v riadku
  (function () {
    if (!filtre) return;
    var siroke = mq('(min-width: 900px)');
    filtre.addEventListener('toggle', function (e) {
      if (e.newState !== 'open') return;
      var prvy = $('input[name="f-izby"]:checked', filtre) || $('input', filtre);
      if (prvy) setTimeout(function () { prvy.focus({ preventScroll: true }); }, 30);
    });
    var hotovo = $('#f-hotovo');
    if (hotovo) hotovo.addEventListener('click', function () {
      var ciel = $('.vysledok-riadok');
      if (ciel) setTimeout(function () { ciel.scrollIntoView({ behavior: pokoj() ? 'auto' : 'smooth', block: 'start' }); }, 60);
    });
    var zmena = function () { if (siroke.matches) skryPopover(filtre); };
    if (siroke.addEventListener) siroke.addEventListener('change', zmena); else if (siroke.addListener) siroke.addListener(zmena);
  })();

  // Prepínač Zoznam a Mapa (do 1 099 px; na širšom okne sú vedľa seba)
  (function () {
    var mriezka = $('#ponuka-mriezka'), bZ = $('#pohlad-zoznam'), bM = $('#pohlad-mapa');
    if (!mriezka || !bZ || !bM) return;
    function pohlad(mapa) {
      mriezka.classList.toggle('ukaz-mapu', mapa);
      bZ.setAttribute('aria-pressed', String(!mapa));
      bM.setAttribute('aria-pressed', String(mapa));
    }
    bZ.addEventListener('click', function () { pohlad(false); });
    bM.addEventListener('click', function () { pohlad(true); });
  })();

  // ---------- Rýchle hľadanie v úvode ----------
  (function () {
    var hIzby = $$('input[name="h-izby"]'), tlac = $('#h-zobraz'), text = $('#h-zobraz-text');
    if (!tlac) return;
    function hStav() {
      var iz = ''; hIzby.forEach(function (r) { if (r.checked) iz = r.value; });
      return { izby: iz, cena: stav.cena, lok: stav.lok, poradie: stav.poradie };
    }
    function obnov() { text.textContent = textZobraz(pocetZhod(hStav())); }
    hIzby.forEach(function (r) { r.addEventListener('change', obnov); });
    tlac.addEventListener('click', function () {
      stav = hStav();
      synchronizujOvladanie();
      aplikuj(false);
      var ciel = $('#ponuka');
      if (ciel) ciel.scrollIntoView({ behavior: pokoj() ? 'auto' : 'smooth', block: 'start' });
      if (vysledok) { vysledok.setAttribute('tabindex', '-1'); setTimeout(function () { vysledok.focus({ preventScroll: true }); }, pokoj() ? 0 : 450); }
    });
  })();

  // ---------- Detail ponuky: kód a údaje sú v detail.js, načíta sa pri prvom otvorení alebo v nečinnosti ----------
  window.Hradba = { NB: NB, nb: nb, cislo: cislo, euro: euro, plocha: plocha, el: el, $: $, $$: $$, pokoj: pokoj, udaje: udaje, karty: karty, MAKLERI: MAKLERI, KALK: KALK, splatka: splatka };
  var detailSlub = null;
  function nacitajDetail() {
    if (window.HradbaDetail) return Promise.resolve(window.HradbaDetail);
    if (detailSlub) return detailSlub;
    detailSlub = new Promise(function (ok, chyba) {
      var sc = document.createElement('script');
      sc.src = 'detail.js';
      sc.async = true;
      sc.addEventListener('load', function () { if (window.HradbaDetail) ok(window.HradbaDetail); else chyba(new Error('detail')); });
      sc.addEventListener('error', function () { detailSlub = null; chyba(new Error('detail')); });
      document.head.appendChild(sc);
    });
    return detailSlub;
  }
  var dlg = $('#detail');
  var dialogIde = !!(dlg && typeof dlg.showModal === 'function');
  $$('[data-detail]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (!dialogIde) return;
      e.preventDefault();
      var id = +a.getAttribute('data-detail');
      nacitajDetail().then(function (D) { D.otvor(id, a); }).catch(function () {
        var k = $('#ponuka-' + id);
        if (k) k.scrollIntoView({ block: 'center' });
      });
    });
  });
  var neskor = window.requestIdleCallback || function (f) { return setTimeout(f, 300); };
  window.addEventListener('load', function () {
    neskor(function () { if (dialogIde) nacitajDetail().catch(function () {}); }, { timeout: 4000 });
  });

  // ---------- Kalkulačka ----------
  (function () {
    var f = $('#kalkulacka');
    if (!f) return;
    var kCena = $('#k-cena'), kVl = $('#k-vlastne'), kRoky = $('#k-roky'), kSadzba = $('#k-sadzba');
    f.addEventListener('submit', function (e) { e.preventDefault(); });
    function prepocitaj() {
      var cena = +kCena.value, vl = +kVl.value, roky = +kRoky.value, sadzba = +kSadzba.value;
      var uver = cena * (1 - vl / 100);
      var mes = splatka(uver, sadzba, roky), spolu = mes * roky * 12, uroky = spolu - uver;
      var tCena = euro(cena), tVl = vl + NB + '%, ' + euro(cena * vl / 100);
      var tRoky = roky + NB + tvar(roky, 'rok', 'roky', 'rokov');
      var tSadzba = cislo(sadzba, 1) + NB + '% ročne';
      $('#k-cena-v').textContent = tCena; kCena.setAttribute('aria-valuetext', tCena);
      $('#k-vlastne-v').textContent = tVl; kVl.setAttribute('aria-valuetext', tVl);
      $('#k-roky-v').textContent = tRoky; kRoky.setAttribute('aria-valuetext', tRoky);
      $('#k-sadzba-v').textContent = tSadzba; kSadzba.setAttribute('aria-valuetext', tSadzba);
      $('#k-splatka').textContent = cislo(Math.round(mes));
      $('#k-uver').textContent = euro(uver);
      $('#k-spolu').textContent = euro(spolu);
      $('#k-uroky').textContent = euro(uroky);
      $('#k-pomer').style.width = (uver / spolu * 100).toFixed(1) + '%';
      [kCena, kVl, kRoky, kSadzba].forEach(nastavVyplnRozsahu);
    }
    [kCena, kVl, kRoky, kSadzba].forEach(function (r) { r.addEventListener('input', prepocitaj); });
  })();

  // ---------- Stav otvorenia kancelárie podľa času v Bratislave (v nečinnosti) ----------
  neskor(function () {
    var riadky = $$('.hodiny [data-den]');
    var box = $('#stav');
    if (!riadky.length || !box) return;
    var cas;
    try {
      var casti = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bratislava', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
      var mapa = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }, pp = {};
      casti.forEach(function (c) { pp[c.type] = c.value; });
      cas = { den: mapa[pp.weekday], min: parseInt(pp.hour, 10) * 60 + parseInt(pp.minute, 10) };
    } catch (e) {
      var d = new Date(); cas = { den: d.getDay(), min: d.getHours() * 60 + d.getMinutes() };
    }
    var dni = {};
    riadky.forEach(function (r) { dni[r.getAttribute('data-den')] = { od: r.getAttribute('data-od'), do: r.getAttribute('data-do'), r: r }; });
    function naMin(t) { var x = t.split(':'); return parseInt(x[0], 10) * 60 + parseInt(x[1], 10); }
    var vDen = ['v nedeľu', 'v pondelok', 'v utorok', 'v stredu', 'vo štvrtok', 'v piatok', 'v sobotu'];
    var dnes = dni[String(cas.den)];
    if (dnes) {
      dnes.r.classList.add('dnes');
      var z = $('.znacka-dnes', dnes.r); if (z) z.hidden = false;
    }
    var text, otvorene = false;
    if (dnes && dnes.od && cas.min < naMin(dnes.od)) text = 'Dnes otvárame o ' + dnes.od;
    else if (dnes && dnes.od && cas.min < naMin(dnes.do)) { text = 'Teraz otvorené, dnes do ' + dnes.do; otvorene = true; }
    else {
      for (var i = 1; i <= 7; i++) {
        var k = (cas.den + i) % 7, dalsi = dni[String(k)];
        if (dalsi && dalsi.od) {
          text = (dnes && dnes.od ? 'Dnes už zatvorené. ' : 'Dnes zatvorené. ') + 'Otvárame ' + (i === 1 ? 'zajtra' : vDen[k]) + ' o ' + dalsi.od;
          break;
        }
      }
    }
    if (text) {
      $('.stav-text', box).textContent = nb(text);
      box.classList.toggle('zatvorene', !otvorene);
      box.hidden = false;
    }
  }, { timeout: 2000 });
})();
