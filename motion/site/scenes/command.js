/* arling.sk/motion: the "command" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createCommand } from '../../components/command/command.js';
import { demo as commandDemo } from '../../components/command/demo.js';
import { h, q } from '../scene-kit.js';

export const scene = {
  title: 'Command menu',
  height: 340,
  align: 'top',
  build() {
    const input = h('input', { class: 'am-command-input', placeholder: 'Type a command or search', 'aria-label': 'Command', autocomplete: 'off' });
    input.value = '';
    const opt = (label, keywords) => h('div', { role: 'option', 'data-value': label.toLowerCase().replace(/\s+/g, '-'), 'data-keywords': keywords || null }, label);
    return [
      h('div', { class: 'am-command', 'data-demo-query': 'new' },
        input,
        h('div', { class: 'am-command-list', role: 'listbox', 'aria-label': 'Commands' },
          opt('New file'), opt('New folder'), opt('Open project'), opt('Search files'), opt('Toggle theme', 'dark light'), opt('Settings'))),
    ];
  },
  // Ctrl+K is left to the browser on this page (Firefox uses it for search)
  create: (stage, o = {}) => createCommand({ root: q(stage, '.am-command'), shortcut: false, clock: o.clock, reduced: o.reduced }),
  demo: commandDemo,
};
