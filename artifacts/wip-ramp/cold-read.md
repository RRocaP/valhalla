# Lock 01 — the board's self-explanation audit

Method: capture the board with **every word on the screen hidden** (title, epigraph,
labels, help, tally text, near-line, footer) and ask what a player who has never seen a
rune can still work out. Shots: `shots/01b-wordless-desktop.png`, `shots/01b-wordless-iphone.png`.
Then re-add text and check that no sentence is load-bearing — text is the safety net, not
the teacher.

## What the wordless board says by itself

| Question a cold player has | What answers it, wordlessly | Verdict |
|---|---|---|
| What is fixed here? | The rail: one long carved lintel, sixteen staves, nailed at both ends. Ten of them cut shallow and dim, underlined by one unbroken settled line. | reads as "done, don't touch" |
| What is mine to do? | Six bone tablets — a different **material** from everything else on screen, standing loose on their own bench with cast shadows under each foot. | material contrast does the work |
| Which part of the rail is mine? | The first six rail staves are cut deep, hold red pigment, and are bracketed by a gold span with nailed ends; six gold chevrons drop from under exactly those six. | one-to-one, count matches count |
| How do I move one? | Cursor is `grab`; the ~3 s showing drags a gold ghost of a stave from where it stands to its gap and lets it fall. | shown, not told |
| Am I getting anywhere? | Six pips fill gold, one per stave that stands true; each seated stave grows a gold seam along its foot the instant it lands, with a knock. | continuous, per-action |
| When am I done? | Six pips lit; the tally line changes voice; the primary button is the only carved-gold control on the board. | unambiguous |

## The one thing the board cannot say wordlessly — and why that is right

Nothing in the silent board announces *"one of the six is mirrored."* It is not supposed
to. The discovery is engineered to arrive **by doing**: a player who lays all six in the
rail's order reaches **5 of six staves stand true** and one tile with no gold seam. That
single unlit pip is the whole lesson of the lock, and it is earned rather than read.
Evidence: `shots/03-ordered-mirror-left-desktop.png` (five seams, five pips, one tile bare)
and `capture.txt` — `tally, ordered, unturned: "5 of six staves stand true"`.

Three safety nets sit behind it, in escalating order, and none is needed to reach it:
epigraph ("one was cut from the wrong face") → the near-line on a wrong setting ("The row
stands in order — one stave is still turned against the rail.") → hint 2.

## The 20-second path, measured

1. **0 s** — rail, bracket, six chevrons, six tablets. Nothing else competes; the ten dim
   staves recede at ~3.9:1 against the oak while the six read at full bone.
2. **0.4–3 s** — the showing: the ghost travels one stave into its gap. Skippable by a
   button *and* by touching anything (`takeTheChisel()` on the first pointerdown/keydown).
   Under `prefers-reduced-motion` the same lesson is a **static** ghost held over the
   destination gap for the same 3 s — no travel, no loss of information
   (`shots/01-cold-desktop-calm.png`).
3. **3 s** — if still untouched, the leftmost out-of-place stave yearns (a slow 6 px lift,
   off entirely under reduced motion).
4. **first drag** — lands, knocks, gold seam, pip 1 fills, journal + live region both say so.
   Measured round trip: 21 ms desktop / 20 ms phone (budget <100 ms).
5. **~20 s** — five seated, one bare. The player turns it.

## What this audit changed

- The first draft pointed **one** chevron at the bench from the bracket's centre; on a
  centred board that arrow aimed at empty wood. Replaced with **six** chevrons, one under
  each loose stave — the count itself now carries the correspondence.
- The rail label was a full sentence repeating the epigraph. Cut to four words ("The rail
  is the law"); the wordless shot proved the sentence was not doing the work.
- The bench was a dark strip almost entirely hidden behind the tablets. Apron deepened and
  the plank lit, so the six read as *standing on furniture* rather than floating.

## Honest limits

- The audit is a screenshot-and-drive audit, not a human playtest. It proves the signals
  are present, legible and reachable; it cannot prove a first-timer's 20 s.
- The mirrored stave is only distinguishable to a player who compares it with the rail.
  That comparison is the lock's teaching content, and the generator refuses to mirror any
  stave whose mirror could pass for another rune (`WENDABLE`), so the comparison is always
  decidable.
