// Hand-solve lock 05 from the panel the player can SEE (the aria dump of
// read.json), using nothing from window.__OW. The only inputs are: each tile's
// kind (crossing / carved crossing / carved bend), which band currently lies
// over each crossing, and the board's own stated law ("one band runs the whole
// panel and returns to itself"). The bend handedness and the frame's joining
// offset are not spelled out in text — a player sees them; here they are
// recovered by keeping only the reading under which the panel IS one band.
import { buildLinks, traceBand } from '../../src/locks/05-knotwork.js';

// transcribed from artifacts/wip-ease/read.json -> 05-knotwork.aria
// c = free crossing, C = carved crossing, B = carved bend; ns/we = band over
const PANEL = [
  ['c ns', 'c we', 'c ns', 'C ns'],
  ['c we', 'c we', 'C ns', 'C we'],
  ['c ns', 'c ns', 'B', 'B'],
  ['C ns', 'C we', 'C ns', 'C we'],
];

const flat = PANEL.flat();
const bendAt = flat.map((v, i) => (v === 'B' ? i : -1)).filter((i) => i >= 0);
const carved = flat.map((v, i) => (v[0] === 'C' ? { cell: i, over: v.slice(2) } : null)).filter(Boolean);
const free = flat.map((v, i) => (v[0] === 'c' ? i : -1)).filter((i) => i >= 0);

// Every reading under which the panel is one band, then the weave law: walking
// the run, every other meeting is an "over". A reading survives only if ALL the
// carved crossings the player can see agree with that walk.
const readings = [];
for (const border of ['A', 'B']) {
  for (let mask = 0; mask < (1 << bendAt.length); mask++) {
    const cells = flat.map(() => ({ kind: 'cross' }));
    bendAt.forEach((cell, k) => { cells[cell] = { kind: ((mask >> k) & 1) ? 'bendB' : 'bendA' }; });
    const { single, seq } = traceBand(cells, buildLinks(border));
    if (!single) continue;
    for (const par of [0, 1]) {
      const over = new Array(16).fill(null);
      seq.forEach((s, q) => { if (q % 2 === par) over[s.cell] = s.band; });
      if (carved.every((c) => over[c.cell] === c.over)) readings.push({ border, mask, over });
    }
  }
}
const keys = new Set(readings.map((r) => JSON.stringify(free.map((c) => r.over[c]))));
if (keys.size !== 1) throw new Error(`the visible panel admits ${keys.size} weaves`);
const { border, over } = readings[0];

console.log(JSON.stringify({
  border,
  readings: readings.length,
  freeCells: free,
  answer: Object.fromEntries(free.map((cell) => [cell, over[cell]])),
  toggles: free.filter((cell) => over[cell] !== flat[cell].slice(2)),
}, null, 2));
