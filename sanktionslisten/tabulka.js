/* Čítanie zoznamu partnerov z CSV alebo XLSX v prehliadači, bez knižnice.
 * Súbor sa číta lokálne (File.arrayBuffer), nič sa neodosiela.
 * Testy: ops/saas/sankcie/test/web.test.mjs (beží aj v Node 18+). */

export const MAX_RIADKOV = 5000;

/* Bajty -> text: BOM UTF-8 alebo UTF-16, inak UTF-8, a keď nie je platné,
 * Windows-1252 (nemecký Excel „CSV (Trennzeichen-getrennt)“). */
export function dekodujText(bajty) {
  const u8 = bajty instanceof Uint8Array ? bajty : new Uint8Array(bajty);
  if (u8[0] === 0xff && u8[1] === 0xfe) return new TextDecoder('utf-16le').decode(u8.subarray(2));
  if (u8[0] === 0xfe && u8[1] === 0xff) return new TextDecoder('utf-16be').decode(u8.subarray(2));
  if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) return new TextDecoder('utf-8').decode(u8.subarray(3));
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch { return new TextDecoder('windows-1252').decode(u8); }
}

function oddelovac(text) {
  const riadky = text.split(/\r?\n/).filter((r) => r.trim()).slice(0, 20);
  let najlepsi = ';';
  let skore = -1;
  for (const d of [';', ',', '\t', '|']) {
    const pocty = riadky.map((r) => { let n = 0; let q = false; for (const c of r) { if (c === '"') q = !q; else if (c === d && !q) n++; } return n; });
    const s = pocty.length ? Math.min(...pocty) * 10 + pocty.reduce((a, b) => a + b, 0) / pocty.length : 0;
    if (s > skore) { skore = s; najlepsi = d; }
  }
  return skore > 0 ? najlepsi : null;
}

/* CSV podľa RFC 4180: úvodzovky, zdvojené úvodzovky, nové riadky v poli. */
export function parsujCsv(text) {
  const d = oddelovac(text);
  const riadky = [];
  let riadok = [];
  let pole = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { pole += '"'; i++; } else q = false; }
      else pole += c;
    } else if (c === '"' && pole === '') q = true;
    else if (d && c === d) { riadok.push(pole); pole = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      riadok.push(pole); pole = '';
      if (riadok.some((x) => x.trim())) riadky.push(riadok);
      riadok = [];
    } else pole += c;
  }
  riadok.push(pole);
  if (riadok.some((x) => x.trim())) riadky.push(riadok);
  return riadky.map((r) => r.map((x) => x.trim()));
}

/* ── XLSX ────────────────────────────────────────────────────────────────── */

const dek = (s) => s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (m, k) => {
  if (k[0] === '#') return String.fromCodePoint(k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[k];
});

async function rozbal(metoda, data) {
  if (metoda === 0) return data;
  if (metoda !== 8) throw new Error('ZIP-Methode ' + metoda + ' wird nicht unterstützt');
  const prud = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(prud).arrayBuffer());
}

/* Súbory v ZIP: meno -> async () => Uint8Array. */
export function zipSubory(bajty) {
  const u8 = bajty instanceof Uint8Array ? bajty : new Uint8Array(bajty);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Keine ZIP-Datei (XLSX)');
  const pocet = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const subory = new Map();
  const td = new TextDecoder();
  for (let n = 0; n < pocet; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Beschädigtes ZIP-Verzeichnis');
    const metoda = dv.getUint16(p + 10, true);
    const velkost = dv.getUint32(p + 20, true);
    const dMena = dv.getUint16(p + 28, true);
    const dExtra = dv.getUint16(p + 30, true);
    const dKom = dv.getUint16(p + 32, true);
    const lokal = dv.getUint32(p + 42, true);
    const meno = td.decode(u8.subarray(p + 46, p + 46 + dMena));
    const lMena = dv.getUint16(lokal + 26, true);
    const lExtra = dv.getUint16(lokal + 28, true);
    const zac = lokal + 30 + lMena + lExtra;
    subory.set(meno, () => rozbal(metoda, u8.subarray(zac, zac + velkost)));
    p += 46 + dMena + dExtra + dKom;
  }
  return subory;
}

