/* Murder at the Lantern Ball: jednorazovy predaj troch PDF, ten isty vzor ako
 * detektivna sada (shop/detective-kit/app.js). Cela logika je spolocna v
 * /titul.js (tlacidlo, test mod, overenie platby cez worker, odomknutie a
 * odkazy z licencnej sluzby). Externy subor, aby stranka nemusela mat vlozeny
 * skript a jeho odtlacok v CSP.
 *
 * Jedina zmena: veta pri tlacidle bez odkazu. Plati len kym Fable nedosadi
 * odkaz za zastupku DOPLNI_FABLE (node ops/stripe/eliminacia.mjs --zapis).
 */
import { nastav, T } from '../../titul.js';

T.zapina = 'Buying here is not switched on yet. It is on sale on Etsy today, or write to support@arling.sk and we send the files by hand.';

nastav();
