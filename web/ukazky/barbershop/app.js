// Holičstvo Krátko (ukážka): zvýrazní dnešný deň v otváracích hodinách a napíše, či je teraz otvorené
// (v úvode celou vetou, v hlavičke na mobile skrátene). Čas berie podľa Bratislavy. Bez skriptu stránka funguje rovnako,
// len bez zvýraznenia. Za jednopísmenovými predložkami je pevná medzera, aby „o“ neostalo na konci riadka.
(function () {
  var riadky = document.querySelectorAll('[data-den]');
  if (!riadky.length) return;
  var NB = ' ';

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

  var dni = {};
  riadky.forEach(function (r) {
    dni[r.getAttribute('data-den')] = { od: r.getAttribute('data-od'), do: r.getAttribute('data-do'), riadok: r };
  });

  function naMin(t) { var x = t.split(':'); return parseInt(x[0], 10) * 60 + parseInt(x[1], 10); }
  var vDen = ['v' + NB + 'nedeľu', 'v' + NB + 'pondelok', 'v' + NB + 'utorok', 'v' + NB + 'stredu', 'vo' + NB + 'štvrtok', 'v' + NB + 'piatok', 'v' + NB + 'sobotu'];

  var dnes = dni[String(teraz.den)];
  if (dnes) {
    dnes.riadok.classList.add('dnes');
    dnes.riadok.setAttribute('aria-current', 'date');
    var znacka = dnes.riadok.querySelector('.znacka-dnes');
    if (znacka) znacka.hidden = false;
  }

  var text, kratky;
  if (dnes && dnes.od && teraz.min < naMin(dnes.od)) {
    text = 'Dnes otvárame o' + NB + dnes.od;
    kratky = 'Dnes otvárame o' + NB + dnes.od;
  } else if (dnes && dnes.od && teraz.min < naMin(dnes.do)) {
    text = 'Teraz otvorené, dnes do' + NB + dnes.do;
    kratky = 'Teraz otvorené do' + NB + dnes.do;
  } else {
    for (var i = 1; i <= 7; i++) {
      var k = (teraz.den + i) % 7;
      var dalsi = dni[String(k)];
      if (dalsi && dalsi.od) {
        var kedy = i === 1 ? 'zajtra' : vDen[k];
        text = (dnes && dnes.od ? 'Dnes už zatvorené. ' : 'Dnes zatvorené. ') + 'Otvárame ' + kedy + ' o' + NB + dalsi.od;
        kratky = 'Zatvorené, otvárame ' + kedy + ' o' + NB + dalsi.od;
        break;
      }
    }
  }

  var stav = document.getElementById('stav');
  if (stav && text) {
    stav.querySelector('.stav-text').textContent = text;
    stav.hidden = false;
  }
  var hlava = document.querySelector('.hlava-stav');
  if (hlava && kratky) {
    hlava.querySelector('.hlava-stav-text').textContent = kratky;
    hlava.hidden = false;
  }
})();
