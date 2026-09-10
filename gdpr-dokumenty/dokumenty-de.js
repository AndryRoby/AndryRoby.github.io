/* GDPR-Dokumente (DSGVO) für ein deutsches Unternehmen oder einen Online-Shop:
 * Vorlagen. Gleicher Aufbau wie dokumenty-sk.js und dokumenty-cs.js (Blöcke
 * h, p, ul, tbl), andere Rechtsgrundlagen:
 * Verordnung (EU) 2016/679 (DSGVO); Bundesdatenschutzgesetz (BDSG),
 * insbesondere § 26 BDSG (Datenverarbeitung für Zwecke des
 * Beschäftigungsverhältnisses), § 38 BDSG (Pflicht zur Bestellung eines
 * Datenschutzbeauftragten, wenn in der Regel mindestens 20 Personen ständig
 * mit der automatisierten Verarbeitung personenbezogener Daten beschäftigt
 * sind) und § 4 BDSG (Videoüberwachung öffentlich zugänglicher Räume);
 * Telekommunikation-Digitale-Dienste-Datenschutz-Gesetz (TDDDG), § 25 TDDDG
 * (vormals § 25 TTDSG, Einwilligung bei Cookies, Bezeichnung seit 13. 5. 2024
 * geändert, Inhalt unverändert); Abgabenordnung § 147 AO und
 * Handelsgesetzbuch § 257 HGB (Aufbewahrung von Geschäftsunterlagen:
 * Buchungsbelege 8 Jahre, Handelsbücher, Inventare und Jahresabschlüsse
 * 10 Jahre, jeweils ab Ende des Kalenderjahres der Entstehung bzw. letzten
 * Eintragung, seit 1. 1. 2025 durch das Bürokratieentlastungsgesetz IV; für
 * Kreditinstitute und Versicherungsunternehmen gilt die Verkürzung erst ab
 * 2026); Betriebsverfassungsgesetz § 87 Abs. 1 Nr. 6 BetrVG (Mitbestimmung
 * des Betriebsrats bei der Einführung technischer Überwachungseinrichtungen,
 * sofern ein Betriebsrat besteht); Bürgerliches Gesetzbuch § 356 Abs. 5 BGB
 * (Erlöschen des Widerrufsrechts bei digitalen Inhalten, die nicht auf einem
 * körperlichen Datenträger geliefert werden).
 * Aufsichtsbehörde: die für den Unternehmenssitz zuständige
 * Landesdatenschutzbehörde; Anschriften über die Liste des Bundesbeauftragten
 * für den Datenschutz und die Informationsfreiheit (BfDI):
 * https://www.bfdi.bund.de/DE/Service/Anschriften/Laender/Laender-node.html
 * (Stand der Vorlagen: 10. 9. 2026).
 *
 * Das ist keine Rechtsberatung. Die Texte sind allgemeine Vorlagen, die mit
 * den Angaben des Unternehmens gefüllt werden; das Unternehmen sollte sie
 * lesen und an das anpassen, was es tatsächlich tut.
 */

