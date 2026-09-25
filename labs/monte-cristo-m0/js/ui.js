/* Rozhranie v DOM: pas s replikou, volby, vyzvy, stranky knihy, listy, Dennik,
 * historia replik, pauza a titulky zvukov. Text je v DOM, takze nova replika
 * neprekresluje platno a citacka ju precita (aria-live). */

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const MENA = { edmond: 'Edmond', faria: 'Faria', guverner: 'The governor', busoni: 'Abbé Busoni', wilmore: 'Lord Wilmore', vyslanec: 'The envoy', komornik: 'The valet', sluha: 'The man at the door' };

/* Doslovny text do HTML: […] ako vynechanie, kurziva podla zdroja, zachytena veta podciarknuta. */
export function formatuj(text, r, kurziva, zachyt) {
  let h = esc(text);
  if (zachyt) {
    const v = esc(zachyt);
    const i = h.indexOf(v);
    if (i >= 0) h = h.slice(0, i) + `<span class="mc-zachyt" data-zachyt>${v}</span>` + h.slice(i + v.length);
  }
  for (const it of kurziva || []) {
    if (!r || it.r < r[0] || it.r > r[1]) continue;
    const v = esc(it.t);
    const re = new RegExp('(^|[^\\w])(' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?=[^\\w]|$)');
    h = h.replace(re, '$1<i>$2</i>');
  }
  return h.replace(/\s*\[…\]\s*/g, '<span class="mc-vyn" title="words left out"> … </span>');
}
export const riadky = (r) => (!r ? '' : r[0] === r[1] ? `l. ${r[0]}` : `ll. ${r[0]} to ${r[1]}`);

