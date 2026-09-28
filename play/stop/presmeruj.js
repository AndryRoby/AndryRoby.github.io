// arling.sk/stop?l=17 -> /play/stop/?l=17 (úroveň z videa ostane zachovaná)
(function () {
  var l = Number(new URLSearchParams(location.search).get('l'));
  location.replace('/play/stop/' + (l >= 1 && l <= 50 ? '?l=' + Math.floor(l) : ''));
})();
