/* Kontrola XML priamo na stranke pravidla e-faktury (27. 9. 2026).
 *
 * Preco: stranky pravidiel (/efaktura/pravidla/<kod>/, /efaktura/cs/pravidla/<kod>/,
 * /efaktura/de/regeln/<kod>/, /efaktura/en/rules/<kod>/) su najvacsi vstup na e-fakturu,
 * ale nastroj za 7 dni pouzil 1 zo 47 ludi (Umami, 27. 9. 2026). Clovek prisiel s konkretnym
 * kodom chyby; tu ho nechame vlozit XML hned na tej stranke, bez prechodu do nastroja.
 *
 * Co to robi: po vlozeni XML alebo vybere suboru pusti TU ISTU kontrolu ako nastroj
 * (skontroluj z pravidla.mjs, bez akejkolvek zmeny logiky) a povie, ci sa v subore vyskytuje
 * prave kod tejto stranky, plus vypise ostatne nalezy s odkazmi na ich stranky.
 *
 * Vsetko bezi v prehliadaci. Subor sa cita cez FileReader, nic sa neodosiela. Do Umami ide
 * len kod pravidla, stav vysledku, profil a jazyk, nikdy obsah faktury.
 *
 * Moduly kontroly (asi 320 kB bez kompresie) sa nacitaju az pri prvom pouziti (focus pola,
 * vyber suboru, klik), nie pri kazdom otvoreni stranky pravidla.
 *
 * Blok v HTML stavia ops/efaktura/postav-pravidla.mjs (funkcia blokXml); odtlacok tohto
 * suboru je v adrese skriptu na strankach (?v=), preto po zmene treba stranky prestavat:
 *   node ops/efaktura/postav-pravidla.mjs --zapis
 * Testy: node --test products/arling-sk/efaktura/pravidlo-xml.test.mjs
 *
 * Udalosti Umami: pravidlo_xml_vlozene (atribut na tlacidle, pravidlo=<kod>; tlacidlo je
 * vypnute, kym v poli nie je text, takze prazdny klik sa nezapocita), pravidlo_xml_vysledok
 * (pravidlo, stav, profil, jazyk) a spolocne nastroj_pouzity (miesto=pravidlo), ktore
 * pocita ops/metrics/dnes.mjs ako pouzitie nastroja.
 */

const JAZYKY = ['sk', 'cs', 'de', 'en'];
const MAX_MB = 12; // rovnaky strop ako app.js

/** Adresar stranok pravidiel podla jazyka (rovnake adresy ako L.kodUrl v generatore). */
export const URL_PRAVIDIEL = {
  sk: '/efaktura/pravidla/',
  cs: '/efaktura/cs/pravidla/',
  de: '/efaktura/de/regeln/',
  en: '/efaktura/en/rules/'
};

const tvar3 = (n, jeden, malo, vela) => (n === 1 ? jeden : n >= 2 && n <= 4 ? malo : vela);
const tvar2 = (n, jeden, viac) => (n === 1 ? jeden : viac);
const spoj = (casti) => casti.filter(Boolean).join(', ');

/* Texty, ktore vznikaju az po kontrole. Staticky text bloku (nadpis, veta, tlacidla)
 * je v generatore stranok (L.xml* v ops/efaktura/postav-pravidla.mjs). */
