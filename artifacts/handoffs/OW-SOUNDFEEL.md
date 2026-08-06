# OW-SOUNDFEEL — the 90s-RTS SFX layer is gone

State: 72/72 render checks (artifacts/wip-soundfeel/metrics.json), 294/294 unit (43 audio), build exit 0.
Files: src/audio/{voices,index,music}.js · tests/unit/audio.test.mjs · artifacts/wip-soundfeel/{render.mjs,metrics.json,handoff_rms.png,act12_rms.png}.

DELETED: denyBuzz (square buzzer) — nothing buzzes, ever (unit-enforced: no square/saw in any ui voice);
single-bandpass woodHit and the woodFlip blip; clicky setValueAtTime onsets; score-ducking on trivial touches.

SURVIVORS, and why each earns its place
- knock (placement), confirm (submit, two felted knocks), deny (wrong): the three touches that mean something.
  All are noise through 2-3 inharmonic wood modes (~180/700/1150 family), 3-6 ms felted attacks, dark tops;
  deny = LOW thud (modes 112/330/560) + brief 66→44 Hz sine sub drop — consequence, not a scolding.
- tick/slide/flip: demoted to ~-42 dBFS felt textures — motion feel in a silent hall, invisible under music, no duck.
- motifs (shard/hint/unlock/dare/yield/chest) mark real events; darker (brightness ≤1500), quieter, lur entries breathe (0.6-0.9 s).
- ONE shared small-hall room: synthesized 0.9 s dark decaying IR in a ConvolverNode, ui+voice bus sends only;
  knock tail-energy 2.6% (≤20% gate), audibly rings 0.65 s — the room is why synthesis stops reading as beeps.

LEVELS dBFS before→after (wip-fable-b → wip-soundfeel metrics): uiBus 0.6→0.19 (~-10 dB), voiceBus 0.9→0.7.
tick -23.8→-44.2 · slide -23.0→-43.0 · flip -22.6→-41.9 · knock -21.7→-27.7 · confirm -21.6→-30.0 ·
deny -21.7→-26.3 (centroid 71 Hz) · shard -17.1→-27.0 · hint -18.4→-22.6 · unlock -13.1→-15.6 ·
dare -12.7→-15.3 · yield -18.7→-25.3 · chest -7.3→-10.7. Every voice: HF>4 kHz ≤ -25 dB rel, hit attacks ≤ 5 ms.

RAMON ADDENDUM (done): act order remapped 1→act3.mp3 (Windswept Silence) 2→music.mp3 3→act2.mp3; every act
seated to one body loudness (measured spread 0.00 dB); FIRST entry is a 4 s exhale — drone lingers (hold 1.6 s,
tc 1.3), entry point biased to the calmest early passage; act 1→2 and 2→3 crossfades hole/wall-free at the 1 s
musical scale; loop seams inaudible on all four files. Autoplay/mute/act-system behaviors unchanged (unit-proven,
incl. suspended-iOS, save-resume, and fetch-failure paths).

NOTE for integration: docs/AUDIO.md still says deny carries a "short low buzz" and implies the old act order —
contract text amendment stays with Ramon per the addendum.
