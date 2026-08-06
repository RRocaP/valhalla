# OW-LOCKS-B — locks 06–10

## State
Complete and green. Five locks (pure logic + views), one unit suite, all gates passing.

## Files (only owned paths touched)
- `06-jotunvillur.js` — frozen rune-name cipher; 41-word authored ship-lexicon with glosses;
  re-rolls until every cipherword has exactly one lexicon preimage, ≥2 words carry ≥30 raw
  readings, ≥3 distinct lengths.
- `07-tafl.js` — brandubh 7×7 weak-king endgame; ruleset R1–R7 and attacker policy P1–P3 in
  the module header, shared by solver, verify and view.
- `08-hacksilver.js` — 12 pieces / 24 hypotheses; separating design proved by simulating all
  24 signatures inside `makePuzzle`, never by construction.
- `09-sunstone.js` — 64-point ring, ±16 pairs, one corrupt stone; uniqueness by 64×3 sweep.
- `10-drottkvaett.js` — 12-fragment authored bank (6 skot / 6 aðal); three metre laws computed
  from per-syllable onset/vowel/coda; unique assembly proved by sweep.
- `tests/unit/locks-06-10.test.mjs` — 51 tests; every lock-specific law re-implemented from
  instance data so no module marks its own homework.
- `artifacts/wip-locks-b/{view-drive.mjs,view-drive.txt,gates-200.txt}` — evidence.

Ladder (approved): minSteps 17/19/21/23/25, estMinutes 9/11/13/14/16 — one step above each
floor, at/below lock 11's floor so LOCKS-C is not forced to break the ramp.

## Commands + exit codes
- `npm test` → **0** — 264 tests, 264 pass, 0 fail (13 suites, whole repo, 30.4 s).
- `node scripts/verify.mjs --partial --seeds 60 --only 06|07|08|09|10` → **0** each;
  solver 60/60, all wrongs and 180/180 mutants rejected per lock.
- `node scripts/verify.mjs --partial --seeds 200` → **0**, GATES GREEN, 15 locks.
  06 200/200 (34 ms) · 07 200/200 (71.4 s) · 08 (32 ms) · 09 (4 ms) · 10 (21 ms).
  Log: `artifacts/wip-locks-b/gates-200.txt`.
- `node artifacts/wip-locks-b/view-drive.mjs` → **0** — all five views mounted, driven to a
  verified `ctx.submit` via the documented interaction path (07 keyboard-only), then
  unmounted: 0 nodes and **0 listeners** left. Output: `view-drive.txt`.

## The 07 mutation failure, and the fix
Not a verify bug. `makePuzzle` had a hardcoded fallback used whenever the 3000-attempt search
failed (~15% of seeds) and never validated; that board admitted two winning lines whose first
two moves commute. Fixed by (a) deleting the fallback — generation now loops until a position
qualifies, and (b) adding `mutantsOf()`, which enumerates **every** structural mutation
`scripts/verify.mjs` can produce (array swaps at all three nesting levels, every integer leaf
±1..3 — 84 candidates) and rejects any position where a mutant still wins. That is an
exhaustive superset of what the gate samples. **verify was not weakened**: it still accepts any
line winning within the limit, exactly as §07 specifies. Generation prefers ≤2 winning roads
for 1500 attempts. Hot paths optimised (in-place attacker scoring on one occupancy board;
last-ply short-circuit to king-onto-corner): 1.67 s → 0.34 s per seed.

## Contract notes recorded (not widened) — both need a lead ruling
1. **§09 unreachable as worded.** A reading's two candidates (r±16 on a 64-ring) are always
   antipodal, so two clean readings admit either the same pair or none: no set of readings can
   single out one azimuth, and "exactly one azimuth is consistent with two uncorrupted
   readings" has no instance. Minimal repair placed in instance generation (explicit worker
   latitude): a day-mark, the 32-point half the sun stands in this watch. One member of each
   antipodal pair falls inside it. Answer shape, ±16 rule, sweep and floors untouched.
2. **§07 policy step 2 says "minimise king's BFS distance".** Read literally the attackers step
   aside and open the road — cooperative, no endgame possible. The adversarial reading
   (maximise) is implemented and documented, behind the constant `POLICY_SIGN`; a one-line flip.

## Limitations
- 07 costs ~0.34 s/seed to generate; it is 71 s of the 78 s 200-seed gate. Its unit tests use
  20 seeds to keep `npm test` at ~30 s.
- Views were driven through a DOM stub, not a browser: no layout, paint, contrast or touch
  target measurement; canvas calls recorded, not rasterised. The browser gate (CONTRACT §7.7)
  and accessibility floor (§8) still need QA.
- `src/art` gained a real implementation mid-task; my views code to the documented API only.
