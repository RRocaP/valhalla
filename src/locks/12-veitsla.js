// 12 — THE FEAST BENCHES (tier 4)
//
// Eight chieftains, two facing benches of four. Nine oaths were sworn about the
// seating; exactly one of them is a drunken boast — false in the true hall.
// Seat the hall and name the boast.
//
// SEAT GEOMETRY (frozen in this module, stated plainly to the player):
//   bench A = seats 0,1,2,3 · bench B = seats 4,5,6,7, both read left to right
//   from the high seat. The man in seat i faces the man in seat i+4.
//
// OATH SEMANTICS (the only four kinds; all are symmetric in x,y except left-of):
//   opposite(x,y)     |seat(x) - seat(y)| === 4        — they face each other
//   not-adjacent(x,y) NOT(same bench AND |seat difference| === 1)  — a feud
//   left-of(x,y)      same bench AND seat(x) < seat(y) — x sits nearer the high
//                     seat than y; a gift-debt, not necessarily elbow to elbow
//   same-bench(x,y)   same bench
//
// CANONICALISATION (enforced in verify, so the canonical answer is unique):
// bench A is the bench holding the ALPHABETICALLY FIRST chieftain. Swapping the
// two benches wholesale preserves every oath kind, so it is the one symmetry of
// the hall and this rule kills it. No tie-break is needed: the eight names are
// ASCII with distinct initials, so `<` is a total order over the roster. (A
// left-right reflection is NOT a symmetry — any left-of oath forbids it.)
//
// UNIQUENESS: makePuzzle sweeps every seating against every candidate boast —
// docs/LOCKS.md §12's 8!·9 — pruned to the 4·7! canonical seatings, since the
// discarded half is exactly the bench-swap image. A hypothesis (S,k) is valid
// iff every oath but k holds in S and oath k is false in S. Exactly one valid
// pair is required. Because uniqueness holds, verify can check the property
// instead of storing the answer in the instance.
//
// DECOYS: canonical seatings that break exactly one NON-boast oath. Under
// uniqueness such a seating must also break the boast (otherwise it would be a
// second valid pair), so decoys are the two-violation near-misses that satisfy
// seven of the nine sworn oaths. >= 3 are required.
//
// Difficulty accounting (docs/CONTRACT.md §4): 9 oath inspections + 8
// placements + at least one full re-seating pass to test a second boast
// hypothesis (8) + naming the boast + sealing = 28.
//
// PURE HALF: no DOM, no Date, no Math.random, no module-level mutable state.

import { SHARDS } from '../kernel/shards.js';

const ROSTER = [
  'Arnfast', 'Bjolan', 'Dagfinn', 'Eyvind', 'Gunnstein', 'Hjalti', 'Ketil',
  'Ljot', 'Nokkvi', 'Ragnvald', 'Sigtrygg', 'Thorfast', 'Ulfar', 'Vigdis',
];

const KINDS = ['opposite', 'not-adjacent', 'left-of', 'same-bench'];
const benchOf = (seat) => (seat < 4 ? 0 : 1);

function holds(c, pos) {
  const a = pos[c.x];
  const b = pos[c.y];
  switch (c.kind) {
    case 'opposite': return Math.abs(a - b) === 4;
    case 'not-adjacent': return !(benchOf(a) === benchOf(b) && Math.abs(a - b) === 1);
    case 'left-of': return benchOf(a) === benchOf(b) && a < b;
    case 'same-bench': return benchOf(a) === benchOf(b);
    default: return false;
  }
}

function violations(constraints, pos) {
  let mask = 0;
  for (let i = 0; i < constraints.length; i++) if (!holds(constraints[i], pos)) mask |= 1 << i;
  return mask;
}

const popcount = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };

// Every canonical seating: the alphabetically-first chieftain (index 0) on bench A.
function eachCanonicalSeating(fn) {
  const pos = new Array(8);
  const used = new Array(8).fill(false);
  (function rec(person) {
    if (person === 8) { fn(pos); return; }
    for (let s = 0; s < 8; s++) {
      if (used[s] || (person === 0 && s >= 4)) continue;
      used[s] = true;
      pos[person] = s;
      rec(person + 1);
      used[s] = false;
    }
  })(0);
}

