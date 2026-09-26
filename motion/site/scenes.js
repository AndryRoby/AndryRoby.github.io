/*
 * Scenes for arling.sk/motion: the markup of every component on the page, how to create it
 * and its demo. The same scenes run the gallery (index.html) and the clean canvas for video
 * frames (demo.html), and the tests build them in the fake DOM (test/scenes.test.mjs).
 *
 * build() returns the nodes of a scene (made with document.createElement, no innerHTML);
 * create(stage, { clock, reduced }) wires the component on them and returns its api;
 * demo(api, B) is the component's own demo from components/<name>/demo.js.
 * The hero scene composes Dialog and Toast: a button grows into a card, Copy makes a toast.
 * MIT licence.
 */
import { createDialog } from '../components/dialog/dialog.js';
import { demo as dialogDemo } from '../components/dialog/demo.js';
import { createTabs } from '../components/tabs/tabs.js';
import { demo as tabsDemo } from '../components/tabs/demo.js';
import { createTooltip } from '../components/tooltip/tooltip.js';
import { demo as tooltipDemo } from '../components/tooltip/demo.js';
import { createMenu } from '../components/popover/popover.js';
import { demo as popoverDemo } from '../components/popover/demo.js';
import { createToaster, centerOf } from '../components/toast/toast.js';
import { demo as toastDemo, MESSAGES } from '../components/toast/demo.js';
import { createSwitch } from '../components/switch/switch.js';
import { demo as switchDemo } from '../components/switch/demo.js';
import { createAccordion } from '../components/accordion/accordion.js';
import { demo as accordionDemo } from '../components/accordion/demo.js';
import { createCommand } from '../components/command/command.js';
import { demo as commandDemo } from '../components/command/demo.js';
import { createDrawer } from '../components/drawer/drawer.js';
import { demo as drawerDemo } from '../components/drawer/demo.js';
import { createCarousel } from '../components/carousel/carousel.js';
import { demo as carouselDemo } from '../components/carousel/demo.js';
import { createOtp } from '../components/otp/otp.js';
import { demo as otpDemo } from '../components/otp/demo.js';
import { createDropzone } from '../components/dropzone/dropzone.js';
import { demo as dropzoneDemo } from '../components/dropzone/demo.js';

export const REGISTRY = 'https://arling.sk/motion/r/';
export const installCommand = (name) => `npx shadcn@latest add ${REGISTRY}${name}.json`;

// ------------------------------------------------------------------ helpers

let n = 0;
const uid = (p) => `mo-${p}-${++n}`;

/** h('button', { class: 'x', type: 'button' }, 'Label', child) */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : String(v));
    if (k === 'value') el.value = String(v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

const q = (stage, sel) => {
  const el = stage.querySelector(sel);
  if (!el) throw new Error(`scene: ${sel} not found`);
  return el;
};

function withCleanup(api, cleanup) {
  const destroy = api.destroy;
  api.destroy = () => { cleanup(); destroy.call(api); };
  return api;
}

/** Writes text to the clipboard; resolves true or false, never throws. */
export function copyText(text) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && globalThis.isSecureContext) {
      return navigator.clipboard.writeText(text).then(() => true, () => false);
    }
  } catch {
    /* fall through */
  }
  return Promise.resolve(false);
}

/**
 * Resolves once the fonts of el are loaded, never rejects. Demos measure the layout when they
 * are scheduled, so a scene must be built after this: with the fallback font every width is
 * different. document.fonts.ready alone is not enough, because a face nobody uses yet has not
 * started loading, so the weights the components use are requested first.
 */
export function fontsLoaded(el) {
  const fonts = typeof document !== 'undefined' ? document.fonts : null;
  if (!fonts || typeof fonts.load !== 'function') return Promise.resolve();
  let family = '';
  try {
    family = el && typeof getComputedStyle === 'function' ? getComputedStyle(el).fontFamily : '';
  } catch {
    family = '';
  }
  const loads = family ? [400, 500, 600, 700].map((wt) => fonts.load(`${wt} 16px ${family}`).catch(() => [])) : [];
  return Promise.all(loads).then(() => fonts.ready).then(() => {}, () => {});
}

