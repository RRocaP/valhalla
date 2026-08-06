// 05 — THE OSEBERG KNOT (tier 2, combination)
//
// A four-by-four panel of strand tiles. Carved tiles cannot be moved; the free
// tiles are crossings, and each may be laid either way — the standing band over
// the running band, or under it. Lay the panel so the whole weave is knotwork.
//
// THE TWO LAWS (stated plainly to the player in the journal):
//   band law  — one band, unbroken, runs the whole panel and returns to itself.
//   weave law — following that band, every crossing goes over, then under, then
//               over: never twice the same.
//
// Pure half: no DOM, no globals, no Math.random, no Date. Only the seeded rng.
//
// CONSTRUCTION. Cell kinds are 'cross' (bands north-south and west-east) and
// two bends; the frame joins the sixteen border ports in adjacent pairs at one
// of two offsets. Kinds and frame alone fix the weave's path, so the generator
// re-rolls until the panel is exactly one closed band over all sixty-four
// ports. A single closed band admits exactly two alternating layings (one the
// inverse of the other); the one or two carved crossings pin one of them, so
// exactly one laying of the free tiles answers both laws. Checked by the literal
// 2^free sweep.
//
// Difficulty accounting: twelve free tiles, of which eleven are laid wrong at
// the start, plus tracing the band from a carved crossing and the closing
// oath — fourteen acts, and no fewer.

import { SHARDS } from '../kernel/shards.js';

const SIDE = 4;
const CELLS = SIDE * SIDE;
const PORTS = CELLS * 4;
const N = 0, E = 1, S = 2, W = 3;
const FREE_TILES = 12;
const REROLL_CAP = 4000;

const portId = (cell, dir) => cell * 4 + dir;

const ARCS = {
  cross: [[N, S], [W, E]],
  bendA: [[N, W], [E, S]],
  bendB: [[N, E], [S, W]],
};

function arcPartner(kind, dir) {
  for (const [a, b] of ARCS[kind]) {
    if (a === dir) return b;
    if (b === dir) return a;
  }
  return -1;
}

// The sixteen border ports, clockwise from the north-west.
function borderRing() {
  const ring = [];
  for (let c = 0; c < SIDE; c++) ring.push(portId(c, N));
  for (let r = 0; r < SIDE; r++) ring.push(portId(r * SIDE + (SIDE - 1), E));
  for (let c = SIDE - 1; c >= 0; c--) ring.push(portId((SIDE - 1) * SIDE + c, S));
  for (let r = SIDE - 1; r >= 0; r--) ring.push(portId(r * SIDE, W));
  return ring;
}

export function buildLinks(border) {
  const links = new Array(PORTS).fill(-1);
  for (let r = 0; r < SIDE; r++) {
    for (let c = 0; c < SIDE; c++) {
      const cell = r * SIDE + c;
      if (c < SIDE - 1) {
        const a = portId(cell, E), b = portId(cell + 1, W);
        links[a] = b; links[b] = a;
      }
      if (r < SIDE - 1) {
        const a = portId(cell, S), b = portId(cell + SIDE, N);
        links[a] = b; links[b] = a;
      }
    }
  }
  const ring = borderRing();
  const off = border === 'B' ? 1 : 0;
  for (let k = 0; k < ring.length; k += 2) {
    const a = ring[(k + off) % ring.length], b = ring[(k + 1 + off) % ring.length];
    links[a] = b; links[b] = a;
  }
  return links;
}

// Follow the band from port 0. Returns whether it is one closed band over every
// port, and the order in which it meets the crossings.
export function traceBand(cells, links) {
  const seen = new Array(PORTS).fill(false);
  const seq = [];
  let p = 0;
  let count = 0;
  while (p >= 0 && !seen[p]) {
    const cell = p >> 2, dir = p & 3;
    const kind = cells[cell] && cells[cell].kind;
    if (!ARCS[kind]) return { single: false, seq: [] };
    const out = arcPartner(kind, dir);
    seen[p] = true;
    seen[portId(cell, out)] = true;
    count += 2;
    if (kind === 'cross') seq.push({ cell, band: (dir === N || dir === S) ? 'ns' : 'we' });
    p = links[portId(cell, out)];
  }
  return { single: count === PORTS && p === 0, seq };
}

// Number of places where the band goes over twice running (0 = lawful weave).
function weaveBreaks(seq, overOf) {
  const len = seq.length;
  if (!len || len % 2 !== 0) return len || 1;
  let breaks = 0;
  for (let q = 0; q < len; q++) {
    const a = seq[q], b = seq[(q + 1) % len];
    if ((overOf[a.cell] === a.band) === (overOf[b.cell] === b.band)) breaks++;
  }
  return breaks;
}

function overMap(instance, states) {
  const map = new Array(CELLS).fill(null);
  instance.cells.forEach((c, i) => { if (c.kind === 'cross' && c.carved) map[i] = c.over; });
  instance.free.forEach((cell, i) => { map[cell] = states[i] ? 'ns' : 'we'; });
  return map;
}

function seqOf(instance) {
  return traceBand(instance.cells, buildLinks(instance.border)).seq;
}

