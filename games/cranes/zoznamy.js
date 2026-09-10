/* Cranes: the archive and the practice index. Reads what this browser has
 * finished (localStorage, see game.js) and marks it in the lists; on the
 * archive page it also draws the history table and adds the days since the
 * page was last built. Nothing leaves the browser. */
import { posunDen, denVTyzdni, urovenDna, pekneDatum, kratkyDatum, UROVNE, DNI, MESIACE } from './plan.mjs';
import { todayBratislava, isValidDate } from './generator.mjs';

function nacitaj(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function formatCas(sek) {
  const h = Math.floor(sek / 3600), m = Math.floor((sek % 3600) / 60), s = sek % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}
const zacate = (st) => (st && (Array.isArray(st.v) && st.v.some((y) => y) || Array.isArray(st.x) && st.x.some((y) => y)));
/* Two marks for a finished water, the same as in the game: clean, with no
 * hint and no check, or finished with help (ops/spec-hry-ux.md, part 8). */
const jeCiste = (st) => !!(st && st.done && !st.hints && !st.checks);
const stavTriedy = (st) => (st && st.done ? (jeCiste(st) ? 'hotove ciste' : 'hotove') : zacate(st) ? 'rozohrane' : '');
const popisStavu = (st) => (st && st.done ? (jeCiste(st) ? ', solved clean' : ', solved with help') : '');

/* Practice index: "3 of 8 solved" under every set. */
document.querySelectorAll('a[data-sada]').forEach((a) => {
  const sada = a.dataset.sada, pocet = +a.dataset.pocet;
  let hotove = 0, rozohrane = 0;
  for (let k = 1; k <= pocet; k++) {
    const st = nacitaj('cranes:p:' + sada + ':' + k);
    if (st && st.done) hotove++; else if (zacate(st)) rozohrane++;
  }
  if (hotove || rozohrane) {
    const span = a.querySelector('span');
    if (span) span.textContent += ' · ' + hotove + ' of ' + pocet + ' solved' + (rozohrane ? ', ' + rozohrane + ' started' : '');
    if (hotove === pocet) a.classList.add('hotove');
  }
});

/* Archive: mark days, add missing days up to today, draw the history. */
const mesiace = document.getElementById('mesiace');
if (mesiace) {
  const dnes = todayBratislava();
  const odkazy = [...mesiace.querySelectorAll('a[data-den]')];
  let posledny = odkazy.reduce((a, y) => (y.dataset.den > a ? y.dataset.den : a), '');
  // Days after the last build: the page is static, the calendar is not.
  for (let d = posunDen(posledny, 1); posledny && d <= dnes; d = posunDen(d, 1)) {
    const m = d.slice(0, 7);
    let blok = mesiace.querySelector('[data-mesiac="' + m + '"]');
    if (!blok) {
      blok = document.createElement('div');
      blok.className = 'mesiac'; blok.dataset.mesiac = m;
      blok.innerHTML = '<h3>' + MESIACE[+m.slice(5) - 1] + ' ' + m.slice(0, 4) + '</h3><ul class="dni"></ul>';
      mesiace.insertBefore(blok, mesiace.firstChild);
    }
    const li = document.createElement('li');
    li.innerHTML = '<a href="/games/cranes/' + d + '/" data-den="' + d + '"><b>' + DNI[denVTyzdni(d)] + ' ' + Number(d.slice(8)) + '</b><small>' + UROVNE[urovenDna(d)].label + '</small></a>';
    blok.querySelector('.dni').insertBefore(li, blok.querySelector('.dni').firstChild);
  }
  const hotove = [];
  mesiace.querySelectorAll('a[data-den]').forEach((a) => {
    const d = a.dataset.den;
    if (!isValidDate(d)) return;
    const st = nacitaj('cranes:' + d);
    const t = stavTriedy(st);
    if (t) for (const c of t.split(' ')) a.classList.add(c);
    if (st && st.done) a.title = jeCiste(st) ? 'Solved clean, with no hint and no check' : 'Solved with help';
    if (st && st.done) hotove.push({ d, sec: st.sec || 0, hints: st.hints || 0, checks: st.checks || 0 });
    if (d === dnes) a.setAttribute('aria-current', 'date');
  });
  const blok = document.getElementById('historia-blok');
  if (blok && hotove.length) {
    hotove.sort((a, y) => (a.d < y.d ? 1 : -1));
    const best = hotove.reduce((a, y) => (y.sec && (!a || y.sec < a.sec) ? y : a), null);
    const ciste = hotove.filter((y) => !y.hints && !y.checks).length;
    const priemer = Math.round(hotove.reduce((a, y) => a + y.sec, 0) / hotove.length);
    const s = nacitaj('cranes:streak');
    const seria = s && s.pocet && (s.posledny === dnes || s.posledny === posunDen(dnes, -1)) ? s.pocet : 0;
    document.getElementById('suhrn').innerHTML = '<b>' + hotove.length + '</b> ' + (hotove.length === 1 ? 'water' : 'waters') + ' finished, <b>' + ciste + '</b> of them clean, with no hint and no check'
      + (best ? ', best time <b>' + formatCas(best.sec) + '</b> (' + kratkyDatum(best.d) + ')' : '') + ', average <b>' + formatCas(priemer) + '</b>'
      + (seria ? ', current streak <b>' + seria + (seria === 1 ? ' day' : ' days') + '</b>' : '') + '. All of this lives only in this browser.';
    const tb = document.querySelector('#historia-tab tbody');
    for (const h of hotove) {
      const pomoc = [];
      if (h.hints) pomoc.push(h.hints + (h.hints === 1 ? ' hint' : ' hints'));
      if (h.checks) pomoc.push(h.checks + (h.checks === 1 ? ' check' : ' checks'));
      const tr = document.createElement('tr');
      tr.innerHTML = '<td><a href="/games/cranes/' + h.d + '/">' + pekneDatum(h.d) + '</a></td><td>' + UROVNE[urovenDna(h.d)].label + '</td><td><b>' + formatCas(h.sec) + '</b></td><td>' + (pomoc.length ? pomoc.join(', ') : 'clean') + '</td>';
      tb.appendChild(tr);
    }
    blok.hidden = false;
  }
}

/* Guide: this week's strip, the same chips as under the water. */
const pasikTyzden = document.getElementById('pasik-tyzden');
if (pasikTyzden) {
  const dnes = todayBratislava();
  const zaciatok = posunDen(dnes, -denVTyzdni(dnes));
  for (let k = 0; k < 7; k++) {
    const d = posunDen(zaciatok, k);
    const st = nacitaj('cranes:' + d);
    const buduci = d > dnes;
    const a = document.createElement(buduci ? 'span' : 'a');
    a.className = 'den' + (d === dnes ? ' dnes' : '') + (buduci ? ' buduci' : '') + (stavTriedy(st) ? ' ' + stavTriedy(st) : '');
    if (!buduci) a.href = d === dnes ? '/games/cranes/' : '/games/cranes/' + d + '/';
    a.innerHTML = '<small>' + DNI[k] + '</small><b>' + Number(d.slice(8)) + '</b>';
    a.title = pekneDatum(d) + ', ' + UROVNE[urovenDna(d)].label + (buduci ? ' (not yet)' : '');
    a.setAttribute('aria-label', a.title + popisStavu(st));
    pasikTyzden.appendChild(a);
  }
}
