/* Vyzdvihnutie personalizovaného prípadu (Fable, 2. 10. 2026; okamžité doručenie, brána pokus 2): pýta sa
 * case.arling.workers.dev na stav objednávky, kým sa prípad stavia, pýta sa znova sama, pri "ready" ukáže
 * odkazy na PDF a vynechané mená, pri "needs_help" ukáže formulár na opravu mien. Nič sa neukladá v prehliadači. */
(function () {
  var API = 'https://case.arling.workers.dev';
  var form = document.getElementById('case-form');
  var out = document.getElementById('case-vysledok');
  var oprava = document.getElementById('case-oprava');
  if (!form || !out) return;
  var FORMATY = { a4: 'A4', letter: 'US Letter', eink: 'E-ink' };
  var DOVODY = {
    JEDNO_SLOVO: 'it was only one word, and we need a first name and a surname',
    PRILIS_DLHE: 'it was too long to print',
    DUPLICITA: 'it was the same as another name on your list',
    PRILIS_VELA: 'your list had more than 14 names',
    PRAZDNE: 'it was empty',
    ZNAKY: 'it had characters we cannot print',
    PRILIS_KRATKE: 'it was too short to be a first name and a surname'
  };
  var CAKANIE = 15000, CAKAJ_HOTOVE = 15 * 60000, CAKAJ_NEZNAME = 5 * 60000;
  var casovac = null, zaciatok = 0;

  function text(t, trieda) { out.className = 'case-vysledok ' + (trieda || ''); out.textContent = t; }
  function odsek(t) { var p = document.createElement('p'); p.textContent = t; out.appendChild(p); return p; }
  function mb(b) { return (b / 1e6).toFixed(1) + ' MB'; }
  function zastav() { if (casovac) { clearTimeout(casovac); casovac = null; } }

  function hotovo(d) {
    if (oprava) oprava.hidden = true;
    out.className = 'case-vysledok hotovo';
    out.textContent = '';
    var dt = new Date(d.expires + 'T12:00:00Z');
    var kedy = isNaN(dt) ? d.expires : dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    odsek('Your case is ready. Download all three files and keep them; the links work until ' + kedy + '.');
    var ul = document.createElement('ul');
    d.files.forEach(function (f) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = f.url;
      a.setAttribute('download', f.name);
      a.setAttribute('data-umami-event', 'case_download');
      a.setAttribute('data-umami-event-format', f.format);
      a.textContent = (FORMATY[f.format] || f.format) + ' PDF';
      var s = document.createElement('span');
      s.textContent = ' ' + mb(f.bytes);
      li.appendChild(a); li.appendChild(s); ul.appendChild(li);
    });
    out.appendChild(ul);
    var vynechane = d.skipped || [];
    if (vynechane.length) {
      var t = 'We used ' + (d.used != null ? d.used + ' names' : 'the names we could read') + ' from your list. ';
      t += vynechane.map(function (v) { return 'We skipped name ' + v.position + ' on your list, because ' + (DOVODY[v.reason] || 'we could not read it') + '.'; }).join(' ');
      t += ' If you want it in your case, message us on Etsy and we will build your case again.';
      odsek(t).className = 'pozn';
    }
    if (d.detectiveSkipped) odsek('We could not use the detective name you typed, so your case uses our own detective.').className = 'pozn';
  }

  function ukazOpravu(order) {
    text('We could not read at least 3 names (first name and surname) from your order. Type them again below and your case is built right away.', 'zle');
    if (!oprava) return;
    oprava.hidden = false;
    oprava.order.value = order;
    var prve = oprava.querySelector('input[name="buyer"]');
    if (prve) prve.focus();
  }

  function zisti(order, surname, tlacidlo) {
    zastav();
    fetch(API + '/status?order=' + encodeURIComponent(order) + '&surname=' + encodeURIComponent(surname), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var uplynulo = Date.now() - zaciatok;
        if (d.status === 'ready') { hotovo(d); return; }
        if (d.status === 'needs_help') { ukazOpravu(order); return; }
        if (d.status === 'pending') {
          if (uplynulo < CAKAJ_HOTOVE) {
            text('We are building your case right now. This usually takes a few minutes. This page checks again by itself, so you can leave it open.');
            casovac = setTimeout(function () { zisti(order, surname); }, CAKANIE);
          } else {
            text('Your case is taking longer than usual. Please check again in a little while, or message us on Etsy (ARLing Puzzles) and we will sort it out.');
          }
          return;
        }
        if (d.status === 'delayed') { text('Something went wrong while building your case, and we have been notified. We will fix it and build it again. Please check back later today, or message us on Etsy (ARLing Puzzles).', 'zle'); return; }
        if (d.status === 'invalid') { text('Please check the order number (digits only) and the surname.', 'zle'); return; }
        if (uplynulo < CAKAJ_NEZNAME) {
          text('We cannot find this order yet. New orders appear here a few minutes after the payment goes through on Etsy, and this page keeps checking for a few minutes. Please also check the order number and the surname.');
          casovac = setTimeout(function () { zisti(order, surname); }, CAKANIE);
        } else {
          text('We still cannot find this order. Please check the order number and use the surname of the first guest you typed when you ordered, or your own surname from the Etsy order. If it still does not work, message us on Etsy (ARLing Puzzles).');
        }
      })
      .catch(function () { text('The download service did not answer. Please try again in a minute.', 'zle'); })
      .then(function () { if (tlacidlo) tlacidlo.disabled = false; });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var order = String(form.order.value || '').replace(/\D/g, '');
    var surname = String(form.surname.value || '').trim();
    if (order.length < 6 || surname.length < 2) { text('Please enter the order number (digits only) and the surname.', 'zle'); return; }
    var tlacidlo = form.querySelector('button');
    tlacidlo.disabled = true;
    if (oprava) oprava.hidden = true;
    zaciatok = Date.now();
    text('Looking for your case...');
    zisti(order, surname, tlacidlo);
  });

  if (oprava) oprava.addEventListener('submit', function (e) {
    e.preventDefault();
    var telo = {
      order: String(oprava.order.value || '').replace(/\D/g, ''),
      buyer: String(oprava.buyer.value || '').trim(),
      names: String(oprava.names.value || '').trim(),
      detective: String(oprava.detective.value || '').trim()
    };
    if (telo.buyer.length < 2 || telo.names.length < 5) { text('Please fill in your surname and the guest names.', 'zle'); return; }
    var tlacidlo = oprava.querySelector('button');
    tlacidlo.disabled = true;
    text('Building your case. This takes about a minute, please keep this page open.');
    fetch(API + '/fix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(telo) })
      .then(function (r) { return r.json().then(function (d) { return { kod: r.status, d: d }; }); })
      .then(function (v) {
        var d = v.d;
        if (d.status === 'ready') { hotovo(d); return; }
        if (d.status === 'wrong_buyer') text('That surname does not match the name on the Etsy order. Please use the surname from your Etsy account or receipt.', 'zle');
        else if (d.status === 'names') text('We still need 3 to 14 guests, each as a first name and a surname, separated by commas (for example Emma Walsh, Liam Turner, Olivia Brooks).', 'zle');
        else if (d.status === 'pending') text('Your case is already being built. Please check again in a minute with the form above.');
        else if (d.status === 'unknown') text('We cannot find an order waiting for names with this number. Please check the order number.', 'zle');
        else text('Building your case failed, and we have been notified. We will fix it and build it again; please check back later today, or message us on Etsy (ARLing Puzzles).', 'zle');
      })
      .catch(function () { text('The download service did not answer. Please try again in a minute.', 'zle'); })
      .then(function () { tlacidlo.disabled = false; });
  });
})();
