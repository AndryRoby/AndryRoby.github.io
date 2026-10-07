/*
 * Helpers shared by the scenes of arling.sk/motion (site/scenes/<name>.js): building nodes, ids,
 * the clipboard and the fonts. Nothing here imports a component, so the page can load this file
 * alone and fetch each scene when it is needed.
 * MIT licence.
 */
export const REGISTRY = 'https://arling.sk/motion/r/';
export const installCommand = (name) => `npx shadcn@latest add ${REGISTRY}${name}.json`;

// ------------------------------------------------------------------ helpers

let n = 0;
export const uid = (p) => `mo-${p}-${++n}`;

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

export const q = (stage, sel) => {
  const el = stage.querySelector(sel);
  if (!el) throw new Error(`scene: ${sel} not found`);
  return el;
};

export function withCleanup(api, cleanup) {
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

export const field = (label, input) => h('label', { class: 'mo-field' }, h('span', {}, label), input);

// ------------------------------------------------------------------ one frame strip for "three outputs"

/** Tabs without panels, for the still frames that show seek(t). */
export function tabsStrip() {
  return h('div', { class: 'am-tabs' },
    h('div', { class: 'am-tabs-list', role: 'tablist', 'aria-label': 'Report period' },
      h('button', { role: 'tab', type: 'button' }, 'Week'),
      h('button', { role: 'tab', type: 'button' }, 'Month'),
      h('button', { role: 'tab', type: 'button' }, 'Year')));
}
