// Threshold screen. docs/SHELL.md #1. Audio is NOT touched here — the begin
// gesture (audio.enable() + drone.start()) is orchestrated by index.js so this
// screen stays decoupled from audio specifics.

import { el, confirmButton } from '../dom.js';

export function mountThreshold(root, { hasSave, onBegin, onBeginAnew }) {
  const title = el('h1', { class: 'title' }, 'OATHWOOD');
  const subtitle = el('p', { class: 'subtitle' }, 'Fifteen Locks of the Northmen');

  const actions = el('div', { class: 'threshold-actions' });
  if (hasSave) {
    const cont = el('button', { type: 'button', class: 'btn-carved', onClick: onBegin }, 'Continue');
    const anew = confirmButton({
      label: 'Begin anew',
      confirmLabel: 'Yes — begin anew',
      className: 'btn-quiet',
      onConfirm: onBeginAnew,
    });
    actions.append(cont, anew);
  } else {
    const begin = el('button', { type: 'button', class: 'btn-carved', onClick: onBegin }, 'Lay hands on the chest');
    actions.append(begin);
  }

  const wrap = el('div', { class: 'screen screen-threshold' }, [title, subtitle, actions]);
  root.append(wrap);

  return function unmount() {
    wrap.remove();
  };
}
