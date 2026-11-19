// Clona (ukážka webu svadobnej fotografky): clona v úvode sa otvorí až po vykreslení dekódovanej fotky, znak v hlavičke
// sa ukáže, keď veľké meno odíde, filmový pás sa dá ťahať myšou so zotrvačnosťou, políčka sa pri vstupe odkryjú malou
// clonou, okno termínu ukáže vybranú sobotu alebo balík, lišta na mobile sa ukáže až keď celý úvod odíde hore.
// Bez skriptu stránka funguje celá: clona sa otvorí sama (CSS), pás sa posúva prstom a šípkami, okná otvára HTML (popover).
(function () {
  'use strict';
  var koren = document.documentElement;
  koren.classList.add('js');
  var pokoj = window.matchMedia('(prefers-reduced-motion: reduce)');
  var jemny = window.matchMedia('(hover: hover) and (pointer: fine)');
  var io = 'IntersectionObserver' in window;

  // Clona v úvode: animácia nezačne pri výpočte štýlov (na pomalom telefóne by dobehla skôr, než sa stránka vykreslí),
  // ale až keď je úvodná fotka dekódovaná a dva snímky vykreslené. Záchrana: časovač, a bez skriptu CSS po 4 s.
  var uvod = document.querySelector('.uvod');
  var obr = uvod ? uvod.querySelector('.uvod-obr') : null;
  var lamela = uvod ? uvod.querySelector('.lamela') : null;
  if (uvod && obr && lamela && !pokoj.matches) {
    var spustene = false;
    var spusti = function () {
      if (spustene) return;
      spustene = true;
      // záchranná CSS animácia už mohla začať (veľmi pomalé načítanie skriptu), vtedy ju nereštartujeme
      var a = lamela.getAnimations ? lamela.getAnimations()[0] : null;
      if (a && typeof a.currentTime === 'number' && a.currentTime > 3900) return;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { uvod.classList.add('otvor'); });
      });
    };
    var dekoduj = function () {
      if (obr.decode) obr.decode().then(spusti, spusti);
      else spusti();
    };
    if (obr.complete) dekoduj();
    else {
      obr.addEventListener('load', dekoduj, { once: true });
      obr.addEventListener('error', spusti, { once: true });
    }
    setTimeout(spusti, 2600);
  }

  // Znak v hlavičke: kým je veľké meno úvodu v obraze, hlavička ho neopakuje
  var hlava = document.querySelector('.hlava');
  var meno = document.querySelector('.uvod-meno');
  if (hlava && meno && io) {
    // výška hlavičky z CSS (56 px, od 768 px 72 px, s čiarou o 1 px viac), bez čítania rozloženia pri štarte
    var hore = window.matchMedia('(min-width: 768px)').matches ? 73 : 57;
    new IntersectionObserver(function (z) {
      hlava.classList.toggle('ukaz-znak', !z[z.length - 1].isIntersecting);
    }, { rootMargin: '-' + hore + 'px 0px 0px 0px' }).observe(meno);
  } else if (hlava) {
    hlava.classList.add('ukaz-znak');
  }

  // Filmový pás
  var svitok = document.getElementById('svitok');
  if (svitok) {
    var policka = Array.prototype.slice.call(svitok.querySelectorAll('.policko'));
    var tlacidla = Array.prototype.slice.call(document.querySelectorAll('[data-smer]'));
    var kurzor = document.querySelector('.kurzor');

    var maxPosun = function () { return svitok.scrollWidth - svitok.clientWidth; };
    var stredy = function () {
      // pozícia posunu, pri ktorej je políčko v strede (rovnako ako scroll-snap-align: center)
      return policka.map(function (p) { return p.offsetLeft + p.offsetWidth / 2 - svitok.clientWidth / 2; });
    };
    var najblizsi = function (x) {
      var s = stredy(), naj = 0;
      for (var i = 1; i < s.length; i++) { if (Math.abs(s[i] - x) < Math.abs(s[naj] - x)) naj = i; }
      return Math.max(0, Math.min(maxPosun(), s[naj]));
    };
    var obnovTlacidla = function () {
      var x = svitok.scrollLeft, m = maxPosun();
      tlacidla.forEach(function (t) {
        var koniec = t.getAttribute('data-smer') === '-1' ? x <= 2 : x >= m - 2;
        t.setAttribute('aria-disabled', koniec ? 'true' : 'false');
        t.style.opacity = koniec ? '.35' : '';
      });
    };
    var posunNa = function (x) {
      svitok.scrollTo({ left: x, behavior: pokoj.matches ? 'auto' : 'smooth' });
    };
    tlacidla.forEach(function (t) {
      t.addEventListener('click', function () {
        if (t.getAttribute('aria-disabled') === 'true') return;
        var smer = Number(t.getAttribute('data-smer'));
        var s = stredy(), x = svitok.scrollLeft, ciel = x;
        for (var i = 0; i < s.length; i++) {
          var j = smer > 0 ? i : s.length - 1 - i;
          if (smer > 0 ? s[j] > x + 4 : s[j] < x - 4) { ciel = s[j]; break; }
        }
        posunNa(Math.max(0, Math.min(maxPosun(), ciel)));
      });
    });
    var cakaObnova = false;
    svitok.addEventListener('scroll', function () {
      if (cakaObnova) return;
      cakaObnova = true;
      requestAnimationFrame(function () { cakaObnova = false; obnovTlacidla(); });
    }, { passive: true });
    window.addEventListener('resize', obnovTlacidla);
    // prvý stav tlačidiel až po prvom vykreslení: čítanie scrollWidth pri štarte by vynútilo rozloženie celej stránky
    // ešte v skripte (dlhá úloha na pomalom telefóne)
    requestAnimationFrame(function () { setTimeout(obnovTlacidla, 0); });

    // Ťahanie myšou so zotrvačnosťou (dotyk a pero nechávame prehliadaču, ten posúva sám)
    var taha = null, zotrvacnost = 0;
    var zastavZotrvacnost = function () { if (zotrvacnost) cancelAnimationFrame(zotrvacnost); zotrvacnost = 0; };
    var dobehni = function () {
      svitok.classList.remove('taha');
      posunNa(najblizsi(svitok.scrollLeft));
    };
    svitok.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      e.preventDefault();
      zastavZotrvacnost();
      taha = { x: e.clientX, posun: svitok.scrollLeft, body: [{ x: e.clientX, t: e.timeStamp }], pohol: false };
      svitok.classList.add('taha');
      if (svitok.setPointerCapture) svitok.setPointerCapture(e.pointerId);
      if (kurzor) kurzor.classList.add('stlacene');
    });
    svitok.addEventListener('pointermove', function (e) {
      if (!taha || e.pointerType !== 'mouse') return;
      var dx = e.clientX - taha.x;
      if (Math.abs(dx) > 3) taha.pohol = true;
      svitok.scrollLeft = taha.posun - dx;
      taha.body.push({ x: e.clientX, t: e.timeStamp });
      if (taha.body.length > 5) taha.body.shift();
    });
    var pusti = function (e) {
      if (!taha || e.pointerType !== 'mouse') return;
      if (kurzor) kurzor.classList.remove('stlacene');
      var b = taha.body, prvy = b[0], posledny = b[b.length - 1];
      var dt = Math.max(1, posledny.t - prvy.t);
      var v = (posledny.x - prvy.x) / dt; // px za ms, kladná rýchlosť posúva pás doľava
      taha = null;
      if (pokoj.matches || Math.abs(v) < 0.08 || e.timeStamp - posledny.t > 80) { dobehni(); return; }
      var cas = performance.now();
      var krok = function (teraz) {
        var d = Math.min(32, teraz - cas); cas = teraz;
        svitok.scrollLeft -= v * d;
        v *= Math.pow(0.94, d / 16);
        var x = svitok.scrollLeft;
        if (Math.abs(v) < 0.05 || x <= 0 || x >= maxPosun() || document.hidden) { zotrvacnost = 0; dobehni(); return; }
        zotrvacnost = requestAnimationFrame(krok);
      };
      zotrvacnost = requestAnimationFrame(krok);
    };
    svitok.addEventListener('pointerup', pusti);
    svitok.addEventListener('pointercancel', pusti);
    svitok.addEventListener('wheel', zastavZotrvacnost, { passive: true });
    document.addEventListener('visibilitychange', function () { if (document.hidden && zotrvacnost) { zastavZotrvacnost(); dobehni(); } });

    // Kurzor „Ťahajte“ len pri jemnom ukazovateli (myš, touchpad)
    if (kurzor && jemny.matches) {
      var kx = -200, ky = -200, cakaKurzor = false;
      var kresli = function () { cakaKurzor = false; kurzor.style.translate = kx + 'px ' + ky + 'px'; };
      svitok.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        kx = e.clientX; ky = e.clientY;
        if (!cakaKurzor) { cakaKurzor = true; requestAnimationFrame(kresli); }
      });
      svitok.addEventListener('pointerenter', function (e) {
        if (e.pointerType !== 'mouse') return;
        kx = e.clientX; ky = e.clientY; kresli();
        kurzor.classList.add('vidno');
      });
      svitok.addEventListener('pointerleave', function () { kurzor.classList.remove('vidno', 'stlacene'); });
    }

    // Malá clona: políčko sa odkryje hneď, ako ktorýkoľvek jeho kúsok vojde do obrazu (aj vykukujúce políčko na kraji
    // pásu, ktoré láka potiahnuť, nesmie ostať prázdne)
    if (io) {
      var pozor = new IntersectionObserver(function (zaznamy) {
        zaznamy.forEach(function (z) {
          if (z.isIntersecting) { z.target.classList.add('odkryte'); pozor.unobserve(z.target); }
        });
      }, { threshold: 0 });
      policka.forEach(function (p) { pozor.observe(p); });
    } else {
      policka.forEach(function (p) { p.classList.add('odkryte'); });
    }
  }

  // Okno termínu: ukáže vybranú sobotu alebo balík (text sa vkladá ako text, nikdy ako HTML)
  var vyber = document.getElementById('okno-vyber');
  var otvarac = null;
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[popovertarget]') : null;
    if (!b || b.getAttribute('popovertargetaction') === 'hide') return;
    otvarac = b;
    if (b.getAttribute('popovertarget') !== 'okno-termin' || !vyber) return;
    var termin = b.getAttribute('data-termin'), balik = b.getAttribute('data-balik');
    if (termin) vyber.textContent = 'Vybraný termín: ' + termin.charAt(0).toUpperCase() + termin.slice(1);
    else if (balik) vyber.textContent = 'Vybraný balík: ' + balik;
    else vyber.textContent = '';
    vyber.hidden = !vyber.textContent;
  });
  Array.prototype.forEach.call(document.querySelectorAll('.okno[popover]'), function (okno) {
    okno.addEventListener('toggle', function (e) {
      if (e.newState === 'open') {
        var z = okno.querySelector('.zavriet');
        if (z) z.focus();
      } else if (otvarac && document.contains(otvarac) && (document.activeElement === document.body || okno.contains(document.activeElement))) {
        otvarac.focus();
      }
    });
  });

  // Lišta na mobile: až keď celý úvod odíde z obrazu (nikdy pri načítaní), a nie pri kontakte a päte (tam sú tie isté
  // tlačidlá). Schovaná lišta je inert, fokus z klávesnice na ňu nepadne.
  var lista = document.querySelector('.lista');
  if (lista && io && uvod) {
    var stav = { uvod: true, koniec: false };
    var koniec = [document.getElementById('kontakt'), document.querySelector('.pata')].filter(Boolean);
    var nastavListu = function (vidno) {
      lista.classList.toggle('vidno', vidno);
      lista.inert = !vidno;
      if (vidno) lista.removeAttribute('aria-hidden'); else lista.setAttribute('aria-hidden', 'true');
    };
    nastavListu(false);
    var videne = new Map();
    var sledovanie = new IntersectionObserver(function (zaznamy) {
      zaznamy.forEach(function (z) { videne.set(z.target, z.isIntersecting); });
      stav.uvod = videne.get(uvod) !== false;
      stav.koniec = koniec.some(function (k) { return videne.get(k) === true; });
      nastavListu(!stav.uvod && !stav.koniec);
    });
    sledovanie.observe(uvod);
    koniec.forEach(function (k) { sledovanie.observe(k); });
  } else if (lista) {
    lista.classList.add('vidno');
  }
})();
