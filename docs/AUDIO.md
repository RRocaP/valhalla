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
  drone: { start(), stop(), intensity(x) },  // x∈[0,1]: brightness/level with progress
}
```

Scale discipline: everything melodic lives in A minor pentatonic (A2–A4 range)
so overlapping cues never clash. `deny` is non-musical (dull wood thud + short
low buzz), never a "wrong answer" jingle.

Determinism not required here (view layer), but keep every voice allocated per
call and released — no node leaks; validate with repeated play in tests
(construct with a mocked AudioContext; a tiny mock is fine in unit tests).
