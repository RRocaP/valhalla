// chestScene: the full lid composition, self-contained (paints its own wood
// backdrop rather than assuming the shell always supplies one behind it).
// The frozen signature carries only a scalar `progress`, not a 15-element
// state array, so each socket's visual state is derived via medallionState
// and rendered through the same exported medallion() used standalone.
//
// treasureFrame: the finale's carved + gilded frame. No image/dataUri param
// in the frozen signature — compositing the actual treasure image is a
// shell-side concern; this renders the ornamental surround only.
import { palette, rgba, mix, clamp01 } from './palette.js';
import { carveStroke, glow as glowFx, prefersReducedMotion } from './util.js';
import { paintWood } from './wood.js';
import { strokeGoldLayered } from './gold.js';
import { medallion, medallionState, ornament } from './ornaments.js';

const LID_SEED = 'oathwood-lid';

function ironStrap(ctx, x1, y1, x2, y2, width) {
  const path = (c) => {
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
  };
  // Iron has no dedicated palette token: dark tar base with a cool boneDim
  // catch-light (never gold/goldBright, which stay reserved for gold fittings).
  carveStroke(ctx, path, {
    width: width * 1.3,
    shadowColor: palette.tar,
    liftColor: palette.boneDim,
    shadowAlpha: 0.6,
    liftAlpha: 0.22,
  });
  ctx.save();
  const grad = ctx.createLinearGradient(x1, y1, x2, y2);
  grad.addColorStop(0, mix(palette.tar, palette.oakDeep, 0.3));
  grad.addColorStop(0.5, mix(palette.tar, palette.boneDim, 0.18));
  grad.addColorStop(1, mix(palette.tar, palette.oakDeep, 0.3));
  ctx.strokeStyle = grad;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  path(ctx);
  ctx.stroke();
  ctx.restore();
}

function bodyPath(c, left, top, w, h, inset = 0) {
  const rr = 14;
  c.moveTo(left + inset + rr, top + inset);
  c.lineTo(left + w - inset - rr, top + inset);
  c.quadraticCurveTo(left + w - inset, top + inset, left + w - inset, top + inset + rr);
  c.lineTo(left + w - inset, top + h - inset - rr);
  c.quadraticCurveTo(left + w - inset, top + h - inset, left + w - inset - rr, top + h - inset);
  c.lineTo(left + inset + rr, top + h - inset);
  c.quadraticCurveTo(left + inset, top + h - inset, left + inset, top + h - inset - rr);
  c.lineTo(left + inset, top + inset + rr);
  c.quadraticCurveTo(left + inset, top + inset, left + inset + rr, top + inset);
  c.closePath();
}