export const TEXTY = {
  sk: {
    zavaznost: { chyba: 'Chyba', varovanie: 'Varovanie', informacia: 'Informácia' },
    xpath: 'Cesta k prvku',
    hodnota: 'Hodnota v súbore',
    kontrolujem: 'Kontrolujem…',
    citam: 'Čítam súbor…',
    prazdny: 'Súbor je prázdny.',
    prilisVelky: (mb) => 'Súbor má viac ako ' + mb + ' MB. Taká e-faktúra sa v praxi nevyskytuje; ak ju naozaj máte, napíšte na podpora@arling.sk.',
    nacitane: (meno, kb) => 'Načítané: ' + meno + ' (' + kb + ' kB).',
    chybaSuboru: 'Súbor sa nepodarilo prečítať. Vyberte ho znova alebo vložte XML do poľa.',
    chybaNacitania: 'Kontrolu sa nepodarilo načítať. Skontrolujte pripojenie a skúste to znova.',
    ano: (kod, n) => 'Áno: kontrola našla vo vašom XML ' + kod + (n > 1 ? ' na ' + n + ' miestach' : '') + '.',
    nie: (kod) => 'Nie: podľa našej kontroly sa ' + kod + ' vo vašom XML nevyskytuje.',
    profil: (kod, treba, ma) => kod + ' sme nevyhodnotili: kontrolujeme ho len v súboroch s profilom ' + treba
      + ' a váš súbor má profil ' + ma + '. Profil určuje hodnota cbc:CustomizationID (BT-24).',
    neplatne: (kod) => kod + ' sme nevyhodnotili: súbor nie je e-faktúra UBL 2.1, na ktorej by sa pravidlá dali spustiť. Dôvod je nižšie.',
    neiste: (kod) => 'Súbor má príliš veľa nálezov a kontrola vypíše len časť z nich. ' + kod
      + ' medzi nimi nie je, ale kým neopravíte ostatné, nevieme to potvrdiť.',
    ostatne: 'Ostatné nálezy v súbore',
    pocty: (c, v, i) => spoj([
      c ? c + ' ' + tvar3(c, 'chyba', 'chyby', 'chýb') : '',
      v ? v + ' ' + tvar3(v, 'varovanie', 'varovania', 'varovaní') : '',
      i ? i + ' ' + tvar3(i, 'informácia', 'informácie', 'informácií') : ''
    ]),
    ziadneOstatne: 'Iné nálezy kontrola v súbore nenašla.'
  },
  cs: {
    zavaznost: { chyba: 'Chyba', varovanie: 'Varování', informacia: 'Informace' },
    xpath: 'Cesta k prvku',
    hodnota: 'Hodnota v souboru',
    kontrolujem: 'Kontroluji…',
    citam: 'Čtu soubor…',
    prazdny: 'Soubor je prázdný.',
    prilisVelky: (mb) => 'Soubor má víc než ' + mb + ' MB. Taková e-faktura se v praxi nevyskytuje; pokud ji opravdu máte, napište na podpora@arling.sk.',
    nacitane: (meno, kb) => 'Načteno: ' + meno + ' (' + kb + ' kB).',
    chybaSuboru: 'Soubor se nepodařilo přečíst. Vyberte jej znovu nebo vložte XML do pole.',
    chybaNacitania: 'Kontrolu se nepodařilo načíst. Zkontrolujte připojení a zkuste to znovu.',
    ano: (kod, n) => 'Ano: kontrola našla ve vašem XML ' + kod + (n > 1 ? ' na ' + n + ' místech' : '') + '.',
    nie: (kod) => 'Ne: podle naší kontroly se ' + kod + ' ve vašem XML nevyskytuje.',
    profil: (kod, treba, ma) => kod + ' jsme nevyhodnotili: kontrolujeme jej jen v souborech s profilem ' + treba
      + ' a váš soubor má profil ' + ma + '. Profil určuje hodnota cbc:CustomizationID (BT-24).',
    neplatne: (kod) => kod + ' jsme nevyhodnotili: soubor není e-faktura UBL 2.1, na které by se pravidla dala spustit. Důvod je níže.',
    neiste: (kod) => 'Soubor má příliš mnoho nálezů a kontrola vypíše jen část z nich. ' + kod
      + ' mezi nimi není, ale dokud neopravíte ostatní, nemůžeme to potvrdit.',
    ostatne: 'Ostatní nálezy v souboru',
    pocty: (c, v, i) => spoj([
      c ? c + ' ' + tvar3(c, 'chyba', 'chyby', 'chyb') : '',
      v ? v + ' varování' : '',
      i ? i + ' ' + tvar3(i, 'informace', 'informace', 'informací') : ''
    ]),
    ziadneOstatne: 'Jiné nálezy kontrola v souboru nenašla.'
  },
  de: {
    zavaznost: { chyba: 'Fehler', varovanie: 'Warnung', informacia: 'Hinweis' },
    xpath: 'Pfad zum Element',
    hodnota: 'Wert in der Datei',
    kontrolujem: 'Wird geprüft…',
    citam: 'Datei wird gelesen…',
    prazdny: 'Die Datei ist leer.',
    prilisVelky: (mb) => 'Die Datei ist größer als ' + mb + ' MB. So große E-Rechnungen kommen in der Praxis nicht vor; falls doch, schreiben Sie an support@arling.sk.',
    nacitane: (meno, kb) => 'Geladen: ' + meno + ' (' + kb + ' kB).',
    chybaSuboru: 'Die Datei ließ sich nicht lesen. Wählen Sie sie erneut aus oder fügen Sie das XML in das Feld ein.',
    chybaNacitania: 'Die Prüfung ließ sich nicht laden. Prüfen Sie die Verbindung und versuchen Sie es erneut.',
    ano: (kod, n) => 'Ja: Die Prüfung hat ' + kod + (n > 1 ? ' an ' + n + ' Stellen' : '') + ' in Ihrem XML gefunden.',
    nie: (kod) => 'Nein: Nach unserer Prüfung kommt ' + kod + ' in Ihrem XML nicht vor.',
    profil: (kod, treba, ma) => kod + ' wurde nicht geprüft: Wir wenden die Regel nur auf Dateien mit dem Profil ' + treba
      + ' an, Ihre Datei hat das Profil ' + ma + '. Das Profil ergibt sich aus dem Wert von cbc:CustomizationID (BT-24).',
    neplatne: (kod) => kod + ' wurde nicht geprüft: Die Datei ist keine UBL-2.1-E-Rechnung, auf die sich die Regeln anwenden lassen. Den Grund sehen Sie unten.',
    neiste: (kod) => 'Die Datei hat zu viele Befunde, die Prüfung listet nur einen Teil davon auf. ' + kod
      + ' ist nicht darunter, sicher sagen lässt sich das aber erst, wenn die übrigen behoben sind.',
    ostatne: 'Weitere Befunde in der Datei',
    pocty: (c, v, i) => spoj([
      c ? c + ' Fehler' : '',
      v ? v + ' ' + tvar2(v, 'Warnung', 'Warnungen') : '',
      i ? i + ' ' + tvar2(i, 'Hinweis', 'Hinweise') : ''
    ]),
    ziadneOstatne: 'Weitere Befunde hat die Prüfung in der Datei nicht gefunden.'
  },
  en: {
    zavaznost: { chyba: 'Error', varovanie: 'Warning', informacia: 'Note' },
    xpath: 'Path to the element',
    hodnota: 'Value in the file',
    kontrolujem: 'Checking…',
    citam: 'Reading the file…',
    prazdny: 'The file is empty.',
    prilisVelky: (mb) => 'The file is larger than ' + mb + ' MB. E-invoices that big do not occur in practice; if you really have one, write to support@arling.sk.',
    nacitane: (meno, kb) => 'Loaded: ' + meno + ' (' + kb + ' kB).',
    chybaSuboru: 'The file could not be read. Choose it again or paste the XML into the field.',
    chybaNacitania: 'The checker could not be loaded. Check your connection and try again.',
    ano: (kod, n) => 'Yes: the check found ' + kod + ' in your XML' + (n > 1 ? ', in ' + n + ' places' : '') + '.',
    nie: (kod) => 'No: by our check, ' + kod + ' does not occur in your XML.',
    profil: (kod, treba, ma) => 'We did not evaluate ' + kod + ': we run it only on files with the ' + treba
      + ' profile, and your file has the ' + ma + ' profile. The profile comes from the value of cbc:CustomizationID (BT-24).',
    neplatne: (kod) => 'We did not evaluate ' + kod + ': the file is not a UBL 2.1 e-invoice the rules can run on. The reason is below.',
    neiste: (kod) => 'The file has too many findings and the check lists only some of them. ' + kod
      + ' is not among them, but we cannot confirm it until the others are fixed.',
    ostatne: 'Other findings in the file',
    pocty: (c, v, i) => spoj([
      c ? c + ' ' + tvar2(c, 'error', 'errors') : '',
      v ? v + ' ' + tvar2(v, 'warning', 'warnings') : '',
      i ? i + ' ' + tvar2(i, 'note', 'notes') : ''
    ]),
    ziadneOstatne: 'The check found nothing else in the file.'
  }
};

