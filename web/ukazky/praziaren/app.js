// Pražiareň Kolotoč: ukážka e-shopu od ARLing (vymyslená pražiareň). Kolotoč šiestich vreciek, posuvník praženia, košík
// len v pamäti stránky, detail kávy, predplatné, záložky prípravy, krivka praženia podľa kávy a stav osobného odberu.
// Nič neodosiela a nič neukladá. Všetky texty sa vkladajú cez textContent.
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const pokoj = window.matchMedia('(prefers-reduced-motion: reduce)');
  const NB = ' ';
  // pevná medzera za jednopísmenovými predložkami a spojkami
  const nb = (s) => s.replace(/(^|[\s(])([vkszouaiVKSZOUAI])\s/g, '$1$2' + NB);
  const euro = (n) => n.toFixed(2).replace('.', ',') + NB + '€';
  const kusy = (n) => n + NB + (n === 1 ? 'kus' : n >= 2 && n <= 4 ? 'kusy' : 'kusov');
  const f1 = (n) => Math.round(n * 10) / 10;

  const KAVY = {
    etiopia: { nazov: 'Etiópia Guji', akuz: 'Etiópiu Guji', rod: 'Etiópie Guji', krajina: 'Etiópia · Guji, Uraga', chut: 'Citrón, jazmín a čierny čaj', prazenie: 'Svetlé', priprava: 'Na filter', dopl: 'najlepšia v prekvapkávači', farba: '#f4d35e', krivka: '#f4d35e', ceny: { 250: 15, 1000: 56 }, profil: [5, 3, 2, 1], farma: 'Malí pestovatelia pri stanici Uraga', spracovanie: 'Praná', odroda: 'Pôvodné etiópske odrody', vyska: '1' + NB + '950 až 2' + NB + '200' + NB + 'm' },
    kolumbia: { nazov: 'Kolumbia Huila', akuz: 'Kolumbiu Huila', rod: 'Kolumbie Huila', krajina: 'Kolumbia · Huila, Pitalito', chut: 'Malina, karamel a mliečna čokoláda', prazenie: 'Stredne svetlé', priprava: 'Na filter', dopl: 'alebo aj na espresso', farba: '#e4577b', krivka: '#f07a98', ceny: { 250: 13.5, 1000: 46 }, profil: [4, 4, 3, 2], farma: 'Družstvo malých fariem v Pitalite', spracovanie: 'Praná', odroda: 'Caturra a Castillo', vyska: '1' + NB + '600 až 1' + NB + '900' + NB + 'm' },
    guatemala: { nazov: 'Guatemala Huehuetenango', akuz: 'Guatemalu Huehuetenango', rod: 'Guatemaly Huehuetenango', krajina: 'Guatemala · Huehuetenango', chut: 'Slivka, kakao a hnedý cukor', prazenie: 'Stredné', priprava: 'Na espresso', dopl: 'aj do prekvapkávača', farba: '#7a3e6b', krivka: '#d08cc0', ceny: { 250: 12.5, 1000: 42 }, profil: [3, 4, 4, 2], farma: 'Rodinná farma v horách Huehuetenanga', spracovanie: 'Praná', odroda: 'Bourbon a Caturra', vyska: '1' + NB + '700 až 2' + NB + '000' + NB + 'm' },
    zmes: { nazov: 'Zmes Kolotoč', akuz: 'Zmes Kolotoč', rod: 'Zmesi Kolotoč', krajina: 'Brazília a Guatemala · zmes', chut: 'Karamel, lieskový orech a mliečna čokoláda', prazenie: 'Stredne tmavé', priprava: 'Na espresso', dopl: 'aj s mliekom', farba: '#f7b067', krivka: '#f7b067', ceny: { 250: 11.5, 1000: 40 }, profil: [2, 4, 4, 3], farma: 'Brazília Cerrado (60' + NB + '%) a Guatemala Huehuetenango (40' + NB + '%)', spracovanie: 'Sušená v plode a praná', odroda: 'Mundo Novo, Catuaí a Bourbon', vyska: '1' + NB + '000 až 2' + NB + '000' + NB + 'm' },
    brazilia: { nazov: 'Brazília Cerrado', akuz: 'Brazíliu Cerrado', rod: 'Brazílie Cerrado', krajina: 'Brazília · Cerrado Mineiro', chut: 'Horká čokoláda, pražené orechy a melasa', prazenie: 'Tmavšie', priprava: 'Na moku', dopl: 'aj na espresso', farba: '#9ccf8a', krivka: '#9ccf8a', ceny: { 250: 10.9, 1000: 37 }, profil: [1, 3, 5, 4], farma: 'Farma na náhornej plošine Cerrado', spracovanie: 'Sušená v plode', odroda: 'Mundo Novo a Catuaí', vyska: '1' + NB + '000 až 1' + NB + '200' + NB + 'm' },
    bezkofeinu: { nazov: 'Večerná Kolumbia', akuz: 'Večernú Kolumbiu', rod: 'Večernej Kolumbie', krajina: 'Kolumbia · Huila, bez kofeínu', chut: 'Karamel, červené jablko a kakao', prazenie: 'Stredné', priprava: 'Na espresso', dopl: 'aj na filter', farba: '#9cc9e8', krivka: '#9cc9e8', ceny: { 250: 13, 1000: 43 }, profil: [2, 4, 3, 2], farma: 'Družstvo v Huile', spracovanie: 'Praná, kofeín odstránený etylacetátom z cukrovej trstiny', odroda: 'Castillo', vyska: '1' + NB + '500 až 1' + NB + '800' + NB + 'm' },
  };
  const PROFIL_MENA = ['Kyslosť', 'Sladkosť', 'Telo', 'Horkosť'];
  const PASMA = [
    { po: 0.2, id: 'etiopia', text: 'Svetlá, citrón a jazmín' },
    { po: 0.4, id: 'kolumbia', text: 'Svetlá až stredná, malina a karamel' },
    { po: 0.6, id: 'guatemala', text: 'Stredná, slivka a kakao' },
    { po: 0.8, id: 'zmes', text: 'Stredne tmavá, karamel a orech' },
    { po: 1.01, id: 'brazilia', text: 'Tmavá, horká čokoláda a orechy' },
  ];
  // stred pásma posuvníka pre kávy na stupnici (Večerná Kolumbia na stupnici svetlá a tmavá nie je)
  const STRED = { etiopia: 0.1, kolumbia: 0.3, guatemala: 0.5, zmes: 0.7, brazilia: 0.9 };
  // Pozadie úvodu: svetlá časť do 0,5 a tmavá od 0,5, medzi nimi skok, aby pozadie nikdy nebolo v pásme jasu,
  // kde by malý text nemal kontrast AA ani espresso, ani penou. Farbu textu vyberá výpočet kontrastu, nie prah.
  const SVETLE = [[0, '#f3c27a'], [0.3, '#f7b067'], [0.5, '#cf8040']];
  const TMAVE = [[0.5, '#a0552f'], [1, '#3b2216']];
  const ZRNKO = [[0, '#dcb07a'], [0.5, '#8a5530'], [1, '#22140d']];
  const RYHA = [[0, '#8f5c2f'], [0.6, '#3a2013'], [1, '#6e4c36']];
  const ESPRESSO = '#2b1810';
  const PENA = '#fbf3e6';
  const DOPRAVA_ZADARMO = 45;
  const DOPRAVA = 2.9;

  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (stopy, t) => {
    let i = 1;
    while (i < stopy.length - 1 && t > stopy[i][0]) i++;
    const [t0, c0] = stopy[i - 1];
    const [t1, c1] = stopy[i];
    const k = t1 === t0 ? 1 : Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    const a = hex(c0);
    const b = hex(c1);
    return '#' + a.map((v, j) => Math.round(v + (b[j] - v) * k).toString(16).padStart(2, '0')).join('');
  };
  const farbaPozadia = (x) => (x < 0.5 ? mix(SVETLE, x) : mix(TMAVE, x));
  const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const jas = (h) => { const [r, g, b] = hex(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
  const kontrast = (a, b) => { const x = jas(a); const y = jas(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const textPre = (bg) => (kontrast(bg, ESPRESSO) >= kontrast(bg, PENA) ? ESPRESSO : PENA);

  /* Prvky úvodu */
  const uvod = $('[data-uvod]');
  const hlava = $('[data-hlava]');
  const draha = $('[data-draha]');
  const palec = $('[data-palec]');
  const odp = $('[data-odporucanie]');
  const scena = $('[data-scena]');
  const tema = $('meta[name="theme-color"]');
  let p = 0.3;
  let pasmo = 'kolumbia';
  let tahanie = false;

  /* Kolotoč: šesť vreciek po 60° na elipse (Rx 30, Ry 14 v jednotkách šírky scény), vpredu väčšie a svetlejšie.
     Obruč taniera a lúče sa otáčajú s vreckami, nálepka sa pri tom pootočí. Začiatočný stav (Kolumbia vpredu, 60°)
     je priamo v HTML, takže stránka bez JS vyzerá rovnako. */
  const KRUH = ['etiopia', 'kolumbia', 'guatemala', 'zmes', 'brazilia', 'bezkofeinu'];
  const RX = 30;
  const RY = 14;
  const FARBY_OBRUC = ['#f4d35e', '#e4577b', '#7a3e6b', '#f7b067', '#9ccf8a', '#9cc9e8'];
  const miesta = KRUH.map((id) => $(`[data-k="${id}"]`, scena));
  const obrucCesty = $$('[data-obruc] path', scena);
  const luceCesta = $('[data-luce]', scena);
  const nalepka = $('[data-nalepka]', scena);
  const bodObruc = (deg, dy) => { const t = (deg * Math.PI) / 180; return f1(390 + 384 * Math.sin(t)) + ' ' + f1(204 + 198 * Math.cos(t) + dy); };
  // posledné hodnoty z-index a jasu: menia sa len pri skutočnej zmene (menej prepočtov štýlu počas otáčania)
  const predtym = miesta.map(() => ({ z: -1, jas: -1 }));
  const vykresliKolotoc = (r) => {
    miesta.forEach((el, i) => {
      const th = ((i * 60 - r) * Math.PI) / 180;
      const d = (1 + Math.cos(th)) / 2;
      const s = 0.55 + 0.45 * d * d;
      el.style.transform = `translate(${(RX * Math.sin(th)).toFixed(2)}cqw, ${(RY * Math.cos(th)).toFixed(2)}cqw) scale(${s.toFixed(3)})`;
      const z = Math.round(d * 100);
      const jasVrecka = d > 0.995 ? 1 : Math.round((0.74 + 0.26 * d) * 50) / 50;
      if (z !== predtym[i].z) { el.style.zIndex = String(z); predtym[i].z = z; }
      if (jasVrecka !== predtym[i].jas) { el.style.filter = jasVrecka === 1 ? '' : `brightness(${jasVrecka})`; predtym[i].jas = jasVrecka; }
    });
    const dd = FARBY_OBRUC.map(() => '');
    for (let j = 0; j < 18; j++) {
      const a = ((((j * 20 - r) % 360) + 540) % 360) - 180;
      const a1 = Math.max(a, -90);
      const a2 = Math.min(a + 10, 90);
      if (a2 <= a1) continue;
      dd[j % 6] += `M${bodObruc(a1, 0)}L${bodObruc(a2, 0)}L${bodObruc(a2, 52)}L${bodObruc(a1, 52)}Z`;
    }
    obrucCesty.forEach((el, k) => el.setAttribute('d', dd[k]));
    let s = '';
    for (let k = 0; k < 12; k++) {
      const t = ((k * 30 - r) * Math.PI) / 180;
      const sn = Math.sin(t);
      const cs = Math.cos(t);
      s += `M${f1(390 + 70 * sn)} ${f1(204 + 36 * cs)}L${f1(390 + 330 * sn)} ${f1(204 + 170 * cs)}`;
    }
    luceCesta.setAttribute('d', s);
    nalepka.style.transform = `rotate(${((r - 60) * 1.5).toFixed(1)}deg)`;
  };
  // Posuvník na uhol: pri každej káve sa kolotoč chvíľu drží a otočí sa až pri hranici pásma (tam sa mení odporúčanie).
  const rotZ = (x) => { const u = Math.min(4, Math.max(0, x * 5 - 0.5)); const k = Math.round(u); const f = u - k; return (k + 4 * f * f * f) * 60; };
  let rot = 60;
  let cielRot = 60;
  let slucka = 0;
  let posledny = 0;
  let roztocenie = null;
  const krok = (t) => {
    const dt = Math.min(48, t - (posledny || t));
    posledny = t;
    rot += (cielRot - rot) * (1 - Math.exp(-dt / 85));
    if (Math.abs(cielRot - rot) < 0.08) rot = cielRot;
    vykresliKolotoc(rot);
    if (rot !== cielRot) slucka = requestAnimationFrame(krok);
    else { slucka = 0; posledny = 0; }
  };
  const tocNa = (r) => {
    cielRot = r;
    if (roztocenie) {
      // človek prevzal kolotoč počas úvodného otočenia: pokračuje sa z najbližšieho rovnakého uhla
      roztocenie = null;
      rot = r + ((((rot - r) % 360) + 540) % 360) - 180;
    }
    if (pokoj.matches) { rot = r; vykresliKolotoc(r); return; }
    if (!slucka) { posledny = 0; slucka = requestAnimationFrame(krok); }
  };
  // Úvodné otočenie: raz dokola za 1,6 s a späť na Kolumbiu (začína tam, kde HTML stojí, takže nič neskočí).
  const roztoc = () => {
    if (pokoj.matches || roztocenie) return;
    const start = performance.now();
    const od = rot - 360;
    const ciel = rot;
    roztocenie = { start };
    const krokR = (t) => {
      if (!roztocenie) return;
      const x = Math.min(1, (t - start) / 1600);
      const e = 1 + 1.5 * Math.pow(x - 1, 3) + 0.5 * Math.pow(x - 1, 2); // jemný prekmit na konci
      rot = od + (ciel - od) * e;
      vykresliKolotoc(rot);
      if (x < 1) requestAnimationFrame(krokR);
      else { roztocenie = null; rot = ciel; vykresliKolotoc(rot); }
    };
    requestAnimationFrame(krokR);
  };

  const ukazOdporucanie = (id, animuj) => {
    const k = KAVY[id];
    $('[data-odp-vrecko]', odp).setAttribute('href', '#v-' + id);
    $('[data-odp-nazov]', odp).textContent = k.nazov;
    $('[data-odp-chut]', odp).textContent = nb(k.chut);
    const pr = $('[data-odp-priprava]', odp);
    pr.textContent = k.priprava + ' ';
    const dopl = document.createElement('span');
    dopl.textContent = nb(k.dopl);
    pr.append(dopl);
    $('[data-odp-cena]', odp).textContent = euro(k.ceny[250]);
    $('[data-odp-tlac]', odp).dataset.pridaj = id;
    if (animuj && !pokoj.matches) {
      const obsah = $('[data-odp-obsah]', odp);
      obsah.classList.remove('odp-vymena');
      void obsah.offsetWidth;
      obsah.classList.add('odp-vymena');
    }
  };
  // „Vaša chuť“ v zozname káv: káva, ktorú odporučil posuvník, dostane štítok a obrys
  const oznacVasu = (id) => {
    $$('.karta').forEach((k) => {
      const ano = k.dataset.kava === id;
      k.classList.toggle('vasa', ano);
      const s = $('[data-vasa]', k);
      if (s) s.hidden = !ano;
    });
  };
  const aktualizujTemu = () => { if (tema && !hlava.classList.contains('posunuta')) tema.content = farbaPozadia(p); };

  const nastav = (np) => {
    // zaokrúhlenie na tisíciny: šípky (krok 0,05) inak dávajú 0,49999999999999994 a pozadie by sa nezhodlo s textom
    p = Math.round(Math.min(1, Math.max(0, np)) * 1000) / 1000;
    const bg = farbaPozadia(p);
    const text = textPre(bg);
    const tmava = text === PENA;
    // len na úvod a hlavičku, nie na koreň: zmena premennej na koreni by prepočítala štýly celej stránky
    uvod.style.setProperty('--p', String(p));
    uvod.style.setProperty('--uvod-bg', bg);
    uvod.style.setProperty('--uvod-text', text);
    uvod.style.setProperty('--zrnko', mix(ZRNKO, p));
    uvod.style.setProperty('--zrnko-ryha', mix(RYHA, p));
    hlava.style.setProperty('--uvod-bg', bg);
    hlava.style.setProperty('--uvod-text', text);
    hlava.classList.toggle('tmava', tmava);
    if (!tahanie) aktualizujTemu();
    const pas = PASMA.find((x) => p < x.po) || PASMA[PASMA.length - 1];
    const k = KAVY[pas.id];
    palec.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    palec.setAttribute('aria-valuetext', `${pas.text}. Odporúčame ${k.akuz}, ${k.priprava.toLowerCase()}.`);
    if (pas.id !== pasmo) {
      pasmo = pas.id;
      ukazOdporucanie(pas.id, true);
      oznacVasu(pas.id);
      nastavKrivku(pas.id, true);
      if (!pokoj.matches) {
        const m = miesta[KRUH.indexOf(pas.id)];
        miesta.forEach((x) => x.classList.remove('hop'));
        void m.offsetWidth;
        m.classList.add('hop');
      }
    }
    tocNa(rotZ(p));
  };
  // počas ťahania sa theme-color nemení (menej práce prehliadača), nastaví sa pri pustení
  const zacniTah = () => { tahanie = true; };
  const koniecTahu = () => { tahanie = false; aktualizujTemu(); };

  /* Posuvník: ťahanie, klik do dráhy a klávesnica */
  let tahPosuvnik = false;
  const zPolohy = (x) => {
    const r = draha.getBoundingClientRect();
    nastav((x - r.left - 28) / Math.max(1, r.width - 56));
  };
  draha.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    palec.focus({ preventScroll: true });
    tahPosuvnik = true;
    zacniTah();
    palec.classList.add('tahane');
    try { draha.setPointerCapture(e.pointerId); } catch (_) { /* starší prehliadač */ }
    zPolohy(e.clientX);
  });
  draha.addEventListener('pointermove', (e) => { if (tahPosuvnik) zPolohy(e.clientX); });
  const pustit = () => {
    if (!tahPosuvnik) return;
    tahPosuvnik = false;
    palec.classList.remove('tahane');
    koniecTahu();
  };
  draha.addEventListener('pointerup', pustit);
  draha.addEventListener('pointercancel', pustit);
  palec.addEventListener('keydown', (e) => {
    const kroky = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05, PageUp: 0.2, PageDown: -0.2 };
    let np;
    if (e.key in kroky) np = p + kroky[e.key];
    else if (e.key === 'Home') np = 0;
    else if (e.key === 'End') np = 1;
    else return;
    e.preventDefault();
    nastav(np);
  });

  /* Kolotoč sa dá roztočiť aj priamo ťahaním do strany; ťuk na vrecko vpredu otvorí detail, na iné ho otočí dopredu.
     Zvislý pohyb prstom ostáva posunom stránky (touch-action: pan-y). */
  let tahScena = null;
  scena.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    tahScena = { x: e.clientX, y: e.clientY, p0: p, id: e.pointerId, pohyb: false, ciel: e.target.closest('.k-miesto') };
  });
  scena.addEventListener('pointermove', (e) => {
    if (!tahScena || e.pointerId !== tahScena.id) return;
    const dx = e.clientX - tahScena.x;
    const dy = e.clientY - tahScena.y;
    if (!tahScena.pohyb) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      tahScena.pohyb = true;
      tahScena.x = e.clientX;
      zacniTah();
      scena.classList.add('tahana');
      try { scena.setPointerCapture(e.pointerId); } catch (_) { /* starší prehliadač */ }
      return;
    }
    const w = scena.getBoundingClientRect().width;
    nastav(tahScena.p0 - (dx / Math.max(1, w)) * 0.9);
  });
  const pustScenu = (e) => {
    if (!tahScena) return;
    const t = tahScena;
    tahScena = null;
    scena.classList.remove('tahana');
    if (t.pohyb) { koniecTahu(); return; }
    if (e.type !== 'pointerup' || !t.ciel) return;
    const id = t.ciel.dataset.k;
    if (id === pasmo || !(id in STRED)) otvorDetail(id);
    else nastav(STRED[id]);
  };
  scena.addEventListener('pointerup', pustScenu);
  scena.addEventListener('pointercancel', pustScenu);

  /* Hlavička nad úvodom */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(([z]) => {
      const pod = !z.isIntersecting;
      hlava.classList.toggle('posunuta', pod);
      if (tema) tema.content = pod ? PENA : farbaPozadia(p);
    }, { rootMargin: '-72px 0px 0px 0px' });
    io.observe(uvod);
  }

  /* Okná a zásuvky */
  const otvor = (d) => {
    if (d.open) return;
    d._spat = document.activeElement;
    d.showModal();
    if (pokoj.matches) d.classList.add('otvorena');
    else requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('otvorena')));
  };
  const zatvor = (d, hned) => {
    if (!d.open) return;
    d.classList.remove('otvorena');
    if (hned || pokoj.matches) d.close();
    else setTimeout(() => { if (!d.classList.contains('otvorena')) d.close(); }, 360);
  };
  $$('dialog').forEach((d) => {
    d.addEventListener('cancel', (e) => { e.preventDefault(); zatvor(d); });
    d.addEventListener('click', (e) => { if (e.target === d) zatvor(d); });
    d.addEventListener('close', () => {
      d.classList.remove('otvorena');
      const s = d._spat;
      d._spat = null;
      if (s && document.contains(s) && typeof s.focus === 'function') s.focus({ preventScroll: true });
    });
  });

  /* Košík (len v pamäti stránky) */
  const okKosik = $('[data-kosik]');
  const okDetail = $('[data-detail-okno]');
  const okPlatba = $('[data-okno-platba]');
  const kosikTlac = $('[data-kosik-otvor]');
  const pocetEl = $('[data-pocet]');
  const hlasenie = $('[data-hlasenie]');
  const kosik = [];
  let dalsie = 1;
  const MLETIE = [['zrnkova', 'Zrnková'], ['filter', 'Na filter'], ['espresso', 'Na espresso'], ['moka', 'Na moku']];

  const svgVrecko = (symbol) => {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 320 420');
    s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS(ns, 'use');
    u.setAttribute('href', '#' + symbol);
    s.append(u);
    return s;
  };

  const sucty = () => {
    const medzi = kosik.reduce((a, x) => a + x.cena * x.pocet, 0);
    const kusov = kosik.reduce((a, x) => a + x.pocet, 0);
    const predplatne = kosik.some((x) => x.typ === 'pp');
    const zadarmo = predplatne || medzi >= DOPRAVA_ZADARMO;
    const doprava = kusov === 0 ? 0 : zadarmo ? 0 : DOPRAVA;
    return { medzi, kusov, predplatne, zadarmo, doprava, spolu: medzi + doprava };
  };

  let poslednyPocet = 0;
  const ukazPocet = (n) => {
    pocetEl.hidden = n === 0;
    kosikTlac.setAttribute('aria-label', n === 0 ? 'Košík, prázdny' : `Košík, ${kusy(n)}`);
    if (n === poslednyPocet) return;
    const nove = document.createElement('span');
    nove.textContent = String(n);
    if (!pokoj.matches && n > 0 && poslednyPocet > 0) {
      const stare = pocetEl.firstElementChild;
      if (stare) stare.className = 'stare';
      nove.className = 'nove';
      pocetEl.append(nove);
      setTimeout(() => { $$('.stare', pocetEl).forEach((x) => x.remove()); nove.className = ''; }, 320);
    } else {
      pocetEl.replaceChildren(nove);
    }
    poslednyPocet = n;
  };

  const vykresli = () => {
    const zoznam = $('[data-polozky]');
    zoznam.replaceChildren();
    kosik.forEach((x) => {
      const li = document.createElement('li');
      li.className = 'polozka';
      li.append(svgVrecko(x.vrecko));
      const stred = document.createElement('div');
      const nazov = document.createElement('p');
      nazov.className = 'polozka-nazov';
      nazov.textContent = x.nazov;
      const popis = document.createElement('p');
      popis.className = 'polozka-popis';
      popis.textContent = x.popis;
      stred.append(nazov, popis);
      const cena = document.createElement('p');
      cena.className = 'polozka-cena';
      cena.textContent = euro(x.cena * x.pocet);
      const ovl = document.createElement('div');
      ovl.className = 'polozka-ovladanie';
      if (x.typ === 'kava') {
        const mn = document.createElement('div');
        mn.className = 'mnozstvo';
        mn.setAttribute('role', 'group');
        mn.setAttribute('aria-label', `Množstvo ${x.nazov}`);
        const minus = document.createElement('button');
        minus.type = 'button';
        minus.textContent = '−';
        minus.setAttribute('aria-label', `Uberte jedno vrecko ${x.nazov}`);
        minus.dataset.mnozstvo = '-1';
        minus.dataset.polozka = String(x.cislo);
        const out = document.createElement('output');
        out.textContent = String(x.pocet);
        out.setAttribute('aria-live', 'polite');
        const plus = document.createElement('button');
        plus.type = 'button';
        plus.textContent = '+';
        plus.setAttribute('aria-label', `Pridajte jedno vrecko ${x.nazov}`);
        plus.dataset.mnozstvo = '1';
        plus.dataset.polozka = String(x.cislo);
        mn.append(minus, out, plus);
        const sel = document.createElement('select');
        sel.className = 'mletie';
        sel.setAttribute('aria-label', `Mletie ${x.nazov}`);
        sel.dataset.polozka = String(x.cislo);
        MLETIE.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if (v === x.mletie) o.selected = true; sel.append(o); });
        ovl.append(mn, sel);
      }
      const odstranit = document.createElement('button');
      odstranit.type = 'button';
      odstranit.className = 'odstranit';
      odstranit.textContent = 'Odstrániť';
      odstranit.setAttribute('aria-label', `Odstrániť ${x.nazov} z košíka`);
      odstranit.dataset.odstranit = String(x.cislo);
      ovl.append(odstranit);
      li.append(stred, cena, ovl);
      zoznam.append(li);
    });
    const s = sucty();
    $('[data-prazdny]').hidden = kosik.length > 0;
    $('[data-medzisucet]').textContent = euro(s.medzi);
    $('[data-doprava]').textContent = s.kusov === 0 ? 'od 2,90' + NB + '€' : s.zadarmo ? 'zadarmo' : euro(DOPRAVA);
    $('[data-spolu]').textContent = euro(s.spolu);
    const text = $('[data-doprava-text]');
    if (s.predplatne) text.textContent = 'Doprava zadarmo vďaka predplatnému.';
    else if (s.medzi >= DOPRAVA_ZADARMO) text.textContent = 'Máte dopravu zadarmo.';
    else if (s.kusov === 0) text.textContent = nb('Doprava zadarmo od 45' + NB + '€ a pri predplatnom.');
    else text.textContent = 'Do dopravy zadarmo vám chýba ' + euro(DOPRAVA_ZADARMO - s.medzi);
    $('[data-doprava-plnenie]').style.setProperty('--plnenie', s.zadarmo && s.kusov ? 1 : Math.min(1, s.medzi / DOPRAVA_ZADARMO).toFixed(3));
    ukazPocet(s.kusov);
  };

  const hlas = (t) => { hlasenie.textContent = ''; setTimeout(() => { hlasenie.textContent = t; }, 60); };

  const let_ = (rect, symbol) => new Promise((hotovo) => {
    if (pokoj.matches || !rect) { hotovo(); return; }
    const ciel = kosikTlac.getBoundingClientRect();
    const x0 = rect.left + rect.width / 2 - 23;
    const y0 = rect.top + rect.height / 2 - 30;
    const x1 = ciel.left + ciel.width / 2 - 23;
    const y1 = ciel.top + ciel.height / 2 - 30;
    const von = document.createElement('div');
    von.className = 'letiace';
    von.setAttribute('aria-hidden', 'true');
    const dnu = document.createElement('div');
    dnu.append(svgVrecko(symbol));
    von.append(dnu);
    document.body.append(von);
    const t = 500;
    von.animate([{ transform: `translateX(${x0}px)` }, { transform: `translateX(${x1}px)` }], { duration: t, easing: 'cubic-bezier(.45,0,.75,.6)', fill: 'forwards' });
    const a = dnu.animate([
      { transform: `translateY(${y0}px) scale(1) rotate(0deg)` },
      { transform: `translateY(${y1}px) scale(.42) rotate(-24deg)`, opacity: 0.9 },
    ], { duration: t, easing: 'cubic-bezier(.15,.75,.35,1)', fill: 'forwards' });
    a.onfinish = () => { von.remove(); hotovo(); };
    a.oncancel = () => { von.remove(); hotovo(); };
  });

  const nadskok = () => {
    if (pokoj.matches) return;
    kosikTlac.classList.remove('nadskok');
    void kosikTlac.offsetWidth;
    kosikTlac.classList.add('nadskok');
  };

  const pridajKavu = (id, velkost, rect) => {
    const k = KAVY[id];
    if (!k) return;
    const v = velkost === 1000 ? 1000 : 250;
    let x = kosik.find((y) => y.typ === 'kava' && y.id === id && y.velkost === v && y.mletie === 'zrnkova');
    if (x) x.pocet += 1;
    else {
      x = { cislo: dalsie++, typ: 'kava', id, velkost: v, mletie: 'zrnkova', pocet: 1, cena: k.ceny[v], nazov: k.nazov, vrecko: 'v-' + id, popis: '' };
      kosik.push(x);
    }
    x.popis = popisKavy(x);
    let_(rect, 'v-' + id).then(() => { vykresli(); nadskok(); });
    const s = kosik.reduce((a, y) => a + y.pocet, 0);
    hlas(`Pridané do košíka: ${k.nazov}, ${v === 1000 ? '1' + NB + 'kg' : '250' + NB + 'g'}. V košíku ${kusy(s)}.`);
  };
  // pevná medzera pred bodkou v strede, aby sa popis nelámal za ňou
  const popisKavy = (x) => `${x.velkost === 1000 ? '1' + NB + 'kg' : '250' + NB + 'g'}${NB}· ${MLETIE.find(([v]) => v === x.mletie)[1].toLowerCase()}${NB}· ${euro(x.cena)}${NB}za${NB}vrecko`;

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.dataset.pridaj) {
      const id = t.dataset.pridaj;
      const volba = $(`input[name="v-${id}"]:checked`);
      const zKarty = t.closest('.karta');
      pridajKavu(id, zKarty && volba ? Number(volba.value) : 250, t.getBoundingClientRect());
    } else if (t.dataset.detail) {
      otvorDetail(t.dataset.detail);
    } else if (t.hasAttribute('data-kosik-otvor')) {
      vykresli();
      otvor(okKosik);
    } else if (t.hasAttribute('data-zavriet')) {
      zatvor(t.closest('dialog'));
    } else if (t.hasAttribute('data-pokracovat')) {
      otvor(okPlatba);
    } else if (t.dataset.mnozstvo) {
      const x = kosik.find((y) => y.cislo === Number(t.dataset.polozka));
      if (!x) return;
      x.pocet += Number(t.dataset.mnozstvo);
      const id = x.cislo;
      const smer = t.dataset.mnozstvo;
      if (x.pocet <= 0) kosik.splice(kosik.indexOf(x), 1);
      vykresli();
      const spat = $(`[data-polozka="${id}"][data-mnozstvo="${smer}"]`) || $('[data-zavriet]', okKosik);
      spat.focus();
    } else if (t.dataset.odstranit) {
      const i = kosik.findIndex((y) => y.cislo === Number(t.dataset.odstranit));
      if (i < 0) return;
      const meno = kosik[i].nazov;
      kosik.splice(i, 1);
      vykresli();
      hlas(`${meno} odstránené z košíka.`);
      $('[data-zavriet]', okKosik).focus();
    } else if (t.hasAttribute('data-pridaj-predplatne')) {
      pridajPredplatne(t.getBoundingClientRect());
    } else if (t.hasAttribute('data-d-pridaj')) {
      const id = okDetail.dataset.kava;
      const v = Number(($('input[name="d-velkost"]:checked', okDetail) || {}).value || 250);
      const rect = t.getBoundingClientRect();
      zatvor(okDetail, true);
      pridajKavu(id, v, rect);
    }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('select.mletie')) {
      const x = kosik.find((y) => y.cislo === Number(t.dataset.polozka));
      if (!x) return;
      x.mletie = t.value;
      x.popis = popisKavy(x);
      const p2 = t.closest('.polozka');
      if (p2) $('.polozka-popis', p2).textContent = x.popis;
    } else if (t.name && t.name.startsWith('pp-')) {
      ukazCenuPredplatneho();
    } else if (t.name === 'd-velkost') {
      ukazTlacDetailu();
    } else if (t.name === 'k-profil') {
      nastavKrivku(t.value, true);
    }
  });

  /* Detail kávy v bočnom paneli: vrecko a chuťový profil hore, balenie a cena pri tlačidle v lepiacej päte */
  const ukazTlacDetailu = () => {
    const k = KAVY[okDetail.dataset.kava];
    const v = Number(($('input[name="d-velkost"]:checked', okDetail) || {}).value || 250);
    $('[data-d-pridaj]', okDetail).textContent = `Do košíka za ${euro(k.ceny[v])}`;
  };
  const otvorDetail = (id) => {
    const k = KAVY[id];
    if (!k) return;
    okDetail.dataset.kava = id;
    okDetail.style.setProperty('--farba', k.farba);
    $('[data-d-nazov]', okDetail).textContent = k.nazov;
    $('[data-d-vrecko]', okDetail).setAttribute('href', '#v-' + id);
    $('[data-d-krajina]', okDetail).textContent = nb(k.krajina);
    $('[data-d-chut]', okDetail).textContent = nb(k.chut + '.');
    const prof = $('[data-d-profil]', okDetail);
    prof.replaceChildren();
    PROFIL_MENA.forEach((meno, i) => {
      const d = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = meno;
      const dd = document.createElement('dd');
      dd.setAttribute('role', 'img');
      dd.setAttribute('aria-label', `${k.profil[i]} z 5`);
      for (let j = 0; j < 5; j++) { const b = document.createElement('i'); if (j < k.profil[i]) b.className = 'plny'; dd.append(b); }
      d.append(dt, dd);
      prof.append(d);
    });
    const dl = $('[data-d-dl]', okDetail);
    dl.replaceChildren();
    [['Farma', k.farma], ['Spracovanie', k.spracovanie], ['Odroda', k.odroda], ['Nadmorská výška', k.vyska], ['Praženie', k.prazenie], ['Príprava', k.priprava + ', ' + k.dopl]].forEach(([a, b]) => {
      const d = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = a;
      const dd = document.createElement('dd');
      dd.textContent = nb(b);
      d.append(dt, dd);
      dl.append(d);
    });
    $('[data-d-cena="250"]', okDetail).textContent = euro(k.ceny[250]);
    $('[data-d-cena="1000"]', okDetail).textContent = euro(k.ceny[1000]);
    $('input[name="d-velkost"][value="250"]', okDetail).checked = true;
    ukazTlacDetailu();
    $('.zasuvka-telo', okDetail).scrollTop = 0;
    if (okKosik.open) zatvor(okKosik, true);
    otvor(okDetail);
  };

  /* Predplatné */
  const hodnota = (meno) => ($(`input[name="${meno}"]:checked`) || {}).value;
  const cenaPredplatneho = () => {
    const kava = hodnota('pp-kava');
    const k = KAVY[kava] || KAVY.kolumbia;
    const mn = Number(hodnota('pp-mnozstvo'));
    return mn === 1000 ? k.ceny[1000] : mn === 500 ? 2 * k.ceny[250] : k.ceny[250];
  };
  const ukazCenuPredplatneho = () => { $('[data-pp-cena]').textContent = euro(cenaPredplatneho()); };
  const pridajPredplatne = (rect) => {
    const kava = hodnota('pp-kava');
    const k = KAVY[kava];
    const mn = Number(hodnota('pp-mnozstvo'));
    const cas = hodnota('pp-cas');
    const i = kosik.findIndex((y) => y.typ === 'pp');
    if (i >= 0) kosik.splice(i, 1);
    const x = {
      cislo: dalsie++, typ: 'pp', pocet: 1, cena: cenaPredplatneho(),
      nazov: 'Predplatné: ' + (k ? k.nazov : 'Prekvapte ma'),
      vrecko: 'v-balik',
      popis: `${mn === 1000 ? '1' + NB + 'kg' : mn === 500 ? '2 × 250' + NB + 'g' : '250' + NB + 'g'} každé ${cas}${NB}týždne${NB}· cena za dodávku`,
    };
    kosik.push(x);
    let_(rect, 'v-balik').then(() => { vykresli(); nadskok(); });
    hlas(`Predplatné pridané do košíka, ${euro(x.cena)} za dodávku, doprava zadarmo.`);
  };
  ukazCenuPredplatneho();

  /* Záložky prípravy */
  const zalozky = $$('[role="tab"]');
  const vyberZalozku = (t, fokus) => {
    zalozky.forEach((z) => {
      const ano = z === t;
      z.setAttribute('aria-selected', String(ano));
      z.tabIndex = ano ? 0 : -1;
      const panel = document.getElementById(z.getAttribute('aria-controls'));
      if (panel) panel.hidden = !ano;
    });
    if (fokus) t.focus();
  };
  zalozky.forEach((z, i) => {
    z.addEventListener('click', () => vyberZalozku(z));
    z.addEventListener('keydown', (e) => {
      const n = zalozky.length;
      const j = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
      if (j === undefined) return;
      e.preventDefault();
      vyberZalozku(zalozky[j], true);
    });
  });
  // začiatočný stav (Espresso vybraté, Filter a Moka skryté) je v HTML

  /* Krivka praženia: profil každej kávy (časy v sekundách, teplota zrna v °C), monotónny kubický spline cez body,
     56 vzoriek; pri zmene kávy sa krivka prelieva z jednej do druhej. Začiatočná krivka Kolumbie je v HTML. */
  const PROFILY = {
    etiopia: { t0: 207, tp: [85, 94], y: [315, 155], fc: [480, 194], drop: [535, 201] },
    kolumbia: { t0: 207, tp: [90, 93], y: [330, 155], fc: [520, 195], drop: [590, 205] },
    guatemala: { t0: 208, tp: [90, 92], y: [340, 156], fc: [535, 196], drop: [620, 209] },
    zmes: { t0: 209, tp: [95, 91], y: [350, 157], fc: [550, 196], drop: [655, 213] },
    brazilia: { t0: 210, tp: [100, 90], y: [360, 158], fc: [565, 197], drop: [690, 218] },
    bezkofeinu: { t0: 205, tp: [80, 95], y: [300, 156], fc: [500, 193], drop: [575, 204] },
  };
  const kx = (s) => 70 + s * 0.75;
  const ky = (T) => 256.7 - (T - 100) * (83.4 / 50);
  const monotonna = (bx, by) => {
    const n = bx.length;
    const dx = [];
    const m = [];
    const sl = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = bx[i + 1] - bx[i]; sl[i] = (by[i + 1] - by[i]) / dx[i]; }
    m[0] = sl[0];
    m[n - 1] = sl[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = sl[i - 1] * sl[i] <= 0 ? 0 : (sl[i - 1] + sl[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (sl[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / sl[i];
      const b = m[i + 1] / sl[i];
      const h = a * a + b * b;
      if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * sl[i]; m[i + 1] = t * b * sl[i]; }
    }
    return (x) => {
      let i = 0;
      while (i < n - 2 && x > bx[i + 1]) i++;
      const h = dx[i];
      const t = (x - bx[i]) / h;
      const t2 = t * t;
      const t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * by[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * by[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  };
  const bodyKrivky = (pr) => {
    const [tp, tpT] = pr.tp;
    const [y, yT] = pr.y;
    const [fc, fcT] = pr.fc;
    const [dr, drT] = pr.drop;
    const bx = [0, 0.35 * tp, 0.7 * tp, tp, tp + (y - tp) * 0.5, y, y + (fc - y) * 0.5, fc, dr];
    const by = [pr.t0, tpT + (pr.t0 - tpT) * 0.45, tpT + (pr.t0 - tpT) * 0.1, tpT, tpT + (yT - tpT) * 0.56, yT, yT + (fcT - yT) * 0.56, fcT, drT];
    const fn = monotonna(bx, by);
    const out = [];
    for (let k = 0; k < 56; k++) { const s = (dr * k) / 55; out.push([kx(s), ky(fn(s))]); }
    out.push([kx(pr.tp[0]), ky(pr.tp[1])], [kx(pr.y[0]), ky(pr.y[1])], [kx(pr.fc[0]), ky(pr.fc[1])], [kx(pr.drop[0]), ky(pr.drop[1])]);
    return out; // 56 bodov krivky a 4 značky (bod obratu, žltnutie, prvé praskanie, vysypanie)
  };
  const krivka = $('[data-krivka]');
  const krivkaCesta = $('[data-k-krivka]');
  const plochaCesta = $('[data-k-plocha]');
  const znacky = ['tp', 'y', 'fc', 'drop'].map((id) => $(`[data-k-bod="${id}"]`));
  const legenda = $$('[data-k-legenda] li');
  const MENA_BODOV = ['Bod obratu', 'Žltnutie', 'Prvé praskanie', 'Vysypanie'];
  let krivkaId = 'kolumbia';
  let krivkaBody = bodyKrivky(PROFILY.kolumbia);
  let krivkaViditelna = false;
  let morf = 0;
  const cas = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const kresliKrivku = (b) => {
    const c = 'M' + b.slice(0, 56).map(([x, y]) => f1(x) + ' ' + f1(y)).join('L');
    krivkaCesta.setAttribute('d', c);
    plochaCesta.setAttribute('d', `${c}L${f1(b[55][0])} 340L70 340Z`);
    znacky.forEach((g, i) => {
      const [x, y] = b[56 + i];
      const [c1, c2] = g.querySelectorAll('circle');
      const [n, t1, t2] = g.querySelectorAll('text');
      c1.setAttribute('cx', f1(x)); c1.setAttribute('cy', f1(y));
      c2.setAttribute('cx', f1(x)); c2.setAttribute('cy', f1(y));
      n.setAttribute('x', f1(x)); n.setAttribute('y', f1(y + 7.2));
      if (i < 3) {
        const ox = [14, 12, 11][i];
        t1.setAttribute('x', f1(x + ox)); t1.setAttribute('y', f1(y + 32));
        t2.setAttribute('x', f1(x + ox)); t2.setAttribute('y', f1(y + 50));
      } else {
        const kraj = x > 540;
        [t1, t2].forEach((t) => { t.setAttribute('text-anchor', kraj ? 'end' : 'middle'); t.setAttribute('x', f1(kraj ? x + 12 : x)); });
        t1.setAttribute('y', f1(y - 37));
        t2.setAttribute('y', f1(y - 20));
      }
    });
  };
  const nastavKrivku = (id, animuj) => {
    if (!krivka || id === krivkaId || !PROFILY[id]) return;
    krivkaId = id;
    const k = KAVY[id];
    const pr = PROFILY[id];
    const radio = $(`input[name="k-profil"][value="${id}"]`);
    if (radio) radio.checked = true;
    krivka.style.setProperty('--k-farba', k.krivka);
    const hodnoty = [pr.tp, pr.y, pr.fc, pr.drop].map(([s, T]) => `${cas(s)} · ${T}${NB}°C`);
    znacky.forEach((g, i) => { const t = g.querySelectorAll('text'); t[1].textContent = MENA_BODOV[i]; t[2].textContent = hodnoty[i]; });
    legenda.forEach((li, i) => { const b = document.createElement('b'); b.textContent = MENA_BODOV[i]; li.replaceChildren(b, ' ' + hodnoty[i]); });
    $('[data-k-titulok]').textContent = `Krivka praženia ${k.rod}`;
    $('[data-k-opis]').textContent = `Teplota zrna v čase. Po vsypaní klesne na ${pr.tp[1]}${NB}°C v čase ${cas(pr.tp[0])}, žltnutie pri ${pr.y[1]}${NB}°C v ${cas(pr.y[0])}, prvé praskanie pri ${pr.fc[1]}${NB}°C v ${cas(pr.fc[0])} a vysypanie pri ${pr.drop[1]}${NB}°C v ${cas(pr.drop[0])}.`;
    $('[data-k-popis]').textContent = nb(`Krivka praženia ${k.rod}: teplota zrna v čase. Po prvom praskaní ju necháme dopražiť ešte ${pr.drop[0] - pr.fc[0]}${NB}sekúnd.`);
    const ciel = bodyKrivky(pr);
    cancelAnimationFrame(morf);
    if (!animuj || pokoj.matches || !krivkaViditelna) { krivkaBody = ciel; kresliKrivku(ciel); return; }
    const od = krivkaBody;
    const start = performance.now();
    const krokK = (t) => {
      const x = Math.min(1, (t - start) / 650);
      const e = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
      krivkaBody = od.map(([x0, y0], i) => [x0 + (ciel[i][0] - x0) * e, y0 + (ciel[i][1] - y0) * e]);
      kresliKrivku(krivkaBody);
      if (x < 1) morf = requestAnimationFrame(krokK);
    };
    morf = requestAnimationFrame(krokK);
  };
  if (krivka && 'IntersectionObserver' in window) {
    const kresliPriVstupe = !pokoj.matches;
    if (kresliPriVstupe) krivka.classList.add('js-kreslenie');
    const io = new IntersectionObserver((z) => {
      const x = z[z.length - 1];
      krivkaViditelna = x.isIntersecting;
      if (kresliPriVstupe && x.intersectionRatio >= 0.35) krivka.classList.add('kreslit');
    }, { threshold: [0, 0.35] });
    io.observe(krivka);
  }

  /* Osobný odber: stav podľa času v Bratislave. Čas sa počíta bez Intl s časovou zónou (prvé použitie ICU je na slabom
     mobile drahé): stredoeurópsky čas, letný od poslednej nedele v marci do poslednej nedele v októbri (1:00 UTC).
     Počíta sa až v nečinnosti, sekcia je ďaleko pod ohybom. */
  const casBratislava = (d) => {
    const r = d.getUTCFullYear();
    const poslednaNedela = (mesiac) => { const x = new Date(Date.UTC(r, mesiac + 1, 0)); return x.getUTCDate() - x.getUTCDay(); };
    const leto = d.getTime() >= Date.UTC(r, 2, poslednaNedela(2), 1) && d.getTime() < Date.UTC(r, 9, poslednaNedela(9), 1);
    const m = new Date(d.getTime() + (leto ? 2 : 1) * 3600000);
    return { den: (m.getUTCDay() + 6) % 7, min: m.getUTCHours() * 60 + m.getUTCMinutes() };
  };
  const ukazStav = () => {
    const stav = $('[data-stav]');
    if (!stav) return;
    const { den, min } = casBratislava(new Date());
    const HODINY = [null, [480, 960], [480, 960], [480, 960], [480, 960], [540, 720], null];
    const MENA = ['v pondelok', 'v utorok', 'v stredu', 'vo štvrtok', 'v piatok', 'v sobotu', 'v nedeľu'];
    const hod = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
    const dnes = HODINY[den];
    if (dnes && min >= dnes[0] && min < dnes[1]) {
      stav.textContent = `Teraz otvorené, dnes do ${hod(dnes[1])}`;
      stav.classList.add('otvorene');
    } else if (dnes && min < dnes[0]) {
      stav.textContent = `Teraz zatvorené, otvárame dnes o${NB}${hod(dnes[0])}`;
    } else {
      let d = (den + 1) % 7;
      while (!HODINY[d]) d = (d + 1) % 7;
      stav.textContent = nb(`Teraz zatvorené, otvárame ${d === (den + 1) % 7 ? 'zajtra' : MENA[d]} o ${hod(HODINY[d][0])}`);
    }
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(ukazStav, { timeout: 3000 });
  else setTimeout(ukazStav, 1200);

  /* Úvodné otočenie kolotoča: keď vrecká dopadnú (CSS), asi 0,6 s od začiatku načítania; ak skript prišiel neskôr, hneď. */
  if (!pokoj.matches) setTimeout(roztoc, Math.max(0, 600 - performance.now()));
})();
