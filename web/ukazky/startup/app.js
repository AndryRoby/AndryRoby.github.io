// Rozsvit (ukážka webu od ARLing, vymyslená firma): živý rozpis smien, svetlo podľa pokrytia a drobné interakcie stránky.
// Všetko beží len v tejto stránke, nič sa neukladá ani neodosiela. Bez skriptu ostáva statický rozpis, funkčný cenník
// (prepínač mesačne a ročne je čisté CSS), otázky aj dialógy.
// Rozpis: v týždni smenu presunie potiahnutie myšou, ťuknutie na smenu a potom na políčko, alebo klávesnica (šípky, Enter,
// Escape); v dni ťuknutie na smenu otvorí výber človeka. Rozsvit stráži dostupnosť (voľno, nemôže), zaškolenie a hodiny
// v zmluve a prepočíta pokrytie týždňa. Pokrytie riadi svetlo nad oknom: celý týždeň pokrytý je východ slnka (--svit 1),
// chýbajúca smena slnko stiahne pod obzor a nechá jantárovú hmlu (--hmla), Navrhnúť týždeň ho znova vytiahne.
// Úvodné skladanie sa spustí, až keď je z okna v obraze aspoň 35 % (do vtedy drží CSS noc, pozri index.html, Pohyb);
// ak skript príde neskoro a okno už ukazuje CSS poistka, skript ju len nechá dobehnúť.
(function () {
  'use strict';
  var doc = document;
  var html = doc.documentElement;
  html.classList.add('js');

  var NB = ' ';
  var mm = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false }; };
  var mqPohyb = mm('(prefers-reduced-motion: reduce)');
  var pohybOK = !mqPohyb.matches;
  if (mqPohyb.addEventListener) mqPohyb.addEventListener('change', function (e) { pohybOK = !e.matches; });
  var mqDotyk = mm('(hover: none), (pointer: coarse)');

  var DNI = ['pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota', 'nedeľa'];
  var V_DNI = ['v' + NB + 'pondelok', 'v' + NB + 'utorok', 'v' + NB + 'stredu', 'vo' + NB + 'štvrtok', 'v' + NB + 'piatok', 'v' + NB + 'sobotu', 'v' + NB + 'nedeľu'];
  var ROLY = { bar: 'bar', kuchyna: 'kuchyňa', sala: 'sála' };
  var ROLY_AKUZ = { bar: 'bar', kuchyna: 'kuchyňu', sala: 'sálu' };
  var MESIACE = ['januára', 'februára', 'marca', 'apríla', 'mája', 'júna', 'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra'];

  function cas(h) { return h + ':00'; }
  function obmedz(x, a, b) { return Math.max(a, Math.min(b, x)); }

  // Čas a dátum podľa Bratislavy
  function terazBA() {
    try {
      var p = {};
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date()).forEach(function (c) { p[c.type] = c.value; });
      var den = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[p.weekday];
      return { r: +p.year, m: +p.month - 1, d: +p.day, den: den, min: (+p.hour) * 60 + (+p.minute) };
    } catch (e) {
      var x = new Date();
      return { r: x.getFullYear(), m: x.getMonth(), d: x.getDate(), den: (x.getDay() + 6) % 7, min: x.getHours() * 60 + x.getMinutes() };
    }
  }
  var dnes = terazBA();
  var pondelok = Date.UTC(dnes.r, dnes.m, dnes.d - dnes.den);
  function datum(i) { var x = new Date(pondelok + i * 864e5); return { d: x.getUTCDate(), m: x.getUTCMonth() }; }

  doc.querySelectorAll('[data-datum]').forEach(function (el) { el.textContent = datum(+el.getAttribute('data-datum')).d + '.'; });
  var prvy = datum(0), posledny = datum(6);
  var tyzdenText = prvy.m === posledny.m
    ? prvy.d + '.' + NB + 'až ' + posledny.d + '.' + NB + MESIACE[posledny.m]
    : prvy.d + '.' + NB + MESIACE[prvy.m] + ' až ' + posledny.d + '.' + NB + MESIACE[posledny.m];
  doc.querySelectorAll('[data-tyzden]').forEach(function (el) { el.textContent = tyzdenText; });

  var hlava = doc.querySelector('.hlava');

  // ---------------------------------------------------------------- rozpis
  var uvod = doc.querySelector('.uvod');
  var app = doc.getElementById('rozpis');
  var tabulka = doc.getElementById('tyzden');
  if (uvod && app && tabulka) rozpis();

  function rozpis() {
    var riadky = [].slice.call(tabulka.tBodies[0].rows);
    var ludia = riadky.map(function (tr) {
      return { id: tr.getAttribute('data-osoba'), meno: tr.getAttribute('data-meno'), zrucnosti: tr.getAttribute('data-zrucnosti').split(' '), zmluva: +tr.getAttribute('data-zmluva') };
    });
    function idx(id) { for (var i = 0; i < ludia.length; i++) if (ludia[i].id === id) return i; return -1; }
    function bunka(o, d) { return riadky[o].cells[d + 1]; }
    function smenaV(td) { return td ? td.querySelector('.smena') : null; }
    function poloha(s) { var td = s.parentNode; return { o: riadky.indexOf(td.parentNode), d: +td.getAttribute('data-den'), td: td }; }
    function dlzka(s) { return +s.getAttribute('data-do') - +s.getAttribute('data-od'); }
    function kluc(s) { return s.getAttribute('data-rola') + '-' + s.getAttribute('data-od'); }
    function smeny() { return [].slice.call(tabulka.querySelectorAll('.smena')); }
    function casy(s) { return cas(s.getAttribute('data-od')) + ' až ' + cas(s.getAttribute('data-do')); }
    function popis(s) { var p = poloha(s); return ludia[p.o].meno + ', ' + DNI[p.d] + ', ' + ROLY[s.getAttribute('data-rola')] + ', ' + casy(s); }
    // meno tlačidla smeny začína viditeľným textom („7:00 do 15:00“), potom človek, deň a práca (WCAG 2.5.3)
    function stitok(s) { var p = poloha(s); return cas(s.getAttribute('data-od')) + ' do ' + cas(s.getAttribute('data-do')) + ', ' + ludia[p.o].meno + ', ' + DNI[p.d] + ', ' + ROLY[s.getAttribute('data-rola')]; }
    function obnovStitok(s) { s.setAttribute('aria-label', stitok(s)); }
    function hodiny(o) { var h = 0; riadky[o].querySelectorAll('.smena').forEach(function (s) { h += dlzka(s); }); return h; }

    // dnešný deň v tabuľke a v pohľade na deň
    var thDnes = tabulka.querySelector('thead th[data-den="' + dnes.den + '"]');
    if (thDnes) thDnes.classList.add('dnes');
    tabulka.querySelectorAll('td[data-den="' + dnes.den + '"]').forEach(function (td) { td.classList.add('dnes'); });

    // návrh (z neho sa počíta, čo treba pokryť) a pôvodné miesta smien
    var plan = {};
    var potreba = [];
    for (var d0 = 0; d0 < 7; d0++) potreba.push({});
    smeny().forEach(function (s) {
      var p = poloha(s);
      plan[s.getAttribute('data-id')] = { o: p.o, d: p.d };
      potreba[p.d][kluc(s)] = (potreba[p.d][kluc(s)] || 0) + 1;
    });

    // jedno miesto v poradí tabulátora, šípky prechádzajú medzi smenami
    var aktivna = smeny()[0];
    smeny().forEach(function (s) { s.tabIndex = s === aktivna ? 0 : -1; });
    function nastavAktivnu(s) { if (aktivna && aktivna !== s) aktivna.tabIndex = -1; aktivna = s; s.tabIndex = 0; }

    // hlásenia: posledné slovo sa nezalomí samo na nový riadok
    var spravaEl = app.querySelector('.app-sprava');
    function sprava(text, typ, bezPohybu) {
      spravaEl.className = 'app-sprava' + (typ ? ' ' + typ : '');
      spravaEl.textContent = text.replace(/ (\S+)$/, NB + '$1');
      if (pohybOK && !bezPohybu) { void spravaEl.offsetWidth; spravaEl.classList.add('nova'); }
    }

    var pokrytieEl = app.querySelector('.pokrytie');
    var pokrytieCislo = app.querySelector('[data-pokrytie]');
    var pokrytiePruh = app.querySelector('.pokrytie-pruh i');
    var nadcasEl = app.querySelector('[data-nadcas]');
    var spoluEl = app.querySelector('[data-spolu]');
    var stav = { pokryte: 0, treba: 0 };

    // svetlo nad oknom podľa pokrytia; každé nastavenie má poradové číslo, odložený krok so starým číslom nič neprepíše
    var svitVerzia = 0, tSvit = 0;
    function svetlo(r) {
      var chyba = r.treba - r.pokryte;
      if (chyba > 0) return { svit: Math.max(0.16, 0.5 - (chyba - 1) * 0.12), hmla: 1 };
      return r.nad.length ? { svit: 0.84, hmla: 0.55 } : { svit: 1, hmla: 0 };
    }
    function nastavSvetlo(l, rezim) {
      svitVerzia++;
      clearTimeout(tSvit);
      uvod.classList.remove('svit-rychlo', 'svit-pomaly');
      if (rezim) uvod.classList.add('svit-' + rezim);
      uvod.style.setProperty('--svit', l.svit.toFixed(2));
      uvod.style.setProperty('--hmla', l.hmla.toFixed(2));
    }

    function pokrytieText(n) { pokrytieCislo.textContent = n + ' z' + NB + stav.treba + NB + 'smien'; }

    function prepocitaj(bezSvetla) {
      var spolu = 0, nad = [];
      riadky.forEach(function (tr, o) {
        var h = hodiny(o);
        spolu += h;
        var l = ludia[o];
        tr.querySelector('.osoba-hodiny').textContent = h + NB + 'h z' + NB + l.zmluva;
        tr.querySelector('.osoba-pruh i').style.setProperty('--p', Math.min(1, h / l.zmluva).toFixed(3));
        var je = h > l.zmluva;
        tr.classList.toggle('nad', je);
        if (je) nad.push(l.meno + ' ' + h + NB + 'h');
      });
      var mame = [];
      for (var d = 0; d < 7; d++) mame.push({});
      smeny().forEach(function (s) { var p = poloha(s); mame[p.d][kluc(s)] = (mame[p.d][kluc(s)] || 0) + 1; });
      var treba = 0, pokryte = 0, chyba = null;
      for (var dd = 0; dd < 7; dd++) {
        var chybaDna = false;
        for (var k in potreba[dd]) {
          treba += potreba[dd][k];
          var x = Math.min(potreba[dd][k], mame[dd][k] || 0);
          pokryte += x;
          if (x < potreba[dd][k]) { chybaDna = true; if (!chyba) chyba = { d: dd, k: k }; }
        }
        var th = tabulka.querySelector('thead th[data-den="' + dd + '"]');
        if (th) th.classList.toggle('chyba', chybaDna);
      }
      stav.pokryte = pokryte; stav.treba = treba;
      if (vstup !== 'bezi') pokrytieText(pokryte);
      pokrytiePruh.style.setProperty('--p', (pokryte / treba).toFixed(3));
      pokrytieEl.classList.toggle('neuplne', pokryte < treba);
      nadcasEl.textContent = nad.length ? nad.join(', ') : 'nikto';
      spoluEl.textContent = spolu + NB + 'h';
      var r = { chyba: chyba, nad: nad, pokryte: pokryte, treba: treba };
      if (!bezSvetla) nastavSvetlo(svetlo(r));
      return r;
    }

    function textChyby(ch) {
      var r = ch.k.split('-');
      return 'Chýba ' + V_DNI[ch.d] + ' ' + ROLY[r[0]] + ' od' + NB + cas(r[1]) + '.';
    }

    // Dá sa smena položiť do bunky? Vráti stav a dôvod.
    function skus(s, ciel) {
      var z = poloha(s);
      var c = { o: riadky.indexOf(ciel.parentNode), d: +ciel.getAttribute('data-den') };
      if (z.td === ciel) return { stav: 'nic' };
      var oc = ludia[c.o], oz = ludia[z.o];
      if (ciel.classList.contains('volno')) {
        return { stav: 'zle', dovod: ciel.getAttribute('data-volno') === 'Voľno' ? oc.meno + ' má ' + V_DNI[c.d] + ' voľno.' : oc.meno + ' ' + V_DNI[c.d] + ' nemôže.' };
      }
      if (oc.zrucnosti.indexOf(s.getAttribute('data-rola')) < 0) {
        return { stav: 'zle', dovod: oc.meno + ' nerobí ' + ROLY_AKUZ[s.getAttribute('data-rola')] + '.' };
      }
      var tam = smenaV(ciel);
      if (tam) {
        if (oz.zrucnosti.indexOf(tam.getAttribute('data-rola')) < 0) {
          return { stav: 'zle', dovod: 'Výmena nejde, ' + oz.meno + ' nerobí ' + ROLY_AKUZ[tam.getAttribute('data-rola')] + '.', vymena: true };
        }
        return { stav: 'vymena', tam: tam };
      }
      return { stav: 'presun' };
    }

    // FLIP: prvky preletia z pôvodného miesta (alebo z miesta ducha pri ťahaní) na nové
    function flip(prvky, akcia, zaciatky) {
      var pred = prvky.map(function (el, i) { return (zaciatky && zaciatky[i]) || el.getBoundingClientRect(); });
      if (akcia) akcia();
      if (!pohybOK) return;
      prvky.forEach(function (el, i) {
        var po = el.getBoundingClientRect();
        var dx = pred[i].left - po.left, dy = pred[i].top - po.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        el.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'translate(0,0)' }],
          { duration: 420, easing: 'cubic-bezier(.34,1.32,.5,1)' });
      });
    }

    function zatras(el) {
      if (!pohybOK || !el.animate) return;
      el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }],
        { duration: 360, easing: 'ease-out' });
    }

    // ---------- úvodné skladanie: noc, okno vyjde spoza obzoru, smeny sa poskladajú a s pokrytím vyjde slnko
    var vstup = 'hotovo', tVstup = 0;
    function koniecVstupu() {
      clearTimeout(tVstup);
      uvod.classList.remove('sklada', 'odlozene');
      uvod.classList.add('hotovo');
      vstup = 'hotovo';
      pokrytieText(stav.pokryte);
    }
    function zacniVstup() {
      if (vstup !== 'pred' && vstup !== 'caka') return;
      vstup = 'bezi';
      uvod.classList.remove('odlozene');
      uvod.classList.add('sklada');
      // počítadlo pokrytia ide od 0 spolu s pristávaním smien (prvá pristane asi o 0,8 s, ďalšie po 34 ms)
      var t0 = performance.now();
      var krok = function (t) {
        if (vstup !== 'bezi') return;
        var n = obmedz(Math.floor((t - t0 - 760) / 34) + 1, 0, stav.pokryte);
        pokrytieText(n);
        if (n < stav.pokryte) requestAnimationFrame(krok);
      };
      requestAnimationFrame(krok);
      tVstup = setTimeout(koniecVstupu, 3200);
    }
    function vidnoCast(el) {
      var r = el.getBoundingClientRect();
      if (!r.height) return 0;
      return Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top)) / r.height;
    }
    // meria sa scéna (rovnako veľká ako okno, ale bez úvodného naklonenia), nie samotné okno
    var scena = app.parentNode;
    var cssNoc = mm('(scripting: enabled)').matches;
    // pomalé zariadenie: ak už okno ukazuje CSS poistka (skript prišiel neskoro), nechať ju dobehnúť a potom pokoj
    var poistkaBezi = cssNoc && pohybOK && parseFloat(getComputedStyle(app).opacity) > 0.01;
    if (!pohybOK || !cssNoc) {
      koniecVstupu();
    } else if (poistkaBezi) {
      vstup = 'poistka';
      tVstup = setTimeout(koniecVstupu, 2300);
    } else {
      vstup = 'pred';
      if (vidnoCast(scena) >= 0.35) zacniVstup();
      else if ('IntersectionObserver' in window) {
        vstup = 'caka';
        uvod.classList.add('odlozene');
        var ioApp = new IntersectionObserver(function (z) {
          if (z[0].intersectionRatio >= 0.34) { ioApp.disconnect(); zacniVstup(); }
        }, { threshold: [0, 0.35, 0.6] });
        ioApp.observe(scena);
        app.addEventListener('focusin', function () { if (vstup === 'caka') { ioApp.disconnect(); zacniVstup(); } });
      } else koniecVstupu();
    }
    function dobehni() { if (vstup !== 'hotovo') koniecVstupu(); }

    // Navrhnúť týždeň: vlna smien znova
    var tVlna = 0;
    function vlna() {
      if (!pohybOK) return;
      app.classList.remove('vlna');
      void app.offsetWidth;
      app.classList.add('vlna');
      clearTimeout(tVlna);
      tVlna = setTimeout(function () { app.classList.remove('vlna'); }, 2500);
    }

    function poloz(s, ciel, odRect) {
      dobehni();
      var v = skus(s, ciel);
      if (v.stav === 'nic') {
        if (odRect) flip([s], null, [odRect]);
        return;
      }
      if (v.stav === 'zle') {
        if (odRect) flip([s], null, [odRect]);
        ciel.classList.add('ciel-zle');
        setTimeout(function () { ciel.classList.remove('ciel-zle'); }, 650);
        zatras(s);
        sprava(v.dovod + ' Smena ostala na mieste.', 'zle');
        return;
      }
      var z = poloha(s);
      var msg;
      if (v.stav === 'presun') {
        flip([s], function () { ciel.appendChild(s); }, odRect ? [odRect] : null);
        var p = poloha(s);
        msg = 'Presunuté: ' + ludia[p.o].meno + ' ' + V_DNI[p.d] + ' ' + casy(s) + '.';
      } else {
        var tam = v.tam;
        flip([s, tam], function () { ciel.appendChild(s); z.td.appendChild(tam); }, odRect ? [odRect, null] : null);
        obnovStitok(tam);
        var ps = poloha(s), pt = poloha(tam);
        msg = ps.o === pt.o
          ? 'Vymenené: ' + ludia[ps.o].meno + ', smeny ' + V_DNI[pt.d] + ' a' + NB + V_DNI[ps.d] + '.'
          : ps.d === pt.d
            ? 'Vymenené ' + V_DNI[ps.d] + ': ' + ludia[ps.o].meno + ' a' + NB + ludia[pt.o].meno + '.'
            : 'Vymenené: ' + ludia[ps.o].meno + ' ' + V_DNI[ps.d] + ', ' + ludia[pt.o].meno + ' ' + V_DNI[pt.d] + '.';
      }
      obnovStitok(s);
      var r = prepocitaj();
      var typ = 'ok';
      if (r.nad.length) { msg += ' Nad zmluvu: ' + r.nad.join(', ') + '.'; typ = 'pozor'; }
      if (r.chyba) { msg += ' ' + textChyby(r.chyba); typ = 'pozor'; }
      sprava(msg, typ);
      if (denViditelny()) vykresliDen();
    }

    // výber ťuknutím alebo klávesnicou (týždeň)
    var vybrana = null, cielKl = null, potlacKlikDo = 0;
    function vycistiCiel() {
      tabulka.querySelectorAll('td.ciel, td.ciel-zle').forEach(function (td) { td.classList.remove('ciel', 'ciel-zle'); });
      cielKl = null;
    }
    function vyber(s, klavesnica) {
      zrus();
      vybrana = s;
      s.classList.add('zdvihnuta');
      s.setAttribute('aria-pressed', 'true');
      tabulka.classList.add('vyber');
      sprava('Vybraná smena: ' + popis(s) + '. ' + (klavesnica
        ? 'Šípkami vyberte nové miesto, Enter ju položí, Escape ju vráti.'
        : 'Ťuknite na políčko, kam ju chcete dať. Ťuknutím na ňu výber zrušíte.'), '');
    }
    function zrus() {
      if (vybrana) { vybrana.classList.remove('zdvihnuta'); vybrana.removeAttribute('aria-pressed'); }
      vybrana = null;
      tabulka.classList.remove('vyber');
      vycistiCiel();
    }
    function nastavCiel(n) {
      vycistiCiel();
      cielKl = n;
      var td = bunka(n.o, n.d);
      var v = skus(vybrana, td);
      td.classList.add(v.stav === 'zle' ? 'ciel-zle' : 'ciel');
      var kde = ludia[n.o].meno + ', ' + DNI[n.d] + ': ';
      var t = v.stav === 'nic' ? 'pôvodné miesto.' : v.stav === 'presun' ? 'voľné políčko, Enter sem smenu presunie.'
        : v.stav === 'vymena' ? 'obsadené, Enter smeny vymení.' : 'sem nie. ' + v.dovod;
      sprava(kde + t, v.stav === 'zle' ? 'zle' : '');
    }

    tabulka.addEventListener('click', function (e) {
      if (performance.now() < potlacKlikDo) return;
      var td = e.target.closest('td[data-den]');
      var s = e.target.closest('.smena');
      if (vybrana) {
        if (s === vybrana) { zrus(); sprava('Výber zrušený, smena ostala na mieste.', ''); return; }
        if (!td) return;
        var v = vybrana;
        var test = skus(v, td);
        if (test.stav === 'zle') {
          td.classList.add('ciel-zle');
          setTimeout(function () { td.classList.remove('ciel-zle'); }, 650);
          zatras(v);
          sprava(test.dovod + ' Vyberte iné políčko.', 'zle');
          return;
        }
        zrus();
        poloz(v, td);
        nastavAktivnu(v);
        return;
      }
      if (s) { dobehni(); nastavAktivnu(s); vyber(s, e.detail === 0); }
    });

    function susedna(s, dx, dy) {
      var p = poloha(s), x;
      if (dx) {
        for (var d = p.d + dx; d >= 0 && d < 7; d += dx) { x = smenaV(bunka(p.o, d)); if (x) return x; }
        return null;
      }
      for (var o = p.o + dy; o >= 0 && o < riadky.length; o += dy) {
        x = smenaV(bunka(o, p.d));
        if (x) return x;
        var naj = null, vzd = 9;
        for (var d2 = 0; d2 < 7; d2++) { var y = smenaV(bunka(o, d2)); if (y && Math.abs(d2 - p.d) < vzd) { vzd = Math.abs(d2 - p.d); naj = y; } }
        if (naj) return naj;
      }
      return null;
    }

    tabulka.addEventListener('keydown', function (e) {
      var s = e.target.closest ? e.target.closest('.smena') : null;
      if (!s) return;
      var k = e.key;
      if (vybrana === s && cielKl && (k === 'Enter' || k === ' ')) {
        e.preventDefault();
        potlacKlikDo = performance.now() + 500;
        var td = bunka(cielKl.o, cielKl.d);
        var test = skus(s, td);
        if (test.stav === 'zle') { zatras(s); sprava(test.dovod + ' Vyberte iné miesto.', 'zle'); return; }
        zrus();
        poloz(s, td);
        s.focus();
        return;
      }
      if (k === 'Escape' && vybrana) {
        e.preventDefault();
        var v = vybrana; zrus(); v.focus();
        sprava('Presun zrušený, smena ostala na mieste.', '');
        return;
      }
      if (k.indexOf('Arrow') === 0) {
        e.preventDefault();
        var dx = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0;
        var dy = k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0;
        if (vybrana === s) {
          var p = cielKl || poloha(s);
          nastavCiel({ o: obmedz(p.o + dy, 0, riadky.length - 1), d: obmedz(p.d + dx, 0, 6) });
          return;
        }
        var n = susedna(s, dx, dy);
        if (n) { nastavAktivnu(n); n.focus(); }
      }
    });
    tabulka.addEventListener('focusout', function (e) {
      if (vybrana && e.target === vybrana && cielKl && !tabulka.contains(e.relatedTarget)) { zrus(); }
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && vybrana && !tabulka.contains(doc.activeElement)) { zrus(); sprava('Výber zrušený.', ''); }
    });

    // ťahanie myšou alebo perom (dotyk používa ťuknutie, aby sa dalo posúvať stránkou)
    var tah = null;
    tabulka.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      var s = e.target.closest('.smena');
      if (!s) return;
      tah = { s: s, id: e.pointerId, x0: e.clientX, y0: e.clientY, ide: false, ciel: null, duch: null };
      try { s.setPointerCapture(e.pointerId); } catch (err) { /* bez zachytenia to tiež funguje */ }
    });
    function zacniTah() {
      tah.ide = true;
      zrus();
      dobehni();
      var r = tah.s.getBoundingClientRect();
      var d = tah.s.cloneNode(true);
      d.removeAttribute('aria-label'); d.removeAttribute('data-id'); d.removeAttribute('style');
      d.setAttribute('aria-hidden', 'true'); d.tabIndex = -1;
      d.classList.add('smena-duch');
      d.style.left = r.left + 'px'; d.style.top = r.top + 'px'; d.style.width = r.width + 'px'; d.style.height = r.height + 'px';
      doc.body.appendChild(d);
      tah.duch = d;
      tah.s.classList.add('tiahne');
      html.classList.add('tiahnutie');
    }
    tabulka.addEventListener('pointermove', function (e) {
      if (!tah || e.pointerId !== tah.id) return;
      var dx = e.clientX - tah.x0, dy = e.clientY - tah.y0;
      if (!tah.ide) { if (dx * dx + dy * dy < 36) return; zacniTah(); }
      tah.duch.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(1.5deg) scale(1.04)';
      var el = doc.elementFromPoint(e.clientX, e.clientY);
      var td = el && el.closest ? el.closest('td[data-den]') : null;
      if (td && !tabulka.contains(td)) td = null;
      if (td !== tah.ciel) {
        if (tah.ciel) tah.ciel.classList.remove('ciel', 'ciel-zle');
        tah.ciel = td;
        if (td) td.classList.add(skus(tah.s, td).stav === 'zle' ? 'ciel-zle' : 'ciel');
      }
    });
    function koniecTahu(e, zrusene) {
      if (!tah || e.pointerId !== tah.id) return;
      var t = tah; tah = null;
      if (!t.ide) return;
      potlacKlikDo = performance.now() + 400;
      var rDuch = t.duch.getBoundingClientRect();
      t.duch.remove();
      t.s.classList.remove('tiahne');
      html.classList.remove('tiahnutie');
      if (t.ciel) t.ciel.classList.remove('ciel', 'ciel-zle');
      nastavAktivnu(t.s);
      if (zrusene || !t.ciel) { flip([t.s], null, [rDuch]); sprava('Smena ostala na mieste.', ''); return; }
      poloz(t.s, t.ciel, rDuch);
    }
    tabulka.addEventListener('pointerup', function (e) { koniecTahu(e, false); });
    tabulka.addEventListener('pointercancel', function (e) { koniecTahu(e, true); });
    tabulka.addEventListener('lostpointercapture', function (e) { if (tah && tah.ide && e.pointerId === tah.id) koniecTahu(e, !tah.ciel); });

    // ---------- tlačidlá okna
    app.querySelector('[data-akcia="navrhnut"]').addEventListener('click', function () {
      zrus();
      zavriVyber(false);
      dobehni();
      // všetky smeny von a späť na miesta z návrhu (návrh nikdy nemá smenu v bunke s voľnom)
      var vsetky = smeny();
      vsetky.forEach(function (s) { s.parentNode.removeChild(s); });
      vsetky.forEach(function (s) {
        var p = plan[s.getAttribute('data-id')];
        bunka(p.o, p.d).appendChild(s);
        obnovStitok(s);
      });
      var r = prepocitaj(true);
      if (pohybOK) {
        // slnko na chvíľu klesne a s vlnou smien znova vyjde
        nastavSvetlo({ svit: 0.3, hmla: 0 }, 'rychlo');
        var v = svitVerzia;
        tSvit = setTimeout(function () { if (v === svitVerzia) nastavSvetlo(svetlo(prepocitaj(true)), 'pomaly'); }, 380);
      } else nastavSvetlo(svetlo(r));
      vlna();
      sprava('Navrhnuté: ' + smeny().length + ' smien, ' + (r.chyba ? textChyby(r.chyba).toLowerCase() : 'všetko pokryté') + ', ' +
        (r.nad.length ? 'nad zmluvu ' + r.nad.join(', ') : 'nikto nad zmluvu') + '.', r.chyba || r.nad.length ? 'pozor' : 'ok');
      if (denViditelny()) vykresliDen();
    });
    app.querySelector('[data-akcia="zverejnit"]').addEventListener('click', function () {
      zrus();
      zavriVyber(false);
      dobehni();
      var r = prepocitaj();
      if (r.chyba) { sprava('Rozpis ešte nie je kompletný. ' + textChyby(r.chyba) + ' V ukážke sa aj tak nič neodošle.', 'pozor'); return; }
      sprava('Ukážka: v Rozsvite by teraz každý zo ' + ludia.length + ' ľudí dostal svoje smeny do mobilu. Nič sa neodoslalo.', 'ok');
    });

    // ---------- žiadosti v bočnom paneli
    var pocetEl = app.querySelector('[data-pocet]');
    app.querySelectorAll('.ziadost').forEach(function (z) {
      z.addEventListener('click', function (e) {
        var b = e.target.closest('[data-akcia-ziadosti]');
        if (b) vybav(z, b.getAttribute('data-akcia-ziadosti'));
      });
    });
    function vybav(z, akcia) {
      zrus();
      zavriVyber(false);
      dobehni();
      var typ = z.getAttribute('data-ziadost');
      var vysl = z.querySelector('.ziadost-vysledok');
      if (akcia === 'schvalit') {
        if (typ === 'vymena') {
          var o = idx('lucia');
          var s = tabulka.querySelector('.smena[data-id="s18"]');
          var ciel = bunka(o, 4);
          var p = s ? poloha(s) : null;
          if (!s || ludia[p.o].id !== 'matej' || p.d !== 4 || smenaV(ciel) || ciel.classList.contains('volno')) {
            sprava('Rozpis sa medzitým zmenil, túto výmenu už nejde použiť. Skúste najprv Navrhnúť týždeň.', 'pozor');
            return;
          }
          flip([s], function () { ciel.appendChild(s); });
          obnovStitok(s);
          plan['s18'] = { o: o, d: 4 };
          var r = prepocitaj();
          vysl.textContent = 'Schválené, smenu má Lucia.';
          sprava('Schválené: piatok ' + casy(s) + ' má Lucia.' + (r.nad.length ? ' Nad zmluvu: ' + r.nad.join(', ') + '.' : ''), r.nad.length ? 'pozor' : 'ok');
        } else {
          var td = bunka(idx('eva'), 6);
          if (smenaV(td)) { sprava('Eva má v' + NB + 'nedeľu smenu. Najprv ju presuňte inému človeku.', 'pozor'); return; }
          td.classList.add('volno');
          td.setAttribute('data-volno', 'Voľno');
          var st = doc.createElement('span'); st.className = 'volno-stitok'; st.textContent = 'Voľno';
          td.appendChild(st);
          vysl.textContent = 'Schválené, Eva má v' + NB + 'nedeľu voľno.';
          sprava('Schválené: Eva má v' + NB + 'nedeľu voľno.', 'ok');
        }
      } else {
        vysl.textContent = 'Zamietnuté, rozpis sa nezmenil.';
        vysl.classList.add('zamietnute');
        sprava('Žiadosť zamietnutá, rozpis sa nezmenil.', '');
      }
      z.querySelector('.ziadost-akcie').hidden = true;
      var poz = z.querySelector('.ziadost-pozor'); if (poz) poz.hidden = true;
      vysl.hidden = false;
      vysl.tabIndex = -1;
      z.classList.add('vybavena');
      vysl.focus();
      var zostava = app.querySelectorAll('.ziadost:not(.vybavena)').length;
      pocetEl.textContent = zostava;
      if (denViditelny()) vykresliDen();
    }

    // ---------- pohľad na jeden deň
    var denPanel = doc.getElementById('den-panel');
    var denTaby = [].slice.call(app.querySelectorAll('.dni [role="tab"]'));
    var teraz = denPanel ? denPanel.querySelector('.teraz') : null;
    var aktivnyDen = dnes.den;
    var rTyzden = doc.getElementById('pohlad-tyzden'), rDen = doc.getElementById('pohlad-den');
    var mqMobil = mm('(max-width: 719px)');
    function denViditelny() { return denPanel && denPanel.offsetParent !== null; }

    denTaby.forEach(function (b, i) { if (i === dnes.den) b.classList.add('dnes'); });

    // výber človeka pre smenu v dni: rovnaké pravidlá ako ťah v týždni (voľno, nemôže, zaškolenie, výmena, nadčas)
    var vyberDna = null;
    function zavriVyber(navrat) {
      if (!vyberDna) return;
      var v = vyberDna; vyberDna = null;
      if (v.panel.parentNode) v.panel.parentNode.removeChild(v.panel);
      v.bar.setAttribute('aria-expanded', 'false');
      v.bar.removeAttribute('aria-controls');
      if (denPanel) denPanel.classList.remove('vyber-otvoreny');
      if (navrat && v.bar.isConnected) v.bar.focus({ preventScroll: true });
    }
    function otvorVyber(s, bar, li) {
      var bolo = vyberDna && vyberDna.s === s;
      zavriVyber(false);
      if (bolo) { sprava(napoveda(), ''); return; }
      dobehni();
      var p = poloha(s), rola = s.getAttribute('data-rola');
      var panel = doc.createElement('li');
      panel.className = 'den-vyber';
      panel.id = 'den-vyber';
      var nad = doc.createElement('p');
      nad.className = 'den-vyber-nadpis';
      nad.id = 'den-vyber-nadpis';
      nad.appendChild(doc.createTextNode('Komu dať smenu?'));
      var det = doc.createElement('span');
      det.textContent = ludia[p.o].meno + ', ' + DNI[p.d] + ' ' + casy(s) + ', ' + ROLY[rola];
      nad.appendChild(det);
      var zoz = doc.createElement('div');
      zoz.className = 'den-vyber-zoznam';
      zoz.setAttribute('role', 'group');
      zoz.setAttribute('aria-labelledby', 'den-vyber-nadpis');
      var prva = null;
      ludia.forEach(function (l, o) {
        if (o === p.o) return;
        var td = bunka(o, p.d), v = skus(s, td);
        var b = doc.createElement('button');
        b.type = 'button';
        b.className = 'den-vyber-osoba';
        var av = doc.createElement('span');
        av.className = riadky[o].querySelector('.avatar').className;
        av.setAttribute('aria-hidden', 'true');
        av.textContent = l.meno.charAt(0);
        var text = doc.createElement('span');
        var meno = doc.createElement('span');
        meno.textContent = l.meno;
        var info = doc.createElement('small');
        var t;
        if (v.stav === 'zle') {
          b.disabled = true;
          t = td.classList.contains('volno') ? (td.getAttribute('data-volno') === 'Voľno' ? 'má voľno' : 'nemôže')
            : v.vymena ? 'výmena nejde' : 'nerobí ' + ROLY_AKUZ[rola];
        } else {
          var h = hodiny(o) + dlzka(s) - (v.tam ? dlzka(v.tam) : 0);
          t = v.stav === 'vymena' ? 'vymenia si smeny' : 'môže';
          if (h > l.zmluva) { t += ', bude mať ' + h + NB + 'h z' + NB + l.zmluva; b.classList.add('pozor'); }
          b.addEventListener('click', function () {
            var id = s.getAttribute('data-id');
            zavriVyber(false);
            poloz(s, td);
            var nova = denPanel.querySelector('.den-smena[data-id="' + id + '"]');
            if (nova) nova.focus({ preventScroll: true });
          });
          if (!prva) prva = b;
        }
        info.textContent = t;
        text.appendChild(meno);
        text.appendChild(info);
        b.appendChild(av);
        b.appendChild(text);
        zoz.appendChild(b);
      });
      var zr = doc.createElement('button');
      zr.type = 'button';
      zr.className = 'den-vyber-zrusit';
      zr.textContent = 'Zrušiť';
      zr.addEventListener('click', function () { zavriVyber(true); sprava('Smena ostala na mieste.', ''); });
      panel.appendChild(nad);
      panel.appendChild(zoz);
      panel.appendChild(zr);
      panel.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); zavriVyber(true); sprava('Smena ostala na mieste.', ''); }
      });
      li.parentNode.insertBefore(panel, li.nextSibling);
      bar.setAttribute('aria-expanded', 'true');
      bar.setAttribute('aria-controls', 'den-vyber');
      denPanel.classList.add('vyber-otvoreny');
      vyberDna = { s: s, panel: panel, bar: bar };
      sprava('Vyberte, kto vezme smenu: ' + ludia[p.o].meno + ' ' + V_DNI[p.d] + ' ' + casy(s) + '.', '');
      if (prva) prva.focus({ preventScroll: true });
      var r = panel.getBoundingClientRect();
      if (r.bottom > innerHeight - 8) window.scrollBy({ top: r.bottom - innerHeight + 24, behavior: pohybOK ? 'smooth' : 'auto' });
    }

    function vykresliDen() {
      if (!denPanel) return;
      zavriVyber(false);
      var d = aktivnyDen;
      denTaby.forEach(function (b, i) { var sel = i === d; b.setAttribute('aria-selected', sel ? 'true' : 'false'); b.tabIndex = sel ? 0 : -1; });
      denPanel.setAttribute('aria-labelledby', 'den-tab-' + d);
      var k = 0;
      denPanel.querySelectorAll('.den-riadky > li:not(.den-vyber)').forEach(function (li, o) {
        var stopa = li.querySelector('.den-stopa');
        stopa.textContent = '';
        var td = bunka(o, d);
        var s = smenaV(td);
        if (s) {
          var rola = s.getAttribute('data-rola');
          var b = doc.createElement('button');
          b.type = 'button';
          b.className = 'den-smena s-' + rola;
          b.setAttribute('data-id', s.getAttribute('data-id'));
          b.setAttribute('aria-expanded', 'false');
          b.style.setProperty('--od', s.getAttribute('data-od'));
          b.style.setProperty('--dlzka', dlzka(s));
          b.style.setProperty('--i', k++);
          // viditeľný text sa na úzkej stope skráti na „7 až 15“; meno tlačidla začína presne ním a skrytý doplnok
          // za ním pridá človeka, prácu a čo tlačidlo robí (WCAG 2.5.3, bez aria-label)
          var vid = doc.createElement('span');
          [s.getAttribute('data-od'), ':00', ' až ' + s.getAttribute('data-do'), ':00'].forEach(function (t, i) {
            if (i % 2) { var m = doc.createElement('span'); m.className = 'min'; m.textContent = t; vid.appendChild(m); }
            else vid.appendChild(doc.createTextNode(t));
          });
          b.appendChild(vid);
          var skr = doc.createElement('span'); skr.className = 'skryte';
          skr.textContent = ', ' + ludia[o].meno + ', ' + ROLY[rola] + '. Vybrať, kto smenu vezme.';
          b.appendChild(skr);
          b.addEventListener('click', function () { otvorVyber(s, b, li); });
          stopa.appendChild(b);
        } else {
          var v = doc.createElement('span');
          var je = td.classList.contains('volno');
          v.className = 'den-volno' + (je ? '' : ' den-bez');
          v.textContent = je ? td.getAttribute('data-volno') : 'Bez smeny';
          stopa.appendChild(v);
        }
      });
      obnovTeraz();
    }
    function obnovTeraz() {
      if (!teraz) return;
      var t = terazBA();
      if (aktivnyDen === t.den && t.min >= 360 && t.min <= 1440) {
        teraz.style.setProperty('--x', ((t.min - 360) / 1080).toFixed(4));
        teraz.hidden = false;
      } else teraz.hidden = true;
    }
    setInterval(function () { if (denViditelny()) obnovTeraz(); }, 60000);

    function vyberDen(d, fokus) {
      aktivnyDen = (d + 7) % 7;
      vykresliDen();
      if (fokus) denTaby[aktivnyDen].focus();
    }
    denTaby.forEach(function (b, i) {
      b.addEventListener('click', function () { vyberDen(i, false); });
      b.addEventListener('keydown', function (e) {
        var k = e.key;
        if (k === 'ArrowRight' || k === 'ArrowLeft' || k === 'Home' || k === 'End') {
          e.preventDefault();
          vyberDen(k === 'Home' ? 0 : k === 'End' ? 6 : aktivnyDen + (k === 'ArrowRight' ? 1 : -1), true);
        }
      });
    });
    // potiahnutie prstom doľava a doprava prepína dni (aj po smene; krátke ťuknutie na smenu otvorí výber)
    var sw = null;
    if (denPanel) {
      denPanel.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch' && !e.target.closest('.den-vyber')) sw = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
      denPanel.addEventListener('pointerup', function (e) {
        if (!sw || e.pointerId !== sw.id) return;
        var dx = e.clientX - sw.x, dy = e.clientY - sw.y;
        sw = null;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) vyberDen(aktivnyDen + (dx < 0 ? 1 : -1), false);
      });
      denPanel.addEventListener('pointercancel', function () { sw = null; });
    }

    // nápoveda podľa toho, čo človek práve vidí a čím ovláda
    function napoveda() {
      var dot = mqDotyk.matches;
      if (denViditelny()) {
        return dot ? 'Ťuknite na smenu a vyberte, kto ju vezme. Iný deň vyberiete hore alebo potiahnutím prstom do strany.'
          : 'Kliknite na smenu a vyberte, kto ju vezme. Iný deň vyberiete hore.';
      }
      return dot ? 'Ťuknite na smenu a potom na políčko, kam ju chcete dať. Alebo stlačte Navrhnúť týždeň.'
        : 'Potiahnite smenu na iný deň alebo inému človeku. Alebo stlačte Navrhnúť týždeň.';
    }

    // prepínač pohľadu: voľba sa zladí s tým, čo práve vidno (mobil deň, inak týždeň)
    var tyzdenUzVideny = !mqMobil.matches;
    if (mqMobil.matches) { rDen.checked = true; vykresliDen(); } else { rTyzden.checked = true; }
    rTyzden.addEventListener('change', function () {
      zrus();
      zavriVyber(false);
      if (!tyzdenUzVideny) { tyzdenUzVideny = true; dobehni(); vlna(); }
      sprava(napoveda(), '');
    });
    rDen.addEventListener('change', function () { zrus(); vykresliDen(); sprava(napoveda(), ''); });

    prepocitaj();
    sprava(napoveda(), '', true);
  }

  // ---------------------------------------------------------------- stránka
  // hlavička po posune dostane linku, napojenia sa jemne posúvajú s posunom stránky
  var intSekcia = doc.querySelector('.integracie');
  var rady = [].slice.call(doc.querySelectorAll('.int-rad'));
  var intVidno = false, cakaSnimka = false;
  var mqSiroke = mm('(min-width: 720px)');
  function posunInt() {
    if (!intVidno || !pohybOK || !mqSiroke.matches || !intSekcia) return;
    var r = intSekcia.getBoundingClientRect();
    var p = obmedz((innerHeight - r.top) / (innerHeight + r.height), 0, 1);
    rady.forEach(function (rad) { rad.style.setProperty('--posun', ((p - 0.5) * 140 * (+rad.getAttribute('data-smer') || 1)).toFixed(1) + 'px'); });
  }
  // na mobile (do 1023 px, aj v telefóne na /web/) sa hlavička pri posune dole schová a pri posune hore vráti, aby pri
  // čítaní neprekrývala nadpisy (Andrej 26. 11. 2026); pri vrchu stránky, s otvoreným menu a s fokusom z klávesnice ostáva
  var mqMobil = mm('(max-width: 1023px)');
  var pasUkazky = doc.querySelector('.pas');
  var poslednyY = Math.max(0, window.scrollY);
  function vidnoNutne() {
    var m = doc.getElementById('mobil-menu');
    try { return !!((m && m.matches(':popover-open')) || hlava.querySelector(':focus-visible')); } catch (e) { return false; }
  }
  function hlavickaPodlaSmeru() {
    if (!hlava) return;
    var y = Math.max(0, window.scrollY);
    var prah = (pasUkazky ? pasUkazky.offsetHeight : 0) + hlava.offsetHeight + 40;
    if (!mqMobil.matches || y <= prah || vidnoNutne()) {
      hlava.classList.remove('skryta');
      poslednyY = y;
      return;
    }
    if (Math.abs(y - poslednyY) < 8) return;
    hlava.classList.toggle('skryta', y > poslednyY);
    poslednyY = y;
  }
  function naPosun() {
    cakaSnimka = false;
    if (hlava) hlava.classList.toggle('posun', window.scrollY > 8);
    hlavickaPodlaSmeru();
    posunInt();
  }
  window.addEventListener('scroll', function () { if (!cakaSnimka) { cakaSnimka = true; requestAnimationFrame(naPosun); } }, { passive: true });
  naPosun();
  if (hlava) {
    hlava.addEventListener('focusin', function (e) {
      var zKlavesnice = false;
      try { zKlavesnice = e.target.matches(':focus-visible'); } catch (x) { zKlavesnice = true; }
      if (zKlavesnice) hlava.classList.remove('skryta');
    });
    if (mqMobil.addEventListener) mqMobil.addEventListener('change', function () { hlava.classList.remove('skryta'); });
  }
  // na mobile sú rady napojení posuvné: vtedy ich musí byť možné posúvať aj klávesnicou (fokus na rade)
  function radyFokus() {
    rady.forEach(function (rad) {
      if (rad.scrollWidth > rad.clientWidth + 1) rad.setAttribute('tabindex', '0'); else rad.removeAttribute('tabindex');
    });
  }
  radyFokus();
  if (mqSiroke.addEventListener) mqSiroke.addEventListener('change', radyFokus);

  // vstup sekcií a karty funkcií: čo je pod ohybom, sa ukáže raz pri vstupe do obrazu
  var vstupy = [].slice.call(doc.querySelectorAll('.vstupi'));
  if ('IntersectionObserver' in window && pohybOK) {
    var io = new IntersectionObserver(function (zaznamy) {
      zaznamy.forEach(function (z) {
        if (!z.isIntersecting) return;
        z.target.classList.add('videne');
        if (z.target.classList.contains('karta')) z.target.classList.add('hra');
        io.unobserve(z.target);
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -6% 0px' });
    vstupy.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.94 && r.bottom > 0) {
        el.classList.add('videne');
        if (el.classList.contains('karta')) setTimeout(function () { el.classList.add('hra'); }, 250);
      } else {
        el.classList.add('caka');
        io.observe(el);
      }
    });
    if (intSekcia) new IntersectionObserver(function (z) { intVidno = z[0].isIntersecting; if (intVidno) posunInt(); }).observe(intSekcia);
  } else {
    vstupy.forEach(function (el) { el.classList.add('videne', 'hra'); });
  }

  // mobilné menu: otvorí sa tesne pod hlavičkou (pri vrchu stránky je nad ňou ešte pás ukážky) a po výbere odkazu sa zavrie
  var menu = doc.getElementById('mobil-menu');
  function menuPodHlavicku() { if (menu && hlava) menu.style.top = Math.round(hlava.getBoundingClientRect().bottom + 8) + 'px'; }
  if (menu) {
    menu.addEventListener('beforetoggle', function (e) { if (e.newState === 'open') menuPodHlavicku(); });
    var menuTl = doc.querySelector('.menu-tlacidlo');
    if (menuTl) menuTl.addEventListener('click', menuPodHlavicku);
    if (menu.hidePopover) menu.addEventListener('click', function (e) { if (e.target.closest('a')) menu.hidePopover(); });
  }
  // dialóg dostane fokus na Zavrieť
  doc.querySelectorAll('.modal').forEach(function (d) {
    d.addEventListener('toggle', function (e) {
      if (e.newState === 'open') { var z = d.querySelector('.zavriet'); if (z) z.focus(); }
    });
  });
})();
