# OW-B15 — The Oath-Ring (lock 15), VIEW half rebuilt

Owned: `src/locks/15-oathring.js` view + its i18n, `artifacts/wip-b15/**`. Ring law, `RING`,
`solve`, `verify`, `wrongAnswers`, `hints` untouched — every frozen line still verbatim (checked).
Driver contract exact: `.ow15-chip` label `Shard <name>, number <v>`, `.ow15-slot` in slot order,
button texts unchanged.

**The prop.** A round oak plinth carrying a real twisted arm-ring: two gold rods, cross-section ramp
for roundness, ~90 lay cuts (deep seam / shallow hammer line alternating), and a crown highlight that
TRAVELS with the twist — that is what makes it read as cable, not a band with lines on it. Fourteen
sockets upset into the rod and drilled; slot 0 is an iron rivet, struck flats + peening + rust, not
gold. Shards are bone chips, broken outlines, painted runes, numbers in blood, threaded on gold wires
inside the hoop. The hasp rail keeps all 14 notches all game, so nothing under the thumb reflows.
Cold fjord fill answers the hearth key — Ärya's throne-light.

**Comprehension.** (1) Plate stays spare: "Hang all fourteen shards. The ring knows its own law."
(2) Showing: ghost lifts a shard, hangs it, takes it off; 3s, skippable, static under reduced motion;
a deliberately WRONG pair (ᛚ→slot 6), so the verb is taught and the law untouched. (3) Progress:
`n/14` carved in a gold-inlaid channel at the heart + 14 pips + a DOM line for the reader.

**Feel.** Hanging turns the ring ±1.7° and sounds a per-rune note (slide/knock, then a strike delayed
by the rune's place in the row; extra strike at 12–13, `confirm` at 14). Near-complete warms the rod
without drowning the twist. The near-line reads on the metal, naming nothing: two-swap runs a light
sunwise that STALLS a hair short of closing + a torsion shudder; nail-wrong flashes the rivet cold.

**Rubric** (dSF2, both viewports, final build; floors 55 / 18 / 3):

| state | vp | occupancy | maxVoid | layers (worst of 4 probes) | under44 | errs |
|---|---|---|---|---|---|---|
| empty | desk 427² | 70.5% | 5.6% | 3 [4,4,3,8] | 0 | 0 |
| empty | phone 301² | 76.0% | 5.8% | 3 [6,4,3,10] | 0 | 0 |
| full | desk / phone | 76.2% / 78.6% | 5.6% / 5.8% | 4 / 8 | 0 | 0 |

Baseline was 66.1% at layers 2 with a flat hoop. `gapPx` prints negative and is meaningless here (the
canvas is centred in its host, so the sibling formula measures host edge); the real check is the fold,
and `Close the ring` sits above it at both viewports via the fold-fit loop in `relayout`. Dead-zone
median 1.37–1.44 vs the 1.5 "visible" floor — quietest carving is a touch under.

**Gates.** `verify --partial --seeds 60 --only 15` → 0 (60/60, wrongs 720, mutants 180/180) ·
`npm test` → 0 (289 pass / 0 fail, incl. leak-free unmount + full click-through solve) ·
`npm run build` → 0 (1.52 MB; pre-existing warn) · `playwright journey --project=desktop` → 0 ·
`ink-targets` → 0 (lock 15: 16 canvases, 0 blank, 31 controls, 0 under 44px, both vp) ·
i18n check (es/ca keys, 3 hints, 4 near-lines mapped, placeholders intact) → 0.

**Notes.** es/ca resolve via `ctx.lang` + `localizeNear` (07-tafl pattern), but the shell still omits
`lang` from the lock ctx (`lockroom.js` ~348) — dormant for 01/06/07/15 alike, shell-side, not touched.
Fixed a real bug inherited by the density probe: `layersAt` read the whole-canvas buffer instead of the
crop and reported 1 layer for any surface (same defect in `artifacts/wip-b05/capture.mjs` + copies).
Shared `crossThreshold` predates the threshold wager step; worked around locally.

Evidence `artifacts/wip-b15/shots/`: `final-empty-*`, `final-full-*`, `v12-near-*`, `refuse-swap-*`,
`refuse-nail-*`, `showing-{desk,phone,calm}`, `v0-empty-*` (baseline), `*-metrics.json`.
Scripts: `capture.mjs`, `refusal.mjs`, `showing.mjs`.
