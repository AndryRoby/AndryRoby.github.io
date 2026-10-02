// Daystone: rozhranie testovacej stránky (rameno A dni spolu a ranný ťuk, rameno B otázka na večer).
// Text od ľudí ide do stránky len cez textContent, nikdy cez innerHTML. Udalosti Umami nenesú
// text odpovedí, mená ani dátumy (zadanie bod 4); meranie nikdy nečíta časť odkazu za #.
import {
  RODINY, RODINA, SILA, MAX_ODPOVED, spocitaj, dnesnyDatum, dniMedzi, cislo, peknyDatum, vetaRokov,
  odkazFarby, odkazOtazky, normalizujOtazku, citajHash, jeChybaOdkazu, otazkaDna, pocetZnakov, cistyText, parsujDatum,
} from './logika.mjs';
import { PODLA_ID, TONY } from './otazky.mjs';
import { svgKamienok } from './kamienok.mjs';
import { kresliKartu, nacitajPismo } from './karta.mjs';
import { scena } from './scena.mjs';

const $ = (s, r = document) => r.querySelector(s);
const malyPohyb = matchMedia('(prefers-reduced-motion: reduce)').matches;
const poradie = document.documentElement.dataset.poradie || 'ab';
const STRANKA = 'https://arling.sk/daystone/';
const adresa = () => location.origin + location.pathname;
const dnes = dnesnyDatum();
const pismo = nacitajPismo();

// ---------- pomôcky ----------

function zaznam(nazov, data = {}) {
  try { window.umami?.track?.(nazov, { poradie, ...data }); } catch { /* meranie nesmie nič rozbiť */ }
}

function citaj(k) { try { return localStorage.getItem(k); } catch { return null; } }
function uloz(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* bez úložiska */ } }

function el(tag, attrs = {}, ...deti) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    e.setAttribute(k, v === true ? '' : v);
  }
  for (const d of deti) if (d !== null && d !== undefined && d !== false) e.append(d);
  return e;
}

/** SVG len z našich konštánt (kamienok.mjs, scena.mjs), nikdy s textom od človeka. */
function zKonstanty(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup;
  return t.content.firstElementChild;
}

const veta = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const privlastok = (meno) => (meno ? `${meno}'s` : "Your partner's");

function chyba(elm, text, pole) {
  elm.textContent = text || '';
  elm.hidden = !text;
  if (pole) pole.setAttribute('aria-invalid', text ? 'true' : 'false');
}

async function kopiruj(text, vstup) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (!vstup) return false;
    vstup.focus();
    vstup.select();
    try { return document.execCommand('copy'); } catch { return false; }
  }
}

/** Ponúkne odkaz: systémové okno zdieľania, inak skopíruje; pole s odkazom ostane viditeľné ako záloha. */
async function ponukni({ url, text, nadpis, blok, vstup, stav, udalost, data }) {
  vstup.value = url;
  vstup.dataset.udalost = udalost;
  vstup.dataset.data = JSON.stringify(data || {});
  blok.hidden = false;
  if (navigator.share) {
    try {
      await navigator.share({ title: nadpis, text, url });
      zaznam(udalost, { ...data, kanal: 'share' });
      stav.textContent = 'Sent. Now it is their turn.';
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') { stav.textContent = 'Not sent yet. You can also copy the link.'; return; }
    }
  }
  if (await kopiruj(url, vstup)) {
    zaznam(udalost, { ...data, kanal: 'copy' });
    stav.textContent = 'Link copied. Paste it into your chat with them.';
  } else {
    stav.textContent = 'Copy the link above and paste it into your chat with them.';
  }
}

