// Puzzle video maker, prepojenie stránky: voľby, živý náhľad, výroba videa, stiahnutie a TikTok.
// Logika scény je v scena.mjs, kódovanie v koder.mjs, TikTok klient v tiktok.mjs.
//
// Dve verzie videa: stiahnutie nesie kreditný riadok (licencia API), kópia pre TikTok ho nemá
// (TikTok Content Sharing Guidelines, Watermark Guidelines; výnimka v licencii na /api/#licence).
// Do TikToku ide vždy presne kópia, ktorú tvorca vidí v náhľade v sekcii TikTok.
//
// Prístup k TikToku sa ruší pri každom koncovom stave: koncept v inboxe, zlyhanie, Cancel, chyba
// nahratia, odmietnutie limitom, nevyužitá relácia po 15 minútach a zatvorenie stránky. Počas
// spracovania v TikToku sa neruší, lebo by to koncept zastavilo (fail_reason auth_removed).
import { casy, nakresli, pripravSvg, cestaHlavolamu, nazovSuboru, nahodneCislo, volby as overVolby, POCET } from './scena.mjs';
import { vyberKodek, vyrobMp4, vyrobZaloznou, zaloznyTyp } from './koder.mjs';
import * as tt from './tiktok.mjs';

const $ = (id) => document.getElementById(id);
const platno = $('platno');
const ctx = platno.getContext('2d', { alpha: false });
const pokojne = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ULOZENE = 'pv-tiktok-cakam';
const CAKANIE_NA_TIKTOK_MS = 10 * 60 * 1000;

let stav = null;
let nacitanie = Promise.resolve();
let poradie = 0;
let prehrava = !pokojne;
let zaciatok = performance.now();
let tPauza = 0;
let video = null;
let ttVideo = null;
let vyrobaBezi = false;
let zaloznaBezi = false;
let zrusVyrobu = false;
let cakajuci = null;
let relacia = null;
let odosielaSa = false;
let casovacRelacie = null;
let zrusenaPriOdchode = false;

// --------------------------------------------------------------------------- voľby a náhľad

function citajVolby() {
  const pole = $('v-cislo');
  let n = Math.round(Number(pole.value));
  if (!Number.isFinite(n) || n < 1) n = 1;
  if (n > POCET) n = POCET;
  if (String(n) !== pole.value) pole.value = String(n);
  const sek = (document.querySelector('input[name="sek"]:checked') || {}).value || '20';
  return overVolby({ druh: $('v-druh').value, obtiaznost: $('v-obtiaznost').value, cislo: n, sek });
}

function nastavVolby(v) {
  if (!v) return;
  try {
    const o = overVolby(v);
    $('v-druh').value = o.druh;
    $('v-obtiaznost').value = o.obtiaznost;
    $('v-cislo').value = String(Number(o.cislo));
    for (const r of document.querySelectorAll('input[name="sek"]')) r.checked = Number(r.value) === o.sek;
  } catch (e) { /* neplatné voľby z adresy ignorujeme */ }
}

async function nacitajObrazok(url) {
  const r = await fetch(url, { credentials: 'omit' });
  if (!r.ok) throw new Error('svg ' + r.status);
  const { svg } = pripravSvg(await r.text(), 1400);
  const adresa = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const img = new Image();
  img.decoding = 'async';
  img.src = adresa;
  try { await img.decode(); } catch (e) { await new Promise((res, rej) => { img.onload = res; img.onerror = rej; }); }
  img._adresa = adresa;
  return img;
}

