# OW-REV-1 — adversarial review of the deterministic gate infrastructure

Scope: fixed `scripts/verify.mjs`, `build.mjs`. Report-only elsewhere. No lock/art/audio/shell/test file touched.

## Fixed (blocker)

1. **`verify.mjs:19-28` — `--seeds` typo produced a silent all-green run.** `Number(args[i+1])`
   with a missing/garbage value gave `NaN`; `s < NaN` is false, so every lock reported
   `solver 0/NaN` and the suite printed `GATES GREEN` having tested nothing. `--seeds 0` did the
   same. Fixed: `flagValue()` + positive-integer validation, `exit 2`. Same guard for `--only`.
2. **`verify.mjs:53-66` — the purity gate did not block `Date.now`.** The Date proxy trapped only
   `construct`/`apply`; `Date.now` is a static property read and passed straight through to the
   real clock (probe: returned `1786006105764` under sabotage). CONTRACT §4.2 bans it by name, and
   the determinism gate cannot catch it — two `makePuzzle` calls in the same millisecond agree.
   Fixed with a `get` trap on `now` (verified no side effects on Node internals).
3. **`verify.mjs:88-140` — `mutate()` crashed the runner on a scalar answer.** ES modules are
   strict, so `parent[key] = …` where `parent` is a primitive threw `TypeError: Cannot create
   property 'undefined' on number '7'`; a bare string/number/bool answer is legal under CONTRACT
   §4.3. The throw escaped every `try`, killing the whole run and `artifacts/gates.json` with it.
   Fixed: root-scalar path handled; `mut === null` (not `!mut`) now marks "no mutant" so a falsy
   mutant (`0`, `false`, `''`) is no longer skipped.

## Fixed (major)

4. **`verify.mjs:210-222` — `wrongAnswers` distinctness was never checked.** Six copies of one
   decoy passed gate 2. Now `>= 6` **distinct** canon values are required.
5. **`verify.mjs:143-148` — one unparsable lock module aborted the entire report.** Hit live:
   `09-sunstone.js` mid-write threw `SyntaxError` and no other lock was gated. Now caught per file
   as `[id] import: …`; the remaining locks still run.
6. **`verify.mjs:162-172` — 15 files did not imply ordinals 1..15.** Two files may share a `NN-`
   prefix, so the suite could report GREEN with lock 15 absent (ramp checks silently skip too,
   since they only compare adjacent ordinals). Now: duplicate ordinals always fail; a full run
   fails on missing ordinals; `--only`/`--partial` matching zero files is no longer green.
7. **`verify.mjs:217/231/239` — `verify()` throwing on a wrong or mutated answer crashed the run**
   instead of failing the lock. Totality (CONTRACT §4.3, LOCKS.md common law) was only enforced on
   the 7 junk values. Now attributable `totality` failures. Same for `shard()`, plus a guard for an
   id absent from the frozen `SHARDS` table (previously a `TypeError` on `want.rune`).
8. **`verify.mjs:281-286` + `build.mjs:84-89` — the external-URL scan flagged the xmlns attribute,**
   which CONTRACT §2 explicitly permits. Any inline SVG (`xmlns="http://www.w3.org/2000/svg"`) in
   the art layer would have failed a contract-legal build. Both scanners now exempt it, strip data
   URIs to their own charset (so an encoded payload cannot swallow the text after it), and
   `verify.mjs` also catches indirect `(0,eval)(…)`. Relative `./music.mp3` was never flagged.

## Fixed (minor)

9. `verify.mjs:80-84` — `canon()` collapsed `NaN`, `±Infinity` and `undefined` onto `null`, so two
   different answers (or two different instances) could compare equal and silently skip a mutant or
   pass the determinism gate. Distinct sentinels now. Non-finite/huge numbers and `null` leaves are
   also mutated instead of being silently dropped.
10. `verify.mjs:130-135` — string mutation only ever inserted `a`–`z`, so rune/uppercase answers got
    only trivially-rejectable out-of-domain mutants. Mutations now draw from the answer's own
    alphabet (6-jotunvillur gained an effective mutant per 40 seeds as a result).
11. `verify.mjs:257-258` — `minSteps: '99'` passed the floor by string coercion. `Number.isFinite`
    required. `verify.mjs:280` — the CONTRACT §2 1.5 MB warn line was never implemented; added.
    `verify.mjs:149` — ordinal outside 1..15 now fails iface.

## Report-only — for the lead, not fixed

