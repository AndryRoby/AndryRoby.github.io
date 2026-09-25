/* Register vsetkych kresieb, ktore lis tlaci (hlavne vlakno aj worker ich poznaju podla mena). */
import { zadna, rezSvet, LUCE } from './kulisy/vazenie.js';
import { TABLA } from './kulisy/tablo.js';
import { DETAILY } from './kulisy/detaily.js';
import { DIELY } from './postavy.js';
import { KULISY69, REK69, SVETLO69, TABLA69, DETAILY69 } from './kulisy/pariz.js';
import { DIELY69 } from './postavy69.js';

export const KRESBY = Object.assign({ zadna, rez: rezSvet }, LUCE, TABLA, DETAILY, DIELY, KULISY69, REK69, SVETLO69, TABLA69, DETAILY69, DIELY69);
