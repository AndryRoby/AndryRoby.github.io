/* GDPR dokumenty pre slovenskú firmu: šablóny.
 *
 * Každý dokument je funkcia, ktorá z údajov formulára (d) vráti zoznam
 * blokov: { h: úroveň, t: text }, { p: text }, { ul: [texty] },
 * { tbl: [[bunky], ...] } (prvý riadok je hlavička). Ten istý zoznam
 * kreslí náhľad na stránke (app.js) aj súbor DOCX (docx.js), takže obe
 * podoby sú vždy rovnaké. V texte je **tučné** medzi dvoma hviezdičkami.
 *
 * Právne opory (uvádzajú sa aj v dokumentoch, aby si ich firma vedela
 * overiť): nariadenie (EÚ) 2016/679 (GDPR), zákon č. 18/2018 Z. z.
 * o ochrane osobných údajov, zákon č. 452/2021 Z. z. o elektronických
 * komunikáciách (§ 109 ods. 8, cookies), zákon č. 431/2002 Z. z.
 * o účtovníctve (§ 35, uchovávanie 10 rokov), zákon č. 311/2001 Z. z.
 * Zákonník práce (§ 13 ods. 4, monitorovanie zamestnancov).
 * Dozorný orgán: Úrad na ochranu osobných údajov SR, Hraničná 12,
 * 820 07 Bratislava 27, statny.dozor@pdp.gov.sk (slovensko.sk, 10. 9. 2026).
 *
 * Toto nie je právne poradenstvo. Texty sú všeobecné vzory vyplnené údajmi
 * firmy; firma ich má prečítať a upraviť podľa toho, čo skutočne robí.
 */

