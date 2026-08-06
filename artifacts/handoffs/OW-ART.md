# OW-ART handoff

**State:** done. `src/art/index.js` replaced wholesale; full frozen API (docs/ART.md,
incl. both addenda: `portrait()`/JARLS and `sticker()`/`carveText()`/`reliefShadowCss`)
implemented across focused modules. 3 look-iterate screenshot rounds completed; wood,
carveText relief, and two ornament kinds were reworked mid-review after failing the
bar on the first pass. `npm run build` and `npm test` green.

## Files (all under my owned paths)
`src/art/{index,palette,util,wood,runes,knot,gold,ornaments,panel,chest,portrait,grade,sticker,text}.js`
`tests/unit/art.test.mjs` (new — pure helpers only: contrastRatio, segIntersect,
computeInterlace, medallionState)
`artifacts/wip-art/{preview.html,measure.mjs}` + evidence pngs below

## Commands + exit codes
- `npx playwright install chromium` — one-time browser cache download (not a package
  change) needed for the required screenshot command.
- `npm run build` → exit 0. 1.02 MB (15 locks now bundled by sibling workers), no
  external URLs, under the 2.0 MB budget.
- `npm test` → exit 0. 249/249 pass repo-wide, including my 12 new art tests.
- `node artifacts/wip-art/measure.mjs` → chestScene(1280×800) after cache warm, n=24:
  **avg 0.229ms, min 0.1ms, max 0.3ms** — well inside the ≤8ms budget.

## Evidence
- `artifacts/wip-art/preview-v1.png` / `-v2.png` / `-v3.png` — required-command
  screenshots (1280×1600 viewport) across the 3 iterations.
- `artifacts/wip-art/preview-full-v1.png` / `-full-v2.png` — full-page captures used
  for close-in review (v1 found: flat-reading wood, invisible carveText depth ramp,
  near-invisible dragonhead/wavebord, flat-gold knots; v2 fixed all four and holds in
  v3 with no further code changes).
- Numeric contrast gate renders live on the preview page: bone/boneDim vs
  oakDeep/oak/tar all PASS ≥4.5:1 (6.29:1 worst case), plus a black/white sanity check.

## Limitations / judgment calls (filed in plan, approved by coordinator)
- No "iron" token in the frozen palette — iron straps use tar + boneDim catch-light,
  never gold/goldBright.
- `medallion`'s revealed glyph is a cosmetic pick from kernel `ORDER`, not the
  authoritative shard (`kernel/shards.js` owns that; shell renders it elsewhere).
- `medallion`'s "next" pulse self-times via `performance.now()` (frozen signature has
  no time param); amplitude 0 under reduced motion, state still visually distinct.
- `chestScene` derives all 15 socket states from the single scalar `progress` via the
  new pure `medallionState(ordinal, progress)`, and paints its own wood backdrop.
- `treasureFrame` is frame-only (no image param in the frozen signature); shell
  composites the treasure image.
- `sticker`'s "white" die-cut border uses palette `bone` (no pure #fff token exists).
- Screenshots were taken at deviceScaleFactor=1, not a forced 2x retina capture; the
  procedural recipes were judged directly rather than re-verified at 2x pixel density.
- Wood texture cache capped at 3 entries, dpr capped at 2 for the cached texture only,
  to bound per-entry memory (tens of MB at 3x); display canvases still scale to dpr 3.