/** Centre of an element inside a closed dialog: show the root for one measurement. */
function centerInHidden(el, root) {
  const was = root.hidden;
  root.hidden = false;
  const c = centerOf(el);
  root.hidden = was;
  return c;
}

const field = (label, input) => h('label', { class: 'mo-field' }, h('span', {}, label), input);

// ------------------------------------------------------------------ hero: button grows into a card

const HERO_CMD = installCommand('dialog');

const hero = {
  title: 'ARLing Motion',
  height: 400,
  build() {
    const t = uid('hero-title');
    return [
      h('button', { class: 'am-dialog-trigger mo-hero-trigger', type: 'button' }, 'Get 12 free components'),
      h('div', { class: 'am-dialog-root', hidden: true },
        h('div', { class: 'am-dialog-backdrop' }),
        h('div', { class: 'am-dialog-frame' },
          h('div', { class: 'am-dialog', role: 'dialog', 'aria-labelledby': t },
            h('div', { class: 'am-dialog-content' },
              h('p', { class: 'mo-card-kicker' }, 'ARLing Motion'),
              h('h3', { class: 'am-dialog-title', id: t }, '12 components, MIT licence'),
              h('p', { class: 'am-dialog-description' },
                'Each one is a real component for your product, with a 4 second demo timeline written into it.'),
              h('code', { class: 'mo-card-cmd' }, HERO_CMD),
              h('div', { class: 'am-dialog-footer' },
                h('button', { type: 'button', 'data-am-close': true }, 'Close'),
                h('button', { type: 'button', 'data-variant': 'primary', class: 'mo-hero-copy', 'data-umami-event': 'motion_copy', 'data-umami-event-item': 'hero' }, 'Copy command')))))),
      h('div', { class: 'am-toaster', role: 'region', 'aria-label': 'Notifications' }, h('ol', { class: 'am-toaster-list' })),
    ];
  },
  create(stage, o = {}) {
    const trigger = q(stage, '.mo-hero-trigger');
    const root = q(stage, '.am-dialog-root');
    const copy = q(stage, '.mo-hero-copy');
    const dialog = createDialog({ trigger, root, clock: o.clock, reduced: o.reduced });
    const toaster = createToaster({ root: q(stage, '.am-toaster'), hotkey: false, clock: o.clock, reduced: o.reduced });
    const onCopy = (e) => {
      const from = e.detail > 0 ? { x: e.clientX, y: e.clientY } : centerOf(copy);
      copyText(HERO_CMD).then((ok) => toaster.toast(ok ? 'Install command copied' : 'Copy is blocked here. Select the command and copy it.', { from }));
    };
    copy.addEventListener('click', onCopy);
    let keep = false;
    return {
      dialog,
      toaster,
      trigger,
      copy,
      root,
      get keep() { return keep; },
      set keep(v) { keep = v; dialog.keep = v; toaster.keep = v; },
      seek(t) { dialog.seek(t); toaster.seek(t); },
      settled: (t) => dialog.settled(t) && toaster.settled(t),
      driver: {
        busy: () => false,
        kick() {},
        stop() { dialog.driver.stop(); toaster.driver.stop(); },
        get reduced() { return dialog.driver.reduced; },
      },
      destroy() { copy.removeEventListener('click', onCopy); dialog.destroy(); toaster.destroy(); },
    };
  },
  // 8 beats at 120 BPM (4 s): the button grows into the card on beat 1, Copy on beat 2.5
  // grows a toast from the click, the toast leaves on beat 4.25 and the card folds back into
  // the button on beat 4.75. Everything is home before beat 8.
  demo(api, B) {
    api.keep = true;
    const { dialog, toaster, trigger, copy, root } = api;
    const close = dialog.content.querySelector('[data-am-close]');
    dialog.open({ t: B(1) });
    toaster.toast('Install command copied', { t: B(2.5), from: centerInHidden(copy, root), duration: Infinity });
    toaster.dismissAll({ t: B(4.25) });
    dialog.close({ t: B(4.75) });
    const rest = { el: trigger, dx: 84, dy: 46 };
    return {
      duration: B(8),
      cursor: [
        { t: 0, ...rest },
        { t: B(0.6), el: trigger },
        { t: B(1), el: trigger, click: true },
        { t: B(2.1), el: copy },
        { t: B(2.5), el: copy, click: true },
        { t: B(4.3), el: close },
        { t: B(4.75), el: close, click: true },
        { t: B(6), ...rest },
      ],
    };
  },
};

