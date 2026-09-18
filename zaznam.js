/* ARLing zaznam.js: vlastny zaznam relacie a mapa klikov, na nasom vlastnom serveri.
 *
 * Preco existuje. Na /privacy/ pisame, ze nemame cookie listu, lebo nemame cookies,
 * a ze neukladame IP adresy, mena ani obsah formularov. Microsoft Clarity by tento
 * slub zrusil hned dvakrat: cudzi skript na predajnych strankach a cudzi server so
 * vsetkym, co na nich vidno. Toto je ta ista informacia, postavena tak, aby slub
 * ostal pravdivy: nas skript z nasej domeny, nas server v Bratislave, nulova IP.
 *
 * Na co odpoveda. Mame navstevy a nemame predaje. Za sedem dni: arling.sk 54 navstev,
 * GDPR dokumenty 41 navstev a 30 zobrazeni ceny bez jedineho predaja, e-faktura 85
 * navstev a 9 zobrazeni ceny bez predaja. Nevieme, co sa deje medzi videnou cenou
 * a odchodom. Toto je jedina otazka, na ktoru je tento subor postaveny.
 *
 * Co zaznamenava
 *   1. priebeh stranky cez rrweb (DOM, posun, pohyb mysi, zmeny obsahu),
 *   2. zvlast a lacno kazdy klik: suradnice voci CELEJ stranke a selektor prvku,
 *      lebo presne z toho sa sklada mapa klikov.
 *
 * Co nezaznamena NIKDY
 *   - ani jeden napisany znak: maskAllInputs maskuje kazdy input, textarea aj select,
 *     maskTextSelector navyse kazdy contenteditable a kazdu textarea uz v prvej snimke
 *     DOM, maskInputFn vracia same bodky, nie povodny text,
 *   - nic v prvku s triedou "zaznam-ignoruj" ani v prvku s data-zaznam="nie"
 *     (blockClass/blockSelector: rrweb na ich mieste posle len prazdny obdlznik),
 *     a tiez nic vo formulari dopytu (form[data-dopyt]), v input[type=file]
 *     a v input[type=password],
 *   - text v prvku s triedou "zaznam-skry" (maskTextClass), na ciselne udaje,
 *     ktore su sice na stranke, ale nemaju sa objavit v zazname,
 *   - ziadnu IP adresu. Skript ziadnu neposiela a prijimac ju ani nezapise do logu
 *     (products/zaznam-sluzba/app.py, funkcia log_message).
 *
 * Kto je to. Nahodny identifikator v sessionStorage, teda zije presne dovtedy, dokial
 * zije karta prehliadaca. Ziadne cookie, ziadny localStorage, ziadny odtlacok
 * prehliadaca. Po zatvoreni karty nie je ako spojit dve navstevy toho isteho cloveka
 * a nie je ako ho spojit s inou strankou. To je zamer, nie nedostatok.
 *
 * Vzorka. data-vzorka="1" znamena zaznamenaj kazdu relaciu; pri 54 navstevach tyzdenne
 * je kazda relacia vzacna. Ked navstevnosti pribudne, staci znizit cislo na stranke,
 * napriklad data-vzorka="0.2". Rozhodnutie padne raz na zaciatok relacie a ulozi sa
 * vedla identifikatora, takze sa relacia nikdy nezacne v polovici.
 *
 * Pouzitie na stranke (ziadny vlozeny skript, aby nebolo treba novy sha256 v CSP):
 *   <script src="/zaznam.js" data-cielo="https://homelab.tailbf8f27.ts.net/zaznam/api/udalosti"
 *           data-vzorka="1" defer></script>
 *
 * CSP. Skript je z vlastnej domeny, takze staci script-src 'self'. Odosiela sa na
 * homelab, ktory uz v connect-src na kazdej z tychto stranok je.
 *
 * rrweb. Kniznica NIE JE v tomto repozitari (pozri vendor/rrweb/LICENCIA.md). Kym ju
 * niekto nevlozi, tento subor zaznamena kliky a nic viac: prehravanie relacie bude
 * prazdne, mapa klikov bude uplna. Ziadny CDN, ziadny cudzi server.
 */
