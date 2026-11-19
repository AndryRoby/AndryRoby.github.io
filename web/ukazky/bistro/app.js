// Bistro Perón (ukážka webu od ARLing, vymyslená prevádzka): zvyšok stránky po tabuli.
// Tabuľu, čas a stav kuchyne robí tabula.js hneď za tabuľou (údaje o dni sú vo window.Peron). Tu: lišta na mobile,
// Dnes na obed (zoznam dňa sa skladá z riadkov Týždňa), Týždeň ako koľaje, dnešný deň v otváracích hodinách,
// žlté hrany nástupišťa a tmavá hlavička po posune. Ťažšia práca beží až po prvom vykreslení (kritika 3, nález 2).
(function () {
  'use strict';
  var d = document;
  var pole = function (zoznam, fn) { Array.prototype.forEach.call(zoznam, fn); };
  var DNI = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];

  // údaje z tabula.js; keby sa nenačítal, deň sa určí tu rovnako podľa Bratislavy
  function den() {
    try {
      var p = {};
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bratislava', weekday: 'short' }).formatToParts(new Date())
        .forEach(function (c) { p[c.type] = c.value; });
      return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
    } catch (e) { return new Date().getDay(); }
  }
  var P = window.Peron || { t0: { den: den() }, pohyb: !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) };
  var t0 = P.t0;
  var vikend = t0.den === 0 || t0.den === 6;
  var pohyb = P.pohyb;

  var hotovo = false;
  function zvysok() {
    if (hotovo) return;
    hotovo = true;

    // lišta na mobile: cez víkend vedie na pondelkové menu
    var listaMenu = d.querySelector('[data-lista-menu]');
    if (listaMenu && vikend) {
      listaMenu.textContent = 'Menu na pondelok';
      var lista = listaMenu.closest('.lista');
      if (lista) lista.classList.add('dlhe');
    }

    // ---------- Dnes na obed (v HTML je pondelok pre stránku bez skriptu) ----------
    var denMenu = vikend ? 1 : t0.den;
    var zdroj = d.querySelector('.tyzden-den[data-den="' + denMenu + '"]');
    var dnesDen = d.querySelector('[data-dnes-den]');
    if (dnesDen) dnesDen.textContent = vikend ? 'Cez víkend nevaríme.' : DNI[denMenu];
    var dnesNadpis = d.getElementById('dnes-nadpis');
    if (dnesNadpis && vikend) dnesNadpis.textContent = 'V pondelok na obed';

    var prvok = function (tag, trieda, text) {
      var e = d.createElement(tag);
      if (trieda) e.className = trieda;
      if (text) e.textContent = text;
      return e;
    };
    var dnesObal = d.querySelector('[data-dnes-zoznam]');
    var miska = d.querySelector('.jedlo-polievka .jedlo-znak svg');
    if (dnesObal && zdroj && denMenu !== 1) {
      var ol = prvok('ol', 'jedla');
      ol.setAttribute('aria-label', 'Menu, ' + DNI[denMenu].toLowerCase());
      pole(zdroj.querySelectorAll('.odchod'), function (z) {
        var jePol = z.hasAttribute('data-polievka');
        var cislo = z.getAttribute('data-c');
        var li = prvok('li', jePol ? 'jedlo jedlo-polievka' : 'jedlo');
        var znak = prvok('span', jePol ? 'jedlo-znak' : 'jedlo-znak jedlo-cislo', jePol ? '' : cislo);
        znak.setAttribute('aria-hidden', 'true');
        if (jePol && miska) znak.appendChild(miska.cloneNode(true));
        var text = prvok('div', 'jedlo-text');
        var nazov = prvok('p', 'jedlo-nazov');
        nazov.appendChild(prvok('span', 'skryte', jePol ? 'Polievka: ' : 'Menu ' + cislo + ': '));
        nazov.appendChild(d.createTextNode(z.querySelector('.odchod-nazov').textContent));
        var pril = z.querySelector('.odchod-pril');
        if (pril) nazov.appendChild(prvok('span', 'jedlo-pril', pril.textContent));
        var meta = prvok('p', 'jedlo-meta');
        pole(z.querySelector('.odchod-meta').childNodes, function (n) {
          if (n.nodeType === 3) meta.appendChild(d.createTextNode(n.textContent));
          else if (n.classList && n.classList.contains('odchod-stitok')) {
            meta.appendChild(d.createTextNode(' · '));
            meta.appendChild(prvok('span', 'jedlo-stitok', n.textContent.replace(/^\s*·\s*/, '')));
          }
        });
        text.appendChild(nazov);
        text.appendChild(meta);
        var cena = prvok('p', jePol ? 'jedlo-cena jedlo-cena-mala' : 'jedlo-cena', jePol ? 'v\u00a0cene menu' : z.querySelector('.odchod-cena').textContent);
        li.appendChild(znak);
        li.appendChild(text);
        li.appendChild(cena);
        ol.appendChild(li);
      });
      dnesObal.replaceChildren(ol);
    }

    // ---------- Týždeň: dni ako koľaje ----------
    var koleje = d.querySelector('.koleje');
    if (koleje) {
      var sekcia = koleje.closest('.tyzden');
      var tlacidla = koleje.querySelectorAll('[role="tab"]');
      var panely = sekcia.querySelectorAll('.tyzden-den');
      var ukaz = koleje.querySelector('.koleje-ukazovatel');
      koleje.hidden = false;
      sekcia.classList.add('ma-zalozky');
      pole(panely, function (p) {
        p.setAttribute('role', 'tabpanel');
        p.setAttribute('aria-labelledby', 'kolaj-' + p.getAttribute('data-den'));
        p.tabIndex = 0;
      });
      // ukazovateľ sa meria až v ďalšom snímku (žiadne vynútené rozloženie pri štarte)
      var posun = function (animovat) {
        var b = koleje.querySelector('[aria-selected="true"]');
        if (!b || !ukaz || !b.offsetWidth) return;
        ukaz.classList.toggle('pruzina', !!animovat && pohyb);
        ukaz.style.transform = 'translateX(' + b.offsetLeft + 'px) scaleX(' + (b.offsetWidth / 100) + ')';
      };
      var vyber = function (n, fokus, animovat) {
        pole(tlacidla, function (b) {
          var ano = b.getAttribute('data-den') === String(n);
          b.setAttribute('aria-selected', ano ? 'true' : 'false');
          b.tabIndex = ano ? 0 : -1;
          if (ano && fokus) b.focus();
        });
        pole(panely, function (p) { p.hidden = p.getAttribute('data-den') !== String(n); });
        if (animovat) posun(true);
        else requestAnimationFrame(function () { posun(false); });
      };
      pole(tlacidla, function (b, i) {
        b.addEventListener('click', function () { vyber(b.getAttribute('data-den'), false, true); });
        b.addEventListener('keydown', function (e) {
          var ciel = null;
          if (e.key === 'ArrowRight') ciel = tlacidla[(i + 1) % tlacidla.length];
          else if (e.key === 'ArrowLeft') ciel = tlacidla[(i - 1 + tlacidla.length) % tlacidla.length];
          else if (e.key === 'Home') ciel = tlacidla[0];
          else if (e.key === 'End') ciel = tlacidla[tlacidla.length - 1];
          if (ciel) { e.preventDefault(); vyber(ciel.getAttribute('data-den'), true, true); }
        });
      });
      if (!vikend) {
        var dnes = koleje.querySelector('[data-den="' + t0.den + '"]');
        if (dnes) dnes.querySelector('.kolaj-dnes').hidden = false;
      }
      // Dnešok je na tabuli aj v Dnes na obed, Týždeň preto otvorí zajtrajšok (piatok piatok, víkend pondelok).
      vyber(vikend ? 1 : Math.min(t0.den + 1, 5), false, false);
      var nacasovane = false;
      window.addEventListener('resize', function () {
        if (nacasovane) return;
        nacasovane = true;
        requestAnimationFrame(function () { nacasovane = false; posun(false); });
      });
      if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { posun(false); });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (z) { if (z.some(function (x) { return x.isIntersecting; })) posun(false); }).observe(koleje);
      }
    }

    // ---------- otváracie hodiny: dnešný deň ----------
    pole(d.querySelectorAll('.hodiny-tab tr[data-den]'), function (r) {
      if (r.getAttribute('data-den') !== String(t0.den)) return;
      r.classList.add('dnes');
      r.setAttribute('aria-current', 'date');
      var z = r.querySelector('.znacka-dnes');
      if (z) z.hidden = false;
    });

    // ---------- galéria: na mobile sa plagáty posúvajú prstom, z klávesnice šípkami (len keď sa naozaj posúva) ----------
    var rad = d.querySelector('.vitrina-rad');
    if (rad) {
      var fokusRadu = function () {
        if (rad.scrollWidth > rad.clientWidth + 1) rad.tabIndex = 0;
        else rad.removeAttribute('tabindex');
      };
      requestAnimationFrame(fokusRadu);
      window.addEventListener('resize', function () { requestAnimationFrame(fokusRadu); });
    }

    // ---------- žltá hrana nástupišťa sa natiahne pri vstupe ----------
    if (pohyb && 'IntersectionObserver' in window) {
      var io2 = new IntersectionObserver(function (zaznamy) {
        zaznamy.forEach(function (z) {
          if (!z.isIntersecting) return;
          z.target.classList.add('ide');
          z.target.classList.remove('cakaj');
          io2.unobserve(z.target);
        });
      }, { threshold: 1, rootMargin: '0px 0px -6% 0px' });
      pole(d.querySelectorAll('.hrana'), function (h) {
        h.classList.add('cakaj');
        io2.observe(h);
      });
    }
  }
  // až keď má hlavné vlákno voľno (po preklopení tabule), najneskôr o 1,8 s; nič z toho nie je v prvej obrazovke
  if (window.requestIdleCallback) requestIdleCallback(zvysok, { timeout: 1800 });
  else setTimeout(zvysok, 1200);

  // ---------- hlavička po posune (len na počítači je lepiaca) ----------
  var hlava = d.getElementById('hlava');
  if (hlava) {
    var caka = false;
    var hlavaStav = function () { caka = false; hlava.classList.toggle('tmava', window.scrollY > 24); };
    window.addEventListener('scroll', function () {
      if (!caka) { caka = true; requestAnimationFrame(hlavaStav); }
    }, { passive: true });
    hlavaStav();
  }
})();
