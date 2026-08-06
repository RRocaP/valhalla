// createArt(): composes the full frozen API (docs/ART.md) from the focused
// modules in this directory. This is the only file anything outside
// src/art/** imports (see src/main.js).
import { palette, reliefShadowCss } from './palette.js';
import { paintWood } from './wood.js';
import { paintPanel } from './panel.js';
import { drawRune } from './runes.js';
import { drawKnot } from './knot.js';
import { ornament, medallion } from './ornaments.js';
import { glow, hearthPool } from './util.js';
import { chestScene, treasureFrame, chestLayout } from './chest.js';
import { portrait } from './portrait.js';
import { sticker } from './sticker.js';
import { carveText } from './text.js';
import { wordmark } from './wordmark.js';

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
    // Additive helper (not a change to any frozen signature): exposes the exact
    // socket geometry chestScene carves, so the shell can align its medallion
    // hit-targets to the recesses instead of running a second, divergent layout
    // and painting a duplicate set of medallions over them.
    chestLayout,
    treasureFrame,
    portrait,
    sticker,
    carveText,
    // Additive (no frozen signature changed), same footing as chestLayout:
    // hearth() is the single ambient key-light recipe every screen shares —
    // one warm source concept, progress-warmed; wordmark() is the carved
    // VALHALLA statement (tracked carveText + rune-flanked rule) used by the
    // threshold and echoed on the lid.
    hearth: hearthPool,
    wordmark,
  };
}