export const NASTROJE = [
  { id: 'ga4', nazov: 'Google Analytics', kto: 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland', ucel: 'Messung der Websitebesuche', kategoria: 'analyse', usa: true, cookies: 'analytisch' },
  { id: 'matomo', nazov: 'Matomo (selbst gehostet) oder andere Analyse ohne Cookies auf eigenem Server', kto: 'Verantwortlicher (eigener Server)', ucel: 'anonyme Messung der Websitebesuche', kategoria: 'analyse', usa: false },
  { id: 'meta', nazov: 'Meta Pixel (Facebook, Instagram)', kto: 'Meta Platforms Ireland Limited, Merrion Road, Dublin 4, Irland', ucel: 'Erfolgsmessung und Ausspielung von Werbung', kategoria: 'marketing', usa: true, cookies: 'marketing' },
  { id: 'gads', nazov: 'Google Ads (Conversions, Remarketing)', kto: 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland', ucel: 'Erfolgsmessung und Ausspielung von Werbung', kategoria: 'marketing', usa: true, cookies: 'marketing' },
  { id: 'stripe', nazov: 'Stripe (Kartenzahlung)', kto: 'Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Dublin 2, Irland', ucel: 'Zahlungsabwicklung', kategoria: 'zahlungen', usa: true },
  { id: 'paypal', nazov: 'PayPal', kto: 'PayPal (Europe) S.à r.l. et Cie, S.C.A., 22-24 Boulevard Royal, L-2449 Luxemburg', ucel: 'Zahlungsabwicklung', kategoria: 'zahlungen', usa: true },
  { id: 'klarna', nazov: 'Klarna (Rechnungskauf, Ratenzahlung)', kto: 'Klarna Bank AB (publ), Sveavägen 46, 111 34 Stockholm, Schweden', ucel: 'Zahlungsabwicklung und Bonitätsprüfung', kategoria: 'zahlungen', usa: false },
  { id: 'dhl', nazov: 'DHL', kto: 'DHL Paket GmbH, Sträßchensweg 10, 53113 Bonn', ucel: 'Zustellung von Sendungen', kategoria: 'versand', usa: false },
  { id: 'dpd', nazov: 'DPD', kto: 'DPD Deutschland GmbH, Wailandtstraße 1, 63741 Aschaffenburg', ucel: 'Zustellung von Sendungen', kategoria: 'versand', usa: false },
  { id: 'hermes', nazov: 'Hermes', kto: 'Hermes Germany GmbH, Essener Straße 89, 22419 Hamburg', ucel: 'Zustellung von Sendungen', kategoria: 'versand', usa: false },
  { id: 'mailchimp', nazov: 'Mailchimp (Newsletter)', kto: 'Intuit Inc. (Mailchimp), 2700 Coast Avenue, Mountain View, CA 94043, USA', ucel: 'Versand des Newsletters', kategoria: 'marketing', usa: true },
  { id: 'brevo', nazov: 'Brevo (Newsletter, Marketing-E-Mails)', kto: 'Sendinblue GmbH (Brevo), Köpenicker Str. 126, 10179 Berlin', ucel: 'Versand des Newsletters', kategoria: 'marketing', usa: false },
  { id: 'cleverreach', nazov: 'CleverReach (Newsletter)', kto: 'CleverReach GmbH & Co. KG, Schafjückenweg 2, 26180 Rastede', ucel: 'Versand des Newsletters', kategoria: 'marketing', usa: false },
  { id: 'shopify', nazov: 'Shopify (Shop-Plattform)', kto: 'Shopify International Limited, Victoria Buildings, 1-2 Haddington Road, Dublin 4, D04 XN32, Irland', ucel: 'Betrieb des Online-Shops und Speicherung der Bestellungen', kategoria: 'hosting', usa: false },
  { id: 'shopware', nazov: 'Shopware (Shop-Software)', kto: 'shopware AG, Ebbinghoff 10, 48624 Schöppingen', ucel: 'Betrieb des Online-Shops und Speicherung der Bestellungen', kategoria: 'hosting', usa: false },
  { id: 'hosting', nazov: 'WooCommerce oder anderes Hosting bzw. andere Shop-Plattform (Wix, …)', kto: 'Hosting- oder Plattform-Anbieter laut Vertrag', ucel: 'Hosting der Website, Speicherung von Bestellungen und Konten', kategoria: 'hosting', usa: false },
  { id: 'ionos', nazov: 'IONOS (Hosting, E-Mail)', kto: '1&1 IONOS SE, Elgendorfer Str. 57, 56410 Montabaur', ucel: 'Hosting der Website und E-Mail', kategoria: 'hosting', usa: false },
  { id: 'gworkspace', nazov: 'Google Workspace (Gmail, Drive)', kto: 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland', ucel: 'E-Mail und Dokumentenablage', kategoria: 'büro', usa: true },
  { id: 'm365', nazov: 'Microsoft 365 (Outlook, OneDrive)', kto: 'Microsoft Ireland Operations Limited, One Microsoft Place, South County Business Park, Leopardstown, Dublin 18, Irland', ucel: 'E-Mail und Dokumentenablage', kategoria: 'büro', usa: true },
  { id: 'steuerberater', nazov: 'Steuerberater oder Lohnbüro', kto: 'Steuerberatungskanzlei laut Mandatsvertrag', ucel: 'Buchführung und Lohn- und Gehaltsabrechnung', kategoria: 'buchhaltung', usa: false },
  { id: 'buchhaltung', nazov: 'Rechnungs- und Buchhaltungssoftware (Lexoffice, sevDesk, …)', kto: 'Anbieter der Software laut Vertrag', ucel: 'Ausstellen von Rechnungen und Buchführung', kategoria: 'buchhaltung', usa: false },
];

export const LEHOTY_PREDVOLENE = {
  objednavky: '8 bzw. 10 Jahre ab Ende des Kalenderjahres der Entstehung bzw. letzten Eintragung: Buchungsbelege (u. a. Rechnungen, Kontoauszüge, Lieferscheine) 8 Jahre, Handelsbücher, Inventare und Jahresabschlüsse 10 Jahre (§ 147 Abs. 1 und 3 AO; § 257 Abs. 1 und 4 HGB, seit 1. 1. 2025 durch das Bürokratieentlastungsgesetz IV)',
  kontakt: '1 Jahr nach Bearbeitung der Anfrage',
  newsletter: 'bis zum Widerruf der Einwilligung, höchstens 3 Jahre seit dem letzten Öffnen der E-Mail',
  ucty: 'für die Dauer des Kontos und 1 Jahr nach dessen Löschung',
  uchadzaci: 'bis zum Abschluss des Auswahlverfahrens; mit Einwilligung der Bewerberin oder des Bewerbers höchstens 1 Jahr',
  zamestnanci: 'für die Dauer des Beschäftigungsverhältnisses und danach nach gesetzlichen Fristen (Lohnkonto 6 Kalenderjahre nach § 41 Abs. 1 EStG, Entgeltunterlagen der Sozialversicherung bis zum Ende des Kalenderjahres nach der nächsten Betriebsprüfung nach § 28f SGB IV, die übrige Personalakte nach betrieblichem Aktenplan)',
  kamery: 'in der Regel 72 Stunden nach der Aufzeichnung, sofern die Aufnahme nicht zu Beweiszwecken benötigt wird (Orientierungshilfe der Datenschutzkonferenz zur Videoüberwachung durch nicht-öffentliche Stellen, 2020)',
};

export const CINNOSTI = [
  { id: 'eshop', nazov: 'Bestellungen und Verkauf (Online-Shop oder Rechnungen an Kunden)' },
  { id: 'kontakt', nazov: 'Kontaktformular, E-Mail- und Telefonanfragen' },
  { id: 'newsletter', nazov: 'Newsletter und Marketing-E-Mails' },
  { id: 'ucty', nazov: 'Benutzerkonten auf der Website' },
  { id: 'analytika', nazov: 'Messung der Websitebesuche' },
  { id: 'socialne', nazov: 'Profile in sozialen Netzwerken (Facebook, Instagram, LinkedIn)' },
  { id: 'zamestnanci', nazov: 'Beschäftigte und geringfügig Beschäftigte' },
  { id: 'uchadzaci', nazov: 'Bewerberinnen und Bewerber' },
  { id: 'kamery', nazov: 'Videoüberwachung am Standort' },
];

const h = (l, t) => ({ h: l, t });
const p = (t) => ({ p: t });
const ul = (x) => ({ ul: x });
const tbl = (rows) => ({ tbl: rows });

function datum(iso) {
  const [y, m, dd] = (iso || '').split('-');
  return y ? `${+dd}. ${+m}. ${y}` : '';
}
function firma(d) {
  const f = d.firma || {};
  return [f.nazov, f.sidlo ? 'mit Sitz in ' + f.sidlo : '', f.ico ? 'USt-IdNr./HRB ' + f.ico : ''].filter(Boolean).join(', ');
}
function kontakt(d) {
  const f = d.firma || {};
  return [f.email ? 'E-Mail ' + f.email : '', f.telefon ? 'Telefon ' + f.telefon : ''].filter(Boolean).join(', ');
}
const ma = (d, id) => !!(d.cinnosti && d.cinnosti[id]);
const nastroje = (d) => NASTROJE.filter((n) => (d.nastroje || []).includes(n.id));
const prenosUSA = (d) => nastroje(d).some((n) => n.usa) || d.prenosMimoEU === 'ano';
const lehota = (d, k) => (d.lehoty && d.lehoty[k]) || LEHOTY_PREDVOLENE[k];
function beauftragter(d) {
  const z = d.zodpovednaOsoba || {};
  if (!z.ma) return null;
  return [z.meno, z.email].filter(Boolean).join(', ');
}
const AUFSICHT = '[zuständige Landesdatenschutzbehörde] (Anschriften der Landesdatenschutzbehörden der Länder: https://www.bfdi.bund.de/DE/Service/Anschriften/Laender/Laender-node.html)';

/* Verarbeitungstätigkeiten des Unternehmens nach den angekreuzten Feldern:
 * eine Quelle für die Erklärung (D1), das Verzeichnis (D3) und die Richtlinie
 * (D7). */
export function cinnosti(d) {
  const out = [];
  if (ma(d, 'eshop')) out.push({
    id: 'eshop', nazov: 'Verkauf von Waren und Dienstleistungen, Bestellabwicklung',
    ucel: 'Abschluss und Erfüllung des Vertrags mit dem Kunden, Zustellung, Bearbeitung von Reklamationen, Ausstellung des Rechnungsbelegs',
    zaklad: 'Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) und Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtung: Buchführung, Steuern, Gewährleistung)',
    udaje: 'Vor- und Nachname, Rechnungs- und Lieferadresse, E-Mail, Telefon, Bestell- und Zahlungsdaten (nicht die Kartennummer), USt-IdNr. bei Geschäftskunden',
    dotknuti: 'Kundinnen und Kunden',
    prijemcovia: ['Versanddienstleister', 'Zahlungsdienstleister', 'Steuerberater', 'Hosting- oder Shop-Plattform-Anbieter', 'Finanzamt und andere Behörden aufgrund gesetzlicher Pflicht'],
    lehota: lehota(d, 'objednavky'),
  });
  if (ma(d, 'kontakt')) out.push({
    id: 'kontakt', nazov: 'Bearbeitung von Anfragen (Kontaktformular, E-Mail, Telefon)',
    ucel: 'Beantwortung der Anfrage, Erstellung eines Angebots, Kommunikation vor Vertragsschluss',
    zaklad: 'Art. 6 Abs. 1 lit. b DSGVO (Maßnahmen vor Vertragsschluss auf Anfrage der betroffenen Person) und Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Beantwortung der Anfrage)',
    udaje: 'Name, E-Mail, Telefon, Inhalt der Nachricht',
    dotknuti: 'Personen, die uns kontaktieren',
    prijemcovia: ['Hosting- und E-Mail-Anbieter'],
    lehota: lehota(d, 'kontakt'),
  });
  if (ma(d, 'newsletter')) out.push({
    id: 'newsletter', nazov: 'Newsletter und Marketing-E-Mails',
    ucel: 'Versand von Neuigkeiten, Angeboten und Inhalten',
    zaklad: 'Art. 6 Abs. 1 lit. a DSGVO (Einwilligung); bei Bestandskunden Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse, Direktwerbung für eigene ähnliche Produkte unter den Voraussetzungen des § 7 Abs. 3 UWG) mit jederzeitigem Widerspruchsrecht',
    udaje: 'E-Mail, Name, Öffnungs- und Klickdaten der E-Mail',
    dotknuti: 'Newsletter-Abonnentinnen und -Abonnenten, Kundinnen und Kunden',
    prijemcovia: ['Anbieter des E-Mail-Versandtools'],
    lehota: lehota(d, 'newsletter'),
  });
  if (ma(d, 'ucty')) out.push({
    id: 'ucty', nazov: 'Benutzerkonten',
    ucel: 'Kontoführung, Bestellhistorie, Speicherung von Einstellungen',
    zaklad: 'Art. 6 Abs. 1 lit. b DSGVO (Erfüllung des Nutzungsvertrags)',
    udaje: 'Name, E-Mail, Anmeldedaten (Passwort nur verschlüsselt), Adresse, Bestellhistorie',
    dotknuti: 'registrierte Nutzerinnen und Nutzer',
    prijemcovia: ['Hosting- oder Plattform-Anbieter'],
    lehota: lehota(d, 'ucty'),
  });
  if (ma(d, 'analytika')) out.push({
    id: 'analytika', nazov: 'Messung der Websitebesuche',
    ucel: 'feststellen, wie viele Personen die Website besuchen, woher sie kommen und welche Seiten sie nutzen, und die Website verbessern',
    zaklad: (d.cookies && d.cookies.analyticke) ? 'Art. 6 Abs. 1 lit. a DSGVO (Einwilligung im Cookie-Banner) und § 25 Abs. 1 TDDDG (vormals TTDSG)' : 'Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse), Messung ohne Cookies und ohne Personenbezug',
    udaje: (d.cookies && d.cookies.analyticke) ? 'IP-Adresse (gekürzt), Cookie-Kennung, Browser, Gerät, besuchte Seiten, Zugriffsquelle' : 'gekürzte IP-Adresse, Browser, Gerät, besuchte Seiten, Zugriffsquelle; ohne Cookies und ohne Personenprofil',
    dotknuti: 'Websitebesucherinnen und -besucher',
    prijemcovia: ['Anbieter des Analysetools'],
    lehota: '14 Monate (aggregierte Statistiken ohne Personenbezug werden länger gespeichert)',
  });
  if (ma(d, 'socialne')) out.push({
    id: 'socialne', nazov: 'Profile in sozialen Netzwerken',
    ucel: 'Präsentation des Unternehmens, Kommunikation mit Personen, die uns folgen oder schreiben',
    zaklad: 'Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Unternehmenspräsentation); für die Verarbeitung auf Seiten des sozialen Netzwerks ist dessen Anbieter nach eigenen Regeln verantwortlich',
    udaje: 'öffentliches Profil, Kommentare, Nachrichten, Reaktionen',
    dotknuti: 'Nutzerinnen und Nutzer des sozialen Netzwerks, die mit dem Profil interagieren',
    prijemcovia: ['Anbieter des sozialen Netzwerks (gemeinsam Verantwortliche für Seitenstatistiken)'],
    lehota: 'für die Dauer des Profils; Nachrichten 1 Jahr nach Bearbeitung',
  });
  if (ma(d, 'zamestnanci')) out.push({
    id: 'zamestnanci', nazov: 'Beschäftigte und geringfügig Beschäftigte (Personal- und Lohnabrechnung)',
    ucel: 'Erfüllung des Arbeitsvertrags, Lohn- und Gehaltsabrechnung, Abgaben, Steuern, Arbeitsschutz, Arbeitszeiterfassung',
    zaklad: 'Art. 6 Abs. 1 lit. b DSGVO i. V. m. § 26 Abs. 1 BDSG (Beschäftigtendatenschutz) und Art. 6 Abs. 1 lit. c DSGVO (Sozialversicherungs-, Steuer- und Arbeitsschutzrecht)',
    udaje: 'Identifikations- und Kontaktdaten, Sozialversicherungsnummer, Kontoverbindung, Angaben zu Ausbildung und Berufserfahrung, Lohndaten, Arbeitszeiterfassung, Angaben zur gesundheitlichen Eignung im gesetzlich vorgesehenen Umfang',
    dotknuti: 'Beschäftigte, geringfügig Beschäftigte, deren Angehörige im Umfang steuerlicher Freibeträge',
    prijemcovia: ['Krankenkassen und Sozialversicherungsträger', 'Finanzamt', 'Lohnbüro oder Steuerberater', 'Anbieter der betriebsärztlichen Versorgung'],
    lehota: lehota(d, 'zamestnanci'),
  });
  if (ma(d, 'uchadzaci')) out.push({
    id: 'uchadzaci', nazov: 'Bewerberinnen und Bewerber',
    ucel: 'Personalauswahl',
    zaklad: 'Art. 6 Abs. 1 lit. b DSGVO i. V. m. § 26 Abs. 1 BDSG (Maßnahmen vor Begründung des Beschäftigungsverhältnisses); Aufbewahrung der Bewerbungsunterlagen nach Abschluss des Verfahrens nur mit Einwilligung (Art. 6 Abs. 1 lit. a DSGVO)',
    udaje: 'Lebenslauf, Anschreiben, Kontaktdaten, Angaben aus dem Vorstellungsgespräch',
    dotknuti: 'Bewerberinnen und Bewerber',
    prijemcovia: ['Personalvermittlungsagentur, sofern eingesetzt'],
    lehota: lehota(d, 'uchadzaci'),
  });
  if (ma(d, 'kamery')) out.push({
    id: 'kamery', nazov: 'Videoüberwachung',
    ucel: 'Schutz des Eigentums, Sicherheit von Personen und Aufdeckung rechtswidrigen Verhaltens am Standort',
    zaklad: 'Art. 6 Abs. 1 lit. f DSGVO i. V. m. § 4 BDSG (Videoüberwachung öffentlich zugänglicher Räume); gegenüber Beschäftigten ist, sofern ein Betriebsrat besteht, dessen Mitbestimmungsrecht nach § 87 Abs. 1 Nr. 6 BetrVG zu beachten',
    udaje: 'Bildaufnahmen von Personen im überwachten Bereich, Aufnahmezeit',
    dotknuti: 'Kundinnen und Kunden, Besucherinnen und Besucher, Beschäftigte im überwachten Bereich',
    prijemcovia: ['Polizei und Gerichte bei der Geltendmachung von Ansprüchen'],
    lehota: lehota(d, 'kamery'),
  });
  return out;
}

/* Auftragsverarbeiter und Empfänger, die in der Erklärung und im Verzeichnis genannt werden. */
function prijemcoviaText(d) {
  const riadky = nastroje(d).map((x) => `${x.nazov}: ${x.kto} (${x.ucel})`);
  if (d.nastrojeIne) riadky.push(d.nastrojeIne);
  return riadky;
}

/* ── D1 Datenschutzerklärung (kostenlos) ───────────────────────────────── */
export function d1Zasady(d) {
  const f = d.firma || {};
  const zo = beauftragter(d);
  const c = cinnosti(d);
  const b = [];
  b.push(h(1, 'Datenschutzerklärung'));
  b.push(p(`Diese Datenschutzerklärung erklärt, wie ${f.nazov || '[Firmenname]'} personenbezogene Daten von Personen verarbeitet, die die Website ${f.web || '[Website]'} nutzen, bei uns einkaufen oder mit uns kommunizieren. Sie gilt ab ${datum(d.datum) || '[Datum]'}.`));
  b.push(h(2, '1. Wer ist Verantwortlicher'));
  b.push(p(`Verantwortlicher für die Verarbeitung personenbezogener Daten ist ${firma(d) || '[Name, Sitz, USt-IdNr./HRB]'}${kontakt(d) ? ', ' + kontakt(d) : ''}.`));
  if (zo) b.push(p(`Datenschutzbeauftragter: ${zo}. Sie können sich mit jeder Frage zur Verarbeitung Ihrer Daten an ihn wenden.`));
  else b.push(p('Einen Datenschutzbeauftragten nach Art. 37 DSGVO und § 38 BDSG (Pflicht ab in der Regel mindestens 20 Personen, die ständig mit der automatisierten Verarbeitung personenbezogener Daten beschäftigt sind) mussten wir nicht bestellen; bei Fragen zu personenbezogenen Daten wenden Sie sich bitte an die oben genannten Kontaktdaten.'));
  b.push(h(2, '2. Welche Daten wir verarbeiten, wofür und auf welcher Rechtsgrundlage'));
  if (!c.length) b.push(p('Im Formular wurde keine Tätigkeit ausgewählt. Wählen Sie mindestens eine aus, damit dieser Abschnitt Inhalt hat.'));
  for (const x of c) {
    b.push(h(3, x.nazov));
    b.push(p(`**Zweck:** ${x.ucel}.`));
    b.push(p(`**Rechtsgrundlage:** ${x.zaklad}.`));
    b.push(p(`**Daten:** ${x.udaje}.`));
    b.push(p(`**Speicherdauer:** ${x.lehota}.`));
  }
  b.push(h(2, '3. An wen wir Daten weitergeben'));
  b.push(p('Personenbezogene Daten verkaufen wir nicht. Wir geben sie nur an Stellen weiter, die sie für die oben genannten Zwecke benötigen: Auftragsverarbeiter, die für uns auf Grundlage eines Vertrags nach Art. 28 DSGVO tätig werden, sowie Behörden, denen dies gesetzlich vorgeschrieben ist.'));
  const pr = prijemcoviaText(d);
  if (pr.length) b.push(ul(pr));
  else b.push(p('Liste der Auftragsverarbeiter: [bitte entsprechend den verwendeten Werkzeugen und Diensten ergänzen].'));
  b.push(h(2, '4. Übermittlung von Daten außerhalb der Europäischen Union'));
  if (prenosUSA(d)) b.push(p('Einige unserer Dienstleister (zum Beispiel Anbieter von Analyse, Werbung, Zahlungen oder E-Mail) haben Muttergesellschaften in den USA, sodass Daten außerhalb des Europäischen Wirtschaftsraums übermittelt werden können. Die Übermittlung stützt sich auf den Angemessenheitsbeschluss der Europäischen Kommission für den Rahmen EU-U.S. Data Privacy Framework (bei dort zertifizierten Unternehmen) oder auf die Standardvertragsklauseln der Europäischen Kommission nach Art. 46 Abs. 2 lit. c DSGVO. Eine Kopie der Klauseln stellen wir auf Anfrage zur Verfügung.'));
  else b.push(p('Wir übermitteln keine personenbezogenen Daten außerhalb der Europäischen Union und des Europäischen Wirtschaftsraums. Sollte sich das ändern, ergänzen wir diese Erklärung und sichern die Übermittlung nach Kapitel V DSGVO ab.'));
  b.push(h(2, '5. Ihre Rechte'));
  b.push(p('Nach der DSGVO haben Sie das Recht:'));
  b.push(ul([
    'auf Auskunft über die Daten, die wir über Sie gespeichert haben, und auf eine Kopie davon (Art. 15),',
    'auf Berichtigung unrichtiger oder unvollständiger Daten (Art. 16),',
    'auf Löschung, wenn wir die Daten nicht mehr benötigen oder sie rechtswidrig verarbeiten (Art. 17),',
    'auf Einschränkung der Verarbeitung (Art. 18),',
    'auf Übertragbarkeit der Daten, die Sie uns aufgrund einer Einwilligung oder eines Vertrags gegeben haben (Art. 20),',
    'gegen eine auf berechtigtem Interesse beruhende Verarbeitung, einschließlich Direktwerbung, Widerspruch einzulegen (Art. 21),',
    'eine erteilte Einwilligung jederzeit zu widerrufen; der Widerruf berührt nicht die Rechtmäßigkeit der bis zum Widerruf erfolgten Verarbeitung (Art. 7 Abs. 3),',
    'Beschwerde bei einer Aufsichtsbehörde einzulegen: ' + AUFSICHT + ' (Art. 77).',
  ]));
  b.push(p(`Bitte senden Sie Ihre Anfrage an ${f.email || '[E-Mail]'}. Wir antworten innerhalb eines Monats; bei komplexen Anfragen können wir die Frist um weitere zwei Monate verlängern und teilen Ihnen dies mit (Art. 12 Abs. 3 DSGVO). Sind wir uns nicht sicher, wer die Anfrage stellt, können wir Sie um eine Identitätsprüfung bitten.`));
  b.push(h(2, '6. Wie wir Daten schützen'));
  b.push(p('Zugang zu den Daten haben nur Personen, die sie für ihre Arbeit benötigen und auf Vertraulichkeit verpflichtet sind. Die Website läuft über eine verschlüsselte Verbindung (HTTPS), Passwörter speichern wir nur verschlüsselt, wir erstellen Backups und schützen Zugänge durch Passwörter sowie, soweit verfügbar, Zwei-Faktor-Authentifizierung (Art. 32 DSGVO).'));
  const cookiesAktiv = ma(d, 'analytika') || (d.cookies && (d.cookies.analyticke || d.cookies.marketingove));
  if (cookiesAktiv) {
    b.push(h(2, '7. Cookies'));
    b.push(p('Wir verwenden notwendige Cookies, ohne die die Website nicht funktioniert (zum Beispiel Warenkorb oder Anmeldung). Andere Cookies (Analyse, Marketing) setzen wir nur mit Ihrer Einwilligung, die Sie im Cookie-Banner erteilen und jederzeit ändern können. Einzelheiten finden Sie in der gesonderten Cookie-Richtlinie.'));
  }
  b.push(h(2, (cookiesAktiv ? '8' : '7') + '. Automatisierte Entscheidungsfindung und Änderungen dieser Erklärung'));
  b.push(p('Wir treffen keine Entscheidungen, die ausschließlich auf einer automatisierten Verarbeitung beruhen und Ihnen gegenüber rechtliche Wirkung entfalten (Art. 22 DSGVO). Diese Erklärung können wir aktualisieren; die jeweils aktuelle Fassung steht immer auf unserer Website, bei wesentlichen Änderungen weisen wir gesondert darauf hin.'));
  return b;
}

/* ── D2 Cookies ────────────────────────────────────────────────────────── */
export function d2Cookies(d) {
  const f = d.firma || {};
  const ck = d.cookies || {};
  const n = nastroje(d);
  const b = [];
  b.push(h(1, 'Cookie-Richtlinie'));
  b.push(p(`Die Website ${f.web || '[Website]'} wird von ${firma(d) || '[Unternehmen]'} betrieben. Cookies sind kleine Dateien, die der Browser auf Ihrem Endgerät speichert. Nach § 25 Abs. 1 TDDDG (vormals TTDSG) dürfen wir Informationen auf Ihrem Endgerät nur mit Ihrer Einwilligung speichern oder aus ihm auslesen; ausgenommen sind Cookies, die unbedingt erforderlich sind, um einen von Ihnen ausdrücklich gewünschten Dienst bereitzustellen (§ 25 Abs. 2 Nr. 2 TDDDG).`));
  b.push(h(2, 'Welche Cookies wir verwenden'));
  const rows = [['Kategorie', 'Wofür', 'Rechtsgrundlage', 'Wie lange']];
  rows.push(['Notwendig', 'Betrieb der Website: Warenkorb, Anmeldung, Speicherung der Cookie-Einwilligung, Schutz von Formularen vor Missbrauch', 'ohne Einwilligung (Ausnahme nach § 25 Abs. 2 Nr. 2 TDDDG), berechtigtes Interesse', 'Sitzung bis 12 Monate']);
  if (ck.analyticke) rows.push(['Analyse', 'Messung der Websitebesuche: welche Seiten gelesen werden, woher die Besucher kommen, wie viele es sind', 'Einwilligung', 'bis 14 Monate']);
  if (ck.marketingove) rows.push(['Marketing', 'Erfolgsmessung von Werbung und deren Ausspielung auf anderen Websites und sozialen Netzwerken', 'Einwilligung', 'bis 13 Monate']);
  b.push(tbl(rows));
  if (!ck.analyticke && !ck.marketingove) b.push(p('Wir verwenden weder Analyse- noch Marketing-Cookies. Falls wir die Besuche messen, tun wir dies ohne Cookies und ohne Personenbezug.'));
  const tretie = n.filter((x) => x.cookies);
  if (tretie.length) {
    b.push(h(2, 'Cookies von Drittanbietern'));
    b.push(ul(tretie.map((x) => `${x.nazov}: ${x.kto}; ${x.ucel}. Daten können in die USA übermittelt werden (Rahmen EU-U.S. Data Privacy Framework oder Standardvertragsklauseln).`)));
  }
  b.push(h(2, 'Wie Sie Ihre Einwilligung erteilen, ändern oder widerrufen'));
  b.push(p('Beim ersten Besuch wird ein Cookie-Banner angezeigt. Bis Sie einwilligen, werden nur notwendige Cookies gesetzt. Ihre Einwilligung können Sie jederzeit über den Link „Cookie-Einstellungen" in der Fußzeile der Website ändern. Cookies können Sie auch in den Einstellungen Ihres Browsers löschen; die Website funktioniert dann möglicherweise eingeschränkt.'));
  b.push(h(2, 'Text des Cookie-Banners (zum Einbinden in die Website)'));
  b.push(p(`**Überschrift:** Cookies auf ${f.web || '[Website]'}`));
  b.push(p('**Text:** Notwendige Cookies verwenden wir, damit die Website funktioniert. Analyse- und Marketing-Cookies setzen wir nur, wenn Sie uns dies erlauben. Ihre Auswahl können Sie jederzeit ändern. Mehr dazu in der Cookie-Richtlinie.'));
  b.push(p('**Schaltflächen:** Alle akzeptieren · Optionale ablehnen · Einstellungen. Die Schaltfläche „Ablehnen" muss ebenso deutlich sichtbar sein wie „Akzeptieren" (ständige Aufsichtspraxis und Rechtsprechung zu Art. 4 Nr. 11, Art. 7 DSGVO i. V. m. § 25 TDDDG, z. B. OLG Köln, Urteil vom 19. 1. 2024, Az. 6 U 80/23).'));
  return b;
}

/* ── D3 Verzeichnis von Verarbeitungstätigkeiten (Art. 30) ─────────────── */
export function d3Zaznamy(d) {
  const c = cinnosti(d);
  const zo = beauftragter(d);
  const b = [];
  b.push(h(1, 'Verzeichnis von Verarbeitungstätigkeiten'));
  b.push(p(`Verantwortlicher: ${firma(d) || '[Unternehmen]'}${kontakt(d) ? ', ' + kontakt(d) : ''}. Vertreten durch: ${(d.firma || {}).zastupca || '[Geschäftsführer]'}. Datenschutzbeauftragter: ${zo || 'nicht bestellt'}. Verzeichnis geführt nach Art. 30 Abs. 1 DSGVO, Stand ${datum(d.datum) || '[Datum]'}.`));
  b.push(p('Hinweis: Die Pflicht zur Führung des Verzeichnisses trifft auch Unternehmen mit weniger als 250 Beschäftigten, wenn die Verarbeitung nicht nur gelegentlich erfolgt (Art. 30 Abs. 5 DSGVO); die Bearbeitung von Bestellungen oder die Lohnabrechnung sind nicht nur gelegentlich.'));
  if (!c.length) b.push(p('Im Formular wurde keine Tätigkeit ausgewählt.'));
  c.forEach((x, i) => {
    b.push(h(2, `Tätigkeit ${i + 1}: ${x.nazov}`));
    b.push(tbl([
      ['Position', 'Inhalt'],
      ['Zweck der Verarbeitung', x.ucel],
      ['Rechtsgrundlage', x.zaklad],
      ['Kategorien betroffener Personen', x.dotknuti],
      ['Kategorien personenbezogener Daten', x.udaje],
      ['Kategorien von Empfängern', x.prijemcovia.join('; ')],
      ['Übermittlung in ein Drittland', prenosUSA(d) && ['analytika', 'newsletter', 'eshop', 'kontakt', 'socialne'].includes(x.id) ? 'mögliche Übermittlung in die USA über Dienstleister (EU-U.S. Data Privacy Framework oder Standardvertragsklauseln)' : 'nein'],
      ['Löschfrist', x.lehota],
      ['Technische und organisatorische Maßnahmen (Art. 32)', 'rollenbasierte Zugriffsverwaltung, Passwörter und Zwei-Faktor-Authentifizierung, verschlüsselte Verbindung, Datensicherung, Verpflichtung der befugten Personen, Verträge mit Auftragsverarbeitern, Dokumentation von Verletzungen'],
    ]));
  });
  b.push(h(2, 'Auftragsverarbeiter'));
  const pr = prijemcoviaText(d);
  b.push(pr.length ? ul(pr) : p('[bitte ergänzen]'));
  b.push(h(2, 'Änderungshistorie'));
  b.push(tbl([['Datum', 'Wer', 'Was wurde geändert'], [datum(d.datum) || '', (d.firma || {}).zastupca || '', 'Ersterstellung']]));
  return b;
}

/* ── D4 Auftragsverarbeitungsvertrag (Art. 28) ─────────────────────────── */
export function d4Zmluva(d) {
  const b = [];
  b.push(h(1, 'Vertrag über die Auftragsverarbeitung (Auftragsverarbeitungsvertrag, AVV)'));
  b.push(p('geschlossen nach Art. 28 Abs. 3 der Verordnung (EU) 2016/679 (DSGVO)'));
  b.push(p(`**Verantwortlicher:** ${firma(d) || '[Unternehmen]'}, vertreten durch ${(d.firma || {}).zastupca || '[Geschäftsführer]'}`));
  b.push(p('**Auftragsverarbeiter:** [Name, Sitz, Handelsregisternummer, Vertretung]'));
  b.push(h(2, '1. Gegenstand und Dauer'));
  b.push(p('Der Auftragsverarbeiter verarbeitet für den Verantwortlichen personenbezogene Daten im Umfang und zu dem Zweck gemäß Anlage 1, ausschließlich auf dokumentierte Weisung des Verantwortlichen, für die Dauer des Hauptvertrags: [Bezeichnung des Hauptvertrags, Datum].'));
  b.push(h(2, '2. Pflichten des Auftragsverarbeiters (Art. 28 Abs. 3 DSGVO)'));
  b.push(ul([
    'verarbeitet Daten nur auf dokumentierte Weisung des Verantwortlichen, auch bei einer Übermittlung in ein Drittland; verpflichtet ihn das Recht der Union oder eines Mitgliedstaats zu einer anderen Verarbeitung, unterrichtet er den Verantwortlichen vorab, sofern das betreffende Recht dies nicht untersagt,',
    'stellt sicher, dass sich die zur Verarbeitung befugten Personen zur Vertraulichkeit verpflichtet haben,',
    'trifft technische und organisatorische Maßnahmen nach Art. 32 DSGVO gemäß Anlage 2,',
    'zieht einen weiteren Auftragsverarbeiter nur mit vorheriger schriftlicher Zustimmung des Verantwortlichen hinzu (allgemeine Zustimmung zur Liste in Anlage 3, Änderungen werden 30 Tage vorab mitgeteilt) und legt ihm die gleichen Pflichten auf,',
    'unterstützt den Verantwortlichen bei der Erfüllung von Anfragen betroffener Personen nach Kapitel III DSGVO,',
    'unterstützt den Verantwortlichen bei der Einhaltung der Pflichten nach Art. 32 bis 36 DSGVO (Sicherheit, Meldung von Verletzungen, Folgenabschätzung),',
    'meldet dem Verantwortlichen jede Verletzung des Schutzes personenbezogener Daten unverzüglich, spätestens innerhalb von 24 Stunden nach Bekanntwerden, mit den Angaben nach Art. 33 Abs. 3 DSGVO,',
    'löscht oder gibt nach Abschluss der Erbringung der Dienstleistungen nach Wahl des Verantwortlichen alle Daten zurück und löscht bestehende Kopien, sofern nicht nach dem Recht der Union oder der Mitgliedstaaten eine Verpflichtung zur Speicherung besteht,',
    'stellt dem Verantwortlichen alle erforderlichen Informationen zum Nachweis der Einhaltung der Pflichten zur Verfügung und ermöglicht Prüfungen, die vom Verantwortlichen oder einem von ihm beauftragten Prüfer durchgeführt werden, mit einer Ankündigung von mindestens 14 Tagen,',
    'unterrichtet den Verantwortlichen unverzüglich, wenn eine Weisung seiner Auffassung nach gegen die DSGVO oder sonstige Datenschutzvorschriften verstößt.',
  ]));
  b.push(h(2, '3. Pflichten des Verantwortlichen'));
  b.push(p('Der Verantwortliche ist verantwortlich für die Rechtmäßigkeit der Verarbeitung, die Rechtsgrundlage, die Information der betroffenen Personen sowie dafür, dass seine Weisungen mit der DSGVO im Einklang stehen. Weisungen erfolgen schriftlich oder per E-Mail.'));
  b.push(h(2, '4. Übermittlung in Drittländer'));
  b.push(p('Eine Übermittlung außerhalb des EWR ist nur auf Grundlage eines Angemessenheitsbeschlusses (Art. 45 DSGVO) oder der Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO), die diesem Vertrag als Anlage beigefügt sind, und nach Prüfung des Rechts des Ziellandes zulässig.'));
  b.push(h(2, '5. Haftung und Schlussbestimmungen'));
  b.push(p('Jede Partei haftet nach Art. 82 DSGVO. Dieser Vertrag unterliegt deutschem Recht. Änderungen nur schriftlich. Ausgefertigt in zwei gleichlautenden Exemplaren.'));
  b.push(p('In ____________ am ____________'));
  b.push(tbl([['Verantwortlicher', 'Auftragsverarbeiter'], ['\n\n______________________', '\n\n______________________']]));
  b.push(h(2, 'Anlage 1: Gegenstand der Verarbeitung'));
  b.push(tbl([['Position', 'Inhalt'], ['Zweck', '[z. B. Hosting des Online-Shops, Versand des Newsletters, Buchführung]'], ['Kategorien betroffener Personen', '[Kundinnen und Kunden, Abonnentinnen und Abonnenten, Beschäftigte]'], ['Kategorien von Daten', '[Name, E-Mail, Adresse, Bestelldaten]'], ['Dauer der Verarbeitung', '[für die Dauer des Hauptvertrags]']]));
  b.push(h(2, 'Anlage 2: technische und organisatorische Maßnahmen des Auftragsverarbeiters'));
  b.push(ul(['Zugriffs- und Berechtigungsverwaltung nach dem Prinzip der geringsten Rechte', 'Verschlüsselung der Übertragung (TLS) und, soweit möglich, ruhender Daten', 'Datensicherung und Wiederherstellungsplan', 'Protokollierung von Zugriffen, regelmäßige Aktualisierungen', 'Verpflichtung und Belehrung der Mitarbeitenden', 'Vorgehen bei Vorfällen mit Meldung innerhalb von 24 Stunden']));
  b.push(h(2, 'Anlage 3: genehmigte weitere Auftragsverarbeiter (Subunternehmer)'));
  b.push(tbl([['Name', 'Sitz', 'Zweck', 'Land der Verarbeitung'], ['[bitte ergänzen]', '', '', '']]));
  return b;
}

/* ── D5 Einwilligungen und Formulartexte ───────────────────────────────── */
export function d5Suhlas(d) {
  const f = d.firma || {};
  const b = [];
  b.push(h(1, 'Einwilligungen und Formulartexte'));
  b.push(p('Eine Einwilligung nach Art. 6 Abs. 1 lit. a und Art. 7 DSGVO muss freiwillig, spezifisch, informiert und unmissverständlich sein; sie darf nicht vorangekreuzt sein und muss sich ebenso leicht widerrufen lassen, wie sie erteilt wurde.'));
  b.push(h(2, 'A. Einwilligung zum Newsletter (Text am Kontrollkästchen)'));
  b.push(p(`☐ Ich stimme zu, dass ${f.nazov || '[Unternehmen]'} meine E-Mail-Adresse zum Versand von Neuigkeiten und Angeboten nutzt. Ich kann die Einwilligung jederzeit über den Link in jeder E-Mail oder per Nachricht an ${f.email || '[E-Mail]'} widerrufen. Mehr dazu in der Datenschutzerklärung.`));
  b.push(h(2, 'B. Text unter dem Kontaktformular (ohne Einwilligung, Information)'));
  b.push(p(`Mit dem Absenden der Nachricht verarbeiten wir Ihren Namen, Ihre E-Mail-Adresse und den Inhalt der Nachricht, um Ihnen zu antworten (Art. 6 Abs. 1 lit. b und f DSGVO). Wir speichern die Daten ${lehota(d, 'kontakt')}. Mehr dazu in der Datenschutzerklärung.`));
  b.push(h(2, 'C. Text bei der Bestellung (ohne Einwilligung, Information)'));
  b.push(p(`Ihre Daten verarbeiten wir zur Abwicklung der Bestellung, zur Zustellung und zur Ausstellung des Belegs (Art. 6 Abs. 1 lit. b und c DSGVO) und geben sie an den Versanddienstleister und den Zahlungsdienstleister weiter. Wir speichern sie ${lehota(d, 'objednavky')}. Mehr dazu in der Datenschutzerklärung.`));
  b.push(h(2, 'D. Einwilligung der Bewerberin oder des Bewerbers zur Aufbewahrung des Lebenslaufs'));
  b.push(p(`☐ Ich stimme zu, dass ${f.nazov || '[Unternehmen]'} meinen Lebenslauf und die Angaben aus dem Auswahlverfahren speichert, um mich mit einem weiteren Stellenangebot anzusprechen, für die Dauer von 1 Jahr. Ich kann die Einwilligung jederzeit an ${f.email || '[E-Mail]'} widerrufen.`));
  b.push(h(2, 'E. Schriftliche Einwilligung (eigenständiges Dokument)'));
  b.push(p('Betroffene Person: [Name, Vorname, Anschrift oder E-Mail]'));
  b.push(p(`Verantwortlicher: ${firma(d) || '[Unternehmen]'}`));
  b.push(p('Zweck: [z. B. Veröffentlichung eines Fotos von einer Veranstaltung auf der Website und in den sozialen Netzwerken des Verantwortlichen]'));
  b.push(p('Umfang der Daten: [z. B. Abbildung, Name]'));
  b.push(p('Dauer: [z. B. 3 Jahre ab Erteilung der Einwilligung]'));
  b.push(p('Ich erteile die Einwilligung freiwillig. Ich wurde darüber informiert, dass ich sie jederzeit widerrufen kann, ohne dass die Rechtmäßigkeit der bis zum Widerruf erfolgten Verarbeitung berührt wird, sowie über meine Rechte nach Art. 15 bis 22 DSGVO gemäß der Datenschutzerklärung.'));
  b.push(p('In ____________ am ____________   Unterschrift ______________________'));
  b.push(h(2, 'F. Dokumentation der Einwilligungen'));
  b.push(p('Der Verantwortliche muss nachweisen können, wer wann wofür und auf welche Weise eine Einwilligung erteilt hat (Art. 7 Abs. 1 DSGVO). Bei einer Online-Einwilligung dokumentieren Sie: E-Mail, Datum und Uhrzeit, IP-Adresse oder Kennung, den Wortlaut der Einwilligung, die Art (Kontrollkästchen, Double-Opt-in).'));
  b.push(tbl([['Betroffene Person', 'Zweck', 'Datum und Art der Erteilung', 'Wortlaut', 'Widerruf'], ['', '', '', '', '']]));
  return b;
}

/* ── D6 Datenschutzinformation für Beschäftigte ─────────────────────────── */
export function d6Zamestnanci(d) {
  const f = d.firma || {};
  const b = [];
  b.push(h(1, 'Datenschutzinformation für Beschäftigte'));
  b.push(p(`nach Art. 13 DSGVO und § 26 BDSG. Arbeitgeber und Verantwortlicher: ${firma(d) || '[Unternehmen]'}${kontakt(d) ? ', ' + kontakt(d) : ''}. Datenschutzbeauftragter: ${beauftragter(d) || 'nicht bestellt; wenden Sie sich an die Geschäftsführung'}.`));
  b.push(h(2, '1. Zwecke und Rechtsgrundlagen'));
  b.push(tbl([
    ['Zweck', 'Rechtsgrundlage', 'Daten'],
    ['Abschluss und Erfüllung des Arbeitsvertrags oder einer Vereinbarung', 'Art. 6 Abs. 1 lit. b DSGVO i. V. m. § 26 Abs. 1 BDSG', 'Identifikations- und Kontaktdaten, Ausbildung, Berufserfahrung, Kontoverbindung'],
    ['Lohn- und Gehaltsabrechnung, Abgaben, Steuern, Sozial- und Krankenversicherung', 'Art. 6 Abs. 1 lit. c DSGVO; Einkommensteuergesetz, Sozialgesetzbuch IV, Sozialversicherungsrecht', 'Sozialversicherungsnummer, Lohndaten, Angaben zu Angehörigen für steuerliche Freibeträge'],
    ['Arbeitssicherheit und Gesundheitsschutz, betriebsärztliche Betreuung', 'Art. 6 Abs. 1 lit. c DSGVO; Arbeitsschutzgesetz, Arbeitssicherheitsgesetz', 'Angaben zur gesundheitlichen Eignung im gesetzlich vorgesehenen Umfang (Art. 9 Abs. 2 lit. b DSGVO)'],
    ['Arbeitszeiterfassung', 'Art. 6 Abs. 1 lit. c DSGVO; § 16 Abs. 2 ArbZG', 'Beginn, Ende und Dauer der Arbeitszeit, Abwesenheiten'],
    ['dienstliche E-Mail, Systemzugänge, Diensttelefon', 'Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am Betrieb des Unternehmens)', 'Anmeldedaten, Zugriffsprotokolle'],
    ...(ma(d, 'kamery') ? [['Videoüberwachung am Standort', 'Art. 6 Abs. 1 lit. f DSGVO i. V. m. § 4 BDSG; Mitbestimmung des Betriebsrats nach § 87 Abs. 1 Nr. 6 BetrVG, sofern ein Betriebsrat besteht', 'Bildaufnahmen im überwachten Bereich, nicht am Arbeitsplatz ohne gewichtigen Grund']] : []),
  ]));
  b.push(h(2, '2. Empfänger'));
  b.push(ul(['Krankenkassen, Sozialversicherungsträger, Finanzamt, Agentur für Arbeit', 'Lohnbüro oder Steuerberater (Auftragsverarbeiter)', 'Anbieter der betriebsärztlichen Versorgung', 'Bank bei der Lohn- und Gehaltszahlung', 'Anbieter von Software für Zeiterfassung und Personalwesen (Auftragsverarbeiter)']));
  b.push(h(2, '3. Speicherdauer'));
  b.push(p(`Die Personalakte wird für die Dauer des Beschäftigungsverhältnisses geführt; danach nach betrieblichem Aktenplan und gesetzlichen Fristen: Lohnkonto 6 Kalenderjahre nach § 41 Abs. 1 EStG, Entgeltunterlagen der Sozialversicherung bis zum Ende des Kalenderjahres nach der nächsten Betriebsprüfung nach § 28f SGB IV. Im Formular eingestellt: ${lehota(d, 'zamestnanci')}.`));
  b.push(h(2, '4. Überwachung'));
  b.push(p(`Der Arbeitgeber ${ma(d, 'kamery') ? 'setzt eine Videoüberwachung zum Schutz des Eigentums und zur Sicherheit von Personen in folgenden Bereichen ein: [Bereiche angeben]. Kameras erfassen keine Umkleiden, Toiletten oder Pausenräume. Die Aufnahmen werden ' + lehota(d, 'kamery') + ' gespeichert. Sofern ein Betriebsrat besteht, wurde er nach § 87 Abs. 1 Nr. 6 BetrVG beteiligt.' : 'setzt am Arbeitsplatz keine Videoüberwachung ein.'} Der Arbeitgeber kontrolliert keine private Korrespondenz der Beschäftigten; dienstliche E-Mails und Geräte dürfen nur im für den Betrieb erforderlichen Umfang, aus einem gewichtigen Grund und nach vorheriger Information über Umfang und Art der Kontrolle eingesehen werden.`));
  b.push(h(2, '5. Ihre Rechte'));
  b.push(p(`Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Übertragbarkeit und Widerspruch nach Art. 15 bis 21 DSGVO sowie das Recht auf Beschwerde bei ${AUFSICHT}. Anfragen richten Sie bitte an: ${f.email || '[E-Mail]'}. Die Bereitstellung der Daten für Zwecke des Beschäftigungsverhältnisses und gesetzlicher Pflichten ist erforderlich; ohne sie können wir das Beschäftigungsverhältnis weder begründen noch durchführen.`));
  b.push(p('Erhalt bestätigt: Name ______________________ Datum __________ Unterschrift ______________________'));
  return b;
}

/* ── D7 Interne Datenschutzrichtlinie und Verpflichtung auf Vertraulichkeit ── */
export function d7Smernica(d) {
  const f = d.firma || {};
  const c = cinnosti(d);
  const b = [];
  b.push(h(1, 'Interne Datenschutzrichtlinie'));
  b.push(p(`${firma(d) || '[Unternehmen]'}. Gültig ab ${datum(d.datum) || '[Datum]'}. Freigegeben durch: ${f.zastupca || '[Geschäftsführer]'}.`));
  b.push(h(2, '1. Zweck der Richtlinie'));
  b.push(p('Diese Richtlinie legt fest, wie das Unternehmen und seine Mitarbeitenden mit personenbezogenen Daten umgehen, damit die Verarbeitung rechtmäßig, sicher und nachweisbar ist (Art. 5 Abs. 2 und Art. 24 DSGVO).'));
  b.push(h(2, '2. Grundsätze (Art. 5 DSGVO)'));
  b.push(ul(['Rechtmäßigkeit, Verarbeitung nach Treu und Glauben und Transparenz: jede Verarbeitung hat eine Rechtsgrundlage, betroffene Personen wissen davon,', 'Zweckbindung: Daten werden nur für den Zweck verwendet, zu dem sie erhoben wurden,', 'Datenminimierung: wir erheben nur, was wir benötigen,', 'Richtigkeit: unrichtige Daten werden berichtigt,', 'Speicherbegrenzung: Daten werden nach Ablauf der im Verzeichnis genannten Frist gelöscht,', 'Integrität und Vertraulichkeit: Zugriff haben nur befugte Personen, Daten sind geschützt.']));
  b.push(h(2, '3. Rollen'));
  b.push(tbl([['Rolle', 'Wer', 'Verantwortlich für'], ['Geschäftsführung', f.zastupca || '[Geschäftsführer]', 'Freigabe der Richtlinie und der Verträge mit Auftragsverarbeitern, Entscheidungen bei Verletzungen'], ['Datenschutzbeauftragter', beauftragter(d) || 'nicht bestellt', 'Beratung, Kontakt zur Aufsichtsbehörde und zu betroffenen Personen; Bestellpflicht nach Art. 37 DSGVO und § 38 BDSG (in der Regel ab mindestens 20 Personen, die ständig mit automatisierter Verarbeitung personenbezogener Daten beschäftigt sind)'], ['befugte Personen', 'Mitarbeitende mit Datenzugriff laut Berechtigung', 'Einhaltung dieser Richtlinie']]));
  b.push(h(2, '4. Verarbeitungstätigkeiten'));
  b.push(p(c.length ? 'Das Unternehmen führt ein Verzeichnis von Verarbeitungstätigkeiten (eigenständiges Dokument). Tätigkeiten: ' + c.map((x) => x.nazov).join('; ') + '.' : 'Das Unternehmen führt ein Verzeichnis von Verarbeitungstätigkeiten (eigenständiges Dokument).'));
  b.push(h(2, '5. Regeln für Mitarbeitende'));
  b.push(ul([
    'jede Person hat eigene Anmeldedaten, Passwörter werden nicht geteilt oder notiert; wo möglich, ist die Zwei-Faktor-Authentifizierung aktiviert,',
    'personenbezogene Daten werden nicht über private E-Mail-Konten oder private Messenger-Apps versendet,',
    'Dokumente mit personenbezogenen Daten werden nicht auf privaten Geräten gespeichert; beim Verlassen des Arbeitsplatzes wird der Bildschirm gesperrt,',
    'Papierdokumente werden in einem abschließbaren Schrank aufbewahrt; nicht mehr benötigte werden vernichtet,',
    'Daten werden an Dritte nur mit Rechtsgrundlage und nach Prüfung der Identität der anfragenden Person herausgegeben,',
    'jeder Verdacht auf eine Verletzung (Verlust eines Geräts, fehlgeleitete E-Mail, Datenabfluss) wird der Geschäftsführung sofort, spätestens innerhalb von 24 Stunden, gemeldet,',
    'Anfragen betroffener Personen werden am Tag des Eingangs an die Geschäftsführung oder den Datenschutzbeauftragten weitergeleitet,',
    'neue Werkzeuge, die personenbezogene Daten verarbeiten, werden erst nach Abschluss eines Auftragsverarbeitungsvertrags und Ergänzung des Verzeichnisses eingeführt.',
  ]));
  b.push(h(2, '6. Auftragsverarbeiter'));
  b.push(p('Mit jedem Dienstleister, der personenbezogene Daten für das Unternehmen verarbeitet, wird ein Vertrag nach Art. 28 DSGVO geschlossen (eigene Vorlage oder Bedingungen des Anbieters, die Art. 28 erfüllen). Die Liste befindet sich im Verzeichnis von Verarbeitungstätigkeiten.'));
  b.push(h(2, '7. Sicherheit (Art. 32 DSGVO)'));
  b.push(ul(['Zugriffe nach Rolle, Entzug der Zugriffe am Tag des Ausscheidens,', 'aktualisierte Software, Virenschutz, verschlüsselte Notebook-Festplatten,', 'Datensicherung mindestens einmal wöchentlich, geprüfte Wiederherstellung mindestens einmal jährlich,', 'HTTPS auf der Website, Kundenpasswörter nur verschlüsselt gespeichert,', 'Dokumentation von Verletzungen und jährliche Überprüfung dieser Richtlinie.']));
  b.push(h(2, '8. Belehrung und Verpflichtung auf Vertraulichkeit (Muster)'));
  b.push(p('Name: ______________________ Position: ______________________'));
  b.push(p('Ich wurde über meine Pflichten bei der Verarbeitung personenbezogener Daten nach der DSGVO, dem BDSG und dieser Richtlinie sowie über den Umfang meiner Berechtigung (Systeme: ______________________) belehrt. Die Vertraulichkeitspflicht folgt aus Art. 5, Art. 28 Abs. 3 lit. b und Art. 32 DSGVO sowie dieser Richtlinie und gilt auch nach Beendigung der Tätigkeit fort.'));
  b.push(p('In ____________ am ____________   Unterschrift ______________________'));
  return b;
}

/* ── D8 Verfahren bei Datenschutzverletzungen ───────────────────────────── */
export function d8Porusenie(d) {
  const f = d.firma || {};
  const b = [];
  b.push(h(1, 'Verfahren bei Verletzungen des Schutzes personenbezogener Daten'));
  b.push(p(`${firma(d) || '[Unternehmen]'}. Nach Art. 33 und 34 DSGVO. Verantwortlich: ${f.zastupca || '[Geschäftsführer]'}${beauftragter(d) ? ', Datenschutzbeauftragter ' + beauftragter(d) : ''}.`));
  b.push(h(2, '1. Was ist eine Verletzung'));
  b.push(p('Eine Verletzung liegt bei jedem Ereignis vor, bei dem personenbezogene Daten unbeabsichtigt oder unrechtmäßig vernichtet, verloren, verändert oder unbefugt offengelegt werden oder sich jemand unbefugt Zugang verschafft (Art. 4 Nr. 12 DSGVO): ein verlorenes Notebook, eine an den falschen Empfänger gesendete E-Mail, ein Datenbankleck, Ransomware, eine Mitarbeiterin oder ein Mitarbeiter, die oder der ohne Grund Daten einsieht.'));
  b.push(h(2, '2. Vorgehen Schritt für Schritt'));
  b.push(tbl([
    ['Schritt', 'Wann', 'Wer', 'Was'],
    ['1. Stoppen und sichern', 'sofort', 'wer immer es bemerkt', 'Gerät trennen, Passwörter ändern, Zugang sperren, keine Beweise vernichten'],
    ['2. Intern melden', 'binnen 24 Stunden', 'wer immer es bemerkt', 'an die Geschäftsführung oder den Datenschutzbeauftragten: was, wann, wessen Daten, wie viele'],
    ['3. Risiko bewerten', 'binnen 48 Stunden', 'Geschäftsführung', 'welche Daten, wie viele Personen, welche Folgen (finanzieller Schaden, Diskriminierung, Identitätsdiebstahl), ob die Daten verschlüsselt sind'],
    ['4. Aufsichtsbehörde melden', 'binnen 72 Stunden nach Bekanntwerden', 'Geschäftsführung', 'wenn die Verletzung voraussichtlich zu einem Risiko für die Rechte der Personen führt: ' + AUFSICHT + ' (Art. 33)'],
    ['5. Betroffene Personen benachrichtigen', 'unverzüglich', 'Geschäftsführung', 'bei hohem Risiko: in klarer Sprache, was geschehen ist, welche Folgen drohen, was wir tun und was zu tun ist (Art. 34)'],
    ['6. Dokumentieren', 'immer, auch ohne Meldung', 'Geschäftsführung', 'in der Dokumentation unten: Fakten, Folgen, Maßnahmen (Art. 33 Abs. 5)'],
    ['7. Lernen', 'binnen 30 Tagen', 'Geschäftsführung', 'was zu ändern ist, damit es sich nicht wiederholt; Richtlinie anpassen'],
  ]));
  b.push(h(2, '3. Muster für die Meldung an die Aufsichtsbehörde (Inhalt nach Art. 33 Abs. 3)'));
  b.push(ul(['Art der Verletzung, Kategorien und ungefähre Zahl der betroffenen Personen und Datensätze,', 'Name und Kontaktdaten des Datenschutzbeauftragten oder einer anderen Kontaktstelle,', 'wahrscheinliche Folgen,', 'ergriffene und vorgeschlagene Maßnahmen einschließlich Maßnahmen zur Minderung der Folgen.']));
  b.push(h(2, '4. Muster für die Benachrichtigung betroffener Personen'));
  b.push(p(`Guten Tag, am [Datum] kam es bei ${f.nazov || '[Unternehmen]'} zu [Beschreibung: z. B. unbefugtem Zugriff auf die Kundendatenbank]. Betroffen waren folgende Ihrer Daten: [Liste]. Mögliche Folgen: [z. B. betrügerische E-Mails in Ihrem Namen]. Was wir getan haben: [z. B. Zugang gesperrt, Passwörter geändert, Meldung an die Aufsichtsbehörde]. Was wir Ihnen empfehlen: [z. B. Passwort ändern, keine verdächtigen E-Mails öffnen]. Kontakt: ${f.email || '[E-Mail]'}${beauftragter(d) ? ', Datenschutzbeauftragter ' + beauftragter(d) : ''}.`));
  b.push(h(2, '5. Dokumentation der Verletzungen'));
  b.push(tbl([['Datum des Bekanntwerdens', 'Was geschah', 'Daten und Zahl der Personen', 'Risiko', 'Aufsichtsbehörde gemeldet (Datum)', 'Personen benachrichtigt', 'Maßnahmen'], ['', '', '', '', '', '', '']]));
  return b;
}

/* ── D9 Verfahren für Betroffenenanfragen ───────────────────────────────── */
export function d9Ziadosti(d) {
  const f = d.firma || {};
  const b = [];
  b.push(h(1, 'Verfahren für die Bearbeitung von Anfragen betroffener Personen'));
  b.push(p(`${firma(d) || '[Unternehmen]'}. Nach Art. 12 und 15 bis 22 DSGVO. Anfragen nimmt entgegen: ${f.email || '[E-Mail]'}${beauftragter(d) ? ', Datenschutzbeauftragter ' + beauftragter(d) : ''}.`));
  b.push(h(2, '1. Fristen'));
  b.push(p('Antwort binnen **eines Monats** nach Eingang der Anfrage. Bei komplexen oder zahlreichen Anfragen kann die Frist um weitere zwei Monate verlängert werden; über die Verlängerung und die Gründe ist die Person innerhalb eines Monats zu informieren (Art. 12 Abs. 3). Die Bearbeitung ist unentgeltlich; bei offensichtlich unbegründeten oder exzessiven Anfragen kann ein angemessenes Entgelt verlangt oder die Bearbeitung abgelehnt werden (Art. 12 Abs. 5).'));
  b.push(h(2, '2. Vorgehen'));
  b.push(ul(['Anfrage am Tag des Eingangs dokumentieren (Datum, wer, was verlangt wird, über welchen Kanal),', 'bei Zweifeln die Identität prüfen (Antwort an die E-Mail-Adresse, über die die Daten erhoben wurden, oder eine Zusatzfrage; eine Ausweiskopie nur verlangen, wenn es wirklich nötig ist),', 'Daten in allen Systemen suchen (Online-Shop, E-Mail, Buchhaltung, Newsletter, Backups) sowie bei Auftragsverarbeitern,', 'prüfen, ob das Recht ausgeübt werden kann (z. B. ist eine Löschung nicht möglich bei Daten, die nach Handels- oder Steuerrecht aufbewahrt werden müssen),', 'schriftlich, verständlich und im selben Kanal antworten, sofern die Person nichts anderes wünscht,', 'die Bearbeitung dokumentieren.']));
  b.push(h(2, '3. Inhalt der Antwort auf ein Auskunftsersuchen (Art. 15)'));
  b.push(ul(['Verarbeitungszwecke und Rechtsgrundlagen,', 'Kategorien der Daten und eine Kopie der Daten,', 'Empfänger oder Kategorien von Empfängern, Übermittlung in Drittländer und Garantien,', 'Speicherdauer,', 'Bestehen der Rechte auf Berichtigung, Löschung, Einschränkung, Widerspruch und Beschwerde,', 'Herkunft der Daten, sofern sie nicht von der betroffenen Person stammen,', 'Bestehen einer automatisierten Entscheidungsfindung.']));
  b.push(h(2, '4. Musterantwort'));
  b.push(p(`Guten Tag, wir bestätigen den Eingang Ihrer Anfrage vom [Datum] auf [Auskunft / Berichtigung / Löschung / Einschränkung / Übertragung / Widerspruch]. [Auskunft:] Anbei senden wir Ihnen eine Kopie der Daten, die wir über Sie verarbeiten, zusammen mit den Angaben nach Art. 15 DSGVO. [Löschung:] Wir haben Ihre Daten aus allen Systemen gelöscht, mit Ausnahme von [Buchungsbelegen], die wir nach § 147 AO / § 257 HGB bis [Datum] aufbewahren müssen. [Widerspruch gegen Marketing:] Ihre E-Mail-Adresse haben wir aus dem Verteiler entfernt; weitere Marketing-Nachrichten erhalten Sie nicht mehr. Wenn Sie mit der Bearbeitung nicht einverstanden sind, können Sie sich an ${AUFSICHT} wenden. Mit freundlichen Grüßen, ${f.nazov || '[Unternehmen]'}`));
  b.push(h(2, '5. Dokumentation der Anfragen'));
  b.push(tbl([['Datum des Eingangs', 'Wer', 'Recht', 'Identitätsprüfung', 'Erledigt am', 'Wie'], ['', '', '', '', '', '']]));
  return b;
}

/* ── D10 Videoüberwachung ───────────────────────────────────────────────── */
export function d10Kamery(d) {
  const f = d.firma || {};
  const b = [];
  b.push(h(1, 'Videoüberwachung: Hinweisschild und Dokumentation'));
  b.push(h(2, 'A. Hinweisschild (erste Ebene, vor dem Zugang zum überwachten Bereich anzubringen)'));
  b.push(p('DIESER BEREICH WIRD VIDEOÜBERWACHT UND DIE AUFNAHMEN WERDEN GESPEICHERT'));
  b.push(p(`Verantwortlicher: ${f.nazov || '[Unternehmen]'}, ${f.sidlo || '[Sitz]'}. Zweck: Schutz des Eigentums und Sicherheit von Personen (berechtigtes Interesse, Art. 6 Abs. 1 lit. f DSGVO i. V. m. § 4 BDSG). Die Aufnahmen speichern wir ${lehota(d, 'kamery')}. Ihre Rechte und die vollständige Information: ${f.web ? f.web + '/datenschutz' : '[Website]'} oder ${f.email || '[E-Mail]'}.`));
  b.push(h(2, 'B. Vollständige Information (zweite Ebene, auf der Website oder am Empfang)'));
  b.push(tbl([
    ['Position', 'Inhalt'],
    ['Verantwortlicher', firma(d) || '[Unternehmen]'],
    ['Zweck', 'Schutz des Eigentums des Verantwortlichen und Sicherheit von Personen, Beweissicherung bei rechtswidrigem Verhalten'],
    ['Rechtsgrundlage', 'Art. 6 Abs. 1 lit. f DSGVO i. V. m. § 4 BDSG; berechtigtes Interesse des Verantwortlichen (Abwägung unten)'],
    ['Überwachte Bereiche', '[z. B. Verkaufsraum, Lager, Eingang; nicht Umkleiden, Toiletten, Pausenräume]'],
    ['Speicherdauer', lehota(d, 'kamery')],
    ['Empfänger', 'Polizei, Gerichte und Versicherung bei der Geltendmachung von Ansprüchen; Sicherheitsdienst, sofern dieser als Auftragsverarbeiter eingesetzt wird'],
    ['Rechte', 'Auskunft, Löschung, Einschränkung, Widerspruch (Art. 15 bis 21 DSGVO); Beschwerde bei ' + AUFSICHT],
  ]));
  b.push(h(2, 'C. Interessenabwägung (Balancetest nach § 4 Abs. 1 BDSG)'));
  b.push(ul(['Interesse: Schutz von Waren und Einrichtungen im Wert von [Betrag], Sicherheit von Kundinnen, Kunden und Beschäftigten; in der Vergangenheit [Vorfälle angeben, sofern vorhanden].', 'Erforderlichkeit: mildere Mittel (Schlösser, Alarmanlage, Aufsicht) reichen zur Beweissicherung nicht aus; die Kameras sind auf [Bereiche] und die Zeit [durchgehend / Öffnungszeiten] beschränkt.', 'Abwägung: die Aufnahmen werden kurz gespeichert, Zugriff haben [wer], die Beschäftigten wurden informiert und, sofern ein Betriebsrat besteht, wurde dessen Mitbestimmungsrecht nach § 87 Abs. 1 Nr. 6 BetrVG beachtet, Hinweisschilder befinden sich am Eingang. Das Interesse überwiegt.']));
  b.push(h(2, 'D. Eintrag in das Verzeichnis von Verarbeitungstätigkeiten'));
  b.push(p('Die Videoüberwachung ist im Verzeichnis von Verarbeitungstätigkeiten erfasst (eigenständiges Dokument). Zugriff auf die Aufnahmen: [Namen oder Funktionen]. Kontrolle der Einstellungen und der Löschung: einmal je [3 Monate].'));
  return b;
}

export const DOKUMENTY = [
  { id: 'd1', nazov: 'Datenschutzerklärung', popis: 'Informationspflicht nach Art. 13 DSGVO für Website, Online-Shop und Kunden', fn: d1Zasady, zadarmo: true },
  { id: 'd2', nazov: 'Cookie-Richtlinie und Cookie-Banner-Text', popis: '§ 25 TDDDG (vormals TTDSG)', fn: d2Cookies },
  { id: 'd3', nazov: 'Verzeichnis von Verarbeitungstätigkeiten', popis: 'Art. 30 DSGVO, eine Tabelle je Tätigkeit', fn: d3Zaznamy },
  { id: 'd4', nazov: 'Auftragsverarbeitungsvertrag', popis: 'Art. 28 DSGVO, mit Anlagen', fn: d4Zmluva },
  { id: 'd5', nazov: 'Einwilligungen und Formulartexte', popis: 'Newsletter, Kontakt, Bestellung, Bewerber, schriftliche Einwilligung, Dokumentation', fn: d5Suhlas },
  { id: 'd6', nazov: 'Datenschutzinformation für Beschäftigte', popis: 'Art. 13 DSGVO und § 26 BDSG', fn: d6Zamestnanci, len: 'zamestnanci' },
  { id: 'd7', nazov: 'Interne Datenschutzrichtlinie und Verpflichtung auf Vertraulichkeit', popis: 'Regeln für Mitarbeitende, Rollen, Sicherheit', fn: d7Smernica },
  { id: 'd8', nazov: 'Verfahren bei Datenschutzverletzungen', popis: 'Art. 33 und 34 DSGVO, 72 Stunden, Mustertexte, Dokumentation', fn: d8Porusenie },
  { id: 'd9', nazov: 'Verfahren für Betroffenenanfragen', popis: 'Art. 15 bis 22 DSGVO, Fristen, Musterantwort, Dokumentation', fn: d9Ziadosti },
  { id: 'd10', nazov: 'Videoüberwachung', popis: 'Hinweisschild, Information, Interessenabwägung, § 4 BDSG', fn: d10Kamery, len: 'kamery' },
];

/* Dokumente, die das Unternehmen entsprechend den angekreuzten Feldern erhält. */
export function zoznamDokumentov(d) {
  return DOKUMENTY.filter((x) => !x.len || ma(d, x.len));
}
