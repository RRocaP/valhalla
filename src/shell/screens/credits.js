// Credits. docs/SHELL.md #5, docs/JARLS.md "Credits stickers".

import { el } from '../dom.js';
import { DUEL_CAST } from '../duels.js';
import { portraitImage, drawPortraitPlaceholder } from '../portraits.js';

const STICKER_POOL = ['bourj', 'rois', 'andreas', 'folklore', 'arya', 'ramon', 'alano', 'alanof', 'tebi'];

export function mountCredits(root, { art, audio, reducedMotion, imageCache, tr, onSkip }) {
  const p = art.palette;
  const screen = el('div', { class: 'screen screen-credits' });

  let bg = art.makeCanvas(1, 1);
  bg.canvas.className = 'finale-canvas';
  screen.append(bg.canvas);

  // Falling stickers live on their own transparent overlay canvas, composited
  // from sprites pre-rendered once (no per-frame regrade, docs/JARLS.md).
  let stickerCanvas = art.makeCanvas(1, 1);
  stickerCanvas.canvas.className = 'sticker-canvas';
  screen.append(stickerCanvas.canvas);

  // art.sticker derives its height from the source image's aspect ratio, so a
  // portrait photo drawn at w=55 into a 64x64 sprite was cut off top and
  // bottom. Size each sprite canvas from the image instead, and keep the drawn
  // dimensions with it so the fall loop composites at the true aspect.
  const sprites = [];
  if (typeof art.sticker === 'function') {
    for (const key of STICKER_POOL) {
      const img = imageCache ? portraitImage(imageCache, key) : null;
      if (!img) continue;
      const iw = img.naturalWidth || img.width || 1;
      const ih = img.naturalHeight || img.height || 1;
      const drawW = 76;
      const drawH = drawW * (ih / iw);
      const pad = 10;
      const c = art.makeCanvas(Math.round(drawW + pad), Math.round(drawH + pad));
      art.sticker(c.ctx, img, c.w / 2, c.h / 2, drawW, 0);
      sprites.push({ canvas: c.canvas, w: c.w, h: c.h });
    }
  }

  function portraitFig(key, name, opts = {}) {
    const size = opts.size || 120;
    const c = art.makeCanvas(size, Math.round(size * (opts.white ? 1.1 : 1.2)));
    const img = imageCache ? portraitImage(imageCache, key) : null;
    if (typeof art.portrait === 'function' && img) art.portrait(c.ctx, img, 0, 0, c.w, c.h, opts.white ? { white: true } : {});
    else drawPortraitPlaceholder(c.ctx, p, 0, 0, c.w, c.h, name);
    return el('figure', { class: opts.white ? 'credits-portrait credits-portrait-white' : 'credits-portrait' }, [c.canvas, el('figcaption', {}, name)]);
  }

  const challengers = el('div', { class: 'credits-challengers' }, DUEL_CAST.map(({ key, name }) => portraitFig(key, name)));

  const scroll = el('div', { class: 'credits-scroll', tabindex: '0' });
  if (reducedMotion) scroll.style.scrollBehavior = 'auto';

  scroll.append(
    el('section', { class: 'credits-section' }, [el('h1', { class: 'credits-title carved-text' }, 'VALHALLA')]),
    el('section', { class: 'credits-section' }, [el('h2', { class: 'carved-text' }, tr('credits.challengers')), challengers]),
    el('section', { class: 'credits-section' }, [
      el('h2', { class: 'carved-text' }, tr('credits.hoard')),
      el('p', {}, tr('finale.tebiTitle')),
      el('p', {}, `${tr('finale.alanoTitle')} — ${tr('finale.alanoEpithet')}`),
    ]),
    el('section', { class: 'credits-section' }, [
      el('h2', { class: 'carved-text' }, tr('credits.score')),
      el('p', {}, tr('credits.track1')),
      el('p', {}, tr('credits.track2')),
    ]),
    el('section', { class: 'credits-section' }, [portraitFig('ramon', 'JARL RAMON', { white: true, size: 88 })]),
    el('section', { class: 'credits-section credits-colophon' }, [el('p', { class: 'carved-text' }, tr('finale.colophon'))]),
  );

  // Reduced motion: a static scatter as real DOM content at the foot of the
  // scrollable list (not the falling overlay, which is viewport-fixed and
  // wouldn't sit "at the foot" in any scroll-stable sense).
  if (sprites.length && reducedMotion) {
    const n = Math.min(8, sprites.length);
    const scatter = el('div', { class: 'sticker-scatter' });
    for (let i = 0; i < n; i++) {
      scatter.append(el('img', {
        class: 'sticker-static',
        src: sprites[i].canvas.toDataURL('image/png'),
        alt: '',
        style: `transform:rotate(${(i % 2 ? 1 : -1) * (4 + i)}deg)`,
      }));
    }
    scroll.append(el('section', { class: 'credits-section' }, [scatter]));
  }

  const skipBtn = el('button', {
    type: 'button', class: 'btn-quiet credits-skip',
    onClick: () => { audio.ui('slide'); onSkip(); },
  }, tr('credits.skip'));

  screen.append(scroll, skipBtn);
  root.append(screen);

  function paintBg() {
    art.paintWood(bg.ctx, bg.w, bg.h, 811, { shade: 0.22 });
    // the same hearth, banked low for the long scroll — warm, not loud
    if (typeof art.hearth === 'function') art.hearth(bg.ctx, bg.w, bg.h, { y: 0.26, progress: 1, strength: 0.65 });
  }
  function resize() {
    const w = screen.clientWidth;
    const h = screen.clientHeight;
    const freshBg = art.makeCanvas(w, h);
    freshBg.canvas.className = 'finale-canvas';
    screen.replaceChild(freshBg.canvas, bg.canvas);
    bg = freshBg;
    paintBg();
    const freshSticker = art.makeCanvas(w, h);
    freshSticker.canvas.className = 'sticker-canvas';
    screen.replaceChild(freshSticker.canvas, stickerCanvas.canvas);
    stickerCanvas = freshSticker;
  }
  window.addEventListener('resize', resize);
  resize();

  audio.music?.credits?.();
  scroll.focus();

  function onKey(e) { if (e.key === 'Escape') { audio.ui('slide'); onSkip(); } }
  scroll.addEventListener('keydown', onKey);

  // ---- falling stickers (skipped entirely under reduced motion) ----
  let raf = null;
  let spawnTimer = null;
  let particles = [];

  function spawnOne() {
    if (!sprites.length || particles.length >= 8) return;
    particles.push({
      sprite: sprites[Math.floor(Math.random() * sprites.length)],
      x: 20 + Math.random() * Math.max(1, (screen.clientWidth || 360) - 60),
      vy: 16 + Math.random() * 12,
      sway: 8 + Math.random() * 10,
      swayFreq: 0.4 + Math.random() * 0.4,
      rot: (Math.random() - 0.5) * 40,
      rotSpeed: (Math.random() - 0.5) * 8,
      born: performance.now(),
    });
  }

  function loop(now) {
    stickerCanvas.ctx.clearRect(0, 0, stickerCanvas.w, stickerCanvas.h);
    const h = stickerCanvas.h || 600;
    particles = particles.filter((pt) => {
      const t = (now - pt.born) / 1000;
      const y = -80 + pt.vy * t * 10;
      const x = pt.x + Math.sin(t * pt.swayFreq) * pt.sway;
      const rotRad = ((pt.rot + pt.rotSpeed * t * 10) * Math.PI) / 180;
      stickerCanvas.ctx.save();
      stickerCanvas.ctx.translate(x, y);
      stickerCanvas.ctx.rotate(rotRad);
      stickerCanvas.ctx.drawImage(pt.sprite.canvas, -pt.sprite.w / 2, -pt.sprite.h / 2, pt.sprite.w, pt.sprite.h);
      stickerCanvas.ctx.restore();
      return y <= h + 80;
    });
    raf = requestAnimationFrame(loop);
  }

  if (sprites.length && !reducedMotion) {
    spawnOne();
    spawnTimer = setInterval(spawnOne, 900);
    raf = requestAnimationFrame(loop);
  }

  return function unmount() {
    window.removeEventListener('resize', resize);
    scroll.removeEventListener('keydown', onKey);
    if (raf) cancelAnimationFrame(raf);
    if (spawnTimer) clearInterval(spawnTimer);
    screen.remove();
  };
}
