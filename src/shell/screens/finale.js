// Finale. docs/SHELL.md #4, docs/JARLS.md "The treasures" (two tap/Enter
// -advanced reveals, then a final tableau).
//
// LOOP5 composition ruling: the reveals are the game's payoff and play in ONE
// frame language — the carved arch with the gold groove rim that every jarl
// dare, yield and credit already wears (art.portrait). The house dims under
// them (fixed vignette, as the lockroom ceremonies do) and the advance cue is
// set in the display voice, quiet but unmistakable.

import { el, clear, confirmButton, playBeat, waitForAdvance } from '../dom.js';
import { portraitImage } from '../portraits.js';

// Hand-drawn (shield + crossed axes + question rune), same chisel-stroke
// grammar as art.drawRune. art.portrait() documents no "missing image" mode,
// so shell owns this fallback, same approach as the portrait placeholder.
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
  art, audio, imageCache, reducedMotion, animate, tr,
  onReset, onReturnToLid, onCredits,
}) {
  const p = art.palette;
  const screen = el('div', { class: 'screen screen-finale' });

  // Presentation-only styles for this screen (lockroom's roomStyle pattern):
  // the house vignette under the reveals, arch drop shadow, breathing room,
  // and the advance cue in the display voice. `#app` prefix outranks style.js
  // at equal source order without touching shell-owned style.js.
  const roomStyle = el('style');
  roomStyle.textContent = `
  #app .finale-vignette{position:fixed;inset:0;pointer-events:none;
    background:radial-gradient(120% 90% at 50% 36%,rgba(12,9,6,0) 0,rgba(12,9,6,.34) 54%,rgba(12,9,6,.8) 100%)}
  #app .finale-reveal{gap:12px;padding:24px 16px}
  #app .finale-reveal canvas{filter:drop-shadow(0 7px 20px rgba(12,9,6,.65))}
  #app .finale-title{margin-top:6px}
  #app .finale-sub{max-width:46ch}
  #app .finale-reveal .continue-hint{margin-top:14px;color:var(--gold);opacity:.85;
    font-family:var(--font-display);font-variant-caps:all-small-caps;letter-spacing:.15em;
    animation:finale-hint 2.8s ease-in-out infinite}
  @keyframes finale-hint{0%,100%{opacity:.55}50%{opacity:.95}}
  #app .finale-tableau{gap:clamp(24px,6vw,56px);margin-top:10px;align-items:end}
  #app .finale-tableau-item figcaption{font-family:var(--font-display);
    font-variant-caps:all-small-caps;letter-spacing:.12em;font-size:.85rem}
  @media (prefers-reduced-motion: reduce){#app .finale-reveal .continue-hint{animation:none}}
  #app.reduced-motion .finale-reveal .continue-hint{animation:none}`;
  screen.append(roomStyle);

  let bg = art.makeCanvas(1, 1);
  bg.canvas.className = 'finale-canvas';
  screen.append(bg.canvas);

  // The dim rides between the hearth paint and the chrome, off during the
  // lid-opening beat (that one plays bright), on for reveals and tableau.
  const vignette = el('div', { class: 'finale-vignette', 'aria-hidden': 'true' });
  vignette.style.display = 'none';
  screen.append(vignette);

  const reveal = el('div', { class: 'finale-reveal', tabindex: '-1' });
  const raise = el('button', { type: 'button', class: 'btn-carved', onClick: () => { audio.ui('confirm'); onCredits(); } }, tr('finale.raiseHorns'));
  const resetBtn = confirmButton({
    label: tr('finale.sealAgain'), confirmLabel: tr('finale.sealAgainConfirm'),
    cancelLabel: tr('common.neverMind'), className: 'btn-quiet', onConfirm: onReset,
  });
  const ret = el('button', { type: 'button', class: 'btn-quiet', onClick: onReturnToLid }, tr('finale.return'));
  const colophon = el('p', { class: 'finale-colophon carved-text' }, tr('finale.colophon'));
  const footer = el('div', { class: 'finale-footer', style: 'display:none' }, [raise, resetBtn, ret, colophon]);
  const chrome = el('div', { class: 'finale-chrome' }, [reveal, footer]);
  screen.append(chrome);
  root.append(screen);

  let phase = 'intro';
  let introT = 0;
  let cancelAdvance = null;
  let cancelBeat = null;

  // One frame language for both treasures: the carved arch. Sized from the
  // live room so the payoff carries the stage (LOOP4: "small arch on a wide
  // field") — width-capped, and height-budgeted so arch + titles + cue land
  // whole on a 1280×800 desktop and a 390×844 phone alike.
  function archCanvas(frac, cap, chromeH) {
    const vw = screen.clientWidth || 800;
    const vh = screen.clientHeight || 800;
    const w = Math.max(150, Math.min(cap, Math.round(Math.min(vw * frac, (vh - chromeH) / 1.18))));
    return art.makeCanvas(w, Math.round(w * 1.18));
  }

  function drawArchInto(c, key) {
    const img = imageCache ? portraitImage(imageCache, key) : null;
    if (typeof art.portrait === 'function' && img) {
      // rim-lit like the dares and yields: the treasure is the last honor light
      art.portrait(c.ctx, img, 0, 0, c.w, c.h, { rim: 0.85 });
    } else {
      drawTreasurePlaceholder(c.ctx, p, c.w, c.h);
    }
  }

  function showTebi() {
    clear(reveal);
    const c = archCanvas(0.72, 340, 300);
    drawArchInto(c, 'tebi');
    reveal.append(
      c.canvas,
      el('h2', { class: 'finale-title carved-text' }, tr('finale.tebiTitle')),
      el('p', { class: 'finale-sub' }, tr('finale.tebiSub')),
      el('p', { class: 'continue-hint' }, tr('common.continueHint')),
    );
    reveal.focus();
    cancelAdvance = waitForAdvance(reveal, () => { audio.ui('slide'); showAlano(); });
  }

  function showAlano() {
    clear(reveal);
    const c = archCanvas(0.72, 340, 340);
    drawArchInto(c, 'alano');
    reveal.append(
      c.canvas,
      el('h2', { class: 'finale-title carved-text' }, tr('finale.alanoTitle')),
      el('p', { class: 'finale-sub' }, tr('finale.falseBottom', { epithet: tr('finale.alanoEpithet') })),
      el('p', { class: 'finale-epithet' }, `"${tr('finale.alanoLine')}"`),
      el('p', { class: 'continue-hint' }, tr('common.continueHint')),
    );
    reveal.focus();
    cancelAdvance = waitForAdvance(reveal, () => { audio.ui('slide'); showTableau(); });
  }

  function showTableau() {
    clear(reveal);
    const c1 = archCanvas(0.34, 190, 300);
    drawArchInto(c1, 'tebi');
    const c2 = archCanvas(0.34, 190, 300);
    drawArchInto(c2, 'alano');
    reveal.append(el('div', { class: 'finale-tableau' }, [
      el('figure', { class: 'finale-tableau-item' }, [c1.canvas, el('figcaption', {}, tr('finale.tebiTitle'))]),
      el('figure', { class: 'finale-tableau-item' }, [c2.canvas, el('figcaption', {}, tr('finale.alanoTitle'))]),
    ]));
    footer.style.display = '';
  }

  function paintBackdrop() {
    art.paintWood(bg.ctx, bg.w, bg.h, 793, { shade: 0.2 });
    // the chest stands open: the hearth at full progress, gilded and bright
    if (typeof art.hearth === 'function') art.hearth(bg.ctx, bg.w, bg.h, { y: 0.38, progress: 1, strength: 1.5 });
    else art.glow(bg.ctx, bg.w / 2, bg.h * 0.38, Math.max(bg.w, bg.h) * 0.4, p.goldBright, 0.32);
  }

  // The opening lid is a real oak panel — painted wood, carved rim, gilded
  // trim and a wavebord run — not the flat oakDeep fill it used to be. The
  // panel is baked once into an offscreen canvas and rotated as a bitmap, so
  // the 2.6s beat stays cheap despite carrying the full texture.
  let lidPanel = null;
  let lidPanelKey = '';
  function lidPanelFor(w, lidH) {
    const key = `${Math.round(w)}x${Math.round(lidH)}`;
    if (lidPanel && lidPanelKey === key) return lidPanel;
    const c = art.makeCanvas(w, lidH);
    art.paintWood(c.ctx, w, lidH, 'finale-lid', { vignette: 0.42, planks: 5 });
    // underside of a lid is darker than the board it lifts off
    c.ctx.fillStyle = `rgba(12,9,6,.4)`;
    c.ctx.fillRect(0, 0, w, lidH);
    if (typeof art.paintPanel === 'function') {
      art.paintPanel(c.ctx, w * 0.06, lidH * 0.1, w * 0.88, lidH * 0.8, { wash: 0.4, seed: 'finale-lid-inner' });
    }
    const wb = Math.max(24, w * 0.05);
    for (let x = w * 0.08; x < w * 0.92 - wb * 0.2; x += wb) {
      art.ornament(c.ctx, 'wavebord', x, lidH * 0.06, wb);
    }
    lidPanel = c.canvas;
    lidPanelKey = key;
    return lidPanel;
  }

  function paintIntro(t) {
    art.paintWood(bg.ctx, bg.w, bg.h, 793, { shade: 0.2 });
    art.glow(bg.ctx, bg.w / 2, bg.h / 2, Math.max(bg.w, bg.h) * 0.5 * t, p.goldBright, Math.min(1, t * 1.4));
    const lidH = bg.h * 0.55;
    const panel = lidPanelFor(bg.w, lidH);
    bg.ctx.save();
    bg.ctx.translate(bg.w / 2, bg.h - lidH);
    bg.ctx.rotate(-(Math.PI / 2.1) * t);
    bg.ctx.drawImage(panel, -bg.w / 2, -2, bg.w, lidH);
    bg.ctx.restore();
  }

  function resize() {
    const w = screen.clientWidth;
    const h = screen.clientHeight;
    const fresh = art.makeCanvas(w, h);
    fresh.canvas.className = 'finale-canvas';
    screen.replaceChild(fresh.canvas, bg.canvas);
    bg = fresh;
    lidPanel = null;
    if (phase === 'intro') paintIntro(introT);
    else paintBackdrop();
  }

  function beginReveals() {
    phase = 'tebi';
    paintBackdrop();
    vignette.style.display = '';
    chrome.style.display = '';
    audio.motif('chest');
    audio.drone.intensity(1);
    showTebi();
  }

  window.addEventListener('resize', resize);
  resize();

  if (animate && !reducedMotion) {
    const skipHint = el('p', { class: 'skip-hint' }, tr('common.skipHint'));
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
