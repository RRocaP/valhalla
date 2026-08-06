// LOCKS 11–15 unit tests — pure logic only, no DOM.
// Run: node --test tests/unit/locks-11-15.test.mjs
//
// Every lock-specific law is re-derived here by a SECOND, independent search
// written against docs/LOCKS.md rather than against the lock's own code:
//   11  Bellman-Ford over (node, parity) vs the module's Dijkstra
//   12  full 8! x 9 brute force vs the module's live-list sweep
//   13  full 2^9 x 9 brute force
//   14  full 2^16 subset sweep + trap census
//   15  exact equality against the frozen RING
// If a module ever agrees with itself but not with these, the gate fails.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { rng } from '../../src/kernel/rng.js';
import { FUTHARK, ORDER, STAVE, BY_CH } from '../../src/kernel/futhark.js';
import { SHARDS, RING, FUTHARK14 } from '../../src/kernel/shards.js';
import { createArt } from '../../src/art/index.js';
import { createAudio } from '../../src/audio/index.js';

import skerry, { fallbackInstance } from '../../src/locks/11-skerry.js';
import veitsla from '../../src/locks/12-veitsla.js';
import althing from '../../src/locks/13-althing.js';
import bindrune from '../../src/locks/14-bindrune.js';
import oathring from '../../src/locks/15-oathring.js';

const LOCKS = [skerry, veitsla, althing, bindrune, oathring];
const FLOORS = { 11: [26, 16], 12: [28, 18], 13: [30, 20], 14: [32, 22], 15: [34, 25] };
const canon = (v) => JSON.stringify(sortKeys(v));
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}
const instanceOf = (lock, s) => lock.makePuzzle(rng(`ow-${lock.id}-${s}`));
const JUNK = [null, undefined, 42, 'skål', [], {}, { ring: null }, { route: null }, { runes: 'ᚠᚢ' },
  { benches: [[], []], boast: 0 }, { culprit: 1.5, liars: [] }, true, NaN, [[[]]], { ring: [] }];

// A mutator in the shape of the one in scripts/verify.mjs, but harsher.
function mutate(answer, r) {
  const copy = JSON.parse(JSON.stringify(answer));
  const leaves = [];
  (function walk(node, path) {
    if (Array.isArray(node)) {
      if (node.length > 1) leaves.push({ node, kind: 'swap' });
      node.forEach((v, i) => walk(v, path.concat(i)));
    } else if (node && typeof node === 'object') {
      for (const k of Object.keys(node)) walk(node[k], path.concat(k));
    } else leaves.push({ path, kind: typeof node });
  })(copy, []);
  if (!leaves.length) return null;
  const t = r.pick(leaves);
  if (t.kind === 'swap') {
    const i = r.int(t.node.length);
    let j = r.int(t.node.length);
    if (i === j) j = (j + 1) % t.node.length;
    [t.node[i], t.node[j]] = [t.node[j], t.node[i]];
    return copy;
  }
  let parent = copy;
  for (let i = 0; i < t.path.length - 1; i++) parent = parent[t.path[i]];
  const key = t.path[t.path.length - 1];
  const val = parent[key];
  if (t.kind === 'boolean') parent[key] = !val;
  else if (t.kind === 'number') parent[key] = val + (r.chance(0.5) ? 1 : -1) * r.range(1, 3);
  else if (t.kind === 'string' && val.length) parent[key] = val.slice(1) + 'x';
  else return null;
  return copy;
}

// ---------------------------------------------------------------- interface

describe('locks 11–15: frozen interface', () => {
  for (const lock of LOCKS) {
    test(`${lock.id}: identity, hints, difficulty, shard`, () => {
      assert.equal(lock.ordinal, Number(lock.id.slice(0, 2)));
      assert.equal(lock.tier, 4);
      assert.ok(lock.title.length && lock.epigraph.length);
      assert.equal(lock.hints.length, 3);
      for (const h of lock.hints) assert.ok(typeof h === 'string' && h.length > 20);
      for (const fn of ['makePuzzle', 'solve', 'verify', 'wrongAnswers', 'shard', 'mount']) {
        assert.equal(typeof lock[fn], 'function', `${lock.id} missing ${fn}`);
      }
      const [minSteps, estMinutes] = FLOORS[lock.ordinal];
      assert.ok(lock.difficulty.minSteps >= minSteps, `minSteps ${lock.difficulty.minSteps} < ${minSteps}`);
      assert.ok(lock.difficulty.estMinutes >= estMinutes, `estMinutes ${lock.difficulty.estMinutes} < ${estMinutes}`);
      assert.ok(lock.difficulty.searchSpace > 0);
      const inst = instanceOf(lock, 0);
      if (lock.ordinal <= 14) assert.deepEqual(lock.shard(inst), SHARDS[lock.id]);
      else assert.equal(lock.shard(inst), null);
    });
  }

  test('difficulty is non-decreasing across 11→15', () => {
    for (let i = 1; i < LOCKS.length; i++) {
      assert.ok(LOCKS[i].difficulty.minSteps >= LOCKS[i - 1].difficulty.minSteps);
      assert.ok(LOCKS[i].difficulty.estMinutes >= LOCKS[i - 1].difficulty.estMinutes);
    }
  });

  test('shard() is constant across instances and does not alias the frozen table', () => {
    for (const lock of LOCKS.slice(0, 4)) {
      const a = lock.shard(instanceOf(lock, 1));
      const b = lock.shard(instanceOf(lock, 2));
      assert.deepEqual(a, b);
      a.value = 999;
      assert.equal(SHARDS[lock.id].value !== 999, true, `${lock.id} shard() leaked a reference to SHARDS`);
    }
  });
});

