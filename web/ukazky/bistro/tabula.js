// Bistro Perón (ukážka webu od ARLing, vymyslená prevádzka): tabuľa odchodov s menu, čas a stav kuchyne.
// Skript stojí v HTML hneď za tabuľou (bez defer a async): parser naň čaká, preto sa prvé vykreslenie urobí len z úvodu
// a skript tabuľu doplní a spustí hneď, nečaká na zvyšok stránky ani na všetky písma (kritika 3, nález 2: na pomalom
// telefóne bola tabuľa prázdna do 2,9 s, lebo celý skript čakal na koniec HTML a na document.fonts.ready).
// Čas sa berie podľa Bratislavy: do 14:00 „Dnes“, po 14:00 od pondelka do štvrtka „Zajtra“ a zajtrajšie menu,
// od piatka 14:00 cez víkend pondelkové menu („Po víkende“, v nedeľu „Zajtra“).
// Zvyšok stránky (Dnes na obed, Týždeň, hodiny v tabuľke, lišta) robí app.js; spoločné údaje sú vo window.Peron.
(function () {
  'use strict';
  var d = document;
  var pohyb = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var DNI = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];
  var pole = function (zoznam, fn) { Array.prototype.forEach.call(zoznam, fn); };

  function dve(n) { return (n < 10 ? '0' : '') + n; }

  function teraz() {
    var den, h, m;
    try {
      var casti = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Bratislava', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date());
      var p = {};
      casti.forEach(function (c) { p[c.type] = c.value; });
      den = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
      h = parseInt(p.hour, 10);
      m = parseInt(p.minute, 10);
    } catch (e) {
      var x = new Date();
      den = x.getDay(); h = x.getHours(); m = x.getMinutes();
    }
    return { den: den, min: h * 60 + m, text: dve(h) + ':' + dve(m) };
  }

  var jeVikend = function (t) { return t.den === 0 || t.den === 6; };

  // stav kuchyne: krátke vety, aby sa zmestili do jedného riadku pätky tabule aj pri 360 px
  function stav(t) {
    if (jeVikend(t)) return { text: 'Cez víkend nevaríme.', vari: false };
    if (t.min < 660) return { text: 'Obed odchádza o\u00a011:00.', vari: false };
    if (t.min < 840) return { text: 'Kuchyňa varí do 14:00.', vari: true };
    return { text: t.den === 5 ? 'Dovarili sme. V\u00a0pondelok od 11:00.' : 'Dovarili sme. Zajtra od 11:00.', vari: false };
  }

  // ktorý deň ukáže tabuľa („ďalší spoj“) a akým slovom (kritika 3, nález 4)
  function tabulaPre(t) {
    if (jeVikend(t) || (t.den === 5 && t.min >= 840)) return { den: 1, znacka: t.den === 0 ? 'Zajtra' : 'Po víkende' };
    if (t.min >= 840) return { den: t.den + 1, znacka: 'Zajtra' };
    return { den: t.den, znacka: 'Dnes' };
  }

  // Spustí sa, keď je v DOM prvok #tabula-udaje (je hneď za tabuľou, teda hlavička, hodiny aj tabuľa sú už načítané).
  var hotove = false;
  var pozorovatel = null;
  function skus() {
    if (hotove || !d.getElementById('tabula-udaje')) return;
    hotove = true;
    if (pozorovatel) pozorovatel.disconnect();
    hlavne();
  }
  skus();
  if (!hotove) {
    if ('MutationObserver' in window) {
      pozorovatel = new MutationObserver(skus);
      pozorovatel.observe(d.documentElement, { childList: true, subtree: true });
    }
    d.addEventListener('DOMContentLoaded', skus);
  }

  function hlavne() {
  // ---------- hodiny a stav kuchyne (hlavička, panel hodín, pätka tabule) ----------
  var casovac = null;
  function obnov() {
    var t = teraz();
    var s = stav(t);
    pole(d.querySelectorAll('[data-cas]'), function (el) {
      el.textContent = t.text;
      if (el.tagName === 'TIME') el.setAttribute('datetime', t.text);
    });
    pole(d.querySelectorAll('[data-stav]'), function (el) { el.textContent = s.text; });
    pole(d.querySelectorAll('[data-bod]'), function (el) { el.classList.toggle('vari', s.vari); });
    return t;
  }
  function planuj() {
    clearTimeout(casovac);
    casovac = setTimeout(function () { obnov(); planuj(); }, 60000 - (Date.now() % 60000) + 80);
  }
  d.addEventListener('visibilitychange', function () {
    if (d.hidden) { clearTimeout(casovac); } else { obnov(); planuj(); }
  });

  var t0 = obnov();
  planuj();
  pole(d.querySelectorAll('[data-cas-obal]'), function (el) { el.classList.add('ide'); });
  var tab = tabulaPre(t0);
  window.Peron = { t0: t0, vikend: jeVikend(t0), tabula: tab, DNI: DNI, pohyb: pohyb };

  // ---------- tabuľa: obsah podľa dňa (údaje sú v data-* atribútoch, menu je v HTML len raz pre Týždeň) ----------
  var tabula = d.getElementById('tabula');
  var udaje = d.getElementById('tabula-udaje');
  if (!tabula || !udaje) return;
  var den = udaje.querySelector('[data-den="' + tab.den + '"]');
  if (!den) return;
  var znacka = tabula.querySelector('[data-tabula-znacka]');
  if (znacka) znacka.textContent = tab.znacka;
  tabula.querySelector('.tabula-den').textContent = DNI[tab.den];
  tabula.querySelector('.tabula-polievka-text').textContent = den.getAttribute('data-polievka');
  var jedla = den.getAttribute('data-jedla').split('|');
  var ceny = den.getAttribute('data-ceny').split('|');
  pole(tabula.querySelectorAll('.tabula-riadok'), function (r, i) {
    r.querySelector('.t-jedlo').textContent = jedla[i] || '';
    r.querySelector('.t-cena [data-klapka]').textContent = ceny[i] || '';
  });

  // ---------- tabuľa: klapky ----------
  var ZAKLAD = { 'á': 'a', 'ä': 'a', 'č': 'c', 'ď': 'd', 'é': 'e', 'í': 'i', 'ĺ': 'l', 'ľ': 'l', 'ň': 'n', 'ó': 'o', 'ô': 'o', 'ŕ': 'r', 'š': 's', 'ť': 't', 'ú': 'u', 'ý': 'y', 'ž': 'z' };
  var BUBNY = ['ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz', '0123456789', '.,:;'];

  // znaky, cez ktoré klapka prejde pred cieľovým znakom (ako na skutočnom bubne tabule)
  function cesta(ch, n) {
    var nizke = ch.toLowerCase();
    var b = ZAKLAD[nizke] ? (ch === nizke ? ZAKLAD[nizke] : ZAKLAD[nizke].toUpperCase()) : ch;
    var buben = BUBNY[3];
    for (var i = 0; i < BUBNY.length; i++) { if (BUBNY[i].indexOf(b) >= 0) { buben = BUBNY[i]; break; } }
    var poz = buben.indexOf(b);
    if (poz < 0) poz = 0;
    var out = [' '];
    for (var k = n; k >= 1; k--) out.push(buben.charAt(((poz - k) % buben.length + buben.length) % buben.length));
    out.push(ch);
    return out;
  }

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // Povolené znaky na klapke (písmená so slovenskou diakritikou, číslice, interpunkcia): idú do CSS reťazca
  // v atribúte style, preto je zoznam pevný a iný znak sa ukáže ako prázdna klapka (AGENTS.md bod 12; text
  // pre čítačky je v DOM celý a escapovaný).
  var BEZPECNE = /^[0-9A-Za-zÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽáäčďéíĺľňóôŕšťúýž.,:;\- ]$/;
  function css(c) { return "'" + (BEZPECNE.test(c) ? c : ' ') + "'"; }
  var nahoda = function (n) { return Math.floor(Math.random() * n); };
  var animovat = pohyb && 'onanimationend' in window;

  // text prvku ostane v DOM raz (pre čítačky), klapky sú len obraz (aria-hidden).
  // Klapka = 3 prvky; štyri polovice znaku kreslia ::before a ::after podľa premenných --c (teraz) a --n (ďalší).
  // Každý prvok sa postaví jedným zápisom innerHTML aj so štýlom buniek (žiadne ďalšie zápisy štýlu po jednej
  // bunke), bunky sa potom len priradia k údajom. Pohyb: 1 až 2 znaky pred správnym, krok 46 až 64 ms,
  // riadky po 60 ms, spolu asi 0,7 s.
  function naKlapky(el, riadok, posun, cislo, zoznam) {
    var text = el.textContent.replace(/\u00a0/g, ' ');
    var slova = text.split(' ').reduce(function (acc, w) {
      var posledne = acc[acc.length - 1];
      if (posledne !== undefined && posledne.length === 1 && /[a-zA-Z]/.test(posledne)) acc[acc.length - 1] = posledne + '\u00a0' + w;
      else acc.push(w);
      return acc;
    }, []);
    var html = '';
    var nove = [];
    var stlpec = 0;
    slova.forEach(function (w, wi) {
      html += (wi ? ' ' : '') + '<span class="slovo">';
      for (var ci = 0; ci < w.length; ci++) {
        var ch = w.charAt(ci);
        if (ch === '\u00a0') { html += '\u00a0'; stlpec++; continue; }
        var b = { ch: ch, riadok: riadok, stlpec: posun + stlpec };
        var styl;
        if (animovat) {
          b.znaky = cesta(ch, 1 + nahoda(2));
          var t = 46 + nahoda(19);
          b.t = t / 1000;
          styl = "--c:' ';--n:" + css(b.znaky[1]) + ';--t:' + t + 'ms;--o:' + (riadok * 60 + b.stlpec * 9 + nahoda(12)) + 'ms;--i:' + (b.znaky.length - 1);
        } else {
          styl = '--c:' + css(ch) + ';--n:' + css(ch);
        }
        html += '<span class="k' + (cislo ? ' k-c' : '') + '" style="' + styl + '"><i class="h"></i><i class="d"></i></span>';
        nove.push(b);
        stlpec++;
      }
      html += '</span>';
      stlpec++;
    });
    el.innerHTML = '<span class="skryte">' + esc(text) + '</span><span class="klapky" aria-hidden="true">' + html + '</span>';
    var kk = el.getElementsByClassName('k');
    for (var i = 0; i < nove.length; i++) { nove[i].el = kk[i]; kk[i]._b = nove[i]; zoznam.push(nove[i]); }
  }

  function nastav(k, c, n) {
    k.style.setProperty('--c', css(c));
    k.style.setProperty('--n', css(n));
  }

  var bunky = [];
  naKlapky(tabula.querySelector('.tabula-den'), 0, 0, false, bunky);
  naKlapky(tabula.querySelector('.tabula-polievka-text'), 1, 0, false, bunky);
  pole(tabula.querySelectorAll('.tabula-riadok'), function (r, i) {
    var c = r.querySelector('.t-cislo');
    if (c) { naKlapky(c, i + 2, 0, true, bunky); c.classList.add('ma-klapky'); }
    var j = r.querySelector('.t-jedlo');
    if (j) naKlapky(j, i + 2, 1, false, bunky);
    var cena = r.querySelector('.t-cena [data-klapka]');
    if (cena) naKlapky(cena, i + 2, 22, false, bunky);
  });
  if (!animovat) return;

  var bunkaZ = function (e) {
    if (e.pseudoElement !== '::after' || !e.target.classList || !e.target.classList.contains('h')) return null;
    return e.target.parentNode && e.target.parentNode._b;
  };
  tabula.addEventListener('animationiteration', function (e) {
    var b = bunkaZ(e);
    if (!b) return;
    var k = Math.min(Math.round(e.elapsedTime / b.t), b.znaky.length - 2);
    nastav(b.el, b.znaky[k], b.znaky[k + 1]);
  });
  tabula.addEventListener('animationend', function (e) {
    var b = bunkaZ(e);
    if (!b) return;
    b.el.style.setProperty('--c', JSON.stringify(b.ch));
    b.el.classList.remove('f');
  });
  // Štart, keď sú splnené tri veci: tabuľa je v obraze, rez písma tabule je načítaný (len ten jeden, nie všetky
  // písma stránky; najdlhšie 1,2 s) a karta je viditeľná. Ak to platí už teraz (bežný prípad: tabuľa je v prvej
  // obrazovke a písmo z preloadu je hotové), klapky idú hneď, bez čakania na ďalší snímok pozorovateľa.
  var vidno = false, pismo = false, spustene = false;
  // tabuľa je pri načítaní vždy v prvej obrazovke (mobil pod menom, počítač dole v úvode); s kotvou v adrese
  // (napríklad #tyzden) rozhodne pozorovateľ. Bez merania rozloženia, aby skript nenútil prehliadač počítať stránku.
  if (!location.hash) vidno = true;
  try { if (d.fonts && d.fonts.check && d.fonts.check('500 1em "Perón Mono"')) pismo = true; } catch (e) { pismo = false; }
  var spust = function () {
    if (spustene || !vidno || !pismo) return;
    if (d.hidden) {
      var raz = function () { if (!d.hidden) { d.removeEventListener('visibilitychange', raz); spust(); } };
      d.addEventListener('visibilitychange', raz);
      return;
    }
    spustene = true;
    bunky.forEach(function (b) { b.el.classList.add('f'); });
  };
  var pismoHotove = function () { if (!pismo) { pismo = true; spust(); } };
  if (!pismo) {
    if (d.fonts && d.fonts.load) {
      d.fonts.load('500 1em "Perón Mono"').then(pismoHotove, pismoHotove);
      setTimeout(pismoHotove, 1200);
    } else {
      pismoHotove();
    }
  }
  if (!vidno) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (zaznamy) {
        if (zaznamy.some(function (z) { return z.isIntersecting; })) { io.disconnect(); vidno = true; spust(); }
      }, { threshold: 0.35 });
      io.observe(tabula);
    } else {
      vidno = true;
    }
  }
  spust();
  }
})();
