/* c08 Uder desiatej (kap. 69): hodiny s Amorom odbijaju desat, uder kazde 2 sekundy.
 * Wilmore otvori dvere na niektory uder (1 az 10 je presne, 5. je presne ako kniha,
 * r. 37601 az 37603). Jediny casovany ukon hry, preto ma nastavenie "No time limits":
 * hrac vtedy len vyberie, na ktory uder otvori. Casovace JS, stop pri document.hidden. */
import { esc } from '../ui.js';

export function spustiUder(o) {
  const { el, zvuk, bezCasu, naVysledok, titulok, znizeny } = o;
  let uder = 0, hotovo = false, casy = [];
  const zrus = () => { casy.forEach(clearTimeout); casy = []; };
  function render(pozn) {
    if (bezCasu) {
      el.innerHTML = `<div class="mc-uder"><p class="mc-uder-t">The clock is about to strike ten. On which stroke does Lord Wilmore open the door?</p>
        <div class="mc-uder-zoznam">${['Before the first', ...Array.from({ length: 10 }, (_, i) => String(i + 1))].map((t, i) => `<button type="button" class="mc-volba mc-uder-v" data-u="${i}">${esc(t)}</button>`).join('')}</div></div>`;
      el.querySelectorAll('[data-u]').forEach((b) => b.addEventListener('click', () => vysledok(Number(b.dataset.u))));
      setTimeout(() => { const b = el.querySelector('[data-u="1"]'); if (b) b.focus({ preventScroll: true }); }, 40);
      return;
    }
    el.innerHTML = `<div class="mc-uder"><p class="mc-uder-t">${esc(pozn || 'The clock with Cupid is about to strike ten. Open the door as it strikes.')}</p>
      <p class="mc-uder-rad" role="img" aria-label="${uder} strokes of ten">${Array.from({ length: 10 }, (_, i) => `<i class="${i < uder ? 'on' : ''}${i === 4 ? ' piaty' : ''}"></i>`).join('')}</p>
      <p class="mc-akcie mc-uder-akcie"><button type="button" class="mc-btn" data-otvor>Open the door</button></p></div>`;
    el.querySelector('[data-otvor]').addEventListener('click', () => vysledok(uder));
  }
  function start() {
    zrus();
    uder = 0;
    render();
    titulok(zvuk.tikot(0.6, 6), 0.6);
    const krok = znizeny ? 2000 : 2000;
    for (let i = 1; i <= 10; i++) casy.push(setTimeout(() => {
      if (hotovo) return;
      uder = i;
      zvuk.hodiny(1);
      titulok('The clock strikes: ' + i, 0.6);
      const r = el.querySelector('.mc-uder-rad');
      if (r) r.children[i - 1].classList.add('on');
    }, 3000 + (i - 1) * krok));
    casy.push(setTimeout(() => { if (!hotovo) vysledok(11); }, 3000 + 9 * krok + 2600));
  }
  function vysledok(u) {
    if (hotovo) return;
    hotovo = true;
    zrus();
    document.removeEventListener('visibilitychange', vid);
    naVysledok({ vcas: u >= 1 && u <= 10, uder: u });
  }
  function vid() { if (hotovo || bezCasu) return; if (document.hidden) zrus(); else start(); }
  document.addEventListener('visibilitychange', vid);
  if (bezCasu) render(); else start();
  const otvor = el.querySelector('[data-otvor]');
  if (otvor) setTimeout(() => otvor.focus({ preventScroll: true }), 40);
  return {
    stlac() { if (!bezCasu) vysledok(uder); },
    volba(n) { if (bezCasu && n >= 1 && n <= 9) vysledok(n); },
    zavri() { hotovo = true; zrus(); document.removeEventListener('visibilitychange', vid); el.innerHTML = ''; },
    uder: () => uder,
  };
}
