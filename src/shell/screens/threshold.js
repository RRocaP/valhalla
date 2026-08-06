// Threshold screen. docs/SHELL.md #1. Audio is NOT touched here — the begin
// gesture (audio.enable() + drone.start()) is orchestrated by index.js so this
// screen stays decoupled from audio specifics.

import { el, confirmButton, carvedHeading } from '../dom.js';

// Canvas relief, re-rendered on resize: the title card is one of the three
// call-outs docs/ART.md requires at full carveText depth rather than the CSS
// text-shadow approximation.
function titleSize(w) {
  return Math.round(Math.max(30, Math.min(62, w * 0.052 + 14)));
}

export function mountThreshold(root, { art, hasSave, onBegin, onBeginAnew }) {
  const screen = el('div', { class: 'screen screen-threshold' });
  let bg = art.makeCanvas(1, 1);
  bg.canvas.className = 'finale-canvas'; // full-bleed wood backdrop, shared styling
  screen.append(bg.canvas);

  const makeTitle = (w) => carvedHeading('h1', {
    art, text: 'VALHALLA', size: titleSize(w), className: 'title',
    depth: 1, color: art.palette.gold, letterSpacing: Math.round(titleSize(w) * 0.28),
  });
  let title = makeTitle(320);
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
    art.paintWood(bg.ctx, bg.w, bg.h, 793, { shade: 0.2 });
    art.glow(bg.ctx, w / 2, h * 0.34, Math.max(w, h) * 0.45, art.palette.ember, 0.16);
    const freshTitle = makeTitle(w);
    content.replaceChild(freshTitle, title);
    title = freshTitle;
  }
  window.addEventListener('resize', resize);
  resize();

  return function unmount() {
    window.removeEventListener('resize', resize);
    screen.remove();
  };
}