document.addEventListener('click', async (e) => {
  const tl = e.target.closest('[data-kopiruj]');
  if (!tl) return;
  const vstup = document.getElementById(tl.dataset.kopiruj);
  if (!vstup?.value) return;
  const ok = await kopiruj(vstup.value, vstup);
  tl.textContent = ok ? 'Copied' : 'Select and copy';
  setTimeout(() => { tl.textContent = 'Copy'; }, 2200);
  if (ok && vstup.dataset.udalost) {
    let data = {};
    try { data = JSON.parse(vstup.dataset.data || '{}'); } catch { /* nič */ }
    zaznam(vstup.dataset.udalost, { ...data, kanal: 'copy' });
  }
});

function prejdiNa(ciel) {
  if (!ciel) return;
  ciel.scrollIntoView({ behavior: malyPohyb ? 'auto' : 'smooth', block: 'start' });
  ciel.focus({ preventScroll: true });
}

// Vnútorné odkazy nemenia časť za #, inak by sa stratila otvorená karta od partnera.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-skok], a[data-domov]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  if (a.hasAttribute('data-domov')) { domov(); return; }
  prejdiNa(document.querySelector(a.getAttribute('href')));
});

// ---------- výber farby (kamienky a hĺbka) ----------

function zalej(plocha, farba, odkial) {
  const p = plocha.getBoundingClientRect();
  const o = odkial.getBoundingClientRect();
  plocha.style.setProperty('--zx', `${Math.round(o.left + o.width / 2 - p.left)}px`);
  plocha.style.setProperty('--zy', `${Math.round(o.top + o.height / 2 - p.top)}px`);
  plocha.style.backgroundColor = plocha.style.getPropertyValue('--zaliatie') || '';
  plocha.style.setProperty('--zaliatie', farba);
  plocha.classList.remove('zaliva');
  void plocha.offsetWidth;
  plocha.classList.add('zaliva');
}

let pocetVyberov = 0;
function vytvorVyber(kontajner, { plocha, legenda = 'Your color today', pri } = {}) {
  const meno = `vyber${++pocetVyberov}`;
  const stav = { f: null, h: 2 };
  const obrazy = new Map();
  const bodky = [];

  const kamene = el('fieldset', { class: 'kamene' }, el('legend', { class: 'vh' }, legenda));
  for (const r of RODINY) {
    const input = el('input', { type: 'radio', name: `${meno}-f`, value: r.id });
    const obraz = el('span', { class: 'kamen-obraz' });
    obraz.append(zKonstanty(svgKamienok(r.id, stav.h)));
    obrazy.set(r.id, obraz);
    kamene.append(el('label', { class: 'kamen' }, input, obraz, el('span', { class: 'kamen-nazov' }, r.nazov), el('span', { class: 'kamen-popis' }, r.popis)));
    input.addEventListener('change', () => {
      stav.f = r.id;
      obnovBodky();
      if (plocha) zalej(plocha, r.farby[0], obraz);
      pri?.(stav);
    });
  }

  const hlbka = el('fieldset', { class: 'hlbka' }, el('legend', { class: 'pole-nazov' }, 'How strong?'));
  SILA.forEach((s, i) => {
    const input = el('input', { type: 'radio', name: `${meno}-h`, value: String(i + 1), checked: i === 1 });
    const popis = el('span', {}, veta(s));
    bodky.push(popis);
    hlbka.append(el('label', {}, input, popis));
    input.addEventListener('change', () => {
      stav.h = i + 1;
      for (const [id, obraz] of obrazy) obraz.replaceChildren(zKonstanty(svgKamienok(id, stav.h)));
      pri?.(stav);
    });
  });

  function obnovBodky() {
    const farby = RODINA.get(stav.f || 'okay').farby;
    bodky.forEach((b, i) => b.style.setProperty('--bodka', farby[i]));
  }
  obnovBodky();
  kontajner.append(kamene, el('div', { class: 'polica', 'aria-hidden': 'true' }), hlbka);
  return stav;
}

// ---------- rameno A: dni spolu a karta ----------

const odVstup = $('#od');
odVstup.max = dnes;
let dniStav = null;
let format = '9x16';
let mojaFarba = null;

