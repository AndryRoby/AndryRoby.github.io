/* 2027 Budget Spreadsheet: jednorazovy predaj dvoch XLSX a PDF navodu, ten isty vzor ako shop/escape-room-adults/app.js.
 * Cela logika je spolocna v /titul.js (tlacidlo, test mod, overenie platby cez worker, odomknutie a odkazy zo sluzby).
 * Veta pri tlacidle bez odkazu plati len kym Fable nedosadi odkaz za zastupku DOPLNI_FABLE (node ops/stripe/budget-2027.mjs --zapis). */
import { nastav, T } from '../../titul.js';

T.zapina = 'Buying here is being switched on. The same spreadsheet is on Etsy today, or write to support@arling.sk and we send the files by hand.';

nastav();
