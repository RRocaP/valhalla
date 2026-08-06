# OW-B10 — Lock 10, The Dróttkvætt Lines: the skald's lectern

View half of `src/locks/10-drottkvaett.js` rewritten; pure half (lines 1–295) byte-untouched.
Was: 8 flat DOM pills + 4 dashed boxes, metre invisible. Now: a lectern rack of four rests,
eight carved laths (bark edges, inked channel cut to the text's run, six chisel pips, iron
end-band), and the three laws made visible instead of explained.

**The laws as light.** Every stave carries its marks before it is seated — a pip over each
stress that must name a stave, and under its hending pair either a HOLLOW ring (skothending,
coda alone) or a FILLED bar (aðalhending, vowel+coda), so the eight sort by eye. Seat one on
the side whose law it answers and the marks light: stresses gold, hending blood-red, with a
riser from each lit stress into the rest's ledge groove. Both halves naming the stamped stave
→ groove runs gold, the hasp boss lights, a gold spine joins the pair. No scansion needed.
Verse text stays as authored in every language (0 verse lines in the i18n block, asserted).

Comprehension: carved plate (en/es/ca) · ghost-hand showing, 3 s, skippable, static variant
under reduced motion, `pointer-events:none` so it never blocks input, canvas removed after
· carved tally "N of 4 lines bind true" + four notch sockets cut in the desk edge.
Dead zones: horn inkwell, cut quill, scribe's knife, interlace rail, tool-history wear;
empty berths carry a ghost lath — outline, setting-out line, six pip sockets, end-band recess.
Phone: the two half-lines stack under one stamp (a long line IS two half-lines); ≥560 px wide
they stand side by side and the trough goes two-column.

**Density rubric** (`artifacts/wip-b10/shots/v7-metrics.json`, dSF2, both viewports)
| view | occupancy (≥.55) | largest void (≤.18) | board→action gap (≤48) | canvases blank | <44 px |
|---|---|---|---|---|---|
| 1280×800 fresh / seated | .952 / .932 | .019 / .027 | 7 / 7 | 0 of 17 | 0 |
| 390×844 fresh / seated | .945 / .939 | .022 / .022 | 7 / 7 | 0 of 17 | 0 |

**Captures** `artifacts/wip-b10/shots/` — `v7-{desk,phone}` fresh · `v7seat-*` all four bound ·
`v7part-*` the teaching frame (2 rests lit, 2 dead, side by side) · `v6show-*-{motion,calm}`
the showing. Console errors 0 everywhere. Kept: the drawRune `weight` fix from QUALITY_PLAY_01.

**es/ca** additive `i18n` block: title, epigraph, 3 hints, 4 nearMap lines, 22 board strings each.
Resolves through `lockText`/`localizeNear`; view reads `ctx.lang || 'en'` (lockroom does not
forward `lang` into the lock ctx yet — lock 01 has the same pending wiring).

**Gates** (all after the final edit)
`node scripts/verify.mjs --partial --seeds 60 --only 10` → 0 · `npm test` → 0 (289 pass, 0 fail)
`npm run build` → 0 · `npx playwright test tests/e2e/journey.spec.mjs --project=desktop` → 0 (1 passed)
`node artifacts/wip-b10/ink-targets-b10.mjs` → 0, INK+TARGET FLOOR: GREEN (locks 6–15, both viewports)

**Three findings outside my lane.** (1) `artifacts/wip-qplay/ink-targets.mjs` now times out at
the threshold for every lock — its `crossThreshold` predates the wager card; my runner is the
same measurement with the wager click. (2) That script also measured at a fixed 450 ms, which
on the duel locks (7, 10, 13) sampled an EMPTY `.lock-root` — the dare card lives inside it and
supplies a canvas and a button, so the floor passed vacuously; my runner waits for the dare to
clear. (3) `node build.mjs` warns "bundle over 1.5 MB"; lock 10 is 72 KB, mid-pack behind 11/04/12/13/08.
