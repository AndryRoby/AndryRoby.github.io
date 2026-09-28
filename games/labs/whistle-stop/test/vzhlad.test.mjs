// Vzhľad a pravidlá M0: kontrast palety, bábky zo 6 dielov bez alokácií v snímke, stránka noindex s CSP self,
// žiadne pomlčky em a en v texte hry, znížený pohyb (skill arling-appka Overenie, GDD 5.7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { DEN, NOC, kontrast } from '../paleta.mjs';
import { DIELY, kostym, spriteKostymu, novyChodec, krokBabky, kresliBabku, pozaChodze, UHOL_NOHY, STAV } from '../babky.mjs';

const DIR = fileURLToPath(new URL('..', import.meta.url));

test('kontrast: text UI aspoň 4,5 : 1, veľké čísla a značky aspoň 3 : 1 (GDD 4.1)', () => {
  assert.ok(kontrast(DEN.atrament, DEN.papier) >= 13, 'atrament na papieri');
  assert.ok(kontrast(DEN.hlina, DEN.papier) >= 4.5, 'hlina na papieri (vypnuté tlačidlo, popis)');
  assert.ok(kontrast(DEN.atrament, DEN.lampa) >= 4.5, 'atrament na lampe (hlavné tlačidlo)');
  assert.ok(kontrast(DEN.papier, DEN.atrament) >= 4.5, 'papier na atramente (zapnutý prepínač)');
  assert.ok(kontrast(DEN.papier, DEN.noc) >= 4.5, 'papier na noci');
  assert.ok(kontrast(DEN.atrament, DEN.piesok) >= 4.5, 'atrament na piesku');
  assert.ok(kontrast(DEN.papier, DEN.skala) >= 3, 'veľké písmo na skale');
  assert.ok(Math.abs(kontrast(DEN.atrament, DEN.papier) - 13.22) < 0.05, 'zhoda s tabuľkou GDD 4.1');
  // štít v noci: atrament na nočnom papieri
  assert.ok(kontrast(NOC.atrament, NOC.papier) >= 4.5, 'nočný štít');
  assert.ok(kontrast(NOC.lampa, NOC.drevo) >= 3, 'rozsvietené okno na nočnej fasáde');
});

// falošné plátno: počíta operácie, nič nekreslí
function falosnePlatno() {
  const ops = {};
  const ctx = new Proxy({}, {
    get: (_, k) => {
      if (k === 'canvas') return null;
      return (...a) => { ops[k] = (ops[k] || 0) + 1; return k === 'measureText' ? { width: 10 } : undefined; };
    },
    set: () => true
  });
  let vytvorenych = 0;
  const platno = (w, h) => { vytvorenych++; return { width: w, height: h, getContext: () => ctx }; };
  return { ctx, ops, platno, vytvorenych: () => vytvorenych };
}

test('bábka má 6 dielov, kostým zo semienka je deterministický, diely sa nakreslia raz do 7 plátien', () => {
  assert.equal(DIELY.length, 6);
  assert.deepEqual(kostym(42), kostym(42));
  assert.notDeepEqual(kostym(1), kostym(2));
  const f = falosnePlatno();
  const spr = spriteKostymu(kostym(7), DEN, 1, f.platno);
  assert.equal(f.vytvorenych(), 7, '6 dielov a vrece');
  assert.deepEqual(Object.keys(spr.diely).sort(), DIELY.slice().sort());
});

