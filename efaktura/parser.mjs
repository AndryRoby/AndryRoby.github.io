// parser.mjs - spolocny citac XML pre e-fakturu.
// V prehliadaci aj v Node bezi ten isty vlastny parser, aby validator hlasil vsade to iste.
// V prehliadaci navyse spustime DOMParser ako druhy nazor na dobre tvarovane XML.
// Ziadne zavislosti, ziadne siete, subor sa nikam neposiela.

import { MP } from './kodovniky.mjs';

// menny priestor -> nasa kanonicka predpona
const KANON = new Map([
  [MP.faktura, 'ubl'],
  [MP.dobropis, 'cn'],
  [MP.cbc, 'cbc'],
  [MP.cac, 'cac'],
  [MP.ext, 'ext'],
  [MP.cii, 'rsm'],
  ['urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100', 'ram'],
  ['urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100', 'udt'],
  ['urn:un:unece:uncefact:data:standard:QualifiedDataType:100', 'qdt']
]);

const ENTITY = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function chyba(sk, cs, de, en, riadok) {
  return { sk, cs, de, en, riadok };
}

// Rozbali entity. Nezname entity su chyba (nepodporujeme DTD).
function rozbal(s, riadok, stav) {
  if (s.indexOf('&') === -1) return s;
  let out = '';
  let i = 0;
  while (i < s.length) {
    const z = s[i];
    if (z !== '&') { out += z; i += 1; continue; }
    const kon = s.indexOf(';', i);
    if (kon === -1 || kon - i > 12) {
      stav.chyba = chyba(
        'Znak & musi byt zapisany ako &amp;. Na riadku ' + riadok + ' je samostatny znak &.',
        'Znak & musi byt zapsan jako &amp;. Na radku ' + riadok + ' je samostatny znak &.',
        'Das Zeichen & muss als &amp; geschrieben werden. In Zeile ' + riadok + ' steht ein einzelnes &.',
        'The character & has to be written as &amp;. Line ' + riadok + ' contains a bare &.',
        riadok
      );
      return out;
    }
    const meno = s.slice(i + 1, kon);
    if (meno[0] === '#') {
      const cislo = meno[1] === 'x' || meno[1] === 'X'
        ? parseInt(meno.slice(2), 16)
        : parseInt(meno.slice(1), 10);
      if (!Number.isFinite(cislo)) {
        stav.chyba = chyba(
          'Neplatna znakova referencia &' + meno + '; na riadku ' + riadok + '.',
          'Neplatna znakova reference &' + meno + '; na radku ' + riadok + '.',
          'Ungueltige Zeichenreferenz &' + meno + '; in Zeile ' + riadok + '.',
          'Invalid character reference &' + meno + '; on line ' + riadok + '.',
          riadok
        );
        return out;
      }
      out += String.fromCodePoint(cislo);
    } else if (Object.prototype.hasOwnProperty.call(ENTITY, meno)) {
      out += ENTITY[meno];
    } else {
      stav.chyba = chyba(
        'Neznama entita &' + meno + '; na riadku ' + riadok + '. Povolene su len &lt; &gt; &amp; &quot; &apos;.',
        'Neznama entita &' + meno + '; na radku ' + riadok + '. Povolene jsou jen &lt; &gt; &amp; &quot; &apos;.',
        'Unbekannte Entitaet &' + meno + '; in Zeile ' + riadok + '. Erlaubt sind nur &lt; &gt; &amp; &quot; &apos;.',
        'Unknown entity &' + meno + '; on line ' + riadok + '. Only &lt; &gt; &amp; &quot; &apos; are allowed.',
        riadok
      );
      return out;
    }
    i = kon + 1;
  }
  return out;
}

function novyUzol(meno, ns, predpona, riadok) {
  const local = meno.indexOf(':') >= 0 ? meno.slice(meno.indexOf(':') + 1) : meno;
  const kan = KANON.get(ns) || predpona || '';
  return {
    meno,                      // presne tak, ako je v subore (napr. cbc:ID)
    local,                     // lokalny nazov (ID)
    ns,                        // menny priestor
    k: kan ? kan + ':' + local : local, // kanonicky kluc (cbc:ID) - podla nsna, nie podla predpony v subore
    atr: Object.create(null),
    deti: [],
    rodic: null,
    _text: '',
    riadok
  };
}

/**
 * Rozparsuje XML retazec.
 * @returns {{ok:true, koren:object}|{ok:false, chyba:{sk:string,cs:string,de:string,en:string,riadok:number}}}
 */
