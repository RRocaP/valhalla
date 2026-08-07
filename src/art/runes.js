// drawRune: renders kernel/futhark.js stroke segments as chisel cuts —
// a dark offset under-pass beneath a colour over-pass, both built as
// variable-width ribbon polygons (not ctx.lineWidth) so strokes taper near
// their true ends and stay full width through interior bends.
import { BY_CH } from '../kernel/futhark.js';
import { palette, rgba, mix, arcane, clamp01 } from './palette.js';
import { glow as glowFx, prefersReducedMotion } from './util.js';

// Rune-fire (OW-RUNEFIRE): `opts.magic` (0..1) fills the carved groove with a
// cool arcane-blue core and a soft stroke-hugging bloom; at magic >= 0.6 tiny
// flame wisps lick upward from the rune's top apexes. Sibling feature-detect:
//   import { RUNE_MAGIC_VERSION } from '.../art/runes.js'
//   drawRune(ctx, ch, x, y, size, { magic: 0..1, t: ms, reduced?: bool })
export const RUNE_MAGIC_VERSION = 1;

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

// ---- rune-fire internals ---------------------------------------------------

// Deterministic wisp anchors: the rune's top apexes (unique stroke vertices in
// the upper part of the unit box), up to 3, spread apart in x so two wisps
// never rise from the same spot. Pure — unit-box coords, cached per glyph.
const ANCHOR_CACHE = new Map();
export function wispAnchors(ch) {
  let a = ANCHOR_CACHE.get(ch);
  if (a) return a;
  const rune = BY_CH[ch];
  if (!rune) return [];
  const seen = new Map();
  for (const seg of rune.segments) {
    for (const [px, py] of seg) {
      const k = `${px.toFixed(2)},${py.toFixed(2)}`;
      if (!seen.has(k)) seen.set(k, [px, py]);
    }
  }
  const cand = [...seen.values()].filter(([, py]) => py <= 0.45).sort((p, q) => p[1] - q[1]);
  a = [];
  for (const p of cand) {
    if (a.length >= 3) break;
    if (a.every((q) => Math.abs(q[0] - p[0]) >= 0.18)) a.push(p);
  }
  ANCHOR_CACHE.set(ch, a);
  return a;
}

// Sprite cache for the expensive, static part of the treatment (bloom + core).
// Baked once per (glyph, size-bucket, weight-bucket) at 2x density, blitted
// with magic/breath-driven alpha each frame. Mirroring rides the caller's ctx
// transform, so mirrored runes share the same sprites.
const SPRITE_CACHE = new Map();
const SPRITE_MAX = 96;
const SPRITE_DENSITY = 2;

function bakeSprites(ch, size, weight) {
  const rune = BY_CH[ch];
  const pad = Math.ceil(size * 0.3 + weight);
  const px = Math.ceil((size + pad * 2) * SPRITE_DENSITY);
  const make = () => {
    const c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    const g = c.getContext('2d');
    g.scale(SPRITE_DENSITY, SPRITE_DENSITY);
    g.translate(pad, pad);
    return { c, g };
  };

  // BLOOM sprite: the strokes re-drawn far off-canvas with only their blurred
  // shadow landing in view — a soft halo that hugs the inscription instead of
  // a radial puddle floating around it. Two passes: cold wide, brighter tight.
  // Kept quiet (v2): the halo is an atmosphere the carve sits in, and must
  // never outshine the groove — v1 flooded the glyph and read as neon tube.
  const bloom = make();
  const OFF = px * 2;
  for (const [blur, colr, alpha, wMul] of [
    [size * 0.16, arcane.deep, 0.34, 1.7],
    [size * 0.06, palette.fjordLight, 0.5, 1.0],
  ]) {
    bloom.g.save();
    bloom.g.lineCap = 'round';
    bloom.g.lineJoin = 'round';
    bloom.g.strokeStyle = rgba(colr, 1);
    bloom.g.lineWidth = weight * wMul;
    bloom.g.shadowColor = rgba(colr, alpha);
    bloom.g.shadowBlur = blur * SPRITE_DENSITY; // shadowBlur is device-space
    bloom.g.shadowOffsetX = OFF;
    bloom.g.translate(-OFF / SPRITE_DENSITY, 0);
    for (const seg of rune.segments) {
      bloom.g.beginPath();
      seg.forEach(([sx, sy], i) => (i ? bloom.g.lineTo(sx * size, sy * size) : bloom.g.moveTo(sx * size, sy * size)));
      bloom.g.stroke();
    }
    bloom.g.restore();
  }

  // CORE sprite: the fire down in the cut — a vein, not a coat of paint.
  // First a scorch bed: the groove darkens toward fjord-tar where the magic
  // lives, which is what lets the blue keep its chroma instead of chalking
  // out against bone pigment (v2 read icy-grey without it). Then body, vein,
  // filament — each narrower and hotter, all inside the pigment ribbon so the
  // bone shoulders and the dark under-shadow keep reading as chisel work.
  // Ladder (v4): the WIDEST bright pass is the saturated one — full-chroma
  // fjordLight carries the magic; the bone-warm hot line is a true hairline.
  // v3 had it inverted (pale vein widest) and the whole glyph chalked to ice.
  const core = make();
  for (const seg of rune.segments) {
    const pts = seg.map(([sx, sy]) => [sx * size, sy * size]);
    core.g.fillStyle = rgba(arcane.deep, 0.9);
    fillRibbon(core.g, pts, weight * 0.9);
    core.g.fillStyle = rgba(palette.fjordLight, 0.95);
    fillRibbon(core.g, pts, weight * 0.52);
    core.g.fillStyle = rgba(arcane.bright, 0.85);
    fillRibbon(core.g, pts, weight * 0.18);
    core.g.fillStyle = rgba(arcane.flame, 0.75);
    fillRibbon(core.g, pts, Math.max(0.6, weight * 0.09));
  }

  return { bloom: bloom.c, core: core.c, pad };
}

