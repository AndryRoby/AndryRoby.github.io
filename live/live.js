// ARLing Live: the globe and the 7 / 30 day switch. The numbers are already in the page (written daily by
// ops/riadenie/globus/stranka.mjs); this script only redraws them for the other period and draws the globe.
// Data: data.json (visitors, refreshed once a day), pevnina.json (land dots from Natural Earth, computed ahead of time).
// Performance: one draw call for all land dots, about 30 frames per second while the globe turns by itself, nothing at all
// while it is off screen or the tab is hidden, and no motion with prefers-reduced-motion.
import * as THREE from './three.module.min.js';
import { htmlVeta, htmlPrehlad, htmlKrajiny, htmlProdukty, htmlZdroje, hodnota, pocet, OKNA } from './vykres.js';

const $ = (id) => document.getElementById(id);
const POKOJ = matchMedia('(prefers-reduced-motion: reduce)');
const stav = { okno: 'd30', data: null, globus: null };

async function nacitaj(meno) {
  const r = await fetch(meno, { cache: 'no-cache' });
  if (!r.ok) throw new Error(meno + ': HTTP ' + r.status);
  return r.json();
}

function vykresliCisla() {
  const d = stav.data, o = stav.okno;
  $('veta').innerHTML = htmlVeta(d, o);
  $('prehlad').innerHTML = htmlPrehlad(d, o);
  $('krajiny').innerHTML = htmlKrajiny(d, o);
  $('produkty').innerHTML = htmlProdukty(d, o);
  $('zdroje').innerHTML = htmlZdroje(d, o);
}

function zapniPrepinac() {
  const skupina = document.querySelector('.live-prepinac');
  if (!skupina) return;
  skupina.hidden = false;
  skupina.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-okno]');
    // Bez dát nič neprepínať: tlačidlo by ukazovalo 7 dní nad číslami za 30 dní (brána 2, T3).
    if (!stav.data || !b || b.dataset.okno === stav.okno) return;
    stav.okno = b.dataset.okno === 'd7' ? 'd7' : 'd30';
    for (const x of skupina.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    vykresliCisla();
    stav.globus?.nastavData(stav.data, stav.okno);
  });
}

// ---------- globe ----------

const DOMOV = { lat: 48.1486, lon: 17.1077 };
const FARBY = { zem: '#4a4541', svetlo: '#f2643c', vrchol: '#ffc29e', mesto: '#fff4ea', gula: '#120f0d', okraj: '#3b2a21', halo: '#f2643c' };
const SKLON = 0.62; // tilt so Europe sits a little above the centre and Africa and the Americas stay in view

