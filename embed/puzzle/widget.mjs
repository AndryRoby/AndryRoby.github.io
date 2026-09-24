/* The embeddable ARLing puzzle: one puzzle, Check, Show solution, nothing else.
 *
 * Query string:
 *   ?kind=badgers&difficulty=easy&id=badgers-easy-001   a puzzle from the API
 *   ?kind=badgers&date=2026-09-18                       the daily puzzle
 *   ?kind=badgers&date=today                            today's daily puzzle
 *   ?kind=badgers&difficulty=hard&seed=my-own-string    generated here and now
 * kind is the only one that is always needed. Without difficulty the page
 * takes easy, and without id it takes the first puzzle of that difficulty.
 *
 * Where the puzzle comes from:
 *   id     /api/puzzles/v1/<kind>/<difficulty>/<index>.json, a static file
 *   date   /api/puzzles/v1/today/<kind>.json for today, otherwise the packed
 *          day from /games/<kind>/dni/<YYYY-MM>.json unpacked by the game's
 *          own plan.mjs
 *   seed   generated in this browser by the game's own generator.mjs
 *
 * Where the rules come from: /games/<kind>/logika.mjs and
 * /games/<kind>/generator.mjs, the very modules the daily game runs. Nothing
 * is copied; they are imported by URL. Drawing and input are in kresli.mjs.
 *
 * What it does not do: no cookies, no localStorage, no analytics, no account,
 * no network call to anything but arling.sk's own static files. It tells the
 * page that embeds it two things, and only those two:
 *   postMessage({ type: 'arling-puzzle', event: 'loaded', id, kind, difficulty })
 *   postMessage({ type: 'arling-puzzle', event: 'solved', id, kind, difficulty })
 */
import { DRUHY, obal } from './kresli.mjs';
import { naApi, KINDS, DIFFICULTIES } from '/api/tvary.mjs';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const par = (meno, zaloha) => (q.get(meno) || zaloha || '').trim();

const stav = {
  kind: null, difficulty: 'easy', id: null, p: null, st: null,
  L: null, G: null, druh: null, vyber: null, zle: null, hotovo: false,
  riesenie: false, pomocny: {},
};

const doskaEl = $('doska');
const stavEl = $('stav');
const padEl = $('pad');
const titulEl = $('titul');
const checkBtn = $('check');
const riesBtn = $('riesenie');

function povedz(text, trieda = '') {
  stavEl.textContent = text;
  stavEl.className = 'stav ' + trieda;
}

function posli(event) {
  const sprava = { type: 'arling-puzzle', event, id: stav.id, kind: stav.kind, difficulty: stav.difficulty };
  try { if (window.parent && window.parent !== window) window.parent.postMessage(sprava, '*'); } catch { /* cross origin */ }
  try { window.dispatchEvent(new CustomEvent('arling-puzzle', { detail: sprava })); } catch { /* starý prehliadač */ }
}

/* Výška obsahu pre rodičovskú stránku: embed.js a /api/ podľa nej nastavia
   iframe, aby v ňom nikdy nebol vlastný scrollbar (Andrej 24. 9. 2026). Posiela
   sa len pri zmene, cez jeden requestAnimationFrame, žiadna slučka. */
let poslednaVyska = 0, cakaVyska = false;
/* Režim prirodzenej výšky zapne len rodič, ktorý výšku naozaj počúva (embed.js,
   /api/): pošle { type: 'arling-puzzle-host', event: 'auto-height' }. Obyčajný
   iframe s pevnou výškou ostane pri vyplnení celého rámu. */
window.addEventListener('message', (e) => {
  const m = e.data;
  if (e.source !== window.parent || !m || m.type !== 'arling-puzzle-host' || m.event !== 'auto-height') return;
  document.documentElement.classList.add('auto-vyska');
  hlasVysku();
});
function hlasVysku() {
  if (!(window.parent && window.parent !== window)) return;
  const posliVysku = () => {
    cakaVyska = false;
    // Výška obsahu (body), nie dokumentu: scrollHeight koreňa nikdy neklesne pod výšku rámu.
    const h = Math.ceil(document.body.getBoundingClientRect().height);
    if (!h || h === poslednaVyska) return;
    poslednaVyska = h;
    try { window.parent.postMessage({ type: 'arling-puzzle', event: 'size', height: h, id: stav.id }, '*'); } catch { /* cross origin */ }
  };
  const naplanuj = () => { if (!cakaVyska) { cakaVyska = true; requestAnimationFrame(posliVysku); } };
  naplanuj();
  if (typeof ResizeObserver === 'function' && !hlasVysku.pozor) {
    hlasVysku.pozor = new ResizeObserver(naplanuj);
    hlasVysku.pozor.observe(document.body);
  }
}

/* ── Odkiaľ sa berie hlavolam ───────────────────────────────────────────── */

const API = '/api/puzzles/v1/';
const cislo3 = (i) => String(i).padStart(3, '0');

