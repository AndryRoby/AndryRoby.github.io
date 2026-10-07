/* arling.sk/motion: the "popover" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createMenu } from '../../components/popover/popover.js';
import { demo as popoverDemo } from '../../components/popover/demo.js';
import { h, q } from '../scene-kit.js';

export const scene = {
  title: 'Dropdown menu',
  height: 250,
  align: 'top',
  build() {
    const item = (label, disabled) => h('button', { role: 'menuitem', type: 'button', 'aria-disabled': disabled ? 'true' : null }, label);
    return [
      h('div', { class: 'am-popover-root' },
        h('button', { class: 'am-popover-trigger', type: 'button' }, 'Actions'),
        h('div', { class: 'am-menu', role: 'menu', hidden: true },
          item('Duplicate'), item('Rename'), item('Archive'), item('Delete', true))),
    ];
  },
  create: (stage, o = {}) => createMenu({ trigger: q(stage, '.am-popover-trigger'), menu: q(stage, '.am-menu'), clock: o.clock, reduced: o.reduced }),
  demo: popoverDemo,
};
