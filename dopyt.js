/*
 * Dopytový formulár. Jediný spôsob, ako nám návštevník vie povedať „chcem to“
 * bez toho, aby otváral poštového klienta.
 *
 * Prečo vlastný koncový bod a nie Formspree, Tally či Google Forms: na každej
 * stránke tvrdíme, že sa odtiaľto nič neposiela tretím stranám. Formulár od
 * tretej strany by z toho tvrdenia spravil nepravdu, a to je pri nemeckom
 * zákazníkovi priamo dôvod na pokutu. Odosiela sa teda na našu vlastnú službu
 * na homelabe, ktorá uloží iba to, čo človek sám napísal: e-mail, web, správu.
 * Žiadna IP, žiadny user agent, žiadne cookies.
 *
 * Bez inline obsluhy udalostí, lebo CSP nedovoľuje 'unsafe-inline'.
 *
 * Očakávané značky:
 *   <form data-dopyt data-source="hub" data-lang="sk"
 *         data-thanks="idOdstavcaVdaka" data-error="idOdstavcaChyba">
 *     <input type="text" name="website" tabindex="-1" autocomplete="off">   pasca na roboty
 *     <input type="email" name="email" required>
 *     <input type="url" name="web">                                          nepovinné
 *     <textarea name="sprava" required maxlength="1500"></textarea>
 *     <button type="submit">Ozvite sa mi</button>
 *   </form>
 *   <p id="idOdstavcaVdaka" hidden>...</p>
 *   <p id="idOdstavcaChyba" hidden>...</p>
 */
(function () {
  'use strict';

  var ENDPOINT = 'https://api.arling.workers.dev/subscribe/api/dopyt';

  function meraj(source) {
    try {
      if (window.umami && typeof window.umami.track === 'function') {
        window.umami.track('dopyt', { source: source });
      }
    } catch (e) {
      /* meranie nikdy nesmie zhodiť formulár */
    }
  }

  function zapoj(form) {
    var source = form.getAttribute('data-source') || 'unknown';
    var lang = form.getAttribute('data-lang') || document.documentElement.lang || 'sk';
    var vdaka = document.getElementById(form.getAttribute('data-thanks') || '');
    var chyba = document.getElementById(form.getAttribute('data-error') || '');
    var email = form.querySelector('input[type="email"]');
    var web = form.querySelector('input[name="web"]');
    var sprava = form.querySelector('textarea[name="sprava"]');
    var hp = form.querySelector('input[name="website"]');
    var button = form.querySelector('button[type="submit"], button:not([type])');
    if (!email || !sprava || !button) return;
    var textTlacidla = button.textContent;

    // Pole s chybou posunie prehliadač pri odoslaní tesne pod pevnú hlavičku a jeho popis ostane pod ňou
    // (Chrome pri zväčšení 200 %, paper v3 pokus 4). Po jeho posune stránku dorovnáme, aby bol popis celý viditeľný.
    var prvaChyba = null;
    function ukazPopis(pole) {
      var popis = (pole.id && form.querySelector('label[for="' + pole.id + '"]')) || pole.closest('label') || pole;
      var hlavicka = document.querySelector('header.site-header') || document.querySelector('header');
      var dole = 0;
      if (hlavicka) {
        var poz = getComputedStyle(hlavicka).position;
        if (poz === 'sticky' || poz === 'fixed') dole = Math.max(0, hlavicka.getBoundingClientRect().bottom);
      }
      var hore = popis.getBoundingClientRect().top;
      if (hore < dole + 8) window.scrollBy(0, hore - dole - 16);
    }
    form.addEventListener('invalid', function (e) {
      if (prvaChyba) return;
      prvaChyba = e.target;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { try { ukazPopis(prvaChyba); } catch (err) { /* len poloha */ } prvaChyba = null; });
      });
    }, true);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (hp && hp.value) return;              // robot: ticho, žiadna spätná väzba

      if (!email.checkValidity()) { email.reportValidity(); return; }
      if (!sprava.value.trim()) { sprava.focus(); return; }

      button.disabled = true;
      button.textContent = '...';

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.value.trim(),
          web: web ? web.value.trim() : '',
          sprava: sprava.value.trim(),
          source: source,
          lang: lang,
          hp: hp ? hp.value : ''
        })
      })
        .then(function (res) {
          if (!res.ok) throw new Error('dopyt zlyhal: ' + res.status);
          form.hidden = true;
          // Formulár s vloženým style="display:grid" by atribút hidden ignoroval a ostal by viditeľný
          // s tlačidlom „...“ nad potvrdením (paper v3 pokus 3, dokazy-p3/predaj, platilo aj pred v3).
          form.style.display = 'none';
          if (vdaka) {
            vdaka.hidden = false;
            // Potvrdenie má tabindex="-1": fokus naň, aby ho čítačka ohlásila a bolo v okne.
            try { vdaka.focus({ preventScroll: false }); } catch (e) { /* starý prehliadač */ }
          }
          meraj(source);
        })
        .catch(function () {
          // Nezhadzujeme formulár: človek má vidieť, čo napísal, a vedieť to poslať mailom.
          button.disabled = false;
          button.textContent = textTlacidla;
          if (chyba) chyba.hidden = false;
        });
    });
  }

  function start() {
    Array.prototype.forEach.call(document.querySelectorAll('form[data-dopyt]'), zapoj);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