async function nacitajJson(url) {
  const r = await fetch(url, { credentials: 'omit', cache: 'default' });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.json();
}

/* Nastavenia generátora pre úroveň, z plánu tej istej hry. Rovnaký recept ako
   ops/puzzle-books/postav.mjs optsUrovne pre týchto desať hier: všetko z
   plan.UROVNE okrem popisu, plus počet hviezd pri Hedgehogs. */
function optsUrovne(kind, plan, uroven) {
  const u = plan.UROVNE[uroven];
  if (!u) throw new Error('Unknown difficulty: ' + uroven);
  const o = {};
  for (const [k, v] of Object.entries(u)) if (k !== 'label') o[k] = v;
  if (kind === 'hedgehogs' && plan.STARS != null) o.stars = plan.STARS;
  return o;
}

function dnesBratislava(G) {
  if (typeof G.todayBratislava === 'function') return G.todayBratislava();
  return new Date().toISOString().slice(0, 10);
}

async function zdroj(kind, difficulty, G, plan) {
  const id = par('id');
  const seed = par('seed');
  const date = par('date');

  if (id) {
    const m = /^([a-z]+)-(easy|medium|hard)-(\d{3})$/.exec(id);
    if (!m) throw new Error('Bad id: ' + id);
    return { p: await nacitajJson(API + m[1] + '/' + m[2] + '/' + m[3] + '.json'), id, difficulty: m[2] };
  }

  if (date) {
    const dnes = dnesBratislava(G);
    const den = date === 'today' ? dnes : date;
    if (den === dnes) {
      try {
        const x = await nacitajJson(API + 'today/' + kind + '.json');
        return { p: x, id: x.id, difficulty: x.difficulty };
      } catch { /* dnešok sa ešte neprestaval, spočíta sa nižšie */ }
    }
    const mesiac = den.slice(0, 7);
    const dni = await nacitajJson('/games/' + kind + '/dni/' + mesiac + '.json');
    const zaznam = dni.find((z) => z.d === den);
    if (!zaznam) throw new Error('No daily puzzle for ' + den);
    const raw = plan.rozbal(zaznam);
    return { p: { ...naApi(kind, raw), difficulty: raw.uroven || plan.urovenDna(den), date: den }, id: kind + '-' + den, difficulty: raw.uroven || plan.urovenDna(den) };
  }

  if (seed) {
    const o = optsUrovne(kind, plan, difficulty);
    const raw = plan.vyber(difficulty, (k) => G.generateSeeded(seed, seed + (k ? '#' + k : ''), o));
    return { p: { ...naApi(kind, raw), difficulty, seed }, id: kind + '-' + difficulty + '-' + seed, difficulty };
  }

  const index = Number(par('index', '1')) || 1;
  const cele = kind + '-' + difficulty + '-' + cislo3(index);
  return { p: await nacitajJson(API + kind + '/' + difficulty + '/' + cislo3(index) + '.json'), id: cele, difficulty };
}

/* ── Kreslenie a ovládanie ──────────────────────────────────────────────── */

function prekresli() {
  const o = { G: stav.G, vyber: stav.vyber, zle: stav.zle, riesenie: stav.riesenie };
  const data = stav.riesenie ? stav.riesenieSt : stav.st;
  const kus = stav.druh.svg(stav.p, data, o);
  const popis = (stav.riesenie ? 'Solution of ' : '') + stav.kind + ' ' + stav.difficulty
    + ', ' + stav.p.size + ' by ' + stav.p.size + ' grid';
  doskaEl.innerHTML = obal(kus, popis);
}

function padTlacidla() {
  if (!stav.druh.pad) { padEl.hidden = true; return; }
  padEl.hidden = false;
  padEl.innerHTML = stav.druh.pad(stav.p).map((x) => '<button type="button" data-n="' + x + '">' + x + '</button>').join('')
    + '<button type="button" data-n="0" class="zmaz">Clear</button>';
}

function poKliku(zmenene) {
  if (!zmenene) return;
  stav.zle = null;
  prekresli();
  const r = stav.druh.kontrola(stav.L, stav.G, stav.p, stav.st);
  if (r.hotovo && !stav.hotovo) {
    stav.hotovo = true;
    povedz('Solved. Well done.', 'ok');
    posli('solved');
  } else if (!r.hotovo) {
    stav.hotovo = false;
    if (stavEl.textContent) povedz('');
  }
}

function naDosku(e) {
  if (stav.riesenie) return;
  const el = e.target.closest('[data-c],[data-e]');
  if (!el) return;
  const spat = e.shiftKey || e.button === 2;
  if (el.hasAttribute('data-e')) {
    poKliku(stav.druh.klik(stav.p, stav.st, { typ: 'hrana', e: Number(el.dataset.e), spat, stav: stav.pomocny }));
    return;
  }
  const i = Number(el.dataset.c);
  if (stav.druh.pad) { stav.vyber = i; prekresli(); return; }
  poKliku(stav.druh.klik(stav.p, stav.st, { typ: 'bunka', i, spat, stav: stav.pomocny }));
}

