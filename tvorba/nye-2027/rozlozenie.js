// Text pozvánky: čistenie vstupu a rozloženie, ktoré sa vždy zmestí (ARLing, 19. 10. 2026). Čisté funkcie bez DOM:
// editor meria šírku cez canvas measureText, testy v Node cez metriky písma (ops/video/pozvanka/metriky.json).
// meraj(pismo, text, px) vráti šírku v px bez rozostupu písmen; pismo je 'display', 'italic' alebo 'sans'.

export const POLIA = [
  { id: 'nazov', label: 'Event name or hosts', max: 60, povinne: true, ukazka: 'Anna and Tom’s New Year’s Eve Party' },
  { id: 'datum', label: 'Date', max: 40, povinne: true, ukazka: 'Thursday, December 31, 2026' },
  { id: 'cas', label: 'Time', max: 30, povinne: true, ukazka: '8 PM until late' },
  { id: 'miesto', label: 'Place', max: 60, povinne: true, ukazka: '12 Rose Street, Bratislava' },
  { id: 'riadok', label: 'Extra line', max: 60, povinne: false, ukazka: 'Black tie · RSVP to Anna by December 20' },
];
export const HAK = 'You’re invited';
export const ROK = '2027';

const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}\u{E0020}-\u{E007F}]/gu;
const RIADIACE = /[\u{0}-\u{1f}\u{7f}-\u{9f}\u{200b}-\u{200f}\u{2028}-\u{202e}\u{2060}-\u{206f}\u{feff}]/gu;

/**
 * Očistí jedno pole: emoji a riadiace znaky preč, rovné apostrofy a úvodzovky na typografické, medzery stlačené,
 * najviac `max` znakov. `znaky` je reťazec znakov, ktoré naše písma majú: znak mimo neho sa nahradí základným
 * písmenom (ŵ na w), ak ho písmo má, inak ostane a vráti sa v `mimo` (prehliadač ho nakreslí náhradným písmom).
 * Vráti { text, emoji (počet odstránených), nahradene [znaky], mimo [znaky], skratene (bool) }.
 */
