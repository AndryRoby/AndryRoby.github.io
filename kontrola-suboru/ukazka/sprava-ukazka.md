# Správa z kontroly súboru pain.001

Objednávka: a1b2c3d4
Dátum kontroly: 2026-09-24

## Čo sme kontrolovali

- Súbor vzor-pain001.xml (3 kB): 3 platby v 1 dávke, spolu 1840.00 EUR.
- Banka: Tatra banka (IBAN platiteľa, kód banky 1100). Kontrolovali sme podľa verejne publikovaných požiadaviek tejto banky na import pain.001, normy ISO 20022 a pravidiel EPC SEPA Credit Transfer vrátane pravidiel pre štruktúrovanú adresu (koniec voľnej adresy EPC 9. 9. 2026 odložila, nový termín určí v októbri 2026).
- Kontrolu robí rovnaký motor ako bezplatný nástroj SEPA pain.001 Doctor (https://arling.sk/sepa-pain001-doctor/), doplnený o ručné posúdenie a opravy popísané nižšie.

## Čo sme našli

2 blokujúce chyby. Najzávažnejšie: GrpHdr/NbOfTxs uvádza 2, ale súbor obsahuje 3 transakcií <CdtTrfTxInf>. Nezhoda počtu transakcií je jeden z najčastejších dôvodov zamietnutia importu.

- [blokuje import] GrpHdr/NbOfTxs uvádza 2, ale súbor obsahuje 3 transakcií <CdtTrfTxInf>. Nezhoda počtu transakcií je jeden z najčastejších dôvodov zamietnutia importu. (kde: CstmrCdtTrfInitn/GrpHdr/NbOfTxs; hodnota: 2)
- [blokuje import] CstmrCdtTrfInitn/PmtInf[1]/CdtTrfTxInf[2]: CdtrAcct/Id/IBAN "SK6702000000001234567890" má platný medzinárodný kontrolný súčet (MOD-97), ale posledných 10 číslic neprejde slovenskou kontrolou modulo-11 na základné číslo účtu. Tatra banka túto kontrolu vykonáva pri slovenských kreditných IBAN a platbu by zamietla. Skontrolujte prepis čísla účtu. (kde: CstmrCdtTrfInitn/PmtInf[1]/CdtTrfTxInf[2]/CdtrAcct/Id/IBAN; hodnota: SK6702000000001234567890)
- [treba opraviť] Adresa platiteľa je zapísaná ako voľný text v <AdrLine>. Pravidlá SEPA takú adresu zatiaľ povoľujú, odporúčame však štruktúrovanú adresu: aspoň mesto (TwnNm) a kód krajiny (Ctry) vo vlastných poliach. EPC 9. 9. 2026 odložila koniec neštruktúrovaných adries a nový termín určí v októbri 2026; vaša banka môže mať vlastné pravidlá skôr. (kde: Document/CstmrCdtTrfInitn/PmtInf/Dbtr/PstlAdr; hodnota: Vymyslena 12 | 851 01 Bratislava)
- [treba opraviť] Adresa príjemcu má štruktúrované polia, ale chýba v nej mesto (TwnNm). Mesto a kód krajiny sú podľa pravidiel EPC minimum každej štruktúrovanej aj hybridnej adresy. (kde: Document/CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/Cdtr/PstlAdr; hodnota: Ctry)
- [drobnosť] PmtInf[1]/DbtrAcct/Id/IBAN obsahuje medzery. IBAN v XML sa zapisuje bez medzier. (kde: CstmrCdtTrfInitn/PmtInf[1]/DbtrAcct/Id/IBAN; hodnota: SK24 1100 0000 0026 1234 5678)

## Čo sme opravili automaticky

- 2 adresy rozdelené z voľného textu (AdrLine) na ulicu, číslo, PSČ, mesto a kód krajiny (StrtNm, BldgNb, PstCd, TwnNm, Ctry).
- 1 názov krajiny prepísaný na dvojpísmenový kód ISO (napríklad Slovensko na SK).
- 1 IBAN zbavený medzier.
- NbOfTxs v GrpHdr: 2 prepísané na 3.
- NbOfTxs v PmtInf 1: 2 prepísané na 3.

Po týchto opravách ostávajú 4 nálezy, pozri ďalšiu časť.

## Čo musí opraviť dodávateľ účtovného softvéru

Opravený súbor je hotový pre túto dávku. Rovnaká chyba sa však objaví v každom ďalšom exporte, kým ju neopraví dodávateľ programu, z ktorého súbor vychádza. Nižšie je text, ktorý mu môžete poslať tak, ako je.

Adresy, ktoré sme nechali v pôvodnom tvare, lebo sa nedali rozdeliť s istotou (na ručné rozhodnutie):

- Cdtr: P. O. Box 214 | 040 01 Kosice (poštový priečinok namiesto ulice)

Text pre dodávateľa softvéru (skopírujte a pošlite):

> Dobrý deň, pri importe hromadného príkazu (pain.001) do banky nám kontrola súboru našla tieto body, ktoré vychádzajú priamo z exportu z vášho programu. Prosíme o úpravu exportu tak, aby:
>
> - adresa platiteľa aj príjemcov sa exportovala štruktúrovane (StrtNm, BldgNb, PstCd, TwnNm, Ctry), nie ako voľný text v AdrLine; EPC ukončenie voľnej adresy 9. 9. 2026 odložila a nový termín určí v októbri 2026, štruktúrovaná adresa je však smer, ktorý EPC odporúča.
> - CstmrCdtTrfInitn/PmtInf[1]/CdtTrfTxInf[2]: CdtrAcct/Id/IBAN "SK6702000000001234567890" má platný medzinárodný kontrolný súčet (MOD-97), ale posledných 10 číslic neprejde slovenskou kontrolou modulo-11 na základné číslo účtu. Tatra banka túto kontrolu vykonáva pri slovenských kreditných IBAN a platbu by zamietla. Skontrolujte prepis čísla účtu.
> - Adresa príjemcu má štruktúrované polia, ale chýba v nej mesto (TwnNm). Mesto a kód krajiny sú podľa pravidiel EPC minimum každej štruktúrovanej aj hybridnej adresy. Správny tvar: <TwnNm>Bratislava</TwnNm>
>
> Ďakujeme.

## Ako ďalej

1. Opravený súbor nahrajte do internet bankingu rovnako ako pôvodný export.
2. Ak banka súbor odmietne, pošlite nám presné znenie chyby z banky; odpovieme e-mailom.

O prijatí súboru rozhoduje banka. ARLing s. r. o. nie je banka; táto správa je formátová kontrola podľa verejne publikovaných pravidiel a opravený súbor nie je zárukou, že ho banka prijme.

ARLing s. r. o., andrej@arling.sk
