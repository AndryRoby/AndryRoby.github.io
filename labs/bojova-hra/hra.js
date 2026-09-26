// Tumble Dojo v3: zápas, menu, karta majstra, Kit, Record, koniec, úvod. ?demo&maj=0..5&dojo=0..5, ?meranie, ?nahravka
import { nova, kolo, zapas, krok, vstup, HZ, C, CH, ST, VYPAD, ZAPRENIE } from './sim.js';
import { novaAI, aiKrok, zacniKolo, UROVNE, BOT } from './ai.js';
import { MENA, VSTUP, POCET, PB, TH, ET, SP, DP, RP } from './kombo.js';
import * as V from './vstup.js';
import * as KR from './kresba.js';
import * as U from './ovladanie.js';
import * as Z from './zvuky.js';
import * as R from './zaznam.js';
import { MAJSTRI, parametre, gentleSmie, vyzorMajstra, vyzorAI, PAS, PAS_INK } from './majstri.js';

const $ = (id) => document.getElementById(id), q = location.search, par = new URLSearchParams(q);
const MER = q.includes('meranie'), DEMO = q.includes('demo'), UKAZ = q.includes('ovladanie') || q.includes('dotyk'), NAHR = q.includes('nahravka');
const DSEED = +(par.get('seed') || 0), DUR = UROVNE[par.get('uroven')] ? par.get('uroven') : 'hard';
const HBOT = MER && par.get('hrac') === 'bot';
const DMAJ = par.has('maj') ? Math.max(0, Math.min(5, +par.get('maj') | 0)) : -1, DDOJO = par.has('dojo') ? Math.max(0, Math.min(5, +par.get('dojo') | 0)) : -1;
const KROK = 1000 / HZ, s = zapas(nova()), stage = $('stage'), svet = $('svet'), hud = [$('hud'), $('hud2')];
const TICHO = matchMedia('(prefers-reduced-motion: reduce)').matches;
let rezim = 'ai', ai = null, bot = null, faza = 'menu', fazaPred = 'kolo', fazaT = 0, skore = [0, 0], tSim = 0, last = 0, lastHit = 0, lastEv = 0, lastVlna = 0, raf = 0;
let tras = 0, trasStr = '', koniecT = 0, zapasov = DSEED, svS = -1, stA = 0, plne = false, zoom = 0, tNahr = 0;
let maj = -1, gentle = false, obr = 'menu', kartaI = 5, slot = 'k', kitZad = false, kitVyber = '', klavesa = false, resetT = 0;
let retMax = 0, finN = 0, stN = 0;
const ted = () => (NAHR ? tNahr : performance.now());
const KC = new Int32Array(2 * 13), KN = new Int32Array(2), RET = new Int32Array(2), RETT = new Float64Array(2), SIL = new Int8Array(2).fill(-1);
const MB = new Int32Array(13), NZ = new Uint8Array(13);   // body majstra podľa kombinácie, nové kombinácie v zápase
const STOP = 70, ZN = 8, ZM = [[], [], []];
for (let t = 0; t < 3; t++) for (let z = 0; z <= ZN; z++) ZM[t].push((t === 1 ? 'translate(2px,0) ' : t === 2 ? 'translate(-2px,0) ' : '') + (z ? 'scale(' + (1 + 0.045 * z / ZN).toFixed(4) + ')' : ''));
const DIO = { menu: 1, karta: 1, kit: 1 }, ANIM = { menu: 1, karta: 1 };

// záznam a nastavenia (localStorage v try/catch)
let LS = null;
try { LS = window.localStorage; } catch (e) { LS = null; }
const Q = R.nacitaj(LS);
Object.assign(U.nastavenie, Q.n); Q.n = U.nastavenie;
const uloz = () => { if (!DEMO) R.uloz(LS, Q); };
const zaciatok = () => Q.h < 3;   // prvé 3 zápasy s popiskami tlačidiel
const hex = (n) => KR.inkRGB(n);
// C5: znak kombinácie vedľa mena (kreslí KR.ikona)
const ik = (k) => '<canvas class="ik" data-k="' + k + '" aria-hidden="true"></canvas>';
const ikony = (el, n) => el.querySelectorAll('canvas.ik').forEach((c) => KR.ikona(c, +c.dataset.k, n));

