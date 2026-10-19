// Editor pozvánky na Silvester 2027 (ARLing, 19. 10. 2026). Kupujúci napíše údaje, vidí živý náhľad a klikne
// „Create my video“: prehliadač nahrá 16 s plátna cez MediaRecorder (MP4 v Chrome a Edge, inak WebM),
// s hudbou z hudba.mp3 cez Web Audio, alebo bez zvuku. Nič sa neposiela na server; text ostáva len v tomto
// prehliadači (localStorage kvôli obnoveniu stránky).
// Súbeh (AGENTS.md bod 12, brána 1): počas nahrávania sa nedá zmeniť formát, hudba ani spustiť druhé nahrávanie,
// náhľadová hudba má číslo verzie (dvojklik nespustí dve stopy) a výsledok sa pred „ready“ overí (rozmer, dĺžka).
import { vytvorScenu, DLZKA, POLIA, FORMATY, ZNAKY } from './scena.js';
import { cistiText } from './rozlozenie.js';
import { doplnDlzkuWebm, dlzkaObsahuWebm } from './webm.js';

const $ = (s) => document.querySelector(s);
const platno = $('#platno'), ram = $('#ram'), stavEl = $('#stav'), pas = $('#cas-pas');
const ULOZ = 'arling-nye-2027-v1';
const UKAZKA = Object.fromEntries(POLIA.map((p) => [p.id, p.ukazka]));
const VETA_FIREFOX = 'Firefox saves a WebM file and may record less smoothly. For an MP4 file, use Chrome or Edge.';
const VETA_SKRYTA = 'The tab was hidden while recording. Keep this tab visible while your video is being made. Please try again.';
const VETA_ZLE = 'The recording did not come out right. Please try again.';
const VETA_PAUZA = 'The recording paused for a moment. Please close other heavy apps and try again.';
// najdlhšie správne video: animácia, statický začiatok 0,8 s a koniec 0,25 s, s rezervou (brána 3: stojace zvukové hodiny dali 42 s)
const MAX_DLZKA = DLZKA + 2.5;

let scena = null, format = '9x16', mierkaNahladu = 0.75;
let start = performance.now(), nahravam = false, hudbaNahlad = null, verziaHudby = 0;
let zvuk = { ctx: null, buffer: null };
const stopyNahladu = new Set();
const posledne = { mime: null, velkost: 0, url: null, chyba: null, mierka: null, msSnimka: null };
window.__nye = { posledne, pripravene: false, stopyNahladu: () => stopyNahladu.size, nahravam: () => nahravam };

const citaj = () => { try { return JSON.parse(localStorage.getItem(ULOZ) || 'null'); } catch { return null; } };
const uloz = (p) => { try { localStorage.setItem(ULOZ, JSON.stringify(p)); } catch { /* súkromné okno */ } };
const hodnoty = () => Object.fromEntries(POLIA.map((p) => [p.id, $('#p-' + p.id).value]));
function stav(text, chyba = false) { stavEl.textContent = text; stavEl.classList.toggle('chyba', chyba); }
const ovladace = () => [...document.querySelectorAll('#vytvor, #znova, #zvuk, #s-hudbou, input[name="format"], .pole input')];

function rozmerNahladu() {
  const F = FORMATY[format];
  const r = ram.getBoundingClientRect();
  const w = Math.min(F.W, Math.max(270, Math.round(r.width * Math.min(2, window.devicePixelRatio || 1))));
  return [w, Math.round((w * F.H) / F.W)];
}

function ukazHlasenia(up, prazdne = []) {
  for (const p of POLIA) {
    const pole = $('#p-' + p.id);
    const riadok = document.querySelector(`.poznamka[data-pre="${p.id}"]`);
    riadok.querySelector('.pocet').textContent = `${[...pole.value].length}/${p.max}`;
    const h = up.filter((u) => u.pole === p.id).map((u) => (u.typ === 'emoji' ? 'Emoji are left out.' : `Shown in a standard font: ${u.znaky.join(' ')}`));
    const chyba = prazdne.includes(p.id);
    if (chyba) h.unshift('Please fill in this field.');
    if (chyba) pole.setAttribute('aria-invalid', 'true'); else pole.removeAttribute('aria-invalid');
    riadok.querySelector('.hlasenie').textContent = h.join(' ');
  }
}

