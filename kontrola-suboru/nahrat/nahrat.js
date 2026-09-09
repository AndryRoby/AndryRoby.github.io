// Nahranie súboru po zaplatenej kontrole (149 €).
//
// Prečo tento súbor existuje. Do 10. 9. 2026 Stripe po zaplatení ukázal
// vetu „pošlite súbor na andrej@arling.sk". Za 149 € to vyzeralo ako
// láskavosť a z Andreja robilo poštára: musel čakať na mail, hľadať ho a
// spájať s platbou. Odteraz Stripe presmeruje sem, stránka si u Stripu
// overí, že sedí platba, a súbor príde priamo do nášho koša.
//
// Jeden súbor obsluhuje slovenskú aj nemeckú stránku. Jazyk textov sa berie
// z <html lang>, nie z URL, takže pridať ďalší jazyk znamená pridať stránku
// a jeden blok textov, nič iné.
//
// Stránka nemá vložený skript zámerne: hub má prísne CSP, kde by sa každá
// úprava vloženého skriptu musela znova prepočítať (ops/design/csp-hash.mjs).
// Externý súbor z vlastnej domény tento krok nepotrebuje.
(function () {
  'use strict';

  var API = 'https://arling-asistent.arling.workers.dev';
  var MAX_BAJTOV = 5 * 1024 * 1024;

  var TEXTY = {
    sk: {
      bezSession: 'Na túto stránku sa dá dostať len z platby. Otvorte prosím odkaz, ktorý vám ukázal Stripe po zaplatení, alebo nám napíšte na andrej@arling.sk a pošleme vám ho znova.',
      overujem: 'Overujeme platbu.',
      nedostupne: 'Overenie platby je práve nedostupné. Skúste to prosím o minútu znova, súbor sa nikam nestratil.',
      neznama: 'Túto objednávku nepoznáme. Skontrolujte prosím, či ste otvorili odkaz od Stripu celý, alebo nám napíšte na andrej@arling.sk.',
      nezaplatene: 'Platba ešte nie je potvrdená. Ak ste práve zaplatili, obnovte stránku o minútu. Ak platba neprešla, nič vám neúčtujeme.',
      uzNahrate: 'Súbor už máme. Výsledok pošleme do 24 hodín na e-mail z objednávky.',
      uzNahrateMail: function (m) { return 'Súbor už máme. Výsledok pošleme do 24 hodín na ' + m + ', teda na e-mail z objednávky.'; },
      pripravene: 'Platba je potvrdená. Nahrajte súbor, ktorý ste naposledy posielali do banky.',
      pripraveneMail: function (m) { return 'Platba je potvrdená. Nahrajte súbor, ktorý ste naposledy posielali do banky. Výsledok pošleme na ' + m + '.'; },
      vybrane: function (n, kb) { return n + ', ' + kb + ' kB'; },
      velky: 'Tento súbor má viac ako 5 MB. Napíšte nám prosím na andrej@arling.sk a dohodneme sa na inom spôsobe.',
      nieXml: 'Tento súbor nevyzerá ako XML. Potrebujeme export hromadného príkazu, teda súbor s koncovkou .xml, nie PDF ani Excel.',
      nahravam: 'Nahrávame súbor.',
      hotovo: 'Súbor sme prijali. Výsledok pošleme do 24 hodín na e-mail z objednávky.',
      hotovoMail: function (m) { return 'Súbor sme prijali. Výsledok pošleme do 24 hodín na ' + m + '.'; },
      chyba: 'Nahranie sa nepodarilo. Skúste to prosím znova, alebo nám súbor pošlite na andrej@arling.sk.',
    },
    de: {
      bezSession: 'Diese Seite ist nur über die Zahlung erreichbar. Öffnen Sie bitte den Link, den Ihnen Stripe nach der Zahlung gezeigt hat, oder schreiben Sie an andrej@arling.sk, dann senden wir ihn erneut.',
      overujem: 'Wir prüfen die Zahlung.',
      nedostupne: 'Die Prüfung der Zahlung ist gerade nicht möglich. Versuchen Sie es bitte in einer Minute erneut, es ist nichts verloren gegangen.',
      neznama: 'Diese Bestellung kennen wir nicht. Prüfen Sie bitte, ob Sie den Link von Stripe vollständig geöffnet haben, oder schreiben Sie an andrej@arling.sk.',
      nezaplatene: 'Die Zahlung ist noch nicht bestätigt. Wenn Sie gerade bezahlt haben, laden Sie die Seite in einer Minute neu. Ist die Zahlung nicht durchgegangen, berechnen wir nichts.',
      uzNahrate: 'Die Datei haben wir schon. Das Ergebnis senden wir innerhalb von 24 Stunden an die E-Mail-Adresse aus der Bestellung.',
      uzNahrateMail: function (m) { return 'Die Datei haben wir schon. Das Ergebnis senden wir innerhalb von 24 Stunden an ' + m + ', also an die E-Mail-Adresse aus der Bestellung.'; },
      pripravene: 'Die Zahlung ist bestätigt. Laden Sie die Datei hoch, die Sie zuletzt an die Bank geschickt haben.',
      pripraveneMail: function (m) { return 'Die Zahlung ist bestätigt. Laden Sie die Datei hoch, die Sie zuletzt an die Bank geschickt haben. Das Ergebnis senden wir an ' + m + '.'; },
      vybrane: function (n, kb) { return n + ', ' + kb + ' kB'; },
      velky: 'Diese Datei ist größer als 5 MB. Schreiben Sie uns bitte an andrej@arling.sk, dann finden wir einen anderen Weg.',
      nieXml: 'Diese Datei sieht nicht wie XML aus. Wir brauchen den Export des Sammelauftrags, also eine Datei mit der Endung .xml, kein PDF und kein Excel.',
      nahravam: 'Die Datei wird hochgeladen.',
      hotovo: 'Wir haben die Datei erhalten. Das Ergebnis senden wir innerhalb von 24 Stunden an die E-Mail-Adresse aus der Bestellung.',
      hotovoMail: function (m) { return 'Wir haben die Datei erhalten. Das Ergebnis senden wir innerhalb von 24 Stunden an ' + m + '.'; },
      chyba: 'Der Upload hat nicht funktioniert. Versuchen Sie es bitte erneut oder senden Sie uns die Datei an andrej@arling.sk.',
    },
  };

  var lang = (document.documentElement.getAttribute('lang') || 'sk').slice(0, 2).toLowerCase();
  var t = TEXTY[lang] || TEXTY.sk;

  // Stripe vie presmerovať len na jednu adresu a tá je slovenská. Nemecký
  // zákazník by tak po zaplatení 149 € pristál na stránke, ktorej nerozumie.
  // Preto sa slovenská stránka sama prepne na nemeckú, keď prehliadač hovorí
  // po nemecky, a session_id vezme so sebou. Naopak to nerobíme: kto je na
  // nemeckej stránke, prišiel tam vedome.
  if (lang === 'sk' && /^de/i.test(navigator.language || '') && !/\/de\/nahrat\//.test(location.pathname)) {
    location.replace('/kontrola-suboru/de/nahrat/' + location.search);
    return;
  }

  var stav = document.getElementById('stav');
  var blokNahravania = document.getElementById('nahravanie');
  var zona = document.getElementById('zona');
  var vstup = document.getElementById('subor');
  var tlacidlo = document.getElementById('poslat');
  var vybraneMeno = document.getElementById('vybrane');
  var hlaska = document.getElementById('hlaska');

  var sessionId = '';
  var mail = '';
  var subor = null;
  var posielam = false;

  function ukazStav(text, druh) {
    if (!stav) return;
    stav.textContent = text;
    stav.className = 'stav' + (druh ? ' stav-' + druh : '');
  }

  function ukazHlasku(text, druh) {
    if (!hlaska) return;
    hlaska.textContent = text || '';
    hlaska.className = 'hlaska' + (druh ? ' hlaska-' + druh : '');
    hlaska.hidden = !text;
  }

  function ukazNahravanie(zapnute) {
    if (blokNahravania) blokNahravania.hidden = !zapnute;
  }

  // Koncovku nekontrolujeme kvôli bezpečnosti, to robí worker. Kontrolujeme
  // ju preto, aby človek nečakal na odoslanie 4 MB PDF a až potom sa dozvedel,
  // že to nie je ten súbor.
  function vyzeraAkoXml(file) {
    return /\.xml$/i.test(file.name || '') || /xml/i.test(file.type || '');
  }

  function nastavSubor(file) {
    if (!file) return;
    if (file.size > MAX_BAJTOV) {
      subor = null;
      if (vybraneMeno) vybraneMeno.textContent = '';
      ukazHlasku(t.velky, 'chyba');
      if (tlacidlo) tlacidlo.disabled = true;
      return;
    }
    if (!vyzeraAkoXml(file)) {
      subor = null;
      if (vybraneMeno) vybraneMeno.textContent = '';
      ukazHlasku(t.nieXml, 'chyba');
      if (tlacidlo) tlacidlo.disabled = true;
      return;
    }
    subor = file;
    if (vybraneMeno) vybraneMeno.textContent = t.vybrane(file.name, Math.max(1, Math.round(file.size / 1024)));
    ukazHlasku('');
    if (tlacidlo) tlacidlo.disabled = false;
  }

  function urlSession(cesta) {
    return API + cesta + '?session_id=' + encodeURIComponent(sessionId);
  }

  async function zistiStav() {
    ukazStav(t.overujem);
    var r;
    try {
      r = await fetch(urlSession('/v1/kontrola/status'), { method: 'GET' });
    } catch (e) {
      ukazStav(t.nedostupne, 'chyba');
      return;
    }
    if (r.status === 404) { ukazStav(t.neznama, 'chyba'); return; }
    if (!r.ok) { ukazStav(t.nedostupne, 'chyba'); return; }

    var d = {};
    try { d = await r.json(); } catch (e) { ukazStav(t.nedostupne, 'chyba'); return; }

    mail = d.email_masked || '';
    if (!d.paid) { ukazStav(t.nezaplatene, 'chyba'); return; }
    if (d.uploaded) { ukazStav(mail ? t.uzNahrateMail(mail) : t.uzNahrate, 'ok'); return; }
    ukazStav(mail ? t.pripraveneMail(mail) : t.pripravene, 'ok');
    ukazNahravanie(true);
  }

  async function posli() {
    if (!subor || posielam) return;
    posielam = true;
    if (tlacidlo) tlacidlo.disabled = true;
    ukazHlasku(t.nahravam);

    var r;
    try {
      r = await fetch(urlSession('/v1/kontrola/upload'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: subor,
      });
    } catch (e) {
      posielam = false;
      if (tlacidlo) tlacidlo.disabled = false;
      ukazHlasku(t.chyba, 'chyba');
      return;
    }

    posielam = false;
    if (r.ok) {
      ukazNahravanie(false);
      ukazStav(mail ? t.hotovoMail(mail) : t.hotovo, 'ok');
      ukazHlasku('');
      return;
    }

    if (tlacidlo) tlacidlo.disabled = false;
    var chyba = '';
    try { chyba = ((await r.json()) || {}).error || ''; } catch (e) { chyba = ''; }
    if (r.status === 413) ukazHlasku(t.velky, 'chyba');
    else if (chyba === 'not_xml') ukazHlasku(t.nieXml, 'chyba');
    else if (r.status === 402) ukazHlasku(t.nezaplatene, 'chyba');
    else if (r.status === 503) ukazHlasku(t.nedostupne, 'chyba');
    else if (r.status === 404) ukazHlasku(t.neznama, 'chyba');
    else ukazHlasku(t.chyba, 'chyba');
  }

  if (zona) {
    ['dragenter', 'dragover'].forEach(function (e) {
      zona.addEventListener(e, function (ev) { ev.preventDefault(); zona.classList.add('zona-nad'); });
    });
    ['dragleave', 'drop'].forEach(function (e) {
      zona.addEventListener(e, function (ev) { ev.preventDefault(); zona.classList.remove('zona-nad'); });
    });
    zona.addEventListener('drop', function (ev) {
      var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (f) nastavSubor(f);
    });
  }
  if (vstup) {
    vstup.addEventListener('change', function () { nastavSubor(vstup.files && vstup.files[0]); });
  }
  if (tlacidlo) {
    tlacidlo.addEventListener('click', posli);
  }

  sessionId = new URLSearchParams(window.location.search).get('session_id') || '';
  if (!sessionId) {
    ukazStav(t.bezSession, 'chyba');
  } else {
    zistiStav();
  }
})();