// HUD
function hudBody() { for (const h of hud) for (let p = 0; p < 2; p++) h.querySelectorAll('.p' + p + ' i').forEach((e, k) => e.classList.toggle('on', k < skore[p])); }
function svetla(n, go) {
  const kod = go ? 9 : n; if (kod === svS) return; svS = kod;
  for (const h of hud) h.querySelectorAll('.sv i').forEach((e, k) => { e.className = go ? 'go' : k < n ? 'on' : ''; });
}
function hudKomba(p) { for (const h of hud) h.querySelector('.c' + p).textContent = 'Combos ' + KN[p]; }
function hudSila(p, n) { for (const h of hud) h.querySelectorAll('.f' + p + ' i').forEach((e, k) => e.classList.toggle('on', k < n)); }
// návod na klávesy: [X] je kláves (<kbd>)
const LEG = {
  dojo: ['[W][A][S][D] walk', '[J] or [Space] tap or hold: lunge', '[K] brace', '[Q] [E] step', '[I] grab', '[O] stomp', '[Esc] pause'],
  classic: ['[Space] lunge', '[S] brace', '[A] [D] step', 'arrows walk', '[E] grab', '[R] stomp', '[Esc] pause'],
  dotyk: ['Hold, release: lunge', 'Pull back, hold: brace', 'Swipe sideways: step'],
  kl2: ['Left [W][A][S][D] walk [F] lunge [G] brace [H] step [R] grab [T] stomp', 'Right: arrows walk [K] lunge [L] brace [;] step [O] grab [P] stomp'],
  kl2c: ['Left [W] lunge [S] brace [A] [D] step', 'Right: [K] lunge [I] brace [J] [L] step']
};
const hrubyPrst = () => matchMedia('(pointer: coarse)').matches || U.bolDotyk();
function tlacidlaVidno() {
  return (faza !== 'menu') && U.nastavenie.controls === 'buttons' && (rezim === 'ai' || rezim === 'tel2' || rezim === 'demo' || rezim === 'uc') && (hrubyPrst() || UKAZ || (DEMO && innerWidth < 700));
}
// návod na klávesy len na počítači po prvej klávese, na dotyku nikdy (V3-NAVRH 0.1)
function legenda() {
  const kl = U.nastavenie.keys === 'classic';
  let l = [];
  if (rezim === 'kl2') l = kl ? LEG.kl2c : LEG.kl2;
  else if (rezim === 'demo' || rezim === 'uc' || tlacidlaVidno()) l = [];
  else if (hrubyPrst()) l = U.nastavenie.controls === 'swipes' ? LEG.dotyk : [];
  else if (rezim !== 'tel2' && klavesa) l = kl ? LEG.classic : LEG.dojo;
  $('leg').innerHTML = $('leg2').innerHTML = l.map((x) => '<span>' + x.replace(/\[(.+?)\]/g, '<kbd>$1</kbd>') + '</span>').join('');
  document.body.dataset.rezim = rezim;
  document.body.classList.toggle('tl', tlacidlaVidno());
}
// atrament strán do HUD a ovládania podľa kimona
function farby() {
  KR.strany();
  const r = document.documentElement.style;
  r.setProperty('--c0', hex(KR.K.ink[0])); r.setProperty('--c1', hex(KR.K.ink[1]));
  U.atrament(KR.K.ink[0], KR.K.ink[1]);
}