async function kresliNahlad() {
  if (!dniStav) return;
  await pismo;
  const kamene = mojaFarba?.f ? [[mojaFarba.f, mojaFarba.h], mojaFarba.f === 'tense' ? ['calm', 3] : ['tense', 2]] : undefined;
  kresliKartu($('#karta'), {
    dni: dniStav.dni, roky: dniStav.roky, zvysok: dniStav.zvysok, format, kamene,
    mena: cistyText($('#mena').value).slice(0, 40),
  });
  $('#karta-nahlad').dataset.format = format;
}

function animujCislo(elm, ciel) {
  if (malyPohyb || ciel < 2) { elm.textContent = cislo(ciel); return; }
  const zaciatok = performance.now();
  const krok = (t) => {
    const p = Math.min(1, (t - zaciatok) / 700);
    elm.textContent = cislo(Math.round(ciel * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(krok);
  };
  requestAnimationFrame(krok);
}

function ukazDni(od) {
  const r = spocitaj(od, dnes);
  if (r.chyba) return r;
  dniStav = { dni: r.dni, roky: r.roky, zvysok: r.zvysok };

  $('#vysledok').hidden = false;
  $('#karta-blok').hidden = false;
  animujCislo($('#vys-n'), r.dni);
  $('#vys-dni').textContent = r.dni === 1 ? 'day' : 'days';
  $('#vys-hlas').textContent = `You have been together ${cislo(r.dni)} ${r.dni === 1 ? 'day' : 'days'}.`;
  $('#vys-roky').textContent = r.dni === 0 ? 'It starts today.' : r.roky > 0 ? `That is ${vetaRokov({ roky: r.roky, dni: r.zvysok })}.` : 'Your first year together.';
  const m = r.milnik;
  $('#vys-milnik').textContent = m ? `Day ${cislo(m.den)} is on ${peknyDatum(m.datum)}, ${m.zostava === 1 ? 'tomorrow' : `in ${cislo(m.zostava)} days`}.` : '';
  kresliNahlad();
  return r;
}

const dlzka = (roky) => (roky < 1 ? '0' : roky < 3 ? '1-2' : roky < 6 ? '3-5' : roky < 11 ? '6-10' : '11+');

$('#pocitadlo').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = ukazDni(odVstup.value);
  if (v.chyba) { chyba($('#od-chyba'), v.chyba, odVstup); odVstup.focus(); return; }
  chyba($('#od-chyba'), '', odVstup);
  uloz('daystone.od', odVstup.value);
  zaznam('daystone_calc', { roky: dlzka(v.roky) });
});

$('#zabudni').addEventListener('click', () => {
  uloz('daystone.od', null);
  odVstup.value = '';
  dniStav = null;
  $('#vysledok').hidden = true;
  $('#karta-blok').hidden = true;
  $('#karta-stav').textContent = '';
  odVstup.focus();
});

for (const r of document.querySelectorAll('input[name=format]')) {
  r.addEventListener('change', () => { format = r.value; kresliNahlad(); });
}
let casovacMena;
$('#mena').addEventListener('input', () => { clearTimeout(casovacMena); casovacMena = setTimeout(kresliNahlad, 160); });

const blobKarty = () => new Promise((res) => $('#karta').toBlob(res, 'image/png'));
const menoSuboru = () => `daystone-${dniStav.dni}-days-${format}.png`;

function stiahni(blob) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: menoSuboru() });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  zaznam('daystone_card_share', { kanal: 'download', format });
  $('#karta-stav').textContent = 'Saved. Look in your downloads or photos.';
}