function aktualizuj() {
  let v;
  try { v = citajVolby(); } catch (e) { return; }
  const c = casy(v.sek);
  $('dlzka').textContent = `The video will be ${c.dlzka.toFixed(1)} seconds long, ${v.nazov}, ${v.obtiaznost}, number ${Number(v.cislo)}.`;
  const q = new URLSearchParams({ kind: v.druh, difficulty: v.obtiaznost, n: String(Number(v.cislo)), sek: String(v.sek) });
  history.replaceState(null, '', `${location.pathname}?${q}${location.hash}`);
  const stare = stav;
  const cislo = ++poradie;
  stav = { ...v, zadanie: stare && stare.druh === v.druh && stare.obtiaznost === v.obtiaznost && stare.cislo === v.cislo ? stare.zadanie : null, riesenie: null };
  if (stav.zadanie) stav.riesenie = stare.riesenie;
  if (!pokojne) zaciatok = performance.now();
  else tPauza = c.T_PUZZLE + 2;
  if (stav.zadanie) return;
  const zaklad = cestaHlavolamu(v);
  nacitanie = Promise.all([nacitajObrazok(zaklad + '.svg'), nacitajObrazok(zaklad + '-solution.svg')])
    .then(([a, b]) => {
      if (cislo !== poradie) return;
      for (const s of [stare && stare.zadanie, stare && stare.riesenie]) if (s && s._adresa) URL.revokeObjectURL(s._adresa);
      stav.zadanie = a;
      stav.riesenie = b;
    })
    .catch(() => { if (cislo === poradie) ukaz('sprava-vyroba', 'This puzzle could not be loaded. Check your connection and try again.', 'chyba'); });
}

let poslednyPopis = 0;
function slucka(teraz) {
  if (stav && !zaloznaBezi) {
    const c = casy(stav.sek);
    const t = prehrava ? ((teraz - zaciatok) / 1000) % c.dlzka : tPauza;
    if (!prehrava) tPauza = t;
    nakresli(ctx, t, stav);
    if (teraz - poslednyPopis > 250) {
      poslednyPopis = teraz;
      $('nahlad-cas').textContent = `Live preview, ${t.toFixed(1)} of ${c.dlzka.toFixed(1)} s`;
    }
  }
  requestAnimationFrame(slucka);
}

function prepniPrehravanie() {
  if (!stav) return;
  const c = casy(stav.sek);
  if (prehrava) {
    tPauza = ((performance.now() - zaciatok) / 1000) % c.dlzka;
    prehrava = false;
  } else {
    zaciatok = performance.now() - tPauza * 1000;
    prehrava = true;
  }
  $('prehraj').textContent = prehrava ? 'Pause' : 'Play';
  $('prehraj').setAttribute('aria-pressed', String(prehrava));
}

// --------------------------------------------------------------------------- správy

function ukaz(id, text, druh = '') {
  const el = $(id);
  el.textContent = text;
  el.className = 'pv-sprava' + (druh ? ' ' + druh : '');
  el.hidden = !text;
}

const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;

// --------------------------------------------------------------------------- výroba videa

// Prvky stránky pre každú z dvoch výrob (stranka.test.mjs overuje, že všetky id existujú).
const UI_STIAHNUTIE = { tlacidlo: 'vyrob', zrus: 'zrus-vyrobu', pokrok: 'pokrok', bar: 'pokrok-bar', text: 'pokrok-text', sprava: 'sprava-vyroba' };
const UI_TIKTOK = { tlacidlo: 'tiktok-vyrob', zrus: 'tiktok-zrus-vyrobu', pokrok: 'tiktok-pokrok', bar: 'tiktok-pokrok-bar', text: 'tiktok-pokrok-text', sprava: 'sprava-tiktok-vyroba' };

