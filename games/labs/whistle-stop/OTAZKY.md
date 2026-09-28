# Whistle Stop M0: tri otázky pre Andreja (GDD 6.1) a posluch zvuku

Toto je test pocitu, nie hotová hra. Funguje len General Store; studňa a holič sú kulisa. Žiadne AI obrázky, všetko je kreslené kódom, zvuk je syntéza. Odkaz pošle Fable, keď M0 prejde bránou (lokálne: `games/labs/whistle-stop/`, stránka má `noindex`).

**Ako hrať 10 minút na telefóne (asi 15 min aj s odpoveďami):**
1. Otvor odkaz na výšku. Prvé ťuknutie zapne zvuk (vietor, veterník).
2. Ťukaj na General Store: jeden ťuk = jeden zákazník (2 s). Nad dverami sa plní lišta, vyskočí minca, chodec príde k obchodu, pri búde ho obslúžia cez okienko, od úrovne 10 vojde dverami (vidno ho vo výklade pri pulte) a vyjde s vrecom.
3. Kupuj úrovne (x1 alebo x10). Pri úrovni 10 pribudne štít, pri 25 veranda a druhý pracovník vo výklade, pri 50 poschodie.
4. Najmi manažérku (1,5 K): odvtedy obchod beží sám a zarába aj keď hru zavrieš (najviac 3 h).
5. Od úrovne 25 ťukni na Interior: fasáda sa zdvihne a obchod zhora sa priblíži; ťukni na miesto v pôdoryse (alebo tlačidlo v karte) a kúp nábytok.
6. Švihni doľava a doprava medzi studňou, obchodom a holičom. Skús tlačidlo Night.

Podľa simulácie ťukajúceho hráča (test `tempo M0`): úroveň 25 okolo 1,5 min, poschodie (50) okolo 5 min.

**Tri otázky (odpoveď áno alebo nie a jedna veta prečo):**

1. **Chceš ťuknúť ešte raz, keď si skončil?**
   Áno / Nie, prečo:

2. **Pôsobí to ako náš vlastný svet, nie ako „AI skúša mobilnú hru“?**
   Áno / Nie, prečo:

3. **Chceš vidieť, ako to mesto porastie?**
   Áno / Nie, prečo:

4. **Zvuk (posluch, asi 5 min, postup v `README.md` časť „Posluch zvuku“):** vietor tichší než ťuk a neruší, vŕzganie veterníka neznie ako chyba, 10 rýchlych ťukov neunavuje, minca nie je ostrá ani príliš častá, míľnik znie slávnostnejšie než kúpa, po prepnutí karty alebo zamknutí telefónu zvuk hneď stíchne a po návrate sa vráti, Sound off stíši všetko.
   Pri každom áno / nie, čo vadí:

Pravidlo z GDD 6.1: nie na otázku 2 znamená jeden pokus o nový štýl, potom PARK (Zoo skončila práve tu). Otázka 4 rozhoduje len o úprave zvuku, nie o M1. Áno na prvé tri = M1 až po bráne 8,5 a za úlohami s pokladňou.
