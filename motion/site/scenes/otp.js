/* arling.sk/motion: the "otp" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createOtp } from '../../components/otp/otp.js';
import { demo as otpDemo } from '../../components/otp/demo.js';
import { h, q } from '../scene-kit.js';

export const scene = {
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
