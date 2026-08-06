# QUALITY_PLAY_01 — the played experience, locks 06–15

OW-QUALITY-PLAY. Every number below was taken in a real chromium at 1280×800
and 390×844 against a fresh `node build.mjs`, driving the shipped controls.
Evidence: `artifacts/wip-qplay/` (scripts, JSON, `shots/`).

---

## Verdict

Playable, fair, and now genuinely legible. Two hard defects were found and
fixed, both of which had survived every prior gate because they are invisible
to a stub DOM and to a headless canvas that nobody reads back:

1. **Lock 06 never attached its stylesheet.** `styleEl` was built and dropped on
   the floor (`wrap.appendChild` missing, plus a stray `</style>` inside the CSS
   text). The lock shipped as unstyled body text: no row chrome, the 41-word
   ship-lexicon rendered as one run-on wall, the submit button indistinguishable
   from a paragraph, and **62 touch targets under 44 px** (smallest 16.1 × 22).
2. **Every rune drawn by locks 06 and 10 was invisible.** Both passed
   `weight: 'heavy'` — a *string* — into `art.drawRune`, whose `weight` is a
   ribbon width in pixels. `fillRibbon` got NaN and painted nothing. Measured:
   0 ink pixels in 19 canvases on lock 06 and in all four hasp-stave canvases on
   lock 10. Lock 10's staves are the fact its own hint 3 tells the player to
   read ("read the props of each opening half-line against the staves stamped on
   the hasp"); they were blank, and their only other carrier was a `title`
   tooltip, which does not exist on touch.

A third, systemic one: the shell's `#app *{min-width:0}` (specificity 1,0,0)
outranks every `min-width` a lock declares in its own class rules, silently
flattening touch targets across the game. Re-asserted at equal weight inside
the affected lock files.

---

## Per-lock scorecard

Discoverability = could I state the win condition from board + epigraph +
journal, before my first submit? Near = does a genuine wrong attempt teach?
Hints = honest escalation at 3/6/10. Feedback = latency + clarity. Keyboard =
reachable, ringed, operable.

| # | Lock | Discoverability | Near-line | Hints | Feedback | Keyboard |
|---|---|---|---|---|---|---|
| 06 | Jötunvillur | **was FAIL → PASS** | PASS | PASS | PASS | PASS |
| 07 | King's Road | **was FAIL → PASS** | PASS | PASS | PASS | PASS |
| 08 | Twelve Pieces | PASS | PASS | PASS | PASS | PASS |
| 09 | Sunstone | **was FAIL → PASS** | PASS | PASS | PASS | PASS |
| 10 | Dróttkvætt | **was FAIL → PASS** | PASS | PASS | PASS | PASS |
| 11 | Skerry Road | PASS | PASS (6 distinct) | PASS | PASS | PASS |
| 12 | Feast Benches | PASS | PASS | PASS | PASS | PASS |
| 13 | Althing | PASS | PASS | PASS | PASS | PASS |
| 14 | Bind-Rune | PASS | PASS | PASS | PASS | PASS |
| 15 | Oath-Ring | PASS | PASS | PASS | PASS | PASS |

### The four discoverability failures, and what each got

**06 — the rule was nowhere on the board.** The cipher law lived only in a
`ctx.note` (journal drawer, one overlay away) and the board read
`432 readings·····` with no statement of what to do. Added a board-level law
line naming the mechanic concretely ("a letter is cut as the rune whose NAME
ends in that letter's sound — so ár, úr, týr, nauðr, maðr and lǫgr all come out
as ᚱ") and the goal. Also: picking a lid word now advances the hand to the next
unread carving instead of leaving all four picks piling into slot 1.

**07 — brandubh is not common knowledge.** The board showed a 7×7 grid, one
gold piece, two pale, four dark, and four outlined corners. Nothing visible said
which side was yours, that pieces slide like a rook, that only the king may
enter the corners or throne, that capture is custodial, or that the dark side
answers automatically. Journal-only. Added the ruleset (R1–R7, condensed) under
the board.

**09 — the puzzle was unsolvable from the board.** Per the §09 amendment the
day-mark is the *only* thing that makes a bearing nameable; it was drawn as an
unlabelled 14 %-alpha wedge on an `aria-hidden` canvas and stated once in the
journal, while the bearing line said "(outside the day-mark)" without ever
defining the term. Each stone row also showed only its two candidates, never its
raw reading, so the ±16 law was invisible. Both now on the board: the law in
text with the live arc bounds ("point 10 to point 41"), and each row reading
`the fore stone read 19 →  35 | 3`.

**10 — see the blank-stave defect above.** Fixed; the stave now shows both its
rune and its sound letter.

### Near-lines

All 10 locks return a specific, teaching near-line for every shape their own
`wrongAnswers` produces — 0 missing across 104 wrong answers (`near-audit.json`).
Best of set is lock 11 (6 distinct diagnoses: wrong tide, legal but not optimal,
wrong start, stops short, no water). Weakest is lock 15 (12 wrongs → 3 distinct),
but its three cover the three real mistakes (wrong rune on the nail, a
transposed pair, and "the strides do not close the row"), and its hint ladder is
the best-written in the game.

Malformed input (`null`, `{}`, `[]`, `{nonsense:1}`) returns `{ok:false}` with
no near-line in all 15 locks. No view can produce those shapes, so this is
noted, not filed.

**The fix that mattered most:** the shell's `.near-line` lives in the lock-room
footer, below the puzzle body. Measured at the moment of a wrong submit, it was
**off-screen on 6 of 10 locks** (10, 11, 12, 13, 14, 15 at 1280×800) — the
player got a shudder and a deny thud with no sentence. Every lock now echoes the
near-line in-body, immediately under its own action control, in an `aria-live`
region, and scrolls it into view. Re-measured: **10 of 10 visible** at the
instant of the wrong answer, both viewports.

### Hints

`hintsArmed` is exact: 3 / 6 / 10 wrong attempts. Verified by driving genuine
wrong submits from a preloaded count on all ten locks — `["locked","locked",
"locked"]` at 1 attempt, `["armed","armed","armed"]` at 10, dots 1 → 10.
The ladders themselves escalate honestly: hint 1 names the mechanic, hint 2
names the technique, hint 3 names the method — none states an answer. Lock 15's
third hint ("water strides back to wealth, ᛚ to ᚠ. Hang wealth on the north
nail") gives the law and still leaves all fourteen placements to the player.

### Feedback latency

Submit-click → near-line rendered: **8–22 ms** across all ten locks (bar: <100 ms).
Shudder fires on every wrong answer, `audio.ui('deny')` on every wrong answer,
attempt dot increments. Zero console errors in any drive.

---

## Duels — all five, played

Every beat verified against `docs/JARLS.md` on the real build, driven to a real
solve each time (lock 3 by keyboard alone, 471 arrow presses on the night dial).

| Lock | Banner + journal | Name | Taunt | Portrait | Yield line | Bow | Follows into |
|---|---|---|---|---|---|---|---|
| 03 bourj | ✅ "JARL BOURJ bars the third lock." | exact | exact | real, 57 colour buckets | exact | animates | lid |
| 06 rois | ✅ | exact | exact | real, 60 | exact | animates | lid |
| 09 andreas | ✅ | exact | exact | real, 65 | exact | animates | lid |
| 12 folklore | ✅ | exact | exact | real, 76 | exact (fallback line, per §JARLS) | animates | lid |
| 15 arya | ✅ "QUEEN ÄRYÄ STÖRK — the last" | exact | exact | real, 61 | exact | animates | **finale** |

Order correct, Ärya last, her yield flowing straight into the lid-opening finale
while the other four return to the lid for the shard ceremony.

**Is the yield a beat or a popup?** A beat. It takes the screen, holds focus,
plays `motif('yield')` (drum + falling minor third, measured as a real duck over
the music — see below), tweens the portrait over ~1.2 s (sampled: monotonically
falling luminance across 5 frames before the shard ceremony swaps in), writes
the challenger's line to the journal, and only then hands off. Under reduced
motion it swaps in **18 ms** with the line intact — the correct behaviour, not a
degraded one.

**Dare card:** portrait runtime-graded into the carved arch, name in display
caps, taunt in quotes, one carved 234 × 51 button, auto-focused. `Enter`
answers; `Esc` backs out to the lid without forfeiting. All five.

---

## Music over minutes — measurement log

808 s (13.5 min) continuous, AnalyserNode tapped onto everything that connects
to `ctx.destination` (read-only instrumentation injected before page scripts; no
source edits). 7 859 samples at 10 Hz. **Zero page errors.**
Raw: `artifacts/wip-qplay/music-long.json`, analysis `music-analyse.mjs`.

Loop geometry, read off the module's own `AudioBufferSourceNode`:
buffer 279.014 s @ 48 kHz, `loopStart` 8.750 s, `loopEnd` 273.500 s → **loop
length 264.75 s**. Three wraps crossed.

**Seam — measured on the decoded buffer:**
| | value |
|---|---|
| pre-wrap RMS (200 ms) | 0.13080 (−17.67 dBFS) |
| post-wrap RMS (200 ms) | 0.13492 (−17.40 dBFS) |
| **step across the seam** | **+0.27 dB** |
| sample discontinuity at the wrap | 0.005063 of full scale |
| mid-loop body RMS | 0.23005 (−12.76 dBFS) |

**Seam — measured live in the finished mix:**
| wrap | ctx time | RMS 4 s before | RMS 4 s after | step | min RMS ±1 s | gap |
|---|---|---|---|---|---|---|
| 1 | 266.1 s | 0.04984 | 0.05829 | +1.36 dB | 0.03869 | none |
| 2 | 530.9 s | 0.05122 | 0.05875 | +1.19 dB | 0.04202 | none |
| 3 | 795.6 s | 0.05106 | 0.05812 | +1.13 dB | 0.03998 | none |

Repeatable to ±0.12 dB across three crossings, no silence, no click. **PASS.**

**Drone → music handoff (first enable):** 0–2 s drone alone at −29.5 dBFS →
−26.1 (2–4 s) → −26.6 (6–10 s) → **−24.5 dBFS seated by 10–20 s**. Monotone
rise, no hole (the 0.0122 floor in the first window is the drone's own tremolo
trough), no wall. **PASS.**

**Level over the whole listen:** 26 consecutive 30-second windows, RMS 0.0552 →
0.0762 — **2.80 dB total spread**, which is the music's own dynamics, not drift.
**0 of 7 714 samples** fell below −50 dBFS after the 15 s mark: it never drops
out. **PASS.**

**Ducks (motif and UI fired over the music):**
| event | base RMS | trough | duck | recovered |
|---|---|---|---|---|
| `motif('dare')` on entering a duel | 0.05892 | 0.04916 | −1.57 dB | +0.50 s |
| `ui('confirm')` answering the dare | 0.09666 | 0.04551 | −6.54 dB | >6 s * |
| `motif('hint')` taking a hint | 0.06514 | 0.04756 | −2.73 dB | +1.25 s |
| `ui('tick')` picking a lid word | 0.06372 | 0.03670 | −4.79 dB | +0.75 s |

Caveat, stated because it changes how to read the table: the tap sits on the
master, so the motif's own energy partly fills its own duck and inflates the
"base" when a previous motif is still ringing (that is the `>6 s` row — the
baseline was the tail of the dare horn, not a stuck duck). What the ear gets:
a 1.5–6.5 dB dip that releases inside 0.5–1.25 s. Felt, not a pump. **PASS.**

---

## A11y floors — re-run on the real build

**Pointer-free journey, threshold → lid → locks 1/2/3 including the duel,
solved and ceremonied, keyboard only: 12/12 PASS.** Every stop reports
`:focus-visible` with a `3px rgb(238,207,109)` ring — threshold button, all
three medallions, the dare button (auto-focused), the night-dial canvas
(`role=slider`, arrow-driven), the submit, the yield beat, the return to the
lid, and lock 4 armed and tabbable afterwards. Sealed medallions are correctly
`disabled` and skipped by Tab.

**Focus rings under real Tab focus, locks 06–15: 0 controls without a ring**
(measured by tabbing, not by scripted `.focus()` — the latter does not set
`:focus-visible` in Chromium and reports nothing).

**44 px targets, both viewports, all ten locks: 0 under 44 × 44.**
Before this pass: lock 06 → 62 under (smallest 16.1 × 22), lock 15 → 28 under
(ring slots at **12.4 × 46**), lock 09 → 6, lock 08 → 12. Dare card button
234 × 51.

**Blank-canvas floor: 0 blank canvases** across 145 canvases in the ten locks
(was 23: 19 in lock 06, 4 in lock 10).

**Contrast, sampled against the real painted wood behind each string:**
15 of 15 styles pass, range **7.04 : 1 → 14.07 : 1** (floors 4.5 body / 3 display).
Lowest is lock 15's help line at 7.04 : 1 — still 1.6× the floor.

**Reduced motion (`emulateMedia`):** `#app.reduced-motion` applied; dare card
`animation-name: none`; yield beat completes in **18 ms** with its line intact;
both treasure reveals legible (`TEBI THE OSTEOPATH · Snake-in-the-Eye` →
`JARL ÅLANØ … from under the false bottom`) and advance by Enter; the joint
tableau offers `Raise the horns` / `Seal the chest again`; credits render 299
characters with all five challengers named and **6 static stickers, no
animation**. All legible. **PASS.**

---

## Open items — not mine to fix, filed with numbers

1. **`#app *{min-width:0}` (`src/shell/style.js:22`) outranks every lock's own
   `min-width`.** I re-asserted the floor inside locks 06/08/09/10/15, but the
   rule will keep silently flattening any future target — including locks 01–05,
   which I did not audit. Recommend scoping it (e.g. `#app canvas, #app img`) or
   dropping it.
2. **The hint horn is below the fold on all ten locks** at both viewports at the
   moment the player is looking at the submit control. A player who never
   scrolls past the puzzle body may not learn hints exist. The near-line problem
   is solved in-body; the hint horn cannot be, since it is shell furniture.
   Recommend pinning `.lockroom-footer` or surfacing an armed-hint indicator
   near the action.
3. **Nothing in `.screen` is user-scrollable except the body.** `.screen` sets
   `overflow:hidden` and `.lockroom-frame` has `min-height:100vh`, so tall locks
   (13 at 1775 px root height on a phone, 12 at 1332 px) rely on the *body*
   being the scroller. It works, but it also means automated drives —
   which scroll `overflow:hidden` containers programmatically — pass on layouts
   a human cannot reach. Worth an explicit contract note.
4. **Recorded during this pass, since fixed upstream:** between 19:33 and 19:53
   `src/shell/screens/lockroom.js` shipped a TDZ `ReferenceError` (`resizeBg()`
   called above `let headerTitle`) that stopped **every** lock room from
   mounting. Measurements taken in that window used an aliased copy of the file
   inside `artifacts/wip-qplay/shellpatch/` (nothing under `src/` was touched);
   all headline results in this document were then re-run and confirmed on the
   real build after the upstream fix. The class of bug argues for a
   one-line smoke gate: mount every lock room once in a browser and assert zero
   page errors.

## Recommendations that would need a pure-half change (not made)

None. Every fairness gap found was closable in surface text or view
affordances. `makePuzzle` / `solve` / `verify` / `wrongAnswers` / `shard` /
difficulty declarations are untouched in all ten files, and
`node scripts/verify.mjs --partial --seeds 200` is green with identical
solver/wrong/mutant counts.
