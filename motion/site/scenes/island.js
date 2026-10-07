/* arling.sk/motion: the "island" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createIsland } from '../../components/island/island.js';
import { demo as islandDemo, PAYMENT } from '../../components/island/demo.js';
import { beats } from '../../src/core.js';
import { h, q, withCleanup } from '../scene-kit.js';

// The island sits at the top of the stage like a status pill on a sales page. Live, the button
// runs the demo's made-up payment once (timers, so reduced motion shows every state too);
// nothing is charged.
export const scene = {
  title: 'Island',
  height: 180,
  align: 'top',
  build() {
    return [
      h('div', { class: 'mo-island-scene' },
        h('div', { class: 'mo-island-slot' }, h('div', { class: 'am-island' })),
        h('button', { class: 'mo-btn mo-island-trigger', type: 'button' }, 'Simulate a payment')),
    ];
  },
  create(stage, o = {}) {
    const button = q(stage, '.mo-island-trigger');
    const api = createIsland({ el: q(stage, '.am-island'), clock: o.clock, reduced: o.reduced });
    api.trigger = button;
    const B = beats(120);
    const timers = [];
    // Live stage only (no clock given): rest on a finished state, so the row is never an empty box.
    // Demo and video builds pass a clock and keep the demo's own first frame, so the loop stays seamless.
    const REST = { icon: 'check', title: 'Payment received', tone: 'success' };
    const rest = () => { if (!o.clock) api.show(REST, { t: api.driver.now() - 10 }); };
    rest();
    const onClick = () => {
      if (timers.length) return; // one run at a time
      PAYMENT.forEach(([b, state], i) => {
        timers.push(setTimeout(() => {
          if (state) api.show(state);
          else api.hide();
          if (i === PAYMENT.length - 1) {
            timers.push(setTimeout(() => { timers.length = 0; if (!o.clock) api.show(REST); }, 900));
          }
        }, B(b) * 1000));
      });
    };
    button.addEventListener('click', onClick);
    return withCleanup(api, () => {
      button.removeEventListener('click', onClick);
      for (const id of timers) clearTimeout(id);
      timers.length = 0;
    });
  },
  demo: islandDemo,
};