/** Vyrobí video z aktuálnych volieb. `kredit` false = kópia pre TikTok. Vráti výsledok alebo null. */
async function vyrobVariant(kredit, ui) {
  if (vyrobaBezi) return null;
  let v;
  try { v = citajVolby(); } catch (e) { return null; }
  vyrobaBezi = true;
  zrusVyrobu = false;
  stavTlacidielVyroby();
  $(ui.zrus).hidden = false;
  $(ui.pokrok).hidden = false;
  ukaz(ui.sprava, '');
  const pokrok = (x) => {
    $(ui.bar).value = x;
    $(ui.text).textContent = x >= 1 ? 'Finishing the file' : `Making the video, ${Math.round(x * 100)} %`;
  };
  pokrok(0);
  const zvuk = $('v-zvuk').checked;
  let vysledok = null;
  try {
    await nacitanie;
    if (!stav || !stav.zadanie || !stav.riesenie) throw new Error('obrazky');
    const snimka = { ...stav };
    const mimo = document.createElement('canvas');
    mimo.width = 1080;
    mimo.height = 1920;
    let zaloha = false;
    try {
      if (!(await vyberKodek())) throw new Error('webcodecs_h264_nie');
      vysledok = await vyrobMp4({ canvas: mimo, stav: snimka, zvuk, kredit, pokrok, zrusene: () => zrusVyrobu });
    } catch (e) {
      if (e && e.message === 'zrusene') throw e;
      if (!zaloznyTyp()) throw new Error('ziadne_kodovanie');
      zaloha = true;
      ukaz(ui.sprava, `This browser cannot make MP4 files by itself, so the video is being recorded in real time. It takes ${casy(v.sek).dlzka.toFixed(0)} seconds. Keep this tab in front until it is done.`, 'pozor');
      zaloznaBezi = true;
      vysledok = await vyrobZaloznou({ canvas: platno, stav: snimka, zvuk, kredit, pokrok, zrusene: () => zrusVyrobu });
    }
    ukaz(ui.sprava, kredit ? 'Done. Your video is below.' : 'Done. Watch the TikTok copy below before you send it.', 'ok');
    return { ...vysledok, url: URL.createObjectURL(vysledok.blob), volby: v, zaloha };
  } catch (e) {
    const kod = e && e.message;
    if (kod === 'zrusene') ukaz(ui.sprava, 'Stopped. Nothing was saved.');
    else if (kod === 'ziadne_kodovanie') ukaz(ui.sprava, 'This browser can neither encode video nor record the canvas. Please try a current Chrome, Edge, Firefox or Safari.', 'chyba');
    else if (kod === 'obrazky') ukaz(ui.sprava, 'The puzzle is still loading or could not be loaded. Wait a moment and try again.', 'chyba');
    else ukaz(ui.sprava, 'The video could not be made in this browser. Please try again, or try a current Chrome or Edge.', 'chyba');
    return null;
  } finally {
    vyrobaBezi = false;
    zaloznaBezi = false;
    $(ui.zrus).hidden = true;
    $(ui.pokrok).hidden = true;
    stavTlacidielVyroby();
    stavTikTok();
  }
}

function stavTlacidielVyroby() {
  $('vyrob').disabled = vyrobaBezi;
  $('tiktok-vyrob').disabled = vyrobaBezi || odosielaSa;
}

async function vyrob() {
  const vysledok = await vyrobVariant(true, UI_STIAHNUTIE);
  if (!vysledok) return;
  if (video && video.url) URL.revokeObjectURL(video.url);
  video = vysledok;
  zobrazHotove();
}

async function vyrobTikTokKopiu() {
  const vysledok = await vyrobVariant(false, UI_TIKTOK);
  if (!vysledok) return false;
  if (ttVideo && ttVideo.url) URL.revokeObjectURL(ttVideo.url);
  ttVideo = vysledok;
  zobrazTikTokKopiu();
  return true;
}

function popisFormatu(v) {
  return (v.typ === 'video/mp4' ? 'MP4' : 'WebM') + (v.zaloha ? ', recorded in real time' : ', H.264') + (v.zvuk ? ', with sound' : ', no sound');
}

function zobrazHotove() {
  const el = $('video');
  el.src = video.url;
  const meno = nazovSuboru(video.volby, video.pripona);
  $('stiahni').href = video.url;
  $('stiahni').download = meno;
  $('f-nazov').textContent = meno;
  $('f-velkost').textContent = mb(video.blob.size);
  $('f-dlzka').textContent = `${casy(video.volby.sek).dlzka.toFixed(1)} s, 1080 x 1920, 30 fps`;
  $('f-format').textContent = popisFormatu(video);
  if (video.zaloha) {
    ukaz('sprava-zaloha', video.typ === 'video/mp4'
      ? 'Recorded in real time, so a frame may be uneven if the tab lost focus. Watch it through before sharing.'
      : 'This is a WebM file, recorded in real time. TikTok and YouTube accept it; Instagram and some editors prefer MP4. If you need MP4, open this page in current Chrome or Edge.', 'pozor');
  } else {
    ukaz('sprava-zaloha', '');
  }
  $('hotove').hidden = false;
}