export const NASTROJE = [
  { id: 'ga4', nazov: 'Google Analytics', kto: 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Írsko', ucel: 'meranie návštevnosti webu', kategoria: 'analytika', usa: true, cookies: 'analyticke' },
  { id: 'umami', nazov: 'Umami alebo iná analytika bez cookies na vlastnom serveri', kto: 'prevádzkovateľ (vlastný server)', ucel: 'anonymné meranie návštevnosti', kategoria: 'analytika', usa: false },
  { id: 'meta', nazov: 'Meta Pixel (Facebook, Instagram)', kto: 'Meta Platforms Ireland Limited, Merrion Road, Dublin 4, Írsko', ucel: 'meranie a cielenie reklamy', kategoria: 'marketing', usa: true, cookies: 'marketingove' },
  { id: 'gads', nazov: 'Google Ads (konverzie, remarketing)', kto: 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Írsko', ucel: 'meranie a cielenie reklamy', kategoria: 'marketing', usa: true, cookies: 'marketingove' },
  { id: 'stripe', nazov: 'Stripe (platby kartou)', kto: 'Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Dublin 2, Írsko', ucel: 'spracovanie platieb', kategoria: 'platby', usa: true },
  { id: 'gopay', nazov: 'GoPay (platobná brána)', kto: 'GOPAY s.r.o., Planá 67, 370 01 České Budějovice, Česká republika', ucel: 'spracovanie platieb', kategoria: 'platby', usa: false },
  { id: 'besteron', nazov: 'Besteron alebo iná slovenská platobná brána', kto: 'poskytovateľ platobnej brány podľa zmluvy', ucel: 'spracovanie platieb', kategoria: 'platby', usa: false },
  { id: 'packeta', nazov: 'Packeta (Zásielkovňa)', kto: 'Packeta Slovakia s. r. o., Kopčianska 3338/82A, 851 01 Bratislava', ucel: 'doručenie zásielok', kategoria: 'doprava', usa: false },
  { id: 'gls', nazov: 'GLS', kto: 'GLS General Logistics Systems Slovakia s.r.o., Budča 1039, 962 33 Budča', ucel: 'doručenie zásielok', kategoria: 'doprava', usa: false },
  { id: 'posta', nazov: 'Slovenská pošta', kto: 'Slovenská pošta, a. s., Partizánska cesta 9, 975 99 Banská Bystrica', ucel: 'doručenie zásielok', kategoria: 'doprava', usa: false },
  { id: 'dhl', nazov: 'DHL, DPD, UPS alebo iný kuriér', kto: 'kuriérska spoločnosť podľa zmluvy', ucel: 'doručenie zásielok', kategoria: 'doprava', usa: false },
  { id: 'mailchimp', nazov: 'Mailchimp (newsletter)', kto: 'Intuit Inc. (Mailchimp), 2700 Coast Avenue, Mountain View, CA 94043, USA', ucel: 'rozosielanie newslettera', kategoria: 'marketing', usa: true },
  { id: 'ecomail', nazov: 'Ecomail (newsletter)', kto: 'ECOMAIL.CZ, s.r.o., Na Zderaze 1275/15, 120 00 Praha 2, Česká republika', ucel: 'rozosielanie newslettera', kategoria: 'marketing', usa: false },
  { id: 'shoptet', nazov: 'Shoptet (platforma e-shopu)', kto: 'Shoptet, a.s., Dvořeckého 628/8, 169 00 Praha 6, Česká republika', ucel: 'prevádzka e-shopu a uloženie objednávok', kategoria: 'hosting', usa: false },
  { id: 'websupport', nazov: 'Websupport (hosting, e-mail)', kto: 'Websupport, s. r. o., Karadžičova 12, 821 08 Bratislava', ucel: 'hosting webu a e-mailu', kategoria: 'hosting', usa: false },
  { id: 'hosting', nazov: 'Iný hosting alebo platforma e-shopu (WooCommerce, Shopify, Wix…)', kto: 'poskytovateľ hostingu podľa zmluvy', ucel: 'hosting webu, uloženie objednávok a účtov', kategoria: 'hosting', usa: false },
  { id: 'gworkspace', nazov: 'Google Workspace (Gmail, Drive)', kto: 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Írsko', ucel: 'e-mail a uloženie dokumentov', kategoria: 'kancelária', usa: true },
  { id: 'm365', nazov: 'Microsoft 365 (Outlook, OneDrive)', kto: 'Microsoft Ireland Operations Limited, One Microsoft Place, South County Business Park, Leopardstown, Dublin 18, Írsko', ucel: 'e-mail a uloženie dokumentov', kategoria: 'kancelária', usa: true },
  { id: 'uctovnik', nazov: 'Externý účtovník alebo mzdová firma', kto: 'účtovná firma podľa zmluvy', ucel: 'vedenie účtovníctva a miezd', kategoria: 'účtovníctvo', usa: false },
  { id: 'fakturacia', nazov: 'Fakturačný program (SuperFaktúra, iDoklad, Fakturoid…)', kto: 'poskytovateľ fakturačného programu podľa zmluvy', ucel: 'vystavovanie faktúr', kategoria: 'účtovníctvo', usa: false },
];

export const LEHOTY_PREDVOLENE = {
  objednavky: '10 rokov od konca roka, v ktorom bol doklad vystavený (zákon č. 431/2002 Z. z. o účtovníctve, § 35)',
  kontakt: '1 rok od vybavenia dopytu',
  newsletter: 'do odvolania súhlasu, najviac 3 roky od posledného otvorenia e-mailu',
  ucty: 'po dobu trvania účtu a 1 rok po jeho zrušení',
  uchadzaci: 'do skončenia výberového konania; so súhlasom uchádzača najviac 1 rok',
  zamestnanci: 'po dobu pracovného pomeru a potom podľa zákona (mzdové listy 50 rokov, osobný spis podľa registratúrneho plánu)',
  kamery: '15 dní od vyhotovenia záznamu, ak sa záznam nepoužije na účel dokazovania',
};

export const CINNOSTI = [
  { id: 'eshop', nazov: 'Objednávky a predaj (e-shop alebo faktúry zákazníkom)' },
  { id: 'kontakt', nazov: 'Kontaktný formulár, e-mail a telefonické dopyty' },
  { id: 'newsletter', nazov: 'Newsletter a marketingové e-maily' },
  { id: 'ucty', nazov: 'Používateľské účty na webe' },
  { id: 'analytika', nazov: 'Meranie návštevnosti webu' },
  { id: 'socialne', nazov: 'Profily na sociálnych sieťach (Facebook, Instagram, LinkedIn)' },
  { id: 'zamestnanci', nazov: 'Zamestnanci a dohodári' },
  { id: 'uchadzaci', nazov: 'Uchádzači o zamestnanie' },
  { id: 'kamery', nazov: 'Kamerový systém v prevádzke' },
];

const h = (l, t) => ({ h: l, t });
const p = (t) => ({ p: t });
const ul = (x) => ({ ul: x });
const tbl = (rows) => ({ tbl: rows });

function datumSK(iso) {
  const [y, m, dd] = (iso || '').split('-');
  return y ? `${+dd}. ${+m}. ${y}` : '';
}
function firma(d) {
  const f = d.firma || {};
  const casti = [f.nazov, f.sidlo ? 'so sídlom ' + f.sidlo : '', f.ico ? 'IČO ' + f.ico : ''].filter(Boolean);
  return casti.join(', ');
}
function kontakt(d) {
  const f = d.firma || {};
  return [f.email ? 'e-mail ' + f.email : '', f.telefon ? 'telefón ' + f.telefon : ''].filter(Boolean).join(', ');
}
const ma = (d, id) => !!(d.cinnosti && d.cinnosti[id]);
const nastroje = (d) => NASTROJE.filter((n) => (d.nastroje || []).includes(n.id));
const prenosUSA = (d) => nastroje(d).some((n) => n.usa) || d.prenosMimoEU === 'ano';
const lehota = (d, k) => (d.lehoty && d.lehoty[k]) || LEHOTY_PREDVOLENE[k];
function zodpovedna(d) {
  const z = d.zodpovednaOsoba || {};
  if (!z.ma) return null;
  return [z.meno, z.email].filter(Boolean).join(', ');
}

/* Spracovateľské činnosti firmy podľa zaškrtnutých políčok: jeden zdroj pre
 * zásady (D1), záznamy (D3) aj smernicu (D7). */
export function cinnosti(d) {
  const out = [];
  const f = d.firma || {};
  if (ma(d, 'eshop')) out.push({
    id: 'eshop', nazov: 'Predaj tovaru a služieb, vybavenie objednávky',
    ucel: 'uzavretie a plnenie zmluvy so zákazníkom, doručenie, vybavenie reklamácie, vystavenie daňového dokladu',
    zaklad: 'čl. 6 ods. 1 písm. b) GDPR (plnenie zmluvy) a čl. 6 ods. 1 písm. c) GDPR (zákonná povinnosť: účtovníctvo, dane, reklamácie)',
    udaje: 'meno a priezvisko, fakturačná a dodacia adresa, e-mail, telefón, údaje o objednávke a platbe (nie číslo karty), IČO, DIČ a IČ DPH pri firemných zákazníkoch',
    dotknuti: 'zákazníci',
    prijemcovia: ['dopravcovia', 'poskytovateľ platobnej brány', 'účtovník', 'poskytovateľ hostingu alebo platformy e-shopu', 'daňový úrad a iné orgány na základe zákona'],
    lehota: lehota(d, 'objednavky'),
  });
  if (ma(d, 'kontakt')) out.push({
    id: 'kontakt', nazov: 'Vybavovanie dopytov (kontaktný formulár, e-mail, telefón)',
    ucel: 'odpoveď na otázku, príprava ponuky, komunikácia pred uzavretím zmluvy',
    zaklad: 'čl. 6 ods. 1 písm. b) GDPR (opatrenia pred uzavretím zmluvy na žiadosť dotknutej osoby) a čl. 6 ods. 1 písm. f) GDPR (oprávnený záujem odpovedať na dopyt)',
    udaje: 'meno, e-mail, telefón, obsah správy',
    dotknuti: 'ľudia, ktorí nás oslovia',
    prijemcovia: ['poskytovateľ hostingu a e-mailu'],
    lehota: lehota(d, 'kontakt'),
  });
  if (ma(d, 'newsletter')) out.push({
    id: 'newsletter', nazov: 'Newsletter a marketingové e-maily',
    ucel: 'zasielanie noviniek, ponúk a obsahu',
    zaklad: 'čl. 6 ods. 1 písm. a) GDPR (súhlas), pri existujúcich zákazníkoch čl. 6 ods. 1 písm. f) GDPR (oprávnený záujem, priamy marketing vlastných podobných produktov) s možnosťou kedykoľvek sa odhlásiť',
    udaje: 'e-mail, meno, údaje o otvorení a kliknutí v e-maile',
    dotknuti: 'odberatelia newslettera, zákazníci',
    prijemcovia: ['poskytovateľ nástroja na rozosielanie e-mailov'],
    lehota: lehota(d, 'newsletter'),
  });
  if (ma(d, 'ucty')) out.push({
    id: 'ucty', nazov: 'Používateľské účty',
    ucel: 'vedenie účtu, história objednávok, uloženie nastavení',
    zaklad: 'čl. 6 ods. 1 písm. b) GDPR (plnenie zmluvy o používaní účtu)',
    udaje: 'meno, e-mail, prihlasovacie údaje (heslo len v zašifrovanej podobe), adresa, história objednávok',
    dotknuti: 'registrovaní používatelia',
    prijemcovia: ['poskytovateľ hostingu alebo platformy'],
    lehota: lehota(d, 'ucty'),
  });
  if (ma(d, 'analytika')) out.push({
    id: 'analytika', nazov: 'Meranie návštevnosti webu',
    ucel: 'zistiť, koľko ľudí web navštívi, odkiaľ prišli a ktoré stránky používajú, a web zlepšovať',
    zaklad: (d.cookies && d.cookies.analyticke) ? 'čl. 6 ods. 1 písm. a) GDPR (súhlas udelený v cookie lište) a § 109 ods. 8 zákona č. 452/2021 Z. z.' : 'čl. 6 ods. 1 písm. f) GDPR (oprávnený záujem), meranie bez cookies a bez identifikácie osoby',
    udaje: (d.cookies && d.cookies.analyticke) ? 'IP adresa (skrátená), identifikátor cookie, prehliadač, zariadenie, navštívené stránky, zdroj návštevy' : 'skrátená IP adresa, prehliadač, zariadenie, navštívené stránky, zdroj návštevy; bez cookies a bez profilu osoby',
    dotknuti: 'návštevníci webu',
    prijemcovia: ['poskytovateľ analytického nástroja'],
    lehota: '14 mesiacov (agregované štatistiky bez väzby na osobu sa uchovávajú dlhšie)',
  });
  if (ma(d, 'socialne')) out.push({
    id: 'socialne', nazov: 'Profily na sociálnych sieťach',
    ucel: 'prezentácia firmy, komunikácia s ľuďmi, ktorí nás sledujú alebo nám píšu',
    zaklad: 'čl. 6 ods. 1 písm. f) GDPR (oprávnený záujem na prezentácii firmy); za spracúvanie na strane sociálnej siete zodpovedá jej prevádzkovateľ podľa vlastných zásad',
    udaje: 'verejný profil, komentáre, správy, reakcie',
    dotknuti: 'používatelia sociálnych sietí, ktorí s profilom pracujú',
    prijemcovia: ['prevádzkovateľ sociálnej siete (spoločný prevádzkovateľ pre štatistiky stránky)'],
    lehota: 'po dobu existencie profilu; správy 1 rok od vybavenia',
  });
  if (ma(d, 'zamestnanci')) out.push({
    id: 'zamestnanci', nazov: 'Zamestnanci a dohodári (personálna a mzdová agenda)',
    ucel: 'plnenie pracovnej zmluvy, mzdy, odvody, dane, BOZP, evidencia dochádzky',
    zaklad: 'čl. 6 ods. 1 písm. b) GDPR (pracovná zmluva) a čl. 6 ods. 1 písm. c) GDPR (Zákonník práce, zákon o sociálnom poistení, zákon o dani z príjmov, zákon o zdravotnom poistení)',
    udaje: 'identifikačné a kontaktné údaje, rodné číslo, číslo účtu, údaje o vzdelaní a praxi, mzdové údaje, dochádzka, údaje o zdravotnej spôsobilosti v rozsahu podľa zákona',
    dotknuti: 'zamestnanci, dohodári, ich rodinní príslušníci v rozsahu daňového bonusu',
    prijemcovia: ['Sociálna poisťovňa', 'zdravotné poisťovne', 'daňový úrad', 'mzdová alebo účtovná firma', 'poskytovateľ pracovnej zdravotnej služby'],
    lehota: lehota(d, 'zamestnanci'),
  });
  if (ma(d, 'uchadzaci')) out.push({
    id: 'uchadzaci', nazov: 'Uchádzači o zamestnanie',
    ucel: 'výber zamestnancov',
    zaklad: 'čl. 6 ods. 1 písm. b) GDPR (opatrenia pred uzavretím pracovnej zmluvy); uchovanie životopisu po skončení výberu len so súhlasom (čl. 6 ods. 1 písm. a) GDPR)',
    udaje: 'životopis, motivačný list, kontaktné údaje, údaje z pohovoru',
    dotknuti: 'uchádzači',
    prijemcovia: ['personálna agentúra, ak sa použije'],
    lehota: lehota(d, 'uchadzaci'),
  });
  if (ma(d, 'kamery')) out.push({
    id: 'kamery', nazov: 'Kamerový systém',
    ucel: 'ochrana majetku, bezpečnosť osôb a odhaľovanie protiprávneho konania v prevádzke',
    zaklad: 'čl. 6 ods. 1 písm. f) GDPR (oprávnený záujem na ochrane majetku a osôb); voči zamestnancom oznámenie podľa § 13 ods. 4 Zákonníka práce',
    udaje: 'obrazový záznam osôb v monitorovanom priestore, čas záznamu',
    dotknuti: 'zákazníci, návštevníci, zamestnanci v monitorovanom priestore',
    prijemcovia: ['polícia a súdy pri uplatnení práv'],
    lehota: lehota(d, 'kamery'),
  });
  return out;
}

/* Sprostredkovatelia a príjemcovia, ktorí sa uvádzajú v zásadách a v záznamoch. */
function prijemcoviaText(d) {
  const n = nastroje(d);
  const riadky = n.map((x) => `${x.nazov}: ${x.kto} (${x.ucel})`);
  if (d.nastrojeIne) riadky.push(d.nastrojeIne);
  return riadky;
}

/* ── D1 Zásady ochrany osobných údajov (zadarmo) ───────────────────────── */
export function d1Zasady(d) {
  const f = d.firma || {};
  const zo = zodpovedna(d);
  const c = cinnosti(d);
  const b = [];
  b.push(h(1, 'Zásady ochrany osobných údajov'));
  b.push(p(`Tieto zásady vysvetľujú, ako ${f.nazov || '[názov firmy]'} spracúva osobné údaje ľudí, ktorí používajú web ${f.web || '[web]'}, nakupujú u nás alebo s nami komunikujú. Platia od ${datumSK(d.datum) || '[dátum]'}.`));
  b.push(h(2, '1. Kto je prevádzkovateľ'));
  b.push(p(`Prevádzkovateľom osobných údajov je ${firma(d) || '[názov, sídlo, IČO]'}${kontakt(d) ? ', ' + kontakt(d) : ''}.`));
  if (zo) b.push(p(`Zodpovedná osoba pre ochranu osobných údajov: ${zo}. Môžete sa na ňu obrátiť s každou otázkou o spracúvaní vašich údajov.`));
  else b.push(p('Zodpovednú osobu podľa čl. 37 GDPR sme nemuseli určiť; s otázkami o osobných údajoch sa obráťte na kontakty vyššie.'));
  b.push(h(2, '2. Aké údaje spracúvame, prečo a na akom právnom základe'));
  if (!c.length) b.push(p('Vo formulári nebola vybraná žiadna činnosť. Vyberte aspoň jednu, aby mal tento článok obsah.'));
  for (const x of c) {
    b.push(h(3, x.nazov));
    b.push(p(`**Účel:** ${x.ucel}.`));
    b.push(p(`**Právny základ:** ${x.zaklad}.`));
    b.push(p(`**Údaje:** ${x.udaje}.`));
    b.push(p(`**Doba uchovávania:** ${x.lehota}.`));
  }
  b.push(h(2, '3. Komu údaje poskytujeme'));
  b.push(p('Osobné údaje nepredávame. Poskytujeme ich len tým, ktorí ich potrebujú na účely uvedené vyššie: sprostredkovateľom, ktorí pre nás pracujú na základe zmluvy podľa čl. 28 GDPR, a orgánom, ktorým to ukladá zákon.'));
  const pr = prijemcoviaText(d);
  if (pr.length) b.push(ul(pr));
  else b.push(p('Zoznam sprostredkovateľov: [doplňte podľa nástrojov a služieb, ktoré používate].'));
  b.push(h(2, '4. Prenos údajov mimo Európskej únie'));
  if (prenosUSA(d)) b.push(p('Niektorí z našich dodávateľov (napríklad poskytovatelia analytiky, reklamy, platieb alebo e-mailu) majú materské spoločnosti v USA a údaje sa môžu preniesť mimo Európskeho hospodárskeho priestoru. Prenos sa opiera o rozhodnutie Európskej komisie o primeranosti pre rámec EU-U.S. Data Privacy Framework (spoločnosti, ktoré sú v ňom certifikované) alebo o štandardné zmluvné doložky Európskej komisie podľa čl. 46 ods. 2 písm. c) GDPR. Kópiu doložiek vám na požiadanie poskytneme.'));
  else b.push(p('Osobné údaje neprenášame mimo Európskej únie a Európskeho hospodárskeho priestoru. Ak sa to zmení, tieto zásady doplníme a prenos zabezpečíme podľa kapitoly V GDPR.'));
  b.push(h(2, '5. Vaše práva'));
  b.push(p('Podľa GDPR máte právo:'));
  b.push(ul([
    'na prístup k údajom, ktoré o vás máme, a na ich kópiu (čl. 15),',
    'na opravu nesprávnych alebo neúplných údajov (čl. 16),',
    'na vymazanie, ak už údaje nepotrebujeme alebo ich spracúvame protiprávne (čl. 17),',
    'na obmedzenie spracúvania (čl. 18),',
    'na prenosnosť údajov, ktoré ste nám dali na základe súhlasu alebo zmluvy (čl. 20),',
    'namietať proti spracúvaniu založenému na oprávnenom záujme, vrátane priameho marketingu (čl. 21),',
    'kedykoľvek odvolať súhlas; odvolanie nemá vplyv na zákonnosť spracúvania pred ním (čl. 7 ods. 3),',
    'podať sťažnosť dozornému orgánu: Úrad na ochranu osobných údajov Slovenskej republiky, Hraničná 12, 820 07 Bratislava 27, statny.dozor@pdp.gov.sk, dataprotection.gov.sk (čl. 77).',
  ]));
  b.push(p(`Žiadosť pošlite na ${f.email || '[e-mail]'}. Odpovieme do jedného mesiaca; pri zložitej žiadosti môžeme lehotu predĺžiť o ďalšie dva mesiace a dáme vám o tom vedieť (čl. 12 ods. 3 GDPR). Ak si nebudeme istí, kto žiada, môžeme vás požiadať o overenie totožnosti.`));
  b.push(h(2, '6. Ako údaje chránime'));
  b.push(p('Prístup k údajom majú len ľudia, ktorí ich potrebujú na svoju prácu a sú poučení o mlčanlivosti. Web beží cez šifrované spojenie (HTTPS), heslá ukladáme len v zašifrovanej podobe, zálohujeme a prístupy chránime heslami a dvojfaktorovým overením tam, kde je dostupné (čl. 32 GDPR).'));
  if (ma(d, 'analytika') || (d.cookies && (d.cookies.analyticke || d.cookies.marketingove))) {
    b.push(h(2, '7. Cookies'));
    b.push(p('Používame nevyhnutné cookies, bez ktorých web nefunguje (napríklad košík alebo prihlásenie). Ostatné cookies (analytické, marketingové) ukladáme len s vaším súhlasom, ktorý dávate v cookie lište a môžete ho kedykoľvek zmeniť. Podrobnosti sú v samostatných Zásadách používania cookies.'));
  }
  b.push(h(2, (ma(d, 'analytika') || (d.cookies && (d.cookies.analyticke || d.cookies.marketingove))) ? '8. Automatizované rozhodovanie a zmeny zásad' : '7. Automatizované rozhodovanie a zmeny zásad'));
  b.push(p('Nerobíme rozhodnutia založené výlučne na automatizovanom spracúvaní, ktoré by mali pre vás právne účinky (čl. 22 GDPR). Tieto zásady môžeme aktualizovať; aktuálna verzia je vždy na našom webe a pri podstatnej zmene vás upozorníme.'));
  return b;
}

/* ── D2 Cookies ────────────────────────────────────────────────────────── */
export function d2Cookies(d) {
  const f = d.firma || {};
  const ck = d.cookies || {};
  const n = nastroje(d);
  const b = [];
  b.push(h(1, 'Zásady používania cookies'));
  b.push(p(`Web ${f.web || '[web]'} prevádzkuje ${firma(d) || '[firma]'}. Cookies sú malé súbory, ktoré prehliadač uloží do vášho zariadenia. Podľa § 109 ods. 8 zákona č. 452/2021 Z. z. o elektronických komunikáciách smieme do vášho zariadenia ukladať alebo z neho čítať informácie len s vaším preukázateľným súhlasom; výnimkou sú cookies nevyhnutné na poskytnutie služby, ktorú ste si sami vyžiadali.`));
  b.push(h(2, 'Aké cookies používame'));
  const rows = [['Kategória', 'Na čo slúžia', 'Právny základ', 'Ako dlho']];
  rows.push(['Nevyhnutné', 'chod webu: košík, prihlásenie, zapamätanie súhlasu s cookies, ochrana pred zneužitím formulárov', 'bez súhlasu (výnimka podľa § 109 ods. 8), oprávnený záujem', 'relácia až 12 mesiacov']);
  if (ck.analyticke) rows.push(['Analytické', 'meranie návštevnosti: ktoré stránky sa čítajú, odkiaľ ľudia prišli, koľko ich je', 'súhlas', 'až 14 mesiacov']);
  if (ck.marketingove) rows.push(['Marketingové', 'meranie výsledkov reklamy a jej cielenie na iných weboch a sociálnych sieťach', 'súhlas', 'až 13 mesiacov']);
  b.push(tbl(rows));
  if (!ck.analyticke && !ck.marketingove) b.push(p('Analytické ani marketingové cookies nepoužívame. Ak meriame návštevnosť, robíme to bez cookies a bez identifikácie osoby.'));
  const tretie = n.filter((x) => x.cookies);
  if (tretie.length) {
    b.push(h(2, 'Cookies tretích strán'));
    b.push(ul(tretie.map((x) => `${x.nazov}: ${x.kto}; ${x.ucel}. Údaje sa môžu preniesť do USA (rámec EU-U.S. Data Privacy Framework alebo štandardné zmluvné doložky).`)));
  }
  b.push(h(2, 'Ako súhlas dať, zmeniť alebo odvolať'));
  b.push(p('Pri prvej návšteve sa zobrazí cookie lišta. Kým nedáte súhlas, ukladajú sa len nevyhnutné cookies. Súhlas môžete kedykoľvek zmeniť odkazom „Nastavenia cookies" v pätičke webu. Cookies môžete vymazať aj v nastaveniach prehliadača; web potom môže fungovať obmedzene.'));
  b.push(h(2, 'Text cookie lišty (na vloženie do webu)'));
  b.push(p(`**Nadpis:** Cookies na ${f.web || '[web]'}`));
  b.push(p('**Text:** Nevyhnutné cookies používame, aby web fungoval. Analytické a marketingové cookies použijeme, len ak nám to dovolíte. Svoj výber môžete kedykoľvek zmeniť. Viac v Zásadách používania cookies.'));
  b.push(p('**Tlačidlá:** Prijať všetko · Odmietnuť voliteľné · Nastavenia. Tlačidlo „Odmietnuť" musí byť rovnako viditeľné ako „Prijať" (stanovisko Úradu pre reguláciu elektronických komunikácií a poštových služieb k § 109 ods. 8).'));
  return b;
}

/* ── D3 Záznamy o spracovateľských činnostiach (čl. 30) ───────────────── */
export function d3Zaznamy(d) {
  const c = cinnosti(d);
  const zo = zodpovedna(d);
  const b = [];
  b.push(h(1, 'Záznamy o spracovateľských činnostiach'));
  b.push(p(`Prevádzkovateľ: ${firma(d) || '[firma]'}${kontakt(d) ? ', ' + kontakt(d) : ''}. Zástupca prevádzkovateľa: ${(d.firma || {}).zastupca || '[konateľ]'}. Zodpovedná osoba: ${zo || 'neurčená'}. Záznamy vedené podľa čl. 30 ods. 1 GDPR, stav k ${datumSK(d.datum) || '[dátum]'}.`));
  b.push(p('Poznámka: povinnosť viesť záznamy má aj firma s menej než 250 zamestnancami, ak spracúvanie nie je príležitostné (čl. 30 ods. 5 GDPR); vybavovanie objednávok alebo mzdová agenda príležitostné nie sú.'));
  if (!c.length) b.push(p('Vo formulári nebola vybraná žiadna činnosť.'));
  c.forEach((x, i) => {
    b.push(h(2, `Činnosť ${i + 1}: ${x.nazov}`));
    b.push(tbl([
      ['Položka', 'Obsah'],
      ['Účel spracúvania', x.ucel],
      ['Právny základ', x.zaklad],
      ['Kategórie dotknutých osôb', x.dotknuti],
      ['Kategórie osobných údajov', x.udaje],
      ['Kategórie príjemcov', x.prijemcovia.join('; ')],
      ['Prenos do tretej krajiny', prenosUSA(d) && ['analytika', 'newsletter', 'eshop', 'kontakt', 'socialne'].includes(x.id) ? 'možný prenos do USA cez dodávateľov (EU-U.S. Data Privacy Framework alebo štandardné zmluvné doložky)' : 'nie'],
      ['Lehota na vymazanie', x.lehota],
      ['Bezpečnostné opatrenia (čl. 32)', 'riadenie prístupov podľa role, heslá a dvojfaktorové overenie, šifrované spojenie, zálohovanie, poučenie oprávnených osôb, zmluvy so sprostredkovateľmi, evidencia porušení'],
    ]));
  });
  b.push(h(2, 'Sprostredkovatelia'));
  const pr = prijemcoviaText(d);
  b.push(pr.length ? ul(pr) : p('[doplňte]'));
  b.push(h(2, 'Zmeny záznamov'));
  b.push(tbl([['Dátum', 'Kto', 'Čo sa zmenilo'], [datumSK(d.datum) || '', (d.firma || {}).zastupca || '', 'prvé vydanie']]));
  return b;
}

/* ── D4 Sprostredkovateľská zmluva (čl. 28) ────────────────────────────── */
export function d4Zmluva(d) {
  const b = [];
  b.push(h(1, 'Zmluva o spracúvaní osobných údajov (sprostredkovateľská zmluva)'));
  b.push(p('uzavretá podľa čl. 28 ods. 3 nariadenia (EÚ) 2016/679 (GDPR) a § 34 zákona č. 18/2018 Z. z.'));
  b.push(p(`**Prevádzkovateľ:** ${firma(d) || '[firma]'}, zastúpený ${(d.firma || {}).zastupca || '[konateľ]'}`));
  b.push(p('**Sprostredkovateľ:** [názov, sídlo, IČO, zastúpený]'));
  b.push(h(2, '1. Predmet a trvanie'));
  b.push(p('Sprostredkovateľ spracúva pre prevádzkovateľa osobné údaje v rozsahu a na účel uvedený v prílohe 1, výlučne podľa zdokumentovaných pokynov prevádzkovateľa, po dobu trvania hlavnej zmluvy: [názov hlavnej zmluvy, dátum].'));
  b.push(h(2, '2. Povinnosti sprostredkovateľa (čl. 28 ods. 3 GDPR)'));
  b.push(ul([
    'spracúva údaje len na základe zdokumentovaných pokynov prevádzkovateľa, vrátane prenosu do tretej krajiny; ak mu právo Únie alebo členského štátu ukladá spracúvať inak, oznámi to prevádzkovateľovi vopred,',
    'zabezpečí, že osoby oprávnené spracúvať údaje sa zaviazali k mlčanlivosti,',
    'prijme technické a organizačné opatrenia podľa čl. 32 GDPR uvedené v prílohe 2,',
    'zapojí ďalšieho sprostredkovateľa len s predchádzajúcim písomným súhlasom prevádzkovateľa (všeobecný súhlas so zoznamom v prílohe 3, zmeny oznámi 30 dní vopred) a uloží mu rovnaké povinnosti,',
    'pomáha prevádzkovateľovi vybavovať žiadosti dotknutých osôb podľa kapitoly III GDPR,',
    'pomáha prevádzkovateľovi plniť povinnosti podľa čl. 32 až 36 GDPR (bezpečnosť, oznámenie porušenia, posúdenie vplyvu),',
    'oznámi prevádzkovateľovi každé porušenie ochrany osobných údajov bez zbytočného odkladu, najneskôr do 24 hodín od zistenia, s údajmi podľa čl. 33 ods. 3 GDPR,',
    'po skončení poskytovania služieb údaje podľa rozhodnutia prevádzkovateľa vymaže alebo vráti a vymaže existujúce kópie, ak právo Únie alebo členského štátu nevyžaduje ich uchovanie,',
    'poskytne prevádzkovateľovi informácie potrebné na preukázanie plnenia povinností a umožní audity a kontroly vykonávané prevádzkovateľom alebo ním povereným audítorom, oznámené aspoň 14 dní vopred,',
    'bezodkladne informuje prevádzkovateľa, ak podľa jeho názoru pokyn porušuje GDPR alebo iné právo na ochranu údajov.',
  ]));
  b.push(h(2, '3. Povinnosti prevádzkovateľa'));
  b.push(p('Prevádzkovateľ zodpovedá za zákonnosť spracúvania, právny základ, informovanie dotknutých osôb a za to, že pokyny sú v súlade s GDPR. Pokyny dáva písomne alebo e-mailom.'));
  b.push(h(2, '4. Prenos do tretích krajín'));
  b.push(p('Prenos mimo EHP je možný len na základe rozhodnutia o primeranosti (čl. 45 GDPR) alebo štandardných zmluvných doložiek (čl. 46 ods. 2 písm. c) GDPR), ktoré sú prílohou tejto zmluvy, a po posúdení práva cieľovej krajiny.'));
  b.push(h(2, '5. Zodpovednosť a záverečné ustanovenia'));
  b.push(p('Každá strana zodpovedá za škodu podľa čl. 82 GDPR. Zmluva sa riadi právom Slovenskej republiky. Zmeny len písomne. Vyhotovená v dvoch rovnopisoch.'));
  b.push(p('V ____________ dňa ____________'));
  b.push(tbl([['Prevádzkovateľ', 'Sprostredkovateľ'], ['\n\n______________________', '\n\n______________________']]));
  b.push(h(2, 'Príloha 1: predmet spracúvania'));
  b.push(tbl([['Položka', 'Obsah'], ['Účel', '[napr. hosting e-shopu, rozosielanie newslettera, vedenie účtovníctva]'], ['Kategórie dotknutých osôb', '[zákazníci, odberatelia, zamestnanci]'], ['Kategórie údajov', '[meno, e-mail, adresa, údaje o objednávke]'], ['Doba spracúvania', '[po dobu trvania hlavnej zmluvy]']]));
  b.push(h(2, 'Príloha 2: bezpečnostné opatrenia sprostredkovateľa'));
  b.push(ul(['riadenie prístupov a oprávnení, zásada najmenších práv', 'šifrovanie prenosu (TLS) a údajov v pokoji, kde je to možné', 'zálohovanie a plán obnovy', 'logovanie prístupov, pravidelné aktualizácie', 'poučenie a mlčanlivosť pracovníkov', 'postup pri incidente s oznámením do 24 hodín']));
  b.push(h(2, 'Príloha 3: schválení ďalší sprostredkovatelia'));
  b.push(tbl([['Názov', 'Sídlo', 'Účel', 'Krajina spracúvania'], ['[doplňte]', '', '', '']]));
  return b;
}

/* ── D5 Súhlas a texty pod formuláre ───────────────────────────────────── */
export function d5Suhlas(d) {
  const f = d.firma || {};
  const b = [];
  b.push(h(1, 'Súhlas so spracúvaním osobných údajov a texty pod formuláre'));
  b.push(p('Súhlas podľa čl. 6 ods. 1 písm. a) a čl. 7 GDPR musí byť slobodný, konkrétny, informovaný a jednoznačný; nesmie byť vopred zaškrtnutý a musí sa dať odvolať tak ľahko, ako sa dal.'));
  b.push(h(2, 'A. Súhlas s newsletterom (text pri políčku)'));
  b.push(p(`☐ Súhlasím, aby ${f.nazov || '[firma]'} používal môj e-mail na zasielanie noviniek a ponúk. Súhlas môžem kedykoľvek odvolať odkazom v každom e-maile alebo správou na ${f.email || '[e-mail]'}. Viac v Zásadách ochrany osobných údajov.`));
  b.push(h(2, 'B. Text pod kontaktným formulárom (bez súhlasu, informácia)'));
  b.push(p(`Odoslaním správy spracúvame vaše meno, e-mail a obsah správy, aby sme vám odpovedali (čl. 6 ods. 1 písm. b) a f) GDPR). Údaje uchovávame ${lehota(d, 'kontakt')}. Viac v Zásadách ochrany osobných údajov.`));
  b.push(h(2, 'C. Text pri objednávke (bez súhlasu, informácia)'));
  b.push(p(`Vaše údaje spracúvame na vybavenie objednávky, doručenie a vystavenie dokladu (čl. 6 ods. 1 písm. b) a c) GDPR) a odovzdáme ich dopravcovi a platobnej bráne. Uchovávame ich ${lehota(d, 'objednavky')}. Viac v Zásadách ochrany osobných údajov.`));
  b.push(h(2, 'D. Súhlas uchádzača s uchovaním životopisu'));
  b.push(p(`☐ Súhlasím, aby ${f.nazov || '[firma]'} uchoval môj životopis a údaje z výberového konania na účel oslovenia s ďalšou pracovnou ponukou po dobu 1 roka. Súhlas môžem kedykoľvek odvolať na ${f.email || '[e-mail]'}.`));
  b.push(h(2, 'E. Písomný súhlas (samostatný dokument)'));
  b.push(p('Dotknutá osoba: [meno, priezvisko, adresa alebo e-mail]'));
  b.push(p(`Prevádzkovateľ: ${firma(d) || '[firma]'}`));
  b.push(p('Účel: [napr. zverejnenie fotografie z podujatia na webe a sociálnych sieťach prevádzkovateľa]'));
  b.push(p('Rozsah údajov: [napr. podobizeň, meno]'));
  b.push(p('Doba: [napr. 3 roky od udelenia súhlasu]'));
  b.push(p('Súhlas udeľujem dobrovoľne. Bol som informovaný, že ho môžem kedykoľvek odvolať bez toho, aby to malo vplyv na zákonnosť spracúvania pred odvolaním, a o svojich právach podľa čl. 15 až 22 GDPR uvedených v Zásadách ochrany osobných údajov.'));
  b.push(p('V ____________ dňa ____________   podpis ______________________'));
  b.push(h(2, 'F. Evidencia súhlasov'));
  b.push(p('Prevádzkovateľ musí vedieť preukázať, kto, kedy, na čo a akým spôsobom súhlas dal (čl. 7 ods. 1 GDPR). Pri online súhlase uchovajte: e-mail, dátum a čas, IP adresu alebo identifikátor, znenie súhlasu, spôsob (políčko, double opt-in).'));
  b.push(tbl([['Dotknutá osoba', 'Účel', 'Dátum a spôsob udelenia', 'Znenie', 'Odvolanie'], ['', '', '', '', '']]));
  return b;
}

/* ── D6 Informačná povinnosť voči zamestnancom ─────────────────────────── */
export function d6Zamestnanci(d) {
  const f = d.firma || {};
  const b = [];
  b.push(h(1, 'Informácia pre zamestnancov o spracúvaní osobných údajov'));
  b.push(p(`podľa čl. 13 GDPR. Zamestnávateľ a prevádzkovateľ: ${firma(d) || '[firma]'}${kontakt(d) ? ', ' + kontakt(d) : ''}. Zodpovedná osoba: ${zodpovedna(d) || 'neurčená; obráťte sa na konateľa'}.`));
  b.push(h(2, '1. Účely a právne základy'));
  b.push(tbl([
    ['Účel', 'Právny základ', 'Údaje'],
    ['uzavretie a plnenie pracovnej zmluvy alebo dohody', 'čl. 6 ods. 1 písm. b) GDPR', 'identifikačné a kontaktné údaje, vzdelanie, prax, číslo účtu'],
    ['mzdy, odvody, dane, sociálne a zdravotné poistenie', 'čl. 6 ods. 1 písm. c) GDPR; Zákonník práce, zákon č. 461/2003 Z. z., zákon č. 580/2004 Z. z., zákon č. 595/2003 Z. z.', 'rodné číslo, mzdové údaje, údaje o rodinných príslušníkoch pre daňový bonus'],
    ['bezpečnosť a ochrana zdravia pri práci, pracovná zdravotná služba', 'čl. 6 ods. 1 písm. c) GDPR; zákon č. 124/2006 Z. z.', 'údaje o zdravotnej spôsobilosti v rozsahu podľa zákona (čl. 9 ods. 2 písm. b) GDPR)'],
    ['evidencia dochádzky a pracovného času', 'čl. 6 ods. 1 písm. c) GDPR; § 99 Zákonníka práce', 'príchody, odchody, neprítomnosť'],
    ['pracovný e-mail, prístupy do systémov, služobný telefón', 'čl. 6 ods. 1 písm. f) GDPR (oprávnený záujem na chode firmy)', 'prihlasovacie údaje, logy prístupov'],
    ...(ma(d, 'kamery') ? [['kamerový systém v prevádzke', 'čl. 6 ods. 1 písm. f) GDPR; oznámenie podľa § 13 ods. 4 Zákonníka práce', 'obrazový záznam v monitorovanom priestore, nie na pracovisku bez vážneho dôvodu']] : []),
  ]));
  b.push(h(2, '2. Príjemcovia'));
  b.push(ul(['Sociálna poisťovňa, zdravotné poisťovne, daňový úrad, úrad práce', 'mzdová alebo účtovná firma (sprostredkovateľ)', 'pracovná zdravotná služba', 'banka pri výplate mzdy', 'poskytovatelia softvéru na dochádzku a personalistiku (sprostredkovatelia)']));
  b.push(h(2, '3. Doba uchovávania'));
  b.push(p(`Osobný spis po dobu pracovného pomeru; po skončení podľa registratúrneho plánu a zákonov: mzdové listy a údaje potrebné na dôchodkové účely 50 rokov, ostatné mzdové doklady 10 rokov, evidencia dochádzky 3 roky. Nastavené vo formulári: ${lehota(d, 'zamestnanci')}.`));
  b.push(h(2, '4. Monitorovanie'));
  b.push(p(`Zamestnávateľ ${ma(d, 'kamery') ? 'používa kamerový systém na ochranu majetku a bezpečnosť osôb v priestoroch: [uveďte priestory]. Kamery nesnímajú šatne, toalety ani oddychové miestnosti. Záznam sa uchováva ' + lehota(d, 'kamery') + '.' : 'nepoužíva kamerový systém na pracovisku.'} Zamestnávateľ nekontroluje súkromnú korešpondenciu zamestnancov; služobný e-mail a zariadenia môže kontrolovať len v rozsahu potrebnom na chod firmy a po predchádzajúcom upozornení (§ 13 ods. 4 Zákonníka práce).`));
  b.push(h(2, '5. Vaše práva'));
  b.push(p(`Máte právo na prístup, opravu, vymazanie, obmedzenie, prenosnosť a námietku podľa čl. 15 až 21 GDPR a právo podať sťažnosť Úradu na ochranu osobných údajov SR, Hraničná 12, 820 07 Bratislava 27. Žiadosti: ${f.email || '[e-mail]'}. Poskytnutie údajov na účely pracovného pomeru a zákonných povinností je nevyhnutné; bez nich nemôžeme pracovný pomer uzavrieť ani viesť.`));
  b.push(p('Prevzatie potvrdzujem: meno ______________________ dátum __________ podpis ______________________'));
  return b;
}

/* ── D7 Interná smernica a poučenie oprávnenej osoby ───────────────────── */
export function d7Smernica(d) {
  const f = d.firma || {};
  const c = cinnosti(d);
  const b = [];
  b.push(h(1, 'Interná smernica o ochrane osobných údajov'));
  b.push(p(`${firma(d) || '[firma]'}. Platí od ${datumSK(d.datum) || '[dátum]'}. Schválil: ${f.zastupca || '[konateľ]'}.`));
  b.push(h(2, '1. Účel smernice'));
  b.push(p('Smernica určuje, ako firma a jej pracovníci narábajú s osobnými údajmi, aby bolo spracúvanie zákonné, bezpečné a preukázateľné (čl. 5 ods. 2 a čl. 24 GDPR).'));
  b.push(h(2, '2. Zásady (čl. 5 GDPR)'));
  b.push(ul(['zákonnosť, spravodlivosť a transparentnosť: každé spracúvanie má právny základ a ľudia o ňom vedia,', 'obmedzenie účelu: údaje sa použijú len na účel, na ktorý sa získali,', 'minimalizácia: zbierame len to, čo potrebujeme,', 'správnosť: nesprávne údaje opravíme,', 'minimalizácia uchovávania: údaje mažeme po uplynutí lehoty v záznamoch,', 'integrita a dôvernosť: prístup majú len oprávnení ľudia, údaje sú chránené.']));
  b.push(h(2, '3. Role'));
  b.push(tbl([['Rola', 'Kto', 'Zodpovedá za'], ['štatutár', f.zastupca || '[konateľ]', 'schvaľovanie smernice, zmlúv so sprostredkovateľmi, rozhodnutia o porušeniach'], ['zodpovedná osoba', zodpovedna(d) || 'neurčená (čl. 37 GDPR to nevyžaduje)', 'poradenstvo, kontakt s úradom a dotknutými osobami'], ['oprávnené osoby', 'pracovníci s prístupom k údajom podľa poverenia', 'dodržiavanie tejto smernice']]));
  b.push(h(2, '4. Spracovateľské činnosti'));
  b.push(p(c.length ? 'Firma vedie záznamy o spracovateľských činnostiach (samostatný dokument). Činnosti: ' + c.map((x) => x.nazov).join('; ') + '.' : 'Firma vedie záznamy o spracovateľských činnostiach (samostatný dokument).'));
  b.push(h(2, '5. Pravidlá pre pracovníkov'));
  b.push(ul([
    'každý má vlastné prihlasovacie údaje, heslá sa nezdieľajú a nezapisujú; kde je to možné, je zapnuté dvojfaktorové overenie,',
    'osobné údaje sa neposielajú súkromnými e-mailmi ani cez súkromné aplikácie na správy,',
    'dokumenty s osobnými údajmi sa neukladajú na súkromné zariadenia; pri odchode od počítača sa obrazovka zamkne,',
    'papierové dokumenty sú v uzamknutej skrini; nepotrebné sa skartujú,',
    'údaje sa poskytnú tretej strane len s právnym základom a po overení totožnosti žiadateľa,',
    'každé podozrenie na porušenie (strata zariadenia, chybne odoslaný e-mail, únik) sa hlási štatutárovi ihneď, najneskôr do 24 hodín,',
    'žiadosti dotknutých osôb sa odovzdajú štatutárovi alebo zodpovednej osobe v deň prijatia,',
    'nové nástroje, ktoré spracúvajú osobné údaje, sa zavádzajú až po uzavretí sprostredkovateľskej zmluvy a doplnení záznamov.',
  ]));
  b.push(h(2, '6. Sprostredkovatelia'));
  b.push(p('S každým dodávateľom, ktorý spracúva osobné údaje pre firmu, je uzavretá zmluva podľa čl. 28 GDPR (vlastný vzor alebo podmienky dodávateľa, ktoré čl. 28 spĺňajú). Zoznam je v záznamoch o spracovateľských činnostiach.'));
  b.push(h(2, '7. Bezpečnosť (čl. 32 GDPR)'));
  b.push(ul(['prístupy podľa role, odobratie prístupov v deň skončenia spolupráce,', 'aktualizovaný softvér, antivírus, šifrované disky notebookov,', 'zálohy aspoň raz týždenne, overená obnova aspoň raz ročne,', 'HTTPS na webe, heslá zákazníkov len v zašifrovanej podobe,', 'evidencia porušení a raz ročne kontrola tejto smernice.']));
  b.push(h(2, '8. Poučenie a poverenie oprávnenej osoby (vzor)'));
  b.push(p(`Meno: ______________________ Pracovná pozícia: ______________________`));
  b.push(p(`Bol/a som poučený/á o povinnostiach pri spracúvaní osobných údajov podľa GDPR, zákona č. 18/2018 Z. z. a tejto smernice, o rozsahu svojho oprávnenia (systémy: ______________________) a o povinnosti mlčanlivosti, ktorá trvá aj po skončení spolupráce (§ 79 zákona č. 18/2018 Z. z.).`));
  b.push(p('V ____________ dňa ____________   podpis ______________________'));
  return b;
}

/* ── D8 Porušenie ochrany údajov ───────────────────────────────────────── */
export function d8Porusenie(d) {
  const f = d.firma || {};
  const b = [];
  b.push(h(1, 'Postup pri porušení ochrany osobných údajov'));
  b.push(p(`${firma(d) || '[firma]'}. Podľa čl. 33 a 34 GDPR. Zodpovedá: ${f.zastupca || '[konateľ]'}${zodpovedna(d) ? ', zodpovedná osoba ' + zodpovedna(d) : ''}.`));
  b.push(h(2, '1. Čo je porušenie'));
  b.push(p('Porušením je každá udalosť, pri ktorej sa osobné údaje náhodne alebo nezákonne zničia, stratia, zmenia, neoprávnene sprístupnia alebo sa k nim niekto dostane (čl. 4 bod 12 GDPR): stratený notebook, e-mail poslaný nesprávnemu príjemcovi, únik databázy, ransomvér, zamestnanec, ktorý si prezerá údaje bez dôvodu.'));
  b.push(h(2, '2. Postup krok za krokom'));
  b.push(tbl([
    ['Krok', 'Kedy', 'Kto', 'Čo'],
    ['1. Zastaviť a zabezpečiť', 'ihneď', 'každý, kto zistí', 'odpojiť zariadenie, zmeniť heslá, zablokovať prístup, nezničiť dôkazy'],
    ['2. Nahlásiť dovnútra', 'do 24 hodín', 'každý, kto zistí', 'štatutárovi alebo zodpovednej osobe: čo, kedy, koho údaje, koľko'],
    ['3. Posúdiť riziko', 'do 48 hodín', 'štatutár', 'aké údaje, koľko osôb, aké následky (finančná škoda, diskriminácia, krádež identity), či sú údaje šifrované'],
    ['4. Oznámiť Úradu', 'do 72 hodín od zistenia', 'štatutár', 'ak porušenie pravdepodobne povedie k riziku pre práva osôb: Úrad na ochranu osobných údajov SR, statny.dozor@pdp.gov.sk, formulár na dataprotection.gov.sk (čl. 33)'],
    ['5. Oznámiť dotknutým osobám', 'bez zbytočného odkladu', 'štatutár', 'ak je riziko vysoké: jasným jazykom, čo sa stalo, aké následky hrozia, čo robíme a čo majú spraviť (čl. 34)'],
    ['6. Zapísať', 'vždy, aj bez oznámenia', 'štatutár', 'do evidencie nižšie: fakty, následky, opatrenia (čl. 33 ods. 5)'],
    ['7. Poučiť sa', 'do 30 dní', 'štatutár', 'čo zmeniť, aby sa to neopakovalo; upraviť smernicu'],
  ]));
  b.push(h(2, '3. Vzor oznámenia Úradu (obsah podľa čl. 33 ods. 3)'));
  b.push(ul(['povaha porušenia, kategórie a približný počet dotknutých osôb a záznamov,', 'meno a kontakt zodpovednej osoby alebo iného kontaktu,', 'pravdepodobné následky,', 'prijaté a navrhované opatrenia vrátane zmiernenia následkov.']));
  b.push(h(2, '4. Vzor oznámenia dotknutým osobám'));
  b.push(p(`Dobrý deň, dňa [dátum] došlo u ${f.nazov || '[firma]'} k [popis: napr. neoprávnenému prístupu k databáze zákazníkov]. Týkalo sa to týchto vašich údajov: [zoznam]. Možné následky: [napr. podvodné e-maily vo vašom mene]. Čo sme urobili: [napr. zablokovali prístup, zmenili heslá, oznámili Úradu]. Čo odporúčame vám: [napr. zmeniť heslo, neotvárať podozrivé e-maily]. Kontakt: ${f.email || '[e-mail]'}${zodpovedna(d) ? ', zodpovedná osoba ' + zodpovedna(d) : ''}.`));
  b.push(h(2, '5. Evidencia porušení'));
  b.push(tbl([['Dátum zistenia', 'Čo sa stalo', 'Údaje a počet osôb', 'Riziko', 'Oznámené Úradu (dátum)', 'Oznámené osobám', 'Opatrenia'], ['', '', '', '', '', '', '']]));
  return b;
}

/* ── D9 Žiadosti dotknutých osôb ───────────────────────────────────────── */
export function d9Ziadosti(d) {
  const f = d.firma || {};
  const b = [];
  b.push(h(1, 'Postup vybavovania žiadostí dotknutých osôb'));
  b.push(p(`${firma(d) || '[firma]'}. Podľa čl. 12 a 15 až 22 GDPR. Žiadosti prijíma: ${f.email || '[e-mail]'}${zodpovedna(d) ? ', zodpovedná osoba ' + zodpovedna(d) : ''}.`));
  b.push(h(2, '1. Lehoty'));
  b.push(p('Odpoveď do **jedného mesiaca** od prijatia žiadosti. Pri zložitých alebo početných žiadostiach možno predĺžiť o ďalšie dva mesiace; o predĺžení a dôvodoch treba osobu informovať do mesiaca (čl. 12 ods. 3). Vybavenie je bezplatné; pri zjavne neopodstatnených alebo opakovaných žiadostiach možno žiadať primeraný poplatok alebo odmietnuť (čl. 12 ods. 5).'));
  b.push(h(2, '2. Postup'));
  b.push(ul(['zapísať žiadosť do evidencie v deň prijatia (dátum, kto, čo žiada, kanál),', 'overiť totožnosť, ak je pochybnosť (odpoveď na e-mail, z ktorého sa údaje zbierali, alebo doplňujúca otázka; nežiadať kópiu dokladu, ak to nie je nutné),', 'vyhľadať údaje vo všetkých systémoch (e-shop, e-mail, účtovníctvo, newsletter, zálohy) a u sprostredkovateľov,', 'posúdiť, či právo možno uplatniť (napr. vymazanie nie je možné pri údajoch, ktoré musíme uchovať podľa zákona o účtovníctve),', 'odpovedať písomne, zrozumiteľne, v tom istom kanáli, ak osoba nechce inak,', 'zapísať vybavenie do evidencie.']));
  b.push(h(2, '3. Čo obsahuje odpoveď na žiadosť o prístup (čl. 15)'));
  b.push(ul(['účely spracúvania a právne základy,', 'kategórie údajov a kópia údajov,', 'príjemcovia alebo ich kategórie, prenos do tretích krajín a záruky,', 'doba uchovávania,', 'existencia práv na opravu, vymazanie, obmedzenie, námietku a sťažnosť,', 'zdroj údajov, ak nie sú od osoby,', 'existencia automatizovaného rozhodovania.']));
  b.push(h(2, '4. Vzor odpovede'));
  b.push(p(`Dobrý deň, potvrdzujeme prijatie vašej žiadosti z [dátum] o [prístup / opravu / vymazanie / obmedzenie / prenos / námietku]. [Prístup:] V prílohe posielame kópiu údajov, ktoré o vás spracúvame, spolu s informáciami podľa čl. 15 GDPR. [Vymazanie:] Vaše údaje sme vymazali zo všetkých systémov okrem [účtovných dokladov], ktoré musíme uchovať podľa zákona č. 431/2002 Z. z. do [dátum]. [Námietka proti marketingu:] Váš e-mail sme vyradili z rozosielania; ďalšie marketingové správy už nedostanete. Ak s vybavením nesúhlasíte, môžete sa obrátiť na Úrad na ochranu osobných údajov SR, Hraničná 12, 820 07 Bratislava 27. S pozdravom, ${f.nazov || '[firma]'}`));
  b.push(h(2, '5. Evidencia žiadostí'));
  b.push(tbl([['Dátum prijatia', 'Kto', 'Právo', 'Overenie totožnosti', 'Vybavené dňa', 'Ako'], ['', '', '', '', '', '']]));
  return b;
}

/* ── D10 Kamerový systém ───────────────────────────────────────────────── */
export function d10Kamery(d) {
  const f = d.firma || {};
  const b = [];
  b.push(h(1, 'Kamerový systém: informačná tabuľa a záznam'));
  b.push(h(2, 'A. Informačná tabuľa (prvá vrstva, umiestniť pred vstupom do monitorovaného priestoru)'));
  b.push(p('PRIESTOR JE MONITOROVANÝ KAMEROVÝM SYSTÉMOM SO ZÁZNAMOM'));
  b.push(p(`Prevádzkovateľ: ${f.nazov || '[firma]'}, ${f.sidlo || '[sídlo]'}. Účel: ochrana majetku a bezpečnosť osôb (oprávnený záujem, čl. 6 ods. 1 písm. f) GDPR). Záznam uchovávame ${lehota(d, 'kamery')}. Vaše práva a úplné informácie: ${f.web ? f.web + '/ochrana-osobnych-udajov' : '[web]'} alebo ${f.email || '[e-mail]'}.`));
  b.push(h(2, 'B. Úplná informácia (druhá vrstva, na webe alebo na recepcii)'));
  b.push(tbl([
    ['Položka', 'Obsah'],
    ['Prevádzkovateľ', firma(d) || '[firma]'],
    ['Účel', 'ochrana majetku prevádzkovateľa a bezpečnosť osôb, dokazovanie protiprávneho konania'],
    ['Právny základ', 'čl. 6 ods. 1 písm. f) GDPR; oprávnený záujem prevádzkovateľa (posúdenie nižšie)'],
    ['Monitorované priestory', '[napr. predajňa, sklad, vstup; nie šatne, toalety, oddychové miestnosti]'],
    ['Doba uchovávania', lehota(d, 'kamery')],
    ['Príjemcovia', 'polícia, súdy a poisťovňa pri uplatnení nárokov; bezpečnostná služba, ak je sprostredkovateľom'],
    ['Práva', 'prístup, vymazanie, obmedzenie, námietka (čl. 15 až 21 GDPR); sťažnosť Úradu na ochranu osobných údajov SR'],
  ]));
  b.push(h(2, 'C. Posúdenie oprávneného záujmu (balančný test)'));
  b.push(ul(['Záujem: ochrana tovaru a zariadení v hodnote [suma], bezpečnosť zákazníkov a zamestnancov; v minulosti [uveďte incidenty, ak boli].', 'Nevyhnutnosť: miernejšie opatrenia (zámky, alarm, dohľad) nestačia na dokazovanie; kamery sú obmedzené na [priestory] a čas [nonstop / otváracie hodiny].', 'Vyváženie: záznam sa uchováva krátko, prístup majú [kto], zamestnanci boli informovaní podľa § 13 ods. 4 Zákonníka práce, tabule sú pri vstupe. Záujem prevažuje.']));
  b.push(h(2, 'D. Záznam do evidencie spracovateľských činností'));
  b.push(p('Kamerový systém je zapísaný v záznamoch o spracovateľských činnostiach (samostatný dokument). Prístup k záznamu: [mená alebo pozície]. Kontrola nastavenia a mazania: raz za [3 mesiace].'));
  return b;
}

export const DOKUMENTY = [
  { id: 'd1', nazov: 'Zásady ochrany osobných údajov', popis: 'informačná povinnosť podľa čl. 13 GDPR pre web, e-shop a zákazníkov', fn: d1Zasady, zadarmo: true },
  { id: 'd2', nazov: 'Zásady používania cookies a text cookie lišty', popis: '§ 109 ods. 8 zákona č. 452/2021 Z. z.', fn: d2Cookies },
  { id: 'd3', nazov: 'Záznamy o spracovateľských činnostiach', popis: 'čl. 30 GDPR, jedna tabuľka na každú činnosť', fn: d3Zaznamy },
  { id: 'd4', nazov: 'Sprostredkovateľská zmluva', popis: 'čl. 28 GDPR, s prílohami', fn: d4Zmluva },
  { id: 'd5', nazov: 'Súhlasy a texty pod formuláre', popis: 'newsletter, kontakt, objednávka, uchádzač, písomný súhlas, evidencia', fn: d5Suhlas },
  { id: 'd6', nazov: 'Informácia pre zamestnancov', popis: 'čl. 13 GDPR a § 13 ods. 4 Zákonníka práce', fn: d6Zamestnanci, len: 'zamestnanci' },
  { id: 'd7', nazov: 'Interná smernica a poučenie oprávnenej osoby', popis: 'pravidlá pre pracovníkov, role, bezpečnosť', fn: d7Smernica },
  { id: 'd8', nazov: 'Postup pri porušení ochrany údajov', popis: 'čl. 33 a 34 GDPR, 72 hodín, vzory oznámení, evidencia', fn: d8Porusenie },
  { id: 'd9', nazov: 'Postup vybavovania žiadostí dotknutých osôb', popis: 'čl. 15 až 22 GDPR, lehoty, vzor odpovede, evidencia', fn: d9Ziadosti },
  { id: 'd10', nazov: 'Kamerový systém: tabuľa, informácia, balančný test', popis: 'oprávnený záujem, § 13 ods. 4 Zákonníka práce', fn: d10Kamery, len: 'kamery' },
];

/* Dokumenty, ktoré má firma dostať podľa toho, čo zaškrtla. */
export function zoznamDokumentov(d) {
  return DOKUMENTY.filter((x) => !x.len || ma(d, x.len));
}
