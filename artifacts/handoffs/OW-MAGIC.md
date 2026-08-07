# OW-MAGIC — revamp handoffs (staged)

## Stage 1 — teardown · Galdr Law · fonts · text purge (CLOSED, gates green)
State: landed on working tree, all gates green at this boundary.
Teardown: artifacts/wip-magic/TEARDOWN.md (played cold, 74 shots + audit JSON;
fun-first verdicts per lock; overlap forensics; numbers to beat).
Fonts: Cormorant Garamond (embedded woff2 data-URIs from fonts.gen.js) wired as
@font-face w500-700 + italic in shell/index.js; --font-display swapped
(style.js); canvas carve engine FONT_STACK swapped (art/text.js) — carved
titles, names, ceremony lines all speak Cormorant; boot waits ≤400ms for the
face so first carve paints true. OFL credit line added to credits colophon.
Galdr Law: authored 15 galdrar en/es/ca (2–3 verse lines, law-true, ≤2 stops),
wired through the existing epigraph plumbing (pre-line render, shard-rune
initial ≥700px). Header = numeral · carved title · galdr, nothing else;
heckle is journal-only. ALL board instruction text deleted in three languages
(ask-plates, law/help paragraphs, demo captions, section labels; canvas plate
painters removed; keys pruned everywhere — parity tests green). Keyboard
semantics + legends live in the journal (existing say() paths; 11/12/14 gained
one-time journal notes reusing existing keys). Board words on entry
(en desk, instruction prose): before 46–214 → after 0 on all 15; what remains
is puzzle data (worst: L04 testimonies 127, L12 oaths 135, L13 quotes 151).
Word audit: artifacts/wip-magic/wordcount.json.
Files: src/locks/01..15 (view text + i18n), src/shell/{style,index,strings←none,
overlays,screens/lockroom}.js, src/art/text.js, index.src.html.
Gates at boundary: npm test 295/295 · build 1.60MB (≤2.0) · e2e 12/12 ·
ink-targets 30/30 GREEN · overlap detector (z-aware) 0 real overlaps on all
23 walked moments · locale pins intact (subtitle + settings labels).

## Stage 2 — dare set-piece · hero plates · photo lid · luminosity (CLOSED, gates green)
Dare = gym-leader entrance (lockroom.js): header+footer leave the stage; house
lights die (near-black vignette); prow-v2 plate rides out of the dark (lazy,
1.4s fade, procedural dark fallback); portrait arch up to 360px (Ärya 430 +
biggest name); NAME lands as a Cormorant carved title-drop with a chisel
knock timed to the land (~1.4s); taunt fades as one spoken line; plate offers
at 2.25s. Reduced motion = final lit state at once. Contract classes, button
label, aria untouched — e2e drivers unchanged. Yield mirrors it (arch 0.72/300).
Hero plates (src/shell/heroes.js: lazy fetch + decode cache + coverRect +
hue-preserving wood grade; absence → procedural, offline law):
· chest.jpg IS the threshold poster and THE LID — 15 hit targets anchored to
  the photographed bronze medallions (fractions calibrated:
  artifacts/wip-magic/shots/calib-medallions.png); state renders as light on
  metal (sealed wash / open gold ring + etched rune / armed pulsing halo +
  arcane-blue rune); banners straight-pinned quiet cloth, flaps off; ONE
  chapter label (armed gauntlet only) — lid text noise −20 words, collisions gone.
· panel-v2.jpg = lock-room tabletop under every board (header/footer scrims
  keep text contrast law; tray + gold pool keep the toy focal).
Journal = true vellum page (dark ink, blood margin, clock stripped at render;
timestamps stay in the save). Quiet actions are carved latches, no hyperlinks.
Luminosity (measured on captures, focal/field, artifacts/wip-magic/verify2.json):
threshold 4.3–4.8x · lid 2.2–2.3x · journal 10x+ · rooms pass p90 metric
except L04/L12/L13 (1.4–2.1x — see soft spots). Dare p90 2.6–4.8x, finale 2.6x.
Gates at boundary: same battery as Stage 1, all green (12/12 e2e includes
floors offline run with heroes/*.jpg whitelisted as silent-degrade assets —
same class as the mp3 exception, spec comment updated honestly).

## Stage 3 — cohesion pass (CLOSED, gates green)
One design voice for every board's quiet actions: all lock secondary controls
(skip/undo/reset/reckon/clear/back/seal — .ow*-skip/.ow*-act, tafl bar, 09
.skip) now speak the carved-latch small-caps voice via one #app-prefixed rule
in style.js (lock primaries stay the gold plate; 08's .ow8-act container
excluded on inspection). Galdr rune drop-cap REMOVED (optional garnish read as
stray debris beside wide verses — header is now numeral · carved title ·
verse, verified clean at c3-L11-clean.png). Orphan CSS from the purge swept
(06 .ask/.law, 15 haspname, 12 plate order rules). Journal clock stripped at
render (save format untouched). Looked at: c3-L03 (button voice + coast
diorama), c3-L11, L09/L12 verify2 shots, dare13 both viewports.
Gates at boundary: npm test 295/295 · build 1.61MB · e2e 12/12 ·
ink-targets 30/30 GREEN (re-run after the button restyle).

## Known soft spots (for the 20 polish loops)
1. L04/L12/L13 lack a luminous focal (dark planks/benches/stones): prescribe
   lifting key surfaces (plank faces +12%, mead-pool over benches, moonlight
   pool on the law-rock) — board-art edits, not view text.
2. Threshold CTA plate covers the photographed chest's medallion face at
   390×844 (reads as "hands on the chest", but check with Ramon).
3. Lid photo mode: gauntlet cloth y-steps 2–3px where a gauntlet wraps rows;
   sealed-cloth red reads faint on the photo (intentional, verify at retina).
4. Per-room plates (chart/stones/silver/tafl/ring/rose/bench) committed but
   not yet placed — panel-v2 serves all rooms; place per room only where the
   image reads as environment, never as a second game object.
5. es/ca galdr lines wrap to 4 lines at 390px on L12/L13 (reads fine as verse;
   tighten only if Ramon flags).
6. L15 slot hit-areas abut (4–7px union overlap of adjacent 44px targets;
   ink-targets green, no mis-taps observed — watch in play).
7. Lock 06's slate rows still carry heavy mono data chips ("432 readings") —
   correct puzzle data, but the densest remaining board text after the purge.
Evidence: artifacts/wip-magic/ (TEARDOWN.md, teardown-audit.json, wordcount.json,
verify2.json, ink-targets.json, shots/ — before shots en-*/es-*/ca-*, after
shots g1-*, d2-*, lid3-*, th2-*, v2-*).
