# QUALITY LOOP 4 — fresh-eyes cold play, polish + de-clutter pass

Method per docs/QUALITY.md: full cold journey played in a real browser (fresh
save), desktop 1280×800 + phone 390×844, dSF2 captures of every station;
reference re-captured at dSF2 (`artifacts/wip-loop4/reference2/`). Evidence:
`artifacts/wip-loop4/survey-before/` vs `artifacts/wip-loop4/survey/` (same
indices = same station), headline pairs in `artifacts/wip-loop4/pairs/`,
Ramon's album in `artifacts/wip-loop4/album/` (14 shots).

## What the cold play found (ranked), and what was done

1. **Entry framing (P0, every board)** — all 15 boards are taller than a
   1280×800 window (+161…+836 px; phone up to +1679); focus-scroll landed the
   player mid-board with the chapter numeral/title cropped above the fold and
   the submit below it. FIXED: rooms open at their top (preventScroll focus +
   scroll reset); a quiet gold chevron cue shows only while board remains
   below the fold. (lockroom.js, style.js)
2. **Ceremony stagecraft (P0)** — yield + shard beats played on a fully lit
   workbench: header, hint horns and a bare "Close the lock" underline stayed
   on stage; the shard rune floated at 132px in an emptied room; the yield
   portrait was dimmer than its dare. FIXED: fixed-position house vignette
   under both overlays (tap-anywhere still skips), rune scaled to the room
   (148–216px), yield portrait carries the dare's rim light, latch restyled
   as a carved small-caps plate (class/label contracts untouched). (style.js,
   lockroom.js)
3. **Lid banner pile-up (P0)** — five same-red ribbons + pennant flaps at
   interior junctions + per-jarl knot devices on SEALED banners read as a red
   lattice with sparkle debris colliding with medallion rims. FIXED: armed
   banner leads (alpha 1 + device + flaps), done .5, revealed .62, sealed .4
   with a tar wash, no device, no flaps; flaps now only at true row-outer
   margins; sealed labels recede. (lid.js)
4. **Ledger legibility** — shard values hung half off the hasp rail and
   collided as the row filled. FIXED: each value seated in a tar pill with a
   gold hairline. (lid.js)
5. **Button discipline** — L01 submit was a thin outline, L02's carved plate
   stretched wall-to-wall, L14's submit was a quiet plate. FIXED: one carved
   gold primary everywhere, compact and centered; secondaries stay quiet.
   (01, 02, 06, 14 view halves)
6. **Type discipline** — terminal-mono intrusions (L06 helper line + slots,
   finale colophon, credits captions) swapped to the house serif/small-caps;
   mono stays only where it is a deliberate stamp (numerals, labels).
7. **Weakest two boards lifted** — **L06 Jötunvillur**: reading rows rebuilt
   as timber laths (wood gradient, top light, seated shadow, gold selection
   glow); **L09 Sunstone**: crystals rebuilt as calcite spar (per-face
   gradients, heavy silhouette, cast shadow, pooled light, doubled ghost
   edges) replacing flat "cardboard" boxes.

Kept deliberately: magic-blue rune fire on ember/next medallions (landed
OW-RUNEFIRE art; the blue-in-ember mix is the game's arcane accent), chapter
mood props, dense carved surrounds — the reference wins by subtraction, but
Ramon's density rubric governs surfaces; this loop subtracted EVENTS (noise),
not material.

## Axis verdict vs https://rrocap.github.io/roca-airways/ (re-captured dSF2)

| Axis | Verdict | Note |
|---|---|---|
| Surface believability | BEATS | layered wood/carve/props everywhere; reference is deliberate flat indigo |
| Carve/relief | BEATS | carved headings, chip borders, trays, laths; reference has no relief language |
| Typography | MATCHES | one display/serif voice now held across boards; mono confined to stamps |
| Feedback juice | BEATS | deny shudder + teaching flash + near-lines + horns + staged ceremonies |
| Composition | MATCHES | entry framing + one-leader lid restore focal chains; reference still the master of single-focus calm |
| Motion | MATCHES | dare rise, yield lower, strike spall, cue bob; reduced-motion full |
| Audio layering | not re-judged | src/audio frozen this loop (landed last wave); no defect heard in play |
| Puzzle presentation | BEATS | showings, ghost hands, evidence flashes teach by doing |
| Performance | MATCHES | chestScene 0.267 ms avg / 0.5 max (≤8) |
| A11y floors | MATCHES | 12/12 incl. floors at both viewports |

Zero BELOW; four BEATS. Gates after the pass: `npm test` 294/294 · build
1,617,275 B (1.54 MB ≤ 2.0) · `npx playwright test tests/e2e/` 12/12 ·
ink-targets GREEN · chestScene 0.267 ms avg.

## Named for Loop 5 (not done here)

- Deny moment double-print: lock-local status line and shell near-line both
  announce the same near-text (also duplicate aria-live) — needs a contract
  ruling before touching.
- L12 Feast Benches is now the plainest board (bench slabs very dark, oath
  plaques a text wall) — next-weakest after this loop's two lifts.
- Finale reveal composition is quiet for the narrative weight (small arch on
  a wide field) and the tableau mixes a square frame with an arch — taste
  call, one-line fixes if wanted.
- favicon.ico 404 in console (index.src.html is build surface, out of lane).
- Bundle at 1.54 MB triggers the build's own >1.5 MB trim WARNING (gate is
  ≤2.0; pre-existing).
