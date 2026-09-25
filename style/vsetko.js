/* Stránka Všetko: hľadanie a filter bez servera (ops/design/postav-vsetko.mjs).
   Bez JavaScriptu stránka ukáže celý zoznam a filter skupín funguje cez CSS; tento skript
   pridá hľadanie, počet zobrazených, prázdny stav, adresu #skupina a obnoví značku Nové
   podľa dnešného dátumu, keby stránka dlhšie nebola znova postavená. */
(function () {
  'use strict';
  var main = document.querySelector('main.vsetko');
  if (!main) return;
  var norm = function (s) {
    s = String(s || '');
    if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
  };
  var pole = function (x) { return Array.prototype.slice.call(x); };
  var polozky = pole(main.querySelectorAll('.vs-pol'));
  var sekcie = pole(main.querySelectorAll('.vs-sek'));
  var filtre = pole(main.querySelectorAll('input[name="vs-filter"]'));
  var box = main.querySelector('.vs-hladaj');
  var q = main.querySelector('#vs-q');
  var stav = main.querySelector('.vs-stav');
  var prazdne = main.querySelector('.vs-prazdne');
  var sablona = (stav && stav.getAttribute('data-sablona')) || '{a} / {b}';

  // Značka Nové: stránka sa stavia pri nasadení, dátum sa tu prepočíta na dnešok.
  var dni = Number(main.getAttribute('data-nove-dni')) || 14;
  var d = new Date();
  var dnes = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  var noveSpolu = 0;
  polozky.forEach(function (li) {
    var s = li.getAttribute('data-datum');
    if (!s || !li.hasAttribute('data-nova')) return;
    var rozdiel = (dnes - Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))) / 864e5;
    if (rozdiel >= 0 && rozdiel < dni) { noveSpolu++; return; }
    li.removeAttribute('data-nova');
    var em = li.querySelector('.vs-nove');
    if (em) em.hidden = true;
  });
  var noveCip = main.querySelector('#vs-f-nove');
  if (noveCip) {
    var noveLabel = main.querySelector('label[for="vs-f-nove"] span');
    if (noveLabel) noveLabel.textContent = String(noveSpolu);
    if (!noveSpolu) { noveCip.hidden = true; noveCip.nextElementSibling.hidden = true; }
  }

  function vybrany() {
    for (var i = 0; i < filtre.length; i++) if (filtre[i].checked) return filtre[i].value;
    return 'vsetko';
  }

  function obnov() {
    var f = vybrany();
    var text = norm(q && q.value);
    var slova = text ? text.split(' ') : [];
    var n = 0;
    polozky.forEach(function (li) {
      var ok = f === 'vsetko' || (f === 'nove' ? li.hasAttribute('data-nova') : li.getAttribute('data-skupina') === f);
      if (ok && slova.length) {
        var h = li.getAttribute('data-hladaj') || '';
        for (var i = 0; i < slova.length; i++) if (h.indexOf(slova[i]) < 0) { ok = false; break; }
      }
      li.hidden = !ok;
      if (ok) n++;
    });
    sekcie.forEach(function (s) { s.hidden = !s.querySelector('.vs-pol:not([hidden])'); });
    if (prazdne) prazdne.hidden = n > 0;
    if (stav) stav.textContent = sablona.replace('{a}', n).replace('{b}', polozky.length);
  }

  // Na telefóne je rad skupín posuvný; vybraná skupina má byť v ňom vidieť.
  var rad = main.querySelector('.vs-filter');
  function ukazCip(r) {
    var l = r && r.nextElementSibling;
    if (!rad || !l || rad.scrollWidth <= rad.clientWidth) return;
    rad.scrollLeft = Math.max(0, l.offsetLeft - rad.offsetLeft - 16);
  }

  function zvolZAdresy() {
    var id = decodeURIComponent((location.hash || '').slice(1));
    var cip = id && main.querySelector('#vs-f-' + id.replace(/[^a-z-]/g, ''));
    if (!cip || cip.hidden) return false;
    cip.checked = true;
    ukazCip(cip);
    return true;
  }

  filtre.forEach(function (r) {
    r.addEventListener('change', function () {
      obnov();
      ukazCip(r);
      // Adresa nesie vybranú skupinu, aby sa dala poslať ďalej; bez posunu stránky.
      try { history.replaceState(null, '', r.value === 'vsetko' ? location.pathname + location.search : '#' + r.value); } catch (e) {}
    });
  });
  if (q) q.addEventListener('input', obnov);
  var reset = main.querySelector('.vs-reset');
  if (reset) reset.addEventListener('click', function () {
    if (q) q.value = '';
    filtre.forEach(function (r) { r.checked = r.value === 'vsetko'; });
    obnov();
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    if (q) q.focus();
  });
  window.addEventListener('hashchange', function () { if (zvolZAdresy()) obnov(); });

  if (box) box.hidden = false;
  var zAdresy = zvolZAdresy();
  obnov();
  // Prišiel z menu cez „Všetko v skupine“: skupina je vybraná, stránka ostane pri nej.
  if (zAdresy) {
    var sek = document.getElementById(location.hash.slice(1));
    if (sek && sek.scrollIntoView) requestAnimationFrame(function () { sek.scrollIntoView({ block: 'start' }); });
  }
})();
