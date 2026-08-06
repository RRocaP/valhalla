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
