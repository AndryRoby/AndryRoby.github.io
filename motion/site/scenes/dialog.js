/* arling.sk/motion: the "dialog" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createDialog } from '../../components/dialog/dialog.js';
import { demo as dialogDemo } from '../../components/dialog/demo.js';
import { h, q, uid, field } from '../scene-kit.js';

export const scene = {
  title: 'Dialog',
  height: 380,
  build() {
    const t = uid('dialog-title');
    return [
      h('button', { class: 'am-dialog-trigger', type: 'button' }, 'Edit profile'),
      h('div', { class: 'am-dialog-root', hidden: true },
        h('div', { class: 'am-dialog-backdrop' }),
        h('div', { class: 'am-dialog-frame' },
          h('div', { class: 'am-dialog', role: 'dialog', 'aria-labelledby': t },
            h('div', { class: 'am-dialog-content' },
              h('h3', { class: 'am-dialog-title', id: t }, 'Edit profile'),
              h('p', { class: 'am-dialog-description' }, 'A sample form. Nothing you type here is saved.'),
              field('Name', h('input', { class: 'mo-input', value: 'Ada', autocomplete: 'off' })),
              h('div', { class: 'am-dialog-footer' },
                h('button', { type: 'button', 'data-am-close': true }, 'Cancel'),
                h('button', { type: 'button', 'data-am-close': true, 'data-variant': 'primary' }, 'Save')))))),
    ];
  },
  create: (stage, o = {}) => createDialog({ trigger: q(stage, '.am-dialog-trigger'), root: q(stage, '.am-dialog-root'), clock: o.clock, reduced: o.reduced }),
  demo: dialogDemo,
};
