/* The World in Squares: prehliadač mapy.
   Zdroj: ops/svet/svet.js, do hubu ho kopíruje ops/svet/postav.mjs. Neupravovať v produkte.

   Požiadavka vlastníka: mapa má byť krásna, presná a nesekavá, s hranicami všade.
   Preto:
     · jeden canvas, žiadna knižnica (knižnica by aj tak neprešla prísnym CSP hubu),
     · podklad je vektor z Natural Earth v troch úrovniach podrobnosti; sťahujú sa
       len dlaždice vo výreze a každá sa raz prevedie na Path2D, ktoré sa potom
       len posúva a škáluje transformáciou plátna,
     · pobrežie a hranice štátov sa kreslia AŽ NAD predanými štvorcami, ako svetlé
       jadro s tmavým lemom: mapa sa dá čítať aj vtedy, keď je predaný celý svet
       (čísla kontrastu voči všetkým šestnástim farbám sú v ops/svet/hranice.md),
     · jedna slučka requestAnimationFrame s dirty príznakom, nekreslí sa do prázdna;
       zotrvačnosť, plynulé priblíženie aj prelet bežia v tej istej slučke,
     · kreslí sa v zariadeniových pixeloch, devicePixelRatio zastropovaný na 2,
     · keď snímky pri ťahaní nestíhajú, podklad sa vykreslí raz do zásobného plátna
       s okrajom a pri posune sa len prekladá,
     · mriežka sa kreslí ako jedna cesta a až keď má bunka aspoň 6 px.

   Mapa je v Mercatore. Nie z módy: naša bunka je na zemi štvorec asi 10 × 10 km a
   Mercator je konformný, takže štvorec na zemi je štvorec aj na obrazovke, v každom
   priblížení a na každej šírke.

   Keď homelab nebeží, mapa sa načíta celá a hore je úprimný pás. Žiadne nekonečné
   kolečko a žiadne tvrdenie, že sa dá kúpiť, keď sa nedá.
   Ladenie: ?debug=1 vypíše čas kreslenia snímky, ?debug=2 navyše spraví meraný posun. */
