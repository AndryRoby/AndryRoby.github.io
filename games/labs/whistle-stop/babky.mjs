/* Whistle Stop: chodci ako papierové bábky zo 6 dielov (GDD 4.3).
   Každý diel sa nakreslí RAZ do malého plátna pre kombináciu kostýmu; snímka potom len posúva a otáča hotové
   diely cez drawImage s transformáciou. V ceste snímky (krokBabky, kresliBabku) sa nič nealokuje.
   Súradnice dielov sú v jednotkách postavy: výška H = 130, chodidlá na y = 0, hore je záporné y. */

export const H = 130;
export const DIELY = ['rukaZ', 'nohaZ', 'nohaP', 'trup', 'hlava', 'rukaP'];   // poradie kreslenia (zadné prvé, kabát cez nohy)
export const KLOBUKY = ['siroky', 'burinka', 'sombrero', 'capica', 'satka'];
export const KABATY = ['prachovnik', 'vesta', 'poncho', 'saty', 'zastera', 'kabatik'];
const BOK = { x: 0, y: -60 }, RAMENO = { x: 0, y: -98 }, KRK = { x: 0, y: -104 };
export const KROK_DLZKA = 0.283 * H;          // krok 34 px pri výške 120 px
export const UHOL_NOHY = 22 * Math.PI / 180, UHOL_RUKY = 14 * Math.PI / 180;

