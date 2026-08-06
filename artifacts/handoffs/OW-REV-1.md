# OW-REV-1 — adversarial review of the deterministic gate infrastructure

Fixed: `scripts/verify.mjs`, `build.mjs`. Added (granted): `tests/unit/gates.test.mjs`.
Report-only elsewhere. No lock/art/audio/shell file touched. Zero new dependencies.

## Blocker — fixed

1. **`verify.mjs:19-28` — a `--seeds` typo produced a silent all-green run.** `Number(args[i+1])`
   on a missing value gave `NaN`; `s < NaN` is false, so every lock reported `solver 0/NaN` and the
   suite printed `GATES GREEN` having tested nothing. `--seeds 0` did the same. Now validated
   (positive integer, `exit 2`); same guard for `--only`.
2. **`verify.mjs:53-66` — the purity gate did not block `Date.now`.** The Date proxy trapped only
   `construct`/`apply`; `Date.now` is a static property read and reached the real clock (probed:
   returned a live timestamp under sabotage). CONTRACT §4.2 bans it by name, and the determinism
   gate cannot cover it — two `makePuzzle` calls in the same millisecond agree. Added a `get` trap
   on `now`; confirmed no side effects on Node internals.
3. **`verify.mjs:88-140` — `mutate()` crashed the whole runner on a scalar answer.** ES modules are
   strict, so `parent[key] = …` on a primitive threw `TypeError: Cannot create property 'undefined'
   on number '7'`; a bare number/string/bool answer is legal under CONTRACT §4.3. The throw escaped
   every `try`, killing the run and `artifacts/gates.json` with it. Root-scalar path handled;
   `mut === null` (not `!mut`) now marks "no mutant" so a falsy mutant (`0`, `false`, `''`) is used.

## Major — fixed

4. **`verify.mjs:210-222`** — `wrongAnswers` distinctness was never checked; six copies of one decoy
   passed gate 2. Now `>= 6` **distinct** canon values required.
5. **`verify.mjs:143-148`** — one unparsable lock aborted the entire report. Hit live three times
   (`09-sunstone`, `07-tafl` twice, mid-write). Now caught per file as `[id] import: …`; the other
   fourteen locks still gate.
6. **`verify.mjs:162-172`** — fifteen files did not imply ordinals 1..15. Two files may share an
   `NN-` prefix, so the suite could report GREEN with lock 15 absent (ramp checks skip too, as they
   only compare adjacent ordinals). Duplicate ordinals now always fail; a full run fails on missing
   ordinals; `--only`/`--partial` matching zero files is no longer green.
7. **`verify.mjs:217/231/239`** — `verify()` throwing on a wrong or mutated answer crashed the run
   instead of failing the lock; totality (CONTRACT §4.3) was enforced only on the 7 junk values. Now
   attributable `totality` failures, plus a guard for an id absent from the frozen `SHARDS` table
   (previously a `TypeError` on `want.rune`).
8. **`verify.mjs:281-286` + `build.mjs:84-89`** — the external-URL scan flagged the `xmlns`
   attribute, which CONTRACT §2 explicitly permits: any inline SVG would have failed a
   contract-legal build. Both scanners now exempt it, strip data URIs to their own charset (so an
   encoded payload cannot swallow the text after it), and `verify.mjs` also catches indirect
   `(0,eval)(…)`. Relative `./music.mp3` was never flagged (CONTRACT §1 respected).

## Minor — fixed

9. `verify.mjs:80-84` — `canon()` collapsed `NaN`, `±Infinity` and `undefined` onto `null`, so two
   different answers could compare equal and silently skip a mutant or pass the determinism gate.
   Distinct sentinels now; non-finite/huge numbers and `null` leaves are mutated instead of dropped.
10. `verify.mjs:130-135` — string mutation only inserted `a`–`z`, so rune answers got only
    trivially-rejectable out-of-domain mutants. Mutations now draw from the answer's own alphabet.
