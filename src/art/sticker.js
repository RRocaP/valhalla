// sticker(): a die-cut photo sticker for the credits rain — bone (palette's
// white/ivory role; there is no pure #fff token) border, rounded corners,
// soft attached drop shadow, light palette grade. No height/opts params: h
// derives from the image's own aspect ratio, matching a real sticker. The
// bordered+graded artwork is cached per (img,w) in a WeakMap; each call then
// only pays for a rotate + drawImage, since a credits rain calls this many
// times per frame across many falling stickers.
import { palette, rgba } from './palette.js';
import { gradeInto, srcSize } from './grade.js';

const stickerCache = new WeakMap();

function roundedRectPath(c, x, y, w, h, radius) {
  const rr = Math.min(radius, w / 2, h / 2);
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function buildSticker(img, w, h) {
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.round(w));
  off.height = Math.max(1, Math.round(h));
  const ctx = off.getContext('2d');
  const radius = Math.min(w, h) * 0.1;
  // ~4% of width is a hairline once the sticker is composited at credits size —
  // it read as a plain rounded photo. A real die-cut leaves a visible margin.
  const border = w * 0.075;

  ctx.save();
  roundedRectPath(ctx, 0, 0, w, h, radius);
  ctx.fillStyle = palette.bone;
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundedRectPath(ctx, border, border, w - border * 2, h - border * 2, Math.max(1, radius - border));
  ctx.clip();
  const inner = document.createElement('canvas');
  inner.width = off.width;
  inner.height = off.height;
  const innerCtx = inner.getContext('2d');
  gradeInto(innerCtx, img, w, h, { desat: 0.16, multiplyStrength: 0.26, vignette: 0.22 });
  ctx.drawImage(inner, 0, 0, w, h);
  ctx.restore();

  // the photo sits slightly below the border's surface
  ctx.save();
  ctx.strokeStyle = rgba(palette.tar, 0.4);
  ctx.lineWidth = Math.max(0.8, w * 0.012);
  ctx.beginPath();
  roundedRectPath(ctx, border, border, w - border * 2, h - border * 2, Math.max(1, radius - border));
  ctx.stroke();
  ctx.restore();

  return off;
}

function stickerFor(img, w, h) {
  const rw = Math.round(w);
  const rh = Math.round(h);
  let entry = stickerCache.get(img);
  if (!entry || entry.w !== rw || entry.h !== rh) {
    entry = { w: rw, h: rh, canvas: buildSticker(img, rw, rh) };
    stickerCache.set(img, entry);
  }
  return entry.canvas;
}

export function sticker(ctx, img, x, y, w, rot = 0) {
  if (!img) return;
  const { w: sw, h: sh } = srcSize(img);
  const h = w * (sh / sw);
  const art = stickerFor(img, w, h);
  const radius = Math.min(w, h) * 0.12;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  const shadowOx = w * 0.035;
  const shadowOy = h * 0.05;
  for (let i = 3; i >= 1; i--) {
    ctx.fillStyle = rgba(palette.tar, 0.055 * i);
    ctx.beginPath();
    roundedRectPath(ctx, -w / 2 - i * 0.6 + shadowOx, -h / 2 - i * 0.6 + shadowOy, w + i * 1.2, h + i * 1.2, radius);
    ctx.fill();
  }

  ctx.drawImage(art, -w / 2, -h / 2, w, h);
  ctx.restore();
}
