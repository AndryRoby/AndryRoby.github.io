/* Úvod: svet dlaždíc v hero (Fable, 26. 9. 2026). Ten istý svet ako film „Every square“:
 * bodka dopadne na hlavné tlačidlo a vlna prebehne dlaždicami; prst (mobil) alebo klik spustí vlnu,
 * myš na PC jemne nadvihne dlaždice pod sebou. Jeden shader, jeden draw call, bez knižníc a siete.
 * Kreslí sa len počas pohybu (inak 0 snímok), mimo obrazovky a v skrytej karte nič.
 * prefers-reduced-motion alebo šetrenie dát: nič sa nespustí, stránka vyzerá rovnako ako bez plátna. */
(function () {
  'use strict';
  var platno = document.querySelector('[data-uv-dlazdice]');
  var hero = platno && platno.parentNode;
  var pohyb = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var spojenie = navigator.connection;
  if (!platno || !hero || (pohyb && pohyb.matches) || (spojenie && spojenie.saveData) || !window.requestAnimationFrame) return;

  var gl, prog, buf, u = {}, snimka = 0, t0 = 0, vidno = true, pripravene = false, koniec = false;
  var mierka = 1, W = 1, H = 1, cell = 56, klud = 0.03;
  var vlny = []; // [x, y, t, sila] v px plátna, t v sekundách
  var hover = { x: -1e4, y: -1e4, s: 0, ciel: 0 };
  var bodka = null; // { x, y, t } pád na tlačidlo
  var dalsia = 0;
  var MAX_VLN = 4, TRVANIE = 4.2;

  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FS = [
    'precision mediump float;',
    'uniform vec2 uRes;uniform float uCell,uTime,uSpeed,uKlud;uniform vec4 uRip[4];uniform vec3 uHover;uniform vec4 uDot;',
    'float sdb(vec2 q,vec2 b,float r){vec2 d=abs(q)-b+r;return length(max(d,0.))+min(max(d.x,d.y),0.)-r;}',
    // vlna: výška, z ktorej sa počíta aj sklon a svetlo
    'float hgt(vec2 c){float s=0.;float sg=uCell*.95;',
    ' for(int i=0;i<4;i++){vec4 r=uRip[i];float dt=uTime-r.z;',
    '  if(dt>0.&&dt<4.2){float d=length(c-r.xy);float ph=d-dt*uSpeed;float e=(1.-exp(-dt/.05))*exp(-dt*.75)*(1.-smoothstep(3.2,4.2,dt))*r.w;',
    '   s+=e*(exp(-ph*ph/(2.*sg*sg))-.5*exp(-(ph+1.8*sg)*(ph+1.8*sg)/(2.*sg*sg)));}}',
    ' return s;}',
    // myš: len zdvih, bez sklonu; so sklonom by lampa vpravo hore rozsvietila dlaždicu vpravo hore od kurzora
    'float hov(vec2 c){float hd=length(c-uHover.xy);return uHover.z*.62*exp(-hd*hd/(1.6*uCell*uCell));}',
    'void main(){',
    ' vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);',
    ' vec2 ce=(floor(p/uCell)+.5)*uCell;',
    ' float hh=hov(ce);float h=hgt(ce)+hh;',
    ' float gx=hgt(ce+vec2(uCell,0.))-hgt(ce-vec2(uCell,0.));',
    ' float gy=hgt(ce+vec2(0.,uCell))-hgt(ce-vec2(0.,uCell));',
    ' float hb=uCell*.5-max(2.,uCell*.045);float rr=uCell*.2;',
    ' vec2 q=p-ce+vec2(h,h)*uCell*.07;',
    ' float sd=sdb(q,vec2(hb),rr);',
    ' float px=1.;float tile=1.-smoothstep(-px,px,sd);',
    // tieň zdvihnutej dlaždice vpravo dole
    ' vec2 qs=p-ce-vec2(h,h)*uCell*.14-vec2(1.);',
    ' float sh=(1.-smoothstep(-3.,4.,sdb(qs,vec2(hb),rr)))*clamp(h,0.,1.)*.5*(1.-tile);',
    // svetlo lampy vpravo hore, sklon dlaždice podľa vlny
    ' vec3 n=normalize(vec3(-gx*1.3,-gy*1.3,1.));vec3 L=normalize(vec3(.55,-.62,.56));',
    ' float dif=clamp(dot(n,L),0.,1.);float spec=pow(clamp(dot(reflect(-L,n),vec3(0.,0.,1.)),0.,1.),10.);',
    // hrana: horná ľavá svetlá, dolná pravá tmavá
    ' float hrana=smoothstep(-5.,-.5,sd)*tile;vec2 nq=normalize(q+1e-4);',
    ' float hore=clamp(dot(nq,vec2(.62,-.78)),0.,1.);float dole=clamp(dot(nq,vec2(-.62,.78)),0.,1.);',
    ' float zdvih=clamp(abs(h),0.,1.);',
    ' vec3 med=vec3(.949,.392,.235);vec3 teplo=vec3(1.,.86,.72);',
    ' float a=tile*(uKlud+.14*zdvih+.17*hh)+hrana*(uKlud*1.4*hore+.16*zdvih*hore)+tile*spec*(.04+.34*zdvih);',
    ' vec3 col=mix(teplo,med,clamp(.35+zdvih*.9,0.,1.))*(.7+.5*dif);',
    ' vec4 o=vec4(col*a,a);',
    ' o=mix(o,vec4(0.,0.,0.,.5),sh*(1.-o.a));',
    ' o.rgb=o.rgb*(1.-hrana*dole*.5*tile);',
    // bodka: oranžový kotúč s tieňom, kým padá na tlačidlo
    ' if(uDot.z>0.){float dd=length(p-uDot.xy);float lift=uDot.w;',
    '  float ds=length(p-uDot.xy-vec2(lift*.35+2.,lift*.5+3.));float tsh=(1.-smoothstep(uDot.z*.6,uDot.z*1.7,ds))*.45*(1.-clamp(lift/140.,0.,1.));',
    '  o=mix(o,vec4(0.,0.,0.,.6),tsh*(1.-o.a*.5));',
    '  float disk=1.-smoothstep(uDot.z-1.,uDot.z+.8,dd);',
    '  vec3 dc=vec3(.949,.392,.235)*(1.05-.35*smoothstep(0.,uDot.z,length(p-uDot.xy+vec2(uDot.z*.35,uDot.z*.4))));',
    '  o=mix(o,vec4(dc,1.),disk);}',
    ' gl_FragColor=o;}'
  ].join('\n');

  function shader(typ, zdroj) {
    var s = gl.createShader(typ); gl.shaderSource(s, zdroj); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader');
    return s;
  }
  function priprav() {
    gl = platno.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) return false;
    prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var a = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    ['uRes', 'uCell', 'uTime', 'uSpeed', 'uKlud', 'uRip', 'uHover', 'uDot'].forEach(function (k) { u[k] = gl.getUniformLocation(prog, k); });
    gl.clearColor(0, 0, 0, 0);
    return true;
  }
  function rozmer() {
    var r = platno.getBoundingClientRect();
    if (!r.width || !r.height) return;
    mierka = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(1400000 / (r.width * r.height)));
    var w = Math.max(1, Math.round(r.width * mierka)), h = Math.max(1, Math.round(r.height * mierka));
    if (w !== W || h !== H) { W = w; H = h; platno.width = w; platno.height = h; gl.viewport(0, 0, w, h); }
    cell = (r.width < 700 ? 46 : 62) * mierka;
    klud = r.width < 700 ? 0.018 : 0.03; // na mobile je text cez celú šírku, mriežka v pokoji tichšia
  }
  function cas() { return (performance.now() - t0) / 1000; }
  function bod(el) {
    var r = platno.getBoundingClientRect(), b = el.getBoundingClientRect();
    return { x: (b.left + b.width * 0.86 - r.left) * mierka, y: (b.top + b.height * 0.5 - r.top) * mierka };
  }
  function vlna(x, y, sila) {
    vlny.push([x, y, cas(), sila]);
    while (vlny.length > MAX_VLN) vlny.shift();
    spusti();
  }
  function aktivne(t) {
    if (bodka && t - bodka.t < 1.2) return true;
    if (hover.s > 0.004 || hover.ciel > 0) return true;
    for (var i = 0; i < vlny.length; i++) if (t - vlny[i][2] < TRVANIE) return true;
    return false;
  }
  function kresli() {
    snimka = 0;
    if (koniec || !vidno || document.hidden) return;
    var t = cas();
    hover.s += (hover.ciel - hover.s) * 0.12;
    var rip = new Float32Array(16);
    for (var i = 0; i < 4; i++) {
      var v = vlny[i];
      if (v) { rip[i * 4] = v[0]; rip[i * 4 + 1] = v[1]; rip[i * 4 + 2] = v[2]; rip[i * 4 + 3] = v[3]; } else rip[i * 4 + 2] = -99;
    }
    var dot = [0, 0, 0, 0];
    if (bodka) {
      var dt = t - bodka.t, pad = 0.5;
      if (dt < pad) {
        var k = dt / pad, vyska = 150 * mierka * (1 - k * k);
        dot = [bodka.x, bodka.y - vyska, 9 * mierka * Math.min(1, dt / 0.12), vyska];
      } else if (!bodka.dopad) { bodka.dopad = true; vlna(bodka.x, bodka.y, 1.35); if (bodka.el) { bodka.el.classList.add('uv-dopad'); setTimeout(function () { bodka.el.classList.remove('uv-dopad'); }, 700); } }
    }
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uCell, cell); gl.uniform1f(u.uTime, t);
    gl.uniform1f(u.uSpeed, cell * 3.0); gl.uniform1f(u.uKlud, klud); gl.uniform4fv(u.uRip, rip);
    gl.uniform3f(u.uHover, hover.x, hover.y, hover.s); gl.uniform4f(u.uDot, dot[0], dot[1], dot[2], dot[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (aktivne(t)) snimka = requestAnimationFrame(kresli);
    else { gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform1f(u.uKlud, klud); gl.uniform4fv(u.uRip, new Float32Array(16).fill(-99)); gl.uniform3f(u.uHover, -1e4, -1e4, 0); gl.uniform4f(u.uDot, 0, 0, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  }
  function spusti() { if (!snimka && pripravene && !koniec) snimka = requestAnimationFrame(kresli); }

  function start() {
    try { if (!priprav()) return; } catch (e) { return; }
    pripravene = true;
    t0 = performance.now();
    rozmer();
    platno.setAttribute('data-uv-dlazdice-ready', '');
    var cta = hero.querySelector('.hero-text .cta');
    // bodka dopadne na hlavné tlačidlo chvíľu po načítaní
    setTimeout(function () {
      if (!cta) return;
      var b = bod(cta);
      bodka = { x: b.x, y: b.y, t: cas(), el: cta };
      spusti();
    }, 900);
    // prst alebo klik v hero: vlna z miesta dotyku
    hero.addEventListener('pointerdown', function (e) {
      var r = platno.getBoundingClientRect();
      vlna((e.clientX - r.left) * mierka, (e.clientY - r.top) * mierka, e.pointerType === 'mouse' ? 0.7 : 0.9);
    }, { passive: true });
    // PC: myš jemne nadvihne dlaždice
    hero.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = platno.getBoundingClientRect();
      hover.x = (e.clientX - r.left) * mierka; hover.y = (e.clientY - r.top) * mierka; hover.ciel = 1; spusti();
    }, { passive: true });
    hero.addEventListener('pointerleave', function () { hover.ciel = 0; spusti(); }, { passive: true });
    // pokojná vlna z tlačidla, keď je hero vidieť a nič sa nedeje (nie častejšie ako raz za 11 s)
    dalsia = setInterval(function () {
      if (!vidno || document.hidden || !cta || aktivne(cas())) return;
      var b = bod(cta); vlna(b.x, b.y, 0.55);
    }, 11000);
    if (window.ResizeObserver) new ResizeObserver(function () { rozmer(); spusti(); }).observe(platno);
    if (window.IntersectionObserver) new IntersectionObserver(function (z) { vidno = z[0].isIntersecting; if (vidno) spusti(); }).observe(platno);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) spusti(); });
    platno.addEventListener('webglcontextlost', function (e) { e.preventDefault(); koniec = true; clearInterval(dalsia); platno.removeAttribute('data-uv-dlazdice-ready'); });
    if (pohyb && pohyb.addEventListener) pohyb.addEventListener('change', function () { if (pohyb.matches) { koniec = true; clearInterval(dalsia); gl.clear(gl.COLOR_BUFFER_BIT); } });
    spusti();
  }
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start, { once: true });
})();