// ------------------------------------------------------------------ the twelve components

const dialog = {
  title: 'Dialog',
  height: 380,
  build() {
    const t = uid('dialog-title');
    return [
      h('button', { class: 'am-dialog-trigger', type: 'button' }, 'Edit profile'),
      h('div', { class: 'am-dialog-root', hidden: true },
        h('div', { class: 'am-dialog-backdrop' }),
        h('div', { class: 'am-dialog-frame' },
          h('div', { class: 'am-dialog', role: 'dialog', 'aria-labelledby': t },
            h('div', { class: 'am-dialog-content' },
              h('h3', { class: 'am-dialog-title', id: t }, 'Edit profile'),
              h('p', { class: 'am-dialog-description' }, 'A sample form. Nothing you type here is saved.'),
              field('Name', h('input', { class: 'mo-input', value: 'Ada', autocomplete: 'off' })),
              h('div', { class: 'am-dialog-footer' },
                h('button', { type: 'button', 'data-am-close': true }, 'Cancel'),
                h('button', { type: 'button', 'data-am-close': true, 'data-variant': 'primary' }, 'Save')))))),
    ];
  },
  create: (stage, o = {}) => createDialog({ trigger: q(stage, '.am-dialog-trigger'), root: q(stage, '.am-dialog-root'), clock: o.clock, reduced: o.reduced }),
  demo: dialogDemo,
};

const tabs = {
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

const tooltip = {
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

const popover = {
  title: 'Dropdown menu',
  height: 250,
  align: 'top',
  build() {
    const item = (label, disabled) => h('button', { role: 'menuitem', type: 'button', 'aria-disabled': disabled ? 'true' : null }, label);
    return [
      h('div', { class: 'am-popover-root' },
        h('button', { class: 'am-popover-trigger', type: 'button' }, 'Actions'),
        h('div', { class: 'am-menu', role: 'menu', hidden: true },
          item('Duplicate'), item('Rename'), item('Archive'), item('Delete', true))),
    ];
  },
  create: (stage, o = {}) => createMenu({ trigger: q(stage, '.am-popover-trigger'), menu: q(stage, '.am-menu'), clock: o.clock, reduced: o.reduced }),
  demo: popoverDemo,
};

const toast = {
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

const switchScene = {
  title: 'Switch',
  height: 130,
  build() {
    const id = uid('switch-label');
    return [
      h('div', { class: 'mo-switch-row' },
        h('span', { id }, 'Email me when a render is done'),
        h('button', { class: 'am-switch', type: 'button', role: 'switch', 'aria-checked': 'false', 'aria-labelledby': id })),
    ];
  },
  create: (stage, o = {}) => createSwitch({ el: q(stage, '.am-switch'), clock: o.clock, reduced: o.reduced }),
  demo: switchDemo,
};

const accordion = {
  title: 'Accordion',
  height: 330,
  align: 'top',
  build() {
    const item = (title, rows) => h('div', { class: 'am-accordion-item' },
      h('h3', { class: 'am-accordion-heading' }, h('button', { class: 'am-accordion-trigger', type: 'button' }, title)),
      h('div', { class: 'am-accordion-panel', hidden: true },
        h('div', { class: 'am-accordion-content' }, ...rows.map((r) => h('p', {}, r)))));
    return [
      h('div', { class: 'am-accordion' },
        item('What is free?', ['All twelve components and the core.', 'MIT licence, for any project.', 'No account, no key.']),
        item('Do I need React?', ['No. Each component is plain JavaScript.', 'The React files are thin wrappers.', 'Both use the same logic.']),
        item('How does the video work?', ['Every component has a 4 second demo.', 'seek(t) paints any moment of it.', 'The last frame equals the first.'])),
    ];
  },
  create: (stage, o = {}) => createAccordion({ root: q(stage, '.am-accordion'), clock: o.clock, reduced: o.reduced }),
  demo: accordionDemo,
};

const command = {
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

const drawer = {
  title: 'Drawer',
  height: 360,
  build() {
    const t = uid('drawer-title');
    return [
      h('button', { class: 'am-drawer-trigger', type: 'button' }, 'Edit goal'),
      h('div', { class: 'am-drawer', hidden: true },
        h('div', { class: 'am-drawer-overlay' }),
        h('div', { class: 'am-drawer-panel', role: 'dialog', 'aria-labelledby': t },
          h('div', { class: 'am-drawer-handle' }),
          h('div', { class: 'am-drawer-content' },
            h('h3', { class: 'am-drawer-title', id: t }, 'Daily goal'),
            h('p', { class: 'mo-drawer-text' }, 'Drag the sheet down, flick it, or press Escape.'),
            field('Minutes a day', h('input', { class: 'mo-input', inputmode: 'numeric', value: '20', autocomplete: 'off' })),
            h('div', { class: 'am-drawer-footer' }, h('button', { type: 'button', class: 'mo-btn', 'data-am-close': true }, 'Done'))))),
    ];
  },
  create: (stage, o = {}) => createDrawer({ trigger: q(stage, '.am-drawer-trigger'), root: q(stage, '.am-drawer'), clock: o.clock, reduced: o.reduced }),
  demo: drawerDemo,
};

const carousel = {
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
          h('button', { class: 'am-carousel-prev', type: 'button', 'aria-label': 'Previous slide' }),
          h('button', { class: 'am-carousel-next', type: 'button', 'aria-label': 'Next slide' }))),
    ];
  },
  create: (stage, o = {}) => createCarousel({ root: q(stage, '.am-carousel'), clock: o.clock, reduced: o.reduced }),
  demo: carouselDemo,
};

