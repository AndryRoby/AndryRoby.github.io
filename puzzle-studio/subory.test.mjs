/* node --test products/arling-sk/puzzle-studio/subory.test.mjs
 *
 * The page writes two file formats by hand, so both are read back apart here
 * rather than trusted. The ZIP is parsed field by field with the same layout
 * an unzip tool reads, and the PNG is walked chunk by chunk. If either were
 * wrong the customer would find out by double clicking a broken download,
 * which is the worst possible place to find out.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync, crc32 as uzolCrc32 } from 'node:zlib';
import { crc32, pngDpi, jePng, naMeter, zip, dosCas } from './subory.mjs';

const bajty = (s) => new Uint8Array(Buffer.from(s, 'utf8'));

/* ── CRC-32 ────────────────────────────────────────────────────────────── */

test('the checksum matches the published test vectors', () => {
  assert.equal(crc32(bajty('')), 0x00000000);
  assert.equal(crc32(bajty('a')), 0xe8b7be43);
  assert.equal(crc32(bajty('abc')), 0x352441c2);
  assert.equal(crc32(bajty('123456789')), 0xcbf43926);
});

test('the checksum matches the one Node computes', () => {
  for (const s of ['', 'a', 'Puzzle by ARLing', 'x'.repeat(5000), 'ščžáí']) {
    assert.equal(crc32(bajty(s)) >>> 0, uzolCrc32(Buffer.from(s, 'utf8')) >>> 0, s.slice(0, 20));
  }
});

/* ── PNG ───────────────────────────────────────────────────────────────── */

/* The smallest legal PNG: 1 x 1, greyscale, one IDAT. Written out rather than
   produced by a library, so the test does not depend on one. */
