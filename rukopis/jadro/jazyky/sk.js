// Ručne zostavené kandidátne frázy, nie dôkaz autorstva ani kalibrácia.
// v1.4 (30. 9. 2026): výplňové obraty odborných a študentských textov (metatext „ako už bolo spomenuté“,
// „z uvedeného vyplýva“, prázdne hodnotenia „zohráva kľúčovú úlohu“, „komplexný pohľad“). Prečo sú typické:
// štylistické príručky odborného štýlu upozorňujú na klišé, vatové slová a zbytočný metatext (J. Mistrík,
// Štylistika; D. Katuščák, Ako písať záverečné a kvalifikačné práce); „za účelom“ jazykové poradne odporúčajú
// nahradiť „na“ alebo „s cieľom“. Konkrétny zoznam je náš redakčný výber, nie citát zo zdrojov. Obraty bežné
// v ľudských textoch (v rámci, z hľadiska, je potrebné, v prvom rade) sme vynechali po meraní na Wikipédii
// z roku 2019 a na súkromnej ľudskej práci (ops/strategia/humanizer/V14-STAV.md).
const ODBORNE = 'z uvedeného vyplýva|z vyššie uvedeného vyplýva|na základe vyššie uvedeného|ako už bolo spomenuté|ako už bolo uvedené|ako bolo spomenuté|ako bolo uvedené vyššie|v dnešnej modernej dobe|v súčasnej dobe|v dnešnom svete|v súčasnom svete|v dnešnom modernom svete|v kontexte|v širšom kontexte|nezastupiteľnú úlohu|má zásadný vplyv|má kľúčový význam|je potrebné poznamenať|je nutné poznamenať|treba zdôrazniť|je dôležité zdôrazniť|je potrebné podotknúť|stojí za povšimnutie|nevyhnutnou súčasťou|integrálnou súčasťou|neodmysliteľnou súčasťou|komplexný pohľad|komplexné riešenie|je nesmierne dôležité|za účelom|všetky aspekty|rôzne aspekty|rôznych aspektov|hlbšie pochopenie|lepšie pochopenie|cenné poznatky|možno konštatovať|môžeme konštatovať|je možné konštatovať|vzhľadom na vyššie uvedené|s ohľadom na uvedené|jedným z kľúčových|kľúčový faktor|kľúčovým faktorom|kľúčových faktorov|efektívny nástroj|účinný nástroj|dynamicky sa rozvíjajúci|v súčasnom dynamickom|v nemalej miere'.split('|');
// „zohráva/hrá kľúčovú (dôležitú, významnú…) úlohu“ vo všetkých tvaroch slovesa.
const ULOHA = /(?<!\p{L})(?:zohráva|zohrávajú|zohrával[aoi]?|hrá|hrajú|hral[aoi]?)\s+(?:(?:veľmi|mimoriadne|čoraz)\s+)?(?:kľúčovú|dôležitú|významnú|zásadnú|nezastupiteľnú|podstatnú|rozhodujúcu|nenahraditeľnú|centrálnu|ústrednú)\s+(?:úlohu|rolu)(?!\p{L})/iu;
export default {
  FRAZY: 'v dnešnej dobe|v dnešnom rýchlo sa meniacom svete|neoddeliteľnou súčasťou|neoddeliteľná súčasť|posunúť na ďalšiu úroveň|na ďalšiu úroveň|konkurenčnú výhodu|investícia do budúcnosti|na poslednú chvíľu|hrá kľúčovú úlohu|zohráva kľúčovú úlohu|v neposlednom rade|poďme sa pozrieť|v tomto článku sa pozrieme|nie je žiadnym tajomstvom|svet sa neustále mení|bez ohľadu na to|je dôležité si uvedomiť|kľúčové je|na záver|nezabúdajte|v digitálnom veku|v digitálnom svete|digitálna transformácia|otvára nové možnosti|otvára dvere|prináša nové príležitosti|potenciál naplno|využiť potenciál|odomknúť potenciál|dosiahnuť nové výšiny|udržať krok|o krok vpred|cesta k úspechu|kľúč k úspechu|základ úspechu|dlhodobý úspech|udržateľný rast|dynamické prostredie|meniace sa prostredie|neustále sa vyvíjajúci|neustále sa meniaci|komplexný prístup|holistický prístup|inovatívne riešenia|efektívne riešenia|riešenia na mieru|bezproblémová integrácia|plynulý prechod|strategický partner|strategické partnerstvo|pridaná hodnota|vytvárať hodnotu|maximalizovať efektivitu|optimalizovať procesy|zefektívniť procesy|zvýšiť produktivitu|podporovať inovácie|budovať dôveru|silné základy|pevné základy|pevný základ|široká škála možností|široké spektrum|jedinečná príležitosť|kľúčový aspekt|dôležitý aspekt|zásadný význam|zásadnú úlohu|významnú úlohu|neoceniteľný nástroj|nevyhnutný krok|dôležitý krok|správnym smerom|nová éra|budúcnosť je tu|budúcnosť podnikania|zmeniť pravidlá hry|posúva hranice|v srdci každého|na ceste k|stojí za zmienku|treba poznamenať|je potrebné zdôrazniť|je dôležité poznamenať|nemenej dôležité|v konečnom dôsledku|stručne povedané|záverom|celkovo|pripraviť sa na budúcnosť|čeliť výzvam|prekonávať výzvy|premeniť výzvy na príležitosti'.split('|').concat(ODBORNE),
  KONSTRUKCIE: [/\bnie je (to )?(len|iba) [^.;]{1,40}, (je to|ale)\b/iu, ULOHA],
  ZAVER: 'na záver|záverom|celkovo|stručne povedané|v konečnom dôsledku|kľúčové je|podstatné je|pointa je|nakoniec'.split('|'),
  MORAL: 'pamätajte|pamätaj|nezabúdajte|nezabúdaj|nezabudnite'.split('|'),
  NEISTOTA: 'neviem|nie som si istý|nie som si istá|možno|pravdepodobne|zrejme|zatiaľ netuším|mýlil som sa|mýlila som sa|nepodarilo sa mi|nemám odpoveď|pochybujem'.split('|'),
  ODBOCKY: 'mimochodom|inak povedané|len tak na okraj|btw'.split('|'),
  FUNKCNE: 'a i aj ale alebo či že sa si som sme ste sú je bol bola boli bude budú by aby ako tak to ten tá tie na v vo z zo do od pre pri po za s so k ku o u nie už len ešte tiež však teda keď ktorý ktorá ktoré ich jeho jej nás vás ja ty my vy on ona oni toto tu tam preto lebo'.split(' '),
  JA: 'ja mňa mi ma môj moja moje som sme nám nás náš'.split(' '),
  TY: 'ty teba ti ťa tvoj tvoja vy vás vám váš vaša ste'.split(' '),
  PRIPONY: ['anie', 'enie', 'tie', 'osť', 'cia', 'izmus'],
  VYNIMKY: ['nie'], /* v1.4 po bráne 1: bežné podstatné mená, nie dej namiesto slovesa (základ + najviac 4 znaky koncovky) */ BEZNE: ['informáci', 'nezamestnanos', 'zamestnani', 'podnikani', 'vzdelani', 'organizáci', 'spoločnos', 'verejnos', 'osobnos', 'námesti', 'populáci', 'generáci', 'federáci', 'povolani', 'minulos', 'budúcnos', 'prítomnos', 'udalos', 'vlastnos', 'miestnos', 'domácnos'],
  SKRATKY: 'napr.|tzv.|atď.|t. j.|resp.|č.|str.|s. r. o.|a. s.|Ing.|Mgr.|Bc.|PhDr.|JUDr.|MUDr.|doc.|prof.|mil.|tis.|hod.|min.|ul.'.split('|'),
  ODPOVED: /^(áno|nie|pretože|lebo|odpoveď je|dôvod je)\b/iu,
  VZTAZNE: /,\s*(?:ktor[\p{L}]*|čo|kto)\b[^,]*$/iu,
  SPOJKY: 'a|i|aj|alebo|či', KMEN: 5,
  PRAHY: { M1: [.60,.25], M2: [.60,.20], M3: [.10,.35], M4: [6,1], M5: [1.5,0], M6: [0,1.5], M7: [0,1], M8: [4,9], M9: [0,.8] },
  PASMA: [35,65],
  VAHY: { M1: .15, M2: .05, M3: .20, M4: .15, M5: .10, M6: .15, M7: .05, M8: .10, M9: .05 }
};
