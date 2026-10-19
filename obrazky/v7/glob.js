// Pozadie úvodu v7: glóbus skutočných návštev z ARLing Live (glob.json: body pevniny Natural Earth, sila krajiny za 30 dní,
// oblúky do Bratislavy), kreslený priamo cez WebGL bez knižnice. Vzhľad je ten istý ako /live/ (live.js, three.js), ale celé je
// to 12 kB kódu a 15 kB dát (spolu asi 10 kB po kompresii) namiesto 690 kB three.js alebo videa (slučka 60 s by mala 1,9 MB
// pri 960 px, ops/design/v7/POZADIE-STAV.md).
// Jedno kreslenie bodov, najviac 30 snímok za sekundu, nič mimo obrazu a v skrytej karte, pri obmedzenom pohybe jedna snímka.
// Plátno nie je kandidát LCP. Pri chybe WebGL sa nič neukáže (pozadie ostane plná noc).
const TAN = 0.26795; // tan(15°): zorné pole 30° ako v live.js
const KAMERA = 4.25;
const SKLON = 0.5;
const OTACKA = 0.075; // rad/s, jedna otáčka za asi 84 s (live.js)
const PERIODA = 7.5; // s, impulz po oblúku
const FARBY = { zem: [0.3, 0.266, 0.24], med: [0.86, 0.44, 0.27], vrch: [0.95, 0.7, 0.54], mesto: [0.9, 0.84, 0.77], okraj: [0.26, 0.205, 0.17] };

function naVektor(lat, lon) {
  const phi = ((90 - lat) * Math.PI) / 180, th = ((lon + 180) * Math.PI) / 180;
  return [-Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)];
}
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };

// Projekcia a zakrytie guľou sú v shaderoch: kamera na osi z, bod za guľou (lúč z kamery pretne guľu skôr) sa nekreslí.
const PROJ = `uniform mat3 u_r; uniform float u_m;
vec4 proj(vec3 p){ float d = ${KAMERA.toFixed(2)} - p.z; return vec4(p.xy / (d * ${TAN}) * u_m, 0.0, 1.0); }
float pred(vec3 p){ vec3 c = vec3(0.0, 0.0, ${KAMERA.toFixed(2)}); vec3 u = p - c; float l = length(u); u /= l;
  float b = dot(c, u); float q = b * b - (dot(c, c) - 1.0); float t = -b - sqrt(max(q, 0.0));
  return (q > 0.0 && t > 0.0 && t < l - 0.003) ? 0.0 : 1.0; }`;
const VS_BODY = `attribute vec3 a_p; attribute float a_s; uniform float u_vel; varying float v_s; varying float v_a; ${PROJ}
void main(){ vec3 p = u_r * a_p; float f = dot(p, normalize(vec3(0.0, 0.0, ${KAMERA.toFixed(2)}) - p));
  v_s = a_s; v_a = smoothstep(0.0, 0.3, f); gl_Position = f > 0.0 ? proj(p) : vec4(3.0, 3.0, 0.0, 1.0);
  gl_PointSize = u_vel * (0.6 + 0.4 * sqrt(max(f, 0.0))) / (${KAMERA.toFixed(2)} - p.z); }`;
const FS_BODY = `precision mediump float; uniform vec3 u_zem; uniform vec3 u_med; uniform vec3 u_vrch; varying float v_s; varying float v_a;
void main(){ vec2 c = gl_PointCoord * 2.0 - 1.0; float a = (1.0 - smoothstep(0.5, 1.0, dot(c, c))) * v_a; if (a <= 0.0) discard;
  vec3 k = v_s > 0.0 ? mix(u_zem, u_med, 0.25 + 0.75 * pow(v_s, 1.2)) : u_zem; if (v_s > 0.6) k = mix(k, u_vrch, (v_s - 0.6) / 0.4 * 0.7);
  gl_FragColor = vec4(k * a, a); }`;
const VS_OBLUK = `attribute vec3 a_p; attribute vec3 a_x; uniform float u_vel; varying vec3 v_x; varying float v_a; ${PROJ}
void main(){ vec3 p = u_r * a_p; v_x = a_x; v_a = pred(p); gl_Position = proj(p); gl_PointSize = u_vel / (${KAMERA.toFixed(2)} - p.z); }`;
const FS_OBLUK = `precision mediump float; uniform vec3 u_med; uniform float u_cas; uniform float u_pohyb; varying vec3 v_x; varying float v_a;
void main(){ vec2 c = gl_PointCoord * 2.0 - 1.0; float d = 1.0 - smoothstep(0.35, 1.0, dot(c, c));
  float x = fract(v_x.x - u_cas - v_x.y); float vlna = smoothstep(0.0, 0.1, x) * (1.0 - smoothstep(0.1, 0.22, x)) * u_pohyb;
  float a = ((0.2 + 0.25 * v_x.z) * smoothstep(0.0, 0.05, v_x.x) + vlna * 0.7) * v_a * d; if (a <= 0.003) discard; gl_FragColor = vec4(u_med * a, a); }`;