let casovac = 0;
function aktualizuj(okamzite = false) {
  clearTimeout(casovac);
  const urob = () => {
    const p = hodnoty();
    uloz(p);
    if (!scena || nahravam) return;
    const r = scena.nastavText(p);
    // pole, ktoré už nie je prázdne, stratí hlásenie o vyplnení
    ukazHlasenia(r.upozornenia, POLIA.filter((x) => $('#p-' + x.id).hasAttribute('aria-invalid') && !cistiText(p[x.id], ZNAKY, x.max).text).map((x) => x.id));
    // po úprave ukáž hotovú pozvánku, nech je text hneď vidieť
    const t = (performance.now() - start) / 1000;
    if (!hudbaNahlad && t < 8.2) start = performance.now() - 8200;
  };
  if (okamzite) urob(); else casovac = setTimeout(urob, 180);
}

function nastavFormat(f) {
  // počas nahrávania sa formát nemení (inak by sa zmenilo plátno uprostred videa, brána 1)
  if (nahravam) { const r = document.querySelector(`input[name="format"][value="${format}"]`); if (r) r.checked = true; return; }
  format = f;
  ram.dataset.format = f;
  if (!scena) return;
  const [w, h] = rozmerNahladu();
  scena.nastavFormat(f, w, h, mierkaNahladu);
  aktualizuj(true);
  start = performance.now();
}

// náhľad: slučka 16 s a krátke podržanie, s hudbou len po kliknutí (pravidlá prehrávania zvuku v prehliadačoch)
let snimok = 0, sucetMs = 0;
function slucka(teraz) {
  requestAnimationFrame(slucka);
  if (!scena || nahravam) return;
  let t;
  if (hudbaNahlad) {
    t = zvuk.ctx.currentTime - hudbaNahlad.zaciatok;
    if (t > DLZKA + 0.4) zastavHudbuNahladu();
  } else {
    t = (teraz - start) / 1000;
    if (t > DLZKA + 1.2) { start = teraz; t = 0; }
  }
  const a = performance.now();
  scena.vykresli(Math.min(Math.max(t, 0), DLZKA));
  // slabé zariadenie: menej častíc a bloomu v náhľade (text ostáva ostrý)
  if (snimok < 90) {
    snimok++; sucetMs += performance.now() - a;
    if (snimok === 90 && sucetMs / 90 > 24 && mierkaNahladu > 0.5) { mierkaNahladu = 0.5; const [w, h] = rozmerNahladu(); scena.velkost(w, h, mierkaNahladu); }
  }
  pas.style.width = `${Math.min(100, (t / DLZKA) * 100).toFixed(1)}%`;
}

async function pripravZvuk() {
  if (!zvuk.ctx) zvuk.ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (zvuk.ctx.state === 'suspended') await zvuk.ctx.resume();
  if (!zvuk.buffer) {
    const r = await fetch(new URL('./hudba.mp3', import.meta.url));
    if (!r.ok) throw new Error('music file did not load');
    zvuk.buffer = await zvuk.ctx.decodeAudioData(await r.arrayBuffer());
  }
}
function zastavHudbuNahladu() {
  verziaHudby++; // zruší aj práve načítavané spustenie
  if (hudbaNahlad) { try { hudbaNahlad.zdroj.stop(); } catch { /* už stojí */ } stopyNahladu.delete(hudbaNahlad.zdroj); hudbaNahlad = null; }
  $('#zvuk').setAttribute('aria-pressed', 'false');
  $('#zvuk').textContent = 'Play with music';
  start = performance.now();
}
async function hrajSHudbou() {
  if (nahravam) return;
  if (hudbaNahlad) { zastavHudbuNahladu(); return; }
  const moja = ++verziaHudby;
  try {
    await pripravZvuk();
    // medzičasom druhé kliknutie, zastavenie alebo nahrávanie: táto stopa sa nespustí (dvojklik = jedna stopa)
    if (moja !== verziaHudby || nahravam || hudbaNahlad) return;
    const zdroj = zvuk.ctx.createBufferSource();
    zdroj.buffer = zvuk.buffer; zdroj.connect(zvuk.ctx.destination);
    zdroj.onended = () => stopyNahladu.delete(zdroj);
    const zaciatok = zvuk.ctx.currentTime + 0.05;
    zdroj.start(zaciatok);
    stopyNahladu.add(zdroj);
    hudbaNahlad = { zdroj, zaciatok };
    $('#zvuk').setAttribute('aria-pressed', 'true');
    $('#zvuk').textContent = 'Stop music';
  } catch (e) { stav('The music could not start in this browser: ' + e.message, true); }
}

