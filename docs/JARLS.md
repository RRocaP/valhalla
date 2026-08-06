# THE CHALLENGERS — frozen duel spec (v2, 2026-08-06)

Five chieftains bar the way, **from the very first lock** (Ramon directive).
A duel lock: the challenger dares you as you enter, and yields when you open
it. Presentation only — no Lock interface change, no new save fields
(defeated ≡ that lock is open).

## The wager (framing card, shown once after the threshold gesture)

EN: "Queen Ärya Störk's sea-chest stands in the hall: fifteen locks, five
sworn jarls to bar the way, and the hoard for whoever opens them all before
the spring sailing. The first lock waits — and Jarl Bourj already stands
over it."
ES: «El cofre de la reina Ärya Störk se alza en el salón: quince cerraduras,
cinco jarls juramentados cerrando el paso, y el tesoro para quien las abra
todas antes de la partida de primavera. La primera cerradura aguarda — y el
jarl Bourj ya está plantado sobre ella.»
CA: «El cofre de la reina Ärya Störk s'alça a la sala: quinze panys, cinc
jarls jurats barrant el pas, i el tresor per a qui els obri tots abans de la
sortida de primavera. El primer pany espera — i el jarl Bourj ja hi és
plantat al damunt.»

## Chapters (FROZEN v3 — Ramon: "one jarl, a few puzzles, then next jarl")

Fifteen locks in FIVE GAUNTLETS of three. Each jarl OWNS their gauntlet: the
**dare card** fires on entering its first lock; the jarl's banner hangs over
all three of their medallions on the lid; a **heckle line** lands on their
middle locks; the **yield beat** fires when their last lock opens. Ärya's
yield is the last bow → finale.

| Gauntlet | Locks | Challenger | Portrait | Dare at | Yield at |
|---|---|---|---|---|---|
| I | 01–03 | JARL BOURJ | `bourj` | 01 | 03 |
| II | 04–06 | GUDJA RØIS | `rois` | 04 | 06 |
| III | 07–09 | JARL ÅNDREAS | `andreas` | 07 | 09 |
| IV | 10–12 | JARL FOLKLORE | `folklore` | 10 | 12 |
| V | 13–15 | QUEEN ÄRYÄ STÖRK — the last | `arya` | 13 | 15 |

## Chapter-opening taunts (FROZEN v3, verbatim; yields in the table further
down are UNCHANGED and still land on 03/06/09/12/15 where they always fit)

| id | EN | ES | CA |
|---|---|---|---|
| bourj | "I have watched a thousand hands at this row. Every one left humbler. Three locks are mine — begin." | «He visto mil manos en esta hilera. Todas se marcharon más humildes. Tres cerraduras son mías — empieza.» | «He vist mil mans en aquesta filera. Totes van marxar més humils. Tres panys són meus — comença.» |
| rois | "Nine planks and one lie — I saw it before the shipwright spoke. My three locks will read you like weather." | «Nueve tablones y una mentira — la vi antes de que hablara el carpintero. Mis tres cerraduras te leerán como al tiempo.» | «Nou taulons i una mentida — la vaig veure abans que parlés el mestre d'aixa. Els meus tres panys et llegiran com el temps.» |
| andreas | "The hound-jarl sets the board and says nothing. Three locks — and he smells your first mistake already." | «El jarl-sabueso dispone el tablero y no dice nada. Tres cerraduras — y ya huele tu primer error.» | «El jarl-gos para el tauler i no diu res. Tres panys — i ja ensuma el teu primer error.» |
| folklore | "Verse, benches, and quarrelsome kin — my three locks. Fill your cup first; you will need the courage." | «Versos, bancos y parentela pendenciera — mis tres cerraduras. Llena antes tu copa; te hará falta el valor.» | «Versos, bancs i parentela busca-raons — els meus tres panys. Omple't abans la copa; et caldrà el coratge.» |
| arya | "The last three are mine. No one has stood where you stand and left this hall with the hoard." | «Las tres últimas son mías. Nadie ha estado donde tú estás y ha salido de este salón con el tesoro.» | «Els tres últims són meus. Ningú no ha estat on ets tu i ha sortit d'aquesta sala amb el tresor.» |

## Heckles (the gauntlet's OWN jarl, on their middle locks; FROZEN verbatim)

| Locks | EN | ES | CA |
|---|---|---|---|
| 02 | "Bourj counts your wrong turns aloud. He is enjoying this." | «Bourj cuenta en voz alta tus pasos en falso. Está disfrutando.» | «En Bourj compta en veu alta els teus passos en fals. S'ho està passant bé.» |
| 05 | "Røis turns a cold coin, unsurprised by anything you do." | «Røis hace girar una moneda fría, sin sorprenderse de nada de lo que haces.» | «En Røis fa girar una moneda freda, sense sorprendre's de res del que fas.» |
| 08 | "The hound-jarl's eyes follow your hands. He does not blink." | «Los ojos del jarl-sabueso siguen tus manos. No parpadea.» | «Els ulls del jarl-gos segueixen les teves mans. No parpelleja.» |
| 11 | "Folklore refills his cup. 'Take your time. The mead won't.'" | «Folklore rellena su copa. “Tómate tu tiempo. El hidromiel no lo hará.”» | «En Folklore s'omple la copa. “Pren-t'ho amb calma. La mel fermentada no ho farà.”» |
| 14 | "The Queen has not looked away since her gauntlet began." | «La Reina no ha apartado la mirada desde que empezó su desafío.» | «La Reina no ha apartat la mirada des que va començar el seu repte.» |

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
