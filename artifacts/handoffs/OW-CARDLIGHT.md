# OW-CARDLIGHT — the jarls' faces read

Ramon, live on iPhone: "can barely even see the jarl's face and outfit". Cause was
measured, not guessed: the portrait grade multiplied every pixel by the oak tint,
costing ~40% of exposure before the vignette took another ~18% off the brow.

## Face-region mean luminance (Bourj, same box on graded vs raw cover-fit source)

| beat | before | after | floor |
|---|---|---|---|
| dare, phone 390x844 | 39.1 / 69.0 = **0.566** | 75.9 / 69.0 = **1.100** | ≥0.9 rest |
| dare, desktop 1280x800 | 39.1 / 69.0 = **0.566** | 75.8 / 68.9 = **1.100** | ≥0.9 rest |
| yield, phone | 35.7 / 68.5 = **0.521** | 74.9 / 69.0 = **1.086** | ≥0.9 |
| yield, desktop | 35.3 / 68.5 = **0.515** | 74.6 / 69.1 = **1.080** | ≥0.9 |
| yield fully bowed (= reduced-motion still) | — | 58.4 / 69.0 = **0.847** | ≥0.8 final |

Desaturation 0.4–7% (cap 15%). Dare warm-up ends at `filter:none`; reduced motion
starts there. All five jarls + credits path spot-checked by eye, zero console errors.

## Changed

- `src/art/grade.js` — additive `preserveLum` / `lift` / `vignetteEdge`, all default 0.
  `sticker()` passes none of them, so the credits grade is byte-identical.
- `src/art/portrait.js` — tint restored to source luminance (hue-only oak, no exposure
  tax), lift 0.3, vignette confined to the outer 12% corners, rim extended down the
  flanks with a hotter shadow-side pass, bow wash 0.62 flat → 0.16→0.40 gradient,
  tar backing so the bow's dip never exposes bare board.
- `src/shell/screens/lockroom.js` — arch measured from the card (268px = **78.4% of card**,
  **46/46px** margins at 390x844; was 220px/64.3%/85px), arch-following chip band with
  per-chip lit/shade walls, scribe pair, tightened card rhythm (gaps 10/9), yield beat
  on the same stage + per-frame clear (fixes a pre-existing crown smear), `drawRune`
  `opts.magic` **adopted and verified rendering** (1633 arcane px in the shard strike).

## Gates (final build)

`npm test` 293/293 · `npm run build` green · `ink-targets` GREEN · `checks.mjs` GREEN ·
`npx playwright test tests/e2e/` **10 passed, 2 failed** — both are `floors.spec.mjs`'s
offline console assertion, **not this lane**: `src/audio/music.js` (changed today) now
fetches `./act3.mp3` + `./act2.mp3`, and the spec's offline whitelist still covers only
`music.mp3|credits.mp3`. The bundle has exactly four network resources; two are
whitelisted. Fix belongs to the audio/music owner or the spec owner.

## For the lead

`docs/ART.md` §portrait() still specifies "desaturate ~25–35%, warm oak-tone multiply,
tar vignette" — superseded by Ramon's live call. ART.md is outside my allowed paths.

Rig: `artifacts/wip-cardlight/{measure,checks,sidebyside}.mjs` · evidence
`artifacts/wip-cardlight/shots/sbs-*.png` (before/after) and `measure-{before,final}.json`.
