// Vyradí tento prehliadač z meraní: Umami rešpektuje localStorage umami.disabled a ping Asistenta ho kontroluje (15. 10. 2026).
(function () {
  var stav = document.getElementById('stav');
  var spat = document.getElementById('spat');
  function ukaz() {
    var vypnute = false;
    try { vypnute = !!localStorage.getItem('umami.disabled'); } catch (e) {}
    stav.textContent = vypnute
      ? 'Hotovo: návštevy a kliky z tohto prehliadača sa nepočítajú do Umami ani do ntfy.'
      : 'Tento prehliadač sa počíta. Obnov stránku, aby sa vyradil.';
    spat.hidden = !vypnute;
  }
  try { localStorage.setItem('umami.disabled', '1'); } catch (e) {
    stav.textContent = 'Prehliadač nedovolil uložiť nastavenie (súkromný režim alebo blokované úložisko).';
    return;
  }
  spat.addEventListener('click', function () {
    try { localStorage.removeItem('umami.disabled'); } catch (e) {}
    stav.textContent = 'Tento prehliadač sa znova počíta. Ak chceš vyradiť znova, obnov stránku.';
    spat.hidden = true;
  });
  ukaz();
})();
