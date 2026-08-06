# OW-SCORE — progression score: music.act(n) (AUDIO.md v2, CONTRACT §1 v2)

Complete, gates green (VALHALLA, 2026-08-07). Files: src/audio/music.js (rewrite), src/audio/index.js
(+act wrapper), tests/unit/audio.test.mjs (+9 tests), artifacts/wip-score/**.

## What shipped
- `music.act(n)`, n∈{1,2,3}: additive, idempotent, no-op pre-enable/invalid n; lazy per-act fetch
  (act2.mp3 untouched until act(2)); the current act keeps playing until the target is decoded and
  seam-baked, then a 2.5 s equal-power crossfade (setValueCurveAtTime sin/cos, per-track level).
- Per-track prepare(), v1 pipeline refactored, uniform: −60 dBFS trim → steady-body scan →
  morph-exit + wrap-level matching (0.05 dB/window move penalty, 0.75 dB hysteresis — loops stay
  whole) → 2.5 s baked tail-into-head morph (v1's 0.5 s stepped up to 2.4 dB on some wraps) → two
  entries: soft handoff entry (drone was tuned against act1's soft build) and body-level
  act-crossfade entry (±1.5 dB run, ±3 dB cap, 8 s hold, earliness penalty); credits enters at
  loopStart — its v1 opening, just past the bake.
- Level seating: acts 2/3 gain = MUSIC_LEVEL·10^((REF−body)/20) clamp ±6 dB; REF −13.62 dBFS = act1
  loop-body median via Chromium decode (drift gated ±0.35 dB, measured −0.02); act1 and credits stay
  exactly at MUSIC_LEVEL 0.24. Duck/mute/drone/failure rules shared across acts, v1 intact.
- ready reflects the current act; start() resumes the current act (fading live credits); credits()
  fades whatever act is live, now idempotent; stop() mid-switch keeps the selection; plain-JS act
  state + frozen-clock scheduling, so iOS suspend/resume loses nothing. Intentional v1 deltas (leak
  fixes): stop() mid-fetch stays stopped on land; start() over credits no longer leaks a source.

## Measurements (artifacts/wip-score/: metrics.json, table.txt, render.mjs, probe.mjs — 28/28)
crossfades, 0.4 s env vs equal neighbourhoods (bars dip≤3/bump≤2; neg = inside bar): act1→2
  −3.20/−3.67 dB · act2→3 −6.74/−0.63 dB · seams (flux ≤ own p95 / dRMS ≤ 2 dB): a1 .50×/−.46 · a2 .78×/+.41 · a3 .85×/−1.36 · cr .40×/+.05
prepare() worst-of-3, deterministic across decodes (bar <80 ms): 46.8 / 18.1 / 17.6 / 23.6 ms
drone→act1 handoff regression (OW-FABLE-B bars): hole −0.25, wall −0.74, steady +1.50 dB (v1 +1.01)

## Shell patch (lead applies at integration — NOT applied by me)
src/shell/index.js, beginGesture (~line 83), REPLACE `audio.music?.start?.();` with:
      audio.music?.act?.(save.opened.includes('12-veitsla') ? 3
        : save.opened.includes('06-jotunvillur') ? 2 : 1); // act BEFORE start: loads fetch only the saved act
      audio.music?.start?.();
src/shell/screens/lockroom.js, runYieldBeat, directly after `audio.motif('yield');` (~line 351):
      if (lock.id === '06-jotunvillur') audio.music?.act?.(2);
      else if (lock.id === '12-veitsla') audio.music?.act?.(3);
credits onSkip (shell/index.js:173) needs no change — start() already resumes the current act.

## Commands (exit codes)
node --test tests/unit/audio.test.mjs → 0, 38/38 (all 29 v1 asserts intact) · npm test → 0 ×3,
  289/289 · npm run build → 0, 1,580,904 B vs v1-baseline rebuild 1,578,331 B (+2,573 B, +0.16%;
  mp3s fetched, never inlined) · node artifacts/wip-score/render.mjs → 0, 28/28. Caveat: a locks-
  suite handle leak (pre-existing) left `node --test` children that once double-counted a run
  (290/287 + phantom veitsla fails); after pkill, 3× clean. Not audio-related.
