# OW-B12 — lock 12 `The Feast Benches`, VIEW half

Rebuilt `mount()` as the hall at feast; the pure half (lines 1–251, generator/
solve/verify/wrongAnswers/difficulty/hints) is byte-identical to HEAD. Two facing
benches of carved plank (one baked plank per bench, sliced across four seats so
grain, rails, rosettes, spilled-mead rings and knife-scored marks run true), the
eight chieftains as painted shield-tokens (8 distinct `drawKnot` interlace devices
× field colour × paint division, iron rim + nailheads + boss, nailed bone name
plaque), the nine oaths as an oath-board of carved plaques.

**BotW law.** Seating a token resolves its oaths at once: a plaque whose two men
are seated glows warm gold (`hold`) or smoulders red with a split in the grain
(`broken`); unresolved plaques stay cold. Accusing brands a plaque with a
mead-stain wash + horn rings + ember rule, and it keeps the brand.
Comprehension: carved plate (en/es/ca), 3s skippable ghost-hand showing that
seats one man opposite a ghosted second so a plaque visibly answers (static
variant under reduced motion, verified), carved 9-notch tally "N of 9 oaths hold".

**Density rubric (dSF2, `artifacts/wip-b12/shots/c10-metrics.json`)**
| | occupancy | largest void | board→controls gap | canvases/blank | under44 | console |
|---|---|---|---|---|---|---|
| 1280×800 | 0.844 (was 0.619) | 0.039 (was 0.163) | 14px (was 963) | 30/0 | 0 | 0 |
| 390×844 | 0.878 (was 0.810) | 0.022 | 11px | 30/0 | 0 | 0 |

Phone is a first-class portrait layout: the benches face each other as columns
across the boards, hall ordered above the oath-board by CSS `order` (DOM order
untouched — `.ow12-seat`/`.ow12-boast` nth() contracts hold). Tokens 78–112px.

**Captures** `artifacts/wip-b12/shots/`: `c10-{showing,partial,accused,solved}-{desk,phone}.png`,
`c10-{desk,phone}.png`, `locale-{es,ca}-{desk,phone}.png`, `reduced-showing-phone.png`.
State proof (`c10-states.json`): showing `1 of 9`, partial `hold/broken/pending` mixed
`5 of 9`, accused `8 of 9 … Name the ninth and swear`, solved=true both viewports.

**es/ca** added as `i18n` (title, epigraph, 3 hints, 3 canonical `nearMap` lines, the
four oath templates rebuilt from `{kind,x,y}`, full board table). `locale.mjs`: both
languages, both viewports, 0 horizontal overflow, 0 errors — LOCALE: GREEN.

**Commands** (all exit 0): `node scripts/verify.mjs --partial --seeds 60 --only 12`
(solver 60/60, 719 wrongs, 180/180 mutants) · `npm test` (289/289) · `npm run build`
(1.51 MB; my module is +29.5 KB minified of the ~330 KB all-lane growth) ·
`npx playwright test tests/e2e/journey.spec.mjs --project=desktop` (1 passed, 31.1s) ·
`node artifacts/wip-b12/ink-targets.mjs` (INK+TARGET FLOOR: GREEN) ·
`node artifacts/wip-b12/align.mjs` (PLAQUE ALIGNMENT: GREEN — name inside the carved band).

**Notes for the lead.** (1) `artifacts/wip-qplay/ink-targets.mjs` and `harness.crossThreshold`
still time out on the threshold's new wager layer; my lane copies step through it —
the shared QA script needs the same one-line fix. (2) Fixed three real defects found
by gates, not by eye: chip fonts sized before the chips entered the DOM; `textContent`
dropping the backdrop canvas and the absolute canvas repainting over the name; and
`aspect-ratio`/percentage-padding resolving against the containing block. `align.mjs`
is the regression gate for the last one.
