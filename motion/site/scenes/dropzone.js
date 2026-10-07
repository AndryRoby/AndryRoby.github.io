/* arling.sk/motion: the "dropzone" scene. One module per scene, so the gallery can load a scene
   only when its row comes near the viewport (site/gallery.js). All scenes together: ../scenes.js.
   MIT licence. */
import { createDropzone } from '../../components/dropzone/dropzone.js';
import { demo as dropzoneDemo } from '../../components/dropzone/demo.js';
import { h, q, uid } from '../scene-kit.js';

export const scene = {
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
