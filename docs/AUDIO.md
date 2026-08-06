# AUDIO DIRECTION + AUDIO API — frozen surface, AUDIO worker owns implementation

WebAudio synthesis only. No samples, no files. Master chain:
`voices → per-bus gains → compressor → master gain → destination`.
Autoplay-safe: nothing constructs an AudioContext until `enable()` is called
from a user gesture; every public call is a no-op before that and after
`setMuted(true)` (except state setters).

## Aesthetic

Cold hall, warm hearth. A low tagelharpa-like drone (bowed string: detuned saw
pair → bandpass ~180–400 Hz → slow LFO on filter + amplitude, breath noise
underneath). Plucked lyre for interaction (Karplus-Strong or filtered
triangle-decay), skin drum (160→55 Hz pitch-droped sine + noise thump) for
weight, a lur-like brass swell (soft-clipped harmonic stack, 2.5 s) reserved
for unlocks. Wood: every UI touch is a wooden sound (knock/tick — short
filtered noise bursts with body resonance ~700 Hz). Nothing shrill; keep the
top end dark. Loudness discipline: UI −18 LUFS-ish relative feel, unlocks may
bloom briefly. Long silences are allowed — the hall breathes.

## API (FROZEN — implement in `src/audio/index.js`)

```js
export function createAudio() => {
  enable(),            // build context + graph; call only from a gesture
  enabled,             // boolean getter
  setMuted(b), muted,  // persisted by shell
  ui(kind),            // 'tick' | 'knock' | 'slide' | 'deny' | 'confirm' | 'flip'
  motif(kind),         // 'shard'  – rising 3-note lyre arpeggio (pentatonic minor)
                       // 'unlock' – drum hit + lur swell
                       // 'hint'   – two low lyre notes, falling
                       // 'chest'  – finale: drum triplet, full lur chord, drone blooms
                       // 'dare'   – low horn challenge, two notes, held (a challenger steps up)
                       // 'yield'  – drum hit + falling third, resolving (the challenger bows)
  drone: { start(), stop(), intensity(x) },  // x∈[0,1]: brightness/level with progress
  music: { start(), credits(), stop(), ready,
           act(n) },  // v2 (additive, 2026-08-06): n∈{1,2,3} selects the
                      // progression track (music.mp3/act2.mp3/act3.mp3);
                      // equal-power crossfade ~2.5s between acts; idempotent;
                      // lazy-fetches the target, keeps current playing until
                      // the new buffer is ready; same body-loop + baked-seam
                      // discipline per track as v1. Shell calls it from the
                      // yield beats of locks 06 and 12 (and on load by save
                      // progress). Failure of any fetch degrades per v1 rules.
}
```

## Music module (FROZEN addition — the roca-airways pattern)

Two same-origin files: `./music.mp3` (gameplay, **loops exquisitely**) and
`./credits.mp3` (credits screen). Rules:

- Lazy: first `music.start()` (post-`enable()`) fetches + `decodeAudioData`s
  `music.mp3` in the background; the synth drone keeps playing until the
  buffer is ready, then crossfades out (~2 s) as the music fades in. `ready`
  is a boolean getter.
- **The exquisite loop**: play via `AudioBufferSourceNode` with `loop = true`
  and `loopStart`/`loopEnd` chosen after trimming edge silence (scan the
  decoded buffer for first/last samples above ~−60 dBFS); overlay an
  equal-power crossfade of the tail into the head so the seam is inaudible
  (either the loopStart/loopEnd overlap technique or a twin-source crossfade
  scheduler — your call, but the loop must have no gap, click, or lurch).
- `music.credits()`: fade gameplay loop out (~1.5 s), fetch/decode
  `credits.mp3` if needed, play it (loop with the same care); used by the
  credits screen. `music.stop()` fades everything musical out and lets the
  drone return.
- Music routes through its own bus gain under the same master/mute; motifs
  duck the music bus ~3 dB during their sound and release after.
- Any fetch/decode failure: silent fallback to the drone, one journal-safe
  no-op (never throw, never retry-spam; one retry on next start() call is fine).
- Autoplay discipline unchanged: nothing before `enable()`.

Scale discipline: everything melodic lives in A minor pentatonic (A2–A4 range)
so overlapping cues never clash. `deny` is non-musical (LOW felted thud + brief sub drop — never a buzz; amended 2026-08-07 with the felted rework; no square/saw waves in any UI voice, unit-enforced). It was: (dull wood thud + short
low buzz), never a "wrong answer" jingle.

Determinism not required here (view layer), but keep every voice allocated per
call and released — no node leaks; validate with repeated play in tests
(construct with a mocked AudioContext; a tiny mock is fine in unit tests).
