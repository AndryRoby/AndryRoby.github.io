// Vstup stránky filmu: prehrávač na plátne v hube.
import film from './film.js';
import { prehravac } from './engine/prehravac.js';

const koren = document.getElementById('film');
if (koren) {
  prehravac(film, koren).catch(() => {
    koren.dataset.kfStav = 'chyba';
    const p = koren.querySelector('[data-kf-titulok]');
    if (p) p.textContent = 'The film could not start in this browser. The text below describes every scene.';
  });
}
