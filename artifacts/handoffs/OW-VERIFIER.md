# OW-VERIFIER — 20-loop feel/polish campaign (loops 1-4 this agent)

## LOOP 1 — threshold + lid + gauntlet I (both viewports), photo-lid redesign

State: COMPLETE, all gates green at this boundary. Working tree carries the
changes uncommitted (lead integrates).

Played cold (real Chromium, real input): threshold -> wager -> lid ->
locks 01-03 (dare, drivers, ceremonies) at 390x844 (touch, dSF2) and
1280x800. Zero console errors both runs.
Evidence: artifacts/wip-verifier/loop1/ (phone-*/desktop-* journey shots,
fx-* closeups, calib-* measurement overlays, es-*/ca-* locale shots).

### Finds -> fixes (Ramon's live iPhone review + coordinator additions)

1. CHAPTER LABEL overlapped the top medallion row.
   -> Photo mode now seats the ONE armed label in the photograph's clear
   zones: row-1 gauntlets in the iron/dark band above the first arc
   (fy 0.414 of the plate); lower gauntlets in the wooden rail between
   their arc and the arc above, computed at runtime from the calibration
   table (segment-aware, the arcs smile). Label rides a whisper-weight
   swallow-tail end-tab sized to the text (blood when revealed, tar-washed
   when sealed) painted on the deco canvas. `.duel-banner` class/visibility
   contract untouched (e2e green).
2. BLOOD RIBBONS cut across the medallion field mid-face.
   -> KILLED in photo mode (the photograph is the spectacle). paintBanner's
   cloth now runs only in the procedural fallback. Squint test reads:
   chest + one armed glow + one label.
3. STATE RINGS spilled off the photographed bronze.
   -> Root cause measured: the single CHEST_SOCKET_R 0.0442 was 27% larger
   than the real discs, and centers drifted (worst 0.011 of image height).
   Recalibrated the whole table by hand on 0.005-fraction grid crops of
   heroes/chest.jpg (grid-row*.png; automated centroid/circle-fits kept
   locking onto the specular glint — rejected). CHEST_SOCKETS now carries
   per-socket {fx, fy, fr} (fr 0.0341-0.0360 of width). Open ring 0.90r +
   gold wash clipped to the disc; armed ring 0.94r, halo clipped at 1.08r;
   sealed wash tightened to 1.05r. Light reads as ON the metal.
4. SHARD TALLY floated like debris under the chest.
   -> Redesigned as ONE carved ledger rail: tar plate, swallow-tail ends,
   double hairline (tar + gold), rune over Cormorant numeral per shard,
   diamond nails between cells, seated on the photographed carved band
   (fy 0.667). Adaptive width, phone fits all 14 shards.
5. RUNE FIRE (Ramon: "overflowing blue magick... like a flame").
   -> runes.js: drawMagic gained `opts.flameScale` (spectacle dial) — flame
   envelope, wisp thickness (sqrt) and wisp alpha (capped 0.85/0.92) scale;
   overflow band (magic>=0.72) adds a bright heart lick + 2 rising embers;
   wisp size gate lowered 18->13px so phone-size armed runes burn. Lid armed
   rune: centered (was 0.1r high), size 1.12r, magic 0.88-1.0 breathing,
   flameScale 3. At peak breath the lick clearly clears the disc rim at
   390px (fx-flame-3.png).
6. GLYPH CENTERING: all lid runes (open + armed) now drawn at exact disc
   center (drawRune box is top-left anchored: x-size/2, y-size/2).
7. PRESS FEEDBACK (HS-card feel): pointerdown on an accessible medallion ->
   gold+arcane bloom flash + 5-6 rising sparks (<500ms) + CSS scale press
   0.955 with overshoot settle (existing knock unchanged on activation).
   Locked medallion -> dull ember ring pulse + audio.ui('deny') (existing
   frozen voice). Bare chest wood -> dust-mote puff + audio.ui('tick').
   All on the existing animated canvas, time-gated list, zero layout
   thrash. Reduced motion: bloom/gleam only, no particles, no scale, no
   raf (short setTimeout repaint chain). Threshold: chest answers idle
   taps with a mote puff on the existing motes canvas (audio-free screen
   by design, so no sound there).
