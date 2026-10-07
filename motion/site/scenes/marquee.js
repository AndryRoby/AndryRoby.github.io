/* arling.sk/motion: the "marquee" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createMarquee } from '../../components/marquee/marquee.js';
import { demo as marqueeDemo } from '../../components/marquee/demo.js';
import { h, q, uid, field } from '../scene-kit.js';

// Tools and games from arling.sk, each a link to its page. Live, the band runs and both edges
// fade; the title and the Pause button share the row above it, so nothing covers the band. With
// reduced motion it stands and scrolls sideways.
const TOOLS = [
  ['Asistent', 'https://arling.sk/asistent/en/'],
  ['pain.001 generator', 'https://arling.sk/sepa-pain001-generator/'],
  ['Statement to Excel', 'https://arling.sk/camt053-to-excel/'],
  ['Feed Doctor', 'https://arling.sk/feed-doctor/en/'],
  ['Mail Doctor', 'https://arling.sk/mail-doctor/'],
  ['Field Notes', 'https://arling.sk/games/field-notes/'],
  ['Puzzle Village', 'https://arling.sk/games/village/'],
  ['E-invoice', 'https://arling.sk/efaktura/en/'],
];

export const scene = {
  title: 'Marquee',
  height: 170,
  build() {
    const id = uid('marquee-label');
    return [
      h('div', { class: 'mo-marquee-scene' },
        h('div', { class: 'am-marquee', role: 'group', 'aria-labelledby': id, 'data-speed': '40' },
          h('div', { class: 'am-marquee-header' },
            h('span', { class: 'am-marquee-title', id }, 'Tools and games by ARLing')),
          h('div', { class: 'am-marquee-viewport' },
            h('div', { class: 'am-marquee-track' },
              h('ul', { class: 'am-marquee-group' },
                ...TOOLS.map(([name, href]) => h('li', { class: 'am-marquee-item' }, h('a', { class: 'mo-chip', href }, name)))))))),
    ];
  },
  create: (stage, o = {}) => createMarquee({ root: q(stage, '.am-marquee'), clock: o.clock, reduced: o.reduced }),
  demo: marqueeDemo,
};
