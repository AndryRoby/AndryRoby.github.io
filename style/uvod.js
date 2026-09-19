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
  var menu = bar && bar.querySelector('.uv-menu');
  if (!menu) return;
  var summary=menu.querySelector('summary');
  var locale=bar.querySelector('.langsel');
  menu.addEventListener('click', function (e) { if(e.target.closest('a'))menu.open=false; });
  document.addEventListener('click', function (e) { if(!menu.contains(e.target))menu.open=false; });
  document.addEventListener('keydown', function (e) { if(e.key==='Escape'&&menu.open){menu.open=false;summary.focus();} });
  document.addEventListener('click', function (e) { if(locale&&!locale.contains(e.target))locale.open=false; });
  document.addEventListener('keydown', function (e) { if(e.key==='Escape'&&locale&&locale.open){locale.open=false;locale.querySelector('summary').focus();} });
  window.matchMedia('(min-width: 1041px)').addEventListener('change', function(){menu.open=false;});
})();
