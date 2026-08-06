# OW-CHAPTERS — gauntlet narrative: duels data · lid banners · threshold wager + chest

State: complete in owned lanes; lockroom re-key handed off as an exact patch (I may not edit lockroom.js).

Files
- `src/shell/duels.js` — GAUNTLETS: 5 jarls × {locks, dareAt 01/04/07/10/13, heckleAt 02/05/08/11/14,
  yieldAt 03/06/09/12/15}, taunt/heckle/yield/title ×en/es/ca VERBATIM from docs/JARLS.md v3; WAGER ×3;
  accessors gauntletFor/dareFor/heckleFor/yieldFor/lineFor/journalHasLine; chapter word GAUNTLET/DESAFÍO/REPTE.
  Legacy DUELS/duelFor shim kept byte-compatible (v2 lines at 3/6/9/12/15) so un-patched lockroom, current
  e2e helpers, and unit tests stay green — delete it in the lockroom-patch integration (keep DUEL_CAST: credits).
- `src/shell/screens/lid.js` — per-jarl blood ribbons spanning THEIR three medallions (desktop row-wrap →
  fold-under cut segments; swallow-tails + hanging pennants at row edges only; seeded cloth folds; abstract
  seeded knot device; done/active/future states), small-caps chapter labels (real DOM text, lang-resolved);
  the armed gauntlet's label carries `.duel-banner` (exactly 1 visible — e2e contract). Wordmark echo,
  wear×2, chip border, corner rosettes on a static deco canvas (zero per-frame cost). Wager journal echo +
  "JARL BOURJ bars the first lock." note, journal-derived idempotence across all three languages.
  Medallion/journal/settings aria-label prefixes untouched.
- `src/shell/screens/threshold.js` — chest presence in the lower field (silhouette, hearth pool, dome rim
  light, straps/rivets/hasp glint, drifting motes — static under reduced motion, deeper vignette, flanking
  wainscot rails, wear/chip/rosette dead-zone kit); subtitle localized (frozen es/ca); wager card after the
  begin gesture: carved panel + frozen WAGER text, tap/Enter continue, focus-trapped, reduced-motion-safe;
  shown iff the stored journal lacks the wager line in any language — always re-framed on Begin anew.
  `save.settings.lang` read defensively via resolveLang (locale switcher already landed in overlays.js).
- `artifacts/wip-chapters/lockroom.patch.md` — 6 exact old/new edits: re-key to dareFor/heckleFor/yieldFor,
  heckle header line + one journal note on 02/05/08/11/14, `.heckle-line` css. Lead applies at integration.
- `artifacts/wip-chapters/capture.mjs` + `*.png` — real-input evidence + density harness (dSF2, both framings).

Gates at my boundary (2026-08-07 00:40)
- `npm test` 287/290 — the 3 fails are all `src/locks/12-veitsla.js:1542` (`window` undefined at mount under
  Node), file rewritten 00:38 tonight by the locks lane (concurrent, outside my paths); duels/shell suites
  green; the same suite was 281/281 before that rewrite. `npm run build` green (1.49 MB single file).
- smoke 2/2 · journey 2/2 GREEN · floors 2/2 GREEN — QA's helpers.mjs (00:31) already clicks through
  'Take the wager' (tolerant when absent), so no journey red exists today; note helpers pin that label.
- Evidence: density (largest contiguous featureless / detail): threshold 15.0%/46.1 desktop, 15.0%/64.7
  phone; lid 14.4%/56.9, 3.5%/75.6 — ≤18% gate passes everywhere (55% furniture bar is puzzle-panel
  oriented; desktop threshold's 46.1 reported as-is). Wager text contrast 12.45/12.94:1; continue button
  227×51 / 210×48. Once-only held across reload; console clean incl. reduced-motion run.

When lockroom.patch lands (lead owns tests): helpers derive DARE/HECKLE/YIELD orders from GAUNTLETS;
expectDareCard → dareAt ordinals with g.taunt.en; resolveCeremony yield overlay only at yieldAt with
g.yield.en; floors' lock-3-dare step becomes lock 1; add a `.heckle-line` assert at 02/05/08/11/14.
Notes: (1) the wager echo persists on the next natural writeSave — quitting before any persist re-shows the
card (journal-derived heuristic as railed); optional 1-liner: beginGesture calls persist() after after().
(2) Chrome wording I authored awaits sign-off: THE WAGER / LA APUESTA / L'APOSTA · Take the wager /
Acepta la apuesta / Accepta l'aposta (GAUNTLET/DESAFÍO/REPTE were coordinator-frozen).
