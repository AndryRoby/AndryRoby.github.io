/* arling.sk/motion: the "tooltip" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createTooltip } from '../../components/tooltip/tooltip.js';
import { demo as tooltipDemo } from '../../components/tooltip/demo.js';
import { h, q } from '../scene-kit.js';

export const scene = {
  title: 'Tooltip',
  height: 150,
  build() {
    const b = (label, tip, glyph, cls) => h('button', { type: 'button', 'aria-label': label, 'data-tooltip': tip, class: cls }, glyph);
    return [
      h('div', { class: 'am-tooltip-group mo-toolbar' },
        b('Bold', 'Bold, Ctrl+B', 'B', 'mo-glyph-b'),
        b('Italic', 'Italic, Ctrl+I', 'I', 'mo-glyph-i'),
        b('Underline', 'Underline, Ctrl+U', 'U', 'mo-glyph-u')),
    ];
  },
  create: (stage, o = {}) => createTooltip({ root: q(stage, '.am-tooltip-group'), clock: o.clock, reduced: o.reduced }),
  demo: tooltipDemo,
};
