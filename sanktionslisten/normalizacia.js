/* GENEROVANÉ z ops/saas/sankcie/normalizacia.mjs skriptom ops/saas/sankcie/postav-web.mjs. Neupravovať tu. */
/* Normalizácia mien pre porovnanie so sankčným zoznamom EÚ.
 * Rovnaký kód beží v Node (testy, meranie) aj v prehliadači
 * (products/arling-sk/sanktionslisten/normalizacia.js je jeho kópia).
 *
 * Postup pre meno partnera aj pre alias zo zoznamu (vždy rovnako na oboch
 * stranách, preto nevadí, že niektoré kroky sú hrubé):
 *  1. prepis azbuky a gréčtiny do latinky (zjednodušený, blízky anglickému
 *     prepisu, ktorý používa sám zoznam EÚ),
 *  2. malé písmená, zloženie diakritiky (ü -> u, ß -> ss, ł -> l ...),
 *  3. interpunkcia -> medzera,
 *  4. odstránenie právnych foriem (GmbH, AG, KG, Ltd, LLC, OOO, JSC ...,
 *     aj celé slovné spojenia ako „Gesellschaft mit beschränkter Haftung“
 *     alebo „Limited Liability Company“) a spojok,
 *  5. fonetický kľúč tokenu (w -> v, j/y -> i, sch -> sh, ae -> a,
 *     zdvojené písmená), aby Iwanow a Ivanov, Müller a Mueller dali to isté.
 * Poradie tokenov sa nezachováva zámerne: prehodené meno a priezvisko je
 * tá istá množina tokenov. */

