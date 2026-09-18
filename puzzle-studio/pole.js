/* Pole: a slowly drifting field of empty puzzle grids, on one WebGL canvas.
 *
 * Why this exists and why only here. This is the page about making puzzles,
 * so the one moving thing on arling.sk that is not a product screenshot is
 * the shape of what the machine makes: grids. It carries no text and no
 * number, nothing in it has a solution, and it is never presented as a
 * puzzle. It is the workshop floor, not the goods.
 *
 * Rules it keeps, in the order they matter:
 *   1. prefers-reduced-motion: reduce  ->  ONE frame, the loop never starts.
 *   2. no WebGL (old browser, blocked context, lost context) -> the canvas is
 *      removed and a still PNG of the same field takes its place. The PNG is
 *      a screenshot of this very canvas, so the fallback is the real thing.
 *   3. off screen -> nothing is drawn (IntersectionObserver).
 *   4. tab hidden -> nothing is drawn (visibilitychange).
 *   5. 30 frames a second, never 60: the field moves about six points a
 *      second, so the extra thirty frames would be thirty identical pictures.
 *   6. no library, no second domain, no shader that needs an extension.
 *
 * Colours come from the page, not from here: the line colour is the computed
 * --ink of the document, so the field is light lines on the near black
 * surface, and would be black lines on paper without a line changing.
 *
 * Geometry is generated here from a fixed seed. It is NOT the puzzle engine
 * in app.js: these grids are drawn for looking at and were never solved.
 */