test('snímka bábky: len transformácie a drawImage, žiadne nové plátno ani nové polia stavu', () => {
  const f = falosnePlatno();
  const spr = spriteKostymu(kostym(3), DEN, 1, f.platno);
  const pred = f.vytvorenych();
  const b = novyChodec(0); b.aktivny = true; b.stav = STAV.IDE; b.nesie = true;
  const kluce = Object.keys(b).join();
  for (const k in f.ops) delete f.ops[k];
  for (let i = 0; i < 200; i++) { krokBabky(b, 1 / 60); kresliBabku(f.ctx, spr, b, 100, 100, 1); }
  assert.equal(f.vytvorenych(), pred, 'žiadne nové plátno v snímke');
  assert.equal(Object.keys(b).join(), kluce, 'krok nepridáva polia');
  assert.deepEqual(Object.keys(f.ops).sort(), ['drawImage', 'rotate', 'setTransform', 'translate']);
  assert.equal(f.ops.drawImage, 200 * 7, '6 dielov a vrece na snímku');
});

test('chôdza podľa GDD 4.3: nohy v protifáze do 22°, trup hore a dole najviac 2 px, klobúk dobieha', () => {
  for (let f = 0; f < 1; f += 0.05) {
    const p = pozaChodze(f);
    assert.ok(Math.abs(p.nohaP + p.nohaZ) < 1e-12);
    assert.ok(Math.abs(p.nohaP) <= UHOL_NOHY + 1e-12);
    assert.ok(p.bob <= 0 && p.bob >= -2);
  }
  const b = novyChodec(1); b.stav = STAV.IDE; b.v = 45;
  let maxRozdiel = 0;
  for (let i = 0; i < 240; i++) { krokBabky(b, 1 / 60); maxRozdiel = Math.max(maxRozdiel, Math.abs(b.hy - b.bob)); }
  assert.ok(maxRozdiel > 0.05 && maxRozdiel < 2.5, `klobúk dobieha o ${maxRozdiel.toFixed(2)} px`);
});

