// Testy scény Puzzle video makera (scena.mjs): časovanie, bezpečné zóny, kreditný riadok.
// Spustenie (v priečinku puzzle-video): node --test scena.test.mjs tiktok.test.mjs stranka.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  W, H, FPS, KREDIT, ODPOCTY, OBTIAZNOSTI, DRUHY, BEZPECNE,
  volby, casy, zvuky, pcm, nakresli, vBezpecnejZone, pripravSvg, cestaHlavolamu, nazovSuboru, zalom, nahodneCislo,
} from './scena.mjs';

const TU = dirname(fileURLToPath(import.meta.url));
const API = join(TU, '..', 'api', 'puzzles', 'v1');

/** Dvojník 2D kontextu: meria text odhadom 0,56 em na znak, všetko ostatné zaznamená a ignoruje. */
function falosnyKontext() {
  const volania = [];
  const stav = { font: '10px x', globalAlpha: 1 };
  const px = () => Number((/(\d+)px/.exec(stav.font) || [0, 10])[1]);
  return new Proxy(stav, {
    get(ciel, kluc) {
      if (kluc === 'volania') return volania;
      if (kluc === 'measureText') return (t) => ({ width: String(t).length * px() * 0.56 });
      if (kluc in ciel) return ciel[kluc];
      return (...args) => { volania.push([kluc, ...args]); };
    },
    set(ciel, kluc, hodnota) { ciel[kluc] = hodnota; return true; },
  });
}

const obrazok = { width: 1400, height: 1400 };

function stavPre(druh = 'otters', sek = 20, obtiaznost = 'easy') {
  return { ...volby({ druh, obtiaznost, cislo: 1, sek }), zadanie: obrazok, riesenie: obrazok };
}

/** Všetky časy snímkov, ktoré sa naozaj vyrenderujú, s krokom (každý n-tý) a vždy aj hrany fáz. */
function casySnimkov(sek, krok = 3) {
  const c = casy(sek);
  const out = new Set();
  for (let f = 0; f < c.snimkov; f += krok) out.add(f / FPS);
  for (const t of [0, c.T_PUZZLE, c.T_KONIEC_ODPOCTU, c.T_RIESENIE, c.T_KONIEC, c.T_KONIEC + 0.3, (c.snimkov - 1) / FPS]) out.add(t);
  return [...out];
}

// --------------------------------------------------------------------------- časovanie

test('časovanie: dĺžky pre 10, 20 a 30 s, rovnaké ako sablona.html', () => {
  for (const sek of ODPOCTY) {
    const c = casy(sek);
    assert.equal(c.T_PUZZLE, 1.2);
    assert.equal(c.T_KONIEC_ODPOCTU, 1.2 + sek);
    assert.ok(Math.abs(c.T_RIESENIE - (c.T_KONIEC_ODPOCTU + 0.4)) < 1e-9);
    assert.ok(Math.abs(c.T_KONIEC - (c.T_RIESENIE + 5.5)) < 1e-9);
    assert.ok(Math.abs(c.dlzka - (1.2 + sek + 0.4 + 5.5 + 4)) < 1e-9);
    assert.equal(c.snimkov, Math.round(c.dlzka * FPS));
  }
  assert.equal(casy(30).snimkov, 1233);
  // Najdlhšie video je pod minútou, teda v limite TikToku aj Shorts.
  assert.ok(casy(30).dlzka < 60);
  assert.throws(() => casy(15), RangeError);
});

test('časovanie: odpočet ide od N k nule a pás sa zmenšuje', () => {
  const s = stavPre('otters', 10);
  const c = casy(10);
  const cislo = (t) => nakresli(falosnyKontext(), t, s).find((p) => p.typ === 'text' && /^\d+ s$/.test(p.text));
  assert.equal(cislo(c.T_PUZZLE).text, '10 s');
  assert.equal(cislo(c.T_PUZZLE + 0.5).text, '10 s');
  assert.equal(cislo(c.T_PUZZLE + 1).text, '9 s');
  assert.equal(cislo(c.T_KONIEC_ODPOCTU - 0.01).text, '1 s');
  assert.equal(cislo(c.T_KONIEC_ODPOCTU).text, '0 s');
  const pas = (t) => nakresli(falosnyKontext(), t, s).find((p) => p.typ === 'draha').zostava;
  assert.ok(pas(c.T_PUZZLE + 2) > pas(c.T_PUZZLE + 6));
  assert.equal(pas(c.T_KONIEC_ODPOCTU), 0);
});

