// carveText(): chisel-relief lettering. Never flat screen text — a faint
// upper-left shade and a low-alpha goldBright lower-right lip flank a dark
// tar edge with the (default bone) face colour on top, then a grain hint is
// composited with 'source-atop' so it only paints over the glyph pixels
// already drawn, no glyph-path extraction needed.
import { palette, rgba } from './palette.js';

// Display voice (docs/QUALITY.md Magic Law §2): embedded Cormorant Garamond,
// falling back to the old serif stack until the face loads.
const FONT_STACK = `'Cormorant Garamond','Iowan Old Style','Palatino Nova',Palatino,Georgia,serif`;

export function carveText(ctx, text, x, y, sizePx, opts = {}) {
  const color = opts.color || palette.bone;
  const depth = opts.depth ?? 0.6;
  const align = opts.align === 'center' ? 'center' : 'left';
  const maxWidth = opts.maxWidth;

  ctx.save();
  ctx.font = `${opts.weight || 600} ${sizePx}px ${FONT_STACK}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  // Display lettering in this world is widely tracked. Canvas letterSpacing is
  // recent; where it is missing the text simply renders untracked rather than
  // failing (Safari 15 is a build target).
  if (opts.letterSpacing && 'letterSpacing' in ctx) ctx.letterSpacing = `${opts.letterSpacing}px`;

  const draw = (fillStyle, ox, oy) => {
    ctx.fillStyle = fillStyle;
    if (maxWidth) ctx.fillText(text, x + ox, y + oy, maxWidth);
    else ctx.fillText(text, x + ox, y + oy);
  };

  // A chisel cut is a TIGHT rim, not an extrusion. The previous version marched
  // shade copies out to 16% of the font size, which at display sizes rendered a
  // visible second ghost of the word up-left of the face. Here: a soft dark
  // halo seated all round (the shadow the incision casts into the wood), then a
  // close shade lip above-left and a close lit lip below-right, both inside 4%
  // of the size, then the face. depth=0 collapses everything to flat.
  const halo = sizePx * 0.05 * depth;
  if (depth > 0.05) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      draw(rgba(palette.tar, 0.1 + 0.16 * depth), Math.cos(a) * halo, Math.sin(a) * halo);
    }
  }
  const reach = Math.max(0.6, sizePx * 0.028 * depth);
  for (let i = 3; i >= 1; i--) {
    const f = i / 3;
    draw(rgba(palette.tar, (0.3 + 0.55 * depth) * f), -reach * f, -reach * 1.15 * f);
  }
  for (let i = 2; i >= 1; i--) {
    const f = i / 2;
    draw(rgba(palette.goldBright, (0.16 + 0.42 * depth) * f), reach * f * 0.85, reach * 1.2 * f);
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
