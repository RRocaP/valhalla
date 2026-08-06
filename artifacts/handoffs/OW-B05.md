# OW-B05 — 05-knotwork, the woodcarver's panel in progress

**State** Done. VIEW half rewritten; pure half byte-identical but for one added import (`kernel/rng.js`, deterministic bench detail). `.ow5-cell` contract intact — journey e2e unchanged. Owned paths only.

**Board** Bench in two first-class layouts (wide ≥640px / tall): the work clamped in an `art.tray` with iron clamps; mallet, firmer/gouge/skew chisels, try-square, whetstone, chalk, shavings, chips over adze-scalloped dead zones; `art.hearth` puts it in the hall's one light. Carved vs free are **materially** distinct — finished tiles are dark-cut (tar ground, `insetFace` depth, gold cord in a tar socket, surviving pigment, nailheads); free tiles are chalk-sketched pending (raw pale face, chisel hatching, flat chalk cords, register tick). Cords now use butt caps and true holes at under-crossings: the old code drew **no under-strand at all** on straight crossings (2-point polyline vs a halving `shrink`), so no interlace was ever visible — fixed. **Gleam**: a turn veils the work for a breath and runs a travelling light along the whole lawful stretch that crossing now belongs to; the run lengthens as you converge — unicursality without a word. **Tally**: carved rail, goal ring + pips = bands the weave still reads as (`breaks || 1`), shrinking toward one. Comprehension: carved plate (en/es/ca); 3s ghost-hand showing on the turn that buys the longest run (preview only, never spends a move, skippable, ends on first touch, static full-run diagram under reduced motion); breaks still mark **only the first doubling-over pair** (FABLE-A ruling untouched).

**Density rubric** — dSF2, measured on the real rendered field (element screenshot decoded by `wip-b05/png.mjs`):

| | occupancy ≥55 | bench | maxVoid ≤18 | gap ≤48 | layers ≥3 | deadZone med/p90 | <44px | console |
|---|---|---|---|---|---|---|---|---|
| desk 1280×800 | **77.6%** (was 26.0) | 91.2% | **7.8%** (was 58.3) | **9px** (was 50) | 4 | 1.58 / 3.91 | 0 | 0 |
| phone 390×844 | **77.2%** (was 51.3) | 95.5% | **3.9%** (was 20.5) | **9px** (was 139) | 6 | 1.56 / 6.79 | 0 | 0 |

p90 is the props (chisels/square/whetstone), deliberate objects, not incidental carving. Gleam frame cost in a real browser: median 8.3ms, max 10.1ms, **0 frames >32ms**, both viewports.

**es / ca** Additive `i18n`: title, epigraph, 3 hints, `nearMap` (all 12 near-lines), full board table. Verified on the board (boot without `#autotest`, which pins the shell to en) — es plate "Gira los cruces libres hasta que una sola banda sin quiebro…", submit "Atar el nudo"; ca plate "Gira els creuaments lliures fins que una sola banda sense trencament…", submit "Lligar el nus".

**Commands / exit codes** (final build)
```
node scripts/verify.mjs --partial --seeds 60 --only 05            0  GATES GREEN, 60 seeds
npm test                                                          0  289/289
npm run build                                                     0  (repo-wide WARN: bundle 1.51 MB)
npx playwright test tests/e2e/journey.spec.mjs --project=desktop   0  1 passed
node artifacts/wip-qplay/ink-targets.mjs                           0  INK+TARGET FLOOR: GREEN
node artifacts/wip-b05/capture.mjs final                           0  DENSITY RUBRIC: GREEN
node artifacts/wip-b05/teach.mjs final                             0  TEACH GATE: GREEN
```
Lane gates for 05 also clean (`wip-locks-a/view-harness.mjs`, `wip-fable-a/feel-gate.mjs`); their 01–04 failures are pre-existing stub rot — see `lane-*-05.txt`.

**Evidence** `artifacts/wip-b05/shots/` (119 files): `before-*` baseline, `c1…c9-*` cycle ladder, `final-{desk,phone}-{room,field}.png`, `final-*-{showing,gleam,oneband,reduced,es,ca}.png`, `*-metrics.json`. Gate logs alongside. `sample.mjs`, `capture.mjs`, `teach.mjs`, `png.mjs` are re-runnable.

**For the lead**
1. *Not mine:* the threshold now gates on the wager card; the shared `wip-qplay/harness.mjs` predates it and times out at `crossThreshold` (my scripts click through locally; `tests/e2e/helpers.mjs` already handles it). Also caught one transient `pageerror: drawDragonHead is not defined` from a mid-edit sibling build — cleared on rebuild.
2. *Your call:* the live band tally is information the board did not give before a submit. Precedent is 01's live "n of six staves stand true", and the intended solve is one trace pass rather than a search, so hill-climbing on it is slower than tracing — but it is a judgement call, and it is one `tellTally()` call to cut.
3. Bench geometry is one `BENCH` table; the layout is picked once at mount via `matchMedia('(min-width: 640px)')` and does not re-pick on resize.
