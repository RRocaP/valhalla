# OW-B08 — 08-hacksilver, The Twelve Pieces (VIEW half rebuilt)

A silver-court. Three sworn weighings hang as real balances (carved architrave, oak beam on a pinned pivot, bronze chains, layered-gold pans): the BEAM TILT is the datum, and withheld pieces rest on a carved set-aside ledge, so a level beam reads as evidence, not silence. Twelve pieces lie on dark wool on the counting table — 12 distinct silhouettes in layered silver (gradient → burnish → planishing dents → cut arris → specular). Verdict = two carved pans on ONE beam that tips to the side you call, the accused piece seated in it.
BotW law: touching/focusing a piece lights it wherever the three weighings put it (pans AND ledges) and the reading strip names it — the deduction verb taught by the board. Comprehension: carved plate (en/es/ca); 3s ghost-hand showing on the piece present in all three weighings, skippable, static under reduced motion; seated-accusation staging previewed before swearing. Dead zones carry plumb-line, notched scratch-weights, chalk five-bar gates, a tally-stick + RECKONING, and `art.wear`.
Pure half byte-identical (spliced at the view marker); one additive import (`BY_CH`, rune names for aria). Frozen contracts kept: `[role=radio]` ×12 in piece order; button names `heavy — salted` / `light — clipped` / `Swear the accusation` (no aria-label on the pans — visible text IS the name).

## Rubric (dSF2, `artifacts/wip-b08/capture.mjs`, c7 vs before)

| metric | desk 1280×800 | phone 390×844 |
|---|---|---|
| field occupancy (≥.55) | 0.619 → **0.826** | 0.700 → **0.922** |
| largest void (≤.18) | 0.070 → **0.043** | 0.036 → **0.022** |
| board→controls gap (≤48) | **39px** | **39px** |
| canvases / blank | 36/0 → **21/0** | 36/0 → **21/0** |
| controls / under-44 | **16/0** | **16/0** |
| console errors | **0** | **0** |

## Commands + exit codes

| command | exit | result |
|---|---|---|
| `node scripts/verify.mjs --partial --seeds 60 --only 08` | 0 | solver 60/60, wrongs 600, mutants 180/180 |
| `npm test` | 0 | 289 pass, 0 fail |
| `npm run build` | 0 | 1.52 MB — **WARN** over the 1.5 MB line (wave-level, all lanes growing) |
| `npx playwright test tests/e2e/journey.spec.mjs --project=desktop` | **1** | **fails in lock 01's driver (`.ow1-tile`), never reaches lock 08 — not this lane** |
| `npx playwright test --config artifacts/wip-b08/pw.config.mjs` | 0 | 6 passed (desktop+iphone): driver contract incl. wrong-answer path, glint+staging+44px, keyboard path, clean console |
| `node artifacts/wip-qplay/ink-targets.mjs` | 0 | FLOOR GREEN; lock 8 = 21 canvases 0 blank, 16 controls 0 under-44, both viewports |

**es / ca** — additive `i18n` block: title, epigraph, 3 hints, nearMap for all three disagreement counts, full board table incl. the 12 cut names. Verified *rendered*, not declared: `node artifacts/wip-b08/i18n-check.mjs` → `shots/i18n.json`. Gender agreement corrected after read-back (masculine cut + feminine adjective); the direction now attaches to *la pieza / la peça*.

**Captures** — `artifacts/wip-b08/shots/`: `before-{desk,phone}.png` (old form) · `c7-{desk,phone}[-showing|-picked].png` (idle, the showing with the glint lit across all three weighings, the staged accusation seated in the heavy pan) · `<tag>-metrics.json`.

**For the lead, both outside this lane** — `artifacts/wip-qplay/harness.mjs` `crossThreshold()` doesn't click through the new wager card (my rig carries a local step); the shared journey spec is blocked at lock 01. The desktop lock-room also renders a cold blue/glass wash over every board (shell lane) — this board's own colour was judged on phone.