/* ── Logika bez DOM (testuje sa v Node) ─────────────────────────────────── */

/**
 * V akom profile kontrola pravidlo vobec spusta. Zrkadli pravidla.mjs:
 *  - PEPPOL-* bezia len pri profile peppol (pravidlaPeppol),
 *  - BR-DE-*, BR-DE-TMP-*, BR-TMP-* len pri xrechnung (pravidlaXrechnung),
 *  - BR-DEX-* len pri rozsireni XRechnung, teda ked sa cbc:CustomizationID PRESNE rovna
 *    K.PROFILY.xrechnungRozsirenie (pravidla-xrechnung.mjs),
 *  - ARL-MENA len pri profile en16931 (kontrolyNavyse v pravidla.mjs),
 *  - ostatne (jadro EN 16931 vratane BR-DEC-*, vlastne ARL-*) vo vsetkych profiloch.
 * Pozor: BR-DEC (desatinne miesta) je jadro EN 16931, nie XRechnung.
 * @returns {''|'peppol'|'xrechnung'|'xrechnung-rozsirenie'|'en16931'}
 */
export function potrebnyProfil(kod) {
  if (/^BR-DEX-/.test(kod)) return 'xrechnung-rozsirenie';
  if (/^PEPPOL-/.test(kod)) return 'peppol';
  if (/^BR-DE-/.test(kod) || /^BR-TMP-/.test(kod)) return 'xrechnung';
  if (kod === 'ARL-MENA') return 'en16931';
  return '';
}

