// Dĺžka do WebM z MediaRecorder (ARLing, 19. 10. 2026). Firefox aj Chrome zapisujú WebM ako živý prúd bez prvku
// Duration v Segment > Info, takže prehrávače nevedia posúvať a hlásia neznámu dĺžku (brána 1, Firefox). Táto malá
// funkcia bez knižníc doplní Duration (EBML ID 0x4489, float64) alebo prepíše existujúci. Keď súbor má SeekHead
// nečakaný tvar, vráti ho bez zmeny: radšej bez dĺžky než pokazený súbor. Firefox píše SeekHead: pozície za Info
// sa posunú o vložené bajty (Cues v živom zázname MediaRecorder nie sú).

const ID = { EBML: 0x1a45dfa3, SEGMENT: 0x18538067, INFO: 0x1549a966, DURATION: 0x4489, SCALE: 0x2ad7b1, SEEKHEAD: 0x114d9b74, SEEK: 0x4dbb, SEEKPOS: 0x53ac, CLUSTER: 0x1f43b675 };

/** Prečíta EBML ID na pozícii p (so značkou dĺžky). Vráti { id, dlzka } alebo null. */
function citajId(b, p) {
  const prvy = b[p];
  if (prvy === undefined) return null;
  let n = 1;
  while (n <= 4 && !(prvy & (0x80 >> (n - 1)))) n++;
  if (n > 4 || p + n > b.length) return null;
  let id = 0;
  for (let i = 0; i < n; i++) id = id * 256 + b[p + i];
  return { id, dlzka: n };
}

/** Prečíta veľkosť (vint bez značky). Vráti { hodnota, dlzka, neznama }. */
function citajVelkost(b, p) {
  const prvy = b[p];
  if (prvy === undefined) return null;
  let n = 1;
  while (n <= 8 && !(prvy & (0x80 >> (n - 1)))) n++;
  if (n > 8 || p + n > b.length) return null;
  let h = prvy & (0xff >> n), vsetkyJednotky = h === (0xff >> n);
  for (let i = 1; i < n; i++) { h = h * 256 + b[p + i]; if (b[p + i] !== 0xff) vsetkyJednotky = false; }
  return { hodnota: h, dlzka: n, neznama: vsetkyJednotky };
}

/** Veľkosť ako vint presne na `n` bajtov. */
function zapisVelkost(hodnota, n) {
  const out = new Uint8Array(n);
  let h = hodnota;
  for (let i = n - 1; i >= 0; i--) { out[i] = h % 256; h = Math.floor(h / 256); }
  out[0] |= 0x80 >> (n - 1);
  return out;
}

function float64(x) {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setFloat64(0, x, false);
  return out;
}

/**
 * Doplní alebo prepíše dĺžku WebM. vstup: Uint8Array alebo ArrayBuffer, ms: dĺžka v milisekundách.
 * Vráti { data: Uint8Array, zmenene: bool, dovod }.
 */
