/* Fixed sample only. Analytics contain an item number/type, never personal data. */
const puzzle = document.getElementById('puzzle');
const caption = document.getElementById('caption');
const solution = document.getElementById('solution');
const svgLink = document.getElementById('svg-download');
const jsonLink = document.getElementById('json-download');
let vyber = 1, odpoved = false;
const track = (event, data) => {
  if (typeof window.umami?.track === 'function') window.umami.track(event, { pack: 'slitherlink-pattern-01', ...data });
};
function zobraz() {
  const id = 'slitherlink-pattern-01-' + String(vyber).padStart(3, '0');
  const src = './sample/v2/' + id + (odpoved ? '-solution.svg' : '-puzzle.svg');
  puzzle.src = src;
  puzzle.alt = 'Slitherlink Pattern 01, ' + (odpoved ? 'solution' : 'puzzle') + ' ' + String(vyber).padStart(3, '0') + '. A seven by seven grid ' + (odpoved ? 'with its single closed loop.' : 'of dots and numbered cells.');
  caption.textContent = (odpoved ? 'Solution ' : 'Puzzle ') + String(vyber).padStart(3, '0') + ' of 025 · Pattern level';
  solution.textContent = odpoved ? 'Hide solution' : 'Show solution';
  solution.setAttribute('aria-pressed', String(odpoved));
  svgLink.href = src; jsonLink.href = './sample/v2/' + id + '.json';
  for (const button of document.querySelectorAll('[data-sample]')) button.setAttribute('aria-pressed', String(Number(button.dataset.sample) === vyber));
}
for (const button of document.querySelectorAll('[data-sample]')) button.addEventListener('click', () => {
  vyber = Number(button.dataset.sample); odpoved = false; zobraz(); track('publisher_sample', { item: vyber });
});
solution.addEventListener('click', () => {
  odpoved = !odpoved; zobraz(); track('publisher_solution', { item: vyber, visible: odpoved });
});
for (const link of document.querySelectorAll('[data-download]')) link.addEventListener('click', () => {
  track('publisher_download', { format: link.dataset.download, item: ['svg', 'json'].includes(link.dataset.download) ? vyber : 'sample', solution: link.dataset.download === 'svg' && odpoved });
});