/* Kody, ktore kontrola vyhodnocuje este pred rozlisenim dokladu (pravidla.mjs, skontroluj):
 * XML-01 vzdy, CII-01 ked je XML citatelne, XML-02 ked je citatelne a nie je to CII.
 * Pri kazdom inom kode musi byt doklad UBL Invoice alebo CreditNote, inak pravidla nebezali. */
const NEBEZI_PRI = { 'XML-01': [], 'CII-01': ['chybaXml'], 'XML-02': ['chybaXml', 'CII'] };

/**
 * Vyhodnoti vysledok kontroly pre jeden kod pravidla.
 * @param {{typ:string, profil:string, nalezy:Array, sumar:{orezane:boolean}}} v vystup skontroluj()
 * @param {string} kod kod pravidla stranky, napriklad BR-01
 * @param {{rozsirenie?:boolean}} [volby] rozsirenie: cbc:CustomizationID je rozsirenie XRechnung
 * @returns {{stav:'ano'|'nie'|'profil'|'neplatne'|'neiste', tieto:Array, ostatne:Array, potrebny:string}}
 *   ano = kod je v subore; nie = pravidlo bezalo a kod v subore nie je; profil = pravidlo
 *   sa pri profile suboru nespusta; neplatne = subor nie je UBL doklad, pravidla nebezali;
 *   neiste = nalezov bolo viac, nez kontrola vypise, a kod medzi vypisanymi nie je.
 */
export function vyhodnot(v, kod, volby = {}) {
  const tieto = v.nalezy.filter((n) => n.kod === kod);
  const ostatne = v.nalezy.filter((n) => n.kod !== kod);
  const potrebny = potrebnyProfil(kod);
  let stav;
  const nebezalo = Object.prototype.hasOwnProperty.call(NEBEZI_PRI, kod)
    ? NEBEZI_PRI[kod].indexOf(v.typ) !== -1
    : v.typ !== 'Invoice' && v.typ !== 'CreditNote';
  const inyProfil = potrebny === 'xrechnung-rozsirenie'
    ? !(v.profil === 'xrechnung' && volby.rozsirenie === true)
    : potrebny !== '' && v.profil !== potrebny;
  if (tieto.length) stav = 'ano';
  else if (nebezalo) stav = 'neplatne';
  else if (inyProfil) stav = 'profil';
  else if (v.sumar && v.sumar.orezane) stav = 'neiste';
  else stav = 'nie';
  return { stav, tieto, ostatne, potrebny };
}

/** Veta s vysledkom pre kod stranky v jazyku stranky. */
export function verdikt(h, kod, jazyk, profilSuboru, profilTreba) {
  const T = TEXTY[jazyk] || TEXTY.sk;
  if (h.stav === 'ano') return T.ano(kod, h.tieto.length);
  if (h.stav === 'nie') return T.nie(kod);
  if (h.stav === 'profil') return T.profil(kod, profilTreba, profilSuboru);
  if (h.stav === 'neplatne') return T.neplatne(kod);
  return T.neiste(kod);
}

/** Trieda vety s vysledkom: je-ano (kod v subore je), je-nie (nie je), je-inak (nevyhodnotene). */
export function triedaVerdiktu(stav) {
  return stav === 'ano' ? 'je-ano' : stav === 'nie' ? 'je-nie' : 'je-inak';
}

/* ── Vykreslenie (len document.createElement, appendChild a textContent) ───── */

function el(doc, tag, trieda, text) {
  const e = doc.createElement(tag);
  if (trieda) e.className = trieda;
  if (text !== undefined && text !== null) e.textContent = String(text);
  return e;
}

