# OW-LOOP2 — carved-prop baseline landed (partial by design; fleet takes the rest)

## State
Green and landed. Coordinator flipped the brief mid-loop to "land now"; this is the
precise split of what ships at the escalated standard vs what remains pre-loop.

## Escalated standard (all five criteria + carved-prop density)
- **Every lock room** (`src/shell/screens/lockroom.js`, presentation only): carved
  architrave TRAY around the measured board (stepped profile, chip-carve run,
  interlace rails, corner rosettes, ring contact shadow — interior not flooded),
  quiet tool-history WEAR in dead zones (avoid-rect keeps the puzzle clean),
  chip-carved run inside the room trim, HORN hint slots (locked/armed/taken
  materials; class/data-state/aria/44px unchanged), 1.5s shard ceremony (rune
  strikes in, deterministic ember spall, `knock` cue at t≈0.58, line inscribes via
  `.struck`; reduced-motion renders finished state once; `Shard sealed: N` + Enter
  path untouched), yield beat banner lowering behind the bow, `#app
  .btn-carved[disabled]` seated state. State-keyed repaints (RO + rAF debounce).
- **Art (additive only)**: `src/art/carpentry.js` — `tray, chipBorder, ribbonRail
  (true interlace via drawKnot), rosette, wear, insetFace`, wired into `createArt()`;
  medallion rune chisel-weight fix in `src/art/ornaments.js` (open .15/.19, next .15,
  sealed .13 — criterion 5).
- **Lock 06**: rune-stick strips (pale lath, grain, blood-in-groove + tar core,
  weight ≥ size/5.5), slate lexicon, key inset depth, carved primary.
- **Lock 07**: carved gaming table (cached slab: two-tone inlay, tar grooves, polish
  pool, deep rosette marks on throne/corners), turned tar/bone/gold men with cast
  shadows, king rune at chisel weight; PAD=8/SQ=40 e2e geometry + `.say` untouched.

## Buttons only (carved primary + quieted secondaries; identity = FABLE-A state)
Locks 02, 03, 04, 05.

## Pre-loop state — for the per-board fleet
Locks 08, 09, 10, 11, 12, 13, 14, 15: no edits this loop (no carved primary yet, no
rune-weight bump on 08/14/15 chips, identities unraised). Recipe that worked: submit
→ `class="btn-carved"` (guard bare `button` rules with `:not(.btn-carved)` — see 06/07),
quiet the local `.owN-act`, use `art.tray/wear/insetFace/rosette` for furniture.

## Carve-outs honored
`src/locks/01-runerow.js` untouched (redesign agent); `dragonhead` untouched;
no pure-half/seed/save/label change anywhere; lockroom edits presentation-only
(dare/yield rewire can land on top).

## Commands and exit codes (final battery, post-last-edit)
```
node build.mjs                                    exit 0  1138202 bytes (1.09 MB)
npm test                                          exit 0  272/272
node scripts/verify.mjs --partial --seeds 60 --only 02|03|04|05|06|07   exit 0 each
node scripts/verify.mjs --partial --seeds 200     exit 0  GATES GREEN, 15 locks
npx playwright test                               exit 0  6/6 (desktop + iphone)
node artifacts/wip-qplay/ink-targets.mjs          exit 0  INK+TARGET FLOOR: GREEN
```

## Evidence (`artifacts/wip-loop2/shots/`, dSF2; rig: `artifacts/wip-loop2/cap.mjs`)
Before/after pairs on the lead angle: `base-lock07-desktop.png` → `fix-lock07-desktop.png`
(also `after-lock06`, `fix-lock02`, phone: `final-lock0{2,6,7}-phone.png`); ceremony
mid-strike `final-ceremony-desktop.png`; full pre-loop baseline `base-lock01..15 + all`.

## Limitations
1. Headless + screenshot truth only; retina in-situ judgment stays with QUALITY.
2. Ceremony hasp-strip flash on the LID after solve: out of lane (lid.js), not done.
3. Tray hugs the board's mount-time box via ResizeObserver; extreme mid-play height
   changes repaint on the next frame (state-keyed, no per-frame cost).