$('#zdielaj-kartu').addEventListener('click', async () => {
  if (!dniStav) return;
  await kresliNahlad();
  const blob = await blobKarty();
  if (!blob) { $('#karta-stav').textContent = 'This browser could not make the image. Try Save image.'; return; }
  const subor = new File([blob], menoSuboru(), { type: 'image/png' });
  if (navigator.canShare?.({ files: [subor] })) {
    try {
      await navigator.share({ files: [subor], title: 'Our days together', text: `We've been together ${cislo(dniStav.dni)} days. Count yours: ${STRANKA}` });
      zaznam('daystone_card_share', { kanal: 'share', format });
      $('#karta-stav').textContent = 'Shared.';
    } catch (e) {
      if (!(e && e.name === 'AbortError')) stiahni(blob);
    }
    return;
  }
  stiahni(blob);
});

$('#stiahni-kartu').addEventListener('click', async () => {
  if (!dniStav) return;
  await kresliNahlad();
  const blob = await blobKarty();
  if (blob) stiahni(blob);
});

$('#kopiruj-stranku').addEventListener('click', async () => {
  const ok = await kopiruj(STRANKA);
  $('#karta-stav').textContent = ok ? `Copied: ${STRANKA}` : `Copy this: ${STRANKA}`;
  if (ok) zaznam('daystone_card_share', { kanal: 'copy', format });
});

// ---------- rameno A: ranný ťuk ----------

mojaFarba = vytvorVyber($('[data-vyber=ja]'), {
  plocha: $('#tuk'),
  pri: () => { chyba($('#farba-chyba'), ''); kresliNahlad(); },
});

$('#posli-farbu').addEventListener('click', () => {
  const { f, h } = mojaFarba;
  if (!f) { chyba($('#farba-chyba'), 'Pick a color first. Tap the pebble that fits your day.'); return; }
  let hash;
  try {
    hash = odkazFarby({ f, h, n: $('#tuk-meno').value, d: dnes });
  } catch (e) {
    if (!jeChybaOdkazu(e)) throw e;
    chyba($('#farba-chyba'), e.message, $('#tuk-meno'));
    return;
  }
  chyba($('#farba-chyba'), '', $('#tuk-meno'));
  ponukni({
    url: adresa() + hash,
    nadpis: 'My color today',
    text: `My color today: ${RODINA.get(f).nazov}. Tap to see it and send me yours.`,
    blok: $('#farba-odkaz'), vstup: $('#farba-url'), stav: $('#farba-stav'),
    udalost: 'daystone_color_send', data: { farba: f },
  });
});

// ---------- rameno B: otázka na dnes ----------

let posun = 0;
let otazka = otazkaDna(dnes, 0);

function ukazOtazku(animuj) {
  const text = $('#ot-text');
  const zapis = () => {
    $('#ot-ton').textContent = TONY[otazka.ton];
    text.textContent = otazka.text;
    text.classList.remove('meni');
  };
  if (animuj && !malyPohyb) {
    text.classList.add('meni');
    setTimeout(zapis, 200);
  } else zapis();
}
ukazOtazku(false);
$('#otazka-karta').append(zKonstanty(svgKamienok('okay', 2, { tvar: false })));
$('#otazka-karta svg').classList.add('otazka-kamen');

$('#ina-otazka').addEventListener('click', () => {
  posun += 1;
  otazka = otazkaDna(dnes, posun);
  ukazOtazku(true);
  $('#ot-odkaz').hidden = true;
  $('#ot-stav').textContent = '';
});

function pocitadloZnakov(pole, vystup) {
  const obnov = () => {
    const n = pocetZnakov(cistyText(pole.value, true));
    vystup.textContent = `${cislo(n)} of ${MAX_ODPOVED}`;
    vystup.parentElement.classList.toggle('vela', n > MAX_ODPOVED);
  };
  pole.addEventListener('input', obnov);
  obnov();
}
pocitadloZnakov($('#odpoved'), $('#odp-pocet'));

