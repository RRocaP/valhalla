# OW-RUNEFIRE — arcane rune-fire treatment

## Option (siblings feature-detect + adopt)
`import { RUNE_MAGIC_VERSION } from '../art/runes.js'` (=1), then:
`drawRune(ctx, ch, x, y, size, { magic: 0..1, t: ms, reduced?: bool })` — additive opts, all existing calls unchanged.
`medallion(ctx, x, y, r, state, ordinal, { t })` — additive 7th arg threads the scene clock (falls back to performance.now()).
Hasp strip runes are shell-owned (src/shell/screens/lid.js:210) — suggested adoption: add `{ magic: 0.25, t }`.

## What it does
- Groove-masked: scorch bed (fjord/tar) → fjordLight body → arcane.bright vein → flame hairline, all inside the pigment ribbon; chisel carve + under-shadow stay visible at magic 1.0. Bloom hugs strokes (offset-shadow bake), never a radial puddle.
- Wisps: ≤3 waisted S-curve licks from deterministic top apexes (`wispAnchors(ch)`), only at magic ≥ 0.6, geometry gated ~30fps, sway/flick t-driven.
- Reduced motion: static glow held mid-breath, NO wisps (verified in preview + real game).
- Applied minimally: medallion 'open' magic 0.18 (quiet ember), 'next' 0.6+pulse·0.22 (breathes with the coal, wisps ride the breath top). Everything else stays cold until opted in.
- palette.js additive `arcane` mixes (fjord/fjordLight/bone/tar only — no token redefinitions). wordmark.js left untouched: whisper candidates prototyped (wordmark-v5.png) read as smudge at ceremony scale; threshold stays gold-cold.

## Perf (measured, preview #measure, 64px dSF2, rasterization flushed)
Glow pass 0.039–0.042ms/rune (gate ≤0.5) · base 0.015ms · cold bake all 16 sprites 1.2ms once · sprite cache max 96, LRU-evicted.

## Contrast (worst case, computed)
bone on oak+50% bloom veil 4.88:1 PASS · bone+15% fringe 8.67:1 · goldBright on tar+20% core fringe 11.58:1 · boneDim+15% 5.07:1.

## Evidence (artifacts/wip-runefire/)
Iterations kept: board-{oak,tar}-v1..v5.png + crops (v1 neon → v2 icy/thorns → v4 chroma → v5 keeper). Real game: game-lid-{fresh,progress4}-{desktop,iphone}.png, game-lid-reduced-desktop.png, crop-game-{next,open,reduced}.png — all dSF2, console clean.

## Gates
art/dragon/gates/shell/locks-01-05/06-10/11-15 unit suites GREEN · npm run build GREEN (bundle 1.54MB WARN pre-existing) · smoke e2e GREEN (desktop+iphone).
PRE-EXISTING, not this lane: tests/unit/audio.test.mjs failures (music.act fetch order; imports only src/audio/** — no art in its graph).
