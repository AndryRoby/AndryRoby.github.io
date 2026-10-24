// Krátka adresa arling.sk/juniper z konca troch mystery Shorts Club Juniper (YouTube, Instagram, TikTok; A-211, 24. 10. 2026):
// presmeruje na anglickú stránku hry a ZACHOVÁ prichádzajúce utm_*. Bez utm doplní short-url a typed, aby sa písaná adresa
// z videa dala v Umami odlíšiť od ostatných návštev (stop pravidlo testu: Z-401).
(function () {
  var ciel = 'https://arling.sk/shop/murder-at-club-juniper/';
  var q = new URLSearchParams(location.search);
  var utm = new URLSearchParams();
  q.forEach(function (v, k) { if (/^utm_/.test(k)) utm.set(k, v); });
  if (!utm.has('utm_source')) { utm.set('utm_source', 'short-url'); utm.set('utm_medium', 'typed'); utm.set('utm_campaign', 'juniper-shorts'); }
  location.replace(ciel + '?' + utm.toString());
})();
