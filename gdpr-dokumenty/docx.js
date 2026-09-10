/* Minimálny zapisovač DOCX bez knižníc: zo zoznamu blokov (dokumenty-sk.js)
 * spraví platný súbor Wordu. DOCX je ZIP s XML; ZIP sa tu zapisuje bez
 * kompresie (metóda 0), čo Word aj LibreOffice čítajú a čo nepotrebuje
 * žiadne API prehliadača. Beží aj v Node (testy). */

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
const enc = new TextEncoder();
function le16(n) { return [n & 0xFF, (n >>> 8) & 0xFF]; }
function le32(n) { return [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]; }

/* ZIP z dvojíc [názov, text alebo Uint8Array]. Vracia Uint8Array. */
export function zip(subory) {
  const casti = [];
  const stred = [];
  let offset = 0;
  const dt = 0x21 << 11 | 0; // 1980-01-01 00:00, čas a dátum v DOS tvare (na obsahu nezáleží)
  const dd = (1 << 5) | 1;
  for (const [nazov, text] of subory) {
    const meno = enc.encode(nazov);
    const data = typeof text === 'string' ? enc.encode(text) : text;
    const crc = crc32(data);
    const hlava = new Uint8Array([
      0x50, 0x4B, 0x03, 0x04, ...le16(20), ...le16(0x0800), ...le16(0), ...le16(dt), ...le16(dd),
      ...le32(crc), ...le32(data.length), ...le32(data.length), ...le16(meno.length), ...le16(0),
    ]);
    casti.push(hlava, meno, data);
    stred.push(new Uint8Array([
      0x50, 0x4B, 0x01, 0x02, ...le16(20), ...le16(20), ...le16(0x0800), ...le16(0), ...le16(dt), ...le16(dd),
      ...le32(crc), ...le32(data.length), ...le32(data.length), ...le16(meno.length), ...le16(0), ...le16(0),
      ...le16(0), ...le16(0), ...le32(0), ...le32(offset),
    ]), meno);
    offset += hlava.length + meno.length + data.length;
  }
  const stredDlzka = stred.reduce((a, x) => a + x.length, 0);
  const koniec = new Uint8Array([
    0x50, 0x4B, 0x05, 0x06, ...le16(0), ...le16(0), ...le16(subory.length), ...le16(subory.length),
    ...le32(stredDlzka), ...le32(offset), ...le16(0),
  ]);
  const vsetko = [...casti, ...stred, koniec];
  const out = new Uint8Array(vsetko.reduce((a, x) => a + x.length, 0));
  let pos = 0;
  for (const x of vsetko) { out.set(x, pos); pos += x.length; }
  return out;
}

const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Text s **tučným** a zlomami riadkov na behy Wordu. */
function behy(text, zaklad = '') {
  const out = [];
  const casti = String(text).split(/(\*\*[^*]+\*\*)/g);
  for (const c of casti) {
    if (!c) continue;
    const tucne = c.startsWith('**') && c.endsWith('**');
    const t = tucne ? c.slice(2, -2) : c;
    const riadky = t.split('\n');
    riadky.forEach((r, i) => {
      const rpr = (tucne ? '<w:b/>' : '') + zaklad;
      out.push('<w:r>' + (rpr ? '<w:rPr>' + rpr + '</w:rPr>' : '') + (i > 0 ? '<w:br/>' : '') + '<w:t xml:space="preserve">' + x(r) + '</w:t></w:r>');
    });
  }
  return out.join('');
}
function odsek(text, styl, extra = '') {
  return '<w:p><w:pPr>' + (styl ? '<w:pStyle w:val="' + styl + '"/>' : '') + extra + '</w:pPr>' + behy(text) + '</w:p>';
}
function tabulka(rows) {
  const n = Math.max(...rows.map((r) => r.length));
  const sirka = Math.floor(9000 / n);
  let t = '<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders>'
    + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => '<w:' + s + ' w:val="single" w:sz="4" w:space="0" w:color="999999"/>').join('')
    + '</w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>'
    + Array.from({ length: n }, () => '<w:gridCol w:w="' + sirka + '"/>').join('') + '</w:tblGrid>';
  rows.forEach((r, i) => {
    t += '<w:tr>';
    for (let c = 0; c < n; c++) {
      const cell = r[c] === undefined ? '' : r[c];
      t += '<w:tc><w:tcPr><w:tcW w:w="' + sirka + '" w:type="dxa"/>' + (i === 0 ? '<w:shd w:val="clear" w:color="auto" w:fill="EEEEEE"/>' : '') + '</w:tcPr>'
        + '<w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>' + behy(i === 0 ? '**' + cell + '**' : cell, '<w:sz w:val="19"/>') + '</w:p></w:tc>';
    }
    t += '</w:tr>';
  });
  return t + '</w:tbl><w:p/>';
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:lang w:val="sk-SK"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="34"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="480" w:hanging="240"/><w:spacing w:after="60"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Poznamka"><w:name w:val="Poznamka"/><w:basedOn w:val="Normal"/><w:rPr><w:i/><w:color w:val="666666"/><w:sz w:val="18"/></w:rPr></w:style>
</w:styles>`;

/* Bloky dokumentu na XML tela. */
export function teloXML(bloky, pata) {
  let body = '';
  for (const b of bloky) {
    if (b.h) body += odsek(b.t, 'Heading' + Math.min(3, b.h));
    else if (b.p !== undefined) body += odsek(b.p, null);
    else if (b.ul) body += b.ul.map((t) => odsek('• ' + t, 'ListBullet')).join('');
    else if (b.tbl) body += tabulka(b.tbl);
  }
  if (pata) body += odsek(pata, 'Poznamka');
  return body;
}

/* Celý DOCX ako Uint8Array. */
export function docx(bloky, pata) {
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${teloXML(bloky, pata)}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1300" w:right="1300" w:bottom="1300" w:left="1300" w:header="700" w:footer="700" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  return zip([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`],
    ['word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['word/styles.xml', STYLES],
    ['word/document.xml', document],
  ]);
}

/* Tie isté bloky ako HTML pre náhľad na stránke. */
export function html(bloky) {
  const inl = (t) => x(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  let out = '';
  for (const b of bloky) {
    if (b.h) out += '<h' + (b.h + 1) + '>' + inl(b.t) + '</h' + (b.h + 1) + '>';
    else if (b.p !== undefined) out += '<p>' + inl(b.p) + '</p>';
    else if (b.ul) out += '<ul>' + b.ul.map((t) => '<li>' + inl(t) + '</li>').join('') + '</ul>';
    else if (b.tbl) out += '<table>' + b.tbl.map((r, i) => '<tr>' + r.map((c) => (i ? '<td>' : '<th>') + inl(c) + (i ? '</td>' : '</th>')).join('') + '</tr>').join('') + '</table>';
  }
  return out;
}
