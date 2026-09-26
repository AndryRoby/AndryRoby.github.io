// Demo for the video, 8 beats at 120 BPM (4 s): the cursor clicks the button on beats 1,
// 2 and 3 and each toast grows out of the click point and folds into the stack; on beat 4
// the cursor rests on the stack and it unfolds into a list, on beat 5 it leaves and the
// stack folds again; on beat 6 the toasts leave. Home before beat 8.
import { centerOf } from './toast.js';

export const MESSAGES = ['Draft saved', 'Invoice sent', 'Backup finished'];

export function demo(api, B) {
  api.keep = true;
  const from = api.trigger ? centerOf(api.trigger) : undefined;
  MESSAGES.forEach((m, i) => api.toast(m, { t: B(1 + i), from, duration: Infinity }));
  api.expand({ t: B(4) });
  api.collapse({ t: B(5) });
  api.dismissAll({ t: B(6) });
  const at = api.trigger || api.root;
  const rest = { el: at, dx: 0, dy: 48 };
  return {
    duration: B(8),
    cursor: [
      { t: 0, ...rest },
      { t: B(0.6), el: at },
      { t: B(1), el: at, click: true },
      { t: B(2), el: at, click: true },
      { t: B(3), el: at, click: true },
      { t: B(4), el: api.list, dy: -28 },
      { t: B(5), ...rest },
    ],
  };
}
