/*
 * Odber pred spustenim Agentic Product Check (dvojity suhlas, verzia agent-ready-v1), 19. 10. 2026.
 * Formular [data-odber-ar] na strankach bezplatnej kontroly obchodu (EN, SK, DE): POST /api/odber (JSON)
 * so zdrojom agent-ready, agent-ready-sk alebo agent-ready-de. Kontrola obchodu ostava bez e-mailu; toto je
 * samostatny dobrovolny zoznam (texty: ops/shopify/predspustenie-2026-10-20/pravo/SUHLAS-AGENT-READY.md).
 * Sekcia ma v HTML atribut hidden, kym sluzba nepodporuje agent-ready-v1 (STAV.md, poradie nasadenia).
 * Bez vlozenych skriptov a stylov (CSP script-src 'self', style-src 'self'); e-maily posiela len sluzba.
 * Umami: odber_prihlasenie so zdrojom, bez adresy.
 */
(function () {
  'use strict';

  var lokalne = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  var API = lokalne ? location.origin + '/subscribe' : 'https://api.arling.workers.dev/subscribe';
  var JAZYKY = { en: 1, sk: 1, de: 1 };
  var ZDROJE = { 'agent-ready': 1, 'agent-ready-sk': 1, 'agent-ready-de': 1 };
  var SUHLAS = 'agent-ready-v1';

  var T = {
    en: {
      odosiela: 'Sending…',
      zla: 'Error: this does not look like an email address. Check for a typo.',
      limit: 'Error: too many tries. Please wait a minute and try again.',
      siet: 'Error: could not reach the server. Your address was not sent. Try again.',
      server: 'Error: something went wrong on our side. Your address was not saved. Try again in a few minutes.'
    },
    sk: {
      odosiela: 'Odosiela sa…',
      zla: 'Chyba: toto nevyzerá ako e-mailová adresa. Skontrolujte preklep.',
      limit: 'Chyba: príliš veľa pokusov. Počkajte minútu a skúste znova.',
      siet: 'Chyba: server sa nedá zasiahnuť. Adresa sa neodoslala. Skúste znova.',
      server: 'Chyba: niečo sa pokazilo u nás. Adresa sa neuložila. Skúste o pár minút.'
    },
    de: {
      odosiela: 'Wird gesendet…',
      zla: 'Fehler: Das sieht nicht wie eine E-Mail-Adresse aus. Bitte auf Tippfehler prüfen.',
      limit: 'Fehler: Zu viele Versuche. Bitte eine Minute warten und erneut versuchen.',
      siet: 'Fehler: Der Server ist nicht erreichbar. Ihre Adresse wurde nicht gesendet. Bitte erneut versuchen.',
      server: 'Fehler: Bei uns ist etwas schiefgelaufen. Ihre Adresse wurde nicht gespeichert. Bitte in ein paar Minuten erneut versuchen.'
    }
  };

  function sleduj(udalost, data) {
    try {
      if (window.umami && typeof window.umami.track === 'function') window.umami.track(udalost, data || {});
    } catch (e) { /* meranie nikdy nerozbije formular */ }
  }

  function ukaz(el, ano) { if (el) el.hidden = !ano; }

  function zapoj(form) {
    var sekcia = form.closest('[data-odber-sekcia]') || form.parentNode;
    var jazyk = JAZYKY[form.getAttribute('data-jazyk')] ? form.getAttribute('data-jazyk') : 'en';
    var zdroj = form.getAttribute('data-zdroj') || '';
    // Len zname zdroje a jedina verzia suhlasu tohto zoznamu; ina hodnota v HTML formular nezapne.
    if (!ZDROJE[zdroj] || form.getAttribute('data-suhlas') !== SUHLAS) return;
    var email = form.querySelector('input[type="email"]');
    var pasca = form.querySelector('input[name="website"]');
    var tlacidlo = form.querySelector('button[type="submit"]');
    var chyba = form.querySelector('[data-odber-chyba]');
    var stav = sekcia.querySelector('[data-odber-stav]');
    var t = T[jazyk];
    var povodny = tlacidlo ? tlacidlo.textContent : '';
    var bezi = false;
    if (!email || !tlacidlo || !chyba || !stav) return;
    form.hidden = false; // bez JavaScriptu ostava skryty a vidno vetu v <noscript>

    function zobrazChybu(text) {
      chyba.textContent = text;
      ukaz(chyba, true);
      email.setAttribute('aria-invalid', 'true');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (bezi) return;
      ukaz(chyba, false);
      email.removeAttribute('aria-invalid');
      var adresa = (email.value || '').trim();
      if (!adresa || !email.checkValidity()) { zobrazChybu(t.zla); email.focus(); return; }
      bezi = true;
      tlacidlo.disabled = true;
      tlacidlo.textContent = t.odosiela;
      fetch(API + '/api/odber', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adresa, zdroj: zdroj, jazyk: jazyk, suhlas: SUHLAS, hp: pasca ? String(pasca.value || '') : '' }),
        credentials: 'omit',
        cache: 'no-store'
      }).then(function (r) {
        if (r.ok) {
          form.hidden = true;
          ukaz(stav, true);
          var nadpis = stav.querySelector('h2, h3') || stav;
          nadpis.focus();
          sleduj('odber_prihlasenie', { zdroj: zdroj });
          return;
        }
        zobrazChybu(r.status === 400 ? t.zla : r.status === 429 ? t.limit : t.server);
      }, function () {
        zobrazChybu(t.siet);
      }).then(function () {
        bezi = false;
        tlacidlo.disabled = false;
        tlacidlo.textContent = povodny;
      });
    });
  }

  function start() {
    [].forEach.call(document.querySelectorAll('form[data-odber-ar]'), zapoj);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
