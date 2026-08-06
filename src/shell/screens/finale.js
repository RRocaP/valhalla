// Finale. docs/SHELL.md #4, docs/JARLS.md "The treasures" (two tap/Enter
// -advanced reveals, then a final tableau).

import { el, clear, confirmButton, playBeat, waitForAdvance } from '../dom.js';
import { portraitImage } from '../portraits.js';

const ALANO_EPITHET = 'the Troll-Burster · Friend of the Children';
const ALANO_LINE = 'Praised in every fjord for refusing the trendy Viking sport of impaling toddlers on spears.';

// Hand-drawn (shield + crossed axes + question rune), same chisel-stroke
// grammar as art.drawRune. art.portrait()/treasureFrame() document no
// "missing image" mode, so shell owns this fallback, same approach as the
// portrait placeholder.
function drawTreasurePlaceholder(ctx, p, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const s = Math.min(w, h) * 0.28;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.6, cy - s * 0.7);
  ctx.lineTo(cx + s * 0.6, cy - s * 0.7);
  ctx.lineTo(cx + s * 0.6, cy + s * 0.1);
  ctx.quadraticCurveTo(cx + s * 0.6, cy + s * 0.9, cx, cy + s * 1.1);
  ctx.quadraticCurveTo(cx - s * 0.6, cy + s * 0.9, cx - s * 0.6, cy + s * 0.1);
  ctx.closePath();
  ctx.fillStyle = p.oakDeep;
  ctx.fill();
  ctx.lineWidth = Math.max(2, s * 0.05);
  ctx.strokeStyle = p.gold;
  ctx.stroke();
  const axe = (flip) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(flip ? Math.PI / 4 : -Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.1);
    ctx.lineTo(0, s * 0.6);
    ctx.lineWidth = Math.max(3, s * 0.07);
    ctx.strokeStyle = p.oakLight;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -s * 1.1);
    ctx.quadraticCurveTo(-s * 0.55, -s * 0.9, -s * 0.05, -s * 0.58);
    ctx.closePath();
    ctx.fillStyle = p.boneDim;
    ctx.fill();
    ctx.strokeStyle = p.tar;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  };
  axe(false);
  axe(true);
  ctx.save();
  ctx.translate(cx, cy - s * 0.05);
  const rs = s * 0.5;
  const strokeTwice = (path, w1) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath(); path(); ctx.strokeStyle = p.tar; ctx.lineWidth = w1; ctx.stroke();
    ctx.beginPath(); path(); ctx.strokeStyle = p.boneDim; ctx.lineWidth = Math.max(1, w1 - 2); ctx.stroke();
  };
  strokeTwice(() => {
    ctx.moveTo(0, -rs * 0.9);
    ctx.lineTo(0, rs * 0.5);
    ctx.moveTo(0, -rs * 0.9);
    ctx.quadraticCurveTo(rs * 0.55, -rs * 0.85, rs * 0.1, -rs * 0.15);
  }, rs * 0.22);
  ctx.beginPath();
  ctx.arc(0, rs * 0.75, s * 0.035, 0, Math.PI * 2);
  ctx.fillStyle = p.boneDim;
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

