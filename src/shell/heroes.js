// Hero plates (CONTRACT amendment 2026-08-07): committed same-origin
// ./heroes/<id>.jpg tabletop photographs — the physical-object register
// (Hearthstone/Gwent). Fetched lazily per screen, decoded once, composited
// UNDER the interaction layer with a light hue-preserving wood grade.
// A missing file resolves to null and every consumer falls back to the
// procedural painters (offline law): the plates are atmosphere, never a
// dependency.

const cache = new Map(); // id -> Promise<HTMLImageElement|null>

export function loadHero(id) {
  if (!cache.has(id)) {
    cache.set(id, new Promise((resolve) => {
      try {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = `heroes/${id}.jpg`;
      } catch {
        resolve(null);
      }
    }));
  }
  return cache.get(id);
}

/**
 * Cover-fit rect for drawing `img` into a w×h box around a focal point
 * (fx, fy in image fractions). Returns the destination draw rect so callers
 * can map image-anchored coordinates through the same transform.
 */
export function coverRect(img, w, h, fx = 0.5, fy = 0.5) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  let dx = w / 2 - dw * fx;
  let dy = h / 2 - dh * fy;
  dx = Math.min(0, Math.max(w - dw, dx));
  dy = Math.min(0, Math.max(h - dh, dy));
  return { dx, dy, dw, dh };
}

/**
 * Draw a plate cover-cropped with the light wood grade: the photographs are
 * generated in-palette, so the grade only seats them — edge vignette into
 * tar, a faint warm wash, and a breath of top light. `dim` (0..1) darkens
 * the whole plate for stages where DOM text must own the contrast.
 */
export function drawHero(ctx, img, w, h, opts = {}) {
  const { dx, dy, dw, dh } = coverRect(img, w, h, opts.fx ?? 0.5, opts.fy ?? 0.5);
  ctx.save();
  ctx.drawImage(img, dx, dy, dw, dh);
  if (opts.dim) {
    ctx.fillStyle = `rgba(12,9,6,${Math.min(0.85, opts.dim)})`;
    ctx.fillRect(0, 0, w, h);
  }
  // warm hearth wash, hue-preserving (soft-light keeps the photo's own color)
  ctx.globalCompositeOperation = 'soft-light';
  const warm = ctx.createRadialGradient(w * 0.5, h * 0.42, Math.min(w, h) * 0.1, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
  warm.addColorStop(0, 'rgba(238,207,109,.28)');
  warm.addColorStop(1, 'rgba(12,9,6,.55)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  // seat it in the room: edges recede into tar
  const vg = ctx.createRadialGradient(w * 0.5, h * 0.46, Math.min(w, h) * 0.32, w * 0.5, h * 0.52, Math.max(w, h) * 0.72);
  vg.addColorStop(0, 'rgba(12,9,6,0)');
  vg.addColorStop(1, `rgba(12,9,6,${opts.edge ?? 0.55})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  return { dx, dy, dw, dh };
}
