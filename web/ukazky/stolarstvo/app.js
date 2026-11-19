// Stolárstvo Rybina (ukážka): orientačná cena kuchyne s nákresom v zvolenom materiáli, body na fotke,
// kóta pri prvej realizácii a stav dielne.
// Všetko sa počíta v prehliadači, nič sa neodosiela. Bez skriptu je stránka úplná: cena pre 3,5 m v lamináte,
// údaje bodov v legende pod fotkou, kóta nakreslená, hodiny v tabuľke.
(function () {
  var NB = ' ';
  document.documentElement.classList.add('js');

  // 1. Orientačná cena: dĺžka linky krát rozsah za bežný meter
  var dlzka = document.getElementById('dlzka');
  if (dlzka) {
    var moduly = document.querySelectorAll('#moduly i');
    var nakres = document.querySelector('.nakres');
    var texty = {
      dlzka: document.getElementById('dlzka-text'),
      nakres: document.getElementById('nakres-dlzka'),
      popis: document.getElementById('vysledok-popis'),
      suma: document.getElementById('vysledok-suma'),
      pri: document.getElementById('dlzka-cena')
    };
    var radia = document.querySelectorAll('input[name="material"]');

    function metre(m) { return String(m).replace('.', ',') + NB + 'm'; }
    function eura(x) {
      return String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
    }
    function prepocitaj() {
      var m = Math.min(7, Math.max(2, parseFloat(dlzka.value) || 3.5));
      var mat = null;
      radia.forEach(function (r) { if (r.checked) mat = r; });
      if (!mat) mat = radia[0];
      var od = m * parseFloat(mat.getAttribute('data-od'));
      var po = m * parseFloat(mat.getAttribute('data-do'));
      var n = Math.round(m * 2);
      texty.dlzka.textContent = metre(m);
      texty.nakres.textContent = metre(m);
      texty.popis.textContent = 'Linka ' + metre(m) + ', ' + mat.getAttribute('data-meno') + ', orientačne';
      texty.suma.textContent = eura(od) + ' až ' + eura(po) + NB + '€';
      if (texty.pri) texty.pri.textContent = texty.suma.textContent;
      dlzka.setAttribute('aria-valuetext', metre(m).replace(NB, ' ') + ', ' + eura(od).replace(NB, ' ') + ' až ' + eura(po).replace(NB, ' ') + ' eur');
      if (nakres) { nakres.style.setProperty('--n', n); nakres.setAttribute('data-material', mat.value); }
      moduly.forEach(function (el, i) { el.classList.toggle('je', i < n); });
    }
    dlzka.addEventListener('input', prepocitaj);
    radia.forEach(function (r) { r.addEventListener('change', prepocitaj); });
    prepocitaj();
  }

  // 2. Body na fotke: klik alebo Enter otvorí údaj, druhý klik, Escape alebo klik mimo ho zavrie
  var body = document.querySelectorAll('.bod-tl');
  function zavriBody(okrem) {
    body.forEach(function (b) { if (b !== okrem) b.setAttribute('aria-expanded', 'false'); });
  }
  body.forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var otvoreny = b.getAttribute('aria-expanded') === 'true';
      zavriBody(b);
      b.setAttribute('aria-expanded', otvoreny ? 'false' : 'true');
    });
  });
  if (body.length) {
    document.addEventListener('click', function () { zavriBody(null); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') zavriBody(null); });
  }

  // 3. Kóta pod prvou realizáciou sa raz nakreslí, keď príde do obrazovky
  var kota = document.querySelector('.kota');
  if (kota) {
    if ('IntersectionObserver' in window) {
      var oko = new IntersectionObserver(function (zaznamy) {
        zaznamy.forEach(function (z) {
          if (z.isIntersecting) { kota.classList.add('nakreslena'); oko.disconnect(); }
        });
      }, { threshold: 0.6 });
      oko.observe(kota);
    } else {
      kota.classList.add('nakreslena');
    }
  }

  // Mobilný pás s hlavnou akciou je v CSS skrytý a ukáže sa, až keď tlačidlo v úvode zmizne z obrazovky
  // (dve rovnaké tlačidlá naraz netreba; bez skriptu ho ukáže pravidlo scripting: none)
  var lista = document.querySelector('.lista');
  var prve = document.querySelector('.spoj-akcie .akcia');
  if (lista && prve && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (zaznamy) {
      var vidno = zaznamy[zaznamy.length - 1].isIntersecting;
      lista.classList.toggle('ukazana', !vidno);
      if (vidno) lista.setAttribute('inert', ''); else lista.removeAttribute('inert');
    }).observe(prve);
  }

  // 4. Stav dielne podľa času v Bratislave
  var hodiny = document.getElementById('hodiny');
  var stav = document.getElementById('stav');
  if (hodiny && stav) {
    var teraz;
    try {
      var casti = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Bratislava', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date());
      var dni = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      var p = {};
      casti.forEach(function (c) { p[c.type] = c.value; });
      teraz = { den: dni[p.weekday], min: parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10) };
    } catch (e) {
      var d = new Date();
      teraz = { den: d.getDay(), min: d.getHours() * 60 + d.getMinutes() };
    }
    var naMin = function (t) { var x = t.split(':'); return parseInt(x[0], 10) * 60 + parseInt(x[1], 10); };
    var od = hodiny.getAttribute('data-od');
    var po = hodiny.getAttribute('data-do');
    var pracovny = teraz.den >= 1 && teraz.den <= 5;
    var text;
    if (pracovny && teraz.min >= naMin(od) && teraz.min < naMin(po)) {
      text = 'Teraz sme v' + NB + 'dielni, dnes do' + NB + po + '.';
    } else if (pracovny && teraz.min < naMin(od)) {
      text = 'Dnes otvárame o' + NB + od + '.';
    } else if (teraz.den >= 1 && teraz.den <= 4) {
      text = 'Dnes už zatvorené, otvárame zajtra o' + NB + od + '.';
    } else {
      text = 'Teraz zatvorené, otvárame v' + NB + 'pondelok o' + NB + od + '.';
    }
    stav.textContent = text;
    stav.hidden = false;
  }
})();
