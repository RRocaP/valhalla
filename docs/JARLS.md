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
   finale and the treasure reveals, then credits.

## The treasures (FROZEN)

The chest yields **two** treasures, in sequence:

1. **TEBI THE OSTEOPATH · Snake-in-the-Eye** — portrait = the inlined
   treasure data URI; sub-line `The hoard of the fifteen locks.`
2. Then, from under the false bottom: **JARL ÅLANØ** (portrait id `alano`) —
   `the Troll-Burster · Friend of the Children` — epithet line:
   *"Praised in every fjord for refusing the trendy Viking sport of impaling
   toddlers on spears."*

Each reveal is tap/Enter-advanced; a final tableau shows both, then
`Raise the horns` (credits) and `Seal the chest again`.

## Credits stickers (FROZEN)

During the credits scroll, character **stickers fall** behind and between the
text: the full cast pool — `bourj, rois, andreas, folklore, arya, ramon,
alano, alanof` plus the Tebi treasure image — rendered via `art.sticker`
(die-cut white border, rounded corners, soft shadow). Gentle tumble: slow
fall, slight rotation and sway; ≤8 concurrent; sprites pre-rendered once per
character to an offscreen canvas (no per-frame regrade). Reduced motion: no
falling — a static sticker scatter sits at the foot of the credits instead.

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

## Frozen localized lines (es / ca — lead-authored 2026-08-06, use VERBATIM)

Subtitle: es «Quince Cerraduras de los Hombres del Norte» · ca «Quinze Panys
dels Homes del Nord». Colophon: es «tallado por manos de máquina · MMXXVI» ·
ca «tallat per mans de màquina · MMXXVI».

| id | es taunt / yield | ca taunt / yield |
|---|---|---|
| bourj | «He velado mil noches de almenaras. Errarás la cuenta antes de que yo parpadee.» / «Así que los fuegos te responden. Toma el camino, contador de noches.» | «He vetllat mil nits d'alimares. Erraràs el compte abans que jo parpellegi.» / «Així que els focs et responen. Pren el camí, comptador de nits.» |
| rois | «Los gigantes retorcieron estas palabras. Desenrédalas, o lleva la capucha del necio junto a mi fuego.» / «Has leído lo que los gigantes ocultaron. Røis te nombra sabio en runas.» | «Els gegants van retòrcer aquestes paraules. Desembulla-les, o duràs la caputxa del ximple vora el meu foc.» / «Has llegit el que els gegants van amagar. Røis t'anomena savi en runes.» |
| andreas | «El jarl-sabueso no pronuncia su desafío. Lo dispara. Halla el sol que él ya huele.» / «Åndreas baja el arco — y se inclina.» | «El jarl-gos no pronuncia el seu desafiament. El dispara. Troba el sol que ell ja ensuma.» / «L'Åndreas abaixa l'arc — i s'inclina.» |
| folklore | «Sienta a mi parentela pendenciera sin sangre en las tablas. Hasta yo desistí y me puse a beber.» / «Folklore alza la copa. “Los bancos aguantan. Bebe.”» | «Asseu la meva parentela busca-raons sense sang a les taules. Fins i tot jo vaig desistir i em vaig posar a beure.» / «En Folklore alça la copa. “Els bancs aguanten. Beu.”» |
| arya | «Catorce esquirlas, una ley, y yo. Nadie ha cerrado el anillo mientras yo sostenía el cuerno.» / «La Reina baja su cuerno. Skål, cerrador del anillo. El cofre es tuyo.» | «Catorze estelles, una llei, i jo. Ningú no ha tancat l'anell mentre jo sostenia el corn.» / «La Reina abaixa el corn. Skål, tancador de l'anell. El cofre és teu.» |

Treasures — es: «TEBI EL OSTEÓPATA · Serpiente-en-el-Ojo», sub «El tesoro de
las quince cerraduras.»; «JARL ÅLANØ — el Revientatrols · Amigo de los Niños»,
epíteto «Alabado en todos los fiordos por negarse al deporte vikingo de moda:
ensartar niños pequeños en lanzas.» · ca: «TEBI L'OSTEÒPATA · Serp-a-l'Ull»,
sub «El tresor dels quinze panys.»; «JARL ÅLANØ — el Rebentatrols · Amic dels
Infants», epítet «Lloat a tots els fiords per negar-se a l'esport viking de
moda: empalar criatures en llances.» Names (BOURJ, RØIS, ÅNDREAS, FOLKLORE,
ÄRYÄ STÖRK, RAMON) and VALHALLA never translate.

## Accessibility

Dare card and yield beat fully keyboard operable (Enter advances, Esc backs
out of the dare to the lid without forfeiting anything). Portrait meaning is
mirrored in text (name + taunt are real DOM text, journal lines recorded).
Reduced motion: no bow animation, no banner pulse; states swap instantly.
Contrast floors apply to name/taunt text over the card.
