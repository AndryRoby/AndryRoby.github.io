// Testy čakacej listiny (A-189, brána pokus 1, nález 1; AGENTS.md bod 12): jeden dopyt naraz, adresa sa počas odosielania nedá zmeniť,
// odpoveď staršieho dopytu nič neprepíše (oba poradia), časový limit, 409 ako úspech, chyby nechajú adresu a nič neukážu ako hotové,
// Umami len jazyk, miesto a platforma, po schválení appky odkaz namiesto formulára.
// node --test products/arling-sk/feed-doctor/agent-ready/cakacia.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.location = { hostname: 'arling.sk', origin: 'https://arling.sk', search: '' };
globalThis.document = { readyState: 'complete', documentElement: { lang: 'sk' }, querySelectorAll: () => [], addEventListener() {} };
const { wire, deps, SOURCE, ENDPOINT } = await import('./cakacia.mjs');
const { EU_UI } = await import('./i18n.mjs?v=3');
const T = EU_UI.sk.pro;

const posluchac = (o) => { o._l = {}; o.addEventListener = (t, f) => { (o._l[t] ||= []).push(f); }; o.fire = async (t, e) => { for (const f of o._l[t] || []) await f(e); }; return o; };
function formular({ jazyk = 'sk', place = 'page', shopify } = {}) {
  const attrs = {};
  const email = posluchac({ value: '', readOnly: false, checkValidity() { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.value); }, setAttribute(k, v) { attrs[k] = v; }, removeAttribute(k) { delete attrs[k]; }, focus() {} });
  const pasca = { value: '', readOnly: false };
  const tlacidlo = { textContent: T.button, disabled: false };
  const chyba = { textContent: '', hidden: true };
  const nadpis = { focus() { stav.fokus = true; } };
  const stav = { hidden: true, querySelector: () => nadpis, focus() {} };
  const cakanie = { hidden: false };
  const odkaz = { href: '/agent-ready/' };
  const live = { hidden: true, querySelector: () => odkaz };
  const sekcia = { querySelector: (s) => ({ '[data-pro-stav]': stav, '[data-pro-cakanie]': cakanie, '[data-pro-live]': live })[s] || null };
  const dataset = { jazyk, place }; if (shopify) dataset.shopify = shopify;
  const form = posluchac({ dataset, hidden: true, closest: () => sekcia, parentNode: sekcia,
    querySelector: (s) => ({ 'input[type="email"]': email, 'input[name="website"]': pasca, 'button[type="submit"]': tlacidlo, '[data-pro-chyba]': chyba })[s] || null });
  return { form, email, pasca, tlacidlo, chyba, stav, cakanie, live, odkaz, attrs };
}
const odlozeny = () => { let ok, zle; const p = new Promise((a, b) => { ok = a; zle = b; }); return { p, ok, zle }; };
const odosli = (ui) => ui.form.fire('submit', { preventDefault() {} });
const chvila = () => new Promise((r) => setTimeout(r, 0));
// Časovače pod kontrolou testu: limit vyprší, len keď ho test spustí.
let casovace = [];
// F5 (7. 11. 2026): zber adries je predvolene zastavený (deps.zberOtvoreny false); testy odosielania nižšie ho otvoria, aby logika
// formulára ostala overená pre prípad, že by sa listina niekedy znova otvorila. Zastavený zber overuje posledný test.
function nastav({ fetch, appState = Promise.resolve({ live: false, url: '' }), zberOtvoreny = true }) {
  casovace = []; const meranie = [];
  Object.assign(deps, { fetch, appState, zberOtvoreny, timeoutMs: 15000, setTimeout: (f) => { casovace.push(f); return casovace.length; }, clearTimeout: (i) => { if (i) casovace[i - 1] = null; }, track: (n, d) => meranie.push([n, d]) });
  return meranie;
}
const vyprsi = () => { for (const f of casovace.splice(0)) if (f) f(); };
const neskoncene = (ui) => { assert.equal(ui.stav.hidden, true, 'nič nie je hotové'); assert.equal(ui.form.hidden, false, 'formulár ostáva'); assert.equal(ui.tlacidlo.disabled, false); assert.equal(ui.email.readOnly, false); };