export function chestScene(ctx, w, h, t = 0, progress = 0) {
  const reduced = prefersReducedMotion();
  const time = reduced ? 0 : t;
  const p = clamp01(progress);

  paintWood(ctx, w, h, LID_SEED);

  const cx = w / 2;
  const cy = h * 0.52;
  const chestW = Math.min(w * 0.82, h * 1.5);
  const chestH = chestW * 0.6;
  const left = cx - chestW / 2;
  const top = cy - chestH / 2;

  // the chest itself reads as a distinct crafted object: its own grain pass
  ctx.save();
  ctx.beginPath();
  bodyPath(ctx, left, top, chestW, chestH, 0);
  ctx.clip();
  ctx.fillStyle = mix(palette.oak, palette.oakDeep, 0.3);
  ctx.fillRect(left, top, chestW, chestH);
  ctx.translate(left, top);
  paintWood(ctx, chestW, chestH, `${LID_SEED}-body`);
  ctx.restore();
  carveStroke(ctx, (c) => bodyPath(c, left, top, chestW, chestH, 0), { width: Math.max(2, chestW * 0.006) });

  const seams = 4;
  for (let i = 1; i < seams; i++) {
    const sx = left + (chestW * i) / seams;
    carveStroke(ctx, (c) => {
      c.moveTo(sx, top + 10);
      c.lineTo(sx, top + chestH - 10);
    }, { width: Math.max(1, chestW * 0.0035), shadowAlpha: 0.35, liftAlpha: 0.18 });
  }

  const strapLen = chestW * 0.16;
  const strapW = Math.max(4, chestW * 0.018);
  [
    [left, top, 1, 1],
    [left + chestW, top, -1, 1],
    [left, top + chestH, 1, -1],
    [left + chestW, top + chestH, -1, -1],
  ].forEach(([cxp, cyp, sxn, syn]) => {
    ironStrap(ctx, cxp, cyp + syn * 4, cxp + sxn * strapLen, cyp + syn * 4, strapW);
    ironStrap(ctx, cxp + sxn * 4, cyp, cxp + sxn * 4, cyp + syn * strapLen, strapW);
  });

  // hasp strip
  const haspW = chestW * 0.05;
  const haspX = cx - haspW / 2;
  carveStroke(ctx, (c) => c.rect(haspX, top + 6, haspW, chestH - 12), { width: Math.max(1.5, chestW * 0.005) });
  strokeGoldLayered(
    ctx,
    (c) => c.rect(haspX + 3, top + 9, haspW - 6, chestH - 18),
    { x: haspX, y: top, w: haspW, h: chestH },
    { width: Math.max(1, chestW * 0.004) },
  );

  // 15 medallion sockets, 5x3, gentle arc across the columns
  const cols = 5;
  const rows = 3;
  const marginX = chestW * 0.1;
  const usableW = chestW - marginX * 2 - haspW * 1.4;
  const colGap = usableW / (cols - 1);
  const rowGap = chestH * 0.24;
  const r = Math.min(colGap, rowGap) * 0.34;
  let ordinal = 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const sideOffset = col < 2 ? -haspW * 0.7 : col > 2 ? haspW * 0.7 : 0;
      const mx = left + marginX + col * colGap + sideOffset;
      const bow = Math.sin((col / (cols - 1)) * Math.PI) * (chestH * 0.05);
      const my = top + chestH * 0.24 + row * rowGap - bow;
      medallion(ctx, mx, my, r, medallionState(ordinal, p), ordinal);
      ordinal++;
    }
  }

  // hearth-light drift; progress warms the light. Frozen under reduced motion.
  const flick = reduced ? 0 : Math.sin(time * 0.0012) * 0.5 + Math.sin(time * 0.0027) * 0.2;
  const glowColor = mix(palette.ember, palette.goldBright, p * 0.6);
  const glowX = cx + (reduced ? 0 : Math.sin(time * 0.0006) * chestW * 0.06);
  glowFx(ctx, glowX, top - chestH * 0.15, chestW * 0.55, glowColor, 0.18 + p * 0.22 + flick * 0.05);
}

export function treasureFrame(ctx, w, h, t = 0) {
  const reduced = prefersReducedMotion();
  const time = reduced ? 0 : t;
  const margin = Math.min(w, h) * 0.07;
  const fx = margin;
  const fy = margin;
  const fw = w - margin * 2;
  const fh = h - margin * 2;
  const radius = Math.min(fw, fh) * 0.03;
  const framePath = (c, inset = 0) => {
    const rr = Math.max(2, radius - inset);
    c.moveTo(fx + inset + rr, fy + inset);
    c.arcTo(fx + fw - inset, fy + inset, fx + fw - inset, fy + fh - inset, rr);
    c.arcTo(fx + fw - inset, fy + fh - inset, fx + inset, fy + fh - inset, rr);
    c.arcTo(fx + inset, fy + fh - inset, fx + inset, fy + inset, rr);
    c.arcTo(fx + inset, fy + inset, fx + fw - inset, fy + inset, rr);
    c.closePath();
  };

  ctx.save();
  ctx.beginPath();
  framePath(ctx, 0);
  ctx.clip();
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(fw, fh) * 0.1, w / 2, h / 2, Math.max(fw, fh) * 0.7);
  g.addColorStop(0, mix(palette.oak, palette.oakDeep, 0.3));
  g.addColorStop(1, palette.oakDeep);
  ctx.fillStyle = g;
  ctx.fillRect(fx, fy, fw, fh);
  const pulse = reduced ? 0.5 : Math.sin(time * 0.0009) * 0.5 + 0.5;
  glowFx(ctx, w / 2, h / 2, Math.min(fw, fh) * 0.55, palette.goldBright, 0.22 + pulse * 0.14);
  ctx.restore();

  carveStroke(ctx, (c) => framePath(c, 0), { width: Math.max(2, margin * 0.22) });
  strokeGoldLayered(ctx, (c) => framePath(c, margin * 0.34), { x: fx, y: fy, w: fw, h: fh }, { width: Math.max(1.5, margin * 0.16) });

  const cornerSize = margin * 1.5;
  [
    [fx, fy],
    [fx + fw, fy],
    [fx, fy + fh],
    [fx + fw, fy + fh],
  ].forEach(([ox, oy]) => {
    ornament(ctx, 'nailhead', ox, oy, cornerSize * 0.6);
  });
}
