/* arling.sk/motion: the "accordion" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createAccordion } from '../../components/accordion/accordion.js';
import { demo as accordionDemo } from '../../components/accordion/demo.js';
import { h, q } from '../scene-kit.js';

export const scene = {
  title: 'Accordion',
  height: 330,
  align: 'top',
  build() {
    const item = (title, rows) => h('div', { class: 'am-accordion-item' },
      h('h3', { class: 'am-accordion-heading' }, h('button', { class: 'am-accordion-trigger', type: 'button' }, title)),
      h('div', { class: 'am-accordion-panel', hidden: true },
        h('div', { class: 'am-accordion-content' }, ...rows.map((r) => h('p', {}, r)))));
    return [
      h('div', { class: 'am-accordion' },
        item('What is free?', ['All twenty components and the core.', 'MIT licence, for any project.', 'No account, no key.']),
        item('Do I need React?', ['No. Each component is plain JavaScript.', 'The React files are thin wrappers.', 'Both use the same logic.']),
        item('How does the video work?', ['Every component has a 4 second demo.', 'seek(t) paints any moment of it.', 'The last frame equals the first.'])),
    ];
  },
  create: (stage, o = {}) => createAccordion({ root: q(stage, '.am-accordion'), clock: o.clock, reduced: o.reduced }),
  demo: accordionDemo,
};
