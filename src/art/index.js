// STUB — replaced wholesale by the ART worker (docs/ART.md is the contract).
// Keeps the pipeline runnable: flat wood, kernel-stroke runes, plain shapes.
import { BY_CH } from '../kernel/futhark.js';

const palette = {
  oakDeep: '#221507', oak: '#3a2412', oakLight: '#5a3a1e', tar: '#0c0906',
  gold: '#c9a227', goldBright: '#eecf6d', blood: '#8f1f1f', ember: '#c25c33',
  fjord: '#1d3a5f', fjordLight: '#3f6d9e', pine: '#1e3d2a', pineLight: '#3c6b4a',
  bone: '#e9dcc3', boneDim: '#b7a98c',
};

export function createArt() {
  const dpr = () => Math.min(globalThis.devicePixelRatio || 1, 3);
  return {
    palette,
    makeCanvas(w, h) {
      const canvas = document.createElement('canvas');
      const d = dpr();
      canvas.width = Math.round(w * d);
      canvas.height = Math.round(h * d);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      const ctx = canvas.getContext('2d');
      ctx.scale(d, d);
      return { canvas, ctx, w, h };
    },
    paintWood(ctx, w, h) {
      ctx.fillStyle = palette.oak;
      ctx.fillRect(0, 0, w, h);
    },
    paintPanel(ctx, x, y, w, h) {
      ctx.fillStyle = palette.oakDeep;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = palette.gold;
      ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    },
    drawRune(ctx, ch, x, y, size, opts = {}) {
      const r = BY_CH[ch];
      if (!r) return;
      ctx.save();
      ctx.translate(x, y);
      if (opts.mirror) { ctx.translate(size, 0); ctx.scale(-1, 1); }
      ctx.strokeStyle = opts.color || palette.bone;
      ctx.lineWidth = Math.max(2, size / 9);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const seg of r.segments) {
        ctx.beginPath();
        seg.forEach(([px, py], i) => (i ? ctx.lineTo(px * size, py * size) : ctx.moveTo(px * size, py * size)));
        ctx.stroke();
      }
      ctx.restore();
    },
    drawKnot(ctx, points, opts = {}) {
      ctx.strokeStyle = opts.color || palette.gold;
      ctx.lineWidth = opts.width || 4;
      ctx.beginPath();
      points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.stroke();
    },
    ornament() {},
    medallion(ctx, x, y, r, state) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = state === 'open' ? palette.gold : state === 'next' ? palette.ember : palette.tar;
      ctx.fill();
    },
    glow() {},
    chestScene(ctx, w, h) {
      ctx.fillStyle = palette.oakDeep;
      ctx.fillRect(0, 0, w, h);
    },
    treasureFrame(ctx, w, h) {
      ctx.strokeStyle = palette.gold;
      ctx.strokeRect(8, 8, w - 16, h - 16);
    },
  };
}
