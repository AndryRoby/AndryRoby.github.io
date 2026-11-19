// Fyzioterapia Os: ukážka webu od ARLing (vymyslená súkromná fyzioterapia v Trnave). Bez knižníc a bez merania.
// Pohyb chrbtice v úvode je celý v CSS (začne hneď po prvom vykreslení a dobehne do 1,8 s), JS ho nespúšťa.
// 1. Popisy chrbtice zvýraznia svoje stavce a vedú na mapu tela.
// 2. Mapa tela: ťuk na bod alebo tlačidlo v zozname ukáže postup, typický plán a cenu, oblasť na postave sa rozsvieti.
// 3. Prvá návšteva: fotka v ráme sa mení podľa kroku, ktorý je v strede obrazovky.
// 4. Okná Rezervovať a Zavolať (Esc, klik vedľa), ukážkový formulár nič neodošle.
// 5. Stav „Teraz otvorené“ podľa času v Bratislave (letný čas od poslednej marcovej do poslednej októbrovej nedele).
//    Text v HTML sa nemení; stav sa len pridá ako štítok na fotku (bez posunu rozloženia) a do vety pri hodinách.
// 6. Lepiaca lišta na mobile a tablete.
(() => {
  'use strict';
  const pokojne = window.matchMedia('(prefers-reduced-motion: reduce)');
  const menejPohybu = () => pokojne.matches;
  const maIO = 'IntersectionObserver' in window;
  const NB = ' ';

  /* 2. Mapa tela (vyber sa volá aj z popisov chrbtice) */
  const ZONY = {
    krk: { nadpis: 'Krk', co: `Vyšetrenie držania hlavy a${NB}pohybu krku, mäkké techniky, mobilizácia a${NB}cviky na prestávky pri počítači.`, plan: `3 až 5${NB}návštev`, oblast: 'Krk' },
    plecia: { nadpis: 'Plecia', co: `Vyšetrenie rozsahu pohybu ramena a${NB}práce lopatky, mobilizácia a${NB}posilňovanie s${NB}gumou.`, plan: `4 až 6${NB}návštev`, oblast: 'Plecia' },
    hrudna: { nadpis: 'Hrudná chrbtica', co: `Mobilizácia hrudnej chrbtice a${NB}rebier, dychové cviky a${NB}cviky na držanie tela pri sedení.`, plan: `3 až 5${NB}návštev`, oblast: 'Hrudná chrbtica' },
    kriz: { nadpis: `Driek a${NB}kríže`, co: `Vyšetrenie panvy a${NB}drieku, mäkké techniky, mobilizácia a${NB}stabilizačné cviky, ktoré zvládnete doma za 10${NB}minút.`, plan: `4 až 6${NB}návštev`, oblast: `Driek a${NB}kríže` },
    koleno: { nadpis: 'Koleno', co: `Vyšetrenie osi nohy a${NB}pohybu kolena, posilňovanie stehna a${NB}bedra, kineziotejp podľa potreby.`, plan: `4 až 8${NB}návštev`, oblast: 'Koleno' },
    clenok: { nadpis: 'Členok', co: `Vyšetrenie po vytknutí alebo preťažení, cviky na rovnováhu a${NB}silu, kineziotejp podľa potreby.`, plan: `3 až 6${NB}návštev`, oblast: 'Členok' },
  };
  const CENA = `prvá 55${NB}€, ďalšie 45${NB}€`;
  const mapa = document.querySelector('[data-mapa]');
  const detail = document.getElementById('detail');
  let vyber = () => {};
  if (mapa && detail) {
    const obsah = detail.querySelector('.detail-obsah');
    const pole = (k) => detail.querySelector(`[data-detail="${k}"]`);
    const tlacidlo = detail.querySelector('[data-oblast]');
    const body = [...document.querySelectorAll('.bod')];
    const zony = [...document.querySelectorAll('.zona')];
    let aktivna = 'kriz';
    vyber = (kluc) => {
      const z = ZONY[kluc];
      if (!z) return;
      zony.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.zona === kluc)));
      body.forEach((b) => {
        const je = b.dataset.zona === kluc;
        b.classList.toggle('aktivny', je);
        if (!je) b.classList.remove('ping');
        else if (kluc !== aktivna) { b.classList.remove('ping'); void b.offsetWidth; b.classList.add('ping'); }
      });
      mapa.setAttribute('data-vybrane', kluc);
      if (kluc === aktivna) return;
      aktivna = kluc;
      pole('nadpis').textContent = z.nadpis;
      pole('co').textContent = z.co;
      pole('plan').textContent = z.plan;
      pole('cena').textContent = CENA;
      if (tlacidlo) tlacidlo.setAttribute('data-oblast', z.oblast);
      obsah.classList.remove('zmena');
      void obsah.offsetWidth;
      obsah.classList.add('zmena');
    };
    document.addEventListener('click', (e) => {
      const b = e.target.closest('.zona, .bod');
      if (!b) return;
      vyber(b.dataset.zona);
      // ťuk na bod na mobile posunie detail do obrazu, ak je pod okrajom
      if (b.classList.contains('bod') && window.innerWidth < 760) {
        const r = detail.getBoundingClientRect();
        if (r.top > window.innerHeight * 0.62) detail.scrollIntoView({ behavior: menejPohybu() ? 'auto' : 'smooth', block: 'center' });
      }
    });
  }

  /* 1. Popisy chrbtice: zvýraznenie skupiny stavcov a výber oblasti na mape */
  const chrbtica = document.querySelector('[data-chrbtica]');
  if (chrbtica) {
    chrbtica.querySelectorAll('.stitok').forEach((s) => {
      const ukaz = () => chrbtica.setAttribute('data-ukaz', s.dataset.skupina);
      const skry = () => chrbtica.removeAttribute('data-ukaz');
      s.addEventListener('pointerenter', ukaz);
      s.addEventListener('pointerleave', skry);
      s.addEventListener('focus', ukaz);
      s.addEventListener('blur', skry);
      s.addEventListener('click', () => vyber(s.dataset.zona));
    });
  }

  /* 3. Prvá návšteva: fotka podľa kroku v strede obrazovky */
  const ram = document.querySelector('[data-ram]');
  const zoznamKrokov = document.querySelector('[data-kroky]');
  if (ram && zoznamKrokov && maIO) {
    const kroky = [...zoznamKrokov.querySelectorAll('[data-krok]')];
    const fotky = [...ram.querySelectorAll('img')];
    const cislo = ram.querySelector('[data-ram-cislo]');
    const nazov = ram.querySelector('[data-ram-nazov]');
    let aktivny = -1;
    const nastav = (i) => {
      if (i === aktivny || i < 0 || i >= kroky.length) return;
      aktivny = i;
      fotky.forEach((f, k) => f.classList.toggle('aktivna', k === i));
      kroky.forEach((k, j) => { k.classList.toggle('hotovy', j < i); k.classList.toggle('aktivny', j === i); });
      if (cislo) cislo.textContent = String(i + 1);
      if (nazov) nazov.textContent = (kroky[i].dataset.nazov || '').replace(' min', `${NB}min`);
    };
    ram.classList.add('zivy');
    zoznamKrokov.classList.add('zive');
    nastav(0);
    // fotky 2 až 4 sa začnú sťahovať, až keď je rám blízko (bez JS ostane len prvá)
    new IntersectionObserver(([z], io) => {
      if (z.isIntersecting) { ram.classList.add('nacitane'); io.disconnect(); }
    }, { rootMargin: '700px 0px' }).observe(ram);
    // od tabletu je rám vedľa krokov a čítací pás v strede okna, na mobile je pás pod lepiacim rámom
    const sirokeOkno = window.matchMedia('(min-width: 760px)');
    let pozorovatel;
    const sleduj = () => {
      if (pozorovatel) pozorovatel.disconnect();
      pozorovatel = new IntersectionObserver((zaznamy) => {
        zaznamy.forEach((z) => { if (z.isIntersecting) nastav(Number(z.target.dataset.krok)); });
      }, { rootMargin: sirokeOkno.matches ? '-50% 0px -50% 0px' : '-62% 0px -37% 0px' });
      kroky.forEach((k) => pozorovatel.observe(k));
    };
    sleduj();
    if (sirokeOkno.addEventListener) sirokeOkno.addEventListener('change', sleduj);
  }

  /* 4. Okná */
  const otvor = (id, spustac) => {
    const d = document.getElementById(id);
    if (!d || typeof d.showModal !== 'function') return false;
    const oblast = spustac && spustac.getAttribute('data-oblast');
    if (oblast) {
      const s = d.querySelector('select[name="oblast"]');
      if (s) [...s.options].forEach((o) => { if (o.text === oblast) s.value = o.value; });
    }
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
  const formular = document.getElementById('formular');
  if (formular) {
    formular.addEventListener('submit', (e) => {
      e.preventDefault();
      const stav = document.getElementById('formular-stav');
      const prazdne = [...formular.querySelectorAll('input[required]')].find((p) => !p.checkValidity());
      if (prazdne) {
        stav.textContent = prazdne.type === 'email' ? 'Doplňte e-mail v tvare meno@domena.sk.' : 'Doplňte meno.';
        prazdne.focus();
        return;
      }
      const sluzba = formular.querySelector('input[name="sluzba"]:checked');
      const cas = formular.querySelector('input[name="cas"]:checked');
      const oblast = formular.querySelector('select[name="oblast"]');
      const zhrnutie = [sluzba && sluzba.value, oblast && oblast.value, cas && cas.value].filter(Boolean).join(', ');
      stav.textContent = `Ukážka: nič sa neodoslalo. Na vašom webe by žiadosť (${zhrnutie}) prišla vám na e-mail.`;
    });
  }

  /* 5. Stav podľa času v Bratislave, bez Intl (časové pásmo cez Intl je pri prvom použití drahé) */
  const casVBratislave = (d) => {
    const rok = d.getUTCFullYear();
    const poslednaNedela = (mesiac) => { const x = new Date(Date.UTC(rok, mesiac + 1, 0)); return x.getUTCDate() - x.getUTCDay(); };
    const leto = d.getTime() >= Date.UTC(rok, 2, poslednaNedela(2), 1) && d.getTime() < Date.UTC(rok, 9, poslednaNedela(9), 1);
    const t = new Date(d.getTime() + (leto ? 2 : 1) * 3600000);
    return { den: t.getUTCDay(), hod: t.getUTCHours() + t.getUTCMinutes() / 60 };
  };
  const HODINY = { 0: null, 1: [7, 19], 2: [7, 19], 3: [7, 19], 4: [7, 19], 5: [7, 15], 6: null };
  const KEDY = ['v nedeľu', 'v pondelok', 'v utorok', 'v stredu', 'vo štvrtok', 'v piatok', 'v sobotu'];
  const stav = () => {
    const { den, hod } = casVBratislave(new Date());
    const dnes = HODINY[den];
    let dalsi = null;
    for (let i = 1; i <= 7 && !dalsi; i++) { const d = (den + i) % 7; if (HODINY[d]) dalsi = { d, od: HODINY[d][0], o: i }; }
    let otvorene = false;
    let cip;
    let veta;
    if (dnes && hod >= dnes[0] && hod < dnes[1]) {
      otvorene = true;
      cip = `Teraz otvorené, do ${dnes[1]}:00`;
      veta = `Teraz otvorené, dnes do ${dnes[1]}:00.`;
    } else if (dnes && hod < dnes[0]) {
      cip = `Dnes otvárame o${NB}${dnes[0]}:00`;
      veta = `Teraz zatvorené, dnes otvárame o${NB}${dnes[0]}:00.`;
    } else {
      const kedy = dalsi ? (dalsi.o === 1 ? 'zajtra' : KEDY[dalsi.d].replace(' ', NB)) : '';
      cip = `Otvárame ${kedy} o${NB}${dalsi ? dalsi.od : 7}:00`;
      veta = `Teraz zatvorené, otvárame ${kedy} o${NB}${dalsi ? dalsi.od : 7}:00.`;
    }
    document.querySelectorAll('[data-stav-bodka]').forEach((b) => b.classList.toggle('zatvorene', !otvorene));
    const v = document.querySelector('[data-stav-veta]');
    if (v) v.textContent = veta;
    document.querySelectorAll('[data-den]').forEach((r) => {
      r.classList.toggle('dnes', r.getAttribute('data-den').split(' ').includes(String(den)));
    });
    // štítok na fotke: pridá sa navrch (absolútne umiestnený), nič neposunie
    const stitok = document.querySelector('[data-stav-cip]');
    const text = document.querySelector('[data-stav-cip-text]');
    if (stitok && text) {
      text.textContent = cip;
      stitok.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => stitok.classList.add('je')));
    }
  };
  stav();

  /* 6. Lepiaca lišta (mobil a tablet): po prejdení úvodných tlačidiel, skrytá pri kontakte a päte */
  const lista = document.querySelector('[data-lista]');
  const akcie = document.querySelector('.uvod-akcie');
  if (lista && akcie && maIO) {
    const s = { zaUvodom: false, koniec: new Set() };
    const obnov = () => lista.classList.toggle('vidno', s.zaUvodom && s.koniec.size === 0);
    new IntersectionObserver(([z]) => { s.zaUvodom = !z.isIntersecting && z.boundingClientRect.top < 0; obnov(); }).observe(akcie);
    const io = new IntersectionObserver((zaznamy) => {
      zaznamy.forEach((z) => { if (z.isIntersecting) s.koniec.add(z.target); else s.koniec.delete(z.target); });
      obnov();
    });
    const kontakt = document.getElementById('kontakt');
    if (kontakt) io.observe(kontakt);
    const pata = document.querySelector('.pata');
    if (pata) io.observe(pata);
  }
})();