// deterministické semienko (mulberry32)
export function nahoda(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Kostým zo semienka: klobúk, kabát, výška 0,9 až 1,1, dve plochy z palety (bez karikatúr, GDD 1.2).
export function kostym(seed) {
  const r = nahoda(seed);
  const plochy = ['drevo', 'skala', 'salvia', 'hlina', 'piesok', 'nebo'];
  const kabat = plochy[Math.floor(r() * plochy.length)];
  let druha = plochy[Math.floor(r() * plochy.length)];
  if (druha === kabat) druha = 'hlina';
  return {
    klobuk: Math.floor(r() * KLOBUKY.length), kabat: Math.floor(r() * KABATY.length),
    vyska: 0.9 + r() * 0.2, farbaKabat: kabat, farbaNohy: druha, farbaKlobuk: r() < 0.5 ? 'atrament' : 'hlina',
    pokozka: ['#D9A27A', '#B7825C', '#8E5E3F', '#E8BF98'][Math.floor(r() * 4)]
  };
}

// Uhly dielov pri fáze chôdze (radiány): nohy v protifáze, ruky opačne ako nohy, trup hore a dole.
export function pozaChodze(faza) {
  const s = Math.sin(2 * Math.PI * faza);
  return { nohaP: UHOL_NOHY * s, nohaZ: -UHOL_NOHY * s, rukaP: -UHOL_RUKY * s, rukaZ: UHOL_RUKY * s, bob: -2 * Math.abs(s) };
}

// ---------- kreslenie dielov do plátien (raz na kostým a mierku) ----------

function obrys(ctx, P, sirka) { ctx.lineWidth = sirka; ctx.strokeStyle = P.atrament; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
function klb(ctx, P, x, y) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fillStyle = P.papier; ctx.fill(); obrys(ctx, P, 1.2); }

// Každý diel: obdĺžnik (v jednotkách postavy) okolo kĺbu, ktorý je bodom otáčania, a kresliaca funkcia.
const TVARY = {
  nohaP: { x0: -9, y0: -4, x1: 12, y1: 62, piv: BOK, kresli: noha },
  nohaZ: { x0: -9, y0: -4, x1: 12, y1: 62, piv: BOK, kresli: noha },
  rukaP: { x0: -7, y0: -5, x1: 7, y1: 46, piv: RAMENO, kresli: ruka },
  rukaZ: { x0: -7, y0: -5, x1: 7, y1: 46, piv: RAMENO, kresli: ruka },
  trup: { x0: -22, y0: -8, x1: 22, y1: 64, piv: KRK, kresli: trup },
  hlava: { x0: -30, y0: -44, x1: 30, y1: 6, piv: KRK, kresli: hlava }
};

function noha(ctx, P, k, zadna) {
  ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.lineTo(5, 50); ctx.lineTo(-5, 50); ctx.closePath();
  ctx.fillStyle = zadna ? P.atrament : P[k.farbaNohy]; ctx.fill(); obrys(ctx, P, 2.4);
  ctx.beginPath(); ctx.moveTo(-6, 50); ctx.lineTo(10, 50); ctx.lineTo(10, 58); ctx.lineTo(-6, 58); ctx.closePath();
  ctx.fillStyle = P.hlina; ctx.fill(); obrys(ctx, P, 2.4);
}
function ruka(ctx, P, k, zadna) {
  ctx.beginPath(); ctx.moveTo(-4.5, 0); ctx.lineTo(4.5, 0); ctx.lineTo(3.5, 36); ctx.lineTo(-3.5, 36); ctx.closePath();
  ctx.fillStyle = zadna ? P.hlina : P[k.farbaKabat]; ctx.fill(); obrys(ctx, P, 2.4);
  ctx.beginPath(); ctx.arc(0, 40, 4.5, 0, Math.PI * 2); ctx.fillStyle = k.pokozka; ctx.fill(); obrys(ctx, P, 2);
}
function trup(ctx, P, k) {
  const typ = KABATY[k.kabat];
  const dlzka = typ === 'prachovnik' || typ === 'saty' ? 62 : typ === 'poncho' ? 50 : 46;
  const spodok = typ === 'saty' || typ === 'poncho' ? 20 : 14;
  ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.lineTo(spodok, dlzka); ctx.lineTo(-spodok, dlzka); ctx.closePath();
  ctx.fillStyle = P[k.farbaKabat]; ctx.fill(); obrys(ctx, P, 2.4);
  if (typ === 'vesta' || typ === 'kabatik') { ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, dlzka - 2); obrys(ctx, P, 2); }
  if (typ === 'zastera') { ctx.beginPath(); ctx.rect(-8, 20, 16, dlzka - 18); ctx.fillStyle = P.papier; ctx.fill(); obrys(ctx, P, 2); }
  if (typ === 'poncho') { ctx.beginPath(); ctx.moveTo(-15, 30); ctx.lineTo(15, 30); obrys(ctx, P, 2); }
  klb(ctx, P, 0, 6);
}
function hlava(ctx, P, k) {
  ctx.beginPath(); ctx.arc(0, -12, 10, 0, Math.PI * 2); ctx.fillStyle = k.pokozka; ctx.fill(); obrys(ctx, P, 2.4);
  ctx.beginPath(); ctx.arc(5, -13, 1.6, 0, Math.PI * 2); ctx.fillStyle = P.atrament; ctx.fill();
  const c = P[k.farbaKlobuk];
  const typ = KLOBUKY[k.klobuk];
  ctx.beginPath();
  if (typ === 'siroky') { ctx.rect(-17, -22, 34, 4); ctx.moveTo(-9, -22); ctx.lineTo(-7, -33); ctx.lineTo(7, -33); ctx.lineTo(9, -22); }
  else if (typ === 'burinka') { ctx.rect(-12, -22, 24, 3); ctx.moveTo(-8, -22); ctx.arc(0, -22, 8, Math.PI, 0); }
  else if (typ === 'sombrero') { ctx.ellipse(0, -21, 26, 4, 0, 0, Math.PI * 2); ctx.moveTo(-7, -21); ctx.lineTo(-5, -36); ctx.lineTo(5, -36); ctx.lineTo(7, -21); }
  else if (typ === 'capica') { ctx.moveTo(-10, -18); ctx.arc(0, -18, 10, Math.PI, 0); ctx.lineTo(16, -18); ctx.lineTo(16, -16); ctx.lineTo(-10, -16); }
  else { ctx.moveTo(-10, -16); ctx.arc(0, -16, 10.5, Math.PI, 0); ctx.lineTo(-10, -16); ctx.moveTo(-10, -18); ctx.lineTo(-18, -8); ctx.lineTo(-12, -14); }
  ctx.fillStyle = c; ctx.fill(); obrys(ctx, P, 2.4);
}

// Vrece múky (tovar General Store), nesie ho predná ruka.
const VRECE = { x0: -14, y0: -4, x1: 14, y1: 30 };
function vrece(ctx, P) {
  ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.lineTo(11, 24); ctx.quadraticCurveTo(0, 30, -11, 24); ctx.closePath();
  ctx.fillStyle = P.papier; ctx.fill(); obrys(ctx, P, 2.4);
  ctx.beginPath(); ctx.moveTo(-5, 14); ctx.lineTo(5, 14); obrys(ctx, P, 1.6);
}

// Vytvorí plátna dielov pre kostým. platno(w, h) je továreň (prehliadač: OffscreenCanvas alebo <canvas>;
// test: falošné plátno). s = pixely na jednotku postavy. Vracia { diely: {meno: {c, ox, oy, w, h}}, vrece }.
export function spriteKostymu(k, P, s, platno) {
  const out = { diely: {}, vrece: null, vyska: k.vyska, s };
  const urob = (t, kresli) => {
    const w = Math.ceil((t.x1 - t.x0) * s) + 4, h = Math.ceil((t.y1 - t.y0) * s) + 4;
    const c = platno(w, h), ctx = c.getContext('2d');
    ctx.setTransform(s, 0, 0, s, -t.x0 * s + 2, -t.y0 * s + 2);
    kresli(ctx);
    return { c, ox: -t.x0 * s + 2, oy: -t.y0 * s + 2, w, h };
  };
  for (const meno of DIELY) {
    const t = TVARY[meno];
    out.diely[meno] = urob(t, (ctx) => t.kresli(ctx, P, k, meno.endsWith('Z')));
  }
  out.vrece = urob(VRECE, (ctx) => vrece(ctx, P));
  return out;
}

