# OW-AUDIO handoff

**State:** done. Frozen API implemented incl. addendum (`dare`/`yield` motifs,
streamed `music` module). No git, no installs, no path outside my ownership.

## Files
- `src/audio/index.js` — replaced stub: graph, dispatch, drone, music wiring.
- `src/audio/voices.js` (new) — synth voices, A-minor-pentatonic table, `clamp01`.
- `src/audio/music.js` (new) — lazy fetch+decode, silence trim, seamless loop, ducking.
- `tests/unit/audio.test.mjs` (new) — 25 tests, hand-written mock AudioContext.
- `artifacts/wip-audio/preview.html`, `artifacts/wip-audio/preview.png`.

## Commands + exit codes
- `node --test tests/unit/audio.test.mjs` → 25/25 pass, exit 0.
- `npm test` (repo-wide, post-fix) → 94/94 pass, exit 0.
- `npm run build` → exit 0, `index.html` 997,500 bytes (0.95 MB), 15 locks, no external URLs.
- Browser check: served via `node scripts/serve.mjs` (killed after), drove
  `artifacts/wip-audio/preview.html` with Playwright (real Chromium, not the
  unit mock) through enable → all 6 `ui` kinds → all 6 `motif` kinds (incl.
  `dare`/`yield`) → drone intensity/stop/start → mute toggle → `music.start()`
  (real `music.mp3` fetch+decode, `ready` became `true`) → `music.credits()`
  (switched to `credits.mp3`) → `music.stop()`. Console errors: 0. Screenshot
  saved to `artifacts/wip-audio/preview.png`.

## Judgment call (flagged, approved as filed)
`setMuted` silences via **master-gain-to-0**, not call-gating: `ui()`/`motif()`
still allocate/schedule while muted, just inaudible. Chosen because it avoids
a drone/music restart-glitch on unmute and keeps one code path. Pre-`enable()`
remains a hard no-op (no `ctx` ever constructed) — that part is not negotiable.

## Loop-point mechanics (music.js)
1. `findLoopBounds`: scan every channel for first/last sample ≥ −60 dBFS →
   trims encoder silence padding.
2. `bakeSeamlessLoop`: bakes an **equal-power** crossfade (cos/sin, ~0.35s)
   of the tail into the head, in place on the decoded buffer — the native
   `loopStart`/`loopEnd` splice is then inaudible without a twin-source
   scheduler. Verified numerically in tests (midpoint blend = `0.5·√2` for
   two equal-amplitude regions, matching equal-power math).
3. Playback: one `AudioBufferSourceNode`, `loop=true`, started at `loopStart`
   (no lead-in silence on first play).
4. Handoff: drone plays until `music.ready`, then crossfades to 0 over ~2s
   as the loop fades in; `music.stop()` reverses it (drone restored to its
   intensity-mapped level); `credits()` is a pure music→music handoff (fades
   gameplay out immediately, fetches/bakes/plays `credits.mp3` the same way)
   — doesn't touch the drone, per spec.
5. `ui()`/`motif()` duck the music bus ~3dB (`cancelScheduledValues` +
   `setTargetAtTime` down, then up after a hold — 0.15s for ui, 0.8s for
   motif) via an internal `duck()` not exposed on the public `music` object.
6. Fetch/decode failure (network, HTTP status, or corrupt decode): caught
   internally, never throws, `ready` stays `false`; next `start()`/`credits()`
   call retries cleanly (no permanent-failure flag, no retry-spam loop).

## Limitations
- No real-ear listening pass (browser check confirmed real `music.mp3`/
  `credits.mp3` decode + loop + crossfade wiring fires correctly and
  console-clean; qualitative mix/level judgment deferred to integration).
- Bus gain levels (UI/voice/drone/music, duck depth) are formula-and-topology
  verified, not ear-tuned.
- `slide`/`flip`/`confirm` timbre choices are my interpretation — the
  contract names only `tick`/`knock`/`deny` explicitly.
