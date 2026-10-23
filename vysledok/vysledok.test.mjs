// Výsledok kontroly e-mailom (súhlas vysledok-v1, relácia 205): spoločný blok hubu, stránka potvrdenia a archív súhlasu.
// Spustenie z koreňa repozitára: node --test products/arling-sk/vysledok/vysledok.test.mjs
// Bez siete a bez závislostí: malý falošný DOM nižšie, sieť a časovače sa nahrádzajú cez deps.
// AGENTS.md bod 12: súbeh (poradie odpovedí v oboch poradiach, jeden dopyt naraz), vkladanie (len textContent, biele
// zoznamy v tele požiadavky), zlyhanie zatvára (neznámy vstup alebo odpoveď nikdy neskončí ako úspech). Každý z týchto testov
// bol overený dočasnou mutáciou kódu (zápis v ops/druhy-ucet/205/stavba/S2-hub.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as J from './vysledok-jadro.mjs?v=1';
import * as B from './vysledok-email.js';
import * as P from './potvrdit/potvrdit.js';

// Predvolené meranie oboch modulov pred tým, ako ho testy nahradia záznamníkom.
const povodnyTrackBloku = B.deps.track;
const povodnyTrackPotvrdenia = P.deps.track;
const TU = dirname(fileURLToPath(import.meta.url));
const KOREN = join(TU, '..', '..', '..');
const citaj = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const ARCHIV = citaj(join(KOREN, 'ops', 'druhy-ucet', '205', 'pravo', 'SUHLAS-VYSLEDOK.md'));
const STRANKA = citaj(join(TU, 'potvrdit', 'index.html'));
const BLOKY = Object.fromEntries([...ARCHIV.matchAll(/^```text (\S+)\n([\s\S]*?)\n```$/gm)].map((m) => [m[1], m[2]]));
const ODTLACKY = Object.fromEntries([...ARCHIV.matchAll(/^\| `(\S+)` \| ([0-9a-f]{64}) \|$/gm)].map((m) => [m[1], m[2]]));
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

// ── falošný DOM (len to, čo používa blok a stránka potvrdenia) ──
class Text { constructor(doc, t) { this.nodeType = 3; this.ownerDocument = doc; this.data = String(t); this.parentNode = null; }
  get textContent() { return this.data; } set textContent(v) { this.data = String(v); } }
class Prvok {
  constructor(doc, tag) { this.nodeType = 1; this.ownerDocument = doc; this.tagName = tag.toUpperCase(); this.atributy = new Map(); this.childNodes = []; this.parentNode = null; this.posluchaci = {}; this.hidden = false; this.style = {}; }
  setAttribute(k, v) { this.atributy.set(k, String(v)); } getAttribute(k) { return this.atributy.has(k) ? this.atributy.get(k) : null; }
  hasAttribute(k) { return this.atributy.has(k); } removeAttribute(k) { this.atributy.delete(k); }
  get id() { return this.getAttribute('id') || ''; } set id(v) { this.setAttribute('id', v); }
  get className() { return this.getAttribute('class') || ''; } set className(v) { this.setAttribute('class', v); }
  get href() { return this.getAttribute('href') || ''; } set href(v) { this.setAttribute('href', v); }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
  get textContent() { return this.childNodes.map((n) => n.textContent).join(''); }
  set textContent(v) { this.replaceChildren(String(v)); }
  set innerHTML(v) { this.innerHTMLPouzity = true; this.replaceChildren(String(v)); }
  uzol(n) { return typeof n === 'string' ? new Text(this.ownerDocument, n) : n; }
  append(...n) { for (const x of n) { const u = this.uzol(x); if (u.parentNode) u.parentNode.childNodes = u.parentNode.childNodes.filter((y) => y !== u); u.parentNode = this; this.childNodes.push(u); } }
  appendChild(n) { this.append(n); return n; }
  replaceChildren(...n) { for (const c of this.childNodes) c.parentNode = null; this.childNodes = []; this.append(...n); }
  addEventListener(typ, f) { (this.posluchaci[typ] ||= []).push(f); }
  vyvolaj(typ) { for (const f of this.posluchaci[typ] || []) f({ type: typ, target: this, preventDefault() {} }); }
  focus() { this.ownerDocument.activeElement = this; }
  *potomkovia() { for (const c of this.childNodes) if (c.nodeType === 1) { yield c; yield* c.potomkovia(); } }
  querySelectorAll(s) { const m = zhoda(s); return [...this.potomkovia()].filter(m); }
  querySelector(s) { return this.querySelectorAll(s)[0] || null; }
}
function zhoda(sel) {
  const m = sel.match(/^([a-z0-9]*)((?:\[[^\]]+\]|\.[a-z0-9_-]+)*)$/i);
  if (!m) throw new Error('selektor ' + sel);
  const tag = m[1].toUpperCase(), casti = [...m[2].matchAll(/\[([^\]=]+)(?:="([^"]*)")?\]|\.([a-z0-9_-]+)/gi)];
  // Atribút alebo vlastnosť s rovnakým menom (modul nastavuje type a name cez vlastnosti, ako to robí prehliadač).
  const hodnota = (e, k) => (e.atributy.has(k) ? e.atributy.get(k) : typeof e[k] === 'string' ? e[k] : null);
  return (e) => (!tag || e.tagName === tag) && casti.every((c) => (c[3] ? e.className.split(/\s+/).includes(c[3])
    : c[2] !== undefined ? hodnota(e, c[1]) === c[2] : hodnota(e, c[1]) !== null));
}
class Dok {
  constructor() { this.documentElement = new Prvok(this, 'html'); this.head = new Prvok(this, 'head'); this.body = new Prvok(this, 'body');
    this.documentElement.append(this.head, this.body); this.activeElement = null; this.title = ''; }
  createElement(t) { return new Prvok(this, t); }
  querySelector(s) { return this.documentElement.querySelector(s); }
  querySelectorAll(s) { return this.documentElement.querySelectorAll(s); }
}
const PRAZDNE = new Set(['input', 'br', 'img', 'meta', 'link']);
const odEntit = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
/** Malý parser HTML pre úsek stránky (bez skriptov). */
function nacitajHtml(doc, html, koren) {
  const zasobnik = [koren];
  for (const t of html.matchAll(/<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*\/?>|([^<]+)/g)) {
    const vrch = zasobnik[zasobnik.length - 1];
    if (t[4] !== undefined) { vrch.append(odEntit(t[4])); continue; }
    if (!t[2]) continue;
    const tag = t[2].toLowerCase();
    if (t[1]) { while (zasobnik.length > 1 && zasobnik.pop().tagName !== tag.toUpperCase()); continue; }
    const e = doc.createElement(tag);
    for (const a of (t[3] || '').matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) { e.setAttribute(a[1], odEntit(a[2] ?? '')); if (a[1] === 'hidden') e.hidden = true; }
    vrch.append(e);
    if (!PRAZDNE.has(tag)) zasobnik.push(e);
  }
}
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };

// ── falošná sieť, časovače a meranie ──
function siet({ ignorujAbort = false } = {}) {
  const volania = [];
  const fetch = (url, init) => new Promise((res, rej) => {
    const v = { url, init, telo: JSON.parse(init.body), odpovedz: (status, data) => res({ status, ok: status >= 200 && status < 300, json: async () => { if (data === undefined) throw new Error('nie JSON'); return data; } }), zlyhaj: () => rej(new TypeError('Failed to fetch')) };
    volania.push(v);
    if (init.signal && !ignorujAbort) init.signal.addEventListener('abort', () => { v.zrusene = true; rej(new Error('AbortError')); });
  });
  return { fetch, volania };
}
const casovace = () => { const c = []; return { setTimeout: (f, ms) => { c.push({ f, ms }); return c.length; }, clearTimeout: () => {}, vyprs: () => c.splice(0).forEach((x) => x.f()), c }; };
function pripravBlok(opt = {}) {
  const s = siet(opt), cas = casovace(), cssCas = casovace(), udalosti = [];
  Object.assign(B.deps, { fetch: s.fetch, setTimeout: cas.setTimeout, clearTimeout: cas.clearTimeout, casovacCss: cssCas.setTimeout, endpoint: () => 'https://feed-monitor.arling.workers.dev/v1/vysledok',
    track: (n, d) => udalosti.push([n, d]) });
  const doc = new Dok(), miesto = doc.createElement('div'); doc.body.append(miesto);
  return { s, cas, cssCas, udalosti, doc, miesto };
}
const VYSLEDKY = {
  'agent-ready': { obchod: 'https://Obchod.example.sk/produkty?x=1#y', skore: 72, pokrytie: 90, pravidla: ['feed_title', 'feed_type'], eu: [{ kod: 'eu_withdrawal', stav: 'not_found' }] },
  efaktura: { profil: 'peppol', typ: 'Invoice', chyby: 2, varovania: 1, informacie: 0, pravidla: [{ kod: 'BR-CO-10', zavaznost: 'chyba', pocet: 2 }, { kod: 'PEPPOL-EN16931-R001', zavaznost: 'varovanie', pocet: 1 }] },
  sepa: { stav: 'fail', banka: 'tatrabanka', transakcie: 12, adresy_zle: 3, adresy_spolu: 12, nalezy: [{ kod: 'cdtr_iban_invalid', zavaznost: 'high', pocet: 1 }] },
};
const casti = (miesto) => {
  const q = (s) => miesto.querySelector(s);
  return { sekcia: q('section'), form: q('form'), pole: q('input[name="email"]'), pasca: q('input[name="website"]'), tlacidlo: q('button[type="submit"]'),
    chyba: q('p.vys-chyba'), hotovo: q('div.vys-hotovo'), uvod: q('div.vys-uvod'), zmenit: q('button.vys-zmenit'), adresa: q('b.vys-adresa') };
};
const odosli = (miesto, adresa) => { const c = casti(miesto); c.pole.value = adresa; c.form.vyvolaj('submit'); return c; };

// ── archív súhlasu ──
// Kľúče stránky potvrdenia a ich bloky v archíve (O3a: nadpisHotovo, bez_kluca). Kľúč, ktorý tu chýba, test nižšie zastaví.
const PK = { titul: 'titul', kicker: 'kicker', nadpis: 'nadpis', nadpisHotovo: 'nadpis-hotovo', text: 'text', tlacidlo: 'tlacidlo', odosiela: 'odosiela', odoslane: 'odoslane',
  uz_odoslane: 'uz-odoslane', odosielaSa: 'odosiela-sa', neplatny: 'neplatny', bez_kluca: 'bez-kluca', mail: 'mail', siet: 'siet', limit: 'limit', strop: 'strop', server: 'server' };
// Kľúče textov bloku, ktoré mapa archívu pokrýva (chyby po jednej, zasadyPred a zasadyPo v riadkoch správcu).
const KLUCE_BLOKU = ['nadpis', 'uvodOprava', 'uvodNalezy', 'uvodBezNalezov', 'oddelenie', 'pole', 'suhlas', 'tlacidlo', 'odosiela', 'spravcaSubor', 'spravcaObchod',
  'zasadyPred', 'zasady', 'zasadyPo', 'chyby', 'hotovoNadpis', 'hotovoText', 'hotovoDrobne', 'zmenit'];