export function vytvorUI(koren, o) {
  const $ = (s) => koren.querySelector(s);
  const pas = $('#mc-pas'), kto = $('.mc-kto'), text = $('.mc-text'), rEl = $('#mc-r');
  const volbyEl = $('#mc-volby'), vyzvaEl = $('#mc-vyzva'), dalejEl = $('#mc-dalej');
  const vrstva = $('#mc-vrstva'), cieleEl = $('#mc-ciele'), titulky = $('#mc-titulky'), toastEl = $('#mc-toast');
  const oko = $('#mc-oko'), ucho = $('#mc-ucho');
  const historia = [];
  let toastCas = 0, titCas = 0;

  const ui = {
    /* ── pas s replikou ── */
    replika(k, extra) {
      const druh = k.typ === 'rozpravanie' ? 'kniha' : k.vnutorne ? 'vnutorne' : k.kto || 'kniha';
      kto.textContent = k.typ === 'rozpravanie' ? '' : (MENA[k.kto] || '') + (k.vnutorne ? ', to himself' : '');
      text.className = 'mc-text mc-t-' + druh + (k.kto ? ' mc-t-' + k.kto : '');
      text.innerHTML = formatuj(k.text, k.r, o.kurziva, k.zachyt && k.zachyt.veta);
      rEl.textContent = riadky(k.r);
      pas.classList.remove('mc-nove'); void pas.offsetWidth; pas.classList.add('mc-nove');
      historia.push({ kto: kto.textContent, druh, html: text.innerHTML, r: rEl.textContent });
      if (historia.length > 80) historia.shift();
      ui.volby(null);
      ui.dalej(true);
      if (extra && extra.zachytene) ui.zachytene();
    },
    vlastny(html, r) {
      kto.textContent = '';
      text.className = 'mc-text mc-t-hra';
      text.innerHTML = html;
      rEl.textContent = r || '';
    },
    vycisti() { kto.textContent = ''; text.innerHTML = ''; rEl.textContent = ''; },
    zachytene() {
      const z = text.querySelector('[data-zachyt]');
      if (z) z.classList.add('mc-zachytene');
    },
    dalej(zap, popis) {
      dalejEl.hidden = !zap;
      if (popis) dalejEl.querySelector('span').textContent = popis;
      else dalejEl.querySelector('span').textContent = 'Continue';
    },
    volby(zoznam, naVyber) {
      volbyEl.classList.remove('mc-karty', 'mc-volby-panel');
      if (!zoznam) { volbyEl.hidden = true; volbyEl.innerHTML = ''; return; }
      volbyEl.hidden = false;
      volbyEl.innerHTML = zoznam.map((m, i) => `<button type="button" class="mc-volba" data-i="${i}"><kbd>${i + 1}</kbd><span>${esc(m)}</span></button>`).join('');
      volbyEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => naVyber(Number(b.dataset.i))));
      ui.dalej(false);
      setTimeout(() => { const b = volbyEl.querySelector('button'); if (b) b.focus({ preventScroll: true }); }, 30);
    },
    /* karty svedkov: doslovna veta z knihy, riadok, pismo podla postavy, ceruzka a poznamka */
    karty(zoznam, naVyber) {
      volbyEl.hidden = false;
      volbyEl.classList.add('mc-karty');
      volbyEl.innerHTML = zoznam.map((c, i) => `<button type="button" class="mc-volba mc-karta mc-t-${c.kto}${c.ceruzka ? ' ceruzka' : ''}${c.text.split(/\s+/).length > 36 ? ' dlha' : ''}" data-id="${esc(c.id)}"><kbd>${i + 1}</kbd><span class="mc-karta-t">${c.kto === 'kniha' ? '' : '“'}${formatuj(c.text, c.r, o.kurziva)}${c.kto === 'kniha' ? '' : '”'}${c.pozn ? `<em class="mc-karta-pozn">${esc(c.pozn)}</em>` : ''}</span><span class="mc-chip">${riadky(c.r)}</span></button>`).join('');
      volbyEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => naVyber(b.dataset.id)));
      ui.dalej(false);
      setTimeout(() => { const b = volbyEl.querySelector('button'); if (b) b.focus({ preventScroll: true }); }, 30);
    },
    /* prazdny panel volieb pre prevlek a uder (obsah si kreslia moduly v mech/) */
    volbyPanel() {
      volbyEl.hidden = false;
      volbyEl.classList.add('mc-volby-panel');
      volbyEl.innerHTML = '';
      ui.dalej(false);
      return volbyEl;
    },
    focusVolba(smer) {
      const b = [...volbyEl.querySelectorAll('button')];
      if (!b.length) return false;
      let i = b.indexOf(document.activeElement);
      i = i < 0 ? 0 : (i + smer + b.length) % b.length;
      b[i].focus();
      return true;
    },
    vyzva(html) {
      if (!html) { vyzvaEl.hidden = true; vyzvaEl.innerHTML = ''; return; }
      vyzvaEl.hidden = false;
      vyzvaEl.innerHTML = html;
    },
    postup(p) { vyzvaEl.style.setProperty('--p', Math.max(0, Math.min(1, p)).toFixed(3)); },
    oko(pulz) { oko.classList.toggle('mc-pulz', !!pulz); },
    ucho(pulz) { ucho.classList.toggle('mc-pulz', !!pulz); },
    drziOko(zap) { oko.classList.toggle('mc-drzi', !!zap); },
    drziUcho(zap) { ucho.classList.toggle('mc-drzi', !!zap); },

    toast(t) {
      toastEl.textContent = t;
      toastEl.classList.add('mc-vid');
      clearTimeout(toastCas);
      toastCas = setTimeout(() => toastEl.classList.remove('mc-vid'), 2600);
    },
    titulok(t, smer) {
      if (!t) return;
      const sip = smer < -0.2 ? '← ' : smer > 0.2 ? ' →' : '';
      titulky.textContent = '[' + (smer < -0.2 ? sip : '') + t + (smer > 0.2 ? sip : '') + ']';
      titulky.classList.add('mc-vid');
      clearTimeout(titCas);
      titCas = setTimeout(() => titulky.classList.remove('mc-vid'), 3800);
    },

    /* ── ciele Pozornosti ── */
    ciele(zoznam, naKlik) {
      zoznam = zoznam || [];
      const kluc = zoznam.map((c) => c.id).join('|');
      if (kluc === cieleEl.dataset.k) {
        /* tie iste ciele: len posun, aby sa animacia prichodu neopakovala */
        zoznam.forEach((c) => { const b = cieleEl.querySelector(`[data-id="${c.id}"]`); if (b) { b.style.left = c.x.toFixed(1) + 'px'; b.style.top = c.y.toFixed(1) + 'px'; } });
        return;
      }
      cieleEl.dataset.k = kluc;
      cieleEl.innerHTML = zoznam.map((c) => `<button type="button" class="mc-ciel${c.nad ? ' nad' : ''}" data-id="${c.id}" style="left:${c.x.toFixed(1)}px;top:${c.y.toFixed(1)}px" aria-label="Notice ${esc(c.en)}"><span>${esc(c.en)}</span></button>`).join('');
      cieleEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); naKlik(b.dataset.id); }));
    },

    /* ── stranky a listy vo vrstve nad platnom ── */
    vrstva(html, trieda) {
      vrstva.innerHTML = '';
      koren.classList.toggle('mc-vrstva-zap', !!html);
      koren.classList.remove('mc-m19-rezim');
      if (!html) { vrstva.className = 'mc-vrstva'; return null; }
      vrstva.className = 'mc-vrstva mc-aktivna ' + (trieda || '');
      const d = document.createElement('div');
      d.className = 'mc-list-obal';
      d.innerHTML = html;
      vrstva.appendChild(d);
      return d;
    },
    vrstvaEl: vrstva,
    volbyEl,

    historia() { return historia; },
  };
  return ui;
}