const VS_OKRAJ = `attribute vec2 a_q; varying vec2 v_q; void main(){ v_q = a_q; gl_Position = vec4(a_q, 0.0, 1.0); }`;
const FS_OKRAJ = `precision mediump float; uniform vec3 u_okraj; uniform float u_rs; varying vec2 v_q;
void main(){ float r = length(v_q) / u_rs; if (r > 1.0) discard; float f = pow(1.0 - sqrt(max(0.0, 1.0 - r * r)), 3.0);
  float a = clamp(f, 0.0, 1.0) * (1.0 - smoothstep(0.994, 1.0, r)); gl_FragColor = vec4(u_okraj * a, a); }`;
const VS_DOMOV = `attribute vec3 a_p; uniform float u_vel; varying float v_a; ${PROJ}
void main(){ vec3 p = u_r * a_p; float f = dot(p, normalize(vec3(0.0, 0.0, ${KAMERA.toFixed(2)}) - p)); v_a = smoothstep(0.0, 0.3, f);
  gl_Position = f > 0.0 ? proj(p) : vec4(3.0, 3.0, 0.0, 1.0); gl_PointSize = u_vel / (${KAMERA.toFixed(2)} - p.z); }`;
const FS_DOMOV = `precision mediump float; uniform vec3 u_mesto; uniform vec3 u_med; varying float v_a;
void main(){ float r = length(gl_PointCoord * 2.0 - 1.0); float b = 1.0 - smoothstep(0.26, 0.36, r);
  float k = smoothstep(0.62, 0.7, r) * (1.0 - smoothstep(0.84, 0.92, r)); float a = max(b, k) * v_a; if (a <= 0.0) discard;
  gl_FragColor = vec4(mix(u_med, u_mesto, b) * a, a); }`;

function program(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [typ, zdroj] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(typ); gl.shaderSource(s, zdroj); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const mapa = new Map();
  const u = (n) => { if (!mapa.has(n)) mapa.set(n, gl.getUniformLocation(p, n)); return mapa.get(n); };
  return { p, u, a: (n) => gl.getAttribLocation(p, n) };
}
function buffer(gl, data) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; }
function pouzi(gl, prog) { for (let k = 0; k < 4; k++) gl.disableVertexAttribArray(k); gl.useProgram(prog.p); }
function atribut(gl, prog, meno, buf, n, krok = 0, posun = 0) {
  const a = prog.a(meno); if (a < 0) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, n, gl.FLOAT, false, krok * 4, posun * 4);
}