export function cistiText(vstup, znaky = null, max = 60) {
  let s = String(vstup ?? '').normalize('NFC');
  const emoji = (s.match(EMOJI) || []).length;
  s = s.replace(EMOJI, '').replace(RIADIACE, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  // typografia: ' na ’, "x" na “x”
  s = s.replace(/'/g, '’');
  let otvorena = false;
  s = s.replace(/"/g, () => ((otvorena = !otvorena) ? '“' : '”'));
  const nahradene = [], mimo = [];
  if (znaky) {
    let o = '';
    for (const ch of s) {
      if (ch === ' ' || znaky.includes(ch)) { o += ch; continue; }
      // rumunské ș a ț s čiarkou: písma majú tvar so sedličkou (ş, ţ), ktorý sa tak aj píše (brána 1)
      const rum = { 'ș': 'ş', 'Ș': 'Ş', 'ț': 'ţ', 'Ț': 'Ţ' }[ch];
      if (rum && znaky.includes(rum)) { o += rum; nahradene.push(ch); continue; }
      const z = ch.normalize('NFD').replace(/\p{M}/gu, '');
      if (z && [...z].every((q) => znaky.includes(q))) { o += z; nahradene.push(ch); continue; }
      o += ch; mimo.push(ch);
    }
    s = o;
  }
  const pole = [...s];
  const skratene = pole.length > max;
  if (skratene) s = pole.slice(0, max).join('').trimEnd();
  return { text: s, emoji, nahradene: [...new Set(nahradene)], mimo: [...new Set(mimo)], skratene };
}

/** Veľké písmená pre riadky v kapitálkach (ß na SS); znak, ktorý by vo veľkej podobe písmo nemalo, ostane malý. */
export function velke(s, znaky = null) {
  let o = '';
  for (const ch of s) {
    const u = ch.toLocaleUpperCase('en');
    o += !znaky || [...u].every((q) => q === ' ' || znaky.includes(q)) ? u : ch;
  }
  return o;
}

/** Šírka textu s rozostupom písmen ls (v em) medzi znakmi. */
export function sirkaTextu(meraj, pismo, text, px, ls = 0) {
  const n = [...text].length;
  return meraj(pismo, text, px) + (n > 1 ? ls * px * (n - 1) : 0);
}

/** Lakomé zalomenie slov do riadkov šírky `sirka`; slovo dlhšie než riadok vráti null (alebo ho rozlomí, ak lamat). */
export function zalom(slova, sirka, w, lamat = false) {
  const riadky = [];
  let r = '';
  for (let slovo of slova) {
    if (w(slovo) > sirka) {
      if (!lamat) return null;
      // rozlomiť dlhé slovo po znakoch
      if (r) { riadky.push(r); r = ''; }
      let kus = '';
      for (const ch of slovo) {
        if (kus && w(kus + ch) > sirka) { riadky.push(kus); kus = ''; }
        kus += ch;
      }
      r = kus;
      continue;
    }
    const skus = r ? r + ' ' + slovo : slovo;
    if (w(skus) <= sirka) r = skus;
    else { riadky.push(r); r = slovo; }
  }
  if (r) riadky.push(r);
  return riadky;
}

/** Rovnaký počet riadkov, ale vyvážené dĺžky (najmenšia najširšia čiara); len pre bloky do 3 riadkov. */
export function vyvaz(slova, n, w) {
  if (n <= 1 || slova.length <= n) return null;
  const spoj = (a, b) => slova.slice(a, b).join(' ');
  let naj = null, najW = Infinity;
  const skus = (zlomy) => {
    const hr = [0, ...zlomy, slova.length];
    const riadky = [];
    for (let i = 0; i < hr.length - 1; i++) riadky.push(spoj(hr[i], hr[i + 1]));
    const m = Math.max(...riadky.map(w));
    if (m < najW - 0.01) { najW = m; naj = riadky; }
  };
  if (n === 2) for (let a = 1; a < slova.length; a++) skus([a]);
  else if (n === 3) for (let a = 1; a < slova.length - 1; a++) for (let b = a + 1; b < slova.length; b++) skus([a, b]);
  else return null;
  return { riadky: naj, sirka: najW };
}

// Kde riadok nemá končiť: slabé slová (spojky, predložky, členy) a dvojice, ktoré patria k sebe (New Year, Year's Eve).
const SLABE = new Set(['a', 'an', 'the', 'and', '&', 'of', 'at', 'to', 'for', 'with', 'in', 'on', 'by', 'from', 'our', 'your', 'my', 'new',
  'mr', 'mrs', 'ms', 'dr', 'st', 'und', 'der', 'die', 'das', 'im', 'am', 'zum', 'zur', 'et', 'de', 'la', 'le', 'du', 'y', 'el', 'di',
  'v', 'na', 's', 'so', 'z', 'zo', 'k', 'do', 'u', 'o', 'pre', 've', 'ke', 'ze', 'i', 'po', 'pri', 'od', 'za']);
const SPOLU = new Set(['new year', 'new years', 'year eve', 'years eve', 'christmas eve', 'christmas party', 'black tie']);
const tvar = (x) => x.toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}&]/gu, '');

/** Trest za zlom medzi slovami a a b (0 = dobrý zlom). */
export function trestZlomu(a, b) {
  const x = tvar(a), y = tvar(b);
  let t = 0;
  if (SLABE.has(x)) t += 0.35;
  if (SPOLU.has(x + ' ' + y)) t += 0.5;
  if (/^\d+[.,]?$/.test(a) && /^\p{L}/u.test(b)) t += 0.2; // 12 | Rose Street, 8 | PM
  return t;
}

/** Zlom radšej pri oddeľovači: pri „·“ (bodka uprostred) a za čiarkou, ak ich text má (Hlavná, 455 nie). */
export function trestOddelovaca(slova, i) {
  const pred = slova[i - 1] || '', po = slova[i] || '';
  if (slova.includes('·')) return pred === '·' || po === '·' ? 0 : 0.12;
  if (slova.some((x, k) => k < slova.length - 1 && /,$/.test(x))) return /,$/.test(pred) ? 0 : 0.08;
  return 0;
}
/** Bodka uprostred na začiatku alebo konci riadku sa nekreslí. */
export const bezBodkyNaKraji = (r) => r.replace(/^·\s+/, '').replace(/\s+·$/, '');

