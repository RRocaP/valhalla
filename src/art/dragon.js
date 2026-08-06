// drawDragonHead(): a carved Viking prow-beast — Oseberg grammar, cut from
// the same board as the chest: matte oak broken into chisel planes, with
// gold leaf surviving only on the proudest ridges. A museum artifact with
// its blood up: swept-back horns, a scale-carved neck, a parted snarl.
//
// Construction (docs/ART.md carve grammar):
//   1. a SPINE polyline — neck beziers rising in a recurve, then a
//      decreasing-radius volute appended C1-continuously off the muzzle
//      tangent, so the snout genuinely curls back on itself;
//   2. the body is that spine fleshed by two offset profiles (`up` = crest /
//      skull-top / inner face of the curl, `down` = throat / jaw) plus
//      gaussian BUMPS for the real skull landmarks (occiput, brow, the stop,
//      cheek, chin — and one purposeful nick where the parted jaws meet).
//      The OUTER EDGE stays one confident curve EXCEPT where the horns
//      spring off the crown and the jaw nick parts — both deliberate breaks;
//   3. rendering: matte banded chisel planes stepping darker toward the
//      throat, each boundary a crisp incision; TWO swept-back horns carved
//      off the crown — tapering faceted beams with ring-carved annuli, the
//      far horn peeking behind the near one; 2-3 rows of chip-carved scale
//      lobes shingling down the neck flank, roots in shadow, fading toward
//      the throat; a wave-mane of recurved lobes CUT INTO the crest band; a
//      SNARL — curled upper lip over a dark gape, carved relief teeth
//      (chisel-cut oak points catching light, never cartoon white), a
//      defined lower jaw, a sneer crease; a nostril spiral; a relief eye
//      under a sharpened brow. 'ember' is the same carving in warmer
//      un-gilded oak with a hearth rim-light instead of gilding.
//
// Anchor + box: (x, y) is the BASE OF THE NECK. The beast rises and curls
// inside the size x size box [x - size/2, x + size/2] x [y - size, y]; the
// horn tips deliberately graze the box top (ink y0 ~ -1.01, inside the
// measured FITS tolerance) and only the cast shadow bleeds a few percent
// past the box, down-right, as a cast shadow should. Deterministic: no rng,
// no clock — `t` only slides the specular glints, so a paused screen and a
// live one draw the same beast.
import { palette, rgba, mix } from './palette.js';
import { carveStroke, glow } from './util.js';

// ---------------------------------------------------------------- geometry

function bezPoint(p0, c1, c2, p1, t) {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0],
    a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1],
  ];
}

// tangent/normal frame per sample. +N is the crest side: the back of the
// neck, the top of the skull, the inner face of the curl.
function frames(pts) {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    pts[i].tx = dx;
    pts[i].ty = dy;
    pts[i].nx = dy;
    pts[i].ny = -dx;
  }
  return pts;
}

// smoothstep between table knots — a linear ramp leaves visible width creases
function lut(table, m) {
  if (m <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (m <= table[i][0]) {
      const [m0, v0] = table[i - 1];
      const [m1, v1] = table[i];
      const t = (m - m0) / (m1 - m0 || 1);
      return v0 + (v1 - v0) * (t * t * (3 - 2 * t));
    }
  }
  return table[table.length - 1][1];
}

function at(pts, m) {
  let lo = 0;
  let hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].m < m) lo = mid + 1;
    else hi = mid;
  }
  return pts[lo];
}

function poly(c, list) {
  c.moveTo(list[0][0], list[0][1]);
  for (let i = 1; i < list.length; i++) c.lineTo(list[i][0], list[i][1]);
}

// deterministic per-index jitter — hand tool marks are never evenly spaced
function chatter(i) {
  const v = Math.sin(i * 12.9898) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

// ------------------------------------------------------------- the carving

const SHAPE = {
  // base -> hard recurve back -> forward over the crest -> skull -> muzzle
  neck: [
    { p0: [0, 0], c1: [-0.03, -0.14], c2: [-0.215, -0.235], p1: [-0.235, -0.4], m0: 0, m1: 0.2 },
    { p0: [-0.235, -0.4], c1: [-0.25, -0.565], c2: [-0.155, -0.705], p1: [-0.02, -0.75], m0: 0.2, m1: 0.42 },
    { p0: [-0.02, -0.75], c1: [0.06, -0.782], c2: [0.115, -0.775], p1: [0.17, -0.745], m0: 0.42, m1: 0.6 },
    { p0: [0.17, -0.745], c1: [0.24, -0.722], c2: [0.315, -0.7], p1: [0.365, -0.715], m0: 0.6, m1: 0.85 },
  ],
  // tight and confident: a snout-tip volute lifting clear of the eye
  volute: { r0: 0.135, r1: 0.018, turns: 1.25, m0: 0.85 },
  up: [[0, 0.058], [0.09, 0.056], [0.25, 0.048], [0.38, 0.064], [0.46, 0.112], [0.55, 0.128], [0.63, 0.098], [0.7, 0.072], [0.78, 0.056], [0.85, 0.042], [0.92, 0.026], [1, 0.005]],
  // closed jaw: cheek mass flowing into a full lower-jaw line, no gape
  down: [[0, 0.064], [0.09, 0.062], [0.25, 0.05], [0.38, 0.075], [0.46, 0.118], [0.54, 0.138], [0.62, 0.124], [0.7, 0.098], [0.78, 0.072], [0.86, 0.048], [0.93, 0.026], [1, 0.006]],
  // skull landmarks cut into the silhouette — smooth gaussians only; the one
  // sharp exception is the jaw nick, a purposeful break where the jaws part
  bumps: [
    { side: 1, m: 0.44, sd: 0.04, amp: 0.018 },     // occipital knob
    { side: 1, m: 0.565, sd: 0.042, amp: 0.043 },   // brow, glowering over the eye
    { side: 1, m: 0.65, sd: 0.03, amp: -0.019 },    // the stop, before the muzzle
    { side: 1, m: 0.78, sd: 0.035, amp: 0.012 },    // nasal bridge
    { side: -1, m: 0.5, sd: 0.055, amp: 0.026 },    // cheek / jaw hinge
    { side: -1, m: 0.665, sd: 0.035, amp: 0.016 },  // chin under the parted jaw
    { side: -1, m: 0.885, sd: 0.018, amp: -0.013 }, // the nick where the jaws part
  ],
  // the mane: recurved wave lobes carved INTO the crest band, never past it
  // (m1 pulled back so the waves clear the horn root on the crown)
  crest: { m0: 0.13, m1: 0.49, count: 6, sweep: 1.5, floor: -0.12 },
  // horns: a centreline cubic in unit space swept back off the crown, fleshed
  // by a tapering half-width; the far horn is the same beam scaled about the
  // root and offset back so it peeks behind the near one
  horn: {
    root: [0.082, -0.878], c1: [0.095, -0.998], c2: [-0.05, -1.008], tip: [-0.185, -0.935],
    w0: 0.047, rings: 7, farOff: [-0.066, 0.008], farScale: 0.93,
  },
  // scale rows shingling the neck flank between the mane floor and the
  // throat: a dominant chain of big nested crescents spanning the flank and
  // a lower throat row, each free edge pointing down the neck. The flank is
  // narrow (~0.05 x size half-width), so the lobes must be near neck-wide to
  // read as carving — many small rows only ever read as corduroy.
  scales: { m0: 0.09, m1: 0.42 },
  // the SNARL: upper-lip and gape-floor rails in (m, u) space. The wedge
  // between them is the dark gape; teeth hang from the lip rail into it.
  mouth: {
    m0: 0.545, m1: 0.92,
    up: [[0.545, -0.6], [0.6, -0.46], [0.655, -0.335], [0.7, -0.295], [0.76, -0.33], [0.83, -0.315], [0.92, -0.3]],
    lo: [[0.545, -0.6], [0.62, -0.78], [0.7, -0.85], [0.76, -0.86], [0.83, -0.76], [0.885, -0.52], [0.92, -0.335]],
    teeth: [0.612, 0.672, 0.738, 0.803],
    fang: 0.601,
  },
  eye: { m: 0.6, u: 0.32, len: 0.09, h: 0.018 },
  nose: { m: 0.825, u: 0.3, r: 0.023, turns: 1.6 },
  collar: { mA: 0.045, mB: 0.085, notches: 6 },
};

function buildSpine(s) {
  const pts = [];
  SHAPE.neck.forEach((g, si) => {
    const N = 40;
    for (let i = si === 0 ? 0 : 1; i <= N; i++) {
      const t = i / N;
      const [px, py] = bezPoint(g.p0, g.c1, g.c2, g.p1, t);
      pts.push({ x: px * s, y: py * s, m: g.m0 + (g.m1 - g.m0) * t });
    }
  });
  frames(pts);
  const last = pts[pts.length - 1];
  const V = SHAPE.volute;
  const r0 = V.r0 * s;
  const r1 = V.r1 * s;
  const cx = last.x + last.nx * r0;
  const cy = last.y + last.ny * r0;
  const a0 = Math.atan2(last.y - cy, last.x - cx);
  const sweep = V.turns * Math.PI * 2;
  for (let i = 1; i <= 120; i++) {
    const k = i / 120;
    const a = a0 - sweep * k;
    const r = r0 * Math.pow(r1 / r0, k);
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, m: V.m0 + (1 - V.m0) * k });
  }
  return frames(pts);
}

