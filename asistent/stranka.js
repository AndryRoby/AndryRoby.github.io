// stranka.js: záložky so stavmi widgetu v2 v úvode /asistent/ (28. 9. 2026).
// Komponent Tabs z ARLing Motion (/motion/components/tabs/tabs.js): pilulka za záložkou má dva okraje na dvoch
// pružinách, panely zdieľajú jednu bunku mriežky (bez posunu rozloženia), klávesnica podľa WAI-ARIA (šípky,
// Home, End), pri zníženom pohybe bez animácie. Bez tohto skriptu ostáva viditeľná prvá snímka a ostatné
// sú skryté atribútom hidden, takže stránka funguje aj bez JavaScriptu.
import { createTabs } from '../motion/components/tabs/tabs.js';

const koren = document.querySelector('[data-snimky]');
if (koren) {
  const skryte = [...koren.querySelectorAll('[role="tabpanel"][hidden]')];
  skryte.forEach((p) => { p.hidden = false; });
  try {
    createTabs({ root: koren, activation: 'automatic' });
  } catch (e) {
    skryte.forEach((p) => { p.hidden = true; });
  }
}
