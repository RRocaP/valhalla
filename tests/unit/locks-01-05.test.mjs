// OATHWOOD — unit gate for locks 01–05 (OW-LOCKS-A).
// Every uniqueness claim below is measured through the lock's own `verify`,
// which is the contract-facing surface, and by a sweep written here rather than
// by re-using the lock's solver.

import test from 'node:test';
import assert from 'node:assert/strict';

import { rng } from '../../src/kernel/rng.js';
import { SHARDS } from '../../src/kernel/shards.js';
import { ORDER } from '../../src/kernel/futhark.js';

import lock01, { WENDABLE } from '../../src/locks/01-runerow.js';
import lock02 from '../../src/locks/02-bismer.js';
import lock03 from '../../src/locks/03-beacons.js';
import lock04 from '../../src/locks/04-strakes.js';
import lock05, { buildLinks, traceBand } from '../../src/locks/05-knotwork.js';

const LOCKS = [lock01, lock02, lock03, lock04, lock05];
const FLOORS = { 1: [6, 2], 2: [8, 3], 3: [10, 4], 4: [12, 5], 5: [14, 6] };
const SEEDS = 40;

const inst = (lock, s) => lock.makePuzzle(rng(`ut-${lock.id}-${s}`));
const JUNK = [null, undefined, 42, 'skål', [], {}, true, { order: null }, { states: 'x' }, [1, 2, 3]];

// ---------------------------------------------------------------- shared laws

for (const lock of LOCKS) {
  test(`${lock.id} — interface`, () => {
    assert.equal(typeof lock.id, 'string');
    assert.equal(lock.ordinal, Number(lock.id.slice(0, 2)));
    assert.ok([1, 2, 3, 4].includes(lock.tier));
    assert.ok(lock.title.length > 0);
    assert.ok(lock.epigraph.length > 0);
    assert.ok((lock.epigraph.match(/[.!?]/g) || []).length <= 2, 'epigraph is at most two sentences');
    assert.equal(lock.hints.length, 3);
    for (const h of lock.hints) {
      assert.equal(typeof h, 'string');
      assert.ok(h.trim().length > 12);
    }
    for (const fn of ['makePuzzle', 'solve', 'verify', 'wrongAnswers', 'shard', 'mount']) {
      assert.equal(typeof lock[fn], 'function', `missing ${fn}`);
    }
  });

  test(`${lock.id} — difficulty floor and ramp`, () => {
    const [ms, em] = FLOORS[lock.ordinal];
    assert.ok(lock.difficulty.minSteps >= ms, `minSteps ${lock.difficulty.minSteps} < ${ms}`);
    assert.ok(lock.difficulty.estMinutes >= em, `estMinutes ${lock.difficulty.estMinutes} < ${em}`);
    assert.ok(lock.difficulty.searchSpace > 0);
    const prev = LOCKS[lock.ordinal - 2];
    if (prev) {
      assert.ok(lock.difficulty.minSteps >= prev.difficulty.minSteps, 'minSteps must not decrease');
      assert.ok(lock.difficulty.estMinutes >= prev.difficulty.estMinutes, 'estMinutes must not decrease');
    }
  });

  test(`${lock.id} — solve verifies over ${SEEDS} seeds`, () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = inst(lock, s);
      const v = lock.verify(i, lock.solve(i));
      assert.equal(v.ok, true, `seed ${s} rejected its own solution`);
    }
  });

  test(`${lock.id} — wrong answers all reject`, () => {
    for (let s = 0; s < SEEDS; s++) {
      const i = inst(lock, s);
      const right = JSON.stringify(lock.solve(i));
      const wrongs = lock.wrongAnswers(i);
      assert.ok(wrongs.length >= 6, `seed ${s}: only ${wrongs.length} wrong answers`);
      for (const w of wrongs) {
        assert.notEqual(JSON.stringify(w), right, `seed ${s}: a wrong answer equals the solution`);
        assert.notEqual(lock.verify(i, w).ok, true, `seed ${s}: accepted ${JSON.stringify(w)}`);
      }
    }
  });

  test(`${lock.id} — malformed answers reject without throwing`, () => {
    const i = inst(lock, 3);
    for (const junk of JUNK) {
      const v = lock.verify(i, junk);
      assert.ok(v && v.ok === false, `accepted junk ${JSON.stringify(junk)}`);
    }
    // a structurally right answer with the wrong leaf types
    const right = lock.solve(i);
    for (const key of Object.keys(right)) {
      const bent = JSON.parse(JSON.stringify(right));
      bent[key] = Array.isArray(bent[key]) ? bent[key].map(() => 'x') : 'x';
      assert.notEqual(lock.verify(i, bent).ok, true, `accepted bent key ${key}`);
    }
    for (const bad of [{}, null, undefined, 'x', 7]) {
      assert.notEqual(lock.verify(bad, right).ok, true, 'accepted a malformed instance');
    }
  });

  test(`${lock.id} — determinism`, () => {
    for (let s = 0; s < 12; s++) {
      const a = lock.makePuzzle(rng(`det-${lock.id}-${s}`));
      const b = lock.makePuzzle(rng(`det-${lock.id}-${s}`));
      assert.equal(JSON.stringify(a), JSON.stringify(b), `seed ${s} unstable`);
    }
  });

  test(`${lock.id} — shard is the frozen constant`, () => {
    const want = SHARDS[lock.id];
    for (let s = 0; s < 5; s++) {
      assert.deepEqual(lock.shard(inst(lock, s)), want);
    }
  });
}

