/*
 * Scenes for arling.sk/motion: the markup of every component on the page, how to create it
 * and its demo. The same scenes run the gallery (index.html) and the clean canvas for video
 * frames (demo.html), and the tests build them in the fake DOM (test/scenes.test.mjs).
 *
 * build() returns the nodes of a scene (made with document.createElement, no innerHTML);
 * create(stage, { clock, reduced }) wires the component on them and returns its api;
 * demo(api, B) is the component's own demo from components/<name>/demo.js.
 * The hero scene composes Dialog and Toast: a button grows into a card, Copy makes a toast.
 *
 * Each scene lives in its own module, site/scenes/<name>.js, and the helpers in site/scene-kit.js.
 * This file gathers all of them for demo.html and the tests. The gallery does not import it:
 * it loads one scene at a time (LOAD in site/gallery.js), when its row comes near the viewport.
 * MIT licence.
 */
import { scene as hero } from './scenes/hero.js';
import { scene as dialog } from './scenes/dialog.js';
import { scene as tabs } from './scenes/tabs.js';
import { scene as tooltip } from './scenes/tooltip.js';
import { scene as popover } from './scenes/popover.js';
import { scene as toast } from './scenes/toast.js';
import { scene as switchScene } from './scenes/switch.js';
import { scene as numberScene } from './scenes/number.js';
import { scene as islandScene } from './scenes/island.js';
import { scene as segmentedScene } from './scenes/segmented.js';
import { scene as sliderScene } from './scenes/slider.js';
import { scene as morphScene } from './scenes/morph.js';
import { scene as marqueeScene } from './scenes/marquee.js';
import { scene as sortableScene } from './scenes/sortable.js';
import { scene as stepsScene } from './scenes/steps.js';
import { scene as accordion } from './scenes/accordion.js';
import { scene as command } from './scenes/command.js';
import { scene as drawer } from './scenes/drawer.js';
import { scene as carousel } from './scenes/carousel.js';
import { scene as otp } from './scenes/otp.js';
import { scene as dropzone } from './scenes/dropzone.js';

export { REGISTRY, installCommand, h, copyText, fontsLoaded, tabsStrip } from './scene-kit.js';

/** Every scene by name; GALLERY is the order of the component rows on the page. */
export const SCENES = { hero, dialog, tabs, tooltip, popover, toast, switch: switchScene, number: numberScene, island: islandScene, segmented: segmentedScene, slider: sliderScene, morph: morphScene, marquee: marqueeScene, sortable: sortableScene, steps: stepsScene, accordion, command, drawer, carousel, otp, dropzone };
export const GALLERY = ['dialog', 'tabs', 'tooltip', 'popover', 'toast', 'switch', 'accordion', 'command', 'drawer', 'carousel', 'otp', 'dropzone', 'number', 'island', 'segmented', 'slider', 'morph', 'marquee', 'sortable', 'steps'];
