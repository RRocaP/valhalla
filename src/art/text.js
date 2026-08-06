// carveText(): chisel-relief lettering. Never flat screen text — a faint
// upper-left shade and a low-alpha goldBright lower-right lip flank a dark
// tar edge with the (default bone) face colour on top, then a grain hint is
// composited with 'source-atop' so it only paints over the glyph pixels
// already drawn, no glyph-path extraction needed.
import { palette, rgba } from './palette.js';

const FONT_STACK = `'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif`;

export function carveText(ctx, text, x, y, sizePx, opts = {}) {
  const color = opts.color || palette.bone;
  const depth = opts.depth ?? 0.6;
  const align = opts.align === 'center' ? 'center' : 'left';
  const maxWidth = opts.maxWidth;

  ctx.save();
  ctx.font = `600 ${sizePx}px ${FONT_STACK}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';

  const draw = (fillStyle, ox, oy) => {
    ctx.fillStyle = fillStyle;
    if (maxWidth) ctx.fillText(text, x + ox, y + oy, maxWidth);
    else ctx.fillText(text, x + ox, y + oy);
  };

  // Stepped "extrusion" instead of a single 1px offset: several stacked
  // copies marching toward the shade/lip directions read as a real trench
  // at depth, where a single-pixel double-pass would vanish under the core
  // fill. depth=0 collapses every step to (0,0), i.e. flat.
  const shadeSteps = 5;
  const shadeReach = sizePx * 0.16 * depth;
  for (let i = shadeSteps; i >= 1; i--) {
    const f = i / shadeSteps;
    draw(rgba(palette.tar, (0.18 + 0.5 * depth) * (0.55 + 0.45 * f)), -shadeReach * f, -shadeReach * 1.1 * f);
  }
  const lipSteps = 3;
  const lipReach = sizePx * 0.1 * depth;
  for (let i = lipSteps; i >= 1; i--) {
    const f = i / lipSteps;
    draw(rgba(palette.goldBright, (0.12 + 0.3 * depth) * f), lipReach * f, lipReach * 1.15 * f);
  }
  draw(color, 0, 0);

  if (depth > 0.15) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const metrics = ctx.measureText(text);
    const textW = maxWidth ? Math.min(maxWidth, metrics.width) : metrics.width;
    const left = align === 'center' ? x - textW / 2 : x;
    const lines = 3;
    for (let i = 0; i < lines; i++) {
      const ly = y - sizePx * (0.32 - i * 0.14);
      ctx.strokeStyle = rgba(i % 2 ? palette.oakDeep : palette.oakLight, 0.16 * depth);
      ctx.lineWidth = Math.max(0.6, sizePx * 0.02);
      ctx.beginPath();
      ctx.moveTo(left, ly);
      ctx.lineTo(left + textW, ly + Math.sin(i) * 1.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}
