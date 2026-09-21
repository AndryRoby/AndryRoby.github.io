/* The World in Squares: prehliadač mapy.
   Zdroj: ops/svet/svet.js, do hubu ho kopíruje ops/svet/postav.mjs. Neupravovať v produkte.

   Jediná technická požiadavka vlastníka znela „nesekavo a dobre optimalizované“.
   Preto:
     · jeden canvas, žiadna knižnica (knižnica by aj tak neprešla prísnym CSP hubu),
     · jedna slučka requestAnimationFrame s dirty príznakom, nekreslí sa do prázdna,
     · kreslí sa priamo v zariadeniových pixeloch, takže čiary mriežky sú ostré
       a v snímku nie je ani jedno ctx.scale,
     · podkladové dlaždice ako ImageBitmap, dekódované mimo hlavného vlákna,
     · devicePixelRatio zastropovaný na 2,
     · v snímku sa nealokuje: všetky pomocné čísla sú mimo slučky,
     · mriežka sa kreslí ako jedna cesta a až nad prahom priblíženia.

   Mapa je v Mercatore. Nie z módy: naša bunka je na zemi štvorec 10 × 10 km a
   Mercator je konformný, takže štvorec na zemi je štvorec aj na obrazovke, v každom
   priblížení a na každej šírke. Na obyčajnej rovnobežníkovej mape by bunka nad
   Bratislavou bola obdĺžnik 3:2 a produkt menom „svet po štvorcoch“ by ukazoval
   obdĺžniky.

   Keď homelab nebeží, mapa sa načíta z podkladových dlaždíc a hore je úprimný pás.
   Žiadne nekonečné kolečko a žiadne tvrdenie, že sa dá kúpiť, keď sa nedá. */
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
  function cisloText(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); }
  function km(x) { var s = x.toFixed(2); return JAZYK === 'en' ? s : s.replace('.', ','); }
  function stupne(lat, lon) {
    return Math.abs(lat).toFixed(3) + '° ' + (lat >= 0 ? T.sever : T.juh) + ', '
      + Math.abs(lon).toFixed(3) + '° ' + (lon >= 0 ? T.vychod : T.zapad);
  }
  /**
   * Umami. Návšteva, klik na bunku, otvorenie pokladne a návrat z nej sa merajú
   * oddelene; platbu samotnú vidí len služba cez webhook, stránka ju nemeria.
   * Tento skript beží pred skriptom Umami (oba sú defer, náš je v hlave prvý),
   * takže prvé udalosti počkajú na načítanie stránky. Bez toho sa zobrazenie
   * mapy nezapísalo nikdy.
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
      return o.json().catch(function () { return {}; }).then(function (d) {
        var chyba = new Error('stav ' + o.status);
        chyba.dovod = (d && d.reason) || '';
        throw chyba;
      });
    });
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
  var MERC = 85.05112877980659;
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
    lon: 12, my: doY(24), s: 1,        // s je v zariadeniových pixeloch na stupeň dĺžky; prvý pohľad je celý svet
    w: 0, h: 0, stredX: 0, stredY: 0, volnaVyska: 0,
    vybrana: null, podKurzorom: null,
    mriezka: null, dlazdice: [],
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
  // režim Stripe (testovací kľúč a testovaciu cenu) a povie to aj človeku. Bez
  // tohto sa z tejto stránky dala otvoriť len živá pokladňa.
  var TEST = parametre.get('test') === '1';
  // Balík sa kupuje bez štvorca, takže návrat z jeho pokladne nemá ?p= a nesmie
  // tvrdiť, že nejaký štvorec čaká alebo že je váš.
  var navratBezStvorca = !Number(parametre.get('p'));
  var navratZPokladne = parametre.get('paid') ? 'paid' : parametre.get('cancelled') ? 'cancelled' : '';
  if (navratZPokladne || parametre.get('session_id')) {
    var cista = new URL(location.href);
    ['paid', 'cancelled', 'session_id'].forEach(function (k) { cista.searchParams.delete(k); });
    history.replaceState(null, '', cista);
    sleduj(navratZPokladne === 'paid' ? 'svet_navrat_z_pokladne' : 'svet_pokladna_zrusena');
  }

  var FARBY = {
    more: '#0a0908', mriezka: 'rgba(255,255,255,.085)', mriezkaSilna: 'rgba(255,255,255,.16)',
    vyber: '#ffd9c9', predane: 'rgba(242,100,60,.85)', rezervovane: 'rgba(242,100,60,.32)',
  };
  // Stavy bunky v /api/chunk, jeden bajt na bunku. Tie isté čísla ako ST_* v
  // products/svet/mriezka.py: 0 nepredajné (more, Antarktída, územie bez kódu),
  // 1 voľné, 2 práve v pokladni, 3 až 7 zaplatené.
  var ST_ZATVORENE = 0, ST_VOLNE = 1, ST_REZERVOVANE = 2, ST_PREDANE = 3;

  // ── Dlaždice ─────────────────────────────────────────────────────────────
  var obrazky = {};
  function dlazdica(src) {
    var z = obrazky[src];
    if (z) return z.bmp || null;
    obrazky[src] = z = { bmp: null };
    fetch(ZAKLAD + src, { cache: 'force-cache' })
      .then(function (o) { if (!o.ok) throw 0; return o.blob(); })
      .then(function (b) { return createImageBitmap(b); })
      .then(function (bmp) { z.bmp = bmp; ziadaj(); })
      .catch(function () { z.chyba = true; });
    return null;
  }

  function hustota(d) { return d.w / (d.xMax - d.xMin); }

  /**
   * Najlepšia dlaždica zo skupiny: najhrubšia, ktorá je ešte dosť hustá pre
   * aktuálne priblíženie, a keď taká nie je, tak najhustejšia dostupná. Kým sa
   * hustejšia sťahuje, kreslí sa hrubšia, takže mapa nikdy nezmizne.
   */
  function najlepsia(zoznam, musiByt) {
    var v = null;
    for (var i = 0; i < zoznam.length; i++) {
      var d = zoznam[i];
      if (musiByt && !(obrazky[d.src] && obrazky[d.src].bmp)) continue;
      if (!v) { v = d; continue; }
      var hd = hustota(d), hv = hustota(v);
      if (hv < S.s ? hd > hv : (hd >= S.s && hd < hv)) v = d;
    }
    return v;
  }

  function vidnoDlazdicu(d) {
    return naX(d.xMax) > 0 && naX(d.xMin) < S.w && naY(d.yMin) > 0 && naY(d.yMax) < S.h;
  }
  /** Kryje dlaždica celý výrez? Potom nemá zmysel sťahovať hustejšiu svetovú. */
  function pokryva(d) {
    return naX(d.xMin) <= 0 && naX(d.xMax) >= S.w && naY(d.yMax) <= 0 && naY(d.yMin) >= S.h;
  }

  // ── Prevody obrazovka a svet ─────────────────────────────────────────────
  // Stred pohľadu nie je stred plátna. List s vybranou bunkou je na telefóne
  // spodný hárok a na počítači karta vľavo dole, takže by inak bola vybraná
  // bunka pod ním. Tu sa raz spočíta stred voľnej plochy a všetko ostatné sa
  // počíta z neho.
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

  function medze() {
    var d = S.dlazdice[0] || { yMin: -105.6, yMax: 166 };
    var minS = Math.max(S.w / 360, S.h / (d.yMax - d.yMin));
    var r = riadokZoSirky(zY(S.my));
    var maxS = 220 / (360 / STL[r]);
    return { minS: minS, maxS: maxS, yMin: d.yMin, yMax: d.yMax };
  }
  function uprav() {
    var m = medze();
    if (S.s < m.minS) S.s = m.minS;
    if (S.s > m.maxS) S.s = m.maxS;
    var pol = S.h / 2 / S.s;
    var lo = m.yMin + pol, hi = m.yMax - pol;
    S.my = lo > hi ? (m.yMin + m.yMax) / 2 : Math.min(hi, Math.max(lo, S.my));
    S.lon = (((S.lon + 180) % 360) + 360) % 360 - 180;
    naplanujBloky();
  }

  // ── Kreslenie ────────────────────────────────────────────────────────────
  var naplanovane = false, poslednyCas = 0;
  function ziadaj() { if (!naplanovane) { naplanovane = true; requestAnimationFrame(snimok); } }
  function snimok(t) { naplanovane = false; poslednyCas = t; kresli(t); if (zivaAnimacia(t)) ziadaj(); }
  function zivaAnimacia(t) { return !POKOJ && S.vyberOd && t - S.vyberOd < 240; }

  /**
   * Nakreslí len tú časť dlaždice, ktorá je práve vidno. Kreslenie celej
   * dlaždice do obdĺžnika širokého desaťtisíce pixelov Chrome pri väčšom
   * priblížení potichu preskočí a z mapy ostane čierna plocha.
   */
  function kresliDlazdicu(d) {
    var bmp = obrazky[d.src].bmp;
    var spx = d.w / (d.xMax - d.xMin), spy = d.h / (d.yMax - d.yMin);
    var yHore = Math.min(d.yMax, zYObr(0)), yDole = Math.max(d.yMin, zYObr(S.h));
    if (yHore <= yDole) return;
    var sy = Math.max(0, (d.yMax - yHore) * spy), sh = Math.min(d.h - sy, (yHore - yDole) * spy);
    var dy = naY(yHore), dh = (yHore - yDole) * S.s;
    ctx.imageSmoothingEnabled = S.s < spx;
    var odK = d.svet ? Math.floor((zX(0) + 180) / 360) : 0;
    var doK = d.svet ? Math.floor((zX(S.w) + 180) / 360) : 0;
    for (var k = odK; k <= doK; k++) {
      var lonOd = Math.max(d.xMin, zX(0) - k * 360), lonDo = Math.min(d.xMax, zX(S.w) - k * 360);
      if (lonDo <= lonOd) continue;
      var sx = Math.max(0, (lonOd - d.xMin) * spx), sw = Math.min(d.w - sx, (lonDo - lonOd) * spx);
      if (sw <= 0 || sh <= 0) continue;
      ctx.drawImage(bmp, sx, sy, sw, sh, naX(lonOd + k * 360), dy, (lonDo - lonOd) * S.s, dh);
    }
  }

  var svetove = [], regionalne = [];
  function kresli(t) {
    ctx.fillStyle = FARBY.more;
    ctx.fillRect(0, 0, S.w, S.h);

    // Svetová dlaždica je vespodok, regionálna sa na ňu položí ako ostrejší výrez.
    // Bez toho by pri zazoomovaní na kraj výrezu ostala čierna plocha.
    var viditelne = regionalne.filter(vidnoDlazdicu);
    var chcemR = najlepsia(viditelne, false);
    if (chcemR) dlazdica(chcemR.src);
    var reg = najlepsia(viditelne, true);

    // Najprv vždy tá najlacnejšia svetová dlaždica, aby bolo na čo pozerať do
    // sekundy. Hustejšiu sťahujeme, len keď výrez naozaj nie je celý pod
    // regionálnou dlaždicou: inak by každé otvorenie mapy stiahlo 215 kB za nič.
    var zakl = najlepsia(svetove, true);
    if (!zakl) dlazdica(svetove.length ? svetove[0].src : '');
    else if (!(reg && pokryva(reg))) {
      var chcem = najlepsia(svetove, false);
      if (chcem && chcem !== zakl) dlazdica(chcem.src);
    }
    if (zakl) kresliDlazdicu(zakl);
    if (reg && (!zakl || hustota(reg) > hustota(zakl))) kresliDlazdicu(reg);

    kresliPredane();
    kresliMriezku();
    kresliVyber(t);
  }

  /**
   * Sú bunky dosť veľké na to, aby sa kreslili presne z blokov a nie z vrstvy?
   * Prah je osem zariadeniových pixelov na bunku: blok 64 × 64 má vtedy aspoň
   * 512 px, takže celý výrez pokryje najviac dvadsaťštyri blokov, ktoré sa naraz
   * sťahujú. Pri nižšom prahu by časť výrezu ostala bez blokov aj bez vrstvy.
   */
  function zblizka() {
    var rHore = riadokZoSirky(zY(zYObr(0)));
    return (360 / STL[rHore]) * S.s >= 8;
  }

  /**
   * Predané bunky. Pri pohľade zďaleka celosvetová vrstva z homelabu, zblízka
   * presné bloky. Nikdy oboje naraz: vrstva má bunku zaokrúhlenú na celý pixel,
   * takže by zblízka trčala spod presného obdĺžnika ako rozmazaná škvrna.
   */
  function kresliPredane() {
    var blizko = zblizka();
    if (vrstva.platno && !(blizko && Object.keys(bloky).length)) {
      var d = S.dlazdice[0];
      var x0 = naX(-180), y0 = naY(d.yMax), sirka = 360 * S.s, vyska = (d.yMax - d.yMin) * S.s;
      // Zďaleka sa vrstva zmenšuje; bez vyhladenia by jednopixelová bunka pri
      // zmenšení vypadla celá, s ním aspoň zosvetlí svoj pixel.
      ctx.imageSmoothingEnabled = sirka < vrstva.platno.width;
      for (var k = Math.floor((0 - (x0 + sirka)) / sirka); k <= Math.ceil((S.w - x0) / sirka); k++) {
        ctx.drawImage(vrstva.platno, x0 + k * sirka, y0, sirka, vyska);
      }
    }
    if (!blizko) return;
    var kluce = Object.keys(bloky);
    if (!kluce.length) return;
    // Jedna cesta a jedno fill na farbu pre celý viditeľný výsek: tisíc predaných
    // buniek je tisíc obdĺžnikov v jednej ceste, nie tisíc volaní fill.
    kresliStav(kluce, ST_PREDANE, 255, FARBY.predane);
    kresliStav(kluce, ST_REZERVOVANE, ST_REZERVOVANE, FARBY.rezervovane);
    kresliKresby(kluce);
  }

  // ── Kresby majiteľov priamo na mape ──────────────────────────────────────
  // Služba lepí schválené kresby bloku 64 × 64 do jedného obrázka (/api/art),
  // 32 × 32 bodov na bunku. Kým ho mapa nečítala, kresba bola vidno len v liste
  // po kliknutí a „verejné na mape“ v paneli majiteľa nebola celá pravda.
  // Obrázok sa pýta len pre blok, ktorý kresbu naozaj má (stav 4 alebo 6), a v
  // pamäti ostávajú najviac štyri: rozbalený má 16 MB.
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

  function kresliStav(kluce, od, po, farba) {
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

  /** Mriežka sa kreslí až nad prahom priblíženia a len pre viditeľné riadky. */
  function kresliMriezku() {
    var rHore = riadokZoSirky(zY(zYObr(0))), rDole = riadokZoSirky(zY(zYObr(S.h)));
    var bunkaPx = (360 / STL[rHore]) * S.s;
    if (bunkaPx < 14) return;
    var jemna = bunkaPx < 30;
    ctx.strokeStyle = jemna ? FARBY.mriezka : FARBY.mriezkaSilna;
    ctx.lineWidth = 1;
    ctx.beginPath();
    var useky = 0;
    for (var r = rHore; r <= rDole && r < RIADKY; r++) {
      var yh = Math.round(naY(doY(90 - r * RIADOK))) + 0.5;
      var yd = Math.round(naY(doY(90 - (r + 1) * RIADOK))) + 0.5;
      ctx.moveTo(0, yh); ctx.lineTo(S.w, yh);
      if (yd - yh < 9) continue;
      var sirkaDeg = 360 / STL[r];
      var prvy = Math.floor((zX(0) + 180) / sirkaDeg);
      var posledny = Math.ceil((zX(S.w) + 180) / sirkaDeg);
      if (posledny - prvy > 400) continue;
      for (var c = prvy; c <= posledny; c++) {
        var x = Math.round(naX(-180 + c * sirkaDeg)) + 0.5;
        ctx.moveTo(x, yh); ctx.lineTo(x, yd);
        if (++useky > 14000) { c = posledny; r = rDole; }
      }
    }
    ctx.stroke();
  }

  function kresliVyber(t) {
    if (S.podKurzorom && (!S.vybrana || S.podKurzorom.id !== S.vybrana.id)) {
      var bunkaPx = (360 / STL[S.podKurzorom.r]) * S.s;
      if (bunkaPx >= 6) {
        ctx.beginPath();
        obdlznikBunky(S.podKurzorom.r, S.podKurzorom.c);
        ctx.fillStyle = 'rgba(255,255,255,.10)';
        ctx.fill();
      }
    }
    if (!S.vybrana) return;
    ctx.beginPath();
    var g = obdlznikBunky(S.vybrana.r, S.vybrana.c);
    ctx.fillStyle = 'rgba(242,100,60,.18)';
    ctx.fill();
    ctx.strokeStyle = FARBY.vyber;
    ctx.lineWidth = Math.max(1.5, 2 * dpr);
    ctx.stroke();
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
  var zmenaCakajuca = 0;
  function prepocitaj() {
    var r = platno.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (w === S.w && h === S.h) return;
    S.w = w; S.h = h;
    platno.width = w; platno.height = h;
    prepocitajStred();
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

  // ── Ovládanie myšou, prstom a klávesnicou ────────────────────────────────
  var tahanie = null, zotrvacnost = null, prsty = {};
  function bod(e) { var r = platno.getBoundingClientRect(); return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr }; }

  platno.addEventListener('pointerdown', function (e) {
    platno.setPointerCapture(e.pointerId);
    prsty[e.pointerId] = bod(e);
    zotrvacnost = null;
    if (Object.keys(prsty).length === 1) {
      var p = prsty[e.pointerId];
      tahanie = { x: p.x, y: p.y, lon: S.lon, my: S.my, pohol: false, cas: performance.now(), vx: 0, vy: 0 };
    } else {
      tahanie = null;
      var k = Object.keys(prsty);
      stipka = { d: vzdialenost(prsty[k[0]], prsty[k[1]]), s: S.s };
    }
  });
  var stipka = null;

  function vzdialenost(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy) || 1; }

  platno.addEventListener('pointermove', function (e) {
    var p = bod(e);
    if (prsty[e.pointerId]) prsty[e.pointerId] = p;
    var k = Object.keys(prsty);
    if (k.length >= 2 && stipka) {
      var teraz = vzdialenost(prsty[k[0]], prsty[k[1]]);
      var stred = { x: (prsty[k[0]].x + prsty[k[1]].x) / 2, y: (prsty[k[0]].y + prsty[k[1]].y) / 2 };
      priblizNa(stred.x, stred.y, (stipka.s * teraz) / stipka.d / S.s);
      return;
    }
    if (tahanie) {
      var dx = p.x - tahanie.x, dy = p.y - tahanie.y;
      if (!tahanie.pohol && Math.abs(dx) + Math.abs(dy) > 4 * dpr) { tahanie.pohol = true; platno.classList.add('presuva'); }
      if (tahanie.pohol) {
        var cas = performance.now(), dt = Math.max(8, cas - tahanie.cas);
        tahanie.vx = ((p.x - (tahanie.px || p.x)) / dt) * 16;
        tahanie.vy = ((p.y - (tahanie.py || p.y)) / dt) * 16;
        tahanie.px = p.x; tahanie.py = p.y; tahanie.cas = cas;
        S.lon = tahanie.lon - dx / S.s;
        S.my = tahanie.my + dy / S.s;
        uprav(); ziadaj();
      }
      return;
    }
    if (e.pointerType === 'mouse') {
      var b = bunkaNa(p.x, p.y);
      if ((b && b.id) !== (S.podKurzorom && S.podKurzorom.id)) { S.podKurzorom = b; ziadaj(); }
    }
  }, { passive: true });

  function koniecTahu(e) {
    delete prsty[e.pointerId];
    if (Object.keys(prsty).length < 2) stipka = null;
    if (!tahanie) return;
    platno.classList.remove('presuva');
    if (!tahanie.pohol) {
      var p = bod(e);
      var b = bunkaNa(p.x, p.y);
      if (b) vyber(b.r, b.c, false);
    } else if (!POKOJ && (Math.abs(tahanie.vx) > 1 || Math.abs(tahanie.vy) > 1)) {
      zotrvacnost = { vx: tahanie.vx, vy: tahanie.vy };
      requestAnimationFrame(dojazd);
    }
    tahanie = null;
  }
  platno.addEventListener('pointerup', koniecTahu);
  platno.addEventListener('pointercancel', function (e) { delete prsty[e.pointerId]; tahanie = null; stipka = null; platno.classList.remove('presuva'); });

  function dojazd() {
    if (!zotrvacnost) return;
    S.lon -= zotrvacnost.vx / S.s;
    S.my += zotrvacnost.vy / S.s;
    zotrvacnost.vx *= 0.92; zotrvacnost.vy *= 0.92;
    uprav(); ziadaj();
    if (Math.abs(zotrvacnost.vx) > 0.4 || Math.abs(zotrvacnost.vy) > 0.4) requestAnimationFrame(dojazd);
    else zotrvacnost = null;
  }

  function priblizNa(x, y, nasob) {
    var lonPod = zX(x), myPod = zYObr(y);
    S.s *= nasob;
    var m = medze();
    S.s = Math.min(m.maxS, Math.max(m.minS, S.s));
    S.lon = lonPod - (x - S.w / 2) / S.s;
    S.my = myPod + (y - S.h / 2) / S.s;
    uprav(); ziadaj();
  }

  platno.addEventListener('wheel', function (e) {
    e.preventDefault();
    var p = bod(e);
    var krok = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    priblizNa(p.x, p.y, Math.exp(-krok * 0.0018));
  }, { passive: false });

  platno.addEventListener('keydown', function (e) {
    var krok = 60 * dpr, spracovane = true;
    if (e.key === 'ArrowLeft') S.lon -= krok / S.s;
    else if (e.key === 'ArrowRight') S.lon += krok / S.s;
    else if (e.key === 'ArrowUp') S.my += krok / S.s;
    else if (e.key === 'ArrowDown') S.my -= krok / S.s;
    else if (e.key === '+' || e.key === '=') priblizNa(S.w / 2, S.h / 2, 1.35);
    else if (e.key === '-' || e.key === '_') priblizNa(S.w / 2, S.h / 2, 1 / 1.35);
    else if (e.key === 'Enter' || e.key === ' ') { var b = bunkaNa(S.w / 2, S.h / 2); if (b) vyber(b.r, b.c, false); }
    else spracovane = false;
    if (spracovane) { e.preventDefault(); uprav(); ziadaj(); }
  });

  function bunkaNa(x, y) {
    var lat = zY(zYObr(y));
    if (lat > 89.99 || lat < -89.99) return null;
    var r = riadokZoSirky(lat), c = stlpecZDlzky(r, zX(x));
    return { r: r, c: c, id: cislo(r, c) };
  }

  // ── Výber bunky a list ───────────────────────────────────────────────────
  var list = koren.querySelector('[data-list]');
  var oznam = koren.querySelector('[data-oznam]');

  function vyber(r, c, tichy) {
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
  // Držiak rezervácie (hold) podľa čísla štvorca. Žije v sessionStorage, aby
  // prežil odchod do pokladne Stripe a návrat z nej v tej istej karte: inak by
  // človek po „späť“ z pokladne videl vlastnú rezerváciu ako cudziu a štvorec,
  // ktorý mu držíme, by si nemal ako kúpiť.
  var drziaky = {};
  function citajDrziak(id) {
    if (drziaky[id]) return drziaky[id];
    try { return sessionStorage.getItem('svet-hold-' + id) || ''; } catch (e) { return ''; }
  }
  function ulozDrziak(id, hodnota) {
    if (hodnota) drziaky[id] = hodnota; else delete drziaky[id];
    try {
      if (hodnota) sessionStorage.setItem('svet-hold-' + id, hodnota);
      else sessionStorage.removeItem('svet-hold-' + id);
    } catch (e) {}
  }
  // Čo je práve v liste. Odpoveď služby smie prekresliť len prehľad bunky: keby
  // prekreslila aj pokladňu alebo kreslenie, zmazala by človeku rozpísaný e-mail
  // a zaškrtnuté súhlasy v polovici kroku.
  var listRezim = 'prehlad';
  function obnovList() { if (listRezim === 'prehlad') ukazList(); }
  function ukazList() {
    if (!S.vybrana) return;   // statická pozvánka v HTML ostáva
    listRezim = 'prehlad';
    var r = S.vybrana.r, c = S.vybrana.c, id = S.vybrana.id;
    var lat = stredRiadku(r), lon = -180 + ((c + 0.5) * 360) / STL[r];
    var p = parcely[id];
    var stav = stavBunky(r, c, p);
    // Rezervácia, ktorú drží tento prehliadač, nie je „niekto iný práve platí“.
    if (stav === 'rezervovana' && citajDrziak(id)) stav = 'volna';
    var h = '';
    h += '<p class="list-cislo">' + esc(T.cislo) + ' ' + cisloText(id) + '</p>';
    // Každý stav má vlastnú vetu. Kým tu bolo „Zisťujem miesto…“ aj vtedy, keď
    // homelab nebeží, točilo sa to donekonečna nad štvorcom, ktorý sa nemal
    // odkiaľ dozvedieť. Nečakanie na nič sa musí povedať nahlas. Krajina sa píše
    // menom (Czechia), nie kódom; kód ostáva len keď služba meno neposlala.
    var krajina = p && (p.country_name || p.country);
    var casti = p ? [p.region !== p.city ? p.region : null, krajina].filter(Boolean) : [];
    var miesto = p && p.city ? '<b>' + esc(p.city) + '</b>' + (casti.length ? ', ' + esc(casti.join(', ')) : '')
      : casti.length ? '<b>' + esc(casti.join(', ')) + '</b>'
        : stav === 'zatvorena' ? esc(p ? (p.land ? T.nepredajnaSus : T.more) : T.nepredajne)
          : (S.sluzba === 'nedostupna' || zlyhane[id]) ? esc(T.miestoBezSluzby)
            : p ? '' : esc(T.miestoZistujem);
    h += '<p class="list-miesto">' + miesto + '</p>';
    // Názvy polí sú tie, ktoré naozaj posiela app.py: art_url (hotová adresa
    // obrázka, nie stav kresby) a founder_no. Odkaz už služba posiela len vtedy,
    // keď je schválený aj zapnutý, takže sa tu netestuje druhý príznak.
    if (p && p.art_url) h += '<img class="list-kresba" alt="' + esc(T.kresbaAlt) + '" src="' + esc(p.art_url) + '" width="88" height="88" loading="lazy" decoding="async">';
    h += '<dl class="list-udaje">';
    h += '<div><dt>' + esc(T.suradnice) + '</dt><dd>' + esc(stupne(lat, lon)) + '</dd></div>';
    h += '<div><dt>' + esc(T.rozmer) + '</dt><dd>' + km(sirkaKm(r)) + ' × ' + km(vyskaKm(r)) + ' km</dd></div>';
    if (p && p.name) h += '<div><dt>' + esc(T.meno) + '</dt><dd>' + esc(p.name) + '</dd></div>';
    if (p && p.founder_no) h += '<div><dt>' + esc(T.zakladatel) + '</dt><dd>' + esc(String(p.founder_no)) + ' / 100</dd></div>';
    h += '</dl>';

    if (stav === 'predana') {
      if (p && p.link) h +='<a class="btn btn-line" rel="nofollow ugc noopener noreferrer" target="_blank" href="' + esc(p.link) + '">' + esc(T.otvorOdkaz) + '</a>';
      h += '<a class="btn btn-line" href="' + esc(CESTA_MAPY + T.cestaParcely + '?id=' + id) + '" data-umami-event="svet_zdielanie">' + esc(T.zdielat) + '</a>';
      h += '<button class="btn btn-line" type="button" data-akcia="nahlasit">' + esc(T.nahlasit) + '</button>';
      h += '<p class="list-pravne">' + esc(T.predaneVysvetlenie) + '</p>';
    } else if (stav === 'zatvorena') {
      h += '<p class="list-pravne">' + esc(T.nepredajneVysvetlenie) + '</p>';
      h += '<a class="btn btn-line" href="#predaj">' + esc(T.coSaPredava) + '</a>';
    } else if (stav === 'rezervovana') {
      h += '<p class="list-pravne">' + esc(T.rezervovane) + '</p>';
    } else if (stav === 'neznamy') {
      // Služba nebeží alebo ešte neodpovedala. Stránka vtedy nevie, či je
      // štvorec voľný, more alebo predaný, a nesmie sa tváriť, že vie.
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
      // Cenník sľubuje balíky 3 a 10. Kým sa odtiaľto dal kúpiť len jeden štvorec,
      // bola to ponuka bez tlačidla.
      h += '<button class="list-balik" type="button" data-akcia="balik">' + esc(T.balikTlacidlo) + '</button>';
      h += '<p class="list-pravne">' + esc(T.licenciaVeta) + ' <a href="' + esc(T.cestaPodmienky) + '">' + esc(T.podmienkyOdkaz) + '</a></p>';
    }
    list.innerHTML = h;
    list.hidden = false;
    prepocitajStred();
    if (!POKOJ) { list.classList.remove('prichadza'); void list.offsetWidth; list.classList.add('prichadza'); }
    if (oznam) oznam.textContent = T.cislo + ' ' + cisloText(id) + '. ' + (p && p.city ? p.city : '') + ' ' + km(sirkaKm(r)) + ' × ' + km(vyskaKm(r)) + ' km.';
  }

  /**
   * Čo sa s bunkou dá robiť: 'volna', 'rezervovana', 'predana', 'zatvorena'
   * alebo 'neznamy'. V predaji je celý svet, takže o tom nerozhoduje žiadny
   * obdĺžnik v mriezka.json, ale služba: najprv odpoveď /api/parcel pre túto
   * bunku, inak jej bajt v bloku z /api/chunk. Keď nie je ani jedno (služba
   * nebeží, alebo ešte neodpovedala), stav je neznámy a nič sa netvrdí.
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
    if (b.getAttribute('data-akcia') === 'kupit') pokladna(false);
    else if (b.getAttribute('data-akcia') === 'balik') pokladna(true);
    else if (b.getAttribute('data-akcia') === 'kreslit') kresliacePlatno();
    else if (b.getAttribute('data-akcia') === 'nahlasit') nahlasit();
    else if (b.getAttribute('data-akcia') === 'kredit') vezmiZKreditu(b);
  });

  // ── Výber štvorca z kreditu balíka ───────────────────────────────────────
  // Kľúč majiteľa sem príde len cez sessionStorage z panela majiteľa, v tej
  // istej karte. Do adresy tejto stránky sa nedostane nikdy: beží na nej Umami
  // a to si adresu zapisuje.
  var majitel = null;
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
  var vrstva = { platno: null, kedy: 0 };
  var bloky = {};

  function skusSluzbu() {
    api('/api/health').then(function () {
      S.sluzba = 'bezi';
      if (!navratZPokladne) skryPas();
      nacitajStav();
      nacitajVrstvu();
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
  function pas(text) { if (pasEl) { pasEl.textContent = text; pasEl.hidden = false; } }
  function skryPas() { if (pasEl) pasEl.hidden = true; }

  function nacitajStav() {
    api('/api/state.json').then(function (d) {
      S.stav = d;
      var el = koren.querySelector('[data-pocitadlo]');
      // Tvar odpovede je {"etapa":{"buniek":…,"predanych":…}}. S d.sold a
      // d.total sa počítadlo po pripojení služby nikdy nezmenilo.
      var e = d && d.etapa;
      if (el && e && typeof e.predanych === 'number' && typeof e.buniek === 'number') {
        el.innerHTML = '<b>' + cisloText(e.predanych) + ' / ' + cisloText(e.buniek) + '</b>' + esc(T.pocitadloPopis);
      }
    }).catch(function () {});
  }

  function nacitajVrstvu() {
    if (S.sluzba !== 'bezi') return;
    fetch(API + '/api/overlay.png', { cache: 'default' })
      .then(function (o) { if (!o.ok) throw 0; return o.blob(); })
      .then(createImageBitmap)
      .then(function (b) { vrstva.platno = doMercatoraVrstvu(b); b.close(); vrstva.kedy = Date.now(); ziadaj(); })
      .catch(function () {});
  }

  /**
   * Vrstva zo služby je rovnobežníková (riadok obrázka = rovnaký kus zemepisnej
   * šírky od pólu k pólu), mapa je v Mercatore. Kým sa vrstva len natiahla cez
   * mapu, predaný štvorec v Bratislave svietil nad Rímom. Tu sa raz za minútu
   * prevzorkuje po riadkoch do plátna v Mercatore s presne tým výrezom, aký má
   * svetová dlaždica; v snímku je to potom jedno drawImage ako predtým.
   */
  function doMercatoraVrstvu(bmp) {
    var d = S.dlazdice[0] || { yMin: -105.6, yMax: 166 };
    var w = bmp.width, h = Math.max(1, Math.round((w * (d.yMax - d.yMin)) / 360));
    var p = vrstva.platno || document.createElement('canvas');
    p.width = w; p.height = h;
    var c = p.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, w, h);
    for (var j = 0; j < h; j++) {
      var lat = zY(d.yMax - ((j + 0.5) * (d.yMax - d.yMin)) / h);
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
   * miliónov buniek, sťahuje len bloky, ktoré práve vidno. To je jediný dôvod,
   * prečo mapa nebude sekať ani vtedy, keď bude predané celé Slovensko.
   */
  function dopytajBloky() {
    if (S.sluzba !== 'bezi' || document.hidden) return;
    var rHore = riadokZoSirky(zY(zYObr(0))), rDole = riadokZoSirky(zY(zYObr(S.h)));
    if (!zblizka()) return;
    var zoznam = [];
    // Blok je 64 riadkov × 64 STĹPCOV V RIADKU, a riadky majú rôzny počet stĺpcov.
    // Ten istý poludník je preto v hornom riadku bloku v inom stĺpci než v dolnom
    // (nad Bratislavou o 37 stĺpcov na 15 riadkov). Kým sa stĺpce brali zo
    // stredného riadku bloku, pýtal sa susedný blok a predané štvorce sa nad
    // Slovenskom nenakreslili vôbec. Berú sa preto z krajných VIDITEĽNÝCH riadkov.
    var lonOd = zX(0), lonDo = zX(S.w);
    for (var rb = rHore >> 6; rb <= (rDole >> 6) && zoznam.length < 24; rb++) {
      var rOd = Math.max(rHore, rb << 6), rDo = Math.min(rDole, (rb << 6) + 63, RIADKY - 1);
      var cOd = Math.min(stlpecZDlzky(rOd, lonOd), stlpecZDlzky(rDo, lonOd)) >> 6;
      var cDo = Math.max(stlpecZDlzky(rOd, lonDo), stlpecZDlzky(rDo, lonDo)) >> 6;
      var posledny = (Math.max(STL[rOd], STL[rDo]) - 1) >> 6;
      if (cDo >= cOd) {
        for (var c = cOd; c <= cDo && zoznam.length < 24; c++) zoznam.push([rb, c]);
      } else {
        // Výrez leží cez 180. poludník: od ľavého okraja po koniec riadku a od nuly po pravý okraj.
        for (var c1 = cOd; c1 <= posledny && zoznam.length < 24; c1++) zoznam.push([rb, c1]);
        for (var c2 = 0; c2 <= cDo && zoznam.length < 24; c2++) zoznam.push([rb, c2]);
      }
    }
    zoznam.forEach(function (b) {
      var kluc = b[0] + ',' + b[1];
      if (bloky[kluc] && !bloky[kluc].stare) return;
      // Služba posiela 4096 bajtov, jeden stav na bunku (ST_* vyššie), nie bity.
      // Kým sa tu čítali ako bity, každá ôsma voľná bunka sa kreslila ako predaná.
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
   */
  function pokladna(balik) {
    if (!S.vybrana) return;
    sleduj(balik ? 'svet_otvorena_pokladna_balik' : 'svet_otvorena_pokladna');
    listRezim = 'pokladna';
    var id = S.vybrana.id;
    var h = '<p class="list-cislo">' + (balik ? esc(T.balikNadpis) : esc(T.cislo) + ' ' + cisloText(id)) + '</p>';
    if (TEST) h += '<p class="list-test" role="note">' + esc(T.testRezim) + '</p>';
    if (balik) {
      h += '<p class="list-miesto">' + esc(T.balikUvod) + '</p>';
      h += '<fieldset class="vyber-balika"><legend class="skryte">' + esc(T.balikNadpis) + '</legend>';
      h += '<label class="suhlas"><input type="radio" name="svet-balik" value="pack3" checked><span>' + esc(T.balik3) + '</span></label>';
      h += '<label class="suhlas"><input type="radio" name="svet-balik" value="pack10"><span>' + esc(T.balik10) + '</span></label></fieldset>';
    }
    h += '<p class="list-miesto">' + esc(T.pokladnaUvod) + '</p>';
    h += '<label class="suhlas"><input type="checkbox" data-suhlas="dodanie"><span>' + esc(T.suhlasDodanie) + '</span></label>';
    h += '<label class="suhlas"><input type="checkbox" data-suhlas="vek"><span>' + esc(T.suhlasVek) + '</span></label>';
    h += '<label class="suhlas suhlas-mail"><span class="skryte">' + esc(T.email) + '</span><input type="email" data-email autocomplete="email" placeholder="' + esc(T.email) + '" required></label>';
    // Darček je v cenníku: meno obdarovaného ide na certifikát. Nikde inde sa neukazuje.
    if (!balik) h += '<label class="suhlas suhlas-mail"><span class="skryte">' + esc(T.darcek) + '</span><input type="text" data-darcek maxlength="60" autocomplete="off" placeholder="' + esc(T.darcek) + '"></label>';
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
      // Mená polí sú presne tie, ktoré číta app.py, teda consent_delivery,
      // nie consentDelivery. Kým tu boli iné, kúpiť sa nedalo vôbec.
      var objednavka = { locale: JAZYK, email: mail.value.trim(), consent_delivery: true, consent_age: true };
      if (TEST) objednavka.test = true;
      var krok;
      if (balik) {
        var zvoleny = list.querySelector('input[name="svet-balik"]:checked');
        objednavka.product = zvoleny ? zvoleny.value : 'pack3';
        krok = api('/api/checkout', objednavka);
      } else {
        var darcek = list.querySelector('[data-darcek]');
        objednavka.product = 'single';
        objednavka.parcel_id = id;
        if (darcek && darcek.value.trim()) objednavka.gift_name = darcek.value.trim();
        // Kto už tento štvorec drží (pokladňa sa predtým neotvorila, alebo sa z nej
        // vrátil späť), nerezervuje druhý raz: služba by mu na vlastnú rezerváciu
        // odpovedala 409 a stránka by mu tvrdila, že bol niekto rýchlejší.
        var uzDrzim = citajDrziak(id);
        krok = (uzDrzim ? Promise.resolve({ hold: uzDrzim })
          : api('/api/reserve', { row: S.vybrana.r, col: S.vybrana.c, pixels: kresbaNaOdoslanie(id) }))
          .then(function (r) { objednavka.hold = r && r.hold; ulozDrziak(id, objednavka.hold); return api('/api/checkout', objednavka); });
      }
      krok
        .then(function (d) { if (d && d.url) { sleduj('svet_odchod_do_stripe'); location.href = d.url; } else throw new Error('bez adresy'); })
        .catch(function (chyba) {
          var kod = chyba && /stav (\d+)/.exec(chyba.message || '');
          kod = kod ? Number(kod[1]) : 0;
          // 409: bunku medzitým niekto zarezervoval alebo kúpil. To nie je
          // porucha pokladne a „skúste znova“ by človeka poslalo do slučky.
          var testVypnuty = chyba && chyba.dovod === 'test-disabled';
          // 403 wrong-hold: držiak už neplatí (rezerváciu medzitým získal niekto iný).
          if (!balik && (kod === 409 || (kod === 403 && !testVypnuty))) {
            ulozDrziak(id, '');
            delete parcely[id];
            delete bloky[(S.vybrana.r >> 6) + ',' + (S.vybrana.c >> 6)];
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
    list.querySelector('[data-akcia="spat"]').addEventListener('click', ukazList);
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
    // parcel_id a field, presne ako ich číta app.py. S „parcel“ vracala služba
    // 400 a tlačidlo Nahlásiť bolo len ozdoba.
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
  var PRAZDNA = 0;   // index „nič“; formát ukladá štyri bity, takže 255 neexistuje
  function kresliacePlatno() {
    if (!S.vybrana) return;
    sleduj('svet_prve_kreslenie');
    listRezim = 'kreslenie';
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
    var body = new Uint8Array(1024).fill(PRAZDNA);
    if (ulozene) {
      try {
        var u = atob(ulozene);
        // Staršie uložené kresby používali 255 ako prázdno; služba berie len
        // 0 až 15, tak sa to tu preloží a nikomu nič nezmizne.
        for (var i = 0; i < 1024 && i < u.length; i++) { var v = u.charCodeAt(i); body[i] = v > 15 ? PRAZDNA : v; }
      } catch (e) {}
    }
    var farba = 5;
    function prekresli() {
      kctx.clearRect(0, 0, 32, 32);
      for (var i = 0; i < 1024; i++) {
        kctx.fillStyle = PALETA[body[i]] || PALETA[PRAZDNA];
        kctx.fillRect(i % 32, (i / 32) | 0, 1, 1);
      }
    }
    prekresli();
    function maluj(e) {
      var r = kp.getBoundingClientRect();
      var x = Math.floor(((e.clientX - r.left) / r.width) * 32), y = Math.floor(((e.clientY - r.top) / r.height) * 32);
      if (x < 0 || y < 0 || x > 31 || y > 31) return;
      body[y * 32 + x] = farba;
      prekresli();
      var s = '';
      for (var i = 0; i < 1024; i++) s += String.fromCharCode(body[i]);
      try { localStorage.setItem('svet-kresba-' + id, btoa(s)); } catch (e2) {}
    }
    var malujem = false;
    kp.addEventListener('pointerdown', function (e) { malujem = true; try { kp.setPointerCapture(e.pointerId); } catch (err) {} maluj(e); });
    kp.addEventListener('pointermove', function (e) { if (malujem) maluj(e); });
    kp.addEventListener('pointerup', function () { malujem = false; });
    // Prehliadač vie ťah prerušiť (prichádzajúci hovor, gesto systému). Bez tohto
    // by sa potom maľovalo aj pri obyčajnom pohybe myši nad plátnom.
    kp.addEventListener('pointercancel', function () { malujem = false; });
    list.querySelector('.paleta').addEventListener('click', function (e) {
      var b = e.target.closest('[data-farba]');
      if (!b) return;
      farba = Number(b.getAttribute('data-farba'));
      list.querySelectorAll('[data-farba]').forEach(function (x) { x.setAttribute('aria-pressed', String(Number(x.getAttribute('data-farba')) === farba)); });
    });
    list.querySelector('[data-kres="guma"]').addEventListener('click', function () {
      farba = PRAZDNA;
      list.querySelectorAll('[data-farba]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
    });
    list.querySelector('[data-kres="vycisti"]').addEventListener('click', function () {
      body.fill(PRAZDNA);
      prekresli();
      // Vymazaná kresba sa musí vymazať aj z úložiska. Inak by sa pri kúpe na
      // štvorec preniesla tá stará, ktorú človek práve zahodil.
      try { localStorage.removeItem('svet-kresba-' + id); } catch (e) {}
    });
    list.querySelector('[data-akcia="spat2"]').addEventListener('click', ukazList);
  }

  // ── Hľadanie obce ────────────────────────────────────────────────────────
  var hladaciePole = koren.querySelector('[data-hladanie]');
  var navrhy = koren.querySelector('[data-navrhy]');
  var index = null, indexSa = false;
  function bezDiakritiky(s) { return s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : s.toLowerCase(); }

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
    var domace = JAZYK === 'sk' ? ['SK', 'CZ'] : [];
    var vysl = zac.concat(vnutri).sort(function (a, b) {
      var da = domace.indexOf(index.kod[a]) >= 0 ? 0 : 1, db = domace.indexOf(index.kod[b]) >= 0 ? 0 : 1;
      if (da !== db) return da - db;
      return index.meno[a].length - index.meno[b].length;
    }).slice(0, 12);
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
      letNa(index.lat[i], index.lon[i]);
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
        letNa(p.coords.latitude, p.coords.longitude);
      }, function () { pas(T.polohaZamietnuta); }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
    });
  }

  function letNa(lat, lon) {
    var r = riadokZoSirky(lat), c = stlpecZDlzky(r, lon);
    var cielS = Math.min(medze().maxS, 72 / (360 / STL[r]));
    var odLon = S.lon, odMy = S.my, odS = S.s;
    var doLon = lon, doMy = doY(lat);
    if (POKOJ) { S.lon = doLon; S.my = doMy; S.s = cielS; uprav(); vyber(r, c, true); return; }
    var zac = performance.now(), trvanie = 420;
    (function krok(t) {
      var p = Math.min(1, (t - zac) / trvanie), e = 1 - Math.pow(1 - p, 4);
      S.lon = odLon + (doLon - odLon) * e;
      S.my = odMy + (doMy - odMy) * e;
      S.s = odS * Math.pow(cielS / odS, e);
      uprav(); ziadaj();
      if (p < 1) requestAnimationFrame(krok); else vyber(r, c, true);
    })(performance.now());
  }

  // ── Štart ────────────────────────────────────────────────────────────────
  fetch(ZAKLAD + 'mriezka.json', { cache: 'force-cache' })
    .then(function (o) { return o.json(); })
    .then(function (m) {
      S.mriezka = m;
      S.dlazdice = m.dlazdice;
      svetove = m.dlazdice.filter(function (d) { return d.svet; });
      regionalne = m.dlazdice.filter(function (d) { return !d.svet; });
      var e = m.etapa;
      var el = koren.querySelector('[data-pocitadlo]');
      if (el && e) el.innerHTML = '<b>' + cisloText(e.buniek) + '</b>' + esc(T.pocitadloEtapa);
      prepocitaj();
      var id = Number(parametre.get('p'));
      var b = id ? zCisla(id) : null;
      if (b) {
        S.lon = -180 + ((b.c + 0.5) * 360) / STL[b.r];
        S.my = doY(stredRiadku(b.r));
        S.s = Math.min(medze().maxS, 96 / (360 / STL[b.r]));
        uprav();
        vyber(b.r, b.c, true);
      } else {
        // Prvý pohľad je celý svet: v predaji je celá súš, tak sa nezačína nad
        // jednou krajinou. Najmenšie priblíženie je presne to, pri ktorom mapa
        // vyplní plátno; stred je posunutý na sever, lebo tam je väčšina súše
        // a spodnú tretinu plátna na počítači aj tak kryje list.
        S.lon = 12;
        S.my = doY(24);
        S.s = medze().minS;
        uprav();
      }
      if (navratZPokladne) {
        pas(navratZPokladne === 'paid' ? (navratBezStvorca ? T.poPlatbeBalik : T.poPlatbe)
          : (navratBezStvorca ? T.poZruseniBalik : T.poZruseni));
      }
      ziadaj();
      skusSluzbu();
    })
    .catch(function () { pas(T.mapaChyba); });

  prepocitaj();
  ziadaj();
  sleduj('svet_zobrazenie_mapy');
  }

  // ── Stránka jednej parcely. Funguje aj bez homelabu: miesto, rozmer a
  //    súradnice vie mriežka sama, z homelabu prichádza len meno a kresba. ──
  function strankaParcely(koren) {
    var id = Number(new URLSearchParams(location.search).get('id'));
    var b = zCisla(id);
    if (!b) { koren.innerHTML = '<p>' + esc(T.chybaParcely) + '</p>'; return; }
    var lat = stredRiadku(b.r), lon = -180 + ((b.c + 0.5) * 360) / STL[b.r];
    // Tu sa nesmie použiť „Mimo otvorenej etapy“: táto stránka o etapách nič
    // nevie, takže by o štvorci v Bratislave tvrdila nepravdu vždy, keď homelab
    // nebeží. Chýbajúce meno miesta je chýbajúce meno miesta, nie stav predaja.
    function vykresli(p, bezSluzby) {
      var h = '<div class="parcela-hlava">';
      h += p && p.art_url ? '<img src="' + esc(p.art_url) + '" width="128" height="128" decoding="async" alt="' + esc(T.kresbaAlt) + '">' : '';
      h += '<div><p class="list-cislo">' + esc(T.cislo) + ' ' + cisloText(id) + '</p>';
      var krajina = p && (p.country_name || p.country);
      var casti = p ? [p.region !== p.city ? p.region : null, krajina].filter(Boolean) : [];
      h += '<p class="list-miesto">' + (p && p.city ? '<b>' + esc(p.city) + '</b>' + (casti.length ? ', ' + esc(casti.join(', ')) : '')
        : casti.length ? '<b>' + esc(casti.join(', ')) + '</b>'
          : p && !p.for_sale && p.status === 'closed' ? esc(p.land ? T.nepredajnaSus : T.more)
            : esc(p || bezSluzby ? T.miestoBezSluzby : T.miestoZistujem)) + '</p></div></div>';
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
    // Služba vracia {"poradie":[{"nazov":…,"spolu":…,"za_mesiac":…}]}.
    // S d.rows bol rebríček prázdny aj vtedy, keď bolo čo ukázať.
    api('/api/leaderboard?scope=obec').then(function (d) {
      var riadky = (d && d.poradie) || [];
      if (!riadky.length) return;
      // Krajina je v každom riadku: vo svete je 189 názvov miest viackrát a
      // Springfield bez krajiny nič nehovorí. Služba ich zoskupuje podľa slugu.
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
