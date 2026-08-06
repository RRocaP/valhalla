// chestScene: the full lid composition, self-contained (paints its own wood
// backdrop rather than assuming the shell always supplies one behind it).
//
// The static furniture (body, lid band, iron straps + rivets, hasp rail,
// dragonhead terminals, wavebord, wordmark, empty sockets) is baked once per
// (w,h) into an offscreen canvas and blitted each frame; only the 15 medallions
// and the hearth glow are re-drawn live. That is what lets the composition
// carry this much detail and still repaint well inside the 8ms budget.
//
// chestLayout() is exported so the shell can place its medallion hit-targets on
// exactly the sockets this scene carves — previously the shell ran its own
// independent layout and painted a SECOND set of medallions on top, which is
// why the lid read as a scatter of overlapping circles.
//
// treasureFrame: the finale's carved + gilded frame. No image/dataUri param
// in the frozen signature — compositing the actual treasure image is a
// shell-side concern; this renders the ornamental surround only.
import { palette, rgba, mix, clamp01 } from './palette.js';
import { carveStroke, glow as glowFx, prefersReducedMotion } from './util.js';
import { paintWood } from './wood.js';
import { strokeGoldLayered } from './gold.js';
import { medallion, medallionState, ornament } from './ornaments.js';
import { carveText } from './text.js';

const LID_SEED = 'oathwood-lid';
const furnitureCache = new Map();

const portraitish = (w, h) => w / h < 0.85;

function bodyPath(c, left, top, w, h, inset = 0) {
  const rr = Math.min(16, w * 0.02);
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

// A forged iron band: dark core with a cool catch light along its upper edge,
// a hammered inner line, and rivets. Iron has no palette token — tar body with
// a boneDim highlight, never gold (reserved for fittings).
function ironBand(ctx, x, y, w, h, opts = {}) {
  const rivets = opts.rivets ?? 2;
  const vertical = h > w;
  const thick = vertical ? w : h;
  const long = vertical ? h : w;

  ctx.save();
  ctx.fillStyle = rgba(palette.tar, 0.6);
  ctx.fillRect(x + thick * 0.22, y + thick * 0.26, w, h);

  // Gradient runs ACROSS the band's short axis — a forged bar is round in
  // section, so the highlight is a line down its length, not a fade along it.
  const g = vertical
    ? ctx.createLinearGradient(x, 0, x + w, 0)
    : ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, palette.tar);
  g.addColorStop(0.2, mix(palette.tar, palette.oakDeep, 0.45));
  g.addColorStop(0.36, mix(palette.tar, palette.boneDim, 0.34));
  g.addColorStop(0.52, mix(palette.tar, palette.oakDeep, 0.3));
  g.addColorStop(1, mix(palette.tar, palette.oakDeep, 0.1));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  // crisp specular hairline just off the crest
  ctx.strokeStyle = rgba(palette.boneDim, 0.38);
  ctx.lineWidth = Math.max(0.7, thick * 0.08);
  ctx.beginPath();
  if (vertical) {
    ctx.moveTo(x + w * 0.34, y + thick * 0.4);
    ctx.lineTo(x + w * 0.34, y + h - thick * 0.4);
  } else {
    ctx.moveTo(x + thick * 0.4, y + h * 0.34);
    ctx.lineTo(x + w - thick * 0.4, y + h * 0.34);
  }
  ctx.stroke();

  // hammer marks across the band
  ctx.strokeStyle = rgba(palette.tar, 0.5);
  ctx.lineWidth = Math.max(0.6, thick * 0.06);
  const facets = Math.max(3, Math.round(long / (thick * 1.6)));
  for (let i = 1; i < facets; i++) {
    const f = (long * i) / facets;
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(x + w * 0.1, y + f);
      ctx.lineTo(x + w * 0.9, y + f + thick * 0.22);
    } else {
      ctx.moveTo(x + f, y + h * 0.1);
      ctx.lineTo(x + f + thick * 0.22, y + h * 0.9);
    }
    ctx.stroke();
  }
  ctx.restore();

  const rs = Math.min(thick * 0.78, 12);
  for (let i = 0; i < rivets; i++) {
    const f = rivets === 1 ? long / 2 : thick * 1.1 + ((long - thick * 2.2) * i) / (rivets - 1);
    if (vertical) ornament(ctx, 'nailhead', x + w / 2, y + f, rs);
    else ornament(ctx, 'nailhead', x + f, y + h / 2, rs);
  }
}

