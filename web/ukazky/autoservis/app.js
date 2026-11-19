// Autoservis Ojnica (ukážka). Všetko sa počíta len v prehliadači, nič sa nikam neposiela.
// 1. Stav otvorenia a zvýraznenie dnešného dňa z tabuľky hodín (čas podľa Bratislavy, sviatky sú zatvorené).
// 2. Zákazkový list: trieda auta a zaškrtnuté úkony, súčet od do sa pretáča ako počítadlo kilometrov.
//    Počítadlo je na troch miestach (malý list v úvode, celý list v cenníku, spodná lišta) a všetky ukazujú to isté.
//    Tri úkony v úvode sú zrkadlom tých istých políčok v cenníku. Predné platničky a platničky s kotúčmi sa vylučujú.
// 3. Spodná lišta (do 1079 px) sa ukáže, až keď z obrazovky zmizne tlačidlo Zavolať v úvode aj hlavička.
(function () {
  'use strict';
  var NB = ' ';
  var koren = document.documentElement;
  koren.classList.add('js');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---------- čas a hodiny ----------
  var teraz;
  try {
    var casti = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Bratislava', weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
    var p = {};
    casti.forEach(function (c) { p[c.type] = c.value; });
    var mapa = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    teraz = { den: mapa[p.weekday], min: parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10),
      datum: new Date(Date.UTC(parseInt(p.year, 10), parseInt(p.month, 10) - 1, parseInt(p.day, 10))) };
  } catch (e) {
    var d = new Date();
    teraz = { den: d.getDay(), min: d.getHours() * 60 + d.getMinutes(),
      datum: new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) };
  }
  function naMin(t) { var x = t.split(':'); return parseInt(x[0], 10) * 60 + parseInt(x[1], 10); }

  // Dni pracovného pokoja, keď má dielňa zatvorené: pevné dátumy (deň.mesiac), Veľký piatok a Veľkonočný pondelok.
  // Stav pre rok 2026 (11 dní): 1. 9. a 17. 11. už dňami pracovného pokoja nie sú, 8. 5. a 15. 9. sú v roku 2026 pracovné.
  // Zdroj: sita.sk, prehľad voľných dní 2026 (prečítané 19. 11. 2026). Pri webe klienta zoznam každý rok overiť.
  var PEVNE = ['1.1', '6.1', '1.5', '5.7', '29.8', '1.11', '24.12', '25.12', '26.12'];
  function velkaNoc(rok) { // nedeľa, gregoriánsky výpočet
    var a = rok % 19, b = Math.floor(rok / 100), c = rok % 100, dd = Math.floor(b / 4), e = b % 4;
    var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - dd - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mes = Math.floor((h + l - 7 * m + 114) / 31), den = ((h + l - 7 * m + 114) % 31) + 1;
    return Date.UTC(rok, mes - 1, den);
  }
  function jeSviatok(dt) {
    if (PEVNE.indexOf(dt.getUTCDate() + '.' + (dt.getUTCMonth() + 1)) !== -1) return true;
    var vn = velkaNoc(dt.getUTCFullYear()), t = dt.getTime();
    return t === vn - 2 * 86400000 || t === vn + 86400000;
  }

  var dni = {};
  $$('[data-den]').forEach(function (r) {
    dni[r.getAttribute('data-den')] = { od: r.getAttribute('data-od'), do: r.getAttribute('data-do'), riadok: r };
  });
  var V_DEN = ['v' + NB + 'nedeľu', 'v' + NB + 'pondelok', 'v' + NB + 'utorok', 'v' + NB + 'stredu', 'vo' + NB + 'štvrtok', 'v' + NB + 'piatok', 'v' + NB + 'sobotu'];

  var dnes = dni[String(teraz.den)];
  if (dnes) {
    dnes.riadok.classList.add('dnes');
    dnes.riadok.setAttribute('aria-current', 'date');
    var zn = $('.znacka-dnes', dnes.riadok);
    if (zn) zn.hidden = false;
  }
  var sviatok = jeSviatok(teraz.datum);
  var dnesOd = dnes && dnes.od && !sviatok ? dnes.od : null;

  var otvorene = false, pred = false, text = '', kratky = '';
  if (dnesOd && teraz.min < naMin(dnesOd)) {
    pred = true;
    text = 'Dnes otvárame o' + NB + dnesOd;
    kratky = text;
  } else if (dnesOd && teraz.min < naMin(dnes.do)) {
    otvorene = true;
    text = 'Dnes otvorené do' + NB + dnes.do;
    kratky = 'Otvorené do' + NB + dnes.do;
  } else {
    for (var i = 1; i <= 14; i++) {
      var k = (teraz.den + i) % 7;
      if (dni[k] && dni[k].od && !jeSviatok(new Date(teraz.datum.getTime() + i * 86400000))) {
        var kedy = i === 1 ? 'zajtra' : (i < 7 ? V_DEN[k] : 'po sviatkoch');
        text = (sviatok ? 'Dnes je sviatok, otvárame ' : 'Teraz zatvorené, otvárame ') + kedy + ' o' + NB + dni[k].od;
        kratky = 'Otvárame ' + kedy + ' o' + NB + dni[k].od;
        break;
      }
    }
  }
  var stav = $('#stav');
  if (stav && text) {
    $('.stav-text', stav).textContent = text;
    stav.classList.toggle('zatvorene', !otvorene && !pred);
  }
  var veta = $('[data-stav-veta]');
  if (veta && text) {
    veta.textContent = otvorene
      ? 'Sme v' + NB + 'dielni, telefón berieme do' + NB + dnes.do + '.'
      : text + '. Dovtedy nám napíšte, ozveme sa hneď ráno.';
  }

  // ---------- zákazkový list ----------
  var TRIEDY = ['malé', 'stredné', 'veľké'];
  var volby = $$('input[data-kod]');
  var zrkadla = $$('input[data-zrkadlo]');
  var radia = $$('input[name=trieda]');
  var riadky = $('[data-list-riadky]');
  var hlas = $('[data-list-hlas]');
  var casEl = $('[data-list-cas]');
  var triedaEl = $$('[data-list-trieda]');
  var listaSucet = $('[data-lista-sucet]');
  var listaPopis = $('[data-lista-popis]');
  var dotknute = false;   // kým človek nič nezaškrtol, list ukazuje príklad (výmena oleja)
  var oznam = '';

  // počítadlo: tri valce číslic, každý sa posunie na svoju číslicu, oneskorenie rastie sprava.
  // Každé miesto (úvod, list, lišta) má vlastnú sadu; neaktívna sada stojí na nulách, kým nepríde na obrazovku.
  var sady = [];
  var hodnoty = { od: 0, do: 0 };
  $$('[data-pocitadlo]').forEach(function (el) {
    var valce = [];
    for (var c = 0; c < 3; c++) {
      var cifra = document.createElement('span');
      cifra.className = 'cifra nula';
      var valec = document.createElement('span');
      valec.className = 'valec';
      valec.style.setProperty('--i', String(2 - c));
      for (var n = 0; n <= 9; n++) {
        var s = document.createElement('span');
        s.textContent = String(n);
        valec.appendChild(s);
      }
      cifra.appendChild(valec);
      el.appendChild(cifra);
      valce.push({ cifra: cifra, valec: valec });
    }
    var miesto = el.closest('.hl') ? 'uvod' : (el.closest('.lista') ? 'lista' : 'list');
    sady.push({ meno: el.getAttribute('data-pocitadlo'), valce: valce, miesto: miesto, aktivna: miesto === 'lista' });
  });
  function vykresli(sada) {
    var t = ('000' + Math.min(999, sada.aktivna ? hodnoty[sada.meno] : 0)).slice(-3);
    var uvodne = true;
    sada.valce.forEach(function (v, idx) {
      var cislica = parseInt(t.charAt(idx), 10);
      if (cislica !== 0 || idx === 2) uvodne = false;
      v.cifra.classList.toggle('nula', uvodne);
      v.valec.style.setProperty('--d', String(cislica));
    });
  }
  function nastavPocitadla(od, doo) {
    hodnoty.od = od; hodnoty.do = doo;
    sady.forEach(vykresli);
  }
  function zapni(miesto) {
    sady.forEach(function (s) { if (s.miesto === miesto && !s.aktivna) { s.aktivna = true; vykresli(s); } });
  }

  function cena(od, doo) { return od === doo ? od + NB + '€' : od + ' až ' + doo + NB + '€'; }
  function trvanie(m) {
    if (!m) return '';
    var h = Math.floor(m / 60), z = m % 60;
    return (h ? h + NB + 'h' : '') + (h && z ? NB : '') + (z ? z + NB + 'min' : '');
  }

  function prepocitaj(nove) {
    var tr = 1;
    radia.forEach(function (r) { if (r.checked) tr = parseInt(r.value, 10); });
    triedaEl.forEach(function (e) { e.textContent = TRIEDY[tr]; });
    var od = 0, doo = 0, minuty = 0, pocet = 0;
    var jestvujuce = {};
    $$('li[data-kod]', riadky).forEach(function (li) { jestvujuce[li.getAttribute('data-kod')] = li; });
    var prazdny = $('.list-prazdny', riadky);

    volby.forEach(function (v) {
      var rozsah = v.getAttribute('data-ceny').split('|')[tr].split('-');
      var a = parseInt(rozsah[0], 10), b = parseInt(rozsah[1], 10);
      var kod = v.getAttribute('data-kod');
      var label = v.closest('.ukon');
      $('.ukon-cena', label).textContent = cena(a, b);
      zrkadla.forEach(function (z) {
        if (z.getAttribute('data-zrkadlo') !== kod) return;
        z.checked = v.checked;
        var c = $('[data-zrkadlo-cena="' + kod + '"]');
        if (c) c.textContent = cena(a, b);
      });
      var li = jestvujuce[kod];
      if (v.checked) {
        od += a; doo += b; pocet++;
        var m = parseInt(v.getAttribute('data-min'), 10);
        minuty += m;
        if (!li) {
          li = document.createElement('li');
          li.setAttribute('data-kod', kod);
          if (nove) li.className = 'novy';
          var meno = document.createElement('b');
          meno.textContent = $('.ukon-meno', label).firstChild.textContent;
          var popis = document.createElement('small');
          var cenaEl = document.createElement('span');
          cenaEl.className = 'cena';
          li.appendChild(meno); li.appendChild(cenaEl); li.appendChild(popis);
          riadky.appendChild(li);
        }
        $('.cena', li).textContent = cena(a, b);
        $('small', li).textContent = v.getAttribute('data-popis') + (m ? ', ' + trvanie(m) : '');
      } else if (li) {
        li.remove();
      }
    });

    if (!pocet && !prazdny) {
      prazdny = document.createElement('li');
      prazdny.className = 'list-prazdny';
      prazdny.textContent = 'List je prázdny. Zaškrtnite v' + NB + 'cenníku, čo auto potrebuje.';
      riadky.appendChild(prazdny);
    } else if (pocet && prazdny) {
      prazdny.remove();
    }

    nastavPocitadla(od, doo);
    var casText = !pocet ? 'podľa úkonov'
      : (minuty ? trvanie(minuty) + ', ' : '') + (minuty <= 300 ? 'hotové v' + NB + 'ten' + NB + 'istý deň' : 'auto si necháme do' + NB + 'druhého dňa');
    if (casEl) casEl.textContent = casText;
    if (hlas) {
      hlas.textContent = (oznam ? oznam + ' ' : '') + (pocet
        ? 'Spolu orientačne ' + od + ' až ' + doo + ' eur, počet úkonov ' + pocet + ', auto ' + TRIEDY[tr] + '.'
        : 'Zákazkový list je prázdny.');
      oznam = '';
    }
    if (listaSucet && listaPopis) {
      listaSucet.hidden = !pocet;
      if (!pocet) listaPopis.textContent = kratky || 'V' + NB + 'pracovné dni 7:00 až 17:00';
      else if (!dotknute) listaPopis.textContent = 'Príklad: výmena oleja, ' + TRIEDY[tr] + ' auto';
      else listaPopis.textContent = pocet === 1 ? '1 úkon, orientačne' : (pocet < 5 ? pocet + ' úkony, orientačne' : pocet + ' úkonov, orientačne');
    }
  }

  if (riadky && volby.length) {
    var podlaKodu = {};
    volby.forEach(function (v) { podlaKodu[v.getAttribute('data-kod')] = v; });
    function zmena(v) {
      dotknute = true;
      zapni('uvod'); zapni('list');
      // predné platničky a platničky s kotúčmi: do listu ide len jedna z dvoch možností
      var druhy = v.checked && podlaKodu[v.getAttribute('data-vylucuje')];
      if (druhy && druhy.checked) {
        druhy.checked = false;
        oznam = v.getAttribute('data-kod') === 'kotuce'
          ? 'Platničky sú v cene výmeny s kotúčmi, samostatný riadok sme z listu vybrali.'
          : 'Výmenu s kotúčmi sme z listu vybrali, ostali len platničky.';
      }
      prepocitaj(true);
    }
    volby.concat(radia).forEach(function (v) {
      v.addEventListener('change', function () { zmena(v); });
    });
    zrkadla.forEach(function (z) {
      z.addEventListener('change', function () {
        var v = podlaKodu[z.getAttribute('data-zrkadlo')];
        if (!v) return;
        v.checked = z.checked;
        zmena(v);
      });
    });
    prepocitaj(false);

    // Prvé pretočenie z núl. Úvod: krátko po načítaní, keď je list vysunutý. Celý list: keď príde na obrazovku.
    // Sleduje sa obal listu, nie list: prvok s clip-path hlási prienik nespoľahlivo.
    var obal = $('.list-obal');
    if ('IntersectionObserver' in window && obal) {
      var io = new IntersectionObserver(function (z) {
        z.forEach(function (x) { if (x.isIntersecting) { io.disconnect(); zapni('list'); } });
      }, { threshold: 0.25 });
      io.observe(obal);
    } else {
      zapni('list');
    }
    // Úvod: pretočí sa, až keď je riadok súčtu naozaj na obrazovke (na mobile býva pod ohybom), nie pevne po načítaní.
    var uvodSucet = $('.hl-sucet');
    if ('IntersectionObserver' in window && uvodSucet) {
      var ioUvod = new IntersectionObserver(function (z) {
        z.forEach(function (x) {
          if (!x.isIntersecting) return;
          ioUvod.disconnect();
          setTimeout(function () { zapni('uvod'); }, 380);
        });
      }, { threshold: 0.6 });
      var sleduj = function () { ioUvod.observe(uvodSucet); };
      if (document.readyState === 'complete') sleduj();
      else window.addEventListener('load', sleduj);
    } else {
      zapni('uvod');
    }
  }

  // ---------- spodná lišta ----------
  var lista = $('.lista');
  // Lišta je schovaná, kým je na obrazovke iné Zavolať: tlačidlo v úvode (od 600 px) alebo hlavička (mobil, kde v úvode nie je).
  var strazcovia = [$('.hero-akcie'), $('.hlava')].filter(Boolean);
  if (lista && strazcovia.length && 'IntersectionObserver' in window) {
    lista.classList.add('schovana');
    var vidno = [];
    var ioLista = new IntersectionObserver(function (z) {
      z.forEach(function (x) {
        var i = vidno.indexOf(x.target);
        if (x.isIntersecting && i === -1) vidno.push(x.target);
        else if (!x.isIntersecting && i !== -1) vidno.splice(i, 1);
      });
      lista.classList.toggle('schovana', vidno.length > 0);
    });
    strazcovia.forEach(function (s) { ioLista.observe(s); });
  }
})();