function naKlavesu(e) {
  if (stav.riesenie) return;
  const n = stav.p.size;
  if (stav.vyber != null && /^[0-9]$/.test(e.key)) {
    poKliku(stav.druh.klik(stav.p, stav.st, { typ: 'cislo', i: stav.vyber, hodnota: Number(e.key), stav: stav.pomocny }));
    e.preventDefault();
    return;
  }
  if (stav.vyber != null && (e.key === 'Backspace' || e.key === 'Delete')) {
    poKliku(stav.druh.klik(stav.p, stav.st, { typ: 'cislo', i: stav.vyber, hodnota: 0, stav: stav.pomocny }));
    e.preventDefault();
    return;
  }
  const smer = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -n, ArrowDown: n }[e.key];
  if (smer != null && stav.vyber != null) {
    const dalej = stav.vyber + smer;
    if (dalej >= 0 && dalej < n * n && (Math.abs(smer) !== 1 || ((dalej / n) | 0) === ((stav.vyber / n) | 0))) {
      stav.vyber = dalej;
      prekresli();
    }
    e.preventDefault();
  }
}

function naPad(e) {
  const b = e.target.closest('button[data-n]');
  if (!b || stav.vyber == null || stav.riesenie) return;
  poKliku(stav.druh.klik(stav.p, stav.st, { typ: 'cislo', i: stav.vyber, hodnota: Number(b.dataset.n), stav: stav.pomocny }));
}

function skontroluj() {
  if (stav.riesenie) return;
  const r = stav.druh.kontrola(stav.L, stav.G, stav.p, stav.st);
  stav.zle = r.zle;
  prekresli();
  if (r.hotovo) {
    if (!stav.hotovo) { stav.hotovo = true; posli('solved'); }
    povedz('Solved. Well done.', 'ok');
  } else if (!r.znamok) povedz('Nothing marked yet.');
  else if (r.zle.size) povedz(r.zle.size === 1 ? 'One mark is wrong.' : r.zle.size + ' marks are wrong.', 'zle');
  else povedz('Everything so far is right. Keep going.', 'ok');
}

function prepniRiesenie() {
  stav.riesenie = !stav.riesenie;
  riesBtn.textContent = stav.riesenie ? 'Hide solution' : 'Show solution';
  riesBtn.setAttribute('aria-pressed', String(stav.riesenie));
  checkBtn.disabled = stav.riesenie;
  padEl.hidden = stav.riesenie || !stav.druh.pad;
  povedz(stav.riesenie ? 'This is the answer.' : '');
  prekresli();
}

/* ── Štart ─────────────────────────────────────────────────────────────── */

async function start() {
  const kind = par('kind', 'badgers').toLowerCase();
  if (!KINDS.includes(kind)) throw new Error('Unknown kind: ' + kind);
  let difficulty = par('difficulty', 'easy').toLowerCase();
  if (!DIFFICULTIES.includes(difficulty)) difficulty = 'easy';

  const [L, G, plan] = await Promise.all([
    import('/games/' + kind + '/logika.mjs'),
    import('/games/' + kind + '/generator.mjs'),
    import('/games/' + kind + '/plan.mjs'),
  ]);
  const z = await zdroj(kind, difficulty, G, plan);

  stav.kind = kind;
  stav.difficulty = z.difficulty || difficulty;
  stav.id = z.p.id || z.id;
  /* Zápis API hovorí `size`, generátory hier hovoria `n`. Doplní sa tu raz,
     aby kresli.mjs aj generator.mjs čítali to isté číslo pod tým menom, na
     ktoré sú zvyknuté. */
  stav.p = { ...z.p, n: z.p.size };
  stav.L = L;
  stav.G = G;
  stav.druh = DRUHY[kind];
  stav.st = stav.druh.novy(stav.p, G);
  stav.riesenieSt = stav.druh.zoSolution(stav.p, G);

  titulEl.textContent = stav.id;
  document.title = stav.id + ' | ARLing puzzle';
  padTlacidla();
  prekresli();
  povedz('');

  doskaEl.addEventListener('click', naDosku);
  doskaEl.addEventListener('contextmenu', (e) => { e.preventDefault(); naDosku(e); });
  padEl.addEventListener('click', naPad);
  checkBtn.addEventListener('click', skontroluj);
  riesBtn.addEventListener('click', prepniRiesenie);
  document.addEventListener('keydown', naKlavesu);
  document.body.dataset.pripravene = '1';
  posli('loaded');
}

start().catch((e) => {
  document.body.dataset.chyba = '1';
  povedz('This puzzle could not be loaded. ' + e.message, 'zle');
  if (doskaEl) doskaEl.innerHTML = '';
});
