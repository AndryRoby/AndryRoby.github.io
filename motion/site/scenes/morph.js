/* arling.sk/motion: the "morph" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createMorph } from '../../components/morph/morph.js';
import { demo as morphDemo } from '../../components/morph/demo.js';
import { h, uid } from '../scene-kit.js';

// Three rows of our own catalogue (names, lines and pages as on arling.sk). Each card grows into
// its dialog; Open the page goes to the real page. The demo opens the first card.
const CATALOGUE = [
  {
    group: 'For online shops',
    name: 'Asistent',
    line: 'Sales assistant for online shops',
    text: 'Answers your customers from the shop\'s own product feed, in their language, with links to the products. Conversations are not stored.',
    href: 'https://arling.sk/asistent/en/',
  },
  {
    group: 'For businesses',
    name: 'pain.001 generator',
    line: 'Bulk transfer from a table',
    text: 'Turns a table of payments into one SEPA credit transfer file (pain.001) that your bank can import.',
    href: 'https://arling.sk/sepa-pain001-generator/',
  },
  {
    group: 'Games',
    name: 'Field Notes',
    line: 'A word search in a naturalist\'s notebook',
    text: 'Every theme has ten words to find, and every word has its own drawing, made in code.',
    href: 'https://arling.sk/games/field-notes/',
  },
];

export const scene = {
  title: 'Morph',
  height: 400,
  build() {
    const row = (p) => {
      const t = uid('morph-title');
      return h('li', {},
        h('button', { class: 'am-morph-card', type: 'button' },
          h('span', { class: 'mo-morph-kicker' }, p.group),
          h('span', { class: 'mo-morph-name' }, p.name),
          h('span', { class: 'mo-morph-line' }, p.line)),
        h('div', { class: 'am-morph-root', hidden: true },
          h('div', { class: 'am-morph-backdrop' }),
          h('div', { class: 'am-morph-panel', role: 'dialog', 'aria-labelledby': t },
            h('div', { class: 'am-morph-content' },
              h('div', { class: 'mo-morph-head' },
                h('p', { class: 'mo-morph-kicker' }, p.group),
                h('h3', { class: 'am-morph-title', id: t }, p.name)),
              h('p', { class: 'am-morph-description' }, p.text),
              h('div', { class: 'am-morph-footer' },
                h('button', { type: 'button', 'data-am-close': true }, 'Close'),
                h('a', { href: p.href, 'data-variant': 'primary' }, 'Open the page'))))));
    };
    return [h('ul', { class: 'mo-morph-list', 'aria-label': 'Part of our catalogue' }, ...CATALOGUE.map(row))];
  },
  create(stage, o = {}) {
    const cards = [...stage.querySelectorAll('.am-morph-card')];
    const roots = [...stage.querySelectorAll('.am-morph-root')];
    const list = cards.map((card, i) => createMorph({ trigger: card, root: roots[i], clock: o.clock, reduced: o.reduced }));
    let keep = false;
    return {
      morphs: list,
      primary: list[0],
      get keep() { return keep; },
      set keep(v) { keep = v; for (const m of list) m.keep = v; },
      seek(t) { for (const m of list) m.seek(t); },
      settled: (t) => list.every((m) => m.settled(t)),
      driver: {
        busy: () => false,
        kick() {},
        stop() { for (const m of list) m.driver.stop(); },
        get reduced() { return list[0].driver.reduced; },
      },
      destroy() { for (const m of list) m.destroy(); },
    };
  },
  demo(api, B) {
    api.keep = true;
    return morphDemo(api.primary, B);
  },
};
