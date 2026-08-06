// Per-gauntlet environmental mood for the lock rooms (docs/JARLS.md: five
// gauntlets of three locks, gauntlet = ceil(ordinal / 3)). Five rooms that are
// unmistakably different places, still cut from one game.
//
// The palette is FROZEN (docs/ART.md): every colour below is derived from a
// palette token through mix()/rgba(). No new base hexes. A mood is a LIGHT +
// PARTICLE overlay painted OVER the already-painted room — it never repaints
// the room, never touches puzzle furniture, and never changes text colour.
//
//   applyMood(ctx, w, h, gauntlet, t, reducedMotion)
//     ctx           2d context the CALLER owns and has cleared (additive pass)
//     t             milliseconds since the room mounted
//     reducedMotion true -> no time term anywhere; every call paints the same
//                   still frame (particles are placed, not animated)
//   moodTint(gauntlet) -> { id, key, name, tint, glow, edge } for DOM accents
//
// Cost: the static light field is rendered once per (gauntlet, size, dpr) into
// an offscreen canvas and blitted, so a frame is one drawImage plus a few
// dozen small particle draws (measured: artifacts/wip-moods/perf.mjs).
//
// Contrast: every field ends with a `textGuard` pass that subtracts the mood
// back out over the header and footer text bands, so the room's mood can never
// move the measured floors (docs/QUALITY.md A11y floors) by much in either
// direction. Verified numerically over real captures.
import { palette, rgba, mix } from './palette.js';
import { rng } from '../kernel/rng.js';

export const MOOD_KEYS = ['torchlit', 'seer', 'snowlight', 'feast', 'throne'];

const MOOD_NAMES = {
  torchlit: 'torchlit hall',
  seer: "seer's tent",
  snowlight: 'snowlight',
  feast: 'feast warmth',
  throne: 'throne cold-gold',
};

// Accent colours for DOM chrome. Derived from frozen tokens only.
const AMBER = mix(palette.ember, palette.goldBright, 0.42);
const VIOLET = mix(palette.blood, palette.fjord, 0.5);        // plum: blood x fjord
const VIOLET_LIGHT = mix(VIOLET, palette.fjordLight, 0.45);
const SNOW = mix(palette.fjordLight, palette.bone, 0.62);
const MEAD = mix(palette.gold, palette.ember, 0.4);
const COLD_GOLD = mix(palette.gold, palette.bone, 0.34);

const TINTS = {
  torchlit: AMBER,
  seer: VIOLET_LIGHT,
  snowlight: SNOW,
  feast: MEAD,
  throne: COLD_GOLD,
};

export function moodKey(gauntlet) {
  return MOOD_KEYS[clampGauntlet(gauntlet) - 1];
}

function clampGauntlet(g) {
  const n = Math.round(Number(g) || 1);
  return Math.max(1, Math.min(MOOD_KEYS.length, n));
}

/** DOM-side accents: a hex tint plus two ready-made rgba halos. */
export function moodTint(gauntlet) {
  const id = clampGauntlet(gauntlet);
  const key = MOOD_KEYS[id - 1];
  const tint = TINTS[key];
  return {
    id,
    key,
    name: MOOD_NAMES[key],
    tint,
    glow: rgba(tint, 0.2),
    edge: rgba(mix(tint, palette.tar, 0.55), 0.6),
  };
}

// ------------------------------------------------------------------ helpers

// Where a mood may put a torch, a shaft or a hanging talisman without ever
// standing over the puzzle column: the margin outside the 820px content frame
// when there is one (desktop), otherwise the extreme outer edge (phone).
function sideAnchors(w) {
  const margin = (w - 820) / 2;
  if (margin > 90) return [margin * 0.48, w - margin * 0.48];
  return [w * 0.055, w * 0.945];
}

function ellipseFill(ctx, cx, cy, rx, ry, stops) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function pool(ctx, cx, cy, r, color, alpha, squash = 1) {
  ellipseFill(ctx, cx, cy, r, r * squash, [
    [0, rgba(color, alpha)],
    [0.42, rgba(color, alpha * 0.42)],
    [1, rgba(color, 0)],
  ]);
}

