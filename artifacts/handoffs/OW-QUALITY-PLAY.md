# OW-QUALITY-PLAY

## State
Complete. Locks 06–15 played cold in a real chromium at 1280×800 and 390×844,
all five duels driven to a real solve, 13.5 min of music measured, a11y floors
re-run. Two hard defects found and fixed; all gates green.

## Review
`docs/reviews/QUALITY_PLAY_01.md` — per-lock scorecard, duel verdicts, music
measurement log, a11y results, 4 open items for other lanes.

## Files changed (surface + view only; no pure half touched)
- `src/locks/06-jotunvillur.js` — **the `<style>` element was never appended**
  (62 targets under 44 px, unstyled board); `weight:'heavy'` (a string) into
  `art.drawRune` painted **0 ink** in 19 canvases; added a board-level statement
  of the cipher law; selection advances after a pick; near-line echoed in-body.
- `src/locks/07-tafl.js` — brandubh ruleset put on the board (was journal-only);
  near-line echo.
- `src/locks/08-hacksilver.js` — 44 px floor re-asserted; near-line echo.
- `src/locks/09-sunstone.js` — day-mark (the only thing that makes the bearing
  nameable) stated on the board with live arc bounds; each stone shows its raw
  reading so the ±16 law is visible; 44 px floor; near-line echo.
- `src/locks/10-drottkvaett.js` — same `weight:'heavy'` bug left **all four hasp
  staves blank**; stave now draws and carries its sound letter; near-line echo.
- `src/locks/11..15` — near-line echo scrolled into view; 44 px floor on 15
  (ring slots were **12.4 px** wide).

Systemic cause of the target failures: `#app *{min-width:0}` in
`src/shell/style.js` outranks every lock's own class rule. Re-asserted at equal
weight inside the affected lock files; the shell rule itself is filed as open
item 1.

## Commands + exit codes
```
node build.mjs                                          0   1.05 MB, 15 locks
npm test                                                0   272 pass / 0 fail
node scripts/verify.mjs --partial --seeds 60 --only NN  0   for 06,07,08,09,10,11,12,13,14,15
node scripts/verify.mjs --partial --seeds 200           0   GATES GREEN, 15 locks
node artifacts/wip-qplay/ink-targets.mjs                0   INK+TARGET FLOOR: GREEN
node artifacts/wip-qplay/duels.mjs                      0   5/5 exact, 0 console errors
node artifacts/wip-qplay/a11y2.mjs                      0   12/12 pointer-free, 0 no-ring
node artifacts/wip-qplay/a11y.mjs                       0   15/15 contrast, reduced motion PASS
node artifacts/wip-qplay/wrong-drive.mjs                0   10/10 near-line visible on submit
node artifacts/wip-qplay/music-run.mjs                  0   808 s, 3 wraps, 0 page errors
```
200-seed log: `artifacts/wip-qplay/verify-200.txt`. Pure halves unchanged —
solver 200/200 and identical wrong/mutant counts on every lock.

## Headline measurements
- seam step: **+0.27 dB** on the buffer, **+1.36 / +1.19 / +1.13 dB** live across
  three wraps, no gap, sample discontinuity 0.005 FS
- drone→music handoff: −29.5 → −24.5 dBFS, monotone, no hole
- 13.5 min level spread: **2.80 dB**; 0/7714 samples below −50 dBFS after 15 s
- ducks: −1.6 to −6.5 dB, released in 0.5–1.25 s
- wrong-answer feedback latency: **8–22 ms** (bar <100 ms)
- hints arm at exactly 3 / 6 / 10 on all ten locks
- 44 px targets: **0 under** (was 108 across locks 06/08/09/15)
- blank canvases: **0** (was 23)
- contrast: 15/15 pass, 7.04:1 – 14.07:1

## Evidence
`artifacts/wip-qplay/` — harness + 9 re-runnable measurement scripts, `shots/`
(63 PNGs: cold reads, dare cards, yield beats, wrong-answer and hint moments,
reduced motion), `near-audit.json`, `wrong-drive.json`, `fold.json`,
`containment.json`, `ink-targets.json`, `a11y.json`, `a11y2.json`,
`duels.json`, `music-long.json`, `verify-200.txt`.
`ink-targets.mjs` is the cheapest one to keep: it exits non-zero on any blank
canvas or any sub-44 px target, and it is what caught both hard defects.

## Limitations
- Locks 01–05 were played only as far as the pointer-free journey required
  (1→3); their surface text was not audited and is not my lane. Given the two
  `weight:'heavy'` blank-canvas bugs found in 06 and 10, locks 01–05 are worth
  the same 30-second ink check.
- While the shell lane's TDZ regression was live (open item 4) some
  measurements ran against an aliased copy of `screens/lockroom.js` kept inside
  this lane. Nothing under `src/` was touched by it; the upstream fix landed at
  19:53 and every headline result was re-run and confirmed on the real build
  afterwards. That scaffolding is deleted.
- Duck depths are measured on the master bus, so a motif partly fills its own
  duck. Stated in the review rather than corrected — it is the number the ear
  actually gets.
