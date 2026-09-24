/* The live parts of /api/: the puzzle explorer, the code tabs with Copy and
 * Run, and the messages the embedded puzzles post to this page.
 *
 * Everything it builds comes from ukazky.js (window.ArlingApi), the same file
 * api/docs.test.mjs checks in Node. Everything it fetches is one of our own
 * static files on this same host: no analytics, no storage, no third party.
 *
 * Without JavaScript the page still reads top to bottom: the HTML carries
 * the files of otters-easy-001, all six code samples one under another, and
 * the buttons that need a script stay hidden.
 *
 * It is a plain script and not a module because the page's
 * Content-Security-Policy allows only scripts from this site: no inline code,
 * no eval, no hash to keep in step (ops/design/csp-hash.mjs).
 */
(function () {
  'use strict';
  var A = window.ArlingApi;
  var $ = function (id) { return document.getElementById(id); };
  if (!A) return;

  var POKOJ = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var kazdy = function (zoznam, fn) { Array.prototype.forEach.call(zoznam, fn); };

  /* Tlačidlá, ktoré bez skriptu nič nerobia, sú v HTML skryté. */
  kazdy(document.querySelectorAll('[data-kopiruj], [data-spusti], #v-pred, #v-dalsi, #v-nahodny'), function (el) { el.hidden = false; });

  function clanok(slovo) { return /^[AEIOU]/.test(slovo) ? 'an ' : 'a '; }

  /* ── 1. Rámy na tejto stránke: výška a správy ──────────────────────────
     Hlavolam hlási svoju výšku (správa "size") až vtedy, keď ho o to rodič
     požiada; potom sa rám prispôsobí a nemá vlastný scrollbar. Rám zo
     skriptu embed.js si výšku stráži sám, tu sa len vypíšu jeho správy. */
  var mojeRamy = [];
  function vypytajVysku(ram) {
    try { ram.contentWindow.postMessage({ type: 'arling-puzzle-host', event: 'auto-height' }, '*'); } catch (x) { /* ešte nie je */ }
  }
  function sleduj(ram) {
    if (!ram) return;
    mojeRamy.push(ram);
    ram.addEventListener('load', function () { vypytajVysku(ram); });
    vypytajVysku(ram);
  }
  sleduj($('nahlad'));

  function ramPodla(zdroj) {
    var ramy = document.getElementsByTagName('iframe');
    for (var i = 0; i < ramy.length; i++) if (ramy[i].contentWindow === zdroj) return ramy[i];
    return null;
  }

  function riadok(text, trieda) {
    var li = document.createElement('li');
    if (trieda) li.className = trieda;
    li.textContent = text;
    return li;
  }

  function doZoznamu(zoznam, li, navrch, max) {
    var prazdne = zoznam.querySelector('.prazdne');
    if (prazdne) zoznam.removeChild(prazdne);
    if (navrch) zoznam.insertBefore(li, zoznam.firstChild);
    else zoznam.appendChild(li);
    while (zoznam.children.length > max) zoznam.removeChild(navrch ? zoznam.lastChild : zoznam.firstChild);
  }

  var log = $('sprava');
  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || m.type !== 'arling-puzzle' || e.origin !== location.origin) return;
    var ram = ramPodla(e.source);
    if (!ram) return;
    if (m.event === 'size' && mojeRamy.indexOf(ram) >= 0 && typeof m.height === 'number' && isFinite(m.height)) {
      ram.style.height = Math.min(Math.max(Math.round(m.height), 240), 2400) + 'px';
    }
    var text;
    try { text = JSON.stringify(m); } catch (x) { return; }
    var kde = ram.id === 'nahlad' ? 'the puzzle at the top' : ram.closest('#vystup-script') ? 'Run, script tag' : 'Run, iframe';
    var prvy = log && log.firstElementChild;
    if (log && (!prvy || prvy.getAttribute('data-text') !== text)) {
      var li = riadok(text);
      li.setAttribute('data-text', text);
      li.setAttribute('data-kluc', m.event + '|' + kde);
      var z = document.createElement('span');
      z.className = 'meta';
      z.textContent = '  from ' + kde;
      li.appendChild(z);
      /* Výška sa pri načítaní zmení aj trikrát za sebou: nová správa "size"
         z toho istého rámu nahradí predošlú, aby zoznam ani čítačka
         obrazovky nezahltli. */
      if (m.event === 'size' && prvy && prvy.getAttribute('data-kluc') === 'size|' + kde) log.removeChild(prvy);
      doZoznamu(log, li, true, 6);
    }
    var vystup = ram.closest('.vystup');
    var vlastny = vystup && vystup.querySelector('.konzola');
    if (vlastny && m.event !== 'size') doZoznamu(vlastny, riadok(text), false, 6);
  });

  /* ── 2. Kopírovanie ────────────────────────────────────────────────── */
  function kopiruj(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, zle) {
      var t = document.createElement('textarea');
      t.value = text;
      t.setAttribute('readonly', '');
      t.style.position = 'fixed';
      t.style.top = '0';
      t.style.left = '0';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      var hotovo = false;
      try { hotovo = document.execCommand('copy'); } catch (x) { /* starý prehliadač */ }
      document.body.removeChild(t);
      if (hotovo) ok(); else zle(new Error('copy'));
    });
  }

  function textNaKopiu(el) {
    if (el.tagName === 'OL' || el.tagName === 'UL') {
      return Array.prototype.map.call(el.children, function (li) { return li.textContent.trim(); }).join('\n');
    }
    return el.textContent;
  }

  function povedz(tlacidlo, text) {
    var h = tlacidlo.parentNode && tlacidlo.parentNode.querySelector('.hlaska');
    if (!h) return;
    h.textContent = text;
    h.classList.add('vidno');
    clearTimeout(h.casovac);
    h.casovac = setTimeout(function () {
      h.classList.remove('vidno');
      h.casovac = setTimeout(function () { h.textContent = ''; }, 250);
    }, 2600);
  }

  /* ── 3. Prieskumník ────────────────────────────────────────────────── */
  var kindEl = $('v-kind');
  var cisloEl = $('v-index');
  var radia = document.querySelectorAll('input[name="v-difficulty"]');
  var stavEl = $('v-stav');
  var imgZ = $('img-zadanie');
  var imgR = $('img-riesenie');
  var jsonEl = $('json-vystup');
  var poliaEl = $('polia');
  if (!kindEl || !cisloEl || !imgZ || !imgR || !jsonEl || !poliaEl) return;

  function obtiaznost() {
    for (var i = 0; i < radia.length; i++) if (radia[i].checked) return radia[i].value;
    return 'easy';
  }
  function aktualny() { return A.stav(kindEl.value, obtiaznost(), cisloEl.value); }

  var pamat = {};
  function nacitaj(cesta) {
    if (pamat[cesta]) return pamat[cesta];
    pamat[cesta] = fetch(cesta, { credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error(r.status + ' for ' + cesta);
      return r.text();
    }).then(function (text) {
      var bajty = window.TextEncoder ? new TextEncoder().encode(text).length : text.length;
      return { text: text, json: JSON.parse(text), bajty: bajty };
    });
    pamat[cesta].catch(function () { delete pamat[cesta]; });
    return pamat[cesta];
  }

  /* Porovnáva sa celá adresa: v HTML je ./puzzles/..., tu /api/puzzles/...,
     a to je ten istý súbor. Keby sa src nastavil znova na ten istý obrázok,
     prehliadač nemusí poslať load a obrázok by ostal stlmený. */
  function obrazok(img, src, alt) {
    img.alt = alt;
    if (img.src === new URL(src, location.href).href) return;
    img.classList.add('nacita');
    img.setAttribute('src', src);
  }
  kazdy([imgZ, imgR], function (img) {
    img.addEventListener('load', function () { img.classList.remove('nacita'); });
    img.addEventListener('error', function () { img.classList.remove('nacita'); });
  });

  function nastav(id, vlastnost, hodnota) {
    var el = $(id);
    if (el) el[vlastnost] = hodnota;
    return el;
  }

  function vykresliJson(j) {
    var riadky = A.formatuj(j);
    jsonEl.textContent = '';
    jsonEl.appendChild(document.createTextNode('{\n'));
    riadky.forEach(function (r, i) {
      var s = document.createElement('span');
      s.className = 'jk';
      s.setAttribute('data-pole', r.pole);
      s.textContent = r.text;
      jsonEl.appendChild(s);
      jsonEl.appendChild(document.createTextNode(i < riadky.length - 1 ? ',\n' : '\n'));
    });
    jsonEl.appendChild(document.createTextNode('}'));
  }

  function vykresliPolia(j) {
    poliaEl.textContent = '';
    A.polia(j).forEach(function (p) {
      var d = document.createElement('div');
      d.setAttribute('data-pole', p.pole);
      var dt = document.createElement('dt');
      var c = document.createElement('code');
      c.textContent = p.pole;
      var h = document.createElement('span');
      h.className = 'hodnota';
      h.textContent = p.hodnota;
      dt.appendChild(c);
      dt.appendChild(h);
      var dd = document.createElement('dd');
      dd.textContent = p.popis;
      d.appendChild(dt);
      d.appendChild(dd);
      poliaEl.appendChild(d);
    });
  }

  /* Ukázanie poľa v súbore: myš nad vysvetlením rozsvieti ten istý kľúč
     v JSON vľavo. Je to len pomôcka, všetko podstatné je v texte. */
  function zvyrazni(pole) {
    kazdy(jsonEl.querySelectorAll('.jk'), function (s) {
      s.classList.toggle('svieti', pole !== null && s.getAttribute('data-pole') === pole);
    });
  }
  poliaEl.addEventListener('mouseover', function (e) {
    var d = e.target.closest && e.target.closest('[data-pole]');
    zvyrazni(d ? d.getAttribute('data-pole') : null);
  });
  poliaEl.addEventListener('mouseleave', function () { zvyrazni(null); });

  function vykresliPravidla(s) {
    var ol = $('pravidla');
    nastav('odkaz-navod', 'href', '/games/' + s.kind + '/guide/');
    if (!ol) return;
    nacitaj(A.cesty(s).index).then(function (z) {
      if (aktualny().kind !== s.kind) return;
      var druh = null;
      (z.json.kinds || []).forEach(function (k) { if (k.kind === s.kind) druh = k; });
      if (!druh || !druh.rules) return;
      ol.textContent = '';
      druh.rules.forEach(function (r) { ol.appendChild(riadok(r)); });
    }, function () { /* pravidlá ostanú tie, čo boli; odkaz na návod platí */ });
  }

  function zavriVystupy() {
    kazdy(document.querySelectorAll('.vystup'), function (v) { v.hidden = true; v.textContent = ''; });
  }

  var posledny = null;
  var poradie = 0;
  function vykresli() {
    var s = aktualny();
    if (posledny === s.id) return;
    var zmena = posledny !== null;
    posledny = s.id;
    var c = A.cesty(s);

    obrazok(imgZ, c.svg, 'Puzzle ' + s.id + ', ' + clanok(s.type) + s.type + ', as it prints');
    obrazok(imgR, c.solution, 'Solution of ' + s.id);
    nastav('meno-zadanie', 'textContent', s.nnn + '.svg');
    nastav('meno-riesenie', 'textContent', s.nnn + '-solution.svg');
    var dz = nastav('stiahni-zadanie', 'href', c.svg);
    if (dz) dz.setAttribute('download', 'arling-' + s.id + '.svg');
    var dr = nastav('stiahni-riesenie', 'href', c.solution);
    if (dr) dr.setAttribute('download', 'arling-' + s.id + '-solution.svg');

    nastav('adresa-json', 'textContent', A.naWebe(c.json));
    nastav('otvor-json', 'href', c.json);
    var dnes = nastav('odkaz-dnes', 'href', c.today);
    if (dnes) dnes.textContent = c.today;

    var u = A.ukazky(s);
    Object.keys(u).forEach(function (k) { nastav('kod-' + k, 'textContent', u[k]); });
    nastav('kod-id', 'textContent', s.id);
    if (zmena) zavriVystupy();

    vykresliPravidla(s);

    var moje = ++poradie;
    nacitaj(c.json).then(function (z) {
      if (moje !== poradie) return;
      vykresliJson(z.json);
      vykresliPolia(z.json);
      nastav('json-velkost', 'textContent', z.bajty + ' bytes');
      /* Rovnaký text sa nezapisuje znova, aby čítačka obrazovky pri načítaní
         stránky neohlasovala to, čo je v HTML od začiatku. */
      var veta = s.id + ': ' + clanok(s.type) + s.type + ' puzzle, ' + z.json.size + ' by ' + z.json.size + '.';
      if (stavEl && stavEl.textContent !== veta) stavEl.textContent = veta;
    }, function () {
      if (moje !== poradie) return;
      posledny = null;             // ten istý výber sa potom dá skúsiť znova
      if (stavEl) stavEl.textContent = 'Could not load ' + c.json + '. Check the connection and pick the puzzle again.';
    });
  }

  function posun(o) {
    var n = aktualny().n + o;
    if (n < 1) n = A.POCET;
    if (n > A.POCET) n = 1;
    cisloEl.value = n;
    vykresli();
  }

  kindEl.addEventListener('change', function () { vykresli(); });
  kazdy(radia, function (r) { r.addEventListener('change', function () { vykresli(); }); });
  cisloEl.addEventListener('input', function () {
    var n = Number(cisloEl.value);
    if (Math.floor(n) === n && n >= 1 && n <= A.POCET) vykresli();
  });
  cisloEl.addEventListener('change', function () {
    cisloEl.value = aktualny().n;
    vykresli();
  });
  var pred = $('v-pred'), dalsi = $('v-dalsi'), nahodny = $('v-nahodny');
  if (pred) pred.addEventListener('click', function () { posun(-1); });
  if (dalsi) dalsi.addEventListener('click', function () { posun(1); });
  if (nahodny) nahodny.addEventListener('click', function () {
    var teraz = aktualny().n, n = teraz;
    while (n === teraz) n = 1 + Math.floor(Math.random() * A.POCET);
    cisloEl.value = n;
    vykresli();
  });

  /* ── 4. Karty s ukážkami ───────────────────────────────────────────── */
  var karty = document.querySelector('[data-karty]');
  var taby = karty ? Array.prototype.slice.call(karty.querySelectorAll('[role="tab"]')) : [];
  function vyberTab(i, fokus) {
    taby.forEach(function (t, j) {
      var ano = j === i;
      t.setAttribute('aria-selected', ano ? 'true' : 'false');
      t.tabIndex = ano ? 0 : -1;
      var p = $(t.getAttribute('aria-controls'));
      if (p) p.hidden = !ano;
    });
    if (fokus && taby[i]) taby[i].focus();
  }
  if (karty && taby.length) {
    var zoznam = karty.querySelector('[role="tablist"]');
    zoznam.hidden = false;
    karty.classList.add('aktivne');
    taby.forEach(function (t, i) { t.addEventListener('click', function () { vyberTab(i, false); }); });
    zoznam.addEventListener('keydown', function (e) {
      var i = taby.indexOf(document.activeElement);
      if (i < 0) return;
      var n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % taby.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + taby.length) % taby.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = taby.length - 1;
      if (n === null) return;
      e.preventDefault();
      vyberTab(n, true);
    });
    vyberTab(0, false);
  }

  /* ── 5. Spustiť ────────────────────────────────────────────────────────
     Každé tlačidlo Run robí na tejto stránke presne to, čo úryvok nad ním,
     len s adresou z tohto servera (na arling.sk je to tá istá adresa). */
  function pripravVystup(druh, nadpis) {
    var v = $('vystup-' + druh);
    if (!v) return null;
    v.textContent = '';
    var hlava = document.createElement('p');
    hlava.className = 'vystup-hlava';
    var t = document.createElement('span');
    t.textContent = nadpis;
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'tl';
    x.textContent = 'Clear';
    x.setAttribute('aria-label', 'Clear the result');
    x.setAttribute('data-zatvor', druh);
    hlava.appendChild(t);
    hlava.appendChild(x);
    v.appendChild(hlava);
    v.hidden = false;
    v.classList.remove('ukaz');
    if (!POKOJ) { void v.offsetWidth; v.classList.add('ukaz'); }
    return v;
  }

  function konzola(popis, cakanie) {
    var ol = document.createElement('ol');
    ol.className = 'konzola';
    ol.setAttribute('aria-label', popis);
    ol.setAttribute('aria-live', 'polite');
    if (cakanie) ol.appendChild(riadok(cakanie, 'prazdne'));
    return ol;
  }

  var SPUSTI = {
    iframe: function (s, c, b) {
      var v = pripravVystup('iframe', 'Result: this iframe, running on this page');
      var ram = document.createElement('iframe');
      ram.title = s.type + ' puzzle by ARLing';
      ram.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
      ram.src = c.widget;
      v.appendChild(ram);
      sleduj(ram);
      v.appendChild(konzola('Messages from this frame', 'Waiting for the frame to say loaded.'));
      povedz(b, 'The puzzle is below');
    },
    script: function (s, c, b) {
      var v = pripravVystup('script', 'Result: this script tag, running on this page');
      var skript = document.createElement('script');
      skript.src = c.embedJs;
      skript.setAttribute('data-kind', s.kind);
      skript.setAttribute('data-difficulty', s.difficulty);
      skript.setAttribute('data-id', s.id);
      v.appendChild(skript);
      v.appendChild(konzola('Messages from this frame', 'Waiting for the frame to say loaded.'));
      povedz(b, 'The puzzle is below');
    },
    img: function (s, c, b) {
      var v = pripravVystup('img', 'Result: this picture, on this page');
      var f = document.createElement('figure');
      var img = document.createElement('img');
      img.src = c.svg;
      img.alt = s.type + ' puzzle';
      img.width = 400;
      img.style.background = '#fff';
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      var cap = document.createElement('figcaption');
      var a = document.createElement('a');
      a.href = 'https://arling.sk/';
      a.textContent = 'Puzzle by ARLing, arling.sk';
      cap.appendChild(a);
      f.appendChild(img);
      f.appendChild(cap);
      v.appendChild(f);
      povedz(b, 'The picture is below');
    },
    js: function (s, c, b) {
      var v = pripravVystup('js', 'Result: what each console.log prints');
      var ol = konzola('Console output', 'Fetching ' + c.json);
      v.appendChild(ol);
      var url = new URL(c.json, location.href).href;
      var t0 = window.performance ? performance.now() : Date.now();
      fetch(c.json, { credentials: 'omit' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      }).then(function (text) {
        var puzzle = JSON.parse(text);
        var ms = Math.round((window.performance ? performance.now() : Date.now()) - t0);
        [puzzle.id, puzzle.rules, puzzle.size, puzzle.verified.uniqueSolution, new URL(puzzle.svg.puzzle, url).href]
          .forEach(function (x) { doZoznamu(ol, riadok(String(x)), false, 20); });
        var bajty = window.TextEncoder ? new TextEncoder().encode(text).length : text.length;
        doZoznamu(ol, riadok('fetch took ' + ms + ' ms and brought ' + bajty + ' bytes', 'meta'), false, 20);
      }).catch(function (err) {
        doZoznamu(ol, riadok('The fetch failed: ' + err.message + '. Check the connection and press Run again.', 'chyba'), false, 20);
      });
      povedz(b, 'Done, see below');
    },
  };

  /* ── 6. Jedno počúvanie klikov pre celú stránku ────────────────────── */
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target : e.target.parentNode;
    if (!el || !el.closest) return;

    var spusti = el.closest('[data-spusti]');
    if (spusti) {
      var fn = SPUSTI[spusti.getAttribute('data-spusti')];
      var s = aktualny();
      if (fn) fn(s, A.cesty(s), spusti);
      return;
    }

    var zatvor = el.closest('[data-zatvor]');
    if (zatvor) {
      var druh = zatvor.getAttribute('data-zatvor');
      var v = $('vystup-' + druh);
      if (v) { v.hidden = true; v.textContent = ''; }
      var spat = document.querySelector('[data-spusti="' + druh + '"]');
      if (spat) spat.focus();
      return;
    }

    var kop = el.closest('[data-kopiruj]');
    if (kop) {
      var ciel = $(kop.getAttribute('data-kopiruj'));
      if (!ciel) return;
      kopiruj(textNaKopiu(ciel)).then(function () {
        kop.focus();
        povedz(kop, 'Copied');
      }, function () {
        kop.focus();
        povedz(kop, 'Could not copy. Select the text and copy it by hand.');
      });
      return;
    }

    var karta = el.closest('[data-karta]');
    if (karta) {
      var i = taby.indexOf($(karta.getAttribute('data-karta')));
      if (i >= 0) vyberTab(i, false);
    }
  });

  /* Prehliadač môže po návrate obnoviť výber v poliach; prvé vykreslenie
     ho zosúladí so súbormi a úryvkami. */
  vykresli();
})();
