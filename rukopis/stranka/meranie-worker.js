// Rukopis 1.4: dlhý text (napríklad záverečná práca s 30 000 slovami) meriame mimo hlavného vlákna,
// aby stránka pri písaní nezamrzla. Worker beží v tom istom prehliadači, text nikam neodchádza.
import { merajText } from '../jadro/meranie.js?v=1.4';

self.addEventListener('message', e => {
  const { id, text, moznosti, explicitne } = e.data;
  try { self.postMessage({ id, explicitne, r: merajText(text, moznosti) }); }
  catch { self.postMessage({ id, explicitne, chyba: true }); }
});
