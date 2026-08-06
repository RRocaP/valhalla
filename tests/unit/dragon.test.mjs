// src/art/dragon.js must be importable under plain Node — no `document`, no
// canvas, no clock at module scope — and must draw deterministically for a
// given (size, facing, style, t). The look itself is verified visually
// (artifacts/wip-dragon/preview.html + captures), not here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawDragonHead } from '../../src/art/dragon.js';

// A recording 2d context: enough surface for the carve/gold/knot helpers,
// and an op log so two identical calls can be compared exactly.
function stubCtx() {
  const ops = [];
  const grad = { addColorStop: (o, c) => ops.push(['stop', o, c]) };
  const rec = (name) => (...args) => { ops.push([name, ...args.map(round)]); };
  const round = (v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v);
  const ctx = {
    ops,
    save: rec('save'),
    restore: rec('restore'),
    translate: rec('translate'),
    scale: rec('scale'),
    rotate: rec('rotate'),
    beginPath: rec('beginPath'),
    closePath: rec('closePath'),
    moveTo: rec('moveTo'),
    lineTo: rec('lineTo'),
    bezierCurveTo: rec('bezierCurveTo'),
    quadraticCurveTo: rec('quadraticCurveTo'),
    arc: rec('arc'),
    ellipse: rec('ellipse'),
    rect: rec('rect'),
    fill: rec('fill'),
    stroke: rec('stroke'),
    clip: rec('clip'),
    fillRect: rec('fillRect'),
    setLineDash: rec('setLineDash'),
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
  };
  for (const p of ['fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'globalAlpha']) {
    let v;
    Object.defineProperty(ctx, p, {
      get: () => v,
      set: (nv) => { v = nv; ops.push(['set', p, String(nv)]); },
    });
  }
  return ctx;
}

test('dragon.js imports clean in Node with no DOM present', () => {
  assert.equal(typeof globalThis.document, 'undefined');
  assert.equal(typeof drawDragonHead, 'function');
  assert.equal(drawDragonHead.length, 4); // (ctx, x, y, size) + opts default
});

test('drawDragonHead draws without throwing across sizes, facings and styles', () => {
  for (const size of [16, 48, 120, 480]) {
    for (const facing of [1, -1]) {
      for (const style of ['proud', 'ember']) {
        const ctx = stubCtx();
        drawDragonHead(ctx, 100, 200, size, { facing, style });
        assert.ok(ctx.ops.length > 200, `${size}/${facing}/${style} emitted only ${ctx.ops.length} ops`);
      }
    }
  }
});

test('drawDragonHead is deterministic — same inputs, byte-identical op log', () => {
  const a = stubCtx();
  const b = stubCtx();
  drawDragonHead(a, 40, 90, 280, { facing: -1, style: 'proud', t: 0.4 });
  drawDragonHead(b, 40, 90, 280, { facing: -1, style: 'proud', t: 0.4 });
  assert.equal(a.ops.length, b.ops.length);
  assert.deepEqual(a.ops, b.ops);
});

test('t only nudges the glints — the carving itself is unmoved', () => {
  const a = stubCtx();
  const b = stubCtx();
  drawDragonHead(a, 0, 0, 280, { t: 0 });
  drawDragonHead(b, 0, 0, 280, { t: 1 });
  assert.equal(a.ops.length, b.ops.length);
  let differing = 0;
  for (let i = 0; i < a.ops.length; i++) {
    if (JSON.stringify(a.ops[i]) !== JSON.stringify(b.ops[i])) differing++;
  }
  assert.ok(differing > 0, 't had no effect at all');
  assert.ok(differing < a.ops.length * 0.02, `t moved ${differing}/${a.ops.length} ops — that is not a glint`);
});

test('a non-positive size is a no-op rather than a crash', () => {
  for (const size of [0, -10, NaN]) {
    const ctx = stubCtx();
    drawDragonHead(ctx, 0, 0, size);
    assert.equal(ctx.ops.length, 0);
  }
});
