/* Dotazník k webu (ARLing, 18. 11. 2026, v2; odoslanie cez server 20. 11. 2026). Zloží odpovede do textu a odošle ich.
   Odošle odpovede cez api.arling.workers.dev na server (KONTRAKT.md), ten ich len prepošle e-mailom; záloha mailto a kopírovanie. Nič neukladá v prehliadači, nepoužíva cookies.
   Meranie (Umami, ak sa načíta): len číslo časti, do ktorej človek prvý raz niečo zadal, klik na odoslanie a výsledok odoslania.
   Obsah polí, e-mail ani číslo dotazníka sa nikdy nemerajú. Bez JS funguje odkaz na prázdny e-mail s predmetom.
   Od 23. 11. 2026 (linka web-cennik, cenník 4.1): výber z kalkulačky na /web/ len z adresy cez ArlingCennik.zAdresy
   z ../cennik.js; hore Váš výber a v texte odpovedí blok Výber z kalkulačky. Povinný je len e-mail na odpoveď. */
(function () {
  'use strict';

  var ADRESA = 'andrej@arling.sk';
  /* Dlhší odkaz mailto niektoré poštové programy na počítači orežú (asi 2 000 znakov); v mobile to nehrozí. */
  var LIMIT = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 8000 : 1900;
  var NL = '\r\n';
  /* Predvyplnenie z /web/ a z ukážok len zo zoznamu povolených hodnôt; iná hodnota sa ignoruje a nikdy sa nevkladá do stránky.
     Kolotoč a Svorník bez „(e-shop)“: ukážka má vlastný dizajn, e-shop na Shoptete má vzhľad šablóny (podmienky 7c, pred-fb nález 1). */
  var STYLY = { odvazne: 'styl-odvazne', elegantne: 'styl-elegantne', hrave: 'styl-hrave', pokojne: 'styl-pokojne' };
  var UKAZKY = {
    barbershop: 'Holičstvo Krátko (barbershop)', salon: 'Salón Šípka (nechty a kozmetika)', bistro: 'Bistro Perón',
    architekti: 'Ateliér Olovnica', trener: 'Švih (osobný tréner)', praziaren: 'Pražiareň Kolotoč',
    fyzioterapia: 'Fyzioterapia Os', fotografka: 'Clona (fotografka)',
    startup: 'Rozsvit (softvér na plánovanie smien)', reality: 'Reality Hradba', vinarstvo: 'Vinárstvo Svorník',
    penzion: 'Penzión Inovať', autoservis: 'Autoservis Ojnica', stolarstvo: 'Stolárstvo Rybina', kaviaren: 'Kaviareň Okenica'
  };

  /* Odoslanie cez server (KONTRAKT.md časti 2 až 5). Adresa homelabu sa tu nikdy nepíše, len proxy. */
  var SERVER = 'https://api.arling.workers.dev/subscribe/api/dotaznik-web';
  var CAS_LIMIT_MS = 45000;
  var ZNOVA_PO_LIMITE_MS = 60000;
  var TEXT_MAX = 15000;
  var TELO_MAX = 65536;
  var EMAIL_MAX = 254;
  var RIADOK_MAX = { nazov: 120, meno: 120, telefon: 40 };
  var EMAIL_VZOR = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
  var CISLO_VZOR = /^D-\d{8}-[A-Z2-9]{4}$/;
  /* Zdroj len z týchto parametrov adresy, nikdy fbclid ani gclid (KONTRAKT.md 4.10). utm_content navyše oproti 4.10
     (pred-fb nález 47): /web/ ho prenáša do odkazov na dotazník a server kľúče nekontroluje, len znaky a 120 znakov
     (products/subscribe-service/dotaznik_web.py, _ZDROJ a ZDROJ_MAX). */
  var ZDROJ_KLUCE = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ukazka', 'styl'];
  var T = {
    odoslat: 'Odoslať dotazník',
    odosiela: 'Odosiela sa…',
    znova: 'Skúsiť znova',
    email: 'Skontrolujte e-mail. Má tvar meno@firma.sk, bez medzier a bez diakritiky.',
    text: 'Vyplňte aspoň jednu otázku. Kde odpoveď nemáte, pole nechajte prázdne a poradíme.',
    najviac120: 'Najviac 120 znakov.',
    najviac40: 'Najviac 40 znakov.',
    stylApp: 'Ukážky v rôznych štýloch sú na stránke ponuky arling.sk/web/.',
    zaloha: {
      limit: 'Práve prišlo priveľa dotazníkov naraz. O minútu ho skúste odoslať znova, alebo ho pošlite e-mailom: tlačidlo nižšie otvorí e-mail s vyplnenými odpoveďami, stačí ho odoslať. Ak sa e-mail neotvorí, stlačte Skopírovať odpovede a pošlite ich na andrej@arling.sk.',
      chyba: 'Dotazník sa cez stránku nepodarilo odoslať. Pošlite ho e-mailom: tlačidlo nižšie otvorí e-mail s vyplnenými odpoveďami, stačí ho odoslať. Ak sa e-mail neotvorí, stlačte Skopírovať odpovede a pošlite ich na andrej@arling.sk.',
      siet: 'Spojenie sa prerušilo a nevieme, či dotazník prišiel. Skúste ho odoslať znova. Ak by k nám prišiel dvakrát, nič sa nedeje. Ak to nepôjde, pošlite ho e-mailom tlačidlom nižšie, a ak sa e-mail neotvorí, stlačte Skopírovať odpovede a pošlite ich na andrej@arling.sk.',
      velkost: 'Odpovede sú dlhšie ako 15 000 znakov, preto ich pošlite e-mailom. Tlačidlo nižšie ich skopíruje a otvorí e-mail. Ak sa e-mail neotvorí, odpovede už máte skopírované, pošlite ich na andrej@arling.sk.'
    },
    /* V appke Facebooku a Instagramu je prvé a zvýraznené Skopírovať odpovede (usporiadajZalohu, zvyrazniZalohu), preto
       veta zálohy opisuje tlačidlá v tomto poradí ako verzia bez servera (pred-fb nález 39, brána p1 G1 odp. 3, G2 odp. 8).
       Mimo appky ostávajú texty kontraktu vyššie. V „15 000“ je nezlomiteľná medzera zapísaná únikovým kódom U+00A0. */
    zalohaApp: {
      limit: 'Práve prišlo priveľa dotazníkov naraz. O minútu ho skúste odoslať znova. Ak nechcete čakať, stlačte Skopírovať odpovede a vložte ich do e-mailu na andrej@arling.sk, alebo skúste Otvoriť e-mail s odpoveďami.',
      chyba: 'Dotazník sa cez stránku nepodarilo odoslať. Stlačte Skopírovať odpovede a vložte ich do e-mailu na andrej@arling.sk, alebo skúste Otvoriť e-mail s odpoveďami.',
      siet: 'Spojenie sa prerušilo a nevieme, či dotazník prišiel. Skúste ho odoslať znova. Ak by k nám prišiel dvakrát, nič sa nedeje. Ak to nepôjde, stlačte Skopírovať odpovede a vložte ich do e-mailu na andrej@arling.sk, alebo skúste Otvoriť e-mail s odpoveďami.',
      velkost: 'Odpovede sú dlhšie ako 15\u00a0000 znakov, preto ich pošlite e-mailom. Stlačte Skopírovať odpovede a vložte ich do e-mailu na andrej@arling.sk, alebo skúste Otvoriť e-mail s odpoveďami.'
    },
    /* Stav po ťuknutí na Otvoriť e-mail a Skopírovať: stránka nevie, či sa e-mail otvoril, preto to netvrdí
       (pred-fb nálezy 38 a 39, rovnaké znenie ako verzia bez servera). */
    poMailto: 'Ak sa otvoril e-mail s odpoveďami, priložte logo a fotky a odošlite ho. Ak sa neotvoril, stlačte Skopírovať odpovede a vložte ich do e-mailu na andrej@arling.sk.',
    dlheSkopirovane: 'Odpovede sú dlhé, preto sme ich skopírovali. Ak sa otvoril e-mail, vložte ich doň (Ctrl+V alebo podržať a Vložiť). Ak sa neotvoril, vložte ich do e-mailu na andrej@arling.sk.',
    dlheNeskopirovane: 'Odpovede sú dlhé. Skopírujte text z poľa nižšie a vložte ho do e-mailu na andrej@arling.sk.',
    skopirovane: 'Skopírované. Vložte text do e-mailu na andrej@arling.sk.',
    neskopirovane: 'Kopírovanie nefungovalo, označte text v poli nižšie a skopírujte ho.'
  };
  /* Jednopísmenové slová (a, i, o, u, s, z, v, k) nesmú ostať na konci riadka: medzera za nimi je nezlomiteľná (U+00A0).
     Dvakrát, lebo pri „a v“ by prvý prechod druhé slovo preskočil (bez lookbehind kvôli starému Safari). Text ostáva doslova;
     „e-mail“ nezlomí vlozVetu nižšie. */
  function pevneMedzery(s) {
    var vzor = /(^|\s)([aiouszvkAIOUSZVK]) /g;
    return s.replace(vzor, '$1$2\u00a0').replace(vzor, '$1$2\u00a0');
  }
  Object.keys(T.zaloha).forEach(function (k) { T.zaloha[k] = pevneMedzery(T.zaloha[k]); });
  T.email = pevneMedzery(T.email);
  T.text = pevneMedzery(T.text);
  T.stylApp = pevneMedzery(T.stylApp);
  Object.keys(T.zalohaApp).forEach(function (k) { T.zalohaApp[k] = pevneMedzery(T.zalohaApp[k]); });
  ['poMailto', 'dlheSkopirovane', 'dlheNeskopirovane', 'skopirovane', 'neskopirovane'].forEach(function (k) { T[k] = pevneMedzery(T[k]); });
  /* Čas t od otvorenia formulára (KONTRAKT.md 4.8); po chybe sa nenuluje. */
  function teraz() { return (window.performance && typeof window.performance.now === 'function') ? window.performance.now() : Date.now(); }
  var zaciatok = teraz();

  var form = document.getElementById('dotaznik');
  var otvorit = document.getElementById('otvorit');
  var kopirovat = document.getElementById('kopirovat');
  var stav = document.getElementById('stav');
  var nahlad = document.getElementById('nahlad');
  var nahladText = document.getElementById('nahlad-text');
  if (!form || !otvorit) return;

  function cisty(t) { return (t || '').replace(/\s+/g, ' ').trim(); }

  /* Výber z kalkulačky (SPEC linky web-cennik 2.4): kľúče b, s, p, j, m, ukazka v adrese prečíta len ArlingCennik.zAdresy
     a sumy vždy počíta cennik.js z cennik.json, adresa ich nenesie. Bez cennik.js, pri chybe alebo bez platného výberu
     ostáva VYBER null a stránka ukáže statické ceny (zlyhanie zatvára, AGENTS.md bod 12c). Nič sa neukladá v prehliadači. */
  var C = (window.ArlingCennik && typeof window.ArlingCennik.zAdresy === 'function') ? window.ArlingCennik : null;
  var VYBER = null;
  var VYBER_ROZPIS = '';
  try {
    if (C) VYBER = C.zAdresy(window.location.search);
    if (VYBER) VYBER_ROZPIS = C.rozpis(VYBER);
  } catch (e) { VYBER = null; VYBER_ROZPIS = ''; }
  if (typeof VYBER_ROZPIS !== 'string' || !VYBER_ROZPIS) { VYBER = null; VYBER_ROZPIS = ''; }

  /* Suma s nezlomiteľnými medzerami (tisíce aj pred €) a pevné medzery za jednopísmenovými slovami, len na zobrazenie;
     do textu odpovedí ide rozpis bez zmeny. */
  function eur(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €'; }
  function naZobrazenie(s) {
    return pevneMedzery(String(s || '').replace(/(\d) (?=\d{3}(?!\d))/g, '$1\u00a0').replace(/ €/g, '\u00a0€')
      .replace(/(\d) (?=[a-záäčďéíĺľňóôŕšťúýž])/g, '$1\u00a0'));
  }
  function priplatkov(n) { return n === 1 ? '1 príplatok' : (n >= 2 && n <= 4 ? n + ' príplatky' : n + ' príplatkov'); }
  function malym(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

  /* Krátke zhrnutie výberu: balík a počet príplatkov, suma, služba (z cennik.js, žiadna suma odinakiaľ). */
  function zhrnutieVyberu(v) {
    var s = C.spocitaj(v);
    var D = C.data;
    var B = D.baliky[s.balik];
    var S = D.mesacne[B.sluzba];
    var navyse = s.polozky.length - 1;
    var r = {
      s: s,
      ukazka: s.ukazka ? D.texty.podlaUkazky + ' ' + s.ukazka.meno : '',
      suma: eur(s.jednorazovo),
      co: B.nazov + (navyse > 0 ? ' a ' + priplatkov(navyse) : ''),
      sluzba: '',
      sluzbaKratko: '',
      vCene: B.vCene.slice()
    };
    var O = S.obdobia[s.volby.sluzba];
    if (s.balik === 'eshop') {
      r.sluzba = D.texty.zaloha + ': ' + eur(s.zaloha) + ', ' + malym(D.texty.zvysok) + ': ' + eur(s.zvysok) + (O.rozpis ? '. ' + O.rozpis : '');
    } else {
      r.sluzba = O.rozpis;
    }
    if (s.sluzba) r.sluzbaKratko = ', ' + malym(S.nazov) + ' ' + eur(s.sluzba.cena) + (s.sluzba.obdobie === 'rocne' ? ' ročne' : ' mesačne');
    else if (s.balik !== 'eshop') r.sluzbaKratko = ', bez starostlivosti';
    return r;
  }

  /* --- čisté funkcie pre server (bez DOM) --- */

  /* Dĺžka v znakoch Unicode ako na serveri (emoji má v JavaScripte dĺžku 2). */
  function dlzka(s) { return Array.from(s || '').length; }

  /* Neviditeľné formátovacie znaky a „=?“ v jednoriadkových poliach (KONTRAKT.md časť 2). \p{Cf} nie ako literál,
     starý prehliadač by na ňom zhodil celý skript. */
  var NEVIDITELNE = null;
  try { NEVIDITELNE = new RegExp('\\p{Cf}', 'gu'); } catch (e) { /* bez podpory sa neviditeľné znaky nevynechajú */ }
  function riadokPreServer(s) {
    if (NEVIDITELNE) s = s.replace(NEVIDITELNE, '');
    return s.split('=?').join('= ?');
  }

  /* Riadiace znaky, ktoré server v odpovediach neprijme, a osamotené náhradné znaky (KONTRAKT.md 4.9). Bez lookbehind. */
  function bezRiadiacich(s) {
    return Array.from(s).filter(function (z) {
      var k = z.charCodeAt(0);
      if (z.length === 1 && k >= 0xD800 && k <= 0xDFFF) return false; // osamotený náhradný znak
      return !(k <= 0x08 || k === 0x0B || k === 0x0C || (k >= 0x0E && k <= 0x1F) || (k >= 0x7F && k <= 0x9F));
    }).join('');
  }

  /* Jednoriadkové pole pre server: bez riadiacich a neviditeľných znakov, „=?“ rozdelené, medzery zlúčené
     (aj oddeľovač riadkov U+2028 a U+2029, ktorý server v riadku odmietne, je pre \s medzera). */
  function jednoriadok(s) { return cisty(riadokPreServer(bezRiadiacich(s || ''))); }

  /* E-mail: orezať a doménu s diakritikou previesť na punycode; časť pred @ sa nemení. */
  function upravEmail(s) {
    s = (s || '').trim();
    var i = s.lastIndexOf('@');
    if (i > 0) {
      var domena = s.slice(i + 1);
      if (/[^\x00-\x7F]/.test(domena) && !/[\s\/\\?#@:]/.test(domena)) {
        try { s = s.slice(0, i + 1) + new URL('http://' + domena).hostname; } catch (e) { /* server ju odmietne kódom email */ }
      }
    }
    return s;
  }
  function platnyEmail(s) { return s.length <= EMAIL_MAX && EMAIL_VZOR.test(s); }

  /* Punycode späť na Unicode (RFC 3492) len na zobrazenie v stave úspechu: Chrome v poli type="email" vráti doménu
     s diakritikou už ako xn--…, človek ju však napísal s diakritikou (brána front-20 p1, B7). Pri chybe ostáva ASCII. */
  function zPunycode(stitok) {
    var B = 36, TMIN = 1, TMAX = 26, SKEW = 38, DAMP = 700;
    var vystup = [];
    var i = 0, n = 128, bias = 72;
    var d = stitok.lastIndexOf('-');
    if (d > 0) for (var j = 0; j < d; j++) vystup.push(stitok.charCodeAt(j));
    for (var p = d > 0 ? d + 1 : 0; p < stitok.length;) {
      var stare = i, w = 1;
      for (var k = B; ; k += B) {
        if (p >= stitok.length) throw new Error('punycode');
        var c = stitok.charCodeAt(p++);
        var cif = (c >= 48 && c <= 57) ? c - 22 : ((c >= 65 && c <= 90) ? c - 65 : ((c >= 97 && c <= 122) ? c - 97 : B));
        if (cif >= B) throw new Error('punycode');
        i += cif * w;
        var t = k <= bias ? TMIN : (k >= bias + TMAX ? TMAX : k - bias);
        if (cif < t) break;
        w *= B - t;
      }
      var dlz = vystup.length + 1;
      var delta = stare === 0 ? Math.floor((i - stare) / DAMP) : (i - stare) >> 1;
      delta += Math.floor(delta / dlz);
      for (k = 0; delta > ((B - TMIN) * TMAX) >> 1; k += B) delta = Math.floor(delta / (B - TMIN));
      bias = Math.floor(k + (B - TMIN + 1) * delta / (delta + SKEW));
      n += Math.floor(i / dlz);
      i %= dlz;
      if (n > 0x10FFFF) throw new Error('punycode');
      vystup.splice(i++, 0, n);
    }
    if (!vystup.length) throw new Error('punycode');
    return String.fromCodePoint.apply(String, vystup);
  }
  function emailNaZobrazenie(s) {
    s = (s || '').trim();
    var at = s.lastIndexOf('@');
    if (at < 1 || !/(^|\.)xn--/i.test(s.slice(at + 1))) return s;
    try {
      return s.slice(0, at + 1) + s.slice(at + 1).split('.').map(function (l) {
        return /^xn--/i.test(l) ? zPunycode(l.slice(4).toLowerCase()) : l;
      }).join('.');
    } catch (e) { return s; }
  }

  /* Zdroj z adresy stránky (KONTRAKT.md 4.10): len povolené parametre, v hodnote len A-Z a-z 0-9 _ . : -, hodnota
     najviac 40 znakov, celé najviac 120. Bez nich ref=<hostiteľ> z document.referrer, okrem arling.sk. */
  function zdrojZAdresy(search, referrer) {
    var casti = [];
    var spolu = 0;
    var q = null;
    try { q = new URLSearchParams(search || ''); } catch (e) { q = null; }
    if (q) {
      ZDROJ_KLUCE.forEach(function (kluc) {
        var h = q.get(kluc);
        if (h === null) return;
        h = h.replace(/[^A-Za-z0-9_.:\-]/g, '').slice(0, 40);
        if (!h) return;
        var kus = kluc + '=' + h;
        var nove = spolu + (casti.length ? 1 : 0) + kus.length;
        if (nove > 120) return;
        casti.push(kus);
        spolu = nove;
      });
    }
    if (casti.length) return casti.join('&');
    var hostitel = '';
    try { hostitel = referrer ? new URL(referrer).hostname.toLowerCase() : ''; } catch (e) { hostitel = ''; }
    hostitel = hostitel.replace(/[^A-Za-z0-9_.:\-]/g, '');
    if (!hostitel || hostitel === 'arling.sk' || /\.arling\.sk$/.test(hostitel)) return '';
    return ('ref=' + hostitel).slice(0, 120);
  }

  /* Prehliadač vnútri appky Facebook alebo Instagram: tam sa mailto často neotvorí, kopírovanie ide prvé. */
  function vAppkeFacebooku(ua) { return /FBAN|FBAV|Instagram/.test(ua || ''); }

  function bajty(s) {
    try { if (typeof TextEncoder === 'function') return new TextEncoder().encode(s).length; } catch (e) { /* nižšie */ }
    try { return unescape(encodeURIComponent(s)).length; } catch (e) { return s.length * 3; }
  }

  function zaloha(veta, znova, meranie) { return { druh: 'zaloha', veta: veta, znova: znova, meranie: meranie }; }

  /* Spracovanie odpovede servera (KONTRAKT.md časť 3) ako čistá funkcia. stav: HTTP kód, 0 = žiadna odpoveď (sieť,
     časový limit, chýbajúca hlavička CORS); data: telo JSON alebo null; k: čo stránka vie o odpovediach (vyplnene,
     dlzkaTextu, dlzky jednoriadkových polí). Úspech len pri 200, ok === true a čísle D-RRRRMMDD-XXXX (R56);
     všetko ostatné je záloha alebo chyba pri poli, nikdy „odoslané“ bez čísla.
     znova: 'hned' (Skúsiť znova hneď), 'po60' (až po 60 s), 'nie' (opakovanie by dopadlo rovnako, ostáva záloha);
     'ostava' (hlavné tlačidlo ostane) používa len kontrola dĺžky pred odoslaním. */
  function vyhodnot(stavHttp, data, k) {
    k = k || {};
    var d = (data && typeof data === 'object') ? data : {};
    if (stavHttp === 200 && d.ok === true && typeof d.id === 'string' && CISLO_VZOR.test(d.id)) {
      var potvrdenie = d.potvrdenie === true;
      return { druh: 'uspech', id: d.id, potvrdenie: potvrdenie, meranie: potvrdenie ? 'ok' : 'potvrdenie_nie' };
    }
    if (!stavHttp) return zaloha('siet', 'hned', 'siet');
    if (stavHttp === 200) return zaloha('chyba', 'hned', d.ok === true ? 'bez_id' : 'chyba');
    if (stavHttp === 429) return zaloha('limit', 'po60', 'limit');
    if (stavHttp === 502) return zaloha('chyba', 'hned', 'posta');
    if (stavHttp === 400) {
      if (d.chyba === 'email') return { druh: 'pole', pole: 'email', sprava: T.email, meranie: 'chyba' };
      if (d.chyba === 'text') {
        if (!k.vyplnene) return { druh: 'pole', pole: 'text', sprava: T.text, meranie: 'chyba' };
        return zaloha((k.dlzkaTextu || 0) > TEXT_MAX ? 'velkost' : 'chyba', 'nie', 'chyba');
      }
      if (d.chyba === 'velkost') return zaloha('velkost', 'nie', 'chyba');
      if (d.chyba === 'pole' && Object.prototype.hasOwnProperty.call(RIADOK_MAX, d.pole) &&
          k.dlzky && k.dlzky[d.pole] > RIADOK_MAX[d.pole]) {
        return { druh: 'pole', pole: d.pole, sprava: RIADOK_MAX[d.pole] === 40 ? T.najviac40 : T.najviac120, meranie: 'chyba' };
      }
      return zaloha('chyba', d.chyba === 'pole' && d.pole === 'json' ? 'hned' : 'nie', 'chyba');
    }
    if (stavHttp === 403) return zaloha('chyba', 'nie', 'chyba');
    return zaloha('chyba', 'hned', 'chyba');
  }

  /* --- text odpovedí --- */

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
    var odpoved = (vstup.value || '').trim();
    /* Pole s voľbou „Neviem, zistite vy“ (časť 7): zaškrtnutie je odpoveď, aj keď je pole prázdne. */
    var neviem = vstup.type !== 'checkbox' ? pole.querySelector('input[type=checkbox]') : null;
    if (neviem && neviem.checked) odpoved = odpoved ? odpoved + ' (' + neviem.value + ')' : neviem.value;
    return { otazka: cisty(label ? label.textContent : vstup.name), odpoved: odpoved };
  }

  /* Jeden e-mail namiesto troch (audit konverzie, nález 5): predvolene ten istý aj na web a na faktúru. Pre server sa
     adresa do textu nepíše (ide v poli email), v e-maile cez mailto áno, lebo odosielateľ môže písať z inej adresy. */
  function emailyRiadky(preServer) {
    var rovnaky = el('email-rovnaky');
    if (!rovnaky) return [];
    if (rovnaky.checked) {
      var odp = cisty((el('email-odpoved') || {}).value);
      return ['E-mail na web a na faktúru: ' + (preServer ? 'rovnaký ako e-mail na odpoveď' : (odp || 'rovnaký ako e-mail, z ktorého píšem'))];
    }
    var r = [];
    var web = cisty((el('email') || {}).value);
    var fa = cisty((el('fa-email') || {}).value);
    if (web) r.push('E-mail na web: ' + web);
    if (fa) r.push('E-mail na faktúru: ' + fa);
    if (!r.length) r.push('E-mail na web a na faktúru: neuvedené');
    return r;
  }

  /* preServer: posledný riadok o prílohách pre server (logo a fotky prídu odpoveďou na potvrdenie), inak pre mailto.
     Výber z kalkulačky ide na začiatok presne tak, ako ho zloží ArlingCennik.rozpis (riadok Výpočet s odkazom na kalkulačku). */
  function zlozText(preServer) {
    var riadky = ['Dotazník k webu', ''];
    if (VYBER) {
      riadky.push('Výber z kalkulačky');
      VYBER_ROZPIS.split('\n').forEach(function (r) { riadky.push(r); });
      riadky.push('');
    }
    var prazdne = 0;
    /* Časti sú fieldset a details s id (časť 15); zbalené „Čo bude ďalej“ pri tlačidle nie je časť dotazníka. */
    form.querySelectorAll('fieldset, details[id]').forEach(function (sekcia) {
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
    emailyRiadky(preServer).forEach(function (r) { riadky.push(r); });
    if (prazdne) riadky.push('Nevyplnených otázok: ' + prazdne + ' (doplníme spolu e-mailom).');
    riadky.push(preServer ? 'Prílohy: logo a fotky pošle klient odpoveďou na potvrdenie.' : 'Prílohy: logo, fotky a cenník priložte k tomuto e-mailu.');
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
    var moja = ++akcia;
    var text = zlozText(false);
    var p = predmet();
    ukazNahlad(text);
    var plny = mailto(p, text);
    zmeraj('web_dotaznik_odoslat', { sposob: plny.length <= LIMIT ? 'mailto' : 'kopia' });
    if (plny.length <= LIMIT) {
      vlozVetu(stav, T.poMailto);
      window.location.href = plny;
      return;
    }
    skopiruj(text).then(function (ok) {
      if (moja !== akcia) return;
      var kratke = ok
        ? 'Odpovede z dotazníka sú v schránke. Vložte ich sem (Ctrl+V, v mobile podržte prst a zvoľte Vložiť).'
        : 'Odpovede z dotazníka vložím sem.';
      vlozVetu(stav, ok ? T.dlheSkopirovane : T.dlheNeskopirovane);
      window.location.href = mailto(p, kratke + NL + NL);
    });
  });

  kopirovat.addEventListener('click', function () {
    var moja = ++akcia;
    /* Vždy čerstvé odpovede: po zálohe mohol človek ešte niečo doplniť. */
    var text = zlozText(false);
    ukazNahlad(text);
    skopiruj(text).then(function (ok) {
      if (moja !== akcia) return;
      vlozVetu(stav, ok ? T.skopirovane : T.neskopirovane);
    });
  });
  /* Poradie kliknutí (AGENTS.md bod 12a): odložená odpoveď schránky staršieho kliknutia neprepíše stav ani neotvorí
     e-mail, keď medzitým prišlo novšie kliknutie alebo nový pokus o odoslanie (odosli zvýši akcia). Stav po mailto
     netvrdí, že sa e-mail otvoril (pred-fb nálezy 38 a 39, ako verzia bez servera). Vety len cez vlozVetu, nikdy HTML.
     Deklarácia stojí za oboma obsluhami zámerne: je tak v oblasti js-kliky, ktorú bez-servera/postav.py nahrádza celú
     (JS_KLIKY má vlastnú), a obsluhy ju čítajú až pri kliknutí. */
  var akcia = 0;

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
  var sekcie = [].slice.call(form.querySelectorAll('fieldset, details[id]'));
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
    var s = e.target.closest ? e.target.closest('fieldset, details[id]') : null;
    if (s && s.id && !zmerane[s.id]) {
      zmerane[s.id] = true;
      zmeraj('web_dotaznik_krok', { krok: s.id.replace('cast-', '') });
    }
  });
  form.addEventListener('change', obnovPriebeh);
  window.addEventListener('pageshow', obnovPriebeh);
  obnovPriebeh();

  /* --- odoslanie cez server (KONTRAKT.md časť 4) --- */
  var serverBlok = document.getElementById('server-odoslanie');
  var tlacidlo = document.getElementById('odoslat-tlac');
  var tlacidloText = tlacidlo ? (tlacidlo.querySelector('span') || tlacidlo) : null;
  var emailOdpoved = document.getElementById('email-odpoved');
  var emailWeb = document.getElementById('email');
  var pasca = document.getElementById('dz-poznamka');
  var odoslanie = document.getElementById('odoslanie');
  var zalohaBlok = document.getElementById('zaloha');
  var zalohaVeta = document.getElementById('zaloha-veta');
  var chybaOdpovede = document.getElementById('odpovede-chyba');
  var uspech = document.getElementById('uspech');
  var ZDROJ = zdrojZAdresy(window.location.search, document.referrer);
  var VSTUPY = { nazov: 'nazov', meno: 'osoba', telefon: 'telefon', email: 'email-odpoved' };
  var odosiela = false;
  var odoslane = false; /* po úspechu sa už nič neposiela */
  var posledny = 0;
  /* Bez fetch (veľmi starý prehliadač) alebo bez prvkov stránky ostáva celé dnešné odoslanie cez mailto. */
  var cezServer = !!(serverBlok && tlacidlo && tlacidloText && emailOdpoved && odoslanie && zalohaBlok && zalohaVeta &&
    chybaOdpovede && uspech && typeof window.fetch === 'function');

  function el(id) { return document.getElementById(id); }

  /* Veta do prvku len ako textové uzly; slová „e-mail“, „e-mailom“ a pod. v <span class="nw">, aby sa nelámali za
     spojovníkom (písmo ARLing Draw Text nemá nezlomiteľný spojovník U+2011, preto obal ako inde na stránke). Nikdy HTML. */
  /* Od linky web-cennik aj „e-shop…“ (výber z kalkulačky: „správa e-shopu“), aby sa nezlomilo za spojovníkom. */
  var EMAIL_SLOVO = /([Ee]-(?:mail|shop)[a-záäčďéíĺľňóôŕšťúýž]*)/;
  function vlozVetu(cielEl, text) {
    cielEl.textContent = '';
    String(text || '').split(EMAIL_SLOVO).forEach(function (kus, i) {
      if (!kus) return;
      if (i % 2) {
        var obal = document.createElement('span');
        obal.className = 'nw';
        obal.textContent = kus;
        cielEl.appendChild(obal);
      } else {
        cielEl.appendChild(document.createTextNode(kus));
      }
    });
  }

  /* Odkaz na ukážky v časti 11 má target=_blank a „otvorí sa v novej karte“. Prehliadač v appke Facebooku a Instagramu
     karty nemá, odkaz otvorí namiesto dotazníka a rozpísané odpovede sa môžu stratiť (pred-fb nález 50). Tam ostane
     len veta bez odkazu a bez sľubu novej karty, vložená ako text (vlozVetu, nikdy HTML). Inde sa nemení nič. */
  function stylBezOdkazu(ua) {
    var p = el('styl-pomoc');
    if (!p || !vAppkeFacebooku(ua)) return false;
    vlozVetu(p, T.stylApp);
    return true;
  }
  try { stylBezOdkazu(navigator.userAgent); } catch (e) { /* pri chybe ostáva pôvodný odkaz */ }

  function pocetVyplnenych() { return sekcie.filter(maOdpoved).length; }

  function eshopVyplneny() {
    var e = el('cast-15');
    return !!(e && maOdpoved(e));
  }

  /* Poradie tlačidiel zálohy: v appke Facebooku a Instagramu najprv Skopírovať odpovede, inde najprv Otvoriť e-mail. */
  function usporiadajZalohu(ua) {
    var prvy = vAppkeFacebooku(ua) ? kopirovat : otvorit;
    var druhy = prvy === kopirovat ? otvorit : kopirovat;
    zalohaBlok.appendChild(prvy);
    zalohaBlok.appendChild(druhy);
  }

  /* Jedno zvýraznené tlačidlo (R77) a vždy na cestu, ktorá funguje (brána front-20 p1, B2 a B6): pri chybe servera,
     limite a dĺžke nad 15 000 znakov je zvýraznené prvé tlačidlo zálohy a hlavné (Skúsiť znova, Odoslať) obrysové;
     pri chybe siete, kde opakovanie môže prejsť, ostáva zvýraznené hlavné. Bez zálohy na obrazovke vždy hlavné. */
  var zalohaPrva = false;
  var vetaZalohy = '';
  function zvyrazniZalohu() {
    var hlavne = !tlacidlo.hidden && !zalohaPrva;
    var prvy = vAppkeFacebooku(navigator.userAgent) ? kopirovat : otvorit;
    [otvorit, kopirovat].forEach(function (b) {
      b.className = 'tlac ' + (!hlavne && b === prvy ? 'tlac-hl' : 'tlac-obrys');
    });
    tlacidlo.className = 'tlac ' + (hlavne || tlacidlo.hidden ? 'tlac-hl' : 'tlac-obrys');
  }

  /* stavTl: 'pripravene', 'odosiela', 'znova', 'skryte'. Pri skrytom tlačidle sa skryje aj jeho riadok .akcie,
     aby nad vetou zálohy neostala prázdna medzera (brána front-20 p1, B3). */
  var tlacidloRiadok = tlacidlo && tlacidlo.parentNode && tlacidlo.parentNode.classList &&
    tlacidlo.parentNode.classList.contains('akcie') ? tlacidlo.parentNode : null;
  function nastavTlacidlo(stavTl) {
    tlacidlo.hidden = stavTl === 'skryte';
    if (tlacidloRiadok) tlacidloRiadok.hidden = stavTl === 'skryte';
    tlacidlo.disabled = stavTl === 'odosiela' || stavTl === 'skryte';
    if (stavTl === 'odosiela') tlacidlo.setAttribute('aria-busy', 'true'); else tlacidlo.removeAttribute('aria-busy');
    tlacidloText.textContent = stavTl === 'odosiela' ? T.odosiela : (stavTl === 'pripravene' ? T.odoslat : T.znova);
    zvyrazniZalohu();
  }

  function ukazChybu(vstup, chyba, sprava) {
    vlozVetu(chyba, sprava);
    chyba.hidden = false;
    if (!vstup) return;
    vstup.setAttribute('aria-invalid', 'true');
    var popis = (vstup.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (popis.indexOf(chyba.id) === -1) popis.push(chyba.id);
    vstup.setAttribute('aria-describedby', popis.join(' '));
  }

  function skryChybu(vstup, chyba) {
    if (chyba) { chyba.hidden = true; chyba.textContent = ''; }
    if (!vstup || !chyba) return;
    vstup.removeAttribute('aria-invalid');
    var popis = (vstup.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (x) { return x && x !== chyba.id; });
    if (popis.length) vstup.setAttribute('aria-describedby', popis.join(' ')); else vstup.removeAttribute('aria-describedby');
  }

  /* Chyba pri jednoriadkovom poli otázok: odsek s chybou sa vytvorí raz, za poľom (text cez textContent). */
  function chybaPola(vstup) {
    var id = vstup.id + '-chyba';
    var p = el(id);
    if (!p) {
      p = document.createElement('p');
      p.id = id;
      p.className = 'chyba-pola';
      p.hidden = true;
      vstup.parentNode.appendChild(p);
    }
    return p;
  }

  function vycistiChyby() {
    ['nazov', 'meno', 'telefon'].forEach(function (k) {
      var v = el(VSTUPY[k]);
      if (v && el(v.id + '-chyba')) skryChybu(v, el(v.id + '-chyba'));
    });
    skryChybu(emailOdpoved, el('email-odpoved-chyba'));
    skryChybu(null, chybaOdpovede);
  }

  /* Chyba pri poli (R69): text pri poli, aria-invalid, aria-describedby a fokus. pole: email, text, nazov, meno, telefon. */
  function ukazChybuPola(pole, sprava) {
    if (pole === 'text') { ukazChybu(null, chybaOdpovede, sprava); return chybaOdpovede; }
    var vstup = el(VSTUPY[pole]);
    if (!vstup) return null;
    ukazChybu(vstup, pole === 'email' ? el('email-odpoved-chyba') : chybaPola(vstup), sprava);
    return vstup;
  }

  function hodnotyPoli() {
    return {
      nazov: jednoriadok((el('nazov') || {}).value),
      meno: jednoriadok((el('osoba') || {}).value),
      telefon: jednoriadok((el('telefon') || {}).value)
    };
  }

  /* Text odpovedí a telo požiadavky (KONTRAKT.md 2); velke: server by ho odmietol (nad 15 000 znakov alebo 64 KB). */
  function zlozTelo(email, hodnoty) {
    var text = bezRiadiacich(zlozText(true));
    var telo = JSON.stringify({
      email: email,
      text: text,
      nazov: hodnoty.nazov,
      meno: hodnoty.meno,
      telefon: hodnoty.telefon,
      zdroj: ZDROJ,
      lang: 'sk',
      hp: pasca ? pasca.value : '',
      t: Math.round(teraz() - zaciatok)
    });
    return {
      telo: telo,
      velke: dlzka(text) > TEXT_MAX || bajty(telo) > TELO_MAX,
      dlzkaTextu: dlzka(text)
    };
  }

  /* Kontrola pred odoslaním (KONTRAKT.md 4.2). Pri chybe ukáže chyby, presunie fokus na prvú a vráti null. */
  function skontroluj() {
    vycistiChyby();
    if (!emailOdpoved.value.trim() && emailWeb && emailWeb.value.trim()) emailOdpoved.value = emailWeb.value.trim();
    var email = upravEmail(emailOdpoved.value);
    var hodnoty = hodnotyPoli();
    var dlzky = { nazov: dlzka(hodnoty.nazov), meno: dlzka(hodnoty.meno), telefon: dlzka(hodnoty.telefon) };
    var vyplnene = pocetVyplnenych();
    var chyby = []; /* v poradí na stránke */
    ['nazov', 'meno', 'telefon'].forEach(function (k) {
      if (dlzky[k] > RIADOK_MAX[k]) chyby.push([k, RIADOK_MAX[k] === 40 ? T.najviac40 : T.najviac120]);
    });
    if (!platnyEmail(email)) chyby.push(['email', T.email]);
    /* Povinný je len e-mail (prvá veta stránky, cenník 4.1 a audit nález 4): dotazník bez odpovedí sa pošle tiež, text má
       vždy aspoň hlavičku, riadok o e-maile a počet nevyplnených otázok (server chce aspoň 30 znakov, KONTRAKT.md 2). */
    if (chyby.length) {
      var prve = null;
      chyby.forEach(function (c) { var f = ukazChybuPola(c[0], c[1]); if (!prve) prve = f; });
      if (prve) prve.focus();
      return null;
    }
    var z = zlozTelo(email, hodnoty);
    return {
      telo: z.telo,
      email: email,
      /* v stave úspechu adresa, ako ju človek napísal (orezaná); punycode len v tele pre server (brána front-20 p1, B7) */
      zobrazit: emailNaZobrazenie(emailOdpoved.value),
      velke: z.velke,
      kontext: { vyplnene: vyplnene, dlzky: dlzky, dlzkaTextu: z.dlzkaTextu }
    };
  }

  function skryZalohu() {
    zalohaVeta.hidden = true;
    zalohaVeta.textContent = '';
    zalohaBlok.hidden = true;
    if (nahlad) nahlad.hidden = true;
    zalohaPrva = false;
    vetaZalohy = '';
  }

  /* Po ukázaní zálohy musí byť na obrazovke veta aj prvé tlačidlo zálohy (brána front-20 p1, B2b). Fokus ide na vetu
     bez posunu; ak riadok s hlavným tlačidlom (alebo veta, keď je skryté) a prvé tlačidlo zálohy nie sú celé vidno,
     stránka ich posunie pod hlavičku (scroll-padding-top na html). Pri obmedzenom pohybe bez plynulého posunu. */
  function ukazNaObrazovke() {
    var ciel = (tlacidloRiadok && !tlacidloRiadok.hidden) ? tlacidloRiadok : zalohaVeta;
    var prvy = zalohaBlok.children && zalohaBlok.children[0];
    if (!prvy || typeof ciel.scrollIntoView !== 'function') return;
    var vyska = window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 0;
    var hore = hlava ? hlava.getBoundingClientRect().bottom : 0;
    if (ciel.getBoundingClientRect().top >= hore && prvy.getBoundingClientRect().bottom <= vyska) return;
    try { ciel.scrollIntoView({ block: 'start', behavior: malyPohyb ? 'auto' : 'smooth' }); } catch (e) { ciel.scrollIntoView(true); }
  }

  /* Záloha (KONTRAKT.md 4.5 a 5.3): veta, Otvoriť e-mail s odpoveďami a Skopírovať odpovede s náhľadom textu. */
  function ukazZalohu(v, pokus) {
    /* V appke Facebooku a Instagramu veta v poradí tlačidiel (najprv Skopírovať odpovede), inde text kontraktu. */
    var vety = vAppkeFacebooku(navigator.userAgent) ? T.zalohaApp : T.zaloha;
    vlozVetu(zalohaVeta, vety[v.veta] || vety.chyba);
    zalohaVeta.hidden = false;
    zalohaBlok.hidden = false;
    otvorit.hidden = false;
    ukazNahlad(zlozText(false));
    vetaZalohy = v.veta;
    zalohaPrva = v.veta !== 'siet';
    if (v.znova === 'hned') nastavTlacidlo('znova');
    else if (v.znova === 'ostava') nastavTlacidlo('pripravene');
    else nastavTlacidlo('skryte');
    if (v.znova === 'po60') {
      window.setTimeout(function () {
        if (pokus !== posledny) return; /* medzitým začal iný pokus */
        nastavTlacidlo('znova');
      }, ZNOVA_PO_LIMITE_MS);
    }
    try { zalohaVeta.focus({ preventScroll: true }); } catch (e) { zalohaVeta.focus(); }
    ukazNaObrazovke();
  }

  /* Dĺžka nad 15 000 znakov (B6): kým sa odpovede neskrátia, je zvýraznená záloha; po skrátení znova hlavné tlačidlo. */
  function obnovPoSkrateni() {
    if (vetaZalohy !== 'velkost' || !zalohaPrva || odosiela || odoslane) return;
    if (!zlozTelo(upravEmail(emailOdpoved.value), hodnotyPoli()).velke) {
      zalohaPrva = false;
      zvyrazniZalohu();
    }
  }

  /* Stav úspechu (KONTRAKT.md 4.4 a 5.2, termín odpovede podľa cenníka 4.1). Číslo a e-mail len cez textContent; polia
     formulára sa nemažú. S výberom z kalkulačky termín náhľadu, stávka a platba presne pre vybraný balík (cennik.js). */
  function ukazUspech(v, email) {
    el('uspech-cislo').textContent = v.id;
    el('uspech-email').textContent = email;
    el('uspech-ano').hidden = !v.potvrdenie;
    el('uspech-nie').hidden = !!v.potvrdenie;
    el('dalej-ano').hidden = !v.potvrdenie;
    el('dalej-nie').hidden = !!v.potvrdenie;
    var es = eshopVyplneny();
    var nahlad = el('dalej-nahlad');
    var platba = el('dalej-platba');
    if (VYBER && nahlad && platba) {
      try {
        var sv = C.spocitaj(VYBER);
        vlozVetu(nahlad, naZobrazenie('Náhľad pošleme ' + sv.nahlad + '. ' + sv.stavka));
        vlozVetu(platba, naZobrazenie(sv.balik === 'eshop' ? C.data.texty.platbaEshop : C.data.texty.platbaWeb));
        es = false;
      } catch (e) { /* ostanú všeobecné vety */ }
    }
    el('dalej-eshop-nahlad').hidden = !es;
    el('dalej-eshop-platba').hidden = !es;
    odoslanie.hidden = true;
    uspech.hidden = false;
    el('uspech-nadpis').focus();
  }

  /* Výsledok pokusu. Poradie (AGENTS.md bod 12a): odpoveď staršieho pokusu nikdy neprepíše stav novšieho. */
  function dokonci(pokus, v, email) {
    if (pokus !== posledny) return;
    odosiela = false;
    if (stav && stav.textContent === T.odosiela) stav.textContent = '';
    zmeraj('web_dotaznik_vysledok', { vysledok: v.meranie });
    if (v.druh === 'uspech') {
      odoslane = true;
      nastavTlacidlo('skryte');
      ukazUspech(v, email);
      return;
    }
    if (v.druh === 'pole') {
      nastavTlacidlo('pripravene');
      var f = ukazChybuPola(v.pole, v.sprava);
      if (f) f.focus();
      return;
    }
    ukazZalohu(v, pokus);
  }

  function odosli() {
    if (odosiela || odoslane) return; /* dvojklik: ďalšie kliky sa ignorujú, kým nepríde odpoveď alebo neuplynie 45 s */
    var k = skontroluj();
    if (!k) return;
    /* Nad 15 000 znakov alebo 64 KB by server odmietol: nič sa neposiela, rovno záloha; po skrátení sa dá odoslať. */
    if (k.velke) { ukazZalohu(zaloha('velkost', 'ostava', 'chyba'), posledny); return; }
    odosiela = true;
    var pokus = ++posledny;
    skryZalohu();
    nastavTlacidlo('odosiela');
    /* Vypnuté tlačidlo stratí fokus, preto stav prečíta čítačka z #stav (role status), brána front-20 p1, B4.
       akcia: neskorá odpoveď schránky zo zálohy pred týmto pokusom už stav neprepíše (bod 12a). */
    akcia++;
    if (stav) stav.textContent = T.odosiela;
    zmeraj('web_dotaznik_odoslat', { sposob: 'server' });
    var ovladac = null;
    try { if (typeof AbortController === 'function') ovladac = new AbortController(); } catch (e) { ovladac = null; }
    var vyprsal = false;
    var casovac = window.setTimeout(function () {
      vyprsal = true;
      try { if (ovladac) ovladac.abort(); } catch (e) { /* nič */ }
      dokonci(pokus, vyhodnot(0, null, k.kontext), k.zobrazit);
    }, CAS_LIMIT_MS);
    var moznosti = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: k.telo,
      credentials: 'omit',
      cache: 'no-store'
    };
    if (ovladac) moznosti.signal = ovladac.signal;
    var poziadavka;
    try { poziadavka = window.fetch(SERVER, moznosti); } catch (e) { poziadavka = Promise.reject(e); }
    Promise.resolve(poziadavka).then(function (r) {
      return Promise.resolve().then(function () { return r.json(); }).then(null, function () { return null; })
        .then(function (data) { return { stav: r.status, data: data }; });
    }).then(function (o) {
      window.clearTimeout(casovac);
      if (vyprsal) return; /* časový limit už pokus uzavrel; neskorá odpoveď ho nedokončí druhý raz (brána front-20 p2, B) */
      dokonci(pokus, vyhodnot(o.stav, o.data, k.kontext), k.zobrazit);
    }, function () {
      window.clearTimeout(casovac);
      if (vyprsal) return; /* časový limit už ukázal zálohu */
      dokonci(pokus, vyhodnot(0, null, k.kontext), k.zobrazit);
    });
  }

  if (cezServer) {
    serverBlok.hidden = false;
    skryZalohu();
    usporiadajZalohu(navigator.userAgent);
    nastavTlacidlo('pripravene');
    tlacidlo.addEventListener('click', odosli);
    /* Predvyplnenie e-mailu na odpoveď z poľa E-mail na web, kým ho človek nevyplní sám. */
    if (emailWeb) emailWeb.addEventListener('change', function () {
      if (!emailOdpoved.value.trim()) emailOdpoved.value = emailWeb.value.trim();
    });
    emailOdpoved.addEventListener('input', function () { skryChybu(emailOdpoved, el('email-odpoved-chyba')); });
    ['nazov', 'meno', 'telefon'].forEach(function (kl) {
      var v = el(VSTUPY[kl]);
      if (v) v.addEventListener('input', function () { var c = el(v.id + '-chyba'); if (c) skryChybu(v, c); });
    });
    form.addEventListener('input', function () { if (!chybaOdpovede.hidden && pocetVyplnenych()) skryChybu(null, chybaOdpovede); });
    form.addEventListener('input', obnovPoSkrateni);
  }

  /* Rovnaký e-mail aj na web a na faktúru (predvolené): inak sa pod ním ukážu dve nepovinné polia. Stav zaškrtnutia
     po návrate na stránku (pageshow) sa prečíta znova, nič sa neukladá. */
  var rovnaky = el('email-rovnaky');
  var ineEmaily = el('ine-emaily');
  function obnovIneEmaily() { if (rovnaky && ineEmaily) ineEmaily.hidden = !!rovnaky.checked; }
  if (rovnaky) rovnaky.addEventListener('change', obnovIneEmaily);
  window.addEventListener('pageshow', obnovIneEmaily);
  obnovIneEmaily();

  /* Váš výber hore a jedna veta pri tlačidle (R78: suma viditeľná až do odoslania). Všetko len cez textové uzly
     (vlozVetu, textContent, createElement); odkaz Zmeniť len v tvare, ktorý vyrába ArlingCennik.adresa. */
  function polozka(zoznam, text, trieda) {
    var li = document.createElement('li');
    if (trieda) li.className = trieda;
    vlozVetu(li, naZobrazenie(text));
    zoznam.appendChild(li);
  }
  function ukazVyber() {
    var blok = el('vyber-moj');
    var cennik = el('vyber-cennik');
    if (!VYBER || !blok || !cennik) return false;
    var z;
    try { z = zhrnutieVyberu(VYBER); } catch (e) { return false; }
    var D = C.data;
    var uk = el('vyber-ukazka');
    if (uk) { vlozVetu(uk, naZobrazenie(z.ukazka)); uk.hidden = !z.ukazka; }
    el('vyber-suma').textContent = naZobrazenie(z.suma);
    vlozVetu(el('vyber-co'), naZobrazenie(z.co));
    vlozVetu(el('vyber-sluzba'), naZobrazenie(z.sluzba));
    var rozpis = el('vyber-rozpis');
    var vcene = el('vyber-vcene');
    if (rozpis) {
      rozpis.textContent = '';
      VYBER_ROZPIS.split('\n').forEach(function (r) {
        if (r.indexOf(D.texty.podlaUkazky + ' ') === 0 || r.indexOf(D.texty.vypocet + ':') === 0) return;
        polozka(rozpis, r, r.indexOf(D.texty.spolu + ':') === 0 ? 'spolu' : '');
      });
    }
    if (vcene) { vcene.textContent = ''; z.vCene.forEach(function (r) { polozka(vcene, r); }); }
    var zmenit = el('vyber-zmenit');
    var h = '';
    try { h = C.adresa(VYBER, 'kalkulacka', window.location.search); } catch (e) { h = ''; }
    if (zmenit && /^\/web\/\?[A-Za-z0-9_.,=&-]+#kalkulacka$/.test(h)) zmenit.setAttribute('href', h);
    var veta = el('odoslat-vyber');
    if (veta) {
      vlozVetu(veta, naZobrazenie('S dotazníkom pošlete aj váš výber z kalkulačky: ' + z.co + ', ' + z.suma + ' jednorazovo' + z.sluzbaKratko + '.'));
      veta.hidden = false;
    }
    if (z.s.balik === 'eshop') { var c15 = el('cast-15'); if (c15) c15.setAttribute('open', ''); }
    cennik.hidden = true;
    blok.hidden = false;
    return true;
  }
  try { ukazVyber(); } catch (e) { /* pri chybe ostanú statické ceny */ }

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
    zaPanelom.forEach(function (e) { if (zapnut) e.setAttribute('inert', ''); else e.removeAttribute('inert'); });
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

  /* Len pre testy v Node (ops/weby-na-mieru/v2/front-20/testy/): v prehliadači __dotaznikTest neexistuje a nič sa nedeje. */
  if (typeof window.__dotaznikTest === 'function') {
    window.__dotaznikTest({
      vyhodnot: vyhodnot, zdrojZAdresy: zdrojZAdresy, vAppkeFacebooku: vAppkeFacebooku, riadokPreServer: riadokPreServer,
      bezRiadiacich: bezRiadiacich, jednoriadok: jednoriadok, upravEmail: upravEmail, platnyEmail: platnyEmail,
      zlozText: zlozText, ukazUspech: ukazUspech, cezServer: cezServer, T: T, pevneMedzery: pevneMedzery, vlozVetu: vlozVetu, emailNaZobrazenie: emailNaZobrazenie,
      VYBER: VYBER, VYBER_ROZPIS: VYBER_ROZPIS, zhrnutieVyberu: zhrnutieVyberu, emailyRiadky: emailyRiadky, naZobrazenie: naZobrazenie
    });
  }
})();
