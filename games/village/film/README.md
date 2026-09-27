# Puzzle Village: film nakreslený kódom

27. 9. 2026, agent pre Fabla (kolo 3 po druhej kontrole). Stránka `https://arling.sk/games/village/film/` (`noindex, nofollow`,
kým Fable nerozhodne; zatiaľ bez odkazov z iných stránok, nenasadená, nerenderovaná, v prehliadači nevidená).
Engine: `ops/video/kodfilm/` (kópia v `engine/`, obnoví ju
`node ops/video/kodfilm/kopiruj.mjs products/arling-sk/games/village/film`).
Predmet: Puzzle Village (`products/arling-sk/games/village/`), miniatúrny ostrov so 14 domami, rozcestník 14 denných
hier. Film pôjde na YouTube Shorts, Pinterest (video piny), Facebook, Instagram a na túto stránku.

**Film kreslí samotná dedinka.** `film.js` importuje moduly hry (`../riso.js`, `../svet.js`, `../miesta.js`,
`../moja.js`, cez ne aj `../iso.js`) s tým istým `?v=7` ako `village.js`, takže ide o jednu inštanciu modulov:
ostrov, deväť atramentov so zrnom a posunom registrácie, domčeky, zvieratká, okná, lampy, svetlušky aj tón
zvončeka sú presne tie z hry. Film pridáva len kameru, poradie svetiel, štítky, titulky, názov a hudbu.
Keď Fable zvýši verziu dedinky (`?v=8`), treba ju zvýšiť aj vo `film.js` (`VERZIA_DEDINKY` a štyri importy)
a v `index.html` (`modulepreload`); test to stráži.

## Súbory

| Súbor | Čo je |
|---|---|
| `index.html` | stránka v hube: hlavička a päta hubu (rovnaké ako `games/village/index.html`), CSP bez vložených skriptov (súčet len pre JSON-LD, spočítaný ako `ops/design/csp-hash.mjs`, JSON-LD sa v kolách 2 a 3 nemenil), Umami, JSON-LD (WebPage, CollectionPage, FAQPage), `noindex, nofollow`, textový popis scén (v kole 3 bez Magpies v príbehu, „other eleven windows“). Koreň prehrávača `#film` obaľuje plátno aj lištu s ovládačmi a titulok pre čítačky (pozri Nález nižšie) |
| `film.css` | plátno 16:9 na počítači, 9:16 do 760 px; tlačidlo prehrať v nočnom atramente s ružovým tieňom ako `.vl-tip` v `village.css` |
| `strana.js` | vstup stránky (prehrávač s ovládačmi); po ťuknutí na Play zavolá `film.dotlac()` |
| `render.html`, `render.js` | len plátno na celé okno pre `render.mjs` (`noindex`) |
| `film.js` | film: časová os, rozloženie 4 formátov, kamera, rozvrh vlny, tlač ostrova do dlaždíc, svetlá, scénky rodín, ráno a podvečer, štítky, titulky, názov, partitúra |
| `test.mjs` | test bez prehliadača (falošné 2D plátno, skutočný kód dedinky): `node products/arling-sk/games/village/film/test.mjs` |

Chýba (robí Fable): kontrolné snímky, render, `og.jpg` (stránka zatiaľ používa `games/village/og.png`), meranie
výkonu stránky (`meraj.mjs`, `over-stranku.mjs`), odkazy z iných stránok.

## Kolo 3: čo sa zmenilo po druhej kontrole

- **Príbeh má tri domy, nie štyri** (Hedgehogs, Swans, Herons). Scénka Magpies sa vo filme neukázala vôbec: jej jediná
  zmena je políčko tabule, ktoré sa prepne, keď `act('magpies', t)` prejde 0,3 (`miesta.js:893`), a tabuľa to isté políčko
  aj bez scénky ukazuje 62 % z každých 2,4 s. V kole 2 bolo políčko plné od 6,9 s (blikanie) a od 7,78 s ho držala scénka,
  takže sa tabuľa nezmenila. Magpies svieti teraz vo vlne ako prvé (10,11 s, okná veže 43 a 26 px).
- **Pri každom dome pokoj:** kamera odchádza najskôr 0,85 s po svetle. Pri 9:16 (mriežka 3 x 3, prah 3 px za snímku, tak
  meral kontrolór) ostáva po atramente pokoja Hedgehogs 0,53 s, Swans 0,63 s, Herons 1,22 s (v kole 2 0,09 až 0,14 s);
  scénka hrá pri stojacej kamere Hedgehogs 82 %, Swans 56 %, Herons 79 % času (v kole 2 31, 19 a 20 %). Posledná dráha
  volaviek dohrá v 10,10 s pri priblížení 2,68 z 3,0 (v kole 2 pri 1,24); kamera sa pohne až 0,35 s pred jej koncom.
- **Čas:** vynechanie zastavenia Magpies dalo asi 1,3 s; kĺzanie medzi domami trvá 1,25 s (bolo 1,35, 1,2 a 0,9), zdvih nad
  Herons 0,75 s (bolo 0,8), prelet 1,15 s (bolo 1,2). Všetkých 14 okien svieti v 12,12 s, teda 63,8 % dĺžky.
- **Zvuk v slučke:** koncová plocha je ten istý akord ako plocha háku (G2 D3 B3 D4), v tej istej sile (0,16), jej filter
  sa otvára z 800 na 1500 Hz (plocha háku začína na 1500 Hz) a dobehne len v posledných 0,3 s. Ťuk na snímke 0 má tretinu
  sily (0,062). Pravidlo z kola 2 vynechalo cvrknutia tesne pred koncom (vtedy 5,2 kHz v 18,76 s); teraz idú cvrknutia
  dokola cez šev a test overí, že žiadne nechýba.
