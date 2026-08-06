// 03 — THE BEACON NIGHTS (tier 1, teaching)
//
// Three coastal beacons burn on their own reckonings. Each was last lit some
// nights ago. Set the dial to the next night on which all three burn together.
//
// Pure half: no DOM, no globals, no Math.random, no Date. Only the seeded rng.
//
// Uniqueness: the three cycles are pairwise coprime, so the dial (which caps at
// their product, the lcm) holds exactly one night satisfying all three
// congruences. makePuzzle sweeps every night on the dial and requires one.
//
// Difficulty accounting: three cycles to read, three offsets to turn into
// congruences, and the dial to walk — ten deliberate actions before the answer
// stands, and no fire is lit by guessing.

import { SHARDS } from '../kernel/shards.js';

const CYCLES = [3, 4, 5, 7, 9, 11, 13];
const MIN_DIAL = 250;

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

// Every pairwise-coprime triple whose product makes a dial worth walking.
const TRIPLES = (() => {
  const out = [];
  for (let i = 0; i < CYCLES.length; i++) {
    for (let j = i + 1; j < CYCLES.length; j++) {
      for (let k = j + 1; k < CYCLES.length; k++) {
        const [a, b, c] = [CYCLES[i], CYCLES[j], CYCLES[k]];
        if (gcd(a, b) !== 1 || gcd(a, c) !== 1 || gcd(b, c) !== 1) continue;
        if (a * b * c < MIN_DIAL) continue;
        out.push([a, b, c]);
      }
    }
  }
  return out;
})();

const HEADLANDS = [
  'Skarvholm', 'Eldsnes', 'Hafnaberg', 'Kolgrimsey',
  'Vindstad', 'Nordfell', 'Grimsholm', 'Selvik',
];

const burnsOn = (beacon, night) => (night + beacon.lastBurned) % beacon.cycle === 0;
const allBurn = (instance, night) => instance.beacons.every((b) => burnsOn(b, night));

function makePuzzle(rng) {
  const cycles = rng.shuffle(rng.pick(TRIPLES));
  const names = rng.shuffle(HEADLANDS).slice(0, 3);
  const dialMax = cycles[0] * cycles[1] * cycles[2];

  // The night is drawn first, then the offsets are derived from it, so the
  // answer is never tomorrow and never inside the first turn of the longest cycle.
  const lo = Math.max(31, 2 * Math.max(...cycles) + 1);
  const night = rng.range(lo, dialMax);

  const beacons = cycles.map((cycle, i) => ({
    name: names[i],
    cycle,
    lastBurned: ((-night % cycle) + cycle) % cycle, // nights ago; 0 = tonight
  }));

  const instance = { beacons, dialMax };

  // Exhaustive uniqueness across the whole dial.
  let hits = 0;
  for (let t = 1; t <= dialMax; t++) if (allBurn(instance, t)) hits++;
  if (hits !== 1) return makePuzzle(rng);

  return instance;
}

function solve(instance) {
  for (let t = 1; t <= instance.dialMax; t++) if (allBurn(instance, t)) return { night: t };
  return { night: -1 };
}

function verify(instance, answer) {
  try {
    if (!instance || !Array.isArray(instance.beacons) || !Number.isInteger(instance.dialMax)) return { ok: false };
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
    const t = answer.night;
    if (!Number.isInteger(t)) return { ok: false };
    if (t < 1 || t > instance.dialMax) return { ok: false, near: 'The dial does not reach that night.' };

    const lit = instance.beacons.filter((b) => burnsOn(b, t)).length;
    if (lit === instance.beacons.length) return { ok: true };
    if (lit === 0) return { ok: false, near: 'No fire answers that night.' };
    if (lit === 1) return { ok: false, near: 'One fire answers that night. Two stand dark.' };
    return { ok: false, near: 'Two fires answer that night. One stands dark.' };
  } catch (e) {
    return { ok: false };
  }
}

// Next night at or after 1 on which every beacon in `set` burns, or -1.
function nextFor(instance, set) {
  for (let t = 1; t <= instance.dialMax; t++) {
    if (set.every((i) => burnsOn(instance.beacons[i], t))) return t;
  }
  return -1;
}

function wrongAnswers(instance) {
  const right = solve(instance).night;
  const cand = [
    right - 1, right + 1,
    nextFor(instance, [0]), nextFor(instance, [1]), nextFor(instance, [2]),
    nextFor(instance, [0, 1]), nextFor(instance, [0, 2]), nextFor(instance, [1, 2]),
    instance.dialMax,
    instance.beacons.reduce((s, b) => s + b.cycle, 0),
    right + instance.beacons[0].cycle,
    right - instance.beacons[1].cycle,
    right + instance.beacons[2].cycle,
  ];
  const out = [];
  const seen = new Set();
  for (const t of cand) {
    if (!Number.isInteger(t) || t === right || t < 1 || t > instance.dialMax || seen.has(t)) continue;
    seen.add(t);
    out.push({ night: t });
  }
  return out;
}

export default {
  id: '03-beacons',
  ordinal: 3,
  tier: 1,
  title: 'The Beacon Nights',
  epigraph: 'Three fires keep three reckonings. Once they burned as one.',

  makePuzzle,
  solve,
  verify,
  wrongAnswers,
  shard: () => ({ ...SHARDS['03-beacons'] }),

  difficulty: {
    searchSpace: 1287, // the longest dial: 9 x 11 x 13 nights
    minSteps: 10,
    estMinutes: 4,
  },

  hints: [
    'A fire that burned three nights past on a reckoning of five burns again in two.',
    'Take the longest reckoning first. Count only its nights, then try each against the second, and what survives against the third.',
    'Past the three reckonings multiplied the whole pattern comes round again. The night you want lies within one turn of that wheel.',
  ],

  mount(ctx) { return { unmount() {} }; },
};