test('pure halves run with the world taken away', () => {
  const G = globalThis;
  const keep = { random: Math.random, Date: G.Date, document: G.document, window: G.window };
  const boom = (what) => () => { throw new Error(`purity violation: ${what}`); };
  Math.random = boom('Math.random');
  G.document = new Proxy({}, { get: boom('document'), has: boom('document') });
  G.window = new Proxy({}, { get: boom('window'), has: boom('window') });
  G.Date = new Proxy(keep.Date, { construct: boom('new Date'), apply: boom('Date()') });
  try {
    for (const lock of LOCKS) {
      const i = lock.makePuzzle(rng(`pure-${lock.id}`));
      const a = lock.solve(i);
      assert.equal(lock.verify(i, a).ok, true);
      lock.wrongAnswers(i);
      lock.shard(i);
    }
  } finally {
    Math.random = keep.random;
    G.Date = keep.Date;
    if (keep.document === undefined) delete G.document; else G.document = keep.document;
    if (keep.window === undefined) delete G.window; else G.window = keep.window;
  }
});

// ------------------------------------------------------------------- 01 staves

test('01 — sixteen distinct staves, eight displaced, faces only where the mirror shows', () => {
  for (let s = 0; s < SEEDS; s++) {
    const i = inst(lock01, s);
    assert.equal(i.tiles.length, 16);
    assert.equal(new Set(i.tiles.map((t) => t.ch)).size, 16);

    const displaced = i.tiles.filter((t, p) => t.ch !== ORDER[p]).length;
    assert.equal(displaced, 8, `seed ${s}: ${displaced} displaced, want 8`);

    const wend = i.tiles.filter((t) => t.wend);
    assert.ok(wend.length >= 3 && wend.length <= 4, `seed ${s}: ${wend.length} wend-runes`);
    for (const t of wend) {
      assert.ok(WENDABLE.includes(t.ch), `seed ${s}: ${t.ch} cannot be told apart when mirrored`);
    }
  }
});

test('01 — the row is the futhark and the faces are the carved ones', () => {
  for (let s = 0; s < 12; s++) {
    const i = inst(lock01, s);
    const { order, flips } = lock01.solve(i);
    order.forEach((tile, p) => {
      assert.equal(i.tiles[tile].ch, ORDER[p]);
      assert.equal(flips[p], i.tiles[tile].wend);
    });
    // every single perturbation is refused
    for (let p = 0; p < 16; p++) {
      const bentFlips = flips.slice();
      bentFlips[p] = !bentFlips[p];
      assert.notEqual(lock01.verify(i, { order, flips: bentFlips }).ok, true);
    }
    for (let p = 0; p < 15; p++) {
      const bent = order.slice();
      const t = bent[p]; bent[p] = bent[p + 1]; bent[p + 1] = t;
      assert.notEqual(lock01.verify(i, { order: bent, flips }).ok, true);
    }
  }
});

// ------------------------------------------------------------------ 02 scales

