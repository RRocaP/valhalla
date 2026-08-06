// 04 — THE CLINKER STRAKES (tier 2, combination)
//
// Nine planks, nine sworn testimonies of the form "X laps Y" — X rests directly
// upon Y. One shipwright swears falsely. Name the false testimony and raise the
// stack from keel to sheer.
//
// THE TWO LAWS (stated plainly to the player in the journal):
//   lap law   — a strake laps the one below it and no other; nine planks, one stack.
//   rivet law — where two strakes lap, one rivet count is odd and the other even.
//
// Pure half: no DOM, no globals, no Math.random, no Date. Only the seeded rng.
//
// CONSTRUCTION. The eight true adjacencies are given, plus one false claim that
// closes the ring: the keel-most plank is sworn to lap the sheer strake. The
// nine claims therefore form a nine-cycle, so *any* one of them may be struck
// out to leave exactly one legal stack — nine structurally identical
// candidates. Only the rivet law separates them: rivet counts alternate parity
// along the true stack, so the false claim joins two planks eight apart (even
// distance, same parity — lawless), every true claim joins planks of opposite
// parity, and each of the eight decoy stacks is a rotation of the truth that
// breaks parity exactly at its wrap. Exactly one (order, liar) pair survives.
//
// Difficulty accounting: nine testimonies each weighed against the rivet law,
// the false one marked, then the stack raised — never fewer than twelve acts.

import { SHARDS } from '../kernel/shards.js';

const COUNT = 9;
const PERM_CAP = 5040;

const MARKS = [
  'the tarred plank', 'the pale plank', 'the knotted plank',
  'the scarfed plank', 'the salt-white plank', 'the resined plank',
  'the green plank', 'the split plank', 'the burnt plank',
];

const WRIGHTS = [
  'Ozurr', 'Hallvard', 'Steinn', 'Bjorn', 'Onund',
  'Thorir', 'Grim', 'Ketil', 'Sigurd',
];

const ODD_RIVETS = [7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31];
const EVEN_RIVETS = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];

// Every stack consistent with a set of lap claims. A claim forces adjacency, so
// the claims cut the planks into fragments and a stack is a concatenation of
// them; returns [] on a doubled claim or a closed ring.
function stacksFrom(claims, n) {
  const succ = new Array(n).fill(-1);
  const pred = new Array(n).fill(-1);
  for (const t of claims) {
    if (!Number.isInteger(t.over) || !Number.isInteger(t.under)) return [];
    if (t.over < 0 || t.over >= n || t.under < 0 || t.under >= n) return [];
    if (t.over === t.under) return [];
    if (succ[t.under] >= 0 || pred[t.over] >= 0) return [];
    succ[t.under] = t.over;
    pred[t.over] = t.under;
  }

  const frags = [];
  const used = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (pred[i] >= 0) continue;
    const frag = [];
    for (let x = i; x >= 0; x = succ[x]) {
      if (used[x]) return [];
      used[x] = true;
      frag.push(x);
    }
    frags.push(frag);
  }
  if (used.indexOf(false) >= 0) return []; // a ring survives

  const out = [];
  const walk = (left, acc) => {
    if (out.length > PERM_CAP) return;
    if (!left.length) { out.push(acc); return; }
    for (let i = 0; i < left.length; i++) {
      walk(left.slice(0, i).concat(left.slice(i + 1)), acc.concat(left[i]));
    }
  };
  walk(frags, []);
  return out;
}

function alternates(planks, order) {
  for (let i = 1; i < order.length; i++) {
    if (planks[order[i]].rivets % 2 === planks[order[i - 1]].rivets % 2) return false;
  }
  return true;
}

// All (order, liar) pairs answering both laws, over every possible liar.
function sweep(instance) {
  const n = instance.planks.length;
  const found = [];
  let legalDrops = 0;
  for (let k = 0; k < instance.testimonies.length; k++) {
    const rest = instance.testimonies.filter((_, i) => i !== k);
    const stacks = stacksFrom(rest, n);
    if (stacks.length) legalDrops++;
    for (const order of stacks) {
      if (alternates(instance.planks, order)) found.push({ liar: k, order });
    }
  }
  return { found, legalDrops };
}

