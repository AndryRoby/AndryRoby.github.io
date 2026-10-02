// Vstup stránky filmu: prehrávač na plátne v hube.
import film from './film.js';
import { prehravac } from './engine/prehravac.js';

const koren = document.getElementById('film');
if (koren) {
  // lišta ovládačov (Pause, zvuk, Play again) a živý titulok ležia pod #film, prehrávač ich hľadá aj v rodičovi
  const ovladace = koren.parentElement;
  prehravac(film, koren, { ovladace }).catch(() => {
    koren.dataset.kfStav = 'chyba';
    const p = ovladace.querySelector('[data-kf-titulok]');
    if (p) p.textContent = 'The film could not start in this browser. The text below describes every scene.';
  });
}