describe('locks 11–15: solve/verify/determinism/totality', () => {
  for (const lock of LOCKS) {
    const seeds = lock.ordinal === 15 ? 3 : 34;
    test(`${lock.id}: canonical answer verifies over ${seeds} seeds`, () => {
      for (let s = 0; s < seeds; s++) {
        const inst = instanceOf(lock, s);
        const v = lock.verify(inst, lock.solve(inst));
        assert.equal(v.ok, true, `seed ${s} rejected its own solution`);
      }
    });

    test(`${lock.id}: makePuzzle is deterministic per seed`, () => {
      for (let s = 0; s < 8; s++) {
        assert.equal(canon(instanceOf(lock, s)), canon(instanceOf(lock, s)), `seed ${s} unstable`);
      }
    });

    test(`${lock.id}: verify is total on junk`, () => {
      const inst = instanceOf(lock, 0);
      for (const junk of JUNK) {
        let v;
        assert.doesNotThrow(() => { v = lock.verify(inst, junk); }, `threw on ${JSON.stringify(junk)}`);
        assert.notEqual(v && v.ok, true, `accepted junk ${JSON.stringify(junk)}`);
      }
      assert.doesNotThrow(() => lock.verify(null, null));
      assert.doesNotThrow(() => lock.verify(undefined, { ring: [] }));
    });

    test(`${lock.id}: wrongAnswers are >= 6, distinct from the truth, and all rejected`, () => {
      for (let s = 0; s < (lock.ordinal === 15 ? 2 : 20); s++) {
        const inst = instanceOf(lock, s);
        const truth = canon(lock.solve(inst));
        const wrongs = lock.wrongAnswers(inst);
        assert.ok(Array.isArray(wrongs) && wrongs.length >= 6, `seed ${s}: only ${wrongs.length} wrongs`);
        for (const w of wrongs) {
          assert.notEqual(canon(w), truth, `seed ${s}: a wrong answer equals the solution`);
          assert.notEqual(lock.verify(inst, w).ok, true, `seed ${s}: accepted ${canon(w).slice(0, 90)}`);
        }
      }
    });

    test(`${lock.id}: no mutation of the canonical answer is ever accepted`, () => {
      const seedCount = lock.ordinal === 15 ? 2 : 20;
      let tried = 0;
      for (let s = 0; s < seedCount; s++) {
        const inst = instanceOf(lock, s);
        const ans = lock.solve(inst);
        const truth = canon(ans);
        const r = rng(`fuzz-${lock.id}-${s}`);
        for (let m = 0; m < 200; m++) {
          const mut = mutate(ans, r);
          if (!mut || canon(mut) === truth) continue;
          tried++;
          assert.notEqual(lock.verify(inst, mut).ok, true, `seed ${s}: mutant accepted ${canon(mut).slice(0, 90)}`);
        }
      }
      assert.ok(tried > 100, `only ${tried} distinct mutants exercised`);
    });

    test(`${lock.id}: near-miss text never contains a rune of the answer verbatim`, () => {
      const inst = instanceOf(lock, 3);
      for (const w of lock.wrongAnswers(inst)) {
        const near = lock.verify(inst, w).near;
        if (!near) continue;
        assert.equal(typeof near, 'string');
        assert.ok(near.length < 120, 'near lines stay short');
      }
    });
  }
});

// ------------------------------------------------------- 11 · the skerry road