$('#odpoved-form').addEventListener('submit', (e) => {
  e.preventDefault();
  let hash;
  try {
    hash = odkazOtazky({ q: otazka.id, a: $('#odpoved').value, n: $('#ot-meno').value, d: dnes });
  } catch (err) {
    if (!jeChybaOdkazu(err)) throw err;
    chyba($('#odp-chyba'), err.message, $('#odpoved'));
    $('#odpoved').focus();
    return;
  }
  chyba($('#odp-chyba'), '', $('#odpoved'));
  zaznam('daystone_q_answer', { ton: otazka.ton });
  ponukni({
    url: adresa() + hash,
    nadpis: "Tonight's question",
    text: "Tonight's question for us. Write your answer, then you'll see mine.",
    blok: $('#ot-odkaz'), vstup: $('#ot-url'), stav: $('#ot-stav'),
    udalost: 'daystone_q_send', data: { ton: otazka.ton },
  });
});

// ---------- príjem odkazu od partnera ----------

const prijem = $('#prijem');

function kedy(d) {
  if (!d) return '';
  const n = dniMedzi(d, dnes);
  if (n === 0) return 'Sent today';
  if (n === 1) return 'Sent yesterday';
  if (n < 0) return '';
  return `Sent on ${peknyDatum(d)}`;
}

function kamenSPopisom(f, h, nadpis, velky) {
  const r = RODINA.get(f);
  return el('div', { class: `prijem-kamen${velky ? ' velky' : ''}` },
    zKonstanty(svgKamienok(f, h)),
    el('b', {}, nadpis),
    el('span', {}, `${r.nazov}, ${SILA[h - 1]}`));
}

function bublina(kto, text, moja) {
  return el('div', { class: `bublina${moja ? ' moja' : ''}` }, el('b', {}, kto), el('p', {}, text));
}

function odkazBlok(id) {
  const vstup = el('input', { id, type: 'text', readonly: true });
  const blok = el('div', { class: 'odkaz-blok', hidden: true },
    el('label', { class: 'pole-nazov', for: id }, 'Your link'),
    el('div', { class: 'riadok' }, vstup, el('button', { type: 'button', class: 'tl tl-obrys', 'data-kopiruj': id }, 'Copy')));
  return { blok, vstup };
}

function otvorPrijem(obsah, podklad) {
  prijem.replaceChildren(el('div', { class: 'prijem-inner' }, ...obsah));
  prijem.style.setProperty('--prijem-podklad', podklad || '');
  prijem.hidden = false;
  document.body.classList.add('ma-prijem');
  window.scrollTo(0, 0);
  prijem.querySelector('h1')?.focus({ preventScroll: true });
}

function zatvorPrijem() {
  prijem.hidden = true;
  prijem.replaceChildren();
  document.body.classList.remove('ma-prijem');
}

function domov() {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  zatvorPrijem();
  window.scrollTo({ top: 0, behavior: malyPohyb ? 'auto' : 'smooth' });
  $('#obsah').focus({ preventScroll: true });
}

const naZaciatok = () => el('p', { class: 'na-zaciatok' }, el('a', { href: '/daystone/', 'data-domov': true }, 'What is Daystone? Make your own'));

function prijemChyba() {
  const tl = el('button', { type: 'button', class: 'tl tl-plne' }, 'Go to Daystone');
  tl.addEventListener('click', domov);
  otvorPrijem([
    el('p', { class: 'stitok' }, 'Link'),
    el('h1', { tabindex: '-1' }, 'This link looks broken or cut off.'),
    el('p', { class: 'sub' }, 'Ask for it again, or check that you copied the whole link, including everything after the # sign.'),
    el('p', { class: 'akcie' }, tl),
  ]);
}