const mapaArchivu = () => {
  const out = {};
  for (const j of J.JAZYKY_STRANKY) {
    const t = J.TEXTY[j], p = J.TEXTY_POTVRDENIE[j], k = (x) => `vysledok-v1/${j}/${x}`;
    Object.assign(out, { [k('nadpis')]: t.nadpis, [k('uvod-oprava')]: t.uvodOprava, [k('uvod-nalezy')]: t.uvodNalezy, [k('uvod-bez-nalezov')]: t.uvodBezNalezov,
      [k('oddelenie')]: t.oddelenie, [k('pole')]: t.pole,
      [k('veta')]: t.suhlas, [k('tlacidlo')]: t.tlacidlo, [k('odosiela')]: t.odosiela,
      [k('spravca-subor')]: `${t.spravcaSubor} ${t.zasadyPred}${t.zasady}${t.zasadyPo}`, [k('spravca-obchod')]: `${t.spravcaObchod} ${t.zasadyPred}${t.zasady}${t.zasadyPo}`,
      [k('spravca-odkaz')]: t.zasady, [k('hotovo-nadpis')]: t.hotovoNadpis, [k('hotovo-text')]: t.hotovoText, [k('hotovo-drobne')]: t.hotovoDrobne, [k('zmenit')]: t.zmenit });
    for (const [c, v] of Object.entries(t.chyby)) out[k('chyba-' + c)] = v;
    for (const [c, a] of Object.entries(PK)) out[k('potvrdit-' + a)] = p[c];
    for (const n of J.NASTROJE) { out[k('potvrdit-spat-' + n)] = p.spat[n]; out[k('potvrdit-nastroj-' + n)] = p.nastroje[n]; }
  }
  return out;
};

test('archív: každý blok má odtlačok SHA-256, ktorý sedí, a nič navyše', () => {
  assert.ok(Object.keys(BLOKY).length > 100);
  assert.deepEqual(Object.keys(ODTLACKY).sort(), Object.keys(BLOKY).sort());
  for (const [k, v] of Object.entries(BLOKY)) assert.equal(sha(v), ODTLACKY[k], k);
});

test('archív: texty modulu (blok aj stránka potvrdenia, SK, EN, DE, CS) sú presne bloky archívu, žiadny chýba ani nepribudol', () => {
  const mapa = mapaArchivu();
  for (const [k, v] of Object.entries(mapa)) assert.equal(v, BLOKY[k], k);
  // Bloky email-* (časť 6) sú texty workera; porovnáva ich test workera products/feed-doctor/monitor/test/vysledok-texty.test.mjs.
  const vArchive = Object.keys(BLOKY).filter((k) => k !== 'vysledok-v1/vsetky/potvrdit-noscript' && !/^vysledok-v1\/[a-z]+\/email-/.test(k)).sort();
  assert.deepEqual(Object.keys(mapa).sort(), vArchive);
  // kľúče textov rovnaké vo všetkých jazykoch (nový text v jednom jazyku bez archívu by test nezachytil inak)
  for (const j of J.JAZYKY_STRANKY) {
    assert.deepEqual(Object.keys(J.TEXTY[j]).sort(), Object.keys(J.TEXTY.sk).sort(), j);
    assert.deepEqual(Object.keys(J.TEXTY[j].chyby).sort(), Object.keys(J.TEXTY.sk.chyby).sort(), j);
    assert.deepEqual(Object.keys(J.TEXTY_POTVRDENIE[j]).sort(), Object.keys(J.TEXTY_POTVRDENIE.sk).sort(), j);
  }
  // O3a: každý kľúč textov bloku a stránky potvrdenia má blok v mape archívu (nový text bez bloku by inak prešiel bez archívu)
  assert.deepEqual(Object.keys(J.TEXTY.sk).sort(), [...KLUCE_BLOKU].sort());
  assert.deepEqual(Object.keys(J.TEXTY_POTVRDENIE.sk).filter((k) => !['spat', 'nastroje'].includes(k)).sort(), Object.keys(PK).sort());
});

test('archív: statické slovenské texty stránky potvrdenia a noscript sú bloky archívu', () => {
  const doc = new Dok(), koren = doc.createElement('div');
  nacitajHtml(doc, STRANKA.match(/<main[\s\S]*<\/main>/)[0], koren);
  const t = (s) => koren.querySelector(s).textContent;
  const b = (k) => BLOKY['vysledok-v1/sk/potvrdit-' + k];
  assert.equal(STRANKA.match(/<title>([^<]*)<\/title>/)[1], b('titul'));
  assert.equal(t('[data-t="kicker"]'), b('kicker'));
  assert.equal(t('[data-t="nadpis"]'), b('nadpis'));
  assert.equal(t('[data-t="text"]'), b('text'));
  assert.equal(t('[data-t="tlacidlo"]'), b('tlacidlo'));
  for (const n of J.NASTROJE) assert.equal(t(`a[data-nastroj="${n}"]`), b('nastroj-' + n));
  assert.equal(t('noscript'), BLOKY['vysledok-v1/vsetky/potvrdit-noscript']);
});

test('texty: žiadne pomlčky em ani en, žiadne prázdne texty, chyby začínajú slovom Chyba/Error/Fehler okrem stropu a vypnutia', () => {
  for (const [k, v] of Object.entries(BLOKY)) { assert.doesNotMatch(v, /[–—]/, k); assert.ok(v.trim().length > 1, k); }
  const pred = { sk: 'Chyba: ', en: 'Error: ', de: 'Fehler: ', cs: 'Chyba: ' };
  for (const j of J.JAZYKY_STRANKY) for (const [c, v] of Object.entries(J.TEXTY[j].chyby)) if (!['strop', 'vypnute'].includes(c)) assert.ok(v.startsWith(pred[j]), j + ' ' + c);
  for (const j of J.JAZYKY_STRANKY) assert.equal(J.TEXTY[j].hotovoText.split('{adresa}').length, 2, j);
});