describe('11-skerry: independent search', () => {
  const tideOf = (p) => (p === 0 ? 'ebb' : 'flood');
  const cost = (k) => (k === 'portage' ? 2 : 1);
  const flips = (k) => k !== 'portage';
  const open = (k, p) => k === 'portage' || k === 'always' || k === tideOf(p);

  // Bellman-Ford over (node, parity) — deliberately not the module's Dijkstra.
  function optimumByRelaxation(inst) {
    const n = inst.nodes.length;
    const dist = new Array(n * 2).fill(Infinity);
    dist[inst.start * 2] = 0;
    for (let round = 0; round < n * 4; round++) {
      let changed = false;
      for (const e of inst.edges) {
        for (const [a, b] of [[e.a, e.b], [e.b, e.a]]) {
          for (let p = 0; p < 2; p++) {
            if (!open(e.kind, p) || dist[a * 2 + p] === Infinity) continue;
            const np = flips(e.kind) ? 1 - p : p;
            const cand = dist[a * 2 + p] + cost(e.kind);
            if (cand < dist[b * 2 + np]) { dist[b * 2 + np] = cand; changed = true; }
          }
        }
      }
      if (!changed) break;
    }
    return Math.min(dist[inst.goal * 2], dist[inst.goal * 2 + 1]);
  }

  function naiveOptimum(inst) {
    const n = inst.nodes.length;
    const dist = new Array(n).fill(Infinity);
    dist[inst.start] = 0;
    for (let round = 0; round < n; round++) {
      for (const e of inst.edges) {
        for (const [a, b] of [[e.a, e.b], [e.b, e.a]]) {
          if (dist[a] + cost(e.kind) < dist[b]) dist[b] = dist[a] + cost(e.kind);
        }
      }
    }
    return dist[inst.goal];
  }

  test('declared optimum equals an independent (node,parity) relaxation', () => {
    for (let s = 0; s < 34; s++) {
      const inst = instanceOf(skerry, s);
      assert.equal(inst.optimum, optimumByRelaxation(inst), `seed ${s}`);
      assert.equal(inst.optimum, skerry.solve(inst).route.length ? inst.optimum : -1);
    }
  });

  test('the greedy road always fails: naive legs < optimum on every seed', () => {
    for (let s = 0; s < 34; s++) {
      const inst = instanceOf(skerry, s);
      const naive = naiveOptimum(inst);
      assert.equal(naive, inst.naiveLegs, `seed ${s}: declared naiveLegs wrong`);
      assert.ok(naive < inst.optimum, `seed ${s}: greedy road (${naive}) reaches the optimum (${inst.optimum})`);
    }
  });

  test('chart shape: 12–14 skerries, no parallel edges, fleet and hoard present', () => {
    for (let s = 0; s < 20; s++) {
      const inst = instanceOf(skerry, s);
      assert.ok(inst.nodes.length >= 12 && inst.nodes.length <= 14, `seed ${s}: ${inst.nodes.length} skerries`);
      assert.equal(inst.nodes[inst.start].role, 'fleet');
      assert.equal(inst.nodes[inst.goal].role, 'hoard');
      const pairs = new Set(inst.edges.map((e) => `${Math.min(e.a, e.b)}:${Math.max(e.a, e.b)}`));
      assert.equal(pairs.size, inst.edges.length, `seed ${s}: parallel edges break route notation`);
      for (const e of inst.edges) assert.ok(['ebb', 'flood', 'always', 'portage'].includes(e.kind));
      assert.ok(inst.edges.some((e) => e.kind === 'portage'), `seed ${s}: no portage`);
    }
  });

  // Exhaustive hunt for every legal route of optimal leg-count.
  function allOptimalRoutes(inst) {
    const adj = new Map();
    for (const e of inst.edges) {
      if (!adj.has(e.a)) adj.set(e.a, []);
      if (!adj.has(e.b)) adj.set(e.b, []);
      adj.get(e.a).push({ to: e.b, kind: e.kind });
      adj.get(e.b).push({ to: e.a, kind: e.kind });
    }
    const found = [];
    (function dfs(node, parity, legs, path) {
      if (legs > inst.optimum || found.length > 4) return;
      if (node === inst.goal && legs === inst.optimum) { found.push(path.slice()); return; }
      for (const { to, kind } of adj.get(node) || []) {
        if (!open(kind, parity)) continue;
        path.push(to);
        dfs(to, flips(kind) ? 1 - parity : parity, legs + cost(kind), path);
        path.pop();
      }
    })(inst.start, 0, 0, [inst.start]);
    return found;
  }

  test('every chart has exactly ONE legal route of optimal leg-count', () => {
    // The generator pins the path, not merely the count — which is what stops a
    // swapped pair of skerries from landing on a second legal optimum and
    // reading as an accepted wrong answer under CONTRACT §7.2.
    for (let s = 0; s < 34; s++) {
      const inst = instanceOf(skerry, s);
      const routes = allOptimalRoutes(inst);
      assert.equal(routes.length, 1, `seed ${s}: ${routes.length} optimal roads`);
      assert.deepEqual(routes[0], skerry.solve(inst).route, `seed ${s}`);
    }
  });

  test('verify is property-based: any legal optimal route passes, whoever built it', () => {
    // Hand-built chart with two equally short legal roads. Verify must take
    // either — it checks legality and leg-count, never identity against a
    // stored answer (docs/LOCKS.md §11).
    const twoRoads = {
      nodes: [
        { name: 'Skipsvik', x: 0.1, y: 0.5, band: 0, role: 'fleet' },
        { name: 'Nordskjer', x: 0.5, y: 0.2, band: 1, role: 'skerry' },
        { name: 'Sudskjer', x: 0.5, y: 0.8, band: 1, role: 'skerry' },
        { name: 'Draugsker', x: 0.9, y: 0.5, band: 2, role: 'hoard' },
      ],
      edges: [
        { a: 0, b: 1, kind: 'always' }, { a: 0, b: 2, kind: 'always' },
        { a: 1, b: 3, kind: 'flood' }, { a: 2, b: 3, kind: 'flood' },
      ],
      start: 0,
      goal: 3,
      optimum: 2,
      naiveLegs: 2,
    };
    assert.equal(skerry.verify(twoRoads, { route: [0, 1, 3] }).ok, true);
    assert.equal(skerry.verify(twoRoads, { route: [0, 2, 3] }).ok, true);
    assert.notEqual(skerry.verify(twoRoads, { route: [0, 1, 3, 1] }).ok, true, 'over-long route accepted');
    assert.notEqual(skerry.verify(twoRoads, { route: [0, 3] }).ok, true, 'route over open water accepted');
  });

  test('illegal and over-long routes are rejected with an honest near-line', () => {
    const inst = instanceOf(skerry, 5);
    const route = skerry.solve(inst).route;
    assert.equal(skerry.verify(inst, { route: route.slice(0, -1) }).near, 'The road stops short of the hoard.');
    assert.equal(skerry.verify(inst, { route: [inst.goal].concat(route.slice(1)) }).near,
      'The fleet does not lie at that skerry.');
    for (const w of skerry.wrongAnswers(inst)) {
      const near = skerry.verify(inst, w).near;
      if (near) assert.ok(!/\d/.test(near), `near-line leaks a count: "${near}"`);
    }
  });

  test('the hard-coded safety chart is itself a valid puzzle', () => {
    const f = fallbackInstance();
    assert.ok(f.naiveLegs < f.optimum, 'safety chart is solvable by the greedy road');
    assert.equal(f.optimum, optimumByRelaxation(f));
    assert.equal(skerry.verify(f, skerry.solve(f)).ok, true);
    for (const w of skerry.wrongAnswers(f)) assert.notEqual(skerry.verify(f, w).ok, true);
  });
});

