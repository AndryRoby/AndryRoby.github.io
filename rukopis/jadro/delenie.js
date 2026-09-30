export const unik = s => s.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
export const slova = s => [...s.matchAll(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu)]
  .map(m => ({ text: m[0], od: m.index, do: m.index + m[0].length }));

// UTF-16 intervaly smerujú do pôvodného vstupu, koniec je exkluzívny.
// Text z PDF alebo Wordu: zlepené slová sa rozdelia medzerou a riadky, ktoré nie sú
// súvislý text (obsah, čísla strán, titulná strana, číslované nadpisy, vzorce), sa
// z merania vynechajú. Pozície vynechaných riadkov ostávajú v pôvodnom vstupe.
export function normalizuj(original) {
  let text = '';
  let od = [], konce = [];
  // v1.4: r\u00fdchla cesta pre be\u017en\u00fd text (u\u017e v NFC, bez CR, typografick\u00fdch apostrofov a samostatn\u00fdch znamienok).
  // Mapa poz\u00edci\u00ed je vtedy identita, v\u00fdsledok je rovnak\u00fd ako v pomalej vetve.
  if (!/[\r\u2019\u2018\p{M}]/u.test(original) && original.normalize('NFC') === original) {
    text = original;
    od = new Array(original.length);
    konce = new Array(original.length);
    for (let i = 0; i < original.length; i++) { od[i] = i; konce[i] = i + 1; }
  } else for (const m of original.matchAll(/\r\n|[\u1100-\u11ff\uac00-\ud7a3]+\p{M}*|[^\r]\p{M}*|\r/gu)) {
    const s = m[0].normalize('NFC').replace(/\r\n/g, '\n').replace(/[’‘]/g, "'");
    text += s;
    for (let i = 0; i < s.length; i++) {
      od.push(m.index);
      konce.push(m.index + m[0].length);
    }
  }
  // 1. Zlepené slová: „LaukoEKONOMICKÁ“, „nákladov.Ďalšia“. Vložená medzera má nulovú šírku v origináli.
  const zlepene = [];
  const vlozit = new Set();
  for (const m of text.matchAll(ZLEPENE)) {
    const i = m.index + (m[1] ?? m[2]).length;
    vlozit.add(i);
    // Príklad slova stačí z okolia 80 znakov; celý text by pri 30 000 slovách spomalil meranie.
    const zaciatok = Math.max(0, i - 80) + text.slice(Math.max(0, i - 80), i).search(/[\p{L}\p{N}.!?]*$/u);
    zlepene.push(text.slice(zaciatok, i) + text.slice(i, i + 80).match(/^[\p{L}\p{N}]*/u)[0]);
  }
  if (vlozit.size) {
    let t = '';
    const o = [], k = [];
    for (let i = 0; i < text.length; i++) {
      if (vlozit.has(i)) { t += ' '; o.push(od[i]); k.push(od[i]); }
      t += text[i]; o.push(od[i]); k.push(konce[i]);
    }
    text = t; od = o; konce = k;
  }
  // 2. Riadky mimo súvislého textu sa vyrežú aj s koncom riadka, susedné riadky sa spoja.
  const vynechane = [];
  const sum = sumRiadky(text);
  if (sum.length) {
    const von = new Uint8Array(text.length);
    for (const r of sum) {
      von.fill(1, r.od, r.do);
      vynechane.push({ od: od[r.od], do: konce[r.do - 1], dovod: r.dovod });
    }
    let t = '';
    const o = [], k = [];
    for (let i = 0; i < text.length; i++) if (!von[i]) { t += text[i]; o.push(od[i]); k.push(konce[i]); }
    text = t; od = o; konce = k;
  }
  return { text, rozsah: (a, b) => ({ od: od[a] ?? original.length, do: konce[b - 1] ?? original.length }), vynechane, zlepene };
}