// A light shaft: a leaning quad filled with a top-bright vertical gradient,
// laid down three times (wide+faint, body, hot core) so the edges feather.
function shaft(ctx, w, h, opts) {
  const {
    x, lean = 0, halfTop, halfBot, color, alpha,
    y0 = -0.04 * h, y1 = 1.04 * h, fade = 0.92,
  } = opts;
  const quad = (k, a) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, rgba(color, a));
    g.addColorStop(0.5, rgba(color, a * 0.55));
    g.addColorStop(fade, rgba(color, 0));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - halfTop * k, y0);
    ctx.lineTo(x + halfTop * k, y0);
    ctx.lineTo(x + lean * h + halfBot * k, y1);
    ctx.lineTo(x + lean * h - halfBot * k, y1);
    ctx.closePath();
    ctx.fill();
  };
  quad(1.55, alpha * 0.3);
  quad(1, alpha * 0.66);
  quad(0.42, alpha * 0.5);
}

// A long cast shadow: the same quad geometry, in tar, running the other way.
function castShadow(ctx, w, h, x, lean, halfTop, halfBot, alpha) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(palette.tar, alpha * 0.25));
  g.addColorStop(0.45, rgba(palette.tar, alpha));
  g.addColorStop(1, rgba(palette.tar, alpha * 0.4));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - halfTop, -0.02 * h);
  ctx.lineTo(x + halfTop, -0.02 * h);
  ctx.lineTo(x + lean * h + halfBot, h * 1.02);
  ctx.lineTo(x + lean * h - halfBot, h * 1.02);
  ctx.closePath();
  ctx.fill();
}

// Subtract the mood back out where the shell's text sits: the header band
// (numeral / title / epigraph) hard, the footer band (near-line, hints,
// latch) softer. Feathered ellipses, so there is no seam to see.
function textGuard(ctx, w, h) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  // Sized to the text, not to the third of the screen it sits in: at 390px
  // the header and footer bands ARE most of the visible room, and a guard any
  // taller than this washes the phone rooms back toward identical.
  ellipseFill(ctx, w * 0.5, h * 0.03, w * 0.54, h * 0.2, [
    [0, 'rgba(0,0,0,0.82)'],
    [0.55, 'rgba(0,0,0,0.48)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  ellipseFill(ctx, w * 0.5, h * 1.0, w * 0.42, h * 0.15, [
    [0, 'rgba(0,0,0,0.52)'],
    [0.55, 'rgba(0,0,0,0.28)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  ctx.restore();
}

// ------------------------------------------------------------- static fields

function fieldTorchlit(ctx, w, h) {
  const [xl, xr] = sideAnchors(w);
  // lit from two brackets high on the side walls: warm where they reach,
  // sooty everywhere they do not — the floor of the hall goes black
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(AMBER, 0.16));
  g.addColorStop(0.4, rgba(palette.ember, 0.07));
  g.addColorStop(0.78, rgba(palette.tar, 0.3));
  g.addColorStop(1, rgba(palette.tar, 0.46));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (const x of [xl, xr]) {
    pool(ctx, x, h * 0.22, Math.max(w, h) * 0.32, AMBER, 0.36, 1.3);
    pool(ctx, x, h * 0.21, Math.max(w, h) * 0.1, mix(palette.goldBright, palette.bone, 0.3), 0.4);
    // the soot each bracket has printed up the wall above it
    pool(ctx, x, h * 0.015, w * 0.11, palette.tar, 0.5, 1.7);
  }
  // the unlit middle of the hall between the two brackets
  pool(ctx, w * 0.5, h * 0.62, Math.max(w, h) * 0.42, palette.tar, 0.22, 1.1);
  pool(ctx, w * 0.5, h * 1.02, w * 0.5, palette.ember, 0.1, 0.5);
}

function fieldSeer(ctx, w, h) {
  const [xl, xr] = sideAnchors(w);
  // the tent kills the warmth: a violet shadow tint everywhere, cold at the
  // hem, and one dim smoke-hole cone down the middle
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(VIOLET, 0.26));
  g.addColorStop(0.5, rgba(VIOLET, 0.2));
  g.addColorStop(1, rgba(palette.fjord, 0.24));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  shaft(ctx, w, h, {
    x: w * 0.5, lean: 0, halfTop: w * 0.06, halfBot: w * 0.3,
    color: mix(VIOLET_LIGHT, palette.bone, 0.3), alpha: 0.075, fade: 0.8,
  });
  // seer's brazier: one low cold-red coal, off to one side
  pool(ctx, xl + (xr - xl) * 0.12, h * 0.82, w * 0.22, palette.blood, 0.16, 0.8);
  // the tent walls close in
  for (const x of [0, w]) pool(ctx, x, h * 0.5, w * 0.24, VIOLET, 0.3, 2.6);
  pool(ctx, w * 0.5, h * 1.04, w * 0.6, palette.tar, 0.3, 0.42);
}

function fieldSnowlight(ctx, w, h) {
  const [xl, xr] = sideAnchors(w);
  // blue-white key from above; the field itself goes cold and slightly darker,
  // so the room reads as lit through snow rather than by fire
  // The key comes in over the SHOULDERS of the room, not down its middle:
  // the pale light banks at the top corners and runs down the side walls,
  // which is both truer to a snow-lit hall and what keeps the header band
  // dark enough for the text floors (measured — see the handoff).
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(SNOW, 0.13));
  g.addColorStop(0.34, rgba(SNOW, 0.1));
  g.addColorStop(0.72, rgba(palette.fjord, 0.22));
  g.addColorStop(1, rgba(palette.fjord, 0.32));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (const x of [xl, xr]) pool(ctx, x, -h * 0.03, w * 0.26, SNOW, 0.3, 1.1);
  // two shafts down the side walls, the way daylight falls through roof gaps
  for (const [x, lean] of [[xl, 0.055], [xr, -0.055]]) {
    shaft(ctx, w, h, {
      x, lean, halfTop: w * 0.042, halfBot: w * 0.085,
      color: SNOW, alpha: 0.28, fade: 0.86,
    });
  }
  pool(ctx, w * 0.5, -h * 0.1, w * 0.6, SNOW, 0.08, 0.78);
  // the cold sits in the corners of the room
  for (const x of [0, w]) pool(ctx, x, h * 0.62, w * 0.2, palette.fjord, 0.28, 2.4);
  pool(ctx, w * 0.5, h * 1.05, w * 0.62, palette.fjord, 0.3, 0.42);
}

