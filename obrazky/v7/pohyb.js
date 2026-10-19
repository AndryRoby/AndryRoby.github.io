// Pohyb úvodu v7 nad knižnicou ARLing Motion (arling.sk/motion, MIT): pružiny ako čisté funkcie času.
// Štyri momenty, nič navyše: rolujúce číslice počítadla katalógu, rast pruhov a čísel zo štúdie pri posune,
// prepínač obrazoviek appky s pružinovým indikátorom a jemné vstupy sekcií (rozmazanie, posun, mierka).
// Bez JS a pri obmedzenom pohybe je všetko hneď v koncovom stave.
import { track, presence, driver, PRESETS } from '/motion/src/core.js';
import { createNumber } from '/motion/components/number/number.js';
import { createSegmented } from '/motion/components/segmented/segmented.js';

const d = document;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lang = d.documentElement.lang || 'sk';
// Percentá v zápise jazyka stránky: en 74.3%, sk a de 74,3 % s pevnou medzerou (ako v statickom HTML).
const percento = lang === 'en' ? '%' : ' %';
window.__pohyb = true;

// 1) Počítadlo katalógu v hrdinovi: rolujúce číslice, keď sa scéna rozbehne.
const pocet = d.getElementById('pocet');
if (pocet) {
  const n = createNumber({ el: pocet, value: reduced ? 11 : 0, decimals: 0, locale: lang });
  const spusti = () => setTimeout(() => n.set(11), 120);
  const scena = d.getElementById('scena');
  if (reduced) n.set(11);
  else if (scena && scena.classList.contains('hra')) n.set(11);
  else if (scena) scena.addEventListener('scena-start', spusti, { once: true });
}

// 2) Štúdia: pruhy rastú zľava a čísla rolujú od nuly, raz, keď sekcia príde do obrazu.
const pruhy = [...d.querySelectorAll('.pruhy li')];
if (pruhy.length) {
  const zoznam = pruhy.map((li) => {
    const c = li.querySelector('[data-cislo]');
    const ciel = Number(c.getAttribute('data-cislo'));
    const num = createNumber({ el: c, value: reduced ? ciel : 0, decimals: 1, suffix: percento, locale: lang });
    const bar = li.querySelector('i');
    const sirka = track(reduced ? 1 : 0, PRESETS.smooth);
    return { num, ciel, bar, sirka };
  });
  const kresli = driver((t, { reduced: r }) => {
    for (const z of zoznam) z.bar.style.transform = `scaleX(${(r ? z.sirka.target(t) : Math.max(0, z.sirka.at(t))).toFixed(4)})`;
  });
  kresli.busy = (t) => zoznam.some((z) => !z.sirka.settled(t));
  if (!reduced) {
    for (const z of zoznam) z.bar.style.transform = 'scaleX(0)';
    const io = new IntersectionObserver((e) => {
      if (!e.some((x) => x.isIntersecting)) return;
      io.disconnect();
      const t0 = kresli.now();
      zoznam.forEach((z, i) => {
        z.sirka.to(t0 + i * 0.09, 1);
        setTimeout(() => z.num.set(z.ciel), i * 90);
      });
      kresli.kick();
    }, { threshold: 0.35 });
    io.observe(d.querySelector('.pruhy'));
  }
}

// 3) Produkt v akcii: prepínač Nálezy a Po oprave (segmented control z knižnice), obrazovky si vymenia poradie.
const vizual = d.querySelector('.akcia-vizual');
const prepinac = d.querySelector('.prepinac');
if (vizual && prepinac) {
  let dotknute = false;
  const ukaz = (hodnota) => vizual.classList.toggle('oprava-vpredu', hodnota === 'oprava');
  const seg = createSegmented({ root: prepinac, onChange: (i, v) => { dotknute = true; ukaz(v); } });
  // Raz ukáže celý postup: po chvíli v obraze prepne na obrazovku po oprave, ak sa používateľ nedotkol.
  if (!reduced) {
    const io = new IntersectionObserver((e) => {
      if (!e.some((x) => x.isIntersecting)) return;
      io.disconnect();
      setTimeout(() => { if (!dotknute) { seg.select(1); ukaz('oprava'); } }, 2600);
    }, { threshold: 0.5 });
    io.observe(vizual);
  }
}

// 4) Vstupy sekcií: nadpis, text a hlavný obraz každej sekcie, s krokom 70 ms, raz.
if (!reduced && 'IntersectionObserver' in window) {
  const prvky = [...d.querySelectorAll('[data-vstup]')].filter((el) => el.getBoundingClientRect().top > innerHeight * 0.9);
  const stav = new Map(prvky.map((el) => [el, presence(false, { blur: 8, dyIn: 18, scaleFrom: 0.97 })]));
  // Len priehľadnosť, rozmazanie a posun, nikdy visibility:hidden (applyPresence z knižnice ho nastaví pri neviditeľnom stave):
  // obsah pod ohybom ostáva v strome prístupnosti a čítačka nájde nadpisy aj pred posunom (Lighthouse heading-order, 19. 10. 2026).
  const vstup = (el, s) => {
    el.style.opacity = String(s.opacity);
    el.style.filter = s.blur > 0.05 ? `blur(${s.blur.toFixed(2)}px)` : '';
    el.style.transform = `translateY(${s.y.toFixed(2)}px) scale(${s.scale.toFixed(4)})`;
  };
  const kresli = driver((t) => { for (const [el, p] of stav) vstup(el, p.at(t)); });
  kresli.busy = (t) => [...stav.values()].some((p) => !p.settled(t));
  for (const [el, p] of stav) vstup(el, p.at(0));
  const io = new IntersectionObserver((e) => {
    const t0 = kresli.now();
    const nove = e.filter((x) => x.isIntersecting).map((x) => x.target);
    nove.forEach((el, i) => { stav.get(el).enter(t0 + i * 0.07); io.unobserve(el); });
    if (nove.length) kresli.kick();
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
  prvky.forEach((el) => io.observe(el));
}
