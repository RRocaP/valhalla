// paintWood: layered oak texture. Recipe (docs/ART.md floor, exceeded here):
// per-plank base fills -> cathedral/arch figure -> flow-following grain strands
// (deflected near knots) -> knots with ring ripples -> fine fibre pass ->
// directional pore ticks -> plank seam trenches with lit lips -> sheen bands ->
// carved-edge vignette. Everything is baked once per (seed,w,h,opts) into an
// offscreen canvas and cached; repaint is a single drawImage blit, which is
// what keeps chestScene's per-frame repaint cheap.
import { rng } from '../kernel/rng.js';
import { palette, rgba, mix } from './palette.js';

const cache = new Map();
// Six: the shell paints threshold, lid, chest body, lock room, finale and
// credits at distinct (seed,size) pairs — a 3-entry cache thrashed between
// screens and re-baked the texture on every navigation.
const MAX_CACHE_ENTRIES = 6;

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
      x: r.range(Math.round(w * 0.08), Math.round(w * 0.92)),
      y: r.range(Math.round(h * 0.1), Math.round(h * 0.9)),
      radius: r.range(Math.round(minDim * 0.018), Math.round(minDim * 0.042)) || 4,
      rings: r.range(6, 11),
      seedAngle: r() * Math.PI * 2,
      squash: 0.6 + r() * 0.5,
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
    const reach = k.radius * 10;
    if (dist < reach) {
      const influence = 1 - dist / reach;
      dy += Math.sign(ddy || 1) * influence * influence * k.radius * 2.6;
    }
  }
  return dy;
}