function fieldFeast(ctx, w, h) {
  const [xl, xr] = sideAnchors(w);
  // two hearths burning low, and mead-glow along the boards
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(palette.tar, 0.16));
  g.addColorStop(0.4, rgba(MEAD, 0.07));
  g.addColorStop(1, rgba(MEAD, 0.24));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (const x of [xl, xr]) {
    // the light shaft each hearth throws up the wall
    shaft(ctx, w, h, {
      x, lean: x < w * 0.5 ? 0.09 : -0.09, halfTop: w * 0.045, halfBot: w * 0.11,
      color: mix(MEAD, palette.goldBright, 0.4), alpha: 0.17, fade: 0.9,
    });
    pool(ctx, x, h * 0.74, Math.max(w, h) * 0.26, palette.ember, 0.26, 1.1);
    pool(ctx, x, h * 0.75, Math.max(w, h) * 0.08, mix(palette.goldBright, palette.bone, 0.2), 0.28);
  }
  // mead rim along the foot of the room
  const rim = ctx.createLinearGradient(0, h, 0, h * 0.78);
  rim.addColorStop(0, rgba(MEAD, 0.26));
  rim.addColorStop(1, rgba(MEAD, 0));
  ctx.fillStyle = rim;
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  // rafters: the roof of a feast hall is the darkest thing in it
  pool(ctx, w * 0.5, -h * 0.04, w * 0.62, palette.tar, 0.34, 0.55);
}

