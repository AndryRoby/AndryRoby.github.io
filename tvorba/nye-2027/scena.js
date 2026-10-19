// Scéna pozvánky na Silvester 2027 (ARLing, 19. 10. 2026): three.js, čierna a zlatá. Každá snímka je čistá funkcia času t
// (vykresli(t)), takže živý náhľad v editore, nahrávanie v prehliadači aj náš render snímok kreslia to isté.
// Vrstvy: pozadie s odleskami výbuchov, bokeh, ohňostroj (častice so stopami počítané v shaderi), bublinky šampanského,
// tmavý závoj za textom, bloom, potom text v plnom rozlíšení (zlatý reliéf zo shaderu, odhalenie zaostrením).
import * as THREE from './vendor/three.module.min.js';
import { DLZKA, T, ODHAL, OHNOSTROJE, RAKETA, FARBY_OHNA } from './casovanie.js';
import { kompozicia, cistiText, velke, POLIA, HAK, ROK, FORMATY } from './rozlozenie.js';

export { DLZKA, FORMATY, POLIA };
const FOV = 30;
const RODINY = { display: 'NYE Display', italic: 'NYE Italic', sans: 'NYE Sans' };

/** Písma: DM Serif Display (OFL, pisma/), ARLing Serif Italic a ARLing Sans (OFL, /fonts/ na arling.sk). */
export async function nacitajPisma() {
  if (nacitajPisma.hotovo) return;
  const u = (p) => new URL(p, import.meta.url).href;
  const f = [
    new FontFace(RODINY.display, `url("${u('./pisma/DMSerifDisplay-Regular.ttf')}")`, { weight: '400' }),
    new FontFace(RODINY.italic, `url("${u('../../fonts/arling-serif-italic.woff2')}")`, { weight: '400', style: 'italic' }),
    new FontFace(RODINY.sans, `url("${u('../../fonts/arling-sans.woff2')}")`, { weight: '400 700' }),
  ];
  await Promise.all(f.map((x) => x.load()));
  for (const x of f) document.fonts.add(x);
  nacitajPisma.hotovo = true;
}

const pismoCss = (pismo, px) => (pismo === 'display' ? `400 ${px}px "${RODINY.display}"` : pismo === 'italic' ? `italic 400 ${px}px "${RODINY.italic}"` : `500 ${px}px "${RODINY.sans}"`);

/** Znaky, ktoré majú všetky tri písma (rovnaký zoznam ako ops/video/pozvanka/metriky.json, overené fontTools). */
export const ZNAKY = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~' +
  '¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ' +
  'ĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁłŃńŅņŇňŉŊŋŌōŎŏŐőŒœŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŦŧŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽžſ' +
  '‐‑‒–—―‖‗‘’‚‛“”„‟†‡•‣․‥…‧‰‱′″‴‵‶‷‸‹›€№™';

// ---------------------------------------------------------------------------------------------
// Pomôcky

