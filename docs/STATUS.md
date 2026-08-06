# STUDIO STATUS — OATHWOOD

Lead: Fable (this session). Integration: lead only. Workers write only their
owned paths (CONTRACT §3), run `npm test` + `node scripts/verify.mjs --partial`,
and leave a handoff at `artifacts/handoffs/<task>.md`. Workers do not run git.

| Task | Model | Owner paths | State |
|---|---|---|---|
| OW-KERNEL | fable (lead) | docs, kernel, build, scripts, main | done (base) |
| OW-ART | sonnet | src/art/** | dispatched |
| OW-AUDIO | sonnet | src/audio/** | dispatched |
| OW-SHELL | sonnet | src/shell/** | dispatched |
| OW-LOCKS-A | opus | src/locks/01–05*, tests/unit/locks-01-05 | dispatched |
| OW-LOCKS-B | opus | src/locks/06–10*, tests/unit/locks-06-10 | dispatched |
| OW-LOCKS-C | opus | src/locks/11–15*, tests/unit/locks-11-15 | dispatched |
| OW-QA | sonnet | tests/e2e/** | queued (post-integration) |
| OW-REV-1 (base/gates) | opus | review; fix rights on scripts/verify.mjs, build.mjs only | dispatched |
| OW-REV-2 (locks logic) | opus | review-only, post-handoff | queued |
| OW-REV-3 (art/shell/audio) | opus | review-only, post-handoff | queued |

Wave-1 note: all six workers inherited plan mode 2026-08-06, filed plans,
resumed with approvals + rulings (see docs/JARLS.md, AUDIO music module,
SHELL credits — added while they were paused).

Deploy target: public repo `RRocaP/oathwood`, GitHub Pages from `main` root,
built `index.html` + `music.mp3` + `credits.mp3` committed. All portraits +
treasure + credits assets present under `assets/`.

## Wave 2 (2026-08-06 afternoon)

| Task | Model | Owner paths | State |
|---|---|---|---|
| OW-QA | sonnet | tests/e2e, artifacts/screens+reference | dispatched (early, tolerates 07/in-flight shell) |
| OW-FABLE-A | fable max | src/locks/01–05 + its tests (lane handed over) | dispatched — feel/detail/prose/fairness notch |
| OW-FABLE-B | fable max | src/audio + its tests (lane handed over) | dispatched — measured mix/musicality/loop-seam notch |

Integrated so far: OW-LOCKS-A (db40935), OW-REV-1 fixes (db40935), OW-AUDIO (16bf2aa).
Pending: LOCKS-B (07 red), LOCKS-C views/tests, ART iterations, SHELL screens, REV-1 gates.test re-home.
Quality wave (Opus, per docs/QUALITY.md) fires after full assembly.
