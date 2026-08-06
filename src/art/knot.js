// drawKnot: a genuine over/under interlace, not a z-order trick. We find
// every self-crossing of the polyline, walk the path in order alternating
// an over/under flag at each crossing encountered (the standard rule for
// rendering Celtic/Norse knotwork), then cut a small gap around each
// crossing on the strand assigned "under" there. The "over" strand is drawn
// fully continuous through the same point, so which strand reads as on top
// falls out of the geometry — no draw-order bookkeeping needed.
import { segIntersect } from './util.js';
import { palette, rgba, mix } from './palette.js';

export function computeInterlace(points) {
  const n = points.length;
  const crossings = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 2; j < n - 1; j++) {
      const hit = segIntersect(points[i], points[i + 1], points[j], points[j + 1]);
      if (hit) crossings.push({ segA: i, tA: hit.t, segB: j, tB: hit.u, x: hit.x, y: hit.y });
    }
  }
  const events = [];
  crossings.forEach((c, idx) => {
    events.push({ seg: c.segA, t: c.tA, cross: idx });
    events.push({ seg: c.segB, t: c.tB, cross: idx });
  });
  events.sort((a, b) => a.seg - b.seg || a.t - b.t);

  const perSeg = Array.from({ length: Math.max(0, n - 1) }, () => []);
  events.forEach((e, i) => {
    perSeg[e.seg].push({ t: e.t, over: i % 2 === 0 });
  });
  perSeg.forEach((arr) => arr.sort((a, b) => a.t - b.t));
  return { crossings, perSeg };
}

function lerpPoint(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function drawKnot(ctx, points, opts = {}) {
  const width = opts.width || 10;
  const baseColor = opts.color || palette.gold;
  const gapHalf = (opts.gapAtCrossings ?? width * 1.4) / 2;
  const n = points.length;
  if (n < 2) return;
  const { perSeg } = computeInterlace(points);

  // One gradient across the whole strand's bounding box (not a flat fill)
  // so it reads as a rounded, lit cord rather than a solid-colour ribbon.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of points) {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  const cordGrad = ctx.createLinearGradient(minX, minY, maxX, maxY);
  cordGrad.addColorStop(0, mix(baseColor, palette.goldBright, 0.55));
  cordGrad.addColorStop(0.5, baseColor);
  cordGrad.addColorStop(1, mix(baseColor, palette.tar, 0.35));

  const drawSub = (a, b) => {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.translate(0.9, 1.2);
    ctx.strokeStyle = rgba(palette.tar, 0.68);
    ctx.lineWidth = width * 1.3;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = cordGrad;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.restore();

    // thin specular streak so the cord reads as round, not flat
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(palette.goldBright, 0.4);
    ctx.lineWidth = Math.max(1, width * 0.22);
    ctx.beginPath();
    ctx.moveTo(a[0] - 0.7, a[1] - 1.1);
    ctx.lineTo(b[0] - 0.7, b[1] - 1.1);
    ctx.stroke();
    ctx.restore();
  };

  for (let i = 0; i < n - 1; i++) {
    const segStart = points[i];
    const segEnd = points[i + 1];
    const segLen = Math.hypot(segEnd[0] - segStart[0], segEnd[1] - segStart[1]) || 1;
    const gapT = gapHalf / segLen;
    const gaps = perSeg[i] || [];
    let cursor = 0;
    const drawIntervals = [];
    for (const g of gaps) {
      if (!g.over) {
        const t0 = Math.max(0, g.t - gapT);
        const t1 = Math.min(1, g.t + gapT);
        if (t0 > cursor) drawIntervals.push([cursor, t0]);
        cursor = Math.max(cursor, t1);
      }
    }
    if (cursor < 1) drawIntervals.push([cursor, 1]);
    for (const [t0, t1] of drawIntervals) {
      if (t1 - t0 < 1e-4) continue;
      drawSub(lerpPoint(segStart, segEnd, t0), lerpPoint(segStart, segEnd, t1));
    }
  }
}
