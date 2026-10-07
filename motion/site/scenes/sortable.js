/* arling.sk/motion: the "sortable" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createSortable } from '../../components/sortable/sortable.js';
import { demo as sortableDemo } from '../../components/sortable/demo.js';
import { h, q, uid } from '../scene-kit.js';

// Today's tasks in the order you choose, as in a to-do app. The list is only on this page;
// nothing is saved.
const TASKS = [
  ['reply', 'Reply to customers'],
  ['invoices', 'Send invoices'],
  ['prices', 'Update prices'],
  ['plan', 'Plan next week'],
];

export const scene = {
  title: 'Sortable',
  height: 330,
  build() {
    const id = uid('sortable-label');
    return [
      h('div', { class: 'mo-sortable-scene' },
        h('span', { class: 'mo-sortable-label', id }, 'Today, in order'),
        h('div', { class: 'am-sortable' },
          h('ul', { class: 'am-sortable-list', 'aria-labelledby': id },
            ...TASKS.map(([value, label]) => h('li', { 'data-value': value }, h('span', { class: 'am-sortable-label' }, label))))),
        h('p', { class: 'mo-hint' }, 'Drag a handle, or press Space on it and use the arrow keys.')),
    ];
  },
  create: (stage, o = {}) => createSortable({ root: q(stage, '.am-sortable'), clock: o.clock, reduced: o.reduced }),
  demo: sortableDemo,
};