test('stránka: noindex, CSP self bez cudzích zdrojov, písmo ARLing Draw Text je pri hre', () => {
  const html = readFileSync(join(DIR, 'index.html'), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self';/);
  assert.doesNotMatch(csp, /unsafe-inline|https?:/);
  assert.doesNotMatch(html, /src="https?:|href="https?:/, 'žiadne CDN');
  assert.ok(existsSync(join(DIR, 'ARLingDrawText-VF.woff2')));
  assert.match(readFileSync(join(DIR, 'whistle.css'), 'utf8'), /ARLing Draw Text/);
  assert.doesNotMatch(html, /<script>|style="/, 'nič inline (CSP)');
});

test('žiadne pomlčky em a en v súboroch hry', () => {
  const zle = [];
  for (const f of readdirSync(DIR)) {
    if (!/\.(mjs|html|css|md)$/.test(f)) continue;
    const t = readFileSync(join(DIR, f), 'utf8');
    if (/[–—]/.test(t)) zle.push(f);
  }
  assert.deepEqual(zle, []);
});

test('znížený pohyb: CSS aj hra ho rešpektujú (bez mierky, kamery, prachu, mincí), časy čítania ostávajú', () => {
  const css = readFileSync(join(DIR, 'whistle.css'), 'utf8');
  assert.match(css, /prefers-reduced-motion: reduce/);
  const hra = readFileSync(join(DIR, 'hra.mjs'), 'utf8');
  assert.match(hra, /prefers-reduced-motion: reduce/);
  assert.match(hra, /function pustiMincu[^]*?if \(zniz\) return;/);
  assert.match(hra, /function pustiPrach[^]*?if \(zniz\) return;/);
  assert.match(hra, /if \(zniz\) \{ camX = ciel; camV = 0; \}/);
  assert.match(hra, /anim\.tukT < 0\.15 && !zniz/);
  assert.match(hra, /setTimeout\(\(\) => \{ el\.hidden = true; \}, 4000\)/, 'správa sa číta 4 s aj pri zníženom pohybe');
});

// telo funkcie `function meno(` až po prvý riadok „}“ na začiatku
const telo = (zdroj, meno) => { const i = zdroj.indexOf(`function ${meno}(`); assert.ok(i >= 0, meno); return zdroj.slice(i, zdroj.indexOf('\n}\n', i)); };

test('výkon (nález 1 brány M0): statické vrstvy sú obrázky, plátna len živé, sprity ImageBitmap, snímka nečíta rozloženie', () => {
  const html = readFileSync(join(DIR, 'index.html'), 'utf8');
  // každé <canvas> Chrome kopíruje kompozítoru pri každom commite (stopa 28. 9.), preto len 3 živé; podlaha
  // interiéru je od pokusu 3 obrázok (prekreslenie plátna pri kúpe dalo vo Firefoxe snímku 147 ms)
  const platna = [...html.matchAll(/<canvas id="([^"]+)"/g)].map((x) => x[1]).sort();
  assert.deepEqual(platna, ['i-zivy', 'platno', 'v-dvere']);
  for (const id of ['v-nebo', 'v-hory', 'v-trat', 'v-zem', 'b-0', 'b-1', 'b-2', 'v-lopatky', 'v-popredie', 'i-podlaha', 'i-menovky']) assert.match(html, new RegExp(`<img id="${id}" `), id);
  assert.match(html, /img-src 'self' data: blob:;/, 'obrázky vrstiev sú blob URL');
  const css = readFileSync(join(DIR, 'whistle.css'), 'utf8');
  assert.match(css, /\.posuvna[^{]*\{ will-change: transform; \}/);
  const hra = readFileSync(join(DIR, 'hra.mjs'), 'utf8');
  assert.match(hra, /transferToImageBitmap/, 'diely bábok ako ImageBitmap (drawImage z plátna robí kópiu)');
  assert.match(hra, /convertToBlob/);
  assert.match(hra, /function pustiMincu[^]*?\.animate\(\[/, 'let mince na kompozítore (WAAPI)');
  // švih kamery mení len transform vrstiev
  const poloha = telo(hra, 'polohaVrstiev');
  assert.match(poloha, /style\.transform = `translate3d/);
  assert.doesNotMatch(poloha, /drawImage|getContext|style\.(left|top|width|height)/);
  // v snímke žiadne čítanie rozloženia (layout thrash)
  for (const f of ['snimka', 'kresli', 'kresliZive', 'kresliDvere', 'lista', 'transformBudov', 'transformInterieru', 'polohaVrstiev', 'kresliInterierZivy', 'krokChodcov', 'krokAnim', 'krokPocitadla', 'karta']) {
    assert.doesNotMatch(telo(hra, f), /getBoundingClientRect|clientWidth|clientHeight|offset(Width|Height|Top|Left)|getComputedStyle/, f);
  }
  // pás chodcov je nízky (do 280 jednotiek sveta), nie celé okno
  const pas = hra.match(/const PAS_Y0 = (-?\d+), PAS_Y1 = (-?\d+);/);
  assert.ok(+pas[2] - +pas[1] <= 280);
});

test('interiér (nález 3 brány M0): menovky aspoň 16 px, v pôdoryse, neprekrývajú sa ani na mobile', async () => {
  const { kresliMenovky, MIESTA_XY } = await import('../scena.mjs');
  const mena = ['Counter', 'Shelves', 'Barrels', 'Scale', 'Stove', 'Storeroom'];
  // mobil (mierka 0,508 pri 390 px a 0,8 pri širšom telefóne) len mená, počítač (1,15) aj stupeň
  for (const [mI, px, sUrovnou] of [[0.508, 16, false], [0.8, 16, false], [1.15, 17, true], [0.8, 17, true]]) {
    const pismo = px / mI, obdl = [];
    const ctx = new Proxy({}, {
      get: (_, k) => k === 'measureText' ? (t) => ({ width: t.length * pismo * 0.56 }) : k === 'rect' ? (x, y, w, h) => obdl.push({ x, y, w, h }) : () => {},
      set: () => true
    });
    kresliMenovky(ctx, DEN, [3, 3, 3, 3, 3, 3], mena, pismo, sUrovnou);
    assert.equal(obdl.length, 6);
    for (const a of obdl) {
      assert.ok(a.x >= 0 && a.x + a.w <= 720 && a.y >= -540 && a.y + a.h <= 0, `menovka v pôdoryse pri mierke ${mI}`);
      assert.ok(a.h * mI >= 16 * 1.4, 'výška štítku pre 16 px text');
      for (const b of obdl) if (a !== b) assert.ok(a.x >= b.x + b.w || b.x >= a.x + a.w || a.y >= b.y + b.h || b.y >= a.y + a.h, `menovky sa prekrývajú pri mierke ${mI}`);
    }
  }
  // miesta nábytku sa neprekrývajú a sú v pôdoryse (cieľ na dotyk aspoň 48 px pri mobile s toleranciou 24)
  for (const a of MIESTA_XY) {
    assert.ok(a.x >= 24 && a.x + a.w <= 696 && a.y >= -516 && a.y + a.h <= -24);
    assert.ok((Math.min(a.w, a.h) + 48) * 0.508 >= 48, 'cieľ na dotyk');
    for (const b of MIESTA_XY) if (a !== b) assert.ok(a.x >= b.x + b.w || b.x >= a.x + a.w || a.y >= b.y + b.h || b.y >= a.y + a.h);
  }
  const hra = readFileSync(join(DIR, 'hra.mjs'), 'utf8');
  assert.match(hra, /kresliMenovky\(o\.g, P, s\.nab, MENA_MIEST, \(lay\.jednaBudova \? 16 : 17\) \/ mI, !lay\.jednaBudova\)/, 'menovky 16 px mobil, 17 px počítač');
  assert.match(hra, /function trafMiesto/, 'výber predmetu klikom alebo ťuknutím v pôdoryse');
});

// ---------- pokus 3 brány M0: trasy a menovky ----------

test('človek zhora sa celý zmestí do polomeru trás (aj s vrecom a obrysom)', async () => {
  const { kresliClovekaZhora } = await import('../scena.mjs');
  const { POLOMER } = await import('../trasy.mjs');
  for (const [nesie, predavac] of [[false, false], [true, false], [false, true]]) {
    let lw = 0, max = 0;
    const kruh = (x, y, r) => { max = Math.max(max, Math.hypot(x, y) + r + lw / 2); };
    const ctx = new Proxy({}, {
      get: (_, k) => k === 'arc' ? (x, y, r) => kruh(x, y, r) : k === 'ellipse' ? (x, y, rx, ry) => kruh(x, y, Math.max(rx, ry))
        : k === 'fillRect' ? (x, y, w, h) => { for (const [a, b] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) kruh(a, b, 0); } : () => {},
      set: () => true
    });
    // obrys sa nastavuje až po ceste, preto sa ráta najhrubší obrys postavy (3) pri každom tvare
    lw = 3;
    kresliClovekaZhora(ctx, DEN, DEN.skala, DEN.hlina, nesie, predavac);
    assert.ok(max <= POLOMER, `postava ${nesie ? 's vrecom' : predavac ? 'predavač' : 'bez vreca'} má polomer ${max.toFixed(1)} > ${POLOMER}`);
  }
});

test('trasy v interiéri (nález 1 brány M0 pokus 2): žiadna trasa nevedie cez pult, predavača ani nábytok, tam aj späť', async () => {
  const { MIESTA_XY } = await import('../scena.mjs');
  const T = await import('../trasy.mjs');
  const P = T.prekazky(MIESTA_XY), R = T.POLOMER, pult = MIESTA_XY[0];
  // skutočné telá, do ktorých človek nesmie zasiahnuť: kusy nábytku (aj prázdne miesta) a predavač za pultom
  const tela = MIESTA_XY.map((q) => ({ x0: q.x, y0: q.y, x1: q.x + q.w, y1: q.y + q.h }));
  tela.push({ x0: pult.x + T.OD_KONCA_PULTU - R, y0: pult.y - T.PREDAVAC_NAD - R, x1: pult.x + pult.w - T.OD_KONCA_PULTU + R, y1: pult.y });
  const vzdialenost = (x, y, r) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.y0 - y, 0, y - r.y1));
  const skontrolujBod = (x, y, co) => {
    for (let i = 0; i < tela.length; i++) assert.ok(vzdialenost(x, y, tela[i]) >= R - 1e-6, `${co}: bod (${x.toFixed(1)}, ${y.toFixed(1)}) zasahuje do ${i < 6 ? ['Counter', 'Shelves', 'Barrels', 'Scale', 'Stove', 'Storeroom'][i] : 'predavača'}`);
    assert.ok(x - R >= T.PODLAHA.x0 && x + R <= T.PODLAHA.x1 && y - R >= T.PODLAHA.y0, `${co}: stena pri (${x.toFixed(1)}, ${y.toFixed(1)})`);
    if (y + R > T.PODLAHA.y1) assert.ok(x - R >= T.DVERE.x0 && x + R <= T.DVERE.x1, `${co}: dolná stena mimo dverí pri (${x.toFixed(1)}, ${y.toFixed(1)})`);
  };
  const prejdi = (ax, ay, bx, by, co) => {
    const t = T.trasa(ax, ay, bx, by, P);
    assert.ok(t, `${co}: trasa neexistuje`);
    const body = [[ax, ay], ...t];
    assert.deepEqual(body[body.length - 1], [bx, by], `${co}: trasa končí v cieli`);
    const vzorky = [];
    for (let i = 1; i < body.length; i++) {
      const [x0, y0] = body[i - 1], [x1, y1] = body[i], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; skontrolujBod(x, y, co); vzorky.push([x, y]); }
    }
    return vzorky;
  };
  // všetky ciele, ktoré hra zadáva: dvere, miesta pred pultom (celé pásmo), pohľad na každý kus
  const dvere = [T.DVERE.x, T.DVERE.y];
  const predPultom = [];
  for (let x = pult.x + T.OD_KONCA_PULTU; x <= pult.x + pult.w - T.OD_KONCA_PULTU; x += 10) predPultom.push([x, pult.y + pult.h + T.PRED_PULTOM]);
  // miesta, kde ľudia stoja, pri každej mierke interiéru (menovky majú inú veľkosť): mimo menoviek
  const { kresliMenovky } = await import('../scena.mjs');
  const mena = ['Counter', 'Shelves', 'Barrels', 'Scale', 'Stove', 'Storeroom'];
  const pohlad = [];
  for (const [mI, px, sUrovnou] of [[0.508, 16, false], [0.8, 16, false], [1.15, 17, true], [0.8, 17, true]]) {
    const pismo = px / mI;
    const ctx = new Proxy({}, { get: (_, k) => k === 'measureText' ? (t) => ({ width: t.length * pismo * 0.56 }) : () => {}, set: () => true });
    const stitky = kresliMenovky(ctx, DEN, [3, 3, 3, 3, 3, 3], mena, pismo, sUrovnou);
    for (const q of MIESTA_XY.slice(1)) {
      const b = T.bodPohladu(q, P, stitky);
      assert.ok(b, `pohľad na kus mimo menoviek pri mierke ${mI}`);
      assert.ok(!T.podStitkom(b.x, b.y, stitky));
      if (!pohlad.some((p) => p[0] === b.x && p[1] === b.y)) pohlad.push([b.x, b.y]);
    }
    for (let x = pult.x + T.OD_KONCA_PULTU; x <= pult.x + pult.w - T.OD_KONCA_PULTU; x += 10) assert.ok(!T.podStitkom(x, pult.y + pult.h + T.PRED_PULTOM, stitky), `zákazník pred pultom pod menovkou pri mierke ${mI}`);
  }
  const ciele = [dvere, ...predPultom, ...pohlad];
  let pocetTras = 0;
  // body z polovice ciest: každých 40 jednotiek, jeden na štvorec 20 x 20 (rovnaké body netreba skúšať znova)
  const priebezne = new Map();
  for (const a of ciele) for (const b of ciele) {
    if (a === b) continue;
    const v = prejdi(a[0], a[1], b[0], b[1], `(${a}) do (${b})`); pocetTras++;
    for (let k = 0; k < v.length; k += 40) { const kl = `${Math.round(v[k][0] / 20)}|${Math.round(v[k][1] / 20)}`; if (!priebezne.has(kl)) priebezne.set(kl, v[k]); }
  }
  // presmerovanie uprostred cesty (kúpa kusu pošle človeka hneď pozrieť, z miesta, kde práve je)
  for (const a of priebezne.values()) for (const b of [dvere, ...pohlad]) { prejdi(a[0], a[1], b[0], b[1], `z polovice cesty (${a.map((x) => x.toFixed(0))}) do (${b})`); pocetTras++; }
  assert.ok(pocetTras > 2000, `skontrolovaných trás ${pocetTras}`);
  console.log(`trasy interiéru: ${pocetTras} trás, ${ciele.length} cieľov, ${priebezne.size} bodov z polovice cesty, vzorka každú 1 jednotku`);
  // cesta, ktorú brána našla v pokuse 2 (spredu k policiam), obchádza pult: ide okolo jeho konca
  const k = T.trasa(360, pult.y + pult.h + T.PRED_PULTOM, pohlad[0][0], pohlad[0][1], P);
  assert.ok(k.length >= 2, 'k policiam nejde priamo cez pult');
  // hra hýbe ľuďmi v interiéri len po týchto trasách
  const hra = readFileSync(join(DIR, 'hra.mjs'), 'utf8');
  assert.match(telo(hra, 'chod'), /l\.trasa = trasa\(l\.x, l\.y, x, y, PREKAZKY\)/);
  assert.doesNotMatch(telo(hra, 'krokLudi'), /l\.(cx|cy) =/);
  assert.match(hra, /POHLAD = MIESTA_XY\.map\(\(q, i\) => bodPohladu\(q, PREKAZKY, stitky\) \|\| POHLAD\[i\]\)/, 'body pohľadu mimo nakreslených menoviek');
});

test('menovky čitateľné počas obsluhy (nález 2 brány M0 pokus 2): obrázok menoviek je nad ľuďmi', () => {
  const html = readFileSync(join(DIR, 'index.html'), 'utf8');
  // v DOM neskorší súrodenec je navrchu: podlaha, živá vrstva s ľuďmi, potom menovky
  assert.match(html, /<div id="interier" hidden><img id="i-podlaha" alt=""><canvas id="i-zivy"><\/canvas><img id="i-menovky" alt=""><\/div>/);
  const hra = readFileSync(join(DIR, 'hra.mjs'), 'utf8');
  const pi = telo(hra, 'postavInterier');
  assert.match(pi, /obraz\(EL\.menovky, w, h\)/, 'menovky sa kreslia do vlastného obrázka');
  assert.doesNotMatch(pi, /kresliMenovky\(g,/, 'nie do podlahy pod ľuďmi');
  assert.doesNotMatch(telo(hra, 'kresliInterierZivy'), /kresliMenovky/);
});

test('kreslenie bez vzorov, tieňov, filtrov a source-in (poučenia Village pre Firefox)', () => {
  for (const f of ['scena.mjs', 'babky.mjs', 'hra.mjs']) {
    const t = readFileSync(join(DIR, f), 'utf8').replace(/\/\*[^]*?\*\/|\/\/.*$/gm, '');
    assert.doesNotMatch(t, /createPattern|shadowBlur|shadowColor|\.filter\s*=|source-in|createLinearGradient|createRadialGradient/, f);
  }
});