export function doplnDlzkuWebm(vstup, ms) {
  const b = vstup instanceof Uint8Array ? vstup : new Uint8Array(vstup);
  const nic = (dovod) => ({ data: b, zmenene: false, dovod });
  let p = 0;
  const e = citajId(b, p);
  if (!e || e.id !== ID.EBML) return nic('nie je EBML');
  const ev = citajVelkost(b, p + e.dlzka);
  if (!ev || ev.neznama) return nic('zlá hlavička EBML');
  p += e.dlzka + ev.dlzka + ev.hodnota;
  const s = citajId(b, p);
  if (!s || s.id !== ID.SEGMENT) return nic('chýba Segment');
  const sv = citajVelkost(b, p + s.dlzka);
  if (!sv) return nic('zlá veľkosť Segmentu');
  const segVelkostPoz = p + s.dlzka;
  const segData = segVelkostPoz + sv.dlzka;
  // deti Segmentu až po Info (Info je vždy pred prvým Clusterom)
  let q = segData, seekHead = null;
  for (let krok = 0; krok < 64 && q < b.length; krok++) {
    const d = citajId(b, q);
    if (!d) return nic('poškodený prvok');
    const dv = citajVelkost(b, q + d.dlzka);
    if (!dv) return nic('poškodená veľkosť');
    if (d.id === ID.SEEKHEAD) { if (dv.neznama) return nic('zlý SeekHead'); seekHead = { od: q + d.dlzka + dv.dlzka, do: q + d.dlzka + dv.dlzka + dv.hodnota }; q = seekHead.do; continue; }
    if (d.id === ID.CLUSTER) return nic('Info nenájdené');
    if (d.id !== ID.INFO) { if (dv.neznama) return nic('neznáma veľkosť pred Info'); q += d.dlzka + dv.dlzka + dv.hodnota; continue; }
    // Info: nájdi TimecodeScale a Duration
    const infoData = q + d.dlzka + dv.dlzka, infoKoniec = infoData + dv.hodnota;
    if (dv.neznama || infoKoniec > b.length) return nic('zlé Info');
    let mierka = 1e6, durPoz = -1, durDlzka = 0;
    for (let r = infoData; r < infoKoniec;) {
      const c = citajId(b, r), cv = c && citajVelkost(b, r + c.dlzka);
      if (!c || !cv) return nic('poškodené Info');
      const dataPoz = r + c.dlzka + cv.dlzka;
      if (c.id === ID.SCALE) { let v = 0; for (let i = 0; i < cv.hodnota; i++) v = v * 256 + b[dataPoz + i]; if (v > 0) mierka = v; }
      if (c.id === ID.DURATION) { durPoz = dataPoz; durDlzka = cv.hodnota; }
      r = dataPoz + cv.hodnota;
    }
    const hodnota = (ms * 1e6) / mierka;
    if (durPoz >= 0) {
      const out = b.slice();
      const dv2 = new DataView(out.buffer, out.byteOffset, out.byteLength);
      if (durDlzka === 8) dv2.setFloat64(durPoz, hodnota, false);
      else if (durDlzka === 4) dv2.setFloat32(durPoz, hodnota, false);
      else return nic('Duration s nečakanou dĺžkou');
      return { data: out, zmenene: true, dovod: 'prepísané' };
    }
    const prvok = new Uint8Array([0x44, 0x89, 0x88, ...float64(hodnota)]);
    const novaVelkost = dv.hodnota + prvok.length;
    const n = novaVelkost < 2 ** (7 * dv.dlzka) - 1 ? dv.dlzka : 8;
    const velkostInfo = zapisVelkost(novaVelkost, n);
    const delta = prvok.length + (n - dv.dlzka);
    const casti = [b.subarray(0, q + d.dlzka), velkostInfo, b.subarray(infoData, infoKoniec), prvok, b.subarray(infoKoniec)];
    const out = new Uint8Array(casti.reduce((a, x) => a + x.length, 0));
    let o = 0;
    for (const x of casti) { out.set(x, o); o += x.length; }
    if (!sv.neznama) out.set(zapisVelkost(sv.hodnota + delta, sv.dlzka), segVelkostPoz);
    if (seekHead) {
      // SeekPosition je relatívne k začiatku dát Segmentu; všetko za začiatkom Info sa posunulo o delta
      const infoRel = q - segData;
      for (let r = seekHead.od; r < seekHead.do;) {
        const c = citajId(out, r), cv = c && citajVelkost(out, r + c.dlzka);
        if (!c || !cv) return nic('poškodený SeekHead');
        const dataPoz = r + c.dlzka + cv.dlzka;
        if (c.id === ID.SEEK) {
          for (let t = dataPoz; t < dataPoz + cv.hodnota;) {
            const x = citajId(out, t), xv = x && citajVelkost(out, t + x.dlzka);
            if (!x || !xv) return nic('poškodený Seek');
            const xp = t + x.dlzka + xv.dlzka;
            if (x.id === ID.SEEKPOS) {
              let v = 0;
              for (let i = 0; i < xv.hodnota; i++) v = v * 256 + out[xp + i];
              if (v > infoRel) {
                let nv = v + delta;
                if (nv >= 2 ** (8 * xv.hodnota)) return nic('SeekPosition sa nezmestí');
                for (let i = xv.hodnota - 1; i >= 0; i--) { out[xp + i] = nv % 256; nv = Math.floor(nv / 256); }
              }
            }
            t = xp + xv.hodnota;
          }
        }
        r = dataPoz + cv.hodnota;
      }
    }
    return { data: out, zmenene: true, dovod: seekHead ? 'doplnené, SeekHead posunutý' : 'doplnené' };
  }
  return nic('Info nenájdené');
}

/** Prečíta dĺžku z WebM v ms (pre testy a kontrolu), alebo null. */
export function dlzkaWebm(vstup) {
  const b = vstup instanceof Uint8Array ? vstup : new Uint8Array(vstup);
  let p = 0;
  const e = citajId(b, p); if (!e || e.id !== ID.EBML) return null;
  const ev = citajVelkost(b, p + e.dlzka); p += e.dlzka + ev.dlzka + ev.hodnota;
  const s = citajId(b, p); if (!s || s.id !== ID.SEGMENT) return null;
  const sv = citajVelkost(b, p + s.dlzka);
  let q = p + s.dlzka + sv.dlzka;
  for (let krok = 0; krok < 64 && q < b.length; krok++) {
    const d = citajId(b, q), dv = d && citajVelkost(b, q + d.dlzka);
    if (!d || !dv || d.id === ID.CLUSTER) return null;
    if (d.id === ID.INFO) {
      const k = q + d.dlzka + dv.dlzka + dv.hodnota;
      let mierka = 1e6, dur = null;
      for (let r = q + d.dlzka + dv.dlzka; r < k;) {
        const c = citajId(b, r), cv = citajVelkost(b, r + c.dlzka), poz = r + c.dlzka + cv.dlzka;
        const view = new DataView(b.buffer, b.byteOffset + poz, cv.hodnota);
        if (c.id === ID.SCALE) { let v = 0; for (let i = 0; i < cv.hodnota; i++) v = v * 256 + b[poz + i]; mierka = v; }
        if (c.id === ID.DURATION) dur = cv.hodnota === 8 ? view.getFloat64(0, false) : view.getFloat32(0, false);
        r = poz + cv.hodnota;
      }
      return dur == null ? null : (dur * mierka) / 1e6;
    }
    q += d.dlzka + dv.dlzka + dv.hodnota;
  }
  return null;
}

