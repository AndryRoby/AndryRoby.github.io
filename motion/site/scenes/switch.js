/* arling.sk/motion: the "switch" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createSwitch } from '../../components/switch/switch.js';
import { demo as switchDemo } from '../../components/switch/demo.js';
import { h, q, uid } from '../scene-kit.js';

export const scene = {
  title: 'Switch',
  height: 130,
  build() {
    const id = uid('switch-label');
    return [
      h('div', { class: 'mo-switch-row' },
        h('span', { id }, 'Email me when a render is done'),
        h('button', { class: 'am-switch', type: 'button', role: 'switch', 'aria-checked': 'false', 'aria-labelledby': id })),
    ];
  },
  create: (stage, o = {}) => createSwitch({ el: q(stage, '.am-switch'), clock: o.clock, reduced: o.reduced }),
  demo: switchDemo,
};
