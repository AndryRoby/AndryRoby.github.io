/* Puzzle Studio: the page.
 *
 * What this file is responsible for, and what it is deliberately not.
 *
 * It is responsible for: the form, the worker, the list of finished puzzles,
 * turning one SVG into a PNG at 300 dpi, the print sheet, the ZIP, the
 * courtesy quota and the licence state on screen.
 *
 * It is not responsible for: making a puzzle (products/arling-sk/games/<game>/
 * generator.mjs, the same files the free daily games run on), proving it has
 * one solution (druhy.mjs, which runs each game's own solver a second time
 * from scratch), drawing it (the book renderer in ./kresli/), the seed rules
 * and the quota arithmetic (jadro.mjs, pure and tested in Node), or verifying
 * a licence signature (../bankove-nastroje/licence.js, the same code and the
 * same public key the bank tools use).
 *
 * What leaves the browser: the licence check after paying, and the anonymous
 * visit count every page on the site sends. Not the puzzles, not the seed
 * word, not the counter, not a file. There is no upload in this page at all,
 * which is also why there is no "my puzzles" list: this browser is the only
 * place they exist.
 */
import {
  MAX_DAVKA, ZADARMO, plan as planPodla,
  klucHlavolamu, vezmiPoradia, identitaAnonymna, povolenyPocet, zostatok, dnesISO,
  nazovSuboru, kredit as kreditText, normalizujSemeno,
} from './jadro.mjs';
import { DRUHY, PODLA_KLUCA, urovnePre, velkostiPre, UROVNE_NAZVY } from './druhy.mjs';
import { zip, pngDpi } from './subory.mjs';
import * as licencia from './licencia.js';

const $ = (id) => document.getElementById(id);
const ULOZ = {
  id: 'puzzle-studio:id',
  pocitadlo: 'puzzle-studio:pocitadlo',
  kvota: 'puzzle-studio:kvota',
  volby: 'puzzle-studio:volby',
};

