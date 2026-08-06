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

// A driven rivet: seated shadow, domed gold head, single specular point. The
// dome gradient is what makes it read as proud of the surface at 200% rather
// than as a printed dot.
function nailhead(ctx, x, y, size, opts = {}) {
  const r = Math.max(1.6, size * 0.5);
  ctx.save();
  ctx.fillStyle = rgba(palette.tar, 0.55);
  ctx.beginPath();
  ctx.arc(x + r * 0.16, y + r * 0.22, r * 0.98, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  carveStroke(ctx, (c) => c.arc(x, y, r * 0.9, 0, Math.PI * 2), { width: Math.max(0.8, size * 0.045) });
  fillGoldLayered(ctx, (c) => c.arc(x, y, r * 0.7, 0, Math.PI * 2), { x: x - r, y: y - r, w: 2 * r, h: 2 * r }, { ticks: 0 });

  const dome = ctx.createRadialGradient(x - r * 0.3, y - r * 0.34, 0, x, y, r * 0.72);
  dome.addColorStop(0, rgba(palette.goldBright, 0.95));
  dome.addColorStop(0.5, rgba(palette.gold, 0.5));
  dome.addColorStop(1, rgba(mix(palette.gold, palette.tar, 0.6), 0.75));
  ctx.save();
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(palette.bone, 0.75);
  ctx.beginPath();
  ctx.arc(x - r * 0.26, y - r * 0.3, Math.max(0.5, r * 0.15), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
  // Shallow and narrow: at amp 0.14 / band 0.10 of size this read as a gold
  // hose laid over the wood rather than a channel cut into it.
  const amp = size * 0.07;
  const bandW = size * 0.08;
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
  // Worn gilding sunk in a channel: mostly the tar of the incision with a
  // little gold surviving in the groove, the way Oseberg pigment survives.
  // A bright band read as a neon worm laid across the lid.
  const base = opts.color || palette.gold;
  const bandGrad = ctx.createLinearGradient(x, y - amp - bandW, x, y + amp + bandW);
  bandGrad.addColorStop(0, mix(base, palette.tar, 0.82));
  bandGrad.addColorStop(0.5, mix(base, palette.oakDeep, 0.42));
  bandGrad.addColorStop(1, mix(base, palette.tar, 0.86));
  ctx.fillStyle = bandGrad;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = rgba(palette.goldBright, 0.2);
  ctx.lineWidth = Math.max(0.6, size * 0.006);
  ctx.beginPath();
  wavebordPath(ctx, x, y, size, amp);
  ctx.stroke();
  ctx.restore();
}

// Stylized prow-curl. A CLOSED silhouette (neck -> crown -> snout -> jaw)
// filled with a gilded gradient, carved around its outline, with a mane of
// three curls and a socketed eye. The previous version was a thin gradient
// stroke whose tones sat within a few percent of the oak behind it, so it
// vanished at game scale.
function dragonheadSilhouette(c, s) {
  c.moveTo(s * 0.02, s * 0.66);            // neck, back edge
  c.bezierCurveTo(s * -0.04, s * 0.3, s * 0.12, s * -0.02, s * 0.46, s * -0.12);
  c.bezierCurveTo(s * 0.82, s * -0.22, s * 1.06, s * 0.0, s * 0.99, s * 0.24);   // crown -> snout tip
  c.bezierCurveTo(s * 0.94, s * 0.42, s * 0.74, s * 0.42, s * 0.66, s * 0.26);   // under-snout
  c.bezierCurveTo(s * 0.6, s * 0.15, s * 0.5, s * 0.2, s * 0.46, s * 0.32);      // jaw notch
  c.bezierCurveTo(s * 0.4, s * 0.5, s * 0.3, s * 0.62, s * 0.24, s * 0.72);      // throat
  c.closePath();
}

function dragonhead(ctx, x, y, size, opts) {
  const mirror = opts.mirror ? -1 : 1;
  const s = size;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(mirror, 1);
  const path = (c) => dragonheadSilhouette(c, s);

  // drop shadow so the carving stands off the board
  ctx.save();
  ctx.translate(s * 0.035, s * 0.05);
  ctx.fillStyle = rgba(palette.tar, 0.6);
  ctx.beginPath();
  path(ctx);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  path(ctx);
  ctx.clip();
  // Carved OAK with a gilded crest — a solid-gold body read as a cartoon
  // charm rather than a prow-beast cut from the same board as the chest.
  const body = ctx.createLinearGradient(0, -s * 0.2, s * 0.9, s * 0.7);
  body.addColorStop(0, mix(palette.oakLight, palette.gold, 0.3));
  body.addColorStop(0.4, mix(palette.oak, palette.oakLight, 0.35));
  body.addColorStop(0.75, mix(palette.oakDeep, palette.oak, 0.4));
  body.addColorStop(1, mix(palette.tar, palette.oakDeep, 0.5));
  ctx.fillStyle = body;
  ctx.fillRect(-s * 0.2, -s * 0.4, s * 1.5, s * 1.3);
  // scale ticks along the crown
  ctx.strokeStyle = rgba(palette.tar, 0.4);
  ctx.lineWidth = Math.max(0.8, s * 0.016);
  for (let i = 0; i < 7; i++) {
    const t = 0.12 + i * 0.11;
    ctx.beginPath();
    ctx.moveTo(s * t, -s * 0.1 + Math.sin(i) * s * 0.02);
    ctx.lineTo(s * (t + 0.05), s * 0.14);
    ctx.stroke();
  }
  ctx.restore();

  carveStroke(ctx, path, { width: Math.max(1.4, s * 0.028) });

  // gold trim following the crown line
  ctx.save();
  ctx.strokeStyle = rgba(opts.color || palette.gold, 0.85);
  ctx.lineWidth = Math.max(0.9, s * 0.018);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s * 0.1, s * 0.5);
  ctx.bezierCurveTo(s * 0.06, s * 0.22, s * 0.2, s * 0.02, s * 0.5, s * -0.05);
  ctx.bezierCurveTo(s * 0.78, s * -0.12, s * 0.96, s * 0.04, s * 0.9, s * 0.2);
  ctx.stroke();

  // mane: three curls off the back of the neck
  for (let i = 0; i < 3; i++) {
    const o = i * s * 0.11;
    ctx.strokeStyle = rgba(palette.gold, 0.55 - i * 0.1);
    ctx.lineWidth = Math.max(0.9, s * 0.02);
    ctx.beginPath();
    ctx.moveTo(s * 0.06 + o * 0.4, s * 0.6 - o * 0.2);
    ctx.quadraticCurveTo(s * -0.12 - o, s * 0.34 - o * 0.3, s * 0.1 - o * 0.5, s * 0.08 - o * 0.4);
    ctx.stroke();
  }
  ctx.restore();

  // eye: dark socket, bright pupil, tiny highlight
  ctx.save();
  ctx.fillStyle = rgba(palette.tar, 0.95);
  ctx.beginPath();
  ctx.ellipse(s * 0.72, s * 0.09, Math.max(2.2, s * 0.062), Math.max(1.7, s * 0.046), -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.goldBright;
  ctx.beginPath();
  ctx.arc(s * 0.725, s * 0.088, Math.max(1.2, s * 0.03), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.bone;
  ctx.beginPath();
  ctx.arc(s * 0.71, s * 0.075, Math.max(0.5, s * 0.011), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

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

// A raised bezel around the disc: a thick ring stroked with a light->shade
// gradient so the top-left of the rim catches the hearth and the bottom-right
// falls away. This is the difference between "a coloured circle" and "a struck
// disc seated in a socket".
function discRim(ctx, x, y, r, lightHex, shadeHex, crestAlpha = 0.7) {
  const rimW = Math.max(1.6, r * 0.17);
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, lightHex);
  g.addColorStop(0.45, mix(lightHex, shadeHex, 0.55));
  g.addColorStop(1, shadeHex);
  ctx.save();
  ctx.strokeStyle = g;
  ctx.lineWidth = rimW;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
  ctx.stroke();
  // thin bright crest along the upper-left arc (kept dull on tar-cold discs)
  if (crestAlpha > 0.01) {
    ctx.strokeStyle = rgba(lightHex, crestAlpha);
    ctx.lineWidth = Math.max(0.7, rimW * 0.3);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.9 - rimW * 0.28, Math.PI * 0.85, Math.PI * 1.75);
    ctx.stroke();
  }
  ctx.restore();
}

// Locks 3/6/9/12/15 are barred by challengers (docs/JARLS.md — frozen cast).
// Their medallions carry the challenger's mark: a blood-painted groove ring
// in the socket, present in every state, so a duel lock is tellable at a
// glance before its banner ever shows. Cosmetic only.
const DUEL_ORDINALS = new Set([3, 6, 9, 12, 15]);

function duelMark(ctx, x, y, r, state) {
  const tone = state === 'sealed'
    ? mix(palette.blood, palette.oakDeep, 0.25)
    : mix(palette.blood, palette.ember, 0.3);
  ctx.save();
  ctx.strokeStyle = rgba(tone, state === 'open' ? 0.55 : 0.75);
  ctx.lineWidth = Math.max(1.1, r * 0.06);
  ctx.beginPath();
  ctx.arc(x, y, r * 1.06, 0, Math.PI * 2);
  ctx.stroke();
  // four short paint ticks crossing the groove — a binding cord, not a reticle
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.strokeStyle = rgba(tone, state === 'open' ? 0.6 : 0.85);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * 0.25 + (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 1.0, y + Math.sin(a) * r * 1.0);
    ctx.lineTo(x + Math.cos(a) * r * 1.11, y + Math.sin(a) * r * 1.11);
    ctx.stroke();
  }
  ctx.restore();
}

export function medallion(ctx, x, y, r, state, ordinal) {
  const reduced = prefersReducedMotion();
  const ch = faceRune(ordinal);
  // seated shadow: the disc sits INSIDE a socket, so it casts down-right
  ctx.save();
  ctx.fillStyle = rgba(palette.tar, 0.6);
  ctx.beginPath();
  ctx.arc(x + r * 0.09, y + r * 0.12, r * 0.94, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (state === 'open') {
    // GOLD-STRUCK. The disc is minted metal and the rune stands PROUD of the
    // field: a tar seat-shadow cast down-right, the gold face on top, and a
    // thin bone crest catching the key light on its upper-left edge.
    fillGoldLayered(ctx, (c) => c.arc(x, y, r * 0.88, 0, Math.PI * 2), { x: x - r, y: y - r, w: 2 * r, h: 2 * r }, { ticks: 4 });
    const field = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r * 0.8);
    field.addColorStop(0, rgba(palette.goldBright, 0.25));
    field.addColorStop(1, rgba(mix(palette.gold, palette.tar, 0.45), 0.5));
    ctx.save();
    ctx.fillStyle = field;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawRune(ctx, ch, x - r * 0.55 + r * 0.07, y - r * 0.55 + r * 0.09, r * 1.1, {
      color: rgba(palette.tar, 0.55), weight: r * 0.13,
    });
    drawRune(ctx, ch, x - r * 0.55, y - r * 0.55, r * 1.1, {
      color: mix(palette.bone, palette.goldBright, 0.3), weight: r * 0.1,
    });
    discRim(ctx, x, y, r, palette.goldBright, mix(palette.gold, palette.tar, 0.62));
    if (DUEL_ORDINALS.has(ordinal)) duelMark(ctx, x, y, r, state);
    return;
  }

  if (state === 'next') {
    // EMBER-BREATHING. A live coal: slow asymmetric breath (~4s), fissures in
    // the crust glowing with the pulse. Reduced motion holds mid-breath —
    // the light stays present, only the movement stops.
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const pulse = reduced ? 0.55 : Math.pow(Math.sin(now / 700) * 0.5 + 0.5, 1.35);
    glowFx(ctx, x, y, r * (1.7 + pulse * 0.55), palette.ember, 0.5 + pulse * 0.4);
    const g = ctx.createRadialGradient(x - r * 0.32, y - r * 0.36, r * 0.08, x, y, r);
    g.addColorStop(0, mix(palette.ember, palette.goldBright, 0.25 + pulse * 0.15));
    g.addColorStop(0.62, mix(palette.ember, palette.oakDeep, 0.4));
    g.addColorStop(1, mix(palette.tar, palette.ember, 0.28));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.88, 0, Math.PI * 2);
    ctx.fill();
    // coal fissures, deterministic per ordinal, brightening as the coal draws
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const a = ordinal * 0.73 + i * 1.257;
      const r0 = r * (0.3 + (i % 2) * 0.1);
      const r1 = r * (0.58 + (i % 3) * 0.07);
      const bend = 0.16 * ((i % 2) * 2 - 1);
      ctx.strokeStyle = rgba(mix(palette.ember, palette.goldBright, 0.3 + pulse * 0.5), 0.3 + pulse * 0.45);
      ctx.lineWidth = Math.max(0.9, r * 0.045);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
      ctx.quadraticCurveTo(
        x + Math.cos(a + bend) * (r0 + r1) * 0.55, y + Math.sin(a + bend) * (r0 + r1) * 0.55,
        x + Math.cos(a) * r1, y + Math.sin(a) * r1,
      );
      ctx.stroke();
    }
    ctx.restore();
    drawRune(ctx, ch, x - r * 0.55, y - r * 0.55, r * 1.1, {
      color: mix(palette.goldBright, palette.bone, 0.35),
      weight: r * 0.1,
      glow: reduced ? 0.3 : 0.3 + pulse * 0.3,
    });
    discRim(ctx, x, y, r, mix(palette.ember, palette.goldBright, 0.5), mix(palette.ember, palette.tar, 0.7));
    if (DUEL_ORDINALS.has(ordinal)) duelMark(ctx, x, y, r, state);
    return;
  }

  // TAR-COLD. Dark, matte, a shade colder than the wood around it — the ghost
  // rune barely surfacing through pitch. Still legibly "a place, unopened":
  // carve and ghost stay readable, but nothing on it catches the hearth.
  const g = ctx.createRadialGradient(x - r * 0.34, y - r * 0.38, r * 0.06, x, y, r);
  g.addColorStop(0, mix(palette.oakDeep, palette.tar, 0.25));
  g.addColorStop(0.55, mix(palette.tar, palette.oakDeep, 0.62));
  g.addColorStop(1, palette.tar);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.88, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.48;
  drawRune(ctx, ch, x - r * 0.55, y - r * 0.55, r * 1.1, {
    color: mix(palette.boneDim, palette.fjordLight, 0.22), weight: r * 0.09,
  });
  ctx.restore();
  discRim(ctx, x, y, r, mix(palette.oakLight, palette.tar, 0.3), palette.tar, 0.22);
  if (DUEL_ORDINALS.has(ordinal)) duelMark(ctx, x, y, r, state);
}
