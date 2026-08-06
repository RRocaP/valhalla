// Unit gate for locks 06–10 (OW-LOCKS-B).
// Every lock-specific law is re-implemented here from the instance data rather
// than borrowed from the lock module, so a bug in a module cannot mark its own
// homework. The shared checks mirror docs/CONTRACT.md §7.

import test from 'node:test';
import assert from 'node:assert/strict';

import { rng } from '../../src/kernel/rng.js';
import { SHARDS } from '../../src/kernel/shards.js';

import jotun, { encipher, expansionCount } from '../../src/locks/06-jotunvillur.js';
import tafl, {
  attackerReply, legalMoves, applyMove, kingRoad, winningLines, naturalFirstMoves,
  stateOf, mutantsOf,
} from '../../src/locks/07-tafl.js';
import hacksilver from '../../src/locks/08-hacksilver.js';
import sunstone, { candidates } from '../../src/locks/09-sunstone.js';
import drottkvaett from '../../src/locks/10-drottkvaett.js';

const LOCKS = [jotun, tafl, hacksilver, sunstone, drottkvaett];
const FLOORS = { 6: [16, 8], 7: [18, 10], 8: [20, 12], 9: [22, 13], 10: [24, 15] };
const JUNK = [null, undefined, 42, 'skål', [], {}, { ring: null }, { line: null }, true, NaN];

const SEEDS = 30;
const TAFL_SEEDS = 20;   // 07 generation is a real search; 20 seeds is ~7s
const seedsFor = (lock) => (lock.id === '07-tafl' ? TAFL_SEEDS : SEEDS);
const instances = (lock) => {
  const out = [];
  for (let s = 0; s < seedsFor(lock); s++) out.push(lock.makePuzzle(rng(`unit-${lock.id}-${s}`)));
  return out;
};
const canon = (v) => JSON.stringify(v);

// ---------------------------------------------------------------- interface

for (const lock of LOCKS) {
  test(`${lock.id} — declares a lawful interface`, () => {
    assert.equal(typeof lock.id, 'string');
    assert.equal(lock.ordinal, Number(lock.id.slice(0, 2)));
    assert.ok([1, 2, 3, 4].includes(lock.tier));
    assert.ok(lock.title.length > 0);
    assert.ok(lock.epigraph.length > 0);
    assert.equal(lock.hints.length, 3);
    for (const h of lock.hints) assert.ok(typeof h === 'string' && h.length > 20);
    for (const fn of ['makePuzzle', 'solve', 'verify', 'wrongAnswers', 'shard', 'mount']) {
      assert.equal(typeof lock[fn], 'function', `${lock.id} missing ${fn}`);
    }
  });

  test(`${lock.id} — meets its difficulty floor`, () => {
    const [minSteps, estMinutes] = FLOORS[lock.ordinal];
    assert.ok(lock.difficulty.minSteps >= minSteps,
      `minSteps ${lock.difficulty.minSteps} < ${minSteps}`);
    assert.ok(lock.difficulty.estMinutes >= estMinutes,
      `estMinutes ${lock.difficulty.estMinutes} < ${estMinutes}`);
    assert.ok(lock.difficulty.searchSpace > 0);
  });

  test(`${lock.id} — is deterministic per seed`, () => {
    for (let s = 0; s < 5; s++) {
      const a = lock.makePuzzle(rng(`det-${lock.id}-${s}`));
      const b = lock.makePuzzle(rng(`det-${lock.id}-${s}`));
      assert.equal(canon(a), canon(b));
    }
  });

  test(`${lock.id} — solves and verifies over every seed`, () => {
    for (const inst of instances(lock)) {
      const answer = lock.solve(inst);
      const v = lock.verify(inst, answer);
      assert.equal(v.ok, true, `canonical answer rejected: ${canon(answer)}`);
    }
  });

  test(`${lock.id} — rejects every wrong answer`, () => {
    for (const inst of instances(lock)) {
      const truth = canon(lock.solve(inst));
      const wrongs = lock.wrongAnswers(inst);
      assert.ok(Array.isArray(wrongs) && wrongs.length >= 6,
        `need >= 6 wrong answers, got ${wrongs && wrongs.length}`);
      for (const w of wrongs) {
        assert.notEqual(canon(w), truth, 'a "wrong" answer equals the solution');
        assert.notEqual(lock.verify(inst, w).ok, true, `wrong answer accepted: ${canon(w)}`);
      }
    }
  });

  test(`${lock.id} — verify is total on malformed input`, () => {
    for (const inst of instances(lock).slice(0, 5)) {
      for (const junk of JUNK) {
        const v = lock.verify(inst, junk);
        assert.ok(v && typeof v === 'object', 'verify must return an object');
        assert.notEqual(v.ok, true, `junk accepted: ${canon(junk)}`);
      }
      assert.notEqual(lock.verify(null, lock.solve(inst)).ok, true);
      assert.notEqual(lock.verify(undefined, undefined).ok, true);
    }
  });

  test(`${lock.id} — returns its frozen shard`, () => {
    const want = SHARDS[lock.id];
    for (const inst of instances(lock).slice(0, 5)) {
      assert.deepEqual(lock.shard(inst), want);
    }
  });
}