// Dve malé písmená + aspoň tri veľké bez ďalšieho malého (LaukoEKONOMICKÁ),
// alebo bodka bez medzery pred novou vetou (nákladov.Ďalšia). Iné spojenia (PowerPoint) nemeníme.
const ZLEPENE = /(\p{Ll}{2})(?=\p{Lu}{3,}(?!\p{Ll}))|(\p{Ll}{2}[.!?])(?=\p{Lu}\p{Ll})/gu;
const KONCOVE = /[.!?…:;,"'“”»)\]]$/u;
const TITUL = new RegExp('(?<!\\p{L})(?:' + [
  'univerzit', 'universit', 'vysoká škola', 'vysoké učení', 'hochschule', 'fakult', 'faculty',
  'evidenčné číslo', 'evidenční číslo', 'registration number', 'matrikelnummer',
  'bakalársk[aá] práca', 'diplomov[aá] práca', 'záverečn[aá] práca', 'dizertačn', 'bakalářská práce', 'diplomová práce', 'závěrečná práce',
  "bachelor'?s thesis", "master'?s thesis", 'bachelorarbeit', 'masterarbeit',
  'študijný program', 'studijní program', 'study programme', 'study program', 'studiengang',
  'študijný odbor', 'studijní obor', 'školiace pracovisko', 'školicí pracoviště', 'katedra',
  'vedúci (?:záverečnej |bakalárskej |diplomovej )?práce', 'vedoucí práce', 'supervisor', 'betreuer', 'konzultant',
  'čestné vyhlásenie', 'čestné prohlášení', 'poďakovanie', 'poděkování', 'acknowledg', 'danksagung',
  'kľúčové slová', 'klíčová slova', 'keywords', 'schlüsselwörter', 'abstrakt(?!\\p{L})', 'abstract(?!\\p{L})'
].join('|') + ')', 'giu');
const OBSAH = /(?:\.{4,}|(?:\. ){4,}|…{2,}|_{4,}|·{4,})\s*\d{1,4}\s*$|^(?:obsah|contents|table of contents|inhaltsverzeichnis|zoznam (?:tabuliek|obrázkov|grafov|skratiek)|seznam (?:tabulek|obrázků|zkratek))$/iu;
const STRANA = /^(?:[-–—([]?\s*\d{1,4}\s*[-–—)\]]?|(?:strana|str\.|stránka|page|seite|s\.)\s*\d{1,4}(?:\s*(?:z|of|von|\/)\s*\d{1,4})?|\d{1,4}\s*\/\s*\d{1,4}|(?=[ivxlcdm])m{0,3}(?:cm|cd|d?c{0,3})(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3}))$/iu;
const TITUL_JEDEN = new RegExp(TITUL.source, 'iu');
const CISLOVANY = /^(\d{1,2}(?:\.\d{1,2}){0,4})\.?\s+(\p{L}.*)$/u;
const KAPITOLA = /^(?:kapitola|chapter|kapitel|časť|část|part|teil)\s+\d{1,3}(?!\p{L})/iu;
const MATEMATIKA = /[=±×÷∑∏√∫≤≥∞∆Δπ∂→⇒∈≈≠^]/u;
export const DOVODY = ['obsah', 'strana', 'titul', 'nadpis', 'vzorec'];
export const TITUL_STROP = 25;

