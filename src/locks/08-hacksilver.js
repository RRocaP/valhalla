// 08 — THE TWELVE PIECES
//
// The full twelve-coin problem dressed as hacksilver: twelve cut pieces lie on
// the thing-stone, one of them false — clipped light or salted heavy, and which
// way is not known. Three balance weighings were sworn before the assembly and
// are carved into the ledger. Name the false piece and its direction.
//
// SEPARATING DESIGN. Each piece i is given a side-vector v_i in {-1,0,+1}^3:
// v_i[w] = +1 on the left pan of weighing w, -1 on the right, 0 if withheld.
// A hypothesis (piece p, heavier b) produces the outcome vector
//   out[w] = v_p[w] * (b ? +1 : -1)          (+1 = left pan sinks)
// Two hypotheses are told apart exactly when their outcome vectors differ, so
// the design must have every v_i non-zero and no two of them equal or opposite.
// The generator does NOT trust that argument: it simulates all 24 hypotheses
// against the three weighings and demands 24 distinct outcome signatures.
//
// Balance: each weighing must carry the same count of pieces on both pans, so
// exactly one of the four all-three-weighings classes is withheld from the row.
//
// Answer: { piece: 0..11, heavier: boolean }.

import { SHARDS } from '../kernel/shards.js';
import { ORDER, BY_CH } from '../kernel/futhark.js';

const ID = '08-hacksilver';
const N = 12;

const MARKS = Object.freeze(ORDER.slice(0, N));

const CUTS = Object.freeze([
  'arm-ring cut', 'brooch tongue', 'ingot end', 'neck-ring twist',
  'coin, halved', 'thistle-brooch pin', 'rod length', 'bar shaving',
  'plait fragment', 'terminal knob', 'wire coil', 'strap mount',
]);

// the thirteen sign-classes of {-1,0,1}^3 \ {0}, first non-zero normalised to +1
const CLASSES = Object.freeze([
  [1, 0, 0], [0, 1, 0], [0, 0, 1],
  [1, 1, 0], [1, -1, 0], [1, 0, 1], [1, 0, -1], [0, 1, 1], [0, 1, -1],
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
]);
// only a class that appears in all three weighings may be withheld, otherwise
// some weighing is left with an odd number of pieces and cannot balance
const DROPPABLE = Object.freeze([9, 10, 11, 12]);

const TILT = Object.freeze(['right', 'level', 'left']); // index by out+1

// ---- pure helpers ----------------------------------------------------------

function outcome(vectors, piece, heavier) {
  const sign = heavier ? 1 : -1;
  return vectors[piece].map((s) => s * sign);
}

/** simulate every hypothesis; true when all 24 signatures are distinct */
export function isSeparating(vectors) {
  const seen = new Set();
  for (let p = 0; p < vectors.length; p++) {
    for (const heavier of [true, false]) {
      const sig = outcome(vectors, p, heavier).join(',');
      if (sig === '0,0,0' || seen.has(sig)) return false;
      seen.add(sig);
    }
  }
  return seen.size === vectors.length * 2;
}

function balanced(vectors) {
  for (let w = 0; w < 3; w++) {
    let sum = 0;
    for (const v of vectors) sum += v[w];
    if (sum !== 0) return false;
  }
  return true;
}

function buildWeighings(vectors) {
  const weighings = [];
  for (let w = 0; w < 3; w++) {
    const left = [];
    const right = [];
    vectors.forEach((v, i) => {
      if (v[w] === 1) left.push(i);
      else if (v[w] === -1) right.push(i);
    });
    weighings.push({ left, right });
  }
  return weighings;
}

// ---- generator -------------------------------------------------------------

function makePuzzle(rng) {
  let vectors = null;
  for (let attempt = 0; attempt < 4000 && !vectors; attempt++) {
    const drop = rng.pick(DROPPABLE);
    const kept = CLASSES.filter((_, i) => i !== drop);
    const signed = rng.shuffle(kept).map((v) => {
      const s = rng.chance(0.5) ? 1 : -1;
      return v.map((x) => x * s);
    });
    if (!balanced(signed)) continue;
    if (!isSeparating(signed)) continue;   // simulated, not assumed
    vectors = signed;
  }
  if (!vectors) {
    // deterministic fallback: the classic static design, still simulation-checked
    const kept = CLASSES.filter((_, i) => i !== 9);
    vectors = kept.map((v, i) => (i % 2 ? v.map((x) => -x) : v));
    if (!balanced(vectors) || !isSeparating(vectors)) vectors = CLASSES.slice(0, N);
  }

  const piece = rng.int(N);
  const heavier = rng.chance(0.5);
  const out = outcome(vectors, piece, heavier);
  const weighings = buildWeighings(vectors).map((w, i) => ({
    left: w.left, right: w.right, tilt: TILT[out[i] + 1],
  }));

  return {
    marks: MARKS.slice(),
    cuts: CUTS.slice(),
    weighings,
    hypotheses: N * 2,
  };
}

/** the tilt weighing w would show if (piece, heavier) were the truth */
function predict(weighing, piece, heavier) {
  const onLeft = weighing.left.indexOf(piece) >= 0;
  const onRight = weighing.right.indexOf(piece) >= 0;
  if (!onLeft && !onRight) return 'level';
  const sinksLeft = onLeft === heavier;   // left+heavy sinks left; right+light sinks left
  return sinksLeft ? 'left' : 'right';
}

function consistent(instance, piece, heavier) {
  let agree = 0;
  for (const w of instance.weighings) {
    if (predict(w, piece, heavier) === w.tilt) agree++;
  }
  return agree;
}

function solve(instance) {
  for (let p = 0; p < N; p++) {
    for (const heavier of [true, false]) {
      if (consistent(instance, p, heavier) === 3) return { piece: p, heavier };
    }
  }
  return { piece: 0, heavier: true };
}

function verify(instance, answer) {
  if (!instance || !Array.isArray(instance.weighings)) return { ok: false };
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
  const { piece, heavier } = answer;
  if (typeof piece !== 'number' || !Number.isInteger(piece) || piece < 0 || piece >= N) return { ok: false };
  if (typeof heavier !== 'boolean') return { ok: false };
  const agree = consistent(instance, piece, heavier);
  if (agree === 3) return { ok: true };
  return { ok: false, near: `Your naming disagrees with ${3 - agree} of the three sworn weighings.` };
}

function wrongAnswers(instance) {
  const truth = solve(instance);
  const out = [{ piece: truth.piece, heavier: !truth.heavier }];
  for (let p = 0; p < N && out.length < 10; p++) {
    if (p === truth.piece) continue;
    out.push({ piece: p, heavier: true });
    if (out.length < 10) out.push({ piece: p, heavier: false });
  }
  return out;
}

// ---- view ------------------------------------------------------------------
//
// The silver-court. Three sworn weighings hang across the top as real balances
// — carved posts, oak beams, bronze chains, pans heaped with hack-silver — and
// the TILT of each beam is the datum: no reading required to see which side
// went down. The twelve pieces lie on a dark cloth on the counting table, each
// one its own cut of silver (chopped coin, arm-ring section, ingot end …), and
// picking one lights it wherever the three beams put it: pans and set-aside
// ledges both. That glint is the deduction verb, taught by the board.
// The verdict is two carved scale-pans; the accused piece is seated into one
// and the pan sinks, so the oath is seen before it is sworn.

const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";

// Cold silver, layered the way docs/ART.md layers gold — base gradient,
// burnish, planishing dents, cut arris, one specular tick. Never a flat fill.
const AG = {
  hi: '#f8fafc', lit: '#d7dde3', base: '#a8b1ba', mid: '#7b848d',
  low: '#434b53', deep: '#20252a',
};

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

// View-side hex mixer (the frozen art API exposes palette tokens, not colour math).
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sa, sb) => Math.round(sa + (sb - sa) * t);
  const r = ch(pa >> 16, pb >> 16);
  const g = ch((pa >> 8) & 255, (pb >> 8) & 255);
  const bl = ch(pa & 255, pb & 255);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

// deterministic per-piece micro-noise (view only; the pure half never sees it)
const h32 = (n) => {
  let x = (n | 0) + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
};

// Board copy. English is the source; es/ca live in the additive i18n block
// (docs/CONTRACT.md §4.1 amendment) and are resolved through it at mount.
const BOARD_EN = {
  ords: ['First', 'Second', 'Third'],
  weighing: '{ord} weighing',
  tiltLeft: 'the left pan sank',
  tiltRight: 'the right pan sank',
  tiltLevel: 'the beam stood level',
  aside: 'set aside',
  courtHead: 'The twelve pieces, laid on the cloth',
  heavy: 'heavy — salted',
  light: 'light — clipped',
  swear: 'Swear the accusation',
  sworn: 'The accusation stands',
  solvedLine: 'The false piece is named, and the beam bears the oath.',
  stagingPiece: 'The {cut} is picked up. Seat it in a pan — heavy, or light.',
  stagingReady: 'You will swear: the {cut} — {dir}.',
  dirHeavy: 'salted, and weighs heavy',
  dirLight: 'clipped, and weighs light',
  callHeavy: 'heavy',
  callLight: 'light',
  reading: 'The {cut} — first: {w1}; second: {w2}; third: {w3}.',
  leftPan: 'left pan',
  rightPan: 'right pan',
  withheld: 'withheld',
  tally: 'reckoning',
  skip: 'Skip the showing',
  ariaPieces: 'The twelve pieces on the counting cloth',
  ariaPiece: '{cut}, marked {rune}',
  ariaPicked: ', named',
  ariaTableau: '{ord} weighing. Left pan: {left}. Right pan: {right}. Set aside: {aside}. Sworn: {tilt}.',
  ariaPan: 'Seat the piece in the {dir} pan',
  wrong: 'The beam does not bear that oath.',
  openLine: 'Twelve cut pieces; one is false, heavy or light, and nobody swore which.',
  openWeighing: 'Weighing {n}: {left} against {right} — {tilt}. Withheld: {aside}.',
  pickNote: 'Accusation laid on the {cut}.',
  dirNote: 'The fault is called {dir}.',
  cuts: CUTS.slice(),
};

