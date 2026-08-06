# OW-DRAGON — carved Viking prow-beast

New file `src/art/dragon.js`, export `drawDragonHead(ctx, x, y, size, opts)` —
`{facing:1|-1, color?, style:'proud'|'ember', t?}`. Imported by nothing yet.
Anchor = base of the neck; ink fits the size×size box (measured below).

## Candidates (artifacts/wip-dragon/candidates-v1.png — three side by side)
- **A prow** — hard recurve, bold volute, chip-carved cockscomb. The only one
  whose head-to-neck mass ratio still read at 48px. **Winner.**
- **B urnes** — longest sinuous neck, open volute, raised interlace mane. Mane
  read as a rope laid beside the neck; the loose curl went limp.
- **C stave** — stout stem, 1.85-turn coil. Coil read as a snail and the heavy
  head killed the recurve. Lost on silhouette.
Refined twice: v2 rebuilt value structure + mouth (`refine-v2.png`); v3
tightened the volute clear of the eye, sank the comb into its own plane, added
parallel chisel striations (`final-v3.png`).

## Anatomy checklist (self-scored)
- Recurve → tight snout-tip volute (1.25 turns, r 0.135→0.018): PASS
- Almond eye, carved lid ridge + brow, slit pupil, reads at 48px: PASS
- Jaw hinged and cracked open, teeth, nostril flare curl: PASS
- Crest: 6 sawteeth grown out of the nape, not stuck on: PASS
- Carved mass: chisel planes, parallel striations, chip band, tool chatter,
  worn gold leaf on the proud ridges: PASS
- 48px reads DRAGON on oak and tar, both facings (`sil-final.png`): PASS
- Phone 40/48/64px (`phone-v3.png`): PASS at 48/64, legible-but-muddy at 40
- Weakest element: comb teeth still read slightly glassy at 480px.

## Commands + evidence
- `node --test tests/unit/dragon.test.mjs` → 5 pass, exit 0
- `npm test` → 281 pass, 0 fail, exit 0
- `npm run build` → exit 0 (regenerates index.html + src/kernel/*.gen.js)
- ink box measured in-page: R x[-0.350,0.487] y[-0.963,0.033] FITS;
  L x[-0.492,0.342] (mirror + shadow). Browser console clean.
- captures + preview.html + shoot.mjs in `artifacts/wip-dragon/`.

## Rework v4→v5 (lead defect list: museum artifact, not mascot)
1. EYE → relief eye: socket crescent, carved almond, drilled iris disc, lid
   ridge with under-shadow + worn-gold glint (only `t` motion).
2. JAW → closed: lip-line groove corner→snout (parting shadow ≈1.4px at 280),
   corner hook, chin/cheek in the down profile; gape/teeth deleted.
3. COMB → wave-mane carved INSIDE the crest band (u 0.92→−0.12): 6 diagonal
   recurved locks, lit-shoulder→groove-shadow gradient per lock, crisp
   incisions, unbroken crest fillet; nostril spiral + Oseberg cheek spiral.
4. SILHOUETTE → serration deleted from lane(); one continuous outer curve;
   thin edge incision replaces the fat sticker outline.
5. MATERIAL → matte oak, fillGoldLayered dropped: hard-stepped plane bands
   with incised boundaries, striations, chatter; gold only as broken ridge
   dashes inset u 0.93; ember = un-gilded warm oak + hearth rim-light runs.
6. 48px still reads DRAGON both facings/grounds (mid-v5.png, phone-v5.png).
Evidence: final/mid/phone -v4 + -v5 in `artifacts/wip-dragon/` (preview big
section now oak+tar); FINAL R FITS x[-0.296,0.487] y[-0.958,0.037]; console
clean. Gates: `node --test tests/unit/dragon.test.mjs` 5/5 exit 0 · `npm
test` 289/289 exit 0 twice (one interleaved run flaked audio.test — passes
standalone, file untouched) · `npm run build` exit 0 (pre-existing 1.51MB
WARN; dragon.js not yet imported by the bundle).

## Rework v5→v7 (Ramon's reference: horns + scale rows + snarl, still carved oak)
1. HORNS: two swept-back ring-carved beams off the crown (centreline cubic +
   tapering width; facet ridge, annuli tightening tipward, root-ring socket,
   leaf/ember catch on the proud edge); far horn scaled 0.93, offset back,
   peeking behind. Both join the cast shadow; mane m1 0.52→0.49 clears roots.
2. SCALE ROWS: quincunx lattice of chip-carved crescent lobes on the neck
   flank (2 rows lod2 offset half-pitch, 1 row lod1), laid out in arc length,
   free edges down-neck, shadowed roots, fading toward the throat; replaces
   the long striations; -0.5 band boundary dropped at lod2 (sliced lobes).
   Blind alleys kept as v6a-j: 3 micro-rows read corduroy (flank is only
   ~0.05*size half-wide), single chain read vertebrae.
3. SNARL: lip/gape rails in (m,u); dark gape wedge, curled upper lip, 5 relief
   teeth + corner fang (varied oak points, lit tips, never white), lit lower
   jaw edge, sneer creases, deeper brow 0.043/socket, jaw nick bump at m 0.885
   (one purposeful silhouette break). 48px reads horned+snarling both facings
   and grounds (v7-phone.png, v7-final.png) — fiercer and clearer than v5.
Ink now y0 -1.012 (was -0.958): horn tips graze the box top, FITS (<=-1.02)
both facings; console clean. Gates: dragon test 5/5 exit 0 · `npm test`
293/293 exit 0 · `npm run build` exit 0 (same pre-existing WARN). Evidence:
v6a-j iterate cycles + crops + v7-{big,final,phone}.png in wip-dragon/.
