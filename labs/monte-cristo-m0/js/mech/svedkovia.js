/* M54 Kniha svedkov (kap. 69): zivot M. Zaccone v dvoch stlpcoch, priatel Busoni vlavo,
 * nepriatel Wilmore vpravo. Stranka ma tvar listu kardinala Spadu z kap. 18 a zatvara sa
 * rovnako, po trojiciach (NAVRH, scenar-69.md cast 1). Riadky, pravidla a dovody zlych
 * kariet su v data-69.json (kniha_svedkov); karty su doslovne vety z kapitoly s riadkom. */
import { esc, riadky } from '../ui.js';

const kratko = (t, n = 9) => { const s = t.replace(/\s*\[…\]\s*/g, ' … ').split(/\s+/); return s.length > n ? s.slice(0, n).join(' ') + ' …' : t; };

export function krokyKariet(data) {
  const m = new Map();
  for (const b of data.beaty) for (const k of b.kroky) if (k.typ === 'volba_karty') m.set(k.id, k);
  return m;
}

/* jedna polovica riadku: { text, r, stav: 'spravna' | 'diera' | 'prazdna', kto } */
function polovica(id, data, j, karty) {
  const st = j.st;
  if (karty.has(id)) {
    const k = karty.get(id);
    const c = k.karty.find((q) => q.id === st.karty[id]);
    if (c && c.druh === 'spravna') return { text: kratko(c.text), r: c.r, stav: 'spravna' };
    if (c && c.druh === 'strukturalna') return { text: kratko(c.text), r: c.r, stav: 'diera', dovod: c.dovod_en };
    return { stav: 'prazdna' };
  }
  if (id === 'c08_uder') {
    const i = j.kroky.findIndex((x) => x.k.id === 'c08_uder');
    const presiel = i >= 0 && st.i > i && !st.otvorene.has('S_presnost');
    return presiel ? { text: 'He came in as the clock struck.', stav: 'spravna', vlastny: true } : { stav: 'prazdna' };
  }
  const d = data.dennik.find((q) => q.id === id);
  if (d) return st.dennik.has(id) ? { text: d.en, r: d.r, stav: 'spravna', vlastny: true } : { stav: 'prazdna', text: 'Not noticed in the police report.', vlastny: true };
  return { stav: 'prazdna' };
}

export function riadkyKnihy(data, j) {
  const karty = krokyKariet(data);
  return data.kniha_svedkov.riadky.map((r) => {
    const lava = polovica(r.lava, data, j, karty), prava = polovica(r.prava, data, j, karty);
    const otvoreny = j.st.otvorene.has(r.id);
    const plny = lava.stav === 'spravna' && prava.stav === 'spravna';
    return { ...r, l: lava, p: prava, otvoreny, plny };
  });
}

function bunka(h, strana) {
  if (h.stav === 'prazdna' && !h.text) return `<span class="mc-sv-b mc-sv-prazdna mc-sv-${strana}"><span class="mc-sr">not yet</span></span>`;
  const cls = h.stav === 'diera' ? ' mc-sv-diera' : h.stav === 'prazdna' ? ' mc-sv-nic' : '';
  const t = h.vlastny ? esc(h.text) : '“' + esc(h.text) + '”';
  return `<span class="mc-sv-b mc-sv-${strana}${cls}">${t}${h.r ? ` <span class="mc-chip">${riadky(h.r)}</span>` : ''}${h.stav === 'diera' ? `<em class="mc-sv-dovod">${esc(h.dovod || 'This leaves a hole.')}</em>` : ''}</span>`;
}

export function odlozene(data, j) {
  const karty = krokyKariet(data);
  const out = [];
  for (const k of karty.values()) for (const c of k.karty) if ((c.druh === 'persona' || c.druh === 'ozvena') && j.st.naucene.has(c.id)) out.push(c);
  return out;
}

