/* Vyzdvihnutie personalizovaného prípadu (Fable, 2. 10. 2026): pýta sa case.arling.workers.dev na stav
 * objednávky a pri "ready" ukáže odkazy na PDF. Žiadne dáta sa neukladajú v prehliadači. */
(function () {
  var API = 'https://case.arling.workers.dev/status';
  var form = document.getElementById('case-form');
  var out = document.getElementById('case-vysledok');
  if (!form || !out) return;
  var FORMATY = { a4: 'A4', letter: 'US Letter', eink: 'E-ink' };
  function text(t, trieda) { out.className = 'case-vysledok ' + (trieda || ''); out.textContent = t; }
  function mb(b) { return (b / 1e6).toFixed(1) + ' MB'; }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var order = String(form.order.value || '').replace(/\D/g, '');
    var surname = String(form.surname.value || '').trim();
    if (order.length < 6 || surname.length < 2) { text('Please enter the order number (digits only) and the surname.', 'zle'); return; }
    var tlacidlo = form.querySelector('button');
    tlacidlo.disabled = true;
    text('Looking for your case...');
    fetch(API + '?order=' + encodeURIComponent(order) + '&surname=' + encodeURIComponent(surname), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.status === 'ready') {
          out.className = 'case-vysledok hotovo';
          out.textContent = '';
          var h = document.createElement('p');
          h.textContent = 'Your case is ready. Download all three files and keep them; the links work until ' + d.expires + '.';
          out.appendChild(h);
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
        } else if (d.status === 'pending') {
          text('We are building your case. It will be here within 24 hours of your order.');
        } else if (d.status === 'needs_help') {
          text('We could not use one of the names you typed. We will message you on Etsy.', 'zle');
        } else if (d.status === 'invalid') {
          text('Please check the order number (digits only) and the surname.', 'zle');
        } else {
          text('We cannot find this order yet. New orders show up here within a few hours, always within 24 hours. Please check the order number and the surname of the first guest you typed at checkout.');
        }
      })
      .catch(function () { text('The download service did not answer. Please try again in a minute.', 'zle'); })
      .then(function () { tlacidlo.disabled = false; });
  });
})();
