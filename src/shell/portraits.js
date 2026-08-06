// Portrait image loading + fallback. docs/ART.md `portrait()`, docs/JARLS.md.
// art.portrait(ctx, img, x, y, w, h, opts?) expects a decoded image; the
// caller (shell) owns decoding the data URI and the missing/undecoded
// fallback, since ART's frozen signature documents no "no image" mode.

export function loadPortraits(portraits) {
  const cache = {};
  for (const key of Object.keys(portraits || {})) {
    const src = portraits[key];
    if (!src) { cache[key] = { img: null, ready: false }; continue; }
    const img = new Image();
    const entry = { img, ready: false };
    img.onload = () => { entry.ready = true; };
    img.onerror = () => { entry.ready = false; entry.img = null; };
    img.src = src;
    cache[key] = entry;
  }
  return cache;
}

export function isPortraitReady(cache, key) {
  const e = cache && cache[key];
  return !!(e && e.ready && e.img);
}

export function portraitImage(cache, key) {
  const e = cache && cache[key];
  return e && e.ready ? e.img : null;
}

// Carved-arch placeholder (silhouette initial + name) for a missing or
// not-yet-decoded portrait. Drawn from primitive palette tokens only — the
// same approach used for the empty-treasure placeholder in the finale.
export function drawPortraitPlaceholder(ctx, palette, x, y, w, h, name) {
  ctx.save();
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.94, 0, Math.PI * 2);
  ctx.fillStyle = palette.oakDeep;
  ctx.fill();
  ctx.lineWidth = Math.max(2, w * 0.025);
  ctx.strokeStyle = palette.gold;
  ctx.stroke();
  ctx.fillStyle = palette.boneDim;
  ctx.font = `600 ${Math.round(r * 0.85)}px 'Iowan Old Style', Palatino, Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((name || '?').trim().charAt(0), cx, cy + r * 0.05);
  ctx.restore();
}