function spritesFor(ch, size, weight) {
  const szB = Math.max(8, Math.round(size / 4) * 4);
  const wtB = Math.max(1, Math.round(weight * 2) / 2);
  const key = `${ch}|${szB}|${wtB}`;
  let s = SPRITE_CACHE.get(key);
  if (!s) {
    s = bakeSprites(ch, szB, wtB);
    s.size = szB;
    SPRITE_CACHE.set(key, s);
    if (SPRITE_CACHE.size > SPRITE_MAX) {
      SPRITE_CACHE.delete(SPRITE_CACHE.keys().next().value);
    }
  }
  return s;
}

// One flame lick: a waisted S-curve tongue — pinched just above the base,
// riding out to a bent tip. Straight-sided teardrops read as arrowheads.
function wispPath(g, ax, ay, halfW, len, sway, bend) {
  const tipX = ax + sway + bend;
  const tipY = ay - len;
  g.beginPath();
  g.moveTo(ax - halfW, ay);
  g.bezierCurveTo(ax - halfW * 0.2, ay - len * 0.3, ax + sway * 0.55 - halfW * 0.28, ay - len * 0.62, tipX, tipY);
  g.bezierCurveTo(ax + sway * 0.6 + halfW * 0.26, ay - len * 0.6, ax + halfW * 0.2, ay - len * 0.28, ax + halfW, ay);
  g.closePath();
  g.fill();
}