// Every laying of the free tiles that answers both laws (the literal sweep).
function validStates(instance) {
  const seq = seqOf(instance);
  const n = instance.free.length;
  const out = [];
  for (let mask = 0; mask < (1 << n); mask++) {
    const states = [];
    for (let i = 0; i < n; i++) states.push((mask >> i & 1) === 1);
    if (weaveBreaks(seq, overMap(instance, states)) === 0) out.push(states);
  }
  return out;
}

function makePuzzle(rng) {
  for (let attempt = 0; attempt < REROLL_CAP; attempt++) {
    const border = rng.chance(0.5) ? 'A' : 'B';
    const order = [];
    for (let i = 0; i < CELLS; i++) order.push(i);
    const bendCells = rng.shuffle(order).slice(0, rng.range(2, 3));

    const cells = [];
    for (let i = 0; i < CELLS; i++) cells.push({ kind: 'cross', carved: false });
    for (const i of bendCells) cells[i] = { kind: rng.chance(0.5) ? 'bendA' : 'bendB', carved: true };

    const links = buildLinks(border);
    const { single, seq } = traceBand(cells, links);
    if (!single) continue;

    // A single closed band always alternates; check it rather than trust it.
    const first = new Map();
    let lawful = true;
    seq.forEach((s, q) => {
      if (!first.has(s.cell)) first.set(s.cell, q);
      else if ((first.get(s.cell) % 2) === (q % 2)) lawful = false;
    });
    if (!lawful) continue;

    const crossCells = cells.map((c, i) => (c.kind === 'cross' ? i : -1)).filter((i) => i >= 0);
    if (crossCells.length <= FREE_TILES) continue; // at least one carved crossing

    // One of the two alternating layings is the truth.
    const g = rng.int(2);
    const truth = new Array(CELLS).fill(null);
    seq.forEach((s, q) => { if (q % 2 === g) truth[s.cell] = s.band; });

    const free = rng.shuffle(crossCells).slice(0, FREE_TILES).sort((a, b) => a - b);
    for (const i of crossCells) {
      if (free.indexOf(i) >= 0) continue;
      cells[i] = { kind: 'cross', carved: true, over: truth[i] };
    }

    // Laid wrong at the start in every place but one — never the plain inverse.
    const answer = free.map((cell) => truth[cell] === 'ns');
    const kept = rng.int(FREE_TILES);
    const initial = answer.map((v, i) => (i === kept ? v : !v));

    const instance = { border, cells, free, initial };

    const valid = validStates(instance);
    if (valid.length !== 1) continue;
    if (JSON.stringify(valid[0]) !== JSON.stringify(answer)) continue;

    return instance;
  }
  return makePuzzle(rng);
}

function solve(instance) {
  const valid = validStates(instance);
  return { states: valid.length ? valid[0] : [] };
}

function verify(instance, answer) {
  try {
    if (!instance || !Array.isArray(instance.cells) || !Array.isArray(instance.free)) return { ok: false };
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
    const states = answer.states;
    if (!Array.isArray(states) || states.length !== instance.free.length) return { ok: false };
    for (const s of states) if (typeof s !== 'boolean') return { ok: false };

    const seq = seqOf(instance);
    if (!seq.length) return { ok: false };
    const breaks = weaveBreaks(seq, overMap(instance, states));
    if (breaks === 0) return { ok: true };
    if (breaks === 1) return { ok: false, near: 'The band doubles over in one place.' };
    return { ok: false, near: `The band doubles over in ${breaks} places.` };
  } catch (e) {
    return { ok: false };
  }
}

function wrongAnswers(instance) {
  const right = solve(instance).states;
  const key = JSON.stringify(right);
  const out = [];
  const push = (states) => { if (JSON.stringify(states) !== key) out.push({ states }); };

  push(right.map((s) => !s));
  push(right.map(() => true));
  push(right.map(() => false));
  push(instance.free.map((cell) => cell % 2 === 0));
  push(instance.free.map((cell) => (((cell >> 2) + (cell & 3)) % 2) === 0));
  push(instance.initial.slice());
  for (const i of [0, right.length >> 1, right.length - 1]) {
    push(right.map((s, j) => (j === i ? !s : s)));
  }

  const seen = new Set();
  return out.filter((a) => {
    const k = JSON.stringify(a.states);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export default {
  id: '05-knotwork',
  ordinal: 5,
  tier: 2,
  title: 'The Oseberg Knot',
  epigraph: 'One band, and no end to it. It goes over where it went under.',

  makePuzzle,
  solve,
  verify,
  wrongAnswers,
  shard: () => ({ ...SHARDS['05-knotwork'] }),

  difficulty: {
    searchSpace: 4096, // 2^12 layings of the free tiles
    minSteps: 14,
    estMinutes: 6,
  },

  hints: [
    'One band runs the whole panel and comes back to itself. Follow it from a carved crossing and do not lift your eye.',
    'Where the band meets itself it goes over, then under, then over again. Never twice the same.',
    'The carved crossings cannot be moved, and they set the count for every crossing that follows along the run. Begin at one and lay each crossing as the band demands.',
  ],

  mount(ctx) { return { unmount() {} }; },
};
