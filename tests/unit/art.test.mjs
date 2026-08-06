// Unit tests for the pure (DOM-free) helpers inside src/art/**. Only
// functions that never touch `document`/canvas at module scope are
// importable here — canvas drawing itself is verified visually
// (artifacts/wip-art/preview.html + screenshots), not unit-tested.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, relLuminance, hexToRgb, mix, palette } from '../../src/art/palette.js';
import { segIntersect } from '../../src/art/util.js';
import { computeInterlace } from '../../src/art/knot.js';
import { medallionState } from '../../src/art/ornaments.js';

test('contrastRatio: black vs white is ~21:1', () => {
  const ratio = contrastRatio('#000000', '#ffffff');
  assert.ok(Math.abs(ratio - 21) < 0.05, `expected ~21, got ${ratio}`);
});

test('contrastRatio: identical colors is 1:1', () => {
  assert.ok(Math.abs(contrastRatio(palette.gold, palette.gold) - 1) < 1e-9);
});

test('contrastRatio: bone/boneDim clear the 4.5:1 shipping gate over every panel-interior tone', () => {
  const fg = [palette.bone, palette.boneDim];
  const bg = [palette.oakDeep, palette.oak, palette.tar];
  for (const f of fg) {
    for (const b of bg) {
      const ratio = contrastRatio(f, b);
      assert.ok(ratio >= 4.5, `${f} on ${b} = ${ratio.toFixed(2)}:1, below the 4.5:1 gate`);
    }
  }
});

test('relLuminance: white > gold > tar', () => {
  assert.ok(relLuminance('#ffffff') > relLuminance(palette.gold));
  assert.ok(relLuminance(palette.gold) > relLuminance(palette.tar));
});

test('hexToRgb / mix roundtrip stays in hex form (never rgb()/rgba() strings)', () => {
  assert.deepEqual(hexToRgb('#ff0000'), { r: 255, g: 0, b: 0 });
  const midpoint = mix('#000000', '#ffffff', 0.5);
  assert.match(midpoint, /^#[0-9a-f]{6}$/i);
  assert.deepEqual(hexToRgb(midpoint), { r: 128, g: 128, b: 128 });
});

test('segIntersect: a plain X crosses at its center', () => {
  const hit = segIntersect([0, 0], [10, 10], [0, 10], [10, 0]);
  assert.ok(hit);
  assert.ok(Math.abs(hit.x - 5) < 1e-9);
  assert.ok(Math.abs(hit.y - 5) < 1e-9);
});

test('segIntersect: parallel segments never intersect', () => {
  assert.equal(segIntersect([0, 0], [10, 0], [0, 5], [10, 5]), null);
});

test('segIntersect: segments that only touch at a shared endpoint are not a crossing', () => {
  // adjacent segments of a polyline share point [10,0] — must not register
  assert.equal(segIntersect([0, 0], [10, 0], [10, 0], [20, 10]), null);
});

test('computeInterlace: a non-self-crossing polyline has no crossings', () => {
  const pts = [[0, 0], [10, 0], [20, 5], [30, 0]]; // strictly x-monotonic
  const { crossings } = computeInterlace(pts);
  assert.equal(crossings.length, 0);
});

test('computeInterlace: an X-shaped path finds exactly one crossing, alternating over/under', () => {
  const crossingPts = [[0, 0], [10, 10], [0, 10], [10, 0]];
  const { crossings, perSeg } = computeInterlace(crossingPts);
  assert.equal(crossings.length, 1);
  const [a, b] = perSeg[0].concat(perSeg[2]);
  assert.notEqual(a.over, b.over); // one strand over, the other under
});

test('medallionState: derives open/next/sealed thresholds from a scalar progress', () => {
  assert.equal(medallionState(1, 0), 'next');
  assert.equal(medallionState(2, 0), 'sealed');
  assert.equal(medallionState(15, 0), 'sealed');

  assert.equal(medallionState(1, 0.5), 'open');
  assert.equal(medallionState(7, 0.5), 'open'); // round(0.5*15)=8 open
  assert.equal(medallionState(8, 0.5), 'open');
  assert.equal(medallionState(9, 0.5), 'next');
  assert.equal(medallionState(10, 0.5), 'sealed');

  for (let ord = 1; ord <= 15; ord++) {
    assert.equal(medallionState(ord, 1), 'open');
  }
  for (let ord = 2; ord <= 15; ord++) {
    assert.equal(medallionState(ord, 0), ord === 1 ? 'next' : 'sealed');
  }
});

test('medallionState: state is a pure function of (ordinal, progress) — same inputs, same output', () => {
  for (let i = 0; i < 20; i++) {
    assert.equal(medallionState(4, 0.37), medallionState(4, 0.37));
  }
});
