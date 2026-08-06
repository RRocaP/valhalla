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

Deploy target: public repo `RRocaP/oathwood`, GitHub Pages from `main` root,
built `index.html` committed. Treasure asset expected at `assets/tebi.jpg`
(Ramon to supply; build tolerates absence).
