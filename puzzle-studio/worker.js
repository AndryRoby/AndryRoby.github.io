/* Puzzle Studio: the worker that does the actual work.
 *
 * Generating a Killer Sudoku or a Nurikabe is a search, and a search on the
 * main thread is a frozen page: no scrolling, no cancel button, no cursor. So
 * every puzzle is made here, on a thread of its own, and the page only ever
 * receives finished SVG.
 *
 * It is a module worker (new Worker(url, { type: 'module' })), which is what
 * lets it import the very same generator files the free daily games run on.
 * Browsers that cannot do module workers get the same code run on the main
 * thread in small pieces instead, see app.js; that is why everything here is
 * a thin wrapper around druhy.mjs rather than logic of its own.
 *
 * Messages in:
 *   { typ: 'davka', id, kluc, uroven, velkost, ulohy: [{ i, kluce: [...] }] }
 *   { typ: 'stop' }                          give up on the batch in flight
 * Messages out:
 *   { typ: 'zaciatok', id, pocet }
 *   { typ: 'hlavolam', id, i, hlavolam }     one finished puzzle
 *   { typ: 'chyba', id, i, sprava }          this one could not be made
 *   { typ: 'koniec', id, hotovych, chyb, ms }
 */
import { nacitaj, vyrob, popisVelkosti } from './druhy.mjs';

let zrusene = null;

self.addEventListener('message', async (e) => {
  const m = e.data || {};
  if (m.typ === 'stop') { zrusene = m.id != null ? m.id : true; return; }
  if (m.typ !== 'davka') return;
  await davka(m);
});

async function davka(m) {
  const t0 = performance.now();
  let hotovych = 0, chyb = 0;
  let modul;
  try {
    modul = await nacitaj(m.kluc);
  } catch (err) {
    self.postMessage({ typ: 'chyba', id: m.id, i: -1, sprava: 'The ' + m.kluc + ' generator did not load: ' + err.message });
    self.postMessage({ typ: 'koniec', id: m.id, hotovych: 0, chyb: 1, ms: 0 });
    return;
  }
  self.postMessage({ typ: 'zaciatok', id: m.id, pocet: m.ulohy.length });

  for (const u of m.ulohy) {
    if (zrusene === true || zrusene === m.id) break;
    try {
      const r = vyrob(modul, m.uroven, m.velkost, u.kluce);
      hotovych++;
      self.postMessage({
        typ: 'hlavolam',
        id: m.id,
        i: u.i,
        hlavolam: {
          i: u.i,
          druh: m.kluc,
          uroven: m.uroven,
          velkost: popisVelkosti(m.kluc, r.p),
          n: r.p.n != null ? r.p.n : r.p.N,
          kluc: r.kluc,
          zadanie: r.zadanie,
          riesenie: r.riesenie,
          msGen: Math.round(r.msGen * 10) / 10,
          msOver: Math.round(r.msOver * 10) / 10,
          uzly: r.overenie.uzly,
          pocetRieseni: r.overenie.pocet,
        },
      });
    } catch (err) {
      chyb++;
      self.postMessage({ typ: 'chyba', id: m.id, i: u.i, sprava: err.message });
    }
    // Let the worker's own message queue run, so a stop arrives between two
    // puzzles instead of after the whole batch.
    await new Promise((r) => setTimeout(r, 0));
  }
  self.postMessage({ typ: 'koniec', id: m.id, hotovych, chyb, ms: Math.round(performance.now() - t0) });
  if (zrusene === m.id) zrusene = null;
}