export function parsujXml(vstup) {
  const stav = { chyba: null };
  if (typeof vstup !== 'string' || vstup.trim() === '') {
    return {
      ok: false,
      chyba: chyba(
        'Subor je prazdny. Vlozte XML e-faktury (UBL 2.1 Invoice alebo CreditNote).',
        'Soubor je prazdny. Vlozte XML e-faktury (UBL 2.1 Invoice nebo CreditNote).',
        'Die Datei ist leer. Fuegen Sie die XML-E-Rechnung ein (UBL 2.1 Invoice oder CreditNote).',
        'The file is empty. Paste the e-invoice XML (UBL 2.1 Invoice or CreditNote).',
        1
      )
    };
  }
  let s = vstup;
  // BOM
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);

  let i = 0;
  let riadok = 1;
  const zasobnik = [];
  let koren = null;
  const rozsahy = [Object.create(null)]; // menne priestory podla urovne

  const posun = (do_) => {
    for (let j = i; j < do_; j += 1) if (s.charCodeAt(j) === 10) riadok += 1;
    i = do_;
  };

  const zle = (sk, cs, de, en) => {
    stav.chyba = chyba(sk, cs, de, en, riadok);
    return { ok: false, chyba: stav.chyba };
  };

  while (i < s.length) {
    const otvor = s.indexOf('<', i);
    if (otvor === -1) {
      const zvysok = s.slice(i);
      if (zvysok.trim() !== '' && zasobnik.length === 0) {
        return zle(
          'Za koncom dokumentu je text, ktory tam nepatri. Subor nie je platne XML.',
          'Za koncem dokumentu je text, ktery tam nepatri. Soubor neni platne XML.',
          'Nach dem Dokumentende steht Text, der dort nicht hingehoert. Die Datei ist kein gueltiges XML.',
          'There is text after the end of the document. The file is not valid XML.'
        );
      }
      if (zasobnik.length > 0) {
        const chyb = zasobnik[zasobnik.length - 1];
        return zle(
          'Znacka <' + chyb.meno + '> nie je uzavreta. Chyba </' + chyb.meno + '>.',
          'Znacka <' + chyb.meno + '> neni uzavrena. Chybi </' + chyb.meno + '>.',
          'Das Element <' + chyb.meno + '> ist nicht geschlossen. Es fehlt </' + chyb.meno + '>.',
          'The element <' + chyb.meno + '> is never closed. </' + chyb.meno + '> is missing.'
        );
      }
      break;
    }
    // text pred znackou
    if (otvor > i) {
      const kus = s.slice(i, otvor);
      if (zasobnik.length > 0) {
        zasobnik[zasobnik.length - 1]._text += rozbal(kus, riadok, stav);
        if (stav.chyba) return { ok: false, chyba: stav.chyba };
      } else if (kus.trim() !== '') {
        posun(otvor);
        return zle(
          'Mimo hlavneho prvku je text, ktory tam nepatri. Subor nie je platne XML.',
          'Mimo hlavniho prvku je text, ktery tam nepatri. Soubor neni platne XML.',
          'Ausserhalb des Wurzelelements steht Text. Die Datei ist kein gueltiges XML.',
          'There is text outside the root element. The file is not valid XML.'
        );
      }
      posun(otvor);
    }

    // komentar
    if (s.startsWith('<!--', i)) {
      const kon = s.indexOf('-->', i + 4);
      if (kon === -1) {
        return zle(
          'Komentar nie je uzavreny (chyba -->).',
          'Komentar neni uzavren (chybi -->).',
          'Ein Kommentar ist nicht geschlossen (es fehlt -->).',
          'A comment is not closed (--> is missing).'
        );
      }
      posun(kon + 3);
      continue;
    }
    // CDATA
    if (s.startsWith('<![CDATA[', i)) {
      const kon = s.indexOf(']]>', i + 9);
      if (kon === -1) {
        return zle(
          'Sekcia CDATA nie je uzavreta (chyba ]]>).',
          'Sekce CDATA neni uzavrena (chybi ]]>).',
          'Ein CDATA-Abschnitt ist nicht geschlossen (es fehlt ]]>).',
          'A CDATA section is not closed (]]> is missing).'
        );
      }
      if (zasobnik.length > 0) zasobnik[zasobnik.length - 1]._text += s.slice(i + 9, kon);
      posun(kon + 3);
      continue;
    }
    // deklaracia alebo instrukcia spracovania
    if (s.startsWith('<?', i)) {
      const kon = s.indexOf('?>', i + 2);
      if (kon === -1) {
        return zle(
          'XML deklaracia nie je uzavreta (chyba ?>).',
          'XML deklarace neni uzavrena (chybi ?>).',
          'Die XML-Deklaration ist nicht geschlossen (es fehlt ?>).',
          'The XML declaration is not closed (?> is missing).'
        );
      }
      posun(kon + 2);
      continue;
    }
    // DOCTYPE zamietame (vlastne entity su bezpecnostne riziko)
    if (s.startsWith('<!DOCTYPE', i) || s.startsWith('<!doctype', i)) {
      return zle(
        'Subor obsahuje DOCTYPE s vlastnymi definiciami. Taky subor nespracuvavame. Odosielajte cistu e-fakturu bez DTD.',
        'Soubor obsahuje DOCTYPE s vlastnimi definicemi. Takovy soubor nezpracovavame. Posilejte cistou e-fakturu bez DTD.',
        'Die Datei enthaelt eine DOCTYPE-Deklaration. Solche Dateien verarbeiten wir nicht. Senden Sie eine reine E-Rechnung ohne DTD.',
        'The file contains a DOCTYPE with its own definitions. We do not process such files. Send a plain e-invoice without a DTD.'
      );
    }
    // koncova znacka
    if (s.startsWith('</', i)) {
      const kon = s.indexOf('>', i);
      if (kon === -1) {
        return zle(
          'Koncova znacka nie je uzavreta (chyba >).',
          'Koncova znacka neni uzavrena (chybi >).',
          'Ein schliessendes Tag ist nicht geschlossen (es fehlt >).',
          'A closing tag is not finished (> is missing).'
        );
      }
      const meno = s.slice(i + 2, kon).trim();
      const vrch = zasobnik[zasobnik.length - 1];
      if (!vrch) {
        return zle(
          'Koncova znacka </' + meno + '> nema svoju zaciatocnu znacku.',
          'Koncova znacka </' + meno + '> nema svou pocatecni znacku.',
          'Das schliessende Tag </' + meno + '> hat kein oeffnendes Tag.',
          'The closing tag </' + meno + '> has no opening tag.'
        );
      }
      if (vrch.meno !== meno) {
        return zle(
          'Znacky sa neprekryvaju: otvorena je <' + vrch.meno + '>, ale zatvara sa </' + meno + '>.',
          'Znacky se neprekryvaji: otevrena je <' + vrch.meno + '>, ale zavira se </' + meno + '>.',
          'Die Tags ueberlappen: geoeffnet ist <' + vrch.meno + '>, geschlossen wird </' + meno + '>.',
          'The tags overlap: <' + vrch.meno + '> is open, but </' + meno + '> is being closed.'
        );
      }
      zasobnik.pop();
      rozsahy.pop();
      posun(kon + 1);
      continue;
    }

    // zaciatocna znacka
    let j = i + 1;
    let vUvodzovkach = 0;
    while (j < s.length) {
      const z = s[j];
      if (z === '"' && vUvodzovkach === 0) vUvodzovkach = 1;
      else if (z === '"' && vUvodzovkach === 1) vUvodzovkach = 0;
      else if (z === "'" && vUvodzovkach === 0) vUvodzovkach = 2;
      else if (z === "'" && vUvodzovkach === 2) vUvodzovkach = 0;
      else if (z === '>' && vUvodzovkach === 0) break;
      j += 1;
    }
    if (j >= s.length) {
      return zle(
        'Zaciatocna znacka nie je uzavreta (chyba >).',
        'Pocatecni znacka neni uzavrena (chybi >).',
        'Ein oeffnendes Tag ist nicht geschlossen (es fehlt >).',
        'An opening tag is not finished (> is missing).'
      );
    }
    let vnutro = s.slice(i + 1, j);
    let samostatna = false;
    if (vnutro.endsWith('/')) { samostatna = true; vnutro = vnutro.slice(0, -1); }
    const mMeno = /^([A-Za-z_][\w.\-]*(?::[A-Za-z_][\w.\-]*)?)/.exec(vnutro);
    if (!mMeno) {
      return zle(
        'Neplatny nazov prvku na riadku ' + riadok + '.',
        'Neplatny nazev prvku na radku ' + riadok + '.',
        'Ungueltiger Elementname in Zeile ' + riadok + '.',
        'Invalid element name on line ' + riadok + '.'
      );
    }
    const meno = mMeno[1];
    const zvysok = vnutro.slice(meno.length);

    // atributy
    const atr = Object.create(null);
    const ra = /([A-Za-z_][\w.\-]*(?::[A-Za-z_][\w.\-]*)?)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let a;
    while ((a = ra.exec(zvysok))) {
      const hodnota = a[3] !== undefined ? a[3] : a[4];
      atr[a[1]] = rozbal(hodnota, riadok, stav);
      if (stav.chyba) return { ok: false, chyba: stav.chyba };
    }
    if (zvysok.trim() !== '' && !ra.lastIndex && !/^\s*$/.test(zvysok)) {
      // nic, tolerujeme; nepodarene atributy zachyti kontrola nizsie
    }

    // menne priestory
    const rozsah = Object.create(rozsahy[rozsahy.length - 1]);
    for (const kluc of Object.keys(atr)) {
      if (kluc === 'xmlns') rozsah[''] = atr[kluc];
      else if (kluc.startsWith('xmlns:')) rozsah[kluc.slice(6)] = atr[kluc];
    }
    const predpona = meno.indexOf(':') >= 0 ? meno.slice(0, meno.indexOf(':')) : '';
    const ns = rozsah[predpona] || (predpona === '' ? rozsah[''] || '' : '');

    const u = novyUzol(meno, ns || '', predpona, riadok);
    u.atr = atr;

    if (zasobnik.length === 0) {
      if (koren) {
        return zle(
          'Subor ma viac ako jeden hlavny prvok. Platne XML ma prave jeden.',
          'Soubor ma vice nez jeden hlavni prvek. Platne XML ma prave jeden.',
          'Die Datei hat mehr als ein Wurzelelement. Gueltiges XML hat genau eines.',
          'The file has more than one root element. Valid XML has exactly one.'
        );
      }
      koren = u;
    } else {
      u.rodic = zasobnik[zasobnik.length - 1];
      u.rodic.deti.push(u);
    }
    if (!samostatna) {
      zasobnik.push(u);
      rozsahy.push(rozsah);
    }
    posun(j + 1);
  }

  if (!koren) {
    return {
      ok: false,
      chyba: chyba(
        'Subor neobsahuje ziadny XML prvok. Nie je to XML.',
        'Soubor neobsahuje zadny XML prvek. Neni to XML.',
        'Die Datei enthaelt kein XML-Element. Es ist kein XML.',
        'The file contains no XML element at all. This is not XML.',
        1
      )
    };
  }
  return { ok: true, koren };
}

