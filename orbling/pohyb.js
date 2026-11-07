// Pohyb stránky arling.sk/orbling/ nad knižnicou ARLing Motion (arling.sk/motion, MIT), vzor obrazky/v7/pohyb.js domova.
// Tri momenty, každý raz: scéna v úvode (návrhy AI prídu, Accept all, náhľad dostane nový fakt a otázku), postup krokov
// „From your catalog to a published page“ a jemné vstupy sekcií (bez rozmazania). Bez JS a pri obmedzenom pohybe je všetko v koncovom stave.
// Navyše hlavička po posune a menu na mobile (bez JS funguje cez :target).
import { presence, driver } from '/motion/src/core.js';

const d = document;
const w = window;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Hlavička: pozadie po posune o 8 px.
const hlava = d.getElementById('hlava');
if (hlava) {
  const posun = () => hlava.classList.toggle('posunute', w.scrollY > 8);
  w.addEventListener('scroll', posun, { passive: true });
  posun();
}

// Menu na mobile: celá obrazovka, pozadie inert, Escape a návrat fokusu.
const mob = d.getElementById('mob');
const mobBtn = d.querySelector('.menu-mob');
if (mob && mobBtn) {
  const mobZavri = mob.querySelector('.mob-zavri');
  const pozadie = [hlava, d.getElementById('obsah'), d.querySelector('.pata')];
  const nastav = (otvorene) => {
    mob.classList.toggle('otvorene', otvorene);
    mobBtn.setAttribute('aria-expanded', String(otvorene));
    d.body.style.overflow = otvorene ? 'hidden' : '';
    pozadie.forEach((x) => { if (x) x.inert = otvorene; });
  };
  mobBtn.addEventListener('click', (e) => { e.preventDefault(); nastav(true); setTimeout(() => mobZavri.focus(), 40); });
  mobZavri.addEventListener('click', (e) => { e.preventDefault(); nastav(false); mobBtn.focus(); });
  [mobBtn, mobZavri].forEach((b) => b.addEventListener('keydown', (e) => { if (e.key === ' ') { e.preventDefault(); b.click(); } }));
  mob.addEventListener('click', (e) => { const a = e.target.closest('a'); if (a && a !== mobZavri && mob.classList.contains('otvorene')) nastav(false); });
  d.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mob.classList.contains('otvorene')) { nastav(false); mobBtn.focus(); } });
}

// 1) Scéna v úvode: raz po načítaní písma. Triedu .pred pridá až tento modul, takže pri chybe modulu nič neostane skryté.
const scena = d.getElementById('scena');
if (scena && !reduced) {
  scena.classList.add('pred');
  const start = () => requestAnimationFrame(() => requestAnimationFrame(() => { scena.classList.remove('pred'); scena.classList.add('hra'); }));
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(start); else start();
}

// 2) Postup krokov: signál prejde raz krokmi 1 až 5, keď je polovica zoznamu v obraze (len ak ešte nie je v obraze).
const kroky = d.querySelector('.kroky');
if (kroky && !reduced && 'IntersectionObserver' in w && kroky.getBoundingClientRect().top > innerHeight) {
  kroky.classList.add('pred');
  const io = new IntersectionObserver((e) => {
    if (!e.some((x) => x.isIntersecting)) return;
    io.disconnect();
    kroky.classList.remove('pred');
    kroky.classList.add('hra');
  }, { threshold: 0.5 });
  io.observe(kroky);
}

// 3) Vstupy sekcií pod ohybom: len priehľadnosť a posun (bez filter: blur, ten na veľkých blokoch hrozí trhaním,
// brána 7. 11. 2026 nález 8), nikdy visibility:hidden (obsah ostáva pre čítačku).
if (!reduced && 'IntersectionObserver' in w) {
  const prvky = [...d.querySelectorAll('[data-vstup]')].filter((el) => el.getBoundingClientRect().top > innerHeight * 0.9);
  const stav = new Map(prvky.map((el) => [el, presence(false, { blur: 0, dyIn: 18, scaleFrom: 0.97 })]));
  const vstup = (el, s) => {
    el.style.opacity = String(s.opacity);
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
