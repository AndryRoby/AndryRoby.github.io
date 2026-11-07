// Pohyb a drobné ovládanie /agent-ready/ (6. 11. 2026). Tri jednorazové momenty podľa návrhu (postup krokov, prepínač
// Issue list / After Re-check, rast dvoch pruhov štúdie), plus tlačidlo Install v mobilnej hlavičke a zatváranie menu.
// Bez JS a pri obmedzenom pohybe je všetko v koncovom stave; nič nebeží donekonečna.
import { createSegmented } from '/motion/components/segmented/segmented.js';

const d = document;
const w = window;
const reduced = w.matchMedia('(prefers-reduced-motion: reduce)').matches;
const io = 'IntersectionObserver' in w;
d.documentElement.classList.add('js');

// Mobilná hlavička: Install sa ukáže, keď tlačidlo úvodu odíde pod hlavičku.
const hlava = d.querySelector('.hlava');
const akcieUvodu = d.querySelector('.hrdina .akcie');
if (hlava && akcieUvodu && io) {
  new IntersectionObserver((e) => {
    const x = e[e.length - 1];
    hlava.classList.toggle('ukaz-install', !x.isIntersecting && x.boundingClientRect.top < 0);
  }, { rootMargin: '-64px 0px 0px 0px' }).observe(akcieUvodu);
} else if (hlava) hlava.classList.add('ukaz-install');

// Menu (<details>): zavrie sa po výbere odkazu, klávesou Escape a klikom mimo neho.
const menu = d.querySelector('.menu');
if (menu) {
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) menu.open = false; });
  d.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); }
  });
  d.addEventListener('click', (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
}

// 1) Postup krokov: keď zoznam príde do obrazu, uzly sa postupne rozsvietia a čiara narastie, raz.
const kroky = d.querySelector('.kroky');
if (kroky && !reduced && io && kroky.getBoundingClientRect().top > w.innerHeight) {
  kroky.classList.add('pred');
  const o = new IntersectionObserver((e) => {
    if (!e.some((x) => x.isIntersecting)) return;
    o.disconnect();
    kroky.classList.remove('pred');
    kroky.classList.add('hra');
  }, { threshold: 0.5 });
  o.observe(kroky);
}

// 2) Prepínač Issue list / After Re-check: okná si vymenia poradie. Ak sa ho nikto nedotkol, raz sa sám prepne
//    2,6 s po vstupe do obrazu. Obe okná majú rovnaký rozmer, takže prepnutie nič neposunie.
const okna = d.querySelector('.okna');
const prepinac = d.querySelector('.prepinac');
if (okna && prepinac) {
  let dotknute = false;
  const ukaz = (hodnota) => okna.classList.toggle('oprava-vpredu', hodnota === 'oprava');
  const seg = createSegmented({ root: prepinac, onChange: (i, v) => { dotknute = true; ukaz(v); } });
  if (!reduced && io) {
    const o = new IntersectionObserver((e) => {
      if (!e.some((x) => x.isIntersecting)) return;
      o.disconnect();
      setTimeout(() => { if (!dotknute) { seg.select(1); ukaz('oprava'); } }, 2600);
    }, { threshold: 0.5 });
    o.observe(okna);
  }
}

// 3) Pruhy štúdie: narastú zľava raz pri vstupe do obrazu; čísla sú statický text od začiatku.
const pruhy = d.querySelector('.pruhy');
if (pruhy && !reduced && io && pruhy.getBoundingClientRect().top > w.innerHeight) {
  pruhy.classList.add('pred');
  const o = new IntersectionObserver((e) => {
    if (!e.some((x) => x.isIntersecting)) return;
    o.disconnect();
    requestAnimationFrame(() => pruhy.classList.remove('pred'));
  }, { threshold: 0.35 });
  o.observe(pruhy);
}