11. `verify.mjs:257-258` — `minSteps: '99'` passed the floor by string coercion; `Number.isFinite`
    now required. `:280` — the CONTRACT §2 1.5 MB warn line was missing; added. `:149` — ordinal
    outside 1..15 now fails iface.

## Report-only

- **`07-tafl` mutation-gate hit was answer non-canonicality, not a broken simulation.** The accepted
  mutant was the canonical line with two independent moves swapped; both orders genuinely win, and
  LOCKS.md 07 lets `verify` accept any winning line. Its owner canonicalized the answer, which is
  the fix that keeps frozen CONTRACT §7.2 intact — do not weaken the mutation gate for this class.
  Any future lock whose answer admits permutations (routes, lines) needs the same canonicalisation.
- **Purity gate does not cover module evaluation** — locks are imported before `sabotage()`, so
  top-level clock/DOM access is invisible to gate 5. Ruled a documented limitation by the lead.
- **`artifacts/gates.json` is a single shared file** — concurrent worker runs overwrite it. The
  record of truth is the lead's final full pass.
- **`performance.now()` / `crypto.getRandomValues()` stay reachable** under sabotage. Unlike
  `Date.now` the determinism gate does catch them, and CONTRACT §7.5 names only four globals, so the
  frozen definition was left alone.
- **`rng.js` (frozen)**: `pick([])` → `undefined`, `int(0)` → `0`, `int(-4)` → `-2`, `range(3,1)`
  returns `2`/`3` rather than erroring — all silent. `rng(obj)` collapses every object seed to
  `"[object Object]"`. Distribution and `shuffle` are sound (int(7) over 210k draws: 0.997–1.004 of
  expected; Fisher–Yates correct and non-mutating).
- **`futhark.js` (frozen)**: every segment coordinate is within [0,1]; `ch` and `translit` keys are
  unique (`r`/`R` do not collide). **`STAVE` is shared by identity across 14 runes** and is also
  value-equal, so `===` and deep-equality agree today — but any in-place transform of a segment
  mutates all 14. **LOCKS-C**: `ᛁ.segments === [STAVE]` exactly, which is what makes the lock-14 ᛁ
  trap work; treat segments as immutable and compare by value, never by identity.
- **Verified sound**: all 14 frozen shard values satisfy the stated law of the ring against `RING`
  (recomputed independently), and `RING` is the unique solution given ᚠ at slot 0. `FLOORS` matches
  docs/LOCKS.md exactly. Ramp logic on gapped `--partial` subsets is correct; every `broken = true`
  is paired with a recorded failure; array swaps do land in the returned copy; sabotage does not
  leak past a failing lock (all four tested in `tests/unit/gates.test.mjs`).
- **Performance note**: `07-tafl` costs 72 s of the ~80 s full 200-seed run; everything else is
  under 2.2 s. Budget for it in CI.

## Commands run (final state, exit codes)

```
node --check scripts/verify.mjs                      -> 0
node --check build.mjs                               -> 0
npm run build                                        -> 0   index.html 1056076 B (1.01 MB), 15 locks
node scripts/verify.mjs --partial --seeds 40         -> 0   GATES GREEN — 15 lock(s)
node scripts/verify.mjs --partial --seeds 200        -> 0   GATES GREEN — 15 lock(s), 600 mutants/lock
node scripts/verify.mjs --only 03 --seeds 50         -> 0   GATES GREEN — 1 lock(s)
node --test tests/unit/gates.test.mjs                -> 0   31/31
npm test                                             -> 0   186/186
```

Transient during the review (owners' files mid-write, all since resolved by their owners, none
gate-caused): `09-sunstone` and `07-tafl` unparsable; `12-veitsla` `solve()` returned
`{benches:[[],[]],boast:-1}` at seed 1 (reproduced outside the gate).

**Verdict**: trustworthy. The three false-green paths (`--seeds` typo, missing ordinals, silent
`Date.now`), the two crash paths (scalar answers, unparsable modules) and the two false-fail paths
(`xmlns`, non-finite canon collisions) are closed, and 31 tests in `tests/unit/gates.test.mjs` prove
each gate fires on a bad lock and stays quiet on a good one.