test('dvojité odoslanie pošle jeden dopyt; 409 (už v zozname) je úspech; meranie nesie len jazyk, miesto a platformu', async () => {
  const d = odlozeny(), poslane = [];
  const meranie = nastav({ fetch: (u, o) => { poslane.push([u, JSON.parse(o.body)]); return d.p; } });
  const ui = formular({ place: 'result', shopify: 'yes' }); wire(ui.form); assert.equal(ui.form.hidden, false);
  ui.email.value = 'jana@example.org';
  const a = odosli(ui), b = odosli(ui); await chvila();
  assert.equal(poslane.length, 1); assert.equal(ui.tlacidlo.disabled, true); assert.equal(ui.tlacidlo.textContent, T.sending);
  assert.equal(ui.email.readOnly, true, 'počas odosielania sa adresa nedá zmeniť'); assert.equal(ui.pasca.readOnly, true);
  assert.deepEqual(poslane[0], [ENDPOINT, { email: 'jana@example.org', source: SOURCE, lang: 'sk', hp: '' }]);
  d.ok({ ok: false, status: 409 }); await Promise.all([a, b]);
  assert.equal(ui.stav.hidden, false); assert.equal(ui.form.hidden, true); assert.equal(ui.stav.fokus, true);
  assert.deepEqual(meranie, [['ar_pro_waitlist', { lang: 'sk', place: 'result', shopify: 'yes' }]]);
  assert.ok(!JSON.stringify(meranie).includes('example.org'), 'adresa nejde do merania');
});
test('chyby 400, 429, 500 a sieť: adresa ostane, správna veta, nič hotové, formulár odomknutý', async () => {
  for (const [odpoved, veta] of [[{ ok: false, status: 400 }, T.errors.invalid], [{ ok: false, status: 429 }, T.errors.rate], [{ ok: false, status: 500 }, T.errors.server], [null, T.errors.network]]) {
    const meranie = nastav({ fetch: async () => { if (!odpoved) throw new TypeError('Failed to fetch'); return odpoved; } });
    const ui = formular(); wire(ui.form); ui.email.value = 'jana@example.org';
    await odosli(ui);
    assert.equal(ui.email.value, 'jana@example.org'); assert.equal(ui.chyba.hidden, false); assert.equal(ui.chyba.textContent, veta);
    assert.equal(ui.attrs['aria-invalid'], 'true'); neskoncene(ui); assert.deepEqual(meranie, []);
  }
});
test('server neodpovie: po limite veta o neskorej odpovedi (nie „neodoslala sa“) a formulár sa odomkne; neskorá odpoveď potom nič neprepíše', async () => {
  const pomaly = odlozeny();
  const meranie = nastav({ fetch: () => pomaly.p });
  const ui = formular(); wire(ui.form); ui.email.value = 'jana@example.org';
  const beh = odosli(ui); await chvila();
  assert.equal(ui.tlacidlo.disabled, true);
  vyprsi(); await beh;
  // Dopyt mohol na server prísť (brána pokus 2, na vedomie 2): veta netvrdí, že sa adresa neodoslala, a sľubuje, že sa nezdvojí.
  assert.equal(ui.chyba.textContent, T.errors.timeout); assert.notEqual(T.errors.timeout, T.errors.network); neskoncene(ui);
  for (const lang of ['en', 'sk', 'de']) assert.ok(!/not sent|neodoslala|nicht gesendet/.test(EU_UI[lang].pro.errors.timeout), lang);
  pomaly.ok({ ok: true, status: 200 }); await chvila(); await chvila();
  neskoncene(ui); assert.deepEqual(meranie, [], 'neskorý úspech starého dopytu sa neráta');
});
test('odpovede v oboch poradiach: odpoveď staršieho dopytu nikdy neprepíše stav novšieho', async () => {
  // Poradie 1: starý dopyt vyprší, nový uspeje, starý potom odpovie chybou; ostane úspech nového.
  {
    const stary = odlozeny(), novy = odlozeny(), fronta = [stary, novy];
    const meranie = nastav({ fetch: () => fronta.shift().p });
    const ui = formular(); wire(ui.form); ui.email.value = 'jana@example.org';
    const b1 = odosli(ui); await chvila(); vyprsi(); await b1;
    const b2 = odosli(ui); await chvila();
    novy.ok({ ok: true, status: 200 }); await b2;
    assert.equal(ui.stav.hidden, false);
    stary.zle(new TypeError('late')); await chvila(); await chvila();
    assert.equal(ui.stav.hidden, false); assert.equal(ui.chyba.hidden, true, 'stará chyba sa neukáže'); assert.equal(meranie.length, 1);
  }
  // Poradie 2: starý dopyt vyprší, počas nového starý odpovie úspechom; nový potom zlyhá; nič nie je hotové.
  {
    const stary = odlozeny(), novy = odlozeny(), fronta = [stary, novy];
    const meranie = nastav({ fetch: () => fronta.shift().p });
    const ui = formular(); wire(ui.form); ui.email.value = 'jana@example.org';
    const b1 = odosli(ui); await chvila(); vyprsi(); await b1;
    const b2 = odosli(ui); await chvila();
    stary.ok({ ok: true, status: 200 }); await chvila(); await chvila();
    assert.equal(ui.stav.hidden, true, 'starý úspech nič neukáže'); assert.equal(ui.tlacidlo.disabled, true, 'nový dopyt stále beží');
    novy.ok({ ok: false, status: 500 }); await b2;
    assert.equal(ui.chyba.textContent, T.errors.server); neskoncene(ui); assert.deepEqual(meranie, []);
  }
});
test('ak sa adresa napriek zámku zmení (napríklad skriptom), úspech sa neukáže pre inú adresu', async () => {
  const d = odlozeny();
  const meranie = nastav({ fetch: () => d.p });
  const ui = formular(); wire(ui.form); ui.email.value = 'jana@exmple.org';
  const beh = odosli(ui); await chvila();
  ui.email.value = 'jana@example.org';
  d.ok({ ok: true, status: 200 }); await beh;
  assert.equal(ui.chyba.textContent, T.errors.changed); neskoncene(ui); assert.deepEqual(meranie, []);
});
test('neplatná adresa nič neodošle; formulár sa zapojí len raz', async () => {
  let pocet = 0; nastav({ fetch: async () => { pocet++; return { ok: true, status: 200 }; } });
  const ui = formular(); wire(ui.form); wire(ui.form); ui.email.value = 'nie-je-adresa';
  await odosli(ui);
  assert.equal(pocet, 0); assert.equal(ui.chyba.textContent, T.errors.invalid);
  assert.equal(ui.form._l.submit.length, 1, 'jeden posluchač');
});
test('po schválení appky (stranka.json live) zmizne veta o čakaní aj formulár a ukáže sa odkaz na appku', async () => {
  nastav({ fetch: async () => ({ ok: true, status: 200 }), appState: Promise.resolve({ live: true, url: 'https://arling.sk/agent-ready/?utm_source=x' }) });
  const ui = formular(); wire(ui.form); await chvila();
  assert.equal(ui.cakanie.hidden, true); assert.equal(ui.live.hidden, false); assert.equal(ui.form.hidden, true);
  assert.equal(ui.odkaz.href, 'https://arling.sk/agent-ready/?utm_source=x');
  // Miesto ide do utm_medium (na vedomie 4 brány pokus 2): kalendár nemeria ako výsledok kontroly.
  nastav({ fetch: async () => ({ ok: true, status: 200 }), appState: Promise.resolve({ live: true, url: 'https://arling.sk/agent-ready/?utm_source=agent-ready-check&utm_medium=result&utm_campaign=product-check' }) });
  const kalendar = formular({ place: 'calendar' }); wire(kalendar.form); await chvila();
  assert.equal(kalendar.odkaz.href, 'https://arling.sk/agent-ready/?utm_source=agent-ready-check&utm_medium=calendar&utm_campaign=product-check');
  nastav({ fetch: async () => ({ ok: true, status: 200 }), appState: Promise.resolve({ live: false, url: '' }) });
  const druhy = formular(); wire(druhy.form); await chvila();
  assert.equal(druhy.cakanie.hidden, false); assert.equal(druhy.live.hidden, true); assert.equal(druhy.form.hidden, false);
});
test('F5: zastavený zber (appka je v Shopify App Store od 2. 11. 2026): formulár sa neotvorí ani neodošle, veta o čakaní zmizne a veta o App Store sa ukáže aj bez odpovede stranka.json', async () => {
  let pocet = 0;
  const meranie = nastav({ fetch: async () => { pocet++; return { ok: true, status: 200 }; }, zberOtvoreny: false });
  const ui = formular(); wire(ui.form); await chvila();
  assert.equal(ui.form.hidden, true, 'formulár ostáva skrytý');
  assert.equal(ui.cakanie.hidden, true, 'veta „čaká na posúdenie“ zmizne'); assert.equal(ui.live.hidden, false, 'veta o App Store je viditeľná');
  assert.equal(ui.form._l.submit, undefined, 'bez posluchača odoslania');
  ui.email.value = 'jana@example.org'; await odosli(ui);
  assert.equal(pocet, 0, 'nič sa neodoslalo'); assert.deepEqual(meranie, []);
  // pri živom stave dostane odkaz miesto v utm_medium ako doteraz (kalendár)
  nastav({ fetch: async () => ({ ok: true, status: 200 }), zberOtvoreny: false, appState: Promise.resolve({ live: true, url: 'https://arling.sk/agent-ready/?utm_source=agent-ready-check&utm_medium=result&utm_campaign=product-check' }) });
  const kalendar = formular({ place: 'calendar' }); wire(kalendar.form); await chvila();
  assert.equal(kalendar.form.hidden, true); assert.equal(kalendar.live.hidden, false);
  assert.equal(kalendar.odkaz.href, 'https://arling.sk/agent-ready/?utm_source=agent-ready-check&utm_medium=calendar&utm_campaign=product-check');
});
