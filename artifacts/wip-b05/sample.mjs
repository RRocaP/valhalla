// How many pieces does the weave read as, at the starting laying? Drives the
// tally-pip rail's capacity (pure half only — no view, no DOM).
import { rng } from '../../src/kernel/rng.js';
import lock, { buildLinks, traceBand } from '../../src/locks/05-knotwork.js';

const ARCS = { cross: [[0, 2], [3, 1]], bendA: [[0, 3], [1, 2]], bendB: [[0, 1], [2, 3]] };
void ARCS;

function breaksOf(instance, states) {
  const seq = traceBand(instance.cells, buildLinks(instance.border)).seq;
  const map = new Array(16).fill(null);
  instance.cells.forEach((c, i) => { if (c.kind === 'cross' && c.carved) map[i] = c.over; });
  instance.free.forEach((cell, i) => { map[cell] = states[i] ? 'ns' : 'we'; });
  let b = 0;
  for (let q = 0; q < seq.length; q++) {
    const a = seq[q], d = seq[(q + 1) % seq.length];
    if ((map[a.cell] === a.band) === (map[d.cell] === d.band)) b++;
  }
  return { breaks: b, seqLen: seq.length };
}

const rows = [];
for (let s = 1; s <= 60; s++) {
  const inst = lock.makePuzzle(rng(`b05:${s}`));
  const start = breaksOf(inst, inst.initial);
  const done = breaksOf(inst, lock.solve(inst).states);
  rows.push({ s, ...start, solvedBreaks: done.breaks, crossings: inst.cells.filter((c) => c.kind === 'cross').length });
}
const st = rows.map((r) => r.breaks);
const sl = rows.map((r) => r.seqLen);
const sum = (a) => a.reduce((x, y) => x + y, 0);
console.log('seeds            ', rows.length);
console.log('seq length       ', Math.min(...sl), '..', Math.max(...sl));
console.log('start breaks     ', Math.min(...st), '..', Math.max(...st), ' mean', (sum(st) / st.length).toFixed(1));
console.log('odd start breaks ', st.filter((b) => b % 2).length);
console.log('solved breaks max', Math.max(...rows.map((r) => r.solvedBreaks)));
console.log('histogram        ', JSON.stringify(st.reduce((m, b) => (m[b] = (m[b] || 0) + 1, m), {})));
