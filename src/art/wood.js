// paintWood: layered oak texture. Recipe (docs/ART.md floor): base plank
// fill -> growth-ring hints -> 3-5 knots -> 40-70 sine-wander grain strands
// (deflected near knots) -> pore stipple -> carved-edge vignette. Everything
// is baked once per (seed,w,h) into an offscreen canvas and cached; repaint
// is a single drawImage blit, which is what keeps chestScene's per-frame
// repaint cheap.
import { rng } from '../kernel/rng.js';
import { palette, rgba, mix } from './palette.js';

const cache = new Map();
const MAX_CACHE_ENTRIES = 3;

function texDpr() {
  const d = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  // Capped independently of the display dpr cap in makeCanvas: fine grain
  // noise doesn't need 3x sharpness, and each cached entry is large.
  return Math.max(1, Math.min(d, 2));
}

function buildKnots(r, w, h, count) {
  const knots = [];
  const minDim = Math.min(w, h);
  for (let i = 0; i < count; i++) {
    knots.push({
      x: r.range(Math.round(w * 0.1), Math.round(w * 0.9)),
      y: r.range(Math.round(h * 0.12), Math.round(h * 0.88)),
      radius: r.range(Math.round(minDim * 0.02), Math.round(minDim * 0.045)) || 4,
      rings: r.range(4, 7),
      seedAngle: r() * Math.PI * 2,
      squash: 0.72 + r() * 0.36,
    });
  }
  return knots;
}

// Nudges a grain sample point away from nearby knots so strands read as
// flowing *around* them rather than passing straight through.
function knotDeflection(x, y, knots) {
  let dy = 0;
  for (const k of knots) {
    const ddx = x - k.x;
    const ddy = y - k.y;
    const dist = Math.hypot(ddx, ddy);
    const reach = k.radius * 9;
    if (dist < reach) {
      const influence = 1 - dist / reach;
      dy += Math.sign(ddy || 1) * influence * influence * k.radius * 1.8;
    }
  }
  return dy;
}

function drawGrainStrand(ctx, r, w, knots) {
  const y0 = r() * (ctx.__h || 0);
  const amp = 3 + r() * 10;
  const freq = 0.004 + r() * 0.01;
  const phase = r() * Math.PI * 2;
  const lineW = 0.6 + r() * 2.2;
  const dark = r.chance(0.55);
  const tone = dark ? mix(palette.oakDeep, palette.oak, r() * 0.5) : mix(palette.oak, palette.oakLight, 0.4 + r() * 0.5);
  const alpha = 0.035 + r() * 0.09;
  ctx.strokeStyle = rgba(tone, alpha);
  ctx.lineWidth = lineW;
  ctx.beginPath();
  const step = Math.max(8, w / 48);
  for (let x = -step; x <= w + step; x += step) {
    const wander = Math.sin(x * freq + phase) * amp;
    const y = y0 + wander + knotDeflection(x, y0 + wander, knots);
    if (x === -step) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawKnotFeature(ctx, k) {
  ctx.save();
  ctx.translate(k.x, k.y);
  ctx.rotate(k.seedAngle * 0.15);
  ctx.scale(1, k.squash);
  for (let i = k.rings; i >= 1; i--) {
    const rad = k.radius * (1 + i * 0.85);
    const alpha = Math.max(0.03, 0.22 * (1 - i / (k.rings + 1.4)));
    ctx.strokeStyle = rgba(palette.oakDeep, alpha);
    ctx.lineWidth = 1 + i * 0.15;
    ctx.beginPath();
    const steps = 28;
    for (let s = 0; s <= steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      const ripple = 1 + Math.sin(a * 5 + k.seedAngle * 3) * 0.06 + Math.sin(a * 2 - k.seedAngle) * 0.04;
      const rr = rad * ripple;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, k.radius);
  core.addColorStop(0, rgba(palette.tar, 0.92));
  core.addColorStop(0.7, rgba(palette.oakDeep, 0.85));
  core.addColorStop(1, rgba(palette.oakDeep, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, k.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function renderWoodTexture(w, h, seed) {
  const d = texDpr();
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.round(w * d));
  off.height = Math.max(1, Math.round(h * d));
  const ctx = off.getContext('2d');
  ctx.scale(d, d);
  ctx.__h = h;
  const r = rng(`wood:${seed}`);

  // 1. base fill, gently lit, plus a handful of plank seams
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, palette.oak);
  base.addColorStop(0.5, mix(palette.oak, palette.oakLight, 0.18));
  base.addColorStop(1, palette.oak);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const planks = r.range(3, 5);
  const plankW = w / planks;
  for (let i = 1; i < planks; i++) {
    const px = i * plankW + (r() - 0.5) * plankW * 0.06;
    ctx.strokeStyle = rgba(palette.oakDeep, 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px - 0.8, 0);
    ctx.lineTo(px - 0.8, h);
    ctx.stroke();
    ctx.strokeStyle = rgba(palette.oakLight, 0.25);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 0.8, 0);
    ctx.lineTo(px + 0.8, h);
    ctx.stroke();
  }

  // 2. knots generated first so grain can be deflected around them
  const knots = buildKnots(r, w, h, r.range(3, 5));

  // 3. sparse growth-ring hint arcs
  const ringCount = r.range(3, 5);
  for (let i = 0; i < ringCount; i++) {
    const cx = r() * w;
    const cy = h * (r() < 0.5 ? -0.3 : 1.3);
    const rad = Math.min(w, h) * (0.6 + r() * 0.9);
    ctx.strokeStyle = rgba(mix(palette.oak, palette.oakDeep, 0.5), 0.05 + r() * 0.05);
    ctx.lineWidth = 1 + r() * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 4. 40-70 flow-following grain strands
  const strandCount = r.range(40, 70);
  for (let i = 0; i < strandCount; i++) drawGrainStrand(ctx, r, w, knots);

  // 5. knots rendered on top so their rings read clearly through the grain
  for (const k of knots) drawKnotFeature(ctx, k);

  // 6. pore stipple, density-capped for cache-build performance
  const poreCount = Math.min(5200, Math.round((w * h) / 55));
  for (let i = 0; i < poreCount; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = 0.3 + r() * 0.55;
    const dark = r.chance(0.75);
    ctx.fillStyle = rgba(dark ? palette.oakDeep : palette.oakLight, dark ? 0.1 + r() * 0.1 : 0.06 + r() * 0.08);
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // 7. carved-edge vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
  vg.addColorStop(0, rgba(palette.oakDeep, 0));
  vg.addColorStop(1, rgba(palette.oakDeep, 0.6));
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  return { canvas: off, w, h };
}

export function paintWood(ctx, w, h, seed = 'default', _opts = {}) {
  const key = `${seed}|${Math.round(w)}|${Math.round(h)}`;
  let entry = cache.get(key);
  if (!entry) {
    entry = renderWoodTexture(w, h, seed);
    cache.delete(key); // re-insert at the end for simple LRU-ish eviction
    cache.set(key, entry);
    if (cache.size > MAX_CACHE_ENTRIES) {
      cache.delete(cache.keys().next().value);
    }
  }
  ctx.drawImage(entry.canvas, 0, 0, w, h);
}