- **Plagát** je snímka 18,95 s (bol 1,0 s): to isté zloženie ako hák, ale odkaz nad adresou už platí, takže pri zníženom
  pohybe sa na adresu dá kliknúť.
- **Poctivosť:** zdroj podvečera je teraz v 12,37 s a test vypíše jeho polohu v každom formáte (pozri Časová os); v kole 2
  som písal [228, 759], to bola poloha okna Hares v 11,45 s, nie v 12,06 s ([267, 761]).

## Časová os (19 s, 30 fps; časy pri 9:16, ostatné formáty rovnako)

| Čas (s) | Obraz | Zvuk |
|---|---|---|
| 0 až 1,3 | hák: celý ostrov v podvečer, všetkých 14 okien svieti plným svetlom s teplým kruhom, lampy pri cestách, svetlušky nad lúkami a vodou, zvieratká žijú; nad ostrovom „Puzzle Village“ (dva bubny v registri), pod ním „14 daily logic puzzles. Free.“ a pilulka „arling.sk/games“; kamera sa pomaly približuje (rampa záveru, 2,2 % za sekundu); od 0,2 do 1,1 s prejde oknami zľava doprava svetelná vlna (kruh sa na chvíľu zväčší o 60 %) | tichý ťuk, akord G (G2 D3 B3 D4), zvony G5 D6 B6, trblietka (hák z `hak.js`); cvrčky pokračujú v rytme konca |
| 1,07 až 1,55 | veta a potom názov a adresa odídu (pokles a zmiznutie) | švih nadol |
| 1,3 až 2,3 | ráno príde kruhom z okien Hedgehogs a okná zhasnú (celú snímku pokryje do 2,02 až 2,26 s podľa formátu); scénky sú znova na začiatku | tichý zvon E6 (1,6) |
| 1,3 až 3,05 | kamera sa spustí k domu Hedgehogs (hladko, z 0,82 na 3,0 px na jednotku) | plocha C, hracia skrinka E5 G5 |
| 3,35 až 4,2 | Hedgehogs: tri okná chalupy sa naplnia atramentom (kruh zo stredu okna, pružina snappy 360 ms, teplý záblesk), dosadne štítok „Hedgehogs“; kamera stojí (98 % priblíženia, fokus 13 px od kotvy, od 3,47 do 4,24 s sa žiadny bod snímky nepohne o 3 px za snímku); 3,5 až 4,4 ježko vylezie spod lístia; titulok „Solve a house’s puzzle today and its window lights up.“ (3,35 až 7,2); štítok zhasne 4,15 až 4,45 | zvonček A4 s kvintou (tón domu z hry), skrinka B5 (4,15) |
| 4,2 až 5,45 | kĺzanie k jazeru Swans (cestou sa kamera vzdiali asi o štvrtinu a znova priblíži) | skrinka G5, plocha Em od 4,95 |
| 5,75 až 6,7 | Swans: lampáš na konci móla, štítok „Swans“ (96 %, fokus 19 px); kamera stojí 5,96 až 6,74; 5,9 až 7,3 slučka okolo jazera cez všetky labute (posledná štvrtina, kým kamera odchádza) | zvonček B5, skrinka E5 (6,4) a D5 (7,0) |
| 6,7 až 7,95 | kĺzanie k rozhľadni Herons; titulok „A new puzzle in every house, every day.“ (7,2 až 10,4) | plocha D od 7,45 |
| 8,25 až 9,75 | Herons: okno chatky na rozhľadni, štítok „Herons“ (96 %, fokus 19 px); kamera stojí 8,45 až 9,83; tri dráhy letu nad močiarom 8,4 až 9,2, 8,85 až 9,65 a 9,3 až 10,1 (posledná dohrá pri priblížení 2,68); štítok zhasne 9,7 až 10,0 | zvonček D7 (tichší), skrinka A5 (8,9) a E5 (9,55), plocha G od 9,5 |
| 9,75 až 10,5 | kamera sa nad domom Herons zdvihne (3,0 na 1,25) | |
| 10,5 až 11,65 | prelet ponad dedinku doľava (1,25 na 1,1), potom kamera stojí | |
| 10,11 až 11,76 | vlna zvyšných jedenásť okien, každé až keď je celé v zábere vo všetkých štyroch formátoch: Magpies 10,11, Beavers 10,40, Squirrels 10,54, Otters 10,68, Foxes 10,82, Cranes 10,97, Voles 11,11, Dormice 11,26, Badgers 11,47, Owls 11,62, Hares 11,76; každý dom zahrá svoju scénku; 12,12 svieti všetkých 14 (63,8 % dĺžky); titulok „Evening comes when all fourteen are lit.“ (10,4 až 14,7) | kaskáda zvončekov, každý dom svojím tónom |
| 12,37 | podvečer: kruh z okna Hares (rozsvietilo sa posledné; kamera stojí, okno je v 9:16 na [277, 761], v 16:9 na [697, 456], v 1:1 na [277, 456], v 4:5 na [277, 591]) prelieva cez tlač dva večerné bubny (slivka a modrá, ako v hre), okná dostanú plné teplé svetlo s kruhom, lampy svietia; celú snímku pokryje do 13,5 až 14,1 s podľa formátu | nádych, plocha C s nónou, hlboký zvon G3, skrinka E5 D5 B4 |
| 12,55 až 14,05 | kamera sa zdvihne k celému ostrovu (o 15 % ďalej, než je jeho miesto v rozložení) | |
| 12,96 až 13,82 | vyletia svetlušky dedinky (2,2-krát väčšie ako v hre), podľa vzdialenosti od okna Hares | tiché trblietky, od 13,27 dva cvrčky |
| 14,05 až 19 | záver: podvečerný ostrov sa pomaly približuje (2,2 % za sekundu, tá istá rampa ako v háku); „Puzzle Village“ (14,85, ružový bubon sa dotlačí do registra), „14 daily logic puzzles. Free.“ (15,25), pilulka „arling.sk/games“ (15,65, dosadne asi v 16,1, odkaz na `/games/`) | akord háku G2 D3 B3 D4 od 14,6 (nábeh 1,0 s) v sile plochy háku, filter z 800 na 1500 Hz, dobeh 18,7 až 19,0; zvony G4 D5, B4, ťuk a zvon B5 pri adrese; hracia skrinka 16,4, 17,25, 18,05 |
| 19,0 | presne snímka 0 (film ide v slučke dokola) | akord háku znova udrie (pozri Slučka) |

