// Shared rendering + geometry helpers used across the art module.
// segIntersect is pure (no ctx) so the knot interlace math is unit-testable.
import { palette, rgba } from './palette.js';

// Three-pass "carved into the wood" line: a dark shadow lip offset against
// the light direction, a warm catch-light lip offset with it, and a thin
// crisp core incision on top. Reused for panel borders, medallion sockets,
// ornament outlines, and the portrait arch rim.
export function carveStroke(ctx, pathFn, opts = {}) {
  const {
    width = 2,
    shadowColor = palette.tar,
    liftColor = palette.oakLight,
    coreColor = palette.tar,
    dx = 0.9,
    dy = 1.1,
    shadowAlpha = 0.55,
    liftAlpha = 0.4,
    coreAlpha = 0.9,
  } = opts;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.translate(-dx, -dy);
  ctx.strokeStyle = rgba(shadowColor, shadowAlpha);
  ctx.lineWidth = width * 2.1;
  ctx.beginPath();
  pathFn(ctx);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.translate(dx, dy);
  ctx.strokeStyle = rgba(liftColor, liftAlpha);
  ctx.lineWidth = width * 1.6;
  ctx.beginPath();
  pathFn(ctx);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(coreColor, coreAlpha);
  ctx.lineWidth = width;
  ctx.beginPath();
  pathFn(ctx);
  ctx.stroke();
  ctx.restore();
}

export function glow(ctx, x, y, r, color, strength = 1) {
  if (r <= 0 || strength <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, 0.9 * strength));
  g.addColorStop(0.35, rgba(color, 0.45 * strength));
  g.addColorStop(1, rgba(color, 0));
  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function prefersReducedMotion() {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const EPS = 1e-6;

// Strict-interior segment intersection: p1->p2 vs p3->p4. Returns null for
// parallel/coincident segments or crossings at/near either endpoint (so a
// shared vertex between adjacent or closing segments never registers as a
// false "crossing").
export function segIntersect(p1, p2, p3, p4) {
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const [x3, y3] = p3;
  const [x4, y4] = p4;
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (Math.abs(d) < EPS) return null;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) return null;
  return { t, u, x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
}

export const lerp = (a, b, t) => a + (b - a) * t;