const MIME_HUDBA = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.4d0028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
const MIME_TICHO = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.4d0028', 'video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
export function vyberMime(sHudbou, podporuje = (t) => MediaRecorder.isTypeSupported(t)) {
  return (sHudbou ? MIME_HUDBA : MIME_TICHO).find((t) => { try { return podporuje(t); } catch { return false; } }) || '';
}

/** Priemerný čas snímky pri plnom rozlíšení (ms), s počkaním na GPU. */
function zmerajSnimku() {
  const gl = scena.renderer.getContext();
  const px = new Uint8Array(4);
  for (let i = 0; i < 3; i++) scena.vykresli(2.2 + i * 0.1);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const a = performance.now();
  for (let i = 0; i < 8; i++) scena.vykresli(2.5 + i * 0.25);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return (performance.now() - a) / 8;
}

/**
 * Overí hotové video: rozmer presne podľa formátu a dĺžka aspoň 15 s (zlyhanie zatvára, brána 1). Dĺžka sa berie až
 * po načítaní metadát, pri WebM bez dĺžky po skoku na koniec (udalosť seeked); čiastočná dĺžka počas načítania sa
 * neberie (Firefox inak hlásil 1,5 s). Keď ani potom WebM dĺžku nemá, rozhodne len rozmer.
 */
function overVideo(blob, F, webm) {
  return new Promise((ok) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(blob);
    let hotovo = false;
    const koniec = (vysledok) => { if (hotovo) return; hotovo = true; clearTimeout(cas); v.removeAttribute('src'); v.load(); URL.revokeObjectURL(url); ok(vysledok); };
    const cas = setTimeout(() => koniec({ ok: false, dovod: 'metadata did not load' }), 15000);
    const posud = () => {
      const d = v.duration, rozmer = v.videoWidth === F.W && v.videoHeight === F.H;
      if (Number.isFinite(d)) koniec({ ok: rozmer && d >= 15 && d <= MAX_DLZKA, sirka: v.videoWidth, vyska: v.videoHeight, dlzka: d });
      else koniec({ ok: rozmer && webm, sirka: v.videoWidth, vyska: v.videoHeight, dlzka: null });
    };
    v.muted = true; v.preload = 'metadata';
    v.onerror = () => koniec({ ok: false, dovod: 'video error' });
    v.onloadedmetadata = () => {
      if (Number.isFinite(v.duration)) { posud(); return; }
      v.onseeked = () => posud();
      try { v.currentTime = 1e7; } catch { posud(); }
    };
    v.src = url;
  });
}