// zápas; r: 'ai' (majster m alebo voľná hra m = -1), 'kl2', 'tel2', 'demo', 'uc'
function hraj(r, m = -1, gen = false) {
  Z.priprav();
  rezim = r; V.nastav(r === 'demo' ? 'ai' : r === 'uc' ? 'ai' : r);
  maj = r === 'ai' ? m : r === 'demo' ? DMAJ : -1;
  gentle = r === 'ai' && maj >= 0 && gen && gentleSmie(maj, Q.lad.l[maj]);
  const K = KR.K;
  K.kit[0] = r === 'demo' ? Object.assign({}, R.KIT0) : Q.kit;
  K.kit[1] = maj >= 0 ? vyzorMajstra(maj, K.kit[0]) : vyzorAI(K.kit[0]);
  K.dojo = DDOJO >= 0 ? DDOJO : maj >= 0 ? maj : r === 'demo' ? 5 : Math.min(Q.lad.b, 5);
  K.znak = maj >= 0 ? MAJSTRI[maj].meno : ''; K.znakK = maj >= 0 ? MAJSTRI[maj].znak : 0; K.ticho = TICHO; K.jeden = false;
  farby();
  const u = r === 'demo' ? DUR : Q.u, p1 = maj >= 0 ? parametre(maj, gentle) : UROVNE[u];
  ai = r === 'ai' || r === 'demo' ? novaAI(1, p1, 7 + zapasov * 13) : null;
  // ?meranie&hrac=bot: za hráča hrá bot
  bot = r === 'demo' || (HBOT && r === 'ai') ? novaAI(0, BOT, 3 + zapasov * 11) : null;
  zapasov++; skore = [0, 0]; zapas(s); s.tren = r === 'uc'; KC.fill(0); KN.fill(0); RET.fill(0); SIL.fill(-1); MB.fill(0); NZ.fill(0);
  retMax = finN = stN = 0;
  hudBody(); hudKomba(0); hudKomba(1); hudSila(0, 0); hudSila(1, 0);
  for (const id of PANELY) $(id).hidden = true;
  document.body.classList.add('hra'); document.body.classList.remove('dio'); document.body.classList.toggle('gentle', gentle);
  $('demoL').hidden = r !== 'demo';
  if (r === 'demo') $('demoL').textContent = 'Demo: bot vs ' + (maj >= 0 ? 'the ' + MAJSTRI[maj].meno : 'the computer, ' + u[0].toUpperCase() + u.slice(1));
  $('uc').hidden = r !== 'uc';
  U.nastavPopisky(r === 'uc' || (r === 'ai' && maj === 0 && zaciatok()));
  faza = 'svetla'; obr = ''; legenda(); rozmer();
  if (r === 'uc') ucZacni();
  noveKolo(true); start();
}
function noveKolo(prve) {
  if (!prve) kolo(s);
  KR.zmaz(); KR.polohy(s); lastHit = s.hit; lastEv = s.evN; lastVlna = s.vlna;
  if (ai) zacniKolo(ai); if (bot) zacniKolo(bot);
  KR.K.vitaz = -1; koniecT = 0; faza = 'svetla'; fazaT = ted(); svetla(0, false);
  V.noveKolo();   // palce na skle ostávajú
}
function bod() {
  skore[s.win]++; hudBody(); faza = 'bod'; fazaT = ted();
  vib(s.win === 0 || rezim === 'tel2' ? 'bod' : 'strata', true);
  if (s.catK) {   // COMBO FINISH (C3)
    KR.banner(s.catK, s.win, 0, true); Z.hraj(13);
    const L = s.win ? s.a : s.b; KR.utrzky(L.x, L.y);
    if (s.win === 0) { finN++; if (s.catK === SP) stN++; } else MB[s.catK]++;
  }
  if (skore[s.win] >= 3) { faza = 'koniec'; KR.K.vitaz = s.win; vib('koniec', true); }
}
function zoznam(p, nove) {
  const o = [];
  for (let k = 1; k <= POCET; k++) if (KC[p * 13 + k]) o.push(k);
  o.sort((a, b) => KC[p * 13 + b] - KC[p * 13 + a]);
  return o.map((k) => '<li>' + ik(k) + MENA[k] + ' <b>x' + KC[p * 13 + k] + '</b>' + (nove && nove.includes(k) ? '<span class="n">NEW</span>' : '') + '</li>').join('') || '<li class="nic">No combos this time</li>';
}
const meno = (h) => { const v = R.VEC[KR.K.kit[h].k]; return v[1]; };
function koniec() {
  const w = skore[0] > skore[1] ? 0 : 1, vyhra = w === 0, sk = ' ' + skore[w] + ' : ' + skore[1 - w], pc = rezim === 'ai';
  let res = { nove: [], pas: -1, noveKombo: [] };
  if (pc) {
    const kc = new Int32Array(13); for (let k = 1; k <= POCET; k++) kc[k] = KC[k];
    res = R.zapisZapas(Q, { vyhra, sk: [skore[0], skore[1]], kc, fin: finN, ret: retMax, stomp: stN, maj, gentle });
    uloz(); U.nastavPopisky(false);
  } else if (rezim === 'kl2' || rezim === 'tel2') { R.zapisZapas(Q, { dvaja: true }); uloz(); }
  const mm = maj >= 0 ? 'The ' + MAJSTRI[maj].meno : 'The computer';
  $('kT').textContent = pc ? (vyhra ? 'You win' : mm + ' wins') + sk : (w ? meno(1) : meno(0)) + ' wins' + sk;
  $('kP').textContent = pc && !vyhra ? 'Both bow. Rematch?' : 'Both bow. Good match.';
  // odmeny vždy s presnou príčinou
  const od = $('kOdm'); od.innerHTML = '';
  for (const id of res.nove) {
    const li = document.createElement('li');
    li.innerHTML = '<canvas aria-hidden="true"></canvas><b></b><span></span>';
    li.querySelector('b').textContent = R.nazov(id); li.querySelector('span').textContent = R.preco(id);
    od.appendChild(li); KR.vzorka(li.querySelector('canvas'), id, Q.kit.k, false);
  }
  od.hidden = !res.nove.length;
  $('kCiel').textContent = pc ? R.ciel(Q.rec, Q.lad) : ''; $('kCiel').hidden = !pc;
  $('kN0').textContent = pc ? 'You' : meno(0); $('kN1').textContent = pc ? (maj >= 0 ? MAJSTRI[maj].meno : 'Computer') : meno(1);
  $('kL0').innerHTML = zoznam(0, res.noveKombo); $('kL1').innerHTML = zoznam(1, null); ikony($('koniec'), 20);
  let sum = rezim === 'demo' ? '' : 'Best chain x' + Math.max(1, retMax) + ', COMBO FINISH ' + finN + '.';
  if (pc && !vyhra && maj >= 0) { let bk = 0; for (let k = 1; k <= POCET; k++) if (MB[k] > MB[bk]) bk = k; if (bk) sum += ' ' + mm + ' scored most with ' + MENA[bk] + '.'; }
  $('kSum').textContent = sum;
  const dal = pc && vyhra && maj >= 0 && maj < 5 && maj < Q.lad.b;
  $('kDalsi').hidden = !dal; $('kBtns').className = 'btns ' + (dal ? 'dal' : 'dvoj');
  $('odveta').className = 'btn' + (dal ? '' : ' hl');
  document.body.classList.remove('hra');   // skóre je v nadpise
  $('koniec').hidden = false; $('koniec').scrollTop = 0; (dal ? $('kDalsi') : $('odveta')).focus({ preventScroll: true });
  U.zobraz(false);
}
const PANELY = ['menu', 'koniec', 'nast', 'moves', 'pauza', 'karta', 'kit', 'record', 'volna', 'dva'];
function panel(id) {
  faza = 'menu'; stop(); V.vycisti(); U.zobraz(false);
  document.body.classList.remove('hra', 'tl', 'gentle');
  for (const x of PANELY) $(x).hidden = x !== id;
  $('uc').hidden = true;
  svet.style.transform = trasStr = ''; zoom = 0; tras = 0;
  $('demoL').hidden = true;
  if (id === 'menu') menuNapis();
  obr = id;
  document.body.classList.toggle('dio', !!DIO[id]);
  if (DIO[id]) rozmerDio();
  const f = $(id).querySelector('button:not([disabled])'); if (f) f.focus({ preventScroll: true });
}
const menu = () => panel('menu');

// pauza: tlačidlo, Esc a návrat z inej aplikácie
function pauza() {
  if (faza === 'menu' || faza === 'pauza' || rezim === 'demo') return;
  fazaPred = faza; faza = 'pauza'; stop(); V.vycisti();
  $('pNote').hidden = rezim !== 'ai';
  $('pauza').hidden = false; $('pokracuj').focus({ preventScroll: true });
}
function pokracuj() {
  if (faza !== 'pauza') return;
  $('pauza').hidden = true; faza = fazaPred;
  const t = ted(); tSim = t; if (faza === 'svetla' || faza === 'bod') fazaT = t;
  start();
}

// vibrácie len pre hráča; dvaja na telefóne len kombinácie a body
function vib(meno, dolezite) { if (rezim === 'demo') return; if (rezim === 'tel2' && !dolezite) return; U.vib(meno); }