// Vráti riadky, ktoré nie sú súvislý text, s dôvodom. Koniec intervalu obsahuje aj \n.
export function sumRiadky(text) {
  const riadky = [];
  let od = 0;
  for (const r of text.split('\n')) {
    riadky.push({ od, do: od + r.length + 1, t: r.trim() });
    od += r.length + 1;
  }
  const plne = riadky.filter(r => r.t);
  const prvy = plne.find(r => slova(r.t).length);
  if (!plne.length) return [];
  const pdf = !/\n\s*\n/.test(text) && plne.length >= 5;
  // Typická šírka riadku tela: medián riadkov s aspoň 8 slovami (titulné a krátke riadky ho neskreslia).
  const telove = plne.filter(r => slova(r.t).length >= 8);
  const dlzky = (telove.length ? telove : plne).map(r => r.t.length).sort((a, b) => a - b);
  const median = dlzky[Math.floor(dlzky.length / 2)];
  const kluc = t => t.toLowerCase().replace(/\s+/g, ' ');
  const pocty = new Map();
  for (const r of plne) pocty.set(kluc(r.t), (pocty.get(kluc(r.t)) ?? 0) + 1);
  const out = [], vyradene = new Set();
  for (let i = 0; i < riadky.length; i++) {
    const r = riadky[i], t = r.t;
    if (!t) continue;
    const w = slova(t).length;
    const pismena = (t.match(/\p{L}/gu) || []).length, velke = (t.match(/\p{Lu}/gu) || []).length;
    const znaky = t.replace(/\s/g, '').length;
    const titul = t.match(TITUL)?.length ?? 0;
    const bezBodky = !/[.!?]$/.test(t);
    let dovod = null;
    if (OBSAH.test(t) || (/\t+\d{1,4}\s*$/.test(t) && w <= 15)) dovod = 'obsah';
    else if (STRANA.test(t)) dovod = 'strana';
    // v1.4 po bráne 1: dve slová z titulnej strany alebo dve dvojbodky vyradia riadok len do TITUL_STROP slov;
    // súvislý odsek o univerzitách a fakultách je text práce a meria sa.
    else if (titul && ((w <= 14 && bezBodky) || (w <= TITUL_STROP && (titul >= 2 || (t.match(/:/g) || []).length >= 2)) || (t.includes(':') && slova(t.split(':')[0]).length <= 5 && TITUL_JEDEN.test(t.split(':')[0])))) dovod = 'titul';
    else if (KAPITOLA.test(t) && w <= 12) dovod = 'nadpis';
    else if (CISLOVANY.test(t)) {
      const [, cislo, zvysok] = t.match(CISLOVANY);
      if (!/[.!?:;,]$/.test(t) && (cislo.includes('.') ? slova(zvysok).length <= 15 : slova(zvysok).length <= 8 && /^\p{Lu}/u.test(zvysok))) dovod = 'nadpis';
    }
    if (!dovod && pismena >= 6 && velke / pismena >= .8 && w <= 12 && bezBodky) dovod = 'nadpis';
    if (!dovod && ((MATEMATIKA.test(t) && (w <= 8 || pismena / znaky < .6)) || (znaky >= 3 && pismena / znaky < .4 && /\d/.test(t)))) dovod = 'vzorec';
    if (!dovod && w >= 2 && w <= 12 && bezBodky && pocty.get(kluc(t)) >= 2 && (!pdf || t.length < median * .7)) dovod = 'strana';
    if (!dovod && w <= 10 && !KONCOVE.test(t) && /^\p{Lu}/u.test(t) && r !== prvy) {
      // Nečíslovaný nadpis: krátky riadok bez interpunkcie, za ním nový blok s veľkým písmenom.
      let p = i - 1, n = i + 1;
      while (p >= 0 && !riadky[p].t) p--;
      while (n < riadky.length && !riadky[n].t) n++;
      const predTym = p < 0 || p < i - 1 || KONCOVE.test(riadky[p].t) || vyradene.has(p) || (slova(riadky[p].t).length <= 10 && !KONCOVE.test(riadky[p].t));
      if (n < riadky.length && /^[\p{Lu}\p{N}]/u.test(riadky[n].t) && predTym && (!pdf || t.length < median * .7)) dovod = 'nadpis';
    }
    if (dovod) { out.push({ od: r.od, do: Math.min(r.do, text.length), dovod }); vyradene.add(i); }
  }
  return out;
}

const orez = (text, od, koniec) => {
  while (od < koniec && /\s/u.test(text[od])) od++;
  while (koniec > od && /\s/u.test(text[koniec - 1])) koniec--;
  return { text: text.slice(od, koniec), od, do: koniec };
};

// Bez prázdnych riadkov je odsekom každý riadok, okrem zalomenia z PDF: ďalší riadok
// začína malým písmenom alebo predošlý končí čiarkou, bodkočiarkou či spojovníkom.
export function odseky(text) {
  let oddelovac = /\n\s*\n/g;
  if (!/\n\s*\n/.test(text) && text.split('\n').length >= 3) oddelovac = /(?<![,;]|\p{L}-)\n(?![ \t]*\p{Ll})/gu;
  const out = [];
  let od = 0;
  for (const m of text.matchAll(oddelovac)) {
    out.push(orez(text, od, m.index));
    od = m.index + m[0].length;
  }
  out.push(orez(text, od, text.length));
  return out.filter(p => p.text);
}