export function mountFinale(root, {
  art, audio, imageCache, reducedMotion, animate,
  onReset, onReturnToLid, onCredits,
}) {
  const p = art.palette;
  const screen = el('div', { class: 'screen screen-finale' });
  let bg = art.makeCanvas(1, 1);
  bg.canvas.className = 'finale-canvas';
  screen.append(bg.canvas);

  const reveal = el('div', { class: 'finale-reveal', tabindex: '-1' });
  const raise = el('button', { type: 'button', class: 'btn-carved', onClick: () => { audio.ui('confirm'); onCredits(); } }, 'Raise the horns');
  const resetBtn = confirmButton({ label: 'Seal the chest again', confirmLabel: 'Yes — seal it', className: 'btn-quiet', onConfirm: onReset });
  const ret = el('button', { type: 'button', class: 'btn-quiet', onClick: onReturnToLid }, 'Return to the chest');
  const colophon = el('p', { class: 'finale-colophon carved-text' }, 'carved by machine hands · MMXXVI');
  const footer = el('div', { class: 'finale-footer', style: 'display:none' }, [raise, resetBtn, ret, colophon]);
  const chrome = el('div', { class: 'finale-chrome' }, [reveal, footer]);
  screen.append(chrome);
  root.append(screen);

  let phase = 'intro';
  let introT = 0;
  let cancelAdvance = null;
  let cancelBeat = null;

  function drawTebiInto(c) {
    art.treasureFrame(c.ctx, c.w, c.h, performance.now());
    const entry = imageCache && imageCache.tebi;
    if (entry && entry.ready && entry.img) {
      const iw = c.w * 0.7;
      const ih = c.h * 0.7;
      c.ctx.drawImage(entry.img, c.w / 2 - iw / 2, c.h / 2 - ih / 2, iw, ih);
    } else {
      drawTreasurePlaceholder(c.ctx, p, c.w, c.h);
    }
  }

  function drawAlanoInto(c) {
    const img = imageCache ? portraitImage(imageCache, 'alano') : null;
    if (typeof art.portrait === 'function' && img) art.portrait(c.ctx, img, 0, 0, c.w, c.h, {});
    else drawTreasurePlaceholder(c.ctx, p, c.w, c.h);
  }

  function showTebi() {
    clear(reveal);
    const c = art.makeCanvas(280, 320);
    drawTebiInto(c);
    reveal.append(
      c.canvas,
      el('h2', { class: 'finale-title carved-text' }, 'TEBI THE OSTEOPATH · Snake-in-the-Eye'),
      el('p', { class: 'finale-sub' }, 'The hoard of the fifteen locks.'),
      el('p', { class: 'continue-hint' }, 'tap or press Enter to continue'),
    );
    reveal.focus();
    cancelAdvance = waitForAdvance(reveal, () => { audio.ui('slide'); showAlano(); });
  }

  function showAlano() {
    clear(reveal);
    const c = art.makeCanvas(240, 280);
    drawAlanoInto(c);
    reveal.append(
      c.canvas,
      el('h2', { class: 'finale-title carved-text' }, 'JARL ÅLANØ'),
      el('p', { class: 'finale-sub' }, `from under the false bottom — ${ALANO_EPITHET}`),
      el('p', { class: 'finale-epithet' }, `"${ALANO_LINE}"`),
      el('p', { class: 'continue-hint' }, 'tap or press Enter to continue'),
    );
    reveal.focus();
    cancelAdvance = waitForAdvance(reveal, () => { audio.ui('slide'); showTableau(); });
  }

  function showTableau() {
    clear(reveal);
    const c1 = art.makeCanvas(150, 172);
    drawTebiInto(c1);
    const c2 = art.makeCanvas(150, 172);
    drawAlanoInto(c2);
    reveal.append(el('div', { class: 'finale-tableau' }, [
      el('figure', { class: 'finale-tableau-item' }, [c1.canvas, el('figcaption', {}, 'TEBI THE OSTEOPATH · Snake-in-the-Eye')]),
      el('figure', { class: 'finale-tableau-item' }, [c2.canvas, el('figcaption', {}, 'JARL ÅLANØ')]),
    ]));
    footer.style.display = '';
  }

  function paintBackdrop() {
    art.paintWood(bg.ctx, bg.w, bg.h, 793);
    art.glow(bg.ctx, bg.w / 2, bg.h * 0.38, Math.max(bg.w, bg.h) * 0.4, p.goldBright, 0.32);
  }

  function paintIntro(t) {
    art.paintWood(bg.ctx, bg.w, bg.h, 793);
    art.glow(bg.ctx, bg.w / 2, bg.h / 2, Math.max(bg.w, bg.h) * 0.5 * t, p.goldBright, Math.min(1, t * 1.4));
    const lidH = bg.h * 0.55;
    bg.ctx.save();
    bg.ctx.translate(bg.w / 2, bg.h - lidH);
    bg.ctx.rotate(-(Math.PI / 2.1) * t);
    bg.ctx.fillStyle = p.oakDeep;
    bg.ctx.fillRect(-bg.w / 2, -2, bg.w, lidH);
    bg.ctx.strokeStyle = p.gold;
    bg.ctx.lineWidth = 3;
    bg.ctx.strokeRect(-bg.w / 2, -2, bg.w, lidH);
    bg.ctx.restore();
  }

  function resize() {
    const w = screen.clientWidth;
    const h = screen.clientHeight;
    const fresh = art.makeCanvas(w, h);
    fresh.canvas.className = 'finale-canvas';
    screen.replaceChild(fresh.canvas, bg.canvas);
    bg = fresh;
    if (phase === 'intro') paintIntro(introT);
    else paintBackdrop();
  }

  function beginReveals() {
    phase = 'tebi';
    paintBackdrop();
    chrome.style.display = '';
    audio.motif('chest');
    audio.drone.intensity(1);
    showTebi();
  }

  window.addEventListener('resize', resize);
  resize();

  if (animate && !reducedMotion) {
    const skipHint = el('p', { class: 'skip-hint' }, 'tap to skip');
    screen.append(skipHint);
    cancelBeat = playBeat({
      el: screen, duration: 2600, reducedMotion: false,
      render(t) { introT = t; paintIntro(t); },
      onDone: () => { cancelBeat = null; skipHint.remove(); beginReveals(); },
    });
  } else {
    beginReveals();
  }

  return function unmount() {
    window.removeEventListener('resize', resize);
    if (cancelBeat) cancelBeat();
    if (cancelAdvance) cancelAdvance();
    screen.remove();
  };
}