Plagát (`film.plagat`) je 18,95 s: podvečerný ostrov so všetkými svetlami, názvom, vetou a adresou, teda zloženie snímky 0
(slučka), ale bez svetelnej vlny háku. Tlačidlo prehrať je nad stredom ostrova. Odkaz nad adresou platí od 15,65 s, takže na
plagáte pri zníženom pohybe sa na adresu dá kliknúť (pri plagáte 1,0 s sa nedalo) a Play pokračuje snímkou 0 bez skoku.
Titulky pre čítačky obrazovky (`film.titulky`) opisujú každú scénu, aj ráno a slučku.

## Slučka

Film je jeden deň dedinky: začína podvečerom so všetkými 14 svetlami a končí ním. Snímka v čase 19,0 s sa kreslí presne
tými istými volaniami ako snímka 0 (test porovná celé záznamy volaní falošného plátna, rozdiel čísel 0,000), takže po
poslednej snímke (18,967 s) nasleduje snímka 0 ako bežná ďalšia snímka:

- **kamera**: hák a záver sú tá istá rampa priblíženia (z celého ostrova o 15 % ďalej na jeho miesto v rozložení); v háku je
  posunutá o dĺžku filmu a kamera pred ňou stojí, takže v čase 19 s je tam, kde v čase 0. Posledná snímka proti snímke 0:
  priblíženie -0,075 %, poloha 0 px, rohy 0,57 až 1,05 px, čo je presne bežný krok medzi dvoma snímkami záveru;
- **svetlo a scénky**: v háku svieti všetkých 14 okien, scénky sú dohrané a svetlušky vonku, ako na konci;
- **zvieratká a svetlušky** v podvečere háku bežia na hodinách konca (t + 19 + 12,3 s), takže pokračujú presne tam, kde film
  skončil; deň pod ranným kruhom beží na hodinách dňa;
- **texty**: názov, veta a adresa sú v háku v rovnakom stave ako na konci (aj ružový bubon v registri); svetelná vlna háku
  má na snímke 0 aj v 1,3 s nulovú silu;
- **zvuk** (úprimne, nie je bez švu): koncová plocha je akord háku v sile plochy háku a znie do 18,7 s, potom za 0,3 s
  dobehne; na snímke 0 hák ten istý akord znova udrie (nábeh 50 ms) spolu s tichým ťukom 90 Hz (tretina pôvodnej sily),
  tromi zvonmi a trblietkou, takže **v slučke počuť nové zaznenie akordu**, nie pokračovanie. Dozvuk zvukov konca (aj
  plochy) render v 19,0 s odreže, lebo zvuk končí s videom; koncová plocha preto posiela do dozvuku len 0,15 (ostatné
  plochy 0,35), odrezaný chvost je o 7 dB tichší. Cvrčky idú dokola: cvrknutia po 19,0 s zaznejú v háku a jedno,
  ktoré by šev prekročilo (4,7 kHz v 18,978 s), zaznie celé na snímke 0, teda o 22 ms neskôr pod úderom akordu; žiadne
  nechýba ani sa neodreže (test). RMS posledných a prvých 0,5 s zvuku zmeria Fable po rendri (Pre Fabla, bod 3).

## Rozloženie a veľkosti

`node products/arling-sk/games/village/film/test.mjs --rozlozenie` vypíše čísla. 9:16, 4:5 a 1:1: názov nad ostrovom, veta
a adresa pod ním (ako hlavička a pätička plagátu); 16:9: ostrov vľavo, „Puzzle“ a „Village“ pod sebou vpravo. Priblíženie
pri 1080 (px na jednotku sveta dedinky): celý ostrov 0,822 (9:16 a 4:5), 0,852 (16:9), 0,649 (1:1), v háku a závere o 3 až 15 %
menej; pri domoch príbehu **3,0**; zdvih nad Herons do 1,25, prelet počas vlny 1,25 až 1,1. Kotva príbehu (kam kamera stavia
dom so štítkom) je v 44 % výšky pri 9:16, počas preletu v strede zóny, titulky dole v zóne.

Čo je na obraze veľké pri 1080 v 9:16 (priemer): dom príbehu 630 až 900 px široký; ježko asi 55 px; okná chalupy
Hedgehogs 55 px, teplý záblesk pri rozsvietení polomer 48 px; lampáš Swans 22 px so zábleskom polomer 48 px; okno Herons
39 px. **Okná vlny sú malé:** Magpies 43 a 26 px (svieti počas zdvihu pri priblížení okolo 1,7), ostatné 8 až 20 px, lebo
svietia z preletu nad dedinkou (priblíženie 1,1 až 1,3); preto je ich teplý záblesk vo filme dvakrát väčší ako v hre.
Svetlušky 16 až 24 px (okolo 11 v hre). Teplé kruhy okien v podvečer z celého ostrova 23 až 26 px, vo svetelnej vlne háku
až 42 px.