/**
 * Najlepšie rozdelenie slov do n riadkov šírky sirka: najmenší trest za zlomy (a osamotené krátke slovo na konci),
 * pri rovnakom treste najužší najširší riadok (vyvážený stĺpec). null, ak sa nedá.
 */
export function najlepsieZalomenie(slova, n, w, sirka) {
  if (n === 1) { const m = w(slova.join(' ')); return m <= sirka ? { riadky: [slova.join(' ')], trest: 0, max: m } : null; }
  if (slova.length < n) return null;
  let naj = null;
  const skus = (zlomy) => {
    const hr = [0, ...zlomy, slova.length];
    const riadky = [], sirky = [];
    let trest = 0;
    for (let i = 0; i < hr.length - 1; i++) {
      const r = slova.slice(hr[i], hr[i + 1]).join(' ');
      const s = w(r);
      if (s > sirka) return;
      riadky.push(r); sirky.push(s);
      if (i > 0) trest += trestZlomu(slova[hr[i] - 1], slova[hr[i]]) + trestOddelovaca(slova, hr[i]);
    }
    const posl = slova.slice(hr[hr.length - 2]);
    if (posl.length === 1 && [...posl[0]].length <= 6 && sirky[sirky.length - 1] * 2.4 < Math.max(...sirky)) trest += 0.15;
    const max = Math.max(...sirky);
    if (!naj || trest < naj.trest - 1e-9 || (Math.abs(trest - naj.trest) < 1e-9 && max < naj.max - 0.01)) naj = { riadky, trest, max };
  };
  if (n === 2) for (let i = 1; i < slova.length; i++) skus([i]);
  else if (n === 3) for (let i = 1; i < slova.length - 1; i++) for (let j = i + 1; j < slova.length; j++) skus([i, j]);
  else return null;
  return naj;
}

/**
 * Najväčšie písmo od `max` po `min` (krok 1 px), pri ktorom sa text zmestí do `riadkov` riadkov šírky `sirka`;
 * keď by najväčšie písmo zlomilo riadok zle (New | Year), skúsi až o 15 % menšie písmo s dobrým zlomom. Keď sa text
 * nezmestí ani pri `min`, slová sa rozlomia; keď ani tak, písmo klesá pod min (najviac na 40 % max), takže výsledok
 * sa zmestí vždy. Vráti { px, riadky, sirky, ok (px >= min a bez lámania), lamane, trest }.
 */
export function rozlozBlok(text, { meraj, pismo, sirka, max, min, riadkov = 1, ls = 0 }) {
  const slova = String(text).split(' ').filter(Boolean);
  if (!slova.length) return { px: max, riadky: [], sirky: [], ok: true, lamane: false, trest: 0 };
  const hotovo = (px, riadky0, lamane, trest = 0) => {
    const riadky = riadky0.map(bezBodkyNaKraji);
    const w = (s) => sirkaTextu(meraj, pismo, s, px, ls);
    return { px, riadky, sirky: riadky.map(w), ok: px >= min && !lamane, lamane, trest };
  };
  let prvy = null;
  for (let px = max; px >= min; px -= 1) {
    const w = (s) => sirkaTextu(meraj, pismo, s, px, ls);
    let k = null;
    if (slova.length <= 30) {
      for (let n = 1; n <= Math.min(riadkov, 3); n++) {
        const z = najlepsieZalomenie(slova, n, w, sirka);
        if (z && (!k || z.trest < k.trest - 1e-9)) k = z;
        if (k && k.trest === 0) break;
      }
    } else {
      const r = zalom(slova, sirka, w);
      if (r && r.length <= riadkov) k = { riadky: r, trest: 0 };
    }
    if (!k) continue;
    if (!prvy) prvy = { px, ...k };
    if (k.trest === 0) return hotovo(px, k.riadky, false);
    if (px < prvy.px * 0.85) break;
  }
  if (prvy) return hotovo(prvy.px, prvy.riadky, false, prvy.trest);
  const dno = Math.max(8, Math.floor(max * 0.4));
  for (let px = min; px >= dno; px -= 1) {
    const r = zalom(slova, sirka, (s) => sirkaTextu(meraj, pismo, s, px, ls), true);
    if (r.length <= riadkov) return hotovo(px, r, true);
  }
  // posledná poistka: jeden riadok v takej veľkosti, aby sa zmestil
  const cely = slova.join(' ');
  const w1 = sirkaTextu(meraj, pismo, cely, 100, ls);
  const px = Math.max(1, Math.floor((100 * sirka) / w1));
  return { px, riadky: [cely], sirky: [sirkaTextu(meraj, pismo, cely, px, ls)], ok: false, lamane: true, trest: 0 };
}

