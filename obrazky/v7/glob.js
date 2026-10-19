// Pozadie úvodu v7: glóbus skutočných návštev z ARLing Live (glob.json: body pevniny Natural Earth, sila krajiny za 30 dní,
// oblúky do Bratislavy), kreslený priamo cez WebGL bez knižnice. Vzhľad je ten istý ako /live/ (live.js, three.js), ale bez 690 kB
// three.js a bez videa (ops/design/v7/POZADIE-STAV.md, POZADIE-STAV-2.md).
//
// Od 19. 10. 2026 noc (Andrej: „zemegula sa pomaly nacitava“, „viac živé“, „trošku viac oranžovej“): skript úvodu hneď nakreslí
// statický náhľad glob-nahlad.avif (tá istá prvá snímka, vyrobená týmto kódom cez nahlad.mjs) do plátna .nahlad. Živé plátno .zive
// nakreslí presne tú istú snímku, prelínaním prevezme náhľad (trieda zivy), náhľad sa odstráni (bez-nahladu) a až potom sa pohyb
// plynulo rozbehne: otáčanie, impulzy po oblúkoch do Bratislavy, jemné blikanie bodov navštívených krajín a tep Bratislavy.
// Najviac 30 snímok za sekundu, nič mimo obrazu a v skrytej karte. Plátno nie je kandidát LCP. Pri chybe WebGL ostane náhľad.
const TAN = 0.26795; // tan(15°): zorné pole 30° ako v live.js
const KAMERA = 4.25;
const SKLON = 0.5;
const OTACKA = 0.075; // rad/s, jedna otáčka za asi 84 s (live.js)
const PERIODA = 5; // s, impulz po oblúku do Bratislavy
const NABEH = 1.6; // s, rozbeh pohybu po prevzatí náhľadu
const PRELINANIE = 600; // ms, zhodné s transition plátna v hrdina.css
// Viac oranžovej (Andrej 19. 10.): meď navštívených krajín bližšie ku koralu značky (#ef6a3c), vrchol a impulzy svetlá oranžová.
const FARBY = { zem: [0.3, 0.266, 0.24], med: [0.96, 0.46, 0.24], vrch: [1.0, 0.68, 0.46], mesto: [1.0, 0.9, 0.8], okraj: [0.26, 0.205, 0.17] };

function naVektor(lat, lon) {
  const phi = ((90 - lat) * Math.PI) / 180, th = ((lon + 180) * Math.PI) / 180;
  return [-Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)];
}
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };

// Projekcia a zakrytie guľou sú v shaderoch: kamera na osi z, bod za guľou (lúč z kamery pretne guľu skôr) sa nekreslí.
const K = KAMERA.toFixed(2);
const PROJ = `uniform mat3 u_r; uniform float u_m;
vec4 proj(vec3 p){ float d = ${K} - p.z; return vec4(p.xy / (d * ${TAN}) * u_m, 0.0, 1.0); }
float pred(vec3 p){ vec3 c = vec3(0.0, 0.0, ${K}); vec3 u = p - c; float l = length(u); u /= l;
  float b = dot(c, u); float q = b * b - (dot(c, c) - 1.0); float t = -b - sqrt(max(q, 0.0));
  return (q > 0.0 && t > 0.0 && t < l - 0.003) ? 0.0 : 1.0; }`;
// Body: a_s sila krajiny (0 = bez návštev), a_f fáza blikania. u_tw je sila blikania (0 v náhľade a pri obmedzenom pohybe).
const VS_BODY = `attribute vec3 a_p; attribute float a_s; attribute float a_f; uniform float u_vel; uniform float u_t; uniform float u_tw;
varying float v_s; varying float v_a; varying float v_tw; ${PROJ}
void main(){ vec3 p = u_r * a_p; float f = dot(p, normalize(vec3(0.0, 0.0, ${K}) - p));
  v_s = a_s; v_a = smoothstep(0.0, 0.3, f); gl_Position = f > 0.0 ? proj(p) : vec4(3.0, 3.0, 0.0, 1.0);
  v_tw = a_s > 0.0 ? u_tw * sin(u_t * (1.2 + 1.6 * fract(a_f * 7.13)) + a_f * 6.2832) : 0.0;
  gl_PointSize = u_vel * (0.6 + 0.4 * sqrt(max(f, 0.0))) * (1.0 + 0.12 * v_tw) / (${K} - p.z); }`;