Písmo pri 1080: názov 115 px (9:16), 124 px (16:9), 132 px (1:1 a 4:5); veta 50 alebo 46 alebo 42 px; adresa 44 alebo 42 px
(pri dosadnutí na 90 %, teda najmenej 37,9 px); štítok 40 px; titulok 44 px (9:16) alebo 42 px.

Kontrast (odhad z miešania atramentov, zrno 0,92): názov je vždy na podvečernom papieri (hák aj záver), preto má modrý
bubon plnú silu 1,0 (karta dedinky 0,92): samotný modrý 3,6 : 1, kde sa prekrýva s ružovým 5,5 : 1 (s 0,92 by to bolo
3,3 a 5,2). Veta nočným atramentom 0,92 na podvečernom papieri 4,9 : 1. Adresa a titulky sú svetlé písmo na tmavej pilulke.

## Kamera

Cieľ kamery ide hladko (smoothstep, rýchlosť nulová na oboch koncoch) medzi zastaveniami: hák, tri domy, zdvih nad Herons,
prelet, celý ostrov; cestou medzi domami sa cieľ vzdiali (o 30 % pri 270 jednotkách cesty, pri kratšej menej; kamera asi
o štvrtinu). Hladké úseky sú rozložené na úsečky po 0,1 s a kamera za nimi ide ako kriticky tlmená pružina (tlmenie 1,
uhlová frekvencia 8, oneskorenie 0,25 s): nikdy neprekmitne (test overí každý kanál každú 1/120 s). Pri každom dome cieľ
stojí od príletu do odletu: svetlo príde 0,3 s po prílete (96 až 98 % priblíženia, fokus 13 až 19 px od kotvy, stred do
3,3 px za snímku), odlet najskôr 0,85 s po svetle a scénka rodiny hrá aspoň polovicu času pri stojacej kamere (test).

Pohyb pri 9:16 (stred snímky / najrýchlejší z 9 bodov mriežky 3 x 3 vrátane rohov, px za snímku): hák 0,1 / 0,9,
spustenie do dedinky 21 / 59 (okolo 2,5 s), státie pri domoch do 3,3 / 11 (len dosadanie pri príchode), kĺzanie medzi
domami 23 / 40, zdvih nad Herons 8 / 58 (hlavne vzdialenie, okolo 10,3 s), prelet 20 / 24, státie pred podvečerom 1,8 / 2,1,
zdvih v podvečer 5,7 / 20, záver 0,7 / 2,2 (čisté priblíženie okolo stredu ostrova, 2,2 % za sekundu; stred snímky sa
takmer nehýbe, rohy áno). Najdlhší úsek, keď sa žiadny bod mriežky nepohne ani o 0,3 px za snímku, má 0,93 až 1,0 s
(kamera stojí nad západom dedinky, kým svieti všetkých 14 a príde podvečer). Jeden súvislý záber, bez strihu.

## Vlna: rozvrh podľa kamery

Okno vlny sa rozsvieti najskôr 0,1 s po tom, čo je vo všetkých štyroch formátoch celé v bezpečnej zóne (aj s teplým kruhom
okolo okien, v 9:16 teda nie pod rozhraním Shorts) a nad pásom titulkov, a ostane v nej počas celého atramentu; najskôr však
v 10,1 s, keď dohrá scénka Herons. Spomedzi takých ide prvé to, ktoré zo záberu odíde skôr; pri zhode to najbližšie k
naposledy rozsvietenému. Odstup aspoň 140 ms (`CASY.odstup` z hry). Rozvrh vypočíta `film.js` pri načítaní z kamery
všetkých štyroch formátov (kamera počas vlny od písma nezávisí, takže stránka, render aj test majú ten istý). Výsledok:
Magpies hneď pri zdvihu (veža stojí nad Herons), potom Beavers, Squirrels, Otters a Foxes na východe a Cranes, Voles,
Dormice, Badgers, Owls, Hares počas preletu doľava. Rezerva je tesná: Otters je vo všetkých formátoch v zábere od 10,43
do 11,13 s a jeho atrament skončí v 11,04 s (0,09 s rezerva); keď sa zmení dráha preletu alebo priblíženie, test ukáže,
ak niektoré okno nikdy nie je celé v zábere alebo vrchol prejde nad 65 %.

## Ráno a podvečer

Oba prichádzajú kruhom z bodu (farba neprejde cez sivú): ráno z okien Hedgehogs (pružina s tlmením 1, snímku pokryje asi
za 0,7 s), podvečer z okna, ktoré sa rozsvietilo posledné (Hares, pružina 2,0 s, ostrov pokryje asi za 0,7 s, celú snímku
kým sa kamera dvíha). Polomer je vždy dosť veľký na najvzdialenejší roh snímky; odkedy kruh pokryje celú snímku, staré
svetlo sa už nekreslí.

## Tlač ostrova a pamäť

Tlač je tá istá ako v hre: `drawStatic` z `svet.js` do dlaždíc 512 px (ako `renderTile` vo `village.js`), bez rámu plagátu
(`p.bare`, ako karta dedinky). Tri úrovne priblíženia: celý ostrov, stredná 1,35 (prelet) a 3,0 (domy), deň a podvečer.
Tlačí sa len to, čo kamera naozaj ukáže (vzorky každú 1/60 s). Dlaždica mimo ostrova je len papier (a v podvečer dva
bubny), a keďže papier sa opakuje po 128 px, je na jednej úrovni pixel po pixeli rovnaká: vytlačí sa raz.

