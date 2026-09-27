// Vstup stránky filmu: prehrávač na plátne v hube.
// Po načítaní sa vytlačí len celý ostrov (plagát); ostrejšie úrovne tlače v nečinnosti prehliadača alebo
// hneď po ťuknutí na Play (film.dotlac), lebo vtedy ich film o chvíľu ukáže.
import film from './film.js';
import { prehravac } from './engine/prehravac.js';

const koren = document.getElementById('film');
if (koren) {
  const start = koren.querySelector('[data-kf-start]');
  if (start && film.dotlac) start.addEventListener('click', () => film.dotlac(), { once: true });
  prehravac(film, koren).catch(() => {
    koren.dataset.kfStav = 'chyba';
    const p = koren.querySelector('[data-kf-titulok]');
    if (p) p.textContent = 'The film could not start in this browser. The text below describes every scene.';
  });
}