async function vytvor() {
  if (nahravam) return;
  posledne.chyba = null;
  if (!window.MediaRecorder || !platno.captureStream) { stav('This browser cannot record video. Please open this page in Chrome or Edge.', true); posledne.chyba = 'nepodporovane'; return; }
  const p = hodnoty();
  // povinné pole musí mať text aj po čistení (pole len s emoji je prázdne)
  const prazdne = POLIA.filter((x) => x.povinne && !cistiText(p[x.id], ZNAKY, x.max).text);
  if (prazdne.length) {
    ukazHlasenia(scena ? scena.nastavText(p).upozornenia : [], prazdne.map((x) => x.id));
    stav(`Please fill in: ${prazdne.map((x) => x.label).join(', ')}.`, true);
    $('#p-' + prazdne[0].id).focus();
    return;
  }
  const ukazkove = POLIA.filter((x) => p[x.id].trim() === x.ukazka);
  if (ukazkove.length && !window.__nye.bezOtazky && !window.confirm(`These fields still show our sample text: ${ukazkove.map((x) => x.label).join(', ')}. Create the video anyway?`)) return;
  const sHudbou = $('#s-hudbou').checked;
  const mime = vyberMime(sHudbou);
  if (!mime) { stav('This browser cannot record video. Please try Chrome or Edge.', true); posledne.chyba = 'ziadny-mime'; return; }
  const webm = mime.startsWith('video/webm');
  const formatNahravky = format;
  const F = FORMATY[formatNahravky];

  // zvuk sa musí zapnúť ešte v obsluhe kliknutia, pred prvým await (Safari inak AudioContext nepustí)
  if (sHudbou) {
    try { if (!zvuk.ctx) zvuk.ctx = new (window.AudioContext || window.webkitAudioContext)(); zvuk.ctx.resume(); } catch { /* ohlási pripravZvuk */ }
  }
  nahravam = true;
  zastavHudbuNahladu();
  for (const e of ovladace()) e.disabled = true;
  $('#vysledok').hidden = true;
  const priebeh = $('#priebeh'), priebehPas = priebeh.querySelector('span');
  priebeh.hidden = false; priebehPas.style.width = '0%';
  stav('Preparing…');
  let zamok = null, zdroj = null, stream = null, rec = null, ciel = null;
  try {
    try { zamok = await navigator.wakeLock?.request('screen'); } catch { /* nevadí */ }
    if (sHudbou) await pripravZvuk();
    // plné rozlíšenie; scéna (častice, bloom) sa zmenší, ak by zariadenie nestíhalo 30 snímok za sekundu.
    // WebM (Firefox) kóduje video v procesore, preto tam scéna rovno na polovicu (brána 1: záseky pri odhalení 2027).
    scena.nastavFormat(formatNahravky, F.W, F.H, webm ? 0.5 : 1);
    scena.nastavText(p);
    let mierka = webm ? 0.5 : 1, ms = zmerajSnimku();
    for (const m of [0.7, 0.5, 0.35]) { if (ms <= 22) break; if (m >= mierka) continue; mierka = m; scena.velkost(F.W, F.H, m); ms = zmerajSnimku(); }
    posledne.mierka = mierka; posledne.msSnimka = +ms.toFixed(1);
    const veta = webm ? VETA_FIREFOX + ' ' : ms > 30 ? 'This device is a little slow, so the video may stutter. A computer gives the smoothest result. ' : '';
    stav(veta + 'Recording… keep this tab visible.');
    scena.vykresli(0);
    stream = platno.captureStream(30);
    const stopy = [...stream.getVideoTracks()];
    if (sHudbou) {
      ciel = zvuk.ctx.createMediaStreamDestination();
      zdroj = zvuk.ctx.createBufferSource();
      zdroj.buffer = zvuk.buffer;
      zdroj.connect(ciel);
      const g = zvuk.ctx.createGain(); g.gain.value = 0.7; zdroj.connect(g); g.connect(zvuk.ctx.destination);
      stopy.push(...ciel.stream.getAudioTracks());
    }
    rec = new MediaRecorder(new MediaStream(stopy), { mimeType: mime, videoBitsPerSecond: 8e6, audioBitsPerSecond: 192000 });
    const kusy = [];
    // nahrávač, ktorý skončí sám (chyba kodéra) alebo nahlási chybu, zatvára (brána 2, AGENTS.md bod 12 c)
    let chybaNahravaca = null, naseStop = false;
    rec.onerror = (e) => { chybaNahravaca = e.error || new Error('recorder error'); };
    rec.ondataavailable = (e) => { if (e.data && e.data.size) kusy.push(e.data); };
    const koniec = new Promise((ok) => { rec.onstop = () => { if (!naseStop) chybaNahravaca ||= new Error('recorder stopped by itself'); ok(); }; });
    rec.start(1000);
    // 0,8 s statickej prvej snímky: zásek kodéra po štarte padne na pokojný obraz (brána 2, odporúčanie 1)
    const oneskorenie = 0.8;
    const zacA = sHudbou ? zvuk.ctx.currentTime + oneskorenie : 0, zacP = performance.now() + oneskorenie * 1000;
    if (zdroj) zdroj.start(zacA);
    const hodiny = () => (sHudbou ? zvuk.ctx.currentTime - zacA : (performance.now() - zacP) / 1000);
    await new Promise((ok, zle) => {
      let hotovo = false, posledny = performance.now();
      // zvukové hodiny musia ísť: keď hodiny() 1 s nepostúpia, kým čas stránky beží, video by zamrzlo (AudioContext suspend, iPhone pri Siri)
      let hodinyRef = hodiny(), hodinyRefCas = performance.now();
      const hodinyStoja = (teraz) => {
        const h = hodiny();
        if (h > hodinyRef + 0.05) { hodinyRef = h; hodinyRefCas = teraz; return false; }
        return teraz - hodinyRefCas > 1000;
      };
      const stojace = () => new Error(document.hidden ? VETA_SKRYTA : VETA_PAUZA);
      const skoncit = (chyba) => {
        if (hotovo) return;
        hotovo = true;
        document.removeEventListener('visibilitychange', skryta);
        clearInterval(straz);
        if (chyba) zle(chyba); else ok();
      };
      // skrytá karta: Chrome v nej nespúšťa requestAnimationFrame, video by zamrzlo, preto poslucháč aj stráž hodín
      const skryta = () => { if (document.hidden) skoncit(new Error(VETA_SKRYTA)); };
      document.addEventListener('visibilitychange', skryta);
      const straz = setInterval(() => {
        if (document.hidden) skoncit(new Error(VETA_SKRYTA));
        else if (performance.now() - posledny > 1000) skoncit(stojace());
        else if (chybaNahravaca || rec.state !== 'recording' || hodinyStoja(performance.now())) skoncit(new Error(VETA_ZLE));
      }, 250);
      const krok = (teraz) => {
        if (hotovo) return;
        if (document.hidden) { skoncit(new Error(VETA_SKRYTA)); return; }
        if (teraz - posledny > 1000) { skoncit(stojace()); return; }
        if (chybaNahravaca || rec.state !== 'recording' || hodinyStoja(teraz)) { skoncit(new Error(VETA_ZLE)); return; }
        posledny = teraz;
        const t = hodiny();
        scena.vykresli(Math.min(Math.max(t, 0), DLZKA));
        priebehPas.style.width = `${Math.min(100, Math.max(0, (t / DLZKA) * 100)).toFixed(1)}%`;
        if (t >= DLZKA + 0.25) { skoncit(null); return; }
        requestAnimationFrame(krok);
      };
      requestAnimationFrame(krok);
    });
    if (rec.state !== 'recording' || chybaNahravaca) throw new Error(VETA_ZLE);
    naseStop = true;
    rec.stop();
    await koniec;
    if (chybaNahravaca) throw new Error(VETA_ZLE);
    const typ = mime.split(';')[0];
    let blob = new Blob(kusy, { type: typ });
    if (webm) {
      // dĺžka z obsahu (čas poslednej snímky v Clusteroch), nie z hodín stránky; zapíše sa do hlavičky, aby sa dalo posúvať
      const data = new Uint8Array(await blob.arrayBuffer());
      const obsahMs = dlzkaObsahuWebm(data);
      posledne.obsahWebmMs = obsahMs;
      if (obsahMs == null || obsahMs < 15000 || obsahMs > MAX_DLZKA * 1000) throw new Error(VETA_ZLE);
      const opr = doplnDlzkuWebm(data, obsahMs);
      if (opr.zmenene) blob = new Blob([opr.data], { type: typ });
      posledne.dlzkaWebm = opr.dovod;
    }
    stav('Checking the video…');
    const kontrola = await overVideo(blob, F, webm);
    posledne.kontrola = kontrola;
    if (!kontrola.ok) throw new Error(VETA_ZLE);
    const pripona = typ === 'video/mp4' ? 'mp4' : 'webm';
    const meno = `new-years-eve-invitation-2027-${formatNahravky === '9x16' ? 'vertical' : 'horizontal'}${sHudbou ? '' : '-silent'}.${pripona}`;
    if (posledne.url) URL.revokeObjectURL(posledne.url);
    const url = URL.createObjectURL(blob);
    Object.assign(posledne, { mime, velkost: blob.size, url, meno, blob });
    const video = $('#video');
    video.src = url;
    const stiahnut = $('#stiahnut');
    stiahnut.href = url; stiahnut.download = meno;
    stiahnut.textContent = `Download ${pripona.toUpperCase()} (${(blob.size / 1e6).toFixed(1)} MB)`;
    $('#info-format').textContent = pripona === 'mp4'
      ? 'MP4 (H.264).'
      : 'WebM. Plays in Firefox, Chrome and VLC. For an MP4 file, create the video in Chrome or Edge.';
    const subor = new File([blob], meno, { type: typ });
    const zdielat = $('#zdielat');
    zdielat.hidden = !(navigator.canShare && navigator.canShare({ files: [subor] }));
    zdielat.onclick = () => navigator.share({ files: [subor], title: 'New Year’s Eve invitation 2027' }).catch(() => {});
    $('#vysledok').hidden = false;
    stav('Your video is ready. Download it below.');
  } catch (e) {
    posledne.chyba = e.message;
    stav(e.message || 'Recording failed. Please try again.', true);
  } finally {
    try { zdroj?.stop(); } catch { /* už stojí */ }
    // po chybe nič nesmie nahrávať ďalej: nahrávač aj zvuková stopa stop (brána 2)
    if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch { /* už stojí */ } }
    ciel?.stream.getTracks().forEach((s) => s.stop());
    stream?.getTracks().forEach((s) => s.stop());
    try { await zamok?.release(); } catch { /* nič */ }
    priebeh.hidden = true;
    for (const e of ovladace()) e.disabled = false;
    nahravam = false;
    format = formatNahravky;
    const [w, h] = rozmerNahladu();
    scena.nastavFormat(formatNahravky, w, h, mierkaNahladu);
    scena.nastavText(hodnoty());
    start = performance.now() - 8200;
  }
}
window.__nye.vytvor = vytvor;
// náhľad v čase t (snímky pre obrázky ponuky a kontrolu)
window.__nye.ukaz = (t) => { zastavHudbuNahladu(); start = performance.now() - t * 1000; };

