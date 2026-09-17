/* Pristavna stranka Leitweg-ID (A-040): len to, co ma navyse oproti zakladnemu
 * nastroju. Kontrola, nahlad, formular, XML aj platba zostavaju v /efaktura/app.js
 * a nic z nich sa tu neopakuje. Tento subor je modul a v hlavicke stoji az za
 * app.js, takze bezi po tom, ako app.js postavi formular.
 *
 * Co robi:
 *   1. najde pole BT-10 (Leitweg-ID / Kauferreferenz) podla jeho popisu a
 *      presunie ho na zaciatok formulara do vlastnej skupiny. Nekopiruje sa,
 *      presuva sa ten isty prvok aj s obsluhou z app.js. Dovod: na sirke 390 px
 *      bolo pole 5 777 px od vrchu stranky, az za skupinami Verkaufer a Kaufer,
 *      hoci cela stranka je prave o nom;
 *   2. da mu kotvu #pole-leitweg, priklad tvaru do placeholder, kratku napovedu
 *      BT-10 a zaostri ho bez posunu stranky (preventScroll), aby navstevnik
 *      nepreskocil kroky a cenu nad formularom;
 *   3. obsluzi tri odkazy v ramci stranky (preskocenie na nastroj, tlacidlo nad
 *      zahybom a odkaz v kroku 2), lebo obycajny skok na kotvu tu nefunguje
 *      a jeden z nich dokonca schoval formular; viac nizsie pri prenes();
 *   4. posle do Umami tool_run s menovkou stranky, ked niekto nastroj naozaj
 *      pouzije (pisanie vo formulari, vyber suboru, ukazkovy subor, kontrola).
 *
 * Co tu zamerne nie je:
 *   - cena_videna. Posiela ju app.js (sledujCenuVidenu, app.js r. 1250) pri
 *     zobrazeni bloku #brana. Druha rovnomenna udalost by nafukla cislo "ponuka"
 *     v rannom briefe, ktory scita cena_videna za cestu /efaktura/de/*
 *     (ops/metrics/dnes.mjs r. 138). V Umami sa da rozlisit podla adresy stranky.
 *   - kupa_click. Je priamo na tlacidlach ako data-umami-event s menovkou
 *     data-umami-event-place, tak ako na ostatnych strankach webu.
 */
const MENOVKA = 'leitweg-id';
const POPIS_POLA = 'Leitweg-ID / Käuferreferenz';
const PRIKLAD = '04011000-12345-34';

const sleduj = (meno, data) => {
  try {
    if (window.umami && typeof window.umami.track === 'function') {
      window.umami.track(meno, Object.assign({ produkt: 'efaktura', jazyk: 'de', place: MENOVKA }, data || {}));
    }
  } catch (e) { /* bez merania stranka bezi dalej */ }
};

/* Polia formulara nemaju id, app.js ich stavia z popisu (polePodla v app.js).
 * Hladame teda podla textu popisu, ktory je pre nemcinu 'Leitweg-ID / Kauferreferenz'. */
function najdiPole() {
  for (const popiska of document.querySelectorAll('#formular label.pole')) {
    const span = popiska.querySelector('span');
    if (span && span.textContent.trim() === POPIS_POLA) return popiska;
  }
  return null;
}

let zaostrene = false;
function pripravPole() {
  const formular = document.getElementById('formular');
  const popiska = najdiPole();
  if (!formular || !popiska) return;
  const vstup = popiska.querySelector('input');
  if (!vstup) return;

  let skupina = document.getElementById('skupina-leitweg');
  // Uz je na svojom mieste: nic nemenime, inak by sa MutationObserver tocil dokola.
  if (skupina && popiska.parentElement === skupina && formular.firstElementChild === skupina) return;

  if (!skupina) {
    skupina = document.createElement('fieldset');
    skupina.id = 'skupina-leitweg';
    const legenda = document.createElement('legend');
    legenda.textContent = 'Leitweg-ID';
    skupina.appendChild(legenda);
  }
  popiska.id = 'pole-leitweg';
  vstup.placeholder = PRIKLAD;
  skupina.appendChild(popiska);
  // Napoveda ide dovnutra popisky, presne ako ju app.js pridava k poli endpoint.
  if (!popiska.querySelector('.pole-napoveda')) {
    const napoveda = document.createElement('small');
    napoveda.className = 'pole-napoveda';
    napoveda.textContent = 'BT-10, in UBL 2.1 cbc:BuyerReference. In der XRechnung Pflicht nach BR-DE-15.';
    popiska.appendChild(napoveda);
  }
  formular.insertBefore(skupina, formular.firstChild);

  if (!zaostrene) {
    zaostrene = true;
    // preventScroll: zaostrenie nesmie prehodit stranku dolu cez kroky a cenu
    try { vstup.focus({ preventScroll: true }); } catch (e) { /* stary prehliadac */ }
  }
}

pripravPole();

/* app.js stavia formular znova pri zmene krajiny, vybere z adresara alebo po
 * vymazani. Kotva a priklad sa pri tom stratia, preto ich vratime spat. */