const zmes = (a, b, x) => a + (b - a) * x;
const obmedz = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const plyn = (a, b, t) => { const x = obmedz((t - a) / (b - a)); return x * x * (3 - 2 * x); };
const plyn5 = (a, b, t) => { const x = obmedz((t - a) / (b - a)); return x * x * x * (x * (x * 6 - 15) + 10); };
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function rngZ(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const farba = (h) => new THREE.Color(h);

/** Meranie šírky v prehliadači (rovnaký význam ako meraj v testoch): sans po znakoch, lebo sa tak aj kreslí s rozostupom. */
function vytvorMeranie() {
  const c = document.createElement('canvas').getContext('2d');
  const pamat = new Map();
  return (pismo, text, px) => {
    c.font = pismoCss(pismo, 100);
    let w;
    if (pismo === 'sans') {
      w = 0;
      for (const ch of text) {
        const k = 's' + ch;
        if (!pamat.has(k)) pamat.set(k, c.measureText(ch).width);
        w += pamat.get(k);
      }
    } else {
      const k = pismo + text;
      if (!pamat.has(k)) pamat.set(k, c.measureText(text).width);
      w = pamat.get(k);
    }
    return (w * px) / 100;
  };
}

// ---------------------------------------------------------------------------------------------
// Shadery

const VS_QUAD = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FS_POZADIE = /* glsl */`
uniform vec2 uRozm; uniform float uCas;
uniform vec4 uZablesk[9]; // x, y (obrazovka -1..1), sila, polomer
varying vec2 vUv;
float h21(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float asp = uRozm.x / uRozm.y;
  vec2 q = vec2(p.x * asp, p.y);
  // teplé tmavé svetlo hore v strede, čierne okraje
  float r = length(q - vec2(0.0, 0.42));
  vec3 c = mix(vec3(0.075, 0.056, 0.030), vec3(0.006, 0.005, 0.005), smoothstep(0.0, 1.55, r));
  c += vec3(0.030, 0.020, 0.008) * exp(-pow(length(q - vec2(0.0, -0.95)) / 0.9, 2.0));
  for (int i = 0; i < 9; i++) {
    vec4 z = uZablesk[i];
    if (z.z <= 0.0) continue;
    vec2 d = vec2((p.x - z.x) * asp, p.y - z.y);
    c += vec3(0.42, 0.28, 0.11) * z.z * exp(-dot(d, d) / (z.w * z.w));
  }
  gl_FragColor = vec4(c, 1.0);
}`;

const VS_BOKEH = /* glsl */`
attribute vec4 aZaklad; // x, y (obrazovka), z, veľkosť px
attribute vec4 aPohyb;  // vx, vy (obrazovka za s), seed, jas
uniform float uCas; uniform float uFokal; uniform float uD; uniform vec2 uPol; uniform float uPx; uniform float uMaxBod;
uniform vec4 uTextObd; uniform float uTextStlm;
varying float vJas; varying float vSeed;
void main(){
  float z = aZaklad.z;
  float k = (uD - z) / uD;
  vec2 s = aZaklad.xy + aPohyb.xy * uCas + 0.012 * vec2(sin(uCas * 0.7 + aPohyb.z * 6.3), cos(uCas * 0.5 + aPohyb.z * 4.1));
  vec4 mv = modelViewMatrix * vec4(s.x * uPol.x * k, s.y * uPol.y * k, z, 1.0);
  gl_Position = projectionMatrix * mv;
  float hl = -mv.z;
  float rozost = abs(hl - uD) / uD;
  gl_PointSize = min(uMaxBod, aZaklad.w * k * uFokal / hl * (1.0 + 1.6 * rozost) * uPx);
  vJas = aPohyb.w * (0.75 + 0.25 * sin(uCas * 1.3 + aPohyb.z * 17.0)) / (1.0 + 2.0 * rozost);
  vec2 ndc = gl_Position.xy / gl_Position.w;
  vec2 dd = max(uTextObd.xy - ndc, ndc - uTextObd.zw);
  vJas *= 1.0 - uTextStlm * (1.0 - smoothstep(0.0, 0.08, max(dd.x, dd.y)));
  vSeed = aPohyb.z;
}`;
const FS_BOKEH = /* glsl */`
varying float vJas; varying float vSeed;
void main(){
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float disk = smoothstep(1.0, 0.8, r);
  float lem = smoothstep(0.7, 0.95, r) * disk;
  float a = (disk * 0.7 + lem * 0.3) * vJas;
  vec3 c = mix(vec3(1.0, 0.72, 0.32), vec3(1.0, 0.88, 0.62), fract(vSeed * 7.31));
  gl_FragColor = vec4(c * a, a);
}`;

const VS_BUBLINY = /* glsl */`
attribute vec4 aZaklad; // x, y0 (obrazovka), z, veľkosť px
attribute vec4 aPohyb;  // rýchlosť (obrazovka za s), frekvencia, seed, jas
uniform float uCas; uniform float uFokal; uniform float uD; uniform vec2 uPol; uniform float uPx;
uniform vec4 uTextObd; uniform float uTextStlm;
varying float vJas; varying float vSeed;
void main(){
  float z = aZaklad.z, k = (uD - z) / uD;
  float y = mod(aZaklad.y + 1.25 + aPohyb.x * uCas, 2.5) - 1.25;
  float x = aZaklad.x + 0.012 * sin(uCas * aPohyb.y + aPohyb.z * 6.28) + 0.004 * sin(uCas * 3.1 + aPohyb.z * 40.0);
  vec4 mv = modelViewMatrix * vec4(x * uPol.x * k, y * uPol.y * k, z, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aZaklad.w * k * uFokal / -mv.z * uPx;
  vJas = aPohyb.w * smoothstep(-1.25, -0.9, y) * (1.0 - smoothstep(0.95, 1.2, y));
  vec2 ndc = gl_Position.xy / gl_Position.w;
  vec2 dd = max(uTextObd.xy - ndc, ndc - uTextObd.zw);
  vJas *= 1.0 - uTextStlm * (1.0 - smoothstep(0.0, 0.08, max(dd.x, dd.y)));
  vSeed = aPohyb.z;
}`;
const FS_BUBLINY = /* glsl */`
varying float vJas; varying float vSeed;
void main(){
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float lem = smoothstep(0.55, 0.82, r) * smoothstep(1.0, 0.86, r);
  float vnutro = 0.10 * smoothstep(0.9, 0.0, r);
  float lesk = smoothstep(0.32, 0.0, length(p - vec2(-0.34, 0.36)));
  float a = clamp(lem * 0.8 + vnutro + lesk * 0.9, 0.0, 1.0) * vJas;
  vec3 c = mix(vec3(0.98, 0.86, 0.58), vec3(1.0, 0.97, 0.88), lesk);
  gl_FragColor = vec4(c * a, a);
}`;

// Ohňostroj: každý vrchol je jedna vzorka stopy jednej iskry (alebo rakety); poloha sa počíta z času v shaderi.
const VS_OHEN = /* glsl */`
attribute vec3 aSmer; attribute vec4 aData; // rýchlosť, index výbuchu, stopa 0 až 1 (0 = hlava), seed
attribute float aRaketa;
uniform float uCas; uniform float uFokal; uniform float uPx;
uniform vec4 uPoz[9];  // stred x, y, z (svet), čas výbuchu
uniform vec4 uPar[9];  // polomer (svet), život, typ (0 chryzantéma, 1 vŕba, 2 prsteň), jas
uniform vec3 uHlava[9]; uniform vec3 uChvost[9]; uniform vec2 uStart[9]; // štart rakety x, y (svet)
uniform float uRaketa;
varying vec3 vFarba; varying float vJas;
float h11(float n){ return fract(sin(n * 91.345) * 47453.5453); }
void main(){
  int i = int(aData.y + 0.5);
  vec4 P = uPoz[i]; vec4 Q = uPar[i];
  float typ = Q.z;
  vec3 poz; float jas = 0.0; float vel = 0.0; vec3 f = uHlava[i];
  if (aRaketa > 0.5) {
    float t = uCas - aData.z * 0.32;
    float u = (t - (P.w - uRaketa)) / uRaketa;
    if (u >= 0.0 && u <= 1.0 && uCas < P.w) {
      float e = 1.0 - pow(1.0 - u, 3.0);
      poz = vec3(mix(uStart[i], P.xy, e), P.z);
      poz.x += sin(u * 18.0 + aData.w * 6.0) * 4.0 * (1.0 - u);
      jas = (1.0 - aData.z) * (0.55 + 0.45 * h11(aData.w + floor(uCas * 30.0)));
      vel = mix(7.0, 2.5, aData.z);
      f = mix(vec3(1.0, 0.93, 0.75), vec3(1.0, 0.6, 0.22), aData.z);
    }
  } else {
    float zivot = Q.y;
    float stopa = typ > 0.5 && typ < 1.5 ? 0.5 : 0.17;
    float tau = uCas - P.w - aData.z * stopa;
    if (tau > 0.0 && tau < zivot) {
      float k = typ > 0.5 && typ < 1.5 ? 2.4 : 3.2;
      float rozlet = (1.0 - exp(-k * tau)) / (1.0 - exp(-k * 1.1));
      float g = typ > 0.5 && typ < 1.5 ? 0.62 : 0.28;
      float pad = Q.x * g * (tau - (1.0 - exp(-k * tau)) / k) * k / 2.2;
      poz = P.xyz + aSmer * Q.x * aData.x * rozlet;
      poz.y -= pad;
      float x = tau / zivot;
      jas = Q.w * (1.0 - smoothstep(0.55, 1.0, x)) * pow(1.0 - aData.z, 1.6) * (aData.z < 0.01 ? 1.25 : 0.85);
      jas *= smoothstep(0.0, 0.05, tau);
      if (x > 0.45) jas *= 0.45 + 0.55 * step(0.42, h11(aData.w * 13.0 + floor(uCas * 26.0)));
      vel = mix(8.5, 3.2, aData.z) * (1.0 - 0.35 * x);
      f = mix(uHlava[i], uChvost[i], clamp(aData.z * 0.9 + x * 0.6, 0.0, 1.0));
    }
  }
  if (jas <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vJas = 0.0; vFarba = f; return; }
  vec4 mv = modelViewMatrix * vec4(poz, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.5, vel * uFokal / -mv.z * uPx);
  vJas = jas; vFarba = f;
}`;
const FS_OHEN = /* glsl */`
varying vec3 vFarba; varying float vJas;
void main(){
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  float jadro = exp(-r2 * 7.0), ziara = exp(-r2 * 2.2) * 0.35;
  vec3 c = vFarba * (jadro + ziara) * vJas * 1.6 + vec3(1.0, 0.95, 0.85) * exp(-r2 * 22.0) * vJas * 0.6;
  gl_FragColor = vec4(c, 0.0);
}`;

const VS_ROVINA = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FS_ZAVOJ = /* glsl */`
uniform vec2 uVel; uniform float uAlfa; varying vec2 vUv;
void main(){
  vec2 p = (vUv - 0.5) * uVel;
  vec2 pol = uVel * 0.5 - vec2(360.0);
  vec2 d = max(abs(p) - pol, 0.0);
  float a = exp(-dot(d, d) / (2.0 * 110.0 * 110.0));
  gl_FragColor = vec4(0.0, 0.0, 0.0, a * uAlfa);
}`;

// Text: maska z plátna (biely text), mipmapy dávajú rozostrenie aj výšku reliéfu.
const FS_TEXT = /* glsl */`
uniform sampler2D uMapa; uniform vec2 uTex;
uniform float uOdhal; uniform float uRozmaz; uniform float uLesk; uniform float uTyp; uniform float uAlfa; uniform float uSvetlo; uniform float uZiara;
uniform sampler2D uVyska; uniform vec2 uVyskaTex; uniform float uSilaReliefu;
varying vec2 vUv;
float m(vec2 uv, float l){ return textureLod(uMapa, uv, l).a; }
void main(){
  vec2 dx = dFdx(vUv * uTex), dy = dFdy(vUv * uTex);
  float l0 = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
  float l = l0 + uRozmaz;
  float a = m(vUv, l);
  float okraj = 1.0 - smoothstep(uOdhal * 1.35 - 0.25, uOdhal * 1.35, vUv.x);
  vec3 c;
  if (uTyp < 1.5) {
    // zlatý reliéf: výška z rozmazanej masky, normála z rozdielov, štúdiové svetlo a pás odrazu
    vec2 o = 1.0 / uVyskaTex;
    float hl = texture2D(uVyska, vUv - vec2(o.x, 0.0)).r, hr = texture2D(uVyska, vUv + vec2(o.x, 0.0)).r;
    float hd = texture2D(uVyska, vUv - vec2(0.0, o.y)).r, hu = texture2D(uVyska, vUv + vec2(0.0, o.y)).r;
    vec3 N = normalize(vec3((hl - hr) * uSilaReliefu, (hd - hu) * uSilaReliefu, 1.0));
    vec3 Ls = normalize(vec3(cos(uSvetlo) * 0.65, 0.45 + sin(uSvetlo) * 0.3, 0.75));
    float dif = max(dot(N, Ls), 0.0);
    float spe = pow(max(dot(N, normalize(Ls + vec3(0.0, 0.0, 1.0))), 0.0), 42.0);
    vec3 R = reflect(vec3(0.0, 0.0, -1.0), N);
    float env = smoothstep(-0.55, 0.5, R.y * 0.9 + R.x * 0.25 + (vUv.y - 0.5) * 0.35);
    vec3 tmava = vec3(0.36, 0.22, 0.07), stred = vec3(0.86, 0.64, 0.29), svetla = vec3(1.0, 0.91, 0.66);
    c = mix(tmava, stred, smoothstep(0.0, 0.55, env));
    c = mix(c, svetla, smoothstep(0.5, 1.0, env) * 0.8);
    c *= 0.66 + 0.5 * dif;
    c += vec3(1.0, 0.95, 0.8) * spe * 0.85;
  } else if (uTyp < 2.5) {
    c = vec3(0.93, 0.86, 0.71); // šampanské, čitateľné riadky
  } else {
    c = mix(vec3(0.95, 0.80, 0.50), vec3(1.0, 0.92, 0.72), vUv.y); // svetlé zlato, kurzíva
  }
  // svetlo prechádzajúce cez zlato (šikmý pás) a horúca hrana odhalenia
  float d = vUv.x + (vUv.y - 0.5) * 0.35 * uTex.y / uTex.x;
  c += vec3(1.0, 0.93, 0.74) * exp(-pow((d - uLesk) / 0.07, 2.0)) * 0.7;
  float hrana = exp(-pow((vUv.x - (uOdhal * 1.35 - 0.12)) / 0.05, 2.0)) * step(uOdhal, 0.999);
  c += vec3(1.0, 0.85, 0.5) * hrana * 1.2;
  float alfa = a * okraj * uAlfa;
  // žiara z hrubej mipmapy, pri okrajoch roviny stlmená (malé textúry v náhľade inak dávali svetlý obdĺžnik)
  float kraj = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x) * smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
  float g = m(vUv, l0 + 4.0) * uZiara * okraj * uAlfa * kraj;
  gl_FragColor = vec4(c * alfa + vec3(0.9, 0.62, 0.25) * g * (1.0 - alfa), alfa);
}`;

// výšková mapa reliéfu: Gaussov filter 13 vzoriek (lineárne vzorkovanie), prvý prechod berie alfu masky
const FS_VYSKA = /* glsl */`
uniform sampler2D uZdroj; uniform vec2 uSmer; uniform float uZAlfy; varying vec2 vUv;
float v(vec2 uv){ vec4 c = texture2D(uZdroj, uv); return uZAlfy > 0.5 ? c.a : c.r; }
void main(){
  float s = v(vUv) * 0.19648255;
  s += (v(vUv + uSmer * 1.41176470) + v(vUv - uSmer * 1.41176470)) * 0.29690696;
  s += (v(vUv + uSmer * 3.29411764) + v(vUv - uSmer * 3.29411764)) * 0.09447039;
  s += (v(vUv + uSmer * 5.17647058) + v(vUv - uSmer * 5.17647058)) * 0.01038136;
  gl_FragColor = vec4(s, s, s, 1.0);
}`;

const FS_JAS = /* glsl */`
uniform sampler2D uZdroj; uniform vec2 uTexel; uniform float uPrah; varying vec2 vUv;
void main(){
  vec3 c = vec3(0.0);
  c += texture2D(uZdroj, vUv + uTexel * vec2(-1.0, -1.0)).rgb; c += texture2D(uZdroj, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  c += texture2D(uZdroj, vUv + uTexel * vec2(-1.0, 1.0)).rgb; c += texture2D(uZdroj, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  float j = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c * smoothstep(uPrah, uPrah + 0.45, j), 1.0);
}`;
const FS_ROZMAZ = /* glsl */`
uniform sampler2D uZdroj; uniform vec2 uSmer; varying vec2 vUv;
void main(){
  vec3 c = texture2D(uZdroj, vUv).rgb * 0.2270270270;
  c += (texture2D(uZdroj, vUv + uSmer * 1.3846153846).rgb + texture2D(uZdroj, vUv - uSmer * 1.3846153846).rgb) * 0.3162162162;
  c += (texture2D(uZdroj, vUv + uSmer * 3.2307692308).rgb + texture2D(uZdroj, vUv - uSmer * 3.2307692308).rgb) * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;
const FS_ZLOZ = /* glsl */`
uniform sampler2D uScena; uniform sampler2D uBloom1; uniform sampler2D uBloom2; uniform float uSila; uniform float uCas; uniform vec2 uRozm;
varying vec2 vUv;
float h21(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  vec3 c = texture2D(uScena, vUv).rgb + (texture2D(uBloom1, vUv).rgb * 0.9 + texture2D(uBloom2, vUv).rgb * 0.7) * uSila;
  c = aces(c * 1.05);
  vec2 p = vUv * 2.0 - 1.0;
  c *= mix(1.0, 0.72, smoothstep(0.55, 1.45, length(p * vec2(uRozm.x / uRozm.y, 1.0) * 0.85)));
  vec2 q = gl_FragCoord.xy + vec2(5.588238, 3.7) * floor(fract(uCas * 0.37) * 64.0);
  c += (fract(52.9829189 * fract(dot(q, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`;

// ---------------------------------------------------------------------------------------------

/**
 * Vytvorí scénu na plátne. moznosti: { format '9x16' | '16x9', sirka, vyska (rozlíšenie plátna v px),
 * mierkaSceny (0,5 až 1: rozlíšenie častíc a bloomu voči plátnu; text je vždy v plnom rozlíšení) }.
 */
export async function vytvorScenu(platno, moznosti = {}) {
  await nacitajPisma();
  const meraj = vytvorMeranie();
  const renderer = new THREE.WebGLRenderer({ canvas: platno, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', premultipliedAlpha: true });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(1);
  const maxPoint = renderer.getContext().getParameter(renderer.getContext().ALIASED_POINT_SIZE_RANGE)[1] || 256;

  let format = moznosti.format || '9x16';
  let F = FORMATY[format];
  let bw = moznosti.sirka || F.W, bh = moznosti.vyska || F.H;
  let mierkaSceny = moznosti.mierkaSceny || 1;
  const kamera = new THREE.PerspectiveCamera(FOV, F.W / F.H, 10, 20000);
  const D = () => F.H / 2 / Math.tan((FOV * Math.PI) / 360);

  // vrstvy
  const scenaZad = new THREE.Scene();
  const scenaPred = new THREE.Scene();
  const quad = new THREE.PlaneGeometry(2, 2);
  const kameraQuad = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uZablesk = Array.from({ length: 9 }, () => new THREE.Vector4());
  const pozadie = new THREE.Mesh(quad, new THREE.ShaderMaterial({
    vertexShader: VS_QUAD, fragmentShader: FS_POZADIE, depthTest: false, depthWrite: false,
    uniforms: { uRozm: { value: new THREE.Vector2(F.W, F.H) }, uCas: { value: 0 }, uZablesk: { value: uZablesk } },
  }));
  pozadie.frustumCulled = false; pozadie.renderOrder = -10;
  scenaZad.add(pozadie);

  const textObd = new THREE.Vector4(-1, -1, 1, 1);
  const spolocne = () => ({ uCas: { value: 0 }, uFokal: { value: 1 }, uD: { value: 1 }, uPol: { value: new THREE.Vector2(1, 1) }, uPx: { value: 1 }, uMaxBod: { value: 256 }, uTextObd: { value: textObd }, uTextStlm: { value: 0 } });
  const aditivne = { transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor };
  const premult = { transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor };

  // bokeh: ďaleko za textom a pár veľkých kruhov blízko kamery
  function bokeh(n, zOd, zDo, velOd, velDo, jas, seed) {
    const r = rngZ(seed), A = new Float32Array(n * 4), B = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      A.set([r() * 2.2 - 1.1, r() * 2.2 - 1.1, zmes(zOd, zDo, r()), zmes(velOd, velDo, r())], i * 4);
      B.set([(r() - 0.5) * 0.012, 0.004 + r() * 0.01, r(), jas * (0.35 + 0.65 * r())], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aZaklad', new THREE.BufferAttribute(A, 4));
    g.setAttribute('aPohyb', new THREE.BufferAttribute(B, 4));
    const m = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: VS_BOKEH, fragmentShader: FS_BOKEH, uniforms: spolocne(), ...aditivne }));
    m.frustumCulled = false;
    return m;
  }
  const bokehDaleko = bokeh(42, -2600, -500, 24, 64, 0.15, 11);
  bokehDaleko.renderOrder = -5; scenaZad.add(bokehDaleko);
  const bokehBlizko = bokeh(9, 1100, 2000, 70, 130, 0.07, 23);
  bokehBlizko.renderOrder = 50; scenaPred.add(bokehBlizko);

  function bubliny(n, zOd, zDo, seed, jas) {
    const r = rngZ(seed), A = new Float32Array(n * 4), B = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const x = r() < 0.7 ? (r() < 0.5 ? -1 : 1) * zmes(0.45, 1.05, r()) : r() * 1.6 - 0.8;
      A.set([x, r() * 2.5 - 1.25, zmes(zOd, zDo, r()), zmes(7, 22, r() * r())], i * 4);
      B.set([zmes(0.07, 0.2, r()), zmes(1.5, 3.5, r()), r(), jas * zmes(0.45, 1, r())], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aZaklad', new THREE.BufferAttribute(A, 4));
    g.setAttribute('aPohyb', new THREE.BufferAttribute(B, 4));
    const m = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: VS_BUBLINY, fragmentShader: FS_BUBLINY, uniforms: spolocne(), ...premult }));
    m.frustumCulled = false;
    return m;
  }
  const bublinyZa = bubliny(150, -900, -60, 5, 0.55);
  bublinyZa.renderOrder = 2; scenaZad.add(bublinyZa);
  const bublinyPred = bubliny(22, 60, 600, 9, 0.45);
  bublinyPred.renderOrder = 40; scenaPred.add(bublinyPred);

  // ohňostroj
  const ohen = (() => {
    const K = 18;
    const smery = [], data = [], raketa = [];
    OHNOSTROJE.forEach((o, i) => {
      const r = rngZ(101 + i * 7);
      const n = o.typ === 'prsten' ? 150 : o.typ === 'vrba' ? 230 : 260;
      // os prsteňa smeruje skoro ku kamere, aby nebol videný z boku ako úzka elipsa (snímka nahrávky 19. 10.)
      const os = new THREE.Vector3((r() - 0.5) * 0.7, (r() - 0.5) * 0.7, 1).normalize();
      const u1 = new THREE.Vector3().crossVectors(os, new THREE.Vector3(0, 0, 1)).normalize(), u2 = new THREE.Vector3().crossVectors(os, u1);
      for (let p = 0; p < n; p++) {
        let s;
        if (o.typ === 'prsten') { const a = (p / n) * Math.PI * 2; s = u1.clone().multiplyScalar(Math.cos(a)).addScaledVector(u2, Math.sin(a)); s.z *= 0.6; }
        else { const y = 1 - (2 * (p + 0.5)) / n, rr = Math.sqrt(1 - y * y), a = p * 2.399963; s = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr); }
        const rych = o.typ === 'prsten' ? zmes(0.95, 1.03, r()) : zmes(0.72, 1.08, r());
        const seed = r() * 100;
        for (let k = 0; k < K; k++) { smery.push(s.x, s.y, s.z); data.push(rych, i, k / (K - 1), seed); raketa.push(0); }
      }
      for (let k = 0; k < 14; k++) { smery.push(0, 1, 0); data.push(1, i, k / 13, r() * 100); raketa.push(1); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(raketa.length * 3), 3));
    g.setAttribute('aSmer', new THREE.BufferAttribute(new Float32Array(smery), 3));
    g.setAttribute('aData', new THREE.BufferAttribute(new Float32Array(data), 4));
    g.setAttribute('aRaketa', new THREE.BufferAttribute(new Float32Array(raketa), 1));
    const u = {
      ...spolocne(), uPoz: { value: OHNOSTROJE.map(() => new THREE.Vector4()) }, uPar: { value: OHNOSTROJE.map(() => new THREE.Vector4()) },
      uHlava: { value: OHNOSTROJE.map((o) => farba(FARBY_OHNA[o.farba][0])) }, uChvost: { value: OHNOSTROJE.map((o) => farba(FARBY_OHNA[o.farba][1])) },
      uStart: { value: OHNOSTROJE.map(() => new THREE.Vector2()) }, uRaketa: { value: RAKETA },
    };
    const m = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: VS_OHEN, fragmentShader: FS_OHEN, uniforms: u, ...aditivne }));
    m.frustumCulled = false; m.renderOrder = 0;
    return m;
  })();
  scenaZad.add(ohen);

  // závoj za textom (aby ohňostroj nezobral kontrast)
  const zavoj = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ vertexShader: VS_ROVINA, fragmentShader: FS_ZAVOJ, uniforms: { uVel: { value: new THREE.Vector2(1, 1) }, uAlfa: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false }));
  zavoj.renderOrder = 5; zavoj.position.z = -40; scenaZad.add(zavoj);

  // text
  const textMat = (typ) => new THREE.ShaderMaterial({
    vertexShader: VS_ROVINA, fragmentShader: FS_TEXT, ...premult,
    uniforms: { uMapa: { value: null }, uTex: { value: new THREE.Vector2(1, 1) }, uOdhal: { value: 1 }, uRozmaz: { value: 0 }, uLesk: { value: -2 }, uTyp: { value: typ }, uAlfa: { value: 1 }, uSvetlo: { value: 0.6 }, uZiara: { value: 0.18 },
      uVyska: { value: null }, uVyskaTex: { value: new THREE.Vector2(1, 1) }, uSilaReliefu: { value: 7 } },
  });
  const bloky = {}; // id -> { mesh, b (blok kompozície), w, h }
  const textury = [];
  let komp = null;

  function kresliText(b, pxKresby, mierka) {
    // plátno na blok: šírka zóny, výška riadkov, okraj na žiaru
    const pad = Math.ceil(pxKresby * 0.45);
    const lh = pxKresby * b.lh;
    const w = Math.ceil(Math.max(...b.sirkyKresby, 1) + pad * 2), h = Math.ceil(b.riadky.length * lh + pad * 2);
    const c = document.createElement('canvas');
    c.width = Math.max(4, Math.round(w * mierka)); c.height = Math.max(4, Math.round(h * mierka));
    const x = c.getContext('2d');
    x.scale(mierka, mierka);
    x.fillStyle = '#fff'; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.font = pismoCss(b.pismo, pxKresby);
    const cap = b.pismo === 'sans' ? 0.703 : b.pismo === 'display' ? 0.66 : 0.67;
    b.riadky.forEach((r, i) => {
      const yb = pad + i * lh + lh / 2 + (cap * pxKresby) / 2;
      const sw = b.sirkyKresby[i];
      let xx = (w - sw) / 2;
      if (b.ls) {
        const ls = b.ls * pxKresby;
        for (const ch of r) { x.fillText(ch, xx, yb); xx += meraj(b.pismo, ch, pxKresby) + ls; }
      } else {
        // poistka: riadok širší než zóna sa vodorovne stiahne (nič neprečnieva)
        const real = x.measureText(r).width;
        if (real > sw * 1.02) { x.save(); x.translate(xx, 0); x.scale(sw / real, 1); x.fillText(r, 0, yb); x.restore(); }
        else x.fillText(r, xx + (sw - real) / 2, yb);
      }
    });
    return { c, w, h };
  }

  function textura(c) {
    const t = new THREE.CanvasTexture(c);
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.colorSpace = THREE.NoColorSpace;
    textury.push(t);
    return t;
  }

  const matVyska = new THREE.ShaderMaterial({ vertexShader: VS_QUAD, fragmentShader: FS_VYSKA, uniforms: { uZdroj: { value: null }, uSmer: { value: new THREE.Vector2() }, uZAlfy: { value: 1 } }, depthTest: false, depthWrite: false });
  const vyskove = [];
  /**
   * Výšková mapa reliéfu: maska textu zmenšená delitel-krát (mipmapa, žiadne preskakovanie texelov), potom páry
   * vodorovného a zvislého Gaussovho prechodu s krokom do 1 texelu (sigma asi 1,95 x krok x odmocnina párov).
   * Veľký krok cez plné rozlíšenie robil schodovité kópie hrán (snímka 19. 10.), preto takto.
   */
  function vyskovaMapa(tex, w, h, delitel, parov, krok) {
    const typ = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float') ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const o = { type: typ, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    const a = new THREE.WebGLRenderTarget(Math.max(4, Math.round(w / delitel)), Math.max(4, Math.round(h / delitel)), o), b = a.clone();
    vyskove.push(a, b);
    const pass = (z, ciel, sx, sy, alfa) => { matVyska.uniforms.uZdroj.value = z; matVyska.uniforms.uSmer.value.set(sx, sy); matVyska.uniforms.uZAlfy.value = alfa; prechod(matVyska, ciel); };
    pass(tex, b, 0, 0, 1); // len zmenšenie s mipmapou
    for (let i = 0; i < parov; i++) { pass(b.texture, a, krok / a.width, 0, 0); pass(a.texture, b, 0, krok / a.height, 0); }
    renderer.setRenderTarget(null);
    return b;
  }

  function postavText(polia) {
    for (const t of textury) t.dispose();
    textury.length = 0;
    for (const r of vyskove) r.dispose();
    vyskove.length = 0;
    for (const k of Object.keys(bloky)) { scenaPred.remove(bloky[k].mesh); bloky[k].mesh.geometry.dispose(); bloky[k].mesh.material.dispose(); delete bloky[k]; }
    komp = kompozicia(polia, format, meraj);
    const mierkaTextury = obmedz((bh / F.H) * 2, 1, 2);
    for (const b of komp.bloky) {
      let mesh, w, h;
      if (b.id === 'ciara') {
        const c = document.createElement('canvas');
        const sw = b.sirky[0], vys = b.vyskaPevna;
        w = sw + 40; h = vys + 40;
        c.width = Math.round(w * mierkaTextury); c.height = Math.round(h * mierkaTextury);
        const x = c.getContext('2d'); x.scale(mierkaTextury, mierkaTextury);
        x.fillStyle = '#fff';
        const cy = h / 2, cx = w / 2, dia = vys * 0.42;
        x.fillRect(20, cy - 1, sw / 2 - dia * 1.9, 2); x.fillRect(cx + dia * 1.9, cy - 1, sw / 2 - dia * 1.9, 2);
        x.beginPath(); x.moveTo(cx, cy - dia); x.lineTo(cx + dia, cy); x.lineTo(cx, cy + dia); x.lineTo(cx - dia, cy); x.closePath(); x.fill();
        const t = textura(c);
        const mat = textMat(3); mat.uniforms.uMapa.value = t; mat.uniforms.uTex.value.set(c.width, c.height); mat.uniforms.uZiara.value = 0;
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      } else {
        // veľké polohy na začiatku (háčik a rok) kreslia text vo väčšom písme, aby bol ostrý aj zblízka
        const velky = b.id === 'hak' ? komp.velkyHak.px : b.id === 'rok' ? komp.velkyRok.px : b.px;
        const pxKresby = Math.max(b.px, velky);
        b.sirkyKresby = b.sirky.map((x) => (x * pxKresby) / b.px);
        const k = kresliText(b, pxKresby, mierkaTextury * (b.id === 'rok' || b.id === 'hak' ? 1 : 1));
        w = k.w * (b.px / pxKresby); h = k.h * (b.px / pxKresby);
        const t = textura(k.c);
        const typ = b.id === 'rok' ? 0 : b.id === 'nazov' ? 1 : b.pismo === 'sans' ? 2 : 3;
        const mat = textMat(typ); mat.uniforms.uMapa.value = t; mat.uniforms.uTex.value.set(k.c.width, k.c.height);
        mat.uniforms.uZiara.value = typ === 0 ? 0.28 : typ === 1 ? 0.14 : typ === 2 ? 0.0 : 0.12;
        if (typ <= 1) {
          // sigma v texeloch polovičnej mapy: rok širší zlatý zrazený okraj, nadpis jemný
          const vm = typ === 0 ? vyskovaMapa(t, k.c.width, k.c.height, 2 * mierkaTextury, 2, 1.0) : vyskovaMapa(t, k.c.width, k.c.height, mierkaTextury, 1, 0.8);
          mat.uniforms.uVyska.value = vm.texture; mat.uniforms.uVyskaTex.value.set(vm.width, vm.height);
          mat.uniforms.uSilaReliefu.value = typ === 0 ? 3.6 : 2.2;
        }
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        b.velky = velky / b.px;
      }
      mesh.renderOrder = 20;
      scenaPred.add(mesh);
      bloky[b.id] = { mesh, b, w, h };
    }
    // závoj podľa stĺpca textu
    const prvy = komp.bloky[0], posl = komp.bloky[komp.bloky.length - 1];
    const polSirka = Math.max(...komp.bloky.flatMap((b) => b.sirky)) / 2 + 30;
    textObd.set(-polSirka / (F.W / 2), 1 - (2 * (posl.y + posl.vyska + 30)) / F.H, polSirka / (F.W / 2), 1 - (2 * (prvy.y - 30)) / F.H);
    const vys = posl.y + posl.vyska - prvy.y;
    zavoj.scale.set(komp.sirka + 840, vys + 800, 1);
    zavoj.material.uniforms.uVel.value.set(komp.sirka + 840, vys + 800);
    zavoj.position.set(0, F.H / 2 - (prvy.y + vys / 2), -40);
    return komp;
  }

  // bloom
  let rtScena, rtA, rtB, rtC, rtD;
  const matJas = new THREE.ShaderMaterial({ vertexShader: VS_QUAD, fragmentShader: FS_JAS, uniforms: { uZdroj: { value: null }, uTexel: { value: new THREE.Vector2() }, uPrah: { value: 0.32 } }, depthTest: false, depthWrite: false });
  const matRozmaz = new THREE.ShaderMaterial({ vertexShader: VS_QUAD, fragmentShader: FS_ROZMAZ, uniforms: { uZdroj: { value: null }, uSmer: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false });
  const matZloz = new THREE.ShaderMaterial({ vertexShader: VS_QUAD, fragmentShader: FS_ZLOZ, uniforms: { uScena: { value: null }, uBloom1: { value: null }, uBloom2: { value: null }, uSila: { value: 1 }, uCas: { value: 0 }, uRozm: { value: new THREE.Vector2(1, 1) } }, depthTest: false, depthWrite: false });
  const quadMesh = new THREE.Mesh(quad, matJas); quadMesh.frustumCulled = false;
  const quadScena = new THREE.Scene(); quadScena.add(quadMesh);
  const prechod = (mat, ciel) => { quadMesh.material = mat; renderer.setRenderTarget(ciel); renderer.render(quadScena, kameraQuad); };

  function velkost(w, h, m) {
    bw = w; bh = h; mierkaSceny = m ?? mierkaSceny;
    renderer.setSize(bw, bh, false);
    for (const rt of [rtScena, rtA, rtB, rtC, rtD]) rt?.dispose();
    const sw = Math.max(64, Math.round(bw * mierkaSceny)), sh = Math.max(64, Math.round(bh * mierkaSceny));
    const typ = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float') ? THREE.HalfFloatType : THREE.UnsignedByteType;
    rtScena = new THREE.WebGLRenderTarget(sw, sh, { type: typ, depthBuffer: false });
    rtA = new THREE.WebGLRenderTarget(Math.round(sw / 4), Math.round(sh / 4), { type: typ, depthBuffer: false });
    rtB = rtA.clone();
    rtC = new THREE.WebGLRenderTarget(Math.round(sw / 8), Math.round(sh / 8), { type: typ, depthBuffer: false });
    rtD = rtC.clone();
    matZloz.uniforms.uRozm.value.set(bw, bh);
  }

  function nastavFormat(f, w, h, m) {
    format = f; F = FORMATY[f];
    kamera.aspect = F.W / F.H;
    kamera.updateProjectionMatrix();
    pozadie.material.uniforms.uRozm.value.set(F.W, F.H);
    velkost(w || F.W, h || F.H, m);
  }
  nastavFormat(format, bw, bh, mierkaSceny);

  function polohaBloku(id, t) {
    const B = bloky[id];
    if (!B) return null;
    const b = B.b;
    const yFin = F.H / 2 - (b.y + b.vyska / 2);
    let x = 0, y = yFin, s = 1, alfa = 1, odhal = 1, rozmaz = 0;
    if (id === 'hak') {
      const k = plyn5(T.hakHore[0], T.hakHore[1], t);
      const yVel = F.H / 2 - komp.velkyHak.y + 6 * (t / T.hakHore[0]);
      y = zmes(yVel, yFin, k);
      s = zmes(bloky.hak.b.velky, 1, k);
      alfa = 1;
      rozmaz = 0;
    } else if (id === 'rok') {
      const k = plyn5(T.rokHore[0], T.rokHore[1], t);
      y = zmes(F.H / 2 - komp.velkyRok.y, yFin, k);
      s = zmes(bloky.rok.b.velky, 1, k);
      odhal = plyn(T.rokZapal[0], T.rokZapal[1], t);
      rozmaz = 3.0 * (1 - plyn(T.rokZapal[0], T.rokZapal[1] + 0.35, t));
      alfa = t < T.rokZapal[0] ? 0 : 1;
    } else {
      const t0 = T[id];
      const k = plyn5(t0, t0 + ODHAL, t);
      y = yFin - 22 * (1 - k);
      alfa = plyn(t0, t0 + ODHAL * 0.7, t);
      rozmaz = 3.2 * (1 - k);
      odhal = id === 'ciara' ? 1 : plyn(t0 - 0.05, t0 + ODHAL * 0.85, t);
      if (id === 'ciara') s = 1;
    }
    return { x, y, s, alfa, odhal, rozmaz };
  }

  function vykresli(t) {
    t = obmedz(t, 0, DLZKA);
    const d = D();
    // kamera: od 7,5 % ďalej a mierne zboku do pokoja (potom je text 1 : 1 a ostrý)
    const k = plyn5(T.kamera[0], T.kamera[1], t);
    const vzd = d * (1 + 0.075 * (1 - k));
    const uhol = 0.05 * (1 - k);
    kamera.position.set(Math.sin(uhol) * vzd, 30 * (1 - k), Math.cos(uhol) * vzd);
    kamera.lookAt(0, 6 * (1 - k), 0);
    kamera.updateMatrixWorld();

    const fokal = (bh / 2) / Math.tan((FOV * Math.PI) / 360);
    const pol = new THREE.Vector2(F.W / 2, F.H / 2);
    for (const m of [bokehDaleko, bokehBlizko, bublinyZa, bublinyPred, ohen]) {
      const u = m.material.uniforms;
      u.uCas.value = t; u.uD.value = d; u.uPol.value.copy(pol);
      const vScene = m === bokehDaleko || m === bublinyZa || m === ohen;
      // fokál v px cieľa: scéna za textom má rozlíšenie rtScena, predná vrstva plné plátno
      u.uFokal.value = vScene ? (rtScena.height / 2) / Math.tan((FOV * Math.PI) / 360) : fokal;
      u.uPx.value = 1;
      if (u.uMaxBod) u.uMaxBod.value = maxPoint;
      if (u.uTextStlm) u.uTextStlm.value = m === ohen || m === bokehDaleko ? 0 : 0.92 * plyn(7.0, 7.8, t);
    }
    // ohňostroj
    const U = ohen.material.uniforms;
    OHNOSTROJE.forEach((o, i) => {
      const kz = (d - o.z) / d;
      const cx = o.x * (F.W / 2) * kz, cy = o.y * (F.H / 2) * kz;
      const R = o.r * kz * (format === '16x9' ? 0.78 : 1);
      U.uPoz.value[i].set(cx, cy, o.z, o.t);
      U.uPar.value[i].set(R, o.typ === 'vrba' ? 3.1 : o.typ === 'prsten' ? 1.6 : 1.95, o.typ === 'vrba' ? 1 : o.typ === 'prsten' ? 2 : 0, o.jas);
      U.uStart.value[i].set(cx + (hash(i + 3) - 0.5) * 120 * kz, -(F.H / 2) * kz * 1.08);
      const tau = t - o.t;
      uZablesk[i].set(o.x, o.y, tau > 0 ? o.jas * 0.55 * Math.exp(-tau / 0.42) * (o.z > -1000 ? 1 : 0.6) : 0, 0.55 * (o.r / 500));
    });
    pozadie.material.uniforms.uCas.value = t;
    zavoj.material.uniforms.uAlfa.value = 0.62 * plyn(T.rokHore[0], T.nazov + 0.6, t);

    // text
    const lesk = (() => { for (const [a, b] of T.lesk) if (t >= a && t <= b) return zmes(-0.25, 1.25, (t - a) / (b - a)); return -2; })();
    for (const id of Object.keys(bloky)) {
      const B = bloky[id], p = polohaBloku(id, t);
      B.mesh.position.set(p.x, p.y, 0);
      B.mesh.scale.set(p.s, p.s, 1);
      if (id === 'ciara') B.mesh.scale.x = Math.max(0.001, plyn5(T.ciara, T.ciara + ODHAL, t));
      const u = B.mesh.material.uniforms;
      u.uAlfa.value = p.alfa; u.uOdhal.value = p.odhal; u.uRozmaz.value = p.rozmaz;
      u.uLesk.value = id === 'rok' || id === 'nazov' || id === 'hak' ? lesk : -2;
      if (id === 'hak' && t < 1.4) u.uLesk.value = zmes(-0.25, 1.25, plyn(0.1, 1.4, t));
      if (id === 'rok' && t < T.rokZapal[1] + 0.4) u.uLesk.value = -2;
      u.uSvetlo.value = 0.5 + 0.35 * Math.sin(t * 0.45);
      B.mesh.visible = p.alfa > 0.001;
    }

    // 1. scéna za textom do rtScena, 2. bloom, 3. zloženie na plátno, 4. text a predná vrstva
    renderer.setRenderTarget(rtScena);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(scenaZad, kamera);
    matJas.uniforms.uZdroj.value = rtScena.texture; matJas.uniforms.uTexel.value.set(1 / rtScena.width, 1 / rtScena.height);
    prechod(matJas, rtA);
    const rozmaz = (z, med, ciel, w, h, r) => {
      matRozmaz.uniforms.uZdroj.value = z.texture; matRozmaz.uniforms.uSmer.value.set(r / w, 0); prechod(matRozmaz, med);
      matRozmaz.uniforms.uZdroj.value = med.texture; matRozmaz.uniforms.uSmer.value.set(0, r / h); prechod(matRozmaz, ciel);
    };
    rozmaz(rtA, rtB, rtA, rtA.width, rtA.height, 1.0);
    matRozmaz.uniforms.uZdroj.value = rtA.texture; matRozmaz.uniforms.uSmer.value.set(0, 0); prechod(matRozmaz, rtC);
    rozmaz(rtC, rtD, rtC, rtC.width, rtC.height, 1.6);
    matZloz.uniforms.uScena.value = rtScena.texture; matZloz.uniforms.uBloom1.value = rtA.texture; matZloz.uniforms.uBloom2.value = rtC.texture;
    matZloz.uniforms.uCas.value = t; matZloz.uniforms.uSila.value = 1.0;
    prechod(matZloz, null);
    renderer.autoClear = false;
    renderer.render(scenaPred, kamera);
    renderer.autoClear = true;
  }

  return {
    get format() { return format; },
    get kompozicia() { return komp; },
    renderer, maxPoint,
    /** Surové polia z formulára -> čistenie, kapitálky, rozloženie; vráti { komp, upozornenia }. */
    nastavText(surove) {
      const up = [];
      const p = {};
      for (const pole of POLIA) {
        const c = cistiText(surove[pole.id] || '', ZNAKY, pole.max);
        if (c.emoji) up.push({ pole: pole.id, typ: 'emoji' });
        if (c.mimo.length) up.push({ pole: pole.id, typ: 'mimo', znaky: c.mimo });
        p[pole.id] = ['datum', 'cas', 'miesto'].includes(pole.id) ? velke(c.text, ZNAKY) : c.text;
      }
      postavText(p);
      return { komp, upozornenia: up, polia: p };
    },
    nastavFormat(f, w, h, m) { nastavFormat(f, w, h, m); },
    velkost,
    vykresli,
    zrus() { for (const t of textury) t.dispose(); renderer.dispose(); },
  };
}