test('02 — every pouch is sworn to one weight and the pans are even', () => {
  for (let s = 0; s < SEEDS; s++) {
    const i = inst(lock02, s);
    assert.equal(i.pouches.length, 9);
    assert.equal(new Set(i.pouches.map((p) => p.seal)).size, 9);
    for (const p of i.pouches) {
      assert.equal(p.mark * 24 + p.ore * 3 + p.ertog, i.swornErtog, 'a label does not convert to the sworn weight');
      assert.ok(Number.isInteger(p.mark) && p.mark >= 0);
      assert.ok(Number.isInteger(p.ore) && p.ore >= 0);
      assert.ok(Number.isInteger(p.ertog) && p.ertog >= 0);
    }
    // the labels are written in different mixed forms — that is the work
    const forms = new Set(i.pouches.map((p) => `${p.mark}/${p.ore}/${p.ertog}`));
    assert.ok(forms.size >= 2, `seed ${s}: every label is written the same way`);
    assert.equal(i.weighings.length, 2);
    for (const w of i.weighings) {
      assert.equal(w.left.length, 3);
      assert.equal(w.right.length, 3);
      assert.equal(w.aside.length, 3);
      assert.equal(new Set([...w.left, ...w.right, ...w.aside]).size, 9);
      assert.ok(['left', 'right', 'level'].includes(w.tilt));
    }
  }
});

test('02 — exactly one pouch answers the ledger (sweep of nine)', () => {
  for (let s = 0; s < SEEDS; s++) {
    const i = inst(lock02, s);
    const ok = [];
    for (let p = 0; p < 9; p++) if (lock02.verify(i, { pouch: p }).ok) ok.push(p);
    assert.equal(ok.length, 1, `seed ${s}: ${ok.length} consistent pouches`);
    assert.equal(ok[0], lock02.solve(i).pouch);
  }
});

// ----------------------------------------------------------------- 03 beacons

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

test('03 — cycles are pairwise coprime and the dial caps at their product', () => {
  for (let s = 0; s < SEEDS; s++) {
    const i = inst(lock03, s);
    const c = i.beacons.map((b) => b.cycle);
    assert.equal(c.length, 3);
    assert.equal(gcd(c[0], c[1]), 1);
    assert.equal(gcd(c[0], c[2]), 1);
    assert.equal(gcd(c[1], c[2]), 1);
    assert.equal(i.dialMax, c[0] * c[1] * c[2]);
    assert.ok(i.dialMax >= 250);
    assert.equal(new Set(i.beacons.map((b) => b.name)).size, 3);
    for (const b of i.beacons) assert.ok(b.lastBurned >= 0 && b.lastBurned < b.cycle);
  }
});

test('03 — exactly one night on the whole dial, and it is not near at hand', () => {
  for (let s = 0; s < SEEDS; s++) {
    const i = inst(lock03, s);
    const ok = [];
    for (let t = 1; t <= i.dialMax; t++) if (lock03.verify(i, { night: t }).ok) ok.push(t);
    assert.equal(ok.length, 1, `seed ${s}: ${ok.length} nights answer`);
    const night = lock03.solve(i).night;
    assert.equal(ok[0], night);
    assert.ok(night > 2 * Math.max(...i.beacons.map((b) => b.cycle)), `seed ${s}: night ${night} is too near`);
    assert.notEqual(lock03.verify(i, { night: night + i.dialMax }).ok, true, 'the dial must cap');
    for (const h of lock03.hints) assert.ok(!h.includes(String(night)), 'a hint names the night');
  }
});

// ----------------------------------------------------------------- 04 strakes

function eachPermutation(n, fn) {
  const a = [];
  for (let i = 0; i < n; i++) a.push(i);
  const c = new Array(n).fill(0);
  fn(a);
  let i = 0;
  while (i < n) {
    if (c[i] < i) {
      const j = i % 2 ? c[i] : 0;
      const t = a[i]; a[i] = a[j]; a[j] = t;
      fn(a);
      c[i]++;
      i = 0;
    } else {
      c[i] = 0;
      i++;
    }
  }
}

test('04 — exactly one testimony breaks the rivet law', () => {
  for (let s = 0; s < SEEDS; s++) {
    const i = inst(lock04, s);
    assert.equal(i.planks.length, 9);
    assert.equal(i.testimonies.length, 9);
    assert.equal(new Set(i.planks.map((p) => p.rivets)).size, 9, 'rivet counts must be distinct');
    assert.equal(new Set(i.planks.map((p) => p.mark)).size, 9);
    assert.equal(new Set(i.testimonies.map((t) => t.by)).size, 9);

    const lawless = i.testimonies.filter(
      (t) => i.planks[t.over].rivets % 2 === i.planks[t.under].rivets % 2,
    );
    assert.equal(lawless.length, 1, `seed ${s}: ${lawless.length} lawless testimonies`);
    assert.equal(i.testimonies.indexOf(lawless[0]), lock04.solve(i).liar);
  }
});

