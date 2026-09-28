// Stop at the right frame: hra v prehliadači. Rovnaké jadro ako videá (jadro.js), predmet sa kreslí po celých
// snímkach pri 60 fps (aj na 120 Hz displeji), ťuk zastaví práve zobrazenú snímku, takže čo vidíš, to sa hodnotí.
import { uroven, poloha, vyhodnot, vetaVysledku, kresliPredmet, kresliObrys, POCET, FPS, SW, MENA } from './jadro.js';

const Y0 = 380, VYSKA = 920; // výrez sveta 1080 x 920 (y 380 až 1300, všetky ciele ležia vnútri)
const $ = (s) => document.querySelector(s);
const platno = $('#stop-platno'), ctx = platno.getContext('2d');
const el = {
  uroven: $('#stop-uroven'), obt: $('#stop-obt'), stop: $('#stop-tlacidlo'), vysledok: $('#stop-vysledok'), veta: $('#stop-veta'),
  pod: $('#stop-pod'), znova: $('#stop-znova'), dalsia: $('#stop-dalsia'), zdielaj: $('#stop-zdielaj'), pred: $('#stop-pred'), po: $('#stop-po'),
  zvuk: $('#stop-zvuk'), skore: $('#stop-skore'),
};

const KLUC = 'arling-stop-v1';
let ulozene = { najlepsie: {} };
try { ulozene = JSON.parse(localStorage.getItem(KLUC)) || ulozene; } catch { /* súkromné okno */ }
const uloz = () => { try { localStorage.setItem(KLUC, JSON.stringify(ulozene)); } catch { /* nič */ } };

let U = null, t0 = 0, bezi = false, zobrazena = -1, zastavena = null, zvukZap = true, ac = null, poslednyZvuk = -1;
const q = Number(new URLSearchParams(location.search).get('l'));
let n = q >= 1 && q <= POCET ? Math.floor(q) : 1;