function citaj(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function pis(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function citajJson(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function pisJson(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function track(meno, data) {
  try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(meno, data); } catch (e) { /* counting is not the product */ }
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── State ─────────────────────────────────────────────────────────────── */
const stav = {
  plan: '',          // '' is the free tier
  exp: '',
  identita: '',
  hlavolamy: [],
  bezi: false,
  davka: 0,
  kredit: true,
  riesenia: false,
};

/* The identity that goes into every seed key. With a licence it comes from
 * the licence payload, so the same person gets the same never repeated
 * sequence on every device. Without one it is a random id made once in this
 * browser and kept. */
function anonymnaIdentita() {
  let v = citaj(ULOZ.id);
  if (!v) {
    const b = new Uint8Array(8);
    (self.crypto || {}).getRandomValues ? self.crypto.getRandomValues(b) : b.fill(Math.floor(Math.random() * 256));
    v = identitaAnonymna(Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join(''));
    pis(ULOZ.id, v);
  }
  return v;
}

/* ── The form ──────────────────────────────────────────────────────────── */
function postavFormular() {
  const druh = $('druh');
  druh.innerHTML = DRUHY.map((d) => '<option value="' + d.kluc + '">' + esc(d.nazov + ', ' + d.druh) + '</option>').join('');
  const ulozene = citajJson(ULOZ.volby) || {};
  if (ulozene.druh && PODLA_KLUCA.has(ulozene.druh)) druh.value = ulozene.druh;
  prekresliUroven(ulozene.uroven);
  prekresliVelkost(ulozene.velkost);
  if (ulozene.pocet) $('pocet').value = Math.min(MAX_DAVKA, Math.max(1, Number(ulozene.pocet) || 1));
  druh.addEventListener('change', () => { prekresliUroven(); prekresliVelkost(); ulozVolby(); });
  $('uroven').addEventListener('change', () => { prekresliVelkost(); ulozVolby(); });
  $('velkost').addEventListener('change', () => { prekresliVelkost($('velkost').value); ulozVolby(); });
  for (const id of ['pocet', 'semeno']) $(id).addEventListener('change', ulozVolby);
}

function prekresliUroven(chcene) {
  const kluc = $('druh').value;
  const u = $('uroven');
  const stary = chcene || u.value;
  const zoznam = urovnePre(kluc);
  u.innerHTML = zoznam.map((x) => '<option value="' + x + '">' + UROVNE_NAZVY[x] + '</option>').join('');
  u.value = zoznam.indexOf(stary) >= 0 ? stary : (zoznam.indexOf('medium') >= 0 ? 'medium' : zoznam[0]);
  prekresliPravidlo();
}

function prekresliVelkost(chcene) {
  const kluc = $('druh').value;
  const v = $('velkost');
  const zoznam = velkostiPre(kluc, $('uroven').value);
  const riadok = $('velkost-riadok');
  if (!zoznam.length) {
    riadok.hidden = true;
    v.innerHTML = '';
    $('velkost-pevna').textContent = kluc === 'dormice'
      ? 'The difficulty sets the shape: Easy is five dormice and three categories, the rest are four and four.'
      : 'This kind has one size.';
    $('velkost-pevna').hidden = false;
    $('velkost-poznamka').hidden = true;
    return;
  }
  riadok.hidden = false;
  $('velkost-pevna').hidden = true;
  const stary = chcene != null ? String(chcene) : v.value;
  const uroven = $('uroven').value;
  const zakl = PODLA_KLUCA.get(kluc).urovne[uroven].n;
  /* The option text is only the size. Which one the difficulty was tuned for
     goes on a line of its own underneath: "9 x 9 (standard)" does not fit a
     select on a 390 px screen and came out as "9 x 9 (standa". */
  v.innerHTML = zoznam.map((n) => '<option value="' + n + '">' + n + ' x ' + n + '</option>').join('');
  v.value = zoznam.indexOf(Number(stary)) >= 0 ? String(stary) : String(zakl);
  const pozn = $('velkost-poznamka');
  pozn.textContent = (UROVNE_NAZVY[uroven] || uroven) + ' is tuned for ' + zakl + ' x ' + zakl + '.'
    + (Number(v.value) === zakl ? '' : ' Another size still gets the same proof, but the difficulty is a step off.');
  pozn.hidden = false;
}

function prekresliPravidlo() {
  const d = PODLA_KLUCA.get($('druh').value);
  $('pravidlo-text').textContent = d.pravidla[0];
  $('pravidlo-cele').innerHTML = d.pravidla.map((p) => '<p>' + esc(p) + '</p>').join('');
}

function ulozVolby() {
  pisJson(ULOZ.volby, {
    druh: $('druh').value, uroven: $('uroven').value, velkost: $('velkost').value,
    pocet: $('pocet').value, semeno: $('semeno').value,
  });
}

/* ── Quota and plan on screen ──────────────────────────────────────────── */
function prekresliKvotu() {
  const p = planPodla(stav.plan);
  const zostava = zostatok(citajJson(ULOZ.kvota), dnesISO(), stav.plan);
  const el = $('kvota');
  if (p.neobmedzene) {
    el.innerHTML = '<b>' + esc(p.nazov) + '</b> Unlimited puzzles.'
      + (stav.exp ? ' Licence valid to ' + esc(stav.exp) + '.' : '');
  } else if (zostava > 0) {
    el.innerHTML = '<b>Free</b> ' + zostava + ' of ' + ZADARMO.denne + ' puzzles left today. '
      + 'It is a courtesy limit counted in this browser, not a lock: clearing site data resets it. '
      + '<a href="#price">Personal is 4.90 &euro; a month</a> and removes it.';
  } else {
    el.innerHTML = '<b>Free</b> Today’s two puzzles are used up. '
      + 'The count lives in this browser only, so we are asking rather than stopping you. '
      + '<a href="#price">Personal is 4.90 &euro; a month</a> and removes the limit.';
  }
  const kr = $('kredit-riadok');
  kr.hidden = !p.neobmedzene;
  if (!p.neobmedzene) { $('kredit').checked = true; stav.kredit = true; }
  $('tlacova-licencia').hidden = !p.tlacovaLicencia;
}

/* ── The worker, and the fallback for browsers without module workers ──── */
let robotnik = null;
let vlastnyVyrob = null;

function spustiRobotnika() {
  if (robotnik !== null) return robotnik;
  try {
    robotnik = new Worker('./worker.js?v=1', { type: 'module' });
    robotnik.addEventListener('error', () => { robotnik = false; });
    return robotnik;
  } catch (e) {
    robotnik = false;
    return false;
  }
}

/* Same work, on the main thread, one puzzle per animation frame so the page
   still answers. Only used where module workers are missing (older Safari). */
async function vyrobBezRobotnika(sprava, naHlavolam, naChybu) {
  if (!vlastnyVyrob) vlastnyVyrob = await import('./druhy.mjs');
  const modul = await vlastnyVyrob.nacitaj(sprava.kluc);
  for (const u of sprava.ulohy) {
    await new Promise((r) => setTimeout(r, 0));
    try {
      const r = vlastnyVyrob.vyrob(modul, sprava.uroven, sprava.velkost, u.kluce);
      naHlavolam({
        i: u.i, druh: sprava.kluc, uroven: sprava.uroven,
        velkost: vlastnyVyrob.popisVelkosti(sprava.kluc, r.p),
        n: r.p.n != null ? r.p.n : r.p.N, kluc: r.kluc,
        zadanie: r.zadanie, riesenie: r.riesenie,
        msGen: Math.round(r.msGen * 10) / 10, msOver: Math.round(r.msOver * 10) / 10,
        uzly: r.overenie.uzly, pocetRieseni: r.overenie.pocet,
      });
    } catch (e) { naChybu(u.i, e.message); }
  }
}

/* ── Generating ────────────────────────────────────────────────────────── */
async function generuj() {
  if (stav.bezi) return;
  const kluc = $('druh').value;
  const uroven = $('uroven').value;
  const velkost = $('velkost').value ? Number($('velkost').value) : 0;
  const chce = Math.max(1, Math.min(MAX_DAVKA, Number($('pocet').value) || 1));
  const semeno = normalizujSemeno($('semeno').value);

  const dnes = dnesISO();
  const dovolene = povolenyPocet(citajJson(ULOZ.kvota), dnes, stav.plan, chce);
  if (dovolene.pocet === 0) {
    /* Pri vycerpanej kvote sa nikam neroluje. Hlasenie je pod tlacidlom, na ktore clovek prave
       klikol; rolovanie na vysledkovy panel ho odhodilo na iny koniec stranky a vyzeralo to,
       ze sa nestalo nic (nahlasene 18. 9. 2026). */
    prekresliKvotu();
    const k = $('kvota');
    if (k) {
      k.classList.add('kvota-doslo');
      k.setAttribute('role', 'status');
      setTimeout(() => k.classList.remove('kvota-doslo'), 2200);
    }
    $('postup').textContent = 'Today’s free puzzles are used up. The Personal plan is below, or come back tomorrow.';
    track('studio_quota', { druh: kluc });
    return;
  }
  if (!planPodla(stav.plan).neobmedzene) pisJson(ULOZ.kvota, dovolene.stav);

  /* The seed keys. Without a seed word the counter in this browser decides,
     and it only ever goes up, so this account never sees the same key twice.
     With a seed word the keys are the word and the position, which is the
     point: the same word gives the same sheet on any computer. The extra
     keys after the first are the fallbacks vyrob() tries when a generator
     turns one down. */
  const identita = stav.identita || anonymnaIdentita();
  const poradia = semeno
    ? { poradia: Array.from({ length: dovolene.pocet }, (_, i) => i + 1), nove: null }
    : vezmiPoradia(citaj(ULOZ.pocitadlo), dovolene.pocet);
  if (!semeno) pis(ULOZ.pocitadlo, String(poradia.nove));

  const ulohy = poradia.poradia.map((poradie, i) => {
    const zaklad = klucHlavolamu({ identita, druh: kluc, uroven, velkost: velkost || 'fixed', poradie, semeno });
    const kluce = [zaklad];
    for (let t = 1; t <= 7; t++) kluce.push(zaklad + '#' + t);
    return { i: i + 1, kluce };
  });

  stav.bezi = true;
  stav.davka += 1;
  stav.hlavolamy = [];
  $('zoznam').innerHTML = '';
  $('prazdno').hidden = true;
  $('lista').hidden = false;
  $('generuj').disabled = true;
  $('zrus').hidden = false;
  const t0 = performance.now();
  let hotovych = 0, chyb = 0;
  const cel = ulohy.length;
  const ukaz = () => {
    $('postup').textContent = hotovych + chyb >= cel
      ? hotovych + ' puzzle' + (hotovych === 1 ? '' : 's') + ' in ' + Math.round(performance.now() - t0) + ' ms'
        + (chyb ? ', ' + chyb + ' could not be made' : '')
      : 'Generating ' + (hotovych + chyb + 1) + ' of ' + cel + '…';
    $('postup').setAttribute('aria-busy', hotovych + chyb >= cel ? 'false' : 'true');
  };
  ukaz();
  if (dovolene.orezane) {
    $('postup').textContent = 'Making ' + dovolene.pocet + ' of the ' + chce + ' asked for: that is what is left of today’s free two.';
  }

  const naHlavolam = (h) => { hotovych++; stav.hlavolamy.push(h); pridajHlavolam(h); ukaz(); };
  const naChybu = (i, sprava) => { chyb++; pridajChybu(i, sprava); ukaz(); };
  const sprava = { typ: 'davka', id: stav.davka, kluc, uroven, velkost, ulohy };

  /* The worker is tried first and the main thread is the fallback. A browser
     that cannot do module workers usually does not throw in the constructor:
     it builds a Worker that then fails quietly, so waiting for a message that
     never comes would leave the page saying "Generating 1 of 4" for ever.
     Hence the deadline. The fallback only runs when the worker produced
     nothing at all, so nothing is ever generated twice. */
  const w = spustiRobotnika();
  let cezRobotnika = false;
  if (w) {
    cezRobotnika = await new Promise((hotovo) => {
      let ozval = false;
      const uprac = () => { w.removeEventListener('message', posluchac); w.removeEventListener('error', zlyhal); clearTimeout(cas); };
      const posluchac = (e) => {
        const m = e.data || {};
        if (m.id !== stav.davka) return;
        ozval = true;
        if (m.typ === 'hlavolam') naHlavolam(m.hlavolam);
        else if (m.typ === 'chyba' && m.i >= 0) naChybu(m.i, m.sprava);
        else if (m.typ === 'chyba') { chyb++; $('postup').textContent = m.sprava; }
        else if (m.typ === 'koniec') { uprac(); hotovo(true); }
      };
      const zlyhal = () => { if (!ozval) { uprac(); robotnik = false; hotovo(false); } };
      const cas = setTimeout(zlyhal, 8000);
      w.addEventListener('message', posluchac);
      w.addEventListener('error', zlyhal);
      w.postMessage(sprava);
    });
  }
  if (!cezRobotnika && hotovych + chyb === 0) {
    await vyrobBezRobotnika(sprava, naHlavolam, naChybu);
  }

  stav.bezi = false;
  $('generuj').disabled = false;
  $('zrus').hidden = true;
  ukaz();
  prekresliKvotu();
  prekresliListu();
  track('studio_generate', { druh: kluc, uroven, pocet: hotovych, semeno: semeno ? 1 : 0, plan: stav.plan || 'free' });
}

function zrus() {
  if (!stav.bezi) return;
  const w = robotnik;
  if (w) w.postMessage({ typ: 'stop', id: stav.davka });
}

/* ── Drawing one puzzle into the page ──────────────────────────────────── */
function titulok(h) {
  const d = PODLA_KLUCA.get(h.druh);
  return d.nazov + ', ' + d.druh + ' ' + h.velkost + ', ' + UROVNE_NAZVY[h.uroven];
}

/* The credit line is part of the picture, not a caption next to it: a PNG
   dragged into a newsletter has to carry it too. */
export function pridajKredit(svg, text) {
  const m = String(svg).match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!m) return svg;
  const w = Number(m[1]), h = Number(m[2]);
  const nova = h + 62;
  return String(svg)
    .replace(m[0], 'viewBox="0 0 ' + w + ' ' + nova + '"')
    .replace('</svg>', '<text x="' + (w / 2) + '" y="' + (h + 34) + '" font-size="30" text-anchor="middle"'
      + ' dominant-baseline="central" fill="#6a6a6a" font-family="Georgia, serif">' + esc(text) + '</text></svg>');
}

function svgPre(h, riesenie) {
  const zaklad = riesenie ? h.riesenie : h.zadanie;
  return stav.kredit ? pridajKredit(zaklad, kreditText(stav.plan)) : zaklad;
}

function pridajHlavolam(h) {
  const el = document.createElement('article');
  el.className = 'hlavolam';
  el.id = 'h' + h.i;
  el.innerHTML = '<h3>' + esc(h.i + '. ' + titulok(h)) + '</h3>'
    + '<div class="obrazok" data-rola="zadanie"></div>'
    + '<p class="overene">Verified: exactly one solution (' + h.msOver.toFixed(1) + ' ms)</p>'
    + '<p class="pravidlo">' + esc(PODLA_KLUCA.get(h.druh).pravidla[0]) + '</p>'
    + '<div class="obrazok riesenie" data-rola="riesenie" hidden></div>'
    + '<p class="akcie">'
    + '<button type="button" class="btn btn-line" data-stiahni="svg" data-i="' + h.i + '">SVG</button>'
    + '<button type="button" class="btn btn-line" data-stiahni="png" data-i="' + h.i + '">PNG, 300 dpi</button>'
    + '<button type="button" class="btn btn-line" data-tlac="' + h.i + '">Print sheet</button>'
    + '</p>';
  el.querySelector('[data-rola="zadanie"]').innerHTML = svgPre(h, false);
  el.querySelector('[data-rola="riesenie"]').innerHTML = svgPre(h, true);
  el.querySelector('[data-rola="riesenie"]').hidden = !stav.riesenia;
  $('zoznam').append(el);
}

function pridajChybu(i, sprava) {
  const el = document.createElement('article');
  el.className = 'hlavolam chyba';
  el.innerHTML = '<h3>' + i + '. Not made</h3><p class="nevyslo">' + esc(sprava)
    + '. Nothing is shown that we could not prove, so this slot stays empty. Try Generate again: the next key is a different puzzle.</p>';
  $('zoznam').append(el);
}

function prekresliObrazky() {
  for (const h of stav.hlavolamy) {
    const el = $('h' + h.i);
    if (!el) continue;
    el.querySelector('[data-rola="zadanie"]').innerHTML = svgPre(h, false);
    const r = el.querySelector('[data-rola="riesenie"]');
    r.innerHTML = svgPre(h, true);
    r.hidden = !stav.riesenia;
  }
}

function prekresliListu() {
  const ma = stav.hlavolamy.length > 0;
  for (const id of ['stiahni-zip', 'tlac-vsetko', 'riesenia-prepinac']) $(id).hidden = !ma;
  $('prazdno').hidden = ma;
}

/* ── SVG to PNG at 300 dpi ─────────────────────────────────────────────── */
/* One cell of the drawing is 100 units wide (kresli/spolocne.mjs) and a cell
   is printed 12 mm across, which is the size the puzzle books use. So the
   pixel width follows from the picture itself, and the PNG then says 300 dpi
   in its own pHYs chunk rather than only in our sentence about it. */
export const MM_NA_BUNKU = 12;
export const DPI = 300;
export const MAX_PX = 3000;

export function rozmer(svg, mmNaBunku = MM_NA_BUNKU, dpi = DPI) {
  const m = String(svg).match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!m) throw new Error('The drawing has no viewBox');
  const w = Number(m[1]), h = Number(m[2]);
  const naPx = (u) => (u / 100) * mmNaBunku / 25.4 * dpi;
  let px = Math.round(naPx(w));
  let py = Math.round(naPx(h));
  if (px > MAX_PX) { py = Math.round(py * (MAX_PX / px)); px = MAX_PX; }
  return { w, h, px, py };
}

function dataUrl(svg, px, py) {
  const s = String(svg).replace('<svg ', '<svg width="' + px + '" height="' + py + '" ');
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
}

async function pngZoSvg(svg) {
  const { px, py } = rozmer(svg);
  const obr = new Image();
  obr.decoding = 'sync';
  await new Promise((hotovo, zle) => {
    obr.onload = hotovo;
    obr.onerror = () => zle(new Error('The drawing could not be rasterised'));
    obr.src = dataUrl(svg, px, py);
  });
  const c = document.createElement('canvas');
  c.width = px; c.height = py;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, px, py);
  g.drawImage(obr, 0, 0, px, py);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const bajty = new Uint8Array(await blob.arrayBuffer());
  return pngDpi(bajty, DPI);
}

function stiahni(data, meno, typ) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: typ });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = meno;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function menoPre(h, riesenie, pripona) {
  return nazovSuboru({ druh: h.druh, uroven: h.uroven, velkost: h.n, poradie: h.i, riesenie, pripona });
}

