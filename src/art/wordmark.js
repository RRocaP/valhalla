// wordmark(): the carved VALHALLA statement. carveText supplies the chisel
// relief; this module adds the letterform ceremony around it — measured
// tracking, a carved rule broken by a gilded diamond, and a mirrored pair of
// sól runes (the sun rune — the hearth's own light) flanking the rule.
// Deterministic, no time term; the caller sizes and places it.
import { palette, rgba, mix } from './palette.js';
import { carveStroke } from './util.js';
import { carveText } from './text.js';
import { drawRune } from './runes.js';

const FONT_STACK = `'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif`;

export function wordmark(ctx, cx, baselineY, size, opts = {}) {
  const color = opts.color || mix(palette.gold, palette.bone, 0.18);
  const tracking = Math.round(size * (opts.tracking ?? 0.3));
  const text = opts.text || 'VALHALLA';

  carveText(ctx, text, cx, baselineY, size, {
    align: 'center', depth: opts.depth ?? 1, color,
    letterSpacing: tracking, weight: 600, maxWidth: opts.maxWidth,
  });

  if (opts.rule === false) return;

  // measure the carved word so the rule sits to its measure, not to a guess
  ctx.save();
  ctx.font = `600 ${size}px ${FONT_STACK}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`;
  let wordW = ctx.measureText(text).width;
  ctx.restore();
  if (opts.maxWidth) wordW = Math.min(wordW, opts.maxWidth);

  const ruleY = baselineY + size * 0.52;
  const ruleW = wordW * 0.86;
  const gap = size * 0.34; // clearance around the centre diamond
  const ends = [cx - ruleW / 2, cx + ruleW / 2];

  // carved groove in two halves, broken by the diamond
  const lineW = Math.max(1.2, size * 0.045);
  carveStroke(ctx, (c) => {
    c.moveTo(ends[0], ruleY); c.lineTo(cx - gap, ruleY);
    c.moveTo(cx + gap, ruleY); c.lineTo(ends[1], ruleY);
  }, { width: lineW, shadowAlpha: 0.6, liftAlpha: 0.34 });
  // worn gilding surviving in the groove
  ctx.save();
  ctx.strokeStyle = rgba(palette.gold, 0.5);
  ctx.lineWidth = Math.max(0.7, lineW * 0.45);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ends[0], ruleY); ctx.lineTo(cx - gap, ruleY);
  ctx.moveTo(cx + gap, ruleY); ctx.lineTo(ends[1], ruleY);
  ctx.stroke();
  ctx.restore();

  // centre diamond: carved seat + gilded face
  const d = size * 0.15;
  const diamond = (c, s) => {
    c.moveTo(cx, ruleY - s); c.lineTo(cx + s, ruleY);
    c.lineTo(cx, ruleY + s); c.lineTo(cx - s, ruleY);
    c.closePath();
  };
  carveStroke(ctx, (c) => diamond(c, d), { width: Math.max(1, size * 0.03) });
  ctx.save();
  const dg = ctx.createLinearGradient(cx - d, ruleY - d, cx + d, ruleY + d);
  dg.addColorStop(0, palette.goldBright);
  dg.addColorStop(1, mix(palette.gold, palette.tar, 0.35));
  ctx.fillStyle = dg;
  ctx.beginPath();
  diamond(ctx, d * 0.7);
  ctx.fill();
  ctx.restore();

  // sól runes flanking the rule, the left one wend (mirrored)
  const rs = size * 0.4;
  const ro = rs * 0.62; // offset past the rule ends
  drawRune(ctx, 'ᛋ', ends[0] - ro - rs / 2, ruleY - rs * 0.52, rs, {
    color: rgba(palette.gold, 0.85), weight: Math.max(1.4, rs * 0.13), mirror: true,
  });
  drawRune(ctx, 'ᛋ', ends[1] + ro - rs / 2, ruleY - rs * 0.52, rs, {
    color: rgba(palette.gold, 0.85), weight: Math.max(1.4, rs * 0.13),
  });
}
