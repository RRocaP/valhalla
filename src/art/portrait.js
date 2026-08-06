// portrait(): a supplied challenger/credits image graded into the palette
// (light desaturation, warm oak tint at preserved exposure, corner-only tar
// vignette — see buildGraded), presented inside a
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

// Grade recipe (revised on Ramon's live iPhone note: "can barely even see the
// jarl's face and outfit"). Identity beats grading — the palette blend is real
// but it may never cost exposure:
//   desat 0.14      the source photos are already warm; ≤15% is all it takes
//   multiply 0.62   the oak tint pushed PAST the old strength...
//   preserveLum 1   ...but restored to the source's own luminance, so the tint
//                   moves HUE only and the face keeps every stop it had. This
//                   is the whole trick: the palette blend survives intact and
//                   the ~40% exposure tax that came with it does not.
//   lift 0.3        fur, leather and hair keep their detail
//   vignette edge   tar in the outer 12% corners, nowhere near the face
function buildGraded(img, w, h) {
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.round(w));
  off.height = Math.max(1, Math.round(h));
  const ctx = off.getContext('2d');
  gradeInto(ctx, img, w, h, {
    desat: 0.14,
    multiplyStrength: 0.62,
    preserveLum: 1,
    lift: 0.3,
    vignette: 0.42,
    vignetteEdge: 0.12,
  });
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

  // The bow dips and shears the image inside a fixed arch, so a sliver at the
  // crown falls outside it. That sliver is the dark hall behind him, not the
  // bare board a cleared canvas would otherwise show through.
  if (bow > 0) {
    ctx.fillStyle = rgba(palette.tar, 0.94);
    ctx.fillRect(x, y, w, h);
  }

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
    // The bow must be SEEN: the old 0.62 tar wash turned the fully-bowed
    // frame (which is also the reduced-motion still) back into a silhouette.
    // A gradient keeps the head readable and lets the floor take the dark.
    const dim = ctx.createLinearGradient(0, y, 0, y + h);
    dim.addColorStop(0, rgba(palette.tar, bow * 0.16));
    dim.addColorStop(1, rgba(palette.tar, bow * 0.4));
    ctx.fillStyle = dim;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
  ctx.restore();

  // opts.rim (0..1, additive): theatre rim-light — the hearth catching the
  // arch from above and behind, brightest at the crown, dying down the
  // sides. Two passes: a soft warm haze then a crisp bright edge. Drawn
  // before the frame so the gold rim seats over it. Deterministic.
  if (!white && opts.rim) {
    const rim = clamp01(opts.rim);
    const rg = ctx.createLinearGradient(0, y, 0, y + h);
    rg.addColorStop(0, rgba(palette.goldBright, 0.9 * rim));
    rg.addColorStop(0.4, rgba(palette.ember, 0.42 * rim));
    rg.addColorStop(1, rgba(palette.ember, 0.1 * rim));
    ctx.save();
    ctx.lineJoin = 'round';
    // soft warm haze bleeding inward from the crown
    ctx.beginPath();
    archPath(ctx, x, y, w, h, w * 0.03);
    ctx.strokeStyle = rgba(palette.goldBright, 0.18 * rim);
    ctx.lineWidth = Math.max(3, w * 0.062);
    ctx.stroke();
    // crisp lit edge just inside the arch
    ctx.beginPath();
    archPath(ctx, x, y, w, h, w * 0.014);
    ctx.strokeStyle = rg;
    ctx.lineWidth = Math.max(1.6, w * 0.024);
    ctx.stroke();
    // Shadow-side separation. Every jarl photo is keyed from frame-right, so
    // the left flank is where the figure and the arch both go to tar and the
    // silhouette welds shut. The hearth is read as sitting off that side: the
    // left third of the rim runs hotter and dies out by the middle.
    const sg = ctx.createLinearGradient(x, 0, x + w * 0.62, 0);
    sg.addColorStop(0, rgba(palette.goldBright, 0.62 * rim));
    sg.addColorStop(0.4, rgba(palette.ember, 0.26 * rim));
    sg.addColorStop(1, rgba(palette.ember, 0));
    ctx.beginPath();
    archPath(ctx, x, y, w, h, w * 0.022);
    ctx.strokeStyle = sg;
    ctx.lineWidth = Math.max(3, w * 0.05);
    ctx.stroke();
    ctx.restore();
  }

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
