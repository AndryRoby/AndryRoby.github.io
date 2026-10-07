/* arling.sk/motion: the "tabs" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createTabs } from '../../components/tabs/tabs.js';
import { demo as tabsDemo } from '../../components/tabs/demo.js';
import { h, q } from '../scene-kit.js';

export const scene = {
  title: 'Tabs',
  height: 220,
  build() {
    const panel = (title, line) => h('div', { role: 'tabpanel' }, h('p', { class: 'mo-panel-title' }, title), h('p', { class: 'mo-panel-line' }, line));
    return [
      h('div', { class: 'am-tabs' },
        h('div', { class: 'am-tabs-list', role: 'tablist', 'aria-label': 'Report period' },
          h('button', { role: 'tab', type: 'button' }, 'Week'),
          h('button', { role: 'tab', type: 'button' }, 'Month'),
          h('button', { role: 'tab', type: 'button' }, 'Year')),
        h('div', { class: 'am-tabs-panels' },
          panel('This week', 'Sample numbers: 4 releases, 2 open reviews.'),
          panel('This month', 'Sample numbers: 17 releases, 5 open reviews.'),
          panel('This year', 'Sample numbers: 190 releases, 9 open reviews.'))),
    ];
  },
  create: (stage, o = {}) => createTabs({ root: q(stage, '.am-tabs'), clock: o.clock, reduced: o.reduced }),
  demo: tabsDemo,
};
