# OW-L67 — trilingual blocks for locks 06 and 07

Scope: `src/locks/06-jotunvillur.js`, `src/locks/07-tafl.js` (additive `i18n` block +
board strings routed through a local `T()` keyed on `ctx.lang`, en default). Pure halves
(`makePuzzle`/`solve`/`verify`/`wrongAnswers`/`shard`) untouched. No logic or visual change
beyond the two plates below.

## Strings per language (es and ca each)

| lock | title | epigraph | hints | nearMap | board | total |
| --- | --- | --- | --- | --- | --- | --- |
| 06 | 1 | 1 | 3 | 8 | 64 (19 copy + 4 places + 41 glosses) | 77 |
| 07 | 1 | 1 | 3 | 10 | 37 | 52 |

`nearMap` keys are built from `NEAR_*` builders that restate `verify`'s templates verbatim
(new `NEAR_LINES` export on each lock, for the LOCKS-B test worker). Artifact-tongue law held:
06's Old-Norse lexicon words and rune-names stay, only glosses localize; 07's cell names a1–g7
stay. Under `#autotest` (`ctx.lang` absent or `en`) every string is byte-identical to before,
so the e2e label contracts (`Read the manifest`, `Swear the road`, `.say` → `/^(Attacker |The king is out)/`) hold.

## Plate additions (both new — no 02–05 plate had landed)

- 06 `.ask`: "Each carved word hides a cargo word — the rune says only how its own name ends. Read all four."
- 07 `.ask`: "March the king to a corner within the counted moves. The attackers answer every step."
Carved plate, always visible, above the board; es/ca in the i18n block.

## Commands and exit codes

| command | exit |
| --- | --- |
| `node scripts/verify.mjs --partial --seeds 60 --only 06` | 0 — solver 60/60, wrongs 582, mutants 180/180 |
| `node scripts/verify.mjs --partial --seeds 60 --only 07` | 0 — solver 60/60, wrongs 592, mutants 180/180 |
| `npm test` | 0 — 290/290 |
| `npm run build` | 0 — index.html 1.28 MB, 15 locks |
| `npx playwright test tests/e2e/journey.spec.mjs --project=desktop` | 0 |

Browser evidence: both locks driven to OPENED with real input in en; forced `ctx.lang=es`/`ca`
renders every plate, heading, control, status and aria line localized, console clean.

## Notes for the lead

- `src/shell/screens/lockroom.js` receives `lang` but does not yet put it on the lock `ctx`,
  so locks still render en in-game. Not my path; the locks are ready for that one line.
- 07's `The king was lost on move N.` near-line is unreachable (a king-side move can only
  capture attackers). Pre-existing, left alone; the nearMap maps it anyway.
