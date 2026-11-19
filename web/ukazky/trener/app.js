// Švih: ukážka webu od ARLing (vymyslený osobný tréner v Trenčíne). Bez knižníc a bez merania.
// 1. kinetické meno: pri načítaní sa ŠVIH raz švihne (šírka 62, 121, 102, pokoj 118, sklon ako kyvadlo -9°, +3°, 0°, 1,45 s),
//    potom na rýchly posun zúži šírku najviac na 90 a pružinou sa vráti; jeden prvok, requestAnimationFrame.
//    Meno je už v prvom vykreslení v póze nádychu (šírka 62, sklon -9°): písmo mena je v stránke ako data: URI a kým ho
//    prehliadač dekóduje, pózu drží vložený obrys tých istých písmen (SVG v .meno), potom ho nahradí text.
// 1b. úvodná fotka sa po dekódovaní potichu objaví (priehľadnosť a mierka 1,04 na 1); hlasný je len švih.
// 2. limetkový zvýrazňovač pod slovami sa pri vstupe natiahne zľava; v úvode ho dotiahne až dopad švihu.
// 3. časová os a veľké stopky cez celú šírku bežia s posunom. 3c. permanentka balíka 10 tréningov sa opečiatkuje v obraze.
// 4. okná Prvý tréning a Zavolať (Esc, klik vedľa); nadpis, suma a veta okna podľa balíka; ukážkový formulár nič neodošle.
// 5. dnešná dostupnosť podľa času v Bratislave, lepiaca lišta na mobile.
(() => {
  'use strict';
  const pokojne = window.matchMedia('(prefers-reduced-motion: reduce)');
  const menejPohybu = () => pokojne.matches;
  const maIO = 'IntersectionObserver' in window;

  /* 2a. Podčiarknutie vety v úvode: dotiahne ho dopad švihu (nie súbežný tretí pohyb), najneskôr po 2,6 s */
  const vetaUvodu = document.querySelector('[data-zvyraz="svih"]');
  const dopad = () => { if (vetaUvodu) vetaUvodu.classList.add('videne'); };
  setTimeout(dopad, 2600);

  /* 1. Kinetické meno */
  const meno = document.querySelector('.meno');
  const menoBox = document.querySelector('.meno-h1');
  if (meno && menoBox) {
    const POKOJ = 118;
    const NAJUZSIE = 90;
    let w = POKOJ;
    let rych = 0;
    let sklon = 0;
    let intro = true;
    let vidno = true;
    let bezi = false;
    let tPred = 0;
    let posun = 0;
    let rychlostPosunu = 0;
    // scrollY sa nečíta pri štarte: čítanie by vynútilo rozloženie celej stránky ešte pred prvým vykreslením
    let yPred = null;
    let tPosunu = 0;

    const kresli = () => {
      meno.style.fontVariationSettings = `"wdth" ${w.toFixed(2)}`;
      meno.style.transform = Math.abs(sklon) > 0.02 ? `skewX(${sklon.toFixed(2)}deg)` : 'none';
    };
    const vystup = (t) => 1 - Math.pow(1 - t, 3);
    const tam = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
    const prekmit = (t) => { const c1 = 1.6; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
    // Švih ako kettlebell: nádych 62, výmach hore na 121 (nie 125, H sa neoreže o okraj okna), spätný mach na 102,
    // pružina do pokoja 118; sklon ide ako kyvadlo -9° na +3° a do 0°. Spolu 1 450 ms, aby ho bolo vidno aj na mobile.
    const DLZKA = 1450;
    const DOPAD = 760; // začiatok spätného machu: tu sa pod vetou natiahne podčiarknutie (dobehne do 1,21 s)
    const krivka = (t) => {
      if (t < 360) return 62 + (121 - 62) * vystup(t / 360);
      if (t < DOPAD) return 121 + (102 - 121) * tam((t - 360) / 400);
      if (t < DLZKA) return 102 + (POKOJ - 102) * prekmit((t - DOPAD) / (DLZKA - DOPAD));
      return POKOJ;
    };
    const kyvadlo = (t) => {
      if (t < 420) return -9 + 12 * vystup(t / 420);
      if (t < DLZKA) return 3 * (1 - tam((t - 420) / (DLZKA - 420)));
      return 0;
    };

    const spustiSvih = () => {
      if (!meno.classList.contains('caka')) return;
      if (menejPohybu()) { meno.classList.remove('caka'); w = POKOJ; sklon = 0; kresli(); intro = false; dopad(); return; }
      w = 62; sklon = -9; kresli();
      meno.classList.remove('caka');
      const t0 = performance.now();
      let dopadol = false;
      const krok = (teraz) => {
        const t = Math.max(0, teraz - t0);
        w = krivka(t);
        sklon = kyvadlo(t);
        kresli();
        if (!dopadol && t >= DOPAD) { dopadol = true; dopad(); }
        if (t < DLZKA) { requestAnimationFrame(krok); return; }
        w = POKOJ; sklon = 0; kresli(); intro = false; dopad();
      };
      requestAnimationFrame(krok);
    };
    let spustene = false;
    const raz = () => { if (!spustene) { spustene = true; spustiSvih(); } };
    // Písmo mena je vložené v stránke, je hneď k dispozícii. Švih počká ešte najviac 300 ms na ostatné písma
    // (ich výmena by prepočítala stránku uprostred švihu; náhradné písmo má ich metriky, takže sa už nič neposunie)
    // a dve snímky, aby sa dokončilo prvé vykreslenie s menom v póze nádychu.
    // Kým sa písmo dekóduje, pózu drží vložený obrys (SVG v .meno); po načítaní ho nahradí ten istý text (trieda pismo).
    const dveSnimky = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const najviac = (ms) => new Promise((r) => setTimeout(r, ms));
    const pismo = () => meno.classList.add('pismo');
    if (document.fonts && document.fonts.load) {
      document.fonts.load('900 100px "Svih Meno"', 'ŠVIH')
        .then((f) => { if (f && f.length) pismo(); return Promise.race([document.fonts.ready, najviac(300)]); })
        .then(dveSnimky)
        .then(raz, raz);
    } else raz();
    setTimeout(raz, 1600);

    // rýchly posun: cieľová šírka klesá s rýchlosťou, pružina (tuhosť 420, tlmenie 29) ju vracia
    const pruzina = (teraz) => {
      const dt = Math.min(0.034, Math.max(0.001, (teraz - tPred) / 1000));
      tPred = teraz;
      rychlostPosunu *= Math.exp(-dt / 0.1);
      posun = Math.min(POKOJ - NAJUZSIE, rychlostPosunu * 11);
      const ciel = POKOJ - posun;
      const a = 420 * (ciel - w) - 29 * rych;
      rych += a * dt;
      w = Math.max(NAJUZSIE - 2, Math.min(121, w + rych * dt));
      kresli();
      if (Math.abs(POKOJ - w) < 0.04 && Math.abs(rych) < 0.05 && rychlostPosunu < 0.02) {
        w = POKOJ; rych = 0; kresli(); bezi = false; return;
      }
      requestAnimationFrame(pruzina);
    };
    window.addEventListener('scroll', () => {
      const teraz = performance.now();
      if (yPred === null) { yPred = window.scrollY; tPosunu = teraz; return; }
      const dy = Math.abs(window.scrollY - yPred);
      const dt = Math.max(8, teraz - tPosunu);
      yPred = window.scrollY; tPosunu = teraz;
      if (intro || !vidno || document.hidden || menejPohybu()) return;
      rychlostPosunu = Math.max(rychlostPosunu, dy / dt);
      if (!bezi && rychlostPosunu > 0.6) { bezi = true; tPred = teraz; requestAnimationFrame(pruzina); }
    }, { passive: true });
    if (maIO) new IntersectionObserver(([z]) => { vidno = z.isIntersecting; }).observe(menoBox);
  } else dopad();

  /* 1b. Úvodná fotka sa potichu objaví hneď, ako je dekódovaná. Na švih nečaká: je to najväčší prvok prvej obrazovky (LCP). */
  const foto = document.querySelector('[data-foto]');
  if (foto) {
    const img = foto.querySelector('img');
    let hotovo = false;
    const ukaz = () => { if (!hotovo) { hotovo = true; requestAnimationFrame(() => foto.classList.remove('caka')); } };
    if (menejPohybu() || !img) ukaz();
    else if (img.complete && img.naturalWidth) ukaz();
    else {
      img.addEventListener('load', () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(ukaz), { once: true });
      img.addEventListener('error', ukaz, { once: true });
      setTimeout(ukaz, 2400);
    }
  }

  /* 2. Zvýrazňovač (okrem vety v úvode, tú dotiahne dopad švihu) */
  const zvyraz = [...document.querySelectorAll('[data-zvyraz]')].filter((e) => e !== vetaUvodu);
  if (!maIO || menejPohybu()) { zvyraz.forEach((e) => e.classList.add('videne')); dopad(); }
  else {
    const io = new IntersectionObserver((zaznamy) => {
      for (const z of zaznamy) if (z.isIntersecting) { z.target.classList.add('videne'); io.unobserve(z.target); }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.5 });
    zvyraz.forEach((e) => io.observe(e));
  }

  /* 3. Časová os prvého tréningu */
  const os = document.querySelector('[data-os]');
  if (os) {
    const plna = os.querySelector('.os-plna');
    const ciara = os.querySelector('.os-ciara');
    const kroky = [...os.querySelectorAll('.os-krok')];
    let posledne = -1;
    // zápis bez čítania rozloženia; polohy uzlov (relatívne k čiare) dodá prepočet, ktorý najprv číta a až potom píše
    const nastav = (p, uzly) => {
      if (Math.abs(p - posledne) < 0.002) return;
      posledne = p;
      plna.style.transform = `scaleY(${p.toFixed(4)})`;
      kroky.forEach((k, i) => k.classList.toggle('zapnute', uzly ? uzly[i] <= p : i === 0 && p > 0));
    };
    if (!maIO || menejPohybu()) nastav(1, kroky.map(() => 0));
    else {
      let caka = false;
      let aktivne = false;
      const prepocitaj = () => {
        caka = false;
        const r = ciara.getBoundingClientRect();
        const uzly = kroky.map((k) => (k.getBoundingClientRect().top + 13 - r.top) / r.height);
        const kotva = window.innerHeight * 0.62;
        nastav(Math.min(1, Math.max(0, (kotva - r.top) / r.height)), uzly);
      };
      const naPosun = () => { if (aktivne && !caka) { caka = true; requestAnimationFrame(prepocitaj); } };
      window.addEventListener('scroll', naPosun, { passive: true });
      window.addEventListener('resize', naPosun, { passive: true });
      new IntersectionObserver(([z]) => { aktivne = z.isIntersecting; if (aktivne) naPosun(); }, { rootMargin: '20% 0px' }).observe(os);
      plna.style.transform = 'scaleY(0)';
      posledne = 0;
    }
  }

  /* 3b. Veľké stopky cez celú šírku: bežia s posunom, kým nimi človek prechádza (od 95 % po 25 % výšky okna).
         Pod nimi štyri úseky v pomere 10, 15, 25 a 10 minút: každý sa plní vo svojom čase, práve bežiaci má svetlý popis
         (na mobile je jeho meno pod pásmi). Kým stopky bežia, dvojbodka bliká raz za sekundu. */
  const velke = document.querySelector('[data-stopky]');
  if (velke) {
    const box = velke.closest('.stopky');
    const min = velke.querySelector('[data-min]');
    const sek = velke.querySelector('[data-sek]');
    const nazov = document.querySelector('[data-usek-nazov]');
    const useky = [...document.querySelectorAll('[data-usek]')].map((u) => ({
      el: u, od: Number(u.dataset.od), do: Number(u.dataset.do), plna: u.querySelector('.usek-plna'),
      text: `${(u.querySelector('.usek-meno') || u).textContent.trim()}, ${(u.querySelector('.usek-dlzka') || u).textContent.trim()}`,
    }));
    let pred = -1;
    let predNazov = '';
    const pis = (p) => {
      const s = Math.round(p * 3600);
      min.textContent = String(Math.floor(s / 60)).padStart(2, '0');
      sek.textContent = String(s % 60).padStart(2, '0');
      const m = s / 60;
      let teraz = useky[0];
      for (const u of useky) {
        const f = Math.min(1, Math.max(0, (m - u.od) / (u.do - u.od)));
        if (u.plna) u.plna.style.transform = `scaleX(${f.toFixed(4)})`;
        const bezi = m > u.od && m <= u.do;
        u.el.classList.toggle('teraz', bezi);
        if (bezi) teraz = u;
      }
      if (nazov && teraz && teraz.text !== predNazov) { predNazov = teraz.text; nazov.textContent = teraz.text; }
    };
    if (!maIO || menejPohybu() || !min || !sek) { if (min && sek) pis(1); }
    else {
      let aktivne = false;
      let caka = false;
      let stoj = 0;
      const prepocet = () => {
        caka = false;
        const r = box.getBoundingClientRect();
        const vh = window.innerHeight;
        const p = Math.min(1, Math.max(0, (vh * 0.95 - r.top) / (vh * 0.7)));
        if (Math.abs(p - pred) > 0.0004) {
          pred = p; pis(p);
          // kým stopky bežia (posun medzi 00:00 a 60:00), dvojbodka bliká raz za sekundu; 0,4 s po zastavení posunu prestane
          velke.classList.toggle('bezi', p > 0 && p < 1);
          clearTimeout(stoj);
          stoj = setTimeout(() => velke.classList.remove('bezi'), 400);
        }
      };
      const naPosun = () => { if (aktivne && !caka) { caka = true; requestAnimationFrame(prepocet); } };
      window.addEventListener('scroll', naPosun, { passive: true });
      window.addEventListener('resize', naPosun, { passive: true });
      new IntersectionObserver(([z]) => { aktivne = z.isIntersecting; if (aktivne) naPosun(); }, { rootMargin: '10% 0px' }).observe(box);
      pis(0);
    }
  }

  /* 3c. Permanentka balíka 10 tréningov: desať bodiek sa postupne opečiatkuje, keď je celá v obraze (myš aj dotyk) */
  const permanentka = document.querySelector('[data-permanentka]');
  if (permanentka) {
    const opeciatkuj = () => permanentka.classList.add('opeciatkovane');
    if (!maIO || menejPohybu()) opeciatkuj();
    else {
      const io = new IntersectionObserver(([z]) => { if (z.isIntersecting) { opeciatkuj(); io.disconnect(); } }, { rootMargin: '0px 0px -12% 0px', threshold: 1 });
      io.observe(permanentka);
    }
  }

  /* 4. Okná. Okno Prvý tréning ukazuje nadpis, sumu a vetu zvoleného balíka (R65, R78): po „Chcem balík“ aj po zmene voľby. */
  const oknoTrening = document.getElementById('okno-trening');
  const obnovOkno = () => {
    if (!oknoTrening) return;
    const r = oknoTrening.querySelector('input[name="zaujem"]:checked');
    if (!r) return;
    const nadpis = oknoTrening.querySelector('#okno-trening-nadpis');
    const cena = oknoTrening.querySelector('[data-okno-cena]');
    const veta = oknoTrening.querySelector('[data-okno-veta]');
    if (nadpis && r.dataset.nadpis) nadpis.textContent = r.dataset.nadpis;
    if (cena && r.dataset.cena) cena.textContent = r.dataset.cena;
    if (veta && r.dataset.veta) veta.textContent = r.dataset.veta;
  };
  const otvor = (id, spustac) => {
    const d = document.getElementById(id);
    if (!d || typeof d.showModal !== 'function') return false;
    const vyber = spustac && spustac.getAttribute('data-vyber');
    if (vyber) {
      const r = d.querySelector(`input[name="zaujem"][value="${CSS.escape(vyber)}"]`);
      if (r) r.checked = true;
    }
    if (d === oknoTrening) obnovOkno();
    const stav = d.querySelector('[role="status"]');
    if (stav) stav.textContent = '';
    if (!d.open) d.showModal();
    return true;
  };
  document.addEventListener('click', (e) => {
    const spustac = e.target.closest('[data-okno]');
    if (spustac) { if (otvor(spustac.getAttribute('data-okno'), spustac)) e.preventDefault(); return; }
    const zavri = e.target.closest('[data-zavriet]');
    if (zavri) { const d = zavri.closest('dialog'); if (d) d.close(); }
  });
  document.querySelectorAll('dialog.okno').forEach((d) => {
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  });
  const formular = document.getElementById('formular-trening');
  if (formular) {
    const stav = document.getElementById('formular-stav');
    formular.addEventListener('change', (e) => {
      if (e.target && e.target.name === 'zaujem') { obnovOkno(); if (stav) stav.textContent = ''; }
    });
    formular.addEventListener('submit', (e) => {
      e.preventDefault();
      const prazdne = [...formular.querySelectorAll('input[required]')].find((p) => !p.checkValidity());
      if (prazdne) {
        stav.textContent = prazdne.type === 'email' ? 'Doplňte e-mail v tvare meno@domena.sk.' : 'Doplňte meno.';
        prazdne.focus();
        return;
      }
      const zaujem = formular.querySelector('input[name="zaujem"]:checked');
      const co = zaujem ? `${zaujem.value}, ${zaujem.dataset.cena || ''}`.replace(/, $/, '') : 'Prvý tréning';
      stav.textContent = `Ukážka: nič sa neodoslalo. Na vašom webe by dopyt (${co}) prišiel trénerovi na e-mail.`;
    });
  }

  /* 5. Dnešná dostupnosť (čas v Bratislave). Bez Intl: prvé použitie Intl s časovým pásmom načítava údaje ICU
        a na slabom mobile blokuje hlavné vlákno. SEČ je UTC+1, letný čas UTC+2 od poslednej marcovej
        do poslednej októbrovej nedele, vždy o 1:00 UTC (pravidlo EÚ). */
  const casVBratislave = (teraz) => {
    const rok = teraz.getUTCFullYear();
    const poslednaNedela = (mesiac) => { const d = new Date(Date.UTC(rok, mesiac + 1, 0, 1)); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d.getTime(); };
    const leto = teraz.getTime() >= poslednaNedela(2) && teraz.getTime() < poslednaNedela(9);
    const ba = new Date(teraz.getTime() + (leto ? 2 : 1) * 3600000);
    return { den: ba.getUTCDay(), hod: ba.getUTCHours() + ba.getUTCMinutes() / 60 };
  };
  const HODINY = { 0: null, 1: [6, 20], 2: [6, 20], 3: [6, 20], 4: [6, 20], 5: [6, 20], 6: [8, 12] };
  const DNI = ['nedeľa', 'pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota'];
  // „v pondelok“, „vo štvrtok“: predložka s pevnou medzerou, deň v akuzatíve
  const KEDY_DEN = ['v nedeľu', 'v pondelok', 'v utorok', 'v stredu', 'vo štvrtok', 'v piatok', 'v sobotu'];
  try {
    const { den, hod } = casVBratislave(new Date());
    const dnes = HODINY[den];
    const dalsi = (() => { for (let i = 1; i <= 7; i++) { const d = (den + i) % 7; if (HODINY[d]) return [d, HODINY[d][0], i]; } return null; })();
    // „zajtra o 6:00“, „v pondelok o 6:00“ (o s pevnou medzerou)
    const kedyDalsi = dalsi ? `${dalsi[2] === 1 ? 'zajtra' : KEDY_DEN[dalsi[0]]} o ${dalsi[1]}:00` : '';
    let nadpisText;
    let kratko;
    let veta;
    if (dnes && hod < dnes[1]) {
      nadpisText = 'Dnes';
      kratko = hod < dnes[0] ? `trénujem od ${dnes[0]}:00 do ${dnes[1]}:00` : `trénujem do ${dnes[1]}:00`;
      veta = `Dnes je ${DNI[den]}: ${kratko}.`;
    } else {
      // večer a cez voľný deň je na najviditeľnejšom mieste najbližší termín, nie zlá správa
      nadpisText = 'Najbližšie';
      kratko = kedyDalsi;
      veta = dnes ? `Dnes už netrénujem, najbližšie ${kedyDalsi}.` : `Dnes je voľno, najbližšie ${kedyDalsi}.`;
    }
    const nadpis = document.querySelector('[data-dnes-nadpis]');
    const text = document.querySelector('[data-dnes]');
    const vetaEl = document.querySelector('[data-dnes-veta]');
    if (den !== undefined && kratko && nadpis && text) { nadpis.textContent = nadpisText; text.textContent = kratko; }
    if (den !== undefined && kratko && vetaEl) vetaEl.textContent = veta;
  } catch (e) { /* pri chybe ostane statický text z HTML */ }

  /* 6. Lepiaca lišta (len mobil): po prejdení úvodu, skrytá pri kontakte a päte */
  const lista = document.querySelector('[data-lista]');
  const akcie = document.querySelector('.uvod-akcie');
  if (lista && akcie && maIO) {
    const stav = { zaUvodom: false, koniec: new Set() };
    const obnov = () => lista.classList.toggle('vidno', stav.zaUvodom && stav.koniec.size === 0);
    new IntersectionObserver(([z]) => { stav.zaUvodom = !z.isIntersecting && z.boundingClientRect.top < 0; obnov(); }).observe(akcie);
    const io = new IntersectionObserver((zaznamy) => {
      zaznamy.forEach((z) => { if (z.isIntersecting) stav.koniec.add(z.target); else stav.koniec.delete(z.target); });
      obnov();
    });
    ['kontakt'].forEach((id) => { const e = document.getElementById(id); if (e) io.observe(e); });
    const pata = document.querySelector('.pata');
    if (pata) io.observe(pata);
  }
})();
