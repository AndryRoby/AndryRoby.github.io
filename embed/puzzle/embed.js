/* One line to put an ARLing puzzle on a page:
 *
 *   <script src="https://arling.sk/embed/puzzle/embed.js"
 *           data-kind="badgers" data-difficulty="easy"></script>
 *
 * The script replaces itself with an iframe of /embed/puzzle/. Every data-*
 * attribute it does not use itself becomes a query parameter, so data-id,
 * data-date, data-seed and data-index all work the same way as they do in the
 * address of the page.
 *
 * Attributes the script uses itself:
 *   data-height   the starting iframe height in pixels, 620 by default; the
 *                 iframe then follows the puzzle's own height
 *   data-width    a CSS width, 100% by default
 *   data-title    the iframe title for screen readers
 *   data-target   the id of the element to put the iframe in; without it the
 *                 iframe lands exactly where the <script> tag stands
 *
 * It sets no cookies and stores nothing. The iframe is sandboxed to scripts
 * and same-origin, so the puzzle can fetch its own static files and nothing
 * else. The parent page hears from it through postMessage:
 *
 *   window.addEventListener('message', (e) => {
 *     if (e.data && e.data.type === 'arling-puzzle') console.log(e.data.event, e.data.id);
 *   });
 */
(function () {
  'use strict';
  var skript = document.currentScript;
  if (!skript) return;
  var d = skript.dataset || {};
  var VLASTNE = { height: 1, width: 1, title: 1, target: 1 };

  /* Where this script came from decides where the puzzle comes from, so the
     same file works on arling.sk and from anywhere else. */
  var zaklad;
  try { zaklad = new URL('./', skript.src); } catch (e) { zaklad = null; }
  if (!zaklad) return;

  var adresa = new URL(zaklad.href);
  for (var kluc in d) {
    if (!Object.prototype.hasOwnProperty.call(d, kluc) || VLASTNE[kluc]) continue;
    if (d[kluc] !== '' && d[kluc] != null) adresa.searchParams.set(kluc, d[kluc]);
  }
  if (!adresa.searchParams.get('kind')) adresa.searchParams.set('kind', 'badgers');

  var ram = document.createElement('iframe');
  ram.src = adresa.href;
  ram.title = d.title || 'ARLing puzzle';
  ram.loading = 'lazy';
  ram.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
  ram.style.width = d.width || '100%';
  ram.style.height = (d.height || 620) + 'px';
  ram.style.border = '0';
  ram.style.maxWidth = '100%';
  ram.style.colorScheme = 'light dark';

  /* Hlavolam hlási svoju výšku (správa "size"), iframe sa jej prispôsobí,
     takže v ňom nie je vlastný scrollbar. data-height je len začiatočná výška. */
  window.addEventListener('message', function (e) {
    var m = e.data;
    if (e.source !== ram.contentWindow || !m || m.type !== 'arling-puzzle' || m.event !== 'size') return;
    if (typeof m.height === 'number' && isFinite(m.height)) ram.style.height = Math.min(Math.max(Math.round(m.height), 240), 2400) + 'px';
  });

  ram.addEventListener('load', function () {
    try { ram.contentWindow.postMessage({ type: 'arling-puzzle-host', event: 'auto-height' }, '*'); } catch (x) { /* nic */ }
  });

  var kam = d.target ? document.getElementById(d.target) : null;
  if (kam) kam.appendChild(ram);
  else if (skript.parentNode) skript.parentNode.insertBefore(ram, skript.nextSibling);
})();
