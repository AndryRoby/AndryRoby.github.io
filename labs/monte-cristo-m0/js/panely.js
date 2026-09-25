/* Dennik (Tab alebo J), pauza (Esc) s nastaveniami a historia replik (Backspace). */
import { esc, riadky } from './ui.js';
import { htmlKniha } from './mech/svedkovia.js';

export function vytvorPanely(koren, o) {
  const dEl = koren.querySelector('#mc-dennik');
  const pEl = koren.querySelector('#mc-pauza');
  const hEl = koren.querySelector('#mc-historia');
  let zalozka = 'poznamky', hladanie = '', otvoreny = null, predFokus = null;

  function knihaHtml() {
    const { od, riadky: rr } = o.kniha();
    if (!rr) return '<p class="mc-tichy">The chapter text did not load.</p>';
    const odseky = [];
    let cur = null;
    rr.forEach((t, i) => {
      if (!t.trim()) { cur = null; return; }
      if (!cur) { cur = { r: od + i, t: [] }; odseky.push(cur); }
      cur.t.push(t.trim());
      cur.k = od + i;
    });
    const q = hladanie.toLowerCase();
    return odseky.filter((p) => !q || p.t.join(' ').toLowerCase().includes(q)).map((p) => {
      let h = esc(p.t.join(' ')).replace(/_([^_]+)_/g, '<i>$1</i>');
      if (q) h = h.replace(new RegExp('(' + esc(hladanie).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>');
      return `<p class="mc-odsek" id="mc-r-${p.r}" data-od="${p.r}" data-do="${p.k}"><span class="mc-chip">${p.r}</span>${h}</p>`;
    }).join('') || '<p class="mc-tichy">Nothing in this chapter matches.</p>';
  }

  function zapisy(filter) {
    const st = o.stav();
    const q = hladanie.toLowerCase();
    const zoznam = o.data.dennik.filter(filter);
    const n = zoznam.filter((d) => st.dennik.has(d.id)).length;
    const polozky = zoznam.map((d) => {
      const ma = st.dennik.has(d.id);
      if (!ma && !st.dohrane) return '';
      if (q && !(ma ? d.en : '').toLowerCase().includes(q)) return '';
      const zatv = st.uzavrete[d.id];
      const chip = `<button type="button" class="mc-chip" data-skoc="${d.r[0]}" ${st.dohrane ? '' : 'disabled'}>${riadky(d.r)}</button>`;
      if (!ma) return `<li class="mc-neviem"><span class="mc-znak" aria-hidden="true">?</span><span>You did not notice this. The book has it here.</span> ${chip}</li>`;
      return `<li class="${d.otazka ? 'mc-otazka-z' : ''}${zatv != null ? ' zodpovedane' : ''}"><span class="mc-znak" aria-hidden="true">${d.otazka ? (zatv != null ? '✓' : '?') : '·'}</span><span>${esc(d.en.replace(/^Hint: /, ''))}${zatv ? `<br><em>${esc(zatv)}</em>` : ''}</span> ${chip}</li>`;
    }).join('');
    return { html: polozky, n, spolu: zoznam.length };
  }

  function kresliDennik() {
    const st = o.stav();
    const telo = dEl.querySelector('.mc-panel-telo');
    dEl.querySelectorAll('[role="tab"]').forEach((t) => { const a = t.dataset.z === zalozka; t.setAttribute('aria-selected', a); t.tabIndex = a ? 0 : -1; });
    const n = o.data ? o.data.kapitola : 18;
    const zt = dEl.querySelector('[data-z="faria"]');
    if (zt) zt.textContent = n === 69 ? 'Witnesses' : 'Faria’s story';
    if (zalozka === 'faria' && n === 69) {
      const j = o.jadro && o.jadro();
      telo.innerHTML = j ? htmlKniha(o.data, j) : '<p class="mc-tichy">The Book of Witnesses opens in the evening, at the abbé’s table.</p>';
    } else if (zalozka === 'poznamky') {
      const z = zapisy((d) => !d.napoveda_pre);
      telo.innerHTML = `<p class="mc-tichy">What you noticed in chapter ${n}. Each note shows where it is in the book.</p><ul class="mc-zapisy">${z.html || '<li class="mc-tichy">Nothing yet. Hold F, or the eye, when something may be worth a closer look.</li>'}</ul>`;
    } else if (zalozka === 'faria') {
      const z = zapisy((d) => !!d.napoveda_pre);
      telo.innerHTML = `<p class="mc-tichy">Words from Faria’s story you caught while listening: ${z.n} of ${z.spolu}. They help with the burnt paper.</p><ul class="mc-zapisy">${z.html || '<li class="mc-tichy">None yet. When a line of Faria’s is underlined, hold S, or the ear, to keep it.</li>'}</ul>`;
    } else {
      telo.innerHTML = st.dohrane ? `<div class="mc-kniha-text">${knihaHtml()}</div>` : `<p class="mc-zamknute">The book opens when you finish the chapter: all of chapter ${n} as Dumas wrote it, line by line.</p>`;
    }
    telo.querySelectorAll('[data-skoc]').forEach((b) => b.addEventListener('click', () => skoc(Number(b.dataset.skoc))));
  }
  function skoc(r) {
    zalozka = 'kniha';
    hladanie = '';
    dEl.querySelector('input').value = '';
    kresliDennik();
    const p = [...dEl.querySelectorAll('.mc-odsek')].find((e) => Number(e.dataset.od) <= r && Number(e.dataset.do) >= r);
    if (p) { p.classList.add('mc-svieti'); p.scrollIntoView({ block: 'center' }); }
  }

  function otvor(el, fokusSel) {
    if (otvoreny && otvoreny !== el) zavri();
    predFokus = document.activeElement;
    otvoreny = el;
    el.hidden = false;
    o.naOtvor && o.naOtvor();
    setTimeout(() => { const f = el.querySelector(fokusSel || 'button, input'); if (f) f.focus({ preventScroll: true }); }, 20);
  }
  function zavri() {
    if (!otvoreny) return;
    otvoreny.hidden = true;
    otvoreny = null;
    o.naZavri && o.naZavri();
    if (predFokus && predFokus.focus && document.contains(predFokus)) predFokus.focus({ preventScroll: true });
    else koren.querySelector('.mc-plocha').focus({ preventScroll: true });
  }

  /* dennik: kostra */
  dEl.innerHTML = `<div class="mc-panel-hlava"><h2 id="mc-dennik-h">Journal</h2>
    <div class="mc-zalozky" role="tablist" aria-label="Journal"><button type="button" role="tab" data-z="poznamky">Notes</button><button type="button" role="tab" data-z="faria">Faria’s story</button><button type="button" role="tab" data-z="kniha">Book</button></div>
    <label class="mc-hladaj"><span class="mc-sr">Search the journal</span><input type="search" placeholder="Search" autocomplete="off"></label>
    <button type="button" class="mc-zavri" aria-label="Close the journal">Close</button></div><div class="mc-panel-telo" role="tabpanel" tabindex="0"></div>`;
  dEl.querySelectorAll('[role="tab"]').forEach((t) => t.addEventListener('click', () => { zalozka = t.dataset.z; kresliDennik(); }));
  dEl.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.stopPropagation(); e.preventDefault();
    const z = ['poznamky', 'faria', 'kniha'];
    zalozka = z[(z.indexOf(zalozka) + (e.key === 'ArrowRight' ? 1 : 2)) % 3];
    kresliDennik();
    dEl.querySelector(`[data-z="${zalozka}"]`).focus();
  });
  dEl.querySelector('input').addEventListener('input', (e) => { hladanie = e.target.value.trim(); kresliDennik(); });
  dEl.querySelector('.mc-zavri').addEventListener('click', zavri);

  /* pauza */
  const n = o.nastavenia;
  pEl.innerHTML = `<div class="mc-panel-hlava"><h2>Paused</h2><button type="button" class="mc-zavri" aria-label="Resume">Resume</button></div>
    <div class="mc-panel-telo mc-pauza-telo">
      <p class="mc-akcie"><button type="button" class="mc-btn" data-a="pokracuj">Resume</button><button type="button" class="mc-btn mc-btn-tichy" data-a="dennik">Journal</button><button type="button" class="mc-btn mc-btn-tichy" data-a="znova">Restart chapter</button><button type="button" class="mc-btn mc-btn-tichy" data-a="titul">Title page</button></p>
      <fieldset class="mc-nast"><legend>Settings</legend>
        <label><input type="checkbox" data-n="prepinac"> Hold to toggle: press once to start holding, once more to stop</label>
        <label><input type="checkbox" data-n="znizeny"> Reduce motion: no parallax, no drifting, the camera cuts</label>
        <label><input type="checkbox" data-n="bezCasu"> No time limits: in chapter 69, choose the stroke of the clock instead of timing it</label>
        <label><input type="checkbox" data-n="citatelne"> Readable font everywhere</label>
        <label><input type="checkbox" data-n="riadky"> Show the novel’s line number beside every line</label>
        <label><input type="checkbox" data-n="zvuk"> Sound, made in your browser</label>
        <label class="mc-hlasitost">Volume <input type="range" min="0" max="1" step="0.05" data-n="hlasitost"></label>
      </fieldset>
      <p class="mc-tichy" data-ulozenie></p>
      <p class="mc-tichy">Keys: A and D walk, E or Space goes on and holds, F looks closely, S listens, 1 to 9 choose, Tab or J opens the journal, Backspace shows earlier lines, Esc pauses. A gamepad and touch work too.</p>
    </div>`;
  pEl.querySelectorAll('[data-n]').forEach((i) => {
    if (i.type === 'checkbox') i.checked = !!n[i.dataset.n]; else i.value = n[i.dataset.n];
    i.addEventListener('input', () => { n[i.dataset.n] = i.type === 'checkbox' ? i.checked : Number(i.value); o.naNastavenia(n); });
  });
  pEl.querySelector('.mc-zavri').addEventListener('click', zavri);
  pEl.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.a;
    if (a === 'pokracuj') zavri();
    if (a === 'dennik') { zavri(); api.dennik(); }
    if (a === 'znova') { zavri(); o.naZnova(); }
    if (a === 'titul') { zavri(); o.naTitul(); }
  }));

  hEl.innerHTML = `<div class="mc-panel-hlava"><h2>Earlier lines</h2><button type="button" class="mc-zavri">Close</button></div><div class="mc-panel-telo"><ol class="mc-hist"></ol></div>`;
  hEl.querySelector('.mc-zavri').addEventListener('click', zavri);

  const api = {
    dennik(z) { if (z) zalozka = z; kresliDennik(); otvor(dEl, '[role="tab"][aria-selected="true"]'); },
    pauza() {
      pEl.querySelector('[data-ulozenie]').textContent = o.ulozenieIde() ? 'Your progress is kept in this browser at every checkpoint of the chapter.' : 'Progress is not saved in this browser.';
      otvor(pEl);
    },
    historia() {
      const h = o.historia().slice(-40);
      hEl.querySelector('.mc-hist').innerHTML = h.length ? h.map((x) => `<li><span class="mc-kto">${esc(x.kto)}</span><span class="mc-t-${x.druh}">${x.html}</span> <span class="mc-chip">${esc(x.r)}</span></li>`).join('') : '<li class="mc-tichy">No lines yet.</li>';
      otvor(hEl);
      const t = hEl.querySelector('.mc-panel-telo'); t.scrollTop = t.scrollHeight;
    },
    zavri,
    otvoreny: () => otvoreny,
    obnov() { if (otvoreny === dEl) kresliDennik(); },
    prepni(ktory) {
      const el = ktory === 'dennik' ? dEl : ktory === 'pauza' ? pEl : hEl;
      if (otvoreny === el) zavri(); else if (ktory === 'dennik') api.dennik(); else if (ktory === 'pauza') api.pauza(); else api.historia();
    },
  };
  return api;
}
