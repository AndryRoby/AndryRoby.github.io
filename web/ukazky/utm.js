// Ukážky /web/ukazky/<slug>/: prenos utm z adresy ukážky do odkazov späť na https://arling.sk/web/?z=<slug> („Chcem taký
// web“, „Späť na ukážky“, odkazy v oknách a v päte), aby dotazník človeka z príspevku, ktorý si pozrel ukážku, niesol zdroj
// (pred-fb nález 46, brána p1 G1 odp. 2, 20. 11. 2026). Rovnaké pravidlá ako web.js na /web/: len utm_source, utm_medium,
// utm_campaign a utm_content, v hodnote len znaky A-Z a-z 0-9 _ . : - a najviac 40 znakov; fbclid, gclid a iné parametre
// nikdy. Existujúce parametre odkazu (z) a kotva (#ukazky, #eshop) ostávajú. Bez utm v adrese sa nič nemení. Hodnoty idú
// len do atribútu href cez URL a searchParams, nikdy do stránky ako HTML (AGENTS.md bod 12). Jeden súbor pre všetky
// ukážky, načítaný cez <script src="../utm.js" defer> (CSP script-src 'self', bez vložených skriptov a hashov).
// Čisté funkcie medzi značkami číta test ops/weby-na-mieru/v2/front-20/pred-fb/testy/web-ukazky-utm.test.mjs.
(function () {
  'use strict';
  // @utm-ukazky-zaciatok
  var UTM_KLUCE = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
  var UTM_ODKAZY = 'a[href^="https://arling.sk/web/?z="]';
  function utmZAdresy(search) {
    var p = new URLSearchParams(search || '');
    var pary = [];
    for (var i = 0; i < UTM_KLUCE.length; i++) {
      var v = p.get(UTM_KLUCE[i]);
      if (v === null) continue;
      var ciste = v.replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 40);
      if (ciste) pary.push([UTM_KLUCE[i], ciste]);
    }
    return pary;
  }
  function sUtm(href, pary) {
    var u = new URL(href);
    if (u.origin !== 'https://arling.sk' || u.pathname !== '/web/') return href;
    for (var i = 0; i < pary.length; i++) u.searchParams.set(pary[i][0], pary[i][1]);
    return u.href;
  }
  function prenesUtm(doc, search) {
    var pary = utmZAdresy(search);
    if (!pary.length) return 0;
    var odkazy = doc.querySelectorAll(UTM_ODKAZY);
    var n = 0;
    for (var i = 0; i < odkazy.length; i++) {
      var a = odkazy[i];
      var pred = a.getAttribute('href');
      var po;
      try { po = sUtm(pred, pary); } catch (e) { continue; }
      if (po !== pred) { a.setAttribute('href', po); n++; }
    }
    return n;
  }
  // @utm-ukazky-koniec
  try { prenesUtm(document, window.location.search); } catch (e) { /* odkazy ostanú bez utm */ }
})();
