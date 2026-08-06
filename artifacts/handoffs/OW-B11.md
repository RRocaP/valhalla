# OW-B11 — 11-skerry, The Skerry Road as a captain's chart table

Scope: `src/locks/11-skerry.js` **VIEW half only** (`mount` + new `i18n`) + `artifacts/wip-b11/**`. Pure half byte-unchanged (spliced around, never edited). Par stays hidden — `optimum`/`naiveLegs` are never drawn, spoken or mirrored.

**The board.** Oiled-vellum fjord chart pinned to oak: deckled edges, two inked coastlines with shore-fringe hatching, fjord-blue depth wash + hand-inked contours + engraved wave hatching + soundings, skerries as hatched rock, names in a scribe hand. Channels are passages — falling-tide glyphs on ebb-cut sounds, rising on flood-cut, sounding-cross for any-tide, dotted sledge track with skid ties for portages; sounds shut on this tide go faint and struck. A **moon-dial** in the freest corner carries the moon from EBB over the top to FLOOD on every committed leg (420 ms, blood-flash on what just closed). Route = **tarred hemp cord**, **one knot per leg** (a portage ties two), **ship token** at the head. Comprehension: (1) carved **plate** with the briefed line; (2) **ghost-hand showing** — 3 s, skippable, static variant under reduced motion: a hand sails one leg, the moon turns, half the channels close; (3) progress = knots, on the chart and on a cord tally. Fjord runs left→right on desk, **top→bottom on phone** (rotated projection, re-hit-tested). Compass rose (ᛏ north + rhumb web), brass dividers, cartouche + scale bar are placed by a measured clearance field, so dead water is furnished on **every seed**.

## Density rubric (dSF2, `artifacts/wip-b11/cap.mjs`, v0 baseline → v7 shipped)
| viewport | occupancy ≥0.55 | largest dead ≤18% | board→controls void ≤48px | <44px targets |
|---|---|---|---|---|
| 1280×800 | 0.181 → **0.713** (chart 0.812) | 29.2% → **8.4%** (chart 1.1%) | **0** | 0 |
| 390×844 | 0.298 → **0.726** (chart 0.837) | 14.9% → **8.1%** (chart 1.0%) | **0** | 0 |

0 console errors, 0 horizontal overflow, both viewports. Rig note: element screenshots of a panel taller than the viewport come back blank below the fold (the room's wood canvas is viewport-fixed) — v0–v4 numbers were inflated by that artifact; v5+ measures the panel clipped to the viewport at top **and** bottom scroll and takes the worse of the two.

## es/ca
`i18n: { es, ca }` per `src/kernel/i18n.js`: title, epigraph, 3 hints, nearMap (3 static verify lines), 36-key board table (plate, legend, verbs, tide words, dial marks, knot tally, journal lines). `en` resolves to the frozen top-level fields.

## Commands + exit codes
- `node scripts/verify.mjs --partial --seeds 60 --only 11` → **0** · solver 60/60, wrongs 592, mutants 180/180
- `npm test` → **0** · 289 pass / 0 fail
- `npm run build` → **0** (emits `WARN: bundle over 1.5 MB` — shared budget, all lanes)
- `npx playwright test tests/e2e/journey.spec.mjs --project=desktop` → **0** · 1 passed
- `node artifacts/wip-qplay/ink-targets.mjs` → **0** · INK+TARGET FLOOR: GREEN

## Captures (`artifacts/wip-b11/shots/`)
`v0-board-{desk,phone}` before · `v7-{board,panel,crop200}-{desk,phone}` after · `b1-01-showing-ebb-desk` → `b1-02-showing-flood-desk` (dial turning, channels closing) · `b2-05-knots-on-the-cord-phone` · `b2-reduced-static-desk` · `b1-06-sealed-desk`. Beat rig `artifacts/wip-b11/beats.mjs` drives a real solve through `.ow11-leg` + `Seal the route`: `5 knots in the cord`, `Leg 6 runs on the flood`, 0 errors, `solved: true`.

## For the lead
- Driver contracts preserved verbatim: `.ow11-leg` text stays `(Row to|Haul over to) <name> — …` in `en`; submit stays `Seal the route`.
- The shell gained a wager card between threshold and lid mid-pass; my rig crosses it itself. `H.crossThreshold` in `artifacts/wip-qplay/harness.mjs` may want the same.
- Transient, not mine: one `npm test` run SIGKILLed (137) while siblings were mid-write (two clean re-runs after); `12-veitsla` threw `ReferenceError: window is not defined` at mount for a stretch mid-pass — green again now.