const otp = {
  title: 'One-time code',
  height: 170,
  build() {
    const input = h('input', { class: 'am-otp-input', 'aria-label': 'Verification code', maxlength: '6' });
    input.value = '';
    return [
      h('div', { class: 'mo-otp-wrap' },
        h('div', { class: 'am-otp', 'data-demo-code': '428193' }, input, h('div', { class: 'am-otp-slots' })),
        h('p', { class: 'mo-hint' }, 'Any six digits pass here; 000000 shows the error state.')),
    ];
  },
  create: (stage, o = {}) => createOtp({ root: q(stage, '.am-otp'), onComplete: (code) => code !== '000000', clock: o.clock, reduced: o.reduced }),
  demo: otpDemo,
};

const dropzone = {
  title: 'Dropzone',
  height: 270,
  align: 'top',
  build() {
    const id = uid('files');
    return [
      h('div', { class: 'am-dropzone' },
        h('input', { type: 'file', class: 'am-dropzone-input', id, multiple: true }),
        h('label', { class: 'am-dropzone-prompt', for: id }, 'Drop files here or ', h('u', {}, 'browse'))),
    ];
  },
  create: (stage, o = {}) => createDropzone({ root: q(stage, '.am-dropzone'), clock: o.clock, reduced: o.reduced }),
  demo: dropzoneDemo,
};

/** Every scene by name; GALLERY is the order of the component rows on the page. */
export const SCENES = { hero, dialog, tabs, tooltip, popover, toast, switch: switchScene, accordion, command, drawer, carousel, otp, dropzone };
export const GALLERY = ['dialog', 'tabs', 'tooltip', 'popover', 'toast', 'switch', 'accordion', 'command', 'drawer', 'carousel', 'otp', 'dropzone'];

// ------------------------------------------------------------------ one frame strip for "three outputs"

/** Tabs without panels, for the still frames that show seek(t). */
export function tabsStrip() {
  return h('div', { class: 'am-tabs' },
    h('div', { class: 'am-tabs-list', role: 'tablist', 'aria-label': 'Report period' },
      h('button', { role: 'tab', type: 'button' }, 'Week'),
      h('button', { role: 'tab', type: 'button' }, 'Month'),
      h('button', { role: 'tab', type: 'button' }, 'Year')));
}