// ---- the twelve silhouettes ------------------------------------------------
// One shape per cut in CUTS, drawn centred on the origin in the current
// transform. Every piece is built in layers: cast shadow, body gradient,
// burnish, planishing dents, cut arris, specular tick. Twelve distinct
// outlines, so a piece is known by its shape before its mark is read.

function planish(c, x, y, w, h, seed, n) {
  for (let i = 0; i < n; i++) {
    const r1 = h32(seed * 31 + i * 7);
    const r2 = h32(seed * 17 + i * 13 + 5);
    const px = x + r1 * w;
    const py = y + r2 * h;
    const rr = Math.max(0.7, Math.min(w, h) * (0.05 + r1 * 0.08));
    c.lineWidth = Math.max(0.45, rr * 0.36);
    c.strokeStyle = rgba(AG.deep, 0.14 + r2 * 0.13);
    c.beginPath(); c.arc(px, py, rr, 0.7, 3.5); c.stroke();
    c.strokeStyle = rgba(AG.hi, 0.26 + r1 * 0.22);
    c.beginPath(); c.arc(px, py, rr, 3.9, 6.1); c.stroke();
  }
}

function fillSilver(c, pathFn, b, seed, lit) {
  c.save();
  c.beginPath(); pathFn(c); c.clip();
  const g = c.createLinearGradient(b.x, b.y, b.x + b.w * 0.4, b.y + b.h);
  g.addColorStop(0, lit ? '#ffffff' : AG.hi);
  g.addColorStop(0.3, AG.lit);
  g.addColorStop(0.64, AG.base);
  g.addColorStop(1, lit ? AG.mid : AG.low);
  c.fillStyle = g;
  c.fillRect(b.x, b.y, b.w, b.h);
  const bx = b.x + b.w * 0.34;
  const by = b.y + b.h * 0.24;
  const br = c.createRadialGradient(bx, by, 0, bx, by, Math.max(b.w, b.h) * 0.66);
  br.addColorStop(0, rgba(AG.hi, lit ? 0.72 : 0.46));
  br.addColorStop(1, rgba(AG.hi, 0));
  c.fillStyle = br;
  c.fillRect(b.x, b.y, b.w, b.h);
  planish(c, b.x, b.y, b.w, b.h, seed, 7);
  // inner arris: the cut edge catches from above-left
  c.strokeStyle = rgba(AG.hi, 0.5);
  c.lineWidth = 1.2;
  c.translate(-0.9, -1);
  c.beginPath(); pathFn(c); c.stroke();
  c.restore();
  c.save();
  c.beginPath(); pathFn(c);
  c.strokeStyle = rgba(AG.deep, 0.92);
  c.lineWidth = Math.max(0.8, Math.min(b.w, b.h) * 0.055);
  c.stroke();
  c.restore();
}

function strokeSilver(c, pathFn, width, lit) {
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = rgba(AG.deep, 0.9);
  c.lineWidth = width + 1.7;
  c.beginPath(); pathFn(c); c.stroke();
  const g = c.createLinearGradient(0, -width, 0, width);
  g.addColorStop(0, lit ? '#ffffff' : AG.lit);
  g.addColorStop(0.5, AG.base);
  g.addColorStop(1, AG.low);
  c.strokeStyle = g;
  c.lineWidth = width;
  c.beginPath(); pathFn(c); c.stroke();
  c.strokeStyle = rgba(AG.hi, lit ? 0.85 : 0.6);
  c.lineWidth = Math.max(0.7, width * 0.28);
  c.translate(-width * 0.12, -width * 0.24);
  c.beginPath(); pathFn(c); c.stroke();
  c.restore();
}

/**
 * A balance pan, in the layered-gold discipline of docs/ART.md: cast shadow,
 * base gradient, burnish, specular ticks, tar seat, lit rim. `depth` sets how
 * deep the bowl hangs, so the silver in it sits IN the pan, not on its lip.
 */
function goldPan(c, P, cx, by, r, depth, hot) {
  const bowl = (g) => {
    g.moveTo(cx - r, by);
    g.bezierCurveTo(cx - r * 0.86, by + depth * 1.3, cx + r * 0.86, by + depth * 1.3, cx + r, by);
    g.closePath();
  };
  c.save();
  c.fillStyle = rgba('#0c0906', 0.5);
  c.beginPath();
  c.ellipse(cx + r * 0.1, by + depth * 0.9, r * 0.98, depth * 0.42, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();

  c.save();
  c.beginPath(); bowl(c); c.clip();
  const g1 = c.createLinearGradient(cx - r, by, cx + r * 0.6, by + depth);
  g1.addColorStop(0, hot ? '#fff1c7' : P.goldBright);
  g1.addColorStop(0.34, P.gold);
  g1.addColorStop(1, mixHex(P.gold, P.tar, 0.7));
  c.fillStyle = g1;
  c.fillRect(cx - r, by - 2, r * 2, depth * 1.6);
  const bx = cx - r * 0.34;
  const g2 = c.createRadialGradient(bx, by + depth * 0.2, 0, bx, by + depth * 0.2, r);
  g2.addColorStop(0, rgba(P.goldBright, hot ? 0.7 : 0.45));
  g2.addColorStop(1, rgba(P.goldBright, 0));
  c.fillStyle = g2;
  c.fillRect(cx - r, by - 2, r * 2, depth * 1.6);
  // hammered planishing across the bowl, then the pool of shade it holds
  for (let i = 0; i < 6; i++) {
    const t = h32(i * 41 + Math.round(r));
    const px = cx - r * 0.8 + t * r * 1.6;
    const py = by + depth * (0.24 + h32(i * 13) * 0.5);
    c.strokeStyle = rgba(P.tar, 0.2);
    c.lineWidth = 0.9;
    c.beginPath(); c.arc(px, py, r * 0.12, 0.6, 3.4); c.stroke();
  }
  const shade = c.createLinearGradient(0, by, 0, by + depth);
  shade.addColorStop(0, rgba(P.tar, 0.42));
  shade.addColorStop(0.5, rgba(P.tar, 0));
  c.fillStyle = shade;
  c.fillRect(cx - r, by - 2, r * 2, depth * 1.6);
  c.restore();

  c.save();
  c.beginPath(); bowl(c);
  c.strokeStyle = rgba(P.tar, 0.9);
  c.lineWidth = 1.4;
  c.stroke();
  // the rim: a rolled edge, dark seat under a bright catch
  c.strokeStyle = rgba(P.tar, 0.8);
  c.lineWidth = 2.6;
  c.beginPath(); c.moveTo(cx - r, by + 1.4); c.lineTo(cx + r, by + 1.4); c.stroke();
  c.strokeStyle = rgba('#fff1c7', hot ? 1 : 0.8);
  c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(cx - r, by); c.lineTo(cx + r, by); c.stroke();
  c.restore();
  specular(c, cx - r * 0.42, by + depth * 0.3, r * 0.14, -0.5, hot ? 0.8 : 0.5);
}

function specular(c, x, y, len, ang, a) {
  c.save();
  c.strokeStyle = rgba(AG.hi, a);
  c.lineWidth = Math.max(0.6, len * 0.16);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len);
  c.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
  c.stroke();
  c.restore();
}

