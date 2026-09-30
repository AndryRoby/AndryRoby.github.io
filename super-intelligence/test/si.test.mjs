// Testy nástroja AI to SI (products/arling-sk/super-intelligence). Spustenie:
//   node --test products/arling-sk/super-intelligence/test/si.test.mjs
// Časti: A falošné zhody, B náhrady, C ponechané na posúdenie, D stav a výstup, E ukážka, F HTML súbory,
// G súbory, H stránka (statická kontrola index.html), I stránka v náhradnom DOM (stranka.js bez prehliadača),
// J 40 viet hodnotiteľa (brána pokus 1), K opravy po bráne pokus 1 (každý nález má test, ktorý bez opravy zlyhá),
// L šablóna obrázka na zdieľanie.
import test, { describe, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as jadro from '../jadro.js';

const { najdi, vysledok, predvolene, pocty, kusy, kluce, okolie, pocetSI, htmlNaText, navrhPre, povolenySubor,
  jeHtmlSubor, nazovVysledku, stylRiadku, DOVODY, NAZVY_DOVODOV, UKAZKA, VERZIA } = jadro;

const subor = (f) => new URL('../' + f, import.meta.url);
const citaj = (f) => readFileSync(subor(f), 'utf8').split('\r\n').join('\n');
const HTML = citaj('index.html');
const CSS = citaj('si.css');
const JS = citaj('stranka.js');
const dekoduj = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
// Text po prijatí všetkých predvolených návrhov (predvolený tvar ako na stránke: Super Intelligence).
const zmen = (t, moznosti = {}) => { const r = najdi(t, moznosti); return vysledok(t, r.nalezy, predvolene(r.nalezy), moznosti); };
const jeden = (t, moznosti) => {
  const r = najdi(t, moznosti);
  assert.equal(r.nalezy.length, 1, 'čakal som jeden nález v: ' + JSON.stringify(t) + ' ' + JSON.stringify(r.nalezy));
  return r.nalezy[0];
};
const sekcia = (zaciatok) => { const a = HTML.indexOf(zaciatok); return a < 0 ? '' : HTML.slice(a, HTML.indexOf('</section>', a)); };
const mediaBlok = (css, dotaz) => { const a = css.indexOf('@media (' + dotaz + '){'); if (a < 0) return ''; let h = 0; for (let i = css.indexOf('{', a); i < css.length; i++) { if (css[i] === '{') h++; else if (css[i] === '}' && --h === 0) return css.slice(a, i + 1); } return ''; };

// ── A. Falošné zhody ─────────────────────────────────────────────────────────
describe('A. falošné zhody sa nenájdu', () => {
  for (const slovo of ['OpenAI', 'Thai', 'Mail', 'AIDS', 'AIM', 'FAIR', 'GenAI', 'AIS', 'AI2', 'AI_model', 'ai', 'Ai Weiwei', 'N.A.I.C.S.']) {
    test(`nenájde ${slovo}`, () => {
      const t = `We reviewed ${slovo} yesterday.`;
      assert.deepEqual(najdi(t).nalezy, []);
      assert.equal(zmen(t), t);
    });
  }
});

// ── B. Náhrady ───────────────────────────────────────────────────────────────
describe('B. náhrady podľa príkazu', () => {
  test('AI na SI', () => assert.equal(zmen('Agencies use AI daily.'), 'Agencies use SI daily.'));
  test('A.I. na S.I.', () => {
    const n = jeden('The A.I. review is due.');
    assert.equal(n.druh, 'bodky');
    assert.equal(zmen('The A.I. review is due.'), 'The S.I. review is due.');
  });
  test('Artificial Intelligence na Super Intelligence bez druhej možnosti', () => {
    const n = jeden('Use of Artificial Intelligence in agencies');
    assert.equal(n.druh, 'plny');
    assert.equal(n.navrh, 'Super Intelligence');
    assert.equal(n.navrhVelke, null);
  });
  test('artificial intelligence: predvolene Super Intelligence ako v príkaze, malé písmená ako druhá voľba', () => {
    const n = jeden('We use artificial intelligence.');
    assert.equal(n.navrh, 'super intelligence');
    assert.equal(n.navrhVelke, 'Super Intelligence');
    assert.equal(navrhPre(n), 'Super Intelligence');
    assert.equal(navrhPre(n, false), 'super intelligence');
    assert.equal(zmen('We use artificial intelligence.'), 'We use Super Intelligence.');
    assert.equal(zmen('We use artificial intelligence.', { velke: false }), 'We use super intelligence.');
  });
  test('veľké písmená ostanú veľké: ARTIFICIAL INTELLIGENCE', () => {
    const n = jeden('ARTIFICIAL INTELLIGENCE POLICY');
    assert.equal(n.navrh, 'SUPER INTELLIGENCE');
    assert.equal(n.navrhVelke, null);
    assert.equal(zmen('ARTIFICIAL INTELLIGENCE POLICY'), 'SUPER INTELLIGENCE POLICY');
  });
  test('veľké písmeno na začiatku vety: Artificial intelligence', () => {
    const n = jeden('Artificial intelligence helps.');
    assert.equal(n.navrh, 'Super intelligence');
    assert.equal(n.navrhVelke, 'Super Intelligence');
    assert.equal(zmen('Artificial intelligence helps.', { velke: false }), 'Super intelligence helps.');
  });
  test('zlom riadka, pevná medzera a spojovník medzi slovami ostanú', () => {
    assert.equal(zmen('artificial\nintelligence'), 'Super\nIntelligence');
    assert.equal(zmen('artificial\nintelligence', { velke: false }), 'super\nintelligence');
    assert.equal(zmen('artificial\u{a0}intelligence', { velke: false }), 'super\u{a0}intelligence');
    assert.equal(zmen('artificial-intelligence tools', { velke: false }), 'super-intelligence tools');
  });
  test('množné číslo AIs na SIs', () => {
    const n = jeden('AIs need review.');
    assert.equal(n.text, 'AIs');
    assert.equal(n.navrh, 'SIs');
    assert.equal(n.mnozne, true);
  });
  test("privlastnenie AI's a AI’s", () => {
    assert.equal(zmen("The AI's output"), "The SI's output");
    assert.equal(zmen('The AI’s output'), 'The SI’s output');
    assert.equal(jeden("The AI's output").privlastnenie, true);
  });
  test("množné privlastnenie AIs' a A.I.’s", () => {
    assert.equal(zmen("the AIs' outputs"), "the SIs' outputs");
    assert.equal(zmen('the A.I.’s role'), 'the S.I.’s role');
  });
  test('zložené slová AI-powered a AI-driven', () => {
    const r = najdi('AI-powered and AI-driven tools');
    assert.deepEqual(r.nalezy.map((n) => [n.text, n.navrh, n.zlozene]), [['AI-powered', 'SI-powered', true], ['AI-driven', 'SI-driven', true]]);
    assert.equal(zmen('AI-powered and AI-driven tools'), 'SI-powered and SI-driven tools');
  });
  test('zložené slovo dozadu a dve AI v jednom slove', () => {
    assert.equal(zmen('non-AI staff'), 'non-SI staff');
    assert.equal(najdi('AI-to-AI messages').nalezy.length, 1);
    assert.equal(zmen('AI-to-AI messages'), 'SI-to-SI messages');
  });
  test('skratka v zátvorke: artificial intelligence (AI)', () => {
    assert.equal(zmen('artificial intelligence (AI) tools'), 'Super Intelligence (SI) tools');
    assert.equal(zmen('artificial intelligence (AI) tools', { velke: false }), 'super intelligence (SI) tools');
  });
  test('plný pojem v privlastnení, množnom čísle a zloženom slove', () => {
    assert.equal(zmen('Artificial Intelligence’s promise'), 'Super Intelligence’s promise');
    assert.equal(zmen('artificial intelligences', { velke: false }), 'super intelligences');
    assert.equal(zmen('Artificial Intelligence-enabled tools'), 'Super Intelligence-enabled tools');
  });
});

// ── C. Ponechané na posúdenie ────────────────────────────────────────────────
describe('C. ponechané na posúdenie', () => {
  const zakony = [
    ['National Artificial Intelligence Initiative Act of 2020', 'the National Artificial Intelligence Initiative Act of 2020 applies.'],
    ['Advancing American AI Act', 'Under the Advancing American AI Act, agencies report.'],
    ['EU AI Act', 'The EU AI Act applies in Europe.'],
    ['AI in Government Act of 2020', 'See the AI in Government Act of 2020 for details.'],
    ["AI Act's", "We follow the AI Act's requirements."],
    ['zalomené Act na novom riadku', 'the Advancing American AI\nAct of 2022'],
  ];
  for (const [nazov, t] of zakony) {
    test(`zákon ostane: ${nazov}`, () => {
      const n = jeden(t);
      assert.equal(n.ponechat, 'zakon');
      assert.equal(n.dovod, DOVODY.zakon);
      assert.equal(zmen(t), t);
    });
  }
  test('dôvod pri zákone je jeden riadok zo zadania, každý dôvod má názov', () => {
    assert.equal(DOVODY.zakon, 'Statute titles stay: the order covers non-statutory documents.');
    for (const [kluc, dovod] of Object.entries(DOVODY)) {
      assert.doesNotMatch(dovod, /\n/);
      assert.ok(NAZVY_DOVODOV[kluc], kluc);
    }
  });
  test('AI Action Plan nie je zákon (Action nie je Act), ale meno', () => {
    assert.equal(jeden('We follow the AI Action Plan closely.').ponechat, 'nazov');
  });
  const mena = ['Staff met the AI Safety Institute today.', 'Ask our Google AI liaison.', 'Microsoft AI tools are new.',
    'Report to the Chief AI Officer weekly.', 'We joined the Center for AI Standards and Innovation.', 'Read NIST AI 100-1 first.',
    'Pass the AI-102 exam.', 'the U.S. AI Safety Institute'];
  for (const t of mena) test(`meno ostane: ${t}`, () => assert.equal(jeden(t).ponechat, 'nazov'));
  const neMena = ['Responsible AI practices matter.', 'The AI tools work.', 'We track Federal AI use cases.', 'Google’s AI tools are new.', 'AI/ML models help.'];
  for (const t of neMena) test(`nie je meno, zmení sa: ${t}`, () => assert.equal(jeden(t).ponechat, null));
  test('nadpis v title case: veľké písmená samé nestačia, inštitúcia áno', () => {
    assert.equal(stylRiadku('Responsible AI Adoption'), 'nadpis');
    assert.equal(jeden('Responsible AI Adoption').ponechat, null);
    assert.equal(jeden('About the AI Safety Institute').ponechat, 'nazov');
    assert.equal(stylRiadku('USE OF AI IN AGENCIES'), 'kapitalky');
    assert.equal(jeden('USE OF AI IN AGENCIES').ponechat, null);
  });
  test('citát v dvojitých úvodzovkách ostane', () => {
    assert.equal(jeden('He said “AI is here.”').ponechat, 'citat');
    assert.equal(jeden('He said "AI is here".').ponechat, 'citat');
    assert.equal(jeden('Sie sagte „AI ist da“.').ponechat, 'citat');
    assert.equal(DOVODY.citat, 'Quotations stay word for word.');
  });
  test('neuzavretá úvodzovka a úvodzovka cez odsek nie sú citát', () => {
    assert.equal(jeden('He said “AI is here.\n\nNext paragraph.”').ponechat, null);
    assert.equal(jeden('A 5" screen shows AI output.').ponechat, null);
  });
  test('v CSV sú rovné úvodzovky oddeľovače, nie citát', () => {
    assert.deepEqual(najdi('"AI tools","Yes"\n"AI plan","No"').nalezy.map((n) => n.ponechat), [null, null]);
    assert.equal(jeden('"AI tools","Yes"', { csv: true }).ponechat, null);
    assert.equal(jeden('"AI tools","Yes"', { csv: false }).ponechat, 'citat');
  });
  test('webová a e-mailová adresa ostane, A.I. na konci vety nie je adresa', () => {
    assert.equal(jeden('see https://example.gov/AI/report now').ponechat, 'odkaz');
    assert.equal(jeden('Post it on AI.gov.').ponechat, 'odkaz');
    assert.equal(jeden('Write to AI@agency.gov today.').ponechat, 'odkaz');
    assert.equal(jeden('We use A.I.').ponechat, null);
    assert.equal(zmen('Post it on AI.gov.'), 'Post it on AI.gov.');
  });
});

// ── D. Stav a výstup ─────────────────────────────────────────────────────────
describe('D. stav, počty a výstup', () => {
  const r = najdi(UKAZKA);
  test('predvolene: ponechané vypnuté, ostatné zapnuté; počty 17, 8, 9', () => {
    const z = predvolene(r.nalezy);
    assert.deepEqual(z, r.nalezy.map((n) => n.ponechat === null));
    assert.deepEqual(pocty(r.nalezy, z), { najdene: 17, zmeni: 8, ponechane: 9 });
  });
  test('prepínanie: vypnutý návrh ostane pôvodný, zapnutý ponechaný sa zmení', () => {
    const t = 'Agencies use AI under the EU AI Act.';
    const q = najdi(t);
    assert.equal(vysledok(t, q.nalezy, [false, true]), 'Agencies use AI under the EU SI Act.');
    assert.equal(vysledok(t, q.nalezy, [true, false]), 'Agencies use SI under the EU AI Act.');
    assert.deepEqual(pocty(q.nalezy, [false, true]), { najdene: 2, zmeni: 1, ponechane: 1 });
  });
  test('po prijatí návrhov ostanú v texte len ponechané nálezy', () => {
    const po = vysledok(UKAZKA, r.nalezy, predvolene(r.nalezy));
    const znova = najdi(po).nalezy;
    assert.equal(znova.length, 9);
    assert.ok(znova.every((n) => n.ponechat), JSON.stringify(znova));
  });
  test('text bez nálezu ostane bez zmeny', () => {
    const t = 'The agency reviewed the budget and the travel policy.';
    const q = najdi(t);
    assert.deepEqual(q.nalezy, []);
    assert.equal(vysledok(t, q.nalezy, []), t);
    assert.deepEqual(pocty(q.nalezy, []), { najdene: 0, zmeni: 0, ponechane: 0 });
    assert.equal(q.siUz, 0);
  });
  test('prázdny text', () => {
    assert.deepEqual(najdi('').nalezy, []);
    assert.equal(vysledok('', [], []), '');
    assert.deepEqual(najdi(undefined).nalezy, []);
  });
  test('pozície sedia, nálezy sú zoradené a neprekrývajú sa', () => {
    let koniec = 0;
    for (const n of r.nalezy) {
      assert.equal(UKAZKA.slice(n.od, n.do), n.text);
      assert.ok(n.od >= koniec);
      koniec = n.do;
    }
  });
  test('kúsky zložia pôvodný text', () => {
    assert.equal(kusy(UKAZKA, r.nalezy).map((k) => UKAZKA.slice(k.od, k.do)).join(''), UKAZKA);
    assert.equal(kusy(UKAZKA, r.nalezy).filter((k) => k.n).length, 17);
  });
  test('kľúče nálezov sa po pridaní textu pred ne nezmenia', () => {
    const t = 'Use AI here. Use AI there.';
    const pred = kluce(najdi(t).nalezy), po = kluce(najdi('Intro line.\n' + t).nalezy);
    assert.deepEqual(po, pred);
    assert.notEqual(pred[0], pred[1]);
  });
  test('úryvok pri náleze: v rámci odseku, celé slová, tri bodky pri skrátení', () => {
    const n = r.nalezy.find((x) => x.ponechat === 'zakon' && x.text === 'AI');
    const o = okolie(UKAZKA, n);
    assert.equal(o.jadro, 'AI');
    assert.ok(o.pred.startsWith('…') && o.pred.endsWith('Advancing American '), o.pred);
    assert.ok(o.po.startsWith(' Act') && o.po.endsWith('…'), o.po);
    assert.doesNotMatch(o.pred + o.po, /\n/);
    const prvy = okolie('AI at the start.', najdi('AI at the start.').nalezy[0]);
    assert.deepEqual(prvy, { pred: '', jadro: 'AI', po: ' at the start.' });
  });
  test('upozornenie na SI, ktoré už v texte je', () => {
    assert.equal(pocetSI('Report in SI units, not SIs or S.I. or BASIC.'), 1);
    assert.equal(najdi('Measure AI output in SI units.').siUz, 1);
    assert.equal(najdi(UKAZKA).siUz, 0);
  });
});

// ── E. Ukážka ────────────────────────────────────────────────────────────────
describe('E. ukážka ukáže každý prípad', () => {
  const r = najdi(UKAZKA);
  test('každý druh, tvar a dôvod je v ukážke', () => {
    const druhy = new Set(r.nalezy.map((n) => n.druh));
    assert.deepEqual([...druhy].sort(), ['bodky', 'plny', 'skratka']);
    for (const vlastnost of ['mnozne', 'privlastnenie', 'zlozene']) assert.ok(r.nalezy.some((n) => n[vlastnost]), vlastnost);
    assert.ok(r.nalezy.some((n) => n.navrhVelke), 'malé artificial intelligence s voľbou');
    const dovody = {};
    for (const n of r.nalezy) if (n.ponechat) dovody[n.ponechat] = (dovody[n.ponechat] || 0) + 1;
    assert.deepEqual(dovody, { zakon: 3, nazov: 2, odkaz: 1, dokument: 1, vyznam: 1, citat: 1 });
  });
  test('falošné zhody sú v ukážke a nenájdu sa', () => {
    for (const slovo of ['OpenAI', 'GenAI', 'Thai', 'Mail', 'AIDS', 'AIM', 'FAIR']) {
      assert.ok(UKAZKA.includes(slovo), slovo);
      assert.ok(r.nalezy.every((n) => !n.text.includes(slovo)), slovo);
    }
  });
  test('výsledok ukážky mení správne miesta a zákony, skoršie dokumenty a AI/AN nechá', () => {
    const po = vysledok(UKAZKA, r.nalezy, predvolene(r.nalezy));
    for (const s of ['Using Super Intelligence in public-facing', 'use of Super Intelligence (SI) in 2027', 'Two SI-powered search tools',
      'one SI-driven translation', "Each system's S.I. risk review", 'and SIs that support', "Log the SI's output",
      'National Artificial Intelligence Initiative Act of 2020', 'Advancing American AI Act', 'the EU AI Act', 'Chief AI Officer',
      'summary on AI.gov', 'Executive Order 14110, Safe, Secure, and Trustworthy Development and Use of Artificial Intelligence,',
      'Alaska Native (AI/AN)', 'Google AI liaison', '“AI must earn', 'OpenAI products', 'HIV/AIDS and AIM']) assert.ok(po.includes(s), s);
    assert.ok(UKAZKA.startsWith('SAMPLE:'), 'ukážka je označená ako ukážka');
  });
});

// ── F. HTML súbory ───────────────────────────────────────────────────────────
describe('F. HTML na text', () => {
  test('značky, skripty a štýly preč, entity dekódované, bloky na riadky', () => {
    const t = htmlNaText('<!doctype html><html><head><title>AI plan</title><style>p{color:red}</style></head><body>'
      + '<!-- AI v komentári --><p>We use\n  AI&nbsp;tools &amp; A.I. &#8220;AI&#8221; &eacute;&scaron; if a < b</p>'
      + '<script>var AI = 1;</script><ul><li>One</li><li>Two</li></ul></body></html>');
    assert.equal(t, 'AI plan\n\nWe use AI\u{a0}tools & A.I. “AI” éš if a < b\n\nOne\n\nTwo');
  });
  test('odseky sa nezlepia do jedného slova', () => {
    const t = htmlNaText('<p>We use AI</p><p>Next step</p>');
    assert.equal(najdi(t).nalezy.length, 1);
    assert.equal(zmen(t), 'We use SI\n\nNext step');
  });
});

// ── G. Súbory ────────────────────────────────────────────────────────────────
describe('G. súbory', () => {
  test('povolené prípony, HTML a meno výsledku', () => {
    for (const f of ['a.txt', 'b.MD', 'c.markdown', 'd.html', 'e.HTM', 'f.csv']) assert.ok(povolenySubor(f), f);
    for (const f of ['a.pdf', 'b.docx', 'c', 'd.txt.exe']) assert.ok(!povolenySubor(f), f);
    assert.ok(jeHtmlSubor('memo.HTML') && !jeHtmlSubor('memo.txt'));
    assert.equal(nazovVysledku('report.html'), 'report-SI.txt');
    assert.equal(nazovVysledku('a:b?.txt'), 'a-b-SI.txt');
    assert.equal(nazovVysledku(''), 'ai-to-si-result.txt');
  });
});

// ── H. Stránka: statická kontrola index.html ─────────────────────────────────
describe('H. stránka index.html', () => {
  const ldText = (HTML.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
  const csp = (HTML.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
  test('žiadne vložené skripty okrem JSON-LD, žiadne štýly v stránke', () => {
    const vlozene = [...HTML.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].map((m) => m[1].trim());
    assert.deepEqual(vlozene, ['type="application/ld+json"']);
    assert.doesNotMatch(HTML, /\sstyle=/);
    assert.doesNotMatch(HTML, /<style[\s>]/);
    assert.doesNotMatch(HTML, /\son[a-z]+=/);
  });
  test('CSP: skripty len vlastné a hostiteľ analytiky, odtlačok JSON-LD sedí', () => {
    const src = (csp.match(/script-src ([^;]+)/) || [])[1].split(/\s+/);
    const hash = "'sha256-" + createHash('sha256').update(ldText, 'utf8').digest('base64') + "'";
    assert.deepEqual(src, ["'self'", 'https://api.arling.workers.dev', hash]);
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /connect-src 'self' https:\/\/api\.arling\.workers\.dev;/);
    assert.match(csp, /style-src 'self';/);
    assert.match(csp, /object-src 'none'/);
  });
  test('jediná cudzia požiadavka je analytický skript', () => {
    const zdroje = [...HTML.matchAll(/<script[^>]*\bsrc="([^"]+)"/g), ...HTML.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    const cudzie = zdroje.filter((s) => !s.startsWith('/'));
    assert.deepEqual(cudzie, ['https://api.arling.workers.dev/script.js']);
    assert.match(HTML, /<script defer src="https:\/\/api\.arling\.workers\.dev\/script\.js" data-website-id="be534d51-4d01-4860-b267-9596d91606de" data-domains="arling\.sk"><\/script>/);
  });
  test('SEO: title, popis, canonical, Open Graph, jazyk', () => {
    assert.match(HTML, /<html lang="en">/);
    assert.ok(HTML.includes('<title>AI to SI Checker: replace AI with Super Intelligence (free, private)</title>'));
    const popis = (HTML.match(/<meta name="description" content="([^"]+)">/) || [])[1];
    assert.ok(popis && popis.length >= 70 && popis.length <= 160, String(popis && popis.length));
    assert.ok(HTML.includes('<link rel="canonical" href="https://arling.sk/super-intelligence/">'));
    for (const vlastnost of ['og:type', 'og:title', 'og:description', 'og:url']) assert.match(HTML, new RegExp(`<meta property="${vlastnost}" content="[^"]+">`));
    assert.ok(HTML.includes('<meta property="og:url" content="https://arling.sk/super-intelligence/">'));
  });
  test('JSON-LD: SoftwareApplication zadarmo a FAQPage presne ako viditeľné otázky', () => {
    const ld = JSON.parse(ldText);
    const app = ld['@graph'].find((x) => x['@type'] === 'SoftwareApplication');
    assert.equal(app.offers.price, '0');
    assert.equal(app.url, 'https://arling.sk/super-intelligence/');
    const faq = ld['@graph'].find((x) => x['@type'] === 'FAQPage');
    const viditelne = [...sekcia('<section aria-labelledby="faq">').matchAll(/<details><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map((m) => [dekoduj(m[1]), dekoduj(m[2])]);
    assert.ok(viditelne.length >= 4 && viditelne.length <= 6, String(viditelne.length));
    assert.deepEqual(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]), viditelne);
  });
  test('pole na text obsahuje presne ukážku z jadra', () => {
    const obsah = (HTML.match(/<textarea id="text"[^>]*>([\s\S]*?)<\/textarea>/) || [])[1];
    assert.equal(dekoduj(obsah).replace(/^\n/, ''), UKAZKA);
  });
  test('analytika na tlačidlách Kopírovať a Stiahnuť', () => {
    assert.match(HTML, /<button[^>]*id="kopirovat"[^>]*data-umami-event="si_kopirovat"/);
    assert.match(HTML, /<button[^>]*id="stiahnut"[^>]*data-umami-event="si_stiahnut"/);
  });
  test('žiadne pomlčky em ani en ani neviditeľné znaky v stránke, štýle a skriptoch', () => {
    for (const f of ['index.html', 'si.css', 'stranka.js', 'jadro.js', 'og/sablona.html', 'og/sablona.css']) assert.doesNotMatch(citaj(f), /[\u{2013}\u{2014}]/u, f);
    // Ani neviditeľné znaky priamo v zdrojáku (pevná medzera, spojovníky, kombinačné znamienka): len ako \u{...}.
    for (const f of ['si.css', 'stranka.js', 'jadro.js']) assert.doesNotMatch(citaj(f), /[\u{0}-\u{8}\u{b}\u{c}\u{e}-\u{1f}\u{a0}\u{ad}\u{2002}-\u{200d}\u{2010}\u{2011}\u{2212}\u{202f}\u{300}-\u{36f}]/u, f);
  });
  test('vysvetlenie: veta o právnej rade, fakty o EÚ a zdroje', () => {
    for (const s of ['This tool does not give legal advice.', 'Regulation (EU) 2024/1689', 'Article 3(1)', '“AI system”',
      'https://www.whitehouse.gov/fact-sheets/2026/09/fact-sheet-president-donald-j-trump-inaugurates-the-era-of-super-intelligence/',
      'https://www.cnbc.com/2026/09/29/trump-ai-super-intelligence.html',
      'https://www.mlex.com/mlex/artificial-intelligence/articles/2531703/trump-signs-super-intelligence-executive-order-to-replace-ai-in-government-use']) {
      assert.ok(HTML.includes(s), s);
    }
  });
  test('každé id, na ktoré siaha skript alebo odkaz, v stránke existuje', () => {
    const idy = new Set([...HTML.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const pouzite = new Set([...JS.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]));
    for (const m of JS.matchAll(/for \(const id of \[([^\]]+)\]\)/g)) for (const x of m[1].matchAll(/'([^']+)'/g)) pouzite.add(x[1]);
    assert.ok(pouzite.size >= 25, String(pouzite.size));
    for (const id of pouzite) assert.ok(idy.has(id), 'chýba id ' + id);
    const odkazy = [...HTML.matchAll(/\s(?:for|aria-labelledby|aria-describedby)="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/));
    for (const m of HTML.matchAll(/href="#([^"]+)"/g)) odkazy.push(m[1]);
    for (const id of odkazy) assert.ok(idy.has(id), 'odkaz na chýbajúce id ' + id);
  });
  test('skript berie z jadra len to, čo jadro vyváža, a verzie súborov sedia', () => {
    const m = JS.match(/import \{([^}]+)\} from '\.\/jadro\.js\?v=([\d.]+)'/);
    assert.ok(m, 'import jadra');
    for (const meno of m[1].split(',').map((s) => s.trim()).filter(Boolean)) assert.ok(meno in jadro, meno);
    assert.equal(m[2], VERZIA);
    assert.ok(HTML.includes(`/super-intelligence/stranka.js?v=${VERZIA}"`) && HTML.includes(`/super-intelligence/si.css?v=${VERZIA}"`));
  });
  test('stranka.js a jadro.js sú syntakticky v poriadku', () => {
    for (const f of ['stranka.js', 'jadro.js']) {
      const r = spawnSync(process.execPath, ['--check', fileURLToPath(subor(f))], { encoding: 'utf8' });
      assert.equal(r.status, 0, f + ': ' + r.stderr);
    }
  });
});

// ── I. Stránka v náhradnom DOM ───────────────────────────────────────────────
// Bez prehliadača: malý náhradný DOM s tým, čo stranka.js naozaj volá. Overí tok (načítanie, prepínanie,
// voľba písmen, kopírovanie, stiahnutie, súbor, chyby), nie vzhľad. Vzhľad overí až snímka.
const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
class Textovy { constructor(t) { this.data = String(t); this.parentNode = null; } get textContent() { return this.data; } }
class Fragment { constructor() { this.childNodes = []; } append(...u) { for (const x of u) this.childNodes.push(typeof x === 'string' ? new Textovy(x) : x); } }
function zhoda(el, sel) {
  const m = /^([a-z]+)?((?:\.[\w-]+|\[[\w-]+(?:="[^"]*")?\]|:checked)*)$/i.exec(sel.trim());
  if (!m) throw new Error('náhradný DOM nepozná selektor ' + sel);
  if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
  for (const cast of m[2].match(/\.[\w-]+|\[[\w-]+(?:="[^"]*")?\]|:checked/g) || []) {
    if (cast[0] === '.') { if (!el.classList.contains(cast.slice(1))) return false; continue; }
    if (cast === ':checked') { if (!el.checked) return false; continue; }
    const [, k, v] = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(cast);
    const hodnota = k === 'type' ? el.type || el.getAttribute('type') : el.getAttribute(k);
    if (hodnota === null || hodnota === undefined) return false;
    if (v !== undefined && hodnota !== v) return false;
  }
  return true;
}
class Prvok {
  constructor(tag, dok) {
    Object.assign(this, { tagName: tag.toUpperCase(), dok, childNodes: [], parentNode: null, atributy: new Map(), posluchaci: {},
      hidden: false, disabled: false, checked: false, value: '', type: '' });
  }
  get id() { return this.getAttribute('id') || ''; }
  set id(v) { this.setAttribute('id', v); }
  get className() { return this.getAttribute('class') || ''; }
  set className(v) { this.setAttribute('class', v); }
  get classList() {
    const triedy = () => this.className.split(/\s+/).filter(Boolean);
    return {
      contains: (c) => triedy().includes(c),
      add: (c) => { if (!triedy().includes(c)) this.className = [...triedy(), c].join(' '); },
      remove: (c) => { this.className = triedy().filter((x) => x !== c).join(' '); },
    };
  }
  get dataset() {
    return new Proxy({}, {
      get: (_, k) => (typeof k === 'string' && this.atributy.has('data-' + kebab(k)) ? this.atributy.get('data-' + kebab(k)) : undefined),
      set: (_, k, v) => { this.setAttribute('data-' + kebab(k), v); return true; },
      deleteProperty: (_, k) => { this.removeAttribute('data-' + kebab(k)); return true; },
      has: (_, k) => this.atributy.has('data-' + kebab(k)),
    });
  }
  setAttribute(k, v) { this.atributy.set(k, String(v)); if (k === 'id') this.dok.zaregistruj(this); }
  getAttribute(k) { return this.atributy.has(k) ? this.atributy.get(k) : null; }
  hasAttribute(k) { return this.atributy.has(k); }
  removeAttribute(k) { this.atributy.delete(k); }
  append(...uzly) {
    for (const u of uzly) {
      if (u instanceof Fragment) { this.append(...u.childNodes); u.childNodes = []; continue; }
      const n = typeof u === 'string' ? new Textovy(u) : u;
      if (n.parentNode) n.parentNode.childNodes = n.parentNode.childNodes.filter((x) => x !== n);
      n.parentNode = this;
      this.childNodes.push(n);
      if (n instanceof Prvok) this.dok.zaregistrujStrom(n);
    }
  }
  replaceChildren(...uzly) {
    for (const c of this.childNodes) { c.parentNode = null; if (c instanceof Prvok) this.dok.odregistrujStrom(c); }
    this.childNodes = [];
    this.append(...uzly);
  }
  remove() {
    if (this.parentNode) this.parentNode.childNodes = this.parentNode.childNodes.filter((x) => x !== this);
    this.parentNode = null;
    this.dok.odregistrujStrom(this);
  }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(''); }
  set textContent(v) { this.replaceChildren(String(v)); }
  prvky() { return this.childNodes.filter((c) => c instanceof Prvok); }
  potomkovia() { return this.prvky().flatMap((c) => [c, ...c.potomkovia()]); }
  querySelectorAll(sel) { return this.potomkovia().filter((e) => zhoda(e, sel)); }
  addEventListener(typ, fn) { (this.posluchaci[typ] ||= []).push(fn); }
  closest(sel) { for (let e = this; e instanceof Prvok; e = e.parentNode) if (zhoda(e, sel)) return e; return null; }
  focus() { this.dok.activeElement = this; }
  select() { this.vybrate = true; }
  setSelectionRange(a, b) { this.vyber = [a, b]; }
  scrollIntoView() { this.posunute = true; }
  showModal() { this.open = true; }
  click() {
    vyvolaj(this, 'click');
    if (this.tagName === 'A' && this.download) this.dok.stiahnute.push({ href: this.href, download: this.download });
  }
}
class Dokument {
  constructor() {
    this.podlaId = new Map();
    this.stiahnute = [];
    this.activeElement = null;
    this.body = new Prvok('body', this);
  }
  pripojeny(e) { for (let x = e; x; x = x.parentNode) if (x === this.body) return true; return false; }
  zaregistruj(e) { if (e.id && this.pripojeny(e)) this.podlaId.set(e.id, e); }
  zaregistrujStrom(e) { for (const x of [e, ...e.potomkovia()]) this.zaregistruj(x); }
  odregistrujStrom(e) { for (const x of [e, ...e.potomkovia()]) if (x.id && this.podlaId.get(x.id) === x) this.podlaId.delete(x.id); }
  getElementById(id) { return this.podlaId.get(id) || null; }
  createElement(tag) { return new Prvok(tag, this); }
  createDocumentFragment() { return new Fragment(); }
  querySelectorAll(sel) { return this.body.querySelectorAll(sel); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
function vyvolaj(ciel, typ, navyse = {}) {
  const e = { type: typ, target: ciel, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...navyse };
  for (let el = ciel; el; el = el.parentNode) for (const fn of (el.posluchaci && el.posluchaci[typ]) || []) fn.call(el, e);
  return e;
}
const tik = () => new Promise((r) => setImmediate(r));

describe('I. stranka.js v náhradnom DOM', () => {
  let dok, schranka = null;
  const povodne = {};
  const $ = (id) => dok.getElementById(id);
  const tlacidla = () => $('oznaceny-text').querySelectorAll('.si-nalez');
  const cisla = () => ['pocet-najdene', 'pocet-zmeni', 'pocet-ponechane'].map((id) => $(id).textContent);
  const bloby = [];
  const ocakavane = (t = UKAZKA, moznosti = {}) => { const r = najdi(t); return vysledok(t, r.nalezy, predvolene(r.nalezy), moznosti); };

  before(async () => {
    dok = new Dokument();
    // Prvky podľa id z index.html; rovnaký tag, všetko priamo v body (stranka.js hľadá len podľa id).
    for (const m of HTML.matchAll(/<([a-z0-9]+)\b([^>]*)>/g)) {
      const id = (m[2].match(/\sid="([^"]+)"/) || [])[1];
      if (!id) continue;
      const e = dok.createElement(m[1]);
      e.id = id;
      dok.body.append(e);
      // Text tlačidiel a odsekov bez vnorených značiek, ako v stránke (potvrdenie na tlačidle ho potom vracia).
      const zvysok = HTML.slice(m.index + m[0].length);
      const obsah = zvysok.match(new RegExp('^([^<]*)</' + m[1] + '>'));
      if (obsah && m[1] !== 'textarea') e.textContent = dekoduj(obsah[1]);
      if (/\shidden(?=\s|$)/.test(m[2])) e.hidden = true;
      if (/\sdisabled(?=\s|$)/.test(m[2])) e.disabled = true;
    }
    // Voľby tvaru presne ako v stránke (poradie aj predvolená).
    for (const m of HTML.matchAll(/<input type="radio" name="velke" value="([a-z]+)"( checked)?>/g)) {
      const r = dok.createElement('input');
      r.type = 'radio';
      r.setAttribute('name', 'velke');
      r.value = m[1];
      r.checked = !!m[2];
      dok.body.append(r);
    }
    dok.getElementById('text').value = dekoduj(HTML.match(/<textarea id="text"[^>]*>([\s\S]*?)<\/textarea>/)[1]);
    for (const k of ['document', 'window', 'navigator', 'requestAnimationFrame', 'FileReader']) povodne[k] = Object.getOwnPropertyDescriptor(globalThis, k);
    const nastav = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
    nastav('document', dok);
    nastav('window', { matchMedia: () => ({ matches: false }) });
    nastav('navigator', { clipboard: { writeText: async (s) => { schranka = s; } } });
    nastav('requestAnimationFrame', (fn) => fn());
    nastav('FileReader', class { readAsText(f) { this.result = f.obsah; if (f.zlyhaj) this.onerror(); else this.onload(); } });
    povodne.createObjectURL = URL.createObjectURL;
    povodne.revokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = (b) => { bloby.push(b); return 'blob:test/' + bloby.length; };
    URL.revokeObjectURL = () => {};
    mock.timers.enable({ apis: ['setTimeout'] });
    await import(subor('stranka.js').href + '?nahradny-dom');
  });
  after(() => {
    mock.timers.reset();
    for (const [k, d] of Object.entries(povodne)) {
      if (k === 'createObjectURL' || k === 'revokeObjectURL') URL[k] = d;
      else if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k];
    }
  });

  test('po načítaní ukáže ukážku: 17 nájdených, 8 zmien, 9 na posúdenie, tvar ako v príkaze', () => {
    assert.deepEqual(cisla(), ['17', '8', '9']);
    assert.equal(tlacidla().length, 17);
    assert.equal($('zoznam-ponechane').querySelectorAll('li').length, 9);
    assert.equal($('suhrn-veta').textContent, '17 found: 8 will change, 9 kept for review.');
    assert.equal($('moznost-velke').hidden, false);
    assert.equal(dok.querySelector('input[name="velke"]:checked').value, 'ano');
    assert.equal($('povod-stitok').hidden, false);
    assert.equal($('prazdne').hidden, true);
    assert.equal($('kopirovat').disabled, false);
    assert.equal($('kopirovat').getAttribute('data-umami-event-vstup'), 'ukazka');
    const prvy = tlacidla()[0];
    assert.equal(prvy.getAttribute('aria-pressed'), 'true');
    assert.equal(prvy.getAttribute('aria-label'), 'Artificial Intelligence to Super Intelligence');
    assert.equal(tlacidla()[1].getAttribute('aria-pressed'), 'false');
    assert.equal(tlacidla()[1].getAttribute('data-dovod'), 'zakon');
    const male = tlacidla().find((b) => b.getAttribute('aria-label') === 'artificial intelligence to Super Intelligence');
    assert.ok(male, 'malé artificial intelligence sa predvolene mení na Super Intelligence');
  });
  test('prepínanie v texte, v zozname a „Accept all suggestions“', () => {
    vyvolaj(tlacidla()[0].childNodes[0], 'click');
    assert.equal(tlacidla()[0].getAttribute('aria-pressed'), 'false');
    assert.deepEqual(cisla(), ['17', '7', '10']);
    const cb = $('p-1');
    cb.checked = true;
    vyvolaj(cb, 'change');
    assert.equal(tlacidla()[1].getAttribute('aria-pressed'), 'true');
    assert.deepEqual(cisla(), ['17', '8', '9']);
    vyvolaj($('prijat'), 'click');
    assert.equal(tlacidla()[0].getAttribute('aria-pressed'), 'true');
    assert.equal(tlacidla()[1].getAttribute('aria-pressed'), 'true', 'prijať všetko nechá voľbu pri ponechanom');
    assert.deepEqual(cisla(), ['17', '9', '8']);
    assert.equal($('prijat').textContent, 'All suggestions on');
    mock.timers.tick(2000);
    // Andrej 1. 10. 2026: tlačidlo nesmie ostať mŕtve, keď sú návrhy zapnuté; ponúkne zmeniť aj ponechané.
    assert.match($('prijat').textContent, /^Change the \d+ kept ones too$/);
    assert.equal($('prijat').disabled, false);
    cb.checked = false;
    vyvolaj(cb, 'change');
    assert.deepEqual(cisla(), ['17', '8', '9']);
  });
  test('„Accept all“ zmení aj ponechané, okrem webovej adresy, potom je neaktívne; ručne sa dá vrátiť', () => {
    const pred = cisla();
    assert.match($('prijat').textContent, /^Change the \d+ kept ones too$/);
    vyvolaj($('prijat'), 'click');
    assert.equal($('prijat').textContent, 'Changed');
    const po = cisla();
    assert.equal(po[0], pred[0]);
    assert.ok(Number(po[1]) > Number(pred[1]), 'zmení viac nálezov');
    const adresa = tlacidla().find((b) => b.getAttribute('data-dovod') === 'odkaz');
    assert.ok(adresa, 'ukážka má webovú adresu');
    assert.equal(adresa.getAttribute('aria-pressed'), 'false', 'webová adresa sa nikdy nezmení');
    mock.timers.tick(2000);
    assert.equal($('prijat').textContent, 'All suggestions accepted');
    assert.equal($('prijat').disabled, true);
    // späť do predvoleného stavu pre ďalšie testy: ponechané znova vypnúť ťukom
    for (const b of tlacidla()) if (b.getAttribute('data-dovod') && b.getAttribute('aria-pressed') === 'true') vyvolaj(b.childNodes[0], 'click');
    assert.deepEqual(cisla(), pred);
    assert.match($('prijat').textContent, /^Change the \d+ kept ones too$/);
  });
  test('kopírovať dá do schránky výsledok, voľba malých písmen ho zmení', async () => {
    vyvolaj($('kopirovat'), 'click');
    await tik();
    assert.equal(schranka, ocakavane());
    assert.ok(schranka.includes('use of Super Intelligence (SI) in 2027'));
    assert.equal($('kopirovat').textContent, 'Copied');
    const [ano, nie] = dok.querySelectorAll('input[name="velke"]');
    ano.checked = false;
    nie.checked = true;
    vyvolaj(nie, 'change');
    vyvolaj($('kopirovat'), 'click');
    await tik();
    assert.equal(schranka, ocakavane(UKAZKA, { velke: false }));
    assert.ok(schranka.includes('use of super intelligence (SI) in 2027'));
    nie.checked = false;
    ano.checked = true;
    vyvolaj(ano, 'change');
  });
  test('bez schránky otvorí okno s označeným výsledkom', async () => {
    const schrankaPred = globalThis.navigator.clipboard;
    globalThis.navigator.clipboard = undefined;
    vyvolaj($('kopirovat'), 'click');
    await tik();
    assert.equal($('kopia').open, true);
    assert.equal($('kopia-text').value, ocakavane());
    assert.equal($('kopia-text').vybrate, true);
    globalThis.navigator.clipboard = schrankaPred;
  });
  test('stiahnuť vytvorí .txt s výsledkom až po kliknutí', async () => {
    const pred = bloby.length;
    vyvolaj($('stiahnut'), 'click');
    assert.equal(bloby.length, pred + 1);
    assert.equal(await bloby.at(-1).text(), ocakavane());
    assert.equal(bloby.at(-1).type, 'text/plain;charset=utf-8');
    assert.equal(dok.stiahnute.at(-1).download, 'ai-to-si-sample.txt');
    assert.equal(dok.getElementById('stiahnut').disabled, false);
  });
  test('vlastný text: prázdne pole, potom text bez ukážky', () => {
    vyvolaj($('vlastny'), 'click');
    assert.equal($('text').value, '');
    assert.deepEqual(cisla(), ['0', '0', '0']);
    assert.equal($('prazdne').hidden, false);
    assert.match($('prazdne').textContent, /^Paste text/);
    assert.equal($('spat').hidden, true, 'ukážka sa nezálohuje');
    $('text').value = 'We use AI, not OpenAI.';
    vyvolaj($('formular'), 'submit');
    assert.deepEqual(cisla(), ['1', '1', '0']);
    assert.equal($('povod-stitok').hidden, true);
    assert.equal($('kopirovat').getAttribute('data-umami-event-vstup'), 'vlastny');
    assert.equal($('stav').textContent, '1 found: 1 will change, 0 kept for review.');
  });
  test('písanie skontroluje text po krátkej pauze', () => {
    $('text').value = 'We use AI and A.I. today.';
    vyvolaj($('text'), 'input');
    assert.deepEqual(cisla(), ['1', '1', '0'], 'pred pauzou ešte starý výsledok');
    mock.timers.tick(300);
    assert.deepEqual(cisla(), ['2', '2', '0']);
  });
  test('ukážka zálohuje vlastný text a „Restore my text“ ho vráti', () => {
    vyvolaj($('ukazka'), 'click');
    assert.deepEqual(cisla(), ['17', '8', '9']);
    assert.equal($('spat').hidden, false);
    vyvolaj($('spat'), 'click');
    assert.equal($('text').value, 'We use AI and A.I. today.');
    assert.equal($('spat').hidden, true);
    assert.deepEqual(cisla(), ['2', '2', '0']);
  });
  test('otvorený .html súbor: len text, meno výsledku podľa súboru', () => {
    $('subor').files = [{ name: 'memo.html', size: 60, obsah: '<p>Use AI</p><p>Next</p>' }];
    vyvolaj($('subor'), 'change');
    assert.equal($('text').value, 'Use AI\n\nNext');
    assert.equal($('subor-info').hidden, false);
    assert.match($('subor-info').textContent, /^Opened memo\.html\. Only the text is checked/);
    vyvolaj($('stiahnut'), 'click');
    assert.equal(dok.stiahnute.at(-1).download, 'memo-SI.txt');
  });
  test('zlý typ, veľký súbor a chyba čítania povedia hranicu', () => {
    $('subor').files = [{ name: 'scan.pdf', size: 10 }];
    vyvolaj($('subor'), 'change');
    assert.equal($('chyba').hidden, false);
    assert.match($('chyba').textContent, /not a \.txt, \.md, \.html or \.csv file/);
    $('subor').files = [{ name: 'big.txt', size: 6 * 1024 * 1024 }];
    vyvolaj($('subor'), 'change');
    assert.match($('chyba').textContent, /up to 5 MB/);
    $('subor').files = [{ name: 'x.txt', size: 5, zlyhaj: true }];
    vyvolaj($('subor'), 'change');
    assert.match($('chyba').textContent, /could not be read/);
  });
  test('príliš dlhý text: chyba pri poli, nič sa nemení', () => {
    $('text').value = 'a'.repeat(1000001);
    vyvolaj($('formular'), 'submit');
    assert.equal($('chyba').hidden, false);
    assert.match($('chyba').textContent, /up to 1,000,000/);
    assert.equal($('text').getAttribute('aria-invalid'), 'true');
    assert.deepEqual(cisla(), ['0', '0', '0']);
    assert.match($('prazdne').textContent, /over the 1,000,000 character limit/);
    $('text').value = 'AI';
    vyvolaj($('formular'), 'submit');
    assert.equal($('chyba').hidden, true);
    assert.equal($('text').getAttribute('aria-invalid'), null);
  });
  test('„Show in text“ presunie fokus na nález', () => {
    vyvolaj($('ukazka'), 'click');
    const odkaz = $('zoznam-ponechane').querySelectorAll('[data-skok]')[0];
    const e = vyvolaj(odkaz, 'click');
    assert.equal(e.defaultPrevented, true);
    assert.equal(dok.activeElement, $('n-' + odkaz.getAttribute('data-skok')));
    assert.equal(dok.activeElement.posunute, true);
  });
  test('zoznam ukáže konkrétny dôvod: iný význam AI a skorší dokument', () => {
    const dovody = $('zoznam-ponechane').querySelectorAll('.si-dovod').map((p) => p.textContent);
    assert.ok(dovody.includes('Here AI means American Indian (AI/AN). The order’s SI covers only AI the technology (Sec. 3(a)), so this stays.'), dovody.join(' | '));
    assert.ok(dovody.includes(DOVODY.dokument));
  });
  test('nález 8: zvýraznenie je inline span s role="button", Enter aj medzerník ho prepnú', () => {
    const b = tlacidla()[0];
    assert.equal(b.tagName, 'SPAN');
    assert.equal(b.getAttribute('role'), 'button');
    assert.equal(b.getAttribute('tabindex'), '0');
    const pred = b.getAttribute('aria-pressed');
    const e = vyvolaj(b, 'keydown', { key: 'Enter' });
    assert.equal(e.defaultPrevented, true);
    assert.notEqual(b.getAttribute('aria-pressed'), pred);
    const e2 = vyvolaj(b, 'keydown', { key: ' ' });
    assert.equal(e2.defaultPrevented, true, 'medzerník neposunie stránku');
    assert.equal(b.getAttribute('aria-pressed'), pred);
    assert.equal(vyvolaj(b, 'keydown', { key: 'a' }).defaultPrevented, false);
  });
  test('nález 10: prvé vloženie do ukážky ju celú nahradí a ohlási to', () => {
    assert.equal($('text').value, UKAZKA);
    const e = vyvolaj($('text'), 'paste', { clipboardData: { getData: (typ) => (typ === 'text/plain' ? 'Our team uses AI daily.' : '') } });
    assert.equal(e.defaultPrevented, true);
    assert.equal($('text').value, 'Our team uses AI daily.');
    assert.deepEqual(cisla(), ['1', '1', '0']);
    assert.equal($('povod-stitok').hidden, true);
    assert.equal($('stav').textContent, 'Sample replaced with your text. 1 found: 1 will change, 0 kept for review.');
    const druhe = vyvolaj($('text'), 'paste', { clipboardData: { getData: () => 'more' } });
    assert.equal(druhe.defaultPrevented, false, 'do vlastného textu sa vkladá normálne');
  });
  test('nález 10: prvý napísaný znak do ukážky ju nahradí', () => {
    vyvolaj($('ukazka'), 'click');
    const e = vyvolaj($('text'), 'beforeinput', { inputType: 'insertText', data: 'W', isComposing: false });
    assert.equal(e.defaultPrevented, true);
    assert.equal($('text').value, 'W');
    assert.deepEqual($('text').vyber, [1, 1]);
    assert.match($('stav').textContent, /^Sample replaced with your text\./);
    assert.equal(vyvolaj($('text'), 'beforeinput', { inputType: 'insertText', data: 'e' }).defaultPrevented, false);
  });
  test('veľa nálezov: najviac 5 000 zvýraznení a 1 000 v zozname, kópia berie všetko', async () => {
    $('text').value = '"AI" '.repeat(1001) + 'AI '.repeat(4100);
    vyvolaj($('formular'), 'submit');
    assert.deepEqual(cisla(), ['5,101', '4,100', '1,001']);
    assert.equal(tlacidla().length, 5000);
    assert.equal($('vela').hidden, false);
    assert.match($('vela').textContent, /first 5,000 of 5,101 findings/);
    assert.equal($('zoznam-ponechane').querySelectorAll('li').length, 1000);
    assert.equal($('posudit-prazdne').hidden, false);
    assert.match($('posudit-prazdne').textContent, /first 1,000 kept findings/);
    vyvolaj($('kopirovat'), 'click');
    await tik();
    assert.equal((schranka.match(/\bSI\b/g) || []).length, 4100);
    assert.equal((schranka.match(/"AI"/g) || []).length, 1001);
  });
});

// ── J. 40 viet hodnotiteľa (ops/ai/kontrola/2026-09-30-si-nastroj.md, predvolené voľby) ──
// Každá veta: očakávaný výstup po prijatí predvolených návrhov a dôvody ponechaných nálezov v poradí.
describe('J. 40 viet hodnotiteľa z brány pokus 1', () => {
  const vety = [
    ['We hire AI/ML engineers for the new unit.', 'We hire SI/ML engineers for the new unit.', []],
    ['The agency will expand AI.', 'The agency will expand SI.', []],
    ['Artificial intelligence (AI) and machine learning (ML) are covered.', 'Super Intelligence (SI) and machine learning (ML) are covered.', []],
    ['The AIs’ outputs were logged.', 'The SIs’ outputs were logged.', []],
    ['Staff may not use ChatGPT AI features.', null, ['nazov']],
    ['Contact the Department of AI Policy for help.', null, ['nazov']],
    ['The AI Act 2024 guidance applies to exports.', null, ['zakon']],
    ['our ai tools are ready and ai adoption grows.', null, []],
    ['The A.I review is due on Friday.', 'The S.I review is due on Friday.', []],
    ['We support fair AI in hiring.', 'We support fair SI in hiring.', []],
    ['Use the email AI assistant with care.', 'Use the email SI assistant with care.', []],
    ['Read the [AI guide](https://agency.gov/AI/guide) today.', 'Read the [SI guide](https://agency.gov/AI/guide) today.', ['odkaz']],
    ['Follow #AI and #GovAI for updates.', null, ['identifikator']],
    ['We follow an AI-first strategy.', 'We follow an SI-first strategy.', []],
    ['Non-AI staff keep their roles.', 'Non-SI staff keep their roles.', []],
    ['Services for American Indian and Alaska Native (AI/AN) communities expand.', null, ['vyznam']],
    ['The Adequate Intake (AI) for potassium is 3,400 mg.', null, ['vyznam']],
    ['USDA confirmed avian influenza (AI) in two flocks; AI testing continues.', null, ['vyznam', 'vyznam']],
    ['Executive Order 14110, Safe, Secure, and Trustworthy Development and Use of Artificial Intelligence, was revoked.', null, ['dokument']],
    ['Follow OMB Memorandum M-25-21, Accelerating Federal Use of AI through Innovation, Governance, and Public Trust.', null, ['dokument']],
    ['She said, ‘AI must earn trust,’ and left.', null, ['citat']],
    ["The term 'AI' is retired.", null, ['citat']],
    ['Scale AI won the contract.', null, ['nazov']],
    ['We follow America’s AI Action Plan.', null, ['nazov']],
    ['See the Blueprint for an AI Bill of Rights.', null, ['nazov']],
    ['An A.I.-powered tool was tested.', 'An S.I.-powered tool was tested.', []],
    ['Using AI To Improve Services', null, ['nazov']],
    ['Measure AI output in SI units.', 'Measure SI output in SI units.', []],
    ['AI Safety Institute staff joined.', null, ['nazov']],
    ['Two AI’s were tested.', 'Two SI’s were tested.', []],
    ['Model AI-2 is retired.', null, ['nazov']],
    ['The A. I. program ends.', null, []],
    ['## Our AI Strategy', null, ['nazov']],
    ['id,term\n1,AI tools\n2,"AI plan, 2026"', 'id,term\n1,SI tools\n2,"AI plan, 2026"', ['citat']],
    ['See [AI.gov](https://ai.gov) for details.', null, ['odkaz']],
    ['[guide](https://www.nist.gov/AI/rmf)', null, ['odkaz']],
    ['See canada.ca/en/AI.html for the policy.', null, ['odkaz']],
    ['Follow @AI on social media.', null, ['identifikator']],
    ['AI/ANs and other groups.', null, ['vyznam']],
    ['Artificial insemination (AI) improves herd genetics; AI technicians visit weekly.', null, ['vyznam', 'vyznam']],
  ];
  test('je ich presne 40', () => assert.equal(vety.length, 40));
  vety.forEach(([veta, vystup, dovody], k) => {
    test(`veta ${k + 1}: ${veta.replace(/\n/g, ' / ')}`, () => {
      assert.equal(zmen(veta), vystup ?? veta);
      assert.deepEqual(najdi(veta).nalezy.filter((n) => n.ponechat).map((n) => n.ponechat), dovody);
    });
  });
  test('16 viet, ktoré hodnotiteľ hlásil ako nesprávnu zmenu, už dávajú správny výstup', () => {
    const chybne = [12, 13, 16, 17, 18, 19, 20, 21, 22, 23, 35, 36, 37, 38, 39, 40];
    assert.equal(chybne.length, 16);
    for (const k of chybne) {
      const [veta, vystup] = vety[k - 1];
      assert.equal(zmen(veta), vystup ?? veta, 'veta ' + k);
    }
  });
});

// ── K. Opravy po bráne pokus 1 (každý test by bez opravy zlyhal) ─────────────
describe('K. opravy po bráne pokus 1', () => {
  test('nález 1: iné významy AI ostanú a dôvod cituje definíciu z textu (Sec. 3(a))', () => {
    const avian = najdi('USDA confirmed avian influenza (AI) in two flocks; AI testing continues.').nalezy;
    assert.deepEqual(avian.map((n) => n.ponechat), ['vyznam', 'vyznam']);
    assert.equal(avian[0].dovod, 'Your text defines AI as “avian influenza”. The order’s SI covers only AI the technology (Sec. 3(a)), so this stays.');
    assert.match(jeden('The Adequate Intake (AI) for potassium is 3,400 mg.').dovod, /defines AI as “Adequate Intake”/);
    assert.match(jeden('AI/ANs and other groups.').dovod, /^Here AI means American Indian \(AI\/AN\)\./);
    assert.equal(jeden('AI (avian influenza) spreads in spring.').ponechat, 'vyznam');
    assert.deepEqual(najdi('aromatase inhibitors (AIs) are drugs; AIs lower estrogen.').nalezy.map((n) => n.ponechat), ['vyznam', 'vyznam']);
    assert.equal(NAZVY_DOVODOV.vyznam, 'Other meaning of AI');
  });
  test('nález 1: definícia artificial intelligence (AI) je technológia a mení sa', () => {
    assert.deepEqual(najdi('generative artificial intelligence (AI) tools and AI policy').nalezy.map((n) => n.ponechat), [null, null, null]);
    assert.deepEqual(najdi('The AI (artificial intelligence) office opens.').nalezy.map((n) => n.ponechat), [null, null]);
    assert.equal(jeden('The AI (machine learning) office opens.').ponechat, null, 'iniciálky nie sú A…I, definícia sa neráta');
  });
  test('nález 2: názvy skôr vydaných dokumentov ostanú (Sec. 2(b)), bežná veta po čísle príkazu nie', () => {
    assert.equal(jeden('Executive Order 14110, Safe, Secure, and Trustworthy Development and Use of Artificial Intelligence, was revoked.').ponechat, 'dokument');
    assert.equal(jeden('Follow OMB Memorandum M-25-21, Accelerating Federal Use of AI through Innovation, Governance, and Public Trust.').ponechat, 'dokument');
    assert.equal(jeden('Executive Order 14179 of January 23, 2025, Removing Barriers to American Leadership in Artificial Intelligence, applies.').ponechat, 'dokument');
    assert.equal(jeden('Under Executive Order 14179, Agencies must use AI responsibly.').ponechat, null);
    assert.equal(jeden('OMB Memorandum M-24-10, AI use cases must be inventoried.').ponechat, null);
    assert.equal(DOVODY.dokument, 'Title of an earlier document. The order does not require changing previously issued documents (Sec. 2(b)).');
  });
  test('nález 3: jednoduché úvodzovky sú citát, apostrof nie', () => {
    assert.equal(jeden('She said, ‘AI must earn trust,’ and left.').ponechat, 'citat');
    assert.equal(jeden("The term 'AI' is retired.").ponechat, 'citat');
    assert.equal(jeden("Don't use 'AI' loosely, it's vague.").ponechat, 'citat');
    assert.equal(jeden('‘AI’s role’ matters here.').ponechat, 'citat');
    assert.equal(jeden("The AI's output isn't 'final' yet.").ponechat, null);
    assert.equal(jeden("It's the AIs' job to help.").ponechat, null);
  });
  test('nález 4: adresy v Markdown, v zátvorkách, s inou koncovkou, hashtag a účet ostanú', () => {
    assert.equal(zmen('Read the [AI guide](https://agency.gov/AI/guide) today.'), 'Read the [SI guide](https://agency.gov/AI/guide) today.');
    assert.equal(zmen('See [AI.gov](https://ai.gov) for details.'), 'See [AI.gov](https://ai.gov) for details.');
    assert.equal(zmen('[guide](https://www.nist.gov/AI/rmf)'), '[guide](https://www.nist.gov/AI/rmf)');
    assert.equal(zmen('Visit (https://agency.gov/AI) now.'), 'Visit (https://agency.gov/AI) now.');
    assert.equal(zmen('See canada.ca/en/AI.html for the policy.'), 'See canada.ca/en/AI.html for the policy.');
    assert.equal(jeden('Follow #AI for updates.').ponechat, 'identifikator');
    assert.equal(jeden('Follow @AI on social media.').ponechat, 'identifikator');
    assert.equal(jeden('We use AI/ML models.').ponechat, null, 'lomka bez domény nie je adresa');
  });
  test('nález 5: sekcia o príkaze cituje text príkazu (Sec. 2(a), 2(b), 3(a)) a odkazuje naň ako prvý zdroj', () => {
    const prikaz = sekcia('<section aria-labelledby="prikaz">');
    const url = 'https://www.whitehouse.gov/presidential-actions/2026/09/inaugurating-the-era-of-super-intelligence/';
    for (const s of [
      'To the maximum extent permitted by law, executive departments and agencies (agencies) shall use “Super Intelligence” and “SI” in place of “Artificial Intelligence” and “AI” in official correspondence, public communications, websites, reports, policy documents, and other non-statutory documents within the executive branch.',
      'Nothing in this section requires the alteration of previously issued regulations, Presidential actions, contracts, grants, or other historical documents.',
      'For purposes of this order, and except where otherwise provided by law, the terms “Super Intelligence” and “SI” mean the technologies and systems encompassed by the term “artificial intelligence” as defined in section 9401(3) of title 15, United States Code.',
      '<h3>What the order does not require</h3>', 'Updated 30 September 2026.', 'Its only deadline, 60 days,']) assert.ok(prikaz.includes(s), s);
    assert.ok(!HTML.includes('What it does not cover'));
    const zdroje = prikaz.slice(prikaz.indexOf('si-zdroje'));
    assert.equal((zdroje.match(/href="([^"]+)"/) || [])[1], url);
    assert.ok(prikaz.includes(`<a href="${url}">“Inaugurating The Era Of Super Intelligence”</a>`));
    assert.match(sekcia('<section aria-labelledby="faq">'), /The order directs executive departments and agencies \(summarized in the White House fact sheet\)\./);
    assert.match(sekcia('<section aria-labelledby="faq">'), /Section 2\(b\) of the order says/);
  });
  test('nález 6: texty sľubujú len to, čo jadro robí, a FAQ povie, čo nenájde', () => {
    assert.ok(!/Every AI/.test(HTML), 'žiadne „Every AI … gets its SI wording“');
    assert.ok(HTML.includes('anything inside single or double quotation marks'));
    assert.ok(HTML.includes('web and e-mail addresses, and hashtags or handles'));
    const faq = sekcia('<section aria-labelledby="faq">');
    assert.match(faq, /It does not find lowercase ai, Ai, A\. I\. with a space/);
    assert.equal(jeden('The A.I review is due on Friday.').navrh, 'S.I', 'A.I bez poslednej bodky sa nájde, ako sľubuje FAQ');
    assert.deepEqual(najdi('our ai tools and The A. I. program').nalezy, [], 'malé ai a A. I. s medzerou nenájde, ako hovorí FAQ');
  });
  test('nález 7: tabuľka pri 600 px a menej ostane tabuľkou (nie karty v karte)', () => {
    const blok = mediaBlok(CSS, 'max-width:600px');
    for (const s of ['.si-tabulka table{display:table', '.si-tabulka thead{display:table-header-group}', '.si-tabulka tbody{display:table-row-group}',
      '.si-tabulka tr{display:table-row', 'display:table-cell', '.si-tabulka td::before{content:none}', '.si-tabulka td:first-child{width:auto}']) {
      assert.ok(blok.includes(s), s);
    }
  });
  test('nález 8: zvýraznenie nie je <button>, ale span s role="button" v toku textu', () => {
    assert.match(JS, /prvok\('span', 'si-nalez'\)/);
    assert.match(JS, /setAttribute\('role', 'button'\)/);
    assert.match(JS, /setAttribute\('tabindex', '0'\)/);
    assert.doesNotMatch(JS, /prvok\('button', 'si-nalez'\)/);
    assert.match(CSS, /\.si-nastroj \.si-nalez,\.si-nastroj \.si-vzor\{display:inline;/);
  });
  test('nález 9: počty sú na jednej línii aj pri zalomenom popise', () => {
    assert.match(CSS, /\.si-pocty>div\{display:flex;flex-direction:column;justify-content:space-between;/);
  });
  test('nález 11: Use my own text, Open a file a Load sample sú nad poľom (prvá obrazovka pri 1280 x 800)', () => {
    const pole = HTML.indexOf('<textarea id="text"');
    for (const s of ['id="vlastny"', '<label class="btn btn-line si-subor" for="subor">', 'id="ukazka"']) {
      const kde = HTML.indexOf(s);
      assert.ok(kde > 0 && kde < pole, s);
    }
    assert.match(HTML, /<div class="si-zdroj">/);
  });
  test('nález 15: za zoznamom na posúdenie jedna veta s odkazom na Rukopis a analytikou', () => {
    const posudit = sekcia('<section id="posudit"');
    assert.match(posudit, /<ol class="si-zoznam" id="zoznam-ponechane"><\/ol>[\s\S]*<p class="si-dalej">Next: find vague stock phrases in the same memo\. <a href="https:\/\/arling\.sk\/rukopis\/en\/" data-umami-event="si_rukopis">Rukopis<\/a>/);
    assert.equal((posudit.match(/<a /g) || []).length, 1, 'len jeden odkaz, nič viac na predaj');
  });
  test('odporúčanie: predvolený tvar je „Super Intelligence, as in the order“, malé písmená druhá voľba', () => {
    const volby = [...HTML.matchAll(/<input type="radio" name="velke" value="([a-z]+)"( checked)?> ([^<]+)<\/label>/g)].map((m) => [m[1], !!m[2], m[3]]);
    assert.deepEqual(volby, [['ano', true, 'Super Intelligence, as in the order'], ['nie', false, 'super intelligence']]);
    assert.match(HTML, /<span class="si-term">Super Intelligence<\/span>, as in the order, or <span class="si-term">super intelligence<\/span> if you choose/);
  });
});

// ── L. Šablóna obrázka na zdieľanie (nález 14) ───────────────────────────────
describe('L. šablóna og:image 1200 x 630', () => {
  const SABLONA = citaj('og/sablona.html');
  test('šablóna existuje, má 1200 x 630, noindex, žiadny skript ani štýl v stránke', () => {
    assert.ok(existsSync(subor('og/sablona.css')));
    assert.match(SABLONA, /<meta name="robots" content="noindex, nofollow">/);
    assert.doesNotMatch(SABLONA, /<script/);
    assert.doesNotMatch(SABLONA, /\sstyle=/);
    assert.match(citaj('og/sablona.css'), /html,body\{margin:0;width:1200px;height:630px;overflow:hidden\}/);
    assert.ok(SABLONA.includes('Change AI to SI. Leave law titles alone.'));
    assert.ok(SABLONA.includes('<meta property="og:image" content="https://arling.sk/super-intelligence/og.png">'), 'návod na meta značky pre Fable');
  });
  test('okno výsledku je skutočné: počty celej ukážky a nálezy výrezu podľa jadra', () => {
    const r = najdi(UKAZKA);
    const p = pocty(r.nalezy, predvolene(r.nalezy));
    for (const [kluc, hodnota] of Object.entries({ najdene: p.najdene, zmeni: p.zmeni, ponechane: p.ponechane })) {
      assert.ok(SABLONA.includes(`<dd data-og="${kluc}">${hodnota}</dd>`), kluc);
    }
    const vyrez = SABLONA.match(/<p class="si-og-vyrez" data-og-vyrez>([\s\S]*?)<\/p>/)[1];
    const znacky = [...vyrez.matchAll(/<span class="si-vzor si-vzor-(zmena|posudit)" data-og-nalez="\1">(?:<span class="si-stare">([^<]*)<\/span><span class="si-nove">([^<]*)<\/span>|([^<]*))<\/span>/g)]
      .map((m) => m[1] === 'zmena' ? { stav: 'zmena', stare: m[2], nove: m[3] } : { stav: 'posudit', stare: m[4] });
    const text = vyrez.replace(/<span class="si-vzor si-vzor-zmena" data-og-nalez="zmena"><span class="si-stare">([^<]*)<\/span><span class="si-nove">[^<]*<\/span><\/span>/g, '$1')
      .replace(/<span class="si-vzor si-vzor-posudit" data-og-nalez="posudit">([^<]*)<\/span>/g, '$1');
    assert.doesNotMatch(text, /</, 'výrez má len tieto značky');
    assert.ok(UKAZKA.includes(text), 'výrez je doslova z ukážky');
    const skutocne = najdi(text).nalezy.map((n) => n.ponechat ? { stav: 'posudit', stare: n.text } : { stav: 'zmena', stare: n.text, nove: navrhPre(n) });
    assert.deepEqual(znacky, skutocne);
  });
});