function fieldThrone(ctx, w, h) {
  // severe: one hard gold key from a high window off to the left, long
  // shadows raked off it, everything it does not touch going cold. The key
  // enters over the side wall (sideAnchors), never down the text column.
  const [xl, xr] = sideAnchors(w);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(palette.fjord, 0.13));
  g.addColorStop(0.45, rgba(palette.tar, 0.15));
  g.addColorStop(1, rgba(palette.fjord, 0.2));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 4; i++) {
    castShadow(ctx, w, h, w * (0.06 + i * 0.3), 0.34, w * 0.055, w * 0.1, 0.25);
  }
  shaft(ctx, w, h, {
    x: xl, lean: 0.34, halfTop: w * 0.05, halfBot: w * 0.08,
    color: COLD_GOLD, alpha: 0.34, fade: 0.95,
  });
  shaft(ctx, w, h, {
    x: xr, lean: 0.3, halfTop: w * 0.028, halfBot: w * 0.045,
    color: COLD_GOLD, alpha: 0.16, fade: 0.95,
  });
  pool(ctx, xl, -h * 0.06, w * 0.2, COLD_GOLD, 0.18, 1.1);
  pool(ctx, w * 0.5, h * 1.06, w * 0.66, palette.tar, 0.34, 0.46);
}

const FIELDS = {
  torchlit: fieldTorchlit,
  seer: fieldSeer,
  snowlight: fieldSnowlight,
  feast: fieldFeast,
  throne: fieldThrone,
};

// ----------------------------------------------------------------- particles

// Deterministic particle beds, built once per (mood, size) alongside the
// field. `t` only moves them; the set never changes, so a paused room and a
// live one are the same room.
function buildMotes(key, w, h) {
  const r = rng(`mood:${key}:${Math.round(w)}x${Math.round(h)}`);
  const bed = (n, fn) => Array.from({ length: n }, (_, i) => fn(i, r));
  const [xl, xr] = sideAnchors(w);
  switch (key) {
    case 'torchlit':
      return {
        smoke: bed(3, (i) => ({ x: (i === 1 ? w * 0.5 : i === 0 ? xl : xr), r: w * (0.1 + r() * 0.06), ph: r(), sp: 0.55 + r() * 0.4 })),
        embers: bed(26, () => ({ x: (r() < 0.5 ? xl : xr) + (r() - 0.5) * w * 0.14, ph: r(), sp: 0.5 + r() * 0.7, s: 0.9 + r() * 1.8, sw: 4 + r() * 12 })),
      };
    case 'seer':
      return {
        wisps: bed(5, (i) => ({ x: xl + (xr - xl) * (0.06 + i * 0.22) * (i % 2 ? 1 : 0.35), ph: r(), sp: 0.3 + r() * 0.25, amp: w * (0.012 + r() * 0.016) })),
        charms: bed(8, (i) => ({
          x: (i % 2 ? xr : xl) + (r() - 0.5) * w * 0.07,
          drop: h * (0.07 + r() * 0.2), kind: i % 3, size: h * (0.019 + r() * 0.015), ph: r(),
        })),
      };
    case 'snowlight':
      return {
        breath: bed(5, () => ({ x: r() * w, y: h * (0.5 + r() * 0.45), r: w * (0.05 + r() * 0.05), ph: r(), sp: 0.22 + r() * 0.2 })),
        // frost sits in the corners of the room panel, where the carved lip
        // catches it — not scattered across the field like sparkles
        glints: bed(4, (i) => {
          const cx = [0.024, 0.976, 0.024, 0.976][i];
          const cy = [0.022, 0.022, 0.978, 0.978][i];
          return { x: cx * w, y: cy * h, s: w * (0.0022 + r() * 0.0016), ph: r() };
        }),
      };
    case 'feast':
      return {
        dust: bed(26, () => ({
          x: (r() < 0.5 ? xl : xr) + (r() - 0.5) * w * 0.2,
          y: r(), ph: r(), sp: 0.14 + r() * 0.2, s: 0.6 + r() * 1.3, amp: w * (0.008 + r() * 0.014),
        })),
      };
    default:
      // `y` is a fraction of the DUST BAND, not of the room: falling motes
      // stay off the header and footer, where the shell's text sits.
      return {
        dust: bed(24, () => ({
          x: r() * w, y: r(), ph: r(), sp: 0.1 + r() * 0.13,
          s: 0.6 + r() * 1.2, amp: w * (0.004 + r() * 0.008),
        })),
      };
  }
}