test('časovanie: riešenie sa objaví až po odpočte, záver až po riešení', () => {
  const s = stavPre('swans', 20);
  const c = casy(20);
  const typy = (t) => nakresli(falosnyKontext(), t, s).map((p) => p.typ + (p.text ? ':' + p.text : ''));
  assert.ok(!typy(c.T_KONIEC_ODPOCTU - 0.1).includes('riesenie'));
  assert.ok(!typy(c.T_KONIEC_ODPOCTU - 0.1).includes('text:Solution'));
  assert.ok(typy(c.T_RIESENIE + 1).includes('riesenie'));
  assert.ok(typy(c.T_RIESENIE + 1).includes('text:Solution'));
  assert.ok(!typy(c.T_RIESENIE + 1).some((x) => x.startsWith('text:How long')));
  const zaver = typy(c.T_KONIEC + 1).join('|');
  assert.match(zaver, /How long did/);
  assert.ok(!zaver.includes('zadanie'));
});

test('zvuky: päť tikov v posledných piatich sekundách a akord pri riešení', () => {
  for (const sek of ODPOCTY) {
    const c = casy(sek);
    const z = zvuky(sek);
    const tiky = z.filter((x) => x.typ === 'tik').map((x) => x.t);
    assert.deepEqual(tiky, [5, 4, 3, 2, 1].map((k) => +(c.T_KONIEC_ODPOCTU - k).toFixed(3)));
    assert.deepEqual(z.filter((x) => x.typ === 'akord').map((x) => x.t), [c.T_RIESENIE]);
  }
});

test('zvuk: PCM má dĺžku videa, ticho pred prvým tikom a nikdy nepretečie', () => {
  const sr = 8000;
  const b = pcm(10, sr);
  assert.equal(b.length, Math.round(casy(10).dlzka * sr));
  const prvyTik = zvuky(10)[0].t;
  let maxPred = 0;
  for (let i = 0; i < Math.floor(prvyTik * sr) - 1; i++) maxPred = Math.max(maxPred, Math.abs(b[i]));
  assert.equal(maxPred, 0);
  let max = 0;
  for (const v of b) max = Math.max(max, Math.abs(v));
  assert.ok(max > 0.05 && max <= 1);
});

// --------------------------------------------------------------------------- bezpečné zóny

test('bezpečné zóny: každý viditeľný prvok každého druhu a odpočtu je mimo tlačidiel a popisu', () => {
  for (const druh of Object.keys(DRUHY)) {
    for (const sek of ODPOCTY) {
      const s = stavPre(druh, sek);
      for (const t of casySnimkov(sek, 7)) {
        for (const p of nakresli(falosnyKontext(), t, s)) {
          assert.ok(vBezpecnejZone(p), `${druh} ${sek}s t=${t.toFixed(2)}: ${p.typ} ${p.text || ''} ${JSON.stringify([p.x, p.y, p.w, p.h])}`);
        }
      }
    }
  }
});

test('bezpečné zóny: aj obdĺžnikový obrázok (nonogram) ostane v karte', () => {
  const s = { ...stavPre('magpies', 10), zadanie: { width: 1400, height: 900 }, riesenie: { width: 1400, height: 900 } };
  const prvky = nakresli(falosnyKontext(), 5, s);
  const z = prvky.find((p) => p.typ === 'zadanie');
  const k = prvky.find((p) => p.typ === 'karta');
  assert.ok(z.x >= k.x && z.x + z.w <= k.x + k.w && z.y >= k.y && z.y + z.h <= k.y + k.h);
});

