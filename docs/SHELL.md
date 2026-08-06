# SHELL SPEC — frozen surface, SHELL worker owns implementation

The shell is everything around the puzzles: screens, chrome, save, hints,
journal, settings, finale. It consumes the art and audio APIs (docs/ART.md,
docs/AUDIO.md) and the lock interface (docs/CONTRACT.md §4). It never contains
puzzle logic.

## Entry (FROZEN)

```js
// src/shell/index.js
export function createShell({ locks, art, audio, treasureDataUri, portraits }) => { start() }
```

`locks` is the ordinal-sorted array of lock modules. `treasureDataUri` is a
(possibly empty) string. `portraits` is `{ bourj, rois, andreas, folklore,
arya, ramon }` — data-URI strings, any possibly `''` (degrade to carved
placeholder + name).

## Screens

1. **Threshold** — title `OATHWOOD`, subtitle `Fifteen Locks of the Northmen`,
   one carved button: `Lay hands on the chest`. That gesture calls
   `audio.enable()` + `drone.start()`. A quiet `Continue` state appears instead
   when a save exists, plus `Begin anew` (confirm once).
2. **The Lid** (hub) — `art.chestScene` canvas, 15 medallions in a 5×3 arc.
   States: `open` (gold, rune revealed), `next` (ember pulse, clickable),
   `sealed` (tar, inert). Shard tally strip along the chest's hasp. Journal
   handle (bottom drawer). Settings nail (top right).
3. **Lock room** — carved panel (`art.paintPanel`) with header: ordinal in
   ledger numerals, title, epigraph. The lock's `mount(ctx)` gets the inner
   root. Footer: attempts dots, hint horn (appears at 3/6/10 wrong), back
   latch. Solving plays the **shard ceremony**: medallion turns, rune + value
   inscribed into the hasp strip, `audio.motif('shard')` then `'unlock'`.
4. **Finale** — after lock 15 (Ärya's yield beat, docs/JARLS.md, runs first):
   lid opens (canvas animation, ≥2.5 s, skippable by tap), hoard glow, then
   the TWO treasure reveals in sequence (docs/JARLS.md §The treasures):
   first `treasureDataUri` in `art.treasureFrame` titled
   **TEBI THE OSTEOPATH · Snake-in-the-Eye**, sub-line
   `The hoard of the fifteen locks.`; then, tap-advanced, "from under the
   false bottom" — **JARL ÅLANØ** (`portraits.alano`),
   `the Troll-Burster · Friend of the Children`, epithet line per JARLS.md.
   Any missing image degrades to the carved placeholder (shield + crossed
   axes + question rune) with the same titles. Final tableau shows both, with
   `Raise the horns` (→ credits) and `Seal the chest again` (reset, confirm).
5. **Credits** — enters with `audio.music.credits()`. A slow saga scroll
   (wheel/keys/touch also scrub; fully readable under reduced motion as a
   paged list): OATHWOOD · THE CHALLENGERS (the five, in duel order, small
   graded portraits + names) · THE HOARD — TEBI THE OSTEOPATH ·
   Snake-in-the-Eye, and JARL ÅLANØ with his epithet · THE SCORE —
   "Frostbound Lullaby" & "Hjá Vindi" · toward the end **JARL RAMON**, his
   portrait through `art.portrait(..., { white: true })` — smallish,
   bone-white border — caption `JARL RAMON` · last line
   `carved by machine hands · MMXXVI`. Behind and between the text,
   character **stickers fall** per docs/JARLS.md §Credits stickers
   (`art.sticker` sprites, ≤8 concurrent, pre-rendered; static scatter under
   reduced motion). Esc/tap-skip returns to the opened chest; gameplay music
   resumes there. Headings across ALL screens use `art.carveText` / the
   relief recipe (ART.md material-type mandate); every screen sits on painted
   wood — no flat fills.

## Duels + score plumbing

Duel beats for locks 3/6/9/12/15 are FROZEN in docs/JARLS.md (banner, dare
card, yield beat, Ärya-into-finale). The begin gesture on the Threshold calls
`audio.enable()`, `audio.drone.start()`, then `audio.music.start()` — the
drone carries until the stream is ready (AUDIO.md). `drone.intensity` /
overall progress still ramps with opened/15.

## The `ctx` given to `lock.mount` (FROZEN — you construct it)

```js
{ root, instance, art, audio, submit(answer), note(text), solved }
```

- `submit` routes to `lock.verify`; on `{ok:true}` run ceremony + persist; on
  false: attempts++, `audio.ui('deny')`, brief panel shudder (skip under
  reduced motion), show `near` line if present, arm hints at 3/6/10.
- `note(text)` appends a timestamped line to the journal (used by locks for
  text mirrors of canvas state — accessibility floor).
- Re-entering a solved lock passes `solved: true` (lock renders its solved
  tableau; submit disabled).

## Hints

Hint horn offers, never forces. Taking hint k marks it in the save and in the
journal ("The horn was sounded on the fourth lock"). All three hints come from
`lock.hints`. No hint ever displays the answer (contract).

## Save (FROZEN key `oathwood.v1`)

```json
{ "opened": [ids], "attempts": {id:n}, "hints": {id:[k]}, "journal": [lines],
  "settings": {"muted":false,"reducedMotion":null}, "startedAt": iso }
```

Write-through on every change; corrupt/missing parses fall back to fresh state
without throwing. `reducedMotion: null` = follow media query; true/false =
user override in settings.

## Seeding (FROZEN)

The chest is a crafted artifact: every player gets the same fifteen locks.
Instance for a lock = `lock.makePuzzle(rng('lindisfarne-793:' + lock.id))`,
regenerated on each mount (deterministic — nothing stored). `Seal the chest
again` resets progress but not the seed.

## Test hook (FROZEN)

When `location.hash === '#autotest'`, expose
`window.__OW = { locks, instanceOf(id), answerOf(id) /* lock.solve */, save }`.
Read-only diagnostics for the Playwright gate; never referenced otherwise.

## Input + accessibility floor (gates)

Keyboard: Tab order threshold→hub→medallions→journal→settings; Enter opens;
Esc backs out; every lock's root is focusable and locks must remain operable —
shell provides a visible `goldBright` focus ring. Touch targets ≥ 44px.
`prefers-reduced-motion`: no shudder, no pulse, no lid-drift; state changes
swap instantly. All shell text ≥ 4.5:1 on its painted background. The page
never scrolls horizontally at 390px wide.

## Styling

All CSS injected from `src/shell/style.js` (one exported string) using
`art.palette` tokens. Layout: CSS grid, `clamp()` type scale, safe-area
insets. The wood is canvas — DOM sits above it in a `#app` stack.
