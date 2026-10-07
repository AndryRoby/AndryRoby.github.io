/* arling.sk/motion: the "toast" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createToaster, centerOf } from '../../components/toast/toast.js';
import { demo as toastDemo, MESSAGES } from '../../components/toast/demo.js';
import { h, q, withCleanup } from '../scene-kit.js';

export const scene = {
  title: 'Toast',
  height: 260,
  build() {
    return [
      h('button', { class: 'mo-btn mo-toast-trigger', type: 'button' }, 'Save draft'),
      h('div', { class: 'am-toaster', role: 'region', 'aria-label': 'Notifications' }, h('ol', { class: 'am-toaster-list' })),
    ];
  },
  create(stage, o = {}) {
    const button = q(stage, '.mo-toast-trigger');
    const api = createToaster({ root: q(stage, '.am-toaster'), trigger: button, clock: o.clock, reduced: o.reduced });
    let i = 0;
    const onClick = (e) => {
      const from = e.detail > 0 ? { x: e.clientX, y: e.clientY } : centerOf(button);
      api.toast(MESSAGES[i++ % MESSAGES.length], { from });
    };
    button.addEventListener('click', onClick);
    return withCleanup(api, () => button.removeEventListener('click', onClick));
  },
  demo: toastDemo,
};