function prijemFarba(d) {
  const r = RODINA.get(d.f);
  if (d.r) {
    const tl = el('a', { class: 'tl tl-plne', href: '#tuk', 'data-skok': true }, 'Send a new color');
    otvorPrijem([
      el('p', { class: 'stitok' }, 'Morning tap'),
      el('h1', { tabindex: '-1' }, d.n ? `${d.n} sent their color back` : 'Your partner sent their color back'),
      el('p', { class: 'datum' }, kedy(d.d)),
      el('div', { class: 'prijem-kamene' }, kamenSPopisom(d.r.f, d.r.h, 'You', false), kamenSPopisom(d.f, d.h, d.n || 'Your partner', true)),
      el('p', { class: 'veta-pre' }, r.pre),
      el('p', { class: 'akcie' }, tl),
      naZaciatok(),
    ], r.farby[0]);
    zaznam('daystone_card_open', { krok: 'spat', farba: d.f });
    return;
  }

  const blok = el('div', { class: 'prijem-blok zaplava' });
  const meno = el('input', { id: 'spat-meno', type: 'text', maxlength: '24', autocomplete: 'given-name', spellcheck: 'false' });
  const tl = el('button', { type: 'button', class: 'tl tl-plne' }, 'Send my color back');
  const chybaEl = el('p', { class: 'chyba', role: 'alert', hidden: true });
  const { blok: oBlok, vstup } = odkazBlok('spat-url');
  const stav = el('p', { class: 'stav', 'aria-live': 'polite' });
  const vyber = el('div', { class: 'vyber' });
  blok.append(el('h2', {}, 'Send your color back'), vyber,
    el('label', { class: 'pole-nazov', for: 'spat-meno' }, 'Your first name ', el('i', {}, '(optional)')),
    el('div', { class: 'riadok' }, meno, tl), chybaEl, oBlok, stav);
  const moja = vytvorVyber(vyber, { plocha: blok, legenda: 'Your color today', pri: () => chyba(chybaEl, '') });

  tl.addEventListener('click', () => {
    if (!moja.f) { chyba(chybaEl, 'Pick a color first. Tap the pebble that fits your day.'); return; }
    let hash;
    try {
      hash = odkazFarby({ f: moja.f, h: moja.h, n: meno.value, d: dnes, spat: { f: d.f, h: d.h, n: d.n } });
    } catch (e) {
      if (!jeChybaOdkazu(e)) throw e;
      chyba(chybaEl, e.message, meno);
      return;
    }
    chyba(chybaEl, '', meno);
    ponukni({
      url: adresa() + hash, nadpis: 'My color back',
      text: `My color today: ${RODINA.get(moja.f).nazov}. Here it is, next to yours.`,
      blok: oBlok, vstup, stav, udalost: 'daystone_card_reply', data: { farba: moja.f },
    });
  });

  otvorPrijem([
    el('p', { class: 'stitok' }, 'Morning tap'),
    el('h1', { tabindex: '-1' }, `${privlastok(d.n)} color today`),
    el('p', { class: 'datum' }, kedy(d.d)),
    el('div', { class: 'prijem-kamene' }, kamenSPopisom(d.f, d.h, d.n || 'Your partner', true)),
    el('p', { class: 'veta-pre' }, r.pre),
    blok,
    naZaciatok(),
  ], r.farby[0]);
  zaznam('daystone_card_open', { krok: 'prvy', farba: d.f });
}

