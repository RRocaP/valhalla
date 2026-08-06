# OW-B14 — 14-bindrune, VIEW half

The hasp's carving is now the board. The bind-rune is cut huge into an
iron-strapped oak hasp (V-groove: black up-left wall, warm bounce on the
down-right wall, lit arris where the chisel broke the surface, soot in the
groove, gold leaf worn off the proud edges and surviving only as scattered
flecks in the cut). Laying a candidate overlays its canonical kernel strokes in
molten gold on a separate breathing layer, so exact cover is watched: claimed
burns, unclaimed stays tar, and a rune that cuts where the hasp carries nothing
scores the wood red. The sixteen are bone slips in a carved tray with cut
sockets; the carver's bench (chisel, shavings, chips, candle) fills the dead
zone under it. Minimality is felt on the tile — a rune whose strokes are all
already claimed goes grey behind a dashed dead rim with one EMPTY socket pip
where its tally should be. Pure half untouched.

Comprehension: (1) plate — "Name exactly the runes bound in the carving — every
stroke claimed, no rune idle." + es/ca; (2) ghost hand, 3s, skippable, lays ᛁ
(íss) and lifts it off again — íss is the one always-covered rune, so the
demonstration ignites the shared stave and leaks nothing of the answer while
planting the trap; (3) tally "N strokes of M claimed" + a carved pip gauge.

## Rubric (dSF2, `artifacts/wip-b14/shots/v6-metrics.json`)

| | occupancy (≥.55) | largest void (≤.18) | board→controls (≤48px) | canvases blank | <44px targets | console |
|---|---|---|---|---|---|---|
| 1280×800 | **0.815** | **0.051** | 0 | 0/21 | 0/19 | 0 |
| 390×844 | **0.908** | **0.043** | 1px | 0/21 | 0/19 | 0 |

Text contrast measured over the real painted wood: 6.85–13.45:1 (floor 4.5).
Reduced motion verified: fire animation `none`, ghost held still, demo lays
then lifts íss (tally 1 → 0). Desktop root 820×790, no scroll.

Captures: `artifacts/wip-b14/shots/v6-{desk,phone}{,-demo,-mid,-full}.png`,
`v6-calm-demo.png`. `-mid` is the money shot: gold converging, 2 red astray
cuts, fé/þurs gilded, óss blood-rimmed with struck pips, íss dead with an
empty socket. v0 = before.

## es/ca

Full block on the lock: title, epigraph, hints×3, nearMap×4, and a ~32-key
board table (plate, legend, tally/tallyOne, tray label, buttons, demo line,
claims/idle/waste lines, aria clauses) in both. Title/epigraph/hints/nearMap
resolve today via `lockText`/`localizeNear`. **The board table stays dormant
until the shell passes `lang` into the lock ctx** — `lockroom.js:403` still
builds `{ root, instance, art, audio, submit, note, solved }`.

## Commands + exit codes

| command | exit | |
|---|---|---|
| `node scripts/verify.mjs --partial --seeds 60 --only 14` | 0 | solver 60/60, wrongs 600, mutants 180/180 |
| `npm test` | 0 | 290/290 |
| `npm run build` | 0 | index.html 1.51 MB (shared WARN: over the 1.5 MB line) |
| `npx playwright test tests/e2e/journey.spec.mjs --project=desktop` | **1** | fails at **lock 1** on an unexpected `.dare-card` — another lane's duel change. Passed exit 0 earlier this session with this board in place. |
| `node artifacts/wip-b14/drive-14.mjs` | 0 | board 14's half of that gate: frozen `.ow14-cand` index + "Name the bound runes" opens the lock at both viewports, ceremony + save, 0 console errors |
| `node artifacts/wip-b14/ink-targets-14.mjs` | 0 | see below |
| `node artifacts/wip-b14/contrast-14.mjs` | 0 | |

## Two blocks for the lead (neither in this lane)

1. `artifacts/wip-qplay/ink-targets.mjs` is broken for **every** board 6–15:
   `harness.mjs crossThreshold` predates the threshold wager card
   (`threshold.js showWager`) and times out. `ink-targets-14.mjs` is the same
   two floors, wager-aware, scoped to 14 — one line in the shared harness fixes
   it for everyone.
2. `journey.spec.mjs` is red at lock 1 (dare card on a non-duel ordinal).
