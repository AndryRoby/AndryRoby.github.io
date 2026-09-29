// Ručne zostavené kandidátne frázy, nie dôkaz autorstva ani kalibrácia.
export default {
  FRAZY: 'v dnešnej dobe|v dnešnom rýchlo sa meniacom svete|neoddeliteľnou súčasťou|neoddeliteľná súčasť|posunúť na ďalšiu úroveň|na ďalšiu úroveň|konkurenčnú výhodu|investícia do budúcnosti|na poslednú chvíľu|hrá kľúčovú úlohu|zohráva kľúčovú úlohu|v neposlednom rade|poďme sa pozrieť|v tomto článku sa pozrieme|nie je žiadnym tajomstvom|svet sa neustále mení|bez ohľadu na to|je dôležité si uvedomiť|kľúčové je|na záver|nezabúdajte|v digitálnom veku|v digitálnom svete|digitálna transformácia|otvára nové možnosti|otvára dvere|prináša nové príležitosti|potenciál naplno|využiť potenciál|odomknúť potenciál|dosiahnuť nové výšiny|udržať krok|o krok vpred|cesta k úspechu|kľúč k úspechu|základ úspechu|dlhodobý úspech|udržateľný rast|dynamické prostredie|meniace sa prostredie|neustále sa vyvíjajúci|neustále sa meniaci|komplexný prístup|holistický prístup|inovatívne riešenia|efektívne riešenia|riešenia na mieru|bezproblémová integrácia|plynulý prechod|strategický partner|strategické partnerstvo|pridaná hodnota|vytvárať hodnotu|maximalizovať efektivitu|optimalizovať procesy|zefektívniť procesy|zvýšiť produktivitu|podporovať inovácie|budovať dôveru|silné základy|pevné základy|pevný základ|široká škála možností|široké spektrum|jedinečná príležitosť|kľúčový aspekt|dôležitý aspekt|zásadný význam|zásadnú úlohu|významnú úlohu|neoceniteľný nástroj|nevyhnutný krok|dôležitý krok|správnym smerom|nová éra|budúcnosť je tu|budúcnosť podnikania|zmeniť pravidlá hry|posúva hranice|v srdci každého|na ceste k|stojí za zmienku|treba poznamenať|je potrebné zdôrazniť|je dôležité poznamenať|nemenej dôležité|v konečnom dôsledku|stručne povedané|záverom|celkovo|pripraviť sa na budúcnosť|čeliť výzvam|prekonávať výzvy|premeniť výzvy na príležitosti'.split('|'),
  KONSTRUKCIE: [/\bnie je (to )?(len|iba) [^.;]{1,40}, (je to|ale)\b/iu],
  ZAVER: 'na záver|záverom|celkovo|stručne povedané|v konečnom dôsledku|kľúčové je|podstatné je|pointa je|nakoniec'.split('|'),
  MORAL: 'pamätajte|pamätaj|nezabúdajte|nezabúdaj|nezabudnite'.split('|'),
  NEISTOTA: 'neviem|nie som si istý|nie som si istá|možno|pravdepodobne|zrejme|zatiaľ netuším|mýlil som sa|mýlila som sa|nepodarilo sa mi|nemám odpoveď|pochybujem'.split('|'),
  ODBOCKY: 'mimochodom|inak povedané|len tak na okraj|btw'.split('|'),
  FUNKCNE: 'a i aj ale alebo či že sa si som sme ste sú je bol bola boli bude budú by aby ako tak to ten tá tie na v vo z zo do od pre pri po za s so k ku o u nie už len ešte tiež však teda keď ktorý ktorá ktoré ich jeho jej nás vás ja ty my vy on ona oni toto tu tam preto lebo'.split(' '),
  JA: 'ja mňa mi ma môj moja moje som sme nám nás náš'.split(' '),
  TY: 'ty teba ti ťa tvoj tvoja vy vás vám váš vaša ste'.split(' '),
  PRIPONY: ['anie', 'enie', 'tie', 'osť', 'cia', 'izmus'],
  VYNIMKY: ['nie'],
  SKRATKY: 'napr.|tzv.|atď.|t. j.|resp.|č.|str.|s. r. o.|a. s.|Ing.|Mgr.|Bc.|PhDr.|JUDr.|MUDr.|doc.|prof.|mil.|tis.|hod.|min.|ul.'.split('|'),
  ODPOVED: /^(áno|nie|pretože|lebo|odpoveď je|dôvod je)\b/iu,
  VZTAZNE: /,\s*(?:ktor[\p{L}]*|čo|kto)\b[^,]*$/iu,
  SPOJKY: 'a|i|aj|alebo|či', KMEN: 5,
  PRAHY: { M1: [.60,.25], M2: [.60,.20], M3: [.10,.35], M4: [6,1], M5: [1.5,0], M6: [0,1.5], M7: [0,1], M8: [4,9], M9: [0,.8] },
  PASMA: [35,65],
  VAHY: { M1: .15, M2: .05, M3: .20, M4: .15, M5: .10, M6: .15, M7: .05, M8: .10, M9: .05 }
};
