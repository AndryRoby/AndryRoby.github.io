/* The snippet builder on /api/.
 *
 * It does three things and nothing else: it keeps the two snippets in step
 * with the three controls, it points the live frame at the same puzzle, and
 * it copies a snippet to the clipboard. No analytics, no storage, no network
 * beyond the iframe that the page shows anyway.
 *
 * It is a plain script and not a module because it has to run on a page whose
 * Content-Security-Policy only allows scripts from this site: one more file,
 * no inline code, no hash to keep in step (ops/design/csp-hash.mjs).
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var kind = $('v-kind'), tazkost = $('v-difficulty'), cislo = $('v-index');
  var ramKod = $('kod-iframe'), skriptKod = $('kod-script'), ram = $('nahlad'), odkaz = $('odkaz-json');
  if (!kind || !tazkost || !cislo || !ramKod || !skriptKod || !ram) return;

  var ZAKLAD = 'https://arling.sk/embed/puzzle/';

  function tri(n) { return ('00' + n).slice(-3); }

  function hodnoty() {
    var i = Math.min(200, Math.max(1, parseInt(cislo.value, 10) || 1));
    return { k: kind.value, d: tazkost.value, i: tri(i) };
  }

  function prepis() {
    var h = hodnoty();
    var id = h.k + '-' + h.d + '-' + h.i;
    var adresa = ZAKLAD + '?kind=' + h.k + '&difficulty=' + h.d + '&id=' + id;

    ramKod.textContent = '<iframe src="' + adresa + '"\n'
      + '        title="ARLing puzzle" width="100%" height="620"\n'
      + '        style="border:0" loading="lazy"></iframe>';

    skriptKod.textContent = '<script src="https://arling.sk/embed/puzzle/embed.js"\n'
      + '        data-kind="' + h.k + '" data-difficulty="' + h.d + '"\n'
      + '        data-id="' + id + '" data-height="620"><\/script>';

    if (odkaz) {
      odkaz.href = '/api/puzzles/v1/' + h.k + '/' + h.d + '/' + h.i + '.json';
      odkaz.textContent = '/api/puzzles/v1/' + h.k + '/' + h.d + '/' + h.i + '.json';
    }

    /* Náhľad ukazuje presne to, čo je v úryvku, len z tohto servera, aby
       stránka fungovala aj na 127.0.0.1 pri kontrole pred nasadením. */
    var lokalne = '/embed/puzzle/?kind=' + h.k + '&difficulty=' + h.d + '&id=' + id;
    if (ram.getAttribute('src') !== lokalne) ram.setAttribute('src', lokalne);
  }

  [kind, tazkost, cislo].forEach(function (el) {
    el.addEventListener('change', prepis);
    el.addEventListener('input', prepis);
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-kopiruj]'), function (b) {
    b.addEventListener('click', function () {
      var cil = document.getElementById(b.dataset.kopiruj);
      if (!cil) return;
      var hotovo = function () {
        var s = b.parentNode.querySelector('span');
        if (!s) return;
        s.textContent = 'Copied';
        setTimeout(function () { s.textContent = ''; }, 2200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(cil.textContent).then(hotovo, function () {});
      else {
        var r = document.createRange();
        r.selectNodeContents(cil);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        try { document.execCommand('copy'); hotovo(); } catch (e) { /* starý prehliadač */ }
      }
    });
  });

  /* Čo hlási vložený hlavolam rodičovskej stránke. Je to tá istá správa, akú
     dostane ktokoľvek iný, a ukázať ju je najkratší spôsob, ako ju opísať. */
  var log = $('sprava');
  if (log) {
    window.addEventListener('message', function (e) {
      if (!e.data || e.data.type !== 'arling-puzzle') return;
      log.textContent = '{ type: "arling-puzzle", event: "' + e.data.event + '", id: "' + e.data.id + '" }';
    });
  }

  prepis();
})();
