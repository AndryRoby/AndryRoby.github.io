/*
 * arling.sk/motion: starts the page scripts once the full styles are on.
 *
 * The page paints its first screen from the critical CSS in the head. The full stylesheets load
 * after that first paint (/style/vzhlad.js), and only then the gallery and the Pro purchase flow
 * are fetched: the gallery measures layout, and neither is needed to read the first screen.
 * A plain deferred script, not a module, so the browser does not fetch it with high priority
 * next to the HTML and the font. /style/vzhlad.js sets the class css on <html> and fires
 * arling:css when the styles are on; on a page without deferred styles it does so at once.
 * MIT licence.
 */
(function () {
  var here = document.currentScript && document.currentScript.src;
  if (!here) return;
  function go() {
    import(new URL('gallery.js', here).href).catch(function (e) { console.error(e); });
    import(new URL('pro.js', here).href).catch(function (e) { console.error(e); });
  }
  if (document.documentElement.classList.contains('css')) go();
  else document.addEventListener('arling:css', go, { once: true });
})();