test('06–10 — difficulty never decreases across the ordinals', () => {
  for (let i = 1; i < LOCKS.length; i++) {
    assert.ok(LOCKS[i].difficulty.minSteps >= LOCKS[i - 1].difficulty.minSteps);
    assert.ok(LOCKS[i].difficulty.estMinutes >= LOCKS[i - 1].difficulty.estMinutes);
  }
});

// ------------------------------------------------------------------ 06

test('06 — the lid lexicon is collision-free under the cipher', () => {
  const inst = jotun.makePuzzle(rng('unit-06-lex'));
  const seen = new Map();
  for (const [word] of inst.lexicon) {
    const c = encipher(word);
    assert.ok(c, `word ${word} uses a letter outside the cipher`);
    assert.ok(!seen.has(c), `${word} and ${seen.get(c)} encipher alike`);
    seen.set(c, word);
  }
  assert.ok(inst.lexicon.length >= 36 && inst.lexicon.length <= 44,
    `lexicon must hold 36–44 words, holds ${inst.lexicon.length}`);
});

test('06 — every cipherword has exactly one lexicon preimage', () => {
  for (const inst of instances(jotun)) {
    for (const c of inst.cipher) {
      const pre = inst.lexicon.map(([w]) => w).filter((w) => encipher(w) === c);
      assert.equal(pre.length, 1, `cipherword ${c} has ${pre.length} preimages`);
    }
  }
});

test('06 — at least two words carry 30+ raw readings before the lexicon', () => {
  for (const inst of instances(jotun)) {
    const counts = inst.cipher.map(expansionCount);
    assert.deepEqual(counts, inst.collisions, 'declared collision counts must be true');
    assert.ok(counts.filter((n) => n >= 30).length >= 2,
      `only ${counts.filter((n) => n >= 30).length} words reach 30 readings: ${counts}`);
  }
});

// ------------------------------------------------------------------ 07

test('07 — the attacker policy is deterministic', () => {
  for (const inst of instances(tafl)) {
    const state = stateOf(inst);
    const first = attackerReply(state);
    for (let i = 0; i < 4; i++) assert.deepEqual(attackerReply(stateOf(inst)), first);
    // and deterministic deeper in, after a legal king-side move
    for (const [from, to] of legalMoves(state, 'king').slice(0, 6)) {
      const after = applyMove(state, from, to, 'king').state;
      if (after.king < 0) continue;
      const reply = attackerReply(after);
      assert.deepEqual(attackerReply(applyMove(state, from, to, 'king').state), reply);
    }
  }
});

test('07 — at least two natural first moves fail', () => {
  for (const inst of instances(tafl)) {
    const state = stateOf(inst);
    const truth = winningLines(state, inst.limit, 1)[0];
    assert.ok(truth, 'a winning line must exist');
    const naturals = naturalFirstMoves(state).filter((m) => String(m) !== String(truth[0]));
    assert.ok(naturals.length >= 2,
      `only ${naturals.length} natural first moves to refute`);
    assert.equal(inst.traps, naturals.length, 'declared trap count must be true');
    for (const [from, to] of naturals) {
      const line = { line: [[[Math.floor(from / 7), from % 7], [Math.floor(to / 7), to % 7]]] };
      assert.notEqual(tafl.verify(inst, line).ok, true, 'a natural first move must not win outright');
    }
  }
});

