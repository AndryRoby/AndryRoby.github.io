/* Texty kontroly v prehliadači v troch jazykoch stránky: nemčina
 * (/sanktionslisten/), slovenčina (/sankcny-zoznam/) a angličtina
 * (/sanctions-check/). Jazyk určuje <html lang>; v Node (testy) je
 * predvolená nemčina, aby platili pôvodné testy nemeckej stránky.
 * Stráži to ops/saas/sankcie/test/web.test.mjs. */
import { dovodDe } from './zhoda.js';

export const JAZYKY = ['de', 'sk', 'en'];
export const jazykStranky = (lang) => {
  const j = String(lang || '').slice(0, 2).toLowerCase();
  return JAZYKY.includes(j) ? j : 'de';
};

/* Ukážkový zoznam v jazyku stránky. Všetky ležia v /sanktionslisten/ vedľa
 * kontrola.js; načítajú sa relatívne k modulu, nie k stránke. */
export const VZOR = { de: 'beispiel.csv', sk: 'ukazka.csv', en: 'example.csv' };

const DEN = {
  de: { loc: 'de-DE', tz: 'Europe/Berlin', den: { day: '2-digit', month: '2-digit', year: 'numeric' }, cas: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }, za: ' Uhr' },
  sk: { loc: 'sk-SK', tz: 'Europe/Bratislava', den: { day: 'numeric', month: 'numeric', year: 'numeric' }, cas: { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }, za: '' },
  en: { loc: 'en-GB', tz: 'Europe/Brussels', den: { day: 'numeric', month: 'long', year: 'numeric' }, cas: { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }, za: '' },
};

export function cisloV(jazyk, n) {
  return new Intl.NumberFormat(DEN[jazykStranky(jazyk)].loc).format(n);
}

export function formatDatumV(jazyk, iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || '');
  const f = DEN[jazykStranky(jazyk)];
  return new Intl.DateTimeFormat(f.loc, { timeZone: f.tz, ...f.cas }).format(d) + f.za;
}

export function formatDenV(jazyk, iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || '');
  const f = DEN[jazykStranky(jazyk)];
  return new Intl.DateTimeFormat(f.loc, { timeZone: f.tz, ...f.den }).format(d);
}

const PRAVIDLA = {
  sk: { A: 'Meno sa zhoduje ako celok', B: 'Meno zo zoznamu EÚ je celé v názve partnera', C: 'Názov partnera je celý v mene zo zoznamu EÚ', poradie: ', iné poradie slov', uv: ['„', '“'] },
  en: { A: 'Name matches as a whole', B: 'Name from the EU list is fully contained in the partner name', C: 'Partner name is fully contained in the name from the EU list', poradie: ', different word order', uv: ['“', '”'] },
};

/* Krátky dôvod zhody v jazyku stránky. Nemčina ide cez dovodDe zo zhoda.js
 * (jeden zdroj pravdy pre nemecký protokol). */
export function dovodV(jazyk, z) {
  const j = jazykStranky(jazyk);
  if (j === 'de') return dovodDe(z);
  const p = PRAVIDLA[j];
  const [a, b] = p.uv;
  const casti = z.pary.map((x) => x.podobnost === 100
    ? a + x.partner + b + ' = ' + a + x.zoznam + b
    : a + x.partner + b + ' ≈ ' + a + x.zoznam + b + ' (' + x.podobnost + ' %)');
  return (p[z.pravidlo] || '') + (z.prehodene ? p.poradie : '') + ': ' + casti.join(', ');
}

/* Všetky vety, ktoré skript vkladá do stránky. Funkcie dostávajú už
 * naformátované čísla a dátumy a vracajú text; tie, ktoré končia na Html,
 * vracajú HTML s hodnotami, ktoré volajúci už escapoval. */