// V prehliadaci: druhy nazor na dobre tvarovane XML. V Node vrati null.
export function domDruhyNazor(text) {
  if (typeof DOMParser === 'undefined') return null;
  try {
    const d = new DOMParser().parseFromString(text, 'application/xml');
    const e = d.getElementsByTagName('parsererror')[0];
    return e ? String(e.textContent || '').trim().slice(0, 300) : null;
  } catch (x) {
    return String(x && x.message ? x.message : x).slice(0, 300);
  }
}

// ---- praca so stromom ----

/** Priame deti s danym kanonickym klucom. Viac klucov oddelte znakom |. */
export function deti(u, kluc) {
  if (!u) return [];
  const kluce = kluc.split('|');
  return u.deti.filter((d) => kluce.indexOf(d.k) >= 0);
}

/** Prve priame dieta s danym klucom, alebo null. */
export function prve(u, kluc) {
  const p = deti(u, kluc);
  return p.length ? p[0] : null;
}

/** Uzly na relativnej ceste "cac:X/cbc:Y" (kazdy krok moze mat varianty cez |). */
export function cesta(u, c) {
  let akt = u ? [u] : [];
  for (const krok of c.split('/')) {
    if (!krok) continue;
    const dalsie = [];
    for (const n of akt) for (const d of deti(n, krok)) dalsie.push(d);
    akt = dalsie;
    if (!akt.length) return [];
  }
  return akt;
}