export function chestLayout(w, h, n = 15) {
  // On a tall/narrow viewport a 5-wide chest shrinks to a postage stamp adrift
  // in empty board. Portrait framing turns the grid 3-wide/5-deep so the chest
  // fills the frame and the focal hierarchy survives the squint test.
  const portrait = portraitish(w, h);
  const cx = w / 2;
  const cy = h * (portrait ? 0.49 : 0.5);
  const chestW = portrait ? Math.min(w * 0.88, h * 0.5) : Math.min(w * 0.7, h * 1.24);
  const chestH = chestW * (portrait ? 1.42 : 0.63);
  const left = cx - chestW / 2;
  const top = cy - chestH / 2;
  const lidH = chestH * (portrait ? 0.14 : 0.26);
  const railH = chestH * (portrait ? 0.07 : 0.13);
  const faceTop = top + lidH;
  const faceH = chestH - lidH - railH;

  const cols = Math.min(portrait ? 3 : 5, n) || 1;
  const rows = Math.ceil(n / cols);
  const gridL = left + chestW * 0.1;
  const gridR = left + chestW * 0.9;
  const colGap = cols > 1 ? (gridR - gridL) / (cols - 1) : 0;
  const rowGap = faceH / (rows + 0.55);
  const r = Math.max(19, Math.min(colGap * 0.34, rowGap * 0.36));

  const sockets = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i - row * cols;
    const countInRow = Math.min(cols, n - row * cols);
    const rowL = countInRow === cols ? gridL : cx - ((countInRow - 1) * colGap) / 2;
    // gentle upward bow across each row — the lid is domed
    const bow = cols > 1 ? Math.sin((col / (cols - 1)) * Math.PI) * (chestH * 0.035) : 0;
    sockets.push({
      x: rowL + col * colGap,
      y: faceTop + rowGap * (row + 0.75) - bow,
      r,
    });
  }
  return { cx, cy, left, top, chestW, chestH, lidH, railH, faceTop, faceH, sockets };
}

