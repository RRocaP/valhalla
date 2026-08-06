# OW-LOCKS-A — locks 01–05

## State

Done. Five locks implemented against the frozen interface (CONTRACT §4), pure halves
uniqueness-swept in `makePuzzle`, interactive views mounted and played. All gates green.
No git run, no installs, no files touched outside my ownership.

## Files

- `src/locks/01-runerow.js` — The Rune Row · tier 1 · `{order,flips}` · 8/2
- `src/locks/02-bismer.js` — The Bismer Scales · tier 1 · `{pouch}` · 8/3
- `src/locks/03-beacons.js` — The Beacon Nights · tier 1 · `{night}` · 10/4
- `src/locks/04-strakes.js` — The Clinker Strakes · tier 2 · `{order,liar}` · 12/5
- `src/locks/05-knotwork.js` — The Oseberg Knot · tier 2 · `{states}` · 14/6
- `tests/unit/locks-01-05.test.mjs` — 47 tests
- `artifacts/wip-locks-a/view-harness.mjs` + evidence txt

## Uniqueness (all verifies are property-based; the generator proves the sweep)

- 01 — sixteen distinct staves ⇒ one filling; only staves whose mirror differs from
  themselves *and* from every other stave may be cut backwards (derived from kernel segments).
- 02 — each pouch gets a distinct role pair from {left,aside,right}²; sweep of 9.
- 03 — pairwise-coprime cycles, dial capped at their product; sweep of 1..dialMax.
- 04 — the nine testimonies close a ring, so any one may be struck for the lap law alone;
  only the rivet law separates them. Sweep over all 9 drops; test confirms over all 9! stacks.
- 05 — generator re-rolls to one closed band over 64 ports; the two alternating layings are
  pinned to one by the carved crossings. Literal 2^12 sweep.

## Commands and exit codes

```
node --test tests/unit/locks-01-05.test.mjs                        exit 0   47/47
node --test "tests/unit/*.test.mjs"                                exit 0   94/94 repo-wide
node scripts/verify.mjs --partial --seeds 60 --only 01|02|03|04|05  exit 0   each
node scripts/verify.mjs --partial --seeds 200                       exit 0   12 locks
node artifacts/wip-locks-a/view-harness.mjs                         exit 0
```

200 seeds: solver 200/200 each; wrongs 1600/1600/2345/2200/1600; mutants 586/600/600/600/574 rejected.

## Evidence

`artifacts/wip-locks-a/verify-0{1..5}-seeds60.txt`, `verify-all-seeds200.txt`,
`view-gate.txt`, `artifacts/gates.json`.

## Limitations / for the lead

1. **`npm test` is broken on this Node** (v26.4.0): `node --test tests/unit/` resolves the
   directory as a module and exits 1. Pre-existing and repo-wide (not caused by my file);
   `package.json` is LEAD-owned so I did not touch it. The glob form
   `node --test "tests/unit/*.test.mjs"` passes 94/94. Suggest that one-word script change.
2. **Lock 05 minSteps, per the ruling — recorded, not inflated.** The generator always yields
   12 free tiles (the design maximum) with exactly 11 laid wrong at the start. The strictly
   minimal line is 11 toggles + 1 submit = 12 acts, or 13 counting the one band-trace needed
   to know which way to lay them. Declared `minSteps: 14` is the floor, so the declaration
   sits 1–2 acts above the strictly minimal line. Floors 01–04 are met with honest counts.
3. **Views verified headlessly, not in a browser.** The harness stubs DOM + canvas 2D, drives
   real pointer and key events, plays each lock to its solution, submits, and audits listener
   balance and timers on unmount (all zero). Pixel fidelity, contrast, and 44px targets at
   390px are unverified — QA/ART own that gate.
4. **Two art integration bugs found and fixed** after `src/art` landed: `drawRune` `weight` is
   an absolute ribbon width, not a multiplier (my `weight: 1` would have rendered hairlines),
   and `drawKnot` already lays its own dark under-stroke. Lock 05 draws over/under by
   pre-splitting the under-band polyline, so it does not depend on `gapAtCrossings`.
5. I did not run `npm run build` — it writes LEAD-owned `index.html` and `registry.gen.js`.
