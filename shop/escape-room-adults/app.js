/* The Clockmaker's Workshop: jednorazovy predaj dvoch PDF, ten isty vzor ako shop/detective-kit/app.js.
 * Cela logika je spolocna v /titul.js (tlacidlo, test mod, overenie platby cez worker,
 * odomknutie a odkazy zo sluzby). Externy subor, aby stranka nemala vlozeny skript.
 *
 * Jedina zmena: veta pri tlacidle bez odkazu. Plati len kym Fable nedosadi odkaz za
 * zastupku DOPLNI_FABLE (node ops/stripe/sady.mjs --slug escape-room-adults --zapis).
 */
import { nastav, T } from '../../titul.js';

T.zapina = 'Buying here is not switched on yet. Write to support@arling.sk and we send the game by hand.';

nastav();