test('bezpečné zóny: funkcia naozaj odmieta pravý dolný roh a pás popisu', () => {
  assert.equal(vBezpecnejZone({ x: 100, y: 1200, w: 850, h: 40 }), false);
  assert.equal(vBezpecnejZone({ x: 100, y: 1460, w: 100, h: 40 }), false);
  assert.equal(vBezpecnejZone({ x: 100, y: 500, w: 900, h: 40 }), true);
  assert.equal(vBezpecnejZone({ x: 100, y: 1200, w: 700, h: 40 }), true);
  assert.equal(BEZPECNE.dole, 1480);
  assert.equal(BEZPECNE.tlacidlaOdY, 1000);
  assert.equal(W, 1080);
  assert.equal(H, 1920);
});

// --------------------------------------------------------------------------- kreditný riadok

test('stiahnuté video: kreditný riadok je v každom snímku čitateľný (alfa aspoň 0,5) a v bezpečnej zóne', () => {
  for (const sek of ODPOCTY) {
    const s = stavPre('badgers', sek);
    const c = casy(sek);
    for (let f = 0; f < c.snimkov; f++) {
      const kredit = nakresli(falosnyKontext(), f / FPS, s).filter((p) => p.text === KREDIT);
      assert.ok(kredit.length >= 1, `${sek}s snímok ${f}: chýba kredit`);
      assert.ok(Math.max(...kredit.map((p) => p.alfa)) >= 0.5, `${sek}s snímok ${f}: kredit je priesvitný`);
      for (const p of kredit) assert.ok(vBezpecnejZone(p));
    }
  }
});

test('kreditný riadok má presne text licencie API', () => {
  assert.equal(KREDIT, 'Puzzle by ARLing, arling.sk');
  const index = JSON.parse(readFileSync(join(API, 'index.json'), 'utf8'));
  assert.match(index.licence.free, /Puzzle by ARLing, arling\.sk/);
});

test('stiahnuté video: kreditný riadok je aj vtedy, keď sa obrázky ešte nenačítali, a je predvolený', () => {
  const s = { ...volby({ druh: 'voles', obtiaznost: 'hard', cislo: 200, sek: 30 }) };
  assert.ok(nakresli(falosnyKontext(), 0, s).some((p) => p.text === KREDIT));
  assert.ok(nakresli(falosnyKontext(), casy(30).dlzka - 0.01, s).some((p) => p.text === KREDIT));
  assert.ok(nakresli(falosnyKontext(), 5, s, {}).some((p) => p.text === KREDIT), 'bez voľby kredit ostáva');
  assert.ok(nakresli(falosnyKontext(), 5, s, { kredit: true }).some((p) => p.text === KREDIT));
});

// TikTok Content Sharing Guidelines, Watermark Guidelines: appka nesmie do zdieľaného obsahu vložiť
// názov značky, logo, watermark, odkaz ani propagačný text. Kópia pre TikTok preto nenesie nič z toho.
test('kópia pre TikTok: v žiadnom snímku ani na žiadnom plátne nie je značka, doména ani kredit', () => {
  const znacka = /arling|\.sk\b|https?:|www\./i;
  for (const sek of ODPOCTY) {
    for (const druh of Object.keys(DRUHY)) {
      const s = stavPre(druh, sek);
      for (const t of casySnimkov(sek, 7)) {
        const ctx = falosnyKontext();
        const prvky = nakresli(ctx, t, s, { kredit: false });
        for (const p of prvky) if (p.text) assert.ok(!znacka.test(p.text), `${druh} ${sek}s t=${t}: ${p.text}`);
        // Aj to, čo sa naozaj kreslí (nielen vrátené prvky), bez značky.
        for (const [co, ...args] of ctx.volania) if (co === 'fillText' || co === 'strokeText') assert.ok(!znacka.test(String(args[0])), String(args[0]));
      }
    }
  }
});

test('kópia pre TikTok: rovnaký nadpis, pravidlo, odpočet a riešenie ako stiahnuté video, záver v bezpečnej zóne', () => {
  const sek = 20;
  const s = stavPre('otters', sek);
  const c = casy(sek);
  const texty = (t, kredit) => nakresli(falosnyKontext(), t, s, { kredit }).filter((p) => p.text && p.text !== KREDIT).map((p) => p.text);
  for (const t of [0.5, 3, c.T_KONIEC_ODPOCTU - 0.5, c.T_RIESENIE + 1]) assert.deepEqual(texty(t, false), texty(t, true), `t=${t}`);
  const zaver = nakresli(falosnyKontext(), c.dlzka - 0.1, s, { kredit: false }).filter((p) => p.text);
  assert.ok(zaver.some((p) => /How long/.test(p.text)));
  assert.ok(zaver.some((p) => /exactly one solution/.test(p.text)));
  for (const p of zaver) assert.ok(vBezpecnejZone(p), p.text);
});

