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
  // Since 8 Oct 2026 (118d): the full styles and this script arrive together right after the first paint
  // (inline loader in <head>); the gallery starts in the next idle moment so that the style recalculation of
  // the whole page and the first scene build are separate tasks (Lighthouse TBT on a 4x slower CPU).
  function neskor() {
    if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 1200 });
    else setTimeout(go, 0);
  }
  if (document.documentElement.classList.contains('css')) neskor();
  else document.addEventListener('arling:css', neskor, { once: true });
})();