/** Telefón: náhľad je nad formulárom; plávajúce tlačidlo ho ukáže, keď je mimo obrazovky. */
function tlacidloNahladu() {
  const b = $('#ukaz-nahlad');
  if (!b || !('IntersectionObserver' in window)) return;
  b.addEventListener('click', () => ram.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  new IntersectionObserver(([z]) => { b.hidden = z.isIntersecting || window.innerWidth >= 860; }, { threshold: 0.15 }).observe(ram);
}

async function init() {
  const ulozene = citaj() || UKAZKA;
  for (const p of POLIA) $('#p-' + p.id).value = ulozene[p.id] ?? '';
  for (const p of POLIA) $('#p-' + p.id).addEventListener('input', () => aktualizuj());
  for (const r of document.querySelectorAll('input[name="format"]')) r.addEventListener('change', () => r.checked && nastavFormat(r.value));
  $('#znova').addEventListener('click', () => { if (!nahravam) { zastavHudbuNahladu(); start = performance.now(); } });
  $('#zvuk').addEventListener('click', hrajSHudbou);
  $('#vytvor').addEventListener('click', vytvor);
  tlacidloNahladu();
  try { if (window.MediaRecorder && vyberMime(true).startsWith('video/webm')) stav(VETA_FIREFOX); } catch { /* nič */ }
  try {
    const [w, h] = rozmerNahladu();
    scena = await vytvorScenu(platno, { format, sirka: w, vyska: h, mierkaSceny: mierkaNahladu });
    aktualizuj(true);
    start = performance.now();
    $('#nacitanie').hidden = true;
    window.__nye.pripravene = true;
    requestAnimationFrame(slucka);
  } catch (e) {
    $('#nacitanie').textContent = 'The preview needs WebGL, which this browser has turned off. Please try another browser.';
    stav('Preview error: ' + e.message, true);
  }
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!scena || nahravam) return; const [w, h] = rozmerNahladu(); scena.velkost(w, h, mierkaNahladu); }, 200); });
}
init();
