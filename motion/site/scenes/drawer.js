/* arling.sk/motion: the "drawer" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createDrawer } from '../../components/drawer/drawer.js';
import { demo as drawerDemo } from '../../components/drawer/demo.js';
import { h, q, uid, field } from '../scene-kit.js';

export const scene = {
  title: 'Drawer',
  height: 360,
  build() {
    const t = uid('drawer-title');
    return [
      h('button', { class: 'am-drawer-trigger', type: 'button' }, 'Edit goal'),
      h('div', { class: 'am-drawer', hidden: true },
        h('div', { class: 'am-drawer-overlay' }),
        h('div', { class: 'am-drawer-panel', role: 'dialog', 'aria-labelledby': t },
          h('div', { class: 'am-drawer-handle' }),
          h('div', { class: 'am-drawer-content' },
            h('h3', { class: 'am-drawer-title', id: t }, 'Daily goal'),
            h('p', { class: 'mo-drawer-text' }, 'Drag the sheet down, flick it, or press Escape.'),
            field('Minutes a day', h('input', { class: 'mo-input', inputmode: 'numeric', value: '20', autocomplete: 'off' })),
            h('div', { class: 'am-drawer-footer' }, h('button', { type: 'button', class: 'mo-btn', 'data-am-close': true }, 'Done'))))),
    ];
  },
  create: (stage, o = {}) => createDrawer({ trigger: q(stage, '.am-drawer-trigger'), root: q(stage, '.am-drawer'), clock: o.clock, reduced: o.reduced }),
  demo: drawerDemo,
};