async function stiahniJeden(i, format) {
  const h = stav.hlavolamy.find((x) => x.i === i);
  if (!h) return;
  track('studio_download', { format, kde: 'jeden', druh: h.druh });
  if (format === 'svg') {
    stiahni(svgPre(h, false), menoPre(h, false, 'svg'), 'image/svg+xml');
    if (stav.riesenia) stiahni(svgPre(h, true), menoPre(h, true, 'svg'), 'image/svg+xml');
    return;
  }
  stiahni(await pngZoSvg(svgPre(h, false)), menoPre(h, false, 'png'), 'image/png');
  if (stav.riesenia) stiahni(await pngZoSvg(svgPre(h, true)), menoPre(h, true, 'png'), 'image/png');
}

/* ── The whole batch as one ZIP ────────────────────────────────────────── */
function licencnyText() {
  const p = planPodla(stav.plan);
  const riadky = [
    'Puzzles from ARLing Puzzle Studio, https://arling.sk/puzzle-studio/',
    '',
    'Plan: ' + p.nazov + '.',
  ];
  if (p.tlacovaLicencia) {
    riadky.push('Print licence: these puzzles may be printed in one publication of yours,');
    riadky.push('in print and in its digital edition, for as long as the subscription runs.');
    riadky.push('The credit line "Puzzle by ARLing, arling.sk" goes on the page.');
  } else if (p.neobmedzene) {
    riadky.push('Personal use: at home, in a classroom or in a club, including printed');
    riadky.push('handouts for that group. Not for sale and not for a publication.');
    riadky.push('For a publication, see the Bulletin plan on the page above.');
  } else {
    riadky.push('Free plan: personal use, with the credit line left on the picture.');
    riadky.push('Not for sale and not for a publication.');
  }
  riadky.push('', 'Every puzzle in this archive was checked by the solver of its own kind:');
  riadky.push('exactly one solution, found without guessing. The files:');
  for (const h of stav.hlavolamy) {
    riadky.push('  ' + menoPre(h, false, 'svg') + '  ' + titulok(h)
      + '  verified in ' + h.msOver.toFixed(1) + ' ms, key ' + h.kluc);
  }
  riadky.push('');
  return riadky.join('\n');
}

