// paintPanel: a carved recessed panel with a layered-gold trim and an
// optional carved-in title.
import { palette, rgba, mix } from './palette.js';
import { carveStroke } from './util.js';
import { strokeGoldLayered } from './gold.js';

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
  const radius = Math.min(18, Math.min(w, h) * 0.06);
  const path = (c, inset = 0) => roundedRectPath(c, x, y, w, h, radius, inset);

  ctx.save();
  ctx.beginPath();
  path(ctx, 0);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, palette.oakDeep);
  g.addColorStop(1, mix(palette.oakDeep, palette.tar, 0.35));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  carveStroke(ctx, (c) => path(c, 3), { width: Math.max(1.5, Math.min(w, h) * 0.012) });
  strokeGoldLayered(ctx, (c) => path(c, 8), { x, y, w, h }, { width: Math.max(1.4, Math.min(w, h) * 0.007) });

  if (opts.title) {
    ctx.save();
    const fontSize = Math.round(Math.min(w, h) * 0.09);
    ctx.font = `600 ${fontSize}px 'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const tx = x + w / 2;
    const ty = y + Math.min(w, h) * 0.16 + fontSize * 0.5;
    ctx.fillStyle = rgba(palette.tar, 0.8);
    ctx.fillText(opts.title, tx + 1, ty + 1.4);
    ctx.fillStyle = palette.bone;
    ctx.fillText(opts.title, tx, ty);
    ctx.restore();
  }
}