const FS_BODY = `precision mediump float; uniform vec3 u_zem; uniform vec3 u_med; uniform vec3 u_vrch; varying float v_s; varying float v_a; varying float v_tw;
void main(){ vec2 c = gl_PointCoord * 2.0 - 1.0; float a = (1.0 - smoothstep(0.5, 1.0, dot(c, c))) * v_a; if (a <= 0.0) discard;
  vec3 k = v_s > 0.0 ? mix(u_zem, u_med, 0.42 + 0.58 * pow(v_s, 0.9)) : u_zem; if (v_s > 0.55) k = mix(k, u_vrch, (v_s - 0.55) / 0.45 * 0.75);
  k *= 1.0 + 0.4 * v_tw; gl_FragColor = vec4(k * a, a); }`;
// Oblúky ako bodkované stopy: a_x = (t od krajiny 0 po Bratislavu 1, fáza, sila). Impulz je svetlejšia oranžová hlava s chvostom.
const VS_OBLUK = `attribute vec3 a_p; attribute vec3 a_x; uniform float u_vel; varying vec3 v_x; varying float v_a; ${PROJ}
void main(){ vec3 p = u_r * a_p; v_x = a_x; v_a = pred(p); gl_Position = proj(p); gl_PointSize = u_vel / (${K} - p.z); }`;
const FS_OBLUK = `precision mediump float; uniform vec3 u_med; uniform vec3 u_vrch; uniform float u_cas; uniform float u_pohyb; varying vec3 v_x; varying float v_a;
void main(){ vec2 c = gl_PointCoord * 2.0 - 1.0; float d = 1.0 - smoothstep(0.35, 1.0, dot(c, c));
  float x = fract(v_x.x - u_cas - v_x.y); float vlna = smoothstep(0.0, 0.16, x) * (1.0 - smoothstep(0.16, 0.24, x)) * u_pohyb;
  float a = ((0.26 + 0.3 * v_x.z) * smoothstep(0.0, 0.05, v_x.x) + vlna * 0.95) * v_a * d; if (a <= 0.003) discard;
  gl_FragColor = vec4(mix(u_med, u_vrch, vlna) * a, a); }`;
const VS_OKRAJ = `attribute vec2 a_q; varying vec2 v_q; void main(){ v_q = a_q; gl_Position = vec4(a_q, 0.0, 1.0); }`;
const FS_OKRAJ = `precision mediump float; uniform vec3 u_okraj; uniform float u_rs; varying vec2 v_q;
void main(){ float r = length(v_q) / u_rs; if (r > 1.0) discard; float f = pow(1.0 - sqrt(max(0.0, 1.0 - r * r)), 3.0);
  float a = clamp(f, 0.0, 1.0) * (1.0 - smoothstep(0.994, 1.0, r)); gl_FragColor = vec4(u_okraj * a, a); }`;
// Bratislava: bod, krúžok, jemná oranžová žiara a tep (krúžok, ktorý sa rozbehne von, keď je pohyb zapnutý).
const VS_DOMOV = `attribute vec3 a_p; uniform float u_vel; varying float v_a; ${PROJ}
void main(){ vec3 p = u_r * a_p; float f = dot(p, normalize(vec3(0.0, 0.0, ${K}) - p)); v_a = smoothstep(0.0, 0.3, f);
  gl_Position = f > 0.0 ? proj(p) : vec4(3.0, 3.0, 0.0, 1.0); gl_PointSize = u_vel / (${K} - p.z); }`;