function stlpecZOdkazu(r) {
  const m = /^([A-Z]+)/.exec(r || '');
  if (!m) return -1;
  let n = 0;
  for (const c of m[1]) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

/* Prvý hárok zošita XLSX -> pole riadkov (texty). */
export async function citajXlsx(bajty) {
  const z = zipSubory(bajty);
  const td = new TextDecoder();
  const text = async (m) => (z.has(m) ? td.decode(await z.get(m)()) : null);
  let cesta = 'xl/worksheets/sheet1.xml';
  const wb = await text('xl/workbook.xml');
  const rels = await text('xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const prvy = /<(?:\w+:)?sheet\b[^>]*\br:id="([^"]+)"/.exec(wb);
    if (prvy) {
      const re = new RegExp('<Relationship\\b[^>]*Id="' + prvy[1] + '"[^>]*Target="([^"]+)"|<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="' + prvy[1] + '"');
      const t = re.exec(rels);
      const ciel = t && (t[1] || t[2]);
      if (ciel) cesta = ciel.startsWith('/') ? ciel.slice(1) : 'xl/' + ciel.replace(/^\.\//, '');
    }
  }
  const zdielane = [];
  const ss = await text('xl/sharedStrings.xml');
  if (ss) {
    for (const si of ss.match(/<si\b[\s\S]*?<\/si>/g) || []) {
      zdielane.push(dek((si.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('')));
    }
  }
  const harok = await text(cesta);
  if (!harok) throw new Error('Kein Tabellenblatt gefunden');
  const riadky = [];
  for (const rm of harok.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const riadok = [];
    for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const atr = cm[1];
      const vnutro = cm[2] || '';
      const ref = (/\br="([^"]+)"/.exec(atr) || [])[1];
      const typ = (/\bt="([^"]+)"/.exec(atr) || [])[1] || 'n';
      let hodnota = '';
      if (typ === 'inlineStr') hodnota = dek((vnutro.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join(''));
      else {
        const v = (/<v>([\s\S]*?)<\/v>/.exec(vnutro) || [])[1];
        if (v !== undefined) hodnota = typ === 's' ? (zdielane[Number(v)] ?? '') : dek(v);
      }
      const k = ref ? stlpecZOdkazu(ref) : riadok.length;
      while (riadok.length < k) riadok.push('');
      riadok[k] = hodnota.trim();
    }
    if (riadok.some((x) => x)) riadky.push(riadok);
    if (riadky.length > MAX_RIADKOV + 1) break;
  }
  return riadky;
}

/* ── Stĺpec s menom ──────────────────────────────────────────────────────── */

const HLAVICKA_MENO = /^(name|name ?1|firma|firmenname|firmierung|unternehmen|unternehmensname|partner|geschäftspartner|geschaeftspartner|kunde|kundenname|lieferant|lieferantenname|debitor|kreditor|bezeichnung|company|company name|organisation|organization|empfänger|empfaenger|auftraggeber|kontoinhaber|nachname)$/i;
const HLAVICKA_CAST = /name|firma|unternehmen|partner|kunde|lieferant|company|debitor|kreditor|bezeichnung/i;

/* Odhad: má prvý riadok hlavičku a ktorý stĺpec nesie meno partnera. */
export function odhadniStlpec(riadky) {
  if (!riadky.length) return { hlavicka: false, stlpec: 0, stlpcov: 0 };
  const stlpcov = Math.max(...riadky.slice(0, 50).map((r) => r.length));
  const prvy = riadky[0];
  let stlpec = prvy.findIndex((x) => HLAVICKA_MENO.test(x.trim()));
  if (stlpec < 0) stlpec = prvy.findIndex((x) => HLAVICKA_CAST.test(x) && x.length <= 40);
  const hlavicka = stlpec >= 0;
  if (!hlavicka) {
    // Bez hlavičky: stĺpec s najviac písmenami (mená), nie čísla.
    let naj = 0; let najSkore = -1;
    for (let k = 0; k < stlpcov; k++) {
      const s = riadky.slice(0, 50).reduce((a, r) => a + ((r[k] || '').match(/\p{L}/gu) || []).length, 0);
      if (s > najSkore) { najSkore = s; naj = k; }
    }
    stlpec = naj;
  }
  return { hlavicka, stlpec, stlpcov };
}

/* Mená na kontrolu: [{ riadok (číslo v súbore, od 1), meno }]. */
export function menaZoStlpca(riadky, stlpec, hlavicka) {
  const out = [];
  riadky.forEach((r, i) => {
    if (hlavicka && i === 0) return;
    const m = (r[stlpec] || '').trim();
    if (m) out.push({ riadok: i + 1, meno: m });
  });
  return out;
}

/* Súbor -> riadky podľa prípony alebo podpisu ZIP. */
export async function nacitajSubor(nazov, bajty) {
  const u8 = new Uint8Array(bajty);
  const jeZip = u8[0] === 0x50 && u8[1] === 0x4b;
  if (/\.xls$/i.test(nazov) && !jeZip) throw new Error('XLS');
  if (/\.(xlsx|xlsm)$/i.test(nazov) || jeZip) return citajXlsx(u8);
  return parsujCsv(dekodujText(u8));
}
