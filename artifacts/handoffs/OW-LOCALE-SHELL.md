# OW-LOCALE-SHELL — shell trilingual (en/es/ca), CONTRACT §4.1 amendment

## Files
- NEW `src/shell/strings.js` — SHELL_STRINGS: **61 keys × 3 langs = 183 strings** (en 61 / es 61 / ca 61, zero fallback gaps; frozen JARLS.md lines verbatim, straight apostrophes). Also `LANG_NAMES`, `ordinalWordLang(n,lang)` (es feminine for «cerradura», ca masculine for «pany»).
- `src/shell/save.js` — additive `settings.lang` kept only when valid; `loadSave(storage, now, nav)` defaults it via `resolveLang` ONLY when nav is passed → legacy Node tests keep exact round-trip shape.
- `src/shell/index.js` — effective lang = `#autotest ? 'en' : resolveLang(save.settings.lang, navigator.language)`; `tr()` bound over SHELL_STRINGS; `#app[data-lang]` driver hook; journal lines localized; lang survives Reset chest; `lang`+`tr` now passed to ALL five screens + both overlays (hands-off screens may consume them as props).
- `src/shell/overlays.js` — journal + settings fully tr()'d; NEW language row: 3 carved plates EN/ES/CA (`.lang-btn[data-lang]`, ≥44px, active gold-struck, radiogroup, aria-label = language's own name). Switch → index.js `setLang`: persist, journal echo in NEW language («El salón ahora habla español.» / «La sala ara parla català.»), live re-render of screen behind + reopen panel focused on struck button.
- `src/shell/screens/finale.js`, `credits.js` — every string tr()'d (treasures/colophon frozen; VALHALLA/JARL RAMON/track titles literal).
- `src/shell/style.js` — `.lang-row/.lang-btn` (carved, struck state); `.settings-row` + `.confirm-row` flex-wrap for long es/ca labels at 390px.
- NEW `tests/e2e/locale.spec.mjs` — 3 tests × 2 projects: ca boot (frozen subtitle) → CA struck → live es swap (persist + echo + subtitle) · completed-chest es finale/credits (longest strings, no h-scroll at 390) · #autotest forces en over a ca save. 8/8 in ~5s. Structural selectors only.

## INTERIM SHIM (lead: remove at integration)
`index.js` goTo('threshold') sets `.subtitle` text via `tr('threshold.subtitle')` post-mount — the one localized threshold line my gate pins. Delete when threshold.js consumes the key itself.

## Keys the hands-off screens must consume (translations ready in strings.js)
- threshold.js: `threshold.begin/continue/beginAnew/beginAnewConfirm` (+subtitle replaces shim). Buttons still English in real-player langs today (see threshold-ca-iphone.png).
- lid.js: `lid.openJournal/openSettings/lockLabel/state.open|next|sealed/barsJournal` + `ordinalWordLang`. "Lock {n}:" prefix holds under #autotest (forced en); recommend `data-ordinal` on `.medallion-hit` if QA ever drives non-en.
- lockroom.js: `lockroom.back/attempts/hint/hintTaken/hintAvailable/hintLocked/answerDare/shardSealed/shardSealedPlain`, `journal.hornSounded/lockOpened/lockOpenedPlain/dared/yields`, `common.continueHint/skipHint` — and pass `ctx.lang` (already arriving as mount prop `lang`) into lock.mount per §4.1.
- duels.js: taunt/yield/wager/heckle es/ca live in JARLS.md (NOT duplicated in strings.js — single source). Note: Ärya's name field carries English "— the last" (shows in es/ca credits, credits-es-iphone.png).

## Commands + exit codes
- `npm test` → clean-tree run exit 0 (290/290); final run exit 1 — 3 fails ALL `ReferenceError: window` in `src/locks/12-veitsla.js:1477` (LOCKS-C sibling mid-write; every shell/save/journal/duels/numerals test green). Also one earlier one-off flake in audio.test.mjs (act3), passed on rerun ×2.
- `npm run build` → exit 0, 1.39 MB ≤ 2.0 MB.
- `npx playwright test tests/e2e/smoke.spec.mjs tests/e2e/locale.spec.mjs` → exit 0, 8/8 (~5.5s).
- floors.spec: red from sibling mid-writes only, failure point moved between runs (lock-01 rewrite vs QA 'Set the row' driver → wager card vs QA `beginFromThreshold`); shell-owned floors steps (threshold contrast, lid touch targets, h-scroll) passed before those points. Nothing in this diff touches those files.

## Evidence
`artifacts/wip-locale-shell/*.png` — 16 shots, both viewports: threshold ca/es, settings ca/es (switcher struck, no clipping), finale tebi/ålanø/tableau es (longest frozen lines wrap clean), credits es.
