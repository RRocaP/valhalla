# THE FIFTEEN LOCKS — frozen designs

Each lock below is frozen in: mechanic, answer semantics, shard, difficulty
floors. The assigned worker has creative latitude in: instance generation,
surface writing (epigraph, hints, near-miss lines), and the view — inside these
walls. Verify semantics may not be weakened.

Common law:
- All pure logic seeded through `rng` from `src/kernel/rng.js`. Byte-identical
  instances per seed.
- `verify` is total and never throws. Where the answer is a unique object,
  verify by canonical equality. Where it is a property ("any valid
  configuration"), the generator must guarantee the instance has **exactly one**
  valid answer, checked exhaustively in `makePuzzle` (all sweeps below are ≤ a
  few hundred thousand states — cheap).
- `shard(instance)` returns the frozen constant below, independent of instance.
- Floors: `minSteps ≥ floor`, `estMinutes ≥ floor`, and both non-decreasing
  across ordinals 1→15.
- Rune stroke data for anything logic-visible comes from `src/kernel/futhark.js`
  (canonical segments) — never from the art layer.

## Shard table (FROZEN — consumed by lock 15)

| Lock | Rune | Value |
|---|---|---|
| 01 | ᚠ | 8 |
| 02 | ᚢ | 9 |
| 03 | ᚦ | 13 |
| 04 | ᚱ | 11 |
| 05 | ᚴ | 11 |
| 06 | ᚼ | 9 |
| 07 | ᚾ | 13 |
| 08 | ᛁ | 5 |
| 09 | ᛅ | 12 |
| 10 | ᛋ | 8 |
| 11 | ᛏ | 5 |
| 12 | ᛒ | 5 |
| 13 | ᛘ | 1 |
| 14 | ᛚ | 2 |

Futhark order of the fourteen: ᚠ ᚢ ᚦ ᚱ ᚴ ᚼ ᚾ ᛁ ᛅ ᛋ ᛏ ᛒ ᛘ ᛚ (ᛚ wraps to ᚠ).

---

## 01 — `01-runerow` · The Rune Row · tier 1 · LOCKS-A
Sixteen carved tiles of the Younger Futhark, jumbled; 3–4 of them mirrored
(wend-runes). Restore the row: drag to reorder, tap to flip. **Answer:**
`{ order: [16 indices], flips: [bools] }` — unique. Teaches: runes have one
order; carvings can lie by mirror. Floors: minSteps 6, estMinutes 2.
searchSpace note: instance jumbles 8 tiles. Near-diagnostics by region
("the elder third is right").

## 02 — `02-bismer` · The Bismer Scales · tier 1 · LOCKS-A
Nine sealed pouches of hacksilver, one light (clipped). Two balance weighings
are already carved into the ledger (pans + tilt). Deduce the clipped pouch.
Silver counted in mark/øre/ertog (1 mark = 8 øre = 24 ertog) — conversions
dress the pouch labels. **Answer:** `{ pouch: i }` — unique by ternary logic.
Floors: minSteps 8, estMinutes 3.

## 03 — `03-beacons` · The Beacon Nights · tier 1 · LOCKS-A
Three coastal beacons burn on cycles of a, b, c nights (pairwise coprime, from
{3,4,5,7,9,11,13}), with given offsets ("Skarvholm burned two nights ago").
All three burned together once; set the dial to the next night all three burn.
CRT-lite. **Answer:** `{ night: t }` — unique minimal positive t, dial range
caps at lcm. Floors: minSteps 10, estMinutes 4.

## 04 — `04-strakes` · The Clinker Strakes · tier 2 · LOCKS-A
Nine ship planks; shipwrights' testimonies give lap-order constraints ("keel
strake laps the garboard"). One testimony is false, and the false one is
identifiable deterministically: each plank shows rivet counts, and exactly one
testimony contradicts rivet parity law (laps must alternate parity — spec the
law plainly in the journal). Discard it; the remaining DAG admits exactly one
topological order. **Answer:** `{ order: [9], liar: k }`. Floors: minSteps 12,
estMinutes 5. Generator must verify topo-order uniqueness by counting.

## 05 — `05-knotwork` · The Oseberg Knot · tier 2 · LOCKS-A
A 4×4 panel of strand tiles; some tiles frozen (carved), 8–12 free. Each free
tile toggles between its two crossing states. Goal: the whole panel traces
**one closed strand** whose crossings alternate over/under along its run — true
knotwork law. **Answer:** `{ states: [bools] }` — generator guarantees exactly
one valid configuration (≤ 2^12 sweep). Verify traces strands + alternation.
Floors: minSteps 14, estMinutes 6.

## 06 — `06-jotunvillur` · The Jötunvillur Cipher · tier 2 · LOCKS-B
The historical rune-name cipher (decoded only in 2014): each letter is written
as the rune whose **name ends** in that letter's sound. FROZEN mapping
(translit): f→i(fé), u→r(úr), þ→s(þurs), o→s(óss), r→þ(reið), k→n(kaun),
h→l(hagall), n→r(nauðr), i→s(íss), a→r(ár), s→l(sól), t→r(týr), b→n(bjarkan),
m→r(maðr), l→r(lǫgr). A four-word cargo manifest is enciphered; a 36–44 word
ship-lexicon (worker-authored, Old-Norse-flavoured translits over these letters)
is carved on the lid. Decipher all four words. **Answer:**
`{ words: [4 strings] }` — generator ensures each cipherword has exactly one
lexicon preimage, and ≥2 words must have ≥30 candidate collisions before
lexicon filtering (that's the difficulty). Floors: minSteps 16, estMinutes 8.

## 07 — `07-tafl` · The King's Road · tier 3 · LOCKS-B
Brandubh (7×7 hnefatafl) endgame. Player moves the king's side; the attacker
plays a FROZEN deterministic policy (spec it exactly in the module doc:
1. play a capture if available, else 2. play the reply that most worsens the
king's escape — maximise the king's BFS distance to an exit (adversarial
reading, ruled 2026-08-06; implemented behind POLICY_SIGN), ties broken
row-major by from-then-to). Find the escape in ≤ N
moves (N=3 or 4; generator search guarantees a forced win exists and that at least
two natural first moves fail). **Answer:** `{ line: [[from,to],…] }` — verify
simulates. Multiple winning lines allowed only if generator proves uniqueness;
otherwise verify accepts any line that wins within N against the policy, and
`wrongAnswers` supplies losing lines. Floors: minSteps 18, estMinutes 10.

## 08 — `08-hacksilver` · The Twelve Pieces · tier 3 · LOCKS-B
The full 12-coin problem, dressed as hacksilver: twelve cut pieces, one false
(heavier OR lighter, unknown), three balance weighings already sworn before the
thing (given). Name the false piece and its direction. Generator picks
piece/direction, then picks a weighing triple whose outcome pattern uniquely
identifies it (and would uniquely identify every other hypothesis — a true
separating design). **Answer:** `{ piece: i, heavier: bool }`. Floors:
minSteps 20, estMinutes 12.

## 09 — `09-sunstone` · The Sunstone Bearing · tier 3 · LOCKS-B
Overcast sea. The sólarsteinn gives the sun's ring, not its point: each of
three readings constrains the sun to TWO azimuths on a 64-point ring (reading
r → r+16 or r−16 mod 64). One reading was taken through a wet stone and is
corrupted (arbitrary). Amendment (ruled 2026-08-06): the two candidates of a
clean reading are antipodal, so readings alone can never single out one
azimuth — the instance also carries a **day-mark** naming the 32-point half
of the ring the sun stands in (in-fiction: morning or evening watch). With
it, exactly one (azimuth, wet index) pair is consistent; generator sweeps all
64×3 to guarantee uniqueness. **Answer:** `{ azimuth: 0..63, wet: i }`.
Floors: minSteps 22, estMinutes 13.

## 10 — `10-drottkvaett` · The Dróttkvætt Lines · tier 3 · LOCKS-B
Eight carved half-lines must be paired and ordered into four long lines of
court metre, simplified to three checkable laws (state them in the journal):
(1) six syllables per half-line — pre-counted and shown; (2) the odd half-line
carries two alliterating stresses and the even half-line's FIRST stress must
join them; (3) odd half-lines carry skothending (final stressed syllables share
coda consonants, different vowel), even carry aðalhending (share vowel+coda).
Worker authors the fragment bank in readable mock-skaldic English with kennings
(whale-road, ring-breaker …), each fragment tagged with machine-checkable
metadata; the player sees only the verse. Generator permutes and proves unique
valid assembly (8! sweep). **Answer:** `{ lines: [[i,j],×4] }`. Floors:
minSteps 24, estMinutes 15.

## 11 — `11-skerry` · The Skerry Road · tier 4 · LOCKS-C
A fjord chart: 12–14 named skerries, sounds and portages as a graph. The tide
alternates every leg (odd legs ebb, even legs flood); each channel is passable
only on ebb, only on flood, or always; portages are always passable but cost 2
legs. Route from fleet to hoard in the MINIMUM number of legs. Optimum computed
by BFS over (node, parity); generator ensures the greedy/shortest-ignoring-tide
route fails and the optimum is unique as a leg-count (path itself may vary —
verify checks legality + leg-count == optimum). **Answer:** `{ route: [nodes] }`.
Floors: minSteps 26, estMinutes 16.

## 12 — `12-veitsla` · The Feast Benches · tier 4 · LOCKS-C
Eight chieftains, two facing benches of four. Nine sworn constraints of four
kinds: opposite(x,y), not-adjacent(x,y) (feud), left-of(x,y) same bench
(gift-debt), same-bench(x,y). Exactly one constraint is a drunken boast — false
in the true seating. Generator sweeps all 8!·9 to guarantee a unique
(seating, boast) pair, with ≥3 decoy seatings failing exactly one non-boast
constraint. **Answer:** `{ benches: [[4],[4]], boast: k }` (canonical: bench A
starts with the alphabetically-first chieftain… spec canonicalisation in
module). Floors: minSteps 28, estMinutes 18.

## 13 — `13-althing` · The Althing Verdict · tier 4 · LOCKS-C
Nine speakers at the law-rock; one broke the peace. Each speaker utters one or
two statements drawn from a fixed grammar: "X speaks true/false", "X or Y lies
(not both)", "if X speaks true then Y lies", "the peace-breaker is/is not
among {…}", "I am not the peace-breaker". Liars' every statement is false,
truth-tellers' every statement is true. Generator sweeps 2^9 × 9 hypotheses and
guarantees exactly one consistent (liar-set, culprit). **Answer:**
`{ culprit: i, liars: [bools ×9] }`. Floors: minSteps 30, estMinutes 20.

## 14 — `14-bindrune` · The Bind-Rune Seal · tier 4 · LOCKS-C
A deep-cut bindrune on the hasp: the union of the canonical stroke segments
(from `kernel/futhark.js`) of a secret 5–6 rune subset, all sharing the common
stave. Name the runes bound in it. Minimality law: no chosen rune may be
removable without losing a carved segment. Generator sweeps all 2^16 subsets to
guarantee the carved figure has exactly one minimal generating set, and plants
traps: ᛁ (the only rune the kernel data allows to be fully covered by others —
its lone stave is shared by all stave-bearing runes) plus ≥2 one-stroke-short
near-traps (runes whose branches are all carved but one). **Answer:**
`{ runes: [chars, futhark-sorted] }`. Floors: minSteps 32, estMinutes 22.

## 15 — `15-oathring` · The Oath-Ring · tier 4 (mastery) · LOCKS-C
The arm-ring under the hasp has fourteen slots around a circle; the north nail
marks slot 0. The player places their fourteen collected shards (rune + number,
table above). The law of the ring — never stated, only discoverable: **each
shard's number is the clockwise distance from its own slot to the slot of the
rune that follows it in the futhark row** (ᛚ wraps to ᚠ), and ᚠ hangs on the
north nail. This forces the unique arrangement:

slot 0→13 clockwise: ᚠ ᛏ ᚱ ᚦ ᛁ ᚾ ᛒ ᛋ ᚢ ᛅ ᚼ ᛘ ᛚ ᚴ  (FROZEN)

The journal quietly holds every needed fact (all shards, futhark row). Hints
escalate toward the law without stating the placement. `makePuzzle` is static;
determinism trivial. **Answer:** `{ ring: [14 chars clockwise from north] }`.
Verify: exact match. wrongAnswers: rotations, futhark order laid clockwise,
value-sorted orders, three near-rings with two runes swapped. Floors:
minSteps 34, estMinutes 25. On success the chest opens: the treasure is
**Tebi the Osteopath** (see CONTRACT §1).