- **BLOCKER (not my path): `npm run gates` can never pass.** `npm test` = `node --test tests/unit/`
  fails on Node 26.4 with `Cannot find module '/Users/ramon/oathwood/tests/unit'`, exit 1, before
  build/verify run. With a glob the same files pass 94/94. Fix in `package.json`:
  `"test": "node --test 'tests/unit/*.test.mjs'"`.
- **MAJOR: purity gate does not cover module evaluation.** Locks are imported before `sabotage()`,
  so top-level `Date.now()`/DOM access is invisible to gate 5. Sabotaging the import would be the
  strict reading of CONTRACT §7.5 but could break a legitimate top-level import chain — lead's call.
- **MAJOR: the mutation gate assumes unique answers.** LOCKS.md 07 and 11 allow any winning
  line / any legal route of optimum length. A mutation that happens to stay valid is a reproducible
  *false* failure. 11-skerry is clean at 200 seeds; flagging before 07 lands.
- **MINOR: `artifacts/gates.json` is a single shared file.** Concurrent worker runs overwrite it —
  after my 200-seed run a worker's `--only` run left `seeds: 60, locks: 1`. Do not read it as the
  record of the last full run while workers are live.
- **MINOR: `performance.now()` and `crypto.getRandomValues()` stay reachable under sabotage.** Both
  leak (probed). Unlike `Date.now` the determinism gate does catch them, and CONTRACT §7.5 names
  only four globals, so I left the frozen definition alone.
- **`rng.js` (frozen)**: `pick([])` → `undefined`, `int(0)` → `0`, `int(-4)` → `-2`, and
  `range(3,1)` returns `2`/`3` instead of erroring — all silent. `rng(obj)` collapses every object
  seed to `"[object Object]"`. Distribution and `shuffle` are sound (int(7) over 210k draws: 0.997–1.004
  of expected; Fisher–Yates correct, non-mutating).
- **`futhark.js` (frozen)**: all segment coordinates are within [0,1]; `ch` and `translit` keys are
  unique (`r`/`R` do not collide). `STAVE` is shared **by identity** across 14 runes and is also
  value-equal, so `===` and deep-equality agree today — but any in-place transform of a segment
  mutates all 14. **LOCKS-C**: `ᛁ.segments === [STAVE]` exactly, which is what makes the lock-14
  ᛁ trap work; treat segments as immutable and compare by value, not identity.
- **Verified sound**: all 14 frozen shard values in `shards.js` satisfy the stated law of the ring
  against `RING` (recomputed independently), and `RING` is the unique solution given ᚠ at slot 0.
  `FLOORS` in verify.mjs matches docs/LOCKS.md exactly. Ramp logic on gapped `--partial` subsets is
  correct and future-proof; every `broken = true` is paired with a recorded failure; array swaps do
  land in the returned copy; `sabotage()`/`restore()` do not leak past a failing lock (tested).
- **Live lock findings (owners'):** `09-sunstone.js` was import-broken mid-write (now fixed by its
  owner); `12-veitsla.js` `solve()` returned `{benches:[[],[]],boast:-1}` at seed 1 — reproduced
  outside the gate, so not gate-caused; also since fixed. Both are green now.

## Commands run (exit codes)

```
node --check scripts/verify.mjs                        -> 0
node --check build.mjs                                 -> 0
npm run build                                          -> 0   (index.html 962087 B, 12 locks)
node scripts/verify.mjs --partial --seeds 40           -> 0   GATES GREEN — 12 lock(s)
node scripts/verify.mjs --partial --seeds 200          -> 0   GATES GREEN — 12 lock(s)  (>=574 mutants/lock)
node scripts/verify.mjs --only 03 --seeds 50           -> 0   GATES GREEN — 1 lock(s)
npm test                                               -> 1   (invocation bug above, not a test failure)
scratch: gatetest.mjs   16 synthetic-lock gate cases   -> 0   16/16 each new gate fires, none false-fires
scratch: bundletest.mjs 10 bundle-gate cases           -> 0   10/10 xmlns+data+mp3 green, eval/external fail
scratch: leaktest.mjs   sabotage leakage across locks  -> 0   no leak after a mid-run purity throw
```

Self-test scripts live in the session scratchpad (not committed — they would need a `tests/` path I
do not own). Recommend the lead re-home `gatetest.mjs` as `tests/unit/gates.test.mjs` so the gate
infrastructure is itself gated.
