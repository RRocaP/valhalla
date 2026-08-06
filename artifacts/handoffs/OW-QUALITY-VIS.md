# OW-QUALITY-VIS handoff

**State:** done. Visual axes re-judged against the captured reference and fixed in my
lanes. Zero axis BELOW, three BEAT. Review: `docs/reviews/QUALITY_GAP_01.md`.

## Blockers cleared for QA (both were mine)
1. `src/shell/screens/lockroom.js` — temporal-dead-zone `ReferenceError` on every lock
   open (my carveText edit called `resizeBg()` above the header declarations it reads).
   Declarations hoisted above the first call + listener registration.
2. `src/shell/style.js` — `.ceremony-overlay{pointer-events:none}` silently swallowed the
   documented tap-to-skip on the shard ceremony and the duel yield beat. Now `auto`.
   Verified with real input: skip returns to the lid in **19 ms** vs 850 ms auto-advance,
   0 page errors (`artifacts/wip-qvis/skipcheck.mjs`).

## Files changed (all in my lanes)
`src/art/{wood,panel,chest,ornaments,text,sticker,index}.js`
`src/shell/{dom,style}.js`, `src/shell/screens/{threshold,lid,lockroom,finale,credits}.js`
`docs/reviews/QUALITY_GAP_01.md` (new), `artifacts/wip-qvis/**` (new)
No file under `src/locks/**`, `src/audio/**`, `src/kernel/**`, `tests/**` was touched.

## Commands + exit codes
- `npm run build` → 0 · `index.html` 1,112,412 B (1.06 MB), 15 locks, budget 2.0 MB
- `npm test` → 0 · **272/272** pass (was 268; +4 from sibling lanes, none of mine)
- `npx playwright test tests/e2e/smoke.spec.mjs` → 0 · 2/2 (desktop + iphone)
- `npx playwright test --config artifacts/wip-qvis/capture.config.mjs` → 0 · **10/10**
  across both viewports, full journey incl. finale + credits
- `node artifacts/wip-art/measure.mjs` → 0 · chestScene(1280×800) **avg 0.242 ms, max
  0.4 ms** vs ≤8 ms budget
- `node artifacts/wip-qvis/a11ycheck.mjs` → 0 · 0 px horizontal overflow at 390 and
  1280 (lid + lock room), no touch target under 44 px, sampled text contrast
  **6.84–12.55** (floor 4.5), 0 page errors
- `node artifacts/wip-qvis/refshot.mjs` → 0 · reference captured (only network use)

## Evidence
`artifacts/wip-qvis/c1/**` (before, 38 PNGs) · `c7/**` + `c8/**` (after, 64 PNGs) ·
`artifacts/reference/ref-01-boot-{d,m}.png`. 8 look-iterate cycles; c2 and c3 are the
two over-corrections (too-light walnut, cartoon ornaments) kept as the calibration trail.

## Judgment calls
- Added `art.chestLayout(w,h,n)` to `createArt()` — additive, no frozen signature changed.
  It exists because the shell was painting a second medallion set over `chestScene`'s.
  Recommend ratifying in docs/ART.md; see the review's recommendation section.
- `paintWood` opts now honour `{vignette, grainAlpha, planks, knots, shade}` and
  `paintPanel` `{seed, wash, nails}` — both signatures already documented `opts?` and
  previously ignored it.
- `carvedHeading()` renders display type to canvas and keeps the real string in a
  `.visually-hidden` span, so a11y and every existing selector/`toHaveText` still match.
- Portrait framing (`w/h < 0.85`) turns the lid grid 3×5 so the chest fills a phone.
- Pre-seeded gap 5 needed no fix: the real build already renders all five graded
  carved-arch portraits. Only the fixture flow showed the gold-circle placeholder.

## Limitations
- Audio axes not judged (live lane). Puzzle presentation for locks 06–15 belongs to the
  play-quality agent; I opened only 09 and 13 and judged shell chrome, not board art.
- The reference comparison rests on its boot screen plus one interaction — its later
  screens were not reachable by a generic first-button click.
- Typography and composition are honest **MATCHES**, not BEATS: the reference's
  small-size serif and single-object centring are genuinely excellent.

No git actions taken.