const frac = (v) => v - Math.floor(v);

// The particle pass runs after the cached field, so textGuard cannot reach it.
// This is the same two bands, applied per mote: air does not gather over the
// shell's text. Returns a 0..1 alpha multiplier.
function guardAlpha(x, y, w, h) {
  const band = (cx, cy, rx, ry, k) => {
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    const d = Math.sqrt(dx * dx + dy * dy);
    return d >= 1 ? 0 : k * (1 - d);
  };
  const g = Math.max(
    band(w * 0.5, h * 0.03, w * 0.54, h * 0.2, 1),
    band(w * 0.5, h, w * 0.42, h * 0.15, 0.74),
  );
  return Math.max(0, 1 - g);
}

function drawMotes(ctx, w, h, key, motes, s) {
  ctx.save();
  switch (key) {
    case 'torchlit': {
      for (const p of motes.smoke) {
        const k = frac(p.ph + s * 0.045 * p.sp);
        const y = h * (1.05 - k * 1.15);
        const grow = 0.6 + k * 1.1;
        pool(ctx, p.x + Math.sin(s * 0.3 * p.sp + p.ph * 6.28) * w * 0.03, y,
          p.r * grow, palette.tar, 0.13 * (1 - Math.abs(k - 0.45) * 1.1), 1.15);
      }
      for (const p of motes.embers) {
        const k = frac(p.ph + s * 0.07 * p.sp);
        const y = h * (0.92 - k * 0.95);
        const x = p.x + Math.sin(s * 0.9 * p.sp + p.ph * 9) * p.sw;
        const a = (1 - k) * 0.85 * (0.55 + 0.45 * Math.sin(s * 6 + p.ph * 12)) * guardAlpha(x, y, w, h);
        if (a <= 0.02) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = k > 0.55 ? rgba(palette.ember, 1) : rgba(palette.goldBright, 1);
        ctx.beginPath();
        ctx.arc(x, y, p.s * (1 - k * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'seer': {
      ctx.lineCap = 'round';
      for (const p of motes.wisps) {
        const k = frac(p.ph + s * 0.03 * p.sp);
        const base = h * (1.0 - k * 0.85);
        ctx.strokeStyle = rgba(mix(palette.bone, VIOLET_LIGHT, 0.5),
          0.1 * (1 - k) * guardAlpha(p.x, base - h * 0.12, w, h));
        ctx.lineWidth = Math.max(1, w * 0.004);
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
          const yy = base - (i / 8) * h * 0.24;
          const xx = p.x + Math.sin(s * 0.8 * p.sp + i * 0.7 + p.ph * 6.28) * p.amp * (0.4 + i / 8);
          if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      }
      for (const c of motes.charms) {
        const sway = Math.sin(s * 0.55 + c.ph * 6.28) * 0.09;
        ctx.save();
        ctx.translate(c.x, 0);
        ctx.rotate(sway);
        ctx.strokeStyle = rgba(palette.tar, 0.72);
        ctx.lineWidth = Math.max(1, w * 0.0022);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, c.drop);
        ctx.stroke();
        ctx.fillStyle = rgba(palette.tar, 0.78);
        ctx.strokeStyle = rgba(VIOLET_LIGHT, 0.35);
        ctx.beginPath();
        if (c.kind === 0) {
          ctx.arc(0, c.drop + c.size, c.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(0, c.drop + c.size, c.size * 0.55, 0, Math.PI * 2);
          ctx.stroke();
        } else if (c.kind === 1) {
          ctx.ellipse(0, c.drop + c.size * 1.4, c.size * 0.5, c.size * 1.4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.moveTo(-c.size * 0.8, c.drop);
          ctx.lineTo(c.size * 0.8, c.drop);
          ctx.lineTo(0, c.drop + c.size * 1.9);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
      break;
    }
    case 'snowlight': {
      for (const p of motes.breath) {
        const k = frac(p.ph + s * 0.04 * p.sp);
        const bx = p.x + k * w * 0.06;
        const by = p.y - k * h * 0.08;
        const a = 0.11 * Math.sin(Math.PI * k) * guardAlpha(bx, by, w, h);
        pool(ctx, bx, by, p.r * (0.7 + k * 0.9), mix(palette.bone, SNOW, 0.4), a, 0.62);
      }
      for (const g of motes.glints) {
        const tw = 0.5 + 0.5 * Math.sin(s * 1.6 + g.ph * 6.28);
        const a = (0.24 + 0.5 * tw) * guardAlpha(g.x, g.y, w, h);
        const r2 = g.s * (0.7 + 0.5 * tw);
        // frost catching the corner lip: a soft bloom with a short cross in
        // it, not a drawn plus sign
        pool(ctx, g.x, g.y, r2 * 3.4, mix(SNOW, palette.bone, 0.5), a * 0.5);
        ctx.strokeStyle = rgba(mix(SNOW, palette.bone, 0.6), a * 0.8);
        ctx.lineWidth = Math.max(0.7, w * 0.0011);
        ctx.beginPath();
        ctx.moveTo(g.x - r2, g.y); ctx.lineTo(g.x + r2, g.y);
        ctx.moveTo(g.x, g.y - r2 * 0.7); ctx.lineTo(g.x, g.y + r2 * 0.7);
        ctx.stroke();
        ctx.fillStyle = rgba(palette.bone, a * 0.75);
        ctx.beginPath();
        ctx.arc(g.x, g.y, Math.max(0.6, r2 * 0.24), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    default: {
      const warm = key === 'feast';
      ctx.fillStyle = rgba(warm ? mix(palette.bone, MEAD, 0.45) : mix(palette.bone, COLD_GOLD, 0.5), 1);
      for (const p of motes.dust) {
        const k = frac(p.ph + s * 0.02 * p.sp);
        const y = warm
          ? h * (0.26 + p.y * 0.56) + Math.sin(s * 0.5 * p.sp + p.ph * 6.28) * h * 0.04 + k * h * 0.08
          : h * (0.25 + frac(p.y + k) * 0.58);
        const x = p.x + Math.sin(s * 0.4 * p.sp + p.ph * 9) * p.amp;
        ctx.globalAlpha = (0.24 + 0.34 * (0.5 + 0.5 * Math.sin(s * 1.1 + p.ph * 6.28))) * guardAlpha(x, y, w, h);
        ctx.beginPath();
        ctx.arc(x, y, p.s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
  }
  ctx.restore();
}

// -------------------------------------------------------------------- cache

const CACHE = new Map();
const MAX_CACHE = 8;

function fieldDpr() {
  const d = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  return Math.max(1, Math.min(d, 2));
}

function entryFor(key, w, h) {
  const d = fieldDpr();
  const ck = `${key}|${Math.round(w)}x${Math.round(h)}@${d}`;
  let entry = CACHE.get(ck);
  if (entry) {
    CACHE.delete(ck);
    CACHE.set(ck, entry);
    return entry;
  }
  const motes = buildMotes(key, w, h);
  let canvas = null;
  if (typeof document !== 'undefined' && document.createElement) {
    canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * d));
    canvas.height = Math.max(1, Math.round(h * d));
    const c = canvas.getContext('2d');
    c.scale(d, d);
    FIELDS[key](c, w, h);
    textGuard(c, w, h);
  }
  entry = { canvas, motes };
  CACHE.set(ck, entry);
  if (CACHE.size > MAX_CACHE) CACHE.delete(CACHE.keys().next().value);
  return entry;
}

// ---------------------------------------------------------------------- API

/**
 * Paint gauntlet `gauntlet`'s mood over an already-painted room. Additive:
 * the caller owns the surface and must clear it first if it is reused.
 */
export function applyMood(ctx, w, h, gauntlet, t = 0, reducedMotion = false) {
  if (!(w > 0) || !(h > 0)) return;
  const key = moodKey(gauntlet);
  const entry = entryFor(key, w, h);
  if (entry.canvas) ctx.drawImage(entry.canvas, 0, 0, w, h);
  else { FIELDS[key](ctx, w, h); textGuard(ctx, w, h); }
  const s = reducedMotion ? 0 : (Number(t) || 0) / 1000;
  drawMotes(ctx, w, h, key, entry.motes, s);
}
