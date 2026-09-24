/*
 * predvyplnenie.js: balík GDPR predvyplnený z bezplatnej kontroly e-shopu.
 *
 * Stránka https://arling.sk/kontrola-eshopu/ posiela sem odkaz s parametrom
 * v časti adresy za znakom # (napríklad #z=kontrola&n=ga4,meta&c=analyticke),
 * aby adresa e-shopu ani zoznam služieb neodišli na žiadny server ani do
 * merania návštevnosti: prehliadač časť za # neposiela.
 *
 * Skript beží v <head> pred app.js. Prečíta parameter, pripíše nájdené služby
 * k údajom formulára v localStorage (gdpr:formular:sk), ktoré app.js pri štarte
 * načíta, a parameter z adresy zmaže. Nič, čo už používateľ vyplnil, neprepíše:
 * služby a cinnosti len pridáva, web doplní len do prázdneho poľa.
 * Ak localStorage nejde (súkromné okno), zaškrtne políčka priamo vo formulári.
 */
(function () {
  'use strict';

  var KLUC = 'gdpr:formular:sk';
  var NASTROJE = ['ga4', 'umami', 'meta', 'gads', 'stripe', 'gopay', 'besteron', 'packeta', 'gls', 'posta', 'dhl',
    'mailchimp', 'ecomail', 'shoptet', 'websupport', 'hosting', 'gworkspace', 'm365', 'uctovnik', 'fakturacia'];
  var COOKIES = ['analyticke', 'marketingove'];
  var CINNOSTI = ['eshop', 'kontakt', 'newsletter', 'ucty', 'analytika', 'socialne'];

  function zoznam(hodnota, povolene) {
    return String(hodnota || '').split(',').map(function (s) { return s.trim(); })
      .filter(function (s, i, a) { return povolene.indexOf(s) !== -1 && a.indexOf(s) === i; });
  }
  function cistyText(s) {
    return String(s || '').replace(/[<>"`\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  /** Parameter z časti za # -> {nastroje, cookies, cinnosti, ine, web} alebo null. */
  function precitajParameter(hash) {
    var h = String(hash || '').replace(/^#/, '');
    if (!/(^|&)z=kontrola(&|$)/.test(h)) return null;
    var p;
    try { p = new URLSearchParams(h); } catch (e) { return null; }
    var web = '';
    try {
      var u = new URL(p.get('w') || '');
      if (u.protocol === 'https:' || u.protocol === 'http:') web = u.protocol + '//' + u.host + '/';
    } catch (e) { web = ''; }
    var ine = p.getAll('i').map(cistyText).filter(Boolean).slice(0, 6);
    return {
      nastroje: zoznam(p.get('n'), NASTROJE),
      cookies: zoznam(p.get('c'), COOKIES),
      cinnosti: zoznam(p.get('a'), CINNOSTI),
      ine: ine,
      web: web
    };
  }

  /** Pripíše predvyplnenie k uloženým údajom. Nič existujúce neprepíše. */
  function zluc(ulozene, pred) {
    var d = ulozene && typeof ulozene === 'object' ? ulozene : {};
    d.firma = d.firma && typeof d.firma === 'object' ? d.firma : {};
    d.zodpovednaOsoba = d.zodpovednaOsoba && typeof d.zodpovednaOsoba === 'object' ? d.zodpovednaOsoba : { ma: false };
    d.cinnosti = d.cinnosti && typeof d.cinnosti === 'object' ? d.cinnosti : {};
    d.cookies = d.cookies && typeof d.cookies === 'object' ? d.cookies : {};
    d.lehoty = d.lehoty && typeof d.lehoty === 'object' ? d.lehoty : {};
    d.nastroje = Array.isArray(d.nastroje) ? d.nastroje : [];
    if (typeof d.prenosMimoEU !== 'string') d.prenosMimoEU = 'nie';
    if (typeof d.nastrojeIne !== 'string') d.nastrojeIne = '';
    pred.nastroje.forEach(function (id) { if (d.nastroje.indexOf(id) === -1) d.nastroje.push(id); });
    pred.cookies.forEach(function (id) { d.cookies[id] = true; });
    pred.cinnosti.forEach(function (id) { d.cinnosti[id] = true; });
    var ine = pred.ine.filter(function (x) { return d.nastrojeIne.indexOf(x) === -1; });
    if (ine.length) d.nastrojeIne = (d.nastrojeIne ? d.nastrojeIne + ', ' : '') + ine.join(', ');
    if (pred.web && !d.firma.web) d.firma.web = pred.web;
    return d;
  }

  var pred = precitajParameter(window.location.hash);
  window.__arlingPredvyplnenie = { precitajParameter: precitajParameter, zluc: zluc, vysledok: pred };
  if (!pred) return;

  try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) { /* nič */ }

  var ulozeneDoPamate = false;
  try {
    var s = window.localStorage.getItem(KLUC);
    var d = zluc(s ? JSON.parse(s) : null, pred);
    window.localStorage.setItem(KLUC, JSON.stringify(d));
    ulozeneDoPamate = window.localStorage.getItem(KLUC) !== null;
  } catch (e) { ulozeneDoPamate = false; }

  function poNacitani() {
    var form = document.getElementById('formular');
    if (!ulozeneDoPamate && form) {
      // Bez úložiska: zaškrtnúť priamo, app.js to prekreslí na udalosť change.
      pred.nastroje.forEach(function (id) {
        var el = form.querySelector('input[name="nastroje"][value="' + id + '"]');
        if (el) el.checked = true;
      });
      pred.cookies.forEach(function (id) { var el = form.elements['cookies.' + id]; if (el) el.checked = true; });
      pred.cinnosti.forEach(function (id) { var el = form.elements['cinnosti.' + id]; if (el) el.checked = true; });
      if (pred.ine.length && form.elements.nastrojeIne && !form.elements.nastrojeIne.value) form.elements.nastrojeIne.value = pred.ine.join(', ');
      if (pred.web && form.elements['firma.web'] && !form.elements['firma.web'].value) form.elements['firma.web'].value = pred.web;
      form.dispatchEvent(new Event('change', { bubbles: true }));
    }

    var mena = [];
    pred.nastroje.forEach(function (id) {
      var el = document.querySelector('input[name="nastroje"][value="' + id + '"]');
      var label = el && el.parentNode ? cistyText(el.parentNode.textContent) : '';
      if (label) mena.push(label);
    });
    mena = mena.concat(pred.ine);
    var ciel = document.querySelector('#dielna .sub');
    if (ciel && ciel.parentNode) {
      var p = document.createElement('p');
      p.className = 'sub predvyplnene';
      p.setAttribute('role', 'status');
      var b = document.createElement('b');
      b.textContent = 'Predvyplnené z kontroly e-shopu. ';
      p.appendChild(b);
      p.appendChild(document.createTextNode(mena.length
        ? 'Zaškrtli sme služby, ktoré kontrola našla na vašej stránke: ' + mena.join(', ') + '. Skontrolujte ich a doplňte, čo automatická kontrola nevidí, napríklad účtovníka, kuriéra alebo hosting.'
        : 'Kontrola nenašla na úvodnej stránke žiadnu zo sledovaných služieb. Zaškrtnite nástroje, ktoré používate.'));
      ciel.parentNode.insertBefore(p, ciel.nextSibling);
    }

    var pokus = 0;
    (function zmeraj() {
      try {
        if (window.umami && typeof window.umami.track === 'function') {
          window.umami.track('eshop_balik_predvyplneny', { produkt: 'gdpr', sluzby: pred.nastroje.length + pred.ine.length });
          return;
        }
      } catch (e) { return; }
      if (++pokus < 10) setTimeout(zmeraj, 500);
    })();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poNacitani);
  else poNacitani();
})();
