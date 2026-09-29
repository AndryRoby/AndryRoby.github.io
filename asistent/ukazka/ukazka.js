/*
 * ukazka.js: obchod "Dobrá domácnosť", vymyslený slovenský e-shop na ukážku ARLing Asistenta
 * (ops/asistent/v2/SPEC.md, časť 9). Vykreslí katalóg z feed.xml (ten istý Heureka feed, ktorý
 * spracoval worker pre demo tenanta), skutočné vyhľadávanie a filter, detail výrobku na #p-ID
 * (s JSON-LD Product, z ktorého widget berie kontext) a vloží widget.
 * Bez inline skriptu (CSP script-src 'self'), hodnoty z feedu len cez textContent a setAttribute.
 * Žiadny košík, hodnotenia ani „najpredávanejšie“: obchod nič nepredstiera.
 */
(function () {
  'use strict';

  var TENANT = 'ce535d37-f297-4b43-89dd-30aa7b6301dd';
  var ENDPOINT = 'https://arling-asistent.arling.workers.dev';
  var PORADIE = ['Kuchyňa', 'Kávovary a čaj', 'Záhrada', 'Upratovanie', 'Deti', 'Darčeky'];
  var POZDRAV = 'Dobrý deň, s čím vám poradím? Opýtajte sa na výrobok, porovnanie dvoch vecí alebo darček, odpoviem z ponuky Dobrej domácnosti.';
  var OTAZKY = ['Aký kávovar do 100 eur?', 'Máte niečo na darček pre babku?', 'Ktorý hrniec je vhodný na indukciu?', 'Čo je skladom zo záhrady?'];
  // Výstup scripts/kategorie-z-feedu.mjs pre feed.xml (test ukazka-v2 ho porovná s feedom).
  var KATEGORIE = [{"nazov":"Darčeky","obrazok":"https://arling.sk/asistent/ukazka/img/DAR-001.svg"},{"nazov":"Kávovary a čaj","obrazok":"https://arling.sk/asistent/ukazka/img/KAV-001.svg"},{"nazov":"Kuchyňa","obrazok":"https://arling.sk/asistent/ukazka/img/KUC-001.svg"}];
  var ZIVY = 'https://arling.sk/asistent/ukazka/';

  var vyrobky = [];
  var filter = '';
  var hladane = '';

  function el(tag, trieda, text) {
    var e = document.createElement(tag);
    if (trieda) e.className = trieda;
    if (text != null) e.textContent = text;
    return e;
  }

  function slug(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function bezDiakritiky(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function cena(raw) {
    var n = Number(String(raw).replace(',', '.'));
    return isFinite(n) ? n.toFixed(2).replace('.', ',') + ' €' : String(raw);
  }

  function dostupnost(d) {
    d = String(d || '').trim();
    if (d === '0') return { text: 'Skladom', trieda: 'dost-ok' };
    if (/^\d+$/.test(d)) return { text: 'Do ' + d + (d === '1' ? ' dňa' : ' dní'), trieda: 'dost-caka' };
    return { text: 'Na objednávku', trieda: 'dost-caka' };
  }

  function pocetSlovom(n) {
    return n + (n === 1 ? ' výrobok' : n >= 2 && n <= 4 ? ' výrobky' : ' výrobkov');
  }

  /** Na živom webe adresy z feedu, lokálne (náhľad, snímky) tie isté súbory z tohto priečinka. */
  function lokalne(url) {
    return location.origin + location.pathname.replace(/[^/]*$/, '') === ZIVY ? url : String(url).replace(ZIVY, new URL('./', location.href).href);
  }

  // ------------------------------------------------------------------
  // Widget (SPEC 9.4): parametre adresy len na snímky a predvádzanie
  // ------------------------------------------------------------------

  function vlozWidget() {
    var q = new URLSearchParams(location.search);
    var farba = /^[0-9a-fA-F]{6}$/.test(q.get('farba') || '') ? '#' + q.get('farba') : '#E0582A';
    var rezim = /^(tmavy|svetly|auto)$/.test(q.get('rezim') || '') ? q.get('rezim') : 'svetly';
    // Jazyk rozhrania widgetu pre snímky úvodu v EN a DE (29. 9. 2026); obchod aj feed ostávajú slovenské.
    var ui = /^(sk|en|de|cs)$/.test(q.get('ui') || '') ? q.get('ui') : 'sk';
    var s = document.createElement('script');
    var attrs = {
      'data-tenant': TENANT,
      'data-endpoint': ENDPOINT,
      'data-lang': ui,
      'data-answer-lang': 'auto',
      'data-gift': '1',
      'data-farba': farba,
      'data-rezim': rezim,
      'data-obchod': 'Dobrá domácnosť',
      'data-logo': 'img/logo.svg',
      // Bez data-meno: spúšťač nesie predvolené „Odpovedá AI“ (overenie 1: „Predavač“ patril k starému vzhľadu).
      'data-greeting': POZDRAV,
      'data-doprava': '#doprava',
      'data-questions': JSON.stringify(OTAZKY),
      'data-kategorie': JSON.stringify(KATEGORIE.map(function (k) { return { nazov: k.nazov, obrazok: lokalne(k.obrazok) }; })),
    };
    if (q.get('upoutavka') === '0') attrs['data-upoutavka'] = '0';
    if (q.get('upoutavka') === 'hned') attrs['data-upoutavka-oneskorenie'] = '0';
    Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    s.src = '../widget.js';
    document.body.appendChild(s);
  }

  function api(f, pokusy) {
    var a = window.ArlingAsistent;
    if (a) return f(a);
    if (pokusy > 0) setTimeout(function () { api(f, pokusy - 1); }, 300);
  }

  // ------------------------------------------------------------------
  // Feed
  // ------------------------------------------------------------------

  function text(uzol, tag) {
    var e = uzol.getElementsByTagName(tag)[0];
    return e && e.textContent ? e.textContent.trim() : '';
  }

  function nacitajFeed(xml) {
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('feed_parse_error');
    return Array.prototype.map.call(doc.getElementsByTagName('SHOPITEM'), function (it) {
      var kat = text(it, 'CATEGORYTEXT').split('|').map(function (s) { return s.trim(); });
      return {
        id: text(it, 'ITEM_ID').replace(/[^A-Za-z0-9_-]/g, ''),
        nazov: text(it, 'PRODUCTNAME'),
        popis: text(it, 'DESCRIPTION'),
        cena: text(it, 'PRICE_VAT'),
        znacka: text(it, 'MANUFACTURER'),
        kategoria: kat[0] || '',
        podkategoria: kat[1] || '',
        dodanie: text(it, 'DELIVERY_DATE'),
        obrazok: 'img/' + encodeURIComponent(text(it, 'ITEM_ID')) + '.svg',
        parametre: Array.prototype.map.call(it.getElementsByTagName('PARAM'), function (p) {
          return [text(p, 'PARAM_NAME'), text(p, 'VAL')];
        }).filter(function (p) { return p[0] && p[1]; }),
      };
    });
  }

  /** Fotka výrobku (v2.2): štvorec 640 x 640, podložku počas načítania dáva ukazka.css. */
  function obrazok(src, alt, lenivo) {
    var i = el('img');
    i.src = src;
    i.alt = alt || '';
    i.width = 640;
    i.height = 640;
    i.decoding = 'async';
    if (lenivo) i.loading = 'lazy';
    return i;
  }

  // ------------------------------------------------------------------
  // Zoznam: kategórie, filter, vyhľadávanie
  // ------------------------------------------------------------------

  function kategorie() {
    var podla = {};
    vyrobky.forEach(function (v) { (podla[v.kategoria] = podla[v.kategoria] || []).push(v); });
    return PORADIE.filter(function (k) { return podla[k]; }).map(function (k) { return { nazov: k, vyrobky: podla[k] }; });
  }

  function vykresliKatalog() {
    var kat = kategorie();
    var menu = document.getElementById('menu-kategorii');
    var dlazdice = document.getElementById('kategorie');
    var filtre = document.getElementById('filtre');
    menu.textContent = '';
    dlazdice.textContent = '';
    filtre.textContent = '';
    var vsetky = el('button', null, 'Všetko');
    vsetky.type = 'button';
    vsetky.setAttribute('data-kategoria', '');
    filtre.appendChild(vsetky);
    kat.forEach(function (k) {
      var li = el('li');
      var a = el('a', null, k.nazov);
      a.href = '#k-' + slug(k.nazov);
      li.appendChild(a);
      menu.appendChild(li);

      var d = el('li');
      var da = el('a');
      da.href = '#k-' + slug(k.nazov);
      da.appendChild(obrazok(k.vyrobky[0].obrazok, '', true));
      da.appendChild(el('b', null, k.nazov));
      da.appendChild(el('span', null, pocetSlovom(k.vyrobky.length)));
      d.appendChild(da);
      dlazdice.appendChild(d);

      var b = el('button', null, k.nazov);
      b.type = 'button';
      b.setAttribute('data-kategoria', k.nazov);
      filtre.appendChild(b);
    });
    filtre.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      filter = b.getAttribute('data-kategoria') || '';
      vykresliMriezku();
    });
    document.getElementById('pocet-spolu').textContent = pocetSlovom(vyrobky.length) + ' v ' + kat.length + ' kategóriách, všetko z jedného feedu.';
    var kolaz = document.getElementById('kolaz');
    kolaz.textContent = '';
    ['KAV-001', 'KUC-009', 'DAR-004'].forEach(function (id) {
      var v = vyrobky.filter(function (x) { return x.id === id; })[0];
      if (v) kolaz.appendChild(obrazok(v.obrazok, '', false));
    });
  }

  function vykresliMriezku() {
    var q = bezDiakritiky(hladane.trim());
    var zoznam = vyrobky.filter(function (v) {
      if (filter && v.kategoria !== filter) return false;
      return !q || bezDiakritiky(v.nazov + ' ' + v.kategoria + ' ' + v.podkategoria + ' ' + v.znacka).indexOf(q) !== -1;
    });
    var mriezka = document.getElementById('mriezka');
    mriezka.textContent = '';
    zoznam.forEach(function (v) {
      var li = el('li', 'karta');
      li.appendChild(obrazok(v.obrazok, '', true));
      var h = el('h3');
      var a = el('a', null, v.nazov);
      a.href = '#p-' + v.id;
      h.appendChild(a);
      li.appendChild(h);
      li.appendChild(el('div', 'cena', cena(v.cena)));
      var d = dostupnost(v.dodanie);
      li.appendChild(el('div', 'dostupnost ' + d.trieda, d.text));
      var det = el('a', 'detail', 'Detail');
      det.href = '#p-' + v.id;
      det.setAttribute('aria-label', 'Detail: ' + v.nazov);
      li.appendChild(det);
      mriezka.appendChild(li);
    });
    document.getElementById('prazdne').hidden = zoznam.length > 0;
    document.getElementById('pocet-zobrazenych').textContent = (filter ? filter + ': ' : '') + pocetSlovom(zoznam.length) + (q ? ' pre „' + hladane.trim() + '“' : '');
    Array.prototype.forEach.call(document.querySelectorAll('#filtre button'), function (b) {
      b.setAttribute('aria-pressed', String((b.getAttribute('data-kategoria') || '') === filter));
    });
    Array.prototype.forEach.call(document.querySelectorAll('#menu-kategorii a'), function (a) {
      a.setAttribute('aria-current', String(!!filter && a.textContent === filter));
    });
  }

  // ------------------------------------------------------------------
  // Detail výrobku (#p-ID) s JSON-LD Product pre kontext widgetu (U4)
  // ------------------------------------------------------------------

  var ldProdukt = null;

  function zrusLd() {
    if (ldProdukt && ldProdukt.parentNode) ldProdukt.parentNode.removeChild(ldProdukt);
    ldProdukt = null;
  }

  function vykresliDetail(v) {
    var obsah = document.getElementById('detail-obsah');
    obsah.textContent = '';
    var cesta = el('p', 'drobceky');
    var a1 = el('a', null, 'Obchod');
    a1.href = '#vyrobky';
    var a2 = el('a', null, v.kategoria);
    a2.href = '#k-' + slug(v.kategoria);
    cesta.appendChild(a1);
    cesta.appendChild(document.createTextNode(' › '));
    cesta.appendChild(a2);
    cesta.appendChild(document.createTextNode(' › ' + v.nazov));
    obsah.appendChild(cesta);

    var mriezka = el('div', 'detail-vyrobku');
    mriezka.appendChild(obrazok(v.obrazok, v.nazov));
    var pravy = el('div');
    var h1 = el('h1', null, v.nazov);
    h1.id = 'nadpis-detail';
    h1.tabIndex = -1;
    pravy.appendChild(h1);
    pravy.appendChild(el('p', 'znacka', v.znacka + (v.podkategoria ? ' · ' + v.podkategoria : '')));
    pravy.appendChild(el('div', 'cena', cena(v.cena)));
    var d = dostupnost(v.dodanie);
    pravy.appendChild(el('div', 'dostupnost ' + d.trieda, d.text));
    pravy.appendChild(el('p', 'popis', v.popis));
    if (v.parametre.length) {
      var t = el('table', 'parametre');
      var tb = el('tbody');
      v.parametre.forEach(function (p) {
        var tr = el('tr');
        var th = el('th', null, p[0]);
        th.scope = 'row';
        tr.appendChild(th);
        tr.appendChild(el('td', null, p[1]));
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      pravy.appendChild(t);
    }
    var akcie = el('div', 'akcie');
    var opytat = el('button', 'btn btn-plne', 'Opýtať sa predavača na tento výrobok');
    opytat.type = 'button';
    opytat.setAttribute('data-umami-event', 'ukazka_detail_otazka');
    opytat.addEventListener('click', function () {
      api(function (a) { a.ask('Čo treba vedieť o produkte ' + v.nazov + ' pred kúpou?'); }, 10);
    });
    akcie.appendChild(opytat);
    pravy.appendChild(akcie);
    pravy.appendChild(el('p', 'nedakupit', 'Do košíka sa tu pridať nedá, obchod je vymyslený.'));
    var spat = el('a', 'spat', 'Späť na všetky výrobky');
    spat.href = '#vyrobky';
    pravy.appendChild(spat);
    mriezka.appendChild(pravy);
    obsah.appendChild(mriezka);

    zrusLd();
    ldProdukt = document.createElement('script');
    ldProdukt.type = 'application/ld+json';
    ldProdukt.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: v.nazov,
      image: new URL(v.obrazok, location.href).href,
      offers: { '@type': 'Offer', price: v.cena, priceCurrency: 'EUR' },
    });
    document.head.appendChild(ldProdukt);
    document.title = v.nazov + ': Dobrá domácnosť (ukážka)';
    return h1;
  }

  var POVODNY_TITLE = document.title;

  function podlaAdresy(prvyRaz) {
    var h = location.hash;
    var zoznam = document.getElementById('zoznam');
    var detail = document.getElementById('detail');
    var m = /^#p-([A-Za-z0-9_-]+)$/.exec(h);
    var v = m && vyrobky.filter(function (x) { return x.id === m[1]; })[0];
    if (v) {
      var h1 = vykresliDetail(v);
      zoznam.hidden = true;
      detail.hidden = false;
      // Stránka ostane hore (drobčeky a obrázok), fokus ide na nadpis bez posunu (SPEC 9.3 bod 6).
      window.scrollTo(0, 0);
      h1.focus({ preventScroll: true });
      return;
    }
    zrusLd();
    document.title = POVODNY_TITLE;
    detail.hidden = true;
    zoznam.hidden = false;
    var k = /^#k-([a-z0-9-]+)$/.exec(h);
    if (k) {
      var kat = kategorie().filter(function (x) { return slug(x.nazov) === k[1]; })[0];
      filter = kat ? kat.nazov : '';
      vykresliMriezku();
      document.getElementById('vyrobky').scrollIntoView();
    } else if (!prvyRaz && h === '#vyrobky') {
      document.getElementById('vyrobky').scrollIntoView();
    } else if (/^#[A-Za-z][\w-]*$/.test(h) && document.getElementById(h.slice(1))) {
      // Iná kotva (napr. dlaždica Doprava a vrátenie z detailu výrobku): prehliadač skočil ešte
      // pri zobrazenom detaile, po vykreslení zoznamu je cieľ inde, preto posun až teraz (overenie 1).
      document.getElementById(h.slice(1)).scrollIntoView();
    }
  }

  // ------------------------------------------------------------------
  // Štart
  // ------------------------------------------------------------------

  vlozWidget();

  document.getElementById('opytat-sa').addEventListener('click', function () {
    api(function (a) { a.open(); }, 10);
  });
  document.getElementById('pozriet-kavovary').addEventListener('click', function (e) {
    e.preventDefault();
    location.hash = '#k-' + slug('Kávovary a čaj');
  });
  var hladat = document.getElementById('hladat');
  hladat.addEventListener('input', function () {
    hladane = hladat.value;
    if (!document.getElementById('detail').hidden) {
      location.hash = '#vyrobky';
    }
    vykresliMriezku();
  });
  hladat.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('vyrobky').scrollIntoView();
  });
  window.addEventListener('hashchange', function () { podlaAdresy(false); });

  fetch('feed.xml', { cache: 'no-cache' })
    .then(function (res) {
      if (!res.ok) throw new Error('feed_http_' + res.status);
      return res.text();
    })
    .then(function (xml) {
      vyrobky = nacitajFeed(xml);
      vykresliKatalog();
      vykresliMriezku();
      podlaAdresy(true);
      document.documentElement.setAttribute('data-vyrobky', String(vyrobky.length));
    })
    .catch(function () {
      var p = document.getElementById('prazdne');
      p.hidden = false;
      p.textContent = 'Výrobky sa nepodarilo načítať. Skúste stránku obnoviť, alebo otvorte feed.xml priamo.';
    });
})();
