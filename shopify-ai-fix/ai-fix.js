/*
 * AI shopping data fix (arling.sk/shopify-ai-fix/): additions to /dopyt.js without changing it.
 *
 * 1. Store address: adds https:// and refuses an address that is clearly not a store before dopyt.js sends it.
 *    The server keeps the "web" field only when it starts with http(s)://, so "yourstore.com" would be lost.
 * 2. Message: the server needs a non-empty message and its ntfy note shows only the message, so the store address
 *    and the ticked confirmation go at the top of what is sent. The visible text is restored right after dopyt.js
 *    has read it, so a failed attempt shows the person exactly what they wrote and nothing is added twice.
 * 3. Umami: hub_shopify_fix_request when dopyt.js shows the thank-you note (the request was stored),
 *    hub_shopify_fix_request_error when it shows the error. Nothing is measured with ?test in the address.
 * 4. While sending, the button says "Sending" with an ellipsis instead of the bare dots from dopyt.js
 *    (gate AI fix N14); dopyt.js restores the original label after an error.
 * 5. The terms of this service are folded (gate AI fix N6): a link to #terms, or #terms in the address, opens them.
 *
 * Runs in the capture phase on document, so it always comes before the form's own submit listener in dopyt.js,
 * whatever the order in which the two files load. No inline handlers: the page CSP does not allow them.
 */
(function () {
  'use strict';

  var terms = document.getElementById('terms-text');
  function otvorTerms() { if (terms && !terms.open) terms.open = true; }
  function hashTerms() { if (location.hash === '#terms' || location.hash === '#terms-text') otvorTerms(); }
  hashTerms();
  window.addEventListener('hashchange', hashTerms);
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href="#terms"]') : null;
    if (a) otvorTerms();
  });

  var form = document.getElementById('fx-form');
  if (!form) return;
  var store = document.getElementById('fx-store');
  var sprava = document.getElementById('fx-sprava');
  var suhlas = document.getElementById('fx-suhlas');
  var VERZIA = 'shopify-ai-fix form 2026-10-20';

  function adresa(vstup) {
    var v = String(vstup || '').trim();
    if (!v) return null;
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    try {
      var u = new URL(v);
      var host = u.hostname.toLowerCase();
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
      if (u.username || u.password || host.indexOf('.') < 1 || /\.$/.test(host) || !/^[a-z0-9.-]+$/.test(host)) return null;
      return 'https://' + host + (u.pathname && u.pathname !== '/' ? u.pathname : '');
    } catch (e) {
      return null;
    }
  }

  function meraj(udalost) {
    try {
      if (new URLSearchParams(location.search).has('test')) return;
      if (window.umami && typeof window.umami.track === 'function') window.umami.track(udalost, { lang: 'en' });
    } catch (e) { /* measuring must never break the page */ }
  }

  store.addEventListener('input', function () {
    store.setCustomValidity('');
    store.removeAttribute('aria-invalid');
  });

  document.addEventListener('submit', function (e) {
    if (e.target !== form) return;
    var url = adresa(store.value);
    if (!url) {
      e.preventDefault();
      e.stopImmediatePropagation();
      store.setCustomValidity('Enter your store address, for example yourstore.com');
      store.setAttribute('aria-invalid', 'true');
      store.reportValidity();
      return;
    }
    store.value = url;
    var napisane = sprava.value;
    var hlavicka = 'Store: ' + url + '\nConfirmation ticked: ' + (suhlas && suhlas.checked ? 'yes' : 'no') + ' (' + VERZIA + ')';
    sprava.value = hlavicka + (napisane.trim() ? '\n\n' + napisane.trim() : '');
    // dopyt.js reads the message synchronously in its submit listener; afterwards the visible text comes back.
    setTimeout(function () { sprava.value = napisane; }, 0);
  }, true);

  // Bubble phase on document: runs after the form's own listener in dopyt.js has disabled the button.
  var tlacidlo = form.querySelector('button[type="submit"]');
  document.addEventListener('submit', function (e) {
    if (e.target !== form || !tlacidlo) return;
    if (tlacidlo.disabled && tlacidlo.textContent === '...') tlacidlo.textContent = 'Sending' + String.fromCharCode(0x2026);
  });

  function sleduj(id, udalost) {
    var el = document.getElementById(id);
    if (!el || !window.MutationObserver) return;
    new MutationObserver(function () { if (!el.hidden) meraj(udalost); })
      .observe(el, { attributes: true, attributeFilter: ['hidden'] });
  }
  sleduj('fx-vdaka', 'hub_shopify_fix_request');
  sleduj('fx-chyba', 'hub_shopify_fix_request_error');
})();
