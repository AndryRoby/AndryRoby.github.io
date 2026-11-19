/* Dotazník k webu (ARLing, 18. 11. 2026, v2). Zloží odpovede do textu e-mailu a otvorí ho cez mailto.
   Nič neukladá, nič neposiela na server, nepoužíva cookies ani úložisko prehliadača.
   Meranie (Umami, ak sa načíta): len číslo časti, do ktorej človek prvý raz niečo zadal, a klik na odoslanie.
   Obsah polí sa nikdy nemeria ani neposiela. Bez JS funguje odkaz na prázdny e-mail s predmetom. */
(function () {
  'use strict';

  var ADRESA = 'andrej@arling.sk';
  /* Dlhší odkaz mailto niektoré poštové programy na počítači orežú (asi 2 000 znakov); v mobile to nehrozí. */
  var LIMIT = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 8000 : 1900;
  var NL = '\r\n';
  /* Predvyplnenie z /web/ a z ukážok len zo zoznamu povolených hodnôt; iná hodnota sa ignoruje a nikdy sa nevkladá do stránky. */
  var STYLY = { odvazne: 'styl-odvazne', elegantne: 'styl-elegantne', hrave: 'styl-hrave', pokojne: 'styl-pokojne' };
  var UKAZKY = {
    barbershop: 'Holičstvo Krátko (barbershop)', salon: 'Salón Šípka (nechty a kozmetika)', bistro: 'Bistro Perón',
    architekti: 'Ateliér Olovnica', trener: 'Švih (osobný tréner)', praziaren: 'Pražiareň Kolotoč (e-shop)',
    fyzioterapia: 'Fyzioterapia Os', fotografka: 'Clona (fotografka)',
    startup: 'Rozsvit (softvér na plánovanie smien)', reality: 'Reality Hradba', vinarstvo: 'Vinárstvo Svorník (e-shop)',
    penzion: 'Penzión Inovať', autoservis: 'Autoservis Ojnica', stolarstvo: 'Stolárstvo Rybina', kaviaren: 'Kaviareň Okenica'
  };

  var form = document.getElementById('dotaznik');
  var otvorit = document.getElementById('otvorit');
  var kopirovat = document.getElementById('kopirovat');
  var stav = document.getElementById('stav');
  var nahlad = document.getElementById('nahlad');
  var nahladText = document.getElementById('nahlad-text');
  if (!form || !otvorit) return;

  function cisty(t) { return (t || '').replace(/\s+/g, ' ').trim(); }

  /* Text nadpisu časti bez čísla a bez drobného popisu (small); slová v <span class="nw"> sa počítajú. */
  function priamyText(el) {
    var t = '';
    el.childNodes.forEach(function (n) {
      if (n.nodeType === 3) t += n.textContent;
      else if (n.nodeType === 1 && n.classList && n.classList.contains('nw')) t += n.textContent;
    });
    return cisty(t);
  }

  function nazovSekcie(el) {
    var hlava = el.querySelector('legend') || el.querySelector('summary');
    if (!hlava) return '';
    var cislo = hlava.querySelector('span');
    var nazov = hlava.querySelector('.nazov');
    return (cislo ? cisty(cislo.textContent) + '. ' : '') + priamyText(nazov || hlava);
  }

  function odpovedPola(pole) {
    var radia = pole.querySelectorAll('input[type=radio]');
    if (radia.length) {
      var nadpis = pole.querySelector('.skupina-nadpis');
      var vybrane = pole.querySelector('input[type=radio]:checked');
      return { otazka: cisty(nadpis ? nadpis.textContent : radia[0].name), odpoved: vybrane ? vybrane.value : '' };
    }
    var vstup = pole.querySelector('input, textarea');
    if (!vstup) return null;
    var label = pole.querySelector('label[for="' + vstup.id + '"]');
    return { otazka: cisty(label ? label.textContent : vstup.name), odpoved: (vstup.value || '').trim() };
  }

  function zlozText() {
    var riadky = ['Dotazník k webu', ''];
    var prazdne = 0;
    form.querySelectorAll('fieldset, details').forEach(function (sekcia) {
      var polozky = [];
      var nieco = false;
      sekcia.querySelectorAll('.pole').forEach(function (pole) {
        var o = odpovedPola(pole);
        if (!o) return;
        if (o.odpoved) { nieco = true; polozky.push(o); } else if (sekcia.tagName !== 'DETAILS') { prazdne++; }
      });
      if (!nieco) return; /* nevyplnené časti vynechať, aby bol e-mail krátky */
      riadky.push(nazovSekcie(sekcia));
      polozky.forEach(function (o) {
        var odp = o.odpoved.replace(/\r?\n/g, NL + '  ');
        riadky.push('- ' + o.otazka + ': ' + odp);
      });
      riadky.push('');
    });
    if (prazdne) riadky.push('Nevyplnených otázok: ' + prazdne + ' (doplníme spolu e-mailom).');
    riadky.push('Prílohy: logo, fotky a cenník priložte k tomuto e-mailu.');
    return riadky.join(NL);
  }

  function predmet() {
    var nazov = cisty((document.getElementById('nazov') || {}).value);
    return 'Dotazník k webu' + (nazov ? ': ' + nazov : '');
  }

  function mailto(predmetText, telo) {
    return 'mailto:' + ADRESA + '?subject=' + encodeURIComponent(predmetText) + '&body=' + encodeURIComponent(telo);
  }

  function skopiruj(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return zalozneKopirovanie(); });
    }
    return Promise.resolve(zalozneKopirovanie());
  }

  function zalozneKopirovanie() {
    try {
      nahladText.focus();
      nahladText.select();
      return document.execCommand('copy');
    } catch (e) { return false; }
  }

  function ukazNahlad(text) {
    nahladText.value = text;
    nahlad.hidden = false;
    kopirovat.hidden = false;
  }

  function zmeraj(udalost, data) {
    try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(udalost, data); } catch (e) { /* meranie nesmie zastaviť dotazník */ }
  }

  /* Enter v poli nesmie odoslať formulár (odpovede by sa ocitli v adrese stránky); odosiela sa len tlačidlom. */
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  otvorit.addEventListener('click', function (e) {
    e.preventDefault();
    var text = zlozText();
    var p = predmet();
    ukazNahlad(text);
    var plny = mailto(p, text);
    zmeraj('web_dotaznik_odoslat', { sposob: plny.length <= LIMIT ? 'mailto' : 'kopia' });
    if (plny.length <= LIMIT) {
      stav.textContent = 'Otvára sa e-mail s odpoveďami. Priložte logo a fotky a odošlite ho.';
      window.location.href = plny;
      return;
    }
    skopiruj(text).then(function (ok) {
      var kratke = ok
        ? 'Odpovede z dotazníka sú v schránke. Vložte ich sem (Ctrl+V, v mobile podržte prst a zvoľte Vložiť).'
        : 'Odpovede z dotazníka vložím sem.';
      stav.textContent = ok
        ? 'Odpovede sú dlhé, preto sme ich skopírovali. V otvorenom e-maile ich vložte (Ctrl+V alebo podržať a Vložiť).'
        : 'Odpovede sú dlhé. Skopírujte text z poľa nižšie a vložte ho do otvoreného e-mailu.';
      window.location.href = mailto(p, kratke + NL + NL);
    });
  });

  kopirovat.addEventListener('click', function () {
    var text = nahladText.value || zlozText();
    ukazNahlad(text);
    skopiruj(text).then(function (ok) {
      stav.textContent = ok ? 'Skopírované. Vložte text do e-mailu na ' + ADRESA + '.' : 'Kopírovanie nefungovalo, označte text v poli nižšie a skopírujte ho.';
    });
  });

  /* Predvyplnenie štýlu (?styl=) a ukážky (?ukazka=) */
  try {
    var q = new URLSearchParams(window.location.search);
    var styl = q.get('styl');
    if (styl && Object.prototype.hasOwnProperty.call(STYLY, styl)) {
      var radio = document.getElementById(STYLY[styl]);
      if (radio && !form.querySelector('input[name="' + radio.name + '"]:checked')) radio.checked = true;
    }
    var ukazka = q.get('ukazka');
    if (ukazka && Object.prototype.hasOwnProperty.call(UKAZKY, ukazka)) {
      var pole = document.getElementById('ukazka-oblubena');
      if (pole && !pole.value) pole.value = UKAZKY[ukazka];
    }
  } catch (e) { /* bez URLSearchParams sa nepredvypĺňa nič */ }

  /* Priebeh: ktoré časti už majú odpoveď, aktívna časť v obsahu a počet v hlavičke (na mobile a tablete s tlačidlom Obsah) */
  var sekcie = [].slice.call(form.querySelectorAll('fieldset, details'));
  var odkazy = {};
  document.querySelectorAll('.casti a[href^="#"]').forEach(function (a) { odkazy[a.getAttribute('href').slice(1)] = a; });
  var pocet = document.getElementById('pocet-vyplnenych');
  var hlava = document.querySelector('.hlava');
  var priebeh = document.querySelector('.priebeh');
  var priebehPocet = document.querySelector('.priebeh-pocet');
  var priebehSpolu = document.querySelector('.priebeh-spolu');
  var obsahTlac = document.querySelector('.priebeh-obsah');
  var casti = document.getElementById('casti');
  var spolu = sekcie.filter(function (s) { return s.tagName !== 'DETAILS'; }).length;
  if (priebehSpolu) priebehSpolu.textContent = String(spolu);
  var zmerane = {};

  function maOdpoved(sekcia) {
    return [].some.call(sekcia.querySelectorAll('input, textarea'), function (v) {
      return (v.type === 'radio' || v.type === 'checkbox') ? v.checked : (v.value || '').trim() !== '';
    });
  }

  function obnovPriebeh() {
    var n = 0;
    sekcie.forEach(function (s) {
      var ok = maOdpoved(s);
      if (ok && s.tagName !== 'DETAILS') n++;
      var a = odkazy[s.id];
      if (a && a.parentNode) a.parentNode.classList.toggle('vyplnena', ok);
    });
    if (pocet) pocet.textContent = String(n);
    if (priebehPocet && priebehPocet.textContent !== String(n)) priebehPocet.textContent = String(n);
    if (hlava) hlava.style.setProperty('--priebeh', spolu ? (n / spolu).toFixed(3) : '0');
  }

  form.addEventListener('input', function (e) {
    obnovPriebeh();
    var s = e.target.closest ? e.target.closest('fieldset, details') : null;
    if (s && s.id && !zmerane[s.id]) {
      zmerane[s.id] = true;
      zmeraj('web_dotaznik_krok', { krok: s.id.replace('cast-', '') });
    }
  });
  form.addEventListener('change', obnovPriebeh);
  window.addEventListener('pageshow', obnovPriebeh);
  obnovPriebeh();

  /* Lepiaci obsah na počítači sa posúva sám v sebe (CSS max-height). Aktívnu časť doňho posunieme, aby bola vždy vidno,
     a okraj, za ktorým je ďalší obsah, jemne vyblednime. Posúva sa len obsah, nikdy stránka. */
  var malyPohyb = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function obsahSaPosuva() { return casti && !casti.classList.contains('otvorene') && casti.scrollHeight > casti.clientHeight + 2; }
  function obnovOkraje() {
    if (!casti) return;
    var posuva = obsahSaPosuva();
    casti.classList.toggle('viac-hore', posuva && casti.scrollTop > 4);
    casti.classList.toggle('viac-dole', posuva && casti.scrollTop + casti.clientHeight < casti.scrollHeight - 4);
  }
  function ukazVObsahu(a) {
    if (!obsahSaPosuva()) return;
    var rn = casti.getBoundingClientRect(), ra = a.getBoundingClientRect();
    var okraj = 56;
    var ciel = null;
    if (ra.top < rn.top + okraj) ciel = casti.scrollTop + (ra.top - rn.top) - okraj;
    else if (ra.bottom > rn.bottom - okraj) ciel = casti.scrollTop + (ra.bottom - rn.bottom) + okraj;
    if (ciel === null) return;
    ciel = Math.max(0, Math.min(ciel, casti.scrollHeight - casti.clientHeight));
    try { casti.scrollTo({ top: ciel, behavior: malyPohyb ? 'auto' : 'smooth' }); } catch (e) { casti.scrollTop = ciel; }
  }
  if (casti) {
    casti.addEventListener('scroll', obnovOkraje, { passive: true });
    window.addEventListener('resize', obnovOkraje);
    obnovOkraje();
  }

  if ('IntersectionObserver' in window && Object.keys(odkazy).length) {
    var aktivny = null;
    var sledovac = new IntersectionObserver(function (zaznamy) {
      zaznamy.forEach(function (z) {
        if (!z.isIntersecting) return;
        var a = odkazy[z.target.id];
        if (!a || a === aktivny) return;
        if (aktivny) aktivny.removeAttribute('aria-current');
        a.setAttribute('aria-current', 'location');
        aktivny = a;
        ukazVObsahu(a);
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    sekcie.forEach(function (s) { sledovac.observe(s); });
    var odoslat = document.getElementById('odoslat');
    if (odoslat) sledovac.observe(odoslat);
  }

  /* Keď je formulár na obrazovke, hlavička ukáže priebeh (na mobile a tablete namiesto odkazu späť) */
  if (priebeh && 'IntersectionObserver' in window) {
    priebeh.hidden = false;
    new IntersectionObserver(function (zaznamy) {
      zaznamy.forEach(function (z) { document.body.classList.toggle('v-dotazniku', z.isIntersecting); });
    }, { rootMargin: '-80px 0px 0px 0px' }).observe(form);
  }

  /* Obsah častí na mobile a tablete: panel pod hlavičkou, zatvorí ho Esc, druhé ťuknutie alebo výber časti */
  /* Kým je panel otvorený, obsah pod ním je inert (čítačka ani Tab sa doň nedostanú) a Tab krúži medzi tlačidlom Obsah
     a položkami panela. */
  var zaPanelom = [].slice.call(document.querySelectorAll('.preskoc, .hlava .znak, .hlava-odkaz, .hrdina, #dotaznik, .pata'));
  function nastavInert(zapnut) {
    zaPanelom.forEach(function (el) { if (zapnut) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
  }
  function zavriObsah(vratFokus) {
    if (!casti || !casti.classList.contains('otvorene')) return;
    casti.classList.remove('otvorene');
    document.documentElement.classList.remove('obsah-otvoreny');
    obsahTlac.setAttribute('aria-expanded', 'false');
    nastavInert(false);
    if (vratFokus) obsahTlac.focus();
    obnovOkraje();
  }
  function otvorObsah() {
    casti.classList.add('otvorene');
    document.documentElement.classList.add('obsah-otvoreny');
    obsahTlac.setAttribute('aria-expanded', 'true');
    nastavInert(true);
    obnovOkraje();
    var prvy = casti.querySelector('a[aria-current]') || casti.querySelector('a');
    if (prvy) prvy.focus({ preventScroll: true });
  }
  function drzFokus(e) {
    if (e.key !== 'Tab' || !casti || !casti.classList.contains('otvorene')) return;
    var ciele = [obsahTlac].concat([].slice.call(casti.querySelectorAll('a[href]')));
    var i = ciele.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); ciele[ciele.length - 1].focus(); }
    else if (!e.shiftKey && (i === -1 || i === ciele.length - 1)) { e.preventDefault(); ciele[0].focus(); }
  }
  if (obsahTlac && casti) {
    obsahTlac.addEventListener('click', function () {
      if (casti.classList.contains('otvorene')) zavriObsah(false); else otvorObsah();
    });
    casti.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) zavriObsah(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') zavriObsah(true); else drzFokus(e); });
    var pocitac = window.matchMedia ? window.matchMedia('(min-width: 901px)') : null;
    var priZmene = function () { if (pocitac && pocitac.matches) zavriObsah(false); };
    if (pocitac && pocitac.addEventListener) pocitac.addEventListener('change', priZmene);
    else if (pocitac && pocitac.addListener) pocitac.addListener(priZmene);
  }

  /* Hlavička po posune stmavne */
  if (hlava) {
    var caka = false;
    var obnovHlavu = function () { caka = false; hlava.classList.toggle('posunute', window.scrollY > 8); };
    window.addEventListener('scroll', function () {
      if (!caka) { caka = true; window.requestAnimationFrame(obnovHlavu); }
    }, { passive: true });
    window.requestAnimationFrame(obnovHlavu);
  }

  /* Signál krokmi postupu prebehne raz (pri obmedzenom pohybe ho CSS vypne) */
  var kroky = document.querySelector('.kroky');
  window.requestAnimationFrame(function () {
    document.documentElement.classList.add('js');
    if (kroky) kroky.classList.add('hra');
  });
})();
