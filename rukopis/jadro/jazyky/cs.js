// Kandidátní fráze, nikoli důkaz autorství. Prahy čekají na kalibraci.
import sk from './sk.js?v=1.4';
// v1.4 (30. 9. 2026): výplňové obraty odborných a studentských textů (metatext „jak již bylo zmíněno“,
// „z uvedeného vyplývá“, prázdná hodnocení „hraje klíčovou roli“, „komplexní pohled“). Proč jsou typické:
// stylistické příručky odborného stylu varují před klišé a zbytečným metatextem (M. Čechová a kol.,
// Stylistika současné češtiny). Konkrétní seznam je náš redakční výběr, ne citace zdrojů. Obraty běžné
// v lidských textech (v rámci, z hlediska, v první řadě, za účelem) jsme po měření na Wikipedii z roku 2019 vynechali.
const ODBORNE = 'z uvedeného vyplývá|z výše uvedeného vyplývá|na základě výše uvedeného|jak již bylo zmíněno|jak již bylo uvedeno|jak bylo zmíněno|v současné době|v dnešním světě|v současném světě|v kontextu|v širším kontextu|nezastupitelnou roli|má zásadní vliv|má klíčový význam|je nutné poznamenat|je třeba zdůraznit|je důležité zdůraznit|stojí za povšimnutí|nezbytnou součástí|integrální součástí|neodmyslitelnou součástí|komplexní pohled|komplexní řešení|všechny aspekty|různé aspekty|hlubší pochopení|lepší pochopení|cenné poznatky|lze konstatovat|můžeme konstatovat|je možné konstatovat|vzhledem k výše uvedenému|s ohledem na výše uvedené|jedním z klíčových|klíčový faktor|klíčovým faktorem|efektivní nástroj|dynamicky se rozvíjející'.split('|');
const ROLE = /(?<!\p{L})(?:hraje|hrají|sehrává|sehrávají|hrál[aoy]?|sehrál[aoy]?)\s+(?:(?:velmi|mimořádně|stále)\s+)?(?:klíčovou|důležitou|významnou|zásadní|nezastupitelnou|podstatnou|rozhodující|ústřední|centrální)\s+roli(?!\p{L})/iu;
export default {
  ...sk,
  FRAZY: 'v dnešní době|v dnešním rychle se měnícím světě|nedílnou součástí|nedílná součást|posunout na další úroveň|na další úroveň|konkurenční výhodu|investice do budoucnosti|na poslední chvíli|hraje klíčovou roli|sehrává klíčovou roli|v neposlední řadě|pojďme se podívat|v tomto článku se podíváme|není žádným tajemstvím|svět se neustále mění|bez ohledu na to|je důležité si uvědomit|klíčové je|na závěr|nezapomínejte|v digitálním věku|v digitálním světě|digitální transformace|otevírá nové možnosti|otevírá dveře|přináší nové příležitosti|využít potenciál|odemknout potenciál|dosáhnout nových výšin|udržet krok|o krok napřed|cesta k úspěchu|klíč k úspěchu|základ úspěchu|dlouhodobý úspěch|udržitelný růst|dynamické prostředí|měnící se prostředí|neustále se vyvíjející|neustále se měnící|komplexní přístup|holistický přístup|inovativní řešení|efektivní řešení|řešení na míru|bezproblémová integrace|plynulý přechod|strategický partner|strategické partnerství|přidaná hodnota|vytvářet hodnotu|maximalizovat efektivitu|optimalizovat procesy|zefektivnit procesy|zvýšit produktivitu|podporovat inovace|budovat důvěru|silné základy|pevné základy|pevný základ|široká škála možností|široké spektrum|jedinečná příležitost|klíčový aspekt|důležitý aspekt|zásadní význam|zásadní roli|významnou roli|neocenitelný nástroj|nezbytný krok|důležitý krok|správným směrem|nová éra|budoucnost je tady|budoucnost podnikání|změnit pravidla hry|posouvá hranice|v srdci každého|na cestě k|stojí za zmínku|je třeba poznamenat|je potřeba zdůraznit|je důležité poznamenat|neméně důležité|v konečném důsledku|stručně řečeno|závěrem|celkově|připravit se na budoucnost|čelit výzvám|překonávat výzvy|proměnit výzvy v příležitosti'.split('|').concat(ODBORNE),
  KONSTRUKCIE: [/\bnení (to )?(jen|pouze) [^.;]{1,40}, (je to|ale)\b/iu, ROLE],
  ZAVER: 'na závěr|závěrem|celkově|stručně řečeno|v konečném důsledku|klíčové je|nakonec'.split('|'),
  MORAL: ['pamatujte', 'nezapomínejte'],
  NEISTOTA: 'nevím|nejsem si jistý|nejsem si jistá|možná|pravděpodobně|zřejmě|zatím netuším|mýlil jsem se|mýlila jsem se|nepodařilo se mi|nemám odpověď|pochybuji'.split('|'),
  ODBOCKY: ['mimochodem', 'jen tak mimochodem', 'btw'],
  FUNKCNE: 'a i ale nebo že se si jsem jsme jste jsou je byl byla byli bude budou by aby jak tak to ten ta ty na v ve z ze do od pro při po za s k o u není už jen ještě také však tedy když který která které jejich jeho její nás vás já on ona oni toto tu tam proto protože'.split(' '),
  JA: 'já mě mi mne můj moje jsem jsme nám nás náš'.split(' '),
  TY: 'ty tebe ti tě tvůj tvoje vy vás vám váš vaše jste'.split(' '),
  PRIPONY: ['ání', 'ení', 'tí', 'ost', 'ace', 'ismus'],
  VYNIMKY: [], /* v1.4 po bráne 1: bežné podstatné mená, nie dej namiesto slovesa (základ + najviac 4 znaky koncovky) */ BEZNE: ['informac', 'nezaměstnanost', 'zaměstnání', 'podnikání', 'vzdělání', 'organizac', 'společnost', 'veřejnost', 'osobnost', 'náměstí', 'století', 'populac', 'generac', 'federac', 'povolání', 'minulost', 'budoucnost', 'přítomnost', 'událost', 'vlastnost', 'místnost', 'oblast', 'domácnost'],
  SKRATKY: 'např.|tzv.|atd.|tj.|resp.|č.|str.|s. r. o.|a. s.|Ing.|Mgr.|Bc.|PhDr.|JUDr.|MUDr.|doc.|prof.|mil.|tis.|hod.|min.|ul.'.split('|'),
  ODPOVED: /^(ano|ne|protože|odpověď je|důvod je)(?!\p{L})/iu,
  VZTAZNE: /,\s*(?:kter[\p{L}]*|co|kdo)(?!\p{L})[^,]*$/iu,
  SPOJKY: 'a|i|nebo|či', KMEN: 5
};
