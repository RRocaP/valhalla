// ornament(): five decorative kinds, plus medallion() (the lock-face
// carving) and its pure medallionState() helper. Nothing here uses rng —
// every shape is closed-form geometry over its explicit (x,y,size) args, so
// determinism is automatic (docs/ART.md: "deterministic for a given seed" —
// trivially true when there is no seed and no hidden state).
import { ORDER } from '../kernel/futhark.js';
import { palette, rgba, mix, clamp01 } from './palette.js';
import { carveStroke, glow as glowFx, prefersReducedMotion } from './util.js';
import { fillGoldLayered } from './gold.js';
import { drawKnot } from './knot.js';
import { drawRune } from './runes.js';

function ringPoints(cx, cy, size, points, skip) {
  const rad = size * 0.42;
  const pts = [];
  let i = 0;
  do {
    const a = (i / points) * Math.PI * 2 - Math.PI / 2;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    i = (i + skip) % points;
  } while (i !== 0);
  pts.push(pts[0]);
  return pts;
}

function ringknot(ctx, x, y, size, opts) {
  const pts = ringPoints(x, y, size, 7, 3);
  drawKnot(ctx, pts, {
    width: opts.width || size * 0.08,
    color: opts.color || palette.gold,
    gapAtCrossings: opts.gapAtCrossings,
  });
}

function nailhead(ctx, x, y, size, opts = {}) {
  const r = size * 0.5;
  carveStroke(ctx, (c) => c.arc(x, y, r * 0.92, 0, Math.PI * 2), { width: Math.max(1, size * 0.045) });
  fillGoldLayered(ctx, (c) => c.arc(x, y, r * 0.68, 0, Math.PI * 2), { x: x - r, y: y - r, w: 2 * r, h: 2 * r }, { ticks: 2 });
}

function shieldboss(ctx, x, y, size, opts) {
  const r = size * 0.5;
  carveStroke(ctx, (c) => c.arc(x, y, r, 0, Math.PI * 2), { width: Math.max(1.5, size * 0.03) });
  fillGoldLayered(ctx, (c) => c.arc(x, y, r * 0.82, 0, Math.PI * 2), { x: x - r, y: y - r, w: 2 * r, h: 2 * r }, { ticks: 5 });
  const domeR = r * 0.34;
  const dg = ctx.createRadialGradient(x - domeR * 0.3, y - domeR * 0.3, domeR * 0.1, x, y, domeR);
  dg.addColorStop(0, palette.goldBright);
  dg.addColorStop(1, mix(palette.gold, palette.tar, 0.3));
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.arc(x, y, domeR, 0, Math.PI * 2);
  ctx.fill();
  const rivetCount = 8;
  for (let i = 0; i < rivetCount; i++) {
    const a = (i / rivetCount) * Math.PI * 2;
    nailhead(ctx, x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, size * 0.1, opts);
  }
}

function wavebordPath(c, x, y, size, amp) {
  c.moveTo(x, y);
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    const px = x + (size * i) / steps;
    const py = y + Math.sin((i / steps) * Math.PI * 2) * amp;
    c.lineTo(px, py);
  }
}

function wavebord(ctx, x, y, size, opts) {
  const amp = size * 0.16;
  const path = (c) => wavebordPath(c, x, y, size, amp);
  carveStroke(ctx, path, { width: Math.max(1.5, size * 0.045) });
  ctx.save();
  ctx.strokeStyle = rgba(opts.color || palette.gold, 0.8);
  ctx.lineWidth = Math.max(1, size * 0.012);
  ctx.beginPath();
  path(ctx);
  ctx.stroke();
  ctx.restore();
}

// Stylized prow-curl: a single mirrorable hook silhouette, one eye dot.
// Deliberately abstract — no teeth, no gore.
function dragonheadPath(c, size) {
  c.moveTo(0, size * 0.5);
  c.bezierCurveTo(size * 0.05, size * 0.1, size * 0.25, -size * 0.05, size * 0.55, -size * 0.02);
  c.bezierCurveTo(size * 0.8, 0.0, size * 0.92, size * 0.12, size * 0.86, size * 0.24);
  c.bezierCurveTo(size * 0.8, size * 0.14, size * 0.68, size * 0.1, size * 0.58, size * 0.16);
  c.bezierCurveTo(size * 0.42, size * 0.26, size * 0.34, size * 0.1, size * 0.22, size * 0.12);
  c.bezierCurveTo(size * 0.14, size * 0.13, size * 0.08, size * 0.28, 0, size * 0.5);
  c.closePath();
}