export function vety(text, jazyk, posun = 0) {
  const chranene = new Set();
  const chran = re => {
    for (const m of text.matchAll(re)) {
      for (let i = m.index; i < m.index + m[0].length; i++) chranene.add(i);
    }
  };
  for (const s of jazyk.SKRATKY) {
    chran(new RegExp('(?<![\\p{L}\\p{N}])' + unik(s).replace(/ /g, '\\s+'), 'giu'));
  }
  chran(/\d{1,2}\.\s*\d{1,2}\.\s*\d{2,4}/gu);
  chran(/\d+[.,]\d+/gu);
  const out = [];
  let start = 0;
  for (const m of text.matchAll(/[.!?…]+["'“”«»‚‘)]*(?=\s+(?:[\p{Lu}\p{N}"'„“«‚‘]))/gu)) {
    if (chranene.has(m.index)) continue;
    const end = m.index + m[0].length;
    const p = orez(text, start, end);
    if (slova(p.text).length) out.push({ ...p, od: p.od + posun, do: p.do + posun });
    start = end;
  }
  const p = orez(text, start, text.length);
  if (slova(p.text).length) out.push({ ...p, od: p.od + posun, do: p.do + posun });
  return out;
}

// v1.4: limit 5 000 slov zrušený. Strop je len poistka pre knihy nad 100 000 slov tela.
export const STROP_SLOV = 100000;

export function priprav(text, jazyk) {
  const povodne = odseky(text);
  const prvy = povodne[0];
  const nadpis = prvy && slova(prvy.text).length <= 12 && !/[.!?]["'“”»]*$/u.test(prvy.text) ? prvy : null;
  let telo = povodne.slice(nadpis ? 1 : 0);
  const slovaTela = telo.flatMap(p => slova(p.text).map(w => ({ ...w, od: w.od + p.od, do: w.do + p.od })));
  const orezane = slovaTela.length > STROP_SLOV;
  const koniec = orezane ? slovaTela[STROP_SLOV - 1].do : text.length;
  telo = telo.filter(p => p.od < koniec).map(p => ({ ...p, do: Math.min(p.do, koniec), text: text.slice(p.od, Math.min(p.do, koniec)) }));
  const vsetky = [], rytmus = [], dlzkyOdsekov = [];
  for (const p of telo) {
    let skupina = [], pocet = 0, offset = p.od;
    const vloz = () => {
      if (!skupina.length) return;
      const vs = vety(skupina.map(x => x.text).join('\n'), jazyk, skupina[0].od);
      vsetky.push(...vs);
      rytmus.push(...vs);
      pocet += vs.reduce((s, v) => s + slova(v.text).length, 0);
      skupina = [];
    };
    for (const riadok of p.text.split('\n')) {
      if (/^\s*(?:[-*•]|\d+[.)])\s/u.test(riadok)) {
        vloz();
        vsetky.push(...vety(riadok, jazyk, offset));
      } else skupina.push({ text: riadok, od: offset });
      offset += riadok.length + 1;
    }
    vloz();
    if (pocet) dlzkyOdsekov.push(pocet);
  }
  return { nadpis, telo, vsetky, rytmus, dlzkyOdsekov, slova: orezane ? slovaTela.slice(0, STROP_SLOV) : slovaTela, orezane, povodneSlov: slovaTela.length, koniec };
}

export function odhadJazyka(text, jazyky) {
  const prvy = odseky(text)[0];
  const nadpis = prvy && slova(prvy.text).length <= 12 && !/[.!?]["'“”»]*$/u.test(prvy.text);
  const words = slova(nadpis ? text.slice(prvy.do) : text).map(w => w.text.toLowerCase());
  if (words.length < 30) return null;
  const skore = Object.entries(jazyky).map(([id, j]) => {
    const slovnik = new Set(j.FUNKCNE.slice(0, 40).map(x => x.toLowerCase()));
    const znaky = { sk: /[äôĺľŕ]/giu, cs: /[řěů]/giu, de: /[ßü]/giu }[id];
    return [id, words.filter(w => slovnik.has(w)).length + (znaky ? (text.match(znaky) || []).length * 5 : 0)];
  }).sort((a, b) => b[1] - a[1]);
  return skore[0][1] > (skore[1]?.[1] ?? 0) ? skore[0][0] : null;
}