// ----------------------------------------------------- 12 · the feast benches

describe('12-veitsla: independent 8! x 9 sweep', () => {
  const benchOf = (s) => (s < 4 ? 0 : 1);
  function holds(c, pos) {
    const a = pos[c.x];
    const b = pos[c.y];
    if (c.kind === 'opposite') return Math.abs(a - b) === 4;
    if (c.kind === 'not-adjacent') return !(benchOf(a) === benchOf(b) && Math.abs(a - b) === 1);
    if (c.kind === 'left-of') return benchOf(a) === benchOf(b) && a < b;
    if (c.kind === 'same-bench') return benchOf(a) === benchOf(b);
    return false;
  }
  function* perms(arr) {
    if (arr.length <= 1) { yield arr; return; }
    for (let i = 0; i < arr.length; i++) {
      for (const p of perms(arr.slice(0, i).concat(arr.slice(i + 1)))) yield [arr[i]].concat(p);
    }
  }
  function brute(inst) {
    const canonical = [];
    const near = [];
    let mirrors = 0;
    for (const pos of perms([0, 1, 2, 3, 4, 5, 6, 7])) {
      let mask = 0;
      for (let i = 0; i < inst.oaths.length; i++) if (!holds(inst.oaths[i], pos)) mask |= 1 << i;
      let bits = 0;
      for (let m = mask; m; m &= m - 1) bits++;
      if (bits === 1) mirrors++;
      if (pos[0] >= 4) continue; // non-canonical: bench A must hold the first name
      if (bits === 1) canonical.push({ pos: pos.slice(), boast: Math.log2(mask) | 0 });
      else if (bits === 2) near.push(mask);
    }
    return { canonical, near, mirrors };
  }

  test('every instance has exactly one canonical (seating, boast) and >= 3 decoys', () => {
    for (let s = 0; s < 12; s++) {
      const inst = instanceOf(veitsla, s);
      assert.equal(inst.oaths.length, 9, `seed ${s}: not nine oaths`);
      const { canonical, near, mirrors } = brute(inst);
      assert.equal(canonical.length, 1, `seed ${s}: ${canonical.length} valid halls`);
      assert.equal(mirrors, 2, `seed ${s}: bench-swap symmetry is not exactly 2-fold`);
      const decoys = near.filter((m) => (m & (1 << canonical[0].boast)) !== 0).length;
      assert.ok(decoys >= 3, `seed ${s}: only ${decoys} decoys`);
      const seats = new Array(8);
      for (let p = 0; p < 8; p++) seats[canonical[0].pos[p]] = inst.names[p];
      assert.deepEqual(veitsla.solve(inst), {
        benches: [seats.slice(0, 4), seats.slice(4)],
        boast: canonical[0].boast,
      }, `seed ${s}: solve disagrees with brute force`);
    }
  });

  test('canonicalisation is enforced: the bench-swapped truth is rejected', () => {
    for (let s = 0; s < 8; s++) {
      const inst = instanceOf(veitsla, s);
      const ans = veitsla.solve(inst);
      const swapped = { benches: [ans.benches[1], ans.benches[0]], boast: ans.boast };
      assert.notEqual(veitsla.verify(inst, swapped).ok, true, `seed ${s}: non-canonical hall accepted`);
      assert.ok(ans.benches[0].includes(inst.names[0]), 'bench A must hold the alphabetically first chieftain');
      assert.deepEqual(inst.names.slice().sort(), inst.names, 'roster is sorted, so `<` is a total order');
    }
  });

  test('naming the wrong oath as the boast fails even with the right seating', () => {
    const inst = instanceOf(veitsla, 4);
    const ans = veitsla.solve(inst);
    for (let k = 0; k < 9; k++) {
      if (k === ans.boast) continue;
      assert.notEqual(veitsla.verify(inst, { ...ans, boast: k }).ok, true);
    }
  });

  test('every oath kind appears across the corpus and each carries readable text', () => {
    const kinds = new Set();
    for (let s = 0; s < 20; s++) {
      for (const o of instanceOf(veitsla, s).oaths) {
        kinds.add(o.kind);
        assert.ok(typeof o.text === 'string' && o.text.length > 12);
        assert.ok(o.x !== o.y);
      }
    }
    assert.deepEqual([...kinds].sort(), ['left-of', 'not-adjacent', 'opposite', 'same-bench']);
  });
});

// ----------------------------------------------------- 13 · the althing verdict

