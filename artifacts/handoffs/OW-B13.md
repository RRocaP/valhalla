# OW-B13 — 13-althing, the law-rock at assembly (VIEW half)

Owned: `src/locks/13-althing.js` view half + `i18n` block, `artifacts/wip-b13/**`. Pure half untouched. 468 → 1814 lines.
Driver contracts held: `.ow13-brand` nth(i) 1×=true 2×=lies, `.ow13-culprit` nth(i), button "Give the verdict"; unit aria `^<name> is `, `^Name <name> the peace-breaker`.

**What it is.** Nine standing stones in a shallow arc on the thing-field; law-rock center-stage carrying ᛘ in a sunk chip-carved panel plus a notch struck per consistent stone. Stone material = gradient + bedding planes + mineral speckle + weather runoff + lichen + struck chips + prism form; planted in turf mounds, name-plinths in two rows. Brands are fire-marks burned on: gold sear with ᛏ, tar sear with ᚦ. Culprit ring is a forged iron collar in a foot strip reserved on every card (no layout shift on accuse). Dead zones: booth camps with pennants, trampled grass, worn path, ground swells, `art.wear`.
**Reach (BotW).** Branding greys every statement its value now settles (`isSettled` per grammar kind), marks contradictions in blood, and draws gold reach-arcs from the branded stone to the stones it just settled. Derived only from the player's marks — the view never reads `solve`.
**Comprehension trio.** Stone plate ("Brand every speaker true or false…"), 3s skippable ghost-hand brand-iron demo (static under reduced motion), tally "N of 9 stones stand consistent" + carved notches.

## Rubric (dSF2, `shots/c6b-metrics.json`; floors bracketed)
| vp | occupancy [≥.55] | largest void [≤.18] | board→action gap [≤48px] | canvases/blank | <44px | console |
|---|---|---|---|---|---|---|
| 1280×800 | **0.902** | **0.027** | **12** | 13 / 0 | 0 | 0 |
| 390×844 | **0.892** | **0.022** | **12** | 13 / 0 | 0 | 0 |

Contrast over the real painted canvas [≥4.5], desk/phone: plate 12.91/12.60 · name 8.93/9.60 · statement live 10.54/10.49 · **settled-grey 5.99/6.15** · broken 10.66/10.63. Reach check, 5 brands + collar: 6 held, 1 broken, 7 live.

## Captures (`artifacts/wip-b13/shots/`)
`c6b-{desk,phone}{,-fold}.png` branded+collared · `c5-{desk,phone}.png` cold · `c6-ca-desk.png` + `c6-es-phone.png` locale · `c6-reduced-desk.png` reduced-motion · `c6-demo-phone.png` ghost-hand mid-demo. Rigs: `capture.mjs`, `ink-targets.mjs`, `i18n-check.mjs`.

## es/ca
44 board keys × es/ca, title/epigraph/3 hints each, all 3 `verify()` near-lines mapped. Statement text is recomposed in the view from the instance's structured fields, so all six grammar kinds localize without touching the pure half. Verified live in Catalan: "El Veredicte de l'Althing"; tally "0 de 9 pedres s'aguanten sense contradir-se"; "O menteix Gunnstein o menteix Nokkvi — no tots dos."

## Commands + exit codes
- `node scripts/verify.mjs --partial --seeds 60 --only 13` → **0** (solver 60/60, wrongs 660, mutants 174/174)
- `npm test` → **0** (290 pass, 0 fail) · `npm run build` → **0** · `npx playwright test tests/e2e/journey.spec.mjs --project=desktop` → **0**
- `node artifacts/wip-b13/ink-targets.mjs` → **0** (INK+TARGET FLOOR: GREEN, locks 6–15 × 2 vp)
- `node artifacts/wip-b13/i18n-check.mjs` → **0**

## Flags for other lanes (not mine, not touched)
1. `artifacts/wip-qplay/harness.mjs` `crossThreshold()` predates the threshold's wager step and now times out — it takes `artifacts/wip-qplay/ink-targets.mjs` down with it. Both my rigs cross locally.
2. That shared rig's 450ms settle measured locks 7, 10 and 13 as `0 canvases / 0 controls` — a floor passing by measuring nothing. Mine waits on `.lock-root button` first; all ten then measure real.
3. `npm run build` warns "bundle over 1.5 MB". This file grew ~17 KB → 76.5 KB; trimming is a release call.
