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
  function cisloText(n) { return String(n).replace(/B(?=(d{3})+(?!d))/g, ' '); }
  function km(x) { var s = x.toFixed(2); return JAZYK === 'en' ? s : s.replace('.', ','); }
  function stupne(lat, lon) {
    return Math.abs(lat).toFixed(3) + '° ' + (lat >= 0 ? T.sever : T.juh) + ', '
      + Math.abs(lon).toFixed(3) + '° ' + (lon >= 0 ? T.vychod : T.zapad);
  }
  /** Umami. Návšteva, klik na bunku, otvorenie pokladne a platba sa merajú oddelene. */
  function sleduj(meno) { try { if (window.umami && window.umami.track) window.umami.track(meno); } catch (e) {} }
  /** Volanie homelabu. Keď nebeží, sľub sa odmietne a stránka to povie nahlas. */
  function api(cesta, data) {
    if (!API) return Promise.reject(new Error('bez api'));
    var nast = { credentials: 'omit' };
    if (data) { nast.method = 'POST'; nast.headers = { 'Content-Type': 'application/json' }; nast.body = JSON.stringify(data); }
    return fetch(API + cesta, nast).then(function (o) {
      if (!o.ok) throw new Error('stav ' + o.status);
      return o.json();
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
    lon: 17.8, my: doY(48.9), s: 40,   // s je v zariadeniových pixeloch na stupeň dĺžky
    w: 0, h: 0,
    vybrana: null, podKurzorom: null,
    mriezka: null, dlazdice: [],
    sluzba: 'neznama', stav: null,
    vyberOd: 0,
  };
  var POKOJ = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FARBY = {
    more: '#0a0908', mriezka: 'rgba(255,255,255,.085)', mriezkaSilna: 'rgba(255,255,255,.16)',
    vyber: '#ffd9c9', predane: 'rgba(242,100,60,.85)', mimoEtapy: 'rgba(0,0,0,.42)',
  };

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

  // ── Prevody obrazovka a svet ─────────────────────────────────────────────
  function naX(lon) { return (lon - S.lon) * S.s + S.w / 2; }
  function naY(my) { return (S.my - my) * S.s + S.h / 2; }
  function zX(x) { return S.lon + (x - S.w / 2) / S.s; }
  function zYObr(y) { return S.my - (y - S.h / 2) / S.s; }

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

  function kresliDlazdicu(d) {
    var bmp = obrazky[d.src].bmp;
    var x0 = naX(d.xMin), sirka = (d.xMax - d.xMin) * S.s;
    var y0 = naY(d.yMax), vyska = (d.yMax - d.yMin) * S.s;
    var krok = 360 * S.s;
    ctx.imageSmoothingEnabled = sirka < d.w;
    if (!d.svet) { ctx.drawImage(bmp, x0, y0, sirka, vyska); return; }
    for (var k = Math.floor((0 - x0 - sirka) / krok); k <= Math.ceil((S.w - x0) / krok); k++) {
      var px = x0 + k * krok;
      if (px > S.w || px + sirka < 0) continue;
      ctx.drawImage(bmp, px, y0, sirka, vyska);
    }
  }

  var svetove = [], regionalne = [];
  function kresli(t) {
    ctx.fillStyle = FARBY.more;
    ctx.fillRect(0, 0, S.w, S.h);

    // Svetová dlaždica je vždy vespodok, regionálna sa na ňu položí ako ostrejší
    // výrez. Bez toho by pri zazoomovaní na kraj výrezu ostala čierna plocha.
    var chcem = najlepsia(svetove, false);
    if (chcem) dlazdica(chcem.src);
    var zakl = najlepsia(svetove, true);
    if (zakl) kresliDlazdicu(zakl);

    var viditelne = regionalne.filter(vidnoDlazdicu);
    var chcemR = najlepsia(viditelne, false);
    if (chcemR && (!zakl || hustota(chcemR) > hustota(zakl)) && S.s > hustota(zakl || chcemR)) dlazdica(chcemR.src);
    var reg = najlepsia(viditelne, true);
    if (reg && (!zakl || hustota(reg) > hustota(zakl))) kresliDlazdicu(reg);

    kresliPredane();
    kresliMriezku();
    kresliVyber(t);
  }

  /** Predané bunky. Celosvetová vrstva z homelabu, pri priblížení presné bloky. */
  function kresliPredane() {
    if (vrstva.bmp) {
      var d = S.dlazdice[0];
      var x0 = naX(-180), y0 = naY(d.yMax), sirka = 360 * S.s, vyska = (d.yMax - d.yMin) * S.s;
      ctx.imageSmoothingEnabled = false;
      for (var k = Math.floor((0 - (x0 + sirka)) / sirka); k <= Math.ceil((S.w - x0) / sirka); k++) {
        ctx.drawImage(vrstva.bmp, x0 + k * sirka, y0, sirka, vyska);
      }
    }
    var kluce = Object.keys(bloky);
    if (!kluce.length) return;
    // Jedna cesta a jedno fill pre celý viditeľný výsek: tisíc predaných buniek
    // je tisíc obdĺžnikov v jednej ceste, nie tisíc volaní fill.
    ctx.fillStyle = FARBY.predane;
    ctx.beginPath();
    var kreslene = 0;
    for (var i = 0; i < kluce.length; i++) {
      var b = bloky[kluce[i]];
      if (!b || !b.bity) continue;
      for (var j = 0; j < 4096; j++) {
        if (!(b.bity[j >> 3] & (128 >> (j & 7)))) continue;
        var r = b.r0 + (j >> 6), c = b.c0 + (j & 63);
        if (r >= RIADKY || c >= STL[r]) continue;
        obdlznikBunky(r, c);
        if (++kreslene > 20000) { i = kluce.length; break; }
      }
    }
    if (kreslene) ctx.fill();
  }

  /** Pridá obdĺžnik bunky do prebiehajúcej cesty. Cestu nezačína ani nekreslí. */
  function obdlznikBunky(r, c) {
    var sirkaDeg = 360 / STL[r];
    var hore = naY(doY(90 - r * RIADOK)), dole = naY(doY(90 - (r + 1) * RIADOK));
    var x = naX(-180 + c * sirkaDeg), sir = sirkaDeg * S.s;
    if (x + sir < 0) x += 360 * S.s;
    else if (x > S.w) x -= 360 * S.s;
    ctx.rect(x, hore, sir, dole - hore);
    return { x: x, y: hore, w: sir, h: dole - hore };
  }

  /** Mriežka sa kreslí až nad prahom priblíženia a len pre viditeľné riadky. */
  function kresliMriezku() {
    var rHore = riadokZoSirky(zY(zYObr(0))), rDole = riadokZoSirky(zY(zYObr(S.h)));
    var bunkaPx = (360 / STL[rHore]) * S.s;
    if (bunkaPx < 9) return;
    var jemna = bunkaPx < 26;
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
  function ukazList() {
    if (!S.vybrana) { list.hidden = true; return; }
    var r = S.vybrana.r, c = S.vybrana.c, id = S.vybrana.id;
    var lat = stredRiadku(r), lon = -180 + ((c + 0.5) * 360) / STL[r];
    var p = parcely[id];
    var vEtape = vOtvorenejEtape(lat, lon);
    var h = '';
    h += '<p class="list-cislo">' + esc(T.cislo) + ' ' + cisloText(id) + '</p>';
    var miesto = p && p.city ? '<b>' + esc(p.city) + '</b>' + (p.region ? ', ' + esc(p.region) : '') + (p.country ? ', ' + esc(p.country) : '')
      : (vEtape ? esc(T.miestoZistujem) : esc(T.miestoNeznama));
    h += '<p class="list-miesto">' + miesto + '</p>';
    if (p && p.art) h += '<img class="list-kresba" alt="' + esc(T.kresbaAlt) + '" src="' + esc(p.art) + '" width="88" height="88">';
    h += '<dl class="list-udaje">';
    h += '<div><dt>' + esc(T.suradnice) + '</dt><dd>' + esc(stupne(lat, lon)) + '</dd></div>';
    h += '<div><dt>' + esc(T.rozmer) + '</dt><dd>' + km(sirkaKm(r)) + ' × ' + km(vyskaKm(r)) + ' km</dd></div>';
    if (p && p.name) h += '<div><dt>' + esc(T.meno) + '</dt><dd>' + esc(p.name) + '</dd></div>';
    if (p && p.founder) h += '<div><dt>' + esc(T.zakladatel) + '</dt><dd>' + esc(String(p.founder)) + ' / 100</dd></div>';
    h += '</dl>';

    if (p && p.status === 'paid') {
      if (p.link && p.linkEnabled) h += '<a class="btn btn-line" rel="nofollow ugc noopener" target="_blank" href="' + esc(p.link) + '">' + esc(T.otvorOdkaz) + '</a>';
      h += '<a class="btn btn-line" href="' + esc(CESTA_MAPY + T.cestaParcely + '?id=' + id) + '" data-umami-event="svet_zdielanie">' + esc(T.zdielat) + '</a>';
      h += '<button class="btn btn-line" type="button" data-akcia="nahlasit">' + esc(T.nahlasit) + '</button>';
      h += '<p class="list-pravne">' + esc(T.predaneVysvetlenie) + '</p>';
    } else if (!vEtape) {
      h += '<p class="list-pravne">' + esc(T.mimoEtapy) + '</p>';
      h += '<a class="btn btn-line" href="#etapy">' + esc(T.precoMimo) + '</a>';
    } else {
      h += '<button class="btn btn-solid" type="button" data-akcia="kupit"' + (S.sluzba === 'nedostupna' ? ' disabled' : '') + '>'
        + esc(S.sluzba === 'nedostupna' ? T.kupitNedostupne : T.kupit) + '</button>';
      h += '<button class="btn btn-line" type="button" data-akcia="kreslit">' + esc(T.skusKreslit) + '</button>';
      h += '<p class="list-pravne">' + esc(T.licenciaVeta) + ' <a href="' + esc(T.cestaPodmienky) + '">' + esc(T.podmienkyOdkaz) + '</a></p>';
    }
    list.innerHTML = h;
    list.hidden = false;
    if (!POKOJ) { list.classList.remove('prichadza'); void list.offsetWidth; list.classList.add('prichadza'); }
    if (oznam) oznam.textContent = T.cislo + ' ' + cisloText(id) + '. ' + (p && p.city ? p.city : '') + ' ' + km(sirkaKm(r)) + ' × ' + km(vyskaKm(r)) + ' km.';
  }

  function vOtvorenejEtape(lat, lon) {
    var e = S.mriezka && S.mriezka.etapa;
    if (!e) return false;
    return lat >= e.latMin && lat <= e.latMax && lon >= e.lonMin && lon <= e.lonMax;
  }

  list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-akcia]');
    if (!b) return;
    if (b.getAttribute('data-akcia') === 'kupit') pokladna();
    else if (b.getAttribute('data-akcia') === 'kreslit') kresliacePlatno();
    else if (b.getAttribute('data-akcia') === 'nahlasit') nahlasit();
  });

  // ── Homelab. Keď nebeží, mapa funguje ďalej a napíše sa to. ─────────────
  var vrstva = { bmp: null, kedy: 0 };
  var bloky = {};

  function skusSluzbu() {
    api('/api/health').then(function () {
      S.sluzba = 'bezi';
      skryPas();
      nacitajStav();
      nacitajVrstvu();
      ukazList();
    }).catch(function () {
      S.sluzba = 'nedostupna';
      pas(T.sluzbaNedostupna);
      ukazList();
    });
  }

  var pasEl = koren.querySelector('[data-pas]');
  function pas(text) { if (pasEl) { pasEl.textContent = text; pasEl.hidden = false; } }
  function skryPas() { if (pasEl) pasEl.hidden = true; }

  function nacitajStav() {
    api('/api/state.json').then(function (d) {
      S.stav = d;
      var el = koren.querySelector('[data-pocitadlo]');
      if (el && typeof d.sold === 'number' && typeof d.total === 'number') {
        el.innerHTML = '<b>' + cisloText(d.sold) + ' / ' + cisloText(d.total) + '</b>' + esc(T.pocitadloPopis);
      }
    }).catch(function () {});
  }

  function nacitajVrstvu() {
    if (S.sluzba !== 'bezi') return;
    fetch(API + '/api/overlay.png', { cache: 'default' })
      .then(function (o) { if (!o.ok) throw 0; return o.blob(); })
      .then(createImageBitmap)
      .then(function (b) { if (vrstva.bmp) vrstva.bmp.close(); vrstva.bmp = b; vrstva.kedy = Date.now(); ziadaj(); })
      .catch(function () {});
  }

  function nacitajParcelu(id) {
    if (S.sluzba !== 'bezi' || parcely[id]) { if (parcely[id]) ukazList(); return; }
    api('/api/parcel/' + id).then(function (d) { parcely[id] = d; if (S.vybrana && S.vybrana.id === id) ukazList(); }).catch(function () {});
  }

  /**
   * Vlastníctvo po blokoch 64 × 64. Prehliadač nikdy nedostane všetkých päť
   * miliónov buniek, sťahuje len bloky, ktoré práve vidno. To je jediný dôvod,
   * prečo mapa nebude sekať ani vtedy, keď bude predané celé Slovensko.
   */
  function dopytajBloky() {
    if (S.sluzba !== 'bezi' || document.hidden) return;
    var rHore = riadokZoSirky(zY(zYObr(0))), rDole = riadokZoSirky(zY(zYObr(S.h)));
    if ((360 / STL[rHore]) * S.s < 3) return;
    var zoznam = [];
    for (var rb = rHore >> 6; rb <= (rDole >> 6) && zoznam.length < 12; rb++) {
      var stredR = Math.min(RIADKY - 1, (rb << 6) + 32);
      var cOd = stlpecZDlzky(stredR, zX(0)) >> 6, cDo = stlpecZDlzky(stredR, zX(S.w)) >> 6;
      if (cDo < cOd) cDo = cOd;
      for (var c = cOd; c <= cDo && zoznam.length < 12; c++) zoznam.push([rb, c]);
    }
    zoznam.forEach(function (b) {
      var kluc = b[0] + ',' + b[1];
      if (bloky[kluc]) return;
      bloky[kluc] = { r0: b[0] << 6, c0: b[1] << 6, bity: null };
      fetch(API + '/api/chunk/' + b[0] + '/' + b[1])
        .then(function (o) { if (!o.ok) throw 0; return o.arrayBuffer(); })
        .then(function (buf) { bloky[kluc].bity = new Uint8Array(buf); ziadaj(); })
        .catch(function () { delete bloky[kluc]; });
    });
  }
  var blokyTimer = 0;
  function naplanujBloky() { clearTimeout(blokyTimer); blokyTimer = setTimeout(dopytajBloky, 220); }
  setInterval(function () { if (!document.hidden && S.sluzba === 'bezi') { nacitajVrstvu(); nacitajStav(); } }, 60000);

  // ── Pokladňa ─────────────────────────────────────────────────────────────
  function pokladna() {
    if (!S.vybrana) return;
    sleduj('svet_otvorena_pokladna');
    var id = S.vybrana.id;
    var h = '<p class="list-cislo">' + esc(T.cislo) + ' ' + cisloText(id) + '</p>';
    h += '<p class="list-miesto">' + esc(T.pokladnaUvod) + '</p>';
    h += '<label class="suhlas"><input type="checkbox" data-suhlas="dodanie"><span>' + esc(T.suhlasDodanie) + '</span></label>';
    h += '<label class="suhlas"><input type="checkbox" data-suhlas="vek"><span>' + esc(T.suhlasVek) + '</span></label>';
    h += '<label class="suhlas suhlas-mail"><span class="skryte">' + esc(T.email) + '</span><input type="email" data-email placeholder="' + esc(T.email) + '" required></label>';
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
      api('/api/reserve', { row: S.vybrana.r, col: S.vybrana.c })
        .then(function () {
          return api('/api/checkout', {
            row: S.vybrana.r, col: S.vybrana.c, locale: JAZYK,
            email: list.querySelector('[data-email]').value,
            consentDelivery: true, consentAge: true,
            art: localStorage.getItem('svet-kresba-' + id) || null,
          });
        })
        .then(function (d) { if (d && d.url) { sleduj('svet_odchod_do_stripe'); location.href = d.url; } else throw new Error('bez adresy'); })
        .catch(function () { tlacidlo.textContent = T.pokladnaChyba; tlacidlo.disabled = false; });
    });
    list.querySelector('[data-akcia="spat"]').addEventListener('click', ukazList);
  }

  function nahlasit() {
    if (!S.vybrana) return;
    var dovod = window.prompt(T.nahlasitVyzva, '');
    if (!dovod) return;
    api('/api/report', { parcel: S.vybrana.id, reason: dovod.slice(0, 400) })
      .then(function () { pas(T.nahlasenePrijate); })
      .catch(function () { pas(T.nahlasenieMailom); });
  }

  // ── Kreslenie 32 × 32 pred zaplatením ───────────────────────────────────
  var PALETA = ['#0f0c0a', '#3a322c', '#6b5e54', '#a89c92', '#e8e2d9', '#f2643c', '#ffa14f', '#ffd166',
    '#6aa84f', '#2f7d4f', '#4a90d9', '#2a5ea8', '#9b5de5', '#d64550', '#8b4513', '#1f6f6b'];
  function kresliacePlatno() {
    if (!S.vybrana) return;
    sleduj('svet_prve_kreslenie');
    var id = S.vybrana.id;
    var ulozene = localStorage.getItem('svet-kresba-' + id);
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
    var body = new Uint8Array(1024).fill(255);
    if (ulozene) { try { var u = atob(ulozene); for (var i = 0; i < 1024 && i < u.length; i++) body[i] = u.charCodeAt(i); } catch (e) {} }
    var farba = 5;
    function prekresli() {
      kctx.clearRect(0, 0, 32, 32);
      for (var i = 0; i < 1024; i++) {
        if (body[i] === 255) continue;
        kctx.fillStyle = PALETA[body[i]] || PALETA[0];
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
    kp.addEventListener('pointerdown', function (e) { malujem = true; kp.setPointerCapture(e.pointerId); maluj(e); });
    kp.addEventListener('pointermove', function (e) { if (malujem) maluj(e); });
    kp.addEventListener('pointerup', function () { malujem = false; });
    list.querySelector('.paleta').addEventListener('click', function (e) {
      var b = e.target.closest('[data-farba]');
      if (!b) return;
      farba = Number(b.getAttribute('data-farba'));
      list.querySelectorAll('[data-farba]').forEach(function (x) { x.setAttribute('aria-pressed', String(Number(x.getAttribute('data-farba')) === farba)); });
    });
    list.querySelector('[data-kres="guma"]').addEventListener('click', function () { farba = 255; });
    list.querySelector('[data-kres="vycisti"]').addEventListener('click', function () { body.fill(255); prekresli(); });
    list.querySelector('[data-akcia="spat2"]').addEventListener('click', ukazList);
  }

  // ── Hľadanie obce ────────────────────────────────────────────────────────
  var hladaciePole = koren.querySelector('[data-hladanie]');
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
      var id = Number(new URLSearchParams(location.search).get('p'));
      var b = id ? zCisla(id) : null;
      if (b) {
        S.lon = -180 + ((b.c + 0.5) * 360) / STL[b.r];
        S.my = doY(stredRiadku(b.r));
        S.s = Math.min(medze().maxS, 96 / (360 / STL[b.r]));
        uprav();
        vyber(b.r, b.c, true);
      } else {
        S.lon = e ? e.stred.lon : 17.8;
        S.my = doY(e ? e.stred.lat : 48.9);
        S.s = Math.max(medze().minS, S.w / 26);
        uprav();
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
    function vykresli(p) {
      var h = '<div class="parcela-hlava">';
      h += p && p.art ? '<img src="' + esc(p.art) + '" width="128" height="128" alt="' + esc(T.kresbaAlt) + '">' : '';
      h += '<div><p class="list-cislo">' + esc(T.cislo) + ' ' + cisloText(id) + '</p>';
      h += '<p class="list-miesto">' + (p && p.city ? '<b>' + esc(p.city) + '</b>' + (p.country ? ', ' + esc(p.country) : '') : esc(T.miestoNeznama)) + '</p></div></div>';
      h += '<dl class="list-udaje">';
      h += '<div><dt>' + esc(T.suradnice) + '</dt><dd>' + esc(stupne(lat, lon)) + '</dd></div>';
      h += '<div><dt>' + esc(T.rozmer) + '</dt><dd>' + km(sirkaKm(b.r)) + ' × ' + km(vyskaKm(b.r)) + ' km</dd></div>';
      if (p && p.name) h += '<div><dt>' + esc(T.meno) + '</dt><dd>' + esc(p.name) + '</dd></div>';
      if (p && p.founder) h += '<div><dt>' + esc(T.zakladatel) + '</dt><dd>' + esc(String(p.founder)) + ' / 100</dd></div>';
      h += '</dl>';
      if (p && p.link && p.linkEnabled) h += '<p><a rel="nofollow ugc noopener" target="_blank" href="' + esc(p.link) + '">' + esc(T.otvorOdkaz) + '</a></p>';
      h += '<p><a class="btn btn-solid" href="' + esc(CESTA_MAPY + '?p=' + id) + '">' + esc(T.doMapy) + '</a></p>';
      koren.innerHTML = h;
    }
    vykresli(null);
    api('/api/parcel/' + id).then(vykresli).catch(function () {});
  }

  // ── Rebríček. Len skutočné dáta; keď je prázdno, napíše sa, že je prázdno. ──
  function rebricek(koren) {
    api('/api/leaderboard?scope=obec').then(function (d) {
      var riadky = (d && d.rows) || [];
      if (!riadky.length) return;
      var h = '<table class="rebricek"><thead><tr><th>' + esc(T.rebricekMiesto) + '</th><th>' + esc(T.rebricekKrajina) + '</th><th>' + esc(T.rebricekPocet) + '</th></tr></thead><tbody>';
      for (var i = 0; i < riadky.length && i < 50; i++) {
        h += '<tr><td>' + esc(riadky[i].city) + '</td><td>' + esc(riadky[i].country) + '</td><td>' + cisloText(riadky[i].count) + '</td></tr>';
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
