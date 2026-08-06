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
    width: opts.width || size * 0.065,
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

// A real carved channel — two wavy edges (each an incision) with a filled
// gilded band between them, not a single thin line, so it reads as a border
// with mass rather than a squiggle.
function wavebord(ctx, x, y, size, opts) {
  const amp = size * 0.14;
  const bandW = size * 0.1;
  const topEdge = (c) => wavebordPath(c, x, y - bandW / 2, size, amp);
  const botEdge = (c) => wavebordPath(c, x, y + bandW / 2, size, amp);

  carveStroke(ctx, topEdge, { width: Math.max(1.4, size * 0.03) });
  carveStroke(ctx, botEdge, { width: Math.max(1.4, size * 0.03) });

  ctx.save();
  ctx.beginPath();
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const px = x + (size * i) / steps;
    const py = y - bandW / 2 + Math.sin((i / steps) * Math.PI * 2) * amp;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  for (let i = steps; i >= 0; i--) {
    const px = x + (size * i) / steps;
    const py = y + bandW / 2 + Math.sin((i / steps) * Math.PI * 2) * amp;
    ctx.lineTo(px, py);
  }
  ctx.closePath();
  const base = opts.color || palette.gold;
  const bandGrad = ctx.createLinearGradient(x, y - amp - bandW, x, y + amp + bandW);
  bandGrad.addColorStop(0, mix(base, palette.tar, 0.3));
  bandGrad.addColorStop(0.5, mix(base, palette.goldBright, 0.35));
  bandGrad.addColorStop(1, mix(base, palette.tar, 0.4));
  ctx.fillStyle = bandGrad;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = rgba(palette.goldBright, 0.7);
  ctx.lineWidth = Math.max(1, size * 0.014);
  ctx.beginPath();
  wavebordPath(ctx, x, y, size, amp);
  ctx.stroke();
  ctx.restore();
}

// Stylized prow-curl: a thick tapering hook rendered as a carved + gradient
// stroke (not a thin fill blob, which read as invisible against the wood),
// one gold trim line, one eye dot. Deliberately abstract — no teeth, no gore.
function dragonheadSpine(c, size) {
  c.moveTo(size * 0.06, size * 0.62);
  c.bezierCurveTo(size * 0.02, size * 0.32, size * 0.16, size * 0.02, size * 0.5, -size * 0.06);
  c.bezierCurveTo(size * 0.8, -size * 0.13, size * 0.99, size * 0.03, size * 0.93, size * 0.22);
  c.bezierCurveTo(size * 0.89, size * 0.36, size * 0.72, size * 0.33, size * 0.64, size * 0.18);
}

function dragonhead(ctx, x, y, size, opts) {
  const mirror = opts.mirror ? -1 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(mirror, 1);
  const path = (c) => dragonheadSpine(c, size);

  carveStroke(ctx, path, { width: Math.max(3, size * 0.19) });

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const bodyGrad = ctx.createLinearGradient(0, -size * 0.13, size * 0.75, size * 0.5);
  bodyGrad.addColorStop(0, mix(palette.oakLight, palette.gold, 0.15));
  bodyGrad.addColorStop(0.55, palette.oak);
  bodyGrad.addColorStop(1, mix(palette.oakDeep, palette.tar, 0.5));
  ctx.strokeStyle = bodyGrad;
  ctx.lineWidth = Math.max(4, size * 0.15);
  ctx.beginPath();
  path(ctx);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = rgba(opts.color || palette.gold, 0.85);
  ctx.lineWidth = Math.max(1.2, size * 0.022);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(size * 0.09, size * 0.5);
  ctx.bezierCurveTo(size * 0.07, size * 0.27, size * 0.19, size * 0.03, size * 0.5, -size * 0.03);
  ctx.bezierCurveTo(size * 0.76, -size * 0.09, size * 0.93, size * 0.04, size * 0.88, size * 0.18);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = palette.goldBright;
  ctx.beginPath();
  ctx.arc(size * 0.855, size * 0.19, Math.max(1.6, size * 0.03), 0, Math.PI * 2);
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

  // sealed — dark and inert, but the carve + a ghost rune must still read as
  // "something is here, unopened," not as nothing rendered.
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, mix(palette.tar, palette.oakDeep, 0.55));
  g.addColorStop(1, palette.tar);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.86, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.32;
  drawRune(ctx, ch, x - r * 0.55, y - r * 0.55, r * 1.1, { color: palette.boneDim, weight: r * 0.09 });
  ctx.restore();
}
