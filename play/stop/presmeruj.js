// arling.sk/stop?l=17&utm_source=youtube -> /play/stop/?l=17&utm_source=youtube (zadanie 167, časť B).
// Úroveň z videa ostane zachovaná a s ňou všetky utm_* parametre, aby Umami vedelo, odkiaľ návšteva prišla.
// Nič iné neprejde. Adresa sa skladá len cez URLSearchParams (hodnoty kóduje on), do HTML sa nič nevkladá.
// Funkcia cielStop je čistá: v prehliadači sa hneď použije na presmerovanie, v node ju test dostane cez
// module.exports (products/arling-sk/play/stop/presmeruj.test.mjs). Pri chybe ide na hru bez parametrov.
(function (koren) {
  var KLUC_UTM = /^utm_[A-Za-z0-9_]{1,40}$/;
  var CELE = /^[0-9]{1,3}$/;

  function cielStop(hladanie) {
    var vstup = new URLSearchParams(typeof hladanie === 'string' ? hladanie : '');
    var von = new URLSearchParams();
    var l = vstup.get('l');
    if (l !== null && CELE.test(l) && Number(l) >= 1 && Number(l) <= 50) von.set('l', String(Number(l)));
    vstup.forEach(function (hodnota, kluc) {
      if (KLUC_UTM.test(kluc)) von.append(kluc, hodnota);
    });
    var q = von.toString();
    return '/play/stop/' + (q ? '?' + q : '');
  }

  if (typeof module === 'object' && module && module.exports) {
    module.exports = { cielStop: cielStop };
    return;
  }
  if (!koren || !koren.location) return;
  var ciel = '/play/stop/';
  try { ciel = cielStop(koren.location.search); } catch (e) { ciel = '/play/stop/'; }
  koren.location.replace(ciel);
})(typeof globalThis !== 'undefined' ? globalThis : this);