function makePuzzle(rng) {
  const chain = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]); // keel -> sheer
  const marks = rng.shuffle(MARKS);
  const odd = rng.shuffle(ODD_RIVETS);
  const even = rng.shuffle(EVEN_RIVETS);
  const startOdd = rng.chance(0.5);

  const planks = new Array(COUNT);
  let oi = 0, ei = 0;
  chain.forEach((p, k) => {
    const wantOdd = startOdd ? k % 2 === 0 : k % 2 === 1;
    planks[p] = { mark: marks[p], rivets: wantOdd ? odd[oi++] : even[ei++] };
  });

  const claims = [];
  for (let k = 0; k < COUNT - 1; k++) claims.push({ over: chain[k + 1], under: chain[k] });
  claims.push({ over: chain[0], under: chain[COUNT - 1] }); // the ring-closing lie

  const wrights = rng.shuffle(WRIGHTS);
  const testimonies = rng.shuffle(claims).map((c, i) => ({ by: wrights[i], over: c.over, under: c.under }));

  const instance = { planks, testimonies };

  // Exhaustive uniqueness, and proof that the rivet law is genuinely needed.
  const { found, legalDrops } = sweep(instance);
  if (found.length !== 1) return makePuzzle(rng);
  if (legalDrops < 2) return makePuzzle(rng);

  return instance;
}

function solve(instance) {
  const { found } = sweep(instance);
  if (found.length !== 1) return { liar: -1, order: [] };
  return { liar: found[0].liar, order: found[0].order.slice() };
}

function verify(instance, answer) {
  try {
    if (!instance || !Array.isArray(instance.planks) || !Array.isArray(instance.testimonies)) return { ok: false };
    const n = instance.planks.length;
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
    const { order, liar } = answer;
    if (!Array.isArray(order) || order.length !== n) return { ok: false };
    if (!Number.isInteger(liar) || liar < 0 || liar >= instance.testimonies.length) return { ok: false };

    const pos = new Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      const v = order[i];
      if (!Number.isInteger(v) || v < 0 || v >= n || pos[v] >= 0) return { ok: false };
      pos[v] = i;
    }

    const accused = instance.testimonies[liar];
    const lawless = instance.planks[accused.over].rivets % 2 === instance.planks[accused.under].rivets % 2;

    const broken = instance.testimonies.some((t, i) => i !== liar && pos[t.over] !== pos[t.under] + 1);
    const parity = alternates(instance.planks, order);
    if (!broken && parity) return { ok: true };

    if (!lawless) return { ok: false, near: 'That testimony keeps the rivet law. It is no lie.' };
    if (!parity) return { ok: false, near: 'Two strakes of one parity lap in that stack. The rivets forbid it.' };

    const truth = solve(instance).order;
    let stand = 0;
    while (stand < n && order[stand] === truth[stand]) stand++;
    if (stand === 0) return { ok: false, near: 'The garboard is wrong. Nothing above it can stand.' };
    if (stand === 1) return { ok: false, near: 'One strake from the keel stands true. The next does not.' };
    return { ok: false, near: `${stand} strakes from the keel stand true. The next does not.` };
  } catch (e) {
    return { ok: false };
  }
}

function wrongAnswers(instance) {
  const right = solve(instance);
  const n = instance.planks.length;
  const pos = new Array(n).fill(-1);
  right.order.forEach((p, i) => { pos[p] = i; });
  const same = (a) => JSON.stringify(a.order) === JSON.stringify(right.order) && a.liar === right.liar;
  const out = [];

  // The eight rotations: each strikes a true testimony and keeps the lie, which
  // is legal by the lap law and lawless by the rivets.
  instance.testimonies.forEach((t, i) => {
    if (i === right.liar) return;
    const m = pos[t.under];
    if (m < 0 || m >= n - 1) return;
    out.push({ order: right.order.slice(m + 1).concat(right.order.slice(0, m + 1)), liar: i });
  });

  // True stack, wrong accusation.
  const otherLiar = right.liar === 0 ? 1 : 0;
  out.push({ order: right.order.slice(), liar: otherLiar });

  // Right accusation, two strakes changed places.
  const swapped = right.order.slice();
  const t2 = swapped[2]; swapped[2] = swapped[3]; swapped[3] = t2;
  out.push({ order: swapped, liar: right.liar });

  // The stack raised upside down.
  out.push({ order: right.order.slice().reverse(), liar: right.liar });

  return out.filter((a) => !same(a));
}

export default {
  id: '04-strakes',
  ordinal: 4,
  tier: 2,
  title: 'The Clinker Strakes',
  epigraph: 'Nine planks, and nine men who swear. One swears falsely.',

  makePuzzle,
  solve,
  verify,
  wrongAnswers,
  shard: () => ({ ...SHARDS['04-strakes'] }),

  difficulty: {
    searchSpace: 3265920, // 9! stacks x 9 testimonies
    minSteps: 12,
    estMinutes: 5,
  },

  hints: [
    'A strake laps the one below it and no other. Nine planks make one stack, keel to sheer — and these nine testimonies make a ring, which no stack can.',
    'Count the rivets. Where two strakes lap, one count is odd and the other even. Weigh every testimony against that.',
    'Strike the lawless testimony from the ledger and swear by the other eight. What they leave is one stack and no other.',
  ],

  mount(ctx) { return { unmount() {} }; },
};
