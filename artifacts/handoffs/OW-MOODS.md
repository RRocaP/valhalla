# OW-MOODS — five gauntlets, five halls

**State: done.** Each gauntlet's lock room is now a distinct place, still one game.
Gauntlet = `Math.ceil(ordinal / 3)`. I BOURJ torchlit hall (two wall brackets, sooty
floor, smoke drift, ember motes) · II RØIS seer's tent (blood×fjord plum, incense
wisps, hanging talisman silhouettes at both frame edges) · III ÅNDREAS snowlight
(blue-white key banked over the shoulders, breath-fog, frost at the panel corners)
· IV FOLKLORE feast warmth (two low hearths, dust in their shafts, mead rim at the
foot) · V ÄRYA throne cold-gold (one severe raking key, four long shadows, slow
falling dust). Palette untouched: every colour is a `mix()`/`rgba()` of frozen
tokens — light and particle overlays only, no new base hexes, no text recoloured.

## Files
- NEW `src/art/moods.js` — `applyMood(ctx,w,h,gauntlet,t,reducedMotion)` + `moodTint(gauntlet)`
  (+ `moodKey`, `MOOD_KEYS`). Static light field cached per (mood,size,dpr) and blitted;
  particles deterministic per bed. Importable under plain Node (no DOM at module scope).
- `src/shell/screens/lockroom.js` — mood application only: a `.lockroom-mood` canvas
  after the wood canvas, time-gated rAF at ~30fps, `syncMoodSize()` (a tall board grew
  the room past its measured box and CSS-stretched the backdrop), teardown on unmount,
  and `--mood-tint/--mood-glow` on two decorative accents (numeral halo, attempt dots).
  No dare/yield/duel plumbing touched.

## Checks
- `npm test` 289 pass / 0 fail · `npm run build` ok (pre-existing >1.5 MB bundle WARN)
- `npx playwright test tests/e2e/smoke.spec.mjs` 2/2 pass (desktop + iphone)
- ink+targets floor GREEN, both viewports, locks 6–15, moods live — re-run as
  `artifacts/wip-moods/rooms.mjs` because `wip-qplay/ink-targets.mjs` is currently
  blocked at the threshold by CHAPTERS' wager card (its `crossThreshold` never dismisses it)
- 15 rooms in one session: right mood each, painted, 1 layer, 0 leaked, 0 console errors
- reduced motion: mood frame byte-identical after 1.6 s, all five, both viewports

## Numbers
- **perf: 0.008–0.025 ms/frame**, `applyMood` at 1280×800 dSF2, mean of 400 frames
  (budget ≤1 ms; ~40× under). `artifacts/wip-moods/perf.mjs`, `perf.html`, `perf.json`.
- **contrast, real wood+mood composite under the inked text box**: worst mean **5.04:1**
  (G3 `.lock-epigraph`, wood-only baseline 6.09), worst *single pixel* in any text box
  **4.69:1** — every style clears 4.5 body / 3 display on both metrics. A `textGuard`
  pass subtracts the mood back out of the header/footer bands, and the same bands
  attenuate the particle pass.

## Evidence
`artifacts/wip-moods/five-rooms.png` (the strip: desktop row over phone row, locks
2/5/8/11/14, dSF2) · per-shot PNGs + JSON in `artifacts/wip-moods/shots/` (`before-`
= identical rooms, `c5-` = shipped) · `perf.json`, `rooms.json`.

## Next
`tests/e2e/journey.spec.mjs` fails at `expectNoDareCard` (lock 1) — CHAPTERS moved the
dare to 01/04/07/10/13 while the spec still keys on `DUEL_ORDER` [3,6,9,12,15]. Not
moods (my diff touches no duel plumbing); that spec and `wip-qplay/harness.mjs`'s
`crossThreshold` need CHAPTERS' update before the journey/ink gates can run green.