(function () {
  'use strict';

  /* ── kde a ako ─────────────────────────────────────────────────────────── */

  var TAG = document.currentScript;
  if (!TAG) {
    var vsetky = document.getElementsByTagName('script');
    for (var i = 0; i < vsetky.length; i++) {
      if ((vsetky[i].src || '').indexOf('/zaznam.js') !== -1) { TAG = vsetky[i]; break; }
    }
  }
  function atr(meno, predvolene) {
    var v = TAG && TAG.getAttribute(meno);
    return v === null || v === undefined || v === '' ? predvolene : v;
  }

  var CIEL = atr('data-cielo', 'https://homelab.tailbf8f27.ts.net/zaznam/api/udalosti');
  var RRWEB = atr('data-rrweb', '/vendor/rrweb/rrweb-record.min.js');
  var VZORKA = parseFloat(atr('data-vzorka', '1'));
  if (!(VZORKA >= 0) || VZORKA > 1) VZORKA = 1;

  // Stropy. Existuju preto, aby jedna dlha relacia nezaplnila disk a aby jedna
  // chyba nestala nic viac ako jednu relaciu.
  var DAVKA_MS = 5000;          // ako casto sa odosiela
  var DAVKA_BAJTOV = 48000;     // nad tolko sa davka odosle hned
  var RELACIA_BAJTOV = 2000000; // 2 MB na relaciu, potom sa zaznam sam zastavi
  var RELACIA_MS = 20 * 60 * 1000;

  var TRIEDA_IGNOR = 'zaznam-ignoruj';
  var TRIEDA_SKRY = 'zaznam-skry';
  var NEZAZNAMENAVAJ = [
    '.' + TRIEDA_IGNOR,
    '[data-zaznam="nie"]',
    'form[data-dopyt]',
    'input[type="file"]',
    'input[type="password"]'
  ].join(', ');

  /* ── kedy sa nezaznamenava vobec ───────────────────────────────────────── */

  function odmietnute() {
    try {
      if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1') return true;
      if (navigator.globalPrivacyControl === true) return true;
    } catch (e) { /* prehliadac bez tychto vlastnosti */ }
    return false;
  }
  if (odmietnute()) return;
  if (!window.fetch || !window.Blob) return;

  /* ── identifikator, ktory zomrie s kartou ──────────────────────────────── */

  var KLUC = 'arling.zaznam';
  var ulozisko = null;
  try { sessionStorage.setItem(KLUC + '.test', '1'); sessionStorage.removeItem(KLUC + '.test'); ulozisko = sessionStorage; } catch (e) { ulozisko = null; }

  function nahodneId() {
    var b = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(b);
    else for (var i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
    var s = '';
    for (var j = 0; j < b.length; j++) s += (b[j] < 16 ? '0' : '') + b[j].toString(16);
    return s;
  }

  var stav = null;
  if (ulozisko) {
    try { stav = JSON.parse(ulozisko.getItem(KLUC) || 'null'); } catch (e) { stav = null; }
  }
  if (!stav || typeof stav.id !== 'string' || stav.id.length !== 32) {
    stav = { id: nahodneId(), v: Math.random() < VZORKA, n: 0, b: 0 };
    if (ulozisko) { try { ulozisko.setItem(KLUC, JSON.stringify(stav)); } catch (e) { /* plne ulozisko */ } }
  }
  if (!stav.v) return;                     // relacia mimo vzorky, nic sa nedeje
  if (stav.b >= RELACIA_BAJTOV) return;    // relacia uz minula svoj strop

  var ID = stav.id;
  var poradie = stav.n || 0;
  var bajtov = stav.b || 0;
  var zaciatok = Date.now();

  function zapisStav() {
    if (!ulozisko) return;
    try { ulozisko.setItem(KLUC, JSON.stringify({ id: ID, v: true, n: poradie, b: bajtov })); } catch (e) { /* plne ulozisko */ }
  }

  /* ── vyrovnavacia pamat ────────────────────────────────────────────────── */

  var udalosti = [];   // rrweb
  var kliky = [];      // suradnice
  var dlzka = 0;       // odhad znakov v pamati
  var bezi = true;
  var zastavRrweb = null;
  var casovac = null;

  function zastav(dovod) {
    if (!bezi) return;
    bezi = false;
    if (casovac) { clearInterval(casovac); casovac = null; }
    try { if (zastavRrweb) zastavRrweb(); } catch (e) { /* rrweb uz skoncil */ }
    zastavRrweb = null;
    posli(true, dovod);
  }

  function pridaj(kam, vec) {
    if (!bezi) return;
    kam.push(vec);
    dlzka += JSON.stringify(vec).length;
    if (dlzka >= DAVKA_BAJTOV) posli(false, 'plna-davka');
  }

  /* ── odoslanie ─────────────────────────────────────────────────────────── */

  function davka(dovod) {
    return {
      v: 1,
      s: ID,
      p: location.pathname,
      j: document.documentElement.lang || '',
      w: window.innerWidth || 0,
      h: window.innerHeight || 0,
      t: Date.now(),
      z: zaciatok,
      n: poradie,
      d: dovod || '',
      e: udalosti,
      k: kliky
    };
  }

  function adresa(gz) {
    return CIEL + (CIEL.indexOf('?') === -1 ? '?' : '&') + 'gz=' + (gz ? '1' : '0');
  }

  // Blob typu text/plain je zamerne: je to "jednoduchy" CORS poziadavok, takze
  // nepotrebuje predlet OPTIONS a prejde aj cez sendBeacon pri zatvarani karty.
  // Bajty vnutri su bud JSON, alebo gzip; ktore z toho, hovori parameter gz.
  function odosli(telo, gz) {
    var url = adresa(gz);
    var blob = new Blob([telo], { type: 'text/plain;charset=UTF-8' });
    try {
      if (navigator.sendBeacon && blob.size < 60000 && navigator.sendBeacon(url, blob)) return;
    } catch (e) { /* sendBeacon odmietol, skusi sa fetch */ }
    try {
      fetch(url, { method: 'POST', body: blob, keepalive: blob.size < 60000, mode: 'cors', credentials: 'omit', cache: 'no-store' })
        .catch(function () { /* prijimac je dole, relacia sa jednoducho straci */ });
    } catch (e) { /* nic */ }
  }

  function posli(synchronne, dovod) {
    if (!udalosti.length && !kliky.length) return;
    var telo = JSON.stringify(davka(dovod));
    udalosti = []; kliky = []; dlzka = 0;
    poradie += 1;
    bajtov += telo.length;
    zapisStav();
    if (bajtov >= RELACIA_BAJTOV && bezi) { setTimeout(function () { zastav('strop-bajtov'); }, 0); }

    // Pri zatvarani karty sa neda cakat na gzip, ktory je asynchronny. Vtedy ide
    // davka nezbalena; prijimac oboje prijme a parameter gz mu povie, co dostal.
    if (synchronne || typeof CompressionStream === 'undefined') { odosli(telo, false); return; }
    try {
      var prud = new Blob([telo]).stream().pipeThrough(new CompressionStream('gzip'));
      new Response(prud).arrayBuffer().then(function (buf) { odosli(buf, true); }, function () { odosli(telo, false); });
    } catch (e) { odosli(telo, false); }
  }

  /* ── kliky: z toho sa sklada mapa ──────────────────────────────────────── */

  function selektor(el) {
    var kusy = [];
    var n = 0;
    while (el && el.nodeType === 1 && n < 4) {
      var kus = el.tagName.toLowerCase();
      if (el.id) { kus += '#' + el.id; kusy.unshift(kus); break; }
      var trieda = (el.getAttribute('class') || '').trim().split(/\s+/)[0];
      if (trieda && trieda.indexOf('zaznam-') !== 0) kus += '.' + trieda;
      kusy.unshift(kus);
      el = el.parentElement;
      n += 1;
    }
    return kusy.join(' > ').slice(0, 160);
  }

  function schovany(el) {
    try { return !!(el && el.closest && el.closest(NEZAZNAMENAVAJ)); } catch (e) { return false; }
  }

  document.addEventListener('click', function (e) {
    if (!bezi) return;
    if (e.detail === 0) return;                    // klavesnica, nie mys: suradnice by boli 0,0
    var el = e.target;
    if (schovany(el)) return;                      // v ignorovanej casti stranky sa klik nepocita
    var doc = document.documentElement;
    pridaj(kliky, {
      x: Math.round(e.pageX),
      y: Math.round(e.pageY),
      dw: doc ? doc.scrollWidth : 0,
      dh: doc ? doc.scrollHeight : 0,
      t: Date.now() - zaciatok,
      s: selektor(el),
      u: !!(el && el.closest && el.closest('a, button, [role="button"], summary'))
    });
  }, true);

  /* ── rrweb ─────────────────────────────────────────────────────────────── */

  function moznostiRrweb() {
    var bodky = function (text) { return text ? new Array(String(text).length + 1).join('•') : ''; };
    return {
      emit: function (udalost) { pridaj(udalosti, udalost); },
      // Ziadny napisany znak. maskAllInputs maskuje hodnoty vsetkych poli,
      // maskInputFn sa stara o to, aby v zazname bola len dlzka, nie obsah.
      maskAllInputs: true,
      maskInputFn: bodky,
      maskTextFn: bodky,
      maskInputOptions: {
        password: true, email: true, tel: true, text: true, textarea: true, number: true,
        url: true, search: true, date: true, 'datetime-local': true, month: true, week: true,
        time: true, color: true, range: true, select: true
      },
      // Text v contenteditable a v textarea je to, co clovek napisal, preto sa
      // maskuje uz v prvej snimke DOM, nielen pri zmenach.
      maskTextClass: TRIEDA_SKRY,
      maskTextSelector: '[contenteditable], [contenteditable] *, textarea, input',
      blockClass: TRIEDA_IGNOR,
      blockSelector: NEZAZNAMENAVAJ,
      ignoreClass: TRIEDA_IGNOR,
      // Obrazky, pisma a plátno do zaznamu nepatria: su to najvacsie kusy prenosu
      // a na otazku "preco odisiel po cene" neodpovedaju.
      recordCanvas: false,
      collectFonts: false,
      inlineImages: false,
      slimDOMOptions: {
        script: true, comment: true, headFavicon: true, headWhitespace: true,
        headMetaSocial: true, headMetaRobots: true, headMetaHttpEquiv: true,
        headMetaVerification: true
      },
      sampling: { mousemove: 100, scroll: 150, input: 'last', media: 800 }
    };
  }

  function spustiRrweb() {
    if (!window.rrweb || typeof window.rrweb.record !== 'function') return false;
    try { zastavRrweb = window.rrweb.record(moznostiRrweb()) || null; return true; } catch (e) { return false; }
  }

  if (!spustiRrweb()) {
    var s = document.createElement('script');
    s.src = RRWEB;
    s.async = true;
    // Ked kniznica chyba (este nie je vlozena do vendor/), zaznam bezi dalej
    // a posiela kliky. Nic sa nerozbije a nic sa nenacitava z cudzieho servera.
    s.onload = function () { spustiRrweb(); };
    s.onerror = function () { /* kliky staci */ };
    (document.head || document.documentElement).appendChild(s);
  }

  /* ── rytmus odosielania a koniec ───────────────────────────────────────── */

  casovac = setInterval(function () {
    if (Date.now() - zaciatok > RELACIA_MS) { zastav('strop-casu'); return; }
    posli(false, 'interval');
  }, DAVKA_MS);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') posli(true, 'skryta');
  });
  window.addEventListener('pagehide', function () { posli(true, 'odchod'); });

  // Na ladenie z konzoly. Identifikator je nahodny a zije len v tejto karte,
  // takze jeho zobrazenie nikoho neprezradi.
  window.__arlingZaznam = {
    id: ID,
    vzorka: VZORKA,
    stop: function () { zastav('rucne'); },
    stav: function () { return { bajtov: bajtov, davok: poradie, bezi: bezi, rrweb: !!zastavRrweb }; }
  };
})();
