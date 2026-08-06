# OW-FABLE-A — locks 01–05, one notch above

## State
Done. All five boards raised on feel / detail / prose / fairness / keyboard; no frozen wall
touched — pure halves semantically untouched, the only pure-side text change is 02's epigraph
(surface latitude). Owned paths only: `src/locks/01..05*.js`, `artifacts/wip-fable-a/**`, this file.

## What moved, per lock
- **01 runerow** — feel: drop-shadow lift/settle on tiles (CSS, off under reduced motion),
  state-keyed repaints (zero canvas work per drag step). detail: per-tile grain, corner
  nailheads, worn blood pigment in rune grooves; rail gets ætt pigment bands + carved divider
  notches. fairness: ættir surfaced (board/aria/journal) since near-lines judge by ætt; local
  wrong-submit shake removed (shudder is shell-owned), replaced by rail underlines — gold
  under ættir that stand, ember under the rest, cleared on touch. keys: Home/End added.
- **02 bismer** — fairness (biggest find): the clipped-and-runs-light premise lived only in
  hint 1; now in law line, journal, epigraph. detail: carved post, gradient beam + pivot
  nailhead, chains with verdigris patches, lit bowl pans, wax-seal leather pouches. feel:
  named pouch lifts. WHERE: the weighing that already clears a wrongly named pouch is
  ember-framed.
- **03 beacons** — fairness: goal ("next night all three burn as one") now stated (was only
  implied). detail/feel: braziers with two-tone living flames, ember flicker via time-gated
  rAF (armed only if rAF exists and motion allowed; cancelled on unmount), carved per-beacon
  orbit tracks, rim nailheads, detent flash per dial step. WHERE: dark braziers ember-ringed,
  ledger rows "stands dark" in bold bone (4.5:1 body floor kept).
- **04 strakes** — detail: every plank wears its name (tar wash, pale, knot, scarf, salt
  bloom, resin sheen, green cast, split crack, charred end) + grain, rivet domes with cast
  shadows, clinker lap shadow/catch light; state-keyed repaints. feel: lifted plank raises;
  set-down slides home along its grain (WAAPI, guarded). WHERE at near grain: wrongly-struck
  oath marked; parity fault → ember edges on the lapped pair(s); else gold ticks from the
  keel, ember on the first wrong strake. Ember marks ride tar under-strokes (≥3:1 non-text).
- **05 knotwork** — detail: strand sheen where the over-band crests each crossing; nailheads
  on carved tiles and panel corners. feel: just-laid crossing gleams ~160ms (timer cleaned).
  fairness: standing/running bands defined in journal; WHERE: only the FIRST doubling-over
  pair is marked — a full fault map would let iterate-submit replace tracing (fairness.md).
- **All** — one-time "By key: …" journal note on first focus; every reduced-motion path
  keeps state changes legible (no motion-only signals).

## Commands and exit codes (final battery, post-last-edit)
```
node --test tests/unit/locks-01-05.test.mjs                          exit 0  47/47
node scripts/verify.mjs --partial --seeds 60 --only 01|02|03|04|05   exit 0  each
node scripts/verify.mjs --partial --seeds 200                        exit 0  GATES GREEN, 15 locks
node artifacts/wip-locks-a/view-harness.mjs (untouched) && node artifacts/wip-fable-a/feel-gate.mjs   exit 0 each
npm test                                                             exit 0  272/272
```

## Evidence
`artifacts/wip-fable-a/`: unit/verify/view/feel/npm outputs, fairness.md, feel-gate.mjs
(fairness notes, near-marks, flicker lifecycle both motion settings, leak balance).

## Limitations / for the lead
1. **AUDIO-lane flaky test, not mine:** `tests/unit/audio.test.mjs:385` intermittently fails
   (`loopStart` 0.2 vs 0.1 — impl offsets by crossfade, test expects raw start; red twice,
   then green 6+ runs; subtest count drifts 268↔272). Red run kept at
   `artifacts/wip-fable-a/npm-test-red-run.txt`. audio.test.mjs imports only `src/audio/**`
   — no path to locks 01–05. AUDIO owner should reconcile the loopStart contract.
2. **Views verified headlessly only**; pixel truth (pigment/sheen/flame legibility at retina,
   in-situ contrast, 44px targets, flicker inside the 32ms idle budget) stays with QA/ART.
3. 05's "doubles over in one place" near branch is unreachable (break count is always even on
   a closed band); kept for verify totality.