function riadokNalezu(doc, n, jazyk, tento, implementovane) {
  const T = TEXTY[jazyk] || TEXTY.sk;
  const li = el(doc, 'li', 'je-' + n.zavaznost + (tento ? ' tento' : ''));
  const hlava = el(doc, 'p', 'hlava');
  hlava.appendChild(el(doc, 'span', 'znacka', T.zavaznost[n.zavaznost] || n.zavaznost));
  const kod = el(doc, 'code', null, n.kod);
  // Ostatne kody vedu na svoju stranku v tom istom jazyku, ale len tie, ktore stranku maju.
  if (!tento && implementovane && implementovane.indexOf(n.kod) !== -1) {
    const a = el(doc, 'a');
    a.href = URL_PRAVIDIEL[jazyk] + n.kod.toLowerCase() + '/';
    a.appendChild(kod);
    hlava.appendChild(a);
  } else {
    hlava.appendChild(kod);
  }
  li.appendChild(hlava);
  li.appendChild(el(doc, 'p', 'veta', (n.sprava && (n.sprava[jazyk] || n.sprava.sk)) || ''));
  if (n.hodnota) {
    const p = el(doc, 'p', 'meta');
    p.appendChild(el(doc, 'span', null, T.hodnota + ': '));
    p.appendChild(el(doc, 'code', null, n.hodnota));
    li.appendChild(p);
  }
  if (n.xpath) {
    const p = el(doc, 'p', 'meta');
    p.appendChild(el(doc, 'span', null, T.xpath + ': '));
    p.appendChild(el(doc, 'code', null, n.xpath));
    li.appendChild(p);
  }
  return li;
}

/**
 * Zoznam nalezov pod vetou s vysledkom: najprv vyskyty kodu stranky (zvyraznene),
 * potom ostatne nalezy v rozbalovacom bloku. Blok je otvoreny, ked je ostatnych najviac
 * pat alebo ked sa pravidla nespustili (dovod je prave v tomto zozname).
 */
export function vykresliNalezy(doc, h, jazyk, implementovane, pozn) {
  const T = TEXTY[jazyk] || TEXTY.sk;
  const obal = el(doc, 'div', 'blok-xml-zoznam');
  if (pozn) obal.appendChild(el(doc, 'p', 'blok-xml-meta', pozn));
  if (h.tieto.length) {
    const ul = el(doc, 'ul', 'blok-xml-nalezy');
    for (const n of h.tieto) ul.appendChild(riadokNalezu(doc, n, jazyk, true, implementovane));
    obal.appendChild(ul);
  }
  if (!h.ostatne.length) {
    obal.appendChild(el(doc, 'p', 'blok-xml-meta', T.ziadneOstatne));
    return obal;
  }
  const pocet = (z) => h.ostatne.filter((n) => n.zavaznost === z).length;
  const d = el(doc, 'details', 'blok-xml-ostatne');
  d.open = h.ostatne.length <= 5 || h.stav === 'neplatne';
  d.appendChild(el(doc, 'summary', null, T.ostatne + ': ' + T.pocty(pocet('chyba'), pocet('varovanie'), pocet('informacia'))));
  const ul = el(doc, 'ul', 'blok-xml-nalezy');
  for (const n of h.ostatne) ul.appendChild(riadokNalezu(doc, n, jazyk, false, implementovane));
  d.appendChild(ul);
  obal.appendChild(d);
  return obal;
}

/* ── Nacitanie kontroly a zapojenie bloku ────────────────────────────────── */

let moduly = null;
/** Moduly kontroly az na prvu poziadavku; pri chybe siete sa pokus da zopakovat. */
export function nacitajModuly() {
  if (!moduly) {
    moduly = Promise.all([import('./pravidla.mjs'), import('./parser.mjs'), import('./kodovniky.mjs')])
      .then(([P, X, K]) => ({ P, X, K }));
    moduly.catch(() => { moduly = null; });
  }
  return moduly;
}

function track(okno, meno, data) {
  try { if (okno.umami && typeof okno.umami.track === 'function') okno.umami.track(meno, data); } catch (e) { /* nic */ }
}

