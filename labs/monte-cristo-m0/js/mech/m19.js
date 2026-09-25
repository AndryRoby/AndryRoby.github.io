/* M19 Polospaleny list kardinala Spadu (kapitola 18, b13).
 *
 * Hrac priklada 14 utrzkov druheho listu (R1 az R14) k 16 riadkom spaleneho listu
 * (L1 az L16). Medzera za spalenym okrajom kazdeho riadku je v stlpcoch presne taka
 * dlha ako jeho utrzok: v texte Gutenbergu je druhy list zarovnany doprava na 49 stlpcov,
 * takze odsadenie utrzku je negativ spaleneho okraja (Faria: "measuring the length of
 * the lines by those of the paper", r. 8742 az 8743). Dlzka zuzi vyber, rozhodne spoj
 * slova a zmysel. Utrzky sa preto pisu po stlpcoch (kazde pismeno v rovnakej sirke).
 *
 * Potvrdenie po trojiciach (vzor Obra Dinn). Neuspech bez game over: najviac 2 chyby =
 * znak "almost"; viac = zle riadky zhasnu a utrzky sa vratia; po dvoch neuspesnych
 * kontrolach sa druhy list ukaze priesvitne na svojom mieste. Faria mlci: v kapitole 18
 * taka replika nie je (scenar-18.md, cast 0, bod 4). Nic nie je na cas. */

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stlpce = (t) => [...t].map((c) => `<i>${c === ' ' ? '&nbsp;' : esc(c)}</i>`).join('');
const dlzka = (t) => [...t.replace(/^\.\.\./, '')].length;

