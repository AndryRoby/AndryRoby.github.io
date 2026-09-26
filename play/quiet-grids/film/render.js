// Vstup pre render (render.html): len plátno na celé okno, bez ovládačov, bez Umami.
// Ovláda ho ops/video/kodfilm/render.mjs cez window.__vykresli(t) a window.__zvuk().
// Záver sa dá zvoliť parametrom: render.html?zaver=google-play alebo ?zaver=obchod (predvolene coming-soon).
import film from './film.js';
import { prehravac } from './engine/prehravac.js';

prehravac(film, document.querySelector('[data-kf]'), { render: true });
