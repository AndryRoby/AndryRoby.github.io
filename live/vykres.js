// ARLing Live: one place that turns data.json, financie.json and experimenty.json into HTML.
// Used twice: by the browser (live.js, when the 7/30 day switch changes) and by ops/riadenie/globus/stranka.mjs,
// which writes the same HTML into index.html, so the numbers are readable without JavaScript and by search engines.
// Every value from the JSON files goes through esc(); numbers are formatted here, never with the visitor's locale.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const NBSP = ' ';
const tisice = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** 1234 -> "1,234"; "<5" -> "under 5"; null -> "unknown". */
export function pocet(n) {
  if (typeof n === 'number' && Number.isFinite(n)) return tisice(String(Math.round(n)));
  if (typeof n === 'string' && /^<\d+$/.test(n)) return 'under' + NBSP + n.slice(1);
  return 'unknown';
}
/** Value used for sorting and bar length: "<5" counts as 2.5 (somewhere between 1 and 4). */
export const hodnota = (n) => (typeof n === 'number' ? n : typeof n === 'string' && /^<\d+$/.test(n) ? Number(n.slice(1)) / 2 : 0);

/** 1291.89 -> "€1,291.89", -1266.57 -> "−€1,266.57" (minus sign U+2212, not a dash). */
export function eur(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return 'not measured';
  const [cele, centy] = Math.abs(x).toFixed(2).split('.');
  return (x < 0 ? '−' : '') + '€' + tisice(cele) + '.' + centy;
}

const MESIACE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-09-30" -> "30 Sep 2026" with non-breaking spaces, so a date never breaks over two lines. */
export function den(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || ''));
  return m ? `${Number(m[3])}${NBSP}${MESIACE[Number(m[2]) - 1]}${NBSP}${m[1]}` : 'unknown date';
}