// offset from the spine. u in [-1, 1]: -1 the throat/jaw edge, +1 the
// crest/skull edge; intermediate values are the chisel-plane lanes.
function lane(p, s, u) {
  const side = u >= 0 ? 1 : -1;
  let w = lut(side > 0 ? SHAPE.up : SHAPE.down, p.m) * s;
  for (const b of SHAPE.bumps) {
    if (b.side !== side) continue;
    const d = (p.m - b.m) / b.sd;
    w += Math.exp(-d * d) * b.amp * s;
  }
  w *= Math.abs(u);
  return [p.x + p.nx * w * side, p.y + p.ny * w * side];
}

// a cubic drawn in (m, u) parameter space and mapped through lane(), so
// every carved detail follows the mass it is cut into
function paramPath(pts, s, cps, n = 16) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const [m, u] = bezPoint(cps[0], cps[1], cps[2], cps[3], i / n);
    out.push(lane(at(pts, Math.max(0, Math.min(1, m))), s, u));
  }
  return out;
}

// horn beam: sample the centreline cubic, frame it, and flesh it with a
// tapering half-width. A = concave (under) edge, B = convex (upper) edge —
// B is the proud ridge that takes the light and the leaf.
function hornGeom(s, far) {
  const H = SHAPE.horn;
  const sc = far ? H.farScale : 1;
  const off = far ? H.farOff : [0, 0];
  const rt = H.root;
  const tp = (p) => [(rt[0] + (p[0] - rt[0]) * sc + off[0]) * s, (rt[1] + (p[1] - rt[1]) * sc + off[1]) * s];
  const p0 = tp(H.root);
  const c1 = tp(H.c1);
  const c2 = tp(H.c2);
  const p1 = tp(H.tip);
  const N = 26;
  const C = [];
  for (let i = 0; i <= N; i++) {
    const [px, py] = bezPoint(p0, c1, c2, p1, i / N);
    C.push({ x: px, y: py, k: i / N });
  }
  frames(C);
  const wAt = (k) => (H.w0 * Math.pow(1 - k, 1.28) + 0.003 * (1 - k)) * s * sc;
  const A = C.map((p) => [p.x + p.nx * wAt(p.k), p.y + p.ny * wAt(p.k)]);
  const B = C.map((p) => [p.x - p.nx * wAt(p.k), p.y - p.ny * wAt(p.k)]);
  const outline = (c) => {
    poly(c, A);
    for (let i = B.length - 2; i >= 0; i--) c.lineTo(B[i][0], B[i][1]);
    c.closePath();
  };
  return { C, A, B, wAt, outline };
}

// Matte carved oak. The carving is WOOD — warmer and a step lighter than the
// board it stands proud of — and the gilding is reduced to worn leaf on the
// proudest ridges. 'ember' is the same oak warmed by the hearth, un-gilded.
function tones(style, override) {
  const metal = override || (style === 'ember' ? palette.ember : palette.gold);
  if (style === 'ember') {
    const warmOak = mix(palette.oak, metal, 0.3);
    return {
      base: mix(warmOak, palette.oakDeep, 0.18),
      bright: mix(warmOak, palette.goldBright, 0.26),
      hollow: mix(palette.tar, metal, 0.12),
      ridge: mix(metal, palette.goldBright, 0.4),
      rim: mix(metal, palette.goldBright, 0.52),
    };
  }
  return {
    base: mix(palette.oakLight, metal, 0.3),
    bright: mix(palette.oakLight, palette.goldBright, 0.4),
    hollow: mix(palette.tar, palette.oak, 0.35),
    ridge: mix(palette.goldBright, metal, 0.25),
    rim: palette.goldBright,
  };
}

