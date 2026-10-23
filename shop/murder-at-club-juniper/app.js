/* Murder at Club Juniper (murder-at-club-juniper, relacia 229): anglicka verzia hry Mord im Club Juniper,
 * jednorazovy predaj dvoch PDF (A4 a US Letter), ten isty vzor ako shop/krimidinner-mafia/app.js.
 * Cela logika je spolocna v /titul.js (tlacidlo, test mod, overenie platby cez workera, odomknutie a odkazy
 * z licencnej sluzby); titul.js sa tu NEMENI, je spolocny pre ine stranky.
 *
 * titul.js ma anglicke predvolene texty, ale niektore hovoria o inom obchode alebo inom skripte (zapina, testChyba),
 * preto sa tu prepisu vsetky kluce T a PANEL, ktore titul.js dovoli prepisat (test v
 * ops/stripe/murder-at-club-juniper.test.mjs to strazi).
 *
 * T.nepotvrdene vklada titul.js cez innerHTML: v texte nesmie byt < ani &.
 */
import { nastav, T, PANEL } from '../../titul.js';

Object.assign(T, {
  overujem: 'Checking the payment',
  inaSuma: 'The payment went through, but not for an amount we can match to this game. Write to support@arling.sk and we will sort it out by hand.',
  nepotvrdene: 'We have not been able to confirm the payment yet. We keep trying; if you paid, the files unlock as soon as Stripe answers. If it takes longer than a few minutes, write to support@arling.sk from the e-mail address you paid with.',
  overZnova: 'Check again',
  /* Veta, kym tlacidlo nema odkaz (DOPLNI_FABLE, pred node ops/stripe/murder-at-club-juniper.mjs --zapis). */
  zapina: 'Buying on this page is not switched on yet. If you have a question, write to support@arling.sk.',
  testChyba: 'Test mode is on, but this game has no test link yet (node ops/stripe/murder-at-club-juniper.mjs --test --zapis). Open this page without ?test=1 to buy it for real.',
  testCudzi: 'This is a payment from Stripe test mode. It unlocks the files only in the browser that started the test with ?test=1.',
  odznak: 'The buy button leads to Stripe test mode. Use the card 4242 4242 4242 4242, any future date and any CVC. No money is taken; the files after payment are the real ones.',
});

Object.assign(PANEL, {
  znacka: 'Paid, thank you',
  nadpis: 'Your files',
  stiahnut: 'Download ',
  ukazka: 'Free preview',
  mailPred: 'These links stay in this browser and were also sent to ',
  mailBez: 'the e-mail address you paid with',
  mailPo: '.',
  mailNeisty: 'Download the files now: these buttons stay in this browser only, and each link works for 7 days. We cannot confirm here whether the e-mail with the links has gone out, so if nothing arrives within a few minutes, write to support@arling.sk with the order number below and we will send the files by hand.',
  objednavka: 'Order ',
  test: 'Test mode: the payment was made in Stripe test mode, no money is taken; the files below are the real ones.',
  cakame: 'Your payment is confirmed, but the download links did not load just now. Wait a minute and press Try again.',
  cakamePomoc: 'If they still do not appear, write to support@arling.sk with the payment reference below and we will send you the files.',
  cakamePomocBez: 'If they still do not appear, write to support@arling.sk from the e-mail address you paid with and we will send you the files.',
  znova: 'Try again',
  referencia: 'Payment reference ',
});

nastav();
