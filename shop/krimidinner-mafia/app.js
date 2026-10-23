/* Mord im Club Juniper (krimidinner-mafia): jednorazovy predaj jedneho A4-PDF,
 * ten isty vzor ako shop/murder-lantern-ball/app.js. Cela logika je spolocna
 * v /titul.js (tlacidlo, test mod, overenie platby cez workera, odomknutie
 * a odkazy z licencnej sluzby); titul.js sa tu NEMENI, je spolocny pre ine stranky.
 *
 * Tu sa len prepisu po nemecky vsetky texty, ktore titul.js dovoli prepisat:
 * T (stav platby, odznak testu) a PANEL (panel po zaplateni). Zoznam klucov:
 * ops/druhy-ucet/222/zber/A-mapa-predaja.md, cast 2.1.
 *
 * Napevno v titul.js ostava (len test mod alebo format cisla, zapisane v
 * ops/druhy-ucet/222/ODOVZDANIE-STRANKA.md): nadpis odznaku "Test mode"
 * (naplnOdznak), TEST_VYPNUTE a pripona " (switched off in test mode)"
 * (vypniZivePlatby, na tejto stranke ziadny odkaz na zivu platbu nie je) a
 * velkost suboru v paneli s desatinnou bodkou ("1.43 MB", velkostSuboru).
 *
 * T.nepotvrdene vklada titul.js cez innerHTML: v texte nesmie byt < ani &.
 */
import { nastav, T, PANEL } from '../../titul.js';

Object.assign(T, {
  overujem: 'Zahlung wird geprüft',
  inaSuma: 'Die Zahlung ist eingegangen, aber nicht mit einem Betrag, den wir diesem Spiel zuordnen können. Schreiben Sie an support@arling.sk, wir klären es von Hand.',
  nepotvrdene: 'Wir konnten die Zahlung noch nicht bestätigen. Wir versuchen es weiter; wenn Sie bezahlt haben, werden die Dateien freigeschaltet, sobald Stripe antwortet. Dauert es länger als ein paar Minuten, schreiben Sie an support@arling.sk von der E-Mail-Adresse, mit der Sie bezahlt haben.',
  overZnova: 'Erneut prüfen',
  /* Veta, kym tlacidlo nema odkaz (DOPLNI_FABLE, pred node ops/stripe/krimidinner-mafia.mjs --zapis). */
  zapina: 'Der Kauf ist auf dieser Seite noch nicht freigeschaltet. Bei Fragen schreiben Sie an support@arling.sk.',
  testChyba: 'Der Testmodus ist an, aber dieses Spiel hat noch keinen Testlink (node ops/stripe/krimidinner-mafia.mjs --test --zapis). Öffnen Sie die Seite ohne ?test=1, um wirklich zu kaufen.',
  testCudzi: 'Das ist eine Zahlung aus dem Stripe-Testmodus. Sie schaltet die Dateien nur in dem Browser frei, der den Test mit ?test=1 gestartet hat.',
  odznak: 'Der Kaufknopf führt in den Stripe-Testmodus. Nutzen Sie die Karte 4242 4242 4242 4242, ein beliebiges Datum in der Zukunft und eine beliebige Prüfziffer. Es wird kein Geld abgebucht; die Datei nach der Zahlung ist die echte.',
});

Object.assign(PANEL, {
  znacka: 'Bezahlt, vielen Dank',
  nadpis: 'Ihre Datei',
  stiahnut: 'Herunterladen: ',
  ukazka: 'Kostenlose Vorschau',
  mailPred: 'Der Link bleibt in diesem Browser und ging auch per E-Mail an ',
  mailBez: 'die Adresse, mit der Sie bezahlt haben',
  mailPo: '. Die E-Mail ist derzeit auf Englisch.',
  mailNeisty: 'Laden Sie die Datei jetzt herunter: Dieser Knopf bleibt nur in diesem Browser, und der Link gilt 7 Tage. Ob die E-Mail mit dem Link schon unterwegs ist, können wir hier nicht bestätigen (sie kommt derzeit auf Englisch). Kommt in ein paar Minuten nichts an, schreiben Sie an support@arling.sk mit der Bestellnummer unten, und wir schicken Ihnen die Datei von Hand.',
  objednavka: 'Bestellnummer ',
  test: 'Testmodus: Die Zahlung lief im Stripe-Testmodus, es wird kein Geld abgebucht; die Datei unten ist die echte.',
  cakame: 'Ihre Zahlung ist bestätigt, aber der Link zum Herunterladen hat sich gerade nicht geladen. Warten Sie eine Minute und tippen Sie auf „Erneut versuchen“.',
  cakamePomoc: 'Erscheint er dann immer noch nicht, schreiben Sie an support@arling.sk mit der Zahlungsreferenz unten, und wir schicken Ihnen die Datei.',
  cakamePomocBez: 'Erscheint er dann immer noch nicht, schreiben Sie an support@arling.sk von der E-Mail-Adresse, mit der Sie bezahlt haben, und wir schicken Ihnen die Datei.',
  znova: 'Erneut versuchen',
  referencia: 'Zahlungsreferenz ',
});

nastav();