async function stiahniZip() {
  if (!stav.hlavolamy.length) return;
  const tlacidlo = $('stiahni-zip');
  const povodne = tlacidlo.textContent;
  tlacidlo.disabled = true;
  tlacidlo.textContent = 'Packing…';
  try {
    const subory = [{ meno: 'licence.txt', data: licencnyText() }];
    for (const h of stav.hlavolamy) {
      subory.push({ meno: 'svg/' + menoPre(h, false, 'svg'), data: svgPre(h, false) });
      subory.push({ meno: 'svg/' + menoPre(h, true, 'svg'), data: svgPre(h, true) });
      subory.push({ meno: 'png/' + menoPre(h, false, 'png'), data: await pngZoSvg(svgPre(h, false)) });
      subory.push({ meno: 'png/' + menoPre(h, true, 'png'), data: await pngZoSvg(svgPre(h, true)) });
      tlacidlo.textContent = 'Packing ' + h.i + ' of ' + stav.hlavolamy.length + '…';
    }
    const prvy = stav.hlavolamy[0];
    stiahni(zip(subory), 'arling-' + prvy.druh + '-' + prvy.uroven + '-' + stav.hlavolamy.length + '.zip', 'application/zip');
    track('studio_download', { format: 'zip', kde: 'davka', druh: prvy.druh, pocet: stav.hlavolamy.length });
  } finally {
    tlacidlo.disabled = false;
    tlacidlo.textContent = povodne;
  }
}

