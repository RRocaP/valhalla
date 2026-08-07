# QUALITY BAR — VALHALLA vs the Japanese game (and one level above)

Reference: https://rrocap.github.io/roca-airways/ (ROCA AIRWAYS RA-2027) — the
accepted prior. Standing rule: the bar is shipped-AAA-game art, judged on
screenshots at retina scale, not "good for a web page". VALHALLA must match
the reference on every axis and beat it on at least three.

## Method (each axis gets a measured verdict, not vibes)

Capture VALHALLA and the reference at 1280×800 and 390×844: threshold/boarding,
hub (lid vs gate map), one early + one late puzzle, wrong-answer moment, hint
moment, ceremony/reward, finale, credits. Same moments side by side.

| Axis | Measure |
|---|---|
| Surface believability | zoom to 200%: does wood read as wood (grain flow, knots, pores) the way the reference's paper/ink reads? Count distinct texture layers visible. |
| Carve/relief | do panels, medallions, lettering read as CUT (incision + lip light) — screenshot crops at 100%/200% |
| Typography | hierarchy steps, letter-spacing discipline, relief on display type, no default-looking UI text; measure contrast of every text style over its real background (≥4.5 body, ≥3 display) |
| Feedback juice | wrong answer, solve, hint, duel dare/yield, ceremony: every one has visual + audio + journal response; deny is felt but not punishing |
| Composition | each screen has a focal hierarchy at thumbnail size (squint test on 25% scale captures) |
| Motion | idle drift alive but calm; transitions ≥ reference; reduced-motion variant fully legible |
| Audio layering | drone + music + motif + UI never clash; loop seam inaudible over 3 crossings; duck/release felt |
| Puzzle presentation | rules discoverable from the board + epigraph + journal alone (no external instructions); near-lines helpful; hints escalate honestly |
| Performance | chestScene repaint ≤8ms; no frame >32ms during idle; interaction latency <100ms |
| A11y floors | contrast, 44px targets, full keyboard path, reduced-motion — deterministic checks re-run |

## Ramon's emphasis (weight these axes first)

Textures, feel, detail, how the music loop SOUNDS, and feedback — all one
notch above the reference. Concretely: texture passes get extra layers before
anything else; every interaction answers in ≤100ms with wood/metal sound +
visible response; the loop seam and the drone→music handoff are listened to
(headless numeric checks are necessary, not sufficient — a quality agent must
play 3+ minutes in a real browser and judge fatigue, seam, and duck behavior);
micro-detail everywhere the eye rests: nailheads, worn paint in grooves,
rivet shadows, journal ink texture.

## The Magic Law (Ramon 2026-08-07: "it doesn't have the magic feel the
## japanese game had — the palette aesthetic, the polish, the fonts, the
## intuition; too much text when it should be more game")

1. **Text budget, hard**: a lock room shows AT MOST numeral + title + one
   epigraph line above the board. The "what it asks" plate is DEMOTED to an
   optional quiet horn-tap (and auto-offers only after 2 wrong tries or 60s
   idle). Board-surface instruction sentences are deleted — demo beats,
   affordances, and near-lines teach. Heckles live in the journal, not the
   header. Wager card ≤3 lines. If a sentence explains what touching would
   teach in 2 seconds, the sentence dies.
2. **The fonts**: display voice = embedded Cormorant Garamond (latin subset,
   inlined data-URI, OFL — credit in credits). Numerals/ledger keep the mono;
   body keeps the serif stack. Letterspacing generous, sizes confident.
3. **Luminous elegance**: light against dark is the aesthetic — bone/gold
   glow, paper-light panels where reading happens, the arcane blue as the one
   cold accent. Screens must not read as brown-on-brown; every screen has one
   luminous focal point.
4. **Intuition first**: the first obvious touch teaches (progression-feel law
   below); anything that requires reading before touching is a defect.

## Progression-feel law (Ramon 2026-08-06: BotW shrines + Pokémon league)

Challenging but always doable, intuitive, and the player must FEEL themselves
improving: (1) the first obvious interaction on every board teaches the rule
by doing — text is the safety net, never the teacher; (2) each gauntlet's
first lock leans on a verb the player already owns before its new idea lands;
skills return and combine (runes → mirrored runes → bind-runes; counting →
cycles → the ring law); (3) no walls — the jarl-counsel ladder always offers
a next step without solving it; (4) yields are badges: the beat + verse must
feel EARNED; (5) both form factors first-class — thumb-reachable, ≥44px, no
hover-only cues, verified at 390×844 touch and 1280×800.

## Density rubric (Ramon 2026-08-06: "white space, texture detail… the level
is not there" — these are pass/fail numbers, measured on dSF2 captures)

- **Field occupancy**: puzzle furniture + intentional detail ≥55% of the
  panel's visual field at 1280×800; no contiguous featureless region larger
  than ~18% of the panel; vertical gap between board and controls ≤48px.
- **Dead-zone law**: every empty stretch carries quiet incidental carving
  (tool marks, scribe lines, chip-rosettes, wear) at low contrast — visible
  (≥1.5:1 vs field) but subordinate (≤2.5:1), never competing with the puzzle.
- **Texture layers**: ≥3 distinguishable material layers on every surface at
  200% zoom (base grain → wear/patina → carve/tool history); flat fills of
  any size fail.
- **Carve standard**: Vikings-Valhalla ship-prow density on ornaments and
  rails — interlace runs with ribbon over/under, chip-carved borders, stepped
  architrave frames. Squint test at 25% must still show one focal hierarchy.

## Protocol

1. QUALITY agents (Opus) produce `docs/reviews/QUALITY_GAP_01.md`: per axis —
   VALHALLA state, reference state, verdict (BEATS / MATCHES / BELOW), evidence
   crop paths, and for every BELOW a concrete, bounded fix.
2. Lead triages into a polish wave (fixes in owner lanes, disjoint paths).
3. Re-capture, re-verify: every BELOW must move to MATCHES+, no axis may
   regress. Loop until zero BELOW and ≥3 BEATS.
4. Only then ship. The review + final verdict stay in `docs/reviews/`.

## Non-negotiables carried from the contracts

Deterministic gates stay green throughout (`npm run gates`); no new runtime
deps; single-file + two mp3s delivery unchanged; frozen puzzle mechanics and
shard/ring law untouched by polish.