// One grain strand. Two superposed sines (a slow sweep and a faster wobble)
// give the irregular wander real oak has; a single sine reads as corduroy.
function drawGrainStrand(ctx, r, w, h, knots, opts) {
  const y0 = r() * h;
  const amp = 4 + r() * 16;
  const amp2 = 1 + r() * 5;
  const freq = 0.0022 + r() * 0.008;
  const freq2 = 0.012 + r() * 0.03;
  const phase = r() * Math.PI * 2;
  const phase2 = r() * Math.PI * 2;
  const lineW = 0.6 + r() * 3.0;
  const dark = r.chance(0.72);
  const tone = dark
    ? mix(palette.oakDeep, palette.tar, r() * 0.55)
    : mix(palette.oakLight, palette.bone, r() * 0.12);
  // Alpha lifted well above the old 0.07-0.18 (which averaged out to a flat
  // brown field), but the LIGHT strands stay restrained — a bright majority
  // lifted the whole board out of the oakDeep-anchored palette into walnut.
  const alpha = dark ? 0.16 + r() * 0.28 : 0.06 + r() * 0.1;
  ctx.strokeStyle = rgba(tone, alpha * (opts.grainAlpha ?? 1));
  ctx.lineWidth = lineW;
  // Roughly half the strands run only part of the board's width. Full-width
  // strands everywhere read as machine-cut veneer corduroy, not sawn oak.
  const partial = r.chance(0.55);
  const x0 = partial ? r() * w * 0.7 : 0;
  const x1 = partial ? x0 + w * (0.15 + r() * 0.5) : w;
  ctx.beginPath();
  const step = Math.max(5, w / 90);
  let first = true;
  for (let x = x0 - step; x <= x1 + step; x += step) {
    const wander = Math.sin(x * freq + phase) * amp + Math.sin(x * freq2 + phase2) * amp2;
    const y = y0 + wander + knotDeflection(x, y0 + wander, knots);
    if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// The flat-sawn "cathedral" figure: nested pointed arches, the single most
// recognisable oak signature and the thing whose absence made the old pass
// read as generic brown.
function drawCathedral(ctx, r, w, h, opts) {
  const cx = r() * w;
  const cy = h * (0.15 + r() * 0.7);
  const width = w * (0.1 + r() * 0.22);
  const height = h * (0.25 + r() * 0.55);
  const layers = 7 + Math.floor(r() * 7);
  const up = r.chance(0.5) ? -1 : 1;
  for (let i = 0; i < layers; i++) {
    const f = (i + 1) / layers;
    const hw = width * f;
    const hh = height * f;
    const dark = i % 2 === 0;
    ctx.strokeStyle = rgba(
      dark ? mix(palette.oakDeep, palette.tar, 0.3) : mix(palette.oakLight, palette.bone, 0.12),
      (dark ? 0.16 : 0.1) * (1 - f * 0.45) * (opts.grainAlpha ?? 1),
    );
    ctx.lineWidth = 0.7 + r() * 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy + up * hh * 0.06);
    ctx.bezierCurveTo(cx - hw * 0.72, cy - up * hh * 0.5, cx - hw * 0.3, cy - up * hh, cx, cy - up * hh);
    ctx.bezierCurveTo(cx + hw * 0.3, cy - up * hh, cx + hw * 0.72, cy - up * hh * 0.5, cx + hw, cy + up * hh * 0.06);
    ctx.stroke();
  }
}

function drawKnotFeature(ctx, k, opts) {
  ctx.save();
  ctx.translate(k.x, k.y);
  ctx.rotate(k.seedAngle * 0.15);
  ctx.scale(1, k.squash);
  // warm halo: the compressed grain around a knot catches more light
  const halo = ctx.createRadialGradient(0, 0, k.radius, 0, 0, k.radius * 7);
  halo.addColorStop(0, rgba(palette.oakLight, 0.2 * (opts.grainAlpha ?? 1)));
  halo.addColorStop(1, rgba(palette.oakLight, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, k.radius * 7, 0, Math.PI * 2);
  ctx.fill();

  for (let i = k.rings; i >= 1; i--) {
    const rad = k.radius * (1 + i * 0.62);
    // Alternating light/dark rings: real ring ripple, not a fading grey wash.
    const dark = i % 2 === 0;
    const alpha = Math.max(0.05, (dark ? 0.42 : 0.2) * (1 - i / (k.rings + 2.2)));
    ctx.strokeStyle = rgba(dark ? palette.tar : palette.oakLight, alpha * (opts.grainAlpha ?? 1));
    ctx.lineWidth = 0.8 + i * 0.2;
    ctx.beginPath();
    const steps = 40;
    for (let s = 0; s <= steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      const ripple = 1
        + Math.sin(a * 5 + k.seedAngle * 3) * 0.09
        + Math.sin(a * 2 - k.seedAngle) * 0.06
        + Math.sin(a * 9 + i) * 0.03;
      const rr = rad * ripple;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }
  const core = ctx.createRadialGradient(-k.radius * 0.2, -k.radius * 0.2, 0, 0, 0, k.radius);
  core.addColorStop(0, rgba(palette.tar, 1));
  core.addColorStop(0.55, rgba(palette.tar, 0.92));
  core.addColorStop(0.86, rgba(palette.oakDeep, 0.8));
  core.addColorStop(1, rgba(palette.oakDeep, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, k.radius * 1.05, 0, Math.PI * 2);
  ctx.fill();
  // catch light on the knot's lower-right shoulder — makes it read as a
  // proud, slightly domed plug rather than a soft blur.
  ctx.strokeStyle = rgba(palette.oakLight, 0.5);
  ctx.lineWidth = Math.max(0.8, k.radius * 0.14);
  ctx.beginPath();
  ctx.arc(0, 0, k.radius * 1.02, Math.PI * 0.05, Math.PI * 0.75);
  ctx.stroke();
  ctx.restore();
}

function renderWoodTexture(w, h, seed, opts) {
  const d = texDpr();
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.round(w * d));
  off.height = Math.max(1, Math.round(h * d));
  const ctx = off.getContext('2d');
  ctx.scale(d, d);
  const r = rng(`wood:${seed}`);
  const area = w * h;
  const grainAlpha = opts.grainAlpha ?? 1;

  // 1. per-plank base fills. Each board is milled from a different billet, so
  // each gets its own tone — a single field gradient is what made the old
  // pass read as one flat sheet of brown.
  const planks = opts.planks || r.range(3, 6);
  const plankEdges = [0];
  for (let i = 1; i < planks; i++) plankEdges.push((w / planks) * i + (r() - 0.5) * (w / planks) * 0.22);
  plankEdges.push(w);

  for (let i = 0; i < planks; i++) {
    const x0 = plankEdges[i];
    const x1 = plankEdges[i + 1];
    // Tone jitter stays narrow and biased dark: the palette's `oak` is the
    // board field, and a wide jitter pushed the whole surface up into a light
    // milk-brown that no longer read as the oakDeep-anchored world.
    const warm = (r() - 0.5) * 0.16;
    const tone = warm > 0
      ? mix(palette.oak, palette.oakLight, warm)
      : mix(palette.oak, palette.oakDeep, -warm * 2.4);
    const g = ctx.createLinearGradient(x0, 0, x1, h);
    g.addColorStop(0, mix(tone, palette.oakDeep, 0.3));
    g.addColorStop(0.42, tone);
    g.addColorStop(1, mix(tone, palette.oakDeep, 0.38));
    ctx.fillStyle = g;
    ctx.fillRect(x0 - 1, 0, x1 - x0 + 2, h);
  }

  // 2. knots first so the grain can be deflected around them
  const knots = buildKnots(r, w, h, opts.knots ?? r.range(4, 7));

  // 3. cathedral figure, one or two per plank
  const cathedrals = Math.max(2, Math.round(planks * 1.4));
  for (let i = 0; i < cathedrals; i++) drawCathedral(ctx, r, w, h, { grainAlpha });

  // 4. flow-following grain strands. Density scales with area so a small
  // panel and a full board carry the same visual grain frequency.
  const strandCount = Math.max(70, Math.min(340, Math.round(area / 2600)));
  for (let i = 0; i < strandCount; i++) drawGrainStrand(ctx, r, w, h, knots, { grainAlpha });

  // 5. knots on top so their rings read clearly through the grain
  for (const k of knots) drawKnotFeature(ctx, k, { grainAlpha });

  // 6. fine fibre pass — hairlines at high frequency. This is the layer the
  // eye reads as "milled surface" when you put your nose on the screen.
  const fibres = Math.max(120, Math.min(560, Math.round(area / 1700)));
  ctx.lineWidth = 0.5;
  for (let i = 0; i < fibres; i++) {
    const fy = r() * h;
    const fx = r() * w;
    const len = 20 + r() * 150;
    const dark = r.chance(0.72);
    ctx.strokeStyle = rgba(dark ? palette.tar : palette.bone, (dark ? 0.11 : 0.03) * grainAlpha);
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + len, fy + (r() - 0.5) * 3);
    ctx.stroke();
  }

  // 7. pores — short ticks ALONG the grain, not round dots. Oak is
  // ring-porous; the open vessels are what you actually see at 200%.
  const poreCount = Math.min(16000, Math.round(area / 26));
  for (let i = 0; i < poreCount; i++) {
    const x = r() * w;
    const y = r() * h;
    const len = 1.1 + r() * 3.4;
    const dark = r.chance(0.74);
    ctx.strokeStyle = rgba(dark ? palette.tar : palette.oakLight, (dark ? 0.3 + r() * 0.3 : 0.16 + r() * 0.18) * grainAlpha);
    ctx.lineWidth = 0.5 + r() * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (r() - 0.5) * 1.1);
    ctx.stroke();
  }

  // 8. plank seams: a real trench (dark core + soft shoulder) with a lit lower
  // lip, plus a narrow shading gradient into each neighbouring board.
  for (let i = 1; i < planks; i++) {
    const px = plankEdges[i];
    const shade = ctx.createLinearGradient(px - 14, 0, px + 14, 0);
    shade.addColorStop(0, rgba(palette.oakDeep, 0));
    shade.addColorStop(0.45, rgba(palette.oakDeep, 0.42));
    shade.addColorStop(0.55, rgba(palette.oakDeep, 0.34));
    shade.addColorStop(1, rgba(palette.oakDeep, 0));
    ctx.fillStyle = shade;
    ctx.fillRect(px - 14, 0, 28, h);

    ctx.strokeStyle = rgba(palette.tar, 0.85);
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
    ctx.stroke();

    ctx.strokeStyle = rgba(palette.oakLight, 0.34);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(px + 1.8, 0);
    ctx.lineTo(px + 1.8, h);
    ctx.stroke();
  }

  // 9. sheen: broad chatoyance bands. Waxed oak under hearth-light is not
  // uniformly lit — this is the layer that stops the field reading as paint.
  // Kept low: at 0.07-0.14 the bands lifted the whole field a stop.
  const sheenCount = 3 + Math.floor(r() * 3);
  for (let i = 0; i < sheenCount; i++) {
    const sy = r() * h;
    const sh = h * (0.12 + r() * 0.3);
    const g = ctx.createLinearGradient(0, sy - sh, 0, sy + sh);
    g.addColorStop(0, rgba(palette.oakLight, 0));
    g.addColorStop(0.5, rgba(palette.oakLight, 0.03 + r() * 0.04));
    g.addColorStop(1, rgba(palette.oakLight, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, sy - sh, w, sh * 2);
  }
  const key = ctx.createLinearGradient(0, 0, w * 0.9, h);
  key.addColorStop(0, rgba(palette.ember, 0.035));
  key.addColorStop(0.45, rgba(palette.oakDeep, 0.06));
  key.addColorStop(1, rgba(palette.tar, 0.2));
  ctx.fillStyle = key;
  ctx.fillRect(0, 0, w, h);

  // 10. carved-edge vignette — weighted to the lower edge like real hearth
  // light. 0.6 crushed the grain it was meant to frame; 0.44 let the field
  // float. 0.54 keeps the corners in shadow with the figure still readable.
  const vStrength = opts.vignette ?? 0.54;
  const vg = ctx.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.3, w / 2, h * 0.52, Math.max(w, h) * 0.78);
  vg.addColorStop(0, rgba(palette.oakDeep, 0));
  vg.addColorStop(1, rgba(palette.oakDeep, vStrength));
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  // 11. optional overall shade, baked in so callers that want a darker board
  // (every full-bleed backdrop, so the lid's chest stays the lit focal object)
  // pay nothing per frame for it.
  if (opts.shade) {
    ctx.fillStyle = rgba(palette.tar, opts.shade);
    ctx.fillRect(0, 0, w, h);
  }

  return { canvas: off, w, h };
}

export function paintWood(ctx, w, h, seed = 'default', opts = {}) {
  const key = `${seed}|${Math.round(w)}|${Math.round(h)}|${opts.vignette ?? ''}|${opts.grainAlpha ?? ''}|${opts.planks ?? ''}|${opts.knots ?? ''}|${opts.shade ?? ''}`;
  let entry = cache.get(key);
  if (!entry) {
    entry = renderWoodTexture(w, h, seed, opts);
    cache.delete(key); // re-insert at the end for simple LRU-ish eviction
    cache.set(key, entry);
    if (cache.size > MAX_CACHE_ENTRIES) {
      cache.delete(cache.keys().next().value);
    }
  }
  ctx.drawImage(entry.canvas, 0, 0, w, h);
}