function drawMagic(ctx, ch, size, weight, magic, t, reduced, flameScale = 1) {
  const m = clamp01(magic);
  if (m <= 0.01) return;
  const phase = (ch.codePointAt(0) % 16) * 0.7854;
  const breathRaw = reduced ? 0.55 : Math.sin(t * 0.0017 + phase) * 0.5 + 0.5;
  const breath = Math.pow(breathRaw, 1.35);

  const s = spritesFor(ch, size, weight);
  const scale = size / s.size;
  const padU = s.pad * scale;
  const dw = (s.size + s.pad * 2) * scale;

  // coreA is CAPPED below 1 so the pigment pass always ghosts through — even
  // at magic 1.0 the glyph stays a carved rune that burns, never a light tube.
  // `over` is the overflow band (magic ≥ ~0.72): the armed-lock spectacle
  // where the fire visibly outgrows the groove (LOOP 1, Ramon: "overflowing
  // blue magick effect kind of like a flame").
  const over = clamp01((m - 0.72) / 0.28);
  const bloomA = m * m * (0.32 + 0.42 * breath) * (1 + 0.3 * over);
  const coreA = Math.min(0.94, m * 1.45) * (0.8 + 0.2 * breath);
  ctx.save();
  if (bloomA > 0.01) {
    ctx.globalAlpha = bloomA;
    ctx.drawImage(s.bloom, -padU, -padU, dw, dw);
  }
  ctx.globalAlpha = coreA;
  ctx.drawImage(s.core, -padU, -padU, dw, dw);
  ctx.restore();

  // Flame wisps — only once the magic truly burns, never under reduced
  // motion, and geometry updated on a ~30fps gate so idle frames stay cheap.
  // The size gate sits at 13px so the armed medallion still burns at phone
  // scale (LOOP 1: the couch test — the flame must read from across the room).
  const wispEase = clamp01((m - 0.6) / 0.3);
  if (reduced || wispEase <= 0.01 || size < 13) return;
  const ease = Math.sqrt(wispEase); // presence arrives early, saturates late
  // overflow: the flame envelope outgrows the groove. flameScale is the
  // caller's spectacle dial (opts.flameScale) — the lid's armed medallion
  // passes >1 so the fire reads at phone size from across the room.
  const tall = (1 + 1.15 * over) * flameScale;
  const thick = Math.sqrt(flameScale);
  // a scaled flame must also read against bright metal, not only dark wood —
  // lift the wisp alpha with the scale (capped well under opaque)
  const loud = Math.min(1.6, 1 + 0.35 * (flameScale - 1));
  const tg = Math.floor(t / 33) * 33;
  const anchors = wispAnchors(ch);
  ctx.save();
  for (let i = 0; i < anchors.length; i++) {
    const [ux, uy] = anchors[i];
    const ax = ux * size;
    // sunk into the stroke so the flame emerges FROM the groove — based at
    // the very apex it fused with the stroke's taper and read as a thorn.
    const ay = uy * size + weight * 0.55;
    // a standing lean per wisp keeps the lick flame-shaped even on a frozen
    // frame; sway breathes around that lean rather than around dead vertical
    const lean = (((i % 2) * 2 - 1) + Math.sin(phase + i)) * size * 0.018;
    const sway = lean + Math.sin(tg * 0.0031 + phase + i * 2.1) * size * 0.04;
    const flick = 0.7 + 0.3 * Math.sin(tg * 0.0093 + phase * 1.3 + i * 1.7);
    const len = size * (0.14 + 0.08 * flick) * ease * tall;
    const bend = lean * 1.5 + Math.sin(tg * 0.0052 + i * 2.6) * size * 0.02;
    ctx.fillStyle = rgba(palette.fjordLight, Math.min(0.85, 0.5 * ease * flick * loud));
    wispPath(ctx, ax, ay, Math.max(1, weight * 0.4 * thick), len, sway, bend);
    ctx.fillStyle = rgba(arcane.flame, Math.min(0.92, 0.66 * ease * flick * loud));
    wispPath(ctx, ax, ay, Math.max(0.6, weight * 0.22 * thick), len * 0.72, sway * 0.85, bend * 0.75);
    if (over > 0.4) {
      // a brighter heart lick inside the tall flame, so the overflow reads
      // as living fire rather than a longer blue thorn
      ctx.fillStyle = rgba(arcane.bright, 0.5 * over * flick);
      wispPath(ctx, ax, ay, Math.max(0.5, weight * 0.14 * thick), len * 0.5, sway * 0.7, bend * 0.6);
    }
  }
  if (over > 0.4) {
    // stray embers rising off the fire — deterministic drift on the same
    // 30fps gate, two at most, dying above the glyph
    for (let i = 0; i < 2; i++) {
      const cycle = 1400 + i * 380;
      const k = ((tg + phase * 500 + i * 700) % cycle) / cycle;
      const [ux, uy] = anchors[i % anchors.length] || [0.5, 0.1];
      const ex = ux * size + Math.sin(tg * 0.004 + i * 3) * size * 0.06;
      const ey = uy * size - k * size * (0.34 + 0.18 * i) * tall;
      const die = 1 - k;
      ctx.fillStyle = rgba(arcane.flame, 0.55 * over * die * die);
      ctx.beginPath();
      ctx.arc(ex, ey, Math.max(0.7, weight * 0.16) * (0.6 + 0.4 * die), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ---- public draw -------------------------------------------------------------

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

  if (opts.magic) {
    const reduced = opts.reduced ?? prefersReducedMotion();
    drawMagic(ctx, ch, size, weight, opts.magic, opts.t || 0, reduced, opts.flameScale || 1);
  }
  ctx.restore();
}
