// Carved-prop carpentry: architrave trays, chip-carved borders, two-strand
// interlace ribbon rails, compass rosettes, and quiet tool-history wear.
// Additive helpers on the same footing as chestLayout/hearth/wordmark
// (docs/ART.md): no frozen signature is changed. Everything here is
// deterministic for its inputs, one-shot (callers paint onto surfaces they
// already cache), and disciplined — detail lives in borders, rails and dead
// zones, never on top of puzzle content.
import { rng } from '../kernel/rng.js';
import { palette, rgba, mix } from './palette.js';
import { carveStroke } from './util.js';
import { drawKnot } from './knot.js';

function roundRectPath(c, x, y, w, h, r) {
  const rr = Math.max(1, Math.min(r, Math.min(w, h) / 2));
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

// A wolf-tooth band: a run of chip-carved triangles. Each chip is three cuts:
// a dark socket, a shade wall against the light, and a lit wall catching it —
// which is what makes the row read as CARVED at 200% rather than printed.
export function chipBorder(ctx, x, y, w, h, opts = {}) {
  const s = opts.size || 8;
  const alpha = opts.alpha ?? 1;
  ctx.save();
  const chip = (px, py, dx0, dy0, dx1, dy1, dxt, dyt) => {
    // socket
    ctx.fillStyle = rgba(palette.tar, 0.42 * alpha);
    ctx.beginPath();
    ctx.moveTo(px + dx0, py + dy0);
    ctx.lineTo(px + dx1, py + dy1);
    ctx.lineTo(px + dxt, py + dyt);
    ctx.closePath();
    ctx.fill();
    // lit wall (down-right edge, hearth key from upper-left)
    ctx.strokeStyle = rgba(mix(palette.oakLight, palette.goldBright, 0.3), 0.34 * alpha);
    ctx.lineWidth = Math.max(0.7, s * 0.1);
    ctx.beginPath();
    ctx.moveTo(px + dx1, py + dy1);
    ctx.lineTo(px + dxt, py + dyt);
    ctx.stroke();
    // shade wall
    ctx.strokeStyle = rgba(palette.tar, 0.5 * alpha);
    ctx.beginPath();
    ctx.moveTo(px + dx0, py + dy0);
    ctx.lineTo(px + dxt, py + dyt);
    ctx.stroke();
  };
  const run = (len, place) => {
    const n = Math.max(2, Math.floor(len / s));
    const step = len / n;
    for (let i = 0; i < n; i++) {
      const inward = i % 2 === 0;
      place(i * step, step, inward);
    }
  };
  // top + bottom rows point into the field, alternating
  run(w - s, (t, step, inward) => chip(x + s / 2 + t, y, 0, 0, step, 0, step / 2, inward ? s * 0.78 : s * 0.3));
  run(w - s, (t, step, inward) => chip(x + s / 2 + t, y + h, 0, 0, step, 0, step / 2, inward ? -s * 0.78 : -s * 0.3));
  run(h - s, (t, step, inward) => chip(x, y + s / 2 + t, 0, 0, 0, step, inward ? s * 0.78 : s * 0.3, step / 2));
  run(h - s, (t, step, inward) => chip(x + w, y + s / 2 + t, 0, 0, 0, step, inward ? -s * 0.78 : -s * 0.3, step / 2));
  ctx.restore();
}

// A two-strand guilloche cut along a rail: one polyline whose forward and
// return legs weave, handed to drawKnot so the over/under is REAL interlace
// (gaps cut on the under strand), Urnes-fashion, with curled tips for
// terminals. Horizontal; callers rotate the ctx for anything else.
export function ribbonRail(ctx, x, y, len, opts = {}) {
  const amp = opts.amp || 5;
  const step = opts.step || 22;
  const width = opts.width || Math.max(2.4, amp * 0.62);
  const n = Math.max(3, Math.round(len / step));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([x + i * step, y + amp * (i % 2 ? 1 : -1)]);
  for (let i = n; i >= 0; i--) pts.push([x + i * step - step / 2, y + amp * (i % 2 ? -1 : 1)]);
  ctx.save();
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  drawKnot(ctx, pts, { width, color: opts.color || palette.gold, gapAtCrossings: width * 1.7 });
  // curled terminals so the band ends like a ribbon, not a sawn-off hose
  ctx.strokeStyle = rgba(opts.color || palette.gold, 0.85);
  ctx.lineWidth = Math.max(1.2, width * 0.55);
  ctx.lineCap = 'round';
  for (const [tx, ty, dir] of [[x, y + amp * -1, -1], [x + n * step, y + amp * (n % 2 ? 1 : -1), 1]]) {
    ctx.beginPath();
    ctx.arc(tx + dir * step * 0.18, ty, amp * 0.9, Math.PI * 0.2, Math.PI * 1.4);
    ctx.stroke();
  }
  ctx.restore();
}

// Six-petal compass rosette, chip-carved: alternating shade/lit petal facets
// inside a carved ring, gold pip at the hub. The joint mark of the carpenter.
export function rosette(ctx, x, y, r, opts = {}) {
  const alpha = opts.alpha ?? 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  carveStroke(ctx, (c) => c.arc(x, y, r, 0, Math.PI * 2), { width: Math.max(1, r * 0.13) });
  for (let k = 0; k < 6; k++) {
    const a0 = (k / 6) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((k + 1) / 6) * Math.PI * 2 - Math.PI / 2;
    const mid = (a0 + a1) / 2;
    const tipX = x + Math.cos(mid) * r * 0.92;
    const tipY = y + Math.sin(mid) * r * 0.92;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a0) * r * 0.62, y + Math.sin(a0) * r * 0.62, tipX, tipY);
    ctx.quadraticCurveTo(x + Math.cos(a1) * r * 0.62, y + Math.sin(a1) * r * 0.62, x, y);
    ctx.closePath();
    ctx.fillStyle = k % 2
      ? rgba(palette.tar, 0.44)
      : rgba(mix(palette.oakLight, palette.goldBright, 0.18), 0.2);
    ctx.fill();
    ctx.strokeStyle = rgba(palette.tar, 0.4);
    ctx.lineWidth = Math.max(0.6, r * 0.05);
    ctx.stroke();
  }
  const pip = ctx.createRadialGradient(x - r * 0.06, y - r * 0.08, 0, x, y, r * 0.2);
  pip.addColorStop(0, rgba(palette.goldBright, 0.95));
  pip.addColorStop(1, rgba(mix(palette.gold, palette.tar, 0.5), 0.85));
  ctx.fillStyle = pip;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// The board's furniture: a carved architrave tray the puzzle SITS in.