(function () {
  'use strict';

  var telo = document.body;
  var T = {};
  try { T = JSON.parse(document.getElementById('svet-texty').textContent); } catch (e) { return; }

  var API = telo.getAttribute('data-api') || '';
  var ZAKLAD = telo.getAttribute('data-zaklad') || './';
  var JAZYK = telo.getAttribute('data-jazyk') || 'en';
  var CESTA_MAPY = telo.getAttribute('data-mapa') || './';

  // ── Spoločné pomôcky. Používa ich mapa, stránka parcely aj rebríček. ─────
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]; }); }
  function cisloText(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function km(x) { return x.toFixed(2); }
  function stupne(lat, lon) {
    return Math.abs(lat).toFixed(3) + '° ' + (lat >= 0 ? T.sever : T.juh) + ', '
      + Math.abs(lon).toFixed(3) + '° ' + (lon >= 0 ? T.vychod : T.zapad);
  }
  /**
   * Meno miesta. Krajina existuje len pri súši s kódom krajiny: more, Antarktída a
   * územia bez kódu majú namiesto nej pole area a krajina sa k nim nikdy nedopĺňa.
   * Pri mori je mesto len najbližšie mesto na brehu, preto sa píše zvlášť.
   */
  function miestoHtml(p) {
    if (!p) return '';
    var krajina = p.country_name || p.country || '';
    if (p.terrain === 'sea') {
      return '<b>' + esc(p.area || T.more) + '</b>' + (p.city ? '<span class="list-blizko">' + esc(T.najblizsie) + ' ' + esc(p.city) + '</span>' : '');
    }
    var casti = [p.region && p.region !== p.city ? p.region : null, krajina || p.area].filter(Boolean);
    if (p.city) return '<b>' + esc(p.city) + '</b>' + (casti.length ? ', ' + esc(casti.join(', ')) : '');
    return casti.length ? '<b>' + esc(casti.join(', ')) + '</b>' : '';
  }
  /**
   * Umami. Návšteva, klik na bunku, otvorenie pokladne a návrat z nej sa merajú
   * oddelene; platbu samotnú vidí len služba cez webhook, stránka ju nemeria.
   * Tento skript beží pred skriptom Umami (oba sú defer, náš je v hlave prvý),
   * takže prvé udalosti počkajú na načítanie stránky.
   */
  var cakajuceUdalosti = [];
  function sleduj(meno) {
    try {
      if (window.umami && window.umami.track) { window.umami.track(meno); return; }
    } catch (e) { return; }
    if (cakajuceUdalosti.push(meno) > 1) return;
    window.addEventListener('load', function () {
      var f = cakajuceUdalosti; cakajuceUdalosti = [];
      try { if (window.umami && window.umami.track) f.forEach(function (m) { window.umami.track(m); }); } catch (e) {}
    }, { once: true });
  }
  /** Volanie homelabu. Keď nebeží, sľub sa odmietne a stránka to povie nahlas. */
  function api(cesta, data) {
    if (!API) return Promise.reject(new Error('bez api'));
    var nast = { credentials: 'omit' };
    if (data) { nast.method = 'POST'; nast.headers = { 'Content-Type': 'application/json' }; nast.body = JSON.stringify(data); }
    return fetch(API + cesta, nast).then(function (o) {
      if (o.ok) return o.json();
      // Chyba nesie aj dôvod zo služby ({"reason": …}): 403 môže byť cudzí držiak
      // aj vypnutý testovací režim a človek má dostať vetu k tomu, čo sa naozaj stalo.
      // Vety služby sa nezobrazujú, len jej kódy: stránka má na každý vlastnú vetu.
      return o.json().catch(function () { return {}; }).then(function (d) {
        var chyba = new Error('stav ' + o.status);
        chyba.dovod = (d && d.reason) || '';
        chyba.obsadene = (d && Array.isArray(d.parcel_ids)) ? d.parcel_ids.map(Number) : null;
        throw chyba;
      });
    });
  }
  function kodChyby(chyba) { var k = chyba && /stav (\d+)/.exec(chyba.message || ''); return k ? Number(k[1]) : 0; }
  /** Vlastný držiak neplatí. To nie je „niekto bol rýchlejší“; či áno, ukáže až nová rezervácia. */
  function vlastnyDrziakNeplati(chyba) {
    var kod = kodChyby(chyba), d = chyba && chyba.dovod;
    return (kod === 409 && (d === 'expired' || d === 'not-reserved')) || (kod === 403 && d === 'wrong-hold');
  }

  // ── Mriežka. Tie isté čísla ako ops/svet/mriezka.mjs. ────────────────────
  var RIADKY = 2000, RIADOK = 180 / RIADKY, KS = 4000;
  var PRED = new Float64Array(RIADKY + 1);
  var STL = new Int32Array(RIADKY);
  (function () {
    for (var r = 0; r < RIADKY; r++) {
      STL[r] = Math.max(1, Math.round(KS * Math.cos(((90 - (r + 0.5) * RIADOK) * Math.PI) / 180)));
      PRED[r + 1] = PRED[r] + STL[r];
    }
  })();
  var A = 6378.137, E2 = 0.00669437999014133, RAD = Math.PI / 180;
  function stredRiadku(r) { return 90 - (r + 0.5) * RIADOK; }
  function sirkaKm(r) {
    var fi = stredRiadku(r) * RAD, si = Math.sin(fi);
    return (2 * Math.PI * (A / Math.sqrt(1 - E2 * si * si)) * Math.cos(fi)) / STL[r];
  }
  function vyskaKm(r) {
    var fi = stredRiadku(r) * RAD, si = Math.sin(fi);
    return ((A * (1 - E2)) / Math.pow(1 - E2 * si * si, 1.5)) * RIADOK * RAD;
  }
  function riadokZoSirky(lat) { return Math.min(RIADKY - 1, Math.max(0, Math.floor((90 - lat) / RIADOK))); }
  function stlpecZDlzky(r, lon) {
    var n = STL[r], x = (((lon + 180) % 360) + 360) % 360;
    return Math.min(n - 1, Math.floor((x / 360) * n));
  }
  function cislo(r, c) { return PRED[r] + c; }
  function zCisla(id) {
    if (!isFinite(id) || id < 0 || id >= PRED[RIADKY]) return null;
    var lo = 0, hi = RIADKY - 1, mid;
    while (lo < hi) { mid = (lo + hi + 1) >> 1; if (PRED[mid] <= id) lo = mid; else hi = mid - 1; }
    return { r: lo, c: id - PRED[lo] };
  }

  // ── Mercator ─────────────────────────────────────────────────────────────
  // Svet je štvorec: dĺžka ±180 a Mercatorova súradnica ±180 (šírka ±85,0511°).
  var MERC = 85.05112877980659, Y_SVETA = 180;
  function doY(lat) {
    var f = lat > MERC ? MERC : lat < -MERC ? -MERC : lat;
    return (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (f * Math.PI) / 360));
  }
  function zY(y) { return (360 / Math.PI) * Math.atan(Math.exp((y * Math.PI) / 180)) - 90; }

  // ── Mapa ─────────────────────────────────────────────────────────────────
  function mapaSveta(koren) {
  var platno = koren.querySelector('canvas');
  var ctx = platno.getContext('2d', { alpha: false });
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var S = {
    lon: 10, my: doY(25), s: 1,        // s je v zariadeniových pixeloch na stupeň dĺžky
    w: 0, h: 0, stredX: 0, stredY: 0, volnaVyska: 0,
    vybrana: null, podKurzorom: null,
    sluzba: 'neznama', stav: null,
    vyberOd: 0,
  };
  var POKOJ = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Návrat z pokladne Stripe: ?paid=1&session_id=… alebo ?cancelled=1. Značky sa
  // prečítajú a hneď z adresy zmiznú, ešte skôr než sa spustí Umami (tento skript
  // je v hlave pred ním): číslo platobnej relácie nemá čo robiť v štatistike
  // návštev a obnovenie stránky nemá ďakovať druhý raz.
  var parametre = new URLSearchParams(location.search);
  // Skúšobný nákup: ?test=1 v adrese. Pokladňa si potom od služby pýta testovací
  // režim Stripe (testovací kľúč a testovaciu cenu) a povie to aj človeku.
  var TEST = parametre.get('test') === '1';
  var LADENIE = Number(parametre.get('debug')) || 0;
  // Balík sa kupuje bez štvorca, takže návrat z jeho pokladne nemá ?p= a nesmie
  // tvrdiť, že nejaký štvorec čaká alebo že je váš.
  var navratBezStvorca = !Number(parametre.get('p'));
  var navratZPokladne = parametre.get('paid') ? 'paid' : parametre.get('cancelled') ? 'cancelled' : '';
  // Košík sa z pokladne vracia s &kosik=N (app.py). Bez toho by mapa po kúpe
  // štyroch štvorcov hovorila „this square“ o jednom z nich.
  var kosikNavrat = Math.max(0, Math.min(10, Math.floor(Number(parametre.get('kosik')) || 0)));

  // ── Kreslenie hneď po platbe ─────────────────────────────────────────────
  // Z čísla platobnej relácie (?session_id=) vydá služba kľúč do panela
  // (/api/owner/session-link), bez čakania na e-mail. Číslo žije LEN v
  // sessionStorage tejto karty: nie v adrese (Umami, história), nie v
  // localStorage. ids: štvorce z ?p= a košíka, potvrdí ich služba (potvrdPlatbu).
  var poPlatbe = { session: '', panel: '', stvorec: 0, kusov: 0, ids: [] };
  function ulozPoPlatbe() {
    try {
      sessionStorage.setItem('svet-po-platbe', JSON.stringify({ s: poPlatbe.session, u: poPlatbe.panel, p: poPlatbe.stvorec, n: poPlatbe.kusov, i: poPlatbe.ids }));
    } catch (e) {}
  }
  function cislaZoZoznamu(z) {
    return (Array.isArray(z) ? z : []).map(Number).filter(function (x) { return x > 0; }).slice(0, 10);
  }
  try {
    var ulozenaPlatba = JSON.parse(sessionStorage.getItem('svet-po-platbe') || 'null');
    if (ulozenaPlatba && typeof ulozenaPlatba === 'object') {
      poPlatbe.session = String(ulozenaPlatba.s || '');
      poPlatbe.panel = String(ulozenaPlatba.u || '');
      poPlatbe.stvorec = Number(ulozenaPlatba.p) || 0;
      poPlatbe.kusov = Number(ulozenaPlatba.n) || 0;
      poPlatbe.ids = cislaZoZoznamu(ulozenaPlatba.i);
    }
  } catch (e) {}
  if (navratZPokladne === 'paid' && parametre.get('session_id')) {
    var kandidati = [];
    try { if (kosikNavrat > 1) kandidati = cislaZoZoznamu(JSON.parse(sessionStorage.getItem('svet-kosik-ids') || '[]')); } catch (e) {}
    var zAdresy = Number(parametre.get('p')) || 0;
    if (zAdresy && kandidati.indexOf(zAdresy) < 0) kandidati.unshift(zAdresy);
    poPlatbe = { session: String(parametre.get('session_id')), panel: '', stvorec: zAdresy, kusov: kosikNavrat, ids: kandidati.slice(0, 10) };
    ulozPoPlatbe();
  }

  if (navratZPokladne || parametre.get('session_id')) {
    var cista = new URL(location.href);
    ['paid', 'cancelled', 'session_id', 'kosik'].forEach(function (k) { cista.searchParams.delete(k); });
    history.replaceState(null, '', cista);
    sleduj(navratZPokladne === 'paid' ? 'svet_navrat_z_pokladne' : 'svet_pokladna_zrusena');
  }

  // Paleta webu: more je presne pozadie stránky, súš o stupeň svetlejšia.
  //
  // POBREŽIE A HRANICE SÚ SVETLÉ A MAJÚ TMAVÝ LEM. Nie je to móda. Tieto tri
  // čiary sa kreslia NAD predanými štvorcami (kresliHranice) a pod nimi môže
  // ležať ktorákoľvek zo šestnástich farieb kresby, od takmer čiernej #10100e po
  // takmer bielu #f2ece2. Jedna farba čiary sa na oboch naraz stratiť musí, dve
  // nie: na tmavom pozadí nesie čitateľnosť svetlé jadro, na svetlom tmavý lem.
  // Čísla sú spočítané v ops/svet/hranice.md a stráži ich test (najhoršia
  // šestnástina má kontrast 3,4 : 1, hranica WCAG 1.4.11 je 3 : 1).
  //
  // Čiary sú nepriehľadné farby, nie alfa: kde sa na okraji dlaždíc stretnú dva
  // konce, nevznikne svetlejšia bodka.
  var FARBY = {
    more: '#0a0908', sus: '#1b1714', kraj: '#332c27',
    lem: '#070606', pobrezie: '#e9c9a8', breh: '#c3ccd2', hranica: '#cfc6bd',
    stat: '#978f86', mesto: '#ddd7d0', bod: '#f2643c', voda: '#6f675f',
    mriezka: 'rgba(255,255,255,', vyber: '#ffd9c9',
    predane: 'rgba(242,100,60,.85)', rezervovane: 'rgba(242,100,60,.32)', moje: 'rgba(255,217,201,.92)',
  };
  /**
   * Čiary, ktoré sa kreslia nad vlastníctvom: [kľúč cesty, jadro, šírka pri
   * celom svete, šírka po priblížení, čiarkovaná]. Poradie je poradie kreslenia,
   * takže pobrežie je navrchu.
   */
  var HRANICE = [
    ['j', 'breh', 0.8, 0.8, false],
    ['d', 'hranica', 0.9, 0.9, true],
    ['b', 'hranica', 0.8, 1.1, false],
    ['c', 'pobrezie', 0.95, 1.15, false],
  ];
  // O koľko je lem širší než jadro (v CSS pixeloch, teda pol toho na každú
  // stranu). Pri celom svete je tenší, inak by z pobrežia bol pás.
  var LEM = 1.6, LEM_SVET = 1;
  // Stavy bunky v /api/chunk, jeden bajt na bunku. Tie isté čísla ako ST_* v
  // products/svet/mriezka.py: 0 zatvorené (pri predaji celého sveta sa nevyskytuje),
  // 1 voľné, 2 práve v pokladni, 3 až 7 zaplatené.
  var ST_VOLNE = 1, ST_REZERVOVANE = 2, ST_PREDANE = 3;

  // ── Prevody obrazovka a svet ─────────────────────────────────────────────
  // Stred pohľadu nie je stred plátna. List s vybranou bunkou je na telefóne
  // spodný hárok, takže by inak bola vybraná bunka pod ním.
  function naX(lon) { return (lon - S.lon) * S.s + S.stredX; }
  function naY(my) { return (S.my - my) * S.s + S.stredY; }
  function zX(x) { return S.lon + (x - S.stredX) / S.s; }
  function zYObr(y) { return S.my - (y - S.stredY) / S.s; }

  function prepocitajStred() {
    S.stredX = S.w / 2; S.stredY = S.h / 2; S.volnaVyska = S.h;
    if (!list || list.hidden) return;
    var r = list.getBoundingClientRect(), m = platno.getBoundingClientRect();
    if (!r.width || !m.width) return;
    if (r.width > m.width * 0.8) {           // spodný hárok na telefóne
      S.volnaVyska = Math.max(S.h * 0.42, Math.min(S.h, (r.top - m.top) * dpr));
      S.stredY = S.volnaVyska / 2;
    }
  }

  /**
   * Najmenšie priblíženie je to, pri ktorom sa do okna zmestí celý svet, na šírku
   * aj na výšku; do strán sa svet opakuje. Najväčšie má bunku 220 px.
   */
  function medze() {
    var r = riadokZoSirky(zY(S.my));
    return { minS: Math.max(0.2, Math.min(S.w / 360, S.h / (2 * Y_SVETA))), maxS: 220 / (360 / STL[r]) };
  }
  function uprav() {
    var m = medze();
    if (S.s < m.minS) S.s = m.minS;
    if (S.s > m.maxS) S.s = m.maxS;
    // Okraj sveta nesmie vojsť do okna, kým je svet vyšší než okno. Keď je nižší
    // (telefón na výšku pri celom svete), smie sa v okne posúvať, ale nie z neho von.
    var lo = (S.h - S.stredY) / S.s - Y_SVETA, hi = Y_SVETA - S.stredY / S.s;
    S.my = lo > hi ? Math.min(lo, Math.max(hi, S.my)) : Math.min(hi, Math.max(lo, S.my));
    S.lon = (((S.lon + 180) % 360) + 360) % 360 - 180;
    naplanujBloky();
  }

  // ── Vektorový podklad ────────────────────────────────────────────────────
  // Index dlaždíc príde v mriezka.json. Dlaždica je JSON s celými číslami: prvý bod
  // tvaru a potom rozdiely, v jednotkách úrovne od ľavého horného rohu dlaždice.
  var POD = null, DL = {}, snimokC = 0, PRAZDNA = { ok: true }, nacitaneV = 0;
  function cestaZ(zoznam, zavri) {
    var p = new Path2D();
    for (var i = 0; i < zoznam.length; i++) {
      var a = zoznam[i], x = a[0], y = a[1];
      p.moveTo(x, y);
      for (var k = 2; k < a.length; k += 2) { x += a[k]; y += a[k + 1]; p.lineTo(x, y); }
      if (zavri) p.closePath();
    }
    return p;
  }
  /** Hotová dlaždica, alebo null, kým sa sťahuje. S lenHotove sa nič nové nepýta. */
  function dlazdicaV(z, i, j, lenHotove) {
    var u = POD.urovne[z];
    if (!POD.ma[z][j * u.n + i]) return PRAZDNA;   // otvorené more, súbor neexistuje
    var meno = z + '/' + i + '_' + j, d = DL[meno];
    if (d) { d.pouzita = snimokC; return d.ok ? d : null; }
    if (lenHotove) return null;
    DL[meno] = d = { ok: false, pouzita: snimokC };
    fetch(ZAKLAD + 'map/' + meno + '.json?v=' + POD.v, { cache: 'force-cache' })
      .then(function (o) { if (!o.ok) throw 0; return o.json(); })
      .then(function (g) {
        ['l', 'k'].forEach(function (v) { if (g[v]) d[v] = cestaZ(g[v], true); });
        ['c', 'j', 'b', 'd', 'a'].forEach(function (v) { if (g[v]) d[v] = cestaZ(g[v], false); });
        d.p = g.p; d.n = g.n; d.s = g.s;
        d.ok = true;
        nacitaneV = performance.now();
        upratDlazdice();
        kes.plati = false;
        ziadaj();
      })
      .catch(function () { setTimeout(function () { delete DL[meno]; ziadaj(); }, 5000); });
    return null;
  }
  /** V pamäti ostáva najviac 72 dlaždíc; zahadzujú sa tie, ktoré sa najdlhšie nekreslili. */
  function upratDlazdice() {
    var kluce = Object.keys(DL);
    if (kluce.length <= 72) return;
    kluce.sort(function (a, b) { return DL[a].pouzita - DL[b].pouzita; });
    for (var i = 0; i < kluce.length - 72; i++) if (kluce[i] !== '0/0_0') delete DL[kluce[i]];
  }

  /** Úroveň podrobnosti pre dané priblíženie. */
  function urovenPre(s) { return s >= POD.urovne[2].od ? 2 : s >= POD.urovne[1].od ? 1 : 0; }

  /**
   * Čo sa má nakresliť pre pohľad V: dlaždice úrovne z vo výreze. Kým sa jemnejšia
   * sťahuje, kreslí sa na jej mieste hrubšia, orezaná na jej obdĺžnik, takže mapa
   * nikdy nezmizne a nikdy nie sú cez seba dve rôzne pobrežia.
   */
  function kusyPre(V, z) {
    var u = POD.urovne[z], D = 360 / u.n, von = [];
    var lonOd = V.lon - V.cx / V.s, lonDo = V.lon + (V.w - V.cx) / V.s;
    var yHore = Math.min(Y_SVETA, V.my + V.cy / V.s), yDole = Math.max(-Y_SVETA, V.my - (V.h - V.cy) / V.s);
    if (yHore <= yDole) return von;
    var jOd = Math.max(0, Math.floor((Y_SVETA - yHore) / D)), jDo = Math.min(u.n - 1, Math.floor((Y_SVETA - yDole) / D));
    for (var iu = Math.floor((lonOd + 180) / D); iu <= Math.floor((lonDo + 180) / D); iu++) {
      var i = ((iu % u.n) + u.n) % u.n, posun = (iu - i) * D;
      for (var j = jOd; j <= jDo; j++) {
        var zz = z, ii = i, jj = j, d = dlazdicaV(z, i, j, false), orez = null;
        while (!d && zz > 0) {
          orez = orez || [(-180 + i * D + posun - V.lon) * V.s + V.cx, (V.my - (Y_SVETA - j * D)) * V.s + V.cy, D * V.s, D * V.s];
          var pomer = POD.urovne[zz].n / POD.urovne[zz - 1].n;
          zz--; ii = Math.floor(ii / pomer); jj = Math.floor(jj / pomer);
          d = dlazdicaV(zz, ii, jj, zz > 0);
        }
        if (!d || d === PRAZDNA) continue;
        var uu = POD.urovne[zz], DD = 360 / uu.n;
        von.push({
          d: d, q: uu.q, k: V.s / uu.q, orez: orez, hruba: zz !== z,
          x0: -180 + ii * DD + posun, y0: Y_SVETA - jj * DD,
          tx: (-180 + ii * DD + posun - V.lon) * V.s + V.cx, ty: (V.my - (Y_SVETA - jj * DD)) * V.s + V.cy,
        });
      }
    }
    return von;
  }

  /** Jedna vrstva cez všetky dlaždice: najprv všetky výplne, potom všetky čiary, aby lem susednej dlaždice neprekryl čiaru. */
  function vrstva(c, kusy, co, farba, hrubka, ciarky) {
    if (hrubka) { c.strokeStyle = farba; c.lineJoin = 'round'; c.lineCap = ciarky ? 'butt' : 'round'; } else c.fillStyle = farba;
    for (var i = 0; i < kusy.length; i++) {
      var ks = kusy[i], p = ks.d[co];
      if (!p) continue;
      if (ks.orez) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.beginPath(); c.rect(ks.orez[0], ks.orez[1], ks.orez[2], ks.orez[3]); c.clip(); }
      c.setTransform(ks.k, 0, 0, ks.k, ks.tx, ks.ty);
      if (hrubka) {
        c.lineWidth = (hrubka * dpr) / ks.k;
        c.setLineDash(ciarky ? [(5 * dpr) / ks.k, (4 * dpr) / ks.k] : []);
        c.stroke(p);
      } else c.fill(p);
      if (ks.orez) c.restore();
    }
    c.setLineDash([]);
  }

  var pismoNacitane = false;
  /**
   * Plochy podkladu: súš, vnútorné vody a kraje. Len toto ide POD vlastníctvo,
   * a len toto sa preto smie odložiť do zásobného plátna. Kraje (admin 1) sú
   * ozdoba, nie geografia: pri plnej mape sa pod štvorcami stratia a je to tak
   * správne, lebo inak by hranice štátov nemali čím vyniknúť.
   */
  function kresliPodklad(c, V) {
    var z = urovenPre(V.s), kusy = kusyPre(V, z);
    vrstva(c, kusy, 'l', FARBY.sus, 0);
    vrstva(c, kusy, 'k', FARBY.more, 0);
    if (z > 0) vrstva(c, kusy, 'a', FARBY.kraj, z > 1 ? 0.8 : 0.6);
    c.setTransform(1, 0, 0, 1, 0, 0);
    return kusy;
  }

  /**
   * Pobrežie, brehy vnútorných vôd a hranice štátov. KRESLÍ SA AŽ NAD PREDANÝMI
   * ŠTVORCAMI, aby sa mapa dala čítať aj vtedy, keď je predaných sto percent.
   * Predtým sa kreslili v podklade a stačilo pár tisíc predaných štvorcov, aby
   * pod nimi zmizlo pobrežie; majiteľ sa 22. 9. 2026 pýtal presne na to.
   *
   * Každá čiara má dva ťahy: najprv o 1,6 px širší tmavý lem, potom svetlé
   * jadro. Nie je to obrys navrchu, ktorý by prekryl kresby ľudí: lem aj jadro
   * sú tenké a spolu majú necelé tri pixely, takže kresba 32 × 32 ostane celá
   * čitateľná a mapa pod ňou tiež.
   */
  function kresliHranice(c, V, kusy) {
    if (!kusy || !kusy.length) return;
    var z = urovenPre(V.s), lem = z ? LEM : LEM_SVET, i, h, sirka;
    for (i = 0; i < HRANICE.length; i++) {
      h = HRANICE[i];
      sirka = z ? h[3] : h[2];
      vrstva(c, kusy, h[0], FARBY.lem, sirka + lem, h[4]);
      vrstva(c, kusy, h[0], FARBY[h[1]], sirka, h[4]);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ── Menovky: štáty, moria a mestá ────────────────────────────────────────
  // Priblíženie v stupnici webových máp (256 px na svet pri nule), lebo v nej má
  // Natural Earth pri každom štáte a mori zapísané, odkedy dokedy sa má písať.
  var PISMO = '"ARLing Sans",system-ui,-apple-system,"Segoe UI",sans-serif';
  var PISMO_VODY = '"ARLing Serif",Georgia,serif';
  var sirky = {};
  function sirkaTextu(c, pismo, text) {
    var k = pismo + text, w = sirky[k];
    if (w === undefined) { c.font = pismo; w = sirky[k] = c.measureText(text).width; }
    return w;
  }
  function kresliMena(c, V, kusy) {
    var d0 = DL['0/0_0'];
    if (!d0 || !d0.ok) return;
    var zoom = Math.log(((V.s / dpr) * 360) / 256) / Math.LN2;
    var obsadene = [], q0 = POD.urovne[0].q;
    function miesto(x, y, w, h) {
      if (x + w < 0 || x > V.w || y + h < 0 || y > V.h) return false;
      for (var i = 0; i < obsadene.length; i += 4) {
        if (x < obsadene[i] + obsadene[i + 2] && x + w > obsadene[i] && y < obsadene[i + 1] + obsadene[i + 3] && y + h > obsadene[i + 1]) return false;
      }
      obsadene.push(x, y, w, h);
      return true;
    }
    var kOd = Math.floor((V.lon - V.cx / V.s + 180) / 360), kDo = Math.floor((V.lon + (V.w - V.cx) / V.s + 180) / 360);
    function nadSvetom(zaznamy, kresli) {
      if (!zaznamy) return;
      for (var k = kOd; k <= kDo; k++) for (var i = 0; i < zaznamy.length; i++) {
        var m = zaznamy[i];
        if (zoom < m[2] / 10 - 0.25 || zoom > m[3] / 10 + 0.6) continue;
        kresli(m, (m[0] / q0 - 180 + 360 * k - V.lon) * V.s + V.cx, (V.my - (Y_SVETA - m[1] / q0)) * V.s + V.cy);
      }
    }
    c.textBaseline = 'middle';
    c.textAlign = 'center';
    // Tmavý lem pod písmom: meno ostane čitateľné aj tam, kde cezeň vedie hranica.
    c.lineJoin = 'round';
    c.lineWidth = 3 * dpr;
    c.strokeStyle = 'rgba(12,10,9,.8)';
    // Štáty: verzálky s rozpalom, tlmene. Čím viac je štát priblížený, tým väčšie písmo.
    if ('letterSpacing' in c) c.letterSpacing = (0.9 * dpr).toFixed(1) + 'px';
    c.fillStyle = FARBY.stat;
    nadSvetom(d0.n, function (m, x, y) {
      var px = Math.round(Math.min(14, 10 + Math.max(0, zoom - m[2] / 10) * 1.6) * dpr), pismo = '600 ' + px + 'px ' + PISMO;
      var text = m[4].toUpperCase(), w = sirkaTextu(c, pismo, text);
      if (!miesto(x - w / 2 - 4 * dpr, y - px * 0.7, w + 8 * dpr, px * 1.4)) return;
      c.font = pismo;
      c.strokeText(text, x, y);
      c.fillText(text, x, y);
    });
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    // Mestá: bod a meno vpravo od neho. Koľko ich je, závisí od priblíženia.
    var najRad = zoom < 3.4 ? -1 : zoom < 4.3 ? 1 : zoom < 5.2 ? 3 : zoom < 6.1 ? 5 : zoom < 7 ? 7 : 12;
    var pxM = Math.round(11.5 * dpr), pismoM = '500 ' + pxM + 'px ' + PISMO, pocet = 0;
    c.textAlign = 'left';
    for (var a = 0; a < kusy.length && najRad >= 0; a++) {
      var ks = kusy[a], mesta = ks.d.p;
      if (!mesta || ks.hruba) continue;
      for (var b = 0; b < mesta.length && pocet < 60; b++) {
        var m = mesta[b];
        if (m[2] > najRad) break;          // zoznam je zoradený podľa významu
        var x = m[0] * ks.k + ks.tx, y = m[1] * ks.k + ks.ty;
        if (x < -40 || x > V.w + 40 || y < -20 || y > V.h + 20) continue;
        var w = sirkaTextu(c, pismoM, m[3]);
        if (!miesto(x - 4 * dpr, y - pxM * 0.75, w + 13 * dpr, pxM * 1.5)) continue;
        pocet++;
        c.fillStyle = FARBY.bod;
        c.beginPath();
        c.arc(x, y, (m[4] ? 2.6 : 2) * dpr, 0, 6.2832);
        c.fill();
        c.fillStyle = FARBY.mesto;
        c.font = pismoM;
        c.strokeText(m[3], x + 6 * dpr, y + 0.5 * dpr);
        c.fillText(m[3], x + 6 * dpr, y + 0.5 * dpr);
      }
    }
    // Moria a oceány: kurzíva s pätkami, ako na papierových mapách. Písmo sa pýta až tu.
    if (!pismoNacitane && document.fonts && document.fonts.load) {
      pismoNacitane = true;
      document.fonts.load('italic 400 14px ' + PISMO_VODY).then(function () { sirky = {}; ziadaj(); }, function () {});
    }
    c.textAlign = 'center';
    c.fillStyle = FARBY.voda;
    nadSvetom(d0.s, function (m, x, y) {
      var px = Math.round((m[2] <= 10 ? 14.5 : 12.5) * dpr), pismo = 'italic 400 ' + px + 'px ' + PISMO_VODY;
      var w = sirkaTextu(c, pismo, m[4]);
      if (!miesto(x - w / 2 - 6 * dpr, y - px * 0.8, w + 12 * dpr, px * 1.6)) return;
      c.font = pismo;
      c.fillText(m[4], x, y);
    });
    c.textAlign = 'start';
    c.textBaseline = 'alphabetic';
  }

  // ── Zásobné plátno podkladu ──────────────────────────────────────────────
  // Keď snímky pri pohybe meškajú, podklad sa vykreslí raz, väčší o okraj, a pri
  // posune sa len prekladá. Na rýchlom počítači sa nezapne. Od 22. 9. 2026 sú v
  // ňom len PLOCHY: pobrežie a hranice sú nad vlastníctvom, kreslia sa na mapu.
  var kes = { platno: null, c: null, V: null, plati: false, zapnute: parametre.get('kes') === '1', uroven: -1 }, usadenie = 0;
  function pohlad() { return { lon: S.lon, my: S.my, s: S.s, cx: S.stredX, cy: S.stredY, w: S.w, h: S.h }; }
  /** Nakreslí plochy a čiary podkladu a vráti dlaždice aktuálneho pohľadu, z ktorých sa potom píšu mená. */
  function podklad() {
    var V = pohlad();
    if (!POD) return null;
    if (!kes.zapnute) return kresliPodklad(ctx, V);
    var K = kes.V, pomer = K ? S.s / K.s : 0;
    if (K && kes.plati) {
      var dLon = K.lon - S.lon;
      dLon -= 360 * Math.round(dLon / 360);
      var x0 = (dLon - K.cx / K.s) * S.s + S.stredX, y0 = (S.my - (K.my + K.cy / K.s)) * S.s + S.stredY;
      var presne = Math.abs(pomer - 1) < 0.0015;
      if (x0 <= 0 && y0 <= 0 && x0 + K.w * pomer >= S.w && y0 + K.h * pomer >= S.h && (presne || (pomer > 0.5 && pomer < 2))) {
        ctx.imageSmoothingEnabled = !presne;
        if (presne) ctx.drawImage(kes.platno, Math.round(x0), Math.round(y0));
        else {
          ctx.drawImage(kes.platno, x0, y0, K.w * pomer, K.h * pomer);
          clearTimeout(usadenie);
          usadenie = setTimeout(function () { kes.plati = false; ziadaj(); }, 110);
        }
        return kusyPre(V, urovenPre(V.s));
      }
    }
    var okraj = Math.round(Math.min(S.w, S.h) * 0.3);
    while (okraj > 0 && (S.w + 2 * okraj) * (S.h + 2 * okraj) > 14e6) okraj = Math.round(okraj * 0.7);
    if (!kes.platno) { kes.platno = document.createElement('canvas'); kes.c = kes.platno.getContext('2d', { alpha: false }); }
    var w = S.w + 2 * okraj, h = S.h + 2 * okraj;
    if (kes.platno.width !== w || kes.platno.height !== h) { kes.platno.width = w; kes.platno.height = h; }
    V.w = w; V.h = h; V.cx += okraj; V.cy += okraj;
    kes.c.setTransform(1, 0, 0, 1, 0, 0);
    kes.c.fillStyle = FARBY.more;
    kes.c.fillRect(0, 0, w, h);
    kresliPodklad(kes.c, V);
    kes.V = V; kes.plati = true;
    ctx.drawImage(kes.platno, -okraj, -okraj);
    return kusyPre(pohlad(), urovenPre(S.s));
  }

  // ── Kreslenie ────────────────────────────────────────────────────────────
  var naplanovane = false, poslednyCas = 0, predoslySnimok = 0, pomale = 0;
  var meranie = { kres: [], odstup: [], text: '', bezi: false };
  function ziadaj() { if (!naplanovane) { naplanovane = true; requestAnimationFrame(snimok); } }
  function snimok(t) {
    naplanovane = false;
    var dt = predoslySnimok ? Math.min(64, t - predoslySnimok) : 16;
    var plynule = predoslySnimok && t - predoslySnimok < 120;
    predoslySnimok = t; poslednyCas = t; snimokC++;
    var zije = krokAnimacii(t, dt);
    var t0 = performance.now();
    var dlazdic = kresli(t);
    var cas = performance.now() - t0;
    // Tri meškajúce snímky po sebe pri pohybe: prepni podklad na zásobné plátno.
    // Pol sekundy po načítaní dlaždice sa neráta: vtedy mešká rozbaľovanie dát, nie kreslenie.
    if (plynule && (zije || tahanie) && t0 - nacitaneV > 500) {
      pomale = dt > 26 ? pomale + 1 : 0;
      if (pomale >= 3 && !kes.zapnute && POD && urovenPre(S.s) > 0) { kes.zapnute = true; kes.uroven = urovenPre(S.s); }
    }
    if (kes.zapnute && kes.uroven >= 0 && POD && urovenPre(S.s) !== kes.uroven && !zije && !tahanie) { kes.zapnute = false; kes.uroven = -1; pomale = 0; }
    if (LADENIE) ladiaciPas(cas, plynule ? dt : 0, dlazdic);
    if (zije || zivaAnimacia(t)) ziadaj(); else predoslySnimok = 0;
  }
  function zivaAnimacia(t) { return !POKOJ && S.vyberOd && t - S.vyberOd < 240; }

  function kresli(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = FARBY.more;
    ctx.fillRect(0, 0, S.w, S.h);
    var kusy = podklad();
    kresliPredane();
    // Geografia nad vlastníctvom. Bez tohto poradia zmizne pri plnej mape mapa.
    if (kusy) kresliHranice(ctx, pohlad(), kusy);
    kresliMriezku();
    kresliVyber(t);
    // Mená idú navrch: inak by meno mesta zmizlo pod predaným štvorcom, ktorý na ňom leží.
    if (kusy) kresliMena(ctx, pohlad(), kusy);
    return kusy ? kusy.length : 0;
  }

  /** Ladiaci pás: čas kreslenia snímky v JavaScripte a odstup snímok pri pohybe. */
  function ladiaciPas(cas, odstup, dlazdic) {
    function zhrn(p) {
      if (!p.length) return 'n/a';
      var s = p.slice().sort(function (a, b) { return a - b; }), sum = 0;
      for (var i = 0; i < s.length; i++) sum += s[i];
      return (sum / s.length).toFixed(1) + ' avg, ' + s[Math.floor(s.length * 0.95)].toFixed(1) + ' p95, ' + s[s.length - 1].toFixed(1) + ' max';
    }
    meranie.kres.push(cas); if (meranie.kres.length > 240) meranie.kres.shift();
    if (odstup) { meranie.odstup.push(odstup); if (meranie.odstup.length > 240) meranie.odstup.shift(); }
    var riadky = ['draw ' + cas.toFixed(1) + ' ms (' + zhrn(meranie.kres) + ')',
      'frame gap ms: ' + zhrn(meranie.odstup),
      'level ' + (POD ? urovenPre(S.s) : '-') + ', tiles ' + dlazdic + ', ' + (S.s / dpr).toFixed(1) + ' css px/deg, dpr ' + dpr + ', ' + S.w + 'x' + S.h + (kes.zapnute ? ', buffer on' : '')];
    if (meranie.text) riadky.push(meranie.text);
    ctx.font = 12 * dpr + 'px monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,.78)';
    ctx.fillRect(S.w / 2 - 250 * dpr, S.h - (riadky.length * 16 + 14) * dpr, 500 * dpr, (riadky.length * 16 + 8) * dpr);
    ctx.fillStyle = '#9fe870';
    for (var i = 0; i < riadky.length; i++) ctx.fillText(riadky[i], S.w / 2 - 242 * dpr, S.h - ((riadky.length - i) * 16 + 10) * dpr);
    ctx.textBaseline = 'alphabetic';
  }
  /** ?debug=2: dve sekundy rovnomerného posunu, ako pri ťahaní, a výsledok do ladiaceho pásu. */
  function meranyPosun() {
    if (meranie.bezi) return;
    meranie.bezi = true; meranie.kres = []; meranie.odstup = [];
    var zostava = 120;
    anim.meranie = function () {
      S.lon += (4 * dpr) / S.s;
      if (--zostava > 0) return true;
      var s = meranie.odstup.slice().sort(function (a, b) { return a - b; });
      meranie.text = 'pan test 120 frames: median gap ' + (s[s.length >> 1] || 0).toFixed(1) + ' ms = ' + (1000 / (s[s.length >> 1] || 1000)).toFixed(0) + ' fps';
      return false;
    };
    ziadaj();
  }

  /**
   * Sú bunky dosť veľké na to, aby sa kreslili presne z blokov a nie z vrstvy?
   * Prah je osem pixelov na bunku: blok 64 × 64 má vtedy aspoň 512 px, takže
   * výrez pokryje najviac tridsaťdva blokov, ktoré sa naraz sťahujú.
   */
  function zblizka() { return bunkaVStrede() >= 8 * dpr; }
  /**
   * Šírka bunky v strede pohľadu, v zariadeniových pixeloch. Zo stredu, nie z
   * horného okraja: keď je svet menší než okno, horný okraj leží za pólom, kde má
   * riadok tri bunky po 120 stupňov, a mapa by si myslela, že je priblížená.
   */
  function bunkaVStrede() {
    return (360 / STL[riadokZoSirky(zY(naSvete(zYObr(S.stredY))))]) * S.s;
  }
  function naSvete(my) { return my > Y_SVETA ? Y_SVETA : my < -Y_SVETA ? -Y_SVETA : my; }

  /**
   * Predané bunky. Pri pohľade zďaleka celosvetová vrstva z homelabu, zblízka
   * presné bloky. Nikdy oboje naraz: vrstva má bunku zaokrúhlenú na celý pixel,
   * takže by zblízka trčala spod presného obdĺžnika ako rozmazaná škvrna.
   */
  function kresliPredane() {
    var blizko = zblizka();
    if (vrstva2.platno && !(blizko && Object.keys(bloky).length)) {
      var x0 = naX(-180), y0 = naY(Y_SVETA), sirka = 360 * S.s, vyska = 2 * Y_SVETA * S.s;
      ctx.imageSmoothingEnabled = sirka < vrstva2.platno.width;
      for (var k = Math.floor((0 - (x0 + sirka)) / sirka); k <= Math.ceil((S.w - x0) / sirka); k++) {
        ctx.drawImage(vrstva2.platno, x0 + k * sirka, y0, sirka, vyska);
      }
    }
    if (!blizko) return;
    var kluce = Object.keys(bloky);
    if (!kluce.length) return;
    // Jedna cesta a jedno fill na farbu pre celý viditeľný výsek: tisíc predaných
    // buniek je tisíc obdĺžnikov v jednej ceste, nie tisíc volaní fill.
    kresliStav(kluce, ST_PREDANE, 255, FARBY.predane, false);
    kresliStav(kluce, ST_PREDANE, 255, FARBY.moje, true);
    kresliStav(kluce, ST_REZERVOVANE, ST_REZERVOVANE, FARBY.rezervovane, false);
    kresliKresby(kluce);
  }

  // ── Kresby majiteľov priamo na mape ──────────────────────────────────────
  // Služba lepí schválené kresby bloku 64 × 64 do jedného obrázka (/api/art),
  // 32 × 32 bodov na bunku. Obrázok sa pýta len pre blok, ktorý kresbu naozaj má
  // (stav 4 alebo 6), a v pamäti ostávajú najviac štyri: rozbalený má 16 MB.
  var ST_KRESBA = 4, ST_ZAKLADATEL_KRESBA = 6, KRESBA_PX = 32;
  var atlasy = {}, atlasPoradie = [];
  function atlasBloku(kluc, b) {
    var a = atlasy[kluc];
    if (!a) {
      a = atlasy[kluc] = { bmp: null, stare: true, caka: false };
      atlasPoradie.push(kluc);
      while (atlasPoradie.length > 4) {
        var von = atlasPoradie.shift();
        if (atlasy[von] && atlasy[von].bmp && atlasy[von].bmp.close) atlasy[von].bmp.close();
        delete atlasy[von];
      }
    }
    if (a.stare && !a.caka) {
      a.stare = false; a.caka = true;
      fetch(API + '/api/art/' + (b.r0 >> 6) + '/' + (b.c0 >> 6) + '.png')
        .then(function (o) { if (!o.ok) throw 0; return o.blob(); })
        .then(function (blob) { return createImageBitmap(blob); })
        .then(function (bmp) {
          if (a.bmp && a.bmp.close) a.bmp.close();
          a.bmp = bmp; a.caka = false; ziadaj();
        })
        .catch(function () { a.caka = false; });   // ďalší pokus až po minútovom obnovení
    }
    return a.bmp;
  }

  /** Je blok aspoň kúskom vo výreze? Načítané bloky sa nezahadzujú, takže ich je časom veľa. */
  function blokVidno(b) {
    var yHore = naY(doY(90 - b.r0 * RIADOK)), yDole = naY(doY(90 - Math.min(RIADKY, b.r0 + 64) * RIADOK));
    if (yDole < 0 || yHore > S.h) return false;
    // Riadky bloku majú rôzny počet stĺpcov, takže blok je na mape mierne zošikmený;
    // šírka sa berie zo stredného riadku a na každú stranu sa pridá pol bloku.
    var sirkaDeg = 360 / STL[Math.min(RIADKY - 1, b.r0 + 32)], sirka = 64 * sirkaDeg * S.s, svet = 360 * S.s;
    var x = naX(-180 + b.c0 * sirkaDeg);
    if (x + sirka * 1.5 < 0) x += svet; else if (x - sirka * 0.5 > S.w) x -= svet;
    return x + sirka * 1.5 >= 0 && x - sirka * 0.5 <= S.w;
  }

  function kresliKresby(kluce) {
    ctx.imageSmoothingEnabled = false;
    var pouzite = 0;
    for (var i = 0; i < kluce.length; i++) {
      var b = bloky[kluce[i]];
      if (!b || !b.stavy || !b.maKresbu || !blokVidno(b)) continue;
      // Najviac toľko blokov naraz, koľko sa ich drží v pamäti: inak by sa pri
      // piatom začali navzájom vyhadzovať a sťahovať dokola.
      if (++pouzite > 4) break;
      var bmp = atlasBloku(kluce[i], b);
      if (!bmp || bmp.width < 64 * KRESBA_PX) continue;
      for (var j = 0; j < 4096 && j < b.stavy.length; j++) {
        var st = b.stavy[j];
        if (st !== ST_KRESBA && st !== ST_ZAKLADATEL_KRESBA) continue;
        var r = b.r0 + (j >> 6), c = b.c0 + (j & 63);
        if (r >= RIADKY || c >= STL[r]) continue;
        var g = geometriaBunky(r, c);
        if (g.w < 10 || g.x + g.w < 0 || g.x > S.w || g.y + g.h < 0 || g.y > S.h) continue;
        ctx.drawImage(bmp, (j & 63) * KRESBA_PX, (j >> 6) * KRESBA_PX, KRESBA_PX, KRESBA_PX, g.x, g.y, g.w, g.h);
      }
    }
  }

  function kresliStav(kluce, od, po, farba, lenMoje) {
    if (lenMoje && !mojePocet) return;
    ctx.fillStyle = farba;
    ctx.beginPath();
    var kreslene = 0;
    for (var i = 0; i < kluce.length; i++) {
      var b = bloky[kluce[i]];
      if (!b || !b.stavy) continue;
      for (var j = 0; j < 4096 && j < b.stavy.length; j++) {
        var st = b.stavy[j];
        if (st < od || st > po) continue;
        var r = b.r0 + (j >> 6), c = b.c0 + (j & 63);
        if (r >= RIADKY || c >= STL[r]) continue;
        if (lenMoje && !moje[cislo(r, c)]) continue;
        obdlznikBunky(r, c);
        if (++kreslene > 20000) { i = kluce.length; break; }
      }
    }
    if (kreslene) ctx.fill();
  }

  /** Stav bunky z načítaného bloku, alebo -1, keď blok ešte (alebo vôbec) nie je. */
  function stavZBloku(r, c) {
    var b = bloky[(r >> 6) + ',' + (c >> 6)];
    if (!b || !b.stavy) return -1;
    var j = ((r - b.r0) << 6) + (c - b.c0);
    return j >= 0 && j < b.stavy.length ? b.stavy[j] : -1;
  }

  /** Kde je bunka na plátne, v zariadeniových pixeloch. */
  function geometriaBunky(r, c) {
    var sirkaDeg = 360 / STL[r];
    var hore = naY(doY(90 - r * RIADOK)), dole = naY(doY(90 - (r + 1) * RIADOK));
    var x = naX(-180 + c * sirkaDeg), sir = sirkaDeg * S.s;
    if (x + sir < 0) x += 360 * S.s;
    else if (x > S.w) x -= 360 * S.s;
    return { x: x, y: hore, w: sir, h: dole - hore };
  }
  /** Pridá obdĺžnik bunky do prebiehajúcej cesty. Cestu nezačína ani nekreslí. */
  function obdlznikBunky(r, c) {
    var g = geometriaBunky(r, c);
    ctx.rect(g.x, g.y, g.w, g.h);
    return g;
  }

  /**
   * Mriežka sa ukáže, až keď má bunka aspoň 6 px, a nabieha postupne: pri šiestich
   * pixeloch je sotva vidno, pri tridsiatich je zreteľná. Len viditeľné riadky.
   */
  function kresliMriezku() {
    var yHore = naSvete(zYObr(0)), yDole = naSvete(zYObr(S.h));
    if (yHore <= yDole) return;
    // Len riadky, ktoré Mercator vie ukázať. Za 85. rovnobežkou má riadok pár buniek
    // po desiatkach stupňov a z mriežky by bol cez celý svet sivý pás.
    var rHore = Math.max(55, riadokZoSirky(zY(yHore))), rDole = Math.min(RIADKY - 56, riadokZoSirky(zY(yDole)));
    var prah = 6 * dpr;
    // V Mercatore sú bunky bližšie k pólom na obrazovke väčšie, takže prah sa pýta
    // každého riadku zvlášť; sila čiary ide podľa stredu pohľadu.
    if (Math.max(360 / STL[rHore], 360 / STL[rDole]) * S.s < prah) return;
    var bunkaPx = bunkaVStrede() / dpr;
    var sila = bunkaPx < 6 ? 0.035 : bunkaPx < 30 ? 0.035 + ((bunkaPx - 6) / 24) * 0.075 : 0.16;
    ctx.strokeStyle = FARBY.mriezka + sila.toFixed(3) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    var useky = 0, predosly = false;
    for (var r = rHore; r <= rDole; r++) {
      var sirkaDeg = 360 / STL[r];
      if (sirkaDeg * S.s < prah) { predosly = false; continue; }
      var yh = Math.round(naY(doY(90 - r * RIADOK))) + 0.5;
      var yd = Math.round(naY(doY(90 - (r + 1) * RIADOK))) + 0.5;
      if (!predosly) { ctx.moveTo(0, yh); ctx.lineTo(S.w, yh); }
      ctx.moveTo(0, yd); ctx.lineTo(S.w, yd);
      predosly = true;
      var prvy = Math.floor((zX(0) + 180) / sirkaDeg);
      var posledny = Math.ceil((zX(S.w) + 180) / sirkaDeg);
      for (var c = prvy; c <= posledny; c++) {
        var x = Math.round(naX(-180 + c * sirkaDeg)) + 0.5;
        ctx.moveTo(x, yh); ctx.lineTo(x, yd);
        if (++useky > 60000) { c = posledny; r = rDole; }
      }
    }
    ctx.stroke();
  }

  /** Štvorce v košíku a obdĺžnik, ktorý sa práve ťahá so Shiftom. */
  function kresliKosik() {
    if (kosik.length) {
      ctx.beginPath();
      for (var i = 0; i < kosik.length; i++) obdlznikBunky(kosik[i].r, kosik[i].c);
      ctx.fillStyle = 'rgba(255,217,201,.30)';
      ctx.fill();
      ctx.strokeStyle = FARBY.vyber;
      ctx.lineWidth = Math.max(1, 1.5 * dpr);
      ctx.stroke();
    }
    if (!ram) return;
    ctx.fillStyle = 'rgba(255,217,201,.08)';
    ctx.fillRect(Math.min(ram.x0, ram.x), Math.min(ram.y0, ram.y), Math.abs(ram.x - ram.x0), Math.abs(ram.y - ram.y0));
    // Presne tie štvorce, ktoré sa po pustení pridajú (bunkyVRame).
    var nahlad = bunkyVRame(ram);
    if (nahlad.length) {
      ctx.beginPath();
      for (var j = 0; j < nahlad.length; j++) obdlznikBunky(nahlad[j].r, nahlad[j].c);
      ctx.fillStyle = 'rgba(255,217,201,.22)';
      ctx.fill();
      ctx.strokeStyle = FARBY.vyber;
      ctx.lineWidth = Math.max(1, dpr);
      ctx.stroke();
    }
    ctx.strokeStyle = FARBY.vyber;
    ctx.lineWidth = Math.max(1, dpr);
    ctx.setLineDash([4 * dpr, 3 * dpr]);
    ctx.strokeRect(Math.min(ram.x0, ram.x) + 0.5, Math.min(ram.y0, ram.y) + 0.5, Math.abs(ram.x - ram.x0), Math.abs(ram.y - ram.y0));
    ctx.setLineDash([]);
  }

  function kresliVyber(t) {
    kresliKosik();
    // V režime košíka je zvýraznené len to, čo v košíku naozaj je. Štvorec
    // vybraný pred otvorením košíka sa predtým kreslil ďalej ako vybraný, hoci
    // v košíku nebol (Andrej 25. 9. 2026: „máš ako keby označený aj ten
    // predtým, ale iba vizuálne“). Pri otvorení košíka tlačidlom sa preto do
    // košíka pridá (otvorKosik) a kým košík beží, samostatne sa nekreslí.
    var vybrana = kosikRezim ? null : S.vybrana;
    if (S.podKurzorom && (!vybrana || S.podKurzorom.id !== vybrana.id)) {
      var bunkaPx = (360 / STL[S.podKurzorom.r]) * S.s;
      if (bunkaPx >= 6 * dpr) {
        ctx.beginPath();
        obdlznikBunky(S.podKurzorom.r, S.podKurzorom.c);
        ctx.fillStyle = 'rgba(255,255,255,.10)';
        ctx.fill();
      }
    }
    if (!vybrana) return;
    ctx.beginPath();
    var g = obdlznikBunky(vybrana.r, vybrana.c);
    ctx.fillStyle = 'rgba(242,100,60,.18)';
    ctx.fill();
    ctx.strokeStyle = FARBY.vyber;
    ctx.lineWidth = Math.max(1.5, 2 * dpr);
    ctx.stroke();
    // Bunka menšia než pár pixelov by bola neviditeľná: dostane značku, ktorá ju ukáže.
    if (g.w < 9 * dpr) {
      ctx.beginPath();
      ctx.arc(g.x + g.w / 2, g.y + g.h / 2, 7 * dpr, 0, 6.2832);
      ctx.stroke();
    }
    // Jediný pohyb, ktorý si človek nevypýtal: prsteň, ktorý sadne na vybranú bunku.
    if (zivaAnimacia(t)) {
      var p = (t - S.vyberOd) / 240;
      var e = 1 - Math.pow(1 - p, 4);
      var rast = (1 - e) * Math.max(g.w, 34 * dpr) * 1.1;
      ctx.globalAlpha = 1 - e;
      ctx.strokeStyle = FARBY.vyber;
      ctx.lineWidth = Math.max(1, 1.5 * dpr);
      ctx.beginPath();
      ctx.rect(g.x - rast, g.y - rast, g.w + rast * 2, g.h + rast * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ── Rozmer plátna ────────────────────────────────────────────────────────
  var zmenaCakajuca = 0, prvyRozmer = true;
  function prepocitaj() {
    var r = platno.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (w === S.w && h === S.h) return;
    // Kým sa mapy nikto nedotkol, zmena okna drží prvý pohľad na celý svet.
    var drzSvet = prvyRozmer || (!dotknute && !S.vybrana);
    S.w = w; S.h = h;
    platno.width = w; platno.height = h;
    kes.plati = false;
    prepocitajStred();
    if (drzSvet && w > 1) { var ps = pohladNaSvet(); S.s = ps.s; S.lon = ps.lon; S.my = ps.my; prvyRozmer = false; }
    uprav();
    ziadaj();
  }
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      if (zmenaCakajuca) cancelAnimationFrame(zmenaCakajuca);
      zmenaCakajuca = requestAnimationFrame(prepocitaj);
    }).observe(platno);
  } else {
    window.addEventListener('resize', prepocitaj, { passive: true });
  }

  // ── Pohyb: zotrvačnosť, plynulé priblíženie a prelet v jednej slučke ─────
  var anim = { zotrv: null, zoom: null, let: null, meranie: null };
  function zastavPohyb() { anim.zotrv = anim.zoom = anim.let = null; }
  function krokAnimacii(t, dt) {
    var zije = false, zmena = false, a;
    if ((a = anim.zotrv)) {
      S.lon -= (a.vx * dt) / S.s;
      S.my += (a.vy * dt) / S.s;
      var tlm = Math.exp(-dt / 300);
      a.vx *= tlm; a.vy *= tlm;
      zmena = true;
      if (Math.abs(a.vx) + Math.abs(a.vy) < 0.02 * dpr) anim.zotrv = null; else zije = true;
    }
    if ((a = anim.zoom)) {
      var ls = Math.log(S.s), krok = (a.ciel - ls) * (1 - Math.exp(-dt / 75));
      if (Math.abs(a.ciel - ls) < 0.002) krok = a.ciel - ls;
      priblizNa(a.x, a.y, Math.exp(krok), true);
      zmena = true;
      // Koniec: cieľ je dosiahnutý, alebo priblíženie narazilo na medzu a ďalej sa nepohne.
      if (krok === a.ciel - ls || Math.abs(Math.log(S.s) - ls) < 1e-7) anim.zoom = null; else zije = true;
    }
    if ((a = anim.let)) {
      var p = Math.max(0, Math.min(1, (t - a.od) / a.trva)), e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      S.lon = a.lon0 + a.dLon * e;
      S.my = a.my0 + (a.my1 - a.my0) * e;
      S.s = Math.exp(a.ls0 + (a.ls1 - a.ls0) * e - a.skok * Math.sin(Math.PI * p));
      zmena = true;
      if (p >= 1) { anim.let = null; if (a.potom) a.potom(); } else zije = true;
    }
    if (anim.meranie) { zmena = true; if (anim.meranie()) zije = true; else anim.meranie = null; }
    if (zmena) uprav();
    return zije;
  }

  /** Priblíženie okolo bodu obrazovky: miesto pod kurzorom alebo medzi prstami ostane pod ním. */
  function priblizNa(x, y, nasob, ticho) {
    var lonPod = zX(x), myPod = zYObr(y);
    S.s *= nasob;
    var m = medze();
    S.s = Math.min(m.maxS, Math.max(m.minS, S.s));
    S.lon = lonPod - (x - S.stredX) / S.s;
    S.my = myPod + (y - S.stredY) / S.s;
    if (!ticho) { uprav(); ziadaj(); }
  }
  /** Plynulé priblíženie o násobok; s obmedzeným pohybom hneď. */
  function priblizPlynule(x, y, nasob) {
    dotyk();
    anim.let = null; anim.zotrv = null;
    if (POKOJ) { priblizNa(x, y, nasob); return; }
    var m = medze(), od = anim.zoom ? anim.zoom.ciel : Math.log(S.s);
    anim.zoom = { x: x, y: y, ciel: Math.min(Math.log(m.maxS), Math.max(Math.log(m.minS), od + Math.log(nasob))) };
    ziadaj();
  }

  /**
   * Pohľad na celý svet: celá šírka mapy presne na šírku okna. Na počítači je svet
   * vyšší než okno, tak sa ukáže obývaný pás so stredom na 25. rovnobežke. Na
   * telefóne na výšku je svet nižší než okno a sadne do voľného miesta medzi
   * skleneným panelom hore a legendou dole, nie pod panel.
   */
  function pohladNaSvet() {
    var s = Math.max(medze().minS, S.w / 360), my = doY(25);
    if (360 * s < S.h) {
      var hore = 0, m = platno.getBoundingClientRect(), r = panel ? panel.getBoundingClientRect() : null;
      if (r && r.width > m.width * 0.8) hore = (r.bottom - m.top) * dpr;
      my = ((hore + S.h - 150 * dpr) / 2 - S.stredY) / s;
    }
    return { s: s, lon: 10, my: my };
  }

  /** Prelet na miesto. Pri veľkej vzdialenosti sa cestou oddiali, aby bolo vidno, kam sa letí. */
  function letNa(lat, lon, cielS, potom) {
    var my1 = doY(lat), dLon = lon - S.lon;
    dLon -= 360 * Math.round(dLon / 360);
    zastavPohyb();
    if (POKOJ) { S.lon = lon; S.my = my1; S.s = cielS; uprav(); ziadaj(); if (potom) potom(); return; }
    var mens = Math.min(S.s, cielS), draha = Math.sqrt(dLon * dLon + (my1 - S.my) * (my1 - S.my)) * mens;
    var skok = Math.max(0, Math.min(2.2, Math.log(draha / (0.7 * Math.min(S.w, S.h)))));
    var najmenej = Math.log(medze().minS);
    skok = Math.max(0, Math.min(skok, Math.log(mens) - najmenej));
    anim.let = { od: performance.now(), trva: 520 + 330 * skok, lon0: S.lon, dLon: dLon, my0: S.my, my1: my1, ls0: Math.log(S.s), ls1: Math.log(cielS), skok: skok, potom: potom };
    ziadaj();
  }
  function celySvet() {
    dotyk();
    var ps = pohladNaSvet();
    letNa(zY(ps.my), ps.lon, ps.s, null);
  }

  // ── Ovládanie myšou, prstom a klávesnicou ────────────────────────────────
  var tahanie = null, prsty = {}, stipka = null, dotknute = false, poslednyTuk = null;
  var panel = koren.querySelector('[data-panel]');
  /** Prvý dotyk mapy zmenší úvodný panel: odvtedy je hrdinom len mapa. */
  function dotyk() {
    if (dotknute) return;
    dotknute = true;
    if (panel) panel.classList.add('mala');
  }
  function bod(e) { var r = platno.getBoundingClientRect(); return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr }; }
  function vzdialenost(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy) || 1; }

  platno.addEventListener('pointerdown', function (e) {
    platno.setPointerCapture(e.pointerId);
    prsty[e.pointerId] = bod(e);
    zastavPohyb();
    var k = Object.keys(prsty);
    if (k.length === 1) {
      var p = prsty[e.pointerId];
      // Shift a ťah = obdĺžnik do košíka. Bez Shiftu sa mapa posúva ako doteraz.
      if (e.shiftKey && kosikZapnuty()) { ram = { x0: p.x, y0: p.y, x: p.x, y: p.y }; tahanie = null; ziadaj(); return; }
      tahanie = { x: p.x, y: p.y, lon: S.lon, my: S.my, pohol: false, stopa: [] };
    } else {
      tahanie = null;
      var a = prsty[k[0]], b = prsty[k[1]];
      // Štipnutie drží pod prstami to isté miesto sveta: mapa sa zároveň posúva aj približuje.
      stipka = { d: vzdialenost(a, b), s: S.s, lon: zX((a.x + b.x) / 2), my: zYObr((a.y + b.y) / 2) };
      dotyk();
    }
  });

  platno.addEventListener('pointermove', function (e) {
    var p = bod(e);
    if (prsty[e.pointerId]) prsty[e.pointerId] = p;
    // Počas ťahu so Shiftom sa zvýraznenie pod kurzorom nekreslí: ostalo sivé na
    // štvorci, kde ťah začal, a vyzeralo ako napoly vybraný štvorec (Andrejova
    // snímka 25. 9. 2026). Po pustení sa znova berie z polohy myši.
    if (ram) { ram.x = p.x; ram.y = p.y; S.podKurzorom = null; ziadaj(); return; }
    var k = Object.keys(prsty);
    if (k.length >= 2 && stipka) {
      var a = prsty[k[0]], b = prsty[k[1]], m = medze();
      S.s = Math.min(m.maxS, Math.max(m.minS, (stipka.s * vzdialenost(a, b)) / stipka.d));
      S.lon = stipka.lon - ((a.x + b.x) / 2 - S.stredX) / S.s;
      S.my = stipka.my + ((a.y + b.y) / 2 - S.stredY) / S.s;
      uprav(); ziadaj();
      return;
    }
    if (tahanie) {
      var dx = p.x - tahanie.x, dy = p.y - tahanie.y;
      if (!tahanie.pohol && Math.abs(dx) + Math.abs(dy) > 4 * dpr) { tahanie.pohol = true; platno.classList.add('presuva'); dotyk(); }
      if (tahanie.pohol) {
        // Rýchlosť sa berie z posledných 90 ms ťahu, nie z posledného kroku myši:
        // jeden rozkmitaný krok by inak mapu odhodil nesprávnym smerom.
        var cas = performance.now(), st = tahanie.stopa;
        st.push({ x: p.x, y: p.y, t: cas });
        while (st.length > 2 && cas - st[0].t > 90) st.shift();
        S.lon = tahanie.lon - dx / S.s;
        S.my = tahanie.my + dy / S.s;
        uprav(); ziadaj();
      }
      return;
    }
    if (e.pointerType === 'mouse') {
      var bunka = bunkaNa(p.x, p.y);
      if ((bunka && bunka.id) !== (S.podKurzorom && S.podKurzorom.id)) { S.podKurzorom = bunka; ziadaj(); }
    }
  }, { passive: true });

  function koniecTahu(e) {
    delete prsty[e.pointerId];
    if (Object.keys(prsty).length < 2) stipka = null;
    if (ram) {
      var r0 = ram;
      ram = null;
      dotyk();
      // Ťuknutie so Shiftom (obdĺžnik bez plochy) je jeden štvorec.
      if (Math.abs(r0.x - r0.x0) + Math.abs(r0.y - r0.y0) < 4 * dpr) {
        var b0 = bunkaNa(r0.x0, r0.y0);
        if (b0) prepniVKosiku(b0.r, b0.c);
      } else {
        doKosikaZRamu(r0);
      }
      sleduj('svet_kosik_vyber');
      if (e.pointerType === 'mouse') S.podKurzorom = bunkaNa(r0.x, r0.y);
      ziadaj();
      return;
    }
    if (!tahanie) return;
    platno.classList.remove('presuva');
    var p = bod(e);
    if (!tahanie.pohol) {
      // Dva ťuky prstom rýchlo po sebe na tom istom mieste priblížia (myš má dblclick).
      var teraz = performance.now();
      if (e.pointerType !== 'mouse' && poslednyTuk && teraz - poslednyTuk.t < 320 && vzdialenost(p, poslednyTuk) < 32 * dpr) {
        poslednyTuk = null;
        priblizPlynule(p.x, p.y, 2);
      } else {
        poslednyTuk = { x: p.x, y: p.y, t: teraz };
        var b = bunkaNa(p.x, p.y);
        // V režime košíka ťuknutie štvorec pridáva a odoberá, nie otvára.
        if (b && kosikRezim) prepniVKosiku(b.r, b.c);
        else if (b) vyber(b.r, b.c, false);
      }
    } else if (!POKOJ) {
      var st = tahanie.stopa, prva = st[0], posl = st[st.length - 1];
      if (prva && posl && posl.t - prva.t > 12 && performance.now() - posl.t < 60) {
        var vx = (posl.x - prva.x) / (posl.t - prva.t), vy = (posl.y - prva.y) / (posl.t - prva.t);
        if (Math.abs(vx) + Math.abs(vy) > 0.12 * dpr) { anim.zotrv = { vx: vx, vy: vy }; ziadaj(); }
      }
    }
    tahanie = null;
  }
  platno.addEventListener('pointerup', koniecTahu);
  platno.addEventListener('pointercancel', function (e) { delete prsty[e.pointerId]; tahanie = null; stipka = null; platno.classList.remove('presuva'); });
  platno.addEventListener('dblclick', function (e) {
    e.preventDefault();
    var p = bod(e);
    priblizPlynule(p.x, p.y, e.shiftKey ? 0.5 : 2);
  });

  platno.addEventListener('wheel', function (e) {
    e.preventDefault();
    var p = bod(e);
    var krok = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    // Štipnutie na touchpade prichádza ako koliesko s Ctrl a malými krokmi.
    priblizPlynule(p.x, p.y, Math.exp(-krok * (e.ctrlKey ? 0.012 : 0.0022)));
  }, { passive: false });

  platno.addEventListener('keydown', function (e) {
    var krok = 80 * dpr, spracovane = true;
    if (e.key === 'ArrowLeft') S.lon -= krok / S.s;
    else if (e.key === 'ArrowRight') S.lon += krok / S.s;
    else if (e.key === 'ArrowUp') S.my += krok / S.s;
    else if (e.key === 'ArrowDown') S.my -= krok / S.s;
    else if (e.key === '+' || e.key === '=') priblizPlynule(S.stredX, S.stredY, 1.6);
    else if (e.key === '-' || e.key === '_') priblizPlynule(S.stredX, S.stredY, 1 / 1.6);
    else if (e.key === '0' || e.key === 'Home') celySvet();
    else if (e.key === 'Enter' || e.key === ' ') {
      // V košíku robí Enter to isté čo ťuknutie: štvorec pridá alebo odoberie.
      var b = bunkaNa(S.stredX, S.stredY);
      if (b && kosikRezim) prepniVKosiku(b.r, b.c); else if (b) vyber(b.r, b.c, false);
    }
    else spracovane = false;
    if (spracovane) { e.preventDefault(); dotyk(); zastavPohybOkremZoomu(); uprav(); ziadaj(); }
  });
  function zastavPohybOkremZoomu() { anim.zotrv = null; }

  // Tlačidlá plus, mínus a celý svet.
  var ovladanie = koren.querySelector('[data-ovladanie]');
  if (ovladanie) ovladanie.addEventListener('click', function (e) {
    var b = e.target.closest('[data-krok]');
    if (!b) return;
    var k = b.getAttribute('data-krok');
    if (k === 'svet') celySvet();
    else priblizPlynule(S.stredX, S.stredY, k === '+' ? 2 : 0.5);
  });

  // ── Košík: viac štvorcov naraz ────────────────────────────────────────────
  // Na počítači sa ťahá obdĺžnik so Shiftom (bez Shiftu sa mapa ďalej posúva,
  // to sa meniť nesmie), na telefóne sa ťuká na štvorce. Všetko ide do jednej
  // pokladne ako jedna platba za N štvorcov. T.kosikZapnuty je vypínač (zapnutý od 22. 9. 2026).
  var KOSIK_STROP = 10;
  var kosik = [], kosikRezim = false, ram = null;
  function kosikZapnuty() { return !!T.kosikZapnuty; }
  function vKosiku(id) {
    for (var i = 0; i < kosik.length; i++) if (kosik[i].id === id) return i;
    return -1;
  }
  /**
   * Do košíka ide len to, o čom stránka nevie, že je obsadené. Zvyšok odmietne
   * služba. Štvorec, ktorý drží tento prehliadač (návrat z pokladne cez „späť“),
   * nie je cudzí: bez tejto výnimky by si človek vlastné štvorce nemohol dať
   * znova do košíka, kým rezervácia nevyprší.
   */
  function daSaPridat(r, c) {
    var id = cislo(r, c), st = stavBunky(r, c, parcely[id]);
    if (cakaNaPotvrdenie(id)) return false;
    return st === 'volna' || st === 'neznamy' || (st === 'rezervovana' && jeMojaRezervacia(id));
  }

  // ── Cena košíka: najlacnejšia kombinácia balíkov ─────────────────────────
  // Andrej 25. 9. 2026: kto si na mape označí štvorce a chce cenu balíka, má
  // dostať presne tie štvorce. Košík preto platí cenami existujúcich produktov:
  // 3 štvorce 12 €, 4 štvorce 12 + 5 €, 6 štvorcov 2 × 12 €, 10 štvorcov 35 €.
  // Najlacnejšia kombinácia, ktorá štvorce POKRYJE: 9 štvorcov zaplatí balík
  // desiatich (35 €). Rozhoduje služba (app.py, kombinacia_kosika), tu sa len
  // ukazuje. Cenník z textov (kosikCeny), kým nepríde živý (nacitajStav).
  var CENNIK_KOSIKA = (Array.isArray(T.kosikCeny) && T.kosikCeny.length) ? T.kosikCeny
    : [['pack10', 10, 35], ['pack3', 3, 12], ['single', 1, Number(T.kosikCenaEur) || 5]];
  function eurText(centov) { return '€' + (centov / 100).toFixed(2); }
  /** {polozky: [[kľúč, štvorcov, centov za kus, množstvo]], centov, plna, kapacita} alebo null. */
  function cenaKosika(n) {
    if (!(n >= 1) || n > KOSIK_STROP) return null;
    var ponuka = CENNIK_KOSIKA.map(function (x) { return [String(x[0]), Number(x[1]), Math.round(Number(x[2]) * 100)]; })
      .filter(function (x) { return x[1] >= 1 && x[1] <= KOSIK_STROP && x[2] >= 0; })
      .sort(function (a, b) { return b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0); });
    if (!ponuka.length) return null;
    var jeden = ponuka.filter(function (x) { return x[1] === 1; })[0];
    var strop = n + ponuka[0][1] - 1;
    var najlepsie = [{ centov: 0, kusov: 0, zoznam: [] }];
    for (var k = 1; k <= strop; k++) {
      najlepsie[k] = null;
      for (var i = 0; i < ponuka.length; i++) {
        var p = ponuka[i], pred = najlepsie[k - p[1]];
        if (p[1] > k || !pred) continue;
        var kand = { centov: pred.centov + p[2], kusov: pred.kusov + 1, zoznam: pred.zoznam.concat([i]) };
        var teraz = najlepsie[k];
        if (!teraz || kand.centov < teraz.centov || (kand.centov === teraz.centov && kand.kusov < teraz.kusov)) najlepsie[k] = kand;
      }
    }
    // Pri rovnakej sume vyhrá menšie pokrytie.
    var v = null, kapacita = 0;
    for (var m = n; m <= strop; m++) {
      if (najlepsie[m] && (!v || najlepsie[m].centov < v.centov)) { v = najlepsie[m]; kapacita = m; }
    }
    if (!v) return null;
    var polozky = [];
    ponuka.forEach(function (p, i) {
      var q = v.zoznam.filter(function (x) { return x === i; }).length;
      if (q) polozky.push([p[0], p[1], p[2], q]);
    });
    return { polozky: polozky, centov: v.centov, plna: jeden ? jeden[2] * n : v.centov, kapacita: kapacita };
  }
  function vetaSCislami(veta, cisla) {
    return String(veta || '').replace(/\{(\w+)\}/g, function (m, k) { return cisla[k] !== undefined ? cisla[k] : m; });
  }

  /**
   * Košík z tlačidla v liste štvorca. Štvorec, z ktorého človek košík otvoril,
   * je prvý v košíku: bol zvýraznený a tlačidlo stálo v jeho liste, takže ho tam
   * každý čaká. Predtým ostal len nakreslený ako vybraný, v košíku nebol a
   * zaplatil by sa bez neho.
   */
  function pridajVybranu(lenVidno) {
    var v = S.vybrana, g = v && geometriaBunky(v.r, v.c);
    if (v && (!lenVidno || (g.x + g.w > 0 && g.x < S.w && g.y + g.h > 0 && g.y < S.h))
      && vKosiku(v.id) < 0 && kosik.length < KOSIK_STROP && daSaPridat(v.r, v.c)) kosik.push({ id: v.id, r: v.r, c: v.c });
  }
  function otvorKosik() {
    pridajVybranu();
    ziadaj();
    ukazKosik();
  }
  /** Shift z prehľadu: vybraný štvorec ide prvý, ale len keď je na mape vidno (list ukazuje len čísla). */
  function vstupDoKosika() {
    if (kosikRezim) return false;
    pridajVybranu(1);
    return true;
  }
  function prepniVKosiku(r, c) {
    // Počas vypĺňania pokladne sa košík nemení: ťuk na mapu by inak zmazal
    // rozpísaný e-mail a zaplatilo by sa niečo iné, než čo pokladňa ukazuje.
    if (listRezim === 'pokladna') return;
    var id = cislo(r, c);
    var otvoril = vstupDoKosika();
    // Shift a klik na ten istý štvorec, ktorý bol vybraný: košík sa ním otvára,
    // nie ho hneď vyhadzuje.
    var praveVybrany = otvoril && !!S.vybrana && S.vybrana.id === id;
    var i = vKosiku(id);
    if (i >= 0) {
      if (!praveVybrany) { kosik.splice(i, 1); zahodDrziak(id); }
    } else if (kosik.length >= KOSIK_STROP) {
      pas(T.kosikStrop);
      if (!otvoril) return;
    } else if (daSaPridat(r, c)) {
      kosik.push({ id: id, r: r, c: c });
    } else if (!otvoril) {
      return;
    }
    ziadaj();
    ukazKosik();
  }
  /**
   * Štvorce, ktoré obdĺžnik naozaj pridá: tie, ktorých STRED leží v obdĺžniku,
   * najviac toľko, koľko sa ešte zmestí do košíka, zhora zľava. Riadky sú voči
   * sebe posunuté (každý má iný počet stĺpcov), takže pravidlo „čoho sa dotkne“
   * bralo aj štvorce trčiace z obdĺžnika a výber vyšiel zubatý a iný, než človek
   * nakreslil (Andrej 25. 9. 2026: „ten výber viacerých je stále problém“). To
   * isté sa kreslí počas ťahu, takže človek vidí presne, čo dostane.
   */
  function bunkyVRame(r0) {
    var x0 = Math.min(r0.x0, r0.x), x1 = Math.max(r0.x0, r0.x);
    var y0 = Math.min(r0.y0, r0.y), y1 = Math.max(r0.y0, r0.y);
    var vyber = [], videne = {}, volne = KOSIK_STROP - kosik.length, krokov = 0;
    if (volne <= 0) return vyber;
    function pridaj(r, c) {
      var id = cislo(r, c);
      if (videne[id]) return;
      videne[id] = 1;
      if (vKosiku(id) < 0 && daSaPridat(r, c)) vyber.push({ id: id, r: r, c: c });
    }
    // Štvorce pod začiatkom a koncom ťahu patria do výberu vždy: na tie človek ukázal.
    var b0 = bunkaNa(r0.x0, r0.y0), b1 = bunkaNa(r0.x, r0.y);
    if (b0) pridaj(b0.r, b0.c);
    if (b1) pridaj(b1.r, b1.c);
    var rHore = riadokZoSirky(zY(naSvete(zYObr(y0)))), rDole = riadokZoSirky(zY(naSvete(zYObr(y1))));
    for (var r = rHore; r <= rDole && vyber.length < volne + 2; r++) {
      var stredY = naY(doY(stredRiadku(r)));
      if (stredY < y0 || stredY > y1) continue;
      var sirkaDeg = 360 / STL[r];
      var cOd = Math.ceil((zX(x0) + 180) / sirkaDeg - 0.5), cDo = Math.floor((zX(x1) + 180) / sirkaDeg - 0.5);
      for (var c = cOd; c <= cDo && vyber.length < volne + 2; c++) {
        if (++krokov > 20000) { r = rDole; break; }     // oddialená mapa: obdĺžnik cez tisíce štvorcov
        pridaj(r, ((c % STL[r]) + STL[r]) % STL[r]);     // cez 180. poludník
      }
    }
    // Poradie ako pri čítaní (zhora, zľava), strop košíka odreže až koniec.
    vyber.sort(function (a, b) { return a.r - b.r || a.c - b.c; });
    return vyber.slice(0, volne);
  }
  function doKosikaZRamu(r0) {
    if (listRezim === 'pokladna') return;
    vstupDoKosika();
    var nove = bunkyVRame(r0);
    // Obdĺžnik bez jediného stredu (krátky ťah vnútri štvorca) berie štvorec pod začiatkom ťahu.
    if (!nove.length && kosik.length < KOSIK_STROP) {
      var b0 = bunkaNa(r0.x0, r0.y0);
      if (b0 && vKosiku(b0.id) < 0 && daSaPridat(b0.r, b0.c)) nove.push(b0);
    }
    kosik = kosik.concat(nove);
    if (kosik.length >= KOSIK_STROP) pas(T.kosikStrop);
    ziadaj();
    ukazKosik();
  }
  /** Krížik na čísle v liste košíka: ten istý účinok ako ťuk na štvorec v mape. */
  function odoberZKosika(id) {
    if (listRezim === 'pokladna') return;
    var i = vKosiku(id);
    if (i < 0) return;
    var a = document.activeElement;
    var malFokus = !!(a && a.getAttribute && a.getAttribute('data-akcia') === 'kosik-odober');
    kosik.splice(i, 1);
    zahodDrziak(id);
    ziadaj();
    ukazKosik();
    // Len keď bol fokus na zmazanom čísle (klávesnica): ide na susedné, nech
    // neskočí na začiatok stránky. Inak sa fokus nehýbe.
    if (!malFokus) return;
    var cipy = list.querySelectorAll('[data-akcia="kosik-odober"]');
    var ciel = cipy[Math.min(i, cipy.length - 1)] || list.querySelector('.list-zavri');
    if (ciel) ciel.focus();
  }
  /** Myš alebo touchpad: vtedy má zmysel ponúknuť Shift a ťah. */
  function jemnyUkazovatel() {
    try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) { return false; }
  }
  function zahodKosik() {
    kosik.forEach(function (x) { zahodDrziak(x.id); });
    kosik = [];
    kosikRezim = false;
    listRezim = 'prehlad';
    ziadaj();
    // Bez vybraného štvorca nie je čo ukázať: list sa zavrie, nech na mape
    // neostane visieť prázdny košík.
    if (S.vybrana) ukazList();
    else { list.hidden = true; prepocitajStred(); }
  }

  function bunkaNa(x, y) {
    var my = zYObr(y);
    if (my > Y_SVETA || my < -Y_SVETA) return null;
    var r = riadokZoSirky(zY(my)), c = stlpecZDlzky(r, zX(x));
    return { r: r, c: c, id: cislo(r, c) };
  }

  // ── Výber bunky a list ───────────────────────────────────────────────────
  var list = koren.querySelector('[data-list]');
  var oznam = koren.querySelector('[data-oznam]');

  function vyber(r, c, tichy) {
    dotyk();
    S.vybrana = { r: r, c: c, id: cislo(r, c) };
    S.vyberOd = poslednyCas || performance.now();
    ziadaj();
    ukazList();
    if (!tichy) sleduj('svet_klik_bunka');
    nacitajParcelu(S.vybrana.id);
    var url = new URL(location.href);
    url.searchParams.set('p', String(S.vybrana.id));
    history.replaceState(null, '', url);
  }

  var parcely = {};
  // Držiak rezervácie (hold) podľa čísla štvorca, v sessionStorage, aby prežil
  // cestu do pokladne a späť. S platnosťou (reserved_until); po nej ide do
  // naPustenie a služba ho pri ďalšej rezervácii pustí.
  var drziaky = {}, naPustenie = {};
  try {
    var ulozenePustenie = JSON.parse(sessionStorage.getItem('svet-pustit') || '{}');
    if (ulozenePustenie && typeof ulozenePustenie === 'object') naPustenie = ulozenePustenie;
  } catch (e) {}
  function ulozNaPustenie() {
    try {
      var k = Object.keys(naPustenie);
      if (k.length) sessionStorage.setItem('svet-pustit', JSON.stringify(naPustenie));
      else sessionStorage.removeItem('svet-pustit');
    } catch (e) {}
  }
  // Po platbe sa držiaky zaplatených štvorcov zahodia BEZ pustenia: list by inak
  // ponúkal kúpu vlastného štvorca a služba by pustila štvorce na kontrole.
  if (navratZPokladne === 'paid') { poPlatbe.ids.forEach(function (x) { delete naPustenie[x]; ulozDrziak(x, ''); }); ulozNaPustenie(); }
  function casZIso(iso) { var t = Date.parse(iso || ''); return isFinite(t) ? t : 0; }
  function citajDrziak(id) {
    var z = drziaky[id];
    if (!z) {
      try {
        var surove = sessionStorage.getItem('svet-hold-' + id) || '';
        // Starší zápis (do 25. 9. 2026) je holý reťazec bez platnosti.
        if (surove.charAt(0) === '{') { var j = JSON.parse(surove); z = { h: String(j.h || ''), d: Number(j.d) || 0 }; }
        else if (surove) z = { h: surove, d: 0 };
      } catch (e) { z = null; }
    }
    if (!z || !z.h) return '';
    if (z.d && Date.now() > z.d) { zahodDrziak(id, z.h); return ''; }
    drziaky[id] = z;
    return z.h;
  }
  function ulozDrziak(id, hodnota, platnost) {
    if (hodnota) {
      drziaky[id] = { h: hodnota, d: casZIso(platnost) };
      if (naPustenie[id]) { delete naPustenie[id]; ulozNaPustenie(); }
    } else delete drziaky[id];
    try {
      if (hodnota) sessionStorage.setItem('svet-hold-' + id, JSON.stringify(drziaky[id]));
      else sessionStorage.removeItem('svet-hold-' + id);
    } catch (e) {}
  }
  /** Držiak sa už nepoužije, ale pri najbližšej rezervácii ho služba pustí. */
  function zahodDrziak(id, h) {
    h = h || (drziaky[id] && drziaky[id].h) || '';
    if (!h) { try { h = sessionStorage.getItem('svet-hold-' + id) || ''; if (h.charAt(0) === '{') h = String(JSON.parse(h).h || ''); } catch (e) { h = ''; } }
    if (h) { naPustenie[id] = h; ulozNaPustenie(); }
    ulozDrziak(id, '');
  }
  function predlzDrziak(id, platnost) { var h = citajDrziak(id); if (h && casZIso(platnost)) ulozDrziak(id, h, platnost); }
  /** Zoznam na pustenie pre službu; odoslaním sa vyprázdni (služba ho spracuje hneď). */
  function pustitDrziaky() {
    var von = [];
    for (var k in naPustenie) von.push({ parcel_id: Number(k), hold: String(naPustenie[k]) });
    naPustenie = {};
    ulozNaPustenie();
    return von.slice(0, 20);
  }
  /** Je tento štvorec rezervovaný práve týmto prehliadačom? */
  function jeMojaRezervacia(id) { return !!citajDrziak(id) || !!naPustenie[id]; }
  // Čo je práve v liste. Odpoveď služby smie prekresliť len prehľad bunky: keby
  // prekreslila aj pokladňu alebo kreslenie, zmazala by človeku rozpísaný e-mail
  // a zaškrtnuté súhlasy v polovici kroku.
  var listRezim = 'prehlad';
  function obnovList() { if (listRezim === 'prehlad') ukazList(); }
  function ukazList() {
    if (!S.vybrana) return;
    listRezim = 'prehlad';
    list.classList.remove('list-kresli');
    var r = S.vybrana.r, c = S.vybrana.c, id = S.vybrana.id;
    var lat = stredRiadku(r), lon = -180 + ((c + 0.5) * 360) / STL[r];
    var p = parcely[id];
    var stav = stavBunky(r, c, p);
    // Rezervácia, ktorú drží tento prehliadač, nie je „niekto iný práve platí“.
    if (stav === 'rezervovana' && jeMojaRezervacia(id)) stav = 'volna';
    var cakam = cakaNaPotvrdenie(id) && stav !== 'predana' && stav !== 'zatvorena';
    var h = '<button class="list-zavri" type="button" data-akcia="zavri" aria-label="' + esc(T.zavriet) + '">×</button>';
    h += '<p class="list-cislo">' + esc(T.cislo) + ' ' + cisloText(id) + '</p>';
    // Každý stav má vlastnú vetu. More má meno mora, územie bez krajiny meno územia
    // a keď služba nevie nič, ostanú súradnice. Keď homelab nebeží, povie sa to
    // nahlas, netočí sa „zisťujem miesto“ donekonečna.
    var miesto = miestoHtml(p)
      || (stav === 'zatvorena' ? esc(T.nepredajne)
        : (S.sluzba === 'nedostupna' || zlyhane[id]) ? esc(T.miestoBezSluzby)
          : p ? '' : esc(T.miestoZistujem));
    h += '<p class="list-miesto">' + miesto + '</p>';
    // Názvy polí sú tie, ktoré naozaj posiela app.py: art_url (hotová adresa
    // obrázka, nie stav kresby) a founder_no.
    if (p && p.art_url) h += '<img class="list-kresba" alt="' + esc(T.kresbaAlt) + '" src="' + esc(p.art_url) + '" width="88" height="88" loading="lazy" decoding="async">';
    h += '<dl class="list-udaje">';
    h += '<div><dt>' + esc(T.suradnice) + '</dt><dd>' + esc(stupne(lat, lon)) + '</dd></div>';
    h += '<div><dt>' + esc(T.rozmer) + '</dt><dd>' + km(sirkaKm(r)) + ' × ' + km(vyskaKm(r)) + ' km</dd></div>';
    if (p && p.name) h += '<div><dt>' + esc(T.meno) + '</dt><dd>' + esc(p.name) + '</dd></div>';
    if (p && p.founder_no) h += '<div><dt>' + esc(T.zakladatel) + '</dt><dd>' + esc(String(p.founder_no)) + ' / 100</dd></div>';
    h += '</dl>';

    // Štvorec z platby, za ktorú práve prišiel kľúč do panela: tlačidlo na
    // kreslenie je hlavné. Číslo je z ?p= (píše ho ktokoľvek), preto keď služba
    // povie, že štvorec zaplatený nie je, „yours“ ani tlačidlo sa neukážu.
    var mojPoPlatbe = !!(poPlatbe.panel && poPlatbe.stvorec === id
      && (!p || p.status === 'paid' || p.status === 'hidden'));
    if (stav === 'predana' || mojPoPlatbe) {
      if (moje[id] || mojPoPlatbe) h += '<p class="list-moje">' + esc(T.jeVas) + '</p>';
      if (mojPoPlatbe) h += '<a class="btn btn-solid" href="' + esc(poPlatbe.panel) + '">' + esc(T.poPlatbeTlacidlo) + '</a>';
      if (p && p.link) h += '<a class="btn btn-line" rel="nofollow ugc noopener noreferrer" target="_blank" href="' + esc(p.link) + '">' + esc(T.otvorOdkaz) + '</a>';
      h += '<a class="btn btn-line" href="' + esc(CESTA_MAPY + T.cestaParcely + '?id=' + id) + '" data-umami-event="svet_zdielanie">' + esc(T.zdielat) + '</a>';
      if (!moje[id] && !mojPoPlatbe) h += '<button class="btn btn-line" type="button" data-akcia="nahlasit">' + esc(T.nahlasit) + '</button>';
      h += '<p class="list-pravne">' + esc(T.predaneVysvetlenie) + '</p>';
    } else if (stav === 'zatvorena') {
      h += '<p class="list-pravne">' + esc(T.nepredajneVysvetlenie) + '</p>';
    } else if (cakam) {
      h += '<p class="list-pravne">' + esc(T.cakamNaPlatbu) + '</p>';
    } else if (stav === 'rezervovana') {
      h += '<p class="list-pravne">' + esc(T.rezervovane) + '</p>';
    } else if (stav === 'neznamy') {
      // Služba nebeží alebo ešte neodpovedala. Stránka vtedy nevie, či je
      // štvorec voľný alebo predaný, a nesmie sa tváriť, že vie.
      var bezOdpovede = S.sluzba === 'nedostupna' || zlyhane[id];
      h += '<button class="btn btn-solid" type="button" disabled>' + esc(bezOdpovede ? T.kupitNedostupne : T.miestoZistujem) + '</button>';
      if (bezOdpovede) h += '<p class="list-pravne">' + esc(T.stavNeznamy) + '</p>';
    } else {
      var maKredit = majitel && majitel.k > 0;
      if (maKredit) {
        h += '<button class="btn btn-solid" type="button" data-akcia="kredit">' + esc(T.kreditTlacidlo) + '</button>';
        h += '<p class="list-pravne">' + esc(T.kreditZostava) + majitel.k + '</p>';
      }
      h += '<button class="btn ' + (maKredit ? 'btn-line' : 'btn-solid') + '" type="button" data-akcia="kupit">' + esc(T.kupit) + '</button>';
      h += '<button class="btn btn-line" type="button" data-akcia="kreslit">' + esc(T.skusKreslit) + '</button>';
      // Cena balíkov len pri košíku; kredit je iný tovar, až za právnou vetou a bez ceny.
      if (kosikZapnuty()) h += '<button class="list-balik" type="button" data-akcia="kosik">' + esc(T.kosikTlacidlo) + '</button>';
      h += '<p class="list-pravne">' + esc(T.licenciaVeta) + ' <a href="' + esc(T.cestaPodmienky) + '">' + esc(T.podmienkyOdkaz) + '</a></p>';
      h += '<button class="list-balik" type="button" data-akcia="balik">' + esc(T.balikTlacidlo) + '</button>';
    }
    list.innerHTML = h;
    list.hidden = false;
    prepocitajStred();
    if (!POKOJ) { list.classList.remove('prichadza'); void list.offsetWidth; list.classList.add('prichadza'); }
    if (oznam) oznam.textContent = T.cislo + ' ' + cisloText(id) + '. ' + (p ? (p.city || p.area || p.country_name || '') : '') + ' ' + km(sirkaKm(r)) + ' × ' + km(vyskaKm(r)) + ' km.';
  }

  /**
   * Čo sa s bunkou dá robiť: 'volna', 'rezervovana', 'predana', 'zatvorena'
   * alebo 'neznamy'. V predaji je celý svet, súš aj more, a rozhoduje o tom
   * služba: najprv odpoveď /api/parcel pre túto bunku, inak jej bajt v bloku z
   * /api/chunk. Keď nie je ani jedno (služba nebeží, alebo ešte neodpovedala),
   * stav je neznámy a nič sa netvrdí. „Zatvorená“ ostáva len pre skutočnú
   * výnimku, ktorú by služba sama ohlásila.
   */
  function stavBunky(r, c, p) {
    if (p) {
      if (p.status === 'paid' || p.status === 'hidden') return 'predana';
      if (p.status === 'pending') return 'rezervovana';
      return p.for_sale ? 'volna' : 'zatvorena';
    }
    var st = stavZBloku(r, c);
    if (st < 0) return 'neznamy';
    if (st >= ST_PREDANE) return 'predana';
    if (st === ST_REZERVOVANE) return 'rezervovana';
    return st === ST_VOLNE ? 'volna' : 'zatvorena';
  }

  list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-akcia]');
    if (!b) return;
    var a = b.getAttribute('data-akcia');
    if (a === 'kupit') pokladna(false);
    else if (a === 'balik') pokladna(true);
    else if (a === 'kosik') { sleduj('svet_kosik_otvoreny'); otvorKosik(); }
    else if (a === 'kosik-zavri') zahodKosik();
    else if (a === 'kosik-odober') odoberZKosika(Number(b.getAttribute('data-id')));
    else if (a === 'kosik-kupit') pokladna(false, true);
    else if (a === 'kreslit') kresliacePlatno();
    else if (a === 'nahlasit') nahlasit();
    else if (a === 'kredit') vezmiZKreditu(b);
    else if (a === 'zavri') zavriList();
  });
  /**
   * List košíka. Kým je človek v tomto režime, ťuknutie na mapu štvorce pridáva
   * a odoberá; odpovede služby tento list neprekreslia (listRezim), takže sa
   * výber nestratí uprostred kroku.
   */
  function ukazKosik() {
    if (!kosikZapnuty()) return;
    kosikRezim = true;
    listRezim = 'kosik';
    list.classList.remove('list-kresli');
    var h = '<button class="list-zavri" type="button" data-akcia="kosik-zavri" aria-label="' + esc(T.zavriet) + '">×</button>';
    h += '<p class="list-cislo">' + esc(kosik.length === 1 ? T.kosikNadpisJeden : T.kosikNadpis) + '</p>';
    var c = cenaKosika(kosik.length);
    if (!kosik.length || !c) {
      h += '<p class="list-miesto">' + esc(T.kosikPrazdny) + '</p>';
    } else {
      h += '<p class="list-miesto">' + kosik.length + ' ' + esc(kosik.length === 1 ? T.kosikJeden : T.kosikViac) + '</p>';
      // Návod, ako pridať ďalšie: po otvorení košíka tlačidlom ho človek inak
      // nemal odkiaľ vedieť (tretia kontrola 25. 9. 2026). Shift len pri myši.
      if (kosik.length < KOSIK_STROP) {
        h += '<p class="list-navod">' + esc(T.kosikPridajDalsie)
          + (jemnyUkazovatel() ? ' ' + esc(T.kosikShift) : '') + '</p>';
      }
      // Čísla ako čipy s krížikom: desať riadkov s rozmerom zatlačilo tlačidlo
      // kúpy pod okraj listu. Rozmer je pri každom štvorci takmer rovnaký.
      h += '<ul class="kosik-cisla" aria-label="' + esc(T.kosikNadpis) + '">';
      for (var i = 0; i < kosik.length; i++) {
        h += '<li><button type="button" data-akcia="kosik-odober" data-id="' + kosik[i].id + '" aria-label="'
          + esc(vetaSCislami(T.kosikOdober, { cislo: cisloText(kosik[i].id) })) + '">'
          + cisloText(kosik[i].id) + '<span aria-hidden="true">×</span></button></li>';
      }
      h += '</ul>';
      h += '<p class="list-pravne kosik-rozmer">' + esc(T.kosikRozmer) + '</p>';
      h += '<dl class="list-udaje">';
      // Rozpis ceny len vtedy, keď je v ňom balík: pri jednom a dvoch štvorcoch
      // je to N × 5 € a riadok navyše by nič nepovedal.
      var sBalikom = c.polozky.some(function (p) { return p[1] > 1; });
      if (sBalikom) {
        c.polozky.forEach(function (p) {
          var nazov = p[1] > 1 ? vetaSCislami(T.kosikRiadokBalik, { n: p[1] }) : T.kosikRiadokJeden;
          h += '<div><dt>' + p[3] + ' × ' + esc(nazov) + '</dt><dd>' + eurText(p[2] * p[3]) + '</dd></div>';
        });
      }
      h += '<div><dt>' + esc(T.kosikSpolu) + '</dt><dd>' + eurText(c.centov) + '</dd></div></dl>';
      if (c.centov < c.plna) h += '<p class="list-moje">' + esc(vetaSCislami(T.kosikBalikPouzity, { spolu: eurText(c.centov), plna: eurText(c.plna) })) + '</p>';
      // Dnes len pri deviatich (balík desiatich): desiaty štvorec je zadarmo.
      var volne = Math.min(c.kapacita, KOSIK_STROP) - kosik.length;
      if (volne > 0) h += '<p class="list-pravne">' + esc(vetaSCislami(volne === 1 ? T.kosikVolnyJeden : T.kosikVolne, { k: c.kapacita, n: kosik.length, volne: volne })) + '</p>';
      h += '<p class="list-pravne">' + esc(T.kosikPravne) + ' <a href="' + esc(T.cestaPodmienky) + '">' + esc(T.podmienkyOdkaz) + '</a></p>';
      // Tlačidlá sú prilepené na spodku listu: pri desiatich štvorcoch na nízkej
      // obrazovke inak kúpa zmizla pod okraj a list sa musel posúvať.
      h += '<div class="kosik-akcie">';
      // Suma priamo v tlačidle: rozpis nad ním sa pri desiatich štvorcoch odroluje.
      h += '<button class="btn btn-solid" type="button" data-akcia="kosik-kupit">' + esc(kosik.length === 1 ? T.kosikKupitJeden : T.kosikKupit) + ', ' + (c.centov % 100 ? eurText(c.centov) : '€' + c.centov / 100) + '</button>';
      h += '<button class="btn btn-line" type="button" data-akcia="kosik-zavri">' + esc(T.kosikVycisti) + '</button>';
      h += '</div>';
    }
    if (!kosik.length || !c) {
      h += '<button class="btn btn-line" type="button" data-akcia="kosik-zavri">' + esc(T.kosikHotovo) + '</button>';
      h += '<p class="list-pravne">' + esc(T.kosikPravne) + ' <a href="' + esc(T.cestaPodmienky) + '">' + esc(T.podmienkyOdkaz) + '</a></p>';
    }
    list.innerHTML = h;
    list.hidden = false;
    prepocitajStred();
  }

  function zavriList() {
    S.vybrana = null;
    list.hidden = true;
    prepocitajStred();
    var url = new URL(location.href);
    url.searchParams.delete('p');
    history.replaceState(null, '', url);
    uprav(); ziadaj();
  }

  // ── Moje štvorce a výber z kreditu balíka ────────────────────────────────
  // Kľúč majiteľa sem príde len cez sessionStorage z panela majiteľa, v tej
  // istej karte. Do adresy tejto stránky sa nedostane nikdy: beží na nej Umami
  // a to si adresu zapisuje. Službe ide v hlavičke, nikdy v adrese.
  var majitel = null, moje = {}, mojePocet = 0;
  try {
    var ulozenyMajitel = JSON.parse(sessionStorage.getItem('svet-majitel') || 'null');
    if (ulozenyMajitel && typeof ulozenyMajitel.t === 'string' && ulozenyMajitel.t) majitel = { t: ulozenyMajitel.t, k: Number(ulozenyMajitel.k) || 0 };
  } catch (e) {}
  function ulozMajitela() {
    try {
      if (majitel) sessionStorage.setItem('svet-majitel', JSON.stringify(majitel));
      else sessionStorage.removeItem('svet-majitel');
    } catch (e) {}
  }
  // „Yours“ v legende: štvorce kúpené v tomto prehliadači (číslo si stránka
  // zapamätá pri návrate z pokladne) a štvorce majiteľa, ktorý prišiel z panela.
  // Farbu dostanú až vtedy, keď ich služba naozaj vedie ako zaplatené.
  function pridajMoje(id) { if (id > 0 && !moje[id]) { moje[id] = 1; mojePocet++; } }
  function odoberMoje(id) { if (moje[id]) { delete moje[id]; mojePocet--; } }
  function ulozMoje() {
    try { localStorage.setItem('svet-moje', JSON.stringify(Object.keys(moje).map(Number).slice(-200))); } catch (e) {}
  }
  try { JSON.parse(localStorage.getItem('svet-moje') || '[]').forEach(function (x) { pridajMoje(Number(x)); }); } catch (e) {}
  // „Yours“ po platbe až z potvrdenia služby (potvrdPlatbu), nie hneď: štvorec,
  // ktorý platba nedostala, ostal inak v tomto prehliadači „yours“ navždy.
  if (navratZPokladne === 'paid') { try { sessionStorage.removeItem('svet-kosik-ids'); } catch (e) {} }
  /** Štvorec, ktorý táto karta zaplatila a služba to ešte nepotvrdila: nie druhá kúpa ani košík. */
  function cakaNaPotvrdenie(id) { return !!(poPlatbe.session && !poPlatbe.panel && poPlatbe.ids.indexOf(id) >= 0); }
  /** Štvorce, ktoré platba naozaj priradila (parcel_ids): štvorec, ktorý kúpil iný, nie je „yours“. */
  function potvrdPlatbu(zoznam) {
    zoznam = cislaZoZoznamu(zoznam);
    if (!zoznam.length) return;
    poPlatbe.ids.forEach(function (id) { if (zoznam.indexOf(id) < 0) odoberMoje(id); });
    zoznam.forEach(pridajMoje);
    if (poPlatbe.stvorec && zoznam.indexOf(poPlatbe.stvorec) < 0) poPlatbe.stvorec = zoznam[0];
    if (poPlatbe.stvorec) poPlatbe.kusov = zoznam.length;
    poPlatbe.ids = zoznam;
    ulozPoPlatbe();
    ulozMoje();
  }
  function nacitajMoje() {
    if (!majitel || !API) return;
    fetch(API + '/api/owner', { credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', headers: { 'X-Svet-Token': majitel.t } })
      .then(function (o) { return o.ok ? o.json() : null; })
      .then(function (d) { if (d && d.parcels) { d.parcels.forEach(function (x) { pridajMoje(Number(x.id)); }); ziadaj(); obnovList(); } })
      .catch(function () {});
  }

  function vezmiZKreditu(tlacidlo) {
    if (!S.vybrana || !majitel) return;
    var id = S.vybrana.id;
    tlacidlo.disabled = true;
    tlacidlo.textContent = T.pripravujem;
    var nast = { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: majitel.t, parcel_id: id }) };
    fetch(API + '/api/owner/claim', nast).then(function (o) {
      return o.json().catch(function () { return {}; }).then(function (d) { return { kod: o.status, d: d }; });
    }).then(function (v) {
      if (v.kod === 401) { majitel = null; ulozMajitela(); pas(T.kreditNeplatny); ukazList(); return; }
      if (v.kod === 402) { majitel.k = 0; ulozMajitela(); ukazList(); return; }
      if (v.kod !== 200 || !v.d.ok) { delete parcely[id]; nacitajParcelu(id); pas(T.kreditChyba); ukazList(); return; }
      majitel.k = Number(v.d.credit) || 0;
      ulozMajitela();
      pridajMoje(id);
      if (v.d.parcel) parcely[id] = v.d.parcel;
      delete bloky[(S.vybrana.r >> 6) + ',' + (S.vybrana.c >> 6)];
      naplanujBloky();
      sleduj('svet_stvorec_z_kreditu');
      ukazList();
      list.insertAdjacentHTML('beforeend', '<p class="list-pravne">' + esc(T.kreditHotovo) + '</p><a class="btn btn-solid" href="' + esc(T.cestaPanela) + '">' + esc(T.kreditPanel) + '</a>');
      ziadaj();
    }).catch(function () { tlacidlo.disabled = false; tlacidlo.textContent = T.kreditTlacidlo; pas(T.kreditChyba); });
  }

  // ── Homelab. Keď nebeží, mapa funguje ďalej a napíše sa to. ─────────────
  var vrstva2 = { platno: null, kedy: 0 };
  var bloky = {};

  function skusSluzbu() {
    api('/api/health').then(function () {
      S.sluzba = 'bezi';
      // Pás po návrate z pokladne sa neschováva; ani ten s odkazom do panela,
      // ktorý v tejto karte prežil obnovenie stránky.
      if (!navratZPokladne && !poPlatbe.panel) skryPas();
      nacitajStav();
      nacitajVrstvu();
      nacitajMoje();
      naplanujBloky();
      // Bunka z adresy (?p=) sa vybrala skôr, než služba odpovedala, takže jej
      // údaje sa pýtame až teraz. Bez toho ostala navždy pri „zisťujem miesto“.
      if (S.vybrana) nacitajParcelu(S.vybrana.id);
      obnovList();
    }).catch(function () {
      S.sluzba = 'nedostupna';
      pas(T.sluzbaNedostupna);
      obnovList();
    });
  }

  var pasEl = koren.querySelector('[data-pas]');
  function pas(text) { if (pasEl) { pasEl.classList.remove('mapa-stav-akcia'); pasEl.textContent = text; pasEl.hidden = false; } }
  /**
   * Pás s vetou a jedným tlačidlom. Pás je role="status" (postav.mjs), takže ho
   * čítačka prečíta sama; FOKUS SA NEKRADNE. Kto práve píše do vyhľadávania,
   * nesmie prísť o kurzor len preto, že dorazila platba.
   */
  function pasSTlacidlom(text, popis, url) {
    if (!pasEl) return;
    pasEl.innerHTML = '<span>' + esc(text) + '</span><a class="btn btn-solid" href="' + esc(url) + '">' + esc(popis) + '</a>';
    pasEl.classList.add('mapa-stav-akcia');
    pasEl.hidden = false;
  }
  function skryPas() { if (pasEl) pasEl.hidden = true; }

  // ── Odkaz do panela hneď po platbe ───────────────────────────────────────
  // Každé 3 s najviac 40 s. Kým služba hovorí "pending", ostáva veta o e-maile;
  // potom pás aj list dostanú tlačidlo „Name it and draw“. E-mail ide tak či tak.
  var PYTANIE_MS = 3000, PYTANIE_NAJDLHSIE_MS = 40000;
  function ukazOdkazDoPanela() {
    if (!poPlatbe.panel) return;
    // Balík sa kupuje bez štvorca. Vtedy sa nesmie napísať „the square is
    // yours“: kúpil sa kredit a štvorce si človek vyberie až na mape.
    var jeStvorec = poPlatbe.stvorec > 0, jeKosik = jeStvorec && poPlatbe.kusov > 1;
    pasSTlacidlom(jeKosik ? T.poPlatbeHotovoKosik : jeStvorec ? T.poPlatbeHotovo : T.poPlatbeHotovoBalik,
      jeKosik ? T.poPlatbeTlacidloKosik : jeStvorec ? T.poPlatbeTlacidlo : T.poPlatbeTlacidloBalik, poPlatbe.panel);
  }
  function pytajOdkazDoPanela() {
    if (!API || !poPlatbe.session) return;
    if (poPlatbe.panel) { ukazOdkazDoPanela(); return; }
    var koniec = Date.now() + PYTANIE_NAJDLHSIE_MS;
    function znova() { if (Date.now() < koniec) setTimeout(skus, PYTANIE_MS); }
    function skus() {
      fetch(API + '/api/owner/session-link', {
        method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: poPlatbe.session }),
      })
        .then(function (o) { return o.ok ? o.json() : null; })
        .then(function (d) {
          if (!d || !d.ok || !d.owner_url) { znova(); return; }
          poPlatbe.panel = String(d.owner_url);
          ulozPoPlatbe();
          // Služba spred 25. 9. 2026 zoznam neposiela: vtedy štvorce z adresy a košíka.
          potvrdPlatbu(Array.isArray(d.parcel_ids) ? d.parcel_ids : poPlatbe.ids);
          ziadaj();
          sleduj('svet_panel_hned_po_platbe');
          ukazOdkazDoPanela();
          // Štvorec už je zaplatený; nech to list aj mapa ukážu bez obnovenia.
          if (poPlatbe.stvorec) {
            delete parcely[poPlatbe.stvorec];
            nacitajParcelu(poPlatbe.stvorec);
          }
          obnovList();
        })
        .catch(function () { znova(); });
    }
    skus();
  }

  function nacitajStav() {
    api('/api/state.json').then(function (d) {
      S.stav = d;
      // Cenník košíka zo služby (kombinacia_kosika): list ukáže sumu, ktorú Stripe zaúčtuje.
      // Služba bez neho (staršia než 25. 9. 2026) účtuje N × 5 €, tak to list povie.
      var ceny = d && d.kosik && d.kosik.ceny;
      CENNIK_KOSIKA = Array.isArray(ceny) && ceny.length && ceny.every(function (x) {
        return Array.isArray(x) && typeof x[0] === 'string' && x[1] >= 1 && x[1] <= KOSIK_STROP && Number(x[2]) >= 0;
      }) ? ceny : [['single', 1, Number(T.kosikCenaEur) || 5]];
      if (listRezim === 'kosik') ukazKosik();
      // Tvar odpovede je {"etapa":{"buniek":…,"predanych":…}}. Počítadlo je pod
      // mapou, v páse čísel, a ukazuje len to, čo služba naozaj vedie ako obsadené.
      var el = document.querySelector('[data-pocitadlo]');
      var e = d && d.etapa;
      if (el && e && typeof e.predanych === 'number') el.textContent = cisloText(e.predanych);
    }).catch(function () {});
  }

  function nacitajVrstvu() {
    if (S.sluzba !== 'bezi') return;
    fetch(API + '/api/overlay.png', { cache: 'default' })
      .then(function (o) { if (!o.ok) throw 0; return o.blob(); })
      .then(createImageBitmap)
      .then(function (b) { vrstva2.platno = doMercatoraVrstvu(b); b.close(); vrstva2.kedy = Date.now(); ziadaj(); })
      .catch(function () {});
  }

  /**
   * Vrstva zo služby je rovnobežníková (riadok obrázka = rovnaký kus zemepisnej
   * šírky od pólu k pólu), mapa je v Mercatore. Tu sa raz za minútu prevzorkuje po
   * riadkoch do štvorcového plátna v Mercatore; v snímku je to potom jedno drawImage.
   */
  function doMercatoraVrstvu(bmp) {
    var w = bmp.width, h = w;
    var p = vrstva2.platno || document.createElement('canvas');
    p.width = w; p.height = h;
    var c = p.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, w, h);
    for (var j = 0; j < h; j++) {
      var lat = zY(Y_SVETA - ((j + 0.5) * 2 * Y_SVETA) / h);
      var zdroj = Math.min(bmp.height - 1, Math.max(0, Math.floor(((90 - lat) / 180) * bmp.height)));
      c.drawImage(bmp, 0, zdroj, w, 1, 0, j, w, 1);
    }
    return p;
  }

  var zlyhane = {};
  function nacitajParcelu(id) {
    if (S.sluzba !== 'bezi' || parcely[id]) { if (parcely[id]) obnovList(); return; }
    api('/api/parcel/' + id)
      .then(function (d) { parcely[id] = d; delete zlyhane[id]; if (S.vybrana && S.vybrana.id === id) obnovList(); })
      .catch(function () { zlyhane[id] = true; if (S.vybrana && S.vybrana.id === id) obnovList(); });
  }

  /**
   * Vlastníctvo po blokoch 64 × 64. Prehliadač nikdy nedostane všetkých päť
   * miliónov buniek, sťahuje len bloky, ktoré práve vidno.
   */
  function dopytajBloky() {
    if (S.sluzba !== 'bezi' || document.hidden) return;
    var rHore = riadokZoSirky(zY(naSvete(zYObr(0)))), rDole = riadokZoSirky(zY(naSvete(zYObr(S.h))));
    if (!zblizka()) return;
    var zoznam = [], STROP = 32;
    // Blok je 64 riadkov × 64 STĹPCOV V RIADKU, a riadky majú rôzny počet stĺpcov.
    // Ten istý poludník je preto v hornom riadku bloku v inom stĺpci než v dolnom.
    // Stĺpce sa preto berú z krajných VIDITEĽNÝCH riadkov, nie zo stredu bloku.
    var lonOd = zX(0), lonDo = zX(S.w);
    for (var rb = rHore >> 6; rb <= (rDole >> 6) && zoznam.length < STROP; rb++) {
      var rOd = Math.max(rHore, rb << 6), rDo = Math.min(rDole, (rb << 6) + 63, RIADKY - 1);
      var cOd = Math.min(stlpecZDlzky(rOd, lonOd), stlpecZDlzky(rDo, lonOd)) >> 6;
      var cDo = Math.max(stlpecZDlzky(rOd, lonDo), stlpecZDlzky(rDo, lonDo)) >> 6;
      var posledny = (Math.max(STL[rOd], STL[rDo]) - 1) >> 6;
      if (cDo >= cOd) {
        for (var c = cOd; c <= cDo && zoznam.length < STROP; c++) zoznam.push([rb, c]);
      } else {
        // Výrez leží cez 180. poludník: od ľavého okraja po koniec riadku a od nuly po pravý okraj.
        for (var c1 = cOd; c1 <= posledny && zoznam.length < STROP; c1++) zoznam.push([rb, c1]);
        for (var c2 = 0; c2 <= cDo && zoznam.length < STROP; c2++) zoznam.push([rb, c2]);
      }
    }
    zoznam.forEach(function (b) {
      var kluc = b[0] + ',' + b[1];
      if (bloky[kluc] && !bloky[kluc].stare) return;
      // Služba posiela 4096 bajtov, jeden stav na bunku (ST_* vyššie), nie bity.
      // Zastaraný blok sa kreslí ďalej, kým nepríde nový, aby predané bunky neblikli.
      var blok = bloky[kluc] || (bloky[kluc] = { r0: b[0] << 6, c0: b[1] << 6, stavy: null });
      blok.stare = false;
      fetch(API + '/api/chunk/' + b[0] + '/' + b[1])
        .then(function (o) { if (!o.ok) throw 0; return o.arrayBuffer(); })
        .then(function (buf) {
          blok.stavy = new Uint8Array(buf);
          blok.maKresbu = false;
          for (var q = 0; q < blok.stavy.length; q++) {
            if (blok.stavy[q] === ST_KRESBA || blok.stavy[q] === ST_ZAKLADATEL_KRESBA) { blok.maKresbu = true; break; }
          }
          ziadaj();
          // Vybraná bunka bez vlastnej odpovede služby sa práve dozvedela svoj stav.
          if (S.vybrana && !parcely[S.vybrana.id] && (S.vybrana.r >> 6) === b[0] && (S.vybrana.c >> 6) === b[1]) obnovList();
        })
        .catch(function () { if (bloky[kluc] === blok && !blok.stavy) delete bloky[kluc]; else blok.stare = true; });
    });
  }
  var blokyTimer = 0;
  function naplanujBloky() { clearTimeout(blokyTimer); blokyTimer = setTimeout(dopytajBloky, 220); }
  setInterval(function () {
    if (document.hidden || S.sluzba !== 'bezi') return;
    nacitajVrstvu(); nacitajStav();
    // Bloky si služba drží minútu; po nej sa tie viditeľné vypýtajú znova, aby
    // štvorec, ktorý medzitým niekto kúpil, neostal na mape voľný do obnovenia stránky.
    for (var k in bloky) bloky[k].stare = true;
    for (var a in atlasy) atlasy[a].stare = true;   // nová alebo práve schválená kresba
    naplanujBloky();
  }, 60000);

  // ── Pokladňa ─────────────────────────────────────────────────────────────
  /**
   * Pokladňa v liste. Bez balíka: jeden štvorec, najprv rezervácia, potom Stripe.
   * S balíkom: kredit na 3 alebo 10 štvorcov, bez rezervácie a bez čísla štvorca;
   * štvorce si majiteľ vyberá až potom, z panela majiteľa na tejto mape.
   * S košíkom: presne označené štvorce za najlacnejšiu kombináciu balíkov
   * (cenaKosika, v službe kombinacia_kosika).
   */
  function pokladna(balik, jeKosik) {
    if (jeKosik && !kosik.length) return;
    if (!jeKosik && !S.vybrana) return;
    sleduj(jeKosik ? 'svet_otvorena_pokladna_kosik' : balik ? 'svet_otvorena_pokladna_balik' : 'svet_otvorena_pokladna');
    listRezim = 'pokladna';
    list.classList.remove('list-kresli');
    var id = S.vybrana ? S.vybrana.id : 0;
    var n = kosik.length;
    var h = '<p class="list-cislo">' + (jeKosik ? esc(n === 1 ? T.kosikNadpisJeden : T.kosikNadpis + ' (' + n + ')')
      : balik ? esc(T.balikNadpis) : esc(T.cislo) + ' ' + cisloText(id)) + '</p>';
    if (TEST) h += '<p class="list-test" role="note">' + esc(T.testRezim) + '</p>';
    // Suma košíka aj tu, pri súhlasoch: pokladňa Stripe ju potom ukáže tú istú.
    var cenaTu = jeKosik ? cenaKosika(n) : null;
    if (cenaTu) h += '<p class="list-miesto">' + esc(vetaSCislami(n === 1 ? T.kosikPokladnaSumaJeden : T.kosikPokladnaSuma, { n: n, spolu: eurText(cenaTu.centov) })) + '</p>';
    if (balik) {
      h += '<p class="list-miesto">' + esc(T.balikUvod) + '</p>';
      h += '<fieldset class="vyber-balika"><legend class="skryte">' + esc(T.balikNadpis) + '</legend>';
      h += '<label class="suhlas"><input type="radio" name="svet-balik" value="pack3" checked><span>' + esc(T.balik3) + '</span></label>';
      h += '<label class="suhlas"><input type="radio" name="svet-balik" value="pack10"><span>' + esc(T.balik10) + '</span></label></fieldset>';
    }
    h += '<p class="list-miesto">' + esc(T.pokladnaUvod) + '</p>';
    // Kredit a košík viacerých štvorcov majú vlastnú vetu súhlasu.
    var suhlas = balik ? T.suhlasKredit : (jeKosik && n > 1 && T.suhlasDodanieKosik) ? T.suhlasDodanieKosik : T.suhlasDodanie;
    h += '<label class="suhlas"><input type="checkbox" data-suhlas="dodanie"><span>' + esc(suhlas) + '</span></label>';
    h += '<label class="suhlas"><input type="checkbox" data-suhlas="vek"><span>' + esc(T.suhlasVek) + '</span></label>';
    h += '<label class="suhlas suhlas-mail"><span class="skryte">' + esc(T.email) + '</span><input type="email" data-email autocomplete="email" placeholder="' + esc(T.email) + '" required></label>';
    // Darček je v cenníku: meno obdarovaného ide na certifikát. Nikde inde sa neukazuje.
    if (!balik && !jeKosik) h += '<label class="suhlas suhlas-mail"><span class="skryte">' + esc(T.darcek) + '</span><input type="text" data-darcek maxlength="60" autocomplete="off" placeholder="' + esc(T.darcek) + '"></label>';
    h += '<button class="btn btn-solid" type="button" data-akcia="zaplatit" disabled>' + esc(T.pokracovatNaPlatbu) + '</button>';
    h += '<button class="btn btn-line" type="button" data-akcia="spat">' + esc(T.spat) + '</button>';
    h += '<p class="list-pravne">' + esc(T.pokladnaPravne) + ' <a href="' + esc(T.cestaOdstupenie) + '">' + esc(T.odstupenieOdkaz) + '</a></p>';
    list.innerHTML = h;
    var tlacidlo = list.querySelector('[data-akcia="zaplatit"]');
    var dodanie = list.querySelector('[data-suhlas="dodanie"]');
    var vek = list.querySelector('[data-suhlas="vek"]');
    var mail = list.querySelector('[data-email]');
    function prever() { tlacidlo.disabled = !(dodanie.checked && vek.checked && /.+@.+\..+/.test(mail.value)); }
    [dodanie, vek, mail].forEach(function (el) { el.addEventListener('input', prever); });
    tlacidlo.addEventListener('click', function () {
      tlacidlo.disabled = true;
      tlacidlo.textContent = T.pripravujem;
      // Rezervácia vráti držiak (hold). Bez neho pokladňa vráti 403: je to
      // to jediné, čím služba vie, že túto bunku drží práve tento prehliadač.
      // Mená polí sú presne tie, ktoré číta app.py, teda consent_delivery.
      var objednavka = { locale: JAZYK, email: mail.value.trim(), consent_delivery: true, consent_age: true };
      if (TEST) objednavka.test = true;
      var krok, idcka = [];
      if (jeKosik) {
        // Najprv sa rezervujú všetky naraz (všetky, alebo ani jeden), potom jedna
        // pokladňa na N štvorcov. Platne držané štvorce sa nerezervujú znova.
        objednavka.product = 'basket';
        idcka = kosik.map(function (x) { return x.id; });
        var rezervujKosik = function () {
          var bez = kosik.filter(function (x) { return !citajDrziak(x.id); });
          if (!bez.length) return Promise.resolve();
          // Kresba spravená pred platbou ide so štvorcom, ako pri jednom štvorci.
          return api('/api/reserve-many', { cells: bez.map(function (x) { return { row: x.r, col: x.c, pixels: kresbaNaOdoslanie(x.id) }; }), release: pustitDrziaky() })
            .then(function (r) { ((r && r.cells) || []).forEach(function (x) { ulozDrziak(x.parcel_id, x.hold, r.reserved_until); }); });
        };
        var zaplatKosik = function () {
          objednavka.cells = kosik.map(function (x) { return { parcel_id: x.id, hold: citajDrziak(x.id) }; });
          if (!objednavka.cells.length || objednavka.cells.some(function (x) { return !x.hold; })) throw new Error('bez rezervacie');
          // Po návrate z platby sa všetky štvorce košíka ukážu ako „yours“, nie len prvý.
          try { sessionStorage.setItem('svet-kosik-ids', JSON.stringify(idcka)); } catch (e) {}
          return api('/api/checkout', objednavka);
        };
        krok = rezervujKosik().then(zaplatKosik).catch(function (chyba) {
          if (!vlastnyDrziakNeplati(chyba)) throw chyba;
          kosik.forEach(function (x) { zahodDrziak(x.id); });
          return rezervujKosik().then(zaplatKosik);
        });
      } else if (balik) {
        var zvoleny = list.querySelector('input[name="svet-balik"]:checked');
        objednavka.product = zvoleny ? zvoleny.value : 'pack3';
        krok = api('/api/checkout', objednavka);
      } else {
        var darcek = list.querySelector('[data-darcek]');
        objednavka.product = 'single';
        objednavka.parcel_id = id;
        idcka = [id];
        if (darcek && darcek.value.trim()) objednavka.gift_name = darcek.value.trim();
        var vybrana = S.vybrana;
        var rezervujJeden = function () {
          return api('/api/reserve', { row: vybrana.r, col: vybrana.c, pixels: kresbaNaOdoslanie(id), release: pustitDrziaky() })
            .then(function (r) { ulozDrziak(id, r && r.hold, r && r.reserved_until); });
        };
        var zaplatJeden = function () {
          objednavka.hold = citajDrziak(id);
          if (!objednavka.hold) throw new Error('bez rezervacie');
          return api('/api/checkout', objednavka);
        };
        // Kto už tento štvorec platne drží (pokladňa sa predtým neotvorila, alebo
        // sa z nej vrátil späť), nerezervuje druhý raz.
        krok = (citajDrziak(id) ? Promise.resolve() : rezervujJeden()).then(zaplatJeden).catch(function (chyba) {
          if (!vlastnyDrziakNeplati(chyba)) throw chyba;
          zahodDrziak(id);
          return rezervujJeden().then(zaplatJeden);
        });
      }
      krok
        .then(function (d) {
          if (!d || !d.url) throw new Error('bez adresy');
          idcka.forEach(function (x) { predlzDrziak(x, d.reserved_until); });
          sleduj('svet_odchod_do_stripe');
          location.href = d.url;
        })
        .catch(function (chyba) {
          var kod = kodChyby(chyba);
          // 409: bunku medzitým niekto zarezervoval alebo kúpil (vlastný neplatný
          // držiak sa sem nedostane, ten sa vyššie obnoví). „Skúste znova“ by
          // človeka poslalo do slučky.
          var testVypnuty = chyba && chyba.dovod === 'test-disabled';
          if (jeKosik && (kod === 409 || kod === 403) && !testVypnuty) {
            // Obsadené štvorce (služba povie ktoré) z výberu vypadnú, ostatné ostanú.
            var obsadene = (chyba.obsadene || []).filter(function (x) { return vKosiku(x) >= 0; });
            if (chyba.dovod === 'taken' && obsadene.length) {
              obsadene.forEach(function (x) {
                var b = kosik[vKosiku(x)];
                kosik.splice(vKosiku(x), 1);
                ulozDrziak(x, '');
                delete parcely[x];
                delete bloky[(b.r >> 6) + ',' + (b.c >> 6)];
              });
              naplanujBloky();
              var veta = vetaSCislami(obsadene.length === 1 ? T.kosikObsadenyJeden : T.kosikObsadeneViac,
                { cisla: obsadene.map(cisloText).join(', ') });
              if (kosik.length) ukazKosik(); else zahodKosik();
              pas(veta + ' ' + (kosik.length ? T.kosikZvysok : T.kosikVyberInde));
              ziadaj();
              return;
            }
            // Bez zoznamu (staršia služba): výber sa zahodí.
            kosik.forEach(function (x) { zahodDrziak(x.id); delete parcely[x.id]; delete bloky[(x.r >> 6) + ',' + (x.c >> 6)]; });
            pas(T.kosikObsadene);
            zahodKosik();
            naplanujBloky();
            return;
          }
          if (!balik && !jeKosik && (kod === 409 || (kod === 403 && !testVypnuty))) {
            zahodDrziak(id);
            delete parcely[id];
            if (S.vybrana) delete bloky[(S.vybrana.r >> 6) + ',' + (S.vybrana.c >> 6)];
            pas(T.uzObsadene);
            ukazList();
            nacitajParcelu(id);
            naplanujBloky();
            return;
          }
          tlacidlo.textContent = kod === 429 ? T.privelaPokusov : testVypnuty ? T.testVypnuty : T.pokladnaChyba;
          tlacidlo.disabled = kod === 429 || testVypnuty;
        });
    });
    list.querySelector('[data-akcia="spat"]').addEventListener('click', jeKosik ? ukazKosik : ukazList);
  }

  /** Kresba uložená pred platbou ako 1024 čísel 0 až 15, alebo null. */
  function kresbaNaOdoslanie(id) {
    var ulozene = null;
    try { ulozene = localStorage.getItem('svet-kresba-' + id); } catch (e) { return null; }
    if (!ulozene) return null;
    try {
      var u = atob(ulozene);
      if (u.length < 1024) return null;
      var von = new Array(1024);
      for (var i = 0; i < 1024; i++) { var v = u.charCodeAt(i); von[i] = v > 15 ? 0 : v; }
      return von;
    } catch (e) { return null; }
  }

  function nahlasit() {
    if (!S.vybrana) return;
    var dovod = window.prompt(T.nahlasitVyzva, '');
    if (!dovod) return;
    // parcel_id a field, presne ako ich číta app.py.
    api('/api/report', { parcel_id: S.vybrana.id, field: 'art', reason: dovod.slice(0, 80), detail: dovod.slice(0, 1000) })
      .then(function () { pas(T.nahlasenePrijate); })
      .catch(function () { pas(T.nahlasenieMailom); });
  }

  // ── Kreslenie 32 × 32 pred zaplatením ───────────────────────────────────
  // Presne tých šestnásť farieb, ktoré má products/svet/obrazok.py FARBY_KRESBY.
  // Musia sedieť na bajt: mapa aj PDF certifikát kreslia z tej istej palety, a keď
  // sa rozídu, človek dostane inú kresbu, než akú nakreslil. Poradie je záväzné.
  var PALETA = ['#10100e', '#3a3632', '#6f665c', '#b9aea1', '#f2ece2', '#b4552d', '#d98a3d', '#f0c674',
    '#7d8f4a', '#4a7a55', '#4f8fa6', '#35597e', '#6d5a8f', '#a0486b', '#8a5a3c', '#cfd6c9'];
  var PRAZDNA_FARBA = 0;   // index „nič“; formát ukladá štyri bity na bod
  function kresliacePlatno() {
    if (!S.vybrana) return;
    sleduj('svet_prve_kreslenie');
    listRezim = 'kreslenie';
    // Na telefóne zaberie editor celú obrazovku: plátno, paleta aj tlačidlá musia byť vidno naraz,
    // lebo nad plátnom sa nedá rolovať (touch-action: none).
    list.classList.add('list-kresli');
    list.scrollTop = 0;
    var id = S.vybrana.id;
    // Úložisko môže byť zakázané (súkromné okno, prísne nastavenie). Kreslenie má
    // fungovať aj vtedy, len sa kresba nezapamätá.
    var ulozene = null;
    try { ulozene = localStorage.getItem('svet-kresba-' + id); } catch (e) {}
    var h = '<p class="list-cislo">' + esc(T.kresliNadpis) + '</p>';
    h += '<p class="list-miesto">' + esc(T.kresliUvod) + '</p>';
    h += '<div class="kreslenie"><canvas width="32" height="32" data-kresba aria-label="' + esc(T.kresliNadpis) + '"></canvas>';
    h += '<div class="paleta">' + PALETA.map(function (f, i) {
      return '<button type="button" data-farba="' + i + '" aria-label="' + esc(T.farba) + ' ' + (i + 1) + '" aria-pressed="' + (i === 5) + '"></button>';
    }).join('') + '</div>';
    h += '<div class="kreslenie-ovladanie"><button type="button" data-kres="guma">' + esc(T.guma) + '</button><button type="button" data-kres="vycisti">' + esc(T.vycisti) + '</button></div></div>';
    h += '<button class="btn btn-solid" type="button" data-akcia="kupit">' + esc(T.kupit) + '</button>';
    h += '<button class="btn btn-line" type="button" data-akcia="spat2">' + esc(T.spat) + '</button>';
    h += '<p class="list-pravne">' + esc(T.kresliPravne) + '</p>';
    list.innerHTML = h;

    var svatky = list.querySelectorAll('[data-farba]');
    for (var fi = 0; fi < svatky.length; fi++) svatky[fi].style.background = PALETA[fi];
    var kp = list.querySelector('[data-kresba]');
    var kctx = kp.getContext('2d');
    var body = new Uint8Array(1024).fill(PRAZDNA_FARBA);
    if (ulozene) {
      try {
        var u = atob(ulozene);
        // Staršie uložené kresby mali prázdno mimo palety; služba berie len
        // 0 až 15, tak sa to tu preloží a nikomu nič nezmizne.
        for (var i = 0; i < 1024 && i < u.length; i++) { var v = u.charCodeAt(i); body[i] = v > 15 ? PRAZDNA_FARBA : v; }
      } catch (e) {}
    }
    var farba = 5;
    function prekresli() {
      kctx.clearRect(0, 0, 32, 32);
      for (var i = 0; i < 1024; i++) {
        kctx.fillStyle = PALETA[body[i]] || PALETA[PRAZDNA_FARBA];
        kctx.fillRect(i % 32, (i / 32) | 0, 1, 1);
      }
    }
    prekresli();
    // Ťah prstom alebo myšou. Medzi dvoma udalosťami pohybu sa kreslí súvislá čiara
    // (Bresenham), inak rýchly prst nechá len bodky (nájdené 21. 9. 2026 na telefóne:
    // z dvoch dlhých ťahov ostalo deväť bodov). Ukladá sa na konci ťahu, nie pri každom bode.
    function bod(e) {
      var r = kp.getBoundingClientRect();
      var x = Math.floor(((e.clientX - r.left) / r.width) * 32), y = Math.floor(((e.clientY - r.top) / r.height) * 32);
      return { x: x < 0 ? 0 : x > 31 ? 31 : x, y: y < 0 ? 0 : y > 31 ? 31 : y };
    }
    function ciara(a, b) {
      var dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y), sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1, chyba = dx - dy, x = a.x, y = a.y;
      for (;;) {
        body[y * 32 + x] = farba;
        if (x === b.x && y === b.y) break;
        var e2 = 2 * chyba;
        if (e2 > -dy) { chyba -= dy; x += sx; }
        if (e2 < dx) { chyba += dx; y += sy; }
      }
    }
    function uloz() {
      var s = '';
      for (var i = 0; i < 1024; i++) s += String.fromCharCode(body[i]);
      try { localStorage.setItem('svet-kresba-' + id, btoa(s)); } catch (e2) {}
    }
    var posledny = null;
    kp.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      e.preventDefault();
      try { kp.setPointerCapture(e.pointerId); } catch (err) {}
      posledny = bod(e);
      ciara(posledny, posledny);
      prekresli();
    });
    kp.addEventListener('pointermove', function (e) {
      if (!posledny) return;
      // Prehliadač zlučuje rýchle pohyby do jednej udalosti; rozbalené dajú hladšiu čiaru.
      var kusy = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      if (!kusy || !kusy.length) kusy = [e];
      for (var k = 0; k < kusy.length; k++) { var b = bod(kusy[k]); ciara(posledny, b); posledny = b; }
      prekresli();
    });
    function koniecTahu() { if (posledny) { posledny = null; uloz(); } }
    kp.addEventListener('pointerup', koniecTahu);
    // Prehliadač vie ťah prerušiť (prichádzajúci hovor, gesto systému). Bez tohto
    // by sa potom maľovalo aj pri obyčajnom pohybe myši nad plátnom.
    kp.addEventListener('pointercancel', koniecTahu);
    list.querySelector('.paleta').addEventListener('click', function (e) {
      var b = e.target.closest('[data-farba]');
      if (!b) return;
      farba = Number(b.getAttribute('data-farba'));
      list.querySelectorAll('[data-farba]').forEach(function (x) { x.setAttribute('aria-pressed', String(Number(x.getAttribute('data-farba')) === farba)); });
    });
    list.querySelector('[data-kres="guma"]').addEventListener('click', function () {
      farba = PRAZDNA_FARBA;
      list.querySelectorAll('[data-farba]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
    });
    list.querySelector('[data-kres="vycisti"]').addEventListener('click', function () {
      body.fill(PRAZDNA_FARBA);
      prekresli();
      // Vymazaná kresba sa musí vymazať aj z úložiska. Inak by sa pri kúpe na
      // štvorec preniesla tá stará, ktorú človek práve zahodil.
      try { localStorage.removeItem('svet-kresba-' + id); } catch (e) {}
    });
    list.querySelector('[data-akcia="spat2"]').addEventListener('click', ukazList);
  }

  // ── Hľadanie miesta ──────────────────────────────────────────────────────
  var hladaciePole = koren.querySelector('[data-hladanie]');
  // Tlačidlo „Pick a square“ v hlavičke vedie na túto stránku. Keď už na nej človek je,
  // nemá sa stránka načítať znova: vráti sa hore a kurzor skočí do hľadania miesta.
  var ctaHlavicky = document.querySelector('[data-site-cta]');
  if (ctaHlavicky && hladaciePole) ctaHlavicky.addEventListener('click', function (e) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    hladaciePole.focus({ preventScroll: true });
  });
  var navrhy = koren.querySelector('[data-navrhy]');
  var index = null, indexSa = false;
  function bezDiakritiky(s) { return s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() : s.toLowerCase(); }

  function nacitajIndex() {
    if (index || indexSa) return;
    indexSa = true;
    fetch(ZAKLAD + 'obce.txt', { cache: 'force-cache' })
      .then(function (o) { return o.text(); })
      .then(function (t) {
        var riadky = t.split('\n');
        index = { meno: new Array(riadky.length), kluc: new Array(riadky.length), lat: new Float64Array(riadky.length), lon: new Float64Array(riadky.length), kod: new Array(riadky.length) };
        for (var i = 0; i < riadky.length; i++) {
          var p = riadky[i].split('\t');
          index.meno[i] = p[0]; index.kluc[i] = bezDiakritiky(p[0]);
          index.lat[i] = Number(p[1]) / 1e4; index.lon[i] = Number(p[2]) / 1e4; index.kod[i] = p[3];
        }
        hladaj();
      })
      .catch(function () { indexSa = false; });
  }

  var vybranyNavrh = -1;
  function hladaj() {
    var q = bezDiakritiky(hladaciePole.value.trim());
    if (q.length < 2) { navrhy.hidden = true; navrhy.innerHTML = ''; return; }
    if (!index) { nacitajIndex(); navrhy.hidden = false; navrhy.innerHTML = '<li><button type="button" disabled>' + esc(T.hladamZoznam) + '</button></li>'; return; }
    var zac = [], vnutri = [];
    for (var i = 0; i < index.kluc.length; i++) {
      var k = index.kluc[i];
      if (k.length < q.length) continue;
      if (k.lastIndexOf(q, 0) === 0) { zac.push(i); if (zac.length > 60) break; }
      else if (vnutri.length < 40 && k.indexOf(q) > 0) vnutri.push(i);
    }
    var vysl = zac.concat(vnutri).sort(function (a, b) { return index.meno[a].length - index.meno[b].length; }).slice(0, 12);
    if (!vysl.length) { navrhy.hidden = false; navrhy.innerHTML = '<li><button type="button" disabled>' + esc(T.nicSaNenaslo) + '</button></li>'; return; }
    navrhy.innerHTML = vysl.map(function (i) {
      return '<li><button type="button" data-i="' + i + '">' + esc(index.meno[i]) + '<span>' + esc(index.kod[i]) + '</span></button></li>';
    }).join('');
    navrhy.hidden = false;
    vybranyNavrh = -1;
  }

  if (hladaciePole) {
    hladaciePole.addEventListener('focus', nacitajIndex, { once: true });
    hladaciePole.addEventListener('input', hladaj);
    hladaciePole.addEventListener('keydown', function (e) {
      var polozky = navrhy.querySelectorAll('button:not([disabled])');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!polozky.length) return;
        vybranyNavrh = (vybranyNavrh + (e.key === 'ArrowDown' ? 1 : polozky.length - 1)) % polozky.length;
        polozky.forEach(function (b, i) { b.setAttribute('aria-selected', String(i === vybranyNavrh)); });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        var c = polozky[vybranyNavrh >= 0 ? vybranyNavrh : 0];
        if (c) c.click();
      } else if (e.key === 'Escape') { navrhy.hidden = true; }
    });
    navrhy.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]');
      if (!b) return;
      var i = Number(b.getAttribute('data-i'));
      navrhy.hidden = true;
      hladaciePole.value = index.meno[i];
      letNaBunku(index.lat[i], index.lon[i]);
      sleduj('svet_hladanie');
    });
    document.addEventListener('click', function (e) { if (!koren.querySelector('.hladanie').contains(e.target)) navrhy.hidden = true; });
  }

  // ── Skok na moju polohu. Len po kliknutí, nikdy sám od seba. ─────────────
  // Poloha ostáva v prehliadači: mapa na ňu preletí a vyberie štvorec, takže
  // služba sa dozvie nanajvýš číslo toho štvorca (desať kilometrov), nie súradnice.
  var polohaTlacidlo = koren.querySelector('[data-poloha]');
  if (polohaTlacidlo && navigator.geolocation) {
    polohaTlacidlo.hidden = false;
    polohaTlacidlo.addEventListener('click', function () {
      pas(T.polohaHladam);
      navigator.geolocation.getCurrentPosition(function (p) {
        skryPas();
        sleduj('svet_moja_poloha');
        letNaBunku(p.coords.latitude, p.coords.longitude);
      }, function () { pas(T.polohaZamietnuta); }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
    });
  }

  /** Plynulý prelet na nájdené miesto a výber štvorca, v ktorom leží. */
  function letNaBunku(lat, lon) {
    dotyk();
    var r = riadokZoSirky(lat), c = stlpecZDlzky(r, lon);
    // Počas výberu do košíka hľadanie len preletí na miesto. Otvoriť list
    // jedného štvorca by košík skryl a ťuky by ho ďalej potichu menili.
    letNa(lat, lon, Math.min(220 / (360 / STL[r]), (72 * dpr) / (360 / STL[r])), function () { if (!kosikRezim) vyber(r, c, true); });
  }

  // ── Štart ────────────────────────────────────────────────────────────────
  fetch(ZAKLAD + 'mriezka.json', { cache: 'no-cache' })
    .then(function (o) { return o.json(); })
    .then(function (m) {
      if (m.podklad && window.Path2D) {
        POD = m.podklad;
        POD.ma = POD.dlazdice.map(function (zoznam) { var o = {}; zoznam.forEach(function (x) { o[x] = 1; }); return o; });
        // Celý svet sa pýta hneď: nesie mená štátov a morí pre každé priblíženie a
        // kreslí sa na mieste jemnejších dlaždíc, kým sa sťahujú.
        dlazdicaV(0, 0, 0, false);
      }
      prepocitaj();
      var id = Number(parametre.get('p'));
      var b = id ? zCisla(id) : null;
      // Odkaz na pohľad: #v=šírka,dĺžka,pixelov na stupeň. Len sa číta, stránka ho
      // sama do adresy nepíše, aby v štatistike návštev nevznikali tisíce adries.
      var pohlad = /^#v=(-?[\d.]+),(-?[\d.]+),([\d.]+)$/.exec(location.hash || '');
      if (b) {
        dotyk();
        S.lon = -180 + ((b.c + 0.5) * 360) / STL[b.r];
        S.my = doY(stredRiadku(b.r));
        // Bunka z odkazu má 96 px na počítači a asi 56 px na telefóne, aby okolo nej ostalo vidno okolie.
        S.s = Math.min(220, Math.min(96, Math.max(48, S.w / dpr / 7)) * dpr) / (360 / STL[b.r]);
        uprav();
        vyber(b.r, b.c, true);
      } else if (pohlad) {
        dotyk();
        S.my = doY(Number(pohlad[1])); S.lon = Number(pohlad[2]); S.s = Number(pohlad[3]) * dpr;
        uprav();
      }
      if (navratZPokladne) {
        var zKosika = !navratBezStvorca && kosikNavrat > 1;
        // Zrušená pokladňa košíka vráti košík so štvorcami, ktoré tento prehliadač
        // ešte platne drží; veta „stay held“ padne, len keď naozaj niečo drží.
        if (navratZPokladne === 'cancelled' && zKosika && kosikZapnuty()) {
          try {
            JSON.parse(sessionStorage.getItem('svet-kosik-ids') || '[]').slice(0, KOSIK_STROP).forEach(function (x) {
              var k = zCisla(Number(x));
              if (k && citajDrziak(Number(x)) && vKosiku(Number(x)) < 0) kosik.push({ id: Number(x), r: k.r, c: k.c });
            });
          } catch (e) {}
          if (kosik.length) ukazKosik();
        }
        var drzi = zKosika ? kosik.length : citajDrziak(id);
        pas(navratZPokladne === 'paid' ? (navratBezStvorca ? T.poPlatbeBalik : zKosika ? T.poPlatbeKosik : T.poPlatbe)
          : (navratBezStvorca || !drzi ? T.poZruseniBalik : zKosika ? T.poZruseniKosik : T.poZruseni));
      }
      ziadaj();
      skusSluzbu();
      // Až po vete o e-maile: keď platba dorazí do 40 sekúnd, veta sa nahradí
      // tlačidlom na kreslenie. Keď nedorazí, ostane veta o e-maile.
      pytajOdkazDoPanela();
      if (LADENIE > 1) setTimeout(meranyPosun, 1300);
    })
    .catch(function () { pas(T.mapaChyba); });

  prepocitaj();
  ziadaj();
  sleduj('svet_zobrazenie_mapy');
  }

  // ── Stránka jednej parcely. Funguje aj bez homelabu: rozmer a súradnice vie
  //    mriežka sama, z homelabu prichádza meno miesta, meno majiteľa a kresba. ──
  function strankaParcely(koren) {
    var id = Number(new URLSearchParams(location.search).get('id'));
    var b = zCisla(id);
    if (!b) { koren.innerHTML = '<p>' + esc(T.chybaParcely) + '</p>'; return; }
    var lat = stredRiadku(b.r), lon = -180 + ((b.c + 0.5) * 360) / STL[b.r];
    // Chýbajúce meno miesta je chýbajúce meno miesta, nie stav predaja.
    function vykresli(p, bezSluzby) {
      var h = '<div class="parcela-hlava">';
      h += p && p.art_url ? '<img src="' + esc(p.art_url) + '" width="128" height="128" decoding="async" alt="' + esc(T.kresbaAlt) + '">' : '';
      h += '<div><p class="list-cislo">' + esc(T.cislo) + ' ' + cisloText(id) + '</p>';
      h += '<p class="list-miesto">' + (miestoHtml(p) || esc(p || bezSluzby ? T.miestoBezSluzby : T.miestoZistujem)) + '</p></div></div>';
      h += '<dl class="list-udaje">';
      h += '<div><dt>' + esc(T.suradnice) + '</dt><dd>' + esc(stupne(lat, lon)) + '</dd></div>';
      h += '<div><dt>' + esc(T.rozmer) + '</dt><dd>' + km(sirkaKm(b.r)) + ' × ' + km(vyskaKm(b.r)) + ' km</dd></div>';
      if (p && p.name) h += '<div><dt>' + esc(T.meno) + '</dt><dd>' + esc(p.name) + '</dd></div>';
      if (p && p.founder_no) h += '<div><dt>' + esc(T.zakladatel) + '</dt><dd>' + esc(String(p.founder_no)) + ' / 100</dd></div>';
      h += '</dl>';
      if (p && p.link) h += '<p><a rel="nofollow ugc noopener noreferrer" target="_blank" href="' + esc(p.link) + '">' + esc(T.otvorOdkaz) + '</a></p>';
      h += '<p><a class="btn btn-solid" href="' + esc(CESTA_MAPY + '?p=' + id) + '">' + esc(T.doMapy) + '</a></p>';
      koren.innerHTML = h;
    }
    vykresli(null);
    api('/api/parcel/' + id).then(function (d) { vykresli(d); }).catch(function () { vykresli(null, true); });
  }

  // ── Rebríček. Len skutočné dáta; keď je prázdno, napíše sa, že je prázdno. ──
  function rebricek(koren) {
    // Služba vracia {"poradie":[{"nazov":…,"spolu":…,"za_mesiac":…}]}. Rebríček
    // miest more neobsahuje; územie bez kódu krajiny má krajinu prázdnu a nič sa
    // mu nedopĺňa.
    api('/api/leaderboard?scope=obec').then(function (d) {
      var riadky = (d && d.poradie) || [];
      if (!riadky.length) return;
      var h = '<table class="rebricek"><thead><tr><th>' + esc(T.rebricekMiesto) + '</th><th>' + esc(T.rebricekKrajina) + '</th><th>' + esc(T.rebricekZaMesiac) + '</th><th>' + esc(T.rebricekPocet) + '</th></tr></thead><tbody>';
      for (var i = 0; i < riadky.length && i < 50; i++) {
        h += '<tr><td>' + esc(riadky[i].nazov) + '</td><td>' + esc(riadky[i].krajina_nazov || riadky[i].krajina || '') + '</td><td>' + cisloText(riadky[i].za_mesiac || 0) + '</td><td>' + cisloText(riadky[i].spolu) + '</td></tr>';
      }
      koren.innerHTML = h + '</tbody></table>';
    }).catch(function () {});
  }

  var mapaKoren = document.querySelector('[data-svet]');
  if (mapaKoren) mapaSveta(mapaKoren);
  var parcelaKoren = document.querySelector('[data-parcela]');
  if (parcelaKoren) strankaParcely(parcelaKoren);
  var rebricekKoren = document.querySelector('[data-rebricek]');
  if (rebricekKoren) rebricek(rebricekKoren);
})();