function zobrazTikTokKopiu() {
  $('tiktok-video').src = ttVideo.url;
  const v = ttVideo.volby;
  $('tiktok-kopia-popis').textContent = `TikTok copy: ${v.nazov}, ${v.obtiaznost}, number ${Number(v.cislo)}, ${v.sek} s countdown. ${mb(ttVideo.blob.size)}, ${popisFormatu(ttVideo)}.`;
  $('tiktok-kopia').hidden = false;
  // Súhlas patrí k videu, ktoré tvorca videl: nová kópia pred prihlásením ho chce znova.
  if (!relacia) $('suhlas').checked = false;
  if (ttVideo.blob.size > tt.MAX_VIDEO_BAJTOV) ukaz('sprava-tiktok', tt.sprava('video_too_large'), 'chyba');
  else ukaz('sprava-tiktok', '');
  stavTikTok();
}

// --------------------------------------------------------------------------- TikTok

const kanal = 'BroadcastChannel' in window ? new BroadcastChannel(tt.KANAL) : null;

function stavTikTok() {
  const cakaNaTikTok = !!(relacia && relacia.publishId);
  const moze = !!ttVideo && $('suhlas').checked && !relacia && !cakajuci && !odosielaSa && !vyrobaBezi && ttVideo.blob.size <= tt.MAX_VIDEO_BAJTOV;
  $('tiktok-prihlas').disabled = !moze;
  $('tiktok-najprv').hidden = !!ttVideo;
  $('potvrd').hidden = !relacia;
  $('tiktok-posli').hidden = cakaNaTikTok;
  $('tiktok-posli').disabled = !ttVideo || odosielaSa || vyrobaBezi || cakaNaTikTok;
  $('tiktok-znova').hidden = !cakaNaTikTok;
  $('tiktok-znova').disabled = odosielaSa;
  $('tiktok-zrus').disabled = odosielaSa;
  $('tiktok-zrus').textContent = cakaNaTikTok ? 'Revoke the permission now' : 'Cancel and sign out';
  stavTlacidielVyroby();
}

function ulozCakajuci(zaznam) {
  try { sessionStorage.setItem(ULOZENE, JSON.stringify(zaznam)); } catch (e) { /* bez úložiska ostane len okno */ }
}
function citajCakajuci() {
  try {
    const z = JSON.parse(sessionStorage.getItem(ULOZENE) || 'null');
    sessionStorage.removeItem(ULOZENE);
    return z && Date.now() - z.kedy < 10 * 60 * 1000 ? z : null;
  } catch (e) {
    return null;
  }
}

/** Požiada worker o zrušenie prístupu. Vráti true len vtedy, keď TikTok zrušenie potvrdil. */
async function zrusTicho(session) {
  try {
    const r = await tt.zrus(fetch, session);
    return r.revoked === true;
  } catch (e) {
    return false;
  }
}

/** Nevyužitá relácia: po 15 minútach sa už nahrať nedá, prístup zrušíme aj bez kliknutia. */
function naplanujVyprsanie() {
  clearTimeout(casovacRelacie);
  if (!relacia) return;
  casovacRelacie = setTimeout(async () => {
    if (!relacia || odosielaSa || relacia.publishId) return;
    const { session } = relacia;
    relacia = null;
    stavTikTok();
    const revoked = await zrusTicho(session);
    ukaz('sprava-tiktok', `${tt.sprava('session_expired')} ${tt.vetaPristupu(revoked)}`, 'pozor');
  }, Math.max(0, relacia.platiDo - Date.now()) + 1000);
}

let casovac = null;
async function prihlas() {
  if ($('tiktok-prihlas').disabled) return;
  // Okno treba otvoriť hneď v kliknutí, inak ho prehliadač zablokuje.
  let okno = null;
  try { okno = window.open('about:blank', 'arling-tiktok', 'popup=yes,width=520,height=780'); } catch (e) { okno = null; }
  $('tiktok-prihlas').disabled = true;
  ukaz('sprava-tiktok', 'Opening TikTok.');
  const verifier = tt.novyVerifier();
  let start;
  try {
    start = await tt.zacni(fetch, await tt.challengePre(verifier));
  } catch (e) {
    if (okno) okno.close();
    ukaz('sprava-tiktok', tt.sprava(e.kod), 'chyba');
    stavTikTok();
    return;
  }
  cakajuci = { state: start.state, verifier };
  const v = ttVideo.volby;
  ulozCakajuci({ state: start.state, verifier, volby: { druh: v.druh, obtiaznost: v.obtiaznost, cislo: Number(v.cislo), sek: v.sek }, zvuk: ttVideo.zvuk, kedy: Date.now() });
  clearTimeout(casovac);
  casovac = setTimeout(() => {
    if (!cakajuci) return;
    cakajuci = null;
    ukaz('sprava-tiktok', tt.sprava('timeout'), 'chyba');
    stavTikTok();
  }, 10 * 60 * 1000);
  if (!okno || okno.closed) {
    $('tiktok-tu-odkaz').href = start.authorizeUrl;
    $('tiktok-tu').hidden = false;
    ukaz('sprava-tiktok', tt.sprava('popup_blocked'), 'pozor');
    stavTikTok();
    return;
  }
  okno.location.href = start.authorizeUrl;
  ukaz('sprava-tiktok', 'Finish the sign-in in the TikTok window. This page waits for it.');
  stavTikTok();
}