// udalosti zo simulácie
function udalosti(t) {
  while (lastEv < s.evN) {
    if (s.evN - lastEv > 64) lastEv = s.evN - 64;
    const i = (lastEv & 63) * 3, k = s.ev[i], p = s.ev[i + 1];
    lastEv++;
    KR.kombo(k, p, s);
    KC[p * 13 + k]++; KN[p]++; hudKomba(p);
    if (t - RETT[p] < 1500) RET[p]++; else RET[p] = 0;
    RETT[p] = t;
    if (p === 0 && RET[0] + 1 > retMax) retMax = RET[0] + 1;
    // C4 NEW MOVE, C6 znak majstra, C1 DOUBLE a RUNNING PUSH len malé meno
    const nov = p === 0 && rezim === 'ai' && !Q.rec.k[k - 1] && !NZ[k], zn = p === 1 && maj >= 0 && k === KR.K.znakK;
    if (nov) NZ[k] = 1;
    if ((k !== DP && k !== RP) || nov) KR.banner(k, p, RET[p] + 1, false, nov ? 1 : zn ? 2 : 0);
    if (k !== SP) Z.hraj(k);
    if (p === 0 || rezim === 'tel2') vib(k === PB ? 'perfekt' : k === TH || k === ET || k === SP ? 'velky' : 'kombo', true);
    tSim += STOP;   // zastavenie a priblíženie
    if (!TICHO) {
      const m = p ? s.b : s.a, K = KR.K;
      svet.style.transformOrigin = (K.cx + m.x * K.S).toFixed(0) + 'px ' + (K.cy + m.y * K.S * 0.8).toFixed(0) + 'px';
      zoom = ZN;
    }
  }
  if (s.vlna !== lastVlna) {
    lastVlna = s.vlna; KR.vlna(s); Z.hraj(12); tras = TICHO ? 0 : 6;
    if (!s.vHit) KR.banner(13, s.vP, 0, false);   // dupnutie minulo: sivé MISS
  }
  for (let p = 0; p < 2; p++) { const n = p ? s.b.sila : s.a.sila; if (n !== SIL[p]) { SIL[p] = n; hudSila(p, n); } }
}

// meranie: intervaly snímok a čas JS; FL: 1 náraz, 2 kombinácia, 4 bod alebo nové kolo, 8 vstup
const MN = 8192, IV = new Float32Array(MN), JS = new Float32Array(MN), FL = new Uint8Array(MN);
let mn = 0, mT = 0, fl = 0;
if (MER || DEMO || NAHR) window.__bojova = { IV, JS, FL, s, get n() { return mn; }, reset() { mn = 0; }, get faza() { return faza; }, get skore() { return skore.join(':'); }, get komba() { return KN[0] + KN[1]; },
  get uc() { return UC.krok; }, snimka(t) { slucka(t); }, get obr() { return obr; } };

// úvod: 4 kroky, asi 45 s
const UC = { krok: 0, d: 0, lx: 0, ly: 0, od: 0, drzi: false };
const UCT = [
  ['Drag on the left side to walk.', 'Walk with W A S D.'],
  ['Tap LUNGE to push. Hold it longer to push harder.', 'Tap J to push. Hold it longer to push harder.'],
  ['They are charging a lunge. Hold BRACE so they bounce off.', 'They are charging a lunge. Hold K so they bounce off.'],
  ['Walk up close. Tap GRAB, then STEP right away: THROW.', 'Walk up close. Press I, then Q or E right away: THROW.'],
  ['Combos OPEN your rival for a moment. Push them out within 2 seconds for a COMBO FINISH.', 'Combos OPEN your rival for a moment. Push them out within 2 seconds for a COMBO FINISH.']
];
function ucText() {
  const d = hrubyPrst() ? 0 : 1, k = UC.krok;
  $('ucT').textContent = k === 3 && UC.drzi ? (d ? 'Holding. Now Q or E!' : 'Holding. Now tap STEP!') : UCT[k][d];
  $('ucN').textContent = k < 4 ? 'Step ' + (k + 1) + ' of 4' : 'Ready for the Hedgehog';
  $('ucHraj').hidden = k < 4; $('ucSkip').hidden = k >= 4;
}
function ucZacni() { UC.krok = 0; UC.d = 0; UC.lx = s.a.x; UC.ly = s.a.y; UC.od = 0; UC.drzi = false; ucText(); }
function ucDalej() {
  UC.krok++; UC.od = s.step; UC.drzi = false; Z.hraj(1); vib('kombo', true); ucText();
  if (UC.krok >= 1 && UC.krok <= 3) ucReset();
}
function ucReset() {
  kolo(s); s.tren = true;
  if (UC.krok === 1) s.b.y = s.b.py = s.a.y - 0.45;   // na výpad stojí tréner bližšie
  KR.zmaz(); KR.polohy(s); lastHit = s.hit; lastEv = s.evN; lastVlna = s.vlna; UC.od = 0; UC.lx = s.a.x; UC.ly = s.a.y; }
// tréner: v kroku 2 sa viditeľne nabíja a vypáli, inak stojí
function trener() { // HOT
  const f = s.step % 170, drz = UC.krok === 2 && f >= 20 && f < 62;
  vstup(s, 1, drz, false, 0, false, false, 0, 0);
}
function ucenie() {
  const a = s.a, b = s.b, k = UC.krok;
  if (k === 0) {
    const dx = a.x - UC.lx, dy = a.y - UC.ly; UC.d += Math.sqrt(dx * dx + dy * dy); UC.lx = a.x; UC.ly = a.y;
    if (UC.d > 0.3) ucDalej();
  } else if (k === 1) { if (b.hitBy === VYPAD && b.hitAt >= UC.od && b.hitAt > 0) ucDalej(); }
  else if (k === 2) { if (b.hitBy === ZAPRENIE && b.hitAt >= UC.od && b.hitAt > 0 && b.st === ST) ucDalej(); }
  else if (k === 3) {
    const d = a.st === 14;   // GH: držíš súpera za pás
    if (d !== UC.drzi) { UC.drzi = d; ucText(); }
    if (s.kc[TH]) ucDalej();
  }
}
function ucKoniec(hned) { Q.uc = true; uloz(); if (hned) hraj('ai', 0); }

