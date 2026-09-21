/* The World in Squares: panel majiteľa (/world/owner/). Stará adresa /svet/majitel/
   sem od 21. 9. 2026 len presmeruje, aj s kľúčom za mriežkou.
   Zdroj: ops/svet/majitel.js, do hubu ho ako /world/panel.js kopíruje ops/svet/postav.mjs.
   Neupravovať v produkte.

   KĽÚČ MAJITEĽA. Jediné prihlásenie je dlhý náhodný kľúč v odkaze z e-mailu, v časti
   adresy za mriežkou (#t=…). Tú časť prehliadač neposiela žiadnemu serveru ani v
   hlavičke Referer. Tento skript ju prečíta a službe ju posiela len vo vnútri
   požiadavky: pri čítaní v hlavičke X-Svet-Token, pri zápise v tele POST. Do adresy
   žiadnej požiadavky sa kľúč nedostane nikdy, ani pri sťahovaní certifikátu. Stránka
   nemá Umami a má referrer no-referrer, takže kľúč nemá kadiaľ odísť.

   Všetky vety sú v ops/svet/texty.mjs (textyMajitela), paleta sa číta pri stavbe zo
   služby (products/svet/obrazok.py). Tu nie je ani jedna farba a ani jedna veta. */
(function () {
  'use strict';

  var koren = document.querySelector('[data-majitel]');
  if (!koren) return;
  var telo = document.body;
  var T, PALETA, PANELY;
  try {
    var vlozene = JSON.parse(document.getElementById('svet-texty').textContent);
    T = vlozene.texty; PALETA = vlozene.paleta; PANELY = vlozene.panely || [];
  } catch (e) { return; }
  if (!T || !PALETA || PALETA.length !== 16) return;

  var API = telo.getAttribute('data-api') || '';
  var JAZYK = telo.getAttribute('data-jazyk') || 'en';
  var NBSP = String.fromCharCode(160);   // pevna medzera v cislach, zapisana kodom, nie neviditelnym znakom
  var VELKOST = 32, BODOV = VELKOST * VELKOST, POZADIE = 0;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]; }); }
  function cisloText(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP); }
  function datum(iso) {
    var d = iso ? new Date(iso) : null;
    if (!d || isNaN(d.getTime())) return '';
    try { return d.toLocaleDateString(JAZYK === 'sk' ? 'sk-SK' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return String(iso).slice(0, 10); }
  }

  // ── Kľúč ─────────────────────────────────────────────────────────────────
  // Z časti za mriežkou; keď tam nie je (návrat z mapy v tej istej karte), zo
  // sessionStorage, ktoré žije len do zavretia karty. Nikdy z otáznika.
  var KLUC = '';
  function citajKluc() {
    var m = /(?:^#|&)t=([^&]+)/.exec(location.hash || '');
    var k = '';
    if (m) { try { k = decodeURIComponent(m[1]); } catch (e) { k = m[1]; } }
    if (k) { try { sessionStorage.setItem('svet-kluc', k); } catch (e) {} return k; }
    try { return sessionStorage.getItem('svet-kluc') || ''; } catch (e) { return ''; }
  }

  // Certifikát z e-mailu po platbe: odkaz je /world/owner/#t=…&cert=ID. Ten istý
  // kľúč otvorí panel a číslo za ním povie, ktorý certifikát si človek prišiel
  // stiahnuť. Do otáznika sa nedáva nič, kľúč aj číslo ostávajú za mriežkou.
  var CERT = 0;
  function citajCert() {
    var m = /[#&]cert=(\d{1,9})(?:&|$)/.exec(location.hash || '');
    return m ? Number(m[1]) : 0;
  }

  // Prepínač jazyka vedie na druhý panel. Kľúč si tam odnesie za mriežkou; v HTML
  // odkazu nie je, pripíše sa až pri kliknutí.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || !KLUC) return;
    var cesta;
    try { cesta = new URL(a.href, location.href).pathname; } catch (err) { return; }
    if (PANELY.indexOf(cesta) < 0 || a.hash) return;
    a.hash = 't=' + encodeURIComponent(KLUC);
  }, true);

  // ── Volanie služby ───────────────────────────────────────────────────────
  // Vracia vždy {kod, d}; kod 0 znamená, že odpoveď neprišla vôbec (sieť, výpadok).
  function volaj(cesta, data) {
    var nast = { credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' };
    if (data) {
      data.token = KLUC;
      nast.method = 'POST';
      nast.headers = { 'Content-Type': 'application/json' };
      nast.body = JSON.stringify(data);
    } else {
      nast.headers = { 'X-Svet-Token': KLUC };
    }
    return fetch(API + cesta, nast).then(function (o) {
      return o.json().catch(function () { return {}; }).then(function (d) { return { kod: o.status, d: d || {} }; });
    }).catch(function () { return { kod: 0, d: {} }; });
  }
  function spravaSluzby(d) { return (JAZYK === 'sk' ? d.sprava : d.message) || d.message || d.sprava || ''; }

  // ── Celostránkové stavy ──────────────────────────────────────────────────
  // Formulár stratného odkazu je ZA hláškou, nie v nej: hláška je živá oblasť
  // (role="status") a formulár do živej oblasti nepatrí, čítačka by ho pri
  // každej zmene textu prečítala celý znova.
  function hlaska(nadpis, odseky, tlacidlo, sFormularom) {
    var h = '<div class="majitel-hlaska" role="status"><h2>' + esc(nadpis) + '</h2>';
    for (var i = 0; i < odseky.length; i++) h += '<p>' + esc(odseky[i]) + '</p>';
    if (tlacidlo) h += '<p><button class="btn btn-solid" type="button" data-znova>' + esc(tlacidlo) + '</button></p>';
    h += '</div>';
    if (sFormularom) h += formularHtml();
    koren.innerHTML = h;
    var b = koren.querySelector('[data-znova]');
    if (b) b.addEventListener('click', nacitaj);
    if (sFormularom) ozivFormular();
  }

  // ── Stratený odkaz ───────────────────────────────────────────────────────
  // Jedno pole, jedno tlačidlo a po odoslaní vždy tá istá veta. Služba odpovedá
  // rovnako známej aj neznámej adrese, takže sa cez tento formulár nedá zistiť,
  // kto si štvorec kúpil. Kľúč sa sem neposiela: sem sa chodí práve preto, že žiadny nie je.
  function formularHtml() {
    return '<form class="pole" data-stratene novalidate>'
      + '<h4><label for="svet-stratene">' + esc(T.stratenyPopis) + '</label></h4>'
      + '<input id="svet-stratene" type="email" inputmode="email" autocomplete="email" maxlength="200" spellcheck="false" autocapitalize="off" placeholder="' + esc(T.stratenyPole) + '" data-vstup="email">'
      + '<div class="pole-akcie"><button class="btn btn-solid" type="submit">' + esc(T.stratenyTlacidlo) + '</button></div>'
      + '<p class="stav" data-stav="stratene" role="status"></p></form>';
  }

  function ozivFormular() {
    var f = koren.querySelector('[data-stratene]');
    if (!f) return;
    var pole = f.querySelector('[data-vstup="email"]');
    var stav = f.querySelector('[data-stav="stratene"]');
    var tlacidlo = f.querySelector('button[type="submit"]');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var adresa = (pole.value || '').trim();
      if (adresa.indexOf('@') < 1 || adresa.length > 200) { ukazSpravu(stav, 'skryte', T.stratenyZlaAdresa); pole.focus(); return; }
      var text = tlacidlo.textContent;
      tlacidlo.disabled = true;
      tlacidlo.textContent = T.stratenyOdosielam;
      volaj('/api/owner/send-link', { email: adresa }).then(function (v) {
        tlacidlo.disabled = false;
        tlacidlo.textContent = text;
        if (v.kod === 200) { pole.value = ''; ukazSpravu(stav, 'verejne', T.stratenyHotovo); return; }
        ukazSpravu(stav, 'skryte', v.kod === 429 ? T.stratenyLimit : T.stratenyChyba);
      });
    });
  }

  var MAJITEL = null;
  function nacitaj() {
    KLUC = citajKluc();
    CERT = citajCert();
    if (!KLUC) { hlaska(T.bezKlucaNadpis, [T.bezKluca, T.bezKlucaPomoc], null, true); return; }
    koren.innerHTML = '<p class="majitel-hlaska" role="status">' + esc(T.nacitavam) + '</p>';
    volaj('/api/owner').then(function (v) {
      if (v.kod === 401) {
        try { sessionStorage.removeItem('svet-kluc'); sessionStorage.removeItem('svet-majitel'); } catch (e) {}
        hlaska(T.zlyKlucNadpis, [T.zlyKluc, T.bezKlucaPomoc], null, true);
        return;
      }
      if (v.kod !== 200 || !v.d.ok) { hlaska(T.chybaSieteNadpis, [T.chybaSiete], T.skusitZnova); return; }
      MAJITEL = v.d;
      vykresli();
    });
  }

  // Kredit balíka sa míňa na mape. Tá si kľúč prečíta zo sessionStorage v tej
  // istej karte; do jej adresy ho nedávame, lebo na mape beží Umami.
  function odovzdajMape() {
    try {
      if (MAJITEL && MAJITEL.credit > 0) sessionStorage.setItem('svet-majitel', JSON.stringify({ t: KLUC, k: MAJITEL.credit }));
      else sessionStorage.removeItem('svet-majitel');
    } catch (e) {}
  }

  function vykresli() {
    var d = MAJITEL, parcely = d.parcels || [], predplatne = d.subscriptions || [];
    var limit = (d.limits && d.limits.art_per_hour) || 10;
    var h = '';
    if (d.email) h += '<p class="majitel-ucet">' + esc(T.prihlaseny) + ' <b>' + esc(d.email) + '</b></p>';

    if (d.credit > 0) {
      // Zamerne div, nie <section>: paper.css dava kazdej sekcii velke zvisle odsadenie.
      h += '<div class="majitel-kredit"><h2>' + esc(T.kreditNadpis) + '</h2>';
      h += '<p><b class="majitel-pocet">' + cisloText(d.credit) + '</b> ' + esc(d.credit === 1 ? T.kreditJeden : T.kreditViac) + '. ' + esc(T.kreditText) + '</p>';
      h += '<p><a class="btn btn-solid" href="' + esc(T.cestaMapy) + '">' + esc(T.kreditTlacidlo) + '</a></p></div>';
    }

    if (!parcely.length) {
      h += '<div class="majitel-hlaska"><h2>' + esc(T.prazdnoNadpis) + '</h2><p>' + esc(d.credit > 0 ? T.prazdnoKredit : T.prazdno) + '</p></div>';
    } else {
      h += '<h2 class="majitel-nadpis">' + esc(T.mojeStvorce) + '</h2>';
      for (var i = 0; i < parcely.length; i++) h += stvorecHtml(parcely[i]);
    }

    if (predplatne.length) {
      h += '<div class="majitel-predplatne"><h2>' + esc(T.predplatneNadpis) + '</h2>';
      for (var j = 0; j < predplatne.length; j++) h += predplatneHtml(predplatne[j]);
      h += '</div>';
    }
    koren.innerHTML = h;
    odovzdajMape();

    for (var k = 0; k < parcely.length; k++) ozivStvorec(parcely[k], limit);
    for (var s = 0; s < predplatne.length; s++) ozivPredplatne(predplatne[s]);
  }

  // ── Stav jedného poľa: verejné, čaká, skryté s dôvodom, prázdne ──────────
  function stavPola(pole, p) {
    var stav = pole === 'art' ? p.art_state : p[pole + '_state'];
    var dovod = p[pole + '_reason'];
    if (stav === 'hidden') {
      var text = dovod ? (JAZYK === 'sk' ? dovod.sk : dovod.en) || dovod.en || dovod.sk : '';
      return { trieda: 'skryte', html: '<b>' + esc(T.stavSkryte) + '</b>' + (text ? ' ' + esc(T.stavDovod) + esc(text) : '') + ' ' + esc(T.stavOdvolanie) };
    }
    if (pole === 'name') {
      if (!p.name) return { trieda: 'prazdne', html: esc(T.stavZiadneMeno) };
      return stav === 'queued' ? { trieda: 'caka', html: esc(T.stavCaka) } : { trieda: 'verejne', html: esc(T.stavVerejne) };
    }
    if (pole === 'link') {
      if (!p.link) return { trieda: 'prazdne', html: esc(T.stavZiadnyOdkaz) };
      if (!p.link_enabled) return { trieda: 'prazdne', html: esc(T.stavOdkazVypnuty) };
      return stav === 'queued' ? { trieda: 'caka', html: esc(T.stavCaka) } : { trieda: 'verejne', html: esc(T.stavVerejne) };
    }
    if (!stav) return { trieda: 'prazdne', html: esc(T.stavZiadnaKresba) };
    return stav === 'queued' ? { trieda: 'caka', html: esc(T.stavCakaKresba) } : { trieda: 'verejne', html: esc(T.stavVerejne) };
  }
  function ukazStav(el, s) { el.className = 'stav stav-' + s.trieda; el.innerHTML = s.html; }
  function ukazSpravu(el, trieda, text) { el.className = 'stav stav-' + trieda; el.textContent = text; }

  /**
   * Kde stvorec lezi. To iste pravidlo ako miestoHtml() na mape a ako
   * riadky_miesta() na certifikate: krajina existuje len pri susi s kodom
   * krajiny, more a uzemia bez kodu maju namiesto nej "area" a krajina sa im
   * nikdy nedoplna. Pri mori je "city" len najblizsie mesto na brehu, takze sa
   * nesmie napisat tak, akoby stvorec lezal v nom.
   */
  function miestoHtml(p) {
    if (p.terrain === 'sea') {
      return '<b>' + esc(p.area || T.more) + '</b>'
        + (p.city ? ' <span class="stvorec-blizko">' + esc(T.najblizsie) + ' ' + esc(p.city) + '</span>' : '');
    }
    var casti = [p.region && p.region !== p.city ? p.region : null,
      p.country_name || p.country || p.area].filter(Boolean).join(', ');
    if (p.city) return '<b>' + esc(p.city) + '</b>' + (casti ? ', ' + esc(casti) : '');
    return casti ? '<b>' + esc(casti) + '</b>' : '';
  }

  function stvorecHtml(p) {
    var id = p.id;
    var meta = [];
    if (p.paid_at) meta.push(esc(T.kupene) + ' ' + esc(datum(p.paid_at)));
    if (p.founder_no) meta.push(esc(T.zakladatel) + ' ' + esc(String(p.founder_no)) + ' ' + esc(T.zo100));
    if (p.kind === 'business') meta.push(esc(T.druhFirma));
    else if (p.kind === 'pack') meta.push(esc(T.druhBalik));
    var h = '<article class="stvorec" data-stvorec="' + id + '">';
    // Zamerne div, nie <header>: paper.css styluje kazdy <header> ako hlavicku webu.
    h += '<div class="stvorec-hlava"><div>';
    h += '<h3 class="stvorec-cislo">' + esc(T.cislo) + ' ' + cisloText(id) + '</h3>';
    h += '<p class="stvorec-miesto">' + miestoHtml(p) + '</p>';
    if (meta.length) h += '<p class="stvorec-meta">' + meta.join(' · ') + '</p>';
    if (p.status === 'hidden') h += '<p class="stav stav-skryte">' + esc(T.skryta) + '</p>';
    h += '</div><div class="stvorec-akcie">';
    h += '<a class="btn btn-line" href="' + esc(T.cestaMapy + '?p=' + id) + '">' + esc(T.naMape) + '</a>';
    if (p.certificate_path) h += '<button class="btn btn-line" type="button" data-certifikat>' + esc(T.certifikat) + '</button>';
    h += '</div></div>';
    h += '<p class="stav" data-stav="certifikat" role="status" hidden></p>';

    h += '<div class="stvorec-telo">';
    var k = '<div class="stvorec-kresba"><h4>' + esc(T.kresbaNadpis) + '</h4>';
    k += '<p class="pole-popis" id="kp-' + id + '">' + esc(T.kresbaPopis) + '</p>';
    k += '<div class="platno"><canvas width="' + VELKOST + '" height="' + VELKOST + '" data-platno aria-describedby="kp-' + id + '" aria-label="' + esc(T.kresbaNadpis) + '"></canvas></div>';
    k += '<div class="paleta" role="group" aria-label="' + esc(T.farba) + '">';
    for (var i = 0; i < PALETA.length; i++) k += '<button type="button" data-farba="' + i + '" aria-label="' + esc(T.farba) + ' ' + (i + 1) + '" aria-pressed="' + (i === 5) + '"></button>';
    k += '</div>';
    k += '<div class="kreslenie-ovladanie"><button type="button" data-kres="pozadie" aria-pressed="false">' + esc(T.pozadie) + '</button><button type="button" data-kres="vymazat">' + esc(T.vymazat) + '</button></div>';
    k += '<button class="btn btn-solid" type="button" data-uloz="art">' + esc(T.ulozitKresbu) + '</button>';
    k += '<p class="stav" data-stav="art" role="status"></p></div>';

    h += '<div class="stvorec-polia">';
    h += '<div class="pole"><h4><label for="meno-' + id + '">' + esc(T.menoPopis) + '</label></h4>';
    h += '<input id="meno-' + id + '" type="text" maxlength="40" autocomplete="off" data-vstup="name" placeholder="' + esc(T.menoPlaceholder) + '" value="' + esc(p.name || '') + '" aria-describedby="mn-' + id + '">';
    h += '<p class="pole-popis" id="mn-' + id + '">' + esc(T.menoNapoveda) + '</p>';
    h += '<div class="pole-akcie"><button class="btn btn-solid" type="button" data-uloz="name">' + esc(T.ulozitMeno) + '</button><button class="btn btn-line" type="button" data-zmaz="name">' + esc(T.zmazatMeno) + '</button></div>';
    h += '<p class="stav" data-stav="name" role="status"></p></div>';

    h += '<div class="pole"><h4><label for="odkaz-' + id + '">' + esc(T.odkazPopis) + '</label></h4>';
    h += '<input id="odkaz-' + id + '" type="url" inputmode="url" maxlength="200" autocomplete="off" spellcheck="false" data-vstup="link" placeholder="' + esc(T.odkazPlaceholder) + '" value="' + esc(p.link || '') + '" aria-describedby="on-' + id + '">';
    h += '<p class="pole-popis" id="on-' + id + '">' + esc(T.odkazNapoveda) + '</p>';
    h += '<div class="pole-akcie"><button class="btn btn-solid" type="button" data-uloz="link">' + esc(T.ulozitOdkaz) + '</button><button class="btn btn-line" type="button" data-zmaz="link">' + esc(T.vypnutOdkaz) + '</button></div>';
    h += '<p class="stav" data-stav="link" role="status"></p></div>';
    h += '</div>' + k + '</div></article>';
    return h;
  }

  function ozivStvorec(p, limit) {
    var el = koren.querySelector('[data-stvorec="' + p.id + '"]');
    if (!el) return;
    var stavy = {};
    ['name', 'link', 'art', 'certifikat'].forEach(function (k) { stavy[k] = el.querySelector('[data-stav="' + k + '"]'); });
    ukazStav(stavy.name, stavPola('name', p));
    ukazStav(stavy.link, stavPola('link', p));

    /** Spoločné zakončenie každého uloženia: čo povedať pri ktorej odpovedi. */
    function poUlozeni(v, pole, tlacidlo, text, priUspechu) {
      tlacidlo.disabled = false;
      tlacidlo.textContent = text;
      if (v.kod === 200 && v.d.ok) { priUspechu(v.d); ukazStav(stavy[pole], stavPola(pole, p)); return; }
      if (v.kod === 401) { ukazSpravu(stavy[pole], 'skryte', T.neplatnyPocasPrace); return; }
      if (v.kod === 429) { ukazSpravu(stavy[pole], 'skryte', T.limitKresieb.replace('{n}', String(limit))); return; }
      // 400 s dôvodom je odpoveď filtra (zakázané slovo, http namiesto https…):
      // služba ju posiela v oboch jazykoch a je presnejšia než čokoľvek odtiaľto.
      var s = v.kod === 400 ? spravaSluzby(v.d) : '';
      ukazSpravu(stavy[pole], 'skryte', s || T.chybaUlozenia);
    }
    function uloz(pole, tlacidlo, data, priUspechu) {
      var text = tlacidlo.textContent;
      tlacidlo.disabled = true;
      tlacidlo.textContent = T.ukladam;
      data.parcel_id = p.id;
      volaj('/api/owner/' + pole, data).then(function (v) { poUlozeni(v, pole, tlacidlo, text, priUspechu); });
    }

    // Meno
    var meno = el.querySelector('[data-vstup="name"]');
    var ulozMeno = el.querySelector('[data-uloz="name"]');
    ulozMeno.addEventListener('click', function () {
      var hodnota = meno.value.trim();
      uloz('name', ulozMeno, { name: hodnota }, function (d) { p.name = hodnota || null; p.name_state = d.state || 'ok'; p.name_reason = null; });
    });
    el.querySelector('[data-zmaz="name"]').addEventListener('click', function () {
      var t = this;
      uloz('name', t, { name: '' }, function () { p.name = null; p.name_state = 'ok'; p.name_reason = null; meno.value = ''; });
    });
    meno.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); ulozMeno.click(); } });

    // Odkaz
    var odkaz = el.querySelector('[data-vstup="link"]');
    var ulozOdkaz = el.querySelector('[data-uloz="link"]');
    ulozOdkaz.addEventListener('click', function () {
      var hodnota = odkaz.value.trim();
      uloz('link', ulozOdkaz, { link: hodnota }, function (d) { p.link = hodnota; p.link_state = d.state || 'queued'; p.link_enabled = true; p.link_reason = null; });
    });
    el.querySelector('[data-zmaz="link"]').addEventListener('click', function () {
      var t = this;
      uloz('link', t, { enabled: false }, function () { p.link_enabled = false; });
    });
    odkaz.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); ulozOdkaz.click(); } });

    // Certifikát: kľúč ide v hlavičke a PDF sa uloží z pamäte, takže sa kľúč
    // nedostane do adresy ani do histórie sťahovania. Tá istá cesta sa spustí
    // tlačidlom aj sama, keď človek príde z e-mailu s &cert=ID v adrese.
    var cert = el.querySelector('[data-certifikat]');
    if (cert) cert.addEventListener('click', function () { stiahniCertifikat(p, cert, stavy.certifikat, false); });
    if (cert && CERT && CERT === p.id) stiahniCertifikat(p, cert, stavy.certifikat, true);

    kreslenie(el, p, stavy.art, uloz);
  }

  /**
   * Stiahnutie certifikátu. `sam` je príchod z e-mailu: vtedy sa o tom napíše
   * veta, lebo sťahovanie, ktoré sa spustí bez kliknutia, inak vyzerá ako nič.
   * Keby prehliadač také sťahovanie zastavil, tlačidlo pri štvorci ostáva.
   */
  function stiahniCertifikat(p, tlacidlo, stavEl, sam) {
    var text = tlacidlo ? tlacidlo.textContent : '';
    if (tlacidlo) { tlacidlo.disabled = true; tlacidlo.textContent = T.ukladam; }
    if (sam) { stavEl.hidden = false; ukazSpravu(stavEl, 'caka', T.certifikatSam); } else { stavEl.hidden = true; }
    return fetch(API + p.certificate_path, { headers: { 'X-Svet-Token': KLUC }, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' })
      .then(function (o) { if (!o.ok) throw new Error('stav ' + o.status); return o.blob(); })
      .then(function (blob) {
        var adresa = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = adresa;
        a.download = T.certifikatSubor + p.id + '.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(adresa); }, 60000);
        if (sam) ukazSpravu(stavEl, 'verejne', T.certifikatHotovo);
      })
      .catch(function () { stavEl.hidden = false; ukazSpravu(stavEl, 'skryte', T.certifikatChyba); })
      .then(function () { if (tlacidlo) { tlacidlo.disabled = false; tlacidlo.textContent = text; } });
  }

  // ── Kreslenie 32 × 32, prstom aj myšou ───────────────────────────────────
  function kreslenie(el, p, stavEl, uloz) {
    var platno = el.querySelector('[data-platno]');
    var ctx = platno.getContext('2d');
    var body = new Uint8Array(BODOV);
    var zoSluzby = p.art_pixels && p.art_pixels.length === BODOV ? p.art_pixels : null;
    var i;
    if (zoSluzby) for (i = 0; i < BODOV; i++) body[i] = zoSluzby[i] & 15;
    // Rozkreslená kresba prežije obnovenie stránky. Je to len pohodlie v tomto
    // prehliadači: čo platí, je to, čo je uložené v službe.
    var kluc = 'svet-panel-kresba-' + p.id, neulozene = false;
    try {
      var rozpis = localStorage.getItem(kluc);
      if (rozpis && rozpis.length === BODOV) {
        for (i = 0; i < BODOV; i++) { var v = parseInt(rozpis.charAt(i), 16); body[i] = isNaN(v) ? POZADIE : v; }
        neulozene = true;
      }
    } catch (e) {}

    var svatky = el.querySelectorAll('[data-farba]');
    for (i = 0; i < svatky.length; i++) svatky[i].style.background = PALETA[i];
    var gumaEl = el.querySelector('[data-kres="pozadie"]');
    var farba = 5;

    function prekresli() {
      for (var j = 0; j < BODOV; j++) {
        ctx.fillStyle = PALETA[body[j]] || PALETA[POZADIE];
        ctx.fillRect(j % VELKOST, (j / VELKOST) | 0, 1, 1);
      }
    }
    function oznacStav() {
      if (neulozene) ukazSpravu(stavEl, 'caka', T.neulozene);
      else ukazStav(stavEl, stavPola('art', p));
    }
    function zmenene() {
      neulozene = true;
      var s = '';
      for (var j = 0; j < BODOV; j++) s += body[j].toString(16);
      try { localStorage.setItem(kluc, s); } catch (e) {}
      oznacStav();
    }
    prekresli();
    oznacStav();

    function bod(e) {
      var r = platno.getBoundingClientRect();
      return {
        x: Math.min(VELKOST - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * VELKOST))),
        y: Math.min(VELKOST - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * VELKOST))),
      };
    }
    function nanes(x, y) {
      body[y * VELKOST + x] = farba;
      ctx.fillStyle = PALETA[farba];
      ctx.fillRect(x, y, 1, 1);
    }
    // Prst aj myš posielajú pri rýchlom ťahu body ďaleko od seba. Čiara medzi
    // nimi sa dokreslí, inak by ťah ostal bodkovaný.
    function ciara(a, b) {
      var dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y), sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1;
      var chyba = dx - dy, x = a.x, y = a.y;
      for (var poistka = 0; poistka < 128; poistka++) {
        nanes(x, y);
        if (x === b.x && y === b.y) break;
        var e2 = 2 * chyba;
        if (e2 > -dy) { chyba -= dy; x += sx; }
        if (e2 < dx) { chyba += dx; y += sy; }
      }
    }
    var posledny = null;
    platno.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      e.preventDefault();
      try { platno.setPointerCapture(e.pointerId); } catch (err) {}
      posledny = bod(e);
      nanes(posledny.x, posledny.y);
    });
    platno.addEventListener('pointermove', function (e) {
      if (!posledny) return;
      var b = bod(e);
      if (b.x === posledny.x && b.y === posledny.y) return;
      ciara(posledny, b);
      posledny = b;
    });
    function koniec() { if (posledny) { posledny = null; zmenene(); } }
    platno.addEventListener('pointerup', koniec);
    platno.addEventListener('pointercancel', koniec);

    function vyberFarbu(index, guma) {
      farba = index;
      for (var j = 0; j < svatky.length; j++) svatky[j].setAttribute('aria-pressed', String(!guma && j === index));
      gumaEl.setAttribute('aria-pressed', String(!!guma));
    }
    el.querySelector('.paleta').addEventListener('click', function (e) {
      var b = e.target.closest('[data-farba]');
      if (b) vyberFarbu(Number(b.getAttribute('data-farba')), false);
    });
    gumaEl.addEventListener('click', function () { vyberFarbu(POZADIE, true); });
    el.querySelector('[data-kres="vymazat"]').addEventListener('click', function () {
      for (var j = 0; j < BODOV; j++) body[j] = POZADIE;
      prekresli();
      zmenene();
    });

    var ulozTlacidlo = el.querySelector('[data-uloz="art"]');
    ulozTlacidlo.addEventListener('click', function () {
      var pixely = new Array(BODOV);
      for (var j = 0; j < BODOV; j++) pixely[j] = body[j];
      uloz('art', ulozTlacidlo, { pixels: pixely }, function (d) {
        p.art_state = d.state || 'queued';
        p.art_reason = null;
        p.art_pixels = pixely;
        neulozene = false;
        try { localStorage.removeItem(kluc); } catch (e) {}
      });
    });
  }

  // ── Firemné predplatné: zrušenie jedným klikom ───────────────────────────
  function predplatneHtml(s) {
    var stav = (T.stavyPredplatneho && T.stavyPredplatneho[s.status]) || s.status || '';
    var h = '<div class="predplatne" data-predplatne="' + esc(s.id) + '">';
    h += '<p><b>' + esc(T.predplatneStvorec) + ' ' + cisloText(s.parcel_id) + '</b></p>';
    h += '<dl class="list-udaje"><div><dt>' + esc(T.predplatneStav) + '</dt><dd data-stav-predplatneho>' + esc(stav) + '</dd></div>';
    if (s.period_end) h += '<div><dt>' + esc(T.predplatneDo) + '</dt><dd>' + esc(datum(s.period_end)) + '</dd></div>';
    h += '</dl>';
    if (s.status === 'active') {
      h += '<p class="pole-popis">' + esc(T.zrusitPopis) + '</p>';
      h += '<button class="btn btn-line" type="button" data-zrus>' + esc(T.zrusit) + '</button>';
    }
    h += '<p class="stav" data-stav="predplatne" role="status" hidden></p></div>';
    return h;
  }
  function ozivPredplatne(s) {
    var el = null, vsetky = koren.querySelectorAll('[data-predplatne]');
    for (var i = 0; i < vsetky.length; i++) if (vsetky[i].getAttribute('data-predplatne') === String(s.id)) el = vsetky[i];
    var tlacidlo = el && el.querySelector('[data-zrus]');
    if (!tlacidlo) return;
    var stavEl = el.querySelector('[data-stav="predplatne"]');
    tlacidlo.addEventListener('click', function () {
      tlacidlo.disabled = true;
      tlacidlo.textContent = T.rusim;
      volaj('/api/owner/cancel', { subscription_id: s.id }).then(function (v) {
        stavEl.hidden = false;
        if (v.kod === 200 && v.d.ok) {
          s.status = 'cancel_at_period_end';
          el.querySelector('[data-stav-predplatneho]').textContent = T.stavyPredplatneho.cancel_at_period_end;
          tlacidlo.remove();
          ukazSpravu(stavEl, 'verejne', T.zrusene);
          return;
        }
        tlacidlo.disabled = false;
        tlacidlo.textContent = T.zrusit;
        // Chybové vety služby (502 zo Stripe) sú len po slovensky a bez diakritiky;
        // anglický panel by ich ukázal tak, ako sú. Veta je preto odtiaľto.
        ukazSpravu(stavEl, 'skryte', v.kod === 401 ? T.neplatnyPocasPrace : T.zrusenieChyba);
      });
    });
  }

  window.addEventListener('hashchange', nacitaj);
  nacitaj();
})();