function prijmiNavrat(d) {
  if (!d || d.typ !== 'navrat' || !cakajuci) return;
  if (!tt.stateSedi(cakajuci.state, d.state)) return;
  const { verifier } = cakajuci;
  cakajuci = null;
  clearTimeout(casovac);
  try { sessionStorage.removeItem(ULOZENE); } catch (e) { /* nič */ }
  if (kanal) kanal.postMessage({ typ: 'prijate', state: d.state });
  $('tiktok-tu').hidden = true;
  pokracujPoNavrate(d, verifier);
}

async function pokracujPoNavrate(navrat, verifier) {
  if (navrat.error) {
    ukaz('sprava-tiktok', navrat.error === 'access_denied' ? tt.sprava('access_denied') : tt.sprava('code_rejected'), 'chyba');
    stavTikTok();
    return false;
  }
  ukaz('sprava-tiktok', 'Checking the sign-in with TikTok.');
  try {
    const r = await tt.otvorRelaciu(fetch, { code: navrat.code, state: navrat.state, verifier });
    relacia = { session: r.session, meno: r.displayName || 'your TikTok account', platiDo: Date.now() + (r.expiresInSeconds || 900) * 1000, publishId: null };
    zrusenaPriOdchode = false;
    naplanujVyprsanie();
    $('tiktok-meno').textContent = relacia.meno;
    ukaz('sprava-tiktok', '');
    stavTikTok();
    $('potvrd').scrollIntoView({ block: 'nearest', behavior: pokojne ? 'auto' : 'smooth' });
    return true;
  } catch (e) {
    ukaz('sprava-tiktok', tt.sprava(e.kod), 'chyba');
    stavTikTok();
    return false;
  }
}

const cakaj = (ms) => new Promise((r) => setTimeout(r, ms));

async function posli() {
  if (!relacia || !ttVideo || odosielaSa || relacia.publishId) return;
  if (Date.now() > relacia.platiDo) {
    const { session } = relacia;
    relacia = null;
    stavTikTok();
    const revoked = await zrusTicho(session);
    ukaz('sprava-tiktok', `${tt.sprava('session_expired')} ${tt.vetaPristupu(revoked)}`, 'chyba');
    return;
  }
  odosielaSa = true;
  stavTikTok();
  ukaz('sprava-tiktok', `Sending ${mb(ttVideo.blob.size)} to TikTok. Keep this page open until TikTok confirms the draft.`);
  const { session } = relacia;
  let r;
  try {
    r = await tt.nahraj(fetch, { session, blob: ttVideo.blob });
  } catch (e) {
    odosielaSa = false;
    if (tt.CHYBY_VIDEA.includes(e.kod) || e.kod === 'network') {
      // Relácia ostáva: tvorca môže video vyrobiť znova alebo skúsiť znova. Zruší ju Cancel,
      // odchod zo stránky alebo koniec 15 minút (naplanujVyprsanie).
      ukaz('sprava-tiktok', tt.sprava(e.kod), 'chyba');
      stavTikTok();
      return;
    }
    relacia = null;
    stavTikTok();
    const revoked = e.revoked === true ? true : await zrusTicho(session);
    ukaz('sprava-tiktok', `${tt.sprava(e.kod)} ${tt.vetaPristupu(revoked)}`, 'chyba');
    return;
  }
  relacia.publishId = r.publishId;
  clearTimeout(casovacRelacie);
  await sleduj(r, CAKANIE_NA_TIKTOK_MS);
}