function vstupy() { // HOT
  if (bot) { aiKrok(bot, s); U.ukaz(0, s.a.inH, s.a.inB, bot.side, bot.grab, bot.stomp, Math.round(s.a.jx * 127), Math.round(s.a.jy * 127)); }
  else { vstup(s, 0, V.H[0], V.B[0], V.SIDE[0], V.G[0] > 0, V.P[0] > 0, V.JX[0], V.JY[0]); V.SIDE[0] = 0; V.G[0] = 0; V.P[0] = 0; }
  if (ai) aiKrok(ai, s);
  else if (rezim === 'uc') trener();
  else { vstup(s, 1, V.H[1], V.B[1], V.SIDE[1], V.G[1] > 0, V.P[1] > 0, V.JX[1], V.JY[1]); V.SIDE[1] = 0; V.G[1] = 0; V.P[1] = 0; }
}
function slucka(t) { // HOT
  if (NAHR) tNahr = t; else raf = requestAnimationFrame(slucka);
  const t0 = performance.now(), dt = last ? (t - last) / 1000 : 0; last = t;
  if (faza === 'svetla') {
    const n = Math.floor((t - fazaT) / 520);
    if (n < 3) svetla(n + 1, false); else { svetla(3, true); faza = 'kolo'; tSim = fazaT = t; }
  } else if (faza === 'kolo' && t - fazaT > 450) svetla(0, false);
  if (faza === 'kolo' || faza === 'bod' || faza === 'koniec') {
    let n = 0;
    while (tSim + KROK <= t && n < 30) {
      const tk = tSim + KROK;
      if (V.doKroku(tk)) fl |= 8;
      if (faza === 'kolo') vstupy();
      const st0 = s.a.st;
      krok(s); tSim = tk; n++;
      if (s.hit !== lastHit) { lastHit = s.hit; KR.naraz(s); Z.hraj(0); tras = TICHO ? 0 : 4; vib(s.hv > 1.5 ? 'silny' : 'tuk', false); fl |= 1; }
      if (s.a.st === ST && st0 !== ST && rezim !== 'tel2') vib('strata', false);
      if (s.evN !== lastEv || s.vlna !== lastVlna || s.a.sila !== SIL[0] || s.b.sila !== SIL[1]) { udalosti(t); fl |= 2; }
      if (faza === 'kolo' && s.win >= 0) { if (rezim === 'uc') ucReset(); else bod(); fl |= 4; }
    }
    if (n === 30) tSim = t;
    if (rezim === 'uc' && faza === 'kolo') ucenie();
    if (faza === 'bod' && t - fazaT > 1400) { noveKolo(false); fl |= 4; }
    if (faza === 'koniec') {
      koniecT += dt; KR.K.koniec = koniecT;
      if (koniecT > 2.3 && $('koniec').hidden) { if (DEMO && !NAHR) hraj('demo'); else if (!DEMO) koniec(); }
      if (koniecT > 5 && !NAHR) stop();
    }
  }
  // plné nabitie výpadu: krátka vibrácia
  const pl = s.a.st === CH && s.a.ch >= C.CH1;
  if (pl && !plne) vib('nabite', false);
  plne = pl;
  // trasenie a priblíženie (nie pri zníženom pohybe)
  const tr = ZM[tras > 0 ? 1 + (tras & 1) : 0][zoom];
  if (tras > 0) tras--;
  if (zoom > 0) zoom--;
  if (tr !== trasStr) { svet.style.transform = tr; trasStr = tr; }
  KR.ring(s.rr);
  const a = faza === 'svetla' ? 1 : (t - tSim) / KROK;
  KR.snimka(s, a > 1 ? 1 : a < 0 ? 0 : a, t / 1000, dt > 0.1 ? 0.1 : dt, faza === 'koniec' ? koniecT : 0);
  // OPEN: súper otvorený mojou kombináciou, obrys Lunge bliká (C2)
  U.stav(0, s.a.st === CH ? 1 + Math.floor(11 * s.a.ch / C.CH1) : 0, s.a.sila >= 3 ? 1 : 0, s.b.opU >= s.step && faza === 'kolo');
  U.stav(1, s.b.st === CH ? 1 + Math.floor(11 * s.b.ch / C.CH1) : 0, s.b.sila >= 3 ? 1 : 0, s.a.opU >= s.step && faza === 'kolo');
  U.kresli(t);
  if (MER || DEMO) {
    if (dt > 0 && mn < MN) { IV[mn] = dt * 1000; JS[mn] = performance.now() - t0; FL[mn] = fl; mn++; }
    fl = 0;
    if (MER && t - mT > 1000) {
      mT = t; const k = Math.min(mn, 120); let sum = 0, mx = 0, js = 0;
      for (let i = mn - k; i < mn; i++) { sum += IV[i]; mx = Math.max(mx, IV[i]); js += JS[i]; }
      $('mer').textContent = (1000 * k / sum).toFixed(0) + ' fps, max ' + mx.toFixed(1) + ' ms, JS ' + (js / k).toFixed(2) + ' ms';
    }
  }
}
function start() { if (!raf && !NAHR) { last = 0; raf = requestAnimationFrame(slucka); } }
function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

// animácie diorámy (V3-NAVRH 3.4): len menu a karta, 12 snímok za s, po 40 s bez vstupu stoja, pri zníženom pohybe nebežia
let dioRaf = 0, dioT = 0, dioF = -1;
function dioSlucka(t) { // HOT
  if (faza !== 'menu' || !ANIM[obr] || t - dioT > 40000) { dioRaf = 0; return; }
  dioRaf = requestAnimationFrame(dioSlucka);
  const f = Math.floor(t / 83.3);
  if (f !== dioF) { dioF = f; KR.dioKresli(f / 12); }
}
function dioStart() { dioT = performance.now(); if (!dioRaf && !TICHO && faza === 'menu' && ANIM[obr]) dioRaf = requestAnimationFrame(dioSlucka); }
addEventListener('pointerdown', dioStart, true); addEventListener('keydown', dioStart);

