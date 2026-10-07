/* arling.sk/motion: the "segmented" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createSegmented } from '../../components/segmented/segmented.js';
import { demo as segmentedDemo } from '../../components/segmented/demo.js';
import { h, q, uid } from '../scene-kit.js';

// A plan picker as on a pricing page. It rests on Pro, so the row is never an empty box; the
// plans are only names, nothing is bought here.
export const scene = {
  title: 'Segmented control',
  height: 150,
  build() {
    const id = uid('plan');
    const option = (label, on) => h('button', { type: 'button', role: 'radio', 'data-value': label.toLowerCase(), 'aria-checked': on ? 'true' : 'false' }, label);
    return [
      h('div', { class: 'mo-segmented-scene' },
        h('span', { class: 'mo-segmented-label', id }, 'Plan'),
        h('div', { class: 'am-segmented', role: 'radiogroup', 'aria-labelledby': id },
          option('Free'), option('Pro', true), option('Business'))),
    ];
  },
  create: (stage, o = {}) => createSegmented({ root: q(stage, '.am-segmented'), clock: o.clock, reduced: o.reduced }),
  demo: segmentedDemo,
};
