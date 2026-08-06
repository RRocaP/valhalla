// WIP ONLY — three structurally different Viking dragon-head candidates.
// Disposable: the winner is reimplemented, refined, in src/art/dragon.js.
// Shared skeleton machinery lives here so the three differ only in STRUCTURE
// (neck recurve, volute tightness, crest treatment), not in carve density.
import { palette, rgba, mix } from '../../src/art/palette.js';
import { carveStroke, glow } from '../../src/art/util.js';
import { fillGoldLayered } from '../../src/art/gold.js';
import { drawKnot } from '../../src/art/knot.js';

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
    pts[i].nx = dy;   // +N: crest / skull-top / inner face of the volute
    pts[i].ny = -dx;
  }
  return pts;
}

// neck beziers, then a decreasing-radius volute appended C1-continuously off
// the muzzle tangent. `m` is a monotone material coordinate keying every table.
function buildSpine(P, s) {
  const pts = [];
  P.neck.forEach((g, si) => {
    const N = 24;
    for (let i = si === 0 ? 0 : 1; i <= N; i++) {
      const t = i / N;
      const [px, py] = bezPoint(g.p0, g.c1, g.c2, g.p1, t);
      pts.push({ x: px * s, y: py * s, m: g.m0 + (g.m1 - g.m0) * t });
    }
  });
  frames(pts);
  const last = pts[pts.length - 1];
  const r0 = P.volute.r0 * s;
  const r1 = P.volute.r1 * s;
  const cx = last.x + last.nx * r0;
  const cy = last.y + last.ny * r0;
  const a0 = Math.atan2(last.y - cy, last.x - cx);
  const sweep = P.volute.turns * Math.PI * 2;
  const N = 120;
  for (let i = 1; i <= N; i++) {
    const k = i / N;
    const a = a0 - sweep * k;
    const r = r0 * Math.pow(r1 / r0, k);
    pts.push({
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r,
      m: P.volute.m0 + (1 - P.volute.m0) * k,
    });
  }
  return frames(pts);
}

// smoothstep between knots — a linear ramp leaves visible width creases
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

// lane = -1 (lower/shadow edge) .. +1 (crest/lit edge)
function lane(p, P, s, u) {
  const w = (u >= 0 ? lut(P.up, p.m) : lut(P.down, p.m)) * s * Math.abs(u);
  const sgn = u >= 0 ? 1 : -1;
  return [p.x + p.nx * w * sgn, p.y + p.ny * w * sgn];
}

function poly(c, list, close) {
  c.moveTo(list[0][0], list[0][1]);
  for (let i = 1; i < list.length; i++) c.lineTo(list[i][0], list[i][1]);
  if (close) c.closePath();
}

function rot(v, ang) {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  return [ca * v[0] - sa * v[1], sa * v[0] + ca * v[1]];
}

// A tapered limb (the lower jaw): its own short spine + thickness table.
function buildLimb(origin, dir, len, bow, thick, s) {
  const pts = [];
  const N = 22;
  const [px, py] = [origin[0] + dir[0] * len, origin[1] + dir[1] * len];
  const nrm = [dir[1], -dir[0]];
  const c1 = [origin[0] + dir[0] * len * 0.4 - nrm[0] * len * bow, origin[1] + dir[1] * len * 0.4 - nrm[1] * len * bow];
  const c2 = [origin[0] + dir[0] * len * 0.78 - nrm[0] * len * bow * 0.5, origin[1] + dir[1] * len * 0.78 - nrm[1] * len * bow * 0.5];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const [x, y] = bezPoint(origin, c1, c2, [px, py], t);
    pts.push({ x, y, m: t });
  }
  frames(pts);
  const up = pts.map((p) => {
    const w = lut(thick, p.m) * s;
    return [p.x + p.nx * w, p.y + p.ny * w];
  });
  const dn = pts.map((p) => {
    const w = lut(thick, p.m) * s * 1.15;
    return [p.x - p.nx * w, p.y - p.ny * w];
  });
  return { pts, up, dn };
}

// ------------------------------------------------------------------ tones

