# ART DIRECTION + ART API — frozen surface, ART worker owns implementation

## Direction

A single oak sea-chest, lit by hearth-light. Every screen sits on **wood**:
deep, layered, believable oak — not a flat brown fill. Carved geometry (locks,
borders, knotwork) reads as *cut into* the wood: inner shadow above, warm catch
light below. Metal is gold and honest iron. Paint traces survive in blood red,
fjord blue, pine green — the way Oseberg carvings kept pigment in the grooves.

Quality bar: shipped-game key art, judged at retina scale. No CSS-gradient-on-a
-div look. No emoji, no clip-art, no fake 3D bevels.

## Palette (FROZEN tokens — export as `art.palette`)

| token | hex | role |
|---|---|---|
| `oakDeep` | `#221507` | darkest wood, vignettes |
| `oak` | `#3a2412` | board field |
| `oakLight` | `#5a3a1e` | raised grain, rims |
| `tar` | `#0c0906` | carved recesses, outlines, night |
| `gold` | `#c9a227` | fittings, active states |
| `goldBright` | `#eecf6d` | highlights, focus ring |
| `blood` | `#8f1f1f` | seals, wrong-answer, red paint |
| `ember` | `#c25c33` | hearth accents (sparing) |
| `fjord` | `#1d3a5f` | deep blue paint, water |
| `fjordLight` | `#3f6d9e` | blue highlights |
| `pine` | `#1e3d2a` | green paint, verdigris |
| `pineLight` | `#3c6b4a` | green highlights |
| `bone` | `#e9dcc3` | primary text, ivory inlay |
| `boneDim` | `#b7a98c` | secondary text |

Text on wood uses `bone`/`boneDim` only. Contrast ≥ 4.5:1 against painted
background is a shipping gate.

## Typography (system stacks only)

- Display/headers: `'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif`
- Body/journal: same serif stack, smaller, `boneDim`
- Numbers/ledger: `ui-monospace,'SF Mono',Menlo,monospace`
- Runes: NEVER font glyphs. Always drawn strokes via the art API.

## API (FROZEN signatures — implement in `src/art/index.js`)

```js
export function createArt() => {
  palette,                                  // tokens above
  makeCanvas(w, h),                         // dpr-aware canvas+ctx {canvas, ctx, w, h}
  paintWood(ctx, w, h, seed, opts?),        // layered oak: grain flow, rings, pores, vignette
  paintPanel(ctx, x, y, w, h, opts?),       // carved recessed panel w/ border; opts.title?
  drawRune(ctx, ch, x, y, size, opts?),     // strokes from kernel/futhark segments; opts: {color, weight, glow, mirror}
  drawKnot(ctx, points, opts?),             // over/under strand along polyline, alternating; opts: {width, color, gapAtCrossings}
  ornament(ctx, kind, x, y, size, opts?),   // kinds: 'ringknot','dragonhead','shieldboss','wavebord','nailhead'
  medallion(ctx, x, y, r, state, ordinal),  // lock medallion: 'sealed'|'next'|'open'
  glow(ctx, x, y, r, color, strength),      // radial ember/gold glow
  chestScene(ctx, w, h, t, progress),       // the lid: chest + 15 medallion sockets; t for idle drift
  treasureFrame(ctx, w, h, t),              // finale frame around the Tebi image / placeholder
  portrait(ctx, img, x, y, w, h, opts?),    // challenger/credits portrait — see below
  sticker(ctx, img, x, y, w, rot),          // die-cut sticker: white ~4% border, rounded
                                            // corners, soft drop shadow, light palette grade;
                                            // rot in radians; deterministic, caller animates
  carveText(ctx, text, x, y, sizePx, opts?) // chisel-relief lettering — see below
}
```

### `carveText()` and the material-type mandate (FROZEN)

Display lettering must read as **cut into or raised from the wood**, never as
flat screen text. `carveText` renders text with: dark incision core (tar),
lit lower-right lip (goldBright at low alpha), faint upper-left shade, and a
hint of grain breaking through long strokes. `opts`:
`{ color=bone, depth 0..1 (relief strength), align='left'|'center', maxWidth }`.
Used by the shell for the title, lock titles, ordinals, ceremony numerals.

**Texture-everywhere mandate:** every player-visible surface at every stage —
threshold, lid, lock rooms, dare cards, finale, credits — sits on painted
wood (`paintWood`/`paintPanel`), and DOM panels over it use palette-matched
translucent fills, never flat opaque hex rectangles. For DOM text, export
from the art side (via palette) the relief recipe the shell's style.js
applies: paired 1px shadows (tar above-left, goldBright ~18% below-right) on
headings; body text stays clean for legibility. "At times even volume": the
title card, lock headers, and shard numerals get full `carveText` depth ≥0.7
so the relief is unmistakable at retina.

### `portrait()` (FROZEN — added for the duels, docs/JARLS.md)

Draws a supplied image (HTMLImageElement or canvas; caller decodes the data
URI) **graded into the palette** inside a carved arch: desaturate ~25–35%,
warm oak-tone multiply, tar vignette, carved arch mask with gold groove rim —
the portrait must sit in the same light as the wood, never look pasted.
`opts`: `{ bow: 0..1 }` — yield animation driver: 0 upright, 1 fully bowed
(vertical dip ~8% of h + slight forward shear + dim toward tar; implement so
intermediate values render, shell tweens it); `{ white: true }` — replaces the
arch treatment with a **smallish flat bone-white border frame** (the credits
variant for JARL RAMON: straight edges, `bone` border ~3% of w, subtle shadow,
still lightly graded). Deterministic, no internal timers — the caller drives.

All painters must be deterministic for a given seed, resolution-independent
(work at any dpr), and cheap enough to repaint on resize without jank. Respect
`matchMedia('(prefers-reduced-motion: reduce)')`: time-driven drift freezes.

Wood recipe floor (do better if you can): base fill → 40–70 flow-following
grain strands (low-alpha, varied width, slight sine wander) → 3–5 darker knots
with ring ripples → pore stipple pass → carved-edge vignette. Layered onto an
offscreen canvas, cached, re-used as texture.

Runes: kernel segments give the skeleton; render with stroke width ~size/9,
round caps, slight double-pass (dark under, colour over, 1px offset) so they
read as chisel cuts. `mirror:true` flips x for wend-runes.