// rozloženie: ring medzi HUD a pásom ovládania
function okraj(v) { const x = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(v)); return x > 0 ? x : 0; }
function rozmer() {
  if (faza === 'menu' && DIO[obr]) { rozmerDio(); return; }
  if (faza === 'menu') return;
  const W = innerWidth, H = innerHeight, d = Math.min(2, devicePixelRatio || 1), tl = tlacidlaVidno();
  U.okraje(okraj('--sat'), okraj('--sab'), okraj('--sal'), okraj('--sar'));
  let hore = W < 700 ? 96 : 116, dole = 84, pas = 0, pasTop = 0;
  const rl = rezim === 'demo' || rezim === 'uc' ? 'ai' : rezim;
  if (rezim === 'uc' && H > 500) hore = 184;   // úvod má hore výzvu
  if (rezim === 'tel2') { pas = tl ? U.vyskaPasu(W, H, rl) : 0; hore = dole = pas + 84; }
  else if (tl && H > W) { const v = U.vyskaPasu(W, H, rl); dole = Math.max(Math.min(300, H * 0.36), v); pasTop = H - v + 8; }
  else if (H < 500) { hore = 92; dole = tl ? 12 : 44; }     // telefón na šírku: ovládanie v rohoch
  KR.K.dvaja = rezim === 'tel2'; KR.K.jeden = false;
  KR.priprav(W, H, d, hore, dole, pasTop, { bezBokov: tl }); V.rozmer(W, H);   // pod tlačidlami žiadne drobnosti sveta
  U.priprav($('ui'), W, H, d, rl); U.zobraz(tl);
  document.documentElement.style.setProperty('--pas', pas + 'px');
  KR.polohy(s); KR.snimka(s, 1, 0, 0, 0);
}
// dioráma menu, karty a Kit: dojo nad panelom (na šírku vľavo od neho)
function scenaDio() {
  kolo(s);
  const a = s.a, b = s.b;
  if (obr === 'kit') { a.x = a.px = 0; a.y = a.py = 0; a.fx = 0; a.fy = kitZad ? -1 : 1; b.x = b.px = 9; }
  else { a.x = a.px = -0.34; b.x = b.px = 0.34; a.y = a.py = b.y = b.py = 0.08; a.fx = b.fx = 0; a.fy = b.fy = 1; }
}
function rozmerDio() {
  const W = innerWidth, H = innerHeight, d = Math.min(2, devicePixelRatio || 1), land = W >= H, pn = $(obr), K = KR.K;
  const i = obr === 'karta' ? kartaI : Math.min(Q.lad.b, 5);
  K.kit[0] = Q.kit; K.kit[1] = vyzorMajstra(i, Q.kit); K.dojo = i; K.dvaja = false; K.jeden = obr === 'kit'; K.znak = ''; K.vitaz = -1; K.koniec = 0;
  const pw = land ? pn.offsetWidth + 48 : 0, Wv = W - pw, T = land ? H : Math.max(H - pn.offsetHeight - 24, H * 0.24);
  const o = { pravo: pw, stena: T * (land ? 0.46 : 0.5), cx: Wv / 2, anim: !TICHO && !!ANIM[obr] };
  if (obr === 'kit') { o.S = Math.min(1.1 * T, 1.6 * Wv, 640); o.stena = T * 0.42; o.cy = T * 0.52 + 0.9 * C.R * o.S * 1.2; o.bezRingu = true; }
  else { o.S = Math.min(Wv * 0.34, (T - o.stena) * 0.58); o.cy = o.stena + o.S * 0.76; }
  farby();
  KR.priprav(W, H, d, 0, 0, 0, o);
  U.zobraz(false);
  scenaDio(); KR.zmaz(); KR.polohy(s); KR.snimka(s, 1, 0, 0, 0);
  if (o.anim) { dioF = -1; dioStart(); }
}
let rT = 0;
addEventListener('resize', () => { cancelAnimationFrame(rT); rT = requestAnimationFrame(rozmer); });
document.addEventListener('visibilitychange', () => {
  if (DEMO) { if (document.hidden) stop(); else if (faza !== 'menu') { tSim = fazaT = performance.now(); start(); } return; }
  if (document.hidden) pauza();   // po návrate z inej aplikácie čaká pauza
});
// prvý dotyk: ukáž tlačidlá, návod na klávesy preč
stage.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch' || stA) return;
  stA = 1; U.aktivuj();
  if (faza !== 'menu') { legenda(); if (!U.zobrazene() && tlacidlaVidno()) { rozmer(); if (rezim === 'uc') ucText(); } }
}, true);
// Kit: ťuk na postavu ju otočí chrbtom
stage.addEventListener('click', () => { if (faza === 'menu' && obr === 'kit') { kitZad = !kitZad; rozmerDio(); } });
V.pripoj(stage, () => faza !== 'menu' && faza !== 'pauza');