8. es/ca UNTRANSLATED CTAs: root cause — threshold.js and lockroom.js
   hardcoded English while strings.js carried translations. Wired the
   already-passed tr(): threshold begin/continue/beginAnew(+confirm/cancel),
   lockroom 'Answer the dare' + 'Close the lock'. Live audit under es-ES /
   ca-ES locales (no #autotest): threshold, wager and dare CTAs all speak
   the save language (es-*/ca-* shots). #autotest still pins en (e2e
   contract intact). finale/overlays were already wired.
9. DARE PORTRAIT LUMINANCE LAW (docs/ART.md >=0.8x source at rest):
   MEASURED on the live dare (face region vs cover-cropped source):
   phone 1.07x, desktop 1.08x — PASSES with margin; entrance ends lit.

### Gates (exact, this boundary)
- npm test: 295/295 pass
- npm run build: index.html 1,689,286 bytes = 1.61 MB (<= 2.0 MB)
- npx playwright test: 12/12 (desktop + iphone)
- node artifacts/wip-magic/ink-targets.mjs: GREEN (30/30 rows, 0 blank
  canvases, 0 targets under 44px)

### Files touched
- src/shell/screens/lid.js (calibration table, rings/glyphs, photo labels,
  ledger rail, press/tap FX, press-scale CSS)
- src/art/runes.js (flameScale, overflow flame, wisp gate/alpha)
- src/shell/screens/threshold.js (tr CTAs, tap motes)
- src/shell/screens/lockroom.js (tr for dare/back CTAs)

