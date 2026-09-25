/* Klient lisu: posiela prace do workera (OffscreenCanvas), a kde worker nejde,
   tlaci na hlavnom vlakne po kuskoch. Worker sa ukonci, ked 3 s nic nerobi. */
import { lis } from './tlac.js';
import { KRESBY } from './kresby.js';

let worker = null, bezWorkera = typeof OffscreenCanvas === 'undefined' || typeof Worker === 'undefined';
let dalsie = 1, koniecCas = 0;
const cakaju = new Map();

function zober() {
  if (bezWorkera) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./tlac-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const c = cakaju.get(e.data.id);
      if (!c) return;
      cakaju.delete(e.data.id);
      if (e.data.chyba) c.rej(new Error(e.data.chyba));
      else c.res(new Map(e.data.mena.map((m, i) => [m, e.data.bitmapy[i]])));
      planujKoniec();
    };
    worker.onerror = () => { bezWorkera = true; zrus(); for (const [id, c] of cakaju) { cakaju.delete(id); tlacTu(c.mena, c.s, c.cell).then(c.res, c.rej); } };
  } catch { bezWorkera = true; return null; }
  return worker;
}
function zrus() { if (worker) { worker.terminate(); worker = null; } }
function planujKoniec() {
  clearTimeout(koniecCas);
  koniecCas = setTimeout(() => { if (!cakaju.size) zrus(); }, 3000);
}
async function tlacTu(mena, s, cell) {
  const out = new Map();
  for (const m of mena) {
    const pl = await lis(KRESBY[m], s, cell);
    out.set(m, typeof createImageBitmap === 'function' ? await createImageBitmap(pl) : pl);
  }
  return out;
}

/* Vytlaci kresby podla mena pri mierke s. Vrati Map meno -> ImageBitmap. */
export function tlac(mena, s, cell) {
  const w = zober();
  if (!w) return tlacTu(mena, s, cell);
  const id = dalsie++;
  return new Promise((res, rej) => { cakaju.set(id, { res, rej, mena, s, cell }); w.postMessage({ id, mena, s, cell }); });
}
export const suWorkerom = () => !bezWorkera;