/** one hack-silver fragment, centred on the origin, nominal width `s` */
function fragment(c, kind, s, lit) {
  const q = s / 2;
  const seed = kind * 97 + 11;
  // the cast shadow every piece throws onto whatever holds it
  c.save();
  c.fillStyle = rgba('#0c0906', 0.5);
  c.beginPath();
  c.ellipse(s * 0.06, s * 0.2, q * 0.86, q * 0.34, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();

  switch (kind) {
    case 0: { // arm-ring cut — a sawn section of a spiral ring
      const path = (g) => {
        g.arc(0, q * 0.16, q * 0.86, Math.PI * 1.08, Math.PI * 1.92);
        g.arc(0, q * 0.16, q * 0.5, Math.PI * 1.92, Math.PI * 1.08, true);
        g.closePath();
      };
      fillSilver(c, path, { x: -q, y: -q, w: s, h: s }, seed, lit);
      c.save();  // the punched ring-ornament the smith beat into the band
      c.strokeStyle = rgba(AG.deep, 0.5);
      c.lineWidth = Math.max(0.6, s * 0.035);
      for (let i = 0; i < 4; i++) {
        const a = Math.PI * (1.2 + i * 0.2);
        c.beginPath();
        c.arc(Math.cos(a) * q * 0.68, q * 0.16 + Math.sin(a) * q * 0.68, s * 0.05, 0, Math.PI * 2);
        c.stroke();
      }
      c.restore();
      break;
    }
    case 1: { // brooch tongue — a tapered blade with the pin-eye at the butt
      const path = (g) => {
        g.moveTo(-q * 0.92, -q * 0.24);
        g.lineTo(-q * 0.3, -q * 0.16);
        g.lineTo(q * 0.94, -q * 0.03);
        g.lineTo(q * 0.94, q * 0.03);
        g.lineTo(-q * 0.3, q * 0.2);
        g.lineTo(-q * 0.92, q * 0.28);
        g.closePath();
      };
      fillSilver(c, path, { x: -q, y: -q * 0.4, w: s, h: q * 0.8 }, seed, lit);
      c.save();
      c.strokeStyle = rgba(AG.deep, 0.75);
      c.lineWidth = Math.max(0.7, s * 0.045);
      c.beginPath(); c.arc(-q * 0.66, 0, s * 0.07, 0, Math.PI * 2); c.stroke();
      c.restore();
      break;
    }
    case 2: { // ingot end — a chunk chopped off a cast bar
      const path = (g) => {
        g.moveTo(-q * 0.9, -q * 0.34);
        g.lineTo(q * 0.52, -q * 0.42);
        g.lineTo(q * 0.9, -q * 0.02);
        g.lineTo(q * 0.62, q * 0.42);
        g.lineTo(-q * 0.86, q * 0.36);
        g.closePath();
      };
      fillSilver(c, path, { x: -q, y: -q * 0.5, w: s, h: s * 0.5 }, seed, lit);
      c.save();  // the chisel step where the bar was struck through
      c.strokeStyle = rgba(AG.deep, 0.6);
      c.lineWidth = Math.max(0.7, s * 0.04);
      c.beginPath();
      c.moveTo(q * 0.5, -q * 0.4); c.lineTo(q * 0.4, q * 0.4);
      c.stroke();
      c.strokeStyle = rgba(AG.hi, 0.45);
      c.beginPath();
      c.moveTo(q * 0.55, -q * 0.4); c.lineTo(q * 0.45, q * 0.4);
      c.stroke();
      c.restore();
      break;
    }
    case 3: { // neck-ring twist — a length of rope-twisted rod
      const path = (g) => {
        g.moveTo(-q * 0.92, q * 0.24);
        g.quadraticCurveTo(0, -q * 0.62, q * 0.92, q * 0.2);
      };
      strokeSilver(c, path, s * 0.19, lit);
      c.save();  // the twist: cross-cuts running the length
      c.strokeStyle = rgba(AG.deep, 0.55);
      c.lineWidth = Math.max(0.6, s * 0.032);
      for (let i = 1; i < 8; i++) {
        const t = i / 8;
        const x = -q * 0.92 + t * q * 1.84;
        const y = (1 - t) * (1 - t) * (q * 0.24) + 2 * (1 - t) * t * (-q * 0.62) + t * t * (q * 0.2);
        c.beginPath();
        c.moveTo(x - s * 0.04, y - s * 0.09);
        c.lineTo(x + s * 0.05, y + s * 0.09);
        c.stroke();
      }
      c.restore();
      break;
    }
    case 4: { // coin, halved — cut across the die
      const path = (g) => {
        g.arc(0, q * 0.3, q * 0.86, Math.PI, 0);
        g.closePath();
      };
      fillSilver(c, path, { x: -q, y: -q * 0.6, w: s, h: s * 0.5 }, seed, lit);
      c.save();
      c.strokeStyle = rgba(AG.deep, 0.55);
      c.lineWidth = Math.max(0.6, s * 0.035);
      c.beginPath(); c.arc(0, q * 0.3, q * 0.68, Math.PI, 0); c.stroke();
      // the die-stamp: a cross and four pellets, cut in half with the coin
      c.beginPath();
      c.moveTo(-q * 0.3, q * 0.06); c.lineTo(q * 0.3, q * 0.06);
      c.moveTo(0, -q * 0.24); c.lineTo(0, q * 0.28);
      c.stroke();
      c.restore();
      break;
    }
    case 5: { // thistle-brooch pin — rod with a knopped terminal
      strokeSilver(c, (g) => { g.moveTo(-q * 0.9, q * 0.16); g.lineTo(q * 0.42, -q * 0.14); }, s * 0.13, lit);
      fillSilver(c, (g) => g.arc(q * 0.6, -q * 0.2, q * 0.32, 0, Math.PI * 2),
        { x: q * 0.28, y: -q * 0.52, w: q * 0.64, h: q * 0.64 }, seed + 3, lit);
      c.save();
      c.strokeStyle = rgba(AG.deep, 0.6);
      c.lineWidth = Math.max(0.6, s * 0.035);
      c.beginPath();
      c.moveTo(q * 0.3, -q * 0.28); c.lineTo(q * 0.24, q * 0.04);
      c.stroke();
      c.restore();
      break;
    }
    case 6: { // rod length — a plain bar, slightly sprung
      strokeSilver(c, (g) => {
        g.moveTo(-q * 0.94, -q * 0.06);
        g.quadraticCurveTo(0, q * 0.24, q * 0.94, -q * 0.1);
      }, s * 0.23, lit);
      c.save();  // the file marks along its back
      c.strokeStyle = rgba(AG.deep, 0.35);
      c.lineWidth = Math.max(0.5, s * 0.025);
      for (let i = 0; i < 5; i++) {
        const x = -q * 0.7 + i * q * 0.35;
        c.beginPath();
        c.moveTo(x, -q * 0.1); c.lineTo(x + s * 0.05, q * 0.1);
        c.stroke();
      }
      c.restore();
      break;
    }
    case 7: { // bar shaving — a thin curl off the plane
      strokeSilver(c, (g) => {
        g.moveTo(-q * 0.9, q * 0.3);
        g.bezierCurveTo(-q * 0.1, -q * 0.72, q * 0.86, -q * 0.5, q * 0.5, q * 0.36);
      }, s * 0.095, lit);
      break;
    }
    case 8: { // plait fragment — three strands, cut through
      for (let k = 0; k < 3; k++) {
        const ph = k * 2.1;
        strokeSilver(c, (g) => {
          g.moveTo(-q * 0.9, Math.sin(ph) * q * 0.26);
          for (let i = 1; i <= 8; i++) {
            const t = i / 8;
            g.lineTo(-q * 0.9 + t * q * 1.8, Math.sin(ph + t * 4.4) * q * 0.26);
          }
        }, s * 0.1, lit);
      }
      break;
    }
    case 9: { // terminal knob — the finial off a ring, with its collar
      strokeSilver(c, (g) => { g.moveTo(-q * 0.92, q * 0.1); g.lineTo(-q * 0.05, q * 0.02); }, s * 0.15, lit);
      fillSilver(c, (g) => g.arc(q * 0.36, 0, q * 0.5, 0, Math.PI * 2),
        { x: -q * 0.14, y: -q * 0.5, w: s * 0.5, h: s * 0.5 }, seed + 5, lit);
      c.save();
      c.strokeStyle = rgba(AG.deep, 0.6);
      c.lineWidth = Math.max(0.7, s * 0.045);
      c.beginPath();
      c.moveTo(-q * 0.14, -q * 0.2); c.lineTo(-q * 0.14, q * 0.22);
      c.moveTo(-q * 0.03, -q * 0.28); c.lineTo(-q * 0.03, q * 0.3);
      c.stroke();
      c.restore();
      break;
    }
    case 10: { // wire coil — drawn wire, wound and clipped
      strokeSilver(c, (g) => {
        for (let i = 0; i <= 44; i++) {
          const t = i / 44;
          const a = t * Math.PI * 4.4;
          const r = q * (0.16 + t * 0.72);
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r * 0.62;
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
      }, s * 0.085, lit);
      break;
    }
    default: { // strap mount — a punched plate off a belt fitting
      const path = (g) => {
        const rw = q * 0.84;
        const rh = q * 0.5;
        g.moveTo(-rw, -rh * 0.6);
        g.quadraticCurveTo(-rw * 1.06, -rh, -rw * 0.7, -rh);
        g.lineTo(rw * 0.7, -rh);
        g.quadraticCurveTo(rw * 1.06, -rh, rw, -rh * 0.6);
        g.lineTo(rw * 0.86, rh * 0.7);
        g.quadraticCurveTo(rw * 0.8, rh, rw * 0.44, rh);
        g.lineTo(-rw * 0.44, rh);
        g.quadraticCurveTo(-rw * 0.8, rh, -rw * 0.86, rh * 0.7);
        g.closePath();
      };
      fillSilver(c, path, { x: -q, y: -q * 0.55, w: s, h: s * 0.55 }, seed, lit);
      c.save();  // three rivets, each with its own seat and catch light
      for (const rx of [-q * 0.52, 0, q * 0.52]) {
        c.fillStyle = rgba(AG.deep, 0.75);
        c.beginPath(); c.arc(rx, q * 0.02, s * 0.07, 0, Math.PI * 2); c.fill();
        c.fillStyle = rgba(AG.hi, 0.65);
        c.beginPath(); c.arc(rx - s * 0.015, q * 0.0, s * 0.035, 0, Math.PI * 2); c.fill();
      }
      c.restore();
      break;
    }
  }
  specular(c, -s * 0.2, -s * 0.14, s * 0.13, -0.7, lit ? 0.9 : 0.55);
}

function mount(ctx) {
  const art = ctx.art;
  const P = art.palette;
  const instance = ctx.instance;
  const lang = ctx.lang || 'en';
  const L = (I18N[lang] && I18N[lang].board) || {};
  const NEARMAP = (I18N[lang] && I18N[lang].nearMap) || {};
  const T = (key, params) => {
    let s = key in L ? L[key] : BOARD_EN[key];
    if (params) for (const k of Object.keys(params)) s = String(s).split(`{${k}}`).join(String(params[k]));
    return s;
  };
  const ORDS = (Array.isArray(L.ords) && L.ords.length === 3) ? L.ords : BOARD_EN.ords;
  const CUT = (Array.isArray(L.cuts) && L.cuts.length === N) ? L.cuts : BOARD_EN.cuts;
  const cutOf = (i) => CUT[i];
  const runeName = (ch) => (BY_CH[ch] ? BY_CH[ch].name : ch);
  const tiltWord = (t) => T(t === 'left' ? 'tiltLeft' : t === 'right' ? 'tiltRight' : 'tiltLevel');

  const cleanup = [];
  const timers = [];
  const on = (el, ev, fn, opts) => {
    el.addEventListener(ev, fn, opts);
    cleanup.push(() => el.removeEventListener(ev, fn, opts));
  };
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const sfx = (k) => { try { ctx.audio && ctx.audio.ui && ctx.audio.ui(k); } catch (e) { /* silent hall */ } };
  const say = (text) => { try { ctx.note && ctx.note(text); } catch (e) { /* no journal */ } };
  const node = (tag, css, text) => {
    const n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  };
  const calm = (() => {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  })();

  // ---- where every piece stood, weighing by weighing ----------------------
  // 0 left pan, 1 right pan, 2 withheld. This is the whole evidence table, and
  // it is what the glint draws.
  const STOOD = instance.weighings.map((w) => {
    const s = new Array(N).fill(2);
    w.left.forEach((i) => { s[i] = 0; });
    w.right.forEach((i) => { s[i] = 1; });
    return s;
  });
  const asideOf = (k) => {
    const out = [];
    for (let i = 0; i < N; i++) if (STOOD[k][i] === 2) out.push(i);
    return out;
  };
  const placeWord = (k, i) => T(['leftPan', 'rightPan', 'withheld'][STOOD[k][i]]);
  // the piece that stood in all three weighings makes the clearest showing
  const demoPiece = (() => {
    for (let i = 0; i < N; i++) if (STOOD.every((s) => s[i] !== 2)) return i;
    return 0;
  })();

  // ---- state --------------------------------------------------------------
  const truth = ctx.solved ? solve(instance) : null;
  let piece = truth ? truth.piece : -1;
  let heavier = truth ? truth.heavier : null;
  let hover = -1;
  let demoLit = -1;
  let shaking = false;
  let narrow = false;
  let railKey = '';
  const lit = () => (demoLit >= 0 ? demoLit : hover >= 0 ? hover : piece);

  // ---- frame --------------------------------------------------------------
  const wrap = node('div');
  wrap.className = 'ow-lock ow-hacksilver';
  const style = node('style');
  style.textContent = `
  .ow-hacksilver{display:grid;gap:9px;font-family:${SERIF};color:${P.bone}}
  .ow8-beams{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(232px,1fr))}
  .ow8-beam{line-height:0;position:relative}
  .ow8-beam canvas{display:block;width:100%;height:auto;border-radius:4px}
  .ow8-beam[data-shake="1"]{animation:ow8-shake .5s ease-in-out}
  @keyframes ow8-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}
    45%{transform:translateX(3px)}70%{transform:translateX(-2px)}}
  .ow8-court{position:relative;border-radius:6px;padding:16px 18px 44px}
  .ow8-cloth{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;border-radius:6px}
  .ow8-pieces{position:relative;display:grid;gap:6px;grid-template-columns:repeat(4,1fr)}
  @media (min-width:560px){.ow-hacksilver .ow8-pieces{grid-template-columns:repeat(6,1fr)}}
  @media (min-width:820px){.ow-hacksilver .ow8-pieces{grid-template-columns:repeat(12,1fr)}}
  .ow8-piece{position:relative;background:none;border:0;padding:0;margin:0;line-height:0;
    cursor:pointer;border-radius:6px;min-height:44px;min-width:44px;
    transition:transform .12s ease,filter .12s ease}
  .ow8-piece canvas{display:block;width:100%;height:auto}
  .ow8-piece:hover{transform:translateY(-3px)}
  .ow8-piece:focus-visible{outline:2px solid ${P.goldBright};outline-offset:2px}
  .ow8-piece[aria-checked="true"]{transform:translateY(-4px)}
  .ow8-read{margin:0;min-height:1.4em;font-size:.88rem;line-height:1.4;color:${P.boneDim};
    font-family:${SERIF};text-align:center;padding:5px 10px;border-radius:4px;
    background:linear-gradient(180deg,rgba(12,9,6,.5),rgba(12,9,6,.24));
    box-shadow:inset 0 1px 0 rgba(12,9,6,.85),inset 0 -1px 0 rgba(238,207,109,.12)}
  .ow8-read b{color:${P.bone};font-weight:600}
  .ow8-scales{position:relative;display:flex;gap:34px;justify-content:center;
    align-items:flex-start;flex-wrap:nowrap;padding:8px 0 6px;
    max-width:470px;margin:0 auto;width:100%}
  /* the bench behind these is an absolutely-positioned canvas, so the pans must
     be positioned too or an untransformed one paints underneath it */
  .ow8-scale{position:relative;z-index:1;
    background:none;border:0;padding:0;margin:0;cursor:pointer;border-radius:6px;
    display:grid;justify-items:center;gap:18px;min-height:44px;min-width:44px;
    font-family:${SERIF};font-size:.92rem;color:${P.boneDim};
    text-shadow:-1px -1px 0 rgba(12,9,6,.9),1px 1px 0 rgba(238,207,109,.18);
    transition:transform .12s ease}
  .ow8-scale canvas{display:block}
  .ow8-scale:hover{color:${P.bone}}
  .ow8-scale:focus-visible{outline:2px solid ${P.goldBright};outline-offset:2px}
  .ow8-scale[aria-pressed="true"]{color:${P.goldBright};transform:translateY(-2px)}
  .ow8-head{margin:0;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;
    color:${P.boneDim};text-align:center}
  .ow8-stage{margin:0;min-height:1.4em;font-size:.95rem;text-align:center;color:${P.goldBright}}
  .ow8-act{display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap}
  .ow8-skip{font-family:${SERIF};font-size:.85rem;color:${P.boneDim};background:transparent;
    border:1px solid rgba(90,58,30,.9);border-radius:3px;padding:11px 16px;min-height:44px;cursor:pointer}
  .ow8-skip:hover{color:${P.bone};border-color:${P.oakLight}}
  .ow8-skip:focus-visible{outline:2px solid ${P.goldBright};outline-offset:2px}
  .ow8-tell{margin:0;min-height:1.3em;font-size:.9rem;color:${P.ember};text-align:center;scroll-margin:28px}
  @media (prefers-reduced-motion: reduce){
    .ow8-piece,.ow8-scale{transition:none}
    .ow8-piece:hover,.ow8-piece[aria-checked="true"],.ow8-scale[aria-pressed="true"]{transform:none}
    .ow8-beam[data-shake="1"]{animation:none}
  }
  /* the shell sets \`#app *{min-width:0}\`, which outranks a bare class rule and
     flattens every touch target; this re-asserts the 44 px floor at equal weight */
  #app .ow-hacksilver button{min-width:44px}`;
  wrap.append(style);

  // ---- the three balances -------------------------------------------------
  const beams = node('div');
  beams.className = 'ow8-beams';
  const beamViews = instance.weighings.map((w, k) => {
    const host = node('div');
    host.className = 'ow8-beam';
    beams.append(host);
    return { host, w, k, gfx: { canvas: null, ctx: null, w: 0, h: 0 }, ground: null, key: '' };
  });

  // ---- the counting table -------------------------------------------------
  const court = node('div');
  court.className = 'ow8-court';
  const cloth = { canvas: null, ctx: null, w: 0, h: 0 };
  const clothHost = node('div');
  clothHost.style.cssText = 'position:absolute;inset:0;line-height:0';
  clothHost.setAttribute('aria-hidden', 'true');
  court.append(clothHost);

  const pieces = node('div');
  pieces.className = 'ow8-pieces';
  pieces.setAttribute('role', 'radiogroup');
  pieces.setAttribute('aria-label', T('ariaPieces'));
  court.append(pieces);

  const pieceViews = instance.marks.map((ch, i) => {
    const b = node('button');
    b.className = 'ow8-piece';
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', 'false');
    b.setAttribute('tabindex', i === 0 ? '0' : '-1');
    pieces.append(b);
    return { i, ch, btn: b, gfx: { canvas: null, ctx: null, w: 0, h: 0 }, key: '' };
  });

  // the ghost hand of the showing, laid over the cloth
  const ghostHost = node('div');
  ghostHost.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:3;line-height:0;display:none';
  ghostHost.setAttribute('aria-hidden', 'true');
  court.append(ghostHost);
  const ghost = { canvas: null, ctx: null, w: 0, h: 0 };

  // ---- the reading: where the lit piece stood -----------------------------
  const read = node('p');
  read.className = 'ow8-read';
  read.setAttribute('aria-live', 'polite');

  // ---- the verdict: two carved pans --------------------------------------
  const scales = node('div');
  scales.className = 'ow8-scales';
  // the two verdict pans hang off ONE beam, painted behind them, so choosing a
  // direction visibly tips the court's own balance
  const railHost = node('div', 'position:absolute;inset:0;line-height:0;pointer-events:none');
  railHost.setAttribute('aria-hidden', 'true');
  scales.append(railHost);
  const rail = { canvas: null, ctx: null, w: 0, h: 0 };
  const scaleViews = [[true, 'heavy'], [false, 'light']].map(([val, key]) => {
    const b = node('button');
    b.className = 'ow8-scale';
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    const label = node('span', null, T(key));
    const holder = node('div', 'line-height:0');
    b.append(holder, label);
    scales.append(b);
    return { val, key, btn: b, holder, label, gfx: { canvas: null, ctx: null, w: 0, h: 0 }, key2: '' };
  });

  const stage = node('p');
  stage.className = 'ow8-stage';
  stage.setAttribute('aria-live', 'polite');

  const acts = node('div');
  acts.className = 'ow8-act';
  const send = node('button', null, T('swear'));
  send.className = 'btn-carved'; // one primary-action language: the carved gold plate
  send.type = 'button';
  send.disabled = true;
  const skipBtn = node('button', null, T('skip'));
  skipBtn.className = 'ow8-skip';
  skipBtn.type = 'button';
  skipBtn.style.display = 'none';
  acts.append(send, skipBtn);

  // The shell's near-line sits below the fold on the taller locks; the beam
  // answers a wrong accusation where the player's eye already is.
  const tell = node('p');
  tell.className = 'ow8-tell';
  // visual echo only — the shell's .near-line is the single aria-live deny announcer (LOOP5 ruling)

  wrap.append(beams, court, read, scales, stage, acts, tell);
  ctx.root.append(wrap);

  // ---- canvas plumbing ----------------------------------------------------
  // `stretch` hands the box back to CSS: art.makeCanvas writes an inline pixel
  // size, which outranks any stylesheet rule, so anything that must follow its
  // container has to be told again here.
  function fitCanvas(holder, target, w, h, stretch) {
    if (target.canvas && target.w === w && target.h === h) return target;
    const fresh = art.makeCanvas(w, h);
    fresh.canvas.setAttribute('aria-hidden', 'true');
    if (stretch) {
      fresh.canvas.style.width = '100%';
      fresh.canvas.style.height = stretch === 'fill' ? '100%' : 'auto';
      fresh.canvas.style.display = 'block';
    }
    if (target.canvas && target.canvas.parentNode === holder) holder.replaceChild(fresh.canvas, target.canvas);
    else holder.append(fresh.canvas);
    target.canvas = fresh.canvas;
    target.ctx = fresh.ctx;
    target.w = fresh.w;
    target.h = fresh.h;
    return target;
  }

  // ---- painting: the plate -----------------------------------------------
  function wrapLines(c, text, size, maxW) {
    c.save();
    c.font = `600 ${size}px ${SERIF}`;
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const word of words) {
      const next = cur ? `${cur} ${word}` : word;
      if (c.measureText(next).width > maxW && cur) { lines.push(cur); cur = word; }
      else cur = next;
    }
    if (cur) lines.push(cur);
    c.restore();
    return lines;
  }

  function beamGeom(W, H) {
    const pivotY = narrow ? 26 : 30;
    const capH = narrow ? 24 : 27;
    const ledgeY = H - capH - (narrow ? 32 : 36);
    const arm = Math.min(W * 0.335, narrow ? 108 : 96);
    const tilt = narrow ? 8 : 10;
    const chain = narrow ? 15 : 19;
    const panR = Math.min(arm * 0.47, narrow ? 29 : 33);
    const frag = narrow ? 12.5 : 14;
    return { pivotY, capH, ledgeY, arm, tilt, chain, panR, frag, cx: W / 2 };
  }

  /** the carved shrine the balance hangs in — cached, it never changes */
  function beamGround(v) {
    const { w: W, h: H } = v.gfx;
    const key = `${W}x${H}`;
    if (v.ground && v.groundKey === key) return v.ground;
    const off = art.makeCanvas(W, H);
    const c = off.ctx;
    const g = beamGeom(W, H);
    art.paintWood(c, W, H, 3080 + v.k * 7);
    // stepped architrave: two posts and a lintel, cut proud of the field
    c.save();
    c.fillStyle = rgba(P.oakLight, 0.34);
    c.fillRect(4, 4, W - 8, 13);
    c.fillRect(4, 4, 11, H - 8 - g.capH);
    c.fillRect(W - 15, 4, 11, H - 8 - g.capH);
    c.fillRect(4, H - 8 - g.capH, W - 8, 8);
    c.restore();
    c.save();
    c.strokeStyle = rgba(P.tar, 0.85);
    c.lineWidth = 1.6;
    c.strokeRect(4.5, 4.5, W - 9, H - 9);
    c.strokeStyle = rgba(P.oakLight, 0.36);
    c.lineWidth = 1;
    c.strokeRect(6, 6, W - 12, H - 12);
    c.restore();
    art.chipBorder(c, 9, 9, W - 18, 9, { size: 7, alpha: 0.8 });
    art.rosette(c, 11, 11, 6.5);
    art.rosette(c, W - 11, 11, 6.5);
    art.wear(c, W, H, `beam${v.k}`, {
      avoid: { x: 14, y: g.pivotY - 14, w: W - 28, h: g.ledgeY - g.pivotY + 30 },
    });
    // The belly under the beam is the dead zone the density rubric names, so
    // the thing-man's own furniture lives there: a plumb-line off the lintel,
    // a scratch-weight resting on each side, and his chalk reckoning.
    const bellyY = (g.pivotY + g.ledgeY) / 2 + 4;
    c.save();
    c.strokeStyle = rgba(P.bone, 0.1);
    c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(g.cx, 17); c.lineTo(g.cx, bellyY + 8); c.stroke();
    c.fillStyle = rgba(P.tar, 0.5);
    c.beginPath();
    c.moveTo(g.cx - 3.2, bellyY + 8);
    c.lineTo(g.cx + 3.2, bellyY + 8);
    c.lineTo(g.cx, bellyY + 17);
    c.closePath();
    c.fill();
    c.strokeStyle = rgba(P.goldBright, 0.16);
    c.lineWidth = 0.9;
    c.stroke();
    c.restore();
    // two scratch-weights, notched with the count they answer for
    for (const [wx, wr] of [[26, 9], [W - 26, 7.5]]) {
      const wy = bellyY + 6;
      c.save();
      c.fillStyle = rgba(P.tar, 0.5);
      c.beginPath(); c.ellipse(wx + 1.5, wy + wr * 0.7, wr * 1.05, wr * 0.4, 0, 0, Math.PI * 2); c.fill();
      const wg = c.createRadialGradient(wx - wr * 0.34, wy - wr * 0.42, 0, wx, wy, wr * 1.25);
      wg.addColorStop(0, rgba(P.boneDim, 0.55));
      wg.addColorStop(1, rgba(P.tar, 0.92));
      c.fillStyle = wg;
      c.beginPath(); c.arc(wx, wy, wr, 0, Math.PI * 2); c.fill();
      c.strokeStyle = rgba(P.tar, 0.85);
      c.lineWidth = 1;
      c.stroke();
      c.strokeStyle = rgba(P.tar, 0.55);
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(wx - wr * 0.46 + i * wr * 0.46, wy - wr * 0.4);
        c.lineTo(wx - wr * 0.46 + i * wr * 0.46, wy + wr * 0.4);
        c.stroke();
      }
      c.restore();
    }
    // the chalk reckoning: five-barred gates, faint, the way a tally is kept
    c.save();
    c.strokeStyle = rgba(P.bone, 0.085);
    c.lineWidth = 1.1;
    c.lineCap = 'round';
    for (let gsz = 0; gsz < 3; gsz++) {
      const gx = g.cx - 46 + gsz * 44;
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.moveTo(gx + i * 5, bellyY - 8);
        c.lineTo(gx + i * 5 + 1.4, bellyY + 4);
        c.stroke();
      }
      c.beginPath();
      c.moveTo(gx - 3, bellyY + 3); c.lineTo(gx + 20, bellyY - 7);
      c.stroke();
    }
    c.restore();
    // the set-aside ledge: a carved shelf with its own lip light
    c.save();
    c.strokeStyle = rgba(P.tar, 0.9);
    c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(24, g.ledgeY + 7); c.lineTo(W - 24, g.ledgeY + 7); c.stroke();
    c.strokeStyle = rgba(P.goldBright, 0.2);
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(24, g.ledgeY + 8.6); c.lineTo(W - 24, g.ledgeY + 8.6); c.stroke();
    c.restore();
    art.carveText(c, T('aside'), W / 2, g.ledgeY + 19, narrow ? 9 : 10,
      { color: P.boneDim, depth: 0.35, align: 'center' });
    // the sworn plaque along the plinth
    const capY = H - g.capH;
    c.save();
    c.fillStyle = rgba(P.tar, 0.42);
    c.fillRect(12, capY - 2, W - 24, g.capH - 6);
    c.restore();
    art.carveText(c, T('weighing', { ord: ORDS[v.k] }).toUpperCase(), W / 2, capY + 8,
      narrow ? 8.5 : 9.5, { color: P.boneDim, depth: 0.5, align: 'center', letterSpacing: 1.6 });
    art.carveText(c, tiltWord(v.w.tilt), W / 2, capY + (narrow ? 19 : 21), narrow ? 10.5 : 11.5,
      { color: P.bone, depth: 0.75, align: 'center' });
    v.ground = off.canvas;
    v.groundKey = key;
    return v.ground;
  }

  function chainLink(c, x, y0, y1, seed) {
    const links = Math.max(3, Math.round((y1 - y0) / 6));
    const step = (y1 - y0) / links;
    for (let i = 0; i < links; i++) {
      const ly = y0 + step * (i + 0.5);
      const worn = h32(seed * 13 + i) > 0.66;
      c.save();
      c.strokeStyle = worn ? P.pineLight : P.gold;
      c.globalAlpha = worn ? 0.85 : 0.9;
      c.lineWidth = 1.5;
      c.beginPath();
      if (typeof c.ellipse === 'function') c.ellipse(x, ly, 2.2, Math.abs(step) * 0.46, 0, 0, Math.PI * 2);
      else c.arc(x, ly, 2.4, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
  }

  function heap(c, ids, cx, cy, size, spread) {
    const n = ids.length;
    ids.forEach((id, k) => {
      const t = n === 1 ? 0 : (k / (n - 1)) - 0.5;
      const x = cx + t * spread;
      const y = cy + Math.abs(t) * size * 0.16 + (h32(id * 5 + k) - 0.5) * size * 0.2;
      c.save();
      c.translate(x, y);
      c.rotate((h32(id * 11 + k * 3) - 0.5) * 0.9);
      fragment(c, id, size, id === lit());
      c.restore();
      if (id === lit()) {
        art.glow(c, x, y, size * 0.95, P.goldBright, 0.55);
        c.save();
        c.strokeStyle = rgba(P.goldBright, 0.9);
        c.lineWidth = 1.6;
        c.beginPath(); c.arc(x, y, size * 0.66, 0, Math.PI * 2); c.stroke();
        c.restore();
      }
    });
  }

  function paintBeam(v) {
    const { ctx: c, w: W, h: H } = v.gfx;
    const w = v.w;
    const g = beamGeom(W, H);
    c.clearRect(0, 0, W, H);
    c.drawImage(beamGround(v), 0, 0, W, H);

    const drop = w.tilt === 'level' ? 0 : (w.tilt === 'left' ? g.tilt : -g.tilt);
    const lx = g.cx - g.arm;
    const ly = g.pivotY + drop;
    const rx = g.cx + g.arm;
    const ry = g.pivotY - drop;

    // the bracket the beam swings from
    c.save();
    c.strokeStyle = P.tar;
    c.lineWidth = 5;
    c.beginPath(); c.moveTo(g.cx, 16); c.lineTo(g.cx, g.pivotY); c.stroke();
    c.strokeStyle = P.oakLight;
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(g.cx, 16); c.lineTo(g.cx, g.pivotY); c.stroke();
    c.restore();

    // the beam: tar under-cut, oak body, gold ferrules, lit arris
    c.save();
    c.lineCap = 'round';
    c.strokeStyle = P.tar;
    c.lineWidth = 7;
    c.beginPath(); c.moveTo(lx, ly + 1.6); c.lineTo(rx, ry + 1.6); c.stroke();
    const bg = c.createLinearGradient(lx, ly, rx, ry);
    bg.addColorStop(0, P.oakLight);
    bg.addColorStop(0.5, P.gold);
    bg.addColorStop(1, P.oakLight);
    c.strokeStyle = bg;
    c.lineWidth = 5;
    c.beginPath(); c.moveTo(lx, ly); c.lineTo(rx, ry); c.stroke();
    c.strokeStyle = rgba(P.goldBright, 0.55);
    c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(lx, ly - 1.5); c.lineTo(rx, ry - 1.5); c.stroke();
    c.restore();
    art.ornament(c, 'nailhead', g.cx, g.pivotY, 11);
    art.ornament(c, 'nailhead', lx, ly, 7);
    art.ornament(c, 'nailhead', rx, ry, 7);

    // chains and pans — the pans hang straight down, however the beam lies
    const pan = (px, py, ids, side) => {
      chainLink(c, px, py + 3, py + g.chain, side + v.k * 3);
      const by = py + g.chain;
      const hot = ids.indexOf(lit()) >= 0;
      goldPan(c, P, px, by, g.panR, g.panR * 0.66, hot);
      // the silver rides IN the bowl: clipped to it, so nothing floats free
      c.save();
      c.beginPath();
      c.rect(px - g.panR - 4, by - g.frag * 1.1, g.panR * 2 + 8, g.frag * 1.1 + g.panR * 0.7);
      c.clip();
      heap(c, ids, px, by + g.frag * 0.06, g.frag, g.panR * 1.2);
      c.restore();
    };
    pan(lx, ly, w.left, 0);
    pan(rx, ry, w.right, 1);

    // the withheld pieces, resting on the shelf: level beams are evidence too
    heap(c, asideOf(v.k), g.cx, g.ledgeY, g.frag * 0.94, Math.min(W - 60, 118));

    if (shaking) {
      c.save();
      c.strokeStyle = rgba(P.ember, 0.85);
      c.lineWidth = 2;
      c.strokeRect(6.5, 6.5, W - 13, H - 13);
      c.restore();
    }
  }

  // ---- painting: the counting cloth ---------------------------------------
  function paintCloth() {
    const { ctx: c, w: W, h: H } = cloth;
    c.clearRect(0, 0, W, H);
    art.paintWood(c, W, H, 5210);
    const inset = 11;
    art.tray(c, inset + 12, inset + 10, W - (inset + 12) * 2, H - inset * 2 - 34, {
      band: 13, seed: 'court8', chipAlpha: 0.8, ribbon: true,
    });
    // the dark wool cloth in the recess: warp, weft, nap, and a worn fold
    const cx0 = inset + 12;
    const cy0 = inset + 10;
    const cw = W - cx0 * 2;
    const chh = H - inset * 2 - 34;
    c.save();
    c.beginPath();
    c.rect(cx0, cy0, cw, chh);
    c.clip();
    const base = c.createLinearGradient(cx0, cy0, cx0 + cw * 0.3, cy0 + chh);
    base.addColorStop(0, '#191309');
    base.addColorStop(0.55, '#120e08');
    base.addColorStop(1, '#0a0806');
    c.fillStyle = base;
    c.fillRect(cx0, cy0, cw, chh);
    // undyed wool: the weft slubs, so the run of each thread is uneven
    c.lineWidth = 1;
    for (let y = cy0; y < cy0 + chh; y += 3) {
      const n = h32(Math.round(y) * 7);
      c.strokeStyle = rgba('#3b2f22', 0.16 + n * 0.2);
      c.beginPath();
      c.moveTo(cx0, y + 0.5);
      for (let x = cx0; x <= cx0 + cw; x += 26) {
        c.lineTo(x, y + 0.5 + Math.sin(x * 0.05 + y) * 0.9 + (h32(x + y) - 0.5) * 0.8);
      }
      c.stroke();
    }
    for (let x = cx0; x < cx0 + cw; x += 4) {
      c.strokeStyle = rgba('#050403', 0.24 + h32(Math.round(x) * 3) * 0.24);
      c.beginPath(); c.moveTo(x + 0.5, cy0); c.lineTo(x + 0.5 + Math.sin(x * 0.07) * 1.4, cy0 + chh); c.stroke();
    }
    // nap: a soft sheen along the fold the cloth has been kept in
    const fold = c.createLinearGradient(cx0, cy0 + chh * 0.3, cx0, cy0 + chh * 0.66);
    fold.addColorStop(0, rgba('#4a3b2a', 0));
    fold.addColorStop(0.5, rgba('#4a3b2a', 0.26));
    fold.addColorStop(1, rgba('#4a3b2a', 0));
    c.fillStyle = fold;
    c.fillRect(cx0, cy0, cw, chh);
    // the cloth is worn thin at the edges where hands have dragged it
    const worn = c.createRadialGradient(cx0 + cw / 2, cy0 + chh / 2, Math.min(cw, chh) * 0.18,
      cx0 + cw / 2, cy0 + chh / 2, Math.max(cw, chh) * 0.62);
    worn.addColorStop(0, rgba('#000000', 0));
    worn.addColorStop(1, rgba('#000000', 0.5));
    c.fillStyle = worn;
    c.fillRect(cx0, cy0, cw, chh);
    c.restore();
    c.save();
    c.strokeStyle = rgba(P.tar, 0.9);
    c.lineWidth = 1.4;
    c.strokeRect(cx0 + 0.5, cy0 + 0.5, cw - 1, chh - 1);
    c.restore();

    // the merchant's tally along the plinth: a notched stick and its reckoning
    const ty = H - 24;
    c.save();
    c.strokeStyle = rgba(P.tar, 0.85);
    c.lineWidth = 6;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(30, ty + 1.4); c.lineTo(W - 30, ty + 1.4); c.stroke();
    const st = c.createLinearGradient(30, ty - 3, W - 30, ty + 3);
    st.addColorStop(0, P.oakLight);
    st.addColorStop(0.5, mixHex(P.oakLight, P.gold, 0.28));
    st.addColorStop(1, P.oak);
    c.strokeStyle = st;
    c.lineWidth = 4.4;
    c.beginPath(); c.moveTo(30, ty); c.lineTo(W - 30, ty); c.stroke();
    c.restore();
    c.save();  // the notches: a merchant's count, five-barred
    c.lineCap = 'butt';
    for (let i = 0; i < 26; i++) {
      const x = 40 + i * ((W - 80) / 26);
      const tall = i % 5 === 4;
      c.strokeStyle = rgba(P.tar, 0.8);
      c.lineWidth = tall ? 1.6 : 1.1;
      c.beginPath();
      c.moveTo(x, ty - (tall ? 5 : 3)); c.lineTo(x + (tall ? 3 : 0), ty + (tall ? 5 : 3));
      c.stroke();
      c.strokeStyle = rgba(P.goldBright, 0.2);
      c.beginPath();
      c.moveTo(x + 1, ty - (tall ? 5 : 3)); c.lineTo(x + 1 + (tall ? 3 : 0), ty + (tall ? 5 : 3));
      c.stroke();
    }
    c.restore();
    art.carveText(c, T('tally').toUpperCase(), W / 2, H - 6, 8.5,
      { color: P.boneDim, depth: 0.4, align: 'center', letterSpacing: 2 });
    // two scratch-weights hold the cloth down at the head of the table
    for (const [wx, wy, wr] of [[18, 20, 8], [W - 18, H - 52, 7]]) {
      c.save();
      c.fillStyle = rgba(P.tar, 0.55);
      c.beginPath(); c.ellipse(wx + 1.5, wy + 3, wr, wr * 0.5, 0, 0, Math.PI * 2); c.fill();
      const wg = c.createRadialGradient(wx - wr * 0.3, wy - wr * 0.4, 0, wx, wy, wr * 1.2);
      wg.addColorStop(0, rgba(P.boneDim, 0.75));
      wg.addColorStop(1, rgba(P.tar, 0.95));
      c.fillStyle = wg;
      c.beginPath(); c.arc(wx, wy, wr, 0, Math.PI * 2); c.fill();
      c.strokeStyle = rgba(P.tar, 0.9);
      c.lineWidth = 1;
      c.stroke();
      c.strokeStyle = rgba(P.tar, 0.65);
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(wx - wr * 0.5 + i * wr * 0.45, wy - wr * 0.42);
        c.lineTo(wx - wr * 0.5 + i * wr * 0.45, wy + wr * 0.42);
        c.stroke();
      }
      c.restore();
    }
    art.wear(c, W, H, 'court8', { avoid: { x: cx0 - 6, y: cy0 - 6, w: cw + 12, h: chh + 12 } });
  }

  // ---- painting: one piece on the cloth -----------------------------------
  function paintPiece(v) {
    const { ctx: c, w: W, h: H } = v.gfx;
    const named = v.i === piece;
    const glow = v.i === lit();
    c.clearRect(0, 0, W, H);
    const s = Math.min(W, H * 1.18) * 0.68;
    if (glow) art.glow(c, W / 2, H * 0.4, s * 0.9, P.goldBright, named ? 0.7 : 0.5);
    c.save();
    c.translate(W / 2, H * 0.4);
    c.rotate((h32(v.i * 23 + 7) - 0.5) * 0.7);
    fragment(c, v.i, s, glow);
    c.restore();
    // the mark the thing-man scratched beside it on the cloth
    art.drawRune(c, v.ch, W / 2 - H * 0.09, H - H * 0.24, H * 0.19,
      { color: named ? P.goldBright : glow ? P.bone : P.boneDim });
    if (named) {
      c.save();
      c.strokeStyle = rgba(P.goldBright, 0.85);
      c.lineWidth = 1.4;
      if (typeof c.setLineDash === 'function') c.setLineDash([4, 3]);
      c.strokeRect(2.5, 2.5, W - 5, H - 5);
      c.restore();
    }
  }

  // ---- painting: a verdict pan --------------------------------------------
  // The chosen side takes the weight: its end of the beam goes down and its
  // pan hangs lower. Rail and pans share these numbers so they stay one object.
  const CHAIN_TOP = 12;
  const beamTilt = (val) => (heavier === null ? 0 : heavier === val ? 8 : -8);

  function paintScale(v) {
    const { ctx: c, w: W, h: H } = v.gfx;
    const chosen = heavier === v.val;
    const seated = chosen && piece >= 0;
    c.clearRect(0, 0, W, H);
    const cx = W / 2;
    const y0 = CHAIN_TOP + beamTilt(v.val);
    chainLink(c, cx, y0, y0 + 15, v.val ? 2 : 5);
    const by = y0 + 15;
    const panR = W * 0.36;
    goldPan(c, P, cx, by, panR, panR * 0.72, chosen);
    if (chosen) art.glow(c, cx, by + 3, panR * 1.15, P.goldBright, 0.5);
    if (piece >= 0) {
      // before the oath, the piece hovers over both pans; once a side is
      // called it settles into that one — the staging, seen before it is sworn
      c.save();
      c.beginPath();
      c.rect(cx - panR - 4, by - W * 0.3, panR * 2 + 8, W * 0.3 + panR * 0.75);
      c.clip();
      c.globalAlpha = seated ? 1 : 0.32;
      c.translate(cx, by + (seated ? W * 0.06 : -W * 0.03));
      fragment(c, piece, W * 0.36, seated);
      c.restore();
    }
  }

  /** the court's own beam: one carved balance, both verdict pans hanging off it */
  function paintRail() {
    const { ctx: c, w: W, h: H } = rail;
    c.clearRect(0, 0, W, H);
    const box = scales.getBoundingClientRect();
    const ends = scaleViews.map((v) => {
      const r = v.holder.getBoundingClientRect();
      return {
        x: box.width ? (r.left - box.left) + r.width / 2 : W / 2,
        y: (box.height ? r.top - box.top : 0) + CHAIN_TOP + beamTilt(v.val),
      };
    });
    if (ends.length !== 2) return;
    const cx = (ends[0].x + ends[1].x) / 2;
    const pivotY = (ends[0].y + ends[1].y) / 2;
    const ly = ends[0].y;
    const ry = ends[1].y;
    // the bench the court's balance stands on — the verdict is furniture too
    const panBottom = scaleViews.reduce((acc, v) => {
      const r = v.holder.getBoundingClientRect();
      return Math.max(acc, (box.height ? r.top - box.top : 0) + r.height);
    }, 0) || H - 30;
    art.paintWood(c, W, H, 6120);
    // the tray closes ABOVE the two labels, so its lower rail never crosses them
    art.tray(c, 22, 6, W - 44, Math.max(40, panBottom - 2), {
      band: 12, seed: 'verdict8', chipAlpha: 0.75, rosettes: true,
    });
    art.wear(c, W, H, 'verdict8', {
      avoid: { x: cx - 150, y: 0, w: 300, h: panBottom + 16 },
    });
    // the standing post and its footed plinth, cut from the same oak
    const footY = panBottom + 4;
    c.save();
    c.strokeStyle = rgba(P.tar, 0.92);
    c.lineWidth = 7;
    c.beginPath(); c.moveTo(cx, pivotY); c.lineTo(cx, footY); c.stroke();
    c.strokeStyle = P.oakLight;
    c.lineWidth = 4.2;
    c.beginPath(); c.moveTo(cx, pivotY); c.lineTo(cx, footY - 1); c.stroke();
    c.strokeStyle = rgba(P.tar, 0.9);
    c.lineWidth = 5;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx - 24, footY); c.lineTo(cx + 24, footY); c.stroke();
    c.strokeStyle = rgba(P.oakLight, 0.85);
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(cx - 24, footY - 1.4); c.lineTo(cx + 24, footY - 1.4); c.stroke();
    c.restore();
    art.rosette(c, cx, footY - 16, 6.5);
    // the beam
    c.save();
    c.lineCap = 'round';
    c.strokeStyle = P.tar;
    c.lineWidth = 7;
    c.beginPath(); c.moveTo(ends[0].x, ly + 1.6); c.lineTo(ends[1].x, ry + 1.6); c.stroke();
    const bg = c.createLinearGradient(ends[0].x, ly, ends[1].x, ry);
    bg.addColorStop(0, P.oakLight);
    bg.addColorStop(0.5, P.gold);
    bg.addColorStop(1, P.oakLight);
    c.strokeStyle = bg;
    c.lineWidth = 5;
    c.beginPath(); c.moveTo(ends[0].x, ly); c.lineTo(ends[1].x, ry); c.stroke();
    c.strokeStyle = rgba(P.goldBright, 0.55);
    c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(ends[0].x, ly - 1.5); c.lineTo(ends[1].x, ry - 1.5); c.stroke();
    c.restore();
    art.ornament(c, 'nailhead', cx, pivotY, 11);
    art.ornament(c, 'nailhead', ends[0].x, ly, 7);
    art.ornament(c, 'nailhead', ends[1].x, ry, 7);
  }

  // ---- the reading strip --------------------------------------------------
  function paintRead() {
    const i = lit();
    read.textContent = '';
    if (i < 0) { read.textContent = ''; return; }
    const line = T('reading', {
      cut: cutOf(i), w1: placeWord(0, i), w2: placeWord(1, i), w3: placeWord(2, i),
    });
    const strong = document.createElement('b');
    strong.textContent = line;
    read.append(strong);
  }

  // ---- render -------------------------------------------------------------
  function render() {
    for (const v of pieceViews) {
      const named = v.i === piece;
      v.btn.setAttribute('aria-checked', named ? 'true' : 'false');
      v.btn.setAttribute('aria-label', T('ariaPiece', { cut: cutOf(v.i), rune: runeName(v.ch) })
        + (named ? T('ariaPicked') : ''));
      const key = `${v.gfx.w}|${named}|${v.i === lit()}`;
      if (key !== v.key) { v.key = key; paintPiece(v); }
    }
    for (const v of beamViews) {
      const key = `${v.gfx.w}|${lit()}|${shaking}`;
      if (key !== v.key) { v.key = key; paintBeam(v); }
    }
    for (const v of scaleViews) {
      // no aria-label here: the visible label IS the accessible name, and the
      // e2e driver names these two buttons exactly (tests/e2e/helpers.mjs)
      v.btn.setAttribute('aria-pressed', heavier === v.val ? 'true' : 'false');
      const key = `${v.gfx.w}|${heavier}|${piece}`;
      if (key !== v.key2) { v.key2 = key; paintScale(v); railKey = ''; }
    }
    if (railKey !== `${rail.w}|${heavier}`) { railKey = `${rail.w}|${heavier}`; paintRail(); }
    paintRead();
    const ready = piece >= 0 && heavier !== null;
    send.disabled = ctx.solved || !ready;
    if (demoLit >= 0) return;                       // the showing owns the line
    stage.textContent = ctx.solved ? T('solvedLine')
      : ready ? T('stagingReady', { cut: cutOf(piece), dir: T(heavier ? 'dirHeavy' : 'dirLight') })
        : piece >= 0 ? T('stagingPiece', { cut: cutOf(piece) })
          : '';
  }

  // ---- layout -------------------------------------------------------------
  function relayout() {
    const avail = Math.max(240, Math.round(wrap.clientWidth || 320));
    narrow = avail < 560;
    for (const v of beamViews) {
      const bw = Math.max(200, Math.round(v.host.clientWidth || avail));
      fitCanvas(v.host, v.gfx, bw, narrow ? 150 : 192, true);
      v.key = '';
    }
    // the grid owns the cell width; read it back rather than guessing at it
    const cell = Math.max(46, Math.round(pieceViews[0].btn.clientWidth || 62));
    for (const v of pieceViews) {
      fitCanvas(v.btn, v.gfx, cell, Math.round(cell * 1.08), true);
      v.key = '';
    }
    for (const v of scaleViews) {
      fitCanvas(v.holder, v.gfx, narrow ? 100 : 116, narrow ? 84 : 92);
      v.key2 = '';
    }
    fitCanvas(railHost, rail, Math.max(200, Math.round(scales.clientWidth || avail)),
      Math.max(80, Math.round(scales.clientHeight || 110)), 'fill');
    railKey = '';
    // the cloth is out of flow, so the grid has already settled its height
    const cw = Math.max(220, Math.round(court.clientWidth || avail));
    const ch = Math.max(120, Math.round(court.clientHeight || 200));
    fitCanvas(clothHost, cloth, cw, ch, 'fill');
    paintCloth();
    render();
  }

  let resizeRaf = 0;
  const onResize = () => {
    if (resizeRaf) return;
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 32);
    resizeRaf = raf(() => { resizeRaf = 0; relayout(); });
  };
  on(window, 'resize', onResize);

  // ---- moves --------------------------------------------------------------
  function pick(i, quiet) {
    if (ctx.solved) return;
    piece = i;
    tell.textContent = '';
    for (const v of pieceViews) v.btn.setAttribute('tabindex', v.i === i ? '0' : '-1');
    if (!quiet) {
      sfx('knock');
      say(T('pickNote', { cut: cutOf(i) }));
    }
    render();
  }

  function callDirection(val) {
    if (ctx.solved) return;
    heavier = val;
    tell.textContent = '';
    sfx('flip');
    say(T('dirNote', { dir: T(val ? 'callHeavy' : 'callLight') }));
    render();
  }

  pieceViews.forEach((v) => {
    on(v.btn, 'click', () => { endShowing(); pick(v.i); });
    on(v.btn, 'pointerenter', () => { if (demoLit < 0) { hover = v.i; render(); } });
    on(v.btn, 'pointerleave', () => { if (hover === v.i) { hover = -1; render(); } });
    on(v.btn, 'focus', () => { if (demoLit < 0) { hover = v.i; render(); } });
    on(v.btn, 'blur', () => { if (hover === v.i) { hover = -1; render(); } });
    on(v.btn, 'keydown', (e) => {
      let next = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (v.i + 1) % N;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (v.i + N - 1) % N;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = N - 1;
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); endShowing(); pick(v.i); return; }
      else return;
      e.preventDefault();
      endShowing();
      pieceViews[next].btn.setAttribute('tabindex', '0');
      v.btn.setAttribute('tabindex', '-1');
      pieceViews[next].btn.focus();
    });
  });

  scaleViews.forEach((v) => {
    on(v.btn, 'click', () => { endShowing(); callDirection(v.val); });
  });

  on(wrap, 'keydown', (e) => {
    if (e.key === 'h' || e.key === 'H') { endShowing(); callDirection(true); e.preventDefault(); }
    else if (e.key === 'l' || e.key === 'L') { endShowing(); callDirection(false); e.preventDefault(); }
  });

  // ---- the showing: three seconds of a ghost hand over the cloth ----------
  function paintGhost() {
    if (!ghost.ctx) return;
    const c = ghost.ctx;
    const { w, h } = ghost;
    c.clearRect(0, 0, w, h);
    c.save();
    c.globalAlpha = 0.9;
    c.fillStyle = rgba(P.goldBright, 0.24);
    c.fillRect(2, 2, w - 4, h - 4);
    c.strokeStyle = P.goldBright;
    c.lineWidth = 2;
    if (typeof c.setLineDash === 'function') c.setLineDash([5, 4]);
    c.strokeRect(3, 3, w - 6, h - 6);
    if (typeof c.setLineDash === 'function') c.setLineDash([]);
    art.glow(c, w / 2, h / 2, w * 0.62, P.goldBright, 0.4);
    c.restore();
  }

  function endShowing(quiet) {
    if (ghostHost.style.display === 'none') return;
    ghostHost.style.display = 'none';
    skipBtn.style.display = 'none';
    demoLit = -1;
    if (!quiet) stage.textContent = '';
    render();
  }

  function showTheWay() {
    if (ctx.solved) return;
    const target = pieceViews[demoPiece];
    if (!target || !target.btn.getBoundingClientRect) return;
    const a = target.btn.getBoundingClientRect();
    const box = court.getBoundingClientRect();
    if (!a.width || !box.width) return;
    fitCanvas(ghostHost, ghost, Math.round(a.width), Math.round(a.height));
    paintGhost();
    ghostHost.style.display = 'block';
    ghostHost.style.transform = `translate(${Math.round(a.left - box.left)}px,${Math.round(a.top - box.top)}px)`;
    skipBtn.style.display = '';
    demoLit = demoPiece;
    render();
    later(() => endShowing(), 3000);
  }

  on(skipBtn, 'click', () => { endShowing(); send.focus(); });

  // ---- submit -------------------------------------------------------------
  on(send, 'click', () => {
    if (piece < 0 || heavier === null) return;
    const res = ctx.submit({ piece, heavier }) || {};
    if (res.ok) return;
    const near = res.near ? (NEARMAP[res.near] || res.near) : T('wrong');
    tell.textContent = near;
    if (tell.scrollIntoView) tell.scrollIntoView({ block: 'nearest' });
    if (calm) return;
    shaking = true;
    for (const v of beamViews) v.host.dataset.shake = '1';
    render();
    later(() => {
      shaking = false;
      for (const v of beamViews) v.host.dataset.shake = '0';
      render();
    }, 520);
  });

  // ---- open the lock ------------------------------------------------------
  relayout();
  say(T('openLine'));
  instance.weighings.forEach((w, k) => {
    say(T('openWeighing', {
      n: k + 1,
      left: w.left.map(cutOf).join(' + '),
      right: w.right.map(cutOf).join(' + '),
      tilt: tiltWord(w.tilt),
      aside: asideOf(k).map(cutOf).join(' + '),
    }));
  });
  if (ctx.solved) {
    send.disabled = true;
    send.textContent = T('sworn');
    render();
  } else {
    later(() => showTheWay(), 0);
  }

  return {
    unmount() {
      for (const off of cleanup) off();
      cleanup.length = 0;
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
      if (resizeRaf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(resizeRaf);
      resizeRaf = 0;
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    },
  };
}