/* ── The print sheet ───────────────────────────────────────────────────── */
/* No pop-up window and no PDF library: the sheet is built into this page and
   a print stylesheet hides everything else. The browser's own Save as PDF is
   then one keystroke away and the result is vector, not a screenshot. */
function postavTlac(hlavolamy) {
  const t = $('tlaciva');
  const d = PODLA_KLUCA.get(hlavolamy[0].druh);
  const hlava = '<header class="t-hlava"><b>' + esc(d.nazov + ', ' + d.druh) + '</b>'
    + '<span>' + esc(kreditText(stav.plan)) + '</span></header>';
  const strany = [];
  for (const h of hlavolamy) {
    strany.push('<section class="t-strana"><h2>' + esc(h.i + '. ' + titulok(h)) + '</h2>'
      + '<p class="t-pravidlo">' + esc(d.pravidla[0]) + '</p>'
      + '<div class="t-obrazok">' + h.zadanie + '</div>'
      + '<p class="t-overene">Verified: exactly one solution (' + h.msOver.toFixed(1) + ' ms)</p></section>');
  }
  strany.push('<section class="t-strana t-riesenia"><h2>Solutions</h2><div class="t-mriezka">'
    + hlavolamy.map((h) => '<figure><figcaption>' + h.i + '</figcaption>' + h.riesenie + '</figure>').join('')
    + '</div></section>');
  t.innerHTML = hlava + strany.join('');
  t.hidden = false;
  /* Only now may the print stylesheet hide the page. Before the first Print
     sheet button is pressed, Ctrl+P has to print the page itself rather than
     an empty container. */
  document.body.classList.add('tlac-list');
  return t;
}