- Render (DPR 1): 9:16 83 plátien po 1 MB (deň 7, 13 a 43, podvečer 7 a 13), 16:9 92, 1:1 75, 4:5 81; všetko sa vytlačí vo
  `vrstvy()` (env.render).
- Stránka: po načítaní sa vytlačí len celý ostrov (plagát aj ráno): telefón 390 x 693 pri DPR 2 10 plátien. Ostrejšie úrovne
  sa tlačia v nečinnosti prehliadača (`requestIdleCallback`, dlaždica len keď ostáva aspoň 30 ms voľna) alebo hneď po ťuknutí
  na Play (`film.dotlac`, po kúskoch najviac 8 ms); v Safari bez `requestIdleCallback` až po ťuknutí. Kým ostrejšia úroveň
  chýba, leží pod ňou celý ostrov. Po ťuknutí: telefón 49 plátien (asi 49 MB), počítač 1200 x 675 pri DPR 2 80 (tlač tam má
  najviac 1,5 px na CSS px). Nemerané v prehliadači.

Filmové zrno z kola 1 je preč (tlač dedinky má vlastné zrno; zrno cez celú snímku stálo dátový tok a siete by ho zmazali).

## Zvuk

Partitúra v kóde (`engine/zvuk.js`), 102 udalostí. Hák z `hak.js` (G dur, ťuk na tretine sily), ráno tichý zvon E6, tichá
hudba cez deň: plochy C, Em, D, G (C pri zjazde a Hedgehogs, Em pri Swans, D pri Herons, G so zdvihom a cez vlnu), v
podvečer C s nónou, na konci akord háku G v sile plochy háku s filtrom otvárajúcim sa k 1500 Hz, dobehom 0,3 s a menším
dozvukom (0,15); hracia
skrinka (14 riedkych tónov pentatoniky, dva pri každom dome príbehu, nikdy nie spolu so zvončekom okna). Okno: vlastný
nástroj `zvoncek` je zvonček dedinky (`village.js` `ring`: sínus a čiastkový tón 4,02 krát silou 0,18, kvinta o 90 ms, nábeh
8 ms, doznenie 1,1 s, tón 392 Hz krát pentatonika podľa poradia miest), vo filme navyše s dozvukom a v stereo poli podľa
polohy domu; vysoké domy tichšie. Podvečer: nádych šumu, hlboký zvon, dva cvrčky (trojice cvrknutí 4,7 a 5,2 kHz, dokola cez
šev), trblietky svetlušiek. Render normalizuje na -14 LUFS.

## Čo je z hry (zdroj) a čo je naše

| Fakt vo filme | Zdroj |
|---|---|
| „14 daily logic puzzles. Free.“ | `games/zoznam.json` (14 hier, všetky `hotove: true`); `games/index.html:168` „Daily logic puzzles“, „Free in your browser“, `:171` „Fourteen games, a new puzzle every day.“, `:174` „Games 14, all finished“, „Price Free, no account, no ads“; `games/village/index.html:135` „Everything in the village is free.“ |
| „arling.sk/games“ | `products/arling-sk/games/index.html` (rozcestník hier) |
| štítky Hedgehogs, Swans, Herons a mená vlny | `games/zoznam.json` (`nazov`), `moja.js:16` `HRY`, `meno()` |
| „Solve a house’s puzzle today and its window lights up.“ | `moja.js:151` (`textSvetiel`, `nazov`) |
| „A new puzzle in every house, every day.“ | `svet.js:520` podtitul plagátu „A NEW PUZZLE IN EVERY OPEN HOUSE, EVERY DAY“ (dnes je otvorených všetkých 14, `miesta.js:145` `LIVE`) |
| ráno okná zhasnú | `games/village/index.html:94` „A solved puzzle lights its house until the day ends; tomorrow starts dark.“; `moja.js:6` „Tomorrow starts dark again.“ |
| „Evening comes when all fourteen are lit.“ a podvečer so svetluškami po 14 z 14 | `games/village/index.html:94` „Evening comes at six by your own clock, or when all fourteen are lit.“; `README.md:45` dedinky „14 z 14: dedinka prejde do podvečera so svetluškami“ |
| okno sa rozsvieti atramentom: kruh zo stredu okna 360 ms (pružina snappy), cez deň teplý záblesk a plochá teplá tabuľka `DENNE_SKLO`, v podvečer plné svetlo s kruhom `HALO` | `village.js:354` `drawLights`, `:377` `lightUp`; `moja.js:185` `CASY.okno`, `:220` `atrament`, `:247` `DENNE_SKLO`; `svet.js:217` `HALO`, `panel` |
| najmenej 140 ms medzi dvoma oknami vlny | `moja.js:192` `odstup: 140` |
| štítok s teplým okienkom, dosadne z 1,3 na 1 na pružine press | `village.css:29` `.vl-lab-in`, `:37` `.vl-lab-okno`; `moja.js:194` `CASY.stitok` |
| titulok ako tmavá pilulka s ružovým tieňom, adresa ako knockout z nočného atramentu | `village.css:54` `.vl-hint`, `:40` `.vl-tip` |
| názov v dvoch bubnoch, ružový posunutý o 0,034 a 0,022 em | `svet.js` `marks()` (titul plagátu tlačený dvakrát), `moja.js:257` titul karty (posun 3,6 a 2,4 px pri 112 px) |
| podvečer = dva bubny slivka a modrá cez celú tlač, lampy, tlmené okná 35 % | `riso.js:102` `DUSK`, `svet.js:420` `dusk()`, `TLMENE` |
| scénky domov príbehu a ich dĺžky: ježko vylezie spod lístia (0,9 s), slučka labutí (1,4 s), tri dráhy volaviek po 0,45 s (spolu 1,7 s) | `miesta.js:264` `act('hedgehogs', t, 0.9, 0.9)`, `:122` `trace` (predvolene 0,5 a 1,4 s), `:693` `trace('swans', ...)`, `:807` tri dráhy, `:849` `trace('herons', ..., 0.5 + n * 0.45, 0.8)`; tie isté scénky hra hrá pri otvorení domu; test tieto riadky overí |
| scénky vo vlne (lávka žeriavov, žaluď veveričky, čísla jazvecov, hraboše a ďalšie) a prečo Magpies nie je v príbehu | ostatné `act()` v `miesta.js`; tabuľa Magpies `miesta.js:893` (`((t / 2.4) % 1) < 0.62 || act('magpies', t) > 0.3`) |
| svetlušky nad lúkami a vodou | `miesta.js:1139` (`ambient`, podvečer) |
| tón zvončeka každého domu | `village.js:976` `SCALE`, `:994` `ring` |
| farby, papier, zrno, registrácia | `riso.js:7` `INK` (deväť atramentov), `REG`, dlaždice zrna |

