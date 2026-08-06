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
  // Exposure controls. All three default to 0 = the original pipeline, so
  // sticker()'s grade is untouched; portrait() opts into them.
  //  preserveLum — restore the pre-tint luminance after the warm multiply, so
  //    the oak tint shifts HUE and leaves exposure alone (a plain multiply by
  //    the tint costs ~40% of every portrait's brightness, which is what put
  //    the jarls' faces in silhouette).
  //  lift — gamma lift, so hair, fur and leather keep their detail instead of
  //    collapsing into one black mass.
  //  vignetteEdge — when > 0 the tar falloff starts at (1 - edge) of the
  //    corner radius: only the outermost `edge` of the frame darkens at all.
  const preserveLum = opts.preserveLum ?? 0;
  const lift = opts.lift ?? 0;
  const vignetteEdge = opts.vignetteEdge ?? 0;

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
  // 256-entry gamma LUT: the lift is a per-channel pow(), and a phone should
  // not pay ~1.3M Math.pow calls to open one dare card.
  let liftLut = null;
  if (lift > 0) {
    const gamma = 1 - lift * 0.36;
    liftLut = new Float32Array(256);
    for (let v = 0; v < 256; v++) liftLut[v] = 255 * Math.pow(v / 255, gamma);
  }
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
    if (preserveLum > 0) {
      // desaturation is luminance-preserving, so `lum` is still the target
      const lum1 = r1 * 0.299 + g1 * 0.587 + b1 * 0.114;
      if (lum1 > 0.5) {
        const gain = 1 + (lum / lum1 - 1) * preserveLum;
        r1 *= gain;
        g1 *= gain;
        b1 *= gain;
      }
    }
    if (liftLut) {
      r1 = liftLut[r1 < 0 ? 0 : r1 > 255 ? 255 : r1 | 0];
      g1 = liftLut[g1 < 0 ? 0 : g1 > 255 ? 255 : g1 | 0];
      b1 = liftLut[b1 < 0 ? 0 : b1 > 255 ? 255 : b1 | 0];
    }
    data[i] = r1;
    data[i + 1] = g1;
    data[i + 2] = b1;
  }
  ctx.putImageData(imgData, 0, 0);

  if (vignette > 0) {
    // corner-only falloff when vignetteEdge is set: r0 sits at (1 - edge) of
    // the half-diagonal, so the flanks (and the whole face) stay untouched and
    // only the corners take tar.
    const corner = Math.hypot(w, h) / 2;
    const r0 = vignetteEdge > 0 ? corner * (1 - vignetteEdge) : Math.min(w, h) * 0.28;
    const r1 = vignetteEdge > 0 ? corner : Math.max(w, h) * 0.72;
    const vg = ctx.createRadialGradient(w / 2, h / 2, r0, w / 2, h / 2, r1);
    vg.addColorStop(0, rgba(palette.tar, 0));
    vg.addColorStop(1, rgba(palette.tar, vignette));
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
}