### Deferred / for later loops
- Threshold CTA plate still covers the middle medallion row (soft spot #2)
  — intentional "hands on the chest" read; needs Ramon's call.
- Lock 04 photographic planks (heroes/plank1/plank2/slipway.jpg): plates
  NOT landed yet — circle back the moment the lead commits them.
- Board-tap delight for lockrooms/dare (prow ember flare, slipway ripple):
  loop 2-3 as those screens come under play.
- L04/L12/L13 luminous focal (OW-MAGIC soft spot #1): loop 2 (L04) and
  loop 3 (L12/L13).
- es/ca galdr 4-line wrap at 390px on L12/L13 (soft spot #5): verify in
  loop 3; tighten only if Ramon flags.
- Flame loudness: current peak reads at phone; if Ramon wants more from
  couch distance, raise flameScale (dial exists now).

## LOOP 2 — gauntlets II-III (locks 04-09), lock 04 goes photographic

State: COMPLETE, all gates green at this boundary.

Played cold (real input, save seeded past gauntlet I): dare 4 -> locks
04-09 (keyboard stack for 04, cells/listbox/tafl/radios/bearing drivers),
yields at 6 and 9, both viewports. Zero console errors.
Evidence: artifacts/wip-verifier/loop2/ (34 journey shots + verify-*).

### Finds -> fixes

1. LOCK 04 PHOTOGRAPHIC REBUILD (Ramon: "it needs to feel visual
   interactive"; plates landed 10:41):
   - heroes/plank1.jpg + plank2.jpg become the seven draggable strakes:
     per-plank plate slice (alternated + mirrored + faint tone shift so
     seven read distinct), cropped ABOVE the photo's own rivet row so the
     puzzle's exact-count rivet pips are never contradicted, studio black
     lifted to alpha so each strake keeps its sheer-curve silhouette.
     Mark washes / chalked name field / lap shadow now composite
     source-atop INTO the wood. Slices cached per (variant|flip|size).
   - heroes/slipway.jpg is the room's tabletop (PLATE_BY_LOCK in
     lockroom.js, fy .6, deeper dim + existing header/footer scrims) —
     the dusk shipyard with the keel in its cradle reads as environment
     behind the board. This also closes the L04 "no luminous focal" soft
     spot (hearth fire + dusk water are the room's light).
   - the drop got timber weight: settle() is now a vertical drop with one
     small rebound (190ms), paired with the existing felted knock.
   - procedural painter + panel-v2 remain the byte-for-byte fallback
     (offline law); marks-based driver contract untouched (e2e green).
2. DARE STAGE TAP DELIGHT: the dark stage answers idle taps with a brief
   ember flare (CSS radial, <500ms, pointer-events:none) + the tick voice;
   listener removed at answer; reduced motion = static gleam.
3. SEER-MOOD CHARMS read as flat black ink stains ON the boards (locks
   04-06, worst at phone where no side dead-zone exists). drawMotes now
   skips charms under 640px width and halves their loudness on wide
   rooms (fill .78 -> .5, cord .72 -> .48).
4. ARMED CHAPTER LABEL SEAT (photo lid): the sealed gauntlet-IV tab bled
   off the left screen edge at 390px and sat far from its armed lock.
   paintPhotoLabel now (a) caps tab width to the viewport, clamps by TAB
   width, (b) recomputes the clear-rail midpoint over the tab's actual
   clamped span, and (c) anchors to the segment holding the ARMED lock
   (fallback: longest run) — the words now sit beside the burning
   medallion (verify-lid-arm10-phone.png).

### Gates (exact, this boundary)
- npm test: 295/295 pass
- npm run build: index.html 1,692,222 bytes = 1.61 MB (<= 2.0 MB)
- npx playwright test: 12/12
- node artifacts/wip-magic/ink-targets.mjs: GREEN (30/30)

### Files touched (loop 2)
- src/locks/04-strakes.js (plank plates + slices + weighty settle)
- src/shell/screens/lockroom.js (PLATE_BY_LOCK slipway, dare ember flare)
- src/art/moods.js (seer charms gate/quiet)
- src/shell/screens/lid.js (label seat: tab clamp + armed-segment anchor)

### Loop-2 deferred
- Lock 06 slate rows: densest board text after the purge (OW-MAGIC soft
  spot #7) — played fine; unchanged.
- Slipway at 390px crops steeply (fire + prow mostly out of frame);
  acceptable, revisit only if Ramon flags.
- Lockroom board tappables beyond the dare stage: loops 3-4.

## LOOP 3 — gauntlets IV-V (locks 10-15) + finale + credits

State: COMPLETE, all gates green at this boundary.

Played cold (real input, save seeded past gauntlet III): dares 10 and 13
(Ärya's 430px entrance verified), locks 10-15 solved through their real
UIs, lock 15 straight into the finale (no shard overlay — correct), the
treasure reveal, Raise the horns, and the credits gallery. Both viewports,
zero console errors.
Evidence: artifacts/wip-verifier/loop3/ (30 journey shots + verify-*).

### Finds -> fixes

1. L12 FEAST BENCHES lacked a luminous focal (OW-MAGIC soft spot #1,
   measured 1.4-2.1x focal/field): bench bake crown light .30 -> .42
   (mid .07 -> .14), worn-seat polish .16 -> .26, central boards' hearth
   pool .16 -> .30 r*.5 (the mead-pool). Benches now read as stock
   standing in hall light (verify-room12-lift-phone.png).
2. L13 ALTHING law-rock: cool moonlight added ON the stone (post-body
   crown glows fjordLight .3 + bone .2 — the first attempt painted under
   the body and vanished), crown polish .16 -> .27, ambient rock glows
   raised. Verdict: IMPROVED BUT STILL CONSERVATIVE — the diorama's dark
   ground bake dominates; an honest "luminous focal" for L13 needs a
   key-light pass inside bakeGround. Flagged for loops 5+.
3. L15 slot hit-areas (soft spot #6): played the full ring at both
   viewports — no mis-taps, ink-targets green. Watch only.
4. es/ca galdr wrap on L12/L13 at 390px (soft spot #5): verified live
   under es-ES (verify-galdr12-es.png) — wraps to 4 lines with a short
   hanging half-line; reads as verse. Per the soft-spot ruling, left for
   Ramon's call.
5. Finale + credits: treasure card (Tebi), horns, credits challenger
   gallery all render and advance correctly at phone; dare portraits,
   galdr headers and CTAs verified through the whole back half. No fixes
   needed — no finds beyond L12/L13 above.

### Gates (exact, this boundary)
- npm test: 295/295 pass
- npm run build: index.html 1,692,372 bytes = 1.61 MB (<= 2.0 MB)
- npx playwright test: 12/12
- node artifacts/wip-magic/ink-targets.mjs: GREEN (30/30)

### Files touched (loop 3)
- src/locks/12-veitsla.js (bench crown/seat/hearth lifts)
- src/locks/13-althing.js (law-rock moonlight, crown polish)

## LOOP 4 — full cold run (both viewports) + es/ca pass

State: COMPLETE, all gates green at this boundary.

Full cold runs, real input, fresh saves: threshold -> wager -> all 15
locks (every driver) -> finale -> horns -> credits. Phone 119s, desktop
126s, zero console errors. Mid-run pause/resume exercised after lock 8
(reload -> Continue -> lid restored). Evidence:
artifacts/wip-verifier/loop4/.

es/ca pass: scripted sweep of threshold-resume, wager, lid, settings,
journal, dare, room 04, finale, post-horns, credits under es-ES and
ca-ES — every visible string scraped and screened against an
English-marker list (names/frozen terms excluded).

### Finds -> fixes

1. ENGLISH LEAK IN THE es/ca JOURNAL: "JARL BOURJ bars the first lock."
   — lid.js pushed the armed-gauntlet announcement as hardcoded English
   while strings.js has carried lid.barsJournal es/ca all along. Now
   localized (ordinalWordLang agreement: es «cerradura» f., ca «pany»
   m.); dedupe via journalHasLine across all three languages, so old
   saves keep their English entry without duplication.
2. HINT HORNS + ATTEMPTS spoke English under es/ca ("Hint 1/2/3"):
   wired lockroom.hint / hintTaken / hintAvailable / hintLocked /
   attempts through tr (autotest-aware; e2e language pin holds).
3. ESCAPE now closes the journal drawer and settings panel (they only
   answered the ✕ and a scrim tap; desktop hands reach for Escape
   first). Listener self-detaches when the panel leaves the DOM.
4. Final sweep: 0 English leaks across both languages, all ten swept
   screens (was 7 findings pre-fix).

### Gates (exact, this boundary)
- npm test: 295/295 pass
- npm run build: index.html 1,693,150 bytes = 1.61 MB (<= 2.0 MB)
- npx playwright test: 12/12
- node artifacts/wip-magic/ink-targets.mjs: GREEN (30/30)

### Files touched (loop 4)
- src/shell/screens/lid.js (localized barsJournal line)
- src/shell/screens/lockroom.js (hint/attempts tr)
- src/shell/overlays.js (Escape closes overlays)

## REPORT — loops 1-4 done, targets for loops 5+

Loops done: 4 of 4 assigned. Every loop: cold play at 390x844 + 1280x800,
fix, full gate battery green (295 unit · 1.61MB build · 12/12 e2e ·
ink-targets 30/30), zero console errors in every played session.

Fixed this agent (18 finds): photo-lid calibration (per-socket, hand-
measured), rings/glyphs hug + center on the bronze, armed rune fire
overflow (flameScale dial) + press feedback (bloom/sparks/deny/motes +
scale press) + threshold tap motes, chapter labels seated in clear zones
on whisper-weight tabs (ribbons killed in photo mode), shard ledger rail,
lock 04 photographic strakes + slipway environment + weighty drop, dare
ember flare, seer charms off phone boards, L12 bench/mead lifts, L13
law-rock moonlight, es/ca CTAs + journal line + hints + attempts
localized, Escape closes overlays.

Targets for loops 5+ (in priority order):
1. Threshold CTA plate covers the chest's middle medallion row at 390x844
   (needs Ramon's call — "hands on the chest" read vs clean bronze).
2. L13 luminous focal is still conservative — needs a key-light pass in
   bakeGround (scene-wide, not just the rock).
3. Flame/press-FX loudness calibration session with Ramon on a real
   phone (dials exist: flameScale, FX alphas).
4. Board tappables for remaining rooms (slipway water ripple on L04,
   tafl board knock, etc.) — the pattern + budget rules are established.
5. es/ca galdr 4-line wrap on L12/L13 at 390px (reads as verse; Ramon
   call), L15 abutting hit-areas (watch), lock 06 slate density.
6. Per-room plates for chart/stones/silver/tafl/ring/rose/bench exist in
   heroes/ but only slipway is placed — place per room only where it
   reads as environment (OW-MAGIC rule).
7. Seer charm silhouettes on wide rooms: quieted, but consider redrawing
   with rim light instead of flat tar fills.