export const TEXTY = {
  de: {
    standHtml: (datum, spolu, osoby, org) => 'EU-Liste: Datei der Kommission vom <b>' + datum + '</b>, ' + spolu + ' Einträge (' + osoby + ' Personen, ' + org + ' Organisationen).',
    standChyba: 'Der Stand der EU-Liste konnte nicht geladen werden. Laden Sie die Seite neu; ohne Liste ist keine Prüfung möglich.',
    nacitavam: 'EU-Liste wird geladen (etwa 420 kB) und vorbereitet.',
    zoznam: 'Liste',
    nesedi: 'Listenstand passt nicht zusammen. Bitte Seite neu laden.',
    stlpec: 'Spalte',
    chybaXls: 'Alte .xls-Dateien können wir nicht lesen. Speichern Sie die Datei in Excel als .xlsx oder als „CSV UTF-8“ und laden Sie sie erneut.',
    chybaSubor: 'Die Datei konnte nicht gelesen werden. Unterstützt werden .xlsx und .csv. Speichern Sie die Tabelle notfalls als „CSV UTF-8“.',
    prazdny: 'Die Datei ist leer. Wählen Sie eine Tabelle mit Namen.',
    vzorHotovo: 'Fertig. Die Beispielliste ist erfunden, bis auf zwei Namen, die so oder ähnlich auf der EU-Liste stehen.',
    vzorChyba: 'Die Beispielliste konnte nicht geladen werden.',
    bezMien: 'In der gewählten Spalte stehen keine Namen. Wählen Sie im Ergebnis eine andere Spalte.',
    chybaZoznamu: (d) => 'Die EU-Liste konnte nicht geladen werden (' + d + '). Ihre Datei wurde nicht verschickt. Bitte später erneut versuchen.',
    chyba: 'Fehler',
    priebeh: (hotove, spolu) => hotove + ' von ' + spolu + ' Namen geprüft.',
    hotovo: (n) => 'Fertig. ' + n + ' Namen geprüft.',
    typP: 'Person', typE: 'Organisation',
    suhrnHtml: (pocet, nazov, partneri, jeden, prah, orezane) => '<b>' + pocet + '</b> Namen aus „' + nazov + '“ geprüft. '
      + (partneri ? '<b>' + partneri + '</b> ' + (jeden ? 'Name hat' : 'Namen haben') + ' einen Treffer ab Score ' + prah + ' zur Prüfung.' : 'Kein Treffer ab Score ' + prah + '.')
      + (orezane ? ' Geprüft wurden nur die ersten ' + orezane + ' Namen.' : ''),
    th: ['Zeile', 'Name in Ihrer Liste', 'Score', 'Eintrag in der EU-Liste', 'Grund'],
    program: 'Programm', akt: 'Rechtsakt',
    prazdne: (prah) => 'Kein Name aus Ihrer Liste erreicht Score ' + prah + '. Das heißt nicht, dass keiner Ihrer Partner betroffen ist: geprüft wurde nur die EU-Finanzsanktionsliste, und Schreibweisen, die zu stark abweichen, erkennt das Werkzeug nicht. Mit dem Regler können Sie die Schwelle bis 80 senken.',
    verziaHtml: (datum, spolu, sha, stiahnute, cas) => 'Geprüft gegen: EU-Finanzsanktionsliste, Datei der Europäischen Kommission vom ' + datum
      + ', ' + spolu + ' Einträge, SHA-256 <code>' + sha + '</code>'
      + (stiahnute ? ', von uns heruntergeladen am ' + stiahnute : '')
      + '. Prüfung am ' + cas + ' in diesem Browser.',
    csv: ['Zeile', 'Name in Ihrer Liste', 'Score', 'Name in der EU-Liste', 'EU-Referenz', 'Typ', 'Programm', 'Rechtsakt', 'Link zum Rechtsakt', 'Grund', 'Listendatei vom', 'SHA-256 der Listendatei', 'Prüfung am'],
    csvNic: 'Kein Treffer',
    subor: 'sanktionslisten-pruefung-',
  },
  sk: {
    standHtml: (datum, spolu, osoby, org) => 'Zoznam EÚ: súbor Európskej komisie z <b>' + datum + '</b>, ' + spolu + ' záznamov (' + osoby + ' osôb, ' + org + ' organizácií).',
    standChyba: 'Stav zoznamu EÚ sa nepodarilo načítať. Obnovte stránku; bez zoznamu sa kontrola nedá spraviť.',
    nacitavam: 'Načítava sa zoznam EÚ (asi 420 kB) a pripravuje sa na porovnanie.',
    zoznam: 'Zoznam',
    nesedi: 'Verzia zoznamu nesedí. Obnovte, prosím, stránku.',
    stlpec: 'Stĺpec',
    chybaXls: 'Staré súbory .xls nevieme prečítať. V Exceli uložte súbor ako .xlsx alebo ako „CSV UTF-8“ a nahrajte ho znova.',
    chybaSubor: 'Súbor sa nepodarilo prečítať. Podporujeme .xlsx a .csv. Ak treba, uložte tabuľku ako „CSV UTF-8“.',
    prazdny: 'Súbor je prázdny. Vyberte tabuľku s menami.',
    vzorHotovo: 'Hotovo. Ukážkový zoznam je vymyslený, okrem dvoch mien, ktoré sú takto alebo podobne na zozname EÚ.',
    vzorChyba: 'Ukážkový zoznam sa nepodarilo načítať.',
    bezMien: 'Vo vybranom stĺpci nie sú žiadne mená. Vo výsledku vyberte iný stĺpec.',
    chybaZoznamu: (d) => 'Zoznam EÚ sa nepodarilo načítať (' + d + '). Váš súbor sa nikam neodoslal. Skúste to, prosím, neskôr.',
    chyba: 'chyba',
    priebeh: (hotove, spolu) => 'Skontrolované mená: ' + hotove + ' z celkom ' + spolu + '.',
    hotovo: (n) => 'Hotovo. Skontrolované mená: ' + n + '.',
    typP: 'osoba', typE: 'organizácia',
    suhrnHtml: (pocet, nazov, partneri, jeden, prah, orezane) => 'Skontrolované mená zo súboru „' + nazov + '“: <b>' + pocet + '</b>. '
      + (partneri ? 'Mená so zhodou na preverenie (skóre ' + prah + ' a viac): <b>' + partneri + '</b>.' : 'Žiadna zhoda so skóre ' + prah + ' a viac.')
      + (orezane ? ' Skontrolovalo sa len prvých ' + orezane + ' mien.' : ''),
    th: ['Riadok', 'Meno vo vašom zozname', 'Skóre', 'Záznam v zozname EÚ', 'Dôvod'],
    program: 'program', akt: 'právny akt',
    prazdne: (prah) => 'Žiadne meno z vášho zoznamu nedosiahlo skóre ' + prah + '. To neznamená, že sa sankcie netýkajú nikoho z vašich partnerov: kontroloval sa len finančný sankčný zoznam EÚ a príliš odlišné zápisy mien nástroj nerozpozná. Posuvníkom môžete prah znížiť až na 80.',
    verziaHtml: (datum, spolu, sha, stiahnute, cas) => 'Porovnané so zoznamom: finančný sankčný zoznam EÚ, súbor Európskej komisie z ' + datum
      + ', ' + spolu + ' záznamov, SHA-256 <code>' + sha + '</code>'
      + (stiahnute ? ', stiahnutý nami ' + stiahnute : '')
      + '. Kontrola ' + cas + ' v tomto prehliadači.',
    csv: ['Riadok', 'Meno vo vašom zozname', 'Skóre', 'Meno v zozname EÚ', 'Referencia EÚ', 'Typ', 'Program', 'Právny akt', 'Odkaz na právny akt', 'Dôvod', 'Súbor zoznamu z', 'SHA-256 súboru zoznamu', 'Kontrola'],
    csvNic: 'Žiadna zhoda',
    subor: 'kontrola-sankcii-',
  },
  en: {
    standHtml: (datum, spolu, osoby, org) => 'EU list: European Commission file of <b>' + datum + '</b>, ' + spolu + ' entries (' + osoby + ' persons, ' + org + ' organisations).',
    standChyba: 'The version of the EU list could not be loaded. Reload the page; without the list no check is possible.',
    nacitavam: 'Loading the EU list (about 420 kB) and preparing it.',
    zoznam: 'List',
    nesedi: 'The list version does not match. Please reload the page.',
    stlpec: 'Column',
    chybaXls: 'We cannot read old .xls files. In Excel, save the file as .xlsx or as “CSV UTF-8” and load it again.',
    chybaSubor: 'The file could not be read. Supported are .xlsx and .csv. If needed, save the sheet as “CSV UTF-8”.',
    prazdny: 'The file is empty. Choose a sheet with names.',
    vzorHotovo: 'Done. The example list is made up, except for two names that appear on the EU list in this or a similar form.',
    vzorChyba: 'The example list could not be loaded.',
    bezMien: 'The selected column contains no names. Choose another column in the result.',
    chybaZoznamu: (d) => 'The EU list could not be loaded (' + d + '). Your file was not sent anywhere. Please try again later.',
    chyba: 'error',
    priebeh: (hotove, spolu) => hotove + ' of ' + spolu + ' names checked.',
    hotovo: (n) => 'Done. ' + n + ' names checked.',
    typP: 'person', typE: 'organisation',
    suhrnHtml: (pocet, nazov, partneri, jeden, prah, orezane) => '<b>' + pocet + '</b> names from “' + nazov + '” checked. '
      + (partneri ? '<b>' + partneri + '</b> ' + (jeden ? 'name has' : 'names have') + ' a match with score ' + prah + ' or more to review.' : 'No match with score ' + prah + ' or more.')
      + (orezane ? ' Only the first ' + orezane + ' names were checked.' : ''),
    th: ['Row', 'Name in your list', 'Score', 'Entry in the EU list', 'Reason'],
    program: 'programme', akt: 'legal act',
    prazdne: (prah) => 'No name from your list reaches score ' + prah + '. That does not mean none of your partners is affected: only the EU financial sanctions list was checked, and the tool does not recognise spellings that differ too much. Use the slider to lower the threshold to 80.',
    verziaHtml: (datum, spolu, sha, stiahnute, cas) => 'Checked against: EU financial sanctions list, European Commission file of ' + datum
      + ', ' + spolu + ' entries, SHA-256 <code>' + sha + '</code>'
      + (stiahnute ? ', downloaded by us on ' + stiahnute : '')
      + '. Check run on ' + cas + ' in this browser.',
    csv: ['Row', 'Name in your list', 'Score', 'Name in the EU list', 'EU reference', 'Type', 'Programme', 'Legal act', 'Link to legal act', 'Reason', 'List file of', 'SHA-256 of list file', 'Checked on'],
    csvNic: 'No match',
    subor: 'sanctions-check-',
  },
};

export const textyPre = (jazyk) => TEXTY[jazykStranky(jazyk)];