function zapoj(doc, okno) {
  const blok = doc.querySelector('section.blok-xml[data-pravidlo]');
  if (!blok) return;
  const kod = blok.getAttribute('data-pravidlo');
  const lang = doc.documentElement.lang;
  const jazyk = JAZYKY.indexOf(lang) !== -1 ? lang : 'sk';
  const T = TEXTY[jazyk];
  const $ = (id) => doc.getElementById(id);
  const pole = $('blok-xml-text');
  const tlacidlo = $('blok-xml-spustit');
  const vybrat = $('blok-xml-vybrat');
  const subor = $('blok-xml-subor');
  const stav = $('blok-xml-stav');
  const ciel = $('blok-xml-vysledok');
  if (!pole || !tlacidlo || !stav || !ciel) return;

  let menoSuboru = '';
  let pracuje = false;
  const nastavStav = (text, trieda) => {
    stav.textContent = text;
    stav.className = 'blok-xml-stav' + (trieda ? ' ' + trieda : '');
  };
  // Tlacidlo je vypnute, kym v poli nie je text: prazdny klik by v Umami vyzeral ako pouzitie.
  const obnov = () => { tlacidlo.disabled = pracuje || !pole.value.trim(); };
  const vopred = () => { nacitajModuly().catch(() => { /* chybu ukaze az klik */ }); };

  pole.addEventListener('input', () => { menoSuboru = ''; obnov(); });
  pole.addEventListener('focus', vopred, { once: true });
  obnov();

  tlacidlo.addEventListener('click', async () => {
    const text = pole.value;
    if (!text.trim() || pracuje) return;
    pracuje = true;
    obnov();
    nastavStav(T.kontrolujem, '');
    let M;
    try {
      M = await nacitajModuly();
    } catch (e) {
      pracuje = false;
      obnov();
      nastavStav(T.chybaNacitania, 'je-inak');
      return;
    }
    const v = M.P.skontroluj(text);
    const potrebny = potrebnyProfil(kod);
    let rozsirenie = false;
    if (potrebny === 'xrechnung-rozsirenie') {
      const p = M.X.parsujXml(text);
      rozsirenie = !!(p.ok && M.X.hod(p.koren, 'cbc:CustomizationID') === M.K.PROFILY.xrechnungRozsirenie);
    }
    const h = vyhodnot(v, kod, { rozsirenie });
    const treba = potrebny === 'xrechnung-rozsirenie' ? 'XRechnung 3.x Extension'
      : potrebny ? M.P.nazovProfilu({ profil: potrebny }, jazyk) : '';
    nastavStav(verdikt(h, kod, jazyk, M.P.nazovProfilu(v, jazyk), treba), triedaVerdiktu(h.stav));
    const pozn = menoSuboru ? T.nacitane(menoSuboru, Math.max(1, Math.round(text.length / 1024))) : '';
    while (ciel.firstChild) ciel.removeChild(ciel.firstChild);
    ciel.appendChild(vykresliNalezy(doc, h, jazyk, M.P.IMPLEMENTOVANE, pozn));
    ciel.hidden = false;
    pracuje = false;
    obnov();
    track(okno, 'pravidlo_xml_vysledok', { pravidlo: kod, stav: h.stav, profil: v.profil, jazyk });
    track(okno, 'nastroj_pouzity', { produkt: 'efaktura', jazyk, miesto: 'pravidlo' });
  });

  function citajSubor(f) {
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) { nastavStav(T.prilisVelky(MAX_MB), 'je-inak'); return; }
    nastavStav(T.citam, '');
    vopred();
    const r = new okno.FileReader();
    r.onload = () => {
      pole.value = String(r.result || '');
      menoSuboru = f.name || '';
      obnov();
      if (!pole.value.trim()) { nastavStav(T.prazdny, 'je-inak'); return; }
      // Klik cez tlacidlo, nie priame volanie: tak sa zapocita aj udalost pravidlo_xml_vlozene.
      tlacidlo.click();
    };
    r.onerror = () => nastavStav(T.chybaSuboru, 'je-inak');
    r.readAsText(f, 'utf-8');
  }

  if (vybrat && subor) {
    vybrat.addEventListener('click', () => { vopred(); subor.click(); });
    subor.addEventListener('change', () => {
      const f = subor.files && subor.files[0];
      citajSubor(f);
      subor.value = '';
    });
  }

  // Pretiahnutie suboru na blok, rovnako ako v nastroji. Text pretiahnuty do pola nechavame prehliadacu.
  const jeSubor = (e) => !!(e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1);
  blok.addEventListener('dragover', (e) => { if (!jeSubor(e)) return; e.preventDefault(); blok.classList.add('nad'); });
  blok.addEventListener('dragleave', (e) => { if (!blok.contains(e.relatedTarget)) blok.classList.remove('nad'); });
  blok.addEventListener('drop', (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    blok.classList.remove('nad');
    if (!f) return;
    e.preventDefault();
    citajSubor(f);
  });
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') zapoj(document, window);
