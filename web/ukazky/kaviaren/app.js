// Kaviareň Okenica (ukážka). Všetko len v prehliadači, nič sa nikam neposiela:
// 1. z tabuľky otváracích hodín vypočíta, či je teraz otvorené (čas Bratislavy), napíše to do úvodu a do mobilného pásu
//    a zvýrazní dnešný riadok tabuľky,
// 2. úvod: počká na fotky tanierov a písmo nadpisu (najviac 1,2 s) a až potom pustí jeden moment dosadnutia,
// 3. mobilný pás s hlavnou akciou ukáže až vtedy, keď tlačidlá úvodu odídu z obrazu,
// 4. vitrína: šípky posúvajú pás koláčov, ukážu sa len vtedy, keď sa pás nezmestí.
// Bez skriptu je stránka úplná: stav nahrádza veta o hodinách, taniere ležia hneď a pás sa posúva prstom alebo klávesnicou.
(function () {
  var NB = ' ';
  var koren = document.documentElement;

  // 1. Otvorené teraz
  var riadky = document.querySelectorAll('.hodiny tr[data-dni]');
  if (riadky.length) {
    var teraz;
    try {
      var casti = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Bratislava', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date());
      var mapa = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      var p = {};
      casti.forEach(function (c) { p[c.type] = c.value; });
      teraz = { den: mapa[p.weekday], min: parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10) };
    } catch (e) {
      var d = new Date();
      teraz = { den: d.getDay(), min: d.getHours() * 60 + d.getMinutes() };
    }

    var naMin = function (t) { var x = t.split(':'); return parseInt(x[0], 10) * 60 + parseInt(x[1], 10); };
    var minut = function (n) { return n + NB + (n === 1 ? 'minútu' : n >= 2 && n <= 4 ? 'minúty' : 'minút'); };
    var dni = {};
    riadky.forEach(function (r) {
      r.getAttribute('data-dni').split(' ').forEach(function (k) {
        dni[k] = { od: r.getAttribute('data-od'), 'do': r.getAttribute('data-do'), riadok: r };
      });
    });

    var dnes = dni[String(teraz.den)];
    if (dnes) {
      dnes.riadok.classList.add('dnes');
      var znacka = dnes.riadok.querySelector('.znacka-dnes');
      if (znacka) znacka.hidden = false;
    }

    var vDen = ['v' + NB + 'nedeľu', 'v' + NB + 'pondelok', 'v' + NB + 'utorok', 'v' + NB + 'stredu', 'vo' + NB + 'štvrtok', 'v' + NB + 'piatok', 'v' + NB + 'sobotu'];
    var text, kratky, stav;
    if (dnes && teraz.min >= naMin(dnes.od) && teraz.min < naMin(dnes['do'])) {
      stav = 'otvorene';
      var ostava = naMin(dnes['do']) - teraz.min;
      text = ostava <= 30 ? 'Otvorené ešte ' + minut(ostava) + ', do' + NB + dnes['do'] : 'Dnes otvorené do' + NB + dnes['do'];
      kratky = 'Otvorené do' + NB + dnes['do'];
    } else if (dnes && teraz.min < naMin(dnes.od)) {
      stav = 'zatvorene';
      text = 'Otvárame dnes o' + NB + dnes.od;
      kratky = 'Otvárame o' + NB + dnes.od;
    } else {
      stav = 'zatvorene';
      for (var i = 1; i <= 7; i++) {
        var k = (teraz.den + i) % 7;
        if (dni[String(k)]) {
          var kedy = i === 1 ? 'zajtra' : vDen[k];
          text = 'Dnes už zatvorené, ' + kedy + ' od' + NB + dni[String(k)].od;
          kratky = 'Zatvorené, ' + kedy + ' od' + NB + dni[String(k)].od;
          break;
        }
      }
    }

    var uvod = document.getElementById('stav');
    if (uvod && text) {
      uvod.querySelector('.stav-text').textContent = text;
      uvod.setAttribute('data-stav', stav);
    }
    var listaStav = document.querySelector('.lista-stav');
    if (listaStav && kratky) {
      listaStav.textContent = kratky;
      listaStav.setAttribute('data-stav', stav);
      listaStav.hidden = false;
    }
  }

  // 2. Úvod: taniere, tiene a nadpis v konečnom písme prídu spolu
  var hotovo = function () { koren.classList.add('stol'); };
  try {
    var cakam = [];
    document.querySelectorAll('.taniere img').forEach(function (img) {
      if (img.decode) cakam.push(img.decode().catch(function () {}));
    });
    if (document.fonts && document.fonts.load) cakam.push(document.fonts.load('900 1em "Okenica Nadpis"').catch(function () {}));
    var strop = new Promise(function (r) { setTimeout(r, 1200); });
    Promise.race([Promise.all(cakam), strop]).then(hotovo, hotovo);
  } catch (e) { hotovo(); }

  // 3. Mobilný pás: až keď tlačidlá úvodu odídu hore z obrazu
  var lista = document.querySelector('.lista');
  var akcie = document.querySelector('.uvod-akcie');
  if (lista && akcie) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (z) {
        var e = z[z.length - 1];
        lista.classList.toggle('vidno', !e.isIntersecting && e.boundingClientRect.bottom < 1);
      }).observe(akcie);
    } else {
      lista.classList.add('vidno');
    }
  }

  // 4. Vitrína
  var pas = document.getElementById('pas-kolacov');
  var sipky = document.querySelector('.sipky');
  if (pas && sipky) {
    var tlacidla = sipky.querySelectorAll('.sipka');
    var meno = pas.getAttribute('aria-label');
    var obnov = function () {
      var max = pas.scrollWidth - pas.clientWidth;
      var tecie = max >= 8;
      sipky.hidden = !tecie;
      // zastavenie klávesnice a meno len vtedy, keď sa pás naozaj posúva
      if (tecie) { pas.setAttribute('tabindex', '0'); pas.setAttribute('aria-label', meno); }
      else { pas.removeAttribute('tabindex'); pas.setAttribute('aria-label', 'Koláče vo vitríne'); }
      tlacidla[0].disabled = pas.scrollLeft < 8;
      tlacidla[1].disabled = pas.scrollLeft > max - 8;
    };
    var tichy = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    tlacidla.forEach(function (t) {
      t.addEventListener('click', function () {
        var kus = pas.querySelector('.kolac');
        var krok = kus ? kus.getBoundingClientRect().width + parseFloat(getComputedStyle(pas).columnGap || 24) : 240;
        pas.scrollBy({ left: krok * parseInt(t.getAttribute('data-smer'), 10), behavior: tichy ? 'auto' : 'smooth' });
      });
    });
    var caka = false;
    pas.addEventListener('scroll', function () {
      if (caka) return;
      caka = true;
      requestAnimationFrame(function () { caka = false; obnov(); });
    }, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(obnov).observe(pas); else window.addEventListener('resize', obnov);
    obnov();
  }
})();