/* cela stranka Knihy svedkov (Dennik, prolog v c03, zatvaranie v c11) */
export function htmlKniha(data, j, o = {}) {
  const ks = data.kniha_svedkov;
  const rr = riadkyKnihy(data, j);
  const riadkyHtml = rr.map((r, i) => `<li class="mc-sv-r${r.otvoreny ? ' otvoreny' : ''}${r.plny ? ' plny' : ''}${r.kluc ? ' kluc' : ''}" data-r="${esc(r.id)}" data-trojica="${Math.floor(i / 3)}">
      <span class="mc-sv-meno">${esc(r.en)}</span>${bunka(r.l, 'l')}${bunka(r.p, 'p')}
      <span class="mc-sv-spoj">${r.plny ? esc(r.spoj_en) : r.otvoreny ? 'Open' : ''}</span></li>`).join('');
  const odl = odlozene(data, j);
  return `<div class="mc-svedkovia${o.trieda ? ' ' + o.trieda : ''}">
    <div class="mc-sv-hlava"><p class="mc-sv-nadpis">Book of Witnesses</p><p class="mc-sv-pod">The life of M. Zaccone, told twice. Two different truths must make one quiet answer.</p></div>
    <div class="mc-sv-stlpce" aria-hidden="true"><span></span><span>The friend · Abbé Busoni</span><span>The enemy · Lord Wilmore</span><span></span></div>
    <ol class="mc-sv-riadky">${riadkyHtml}</ol>
    <ul class="mc-sv-pravidla">${ks.pravidla_en.map((p, i) => `<li><span class="mc-sv-zn" aria-hidden="true">${['◐', '◑', '≡', '∥', '⌂'][i] || '·'}</span>${esc(p)}</li>`).join('')}</ul>
    ${odl.length ? `<div class="mc-sv-odl"><p class="mc-sv-odl-h">Laid aside, and why</p><ul>${odl.map((c) => `<li><s>“${esc(kratko(c.text, 12))}”</s> <span class="mc-chip">${riadky(c.r)}</span> <em>${esc(c.dovod_en)}</em></li>`).join('')}</ul></div>` : ''}
  </div>`;
}

/* kratky pasik nad kartami: jeden riadok knihy, obe polovice */
export function htmlPasik(data, j, riadokId, strana) {
  const r = riadkyKnihy(data, j).find((q) => q.id === riadokId);
  if (!r) return '';
  const pol = (h, kto, ja) => `<span class="mc-pas-sv${ja ? ' ja' : ''}${h.stav === 'spravna' ? ' plna' : h.stav === 'diera' ? ' diera' : ''}"><b>${kto}</b> ${h.stav === 'spravna' ? (h.vlastny ? esc(h.text) : '“' + esc(h.text) + '”') : h.stav === 'diera' ? 'a hole' : ja ? 'your answer' : '…'}</span>`;
  return `<p class="mc-pasik"><span class="mc-pasik-h">Book of Witnesses · ${esc(r.en)}</span>${pol(r.l, 'Friend', strana === 'l')}${pol(r.p, 'Enemy', strana === 'p')}</p>`;
}

/* Zatvaranie Knihy svedkov v spalni (M54_kontrola): po trojiciach ako list v kap. 18. */
export function spustiKontrolu(o) {
  const { koren, data, j, zvuk, znizeny, naKoniec } = o;
  koren.innerHTML = `<div class="mc-list-obal mc-kontrola">${htmlKniha(data, j, { trieda: 'mc-sv-zatvara' })}<p class="mc-sv-stav" aria-live="polite">The Book of Witnesses closes three lines at a time.</p><p class="mc-akcie"><button type="button" class="mc-btn" data-dalej hidden>Close the book</button></p></div>`;
  const rr = riadkyKnihy(data, j);
  const trojice = [0, 1, 2].map((t) => rr.slice(t * 3, t * 3 + 3));
  const stav = koren.querySelector('.mc-sv-stav');
  const btn = koren.querySelector('[data-dalej]');
  let t = 0, zruseny = false;
  const krok = () => {
    if (zruseny) return;
    if (t >= trojice.length) {
      stav.textContent = 'Both witnesses agree where they must, and differ where they may. The book is closed.';
      btn.hidden = false; btn.textContent = 'Close the book';
      btn.focus({ preventScroll: true });
      return;
    }
    const tr = trojice[t];
    const zle = tr.filter((r) => r.otvoreny);
    const el = [...koren.querySelectorAll(`[data-trojica="${t}"]`)];
    if (zle.length) {
      el.forEach((e) => e.classList.add(zle.some((r) => r.id === e.dataset.r) ? 'nepotvrdeny' : 'caka'));
      stav.textContent = `Line “${zle.map((r) => r.en).join('”, “')}” is still open, so these three lines will not close.`;
      btn.hidden = false; btn.textContent = 'Go back to that moment';
      btn.focus({ preventScroll: true });
      return;
    }
    el.forEach((e) => e.classList.add('potvrdeny'));
    zvuk.zamok();
    t++;
    setTimeout(krok, znizeny ? 120 : 900);
  };
  btn.addEventListener('click', () => { zruseny = true; naKoniec(); });
  setTimeout(krok, znizeny ? 100 : 700);
  return { zavri() { zruseny = true; koren.innerHTML = ''; } };
}