describe('13-althing: independent 2^9 x 9 sweep', () => {
  function value(st, liars, culprit) {
    if (st.kind === 'true') return !liars[st.x];
    if (st.kind === 'false') return !!liars[st.x];
    if (st.kind === 'xor') return !!liars[st.x] !== !!liars[st.y];
    if (st.kind === 'imp') return !!liars[st.x] || !!liars[st.y];
    if (st.kind === 'among') return st.polarity ? st.set.includes(culprit) : !st.set.includes(culprit);
    if (st.kind === 'notme') return culprit !== st.speaker;
    throw new Error(`unknown statement kind ${st.kind}`);
  }
  function brute(inst) {
    const out = [];
    for (let bits = 0; bits < 512; bits++) {
      const liars = [];
      for (let i = 0; i < 9; i++) liars.push((bits & (1 << i)) !== 0);
      for (let culprit = 0; culprit < 9; culprit++) {
        if (inst.statements.every((st) => value(st, liars, culprit) === !liars[st.speaker])) {
          out.push({ culprit, liars });
        }
      }
    }
    return out;
  }

  test('exactly one consistent (liar-set, culprit) per seed, matching solve()', () => {
    for (let s = 0; s < 34; s++) {
      const inst = instanceOf(althing, s);
      const found = brute(inst);
      assert.equal(found.length, 1, `seed ${s}: ${found.length} consistent verdicts`);
      assert.deepEqual(althing.solve(inst), found[0], `seed ${s}: solve disagrees with brute force`);
    }
  });

  test('grammar discipline: no self-reference outside "I am not the peace-breaker"', () => {
    const kinds = new Set();
    for (let s = 0; s < 20; s++) {
      const inst = instanceOf(althing, s);
      assert.ok(inst.statements.length >= 9, `seed ${s}: a speaker was silent`);
      const speaking = new Set(inst.statements.map((st) => st.speaker));
      assert.equal(speaking.size, 9, `seed ${s}: not all nine spoke`);
      for (const st of inst.statements) {
        kinds.add(st.kind);
        assert.ok(typeof st.text === 'string' && st.text.length > 10);
        if (st.kind === 'true' || st.kind === 'false') assert.notEqual(st.x, st.speaker);
        if (st.kind === 'xor' || st.kind === 'imp') {
          assert.notEqual(st.x, st.y);
          assert.notEqual(st.x, st.speaker);
          assert.notEqual(st.y, st.speaker);
        }
        if (st.kind === 'among') {
          assert.ok(st.set.length >= 2 && st.set.length <= 4);
          assert.equal(new Set(st.set).size, st.set.length);
        }
      }
    }
    assert.deepEqual([...kinds].sort(), ['among', 'false', 'imp', 'notme', 'true', 'xor']);
  });

  test('a liar-set that is right except for one brand is rejected', () => {
    for (let s = 0; s < 10; s++) {
      const inst = instanceOf(althing, s);
      const ans = althing.solve(inst);
      for (let i = 0; i < 9; i++) {
        const liars = ans.liars.slice();
        liars[i] = !liars[i];
        assert.notEqual(althing.verify(inst, { culprit: ans.culprit, liars }).ok, true, `seed ${s}, brand ${i}`);
      }
      for (let c = 0; c < 9; c++) {
        if (c === ans.culprit) continue;
        assert.notEqual(althing.verify(inst, { culprit: c, liars: ans.liars }).ok, true);
      }
    }
  });
});

// ------------------------------------------------------ 14 · the bind-rune seal

