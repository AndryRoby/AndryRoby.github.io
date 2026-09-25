/* Every scene on the page, by id. The id is the plate's data-scene in
 * index.html. Part three added volume five (v5.js). */
import { SCENES as v1 } from './v1.js';
import { SCENES as v2 } from './v2.js';
import { SCENES as v3 } from './v3.js';
import { SCENES as v4 } from './v4.js';
import { SCENES as v5 } from './v5.js';

export const SCENES = Object.assign({}, v1, v2, v3, v4, v5);