**Naše (film, nie hra):** výber a poradie troch domov, časy svetiel a zastavení, kamera a jej dráha (priblíženie 3,0 pri
domoch), poradie a časy vlny (z kamery, pozri vyššie), to, že scénka rodiny začne 0,15 s po rozsvietení (v hre sa pri
príchode ukáže hneď hotová), ráno kruhom z okien Hedgehogs a podvečer kruhom z posledného okna (v hre sa deň a podvečer
prelínajú), slučka (hák je podvečer konca, zvieratká háku na hodinách konca), svetelná vlna háku cez okná, teplý záblesk
okien vlny dvakrát väčší ako v hre, svetlušky 2,2-krát väčšie a ich postupný výlet, modrý bubon názvu so silou 1,0 (karta
0,92), hudba (plochy, hracia skrinka, cvrčky, trblietky), pohyb názvu (dotlačenie do registra v závere). Izba s padajúcou
stenou (`room` v `miesta.js`, `s.focus`) sa vo filme nekreslí: patrí karte domu a zakryla by okno. Scénky v domoch sú
ilustrácie, nie dnešné zadania hier (README dedinky „Scény sú jednoduché ilustrácie“). Vo filme nie sú žiadne čísla
hráčov, hodnotenia ani iné údaje, ktoré by sa dali overiť len mimo kódu.

## Test (bez prehliadača)

`node products/arling-sk/games/village/film/test.mjs` (27. 9. 2026 večer, kolo 3: zelený, 3,8 s)

- 4 formáty x 571 snímok (0 až 19 s po 1/30 s), tlač ostrova do dlaždíc skutočným kódom dedinky,
- žiadna výnimka (falošné plátno hádže pri zápornom polomere arc, arcTo, ellipse, zlom offsete prechodu, NaN),
  save a restore v páre; cesta pre Firefox (`OPT.fillStrokes`) tiež bez chyby,
- každý text filmu (názov, veta, adresa, štítky, titulky, aj zapečený v sprite, s ohľadom na clip) v zóne `zona(W, H)`,
  najmenšie písmo po transformáciách 37,9 px (minimum 36 px pri 1080); drobné nápisy tlače dedinky sú kresba ostrova,
  test ich spočíta zvlášť (33 až 38 tisíc na formát) a nekontroluje ich veľkosť,
- determinizmus: 18 časov na formát nakreslených dvakrát (medzi tým iné t) dá presne tie isté volania,
- **slučka**: kamera v 19 s presne v polohe snímky 0; posledná snímka proti snímke 0 pod 0,5 % priblíženia a pod 1 px
  polohy a krok cez slučku nie je väčší než bežný krok pred ním; snímka v 19 s sa kreslí tými istými volaniami ako
  snímka 0 (čísla do 1 px, skutočne 0,000); hlavička (názov, veta, adresa) v rovnakom stave,
- kamera bez NaN a bez prekmitu; **žiadny statický úsek** (mriežka 3 x 3 pod 0,3 px za snímku) dlhší ako 3 s mimo háku
  (najdlhší 1,0 s); záver sa približuje aspoň 1,5 % za sekundu (2,2),
- **domy príbehu**: pri svetle aspoň 95 % priblíženia, fokus do 40 px od kotvy, stred do 4 px za snímku; **nové v kole 3**
  (kamera „stojí“, keď sa žiadny bod mriežky 3 x 3 nepohne o 3 px za snímku): po atramente aspoň 0,4 s pokoja, scénka
  rodiny aspoň polovicu času pri stojacej kamere a pri nej naozaj mení kresbu domu (test nakreslí sprity domu so scénkou
  a bez nej a porovná volania; pôvodný čas Magpies by dal 0 zmien zo 4 snímok), posledný dom dohrá scénku pri priblížení
  aspoň 2,5, odchod najskôr 0,85 s po svetle, vlna až po scénke posledného domu; hodnoty vypíše pre každý formát,
- **svetlá**: všetkých 14 okien (aj s teplým kruhom) celých v zóne počas celého atramentu v každom formáte; okná vlny aj
  nad pásom titulkov a 0,1 s pred svetlom; žiadny štítok ani titulok nezakrýva svietiace okno; štítok sa neprekrýva s
  titulkom a neodtrhne sa od domu; vlna má 11 okien, odstup aspoň 140 ms,