export function spustiM19(o) {
  const { koren, data, krok, dennik, zvuk, naKontrolu, naKoniec, oznam } = o;
  const doc = (id) => data.beaty.flatMap((b) => b.kroky).find((k) => k.id === id);
  const L = doc('list_spaleny').riadky;
  const R = doc('list_druhy').riadky;
  const Rmap = new Map(R.map((r) => [r.id, r]));
  const sloty = new Map(krok.sloty.map((s) => [s.slot, s]));
  const hinty = new Map(data.dennik.filter((d) => d.napoveda_pre).map((d) => [d.napoveda_pre, d]));

  const st = {
    v: new Map(), // slot -> id utrzku
    zamknute: new Set(),
    banka: shuffle(R.map((r) => r.id), 8708),
    riadok: 0, // index do fillable slotov
    utrzok: 0,
    kontroly: 0,
    pomoc: false,
    hotovo: false,
    drzany: null,
  };
  const plnitelne = L.filter((l) => sloty.get(l.id) && sloty.get(l.id).spravne);

  const el = document.createElement('div');
  el.className = 'm19';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Put the two fragments together');
  el.innerHTML = `
    <div class="m19-hlava"><p class="m19-nadpis">The burnt paper and Faria’s leaf</p><p class="m19-stav" aria-live="polite"></p></div>
    <div class="m19-list" tabindex="-1"><div class="m19-riadky"></div></div>
    <div class="m19-banka" role="listbox" aria-label="Fragments of Faria’s leaf"></div>
    <p class="m19-poznamka" aria-live="polite"></p>`;
  koren.appendChild(el);
  const riadkyEl = el.querySelector('.m19-riadky');
  const bankaEl = el.querySelector('.m19-banka');
  const stavEl = el.querySelector('.m19-stav');
  const poznEl = el.querySelector('.m19-poznamka');
  const listEl = el.querySelector('.m19-list');

  function textUtrzku(id) { return Rmap.get(id).text.replace(/^\.\.\./, ''); }

  function kresli() {
    const aktSlot = plnitelne[st.riadok] && plnitelne[st.riadok].id;
    riadkyEl.innerHTML = L.map((l) => {
      const sl = sloty.get(l.id);
      const bez = l.text.replace(/\.\.\.$/, '');
      const tri = l.text.endsWith('...') ? '<span class="m19-tri">...</span>' : '';
      if (!sl || !sl.spravne) return `<div class="m19-r m19-cely" data-r="${l.r[0]}"><span class="m19-l">${esc(bez)}${tri}</span></div>`;
      const id = st.v.get(l.id);
      const zamk = st.zamknute.has(l.id);
      let vnutro = '';
      if (id) {
        const n = dlzka(Rmap.get(id).text);
        const trieda = n > sl.medzera + 1 ? ' pretaha' : n < sl.medzera - 1 ? ' kratky' : '';
        vnutro = `<button type="button" class="m19-u m19-u-v${trieda}${zamk ? ' zamk' : ''}" data-u="${id}" ${zamk ? 'disabled' : ''} aria-label="${esc(textUtrzku(id))}${zamk ? ', confirmed' : ''}">${stlpce(textUtrzku(id))}</button>`;
      } else if (st.pomoc) {
        vnutro = `<span class="m19-duch" aria-hidden="true">${stlpce(textUtrzku(sl.spravne))}</span>`;
      }
      return `<div class="m19-r${aktSlot === l.id ? ' akt' : ''}${zamk ? ' zamk' : ''}" data-slot="${l.id}" data-r="${l.r[0]}">
        <span class="m19-l">${esc(bez)}${tri}</span><span class="m19-okraj" aria-hidden="true"></span><button type="button" class="m19-medzera" style="--n:${sl.medzera}" data-slot="${l.id}" aria-label="Burnt gap after “${esc(bez.slice(-18))}”, ${sl.medzera} letters long${zamk ? ', confirmed' : ''}">${vnutro}</button></div>`;
    }).join('');
    bankaEl.innerHTML = st.banka.map((id, i) =>
      `<button type="button" role="option" class="m19-u${i === st.utrzok ? ' akt' : ''}${st.drzany === id ? ' drzi' : ''}" data-u="${id}" style="--n:${dlzka(Rmap.get(id).text)}" aria-selected="${i === st.utrzok}" aria-label="${esc(textUtrzku(id))}"><span class="m19-tri">...</span>${stlpce(textUtrzku(id))}</button>`).join('') || '<p class="m19-prazdna">Every fragment is on the paper.</p>';
    const hotoveN = st.zamknute.size;
    stavEl.textContent = `${hotoveN} of ${plnitelne.length} lines confirmed`;
    const a = riadkyEl.querySelector('.m19-r.akt');
    if (a && a.scrollIntoView && listEl.scrollWidth > listEl.clientWidth + 4) {
      const m = a.querySelector('.m19-medzera');
      if (m) listEl.scrollLeft = Math.max(0, m.offsetLeft - listEl.clientWidth * 0.35);
    }
  }

  function poloz(slot, id) {
    if (st.hotovo || st.zamknute.has(slot) || !id) return;
    const bylo = st.v.get(slot);
    st.banka = st.banka.filter((x) => x !== id);
    if (bylo) st.banka.push(bylo);
    st.v.set(slot, id);
    st.utrzok = Math.min(st.utrzok, Math.max(0, st.banka.length - 1));
    zvuk.papier(0.6);
    poznEl.textContent = '';
    potvrdTrojice();
    kresli();
    skontroluj();
  }
  function vrat(slot) {
    if (st.hotovo || st.zamknute.has(slot)) return;
    const id = st.v.get(slot);
    if (!id) return;
    st.v.delete(slot);
    st.banka.push(id);
    st.utrzok = st.banka.length - 1;
    zvuk.papier(0.4);
    kresli();
  }
  function potvrdTrojice() {
    const dobre = plnitelne.filter((l) => !st.zamknute.has(l.id) && st.v.get(l.id) === sloty.get(l.id).spravne);
    if (dobre.length >= 3) {
      dobre.slice(0, 3).forEach((l) => st.zamknute.add(l.id));
      zvuk.zamok();
      oznam('Three lines hold together.');
    }
  }
  function skontroluj() {
    const plne = plnitelne.every((l) => st.v.has(l.id));
    if (!plne) return;
    const zle = plnitelne.filter((l) => st.v.get(l.id) !== sloty.get(l.id).spravne);
    if (!zle.length) {
      plnitelne.forEach((l) => st.zamknute.add(l.id));
      st.hotovo = true;
      kresli();
      el.classList.add('hotovo');
      zvuk.zamok();
      poznEl.textContent = '';
      oznam('The will reads whole.');
      setTimeout(() => naKoniec(), 1400);
      return;
    }
    st.kontroly++;
    naKontrolu(false);
    if (zle.length <= 2) {
      poznEl.innerHTML = '<span class="m19-takmer" aria-hidden="true">≈</span> almost';
      oznam('Almost. One or two lines do not join.');
    } else {
      const ids = zle.map((l) => l.id);
      riadkyEl.querySelectorAll(ids.map((i) => `[data-slot="${i}"] .m19-u-v`).join(',')).forEach((b) => b.classList.add('zhasina'));
      setTimeout(() => {
        ids.forEach((i) => { const u = st.v.get(i); if (u) { st.v.delete(i); st.banka.push(u); } });
        poznEl.textContent = '';
        kresli();
      }, 650);
      oznam('Several lines do not join. They go back.');
    }
    if (st.kontroly >= 2 && !st.pomoc) {
      st.pomoc = true;
      setTimeout(() => { kresli(); oznam('Faria’s leaf shows faintly where each fragment belongs.'); }, 700);
    }
  }
  function hint() {
    const l = plnitelne[st.riadok];
    if (!l) return;
    const sl = sloty.get(l.id);
    const h = hinty.get(l.id);
    bankaEl.querySelectorAll('.m19-u').forEach((b) => b.classList.remove('ceruzka'));
    if (h && dennik.has(h.id)) {
      const b = bankaEl.querySelector(`[data-u="${sl.spravne}"]`);
      if (b) b.classList.add('ceruzka');
      poznEl.innerHTML = `<span class="m19-cer">From Faria’s story:</span> ${esc(h.en.replace(/^Hint: /, ''))}`;
    } else if (h) poznEl.textContent = 'Something in Faria’s story belonged to this line, but you did not catch it.';
    else poznEl.textContent = 'Nothing you heard points to this line. Measure it, and read the words.';
  }

  /* mys a dotyk: klik utrzok, potom medzera; alebo tahat */
  let tah = null;
  el.addEventListener('pointerdown', (e) => {
    const u = e.target.closest('.m19-banka .m19-u');
    if (u && !st.hotovo) {
      tah = { id: u.dataset.u, x: e.clientX, y: e.clientY, duch: null, pohyb: false };
    }
  });
  el.addEventListener('pointermove', (e) => {
    if (!tah) return;
    if (!tah.pohyb && Math.hypot(e.clientX - tah.x, e.clientY - tah.y) > 8) {
      tah.pohyb = true;
      tah.duch = document.createElement('div');
      tah.duch.className = 'm19-u m19-tah';
      tah.duch.innerHTML = stlpce(textUtrzku(tah.id));
      el.appendChild(tah.duch);
    }
    if (tah.duch) { const r = el.getBoundingClientRect(); tah.duch.style.transform = `translate(${e.clientX - r.left - 12}px, ${e.clientY - r.top - 14}px)`; }
  });
  const pusti = (e) => {
    if (!tah) return;
    const t = tah; tah = null;
    if (t.duch) {
      t.duch.remove();
      const pod = document.elementFromPoint(e.clientX, e.clientY);
      const m = pod && pod.closest('[data-slot]');
      if (m) { st.drzany = null; poloz(m.dataset.slot, t.id); }
    }
  };
  el.addEventListener('pointerup', pusti);
  el.addEventListener('pointercancel', () => { if (tah && tah.duch) tah.duch.remove(); tah = null; });
  el.addEventListener('click', (e) => {
    const vloz = e.target.closest('.m19-u-v');
    if (vloz && !vloz.disabled) { const slot = vloz.closest('[data-slot]').dataset.slot; vrat(slot); return; }
    const m = e.target.closest('.m19-medzera');
    if (m) {
      const slot = m.dataset.slot;
      st.riadok = plnitelne.findIndex((l) => l.id === slot);
      if (st.drzany) { const id = st.drzany; st.drzany = null; poloz(slot, id); } else kresli();
      return;
    }
    const u = e.target.closest('.m19-banka .m19-u');
    if (u) { st.drzany = st.drzany === u.dataset.u ? null : u.dataset.u; st.utrzok = st.banka.indexOf(u.dataset.u); kresli(); }
  });

  kresli();
  const prvy = el.querySelector('.m19-banka .m19-u');
  if (prvy) prvy.focus({ preventScroll: true });

  return {
    el,
    /* akcie z vstup.js */
    akcia(a) {
      if (st.hotovo) return true;
      if (a === 'hore') { st.riadok = (st.riadok + plnitelne.length - 1) % plnitelne.length; kresli(); return true; }
      if (a === 'dole') { st.riadok = (st.riadok + 1) % plnitelne.length; kresli(); return true; }
      if (a === 'vlavo') { if (st.banka.length) st.utrzok = (st.utrzok + st.banka.length - 1) % st.banka.length; kresli(); return true; }
      if (a === 'vpravo') { if (st.banka.length) st.utrzok = (st.utrzok + 1) % st.banka.length; kresli(); return true; }
      if (a === 'interakcia') { const l = plnitelne[st.riadok]; poloz(l.id, st.banka[st.utrzok]); return true; }
      if (a === 'spat' || a === 'pocuvanie:start') { vrat(plnitelne[st.riadok].id); return true; }
      if (a === 'pozornost:start') { hint(); return true; }
      return false;
    },
    zavri() { el.remove(); },
    stav: st,
    /* pre testy: priloz spravne vsetko */
    vyries() { for (const l of plnitelne) if (!st.zamknute.has(l.id)) poloz(l.id, sloty.get(l.id).spravne); },
  };
}

function shuffle(arr, seed) {
  let a = seed >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const o = arr.slice();
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}
