// drawRune: renders kernel/futhark.js stroke segments as chisel cuts —
// a dark offset under-pass beneath a colour over-pass, both built as
// variable-width ribbon polygons (not ctx.lineWidth) so strokes taper near
// their true ends and stay full width through interior bends.
import { BY_CH } from '../kernel/futhark.js';
import { palette, rgba } from './palette.js';
import { glow as glowFx } from './util.js';

function ribbonSides(pts, widthFn) {
  const n = pts.length;
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(n - 1, i + 1)];
    let tx = next[0] - prev[0];
    let ty = next[1] - prev[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const nx = -ty;
    const ny = tx;
    const hw = widthFn(i);
    left.push([p[0] + nx * hw, p[1] + ny * hw]);
    right.push([p[0] - nx * hw, p[1] - ny * hw]);
  }
  return { left, right };
}

function fillRibbon(ctx, pts, maxWidth, taperFrac = 0.22) {
  const n = pts.length;
  if (n < 2) return;
  const segLen = [];
  let total = 0;
  for (let i = 1; i < n; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segLen.push(d);
    total += d;
  }
  if (total < 1e-6) return;
  const cum = [0];
  for (const d of segLen) cum.push(cum[cum.length - 1] + d);
  const taperLen = Math.min(total * taperFrac, maxWidth * 2.2);
  const widthFn = (i) => {
    const s = cum[i];
    const distFromEnd = Math.min(s, total - s);
    const t = taperLen > 0 ? Math.min(1, distFromEnd / taperLen) : 1;
    const factor = 0.32 + 0.68 * t;
    return (maxWidth * factor) / 2;
  };
  const { left, right } = ribbonSides(pts, widthFn);
  ctx.beginPath();
  left.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fill();
  // soft round tips (the ribbon's own ends are a flat taper edge otherwise)
  ctx.beginPath();
  ctx.arc(pts[0][0], pts[0][1], widthFn(0), 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(pts[n - 1][0], pts[n - 1][1], widthFn(n - 1), 0, Math.PI * 2);
  ctx.fill();
}

export function drawRune(ctx, ch, x, y, size, opts = {}) {
  const rune = BY_CH[ch];
  if (!rune) return;
  const color = opts.color || palette.bone;
  const weight = opts.weight || size / 9;

  ctx.save();
  ctx.translate(x, y);
  if (opts.mirror) {
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
  }

  if (opts.glow) {
    const strength = opts.glow === true ? 1 : opts.glow;
    glowFx(ctx, size * 0.5, size * 0.5, size * 0.9, opts.glowColor || color, strength);
  }

  for (const seg of rune.segments) {
    const pts = seg.map(([px, py]) => [px * size, py * size]);
    ctx.save();
    ctx.translate(weight * 0.16, weight * 0.22);
    ctx.fillStyle = rgba(palette.tar, 0.8);
    fillRibbon(ctx, pts, weight * 1.35);
    ctx.restore();
    ctx.fillStyle = color;
    fillRibbon(ctx, pts, weight);
  }
  ctx.restore();
}
