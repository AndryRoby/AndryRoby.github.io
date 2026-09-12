// ZIP STORE bez kniznice. ASCII nazvy, UTF-8 obsah, CRC32; nic sa neposiela na server.
const TAB = Uint32Array.from({ length: 256 }, (_, i) => {
  let c = i; for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) crc = TAB[(crc ^ b) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
export function vytvorZip(subory) {
  if (!subory.length || subory.length > 100) throw new Error('ZIP file count');
  const enc = new TextEncoder(), casti = [], adresar = [], mena = new Set();
  let offset = 0, dirSize = 0;
  for (const { meno, text } of subory) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.xml$/.test(meno) || mena.has(meno.toLowerCase())) throw new Error('ZIP file name');
    mena.add(meno.toLowerCase());
    const nazov = enc.encode(meno), data = enc.encode(text), crc = crc32(data);
    if (offset + data.length > 50000000) throw new Error('ZIP size');
    const local = new Uint8Array(30 + nazov.length), l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(12, 33, true);
    l.setUint32(14, crc, true); l.setUint32(18, data.length, true); l.setUint32(22, data.length, true);
    l.setUint16(26, nazov.length, true); local.set(nazov, 30);
    const central = new Uint8Array(46 + nazov.length), c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(14, 33, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, nazov.length, true); c.setUint32(42, offset, true); central.set(nazov, 46);
    casti.push(local, data); adresar.push(central); offset += local.length + data.length; dirSize += central.length;
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, subory.length, true); e.setUint16(10, subory.length, true);
  e.setUint32(12, dirSize, true); e.setUint32(16, offset, true);
  const zip = new Uint8Array(offset + dirSize + end.length); let i = 0;
  for (const p of [...casti, ...adresar, end]) { zip.set(p, i); i += p.length; }
  return zip;
}
