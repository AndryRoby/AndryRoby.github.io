/* A-086: dekoratívne listy za skutočnými obálkami. Jeden draw call, max. 20 fps.
 * Obsah ani rozmery stránky na tomto plátne nezávisia. Bez knižníc a siete. */
(function () {
  'use strict';
  var platno = document.querySelector('[data-uv-webgl]');
  var pohyb = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var spojenie = navigator.connection;
  function uspora() { return (pohyb && pohyb.matches) || (spojenie && spojenie.saveData); }
  if (!platno || uspora() || !window.requestAnimationFrame) return;

  var gl, program, buffer, shaderV, shaderF;
  var observer, rozmery, idle = 0, odklad = 0, snimka = 0, hodiny = 0;
  var vidno = false, stranka = true, koniec = false, pripravene = false, zmena = true, zobrazene = false;
  var cas = 0, predosly = 0, pocet = 0, uCas, uPixel;
  var odpoj = [];
  function pocuvaj(ciel, udalost, fn, opts) {
    if (!ciel || !ciel.addEventListener) return;
    ciel.addEventListener(udalost, fn, opts);
    odpoj.push(function () { ciel.removeEventListener(udalost, fn, opts); });
  }
  function pauza() {
    if (snimka) window.cancelAnimationFrame(snimka);
    if (hodiny) window.clearTimeout(hodiny);
    snimka = hodiny = predosly = 0;
  }
  function uprac(strateny) {
    if (koniec) return;
    koniec = true;
    pauza();
    if (idle && window.cancelIdleCallback) window.cancelIdleCallback(idle);
    if (odklad) window.clearTimeout(odklad);
    if (observer) observer.disconnect();
    if (rozmery) rozmery.disconnect();
    odpoj.forEach(function (fn) { fn(); });
    if (gl && !strateny) {
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      if (shaderV) gl.deleteShader(shaderV);
      if (shaderF) gl.deleteShader(shaderF);
    }
    platno.removeAttribute('data-uv-webgl-ready');
    platno.width = platno.height = 1;
  }
  function vObraze() {
    var r = platno.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  }
  function rozmer() {
    var r = platno.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    // Strop platí aj pri retina monitore a extrémne veľkom okne.
    var mierka = Math.min(window.devicePixelRatio || 1, 1.25, 960 / r.width, 800 / r.height, Math.sqrt(650000 / (r.width * r.height)));
    var w = Math.max(1, Math.floor(r.width * mierka));
    var h = Math.max(1, Math.floor(r.height * mierka));
    if (platno.width !== w || platno.height !== h) {
      platno.width = w; platno.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uPixel, 2.4 * mierka / w, 2.4 * mierka / h);
    zmena = false;
    return true;
  }
  function preloz(typ, zdroj) {
    var s = gl.createShader(typ);
    gl.shaderSource(s, zdroj); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); throw new Error('shader'); }
    return s;
  }
  function geometria() {
    var von = [];
    // Štyri kubické hrany jedného prehnutého listu, opakované ako knižný blok.
    var hrany = [
      [[-.74,-.82],[-.90,-.34],[-.97,.46],[-.66,.78]],
      [[-.66,.78],[-.35,1.01],[.37,.98],[.74,.57]],
      [[.74,.57],[1.03,.20],[.97,-.41],[.59,-.74]],
      [[.59,-.74],[.29,-.91],[-.38,-.65],[-.74,-.82]]
    ];
    function bod(h, t, vrstva) {
      var a = 1 - t, x = a*a*a*h[0][0]+3*a*a*t*h[1][0]+3*a*t*t*h[2][0]+t*t*t*h[3][0];
      var y = a*a*a*h[0][1]+3*a*a*t*h[1][1]+3*a*t*t*h[2][1]+t*t*t*h[3][1];
      var uhol = (vrstva - 5) * .024, c = Math.cos(uhol), s = Math.sin(uhol);
      var mierka = .87 + vrstva * .014;
      return [(x*c-y*s)*mierka, (x*s+y*c)*mierka];
    }
    for (var vrstva = 0; vrstva < 11; vrstva++) {
      var cesta = [];
      hrany.forEach(function (h) { for (var k = 0; k < 20; k++) cesta.push(bod(h, k / 20, vrstva)); });
      var akcent = vrstva === 2 || vrstva === 9 ? 1 : 0;
      for (var i = 0; i < cesta.length; i++) {
        var a = cesta[i], b = cesta[(i + 1) % cesta.length];
        var dx = b[0] - a[0], dy = b[1] - a[1], dlzka = Math.sqrt(dx*dx + dy*dy);
        var nx = -dy / dlzka, ny = dx / dlzka;
        [[a,-1],[a,1],[b,-1],[b,-1],[a,1],[b,1]].forEach(function (v) {
          von.push(v[0][0],v[0][1],nx,ny,v[1],akcent,vrstva);
        });
      }
    }
    return new Float32Array(von);
  }
  function priprav() {
    try {
      gl = platno.getContext('webgl', { alpha:true, antialias:false, depth:false, stencil:false, powerPreference:'low-power', failIfMajorPerformanceCaveat:true, preserveDrawingBuffer:false });
      if (!gl) return false;
      shaderV = preloz(gl.VERTEX_SHADER, [
        'attribute vec2 aBod; attribute vec2 aNormal; attribute float aOkraj; attribute float aAkcent; attribute float aVrstva;',
        'uniform float uCas; uniform vec2 uPixel; varying float vOkraj; varying float vAkcent;',
        'void main(){',
        'vec2 p=aBod; float faza=uCas*.23+aVrstva*.11;',
        'p.x+=.014*sin(faza+p.y*2.); p.y+=.012*cos(faza*.8+p.x*2.);',
        'gl_Position=vec4(p+aNormal*aOkraj*uPixel,0.,1.); vOkraj=aOkraj; vAkcent=aAkcent; }'
      ].join('\n'));
      shaderF = preloz(gl.FRAGMENT_SHADER, [
        'precision mediump float; varying float vOkraj; varying float vAkcent;',
        'void main(){float a=(1.-smoothstep(.2,1.,abs(vOkraj)))*mix(.20,.38,vAkcent);',
        'vec3 farba=mix(vec3(.957,.933,.89),vec3(.949,.392,.235),vAkcent); gl_FragColor=vec4(farba*a,a);}'
      ].join('\n'));
      program = gl.createProgram();
      gl.attachShader(program, shaderV); gl.attachShader(program, shaderF); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
      gl.useProgram(program);
      var data = geometria(); pocet = data.length / 7;
      buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      [['aBod',2,0],['aNormal',2,2],['aOkraj',1,4],['aAkcent',1,5],['aVrstva',1,6]].forEach(function (a) {
        var miesto = gl.getAttribLocation(program, a[0]);
        gl.enableVertexAttribArray(miesto); gl.vertexAttribPointer(miesto,a[1],gl.FLOAT,false,28,a[2]*4);
      });
      uCas = gl.getUniformLocation(program,'uCas'); uPixel = gl.getUniformLocation(program,'uPixel');
      gl.clearColor(0,0,0,0); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      pripravene = true;
      return true;
    } catch (_) { return false; }
  }
  function bezi() { return !koniec && vidno && stranka && !document.hidden && !uspora(); }
  function kresli(teraz) {
    snimka = 0;
    if (!bezi()) return;
    if (zmena && !rozmer()) return;
    if (predosly) cas += Math.min(teraz - predosly, 100) / 1000;
    predosly = teraz;
    gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform1f(uCas,cas); gl.drawArrays(gl.TRIANGLES,0,pocet);
    if (!zobrazene) { platno.setAttribute('data-uv-webgl-ready','true'); zobrazene = true; }
    // Časovač + rAF: CPU sa nebudí 60-krát za sekundu len preto, aby snímku preskočil.
    hodiny = window.setTimeout(function () { hodiny = 0; if (bezi()) snimka = window.requestAnimationFrame(kresli); }, 50);
  }
  function obnov() {
    if (!bezi()) { pauza(); return; }
    if (!pripravene && !priprav()) { uprac(false); return; }
    if (!snimka && !hodiny) snimka = window.requestAnimationFrame(kresli);
  }
  function sleduj() {
    idle = odklad = 0;
    if (koniec || uspora()) return;
    if (window.IntersectionObserver) {
      observer = new window.IntersectionObserver(function (polozky) {
        vidno = polozky[0].isIntersecting;
        obnov();
      }, { threshold:0 });
      observer.observe(platno);
    } else {
      function skontroluj() { vidno = vObraze(); obnov(); }
      pocuvaj(window,'scroll',skontroluj,{passive:true});
      skontroluj();
    }
    if (koniec) return;
    if (window.ResizeObserver) {
      rozmery = new window.ResizeObserver(function () { zmena = true; obnov(); });
      rozmery.observe(platno);
    }
    pocuvaj(window,'resize',function () { zmena = true; if (!observer) vidno = vObraze(); obnov(); },{passive:true});
    pocuvaj(document,'visibilitychange',obnov);
    pocuvaj(window,'pageshow',function () { stranka = true; zmena = true; obnov(); });
    pocuvaj(platno,'webglcontextlost',function () { uprac(true); });
  }
  function poNacitani() {
    if (koniec || uspora()) return;
    if (window.requestIdleCallback) idle = window.requestIdleCallback(sleduj,{timeout:2000});
    else odklad = window.setTimeout(sleduj,200);
  }
  pocuvaj(window,'pagehide',function (e) { if (e.persisted) { stranka = false; pauza(); } else uprac(false); });
  pocuvaj(pohyb,'change',function () { if (uspora()) uprac(false); });
  pocuvaj(spojenie,'change',function () { if (uspora()) uprac(false); });
  if (document.readyState === 'complete') poNacitani();
  else pocuvaj(window,'load',poNacitani,{once:true});
})();