// ---------------------------------------------------------------------------------------------
// Kompozícia v dvoch formátoch (návrhové px; scéna ich mapuje na skutočné rozlíšenie plátna)

/**
 * zona: kam smie text (9:16 bez horných 13 % a dolných 22 % pre lišty Stories, WhatsApp a Shorts, bočný okraj 10 %).
 * Bloky zhora nadol; medzera je v px pred blokom. velkyHak a velkyRok sú polohy na začiatku filmu (stred).
 */
export const FORMATY = {
  '9x16': {
    W: 1080, H: 1920, zona: { x0: 108, x1: 972, y0: 250, y1: 1500 }, sirka: 864,
    velkyHak: { px: 118, y: 860 }, velkyRok: { px: 380, y: 880 },
    hak: { max: 64, min: 50 }, rok: { px: 236 }, ciara: { sirka: 300, vyska: 22 },
    nazov: { max: 104, min: 58, riadkov: 3, lh: 1.08 },
    detail: { max: 44, min: 34, ls: 0.14, lh: 1.36 },
    riadok: { max: 50, min: 38, riadkov: 2, lh: 1.24 },
    medzery: { rok: 6, ciara: 34, nazov: 40, detaily: 46, riadok: 40, medziDetailmi: 6 },
  },
  '16x9': {
    W: 1920, H: 1080, zona: { x0: 134, x1: 1786, y0: 76, y1: 1004 }, sirka: 1320,
    velkyHak: { px: 104, y: 520 }, velkyRok: { px: 400, y: 540 },
    hak: { max: 54, min: 42 }, rok: { px: 176 }, ciara: { sirka: 280, vyska: 20 },
    nazov: { max: 84, min: 50, riadkov: 2, lh: 1.08 },
    detail: { max: 36, min: 28, ls: 0.14, lh: 1.34 },
    riadok: { max: 40, min: 30, riadkov: 2, lh: 1.24 },
    medzery: { rok: 2, ciara: 22, nazov: 26, detaily: 30, riadok: 26, medziDetailmi: 4 },
  },
};

/** Výška riadku písma `pismo` (návrh: display a italic 1.0 em, sans podľa lh). */
const vyskaBloku = (b) => b.riadky.length * b.px * b.lh;

/**
 * Rozloží celú pozvánku pre formát. polia: { nazov, datum, cas, miesto, riadok } už očistené (cistiText) a pre
 * kapitálky prevedené volajúcim cez velke(). Vráti { W, H, zona, bloky: [{ id, pismo, px, lh, ls, riadky, sirky,
 * y (horný okraj), vyska }], velkyHak, velkyRok, ok, mierka }, pričom celý stĺpec sa vždy zmestí do zóny.
 */
