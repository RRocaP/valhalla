# OW-RAMP — lock 01 rebuilt to docs/LOCKS.md §01 "The First Ætt"

**State.** Done. Sixteen staves stay carved on the rail as the target; only the first ætt (ᚠᚢᚦᚬᚱᚴ) hangs loose — six tiles, 4–5 displaced, exactly one mirrored. `{order:[6], flips:[6]}`, unique, proven per instance by a full 6!·2⁶ = 46,080 sweep through the same predicate `verify` uses. Shard unchanged (ᚠ/8). Owned paths only: `src/locks/01-runerow.js`, the lock-01 tests in `tests/unit/locks-01-05.test.mjs`, `artifacts/wip-ramp/**`, this file.

**Contract facts.** title 'The First Ætt'; difficulty **6 / 2** (floors, ≤ lock 02's 8 / 3). Near-lines are a bounded set of 7, exported as `NEAR_LINES`, all mapped in `i18n.{es,ca}.nearMap`. First lock carrying the §4.1 `i18n` block (title, epigraph, hints, nearMap, board + 6-word `places`); view resolves via `ctx.lang || 'en'`. `WENDABLE` still exported. Instance is `{tiles:[6 × {ch, wend}]}`. Driver-visible state keeps its shape: `order` = tile ids left→right, `flips[p]` = face of the tile at place p; `.ow1-tile` buttons stay in live DOM order with `aria-label` prefix `"<place> place: <name>, …"`.

**The e2e patch the lead must apply** (`tests/e2e/helpers.mjs` ~199; nothing else in `tests/e2e/**` touches lock 01):
```js
-   const order = Array.from({ length: 16 }, (_, i) => i);
+   const order = Array.from({ length: 6 }, (_, i) => i);
    await reorderByDrag(page, tiles, order, answer.order);
    ...
-   await clickButton(root, 'Set the row');
+   await clickButton(root, 'Set the ætt');
```
The one-mousedown/one-mousemove/one-mouseup idiom still works; OW-FABLE-A's grip fix is carried over and re-verified with real mouse events at both framings.

**First minute.** Six gold chevrons drop from the bracketed first stretch of the rail onto six bone tablets on a lit bench; a ~3 s skippable *showing* drags a ghost stave into its gap (held static under `prefers-reduced-motion`), then the leftmost stray yearns. Every landing knocks, grows a gold seam on the tablet's foot, and fills one of six carved pips — "N of six staves stand true". Laying all six in order reaches 5/6 with one bare tablet: the unlit pip *is* the mirror lesson, discovered not read. Wordless audit: `artifacts/wip-ramp/cold-read.md`. Phone and desk both first-class — tiles 84×114 desktop / **54×73 phone** (≥44), no horizontal scroll either way, no hover-only cue, interaction round trips 15–22 ms.

**Commands / exit codes.** All 0. `node --test tests/unit/locks-01-05.test.mjs` 51/51 · `node scripts/verify.mjs --partial --seeds 200 --only 01` solver 200/200, wrongs 1800, mutants 548/548 · full 15-lock verify 200 seeds GREEN · `npm test` 290/290 · `npm run build` 1.13 MB · `node artifacts/wip-ramp/capture.mjs` and `OW_CALM=1` likewise · `node artifacts/wip-ramp/keys-and-leak.mjs` solved in 14 key presses, 0 tiles left after unmount.

**Evidence.** `artifacts/wip-ramp/`: cold-read.md, capture.txt, capture-reduced-motion.txt, keys-and-leak.txt, unit-locks-01-05.txt, verify-01-seeds200.txt, npm-test.txt, npm-build.txt, `shots/` (26 PNGs: cold, wordless-audit, first drag, ordered-with-mirror-left, near, all-true, solved — 1280×800 and 390×844, plus reduced-motion variants).

**Limitations.** (1) `artifacts/wip-fable-a/feel-gate.mjs` references runerow, is not mine, and is not part of `npm test`; if it asserts the 16-tile board its lock-01 expectations need the same 16→6 update — not run here. (2) Shots are Chromium at dpr 2/3; Safari/iOS pixel truth stays with QA. (3) `ctx.lang` is not yet supplied by `lockroom.js`, so the es/ca copy is authored and unit-tested but unreachable in-game until the shell passes it and routes `localizeNear` through the nearMap.