// Stepped profile (three edges), a real wood band with its own grain run,
// chip-carved wolf-tooth border, optional interlace rails, corner rosettes,
// a contact shadow grounding the whole piece, and a recess shade inside so
// the content reads as seated, not floated.
export function tray(ctx, x, y, w, h, opts = {}) {
  const band = opts.band || Math.max(16, Math.min(30, Math.min(w, h) * 0.055));
  const rad = Math.min(14, band * 0.6);
  const ox = x - band;
  const oy = y - band;
  const ow = w + band * 2;
  const oh = h + band * 2;

  // contact shadow: the tray presses onto the boards. Filled as a RING
  // (evenodd) so the blur grounds the outer edge without flooding the
  // opening — a full-rect fill here darkened every board's interior.
  if (opts.shadow !== false) {
    ctx.save();
    ctx.shadowColor = rgba(palette.tar, 0.62);
    ctx.shadowBlur = band * 1.2;
    ctx.shadowOffsetY = band * 0.5;
    ctx.fillStyle = rgba(palette.tar, 0.3);
    ctx.beginPath();
    roundRectPath(ctx, ox, oy, ow, oh, rad);
    roundRectPath(ctx, x + 2, y + 2, w - 4, h - 4, Math.max(2, rad * 0.5));
    ctx.fill('evenodd');
    ctx.restore();
  }

  // the band itself: raised wood, lit from the upper-left
  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, ox, oy, ow, oh, rad);
  roundRectPath(ctx, x, y, w, h, Math.max(2, rad * 0.5));
  ctx.clip('evenodd');
  const bandGrad = ctx.createLinearGradient(ox, oy, ox + ow * 0.4, oy + oh);
  bandGrad.addColorStop(0, mix(palette.oak, palette.oakLight, 0.42));
  bandGrad.addColorStop(0.5, mix(palette.oak, palette.oakLight, 0.14));
  bandGrad.addColorStop(1, mix(palette.oak, palette.oakDeep, 0.42));
  ctx.fillStyle = bandGrad;
  ctx.fillRect(ox, oy, ow, oh);
  // grain run along the band
  const r = rng(`tray:${opts.seed || 'tray'}`);
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 26; i++) {
    const gy = oy + r() * oh;
    const dark = r.chance(0.7);
    ctx.strokeStyle = rgba(dark ? palette.oakDeep : palette.oakLight, dark ? 0.28 : 0.16);
    ctx.beginPath();
    ctx.moveTo(ox + r() * ow * 0.3, gy);
    ctx.lineTo(ox + ow * (0.55 + r() * 0.45), gy + (r() - 0.5) * 3);
    ctx.stroke();
  }
  ctx.restore();

  // stepped architrave profile: outer arris, mid step, inner arris
  carveStroke(ctx, (c) => roundRectPath(c, ox, oy, ow, oh, rad), { width: Math.max(1.6, band * 0.1) });
  ctx.save();
  ctx.strokeStyle = rgba(palette.tar, 0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundRectPath(ctx, ox + band * 0.3, oy + band * 0.3, ow - band * 0.6, oh - band * 0.6, rad * 0.8);
  ctx.stroke();
  ctx.strokeStyle = rgba(mix(palette.oakLight, palette.goldBright, 0.25), 0.28);
  ctx.beginPath();
  roundRectPath(ctx, ox + band * 0.3 + 1.2, oy + band * 0.3 + 1.2, ow - band * 0.6, oh - band * 0.6, rad * 0.8);
  ctx.stroke();
  ctx.restore();
  carveStroke(ctx, (c) => roundRectPath(c, x, y, w, h, Math.max(2, rad * 0.5)), {
    width: Math.max(1.3, band * 0.085), shadowAlpha: 0.68, liftAlpha: 0.45,
  });

  // chip-carved wolf-tooth run down the band's spine
  if (opts.chip !== false) {
    chipBorder(ctx, ox + band * 0.42, oy + band * 0.42, ow - band * 0.84, oh - band * 0.84, {
      size: Math.max(6, band * 0.34), alpha: opts.chipAlpha ?? 0.85,
    });
  }

  // interlace rails along the long sides
  if (opts.ribbon && ow > 260) {
    const amp = Math.max(3.2, band * 0.17);
    const rx = ox + band * 1.6;
    const rl = ow - band * 3.2;
    ribbonRail(ctx, rx, oy + band * 0.5, rl, { amp, step: Math.max(16, band * 0.95), alpha: 0.8 });
    ribbonRail(ctx, rx, oy + oh - band * 0.5, rl, { amp, step: Math.max(16, band * 0.95), alpha: 0.8 });
  }

  // corner rosettes — the joints are marked, not butted
  if (opts.rosettes !== false) {
    const rr = band * 0.46;
    for (const [cxx, cyy] of [
      [ox + band * 0.52, oy + band * 0.52], [ox + ow - band * 0.52, oy + band * 0.52],
      [ox + band * 0.52, oy + oh - band * 0.52], [ox + ow - band * 0.52, oy + oh - band * 0.52],
    ]) rosette(ctx, cxx, cyy, rr);
  }

  // recess: the opening falls away from the light
  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, Math.max(2, rad * 0.5));
  ctx.clip();
  const lip = Math.max(10, band * 0.7);
  const inShade = ctx.createLinearGradient(0, y, 0, y + lip * 1.6);
  inShade.addColorStop(0, rgba(palette.tar, 0.34));
  inShade.addColorStop(1, rgba(palette.tar, 0));
  ctx.fillStyle = inShade;
  ctx.fillRect(x, y, w, lip * 1.6);
  const sideShade = ctx.createLinearGradient(x, 0, x + lip, 0);
  sideShade.addColorStop(0, rgba(palette.tar, 0.22));
  sideShade.addColorStop(1, rgba(palette.tar, 0));
  ctx.fillStyle = sideShade;
  ctx.fillRect(x, y, lip, h);
  ctx.strokeStyle = rgba(palette.goldBright, 0.14);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + 3, y + h - 1.5);
  ctx.lineTo(x + w - 3, y + h - 1.5);
  ctx.stroke();
  ctx.restore();
}