function prijemOtazka(d) {
  const q = PODLA_ID.get(d.q);
  const kto = d.n || 'Your partner';

  if (d.b) {
    const tl = el('a', { class: 'tl tl-plne', href: '#question', 'data-skok': true }, 'Answer another one');
    otvorPrijem([
      el('p', { class: 'stitok' }, "Tonight's question"),
      el('h1', { tabindex: '-1' }, d.m ? `${d.m} answered too` : 'Your partner answered too'),
      el('p', { class: 'datum' }, kedy(d.d)),
      el('p', { class: 'otazka-text' }, q.text),
      el('div', { class: 'bubliny' }, bublina('You', d.a, true), bublina(d.m || 'Your partner', d.b, false)),
      el('p', { class: 'akcie' }, tl),
      naZaciatok(),
    ], '#F5F0FB');
    zaznam('daystone_q_open', { krok: 'spat', ton: q.ton });
    return;
  }

  const bubliny = el('div', { class: 'bubliny', 'aria-live': 'polite' });
  const pole = el('textarea', { id: 'spat-odpoved', rows: '4', maxlength: '1200', 'aria-describedby': 'spat-pocet spat-chyba' });
  const pocet = el('span', { id: 'spat-pocet' });
  const meno = el('input', { id: 'spat-meno', type: 'text', maxlength: '24', autocomplete: 'given-name', spellcheck: 'false' });
  const hlavne = el('button', { type: 'submit', class: 'tl tl-plne' }, 'Show me both');
  const nakuk = el('button', { type: 'button', class: 'tl-text' }, 'Just show me their answer');
  const chybaEl = el('p', { class: 'chyba', id: 'spat-chyba', role: 'alert', hidden: true });
  const nadpis = el('h2', {}, 'Your answer first');
  const uvod = el('p', { class: 'sub' }, `Write yours, then you will see what ${d.n || 'they'} wrote.`);
  const form = el('form', { class: 'odpoved-form', novalidate: true },
    el('label', { class: 'pole-nazov', for: 'spat-odpoved' }, 'Your answer'), pole, el('p', { class: 'pocet' }, pocet),
    el('label', { class: 'pole-nazov', for: 'spat-meno' }, 'Your first name ', el('i', {}, '(optional)')), meno,
    hlavne, chybaEl, el('p', { class: 'akcie' }, nakuk));
  const { blok: oBlok, vstup } = odkazBlok('spat-url');
  const stav = el('p', { class: 'stav', 'aria-live': 'polite' });
  const posliSpat = el('button', { type: 'button', class: 'tl tl-plne', hidden: true }, `Send yours back to ${d.n || 'them'}`);
  const blok = el('div', { class: 'prijem-blok' }, nadpis, uvod, bubliny, form, el('p', { class: 'akcie' }, posliSpat), oBlok, stav);
  pocitadloZnakov(pole, pocet);

  let odhalene = false;
  let moja = null;

  const over = () => {
    try {
      const o = normalizujOtazku({ q: d.q, a: d.a, n: d.n, d: d.d, b: pole.value, m: meno.value });
      chyba(chybaEl, '', pole);
      return o;
    } catch (e) {
      if (!jeChybaOdkazu(e)) throw e;
      chyba(chybaEl, e.message, pole);
      pole.focus();
      return null;
    }
  };

  const posli = () => ponukni({
    url: adresa() + odkazOtazky({ q: d.q, a: d.a, n: d.n, d: d.d, b: moja.b, m: moja.m }),
    nadpis: "Tonight's question", text: 'I answered too. Here are both of our answers.',
    blok: oBlok, vstup, stav, udalost: 'daystone_q_reply', data: { ton: q.ton },
  });

  const odhal = (odpovedal) => {
    odhalene = true;
    bubliny.replaceChildren(bublina(kto, d.a, false));
    if (odpovedal) bubliny.append(bublina('You', moja.b, true));
    zaznam('daystone_q_reveal', { odpovedal: odpovedal ? 'ano' : 'nie', ton: q.ton });
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    moja = over();
    if (!moja) return;
    if (!odhalene) {
      odhal(true);
      form.hidden = true;
      nadpis.textContent = 'Both answers';
      uvod.textContent = `Send yours back so ${d.n || 'they'} can see it too.`;
      posliSpat.hidden = false;
      posliSpat.focus();
    } else {
      bubliny.append(bublina('You', moja.b, true));
      form.hidden = true;
      posli();
    }
  });
  nakuk.addEventListener('click', () => {
    odhal(false);
    nakuk.parentElement.remove();
    nadpis.textContent = 'Want to answer too?';
    uvod.textContent = `Write yours and send it back to ${d.n || 'them'}.`;
    hlavne.textContent = 'Send my answer back';
    bubliny.scrollIntoView({ behavior: malyPohyb ? 'auto' : 'smooth', block: 'nearest' });
  });
  posliSpat.addEventListener('click', posli);

  otvorPrijem([
    el('p', { class: 'stitok' }, "Tonight's question"),
    el('h1', { tabindex: '-1' }, `${kto} answered tonight's question`),
    el('p', { class: 'datum' }, kedy(d.d)),
    el('p', { class: 'otazka-text' }, q.text),
    blok,
    naZaciatok(),
  ], '#F5F0FB');
  zaznam('daystone_q_open', { krok: 'prvy', ton: q.ton });
}

