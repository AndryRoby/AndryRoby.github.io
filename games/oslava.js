/* Oslava po vyriešení hry: konfety z canvasu a krátky pulz plochy.
 *
 * Zdieľané pre všetkých desať hier (Hedgehogs, Magpies, Otters, Cranes,
 * Swans, Voles, Squirrels, Herons, Badgers, Hares). Každá hra si tento súbor
 * importuje priamo (`import { oslava } from '../oslava.js';`), žiadna
 * knižnica, žiadny zvuk.
 *
 * Volá sa presne raz, v okamihu, keď sa hra prvýkrát prepne do stavu
 * vyriešené (v skontroluj(), keď vráti true). Pri načítaní dňa, ktorý je už
 * vyriešený, sa oslava nevolá, len sa ukáže panel výsledku.
 *
 * export function oslava(kontajner, { redukovany })
 *   kontajner  prvok, ktorý sa krátko pulzne zväčší (typicky .hra, obal celej
 *              hry aj s ovládaním, nie len samotná doska). Konfety padajú cez
 *              to, čo je z neho práve vidno na obrazovke (position:fixed,
 *              orezané na priesečník jeho hraníc s viewportom): .hra býva na
 *              mobile oveľa vyššia než jedna obrazovka, takže canvas veľkosti
 *              celého kontajnera by prvé sekundy padal mimo toho, na čo sa
 *              hráč práve pozerá.
 *   redukovany ak je true, nespustí sa ani pulz ani konfety, len sa vráti;
 *              volajúci sem dáva `matchMedia('(prefers-reduced-motion: reduce)').matches`
 *              alebo vypnuté nastavenie Celebration (alebo oboje naraz cez ||).
 */
const TRVANIE_KONFET = 2500;
const TRVANIE_PULZU = 300;
const POCET_MIN = 120;
const POCET_MAX = 180;

/* Farby paper systému: oranžová akcent, krémová a tlmené hnedé. */
const FARBY = ['#f2643c', '#ffb59d', '#f6f4ef', '#e9e5dc', '#8a7f6d', '#5c5347'];

export function oslava(kontajner, volby) {
  if (!kontajner) return;
  const redukovany = !!(volby && volby.redukovany);
  pulzni(kontajner, redukovany);
  if (redukovany) return;
  konfety(kontajner);
}

function pulzni(kontajner, redukovany) {
  if (redukovany) return;
  kontajner.classList.add('oslava-pulz');
  setTimeout(() => kontajner.classList.remove('oslava-pulz'), TRVANIE_PULZU);
}

/* Konfety kreslí canvas pripnutý na obrazovku (position:fixed, pripojený k
 * <body>), veľkosťou orezaný na to, čo je z kontajnera práve vidno vo
 * viewporte. Dôvod: .hra je na mobile oveľa vyššia ako jedna obrazovka
 * (doska, ovládanie, panel výsledku, Share, nastavenia), takže canvas
 * veľkosti celého kontajnera by padal väčšinu 2,5 sekundy mimo toho, čo hráč
 * v tej chvíli vidí. Keď je vidno menej než kúsok obrazovky (kontajner je
 * práve odscrollovaný preč), konfety jednoducho vynechajú celú obrazovku. */
function konfety(kontajner) {
  let ctx;
  const r = kontajner.getBoundingClientRect();
  const left = Math.max(0, r.left);
  const top = Math.max(0, r.top);
  const right = Math.min(window.innerWidth, r.right);
  const bottom = Math.min(window.innerHeight, r.bottom);
  const sirka = right - left, vyska = bottom - top;
  if (sirka < 20 || vyska < 20) return;   // container is not really on screen

  const canvas = document.createElement('canvas');
  canvas.className = 'oslava-konfety';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.position = 'fixed';
  canvas.style.left = left + 'px';
  canvas.style.top = top + 'px';
  canvas.style.width = sirka + 'px';
  canvas.style.height = vyska + 'px';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '999';
  try { ctx = canvas.getContext('2d'); } catch (e) { return; }
  if (!ctx) return;
  document.body.appendChild(canvas);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(sirka * dpr));
  canvas.height = Math.max(1, Math.round(vyska * dpr));

  const pocet = POCET_MIN + Math.floor(Math.random() * (POCET_MAX - POCET_MIN + 1));
  const kusy = [];
  for (let i = 0; i < pocet; i++) {
    kusy.push({
      x: Math.random() * canvas.width,
      y: -30 * dpr - Math.random() * canvas.height * 0.5,
      vx: (Math.random() - 0.5) * 2.6 * dpr,
      vy: (1.3 + Math.random() * 2.4) * dpr,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.3,
      w: (5 + Math.random() * 5) * dpr,
      h: (8 + Math.random() * 6) * dpr,
      farba: FARBY[(Math.random() * FARBY.length) | 0],
      sud: 0.7 + Math.random() * 0.6,
    });
  }

  let bezi = true;
  const zaciatok = performance.now();
  function vykresli(t) {
    if (!bezi) return;
    const uplynulo = t - zaciatok;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const doznievanie = TRVANIE_KONFET - 500;
    const priesvit = uplynulo > doznievanie ? Math.max(0, (TRVANIE_KONFET - uplynulo) / (TRVANIE_KONFET - doznievanie)) : 1;
    for (const k of kusy) {
      k.x += k.vx;
      k.y += k.vy;
      k.rot += k.vrot;
      ctx.save();
      ctx.translate(k.x, k.y);
      ctx.rotate(k.rot);
      ctx.globalAlpha = priesvit;
      ctx.fillStyle = k.farba;
      ctx.fillRect(-k.w / 2, -k.h / 2, k.w, k.h * k.sud);
      ctx.restore();
    }
    if (uplynulo < TRVANIE_KONFET) requestAnimationFrame(vykresli);
    else koniec();
  }
  function koniec() {
    if (!bezi) return;
    bezi = false;
    canvas.remove();
  }
  requestAnimationFrame(vykresli);
  setTimeout(koniec, TRVANIE_KONFET + 60);
}
