/* arling.sk/motion: the "slider" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createSlider } from '../../components/slider/slider.js';
import { demo as sliderDemo, conversations } from '../../components/slider/demo.js';
import { h, q, uid } from '../scene-kit.js';

// The input of a price calculator: conversations per month, with the value always in the bubble.
export const scene = {
  title: 'Slider',
  height: 190,
  build() {
    const id = uid('slider-label');
    return [
      h('div', { class: 'mo-slider-scene' },
        h('span', { class: 'mo-slider-label', id }, 'Conversations per month'),
        h('div', { class: 'am-slider', 'aria-labelledby': id, 'data-min': '0', 'data-max': '2000', 'data-step': '50', 'data-value': '400' }),
        h('div', { class: 'mo-slider-scale', 'aria-hidden': 'true' }, h('span', {}, '0'), h('span', {}, '2,000'))),
    ];
  },
  create: (stage, o = {}) => createSlider({ root: q(stage, '.am-slider'), format: conversations, bubble: 'always', clock: o.clock, reduced: o.reduced }),
  demo: sliderDemo,
};
