/*
 * Shared "notify me about new tools" subscribe form.
 * Wires every <form data-subscribe> on the page to the ARLing homelab
 * subscribe API. No inline handlers (CSP script-src has no 'unsafe-inline').
 *
 * Expected markup per form:
 *   <form data-subscribe data-source="..." data-lang="en"
 *         data-thanks="idOfThanksParagraph" data-error="idOfErrorParagraph">
 *     <input type="text" name="website" tabindex="-1" autocomplete="off">  (honeypot, off-screen)
 *     <input type="email" name="email" required>
 *     <button type="submit">Notify me</button>
 *   </form>
 *   <p id="idOfThanksParagraph" hidden>...</p>
 *   <p id="idOfErrorParagraph" hidden>...</p>
 */
(function () {
  'use strict';

  var ENDPOINT = 'https://api.arling.workers.dev/subscribe/api/subscribe';

  function trackSubscribe(source) {
    try {
      if (window.umami && typeof window.umami.track === 'function') {
        window.umami.track('subscribe', { source: source });
      }
    } catch (e) {
      /* analytics must never break the form */
    }
  }

  function wire(form) {
    var source = form.getAttribute('data-source') || 'site';
    var lang = form.getAttribute('data-lang') || document.documentElement.getAttribute('lang') || 'en';
    var email = form.querySelector('input[type="email"]');
    var hp = form.querySelector('input[name="website"]');
    var button = form.querySelector('button[type="submit"]');
    var thanks = document.getElementById(form.getAttribute('data-thanks') || '');
    var error = document.getElementById(form.getAttribute('data-error') || '');
    var buttonText = button ? button.textContent : '';

    if (!email || !button) return;

    email.addEventListener('input', function () {
      if (email.getAttribute('aria-invalid') === 'true' && email.checkValidity()) email.removeAttribute('aria-invalid');
      if (error) error.hidden = true;
    });

    form.addEventListener('submit', function (evt) {
      evt.preventDefault();

      if (hp && hp.value) return; // honeypot filled: silently drop, no feedback to the bot

      if (error) error.hidden = true;
      if (!email.checkValidity()) {
        email.setAttribute('aria-invalid', 'true');
        email.reportValidity();
        return;
      }
      email.removeAttribute('aria-invalid');

      button.disabled = true;
      button.textContent = '...';

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.value.trim(),
          source: source,
          lang: lang,
          hp: hp ? hp.value : ''
        })
      })
        .then(function (res) {
          // 409 = already subscribed with this source; treat as success, not an error.
          if (!res.ok && res.status !== 409) throw new Error('subscribe failed: ' + res.status);
          form.hidden = true;
          if (thanks) thanks.hidden = false;
          trackSubscribe(source);
        })
        .catch(function () {
          // Formulár ostáva viditeľný, aby sa dalo skúsiť znova (Z-36 pokus 3, brána Astry 2, nález 6);
          // chyba sa zruší pri ďalšom písaní alebo odoslaní.
          button.disabled = false;
          button.textContent = buttonText;
          if (error) error.hidden = false;
        });
    });
  }

  var forms = document.querySelectorAll('form[data-subscribe]');
  for (var i = 0; i < forms.length; i++) wire(forms[i]);
})();