/** Prvy uzol na ceste, alebo null. */
export function jeden(u, c) {
  const p = cesta(u, c);
  return p.length ? p[0] : null;
}

/** Text uzla (priame textove uzly), orezany a s jednou medzerou medzi slovami. */
export function txt(u) {
  if (!u) return '';
  return u._text.replace(/\s+/g, ' ').trim();
}

/** Surovy text uzla bez normalizacie medzier. */
export function txtSurovy(u) {
  return u ? u._text : '';
}

/** Text prveho uzla na ceste. */
export function hod(u, c) {
  return txt(jeden(u, c));
}

/** Hodnota atributu. */
export function atr(u, meno) {
  if (!u) return undefined;
  return u.atr[meno];
}

/** Vsetky potomkovia s danym klucom (aj hlbsie), vratane samotneho uzla. */
export function vsetky(u, kluc) {
  const kluce = kluc.split('|');
  const out = [];
  const chod = (n) => {
    if (kluce.indexOf(n.k) >= 0) out.push(n);
    for (const d of n.deti) chod(d);
  };
  if (u) chod(u);
  return out;
}

/** XPath cesta k uzlu, s poradim medzi rovnakymi surodencami. */
export function xpath(u) {
  const kusy = [];
  let n = u;
  while (n) {
    if (!n.rodic) { kusy.unshift('/' + n.meno); break; }
    const rovnaki = n.rodic.deti.filter((d) => d.meno === n.meno);
    const idx = rovnaki.indexOf(n) + 1;
    kusy.unshift('/' + n.meno + (rovnaki.length > 1 ? '[' + idx + ']' : ''));
    n = n.rodic;
  }
  return kusy.join('');
}

/** Existuje uzol s neprazdnym textom na ceste? */
export function maText(u, c) {
  return hod(u, c) !== '';
}
