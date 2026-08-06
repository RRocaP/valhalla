# OW-B02 — 02-bismer: the Bismer Scales as a merchant's weighing corner

VIEW half only; `makePuzzle/solve/verify/wrongAnswers/shard/difficulty` byte-untouched. Driver contract intact: nine `[role=radio].ow2-pouch` in pouch-index order, button `Name the pouch`, `aria-checked`/`data-struck` unchanged.

**Identity.** Each weighing is a physical tableau on baked wood: carved oak beam (iron straps, gold end caps) pivoting on a turned post with ring cuts, verdigris collar and nailed foot block; three-strand verdigris chains; hammered bronze pans with facet ring, rim, rivets and verdigris pooled in the dish; wax-sealed leather pouches riding in the pans with the ertog tally nicked into the belly; a set-aside ledge cut into the counter; hook rail, chalk tallies, tally stick and cord coil in the dead zones. **Reads at a glance:** 22px tilt over a 122px arm plus a tongue rigid with the beam riding a notched arc plate; the sunk pan's counter shadow tightens, the risen one's spreads; level = tongue in the centre notch. **Rack:** nine carved niches (9-up ≥660px, 3×3 below) with shelf boards, uprights, chip lips, joint rosettes, peg nails, written tag under each niche. **Weight-feel:** pouch rises on hover/focus with a fast overshoot and settles on a per-index heavier ease (`--settle` 0.36–0.52s, keyed on rack position, never on the answer); its `::after` cast shadow stays put and spreads as the pouch lifts.

**Comprehension.** (1) always-visible carved ask plate — *"Two weighings are sworn. Name the light pouch."*; (2) 3s skippable ghost-hand showing on first entry (gold hand closes on the cord, pouch lifts and is set back; reduced motion gets the same still diagram with dashed up/down arrows; any focus/click/skip ends it); (3) carved tally notch at each niche head — empty / red X struck / gold pin named — and the named pouch glows gold wherever it stands (rack, pan, ledge). A carved reckoning rule (24 ertog, øre every third tick) sits beside the ertog toggle.

## Rubric self-scores — `artifacts/wip-b02/shots/final-metrics.json`
| | 1280×800 | 390×844 | floor |
|---|---|---|---|
| field occupancy | **0.825** | **0.829** | ≥0.55 |
| largest featureless region | **0.136** | **0.142** | ≤0.18 |
| board→controls gap | **8px** | **8px** | ≤48px |
| targets under 44px | **0** | **0** (radios 107×125) | 0 |
| texture layers per surface | wood grain → tray band/chip/rosette/wear → carved prop | same | ≥3 |

**Before** `artifacts/wip-b02/shots/before-desk.png`, `before-phone.png` · **after** `final-desk-board.png`, `final-phone.png`, `final-phone-rack.png` · **states** `final-showing.png`, `final-reduced.png`, `final-hover.png`, `final-named-struck.png`, `final-near.png`, `final-ertog.png` · v0 source kept at `artifacts/wip-b02/02-bismer.v0.js`.

**i18n added:** `i18n.es` + `i18n.ca`, 46 strings each — title, epigraph, 3 hints, 3 `nearMap` (both canonical `verify` lines + the `later` fallback), 38 board strings. Units *mark / øre / ertog* stay untranslated as in-fiction artifacts (CONTRACT §4.1); every instruction, caption, aria-label and journal line localizes.

## Gates
| command | exit |
|---|---|
| `node scripts/verify.mjs --partial --seeds 60 --only 02` | **0** — solver 60/60, wrongs 480, mutants 180/180 |
| `npm test` | **0** — 290/290 |
| `npm run build` | **0** — 1.50 MB, over the 1.5 MB warn line (see block 2) |
| `npx playwright test tests/e2e/journey.spec.mjs --project=desktop` | **0** — 1 passed, 30.4s, clean console |
| `node artifacts/wip-qplay/ink-targets.mjs` | **1** — blocked, not by this board (block 1) |
| `node artifacts/wip-b02/ink-targets-02.mjs` (substitute) | **0** — GREEN both viewports: 15 canvases inked, 0 under-44, clean unmount/remount |

**Block 1.** `artifacts/wip-qplay/harness.mjs:57 crossThreshold()` predates the shell's wager card, so `ink-targets.mjs` times out before reaching any lock room — it never gets to ord 6, and it does not cover lock 02 at all. One-line fix for the wip-qplay owner: after clicking the threshold button, click `.wager-layer .wager-continue` if visible (exactly what `artifacts/wip-b02/capture.mjs` does). The substitute above applies that script's own assertions to board 02.
**Block 2.** Bundle was 1.17 MB before this wave, 1.24 MB with my first pass; the rest arrived from sibling lanes in the same window. This board's source is 21 KB → 69 KB raw (minified, comments stripped, in the bundle).

Server left running on 127.0.0.1:8791 (restarted after it died mid-wave); kill it when the wave closes.
