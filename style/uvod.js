/* Úvod arling.sk v4 (Fable, 21. 9. 2026). Bez JS stránka funguje celá: details menu, statické ceny,
   všetky sekcie viditeľné. S JS: príchod scény, odhalenie pri rolovaní, lampa, lúče, meteory,
   Magic Card svetlo pod kurzorom, Number Ticker a menu, ktoré sa zatvára rozumne. */
(function () {
  'use strict';
  var koren = document.documentElement;
  var ticho = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Úvod je explicitná voľba jazyka; produktové stránky sa cez logo vracajú sem v tom istom jazyku. */
  var jazyk = (koren.lang || '').slice(0, 2).toLowerCase();
  if (['sk', 'en', 'de'].indexOf(jazyk) !== -1) {
    try { localStorage.setItem('arling_hub_lang', jazyk); } catch (e) {}
  }

  /* Menu: Produkty, jazyk a mobilné menu sú details. Otvorí sa vždy len jedno, zatvára sa
     kliknutím na odkaz, mimo hlavičky, klávesom Escape a pri zmene šírky. Na myši sa
     Produkty otvárajú prejdením s malým oneskorením, aby nepreblikovali. */
  var hlavicka = document.querySelector('header');
  if (hlavicka) {
    var cakaH = false;
    var hlavickaStav = function () { cakaH = false; hlavicka.classList.toggle('plny', window.scrollY > 12); };
    window.addEventListener('scroll', function () { if (!cakaH) { cakaH = true; requestAnimationFrame(hlavickaStav); } }, { passive: true });
    hlavickaStav();
  }
  var pas = document.querySelector('header .pas');
  if (pas) {
    var detaily = Array.prototype.slice.call(pas.querySelectorAll('details'));
    var zatvor = function (okrem) {
      detaily.forEach(function (d) { if (d !== okrem && d.open) d.open = false; });
    };
    detaily.forEach(function (d) {
      d.addEventListener('toggle', function () { if (d.open) zatvor(d); });
      d.addEventListener('click', function (e) { if (e.target.closest('a')) d.open = false; });
    });
    document.addEventListener('click', function (e) { if (!pas.contains(e.target)) zatvor(null); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var o = detaily.filter(function (d) { return d.open; })[0];
      if (o) { o.open = false; var s = o.querySelector('summary'); if (s) s.focus(); }
    });
    var prod = pas.querySelector('.prod');
    if (prod && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      var cas;
      prod.addEventListener('pointerenter', function () { clearTimeout(cas); cas = setTimeout(function () { prod.open = true; }, 90); });
      prod.addEventListener('pointerleave', function () { clearTimeout(cas); cas = setTimeout(function () { prod.open = false; }, 180); });
      /* Na myši klik na slovo Produkty otvorené menu nezatvára (Andrej 21. 9.); zatvára odchod kurzora, Escape, klik mimo. */
      var sumar = prod.querySelector('summary');
      if (sumar) sumar.addEventListener('click', function (e) { if (prod.open) e.preventDefault(); });
    }
    window.matchMedia('(min-width: 761px)').addEventListener('change', function () { zatvor(null); });
  }

  /* Príchod scény: pustí sa až keď je hlavná snímka naozaj na obrazovke, aby rám nenaskočil do prázdna. */
  function spusti() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { koren.classList.remove('pred'); });
    });
  }
  var hlavna = document.querySelector('.hero .ramec img');
  if (!hlavna || hlavna.complete) spusti();
  else {
    hlavna.addEventListener('load', spusti, { once: true });
    hlavna.addEventListener('error', spusti, { once: true });
    setTimeout(spusti, 1800);
  }

  if (ticho.matches) {
    document.querySelectorAll('.zjav').forEach(function (el) { el.classList.add('je'); });
    return;
  }

  /* Odhalenie sekcií pri rolovaní. Raz a dosť. */
  var oko = new IntersectionObserver(function (zaznamy) {
    zaznamy.forEach(function (z) {
      if (z.isIntersecting) { z.target.classList.add('je'); oko.unobserve(z.target); }
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
  document.querySelectorAll('.zjav').forEach(function (el) { oko.observe(el); });

  /* Tiché nadýchnutie svetla pod scénou, najviac osem pixelov. Číta sa raz za rámec v rAF,
     zapisuje sa len transform, beží len kým je svetlo na obrazovke. */
  var svetla = Array.prototype.slice.call(document.querySelectorAll('.lampa'));
  var vidno = [], caka = false;
  var okoSvetla = new IntersectionObserver(function (zaznamy) {
    zaznamy.forEach(function (z) {
      var i = vidno.indexOf(z.target);
      if (z.isIntersecting && i < 0) vidno.push(z.target);
      if (!z.isIntersecting && i >= 0) vidno.splice(i, 1);
    });
    if (vidno.length) kresli();
  }, { threshold: 0 });
  svetla.forEach(function (el) { okoSvetla.observe(el); });
  function kresli() {
    caka = false;
    var h = window.innerHeight;
    var miery = vidno.map(function (el) { return el.getBoundingClientRect(); });
    vidno.forEach(function (el, i) {
      var r = miery[i];
      var p = (r.top + r.height / 2 - h / 2) / h;
      if (p < -1) p = -1; else if (p > 1) p = 1;
      el.style.transform = 'translate3d(0,' + (p * 8).toFixed(1) + 'px,0)';
    });
  }
  window.addEventListener('scroll', function () {
    if (!caka && vidno.length) { caka = true; requestAnimationFrame(kresli); }
  }, { passive: true });
  window.addEventListener('resize', function () { if (vidno.length) kresli(); }, { passive: true });

  /* Light Rays a Meteors: deterministický generátor, aby snímky aj načítania vyzerali rovnako. */
  var hero = document.querySelector('.hero'), luce = document.querySelector('.luce');
  var seed = 7;
  function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  if (hero && luce) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < 7; i++) {
      var r = document.createElement('span'); r.className = 'luc';
      r.style.cssText = '--l:' + (8 + rnd() * 84).toFixed(1) + '%;--r:' + (-28 + rnd() * 56).toFixed(1) + 'deg;--w:' + Math.round(160 + rnd() * 160) + 'px;--s:' + (0.8 + rnd() * 1.8).toFixed(2) + 'deg;--d:' + (rnd() * 14).toFixed(1) + 's;--t:' + (14 * (0.75 + rnd() * 0.5)).toFixed(1) + 's;--i:' + (0.35 + rnd() * 0.3).toFixed(2);
      frag.appendChild(r);
    }
    for (var m = 0; m < 6; m++) {
      var k = document.createElement('span'); k.className = 'meteor';
      k.style.cssText = '--x:' + (10 + rnd() * 80).toFixed(1) + '%;--y:' + (-5 + rnd() * 40).toFixed(1) + '%;--d:' + (rnd() * 12).toFixed(1) + 's;--t:' + (9 + rnd() * 8).toFixed(1) + 's';
      frag.appendChild(k);
    }
    luce.appendChild(frag);
    /* Mimo obrazovky sa nič nehýbe. */
    new IntersectionObserver(function (z) { hero.classList.toggle('spi', !z[0].isIntersecting); }, { threshold: 0 }).observe(hero);
  }

  /* Magic Card: svetlo sleduje kurzor, zapisuje sa len v rAF. */
  document.querySelectorAll('.dl').forEach(function (dl) {
    var cakaDl = false, x = 0, y = 0;
    dl.addEventListener('pointermove', function (e) {
      var b = dl.getBoundingClientRect(); x = e.clientX - b.left; y = e.clientY - b.top;
      if (!cakaDl) {
        cakaDl = true;
        requestAnimationFrame(function () { cakaDl = false; dl.style.setProperty('--mx', x + 'px'); dl.style.setProperty('--my', y + 'px'); });
      }
    }, { passive: true });
    dl.addEventListener('pointerleave', function () { dl.style.setProperty('--mx', '50%'); dl.style.setProperty('--my', '50%'); });
  });

  /* Number Ticker: dopočíta cenu, keď sa objaví; kritické tlmenie, žiadny prestrel. */
  var cisla = document.querySelectorAll('.ceny b[data-do]');
  if (cisla.length) {
    var des = koren.lang.slice(0, 2) === 'en' ? '.' : ',';
    var fmt = function (v, d) { return v.toFixed(d).replace('.', des); };
    var okoCisel = new IntersectionObserver(function (z) {
      z.forEach(function (e) {
        if (!e.isIntersecting) return;
        okoCisel.unobserve(e.target);
        var el = e.target, ciel = parseFloat(el.dataset.do), d = +el.dataset.des, jed = el.dataset.jed || '', t0 = null;
        function krok(t) {
          if (!t0) t0 = t;
          var p = Math.min(1, (t - t0) / 900), kk = 1 - Math.pow(1 - p, 3);
          el.textContent = fmt(ciel * kk, d) + jed;
          if (p < 1) requestAnimationFrame(krok);
        }
        el.textContent = fmt(0, d) + jed;
        requestAnimationFrame(krok);
      });
    }, { threshold: 0.6 });
    cisla.forEach(function (el) { okoCisel.observe(el); });
  }
})();
