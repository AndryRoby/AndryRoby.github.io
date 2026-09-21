/* E-faktúra v4 (Fable, 21. 9. 2026): len vzhľad a správanie plochy, žiadna logika nástroja.
   Kontrolu, náhľad, generátor aj platbu robí app.js a tento súbor sa ich nedotýka: iba číta,
   ktorá záložka je otvorená a či už existuje výsledok, a zapíše to na hero ako data-tab
   a data-vysledok, podľa čoho CSS poskladá plochu. Bez tohto súboru nástroj funguje celý,
   len ukážka výsledku ostane v ráme pod skutočným výsledkom.
   Pridáva: posun k výsledku na úzkej obrazovke, svetlo pod kurzorom (Magic Card),
   dopočítanie počtu pravidiel (Number Ticker), príchod sekcií pri rolovaní a meranie
   pretiahnutia súboru (kliknutia meria Umami samo cez data-umami-event). */
(function () {
  'use strict';
  var ticho = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hero = document.getElementById('hero');
  var PANELY = ['kontrola', 'nahlad', 'vytvorit'];

  /* Stav plochy: otvorená záložka a existencia výsledku. */
  if (hero) {
    var akcie = document.getElementById('akcie');
    var mal = hero.getAttribute('data-vysledok') === '1';
    var nacitane = false;
    var stav = function () {
      var tab = 'kontrola';
      PANELY.forEach(function (p) { var el = document.getElementById('panel-' + p); if (el && !el.hidden) tab = p; });
      hero.setAttribute('data-tab', tab);
      var je = !!akcie && !akcie.hidden;
      hero.setAttribute('data-vysledok', je ? '1' : '0');
      /* Na úzkej obrazovke je výsledok pod vstupom mimo okna: po kontrole sa k nemu plocha posunie. */
      if (je && !mal && nacitane && tab === 'kontrola') {
        var ram = document.querySelector('#panel-kontrola .ef-pravy');
        if (ram) {
          var r = ram.getBoundingClientRect();
          var vyska = window.innerHeight || 800;
          if (r.top > vyska * 0.62 || r.top < 0) {
            try { ram.scrollIntoView({ behavior: ticho ? 'auto' : 'smooth', block: 'start' }); } catch (e) { ram.scrollIntoView(); }
          }
        }
      }
      mal = je;
    };
    if ('MutationObserver' in window) {
      var oko = new MutationObserver(stav);
      PANELY.forEach(function (p) { var el = document.getElementById('panel-' + p); if (el) oko.observe(el, { attributes: true, attributeFilter: ['hidden'] }); });
      if (akcie) oko.observe(akcie, { attributes: true, attributeFilter: ['hidden'] });
    }
    stav();
    window.addEventListener('load', function () { stav(); nacitane = true; });
    setTimeout(function () { nacitane = true; }, 1500);

    /* Odkaz na záložku, ktorá je už v adrese, nevyvolá hashchange: k nástroju sa posunieme sami. */
    Array.prototype.forEach.call(document.querySelectorAll('main a[href^="#"]'), function (a) {
      var ciel = (a.getAttribute('href') || '').slice(1);
      if (PANELY.indexOf(ciel) === -1) return;
      a.addEventListener('click', function () {
        if ((location.hash || '').slice(1) !== ciel) return;
        var n = document.getElementById('nastroj');
        if (n) { try { n.scrollIntoView({ behavior: ticho ? 'auto' : 'smooth', block: 'start' }); } catch (e) { n.scrollIntoView(); } }
      });
    });

    /* Pretiahnutie súboru nie je kliknutie, preto ho Umami samo nezachytí. */
    var dz = document.getElementById('dropzone');
    if (dz) dz.addEventListener('drop', function () {
      try { if (window.umami && typeof window.umami.track === 'function') window.umami.track('efaktura_hero_vstup', { sposob: 'pretiahnutie' }); } catch (e) { /* meranie nikdy neblokuje nástroj */ }
    });
  }

  /* Magic Card: poloha kurzora do --mx a --my, zápis raz za rámec. Len na myši. */
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    Array.prototype.forEach.call(document.querySelectorAll('.ef-dl'), function (dl) {
      var caka = false, vnutri = false, x = 0, y = 0;
      dl.addEventListener('pointermove', function (e) {
        var b = dl.getBoundingClientRect();
        x = e.clientX - b.left; y = e.clientY - b.top; vnutri = true;
        if (caka) return;
        caka = true;
        requestAnimationFrame(function () {
          caka = false;
          if (!vnutri) return;
          dl.style.setProperty('--mx', x + 'px');
          dl.style.setProperty('--my', y + 'px');
        });
      }, { passive: true });
      dl.addEventListener('pointerleave', function () {
        vnutri = false;
        dl.style.removeProperty('--mx');
        dl.style.removeProperty('--my');
      });
    });
  }

  if (ticho || !('IntersectionObserver' in window)) return;

  /* Number Ticker: počet pravidiel sa dopočíta, keď sa objaví. Číslo v HTML je pravdivé aj bez skriptu. */
  Array.prototype.forEach.call(document.querySelectorAll('[data-do]'), function (el) {
    var ciel = parseInt(el.getAttribute('data-do'), 10);
    if (!isFinite(ciel) || ciel <= 0) return;
    var okoCisla = new IntersectionObserver(function (z) {
      if (!z[0].isIntersecting) return;
      okoCisla.disconnect();
      var t0 = null;
      function krok(t) {
        if (!t0) t0 = t;
        var p = Math.min(1, (t - t0) / 900), k = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(ciel * k));
        if (p < 1) requestAnimationFrame(krok); else el.textContent = String(ciel);
      }
      requestAnimationFrame(krok);
    }, { threshold: 0.6 });
    okoCisla.observe(el);
  });

  /* Príchod pri rolovaní. Raz a dosť. Najprv sa všetko zmeria, až potom sa zapisuje. */
  var hranica = (window.innerHeight || 800) * 0.92;
  var podOknom = Array.prototype.filter.call(document.querySelectorAll('.zjav'), function (el) {
    return el.getBoundingClientRect().top > hranica;
  });
  if (!podOknom.length) return;
  var okoSekcii = new IntersectionObserver(function (zaznamy) {
    zaznamy.forEach(function (z) {
      if (!z.isIntersecting) return;
      z.target.classList.remove('caka');
      z.target.classList.add('je');
      okoSekcii.unobserve(z.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  podOknom.forEach(function (el) { el.classList.add('caka'); okoSekcii.observe(el); });

  /* Poistka: návrat z histórie, skok na kotvu ani tlač nesmú nechať nič skryté. */
  function odkry() { podOknom.forEach(function (el) { el.classList.remove('caka'); }); }
  window.addEventListener('pageshow', function (e) { if (e.persisted) odkry(); });
  window.addEventListener('hashchange', odkry);
  window.addEventListener('beforeprint', odkry);
})();
