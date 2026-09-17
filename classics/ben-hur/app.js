/* Ben-Hur: jednorazovy predaj jedneho titulu.
 * Cela logika je spolocna v /titul.js (tlacidlo, test mod, overenie platby cez
 * worker, odomknutie a odkazy na subory). Tu ostava len zapnutie, aby stranka
 * nemusela mat vlozeny skript a jeho odtlacok v CSP.
 * Udaje o suboroch su v stranke v bloku <script type="application/json"
 * id="titul-data">, dosadzuje ich ops/design/tajne-cesty-titul.mjs.
 */
import { nastav } from '../../titul.js';

nastav();
