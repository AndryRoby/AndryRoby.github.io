/* A-086. Menu funguje aj klávesnicou; bez JS zostáva navigácia prístupná. */
(function () {
  'use strict';
  // The home page is an explicit language choice. Product pages can be English
  // only; their logo should return here without changing the product language.
  var jazyk = (document.documentElement.lang || '').slice(0, 2).toLowerCase();
  if (['sk', 'en', 'de'].indexOf(jazyk) !== -1) {
    try { localStorage.setItem('arling_hub_lang', jazyk); } catch (e) {}
  }
  var bar = document.querySelector('header .bar');
  var btn = bar && bar.querySelector('.menu-btn');
  var nav = bar && bar.querySelector('nav');
  if (!btn || !nav) return;
  document.documentElement.classList.add('uv-js');
  function prepni(otvor) {
    bar.setAttribute('data-menu', otvor ? 'otvorene' : 'zavrete');
    btn.setAttribute('aria-expanded', String(otvor));
  }
  prepni(false);
  btn.addEventListener('click', function () { prepni(btn.getAttribute('aria-expanded') !== 'true'); });
  nav.addEventListener('click', function (e) { if(e.target.closest('a')) prepni(false); });
  document.addEventListener('click', function (e) { if(!bar.contains(e.target)) prepni(false); });
  document.addEventListener('keydown', function (e) {
    if(e.key==='Escape' && btn.getAttribute('aria-expanded')==='true') { prepni(false); btn.focus(); }
  });
  var desktop = window.matchMedia('(min-width: 1041px)');
  desktop.addEventListener('change', function () { prepni(false); });
})();
