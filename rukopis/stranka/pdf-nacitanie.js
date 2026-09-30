// Rukopis 1.4: nástroje na PDF správu sa načítajú až po kliknutí na „Stiahnuť PDF správu“.
// Z vlastného servera sa sťahujú len statické súbory (jsPDF a dve písma). Text používateľa sa nikam neposiela:
// tento modul nič neodosiela, iba číta súbory zo stranka/vendor/.
let nastroje = null;

const nacitajSkript = src => new Promise((ok, zle) => {
  const s = document.createElement('script');
  s.src = src; s.onload = ok; s.onerror = zle;
  document.head.append(s);
});
const binarne = buf => {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
  return s;
};

export function pdfKniznica() {
  nastroje ??= (async () => {
    const vendor = new URL('./vendor/', import.meta.url);
    const pismo = n => fetch(new URL(n + '?v=1.4', vendor), { credentials: 'omit' }).then(x => { if (!x.ok) throw Error('pismo'); return x.arrayBuffer(); });
    const [, regular, bold, modul] = await Promise.all([
      globalThis.jspdf?.jsPDF ? null : nacitajSkript(new URL('jspdf.umd.min.js?v=4.2.1', vendor).href),
      pismo('arling-sans-400.ttf'), pismo('arling-sans-600.ttf'), import('./pdf.js?v=1.4')
    ]);
    return { jsPDF: globalThis.jspdf.jsPDF, pisma: { regular: binarne(regular), bold: binarne(bold) }, spravaPdf: modul.spravaPdf };
  })();
  nastroje.catch(() => { nastroje = null; });
  return nastroje;
}