function tlac(hlavolamy) {
  if (!hlavolamy.length) return;
  postavTlac(hlavolamy);
  track('studio_print', { druh: hlavolamy[0].druh, pocet: hlavolamy.length });
  window.print();
}

/* The sheet is only the truth for the print that was asked for. Once that
   print is over, Ctrl+P goes back to printing the page. */
if (typeof window !== 'undefined') {
  window.addEventListener('afterprint', () => { document.body.classList.remove('tlac-list'); });
}

/* ── Licence on screen ─────────────────────────────────────────────────── */
const DOVODY = {
  malformed: 'That does not look like a licence key.',
  signature: 'That key was not signed by us.',
  plan: 'That key is for a different ARLing product.',
  expired: 'That licence has run out. If the subscription is still running, use Check again.',
  unsupported: 'This browser cannot check the signature. Chrome, Firefox or Safari 17 and newer can.',
  network: 'The licence service did not answer. Nothing is lost: try Check again in a minute.',
  'no-session': 'There is no payment on record in this browser. Paste the licence key instead.',
  refused: 'The licence service would not renew this one. If you have cancelled, that is why.',
};

function prekresliLicenciu(sprava) {
  const p = planPodla(stav.plan);
  const el = $('stav-licencie');
  if (stav.plan) {
    el.innerHTML = '<b>' + esc(p.nazov) + ' is on.</b> ' + esc(p.popis)
      + (stav.exp ? ' Valid to ' + esc(stav.exp) + '.' : '');
  } else {
    el.textContent = sprava || 'No licence in this browser. The free plan makes two puzzles a day.';
  }
  $('licencia-odstranit').hidden = !stav.plan;
  prekresliKvotu();
}

