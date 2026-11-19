// Ateliér Olovnica (ukážka): drobné správanie stránky. Bez skriptu funguje všetok obsah (fotky prác cez noscript),
// chýba len zvýraznenie dneška, kalkulačka, prepínače pôdorysov, pretáčanie kót, pripnutý pás prác,
// tlačidlá Predošlá a Ďalšia pri voľnom páse, zameriavač nad pôdorysom, kreslenie výkresu až v obraze
// (mobil a tablet), skrývanie spodnej lišty pri tlačidle v úvode a krátke orámovanie fotky po ťuknutí na značku A.
// Olovnica nad ı, kreslenie pôdorysu, odkrytie fotky pohľadu A aj spojenie značky A s fotkou pri prechode myšou
// sú čisté CSS. Pri posune stránky sa tu nepočíta rozloženie: pás prác posúva časová os posunu v CSS,
// lištu a výkres prepínajú pozorovatelia (IntersectionObserver).
(function () {
  'use strict';

  var pohyb = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var maIO = 'IntersectionObserver' in window;
  var NBSP = ' ';

  // 1. Hodiny v ateliéri: zvýrazní dnešok a v úvode prepíše stav. Čas podľa Bratislavy.
  //    Texty sú krátke (najviac 36 znakov), aby sa riadok pri prepísaní nezalomil inak než statický text.
  (function () {
    var riadky = document.querySelectorAll('[data-den]');
    if (!riadky.length) return;
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
    var vDen = ['v nedeľu', 'v pondelok', 'v utorok', 'v stredu', 'vo štvrtok', 'v piatok', 'v sobotu'];
    var dnes = dni[String(teraz.den)];
    if (dnes) {
      dnes.riadok.classList.add('dnes');
      dnes.riadok.setAttribute('aria-current', 'date');
      var znacka = dnes.riadok.querySelector('.znacka-dnes');
      if (znacka) znacka.hidden = false;
    }
    var text;
    if (dnes && dnes.od && teraz.min < naMin(dnes.od)) {
      text = 'Dnes sme v ateliéri od ' + dnes.od;
    } else if (dnes && dnes.od && teraz.min < naMin(dnes.do)) {
      text = 'Teraz sme v ateliéri, do ' + dnes.do;
    } else {
      for (var i = 1; i <= 7; i++) {
        var k = (teraz.den + i) % 7;
        var dalsi = dni[String(k)];
        if (dalsi && dalsi.od) {
          text = 'Sme tu ' + (i === 1 ? 'zajtra' : vDen[k]) + ' od ' + dalsi.od;
          break;
        }
      }
    }
    var stav = document.querySelector('#stav .stav-text');
    if (stav && text) stav.textContent = text.replace(/ (v|vo) /g, ' $1' + NBSP);
  })();

  // 2. Kalkulačka ceny návrhu podľa plochy (30 a 45 € za m², ako v cenníku), len pre 20 až 300 m².
  //    Pri každej zmene poľa sa výsledok počíta znova z toho, čo v poli práve je: mimo rozsahu (aj počas písania)
  //    sa namiesto čísel ukáže veta, starý výsledok nikdy neostane. Hodnota v poli sa nikdy neprepisuje,
  //    obmedzí sa len posuvník.
  (function () {
    var MIN = 20, MAX = 300;
    var pole = document.getElementById('plocha');
    var posuvnik = document.getElementById('plocha-posuvnik');
    var studia = document.getElementById('vysledok-studia');
    var komplet = document.getElementById('vysledok-komplet');
    var vysledok = document.getElementById('kalk-vysledok');
    var hlaska = document.getElementById('kalk-hlaska');
    if (!pole || !posuvnik || !studia || !komplet || !vysledok || !hlaska) return;
    var format;
    try { format = new Intl.NumberFormat('sk-SK'); } catch (e) { format = null; }
    function suma(n) {
      var t = format ? format.format(n) : String(n);
      return t.replace(/\s/g, NBSP) + NBSP + '€';
    }
    function ukazHlasku(text) {
      studia.textContent = '';
      komplet.textContent = '';
      vysledok.hidden = true;
      hlaska.textContent = text;
      hlaska.hidden = false;
      pole.setAttribute('aria-invalid', 'true');
    }
    function prepocitaj() {
      var text = String(pole.value).trim().replace(',', '.');
      var m = text === '' ? NaN : Math.round(Number(text));
      if (!isFinite(m) || m <= 0) { ukazHlasku('Zadajte plochu od 20 do 300' + NBSP + 'm².'); return; }
      posuvnik.value = String(Math.max(MIN, Math.min(MAX, m)));
      if (m < MIN) { ukazHlasku('Priestory pod 20' + NBSP + 'm² naceníme po konzultácii.'); return; }
      if (m > MAX) { ukazHlasku('Nad 300' + NBSP + 'm² naceníme po konzultácii.'); return; }
      studia.textContent = suma(m * 30);
      komplet.textContent = suma(m * 45);
      hlaska.hidden = true;
      hlaska.textContent = '';
      vysledok.hidden = false;
      pole.removeAttribute('aria-invalid');
    }
    pole.addEventListener('input', prepocitaj);
    pole.addEventListener('change', prepocitaj);
    posuvnik.addEventListener('input', function () {
      pole.value = String(Math.round(Number(posuvnik.value)));
      prepocitaj();
    });
    prepocitaj();
  })();

  // 3. Pôdorys pri projekte: tlačidlo ho ukáže aj na dotyku a klávesnici (a nakreslí ho ťahom).
  document.querySelectorAll('.prepinac').forEach(function (tlacidlo) {
    tlacidlo.addEventListener('click', function () {
      var zapnute = tlacidlo.getAttribute('aria-pressed') !== 'true';
      tlacidlo.setAttribute('aria-pressed', zapnute ? 'true' : 'false');
      var karta = tlacidlo.closest('.projekt');
      if (karta) karta.classList.toggle('ukaz-plan', zapnute);
    });
  });

  // 4. Čísla kót sa pri vstupe do obrazu raz pretočia o celé kolo (číslice dodá CSS, tu sa len pridá trieda).
  //    Pri obmedzenom pohybe sa nič nedeje, čísla ostanú, ako sú.
  (function () {
    if (!pohyb || !maIO) return;
    var ciele = document.querySelectorAll('.otoc');
    if (!ciele.length) return;
    var pozorovatel = new IntersectionObserver(function (zaznamy) {
      zaznamy.forEach(function (z) {
        if (z.isIntersecting) {
          z.target.classList.add('otocene');
          pozorovatel.unobserve(z.target);
        }
      });
    }, { threshold: 0.6, rootMargin: '0px 0px -6% 0px' });
    ciele.forEach(function (el) { pozorovatel.observe(el); });
  })();

  // 5. Olovnica nad ı sa zakýve sama v CSS pri načítaní (meno je v prvej obrazovke pri každej šírke okna).

  // Odložená fotka: skutočný zdroj je v data-src a data-srcset, kým sa k nej človek nepriblíži.
  //    Bez skriptu ju nahradí kópia v noscript.
  function nacitaj(img) {
    var src = img.getAttribute('data-src');
    if (!src) return;
    var srcset = img.getAttribute('data-srcset');
    if (pohyb) {
      img.classList.add('nacitava');
      var hotovo = function () { img.classList.remove('nacitava'); };
      img.addEventListener('load', hotovo, { once: true });
      img.addEventListener('error', hotovo, { once: true });
    }
    if (srcset) img.setAttribute('srcset', srcset);
    img.setAttribute('src', src);
    img.removeAttribute('data-srcset');
    img.removeAttribute('data-src');
  }

  // 6. Fotky v Postupe a Ateliéri: až keď sú do štvrtiny výšky okna pod obrazom.
  (function () {
    var fotky = [].slice.call(document.querySelectorAll('img[data-src]')).filter(function (img) { return !img.closest('.prace'); });
    if (!fotky.length) return;
    if (!maIO) { fotky.forEach(nacitaj); return; }
    var io = new IntersectionObserver(function (zaznamy) {
      zaznamy.forEach(function (z) {
        if (z.isIntersecting) { nacitaj(z.target); io.unobserve(z.target); }
      });
    }, { rootMargin: '0px 0px 25% 0px' });
    fotky.forEach(function (img) { io.observe(img); });
  })();

  // 7. Pás prác. Fotky sa načítajú až pri priblížení: najprv keď je sekcia do štvrtiny výšky okna pod obrazom,
  //    na mobile potom len karty pri viditeľnej časti pásu. Na počítači sa pás pripne a zvislý posun ho
  //    posúva do strany cez animation-timeline v CSS; kde ho prehliadač nepozná, ostáva obyčajný posuvník.
  (function () {
    var sekcia = document.querySelector('.prace');
    var lepidlo = sekcia && sekcia.querySelector('.prace-lepidlo');
    var obal = sekcia && sekcia.querySelector('.prace-posuvne');
    var pas = sekcia && sekcia.querySelector('.pas');
    if (!sekcia || !lepidlo || !obal || !pas) return;

    var odlozene = [].slice.call(sekcia.querySelectorAll('img[data-src]'));
    function nacitajVsetky() { odlozene.forEach(nacitaj); }

    // Šírka fotiek pre výber zo srcset: v HTML je šírka voľného pásu (bez skriptu aj bez časovej osi),
    // pripnutý pás má karty široké min(56vh, 600px) * 0,8, takže sizes sa prepne spolu s triedou.
    var fotkyKariet = [].slice.call(sekcia.querySelectorAll('.projekt-foto img'));
    fotkyKariet.forEach(function (img) { img.setAttribute('data-sizes-volne', img.getAttribute('sizes') || ''); });
    function nastavSizes(pripnute) {
      fotkyKariet.forEach(function (img) {
        var s = pripnute ? 'min(45vh, 480px)' : img.getAttribute('data-sizes-volne');
        if (s && img.getAttribute('sizes') !== s) img.setAttribute('sizes', s);
      });
    }

    var podporaCasovejOsi = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: view()') &&
      CSS.supports('animation-range: contain 0% contain 100%'));
    var podmienka = window.matchMedia ? window.matchMedia('(min-width: 1024px) and (min-height: 560px) and (prefers-reduced-motion: no-preference)') : null;
    var posun = 0;
    var blizko = false;
    var ioPas = null;

    function jePripnute() { return sekcia.classList.contains('pripnute'); }
    function prepocitaj() {
      var zapnut = podporaCasovejOsi && podmienka && podmienka.matches;
      if (!zapnut) {
        if (jePripnute()) {
          sekcia.classList.remove('pripnute');
          sekcia.style.height = '';
          sekcia.style.removeProperty('--posun');
          pas.setAttribute('tabindex', '0');
          nastavSizes(false);
        }
        stavSipok();
        return;
      }
      sekcia.classList.add('pripnute');
      nastavSizes(true);
      pas.removeAttribute('tabindex');
      posun = Math.max(0, Math.round(obal.scrollWidth - lepidlo.clientWidth));
      sekcia.style.setProperty('--posun', posun + 'px');
      sekcia.style.height = (window.innerHeight + posun) + 'px';
      if (blizko) nacitajPoPosune();
    }
    // Pripnutý pás (počítač) začína hneď pod úvodom, teda pri okraji prvej obrazovky. Jeho päť fotiek sa preto
    // nesťahuje pri prvom načítaní, ale až pri prvom posune stránky, pri fokuse v páse alebo keď sekcia naozaj
    // vojde do obrazu (napríklad po skoku na #prace).
    var cakaNaPosun = false;
    function nacitajPoPosune() {
      if (cakaNaPosun) return;
      cakaNaPosun = true;
      var hotovo = false;
      var ioTu = null;
      function teraz() {
        if (hotovo) return;
        hotovo = true;
        window.removeEventListener('scroll', teraz);
        sekcia.removeEventListener('focusin', teraz);
        if (ioTu) ioTu.disconnect();
        nacitajVsetky();
      }
      window.addEventListener('scroll', teraz, { passive: true });
      sekcia.addEventListener('focusin', teraz);
      if (maIO) {
        ioTu = new IntersectionObserver(function (z) { if (z[0] && z[0].isIntersecting) teraz(); }, { rootMargin: '0px 0px -12% 0px' });
        ioTu.observe(sekcia);
      }
    }
    function priblizenie() {
      blizko = true;
      if (jePripnute()) { nacitajPoPosune(); return; }
      if (!maIO) { nacitajVsetky(); return; }
      ioPas = new IntersectionObserver(function (zaznamy) {
        zaznamy.forEach(function (z) {
          if (z.isIntersecting) { nacitaj(z.target); ioPas.unobserve(z.target); }
        });
      }, { root: pas, rootMargin: '0px 60% 0px 60%' });
      odlozene.forEach(function (img) { if (img.hasAttribute('data-src')) ioPas.observe(img); });
    }

    // Voľný pás (mobil, tablet, Firefox bez časovej osi, obmedzený pohyb): tlačidlá Predošlá a Ďalšia pre myš
    // posunú pás o šírku karty; na začiatku a na konci sú vypnuté (aria-disabled, fokus na nich ostane).
    var sipky = sekcia.querySelector('.sipky');
    var tlacidla = sipky ? [].slice.call(sipky.querySelectorAll('.sipka')) : [];
    function krok() {
      var karta = pas.querySelector('li');
      var medzera = parseFloat(window.getComputedStyle(pas).columnGap) || 0;
      return karta ? karta.getBoundingClientRect().width + medzera : pas.clientWidth * 0.8;
    }
    function stavSipok() {
      if (!tlacidla.length) return;
      var koniec = pas.scrollWidth - pas.clientWidth - 2;
      tlacidla.forEach(function (b) {
        var vypnute = Number(b.getAttribute('data-smer')) < 0 ? pas.scrollLeft <= 2 : pas.scrollLeft >= koniec;
        b.setAttribute('aria-disabled', vypnute ? 'true' : 'false');
      });
    }
    if (sipky) {
      sipky.hidden = false;
      tlacidla.forEach(function (b) {
        b.addEventListener('click', function () {
          if (b.getAttribute('aria-disabled') === 'true' || jePripnute()) return;
          nacitajVsetky();
          pas.scrollBy({ left: Number(b.getAttribute('data-smer')) * krok(), behavior: pohyb ? 'smooth' : 'auto' });
        });
      });
    }
    // Pri prvom posune pásu sa načítajú všetky zvyšné karty (je ich päť), aby rýchly šuch neukázal prázdne karty.
    var cakaSnimka = false;
    pas.addEventListener('scroll', function () {
      if (odlozene.some(function (img) { return img.hasAttribute('data-src'); })) nacitajVsetky();
      if (cakaSnimka) return;
      cakaSnimka = true;
      window.requestAnimationFrame(function () { cakaSnimka = false; stavSipok(); });
    }, { passive: true });

    // Fokus klávesnicou v pripnutom páse: posunie stránku tak, aby bola karta celá v obraze.
    pas.addEventListener('focusin', function (e) {
      if (!jePripnute() || posun <= 0) return;
      var karta = e.target.closest('li');
      if (!karta) return;
      var okraj = parseFloat(window.getComputedStyle(obal).paddingLeft) || 0;
      var ciel = Math.min(posun, Math.max(0, karta.offsetLeft - okraj));
      var dlzka = sekcia.offsetHeight - window.innerHeight;
      var hore = sekcia.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo(0, Math.round(hore + (ciel / posun) * dlzka));
    });

    window.addEventListener('resize', prepocitaj);
    if (podmienka) {
      if (podmienka.addEventListener) podmienka.addEventListener('change', prepocitaj);
      else if (podmienka.addListener) podmienka.addListener(prepocitaj);
    }
    prepocitaj();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(prepocitaj);
    window.addEventListener('load', prepocitaj);

    if (maIO) {
      var ioSekcia = new IntersectionObserver(function (zaznamy) {
        if (zaznamy[0] && zaznamy[0].isIntersecting) { ioSekcia.disconnect(); priblizenie(); }
      }, { rootMargin: '0px 0px 25% 0px' });
      ioSekcia.observe(sekcia);
    } else {
      nacitajVsetky();
    }
  })();

  // 8. Dialógy: otvárajú sa cez commandfor a command (bez skriptu v nových prehliadačoch), tu je záloha
  //    pre staršie prehliadače a zatvorenie klikom mimo okna. Esc zatvorí modálne okno sám prehliadač.
  (function () {
    var okna = document.querySelectorAll('dialog.okno');
    okna.forEach(function (d) {
      d.addEventListener('click', function (e) {
        if (e.target !== d) return;
        var r = d.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
      });
    });
    if ('commandForElement' in HTMLButtonElement.prototype) return;
    document.querySelectorAll('button[commandfor]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = document.getElementById(b.getAttribute('commandfor'));
        if (!d || typeof d.showModal !== 'function') return;
        var prikaz = b.getAttribute('command');
        if (prikaz === 'show-modal' && !d.open) d.showModal();
        else if (prikaz === 'close' && d.open) d.close();
      });
    });
  })();

  // 9. Formulár v dialógu je len ukážka: nič neodošle, len povie, čo by sa stalo na skutočnom webe.
  (function () {
    var formular = document.getElementById('formular');
    var stav = document.getElementById('formular-stav');
    if (!formular || !stav) return;
    formular.addEventListener('submit', function (e) {
      e.preventDefault();
      stav.textContent = 'Ďakujeme. Toto je ukážka, nič sa neodoslalo. Na vašom webe by dopyt prišiel ateliéru e-mailom a' + NBSP + 'vy by ste dostali potvrdenie.';
    });
  })();

  // 10. Zameriavač nad pôdorysom v úvode (len myš, od 768 px, kde pôdorys nie je otočený): vlasový kríž ako v CAD,
  //     miestnosť pod kurzorom a súradnice v mm od ľavého horného rohu bytu. Pri posune stránky sa nič nespúšťa.
  (function () {
    var ramec = document.querySelector('.uvod-plan .plan-ramec');
    var zam = ramec && ramec.querySelector('.zameriavac');
    if (!ramec || !zam || !window.matchMedia) return;
    var mys = window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)');
    var izbaEl = zam.querySelector('.zam-izba');
    var xyEl = zam.querySelector('.zam-xy');
    // Miestnosti v jednotkách výkresu (1 = 10 mm): [meno, x1, y1, x2, y2]; menšie skôr než tie, v ktorých ležia.
    var izby = [
      ['Komora, 2,3' + NBSP + 'm²', 292.5, 0, 427.5, 267.5],
      ['Obývačka s' + NBSP + 'kuchyňou, 22,4' + NBSP + 'm²', 0, 0, 427.5, 720],
      ['Kúpeľňa, 5,0' + NBSP + 'm²', 652.5, 0, 907.5, 267.5],
      ['Predsieň, 11,2' + NBSP + 'm²', 427.5, 0, 907.5, 407.5],
      ['Spálňa, 9,5' + NBSP + 'm²', 907.5, 0, 1200, 407.5],
      ['Detská, 9,7' + NBSP + 'm²', 427.5, 407.5, 787.5, 720],
      ['Pracovňa, 10,8' + NBSP + 'm²', 787.5, 407.5, 1200, 720]
    ];
    function mm(n) { var s = String(n); return s.length > 3 ? s.slice(0, -3) + NBSP + s.slice(-3) : s; }
    var posledny = null;
    var bezi = false;
    function vykresli() {
      bezi = false;
      if (!posledny) return;
      var r = ramec.getBoundingClientRect();
      var px = posledny.x - r.left;
      var py = posledny.y - r.top;
      var u = px / r.width * 1480 - 150;
      var v = py / r.height * 910 - 30;
      if (u < 0 || u > 1200 || v < 0 || v > 720) { ramec.classList.remove('mieri'); return; }
      var meno = '';
      for (var i = 0; i < izby.length; i++) {
        var z = izby[i];
        if (u >= z[1] && u <= z[3] && v >= z[2] && v <= z[4]) { meno = z[0]; break; }
      }
      if (izbaEl.textContent !== meno) izbaEl.textContent = meno;
      xyEl.textContent = 'x ' + mm(Math.round(u / 5) * 50) + ' · y ' + mm(Math.round(v / 5) * 50) + NBSP + 'mm';
      zam.style.setProperty('--zx', Math.round(px) + 'px');
      zam.style.setProperty('--zy', Math.round(py) + 'px');
      zam.style.setProperty('--sx', px > r.width * 0.62 ? 'calc(-100% - 14px)' : '14px');
      zam.style.setProperty('--sy', py > r.height * 0.72 ? 'calc(-100% - 14px)' : '14px');
      ramec.classList.add('mieri');
    }
    ramec.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || !mys.matches) return;
      posledny = { x: e.clientX, y: e.clientY };
      if (!bezi) { bezi = true; window.requestAnimationFrame(vykresli); }
    });
    ramec.addEventListener('pointerleave', function () { posledny = null; ramec.classList.remove('mieri'); });
  })();

  // 11. Výkres v úvode sa kreslí, keď ho človek vidí. Na počítači je v prvej obrazovke a kreslí sa hneď (čisté CSS).
  //     Na mobile a tablete je pod fotkou: ak je pri načítaní z väčšej časti mimo obrazu, jeho pohyb sa vráti
  //     na začiatok a podrží (trieda caka), kým výkres nepríde do obrazu. Bez skriptu sa kreslí hneď.
  (function () {
    if (!pohyb || !maIO) return;
    var plan = document.querySelector('.uvod-plan');
    if (!plan || plan.getBoundingClientRect().top < window.innerHeight * 0.72) return;
    plan.classList.add('caka');
    if (plan.getAnimations) {
      plan.getAnimations({ subtree: true }).forEach(function (a) { try { a.currentTime = 0; } catch (e) { /* nič */ } });
    }
    var io = new IntersectionObserver(function (zaznamy) {
      var z = zaznamy[zaznamy.length - 1];
      if (z && z.isIntersecting) { plan.classList.remove('caka'); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe(plan);
  })();

  // 12. Spodná lišta na mobile: skrytá, kým je v obraze tlačidlo v úvode (dve rovnaké tlačidlá naraz nie),
  //     potom sa vysunie. Bez pozorovateľa je viditeľná stále.
  (function () {
    var lista = document.querySelector('.lista');
    if (!lista) return;
    var akcie = document.querySelector('.uvod-akcie');
    if (!akcie || !maIO) { lista.classList.add('vidno'); return; }
    var io = new IntersectionObserver(function (zaznamy) {
      var z = zaznamy[zaznamy.length - 1];
      if (z) lista.classList.toggle('vidno', !z.isIntersecting);
    });
    io.observe(akcie);
  })();

  // 13. Značka A v pôdoryse a „pohľad A“ v popise vedú na fotku pohľadu A. Keď je fotka celá v obraze
  //     (počítač, dvojstrana), stránka sa neposúva, fotka sa len na chvíľu orámuje dubom; inak sa k nej posunie
  //     (pri obmedzenom pohybe bez plynulého posunu) a orámuje sa tiež.
  (function () {
    var pohlad = document.getElementById('pohlad-a');
    var ramecFotky = pohlad && pohlad.querySelector('.pohlad-ramec');
    if (!pohlad || !ramecFotky) return;
    var casovac = 0;
    function zvyrazni() {
      pohlad.classList.remove('zvyraznene');
      void pohlad.offsetWidth;
      pohlad.classList.add('zvyraznene');
      window.clearTimeout(casovac);
      casovac = window.setTimeout(function () { pohlad.classList.remove('zvyraznene'); }, 1600);
    }
    document.querySelectorAll('a[href="#pohlad-a"]').forEach(function (odkaz) {
      odkaz.addEventListener('click', function (e) {
        e.preventDefault();
        var r = ramecFotky.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight) {
          pohlad.scrollIntoView({ behavior: pohyb ? 'smooth' : 'auto', block: 'center' });
        }
        zvyrazni();
      });
    });
  })();
})();
