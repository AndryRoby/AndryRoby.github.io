/* Obchod v4 (Fable, 21. 9. 2026). Bez tohto súboru stránka funguje celá: hlavičku obsluhuje
   vzhlad.js, príchod hero je čisté CSS a všetok obsah je viditeľný. Súbor pridáva dve veci:
   svetlo pod kurzorom na dlaždiciach (Magic Card) a príchod sekcií pri rolovaní.
   Skrýva sa len to, čo je pri načítaní pod okrajom okna, a skrýva to až tento skript,
   takže keď sa nenačíta, nič neostane neviditeľné. */
(function () {
  'use strict';

  /* Magic Card: poloha kurzora do --mx a --my, zápis raz za rámec. Len na myši. */
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    Array.prototype.forEach.call(document.querySelectorAll('.sv-dl'), function (dl) {
      var caka = false, vnutri = false, x = 0, y = 0;
      dl.addEventListener('pointermove', function (e) {
        var b = dl.getBoundingClientRect();
        x = e.clientX - b.left; y = e.clientY - b.top; vnutri = true;
        if (caka) return;
        caka = true;
        requestAnimationFrame(function () {
          caka = false;
          if (!vnutri) return;
          dl.style.setProperty('--mx', x + 'px');
          dl.style.setProperty('--my', y + 'px');
        });
      }, { passive: true });
      dl.addEventListener('pointerleave', function () {
        vnutri = false;
        dl.style.removeProperty('--mx');
        dl.style.removeProperty('--my');
      });
    });
  }

  /* Príchod pri rolovaní. Raz a dosť. Najprv sa všetko zmeria, až potom sa zapisuje. */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  var hranica = (window.innerHeight || 800) * 0.92;
  var podOknom = Array.prototype.filter.call(document.querySelectorAll('.zjav'), function (el) {
    return el.getBoundingClientRect().top > hranica;
  });
  if (!podOknom.length) return;
  var oko = new IntersectionObserver(function (zaznamy) {
    zaznamy.forEach(function (z) {
      if (!z.isIntersecting) return;
      z.target.classList.remove('caka');
      z.target.classList.add('je');
      oko.unobserve(z.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  podOknom.forEach(function (el) { el.classList.add('caka'); oko.observe(el); });

  /* Poistka: návrat z histórie alebo skok na kotvu nesmie nechať nič skryté. */
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    podOknom.forEach(function (el) { el.classList.remove('caka'); });
  });
})();
