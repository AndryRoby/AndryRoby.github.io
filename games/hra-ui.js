/* Hracia obrazovka denných hier: jeden modul pre všetkých 14 hier.
 * Fable, 26. 9. 2026. Andrej: „každá stránka hry potrebuje lepšie rozloženie,
 * aby vedeli ako hrať stále a čo robiť, lebo teraz musia scrollovať“.
 * Návrh a rozmery: ops/games/ROZLOZENIE-HIER.md.
 *
 * Denné stránky sa nepregenerúvajú (asi 6 500 súborov), preto všetko robí
 * tento modul nad hotovým HTML a vzhľad je v /style/hra.css pod body.hra-ui:
 *   1. nad dosku vloží vetu pravidla hry a tlačidlo Rules,
 *   2. Rules otvorí <dialog> s odsekmi „How to play“ a „Controls“ zo sekcie
 *      #rules tej istej stránky (jazyk stránky) a odkazom na guide,
 *   3. odkaz „Play today's …“ (href="#doska") posunie stránku tak, aby hracia
 *      obrazovka začínala tesne pod hlavičkou, nie doska v strede,
 *   4. zmenší dosku, aby sa hracia obrazovka (dátum, pravidlo, doska, pad,
 *      tlačidlá a prvý riadok stavu) zmestila do výšky okna (100svh),
 *   5. tlačidlá (.ovladanie) prilepí dole a na PC prilepí ľavý stĺpec, keď sa
 *      celý zmestí.
 * Ak čokoľvek zlyhá, hra beží ďalej v pôvodnom rozložení.
 *
 * Použitie v game.js hneď po importoch:
 *   import { hraUi } from '../hra-ui.js?v=1';
 *   const ui = hraUi({ pravidlo: 'Two hedgehogs in every row …' });
 *   ui.pravidlo('…');   // neskôr, ak veta závisí od dňa (Hares)
 *
 * Pozor: <body class="noc obsah hra">, takže querySelector('.hra') vráti body.
 * Panel s doskou je '.hero .hra'.
 */

const PODLAHA = 240;   // najmenšia šírka dosky v px (15 x 15 ešte 16 px na bunku)
const MEDZERA = 8;     // medzera pod hlavičkou a pod hracou obrazovkou

const TEXTY = {
  en: { rules: 'Rules', close: 'Close', title: 'Rules and controls', guide: 'Read the full guide' },
  de: { rules: 'Regeln', close: 'Schließen', title: 'Regeln und Bedienung', guide: 'Zur ganzen Anleitung' },
  sk: { rules: 'Pravidlá', close: 'Zavrieť', title: 'Pravidlá a ovládanie', guide: 'Celý návod' },
};

/* Šírka dosky tak, aby sa hracia obrazovka zmestila do okna.
 *   Wn, Hn   prirodzená šírka a výška dosky (podľa stránky, bez obmedzenia),
 *   zvysok   výška všetkého ostatného na hracej obrazovke (dátum, pravidlo,
 *            pad, lišta, prvý riadok stavu),
 *   okno     100svh v px, hore = kde hracia obrazovka začína (pod hlavičkou).
 * Doska nikdy nie je širšia než prirodzene a nikdy užšia než PODLAHA (alebo
 * prirodzená, ak je menšia). Čistá funkcia, testuje ju hra-ui.test.mjs. */
export function sirkaDosky({ Wn, Hn, zvysok, okno, hore }) {
  const pomer = Hn / Wn;
  const priestor = okno - hore - zvysok - MEDZERA;
  const podlaha = Math.min(Wn, PODLAHA);
  const W = Math.min(Wn, Math.max(podlaha, priestor / pomer));
  return { W, priestor, podlaha };
}

let postavene = false;
let vetaEl = null;
let cakajucaVeta = null;