function spracujHash() {
  const stav = citajHash(location.hash);
  if (!stav) { if (!prijem.hidden) zatvorPrijem(); return; }
  if (stav.typ === 'chyba') prijemChyba();
  else if (stav.typ === 'farba') prijemFarba(stav.data);
  else prijemOtazka(stav.data);
}

// ---------- záujem o appku ----------

function zaujemHotovo() {
  const tl = $('#zaujem');
  tl.textContent = 'Counted, thank you';
  tl.classList.add('hotovo');
  tl.disabled = true;
  $('#zaujem-stav').textContent = 'That is all we keep: one tap, no name, no email.';
}
if (citaj('daystone.zaujem')) zaujemHotovo();
$('#zaujem').addEventListener('click', () => {
  zaznam('daystone_app_interest', { z: prijem.hidden ? 'stranka' : 'odkaz' });
  uloz('daystone.zaujem', '1');
  zaujemHotovo();
});

function obrazAppky() {
  const k1 = svgKamienok('calm', 3, { x: 40, y: 236, s: 64 });
  const k2 = svgKamienok('tense', 2, { x: 112, y: 242, s: 58 });
  return `<svg viewBox="0 0 220 420" aria-hidden="true" focusable="false">
<defs><linearGradient id="ap-plocha" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD9BE"/><stop offset="1" stop-color="#E2D9F2"/></linearGradient></defs>
<rect x="4" y="4" width="212" height="412" rx="34" fill="#2A2238"/>
<rect x="12" y="12" width="196" height="396" rx="27" fill="url(#ap-plocha)"/>
<rect x="84" y="22" width="52" height="12" rx="6" fill="#2A2238"/>
<g fill="#fff" opacity=".55"><rect x="30" y="70" width="40" height="40" rx="12"/><rect x="90" y="70" width="40" height="40" rx="12"/><rect x="150" y="70" width="40" height="40" rx="12"/>
<rect x="30" y="350" width="40" height="40" rx="12"/><rect x="90" y="350" width="40" height="40" rx="12"/><rect x="150" y="350" width="40" height="40" rx="12"/></g>
<rect x="28" y="132" width="164" height="196" rx="26" fill="#FFF9F2"/>
<text x="110" y="182" text-anchor="middle" font-family="ARLing Draw Text, system-ui, sans-serif" font-weight="700" font-size="40" fill="#2A2238">1,204</text>
<text x="110" y="206" text-anchor="middle" font-family="ARLing Draw Text, system-ui, sans-serif" font-weight="600" font-size="15" fill="#5B5370">days together</text>
${k1}${k2}
<path d="M40 304H182" stroke="#E9E1D6" stroke-width="3" stroke-linecap="round"/>
</svg>`;
}

// ---------- štart ----------

$('#scena').append(zKonstanty(scena()));
$('#appka-obraz').append(zKonstanty(obrazAppky()));
$('#appka-obraz').after(el('p', { class: 'pozn appka-pozn' }, 'A sketch of the idea, not a real app yet.'));

const ulozeny = citaj('daystone.od');
if (ulozeny && parsujDatum(ulozeny) && dniMedzi(ulozeny, dnes) >= 0) {
  odVstup.value = ulozeny;
  ukazDni(ulozeny);
}

spracujHash();
addEventListener('hashchange', spracujHash);