function renderFurniture(w, h) {
  const d = Math.max(1, Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2));
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.round(w * d));
  off.height = Math.max(1, Math.round(h * d));
  const ctx = off.getContext('2d');
  ctx.scale(d, d);

  const L = chestLayout(w, h);
  const { left, top, chestW, chestH, lidH, railH, cx } = L;

  // board the chest stands on, held back in shadow so the chest reads as the
  // lit object in front of it rather than as more of the same field
  paintWood(ctx, w, h, LID_SEED, { vignette: 0.62 });
  ctx.fillStyle = rgba(palette.tar, 0.3);
  ctx.fillRect(0, 0, w, h);

  // cast shadow — grounds the object instead of letting it float
  ctx.save();
  const sh = ctx.createRadialGradient(cx, top + chestH, 0, cx, top + chestH, chestW * 0.62);
  sh.addColorStop(0, rgba(palette.tar, 0.62));
  sh.addColorStop(1, rgba(palette.tar, 0));
  ctx.fillStyle = sh;
  ctx.save();
  ctx.translate(cx, top + chestH + chestH * 0.06);
  ctx.scale(1, 0.16);
  ctx.beginPath();
  ctx.arc(0, 0, chestW * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();

  // the chest body: its own grain, cross-cut to the board behind it so the two
  // surfaces never blend into one field
  ctx.save();
  ctx.beginPath();
  bodyPath(ctx, left, top, chestW, chestH, 0);
  ctx.clip();
  ctx.translate(left, top);
  paintWood(ctx, chestW, chestH, `${LID_SEED}-body`, { vignette: 0.3, planks: 7, knots: 3 });
  // front-face lighting: brighter along the top of the lid, falling into the base
  const face = ctx.createLinearGradient(0, 0, 0, chestH);
  face.addColorStop(0, rgba(palette.oakLight, 0.16));
  face.addColorStop(0.32, rgba(palette.oak, 0));
  face.addColorStop(1, rgba(palette.tar, 0.4));
  ctx.fillStyle = face;
  ctx.fillRect(0, 0, chestW, chestH);
  ctx.restore();

  // edge relief: a lit crest along the top of the lid and the two upper
  // flanks, a deep shadow under the base. Without this the chest is a wood
  // rectangle drawn on wood, and no outline alone will sell the volume.
  ctx.save();
  ctx.beginPath();
  bodyPath(ctx, left, top, chestW, chestH, 0);
  ctx.clip();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(mix(palette.oakLight, palette.bone, 0.3), 0.5);
  ctx.lineWidth = Math.max(2, chestH * 0.012);
  ctx.beginPath();
  ctx.moveTo(left + chestW * 0.02, top + 1.5);
  ctx.lineTo(left + chestW * 0.98, top + 1.5);
  ctx.stroke();
  ctx.strokeStyle = rgba(palette.oakLight, 0.22);
  ctx.lineWidth = Math.max(1.5, chestH * 0.008);
  ctx.beginPath();
  ctx.moveTo(left + 1.5, top + chestH * 0.04);
  ctx.lineTo(left + 1.5, top + chestH * 0.96);
  ctx.moveTo(left + chestW - 1.5, top + chestH * 0.04);
  ctx.lineTo(left + chestW - 1.5, top + chestH * 0.96);
  ctx.stroke();
  const base = ctx.createLinearGradient(0, top + chestH * 0.82, 0, top + chestH);
  base.addColorStop(0, rgba(palette.tar, 0));
  base.addColorStop(1, rgba(palette.tar, 0.7));
  ctx.fillStyle = base;
  ctx.fillRect(left, top + chestH * 0.82, chestW, chestH * 0.18);
  ctx.restore();

  // silhouette incision
  carveStroke(ctx, (c) => bodyPath(c, left, top, chestW, chestH, 0), { width: Math.max(2.5, chestW * 0.005) });

  // lid seam — the single line that says "this opens"
  const seamY = top + lidH;
  carveStroke(ctx, (c) => { c.moveTo(left + 3, seamY); c.lineTo(left + chestW - 3, seamY); }, {
    width: Math.max(2, chestW * 0.0038), shadowAlpha: 0.75, liftAlpha: 0.32,
  });

  // dragonhead terminals at the lid corners, facing outward
  const dh = Math.max(20, chestW * 0.062);
  ornament(ctx, 'dragonhead', left + chestW * 0.055, top + lidH * 0.42, dh, { mirror: true });
  ornament(ctx, 'dragonhead', left + chestW - chestW * 0.055, top + lidH * 0.42, dh);

  // wavebord carved along the lid band, between the terminals and clear of the
  // wordmark's own footprint
  const wbSize = Math.max(22, chestW * 0.062);
  const wbY = top + lidH * (portraitish(w, h) ? 0.72 : 0.84);
  for (let x = left + chestW * 0.09; x < left + chestW * 0.91 - wbSize * 0.2; x += wbSize) {
    ornament(ctx, 'wavebord', x, wbY, wbSize);
  }

  // iron straps: two verticals wrapping the body + corner feet
  const strapW = Math.max(7, chestW * 0.02);
  [left + chestW * 0.215, left + chestW * 0.785].forEach((sx) => {
    ironBand(ctx, sx - strapW / 2, top + 2, strapW, chestH - 4, { rivets: 3 });
  });
  const footH = Math.max(7, chestH * 0.038);
  ironBand(ctx, left + 2, top + chestH - footH - 2, chestW * 0.14, footH, { rivets: 2 });
  ironBand(ctx, left + chestW - chestW * 0.14 - 2, top + chestH - footH - 2, chestW * 0.14, footH, { rivets: 2 });

  // hasp rail across the base of the face — the shard tally strip sits here
  const railY = top + chestH - railH;
  const railTop = railY + railH * 0.1;
  const railBoxH = railH * 0.68;
  ctx.save();
  ctx.beginPath();
  ctx.rect(left + chestW * 0.09, railTop, chestW * 0.82, railBoxH);
  ctx.clip();
  const rg = ctx.createLinearGradient(0, railTop, 0, railTop + railBoxH);
  rg.addColorStop(0, rgba(palette.tar, 0.86));
  rg.addColorStop(1, rgba(palette.oakDeep, 0.7));
  ctx.fillStyle = rg;
  ctx.fillRect(left, railTop, chestW, railBoxH);
  ctx.restore();
  carveStroke(ctx, (c) => c.rect(left + chestW * 0.09, railTop, chestW * 0.82, railBoxH), {
    width: Math.max(1.2, chestW * 0.003),
  });
  // a single hairline of gold, not a full gilded frame: the rail is a tally
  // strip, and a bright box around it read as a UI progress bar.
  ctx.save();
  ctx.strokeStyle = rgba(palette.gold, 0.5);
  ctx.lineWidth = Math.max(0.8, chestW * 0.0016);
  ctx.beginPath();
  ctx.rect(left + chestW * 0.096, railTop + 2.5, chestW * 0.808, railBoxH - 5);
  ctx.stroke();
  ctx.restore();

  // fifteen empty tally notches cut into the rail, so an unopened chest reads
  // as "fifteen places waiting" rather than as an empty black box
  const notchL = left + chestW * 0.11;
  const notchR = left + chestW * 0.89;
  const notchGap = (notchR - notchL) / 15;
  for (let i = 0; i < 15; i++) {
    const nx = notchL + notchGap * (i + 0.5);
    if (Math.abs(nx - cx) < chestW * 0.035) continue; // clear of the lock boss
    carveStroke(ctx, (c) => {
      c.moveTo(nx, railTop + railBoxH * 0.26);
      c.lineTo(nx, railTop + railBoxH * 0.74);
    }, { width: Math.max(0.8, chestW * 0.0016), shadowAlpha: 0.6, liftAlpha: 0.24 });
  }

  // lock boss centred on the hasp rail
  ornament(ctx, 'shieldboss', cx, railTop + railBoxH * 0.5, Math.max(18, chestW * 0.046));

  // carved wordmark on the lid band (docs/ART.md: full carveText depth on the
  // title call-out, not a CSS shadow). Tracked like the threshold statement,
  // flanked by two small gilded diamonds — the wordmark's echo, kept quiet so
  // the band stays a band and not a second title card.
  const wmSize = Math.max(13, chestW * 0.046);
  const wmY = top + lidH * (portraitish(w, h) ? 0.42 : 0.5) + chestW * 0.016;
  carveText(ctx, 'VALHALLA', cx, wmY, wmSize, {
    align: 'center', depth: 0.85, color: mix(palette.bone, palette.gold, 0.4),
    maxWidth: chestW * 0.4, letterSpacing: Math.round(wmSize * 0.22),
  });
  const dmR = wmSize * 0.16;
  const dmY = wmY - wmSize * 0.3;
  for (const dx of [-1, 1]) {
    const dmX = cx + dx * chestW * 0.235;
    const dpath = (c) => {
      c.moveTo(dmX, dmY - dmR); c.lineTo(dmX + dmR, dmY);
      c.lineTo(dmX, dmY + dmR); c.lineTo(dmX - dmR, dmY);
      c.closePath();
    };
    carveStroke(ctx, dpath, { width: Math.max(0.9, wmSize * 0.045) });
    ctx.save();
    ctx.fillStyle = rgba(palette.gold, 0.75);
    ctx.beginPath();
    dpath(ctx);
    ctx.fill();
    ctx.restore();
  }

  // 15 carved empty sockets — the recesses the medallions sit in
  for (const s of L.sockets) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * 1.16, 0, Math.PI * 2);
    ctx.clip();
    const rec = ctx.createRadialGradient(s.x - s.r * 0.35, s.y - s.r * 0.4, s.r * 0.1, s.x, s.y, s.r * 1.2);
    rec.addColorStop(0, rgba(palette.tar, 0.85));
    rec.addColorStop(1, rgba(palette.oakDeep, 0.4));
    ctx.fillStyle = rec;
    ctx.fillRect(s.x - s.r * 1.2, s.y - s.r * 1.2, s.r * 2.4, s.r * 2.4);
    ctx.restore();
    carveStroke(ctx, (c) => c.arc(s.x, s.y, s.r * 1.14, 0, Math.PI * 2), {
      width: Math.max(1.2, s.r * 0.11), shadowAlpha: 0.7, liftAlpha: 0.42,
    });
    // two pin nails per socket, on the light axis. Four read as a field of
    // gold confetti once multiplied across fifteen sockets.
    for (const a of [Math.PI * 1.25, Math.PI * 0.25]) {
      ornament(ctx, 'nailhead', s.x + Math.cos(a) * s.r * 1.32, s.y + Math.sin(a) * s.r * 1.32, Math.max(3.5, s.r * 0.15));
    }
  }

  return off;
}

