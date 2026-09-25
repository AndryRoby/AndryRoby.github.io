/* Lis v pozadi: vytlaci zoznam kresieb do OffscreenCanvas a vrati ImageBitmap bez kopie. */
import { lis } from './tlac.js';
import { KRESBY } from './kresby.js';

self.onmessage = async (e) => {
  const { id, mena, s, cell } = e.data;
  try {
    const bitmapy = [];
    for (const m of mena) {
      const kr = KRESBY[m];
      if (!kr) throw new Error('neznama kresba ' + m);
      bitmapy.push((await lis(kr, s, cell)).transferToImageBitmap());
    }
    self.postMessage({ id, mena, bitmapy }, bitmapy);
  } catch (err) {
    self.postMessage({ id, chyba: String((err && err.message) || err) });
  }
};
