/* Live demo page: reads ?t=<tenant id>&shop=<domain> and mounts the ARLing Asistent widget
   for that tenant INTO the page (data-mount), so the visitor sees one conversation window, not a
   page mock-up plus a second floating widget (gate 28. 9. 2026, finding 1). Texts follow the
   visitor's browser language (sk, cs, de, en). ?q=... (up to 3, the questions of that shop's
   customers) become the widget's starter questions; the first one is asked on load ONLY as a
   prepared question (lenPripravene: a stored, checked answer, never AI, never counted), so the
   owner sees a real answer from their own feed at once. ?u=1 marks a demo we prepared for a shop
   we wrote to (27. 9. 2026): it says so and when the demo is deleted.
   While widget.js loads the window shows a loading state; if it fails or takes over 12 s it shows
   an error with a retry and a contact (finding 4).
   Bezpečnostná kontrola 29. 9. 2026 (nález 4): id aj meno obchodu predtým prišli len z odkazu, takže
   ktokoľvek s vlastným účtom ukázal svoje produkty a odkazy pod menom cudzieho obchodu a pod značkou
   ARLing. Teraz sa najprv spýta workera (GET /v1/tenants/:id/status) a asistenta ukáže len pre obchod,
   ktorý to dovolí: ukážkový obchod (DEMO_TENANT), skúška vytvorená v tomto prehliadači (app.js ukladá
   id do localStorage arling_asistent_skusky), alebo keď worker povie live_demo (feed na doméne obchodu,
   teda odkaz „Vyskúšať Asistenta“ z nášho e-mailu) či outreach_demo (ukážka pre oslovený obchod).
   Meno obchodu je vždy doména zo servera, parameter shop sa nepoužíva. Text ?u=1 len pri outreach_demo.
   Stav stránky okolo (nadpis, texty) dopĺňa stranka.js podľa udalostí arling-live:obchod a
   arling-live:nepovolena.
   Druhé kolo kontroly 29. 9. 2026: otázky z odkazu (?q=) len pre ukážkový obchod a ukážku osloveného
   obchodu (outreach_demo, odkaz od nás); inak by ktokoľvek vložil vlastný text troch otázok pod skutočné
   meno obchodu. Ostatné ukážky majú všeobecné otázky. Umami (Andrej: „všetko v Umami“): live_obchod
   {druh: demo, outreach, skuska, live_demo} pri každej ukázanej ukážke, live_chyba {dovod: stav_siet,
   stav_http_NNN, stav_cas, widget_chyba, widget_cas} pri zlyhaní stavu alebo widgetu, live_nepovolena
   ako doteraz. */