// ---------------------------------------------------------------------- i18n
// Additive per-lock block (docs/CONTRACT.md §4.1 amendment). English lives in
// the frozen fields above; `nearMap` keys are the canonical English near-lines
// verify() returns, which for this lock are the three disagreement counts.
const I18N = {
  es: {
    title: 'Las Doce Piezas',
    epigraph: 'Doce piezas cortadas, una es falsa —\nnadie juró pesada, nadie ligera.\nLos platillos recuerdan cada mentira.',
    hints: [
      'Veinticuatro acusaciones caben: doce piezas, cada una falsa en dos sentidos. Tres pesadas pueden partir veintisiete.',
      'Una pieza retirada de una pesada no puede inclinarla. Lee cada balanza nivelada como prueba dura, no como silencio.',
      'Toma una pesada cada vez y tacha toda acusación que la contradiga. Lo que sobreviva a las tres es el único juramento que puedes hacer.',
    ],
    nearMap: {
      'Your naming disagrees with 1 of the three sworn weighings.': 'Tu acusación contradice 1 de las tres pesadas juradas.',
      'Your naming disagrees with 2 of the three sworn weighings.': 'Tu acusación contradice 2 de las tres pesadas juradas.',
      'Your naming disagrees with 3 of the three sworn weighings.': 'Tu acusación contradice las 3 pesadas juradas.',
    },
    board: {
      ords: ['Primera', 'Segunda', 'Tercera'],
      weighing: '{ord} pesada',
      tiltLeft: 'bajó el platillo izquierdo',
      tiltRight: 'bajó el platillo derecho',
      tiltLevel: 'la balanza quedó nivelada',
      aside: 'apartadas',
      courtHead: 'Las doce piezas, tendidas sobre el paño',
      heavy: 'de más — salada',
      light: 'de menos — cercenada',
      swear: 'Jurar la acusación',
      sworn: 'La acusación se sostiene',
      solvedLine: 'La pieza falsa queda nombrada, y la balanza sostiene el juramento.',
      stagingPiece: 'Tienes en la mano {cut}. Asiéntala en un platillo — de más, o de menos.',
      stagingReady: 'Vas a jurar: {cut} — {dir}.',
      dirHeavy: 'la pieza está salada y pesa de más',
      dirLight: 'la pieza está cercenada y pesa de menos',
      callHeavy: 'de más',
      callLight: 'de menos',
      reading: '{cut} — primera: {w1}; segunda: {w2}; tercera: {w3}.',
      leftPan: 'platillo izquierdo',
      rightPan: 'platillo derecho',
      withheld: 'apartada',
      tally: 'cuenta',
      skip: 'Saltar la muestra',
      ariaPieces: 'Las doce piezas sobre el paño de contar',
      ariaPiece: '{cut}, con la marca {rune}',
      ariaPicked: ' — pieza nombrada',
      ariaTableau: '{ord} pesada. Platillo izquierdo: {left}. Platillo derecho: {right}. Apartadas: {aside}. Jurado: {tilt}.',
      ariaPan: 'Asentar la pieza en el platillo {dir}',
      wrong: 'La balanza no sostiene ese juramento.',
      openLine: 'Doce piezas cortadas; una es falsa, de más o de menos, y nadie juró cuál.',
      openWeighing: 'Pesada {n}: {left} contra {right} — {tilt}. Apartadas: {aside}.',
      pickNote: 'La acusación recae sobre {cut}.',
      dirNote: 'La falta se llama {dir}.',
      cuts: [
        'el corte de brazalete', 'la lengüeta de fíbula', 'el cabo de lingote', 'el torzal de collar',
        'la moneda partida', 'el alfiler de fíbula', 'el trozo de varilla', 'la viruta de barra',
        'el fragmento trenzado', 'el remate de bola', 'el rollo de alambre', 'la chapa de correa',
      ],
    },
  },
  ca: {
    title: 'Les Dotze Peces',
    epigraph: 'Dotze peces tallades, una és falsa —\nningú no va jurar feixuga, ningú lleugera.\nEls platets recorden cada mentida.',
    hints: [
      'Hi caben vint-i-quatre acusacions: dotze peces, cadascuna falsa en dos sentits. Tres pesades en poden partir vint-i-set.',
      'Una peça retirada d’una pesada no la pot decantar. Llegeix cada balança anivellada com a prova dura, no com a silenci.',
      'Pren una pesada cada cop i ratlla tota acusació que la contradigui. El que sobrevisqui a les tres és l’únic jurament que pots fer.',
    ],
    nearMap: {
      'Your naming disagrees with 1 of the three sworn weighings.': 'La teva acusació contradiu 1 de les tres pesades jurades.',
      'Your naming disagrees with 2 of the three sworn weighings.': 'La teva acusació contradiu 2 de les tres pesades jurades.',
      'Your naming disagrees with 3 of the three sworn weighings.': 'La teva acusació contradiu les 3 pesades jurades.',
    },
    board: {
      ords: ['Primera', 'Segona', 'Tercera'],
      weighing: '{ord} pesada',
      tiltLeft: 'va baixar el platet esquerre',
      tiltRight: 'va baixar el platet dret',
      tiltLevel: 'la balança va quedar anivellada',
      aside: 'apartades',
      courtHead: 'Les dotze peces, esteses damunt el drap',
      heavy: 'de més — salada',
      light: 'de menys — escapçada',
      swear: 'Jurar l’acusació',
      sworn: 'L’acusació s’aguanta',
      solvedLine: 'La peça falsa queda anomenada, i la balança aguanta el jurament.',
      stagingPiece: 'Tens a la mà {cut}. Asseu-la en un platet — de més, o de menys.',
      stagingReady: 'Juraràs: {cut} — {dir}.',
      dirHeavy: 'la peça és salada i pesa de més',
      dirLight: 'la peça és escapçada i pesa de menys',
      callHeavy: 'de més',
      callLight: 'de menys',
      reading: '{cut} — primera: {w1}; segona: {w2}; tercera: {w3}.',
      leftPan: 'platet esquerre',
      rightPan: 'platet dret',
      withheld: 'apartada',
      tally: 'compte',
      skip: 'Saltar la mostra',
      ariaPieces: 'Les dotze peces damunt el drap de comptar',
      ariaPiece: '{cut}, amb la marca {rune}',
      ariaPicked: ' — peça anomenada',
      ariaTableau: '{ord} pesada. Platet esquerre: {left}. Platet dret: {right}. Apartades: {aside}. Jurat: {tilt}.',
      ariaPan: 'Asseure la peça al platet {dir}',
      wrong: 'La balança no aguanta aquest jurament.',
      openLine: 'Dotze peces tallades; una és falsa, de més o de menys, i ningú no va jurar quina.',
      openWeighing: 'Pesada {n}: {left} contra {right} — {tilt}. Apartades: {aside}.',
      pickNote: 'L’acusació recau sobre {cut}.',
      dirNote: 'La falta s’anomena {dir}.',
      cuts: [
        'el tall de braçalet', 'la llengüeta de fíbula', 'el cap de lingot', 'el torçal de collar',
        'la moneda partida', 'l’agulla de fíbula', 'el tros de vareta', 'l’encenall de barra',
        'el fragment trenat', 'el remat de bola', 'el rotlle de filferro', 'la xapa de corretja',
      ],
    },
  },
};

export default {
  id: ID,
  ordinal: 8,
  tier: 3,
  title: 'The Twelve Pieces',
  epigraph: 'Twelve cut pieces, one cut false —\nnone swore heavy, none swore light.\nThe pans remember every lie.',

  makePuzzle,
  solve,
  verify,
  wrongAnswers,
  shard: () => ({ ...SHARDS[ID] }),

  difficulty: { searchSpace: 24, minSteps: 21, estMinutes: 13 },

  hints: [
    'Twenty-four namings are possible — twelve pieces, each false in two directions. Three weighings can part twenty-seven.',
    'A piece withheld from a weighing cannot tilt it. Read each level beam as hard evidence, not as silence.',
    'Take one weighing at a time and strike out every naming it contradicts. What survives all three is the only oath you can swear.',
  ],

  i18n: I18N,

  mount,
};