- **ráno a podvečer**: ráno pokryje snímku do 2,3 s (2,02 až 2,26), podvečer pred názvom záveru (13,5 až 14,1 s, názov 14,85);
  zdroj podvečera v zóne, nie pri okraji, a kamera pri ňom stojí; test vypíše jeho polohu v každom formáte; snímka 0 a
  koniec sú podvečer,
- partitúra: časy v 0 až 19 s, známe nástroje, 14 zvončekov okien, plochy dlhšie ako nábeh a dobeh a končia do 19 s;
  **slučka zvuku (nové)**: koncová plocha má noty a silu plochy háku, filter končí pri filtri háku (do 50 Hz) a dobeh
  najviac 0,3 s; ťuk na snímke 0 najviac 0,07; každé očakávané cvrknutie oboch cvrčkov (od podvečera cez šev do háku) je v
  partitúre a žiadne sa na šve neodreže,
- **plagát (nové)**: podvečer bez kruhu, hlavička ako na snímke 0 a odkaz nad adresou na ňom platí,
- titulky na obraze: čas čítania aspoň slová / 3 + 0,5 s, nadväzujú bez medzier; titulky pre čítačky po sebe,
- všetkých 14 okien svieti v 55 až 65 % dĺžky (63,8 %); po dosadnutí adresy ostáva 2,5 až 3,2 s,
- žiadne pomlčky em ani en v textoch filmu, titulkoch, `index.html` a `README.md`; film nekreslí filmové zrno,
- fakty: test prečíta zdrojové súbory (`zoznam.json`, `games/index.html`, `moja.js`, `svet.js`, `village.js`, `miesta.js`,
  `index.html` dedinky) a overí, že vety, čísla a dĺžky scénok vyššie v nich stále sú; a že film aj jeho stránka načítajú
  tú istú verziu modulov ako hra,
- **stránka**: po načítaní (390 x 693, DPR 2) sa vytlačí len celý ostrov, zvyšok až po `film.dotlac()`; počítač
  1200 x 675 pri DPR 2 kreslí bez chyby a drží najviac 100 plátien tlače (80).

Šírka textu je v teste odhad (0,55 em na znak); film meria v prehliadači skutočné písmo, preto treba kontrolné snímky so
zónami. Voľby: `--rozlozenie` (čísla rozloženia), `--kamera` (priebeh kamery pri 9:16), `--ladenie` (svetlá, fázy, počty
volaní a texty v kľúčových časoch).

## Pre Fabla

1. Kontrolné snímky so zónami (server nad `products/arling-sk` na 8871), ešte pred bránou:
   `node ops/video/kodfilm/render.mjs --url http://127.0.0.1:8871/games/village/film/render.html --nazov village --snimky 0,1,2.5,3.6,3.9,4.15,6,6.6,7.4,8.6,9.7,10.2,10.9,12.15,12.6,13.3,15.3,16.3,18.967 --harok --zony --bez-videa --out <scratchpad>/filmy/village`
   Pozrieť: 0 a 18,967 vedľa seba (ten istý obraz: podvečer, 14 svetiel, svetlušky, názov, veta, adresa), 1 (svetelná vlna
   cez okná), 2,5 (zjazd v najväčšej rýchlosti, ráno už kryje), 3,6 (atrament v oknách Hedgehogs, štítok dosadá), 3,9 a
   4,15 (ježko vylieza, kamera stojí), 6 a 6,6 (lampáš Swans, slučka okolo jazera, kamera stojí), 7,4 (kĺzanie k Herons,
   titulok sa mení), 8,6 (okno Herons, prvá dráha), 9,7 (tretia dráha pri stojacej kamere), 10,2 (zdvih, okná veže
   Magpies), 10,9 (prelet, okná na východe), 12,15 (všetkých 14, kamera stojí), 12,6 (kruh podvečera z Hares), 13,3
   (zdvih, svetlušky), 15,3 (názov na podvečernom papieri: kontrast), 16,3 (celý záver).
2. Porovnanie podľa kontroly (priblíženie pri domoch a svetlušky): tie isté príkazy s `render.html?blizko=2.2` a
   `render.html?blizko=3.2` na snímkach 3,9 a 9,7 a s `?svetluska=1.4` a `?svetluska=2.5` na snímkach 13,3 a 16,3. Bez
   parametra platí 3,0 a 2,2 (to overuje test). Ak vyhrá iná hodnota, zmeniť konštantu vo `film.js` a spustiť test (pri
   inom priblížení sa pohne aj rozvrh vlny; test povie, či ešte vyjde).
3. Render všetkých 4 formátov (na pozadí, nič iné ťažké popri tom):
   `node ops/video/kodfilm/render.mjs --url http://127.0.0.1:8871/games/village/film/render.html --nazov village --snimky 0,1,3.9,9.7,10.9,12.6,16.3 --harok --fps 30 --out ops/video/out/kodfilm/village`
   Potom 3 snímky z hotového MP4 v pohybe (ffmpeg `-ss`): 2,5 (zjazd), 7,4 (kĺzanie), 10,3 (zdvih nad Herons); ffprobe
   (rozmer, 30 fps, 19 s, AAC 48 kHz) a hlasitosť z JSON. Slučku overiť aj v MP4: posledná snímka a snímka 0 vedľa seba.
   Zvuk v slučke: RMS prvých a posledných 0,5 s (riadok „Overall“, „RMS level dB“ z
   `ffmpeg -hide_banner -i <mp4> -af "atrim=0:0.5,astats" -f null -` a z `ffmpeg -hide_banner -sseof -0.5 -i <mp4> -af astats -f null -`),
   obe hodnoty zapísať sem a šev si vypočuť v slučke (Shorts hrá dokola). Koncová plocha má silu plochy háku; začiatok bude
   hlasnejší o zvony a trblietku háku.
