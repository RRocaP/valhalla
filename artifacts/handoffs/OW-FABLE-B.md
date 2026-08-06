# OW-FABLE-B handoff — sound one notch above

**State:** done. Frozen API untouched; all tuning inside src/audio/**. Measured in real
Chromium (OfflineAudioContext 48 kHz) via `artifacts/wip-fable-b/render.mjs`; 60/60 targets pass.

## Per-target measurements (before -> after)
| Target | Before | After |
|---|---|---|
| Pluck stability | KS loop gain >1: shard rang UP to **+15.0 dBFS**, compressor slammed 55.7 dB | -17.1 dBFS, lyre ring-down |
| Pluck tuning | all plucks flat by 128-sample cycle quantum (A3 rang ~139 Hz) | shard 220.6/262.1/330.3 Hz (<=0.3% of A3/C4/E4) |
| yield falling third | 456>456 (no interval) | 262.5>221.6, ratio 1.184 |
| hint two low notes falling | 508>634 (rising, wrong) | 147.7>110.6 (D3->A2) |
| drum sweep 160->55 | ok | 139 Hz @20ms -> 68 Hz @150ms |
| UI duration 60-120 ms | tick 35, slide 150 ms | all six 74-97 ms |
| UI peaks (audible, <=-12) | -28..-47 dBFS (inaudible vs motifs) | -21.6..-23.8 dBFS; HF>6k all <=-36 dB |
| deny dull thud | centroid 102 Hz | 112 Hz; deny/yield centroid ratio 3.5; non-musical by test |
| lur bloom 300-600 ms | 393 ms | 319 ms; centroid 180 Hz < 2 kHz |
| drone evolution ±1.5-3 dB | 5.7-7.2 dB seasick wobble | 3.4 dB breath (all intensities) |
| drone intensity steps | 0.20/0.11 dB (collapsed) | 2.5/1.7 dB level + 17%/16% centroid |
| drone/chest peaks | -5.5/-2.6 dBFS | -12.9..-17.2 / -7.3 dBFS, chest tail 6.4 s |
| duck -3 dB@50ms / release | 2.95 dB, over-duck 55.7 dB, release 1.15 s | 2.8 dB, max 3.07, release 0.46 s |
| drone->music handoff | **15.65 dB hole** (+5.2 bump at old level) | no hole/wall (margins 0.04/0.24 dB), music +1.25 dB vs drone |
| music.mp3 loop seam | **24.5 dB lurch**, head double-played | flux 0.54x p95, join step 0.77 dB (credits: 0.42x, 1.15 dB) |

## Changes (one line each)
- voices.js pluck: feedback 0.98->0.955 + damping Q=-6 dB — WebAudio lowpass Q is in dB; default +1 dB bump made loop gain >1 (rang up, not down).
- voices.js pluck: delayTime now compensates the 128-sample feedback-cycle quantum + biquad lag — everything finally rings ON pitch.
- voices.js drone: unequal detuned pair (2nd bow 0.3 @ +7c) — equal pair beat-NULLED at 0.57 Hz (the 6-10 dB wobble); LFO depths 0.04/25 Hz, Q fixed 0.8, center 230-350 off the harmonic comb, one gain map `droneGainFor`.
- index.js: compressor to safety-only (-6/5/5/3ms/250ms) — Chrome defaults crushed the intensity design and pumped the whole mix under every voice.
- index.js: ui gain/decay table re-measured (wood answers at -21..-24 dBFS, 74-97 ms, dark top end).
- index.js motifs: hint lowered to D3->A2 (private, register-separated from yield); dare is now a staggered two-note held horn call; lur/drum trims (tanh saturates at ±gain).
- music.js: loop-region scan (steady body within 6 dB of median RMS) + loopStart placed AFTER the baked head — wrap is sample-continuous; old code looped back into the quiet intro and replayed the head every pass.
- music.js: playback enters at region start (8.25 s in; intro skipped by design — it was the 15.7 dB handoff hole), MUSIC_LEVEL 0.24, staggered drone fade (t+0.7, tc 0.8), duck tc 0.015/0.28.

## Commands + exit codes
- `node artifacts/wip-fable-b/render.mjs` -> 60/60 checks, exit 0 (writes metrics.json + pngs)
- `node --test tests/unit/audio.test.mjs` -> 29/29 pass, exit 0 (25 kept incl. all behavioral asserts; 2 loop-point expectations updated to the new seam law; +4 new)
- `npm test` -> 272/272 pass, exit 0; `npm run build` -> exit 0, index.html 1,097,746 B; bundle greps confirm `.955`/`playStart`/`regionStart` shipped
- New tests: ui envelope schedule; deny non-musical + yield tuned C4->A3 (pins the quantum-compensation law); duck timing law; committed music.mp3 seam flux<=p95 via afconvert (0.6 s; skips cleanly off-macOS).

## Evidence
`artifacts/wip-fable-b/`: metrics-before.json (baseline), metrics.json (final), render.mjs,
drone_rms.png, handoff_rms.png, duck_track.png, seam_flux.png.

## Limitations
- No human ear pass (QUALITY.md still requires the 3-minute browser listen; all numeric prerequisites now hold).
- Handoff hole margin is 0.04 dB — deterministic in OfflineAudioContext but worth an ear at the drone->music moment.
- Gameplay/credits never play the mp3s' first ~8 s fade-in intro (deliberate: it hollowed the handoff and lurched the loop).