/** Only our own paths ("/shop/") and https addresses; anything else (javascript:, //host, data:) gives no link. */
export function bezpecnaAdresa(u) {
  const s = String(u || '');
  return (/^\/(?!\/)/.test(s) || /^https:\/\/[a-z0-9.-]+(\/|$)/i.test(s)) && !/[\s"'<>]/.test(s) ? s : null;
}
/** Link to a product with an Umami event, so we can see whether this page leads people to products. */
export function odkazNaProdukt(url, text, produkt) {
  const u = bezpecnaAdresa(url);
  if (!u) return esc(text);
  return `<a href="${esc(u)}" data-umami-event="live_to_product" data-umami-event-produkt="${esc(produkt || text)}">${esc(text)}</a>`;
}

export const OKNA = { d7: 'last 7 days', d30: 'last 30 days' };
const okno = (o) => (o === 'd7' ? 'd7' : 'd30');
const mnozne = (n, jedno, viac) => (n === 1 ? `1 ${jedno}` : `${pocet(n)} ${viac}`);

/** Hlavná veta: návštevníci a objednávky, potom krajiny (na mobile stojí nad glóbusom, brána 2 P5). */
export function htmlVeta(data, o) {
  o = okno(o);
  const s = data.sucty[o];
  const objednavky = typeof s.objednavky === 'number' ? mnozne(s.objednavky, 'Etsy order', 'Etsy orders') : 'an unknown number of Etsy orders';
  const pat = typeof s.krajin5 === 'number' ? `, ${pocet(s.krajin5)} of them with at least 5 visitors` : '';
  return `<p class="live-veta"><b>${mnozne(s.navstevnici, 'visitor', 'visitors')}</b> and <b>${objednavky}</b> in the ${OKNA[o]}.</p>
<p class="live-veta2">They came from ${mnozne(s.krajin, 'country', 'countries')}${pat}.</p>`;
}

/** Čísla pod prepínačom a obdobie. */
export function htmlPrehlad(data, o) {
  o = okno(o);
  const s = data.sucty[o];
  const od = o === 'd7' ? data.obdobie.od7 : data.obdobie.od30;
  const chyba = s.chybaMerania > 0 ? ` 27 to 30${NBSP}Sep are left out (measurement error, see below).` : '';
  return `<dl class="live-cisla">
<div><dt>Visitors</dt><dd>${pocet(s.navstevnici)}</dd></div>
<div><dt>Etsy orders</dt><dd>${pocet(s.objednavky)}</dd></div>
<div><dt>Countries</dt><dd>${pocet(s.krajin)}</dd></div>
<div><dt>Left out as bots or our own visits</dt><dd>${pocet(s.vyradene)}</dd></div>
</dl>
<p class="live-obdobie">${esc(den(od))} to ${esc(den(data.obdobie.do))}.${chyba} Updated every morning, last update ${esc(den(data.aktualizovane))}.</p>`;
}

function zoznam(polozky, o, { odkaz = false, max = 8, prazdne }) {
  const zorad = [...polozky].filter((p) => hodnota(p[o]) > 0).sort((a, b) => hodnota(b[o]) - hodnota(a[o])).slice(0, max);
  if (!zorad.length) return `<p class="live-prazdne">${esc(prazdne)}</p>`;
  const top = hodnota(zorad[0][o]) || 1;
  return `<ol class="live-zoznam">${zorad.map((p) => {
    const w = Math.max(2, Math.round((hodnota(p[o]) / top) * 100));
    const meno = odkaz && p.url ? odkazNaProdukt(p.url, p.nazov, p.nazov) : esc(p.nazov);
    return `<li><span class="lz-m">${meno}</span><span class="lz-c">${esc(pocet(p[o]))}</span><span class="lz-b" style="--w:${w}%" aria-hidden="true"></span></li>`;
  }).join('')}</ol>`;
}

export const htmlKrajiny = (data, o) => zoznam(data.krajiny, okno(o), { prazdne: 'No visitors in this period.' });
export const htmlProdukty = (data, o) => zoznam(data.produkty, okno(o), { odkaz: true, prazdne: 'No visitors in this period.' });
export const htmlZdroje = (data, o) => zoznam(data.zdroje, okno(o), { prazdne: 'No visitors in this period.' });

/** Full table of countries for screen readers and search engines: both periods side by side. */
export function htmlTabulka(data) {
  const riadky = [...data.krajiny].sort((a, b) => hodnota(b.d30) - hodnota(a.d30) || hodnota(b.d7) - hodnota(a.d7) || String(a.nazov).localeCompare(String(b.nazov)));
  return `<table class="live-tabulka">
<caption>Visitors by country, ${esc(den(data.obdobie.od30))} to ${esc(den(data.obdobie.do))}</caption>
<thead><tr><th scope="col">Country</th><th scope="col">Last 7 days</th><th scope="col">Last 30 days</th></tr></thead>
<tbody>${riadky.map((k) => `<tr><th scope="row">${esc(k.nazov)}</th><td>${esc(pocet(k.d7))}</td><td>${esc(pocet(k.d30))}</td></tr>`).join('')}</tbody>
</table>`;
}

const riadok = (meno, suma, text) => `<li><span class="lr-m">${meno}</span><span class="lr-c">${suma}</span><span class="lr-p">${text}</span></li>`;
const obdobieCasti = (c) => (c.od && c.do ? `, ${esc(den(c.od))} to ${esc(den(c.do))}` : c.ku ? `, as of ${esc(den(c.ku))}` : c.do ? `, until ${esc(den(c.do))}` : '');
/** Sentence end without a double full stop ("ARLing s. r. o." already ends with one). */
const veta = (t) => (/[.!?]$/.test(String(t)) ? String(t) : String(t) + '.');

export function htmlPeniaze(f) {
  const kanaly = f.trzby.kanaly.map((k) => {
    const obj = typeof k.objednavky === 'number' && k.objednavky > 0 ? ` ${k.objednavky === 1 ? '1 order' : pocet(k.objednavky) + ' orders'}.` : '';
    const kedy = k.datum ? ` Source: ${esc(k.zdroj)}, ${esc(den(k.datum))}.` : ` Source: ${esc(k.zdroj)}.`;
    const dalej = k.odkaz ? ` ${odkazNaProdukt(k.odkaz.url, k.odkaz.text, k.odkaz.produkt)}` : '';
    return riadok(esc(k.nazov), eur(k.suma), `${esc(k.poznamka)}${obj}${kedy}${dalej}`);
  }).join('');
  const casti = f.vydavky.casti.map((c) => {
    const text = [
      c.ai ? `AI tools ${eur(c.ai)} of it.` : '',
      c.odhad ? 'Estimate.' : c.odhadom ? `${eur(c.odhadom)} of it is an estimate.` : '',
      c.poznamka ? esc(c.poznamka) : '',
      `Source: ${esc(veta(c.zdroj))}`,
    ].filter(Boolean).join(' ');
    return riadok(`${esc(c.nazov)}${obdobieCasti(c)}`, eur(c.suma), text);
  }).join('');
  const p = f.predtym;
  const predtym = p ? `<h3>Before the name ARLing</h3>
<ul class="live-riadky">${riadok(`The same company, then called ${esc(p.nazov)}, ${esc(den(p.od))} to ${esc(den(p.do))}`, eur(p.suma),
    `Mostly tax, accounting, registration and ads. ${esc(p.poznamka)} Source: bank statements.`)}</ul>
<p class="live-pozn">Result including these years: ${eur(f.vysledok.vratanePredtym)}.</p>` : '';
  return `<div class="live-peniaze">
<div class="live-velke"><p>Revenue, what customers paid</p><p class="lv-v">${eur(f.trzby.spolu)}</p><p class="lv-p">All time, without tax.</p></div>
<div class="live-velke"><p>Spent</p><p class="lv-v">${eur(f.vydavky.spolu)}</p><p class="lv-p">AI tools ${eur(f.vydavky.ai)} of it.${f.vydavky.odhadom ? ` ${eur(f.vydavky.odhadom)} is an estimate.` : ''}</p></div>
<div class="live-velke zle"><p>Result</p><p class="lv-v">${eur(f.vysledok.suma)}</p><p class="lv-p">A loss${f.vysledok.najmenej ? ', at least this much' : ''}. What is not counted yet is listed below.</p></div>
</div>
<p class="live-pozn live-pre-vas">What this means for you: our free tools stay free, a company rule since 18${NBSP}October 2026. So far the founder has covered the loss.</p>
<h3>Revenue by channel</h3>
<ul class="live-riadky">${kanaly}</ul>
<p class="live-pozn">${f.trzby.nemerane.map(esc).join(' ')}</p>
<h3>Where the money went</h3>
<ul class="live-riadky">${casti}</ul>
${(f.vydavky.nezapocitane || []).length ? `<p class="live-pozn">Not counted yet: ${f.vydavky.nezapocitane.map(esc).join(' ')}</p>` : ''}
${predtym}`;
}

const STAVY = { running: 'Running', waiting: 'Waiting', reworking: 'Being rebuilt', stopped: 'Stopped', failed: 'Did not work', worked: 'Worked', planned: 'Next' };
export function htmlExperimenty(e) {
  const pol = (e?.polozky || []).slice(0, 6);
  if (!pol.length) return '<p class="live-prazdne">Nothing written down yet.</p>';
  return `<ol class="live-pokusy">${pol.map((p) => {
    const stav = Object.hasOwn(STAVY, p.stav) ? p.stav : 'running';
    const kedy = p.od ? `Since ${esc(den(p.od))}` : 'Not started yet';
    const odkaz = p.odkaz ? `<p class="lp-o">${odkazNaProdukt(p.odkaz.url, p.odkaz.text, p.odkaz.produkt)}</p>` : '';
    return `<li>
<p class="lp-t"><span class="lp-s lp-s-${esc(stav)}">${esc(STAVY[stav])}</span> ${esc(p.nazov)}</p>
<p>${esc(p.co)}</p>${p.vysledok ? `<p class="lp-r">${esc(p.vysledok)}</p>` : ''}${odkaz}
<p class="lp-d">${kedy}${p.rozhodnutie ? `. Decision on ${esc(den(p.rozhodnutie))}` : ''}.</p>
</li>`;
  }).join('')}</ol>
<p class="live-pozn">Written by hand, updated when something changes. Last change ${esc(den(e.aktualizovane))}.</p>`;
}
