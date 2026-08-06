// Threshold screen. docs/SHELL.md #1. Audio is NOT touched here — the begin
// gesture (audio.enable() + drone.start()) is orchestrated by index.js so this
// screen stays decoupled from audio specifics.

import { el, confirmButton } from '../dom.js';

export function mountThreshold(root, { art, hasSave, onBegin, onBeginAnew }) {
  const screen = el('div', { class: 'screen screen-threshold' });
  let bg = art.makeCanvas(1, 1);
  bg.canvas.className = 'finale-canvas'; // full-bleed wood backdrop, shared styling
  screen.append(bg.canvas);

  const title = el('h1', { class: 'title carved-text-deep' }, 'VALHALLA');
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

  const content = el('div', { class: 'threshold-content' }, [title, subtitle, actions]);
  screen.append(content);
  root.append(screen);

  function resize() {
    const w = screen.clientWidth;
    const h = screen.clientHeight;
    const fresh = art.makeCanvas(w, h);
    fresh.canvas.className = 'finale-canvas';
    screen.replaceChild(fresh.canvas, bg.canvas);
    bg = fresh;
    art.paintWood(bg.ctx, bg.w, bg.h, 793);
  }
  window.addEventListener('resize', resize);
  resize();

  return function unmount() {
    window.removeEventListener('resize', resize);
    screen.remove();
  };
}
