// Krátka adresa arling.sk/check (na písanie do videí): presmeruje na bezplatnú verejnú kontrolu Agent Ready a ZACHOVÁ prichádzajúce
// utm_* (napríklad z odkazu v bio na Instagrame). Bez utm_source doplní youtube / short / check: návšteva z písanej adresy vo videu.
// Odkaz v popise Shortu nesie utm_medium=shorts, písaná adresa utm_medium=short, takže sa dajú rozlíšiť. Predvolené hodnoty určil Fable
// v zadaní 19. 10. 2026; plán rastu (časť 9, tabuľka UTM) pôvodne uvádzal short-url / typed, plán treba s touto adresou zosúladiť.
// Vzor: /budget/presmeruj.js. Cieľ je pevná adresa arling.sk (otvorené presmerovanie nie je možné), prejdú len kľúče utm_*,
// do HTML sa nič nevkladá a hodnoty kóduje URLSearchParams. Testy: ops/social/rast-2026-10-19/kratke-adresy.test.mjs.
(function (koren) {
  var CIEL = 'https://arling.sk/feed-doctor/agent-ready/';
  var PREDVOLENE = { utm_source: 'youtube', utm_medium: 'short', utm_campaign: 'check' };
  var KLUC_UTM = /^utm_[A-Za-z0-9_]{1,40}$/;

  function cielAdresy(hladanie) {
    var vstup = new URLSearchParams(typeof hladanie === 'string' ? hladanie : '');
    var utm = new URLSearchParams();
    vstup.forEach(function (hodnota, kluc) { if (KLUC_UTM.test(kluc)) utm.set(kluc, hodnota); });
    if (!utm.get('utm_source')) Object.keys(PREDVOLENE).forEach(function (kluc) { utm.set(kluc, PREDVOLENE[kluc]); });
    return CIEL + '?' + utm.toString();
  }

  if (typeof module === 'object' && module && module.exports) {
    module.exports = { cielAdresy: cielAdresy, CIEL: CIEL, PREDVOLENE: PREDVOLENE };
    return;
  }
  if (!koren || !koren.location) return;
  var ciel;
  try { ciel = cielAdresy(koren.location.search); } catch (e) { ciel = CIEL + '?' + new URLSearchParams(PREDVOLENE).toString(); }
  koren.location.replace(ciel);
})(typeof globalThis !== 'undefined' ? globalThis : this);
