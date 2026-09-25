/* Detektivna sada: jednorazovy predaj jedneho suboru, ten isty vzor ako tituly.
 * Cela logika je spolocna v /titul.js (tlacidlo, test mod, overenie platby cez
 * worker, odomknutie a odkazy zo sluzby). Externy subor, aby stranka nemusela
 * mat vlozeny skript a jeho odtlacok v CSP.
 *
 * Jedina zmena oproti titulom: veta pri tlacidle bez odkazu. Spolocna veta
 * posiela na Etsy, kde sada nie je. Plati len na tejto stranke (modul sa
 * nacita pre kazdu stranku zvlast) a len kym Fable nedosadi odkaz za
 * zastupku DOPLNI_FABLE (node ops/stripe/detektiv-sada.mjs --zapis).
 */
import { nastav, T } from '../../titul.js';

T.zapina = 'Buying here is not switched on yet. Write to andrej@arling.sk and we send the kit by hand.';

nastav();