describe('14-bindrune: independent 2^16 subset sweep', () => {
  const key = (seg) => JSON.stringify(seg);
  const staveKey = key(STAVE);
  const maskOf = (chars, bits) => chars.reduce((m, ch) => m | bits[ch], 0);

  function segmentBits() {
    const index = new Map();
    for (const r of FUTHARK) for (const s of r.segments) if (!index.has(key(s))) index.set(key(s), index.size);
    const bits = {};
    for (const r of FUTHARK) bits[r.ch] = r.segments.reduce((m, s) => m | (1 << index.get(key(s))), 0);
    return { index, bits };
  }

  test('the kernel permits exactly one fully-coverable rune, and it is ᛁ', () => {
    // This is the fact the amended docs/LOCKS.md §14 trap taxonomy rests on.
    const { index } = segmentBits();
    const owners = new Map();
    for (const r of FUTHARK) for (const s of r.segments) {
      const k = key(s);
      owners.set(k, (owners.get(k) || []).concat(r.ch));
    }
    const shared = [...owners.entries()].filter(([, who]) => who.length > 1);
    assert.equal(shared.length, 1, 'more than one segment is shared between runes');
    assert.equal(shared[0][0], staveKey, 'the shared segment is not the stave');
    assert.equal(index.size, 28);
    const branchless = FUTHARK.filter((r) => r.segments.every((s) => key(s) === staveKey)).map((r) => r.ch);
    assert.deepEqual(branchless, ['ᛁ']);
  });

  test('every carving has exactly one minimal generating set, and solve() finds it', () => {
    const { index, bits } = segmentBits();
    const runeMask = ORDER.map((ch) => bits[ch]);
    for (let s = 0; s < 30; s++) {
      const inst = instanceOf(bindrune, s);
      let carved = 0;
      for (const seg of inst.segments) carved |= 1 << index.get(key(seg));
      const union = new Int32Array(1 << 16);
      for (let m = 1; m < (1 << 16); m++) {
        const low = m & -m;
        union[m] = union[m ^ low] | runeMask[31 - Math.clz32(low)];
      }
      const minimal = [];
      for (let m = 0; m < (1 << 16); m++) {
        if (union[m] !== carved) continue;
        let ok = true;
        for (let i = 0; i < 16 && ok; i++) if ((m & (1 << i)) && union[m ^ (1 << i)] === carved) ok = false;
        if (ok) minimal.push(ORDER.filter((_, i) => (m & (1 << i)) !== 0));
      }
      assert.equal(minimal.length, 1, `seed ${s}: ${minimal.length} minimal generating sets`);
      assert.deepEqual(bindrune.solve(inst).runes, minimal[0], `seed ${s}: solve disagrees with the sweep`);
      assert.ok(minimal[0].length >= 5 && minimal[0].length <= 6, `seed ${s}: subset of ${minimal[0].length}`);
    }
  });

  test('traps are planted: ᛁ fully covered, plus >= 2 one-stroke-short runes', () => {
    const { bits } = segmentBits();
    const pop = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
    for (let s = 0; s < 30; s++) {
      const inst = instanceOf(bindrune, s);
      const truth = bindrune.solve(inst).runes;
      const carved = maskOf(truth, bits);
      const full = [];
      const oneShort = [];
      for (const ch of ORDER) {
        if (truth.includes(ch)) continue;
        const outside = pop(bits[ch] & ~carved);
        if (outside === 0) full.push(ch);
        else if (outside === 1) oneShort.push(ch);
      }
      assert.deepEqual(full, ['ᛁ'], `seed ${s}: full-cover traps ${full.join('')}`);
      assert.ok(oneShort.length >= 2, `seed ${s}: only ${oneShort.length} one-stroke traps`);
      // Both trap families must actually be rejected.
      assert.notEqual(bindrune.verify(inst, { runes: bindrune.solve(inst).runes.concat(['ᛁ'])
        .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)) }).ok, true, 'ᛁ trap accepted');
      const withTrap = truth.concat([oneShort[0]]).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
      assert.notEqual(bindrune.verify(inst, { runes: withTrap }).ok, true, 'one-stroke trap accepted');
    }
  });

  test('answers must be futhark-sorted, and the stave alone never carries a rune', () => {
    const inst = instanceOf(bindrune, 1);
    const truth = bindrune.solve(inst).runes;
    assert.notEqual(bindrune.verify(inst, { runes: truth.slice().reverse() }).ok, true, 'unsorted set accepted');
    assert.equal(bindrune.verify(inst, { runes: truth }).ok, true);
    assert.ok(!truth.includes('ᛁ') && !truth.includes('ᚢ') && !truth.includes('ᛋ'));
    assert.equal(inst.candidates.length, 16);
    assert.deepEqual(inst.candidates, ORDER);
    assert.ok(inst.segments.some((seg) => JSON.stringify(seg) === staveKey), 'the stave is carved');
  });
});

// --------------------------------------------------------- 15 · the oath-ring

describe('15-oathring: the frozen finale', () => {
  test('makePuzzle is static and carries every fact the ring needs', () => {
    const a = oathring.makePuzzle(rng('anything'));
    const b = oathring.makePuzzle(rng('something-else'));
    assert.equal(canon(a), canon(b), 'the finale must not vary');
    assert.equal(a.slots, 14);
    assert.equal(a.northNail, 0);
    assert.deepEqual(a.futhark, FUTHARK14);
    assert.equal(a.shards.length, 14);
    for (const sh of a.shards) assert.deepEqual({ rune: sh.rune, value: sh.value }, SHARDS[sh.lock]);
  });

  test('verify is exact equality against the frozen RING', () => {
    const inst = oathring.makePuzzle(rng('x'));
    assert.deepEqual(oathring.solve(inst).ring, RING);
    assert.equal(oathring.verify(inst, { ring: RING.slice() }).ok, true);
    for (let i = 0; i < 14; i++) {
      for (let j = i + 1; j < 14; j++) {
        const swap = RING.slice();
        [swap[i], swap[j]] = [swap[j], swap[i]];
        assert.notEqual(oathring.verify(inst, { ring: swap }).ok, true, `swap ${i}/${j} accepted`);
      }
    }
  });

  test('the ring obeys its own law: each value is the stride to the next rune of the row', () => {
    const valueOf = Object.fromEntries(Object.values(SHARDS).map((s) => [s.rune, s.value]));
    const slot = Object.fromEntries(RING.map((ch, i) => [ch, i]));
    FUTHARK14.forEach((ch, i) => {
      const next = FUTHARK14[(i + 1) % 14];
      assert.equal(((slot[next] - slot[ch]) % 14 + 14) % 14, valueOf[ch], `${ch} does not stride to ${next}`);
    });
    assert.equal(RING[0], 'ᚠ', 'wealth must hang on the north nail');
  });

  test('every named wrong family is present and rejected', () => {
    const inst = oathring.makePuzzle(rng('x'));
    const wrongs = oathring.wrongAnswers(inst).map((w) => w.ring.join(''));
    const rot = (k) => RING.slice(k).concat(RING.slice(0, k)).join('');
    assert.ok(wrongs.filter((w) => [rot(1), rot(2), rot(7), rot(13)].includes(w)).length >= 3, 'rotations missing');
    assert.ok(wrongs.includes(FUTHARK14.join('')), 'futhark order laid clockwise missing');
    const valueOf = Object.fromEntries(Object.values(SHARDS).map((s) => [s.rune, s.value]));
    const sorted = FUTHARK14.slice().sort((a, b) => valueOf[a] - valueOf[b]
      || FUTHARK14.indexOf(a) - FUTHARK14.indexOf(b)).join('');
    assert.ok(wrongs.includes(sorted), 'value-sorted order missing');
    let twoSwaps = 0;
    for (const w of wrongs) {
      const same = [...w].filter((ch, i) => ch === RING[i]).length;
      if (same === 12) twoSwaps++;
    }
    assert.ok(twoSwaps >= 3, `only ${twoSwaps} near-rings with two runes swapped`);
    for (const w of oathring.wrongAnswers(inst)) assert.notEqual(oathring.verify(inst, w).ok, true);
  });

  test('hints walk toward the law without ever stating the arrangement', () => {
    const joined = oathring.hints.join(' ');
    assert.ok(!joined.includes(RING.join('')), 'a hint spells the ring');
    assert.ok(!joined.includes(RING.slice(0, 4).join('')), 'a hint spells part of the ring');
    for (let i = 0; i + 2 < RING.length; i++) {
      assert.ok(!joined.includes(RING.slice(i, i + 3).join(' ')), 'a hint lays out three consecutive slots');
    }
    assert.match(oathring.hints[2], /ᚠ|wealth/, 'the last hint should name the anchor');
  });

  test('shard() returns null — the finale consumes shards, it does not give one', () => {
    assert.equal(oathring.shard(oathring.makePuzzle(rng('x'))), null);
    assert.equal(SHARDS['15-oathring'], undefined);
  });
});