export function drawDragonHead(ctx, x, y, size, opts = {}) {
  const s = size;
  if (!(s > 0)) return;
  const facing = opts.facing === -1 ? -1 : 1;
  const style = opts.style === 'ember' ? 'ember' : 'proud';
  const t = typeof opts.t === 'number' ? opts.t : 0;
  const T = tones(style, palette[opts.color] || opts.color);
  const lod = s >= 190 ? 2 : s >= 86 ? 1 : 0;

  const pts = buildSpine(s);
  const upE = pts.map((p) => lane(p, s, 1));
  const dnE = pts.map((p) => lane(p, s, -1));
  const body = (c) => {
    poly(c, upE);
    for (let i = dnE.length - 1; i >= 0; i--) c.lineTo(dnE[i][0], dnE[i][1]);
    c.closePath();
  };
  const hornNear = hornGeom(s, false);
  const hornFar = hornGeom(s, true);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  // the hearth is above-left in WORLD space; mirroring the carving must not
  // mirror the light, so every carve lip flips with the facing.
  const dx = 0.85 * facing;
  const CUT = { width: Math.max(0.8, s * 0.006), dx, shadowAlpha: 0.38, liftColor: T.ridge, liftAlpha: 0.2, coreAlpha: 0.8 };

  // --- cast shadow: the carving (horns included) stands proud of the board
  ctx.save();
  ctx.translate(s * 0.016, s * 0.026);
  ctx.fillStyle = rgba(palette.tar, 0.42);
  ctx.beginPath();
  body(ctx);
  hornNear.outline(ctx);
  hornFar.outline(ctx);
  ctx.fill();
  ctx.restore();

  if (style === 'ember') glow(ctx, s * 0.02, -s * 0.7, s * 0.5, palette.ember, 0.32);

  // --- the FAR horn: behind the skull, a quieter darker beam whose curve
  // peeks past the near horn — the pair reads at a glance
  {
    const g = hornFar;
    ctx.save();
    ctx.fillStyle = mix(T.base, palette.tar, 0.44);
    ctx.beginPath();
    g.outline(ctx);
    ctx.fill();
    // a hair of light along its upper edge so it separates on tar grounds
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(mix(T.base, T.bright, 0.35), 0.5);
    ctx.lineWidth = Math.max(0.5, s * 0.0045);
    ctx.beginPath();
    poly(ctx, g.B.slice(3, 24));
    ctx.stroke();
    if (lod >= 1) {
      // faint annuli so the far beam is carved too, not a flat shadow
      ctx.strokeStyle = rgba(palette.tar, 0.4);
      ctx.lineWidth = Math.max(0.5, s * 0.005);
      for (const k of [0.22, 0.45, 0.66]) {
        const i = Math.round(k * (g.C.length - 1));
        const p = g.C[i];
        const w = g.wAt(p.k);
        ctx.beginPath();
        ctx.moveTo(g.A[i][0], g.A[i][1]);
        ctx.quadraticCurveTo(p.x + p.tx * w * 0.55, p.y + p.ty * w * 0.55, g.B[i][0], g.B[i][1]);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // --- the mass: matte base, one restrained top-light, then chisel planes
  ctx.save();
  ctx.beginPath();
  body(ctx);
  ctx.clip();
  ctx.fillStyle = T.base;
  ctx.fillRect(-s, -s * 1.3, s * 2.6, s * 1.7);
  const form = ctx.createLinearGradient(-s * 0.1, -s * 0.95, s * 0.12, 0);
  form.addColorStop(0, rgba(T.bright, 0.22));
  form.addColorStop(0.45, rgba(T.bright, 0));
  form.addColorStop(1, rgba(palette.tar, 0.2));
  ctx.fillStyle = form;
  ctx.fillRect(-s, -s * 1.3, s * 2.6, s * 1.7);

  // banded chisel planes — hard value steps lane to lane, darker toward the
  // throat, every boundary a crisp incision with a warm lip. This is the
  // difference between a filled silhouette and carved mass.
  const LANES = lod >= 2 ? [1, 0.52, 0.2, -0.12, -0.5, -1] : lod === 1 ? [1, 0.52, -0.12, -1] : [1, 0.5, -1];
  const BAND = lod >= 2 ? [0, 0, 0.12, 0.28, 0.48] : lod === 1 ? [0, 0.05, 0.34] : [0, 0.26];
  const laneLine = (u) => pts.map((p) => lane(p, s, u));
  // the skull-top plane takes the light — one restrained lift, face only;
  // on the neck the light belongs to the mane locks
  {
    const face = pts.filter((p) => p.m > 0.54);
    const aE = face.map((p) => lane(p, s, LANES[1]));
    const bE = face.map((p) => lane(p, s, LANES[2]));
    ctx.beginPath();
    poly(ctx, aE);
    for (let j = bE.length - 1; j >= 0; j--) ctx.lineTo(bE[j][0], bE[j][1]);
    ctx.closePath();
    ctx.fillStyle = rgba(T.bright, 0.09);
    ctx.fill();
  }
  for (let i = 0; i < LANES.length - 1; i++) {
    if (BAND[i] > 0) {
      const aE = laneLine(LANES[i]);
      const bE = laneLine(LANES[i + 1]);
      ctx.beginPath();
      poly(ctx, aE);
      for (let j = bE.length - 1; j >= 0; j--) ctx.lineTo(bE[j][0], bE[j][1]);
      ctx.closePath();
      ctx.fillStyle = rgba(T.hollow, BAND[i]);
      ctx.fill();
    }
    if (i > 0 && !(lod >= 2 && LANES[i] === -0.5)) {
      // (the deep -0.5 boundary is omitted at high LOD: the scale rows
      // articulate that flank themselves — a line would slice the lobes)
      // the crest-band boundary only shows on the face — in the mane zone it
      // would saw across the carved waves; the mid-lane boundary steps around
      // the eye socket instead of sawing under it; the deep throat boundary
      // stops at the mouth corner so it never saws through the gape
      const segs = LANES[i] > 0.4
        ? [pts.filter((p) => p.m > 0.63)]
        : LANES[i] > 0.05
          ? [pts.filter((p) => p.m > 0.665)]
          : LANES[i] < -0.3
            ? [pts.filter((p) => p.m < 0.545)]
            : [pts];
      ctx.save();
      ctx.lineCap = 'round';
      for (const seg of segs) {
        if (seg.length < 3) continue;
        const bpts = seg.map((p) => lane(p, s, LANES[i]));
        ctx.strokeStyle = rgba(palette.tar, 0.42);
        ctx.lineWidth = Math.max(0.6, s * 0.006);
        ctx.beginPath();
        poly(ctx, bpts);
        ctx.stroke();
        ctx.save();
        ctx.translate(dx * 0.9, 1.0);
        ctx.strokeStyle = rgba(T.ridge, 0.16);
        ctx.lineWidth = Math.max(0.5, s * 0.0045);
        ctx.beginPath();
        poly(ctx, bpts);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
  }

  // --- scale rows: chip-carved crescent lobes shingling down the neck
  // flank, free edges pointing down the neck, each root pooled in the shadow
  // of the lobe above it. They ride over the plane bands and fade toward the
  // throat — carved texture, still matte oak, never a fish costume.
  if (lod >= 1) {
    const SC = SHAPE.scales;
    // row A: the dominant chain spanning the flank; row B: a quieter throat
    // row shingled half a step behind — "2-3 rows, fading toward the throat"
    // two near-equal rows offset half a pitch — the quincunx lattice of
    // imbricated armor. A single chain reads as vertebrae, not scales.
    const rows = lod >= 2
      ? [{ u: -0.36, rU: 0.27, f: 1, off: 0 }, { u: -0.7, rU: 0.23, f: 0.82, off: 0.5 }]
      : [{ u: -0.46, rU: 0.34, f: 1, off: 0 }];
    // the chain is laid out in ARC LENGTH, not m — m-uniform steps bunch at
    // the slow end of the spine and stretch at the fast end
    const segPts = pts.filter((p) => p.m >= SC.m0 - 0.03 && p.m <= SC.m1 + 0.03);
    const cum = [0];
    for (let i = 1; i < segPts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(segPts[i].x - segPts[i - 1].x, segPts[i].y - segPts[i - 1].y));
    }
    const total = cum[cum.length - 1];
    const mFor = (d) => {
      if (d <= 0) return segPts[0].m;
      if (d >= total) return segPts[segPts.length - 1].m;
      let lo = 0;
      let hi = cum.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] < d) lo = mid + 1;
        else hi = mid;
      }
      const i = Math.max(1, lo);
      const f = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      return segPts[i - 1].m + (segPts[i].m - segPts[i - 1].m) * f;
    };
    const pitch = s * (lod >= 2 ? 0.048 : 0.08);
    const rMpx = pitch * 0.62;
    ctx.save();
    ctx.lineCap = 'round';
    rows.forEach((row, j) => {
      const count = Math.floor(total / pitch);
      for (let i = 0; i <= count; i++) {
        const d0 = (i + row.off) * pitch + chatter(i * 3 + j * 11) * pitch * 0.06;
        if (d0 < rMpx * 0.8 || d0 > total - rMpx * 0.4) continue;
        const env = row.f * Math.min(1, (total - d0) / (pitch * 1.2)) * Math.min(1, d0 / (pitch * 0.9));
        if (env <= 0.05) continue;
        // the lobe: a crescent bulging down the neck (toward the base)
        const arcAt = (shrink, push) => {
          const out = [];
          for (let q = 0; q <= 10; q++) {
            const th = (q / 10) * Math.PI;
            const m = mFor(d0 + push - Math.sin(th) * rMpx * shrink);
            out.push(lane(at(pts, m), s, row.u + Math.cos(th) * row.rU * (shrink * 0.9 + 0.1)));
          }
          return out;
        };
        const arc = arcAt(1, 0);
        // shadowed root first: the pool where the lobe above overlaps this one
        ctx.strokeStyle = rgba(palette.tar, 0.22 * env);
        ctx.lineWidth = Math.max(0.7, s * 0.007);
        ctx.beginPath();
        for (let q = 2; q <= 8; q++) {
          const th = (q / 10) * Math.PI;
          const m = mFor(d0 + rMpx * 0.5 - Math.sin(th) * rMpx * 0.55);
          const pt = lane(at(pts, m), s, row.u + Math.cos(th) * row.rU * 0.78);
          if (q === 2) ctx.moveTo(pt[0], pt[1]);
          else ctx.lineTo(pt[0], pt[1]);
        }
        ctx.stroke();
        // a whisper of face light so the lobe stands proud of the band
        const inner = arcAt(0.5, -rMpx * 0.08);
        ctx.beginPath();
        poly(ctx, arc);
        for (let q = inner.length - 1; q >= 0; q--) ctx.lineTo(inner[q][0], inner[q][1]);
        ctx.closePath();
        ctx.fillStyle = rgba(mix(T.base, T.bright, 0.5), 0.12 * env);
        ctx.fill();
        // the read lives in the OUTLINE: a bold chip-cut incision round the
        // free edge with a crisp lit rim just inside it — a scalloped chain,
        // the same grammar as the mane groove + lit shoulder
        ctx.strokeStyle = rgba(palette.tar, (0.5 + Math.abs(chatter(i + j * 7)) * 0.1) * env);
        ctx.lineWidth = Math.max(0.55, s * 0.006);
        ctx.beginPath();
        poly(ctx, arc);
        ctx.stroke();
        ctx.strokeStyle = rgba(mix(T.bright, T.rim, 0.25), 0.32 * env);
        ctx.lineWidth = Math.max(0.4, s * 0.0042);
        ctx.beginPath();
        poly(ctx, arcAt(0.78, -rMpx * 0.08));
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  // --- the mane: repeating wave lobes carved into the crest band. Each cut
  // is one confident C-sweep from the crest edge down to a floor rail; the
  // wave read comes from the alternation of wide chisel-scoop shadow on the
  // tail side, crisp incision, and lit face on the head side — no barbs, no
  // marks past the edge.
  {
    const C = SHAPE.crest;
    const step = (C.m1 - C.m0) / C.count;
    // each lock: a diagonal C-cut from the crest edge deep across the neck
    // to the mane floor just past the spine — the -0.12 plane boundary below
    // is the rail the waves break against
    const lobes = [];
    for (let k = 0; k <= C.count; k++) {
      const ms = C.m0 + k * step + chatter(k + 17) * 0.005;
      const len = step * C.sweep * (1 + chatter(k + 41) * 0.08);
      const cm = (v) => Math.max(0.1, v);
      lobes.push(paramPath(pts, s, [
        [cm(ms), 0.92], [cm(ms - len * 0.4), 0.72], [cm(ms - len * 0.8), 0.28], [cm(ms - len * 0.68), C.floor],
      ], 16));
    }
    // each lock body is its own rolled facet: lit along its head shoulder,
    // rolling into the shadow of the groove behind it — this alternation is
    // what reads as waves carved into one mass
    for (let k = 0; k + 1 < lobes.length; k++) {
      const a = lobes[k];
      const b = lobes[k + 1];
      const am = a[8];
      const bm = b[8];
      const g = ctx.createLinearGradient(bm[0], bm[1], am[0], am[1]);
      g.addColorStop(0, rgba(mix(T.bright, T.rim, 0.25), 0.4));
      g.addColorStop(0.55, rgba(T.bright, 0.07));
      g.addColorStop(1, rgba(palette.tar, 0.36));
      ctx.beginPath();
      poly(ctx, b);
      for (let j = a.length - 1; j >= 0; j--) ctx.lineTo(a[j][0], a[j][1]);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
    }
    // crisp incision down each groove
    for (let k = 1; k < lobes.length; k++) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(palette.tar, 0.62);
      ctx.lineWidth = Math.max(0.6, s * 0.008);
      ctx.beginPath();
      poly(ctx, lobes[k]);
      ctx.stroke();
      ctx.restore();
    }
    // the unbroken crest fillet riding above the waves — the silhouette edge
    // stays one continuous curve
    {
      const rim = pts.filter((p) => p.m > 0.1 && p.m < 0.52).map((p) => lane(p, s, 0.95));
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(T.ridge, 0.22);
      ctx.lineWidth = Math.max(0.5, s * 0.005);
      ctx.beginPath();
      poly(ctx, rim);
      ctx.stroke();
      ctx.restore();
    }
  }

  // hand tool chatter: short perpendicular ticks, unevenly spaced, confined
  // to the throat band below the scales so neither texture muddies the other
  if (lod >= 2) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.5, s * 0.005);
    for (let i = 0; i < 22; i++) {
      const m = Math.min(0.55, Math.max(0.03, 0.04 + (i / 22) * 0.5 + chatter(i) * 0.008));
      const p = at(pts, m);
      const u0 = -0.97 + Math.abs(chatter(i + 31)) * 0.1;
      const a = lane(p, s, u0);
      const b = lane(p, s, u0 + 0.13 + chatter(i + 61) * 0.04);
      ctx.strokeStyle = rgba(palette.tar, 0.1 + Math.abs(chatter(i + 91)) * 0.1);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  // deep shade hugging the throat edge
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(palette.tar, 0.38);
  ctx.lineWidth = Math.max(1.2, s * 0.045);
  ctx.beginPath();
  poly(ctx, dnE);
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  // --- the outline: a thin incision where the carving meets the board — the
  // cast shadow and the plane breaks do the modelling, not a sticker edge
  carveStroke(ctx, body, CUT);

  // --- the NEAR horn: a faceted beam swept back off the crown. Painted over
  // the body outline so it grows out of the skull; a root ring sockets it.
  {
    const g = hornNear;
    const H = SHAPE.horn;
    // the beam: base oak with one light-to-shade sweep across its width
    const mi = Math.round(g.C.length * 0.4);
    const grad = ctx.createLinearGradient(g.B[mi][0], g.B[mi][1], g.A[mi][0], g.A[mi][1]);
    grad.addColorStop(0, mix(T.base, T.bright, 0.36));
    grad.addColorStop(0.55, T.base);
    grad.addColorStop(1, mix(T.base, palette.tar, 0.44));
    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    g.outline(ctx);
    ctx.fill();
    ctx.restore();
    // facet ridge along the convex spine + a core shadow along the underside
    if (lod >= 1) {
      ctx.save();
      ctx.lineCap = 'round';
      const ridge = [];
      const under = [];
      for (let i = 1; i < g.C.length - 3; i++) {
        const p = g.C[i];
        const w = g.wAt(p.k);
        ridge.push([p.x - p.nx * w * 0.34, p.y - p.ny * w * 0.34]);
        under.push([p.x + p.nx * w * 0.4, p.y + p.ny * w * 0.4]);
      }
      ctx.strokeStyle = rgba(T.ridge, 0.34);
      ctx.lineWidth = Math.max(0.5, s * 0.005);
      ctx.beginPath();
      poly(ctx, ridge);
      ctx.stroke();
      ctx.strokeStyle = rgba(palette.tar, 0.3);
      ctx.lineWidth = Math.max(0.5, s * 0.007);
      ctx.beginPath();
      poly(ctx, under);
      ctx.stroke();
      ctx.restore();
    }
    // ring-carved annuli marching up the beam, tighter toward the tip; each
    // is an incision arced toward the tip with a warm lip on the tip side
    const rings = lod >= 2 ? H.rings : lod === 1 ? 5 : 3;
    ctx.save();
    ctx.lineCap = 'round';
    for (let j = 1; j <= rings; j++) {
      const k = Math.min(0.9, (j / (rings + 1)) * (1 + chatter(j + 5) * 0.05) * 0.92 + 0.06);
      const i = Math.round(k * (g.C.length - 1));
      const p = g.C[i];
      const w = g.wAt(p.k);
      const bulge = (cxp, f) => {
        cxp.moveTo(g.A[i][0], g.A[i][1]);
        cxp.quadraticCurveTo(p.x + p.tx * w * f, p.y + p.ty * w * f, g.B[i][0], g.B[i][1]);
      };
      ctx.strokeStyle = rgba(palette.tar, 0.52);
      ctx.lineWidth = Math.max(0.5, s * (0.0068 - k * 0.002));
      ctx.beginPath();
      bulge(ctx, 0.6);
      ctx.stroke();
      ctx.strokeStyle = rgba(T.ridge, 0.26);
      ctx.lineWidth = Math.max(0.4, s * 0.0045);
      ctx.beginPath();
      bulge(ctx, 0.95);
      ctx.stroke();
    }
    // the root ring: sockets the horn into the crown
    if (lod >= 1) {
      const i = 2;
      const p = g.C[i];
      const w = g.wAt(p.k);
      ctx.strokeStyle = rgba(palette.tar, 0.55);
      ctx.lineWidth = Math.max(0.6, s * 0.009);
      ctx.beginPath();
      ctx.moveTo(g.A[i][0], g.A[i][1]);
      ctx.quadraticCurveTo(p.x + p.tx * w * 0.5, p.y + p.ty * w * 0.5, g.B[i][0], g.B[i][1]);
      ctx.stroke();
    }
    ctx.restore();
    // the horn's own edge incision: open path round the exposed perimeter
    // only — never across the root, where beam and skull are one wood
    const rim = (c) => {
      poly(c, g.A.slice(1));
      for (let i = g.B.length - 2; i >= 1; i--) c.lineTo(g.B[i][0], g.B[i][1]);
    };
    carveStroke(ctx, rim, { ...CUT, width: Math.max(0.6, s * 0.005), shadowAlpha: 0.32, coreAlpha: 0.7 });
    // worn leaf on the proud ridge (proud) / hearth catch (ember)
    ctx.save();
    ctx.lineCap = 'butt';
    if (style === 'proud') {
      ctx.setLineDash([s * 0.045, s * 0.03, s * 0.018, s * 0.04]);
      ctx.strokeStyle = rgba(mix(palette.goldBright, palette.gold, 0.35), 0.45);
      ctx.lineWidth = Math.max(0.5, s * 0.0045);
    } else {
      ctx.strokeStyle = rgba(T.rim, 0.32);
      ctx.lineWidth = Math.max(0.6, s * 0.006);
    }
    ctx.beginPath();
    poly(ctx, g.B.slice(2, 22));
    ctx.stroke();
    ctx.restore();
  }

  // --- collar: the carving is socketed into the board, not floating on it
  const colA = at(pts, SHAPE.collar.mA);
  const colB = at(pts, SHAPE.collar.mB);
  const cross = (p) => (c) => {
    const a = lane(p, s, 1);
    const b = lane(p, s, -1);
    c.moveTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
  };
  carveStroke(ctx, cross(colA), { ...CUT, width: Math.max(0.7, s * 0.008) });
  carveStroke(ctx, cross(colB), { ...CUT, width: Math.max(0.6, s * 0.006) });
  if (lod >= 1) {
    const pm = at(pts, (SHAPE.collar.mA + SHAPE.collar.mB) / 2);
    ctx.save();
    ctx.fillStyle = rgba(palette.tar, 0.42);
    for (let i = 0; i < SHAPE.collar.notches; i++) {
      const u = -0.75 + (i / (SHAPE.collar.notches - 1)) * 1.5;
      const cpt = lane(pm, s, u);
      const d = s * 0.011;
      ctx.beginPath();
      ctx.moveTo(cpt[0] - pm.tx * d, cpt[1] - pm.ty * d);
      ctx.lineTo(cpt[0] + pm.nx * d, cpt[1] + pm.ny * d);
      ctx.lineTo(cpt[0] + pm.tx * d, cpt[1] + pm.ty * d);
      ctx.lineTo(cpt[0] - pm.nx * d, cpt[1] - pm.ny * d);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // --- the SNARL: the jaw parts. A curled upper lip rides over a dark gape
  // wedge; carved teeth hang into it as relief — chisel-cut oak points that
  // catch the light, never cartoon white — and the lower jaw holds its own
  // edge beneath. All of it carved INTO the mass; only the small nick at the
  // muzzle front breaks the silhouette, on purpose.
  const MO = SHAPE.mouth;
  const uUp = (m) => lut(MO.up, m);
  const uLo = (m) => lut(MO.lo, m);
  const railN = 26;
  const railM = (i) => MO.m0 + (MO.m1 - MO.m0) * (i / railN);
  const upRail = [];
  const loRail = [];
  for (let i = 0; i <= railN; i++) {
    const m = railM(i);
    upRail.push(lane(at(pts, m), s, uUp(m)));
    loRail.push(lane(at(pts, m), s, uLo(m)));
  }
  // the gape: darkest carved void on the beast
  ctx.save();
  ctx.beginPath();
  poly(ctx, upRail);
  for (let i = railN; i >= 0; i--) ctx.lineTo(loRail[i][0], loRail[i][1]);
  ctx.closePath();
  ctx.fillStyle = rgba(palette.tar, lod === 0 ? 0.85 : 0.78);
  ctx.fill();
  // deeper still toward the corner — the throat of the bite
  ctx.beginPath();
  for (let i = 0; i <= 14; i++) {
    const m = MO.m0 + (0.76 - MO.m0) * (i / 14);
    const p = lane(at(pts, m), s, uUp(m) + (uLo(m) - uUp(m)) * 0.18);
    if (i === 0) ctx.moveTo(p[0], p[1]);
    else ctx.lineTo(p[0], p[1]);
  }
  for (let i = 14; i >= 0; i--) {
    const m = MO.m0 + (0.76 - MO.m0) * (i / 14);
    const p = lane(at(pts, m), s, uUp(m) + (uLo(m) - uUp(m)) * 0.85);
    ctx.lineTo(p[0], p[1]);
  }
  ctx.closePath();
  ctx.fillStyle = rgba(palette.tar, 0.5);
  ctx.fill();
  ctx.restore();
  // the lower jaw's lit edge — defined, not lost in the shade
  if (lod >= 1) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.translate(dx * 0.5, 0.8);
    ctx.strokeStyle = rgba(mix(T.base, T.bright, 0.34), 0.65);
    ctx.lineWidth = Math.max(0.5, s * 0.0058);
    ctx.beginPath();
    poly(ctx, loRail.slice(2, railN - 1));
    ctx.stroke();
    ctx.restore();
  }
  // teeth: carved points hanging from the lip rail; roots tucked under the
  // lip, tips raked slightly back — plus one lower fang rising at the corner.
  // Lengths and widths vary tooth to tooth: a carver's row, not a saw blade.
  const toothRow = lod >= 1 ? [...MO.teeth, 0.862] : [0.617, 0.712, 0.8];
  const toothLen = lod >= 1 ? [0.74, 0.48, 0.6, 0.68, 0.46] : [0.7, 0.62, 0.7];
  const toothW = lod >= 1 ? [0.018, 0.012, 0.015, 0.017, 0.011] : [0.024, 0.022, 0.024];
  const drawTooth = (mt, h, rootU, tipU, tipM, tone) => {
    const pb = lane(at(pts, mt - h), s, rootU);
    const pf = lane(at(pts, mt + h), s, rootU);
    const tip = lane(at(pts, tipM), s, tipU);
    const cb = lane(at(pts, mt - h * 0.85), s, rootU + (tipU - rootU) * 0.45);
    const cf = lane(at(pts, mt + h * 0.45), s, rootU + (tipU - rootU) * 0.5);
    ctx.beginPath();
    ctx.moveTo(pb[0], pb[1]);
    ctx.quadraticCurveTo(cb[0], cb[1], tip[0], tip[1]);
    ctx.quadraticCurveTo(cf[0], cf[1], pf[0], pf[1]);
    ctx.closePath();
    ctx.fillStyle = rgba(tone, 0.96);
    ctx.fill();
    if (lod >= 1) {
      // the shadowed back facet of the chisel cut
      ctx.strokeStyle = rgba(palette.tar, 0.45);
      ctx.lineWidth = Math.max(0.4, s * 0.004);
      ctx.beginPath();
      ctx.moveTo(pb[0], pb[1]);
      ctx.quadraticCurveTo(cb[0], cb[1], tip[0], tip[1]);
      ctx.stroke();
      // the point catching light
      ctx.strokeStyle = rgba(T.rim, 0.5);
      ctx.lineWidth = Math.max(0.4, s * 0.0035);
      ctx.beginPath();
      ctx.moveTo(tip[0], tip[1]);
      ctx.lineTo(tip[0] + (cf[0] - tip[0]) * 0.25, tip[1] + (cf[1] - tip[1]) * 0.25);
      ctx.stroke();
    }
  };
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < toothRow.length; i++) {
    const mt = toothRow[i] + chatter(i + 23) * 0.005;
    const rootU = uUp(mt) - 0.03 + chatter(i + 53) * 0.012;
    const tipU = rootU + (uLo(mt) - rootU) * (toothLen[i] + Math.abs(chatter(i + 47)) * 0.06);
    // at prow-terminal scale the points must carry the snarl on their own
    drawTooth(mt, toothW[i], rootU, tipU, mt - 0.008, mix(T.base, T.bright, lod >= 1 ? 0.36 : 0.52));
  }
  if (lod >= 1) {
    const mf = MO.fang;
    const rootU = uLo(mf) + 0.05;
    const tipU = rootU + (uUp(mf) - rootU) * 0.62;
    drawTooth(mf, 0.013, rootU, tipU, mf + 0.011, mix(T.base, T.bright, 0.3));
  }
  ctx.restore();
  // the curled upper lip: a proud carved ridge rolling over the gape
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(palette.tar, 0.6);
  ctx.lineWidth = Math.max(0.8, s * 0.005);
  ctx.beginPath();
  poly(ctx, upRail);
  ctx.stroke();
  ctx.restore();
  if (lod >= 1) {
    carveStroke(ctx, (c) => poly(c, upRail), {
      width: Math.max(0.6, s * 0.0065), dx,
      shadowAlpha: 0.4, liftColor: T.ridge, liftAlpha: 0.28, coreAlpha: 0.8,
    });
    // the sneer: a crease bunching above the curled lip
    const sneer = paramPath(pts, s, [
      [0.652, -0.22], [0.68, -0.11], [0.72, -0.09], [0.758, -0.16],
    ], 12);
    carveStroke(ctx, (c) => poly(c, sneer), {
      width: Math.max(0.5, s * 0.0055), dx, shadowAlpha: 0.36, liftColor: T.ridge, liftAlpha: 0.2, coreAlpha: 0.68,
    });
    if (lod >= 2) {
      const sneer2 = paramPath(pts, s, [
        [0.69, -0.26], [0.715, -0.175], [0.745, -0.16], [0.775, -0.215],
      ], 10);
      carveStroke(ctx, (c) => poly(c, sneer2), {
        width: Math.max(0.4, s * 0.004), dx, shadowAlpha: 0.22, liftColor: T.ridge, liftAlpha: 0.12, coreAlpha: 0.45,
      });
    }
  }
  // the corner hook — the gape ends in a stern downturn toward the jaw hinge
  const hook = paramPath(pts, s, [
    [MO.m0, -0.6], [0.534, -0.7], [0.53, -0.8], [0.541, -0.88],
  ], 10);
  carveStroke(ctx, (c) => poly(c, hook), {
    width: Math.max(0.5, s * 0.006), dx, shadowAlpha: 0.35, liftColor: T.ridge, liftAlpha: 0.2, coreAlpha: 0.7,
  });

  // --- cheek spiral: the Oseberg jaw-hinge volute, incised into the cheek
  if (lod >= 1) {
    const kp = at(pts, 0.485);
    const kc = lane(kp, s, -0.42);
    const kr = s * 0.042;
    const ka0 = Math.atan2(kp.ty, kp.tx) + Math.PI * 0.6;
    const kspiral = [];
    for (let i = 0; i <= 30; i++) {
      const f = i / 30;
      const a = ka0 + f * 1.4 * Math.PI * 2;
      const r = kr * (1 - f * 0.78);
      kspiral.push([kc[0] + Math.cos(a) * r, kc[1] + Math.sin(a) * r]);
    }
    carveStroke(ctx, (c) => poly(c, kspiral), {
      width: Math.max(0.5, s * 0.005), dx, shadowAlpha: 0.28, liftColor: T.ridge, liftAlpha: 0.16, coreAlpha: 0.55,
    });
  }

  // --- nostril: a spiral incision at the base of the snout curl
  const np = at(pts, SHAPE.nose.m);
  const nc = lane(np, s, SHAPE.nose.u);
  const nr = Math.max(1, s * SHAPE.nose.r);
  ctx.save();
  ctx.fillStyle = rgba(palette.tar, 0.7);
  ctx.beginPath();
  ctx.ellipse(nc[0], nc[1], nr * 0.4, nr * 0.26, Math.atan2(np.ty, np.tx), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (lod >= 1) {
    const spiral = [];
    const a0 = Math.atan2(np.ty, np.tx) + Math.PI * 0.25;
    for (let i = 0; i <= 24; i++) {
      const f = i / 24;
      const a = a0 + f * SHAPE.nose.turns * Math.PI * 2;
      const r = nr * (1 - f * 0.75);
      spiral.push([nc[0] + Math.cos(a) * r, nc[1] + Math.sin(a) * r]);
    }
    carveStroke(ctx, (c) => poly(c, spiral), {
      width: Math.max(0.5, s * 0.0055), dx, shadowAlpha: 0.3, liftColor: T.ridge, liftAlpha: 0.18, coreAlpha: 0.65,
    });
  }

  // --- the eye: a RELIEF eye — shadowed socket, carved almond, drilled iris
  // disc, lid ridge above with a worn-gold glint. Modest, like the Oseberg
  // beasts: the carving is stern, not startled.
  const E = SHAPE.eye;
  const ep = at(pts, E.m);
  const ec = lane(ep, s, E.u);
  const half = Math.max(2, s * E.len / 2);
  const rise = Math.max(0.9, s * E.h);
  const F = [ec[0] + ep.tx * half, ec[1] + ep.ty * half];
  const R = [ec[0] - ep.tx * half, ec[1] - ep.ty * half];
  const tilt = Math.atan2(ep.ty, ep.tx);
  const almond = (c) => {
    c.moveTo(R[0], R[1]);
    c.quadraticCurveTo(ec[0] + ep.nx * rise * 1.55, ec[1] + ep.ny * rise * 1.55, F[0], F[1]);
    c.quadraticCurveTo(ec[0] - ep.nx * rise * 1.35, ec[1] - ep.ny * rise * 1.35, R[0], R[1]);
    c.closePath();
  };
  // socket shadow — a soft crescent under the brow, deepened for the glower
  ctx.save();
  ctx.fillStyle = rgba(palette.tar, 0.27);
  ctx.beginPath();
  ctx.ellipse(ec[0] + ep.nx * rise * 0.6, ec[1] + ep.ny * rise * 0.6, half * 1.28, rise * 2.3, tilt, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (lod === 0) {
    // at prow-terminal scale the eye is a carved pit with one glint above
    ctx.save();
    ctx.fillStyle = mix(palette.tar, palette.oakDeep, 0.3);
    ctx.beginPath();
    almond(ctx);
    ctx.fill();
    ctx.fillStyle = rgba(T.rim, 0.8);
    ctx.beginPath();
    ctx.arc(ec[0] + ep.nx * rise * 2, ec[1] + ep.ny * rise * 2, Math.max(0.5, s * 0.007), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    // raised eyeball in relief
    ctx.save();
    ctx.fillStyle = mix(T.base, T.bright, 0.3);
    ctx.beginPath();
    almond(ctx);
    ctx.fill();
    // the socket's own shadow, pooled under the lid across the eyeball top
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(palette.tar, 0.4);
    ctx.lineWidth = Math.max(0.6, rise * 0.7);
    ctx.beginPath();
    ctx.moveTo(R[0] + ep.nx * rise * 0.55, R[1] + ep.ny * rise * 0.55);
    ctx.quadraticCurveTo(ec[0] + ep.nx * rise * 2.1, ec[1] + ep.ny * rise * 2.1,
      F[0] + ep.nx * rise * 0.55, F[1] + ep.ny * rise * 0.55);
    ctx.stroke();
    ctx.restore();
    // drilled iris disc, forward of centre
    const ic = [ec[0] + ep.tx * half * 0.12, ec[1] + ep.ty * half * 0.12];
    const ir = Math.min(rise * 1.05, half * 0.5);
    ctx.save();
    ctx.fillStyle = mix(palette.oakDeep, palette.tar, 0.5);
    ctx.beginPath();
    ctx.arc(ic[0], ic[1], ir, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(palette.tar, 0.8);
    ctx.lineWidth = Math.max(0.5, s * 0.004);
    ctx.beginPath();
    ctx.arc(ic[0], ic[1], ir, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = palette.tar;
    ctx.beginPath();
    ctx.arc(ic[0], ic[1], Math.max(0.4, ir * 0.35), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // almond incision + a hair of light on the eyeball's upper edge
    ctx.save();
    ctx.strokeStyle = rgba(palette.tar, 0.7);
    ctx.lineWidth = Math.max(0.5, s * 0.005);
    ctx.beginPath();
    almond(ctx);
    ctx.stroke();
    ctx.translate(-dx * 0.3, -0.5);
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(T.bright, 0.4);
    ctx.lineWidth = Math.max(0.4, s * 0.0045);
    ctx.beginPath();
    ctx.moveTo(R[0], R[1]);
    ctx.quadraticCurveTo(ec[0] + ep.nx * rise * 1.55, ec[1] + ep.ny * rise * 1.55, F[0], F[1]);
    ctx.stroke();
    ctx.restore();
  }
  // lid ridge above the eye: shadow under it (into the socket), a warm ridge,
  // and the worn-gold glint on its upper edge — the one place t breathes
  const lidR = [R[0] - ep.tx * half * 0.15 + ep.nx * rise * 1.7, R[1] - ep.ty * half * 0.15 + ep.ny * rise * 1.7];
  const lidF = [F[0] + ep.tx * half * 0.2 + ep.nx * rise * 1.35, F[1] + ep.ty * half * 0.2 + ep.ny * rise * 1.35];
  const lidC = [ec[0] + ep.nx * rise * 2.7, ec[1] + ep.ny * rise * 2.7];
  if (lod >= 1) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.translate(dx * 0.6, 1);
    ctx.strokeStyle = rgba(palette.tar, 0.5);
    ctx.lineWidth = Math.max(0.7, s * 0.009);
    ctx.beginPath();
    ctx.moveTo(lidR[0], lidR[1]);
    ctx.quadraticCurveTo(lidC[0], lidC[1], lidF[0], lidF[1]);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(mix(T.base, T.bright, 0.38), 0.85);
    ctx.lineWidth = Math.max(0.7, s * 0.0085);
    ctx.beginPath();
    ctx.moveTo(lidR[0], lidR[1]);
    ctx.quadraticCurveTo(lidC[0], lidC[1], lidF[0], lidF[1]);
    ctx.stroke();
    // the glint: a short worn-leaf dash sliding slightly with t
    const qp = (f) => {
      const a = (1 - f) * (1 - f);
      const b = 2 * (1 - f) * f;
      const c = f * f;
      return [
        a * lidR[0] + b * lidC[0] + c * lidF[0] - dx * 0.4,
        a * lidR[1] + b * lidC[1] + c * lidF[1] - 0.8,
      ];
    };
    const g0 = qp(0.32 + t * 0.1);
    const g1 = qp(0.46 + t * 0.1);
    ctx.strokeStyle = rgba(T.rim, 0.7);
    ctx.lineWidth = Math.max(0.5, s * 0.0055);
    ctx.beginPath();
    ctx.moveTo(g0[0], g0[1]);
    ctx.lineTo(g1[0], g1[1]);
    ctx.stroke();
    ctx.restore();
  }

  // --- worn gold leaf, broken dashes on the proudest ridges only (proud);
  // the ember beast is un-gilded and takes the hearth rim-light instead
  if (style === 'proud') {
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.setLineDash([s * 0.07, s * 0.042, s * 0.024, s * 0.058]);
    ctx.strokeStyle = rgba(mix(palette.goldBright, palette.gold, 0.35), 0.5);
    ctx.lineWidth = Math.max(0.6, s * 0.005);
    ctx.beginPath();
    // the run starts forward of the horn root — leaf never streaks the horn
    poly(ctx, pts.filter((p) => p.m > 0.585 && p.m < 0.97).map((p) => lane(p, s, 0.93)));
    ctx.stroke();
    ctx.restore();
  } else {
    // hearth rim-light: warm catch on every edge run that faces the fire;
    // the crest run under the horn root is skipped — the horn owns that edge
    const lit = (edge, outSign) => {
      const runs = [];
      let cur = null;
      for (let i = 0; i < edge.length; i++) {
        const p = pts[i];
        if (outSign > 0 && p.m > 0.45 && p.m < 0.585) { cur = null; continue; }
        const catch_ = (facing * p.nx * outSign) * -0.66 + (p.ny * outSign) * -0.75;
        if (catch_ > 0.38) {
          if (!cur) { cur = []; runs.push(cur); }
          cur.push(edge[i]);
        } else cur = null;
      }
      return runs.filter((r) => r.length > 6);
    };
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(T.rim, 0.36);
    ctx.lineWidth = Math.max(0.8, s * 0.008);
    for (const run of [...lit(upE, 1), ...lit(dnE, -1)]) {
      ctx.beginPath();
      poly(ctx, run);
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- the one moving catch-light on the crest ridge
  if (lod >= 1) {
    ctx.save();
    ctx.strokeStyle = rgba(mix(palette.bone, palette.goldBright, 0.5), 0.24);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.6, s * 0.007);
    ctx.beginPath();
    // riding the brow ridge, forward of the horn root
    const a1 = lane(at(pts, 0.59 + t * 0.02), s, 0.94);
    const b1 = lane(at(pts, 0.655 + t * 0.02), s, 0.94);
    ctx.moveTo(a1[0], a1[1]);
    ctx.lineTo(b1[0], b1[1]);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}
