/* arling.sk/motion: the "number" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createNumber } from '../../components/number/number.js';
import { demo as numberDemo } from '../../components/number/demo.js';
import { h, q } from '../scene-kit.js';

export const scene = {
  title: 'Number',
  height: 150,
  build() {
    return [
      h('div', { class: 'mo-number-row' },
        h('span', { class: 'mo-number-label' }, 'Net sales this month'),
        h('span', { class: 'am-number mo-number-value' })),
    ];
  },
  create: (stage, o = {}) => createNumber({ el: q(stage, '.am-number'), value: 0, decimals: 2, prefix: '€', clock: o.clock, reduced: o.reduced }),
  demo: numberDemo,
};