function dragonhead(ctx, x, y, size, opts) {
  const mirror = opts.mirror ? -1 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(mirror, 1);
  const path = (c) => dragonheadPath(c, size);
  carveStroke(ctx, path, { width: Math.max(1.4, size * 0.028) });
  ctx.fillStyle = mix(palette.oakDeep, palette.tar, 0.4);
  ctx.beginPath();
  path(ctx);
  ctx.fill();
  ctx.strokeStyle = rgba(opts.color || palette.gold, 0.85);
  ctx.lineWidth = Math.max(1, size * 0.014);
  ctx.beginPath();
  ctx.moveTo(size * 0.05, size * 0.08);
  ctx.bezierCurveTo(size * 0.25, -size * 0.03, size * 0.55, -size * 0.0, size * 0.83, size * 0.14);
  ctx.stroke();
  ctx.fillStyle = palette.goldBright;
  ctx.beginPath();
  ctx.arc(size * 0.62, size * 0.08, Math.max(1, size * 0.02), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function ornament(ctx, kind, x, y, size, opts = {}) {
  switch (kind) {
    case 'ringknot': return ringknot(ctx, x, y, size, opts);
    case 'dragonhead': return dragonhead(ctx, x, y, size, opts);
    case 'shieldboss': return shieldboss(ctx, x, y, size, opts);
    case 'wavebord': return wavebord(ctx, x, y, size, opts);
    case 'nailhead': return nailhead(ctx, x, y, size, opts);
    default: return undefined;
  }
}

// Pure: derives a medallion's visual state from chestScene's single scalar
// progress (0..1). Sockets 1..openCount are 'open', the next is 'next',
// the rest 'sealed'.
export function medallionState(ordinal, progress) {
  const openCount = Math.round(clamp01(progress) * 15);
  if (ordinal <= openCount) return 'open';
  if (ordinal === openCount + 1) return 'next';
  return 'sealed';
}

// The medallion's revealed glyph is a cosmetic pick keyed to ordinal via the
// kernel's full 16-rune order — NOT the authoritative shard rune (that's
// kernel/shards.js's FUTHARK14 table, a shell/hasp-strip concern).
function faceRune(ordinal) {
  return ORDER[(ordinal - 1 + ORDER.length) % ORDER.length];
}

export function medallion(ctx, x, y, r, state, ordinal) {
  const reduced = prefersReducedMotion();
  carveStroke(ctx, (c) => c.arc(x, y, r, 0, Math.PI * 2), { width: Math.max(1.5, r * 0.09) });
  const ch = faceRune(ordinal);

  if (state === 'open') {
    fillGoldLayered(ctx, (c) => c.arc(x, y, r * 0.86, 0, Math.PI * 2), { x: x - r, y: y - r, w: 2 * r, h: 2 * r }, { ticks: 4 });
    drawRune(ctx, ch, x - r * 0.55, y - r * 0.55, r * 1.1, { color: palette.tar, weight: r * 0.11 });
    return;
  }

  if (state === 'next') {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const pulse = reduced ? 0 : Math.sin(now / 480) * 0.5 + 0.5;
    glowFx(ctx, x, y, r * (1.6 + pulse * 0.5), palette.ember, 0.5 + pulse * 0.4);
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, mix(palette.ember, palette.oakDeep, 0.25));
    g.addColorStop(1, mix(palette.tar, palette.ember, 0.2));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.86, 0, Math.PI * 2);
    ctx.fill();
    drawRune(ctx, ch, x - r * 0.55, y - r * 0.55, r * 1.1, {
      color: mix(palette.ember, palette.goldBright, 0.4),
      weight: r * 0.1,
      glow: reduced ? 0 : 0.3 + pulse * 0.3,
    });
    return;
  }

  // sealed
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, mix(palette.tar, palette.oakDeep, 0.4));
  g.addColorStop(1, palette.tar);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.86, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.22;
  drawRune(ctx, ch, x - r * 0.55, y - r * 0.55, r * 1.1, { color: palette.oakDeep, weight: r * 0.09 });
  ctx.restore();
}