const formular = document.getElementById('formular');
if (formular && 'MutationObserver' in window) {
  new MutationObserver(() => pripravPole()).observe(formular, { childList: true });
}

/* Odkazy v ramci stranky. Ani jeden z nich sam od seba nefunguje:
 *   - tlacidlo "Leitweg-ID eintragen" v hlavicke ma href="#vytvorit", co je meno
 *     zalozky, nie prvok na stranke. Prehliadac nema kam skocit a zalozka
 *     Erstellen uz otvorena je (body data-efaktura-start="vytvorit"), takze klik
 *     na hlavne tlacidlo nad zahybom nespravil nic. Overene v prehliadaci na
 *     390 px: scrollY 0 pred klikom aj po nom;
 *   - odkaz v kroku 2 (href="#pole-leitweg") a preskocenie na nastroj v hlavicke
 *     (a.skip, href="#nastroj") mieria na prvky, ktore na stranke su, lenze app.js
 *     pocuva hashchange a kazdy hash berie ako meno zalozky (app.js r. 1322);
 *     nezname meno spadne na "kontrola" (app.js r. 660), takze klik prepol nastroj
 *     na Prufung a cely formular aj s polom schoval. Overene v prehliadaci: po
 *     kliku na a.skip bola aktivna zalozka Prufung a panel-vytvorit hidden.
 *     Rovnaky problem a rovnake riesenie ako pri odkaze .zobrazit-nahlad
 *     v efaktura/nahlad.js r. 440.
 * Preto scrollujeme sami a hash nemenime. Href zostava kvoli zmyslu odkazu.
 * Stranka ma styri odkazy dovnutra: stvrty (.zobrazit-nahlad) si rovnakym sposobom
 * osetruje nahlad.js, tieto tri su tu. Na ostatnych strankach e-faktury sa zalozka
 * zacina na "kontrola", takze tam ten pad na "kontrola" nie je vidiet; tato
 * stranka sa zacina na "vytvorit" (body data-efaktura-start), preto to tu vadi. */
function prenes(ciel, zaostri) {
  if (!ciel) return;
  const zalozka = document.querySelector('.zalozka[data-tab="vytvorit"]');
  // Keby si navstevnik medzitym otvoril Prufung: klikneme na zalozku tak ako clovek,
  // obsluhu ma app.js a ziadna logika sa tu neopakuje.
  if (zalozka && !zalozka.classList.contains('aktivna')) zalozka.click();
  // "instant", nie "smooth": html ma globalne scroll-behavior:smooth a formular
  // je na 390 px vysoky niekolko tisic px, take skrolovanie by trvalo sekundy.
  try { ciel.scrollIntoView({ behavior: 'instant', block: 'start' }); } catch (e) { ciel.scrollIntoView(); }
  // Klavesnica: skok na kotvu normalne posunie aj miesto, odkial pokracuje Tab.
  // Ked skok zastavime, musime focus presunut sami, inak by clovek po Tabe
  // pokracoval zase od hlavicky. Pri poli zaostrime priamo vstup.
  const vstup = zaostri ? ciel.querySelector('input') : null;
  const naZaostrenie = vstup || ciel;
  if (!vstup) naZaostrenie.tabIndex = -1;
  try { naZaostrenie.focus({ preventScroll: true }); } catch (e) { naZaostrenie.focus(); }
}

// Kam ktory odkaz nesie. Tlacidlo v hlavicke na cenu a kroky, aby navstevnik videl,
// za co plati, a az potom na pole; odkaz v kroku 2 priamo na pole; preskocenie
// v hlavicke na cely nastroj, ako to robi na kazdej stranke.
const CIELE = {
  '#vytvorit': () => document.querySelector('.leitweg-start'),
  '#pole-leitweg': () => document.getElementById('pole-leitweg'),
  '#nastroj': () => document.getElementById('nastroj'),
};

document.addEventListener('click', (e) => {
  const odkaz = e.target && e.target.closest && e.target.closest('a[href^="#"]');
  if (!odkaz) return;
  const href = odkaz.getAttribute('href');
  if (!Object.prototype.hasOwnProperty.call(CIELE, href)) return;
  const ciel = CIELE[href]();
  if (!ciel) return;
  e.preventDefault();
  prenes(ciel, href === '#pole-leitweg');
});

/* tool_run: prve skutocne pouzitie nastroja na tejto stranke. */
let poslane = false;
function pouzitie() {
  if (poslane) return;
  poslane = true;
  sleduj('tool_run', { nastroj: 'efaktura' });
}
const nastroj = document.getElementById('nastroj');
if (nastroj) {
  nastroj.addEventListener('input', pouzitie, true);
  nastroj.addEventListener('change', pouzitie, true);
}
for (const id of ['vzor', 'spustit', 'vybrat', 'dropzone']) {
  const prvok = document.getElementById(id);
  if (prvok) prvok.addEventListener('click', pouzitie);
}
