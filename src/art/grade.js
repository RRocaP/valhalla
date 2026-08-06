// Shared "grade a photo into the palette" pixel pipeline: partial
// desaturation -> warm oak-tone multiply -> tar vignette. Used by portrait()
// (dramatic grade) and sticker() (light grade) so the two never drift apart.
import { palette, rgba, mix, hexToRgb } from './palette.js';

export function srcSize(img) {
  const w = img.naturalWidth || img.width || 1;
  const h = img.naturalHeight || img.height || 1;
  return { w, h };
}

// Cover-fit draws `img` into ctx's current w x h canvas, then grades the
// pixels in place. Expects ctx to be a fresh offscreen 2d context sized w x h.
export function gradeInto(ctx, img, w, h, opts = {}) {
  const desat = opts.desat ?? 0.3;
  const multiplyStrength = opts.multiplyStrength ?? 0.5;
  const vignette = opts.vignette ?? 0.55;

  const { w: sw, h: sh } = srcSize(img);
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);

  const rw = Math.max(1, Math.round(w));
  const rh = Math.max(1, Math.round(h));
  const imgData = ctx.getImageData(0, 0, rw, rh);
  const data = imgData.data;
  const tint = hexToRgb(mix(palette.oak, palette.oakLight, 0.4));
  for (let i = 0; i < data.length; i += 4) {
    const r0 = data[i];
    const g0 = data[i + 1];
    const b0 = data[i + 2];
    const lum = r0 * 0.299 + g0 * 0.587 + b0 * 0.114;
    let r1 = r0 + (lum - r0) * desat;
    let g1 = g0 + (lum - g0) * desat;
    let b1 = b0 + (lum - b0) * desat;
    const rM = (r1 * tint.r) / 255;
    const gM = (g1 * tint.g) / 255;
    const bM = (b1 * tint.b) / 255;
    r1 += (rM - r1) * multiplyStrength;
    g1 += (gM - g1) * multiplyStrength;
    b1 += (bM - b1) * multiplyStrength;
    data[i] = r1;
    data[i + 1] = g1;
    data[i + 2] = b1;
  }
  ctx.putImageData(imgData, 0, 0);

  if (vignette > 0) {
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.72);
    vg.addColorStop(0, rgba(palette.tar, 0));
    vg.addColorStop(1, rgba(palette.tar, vignette));
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
}