4. `og.jpg` 1200 x 630 zo 16:9 MP4 (napríklad 16,3 s) a v `index.html` ho dať do `og:image`; potom `over-stranku.mjs`
   (plagát je teraz snímka 18,95 s) a `meraj.mjs` (mobil, počítač, spomalenie 6x, znížený pohyb) a výsledky sem; hlavne
   procesor po načítaní, keď sa v nečinnosti dotláča tlač, a plynulosť prvých 3 s po ťuknutí vo Firefoxe.
5. Nasadenie podľa rozhodnutia: `robots` na `index, follow`, odkaz z `games/village/` a `games/`, sitemap, llms.txt.
   `test.mjs` stránka nenačíta.

## Nález na iných stránkach filmov (nemenil som ich, mimo môjho priečinka)

`engine/prehravac.js` hľadá ovládače len vo vnútri koreňa (`koren.querySelector`). Na **siedmich** stránkach filmov je koreň
`.kf#film` a lišta `.kf-lista` (Pause, Play again, Sound) aj `[data-kf-titulok]` sú mimo neho: `games/hedgehogs/film/`,
`play/prism5/film/`, `play/duel/film/`, `play/word-search/film/`, `play/quiet-grids/film/`, `shop/detective-kit/film/`,
`shop/pumpkin-escape-kids/film/` (overené čítaním `index.html` všetkých siedmich, riadky 58 až 71; kontrolór to potvrdil
naživo na troch). Následok: po skončení filmu sa tlačidlo štartu skryje a „Play again“ sa nikdy neukáže, takže **film sa
dá pustiť znova len obnovením stránky**; „Pause“ sa neukáže vôbec; „Sound on“ je viditeľné a nič nerobí; titulky pre
čítačky sa nemenia. Tu je `id="film"` na obale, ktorý obsahuje plátno, lištu aj titulok. Oprava inde: presunúť `id="film"`
z `.kf` na obal okolo `.kf`, lišty a titulku (CSS netreba meniť, premenné `--kf-play-x` a `--kf-play-y` sa dedia), potom
overiť v prehliadači. Pridelí Fable.

Odkaz v háku (kontrola kola 2, D3): pilulka „arling.sk/games“ je nakreslená aj v háku (0 až 1,55 s), ale odkaz nad ňou
platí až od 15,65 s, lebo engine nepozná koniec platnosti odkazu (`prehravac.js:104`, len `od`). Počas prvých 1,55 s
prehrávania sa teda na pilulku kliknúť nedá; prijímam to (klik v prvej sekunde je nepravdepodobný). Plagát je preto snímka
18,95 s, kde odkaz platí. Pole `do` pre odkaz v engine by bola zmena pre všetky filmy; rozhodne Fable.

## Čo je slabé (úprimne)

- **Nič z toho som nevidel.** Agent nesmie spustiť prehliadač ani render; kompozícia, farby, čitateľnosť a plynulosť sú
  overené len číslami a falošným plátnom. Voľbu 3,0 pri domoch a 2,2 pri svetluškách som urobil z čísel, nie zo snímok.
  Bránu 8,5 bez kontrolných snímok (Pre Fabla, bod 1) nemožno poctivo hodnotiť.
- **Swans:** slučka okolo jazera trvá 1,4 s a kamera pri nej stojí 56 % času; poslednú štvrtinu slučky kamera už odchádza
  (jazero ostáva v zábere, len sa vzďaľuje).
- **Herons:** kamera sa pohne 0,35 s pred koncom tretej dráhy (cieľ 9,75 s, dráha dohrá 10,1 s); pri konci je priblíženie
  2,68 z 3,0, teda čiara asi o desatinu tenšia než pri stojacej kamere. Úplne dohrať pred zdvihom by posunulo vrchol nad
  64 %.
- **Zdvih nad Herons je rýchly** (3,0 na 1,25 za 0,75 s, rohy do 58 px za snímku, rovnako ako zjazd do dedinky na začiatku);
  okno Magpies sa plní atramentom práve počas neho.
- **Zvuk v slučke** nie je bez švu: dozvuk konca sa v 19,0 s odreže a akord háku znova udrie (pozri Slučka). Nemerané.
- **Vlna má tesnú rezervu** (Otters odíde zo záberu 0,09 s po konci atramentu) a malé okná (8 až 20 px okrem Magpies).
- **Vrchol kĺzania** (kamera vzdialená asi o štvrtinu) mieša strednú úroveň tlače zväčšenú 1,6-krát (25 %) s ostrou (75 %);
  v najrýchlejšej chvíli kĺzania môže byť tlač o niečo mäkšia.
- Hrana ranného kruhu prechádza cez zvieratká s dvomi hodinami (podvečer konca a ráno), asi 0,9 s; na hrane sa môže
  krídlo mlyna alebo svetluška líšiť, hrana je však sama prechodom.
- Zdroj podvečera (okno Hares) je v 9:16 v ľavej tretine (x 277 z 1080), nie v strede.
- Kontrast názvu na podvečernom papieri je odhad (3,6 : 1 samotný modrý, 5,5 : 1 s ružovým); rozhodnúť na snímke 15,3 s.
- Pamäť stránky (49 MB telefón, 80 MB počítač po ťuknutí) je spočítaná z plátien, nemeraná.
- Parametre `?blizko` a `?svetluska` fungujú aj na stránke; sú len na porovnanie snímok a bez nich platí otestované.
- Vo formáte 1:1 je celý ostrov menší (0,649), lebo nad ním a pod ním musí byť text.
