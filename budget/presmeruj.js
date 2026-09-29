// Krátka adresa arling.sk/budget: presmeruje na obchod a ZACHOVÁ prichádzajúce utm_* (napr. z popisu videa na YouTube).
// Bez utm doplní pôvodné short-url, aby sa písaná adresa dala odlíšiť (plán rastu 29. 9. 2026, úloha 7).
(function () {
  var ciel = 'https://arling.sk/shop/budget-2027/';
  var q = new URLSearchParams(location.search);
  var utm = new URLSearchParams();
  q.forEach(function (v, k) { if (/^utm_/.test(k)) utm.set(k, v); });
  if (!utm.has('utm_source')) { utm.set('utm_source', 'short-url'); utm.set('utm_medium', 'typed'); utm.set('utm_campaign', 'budget-2027'); }
  location.replace(ciel + '?' + utm.toString());
})();
