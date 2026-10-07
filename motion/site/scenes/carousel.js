/* arling.sk/motion: the "carousel" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createCarousel } from '../../components/carousel/carousel.js';
import { demo as carouselDemo } from '../../components/carousel/demo.js';
import { h, q } from '../scene-kit.js';

export const scene = {
  title: 'Carousel',
  height: 290,
  build() {
    const slide = (k, title, line) => h('div', { class: 'am-carousel-slide' },
      h('span', { class: 'mo-slide-n' }, k), h('b', { class: 'mo-slide-title' }, title), h('span', { class: 'mo-slide-line' }, line));
    return [
      h('div', { class: 'am-carousel', role: 'region', 'aria-roledescription': 'carousel', 'aria-label': 'Components' },
        h('div', { class: 'am-carousel-viewport' },
          h('div', { class: 'am-carousel-track' },
            slide('01', 'Dialog', 'Grows out of its button.'),
            slide('02', 'Tabs', 'The indicator stretches, then catches up.'),
            slide('03', 'Toast', 'Starts where you clicked.'),
            slide('04', 'Drawer', 'Keeps the speed of your flick.'),
            slide('05', 'Switch', 'New colour grows as a circle.'))),
        h('div', { class: 'am-carousel-controls' },
          h('div', { class: 'am-carousel-dots' }),
          h('button', { class: 'am-carousel-prev', type: 'button', 'aria-label': 'Previous slide' }),
          h('button', { class: 'am-carousel-next', type: 'button', 'aria-label': 'Next slide' }))),
    ];
  },
  // At rest on the second slide, so both neighbours peek out under the fade and both buttons
  // work. o.handoff: the demo's state when the gallery hands the stage over to you, so the
  // strip glides on from where the demo was instead of jumping back.
  create: (stage, o = {}) => createCarousel({ root: q(stage, '.am-carousel'), index: 1, from: o.handoff, clock: o.clock, reduced: o.reduced }),
  demo: carouselDemo,
};
