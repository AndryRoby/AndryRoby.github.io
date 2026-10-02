// Daystone: karta na zdieľanie „We've been together 1,204 days“ kreslená v canvase,
// 9 : 16 (1080 x 1920, príbeh) a 1 : 1 (1080 x 1080, príspevok). Ten istý slnečný parapet
// a kamienky ako na stránke; meno páru len ak ho človek sám napíše, dátum začiatku nikdy.
import { kresliKamienok } from './kamienok.mjs';
import { cislo, vetaRokov } from './logika.mjs';

export const FORMATY = { '9x16': [1080, 1920], '1x1': [1080, 1080] };
const INK = '#2A2238', INK2 = '#5B5370';
const PISMO = '"ARLing Draw Text", system-ui, -apple-system, "Segoe UI", sans-serif';

export async function nacitajPismo() {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([document.fonts.load(`700 120px ${PISMO}`), document.fonts.load(`500 40px ${PISMO}`)]);
  } catch { /* systémové písmo stačí */ }
}

function text(ctx, t, x, y, velkost, vaha, farba, maxSirka) {
  let v = velkost;
  ctx.font = `${vaha} ${v}px ${PISMO}`;
  while (maxSirka && ctx.measureText(t).width > maxSirka && v > 12) {
    v -= 4;
    ctx.font = `${vaha} ${v}px ${PISMO}`;
  }
  ctx.fillStyle = farba;
  ctx.fillText(t, x, y);
}

function parapet(ctx, W, hore, hrubka) {
  ctx.fillStyle = '#F8EEE2';
  ctx.beginPath();
  ctx.moveTo(-10, hore); ctx.lineTo(W + 10, hore); ctx.lineTo(W + 10, hore + hrubka * 0.55); ctx.lineTo(-10, hore + hrubka * 0.55);
  ctx.fill();
  const g = ctx.createLinearGradient(0, hore + hrubka * 0.55, 0, hore + hrubka * 1.4);
  g.addColorStop(0, '#F0E2D2');
  g.addColorStop(1, '#E4D3C1');
  ctx.fillStyle = g;
  ctx.fillRect(-10, hore + hrubka * 0.55, W + 20, hrubka);
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0, hore + 2); ctx.lineTo(W, hore + 2); ctx.stroke();
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ dni:number, roky:number, zvysok:number, mena?:string, format:'9x16'|'1x1', kamene?:[string,number][] }} o
 */
export function kresliKartu(canvas, { dni, roky, zvysok, mena = '', format = '9x16', kamene }) {
  const [W, H] = FORMATY[format] || FORMATY['9x16'];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const stvorec = format === '1x1';

  const pozadie = ctx.createLinearGradient(0, 0, 0, H);
  pozadie.addColorStop(0, '#FFE2C7');
  pozadie.addColorStop(0.45, '#FFF3E6');
  pozadie.addColorStop(1, '#FFF9F2');
  ctx.fillStyle = pozadie;
  ctx.fillRect(0, 0, W, H);
  const slnko = ctx.createRadialGradient(W * 0.86, H * 0.06, 0, W * 0.86, H * 0.06, W * 0.62);
  slnko.addColorStop(0, 'rgba(255,236,190,.95)');
  slnko.addColorStop(0.35, 'rgba(255,224,170,.45)');
  slnko.addColorStop(1, 'rgba(255,224,170,0)');
  ctx.fillStyle = slnko;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const s = stvorec
    ? { mena: 150, veta: 240, cislo: 455, cisloV: 250, dni: 548, roky: 612, parapet: 890, k1: 190, k2: 165, paticka: 1040 }
    : { mena: 440, veta: 560, cislo: 840, cisloV: 330, dni: 950, roky: 1040, parapet: 1500, k1: 340, k2: 300, paticka: 1830 };

  if (mena) text(ctx, mena, W / 2, s.mena, stvorec ? 46 : 54, 600, INK2, W - 160);
  text(ctx, 'We’ve been together', W / 2, s.veta, stvorec ? 58 : 70, 600, INK, W - 140);
  text(ctx, cislo(dni), W / 2, s.cislo, s.cisloV, 700, INK, W - 120);
  text(ctx, dni === 1 ? 'day' : 'days', W / 2, s.dni, stvorec ? 72 : 88, 600, INK, W - 140);
  if (roky > 0) text(ctx, vetaRokov({ roky, dni: zvysok }), W / 2, s.roky, stvorec ? 38 : 46, 500, INK2, W - 160);

  parapet(ctx, W, s.parapet, stvorec ? 70 : 90);
  const [a, b] = kamene && kamene.length ? [kamene[0], kamene[1] || ['tense', 2]] : [['calm', 3], ['tense', 2]];
  const zem = (vel, spodok) => s.parapet + 18 - vel * spodok;
  // malé kamienky bez tváre okolo, potom vy dvaja
  kresliKamienok(ctx, 'okay', 2, W * 0.16, zem(84, 0.98), 84, { tvar: false });
  kresliKamienok(ctx, 'bright', 2, W * 0.75, zem(70, 0.98), 70, { tvar: false });
  kresliKamienok(ctx, 'low', 2, W * 0.81, zem(56, 0.98), 56, { tvar: false });
  kresliKamienok(ctx, a[0], a[1], W / 2 - s.k1 * 0.98, zem(s.k1, 0.93), s.k1);
  kresliKamienok(ctx, b[0], b[1], W / 2 + s.k1 * 0.02, zem(s.k2, 0.93), s.k2);

  text(ctx, 'arling.sk/daystone', W / 2, s.paticka, stvorec ? 34 : 40, 500, INK2);
}