const UROVEN1 = new Set([0x1f43b675, 0x1c53bb6b, 0x1254c367, 0x1043a770, 0x1941a469, 0x114d9b74, 0x1549a966, 0x1654ae6b]);

/**
 * Dĺžka podľa obsahu v ms: najneskorší čas bloku (Cluster Timecode + relatívny čas SimpleBlock alebo Block) plus jedna
 * snímka (33 ms). Brána 2: dĺžka sa nesmie brať z hodín stránky, lebo nahrávač, ktorý skončí sám, by mal v hlavičke 16 s
 * a v obsahu 4,5 s. Vráti null, ak súbor nemá čitateľné bloky.
 */
export function dlzkaObsahuWebm(vstup) {
  const b = vstup instanceof Uint8Array ? vstup : new Uint8Array(vstup);
  let p = 0;
  const e = citajId(b, p); if (!e || e.id !== ID.EBML) return null;
  const ev = citajVelkost(b, p + e.dlzka); if (!ev) return null;
  p += e.dlzka + ev.dlzka + ev.hodnota;
  const s = citajId(b, p); if (!s || s.id !== ID.SEGMENT) return null;
  const sv = citajVelkost(b, p + s.dlzka); if (!sv) return null;
  let q = p + s.dlzka + sv.dlzka, mierka = 1e6, najneskor = -1;
  const uint = (od, n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + b[od + i]; return v; };
  const blok = (od, tc) => {
    const t = citajVelkost(b, od); // číslo stopy ako vint
    if (!t || od + t.dlzka + 2 > b.length) return;
    const rel = (b[od + t.dlzka] << 8) | b[od + t.dlzka + 1];
    const cas = tc + (rel & 0x8000 ? rel - 0x10000 : rel);
    if (cas > najneskor) najneskor = cas;
  };
  while (q < b.length) {
    const d = citajId(b, q), dv = d && citajVelkost(b, q + d.dlzka);
    if (!d || !dv) break;
    const data = q + d.dlzka + dv.dlzka;
    if (d.id === ID.INFO && !dv.neznama) {
      for (let r = data; r < data + dv.hodnota;) {
        const c = citajId(b, r), cv = c && citajVelkost(b, r + c.dlzka);
        if (!c || !cv) break;
        if (c.id === ID.SCALE) { const v = uint(r + c.dlzka + cv.dlzka, cv.hodnota); if (v > 0) mierka = v; }
        r += c.dlzka + cv.dlzka + cv.hodnota;
      }
    }
    if (d.id !== ID.CLUSTER) {
      if (dv.neznama) break;
      q = data + dv.hodnota;
      continue;
    }
    // Cluster: deti až po koniec (známa veľkosť) alebo po ďalší prvok úrovne 1 (neznáma veľkosť z MediaRecorder)
    const koniec = dv.neznama ? b.length : Math.min(b.length, data + dv.hodnota);
    let r = data, tc = 0;
    while (r < koniec) {
      const c = citajId(b, r), cv = c && citajVelkost(b, r + c.dlzka);
      if (!c || !cv) { r = b.length; break; }
      if (dv.neznama && UROVEN1.has(c.id)) break;
      const cd = r + c.dlzka + cv.dlzka;
      if (cv.neznama || cd + cv.hodnota > b.length) { r = b.length; break; } // useknutý koniec súboru
      if (c.id === 0xe7) tc = uint(cd, cv.hodnota);
      else if (c.id === 0xa3) blok(cd, tc);
      else if (c.id === 0xa0) {
        for (let u = cd; u < cd + cv.hodnota;) {
          const g = citajId(b, u), gv = g && citajVelkost(b, u + g.dlzka);
          if (!g || !gv) break;
          if (g.id === 0xa1) blok(u + g.dlzka + gv.dlzka, tc);
          u += g.dlzka + gv.dlzka + gv.hodnota;
        }
      }
      r = cd + cv.hodnota;
    }
    q = r;
  }
  return najneskor < 0 ? null : (najneskor * mierka) / 1e6 + 33;
}
