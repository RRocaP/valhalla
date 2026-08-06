# OW-LOCKS-C — locks 11–15

**State: complete.** Five locks (pure logic + views), unit tests, gates green.

## Files
- `src/locks/11-skerry.js` — tide-parity routing, Dijkstra over (node,parity)
- `src/locks/12-veitsla.js` — 8!·9 sweep, canonical bench A, decoys
- `src/locks/13-althing.js` — 2^9·9 sweep, liar-set + culprit
- `src/locks/14-bindrune.js` — 2^16 subset sweep, union + minimality
- `src/locks/15-oathring.js` — static, exact match against frozen `RING`
- `tests/unit/locks-11-15.test.mjs` — 76 tests: every law re-derived by a second
  independent search, plus click-drives of all five views
- `artifacts/wip-locks-c/**` — probes, stub DOM, transcripts

## Commands + exit codes
```
npm test                                                exit 0  264 pass, 0 fail
node scripts/verify.mjs --partial --seeds 60 --only 11|12|13|14|15   exit 0 each
node scripts/verify.mjs --partial --seeds 200           exit 0  15 locks GREEN
```

200 seeds, my five: solver 200/200 each; wrongs rejected 1984/2393/2200/2000/2400;
mutants rejected 600/600/570/600/600.

## Evidence
`artifacts/wip-locks-c/gate-200seeds.txt`, `npm-test.txt`, `probe-playthrough.mjs`
— the last drives all five VIEWS to a solve by clicking labelled controls; lock 15
submits `ᚠ ᛏ ᚱ ᚦ ᛁ ᚾ ᛒ ᛋ ᚢ ᛅ ᚼ ᛘ ᛚ ᚴ`. Those drives also run on every `npm test`.

## Decisions worth the lead's eye
1. **§14 traps** — per the amended text: ᛁ is the only full-cover trap the kernel
   permits (just the stave is shared; every branch has one owner), plus ≥2
   one-stroke-short near-traps. A test asserts that kernel fact directly.
2. **11 pins the optimal PATH, not just the leg-count.** §11 permits the path to
   vary, but with alternates on the chart a swapped pair of skerries lands on a
   second legal optimum, which CONTRACT §7.2 reads as accepting a wrong answer —
   it fired at 200 mutations/seed. The generator now requires a unique optimal
   road (100% of seeds). Verify is unchanged and still property-based: a test
   proves it takes either road on a hand-built two-road chart.
3. **No lock stores its answer in the instance.** 12/13/14 verify by property;
   per-instance uniqueness makes that identical to exact match and keeps the
   solution out of the player's devtools.
4. **12 auto-canonicalises on submit** — the benches are one hall read from
   either side. Verify still rejects non-canonical input.
5. **Difficulty declared from measured play.** 11's optimum is 10–14 legs (mode
   12) over 400 seeds; each header states its step accounting. Floors met:
   26/16, 28/18, 30/20, 32/22, 34/25, non-decreasing.

## Limitations
- Views are gated against a **stub DOM**, not a browser: no real layout, paint,
  pointer capture or focus ring. No view animates and every canvas has a
  `ctx.note()` + `aria-label` mirror, but browser/offline gates are QA's.
- Views code to the frozen `docs/ART.md` surface against current lead stubs
  (`makeCanvas`, `paintWood`, `paintPanel`, `drawRune`, `glow`, `ornament`).
  A different landed signature breaks them there.
- Lock 11 keeps a hard-coded safety chart for the case where sampling finds no
  valid fjord; never reached (400/400 sampled), and a test asserts it is itself
  a valid, greedy-proof puzzle.
- No git, no installs, nothing touched outside my owned paths.
