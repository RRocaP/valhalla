# QUALITY_GAP_01 — visual axis review (OW-QUALITY-VIS)

Method per docs/QUALITY.md: the real single-file build driven through every judged
moment by Playwright at `deviceScaleFactor: 2`, viewports 1280×800 and 390×844,
puzzles solved through their own mounted UI (QA's `tests/e2e/helpers.mjs` drivers).
8 capture cycles; every crop cited below was opened and looked at, not inferred.

- Harness: `artifacts/wip-qvis/capture.spec.mjs` + `capture.config.mjs`
- Before: `artifacts/wip-qvis/c1/**` · After: `artifacts/wip-qvis/c7/**`, `c8/**`
- Reference (captured, only permitted network use): `artifacts/reference/ref-01-boot-{d,m}.png`

**Reference character.** ROCA AIRWAYS is dark-minimal: a near-black indigo field, one
centred hairline instrument, sparse star dust, elegant italic serif. Its strengths are
focal hierarchy, line discipline and restraint. It carries **no surface texture and no
relief at all** — which is precisely where VALHALLA can win, and where it was losing
anyway at the start of this pass.

## Verdict table

| Axis | Before | After | Evidence |
|---|---|---|---|
| Surface believability | **BELOW** — flat brown field; 200% crop showed a smooth gradient with faint speckle, no grain flow, no ring ripple, no pore, seams were single hairlines | **BEATS** — 11 layered passes: per-plank tone billets, cathedral figure, part-width flow strands, knots w/ alternating ring ripple + halo + catch light, fine fibre, directional pore ticks, seam trenches w/ lit lips, chatoyance sheen | `c1/02b-lid-wood-crop-d.png` → `c7/02b-lid-wood-crop-d.png` |
| Carve/relief | **BELOW** — paintPanel interior near-black flat, carved lip invisible; medallions flat dark circles; dragonhead invisible; wavebord flat | **BEATS** — panel field is wood under a graded tar wash inside a bevelled lip w/ corner nailheads; medallions are struck discs w/ raised bezels seated in carved sockets; rivets domed w/ speculars; reference has no relief to compare | `c1/03-lockroom-01-d.png` → `c7/08-dare-card-d.png`, `c7/02-lid-fresh-d.png` |
| Typography | **BELOW** — all three mandated "full depth" call-outs were CSS `text-shadow` only; primary button was a flat gold rounded rect reading as a web CTA | **MATCHES** — title card, lock headers and shard numerals now go through canvas `art.carveText` with tracking; button is a gilded riveted plate; measured contrast 6.84–12.55 (floor 4.5) | `c7/01-threshold-d.png`, `c7/06-shard-ceremony-d.png`, `c7/03b-lockroom-header-crop-d.png` |
| Feedback juice | **BELOW** — ceremony/dare beats sat on a black void; **tap-to-skip was entirely dead** (`.ceremony-overlay{pointer-events:none}`) | **BEATS** — dare card, bow tween, carved shard numeral, medallion state change and hasp inscription all land on textured, lit surfaces; skip verified with real input at 19 ms vs 850 ms auto-advance | `c7/08-dare-card-d.png`, `c7/10-yield-beat-d.png`, `c7/06-shard-ceremony-d.png` |
| Composition | **BELOW** — lid painted **two** overlapping medallion sets; threshold content pinned to the top with ~70% empty board; mobile chest a postage stamp; duel banner ran off-screen at 390px | **MATCHES** — one carved socket grid; chest reads as a lit object on a shaded board; portrait framing turns the grid 3×5 on tall viewports; banner clamped in-viewport | `c1/02-lid-fresh-{d,m}.png` → `c7/02-lid-fresh-d.png`, `c8/12-lid-near-full-m.png` |
| Motion | MATCHES | **MATCHES** — finale's 2.6 s lid-opening intro is now a textured oak panel (carved rim, gilded trim, wavebord) instead of a flat rotating fill | `c7/15-finale-intro-mid-d.png` |
| Credits / die-cut | **BELOW** — never seen with real photos; sprites were clipped (portrait art drawn into square 64px canvases) and the die-cut border was a ~3px hairline | **MATCHES** — aspect-correct sprites, visible bone die-cut margin, inner seat line, tumble + sway reading correctly behind the text | `c7/19b-credits-stickers-crop-d.png`, `c7/19-credits-top-d.png` |
| Performance | PASS | **PASS** — `chestScene(1280×800)` avg **0.242 ms**, max 0.4 ms against the ≤8 ms budget, despite far more detail (static furniture baked once per size, blitted per frame) | `node artifacts/wip-art/measure.mjs` |
| A11y floors | PASS | **PASS** — 0 px horizontal overflow at 390 and 1280 on lid and lock room; no undersized touch target; sampled text contrast 6.84–12.55; 0 page errors | `artifacts/wip-qvis/a11ycheck.mjs` |

**Exit condition met: zero axis BELOW, three axes BEAT** (surface believability,
carve/relief, feedback juice).

## Pre-seeded gaps — disposition

1. Wood flat-brown — **fixed** (`src/art/wood.js` rewritten).
2. paintPanel interior near-black, lip invisible — **fixed** (`src/art/panel.js`).
3. dragonhead invisible, knot gold flat — **fixed** (closed gilded silhouette w/ mane, socketed eye, scale ticks; wavebord retoned to worn gilding in a channel).
4. Lid monotone, medallions flat, hasp underpowered, no wordmark — **fixed** (carved sockets + struck discs + 15 tally notches + carved `VALHALLA` on the lid band; the DOM shard strip now sits *on* the painted hasp rail instead of floating below the chest).
5. Dare-card portrait — **verified already correct in the real build**: all five challengers render through `art.portrait`'s graded carved arch with the bow tween on yield. Only the FIXTURE flow showed the gold-circle placeholder.
6. Finale lid-opening intro untextured — **fixed**.
7. Three full-depth `carveText` call-outs done as CSS only — **fixed** (new `carvedHeading()` in `src/shell/dom.js`: canvas relief for the visual, real text visually-hidden for a11y and selectors).
8. Credits sticker fall never seen with real photos — **captured, judged, and two defects fixed** (clipping, hairline border).

## Defects found and fixed beyond the brief

- `.ceremony-overlay{pointer-events:none}` silently killed the documented tap-to-skip on both the shard ceremony and the duel yield beat (`src/shell/style.js`).
- Temporal-dead-zone crash in `src/shell/screens/lockroom.js` introduced by my own carveText edit — every lock open threw `ReferenceError` until the header declarations were hoisted above the first `resizeBg()` call. Both were reported by the coordinator/QA mid-pass and are green now.
- Credits sticker sprites clipped by square canvases; `.sticker-static` forced a square aspect.
- Duel banner overflowed the right viewport edge at 390px (Ärya's is the longest name).

## Recommendation on a frozen contract

`createArt()` now also returns **`chestLayout(w, h, n)`** — a pure geometry helper
returning the exact socket positions `chestScene` carves. This is *additive*; no frozen
signature changed. It exists because the shell previously ran an independent medallion
layout and painted a second set of medallions over the ones `chestScene` had already
drawn. Recommend ratifying it in docs/ART.md's API block alongside the existing
`reliefShadowCss` addendum. `paintWood`'s documented `opts` now honours
`{ vignette, grainAlpha, planks, knots, shade }`, and `paintPanel`'s `{ seed, wash, nails }`
— both were previously accepted and ignored.

## Not covered by this pass

Audio layering (live lane), puzzle presentation for locks 06–15 (play-quality agent's
lane — only 09 and 13 were opened here, and only their shell chrome was judged), and
`src/locks/**` internals, which I did not touch. The reference capture reached its boot
screen and one interaction; its later screens were not reachable by a generic
first-button click, so the comparison rests on its boot composition.
