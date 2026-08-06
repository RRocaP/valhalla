# OW-B09 — 09-sunstone, the navigator's station (VIEW half + es/ca)

## State
Complete. View rebuilt: scored whalebone rose (two-tone spindles, scribed minors,
cardinal runes ᚾᛅᛋᚢ, bone grain/cracks/pores/rime), horizon band with painted-sky
day-mark + riding sun + gates + starred night, three calcite crystals on hemp cords;
focus → two light blades w/ point chips (±16 taught by seeing), wet blades flicker/smear
(static under calm), drag needle w/ 45ms bone-tick detent + seat knock, cord-glint
progress cue + narrated agree line, plate/demo(3s, skip, static)/law set, two-column
≥980px. Logic half byte-identical; i18n added (incl. full 32-wind es/ca roses). 4 LOOK cycles.

## Rubric numbers (artifacts/wip-b09/floors.mjs, dSF2)
- occupancy: desktop 0.734, phone 0.912 (floor .55); no blank canvas; 12/12 targets ≥44px
- contrast: 7.69–13.15 across plate/bearing/watch/name/law/cand/wet (floors 4.5/3)
- texture: bone = base grad + 74 grain strands + 260 pores + cracks + rime (≥3 layers @200%)
- dead zones: rope coil, tally, divider arcs, rime crusts, chip-carved beam (≤2.5:1)

## Captures (artifacts/wip-b09/shots/)
v4-{board,bearing,armed}-{desktop,phone}.png · v4r-* (reduced-motion static demo)
v4-es-phone / v4-es-rows-phone / v4-ca-* (real lang path, no #autotest) · v0-* baseline

## es/ca
Plate/law/rows/aria/notes/near-lines localized; "Rumbo 35 — sur cuarta al sudoeste y
media" / "Rumb 35 — sud quarta a sud-oest i mitja"; day-mark watch names; nearMap keys
match verify() byte-for-byte (incl. Only 0/1/2 variants). #autotest keeps en driver labels.

## Commands + exit codes
node scripts/verify.mjs --partial --seeds 60 --only 09   0  (solver 60/60, mutants 180/180)
npm test                                                 0  (289 pass / 0 fail)
node build.mjs                                           0  (1.52 MB; fleet WARN >1.5 MB)
npx playwright test tests/e2e/journey.spec.mjs --project=desktop  0  (1 passed)
node artifacts/wip-b09/floors.mjs                        0  (B09 FLOORS: GREEN, 0 errors)

Limitations: wip-qplay harness predates the wager card (my cap/floors cross it locally);
detent audio verified by code path, not ear; tray hairline at say line is shell furniture.
