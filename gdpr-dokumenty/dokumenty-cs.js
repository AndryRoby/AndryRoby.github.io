/* GDPR dokumenty pro českou firmu: šablony. Stejná stavba jako dokumenty-sk.js
 * (bloky h, p, ul, tbl), jiné právní opory:
 * nařízení (EU) 2016/679 (GDPR), zákon č. 110/2019 Sb., o zpracování osobních
 * údajů, zákon č. 127/2005 Sb., o elektronických komunikacích (§ 89 odst. 3,
 * cookies), zákon č. 563/1991 Sb., o účetnictví (§ 31) a zákon č. 235/2004 Sb.,
 * o DPH (§ 35, daňové doklady 10 let), zákon č. 262/2006 Sb., zákoník práce
 * (§ 316, sledování zaměstnanců).
 * Dozorový úřad: Úřad pro ochranu osobních údajů, Pplk. Sochora 27,
 * 170 00 Praha 7, posta@uoou.gov.cz, uoou.gov.cz (ověřeno 10. 9. 2026).
 *
 * Nejde o právní poradenství. Texty jsou obecné vzory vyplněné údaji firmy;
 * firma si je má přečíst a upravit podle toho, co skutečně dělá.
 */

export const NASTROJE = [
  { id: 'ga4', nazov: 'Google Analytics', kto: 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irsko', ucel: 'měření návštěvnosti webu', kategoria: 'analytika', usa: true, cookies: 'analyticke' },
  { id: 'umami', nazov: 'Umami nebo jiná analytika bez cookies na vlastním serveru', kto: 'správce (vlastní server)', ucel: 'anonymní měření návštěvnosti', kategoria: 'analytika', usa: false },
  { id: 'meta', nazov: 'Meta Pixel (Facebook, Instagram)', kto: 'Meta Platforms Ireland Limited, Merrion Road, Dublin 4, Irsko', ucel: 'měření a cílení reklamy', kategoria: 'marketing', usa: true, cookies: 'marketingove' },
  { id: 'gads', nazov: 'Google Ads (konverze, remarketing)', kto: 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irsko', ucel: 'měření a cílení reklamy', kategoria: 'marketing', usa: true, cookies: 'marketingove' },
  { id: 'stripe', nazov: 'Stripe (platby kartou)', kto: 'Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Dublin 2, Irsko', ucel: 'zpracování plateb', kategoria: 'platby', usa: true },
  { id: 'gopay', nazov: 'GoPay (platební brána)', kto: 'GOPAY s.r.o., Planá 67, 370 01 České Budějovice', ucel: 'zpracování plateb', kategoria: 'platby', usa: false },
  { id: 'comgate', nazov: 'Comgate (platební brána)', kto: 'Comgate, a.s., Gočárova třída 1754/48b, 500 02 Hradec Králové', ucel: 'zpracování plateb', kategoria: 'platby', usa: false },
  { id: 'zasilkovna', nazov: 'Zásilkovna (Packeta)', kto: 'Zásilkovna s.r.o., Lihovarská 1060/12, 190 00 Praha 9', ucel: 'doručení zásilek', kategoria: 'doprava', usa: false },
  { id: 'ppl', nazov: 'PPL', kto: 'PPL CZ s.r.o., K Borovému 99, 251 01 Říčany, Jažlovice', ucel: 'doručení zásilek', kategoria: 'doprava', usa: false },
  { id: 'posta', nazov: 'Česká pošta', kto: 'Česká pošta, s.p., Politických vězňů 909/4, 225 99 Praha 1', ucel: 'doručení zásilek', kategoria: 'doprava', usa: false },
  { id: 'dhl', nazov: 'DHL, GLS, DPD nebo jiný kurýr', kto: 'kurýrní společnost podle smlouvy', ucel: 'doručení zásilek', kategoria: 'doprava', usa: false },
  { id: 'mailchimp', nazov: 'Mailchimp (newsletter)', kto: 'Intuit Inc. (Mailchimp), 2700 Coast Avenue, Mountain View, CA 94043, USA', ucel: 'rozesílání newsletteru', kategoria: 'marketing', usa: true },
  { id: 'ecomail', nazov: 'Ecomail (newsletter)', kto: 'ECOMAIL.CZ, s.r.o., Na Zderaze 1275/15, 120 00 Praha 2', ucel: 'rozesílání newsletteru', kategoria: 'marketing', usa: false },
  { id: 'smartemailing', nazov: 'SmartEmailing (newsletter)', kto: 'SmartSelling a.s., Netroufalky 797/5, 625 00 Brno', ucel: 'rozesílání newsletteru', kategoria: 'marketing', usa: false },
  { id: 'shoptet', nazov: 'Shoptet (platforma e-shopu)', kto: 'Shoptet, a.s., Dvořeckého 628/8, 169 00 Praha 6', ucel: 'provoz e-shopu a uložení objednávek', kategoria: 'hosting', usa: false },
  { id: 'wedos', nazov: 'WEDOS (hosting, e-mail)', kto: 'WEDOS Internet, a.s., Masarykova 1230, 373 41 Hluboká nad Vltavou', ucel: 'hosting webu a e-mailu', kategoria: 'hosting', usa: false },
  { id: 'hosting', nazov: 'Jiný hosting nebo platforma e-shopu (WooCommerce, Shopify, Wix…)', kto: 'poskytovatel hostingu podle smlouvy', ucel: 'hosting webu, uložení objednávek a účtů', kategoria: 'hosting', usa: false },
  { id: 'gworkspace', nazov: 'Google Workspace (Gmail, Drive)', kto: 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irsko', ucel: 'e-mail a uložení dokumentů', kategoria: 'kancelář', usa: true },
  { id: 'm365', nazov: 'Microsoft 365 (Outlook, OneDrive)', kto: 'Microsoft Ireland Operations Limited, One Microsoft Place, South County Business Park, Leopardstown, Dublin 18, Irsko', ucel: 'e-mail a uložení dokumentů', kategoria: 'kancelář', usa: true },
  { id: 'uctovnik', nazov: 'Externí účetní nebo mzdová firma', kto: 'účetní firma podle smlouvy', ucel: 'vedení účetnictví a mezd', kategoria: 'účetnictví', usa: false },
  { id: 'fakturacia', nazov: 'Fakturační program (Fakturoid, iDoklad, Vyfakturuj…)', kto: 'poskytovatel fakturačního programu podle smlouvy', ucel: 'vystavování faktur', kategoria: 'účetnictví', usa: false },
];

export const LEHOTY_PREDVOLENE = {
  objednavky: '10 let od konce roku, v němž byl doklad vystaven (daňové doklady podle § 35 zákona č. 235/2004 Sb., o DPH; účetní záznamy § 31 zákona č. 563/1991 Sb.)',
  kontakt: '1 rok od vyřízení dotazu',
  newsletter: 'do odvolání souhlasu, nejdéle 3 roky od posledního otevření e-mailu',
  ucty: 'po dobu trvání účtu a 1 rok po jeho zrušení',
  uchadzaci: 'do skončení výběrového řízení; se souhlasem uchazeče nejdéle 1 rok',
  zamestnanci: 'po dobu pracovního poměru a poté podle zákona (mzdové listy po dobu stanovenou § 35a zákona č. 582/1991 Sb., osobní spis podle spisového plánu)',
  kamery: '15 dní od pořízení záznamu, pokud se záznam nepoužije k dokazování',
};

export const CINNOSTI = [
  { id: 'eshop', nazov: 'Objednávky a prodej (e-shop nebo faktury zákazníkům)' },
  { id: 'kontakt', nazov: 'Kontaktní formulář, e-mail a telefonické dotazy' },
  { id: 'newsletter', nazov: 'Newsletter a marketingové e-maily' },
  { id: 'ucty', nazov: 'Uživatelské účty na webu' },
  { id: 'analytika', nazov: 'Měření návštěvnosti webu' },
  { id: 'socialne', nazov: 'Profily na sociálních sítích (Facebook, Instagram, LinkedIn)' },
  { id: 'zamestnanci', nazov: 'Zaměstnanci a dohodáři (DPP, DPČ)' },
  { id: 'uchadzaci', nazov: 'Uchazeči o zaměstnání' },
  { id: 'kamery', nazov: 'Kamerový systém v provozovně' },
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
  return [f.nazov, f.sidlo ? 'se sídlem ' + f.sidlo : '', f.ico ? 'IČO ' + f.ico : ''].filter(Boolean).join(', ');
}
function kontakt(d) {
  const f = d.firma || {};
  return [f.email ? 'e-mail ' + f.email : '', f.telefon ? 'telefon ' + f.telefon : ''].filter(Boolean).join(', ');
}
const ma = (d, id) => !!(d.cinnosti && d.cinnosti[id]);
const nastroje = (d) => NASTROJE.filter((n) => (d.nastroje || []).includes(n.id));
const prenosUSA = (d) => nastroje(d).some((n) => n.usa) || d.prenosMimoEU === 'ano';
const lehota = (d, k) => (d.lehoty && d.lehoty[k]) || LEHOTY_PREDVOLENE[k];
function poverenec(d) {
  const z = d.zodpovednaOsoba || {};
  if (!z.ma) return null;
  return [z.meno, z.email].filter(Boolean).join(', ');
}
const URAD = 'Úřad pro ochranu osobních údajů, Pplk. Sochora 27, 170 00 Praha 7, posta@uoou.gov.cz, uoou.gov.cz';

export function cinnosti(d) {
  const out = [];
  if (ma(d, 'eshop')) out.push({
    id: 'eshop', nazov: 'Prodej zboží a služeb, vyřízení objednávky',
    ucel: 'uzavření a plnění smlouvy se zákazníkem, doručení, vyřízení reklamace, vystavení daňového dokladu',
    zaklad: 'čl. 6 odst. 1 písm. b) GDPR (plnění smlouvy) a čl. 6 odst. 1 písm. c) GDPR (právní povinnost: účetnictví, daně, reklamace)',
    udaje: 'jméno a příjmení, fakturační a dodací adresa, e-mail, telefon, údaje o objednávce a platbě (ne číslo karty), IČO a DIČ u firemních zákazníků',
    dotknuti: 'zákazníci',
    prijemcovia: ['dopravci', 'poskytovatel platební brány', 'účetní', 'poskytovatel hostingu nebo platformy e-shopu', 'finanční úřad a jiné orgány na základě zákona'],
    lehota: lehota(d, 'objednavky'),
  });
  if (ma(d, 'kontakt')) out.push({
    id: 'kontakt', nazov: 'Vyřizování dotazů (kontaktní formulář, e-mail, telefon)',
    ucel: 'odpověď na dotaz, příprava nabídky, komunikace před uzavřením smlouvy',
    zaklad: 'čl. 6 odst. 1 písm. b) GDPR (opatření před uzavřením smlouvy na žádost subjektu údajů) a čl. 6 odst. 1 písm. f) GDPR (oprávněný zájem odpovědět na dotaz)',
    udaje: 'jméno, e-mail, telefon, obsah zprávy',
    dotknuti: 'lidé, kteří nás osloví',
    prijemcovia: ['poskytovatel hostingu a e-mailu'],
    lehota: lehota(d, 'kontakt'),
  });
  if (ma(d, 'newsletter')) out.push({
    id: 'newsletter', nazov: 'Newsletter a marketingové e-maily',
    ucel: 'zasílání novinek, nabídek a obsahu',
    zaklad: 'čl. 6 odst. 1 písm. a) GDPR (souhlas), u stávajících zákazníků čl. 6 odst. 1 písm. f) GDPR (oprávněný zájem, přímý marketing vlastních podobných produktů) a § 7 odst. 3 zákona č. 480/2004 Sb. s možností kdykoli se odhlásit',
    udaje: 'e-mail, jméno, údaje o otevření a kliknutí v e-mailu',
    dotknuti: 'odběratelé newsletteru, zákazníci',
    prijemcovia: ['poskytovatel nástroje pro rozesílání e-mailů'],
    lehota: lehota(d, 'newsletter'),
  });
  if (ma(d, 'ucty')) out.push({
    id: 'ucty', nazov: 'Uživatelské účty',
    ucel: 'vedení účtu, historie objednávek, uložení nastavení',
    zaklad: 'čl. 6 odst. 1 písm. b) GDPR (plnění smlouvy o užívání účtu)',
    udaje: 'jméno, e-mail, přihlašovací údaje (heslo jen v zašifrované podobě), adresa, historie objednávek',
    dotknuti: 'registrovaní uživatelé',
    prijemcovia: ['poskytovatel hostingu nebo platformy'],
    lehota: lehota(d, 'ucty'),
  });
  if (ma(d, 'analytika')) out.push({
    id: 'analytika', nazov: 'Měření návštěvnosti webu',
    ucel: 'zjistit, kolik lidí web navštíví, odkud přišli a které stránky používají, a web zlepšovat',
    zaklad: (d.cookies && d.cookies.analyticke) ? 'čl. 6 odst. 1 písm. a) GDPR (souhlas udělený v cookie liště) a § 89 odst. 3 zákona č. 127/2005 Sb.' : 'čl. 6 odst. 1 písm. f) GDPR (oprávněný zájem), měření bez cookies a bez identifikace osoby',
    udaje: (d.cookies && d.cookies.analyticke) ? 'IP adresa (zkrácená), identifikátor cookie, prohlížeč, zařízení, navštívené stránky, zdroj návštěvy' : 'zkrácená IP adresa, prohlížeč, zařízení, navštívené stránky, zdroj návštěvy; bez cookies a bez profilu osoby',
    dotknuti: 'návštěvníci webu',
    prijemcovia: ['poskytovatel analytického nástroje'],
    lehota: '14 měsíců (agregované statistiky bez vazby na osobu se uchovávají déle)',
  });
  if (ma(d, 'socialne')) out.push({
    id: 'socialne', nazov: 'Profily na sociálních sítích',
    ucel: 'prezentace firmy, komunikace s lidmi, kteří nás sledují nebo nám píší',
    zaklad: 'čl. 6 odst. 1 písm. f) GDPR (oprávněný zájem na prezentaci firmy); za zpracování na straně sociální sítě odpovídá její provozovatel podle vlastních zásad',
    udaje: 'veřejný profil, komentáře, zprávy, reakce',
    dotknuti: 'uživatelé sociálních sítí, kteří s profilem pracují',
    prijemcovia: ['provozovatel sociální sítě (společný správce pro statistiky stránky)'],
    lehota: 'po dobu existence profilu; zprávy 1 rok od vyřízení',
  });
  if (ma(d, 'zamestnanci')) out.push({
    id: 'zamestnanci', nazov: 'Zaměstnanci a dohodáři (personální a mzdová agenda)',
    ucel: 'plnění pracovní smlouvy, mzdy, odvody, daně, BOZP, evidence docházky',
    zaklad: 'čl. 6 odst. 1 písm. b) GDPR (pracovní smlouva) a čl. 6 odst. 1 písm. c) GDPR (zákoník práce, zákon o pojistném na sociální zabezpečení, zákon o daních z příjmů, zákon o veřejném zdravotním pojištění)',
    udaje: 'identifikační a kontaktní údaje, rodné číslo, číslo účtu, údaje o vzdělání a praxi, mzdové údaje, docházka, údaje o zdravotní způsobilosti v rozsahu podle zákona',
    dotknuti: 'zaměstnanci, dohodáři, jejich rodinní příslušníci v rozsahu daňového zvýhodnění',
    prijemcovia: ['Česká správa sociálního zabezpečení', 'zdravotní pojišťovny', 'finanční úřad', 'mzdová nebo účetní firma', 'poskytovatel pracovnělékařských služeb'],
    lehota: lehota(d, 'zamestnanci'),
  });
  if (ma(d, 'uchadzaci')) out.push({
    id: 'uchadzaci', nazov: 'Uchazeči o zaměstnání',
    ucel: 'výběr zaměstnanců',
    zaklad: 'čl. 6 odst. 1 písm. b) GDPR (opatření před uzavřením pracovní smlouvy); uchování životopisu po skončení výběru jen se souhlasem (čl. 6 odst. 1 písm. a) GDPR)',
    udaje: 'životopis, motivační dopis, kontaktní údaje, údaje z pohovoru',
    dotknuti: 'uchazeči',
    prijemcovia: ['personální agentura, pokud se použije'],
    lehota: lehota(d, 'uchadzaci'),
  });
  if (ma(d, 'kamery')) out.push({
    id: 'kamery', nazov: 'Kamerový systém',
    ucel: 'ochrana majetku, bezpečnost osob a odhalování protiprávního jednání v provozovně',
    zaklad: 'čl. 6 odst. 1 písm. f) GDPR (oprávněný zájem na ochraně majetku a osob); vůči zaměstnancům informování podle § 316 zákoníku práce',
    udaje: 'obrazový záznam osob v monitorovaném prostoru, čas záznamu',
    dotknuti: 'zákazníci, návštěvníci, zaměstnanci v monitorovaném prostoru',
    prijemcovia: ['policie a soudy při uplatnění práv'],
    lehota: lehota(d, 'kamery'),
  });
  return out;
}

function prijemcoviaText(d) {
  const riadky = nastroje(d).map((x) => `${x.nazov}: ${x.kto} (${x.ucel})`);
  if (d.nastrojeIne) riadky.push(d.nastrojeIne);
  return riadky;
}

export function d1Zasady(d) {
  const f = d.firma || {};
  const zo = poverenec(d);
  const c = cinnosti(d);
  const b = [];
  b.push(h(1, 'Zásady ochrany osobních údajů'));
  b.push(p(`Tyto zásady vysvětlují, jak ${f.nazov || '[název firmy]'} zpracovává osobní údaje lidí, kteří používají web ${f.web || '[web]'}, nakupují u nás nebo s námi komunikují. Platí od ${datum(d.datum) || '[datum]'}.`));
  b.push(h(2, '1. Kdo je správce'));
  b.push(p(`Správcem osobních údajů je ${firma(d) || '[název, sídlo, IČO]'}${kontakt(d) ? ', ' + kontakt(d) : ''}.`));
  if (zo) b.push(p(`Pověřenec pro ochranu osobních údajů: ${zo}. Můžete se na něj obrátit s každou otázkou o zpracování vašich údajů.`));
  else b.push(p('Pověřence podle čl. 37 GDPR jsme nemuseli jmenovat; s dotazy k osobním údajům se obraťte na kontakty výše.'));
  b.push(h(2, '2. Jaké údaje zpracováváme, proč a na jakém právním základě'));
  if (!c.length) b.push(p('Ve formuláři nebyla vybrána žádná činnost. Vyberte alespoň jednu, aby měl tento článek obsah.'));
  for (const x of c) {
    b.push(h(3, x.nazov));
    b.push(p(`**Účel:** ${x.ucel}.`));
    b.push(p(`**Právní základ:** ${x.zaklad}.`));
    b.push(p(`**Údaje:** ${x.udaje}.`));
    b.push(p(`**Doba uchování:** ${x.lehota}.`));
  }
  b.push(h(2, '3. Komu údaje předáváme'));
  b.push(p('Osobní údaje neprodáváme. Předáváme je jen těm, kdo je potřebují k účelům uvedeným výše: zpracovatelům, kteří pro nás pracují na základě smlouvy podle čl. 28 GDPR, a orgánům, kterým to ukládá zákon.'));
  const pr = prijemcoviaText(d);
  if (pr.length) b.push(ul(pr));
  else b.push(p('Seznam zpracovatelů: [doplňte podle nástrojů a služeb, které používáte].'));
  b.push(h(2, '4. Předávání údajů mimo Evropskou unii'));
  if (prenosUSA(d)) b.push(p('Někteří naši dodavatelé (například poskytovatelé analytiky, reklamy, plateb nebo e-mailu) mají mateřské společnosti v USA a údaje se mohou předat mimo Evropský hospodářský prostor. Předání se opírá o rozhodnutí Evropské komise o odpovídající ochraně pro rámec EU-U.S. Data Privacy Framework (společnosti, které jsou v něm certifikovány) nebo o standardní smluvní doložky Evropské komise podle čl. 46 odst. 2 písm. c) GDPR. Kopii doložek vám na požádání poskytneme.'));
  else b.push(p('Osobní údaje nepředáváme mimo Evropskou unii a Evropský hospodářský prostor. Pokud se to změní, tyto zásady doplníme a předání zajistíme podle kapitoly V GDPR.'));
  b.push(h(2, '5. Vaše práva'));
  b.push(p('Podle GDPR máte právo:'));
  b.push(ul([
    'na přístup k údajům, které o vás máme, a na jejich kopii (čl. 15),',
    'na opravu nesprávných nebo neúplných údajů (čl. 16),',
    'na výmaz, pokud už údaje nepotřebujeme nebo je zpracováváme protiprávně (čl. 17),',
    'na omezení zpracování (čl. 18),',
    'na přenositelnost údajů, které jste nám dali na základě souhlasu nebo smlouvy (čl. 20),',
    'vznést námitku proti zpracování založenému na oprávněném zájmu, včetně přímého marketingu (čl. 21),',
    'kdykoli odvolat souhlas; odvolání nemá vliv na zákonnost zpracování před ním (čl. 7 odst. 3),',
    'podat stížnost dozorovému úřadu: ' + URAD + ' (čl. 77).',
  ]));
  b.push(p(`Žádost pošlete na ${f.email || '[e-mail]'}. Odpovíme do jednoho měsíce; u složité žádosti můžeme lhůtu prodloužit o další dva měsíce a dáme vám o tom vědět (čl. 12 odst. 3 GDPR). Pokud si nebudeme jisti, kdo žádá, můžeme vás požádat o ověření totožnosti.`));
  b.push(h(2, '6. Jak údaje chráníme'));
  b.push(p('Přístup k údajům mají jen lidé, kteří je potřebují ke své práci a jsou poučeni o mlčenlivosti. Web běží přes šifrované spojení (HTTPS), hesla ukládáme jen v zašifrované podobě, zálohujeme a přístupy chráníme hesly a dvoufaktorovým ověřením tam, kde je dostupné (čl. 32 GDPR).'));
  const cookies = ma(d, 'analytika') || (d.cookies && (d.cookies.analyticke || d.cookies.marketingove));
  if (cookies) {
    b.push(h(2, '7. Cookies'));
    b.push(p('Používáme nezbytné cookies, bez kterých web nefunguje (například košík nebo přihlášení). Ostatní cookies (analytické, marketingové) ukládáme jen s vaším souhlasem, který dáváte v cookie liště a můžete ho kdykoli změnit. Podrobnosti jsou v samostatných Zásadách používání cookies.'));
  }
  b.push(h(2, (cookies ? '8' : '7') + '. Automatizované rozhodování a změny zásad'));
  b.push(p('Neprovádíme rozhodnutí založená výhradně na automatizovaném zpracování, která by pro vás měla právní účinky (čl. 22 GDPR). Tyto zásady můžeme aktualizovat; aktuální verze je vždy na našem webu a při podstatné změně vás upozorníme.'));
  return b;
}

export function d2Cookies(d) {
  const f = d.firma || {};
  const ck = d.cookies || {};
  const n = nastroje(d);
  const b = [];
  b.push(h(1, 'Zásady používání cookies'));
  b.push(p(`Web ${f.web || '[web]'} provozuje ${firma(d) || '[firma]'}. Cookies jsou malé soubory, které prohlížeč uloží do vašeho zařízení. Podle § 89 odst. 3 zákona č. 127/2005 Sb., o elektronických komunikacích, smíme do vašeho zařízení ukládat nebo z něj číst údaje jen s vaším prokazatelným souhlasem; výjimkou jsou cookies nezbytné pro poskytnutí služby, kterou jste si sami vyžádali.`));
  b.push(h(2, 'Jaké cookies používáme'));
  const rows = [['Kategorie', 'K čemu slouží', 'Právní základ', 'Jak dlouho']];
  rows.push(['Nezbytné', 'chod webu: košík, přihlášení, zapamatování souhlasu s cookies, ochrana formulářů před zneužitím', 'bez souhlasu (výjimka podle § 89 odst. 3), oprávněný zájem', 'relace až 12 měsíců']);
  if (ck.analyticke) rows.push(['Analytické', 'měření návštěvnosti: které stránky se čtou, odkud lidé přišli, kolik jich je', 'souhlas', 'až 14 měsíců']);
  if (ck.marketingove) rows.push(['Marketingové', 'měření výsledků reklamy a její cílení na jiných webech a sociálních sítích', 'souhlas', 'až 13 měsíců']);
  b.push(tbl(rows));
  if (!ck.analyticke && !ck.marketingove) b.push(p('Analytické ani marketingové cookies nepoužíváme. Pokud měříme návštěvnost, děláme to bez cookies a bez identifikace osoby.'));
  const tretie = n.filter((x) => x.cookies);
  if (tretie.length) {
    b.push(h(2, 'Cookies třetích stran'));
    b.push(ul(tretie.map((x) => `${x.nazov}: ${x.kto}; ${x.ucel}. Údaje se mohou předat do USA (rámec EU-U.S. Data Privacy Framework nebo standardní smluvní doložky).`)));
  }
  b.push(h(2, 'Jak souhlas dát, změnit nebo odvolat'));
  b.push(p('Při první návštěvě se zobrazí cookie lišta. Dokud nedáte souhlas, ukládají se jen nezbytné cookies. Souhlas můžete kdykoli změnit odkazem „Nastavení cookies" v patičce webu. Cookies můžete smazat i v nastavení prohlížeče; web pak může fungovat omezeně.'));
  b.push(h(2, 'Text cookie lišty (k vložení do webu)'));
  b.push(p(`**Nadpis:** Cookies na ${f.web || '[web]'}`));
  b.push(p('**Text:** Nezbytné cookies používáme, aby web fungoval. Analytické a marketingové cookies použijeme, jen pokud nám to dovolíte. Svou volbu můžete kdykoli změnit. Více v Zásadách používání cookies.'));
  b.push(p('**Tlačítka:** Přijmout vše · Odmítnout volitelné · Nastavení. Tlačítko „Odmítnout" musí být stejně viditelné jako „Přijmout" (doporučení Úřadu pro ochranu osobních údajů k cookie lištám).'));
  return b;
}

export function d3Zaznamy(d) {
  const c = cinnosti(d);
  const b = [];
  b.push(h(1, 'Záznamy o činnostech zpracování'));
  b.push(p(`Správce: ${firma(d) || '[firma]'}${kontakt(d) ? ', ' + kontakt(d) : ''}. Zástupce správce: ${(d.firma || {}).zastupca || '[jednatel]'}. Pověřenec: ${poverenec(d) || 'nejmenován'}. Záznamy vedené podle čl. 30 odst. 1 GDPR, stav k ${datum(d.datum) || '[datum]'}.`));
  b.push(p('Poznámka: povinnost vést záznamy má i firma s méně než 250 zaměstnanci, pokud zpracování není příležitostné (čl. 30 odst. 5 GDPR); vyřizování objednávek nebo mzdová agenda příležitostné nejsou.'));
  if (!c.length) b.push(p('Ve formuláři nebyla vybrána žádná činnost.'));
  c.forEach((x, i) => {
    b.push(h(2, `Činnost ${i + 1}: ${x.nazov}`));
    b.push(tbl([
      ['Položka', 'Obsah'],
      ['Účel zpracování', x.ucel],
      ['Právní základ', x.zaklad],
      ['Kategorie subjektů údajů', x.dotknuti],
      ['Kategorie osobních údajů', x.udaje],
      ['Kategorie příjemců', x.prijemcovia.join('; ')],
      ['Předání do třetí země', prenosUSA(d) && ['analytika', 'newsletter', 'eshop', 'kontakt', 'socialne'].includes(x.id) ? 'možné předání do USA přes dodavatele (EU-U.S. Data Privacy Framework nebo standardní smluvní doložky)' : 'ne'],
      ['Lhůta pro výmaz', x.lehota],
      ['Bezpečnostní opatření (čl. 32)', 'řízení přístupů podle role, hesla a dvoufaktorové ověření, šifrované spojení, zálohování, poučení oprávněných osob, smlouvy se zpracovateli, evidence porušení'],
    ]));
  });
  b.push(h(2, 'Zpracovatelé'));
  const pr = prijemcoviaText(d);
  b.push(pr.length ? ul(pr) : p('[doplňte]'));
  b.push(h(2, 'Změny záznamů'));
  b.push(tbl([['Datum', 'Kdo', 'Co se změnilo'], [datum(d.datum) || '', (d.firma || {}).zastupca || '', 'první vydání']]));
  return b;
}

export function d4Zmluva(d) {
  const b = [];
  b.push(h(1, 'Smlouva o zpracování osobních údajů (zpracovatelská smlouva)'));
  b.push(p('uzavřená podle čl. 28 odst. 3 nařízení (EU) 2016/679 (GDPR)'));
  b.push(p(`**Správce:** ${firma(d) || '[firma]'}, zastoupený ${(d.firma || {}).zastupca || '[jednatel]'}`));
  b.push(p('**Zpracovatel:** [název, sídlo, IČO, zastoupený]'));
  b.push(h(2, '1. Předmět a doba trvání'));
  b.push(p('Zpracovatel zpracovává pro správce osobní údaje v rozsahu a za účelem uvedeným v příloze 1, výhradně podle doložených pokynů správce, po dobu trvání hlavní smlouvy: [název hlavní smlouvy, datum].'));
  b.push(h(2, '2. Povinnosti zpracovatele (čl. 28 odst. 3 GDPR)'));
  b.push(ul([
    'zpracovává údaje jen na základě doložených pokynů správce, včetně předání do třetí země; pokud mu právo Unie nebo členského státu ukládá zpracovávat jinak, oznámí to správci předem,',
    'zajistí, že osoby oprávněné zpracovávat údaje se zavázaly k mlčenlivosti,',
    'přijme technická a organizační opatření podle čl. 32 GDPR uvedená v příloze 2,',
    'zapojí dalšího zpracovatele jen s předchozím písemným souhlasem správce (obecný souhlas se seznamem v příloze 3, změny oznámí 30 dní předem) a uloží mu stejné povinnosti,',
    'pomáhá správci vyřizovat žádosti subjektů údajů podle kapitoly III GDPR,',
    'pomáhá správci plnit povinnosti podle čl. 32 až 36 GDPR (zabezpečení, ohlášení porušení, posouzení vlivu),',
    'oznámí správci každé porušení zabezpečení osobních údajů bez zbytečného odkladu, nejpozději do 24 hodin od zjištění, s údaji podle čl. 33 odst. 3 GDPR,',
    'po skončení poskytování služeb údaje podle rozhodnutí správce vymaže nebo vrátí a vymaže existující kopie, pokud právo Unie nebo členského státu nevyžaduje jejich uložení,',
    'poskytne správci informace potřebné k doložení plnění povinností a umožní audity a kontroly prováděné správcem nebo jím pověřeným auditorem, oznámené alespoň 14 dní předem,',
    'neprodleně informuje správce, pokud podle jeho názoru pokyn porušuje GDPR nebo jiné právo na ochranu údajů.',
  ]));
  b.push(h(2, '3. Povinnosti správce'));
  b.push(p('Správce odpovídá za zákonnost zpracování, právní základ, informování subjektů údajů a za to, že pokyny jsou v souladu s GDPR. Pokyny dává písemně nebo e-mailem.'));
  b.push(h(2, '4. Předání do třetích zemí'));
  b.push(p('Předání mimo EHP je možné jen na základě rozhodnutí o odpovídající ochraně (čl. 45 GDPR) nebo standardních smluvních doložek (čl. 46 odst. 2 písm. c) GDPR), které jsou přílohou této smlouvy, a po posouzení práva cílové země.'));
  b.push(h(2, '5. Odpovědnost a závěrečná ustanovení'));
  b.push(p('Každá strana odpovídá za újmu podle čl. 82 GDPR. Smlouva se řídí právem České republiky. Změny jen písemně. Vyhotovena ve dvou stejnopisech.'));
  b.push(p('V ____________ dne ____________'));
  b.push(tbl([['Správce', 'Zpracovatel'], ['\n\n______________________', '\n\n______________________']]));
  b.push(h(2, 'Příloha 1: předmět zpracování'));
  b.push(tbl([['Položka', 'Obsah'], ['Účel', '[např. hosting e-shopu, rozesílání newsletteru, vedení účetnictví]'], ['Kategorie subjektů údajů', '[zákazníci, odběratelé, zaměstnanci]'], ['Kategorie údajů', '[jméno, e-mail, adresa, údaje o objednávce]'], ['Doba zpracování', '[po dobu trvání hlavní smlouvy]']]));
  b.push(h(2, 'Příloha 2: bezpečnostní opatření zpracovatele'));
  b.push(ul(['řízení přístupů a oprávnění, zásada nejmenších práv', 'šifrování přenosu (TLS) a údajů v klidu, kde je to možné', 'zálohování a plán obnovy', 'logování přístupů, pravidelné aktualizace', 'poučení a mlčenlivost pracovníků', 'postup při incidentu s oznámením do 24 hodin']));
  b.push(h(2, 'Příloha 3: schválení další zpracovatelé'));
  b.push(tbl([['Název', 'Sídlo', 'Účel', 'Země zpracování'], ['[doplňte]', '', '', '']]));
  return b;
}

export function d5Suhlas(d) {
  const f = d.firma || {};
  const b = [];
  b.push(h(1, 'Souhlas se zpracováním osobních údajů a texty pod formuláře'));
  b.push(p('Souhlas podle čl. 6 odst. 1 písm. a) a čl. 7 GDPR musí být svobodný, konkrétní, informovaný a jednoznačný; nesmí být předem zaškrtnutý a musí jít odvolat stejně snadno, jako se dal.'));
  b.push(h(2, 'A. Souhlas s newsletterem (text u políčka)'));
  b.push(p(`☐ Souhlasím, aby ${f.nazov || '[firma]'} používal můj e-mail k zasílání novinek a nabídek. Souhlas mohu kdykoli odvolat odkazem v každém e-mailu nebo zprávou na ${f.email || '[e-mail]'}. Více v Zásadách ochrany osobních údajů.`));
  b.push(h(2, 'B. Text pod kontaktním formulářem (bez souhlasu, informace)'));
  b.push(p(`Odesláním zprávy zpracováváme vaše jméno, e-mail a obsah zprávy, abychom vám odpověděli (čl. 6 odst. 1 písm. b) a f) GDPR). Údaje uchováváme ${lehota(d, 'kontakt')}. Více v Zásadách ochrany osobních údajů.`));
  b.push(h(2, 'C. Text u objednávky (bez souhlasu, informace)'));
  b.push(p(`Vaše údaje zpracováváme k vyřízení objednávky, doručení a vystavení dokladu (čl. 6 odst. 1 písm. b) a c) GDPR) a předáme je dopravci a platební bráně. Uchováváme je ${lehota(d, 'objednavky')}. Více v Zásadách ochrany osobních údajů.`));
  b.push(h(2, 'D. Souhlas uchazeče s uchováním životopisu'));
  b.push(p(`☐ Souhlasím, aby ${f.nazov || '[firma]'} uchoval můj životopis a údaje z výběrového řízení za účelem oslovení s další pracovní nabídkou po dobu 1 roku. Souhlas mohu kdykoli odvolat na ${f.email || '[e-mail]'}.`));
  b.push(h(2, 'E. Písemný souhlas (samostatný dokument)'));
  b.push(p('Subjekt údajů: [jméno, příjmení, adresa nebo e-mail]'));
  b.push(p(`Správce: ${firma(d) || '[firma]'}`));
  b.push(p('Účel: [např. zveřejnění fotografie z akce na webu a sociálních sítích správce]'));
  b.push(p('Rozsah údajů: [např. podobizna, jméno]'));
  b.push(p('Doba: [např. 3 roky od udělení souhlasu]'));
  b.push(p('Souhlas uděluji dobrovolně. Byl jsem informován, že ho mohu kdykoli odvolat, aniž by to mělo vliv na zákonnost zpracování před odvoláním, a o svých právech podle čl. 15 až 22 GDPR uvedených v Zásadách ochrany osobních údajů.'));
  b.push(p('V ____________ dne ____________   podpis ______________________'));
  b.push(h(2, 'F. Evidence souhlasů'));
  b.push(p('Správce musí umět prokázat, kdo, kdy, k čemu a jakým způsobem souhlas dal (čl. 7 odst. 1 GDPR). U online souhlasu uchovejte: e-mail, datum a čas, IP adresu nebo identifikátor, znění souhlasu, způsob (políčko, double opt-in).'));
  b.push(tbl([['Subjekt údajů', 'Účel', 'Datum a způsob udělení', 'Znění', 'Odvolání'], ['', '', '', '', '']]));
  return b;
}

export function d6Zamestnanci(d) {
  const f = d.firma || {};
  const b = [];
  b.push(h(1, 'Informace pro zaměstnance o zpracování osobních údajů'));
  b.push(p(`podle čl. 13 GDPR. Zaměstnavatel a správce: ${firma(d) || '[firma]'}${kontakt(d) ? ', ' + kontakt(d) : ''}. Pověřenec: ${poverenec(d) || 'nejmenován; obraťte se na jednatele'}.`));
  b.push(h(2, '1. Účely a právní základy'));
  b.push(tbl([
    ['Účel', 'Právní základ', 'Údaje'],
    ['uzavření a plnění pracovní smlouvy nebo dohody', 'čl. 6 odst. 1 písm. b) GDPR', 'identifikační a kontaktní údaje, vzdělání, praxe, číslo účtu'],
    ['mzdy, odvody, daně, sociální a zdravotní pojištění', 'čl. 6 odst. 1 písm. c) GDPR; zákoník práce, zákon č. 589/1992 Sb., zákon č. 592/1992 Sb., zákon č. 586/1992 Sb.', 'rodné číslo, mzdové údaje, údaje o rodinných příslušnících pro daňové zvýhodnění'],
    ['bezpečnost a ochrana zdraví při práci, pracovnělékařské služby', 'čl. 6 odst. 1 písm. c) GDPR; zákon č. 309/2006 Sb., zákon č. 373/2011 Sb.', 'údaje o zdravotní způsobilosti v rozsahu podle zákona (čl. 9 odst. 2 písm. b) GDPR)'],
    ['evidence docházky a pracovní doby', 'čl. 6 odst. 1 písm. c) GDPR; § 96 zákoníku práce', 'příchody, odchody, nepřítomnost'],
    ['pracovní e-mail, přístupy do systémů, služební telefon', 'čl. 6 odst. 1 písm. f) GDPR (oprávněný zájem na chodu firmy)', 'přihlašovací údaje, logy přístupů'],
    ...(ma(d, 'kamery') ? [['kamerový systém v provozovně', 'čl. 6 odst. 1 písm. f) GDPR; informování podle § 316 zákoníku práce', 'obrazový záznam v monitorovaném prostoru, ne na pracovišti bez závažného důvodu']] : []),
  ]));
  b.push(h(2, '2. Příjemci'));
  b.push(ul(['Česká správa sociálního zabezpečení, zdravotní pojišťovny, finanční úřad, úřad práce', 'mzdová nebo účetní firma (zpracovatel)', 'poskytovatel pracovnělékařských služeb', 'banka při výplatě mzdy', 'poskytovatelé softwaru pro docházku a personalistiku (zpracovatelé)']));
  b.push(h(2, '3. Doba uchování'));
  b.push(p(`Osobní spis po dobu pracovního poměru; po skončení podle spisového plánu a zákonů: mzdové listy a údaje potřebné pro důchodové účely po dobu stanovenou § 35a zákona č. 582/1991 Sb., ostatní mzdové doklady podle zákona o účetnictví a daňových předpisů, evidence docházky 3 roky. Nastaveno ve formuláři: ${lehota(d, 'zamestnanci')}.`));
  b.push(h(2, '4. Sledování'));
  b.push(p(`Zaměstnavatel ${ma(d, 'kamery') ? 'používá kamerový systém k ochraně majetku a bezpečnosti osob v prostorách: [uveďte prostory]. Kamery nesnímají šatny, toalety ani odpočinkové místnosti. Záznam se uchovává ' + lehota(d, 'kamery') + '.' : 'nepoužívá kamerový systém na pracovišti.'} Zaměstnavatel nekontroluje soukromou korespondenci zaměstnanců; služební e-mail a zařízení může kontrolovat jen v rozsahu potřebném pro chod firmy, ze závažného důvodu a po předchozím informování o rozsahu a způsobu kontroly (§ 316 zákoníku práce).`));
  b.push(h(2, '5. Vaše práva'));
  b.push(p(`Máte právo na přístup, opravu, výmaz, omezení, přenositelnost a námitku podle čl. 15 až 21 GDPR a právo podat stížnost u Úřadu pro ochranu osobních údajů, Pplk. Sochora 27, 170 00 Praha 7. Žádosti: ${f.email || '[e-mail]'}. Poskytnutí údajů pro účely pracovního poměru a zákonných povinností je nezbytné; bez nich nemůžeme pracovní poměr uzavřít ani vést.`));
  b.push(p('Převzetí potvrzuji: jméno ______________________ datum __________ podpis ______________________'));
  return b;
}

export function d7Smernica(d) {
  const f = d.firma || {};
  const c = cinnosti(d);
  const b = [];
  b.push(h(1, 'Vnitřní směrnice o ochraně osobních údajů'));
  b.push(p(`${firma(d) || '[firma]'}. Platí od ${datum(d.datum) || '[datum]'}. Schválil: ${f.zastupca || '[jednatel]'}.`));
  b.push(h(2, '1. Účel směrnice'));
  b.push(p('Směrnice určuje, jak firma a její pracovníci nakládají s osobními údaji, aby bylo zpracování zákonné, bezpečné a doložitelné (čl. 5 odst. 2 a čl. 24 GDPR).'));
  b.push(h(2, '2. Zásady (čl. 5 GDPR)'));
  b.push(ul(['zákonnost, korektnost a transparentnost: každé zpracování má právní základ a lidé o něm vědí,', 'účelové omezení: údaje se použijí jen k účelu, ke kterému se získaly,', 'minimalizace: sbíráme jen to, co potřebujeme,', 'přesnost: nesprávné údaje opravíme,', 'omezení uložení: údaje mažeme po uplynutí lhůty v záznamech,', 'integrita a důvěrnost: přístup mají jen oprávnění lidé, údaje jsou chráněny.']));
  b.push(h(2, '3. Role'));
  b.push(tbl([['Role', 'Kdo', 'Odpovídá za'], ['statutární orgán', f.zastupca || '[jednatel]', 'schvalování směrnice, smluv se zpracovateli, rozhodnutí o porušeních'], ['pověřenec', poverenec(d) || 'nejmenován (čl. 37 GDPR to nevyžaduje)', 'poradenství, kontakt s úřadem a subjekty údajů'], ['oprávněné osoby', 'pracovníci s přístupem k údajům podle pověření', 'dodržování této směrnice']]));
  b.push(h(2, '4. Činnosti zpracování'));
  b.push(p(c.length ? 'Firma vede záznamy o činnostech zpracování (samostatný dokument). Činnosti: ' + c.map((x) => x.nazov).join('; ') + '.' : 'Firma vede záznamy o činnostech zpracování (samostatný dokument).'));
  b.push(h(2, '5. Pravidla pro pracovníky'));
  b.push(ul([
    'každý má vlastní přihlašovací údaje, hesla se nesdílejí a nezapisují; kde je to možné, je zapnuté dvoufaktorové ověření,',
    'osobní údaje se neposílají soukromými e-maily ani přes soukromé aplikace pro zprávy,',
    'dokumenty s osobními údaji se neukládají na soukromá zařízení; při odchodu od počítače se obrazovka zamkne,',
    'papírové dokumenty jsou v uzamčené skříni; nepotřebné se skartují,',
    'údaje se předají třetí straně jen s právním základem a po ověření totožnosti žadatele,',
    'každé podezření na porušení (ztráta zařízení, chybně odeslaný e-mail, únik) se hlásí statutárnímu orgánu ihned, nejpozději do 24 hodin,',
    'žádosti subjektů údajů se předají statutárnímu orgánu nebo pověřenci v den přijetí,',
    'nové nástroje, které zpracovávají osobní údaje, se zavádějí až po uzavření zpracovatelské smlouvy a doplnění záznamů.',
  ]));
  b.push(h(2, '6. Zpracovatelé'));
  b.push(p('S každým dodavatelem, který zpracovává osobní údaje pro firmu, je uzavřena smlouva podle čl. 28 GDPR (vlastní vzor nebo podmínky dodavatele, které čl. 28 splňují). Seznam je v záznamech o činnostech zpracování.'));
  b.push(h(2, '7. Zabezpečení (čl. 32 GDPR)'));
  b.push(ul(['přístupy podle role, odebrání přístupů v den skončení spolupráce,', 'aktualizovaný software, antivir, šifrované disky notebooků,', 'zálohy alespoň jednou týdně, ověřená obnova alespoň jednou ročně,', 'HTTPS na webu, hesla zákazníků jen v zašifrované podobě,', 'evidence porušení a jednou ročně kontrola této směrnice.']));
  b.push(h(2, '8. Poučení a pověření oprávněné osoby (vzor)'));
  b.push(p('Jméno: ______________________ Pracovní pozice: ______________________'));
  b.push(p('Byl/a jsem poučen/a o povinnostech při zpracování osobních údajů podle GDPR, zákona č. 110/2019 Sb. a této směrnice, o rozsahu svého oprávnění (systémy: ______________________) a o povinnosti mlčenlivosti, která trvá i po skončení spolupráce.'));
  b.push(p('V ____________ dne ____________   podpis ______________________'));
  return b;
}

export function d8Porusenie(d) {
  const f = d.firma || {};
  const b = [];
  b.push(h(1, 'Postup při porušení zabezpečení osobních údajů'));
  b.push(p(`${firma(d) || '[firma]'}. Podle čl. 33 a 34 GDPR. Odpovídá: ${f.zastupca || '[jednatel]'}${poverenec(d) ? ', pověřenec ' + poverenec(d) : ''}.`));
  b.push(h(2, '1. Co je porušení'));
  b.push(p('Porušením je každá událost, při níž se osobní údaje náhodně nebo protiprávně zničí, ztratí, změní, neoprávněně zpřístupní nebo se k nim někdo dostane (čl. 4 bod 12 GDPR): ztracený notebook, e-mail poslaný nesprávnému příjemci, únik databáze, ransomware, zaměstnanec, který si prohlíží údaje bez důvodu.'));
  b.push(h(2, '2. Postup krok za krokem'));
  b.push(tbl([
    ['Krok', 'Kdy', 'Kdo', 'Co'],
    ['1. Zastavit a zabezpečit', 'ihned', 'každý, kdo zjistí', 'odpojit zařízení, změnit hesla, zablokovat přístup, nezničit důkazy'],
    ['2. Nahlásit dovnitř', 'do 24 hodin', 'každý, kdo zjistí', 'statutárnímu orgánu nebo pověřenci: co, kdy, čí údaje, kolik'],
    ['3. Posoudit riziko', 'do 48 hodin', 'statutární orgán', 'jaké údaje, kolik osob, jaké následky (finanční škoda, diskriminace, krádež identity), zda jsou údaje šifrované'],
    ['4. Ohlásit Úřadu', 'do 72 hodin od zjištění', 'statutární orgán', 'pokud porušení pravděpodobně povede k riziku pro práva osob: Úřad pro ochranu osobních údajů, posta@uoou.gov.cz, formulář na uoou.gov.cz (čl. 33)'],
    ['5. Oznámit subjektům údajů', 'bez zbytečného odkladu', 'statutární orgán', 'pokud je riziko vysoké: jasným jazykem, co se stalo, jaké následky hrozí, co děláme a co mají udělat (čl. 34)'],
    ['6. Zapsat', 'vždy, i bez ohlášení', 'statutární orgán', 'do evidence níže: fakta, následky, opatření (čl. 33 odst. 5)'],
    ['7. Poučit se', 'do 30 dní', 'statutární orgán', 'co změnit, aby se to neopakovalo; upravit směrnici'],
  ]));
  b.push(h(2, '3. Vzor ohlášení Úřadu (obsah podle čl. 33 odst. 3)'));
  b.push(ul(['povaha porušení, kategorie a přibližný počet dotčených osob a záznamů,', 'jméno a kontakt pověřence nebo jiného kontaktu,', 'pravděpodobné důsledky,', 'přijatá a navrhovaná opatření včetně zmírnění důsledků.']));
  b.push(h(2, '4. Vzor oznámení subjektům údajů'));
  b.push(p(`Dobrý den, dne [datum] došlo u ${f.nazov || '[firma]'} k [popis: např. neoprávněnému přístupu k databázi zákazníků]. Týkalo se to těchto vašich údajů: [seznam]. Možné důsledky: [např. podvodné e-maily vaším jménem]. Co jsme udělali: [např. zablokovali přístup, změnili hesla, ohlásili Úřadu]. Co doporučujeme vám: [např. změnit heslo, neotvírat podezřelé e-maily]. Kontakt: ${f.email || '[e-mail]'}${poverenec(d) ? ', pověřenec ' + poverenec(d) : ''}.`));
  b.push(h(2, '5. Evidence porušení'));
  b.push(tbl([['Datum zjištění', 'Co se stalo', 'Údaje a počet osob', 'Riziko', 'Ohlášeno Úřadu (datum)', 'Oznámeno osobám', 'Opatření'], ['', '', '', '', '', '', '']]));
  return b;
}

export function d9Ziadosti(d) {
  const f = d.firma || {};
  const b = [];
  b.push(h(1, 'Postup vyřizování žádostí subjektů údajů'));
  b.push(p(`${firma(d) || '[firma]'}. Podle čl. 12 a 15 až 22 GDPR. Žádosti přijímá: ${f.email || '[e-mail]'}${poverenec(d) ? ', pověřenec ' + poverenec(d) : ''}.`));
  b.push(h(2, '1. Lhůty'));
  b.push(p('Odpověď do **jednoho měsíce** od přijetí žádosti. U složitých nebo početných žádostí lze prodloužit o další dva měsíce; o prodloužení a důvodech je třeba osobu informovat do měsíce (čl. 12 odst. 3). Vyřízení je bezplatné; u zjevně nedůvodných nebo opakovaných žádostí lze žádat přiměřený poplatek nebo odmítnout (čl. 12 odst. 5).'));
  b.push(h(2, '2. Postup'));
  b.push(ul(['zapsat žádost do evidence v den přijetí (datum, kdo, co žádá, kanál),', 'ověřit totožnost, je-li pochybnost (odpověď na e-mail, z něhož se údaje sbíraly, nebo doplňující otázka; nežádat kopii dokladu, není-li to nutné),', 'vyhledat údaje ve všech systémech (e-shop, e-mail, účetnictví, newsletter, zálohy) a u zpracovatelů,', 'posoudit, zda lze právo uplatnit (např. výmaz není možný u údajů, které musíme uchovat podle zákona o účetnictví nebo o DPH),', 'odpovědět písemně, srozumitelně, stejným kanálem, pokud osoba nechce jinak,', 'zapsat vyřízení do evidence.']));
  b.push(h(2, '3. Co obsahuje odpověď na žádost o přístup (čl. 15)'));
  b.push(ul(['účely zpracování a právní základy,', 'kategorie údajů a kopie údajů,', 'příjemci nebo jejich kategorie, předání do třetích zemí a záruky,', 'doba uložení,', 'existence práv na opravu, výmaz, omezení, námitku a stížnost,', 'zdroj údajů, nejsou-li od osoby,', 'existence automatizovaného rozhodování.']));
  b.push(h(2, '4. Vzor odpovědi'));
  b.push(p(`Dobrý den, potvrzujeme přijetí vaší žádosti z [datum] o [přístup / opravu / výmaz / omezení / přenos / námitku]. [Přístup:] V příloze posíláme kopii údajů, které o vás zpracováváme, spolu s informacemi podle čl. 15 GDPR. [Výmaz:] Vaše údaje jsme vymazali ze všech systémů kromě [daňových dokladů], které musíme uchovat podle zákona č. 235/2004 Sb. do [datum]. [Námitka proti marketingu:] Váš e-mail jsme vyřadili z rozesílání; další marketingové zprávy už nedostanete. Pokud s vyřízením nesouhlasíte, můžete se obrátit na Úřad pro ochranu osobních údajů, Pplk. Sochora 27, 170 00 Praha 7. S pozdravem, ${f.nazov || '[firma]'}`));
  b.push(h(2, '5. Evidence žádostí'));
  b.push(tbl([['Datum přijetí', 'Kdo', 'Právo', 'Ověření totožnosti', 'Vyřízeno dne', 'Jak'], ['', '', '', '', '', '']]));
  return b;
}

export function d10Kamery(d) {
  const f = d.firma || {};
  const b = [];
  b.push(h(1, 'Kamerový systém: informační cedule a záznam'));
  b.push(h(2, 'A. Informační cedule (první vrstva, umístit před vstupem do monitorovaného prostoru)'));
  b.push(p('PROSTOR JE MONITOROVÁN KAMEROVÝM SYSTÉMEM SE ZÁZNAMEM'));
  b.push(p(`Správce: ${f.nazov || '[firma]'}, ${f.sidlo || '[sídlo]'}. Účel: ochrana majetku a bezpečnost osob (oprávněný zájem, čl. 6 odst. 1 písm. f) GDPR). Záznam uchováváme ${lehota(d, 'kamery')}. Vaše práva a úplné informace: ${f.web ? f.web + '/ochrana-osobnich-udaju' : '[web]'} nebo ${f.email || '[e-mail]'}.`));
  b.push(h(2, 'B. Úplná informace (druhá vrstva, na webu nebo na recepci)'));
  b.push(tbl([
    ['Položka', 'Obsah'],
    ['Správce', firma(d) || '[firma]'],
    ['Účel', 'ochrana majetku správce a bezpečnost osob, dokazování protiprávního jednání'],
    ['Právní základ', 'čl. 6 odst. 1 písm. f) GDPR; oprávněný zájem správce (posouzení níže)'],
    ['Monitorované prostory', '[např. prodejna, sklad, vstup; ne šatny, toalety, odpočinkové místnosti]'],
    ['Doba uchování', lehota(d, 'kamery')],
    ['Příjemci', 'policie, soudy a pojišťovna při uplatnění nároků; bezpečnostní agentura, je-li zpracovatelem'],
    ['Práva', 'přístup, výmaz, omezení, námitka (čl. 15 až 21 GDPR); stížnost u Úřadu pro ochranu osobních údajů'],
  ]));
  b.push(h(2, 'C. Posouzení oprávněného zájmu (balanční test)'));
  b.push(ul(['Zájem: ochrana zboží a zařízení v hodnotě [částka], bezpečnost zákazníků a zaměstnanců; v minulosti [uveďte incidenty, pokud byly].', 'Nezbytnost: mírnější opatření (zámky, alarm, dohled) nestačí k dokazování; kamery jsou omezeny na [prostory] a čas [nonstop / otevírací doba].', 'Vyvážení: záznam se uchovává krátce, přístup mají [kdo], zaměstnanci byli informováni podle § 316 zákoníku práce, cedule jsou u vstupu. Zájem převažuje.']));
  b.push(h(2, 'D. Záznam do evidence činností zpracování'));
  b.push(p('Kamerový systém je zapsán v záznamech o činnostech zpracování (samostatný dokument). Přístup k záznamu: [jména nebo pozice]. Kontrola nastavení a mazání: jednou za [3 měsíce].'));
  return b;
}

export const DOKUMENTY = [
  { id: 'd1', nazov: 'Zásady ochrany osobních údajů', popis: 'informační povinnost podle čl. 13 GDPR pro web, e-shop a zákazníky', fn: d1Zasady, zadarmo: true },
  { id: 'd2', nazov: 'Zásady používání cookies a text cookie lišty', popis: '§ 89 odst. 3 zákona č. 127/2005 Sb.', fn: d2Cookies },
  { id: 'd3', nazov: 'Záznamy o činnostech zpracování', popis: 'čl. 30 GDPR, jedna tabulka na každou činnost', fn: d3Zaznamy },
  { id: 'd4', nazov: 'Zpracovatelská smlouva', popis: 'čl. 28 GDPR, s přílohami', fn: d4Zmluva },
  { id: 'd5', nazov: 'Souhlasy a texty pod formuláře', popis: 'newsletter, kontakt, objednávka, uchazeč, písemný souhlas, evidence', fn: d5Suhlas },
  { id: 'd6', nazov: 'Informace pro zaměstnance', popis: 'čl. 13 GDPR a § 316 zákoníku práce', fn: d6Zamestnanci, len: 'zamestnanci' },
  { id: 'd7', nazov: 'Vnitřní směrnice a poučení oprávněné osoby', popis: 'pravidla pro pracovníky, role, zabezpečení', fn: d7Smernica },
  { id: 'd8', nazov: 'Postup při porušení zabezpečení údajů', popis: 'čl. 33 a 34 GDPR, 72 hodin, vzory oznámení, evidence', fn: d8Porusenie },
  { id: 'd9', nazov: 'Postup vyřizování žádostí subjektů údajů', popis: 'čl. 15 až 22 GDPR, lhůty, vzor odpovědi, evidence', fn: d9Ziadosti },
  { id: 'd10', nazov: 'Kamerový systém: cedule, informace, balanční test', popis: 'oprávněný zájem, § 316 zákoníku práce', fn: d10Kamery, len: 'kamery' },
];

export function zoznamDokumentov(d) {
  return DOKUMENTY.filter((x) => !x.len || ma(d, x.len));
}