(function () {
  var band = document.getElementById('pole');
  if (!band) return;
  var canvas = band.querySelector('canvas.pole-platno');
  var zaloha = band.querySelector('.pole-zaloha');
  if (!canvas) return;

  function nechajZalohu() {
    canvas.remove();
    if (zaloha) zaloha.hidden = false;
  }

  var gl = null;
  try {
    gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: false, stencil: false,
                                      premultipliedAlpha: true, powerPreference: 'low-power' })
      || canvas.getContext('experimental-webgl', { alpha: true, antialias: true, depth: false });
  } catch (e) { gl = null; }
  if (!gl) { nechajZalohu(); return; }

  /* ── 1. Deterministic noise. Same field on every load, in every browser. ── */
  function seed(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── 2. The tiles. Four kinds of grid, all of them line work only. ──────
     Every generator writes into two lists: `ciary` for 1 point lines and
     `plochy` for the few filled cells a nonogram has. Coordinates are in
     tile units 0..1 and are scaled when the tile is placed. */
  function ramTile(c, a) {
    c.push(0, 0, 1, 0, a, 1, 0, 1, 1, a, 1, 1, 0, 1, a, 0, 1, 0, 0, a);
  }

  // 2.1 Sudoku: every cell line faint, the three by three block lines firmer.
  function sudoku(r, c) {
    var n = r() < 0.5 ? 6 : 9;
    var b = n === 6 ? 3 : 3;
    for (var i = 1; i < n; i++) {
      var t = i / n;
      var a = (i % b === 0) ? 0.95 : 0.42;
      c.push(t, 0, t, 1, a, 0, t, 1, t, a);
    }
    ramTile(c, 1);
  }

  // 2.2 Nonogram: a plain lattice with a run of cells marked in.
  function nonogram(r, c, f) {
    var n = 8 + Math.floor(r() * 4);
    for (var i = 1; i < n; i++) {
      var t = i / n;
      c.push(t, 0, t, 1, 0.34, 0, t, 1, t, 0.34);
    }
    ramTile(c, 1);
    var s = 1 / n;
    for (var y = 0; y < n; y++) {
      var x = 0;
      while (x < n) {
        if (r() < 0.30) {
          var dlzka = 1 + Math.floor(r() * 3);
          for (var k = 0; k < dlzka && x + k < n; k++) {
            var px = (x + k) * s, py = y * s;
            f.push(px, py, px + s, py, px + s, py + s,
                   px, py, px + s, py + s, px, py + s, 0.30);
          }
          x += dlzka + 1;
        } else x += 1;
      }
    }
  }

  // 2.3 Slitherlink: a lattice of dots and the outline of one blob of cells.
  function slitherlink(r, c) {
    var n = 6 + Math.floor(r() * 3);
    var s = 1 / n, d = s * 0.055;
    for (var y = 0; y <= n; y++) {
      for (var x = 0; x <= n; x++) {
        var px = x * s, py = y * s;
        c.push(px - d, py, px + d, py, 0.5, px, py - d, px, py + d, 0.5);
      }
    }
    var vnutri = {};
    var cx = Math.floor(n / 2), cy = Math.floor(n / 2), pocet = Math.floor(n * n * 0.34);
    for (var i = 0; i < pocet; i++) {
      vnutri[cx + ':' + cy] = 1;
      var smer = Math.floor(r() * 4);
      cx += smer === 0 ? 1 : smer === 1 ? -1 : 0;
      cy += smer === 2 ? 1 : smer === 3 ? -1 : 0;
      if (cx < 0) cx = 0; if (cx > n - 1) cx = n - 1;
      if (cy < 0) cy = 0; if (cy > n - 1) cy = n - 1;
    }
    for (var kluc in vnutri) {
      var p = kluc.split(':'), gx = +p[0], gy = +p[1];
      var hx = gx * s, hy = gy * s;
      if (!vnutri[(gx - 1) + ':' + gy]) c.push(hx, hy, hx, hy + s, 1);
      if (!vnutri[(gx + 1) + ':' + gy]) c.push(hx + s, hy, hx + s, hy + s, 1);
      if (!vnutri[gx + ':' + (gy - 1)]) c.push(hx, hy, hx + s, hy, 1);
      if (!vnutri[gx + ':' + (gy + 1)]) c.push(hx, hy + s, hx + s, hy + s, 1);
    }
  }

  // 2.4 Hashi: small islands on a lattice, joined by single and double spans.
  function hashi(r, c) {
    var n = 5 + Math.floor(r() * 2), s = 1 / n, rd = s * 0.26;
    var ostrovy = [];
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        if (r() < 0.42) ostrovy.push([x, y]);
      }
    }
    var mapa = {};
    ostrovy.forEach(function (o) { mapa[o[0] + ':' + o[1]] = 1; });
    ostrovy.forEach(function (o) {
      var px = (o[0] + 0.5) * s, py = (o[1] + 0.5) * s;
      var kroky = 12;
      for (var k = 0; k < kroky; k++) {
        var a1 = (k / kroky) * Math.PI * 2, a2 = ((k + 1) / kroky) * Math.PI * 2;
        c.push(px + Math.cos(a1) * rd, py + Math.sin(a1) * rd,
               px + Math.cos(a2) * rd, py + Math.sin(a2) * rd, 0.95);
      }
      // one span to the next island right and down, if there is one in line
      [[1, 0], [0, 1]].forEach(function (sm) {
        for (var d = 1; d < n; d++) {
          var qx = o[0] + sm[0] * d, qy = o[1] + sm[1] * d;
          if (qx >= n || qy >= n) return;
          if (!mapa[qx + ':' + qy]) continue;
          var ax = (qx + 0.5) * s, ay = (qy + 0.5) * s;
          var dvojity = r() < 0.34, e = s * 0.09;
          if (sm[0]) {
            if (dvojity) {
              c.push(px + rd, py - e, ax - rd, ay - e, 0.6, px + rd, py + e, ax - rd, ay + e, 0.6);
            } else c.push(px + rd, py, ax - rd, ay, 0.6);
          } else {
            if (dvojity) {
              c.push(px - e, py + rd, ax - e, ay - rd, 0.6, px + e, py + rd, ax + e, ay - rd, 0.6);
            } else c.push(px, py + rd, ax, ay - rd, 0.6);
          }
          return;
        }
      });
    });
    ramTile(c, 0.85);
  }

  var DRUHY = [sudoku, nonogram, slitherlink, hashi];

  /* ── 3. Laying the tiles out. Two staggered rows that repeat sideways. ──
     The field is built once in world points; drifting is a uniform, not new
     geometry. The field is drawn twice, a field width apart, so the seam
     never shows. */
  var TILE = 150;       // side of one grid, in world points
  var MEDZERA = 58;     // air between grids
  var KROK = TILE + MEDZERA;
  var STLPCOV = 9;      // grids across one period of the field
  var SIRKA_POLA = STLPCOV * KROK;

  var ciaryOut = [], plochyOut = [];
  (function postav() {
    var r = seed(20260918);
    for (var row = 0; row < 3; row++) {
      for (var col = 0; col < STLPCOV; col++) {
        var c = [], f = [];
        DRUHY[Math.floor(r() * DRUHY.length)](r, c, f);
        var mierka = TILE * (0.78 + r() * 0.34);
        var ox = col * KROK + (row % 2) * KROK * 0.46 + (r() - 0.5) * 22;
        var oy = row * KROK + (r() - 0.5) * 20;
        var jas = 0.55 + r() * 0.45;
        for (var i = 0; i < c.length; i += 5) {
          ciaryOut.push(ox + c[i] * mierka, oy + c[i + 1] * mierka, c[i + 4] * jas);
          ciaryOut.push(ox + c[i + 2] * mierka, oy + c[i + 3] * mierka, c[i + 4] * jas);
        }
        for (var j = 0; j < f.length; j += 13) {
          for (var v = 0; v < 6; v++) {
            plochyOut.push(ox + f[j + v * 2] * mierka, oy + f[j + v * 2 + 1] * mierka, f[j + 12] * jas);
          }
        }
      }
    }
  })();
  var VYSKA_POLA = 3 * KROK;

  /* ── 4. The one shader pair. Position and alpha in, one colour out. ───── */
  var VS = 'attribute vec2 a_p;attribute float a_a;uniform vec2 u_res;uniform vec2 u_pos;'
         + 'uniform float u_m;varying float v_a;void main(){'
         + 'vec2 p=(a_p+u_pos)*u_m;vec2 c=(p/u_res)*2.0-1.0;'
         + 'gl_Position=vec4(c.x,-c.y,0.0,1.0);v_a=a_a;}';
  var FS = 'precision mediump float;uniform vec3 u_c;uniform float u_o;varying float v_a;'
         + 'void main(){gl_FragColor=vec4(u_c*v_a*u_o,v_a*u_o);}';

  function shader(typ, zdroj) {
    var s = gl.createShader(typ);
    gl.shaderSource(s, zdroj); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
    return s;
  }
  var vs = shader(gl.VERTEX_SHADER, VS), fs = shader(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { nechajZalohu(); return; }
  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { nechajZalohu(); return; }
  gl.useProgram(prog);

  var aP = gl.getAttribLocation(prog, 'a_p');
  var aA = gl.getAttribLocation(prog, 'a_a');
  var uRes = gl.getUniformLocation(prog, 'u_res');
  var uPos = gl.getUniformLocation(prog, 'u_pos');
  var uM = gl.getUniformLocation(prog, 'u_m');
  var uC = gl.getUniformLocation(prog, 'u_c');
  var uO = gl.getUniformLocation(prog, 'u_o');

  function buffer(pole) {
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pole), gl.STATIC_DRAW);
    return { b: b, n: pole.length / 3 };
  }
  var bufCiary = buffer(ciaryOut);
  var bufPlochy = buffer(plochyOut);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.DEPTH_TEST);

  /* ── 5. The colour is the page's own ink, read once and on theme change. ── */
  var farba = [0.98, 0.98, 0.98];
  function citajFarbu() {
    var s = getComputedStyle(document.body).getPropertyValue('--ink').trim();
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
    if (!m) return;
    var h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    farba = [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }
  citajFarbu();

  /* ── 6. Size. Device pixels capped at 1.5, so a phone does not draw four
     times the pixels for a field of hairlines. ── */
  var W = 0, H = 0, dpr = 1, mierka = 1;
  function rozmer() {
    var r = band.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, r.width < 700 ? 1.25 : 1.5);
    W = Math.max(1, Math.round(r.width * dpr));
    H = Math.max(1, Math.round(r.height * dpr));
    canvas.width = W; canvas.height = H;
    canvas.style.width = r.width + 'px';
    canvas.style.height = r.height + 'px';
    // the field is scaled so that two of its three rows fill the band
    mierka = (H / (VYSKA_POLA * 0.62));
    gl.viewport(0, 0, W, H);
  }

  function kresli(t) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uRes, W, H);
    // world points -> device pixels; the band height already carries the dpr
    gl.uniform1f(uM, mierka);
    gl.uniform3f(uC, farba[0], farba[1], farba[2]);

    // six points a second sideways, and one very slow breath up and down
    var x = -(t * 6) % (SIRKA_POLA);
    var y = -VYSKA_POLA * 0.19 + Math.sin(t * 0.0715) * 9;

    function davka(buf, mode) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.b);
      gl.enableVertexAttribArray(aP);
      gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 12, 0);
      gl.enableVertexAttribArray(aA);
      gl.vertexAttribPointer(aA, 1, gl.FLOAT, false, 12, 8);
      for (var k = 0; k < 3; k++) {
        gl.uniform2f(uPos, x + k * SIRKA_POLA, y);
        gl.drawArrays(mode, 0, buf.n);
      }
    }
    gl.uniform1f(uO, 0.13);
    davka(bufPlochy, gl.TRIANGLES);
    gl.uniform1f(uO, 0.17);
    davka(bufCiary, gl.LINES);
  }

  /* ── 7. When it is allowed to move. ──────────────────────────────────── */
  var tichy = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var vidno = false, bezi = false, t0 = 0, posledny = 0, raf = 0;

  function snimok(ms) {
    raf = 0;
    if (!bezi) return;
    if (ms - posledny >= 32) { posledny = ms; kresli((ms - t0) / 1000); }
    raf = requestAnimationFrame(snimok);
  }
  function spusti() {
    if (bezi || !vidno || document.hidden || (tichy && tichy.matches)) return;
    bezi = true; t0 = performance.now() - 1; posledny = 0;
    raf = requestAnimationFrame(snimok);
  }
  function zastav() {
    bezi = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  function prekresliRaz() { rozmer(); kresli(tichy && tichy.matches ? 11 : 0); }

  var casovac = 0;
  window.addEventListener('resize', function () {
    clearTimeout(casovac);
    casovac = setTimeout(function () { rozmer(); if (!bezi) kresli(11); }, 160);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) zastav(); else spusti();
  });
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); zastav(); nechajZalohu(); });
  if (tichy && tichy.addEventListener) {
    tichy.addEventListener('change', function () {
      if (tichy.matches) { zastav(); prekresliRaz(); } else spusti();
    });
  }

  prekresliRaz();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (zaznamy) {
      vidno = zaznamy[0].isIntersecting;
      if (vidno) spusti(); else zastav();
    }, { rootMargin: '120px' }).observe(band);
  } else {
    vidno = true; spusti();
  }
})();