export function kompozicia(polia, formatId, meraj) {
  const F = FORMATY[formatId];
  if (!F) throw new Error('neznámy formát ' + formatId);
  const M = F.medzery;
  let mierka = 1, vysledok = null;
  for (let pokus = 0; pokus < 30; pokus++) {
    const sk = (x) => Math.max(10, Math.round(x * mierka));
    const bloky = [];
    let ok = true;
    const pridaj = (id, pismo, txt, o, lh, ls = 0, medzera = 0) => {
      const r = rozlozBlok(txt, { meraj, pismo, sirka: F.sirka, max: sk(o.max), min: Math.min(sk(o.min), sk(o.max)), riadkov: o.riadkov || 1, ls });
      if (!r.ok) ok = false;
      bloky.push({ id, pismo, px: r.px, lh, ls, riadky: r.riadky, sirky: r.sirky, medzera: Math.round(medzera * mierka) });
      return r;
    };
    pridaj('hak', 'italic', HAK, F.hak, 1.2);
    const rokPx = sk(F.rok.px);
    bloky.push({ id: 'rok', pismo: 'display', px: rokPx, lh: 0.82, ls: 0, riadky: [ROK], sirky: [sirkaTextu(meraj, 'display', ROK, rokPx)], medzera: Math.round(M.rok * mierka) });
    bloky.push({ id: 'ciara', pismo: null, px: sk(F.ciara.vyska), lh: 1, ls: 0, riadky: [], sirky: [sk(F.ciara.sirka)], medzera: Math.round(M.ciara * mierka), vyskaPevna: sk(F.ciara.vyska) });
    pridaj('nazov', 'display', polia.nazov || '', F.nazov, F.nazov.lh, 0, M.nazov);
    // dátum, čas a miesto v jednej veľkosti (najmenšia z troch), miesto smie mať 2 riadky
    const det = { ...F.detail };
    const pDat = rozlozBlok(polia.datum || '', { meraj, pismo: 'sans', sirka: F.sirka, max: sk(det.max), min: sk(det.min), riadkov: 2, ls: det.ls });
    const pCas = rozlozBlok(polia.cas || '', { meraj, pismo: 'sans', sirka: F.sirka, max: sk(det.max), min: sk(det.min), riadkov: 1, ls: det.ls });
    const pMie = rozlozBlok(polia.miesto || '', { meraj, pismo: 'sans', sirka: F.sirka, max: sk(det.max), min: sk(det.min), riadkov: 2, ls: det.ls });
    const pxDet = Math.min(pDat.px, pCas.px, pMie.px);
    const znova = (txt, riadkov) => rozlozBlok(txt, { meraj, pismo: 'sans', sirka: F.sirka, max: pxDet, min: Math.min(pxDet, sk(det.min)), riadkov, ls: det.ls });
    const dDat = znova(polia.datum || '', 2), dCas = znova(polia.cas || '', 1), dMie = znova(polia.miesto || '', 2);
    if (![dDat, dCas, dMie].every((r) => r.ok)) ok = false;
    bloky.push({ id: 'datum', pismo: 'sans', px: dDat.px, lh: det.lh, ls: det.ls, riadky: dDat.riadky, sirky: dDat.sirky, medzera: Math.round(M.detaily * mierka) });
    bloky.push({ id: 'cas', pismo: 'sans', px: dCas.px, lh: det.lh, ls: det.ls, riadky: dCas.riadky, sirky: dCas.sirky, medzera: Math.round(M.medziDetailmi * mierka) });
    bloky.push({ id: 'miesto', pismo: 'sans', px: dMie.px, lh: det.lh, ls: det.ls, riadky: dMie.riadky, sirky: dMie.sirky, medzera: Math.round(M.medziDetailmi * mierka) });
    if (polia.riadok) pridaj('riadok', 'italic', polia.riadok, F.riadok, F.riadok.lh, 0, M.riadok);
    // zvislé poskladanie a vycentrovanie v zóne (opticky trochu nad stredom: 46 %)
    let y = 0;
    for (const b of bloky) {
      b.vyska = b.vyskaPevna || vyskaBloku(b);
      y += b.medzera; b.y = y; y += b.vyska;
    }
    const spolu = y, vyskaZony = F.zona.y1 - F.zona.y0;
    if (spolu <= vyskaZony || mierka <= 0.5) {
      const posun = F.zona.y0 + Math.max(0, (vyskaZony - spolu) * 0.46);
      for (const b of bloky) b.y = Math.round(b.y + posun);
      const nadZonou = spolu > vyskaZony;
      vysledok = { W: F.W, H: F.H, zona: F.zona, sirka: F.sirka, bloky, ok: ok && !nadZonou, mierka: +mierka.toFixed(3), velkyHak: F.velkyHak, velkyRok: F.velkyRok, vyskaStlpca: spolu };
      break;
    }
    mierka *= 0.95;
  }
  return vysledok;
}

/** Poistka po rozložení: každý riadok je v zóne (šírka) a celý stĺpec medzi y0 a y1. */
export function kontrolaKompozicie(k) {
  const chyby = [];
  for (const b of k.bloky) {
    b.sirky.forEach((s, i) => { if (s > k.sirka + 0.5) chyby.push(`${b.id} riadok ${i + 1}: ${Math.round(s)} px > ${k.sirka}`); });
    if (b.y < k.zona.y0 - 0.5) chyby.push(`${b.id} nad zónou`);
    if (b.y + b.vyska > k.zona.y1 + 0.5) chyby.push(`${b.id} pod zónou`);
  }
  return chyby;
}
