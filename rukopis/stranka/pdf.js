// Rukopis 1.4 (30. 9. 2026): PDF správa namiesto HTML. Andrej: „krásne PDF, presne s info aj s komentármi,
// čo je zlé, ako keby prepis celého textu“. PDF skladá prehliadač knižnicou jsPDF (stranka/vendor, MIT)
// s vloženým písmom ARLing Sans (Schibsted Grotesk, OFL). Text neopúšťa prehliadač. Modul nepoužíva DOM,
// test ho spúšťa aj v Node. Rozloženie: titulná časť, súhrn nálezov, graf dĺžky viet, prepis celého textu
// so zvýraznením a číslovanými komentármi na pravom okraji (ako recenzia vo Worde), päta so stranou.
import { kusky } from './zvyraznenia.js?v=1.4';
import { nalezy, meraniaTypov, doplnit, tvar, ukazka, rytmusData, histogram, KOSE } from './zobrazenie.js?v=1.4';
import { normalizuj, priprav, slova, DOVODY } from '../jadro/delenie.js?v=1.4';
import { JAZYKY } from '../jadro/meranie.js?v=1.4';
import { jazyky } from './texty.js?v=1.4';

// A4 v bodoch. Farby z papierového systému arling.sk (ops/design/paper/paper.css), pri tlači biele pozadie.
const S = 595.28, V = 841.89, OKRAJ = { l: 50, r: 50, h: 54, d: 66 };
const OBSAH_S = S - OKRAJ.l - OKRAJ.r;
const F = { ink: '#141413', body: '#3d3d3a', muted: '#5e5d59', line: '#e4e2d8', paper: '#faf9f5', deep: '#f0eee6', accent: '#b23a1d' };
// v1.4 po bráne 1: rovnaké farby ako čipy na webe (rukopis.css, svetlý režim): --accent, --ok, --accent-light, --body;
// pointa a pásmo zmiešaný = color-mix(in oklch, --ok 45 %, --accent) prepočítané do sRGB.
export const FARBY_TYPOV = { fraza: '#b23a1d', pointa: '#885b00', trojica: '#4a6b3f', nominalizacia: '#d0603c', pomlcka: '#3d3d3a' };
const FARBY_PASIEM = { zivy: '#4a6b3f', zmiesany: '#885b00', prilis_uhladeny: '#b23a1d' };
const PROBLEMY = Object.keys(FARBY_TYPOV);
const TAZKA_VETA = 3; // od troch RÔZNYCH podstatných mien namiesto slovies v jednej vete dostane veta komentár
// v1.4 po bráne 1: rovnaký základ slova (organizácia, organizácie; unemployment, unemployment) sa ráta raz.
// Dve slová majú rovnaký základ, keď sa zhodujú aspoň v KMEN znakoch a líšia sa najviac poslednými 3 znakmi kratšieho.
export function rovnakyZaklad(a, b, kmen = 5) {
  a = a.toLowerCase(); b = b.toLowerCase();
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  return a === b || (p >= kmen && p >= Math.min(a.length, b.length) - 3);
}
export function rozneZaklady(slova, kmen = 5) {
  const out = [];
  for (const w of slova) if (!out.some(x => rovnakyZaklad(x, w, kmen))) out.push(w);
  return out;
}
// v1.4 po bráne 1: trojica dostane v PDF komentár, len keď je stredný člen krátky (bez členov najviac 3 slová,
// v angličtine a nemčine 2). Dlhé „členy“ sú často vsuvka alebo začiatok vety, nie vymenovanie.
const CLENY = /^(?:the|a|an|der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines)$/iu;
export const STRED_TROJICE = { sk: 3, cs: 3, en: 2, de: 2 };
export function kratkaTrojica(text, jazyk) {
  const i = text.indexOf(',');
  if (i < 0) return true;
  const zvysok = text.slice(i + 1);
  const sp = zvysok.search(new RegExp('\\s(?:' + JAZYKY[jazyk].SPOJKY + ')\\s', 'u'));
  const stred = (sp < 0 ? zvysok : zvysok.slice(0, sp)).replace(/,\s*$/u, '');
  // Stredný „člen“, ktorý začína vzťažným zámenom (die als…, which…), je vedľajšia veta, nie položka zoznamu.
  if (JAZYKY[jazyk].VZTAZNE.test(',' + stred)) return false;
  const slov = slova(stred).filter(w => !CLENY.test(w.text)).length;
  return slov <= STRED_TROJICE[jazyk];
}
// Prepis: textový stĺpec vľavo, komentáre vpravo.
const TEXT_S = 318, MEDZERA_STLPCOV = 18, KOMENTAR_X = OKRAJ.l + TEXT_S + MEDZERA_STLPCOV, KOMENTAR_S = S - OKRAJ.r - KOMENTAR_X;
const TEXT_PISMO = 9.8, TEXT_RIADOK = 14.6, KOM_PISMO = 7.6, KOM_RIADOK = 9.6;