/** Spustí glóbus v elemente `kde` (prázdny kontajner s rozmermi z CSS). hotovo() sa zavolá po prvej nakreslenej snímke. */
export async function spusti(kde, { data, pokoj = false, hotovo = () => {} }) {
  const odpoved = await fetch(data);
  if (!odpoved.ok) return;
  const g = await odpoved.json();
  const platno = document.createElement('canvas');
  const gl = platno.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return;

  // Body pevniny: smer (x, y, z) a sila krajiny, rovnaké riadky ako /live/pevnina.json.
  const body = new Float32Array(g.bodiek * 4);
  let i = 0;
  for (const [lat, n, posun, behy] of g.riadky) {
    for (let b = 0; b < behy.length; b += 3) {
      for (let j = behy[b]; j < behy[b] + behy[b + 1]; j++) {
        const v = naVektor(lat, -180 + ((j + posun * 0.5) * 360) / n);
        body.set([v[0] * 1.001, v[1] * 1.001, v[2] * 1.001, g.sila[behy[b + 2]] || 0], i * 4); i++;
      }
    }
  }
  const pocetBodiek = i;
  // Oblúky do Bratislavy: nízke krivky (Bézier ako v live.js), na vrchol (x, y, z) a (t, fáza, sila).
  const domov = naVektor(g.domov[0], g.domov[1]);
  const oblukove = [];
  g.obluky.forEach(([lat, lon, s], n) => {
    const a = naVektor(lat, lon), z = domov;
    const uhol = Math.acos(Math.max(-1, Math.min(1, a[0] * z[0] + a[1] * z[1] + a[2] * z[2])));
    const vyska = Math.min(1.25, 1.02 + uhol * 0.09);
    const lerp = (t) => norm([a[0] + (z[0] - a[0]) * t, a[1] + (z[1] - a[1]) * t, a[2] + (z[2] - a[2]) * t]).map((x) => x * vyska);
    const c1 = lerp(0.25), c2 = lerp(0.75), k = Math.max(24, Math.round((uhol * 1.08) / 0.0034)); // bodka vedľa bodky
    for (let q = 0; q <= k; q++) {
      const t = q / k, u = 1 - t;
      const p = [0, 1, 2].map((x) => u * u * u * a[x] + 3 * u * u * t * c1[x] + 3 * u * t * t * c2[x] + t * t * t * z[x]);
      oblukove.push(p[0], p[1], p[2], t, (n * 0.137) % 1, s);
    }
  });
  const pBody = program(gl, VS_BODY, FS_BODY), pObluk = program(gl, VS_OBLUK, FS_OBLUK), pOkraj = program(gl, VS_OKRAJ, FS_OKRAJ), pDomov = program(gl, VS_DOMOV, FS_DOMOV);
  const bBody = buffer(gl, body), bObluk = buffer(gl, new Float32Array(oblukove));
  const bOkraj = buffer(gl, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])), bDomov = buffer(gl, new Float32Array(domov.map((x) => x * 1.003)));
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  let px = 1;
  const velkost = () => {
    const r = kde.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    px = Math.max(1, Math.min(1800, Math.round(r.width * dpr)));
    if (platno.width !== px) { platno.width = px; platno.height = px; gl.viewport(0, 0, px, px); }
  };
  const M = 1; // mierka projekcie: silueta gule zaberá asi 90 % plátna
  const rs = (1 / Math.sqrt(KAMERA * KAMERA - 1) / TAN) * M; // polomer siluety v súradniciach plátna
  const yaw0 = -Math.PI / 2 - (g.domov[1] * Math.PI) / 180;
  const kresli = (t) => {
    const yaw = yaw0 + (pokoj ? 0 : t * OTACKA), cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(SKLON), sp = Math.sin(SKLON);
    const r = new Float32Array([cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy]); // Rx(sklon) * Ry(yaw), po stĺpcoch
    gl.clear(gl.COLOR_BUFFER_BIT);
    pouzi(gl, pOkraj); gl.uniform3fv(pOkraj.u('u_okraj'), FARBY.okraj); gl.uniform1f(pOkraj.u('u_rs'), rs);
    atribut(gl, pOkraj, 'a_q', bOkraj, 2); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const krok = ((0.68 * g.krok * Math.PI) / 180 / TAN) * (px / 2) * M;
    pouzi(gl, pBody); gl.uniformMatrix3fv(pBody.u('u_r'), false, r); gl.uniform1f(pBody.u('u_m'), M); gl.uniform1f(pBody.u('u_vel'), krok);
    gl.uniform3fv(pBody.u('u_zem'), FARBY.zem); gl.uniform3fv(pBody.u('u_med'), FARBY.med); gl.uniform3fv(pBody.u('u_vrch'), FARBY.vrch);
    atribut(gl, pBody, 'a_p', bBody, 3, 4, 0); atribut(gl, pBody, 'a_s', bBody, 1, 4, 3); gl.drawArrays(gl.POINTS, 0, pocetBodiek);
    pouzi(gl, pObluk); gl.uniformMatrix3fv(pObluk.u('u_r'), false, r); gl.uniform1f(pObluk.u('u_m'), M); gl.uniform3fv(pObluk.u('u_med'), FARBY.med);
    gl.uniform1f(pObluk.u('u_cas'), pokoj ? 0 : (t / PERIODA) % 1); gl.uniform1f(pObluk.u('u_pohyb'), pokoj ? 0 : 1);
    gl.uniform1f(pObluk.u('u_vel'), ((0.0046 / TAN) * (px / 2)) * M);
    atribut(gl, pObluk, 'a_p', bObluk, 3, 6, 0); atribut(gl, pObluk, 'a_x', bObluk, 3, 6, 3);
    gl.drawArrays(gl.POINTS, 0, oblukove.length / 6);
    pouzi(gl, pDomov); gl.uniformMatrix3fv(pDomov.u('u_r'), false, r); gl.uniform1f(pDomov.u('u_m'), M); gl.uniform1f(pDomov.u('u_vel'), krok * 3.4);
    gl.uniform3fv(pDomov.u('u_mesto'), FARBY.mesto); gl.uniform3fv(pDomov.u('u_med'), FARBY.med);
    atribut(gl, pDomov, 'a_p', bDomov, 3); gl.drawArrays(gl.POINTS, 0, 1);
  };

  velkost();
  kde.appendChild(platno);
  kresli(0);
  hotovo();
  if (pokoj) { new ResizeObserver(() => { velkost(); kresli(0); }).observe(kde); return; }

  // Otáčanie: najviac 30 snímok za sekundu, len keď je glóbus v obraze a karta viditeľná; čas stojí, keď sa nekreslí.
  let viditelny = true, beh = false, cas = 0, posledny = 0;
  const snimka = (t) => {
    beh = false;
    if (!viditelny || document.hidden) { posledny = 0; return; }
    if (posledny && t - posledny < 31) { pokracuj(); return; }
    cas += posledny ? Math.min(100, t - posledny) / 1000 : 0;
    posledny = t;
    kresli(cas);
    pokracuj();
  };
  const pokracuj = () => { if (!beh && viditelny && !document.hidden) { beh = true; requestAnimationFrame(snimka); } };
  new IntersectionObserver((z) => { viditelny = z[z.length - 1].isIntersecting; if (!viditelny) posledny = 0; pokracuj(); }).observe(kde);
  document.addEventListener('visibilitychange', () => { posledny = 0; pokracuj(); });
  new ResizeObserver(() => { velkost(); kresli(cas); }).observe(kde);
  platno.addEventListener('webglcontextlost', (e) => { e.preventDefault(); viditelny = false; platno.remove(); });
  pokracuj();
}
