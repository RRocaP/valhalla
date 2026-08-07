# VALHALLA teardown — played cold 2026-08-07, both viewports, en/es/ca
Evidence: artifacts/wip-magic/shots/ (74 captures) + teardown-audit.json (word counts, overlap pairs, scroll need per screen). Reference: artifacts/reference/ (roca-airways).

## The disease, named (why "polished in the wrong direction")
Every surface got craft; the GAME got prose. The reference wins with a near-black
void, ONE luminous instrument, tiny italic type, and zero instructions. VALHALLA
answers with evenly-lit brown fields where nothing leads, and it explains itself
like a rulebook: boards carry 46–235 visible words (target ≤12); at 390×844 the
first interactive piece sits 700–1700px below the fold on 9 of 15 locks. The
player reads, scrolls, then plays. Hearthstone/Gwent players never read.

## Fun audit, per verb (the core judgment)
- GOOD TOYS ALREADY: 01 drag-staves (chunky, yearn-bob invites), 03 dial (turning
  is pleasing), 07 tafl (pieces read as pieces), 09 dial+stones (the rose is the
  best object in the game), 13 stones scene, 14 tray. The verbs are sound.
- WHERE FUN DIES: (a) every toy sits under a carved ask-banner + law paragraph +
  help line — reading before touching, the exact defect the Magic Law names;
  (b) phone: the toy is below the fold (L13 1729px, L12 1277, L10 870, L08 860);
  (c) submits are far from the toy and sometimes below the fold (L09 desktop);
  (d) wrong-answer feedback is good (shudder+near-line) but the near-line
  renders twice (footer + board status echo) on several locks;
  (e) puzzle DATA as prose sentences (L04 "Ketil swears: the burnt plank laps
  the pale plank. 28 over 14" ×7; L07 five-line Brandubh policy paragraph) —
  data should be board objects, prose should be dead.

## The dare (Ramon: "no 'dare' when a jarl challenges")
Now: a dim card INSIDE the lock frame, lock title+epigraph still competing above,
small mud-dark portrait, web-CTA button. No entrance, no name-drop, no held beat.
It reads as a settings dialog with a photo. → Rebuild as full-stage set-piece
(house dark → entrance → name title-drop → one taunt line → beat → arena reveal).
Yield beat has the bones (bow tween, banner) but same smallness; mirror the same
grammar. Ärya at 13 gets the loudest version.

## Text overlap (Ramon saw real ones; audit + eyes agree)
1. Lid: five ALL-CAPS ribbon labels ride the medallion field; ribbons/labels
   cross socket rings at phone; "GAUNTLET x — A SEALED BANNER" ×4 is noise text.
2. Ask-plates overlap board frames (L09/L13 banner sits over the tray's gold
   rail).
3. L15: adjacent slot hit-areas intersect 4–7px (real target overlap).
4. Detector false-positives identified (wrapped-inline union rects in L04/L07/
   L09 paragraphs; overlay-over-lid stacking) — fix detector (z-order aware) so
   the overlap gate is honest; the prose deletion removes most true sources.
5. es/ca: settings segmented control wraps into label at 390px (audit hits).

## Screen-by-screen composition verdicts
- THRESHOLD: wordmark carve good; field is flat brown everywhere, chest almost
  invisible, gold CTA slab reads web. Needs void-dark edges, hearth pool as the
  ONE light, chest visible as a silhouette with rim, quieter plate button.
- LID: chest painting competent but murky; armed medallion glow is the only
  focus and it's weak; caps-label noise; hasp rail an empty black slab early.
  → labels: only the armed gauntlet speaks (one small plaque), sealed = cloth
  only; deepen vignette; strengthen armed glow + arcane-blue rune accent.
- LOCKROOM: header numeral+title fine; epigraph = 11–34 words + heckle stacking
  → galdr (2–3 verse lines) replaces epigraph/ask/laws; heckle → journal only.
- BOARDS: kill banners/laws/help/captions; compress L04 testimonies to object
  lines; L07 paragraph dies; keep near-lines; submit within reach of the toy.
- JOURNAL: dark sheet, mono timestamps first — should be warm vellum page, ink
  voice, entries as carved lines. SETTINGS: functional; needs plate voice, no
  underline link. FINALE: closest to right; needs Cormorant + deeper void.
- CREDITS: fine bones; will carry the Cormorant OFL credit line.

## Rebuild order (approved plan + Galdr Law)
1. Foundation: Cormorant @font-face (fonts.gen data URIs) + display voice;
   void-luminosity CSS (dark field edges, one focal glow per screen, vellum
   reading surfaces); set-piece + galdr + ask CSS primitives in style.js.
2. Galdrar: author 15 verses en/es/ca, wire through epigraph plumbing with
   shard-rune drop-cap; purge all board instruction text (all 3 langs); demote
   labels to aria; keep near-lines + journal teaching lines.
3. Dare/yield set-pieces in lockroom.js (contract classes unchanged).
4. Lid de-clutter + focal strengthening; threshold void; journal vellum;
   settings plate voice; wager ≤3 lines check.
5. Finale/credits type pass + OFL credit; cohesion sweep; gates ×2 look cycles.

## Numbers to beat (from this audit)
- Board words on entry (en desk): 46–214 → ≤12 beyond numeral/title/galdr.
- Overlap pairs (z-aware): must be 0 on all walked screens.
- Phone scroll-to-first-interactive: L12/L13 class boards may scroll for BOARD
  size, never for TEXT; header+galdr ≤ ~180px of the 844px viewport.
- Focal luminance ≥2.2× field mean on every screen (script to verify).
