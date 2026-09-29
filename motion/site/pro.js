/* ARLing Motion Pro: buying the zip on arling.sk/motion/#pro.
 *
 * The whole flow is shared with the other one-off products of arling.sk in /titul.js
 * (hub root, products/arling-sk/titul.js): the button leads to a Stripe payment link
 * (data-link, in test mode data-link-test), Stripe returns the buyer to
 * /motion/?titul=motion-pro&session_id=..., the page asks the worker whether the
 * session is paid, and a panel with the signed download link from the licence
 * service replaces the button. The zip itself never lies on the site.
 *
 * Page specific, and only here:
 *  - the title data are passed to nastav() directly, so the page needs no inline
 *    JSON block (the Motion page allows scripts only as files, test/site.test.mjs);
 *  - while the button has no usable link (the DOPLNI_FABLE placeholder, or a live
 *    link missing outside test mode), the buy row stays hidden and a plain
 *    "not on sale yet" line shows instead, so the public page never offers a
 *    button that cannot take a payment;
 *  - after the return from Stripe the page scrolls to #pro, where the status and
 *    the download panel appear.
 * Links are written by node ops/stripe/motion-pro.mjs, never by hand.
 */
import { nastav, T, odkazTlacidla, testRezim } from '/titul.js';

const TITUL = 'motion-pro';
const DATA = { titul: TITUL, nazov: 'ARLing Motion Pro', cena: 4900, produkt: TITUL };

T.zapina = 'Buying Pro here is not switched on yet. Write to support@arling.sk and we will tell you when it is.';

function pripravNakup() {
  const test = testRezim();
  const tlacidla = [...document.querySelectorAll('[data-titul="' + TITUL + '"]')];
  const predaj = tlacidla.some((b) => odkazTlacidla(b.dataset, test));
  for (const b of tlacidla) {
    const riadok = b.closest('.akcie');
    if (riadok) riadok.hidden = !predaj;
  }
  const skoro = document.getElementById('pro-skoro');
  if (skoro) skoro.hidden = predaj;
}

function kSekcii() {
  try {
    const q = new URL(location.href).searchParams;
    if (q.get('titul') === TITUL && q.get('session_id')) {
      const pro = document.getElementById('pro');
      if (pro) pro.scrollIntoView({ block: 'start' });
    }
  } catch (e) { /* no address, nothing to scroll */ }
}

pripravNakup();
kSekcii();
nastav({ data: DATA });