test('07 — no structural mutation of the canonical line also wins', () => {
  for (const inst of instances(tafl)) {
    const answer = tafl.solve(inst);
    assert.equal(tafl.verify(inst, answer).ok, true);
    for (const m of mutantsOf(answer)) {
      assert.notEqual(tafl.verify(inst, m).ok, true,
        `mutant wins: ${canon(m)} on ${canon(inst)}`);
    }
  }
});

test('07 — the king cannot already be out, and the road is short but real', () => {
  for (const inst of instances(tafl)) {
    const state = stateOf(inst);
    assert.ok(!inst.corners.includes(inst.king), 'king may not start on an exit');
    const road = kingRoad(state);
    assert.ok(road === 2 || road === 3, `road ${road} outside 2..3`);
    assert.equal(winningLines(state, inst.limit - 1, 1).length, 0,
      'the king must not be able to fall out in fewer moves than the limit');
  }
});

// ------------------------------------------------------------------ 08

/** the tilt weighing w shows if (piece, heavier) is the truth — re-derived here */
function predict(w, piece, heavier) {
  const left = w.left.includes(piece);
  const right = w.right.includes(piece);
  if (!left && !right) return 'level';
  return left === heavier ? 'left' : 'right';
}

test('08 — the three weighings are a true separating design over all 24 hypotheses', () => {
  for (const inst of instances(hacksilver)) {
    const seen = new Map();
    for (let piece = 0; piece < 12; piece++) {
      for (const heavier of [true, false]) {
        const sig = inst.weighings.map((w) => predict(w, piece, heavier)).join('|');
        assert.notEqual(sig, 'level|level|level', `piece ${piece} never touches a pan`);
        assert.ok(!seen.has(sig),
          `hypotheses ${seen.get(sig)} and ${piece}/${heavier} share signature ${sig}`);
        seen.set(sig, `${piece}/${heavier}`);
      }
    }
    assert.equal(seen.size, 24);
  }
});

test('08 — exactly one hypothesis matches the sworn tilts', () => {
  for (const inst of instances(hacksilver)) {
    const fits = [];
    for (let piece = 0; piece < 12; piece++) {
      for (const heavier of [true, false]) {
        if (inst.weighings.every((w) => predict(w, piece, heavier) === w.tilt)) fits.push({ piece, heavier });
      }
    }
    assert.equal(fits.length, 1, `${fits.length} hypotheses fit the ledger`);
    assert.deepEqual(fits[0], hacksilver.solve(inst));
  }
});

test('08 — every weighing balances its pans', () => {
  for (const inst of instances(hacksilver)) {
    for (const w of inst.weighings) {
      assert.equal(w.left.length, w.right.length, 'pans must carry equal counts');
      assert.equal(new Set(w.left.concat(w.right)).size, w.left.length + w.right.length);
    }
  }
});

// ------------------------------------------------------------------ 09

test('09 — the 64 x 3 sweep leaves exactly one (bearing, wet stone)', () => {
  for (const inst of instances(sunstone)) {
    const within = (a) => (((a - inst.arcStart) % 64) + 64) % 64 < 32;
    const fits = [];
    for (let azimuth = 0; azimuth < 64; azimuth++) {
      for (let wet = 0; wet < 3; wet++) {
        if (!within(azimuth)) continue;
        const ok = inst.readings.every((r, i) => i === wet || candidates(r).includes(azimuth));
        if (ok) fits.push({ azimuth, wet });
      }
    }
    assert.equal(fits.length, 1, `${fits.length} bearings survive the sweep`);
    assert.deepEqual(fits[0], sunstone.solve(inst));
  }
});

test('09 — each reading admits two antipodal bearings, one inside the day-mark', () => {
  for (const inst of instances(sunstone)) {
    const within = (a) => (((a - inst.arcStart) % 64) + 64) % 64 < 32;
    for (const r of inst.readings) {
      const [a, b] = candidates(r);
      assert.equal((a - b + 64) % 64, 32, 'the two bearings must stand opposite');
      assert.equal(Number(within(a)) + Number(within(b)), 1,
        'exactly one of the pair must fall inside the day-mark');
    }
  }
});