// One pass over the canonical hall. Returns the valid (seating, boast) pairs
// and every seating that is within two broken oaths of standing.
function sweepHall(constraints) {
  const solutions = [];
  const nearMisses = [];
  eachCanonicalSeating((pos) => {
    const mask = violations(constraints, pos);
    const bits = popcount(mask);
    if (bits === 1) solutions.push({ pos: pos.slice(), boast: Math.log2(mask) | 0 });
    else if (bits === 2) nearMisses.push({ pos: pos.slice(), mask });
  });
  return { solutions, nearMisses };
}

function decoysFor(nearMisses, boast) {
  const bit = 1 << boast;
  return nearMisses.filter((n) => (n.mask & bit) !== 0);
}

function textFor(kind, x, y, names) {
  const X = names[x];
  const Y = names[y];
  switch (kind) {
    case 'opposite': return `${X} swore he took his meat across the boards from ${Y}.`;
    case 'not-adjacent': return `${X} and ${Y} are at feud: they did not touch elbows.`;
    case 'left-of': return `${X} sat on the same bench as ${Y}, nearer the high seat.`;
    default: return `${X} and ${Y} shared one bench.`;
  }
}

function makeConstraint(r, names, pos, wantTrue) {
  for (let tries = 0; tries < 60; tries++) {
    const kind = r.pick(KINDS);
    const x = r.int(8);
    let y = r.int(8);
    if (x === y) y = (y + 1 + r.int(7)) % 8;
    const c = { kind, x, y };
    if (holds(c, pos) !== wantTrue) continue;
    return { ...c, text: textFor(kind, x, y, names) };
  }
  return null;
}

function buildOaths(r, names, pos) {
  const chosen = [];
  const seen = new Set();
  const key = (c) => (c.kind === 'left-of' ? `${c.kind}:${c.x}:${c.y}` : `${c.kind}:${Math.min(c.x, c.y)}:${Math.max(c.x, c.y)}`);
  for (let i = 0; i < 8; i++) {
    let c = null;
    for (let tries = 0; tries < 40 && !c; tries++) {
      const cand = makeConstraint(r, names, pos, true);
      if (cand && !seen.has(key(cand))) c = cand;
    }
    if (!c) return null;
    seen.add(key(c));
    chosen.push(c);
  }
  let boast = null;
  for (let tries = 0; tries < 60 && !boast; tries++) {
    const cand = makeConstraint(r, names, pos, false);
    if (cand && !seen.has(key(cand))) boast = cand;
  }
  if (!boast) return null;
  const at = r.int(9);
  const oaths = chosen.slice(0, at).concat([boast], chosen.slice(at));
  return { oaths, boastIndex: at };
}

function seatingToBenches(pos, names) {
  const seats = new Array(8);
  for (let person = 0; person < 8; person++) seats[pos[person]] = names[person];
  return [seats.slice(0, 4), seats.slice(4, 8)];
}

function benchesToPos(benches, names) {
  const pos = new Array(names.length).fill(-1);
  for (let b = 0; b < 2; b++) {
    for (let i = 0; i < 4; i++) {
      const person = names.indexOf(benches[b][i]);
      if (person < 0 || pos[person] !== -1) return null;
      pos[person] = b * 4 + i;
    }
  }
  return pos.every((p) => p >= 0) ? pos : null;
}

