// Vstup pre render (render.html): len plátno na celé okno, bez ovládačov, bez Umami.
// Ovláda ho ops/video/kodfilm/render.mjs cez window.__vykresli(t) a window.__zvuk().
// V rendri sa celá tlač ostrova vytlačí hneď vo vrstvy() (env.render), takže každá snímka je hotová.
import film from './film.js';
import { prehravac } from './engine/prehravac.js';

prehravac(film, document.querySelector('[data-kf]'), { render: true });