function furnitureFor(w, h) {
  const key = `${Math.round(w)}x${Math.round(h)}`;
  let entry = furnitureCache.get(key);
  if (!entry) {
    entry = renderFurniture(w, h);
    furnitureCache.set(key, entry);
    if (furnitureCache.size > 3) furnitureCache.delete(furnitureCache.keys().next().value);
  }
  return entry;
}

export function chestScene(ctx, w, h, t = 0, progress = 0) {
  const reduced = prefersReducedMotion();
  const time = reduced ? 0 : t;
  const p = clamp01(progress);

  ctx.drawImage(furnitureFor(w, h), 0, 0, w, h);

  const L = chestLayout(w, h);
  L.sockets.forEach((s, i) => {
    medallion(ctx, s.x, s.y, s.r, medallionState(i + 1, p), i + 1);
  });

  // hearth-light: the room heats as the chest opens. A warm veil washes down
  // the chest face (clipped to the body so the board keeps its shadow), and
  // the hearth pool above brightens and gilds with progress. Reduced motion
  // freezes the drift but keeps the light — static, present.
  if (p > 0.02) {
    const warmCol = mix(palette.ember, palette.goldBright, 0.5);
    const veil = ctx.createLinearGradient(0, L.top, 0, L.top + L.chestH);
    veil.addColorStop(0, rgba(warmCol, 0.17 * p));
    veil.addColorStop(0.42, rgba(warmCol, 0.06 * p));
    veil.addColorStop(1, rgba(warmCol, 0));
    ctx.save();
    ctx.beginPath();
    bodyPath(ctx, L.left, L.top, L.chestW, L.chestH, 0);
    ctx.clip();
    ctx.fillStyle = veil;
    ctx.fillRect(L.left, L.top, L.chestW, L.chestH);
    ctx.restore();
    // the board just around the chest catches a little of the same warmth
    glowFx(ctx, L.cx, L.top + L.chestH * 0.3, L.chestW * 0.78, warmCol, 0.05 * p);
  }
  const flick = reduced ? 0 : Math.sin(time * 0.0012) * 0.5 + Math.sin(time * 0.0027) * 0.2;
  const glowColor = mix(palette.ember, palette.goldBright, p * 0.6);
  const glowX = L.cx + (reduced ? 0 : Math.sin(time * 0.0006) * L.chestW * 0.06);
  glowFx(ctx, glowX, L.top - L.chestH * 0.18, L.chestW * 0.6, glowColor, 0.17 + p * 0.3 + flick * 0.05);
}

export function treasureFrame(ctx, w, h, t = 0) {
  const reduced = prefersReducedMotion();
  const time = reduced ? 0 : t;
  const margin = Math.min(w, h) * 0.075;
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

  // the frame's own stock is wood, carved and gilded — not a bare gradient
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  paintWood(ctx, w, h, 'treasure-frame', { vignette: 0.5, planks: 3 });
  ctx.restore();

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

  carveStroke(ctx, (c) => framePath(c, 0), { width: Math.max(2, margin * 0.24) });
  strokeGoldLayered(ctx, (c) => framePath(c, margin * 0.34), { x: fx, y: fy, w: fw, h: fh }, { width: Math.max(1.5, margin * 0.16) });

  const cornerSize = margin * 1.2;
  [
    [fx, fy], [fx + fw, fy], [fx, fy + fh], [fx + fw, fy + fh],
  ].forEach(([ox, oy]) => {
    ornament(ctx, 'nailhead', ox, oy, cornerSize * 0.62);
  });
}