async function nacitajLicenciu() {
  let l = null;
  try { l = await licencia.nacitaj(); } catch (e) { l = null; }
  if (l) {
    stav.plan = l.plan; stav.exp = l.exp; stav.identita = l.identita || anonymnaIdentita();
    stav.kredit = false;
    $('kredit').checked = false;
    if (licencia.trebaObnovit(l.exp)) {
      const r = await licencia.obnov();
      if (r.ok) { stav.plan = r.plan; stav.exp = r.exp; }
    }
  } else {
    stav.identita = anonymnaIdentita();
  }
  prekresliLicenciu();
}

/* ── Coming back from Stripe ───────────────────────────────────────────── */
function testRezim() {
  try {
    if (new URL(location.href).searchParams.get('test') === '1') sessionStorage.setItem('studio:test', '1');
    return sessionStorage.getItem('studio:test') === '1';
  } catch (e) { return false; }
}

async function poNavrate() {
  let sid = '';
  try { sid = new URL(location.href).searchParams.get('session_id') || ''; } catch (e) { sid = ''; }
  testRezim();
  if (!sid) {
    try { sid = sessionStorage.getItem('studio:cakajuca') || ''; } catch (e) { sid = ''; }
  }
  if (!sid) return;
  try { history.replaceState(null, '', location.pathname + '#price'); } catch (e) { /* nothing to tidy */ }
  if (sid.indexOf('cs_test_') === 0 && !testRezim()) {
    $('stav-platby').textContent = 'That is a payment from Stripe test mode. No money changed hands and no licence is issued.';
    return;
  }
  $('stav-platby').textContent = 'Checking the payment…';
  const r = await licencia.prevezmi(sid);
  if (r.ok) {
    try { sessionStorage.removeItem('studio:cakajuca'); } catch (e) { /* nothing to tidy */ }
    stav.plan = r.plan; stav.exp = r.exp;
    stav.kredit = false; $('kredit').checked = false;
    $('stav-platby').innerHTML = '<b>Paid, and the licence is on.</b> It is stored in this browser. '
      + 'On another computer, open this page from the Stripe receipt link, or paste the key below.';
    /* Nie je to platba: len to, ze tento prehliadac prevzal licenciu k relacii
       (aj v test mode). Platby pocita brief zo Stripe, nie z Umami. */
    track('studio_licencia_v_prehliadaci', { plan: r.plan, produkt: 'puzzle-studio', test: sid.indexOf('cs_test_') === 0 });
    await nacitajLicenciu();
    return;
  }
  try { sessionStorage.setItem('studio:cakajuca', sid); } catch (e) { /* nothing to keep */ }
  $('stav-platby').innerHTML = esc(DOVODY[r.chyba] || 'The licence could not be issued yet.')
    + ' <button type="button" class="btn btn-line" id="over-znova">Check again</button>';
  const b = $('over-znova');
  if (b) b.addEventListener('click', () => poNavrate());
}