(function () {
  var q = new URLSearchParams(location.search);
  var tenant = (q.get('t') || '').replace(/[^A-Za-z0-9-]/g, '');
  // Meno obchodu až zo servera (overObchod nižšie), nikdy z odkazu.
  var shop = '';
  var DEMO_TENANT = 'ce535d37-f297-4b43-89dd-30aa7b6301dd';
  var SKUSKY_KEY = 'arling_asistent_skusky';
  var nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  var lang = ['sk', 'cs', 'de', 'en'].indexOf(nav) >= 0 ? nav : 'en';
  var T = {
    sk: { title: 'Živé demo ARLing Asistenta', lead: 'Odpovedá z verejného zoznamu produktov vášho obchodu. V okne rozhovoru ťuknite na otázku, akú kladú vaši zákazníci, alebo napíšte vlastnú. Nič, čo napíšete, sa neukladá.', try: 'Pri pripravených otázkach ukazujeme vopred skontrolované, uložené odpovede. Vlastnú otázku spracuje asistent naživo.', cta: 'Celý popis, cenník a otázky na stránke Asistenta', ctaHref: 'https://arling.sk/asistent/', missing: 'V odkaze chýba id ukážky. Otvorte demo zo stránky, ktorá ho vytvorila, alebo si spravte vlastné na arling.sk/asistent.', nepovolena: 'Túto ukážku tu nevieme ukázať. Živá ukážka beží len pre obchod, ktorý si ju sám vytvoril, alebo z odkazu, ktorý ste dostali od nás. Vyskúšajte Asistenta na vlastnom feede alebo v ukážkovom obchode.', nacitava: 'Načítavam asistenta…', chyba: 'Asistenta sa teraz nepodarilo načítať. Skúste to znova alebo nám napíšte.', znova: 'Skúsiť znova', h1Chyba: ['Ukážka pre ', ' sa nenačítala'], kickerChyba: 'Ukážka je dočasne nedostupná' },
    cs: { title: 'Živé demo ARLing Asistenta', lead: 'Odpovídá z veřejného seznamu produktů vašeho obchodu. V okně konverzace klepněte na otázku, jakou kladou vaši zákazníci, nebo napište vlastní. Nic, co napíšete, se neukládá.', try: 'U připravených otázek ukazujeme předem zkontrolované, uložené odpovědi. Vlastní otázku zpracuje asistent naživo.', cta: 'Celý popis, ceník a otázky na stránce Asistenta (slovensky)', ctaHref: 'https://arling.sk/asistent/', missing: 'V odkazu chybí id ukázky. Otevřete demo ze stránky, která ho vytvořila, nebo si udělejte vlastní na arling.sk/asistent.', nepovolena: 'Tuto ukázku tu neumíme zobrazit. Živá ukázka běží jen pro obchod, který si ji sám vytvořil, nebo z odkazu, který jste dostali od nás. Vyzkoušejte Asistenta na vlastním feedu nebo v ukázkovém obchodě.', nacitava: 'Načítám asistenta…', chyba: 'Asistenta se teď nepodařilo načíst. Zkuste to znovu nebo nám napište.', znova: 'Zkusit znovu', h1Chyba: ['Ukázka pro ', ' se nenačetla'], kickerChyba: 'Ukázka je dočasně nedostupná' },
    de: { title: 'Live-Demo von ARLing Shopping Assistant', lead: 'Er antwortet aus der öffentlichen Produktliste Ihres Shops. Tippen Sie im Chatfenster auf eine Frage, wie sie Ihre Kunden stellen, oder schreiben Sie eine eigene. Nichts, was Sie schreiben, wird gespeichert.', try: 'Bei vorbereiteten Fragen zeigen wir vorab geprüfte, gespeicherte Antworten. Eine eigene Frage beantwortet der Assistent live.', cta: 'Beschreibung, Preise und Fragen auf der Seite des Assistenten', ctaHref: 'https://arling.sk/asistent/de/', missing: 'Im Link fehlt die Demo-ID. Öffnen Sie die Demo von der Seite, die sie erstellt hat, oder starten Sie Ihre eigene auf arling.sk/asistent.', nepovolena: 'Diese Demo können wir hier nicht zeigen. Die Live-Demo läuft nur für einen Shop, der sie selbst erstellt hat, oder über einen Link, den Sie von uns bekommen haben. Testen Sie den Assistenten mit Ihrem eigenen Feed oder im Demo-Shop.', nacitava: 'Assistent wird geladen…', chyba: 'Der Assistent konnte gerade nicht geladen werden. Versuchen Sie es erneut oder schreiben Sie uns.', znova: 'Erneut versuchen', h1Chyba: ['Die Demo für ', ' wurde nicht geladen'], kickerChyba: 'Die Demo ist vorübergehend nicht verfügbar' },
    en: { title: 'Live demo of ARLing Shopping Assistant', lead: 'It answers from your shop’s public product list. In the chat window, tap a question your shoppers ask, or write your own. Nothing you type is stored.', try: 'For prepared questions we show answers that were checked in advance and stored. Your own question is answered live.', cta: 'Full description, pricing and questions on the assistant page', ctaHref: 'https://arling.sk/asistent/en/', missing: 'No tenant id in the link. Open the demo from the page that created it, or start your own at arling.sk/asistent.', nepovolena: 'We cannot show this demo here. The live demo runs only for a shop that created it itself, or from a link you received from us. Try the assistant on your own feed or in the demo shop.', nacitava: 'Loading the assistant…', chyba: 'The assistant could not be loaded right now. Try again or write to us.', znova: 'Try again', h1Chyba: ['The demo for ', ' did not load'], kickerChyba: 'The demo is temporarily unavailable' }
  };
  var Q = {
    sk: { vseob: ['Čo mi odporučíte ako darček?', 'Máte niečo pre začiatočníka?', 'Čo sa hodí na každodenné použitie?'], ukazka: 'Túto ukážku sme pripravili z verejného zoznamu produktov obchodu. Ak si Asistenta nezapnete, do 30 dní ju zmažeme. Ak ho chcete zapnúť na svojom e-shope, stačí odpísať na e-mail, v ktorom ste odkaz dostali.' },
    cs: { vseob: ['Co mi doporučíte jako dárek?', 'Máte něco pro začátečníka?', 'Co se hodí na každodenní použití?'], ukazka: 'Tuto ukázku jsme připravili z veřejného seznamu produktů obchodu. Pokud si Asistenta nezapnete, do 30 dnů ji smažeme. Pokud ho chcete zapnout na svém e-shopu, stačí odpovědět na e-mail, ve kterém jste odkaz dostali.' },
    de: { vseob: ['Was empfehlen Sie als Geschenk?', 'Haben Sie etwas für Einsteiger?', 'Was eignet sich für den täglichen Gebrauch?'], ukazka: 'Diese Vorschau haben wir aus der öffentlichen Produktliste des Shops erstellt. Wenn Sie Asistent nicht einschalten, löschen wir sie innerhalb von 30 Tagen. Wenn Sie ihn in Ihrem Shop einschalten möchten, antworten Sie einfach auf die E-Mail, in der Sie diesen Link bekommen haben.' },
    en: { vseob: ['What would you suggest as a gift?', 'Do you have something for a beginner?', 'What works well for everyday use?'], ukazka: 'We prepared this demo from the shop’s public product list. If you do not switch Asistent on, we delete it within 30 days. To switch it on for your shop, just reply to the email this link came in.' }
  };
  var t = T[lang];
  var $ = function (id) { return document.getElementById(id); };
  document.documentElement.lang = lang;
  $('title').textContent = t.title;
  $('lead').textContent = t.lead;
  $('try').textContent = t.try;
  // Informačný odkaz v jazyku návštevníka (nález 6): nemecká a anglická stránka Asistenta existujú.
  var cta = $('cta');
  cta.textContent = '';
  var a = document.createElement('a');
  a.href = t.ctaHref;
  a.textContent = t.cta;
  cta.appendChild(a);
  if (!tenant) {
    var m = $('missing');
    m.textContent = t.missing;
    m.hidden = false;
    return;
  }

  var qq = Q[lang];
  // Otázky z odkazu sa použijú až po odpovedi servera (nastavOtazky), dovtedy všeobecné.
  var otazkyZOdkazu = q.getAll('q').map(function (x) { return x.trim().slice(0, 140); }).filter(Boolean).slice(0, 3);
  var otazky = qq.vseob;
  /** Otázky z odkazu len pre ukážkový obchod a ukážku osloveného obchodu (outreach_demo zo servera). */
  function nastavOtazky(data) {
    var smie = tenant === DEMO_TENANT || !!(data && data.outreach_demo === true);
    otazky = smie && otazkyZOdkazu.length ? otazkyZOdkazu : qq.vseob;
  }
  $('otazky').hidden = false;
  $('shot').hidden = true;
  $('okno-nacitava-text').textContent = t.nacitava;
  $('okno-chyba-text').textContent = t.chyba;
  $('okno-znova').textContent = t.znova;

  // Widget z workera (ten istý, ktorý dostane e-shop), nie kópia v hube (28. 9. 2026).
  var ENDPOINT = 'https://arling-asistent.arling.workers.dev';
  var CAKAJ_MS = 12000;
  var stav = $('okno-stav');
  var pripraveny = false;
  var casovac = null;
  var pred = null;

  function chyba(dovod) {
    if (pripraveny) return;
    // Jedna udalosť na jedno zlyhanie (chyba skriptu aj neskorší časovač by ju inak poslali dvakrát).
    if (stav.getAttribute('data-stav') !== 'chyba') track('live_chyba', { dovod: dovod || 'neznamy' });
    stav.setAttribute('data-stav', 'chyba');
    $('okno-nacitava').hidden = true;
    $('okno-chyba').hidden = false;
    document.body.classList.add('lv-stav-nedostupna');
    var h1 = $('h1-obchod');
    if (!pred) pred = { h1: h1 ? h1.innerHTML : '', title: $('title').textContent };
    $('title').textContent = t.kickerChyba;
    if (h1) {
      h1.textContent = '';
      h1.appendChild(document.createTextNode(t.h1Chyba[0]));
      var b = document.createElement('span');
      b.className = 'lv-obchod';
      b.textContent = shop || 'e-shop';
      h1.appendChild(b);
      h1.appendChild(document.createTextNode(t.h1Chyba[1]));
    }
  }

  /** Vráti stránku z chybového stavu do bežného (nadpis a titulok spred chyby). */
  function obnovPred() {
    if (!pred) return;
    $('h1-obchod').innerHTML = pred.h1;
    $('title').textContent = pred.title;
    document.body.classList.remove('lv-stav-nedostupna');
    pred = null;
  }

  document.addEventListener('arling-asistent:ready', function () {
    if (pripraveny) return;
    pripraveny = true;
    clearTimeout(casovac);
    // Widget prišiel po chybe (pomalá sieť, opakovanie): stránka sa vráti do bežného stavu.
    obnovPred();
    if (stav && stav.parentNode) stav.parentNode.removeChild(stav);
    document.body.classList.add('lv-stav-pripraveny');
    // Prvá otázka len ako pripravená: uložená odpoveď, alebo nič (nikdy AI, nikdy započítanie).
    if (window.ArlingAsistent) window.ArlingAsistent.ask(otazky[0], { lenPripravene: true });
  });

  function nacitaj() {
    stav.setAttribute('data-stav', 'nacitava');
    $('okno-nacitava').hidden = false;
    $('okno-chyba').hidden = true;
    var s = document.createElement('script');
    s.src = ENDPOINT + '/widget.js';
    s.setAttribute('data-tenant', tenant);
    s.setAttribute('data-lang', 'auto');
    s.setAttribute('data-endpoint', ENDPOINT);
    s.setAttribute('data-color', 'dark');
    s.setAttribute('data-mount', 'asistent-miesto');
    s.setAttribute('data-questions', JSON.stringify(otazky));
    s.setAttribute('data-title', shop ? shop : 'ARLing Shopping Assistant');
    s.async = true;
    s.onerror = function () { chyba('widget_chyba'); };
    clearTimeout(casovac);
    casovac = setTimeout(function () { chyba('widget_cas'); }, CAKAJ_MS);
    document.body.appendChild(s);
    return s;
  }

  function track(udalost, data) {
    try {
      if (window.umami && typeof window.umami.track === 'function') window.umami.track(udalost, data || {});
    } catch (e) { /* meranie nikdy nezhodí ukážku */ }
  }

  /** Id skúšky vytvorenej v tomto prehliadači (app.js zapamatajSkusku). */
  function vlastnaSkuska(id) {
    try {
      var zoznam = JSON.parse(window.localStorage.getItem(SKUSKY_KEY) || '[]');
      return Array.isArray(zoznam) && zoznam.indexOf(id) >= 0;
    } catch (e) {
      return false;
    }
  }

  function oznam(nazov, detail) {
    // stranka.js dopĺňa nadpis a texty podľa výsledku; pre prípad, že by počúval neskôr, aj do window.
    window.__arlingLive = { stav: nazov, detail: detail || {} };
    try {
      document.dispatchEvent(new CustomEvent('arling-live:' + nazov, { detail: detail || {} }));
    } catch (e) { /* starý prehliadač bez CustomEvent: stránka ostane vo všeobecnom stave */ }
  }

  /** Obchod ukážku nedovolí: žiadny widget, len vysvetlenie a cesty ďalej (akcie-chyba v stranka.js). */
  function nepovolena() {
    $('otazky').hidden = true;
    $('shot').hidden = false;
    var m = $('missing');
    m.textContent = t.nepovolena;
    m.hidden = false;
    oznam('nepovolena');
    track('live_nepovolena');
  }

  /** Druh ukázanej ukážky pre Umami (live_obchod): lievik oslovení a skúšok zvlášť. */
  function druhUkazky(data) {
    if (tenant === DEMO_TENANT) return 'demo';
    if (data && data.outreach_demo === true) return 'outreach';
    if (vlastnaSkuska(tenant)) return 'skuska';
    if (data && data.live_demo === true) return 'live_demo';
    return 'neznamy';
  }

  /** Overený obchod: meno zo servera, text pre oslovený obchod len keď ním naozaj je. */
  function povolena(data) {
    nastavOtazky(data);
    track('live_obchod', { druh: druhUkazky(data) });
    shop = String((data && data.domain) || '').replace(/[^A-Za-z0-9.-]/g, '');
    $('title').textContent = t.title + (shop ? ': ' + shop : '');
    if (shop) $('okno-meno').textContent = shop;
    if (q.get('u') === '1' && data && data.outreach_demo === true) {
      var pozn = $('otazky-pozn');
      pozn.textContent = qq.ukazka;
      pozn.hidden = false;
    }
    oznam('obchod', { shop: shop });
    return nacitaj();
  }

  /**
   * Pýta sa workera, či a pod akým menom smie ukážku ukázať. Bez odpovede (sieť) sa ukážkový
   * obchod a vlastná skúška načítajú aj tak bez mena, ostatné ukážu chybu s opakovaním.
   */
  var STATUS_CAKAJ_MS = 8000;
  function overObchod() {
    var lokalne = tenant === DEMO_TENANT || vlastnaSkuska(tenant);
    var hotovo = false;
    var koniec = setTimeout(function () { zlyhalo('stav_cas'); }, STATUS_CAKAJ_MS);
    function zlyhalo(dovod) {
      if (hotovo) return;
      hotovo = true;
      clearTimeout(koniec);
      if (lokalne) {
        track('live_chyba', { dovod: dovod });
        skript = povolena(null);
      } else {
        chyba(dovod);
      }
    }
    fetch(ENDPOINT + '/v1/tenants/' + encodeURIComponent(tenant) + '/status')
      .then(function (res) {
        if (res.status === 404) return { nenajdeny: true };
        if (!res.ok) throw new Error('stav_http_' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (hotovo) return;
        hotovo = true;
        clearTimeout(koniec);
        var smie = !!data && !data.nenajdeny && (lokalne || data.live_demo === true || data.outreach_demo === true);
        if (!smie) return nepovolena();
        skript = povolena(data);
      })
      .catch(function (e) {
        var sprava = String((e && e.message) || '');
        zlyhalo(/^stav_http_\d+$/.test(sprava) ? sprava : 'stav_siet');
      });
  }

  var skript = null;
  overObchod();
  $('okno-znova').addEventListener('click', function () {
    if (skript && skript.parentNode) skript.parentNode.removeChild(skript);
    document.body.classList.remove('lv-stav-nedostupna');
    // Bez overeného obchodu (zlyhal dopyt na stav) sa najprv znova pýta workera; chybový nadpis
    // sa vráti hneď, aby neskoršie „ready“ neprepísalo meno obchodu starým nadpisom.
    if (skript) skript = nacitaj();
    else {
      obnovPred();
      stav.setAttribute('data-stav', 'nacitava');
      $('okno-nacitava').hidden = false;
      $('okno-chyba').hidden = true;
      overObchod();
    }
  });
})();