const AZBUKA = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  і: 'i', ї: 'yi', є: 'ye', ґ: 'g', ў: 'u', ђ: 'dj', ј: 'j', љ: 'lj', њ: 'nj', ћ: 'c', џ: 'dz', ѓ: 'g', ќ: 'k', ѕ: 'dz',
};
const GRECTINA = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm',
  ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
};
const SPECIALNE = { ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', ł: 'l', đ: 'd', ð: 'd', þ: 'th', ı: 'i', ħ: 'h', ŀ: 'l', ə: 'e', ɨ: 'i', ŋ: 'ng' };

/* Právne formy ako samostatné tokeny (po kroku 3). Zdroj: bežné skratky
 * v DE, AT, CH, EÚ, UK, USA a v zozname EÚ samom (OOO, ZAO, PAO, JSC ...). */
export const PRAVNE_FORMY = new Set([
  'gmbh', 'mbh', 'ggmbh', 'ag', 'kg', 'kgaa', 'ohg', 'gbr', 'egbr', 'ug', 'ek', 'ekfr', 'ev', 'eg', 'se', 'co', 'cokg',
  'haftungsbeschrankt', 'haftungsbeschraenkt', 'partg', 'partgmbb', 'mbb', 'kft', 'zrt', 'nyrt', 'rt',
  'ltd', 'limited', 'llc', 'llp', 'lp', 'plc', 'inc', 'incorporated', 'corp', 'corporation', 'company', 'pte', 'pvt', 'sdn', 'bhd',
  'sa', 'sas', 'sarl', 'srl', 'spa', 'sl', 'slu', 'bv', 'nv', 'oy', 'oyj', 'ab', 'as', 'asa', 'aps', 'sro', 'spol', 'doo', 'dd', 'ad', 'ead', 'jsc', 'ojsc', 'cjsc', 'pjsc',
  'ooo', 'oao', 'zao', 'pao', 'ao', 'tov', 'fgup', 'gup', 'mup', 'nko',
  'fze', 'fzco', 'fzc', 'fzllc', 'fzcollc', 'dmcc', 'wll', 'spc', 'saog', 'saoc', 'pjs', 'psc', 'sp', 'zoo',
]);

/* Všeobecné obchodné slová: samé o sebe nestačia na pravidlo „meno je celé
 * obsiahnuté“ (zhoda.mjs, pravidlá B a C pri jednom tokene). Porovnávajú sa
 * po fonetickom kľúči (prevedie ho klucTokenu pri načítaní modulu). */
export const VSEOBECNE_SLOVA = new Set([
  'enginering', 'international', 'industries', 'industri', 'industrial', 'technologi', 'technologies', 'trading', 'trade',
  'services', 'service', 'holding', 'holdings', 'group', 'grup', 'logistics', 'logistik', 'construction', 'consulting',
  'investment', 'investments', 'capital', 'finance', 'financial', 'management', 'development', 'energi', 'energie', 'sistems',
  'solutions', 'import', 'export', 'global', 'general', 'national', 'united', 'shiping', 'transport', 'transporte', 'handel',
  'immobilien', 'maschinenbau', 'elektrotechnik', 'software', 'marketing', 'manufacturing', 'petroleum', 'chemicals',
].map((s) => klucTokenu(s)));
/* Spojky a členy bez rozlišovacej hodnoty. „al“ a „el“ (arabský člen) tiež,
 * lebo zoznam ich píše raz oddelene, raz spolu s pomlčkou. */
const SPOJKY = new Set(['the', 'and', 'und', 'et', 'of', 'for', 'fur', 'der', 'die', 'das', 'de', 'del', 'della', 'di', 'du', 'des', 'la', 'le', 'les', 'y', 'e', 'i', 'al', 'el', 'ul']);

/* Viacslovné právne formy. Zapísané v pôvodnom znení; do porovnateľnej
 * podoby ich prevedie ten istý postup ako mená (pri načítaní modulu). */
const FRAZY_POVODNE = [
  'Gesellschaft mit beschränkter Haftung', 'mit beschränkter Haftung', 'gemeinnützige GmbH', 'GmbH & Co. KG', 'GmbH & Co. KGaA', 'AG & Co. KG',
  'Unternehmergesellschaft', 'Aktiengesellschaft', 'Kommanditgesellschaft auf Aktien', 'Kommanditgesellschaft', 'offene Handelsgesellschaft',
  'Gesellschaft bürgerlichen Rechts', 'eingetragener Kaufmann', 'eingetragene Kauffrau', 'eingetragener Verein', 'eingetragene Genossenschaft', 'Partnerschaftsgesellschaft',
  'Limited Liability Company', 'Limited Liability Partnership', 'Limited Partnership', 'Private Limited Company', 'Public Limited Company', 'Company Limited', 'Limited Company',
  'Public Joint Stock Company', 'Private Joint Stock Company', 'Open Joint Stock Company', 'Closed Joint Stock Company', 'Joint Stock Company', 'Joint-Stock Company', 'Stock Company',
  'Federal State Unitary Enterprise', 'State Unitary Enterprise', 'Unitary Enterprise', 'Free Zone Establishment', 'Free Zone Company', 'sp. z o.o.', 's.r.o.', 'spol. s r.o.',
  'Общество с ограниченной ответственностью', 'Акционерное общество', 'Публичное акционерное общество', 'Открытое акционерное общество', 'Закрытое акционерное общество',
  'Федеральное государственное унитарное предприятие', 'Государственное унитарное предприятие', 'Товариство з обмеженою відповідальністю', 'Публічне акціонерне товариство', 'Акціонерне товариство',
  'Obshchestvo s Ogranichennoy Otvetstvennostyu', 'Aktsionernoe Obshchestvo', 'Publichnoe Aktsionernoe Obshchestvo', 'Otkrytoe Aktsionernoe Obshchestvo', 'Zakrytoe Aktsionernoe Obshchestvo',
];

export function prepis(s) {
  let out = '';
  // Grécke ου je u (Papadopoulos), nie oy.
  for (const ch of String(s || '').replace(/ου/g, 'ou').replace(/ΟΥ/g, 'OU').replace(/Ου/g, 'Ou')) {
    const low = ch.toLowerCase();
    const r = AZBUKA[low] ?? GRECTINA[low];
    out += r === undefined ? ch : r;
  }
  return out;
}

/* Kroky 1 až 3: text bez diakritiky, len [a-z0-9] a medzery. Nelatinské
 * písma, ktoré prepis nepozná (arabské, čínske ...), vypadnú. */
export function zloz(s) {
  // Diakritika preč ešte pred prepisom, aby grécke ή, ό a azbukové й, ё
  // prešli cez základné písmeno (й -> и -> i, ό -> ο -> o).
  let t = String(s || '').normalize('NFKC').toLowerCase().normalize('NFD').replace(/\p{M}+/gu, '');
  t = prepis(t);
  t = t.replace(/[ßæœøłđðþıħŀəɨŋ]/g, (c) => SPECIALNE[c]);
  t = t.replace(/[^a-z0-9]+/g, ' ').trim();
  return t;
}

/* Krok 5: fonetický kľúč jedného tokenu. */
export function klucTokenu(t) {
  return t
    .replace(/tsch/g, 'ch').replace(/sch/g, 'sh').replace(/ph/g, 'f').replace(/kh/g, 'h').replace(/ck/g, 'k')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u').replace(/ou/g, 'u')
    .replace(/w/g, 'v').replace(/[yj]/g, 'i')
    .replace(/(.)\1+/g, '$1');
}

const FRAZY = FRAZY_POVODNE
  .map((f) => zloz(f).split(' ').filter(Boolean))
  .filter((f) => f.length > 1)
  .sort((a, b) => b.length - a.length);

function odstranFrazy(tokeny) {
  const out = [];
  let odstranene = false;
  for (let i = 0; i < tokeny.length;) {
    let dlzka = 0;
    for (const f of FRAZY) {
      if (f.length > tokeny.length - i) continue;
      let ok = true;
      for (let k = 0; k < f.length; k++) if (tokeny[i + k] !== f[k]) { ok = false; break; }
      if (ok) { dlzka = f.length; break; }
    }
    if (dlzka) { i += dlzka; odstranene = true; } else { out.push(tokeny[i]); i++; }
  }
  return { tokeny: out, odstranene };
}

/* Hlavná funkcia: meno -> { tokeny (fonetické kľúče, bez duplicít),
 * zlozene (čitateľná podoba po krokoch 1 až 4), pravnaForma (bola odstránená) }.
 * Jednopísmenové tokeny (iniciály, zvyšky skratiek) sa zahodia. Ak by po
 * odstránení právnych foriem nezostalo nič (firma sa volá „AG“), vráti sa
 * pôvodný zložený text, aby sa nestratila. */
/* Za sebou idúce jednopísmenové tokeny sa spoja: „T.M.G.“ -> „tmg“,
 * „e.K.“ -> „ek“ (a potom odpadne ako právna forma). Osamelé písmeno
 * (iniciála, „N Holding“) ostáva ako token, aby sa meno nezúžilo na
 * všeobecné slovo; porovnáva sa len presne. */
function spojIniciály(tokeny) {
  const out = [];
  let beh = '';
  for (const t of tokeny) {
    if (t.length === 1) { beh += t; continue; }
    if (beh) { out.push(beh); beh = ''; }
    out.push(t);
  }
  if (beh) out.push(beh);
  return out;
}

export function normalizuj(meno) {
  const zlozene = zloz(meno);
  const surove = zlozene ? zlozene.split(' ') : [];
  const { tokeny: poFrazach, odstranene } = odstranFrazy(surove);
  let pravnaForma = odstranene;
  const zostatok = [];
  for (const t of spojIniciály(poFrazach)) {
    if (PRAVNE_FORMY.has(t)) { pravnaForma = true; continue; }
    if (SPOJKY.has(t)) continue;
    zostatok.push(t);
  }
  const zaklad = zostatok.length ? zostatok : surove.filter((t) => t.length >= 2);
  const tokeny = [];
  const slova = []; // slovo pred fonetickým kľúčom, na rovnakom indexe ako token
  for (const slovo of zaklad) {
    const k = klucTokenu(slovo);
    if (!k.length || tokeny.includes(k)) continue;
    tokeny.push(k);
    slova.push(slovo);
  }
  return { tokeny, slova, zlozene: zaklad.join(' '), pravnaForma };
}

/* Obsahuje text písmená, ktoré náš prepis nevie previesť do latinky? */
export function maNelatinskePismo(s) {
  return /[^\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\p{N}\p{P}\p{S}\p{Z}\p{M}]/u.test(String(s || ''));
}
