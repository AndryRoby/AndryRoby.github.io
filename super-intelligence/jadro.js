// AI to SI: jadro nástroja na zámenu pojmov podľa exekutívneho príkazu USA z 29. 9. 2026
// („Inaugurating The Era Of Super Intelligence“). Čistá logika bez DOM: beží v prehliadači
// (stranka.js) aj v Node (test/si.test.mjs). Nič neposiela a nič neukladá.
//
// Čo robí:
//   1. nájde „Artificial Intelligence“ v akýchkoľvek veľkých písmenách, „A.I.“ a „AI“ ako celé slovo,
//      aj množné číslo, privlastnenie a zložené slová (AIs, AI's, AI-powered, non-AI);
//      OpenAI, GenAI, Thai, Mail, AIDS, AIM ani FAIR nenájde,
//   2. navrhne náhradu so zachovaním veľkosti písmen (Super Intelligence, super intelligence, SI, S.I.),
//   3. sama nemení a označí na posúdenie: adresy, hashtagy a účty, iné významy AI (AI/AN, avian
//      influenza (AI)), názvy zákonov (… Act), názvy skôr vydaných dokumentov (Executive Order 14110, …),
//      citáty v úvodzovkách a mená s veľkými písmenami (AI Safety Institute, Google AI, Chief AI Officer).
// Príkaz: Sec. 2(b) nevyžaduje meniť skôr vydané dokumenty, Sec. 3(a) viaže SI len na AI ako technológiu.
// Mená hádame podľa veľkých písmen. Preto každý ponechaný nález ukazujeme s dôvodom a rozhodne človek.
// Zámerne bez lookbehind v regulárnych výrazoch: starší Safari by modul vôbec nenačítal.
// Znaky mimo ASCII v regulárnych výrazoch len ako \u{…} s príznakom u (Write zapisoval \uXXXX ako znak).

export const VERZIA = '1.1';
export const MAX_ZNAKOV = 1000000;
export const MAX_BAJTOV = 5 * 1024 * 1024;

// Jeden riadok dôvodu ku každému ponechanému nálezu (zobrazuje ho stránka). Pri inom význame AI
// je dôvod konkrétny (nález.dovod cituje definíciu z textu), toto je záložné znenie.
const PRE_TECHNOLOGIU = ' The order’s SI covers only AI the technology (Sec. 3(a)), so this stays.';
export const DOVODY = Object.freeze({
  odkaz: 'Web and e-mail addresses stay, or the link breaks.',
  identifikator: 'Hashtags and handles stay: a changed one points somewhere else.',
  vyznam: 'Here AI means something other than the technology.' + PRE_TECHNOLOGIU,
  zakon: 'Statute titles stay: the order covers non-statutory documents.',
  dokument: 'Title of an earlier document. The order does not require changing previously issued documents (Sec. 2(b)).',
  citat: 'Quotations stay word for word.',
  nazov: 'Names stay as their owners write them. Change it only if the owner renamed it.',
});
export const NAZVY_DOVODOV = Object.freeze({ odkaz: 'Web address', identifikator: 'Hashtag or handle', vyznam: 'Other meaning of AI',
  zakon: 'Statute title', dokument: 'Earlier document', citat: 'Quotation', nazov: 'Name' });

// Ukážka pre tlačidlo „Load sample“. Rovnaký text je staticky v textarea v index.html (stráži test).
// Obsahuje každý prípad: plný pojem, malé písmená, (AI), A.I., AIs, AI's, AI-powered, AI-driven,
// tri zákony, názov skoršieho príkazu, AI/AN, dve mená, adresu, citát a slová, ktoré sa nájsť nesmú.
export const UKAZKA = `SAMPLE: an internal memo written for this page, not a real agency document

Subject: Using Artificial Intelligence in public-facing services

Consistent with the National Artificial Intelligence Initiative Act of 2020, the Advancing American AI Act and, for our European partners, the EU AI Act, the Office will expand its use of artificial intelligence (AI) in 2027. Two AI-powered search tools and one AI-driven translation pilot for Thai-language pages move to production in March. Each system's A.I. risk review goes to the Chief AI Officer, and AIs that support benefit decisions need a human sign-off. Log the AI's output with every case file and post a plain-language summary on AI.gov.

References to Executive Order 14110, Safe, Secure, and Trustworthy Development and Use of Artificial Intelligence, stay as issued. Outreach to American Indian and Alaska Native (AI/AN) communities continues unchanged.

Staff must not paste case files into OpenAI products or other GenAI services. Grantees in the HIV/AIDS and AIM programs keep following the FAIR data principles. Send questions to the Mail Services team or to our Google AI liaison. As the Administrator put it, “AI must earn the public's trust before it earns our budget.”`;

// ── Znaky a hranice slov ─────────────────────────────────────────────────────
const SLOVNY = /[\p{L}\p{N}_]/u;
const jeSlovny = (ch) => !!ch && SLOVNY.test(ch);
const SPOJOVNIKY = '-\u{2010}\u{2011}';
const jeSpojovnik = (ch) => !!ch && SPOJOVNIKY.includes(ch);

