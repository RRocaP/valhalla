# THE CHALLENGERS — frozen duel spec

Five chieftains bar the way. Every third lock is a **duel**: the challenger
dares you as you enter it, and yields when you open it. Presentation only —
no Lock interface change, no new save fields (defeated ≡ that lock is open).

## Cast (FROZEN — mapping, orthography, portrait ids)

| Lock | Challenger (exact in-game text) | Portrait id |
|---|---|---|
| 03 Beacon Nights | JARL BOURJ | `bourj` |
| 06 Jötunvillur | GUDJA RØIS | `rois` |
| 09 Sunstone | JARL ÅNDREAS | `andreas` |
| 12 Feast Benches | JARL FOLKLORE | `folklore` |
| 15 Oath-Ring | QUEEN ÄRYÄ STÖRK — the last | `arya` |

Portraits arrive in `createShell({ portraits })` as data URIs (may be `''` →
carved placeholder silhouette + name). `portraits.ramon` is reserved for the
credits (see SHELL.md) and is never a challenger.

## Beats

1. **Banner** — while a duel lock is the armed (`next`) medallion, the lid
   marks it with the challenger's small banner tag; journal notes
   "JARL BOURJ bars the third lock." (text mirror).
2. **Dare card** — entering a duel lock first shows the dare: the portrait
   runtime-graded into the palette inside `art.portrait(...)`'s carved arch,
   name in display caps, one taunt line, one carved button `Answer the dare`.
   `audio.motif('dare')`. Skipped on re-entry to a solved lock.
3. **Yield beat** — on solving a duel lock, before the shard ceremony: the
   portrait **bows** (`bow` 0→1 over ~1.2 s — dip + slight forward tilt + dim;
   instant swap under reduced motion), yield line shown, `audio.motif('yield')`,
   journal line. Then the normal shard ceremony runs.
4. **The last bow** — Ärya's yield beat flows directly into the lid-opening
   finale and the treasure reveal (TEBI THE OSTEOPATH), then credits.

## Lines (FROZEN)

| id | Taunt | Yield |
|---|---|---|
| bourj | "I have watched a thousand nights of beacons. You will miscount before I blink." | "So the fires do answer you. Take the road, counter of nights." |
| rois | "The giants twisted these words. Untwist them, or wear the fool's hood at my fire." | "You read what the giants hid. Røis names you rune-wise." |
| andreas | "The hound-jarl speaks no dare. He looses it. Find the sun he already smells." | "Åndreas lowers his bow — and bows." |
| folklore | "Seat my quarrelsome kin without blood on the boards. Even I gave up and drank." | "Folklore raises his cup. 'The benches hold. The boast was never mine.'" |
| arya | "Fourteen shards, one law, and me. None has closed the ring while I held the horn." | "The Queen lowers her horn. Skål, ring-closer. The chest is yours." |

Wait — folklore's puzzle *does* contain a boast (lock 12). His yield line must
not contradict the solution; the shell substitutes the actual boaster's name:
`'The benches hold. The boast was ${name}'s.'` If that plumbing is awkward,
use the fallback: "Folklore raises his cup. 'The benches hold. Drink.'"

## Accessibility

Dare card and yield beat fully keyboard operable (Enter advances, Esc backs
out of the dare to the lid without forfeiting anything). Portrait meaning is
mirrored in text (name + taunt are real DOM text, journal lines recorded).
Reduced motion: no bow animation, no banner pulse; states swap instantly.
Contrast floors apply to name/taunt text over the card.
