// Layered gold: base gradient -> burnish highlight -> sparse specular ticks.
// Never a flat fill/stroke. fillGoldLayered is for simple non-self-crossing
// shapes (a single circle/rect); strokeGoldLayered is for rings/borders,
// deliberately avoiding a fill-rule "frame with a hole" path (nested rects
// under the default nonzero winding rule fill solid, not as a ring).
import { palette, rgba, mix } from './palette.js';

function specularTicks(ctx, x, y, w, h, count) {
  ctx.save();
  ctx.strokeStyle = rgba(palette.bone, 0.8);
  ctx.lineWidth = Math.max(0.6, Math.min(w, h) * 0.012);
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const a = -2.35 + i * (1.7 / Math.max(1, count - 1));
    const rr = Math.min(w, h) * (0.22 + (i % 2) * 0.12);
    const cx = x + w * 0.34 + Math.cos(a) * rr * 0.5;
    const cy = y + h * 0.3 + Math.sin(a) * rr * 0.5;
    const len = Math.min(w, h) * 0.045;
    ctx.globalAlpha = 0.5 + 0.5 * ((i % 3) / 2);
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(a) * len, cy - Math.sin(a) * len);
    ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
}

export function fillGoldLayered(ctx, pathFn, bounds, opts = {}) {
  const { x, y, w, h } = bounds;
  const base = opts.base || palette.gold;
  const bright = opts.bright || palette.goldBright;
  const shade = opts.shade || mix(palette.tar, palette.gold, 0.35);

  ctx.save();
  ctx.beginPath();
  pathFn(ctx);
  ctx.clip();

  const g1 = ctx.createLinearGradient(x, y, x + w, y + h);
  g1.addColorStop(0, bright);
  g1.addColorStop(0.45, base);
  g1.addColorStop(1, shade);
  ctx.fillStyle = g1;
  ctx.fillRect(x, y, w, h);

  const hx = x + w * 0.32;
  const hy = y + h * 0.28;
  const hr = Math.max(w, h) * 0.55;
  const g2 = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
  g2.addColorStop(0, rgba(bright, 0.55));
  g2.addColorStop(1, rgba(bright, 0));
  ctx.fillStyle = g2;
  ctx.fillRect(x, y, w, h);

  specularTicks(ctx, x, y, w, h, opts.ticks ?? 4);
  ctx.restore();
}

export function strokeGoldLayered(ctx, pathFn, bounds, opts = {}) {
  const { x, y, w, h } = bounds;
  const width = opts.width || Math.max(2, Math.min(w, h) * 0.02);
  const base = opts.base || palette.gold;
  const bright = opts.bright || palette.goldBright;
  const shade = opts.shade || mix(palette.tar, palette.gold, 0.35);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const g1 = ctx.createLinearGradient(x, y, x + w, y + h);
  g1.addColorStop(0, bright);
  g1.addColorStop(0.5, base);
  g1.addColorStop(1, shade);
  ctx.strokeStyle = g1;
  ctx.lineWidth = width;
  ctx.beginPath();
  pathFn(ctx);
  ctx.stroke();

  ctx.strokeStyle = rgba(bright, 0.5);
  ctx.lineWidth = Math.max(1, width * 0.35);
  ctx.beginPath();
  pathFn(ctx);
  ctx.stroke();
  ctx.restore();
}
