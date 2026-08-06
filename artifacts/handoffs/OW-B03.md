# OW-B03 — 03-beacons: The Beacon Nights as a living coast

VIEW half rewritten; pure half untouched. Two carved surfaces replace the lone dial: a **coastline relief** (three headlands, iron fire-cages on braced posts, each station's reckoning cut into a plaque with a notch strip) and a **great carved wheel** (chip-carved rim, iron band, five live moon phases, bone index blade, three notched orbit tracks, hub numeral at `carveText` depth 0.95). Desktop adds flank plaques: THE RECKONINGS (per-beacon countdown run) and THIS NIGHT (moon, tally, three cages). Additive `i18n`: es + ca (title, epigraph, 3 hints, 4 `nearMap` near-lines, 30 board strings).

BotW law: each detent ticks, kicks the blade and relights the coast; every night on the wheel shows the embers of the beacons firing there; a night lighting **2 of 3** swells both embers, brackets them, and burns those two towers — the near-miss is watched, not read. Comprehension: plain plate ("Turn the dial to the next night all three fires burn together."), a 3s ghost-hand showing that turns the wheel two detents (skippable; static + pre-walked under reduced motion), tally word under the hub.

## Density rubric — dSF2 panel captures

| | 1280×800 | 390×844 | floor |
|---|---|---|---|
| field occupancy | **57.0%** | **64.2%** | ≥55% |
| largest dead zone | **10.7%** | **9.8%** | ≤18% |
| board→controls gap | **9px** | **9px** | ≤48px |
| targets <44px · console errors | 0 · 0 | 0 · 0 | 0 · 0 |

Baseline v0 was 19.0% / 64.1% / 118px (desk). ≥3 texture layers everywhere (grain → wear/strata/scree → carve incision + lip light); dead zones carry `art.wear` tool history, chip borders, interlace rails, joint rosettes.

## Evidence — `artifacts/wip-b03/shots/`

`v0-*` baseline; `v3/v4/v6-*` iterations (both viewports, `-panel`, 200% `-crop`); `v5rm-*` + `v6-phone-rm-showing.png` reduced motion; `m2-{desk,phone}-{showing,refused,aligned}.png` (ghost hand mid-sweep; night 470 refused, all three cages ringed, gold all-burn ring one notch past the blade; night 471 all burning). Rigs: `capture.mjs`, `moments.mjs`, `lane03.spec.mjs`, `lane.config.mjs`.

## Commands + exit codes

| command | exit | result |
|---|---|---|
| `node scripts/verify.mjs --partial --seeds 60 --only 03` | 0 | solver 60/60, wrongs 711, mutants 180/180 — GATES GREEN |
| `npm test` | 0 | 290 pass / 0 fail |
| `npm run build` | 0 | 1.52 MB, 15 locks (repo-wide >1.5MB WARN, not this lane) |
| `npx playwright test tests/e2e/journey.spec.mjs --project=desktop` | 0 | 1 passed (31.5s) |
| `node artifacts/wip-qplay/ink-targets.mjs` | 0 | INK+TARGET FLOOR: GREEN |
| `npx playwright test --config artifacts/wip-b03/lane.config.mjs` | 0 | 2 passed (desktop + iphone) |

## Notes

- Selector contract intact: `canvas[role="slider"]`, `aria-value*`, Home/PageUp/ArrowUp/ArrowRight, `Set the dial`. Coast canvas is `role="img"` with a full aria-label; the DOM ledger is gone (reckonings are carved on the plaques) — the lane spec asserts both.
- `wip-qplay/harness.mjs` `crossThreshold()` predates the threshold wager card; my rigs cross it locally. Worth folding into the shared harness.
- Foreign, reproducible, not this lane: `pageerror: drawDragonHead is not defined` fires **at the lid** under `reducedMotion: reduce` (`src/art/ornaments.js` → `src/art/dragon.js`). Lock 03's room is 0-error in every capture.
