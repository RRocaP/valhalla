// Frozen palette (docs/ART.md) + pure color math. No DOM access anywhere in
// this file — must be importable under plain Node for unit tests.

export const palette = {
  oakDeep: '#221507', oak: '#3a2412', oakLight: '#5a3a1e', tar: '#0c0906',
  gold: '#c9a227', goldBright: '#eecf6d', blood: '#8f1f1f', ember: '#c25c33',
  fjord: '#1d3a5f', fjordLight: '#3f6d9e', pine: '#1e3d2a', pineLight: '#3c6b4a',
  bone: '#e9dcc3', boneDim: '#b7a98c',
};

export function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function toHex({ r, g, b }) {
  const h = (n) => clampByte(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function rgba(hex, a = 1) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// Returns a hex string (never an rgb()/rgba() string) so callers can safely
// pipe the result back into rgba()/mix() without a format mismatch.
export function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return toHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

function srgbToLinear(c) {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

export function relLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function contrastRatio(hexA, hexB) {
  const la = relLuminance(hexA);
  const lb = relLuminance(hexB);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export const clamp01 = (v) => Math.max(0, Math.min(1, v));

// The DOM heading relief recipe (material-type mandate, docs/ART.md):
// paired 1px shadows, tar above-left / goldBright ~18% below-right. A CSS
// `text-shadow` value string — shell's style.js applies it to headings.
export const reliefShadowCss = `-1px -1px 0 ${rgba(palette.tar, 0.85)}, 1px 1px 0 ${rgba(palette.goldBright, 0.18)}`;
