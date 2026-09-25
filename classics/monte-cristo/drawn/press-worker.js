/* The print shop in a background thread: draws a scene, screens its three
 * inks and lays them on paper, so scrolling on the page never waits for it.
 * It sends back the finished print as a compressed image (the page keeps only
 * that) and, when the page wants to show the drums at work, the print in
 * three opaque stages (yellow; yellow and red; all three inks), so the page
 * can show the drums passing with plain compositing and no blend mode. */
import { press, lay, makeCanvas } from './ink.js';
/* the scene list carries the page's version (?v=N), see drawn.js */
const scenes = import('./scenes/index.js' + self.location.search);

self.onmessage = async (e) => {
  const { id, w, h, pr, cell, layers: wantLayers } = e.data;
  const t0 = performance.now();
  try {
    const { SCENES } = await scenes;
    const scene = SCENES[id];
    if (!scene) throw new Error('unknown scene ' + id);
    const size = { w, h, pr };
    const layers = await press(scene, size, cell);
    const out = makeCanvas(w, h);
    lay(out.getContext('2d'), layers, size);
    let blob = await out.convertToBlob({ type: 'image/webp', quality: 0.92 });
    if (blob.type !== 'image/webp') blob = await out.convertToBlob({ type: 'image/png' });
    let bitmaps = null;
    if (wantLayers) {
      bitmaps = [];
      for (const p of [[1, 0, 0], [1, 1, 0]]) { const c = makeCanvas(w, h); lay(c.getContext('2d'), layers, size, p); bitmaps.push(c.transferToImageBitmap()); }
      bitmaps.push(out.transferToImageBitmap());
    }
    self.postMessage({ id, blob, bitmaps, ms: Math.round(performance.now() - t0) }, bitmaps || []);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};