function toneSet(style, colorHex) {
  const metal = colorHex || (style === 'ember' ? palette.ember : palette.gold);
  if (style === 'ember') {
    return {
      metal,
      base: mix(palette.ember, palette.oakDeep, 0.5),
      bright: mix(palette.ember, palette.goldBright, 0.55),
      shade: mix(palette.tar, palette.ember, 0.18),
      ridge: mix(palette.goldBright, palette.ember, 0.4),
      cut: palette.tar,
    };
  }
  return {
    metal,
    base: mix(metal, palette.oakDeep, 0.42),
    bright: mix(palette.goldBright, palette.bone, 0.22),
    shade: mix(palette.tar, metal, 0.16),
    ridge: palette.goldBright,
    cut: palette.tar,
  };
}

// --------------------------------------------------------------- the beast

function drawOne(ctx, P, x, y, size, opts) {
  const s = size;
  const facing = opts.facing === -1 ? -1 : 1;
  const style = opts.style === 'ember' ? 'ember' : 'proud';
  const t = typeof opts.t === 'number' ? opts.t : 0;
  const tone = toneSet(style, opts.color && palette[opts.color] ? palette[opts.color] : opts.color);
  const lod = s >= 190 ? 2 : s >= 86 ? 1 : 0;
  const pts = buildSpine(P, s);
  const upE = pts.map((p) => lane(p, P, s, 1));
  const dnE = pts.map((p) => lane(p, P, s, -1));

  const body = (c) => {
    c.moveTo(upE[0][0], upE[0][1]);
    for (let i = 1; i < upE.length; i++) c.lineTo(upE[i][0], upE[i][1]);
    for (let i = dnE.length - 1; i >= 0; i--) c.lineTo(dnE[i][0], dnE[i][1]);
    c.closePath();
  };

  // ---- lower jaw: swung down off the hinge, its own tapered limb
  const J = P.jaw;
  const hp = at(pts, J.hingeM);
  const mp = at(pts, J.dirM);
  const hinge = lane(hp, P, s, -0.85);
  const jdir = rot([mp.tx, mp.ty], J.angle);
  const jaw = buildLimb(hinge, jdir, s * J.len, J.bow, J.thick, s);
  const jawPath = (c) => {
    poly(c, jaw.up, false);
    for (let i = jaw.dn.length - 1; i >= 0; i--) c.lineTo(jaw.dn[i][0], jaw.dn[i][1]);
    c.closePath();
  };

  // ---- the gape: upper palate (ribbon lower edge) closed onto the jaw's top
  const palate = pts.filter((p) => p.m >= J.biteM && p.m <= J.lipM).map((p) => lane(p, P, s, -1));
  const gape = (c) => {
    poly(c, palate, false);
    const tip = jaw.up[jaw.up.length - 1];
    c.lineTo(tip[0], tip[1]);
    for (let i = jaw.up.length - 1; i >= 0; i--) c.lineTo(jaw.up[i][0], jaw.up[i][1]);
    c.closePath();
  };

  // ---- crest spikes
  const spikes = P.crest.at.map((cm) => {
    const half = P.crest.baseHalfM;
    const a = lane(at(pts, Math.max(0, cm - half)), P, s, 0.96);
    const b = lane(at(pts, cm + half), P, s, 0.96);
    const c = at(pts, cm);
    const reach = s * P.crest.reach;
    return {
      a, b, c, reach,
      tip: [
        (a[0] + b[0]) / 2 + c.nx * reach + c.tx * reach * P.crest.lean,
        (a[1] + b[1]) / 2 + c.ny * reach + c.ty * reach * P.crest.lean,
      ],
    };
  });
  const crestPath = (cx) => {
    for (const k of spikes) {
      cx.moveTo(k.a[0], k.a[1]);
      cx.quadraticCurveTo(
        k.a[0] + k.c.nx * k.reach * 0.62 - k.c.tx * k.reach * 0.18,
        k.a[1] + k.c.ny * k.reach * 0.62 - k.c.ty * k.reach * 0.18,
        k.tip[0], k.tip[1],
      );
      cx.quadraticCurveTo(
        k.b[0] + k.c.nx * k.reach * 0.22 + k.c.tx * k.reach * 0.1,
        k.b[1] + k.c.ny * k.reach * 0.22 + k.c.ty * k.reach * 0.1,
        k.b[0], k.b[1],
      );
      cx.closePath();
    }
  };

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  const carveDx = 0.85 * facing;
  const CARVE = { width: Math.max(0.9, s * 0.0115), dx: carveDx, shadowAlpha: 0.5 };

  // 1. cast shadow
  ctx.save();
  ctx.translate(s * 0.016, s * 0.026);
  ctx.fillStyle = rgba(palette.tar, 0.5);
  ctx.beginPath();
  body(ctx);
  jawPath(ctx);
  crestPath(ctx);
  ctx.fill();
  ctx.restore();

  if (style === 'ember') glow(ctx, s * 0.02, -s * 0.7, s * 0.46, palette.ember, 0.4);

  // 2. crest spikes behind the neck
  ctx.save();
  const cg = ctx.createLinearGradient(-s * 0.45, -s * 0.9, s * 0.1, -s * 0.1);
  cg.addColorStop(0, mix(tone.base, palette.tar, 0.3));
  cg.addColorStop(1, mix(tone.shade, palette.tar, 0.25));
  ctx.fillStyle = cg;
  ctx.beginPath();
  crestPath(ctx);
  ctx.fill();
  ctx.restore();
  carveStroke(ctx, crestPath, { ...CARVE, liftColor: tone.ridge, liftAlpha: 0.3 });

  // 3. mane — a true two-strand interlace run flowing off the crest
  if (P.mane && lod >= 1) {
    const M = P.mane;
    const strand = (sign) => {
      const out = [];
      const N = 30;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const m = M.m0 + (M.m1 - M.m0) * u;
        const p = at(pts, m);
        const w = lut(P.up, m) * s + s * M.off;
        const env = Math.sin(Math.PI * u);
        const amp = sign * s * M.amp * env;
        out.push([p.x + p.nx * (w + amp), p.y + p.ny * (w + amp)]);
      }
      return out;
    };
    const a = strand(1);
    const b = strand(-1).reverse();
    // phase-shift b so the two strands actually weave rather than run parallel
    const woven = a.concat(b);
    for (let i = 0; i <= 30; i++) {
      const u = i / 30;
      const m = M.m0 + (M.m1 - M.m0) * u;
      const p = at(pts, m);
      const w = lut(P.up, m) * s + s * M.off;
      const env = Math.sin(Math.PI * u);
      woven[i] = [
        p.x + p.nx * (w + s * M.amp * env * Math.sin(Math.PI * 2 * M.waves * u)),
        p.y + p.ny * (w + s * M.amp * env * Math.sin(Math.PI * 2 * M.waves * u)),
      ];
      woven[woven.length - 1 - i] = [
        p.x + p.nx * (w - s * M.amp * env * Math.sin(Math.PI * 2 * M.waves * u)),
        p.y + p.ny * (w - s * M.amp * env * Math.sin(Math.PI * 2 * M.waves * u)),
      ];
    }
    drawKnot(ctx, woven, {
      width: Math.max(1.3, s * M.width),
      color: style === 'ember' ? mix(palette.ember, palette.gold, 0.5) : mix(tone.metal, palette.oakDeep, 0.15),
      gapAtCrossings: Math.max(3, s * M.width * 2.3),
    });
  }

  // 4. lower jaw
  ctx.save();
  ctx.beginPath();
  jawPath(ctx);
  ctx.clip();
  const jg = ctx.createLinearGradient(hinge[0] - s * 0.05, hinge[1] - s * 0.08, hinge[0] + s * 0.2, hinge[1] + s * 0.2);
  jg.addColorStop(0, mix(tone.base, tone.bright, 0.3));
  jg.addColorStop(0.55, tone.base);
  jg.addColorStop(1, tone.shade);
  ctx.fillStyle = jg;
  ctx.fillRect(-s, -s * 1.3, s * 2.6, s * 1.7);
  ctx.restore();
  carveStroke(ctx, jawPath, CARVE);

  // 5. the gape + teeth
  ctx.save();
  ctx.fillStyle = mix(palette.tar, palette.blood, 0.16);
  ctx.beginPath();
  gape(ctx);
  ctx.fill();
  ctx.restore();
  const tooth = (base, dir, len, wide) => {
    ctx.beginPath();
    ctx.moveTo(base[0] - dir[1] * wide, base[1] + dir[0] * wide);
    ctx.lineTo(base[0] + dir[1] * wide, base[1] - dir[0] * wide);
    ctx.lineTo(base[0] + dir[0] * len, base[1] + dir[1] * len);
    ctx.closePath();
    ctx.fill();
  };
  ctx.save();
  ctx.fillStyle = mix(palette.bone, palette.boneDim, 0.2);
  const nUp = lod >= 1 ? 5 : 3;
  for (let i = 0; i < nUp; i++) {
    const m = J.biteM + 0.015 + ((i + 0.5) / nUp) * (J.lipM - J.biteM - 0.03);
    const p = at(pts, m);
    const base = lane(p, P, s, -1);
    const big = i >= nUp - 2 ? 1.5 : 1;
    tooth(base, [-p.nx, -p.ny], s * 0.036 * big, s * 0.014 * big);
  }
  const nDn = lod >= 1 ? 4 : 2;
  for (let i = 0; i < nDn; i++) {
    const u = 0.2 + ((i + 0.5) / nDn) * 0.7;
    const idx = Math.round(u * (jaw.pts.length - 1));
    const p = jaw.pts[idx];
    const base = jaw.up[idx];
    const big = i >= nDn - 2 ? 1.35 : 1;
    tooth(base, [p.nx, p.ny], s * 0.032 * big, s * 0.013 * big);
  }
  ctx.restore();

  // 6. the head mass — layered gold, then chisel facets cut across it
  ctx.save();
  ctx.beginPath();
  body(ctx);
  ctx.clip();
  if (style === 'proud') {
    fillGoldLayered(ctx, body, { x: -s * 0.5, y: -s, w: s, h: s }, {
      base: tone.base, bright: tone.bright, shade: tone.shade, ticks: lod >= 1 ? 3 : 0,
    });
  } else {
    const g = ctx.createLinearGradient(-s * 0.42, -s * 0.95, s * 0.42, -s * 0.05);
    g.addColorStop(0, tone.bright);
    g.addColorStop(0.4, tone.base);
    g.addColorStop(1, tone.shade);
    ctx.fillStyle = g;
    ctx.fillRect(-s, -s * 1.3, s * 2.6, s * 1.7);
  }

  // chisel planes: bands between lanes, each a step darker toward the shadow
  // edge, separated by a crisp ridge incision. This is what turns a filled
  // silhouette into carved mass.
  const LANES = lod >= 2 ? [1, 0.62, 0.26, -0.1, -0.46, -1] : [1, 0.35, -0.35, -1];
  for (let i = 0; i < LANES.length - 1; i++) {
    const aE = pts.map((p) => lane(p, P, s, LANES[i]));
    const bE = pts.map((p) => lane(p, P, s, LANES[i + 1]));
    const k = i / (LANES.length - 2);
    ctx.beginPath();
    poly(ctx, aE, false);
    for (let j = bE.length - 1; j >= 0; j--) ctx.lineTo(bE[j][0], bE[j][1]);
    ctx.closePath();
    ctx.fillStyle = rgba(palette.tar, 0.04 + k * 0.34);
    ctx.fill();
    if (i > 0) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(palette.tar, 0.42);
      ctx.lineWidth = Math.max(0.6, s * 0.0075);
      ctx.beginPath();
      poly(ctx, aE, false);
      ctx.stroke();
      ctx.translate(carveDx * 0.9, 1.0);
      ctx.strokeStyle = rgba(tone.ridge, 0.2);
      ctx.lineWidth = Math.max(0.5, s * 0.005);
      ctx.beginPath();
      poly(ctx, aE, false);
      ctx.stroke();
      ctx.restore();
    }
  }

  // chip-carved triangle band riding the crest ridge
  if (lod >= 1) {
    const C = P.chip;
    for (let i = 0; i < C.count; i++) {
      const m = C.m0 + ((i + 0.5) / C.count) * (C.m1 - C.m0);
      const half = ((C.m1 - C.m0) / C.count) * 0.46;
      const a = lane(at(pts, Math.max(0, m - half)), P, s, 0.99);
      const b = lane(at(pts, Math.min(1, m + half)), P, s, 0.99);
      const c = at(pts, m);
      const apex = [(a[0] + b[0]) / 2 - c.nx * s * C.depth, (a[1] + b[1]) / 2 - c.ny * s * C.depth];
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(apex[0], apex[1]);
      ctx.closePath();
      ctx.fillStyle = rgba(palette.tar, 0.5);
      ctx.fill();
      ctx.strokeStyle = rgba(tone.ridge, 0.3);
      ctx.lineWidth = Math.max(0.5, s * 0.005);
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.lineTo(apex[0], apex[1]);
      ctx.stroke();
    }
  }

  // deep shade hugging the shadow edge; catch-light on the crest ridge
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(palette.tar, 0.4);
  ctx.lineWidth = Math.max(1.2, s * 0.05);
  ctx.beginPath();
  poly(ctx, dnE, false);
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  // 7. the outline incision + worn gold leaf on the proudest ridge
  carveStroke(ctx, body, { ...CARVE, liftColor: tone.ridge, liftAlpha: 0.3 });
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.setLineDash([s * 0.075, s * 0.03, s * 0.022, s * 0.05]);
  ctx.strokeStyle = rgba(mix(tone.ridge, palette.bone, 0.4), style === 'proud' ? 0.6 : 0.42);
  ctx.lineWidth = Math.max(0.7, s * 0.01);
  ctx.beginPath();
  poly(ctx, upE.filter((_, i) => pts[i].m < 0.86), false);
  ctx.stroke();
  ctx.restore();

  // 8. the eye
  const E = P.eye;
  const ep = at(pts, E.m);
  const ec = [ep.x + ep.nx * s * E.off, ep.y + ep.ny * s * E.off];
  const half = Math.max(2.8, s * E.len) / 2;
  const rise = Math.max(1.4, s * E.h);
  const F = [ec[0] + ep.tx * half, ec[1] + ep.ty * half];
  const R = [ec[0] - ep.tx * half, ec[1] - ep.ty * half];
  const almond = (c) => {
    c.moveTo(R[0], R[1]);
    c.quadraticCurveTo(ec[0] + ep.nx * rise * 2, ec[1] + ep.ny * rise * 2, F[0], F[1]);
    c.quadraticCurveTo(ec[0] - ep.nx * rise * 1.8, ec[1] - ep.ny * rise * 1.8, R[0], R[1]);
    c.closePath();
  };
  ctx.save();
  ctx.fillStyle = rgba(palette.tar, 0.8);
  ctx.beginPath();
  ctx.ellipse(ec[0], ec[1], half * 1.45, rise * 2.3, Math.atan2(ep.ty, ep.tx), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = palette.tar;
  ctx.beginPath();
  almond(ctx);
  ctx.fill();
  ctx.restore();
  fillGoldLayered(ctx, almond, { x: ec[0] - half, y: ec[1] - rise * 2, w: half * 2, h: rise * 4 }, {
    base: style === 'ember' ? mix(palette.ember, palette.goldBright, 0.45) : palette.goldBright,
    bright: palette.bone, shade: mix(palette.gold, palette.tar, 0.45), ticks: 0,
  });
  ctx.save();
  ctx.fillStyle = palette.tar;
  ctx.beginPath();
  ctx.ellipse(ec[0], ec[1], Math.max(0.6, half * 0.2), rise * 0.92, Math.atan2(ep.ty, ep.tx), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const lid = (c) => {
    c.moveTo(R[0] - ep.tx * half * 0.3, R[1] - ep.ty * half * 0.3);
    c.quadraticCurveTo(
      ec[0] + ep.nx * rise * 3.2, ec[1] + ep.ny * rise * 3.2,
      F[0] + ep.tx * half * 0.22, F[1] + ep.ty * half * 0.22,
    );
  };
  carveStroke(ctx, lid, { width: Math.max(0.9, s * 0.015), dx: carveDx, coreAlpha: 0.95, liftColor: tone.ridge, liftAlpha: 0.45 });
  ctx.save();
  ctx.fillStyle = rgba(palette.bone, 0.92);
  ctx.beginPath();
  ctx.arc(
    ec[0] - ep.tx * half * (0.36 - t * 0.14) + ep.nx * rise * 0.55,
    ec[1] - ep.ty * half * (0.36 - t * 0.14) + ep.ny * rise * 0.55,
    Math.max(0.5, s * 0.011), 0, Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();

  // 9. nostril flare curl
  const np = at(pts, P.nose.m);
  const nc = [np.x + np.nx * s * P.nose.off, np.y + np.ny * s * P.nose.off];
  const nr = Math.max(1.2, s * P.nose.r);
  const nostril = (c) => {
    c.moveTo(nc[0] + np.tx * nr * 1.1, nc[1] + np.ty * nr * 1.1);
    c.bezierCurveTo(
      nc[0] + np.nx * nr * 1.6, nc[1] + np.ny * nr * 1.6,
      nc[0] - np.tx * nr * 1.7, nc[1] - np.ty * nr * 1.7,
      nc[0] - np.tx * nr * 0.2 - np.nx * nr * 1.0, nc[1] - np.ty * nr * 0.2 - np.ny * nr * 1.0,
    );
  };
  carveStroke(ctx, nostril, { width: Math.max(0.9, s * 0.014), dx: carveDx, liftColor: tone.ridge, liftAlpha: 0.35 });

  ctx.restore();
}

// ------------------------------------------------------------------ shapes

const PRESETS = {
  // A — PROW: hard recurve, big bold volute, spiked cockscomb + chip band
  A: {
    name: 'A prow',
    neck: [
      { p0: [0, 0], c1: [-0.03, -0.14], c2: [-0.215, -0.235], p1: [-0.235, -0.4], m0: 0, m1: 0.21 },
      { p0: [-0.235, -0.4], c1: [-0.25, -0.565], c2: [-0.15, -0.7], p1: [-0.01, -0.745], m0: 0.21, m1: 0.44 },
      { p0: [-0.01, -0.745], c1: [0.075, -0.775], c2: [0.135, -0.765], p1: [0.19, -0.725], m0: 0.44, m1: 0.62 },
      { p0: [0.19, -0.725], c1: [0.225, -0.7], c2: [0.245, -0.685], p1: [0.275, -0.68], m0: 0.62, m1: 0.78 },
    ],
    volute: { r0: 0.2, r1: 0.028, turns: 1.2, m0: 0.78 },
    up: [[0, 0.09], [0.06, 0.07], [0.25, 0.058], [0.38, 0.07], [0.47, 0.13], [0.55, 0.155], [0.63, 0.13], [0.7, 0.085], [0.78, 0.055], [0.87, 0.033], [1, 0.006]],
    down: [[0, 0.1], [0.06, 0.075], [0.25, 0.055], [0.38, 0.075], [0.46, 0.15], [0.53, 0.185], [0.6, 0.155], [0.68, 0.095], [0.78, 0.055], [0.87, 0.033], [1, 0.006]],
    jaw: { hingeM: 0.5, dirM: 0.7, angle: 0.5, len: 0.36, bow: 0.1, biteM: 0.56, lipM: 0.79,
      thick: [[0, 0.085], [0.35, 0.055], [0.72, 0.032], [1, 0.012]] },
    eye: { m: 0.565, off: 0.055, len: 0.14, h: 0.033 },
    nose: { m: 0.73, off: 0.05, r: 0.032 },
    crest: { at: [0.09, 0.185, 0.28, 0.375], reach: 0.1, lean: 0.55, baseHalfM: 0.036 },
    chip: { m0: 0.05, m1: 0.44, count: 9, depth: 0.05 },
    mane: null,
  },
  // B — URNES: longer sinuous neck, open volute, full plait mane, wide gape
  B: {
    name: 'B urnes',
    neck: [
      { p0: [0, 0], c1: [-0.04, -0.15], c2: [-0.245, -0.25], p1: [-0.26, -0.43], m0: 0, m1: 0.22 },
      { p0: [-0.26, -0.43], c1: [-0.275, -0.6], c2: [-0.165, -0.735], p1: [-0.02, -0.78], m0: 0.22, m1: 0.46 },
      { p0: [-0.02, -0.78], c1: [0.07, -0.81], c2: [0.13, -0.8], p1: [0.185, -0.755], m0: 0.46, m1: 0.64 },
      { p0: [0.185, -0.755], c1: [0.22, -0.73], c2: [0.245, -0.715], p1: [0.28, -0.712], m0: 0.64, m1: 0.8 },
    ],
    volute: { r0: 0.175, r1: 0.058, turns: 0.82, m0: 0.8 },
    up: [[0, 0.082], [0.06, 0.062], [0.26, 0.05], [0.4, 0.062], [0.49, 0.12], [0.57, 0.145], [0.65, 0.118], [0.72, 0.078], [0.8, 0.05], [0.9, 0.036], [1, 0.012]],
    down: [[0, 0.092], [0.06, 0.066], [0.26, 0.048], [0.4, 0.068], [0.48, 0.14], [0.55, 0.172], [0.62, 0.145], [0.7, 0.088], [0.8, 0.05], [0.9, 0.036], [1, 0.012]],
    jaw: { hingeM: 0.52, dirM: 0.72, angle: 0.68, len: 0.4, bow: 0.12, biteM: 0.58, lipM: 0.81,
      thick: [[0, 0.078], [0.35, 0.05], [0.72, 0.03], [1, 0.012]] },
    eye: { m: 0.585, off: 0.05, len: 0.132, h: 0.031 },
    nose: { m: 0.75, off: 0.045, r: 0.03 },
    crest: { at: [0.12, 0.26, 0.4], reach: 0.075, lean: 0.6, baseHalfM: 0.04 },
    chip: { m0: 0.06, m1: 0.46, count: 8, depth: 0.042 },
    mane: { m0: 0.06, m1: 0.47, off: 0.055, amp: 0.05, waves: 2, width: 0.028 },
  },
  // C — STAVE: stout upright stem, very tight coil, dense chip diamonds
  C: {
    name: 'C stave',
    neck: [
      { p0: [0, 0], c1: [-0.02, -0.15], c2: [-0.16, -0.24], p1: [-0.175, -0.42], m0: 0, m1: 0.22 },
      { p0: [-0.175, -0.42], c1: [-0.19, -0.585], c2: [-0.105, -0.715], p1: [0.02, -0.765], m0: 0.22, m1: 0.45 },
      { p0: [0.02, -0.765], c1: [0.1, -0.795], c2: [0.16, -0.78], p1: [0.215, -0.735], m0: 0.45, m1: 0.63 },
      { p0: [0.215, -0.735], c1: [0.25, -0.71], c2: [0.265, -0.69], p1: [0.295, -0.688], m0: 0.63, m1: 0.79 },
    ],
    volute: { r0: 0.185, r1: 0.02, turns: 1.85, m0: 0.79 },
    up: [[0, 0.105], [0.06, 0.085], [0.25, 0.072], [0.38, 0.085], [0.47, 0.145], [0.55, 0.17], [0.63, 0.14], [0.71, 0.09], [0.79, 0.056], [0.88, 0.032], [1, 0.005]],
    down: [[0, 0.115], [0.06, 0.09], [0.25, 0.068], [0.38, 0.088], [0.46, 0.165], [0.53, 0.2], [0.6, 0.165], [0.69, 0.1], [0.79, 0.056], [0.88, 0.032], [1, 0.005]],
    jaw: { hingeM: 0.5, dirM: 0.7, angle: 0.38, len: 0.33, bow: 0.08, biteM: 0.56, lipM: 0.8,
      thick: [[0, 0.095], [0.35, 0.062], [0.72, 0.036], [1, 0.014]] },
    eye: { m: 0.56, off: 0.06, len: 0.15, h: 0.036 },
    nose: { m: 0.735, off: 0.055, r: 0.034 },
    crest: { at: [0.08, 0.155, 0.23, 0.305, 0.38], reach: 0.115, lean: 0.4, baseHalfM: 0.03 },
    chip: { m0: 0.04, m1: 0.45, count: 13, depth: 0.055 },
    mane: null,
  },
};

export function drawCandidate(ctx, which, x, y, size, opts = {}) {
  const P = PRESETS[which];
  if (!P) return;
  drawOne(ctx, P, x, y, size, opts);
}

export const CANDIDATES = Object.keys(PRESETS);
export const CANDIDATE_NAMES = Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, v.name]));
