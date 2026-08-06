// drawDragonHead(): a carved Viking prow-beast — Oseberg grammar, cut from
// the same board as the chest and gilded like the rest of the metalwork.
//
// Construction (docs/ART.md carve grammar):
//   1. a SPINE polyline — neck beziers rising in a recurve, then a
//      decreasing-radius volute appended C1-continuously off the muzzle
//      tangent, so the snout genuinely curls back on itself;
//   2. the body is that spine fleshed by two offset profiles (`up` = crest /
//      skull-top / inner face of the curl, `down` = throat / palate), plus
//      gaussian BUMPS cutting the real skull landmarks into the silhouette
//      (brow over the eye, cheek at the jaw hinge, the stop before the
//      muzzle) and a SERRATION that grows the cockscomb out of the nape
//      itself rather than sticking spikes onto it;
//   3. the mass is broken into chisel PLANES — lane-to-lane bands stepping
//      darker toward the shadow edge, every boundary a crisp incision — so
//      the gilding survives on the proud ridges and is worn back to dark oak
//      in the hollows, which is what separates carved wood from a filled
//      shape.
//
// Anchor + box: (x, y) is the BASE OF THE NECK. The beast rises and curls
// inside the size x size box [x - size/2, x + size/2] x [y - size, y]; only
// the cast shadow bleeds a few percent past it, down-right, as a cast shadow
// should. Deterministic: no rng, no clock — `t` only slides the specular
// glints, so a paused screen and a live one draw the same beast.
import { palette, rgba, mix } from './palette.js';
import { carveStroke, glow } from './util.js';
import { fillGoldLayered } from './gold.js';
import { drawKnot } from './knot.js';

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

function rot(v, a) {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return [ca * v[0] - sa * v[1], sa * v[0] + ca * v[1]];
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
  // tight and confident: a snout-tip volute lifting clear of the eye, not a
  // trunk swallowing the face
  volute: { r0: 0.135, r1: 0.018, turns: 1.25, m0: 0.85 },
  up: [[0, 0.058], [0.09, 0.056], [0.25, 0.048], [0.38, 0.064], [0.46, 0.115], [0.55, 0.132], [0.63, 0.1], [0.7, 0.072], [0.78, 0.055], [0.85, 0.042], [0.92, 0.026], [1, 0.005]],
  down: [[0, 0.064], [0.09, 0.062], [0.25, 0.048], [0.38, 0.07], [0.45, 0.14], [0.52, 0.175], [0.6, 0.145], [0.68, 0.1], [0.76, 0.075], [0.85, 0.05], [0.92, 0.028], [1, 0.005]],
  // skull landmarks cut into the silhouette
  bumps: [
    { side: 1, m: 0.44, sd: 0.035, amp: 0.022 },    // occipital knob
    { side: 1, m: 0.555, sd: 0.045, amp: 0.042 },   // brow, jutting over the eye
    { side: 1, m: 0.645, sd: 0.03, amp: -0.02 },    // the stop, before the muzzle
    { side: 1, m: 0.79, sd: 0.03, amp: 0.016 },     // nostril flare
    { side: -1, m: 0.48, sd: 0.05, amp: 0.04 },     // cheek / jaw hinge
    { side: -1, m: 0.72, sd: 0.06, amp: 0.03 },     // upper jaw depth
    { side: -1, m: 0.82, sd: 0.022, amp: 0.014 },   // upper lip
  ],
  // the cockscomb: sawteeth grown out of the nape, leaning toward the head
  serr: { m0: 0.06, m1: 0.52, amp: 0.052, period: 0.077, rise: 0.8 },
  jaw: {
    hingeM: 0.49, dirM: 0.74, angle: 0.2, len: 0.36, bow: 0.05,
    biteM: 0.56, lipM: 0.83,
    thick: [[0, 0.085], [0.32, 0.062], [0.68, 0.046], [0.9, 0.03], [1, 0.009]],
  },
  eye: { m: 0.6, off: 0.04, len: 0.115, h: 0.025 },
  nose: { m: 0.79, off: 0.048, r: 0.026 },
  chip: { m0: 0.12, m1: 0.45, count: 8, depth: 0.032 },
  mane: { m0: 0.1, m1: 0.44, amp: 0.02, waves: 2, width: 0.009 },
};