test('04 — exactly one (stack, liar) pair over all 9! stacks', () => {
  for (let s = 0; s < 3; s++) {
    const i = inst(lock04, s);
    const pos = new Array(9);
    const found = [];
    eachPermutation(9, (order) => {
      for (let k = 1; k < 9; k++) {
        if (i.planks[order[k]].rivets % 2 === i.planks[order[k - 1]].rivets % 2) return;
      }
      order.forEach((p, k) => { pos[p] = k; });
      let bad = -1;
      for (let t = 0; t < 9; t++) {
        const c = i.testimonies[t];
        if (pos[c.over] === pos[c.under] + 1) continue;
        if (bad >= 0) return; // two broken testimonies: no single liar can explain it
        bad = t;
      }
      if (bad >= 0) found.push({ order: order.slice(), liar: bad });
    });
    assert.equal(found.length, 1, `seed ${s}: ${found.length} lawful (stack, liar) pairs`);
    assert.equal(lock04.verify(i, found[0]).ok, true);
    assert.deepEqual(found[0], lock04.solve(i));
  }
});

test('04 — the rivet law is needed: several testimonies could be struck for the lap law alone', () => {
  for (let s = 0; s < 12; s++) {
    const i = inst(lock04, s);
    const right = lock04.solve(i);
    // Each decoy keeps the lap law and fails only on the rivets.
    const decoys = lock04.wrongAnswers(i).filter((a) => a.liar !== right.liar);
    assert.ok(decoys.length >= 2, `seed ${s}: only ${decoys.length} rival stacks`);
    const pos = new Array(9);
    let lapLawful = 0;
    for (const d of decoys) {
      d.order.forEach((p, k) => { pos[p] = k; });
      const keeps = i.testimonies.every((t, k) => k === d.liar || pos[t.over] === pos[t.under] + 1);
      if (keeps) lapLawful++;
      assert.notEqual(lock04.verify(i, d).ok, true);
    }
    assert.ok(lapLawful >= 2, `seed ${s}: the lap law alone already settles it`);
  }
});

// ---------------------------------------------------------------- 05 knotwork

test('05 — one closed band over every port, twelve free tiles, a carved crossing to anchor', () => {
  for (let s = 0; s < SEEDS; s++) {
    const i = inst(lock05, s);
    assert.equal(i.cells.length, 16);
    assert.ok(['A', 'B'].includes(i.border));

    const { single, seq } = traceBand(i.cells, buildLinks(i.border));
    assert.ok(single, `seed ${s}: the panel is not one closed band`);
    const crossings = i.cells.filter((c) => c.kind === 'cross');
    assert.equal(seq.length, crossings.length * 2, 'the band meets each crossing twice');

    assert.equal(i.free.length, 12);
    assert.ok(i.free.length >= 8 && i.free.length <= 12);
    for (const cell of i.free) {
      assert.equal(i.cells[cell].kind, 'cross');
      assert.equal(i.cells[cell].carved, false);
    }
    const carvedCrossings = i.cells.filter((c) => c.kind === 'cross' && c.carved);
    assert.ok(carvedCrossings.length >= 1, `seed ${s}: nothing pins the weave`);
    for (const c of carvedCrossings) assert.ok(['ns', 'we'].includes(c.over));

    assert.equal(i.initial.length, 12);
    const answer = lock05.solve(i).states;
    const wrongAtStart = i.initial.filter((v, k) => v !== answer[k]).length;
    assert.equal(wrongAtStart, 11, `seed ${s}: ${wrongAtStart} tiles laid wrong at the start`);
  }
});

test('05 — exactly one laying answers both laws (2^free sweep)', () => {
  for (let s = 0; s < 12; s++) {
    const i = inst(lock05, s);
    const n = i.free.length;
    const ok = [];
    for (let mask = 0; mask < (1 << n); mask++) {
      const states = [];
      for (let b = 0; b < n; b++) states.push((mask >> b & 1) === 1);
      if (lock05.verify(i, { states }).ok) ok.push(states);
    }
    assert.equal(ok.length, 1, `seed ${s}: ${ok.length} lawful layings`);
    assert.deepEqual(ok[0], lock05.solve(i).states);
  }
});
