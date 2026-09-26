# ARLing Motion

Motion components that also render as video.

Each component is a real UI component for your product that follows the WAI-ARIA pattern for keyboard and screen readers (roles, states, focus, reduced motion), with a short demo timeline written into it. The same file runs live on your site and carries a demo timeline that a headless browser can render frame by frame, so it can become a clip for Shorts, Reels or a launch post. This repository has no render script; one is planned for ARLing Motion Pro, which is not on sale yet.

Status: early. The core (`src/core.js`) and twelve components are built and tested in Node with a simulated DOM; checks in real browsers and with screen readers are in progress. Site: https://arling.sk/motion/

## Install

```
npx shadcn@latest add https://arling.sk/motion/r/tabs.json
```

Any of: dialog, tabs, tooltip, popover, toast, switch, accordion, command, drawer, carousel, otp, dropzone. The registry index is `r/registry.json`; `node build-registry.mjs` rebuilds `r/`, `springs.css` and `site/components.css` from the sources (`--check` fails when they are stale). Without React, load `components/<name>/<name>.css` and import `create<Name>` from `components/<name>/<name>.js`.

## Site and demo canvas

`index.html` is the gallery (one live demo at a time, reduced motion respected). `demo.html?c=<name>&t=<seconds>&w=<px>&h=<px>&cursor=1` paints one component at one moment of its demo on a clean canvas for video frames; `window.__motion.seek(t)` repaints it.

## Why springs as pure functions of time

A value is a pure function of time. A track keeps a list of target changes, and its value at time `t` is the sum of one closed-form spring per change (no numerical integration, no frame-to-frame state). That gives two things at once:

- **Live:** `driver()` draws with `requestAnimationFrame` only while something moves, then stops. Interrupting a motion is free: a new target simply adds one more spring from where the value is, with its velocity.
- **Video:** `seek(t)` paints any moment exactly, so a headless browser can capture every frame, and the DOM at the end of a demo equals the DOM at its start (tested), so the clip loops.

The presets are the ones from our own product videos. Every preset overshoots by 3 % at most (tested).

## Core API

There is no npm package. Import the core from this repository (`src/core.js`), or, after `npx shadcn@latest add https://arling.sk/motion/r/core.json`, from `@/lib/arling-motion`:

```js
import { track, indicator, presence, stagger, applyPresence, driver, PRESETS, cssEasing } from '@/lib/arling-motion';

const x = track(0, PRESETS.snappy);
const d = driver((t, { reduced }) => {
  el.style.transform = `translateX(${reduced ? x.target(t) : x.at(t)}px)`;
});
d.busy = (t) => !x.settled(t);

button.onclick = () => { x.to(d.now(), 240); d.kick(); };
```

- `track(initial, spring)`: `to(t, target)`, `drag(t0, t1, fn)`, `at(t)`, `target(t)`, `vel(t)`, `settled(t)`, `compact(t)`
- `indicator(left, right)`: tab indicator whose leading edge moves on a faster spring, so it stretches and the trailing edge catches up
- `presence(visible)`: entrance with blur, rise and slight scale; `still(t)` for reduced motion
- `stagger(presences, t, step)`, `applyPresence(el, state)`
- `driver(draw)`: live rendering only while busy; with `prefers-reduced-motion` it draws each change once
- `cssEasing(spring, points = 13)`: the spring sampled into a CSS `linear()` easing and duration, for plain CSS transitions. With the default 13 stops it is off by up to about 6 % of the distance near the start; `springs.css` uses 60 stops, which a test keeps under 0.6 %
- `beats(bpm)`: demo timelines in beats (120 BPM: one beat is 0.5 s)

## Tests

```
npm test
```

## Licence

MIT (this repository, free components). ARLing Motion Pro (video kit, blocks, music generator) is a separate paid licence.
