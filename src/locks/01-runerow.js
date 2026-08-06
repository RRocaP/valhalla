// 01 — THE RUNE ROW (tier 1, teaching)
//
// Sixteen carved staves of the Younger Futhark lie jumbled on the lid; three or
// four were struck from the wrong face (wend-runes). Restore the row.
//
// Pure half: no DOM, no globals, no Math.random, no Date. Only the seeded rng.
//
// Uniqueness (docs/LOCKS.md common law): the sixteen staves are pairwise
// distinct, so the futhark row admits exactly one placement, and each tile's
// face is fixed by whether it was carved backwards. makePuzzle asserts the
// distinctness that makes that argument exhaustive.
//
// Difficulty accounting: eight tiles are displaced and three or four are cut
// backwards; the optimal line is at least six slides plus the flips, and every
// tile must be read against the rail before it is judged.

import { FUTHARK, ORDER } from '../kernel/futhark.js';
import { SHARDS } from '../kernel/shards.js';

const N = 16;
const JUMBLED = 8;
// The three ættir of the Younger Futhark: six, five, five.
const AETTIR = [[0, 6], [6, 11], [11, 16]];
const AETT_WORD = ['first', 'second', 'third'];

const rd = (v) => Math.round(v * 1e4) / 1e4;
const segKey = (seg) => {
  const fwd = seg.map((p) => p.map(rd).join(',')).join(' ');
  const rev = seg.slice().reverse().map((p) => p.map(rd).join(',')).join(' ');
  return fwd < rev ? fwd : rev;
};
const shapeKey = (segs) => segs.map(segKey).sort().join('|');
const mirrorSegs = (segs) => segs.map((seg) => seg.map(([x, y]) => [1 - x, y]));

const SHAPES = FUTHARK.map((r) => shapeKey(r.segments));
const MIRRORED = FUTHARK.map((r) => shapeKey(mirrorSegs(r.segments)));

// A stave may be cut backwards only if its mirror is visibly other than itself
// and other than every stave in the row — otherwise the player could not tell.
export const WENDABLE = FUTHARK
  .filter((r, i) => MIRRORED[i] !== SHAPES[i] && !SHAPES.some((s, j) => j !== i && s === MIRRORED[i]))
  .map((r) => r.ch);

function makePuzzle(rng) {
  const all = [];
  for (let i = 0; i < N; i++) all.push(i);

  const chosen = rng.shuffle(all).slice(0, JUMBLED).sort((a, b) => a - b);
  let perm = chosen;
  for (let guard = 0; guard < 200; guard++) {
    perm = rng.shuffle(chosen);
    if (perm.every((p, k) => p !== chosen[k])) break;
  }

  const display = ORDER.slice();
  chosen.forEach((pos, k) => { display[pos] = ORDER[perm[k]]; });

  const wendable = display.map((ch, i) => (WENDABLE.indexOf(ch) >= 0 ? i : -1)).filter((i) => i >= 0);
  const wend = rng.shuffle(wendable).slice(0, rng.range(3, 4));

  const tiles = display.map((ch, i) => ({ ch, wend: wend.indexOf(i) >= 0 }));

  // Exhaustive uniqueness: sixteen distinct staves, so the row has one filling.
  const marks = new Set(tiles.map((t) => t.ch));
  if (marks.size !== N) return makePuzzle(rng);

  return { tiles };
}

function solve(instance) {
  const order = ORDER.map((ch) => instance.tiles.findIndex((t) => t.ch === ch));
  const flips = order.map((i) => !!instance.tiles[i].wend);
  return { flips, order };
}

function wrongPositions(instance, order, flips) {
  const wrong = [];
  for (let p = 0; p < N; p++) {
    const t = instance.tiles[order[p]];
    if (!t || t.ch !== ORDER[p] || flips[p] !== !!t.wend) wrong.push(p);
  }
  return wrong;
}

function verify(instance, answer) {
  try {
    if (!instance || !Array.isArray(instance.tiles) || instance.tiles.length !== N) return { ok: false };
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
    const { order, flips } = answer;
    if (!Array.isArray(order) || !Array.isArray(flips)) return { ok: false };
    if (order.length !== N || flips.length !== N) return { ok: false };
    const seen = new Set();
    for (const v of order) {
      if (!Number.isInteger(v) || v < 0 || v >= N || seen.has(v)) return { ok: false };
      seen.add(v);
    }
    for (const f of flips) if (typeof f !== 'boolean') return { ok: false };

    const wrong = wrongPositions(instance, order, flips);
    if (!wrong.length) return { ok: true };

    const placedRight = order.every((i, p) => instance.tiles[i].ch === ORDER[p]);
    if (placedRight) return { ok: false, near: 'The row stands in order, but a stave still faces the wrong hand.' };

    const whole = AETTIR
      .map((a, k) => (wrong.some((p) => p >= a[0] && p < a[1]) ? null : AETT_WORD[k]))
      .filter(Boolean);
    if (!whole.length) return { ok: false, near: 'No ætt stands whole.' };
    if (whole.length === 1) return { ok: false, near: `The ${whole[0]} ætt stands true. The rest does not.` };
    return { ok: false, near: `The ${whole[0]} and ${whole[1]} ættir stand true. The rest does not.` };
  } catch (e) {
    return { ok: false };
  }
}

function wrongAnswers(instance) {
  const right = solve(instance);
  const out = [];
  const push = (a) => {
    if (JSON.stringify(a.order) !== JSON.stringify(right.order) ||
        JSON.stringify(a.flips) !== JSON.stringify(right.flips)) out.push(a);
  };
  const idn = [];
  for (let i = 0; i < N; i++) idn.push(i);

  push({ order: right.order.slice(), flips: right.flips.map(() => false) });
  push({ order: right.order.slice(), flips: right.flips.map(() => true) });
  push({ order: right.order.slice(), flips: right.flips.map((f, i) => (i === right.flips.indexOf(true) ? !f : f)) });
  push({ order: idn.slice(), flips: idn.map((i) => !!instance.tiles[i].wend) });
  push({ order: idn.slice().reverse(), flips: idn.map(() => false) });
  push({ order: right.order.slice().reverse(), flips: right.flips.slice().reverse() });
  push({ order: right.order.slice(), flips: right.flips.map((f, i) => right.flips[(i + 1) % N]) });
  const swapped = right.order.slice();
  const tmp = swapped[3]; swapped[3] = swapped[4]; swapped[4] = tmp;
  push({ order: swapped, flips: right.flips.slice() });
  return out;
}

export default {
  id: '01-runerow',
  ordinal: 1,
  tier: 1,
  title: 'The Rune Row',
  epigraph: 'Sixteen staves stand in one order. The carver\'s hand slipped, or lied.',

  makePuzzle,
  solve,
  verify,
  wrongAnswers,
  shard: () => ({ ...SHARDS['01-runerow'] }),

  difficulty: {
    searchSpace: 1.4e18, // 16! orders x 2^16 faces
    minSteps: 8,
    estMinutes: 2,
  },

  hints: [
    'The carver scattered the row. He did not change it — the futhark keeps one order, and it is cut along the rail.',
    'Some staves were struck from the wrong face. A stave that faces the wrong hand matches nothing on the rail.',
    'Judge a tile\'s face before its place. Then set the ættir in turn: six, five, five.',
  ],

  mount(ctx) { return { unmount() {} }; },
};
