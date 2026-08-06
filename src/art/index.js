// createArt(): composes the full frozen API (docs/ART.md) from the focused
// modules in this directory. This is the only file anything outside
// src/art/** imports (see src/main.js).
import { palette, reliefShadowCss } from './palette.js';
import { paintWood } from './wood.js';
import { paintPanel } from './panel.js';
import { drawRune } from './runes.js';
import { drawKnot } from './knot.js';
import { ornament, medallion } from './ornaments.js';
import { glow } from './util.js';
import { chestScene, treasureFrame } from './chest.js';
import { portrait } from './portrait.js';
import { sticker } from './sticker.js';
import { carveText } from './text.js';

function dpr() {
  const d = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  return Math.max(1, Math.min(d, 3));
}

export function createArt() {
  return {
    palette,
    reliefShadowCss,
    makeCanvas(w, h) {
      const canvas = document.createElement('canvas');
      const d = dpr();
      canvas.width = Math.max(1, Math.round(w * d));
      canvas.height = Math.max(1, Math.round(h * d));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      ctx.scale(d, d);
      return { canvas, ctx, w, h };
    },
    paintWood,
    paintPanel,
    drawRune,
    drawKnot,
    ornament,
    medallion,
    glow,
    chestScene,
    treasureFrame,
    portrait,
    sticker,
    carveText,
  };
}