export default {
  id: '12-veitsla',
  ordinal: 12,
  tier: 4,
  title: 'The Feast Benches',
  epigraph: 'Ale swore nine oaths at that table. Eight of them were sober.',

  makePuzzle(rng) {
    const names = rng.shuffle(ROSTER).slice(0, 8).sort();
    for (let attempt = 0; attempt < 400; attempt++) {
      const order = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
      const pos = new Array(8);
      for (let person = 0; person < 8; person++) pos[person] = order[person];
      if (pos[0] >= 4) for (let p = 0; p < 8; p++) pos[p] = (pos[p] + 4) % 8; // canonicalise
      for (let re = 0; re < 12; re++) {
        const built = buildOaths(rng, names, pos);
        if (!built) continue;
        const { solutions, nearMisses } = sweepHall(built.oaths);
        if (solutions.length !== 1) continue;
        if (solutions[0].boast !== built.boastIndex) continue;
        if (decoysFor(nearMisses, built.boastIndex).length < 3) continue;
        return { names, oaths: built.oaths.map((o) => ({ kind: o.kind, x: o.x, y: o.y, text: o.text })) };
      }
    }
    return { names, oaths: [] };
  },

  solve(instance) {
    const { solutions } = sweepHall(instance.oaths);
    if (solutions.length !== 1) return { benches: [[], []], boast: -1 };
    return {
      benches: seatingToBenches(solutions[0].pos, instance.names),
      boast: solutions[0].boast,
    };
  },

  verify(instance, answer) {
    try {
      if (!instance || !answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
      const { benches, boast } = answer;
      if (!Array.isArray(benches) || benches.length !== 2) return { ok: false };
      if (!benches.every((b) => Array.isArray(b) && b.length === 4 && b.every((s) => typeof s === 'string'))) return { ok: false };
      if (!Number.isInteger(boast) || boast < 0 || boast >= instance.oaths.length) return { ok: false };
      const seated = benches[0].concat(benches[1]);
      if (new Set(seated).size !== 8) return { ok: false };
      if (!seated.every((n) => instance.names.includes(n))) return { ok: false };
      if (!benches[0].includes(instance.names[0])) {
        return { ok: false, near: `The hall is read from the bench that holds ${instance.names[0]}.` };
      }
      const pos = benchesToPos(benches, instance.names);
      if (!pos) return { ok: false };
      const mask = violations(instance.oaths, pos);
      if (mask === 1 << boast) return { ok: true };
      if (mask === 0) return { ok: false, near: 'Not one oath is broken in that hall. One of them must be.' };
      if ((mask & (1 << boast)) === 0) return { ok: false, near: 'The oath you named as the boast still stands in that hall.' };
      return { ok: false, near: 'More than one oath falls, and only one man was drunk.' };
    } catch {
      return { ok: false };
    }
  },

  wrongAnswers(instance) {
    const self = this;
    const { solutions, nearMisses } = sweepHall(instance.oaths);
    const out = [];
    const seen = new Set();
    if (!solutions.length) return out;
    const truth = solutions[0];
    const push = (benches, boast) => {
      const ans = { benches, boast };
      const key = JSON.stringify(ans);
      if (seen.has(key) || self.verify(instance, ans).ok) return;
      seen.add(key);
      out.push(ans);
    };

    for (const d of decoysFor(nearMisses, truth.boast).slice(0, 4)) {
      push(seatingToBenches(d.pos, instance.names), truth.boast);
    }
    const trueBenches = seatingToBenches(truth.pos, instance.names);
    for (let k = 0; k < instance.oaths.length && out.length < 9; k++) {
      if (k !== truth.boast) push([trueBenches[0].slice(), trueBenches[1].slice()], k);
    }
    push([trueBenches[1].slice(), trueBenches[0].slice()], truth.boast); // benches swapped
    const swapped = [trueBenches[0].slice(), trueBenches[1].slice()];
    [swapped[0][0], swapped[0][3]] = [swapped[0][3], swapped[0][0]];
    push(swapped, truth.boast);
    push([trueBenches[0].slice().reverse(), trueBenches[1].slice()], truth.boast);
    return out;
  },

  shard() {
    return { ...SHARDS['12-veitsla'] };
  },

  difficulty: { searchSpace: 3.6e5, minSteps: 28, estMinutes: 18 },

  hints: [
    'Nine men swore. One was in his cups. The other eight agree with each other — and with one seating only.',
    'Take an oath and assume it is the boast: strike it out, then see whether the remaining eight can seat the hall at all. Most of them cannot.',
    'Work from the strongest oaths first. A man set across the boards is set on both benches at once, and a feud tells you where a man is not.',
  ],

  mount(ctx) {
    return { unmount() {} };
  },
};
