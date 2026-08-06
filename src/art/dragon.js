// drawDragonHead(): a carved Viking prow-beast — Oseberg grammar, cut from
// the same board as the chest: matte oak broken into chisel planes, with
// gold leaf surviving only on the proudest ridges. A museum artifact, not a
// mascot: closed jaw, relief eye, one confident silhouette.
//
// Construction (docs/ART.md carve grammar):
//   1. a SPINE polyline — neck beziers rising in a recurve, then a
//      decreasing-radius volute appended C1-continuously off the muzzle
//      tangent, so the snout genuinely curls back on itself;
//   2. the body is that spine fleshed by two offset profiles (`up` = crest /
//      skull-top / inner face of the curl, `down` = throat / closed jaw)
//      plus gaussian BUMPS for the real skull landmarks (occiput, brow, the
//      stop, cheek, chin). The OUTER EDGE is one continuous curve — every
//      ornament lives inside it;
//   3. rendering: matte banded chisel planes stepping darker toward the
//      throat, each boundary a crisp incision; long striations following the
//      neck; a wave-mane of recurved lobes CUT INTO the crest band; a closed
//      lip-line groove with a corner hook; a nostril spiral at the volute
//      base; a relief eye (socket shadow, carved almond, drilled iris disc,
//      lid ridge with a worn-gold glint); broken gold-leaf dashes on the
//      proud ridges only. 'ember' is the same carving in warmer un-gilded
//      oak with a hearth rim-light instead of gilding.
//
// Anchor + box: (x, y) is the BASE OF THE NECK. The beast rises and curls
// inside the size x size box [x - size/2, x + size/2] x [y - size, y]; only
// the cast shadow bleeds a few percent past it, down-right, as a cast shadow
// should. Deterministic: no rng, no clock — `t` only slides the specular
// glints, so a paused screen and a live one draw the same beast.
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
  // skull landmarks cut into the silhouette — smooth gaussians only, so the
  // outer edge stays one confident curve
  bumps: [
    { side: 1, m: 0.44, sd: 0.04, amp: 0.018 },     // occipital knob
    { side: 1, m: 0.565, sd: 0.045, amp: 0.034 },   // brow, jutting over the eye
    { side: 1, m: 0.65, sd: 0.03, amp: -0.016 },    // the stop, before the muzzle
    { side: 1, m: 0.78, sd: 0.035, amp: 0.012 },    // nasal bridge
    { side: -1, m: 0.5, sd: 0.055, amp: 0.026 },    // cheek / jaw hinge
    { side: -1, m: 0.64, sd: 0.035, amp: 0.014 },   // chin under the closed jaw
  ],
  // the mane: recurved wave lobes carved INTO the crest band, never past it
  crest: { m0: 0.13, m1: 0.52, count: 6, sweep: 1.5, floor: -0.12 },
  // closed mouth: a lip-line groove from the corner to the snout tip
  lip: { m0: 0.545, m1: 0.94, u0: -0.62, u1: -0.32 },
  eye: { m: 0.6, u: 0.32, len: 0.09, h: 0.018 },
  nose: { m: 0.825, u: 0.3, r: 0.02, turns: 1.6 },
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

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  // the hearth is above-left in WORLD space; mirroring the carving must not
  // mirror the light, so every carve lip flips with the facing.
  const dx = 0.85 * facing;
  const CUT = { width: Math.max(0.8, s * 0.006), dx, shadowAlpha: 0.38, liftColor: T.ridge, liftAlpha: 0.2, coreAlpha: 0.8 };

  // --- cast shadow: the carving stands proud of the board
  ctx.save();
  ctx.translate(s * 0.016, s * 0.026);
  ctx.fillStyle = rgba(palette.tar, 0.42);
  ctx.beginPath();
  body(ctx);
  ctx.fill();
  ctx.restore();

  if (style === 'ember') glow(ctx, s * 0.02, -s * 0.7, s * 0.5, palette.ember, 0.32);

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
    if (i > 0) {
      // the crest-band boundary only shows on the face — in the mane zone it
      // would saw across the carved waves; the mid-lane boundary steps around
      // the eye socket instead of sawing under it
      // upper boundaries live on the face only: in the mane band they would
      // saw across the waves, and under the eye they would crowd the socket
      const segs = LANES[i] > 0.4
        ? [pts.filter((p) => p.m > 0.63)]
        : LANES[i] > 0.05
          ? [pts.filter((p) => p.m > 0.665)]
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

  // long chisel striations following the neck — most of the "carved mass"
  // read lives in these tool runs
  if (lod >= 1) {
    ctx.save();
    ctx.lineCap = 'round';
    const runs = lod >= 2 ? [-0.3, -0.55, -0.78] : [-0.4];
    runs.forEach((u, k) => {
      const path = pts.filter((p) => p.m > 0.04 && p.m < 0.52)
        .map((p) => lane(p, s, u + chatter(k * 7) * 0.03));
      if (path.length < 3) return;
      ctx.strokeStyle = rgba(palette.tar, 0.2 + Math.abs(chatter(k + 3)) * 0.09);
      ctx.lineWidth = Math.max(0.5, s * 0.0055);
      ctx.beginPath();
      poly(ctx, path);
      ctx.stroke();
      ctx.save();
      ctx.translate(dx * 0.8, 0.9);
      ctx.strokeStyle = rgba(T.ridge, 0.1);
      ctx.lineWidth = Math.max(0.4, s * 0.0038);
      ctx.beginPath();
      poly(ctx, path);
      ctx.stroke();
      ctx.restore();
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

  // hand tool chatter: short perpendicular ticks, unevenly spaced, kept off
  // the mane band so the waves stay the loudest cut
  if (lod >= 2) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.5, s * 0.005);
    for (let i = 0; i < 40; i++) {
      const m = Math.min(0.55, Math.max(0.03, 0.04 + (i / 40) * 0.5 + chatter(i) * 0.008));
      const p = at(pts, m);
      const u0 = -0.9 + Math.abs(chatter(i + 31)) * 0.55;
      const a = lane(p, s, u0);
      const b = lane(p, s, Math.min(0.3, u0 + 0.32 + chatter(i + 61) * 0.12));
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

  // --- the mouth: closed. A carved lip-line groove from the corner to the
  // snout tip, barely parted — a hair of shadow, never a void.
  const L = SHAPE.lip;
  const lipPts = [];
  for (let i = 0; i <= 26; i++) {
    const f = i / 26;
    const m = L.m0 + (L.m1 - L.m0) * f;
    const u = L.u0 + (L.u1 - L.u0) * (f * f * (3 - 2 * f));
    lipPts.push(lane(at(pts, m), s, u));
  }
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(palette.tar, 0.6);
  ctx.lineWidth = Math.max(0.8, s * 0.005);
  ctx.beginPath();
  poly(ctx, lipPts);
  ctx.stroke();
  ctx.restore();
  carveStroke(ctx, (c) => poly(c, lipPts), {
    width: Math.max(0.6, s * 0.0065), dx,
    shadowAlpha: 0.4, liftColor: T.ridge, liftAlpha: 0.28, coreAlpha: 0.8,
  });
  // the corner hook — the mouth ends in a small stern downturn
  const hook = paramPath(pts, s, [
    [L.m0, L.u0], [0.534, -0.7], [0.53, -0.8], [0.541, -0.88],
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
  // socket shadow — a soft crescent under the brow, not a patch
  ctx.save();
  ctx.fillStyle = rgba(palette.tar, 0.22);
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
    poly(ctx, pts.filter((p) => p.m > 0.44 && p.m < 0.97).map((p) => lane(p, s, 0.93)));
    ctx.stroke();
    ctx.restore();
  } else {
    // hearth rim-light: warm catch on every edge run that faces the fire
    const lit = (edge, outSign) => {
      const runs = [];
      let cur = null;
      for (let i = 0; i < edge.length; i++) {
        const p = pts[i];
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
    const a1 = lane(at(pts, 0.5 + t * 0.02), s, 0.94);
    const b1 = lane(at(pts, 0.565 + t * 0.02), s, 0.94);
    ctx.moveTo(a1[0], a1[1]);
    ctx.lineTo(b1[0], b1[1]);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}
