# OW-SHELL handoff

**State:** Complete per docs/SHELL.md as amended through the VALHALLA-title
pass (portraits/duels/two-treasure-finale/credits+stickers, then the rename —
all re-verified against real files, not just the chat claims, before
building). Save, progression, hints, journal, settings, all five screens
(threshold/lid/lockroom/finale/credits), duel dare/yield beats, `#autotest`
hook: wired and verified against fixtures and the real 15-lock build.

**Files:** `src/shell/{index,save,progress,journal,numerals,duels,portraits,
dom,style,overlays}.js`, `src/shell/screens/{threshold,lid,lockroom,finale,
credits}.js`, `tests/unit/shell.test.mjs` (26 tests, pure/DOM-free), `artifacts/
wip-shell/{fixtures.js,dev.html,_shoot.mjs,_shoot_real.mjs,shots/*.png}`.

**Commands (all exit 0):** `node --test tests/unit/shell.test.mjs` 26/26 ·
`npm test` (repo-wide) 268/268 · `npm run build` 1.03 MB, 15 locks bundled ·
`_shoot.mjs {v1,v2,v3}` / `_shoot_real.mjs {v1,v2,final}` — scripted real-input
walkthroughs (Playwright MCP had no reachable CDP endpoint on :9222 here, so I
drove `chromium.launch()` directly). Final real-page pass: 0 console errors, 0
failed/4xx/5xx requests, no horizontal overflow at 390px. `npx playwright test
tests/e2e/smoke.spec.mjs`: 1 known non-mine failure (below).

**Evidence:** `artifacts/wip-shell/shots/` — 72 PNGs, 3 look-iterate cycles
(`-v1/-v2/-v3`): threshold, lid, lockroom, wrong-answer, hint arm/take, shard
ceremony, dare card, yield beat, both finale reveals + tableau, credits
(scroll + stickers), journal-with-content, settings, plus `real-*` shots of
the actual build (mobile + desktop).

**Bugs found and fixed while verifying (not just claimed-green):** shard rune
wasn't rendering — was keying the frozen kernel `SHARDS` table by `lock.id`
(only knows real `01..14`); switched to `lock.shard(instance)` per the actual
Lock interface, correct for real and fixture locks alike. Large empty gap
under short puzzle content in every lock room — `.lock-root` wasn't
vertically centering; added flex+justify-content. Overlapping text in the
finale's Ålanø reveal — `skip-hint` class was shared between the
viewport-pinned intro hint and the inline per-reveal continue hint; split in
two. Fixed an esbuild import-path bug in overlays.js.

**Flagged for lead, not mine to fix:**
1. Two scope-widening addenda landed mid-task; verified each against real
   files first. A third would risk non-convergence — recommend stabilizing
   before the next pass.
2. CONTRACT.md §1 still reads "no named real person... no story about
   anybody" directly above a paragraph naming `assets/ramon.jpg` — unresolved
   contradiction in a LEAD-owned frozen doc.
3. `tests/e2e/smoke.spec.mjs` (QA-owned) asserts `/OATHWOOD/`; real title is
   now "VALHALLA — Fifteen Locks of the Northmen" per the rename.

**Scoped down given time budget:** finale's 2.6s lid-opening intro uses a
flat-fill rotating panel, not `paintWood`-textured (every steady-state screen
is); material-type mandate done via CSS relief-shadow everywhere rather than
also layering canvas `art.carveText()` on the three "full depth" call-outs;
Folklore's yield line uses JARLS.md's authorized fallback line, not the
dynamic boaster-name substitution (would need LOCKS-C's undocumented instance
shape); credits sticker-fall verified structurally (no crash, graceful empty
pool) but not visually with real photos. `art.sticker`/`art.portrait`/
`audio.music.*` are all feature-detected and degrade gracefully if a
dependency lags behind.

No git actions taken.