// --------------------------------------------------------------------------- voľby a dáta

test('nadpis „Can you solve it in N seconds?“ a pravidlo v jednej vete', () => {
  const s = stavPre('herons', 30);
  const texty = nakresli(falosnyKontext(), 3, s).filter((p) => p.typ === 'text').map((p) => p.text);
  assert.equal(`${texty[1]} ${texty[2]}`, 'Can you solve it in 30 seconds?');
  for (const [nazov, pravidlo] of Object.values(DRUHY)) {
    assert.ok(nazov.length > 3);
    assert.ok(/[.!]$/.test(pravidlo) && pravidlo.length < 130, pravidlo);
  }
  const vlozene = texty.slice(3).join(' ');
  assert.ok(vlozene.startsWith(DRUHY.herons[1].split(' ').slice(0, 4).join(' ')));
});

test('voľby: čísla 1 až 200, tri obtiažnosti, tri odpočty, nič iné', () => {
  assert.deepEqual(volby({ druh: 'otters', obtiaznost: 'easy', cislo: '7', sek: '20' }).cislo, '007');
  assert.equal(volby({ druh: 'otters', obtiaznost: 'hard', cislo: 200, sek: 30 }).cislo, '200');
  for (const zle of [{ cislo: 0 }, { cislo: 201 }, { cislo: 1.5 }, { druh: 'toString' }, { druh: '../x' }, { obtiaznost: 'expert' }, { sek: 15 }]) {
    assert.throws(() => volby({ druh: 'otters', obtiaznost: 'easy', cislo: 1, sek: 10, ...zle }), RangeError, JSON.stringify(zle));
  }
  assert.deepEqual(OBTIAZNOSTI, ['easy', 'medium', 'hard']);
  for (let i = 0; i < 50; i++) {
    const n = nahodneCislo();
    assert.ok(n >= 1 && n <= 200);
  }
  assert.equal(nahodneCislo(() => 0.99999), 200);
  assert.equal(nahodneCislo(() => 0), 1);
});

test('cesty k API existujú pre každý druh a obtiažnosť, názov súboru je čitateľný', () => {
  for (const druh of Object.keys(DRUHY)) {
    for (const obtiaznost of OBTIAZNOSTI) {
      for (const cislo of [1, 200]) {
        const v = volby({ druh, obtiaznost, cislo, sek: 10 });
        const zaklad = join(TU, '..', cestaHlavolamu(v));
        for (const pripona of ['.json', '.svg', '-solution.svg']) assert.ok(existsSync(zaklad + pripona), zaklad + pripona);
      }
    }
  }
  assert.equal(nazovSuboru(volby({ druh: 'cranes', obtiaznost: 'medium', cislo: 42, sek: 20 })), 'arling-cranes-medium-042-20s.mp4');
});

test('SVG z API dostane rozmer podľa viewBoxu, pôvodný obsah ostane', () => {
  for (const druh of Object.keys(DRUHY)) {
    const text = readFileSync(join(API, druh, 'easy', '001.svg'), 'utf8');
    const { svg, w, h } = pripravSvg(text, 1400);
    assert.equal(Math.max(w, h), 1400);
    assert.match(svg, new RegExp(`^<svg width="${w}" height="${h}"`));
    assert.match(svg, /font-family=/);
    assert.equal(svg.length > text.length, true);
    assert.ok(svg.endsWith(text.slice(-40)));
  }
  assert.throws(() => pripravSvg('<svg></svg>'), /viewbox/);
});

test('zalamovanie textu nepresiahne šírku, ak sa dá', () => {
  const ctx = falosnyKontext();
  ctx.font = '400 38px x';
  for (const [, pravidlo] of Object.values(DRUHY)) {
    for (const r of zalom(ctx, pravidlo, 820)) assert.ok(ctx.measureText(r).width <= 820 || !r.includes(' '), r);
  }
});