/** Pýta sa TikToku na stav, kým nie je koncový alebo neuplynie `trvanie`. Potom zruší prístup alebo čaká na tvorcu. */
async function sleduj(r, trvanie) {
  if (!relacia || !relacia.publishId) return;
  const { session, publishId } = relacia;
  odosielaSa = true;
  stavTikTok();
  const hotove = (x) => tt.KONCOVE_STAVY.includes(x.status);
  const koniec = Date.now() + trvanie;
  let pokus = 0;
  let chybySiete = 0;
  ukaz('sprava-tiktok', tt.vetaStavu(r.status, r.failReason), r.status === 'FAILED' ? 'chyba' : '');
  while (!hotove(r) && Date.now() < koniec) {
    await cakaj(pokus++ < 24 ? 5000 : 15000);
    try {
      r = { ...r, ...(await tt.zistiStav(fetch, { session, publishId })) };
      chybySiete = 0;
    } catch (e) {
      if (++chybySiete < 4) continue;
      break;
    }
    ukaz('sprava-tiktok', tt.vetaStavu(r.status, r.failReason), r.status === 'FAILED' ? 'chyba' : '');
  }
  odosielaSa = false;
  if (hotove(r)) {
    relacia = null;
    stavTikTok();
    const revoked = r.revoked === true ? true : await zrusTicho(session);
    ukaz('sprava-tiktok', `${tt.vetaStavu(r.status, r.failReason)} ${tt.vetaPristupu(revoked)}`, r.status === 'FAILED' ? 'chyba' : revoked ? 'ok' : 'pozor');
    return;
  }
  // Stále sa spracúva (alebo sa stav nedal zistiť): prístup nerušíme, rozhodne tvorca.
  ukaz('sprava-tiktok', `${tt.sprava('still_processing')} ${tt.vetaPristupu(null)} ${tt.sprava('still_processing_next')}`, 'pozor');
  stavTikTok();
}

async function skontrolujZnova() {
  if (!relacia || !relacia.publishId || odosielaSa) return;
  await sleduj({ publishId: relacia.publishId, status: 'PROCESSING_UPLOAD', revoked: false }, 5 * 60 * 1000);
}

async function odhlas() {
  if (!relacia || odosielaSa) return;
  const { session, publishId } = relacia;
  relacia = null;
  clearTimeout(casovacRelacie);
  stavTikTok();
  ukaz('sprava-tiktok', 'Revoking the permission.');
  const revoked = await zrusTicho(session);
  ukaz('sprava-tiktok', `${publishId ? 'Stopped waiting for TikTok.' : 'Signed out. Nothing was sent.'} ${tt.vetaPristupu(revoked)}`, revoked ? 'ok' : 'pozor');
}

// Karta sa zatvára alebo odchádza: prístup rušíme vždy, aj počas nahrávania a čakania na TikTok.
// Jednoduchá požiadavka s keepalive, aby ju prehliadač dokončil aj po zatvorení karty.
window.addEventListener('pagehide', () => {
  if (!relacia) return;
  try { fetch(...tt.poziadavkaZrusenia(relacia.session)); } catch (e) { /* nič */ }
  relacia = null;
  zrusenaPriOdchode = true;
  clearTimeout(casovacRelacie);
});
// Návrat z medzipamäte prehliadača (späť): relácia už bola zrušená pri odchode.
window.addEventListener('pageshow', (e) => {
  if (!e.persisted || !zrusenaPriOdchode) return;
  zrusenaPriOdchode = false;
  odosielaSa = false;
  ukaz('sprava-tiktok', 'We revoked the TikTok permission when you left this page. Sign in again to send a video.', 'pozor');
  stavTikTok();
});

