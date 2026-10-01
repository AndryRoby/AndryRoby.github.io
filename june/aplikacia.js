/* Meranie kliku na odkaz bezplatnej hry (sekcia „aplikacia“ na stránkach postáv), 1. 10. 2026, zadanie Fabla.
 * Zdroj: ops/strategia/instagram/obchody/spolocne/aplikacia.js, do priečinkov postáv s touto sekciou ho kopíruje postav.mjs.
 *
 * Rovnako ako tlačidlo kúpy v obchod.js: pri kliku sa odošle udalosť Umami `postava-aplikacia` (postava, aplikacia) a odkaz sa
 * nezdržiava ani nezastavuje: žiadne preventDefault, žiadne čakanie na odpoveď. Človek z Instagramu ide rovno do Google Play,
 * aj keď je Umami zablokované alebo pomalé. Bez tohto skriptu je odkaz obyčajný odkaz. Spoločný obchod.js sa nemení.
 */
function track(meno, data) {
  try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(meno, data); } catch (e) { /* nič */ }
}

// `export` je tu aj kvôli Node: súbor bez export by sa v testoch načítal ako CommonJS (jedna inštancia bez ohľadu na ?v=)
export function spusti() {
  for (const a of document.querySelectorAll('a[data-aplikacia]')) {
    a.addEventListener('click', () => track('postava-aplikacia', { postava: a.dataset.postava || '', aplikacia: a.dataset.aplikacia || '' }));
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', spusti); else spusti();
}