// ── čisté funkcie ──
test('overenie adresy: rovnaké pravidlo ako straz.mjs, orezanie a malé písmená, bez riadiacich znakov, najviac 254 znakov', () => {
  assert.equal(J.normalizujEmail('  Ja.Meno@Firma.SK '), 'ja.meno@firma.sk');
  for (const zla of ['', 'a', 'a@b', 'a b@c.sk', 'a@b c.sk', '<a@b.sk>', 'a"b@c.sk', 'a@@b.sk', 'a@b@c.sk', 'a@.sk', 'a@b..sk', 'a\u0000@b.sk', 'a@b.sk\u0007', 'a\u0085@b.sk',
    'x'.repeat(250) + '@b.sk', null, undefined, 42, {}]) assert.equal(J.normalizujEmail(zla), null, JSON.stringify(zla));
  assert.equal(J.normalizujEmail('x'.repeat(247) + '@b.sk'), 'x'.repeat(247) + '@b.sk'); // 254 znakov presne
  // zhoda so straz.mjs pre bežné vstupy (pravidlo prevzaté, nie vymyslené)
  const re = /^[^@\s<>"]+@[^@\s<>".]+(?:\.[^@\s<>".]+)+$/;
  for (const s of ['a@b.sk', 'a+b@c.d.sk', 'a@b', 'a b@c.sk', 'a@b.c.']) assert.equal(J.normalizujEmail(s) !== null, s.length <= 254 && re.test(s), s);
});

test('zhrnutie: len polia zo SPEC časť 3 pre tri nástroje; texty zo vstupu (správa, hodnota, xpath, súbor) sa nikdy neprenesú', () => {
  const ar = J.zhrnutie('agent-ready', { ...VYSLEDKY['agent-ready'], sprava: 'X', html: '<b>', eu: [{ kod: 'eu_withdrawal', stav: 'not_found', label: 'Odstúpiť <b>' }] });
  assert.deepEqual(ar, { obchod: 'https://obchod.example.sk/', skore: 72, pokrytie: 90, pravidla: ['feed_title', 'feed_type'], eu: [{ kod: 'eu_withdrawal', stav: 'not_found' }] });
  const ef = J.zhrnutie('efaktura', { ...VYSLEDKY.efaktura, subor: 'faktura.xml', pravidla: [{ kod: 'BR-CO-10', zavaznost: 'chyba', pocet: 2, sprava: 'IBAN SK12 3456', xpath: '/Invoice', hodnota: '100' }] });
  assert.deepEqual(ef, { profil: 'peppol', typ: 'Invoice', chyby: 2, varovania: 1, informacie: 0, pravidla: [{ kod: 'BR-CO-10', zavaznost: 'chyba', pocet: 2 }] });
  const se = J.zhrnutie('sepa', { ...VYSLEDKY.sepa, message: 'm', value: 'v', fix: 'f', summary: 's', sum: 5, banksDetected: ['x'], checklist: [], nalezy: [{ kod: 'cdtr_iban_invalid', zavaznost: 'high', pocet: 1, value: 'SK00', message: 'x' }] });
  assert.deepEqual(se, { stav: 'fail', banka: 'tatrabanka', transakcie: 12, adresy_zle: 3, adresy_spolu: 12, nalezy: [{ kod: 'cdtr_iban_invalid', zavaznost: 'high', pocet: 1 }] });
  for (const z of [ar, ef, se]) assert.doesNotMatch(JSON.stringify(z), /sprava|message|value|xpath|subor|IBAN|SK00|faktura\.xml|<|>/);
  // stropy počtu položiek a zahodenie zlých kódov
  assert.equal(J.zhrnutie('agent-ready', { ...VYSLEDKY['agent-ready'], pravidla: Array.from({ length: 40 }, (_, i) => 'r' + i) }).pravidla.length, 27);
  assert.equal(J.zhrnutie('efaktura', { ...VYSLEDKY.efaktura, pravidla: Array.from({ length: 80 }, (_, i) => ({ kod: 'BR-' + i, zavaznost: 'chyba', pocet: 1 })) }).pravidla.length, 60);
  assert.equal(J.zhrnutie('sepa', { ...VYSLEDKY.sepa, nalezy: Array.from({ length: 90 }, (_, i) => ({ kod: 'k' + i, zavaznost: 'low', pocet: 1 })) }).nalezy.length, 70);
  assert.deepEqual(J.zhrnutie('efaktura', { ...VYSLEDKY.efaktura, pravidla: [{ kod: '<script>', zavaznost: 'chyba', pocet: 1 }, { kod: 'br-co-10', zavaznost: 'chyba', pocet: 1 }, { kod: 'BR-1', zavaznost: 'zla', pocet: 1 }, { kod: 'BR-2', zavaznost: 'chyba', pocet: 0 }] }).pravidla, []);
});

test('zhrnutie zlyhanie zatvára: neznámy nástroj, zlý obchod, mimo rozsahu alebo zlý typ = null (blok sa neukáže)', () => {
  assert.equal(J.zhrnutie('iny', VYSLEDKY.sepa), null);
  assert.equal(J.zhrnutie('sepa', null), null);
  assert.equal(J.zhrnutie('sepa', []), null);
  for (const obchod of ['http://obchod.sk/', 'https://ja:heslo@obchod.sk/', 'https://localhost/', 'https://obchod.sk:8443/', 'https://-zly.sk/', 'javascript:alert(1)', 'https://ob"chod.sk/', '', 42])
    assert.equal(J.zhrnutie('agent-ready', { ...VYSLEDKY['agent-ready'], obchod }), null, String(obchod));
  assert.equal(J.zhrnutie('agent-ready', { ...VYSLEDKY['agent-ready'], skore: 101 }), null);
  assert.equal(J.zhrnutie('agent-ready', { ...VYSLEDKY['agent-ready'], skore: null, pokrytie: null }).skore, null);
  assert.equal(J.zhrnutie('efaktura', { ...VYSLEDKY.efaktura, typ: 'Faktura' }), null);
  assert.equal(J.zhrnutie('efaktura', { ...VYSLEDKY.efaktura, chyby: 1001 }), null);
  assert.equal(J.zhrnutie('efaktura', { ...VYSLEDKY.efaktura, chyby: 1.5 }), null);
  assert.equal(J.zhrnutie('sepa', { ...VYSLEDKY.sepa, banka: 'fio' }), null);
  assert.equal(J.zhrnutie('sepa', { ...VYSLEDKY.sepa, adresy_zle: 13 }), null);
  assert.equal(J.zhrnutie('sepa', { ...VYSLEDKY.sepa, nalezy: 'x' }), null);
});

test('telo požiadavky pre tri nástroje: presne polia SPEC 2.2, suhlas vysledok-v1', () => {
  for (const [n, v] of Object.entries(VYSLEDKY)) {
    const t = J.teloPoziadavky({ email: 'ja@firma.sk', nastroj: n, jazyk: 'sk', zhrnutie: J.zhrnutie(n, v), hp: '' });
    assert.deepEqual(Object.keys(t).sort(), ['email', 'hp', 'jazyk', 'nastroj', 'suhlas', 'vysledok']);
    assert.equal(t.suhlas, 'vysledok-v1');
  }
  assert.equal(J.platnyJazyk('efaktura', 'cs'), true);
  assert.equal(J.platnyJazyk('sepa', 'cs'), false);
  assert.equal(J.platnyJazyk('agent-ready', 'cs'), false);
});

test('mapovanie odpovedí POST /v1/vysledok: 200, 400, 403, 413, 415, 429, 502, 503 strop a not_available, iné', () => {
  const m = J.stavOdoslania;
  assert.equal(m(200, { ok: true }), 'ok');
  assert.equal(m(200, {}), 'server');
  assert.equal(m(200, null), 'server');
  assert.equal(m(200, { ok: 'true' }), 'server');
  assert.equal(m(400, { error: 'invalid', pole: 'email' }), 'zla');
  assert.equal(m(400, null), 'zla');
  assert.equal(m(400, { error: 'invalid', pole: 'vysledok' }), 'server'); // naša chyba, nie preklep človeka
  assert.equal(m(403, { error: 'origin_not_allowed' }), 'server');
  assert.equal(m(413, { error: 'body_too_large' }), 'server');
  assert.equal(m(415, { error: 'json' }), 'server');
  assert.equal(m(429, { error: 'limit' }), 'limit');
  assert.equal(m(502, { error: 'mail' }), 'mail');
  assert.equal(m(503, { error: 'strop' }), 'strop');
  assert.equal(m(503, { error: 'not_available' }), 'vypnute');
  assert.equal(m(503, { error: 'limiter_unavailable' }), 'server');
  assert.equal(m(500, null), 'server');
  assert.equal(J.dovodChyby('cas'), 'siet');
  for (const s of ['zla', 'limit', 'strop', 'mail', 'siet', 'server', 'vypnute']) assert.equal(J.dovodChyby(s), s);
});

test('adresa API: feed-monitor na webe, pri 127.0.0.1 a localhost location.origin + /feed-monitor', () => {
  assert.equal(J.adresaApi({ hostname: 'arling.sk', origin: 'https://arling.sk' }, '/v1/vysledok'), 'https://feed-monitor.arling.workers.dev/v1/vysledok');
  assert.equal(J.adresaApi({ hostname: '127.0.0.1', origin: 'http://127.0.0.1:8123' }, '/v1/vysledok'), 'http://127.0.0.1:8123/feed-monitor/v1/vysledok');
  assert.equal(J.adresaApi({ hostname: 'localhost', origin: 'http://localhost:9' }, '/v1/vysledok/potvrd'), 'http://localhost:9/feed-monitor/v1/vysledok/potvrd');
  assert.equal(J.adresaApi(null, '/v1/vysledok'), 'https://feed-monitor.arling.workers.dev/v1/vysledok');
});

// ── blok vo falošnom DOM ──
test('blok: poradie prvkov podľa SPEC 5.3, atribúty poľa, pasca, odkaz na zásady podľa jazyka, CSS raz', () => {
  const { doc, miesto, udalosti } = pripravBlok();
  assert.equal(B.ukaz(miesto, { nastroj: 'efaktura', jazyk: 'en', vysledok: VYSLEDKY.efaktura }), true);
  const c = casti(miesto), f = c.form.children;
  assert.equal(miesto.hidden, false);
  assert.equal(c.sekcia.getAttribute('aria-labelledby'), miesto.querySelector('h3').id);
  assert.equal(miesto.querySelector('h3').textContent, J.TEXTY.en.nadpis);
  const iSuhlas = f.findIndex((e) => e.className === 'vys-suhlas'), iTl = f.indexOf(c.tlacidlo), iSpr = f.findIndex((e) => e.className === 'vys-spravca');
  assert.equal(iTl, iSuhlas + 1, 'veta súhlasu priamo nad tlačidlom');
  assert.equal(iSpr, iTl + 1, 'riadok správcu priamo pod tlačidlom');
  assert.equal(f[iSpr].textContent, BLOKY['vysledok-v1/en/spravca-subor']);
  assert.equal(f[iSpr].querySelector('a').href, '/privacy/en/#vysledok-emailom');
  assert.equal(c.form.noValidate, true);
  assert.deepEqual([c.pole.type, c.pole.autocomplete, c.pole.inputMode, c.pole.spellcheck, c.pole.required, c.pole.maxLength], ['email', 'email', 'email', false, true, 254]);
  assert.equal(c.pasca.tabIndex, -1);
  assert.equal(c.pasca.parentNode.getAttribute('aria-hidden'), 'true');
  assert.equal(c.pasca.parentNode.hidden, true);
  assert.ok(c.tlacidlo.className.includes('btn-line'), 'obrysové tlačidlo');
  assert.equal(c.chyba.getAttribute('role'), 'alert'); assert.equal(c.chyba.hidden, true);
  assert.equal(c.hotovo.getAttribute('role'), 'status'); assert.equal(c.hotovo.hidden, true);
  assert.equal(miesto.querySelector('input[type="checkbox"]'), null);
  B.ukaz(miesto, { nastroj: 'efaktura', jazyk: 'en', vysledok: VYSLEDKY.efaktura });
  assert.equal(doc.querySelectorAll('link[data-vysledok-css]').length, 1);
  assert.match(doc.querySelector('link[data-vysledok-css]').href, /\/vysledok\/vysledok-email\.css\?v=\d+$/);
  assert.equal(miesto.querySelectorAll('section').length, 1, 'čerstvý blok nahradí predošlý');
  assert.deepEqual(udalosti, [['vysledok_email_videny', { nastroj: 'efaktura', jazyk: 'en' }], ['vysledok_email_videny', { nastroj: 'efaktura', jazyk: 'en' }]]);
  // jazyky a nástroje: SK SEPA má vetu o nálezoch a súborový riadok správcu, DE obchod riadok s adresou obchodu, CS e-faktúra odkaz na SK zásady
  B.ukaz(miesto, { nastroj: 'sepa', jazyk: 'sk', vysledok: VYSLEDKY.sepa });
  assert.equal(miesto.querySelector('p.vys-text').textContent, BLOKY['vysledok-v1/sk/uvod-nalezy']);
  B.ukaz(miesto, { nastroj: 'agent-ready', jazyk: 'de', vysledok: VYSLEDKY['agent-ready'] });
  assert.equal(miesto.querySelector('p.vys-spravca').textContent, BLOKY['vysledok-v1/de/spravca-obchod']);
  assert.equal(miesto.querySelector('p.vys-text').textContent, BLOKY['vysledok-v1/de/uvod-oprava']);
  B.ukaz(miesto, { nastroj: 'efaktura', jazyk: 'cs', vysledok: VYSLEDKY.efaktura });
  assert.equal(miesto.querySelector('p.vys-spravca').querySelector('a').href, '/privacy/#vysledok-emailom');
});

test('blok zlyhanie zatvára: neznámy nástroj, jazyk mimo nástroja alebo zlé zhrnutie = nič sa neukáže, nič sa nemeria', () => {
  const { miesto, udalosti } = pripravBlok();
  B.ukaz(miesto, { nastroj: 'sepa', jazyk: 'sk', vysledok: VYSLEDKY.sepa });
  for (const arg of [{ nastroj: 'x', jazyk: 'sk', vysledok: VYSLEDKY.sepa }, { nastroj: 'sepa', jazyk: 'cs', vysledok: VYSLEDKY.sepa }, { nastroj: 'sepa', jazyk: 'sk' },
    { nastroj: 'agent-ready', jazyk: 'en', vysledok: { ...VYSLEDKY['agent-ready'], obchod: 'http://x.sk/' } }, undefined]) {
    assert.equal(B.ukaz(miesto, arg), false);
    assert.equal(miesto.hidden, true); assert.equal(miesto.childNodes.length, 0);
  }
  assert.equal(udalosti.length, 1);
  assert.equal(B.ukaz(null, { nastroj: 'sepa', jazyk: 'sk', vysledok: VYSLEDKY.sepa }), false);
});

test('blok: preklep v adrese = chyba pri poli, aria-invalid, žiadny dopyt; po oprave chyba zmizne', async () => {
  const { s, miesto, udalosti } = pripravBlok();
  B.ukaz(miesto, { nastroj: 'sepa', jazyk: 'sk', vysledok: VYSLEDKY.sepa });
  const c = odosli(miesto, 'ja@firma');
  await flush();
  assert.equal(s.volania.length, 0);
  assert.equal(c.chyba.hidden, false); assert.equal(c.chyba.textContent, BLOKY['vysledok-v1/sk/chyba-zla']);
  assert.equal(c.pole.getAttribute('aria-invalid'), 'true');
  assert.match(c.pole.getAttribute('aria-describedby'), /-chyba/);
  assert.deepEqual(udalosti.at(-1), ['odber_vysledok_chyba', { nastroj: 'sepa', dovod: 'zla' }]);
  c.pole.value = 'ja@firma.sk'; c.pole.vyvolaj('input');
  assert.equal(c.chyba.hidden, true); assert.equal(c.pole.getAttribute('aria-invalid'), null);
});

test('blok: úspech 200 = jeden dopyt s presným telom, počas neho zamknuté, stav „Skontrolujte schránku“, adresa ako text, meranie bez adresy, poOdoslani', async () => {
  const { s, miesto, udalosti, doc } = pripravBlok();
  const po = [];
  B.ukaz(miesto, { nastroj: 'agent-ready', jazyk: 'sk', vysledok: VYSLEDKY['agent-ready'], poOdoslani: (a) => po.push(a) });
  const c = odosli(miesto, '  Ja@Firma.SK ');
  await flush();
  assert.equal(s.volania.length, 1);
  const v = s.volania[0];
  assert.equal(v.url, 'https://feed-monitor.arling.workers.dev/v1/vysledok');
  assert.equal(v.init.method, 'POST'); assert.equal(v.init.headers['Content-Type'], 'application/json'); assert.equal(v.init.credentials, 'omit');
  assert.deepEqual(v.telo, { email: 'ja@firma.sk', nastroj: 'agent-ready', jazyk: 'sk', suhlas: 'vysledok-v1', vysledok: J.zhrnutie('agent-ready', VYSLEDKY['agent-ready']), hp: '' });
  assert.equal(c.pole.readOnly, true); assert.equal(c.tlacidlo.disabled, true); assert.equal(c.tlacidlo.textContent, J.TEXTY.sk.odosiela);
  c.form.vyvolaj('submit'); await flush();
  assert.equal(s.volania.length, 1, 'druhé odoslanie počas behu nič nepošle');
  v.odpovedz(200, { ok: true }); await flush();
  assert.equal(c.uvod.hidden, true); assert.equal(c.hotovo.hidden, false);
  assert.equal(doc.activeElement, c.hotovo.querySelector('h3'));
  assert.equal(c.adresa.textContent, 'ja@firma.sk');
  assert.equal(c.adresa.childNodes.length, 1); assert.equal(c.adresa.childNodes[0].nodeType, 3, 'adresa je textový uzol');
  assert.equal(c.hotovo.querySelector('p.vys-text').textContent, J.TEXTY.sk.hotovoText.replace('{adresa}', 'ja@firma.sk'));
  assert.deepEqual(udalosti.at(-1), ['odber_vysledok', { nastroj: 'agent-ready', jazyk: 'sk' }]);
  for (const [, d] of udalosti) assert.doesNotMatch(JSON.stringify(d), /@|firma|obchod|feed_title/);
  assert.deepEqual(po, ['ja@firma.sk']);
  c.zmenit.vyvolaj('click');
  assert.equal(c.uvod.hidden, false); assert.equal(c.hotovo.hidden, true); assert.equal(c.pole.value, '  Ja@Firma.SK ');
});

test('blok: pasca website sa pošle ako hp (worker ju vyhodnotí), stránka sa správa rovnako', async () => {
  const { s, miesto } = pripravBlok();
  B.ukaz(miesto, { nastroj: 'sepa', jazyk: 'en', vysledok: VYSLEDKY.sepa });
  casti(miesto).pasca.value = 'http://spam';
  odosli(miesto, 'a@b.sk'); await flush();
  assert.equal(s.volania[0].telo.hp, 'http://spam');
});

test('blok: chyby servera a siete majú vetu, adresa ostáva v poli, tlačidlo sa odomkne; časový limit = vlastná veta, dôvod siet', async () => {
  const pripady = [[400, { error: 'invalid', pole: 'email' }, 'zla'], [403, { error: 'origin_not_allowed' }, 'server'], [415, { error: 'json' }, 'server'],
    [429, { error: 'limit' }, 'limit'], [502, { error: 'mail' }, 'mail'], [503, { error: 'strop' }, 'strop'], [503, { error: 'not_available' }, 'vypnute'],
    [200, { nieco: 1 }, 'server'], [200, undefined, 'server'], ['siet', null, 'siet'], ['cas', null, 'cas']];
  for (const [status, data, stav] of pripady) {
    const { s, cas, miesto, udalosti } = pripravBlok();
    B.ukaz(miesto, { nastroj: 'efaktura', jazyk: 'de', vysledok: VYSLEDKY.efaktura });
    const c = odosli(miesto, 'ja@firma.de'); await flush();
    if (status === 'siet') s.volania[0].zlyhaj(); else if (status === 'cas') cas.vyprs(); else s.volania[0].odpovedz(status, data);
    await flush();
    assert.equal(c.chyba.hidden, false, stav); assert.equal(c.chyba.textContent, J.TEXTY.de.chyby[stav], stav);
    assert.equal(c.hotovo.hidden, true, stav);
    assert.equal(c.pole.value, 'ja@firma.de'); assert.equal(c.pole.readOnly, false); assert.equal(c.tlacidlo.disabled, false);
    assert.equal(c.tlacidlo.textContent, J.TEXTY.de.tlacidlo);
    assert.deepEqual(udalosti.at(-1), ['odber_vysledok_chyba', { nastroj: 'efaktura', dovod: J.dovodChyby(stav) }], stav);
    assert.ok(!udalosti.some(([n]) => n === 'odber_vysledok'), stav);
  }
});

for (const ignorujAbort of [false, true]) {
  test(`poradie A (${ignorujAbort ? 'sieť ignoruje zrušenie' : 'zrušený dopyt'}): odpoveď na staré odoslanie po novom ukaz sa zahodí a nič neprepíše`, async () => {
    const { s, miesto, udalosti } = pripravBlok({ ignorujAbort });
    const po = [];
    B.ukaz(miesto, { nastroj: 'sepa', jazyk: 'sk', vysledok: VYSLEDKY.sepa, poOdoslani: (a) => po.push(a) });
    odosli(miesto, 'ja@firma.sk'); await flush();
    B.ukaz(miesto, { nastroj: 'sepa', jazyk: 'sk', vysledok: { ...VYSLEDKY.sepa, stav: 'pass', nalezy: [] }, poOdoslani: (a) => po.push('novy ' + a) });
    assert.equal(s.volania[0].init.signal.aborted, true, 'nové ukaz zruší bežiaci dopyt');
    s.volania[0].odpovedz(200, { ok: true }); await flush();
    const c = casti(miesto);
    assert.equal(c.hotovo.hidden, true); assert.equal(c.uvod.hidden, false); assert.equal(c.chyba.hidden, true);
    assert.notEqual(c.pole.readOnly, true); assert.notEqual(c.tlacidlo.disabled, true);
    assert.equal(c.tlacidlo.textContent, J.TEXTY.sk.tlacidlo);
    assert.deepEqual(udalosti.map(([n]) => n), ['vysledok_email_videny', 'vysledok_email_videny']);
    assert.deepEqual(po, []);
  });
}

test('poradie B: odpoveď pred novým výsledkom sa uplatní, nový ukaz potom vykreslí čerstvý formulár', async () => {
  const { s, miesto, udalosti } = pripravBlok();
  B.ukaz(miesto, { nastroj: 'efaktura', jazyk: 'sk', vysledok: VYSLEDKY.efaktura });
  odosli(miesto, 'ja@firma.sk'); await flush();
  s.volania[0].odpovedz(200, { ok: true }); await flush();
  assert.equal(casti(miesto).hotovo.hidden, false);
  B.ukaz(miesto, { nastroj: 'efaktura', jazyk: 'sk', vysledok: { ...VYSLEDKY.efaktura, chyby: 0, pravidla: [] } });
  const c = casti(miesto);
  assert.equal(c.hotovo.hidden, true); assert.equal(c.uvod.hidden, false); assert.equal(c.pole.value, undefined);
  assert.deepEqual(udalosti.map(([n]) => n), ['vysledok_email_videny', 'odber_vysledok', 'vysledok_email_videny']);
  // a druhé odoslanie z nového bloku nesie nové zhrnutie
  odosli(miesto, 'ja@firma.sk'); await flush();
  assert.equal(s.volania[1].telo.vysledok.chyby, 0);
});

test('skry počas odosielania: blok zmizne a neskorá odpoveď nič neurobí', async () => {
  const { s, miesto, udalosti } = pripravBlok({ ignorujAbort: true });
  B.ukaz(miesto, { nastroj: 'sepa', jazyk: 'en', vysledok: VYSLEDKY.sepa });
  odosli(miesto, 'a@b.sk'); await flush();
  B.skry(miesto);
  assert.equal(miesto.hidden, true); assert.equal(miesto.childNodes.length, 0);
  s.volania[0].odpovedz(502, { error: 'mail' }); await flush();
  assert.equal(miesto.childNodes.length, 0);
  assert.deepEqual(udalosti.map(([n]) => n), ['vysledok_email_videny']);
});

test('meranie: predvolené track nič nepošle pri ?test a nikdy nespadne', () => {
  const povodne = { location: globalThis.location, window: globalThis.window };
  const volane = [];
  try {
    const track = povodnyTrackBloku;
    globalThis.window = { umami: { track: (n, d) => volane.push([n, d]) } };
    globalThis.location = { search: '?test=1', hostname: 'arling.sk', origin: 'https://arling.sk' };
    track('vysledok_email_videny', { nastroj: 'sepa', jazyk: 'sk' });
    assert.equal(volane.length, 0);
    globalThis.location = { search: '?utm_source=x', hostname: 'arling.sk', origin: 'https://arling.sk' };
    track('vysledok_email_videny', { nastroj: 'sepa', jazyk: 'sk' });
    assert.equal(volane.length, 1);
    globalThis.window = { umami: { track: () => { throw new Error('x'); } } };
    track('a', {});
    // potvrdenie: tá istá poistka podľa adresy stránky
    globalThis.window = { umami: { track: (n, d) => volane.push([n, d]) } };
    povodnyTrackPotvrdenia('odber_vysledok_potvrdeny', { nastroj: 'sepa' }, { search: '?test' });
    assert.equal(volane.length, 1);
    povodnyTrackPotvrdenia('odber_vysledok_potvrdeny', { nastroj: 'sepa' }, { search: '' });
    assert.equal(volane.length, 2);
  } finally { globalThis.location = povodne.location; globalThis.window = povodne.window; }
});

test('vkladanie: zdroje modulu, stránky a jadra nepoužívajú innerHTML, outerHTML, insertAdjacentHTML, document.write ani eval', () => {
  for (const f of ['vysledok-email.js', 'vysledok-jadro.mjs', 'potvrdit/potvrdit.js']) {
    const kod = citaj(join(TU, f)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(kod, /\b(innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval|new Function)\b/, f);
  }
});

// ── stránka potvrdenia ──
function pripravStranku(hash, { search = '' } = {}) {
  const s = siet(), cas = casovace(), udalosti = [], historia = [];
  Object.assign(P.deps, { fetch: s.fetch, setTimeout: cas.setTimeout, clearTimeout: cas.clearTimeout, track: (n, d) => udalosti.push([n, d]) });
  const doc = new Dok();
  nacitajHtml(doc, STRANKA.match(/<main[\s\S]*<\/main>/)[0], doc.body);
  const loc = { hash, search, pathname: '/vysledok/potvrdit/', hostname: 'arling.sk', origin: 'https://arling.sk' };
  // Ako prehliadač: nová adresa určí aj fragment (O3a: pri en, de, cs ostane #j=).
  const hist = { replaceState: (st, t, u) => { historia.push(u); const i = u.indexOf('#'); loc.hash = i >= 0 ? u.slice(i) : ''; } };
  const vysl = P.spusti(doc, loc, hist);
  const k = doc.querySelector('[data-vysledok-potvrdit]');
  const q = (x) => k.querySelector(x);
  return { s, cas, udalosti, historia, doc, loc, vysl, k, tlacidlo: q('[data-vys-tlacidlo]'), ok: q('[data-vys-stav]'), zle: q('[data-vys-chyba]'), spat: q('[data-vys-spat]'), nastroje: q('[data-vys-nastroje]'), text: q('[data-vys-text]') };
}
const KLUC = 'a'.repeat(32) + '.' + 'b'.repeat(64);

test('potvrdenie: tvar kľúča a jazyk z fragmentu', () => {
  assert.deepEqual(J.citajFragment('#k=' + KLUC + '&j=de'), { k: KLUC, j: 'de' });
  assert.deepEqual(J.citajFragment('#j=cs&k=' + KLUC), { k: KLUC, j: 'cs' });
  assert.deepEqual(J.citajFragment('#k=' + KLUC + '&j=hu'), { k: KLUC, j: 'sk' });
  for (const zly of ['', '#', '#k=', '#k=' + 'a'.repeat(32), '#k=' + 'A'.repeat(32) + '.' + 'b'.repeat(64), '#k=' + 'a'.repeat(31) + '.' + 'b'.repeat(64),
    '#k=' + KLUC + 'c', '#k=' + KLUC.replace('.', '-'), '#k=%3Cscript%3E']) assert.equal(J.citajFragment(zly).k, null, zly);
});

test('potvrdenie: fragment s kľúčom sa hneď odstráni z adresy, kľúč nie je v stránke, nič sa nepošle bez kliknutia', async () => {
  // O3a: kľúč zmizne, jazyk odkazu (en) ostane vo fragmente; slovenčina je predvolená, tam fragment zmizne celý.
  const sk = pripravStranku('#k=' + KLUC + '&j=sk', { search: '?utm_source=vysledok-email' });
  assert.deepEqual(sk.historia, ['/vysledok/potvrdit/?utm_source=vysledok-email']);
  assert.equal(sk.loc.hash, '');
  const st = pripravStranku('#k=' + KLUC + '&j=en', { search: '?utm_source=vysledok-email' });
  assert.deepEqual(st.historia, ['/vysledok/potvrdit/?utm_source=vysledok-email#j=en']);
  assert.equal(st.loc.hash, '#j=en');
  assert.ok(!st.historia.join(' ').includes(KLUC.slice(0, 32)), 'kľúč nie je v histórii');
  await flush();
  st.cas.vyprs(); await flush();
  assert.equal(st.s.volania.length, 0, 'žiadny POST bez kliknutia');
  assert.equal(st.tlacidlo.hidden, false);
  const vsetko = [...st.doc.documentElement.potomkovia()].map((e) => e.textContent + [...e.atributy.values()].join(' ')).join(' ');
  assert.ok(!vsetko.includes(KLUC.slice(0, 32)));
  assert.equal(st.doc.documentElement.lang, 'en');
  assert.equal(st.doc.title, J.TEXTY_POTVRDENIE.en.titul);
  assert.equal(st.k.querySelector('h1').textContent, J.TEXTY_POTVRDENIE.en.nadpis);
  assert.equal(st.tlacidlo.textContent, J.TEXTY_POTVRDENIE.en.tlacidlo);
});

test('potvrdenie: zlý alebo skrátený kľúč = neplatný odkaz s tromi nástrojmi v jazyku, žiadne tlačidlo, žiadny dopyt', async () => {
  for (const hash of ['#k=zly&j=de', '#k=' + KLUC.slice(0, 40) + '&j=sk', '#k=&j=de', '#j=de&k']) {
    const st = pripravStranku(hash);
    await flush();
    const j = hash.includes('j=de') ? 'de' : 'sk';
    assert.equal(st.k.getAttribute('data-stav'), 'neplatny', hash);
    assert.equal(st.tlacidlo.hidden, true); assert.equal(st.zle.hidden, false);
    assert.equal(st.zle.textContent, J.TEXTY_POTVRDENIE[j].neplatny);
    assert.equal(st.nastroje.hidden, false);
    assert.deepEqual(st.nastroje.querySelectorAll('a').map((a) => a.href), J.NASTROJE.map((n) => J.adresaNastroja(n, j)));
    assert.equal(st.s.volania.length, 0);
  }
});

test('potvrdenie: kliknutie pošle práve jeden POST {k}; dvojklik nič navyše; odoslané = veta, odkaz späť na nástroj, meranie bez kľúča', async () => {
  const st = pripravStranku('#k=' + KLUC + '&j=de');
  st.tlacidlo.vyvolaj('click'); st.tlacidlo.vyvolaj('click'); await flush();
  assert.equal(st.s.volania.length, 1);
  assert.equal(st.s.volania[0].url, 'https://feed-monitor.arling.workers.dev/v1/vysledok/potvrd');
  assert.deepEqual(st.s.volania[0].telo, { k: KLUC });
  assert.equal(st.tlacidlo.disabled, true); assert.equal(st.tlacidlo.textContent, J.TEXTY_POTVRDENIE.de.odosiela);
  st.s.volania[0].odpovedz(200, { ok: true, stav: 'odoslane', nastroj: 'sepa' }); await flush();
  assert.equal(st.k.getAttribute('data-stav'), 'odoslane');
  assert.equal(st.ok.hidden, false); assert.equal(st.ok.textContent, J.TEXTY_POTVRDENIE.de.odoslane);
  assert.equal(st.tlacidlo.hidden, true);
  assert.equal(st.spat.hidden, false); assert.equal(st.spat.querySelector('a').href, '/sepa-pain001-doctor/de/');
  assert.equal(st.spat.querySelector('a').textContent, J.TEXTY_POTVRDENIE.de.spat.sepa);
  assert.deepEqual(st.udalosti, [['odber_vysledok_potvrdeny', { nastroj: 'sepa' }]]);
});

test('potvrdenie: stavy uz_odoslane, odosiela, mail, limit, server, siet a neplatny; tlačidlo ostane tam, kde má zmysel skúsiť znova', async () => {
  const pripady = [[200, { ok: true, stav: 'uz_odoslane', nastroj: 'efaktura' }, 'uz_odoslane', false], [200, { ok: true, stav: 'odosiela' }, 'odosiela', true],
    [502, { error: 'mail' }, 'mail', true], [429, { error: 'limit' }, 'limit', true], [503, { error: 'strop' }, 'strop', true], [503, { error: 'not_available' }, 'server', true], [403, {}, 'server', true],
    [415, {}, 'server', true], [500, undefined, 'server', true], [200, { ok: true, stav: 'neznamy' }, 'server', true], [200, { stav: 'odoslane' }, 'server', true],
    [400, { error: 'neplatny' }, 'neplatny', false], ['siet', null, 'siet', true], ['cas', null, 'siet', true]];
  for (const [status, data, stav, tlacidlo] of pripady) {
    const st = pripravStranku('#k=' + KLUC + '&j=sk');
    st.tlacidlo.vyvolaj('click'); await flush();
    if (status === 'siet') st.s.volania[0].zlyhaj(); else if (status === 'cas') st.cas.vyprs(); else st.s.volania[0].odpovedz(status, data);
    await flush();
    assert.equal(st.k.getAttribute('data-stav'), stav, String(status) + ' ' + stav);
    const sprava = stav === 'odosiela' ? J.TEXTY_POTVRDENIE.sk.odosielaSa : J.TEXTY_POTVRDENIE.sk[stav];
    const el = ['uz_odoslane', 'odosiela'].includes(stav) ? st.ok : st.zle;
    assert.equal(el.hidden, false, stav); assert.equal(el.textContent, sprava, stav);
    assert.equal(st.tlacidlo.hidden, !tlacidlo, stav);
    if (tlacidlo) { assert.equal(st.tlacidlo.disabled, false); assert.equal(st.tlacidlo.textContent, J.TEXTY_POTVRDENIE.sk.tlacidlo); }
    assert.equal(st.udalosti.length, 0, 'meria sa len odoslané');
    if (stav === 'uz_odoslane') assert.equal(st.spat.querySelector('a').href, '/efaktura/');
  }
  // po chybe mail sa dá skúsiť znova a druhý pokus pošle nový dopyt
  const st = pripravStranku('#k=' + KLUC + '&j=sk');
  st.tlacidlo.vyvolaj('click'); await flush(); st.s.volania[0].odpovedz(502, { error: 'mail' }); await flush();
  st.tlacidlo.vyvolaj('click'); await flush();
  assert.equal(st.s.volania.length, 2);
});

test('stránka potvrdenia: CSP, noindex, no-referrer, Umami bez hash a query až za potvrdit.js, hash načítavača sedí', () => {
  const csp = STRANKA.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)[1];
  assert.match(csp, /connect-src 'self' https:\/\/feed-monitor\.arling\.workers\.dev https:\/\/api\.arling\.workers\.dev;/);
  for (const d of ["default-src 'self'", "form-action 'none'", "object-src 'none'", "base-uri 'none'", "style-src 'self'"]) assert.ok(csp.includes(d), d);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  const inline = [...STRANKA.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)].map((m) => m[2]);
  assert.equal(inline.length, 1);
  assert.ok(csp.includes(`'sha256-${createHash('sha256').update(inline[0], 'utf8').digest('base64')}'`), 'hash vloženého načítavača');
  assert.doesNotMatch(STRANKA, /\sstyle="/);
  assert.ok(STRANKA.includes('<meta name="robots" content="noindex, nofollow">'));
  assert.ok(STRANKA.includes('<meta name="referrer" content="no-referrer">'));
  const umami = STRANKA.match(/<script[^>]*api\.arling\.workers\.dev\/script\.js[^>]*>/)[0];
  assert.match(umami, /data-exclude-search="true"/); assert.match(umami, /data-exclude-hash="true"/);
  const iP = STRANKA.indexOf('src="/vysledok/potvrdit/potvrdit.js'), iU = STRANKA.indexOf('api.arling.workers.dev/script.js');
  assert.ok(iP > 0 && iP < iU, 'potvrdit.js pred Umami');
  assert.match(STRANKA, /<script type="text\/plain" data-odlozene="module" src="\/vysledok\/potvrdit\/potvrdit\.js\?v=\d+"><\/script>/);
  assert.match(STRANKA, /<button type="button" class="btn btn-solid" data-vys-tlacidlo data-t="tlacidlo" hidden>/, 'bez JavaScriptu tlačidlo nie je');
  assert.doesNotMatch(STRANKA, /<form\b/);
});

test('verzie importov: modul aj stránka dovážajú jadro s tou istou ?v= (jedna kópia v prehliadači)', () => {
  const v = (f) => citaj(join(TU, f)).match(/vysledok-jadro\.mjs\?v=(\d+)/)[1];
  assert.equal(v('vysledok-email.js'), v('potvrdit/potvrdit.js'));
  assert.equal(citaj(join(TU, 'vysledok-email.js')).match(/VERZIA_CSS = '(\d+)'/)[1], STRANKA.match(/vysledok-email\.css\?v=(\d+)/)[1]);
});

test('CSS: papierová linka bez karty, ciele 44 px, celá šírka na úzkej obrazovke, tlač skrytá, znížený pohyb, tmavý aj svetlý vzhľad z premenných', () => {
  const css = citaj(join(TU, 'vysledok-email.css'));
  assert.match(css, /\.vys-email\{[^}]*border-top:1px solid var\(--line/);
  assert.doesNotMatch(css.match(/\.vys-email\{[^}]*\}/)[0], /background|box-shadow|border-radius/);
  assert.match(css, /\.vys-email \.vys-pole\{[^}]*min-height:48px/);
  assert.match(css, /\.vys-email \.vys-tlacidlo\{[^}]*min-height:48px/);
  assert.match(css, /\.vys-email \.vys-zmenit\{[^}]*min-height:44px/);
  assert.match(css, /@media \(max-width:600px\)\{[^@]*\.vys-tlacidlo\{display:flex;width:100%\}/);
  assert.match(css, /@media print\{\.vys-email\{display:none !important\}\}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(css, /body\.noc \.vys-email \.vys-pole\{/);
  // kontrast textov chyby a obrysu poľa v oboch vzhľadoch (WCAG 1.4.3 a 1.4.11)
  const L = (hex) => { const c = hex.match(/\w\w/g).map((x) => parseInt(x, 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const k = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  assert.ok(k('b23a1d', 'faf9f5') >= 4.5, 'chyba na papieri');
  assert.ok(k('ffb59d', '0a0908') >= 4.5, 'chyba na tmavom');
  assert.ok(k('858078', 'faf9f5') >= 3, 'obrys poľa na papieri');
  assert.ok(k('5e5d59', 'faf9f5') >= 4.5 && k('8d8884', '0a0908') >= 4.5, 'drobné písmo v oboch vzhľadoch');
});

test('potvrdit.js: predvolené track dostáva adresu stránky (poistka ?test) a nepadne', () => {
  assert.equal(typeof povodnyTrackPotvrdenia, 'function');
  assert.doesNotThrow(() => povodnyTrackPotvrdenia('x', {}, { search: '' }));
});

// ── O1 (oprava po overení V1 až V4, ops/druhy-ucet/205/stavba/O1-oprava.md); každý test bez opravy zlyhá ──

test('O1 V1 N1 / V3 V3: kódy XRechnung s malou príponou (BR-DE-23-a) prejdú jadrom v oficiálnom zápise; veľké písmeno na konci nie', () => {
  const z = J.zhrnutie('efaktura', { ...VYSLEDKY.efaktura, pravidla: ['BR-DE-23-a', 'BR-DE-25-b', 'BR-DE-CVD-06-a', 'BR-CO-10', 'BR-DE-23-ab', 'br-de-23-a'].map((kod) => ({ kod, zavaznost: 'chyba', pocet: 1 })) });
  assert.deepEqual(z.pravidla.map((p) => p.kod), ['BR-DE-23-a', 'BR-DE-25-b', 'BR-DE-CVD-06-a', 'BR-CO-10']);
});

test('O1 V1 N3 / V3 V2 / V4-3: adresy, ktoré mailer alebo SMTP odmietne, sú chyba už v prehliadači (žiadny dopyt; O3a: znaky pred @ veta tvar)', async () => {
  for (const zla of ['jožo@firma.sk', "o'neil@firma.de", 'info@kvetinárstvo.sk', 'a@b.c', 'x&y@firma.sk', 'a,b@example.org', 'a@x..com', '.a@x.com', 'a.@x.com', 'a..b@x.com', 'a@-x.com', 'a@x-.com'])
    assert.equal(J.normalizujEmail(zla), null, zla);
  for (const ok of ['a.b+tag@sub.firma-x.sk', 'A_B%c@Example.ORG']) assert.ok(J.normalizujEmail(ok), ok);
  const { s, miesto } = pripravBlok();
  B.ukaz(miesto, { nastroj: 'sepa', jazyk: 'sk', vysledok: VYSLEDKY.sepa });
  const c = odosli(miesto, "o'neil@firma.sk"); await flush();
  assert.equal(s.volania.length, 0);
  assert.equal(c.chyba.textContent, J.TEXTY.sk.chyby.tvar);
});

test('O1 V3 V4: chyba limit hovorí aj o limite adresy (o hodinu, alebo zajtra), vo všetkých jazykoch', () => {
  const kde = { sk: 'zajtra', en: 'tomorrow', de: 'morgen', cs: 'zítra' };
  for (const j of J.JAZYKY_STRANKY) {
    assert.ok(J.TEXTY[j].chyby.limit.includes(kde[j]), j);
    assert.equal(J.TEXTY[j].chyby.limit, BLOKY[`vysledok-v1/${j}/chyba-limit`], j);
  }
});

test('O1 O2 R1: veta súhlasu nesľubuje zmazanie adresy; texty po odoslaní hovoria o databáze nástroja', () => {
  for (const j of J.JAZYKY_STRANKY) {
    assert.doesNotMatch(J.TEXTY[j].suhlas, /zmaže|deleted|gelöscht|smaže/, j);
    assert.match(J.TEXTY_POTVRDENIE[j].odoslane, /databáz|database|Datenbank/, j);
    assert.doesNotMatch(J.TEXTY_POTVRDENIE[j].text, /zmažeme|delete|löschen|smažeme/, j);
  }
});

test('O1 V4-1: odpoveď 503 strop na potvrdenie je vlastný stav s vetou, tlačidlo ostane (nie je konečný)', () => {
  assert.deepEqual(J.stavPotvrdenia(503, { error: 'strop' }), { stav: 'strop', nastroj: null });
  assert.deepEqual(J.stavPotvrdenia(503, { error: 'not_available' }), { stav: 'server', nastroj: null });
  assert.ok(!J.KONECNE_STAVY.includes('strop'));
  for (const j of J.JAZYKY_STRANKY) assert.equal(J.textStavu(J.TEXTY_POTVRDENIE[j], 'strop'), BLOKY[`vysledok-v1/${j}/potvrdit-strop`], j);
});

test('K1-6: pri strope stránka potvrdenia hovorí, že odkaz platí 7 dní od žiadosti (platnosť sa ráta od žiadosti, nie od dnešného pokusu), 4 jazyky', () => {
  const od = { sk: 'odkaz platí 7 dní od žiadosti.', en: 'the link works for 7 days from your request.', de: 'der Link gilt 7 Tage ab der Anfrage.', cs: 'odkaz platí 7 dní od žádosti.' };
  for (const j of J.JAZYKY_STRANKY) {
    assert.ok(J.TEXTY_POTVRDENIE[j].strop.endsWith(od[j]), `${j}: ${J.TEXTY_POTVRDENIE[j].strop}`);
    assert.equal(J.TEXTY_POTVRDENIE[j].strop, BLOKY[`vysledok-v1/${j}/potvrdit-strop`], j);
  }
});

test('K1-7: zásady SK, EN, DE v odseku o upozorneniach na FAQ menujú aj tlačidlo pod výsledkom kontroly e-faktúry (EN a DE: na slovenskej stránke)', async () => {
  const { TEXTY_FAQ } = await import('../efaktura/vysledok-blok.mjs');
  const ZASADY = [
    ['index.html', '<p><b>Upozornenia na nové verzie FAQ k e-faktúre.</b>', `„${TEXTY_FAQ.tlacidlo}“`, 'pod výsledkom kontroly e-faktúry na /efaktura/', 'v bloku „Poslať si výsledok e-mailom“'],
    ['en/index.html', '<p><b>Alerts on new versions of the e-invoice FAQ.</b>', `"${TEXTY_FAQ.tlacidlo}"`, 'on the Slovak page /efaktura/', 'the address you entered in the block for e-mailing the result'],
    ['de/index.html', '<p><b>Hinweise auf neue Fassungen der FAQ zur E-Rechnung.</b>', `„${TEXTY_FAQ.tlacidlo}“`, 'auf der slowakischen Seite /efaktura/', 'die Adresse, die Sie im Block für das Ergebnis per E-Mail eingegeben haben'],
  ];
  for (const [subor, zaciatok, ...vety] of ZASADY) {
    const html = citaj(join(TU, '..', 'privacy', subor));
    const i = html.indexOf(zaciatok);
    assert.ok(i > 0, subor);
    const odsek = html.slice(i, html.indexOf('</p>', i));
    for (const v of vety) assert.ok(odsek.includes(v), `${subor}: ${v}`);
  }
  // Voľba je len na slovenskej stránke e-faktúry (app.js ponukniFaq: LANG sk a #faq-odber).
  for (const j of ['en', 'de', 'cs']) assert.ok(!citaj(join(TU, '..', 'efaktura', j, 'index.html')).includes('id="faq-odber"'), j);
});

test('O1 V2 V1: základné pravidlo bloku má aspoň dve triedy a prvok (section.vys-email.vys-email), aj v úzkom zobrazení', () => {
  const css = citaj(join(TU, 'vysledok-email.css'));
  const spec = (sel) => [(sel.match(/#[\w-]+/g) || []).length, (sel.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length, (sel.match(/(^|[\s>+~])[a-z]+/g) || []).length];
  const vacsia = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  const zaklad = css.match(/(^|\})\s*(?:\/\*[\s\S]*?\*\/\s*)*([^{}]*\.vys-email[^{}]*)\{[^}]*border-top:1px solid/)[2].trim();
  assert.equal(zaklad, 'section.vys-email.vys-email');
  // Pravidlá stránok, ktoré V2 namerala: body.noc section (paper.css) a body.efv4 main section (e-faktúra).
  for (const cudzie of ['body.noc section', 'body.efv4 main section']) assert.ok(vacsia(spec(zaklad), spec(cudzie)) > 0, cudzie);
  assert.match(css, /@media \(max-width:600px\)\{\s*section\.vys-email\.vys-email\{margin-top:32px;padding-top:28px\}/);
  // V2 D3: pod zoznamom opráv kontroly e-shopu bez druhej linky; pravidlo musí vyhrať nad základným aj v úzkom zobrazení.
  const d3 = '.ar-page .ar-list + .ar-vysledok-miesto .vys-email';
  assert.ok(css.includes(d3 + '{border-top:0;margin-top:0}'));
  assert.ok(vacsia(spec(d3), spec(zaklad)) > 0);
});

test('O2 snímky: blok má spodný okraj aspoň 24 px, aby sa nasledujúci obsah nástroja nelepil na riadok správcu (ani v úzkom zobrazení, ani pod zoznamom opráv)', () => {
  const css = citaj(join(TU, 'vysledok-email.css'));
  const zaklad = css.match(/section\.vys-email\.vys-email\{([^}]*border-top:1px solid[^}]*)\}/)[1];
  const margin = zaklad.match(/(?:^|;)\s*margin:([^;]+)/)[1].trim().split(/\s+/);
  const spodok = parseFloat(margin.length >= 3 ? margin[2] : margin[0]);
  assert.ok(spodok >= 24, `margin ${margin.join(' ')}`);
  // Žiadne iné pravidlo bloku spodný okraj nezruší (úzke zobrazenie, pravidlo D3 pod zoznamom opráv).
  for (const m of css.matchAll(/([^{}]*\.vys-email)\{([^}]*)\}/g)) {
    if (m[2].includes('border-top:1px solid')) continue;
    assert.doesNotMatch(m[2], /margin(-bottom)?:\s*0(px)?\s*(;|$)|margin:\s*\S+\s+\S+\s+0/, m[1].trim());
  }
});

test('O1 V2 D8: okraj poľa a tlačidla na tmavom má kontrast aspoň 3 : 1 (WCAG 1.4.11)', () => {
  const css = citaj(join(TU, 'vysledok-email.css'));
  const pole = css.match(/body\.noc \.vys-email \.vys-pole\{[^}]*border-color:var\(--linka-3,rgba\(255,255,255,\.(\d+)\)\)/);
  const tl = css.match(/body\.noc \.vys-email \.vys-tlacidlo\{[^}]*border-color:var\(--linka-3,rgba\(255,255,255,\.(\d+)\)\)/);
  assert.ok(pole && tl, 'okraj z --linka-3');
  const a = Number('0.' + pole[1]);
  const kanal = Math.round(a * 255 + (1 - a) * 10);
  const L = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  const k = (L(kanal) + 0.05) / (0.2126 * L(10) + 0.7152 * L(9) + 0.0722 * L(8) + 0.05);
  assert.ok(k >= 3, `kontrast ${k.toFixed(2)}`);
});

test('O1 V2 V3 / K1-1: kým nepríde CSS (load alebo error, najviac 3 s), sekcia drží miesto (nie display none) a je neviditeľná; staršie zobrazenie sa neodkryje', async () => {
  const { miesto, doc, cas } = pripravBlok();
  assert.equal(cas.c.length, 0, 'poistka CSS nepoužíva časovač odosielania');
  B.ukaz(miesto, { nastroj: 'sepa', jazyk: 'en', vysledok: VYSLEDKY.sepa });
  const link = doc.querySelector('link[data-vysledok-css]');
  assert.equal(link.sheet, undefined, 'link bez sheet (CSS ešte nepríšlo)');
  const prva = miesto.querySelector('section');
  assert.equal(miesto.hidden, false, 'miesto sa ukáže (rozhranie bez zmeny)');
  // K1-1: hidden (display none) by malo výšku 0 a po príchode CSS by obsah pod blokom poskočil o celú výšku bloku.
  assert.equal(prva.hidden, false, 'sekcia drží miesto (nie hidden, teda nie display none)');
  assert.equal(prva.style.visibility, 'hidden', 'sekcia bez CSS neviditeľná');
  assert.equal(prva.style.display, undefined, 'žiadne display none pri čakaní');
  // Nové zobrazenie pred príchodom CSS: staré sa už neodkryje, nové áno.
  B.ukaz(miesto, { nastroj: 'sepa', jazyk: 'en', vysledok: VYSLEDKY.sepa });
  const druha = miesto.querySelector('section');
  assert.equal(druha.hidden, false);
  assert.equal(druha.style.visibility, 'hidden');
  link.vyvolaj('load');
  assert.equal(druha.style.visibility, '', 'po load viditeľná');
  assert.equal(prva.style.visibility, 'hidden', 'staršia sekcia ostala neviditeľná');
  assert.equal(link.getAttribute('data-vysledok-css'), 'hotovo');
  // CSS už je: ďalšie zobrazenie hneď viditeľné.
  B.ukaz(miesto, { nastroj: 'sepa', jazyk: 'en', vysledok: VYSLEDKY.sepa });
  assert.equal(miesto.querySelector('section').style.visibility, undefined);
  assert.equal(miesto.querySelector('section').hidden, false);
  // Bez udalosti load ani error odkryje sekciu časovač (3 s); error tiež.
  const iny = pripravBlok();
  B.ukaz(iny.miesto, { nastroj: 'sepa', jazyk: 'sk', vysledok: VYSLEDKY.sepa });
  assert.equal(iny.miesto.querySelector('section').style.visibility, 'hidden');
  assert.equal(iny.miesto.querySelector('section').hidden, false);
  assert.ok(iny.cssCas.c.some((x) => x.ms === 3000));
  iny.cssCas.vyprs();
  assert.equal(iny.miesto.querySelector('section').style.visibility, '');
  const treti = pripravBlok();
  B.ukaz(treti.miesto, { nastroj: 'efaktura', jazyk: 'de', vysledok: VYSLEDKY.efaktura });
  treti.doc.querySelector('link[data-vysledok-css]').vyvolaj('error');
  assert.equal(treti.miesto.querySelector('section').style.visibility, '', 'po error viditeľná (bez CSS radšej obsah ako nič)');
  void cas;
});

test('K1-1: modul pri načítaní pripojí CSS bloku raz (aj druhá kópia modulu a ukaz už link nepridajú)', async () => {
  const povodny = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const doc = new Dok();
  try {
    globalThis.document = doc;
    const M = await import('./vysledok-email.js?k1-1=nacitanie');
    const linky = doc.querySelectorAll('link[data-vysledok-css]');
    assert.equal(linky.length, 1, 'po importe modulu je link na CSS v hlavičke');
    assert.equal(linky[0].parentNode, doc.head);
    assert.equal(linky[0].rel, 'stylesheet');
    assert.match(linky[0].href, /\/vysledok\/vysledok-email\.css\?v=\d+$/);
    await import('./vysledok-email.js?k1-1=druha-kopia');
    const miesto = doc.createElement('div'); doc.body.append(miesto);
    Object.assign(M.deps, { track: () => {}, casovacCss: () => 0 });
    assert.equal(M.ukaz(miesto, { nastroj: 'sepa', jazyk: 'sk', vysledok: VYSLEDKY.sepa }), true);
    assert.equal(doc.querySelectorAll('link[data-vysledok-css]').length, 1, 'CSS raz');
    // CSS už prišlo (load pri načítaní modulu): blok je hneď viditeľný.
    linky[0].vyvolaj('load');
    M.ukaz(miesto, { nastroj: 'sepa', jazyk: 'sk', vysledok: VYSLEDKY.sepa });
    assert.equal(miesto.querySelector('section').style.visibility, undefined);
  } finally {
    if (povodny) Object.defineProperty(globalThis, 'document', povodny); else delete globalThis.document;
  }
});

// ── O3a (oprava po bráne 205 pokus 1, ops/druhy-ucet/205/stavba/O3a-oprava.md); každý test bez opravy zlyhá (mutácie tam) ──

test('O3a P1 a O4 N2: zásady SK, EN, DE (#vysledok-emailom) nesľubujú mazanie kópií v Zoho do 30 dní; kópie ostávajú ako ostatná korešpondencia, zatiaľ bez pevnej lehoty, na žiadosť do 7 dní, Zoho drží zmazané e-maily ešte 30 dní ako v časti 8a; archív časť 1 to isté', () => {
  // O4 (brána 205 pokus 2, N2): „zatiaľ bez pevnej lehoty“ a lehota Zoho pre zmazané e-maily v znení časti 8a.
  const ZASADY = [
    ['index.html', 'Kópie oboch e-mailov ostávajú v odoslanej pošte našej e-mailovej schránky v Zoho Mail ako ostatná naša korešpondencia, zatiaľ bez pevnej lehoty; na žiadosť na podpora@arling.sk ich vymažeme do 7 dní (zmazané e-maily ostávajú na serveroch Zoho Mail ešte 30 dní po zmazaní z koša, časť 8a).',
      'zmazané e-maily na serveroch Zoho Mail (ešte 30 dní po zmazaní z koša)'],
    ['en/index.html', 'Copies of both e-mails stay in the sent folder of our mailbox at Zoho Mail like the rest of our correspondence, for now without a fixed period; on request to support@arling.sk we delete them within 7 days (deleted e-mails stay on Zoho Mail\'s servers for another 30 days after deletion from the trash, section 8a).',
      'deleted e-mails on Zoho Mail\'s servers (another 30 days after deletion from the trash)'],
    ['de/index.html', 'Kopien beider E-Mails bleiben im Ordner Gesendet unseres Postfachs bei Zoho Mail wie unsere übrige Korrespondenz, vorerst ohne feste Frist; auf Anfrage an support@arling.sk löschen wir sie innerhalb von 7 Tagen (gelöschte E-Mails bleiben auf den Servern von Zoho Mail noch 30 Tage nach dem Löschen aus dem Papierkorb, Abschnitt 8a).',
      'gelöschte E-Mails auf den Servern von Zoho Mail (noch 30 Tage nach dem Löschen aus dem Papierkorb)'],
  ];
  for (const [subor, veta, cast8a] of ZASADY) {
    const html = citaj(join(TU, '..', 'privacy', subor));
    const i = html.indexOf('<p id="vysledok-emailom">');
    assert.ok(i > 0, subor);
    // odsek s id a za ním odsek „Ako to ide a ako dlho“: dva odseky časti 3 o výsledku e-mailom
    const cast = html.slice(i, html.indexOf('</p>', html.indexOf('</p>', i) + 4));
    assert.ok(cast.includes(veta), `${subor}: ${veta}`);
    assert.doesNotMatch(cast, /30 dňoch od odoslania|30 days after sending|30 Tage nach dem Versand/, subor);
    // Časť 8a hovorí o lehote Zoho to isté (časť 3 na ňu odkazuje, rozchod by bol nová nepravda).
    const s8a = html.slice(html.indexOf('id="s8a"'), html.indexOf('id="s8b"'));
    assert.ok(s8a.includes(cast8a), `${subor}: časť 8a: ${cast8a}`);
  }
  const cast1 = ARCHIV.slice(ARCHIV.indexOf('## 1. '), ARCHIV.indexOf('## 2. '));
  assert.ok(cast1.includes('na žiadosť na podpora@arling.sk ich vymažeme do 7 dní'), 'archív časť 1');
  assert.ok(cast1.includes('ako ostatná naša korešpondencia, zatiaľ bez pevnej lehoty'), 'archív časť 1: bez pevnej lehoty');
  assert.ok(cast1.includes('zmazané e-maily ostávajú na serveroch Zoho Mail ešte 30 dní po zmazaní z koša, zásady časť 8a'), 'archív časť 1: lehota Zoho');
  assert.doesNotMatch(cast1, /mažú sa najneskôr po 30 dňoch/, 'archív časť 1');
});

test('O3a O3: obnovená stránka bez kľúča má vlastnú vetu v jazyku odkazu (jazyk ostane vo fragmente pri en, de, cs), bez tlačidla, zoznamu a dopytu; neplatný odkaz hovorí o poslednom odkaze', async () => {
  const druha = { sk: 'Ak ste o e-mail požiadali viackrát, platí len posledný odkaz.', en: 'If you asked for the email more than once, only the latest link works.',
    de: 'Wenn Sie die E-Mail mehrmals angefordert haben, gilt nur der letzte Link.', cs: 'Pokud jste o e-mail požádali víckrát, platí jen poslední odkaz.' };
  const zaciatok = { sk: 'Otvorte odkaz z e-mailu ešte raz. ', en: 'Open the link from the email again. ', de: 'Öffnen Sie den Link aus der E-Mail noch einmal. ', cs: 'Otevřete odkaz z e-mailu ještě jednou. ' };
  for (const j of J.JAZYKY_STRANKY) {
    const p = J.TEXTY_POTVRDENIE[j];
    assert.equal(p.neplatny.split('. ')[1] + '.', druha[j], j + ': druhá veta neplatného odkazu');
    assert.ok(p.bez_kluca.startsWith(zaciatok[j]) && p.bez_kluca.includes(druha[j].slice(0, -1)), j + ': ' + p.bez_kluca);
    assert.doesNotMatch(p.bez_kluca, /neplatí|vypršal|vypršel|not valid|expired|ungültig|abgelaufen/, j);
    // 1. odkaz z e-mailu: kľúč zmizne z adresy, pri en, de, cs ostane #j=
    const prva = pripravStranku('#k=' + KLUC + '&j=' + j);
    const nova = prva.historia[0];
    assert.equal(nova, '/vysledok/potvrdit/' + (j === 'sk' ? '' : '#j=' + j), j);
    assert.equal(prva.k.getAttribute('data-stav'), 'caka');
    // 2. obnovenie: prehliadač otvorí adresu, ktorá ostala (bez kľúča)
    const st = pripravStranku(nova.includes('#') ? nova.slice(nova.indexOf('#')) : '');
    await flush();
    assert.equal(st.k.getAttribute('data-stav'), 'bez_kluca', j);
    assert.equal(st.doc.documentElement.lang, j);
    assert.equal(st.zle.hidden, false); assert.equal(st.zle.textContent, p.bez_kluca, j);
    assert.equal(st.tlacidlo.hidden, true); assert.equal(st.text.hidden, true); assert.equal(st.nastroje.hidden, true); assert.equal(st.spat.hidden, true);
    assert.equal(st.s.volania.length, 0); assert.equal(st.udalosti.length, 0);
  }
  const bez = pripravStranku('');
  assert.equal(bez.k.getAttribute('data-stav'), 'bez_kluca'); assert.equal(bez.zle.textContent, J.TEXTY_POTVRDENIE.sk.bez_kluca);
  assert.deepEqual(bez.historia, [], 'adresa bez fragmentu sa nemení');
  assert.equal(J.maKluc(''), false); assert.equal(J.maKluc('#j=de'), false); assert.equal(J.maKluc('#kk=1&j=de'), false);
  assert.equal(J.maKluc('#k=zly'), true); assert.equal(J.maKluc('#j=de&k='), true);
  assert.deepEqual(['sk', 'en', 'de', 'cs', 'hu', ''].map(J.fragmentJazyka), ['', '#j=en', '#j=de', '#j=cs', '', '']);
});

test('O3a O4: po stave odoslane a uz_odoslane má stránka nadpis „Výsledok je na ceste“ (4 jazyky); pri odosiela, chybe e-mailu a neplatnom odkaze ostáva pôvodný', async () => {
  const cakane = { sk: 'Výsledok je na ceste', en: 'Your result is on its way', de: 'Ihr Ergebnis ist unterwegs', cs: 'Výsledek je na cestě' };
  for (const j of J.JAZYKY_STRANKY) {
    assert.equal(J.TEXTY_POTVRDENIE[j].nadpisHotovo, cakane[j], j);
    for (const [status, data, stav, hotovo] of [[200, { ok: true, stav: 'odoslane', nastroj: 'sepa' }, 'odoslane', true], [200, { ok: true, stav: 'uz_odoslane', nastroj: 'efaktura' }, 'uz_odoslane', true],
      [200, { ok: true, stav: 'odosiela' }, 'odosiela', false], [502, { error: 'mail' }, 'mail', false], [400, { error: 'neplatny' }, 'neplatny', false]]) {
      const st = pripravStranku('#k=' + KLUC + '&j=' + j);
      const h1 = st.k.querySelector('h1');
      assert.equal(h1.textContent, J.TEXTY_POTVRDENIE[j].nadpis, j);
      st.tlacidlo.vyvolaj('click'); await flush();
      st.s.volania[0].odpovedz(status, data); await flush();
      assert.equal(st.k.getAttribute('data-stav'), stav, j + ' ' + stav);
      assert.equal(h1.textContent, hotovo ? cakane[j] : J.TEXTY_POTVRDENIE[j].nadpis, j + ' ' + stav);
      assert.equal(st.doc.title, J.TEXTY_POTVRDENIE[j].titul, 'titul záložky sa nemení');
    }
  }
});

test('O3a O5: odseky bloku a stránky potvrdenia majú text-wrap pretty; nemecký kicker a veta súhlasu majú E-Mail so spojovačom slov (U+2060), nikde U+2011', () => {
  const css = citaj(join(TU, 'vysledok-email.css'));
  const pravidlo = (sel) => { const i = css.indexOf(sel + '{'); assert.ok(i >= 0, sel); return css.slice(i, css.indexOf('}', i)); };
  assert.match(pravidlo('.vys-email p.vys-text,.vys-email p.vys-oddelenie,.vys-email p.vys-drobne,.vys-email p.vys-chyba,.vys-email p.vys-suhlas,.vys-email p.vys-spravca'), /text-wrap:pretty/);
  assert.match(pravidlo('.vys-potvrdit p'), /text-wrap:pretty/);
  const WJ = String.fromCharCode(0x2060), NB = String.fromCharCode(0x2011);
  assert.equal(J.WJ, WJ);
  assert.ok(J.TEXTY.de.suhlas.includes('in einer E-' + WJ + 'Mail.'), 'veta súhlasu');
  assert.equal(J.TEXTY_POTVRDENIE.de.kicker, 'Ergebnis der Prüfung per E-' + WJ + 'Mail', 'kicker');
  // viditeľný text je ten istý ako pred O3a (spojovač slov je neviditeľný)
  assert.equal(J.TEXTY.de.suhlas.replace(WJ, ''), 'Senden Sie mir dieses Ergebnis in einer E-Mail. Zuerst kommt ein Bestätigungslink. Sonst nichts.');
  for (const [k, v] of Object.entries(BLOKY)) assert.ok(!v.includes(NB), k);
  assert.deepEqual(Object.entries(BLOKY).filter(([, v]) => v.includes(WJ)).map(([k]) => k).sort(), ['vysledok-v1/de/potvrdit-kicker', 'vysledok-v1/de/veta']);
});

test('O3a O7: adresa s tvarom e-mailu, ale so znakmi pred @, ktoré mailer neprijme, dostane vetu tvar s hranicou; bežný preklep ostáva zla; Umami dôvod zla', async () => {
  for (const a of ['jožo@firma.sk', "o'neil@firma.de", 'x&y@firma.sk', 'a,b@example.org', 'Ľubo@Firma.SK', 'иван@firma.sk', ' šárka@firma.cz ', 'jožo@kvetinárstvo.sk'])
    assert.equal(J.chybaAdresy(a), 'tvar', a);
  for (const a of ['', 'ja', 'ja@firma', 'ja firma@x.sk', 'ja@@firma.sk', 'a@b.c', '.a@x.com', 'a.@x.com', 'a..b@x.com', 'a@-x.com', 'info@kvetinárstvo.sk', 'jožo@firma', '<a@b.sk>', 'x'.repeat(250) + '@b.sk', null, 42])
    assert.equal(J.chybaAdresy(a), 'zla', String(a));
  for (const a of ['ja@firma.sk', ' Ja.Meno+x@Firma.SK ']) assert.equal(J.chybaAdresy(a), null, a);
  const hranica = { sk: 'Pred @ môžu byť len písmená bez diakritiky, číslice a znaky . _ % + -', en: 'Before the @ we accept only letters without accents, digits and . _ % + -',
    de: 'Vor dem @ sind nur Buchstaben ohne Akzente, Ziffern und . _ % + - möglich.', cs: 'Před @ mohou být jen písmena bez diakritiky, číslice a znaky . _ % + -' };
  for (const j of J.JAZYKY_STRANKY) { assert.ok(J.TEXTY[j].chyby.tvar.endsWith(hranica[j]), j); assert.notEqual(J.TEXTY[j].chyby.tvar, J.TEXTY[j].chyby.zla, j); }
  assert.equal(J.dovodChyby('tvar'), 'zla');
  for (const [adresa, kluc] of [['jožo@firma.sk', 'tvar'], ['jozo@firma', 'zla']]) {
    const { s, miesto, udalosti } = pripravBlok();
    B.ukaz(miesto, { nastroj: 'efaktura', jazyk: 'cs', vysledok: VYSLEDKY.efaktura });
    const c = odosli(miesto, adresa); await flush();
    assert.equal(s.volania.length, 0, adresa);
    assert.equal(c.chyba.hidden, false); assert.equal(c.chyba.textContent, J.TEXTY.cs.chyby[kluc], adresa);
    assert.equal(c.pole.getAttribute('aria-invalid'), 'true');
    assert.deepEqual(udalosti.at(-1), ['odber_vysledok_chyba', { nastroj: 'efaktura', dovod: 'zla' }], adresa);
    assert.equal(c.pole.value, adresa, 'adresa ostáva v poli (R78)');
  }
});

test('O3a O8: úvodná veta bloku pri výsledku bez nálezov nesľubuje postup opravy ani zoznam nálezov (tri nástroje, všetky jazyky); s nálezmi pôvodná', () => {
  const ar = VYSLEDKY['agent-ready'], ef = VYSLEDKY.efaktura, se = VYSLEDKY.sepa;
  const pripady = [
    ['agent-ready', { ...ar, pravidla: [], eu: [{ kod: 'eu_withdrawal', stav: 'found' }, { kod: 'eu_guarantee_notice', stav: 'not_applicable' }, { kod: 'eu_green_claims', stav: 'link_found' }] }, true],
    ['agent-ready', { ...ar, pravidla: [], eu: [] }, true],
    ['agent-ready', { ...ar, pravidla: [], eu: [{ kod: 'eu_withdrawal', stav: 'not_found' }] }, false],
    ['agent-ready', { ...ar, pravidla: [], eu: [{ kod: 'eu_green_claims', stav: 'unknown' }] }, false],
    ['agent-ready', ar, false],
    ['efaktura', { ...ef, chyby: 0, varovania: 0, informacie: 3, pravidla: [{ kod: 'BR-CO-10', zavaznost: 'informacia', pocet: 3 }] }, true],
    ['efaktura', { ...ef, typ: 'CII', chyby: 0, varovania: 0, pravidla: [] }, true],
    ['efaktura', { ...ef, typ: 'CII' }, true],
    ['efaktura', { ...ef, chyby: 0, varovania: 1 }, false],
    ['efaktura', ef, false],
    ['sepa', { ...se, stav: 'pass', nalezy: [] }, true],
    ['sepa', { ...se, stav: 'warn' }, false],
    ['sepa', se, false],
  ];
  for (const [n, v, cisty] of pripady) {
    const z = J.zhrnutie(n, v);
    assert.ok(z, n);
    assert.equal(J.bezNalezov(n, z), cisty, n + ' ' + JSON.stringify(v));
    for (const j of J.JAZYKY[n]) {
      const t = J.TEXTY[j], ocak = cisty ? t.uvodBezNalezov : n === 'sepa' ? t.uvodNalezy : t.uvodOprava;
      const { miesto } = pripravBlok();
      assert.equal(B.ukaz(miesto, { nastroj: n, jazyk: j, vysledok: v }), true);
      assert.equal(miesto.querySelector('p.vys-text').textContent, ocak, n + ' ' + j + ' ' + cisty);
    }
  }
  const bez = { sk: 'Výsledok neukladáme, po zatvorení stránky zmizne. Pošleme vám ho e-mailom.', en: 'We do not store the result; it disappears when you close the page. We can email it to you.',
    de: 'Wir speichern das Ergebnis nicht, beim Schließen der Seite ist es weg. Wir senden es Ihnen per E-Mail.', cs: 'Výsledek neukládáme, po zavření stránky zmizí. Pošleme vám ho e-mailem.' };
  for (const j of J.JAZYKY_STRANKY) { assert.equal(J.TEXTY[j].uvodBezNalezov, bez[j], j); assert.doesNotMatch(J.TEXTY[j].uvodBezNalezov, /oprav|fix|Behebung|nález|findings|Befunde/, j); }
  assert.equal(J.bezNalezov('agent-ready', null), false);
  assert.equal(J.uvodPre(J.TEXTY.sk, 'efaktura'), J.TEXTY.sk.uvodOprava, 'bez zhrnutia pôvodná veta');
});
