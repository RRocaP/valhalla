// paintPanel: a carved recessed panel. The field is real wood (darkened by a
// tar wash so overlaid text keeps its contrast floor) sunk behind a bevelled
// lip — inner shade above-left, warm catch light below-right — then the
// layered-gold trim, corner nailheads, and an optional carved-in title.
// The old version filled the interior with a flat oakDeep->tar gradient, which
// read as a black rectangle at retina and defeated the texture-everywhere
// mandate on every lock room.
import { palette, rgba, mix } from './palette.js';
import { carveStroke } from './util.js';
import { strokeGoldLayered } from './gold.js';
import { paintWood } from './wood.js';
import { carveText } from './text.js';
import { ornament } from './ornaments.js';

function roundedRectPath(c, x, y, w, h, radius, inset = 0) {
  const rx = x + inset;
  const ry = y + inset;
  const rw = w - 2 * inset;
  const rh = h - 2 * inset;
  const rr = Math.max(2, radius - inset);
  c.moveTo(rx + rr, ry);
  c.arcTo(rx + rw, ry, rx + rw, ry + rh, rr);
  c.arcTo(rx + rw, ry + rh, rx, ry + rh, rr);
  c.arcTo(rx, ry + rh, rx, ry, rr);
  c.arcTo(rx, ry, rx + rw, ry, rr);
  c.closePath();
}

export function paintPanel(ctx, x, y, w, h, opts = {}) {
  const radius = Math.min(22, Math.min(w, h) * 0.06);
  const path = (c, inset = 0) => roundedRectPath(c, x, y, w, h, radius, inset);
  const minDim = Math.min(w, h);
  const bevel = Math.max(5, minDim * 0.022);
  const wash = opts.wash ?? 0.62;

  ctx.save();
  ctx.beginPath();
  path(ctx, 0);
  ctx.clip();

  // 1. the sunken field is wood, not a void
  ctx.save();
  ctx.translate(x, y);
  paintWood(ctx, w, h, opts.seed ?? 'panel', { vignette: 0.55, grainAlpha: 0.85 });
  ctx.restore();

  // 2. tar wash — a recess sits out of the hearth light. Graded so the top of
  // the panel (further from the fire) is deepest.
  const washGrad = ctx.createLinearGradient(x, y, x, y + h);
  washGrad.addColorStop(0, rgba(palette.tar, Math.min(0.95, wash + 0.14)));
  washGrad.addColorStop(0.55, rgba(palette.tar, wash));
  washGrad.addColorStop(1, rgba(palette.oakDeep, Math.min(0.95, wash + 0.05)));
  ctx.fillStyle = washGrad;
  ctx.fillRect(x, y, w, h);

  // 3. the carved lip, drawn INSIDE the clip so it hugs the rounded corners:
  // a wide dark stroke pushed up-left, a warm one pushed down-right.
  ctx.lineJoin = 'round';
  ctx.save();
  ctx.translate(-bevel * 0.34, -bevel * 0.4);
  ctx.strokeStyle = rgba(palette.tar, 0.72);
  ctx.lineWidth = bevel * 2;
  ctx.beginPath();
  path(ctx, bevel);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(bevel * 0.34, bevel * 0.4);
  ctx.strokeStyle = rgba(mix(palette.oakLight, palette.goldBright, 0.22), 0.3);
  ctx.lineWidth = bevel * 1.15;
  ctx.beginPath();
  path(ctx, bevel * 1.5);
  ctx.stroke();
  ctx.restore();

  // 4. hearth glow spilling onto the lower field, so the recess is lit, not dead
  const lit = ctx.createRadialGradient(x + w / 2, y + h * 0.96, 0, x + w / 2, y + h * 0.96, Math.max(w, h) * 0.62);
  lit.addColorStop(0, rgba(palette.ember, 0.11));
  lit.addColorStop(1, rgba(palette.ember, 0));
  ctx.fillStyle = lit;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  // 5. rim incision + gold trim
  carveStroke(ctx, (c) => path(c, 3), { width: Math.max(2, minDim * 0.012) });
  strokeGoldLayered(ctx, (c) => path(c, bevel + 6), { x, y, w, h }, { width: Math.max(1.4, minDim * 0.006) });

  // 6. nailheads pinning the trim at the corners — micro-detail where the eye
  // rests (docs/QUALITY.md, Ramon's emphasis)
  if (opts.nails !== false) {
    const inset = bevel + 6;
    const ns = Math.max(7, minDim * 0.026);
    [
      [x + inset, y + inset], [x + w - inset, y + inset],
      [x + inset, y + h - inset], [x + w - inset, y + h - inset],
    ].forEach(([nx, ny]) => ornament(ctx, 'nailhead', nx, ny, ns));
  }

  if (opts.title) {
    const fontSize = Math.round(Math.min(w * 0.09, minDim * 0.1));
    carveText(ctx, opts.title, x + w / 2, y + minDim * 0.16 + fontSize * 0.5, fontSize, {
      align: 'center', depth: 0.8, maxWidth: w * 0.82,
    });
  }
}