// Quiet incidental tool history for the dead zones: adze facets, scratch
// clusters, a scribe line, a wax drip, a ghost rosette. Every alpha is held
// low; anything that would land inside `avoid` is skipped, so the puzzle
// never competes with its furniture.
export function wear(ctx, w, h, seed, opts = {}) {
  const r = rng(`wear:${seed}`);
  const a = opts.avoid || null;
  const clear = (x, y, m = 0) => !a || x < a.x - m || x > a.x + a.w + m || y < a.y - m || y > a.y + a.h + m;
  ctx.save();

  // adze facets — broad, faint, angled sweeps left by the finishing cut
  for (let i = 0; i < 6; i++) {
    const x = r() * w;
    const y = r() * h;
    if (!clear(x, y, 30)) continue;
    const len = 40 + r() * 90;
    const ang = (r() - 0.5) * 0.5;
    ctx.strokeStyle = rgba(palette.oakLight, 0.05 + r() * 0.035);
    ctx.lineWidth = 9 + r() * 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + len * 0.5, y + Math.sin(ang) * 10, x + len * Math.cos(ang), y + len * Math.sin(ang));
    ctx.stroke();
  }

  // scratch clusters
  for (let cl = 0; cl < 3; cl++) {
    const cx = r() * w;
    const cy = r() * h;
    if (!clear(cx, cy, 40)) continue;
    const n = 3 + Math.floor(r() * 4);
    const baseAng = r() * Math.PI;
    for (let i = 0; i < n; i++) {
      const ang = baseAng + (r() - 0.5) * 0.35;
      const len = 18 + r() * 46;
      const sx = cx + (r() - 0.5) * 46;
      const sy = cy + (r() - 0.5) * 30;
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = rgba(palette.tar, 0.1 + r() * 0.08);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
      ctx.stroke();
      ctx.strokeStyle = rgba(palette.oakLight, 0.05);
      ctx.beginPath();
      ctx.moveTo(sx + 0.8, sy + 0.9);
      ctx.lineTo(sx + Math.cos(ang) * len + 0.8, sy + Math.sin(ang) * len + 0.9);
      ctx.stroke();
    }
  }

  // one scribe line — the carpenter's setting-out survives
  {
    const sy = h * (0.2 + r() * 0.6);
    if (clear(w / 2, sy, 26)) {
      ctx.strokeStyle = rgba(palette.bone, 0.055);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(w * 0.06, sy);
      for (let x = w * 0.06; x <= w * 0.94; x += 24) ctx.lineTo(x, sy + Math.sin(x * 0.05) * 0.9);
      ctx.stroke();
    }
  }

  // a wax drip, cooled where a taper leaned
  {
    const x = r() * w;
    const y = h * (0.15 + r() * 0.7);
    if (clear(x, y, 24)) {
      const drop = 8 + r() * 8;
      ctx.fillStyle = rgba(mix(palette.ember, palette.goldBright, 0.42), 0.13);
      ctx.beginPath();
      ctx.ellipse(x, y, drop * 0.55, drop, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y - drop * 1.2, drop * 0.3, drop * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(palette.bone, 0.16);
      ctx.beginPath();
      ctx.arc(x - drop * 0.16, y - drop * 0.3, drop * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ghost rosette — a practice cut the carver abandoned
  {
    const x = r() * w;
    const y = r() * h;
    if (clear(x, y, 40)) rosette(ctx, x, y, 14 + r() * 8, { alpha: 0.1 });
  }
  ctx.restore();
}

// A struck tile face: inset depth for interactive tiles — inner shadow above-
// left, lip light below-right, and a faint surface sheen. Painted INSIDE an
// already-drawn face rect; the difference between a printed chip and a tile
// you could catch a fingernail on.
export function insetFace(ctx, x, y, w, h, opts = {}) {
  const lip = Math.max(2.5, Math.min(w, h) * (opts.lip ?? 0.09));
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const top = ctx.createLinearGradient(0, y, 0, y + lip * 2.1);
  top.addColorStop(0, rgba(palette.tar, opts.depth ?? 0.5));
  top.addColorStop(1, rgba(palette.tar, 0));
  ctx.fillStyle = top;
  ctx.fillRect(x, y, w, lip * 2.1);
  const left = ctx.createLinearGradient(x, 0, x + lip * 1.6, 0);
  left.addColorStop(0, rgba(palette.tar, (opts.depth ?? 0.5) * 0.75));
  left.addColorStop(1, rgba(palette.tar, 0));
  ctx.fillStyle = left;
  ctx.fillRect(x, y, lip * 1.6, h);
  ctx.strokeStyle = rgba(palette.goldBright, opts.lipLight ?? 0.2);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(x + 1.5, y + h - 1.2);
  ctx.lineTo(x + w - 1.5, y + h - 1.2);
  ctx.stroke();
  ctx.strokeStyle = rgba(mix(palette.oakLight, palette.goldBright, 0.4), (opts.lipLight ?? 0.2) * 0.6);
  ctx.beginPath();
  ctx.moveTo(x + w - 1.2, y + 1.5);
  ctx.lineTo(x + w - 1.2, y + h - 1.5);
  ctx.stroke();
  ctx.restore();
}
