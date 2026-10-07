/* arling.sk/motion: the "hero" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createDialog } from '../../components/dialog/dialog.js';
import { createToaster, centerOf } from '../../components/toast/toast.js';
import { h, q, uid, copyText, installCommand } from '../scene-kit.js';

/** Centre of an element inside a closed dialog: show the root for one measurement. */
function centerInHidden(el, root) {
  const was = root.hidden;
  root.hidden = false;
  const c = centerOf(el);
  root.hidden = was;
  return c;
}

const HERO_CMD = installCommand('dialog');

export const scene = {
  title: 'ARLing Motion',
  height: 400,
  build() {
    const t = uid('hero-title');
    return [
      h('button', { class: 'am-dialog-trigger mo-hero-trigger', type: 'button' }, 'Get 20 free components'),
      h('div', { class: 'am-dialog-root', hidden: true },
        h('div', { class: 'am-dialog-backdrop' }),
        h('div', { class: 'am-dialog-frame' },
          h('div', { class: 'am-dialog', role: 'dialog', 'aria-labelledby': t },
            h('div', { class: 'am-dialog-content' },
              h('p', { class: 'mo-card-kicker' }, 'ARLing Motion'),
              h('h3', { class: 'am-dialog-title', id: t }, '20 components, MIT licence'),
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