// menu: pásy, najbližší majster
function pasyHTML(tlacidla) {
  const b = Q.lad.b; let h = '';
  for (let i = 0; i < 6; i++) {
    const c = i < b ? 'ok' : i === b ? 'nx' : '', m = MAJSTRI[i].meno, stav = i < b ? 'beaten' : i === b ? 'next' : 'locked';
    const a = PAS[i] + ' belt, the ' + m + ', ' + stav;
    h += tlacidla ? '<button type="button" class="' + c + '" data-i="' + i + '" style="--b:' + hex(PAS_INK[i]) + '" aria-label="' + a + '"><i></i></button>'
      : '<span class="' + c + '" style="--b:' + hex(PAS_INK[i]) + '" title="' + a + '"><i></i></span>';
  }
  return h;
}
function menuNapis() {
  const b = Q.lad.b;
  $('pasy').innerHTML = pasyHTML(true);
  $('mNext').textContent = !Q.uc ? 'A 45 second intro first, then your first master: the Hedgehog.'
    : b >= 6 ? 'All six belts. Tap a belt to visit that dojo again.' : 'Next: the ' + MAJSTRI[b].meno + '. Win for the ' + PAS[b].toLowerCase() + ' belt.';
  $('lvlN').hidden = !zaciatok();
}
$('pasy').addEventListener('click', (e) => {
  const x = e.target.closest('button'); if (!x) return;
  const i = +x.dataset.i;
  if (i <= Q.lad.b && Q.uc) karta(i); else $('mNext').textContent = i ? 'Beat the ' + MAJSTRI[i - 1].meno + ' first.' : 'Take the 45 second intro first.';
});
// hlavné tlačidlo: najbližší majster; karta pri prvom stretnutí, po 2 prehrách a po Crane
$('hrajAI').onclick = () => {
  if (!Q.uc) { hraj('uc'); return; }
  const i = Math.min(Q.lad.b, 5);
  if (Q.lad.b >= 6 || !(Q.mk & (1 << i)) || Q.lad.l[i] >= 2) karta(Q.lad.b >= 6 ? kartaI : i); else hraj('ai', i, false);
};

// karta majstra
function karta(i) {
  kartaI = i; Q.mk |= 1 << i; uloz();
  const m = MAJSTRI[i], l = Q.lad.l[i], hotovo = i < Q.lad.b, pas = PAS[i].toLowerCase();
  $('kaN').textContent = (i + 1) + ' of 6' + (hotovo ? ', beaten' : '');
  $('kaM').textContent = 'The ' + m.meno; $('kaV').textContent = m.veta;
  $('kaZ').innerHTML = ik(m.znak) + MENA[m.znak]; ikony($('kaZ'), 20);
  $('kaTip').textContent = m.tip; $('kaTip').className = l >= 2 ? 'hi' : '';
  $('kaW').textContent = hotovo ? 'You hold the ' + pas + ' belt. A win still counts in your Record.'
    : 'The ' + pas + ' belt' + (i < 5 ? ', and the ' + MAJSTRI[i + 1].meno + "'s dojo opens." : ', and the white kimono.');
  const g = gentleSmie(i, l);
  $('kaGentle').hidden = !g; $('kaG').hidden = !g;
  $('kaG').textContent = 'Gentle: the ' + m.meno + ' reacts slower and tries fewer combos. A win still counts.';
  $('kaPred').disabled = i === 0; $('kaDal').disabled = i >= 5 || i + 1 > Q.lad.b;
  panel('karta');
}
$('kaHraj').onclick = () => hraj('ai', kartaI, false);
$('kaGentle').onclick = () => hraj('ai', kartaI, true);
$('kaPred').onclick = () => { if (kartaI > 0) karta(kartaI - 1); };
$('kaDal').onclick = () => { if (kartaI < 5 && kartaI + 1 <= Q.lad.b) karta(kartaI + 1); };
$('kaSpat').onclick = () => menu();
$('kDalsi').onclick = () => karta(Math.min(5, maj + 1));

// Kit
function kitPlnenie() {
  const o = R.odomknute(Q.rec, Q.lad), sl = R.SLOTY.find((x) => x[0] === slot)[1];
  $('slot').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === slot)));
  const veci = R.VECI.filter((v) => v[0][0] === slot);
  $('vzr').innerHTML = veci.map((v) => {
    const zam = !o[v[0]], nw = !zam && v[4] && !Q.seen.includes(v[0]);
    return '<button type="button" data-id="' + v[0] + '" aria-pressed="' + (Q.kit[slot] === v[0]) + '" aria-label="' + v[1] + ' ' + sl.toLowerCase() + (zam ? ', locked' : '') + '"><canvas aria-hidden="true"></canvas>' + (nw ? '<span class="nw">NEW</span>' : '') + '</button>';
  }).join('');
  $('vzr').querySelectorAll('button').forEach((b) => KR.vzorka(b.querySelector('canvas'), b.dataset.id, Q.kit.k, !o[b.dataset.id]));
  kitText(kitVyber && kitVyber[0] === slot ? kitVyber : Q.kit[slot], o);
  // NEW sa ukáže raz
  let zmena = false;
  for (const v of veci) if (o[v[0]] && v[4] && !Q.seen.includes(v[0])) { Q.seen.push(v[0]); zmena = true; }
  if (zmena) uloz();
}
function kitText(id, o) {
  const v = R.VEC[id], sl = R.SLOTY.find((x) => x[0] === id[0])[1].toLowerCase();
  if (o[id]) $('kitT').innerHTML = '<b></b> ' + (Q.kit[id[0]] === id ? 'Worn.' : 'Tap to wear.');
  else { const [m, t] = R.postup(id, Q.rec, Q.lad); $('kitT').innerHTML = '<b></b> Locked: ' + v[3] + (t > 1 ? '. ' + m + ' of ' + t : '.'); }
  $('kitT').querySelector('b').textContent = v[1] + ' ' + sl + '.';
}
$('slot').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; slot = b.dataset.v; kitVyber = ''; kitPlnenie(); });
$('vzr').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const id = b.dataset.id, o = R.odomknute(Q.rec, Q.lad); kitVyber = id;
  if (o[id] && Q.kit[slot] !== id) {
    Q.kit[slot] = id; uloz();
    $('vzr').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.id === id)));
    if (slot === 'k') $('vzr').querySelectorAll('button').forEach((x) => KR.vzorka(x.querySelector('canvas'), x.dataset.id, Q.kit.k, !o[x.dataset.id]));
    rozmerDio();
  }
  kitText(id, o);
});
$('kitBtn').onclick = () => { kitZad = false; kitVyber = ''; panel('kit'); kitPlnenie(); rozmerDio(); };
$('kitOk').onclick = () => menu();

