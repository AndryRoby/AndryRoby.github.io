// Vstup pre render (render.html): len plátno na celé okno, bez ovládačov, bez Umami.
// Ovláda ho ops/video/kodfilm/render.mjs cez window.__vykresli(t) a window.__zvuk().
import film from './film.js';
import { prehravac } from './engine/prehravac.js';

// Tvrdé strihy (výmeny mien v háku), aby podsnímky rozmazania pohybu cez ne neprechádzali.
// prehravac nastaví window.__film = { dlzka, plagat }; strihy sa doplnia pri tom istom priradení,
// teda skôr než render.mjs uvidí window.__pripraveny.
let filmInfo = null;
Object.defineProperty(window, '__film', {
  configurable: true,
  get: () => filmInfo,
  set: (v) => { filmInfo = v && typeof v === 'object' ? { ...v, strihy: film.strihy } : v; },
});

prehravac(film, document.querySelector('[data-kf]'), { render: true });
