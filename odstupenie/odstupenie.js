/* Funkcia na odstúpenie od zmluvy (§ 20a zákona č. 108/2024 Z. z., od 19. 6. 2026).
   Jeden súbor pre SK, EN a DE; jazyk berie z data-lang formulára.
   Posiela na POST /subscribe/api/odstupenie (products/subscribe-service/odstupenie.py).
   Do Umami idú len udalosti bez údajov (odoslané, chyba), nikdy meno ani e-mail. */
(function () {
  'use strict';

  var form = document.getElementById('odst-form');
  if (!form) return;
  var jazyk = form.getAttribute('data-lang') || 'sk';
  var api = form.getAttribute('data-api');
  var tlacidlo = form.querySelector('button[type="submit"]');
  var hlaska = document.getElementById('odst-hlaska');
  var potvrdenie = document.getElementById('odst-potvrdenie');
  var zaciatok = Date.now();

  var T = {
    sk: {
      meno: 'Napíšte meno a priezvisko (aspoň 2 znaky, bez webových adries a domén). Ak máte za bodkou hneď písmeno, pridajte medzeru.',
      zmluva: 'Napíšte, od akej zmluvy odstupujete, napríklad čo ste kúpili a kedy (bez webových adries, domén a e-mailov). Ak máte za bodkou hneď písmeno, pridajte medzeru.',
      email: 'Skontrolujte e-mail, naň pošleme potvrdenie o prijatí.',
      odosielam: 'Odosielam odstúpenie…',
      limit: 'Z tejto adresy prišlo veľa pokusov za krátky čas. Skúste to o hodinu, alebo pošlite vzor z časti 3 e-mailom na podpora@arling.sk.',
      pretazene: 'Funkcia je teraz preťažená a nič sme neprijali. Pošlite prosím vzor z časti 3 e-mailom na podpora@arling.sk, platí rovnako. Neskôr to môžete skúsiť aj tu znova.',
      rychlo: 'Formulár sa odoslal príliš rýchlo. Počkajte pár sekúnd a potvrďte ešte raz.',
      chyba: 'Odstúpenie sa nepodarilo odoslať a nič sme neprijali. Skúste to znova o chvíľu, alebo pošlite vzor z časti 3 e-mailom na podpora@arling.sk.',
      mailOk: 'Rovnaké potvrdenie sme poslali aj na váš e-mail. Ak ho nevidíte, pozrite aj priečinok so spamom.',
      mailNie: 'Potvrdenie sa nám nepodarilo doručiť na zadaný e-mail. Odstúpenie je napriek tomu prijaté; uložte si túto stránku, potvrdenie vám pošleme ručne.',
      mailStrop: 'Potvrdenie sme tentoraz na váš e-mail neposlali automaticky, lebo formulár chránime pred zneužitím na hromadné e-maily. Odstúpenie je napriek tomu prijaté; uložte si túto stránku, potvrdenie vám pošleme e-mailom ručne.'
    },
    en: {
      meno: 'Please enter your full name (at least 2 characters, no web addresses or domains). If a letter follows a full stop directly, please add a space.',
      zmluva: 'Please say which contract you are withdrawing from, for example what you bought and when (no web addresses, domains or e-mail addresses). If a letter follows a full stop directly, please add a space.',
      email: 'Please check the e-mail address; we send the confirmation of receipt there.',
      odosielam: 'Sending the withdrawal…',
      limit: 'Too many attempts from this address in a short time. Please try again in an hour, or e-mail the model form from section 3 to support@arling.sk.',
      pretazene: 'The function is overloaded right now and we have received nothing. Please e-mail the model form from section 3 to support@arling.sk; it counts just the same. You can also try here again later.',
      rychlo: 'The form was sent too quickly. Please wait a few seconds and confirm again.',
      chyba: 'The withdrawal could not be sent and we have received nothing. Please try again shortly, or e-mail the model form from section 3 to support@arling.sk.',
      mailOk: 'We have also sent the same confirmation to your e-mail. If you cannot see it, please check your spam folder.',
      mailNie: 'We could not deliver the confirmation to the e-mail address you gave. The withdrawal has still been received; please save this page and we will send the confirmation by hand.',
      mailStrop: 'This time we did not send the confirmation to your e-mail automatically, because we protect the form from being misused for bulk e-mail. The withdrawal has still been received; please save this page and we will send the confirmation to your e-mail by hand.'
    },
    de: {
      meno: 'Bitte geben Sie Vor- und Nachnamen ein (mindestens 2 Zeichen, keine Webadressen oder Domains). Folgt auf einen Punkt direkt ein Buchstabe, fügen Sie bitte ein Leerzeichen ein.',
      zmluva: 'Bitte geben Sie an, welchen Vertrag Sie widerrufen, etwa was Sie wann gekauft haben (keine Webadressen, Domains oder E-Mail-Adressen). Folgt auf einen Punkt direkt ein Buchstabe, fügen Sie bitte ein Leerzeichen ein.',
      email: 'Bitte prüfen Sie die E-Mail-Adresse, dorthin senden wir die Eingangsbestätigung.',
      odosielam: 'Widerruf wird gesendet…',
      limit: 'Zu viele Versuche von dieser Adresse in kurzer Zeit. Bitte versuchen Sie es in einer Stunde erneut oder senden Sie das Muster aus Abschnitt 3 per E-Mail an support@arling.sk.',
      pretazene: 'Die Funktion ist gerade überlastet, bei uns ist nichts eingegangen. Bitte senden Sie das Muster aus Abschnitt 3 per E-Mail an support@arling.sk, das gilt genauso. Später können Sie es auch hier erneut versuchen.',
      rychlo: 'Das Formular wurde zu schnell gesendet. Bitte warten Sie einige Sekunden und bestätigen Sie erneut.',
      chyba: 'Der Widerruf konnte nicht gesendet werden, bei uns ist nichts eingegangen. Bitte versuchen Sie es gleich noch einmal oder senden Sie das Muster aus Abschnitt 3 per E-Mail an support@arling.sk.',
      mailOk: 'Dieselbe Bestätigung haben wir auch an Ihre E-Mail-Adresse gesendet. Falls Sie sie nicht sehen, prüfen Sie bitte den Spam-Ordner.',
      mailNie: 'Die Bestätigung konnte nicht an die angegebene E-Mail-Adresse zugestellt werden. Der Widerruf ist trotzdem eingegangen; bitte speichern Sie diese Seite, wir senden die Bestätigung von Hand.',
      mailStrop: 'Die Bestätigung haben wir diesmal nicht automatisch an Ihre E-Mail-Adresse gesendet, weil wir das Formular vor Missbrauch für Massen-E-Mails schützen. Der Widerruf ist trotzdem eingegangen; bitte speichern Sie diese Seite, wir senden die Bestätigung von Hand per E-Mail.'
    }
  }[jazyk] || null;
  if (!T) return;

  var EMAIL = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
  var ODKAZ = /(:\/\/|www\.|<|>|\bhttps?\b)/i;
  var PISMENO, LAVA, PRAVA, VELKE;
  try {
    PISMENO = new RegExp('\\p{L}', 'u');
    LAVA = new RegExp('[\\p{L}\\p{N}-]+$', 'u');
    PRAVA = new RegExp('^\\p{L}{2,24}(?![\\p{L}\\p{N}])', 'u');
    VELKE = new RegExp('^\\p{Lu}', 'u');
  } catch (e) {
    PISMENO = /[A-Za-zÀ-ž]/;
    LAVA = /[A-Za-z0-9À-ž-]+$/;
    PRAVA = /^[A-Za-zÀ-ž]{2,24}(?![A-Za-z0-9À-ž])/;
    VELKE = /^[A-ZÀ-ÞĀ-Ž]/;
  }
  /* Rovnaké pravidlo ako ma_domenu() v odstupenie.py: holá doména, z ktorej poštový program
     urobí odkaz (spam-shop.com, bit.ly/x, jana@firma.sk). Server je rozhodujúci, toto len
     ušetrí zbytočné odoslanie. */
  var SKRATKY = ' ing mgr bc mudr judr phdr rndr paeddr mvdr mddr pharmdr thdr thlic dr doc prof phd artd csc drsc dipl mag akad art arch mr mrs ms jr sr st sv ul nam nám napr resp tzv obj fa cca ';
  var PRIPONY = ' pdf doc docx xls xlsx csv txt jpg jpeg png xml odt ods isdoc heic ';
  var POVOLENE = ' arling.sk etsy.com stripe.com ';
  function ma(zoznam, slovo) { return zoznam.indexOf(' ' + slovo + ' ') !== -1; }
  function maDomenu(s) {
    var casti = s.split(/[.。．｡]/);
    for (var i = 0; i + 1 < casti.length; i++) {
      var l = LAVA.exec(casti[i]);
      var p = PRAVA.exec(casti[i + 1]);
      if (!l || !p) continue;
      var slovoL = l[0].replace(/^-+|-+$/g, '').toLowerCase();
      var slovoP = p[0];
      if (!slovoL || ma(PRIPONY, slovoP.toLowerCase())) continue;
      if (ma(SKRATKY, slovoL) && (VELKE.test(slovoP) || ma(SKRATKY, slovoP.toLowerCase()))) continue;
      var zvysok = casti[i + 1].slice(slovoP.length);
      if (ma(POVOLENE, slovoL + '.' + slovoP.toLowerCase()) && zvysok.charAt(0) !== '/') continue;
      return true;
    }
    return false;
  }
  function zakazane(s) { return ODKAZ.test(s) || maDomenu(s); }

  function meraj(udalost) {
    try { if (window.umami && window.umami.track) window.umami.track(udalost); } catch (e) { /* bez merania */ }
  }

  function pole(meno) { return form.elements[meno]; }

  function oznac(meno, chyba) {
    var el = pole(meno);
    var hl = document.getElementById('odst-' + meno + '-chyba');
    if (!el || !hl) return;
    if (chyba) {
      el.setAttribute('aria-invalid', 'true');
      hl.textContent = chyba;
      hl.hidden = false;
    } else {
      el.removeAttribute('aria-invalid');
      hl.textContent = '';
      hl.hidden = true;
    }
  }

  function skontroluj() {
    var m = pole('meno').value.trim().replace(/\s+/g, ' ');
    var z = pole('zmluva').value.trim().replace(/\s+/g, ' ');
    var e = pole('email').value.trim();
    var prve = null;
    var chyby = {
      meno: (m.length < 2 || m.length > 120 || zakazane(m) || !PISMENO.test(m)) ? T.meno : '',
      zmluva: (z.length < 3 || z.length > 300 || zakazane(z)) ? T.zmluva : '',
      email: (!EMAIL.test(e) || e.length > 254) ? T.email : ''
    };
    ['meno', 'zmluva', 'email'].forEach(function (k) {
      oznac(k, chyby[k]);
      if (chyby[k] && !prve) prve = k;
    });
    return prve;
  }

  function sprava(text, chyba) {
    hlaska.textContent = text || '';
    hlaska.className = 'hlaska' + (chyba ? ' hlaska-chyba' : '');
  }

  function ukazPotvrdenie(o) {
    var d = function (id, hodnota) { var el = document.getElementById(id); if (el) el.textContent = hodnota; };
    d('odst-p-cislo', o.cislo);
    d('odst-p-cas', o.prijate);
    d('odst-p-meno', pole('meno').value.trim().replace(/\s+/g, ' '));
    d('odst-p-zmluva', pole('zmluva').value.trim().replace(/\s+/g, ' '));
    d('odst-p-email', pole('email').value.trim().toLowerCase());
    d('odst-p-mail', o.potvrdenie_email ? T.mailOk : (o.potvrdenie_dovod === 'strop' ? T.mailStrop : T.mailNie));
    form.hidden = true;
    potvrdenie.hidden = false;
    potvrdenie.focus();
    try { potvrdenie.scrollIntoView({ block: 'start', behavior: 'auto' }); } catch (e) { /* staré prehliadače */ }
  }

  ['meno', 'zmluva', 'email'].forEach(function (k) {
    var el = pole(k);
    if (el) el.addEventListener('input', function () { if (el.getAttribute('aria-invalid')) oznac(k, ''); });
  });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (tlacidlo.disabled) return;
    var prve = skontroluj();
    if (prve) {
      sprava('', false);
      pole(prve).focus();
      return;
    }
    tlacidlo.disabled = true;
    form.setAttribute('aria-busy', 'true');
    sprava(T.odosielam, false);
    var telo = {
      meno: pole('meno').value,
      zmluva: pole('zmluva').value,
      email: pole('email').value.trim(),
      hp: pole('hp') ? pole('hp').value : '',
      lang: jazyk,
      t: Date.now() - zaciatok
    };
    fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telo),
      credentials: 'omit',
      referrerPolicy: 'no-referrer'
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (o) { return { kod: r.status, o: o }; });
    }).then(function (v) {
      if (v.kod === 200 && v.o && v.o.ok) {
        sprava('', false);
        meraj('odstupenie_prijate');
        ukazPotvrdenie(v.o);
        return;
      }
      var o = v.o || {};
      if (v.kod === 400 && o.pole && T[o.pole]) {
        oznac(o.pole, T[o.pole]);
        sprava('', false);
        pole(o.pole).focus();
      } else if (v.kod === 400 && o.error === 'too_fast') {
        sprava(T.rychlo, true);
      } else if (v.kod === 429 && o.error === 'rate_limited') {
        // Len tu je pravda, že ide o pokusy z tejto adresy a že o hodinu to pôjde.
        sprava(T.limit, true);
      } else if (v.kod === 429) {
        // 'busy' (spoločný strop služby) alebo iný strop: zákazník nič zlé neurobil.
        sprava(T.pretazene, true);
      } else {
        sprava(T.chyba, true);
      }
      meraj('odstupenie_chyba');
    }).catch(function () {
      sprava(T.chyba, true);
      meraj('odstupenie_chyba');
    }).then(function () {
      tlacidlo.disabled = false;
      form.removeAttribute('aria-busy');
    });
  });

  var tlac = document.getElementById('odst-tlac');
  if (tlac) tlac.addEventListener('click', function () { window.print(); });
})();