// ------------------------------------------------------------------ 10

const sylOf = (frag, i) => frag.syllables[i];

function lawsOdd(frag, stave) {
  if (frag.syllables.length !== 6) return false;                       // law 1
  if (!frag.allitAt) return false;
  const [p, q] = frag.allitAt;                                          // law 2
  if (!frag.lifts.includes(p) || !frag.lifts.includes(q)) return false;
  const onset = sylOf(frag, p).onset;
  if (!onset || onset !== sylOf(frag, q).onset || onset !== stave) return false;
  const [h1, h2] = frag.hendingAt;                                      // law 3, skothending
  if (!frag.lifts.includes(h1) || !frag.lifts.includes(h2)) return false;
  const a = sylOf(frag, h1);
  const b = sylOf(frag, h2);
  return Boolean(a.coda) && a.coda === b.coda && a.vowel !== b.vowel;
}

function lawsEven(frag, stave) {
  if (frag.syllables.length !== 6) return false;                       // law 1
  if (sylOf(frag, frag.lifts[0]).onset !== stave) return false;        // law 2, chief stave
  const [h1, h2] = frag.hendingAt;                                      // law 3, aðalhending
  if (!frag.lifts.includes(h1) || !frag.lifts.includes(h2)) return false;
  const a = sylOf(frag, h1);
  const b = sylOf(frag, h2);
  return Boolean(a.coda) && a.coda === b.coda && a.vowel === b.vowel;
}

/** the literal 8! sweep — no pruning, all 40320 orderings */
function sweepAssemblies(inst) {
  const n = inst.fragments.length;
  const perm = [];
  const used = new Array(n).fill(false);
  let count = 0;
  let only = null;
  const walk = () => {
    if (perm.length === n) {
      for (let k = 0; k < n / 2; k++) {
        if (!lawsOdd(inst.fragments[perm[k * 2]], inst.staves[k])) return;
        if (!lawsEven(inst.fragments[perm[k * 2 + 1]], inst.staves[k])) return;
      }
      count++;
      if (!only) {
        only = [];
        for (let k = 0; k < n; k += 2) only.push([perm[k], perm[k + 1]]);
      }
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = true;
      perm.push(i);
      walk();
      perm.pop();
      used[i] = false;
    }
  };
  walk();
  return { count, only };
}

test('10 — the 8! sweep finds exactly one lawful assembly', () => {
  for (const inst of instances(drottkvaett).slice(0, 8)) {
    assert.equal(inst.fragments.length, 8);
    const { count, only } = sweepAssemblies(inst);
    assert.equal(count, 1, `${count} assemblies satisfy the metre`);
    assert.deepEqual({ lines: only }, drottkvaett.solve(inst));
  }
});

test('10 — all three metre laws hold on the solution', () => {
  for (const inst of instances(drottkvaett)) {
    const { lines } = drottkvaett.solve(inst);
    const used = new Set();
    lines.forEach(([odd, even], k) => {
      used.add(odd);
      used.add(even);
      const o = inst.fragments[odd];
      const e = inst.fragments[even];
      assert.equal(o.syllables.length, 6, 'law 1: six syllables');
      assert.equal(e.syllables.length, 6, 'law 1: six syllables');
      assert.ok(lawsOdd(o, inst.staves[k]), `law 2/3 broken on odd half of line ${k + 1}`);
      assert.ok(lawsEven(e, inst.staves[k]), `law 2/3 broken on even half of line ${k + 1}`);
      // law 2 restated: the even half's chief stave joins the odd half's props
      assert.equal(sylOf(e, e.lifts[0]).onset, sylOf(o, o.allitAt[0]).onset);
    });
    assert.equal(used.size, 8, 'every half-line is used exactly once');
  }
});

test('10 — the bank never repeats a stave inside one instance', () => {
  for (const inst of instances(drottkvaett)) {
    assert.equal(new Set(inst.staves).size, 4);
    assert.equal(inst.staves.length, 4);
  }
});