// ---------- zvuk (Web Audio, až po prvom ťuknutí) ----------
function audio() {
  if (!zvukZap) return null;
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function ton(f, dl, hlas, typ = 'sine', f2) {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(), k = a.currentTime;
  o.type = typ; o.frequency.setValueAtTime(f, k); if (f2) o.frequency.exponentialRampToValueAtTime(f2, k + dl);
  g.gain.setValueAtTime(0, k); g.gain.linearRampToValueAtTime(hlas, k + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, k + dl);
  o.connect(g).connect(a.destination); o.start(k); o.stop(k + dl + 0.02);
}
const zvon = (f, h = 0.12) => { ton(f, 1.1, h); ton(f * 2.76, 0.4, h * 0.25); };

// ---------- kreslenie ----------
let pozadie = null;
function rozmer() {
  const dpr = Math.min(2, window.devicePixelRatio || 1), w = platno.clientWidth;
  platno.width = Math.round(w * dpr); platno.height = Math.round(w * (VYSKA / SW) * dpr);
  pozadie = null; kresli(zobrazena);
}
function kresliPozadie(c, w, h) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#141c46'); g.addColorStop(0.55, '#0b1131'); g.addColorStop(1, '#060816');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  const z = c.createRadialGradient(w * 0.25, h * 0.2, 0, w * 0.25, h * 0.2, w * 0.9);
  z.addColorStop(0, 'rgba(52,224,170,0.10)'); z.addColorStop(1, 'rgba(52,224,170,0)');
  c.fillStyle = z; c.fillRect(0, 0, w, h);
  const y = c.createRadialGradient(w * 0.8, h * 0.85, 0, w * 0.8, h * 0.85, w * 0.9);
  y.addColorStop(0, 'rgba(181,123,255,0.10)'); y.addColorStop(1, 'rgba(181,123,255,0)');
  c.fillStyle = y; c.fillRect(0, 0, w, h);
}
function kresli(f) {
  if (!U) return;
  const m = platno.width / SW;
  if (!pozadie) { pozadie = document.createElement('canvas'); pozadie.width = platno.width; pozadie.height = platno.height; kresliPozadie(pozadie.getContext('2d'), platno.width, platno.height); }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(pozadie, 0, 0);
  ctx.setTransform(m, 0, 0, m, 0, -Y0 * m);
  const p = f >= 0 ? poloha(U, f) : null;
  const zasah = p && Math.abs(f - U.ciel) <= U.tolerancia ? 1 : 0;
  kresliObrys(ctx, U, { cas: performance.now() / 1000, zasah });
  kresliPredmet(ctx, U, p, m);
  if (!bezi && zastavena != null && p && !zasah) { // kde mal byť: slabý zlatý obrys cieľa je už nakreslený, pridaj šípku rozdielu
    ctx.strokeStyle = 'rgba(232,199,122,0.8)'; ctx.lineWidth = 5; ctx.setLineDash([14, 12]);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(U.obrys.x, U.obrys.y); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.font = `600 36px "ARLing Sans", system-ui, sans-serif`; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(244,239,228,0.66)';
  if (f >= 0 && p) ctx.fillText(`frame ${String(f).padStart(3, '0')}`, 1010, Y0 + 60);
}

// ---------- priebeh ----------
function nacitaj(k) {
  n = k; U = uroven(n); zastavena = null; zobrazena = -1; poslednyZvuk = -1;
  el.uroven.textContent = `Level ${n}`; el.obt.textContent = U.obtiaznost; el.obt.dataset.obt = U.obtiaznost.toLowerCase();
  el.pred.disabled = n <= 1; el.po.disabled = n >= POCET;
  const url = new URL(location.href); url.searchParams.set('l', n); history.replaceState(null, '', url);
  skore(); spusti();
}
function spusti() {
  el.vysledok.hidden = true; el.stop.hidden = false; zastavena = null;
  bezi = true; t0 = performance.now() + 450; requestAnimationFrame(slucka);
}
function slucka(now) {
  if (!bezi) return;
  const g = Math.floor(((now - t0) * FPS) / 1000);
  const f = g < 0 ? -1 : g % U.cyklus;
  if (f !== zobrazena) {
    zobrazena = f; kresli(f);
    if (f >= 0 && f !== poslednyZvuk) {
      poslednyZvuk = f; const o = f - U.ciel;
      if ([-40, -28, -19, -12, -7, -3].includes(o)) ton(1300 + (40 + o) * 12, 0.035, 0.05, 'triangle');
      if (o === 0) zvon(1318.5, 0.08);
    }
  }
  requestAnimationFrame(slucka);
}
function zastav() {
  if (!bezi) return;
  audio();
  bezi = false; zastavena = zobrazena;
  const na = poloha(U, zastavena);
  const v = vyhodnot(U, zastavena);
  if (v.sadne) { zvon(1318.5, 0.13); setTimeout(() => zvon(1975.5, 0.1), 70); } else ton(180, 0.2, 0.18, 'sine', 90);
  kresli(zastavena);
  el.stop.hidden = true; el.vysledok.hidden = false;
  el.vysledok.dataset.sadne = v.sadne ? '1' : '0';
  el.veta.textContent = !na ? `The ${MENA[U.predmet]} was not even on screen.` : vetaVysledku(v.od);
  el.pod.textContent = v.presne ? 'That is the one frame. Screenshot it.' : v.sadne ? `Inside the window. ${U.tolerancia ? 'Three frames fit on Easy.' : ''}` : U.tolerancia ? 'Three frames fit on Easy. Try again.' : 'Only one frame fits on Impossible.';
  const d = na ? Math.abs(v.od) : 999, b = ulozene.najlepsie[n];
  if (b == null || d < b) { ulozene.najlepsie[n] = d; uloz(); }
  skore();
  el.dalsia.hidden = n >= POCET; el.znova.focus({ preventScroll: true });
}
function skore() {
  const hodnoty = Object.entries(ulozene.najlepsie);
  const presne = hodnoty.filter(([, d]) => d === 0).length;
  const b = ulozene.najlepsie[n];
  el.skore.textContent = `Perfect frames: ${presne} of ${POCET}.` + (b != null && b < 999 ? ` Your best on this level: ${b === 0 ? 'perfect' : b + ' off'}.` : '');
}

// ---------- zdieľanie výsledku ako obrázok ----------
async function zdielaj() {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  kresliPozadie(x, W, H);
  x.save(); x.translate(0, 620 - U.obrys.y);
  const p = poloha(U, zastavena), zasah = p && Math.abs(zastavena - U.ciel) <= U.tolerancia ? 1 : 0;
  kresliObrys(x, U, { zasah }); kresliPredmet(x, U, p, 1);
  x.restore();
  const v = vyhodnot(U, zastavena);
  x.textAlign = 'center'; x.fillStyle = '#f4efe4';
  x.font = '700 64px "ARLing Sans", system-ui, sans-serif'; x.fillText('Stop at the right frame', W / 2, 130);
  x.font = '700 46px "ARLing Sans", system-ui, sans-serif'; x.fillStyle = U.tazka ? '#ff4f5e' : '#34e0aa'; x.fillText(`Level ${n} · ${U.obtiaznost}`, W / 2, 205);
  x.fillStyle = v.sadne ? '#e8c77a' : '#f4efe4'; x.font = '700 76px "ARLing Sans", system-ui, sans-serif';
  x.fillText(p ? vetaVysledku(v.od) : 'Missed it completely.', W / 2, 1110);
  x.fillStyle = 'rgba(244,239,228,0.7)'; x.font = '600 44px "ARLing Sans", system-ui, sans-serif'; x.fillText(`Can you beat it? arling.sk/stop?l=${n}`, W / 2, 1200);
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
  const subor = new File([blob], `stop-level-${n}.png`, { type: 'image/png' });
  const text = `Level ${n} (${U.obtiaznost}): ${p ? vetaVysledku(v.od) : 'missed'} Can you beat it? https://arling.sk/stop?l=${n}`;
  try {
    if (navigator.canShare && navigator.canShare({ files: [subor] })) { await navigator.share({ files: [subor], text }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = subor.name; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ---------- ovládanie ----------
el.stop.addEventListener('click', zastav);
platno.addEventListener('pointerdown', (e) => { if (bezi) { e.preventDefault(); zastav(); } });
document.addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input,textarea')) return;
  if ((e.code === 'Space' || e.code === 'Enter') && bezi) { e.preventDefault(); zastav(); }
});
el.znova.addEventListener('click', () => { audio(); spusti(); });
el.dalsia.addEventListener('click', () => { audio(); nacitaj(Math.min(POCET, n + 1)); });
el.pred.addEventListener('click', () => nacitaj(Math.max(1, n - 1)));
el.po.addEventListener('click', () => nacitaj(Math.min(POCET, n + 1)));
el.zdielaj.addEventListener('click', zdielaj);
el.zvuk.addEventListener('click', () => { zvukZap = !zvukZap; el.zvuk.setAttribute('aria-pressed', String(zvukZap)); el.zvuk.textContent = zvukZap ? 'Sound on' : 'Sound off'; });
document.addEventListener('visibilitychange', () => { if (document.hidden && bezi) { bezi = false; el.vysledok.hidden = true; } else if (!document.hidden && !bezi && zastavena == null) spusti(); });
window.addEventListener('resize', rozmer);
document.fonts.load('700 40px "ARLing Sans"').finally(() => { nacitaj(n); rozmer(); });