function naVektor(lat, lon, r = 1) {
  const phi = ((90 - lat) * Math.PI) / 180, theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

// The include must stand on its own line, three.js resolves it only at the start of a line.
const VYSTUP = `
#include <colorspace_fragment>
`;

function vytvorGlobus(platno, pevnina) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: platno, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const scena = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  kamera.position.set(0, 0, 4.25);
  const svet = new THREE.Group();
  scena.add(svet);

  // Sphere: dark, with a warm rim so the edge of the planet reads against the dark page.
  const gula = new THREE.Mesh(new THREE.SphereGeometry(0.995, 72, 48), new THREE.ShaderMaterial({
    uniforms: { zaklad: { value: new THREE.Color(FARBY.gula) }, okraj: { value: new THREE.Color(FARBY.okraj) } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform vec3 zaklad; uniform vec3 okraj; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.2); gl_FragColor = vec4(mix(zaklad, okraj, f), 1.0); ${VYSTUP} }`,
  }));
  svet.add(gula);

  // Halo around the planet (does not turn with it).
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.11, 64, 32), new THREE.ShaderMaterial({
    uniforms: { farba: { value: new THREE.Color(FARBY.halo) } },
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    // Back faces of a slightly larger sphere: brightest right at the planet's edge, zero at the halo's own edge.
    fragmentShader: `uniform vec3 farba; varying vec3 vN; void main(){ float i = clamp(-vN.z / 0.45, 0.0, 1.0); gl_FragColor = vec4(farba, i * i * 0.32); ${VYSTUP} }`,
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
  scena.add(halo);

  // Land dots: one InstancedMesh of small hexagons facing outwards.
  const krok = (pevnina.krok * Math.PI) / 180;
  const pocetBodiek = pevnina.bodiek;
  const bodky = new THREE.InstancedMesh(new THREE.CircleGeometry(krok * 0.36, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), pocetBodiek);
  const krajinaBodky = new Uint16Array(pocetBodiek);
  const smery = new Float32Array(pocetBodiek * 3);
  const pom = new THREE.Object3D();
  let i = 0;
  for (const [lat, n, posun, behy] of pevnina.riadky) {
    for (let b = 0; b < behy.length; b += 3) {
      const [zac, dlzka, k] = [behy[b], behy[b + 1], behy[b + 2]];
      for (let j = zac; j < zac + dlzka; j++) {
        const lon = -180 + ((j + posun * 0.5) * 360) / n;
        const p = naVektor(lat, lon, 1.001);
        pom.position.copy(p);
        pom.lookAt(p.x * 2, p.y * 2, p.z * 2);
        pom.updateMatrix();
        bodky.setMatrixAt(i, pom.matrix);
        krajinaBodky[i] = k;
        smery[i * 3] = p.x; smery[i * 3 + 1] = p.y; smery[i * 3 + 2] = p.z;
        i++;
      }
    }
  }
  bodky.instanceMatrix.needsUpdate = true;
  bodky.setColorAt(0, new THREE.Color(FARBY.zem));
  svet.add(bodky);

  // Home: Bratislava.
  const domov = naVektor(DOMOV.lat, DOMOV.lon, 1.003);
  const domovSkupina = new THREE.Group();
  domovSkupina.position.copy(domov);
  domovSkupina.lookAt(domov.clone().multiplyScalar(2));
  domovSkupina.add(new THREE.Mesh(new THREE.CircleGeometry(0.011, 24), new THREE.MeshBasicMaterial({ color: FARBY.mesto, toneMapped: false })));
  domovSkupina.add(new THREE.Mesh(new THREE.RingGeometry(0.019, 0.024, 40), new THREE.MeshBasicMaterial({ color: FARBY.svetlo, toneMapped: false, transparent: true, opacity: 0.9 })));
  svet.add(domovSkupina);

  const vrstva = new THREE.Group(); // arcs and places, rebuilt when the period changes
  svet.add(vrstva);
  const kruhy = [];
  const oblukyMaterialy = [];

  const vlnaMaterial = (farba, faza, sila) => new THREE.ShaderMaterial({
    uniforms: { cas: { value: 0 }, farba: { value: new THREE.Color(farba) }, faza: { value: faza }, sila: { value: sila }, pohyb: { value: POKOJ.matches ? 0 : 1 } },
    vertexShader: 'varying float vT; void main(){ vT = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float cas; uniform vec3 farba; uniform float faza; uniform float sila; uniform float pohyb; varying float vT;
      void main(){
        float x = fract(vT - cas * 0.16 - faza);
        float vlna = smoothstep(0.0, 0.12, x) * (1.0 - smoothstep(0.12, 0.26, x)) * pohyb;
        float a = (0.22 + 0.3 * sila) * smoothstep(0.0, 0.04, vT) + vlna * 0.95;
        gl_FragColor = vec4(farba * (0.75 + vlna), a); ${VYSTUP}
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });

  function nastavData(data, okno) {
    // dot colours by country
    const index = new Map(pevnina.iso.map((k, j) => [k, j]));
    const sila = new Float32Array(pevnina.iso.length);
    const hodnoty = data.krajiny.map((k) => hodnota(k[okno]));
    const max = Math.max(1, ...hodnoty);
    for (const k of data.krajiny) {
      const j = index.get(k.iso);
      const v = hodnota(k[okno]);
      if (j !== undefined && v > 0) sila[j] = Math.log1p(v) / Math.log1p(max);
    }
    const zem = new THREE.Color(FARBY.zem), svetlo = new THREE.Color(FARBY.svetlo), vrchol = new THREE.Color(FARBY.vrchol);
    const c = new THREE.Color();
    for (let b = 0; b < pocetBodiek; b++) {
      const s = sila[krajinaBodky[b]];
      // Few visitors: a copper tint on grey; many: full copper turning to light peach at the top (Slovakia, Austria).
      if (s > 0) { c.copy(zem).lerp(svetlo, 0.18 + 0.82 * Math.pow(s, 1.25)); if (s > 0.6) c.lerp(vrchol, ((s - 0.6) / 0.4) * 0.8); }
      else c.copy(zem);
      bodky.setColorAt(b, c);
    }
    bodky.instanceColor.needsUpdate = true;

    // arcs from each country with visitors to Bratislava, places as dots with a slow ring
    for (const o of vrstva.children.slice()) { vrstva.remove(o); o.geometry?.dispose(); o.material?.dispose(); }
    kruhy.length = 0; oblukyMaterialy.length = 0;
    const krajiny = data.krajiny.filter((k) => k.iso !== 'SK' && typeof k.lat === 'number' && hodnota(k[okno]) > 0)
      .sort((a, b) => hodnota(b[okno]) - hodnota(a[okno])).slice(0, 40);
    krajiny.forEach((k, n) => {
      const s = Math.log1p(hodnota(k[okno])) / Math.log1p(max);
      const a = naVektor(k.lat, k.lon, 1.0), z = naVektor(DOMOV.lat, DOMOV.lon, 1.0);
      const uhol = a.angleTo(z);
      const vyska = Math.min(1.3, 1.03 + uhol * 0.11); // low arcs, like a flight map; the far side stays near the planet
      const c1 = a.clone().lerp(z, 0.25).normalize().multiplyScalar(vyska), c2 = a.clone().lerp(z, 0.75).normalize().multiplyScalar(vyska);
      const krivka = new THREE.CubicBezierCurve3(a, c1, c2, z);
      const m = vlnaMaterial(FARBY.svetlo, (n * 0.137) % 1, s);
      oblukyMaterialy.push(m);
      vrstva.add(new THREE.Mesh(new THREE.TubeGeometry(krivka, Math.max(24, Math.round(uhol * 40)), 0.0016 + 0.0024 * s, 5, false), m));
    });
    const miesta = data.mesta?.[okno] || [];
    const maxM = Math.max(1, ...miesta.map((m) => m.n));
    miesta.slice(0, 40).forEach((m, n) => {
      const s = Math.log1p(m.n) / Math.log1p(maxM);
      const p = naVektor(m.lat, m.lon, 1.004);
      const g = new THREE.Group();
      g.position.copy(p);
      g.lookAt(p.clone().multiplyScalar(2));
      g.add(new THREE.Mesh(new THREE.CircleGeometry(0.005 + 0.007 * s, 20), new THREE.MeshBasicMaterial({ color: FARBY.mesto, toneMapped: false })));
      const kruh = new THREE.Mesh(new THREE.RingGeometry(0.008 + 0.008 * s, 0.0105 + 0.009 * s, 40), new THREE.MeshBasicMaterial({ color: FARBY.mesto, toneMapped: false, transparent: true, opacity: 0.5, depthWrite: false }));
      g.add(kruh);
      kruhy.push({ kruh, faza: (n * 0.29) % 1 });
      vrstva.add(g);
    });
    ziadost();
  }

  // ---------- turning, dragging, drawing ----------
  let yaw = -Math.PI / 2 - (DOMOV.lon * Math.PI) / 180, pitch = SKLON;
  let tahanie = null, rychlost = 0, pauzaDo = 0, posledny = 0, viditelny = true, beh = false, spinaLen = true;
  const sam = () => !POKOJ.matches && performance.now() > pauzaDo && !tahanie;

  function velkost() {
    const r = platno.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    kamera.aspect = w / h;
    kamera.updateProjectionMatrix();
    ziadost();
  }

  function snimka(t) {
    beh = false;
    const klud = !tahanie && Math.abs(rychlost) < 0.00001;
    // Without a hand on the globe about 30 frames per second is enough and halves the work (Firefox draws slower).
    if (klud && !spinaLen && posledny && t - posledny < 30) { pokracuj(); return; }
    const dt = Math.min(64, t - (posledny || t));
    const animuje = sam() || !klud;
    posledny = t;
    if (!tahanie) {
      if (Math.abs(rychlost) > 0.00001) { yaw += rychlost * dt; rychlost *= Math.pow(0.0025, dt / 1000); }
      else if (sam()) yaw += 0.000075 * dt; // one turn in about 84 s
    }
    svet.rotation.set(pitch, yaw, 0);
    const cas = t / 1000;
    for (const m of oblukyMaterialy) m.uniforms.cas.value = POKOJ.matches ? 0 : cas;
    for (const { kruh, faza } of kruhy) {
      const x = POKOJ.matches ? 0.35 : (cas * 0.35 + faza) % 1;
      kruh.scale.setScalar(1 + x * 1.6);
      kruh.material.opacity = 0.55 * (1 - x);
    }
    renderer.render(scena, kamera);
    spinaLen = false;
    if (animuje || (!POKOJ.matches && (oblukyMaterialy.length || kruhy.length))) pokracuj();
  }
  function pokracuj() { if (!beh && viditelny && !document.hidden) { beh = true; requestAnimationFrame(snimka); } }
  function ziadost() { spinaLen = true; pokracuj(); }

  new ResizeObserver(velkost).observe(platno);
  new IntersectionObserver((z) => { viditelny = z.some((x) => x.isIntersecting); pokracuj(); }).observe(platno);
  document.addEventListener('visibilitychange', () => { posledny = 0; pokracuj(); });
  POKOJ.addEventListener?.('change', () => { for (const m of oblukyMaterialy) m.uniforms.pohyb.value = POKOJ.matches ? 0 : 1; ziadost(); });

  // Dragging: horizontal turns the globe, vertical tilts it a little; touch keeps vertical page scrolling (touch-action: pan-y).
  platno.addEventListener('pointerdown', (e) => {
    tahanie = { x: e.clientX, y: e.clientY, t: performance.now(), x0: e.clientX, y0: e.clientY, id: e.pointerId };
    rychlost = 0;
    try { platno.setPointerCapture(e.pointerId); } catch {}
    ziadost();
  });
  platno.addEventListener('pointermove', (e) => {
    if (tahanie && e.pointerId === tahanie.id) {
      const now = performance.now();
      const dx = e.clientX - tahanie.x, dy = e.clientY - tahanie.y;
      const s = 3.2 / Math.max(240, platno.clientWidth);
      yaw += dx * s;
      pitch = Math.max(-0.35, Math.min(1.1, pitch + dy * s * 0.6));
      rychlost = (dx * s) / Math.max(8, now - tahanie.t);
      Object.assign(tahanie, { x: e.clientX, y: e.clientY, t: now });
      tip(null);
      ziadost();
    } else if (e.pointerType === 'mouse') tip(e);
  });
  const koniec = (e) => {
    if (!tahanie || e.pointerId !== tahanie.id) return;
    const kratko = Math.hypot(e.clientX - tahanie.x0, e.clientY - tahanie.y0) < 6;
    tahanie = null;
    pauzaDo = performance.now() + 4000;
    if (kratko) { rychlost = 0; tip(e); }
    ziadost();
  };
  platno.addEventListener('pointerup', koniec);
  platno.addEventListener('pointercancel', (e) => { if (tahanie && e.pointerId === tahanie.id) { tahanie = null; pauzaDo = performance.now() + 4000; } });
  platno.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !tahanie) tip(null); });

  // Tooltip: which country is under the pointer (nearest land dot).
  const luc = new THREE.Raycaster();
  const bodTip = $('tip');
  const prah = Math.cos(krok * 1.6);
  function tip(e) {
    if (!e || !stav.data) { bodTip.classList.remove('on'); return; }
    const r = platno.getBoundingClientRect();
    luc.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), kamera);
    const zasah = luc.intersectObject(gula, false)[0];
    if (!zasah) { bodTip.classList.remove('on'); return; }
    const p = svet.worldToLocal(zasah.point.clone()).normalize();
    let naj = -1, najD = prah;
    for (let b = 0; b < pocetBodiek; b++) {
      const d = smery[b * 3] * p.x + smery[b * 3 + 1] * p.y + smery[b * 3 + 2] * p.z;
      if (d > najD) { najD = d; naj = b; }
    }
    const iso = naj >= 0 ? pevnina.iso[krajinaBodky[naj]] : '';
    if (!iso) { bodTip.classList.remove('on'); return; }
    const k = stav.data.krajiny.find((x) => x.iso === iso);
    const meno = k ? k.nazov : pevnina.mena?.[krajinaBodky[naj]] || iso;
    const v = k ? k[stav.okno] : 0;
    const veta = hodnota(v) > 0 ? `${pocet(v)} ${v === 1 ? 'visitor' : 'visitors'}, ${OKNA[stav.okno]}` : `No visitors, ${OKNA[stav.okno]}`;
    bodTip.textContent = meno;
    const span = document.createElement('span');
    span.textContent = veta;
    bodTip.append(span);
    bodTip.style.left = `${e.clientX - r.left}px`;
    bodTip.style.top = `${e.clientY - r.top}px`;
    bodTip.classList.add('on');
  }

  velkost();
  platno.classList.add('ok');
  return { nastavData };
}

async function start() {
  const platno = $('globus');
  const [d, p] = await Promise.allSettled([nacitaj('data.json'), nacitaj('pevnina.json')]);
  // Čísla a prepínač: len s dátami; pri chybe ostanú statické čísla zo stránky a prepínač skrytý (brána 2, T3).
  if (d.status === 'fulfilled' && d.value?.sucty?.d30 && d.value?.sucty?.d7) {
    try { stav.data = d.value; vykresliCisla(); zapniPrepinac(); } catch { stav.data = null; }
  }
  const pevnina = p.status === 'fulfilled' ? p.value : null;
  if (!stav.data || !pevnina) {
    platno.insertAdjacentHTML('afterend', '<p class="bez">The globe could not load its data. The numbers on this page are from the last update.</p>');
    return;
  }
  stav.globus = vytvorGlobus(platno, pevnina);
  if (!stav.globus) {
    platno.insertAdjacentHTML('afterend', '<p class="bez">This browser cannot draw the globe (WebGL is off). The same numbers are in the lists below.</p>');
    return;
  }
  stav.globus.nastavData(stav.data, stav.okno);
  // The data changes once a day; checking every 5 minutes while the page is open is plenty (the server answers 304 if unchanged).
  setInterval(async () => {
    if (document.hidden || !stav.data) return;
    try {
      const nove = await nacitaj('data.json');
      // Only a newer day replaces what is shown: a slow, older answer never overwrites fresher data (ISO dates compare as text).
      if (nove?.sucty?.d30 && String(nove.aktualizovane) > String(stav.data.aktualizovane)) { stav.data = nove; vykresliCisla(); stav.globus.nastavData(nove, stav.okno); }
    } catch {}
  }, 5 * 60 * 1000);
}

start();
