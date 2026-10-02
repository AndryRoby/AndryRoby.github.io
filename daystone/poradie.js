// Daystone: poradie dvoch ramien testu ešte pred vykreslením (bez posunu rozloženia).
// Video s utm_content=days alebo utm_content=question dá svoje rameno navrch; inak náhodne
// 50 na 50 na reláciu, aby rameno navrchu nevyhralo len polohou. Poradie ide do udalostí Umami.
(function () {
  var p = null;
  try {
    var c = new URLSearchParams(location.search).get('utm_content');
    if (c === 'days') p = 'ab';
    if (c === 'question') p = 'ba';
    if (!p) p = sessionStorage.getItem('daystone.poradie');
  } catch (e) { /* bez úložiska stačí náhoda */ }
  if (p !== 'ab' && p !== 'ba') p = Math.random() < 0.5 ? 'ab' : 'ba';
  try { sessionStorage.setItem('daystone.poradie', p); } catch (e) { /* nič */ }
  document.documentElement.setAttribute('data-poradie', p);
})();