// Pivot každého dielu vo vnútri postavy (kde sa pripína na trup).
export const PIVOT = { nohaP: BOK, nohaZ: BOK, rukaP: RAMENO, rukaZ: RAMENO, trup: KRK, hlava: KRK };

// ---------- stav chodca a krok (bez alokácií) ----------

export function novyChodec(i) {
  return { i, aktivny: false, x: 0, y: 96, smer: 1, v: 45, faza: 0, kostym: 0, stav: 0, cas: 0, cielX: 0, nesie: false,
    hy: 0, hv: 0, bob: 0, stojiDo: 0, dvereX: 0, sluzba: false, krokZem: false };
}
// IDE chodí, K_DVERAM ide k obchodu, RAD čaká pred dverami, HORE vystúpi na chodník k dverám, DNU je v obchode
// (vidno ho vo výklade), PULT stojí pri pulte búdy, VON vyjde s tovarom, STOJI sa zastavil na ulici.
export const STAV = { IDE: 0, K_DVERAM: 1, DNU: 2, STOJI: 3, HORE: 4, VON: 5, RAD: 6, PULT: 7 };

// Posun chodca o dt: chôdza, dosadnutie klobúka pružinou (tuhosť 400, tlmenie 0,6), zastavenie s dohojdaním.
// Vracia true, ak noha práve dopadla (hra tam môže pustiť obláčik prachu).
export function krokBabky(b, dt, rychlostMierka = 1) {
  let dopad = false;
  if (b.stav === STAV.IDE || b.stav === STAV.K_DVERAM) {
    const pred = Math.sin(2 * Math.PI * b.faza);
    b.x += b.smer * b.v * dt * rychlostMierka;
    b.faza += (b.v * dt * rychlostMierka) / (KROK_DLZKA * 2);
    if (b.faza > 1e6) b.faza -= 1e6;
    const po = Math.sin(2 * Math.PI * b.faza);
    dopad = (pred < 0) !== (po < 0);
    b.bob = -2 * Math.abs(po);
  } else {
    // v stoji sa faza vracia k najbližšej neutrálnej polohe (dohojdanie jedným kmitom)
    const ciel = Math.round(b.faza * 2) / 2;
    b.faza += (ciel - b.faza) * Math.min(1, dt * 8);
    b.bob += (0 - b.bob) * Math.min(1, dt * 10);
  }
  const k = 400, c = 2 * 0.6 * Math.sqrt(k);
  const a = -k * (b.hy - b.bob) - c * b.hv;
  b.hv += a * dt; b.hy += b.hv * dt;
  return dopad;
}

// Nakreslí bábku. X, Y = chodidlá na obrazovke v px, m = px na jednotku postavy (už s DPR).
// Poradie dielov je DIELY; vrece je na prednej ruke. Iba setTransform, translate, rotate a drawImage.
export function kresliBabku(ctx, spr, b, X, Y, m) {
  const s = b.smer, v = spr.vyska * m;
  const sn = Math.sin(2 * Math.PI * b.faza);
  for (let i = 0; i < DIELY.length; i++) {
    const meno = DIELY[i], d = spr.diely[meno], p = PIVOT[meno];
    let uhol = 0, dy = b.bob;
    if (meno === 'nohaP') uhol = UHOL_NOHY * sn;
    else if (meno === 'nohaZ') uhol = -UHOL_NOHY * sn;
    else if (meno === 'rukaP') uhol = b.nesie ? -0.35 : -UHOL_RUKY * sn;
    else if (meno === 'rukaZ') uhol = UHOL_RUKY * sn;
    if (meno === 'hlava') dy = b.hy;
    if (meno === 'nohaP' || meno === 'nohaZ') dy = 0;
    ctx.setTransform(s * v, 0, 0, v, X, Y);
    ctx.translate(p.x + (meno === 'nohaZ' || meno === 'rukaZ' ? -3 : 0), p.y + dy);
    ctx.rotate(uhol);
    ctx.drawImage(d.c, -d.ox / spr.s, -d.oy / spr.s, d.w / spr.s, d.h / spr.s);
    if (meno === 'rukaP' && b.nesie) {
      const vr = spr.vrece;
      ctx.drawImage(vr.c, -vr.ox / spr.s, 40 - vr.oy / spr.s, vr.w / spr.s, vr.h / spr.s);
    }
  }
}
