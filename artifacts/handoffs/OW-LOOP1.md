# OW-LOOP1 — LIGHT & TYPE elevation (presentation only)

Lane kept: src/art/**, src/shell/**, artifacts/wip-loop1/**. No locks/audio/kernel/tests/docs.
Captures: artifacts/wip-loop1/{v0,v1,v2}/ (dSF2, 1280×800 + 390×844). v0 = before, v2 = shipped.

## 1. Hearth-light system
- One recipe: `hearthPool()` (src/art/util.js), exposed additively as `art.hearth` — warm key
  high-front (matches the existing carve/spec grammar), progress-warmed, no time term
  (reduced motion = static but present). Used by threshold, finale, credits.
- Lid: progress now VISIBLE — warm veil down the chest face + hearth pool brightens/gilds
  with opened/15 (chest.js). Before/after: v0/08-lid-late-d.png → v2/08-lid-late-d.png
  (vs v?/02-lid-fresh-d.png for the cold state).
- Lock rooms: panel spill enters over the top lip (panel.js; replaced the bottom-glow outlier,
  wash flipped to pool at the recess foot). v0/04-lockroom-d.png → v2/04-lockroom-d.png.
- Wood key gradient strengthened (wood.js step 9) — same direction on every board.

## 2. Wordmark
- New src/art/wordmark.js (additive `art.wordmark`): tracked carved VALHALLA over a carved
  rule broken by a gilded diamond, flanked by mirrored sól runes. Threshold uses it
  (title node/text contract unchanged). Lid band echo: tracked letterSpacing + two small
  carved gilded diamonds. v0/01-threshold-d.png → v2/01-threshold-d.png; lid v2/02-lid-fresh-d.png.

## 3. Type push (MATCH→BEATS)
- Ledger numerals struck (·III·, tracked .42em, relief) + hasp values gold over tar seat
  (lid.js). Journal + settings = vellum: layered dark, chain-line rhythm, gold hairline,
  blood margin, ink-bone lines; overlay titles tracked deep relief. Buttons 700/.12em;
  hint slots small-caps display; ceremony/finale/credits headings deep relief + tracking
  discipline. Body text untouched (contrast floors re-verified by e2e floors).
  v0/03-journal-d.png → v2/03-journal-d.png; v0/04b → v2/04b header crops.

## 4. Medallion states
- Three materials (ornaments.js): tar-cold sealed (colder field, dull rim, faint cold-tinted
  ghost), ember-breathing next (~4s asymmetric breath, glowing coal fissures; reduced
  motion holds mid-breath instead of dimmest), gold-struck open (rune PROUD: ivory face
  over tar seat — pixel-verified via artifacts/wip-loop1/probe-medallion.mjs).
- Duel medallions (3/6/9/12/15) carry a blood-painted groove ring + binding ticks in every
  state; DOM banner is now a swallow-tailed ribbon (clip-path, lit edge, small-caps,
  drop shadow). v0/06b-banner-crop-d.png → v2/06b-banner-crop-d.png; v2/09b states crop.

## 5. Dare card theatre
- Entrance beat: house darkens (feathered .dare-vignette), card rises, portrait warms up
  over 1.6s (CSS, reduced-motion drops all animation, lands lit). Name plate carved
  (carvedHeading, text contract intact), taunt set as inscription between hairline rules,
  portrait gets additive `opts.rim` hearth rim-light (portrait.js; also on yield tween).
  v0/07-dare-d.png → v2/07-dare-d.png, v2/07-dare-m.png.

## Gates (all after final state)
- npm test → exit 0, 272/272 · npm run build → exit 0, 1,120,799 B (1.07 MB ≤ 2.0)
- npx playwright test tests/e2e/ → exit 0, 6/6 (desktop+iphone)
- node artifacts/wip-qplay/ink-targets.mjs → exit 0, "INK+TARGET FLOOR: GREEN"
- node artifacts/wip-art/measure.mjs → avg 0.246 ms, max 0.3 ms (≤8 ms)
- Additive API note for ratification in docs/ART.md (not edited — not my lane):
  `art.hearth(ctx,w,h,{progress,y,strength})`, `art.wordmark(ctx,cx,y,size,opts)`, `portrait opts.rim`.
