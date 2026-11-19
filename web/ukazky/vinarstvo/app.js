// Vinárstvo Svorník (ukážka webu od ARLing): dvere portálu v úvode, menu na mobile, filter vín, košík bez platby,
// rezervácia degustácie bez odoslania, ciferník vinárskeho roka a stav vinotéky podľa času v Bratislave.
// Nič sa neodosiela ani neukladá na server; košík žije len v pamäti stránky a v sessionStorage tejto karty
// (v try a catch, bez neho funguje rovnako). Bez skriptu je stránka úplná: dvere sú otvorené, vína, ceny, ponuka
// degustácií, všetkých 12 mesiacov a hodiny sú v HTML (štýly v noscript).
// Hneď beží len lacná práca v prvej obrazovke (pauza dverí, kým nepríde fotka pivnice, stav vinotéky); ostatné sa
// zapne až po načítaní stránky v nečinnom čase, aby nič nezdržalo prvé vykreslenie úvodu.
(function () {
  'use strict';
  var koren = document.documentElement;
  var NB = ' '; // pevná medzera (predložky, čísla a jednotky)
  var pokoj = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MESIACE = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún', 'Júl', 'August', 'September', 'Október', 'November', 'December'];
  var MESIACE_GEN = ['januára', 'februára', 'marca', 'apríla', 'mája', 'júna', 'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra'];
  var DNI = ['nedeľa', 'pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota'];
  var V_DEN = ['v' + NB + 'nedeľu', 'v' + NB + 'pondelok', 'v' + NB + 'utorok', 'v' + NB + 'stredu', 'vo' + NB + 'štvrtok', 'v' + NB + 'piatok', 'v' + NB + 'sobotu'];
  // Zatvorené: celý január a Vianoce (24. až 26. 12.). Platí pre vinotéku aj termíny degustácií.
  var SVIATKY = { '12-24': 'Štedrý deň', '12-25': 'Vianoce', '12-26': 'Vianoce' };
  function zatvorene(mesiac, den) { return mesiac === 1 || !!SVIATKY[mesiac + '-' + den]; }

  function $(s, k) { return (k || document).querySelector(s); }
  function $$(s, k) { return Array.prototype.slice.call((k || document).querySelectorAll(s)); }

  var hlasenie = $('#hlasenie');
  var hlasTimer;
  function ohlas(text) {
    if (!hlasenie) return;
    clearTimeout(hlasTimer);
    hlasenie.textContent = '';
    hlasTimer = setTimeout(function () { hlasenie.textContent = text; }, 60);
  }

  // Čas v Bratislave (deň v týždni, dátum, minúty od polnoci)
  function bratislava() {
    try {
      var p = {};
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Bratislava', year: 'numeric', month: 'numeric', day: 'numeric',
        weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date()).forEach(function (c) { p[c.type] = c.value; });
      var tyzden = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
      return { rok: +p.year, mesiac: +p.month, den: +p.day, tyzden: tyzden, min: (+p.hour) * 60 + (+p.minute) };
    } catch (e) {
      var d = new Date();
      return { rok: d.getFullYear(), mesiac: d.getMonth() + 1, den: d.getDate(), tyzden: d.getDay(), min: d.getHours() * 60 + d.getMinutes() };
    }
  }
  var teraz = bratislava();
  var dnesUTC = Date.UTC(teraz.rok, teraz.mesiac - 1, teraz.den, 12);
  function denPo(i) {
    var d = new Date(dnesUTC + i * 86400000);
    return { mesiac: d.getUTCMonth() + 1, den: d.getUTCDate(), tyzden: d.getUTCDay(), rok: d.getUTCFullYear() };
  }

  // Úvod: dvere sa otvoria, až keď je fotka pivnice načítaná (najviac 1,6 s), aby sa neotvárali do tmy
  (function () {
    var hrdina = $('.hrdina');
    var img = hrdina && $('.portal-foto', hrdina);
    if (!img || img.complete || pokoj) return;
    hrdina.classList.add('caka');
    var pusti = function () { hrdina.classList.remove('caka'); };
    img.addEventListener('load', pusti, { once: true });
    img.addEventListener('error', pusti, { once: true });
    setTimeout(pusti, 1600);
  })();

  // Fotky vinice hneď pod úvodom: Chrome by lenivé obrázky do 1 250 px pod oknom stiahol hneď spolu s úvodom (181 KB pri
  // DPR 3). Začnú sa sťahovať až po prvom posune alebo 1,8 s po načítaní, keď je úvod vykreslený; bez JS ich nesie noscript.
  function odlozeneFotky() {
    var obr = $$('img[data-srcset]');
    if (!obr.length) return;
    var zacate = false;
    function nacitaj(img) {
      var zdroj = img.getAttribute('data-srcset');
      if (!zdroj) return;
      img.srcset = zdroj;
      img.setAttribute('data-srcset', '');
    }
    function zacni() {
      if (zacate) return;
      zacate = true;
      if (!('IntersectionObserver' in window)) { obr.forEach(nacitaj); return; }
      var io = new IntersectionObserver(function (zaznamy) {
        zaznamy.forEach(function (z) { if (z.isIntersecting) { nacitaj(z.target); io.unobserve(z.target); } });
      }, { rootMargin: '900px 0px' });
      obr.forEach(function (img) { io.observe(img); });
    }
    window.addEventListener('scroll', zacni, { once: true, passive: true });
    setTimeout(zacni, 1800);
  }

  // Hlavička po posune stmavne a dostane vlasovú čiaru (zapne sa v zvysok)
  function hlavicka() {
    var hlava = $('#hlava');
    if (!hlava) return;
    var caka = false;
    function stav() { caka = false; hlava.classList.toggle('posunute', window.scrollY > 24); }
    window.addEventListener('scroll', function () { if (!caka) { caka = true; requestAnimationFrame(stav); } }, { passive: true });
    stav();
  }

  // Vinotéka: dnešný deň v tabuľke a veta, či je teraz otvorené (január a Vianoce zatvorené)
  (function () {
    var riadky = $$('.hodiny tr[data-den]');
    if (!riadky.length) return;
    var dni = {};
    riadky.forEach(function (r) { dni[r.getAttribute('data-den')] = { od: r.getAttribute('data-od'), do: r.getAttribute('data-do'), riadok: r }; });
    function naMin(t) { var x = t.split(':'); return (+x[0]) * 60 + (+x[1]); }
    var dnes = dni[String(teraz.tyzden)];
    var dnesZatvorene = zatvorene(teraz.mesiac, teraz.den);
    if (dnes) {
      dnes.riadok.classList.add('dnes');
      dnes.riadok.setAttribute('aria-current', 'date');
      var z = $('.znacka-dnes', dnes.riadok);
      if (z) z.hidden = false;
    }
    function dalsieOtvorenie() {
      for (var i = 1; i <= 70; i++) {
        var d = denPo(i);
        var h = dni[String(d.tyzden)];
        if (!h || !h.od || zatvorene(d.mesiac, d.den)) continue;
        var kedy = i === 1 ? 'zajtra' : (i < 7 ? V_DEN[d.tyzden] : V_DEN[d.tyzden] + ' ' + d.den + '.' + NB + MESIACE_GEN[d.mesiac - 1]);
        return { kedy: kedy, od: h.od };
      }
      return null;
    }
    var dlha, kratka, dalsi;
    if (teraz.mesiac === 1) {
      dlha = 'V' + NB + 'januári je vinotéka zatvorená, víno pošleme kuriérom';
      kratka = 'v' + NB + 'januári zatvorené';
    } else if (dnesZatvorene) {
      dalsi = dalsieOtvorenie();
      dlha = 'Cez Vianoce zatvorené' + (dalsi ? '. Otvárame ' + dalsi.kedy + ' o' + NB + dalsi.od : '');
      kratka = 'cez Vianoce zatvorené';
    } else if (dnes && dnes.od && teraz.min < naMin(dnes.od)) {
      dlha = 'Dnes otvárame o' + NB + dnes.od;
      kratka = 'dnes od ' + dnes.od + ' do ' + dnes.do;
    } else if (dnes && dnes.od && teraz.min < naMin(dnes.do)) {
      dlha = 'Teraz otvorené, dnes do' + NB + dnes.do;
      kratka = 'teraz otvorené do' + NB + dnes.do;
    } else {
      dalsi = dalsieOtvorenie();
      if (dalsi) {
        dlha = (dnes && dnes.od ? 'Dnes už zatvorené. ' : 'Dnes zatvorené. ') + 'Otvárame ' + dalsi.kedy + ' o' + NB + dalsi.od;
        kratka = 'otvárame ' + dalsi.kedy + ' o' + NB + dalsi.od;
      }
    }
    var stav = $('#stav-vinoteky');
    if (stav && dlha) { $('.stav-vinoteky-text', stav).textContent = dlha; stav.hidden = false; }
    var hrdina = $('#stav-hrdina');
    if (hrdina && kratka) hrdina.textContent = kratka.charAt(0).toUpperCase() + kratka.slice(1);
  })();

  function zvysok() {
  // Peniaze a skloňovanie
  function eur(centy) {
    var s = (centy / 100).toFixed(2).replace('.', ',');
    var cele = s.split(',')[0].replace(/\B(?=(\d{3})+(?!\d))/g, NB);
    return cele + ',' + s.split(',')[1] + NB + '€';
  }
  function flias(n) { return n === 1 ? '1' + NB + 'fľaša' : (n >= 2 && n <= 4 ? n + NB + 'fľaše' : n + NB + 'fliaš'); }
  function osoby(n) { return n === 1 ? '1' + NB + 'osoba' : (n >= 2 && n <= 4 ? n + NB + 'osoby' : n + NB + 'osôb'); }

  // Dialógy: zatváracie tlačidlá, klik na pozadie, návrat fokusu (alebo presun na kotvu z menu)
  var otvoril = new WeakMap();
  function otvor(dlg, odkial) {
    if (!dlg || dlg.open) return;
    otvoril.set(dlg, odkial || document.activeElement);
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    koren.classList.add('okno-otvorene');
    if (odkial && odkial.hasAttribute('aria-haspopup')) odkial.setAttribute('aria-expanded', 'true');
  }
  $$('dialog').forEach(function (dlg) {
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) dlg.close();
      var z = e.target.closest('[data-zavriet]');
      if (z && dlg.contains(z)) dlg.close();
    });
    dlg.addEventListener('close', function () {
      if (!document.querySelector('dialog[open]')) koren.classList.remove('okno-otvorene');
      var spat = otvoril.get(dlg);
      if (spat && spat.hasAttribute('aria-expanded')) spat.setAttribute('aria-expanded', 'false');
      var ciel = dlg._ciel;
      if (ciel) {
        dlg._ciel = null;
        if (!ciel.hasAttribute('tabindex')) ciel.setAttribute('tabindex', '-1');
        ciel.scrollIntoView({ behavior: pokoj ? 'auto' : 'smooth', block: 'start' });
        try { ciel.focus({ preventScroll: true }); } catch (e) { ciel.focus(); }
        try { history.replaceState(null, '', '#' + ciel.id); } catch (e) { /* nič */ }
        return;
      }
      if (spat && document.contains(spat) && typeof spat.focus === 'function' && !spat.closest('dialog:not([open])')) {
        try { spat.focus({ preventScroll: true }); } catch (e) { spat.focus(); }
      }
    });
  });
  var okno = $('#okno-ukazka');
  function ukazka(nadpis, text, suhrn, odkial) {
    if (!okno) return;
    $('#okno-nadpis').textContent = nadpis;
    $('#okno-text').textContent = text;
    $('#okno-suhrn').textContent = suhrn || '';
    otvor(okno, odkial);
  }

  // Menu na mobile a tablete: zásuvka zhora s kotvami; klik na kotvu zavrie menu a presunie fokus na kapitolu
  (function () {
    var dlg = $('#menu-zasuvka');
    if (!dlg) return;
    $$('[data-otvor-menu]').forEach(function (b) {
      b.setAttribute('aria-expanded', 'false');
      b.addEventListener('click', function () { otvor(dlg, b); });
    });
    dlg.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-kotva]');
      if (!a || !dlg.contains(a)) return;
      var ciel = document.getElementById(a.getAttribute('href').slice(1));
      if (!ciel) return;
      e.preventDefault();
      dlg._ciel = ciel;
      dlg.close();
    });
    if (window.matchMedia) {
      var siroke = window.matchMedia('(min-width: 960px)');
      var zmena = function () { if (siroke.matches && dlg.open) dlg.close(); };
      if (siroke.addEventListener) siroke.addEventListener('change', zmena); else if (siroke.addListener) siroke.addListener(zmena);
    }
  })();

  // Filter vín podľa farby
  (function () {
    var filter = $('#filter');
    var zoznam = $('#vina-zoznam');
    if (!filter || !zoznam) return;
    filter.addEventListener('change', function (e) {
      if (!e.target || e.target.name !== 'farba') return;
      var v = e.target.value;
      var n = 0;
      $$('.vino', zoznam).forEach(function (li) {
        var ukaz = v === 'vsetky' || li.getAttribute('data-farba') === v;
        li.hidden = !ukaz;
        li.classList.remove('vstup');
        if (ukaz) {
          if (!pokoj) {
            li.style.animationDelay = (n * 70) + 'ms';
            void li.offsetWidth;
            li.classList.add('vstup');
          }
          n++;
        }
      });
      ohlas('Zobrazené ' + (n === 1 ? '1' + NB + 'víno' : (n < 5 ? n + NB + 'vína' : n + NB + 'vín')) + '.');
    });
  })();

  // Košík (len ukážka)
  var kosik = (function () {
    var dlg = $('#kosik');
    if (!dlg) return null;
    var vina = {};
    $$('.vino[data-id]').forEach(function (li) {
      vina[li.getAttribute('data-id')] = { nazov: li.getAttribute('data-nazov'), cena: parseInt(li.getAttribute('data-cena'), 10), farba: li.getAttribute('data-farba') };
    });
    var DOPRAVA = { odber: 0, kurier: 590 };
    var stav = { polozky: {}, doprava: 'odber', poradie: [] };
    try {
      var ulozene = JSON.parse(sessionStorage.getItem('svornik-kosik') || 'null');
      if (ulozene && typeof ulozene === 'object') {
        (Array.isArray(ulozene.poradie) ? ulozene.poradie : []).forEach(function (id) {
          var q = ulozene.polozky && ulozene.polozky[id];
          if (vina[id] && typeof q === 'number' && q % 1 === 0 && q > 0 && q < 100 && stav.poradie.indexOf(id) < 0) {
            stav.polozky[id] = q; stav.poradie.push(id);
          }
        });
        if (ulozene.doprava === 'kurier') stav.doprava = 'kurier';
      }
    } catch (e) { /* bez úložiska košík funguje len do zatvorenia karty */ }
    function uloz() { try { sessionStorage.setItem('svornik-kosik', JSON.stringify(stav)); } catch (e) { /* nič */ } }
    function pocet() { return stav.poradie.reduce(function (s, id) { return s + stav.polozky[id]; }, 0); }
    function sucet() { return stav.poradie.reduce(function (s, id) { return s + stav.polozky[id] * vina[id].cena; }, 0); }

    var zoznam = $('#kosik-polozky');
    var prazdny = $('#kosik-prazdny');
    var tlacidloObj = $('#k-objednavke');
    var predtym = -1;

    function krokovac(id) {
      var w = document.createElement('div');
      w.className = 'krokovac';
      w.setAttribute('role', 'group');
      w.setAttribute('aria-label', 'Počet fliaš, ' + vina[id].nazov);
      var minus = document.createElement('button');
      minus.type = 'button'; minus.setAttribute('data-krok', '-1'); minus.setAttribute('data-id', id);
      minus.setAttribute('aria-label', 'O' + NB + 'jednu menej');
      minus.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12"/></svg>';
      var out = document.createElement('output');
      out.textContent = String(stav.polozky[id]);
      out.setAttribute('aria-live', 'polite');
      var plus = document.createElement('button');
      plus.type = 'button'; plus.setAttribute('data-krok', '1'); plus.setAttribute('data-id', id);
      plus.setAttribute('aria-label', 'O' + NB + 'jednu viac');
      plus.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg>';
      plus.disabled = stav.polozky[id] >= 99;
      w.appendChild(minus); w.appendChild(out); w.appendChild(plus);
      return w;
    }

    function prekresli(fokusId, fokusKrok) {
      var n = pocet();
      var vinaSpolu = sucet();
      var doprava = n ? DOPRAVA[stav.doprava] : 0;
      // počítadlo v hlavičke a v lište
      $$('[data-otvor-kosik]').forEach(function (b) {
        var st = $('.kosik-stav', b);
        if (st) st.textContent = n ? ', ' + flias(n) : ', prázdny';
        var p = $('.kosik-pocet', b);
        var s = $('span', p);
        if (s.textContent !== String(n)) {
          s.textContent = String(n);
          if (predtym >= 0 && !pokoj) { p.classList.remove('tik'); void p.offsetWidth; p.classList.add('tik'); }
        }
        if (n) p.removeAttribute('data-prazdny'); else p.setAttribute('data-prazdny', '');
      });
      predtym = n;
      // položky
      zoznam.textContent = '';
      stav.poradie.forEach(function (id) {
        var v = vina[id];
        var li = document.createElement('li');
        li.className = 'polozka';
        var bod = document.createElement('span');
        bod.className = 'polozka-bod'; bod.setAttribute('data-farba', v.farba); bod.setAttribute('aria-hidden', 'true');
        var nazov = document.createElement('p');
        nazov.className = 'polozka-nazov';
        nazov.textContent = v.nazov;
        var mala = document.createElement('small');
        mala.textContent = eur(v.cena) + ' za fľašu 0,75' + NB + 'l';
        nazov.appendChild(mala);
        var suma = document.createElement('p');
        suma.className = 'polozka-suma';
        suma.textContent = eur(v.cena * stav.polozky[id]);
        var odobrat = document.createElement('button');
        odobrat.type = 'button'; odobrat.className = 'odobrat'; odobrat.setAttribute('data-odobrat', id);
        odobrat.textContent = 'Odobrať';
        odobrat.setAttribute('aria-label', 'Odobrať ' + v.nazov);
        li.appendChild(bod); li.appendChild(nazov); li.appendChild(suma); li.appendChild(krokovac(id)); li.appendChild(odobrat);
        zoznam.appendChild(li);
      });
      prazdny.hidden = n > 0;
      $('#suma-vina').textContent = eur(vinaSpolu);
      $('#suma-doprava').textContent = doprava ? eur(doprava) : 'zadarmo';
      $('#suma-spolu').textContent = eur(vinaSpolu + doprava);
      tlacidloObj.disabled = n === 0;
      var r = $('input[name="doprava"][value="' + stav.doprava + '"]', dlg);
      if (r) r.checked = true;
      if (fokusId) {
        var ciel = fokusKrok ? $('button[data-id="' + fokusId + '"][data-krok="' + fokusKrok + '"]', zoznam) : null;
        if (ciel && !ciel.disabled) ciel.focus();
        else if (stav.poradie.length) $('button[data-krok="1"]', zoznam).focus();
        else $('[data-zavriet].zavriet', dlg).focus();
      }
    }

    function pridaj(id) {
      if (!vina[id]) return;
      if (!stav.polozky[id]) { stav.polozky[id] = 0; stav.poradie.push(id); }
      stav.polozky[id] = Math.min(99, stav.polozky[id] + 1);
      uloz(); prekresli();
      ohlas('Pridané do košíka: ' + vina[id].nazov + '. V' + NB + 'košíku: ' + flias(pocet()) + '.');
    }
    function zmen(id, krok) {
      if (!stav.polozky[id]) return;
      var q = stav.polozky[id] + krok;
      if (q <= 0) { delete stav.polozky[id]; stav.poradie.splice(stav.poradie.indexOf(id), 1); ohlas('Odobraté: ' + vina[id].nazov + '.'); }
      else stav.polozky[id] = Math.min(99, q);
      uloz(); prekresli(id, q > 0 ? String(krok) : null);
    }

    document.addEventListener('click', function (e) {
      var p = e.target.closest('[data-pridat]');
      if (p) {
        pridaj(p.getAttribute('data-pridat'));
        var t = $('.pridat-text', p);
        if (t) {
          clearTimeout(p._casovac);
          p.setAttribute('data-pridane', '');
          t.textContent = 'Pridané';
          p._casovac = setTimeout(function () { p.removeAttribute('data-pridane'); t.textContent = 'Do košíka'; }, 1500);
        }
        return;
      }
      var o = e.target.closest('[data-otvor-kosik]');
      if (o) { prekresli(); otvor(dlg, o); return; }
      var k = e.target.closest('[data-krok]');
      if (k && dlg.contains(k)) { zmen(k.getAttribute('data-id'), parseInt(k.getAttribute('data-krok'), 10)); return; }
      var od = e.target.closest('[data-odobrat]');
      if (od && dlg.contains(od)) {
        var id = od.getAttribute('data-odobrat');
        if (stav.polozky[id]) { zmen(id, -stav.polozky[id]); }
      }
    });
    $('#doprava').addEventListener('change', function (e) {
      if (e.target.name !== 'doprava') return;
      stav.doprava = e.target.value === 'kurier' ? 'kurier' : 'odber';
      uloz(); prekresli();
    });
    tlacidloObj.addEventListener('click', function () {
      var n = pocet();
      if (!n) return;
      var doprava = DOPRAVA[stav.doprava];
      ukazka('Objednávka v' + NB + 'ukážke',
        'Toto je ukážka e-shopu, nič sa neobjednalo ani nezaplatilo. Pri vašom e-shope tu bude pokladňa; čo presne k' + NB + 'nej dodáme, napíšeme v' + NB + 'ponuke.',
        flias(n) + ', ' + (stav.doprava === 'kurier' ? 'kuriér po Slovensku' : 'osobný odber v' + NB + 'pivnici') + ', spolu ' + eur(sucet() + doprava) + ' s' + NB + 'DPH.',
        tlacidloObj);
    });
    prekresli();
    return { pocet: pocet };
  })();

  // Rezervácia degustácie (len ukážka): termíny podľa kalendára bez januára a Vianoc, počet osôb, súčet, kontrola polí
  function rezervacia() {
    var form = $('#rezervacia');
    if (!form) return;
    var termin = $('#termin', form);
    var pole = $('#osoby', form);
    var sloty = { 5: ['17:00'], 6: ['14:00', '17:00'] };
    var volby = [];
    for (var i = 0; i < 90 && volby.length < 6; i++) {
      var d = denPo(i);
      if (!sloty[d.tyzden] || zatvorene(d.mesiac, d.den)) continue;
      sloty[d.tyzden].forEach(function (cas) {
        if (volby.length >= 6) return;
        var m = (+cas.split(':')[0]) * 60;
        if (i === 0 && teraz.min > m - 120) return;
        var iso = d.rok + '-' + String(d.mesiac).padStart(2, '0') + '-' + String(d.den).padStart(2, '0') + 'T' + cas;
        volby.push({ hodnota: iso, text: DNI[d.tyzden] + ' ' + d.den + '.' + NB + MESIACE_GEN[d.mesiac - 1] + ' o' + NB + cas });
      });
    }
    if (volby.length) {
      termin.textContent = '';
      var prva = document.createElement('option');
      prva.value = ''; prva.textContent = 'Vyberte termín';
      termin.appendChild(prva);
      volby.forEach(function (v) {
        var o = document.createElement('option');
        o.value = v.hodnota; o.textContent = v.text;
        termin.appendChild(o);
      });
      var iny = document.createElement('option');
      iny.value = 'iny'; iny.textContent = 'iný termín, napíšem do poznámky';
      termin.appendChild(iny);
      termin.value = volby[0].hodnota;
    }

    var minus = $('[data-osoby="-1"]', form);
    var plus = $('[data-osoby="1"]', form);
    function pocetOsob() {
      var n = parseInt(pole.value, 10);
      if (isNaN(n)) n = 1;
      return Math.max(1, Math.min(12, n));
    }
    function typ() { return $('input[name="typ"]:checked', form); }
    function prepocitaj() {
      var n = pocetOsob();
      var t = typ();
      var cena = parseInt(t.getAttribute('data-cena'), 10);
      $('#suhrn-text').textContent = osoby(n) + ' po ' + cena + NB + '€, platíte na mieste';
      $('#suhrn-cena').textContent = (n * cena) + NB + '€';
      minus.disabled = n <= 1;
      plus.disabled = n >= 12;
    }
    form.addEventListener('click', function (e) {
      var b = e.target.closest('[data-osoby]');
      if (!b) return;
      pole.value = String(Math.max(1, Math.min(12, pocetOsob() + parseInt(b.getAttribute('data-osoby'), 10))));
      prepocitaj();
      if (b.disabled) (b === minus ? plus : minus).focus();
    });
    pole.addEventListener('change', function () { pole.value = String(pocetOsob()); prepocitaj(); });
    pole.addEventListener('input', prepocitaj);
    form.addEventListener('change', function (e) { if (e.target.name === 'typ') prepocitaj(); });

    var kontroly = [
      { pole: termin, chyba: $('#chyba-termin'), ok: function () { return termin.value !== ''; } },
      { pole: $('#meno-hosta'), chyba: $('#chyba-meno'), ok: function () { return $('#meno-hosta').value.trim().length >= 2; } },
      { pole: $('#email-hosta'), chyba: $('#chyba-email'), ok: function () { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test($('#email-hosta').value.trim()); } }
    ];
    kontroly.forEach(function (k) {
      var udalost = k.pole.tagName === 'SELECT' ? 'change' : 'input';
      k.pole.addEventListener(udalost, function () {
        if (k.pole.getAttribute('aria-invalid') === 'true' && k.ok()) { k.pole.removeAttribute('aria-invalid'); k.chyba.hidden = true; }
      });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var prva = null;
      kontroly.forEach(function (k) {
        var ok = k.ok();
        if (ok) { k.pole.removeAttribute('aria-invalid'); k.chyba.hidden = true; }
        else { k.pole.setAttribute('aria-invalid', 'true'); k.chyba.hidden = false; if (!prva) prva = k.pole; }
      });
      if (prva) { prva.focus(); return; }
      var n = pocetOsob();
      var t = typ();
      var cena = parseInt(t.getAttribute('data-cena'), 10);
      var vybrany = termin.options[termin.selectedIndex];
      var kedy = termin.value === 'iny' ? 'iný termín podľa poznámky' : vybrany.textContent;
      var tlacidlo = $('button[type="submit"]', form);
      ukazka('Rezervácia v' + NB + 'ukážke',
        'Nič sa neodoslalo ani neuložilo. Na vašom webe príde rezervácia vinárovi e-mailom alebo do rezervačného systému a' + NB + 'hosť dostane potvrdenie.',
        t.getAttribute('data-nazov') + ', ' + kedy + ', ' + osoby(n) + ', spolu ' + (n * cena) + NB + '€ na mieste.',
        tlacidlo);
    });
    prepocitaj();
  }

  // Ciferník vinárskeho roka: vybraný mesiac, aktuálny mesiac, ručička a ovládanie šípkami
  function cifernik() {
    var kruh = $('#kruh');
    if (!kruh) return;
    var tlacidla = $$('.kruh-mesiac', kruh);
    var polozky = {};
    $$('.mesiac').forEach(function (li) { polozky[li.getAttribute('data-m')] = li; });
    var uhol = null;
    var vybrany = null;
    function natoc(m) {
      var ciel = (m - 1) * 30 + 15;
      if (uhol === null) uhol = ciel;
      else {
        var rozdiel = ((ciel - uhol) % 360 + 540) % 360 - 180;
        uhol += rozdiel;
      }
      kruh.style.setProperty('--uhol', uhol + 'deg');
    }
    function vyber(m, fokus) {
      m = ((m - 1 + 12) % 12) + 1;
      vybrany = m;
      tlacidla.forEach(function (b) {
        var je = +b.getAttribute('data-m') === m;
        b.setAttribute('aria-pressed', je ? 'true' : 'false');
        b.tabIndex = je ? 0 : -1;
        if (je && fokus) b.focus();
      });
      Object.keys(polozky).forEach(function (k) { polozky[k].classList.toggle('vybrany', +k === m); });
      var li = polozky[String(m)];
      $('#kruh-mesiac').textContent = MESIACE[m - 1];
      $('#kruh-titul').textContent = li ? $('.mesiac-titul', li).textContent : '';
      $('#kruh-teraz').textContent = m === teraz.mesiac ? 'teraz' : '';
      natoc(m);
    }
    tlacidla.forEach(function (b) {
      if (+b.getAttribute('data-m') === teraz.mesiac) {
        b.classList.add('teraz');
        var meno = $('.kruh-meno', b);
        if (meno) meno.textContent += ', tento mesiac';
      }
      b.addEventListener('click', function () { vyber(+b.getAttribute('data-m')); });
      b.addEventListener('keydown', function (e) {
        var krok = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (krok) { e.preventDefault(); vyber(vybrany + krok, true); }
        else if (e.key === 'Home') { e.preventDefault(); vyber(1, true); }
        else if (e.key === 'End') { e.preventDefault(); vyber(12, true); }
      });
    });
    vyber(teraz.mesiac);
  }
  hlavicka();
  odlozeneFotky();
  // rezervácia a ciferník sú hlboko pod úvodom: zapnú sa v ďalších nečinných chvíľach, aby nevznikla jedna dlhá úloha
  odlozene.push(rezervacia, cifernik);
  dalsiKrok();
  }

  var spustene = false;
  var odlozene = [];
  function cakaj(fn, ms) { if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout: ms }); else setTimeout(fn, 30); }
  function dalsiKrok() { cakaj(function () { var fn = odlozene.shift(); if (fn) { fn(); dalsiKrok(); } }, 1000); }
  function dokonci() { while (odlozene.length) odlozene.shift()(); }
  function spusti() { if (spustene) return; spustene = true; zvysok(); }
  if (document.readyState === 'complete') cakaj(spusti, 700); else window.addEventListener('load', function () { cakaj(spusti, 700); }, { once: true });
  // klik alebo klávesa skôr, než sa stránka dočíta: zapnúť hneď všetko, aby sa nestratil
  ['pointerdown', 'keydown', 'focusin'].forEach(function (u) { document.addEventListener(u, function () { spusti(); dokonci(); }, { capture: true }); });
})();
