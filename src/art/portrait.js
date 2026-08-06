// portrait(): a supplied challenger/credits image graded into the palette
// (desaturate ~30%, warm oak multiply, tar vignette), presented inside a
// carved arch with a gold groove rim, or — opts.white — a small flat
// bone-white border frame for the credits portrait. The expensive per-pixel
// grading is cached per (img,w,h) in a WeakMap keyed on the image itself, so
// repeated calls during a caller-driven bow tween only pay for a transform +
// drawImage + frame, not a re-grade. No internal timers: opts.bow renders
// whatever value the caller passes, deterministically.
import { palette, rgba, clamp01 } from './palette.js';
import { carveStroke } from './util.js';
import { strokeGoldLayered } from './gold.js';
import { gradeInto } from './grade.js';

const gradeCache = new WeakMap();

function buildGraded(img, w, h) {
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.round(w));
  off.height = Math.max(1, Math.round(h));
  const ctx = off.getContext('2d');
  gradeInto(ctx, img, w, h, { desat: 0.3, multiplyStrength: 0.5, vignette: 0.55 });
  return off;
}

function gradedFor(img, w, h) {
  const rw = Math.round(w);
  const rh = Math.round(h);
  let entry = gradeCache.get(img);
  if (!entry || entry.w !== rw || entry.h !== rh) {
    entry = { w: rw, h: rh, canvas: buildGraded(img, rw, rh) };
    gradeCache.set(img, entry);
  }
  return entry.canvas;
}

function archPath(c, x, y, w, h, inset = 0) {
  const rx = x + inset;
  const ry = y + inset;
  const rw = w - inset * 2;
  const rh = h - inset * 2;
  const radius = rw / 2;
  const springY = ry + radius;
  c.moveTo(rx, ry + rh);
  c.lineTo(rx, springY);
  c.arc(rx + radius, springY, radius, Math.PI, 0, false);
  c.lineTo(rx + rw, ry + rh);
  c.closePath();
}

export function portrait(ctx, img, x, y, w, h, opts = {}) {
  if (!img) return;
  const bow = clamp01(opts.bow || 0);
  const white = !!opts.white;
  const graded = gradedFor(img, w, h);

  ctx.save();
  ctx.beginPath();
  if (white) ctx.rect(x, y, w, h);
  else archPath(ctx, x, y, w, h, 0);
  ctx.clip();

  ctx.save();
  const pivotX = x + w / 2;
  const pivotY = y + h;
  ctx.translate(pivotX, pivotY);
  const dip = bow * h * 0.08;
  const shear = bow * 0.09;
  ctx.transform(1, 0, shear, 1 - bow * 0.03, 0, dip);
  ctx.translate(-pivotX, -pivotY);
  ctx.drawImage(graded, x, y, w, h);
  if (bow > 0) {
    ctx.fillStyle = rgba(palette.tar, bow * 0.62);
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
  ctx.restore();

  if (white) {
    const borderW = w * 0.03;
    ctx.save();
    for (let i = 3; i >= 1; i--) {
      ctx.fillStyle = rgba(palette.tar, 0.07 * i);
      ctx.fillRect(x - i, y - i + 2, w + i * 2, h + i * 2);
    }
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = palette.bone;
    ctx.lineWidth = borderW;
    ctx.strokeRect(x + borderW / 2, y + borderW / 2, w - borderW, h - borderW);
    ctx.restore();
  } else {
    carveStroke(ctx, (c) => archPath(c, x, y, w, h, 0), { width: Math.max(2, w * 0.02) });
    strokeGoldLayered(ctx, (c) => archPath(c, x, y, w, h, w * 0.02), { x, y, w, h }, { width: Math.max(1.5, w * 0.018) });
  }
}