// Record
function record() {
  const r = Q.rec, l = Q.lad, g = l.g.reduce((a, b) => a + b, 0);
  const riadky = [['Matches', r.m, 'Two players', r.pv], ['Wins', r.w, 'Clean wins 3 : 0', r.cl], ['Win streak now', r.s, 'Best streak', r.bs],
    ['Combos landed', r.c, 'COMBO FINISH', r.f], ['Longest chain', r.ch ? 'x' + r.ch : '0', 'Stomp points', r.st]];
  if (g) riadky.push(['Gentle wins', g, '', '']);
  $('recTab').innerHTML = riadky.map((x) => '<tr><td>' + x[0] + '</td><td>' + x[1] + '</td><td>' + x[2] + '</td><td>' + x[3] + '</td></tr>').join('');
  $('recB').textContent = l.b + ' of 6 masters';
  $('recP').innerHTML = pasyHTML(false);
  let n = 0, h = '';
  const d = hrubyPrst() && U.nastavenie.controls === 'buttons' ? 0 : 1;
  for (let k = 1; k <= POCET; k++) {
    const c = r.k[k - 1]; if (c) n++;
    h += '<li' + (c ? '' : ' class="nie"') + '>' + ik(k) + '<span>' + MENA[k] + (c ? '' : '<small>' + VSTUP[k][d] + '</small>') + '</span><b>' + (c ? 'x' + c : '---') + '</b></li>';
  }
  $('recM').innerHTML = h; $('recMN').textContent = n + ' of 12'; ikony($('recM'), 18);
  $('recU').textContent = Q.ukl ? 'Progress stays in this browser. Nothing is sent.' : 'This browser is not saving progress, so it resets when you close the tab.';
  $('recReset').textContent = 'Reset record'; resetT = 0;
}
$('recBtn').onclick = () => { record(); panel('record'); };
$('recOk').onclick = () => menu();
$('recReset').onclick = () => {
  if (!resetT) { resetT = 1; $('recReset').textContent = 'Tap again to reset everything'; return; }
  R.resetuj(Q); Q.mk = 0; uloz(); record();
};

// voľná hra, dvaja, nastavenia, Moves
function segmenty() {
  document.querySelectorAll('.seg[data-k]').forEach((sg) => {
    const k = sg.dataset.k, v = k === 'level' ? Q.u : String(U.nastavenie[k]);
    sg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  });
  $('opa').value = Math.round(U.nastavenie.opacity * 100);
}
document.querySelectorAll('.seg[data-k]').forEach((sg) => sg.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const k = sg.dataset.k, v = b.dataset.v;
  if (k === 'level') { Q.u = v; Q.uv = true; } else U.nastavenie[k] = v === 'true' ? true : v === 'false' ? false : v;
  uloz(); segmenty(); movesPlnenie();
}));
$('opa').addEventListener('input', () => { U.nastavenie.opacity = $('opa').value / 100; uloz(); });
function movesPlnenie() {
  const d = hrubyPrst() && U.nastavenie.controls === 'buttons' ? 0 : 1;
  let h = '';
  for (let k = 1; k <= POCET; k++) h += '<li>' + ik(k) + '<b>' + MENA[k] + '</b><span>' + VSTUP[k][d] + '</span></li>';
  $('mL').innerHTML = h; ikony($('mL'), 26);
  $('mD').textContent = (d ? 'Keys shown for Dojo keys. On a phone, the buttons do the same.' : 'Buttons shown. On a keyboard, press any key in a match to see the key list.') + ' Most combos leave the rival OPEN (a dashed ring at their feet): push them out within 2 seconds for a COMBO FINISH. Throw, Belt Push and Pull Through push them on their own.';
}
$('volnaBtn').onclick = () => { segmenty(); panel('volna'); };
$('volnaHraj').onclick = () => hraj('ai', -1);
$('volnaSpat').onclick = $('dvaSpat').onclick = () => menu();
$('dvaBtn').onclick = () => panel('dva');
$('ucBtn').onclick = () => hraj('uc');
$('ucSkip').onclick = () => ucKoniec(true);
$('ucHraj').onclick = () => ucKoniec(true);
$('hrajKl').onclick = () => hraj('kl2');
$('hrajTel').onclick = () => hraj('tel2');
$('odveta').onclick = () => hraj(rezim, maj, gentle);
$('doMenu').onclick = $('pMenu').onclick = menu;
$('menuBtn').onclick = $('menuBtn2').onclick = pauza;
$('pokracuj').onclick = pokracuj;
$('pOdveta').onclick = () => hraj(rezim, maj, gentle);
$('nastBtn').onclick = () => { segmenty(); panel('nast'); };
$('movesBtn').onclick = () => { movesPlnenie(); panel('moves'); };
$('nastOk').onclick = $('movesOk').onclick = menu;
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape') { if (!klavesa) { klavesa = true; if (faza !== 'menu' && !hrubyPrst()) legenda(); } return; }
  if (!$('koniec').hidden) menu(); else if (faza === 'pauza') pokracuj(); else if (faza !== 'menu') pauza(); else menu();
});
$('mer').hidden = !MER;
if (!U.maVibracie()) $('rVib').hidden = true;
segmenty();
if (UKAZ) U.dotykPrisiel();
if (DEMO) hraj('demo'); else panel('menu');
if (document.fonts && document.fonts.load) document.fonts.load('800 16px "ARLing Sans"').then(() => { KR.mena(); if (faza === 'menu' && DIO[obr]) rozmerDio(); else if (faza !== 'menu') U.priprav($('ui'), innerWidth, innerHeight, Math.min(2, devicePixelRatio || 1), rezim === 'demo' || rezim === 'uc' ? 'ai' : rezim); }).catch(() => {});
