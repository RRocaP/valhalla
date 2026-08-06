# OATHWOOD — FROZEN TECHNICAL CONTRACT v1

Do not change anything in this file. If a lock cannot be built within it, stop and
report to the lead rather than widening the contract.

## 1. Product

`OATHWOOD — Fifteen Locks of the Northmen`. A carved oak sea-chest with fifteen
locks. The player opens them in order. Viking Age (793–1066). There is **no**
travel framing, no itinerary, no boarding, no named real person, no dedication,
no story about anybody. The only fiction is the chest and the locks.

Ship target: **one self-contained `index.html`** at the repo root, deployed by
GitHub Pages. No network requests at runtime. No external fonts, images, audio
files, CDNs, or analytics. Everything procedural or inlined.

**Non-procedural assets (all supplied by Ramon, all inlined at build time):**
the five challenger portraits (`assets/jarls/*.jpg` → `src/kernel/portraits.gen.js`),
the credits portrait (`assets/ramon.jpg`, same module), and the treasure
(`assets/tebi.jpg` → `src/kernel/treasure.gen.js`) — *Tebi the Osteopath*,
revealed when all fifteen locks open. Any absent file degrades to a carved
placeholder; the build never breaks on a missing portrait.

**Sound track exception (the roca-airways pattern):** two committed sibling
files, `music.mp3` (gameplay loop — Frostbound Lullaby) and `credits.mp3`
(Hjá Vindi), are the ONLY permitted runtime fetches, same-origin relative
paths only. If either fetch or decode fails (offline `file://`, blocked
autoplay), the game remains fully playable and the synthesized drone carries
the score. Everything else stays inlined in `index.html`.

## 2. Runtime constraints (hard)

- Vanilla ES modules bundled by esbuild into a single inline `<script>`.
- Rendering: DOM + Canvas 2D. **No WebGL, no three.js, no framework, no runtime deps.**
- Audio: WebAudio synthesis only. No audio files.
- Fonts: system stacks only (see `docs/ART.md`). No webfonts.
- Built `index.html` must contain zero occurrences of `http://` or `https://`
  outside of `<!-- -->` comments and the `xmlns` attribute. Enforced by `npm run verify`.
- Total built size budget: **≤ 2.0 MB**. Warn at 1.5 MB.
- Must run offline, from `file://` and from a static server, on desktop Chrome,
  Safari, Firefox, and on iOS Safari at 390×844.
- 60 fps target on an M-series Mac; no frame over 32 ms during idle board render.

## 3. Directory ownership

Ownership is exclusive. **A worker writes only inside its own paths.** Touching a
path you do not own is a rejected handoff, even if the change is correct.

| Path | Owner |
| --- | --- |
| `docs/**`, `build.mjs`, `scripts/**`, `src/kernel/**`, `src/main.js`, `index.html`, `package.json` | LEAD only |
| `src/art/**` | ART worker |
| `src/audio/**` | AUDIO worker |
| `src/shell/**` | SHELL worker |
| `src/locks/01..05*` | LOCKS-A worker |
| `src/locks/06..10*` | LOCKS-B worker |
| `src/locks/11..15*` | LOCKS-C worker |
| `tests/unit/locks-01-05.test.mjs` etc. | matching LOCKS worker |
| `tests/e2e/**` | QA worker (after integration) |

`src/kernel/**` is frozen. If you need a kernel change, request it; do not edit.

## 4. The Lock interface (frozen)

Every lock is one file, `src/locks/NN-slug.js`, default-exporting this object.
Logic and view are strictly separated: everything in the "pure" half must run in
plain Node with no DOM, because the deterministic test gate calls it directly.

```js
export default {
  // ---- identity ----
  id: '04-strakes',            // must equal the filename without extension
  ordinal: 4,                  // 1..15, unique
  tier: 2,                     // 1 teaching, 2 combination, 3 inference, 4 mastery
  title: 'The Clinker Strakes',
  epigraph: 'Nine planks. One lies over another, never beside.',

  // ---- pure logic (no DOM, no canvas, no globals) ----
  makePuzzle(rng),             // -> instance (plain JSON-serialisable object)
  solve(instance),             // -> a canonical correct answer
  verify(instance, answer),    // -> { ok: boolean, near?: string }
  wrongAnswers(instance),      // -> array of >= 6 plausible-but-wrong answers
  shard(instance),             // -> { rune: 'ᚦ', value: 7 }  (fed to lock 15)

  // ---- difficulty declaration (audited by the gate) ----
  difficulty: {
    searchSpace: 2.4e6,        // size of the naive candidate space
    minSteps: 11,              // minimum player actions on the optimal line
    estMinutes: 9              // expected solve time for a careful player
  },

  // ---- hints: exactly 3, escalating, never giving the answer ----
  hints: [
    'A strake laps the one below it, and only the one below it.',
    'Two testimonies cannot both be true. Count the rivets.',
    'Discard the plank whose rivet parity disagrees with its neighbours, then sort.'
  ],

  // ---- view ----
  mount(ctx)                   // -> { unmount() }
}
```