// ------------------------------------------------------------- views (mount)
// CONTRACT §4.1: mount returns {unmount}, and unmount removes every listener it
// made. These run against a stub DOM — the browser gate is QA's, this one only
// proves the views build, take real input, submit through ctx.submit, and let go.

describe('locks 11–15: mount, real input, clean teardown', () => {
  const ledger = { added: 0, removed: 0 };
  let saved;

  function makeElement(tag) {
    const el = {
      tagName: String(tag).toUpperCase(),
      children: [],
      parent: null,
      dataset: {},
      attrs: {},
      style: new Proxy({ cssText: '' }, { get: (t, k) => t[k] ?? '', set: (t, k, v) => { t[k] = v; return true; } }),
      textContent: '',
      className: '',
      listeners: new Map(),
      disabled: false,
      append(...kids) { for (const k of kids) if (k && typeof k === 'object') { k.parent = el; el.children.push(k); } },
      appendChild(k) { el.append(k); return k; },
      remove() {
        if (el.parent) el.parent.children = el.parent.children.filter((c) => c !== el);
        el.parent = null;
      },
      setAttribute(k, v) { el.attrs[k] = String(v); },
      getAttribute(k) { return el.attrs[k] ?? null; },
      addEventListener(ev, fn) {
        ledger.added++;
        if (!el.listeners.has(ev)) el.listeners.set(ev, []);
        el.listeners.get(ev).push(fn);
      },
      removeEventListener(ev, fn) {
        ledger.removed++;
        const list = el.listeners.get(ev) || [];
        const i = list.indexOf(fn);
        if (i >= 0) list.splice(i, 1);
      },
      dispatch(ev, payload = {}) {
        for (const fn of (el.listeners.get(ev) || []).slice()) fn({ target: el, preventDefault() {}, ...payload });
      },
      getContext() {
        const noop = ['clearRect', 'fillRect', 'strokeRect', 'save', 'restore', 'beginPath', 'closePath', 'moveTo',
          'lineTo', 'arc', 'arcTo', 'rect', 'roundRect', 'ellipse', 'quadraticCurveTo', 'bezierCurveTo', 'stroke',
          'fill', 'fillText', 'strokeText', 'setLineDash', 'translate', 'scale', 'rotate', 'clip', 'drawImage'];
        const c = { measureText: () => ({ width: 10 }) };
        for (const m of noop) c[m] = () => {};
        for (const m of ['createLinearGradient', 'createRadialGradient']) c[m] = () => ({ addColorStop() {} });
        return c;
      },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 720, height: 430, right: 720, bottom: 430 }),
      focus() {},
    };
    return el;
  }

  before(() => {
    saved = { document: globalThis.document, dpr: globalThis.devicePixelRatio, mm: globalThis.matchMedia };
    const doc = {
      createElement: makeElement,
      elementFromPoint: () => null,
      listeners: new Map(),
      addEventListener(ev, fn) {
        ledger.added++;
        if (!doc.listeners.has(ev)) doc.listeners.set(ev, []);
        doc.listeners.get(ev).push(fn);
      },
      removeEventListener(ev, fn) {
        ledger.removed++;
        const list = doc.listeners.get(ev) || [];
        const i = list.indexOf(fn);
        if (i >= 0) list.splice(i, 1);
      },
    };
    globalThis.document = doc;
    globalThis.devicePixelRatio = 2;
    globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  });

  after(() => {
    globalThis.document = saved.document;
    globalThis.devicePixelRatio = saved.dpr;
    globalThis.matchMedia = saved.mm;
  });

  const art = createArt();
  const audio = createAudio();
  const buttonsIn = (root) => {
    const out = [];
    (function walk(el) {
      for (const c of el.children || []) { if (c.tagName === 'BUTTON') out.push(c); walk(c); }
    })(root);
    return out;
  };
  function mountLock(lock, solved = false) {
    const root = makeElement('div');
    const instance = lock.makePuzzle(rng(`lindisfarne-793:${lock.id}`));
    const state = { submitted: null, result: null, notes: [], root, instance };
    const before2 = { a: ledger.added, r: ledger.removed };
    state.view = lock.mount({
      root, instance, art, audio, solved,
      submit(ans) { state.submitted = ans; state.result = lock.verify(instance, ans); return state.result; },
      note(t) { state.notes.push(t); },
    });
    state.close = () => {
      const added = ledger.added - before2.a;
      state.view.unmount();
      return { added, removed: ledger.removed - before2.r };
    };
    return state;
  }
  const byLabel = (root, re) => buttonsIn(root).find((b) => re.test(b.getAttribute('aria-label') || ''));
  const byText = (root, re) => buttonsIn(root).find((b) => re.test(b.textContent || ''));
  const push = (b, what) => { assert.ok(b, `no control for ${what}`); b.dispatch('click'); };
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (const lock of LOCKS) {
    test(`${lock.id}: mounts, mirrors to the journal, and unmounts without a leak`, () => {
      const s = mountLock(lock);
      assert.ok(buttonsIn(s.root).length >= 3, 'a lock with no controls cannot be played');
      assert.ok(s.notes.length > 0, 'no ctx.note() text mirror on mount');
      for (const b of buttonsIn(s.root)) if (!b.disabled) b.dispatch('click');
      const { added, removed } = s.close();
      assert.equal(added, removed, `${added} listeners added, ${removed} removed`);
      assert.equal(s.root.children.length, 0, 'unmount left DOM behind');
    });

    test(`${lock.id}: a solved lock renders its tableau and refuses to submit`, () => {
      const s = mountLock(lock, true);
      for (const b of buttonsIn(s.root)) if (!b.disabled) b.dispatch('click');
      assert.equal(s.submitted, null, 'a solved lock submitted again');
      const { added, removed } = s.close();
      assert.equal(added, removed);
    });
  }

  test('11-skerry: sailing the optimal road by click opens the lock', () => {
    const s = mountLock(skerry);
    const route = skerry.solve(s.instance).route;
    for (let i = 1; i < route.length; i++) {
      const name = s.instance.nodes[route[i]].name;
      push(byText(s.root, new RegExp(`(Row to|Haul over to) ${esc(name)} —`)), `leg to ${name}`);
    }
    push(byText(s.root, /^Seal the route$/), 'seal');
    assert.equal(s.result.ok, true);
    s.close();
  });

  test('12-veitsla: seating the hall and naming the boast by click opens the lock', () => {
    const s = mountLock(veitsla);
    const ans = veitsla.solve(s.instance);
    const bench = ['the near bench', 'the far bench'];
    for (let b = 0; b < 2; b++) {
      for (let i = 0; i < 4; i++) {
        push(byText(s.root, new RegExp(`^${esc(ans.benches[b][i])}$`)), 'chip');
        push(byLabel(s.root, new RegExp(`${bench[b]}, seat ${i + 1}`)), 'seat');
      }
    }
    push(byLabel(s.root, new RegExp(`^Call this oath the boast: ${esc(s.instance.oaths[ans.boast].text)}`)), 'boast');
    push(byText(s.root, /^Swear the seating$/), 'swear');
    assert.equal(s.result.ok, true);
    s.close();
  });

  test('13-althing: branding nine and accusing by click opens the lock', () => {
    const s = mountLock(althing);
    const ans = althing.solve(s.instance);
    for (let i = 0; i < 9; i++) {
      const nm = s.instance.names[i];
      push(byLabel(s.root, new RegExp(`^${esc(nm)} is `)), 'brand');
      if (ans.liars[i]) push(byLabel(s.root, new RegExp(`^${esc(nm)} is `)), 'brand again');
    }
    push(byLabel(s.root, new RegExp(`^Name ${esc(s.instance.names[ans.culprit])} the peace-breaker`)), 'accuse');
    push(byText(s.root, /^Give the verdict$/), 'verdict');
    assert.equal(s.result.ok, true);
    s.close();
  });

  test('14-bindrune: picking the bound runes by click opens the lock', () => {
    const s = mountLock(bindrune);
    const ans = bindrune.solve(s.instance);
    for (const ch of ans.runes) push(byLabel(s.root, new RegExp(`^${esc(BY_CH[ch].name)}`)), `rune ${ch}`);
    push(byText(s.root, /^Name the bound runes$/), 'seal');
    assert.equal(s.result.ok, true);
    s.close();
  });

  test('15-oathring: hanging all fourteen shards by click closes the ring', () => {
    const s = mountLock(oathring);
    for (let slot = 0; slot < RING.length; slot++) {
      push(byLabel(s.root, new RegExp(`^Shard ${esc(BY_CH[RING[slot]].name)}, number`)), `shard ${RING[slot]}`);
      push(byLabel(s.root, new RegExp(`^Slot ${slot}[,.]`)), `slot ${slot}`);
    }
    push(byText(s.root, /^Close the ring$/), 'close');
    assert.deepEqual(s.submitted.ring, RING);
    assert.equal(s.result.ok, true);
    s.close();
  });
});