const FS_DOMOV = `precision mediump float; uniform vec3 u_mesto; uniform vec3 u_med; uniform float u_tep; uniform float u_pohyb; varying float v_a;
void main(){ float r = length(gl_PointCoord * 2.0 - 1.0); if (r > 1.0) discard;
  float b = 1.0 - smoothstep(0.1, 0.14, r); float k = smoothstep(0.22, 0.25, r) * (1.0 - smoothstep(0.3, 0.33, r));
  float z = exp(-r * r * 9.0) * 0.38; float rt = 0.3 + 0.62 * u_tep; float t = smoothstep(rt - 0.05, rt, r) * (1.0 - smoothstep(rt, rt + 0.03, r)) * (1.0 - u_tep) * 0.7 * u_pohyb;
  float a = max(max(b, k), max(z, t)) * v_a; if (a <= 0.003) discard;
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
const hladko = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/** Spustí glóbus v elemente `kde` (kontajner s rozmermi z CSS, prípadne s náhľadom v pozadí).
 *  data: URL glob.json alebo už rozbehnutý fetch (Promise<Response>); pokoj: jedna nehybná snímka;
 *  hotovo(platno): zavolá sa hneď po prvej nakreslenej snímke (v tej istej úlohe, kým je obsah plátna platný). */
export async function spusti(kde, { data, pokoj = false, hotovo = () => {}, zachovat = false }) {
  const odpoved = await (typeof data === 'string' ? fetch(data) : data);
  if (!odpoved || !odpoved.ok) return;
  const g = await odpoved.json();
  const platno = document.createElement('canvas');
  platno.className = 'zive';
  const gl = platno.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: zachovat });
  if (!gl) return;

  // Body pevniny: smer (x, y, z), sila krajiny a fáza blikania, rovnaké riadky ako /live/pevnina.json.
  const body = new Float32Array(g.bodiek * 5);
  let i = 0;
  for (const [lat, n, posun, behy] of g.riadky) {
    for (let b = 0; b < behy.length; b += 3) {
      for (let j = behy[b]; j < behy[b] + behy[b + 1]; j++) {
        const v = naVektor(lat, -180 + ((j + posun * 0.5) * 360) / n);
        const faza = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
        body.set([v[0] * 1.001, v[1] * 1.001, v[2] * 1.001, g.sila[behy[b + 2]] || 0, faza], i * 5); i++;
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
  // Stav pohybu: uhol otočenia (integrovaný, aby rozbeh nemenil polohu skokom), čas pohybu a sila pohybu 0 až 1.
  let yaw = yaw0, tPohyb = 0, zivost = 0;
  const kresli = () => {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(SKLON), sp = Math.sin(SKLON);
    const r = new Float32Array([cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy]); // Rx(sklon) * Ry(yaw), po stĺpcoch
    gl.clear(gl.COLOR_BUFFER_BIT);
    pouzi(gl, pOkraj); gl.uniform3fv(pOkraj.u('u_okraj'), FARBY.okraj); gl.uniform1f(pOkraj.u('u_rs'), rs);
    atribut(gl, pOkraj, 'a_q', bOkraj, 2); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const krok = ((0.68 * g.krok * Math.PI) / 180 / TAN) * (px / 2) * M;
    pouzi(gl, pBody); gl.uniformMatrix3fv(pBody.u('u_r'), false, r); gl.uniform1f(pBody.u('u_m'), M); gl.uniform1f(pBody.u('u_vel'), krok);
    gl.uniform1f(pBody.u('u_t'), tPohyb % 1000); gl.uniform1f(pBody.u('u_tw'), zivost);
    gl.uniform3fv(pBody.u('u_zem'), FARBY.zem); gl.uniform3fv(pBody.u('u_med'), FARBY.med); gl.uniform3fv(pBody.u('u_vrch'), FARBY.vrch);
    atribut(gl, pBody, 'a_p', bBody, 3, 5, 0); atribut(gl, pBody, 'a_s', bBody, 1, 5, 3); atribut(gl, pBody, 'a_f', bBody, 1, 5, 4);
    gl.drawArrays(gl.POINTS, 0, pocetBodiek);
    pouzi(gl, pObluk); gl.uniformMatrix3fv(pObluk.u('u_r'), false, r); gl.uniform1f(pObluk.u('u_m'), M);
    gl.uniform3fv(pObluk.u('u_med'), FARBY.med); gl.uniform3fv(pObluk.u('u_vrch'), FARBY.vrch);
    gl.uniform1f(pObluk.u('u_cas'), (tPohyb / PERIODA) % 1); gl.uniform1f(pObluk.u('u_pohyb'), zivost);
    gl.uniform1f(pObluk.u('u_vel'), ((0.0046 / TAN) * (px / 2)) * M);
    atribut(gl, pObluk, 'a_p', bObluk, 3, 6, 0); atribut(gl, pObluk, 'a_x', bObluk, 3, 6, 3);
    gl.drawArrays(gl.POINTS, 0, oblukove.length / 6);
    pouzi(gl, pDomov); gl.uniformMatrix3fv(pDomov.u('u_r'), false, r); gl.uniform1f(pDomov.u('u_m'), M); gl.uniform1f(pDomov.u('u_vel'), krok * 7.5);
    gl.uniform3fv(pDomov.u('u_mesto'), FARBY.mesto); gl.uniform3fv(pDomov.u('u_med'), FARBY.med);
    gl.uniform1f(pDomov.u('u_tep'), ((tPohyb / (PERIODA / 2)) % 1)); gl.uniform1f(pDomov.u('u_pohyb'), zivost);
    atribut(gl, pDomov, 'a_p', bDomov, 3); gl.drawArrays(gl.POINTS, 0, 1);
  };

  velkost();
  kde.appendChild(platno);
  kresli();
  if (performance.mark) performance.mark('glob-zive');
  hotovo(platno);
  if (pokoj) { new ResizeObserver(() => { velkost(); kresli(); }).observe(kde); return; }

  // Prevzatie náhľadu: plátno má tú istú snímku, prelínanie (CSS) a potom odstránenie náhľadu; až potom sa pohyb rozbehne.
  let prevzate = false, startPohybu = 0;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    kde.classList.add('zivy');
    setTimeout(() => {
      kde.classList.add('bez-nahladu');
      const n = kde.querySelector('canvas.nahlad'); if (n) n.remove(); // uvoľní pamäť náhľadu (1200 x 1200 px)
      if (performance.mark) performance.mark('glob-prevzate');
      prevzate = true; startPohybu = performance.now(); pokracuj();
    }, PRELINANIE + 50);
  }));

  // Pohyb: najviac 30 snímok za sekundu, len keď je glóbus v obraze a karta viditeľná; čas stojí, keď sa nekreslí.
  let viditelny = true, beh = false, posledny = 0;
  const snimka = (t) => {
    beh = false;
    if (!viditelny || document.hidden) { posledny = 0; return; }
    if (posledny && t - posledny < 31) { pokracuj(); return; }
    const dt = posledny ? Math.min(100, t - posledny) / 1000 : 0;
    posledny = t;
    zivost = hladko((performance.now() - startPohybu) / 1000 / NABEH);
    yaw += OTACKA * zivost * dt;
    tPohyb += dt;
    kresli();
    pokracuj();
  };
  const pokracuj = () => { if (prevzate && !beh && viditelny && !document.hidden) { beh = true; requestAnimationFrame(snimka); } };
  new IntersectionObserver((z) => { viditelny = z[z.length - 1].isIntersecting; if (!viditelny) posledny = 0; pokracuj(); }).observe(kde);
  document.addEventListener('visibilitychange', () => { posledny = 0; pokracuj(); });
  new ResizeObserver(() => { velkost(); kresli(); }).observe(kde);
  platno.addEventListener('webglcontextlost', (e) => { e.preventDefault(); viditelny = false; kde.classList.remove('zivy', 'bez-nahladu'); platno.remove(); });
}