function serration(m) {
  const S = SHAPE.serr;
  if (m < S.m0 || m > S.m1) return 0;
  const f = ((m - S.m0) / S.period) % 1;
  const tri = f < S.rise ? f / S.rise : (1 - f) / (1 - S.rise);
  const env = Math.min(1, (m - S.m0) / 0.045) * Math.min(1, (S.m1 - m) / 0.055);
  return S.amp * tri * env;
}

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

// offset from the spine. u in [-1, 1]: -1 the throat/palate edge, +1 the
// crest/skull edge; intermediate values are the chisel-plane lanes. The comb
// only rides the outermost lanes, so the interior planes stay smooth.
function lane(p, s, u) {
  const side = u >= 0 ? 1 : -1;
  let w = lut(side > 0 ? SHAPE.up : SHAPE.down, p.m) * s;
  for (const b of SHAPE.bumps) {
    if (b.side !== side) continue;
    const d = (p.m - b.m) / b.sd;
    w += Math.exp(-d * d) * b.amp * s;
  }
  w *= Math.abs(u);
  if (side > 0) w += serration(p.m) * s * Math.max(0, (Math.abs(u) - 0.72) / 0.28);
  return [p.x + p.nx * w * side, p.y + p.ny * w * side];
}

// a tapered limb (the lower jaw) with its own short spine
function limb(origin, dir, len, bow, thick, s) {
  const pts = [];
  const end = [origin[0] + dir[0] * len, origin[1] + dir[1] * len];
  const nrm = [dir[1], -dir[0]];
  const c1 = [origin[0] + dir[0] * len * 0.38 - nrm[0] * len * bow, origin[1] + dir[1] * len * 0.38 - nrm[1] * len * bow];
  const c2 = [origin[0] + dir[0] * len * 0.76 - nrm[0] * len * bow * 0.45, origin[1] + dir[1] * len * 0.76 - nrm[1] * len * bow * 0.45];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const [x, y] = bezPoint(origin, c1, c2, end, t);
    pts.push({ x, y, m: t });
  }
  frames(pts);
  const up = pts.map((p) => {
    const w = lut(thick, p.m) * s;
    return [p.x + p.nx * w, p.y + p.ny * w];
  });
  const dn = pts.map((p) => {
    const w = lut(thick, p.m) * s * 1.25;
    return [p.x - p.nx * w, p.y - p.ny * w];
  });
  return {
    pts, up, dn,
    path: (c) => {
      poly(c, up);
      for (let i = dn.length - 1; i >= 0; i--) c.lineTo(dn[i][0], dn[i][1]);
      c.closePath();
    },
  };
}