export function hraUi(volby = {}) {
  const api = {
    pravidlo(text) {
      if (typeof text !== 'string') return;
      if (vetaEl) { vetaEl.textContent = text; vetaEl.hidden = !text; } else cakajucaVeta = text;
    },
  };
  if (typeof document === 'undefined') return api;
  if (typeof volby.pravidlo === 'string' && cakajucaVeta === null) cakajucaVeta = volby.pravidlo;
  const spusti = () => {
    try { postav(); } catch (e) {
      // The game runs on in its old layout: without the class none of the new CSS applies.
      document.body.classList.remove('hra-ui');
      document.documentElement.classList.remove('hra-ui');
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', spusti, { once: true });
  else spusti();
  return api;
}

function postav() {
  if (postavene) return;
  const hra = document.querySelector('.hero .hra');
  const hero = hra && hra.closest('.hero');
  const obal = hra && hra.querySelector('.doska-obal');
  const horna = hra && hra.querySelector(':scope > .horna');
  const stavEl = document.getElementById('stav');
  const ovl = hra && hra.querySelector('.ovladanie');
  if (!hra || !hero || !obal || !horna || !stavEl || !ovl) return;
  postavene = true;

  const jazyk = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
  const T = TEXTY[jazyk] || TEXTY.en;
  const hra1 = location.pathname.split('/')[2] || '';
  const pokojne = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  document.body.classList.add('hra-ui');
  document.documentElement.classList.add('hra-ui');

  // Ľavý stĺpec úvodu (nadpis, pravidlo, Play, ovládanie, pri Dormice a Foxes indície).
  let lavy = null;
  for (const d of hero.children) if (!d.contains(hra)) { lavy = d; break; }
  if (lavy) lavy.classList.add('hu-lavy');

  // Lišta: len keď je .ovladanie priamo v paneli (Foxes ju má v mriežke čipov).
  const lista = ovl.parentElement === hra;
  if (lista) ovl.classList.add('hu-lista');

  /* ── 1. Veta pravidla a tlačidlo Rules ─────────────────────────────── */
  // Ak ho raz dá do stránky šablóna (postav.mjs), použije sa ten riadok.
  let riadok = hra.querySelector(':scope > .hu-pravidlo');
  if (!riadok) {
    riadok = document.createElement('p');
    riadok.className = 'hu-pravidlo';
    horna.after(riadok);
  }
  vetaEl = riadok.querySelector('.hu-veta');
  if (!vetaEl) {
    vetaEl = document.createElement('span');
    vetaEl.className = 'hu-veta';
    riadok.prepend(vetaEl);
  }
  if (cakajucaVeta) vetaEl.textContent = cakajucaVeta;
  vetaEl.hidden = !vetaEl.textContent.trim();
  let pravidlaBtn = riadok.querySelector('.hu-pravidla-btn');
  if (!pravidlaBtn) {
    pravidlaBtn = document.createElement('button');
    pravidlaBtn.type = 'button';
    pravidlaBtn.className = 'hu-pravidla-btn';
    pravidlaBtn.textContent = T.rules;
    riadok.append(document.createTextNode(' '), pravidlaBtn);
  }
  pravidlaBtn.setAttribute('aria-haspopup', 'dialog');
  pravidlaBtn.setAttribute('aria-controls', 'hu-pravidla');

  /* ── 2. Panel s pravidlami ─────────────────────────────────────────── */
  const dlg = postavDialog(T, hra1);
  const vieDialog = !!(dlg && typeof dlg.showModal === 'function');
  pravidlaBtn.addEventListener('click', () => {
    if (vieDialog) {
      try { if (!dlg.open) dlg.showModal(); return; } catch (e) { /* below */ }
    }
    // Bez <dialog>: pravidlá na stránke, prvé rozbalené.
    const sekcia = document.getElementById('rules');
    if (sekcia) {
      const d = sekcia.querySelector('details');
      if (d) d.open = true;
      sekcia.scrollIntoView({ block: 'start', behavior: pokojne() ? 'auto' : 'smooth' });
    }
  });
  if (dlg) {
    // Fokus späť na Rules (novšie prehliadače to robia samy, staršie nie).
    dlg.addEventListener('close', () => {
      try { pravidlaBtn.focus({ preventScroll: true }); } catch (e) { pravidlaBtn.focus(); }
    });
  }

  /* ── 3. Play: na začiatok hracej obrazovky ─────────────────────────── */
  const hlavicka = document.querySelector('header.site-header') || document.querySelector('header');
  const spodokHlavicky = () => {
    if (!hlavicka) return 0;
    const r = hlavicka.getBoundingClientRect();
    // Pevná hlavička (paper.css, body.noc) je hore; inak sa neráta.
    return getComputedStyle(hlavicka).position === 'fixed' ? Math.max(0, r.bottom) : 0;
  };
  function naHru(klavesnica, okamzite) {
    const y = hra.getBoundingClientRect().top + window.scrollY - spodokHlavicky() - MEDZERA;
    const ciel = Math.max(0, Math.round(y));
    try { window.scrollTo({ top: ciel, behavior: okamzite || pokojne() ? 'instant' : 'smooth' }); }
    catch (e) { window.scrollTo(0, ciel); }
    if (klavesnica) {
      const doska = document.getElementById('doska');
      const bunka = doska && (doska.querySelector('[tabindex="0"]') || (doska.hasAttribute('tabindex') ? doska : null));
      if (bunka) { try { bunka.focus({ preventScroll: true }); } catch (e) { /* none */ } }
    }
  }
  for (const a of document.querySelectorAll('.hero .uv-actions a[href="#doska"]')) {
    a.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      // detail 0 = spustené klávesnicou (Enter): vtedy fokus na dosku.
      naHru(e.detail === 0, false);
    });
  }
  if (location.hash === '#doska') {
    requestAnimationFrame(() => naHru(false, true));
    window.addEventListener('load', () => naHru(false, true), { once: true });
  }

  /* ── 4. a 5. Veľkosť dosky, lišta, ľavý stĺpec ─────────────────────── */
  const sonda = document.createElement('div');
  sonda.className = 'hu-sonda';
  sonda.setAttribute('aria-hidden', 'true');
  document.body.appendChild(sonda);

  let caka = false;
  let davka = 0, davkaOd = 0;
  function naplanuj() {
    if (caka) return;
    caka = true;
    requestAnimationFrame(() => {
      caka = false;
      // Poistka proti kolísaniu: najviac 6 meraní za pol sekundy, potom jedno neskôr.
      const t = performance.now();
      if (t - davkaOd > 500) { davkaOd = t; davka = 0; }
      if (++davka > 6) { setTimeout(naplanuj, 600); return; }
      try { zmeraj(); } catch (e) { /* the old layout stays */ }
    });
  }

  function zmeraj() {
    // Najprv prirodzený stav (bez obmedzenia), všetky merania, potom zápisy.
    obal.classList.remove('hu-vyska');
    const rHra = hra.getBoundingClientRect();
    const rObal = obal.getBoundingClientRect();
    const rStav = stavEl.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(stavEl).lineHeight);
    const riadokStavu = Number.isFinite(lh) && lh > 0 ? lh : 22;
    const hore0 = spodokHlavicky();
    const okno = sonda.offsetHeight || window.innerHeight;
    const rLavy = lavy ? lavy.getBoundingClientRect() : null;
    const dvaStlpce = !!(rLavy && rLavy.width > 0 && rLavy.right <= rHra.left + 1);
    const vyskaLavy = lavy ? lavy.offsetHeight : 0;
    const vyskaListy = lista ? ovl.offsetHeight : 0;

    // PC: ľavý stĺpec prilepený, len keď sa celý zmestí pod hlavičku.
    if (lavy) lavy.classList.toggle('hu-lepi', dvaStlpce && vyskaLavy + hore0 + 48 <= okno);
    if (lista) document.documentElement.style.setProperty('--hu-lista', Math.round(vyskaListy) + 'px');

    const Wn = rObal.width, Hn = rObal.height;
    // Budúci deň (doska skrytá) alebo ešte prázdna doska: nič neobmedzovať.
    if (Wn < 60 || Hn < 60) { obal.style.removeProperty('--hu-w'); return; }
    // Tlačidlá vedľa dosky (Foxes na širokom nízkom okne): rieši to stránka.
    if (rStav.top < rObal.bottom - 1) { obal.style.removeProperty('--hu-w'); return; }

    const zvysok = (rStav.top + riadokStavu) - rHra.top - Hn;
    // Jeden stĺpec: hráč príde tlačidlom Play, obrazovka začína pod hlavičkou.
    // Dva stĺpce (PC): hra je na mieste, kde je v dokumente, bez posúvania.
    const hore = dvaStlpce ? Math.max(rHra.top + window.scrollY, hore0 + MEDZERA) : hore0 + MEDZERA;
    const { W, priestor, podlaha } = sirkaDosky({ Wn, Hn, zvysok, okno, hore });
    if (W >= Wn - 0.5) { obal.style.removeProperty('--hu-w'); return; }
    obal.style.setProperty('--hu-w', W.toFixed(1) + 'px');
    obal.classList.add('hu-vyska');
    // Overenie: doska s číslami pri okraji (Magpies, Beavers) nemá pri menšej
    // šírke presne ten istý pomer, lebo písmo sa nezmenšuje. Najviac dve opravy.
    let Wt = W;
    for (let i = 0; i < 2; i++) {
      const H2 = obal.getBoundingClientRect().height;
      if (!(H2 > priestor + 1 && Wt > podlaha)) break;
      Wt = Math.max(podlaha, Wt * priestor / H2);
      obal.style.setProperty('--hu-w', Wt.toFixed(1) + 'px');
    }
  }

  // Čo mení výšku hracej obrazovky: pás nad doskou, doska, všetko medzi doskou
  // a lištou, lišta sama (Share po vyriešení) a ľavý stĺpec.
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(naplanuj);
    const kontajnerOvl = [...hra.children].find((d) => d.contains(ovl)) || ovl;
    let medzi = false;
    for (const d of hra.children) {
      if (d === horna) medzi = true;
      if (medzi) ro.observe(d);
      if (d === kontajnerOvl) break;
    }
    if (lavy) ro.observe(lavy);
  }
  window.addEventListener('resize', naplanuj, { passive: true });
  window.addEventListener('orientationchange', naplanuj);
  window.addEventListener('load', naplanuj, { once: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(naplanuj).catch(() => {});
  // Príchod .r (posun a mierka) skresľuje prvé meranie: zmerať znova po ňom.
  const prichod = hra.closest('.r');
  if (prichod) prichod.addEventListener('animationend', naplanuj);
  setTimeout(naplanuj, 1000);
  naplanuj();

  // Lišta prilepená nad obsahom: nepriehľadné pozadie a vlasová linka.
  // Prilepená je práve vtedy, keď je jej prirodzené miesto pod okrajom okna,
  // teda keď #stav (hneď pod ňou) začína pod okrajom plus jej spodný okraj.
  if (lista && typeof IntersectionObserver === 'function') {
    const okraj = Math.round(parseFloat(getComputedStyle(stavEl).marginTop) || 0);
    const io = new IntersectionObserver((zaznamy) => {
      for (const z of zaznamy) {
        const spodok = z.rootBounds ? z.rootBounds.bottom : window.innerHeight;
        ovl.classList.toggle('hu-prilepene', !z.isIntersecting && z.boundingClientRect.top >= spodok - 1);
      }
    }, { rootMargin: '0px 0px ' + okraj + 'px 0px' });
    io.observe(stavEl);
  }
}

function postavDialog(T, hra1) {
  const sekcia = document.getElementById('rules');
  const dlg = document.createElement('dialog');
  dlg.id = 'hu-pravidla';
  dlg.className = 'hu-dialog';
  dlg.setAttribute('aria-labelledby', 'hu-pravidla-nadpis');

  const hlava = document.createElement('div');
  hlava.className = 'hu-hlava';
  const nadpis = document.createElement('h2');
  nadpis.id = 'hu-pravidla-nadpis';
  nadpis.className = 'hu-nadpis';
  nadpis.textContent = T.title;
  const zavri = document.createElement('button');
  zavri.type = 'button';
  zavri.className = 'hu-zavri';
  zavri.textContent = T.close;
  zavri.addEventListener('click', () => dlg.close());
  hlava.append(nadpis, zavri);

  const telo = document.createElement('div');
  telo.className = 'hu-telo';
  // „How to play“ a „Controls“ zo sekcie Rules tej istej stránky; ak by ich
  // názvy boli iné, prvé dva bloky.
  const bloky = sekcia ? [...sekcia.querySelectorAll('details')] : [];
  let vybrane = bloky.filter((d) => /how to play|controls|spielregeln|bedienung|ako hrať|ovládanie/i.test((d.querySelector('summary') || {}).textContent || ''));
  if (vybrane.length < 2) vybrane = bloky.slice(0, 2);
  for (const d of vybrane) {
    const s = d.querySelector('summary');
    const obsah = d.querySelector('.telo');
    if (!obsah) continue;
    const h = document.createElement('h3');
    h.className = 'hu-podnadpis';
    h.textContent = s ? s.textContent.trim() : '';
    telo.appendChild(h);
    for (const uzol of obsah.childNodes) telo.appendChild(uzol.cloneNode(true));
  }
  // Odkaz na guide: ten istý ako „How to play“ v úvode.
  const uvod = document.querySelector('.hero .uv-actions a.uv-quiet');
  const href = uvod ? uvod.getAttribute('href') : (hra1 ? '/games/' + hra1 + '/guide/' : '');
  if (href) {
    const p = document.createElement('p');
    p.className = 'hu-odkaz';
    const a = document.createElement('a');
    a.href = href;
    a.textContent = T.guide;
    p.appendChild(a);
    telo.appendChild(p);
  }
  if (!telo.childNodes.length) return null;

  dlg.append(hlava, telo);
  // Klik na tmavé pozadie zatvára (cieľom je vtedy samotný <dialog>).
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  // Klávesy v paneli nepatria hre: P by pozastavilo hodiny, H dalo nápovedu,
  // šípky by hýbali kurzorom. Escape zatvára panel natívne (cancel), to ostáva.
  dlg.addEventListener('keydown', (e) => e.stopPropagation());
  document.body.appendChild(dlg);
  return dlg;
}