/* ── Wiring ────────────────────────────────────────────────────────────── */
function pripoj() {
  postavFormular();
  prekresliKvotu();
  prekresliLicenciu();

  $('volby').addEventListener('submit', (e) => { e.preventDefault(); generuj(); });
  $('zrus').addEventListener('click', zrus);
  $('riesenia').addEventListener('change', () => {
    stav.riesenia = $('riesenia').checked;
    for (const el of document.querySelectorAll('[data-rola="riesenie"]')) el.hidden = !stav.riesenia;
  });
  $('kredit').addEventListener('change', () => { stav.kredit = $('kredit').checked; prekresliObrazky(); });
  $('stiahni-zip').addEventListener('click', stiahniZip);
  $('tlac-vsetko').addEventListener('click', () => tlac(stav.hlavolamy));
  $('zoznam').addEventListener('click', (e) => {
    const s = e.target.closest('[data-stiahni]');
    if (s) { stiahniJeden(Number(s.dataset.i), s.dataset.stiahni); return; }
    const t = e.target.closest('[data-tlac]');
    if (t) tlac(stav.hlavolamy.filter((h) => h.i === Number(t.dataset.tlac)));
  });

  $('licencia-ulozit').addEventListener('click', async () => {
    const r = await licencia.vloz($('licencia-text').value);
    if (r.ok) { $('licencia-text').value = ''; await nacitajLicenciu(); }
    else prekresliLicenciu(DOVODY[r.chyba] || 'That key was not accepted.');
  });
  $('licencia-odstranit').addEventListener('click', async () => {
    licencia.odstran();
    stav.plan = ''; stav.exp = '';
    await nacitajLicenciu();
  });

  /* Stripe payment links. The attributes are empty until ops/stripe/
     puzzle-studio.mjs --zapis fills them in; until then the button says so
     out loud instead of going nowhere. */
  for (const btn of document.querySelectorAll('[data-plan]')) {
    btn.addEventListener('click', () => {
      const plan = btn.dataset.plan;
      track('kupa_click', { plan, produkt: 'puzzle-studio' });
      const u = (testRezim() ? btn.dataset.linkTest : btn.dataset.link) || '';
      if (u.indexOf('https://') !== 0) {
        $('stav-platby').textContent = testRezim()
          ? 'Test mode is on, but this plan has no test link yet. Run ops/stripe/puzzle-studio.mjs --test --zapis.'
          : 'The subscription is still being switched on. Write to support@arling.sk and we will sort it out by hand.';
        $('stav-platby').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      location.href = u;
    });
  }
  /* V HTML je od 25. 9. 2026 len prazdny skryty #test-odznak: skrytu vetu o test
     mode a karte 4242 citali nastroje AI ako fakt o stranke (audit
     ops/audit/2026-09-25-celkovy/00-AUDIT.md, akcia 5). Text sa vlozi az tu. */
  const odznak = $('test-odznak');
  if (odznak) {
    odznak.hidden = !testRezim();
    if (!odznak.hidden && !odznak.firstChild) {
      const b = document.createElement('b');
      b.textContent = 'Test mode';
      odznak.append(b, 'Every button here leads to Stripe test mode. Use the card 4242 4242 4242 4242, any future date and any CVC. No money is taken.');
    }
  }

  /* Price seen, the same event name the other products use, so one report
     can put euros against a hundred visits across all of them. */
  const cena = $('price');
  if (cena && typeof IntersectionObserver === 'function') {
    const io = new IntersectionObserver((z) => {
      for (const e of z) if (e.isIntersecting) { track('cena_videna', { produkt: 'puzzle-studio' }); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe(cena);
  }

  /* The phone menu, the same three lines every page on the site has. */
  const bar = document.querySelector('header .bar');
  const btn = bar && bar.querySelector('.menu-btn');
  if (bar && btn) {
    const prepni = (otvor) => {
      bar.setAttribute('data-menu', otvor ? 'otvorene' : 'zavrete');
      btn.setAttribute('aria-expanded', otvor ? 'true' : 'false');
    };
    btn.addEventListener('click', (e) => { e.stopPropagation(); prepni(bar.getAttribute('data-menu') !== 'otvorene'); });
    document.addEventListener('click', (e) => { if (bar.getAttribute('data-menu') === 'otvorene' && !bar.contains(e.target)) prepni(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && bar.getAttribute('data-menu') === 'otvorene') { prepni(false); btn.focus(); } });
  }

  nacitajLicenciu().then(poNavrate);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pripoj);
else pripoj();

/* Opened up for the end to end check in headless Chrome (ops/puzzle-studio/
   e2e.mjs), which drives the page exactly as a person would and then needs to
   read back what came out. Nothing here changes what the page does. */
window.PuzzleStudio = {
  stav, generuj, stiahniZip, tlac, pngZoSvg, rozmer, pridajKredit, svgPre, postavTlac, licencnyText,
};