// Aged gilding on carved oak: gold survives on the proud ridges and is worn
// back to the board in the hollows. A uniformly gold body reads as a charm.
function tones(style, override) {
  const metal = override || (style === 'ember' ? palette.ember : palette.gold);
  if (style === 'ember') {
    return {
      metal,
      base: mix(palette.ember, palette.oakDeep, 0.55),
      bright: mix(palette.ember, palette.goldBright, 0.5),
      shade: mix(palette.tar, palette.ember, 0.1),
      ridge: mix(palette.goldBright, palette.ember, 0.4),
      hollow: mix(palette.tar, palette.ember, 0.16),
    };
  }
  return {
    metal,
    base: mix(metal, palette.oak, 0.44),
    bright: mix(palette.goldBright, palette.bone, 0.28),
    shade: mix(palette.tar, palette.ember, 0.12),
    ridge: palette.goldBright,
    hollow: mix(palette.tar, palette.oak, 0.4),
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

  // lower jaw, hinged under the cheek and cracked open
  const J = SHAPE.jaw;
  const jdirP = at(pts, J.dirM);
  const jaw = limb(lane(at(pts, J.hingeM), s, -0.82), rot([jdirP.tx, jdirP.ty], J.angle), s * J.len, J.bow, J.thick, s);

  // the gape: upper palate closed onto the jaw's biting edge
  const palate = pts.filter((p) => p.m >= J.biteM && p.m <= J.lipM).map((p) => lane(p, s, -1));
  const gape = (c) => {
    poly(c, palate);
    const tip = jaw.up[jaw.up.length - 1];
    c.lineTo(tip[0], tip[1]);
    for (let i = jaw.up.length - 1; i >= 0; i--) c.lineTo(jaw.up[i][0], jaw.up[i][1]);
    c.closePath();
  };

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  // the hearth is above-left in WORLD space; mirroring the carving must not
  // mirror the light, so the carve lips flip with the facing.
  const dx = 0.85 * facing;
  const CUT = { width: Math.max(0.9, s * 0.011), dx, shadowAlpha: 0.5, liftColor: T.ridge, liftAlpha: 0.26 };

  // --- cast shadow: the carving stands proud of the board
  ctx.save();
  ctx.translate(s * 0.015, s * 0.024);
  ctx.fillStyle = rgba(palette.tar, 0.52);
  ctx.beginPath();
  body(ctx);
  jaw.path(ctx);
  ctx.fill();
  ctx.restore();

  if (style === 'ember') glow(ctx, s * 0.02, -s * 0.7, s * 0.5, palette.ember, 0.4);

  // --- lower jaw
  ctx.save();
  ctx.beginPath();
  jaw.path(ctx);
  ctx.clip();
  const jg = ctx.createLinearGradient(jaw.pts[0].x - s * 0.06, jaw.pts[0].y - s * 0.12, jaw.pts[0].x + s * 0.24, jaw.pts[0].y + s * 0.2);
  jg.addColorStop(0, mix(T.base, T.bright, 0.4));
  jg.addColorStop(0.5, T.base);
  jg.addColorStop(1, T.shade);
  ctx.fillStyle = jg;
  ctx.fillRect(-s, -s * 1.3, s * 2.6, s * 1.7);
  // the jaw gets the same chisel planes as the body, or it reads as a blade
  {
    const jl = (u) => jaw.pts.map((p, i) => {
      const w = lut(J.thick, p.m) * s * (u >= 0 ? 1 : 1.25) * Math.abs(u);
      const sg = u >= 0 ? 1 : -1;
      void i;
      return [p.x + p.nx * w * sg, p.y + p.ny * w * sg];
    });
    const bands = [1, 0.15, -1];
    for (let i = 0; i < bands.length - 1; i++) {
      const aE = jl(bands[i]);
      const bE = jl(bands[i + 1]);
      ctx.beginPath();
      poly(ctx, aE);
      for (let j = bE.length - 1; j >= 0; j--) ctx.lineTo(bE[j][0], bE[j][1]);
      ctx.closePath();
      ctx.fillStyle = rgba(T.hollow, i === 0 ? 0.06 : 0.4);
      ctx.fill();
      if (i > 0) {
        ctx.strokeStyle = rgba(palette.tar, 0.45);
        ctx.lineWidth = Math.max(0.5, s * 0.006);
        ctx.beginPath();
        poly(ctx, aE);
        ctx.stroke();
      }
    }
  }
  ctx.strokeStyle = rgba(palette.tar, 0.5);
  ctx.lineWidth = Math.max(0.7, s * 0.04);
  ctx.beginPath();
  poly(ctx, jaw.dn);
  ctx.stroke();
  ctx.restore();
  // lit bevel along the biting edge
  ctx.save();
  ctx.strokeStyle = rgba(T.ridge, 0.3);
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(0.5, s * 0.006);
  ctx.beginPath();
  poly(ctx, jaw.up.slice(2, -2));
  ctx.stroke();
  ctx.restore();
  carveStroke(ctx, jaw.path, CUT);

  // --- the gape + teeth
  ctx.save();
  ctx.beginPath();
  gape(ctx);
  ctx.clip();
  const mg = ctx.createLinearGradient(palate[0][0], palate[0][1], jaw.up[jaw.up.length - 1][0], jaw.up[jaw.up.length - 1][1]);
  mg.addColorStop(0, mix(palette.tar, palette.blood, 0.22));
  mg.addColorStop(1, palette.tar);
  ctx.fillStyle = mg;
  ctx.fillRect(-s, -s * 1.3, s * 2.6, s * 1.7);
  ctx.restore();

  const tooth = (base, dir, len, wide, i) => {
    const j = 1 + chatter(i) * 0.2;
    ctx.beginPath();
    ctx.moveTo(base[0] - dir[1] * wide, base[1] + dir[0] * wide);
    ctx.lineTo(base[0] + dir[1] * wide, base[1] - dir[0] * wide);
    ctx.lineTo(base[0] + dir[0] * len * j - dir[1] * wide * 0.35, base[1] + dir[1] * len * j + dir[0] * wide * 0.35);
    ctx.closePath();
    ctx.fill();
  };
  ctx.save();
  ctx.fillStyle = mix(palette.boneDim, palette.oakLight, 0.58);
  const nUp = lod >= 1 ? 4 : 2;
  for (let i = 0; i < nUp; i++) {
    const m = J.biteM + 0.035 + ((i + 0.5) / nUp) * (J.lipM - J.biteM - 0.08);
    const p = at(pts, m);
    const big = i === nUp - 1 ? 1.45 : 1;
    tooth(lane(p, s, -1), [-p.nx, -p.ny], s * 0.024 * big, s * 0.009 * big, i);
  }
  const nDn = lod >= 1 ? 3 : 1;
  for (let i = 0; i < nDn; i++) {
    const idx = Math.round((0.38 + ((i + 0.5) / nDn) * 0.5) * (jaw.pts.length - 1));
    const p = jaw.pts[idx];
    const big = i === nDn - 1 ? 1.3 : 1;
    tooth(jaw.up[idx], [p.nx, p.ny], s * 0.021 * big, s * 0.008 * big, i + 7);
  }
  ctx.restore();

  // --- the head mass: layered gold, then chisel planes cut across it
  ctx.save();
  ctx.beginPath();
  body(ctx);
  ctx.clip();
  if (style === 'proud') {
    fillGoldLayered(ctx, body, { x: -s * 0.42, y: -s * 0.95, w: s * 0.9, h: s * 0.95 }, {
      base: T.base, bright: T.bright, shade: T.shade, ticks: lod >= 1 ? 3 : 0,
    });
  } else {
    const g = ctx.createLinearGradient(-s * 0.4, -s * 0.92, s * 0.4, -s * 0.05);
    g.addColorStop(0, T.bright);
    g.addColorStop(0.34, T.base);
    g.addColorStop(1, T.shade);
    ctx.fillStyle = g;
    ctx.fillRect(-s, -s * 1.3, s * 2.6, s * 1.7);
  }

  // chisel planes — bands between lanes, each a step darker toward the
  // shadow edge, each boundary a crisp incision. This is the difference
  // between a filled silhouette and carved mass.
  // the planes stop at the comb base (0.78); the comb is its own plane below
  const LANES = lod >= 2 ? [0.78, 0.5, 0.2, -0.12, -0.5, -1] : [0.78, 0.25, -0.4, -1];
  for (let i = 0; i < LANES.length - 1; i++) {
    const aE = pts.map((p) => lane(p, s, LANES[i]));
    const bE = pts.map((p) => lane(p, s, LANES[i + 1]));
    ctx.beginPath();
    poly(ctx, aE);
    for (let j = bE.length - 1; j >= 0; j--) ctx.lineTo(bE[j][0], bE[j][1]);
    ctx.closePath();
    ctx.fillStyle = rgba(T.hollow, 0.1 + (i / (LANES.length - 2)) * 0.54);
    ctx.fill();
    if (i > 0) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(palette.tar, 0.5);
      ctx.lineWidth = Math.max(0.6, s * 0.0065);
      ctx.beginPath();
      poly(ctx, aE);
      ctx.stroke();
      ctx.translate(dx * 0.9, 1.0);
      ctx.strokeStyle = rgba(T.ridge, 0.24);
      ctx.lineWidth = Math.max(0.5, s * 0.0045);
      ctx.beginPath();
      poly(ctx, aE);
      ctx.stroke();
      ctx.restore();
    }
  }

  // parallel chisel striations following the neck curve — long tool runs, not
  // the perpendicular chatter below; this is most of the "carved mass" read
  if (lod >= 1) {
    ctx.save();
    ctx.lineCap = 'round';
    const runs = lod >= 2 ? [0.66, 0.44, 0.2, -0.06, -0.32, -0.58, -0.8] : [0.5, 0.1, -0.4];
    runs.forEach((u, k) => {
      const path = pts.filter((p) => p.m > 0.04 && p.m < 0.93)
        .map((p) => lane(p, s, u + chatter(k * 7) * 0.03));
      if (path.length < 3) return;
      ctx.strokeStyle = rgba(palette.tar, 0.2 + Math.abs(chatter(k + 3)) * 0.1);
      ctx.lineWidth = Math.max(0.5, s * 0.0055);
      ctx.beginPath();
      poly(ctx, path);
      ctx.stroke();
      ctx.save();
      ctx.translate(dx * 0.8, 0.9);
      ctx.strokeStyle = rgba(T.ridge, 0.13);
      ctx.lineWidth = Math.max(0.4, s * 0.004);
      ctx.beginPath();
      poly(ctx, path);
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  }

  // the comb sits in a second plane behind the crest ridge — thin plates seen
  // edge-on read DARKER than the neck they grow from, never as a pale flange
  {
    const inner = pts.map((p) => lane(p, s, 0.8));
    ctx.beginPath();
    poly(ctx, upE);
    for (let j = inner.length - 1; j >= 0; j--) ctx.lineTo(inner[j][0], inner[j][1]);
    ctx.closePath();
    ctx.fillStyle = rgba(palette.tar, 0.34);
    ctx.fill();
  }

  // mane: a true two-strand interlace weaving down the nape, cut INTO the
  // neck (inside the body clip) rather than laid on top of it
  if (lod >= 1) {
    const M = SHAPE.mane;
    const N = 34;
    const woven = new Array(N * 2 + 2);
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const m = M.m0 + (M.m1 - M.m0) * u;
      const p = at(pts, m);
      const off = lut(SHAPE.up, m) * 0.3 * s;
      const a = Math.sin(Math.PI * u) * M.amp * s * Math.sin(Math.PI * 2 * M.waves * u);
      woven[i] = [p.x + p.nx * (off + a), p.y + p.ny * (off + a)];
      woven[N * 2 + 1 - i] = [p.x + p.nx * (off - a), p.y + p.ny * (off - a)];
    }
    drawKnot(ctx, woven, {
      width: Math.max(1, s * M.width),
      color: mix(T.metal, palette.oakDeep, style === 'ember' ? 0.5 : 0.62),
      gapAtCrossings: Math.max(2, s * M.width * 2.4),
    });
  }

  // hand tool marks: short perpendicular chisel ticks, unevenly spaced
  if (lod >= 2) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.5, s * 0.0055);
    for (let i = 0; i < 52; i++) {
      const m = Math.min(0.95, Math.max(0.02, 0.03 + (i / 52) * 0.76 + chatter(i) * 0.008));
      const p = at(pts, m);
      const u0 = -0.92 + chatter(i + 31) * 0.3;
      const a = lane(p, s, u0);
      const b = lane(p, s, u0 + 0.4 + chatter(i + 61) * 0.18);
      ctx.strokeStyle = rgba(palette.tar, 0.14 + Math.abs(chatter(i + 91)) * 0.12);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  // chip-carved triangle band riding inboard of the comb
  if (lod >= 1) {
    const C = SHAPE.chip;
    for (let i = 0; i < C.count; i++) {
      const m = C.m0 + ((i + 0.5) / C.count) * (C.m1 - C.m0);
      const half = ((C.m1 - C.m0) / C.count) * 0.42;
      const a = lane(at(pts, Math.max(0, m - half)), s, 0.72);
      const b = lane(at(pts, Math.min(1, m + half)), s, 0.72);
      const c = at(pts, m);
      const d = s * C.depth * (1 + chatter(i + 5) * 0.18);
      const apex = [(a[0] + b[0]) / 2 - c.nx * d, (a[1] + b[1]) / 2 - c.ny * d];
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(apex[0], apex[1]);
      ctx.closePath();
      ctx.fillStyle = rgba(palette.tar, 0.5);
      ctx.fill();
      ctx.strokeStyle = rgba(T.ridge, 0.3);
      ctx.lineWidth = Math.max(0.5, s * 0.0045);
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.lineTo(apex[0], apex[1]);
      ctx.stroke();
    }
  }

  // deep shade hugging the throat edge
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(palette.tar, 0.45);
  ctx.lineWidth = Math.max(1.2, s * 0.05);
  ctx.beginPath();
  poly(ctx, dnE);
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  // --- the outline incision + worn gold leaf on the proudest ridge
  carveStroke(ctx, body, CUT);

  // --- the comb, tooth by tooth: each sawtooth gets a lit leading facet and
  // a shadowed trailing one, or the serrated edge reads as a flat paper flange
  {
    const S = SHAPE.serr;
    const n = Math.max(1, Math.round((S.m1 - S.m0) / S.period));
    ctx.save();
    ctx.lineCap = 'round';
    for (let k = 0; k < n; k++) {
      const mv = S.m0 + k * S.period;
      const mp = Math.min(S.m1, mv + S.period * S.rise);
      const mv2 = Math.min(S.m1, mv + S.period);
      const pv = at(pts, mv);
      const pp = at(pts, mp);
      const v = lane(pv, s, 1);
      const pk = lane(pp, s, 1);
      const v2 = lane(at(pts, mv2), s, 1);
      const inb = lane(pp, s, 0.66);
      ctx.beginPath();
      ctx.moveTo(pk[0], pk[1]);
      ctx.lineTo(v2[0], v2[1]);
      ctx.lineTo(inb[0], inb[1]);
      ctx.closePath();
      ctx.fillStyle = rgba(palette.tar, 0.32);
      ctx.fill();
      ctx.strokeStyle = rgba(mix(T.ridge, palette.bone, 0.3), 0.42);
      ctx.lineWidth = Math.max(0.6, s * 0.008);
      ctx.beginPath();
      ctx.moveTo(v[0], v[1]);
      ctx.lineTo(pk[0], pk[1]);
      ctx.stroke();
      ctx.strokeStyle = rgba(palette.tar, 0.5);
      ctx.lineWidth = Math.max(0.7, s * 0.009);
      ctx.beginPath();
      ctx.moveTo(pk[0], pk[1]);
      ctx.lineTo(v2[0], v2[1]);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.setLineDash([s * 0.055, s * 0.028, s * 0.014, s * 0.05]);
  ctx.strokeStyle = rgba(mix(T.ridge, palette.bone, 0.35), style === 'proud' ? 0.45 : 0.32);
  ctx.lineWidth = Math.max(0.6, s * 0.0075);
  ctx.beginPath();
  poly(ctx, upE.filter((_, i) => pts[i].m > 0.5 && pts[i].m < 0.9));
  ctx.stroke();
  ctx.restore();

  // --- collar: the carving is socketed into the board, not floating on it
  const cp = at(pts, 0.045);
  carveStroke(ctx, (c) => {
    const a = lane(cp, s, 1);
    const b = lane(cp, s, -1);
    c.moveTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
  }, { ...CUT, width: Math.max(0.7, s * 0.009) });

  // --- the eye: deep socket, carved lid ridge, almond, slit pupil
  const E = SHAPE.eye;
  const ep = at(pts, E.m);
  const ec = [ep.x + ep.nx * s * E.off, ep.y + ep.ny * s * E.off];
  const half = Math.max(2.6, s * E.len) / 2;
  const rise = Math.max(1.2, s * E.h);
  const F = [ec[0] + ep.tx * half, ec[1] + ep.ty * half];
  const R = [ec[0] - ep.tx * half, ec[1] - ep.ty * half];
  const almond = (c) => {
    c.moveTo(R[0], R[1]);
    c.quadraticCurveTo(ec[0] + ep.nx * rise * 2.05, ec[1] + ep.ny * rise * 2.05, F[0], F[1]);
    c.quadraticCurveTo(ec[0] - ep.nx * rise * 1.9, ec[1] - ep.ny * rise * 1.9, R[0], R[1]);
    c.closePath();
  };
  ctx.save();
  ctx.fillStyle = rgba(palette.tar, 0.72);
  ctx.beginPath();
  ctx.ellipse(ec[0], ec[1], half * 1.34, rise * 2.1, Math.atan2(ep.ty, ep.tx), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.tar;
  ctx.beginPath();
  almond(ctx);
  ctx.fill();
  ctx.restore();
  fillGoldLayered(ctx, almond, { x: ec[0] - half, y: ec[1] - rise * 2, w: half * 2, h: rise * 4 }, {
    base: style === 'ember' ? mix(palette.ember, palette.goldBright, 0.5) : palette.goldBright,
    bright: palette.bone, shade: mix(palette.gold, palette.tar, 0.45), ticks: 0,
  });
  ctx.save();
  ctx.fillStyle = palette.tar;
  ctx.beginPath();
  ctx.ellipse(ec[0], ec[1], Math.max(0.5, half * 0.22), rise * 0.86, Math.atan2(ep.ty, ep.tx), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  carveStroke(ctx, (c) => {
    c.moveTo(R[0] - ep.tx * half * 0.34, R[1] - ep.ty * half * 0.34);
    c.quadraticCurveTo(ec[0] + ep.nx * rise * 3.2, ec[1] + ep.ny * rise * 3.2,
      F[0] + ep.tx * half * 0.26, F[1] + ep.ty * half * 0.26);
  }, { width: Math.max(0.8, s * 0.014), dx, coreAlpha: 0.95, liftColor: T.ridge, liftAlpha: 0.45 });
  if (lod >= 1) {
    carveStroke(ctx, (c) => {
      c.moveTo(R[0] - ep.tx * half * 0.8 + ep.nx * rise * 2.3, R[1] - ep.ty * half * 0.8 + ep.ny * rise * 2.3);
      c.quadraticCurveTo(ec[0] + ep.nx * rise * 4.7, ec[1] + ep.ny * rise * 4.7,
        F[0] + ep.tx * half * 0.42 + ep.nx * rise * 1.3, F[1] + ep.ty * half * 0.42 + ep.ny * rise * 1.3);
    }, { width: Math.max(0.6, s * 0.01), dx, coreAlpha: 0.5 });
  }
  ctx.save();
  ctx.fillStyle = rgba(palette.bone, 0.9);
  ctx.beginPath();
  ctx.arc(ec[0] - ep.tx * half * (0.38 - t * 0.14) + ep.nx * rise * 0.5,
    ec[1] - ep.ty * half * (0.38 - t * 0.14) + ep.ny * rise * 0.5,
    Math.max(0.45, s * 0.0095), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- nostril: a flared curl with the pit cut into it
  const np = at(pts, SHAPE.nose.m);
  const nc = [np.x + np.nx * s * SHAPE.nose.off, np.y + np.ny * s * SHAPE.nose.off];
  const nr = Math.max(1.1, s * SHAPE.nose.r);
  ctx.save();
  ctx.fillStyle = rgba(palette.tar, 0.85);
  ctx.beginPath();
  ctx.ellipse(nc[0], nc[1], nr * 0.52, nr * 0.32, Math.atan2(np.ty, np.tx), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  carveStroke(ctx, (c) => {
    c.moveTo(nc[0] + np.tx * nr * 1.2, nc[1] + np.ty * nr * 1.2);
    c.bezierCurveTo(nc[0] + np.nx * nr * 1.7, nc[1] + np.ny * nr * 1.7,
      nc[0] - np.tx * nr * 1.8, nc[1] - np.ty * nr * 1.8,
      nc[0] - np.tx * nr * 0.2 - np.nx * nr * 1.05, nc[1] - np.ty * nr * 0.2 - np.ny * nr * 1.05);
  }, { ...CUT, width: Math.max(0.8, s * 0.012) });

  // --- worn catch-light where the gilding survives on the proudest ridges
  if (lod >= 1) {
    ctx.save();
    ctx.strokeStyle = rgba(palette.bone, 0.4);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.6, s * 0.008);
    ctx.beginPath();
    const a1 = lane(at(pts, 0.5 + t * 0.02), s, 0.9);
    const b1 = lane(at(pts, 0.57 + t * 0.02), s, 0.9);
    ctx.moveTo(a1[0], a1[1]);
    ctx.lineTo(b1[0], b1[1]);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}