// Plný pojem: medzi slovami medzera (aj pevná), jeden zlom riadka alebo spojovník.
const PLNY = /(artificial)([^\S\r\n]+|[^\S\r\n]*\r?\n[^\S\r\n]*|[-\u{2010}\u{2011}])(intelligences?)/giu;
// „A.I.“, „A.I“ bez poslednej bodky (The A.I review) a „AI“. Malé „ai“ ani „A. I.“ s medzerou nie (FAQ to hovorí).
const SKRATKA = /A\.I\.?|AI/g;
// Slovo pre pravidlá okolia (zákony, mená): písmená a číslice, vnútri aj spojovník, apostrof, bodka a &.
const TOKEN = /[\p{L}\p{N}]+(?:[-\u{2010}\u{2011}'’.&][\p{L}\p{N}]+)*/gu;
const MEDZERA = /^[ \u{a0}\u{202f}]$/u;
// Názov zákona sa v zalomenom texte môže rozdeliť na dva riadky (… AI\nAct), preto pri ňom aj jeden zlom.
const MEDZERA_ALEBO_ZLOM = /^(?:[ \u{a0}\u{202f}]|[ \t\u{a0}\u{202f}]*\r?\n[ \t\u{a0}\u{202f}]*)$/u;

const SPOJKY = new Set(['of', 'for', 'and', 'the', 'in', 'on', 'to', 'a', 'an', 'with', 'by', 'at', 'from']);
// Slová s veľkým písmenom pred pojmom, z ktorých meno nevzniká (úvod vety, štýl úradných textov).
const STOP_PRED = new Set(['The', 'A', 'An', 'This', 'That', 'These', 'Those', 'Our', 'Your', 'Their', 'Its', 'His', 'Her',
  'My', 'We', 'They', 'It', 'He', 'She', 'I', 'You', 'Each', 'Every', 'Any', 'All', 'Some', 'Many', 'Most', 'More', 'Less',
  'Few', 'No', 'Such', 'Both', 'Other', 'Another', 'Using', 'Use', 'With', 'Without', 'For', 'From', 'In', 'On', 'Of', 'To',
  'By', 'At', 'As', 'And', 'Or', 'But', 'If', 'When', 'Where', 'Why', 'How', 'What', 'Which', 'Who', 'While', 'Because',
  'Although', 'Since', 'Before', 'After', 'During', 'Under', 'Over', 'Into', 'Through', 'Across', 'Between', 'Among', 'About',
  'Against', 'Federal', 'National', 'Government', 'Agency', 'Department', 'State', 'Generative', 'New', 'Current', 'Future',
  'Existing', 'Is', 'Are', 'Was', 'Were', 'Be', 'Can', 'Could', 'May', 'Might', 'Must', 'Should', 'Will', 'Would', 'Do',
  'Does', 'Did', 'Has', 'Have', 'Had', 'Not']);
const STOP_ZA = new Set(['I']);
// Značky, ktoré tvoria meno aj na začiatku vety (Google AI, Azure AI). Firmy s AI v mene (Scale AI, Shield AI,
// Stability AI) sú tu tiež: „Scale AI won the contract“ je meno, nie sloveso; omyl smerom k posúdeniu je bezpečný.
const ZNACKY = new Set(['Google', 'Microsoft', 'Meta', 'Amazon', 'IBM', 'Intel', 'NVIDIA', 'Nvidia', 'Salesforce', 'Oracle',
  'Adobe', 'Anthropic', 'Azure', 'Vertex', 'Palantir', 'Mistral', 'Cohere', 'Samsung', 'Baidu', 'Alibaba', 'Tencent',
  'Huawei', 'Qualcomm', 'Cisco', 'SAP', 'ServiceNow', 'Workday', 'Snowflake', 'Databricks', 'Grammarly', 'Canva', 'Figma',
  'C3', 'Stanford', 'Harvard', 'MIT', 'Berkeley', 'Oxford', 'Cambridge', 'Princeton', 'Yale',
  'Scale', 'Shield', 'Stability', 'Inflection', 'Character', 'Perplexity', 'Writer', 'Glean', 'Abridge', 'Harvey']);
const ZNACKY_VELKE = new Set([...ZNACKY].map((z) => z.toUpperCase()));
// V nadpisoch má veľké písmeno každé slovo; meno tam prezradí až inštitúcia v súvislom rade slov.
const INSTITUCIE = new Set(['institute', 'institutes', 'office', 'center', 'centre', 'council', 'board', 'initiative', 'lab',
  'labs', 'laboratory', 'laboratories', 'foundation', 'association', 'society', 'corporation', 'corp', 'inc', 'llc', 'ltd',
  'company', 'bureau', 'committee', 'commission', 'force', 'summit', 'alliance', 'consortium', 'coalition', 'partnership',
  'network', 'academy', 'group', 'project', 'program', 'programme', 'plan', 'framework', 'strategy', 'officer', 'officers',
  'studio', 'cloud', 'platform', 'assistant', 'index', 'report', 'order', 'memorandum', 'challenge', 'prize', 'fund', 'hub',
  'service', 'services', 'bill', 'university', 'college', 'school', 'agency', 'department', 'division', 'unit', 'team',
  'directorate', 'corps']);

const jeTitulne = (s) => /^\p{Lu}/u.test(s) && /\p{Ll}/u.test(s) && !jeSkratka(s);
function jeSkratka(s) {
  if (/^\p{Lu}[\p{Lu}\p{N}.&]+$/u.test(s)) return true;
  // DoD, HHSs: krátke slovo s aspoň dvomi veľkými písmenami je skratka, nie meno.
  return s.length <= 5 && (s.match(/\p{Lu}/gu) || []).length >= 2;
}
const jePrivlastnovacie = (s) => /['’]s$/.test(s);

// ── Hľadanie ─────────────────────────────────────────────────────────────────

// Prípony za pojmom: privlastnenie (AI's, AIs'), zložené slovo dopredu (AI-powered) aj dozadu (non-AI).
function dokonciRozsah(text, od, koniec, mnozne) {
  let privlastnenie = false, zlozene = false;
  if (/^['’]s$/.test(text.slice(koniec, koniec + 2)) && !jeSlovny(text[koniec + 2])) {
    koniec += 2; privlastnenie = true;
  } else if (mnozne && /^['’]$/.test(text[koniec] || '') && !jeSlovny(text[koniec + 1])) {
    koniec += 1; privlastnenie = true;
  }
  if (!privlastnenie) {
    const za = /^(?:[-\u{2010}\u{2011}]\p{L}[\p{L}\p{N}]*)+/u.exec(text.slice(koniec, koniec + 80));
    if (za) { koniec += za[0].length; zlozene = true; }
  }
  const pred = /(?:[\p{L}\p{N}]+[-\u{2010}\u{2011}])+$/u.exec(text.slice(Math.max(0, od - 80), od));
  if (pred) { od -= pred[0].length; zlozene = true; }
  return { od, koniec, privlastnenie, zlozene };
}

const velkostSlova = (s) => (s === s.toUpperCase() ? 'SUPER' : /^\p{Lu}/u.test(s) ? 'Super' : 'super');
// Každé AI, A.I. a A.I v rozsahu (AI-to-AI má dve), nie časť slova (OpenAI-AI zmení len druhé).
const nahradSkratky = (s) => s.replace(/A\.I\./g, 'S.I.').replace(/A\.I(?![.\p{L}\p{N}_])/gu, 'S.I')
  .replace(/(^|[^\p{L}\p{N}_])AI(?=s?(?:[^\p{L}\p{N}_]|$))/gu, '$1SI');

function suroveNalezy(text) {
  const surove = [];
  for (const m of text.matchAll(PLNY)) {
    const zaciatok = m.index, koniecTerminu = zaciatok + m[0].length;
    if (jeSlovny(text[zaciatok - 1]) || jeSlovny(text[koniecTerminu])) continue;
    const r = dokonciRozsah(text, zaciatok, koniecTerminu, m[3].length > 12);
    const w1 = m[1], sep = m[2], w2 = m[3];
    const prefix = text.slice(r.od, zaciatok), suffix = text.slice(koniecTerminu, r.koniec);
    const navrh = prefix + velkostSlova(w1) + sep + w2 + suffix;
    let navrhVelke = null;
    if (w1 !== w1.toUpperCase()) {
      const alt = prefix + 'Super' + sep + w2.charAt(0).toUpperCase() + w2.slice(1) + suffix;
      if (alt !== navrh) navrhVelke = alt;
    }
    surove.push({ od: r.od, do: r.koniec, druh: 'plny', navrh, navrhVelke,
      mnozne: m[3].length > 12, privlastnenie: r.privlastnenie, zlozene: r.zlozene });
  }
  for (const m of text.matchAll(SKRATKA)) {
    const i = m.index, bodky = m[0] !== 'AI';
    if (jeSlovny(text[i - 1])) continue;          // OpenAI, GenAI, FAIR, Thai
    if (bodky && text[i - 1] === '.') continue;    // N.A.I.C.S.
    let koniec = i + m[0].length, mnozne = false;
    if (!bodky && text[koniec] === 's' && !jeSlovny(text[koniec + 1])) { koniec += 1; mnozne = true; }
    if (jeSlovny(text[koniec])) continue;          // AIDS, AIM, AIS, AI2, AI_model
    const r = dokonciRozsah(text, i, koniec, mnozne);
    surove.push({ od: r.od, do: r.koniec, druh: bodky ? 'bodky' : 'skratka', navrh: nahradSkratky(text.slice(r.od, r.koniec)),
      navrhVelke: null, mnozne, privlastnenie: r.privlastnenie, zlozene: r.zlozene });
  }
  surove.sort((a, b) => a.od - b.od || b.do - a.do);
  const bezPrekryvu = [];
  for (const s of surove) {
    if (bezPrekryvu.length && s.od < bezPrekryvu[bezPrekryvu.length - 1].do) continue;
    bezPrekryvu.push(s);
  }
  return bezPrekryvu;
}

// ── Okolie nálezu: slová, riadok, citáty, adresy ─────────────────────────────

function tokeny(text) {
  const out = [];
  for (const m of text.matchAll(TOKEN)) out.push({ od: m.index, do: m.index + m[0].length, s: m[0] });
  return out;
}
function prvyOd(t, pos) { // prvý token, ktorý začína na pos alebo za ním
  let lo = 0, hi = t.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (t[mid].od < pos) lo = mid + 1; else hi = mid; }
  return lo;
}
function poslednyDo(t, pos) { // posledný token, ktorý končí na pos alebo pred ním
  let lo = 0, hi = t.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (t[mid].do <= pos) lo = mid + 1; else hi = mid; }
  return lo - 1;
}
// Slová za pozíciou oddelené práve jednou medzerou (v tom istom riadku, bez interpunkcie medzi nimi).
function slovaZa(text, t, pos, max, oddelovac = MEDZERA) {
  const out = [];
  let k = prvyOd(t, pos), pred = pos;
  while (out.length < max && k < t.length && oddelovac.test(text.slice(pred, t[k].od))) {
    out.push(t[k]); pred = t[k].do; k++;
  }
  return out;
}
function slovaPred(text, t, pos, max) { // najbližšie prvé
  const out = [];
  let k = poslednyDo(t, pos), po = pos;
  while (out.length < max && k >= 0 && MEDZERA.test(text.slice(t[k].do, po))) {
    out.push(t[k]); po = t[k].od; k--;
  }
  return out;
}

// Slovo na začiatku vety alebo riadku má veľké písmeno z gramatiky, nie preto, že je meno.
function naZaciatkuVety(text, pos) {
  let i = pos - 1;
  while (i >= 0 && /[ \t\u{a0}\u{202f}"“‘'(\[{«„]/u.test(text[i])) i--;
  if (i < 0) return true;
  const ch = text[i];
  if (ch === '\n' || ch === '\r' || '.!?:;'.includes(ch)) return true;
  if ('•*'.includes(ch) || jeSpojovnik(ch)) { // odrážka zoznamu
    let j = i - 1;
    while (j >= 0 && /[ \t\u{a0}\u{202f}]/u.test(text[j])) j--;
    return j < 0 || text[j] === '\n' || text[j] === '\r';
  }
  return false;
}

const TERMIN_SLOVO = /^(?:A\.I|AIs?|AI['’]s|AIs['’]|artificial|intelligences?)$/i;
// Nadpis v title case alebo riadok veľkými písmenami: veľké písmeno tam o mene nič nehovorí.
export function stylRiadku(riadok) {
  const t = String(riadok).trim();
  if (!t) return 'bezny';
  if (/^#{1,6}\s/.test(t)) return 'nadpis';
  if (!/\p{Ll}/u.test(t) && (t.match(/\p{Lu}/gu) || []).length >= 6) return 'kapitalky';
  if (t.length > 300 || /[.!?;,:]["”’)\]]*$/.test(t)) return 'bezny';
  const slova = (t.match(TOKEN) || []).filter((w) => !TERMIN_SLOVO.test(w));
  if (slova.length > 14) return 'bezny';
  const vyznamne = slova.filter((w) => !SPOJKY.has(w.toLowerCase()) && /\p{L}/u.test(w));
  if (vyznamne.length < 2) return 'bezny';
  const sVelkym = vyznamne.filter((w) => /^\p{Lu}/u.test(w)).length;
  return sVelkym / vyznamne.length >= 0.75 ? 'nadpis' : 'bezny';
}

// Súvislý rad slov s veľkým písmenom (spojky ako „for“ a „of“ rad neprerušia).
function radVelkych(slova) {
  const out = [];
  for (const w of slova) {
    if (SPOJKY.has(w.s)) continue;
    if (/^\p{Lu}/u.test(w.s)) { out.push(w); continue; }
    break;
  }
  return out;
}

// Názov zákona: za pojmom slová s veľkým písmenom alebo spojky a potom Act (Act of 2020 sa počíta tiež).
function jeZakon(text, t, n) {
  for (const w of slovaZa(text, t, n.do, 8, MEDZERA_ALEBO_ZLOM)) {
    const s = w.s.replace(/['’]s$/, ''); // the AI Act's requirements
    if (s === 'Act' || s === 'Acts' || s === 'ACT' || s === 'ACTS') return true;
    if (SPOJKY.has(s) || /^\p{Lu}/u.test(s) || /^\d{4}$/.test(s)) continue;
    return false;
  }
  return false;
}

function jeNazov(text, t, n, styl) {
  const za = slovaZa(text, t, n.do, 4), pred = slovaPred(text, t, n.od, 4);
  const dalsi = za[0], predosly = pred[0];
  // kód alebo číslo dokumentu: AI-102, NIST AI 100-1
  if (jeSpojovnik(text[n.do]) && /\d/.test(text[n.do + 1] || '')) return true;
  if (predosly && jeSkratka(predosly.s) && dalsi && /^\d/.test(dalsi.s)) return true;
  if (styl !== 'bezny') {
    if (predosly && ZNACKY_VELKE.has(predosly.s.toUpperCase())) return true;
    return [...radVelkych(za), ...radVelkych(pred)].some((w) => INSTITUCIE.has(w.s.toLowerCase()));
  }
  if (predosly && ZNACKY.has(predosly.s)) return true;
  if (dalsi && /^\p{Lu}/u.test(dalsi.s) && !STOP_ZA.has(dalsi.s)) return true;
  // Slovo s veľkým písmenom pred pojmom, aj cez najviac dve spojky (Center for AI, Leadership in Artificial Intelligence).
  let k = 0;
  while (k < pred.length && k < 2 && SPOJKY.has(pred[k].s)) k++;
  const w = pred[k];
  return !!w && jeTitulne(w.s) && !STOP_PRED.has(w.s) && !jePrivlastnovacie(w.s) && !naZaciatkuVety(text, w.od);
}

// Úvodzovky po odsekoch: rovné "…" a '…', “…”, ‘…’, „…“ a «…». Neuzavretá úvodzovka sa ignoruje.
// Jednoduché úvodzovky sa od apostrofu líšia polohou: rovná ' otvára len po medzere (alebo na začiatku,
// po zátvorke) a zatvára len pred medzerou alebo interpunkciou; ’ zatvára len pred znakom, ktorý nie je
// písmeno. Apostrof v AI's, AI’s a don't preto citát nikdy neotvorí ani nezavrie.
function oznacCitaty(text, csv) {
  const znacka = new Uint8Array(text.length);
  let rovna = -1, jednoducha = -1, nejaka = false;
  const zasobnik = [];
  const pridaj = (od, koniec) => { for (let k = od + 1; k < koniec - 1; k++) znacka[k] = 1; nejaka = true; };
  // Zatvorí najbližšiu otvorenú úvodzovku daného druhu (aj keď nad ňou visí neuzavretá iná).
  const zatvor = (druhy, i) => {
    for (let k = zasobnik.length - 1; k >= 0; k--) {
      if (!druhy.includes(zasobnik[k].z)) continue;
      pridaj(zasobnik[k].i, i + 1);
      zasobnik.length = k;
      return;
    }
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') {
      let j = i + 1;
      while (j < text.length && (text[j] === ' ' || text[j] === '\t' || text[j] === '\r')) j++;
      if (text[j] === '\n') { rovna = -1; jednoducha = -1; zasobnik.length = 0; }
      continue;
    }
    if (ch === '"') {
      if (csv) continue; // v CSV sú rovné úvodzovky oddeľovače polí, nie citát
      if (rovna < 0) rovna = i; else { pridaj(rovna, i + 1); rovna = -1; }
    } else if (ch === "'") {
      const pred = text[i - 1], za = text[i + 1];
      if (jednoducha < 0) {
        if ((pred === undefined || /[\s(\[{]/.test(pred)) && za !== undefined && !/\s/.test(za)) jednoducha = i;
      } else if (pred !== undefined && !/\s/.test(pred) && (za === undefined || /[\s.,;:!?)\]}"”]/.test(za))) {
        pridaj(jednoducha, i + 1);
        jednoducha = -1;
      }
    } else if (ch === '“') {
      if (zasobnik.length && zasobnik[zasobnik.length - 1].z === '„') zatvor(['„'], i); else zasobnik.push({ z: '“', i });
    } else if (ch === '”') {
      zatvor(['“', '„'], i);
    } else if (ch === '„' || ch === '«' || ch === '‘') {
      zasobnik.push({ z: ch, i });
    } else if (ch === '»') {
      zatvor(['«'], i);
    } else if (ch === '’') {
      if (!jeSlovny(text[i + 1])) zatvor(['‘'], i);
    }
  }
  return nejaka ? znacka : null;
}

// Webová alebo e-mailová adresa vrátane holej domény ako AI.gov. Skúma sa len kus bez medzier okolo
// nálezu (najviac 400 znakov na každú stranu), nie celý text: dlhé slovo bez medzier by inak regex zahltilo.
// Adresy v Markdown ([AI guide](https://agency.gov/AI/guide), [AI.gov](https://ai.gov)) a v zátvorkách sa
// hľadajú v tom istom kuse bez medzier: https:// alebo www. kdekoľvek pred nálezom, text odkazu v tvare domény.
// Holá doména s cestou (canada.ca/en/AI.html) môže mať ľubovoľnú koncovku, bez cesty len známu (AI.gov).
const HRANICA_ADRESY = /[\s<>"“”‘’«»]/u;
const KONCOVKY = 'gov|mil|com|org|net|edu|int|io|ai|eu|us|uk|sk|de|info';
const DOMENA_ZNAMA = new RegExp('^[\\p{L}\\p{N}-]+(?:\\.[\\p{L}\\p{N}-]+)*\\.(?:' + KONCOVKY + ')(?:[/?#]\\S*)?$', 'iu');
const DOMENA_S_CESTOU = /^[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.[a-z]{2,24}[/?#]\S*$/iu;
const DOMENA_LUBOVOLNA = /^[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.[a-z]{2,24}$/iu;
function jeVAdrese(text, n) {
  let a = n.od, b = n.do;
  while (a > 0 && n.od - a < 400 && !HRANICA_ADRESY.test(text[a - 1])) a--;
  while (b < text.length && b - n.do < 400 && !HRANICA_ADRESY.test(text[b])) b++;
  const kus = text.slice(a, b), vKuse = n.od - a, predNalezom = kus.slice(0, vKuse);
  if (/(?:https?:\/\/|www\.)/i.test(predNalezom)) return true;
  const zatvorka = predNalezom.lastIndexOf('[');
  if (zatvorka >= 0) {
    const koniecTextu = kus.indexOf('](', vKuse);
    const textOdkazu = koniecTextu >= 0 ? kus.slice(zatvorka + 1, koniecTextu) : '';
    if (DOMENA_LUBOVOLNA.test(textOdkazu) || DOMENA_S_CESTOU.test(textOdkazu)) return true;
  }
  const cisty = kus.replace(/^[(\[{]+/, '').replace(/[)\]}.,;:!?]+$/, '');
  if (/^[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+$/u.test(cisty)) return true;
  return DOMENA_ZNAMA.test(cisty) || DOMENA_S_CESTOU.test(cisty);
}
// #AI a @AI: hashtag a účet sú identifikátory (e-mail AI@agency.gov je adresa vyššie).
const jeIdentifikator = (text, n) => text[n.od - 1] === '#' || (text[n.od - 1] === '@' && !jeSlovny(text[n.od - 2]));

// Iný význam AI (príkaz Sec. 3(a): SI je len AI ako technológia podľa 15 U.S.C. 9401(3)).
// 1. AI/AN = American Indian and Alaska Native (texty HHS, IHS, CDC, Census): vždy ponechať.
// 2. Text definuje skratku inými slovami s iniciálkami A…I: „avian influenza (AI)“, „Adequate Intake (AI)“,
//    „AI (artificial insemination)“. Potom ostávajú všetky AI v texte a dôvod cituje definíciu.
const AI_AN = /^\/ANs?(?![\p{L}\p{N}_])/u;
const DOVOD_AI_AN = 'Here AI means American Indian (AI/AN).' + PRE_TECHNOLOGIU;
const SLOVO_DEF = "[\\p{L}][\\p{L}'’-]*";
const DEF_PRED = new RegExp('((?:' + SLOVO_DEF + '[ \\t]+){0,3}' + SLOVO_DEF + ')[ \\t]*\\([ \\t]*AIs?[ \\t]*\\)', 'gu');
const DEF_ZA = /(?:^|[^\p{L}\p{N}_])AIs?[ \t]*\([ \t]*([\p{L}][\p{L}'’ \t-]{2,60}?)[ \t]*\)/gu;
const jeTechnologia = (s) => /^artificial[\s-]+intelligences?$/iu.test(s.trim());
function definiciaAI(text) {
  if (!text.includes('AI')) return null;
  for (const m of text.matchAll(DEF_PRED)) {
    const slova = m[1].split(/[ \t]+/);
    if (!/^[Ii]/.test(slova[slova.length - 1])) continue;
    for (let k = slova.length - 2; k >= 0; k--) {
      if (!/^[Aa]/.test(slova[k])) continue;
      const vyraz = slova.slice(k).join(' ');
      if (!jeTechnologia(vyraz)) return vyraz;
      break;
    }
  }
  for (const m of text.matchAll(DEF_ZA)) {
    const vyraz = m[1].trim().replace(/[ \t]+/g, ' '), slova = vyraz.split(' ');
    if (slova.length >= 2 && slova.length <= 4 && /^[Aa]/.test(slova[0]) && /^[Ii]/.test(slova[slova.length - 1]) && !jeTechnologia(vyraz)) return vyraz;
  }
  return null;
}

// Názov skôr vydaného dokumentu (príkaz Sec. 2(b)): pred nálezom v tom istom riadku „Executive Order 14110,“,
// kód memoranda M-25-21, „Memorandum“, „Regulation“ alebo CFR s čiarkou a za ňou až po nález len slová
// s veľkým písmenom a spojky (Safe, Secure, and Trustworthy Development and Use of Artificial Intelligence).
const ZNACKA_DOKUMENTU = /(?:Executive[ \t]+Order[ \t]+(?:No\.[ \t]*)?\d{3,6}|E\.[ \t]?O\.[ \t]*\d{3,6}|\bEO[ \t]*\d{3,6}|\bM-\d{2}-\d{2}\b|\bMemorandum\b(?:[ \t]+(?:No\.[ \t]*)?[A-Z]{0,3}-?\d[\w-]*)?|\bRegulation\b(?:[ \t]*\([A-Z]{2,4}\))?(?:[ \t]*(?:No\.?[ \t]*)?\d{2,4}\/\d{1,4})?|\b\d{1,3}[ \t]+C\.?F\.?R\.?(?:[ \t]+(?:[Pp]art|§)[ \t]*[\d.]+)?)(?:[ \t]+of[ \t]+[A-Z][a-z]+[ \t]+\d{1,2},[ \t]+\d{4})?[ \t]*,[ \t]*/g;
const RAD_TITULU = /^(?:(?:\p{Lu}[\p{L}\p{N}'’&-]*|and|of|for|the|in|on|to|a|an|through|with|by|from|at|into|via|or)(?:,?[ \t]+))*$/u;
function jeTitulDokumentu(text, n) {
  const zaciatokRiadku = n.od > 0 ? text.lastIndexOf('\n', n.od - 1) + 1 : 0;
  const pred = text.slice(Math.max(zaciatokRiadku, n.od - 400), n.od);
  let posledna = null;
  for (const m of pred.matchAll(ZNACKA_DOKUMENTU)) posledna = m;
  if (!posledna) return false;
  const rad = pred.slice(posledna.index + posledna[0].length);
  return /\p{Lu}/u.test(rad) && RAD_TITULU.test(rad);
}

// ── Verejné funkcie ──────────────────────────────────────────────────────────

/**
 * Nájde všetky výskyty a navrhne náhrady.
 * @param {string} text
 * @param {{csv?: boolean}} moznosti csv: rovné úvodzovky nie sú citát (predvolene podľa textu)
 * @returns {{nalezy: Array<object>, siUz: number}}
 */
export function najdi(text, moznosti = {}) {
  text = String(text ?? '');
  const nalezy = suroveNalezy(text);
  if (nalezy.length) {
    const csv = moznosti.csv ?? text.split('","').length > 2;
    const citaty = oznacCitaty(text, csv), t = tokeny(text);
    // Začiatky riadkov raz; štýl riadku sa počíta len pre riadky s nálezom.
    const zaciatky = [0];
    for (let z = text.indexOf('\n'); z >= 0; z = text.indexOf('\n', z + 1)) zaciatky.push(z + 1);
    const styly = new Map();
    const stylPre = (pos) => {
      let lo = 0, hi = zaciatky.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (zaciatky[mid] <= pos) lo = mid + 1; else hi = mid; }
      const k = lo - 1;
      if (!styly.has(k)) styly.set(k, stylRiadku(text.slice(zaciatky[k], k + 1 < zaciatky.length ? zaciatky[k + 1] - 1 : text.length)));
      return styly.get(k);
    };
    const definicia = definiciaAI(text);
    const dovodDefinicie = definicia ? `Your text defines AI as “${definicia}”.` + PRE_TECHNOLOGIU : null;
    // Poradie dôvodov: adresa, hashtag alebo účet, iný význam, zákon, skorší dokument, citát, meno.
    nalezy.forEach((n, i) => {
      n.i = i;
      n.text = text.slice(n.od, n.do);
      const skratka = n.druh !== 'plny';
      let dovod = null;
      if (jeVAdrese(text, n)) n.ponechat = 'odkaz';
      else if (skratka && jeIdentifikator(text, n)) n.ponechat = 'identifikator';
      else if (skratka && AI_AN.test(text.slice(n.do, n.do + 6))) { n.ponechat = 'vyznam'; dovod = DOVOD_AI_AN; }
      else if (skratka && dovodDefinicie) { n.ponechat = 'vyznam'; dovod = dovodDefinicie; }
      else if (jeZakon(text, t, n)) n.ponechat = 'zakon';
      else if (jeTitulDokumentu(text, n)) n.ponechat = 'dokument';
      else if (citaty && citaty[n.od] && citaty[n.do - 1]) n.ponechat = 'citat';
      else if (jeNazov(text, t, n, stylPre(n.od))) n.ponechat = 'nazov';
      else n.ponechat = null;
      n.dovod = n.ponechat ? dovod || DOVODY[n.ponechat] : null;
    });
  }
  return { nalezy: nalezy.map(({ i, od, do: koniec, text: t, druh, navrh, navrhVelke, ponechat, dovod, mnozne, privlastnenie, zlozene }) =>
    ({ i, od, do: koniec, text: t, druh, navrh, navrhVelke, ponechat, dovod, mnozne, privlastnenie, zlozene })), siUz: pocetSI(text) };
}

/** Návrh pre nález. Predvolene tvar z príkazu: „Super Intelligence“ aj za malé „artificial intelligence“
 *  (Biely dom píše termín s veľkými písmenami aj v bežnom texte); velke = false zachová malé písmená. */
export const navrhPre = (n, velke = true) => (velke && n.navrhVelke ? n.navrhVelke : n.navrh);

/** Predvolený stav: mení sa všetko okrem ponechaného na posúdenie. */
export const predvolene = (nalezy) => nalezy.map((n) => !n.ponechat);

export function pocty(nalezy, zapnute) {
  const zmeni = nalezy.reduce((s, _, i) => s + (zapnute[i] ? 1 : 0), 0);
  return { najdene: nalezy.length, zmeni, ponechane: nalezy.length - zmeni };
}

/** Výsledný text: zapnuté nálezy nahradené, ostatné ponechané (velke ako v navrhPre, predvolene áno). */
export function vysledok(text, nalezy, zapnute, { velke = true } = {}) {
  text = String(text ?? '');
  const casti = [];
  let p = 0;
  nalezy.forEach((n, i) => {
    casti.push(text.slice(p, n.od), zapnute[i] ? navrhPre(n, velke) : text.slice(n.od, n.do));
    p = n.do;
  });
  casti.push(text.slice(p));
  return casti.join('');
}

/** Text rozdelený na kúsky bez nálezu a s nálezom, na vykreslenie zvýraznení. */
export function kusy(text, nalezy) {
  const out = [];
  let p = 0;
  for (const n of nalezy) {
    if (n.od > p) out.push({ od: p, do: n.od, n: null });
    out.push({ od: n.od, do: n.do, n });
    p = n.do;
  }
  if (p < text.length) out.push({ od: p, do: text.length, n: null });
  return out;
}

/** Kľúče nálezov na zachovanie voľby pri úprave textu: text nálezu a poradie rovnakých. */
export function kluce(nalezy) {
  const pocet = new Map();
  return nalezy.map((n) => {
    const k = pocet.get(n.text) || 0;
    pocet.set(n.text, k + 1);
    return n.text + '\u{241f}' + k;
  });
}

/** Úryvok okolo nálezu v rámci odseku: celé slová, medzery zlúčené, tri bodky pri skrátení. */
export function okolie(text, n, dosah = 60) {
  let a = Math.max(0, n.od - dosah), b = Math.min(text.length, n.do + dosah);
  const odsekPred = n.od > 0 ? text.lastIndexOf('\n\n', n.od - 1) : -1;
  if (odsekPred >= 0 && odsekPred + 2 > a) a = Math.min(odsekPred + 2, n.od);
  const odsekPo = text.indexOf('\n\n', n.do);
  if (odsekPo >= 0 && odsekPo < b) b = odsekPo;
  if (a > 0 && a < n.od && !/\s/.test(text[a - 1])) {
    const m = text.slice(a, n.od).search(/\s/);
    a = m >= 0 ? a + m + 1 : n.od;
  }
  if (b < text.length && b > n.do && !/\s/.test(text[b])) {
    const m = text.slice(n.do, b).search(/\s\S*$/);
    b = m >= 0 ? n.do + m : n.do;
  }
  const zlep = (s) => s.replace(/\s+/g, ' ');
  const skratenePred = a > 0 && text[a - 1] !== '\n';
  const skratenePo = b < text.length && text[b] !== '\n';
  return {
    pred: (skratenePred ? '…' : '') + zlep(text.slice(a, n.od)).trimStart(),
    jadro: zlep(text.slice(n.od, n.do)),
    po: zlep(text.slice(n.do, b)).trimEnd() + (skratenePo ? '…' : ''),
  };
}

/** Koľkokrát je v texte už teraz samostatné „SI“ (napríklad jednotky SI), pred akoukoľvek zmenou. */
export function pocetSI(text) {
  text = String(text ?? '');
  let n = 0;
  for (const m of text.matchAll(/SI/g)) {
    const i = m.index;
    if (!jeSlovny(text[i - 1]) && text[i - 1] !== '.' && !jeSlovny(text[i + 2])) n++;
  }
  return n;
}

// ── Súbory ───────────────────────────────────────────────────────────────────

export const PRIPONY = Object.freeze(['txt', 'md', 'markdown', 'html', 'htm', 'csv']);
export function pripona(nazov) {
  const m = /\.([a-z0-9]+)$/i.exec(String(nazov || ''));
  return m ? m[1].toLowerCase() : '';
}
export const povolenySubor = (nazov) => PRIPONY.includes(pripona(nazov));
export const jeHtmlSubor = (nazov) => pripona(nazov) === 'html' || pripona(nazov) === 'htm';
/** Meno stiahnutého súboru: report.html na report-SI.txt (znaky, ktoré Windows v mene nedovolí, na spojovník). */
export function nazovVysledku(nazov) {
  const zaklad = String(nazov || '').replace(/\.[^.]*$/, '').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-').replace(/^-+|-+$/g, '').trim();
  return zaklad ? zaklad + '-SI.txt' : 'ai-to-si-result.txt';
}

// HTML na text: kontroluje sa len text bez značiek. Blokové značky sú nové riadky, skripty a štýly preč.
const BLOKOVE = 'address|article|aside|blockquote|body|br|caption|dd|details|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|head|header|hr|html|legend|li|main|nav|ol|p|pre|section|summary|table|tbody|td|tfoot|th|thead|title|tr|ul';
// Značka začína písmenom, lomkou alebo výkričníkom; „a < b“ v texte ostane.
const ZNACKA = /<[a-zA-Z\/!?](?:[^>"']|"[^"]*"|'[^']*')*>/g;
const BLOK = new RegExp('<\\/?(?:' + BLOKOVE + ')\\b(?:[^>"\']|"[^"]*"|\'[^\']*\')*>', 'gi');
const ENTITY = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u{a0}', ensp: '\u{2002}', emsp: '\u{2003}', thinsp: '\u{2009}',
  shy: '\u{ad}', zwnj: '\u{200c}', zwj: '\u{200d}', lsquo: '‘', rsquo: '’', sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„',
  laquo: '«', raquo: '»', hellip: '…', ndash: '\u{2013}', mdash: '\u{2014}', minus: '\u{2212}', middot: '·', bull: '•',
  copy: '©', reg: '®', trade: '™', sect: '§', para: '¶', deg: '°', times: '×', divide: '÷', euro: '€', pound: '£',
  cent: '¢', yen: '¥', iexcl: '¡', iquest: '¿', szlig: 'ß', aelig: 'æ', AElig: 'Æ', oslash: 'ø', Oslash: 'Ø',
  eth: 'ð', ETH: 'Ð', thorn: 'þ', THORN: 'Þ',
};
const DIAKRITIKA = { acute: '\u{301}', grave: '\u{300}', circ: '\u{302}', uml: '\u{308}', tilde: '\u{303}', ring: '\u{30a}', cedil: '\u{327}', caron: '\u{30c}' };
for (const [nazov, pismena] of [['acute', 'aeiouyAEIOUYcnszrlCNSZRL'], ['grave', 'aeiouAEIOU'], ['circ', 'aeiouAEIOU'], ['uml', 'aeiouyAEIOUY'],
  ['tilde', 'anoANO'], ['ring', 'aAuU'], ['cedil', 'cCsS'], ['caron', 'cdenrstzCDENRSTZ']]) {
  for (const p of pismena) ENTITY[p + nazov] ??= (p + DIAKRITIKA[nazov]).normalize('NFC');
}
function dekoduj(s) {
  return s.replace(/&(#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, k) => {
    if (k[0] === '#') {
      const cp = k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : m;
    }
    return Object.prototype.hasOwnProperty.call(ENTITY, k) ? ENTITY[k] : m;
  });
}
export function htmlNaText(html) {
  let s = String(html ?? '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<(script|style|noscript|template|svg|math|iframe|object|textarea|select)\b[\s\S]*?<\/\1\s*>/gi, '');
  s = s.replace(/<!DOCTYPE[^>]*>/gi, '');
  s = s.replace(/\s+/g, ' ');               // prehliadač zlúči medzery a zlomy riadkov v zdroji
  s = s.replace(BLOK, '\n').replace(ZNACKA, '');
  s = dekoduj(s);
  return s.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '').replace(/^ +| +$/g, '');
}