const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const tonom = (h, a) => rgb(h).map(c => Math.round(255 - (255 - c) * a));
const odesc = s => s.replace(/&(amp|lt|gt|quot|#39);/g, (m, k) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[k]);
const cislo = (n, jazyk, d = 0) => new Intl.NumberFormat(jazyk, { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
const uvodzovky = j => j === 'en' ? ['“', '”'] : ['„', '“'];
// Náhrady pre znaky, ktoré písmo nemá (vzorce z PDF). Emoji a riadiace znaky vynecháme, ostatné nahradí otáznik.
const ZNAKY = { '√': 'sqrt', '≤': '<=', '≥': '>=', '≈': '~', '≠': '!=', '∞': 'inf', '∑': 'sum', 'Δ': 'delta', '∆': 'delta', 'π': 'pi', '∈': 'in', '⇒': '=>' };

export function spravaPdf(jsPDF, pisma, r, t, original, datum) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true, putOnlyUsedFonts: true });
  doc.addFileToVFS('ARLingSans-400.ttf', pisma.regular);
  doc.addFont('ARLingSans-400.ttf', 'ARLingSans', 'normal');
  doc.addFileToVFS('ARLingSans-600.ttf', pisma.bold);
  doc.addFont('ARLingSans-600.ttf', 'ARLingSans', 'bold');
  doc.setFont('ARLingSans', 'normal');
  doc.setProperties({ title: t.reportTitle, subject: t.reportIntro, author: 'Rukopis', creator: 'Rukopis ' + r.verzia + ', ARLing s. r. o., arling.sk/rukopis' });
  try { doc.setLanguage?.(r.jazyk === 'cs' ? 'cs' : r.jazyk); } catch { /* jazyk dokumentu je len doplnok */ }
  const j = r.jazyk, [uv1, uv2] = uvodzovky(j);

  // Znaky mimo písma (emoji, azbuka, matematické symboly) nahradíme, aby PDF nemalo prázdne štvorčeky.
  const cmap = doc.getFont().metadata?.cmap?.unicode?.codeMap;
  const nahrady = new Map();
  // v1.4 po bráne 1: slovo so znakmi, ktoré písmo nemá a nedajú sa nahradiť (fonetický prepis, azbuka, grécke
  // písmená), sa v PDF nahradí tromi bodkami, nie otáznikmi. Pod prepisom je o tom poznámka. Meria sa pôvodný text.
  const CHYBA = '\u0000';
  let chybaZnakov = false;
  const cisty = s => {
    if (!cmap) return s;
    let o = '', chyba = false;
    for (const ch of s) {
      const c = ch.codePointAt(0);
      if (cmap[c] || c === 32) { o += ch; continue; }
      let z = nahrady.get(ch);
      if (z === undefined) {
        const zaklad = ch.normalize('NFD').replace(/\p{M}/gu, '');
        const moze = s => s && [...s].every(x => cmap[x.codePointAt(0)]);
        z = /\p{Cf}|\p{Extended_Pictographic}/u.test(ch) ? '' : /\s/u.test(ch) ? ' ' : moze(ZNAKY[ch]) ? ZNAKY[ch] : moze(zaklad) ? zaklad : CHYBA;
        nahrady.set(ch, z);
      }
      if (z === CHYBA) chyba = true;
      o += z;
    }
    if (!chyba) return o;
    chybaZnakov = true;
    return o.replace(/\S*\u0000\S*/gu, '…');
  };
  const pismo = (vaha, velkost, farba = F.ink) => { doc.setFont('ARLingSans', vaha); doc.setFontSize(velkost); doc.setTextColor(...rgb(farba)); };
  const sirky = new Map();
  const sirka = s => {
    const k = doc.getFont().fontStyle + doc.getFontSize() + '|' + s;
    let w = sirky.get(k);
    if (w === undefined) { w = doc.getTextWidth(s); sirky.set(k, w); }
    return w;
  };
  const vypln = h => doc.setFillColor(...(typeof h === 'string' ? rgb(h) : h));
  const ciara = (h, hrubka) => { doc.setDrawColor(...(typeof h === 'string' ? rgb(h) : h)); doc.setLineWidth(hrubka); };
  // Zalomenie na celé slová; prvý riadok môže byť užší (tučný úvod „Čo s tým:“).
  const zalom = (text, max, prvy = max) => {
    const out = [];
    let riadok = '', limit = prvy;
    for (const slovo of cisty(text).split(/\s+/).filter(Boolean)) {
      const skusit = riadok ? riadok + ' ' + slovo : slovo;
      if (riadok && sirka(skusit) > limit) { out.push(riadok); riadok = slovo; limit = max; }
      else riadok = skusit;
    }
    if (riadok) out.push(riadok);
    return out;
  };
  const skrat = (text, max) => {
    let s = cisty(text);
    if (sirka(s) <= max) return s;
    while (s.length > 1 && sirka(s + '…') > max) s = s.slice(0, -1);
    return s.trimEnd() + '…';
  };

  let y = 0;
  const hlavicka = () => {
    pismo('bold', 8.5, F.ink); doc.text('Rukopis', OKRAJ.l, 34);
    pismo('normal', 8.5, F.muted); doc.text(cisty(t.reportTitle + ' · ' + datum), S - OKRAJ.r, 34, { align: 'right' });
    ciara(F.line, .6); doc.line(OKRAJ.l, 42, S - OKRAJ.r, 42);
  };
  const novaStrana = () => { doc.addPage('a4', 'portrait'); hlavicka(); y = OKRAJ.h + 10; };
  const miesto = h => { if (y + h > V - OKRAJ.d) novaStrana(); };
  const odsek = (text, velkost, farba, vaha = 'normal', x = OKRAJ.l, max = OBSAH_S, riadok = velkost * 1.45) => {
    pismo(vaha, velkost, farba);
    for (const l of zalom(text, max)) { miesto(riadok); doc.text(l, x, y + velkost); y += riadok; }
  };

  // 1. Titulná časť: názov, dátum, verzia, jazyk, počty, veľké číslo s pásmom a vysvetlením.
  pismo('bold', 11, F.ink); doc.text('Rukopis', OKRAJ.l, 40);
  pismo('normal', 8.5, F.muted); doc.text('arling.sk/rukopis', S - OKRAJ.r, 40, { align: 'right' });
  ciara(F.line, .6); doc.line(OKRAJ.l, 50, S - OKRAJ.r, 50);
  y = 66;
  pismo('bold', 26, F.ink); doc.text(cisty(t.reportTitle), OKRAJ.l, y + 24); y += 38;
  const meta = [t.reportDate + ': ' + datum, t.pdfVersion + ' ' + r.verzia, t.pdfLanguage + ': ' + jazyky[j],
    cislo(r.slov, j) + ' ' + tvar(r.slov, j, t.wordForms), cislo(r.viet, j) + ' ' + tvar(r.viet, j, t.sentenceForms)].join(' · ');
  odsek(meta, 9.5, F.muted);
  y += 14;

  const pasmo = r.pasmo, farbaPasma = FARBY_PASIEM[pasmo], pasma = ['zivy', 'zmiesany', 'prilis_uhladeny'];
  const vnutro = OBSAH_S - 40;
  pismo('bold', 10.5, F.ink); const vyznam = zalom(t.meaning, vnutro);
  pismo('normal', 9.5, F.body); const uvod = zalom(t.reportIntro, vnutro);
  pismo('normal', 8.5, F.muted); const kalib = zalom(t.calibration + (r.ciastocny ? ' ' + t.partial + '.' : ''), vnutro);
  const vyskaKarty = 20 + 12 + 72 + 38 + vyznam.length * 15 + 4 + uvod.length * 13.5 + 4 + kalib.length * 12 + 12;
  vypln(F.paper); ciara(F.line, .7); doc.roundedRect(OKRAJ.l, y, OBSAH_S, vyskaKarty, 8, 8, 'FD');
  let ky = y + 20;
  const kx = OKRAJ.l + 20;
  pismo('normal', 9, F.muted); doc.text(cisty(t.index), kx, ky + 8); ky += 12;
  pismo('bold', 56, F.ink); doc.text(String(r.index), kx, ky + 50);
  const wCislo = sirka(String(r.index));
  pismo('normal', 14, F.muted); doc.text('/ 100', kx + wCislo + 6, ky + 50);
  const px = kx + wCislo + 6 + sirka('/ 100') + 22;
  pismo('bold', 10.5, farbaPasma);
  const nazovPasma = cisty(t.bands[pasma.indexOf(pasmo)]);
  const wPasmo = sirka(nazovPasma) + 30;
  vypln(tonom(farbaPasma, .12)); ciara(farbaPasma, .8); doc.roundedRect(px, ky + 26, wPasmo, 24, 12, 12, 'FD');
  vypln(farbaPasma); doc.circle(px + 12, ky + 38, 3, 'F');
  doc.text(nazovPasma, px + 21, ky + 41.5);
  if (r.ciastocny) { pismo('normal', 8.5, F.muted); doc.text(cisty(t.partial), px, ky + 62); }
  ky += 72;
  // Stupnica 0 až 100 s tromi pásmami a značkou.
  const sirkyPasiem = [35, 30, 35].map(p => p / 100 * vnutro);
  let sx = kx;
  pasma.forEach((p, i) => {
    vypln(tonom(FARBY_PASIEM[p], p === pasmo ? .9 : .35)); doc.roundedRect(sx, ky, sirkyPasiem[i] - 2, 7, 3.5, 3.5, 'F');
    pismo(p === pasmo ? 'bold' : 'normal', 8.5, p === pasmo ? F.ink : F.muted);
    const popis = cisty(t.bands[i] + '  ' + ['0 - 34', '35 - 64', '65 - 100'][i]);
    doc.text(popis, i === 0 ? sx : i === 1 ? sx + (sirkyPasiem[i] - 2) / 2 : sx + sirkyPasiem[i] - 2, ky + 20, { align: ['left', 'center', 'right'][i] });
    sx += sirkyPasiem[i];
  });
  const mx = kx + Math.max(1, Math.min(99, r.index)) / 100 * vnutro;
  vypln('#ffffff'); doc.rect(mx - 2.5, ky - 5, 5, 17, 'F');
  vypln(F.ink); doc.rect(mx - 1, ky - 4, 2, 15, 'F');
  ky += 38;
  pismo('bold', 10.5, F.ink); for (const l of vyznam) { doc.text(l, kx, ky + 10); ky += 15; }
  ky += 4; pismo('normal', 9.5, F.body); for (const l of uvod) { doc.text(l, kx, ky + 9.5); ky += 13.5; }
  ky += 4; pismo('normal', 8.5, F.muted); for (const l of kalib) { doc.text(l, kx, ky + 8.5); ky += 12; }
  y += vyskaKarty + 18;

  // Vynechané riadky z PDF alebo Wordu.
  const vyn = r.vynechane ?? [];
  if (vyn.length) {
    const dovody = DOVODY.map(d => [d, vyn.filter(v => v.dovod === d).length]).filter(([, n]) => n).map(([d, n]) => t.reasons[d] + ': ' + n).join(' · ');
    odsek(doplnit(t.skipped, { n: vyn.length + ' ' + tvar(vyn.length, j, t.lineForms) }), 9.5, F.ink, 'bold');
    odsek(t.skippedWhy, 9, F.body);
    // v1.4 po bráne 1: dôvody na samostatnom riadku s veľkým začiatočným písmenom (nie „prečiarknuté. titulná…“).
    odsek(dovody.charAt(0).toLocaleUpperCase(j) + dovody.slice(1), 9, F.body);
    y += 10;
  }
  if (r.orezane) { odsek(t.truncated, 9, F.accent, 'bold'); y += 8; }

  // 2. Súhrn nálezov: čo to je, čo s tým, prvý výskyt.
  const zoznam = nalezy(r);
  miesto(60);
  pismo('bold', 16, F.ink); doc.text(cisty(t.pdfSummary), OKRAJ.l, y + 16); y += 26;
  if (!zoznam.length) odsek(t.nofindings, 10, F.body);
  else odsek(t.firstLead, 9, F.muted);
  y += 6;
  for (const p of zoznam) {
    const m = meraniaTypov[p.i], n = p.hits.length, farba = FARBY_TYPOV[p.typ];
    const pocet = n + ' ' + tvar(n, j, t.hitForms) + (r.slov >= 300 ? ' · ' + doplnit(t.perHundred, { n: cislo(n / r.slov * 100, j, n / r.slov * 100 < .1 ? 2 : 1) }) : '');
    pismo('normal', 9.5, F.body); const co = zalom(t.advice[m][0], OBSAH_S - 16);
    pismo('bold', 9.5, F.ink); const wLabel = sirka(cisty(t.todo + ': '));
    pismo('normal', 9.5, F.body); const rada = zalom(t.advice[m][1], OBSAH_S - 16, OBSAH_S - 16 - wLabel);
    miesto(26 + co.length * 13.5 + 10);
    // Na vrchu novej strany je už čiara hlavičky; druhá deliaca čiara by bola hneď pod ňou.
    if (y > OKRAJ.h + 10) { ciara(F.line, .6); doc.line(OKRAJ.l, y, S - OKRAJ.r, y); }
    y += 14;
    vypln(farba); doc.circle(OKRAJ.l + 4, y + 4.5, 3.4, 'F');
    pismo('bold', 11.5, F.ink); doc.text(cisty(t.metrics[m]), OKRAJ.l + 16, y + 9);
    pismo('normal', 9, F.muted); doc.text(cisty(pocet), S - OKRAJ.r, y + 9, { align: 'right' });
    y += 20;
    pismo('normal', 9.5, F.body);
    for (const l of co) { miesto(13.5); doc.text(l, OKRAJ.l + 16, y + 9.5); y += 13.5; }
    y += 3;
    rada.forEach((l, i) => {
      miesto(13.5);
      if (i === 0) { pismo('bold', 9.5, F.ink); doc.text(cisty(t.todo + ':'), OKRAJ.l + 16, y + 9.5); pismo('normal', 9.5, F.body); doc.text(l, OKRAJ.l + 16 + wLabel, y + 9.5); }
      else doc.text(l, OKRAJ.l + 16, y + 9.5);
      y += 13.5;
    });
    // Prvý výskyt ako úryvok so zvýraznením.
    if (original) {
      const [pred = '', hit = '', po = ''] = ukazka(original, p.hits[0], r.vynechane).split(/<\/?mark>/).map(odesc);
      const riadky = rozloz([{ text: pred, typ: null }, { text: hit, typ: p.typ }, { text: po, typ: null }], OBSAH_S - 40, 9.5);
      const vyska = 16 + riadky.length * 13.5 + 8;
      y += 6; miesto(vyska);
      vypln(F.paper); doc.rect(OKRAJ.l + 16, y, OBSAH_S - 16, vyska, 'F');
      vypln(farba); doc.rect(OKRAJ.l + 16, y, 2, vyska, 'F');
      pismo('normal', 8, F.muted); doc.text(cisty(t.inText), OKRAJ.l + 28, y + 12);
      let ry = y + 18;
      for (const riadok of riadky) { kresliRiadok(riadok, OKRAJ.l + 28, ry + 9.5, 9.5, 13.5); ry += 13.5; }
      y += vyska;
    }
    y += 12;
  }

  // 3. Graf dĺžky viet.
  const dl = r.dlzky_viet ?? [], d = rytmusData(r);
  miesto(200);
  y += 8;
  pismo('bold', 14, F.ink); doc.text(cisty(t.rhythmTitle), OKRAJ.l, y + 14); y += 22;
  odsek(t[d.popis], 10, F.ink, 'bold');
  if (dl.length >= 2) {
    const hist = dl.length > 120;
    odsek(hist ? doplnit(t.rhythmExplainHist, { n: dl.length + ' ' + tvar(dl.length, j, t.sentenceForms) }) : t.rhythmExplain, 9, F.muted);
    y += 6;
    const gx = OKRAJ.l, gw = OBSAH_S, gh = 110;
    miesto(gh + 40);
    const gy = y;
    vypln(F.deep); doc.roundedRect(gx, y, gw, gh, 6, 6, 'F');
    const vx = gx + 10, vw = gw - 20, vy = y + 10, vv = gh - (hist ? 34 : 20);
    if (hist) {
      const kose = histogram(dl), max = Math.max(1, ...kose.map(k => k.n)), bw = vw / kose.length;
      kose.forEach((k, i) => {
        const h = k.n / max * (vv - 14);
        vypln(F.accent); doc.rect(vx + i * bw + 6, vy + vv - h, bw - 12, h, 'F');
        pismo('bold', 8.5, F.ink); doc.text(String(k.n), vx + i * bw + bw / 2, vy + vv - h - 3, { align: 'center' });
        pismo('normal', 8.5, F.muted); doc.text(k.b === Infinity ? k.a + '+' : k.a + '-' + k.b, vx + i * bw + bw / 2, vy + vv + 14, { align: 'center' });
      });
    } else {
      const bw = vw / dl.length, med = Math.min(2, bw * .25);
      const yv = n => vy + vv - n / d.max * vv;
      vypln(tonom(F.body, .14)); doc.rect(vx, yv(d.horna), vw, yv(d.dolna) - yv(d.horna), 'F');
      vypln(F.accent);
      dl.forEach((n, i) => { const h = Math.max(1, n / d.max * vv); doc.rect(vx + i * bw + med / 2, vy + vv - h, Math.max(.6, bw - med), h, 'F'); });
      ciara(F.ink, .8); doc.line(vx, yv(d.priemer), vx + vw, yv(d.priemer));
    }
    y = gy + gh + 8;
    pismo('normal', 8.5, F.muted);
    doc.text(cisty(t.average + ': ' + cislo(d.priemer, j, 1) + ' ' + tvar(d.priemer, j, t.wordForms, true) + (hist ? '' : ' · ' + t.uniform + ' ±15 %')), OKRAJ.l, y + 9);
    y += 20;
  }

  // 4. Prepis celého textu s komentármi.
  const komentare = [];
  const text = original.slice(0, r.merane_do);
  const hits = r.zvyraznenia.filter(h => PROBLEMY.includes(h.typ));
  // Ťažké vety: aspoň tri podstatné mená namiesto slovies v jednej vete.
  const norm = normalizuj(original), pr = priprav(norm.text, JAZYKY[j]);
  const vety = pr.vsetky.map(v => norm.rozsah(v.od, v.do));
  const nomi = hits.filter(h => h.typ === 'nominalizacia');
  let vi = 0;
  const vPocet = new Map();
  for (const h of nomi) {
    while (vi < vety.length && vety[vi].do <= h.od) vi++;
    if (vi < vety.length && vety[vi].od <= h.od) { if (!vPocet.has(vi)) vPocet.set(vi, []); vPocet.get(vi).push(h); }
  }
  // Fráza, ktorá je zároveň poučením na konci (napr. „Na záver“), dostane jeden komentár: konkrétnejšie poučenie.
  const pointy = new Set(hits.filter(h => h.typ === 'pointa').map(h => h.od + ':' + h.do));
  for (const h of hits) {
    if (h.typ === 'nominalizacia' || (h.typ === 'fraza' && pointy.has(h.od + ':' + h.do))) continue;
    // Trojica s dlhým stredným členom ostane zvýraznená, ale bez komentára (často nejde o vymenovanie).
    if (h.typ === 'trojica' && !kratkaTrojica(h.text, j)) continue;
    komentare.push({ od: h.do, typ: h.typ, nazov: t.types[['fraza', 'pointa', 'trojica', 'nominalizacia', 'pomlcka'].indexOf(h.typ)], citat: h.text, rada: t.pdfTips[h.typ] });
  }
  for (const zoz of vPocet.values()) {
    // Názvy smerov (socializmus, Monetarismus) sú podstatné mená, ale rada „povedzte to slovesom“ na ne nesedí.
    const rozne = rozneZaklady(zoz.map(h => h.text).filter(w => !/i[sz]mus$/iu.test(w)), JAZYKY[j].KMEN);
    if (rozne.length < TAZKA_VETA) continue;
    komentare.push({ od: zoz[0].do, typ: 'nominalizacia', nazov: t.pdfHeavy + ' (' + rozne.length + ')', citat: rozne.slice(0, 4).join(', ') + (rozne.length > 4 ? ', …' : ''), rada: t.pdfTips.nominalizacia, bezUvodzoviek: true });
  }
  komentare.sort((a, b) => a.od - b.od);
  komentare.forEach((k, i) => { k.cislo = i + 1; });

  const kusy = kusky(text, [...hits, ...(r.vynechane ?? []).map(v => ({ ...v, typ: 'mimo' }))]);
  const segmenty = [];
  let pos = 0;
  for (const k of kusy) { segmenty.push({ text: k.text, typ: k.typy.find(x => PROBLEMY.includes(x)) ?? null, mimo: k.typy.includes('mimo'), od: pos }); pos += k.text.length; }
  const riadky = rozloz(segmenty, TEXT_S, TEXT_PISMO, komentare, /\n[ \t]*\n/.test(text));

  novaStrana();
  pismo('bold', 16, F.ink); doc.text(cisty(t.pdfTranscript), OKRAJ.l, y + 16); y += 26;
  odsek(t.pdfTranscriptLead, 9, F.muted);
  if (chybaZnakov) odsek(t.pdfMissing, 9, F.muted);
  y += 4;
  // Legenda farieb.
  let lx = OKRAJ.l;
  const legenda = PROBLEMY.filter(typ => hits.some(h => h.typ === typ)).map(typ => [typ, t.types[['fraza', 'pointa', 'trojica', 'nominalizacia', 'pomlcka'].indexOf(typ)]]);
  if (vyn.length) legenda.push(['mimo', t.pdfStruck]);
  pismo('normal', 8.5, F.body);
  for (const [typ, nazov] of legenda) {
    const w = sirka(cisty(nazov)) + 26;
    if (lx + w > S - OKRAJ.r) { lx = OKRAJ.l; y += 14; }
    if (typ === 'mimo') { ciara(F.muted, .7); doc.line(lx, y + 6, lx + 14, y + 6); }
    else {
      if (typ !== 'nominalizacia') { vypln(tonom(FARBY_TYPOV[typ], .2)); doc.rect(lx, y + 1, 14, 9, 'F'); }
      vypln(FARBY_TYPOV[typ]); doc.rect(lx, y + 9.2, 14, .9, 'F');
    }
    pismo('normal', 8.5, F.body); doc.text(cisty(nazov), lx + 19, y + 9);
    lx += w;
  }
  y += 24;
  ciara(F.line, .6); doc.line(OKRAJ.l, y - 8, S - OKRAJ.r, y - 8);

  let prvyNaStrane = true, komentareDo = y - 6, radyNaStrane = new Set();
  const dolnaHranica = V - OKRAJ.d;
  // Rada sa na strane vypíše pri prvom komentári daného druhu; ďalšie komentáre toho druhu majú len názov a citát.
  const vyskaKomentara = (k, rady) => {
    pismo('bold', KOM_PISMO, F.ink);
    const titul = zalom(k.cislo + '  ' + k.nazov, KOMENTAR_S - 12);
    pismo('normal', KOM_PISMO, F.body);
    const citat = k.citat ? [skrat(k.bezUvodzoviek ? k.citat : uv1 + k.citat.replace(/\s+/g, ' ') + uv2, KOMENTAR_S - 12)] : [];
    const klucRady = k.typ + (k.bezUvodzoviek ? '+' : '');
    const rada = rady.has(klucRady) ? [] : zalom(k.rada, KOMENTAR_S - 12);
    rady.add(klucRady);
    // Krátky názov a citát sa zmestia do jedného riadka.
    pismo('bold', KOM_PISMO);
    const spolu = titul.length === 1 && citat.length === 1 && sirka(titul[0] + '  ') + (pismo('normal', KOM_PISMO), sirka(citat[0])) <= KOMENTAR_S - 12;
    k.bloky = { titul, citat, rada, spolu };
    return 7 + (titul.length + (spolu ? 0 : citat.length) + rada.length) * KOM_RIADOK + 1;
  };
  for (const riadok of riadky) {
    const vyskaRiadku = TEXT_RIADOK + (riadok.odsek ? 5 : 0);
    // Nový odsek počká, kým ho komentáre predošlého odseku nedobehnú; vnútri odseku text nepreruší.
    if (riadok.zaciatok && komentareDo > y + 2 * TEXT_RIADOK) y = Math.min(komentareDo - TEXT_RIADOK, dolnaHranica);
    const umiestni = () => {
      let cy = Math.max(y + (riadok.odsek ? 5 : 0) - 2, komentareDo + 4);
      const plan = [], rady = new Set(radyNaStrane);
      for (const k of riadok.komentare) { const h = vyskaKomentara(k, rady); plan.push({ k, cy, h }); cy += h + 4; }
      return { plan, rady };
    };
    const strana = () => { novaStrana(); prvyNaStrane = true; komentareDo = y - 6; radyNaStrane = new Set(); };
    if (y + vyskaRiadku > dolnaHranica) strana();
    let { plan, rady } = umiestni();
    if (plan.length && plan.at(-1).cy + plan.at(-1).h > dolnaHranica && !prvyNaStrane) {
      strana(); ({ plan, rady } = umiestni());
    }
    radyNaStrane = rady;
    // Aj na novej strane sa niekedy všetky komentáre nezmestia: zvyšok zhrnie jeden riadok.
    let navyse = 0;
    while (plan.length && plan.at(-1).cy + plan.at(-1).h > dolnaHranica) { plan.pop(); navyse++; }
    if (riadok.odsek) y += 5;
    const zaklad = y + TEXT_PISMO;
    kresliRiadok(riadok, OKRAJ.l, zaklad, TEXT_PISMO, TEXT_RIADOK);
    for (const { k, cy, h } of plan) {
      const farba = FARBY_TYPOV[k.typ];
      const znacka = riadok.znacky.find(z => z.k === k);
      if (znacka) {
        ciara(tonom(farba, .4), .4);
        const ky0 = zaklad - TEXT_PISMO * .75;
        doc.line(OKRAJ.l + znacka.x + znacka.w + 1.5, ky0, OKRAJ.l + TEXT_S + 6, ky0);
        doc.line(OKRAJ.l + TEXT_S + 6, ky0, KOMENTAR_X - 2, cy + 6);
      }
      vypln(F.paper); ciara(F.line, .5); doc.rect(KOMENTAR_X, cy, KOMENTAR_S, h, 'FD');
      vypln(farba); doc.rect(KOMENTAR_X, cy, 1.8, h, 'F');
      let ty = cy + 3.5 + KOM_PISMO;
      pismo('bold', KOM_PISMO, F.ink);
      k.bloky.titul.forEach((l, i) => {
        if (i === 0) {
          const c = String(k.cislo);
          pismo('bold', KOM_PISMO, farba); doc.text(c, KOMENTAR_X + 7, ty);
          pismo('bold', KOM_PISMO, F.ink); doc.text(l.slice(c.length), KOMENTAR_X + 7 + sirka(c), ty);
        } else doc.text(l, KOMENTAR_X + 7, ty);
        if (!k.bloky.spolu) ty += KOM_RIADOK;
      });
      pismo('normal', KOM_PISMO, F.body);
      if (k.bloky.spolu) {
        pismo('bold', KOM_PISMO); const wt = sirka(k.bloky.titul[0] + '  ');
        pismo('normal', KOM_PISMO, F.body); doc.text(k.bloky.citat[0], KOMENTAR_X + 7 + wt, ty); ty += KOM_RIADOK;
      } else for (const l of k.bloky.citat) { doc.text(l, KOMENTAR_X + 7, ty); ty += KOM_RIADOK; }
      pismo('normal', KOM_PISMO, F.muted);
      for (const l of k.bloky.rada) { doc.text(l, KOMENTAR_X + 7, ty); ty += KOM_RIADOK; }
      komentareDo = cy + h;
    }
    if (navyse) {
      pismo('normal', KOM_PISMO, F.muted);
      doc.text(cisty(doplnit(t.pdfMore, { n: navyse })), KOMENTAR_X, Math.min(dolnaHranica, komentareDo + 12));
    }
    y += TEXT_RIADOK;
    prvyNaStrane = false;
  }

  // 5. Päta na každej strane: súkromie a číslo strany.
  const strany = doc.getNumberOfPages();
  for (let i = 1; i <= strany; i++) {
    doc.setPage(i);
    ciara(F.line, .6); doc.line(OKRAJ.l, V - 44, S - OKRAJ.r, V - 44);
    pismo('normal', 7.5, F.muted);
    zalom(t.reportPrivacy, OBSAH_S - 110).forEach((l, k) => doc.text(l, OKRAJ.l, V - 32 + k * 10));
    doc.text(cisty(doplnit(t.pdfPage, { n: i, z: strany })), S - OKRAJ.r, V - 32, { align: 'right' });
  }
  return { doc, strany, komentare };

  // Rozloženie textu na riadky: slová so štýlom, mäkké a tvrdé zalomenia, značky komentárov za nálezom.
  function rozloz(segmenty, max, velkost, kotvy = [], prazdneRiadky = true) {
    pismo('normal', velkost);
    const medzera = sirka(' ');
    const out = [];
    let riadok = novy(), cakajucaMedzera = null, skupina = null, ki = 0;
    function novy(odsekPred = false, zaciatok = false) { return { kusy: [], sirka: 0, odsek: odsekPred, zaciatok: zaciatok || odsekPred, znacky: [], komentare: [] }; }
    const zavri = (odsekPo = false, tvrdy = false) => { out.push(riadok); riadok = novy(odsekPo, tvrdy); cakajucaMedzera = null; };
    const vlozSkupinu = () => {
      if (!skupina) return;
      // Kotvy komentárov, ktorých koniec nálezu leží v tejto skupine alebo pred ňou.
      const znacky = [];
      while (ki < kotvy.length && kotvy[ki].od <= skupina.do) { znacky.push(kotvy[ki]); ki++; }
      pismo('bold', velkost * .62);
      const wZnacky = znacky.reduce((s, k) => s + sirka(String(k.cislo)) + 1.5, 0);
      pismo('normal', velkost);
      let w = skupina.kusy.reduce((s, k) => s + k.w, 0) + wZnacky;
      const pred = riadok.kusy.length && cakajucaMedzera ? medzera : 0;
      if (riadok.kusy.length && riadok.sirka + pred + w > max) zavri();
      else if (pred) { riadok.kusy.push({ text: ' ', w: medzera, typ: cakajucaMedzera.typ, mimo: cakajucaMedzera.mimo, x: riadok.sirka }); riadok.sirka += medzera; }
      for (const k of skupina.kusy) {
        // Slovo dlhšie než stĺpec (odkaz, bodky obsahu) rozdelíme po znakoch.
        let zvysok = k.text;
        while (zvysok) {
          const volne = max - riadok.sirka;
          if (sirka(zvysok) <= volne) {
            riadok.kusy.push({ text: zvysok, w: sirka(zvysok), typ: k.typ, mimo: k.mimo, x: riadok.sirka });
            riadok.sirka += sirka(zvysok);
            break;
          }
          let n = zvysok.length;
          while (n > 1 && sirka(zvysok.slice(0, n)) > volne) n--;
          if (sirka(zvysok.slice(0, n)) > volne && riadok.kusy.length) { zavri(); continue; }
          const cast = zvysok.slice(0, n);
          riadok.kusy.push({ text: cast, w: sirka(cast), typ: k.typ, mimo: k.mimo, x: riadok.sirka });
          riadok.sirka += sirka(cast);
          zvysok = zvysok.slice(n);
          zavri();
        }
      }
      for (const kotva of znacky) {
        pismo('bold', velkost * .62);
        const wz = sirka(String(kotva.cislo));
        pismo('normal', velkost);
        riadok.znacky.push({ k: kotva, x: riadok.sirka + .5, w: wz });
        riadok.komentare.push(kotva);
        riadok.sirka += wz + 1.5;
      }
      skupina = null; cakajucaMedzera = null;
    };
    // Tokeny: slovo, medzera, koniec riadka. Slová bez medzery medzi segmentmi (zátvorka, pomlčka) držia spolu.
    const tokeny = [];
    for (const seg of segmenty) {
      for (const m of seg.text.matchAll(/\n|[^\S\n]+|[^\s]+/gu)) {
        const od = (seg.od ?? 0) + m.index;
        if (m[0] === '\n') tokeny.push({ k: 'n', typ: seg.typ, mimo: seg.mimo });
        else if (/^\s/u.test(m[0])) tokeny.push({ k: 's', typ: seg.typ, mimo: seg.mimo });
        else tokeny.push({ k: 'w', text: cisty(m[0]), typ: seg.typ, mimo: seg.mimo, od, do: od + m[0].length });
      }
    }
    pismo('normal', velkost);
    for (let i = 0; i < tokeny.length; i++) {
      const tk = tokeny[i];
      if (tk.k === 'w') {
        if (!skupina) skupina = { kusy: [], do: tk.do };
        skupina.kusy.push({ text: tk.text, w: sirka(tk.text), typ: tk.typ, mimo: tk.mimo });
        skupina.do = tk.do;
        continue;
      }
      vlozSkupinu();
      if (tk.k === 's') { if (riadok.kusy.length) cakajucaMedzera = cakajucaMedzera ?? tk; continue; }
      // Koniec riadka: prázdny riadok je nový odsek; jeden koniec riadka podľa typu textu.
      let n = 1;
      while (i + 1 < tokeny.length && (tokeny[i + 1].k === 'n' || tokeny[i + 1].k === 's')) { if (tokeny[i + 1].k === 'n') n++; i++; }
      if (n >= 2) { if (riadok.kusy.length) zavri(true); else { riadok.odsek = out.length > 0; riadok.zaciatok = true; } continue; }
      const dalsie = tokeny[i + 1];
      const posledny = riadok.kusy.at(-1)?.text ?? '';
      const makky = !prazdneRiadky && dalsie?.k === 'w' && !dalsie.mimo && !riadok.kusy.at(-1)?.mimo && (/^\p{Ll}/u.test(dalsie.text) || /[,;]$/u.test(posledny));
      if (makky) { if (riadok.kusy.length) cakajucaMedzera = { typ: null, mimo: false }; }
      else if (riadok.kusy.length) zavri(false, true);
    }
    vlozSkupinu();
    if (riadok.kusy.length) out.push(riadok);
    // Kotvy za koncom textu (nemalo by nastať) pripneme k poslednému riadku.
    while (ki < kotvy.length && out.length) { out.at(-1).komentare.push(kotvy[ki]); ki++; }
    return out;
  }

  // Jeden riadok: podklad a podčiarknutie nálezov, text, prečiarknutie vynechaných riadkov, čísla komentárov.
  function kresliRiadok(riadok, x0, zaklad, velkost) {
    // Podstatné mená namiesto slovies sú v odbornom texte časté: len tenké podčiarknutie, bez podkladu.
    for (const k of riadok.kusy) {
      if (!k.typ || k.mimo) continue;
      if (k.typ !== 'nominalizacia') { vypln(tonom(FARBY_TYPOV[k.typ], .17)); doc.rect(x0 + k.x, zaklad - velkost * .86, k.w, velkost * 1.2, 'F'); }
      vypln(FARBY_TYPOV[k.typ]); doc.rect(x0 + k.x, zaklad + velkost * .22, k.w, .8, 'F');
    }
    // Súvislé kusy s rovnakým štýlom vypíšeme naraz (menšie PDF, rovnaké pozície: jsPDF nekernuje).
    let beh = null;
    const vypis = () => {
      if (!beh) return;
      pismo('normal', velkost, beh.mimo ? '#8a877f' : F.ink);
      doc.text(beh.text, x0 + beh.x, zaklad);
      if (beh.mimo) { ciara('#8a877f', .6); doc.line(x0 + beh.x, zaklad - velkost * .3, x0 + beh.x + beh.w, zaklad - velkost * .3); }
      beh = null;
    };
    for (const k of riadok.kusy) {
      // Beh sa preruší aj pri medzere po čísle komentára, inak by sa text posunul.
      if (beh && beh.mimo === !!k.mimo && Math.abs(beh.x + beh.w - k.x) < .01) { beh.text += k.text; beh.w += k.w; }
      else { vypis(); beh = { text: k.text, x: k.x, w: k.w, mimo: !!k.mimo }; }
    }
    vypis();
    for (const z of riadok.znacky) {
      pismo('bold', velkost * .62, FARBY_TYPOV[z.k.typ]);
      doc.text(String(z.k.cislo), x0 + z.x, zaklad - velkost * .42);
    }
  }
}
