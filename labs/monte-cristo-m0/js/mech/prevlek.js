/* P6 Prevlek po vrstvach (kap. 69, c03 Busoni bez neuspechu, c07 Wilmore s tahovym casom).
 * Vrstvy su doslovne z knihy (data-69.json), pravidla poradia "po" a "pred" su NAVRH.
 * Cas je tahovy, nie skutocny: kazdy tah (oblecenie, zle polozenie, vyzlecenie) stoji minutu.
 * Nic nie je na rychlost; kazda vrstva je tlacidlo (mys, dotyk, klaves 1 az 8, gamepad). */
import { esc, riadky } from '../ui.js';

/* poradie v zozname nie je riesenie (NAVRH) */
const PORADIE_W = ['kabat', 'vlasy', 'jazva', 'nohavice', 'celust', 'vesta', 'bokombrady', 'plet'];

export function spustiPrevlek(o) {
  const { el, vrstvy, rezim, en, zvuk, naZmenu, naKoniec } = o;
  const wil = rezim === 'wilmore';
  const byId = new Map(vrstvy.map((v) => [v.id, v]));
  const zoznam = wil ? PORADIE_W.filter((id) => byId.has(id)).map((id) => byId.get(id)) : vrstvy.slice();
  const oblecene = new Set(o.zaciatok || []);
  let minut = wil ? o.minut || 10 : Infinity;
  let hotovo = false;
  const EN = (id) => en[id] || id;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function smieObliect(id) {
    const q = byId.get(id);
    for (const p of q.po || []) if (!oblecene.has(p)) return `${cap(EN(id))} goes on over ${EN(p)}.`;
    for (const p of q.pred || []) if (oblecene.has(p)) return `${cap(EN(id))} has to go on before ${EN(p)}.`;
    return null;
  }
  function smieVyzliect(id) {
    for (const x of oblecene) { const q = byId.get(x); if ((q.po || []).includes(id)) return `Take off ${EN(x)} first.`; }
    for (const p of byId.get(id).pred || []) if (oblecene.has(p)) return `Take off ${EN(p)} first.`;
    return null;
  }
  function render(pozn) {
    const bodky = wil ? Array.from({ length: o.minut || 10 }, (_, i) => `<i class="${i < minut ? 'zost' : ''}"></i>`).join('') : '';
    el.innerHTML = `<div class="mc-prevlek${wil ? ' mc-pv-w' : ''}">
      <p class="mc-pv-hlava"><b>${wil ? 'Dress as Lord Wilmore' : 'Dress as the abbé Busoni'}</b>
        ${wil ? `<span class="mc-pv-cas" role="img" aria-label="${minut} minutes before ten">${bodky}<span>${minut} ${minut === 1 ? 'minute' : 'minutes'} before ten</span></span>` : '<span class="mc-pv-cas"><span>Nothing here can go wrong.</span></span>'}</p>
      <div class="mc-pv-vrstvy">${zoznam.map((v, i) => `<button type="button" class="mc-volba mc-pv-v${oblecene.has(v.id) ? ' oblecene' : ''}" data-id="${v.id}" aria-pressed="${oblecene.has(v.id)}"><kbd>${i + 1}</kbd><span class="mc-pv-t">${esc(v.text)}</span><span class="mc-chip">${riadky(v.r)}</span></button>`).join('')}</div>
      <p class="mc-pv-pozn" aria-live="polite">${esc(pozn || (wil ? 'Each garment takes a minute, and so does a mistake. Choose one to put it on, choose it again to take it off.' : 'Choose each piece to put it on.'))}</p>
      ${wil ? '<p class="mc-akcie mc-pv-akcie"><button type="button" class="mc-btn" data-hotovo>Ready: wait by the door</button></p>' : ''}
    </div>`;
    el.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => prepni(b.dataset.id)));
    const h = el.querySelector('[data-hotovo]');
    if (h) h.addEventListener('click', () => koniec(false));
  }
  function minuta() {
    if (!wil) return;
    minut = Math.max(0, minut - 1);
  }
  function prepni(id, zFokusu) {
    if (hotovo || !byId.has(id)) return;
    let pozn = '';
    if (oblecene.has(id)) {
      const zle = smieVyzliect(id);
      if (zle) pozn = zle;
      else { oblecene.delete(id); minuta(); pozn = wil ? `You take off ${EN(id)}. A minute gone.` : ''; zvuk.latka(0); }
    } else {
      const zle = smieObliect(id);
      if (zle) { minuta(); pozn = wil ? zle + ' A minute gone.' : zle; }
      else { oblecene.add(id); minuta(); zvuk.latka(0); pozn = byId.get(id).skryta ? `${cap(EN(id))}: no one will see it under the collar.` : ''; }
    }
    naZmenu([...oblecene], id);
    render(pozn);
    const f = el.querySelector(`[data-id="${id}"]`);
    if (f && zFokusu !== false) f.focus({ preventScroll: true });
    if (!wil && zoznam.every((v) => oblecene.has(v.id))) { hotovo = true; setTimeout(() => naKoniec({ vrstvy: [...oblecene] }), 500); return; }
    if (wil && minut <= 0) {
      hotovo = true;
      const plny = zoznam.filter((v) => !v.skryta).every((v) => oblecene.has(v.id));
      setTimeout(() => naKoniec({ vrstvy: [...oblecene], neskoro: !plny }), 700);
    }
  }
  function koniec(neskoro) {
    if (hotovo) return;
    hotovo = true;
    naKoniec({ vrstvy: [...oblecene], neskoro });
  }
  render();
  setTimeout(() => { const b = el.querySelector('[data-id]'); if (b) b.focus({ preventScroll: true }); }, 40);
  return {
    volba(n) { const v = zoznam[n - 1]; if (v) prepni(v.id); },
    zavri() { hotovo = true; el.innerHTML = ''; },
    stav: () => ({ oblecene: [...oblecene], minut }),
    vyries() { for (const v of zoznam) if (!oblecene.has(v.id)) { oblecene.add(v.id); } naZmenu([...oblecene]); koniec(false); },
  };
}
