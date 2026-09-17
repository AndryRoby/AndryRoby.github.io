/* Puzzle Studio: the two file formats the page writes by itself.
 *
 * Pure functions over byte arrays, no DOM and no dependencies, so they run in
 * the page, in the worker and in node --test (subory.test.mjs).
 *
 * Why write them by hand instead of adding a library. Two reasons, and the
 * second one is the real one:
 *   1. The site ships no third party JavaScript at all (CSP script-src 'self'),
 *      so a library would have to be vendored and reviewed anyway.
 *   2. Both formats are small when you only need one thing out of them. A PNG
 *      needs one extra chunk to carry its resolution, and a ZIP of already
 *      finished files needs no compression at all.
 *
 * What is here:
 *   crc32          the checksum both formats use
 *   pngSDpi        rewrites a canvas PNG so it declares 300 dpi
 *   zip            a ZIP of stored (uncompressed) entries
 */

/* ── CRC-32 (IEEE 802.3), the one PNG and ZIP both use ─────────────────── */
let TABULKA = null;
function tabulka() {
  if (TABULKA) return TABULKA;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  TABULKA = t;
  return t;
}

/** @param {Uint8Array} bytes @returns {number} unsigned 32 bit checksum */
export function crc32(bytes) {
  const t = tabulka();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ── PNG resolution ────────────────────────────────────────────────────
 * canvas.toBlob writes a PNG with no pHYs chunk, so every program that opens
 * it assumes 72 dpi and prints the image four times too large. The pixels are
 * right either way, but "300 dpi" on the page would then be a claim about
 * nothing. This inserts a pHYs chunk right before the first IDAT, which is
 * where the PNG specification says it belongs, and replaces one that is
 * already there rather than writing a second.
 *
 * pHYs is nine bytes: pixels per metre across (4), down (4), and a unit byte
 * that is 1 for metres. 300 dpi is 300 / 0.0254 = 11811 pixels per metre.
 */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function jePng(bytes) {
  if (!bytes || bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) if (bytes[i] !== PNG_MAGIC[i]) return false;
  return true;
}

function u32(pole, i) {
  return ((pole[i] << 24) | (pole[i + 1] << 16) | (pole[i + 2] << 8) | pole[i + 3]) >>> 0;
}
function zapisU32(pole, i, v) {
  pole[i] = (v >>> 24) & 0xff; pole[i + 1] = (v >>> 16) & 0xff; pole[i + 2] = (v >>> 8) & 0xff; pole[i + 3] = v & 0xff;
}

/** Pixels per metre for a resolution in dots per inch. */
export function naMeter(dpi) {
  return Math.round(Number(dpi) / 0.0254);
}

/**
 * @param {Uint8Array} bytes a PNG as canvas.toBlob wrote it
 * @param {number} dpi
 * @returns {Uint8Array} the same image, declaring that resolution
 */
export function pngDpi(bytes, dpi = 300) {
  if (!jePng(bytes)) throw new Error('Not a PNG');
  const m = naMeter(dpi);
  const chunk = new Uint8Array(21);
  zapisU32(chunk, 0, 9);
  chunk[4] = 0x70; chunk[5] = 0x48; chunk[6] = 0x59; chunk[7] = 0x73; // pHYs
  zapisU32(chunk, 8, m);
  zapisU32(chunk, 12, m);
  chunk[16] = 1; // the unit is the metre
  zapisU32(chunk, 17, crc32(chunk.subarray(4, 17)));

  // Walk the chunks, drop any pHYs already there, and put ours before IDAT.
  const von = [];
  von.push(bytes.subarray(0, 8));
  let i = 8, vlozene = false;
  while (i + 8 <= bytes.length) {
    const dlzka = u32(bytes, i);
    const typ = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
    const koniec = i + 12 + dlzka;
    if (koniec > bytes.length) break;
    if (typ === 'pHYs') { i = koniec; continue; }
    if (typ === 'IDAT' && !vlozene) { von.push(chunk); vlozene = true; }
    von.push(bytes.subarray(i, koniec));
    i = koniec;
  }
  if (!vlozene) von.push(chunk);
  let dlzka = 0;
  for (const c of von) dlzka += c.length;
  const out = new Uint8Array(dlzka);
  let p = 0;
  for (const c of von) { out.set(c, p); p += c.length; }
  return out;
}

/* ── ZIP ───────────────────────────────────────────────────────────────
 * Stored entries only (method 0). The files going in are PNG, SVG and a short
 * text note; the PNGs are already compressed and the SVGs are a few kilobytes,
 * so deflating them would buy a little size for a lot of code we would then
 * have to trust.
 *
 * Written to the original PKZIP layout with no ZIP64 and no data descriptors,
 * which every unzip tool on every desktop has read since 1993. Names are
 * written as UTF-8 with the language encoding flag set (bit 11).
 */
const KODOVAC = typeof TextEncoder === 'function' ? new TextEncoder() : null;
function bajty(s) {
  if (KODOVAC) return KODOVAC.encode(s);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

/** A date as the two 16 bit fields MS-DOS used, which is what ZIP stores. */
export function dosCas(d = new Date()) {
  const rok = Math.max(1980, d.getFullYear());
  const cas = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
  const datum = (((rok - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
  return { cas, datum };
}

/**
 * @param {Array<{meno:string, data:Uint8Array|string}>} subory
 * @param {Date} [kedy]
 * @returns {Uint8Array}
 */
export function zip(subory, kedy = new Date()) {
  const { cas, datum } = dosCas(kedy);
  const kusy = [];
  const stred = [];
  let posun = 0;

  for (const s of subory) {
    const meno = bajty(String(s.meno));
    const data = typeof s.data === 'string' ? bajty(s.data) : s.data;
    const suma = crc32(data);

    const hlavicka = new Uint8Array(30 + meno.length);
    const d = new DataView(hlavicka.buffer);
    d.setUint32(0, 0x04034b50, true);
    d.setUint16(4, 20, true);        // version needed
    d.setUint16(6, 0x0800, true);    // UTF-8 names
    d.setUint16(8, 0, true);         // stored
    d.setUint16(10, cas, true);
    d.setUint16(12, datum, true);
    d.setUint32(14, suma, true);
    d.setUint32(18, data.length, true);
    d.setUint32(22, data.length, true);
    d.setUint16(26, meno.length, true);
    d.setUint16(28, 0, true);
    hlavicka.set(meno, 30);
    kusy.push(hlavicka, data);

    const zaznam = new Uint8Array(46 + meno.length);
    const c = new DataView(zaznam.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);        // version made by
    c.setUint16(6, 20, true);        // version needed
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, cas, true);
    c.setUint16(14, datum, true);
    c.setUint32(16, suma, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, meno.length, true);
    c.setUint32(42, posun, true);
    zaznam.set(meno, 46);
    stred.push(zaznam);

    posun += hlavicka.length + data.length;
  }

  let stredDlzka = 0;
  for (const z of stred) stredDlzka += z.length;
  const koniec = new Uint8Array(22);
  const k = new DataView(koniec.buffer);
  k.setUint32(0, 0x06054b50, true);
  k.setUint16(8, subory.length, true);
  k.setUint16(10, subory.length, true);
  k.setUint32(12, stredDlzka, true);
  k.setUint32(16, posun, true);

  let celkom = posun + stredDlzka + 22;
  const out = new Uint8Array(celkom);
  let p = 0;
  for (const c of kusy) { out.set(c, p); p += c.length; }
  for (const z of stred) { out.set(z, p); p += z.length; }
  out.set(koniec, p);
  return out;
}
