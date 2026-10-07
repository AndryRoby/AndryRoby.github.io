/* arling.sk/motion: the "steps" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createSteps } from '../../components/steps/steps.js';
import { demo as stepsDemo } from '../../components/steps/demo.js';
import { h, q, withCleanup } from '../scene-kit.js';

// The setup of Asistent, our sales assistant for online shops, in its three steps as on its page
// (feed, check, one script tag). Next step moves on; after the last one it starts over. Nothing
// is set up here.
const SETUP = [
  ['Product feed', 'Your feed URL'],
  ['Check products', 'See what it read'],
  ['Paste the code', 'One script tag'],
];

export const scene = {
  title: 'Steps',
  height: 220,
  build() {
    return [
      h('div', { class: 'mo-steps-scene' },
        h('div', { class: 'am-steps' },
          h('ol', { class: 'am-steps-list', 'aria-label': 'Asistent setup' },
            ...SETUP.map(([title, detail]) => h('li', {},
              h('span', { class: 'am-steps-title' }, title),
              h('span', { class: 'am-steps-detail' }, detail))))),
        h('button', { class: 'mo-btn mo-steps-next', type: 'button' })),
    ];
  },
  create(stage, o = {}) {
    const button = q(stage, '.mo-steps-next');
    // Live stage only (no clock given): rest on the second step, so the row shows a finished step.
    // Demo and video builds pass a clock and start on the first step, as the demo expects.
    const api = createSteps({ root: q(stage, '.am-steps'), step: o.clock ? 0 : 1, clock: o.clock, reduced: o.reduced });
    // the label is a function of time too, so a video frame shows the right one
    const paintLabel = (t) => {
      const text = api.step(t) >= api.count ? 'Start over' : 'Next step';
      if (button.textContent !== text) button.textContent = text;
    };
    const onClick = () => {
      api.setStep(api.step() >= api.count ? 0 : api.step() + 1);
      paintLabel();
    };
    button.addEventListener('click', onClick);
    const seek = api.seek;
    api.seek = (t) => { seek(t); paintLabel(t); };
    api.trigger = button;
    paintLabel();
    return withCleanup(api, () => button.removeEventListener('click', onClick));
  },
  demo: stepsDemo,
};
