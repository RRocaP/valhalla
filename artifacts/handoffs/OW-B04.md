# OW-B04 — 04-strakes as the shipwright's bay
State: done. VIEW half rebuilt; pure half (lines 1–213) byte-untouched. Owned paths only.
**Board**: nine strakes as ledger lines (name left, `N rivets` right) over their own gold rivet run, standing in a carved cradle — stocks, raking braces, iron pegs, wedges, sole-piece. Behind them the **ghosted hull**: nine strake lines gathering into stem/stern posts with carved heads, sheer above the top plank, keel below the bottom, so the planks sit inside the shape they become. Dead zones carry shavings, adze facets, scribe lines, wax, ghost rosettes. Testimonies are nine carved **tally-boards hung from a wall rail** by pegs and thongs, each askew, notches down the margin; the accused one is **branded** — blood pigment in a struck gouge, in a reserved zone that never crosses the text. `role=radio` + `.ow4-say` kept.

**Comprehension**: (1) carved plate — "Stack the nine strakes as the true testimonies demand — and brand the false oath." (2) ghost-hand showing, 3s, `Skip the showing`, static variant under reduce. (3) **progress notches** — eight-notch tally stick, "N of eight joints lie fair", derived in the VIEW from the current stack vs the instance's own testimonies + rivet parity; hits 8/8 exactly when the stack is true (verified live, both viewports).

**es/ca**: new additive `i18n` block — title, epigraph, 3 hints, all 11 canonical `near` lines, full board table incl. localized plank marks and ordinals. `verify()` untouched; near-lines localize through `nearMap`.

## Rubric (dSF2, `.lock-root`) — baseline → now
| | occupancy | largest void | board→controls gap | canvases (blank) | targets <44px | console |
|---|---|---|---|---|---|---|
| desk 1280×800 | .773 → **.876** | .147 → **.024** | 307 → **8px** | 9(0) → **23(0)** | 9 → **0** | 0 |
| phone 390×844 | .909 → **.923** | .022 → **.022** | 104 → **8px** | 9(0) → **23(0)** | 9 → **0** | 0 |

Contrast over the pixels actually behind each run: plank name 11.44, board line 10.97, rivet figures 6.96 (floor 4.5). Desktop board 835px — primary action on screen unscrolled. Contracts held: aria-label still starts `${mark},` (en; `#autotest` forces en), Space-lift/Arrow-move/Space-settle intact, FABLE-A's named planks, rivet domes, clinker shading, grip fix and `data-near` all kept.

## Commands + exit codes
```
node scripts/verify.mjs --partial --seeds 60 --only 04           0  solver 60/60, wrongs 660, mutants 180/180
node --test tests/unit/locks-01-05.test.mjs                      0  51/51 (my lane)
node artifacts/wip-fable-a/feel-gate.mjs                         1  BOTH 04 sections pass; 6 left are 01/02/03
npm run build                                                    0  (lead's >1.5MB size WARN)
npx playwright test tests/e2e/journey.spec.mjs --project=iphone   0  1 passed
node artifacts/wip-b04/driver-check.mjs                          0  e2e driver replayed both viewports, solved, 0 errors
node artifacts/wip-b04/capture.mjs final                          0  rubric above + 8 shots
node artifacts/wip-b04/rm-contrast.mjs                           0  drifts with motion, holds still under reduce
npm test                                                         1  279/290 — 11 fails all in the AUDIO lane
node artifacts/wip-qplay/ink-targets.mjs                         1  BLOCKED before any lock (see 1 below)
```
Evidence: `artifacts/wip-b04/shots/final-{desk,phone}[-demo|-branded|-wrong].png`, `rm-{motion,calm}.png`, `final-metrics.json`, and every gate's stdout in `artifacts/wip-b04/*.txt`.

## For the lead (not my paths)
1. `wip-qplay/harness.mjs::crossThreshold` + `ink-targets.mjs` are stale — a lane added a wager gate between threshold and lid, so any harness seeding a save hangs on "Continue"; `journey.spec.mjs` passes only because it starts fresh. My scripts answer it locally; lock 04's ink/44px floor is proven in my capture.
2. `npm test` red in the AUDIO lane (`music.act()`/AudioContext, 11 subtests); no path to locks.
3. Concurrent sibling rebuilds of the shared `index.html` intermittently serve a half-written page (I retried); a build lock or per-lane output would remove the flake.
4. `ctx.lang` is not passed by `screens/lockroom.js`, so es/ca resolves but does not display — same as lock 01; shell-side wiring only.
