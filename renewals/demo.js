/* Public example only. No uploads, persistence or application API calls. */
(() => {
  'use strict';
  const root = document.getElementById('example');
  if (!root) return;
  const copy = JSON.parse(root.querySelector('[data-demo-copy]').textContent);
  const button = root.querySelector('[data-demo-action]');
  let step = 0;
  function render() {
    root.dataset.step = String(step);
    root.querySelector('[data-demo-status]').textContent = copy.statuses[step];
    root.querySelector('[data-demo-date]').textContent = step ? copy.date : '···';
    root.querySelector('[data-demo-file]').textContent = step ? copy.fileReceived : copy.fileMissing;
    root.querySelector('[data-demo-hint]').textContent = copy.hint[step];
    button.textContent = copy.action[step] + ' →';
    root.querySelectorAll('[data-demo-event]').forEach(el => { el.hidden = Number(el.dataset.demoEvent) > step; });
  }
  button.hidden = false;
  render();
  button.addEventListener('click', () => {
    step = (step + 1) % 3;
    render();
    if (window.umami?.track) window.umami.track('renewals-demo-step', {step: ['reset','submitted','approved'][step]});
  });
})();
