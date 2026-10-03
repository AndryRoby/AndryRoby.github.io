/* Vyzdvihnutie personalizovaného prípadu (Fable, 2. 10. 2026; okamžité doručenie, brána pokus 2; overenie pred
 * spustením 3. 10.): pýta sa case.arling.workers.dev na stav objednávky, kým sa prípad stavia, pýta sa znova sama,
 * pri "ready" ukáže odkazy na PDF, počet použitých mien a vynechané mená, pri "needs_help" formulár na mená.
 * Objednávka môže mať viac prípadov (cases); hotový prípad sa dá raz opraviť (pôvodné súbory platia, kým nie sú
 * nové). Výsledok sa po akcii posunie do zorného poľa (na mobile bol pod okrajom). Nič sa neukladá v prehliadači. */
(function () {
  var API = 'https://case.arling.workers.dev';
  var form = document.getElementById('case-form');
  var out = document.getElementById('case-vysledok');
  var oprava = document.getElementById('case-oprava');
  var opravaUvod = document.getElementById('oprava-uvod');
  var opravaStav = document.getElementById('oprava-vysledok');
  var casEl = document.getElementById('case-cas');
  if (!form || !out) return;
  var FORMATY = { a4: 'A4', letter: 'US Letter', eink: 'E-ink' };
  // kódy dôvodov z products/eliminacia/vlastne.mjs (DOVODY) a MALO_MIEN
  var DOVODY = {
    JEDNO_SLOVO: 'it was only one word (we need a first name and a surname, like Emma Walsh)',
    SPOJENE: 'it looked like several names without commas between them',
    PRILIS_DLHE: 'it was too long to print (at most 20 letters in one word and in the surname)',
    ZNAKY: 'it had characters we cannot print (letters, apostrophes and hyphens work)',
    PRAZDNE: 'it had only a title or an initial, like Mr. or J.',
    PRILIS_KRATKE: 'a part of it was too short to print',
    DUPLICITA: 'it was the same as another name on your list',
    PRILIS_VELA: 'a case has room for 14 friends'
  };
  var ETSY = 'message us on Etsy (ARLing Puzzles); we reply within 24 hours';
  var CAKANIE = 15000, CAKAJ_HOTOVE = 15 * 60000, CAKAJ_NEZNAME = 5 * 60000;
  var casovac = null, zaciatok = 0, podpis = '';
  var ticho = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function prvok(tag, trieda, text) {
    var e = document.createElement(tag);
    if (trieda) e.className = trieda;
    if (text != null) e.textContent = text;
    return e;
  }
  function zastav() { if (casovac) { clearTimeout(casovac); casovac = null; } }
  function ukaz(el) {
    if (el && el.scrollIntoView) { try { el.scrollIntoView({ behavior: ticho ? 'auto' : 'smooth', block: 'nearest' }); } catch (e) { el.scrollIntoView(false); } }
  }
  function sprava(t, trieda) {
    podpis = '';
    out.className = 'case-vysledok';
    out.textContent = '';
    return out.appendChild(prvok('p', trieda || '', t));
  }
  function cas(t) { if (casEl) casEl.textContent = t || ''; }
  function skontrolovane() {
    cas('Last checked at ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) + '.');
  }
  function mb(b) { return (b / 1e6).toFixed(1) + ' MB'; }
  function vynechane(zoznam) {
    return zoznam.map(function (v) { return 'name ' + v.position + ', because ' + (DOVODY[v.reason] || 'we could not read it'); }).join('; ');
  }
  function datum(d) {
    var dt = new Date(d + 'T12:00:00Z');
    return isNaN(dt) ? d : dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }
  function stav(t, trieda) {
    if (!opravaStav) return;
    opravaStav.className = 'oprava-stav ' + (trieda || '');
    opravaStav.textContent = t;
    ukaz(opravaStav);
  }

  function fokus(el) { if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } } }

  /* Formulár na mená pod výsledkom: pre prípad, ktorý čaká na mená, alebo pre jednu opravu hotového prípadu.
   * akcia: 'fokus' (kurzor do prvého poľa), 'skok' (aj posun k formuláru, po ťuknutí na odkaz), inak nič. */
  function otvorOpravu(c, order, viac, akcia) {
    if (!oprava) return;
    var ten = oprava.elements['case'].value === (c.id || '') && !oprava.hidden;
    oprava.hidden = false;
    oprava.elements.order.value = order;
    oprava.elements['case'].value = c.id || '';
    var ktory = viac && c.number ? ' for personalized case ' + c.number : '';
    if (opravaUvod) {
      opravaUvod.textContent = c.status === 'ready'
        ? 'Type the full list of guests again' + ktory + ', the way it should be in your case. Your current files stay on this page and keep working until the new ones are ready. You can do this once.'
        : 'Type the guest names' + ktory + ' below. Your case is built right away, in about a minute.';
    }
    // pri opakovanom vykreslení toho istého prípadu ostane posledná správa formulára (napríklad chyba mien)
    if (opravaStav && !ten) { opravaStav.textContent = ''; opravaStav.className = 'oprava-stav'; }
    if (akcia === 'skok') ukaz(oprava);
    if (akcia) fokus(oprava.elements.buyer);
  }
  function tlacidloOpravy(text, c, order, viac) {
    var b = prvok('button', 'case-odkaz', text);
    b.type = 'button';
    b.setAttribute('data-umami-event', 'case_fix_open');
    b.addEventListener('click', function () { otvorOpravu(c, order, viac, 'skok'); });
    return b;
  }

  function hotovyBlok(blok, c, order, viac) {
    blok.classList.add('hotovo');
    blok.appendChild(prvok('p', '', 'Your case is ready. Download all three files and keep them; the links work until ' + datum(c.expires) + '.'));
    var ul = prvok('ul');
    (c.files || []).forEach(function (f) {
      var li = prvok('li');
      var a = prvok('a', '', (FORMATY[f.format] || f.format) + ' PDF');
      a.href = f.url;
      a.setAttribute('download', f.name);
      a.setAttribute('data-umami-event', 'case_download');
      a.setAttribute('data-umami-event-format', f.format);
      li.appendChild(a);
      li.appendChild(prvok('span', '', mb(f.bytes)));
      ul.appendChild(li);
    });
    blok.appendChild(ul);
    var skip = c.skipped || [];
    var t = c.used != null ? 'We used ' + c.used + ' names from your list.' : '';
    if (skip.length) t += ' Counting each person on your list separately, we left out ' + vynechane(skip) + '.';
    if (t) blok.appendChild(prvok('p', 'pozn', t.trim()));
    if (c.detectiveSkipped) blok.appendChild(prvok('p', 'pozn', 'We could not use the detective name you typed (it was too long or had characters we cannot print), so your case uses our own detective.'));
    if (c.fixing) blok.appendChild(prvok('p', 'pozn', 'We are building your corrected case now. Your current files stay here and keep working until the new ones are ready.'));
    else if (c.fixable) blok.appendChild(tlacidloOpravy('A name is wrong? You can fix the names once', c, order, viac));
    else blok.appendChild(prvok('p', 'pozn', 'You have already fixed the names of this case once. If a name is still wrong, ' + ETSY + '.'));
  }

  var POMOC = {
    INTERRUPTED: 'Your last try did not finish, so this case was not built. Please type the names again below; it takes about a minute.',
    BUILD_FAILED: 'Building this case from the names you typed failed, and we have been notified. Please try once more below. If it fails again, ' + ETSY + '.'
  };
  function pomocBlok(blok, c, order, viac) {
    blok.classList.add('zle');
    blok.appendChild(prvok('p', '', POMOC[c.reason] || 'We could not read at least 3 names (first name and surname) from your order. Type them again below and your case is built right away.'));
    if (viac) blok.appendChild(tlacidloOpravy('Type the names for this case', c, order, viac));
  }

  /* Vykreslí všetky prípady objednávky. Vráti true, keď sa má stránka pýtať znova (stavba beží). */
  function vykresli(d, order, uplynulo, sFokusom) {
    var cases = d.cases && d.cases.length ? d.cases : [d];
    var viac = cases.length > 1;
    var cakat = false, pomoc = null;
    var novy = JSON.stringify(d) + (uplynulo >= CAKAJ_HOTOVE ? '+' : '');
    if (novy === podpis) {
      cases.forEach(function (c) { if (c.status === 'pending' || c.fixing) cakat = true; });
      return cakat && uplynulo < CAKAJ_HOTOVE;
    }
    podpis = novy;
    out.className = 'case-vysledok';
    out.textContent = '';
    cases.forEach(function (c, i) {
      var blok = prvok('div', 'pripad');
      if (viac) blok.appendChild(prvok('h2', 'pripad-nazov', 'Personalized case ' + (c.number || i + 1) + ' of ' + cases.length));
      if (c.status === 'ready') { hotovyBlok(blok, c, order, viac); if (c.fixing) cakat = true; }
      else if (c.status === 'needs_help') { pomocBlok(blok, c, order, viac); if (!pomoc) pomoc = c; }
      else if (c.status === 'delayed') {
        blok.classList.add('zle');
        blok.appendChild(prvok('p', '', 'Something went wrong while building your case, and we have been notified. We will build it again within 24 hours, and your files will appear on this page. You can also ' + ETSY + '.'));
      } else if (uplynulo < CAKAJ_HOTOVE) {
        blok.appendChild(prvok('p', '', 'We are building your case right now. This usually takes a few minutes. This page checks again by itself, so you can leave it open.'));
        cakat = true;
      } else {
        blok.appendChild(prvok('p', '', 'Your case is taking longer than usual. Please check again in an hour, or ' + ETSY + '.'));
      }
      out.appendChild(blok);
    });
    if (d.others) {
      out.appendChild(prvok('p', 'pozn', 'This order has ' + d.others + ' more personalized case' + (d.others > 1 ? 's' : '') + '. To see ' + (d.others > 1 ? 'them' : 'it') + ' too, use your own surname as it appears on the Etsy order, or the surname of the first guest on that list.'));
    }
    // jediný prípad, ktorý čaká na mená: formulár hneď (ako doteraz); pri viacerých tlačidlom pri prípade
    if (pomoc && !viac) otvorOpravu(pomoc, order, false, sFokusom ? 'fokus' : '');
    else if (!pomoc && oprava && !oprava.hidden && !cases.some(function (c) { return c.status === 'ready' && c.fixable; })) oprava.hidden = true;
    return cakat && uplynulo < CAKAJ_HOTOVE;
  }

  /* Neznáma objednávka: hneď povie, že preklep vyzerá rovnako, a ponúkne priezvisko kupujúceho z Etsy.
   * Vykreslí sa len pri zmene (pred a po 5 minútach), aby ťukanie na tlačidlo neprerušilo každé hľadanie. */
  function nezname(uplynulo) {
    var neskoro = uplynulo >= CAKAJ_NEZNAME;
    if (podpis === 'unknown' + neskoro) return;
    if (!neskoro) {
      sprava('We cannot find a case for this order number and surname yet. If you paid just now, it appears here within a few minutes, and this page keeps checking. A typo in the order number or in the surname looks exactly the same, so please check both now: use the surname of the first guest on your list, or your own surname as it appears on the Etsy order.');
    } else {
      sprava('We still cannot find a case for this order number and surname. Please check the order number, and try your own surname as it appears on the Etsy order. Files are kept for 30 days after a case is built. If you ordered earlier, or nothing works, ' + ETSY + '. Press Find my case to check again.', 'zle');
    }
    var b = prvok('button', 'case-odkaz', 'Try my own surname from the Etsy order');
    b.type = 'button';
    b.addEventListener('click', function () {
      zastav();
      cas('');
      form.elements.surname.value = '';
      form.elements.surname.setAttribute('placeholder', 'your surname, as on the Etsy order');
      ukaz(form.elements.surname);
      fokus(form.elements.surname);
    });
    out.appendChild(b);
    podpis = 'unknown' + neskoro;
  }

  /* zaloha: hotový prípad z /fix, keby sa /status nepodaril (aby kupujúci videl odkazy hneď). */
  function zisti(order, surname, tlacidlo, rolovat, zaloha) {
    zastav();
    fetch(API + '/status?order=' + encodeURIComponent(order) + '&surname=' + encodeURIComponent(surname), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var uplynulo = Date.now() - zaciatok;
        if (d.status === 'invalid') { cas(''); sprava('Please check the order number (digits only) and the surname.', 'zle'); }
        else if (d.status === 'unknown' && zaloha) { cas(''); vykresli({ cases: [zaloha] }, order, 0, false); }
        else if (d.status === 'unknown') {
          nezname(uplynulo);
          if (uplynulo < CAKAJ_NEZNAME) { skontrolovane(); casovac = setTimeout(function () { zisti(order, surname); }, CAKANIE); } else cas('');
        } else if (vykresli(d, order, uplynulo, !!rolovat)) {
          skontrolovane();
          casovac = setTimeout(function () { zisti(order, surname); }, CAKANIE);
        } else cas('');
        if (rolovat) ukaz(out);
      })
      .catch(function () {
        if (zaloha) { vykresli({ cases: [zaloha] }, order, 0, false); if (rolovat) ukaz(out); return; }
        sprava('The download service did not answer. Please try again in a minute.', 'zle');
        cas('');
        if (rolovat) ukaz(out);
      })
      .then(function () { if (tlacidlo) tlacidlo.disabled = false; });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var order = String(form.elements.order.value || '').replace(/\D/g, '');
    var surname = String(form.elements.surname.value || '').trim();
    if (order.length < 6 || surname.length < 2) { sprava('Please enter the order number (digits only) and the surname.', 'zle'); ukaz(out); return; }
    var tlacidlo = form.querySelector('button');
    tlacidlo.disabled = true;
    if (oprava) oprava.hidden = true;
    zaciatok = Date.now();
    sprava('Looking for your case...');
    zisti(order, surname, tlacidlo, true);
  });

  if (oprava) oprava.addEventListener('submit', function (e) {
    e.preventDefault();
    var telo = {
      order: String(oprava.elements.order.value || '').replace(/\D/g, ''),
      'case': String(oprava.elements['case'].value || ''),
      buyer: String(oprava.elements.buyer.value || '').trim(),
      names: String(oprava.elements.names.value || '').trim(),
      detective: String(oprava.elements.detective.value || '').trim()
    };
    if (telo.buyer.length < 2 || telo.names.length < 5) { stav('Please fill in your surname and the guest names.', 'zle'); return; }
    var tlacidlo = oprava.querySelector('button[type="submit"]');
    tlacidlo.disabled = true;
    zastav();
    cas('');
    stav('Building your case. This takes about a minute; please keep this page open.');
    fetch(API + '/fix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(telo) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.status === 'ready') {
          oprava.hidden = true;
          zaciatok = Date.now();
          sprava('Your case is ready.');
          zisti(telo.order, telo.buyer, null, true, d);
          fokus(out); // fokus bol vo formulári, ktorý sa skryl
          return;
        }
        if (d.status === 'wrong_buyer') stav('That surname does not match the name on this Etsy order. Type your own surname exactly as it appears on the Etsy receipt, not a guest’s surname. If you ordered it as a gift, or it still does not match, ' + ETSY + ', and we will unlock this form for you.', 'zle');
        else if (d.status === 'already_fixed') stav('You have already used the one fix for this case, so it cannot be built again here. If a name is still wrong, ' + ETSY + '.', 'zle');
        else if (d.status === 'names') {
          var t = d.reason === 'MALO_MIEN'
            ? 'We need at least 3 guests, each with a first name and a surname' + (d.valid != null ? '; we could use ' + d.valid + ' from this list.' : '.')
            : 'We could not read this list.';
          var skip = d.skipped || [];
          if (skip.length) t += ' Counting each person separately, we could not use ' + vynechane(skip) + '.';
          t += ' Please write 3 to 14 guests, each as a first name and a surname, separated by commas (for example Emma Walsh, Liam Turner, Olivia Brooks), and press Build my case again.';
          stav(t, 'zle');
        } else if (d.status === 'pending') {
          stav('This case is already being built. It appears above as soon as it is ready.');
          zaciatok = Date.now();
          zisti(telo.order, telo.buyer, null, true);
        } else if (d.status === 'unknown') stav('We cannot find a case waiting for names under this order number anymore. Please press Find my case again.', 'zle');
        else if (d.status === 'invalid') stav('Please check your surname and the guest names.', 'zle');
        else if (d.kept) stav('Building your corrected case failed, and we have been notified. Your current files are unchanged and still work. Please try again in a few minutes; if it fails again, ' + ETSY + '.', 'zle');
        else stav('Building your case failed, and we have been notified. Please press Build my case once more. If it fails again, ' + ETSY + '.', 'zle');
      })
      .catch(function () {
        // spojenie spadlo počas stavby: stavba môže bežať ďalej, preto sa stránka spýta na stav namiesto chyby
        stav('We lost the connection while your case was being built. Checking where it stands...');
        zaciatok = Date.now();
        casovac = setTimeout(function () { zisti(telo.order, telo.buyer, null, true); }, 5000);
      })
      .then(function () { tlacidlo.disabled = false; });
  });
})();