### 4.1 `mount(ctx)`

`ctx` is supplied by the shell and contains exactly:

```js
{
  root,        // HTMLElement, empty, already sized. Render into this only.
  instance,    // the puzzle instance from makePuzzle
  art,         // src/art API (see docs/ART.md)
  audio,       // src/audio API
  submit(answer),   // -> { ok, near }. Shell handles win/lose/lockout feedback.
  note(text),       // write a line into the player's journal
  solved            // boolean, true when re-entering an already-open lock
}
```

`mount` must return `{ unmount() }` and `unmount` must remove every listener,
timer, rAF, and AudioNode it created. A leak fails the QA gate.

### 4.2 Determinism

`makePuzzle(rng)` receives a seeded PRNG (`src/kernel/rng.js`). Given the same
seed it must produce a byte-identical instance. No `Math.random`, no `Date.now`
inside puzzle generation. Timing may be used in the view layer only.

### 4.3 Answer shape

`answer` must be JSON-serialisable and stable under `JSON.stringify` with sorted
keys. `verify` must be total: it never throws on malformed input, it returns
`{ ok: false }`.

`near` is an optional short diagnostic shown to the player on a wrong answer
("the third strake is right; the fifth is not"). It must never leak the answer.

## 5. Shards and the final lock

Locks 1–14 each return a `shard`: one Younger Futhark rune plus an integer.
Lock 15 consumes all fourteen. Shard values are frozen in `docs/LOCKS.md`;
a lock may not invent its own.

## 6. Progression, hints, lockout

- Locks unlock in ordinal order. No skipping.
- Three wrong answers on a lock arms hint 1; six arms hint 2; ten arms hint 3.
  Hints are always *offered*, never forced, and taking one is recorded.
- No timers, no lives, no fail state. The chest cannot be lost, only unopened.
- Progress is saved to `localStorage` under key `oathwood.v1`. A `Reset chest`
  control exists in settings and asks for confirmation once.

## 7. Verification gates (deterministic; agent opinion is not a gate)

`npm run gates` must pass before any handoff is accepted.

1. **Solver gate** — for every lock, over 200 seeds: `verify(inst, solve(inst)).ok === true`.
2. **Rejection gate** — for every lock, over 200 seeds: every entry of
   `wrongAnswers(inst)` verifies false, and 500 random mutations of the correct
   answer verify false. A lock that accepts a wrong answer fails the build.
3. **Determinism gate** — `makePuzzle` with a fixed seed is stable across runs.
4. **Difficulty gate** — `minSteps` and `estMinutes` are non-decreasing across
   ordinals 1..15 and meet the per-lock floors in `docs/LOCKS.md` (ties allowed,
   decreases fail). `searchSpace` is informational.
5. **Purity gate** — the pure half of every lock module runs under Node with
   `document`, `window`, `Math.random` and `Date` stubbed to throw.
6. **Bundle gate** — single file, size budget, no external URLs, no `eval`.
7. **Browser gate** — Playwright drives all fifteen locks to open with real
   input events, captures a screenshot per lock, and asserts a clean console.
8. **Offline gate** — the page loads and plays with the network blocked.

## 8. Accessibility floor

Contrast ≥ 4.5:1 for body text against its actual painted background.
Touch targets ≥ 44 px. Full keyboard path through every lock. `prefers-reduced-motion`
honoured: parallax, drift and particle motion stop; state changes remain legible.
Every canvas that carries meaning has a text mirror in the journal.

## 9. Originality and content boundary

Everything is written for this project. No copied assets, no third-party art, no
lifted puzzle text. Norse material is drawn from the historical record (Younger
Futhark, hnefatafl, hahalrunar, jötunvillur, dróttkvætt, clinker construction,
weight standards) — these are public-domain facts, not borrowed content. No
gore, no glorification of violence against people; the raid is a ledger and a
ship, not a killing. No modern political framing.