/** Stránka sa otvorila ako návrat z TikToku (v okne alebo v tej istej karte). */
async function spracujNavrat(navrat) {
  let prijate = false;
  if (kanal) {
    const potvrdenie = new Promise((res) => {
      const h = (e) => { if (e.data && e.data.typ === 'prijate' && e.data.state === navrat.state) { prijate = true; res(); } };
      kanal.addEventListener('message', h);
      setTimeout(res, 1500);
    });
    kanal.postMessage({ typ: 'navrat', ...navrat });
    try { if (window.opener) window.opener.postMessage({ typ: 'navrat', ...navrat }, location.origin); } catch (e) { /* okno bez openera */ }
    await potvrdenie;
  }
  if (prijate) {
    ukaz('sprava-tiktok', 'Signed in. You can close this window; the Puzzle video maker continues in the other tab.', 'ok');
    $('tiktok').scrollIntoView();
    setTimeout(() => { try { window.close(); } catch (e) { /* nie naše okno */ } }, 600);
    return;
  }
  // Prihlásenie v tej istej karte: kópia zmizla s odchodom na TikTok, vyrobíme ju znova z tých istých volieb.
  const ulozene = citajCakajuci();
  if (!ulozene || !tt.stateSedi(ulozene.state, navrat.state)) {
    ukaz('sprava-tiktok', tt.sprava('state_mismatch'), 'chyba');
    return;
  }
  nastavVolby(ulozene.volby);
  $('v-zvuk').checked = !!ulozene.zvuk;
  aktualizuj();
  $('tiktok').scrollIntoView();
  if (!(await pokracujPoNavrate(navrat, ulozene.verifier))) return;
  ukaz('sprava-tiktok-vyroba', 'Making the TikTok copy again, because it stayed in the tab you left for TikTok.');
  await vyrobTikTokKopiu();
  if (relacia && ttVideo) ukaz('sprava-tiktok', `Your TikTok copy is ready again. Watch it above, then send it to ${relacia.meno}.`);
}

async function kopirujPopis() {
  const text = $('popis-kredit').textContent;
  try {
    await navigator.clipboard.writeText(text);
    $('kopiruj-popis').textContent = 'Copied';
  } catch (e) {
    $('kopiruj-popis').textContent = 'Select and copy it';
  }
  setTimeout(() => { $('kopiruj-popis').textContent = 'Copy'; }, 2500);
}

// --------------------------------------------------------------------------- štart

function zapoj() {
  for (const id of ['v-druh', 'v-obtiaznost', 'v-cislo']) $(id).addEventListener('change', aktualizuj);
  for (const r of document.querySelectorAll('input[name="sek"]')) r.addEventListener('change', aktualizuj);
  $('nahodny').addEventListener('click', () => { $('v-cislo').value = String(nahodneCislo()); aktualizuj(); });
  $('prehraj').addEventListener('click', prepniPrehravanie);
  $('ukaz-zony').addEventListener('change', (e) => { $('zony').hidden = !e.target.checked; });
  $('vyrob').addEventListener('click', vyrob);
  $('zrus-vyrobu').addEventListener('click', () => { zrusVyrobu = true; });
  $('tiktok-vyrob').addEventListener('click', vyrobTikTokKopiu);
  $('tiktok-zrus-vyrobu').addEventListener('click', () => { zrusVyrobu = true; });
  $('suhlas').addEventListener('change', stavTikTok);
  $('tiktok-prihlas').addEventListener('click', prihlas);
  $('tiktok-posli').addEventListener('click', posli);
  $('tiktok-znova').addEventListener('click', skontrolujZnova);
  $('tiktok-zrus').addEventListener('click', odhlas);
  $('kopiruj-popis').addEventListener('click', kopirujPopis);
  if (kanal) kanal.addEventListener('message', (e) => prijmiNavrat(e.data));
  window.addEventListener('message', (e) => { if (e.origin === location.origin) prijmiNavrat(e.data); });
  $('prehraj').textContent = prehrava ? 'Pause' : 'Play';
  $('prehraj').setAttribute('aria-pressed', String(prehrava));
}

async function start() {
  zapoj();
  const navrat = tt.precitajNavrat(location.search);
  if (navrat) history.replaceState(null, '', location.pathname + '#tiktok');
  else {
    const q = new URLSearchParams(location.search);
    if (q.has('kind')) nastavVolby({ druh: q.get('kind'), obtiaznost: q.get('difficulty') || 'easy', cislo: q.get('n') || 1, sek: Number(q.get('sek')) || 20 });
  }
  try { await document.fonts.load('700 88px "ARLing Sans"'); } catch (e) { /* systémové písmo */ }
  aktualizuj();
  requestAnimationFrame(slucka);
  stavTikTok();
  if (navrat) spracujNavrat(navrat);
}

start();