function malyPng(extraPhys) {
  const kusy = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])];
  const chunk = (typ, data) => {
    const d = Buffer.concat([Buffer.from(typ, 'ascii'), data]);
    const dlzka = Buffer.alloc(4); dlzka.writeUInt32BE(data.length, 0);
    const suma = Buffer.alloc(4); suma.writeUInt32BE(uzolCrc32(d) >>> 0, 0);
    return Buffer.concat([dlzka, d, suma]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  kusy.push(chunk('IHDR', ihdr));
  if (extraPhys) {
    const p = Buffer.alloc(9);
    p.writeUInt32BE(2835, 0); p.writeUInt32BE(2835, 4); p[8] = 1; // 72 dpi
    kusy.push(chunk('pHYs', p));
  }
  kusy.push(chunk('IDAT', Buffer.from([0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01])));
  kusy.push(chunk('IEND', Buffer.alloc(0)));
  return new Uint8Array(Buffer.concat(kusy));
}

function chunky(bytes) {
  const b = Buffer.from(bytes);
  const von = [];
  let i = 8;
  while (i + 8 <= b.length) {
    const dlzka = b.readUInt32BE(i);
    const typ = b.toString('ascii', i + 4, i + 8);
    const data = b.subarray(i + 8, i + 8 + dlzka);
    const suma = b.readUInt32BE(i + 8 + dlzka);
    von.push({ typ, data, suma, sumaSedi: suma === (uzolCrc32(Buffer.concat([Buffer.from(typ, 'ascii'), data])) >>> 0) });
    i += 12 + dlzka;
  }
  return von;
}

test('300 dpi is 11811 pixels per metre', () => {
  assert.equal(naMeter(300), 11811);
  assert.equal(naMeter(72), 2835);
});

test('a PNG is recognised and anything else is refused', () => {
  assert.equal(jePng(malyPng(false)), true);
  assert.equal(jePng(bajty('not a png at all')), false);
  assert.equal(jePng(new Uint8Array(3)), false);
  assert.throws(() => pngDpi(bajty('nope')), /Not a PNG/);
});

test('the resolution chunk is added before the image data and checksums', () => {
  const von = pngDpi(malyPng(false), 300);
  const c = chunky(von);
  assert.deepEqual(c.map((x) => x.typ), ['IHDR', 'pHYs', 'IDAT', 'IEND']);
  for (const x of c) assert.equal(x.sumaSedi, true, x.typ);
  const p = c.find((x) => x.typ === 'pHYs');
  assert.equal(p.data.readUInt32BE(0), 11811);
  assert.equal(p.data.readUInt32BE(4), 11811);
  assert.equal(p.data[8], 1);
});

test('a resolution that is already there is replaced, not doubled', () => {
  const von = pngDpi(malyPng(true), 300);
  const c = chunky(von);
  assert.equal(c.filter((x) => x.typ === 'pHYs').length, 1);
  assert.equal(c.find((x) => x.typ === 'pHYs').data.readUInt32BE(0), 11811);
});

test('the image itself is untouched', () => {
  const pred = chunky(malyPng(false));
  const po = chunky(pngDpi(malyPng(false), 300));
  for (const typ of ['IHDR', 'IDAT', 'IEND']) {
    assert.deepEqual(
      Buffer.from(po.find((x) => x.typ === typ).data),
      Buffer.from(pred.find((x) => x.typ === typ).data),
      typ,
    );
  }
});

test('running it twice changes nothing the second time', () => {
  const raz = pngDpi(malyPng(false), 300);
  const dva = pngDpi(raz, 300);
  assert.deepEqual(Buffer.from(dva), Buffer.from(raz));
});

/* ── ZIP ───────────────────────────────────────────────────────────────── */

/* Reads a stored ZIP back the way an unzip tool does: from the end of central
   directory record backwards, not by trusting the order we wrote it in. */
function rozbal(bytes) {
  const b = Buffer.from(bytes);
  const koniec = b.length - 22;
  assert.equal(b.readUInt32LE(koniec), 0x06054b50, 'no end of central directory');
  const pocet = b.readUInt16LE(koniec + 10);
  const stredDlzka = b.readUInt32LE(koniec + 12);
  const stredOd = b.readUInt32LE(koniec + 16);
  assert.equal(stredOd + stredDlzka, koniec, 'the central directory does not end where it should');
  const von = [];
  let i = stredOd;
  for (let k = 0; k < pocet; k++) {
    assert.equal(b.readUInt32LE(i), 0x02014b50, 'central directory entry ' + k);
    const metoda = b.readUInt16LE(i + 10);
    const suma = b.readUInt32LE(i + 16) >>> 0;
    const dlzka = b.readUInt32LE(i + 24);
    const menoDlzka = b.readUInt16LE(i + 28);
    const extraDlzka = b.readUInt16LE(i + 30);
    const komentDlzka = b.readUInt16LE(i + 32);
    const posun = b.readUInt32LE(i + 42);
    const meno = b.toString('utf8', i + 46, i + 46 + menoDlzka);
    assert.equal(b.readUInt32LE(posun), 0x04034b50, 'local header of ' + meno);
    const lMenoDlzka = b.readUInt16LE(posun + 26);
    const lExtraDlzka = b.readUInt16LE(posun + 28);
    assert.equal(b.toString('utf8', posun + 30, posun + 30 + lMenoDlzka), meno, 'name in both headers');
    assert.equal(b.readUInt32LE(posun + 14) >>> 0, suma, 'checksum in both headers');
    const od = posun + 30 + lMenoDlzka + lExtraDlzka;
    const data = b.subarray(od, od + dlzka);
    assert.equal(uzolCrc32(data) >>> 0, suma, 'checksum of ' + meno);
    von.push({ meno, data, metoda, utf8: !!(b.readUInt16LE(i + 8) & 0x0800) });
    i += 46 + menoDlzka + extraDlzka + komentDlzka;
  }
  return von;
}

test('an archive reads back with every file, name and byte intact', () => {
  const subory = [
    { meno: 'licence.txt', data: 'Puzzle by ARLing, arling.sk\n' },
    { meno: 'svg/arling-otters-easy-5-1.svg', data: '<svg viewBox="0 0 532 532"></svg>' },
    { meno: 'png/arling-otters-easy-5-1.png', data: malyPng(false) },
  ];
  const von = rozbal(zip(subory, new Date('2026-09-18T11:22:33')));
  assert.equal(von.length, 3);
  assert.deepEqual(von.map((x) => x.meno), subory.map((x) => x.meno));
  for (const x of von) { assert.equal(x.metoda, 0); assert.equal(x.utf8, true); }
  assert.equal(von[0].data.toString('utf8'), subory[0].data);
  assert.equal(von[1].data.toString('utf8'), subory[1].data);
  assert.deepEqual(Buffer.from(von[2].data), Buffer.from(subory[2].data));
});

test('an archive of twenty puzzles and their solutions holds together', () => {
  const subory = [];
  for (let i = 1; i <= 20; i++) {
    subory.push({ meno: 'svg/p-' + i + '.svg', data: '<svg>' + 'x'.repeat(i * 100) + '</svg>' });
    subory.push({ meno: 'svg/p-' + i + '-solution.svg', data: '<svg>' + 'y'.repeat(i * 90) + '</svg>' });
  }
  const von = rozbal(zip(subory));
  assert.equal(von.length, 40);
  assert.equal(new Set(von.map((x) => x.meno)).size, 40);
  assert.equal(von[39].data.toString('utf8'), subory[39].data);
});

test('an empty archive is still a legal archive', () => {
  const von = rozbal(zip([]));
  assert.equal(von.length, 0);
});

test('names outside ASCII survive the round trip', () => {
  const von = rozbal(zip([{ meno: 'réšenie-č.1.svg', data: 'x' }]));
  assert.equal(von[0].meno, 'réšenie-č.1.svg');
});

test('the stored timestamp is the MS-DOS pair, not a number out of range', () => {
  const { cas, datum } = dosCas(new Date('2026-09-18T11:22:32'));
  assert.equal((datum >> 9) + 1980, 2026);
  assert.equal((datum >> 5) & 15, 9);
  assert.equal(datum & 31, 18);
  assert.equal((cas >> 11) & 31, 11);
  assert.equal((cas >> 5) & 63, 22);
  assert.ok(cas >= 0 && cas <= 0xffff && datum >= 0 && datum <= 0xffff);
  // Anything before 1980 cannot be written and must not wrap into the past.
  assert.ok(((dosCas(new Date('1970-01-01T00:00:00')).datum >> 9) + 1980) === 1980);
});

test('stored means stored: nothing has to be inflated to read it', () => {
  const text = 'a'.repeat(4000);
  const von = rozbal(zip([{ meno: 'a.txt', data: text }]));
  assert.equal(von[0].data.toString('utf8'), text);
  // and a deflate stream would not be readable as text, which is the point
  assert.notEqual(Buffer.from(inflateRawSync(Buffer.from([0x4b, 0x04, 0x00]))).toString(), text);
});
