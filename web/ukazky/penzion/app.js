/* Penzión Inovať: pás najbližších voľných nocí a kalendár so súčtom ceny. Všetko sa ráta v prehliadači, nič sa neodosiela.
   Obsadenosť je vymyslená a ráta sa od dnešného dňa, aby kalendár nikdy neukazoval minulosť.
   Bez skriptu stránka ukáže vetu o telefóne (noscript v hlave), preto tu nie je žiadna trieda na <html>.
   Telefón a e-mail sú okná popover v HTML (fungujú aj bez skriptu), nič sa nevytáča ani neodosiela. */
(function () {
  'use strict';
  var doc = document;
  var N = ' '; /* pevná medzera: predložky, čísla a jednotky sa nesmú zalomiť */

  var $ = function (id) { return doc.getElementById(id); };
  var panel = $('kalendar');
  var mesiace = $('mesiace');
  if (!panel || !mesiace) return;

  var MESIACE = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún', 'Júl', 'August', 'September', 'Október', 'November', 'December'];
  var DNI = [['Po', 'pondelok'], ['Ut', 'utorok'], ['St', 'streda'], ['Št', 'štvrtok'], ['Pi', 'piatok'], ['So', 'sobota'], ['Ne', 'nedeľa']];
  var DNI_KRATKO = ['ne', 'po', 'ut', 'st', 'št', 'pi', 'so'];
  var DNI_DLHE = ['nedeľa', 'pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota'];
  var IZBY = {
    dvoj: { meno: 'Dvojlôžková izba', nizka: 78, vysoka: 98, max: 2 },
    rodinna: { meno: 'Rodinná izba', nizka: 118, vysoka: 138, max: 4 },
    apartman: { meno: 'Apartmán s' + N + 'balkónom', nizka: 148, vysoka: 168, max: 4 }
  };
  var PES = 8, DAN = 1.5, MIN_NOCI = 2, MESIACOV_DOPREDU = 11, NOCI_V_PASE = 14;

  var dnes = new Date(); dnes.setHours(12, 0, 0, 0);
  var stav = { izba: 'dvoj', hostia: 2, deti: 0, pes: false, prichod: null, odchod: null, posun: 0, fokus: null };
  var siroky = window.matchMedia('(min-width: 1180px)');
  var menejPohybu = window.matchMedia('(prefers-reduced-motion: reduce)');
  var otvaral = null;

  /* dátumy ako počet dní od dneška: 0 je dnes */
  function den(o) { var d = new Date(dnes); d.setDate(d.getDate() + o); return d; }
  function posunDatumu(d) { return Math.round((d - dnes) / 86400000); }
  function obsadena(o) {
    if (o < 1) return o < 0;
    var d = den(o).getDay();
    var h = ((o * 2654435761) >>> 0) % 97;
    if (d === 5 || d === 6) return h % 5 < 3;
    return h % 7 === 0 || (o % 23 > 19);
  }
  function sezona(d) {
    var m = d.getMonth() + 1, x = d.getDate();
    return (m === 12 && x >= 20) || m <= 3 || m === 7 || m === 8;
  }
  function cenaNoci(o) { var i = IZBY[stav.izba]; return sezona(den(o)) ? i.vysoka : i.nizka; }
  function volneMedzi(a, b) { for (var o = a; o < b; o++) if (obsadena(o)) return false; return true; }
  /* najbližší príchod, po ktorom sú voľné aspoň dve noci za sebou */
  function najblizsie() {
    for (var o = 1; o < 120; o++) if (volneMedzi(o, o + MIN_NOCI)) return o;
    return null;
  }
  var NAVRH = najblizsie();

  function eur(n) { return (Math.round(n * 100) % 100 === 0 ? String(Math.round(n)) : n.toFixed(2).replace('.', ',')) + N + '€'; }
  function sklon(n, a, b, c) { return n + N + (n === 1 ? a : n >= 2 && n <= 4 ? b : c); }
  function datum(o, sDnom) { var d = den(o); return (sDnom ? DNI_KRATKO[d.getDay()] + N : '') + d.getDate() + '.' + N + (d.getMonth() + 1) + '.'; }
  function datumDlhy(o) { var d = den(o); return d.getDate() + '.' + N + (d.getMonth() + 1) + '.' + N + d.getFullYear(); }
  function cenaPobytu(a, b) { var s = 0; for (var o = a; o < b; o++) s += cenaNoci(o); return s + (stav.pes ? PES * (b - a) : 0); }

  /* kreslenie mesiacov */
  function kresli() {
    var pocet = siroky.matches ? 2 : 1;
    if (stav.posun > MESIACOV_DOPREDU - pocet + 1) stav.posun = MESIACOV_DOPREDU - pocet + 1;
    var html = '';
    for (var k = 0; k < pocet; k++) {
      var prvy = new Date(dnes.getFullYear(), dnes.getMonth() + stav.posun + k, 1, 12);
      var rok = prvy.getFullYear(), mes = prvy.getMonth();
      var dni = new Date(rok, mes + 1, 0).getDate();
      var zac = (prvy.getDay() + 6) % 7;
      html += '<table class="mesiac"><caption>' + MESIACE[mes] + ' ' + rok + '</caption><thead><tr>';
      DNI.forEach(function (x) { html += '<th scope="col"><abbr title="' + x[1] + '" style="text-decoration:none">' + x[0] + '</abbr></th>'; });
      html += '</tr></thead><tbody><tr>';
      for (var p = 0; p < zac; p++) html += '<td></td>';
      for (var x = 1; x <= dni; x++) {
        var o = posunDatumu(new Date(rok, mes, x, 12));
        html += bunka(o, x);
        if ((zac + x) % 7 === 0 && x < dni) html += '</tr><tr>';
      }
      html += '</tr></tbody></table>';
    }
    mesiace.innerHTML = html;
    $('kal-spat').disabled = stav.posun <= 0;
    $('kal-dalej').disabled = stav.posun >= MESIACOV_DOPREDU - pocet + 1;
    nastavTabindex();
  }

  function bunka(o, cislo) {
    var a = stav.prichod, b = stav.odchod, tdTr = '', tr = 'den', popis = datumDlhy(o), vypnuty = false;
    var plna = obsadena(o);
    if (o < 0) { tr += ' minuly'; popis += ', minulý deň'; vypnuty = true; }
    else if (plna) {
      tr += ' plny';
      if (a !== null && b === null && o > a && volneMedzi(a, o)) { tr += ' odchod-ok'; popis += ', noc je obsadená, odchod v tento deň je možný'; }
      else { popis += ', obsadené'; vypnuty = true; }
    } else popis += ', voľné, ' + eur(cenaNoci(o)) + ' za noc';
    if (o === 0) { tr += ' dnes'; popis += ', dnes'; }
    if (a !== null && b !== null) {
      if (o === a) { tdTr = 'od'; popis += ', príchod'; }
      else if (o === b) { tdTr = 'do'; popis += ', odchod'; }
      else if (o > a && o < b) tdTr = 'v';
    } else if (a !== null && o === a) { tr += ' sam'; popis += ', príchod'; }
    return '<td' + (tdTr ? ' class="' + tdTr + '"' : '') + '><button type="button" class="' + tr + '" data-o="' + o + '" aria-label="' + popis + '"' +
      (vypnuty ? ' aria-disabled="true"' : '') + ((tdTr === 'od' || tdTr === 'do' || tr.indexOf(' sam') > -1) ? ' aria-pressed="true"' : '') + ' tabindex="-1">' + cislo + '</button></td>';
  }

  function tlacidloDna(o) { return mesiace.querySelector('.den[data-o="' + o + '"]'); }
  function nastavTabindex() {
    var ciel = null;
    if (stav.fokus !== null) ciel = tlacidloDna(stav.fokus);
    if (!ciel && stav.prichod !== null) ciel = tlacidloDna(stav.prichod);
    if (!ciel) ciel = mesiace.querySelector('.den:not([aria-disabled])') || mesiace.querySelector('.den');
    if (ciel) { ciel.tabIndex = 0; stav.fokus = Number(ciel.dataset.o); }
  }
  function ukazMesiac(o) {
    var d = den(o);
    var m = (d.getFullYear() - dnes.getFullYear()) * 12 + d.getMonth() - dnes.getMonth();
    var pocet = siroky.matches ? 2 : 1;
    if (m < stav.posun) stav.posun = m; else if (m > stav.posun + pocet - 1) stav.posun = m - pocet + 1;
  }
  function fokusNa(o) {
    var max = posunDatumu(new Date(dnes.getFullYear(), dnes.getMonth() + MESIACOV_DOPREDU + 1, 0, 12));
    if (o < 0) o = 0; if (o > max) o = max;
    ukazMesiac(o);
    stav.fokus = o; kresli();
    var t = tlacidloDna(o); if (t) t.focus();
  }

  /* výber nocí */
  var hlaska = '';
  function vyber(o) {
    hlaska = '';
    var a = stav.prichod, b = stav.odchod;
    if (o < 0) return;
    if (a === null || b !== null || o <= a) {
      if (obsadena(o)) { hlaska = 'Noc ' + datum(o) + ' je obsadená. Vyberte iný deň príchodu.'; }
      else { stav.prichod = o; stav.odchod = null; }
    } else if (!volneMedzi(a, o)) {
      hlaska = 'Medzi ' + datum(a) + ' a' + N + datum(o) + ' je obsadená noc. Vyberte skorší odchod alebo iný príchod.';
    } else if (o - a < MIN_NOCI) {
      hlaska = 'Najkratší pobyt sú 2' + N + 'noci. Vyberte odchod ' + datum(a + MIN_NOCI) + ' alebo neskôr.';
    } else { stav.odchod = o; }
    stav.fokus = o; kresli(); suhrn();
  }

  /* pás v úvode: najbližšie voľné noci, po výbere termín hosťa */
  function rozsah(a, b, sDnom) {
    var da = den(a), db = den(b);
    var dn = function (d) { return sDnom ? '<span class="dn">' + DNI_KRATKO[d.getDay()] + N + '</span>' : ''; };
    var prvy = dn(da) + da.getDate() + '.' + (da.getMonth() === db.getMonth() ? '' : N + (da.getMonth() + 1) + '.');
    return prvy + ' až' + N + dn(db) + db.getDate() + '.' + N + (db.getMonth() + 1) + '.';
  }
  var pasOziveny = false;
  function pas() {
    var a = stav.prichod, b = stav.odchod, stitok = $('pas-stitok'), termin = $('pas-termin'), sucet = $('pas-sucet');
    var od = a, po = b;
    if (a !== null && b !== null) {
      stitok.textContent = 'Váš termín';
      termin.innerHTML = rozsah(a, b, true);
      sucet.innerHTML = sklon(b - a, 'noc', 'noci', 'nocí') + ' s' + N + 'raňajkami, <b>' + eur(cenaPobytu(a, b)) + '</b>';
    } else if (a !== null) {
      stitok.textContent = 'Váš príchod';
      termin.textContent = DNI_DLHE[den(a).getDay()] + N + datum(a);
      sucet.textContent = 'teraz vyberte deň odchodu';
    } else if (NAVRH !== null) {
      od = NAVRH; po = NAVRH + MIN_NOCI;
      stitok.textContent = 'Najbližšie voľné noci';
      termin.innerHTML = rozsah(od, po, true);
      sucet.innerHTML = sklon(MIN_NOCI, 'noc', 'noci', 'nocí') + ' s' + N + 'raňajkami, <b>' + eur(cenaPobytu(od, po)) + '</b>';
    }
    var html = '';
    for (var o = 0; o < NOCI_V_PASE; o++) {
      var d = den(o), plna = obsadena(o), tr = '', popis = DNI_DLHE[d.getDay()] + ' ' + datum(o);
      if (od !== null && po !== null) { if (o === od) tr = 'od'; else if (o === po) tr = 'do'; else if (o > od && o < po) tr = 'v'; }
      else if (od !== null && o === od) tr = 'sam';
      if (tr === 'od' || tr === 'sam') popis += ', príchod'; else if (tr === 'do') popis += ', odchod';
      popis += plna ? ', noc je obsadená' : ', voľné, ' + eur(cenaNoci(o)) + ' za noc';
      var vnutro = '<small aria-hidden="true">' + DNI_KRATKO[d.getDay()] + '</small><span class="kr"><b>' + d.getDate() + '</b></span>';
      html += '<li' + (tr ? ' class="' + tr + '"' : '') + ' style="--i:' + o + '">' + (plna && tr !== 'do'
        ? '<span class="noc plna" role="img" aria-label="' + popis + '">' + vnutro + '</span>'
        : '<button type="button" class="noc' + (plna ? ' plna' : '') + '" data-noc="' + o + '" aria-label="' + popis + '">' + vnutro + '</button>') + '</li>';
    }
    var zoznam = $('noci');
    zoznam.innerHTML = html;
    if (!pasOziveny) { pasOziveny = true; if (!window.performance || performance.now() < 1200) zoznam.classList.add('ozivene'); setTimeout(function () { zoznam.classList.remove('ozivene'); }, 1600); }
  }

  /* súhrn v kalendári */
  function textHosti() {
    var t = sklon(stav.hostia, 'hosť', 'hostia', 'hostí');
    if (stav.deti) t += ', ' + sklon(stav.deti, 'dieťa', 'deti', 'detí');
    if (stav.pes) t += ', pes';
    return t;
  }
  function suhrn() {
    var i = IZBY[stav.izba], a = stav.prichod, b = stav.odchod;
    var stavEl = $('stav'), rozpis = $('rozpis'), dan = $('dan');
    $('pocet-hostia').textContent = stav.hostia;
    $('pocet-deti').textContent = stav.deti;
    $('hostia-max').textContent = 'najviac ' + i.max + ' v' + N + 'tejto izbe';
    doc.querySelectorAll('[data-krok]').forEach(function (t) {
      var k = t.dataset.krok, o = Number(t.dataset.o), h = stav[k] + o;
      t.disabled = k === 'hostia' ? (h < 1 || h > i.max) : (h < 0 || h > 2);
    });
    stavEl.classList.toggle('chyba', !!hlaska);
    var telo = 'Dobrý deň,\n\nmáme záujem o pobyt v Penzióne Inovať.\n';
    if (a !== null && b !== null) {
      var noci = b - a, skupiny = {}, spolu = 0, o;
      for (o = a; o < b; o++) { var c = cenaNoci(o); skupiny[c] = (skupiny[c] || 0) + 1; spolu += c; }
      var h = '';
      Object.keys(skupiny).forEach(function (c) { h += '<dt>' + sklon(skupiny[c], 'noc', 'noci', 'nocí') + ' po' + N + eur(Number(c)) + '</dt><dd>' + eur(skupiny[c] * c) + '</dd>'; });
      h += '<dt>Raňajky</dt><dd>v' + N + 'cene</dd>';
      if (stav.deti) h += '<dt>' + sklon(stav.deti, 'dieťa', 'deti', 'detí') + ' do' + N + '6' + N + 'rokov</dt><dd>zadarmo</dd>';
      if (stav.pes) { h += '<dt>Pes, ' + sklon(noci, 'noc', 'noci', 'nocí') + '</dt><dd>' + eur(PES * noci) + '</dd>'; spolu += PES * noci; }
      h += '<dt class="spolu">Spolu</dt><dd>' + eur(spolu) + '</dd>';
      rozpis.innerHTML = h; rozpis.hidden = false;
      dan.textContent = 'Miestnu daň ' + eur(DAN * stav.hostia * noci) + ' (' + eur(DAN) + ' za osobu a' + N + 'noc) zaplatíte na mieste.';
      dan.hidden = false;
      stavEl.textContent = hlaska || 'Voľné: ' + i.meno.toLowerCase() + ', ' + datum(a, true) + ' až' + N + datum(b, true);
      telo += 'Izba: ' + i.meno + '\nPríchod: ' + datumDlhy(a) + '\nOdchod: ' + datumDlhy(b) + ' (' + sklon(noci, 'noc', 'noci', 'nocí') + ')\nHostia: ' + textHosti() + '\nCena podľa webu: ' + eur(spolu) + '\n';
    } else {
      rozpis.hidden = true; rozpis.innerHTML = ''; dan.hidden = true; dan.textContent = '';
      stavEl.textContent = hlaska || (a === null ? 'Vyberte v' + N + 'kalendári deň príchodu.' : 'Príchod ' + datum(a, true) + ' Teraz vyberte deň odchodu.');
      telo += 'Izba: ' + i.meno + '\nHostia: ' + textHosti() + '\nTermín: \n';
    }
    telo += '\nĎakujeme.';
    var dopyt = $('dopyt-text');
    if (dopyt) dopyt.textContent = 'Predmet: Dopyt na termín, ' + i.meno + '\n\n' + telo;
    pas();
  }

  /* otvorenie a zatvorenie */
  function otvor(ciel, zdroj) {
    otvaral = zdroj || null;
    var bolZavrety = panel.hidden;
    if (ciel === 'navrh' && stav.prichod === null && NAVRH !== null) {
      stav.prichod = NAVRH; stav.odchod = NAVRH + MIN_NOCI; stav.fokus = NAVRH; hlaska = ''; ukazMesiac(NAVRH);
    }
    if (stav.prichod !== null && bolZavrety) { ukazMesiac(stav.prichod); stav.fokus = stav.prichod; }
    panel.hidden = false;
    doc.querySelectorAll('[aria-controls="kalendar"]').forEach(function (t) { t.setAttribute('aria-expanded', 'true'); });
    if (bolZavrety) { panel.classList.remove('otvara'); void panel.offsetWidth; panel.classList.add('otvara'); }
    kresli(); suhrn();
    $('termin').scrollIntoView({ behavior: menejPohybu.matches ? 'auto' : 'smooth', block: 'start' });
    var kam = mesiace.querySelector('.den[tabindex="0"]');
    if (kam) kam.focus({ preventScroll: true });
  }
  function zavri() {
    panel.hidden = true;
    doc.querySelectorAll('[aria-controls="kalendar"]').forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
    var kam = otvaral && doc.contains(otvaral) && otvaral.offsetParent ? otvaral : doc.querySelector('.pas-text');
    if (kam) kam.focus();
  }

  doc.addEventListener('click', function (e) {
    var t = e.target.closest('[data-otvor]');
    if (t) {
      e.preventDefault();
      if (t.dataset.izba && IZBY[t.dataset.izba]) {
        stav.izba = t.dataset.izba;
        var r = doc.querySelector('input[name="izba"][value="' + stav.izba + '"]'); if (r) r.checked = true;
        if (stav.hostia > IZBY[stav.izba].max) stav.hostia = IZBY[stav.izba].max;
      }
      if (!panel.hidden && t.classList.contains('pas-text') && otvaral === t) { zavri(); return; }
      otvor(t.dataset.otvor, t);
      return;
    }
    var n = e.target.closest('[data-noc]');
    if (n) {
      var on = Number(n.dataset.noc);
      if (stav.odchod !== null || stav.prichod === null || on <= stav.prichod) { stav.prichod = null; stav.odchod = null; }
      vyber(on); otvor(null, doc.querySelector('.pas-text'));
      return;
    }
    var d = e.target.closest('.den');
    if (d) { var od = Number(d.dataset.o); vyber(od); var td = tlacidloDna(od); if (td) td.focus(); return; }
    var k = e.target.closest('[data-krok]');
    if (k && !k.disabled) {
      stav[k.dataset.krok] += Number(k.dataset.o);
      suhrn();
      if (k.disabled) { var druhy = k.parentNode.querySelector('button:not([disabled])'); if (druhy) druhy.focus(); }
    }
  });

  $('kal-zavriet').addEventListener('click', zavri);
  $('kal-spat').addEventListener('click', function () { if (stav.posun > 0) { stav.posun--; stav.fokus = null; kresli(); } });
  $('kal-dalej').addEventListener('click', function () { stav.posun++; stav.fokus = null; kresli(); });
  $('pes').addEventListener('change', function (e) { stav.pes = e.target.checked; suhrn(); });
  doc.querySelectorAll('input[name="izba"]').forEach(function (r) {
    r.addEventListener('change', function () {
      stav.izba = r.value;
      if (stav.hostia > IZBY[stav.izba].max) stav.hostia = IZBY[stav.izba].max;
      kresli(); suhrn();
    });
  });

  panel.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (doc.querySelector('.okno:popover-open')) return; // Escape najprv zavrie otvorené okno (popover), kalendár ostane
      e.preventDefault(); zavri(); return;
    }
    var d = e.target.closest && e.target.closest('.den');
    if (!d) return;
    var o = Number(d.dataset.o), kam = null;
    if (e.key === 'ArrowRight') kam = o + 1;
    else if (e.key === 'ArrowLeft') kam = o - 1;
    else if (e.key === 'ArrowDown') kam = o + 7;
    else if (e.key === 'ArrowUp') kam = o - 7;
    else if (e.key === 'PageDown') kam = o + 30;
    else if (e.key === 'PageUp') kam = o - 30;
    else if (e.key === 'Home') kam = o - ((den(o).getDay() + 6) % 7);
    else if (e.key === 'End') kam = o + 6 - ((den(o).getDay() + 6) % 7);
    if (kam !== null) { e.preventDefault(); fokusNa(kam); }
  });

  var prekresli = function () { if (!panel.hidden) kresli(); };
  if (siroky.addEventListener) siroky.addEventListener('change', prekresli); else siroky.addListener(prekresli);

  /* hmla v úvode počká na fotku, najviac 2,5 s, aby neklesla nad prázdnou plochou */
  var foto = $('uvod-foto'), obr = foto && foto.querySelector('img');
  if (foto && obr && !obr.complete) {
    foto.classList.add('caka');
    var pusti = function () { foto.classList.remove('caka'); };
    obr.addEventListener('load', pusti); obr.addEventListener('error', pusti); setTimeout(pusti, 2500);
  }

  /* lepkavý pás na mobile: ukáže sa, až keď pás nocí ani päta nie sú na očiach; schovaný je mimo poradia Tabu */
  var dolny = $('dolny');
  if (dolny) {
    dolny.inert = true;
    if ('IntersectionObserver' in window) {
      var vidno = new Set(), prvy = true;
      var io = new IntersectionObserver(function (zaznamy) {
        zaznamy.forEach(function (z) { if (z.isIntersecting) vidno.add(z.target); else vidno.delete(z.target); });
        var schovat = vidno.size > 0;
        if (prvy && schovat) { prvy = false; return; }
        prvy = false;
        dolny.classList.toggle('schovaj', schovat); dolny.inert = schovat;
      }, { rootMargin: '0px 0px -72px 0px' });
      io.observe($('termin'));
      var pata = doc.querySelector('.pata'); if (pata) io.observe(pata);
    }
  }

  kresli(); suhrn();
})();
