// 09 — THE SUNSTONE BEARING
//
// Overcast sea. The sólarsteinn does not show the sun; it shows the band of
// polarised light that stands a quarter-ring away from it. On a 64-point ring a
// reading r therefore admits TWO bearings, r+16 and r-16 — and those two are
// 32 points apart, exactly opposite each other on the ring.
//
// CONTRACT NOTE (recorded, not widened). Because the two candidates of a single
// reading are always antipodal, two readings either admit the same pair or no
// bearing at all: no set of readings alone can ever single out one azimuth, so
// docs/LOCKS.md §09's "exactly one azimuth is consistent with two uncorrupted
// readings" is unreachable as literally written. The minimal repair lives in
// instance generation (explicitly worker latitude) and is the historical one:
// the ship also keeps a day-mark, the half of the ring the sun stands in at
// this watch. One member of every antipodal pair falls inside that half, so a
// bearing is again nameable. Answer shape, the +/-16 rule, the sweep and the
// floors are all untouched.
//
// Three stones were read. One was read through a wet stone and is corrupt —
// arbitrary, worth nothing. Name the sun's bearing and the ruined reading.
// The generator sweeps all 64 bearings x 3 wet-indices and demands exactly one
// consistent pair.
//
// Answer: { azimuth: 0..63, wet: 0..2 }.

import { SHARDS } from '../kernel/shards.js';

const ID = '09-sunstone';
const RING = 64;
const QUARTER = 16;
const ARC = 32;

const AIRTS = Object.freeze([
  'north', 'north by east', 'north-north-east', 'north-east by north',
  'north-east', 'north-east by east', 'east-north-east', 'east by north',
  'east', 'east by south', 'east-south-east', 'south-east by east',
  'south-east', 'south-east by south', 'south-south-east', 'south by east',
  'south', 'south by west', 'south-south-west', 'south-west by south',
  'south-west', 'south-west by west', 'west-south-west', 'west by south',
  'west', 'west by north', 'west-north-west', 'north-west by west',
  'north-west', 'north-west by north', 'north-north-west', 'north by west',
]);

const STONES = Object.freeze(['the fore stone', 'the mast stone', 'the steer stone']);

const mod = (n) => ((n % RING) + RING) % RING;

/** the two bearings a reading admits — always antipodal */
export function candidates(reading) {
  return [mod(reading + QUARTER), mod(reading - QUARTER)];
}

function inArc(azimuth, arcStart) {
  return mod(azimuth - arcStart) < ARC;
}

/** the single candidate of this reading that falls inside the day-mark */
function arcCandidate(reading, arcStart) {
  const [a, b] = candidates(reading);
  return inArc(a, arcStart) ? a : b;
}

/** the point-name of a 64-point bearing, e.g. "east-north-east, a half east" */
export function airt(azimuth) {
  const base = AIRTS[Math.floor(azimuth / 2) % 32];
  return azimuth % 2 ? `${base}, half a point east` : base;
}

// ---- pure logic ------------------------------------------------------------

function isConsistent(instance, azimuth, wet) {
  if (!inArc(azimuth, instance.arcStart)) return false;
  for (let i = 0; i < instance.readings.length; i++) {
    if (i === wet) continue;
    const [a, b] = candidates(instance.readings[i]);
    if (azimuth !== a && azimuth !== b) return false;
  }
  return true;
}

/** full 64 x 3 sweep — the uniqueness guarantee */
function solutions(instance) {
  const found = [];
  for (let azimuth = 0; azimuth < RING; azimuth++) {
    for (let wet = 0; wet < instance.readings.length; wet++) {
      if (isConsistent(instance, azimuth, wet)) found.push({ azimuth, wet });
    }
  }
  return found;
}

function build(rng) {
  const arcStart = rng.int(RING);
  const azimuth = mod(arcStart + rng.int(ARC));
  const wet = rng.int(3);
  const readings = [];
  for (let i = 0; i < 3; i++) {
    if (i === wet) readings.push(0);
    else readings.push(mod(azimuth + (rng.chance(0.5) ? QUARTER : -QUARTER)));
  }
  // the ruined stone must point somewhere else inside the day-mark
  let ruined = rng.int(RING);
  for (let g = 0; g < RING; g++) {
    if (arcCandidate(ruined, arcStart) !== azimuth) break;
    ruined = mod(ruined + 1);
  }
  readings[wet] = ruined;
  return { readings, arcStart, arcSpan: ARC, stones: STONES.slice(), ring: RING, quarter: QUARTER };
}

function makePuzzle(rng) {
  let instance = build(rng);
  for (let i = 0; i < 200 && solutions(instance).length !== 1; i++) instance = build(rng);
  return instance;
}

function solve(instance) {
  const found = solutions(instance);
  return found[0] || { azimuth: 0, wet: 0 };
}

function verify(instance, answer) {
  if (!instance || !Array.isArray(instance.readings)) return { ok: false };
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
  const { azimuth, wet } = answer;
  if (!Number.isInteger(azimuth) || azimuth < 0 || azimuth >= RING) return { ok: false };
  if (!Number.isInteger(wet) || wet < 0 || wet >= instance.readings.length) return { ok: false };
  if (isConsistent(instance, azimuth, wet)) return { ok: true };
  if (!inArc(azimuth, instance.arcStart)) {
    return { ok: false, near: 'That bearing lies outside the day-mark. The sun is not behind you.' };
  }
  let admit = 0;
  for (const r of instance.readings) {
    const [a, b] = candidates(r);
    if (azimuth === a || azimuth === b) admit++;
  }
  return { ok: false, near: `Only ${admit} of the three stones admit that bearing.` };
}

function wrongAnswers(instance) {
  const truth = solve(instance);
  const out = [];
  const push = (azimuth, wet) => {
    if (azimuth === truth.azimuth && wet === truth.wet) return;
    if (!Number.isInteger(azimuth) || azimuth < 0 || azimuth >= RING) return;
    out.push({ azimuth, wet });
  };
  for (let w = 0; w < instance.readings.length; w++) push(truth.azimuth, w);   // right bearing, wrong stone
  push(mod(truth.azimuth + ARC), truth.wet);                                   // the antipode
  push(mod(truth.azimuth + 1), truth.wet);
  push(mod(truth.azimuth - 1), truth.wet);
  push(mod(truth.azimuth + QUARTER), truth.wet);                               // the reading itself
  for (let i = 0; i < instance.readings.length && out.length < 10; i++) {
    push(arcCandidate(instance.readings[i], instance.arcStart), (truth.wet + 1) % 3);
  }
  for (let d = 2; out.length < 8; d++) push(mod(truth.azimuth + d), truth.wet);
  return out.slice(0, 10);
}

// ---- view ------------------------------------------------------------------
//
// The navigator's station at sea. A scored whalebone rose — real compass-rose
// construction, major airts bold, minors scribed — under a horizon band whose
// painted sky names the half of the ring the sun stands in (the day-mark, THE
// clue, made unmissable). Three sólarsteinn crystals hang on cords from the
// rail above the disc; lifting one to the sky throws its TWO candidate
// azimuths onto the rose as blades of light — the ±16 ambiguity taught by
// seeing both blades. The wet stone's blades flicker wrong. The bearing
// pointer seats point by point with a bone-click detent.
//
// The station is baked once per size and cached; every interaction repaints
// only cords, crystals, blades and the needle (latency law, docs/QUALITY.md).
// rAF runs only while the showing plays or a flickering blade is on screen.

const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";
const MONO = "ui-monospace,'SF Mono',Menlo,monospace";

const angleOf = (az) => (az / RING) * Math.PI * 2 - Math.PI / 2;

// deterministic view-noise: the bone must not re-grain between repaints
function lcg(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Board copy. English is the source; es/ca live in the additive i18n block
// (docs/CONTRACT.md §4.1 amendment) and are resolved through it at mount.
const BOARD_EN = {
  plate: 'Three stones speak, one lies wet. Set the bearing the honest two agree on — within the day-mark’s half.',
  stoneNames: STONES.slice(),
  read: 'read {n}',
  wet: 'wet',
  wetAria: 'call {stone} the wet stone',
  takeAria: 'take bearing {n}, {airt}',
  rowAria: '{stone}, read {n}: the sun lies at {a} or {b}',
  heading: 'Three readings — take a bearing, mark the wet stone',
  submit: 'Swear the bearing',
  bearing: 'Bearing {n} — {airt}',
  outside: ' (outside the day-mark)',
  dayMark: 'Day-mark: point {a} to point {b} — {watch}.',
  watchMorning: 'the morning watch',
  watchEvening: 'the evening watch',
  watchNoon: 'the noon watch',
  watchMidnight: 'the midnight watch',
  lawParts: [
    ['The stone shows the ring of light ', 0],
    ['a quarter of the ring — 16 points — from the sun', 1],
    [', never saying which side: each reading throws ', 0],
    ['two blades opposite each other', 1],
    ['. ', 0],
    ['The day-mark', 1],
    [' — the painted sky on the horizon band, point {a} to point {b} — is the half of the ring the sun stands in this watch; it keeps one blade of each pair. ', 0],
    ['One stone was read wet', 1],
    [' and says nothing true. Name the sun’s bearing, and name the ruined stone.', 0],
  ],
  skip: 'Skip the showing',
  demoSay: 'Watch once: a lifted stone throws its two bearings onto the rose as blades of light.',
  focusSay: '{stone} is held to the sky — its blades stand at {a} and {b}.',
  agree: 'Two cords glint: two stones stand behind point {n}.',
  noteBearing: 'Bearing set to point {n} — {airt}.',
  noteWet: '{stone} is called corrupt.',
  noteWetNone: 'No stone is called corrupt.',
  open1: 'The sunstone shows the polarised band, a quarter-ring from the sun: each reading admits two bearings, opposite one another.',
  open2: 'Day-mark: the sun stands between point {a} and point {b} of the ring.',
  noteStone: '{stone} reads {n} — the sun lies at {a} or {b}.',
  sliderAria: 'sun bearing on the 64-point ring',
  valueText: 'point {n}, {airt}',
  noAnswer: 'The sea does not answer to that bearing.',
  half: ' and a half',
  airts: null, // EN uses AIRTS
};

function pointName(azimuth, L) {
  const names = (Array.isArray(L.airts) && L.airts.length === 32) ? L.airts : AIRTS;
  const base = names[Math.floor(azimuth / 2) % 32];
  return azimuth % 2 ? `${base}${L.half ?? BOARD_EN.half}` : base;
}

function watchKey(arcStart) {
  const c = mod(arcStart + QUARTER); // centre of the day-mark
  if (c === 0) return 'watchMidnight';
  if (c === ARC) return 'watchNoon';
  return c < ARC ? 'watchMorning' : 'watchEvening';
}

// ---- station painters (all deterministic; the bake is cached per size) -----

function paintStation(art, g, LY, instance) {
  const P = art.palette;
  const { W, H, railH, cx, cy, R, crys } = LY;
  const rnd = lcg(793 + instance.arcStart * 131 + instance.readings[0] * 17 + instance.readings[2]);
  art.paintWood(g, W, H, 793, { vignette: 0.34 });

  // ---- sea-worn dead zones on the wood (quiet, subordinate) ----
  // dividers' practice arcs, top-left corner under the rail
  g.save();
  g.strokeStyle = 'rgba(12,9,6,.16)';
  g.lineWidth = 0.9;
  for (let k = 0; k < 3; k++) {
    g.beginPath();
    g.arc(W * 0.06, railH + W * 0.075, W * (0.045 + k * 0.023), -0.4, 1.7);
    g.stroke();
  }
  g.fillStyle = 'rgba(12,9,6,.3)';
  g.beginPath(); g.arc(W * 0.06, railH + W * 0.075, 1.4, 0, Math.PI * 2); g.fill();
  // tally scratches, bottom-left corner
  g.strokeStyle = 'rgba(233,220,195,.1)';
  g.lineWidth = 1.1;
  for (let k = 0; k < 7; k++) {
    const tx = W * 0.035 + k * 5.5 + (k === 4 ? -25 : 0);
    const ty = H - W * 0.055;
    g.beginPath();
    if (k === 4) { g.moveTo(tx, ty + 9); g.lineTo(tx + 26, ty - 8); } else { g.moveTo(tx, ty - 7); g.lineTo(tx + 2, ty + 8); }
    g.stroke();
  }
  g.restore();
  // coiled line, bottom-right corner — two-tone twist read at low contrast
  ropeCoil(g, W - W * 0.085, H - W * 0.083, W * 0.058, rnd);
  // salt rime crusts where spray lands: lower corners + along the bottom edge
  rime(g, W * 0.09, H - W * 0.03, W * 0.1, 26, rnd);
  rime(g, W * 0.86, H - W * 0.026, W * 0.09, 22, rnd);
  rime(g, W * 0.5, H - 6, W * 0.3, 30, rnd);

  // a pale sea-light pool behind the hang zone so the crystals stand off the wood
  for (const c of crys) {
    const pool = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, LY.s * 2.6);
    pool.addColorStop(0, 'rgba(233,220,195,.09)');
    pool.addColorStop(1, 'rgba(233,220,195,0)');
    g.fillStyle = pool;
    g.beginPath(); g.arc(c.x, c.y, LY.s * 2.6, 0, Math.PI * 2); g.fill();
  }

  // ---- the rail the stones hang from ----
  const by = railH * 0.12;
  const bh = railH * 0.34;
  const beam = g.createLinearGradient(0, by, 0, by + bh);
  beam.addColorStop(0, 'rgba(105,70,38,.95)');
  beam.addColorStop(0.5, 'rgba(70,45,23,.96)');
  beam.addColorStop(1, 'rgba(40,25,10,.98)');
  g.fillStyle = beam;
  g.fillRect(0, by, W, bh);
  g.strokeStyle = 'rgba(233,220,195,.16)';
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, by + 1); g.lineTo(W, by + 1); g.stroke();
  g.strokeStyle = 'rgba(12,9,6,.85)';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, by + bh); g.lineTo(W, by + bh); g.stroke();
  // grain streaks + chip-carved wolf-tooth along the beam's lower edge
  g.strokeStyle = 'rgba(12,9,6,.22)';
  g.lineWidth = 0.8;
  for (let k = 0; k < 6; k++) {
    const yy = by + bh * (0.18 + 0.14 * k);
    g.beginPath();
    g.moveTo(0, yy);
    for (let x = 0; x <= W; x += 24) g.lineTo(x, yy + Math.sin(x * 0.04 + k * 2.2) * 0.8);
    g.stroke();
  }
  g.fillStyle = 'rgba(12,9,6,.4)';
  for (let x = 6; x < W - 6; x += 11) {
    g.beginPath();
    g.moveTo(x, by + bh - 1);
    g.lineTo(x + 4, by + bh - 5.5);
    g.lineTo(x + 8, by + bh - 1);
    g.closePath();
    g.fill();
  }
  // iron nails at the beam ends
  for (const nx of [W * 0.045, W * 0.955]) {
    g.fillStyle = 'rgba(12,9,6,.9)';
    g.beginPath(); g.arc(nx, by + bh * 0.5, 2.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(233,220,195,.35)';
    g.beginPath(); g.arc(nx - 0.8, by + bh * 0.5 - 0.8, 0.9, 0, Math.PI * 2); g.fill();
  }
  // cleats where the three cords tie
  for (const c of crys) {
    g.fillStyle = 'rgba(12,9,6,.85)';
    g.beginPath();
    if (typeof g.roundRect === 'function') g.roundRect(c.x - 6, by + bh - 3, 12, 6, 2); else g.rect(c.x - 6, by + bh - 3, 12, 6);
    g.fill();
    g.strokeStyle = 'rgba(201,162,39,.3)';
    g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(c.x - 5, by + bh - 2); g.lineTo(c.x + 5, by + bh - 2); g.stroke();
  }

  // ---- the whalebone disc ----
  // seated shadow first: the disc lies ON the wood
  g.fillStyle = 'rgba(12,9,6,.16)';
  g.beginPath(); g.ellipse(cx + 7, cy + 11, R * 1.045, R * 1.03, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(12,9,6,.34)';
  g.beginPath(); g.ellipse(cx + 4, cy + 6, R * 1.015, R * 1.008, 0, 0, Math.PI * 2); g.fill();

  const bone = g.createRadialGradient(cx - R * 0.28, cy - R * 0.34, R * 0.1, cx, cy, R * 1.02);
  bone.addColorStop(0, '#f3e9d6');
  bone.addColorStop(0.45, P.bone);
  bone.addColorStop(0.8, '#cfc1a2');
  bone.addColorStop(1, '#a4967a');
  g.fillStyle = bone;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();

  // bone grain: long fibrous strands, one direction, gently curved; clipped
  g.save();
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  const dir = -1.18; // strand direction, radians
  for (let k = 0; k < 74; k++) {
    const px = cx + (rnd() - 0.5) * 2 * R;
    const py = cy + (rnd() - 0.5) * 2 * R;
    const len = R * (0.35 + rnd() * 1.0);
    const bow = (rnd() - 0.5) * R * 0.12;
    const dark = rnd() < 0.55;
    g.strokeStyle = dark ? `rgba(122,102,72,${0.05 + rnd() * 0.06})` : `rgba(250,244,228,${0.06 + rnd() * 0.07})`;
    g.lineWidth = 0.6 + rnd() * 1.1;
    const nx = Math.cos(dir + Math.PI / 2), ny = Math.sin(dir + Math.PI / 2);
    g.beginPath();
    g.moveTo(px - Math.cos(dir) * len / 2, py - Math.sin(dir) * len / 2);
    g.quadraticCurveTo(px + nx * bow, py + ny * bow, px + Math.cos(dir) * len / 2, py + Math.sin(dir) * len / 2);
    g.stroke();
  }
  // pore stipple
  for (let k = 0; k < 260; k++) {
    const a = rnd() * Math.PI * 2;
    const rr = Math.sqrt(rnd()) * R * 0.97;
    g.fillStyle = `rgba(90,58,30,${0.03 + rnd() * 0.05})`;
    g.beginPath(); g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.4 + rnd() * 0.8, 0, Math.PI * 2); g.fill();
  }
  // age cracks from the rim, thinning as they run in
  for (let k = 0; k < 3; k++) {
    const a0 = rnd() * Math.PI * 2;
    let px = cx + Math.cos(a0) * R * 0.99;
    let py = cy + Math.sin(a0) * R * 0.99;
    let heading = a0 + Math.PI + (rnd() - 0.5) * 0.5;
    g.strokeStyle = 'rgba(58,36,18,.4)';
    g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(px, py);
    const segs = 4 + Math.floor(rnd() * 3);
    for (let s = 0; s < segs; s++) {
      heading += (rnd() - 0.5) * 0.7;
      px += Math.cos(heading) * R * (0.05 + rnd() * 0.08);
      py += Math.sin(heading) * R * (0.05 + rnd() * 0.08);
      g.lineTo(px, py);
    }
    g.stroke();
  }
  g.restore();
  // turned rim: incised circles with a lit lip, then the rim's own shade
  const ring = (rr, style, w) => { g.strokeStyle = style; g.lineWidth = w; g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.stroke(); };
  const shade = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, R);
  shade.addColorStop(0, 'rgba(12,9,6,0)');
  shade.addColorStop(1, 'rgba(12,9,6,.22)');
  g.fillStyle = shade;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  ring(R - 0.8, 'rgba(12,9,6,.65)', 1.4);

  // ---- the horizon band (annulus R*.885 .. R): night sea + the painted sky ----
  const bandIn = R * 0.885;
  const annulus = (a0, a1) => {
    g.beginPath();
    g.arc(cx, cy, R - 1.6, a0, a1);
    g.arc(cx, cy, bandIn, a1, a0, true);
    g.closePath();
  };
  // night half first, whole band
  const night = g.createRadialGradient(cx, cy, bandIn, cx, cy, R);
  night.addColorStop(0, 'rgba(12,9,6,.85)');
  night.addColorStop(0.75, 'rgba(21,38,61,.85)');
  night.addColorStop(1, 'rgba(29,58,95,.8)');
  g.fillStyle = night;
  annulus(0, Math.PI * 2);
  g.fill();
  // stars in the sunless half only
  const a0 = angleOf(instance.arcStart);
  const a1 = angleOf(instance.arcStart + ARC);
  for (let k = 0; k < 11; k++) {
    const az = mod(instance.arcStart + ARC + 2 + Math.floor(rnd() * 28));
    const aa = angleOf(az) + (rnd() - 0.5) * 0.04;
    const rr = bandIn + (R - bandIn) * (0.22 + rnd() * 0.6);
    g.fillStyle = `rgba(233,220,195,${0.25 + rnd() * 0.3})`;
    g.beginPath(); g.arc(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr, 0.6 + rnd() * 0.7, 0, Math.PI * 2); g.fill();
  }
  // THE day-mark: dawn-to-day sky painted along the sun's half
  const sky = g.createRadialGradient(cx, cy, bandIn, cx, cy, R);
  sky.addColorStop(0, 'rgba(238,207,109,.9)');   // horizon gold at the rose
  sky.addColorStop(0.3, 'rgba(216,150,84,.72)'); // ember wash
  sky.addColorStop(0.68, 'rgba(126,152,190,.7)');
  sky.addColorStop(1, 'rgba(63,109,158,.78)');   // fjord zenith
  g.fillStyle = sky;
  annulus(a0, a1);
  g.fill();
  // the sun itself rides the band at the arc's centre — unmissable
  const ac = angleOf(instance.arcStart + QUARTER);
  const sr = (bandIn + R) / 2;
  const sunX = cx + Math.cos(ac) * sr;
  const sunY = cy + Math.sin(ac) * sr;
  art.glow(g, sunX, sunY, R * 0.11, P.goldBright, 0.9);
  const sun = g.createRadialGradient(sunX - 1, sunY - 1, 0, sunX, sunY, R * 0.042);
  sun.addColorStop(0, '#fff3cf');
  sun.addColorStop(0.55, P.goldBright);
  sun.addColorStop(1, P.gold);
  g.fillStyle = sun;
  g.beginPath(); g.arc(sunX, sunY, R * 0.038, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(238,207,109,.6)';
  g.lineWidth = 1.2;
  for (let k = 0; k < 8; k++) {
    const ra = (k / 8) * Math.PI * 2;
    g.beginPath();
    g.moveTo(sunX + Math.cos(ra) * R * 0.052, sunY + Math.sin(ra) * R * 0.052);
    g.lineTo(sunX + Math.cos(ra) * R * 0.075, sunY + Math.sin(ra) * R * 0.075);
    g.stroke();
  }
  // gates where day meets night: a scribed spoke and a gold bead at each end
  for (const aa of [a0, a1]) {
    g.strokeStyle = 'rgba(12,9,6,.75)';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(cx + Math.cos(aa) * bandIn, cy + Math.sin(aa) * bandIn);
    g.lineTo(cx + Math.cos(aa) * (R - 1.6), cy + Math.sin(aa) * (R - 1.6));
    g.stroke();
    g.fillStyle = P.goldBright;
    g.beginPath(); g.arc(cx + Math.cos(aa) * (R - 4), cy + Math.sin(aa) * (R - 4), 1.7, 0, Math.PI * 2); g.fill();
  }
  // band borders: tar scribes, lit inner lip
  ring(bandIn, 'rgba(12,9,6,.8)', 1.2);
  ring(bandIn - 1.4, 'rgba(238,207,109,.22)', 0.9);
  ring(R - 2.6, 'rgba(12,9,6,.6)', 1);

  // ---- the rose: real construction, scrimshaw-scribed and ink-filled ----
  ring(R * 0.86, 'rgba(12,9,6,.4)', 0.9);
  ring(R * 0.775, 'rgba(12,9,6,.42)', 0.9);
  ring(R * 0.5, 'rgba(12,9,6,.22)', 0.8);
  ring(R * 0.27, 'rgba(12,9,6,.26)', 0.8);
  ring(R * 0.775 + 1.1, 'rgba(250,244,228,.35)', 0.6);
  // ticks: 64ths fine, 32nds stronger — the scribed minors
  for (let i = 0; i < RING; i++) {
    if (i % 4 === 0) continue; // spindles carry these
    const aa = angleOf(i);
    const major = i % 2 === 0;
    const r0 = major ? R * 0.775 : R * 0.81;
    const r1 = R * 0.86;
    g.strokeStyle = major ? 'rgba(12,9,6,.68)' : 'rgba(12,9,6,.45)';
    g.lineWidth = major ? 1.5 : 0.8;
    g.beginPath();
    g.moveTo(cx + Math.cos(aa) * r0, cy + Math.sin(aa) * r0);
    g.lineTo(cx + Math.cos(aa) * r1, cy + Math.sin(aa) * r1);
    g.stroke();
  }
  // spindles: two-tone lozenges, the classic star — bold airts over quiet minors
  const spindle = (az, r1, w, dark, light) => {
    const aa = angleOf(az);
    g.save();
    g.translate(cx, cy);
    g.rotate(aa);
    const r0 = R * 0.075;
    const rm = r1 * 0.42;
    g.fillStyle = dark;
    g.beginPath(); g.moveTo(r0, 0); g.lineTo(rm, w); g.lineTo(r1, 0); g.closePath(); g.fill();
    g.fillStyle = light;
    g.beginPath(); g.moveTo(r0, 0); g.lineTo(rm, -w); g.lineTo(r1, 0); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(12,9,6,.55)';
    g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(r0, 0); g.lineTo(rm, w); g.lineTo(r1, 0); g.lineTo(rm, -w); g.closePath(); g.stroke();
    g.restore();
  };
  for (let i = 0; i < RING; i += 4) {
    if (i % 16 === 0) spindle(i, R * 0.72, R * 0.052, 'rgba(12,9,6,.78)', 'rgba(250,244,228,.75)');
    else if (i % 8 === 0) spindle(i, R * 0.6, R * 0.042, 'rgba(143,31,31,.72)', 'rgba(250,244,228,.6)');
    else spindle(i, R * 0.46, R * 0.02, 'rgba(12,9,6,.5)', 'rgba(12,9,6,.28)');
  }
  // the four cardinal runes — norðr, austr, suðr, vestr — scribed at the tips
  const runeFor = { 0: 'ᚾ', 16: 'ᛅ', 32: 'ᛋ', 48: 'ᚢ' };
  for (const az of [0, 16, 32, 48]) {
    const aa = angleOf(az);
    const rr = R * 0.665;
    const sz = R * 0.075;
    art.drawRune(g, runeFor[az], cx + Math.cos(aa) * rr - sz / 2, cy + Math.sin(aa) * rr - sz / 2, sz, {
      color: 'rgba(12,9,6,.72)', weight: sz / 8,
    });
  }
  // centre boss: turned rings, chip cuts, and the brass pivot pin
  ring(R * 0.075, 'rgba(12,9,6,.5)', 1);
  ring(R * 0.055, 'rgba(250,244,228,.5)', 0.8);
  g.fillStyle = 'rgba(12,9,6,.35)';
  for (let k = 0; k < 8; k++) {
    const aa = (k / 8) * Math.PI * 2 + Math.PI / 8;
    g.beginPath();
    g.arc(cx + Math.cos(aa) * R * 0.065, cy + Math.sin(aa) * R * 0.065, R * 0.008, 0, Math.PI * 2);
    g.fill();
  }
  // salt rime on the disc's lower rim — the sea has been at it
  g.save();
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  for (let k = 0; k < 46; k++) {
    const aa = Math.PI * (0.32 + rnd() * 0.36); // lower sector
    const rr = R * (0.9 + rnd() * 0.1);
    g.fillStyle = `rgba(250,246,236,${0.1 + rnd() * 0.22})`;
    g.beginPath();
    g.arc(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr, 0.5 + rnd() * 1.3, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();

  // bone tags under each cord carrying the raw reading — the number the row quotes
  g.font = `600 ${Math.max(10, Math.round(LY.s * 0.42))}px ${MONO}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < crys.length; i++) {
    const c = crys[i];
    const ty = c.y + LY.s * 1.5;
    const tw = Math.max(26, LY.s * 1.15);
    const th = Math.max(15, LY.s * 0.62);
    g.strokeStyle = 'rgba(12,9,6,.6)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(c.x, c.y + LY.s * 0.95); g.lineTo(c.x, ty - th / 2); g.stroke();
    g.fillStyle = 'rgba(233,220,195,.93)';
    g.strokeStyle = 'rgba(12,9,6,.8)';
    g.beginPath();
    if (typeof g.roundRect === 'function') g.roundRect(c.x - tw / 2, ty - th / 2, tw, th, 3); else g.rect(c.x - tw / 2, ty - th / 2, tw, th);
    g.fill();
    g.stroke();
    g.fillStyle = 'rgba(12,9,6,.85)';
    g.fillText(String(instance.readings[i]), c.x, ty + 0.5);
  }
  g.textAlign = 'start';
  g.textBaseline = 'alphabetic';
}

function ropeCoil(g, x, y, r, rnd) {
  g.save();
  g.lineCap = 'round';
  for (let t = 0; t < 2.6 * Math.PI * 2; t += 0.22) {
    const rr = r * (0.35 + 0.25 * (t / (Math.PI * 2)));
    const px = x + Math.cos(t) * rr;
    const py = y + Math.sin(t) * rr * 0.72;
    g.strokeStyle = 'rgba(12,9,6,.38)';
    g.lineWidth = r * 0.16;
    g.beginPath(); g.moveTo(px, py); g.lineTo(x + Math.cos(t + 0.2) * rr, y + Math.sin(t + 0.2) * rr * 0.72); g.stroke();
  }
  // twist highlights
  for (let t = 0; t < 2.6 * Math.PI * 2; t += 0.44) {
    const rr = r * (0.35 + 0.25 * (t / (Math.PI * 2)));
    g.strokeStyle = `rgba(183,169,140,${0.1 + rnd() * 0.06})`;
    g.lineWidth = r * 0.05;
    g.beginPath();
    g.moveTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr * 0.72);
    g.lineTo(x + Math.cos(t + 0.14) * rr, y + Math.sin(t + 0.14) * rr * 0.72);
    g.stroke();
  }
  // tail running off toward the disc
  g.strokeStyle = 'rgba(12,9,6,.32)';
  g.lineWidth = r * 0.14;
  g.beginPath();
  g.moveTo(x - r * 0.5, y - r * 0.35);
  g.quadraticCurveTo(x - r * 1.5, y - r * 0.9, x - r * 2.1, y - r * 0.5);
  g.stroke();
  g.restore();
}

function rime(g, x, y, spread, n, rnd) {
  for (let k = 0; k < n; k++) {
    const px = x + (rnd() - 0.5) * 2 * spread;
    const py = y + (rnd() - 0.5) * spread * 0.24;
    g.fillStyle = `rgba(233,220,195,${0.05 + rnd() * 0.09})`;
    g.beginPath(); g.arc(px, py, 0.5 + rnd() * 1.4, 0, Math.PI * 2); g.fill();
  }
}

function drawCord(g, P, x0, y0, x1, y1, lit, art) {
  const mx = (x0 + x1) / 2 + (x1 - x0) * 0.04;
  const my = (y0 + y1) / 2 + 3;
  g.save();
  // hemp line: tar seat under a pale twisted strand
  g.strokeStyle = 'rgba(12,9,6,.7)';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(x0 + 1, y0 + 1); g.quadraticCurveTo(mx + 1, my + 1, x1 + 1, y1 + 1); g.stroke();
  g.strokeStyle = 'rgba(183,169,140,.75)';
  g.lineWidth = 1.8;
  g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
  g.strokeStyle = 'rgba(12,9,6,.5)';
  g.lineWidth = 0.9;
  if (typeof g.setLineDash === 'function') g.setLineDash([2.5, 2.5]);
  g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
  if (typeof g.setLineDash === 'function') g.setLineDash([]);
  if (lit) {
    g.strokeStyle = 'rgba(238,207,109,.75)';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
    art.glow(g, mx, my, 9, P.goldBright, 0.5);
    art.glow(g, x1, y1 - 2, 13, P.goldBright, 0.55);
  }
  // wraps at the cleat
  g.strokeStyle = lit ? 'rgba(238,207,109,.7)' : 'rgba(12,9,6,.8)';
  g.lineWidth = 1.4;
  for (let k = 0; k < 3; k++) {
    g.beginPath(); g.moveTo(x0 - 4, y0 + 2 + k * 2.4); g.lineTo(x0 + 4, y0 + 1 + k * 2.4); g.stroke();
  }
  g.restore();
}

// a sólarsteinn: an Iceland-spar rhomb on its sling — translucent faces and
// the doubled inner image that gives the stone away as calcite
function drawCrystal(art, g, x, y, s, lit, glint) {
  const P = art.palette;
  const k = s;
  const sk = s * 0.16; // calcite obliqueness
  const top = [[0 + sk, -k * 1.02], [k * 0.82 + sk, -k * 0.52], [0, -k * 0.06], [-k * 0.82 + sk * 0.4, -k * 0.56]];
  const right = [[0, -k * 0.06], [k * 0.82 + sk, -k * 0.52], [k * 0.82, k * 0.42], [0, k * 0.92]];
  const left = [[0, -k * 0.06], [-k * 0.82 + sk * 0.4, -k * 0.56], [-k * 0.82, k * 0.38], [0, k * 0.92]];
  // Material pass (QUALITY_LOOP4: flat fills + one bright uniform stroke read
  // as cardboard next to the compass rose). Same silhouette, same calls —
  // per-face gradients, a heavier silhouette than the inner edges, an inner
  // caustic where the light pools, and a soft cast shadow on the plank wall.
  const face = (pts, mkFill, edgeAlpha) => {
    g.beginPath();
    g.moveTo(x + pts[0][0], y + pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(x + pts[i][0], y + pts[i][1]);
    g.closePath();
    g.fillStyle = mkFill();
    g.fill();
    g.strokeStyle = `rgba(233,220,195,${edgeAlpha})`;
    g.lineWidth = 0.8;
    g.stroke();
  };
  g.save();
  // cast shadow behind the hanging stone (grounds it against the plank) —
  // three feathered ellipses, no canvas filter (Safari-safe)
  for (const [grow, a] of [[1.18, 0.1], [1.06, 0.14], [0.96, 0.18]]) {
    g.fillStyle = `rgba(12,9,6,${a})`;
    g.beginPath();
    g.ellipse(x + k * 0.16, y + k * 0.22, k * 0.94 * grow, k * 1.02 * grow, 0.12, 0, Math.PI * 2);
    g.fill();
  }
  if (lit) art.glow(g, x, y, s * 2.1, P.goldBright, 0.55);
  else if (glint) art.glow(g, x, y, s * 1.8, P.goldBright, 0.45);
  face(top, () => {
    const f = g.createLinearGradient(x - k * 0.8, y - k * 1.02, x + k * 0.8, y - k * 0.1);
    f.addColorStop(0, `rgba(250,246,236,${lit ? 0.9 : 0.66})`);
    f.addColorStop(0.55, `rgba(233,228,210,${lit ? 0.72 : 0.5})`);
    f.addColorStop(1, `rgba(196,196,186,${lit ? 0.6 : 0.4})`);
    return f;
  }, lit ? 0.85 : 0.55);
  face(right, () => {
    const f = g.createLinearGradient(x, y - k * 0.4, x + k * 0.6, y + k * 0.92);
    f.addColorStop(0, `rgba(122,158,196,${lit ? 0.7 : 0.5})`);
    f.addColorStop(0.5, `rgba(74,112,156,${lit ? 0.62 : 0.44})`);
    f.addColorStop(1, `rgba(38,60,92,${lit ? 0.72 : 0.55})`);
    return f;
  }, lit ? 0.5 : 0.32);
  face(left, () => {
    const f = g.createLinearGradient(x - k * 0.8, y - k * 0.3, x, y + k * 0.92);
    f.addColorStop(0, `rgba(240,232,214,${lit ? 0.55 : 0.34})`);
    f.addColorStop(0.6, `rgba(210,202,184,${lit ? 0.4 : 0.24})`);
    f.addColorStop(1, `rgba(150,146,136,${lit ? 0.42 : 0.26})`);
    return f;
  }, lit ? 0.6 : 0.4);
  // silhouette: one heavier contour so the rhomb sits OFF the wall
  g.strokeStyle = `rgba(12,9,6,${lit ? 0.72 : 0.6})`;
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(x + sk, y - k * 1.02);
  g.lineTo(x + k * 0.82 + sk, y - k * 0.52);
  g.lineTo(x + k * 0.82, y + k * 0.42);
  g.lineTo(x, y + k * 0.92);
  g.lineTo(x - k * 0.82, y + k * 0.38);
  g.lineTo(x - k * 0.82 + sk * 0.4, y - k * 0.56);
  g.closePath();
  g.stroke();
  // light pooling low in the stone — spar glows where it drinks the sky
  const pool = g.createRadialGradient(x + k * 0.1, y + k * 0.42, 0, x + k * 0.1, y + k * 0.42, k * 0.72);
  pool.addColorStop(0, `rgba(255,241,199,${lit ? 0.4 : glint ? 0.28 : 0.16})`);
  pool.addColorStop(1, 'rgba(255,241,199,0)');
  g.fillStyle = pool;
  g.beginPath();
  g.moveTo(x, y - k * 0.06);
  g.lineTo(x + k * 0.82, y + k * 0.42);
  g.lineTo(x, y + k * 0.92);
  g.lineTo(x - k * 0.82, y + k * 0.38);
  g.closePath();
  g.fill();
  // double refraction: the same edge seen twice, slightly apart
  g.strokeStyle = `rgba(63,109,158,${lit ? 0.8 : 0.5})`;
  g.lineWidth = 0.9;
  g.beginPath();
  g.moveTo(x - k * 0.34 + sk * 0.4, y - k * 0.2);
  g.lineTo(x + k * 0.1, y + k * 0.5);
  g.moveTo(x - k * 0.22 + sk * 0.4, y - k * 0.26);
  g.lineTo(x + k * 0.22, y + k * 0.42);
  g.stroke();
  // and its ghost twin in bone — calcite shows every edge twice
  g.strokeStyle = `rgba(233,220,195,${lit ? 0.34 : 0.2})`;
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(x - k * 0.28 + sk * 0.4, y - k * 0.23);
  g.lineTo(x + k * 0.16, y + k * 0.46);
  g.stroke();
  // sling: gold wire over the shoulders
  g.strokeStyle = `rgba(201,162,39,${lit ? 0.95 : 0.7})`;
  g.lineWidth = 1.3;
  g.beginPath();
  g.moveTo(x - k * 0.5, y - k * 0.62);
  g.quadraticCurveTo(x + sk, y - k * 1.14, x + k * 0.55, y - k * 0.58);
  g.stroke();
  g.beginPath();
  g.arc(x + sk * 0.6, y - k * 1.06, k * 0.14, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

// one blade of polarised light thrown across the rose; the wet stone's blades
// flicker and smear — a steady stone's stand still
function drawBlade(art, g, LY, az, opts) {
  const { cx, cy, R } = LY;
  const P = art.palette;
  const t = opts.t || 0;
  let alpha = opts.alpha;
  let wobble = 0;
  if (opts.wet) {
    if (opts.calm) {
      alpha *= 0.72; // statically dimmer …
    } else {
      const f = 0.5 + 0.5 * Math.sin(t * 9.7 + opts.phase);
      const f2 = 0.7 + 0.3 * Math.sin(t * 23.3 + opts.phase * 2.7);
      alpha *= 0.35 + 0.6 * f * f2;
      wobble = Math.sin(t * 7.3 + opts.phase) * 0.009;
    }
  }
  const aa = angleOf(az) + wobble;
  g.save();
  g.translate(cx, cy);
  g.rotate(aa);
  const r0 = R * 0.14;
  const r1 = R * 0.86;
  const w = R * 0.034;
  const grad = g.createLinearGradient(r0, 0, r1, 0);
  grad.addColorStop(0, 'rgba(233,220,195,0)');
  grad.addColorStop(0.25, `rgba(233,220,195,${0.5 * alpha})`);
  grad.addColorStop(0.7, `rgba(190,214,240,${0.42 * alpha})`);
  grad.addColorStop(1, `rgba(63,109,158,${0.16 * alpha})`);
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(r0, 0);
  g.lineTo(r0 + (r1 - r0) * 0.45, -w);
  g.lineTo(r1, 0);
  g.lineTo(r0 + (r1 - r0) * 0.45, w);
  g.closePath();
  g.fill();
  // a fine tar rim so the light reads on pale bone
  g.strokeStyle = `rgba(12,9,6,${0.3 * alpha})`;
  g.lineWidth = 0.7;
  g.stroke();
  // the blade's bright core
  g.strokeStyle = `rgba(250,247,238,${0.75 * alpha})`;
  g.lineWidth = 1.4;
  if (opts.wet && typeof g.setLineDash === 'function') g.setLineDash(opts.calm ? [5, 4] : [9, 3]);
  g.beginPath(); g.moveTo(r0 + 2, 0); g.lineTo(r1 - 1, 0); g.stroke();
  if (typeof g.setLineDash === 'function') g.setLineDash([]);
  if (opts.wet) {
    // …and doubled askew: the smear a wet face throws
    g.strokeStyle = `rgba(190,214,240,${0.4 * alpha})`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(r0 + 4, 2.2);
    g.lineTo(r1 - 6, R * 0.016 + 2.2);
    g.stroke();
  }
  g.restore();
  // where the blade meets the tick ring, a small light pool + the point number
  const px = cx + Math.cos(aa) * R * 0.63;
  const py = cy + Math.sin(aa) * R * 0.63;
  art.glow(g, cx + Math.cos(aa) * r1, cy + Math.sin(aa) * r1, R * 0.05, P.goldBright, 0.35 * alpha);
  g.save();
  g.globalAlpha = Math.min(1, alpha + 0.25);
  g.fillStyle = 'rgba(233,220,195,.92)';
  g.strokeStyle = 'rgba(12,9,6,.75)';
  g.lineWidth = 1;
  g.beginPath(); g.arc(px, py, Math.max(9, R * 0.042), 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = 'rgba(12,9,6,.88)';
  g.font = `600 ${Math.max(9.5, R * 0.045)}px ${MONO}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(az), px, py + 0.5);
  g.restore();
}

// the bearing pointer: a turned-bone fid with a brass keel, seated on the pin
function drawNeedle(art, g, LY, az) {
  const { cx, cy, R } = LY;
  const P = art.palette;
  const aa = angleOf(az);
  g.save();
  g.translate(cx, cy);
  g.rotate(aa);
  // cast shadow, thrown by the hearth key
  g.save();
  g.translate(1.6, 2.6);
  g.fillStyle = 'rgba(12,9,6,.32)';
  g.beginPath();
  g.moveTo(-R * 0.16, 0);
  g.lineTo(R * 0.6, -R * 0.014);
  g.lineTo(R * 0.84, 0);
  g.lineTo(R * 0.6, R * 0.014);
  g.closePath();
  g.fill();
  g.restore();
  // tail counterweight ring, seated on the shaft's end
  g.strokeStyle = P.gold;
  g.lineWidth = 2.2;
  g.beginPath(); g.arc(-R * 0.155, 0, R * 0.026, 0, Math.PI * 2); g.stroke();
  // shaft: bone blade, brass edge light
  const shaft = g.createLinearGradient(0, -R * 0.02, 0, R * 0.02);
  shaft.addColorStop(0, '#f6efdd');
  shaft.addColorStop(0.5, P.bone);
  shaft.addColorStop(1, '#b7a071');
  g.fillStyle = shaft;
  g.beginPath();
  g.moveTo(-R * 0.13, 0);
  g.lineTo(R * 0.55, -R * 0.018);
  g.lineTo(R * 0.84, 0);
  g.lineTo(R * 0.55, R * 0.018);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(12,9,6,.8)';
  g.lineWidth = 1;
  g.stroke();
  // brass keel line + arrow head
  g.strokeStyle = 'rgba(201,162,39,.9)';
  g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(-R * 0.06, 0); g.lineTo(R * 0.78, 0); g.stroke();
  g.fillStyle = P.goldBright;
  g.beginPath();
  g.moveTo(R * 0.84, 0);
  g.lineTo(R * 0.76, -R * 0.026);
  g.lineTo(R * 0.79, 0);
  g.lineTo(R * 0.76, R * 0.026);
  g.closePath();
  g.fill();
  g.restore();
  // the pivot pin over everything
  const pin = g.createRadialGradient(cx - 2, cy - 2, 0, cx, cy, R * 0.03);
  pin.addColorStop(0, '#fff1c7');
  pin.addColorStop(0.5, P.goldBright);
  pin.addColorStop(1, '#7d6216');
  g.fillStyle = pin;
  g.beginPath(); g.arc(cx, cy, R * 0.026, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(12,9,6,.7)';
  g.lineWidth = 1;
  g.stroke();
  art.glow(g, cx + Math.cos(aa) * R * 0.84, cy + Math.sin(aa) * R * 0.84, R * 0.06, P.goldBright, 0.6);
}

function mount(ctx) {
  const { root, instance, art, audio } = ctx;
  const P = art.palette;
  const lang = ctx.lang || 'en';
  const LB = (I18N[lang] && I18N[lang].board) || {};
  const T = (key, params) => {
    let s = key in LB ? LB[key] : BOARD_EN[key];
    if (params) for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]));
    return s;
  };
  const Lp = { airts: LB.airts, half: LB.half ?? BOARD_EN.half };
  const stoneName = (i) => ((Array.isArray(LB.stoneNames) && LB.stoneNames[i]) || instance.stones[i]);
  const calm = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // every listener is tracked so unmount can take them all back down
  const bound = [];
  const on = (el, type, fn, opts) => { el.addEventListener(type, fn, opts); bound.push([el, type, fn, opts]); };
  const unbind = () => { for (const [el, type, fn, opts] of bound) el.removeEventListener(type, fn, opts); bound.length = 0; };
  const timers = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

  const wrap = document.createElement('div');
  wrap.className = 'ow-lock ow-sunstone';
  const style = document.createElement('style');
  style.textContent = `
  .ow-sunstone{display:flex;flex-direction:column;gap:.55rem;color:${P.bone};
    font-family:${SERIF};align-items:stretch}
  .ow-sunstone .plate{margin:0;align-self:center;text-align:center;max-width:60ch;
    font-size:.98rem;line-height:1.45;color:${P.bone};letter-spacing:.015em;
    padding:.5rem .9rem .55rem;border-radius:5px;
    background:linear-gradient(180deg,rgba(233,220,195,.1),rgba(233,220,195,.04) 55%,rgba(12,9,6,.12));
    border:1px solid rgba(12,9,6,.85);
    box-shadow:inset 0 1px 0 rgba(233,220,195,.14),inset 0 -1px 2px rgba(12,9,6,.5),0 2px 6px rgba(12,9,6,.45);
    text-shadow:-1px -1px 0 rgba(12,9,6,.75),1px 1px 0 rgba(238,207,109,.18)}
  .ow-sunstone .station{position:relative;align-self:center;padding:10px;border-radius:6px;
    background:linear-gradient(168deg,rgba(90,58,30,.85),rgba(58,36,18,.9) 55%,rgba(34,21,7,.95));
    border:1px solid rgba(12,9,6,.9);
    box-shadow:0 10px 22px rgba(12,9,6,.6),0 3px 6px rgba(12,9,6,.55),
      inset 0 1px 0 rgba(233,220,195,.16),inset 0 -2px 3px rgba(12,9,6,.7)}
  .ow-sunstone .station canvas{display:block;border-radius:3px;touch-action:none;cursor:pointer}
  .ow-sunstone .station:focus-visible{outline:2px solid ${P.goldBright};outline-offset:3px}
  .ow-sunstone .skip{background:rgba(12,9,6,.72);color:${P.boneDim};align-self:center;
    border:1px solid rgba(90,58,30,.9);border-radius:4px;font:inherit;font-size:.8rem;
    min-height:44px;min-width:44px;padding:.2rem .7rem;cursor:pointer}
  .ow-sunstone .skip:hover{color:${P.bone};border-color:${P.oakLight}}
  .ow-sunstone .dial{display:flex;flex-direction:column;gap:.15rem;align-items:center;text-align:center}
  .ow-sunstone .side{display:flex;flex-direction:column;gap:.55rem;min-width:0}
  @media (min-width: 980px){
    .ow-sunstone{display:grid;column-gap:1.1rem;row-gap:.55rem;align-items:start;
      grid-template-columns:var(--ow9-col,542px) minmax(0,1fr);
      grid-template-areas:'plate plate' 'station side' 'dial side' 'law law'}
    .ow-sunstone .plate{grid-area:plate;justify-self:center}
    .ow-sunstone .station{grid-area:station;align-self:start;justify-self:start}
    .ow-sunstone .dial{grid-area:dial;min-width:0;max-width:100%}
    .ow-sunstone .side{grid-area:side;align-self:center;min-width:0}
    .ow-sunstone .law{grid-area:law;justify-self:center}
  }
  .ow-sunstone .bearing{font-family:${MONO};font-size:1.02rem;color:${P.goldBright};
    text-shadow:0 1px 0 rgba(12,9,6,.8)}
  .ow-sunstone .watch{font-size:.82rem;letter-spacing:.06em;color:${P.boneDim};
    font-variant-caps:all-small-caps}
  .ow-sunstone .say{min-height:1.25em;margin:0;text-align:center;font-size:.86rem;color:${P.boneDim}}
  .ow-sunstone h4{margin:.15rem 0 0;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:${P.boneDim}}
  .ow-sunstone .stone{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:.45rem;align-items:center;
    background:linear-gradient(180deg,rgba(12,9,6,.38),rgba(12,9,6,.26));
    border:1px solid rgba(90,58,30,.9);border-left:3px solid rgba(90,58,30,.9);
    border-radius:4px;padding:.32rem .5rem;
    box-shadow:inset 0 1px 0 rgba(233,220,195,.07),0 1px 3px rgba(12,9,6,.5)}
  .ow-sunstone .stone[data-focus="1"]{border-color:${P.goldBright};border-left-color:${P.goldBright};
    box-shadow:inset 0 1px 0 rgba(233,220,195,.1),0 0 8px rgba(238,207,109,.22)}
  .ow-sunstone .stone[data-glint="1"]{border-left-color:${P.goldBright}}
  .ow-sunstone .stone .name{font-size:.88rem;color:${P.bone};min-width:0}
  .ow-sunstone .stone .name b{font-family:${MONO};font-weight:600;color:${P.goldBright}}
  .ow-sunstone button{font:inherit;cursor:pointer}
  .ow-sunstone .cand{min-height:44px;min-width:48px;padding:.2rem .55rem;border-radius:4px;
    font-family:${MONO};font-size:.95rem;color:${P.bone};
    background:linear-gradient(180deg,rgba(233,220,195,.18),rgba(233,220,195,.07));
    border:1px solid rgba(12,9,6,.9);
    box-shadow:inset 0 1px 0 rgba(233,220,195,.2),0 2px 3px rgba(12,9,6,.55)}
  .ow-sunstone .cand:hover{border-color:${P.oakLight};color:#fff}
  .ow-sunstone .cand[aria-pressed="true"]{color:#2a1d05;font-weight:700;
    background:linear-gradient(178deg,${P.goldBright},${P.gold} 70%);
    border-color:rgba(42,29,5,.8);
    box-shadow:inset 0 1px 0 rgba(255,241,199,.8),0 2px 3px rgba(12,9,6,.55)}
  .ow-sunstone .wet{min-height:44px;min-width:52px;padding:.2rem .55rem;border-radius:4px;
    color:${P.boneDim};background:rgba(12,9,6,.4);border:1px solid rgba(90,58,30,.9)}
  .ow-sunstone .wet:hover{color:${P.bone};border-color:${P.oakLight}}
  .ow-sunstone .wet[aria-pressed="true"]{border-color:${P.blood};color:#e9dcc3;
    background:linear-gradient(180deg,rgba(143,31,31,.85),rgba(90,20,20,.9));
    box-shadow:inset 0 1px 0 rgba(233,220,195,.18),0 2px 3px rgba(12,9,6,.55)}
  .ow-sunstone button:focus-visible{outline:2px solid ${P.goldBright};outline-offset:2px}
  .ow-sunstone .send{align-self:center;margin-top:.1rem}
  .ow-sunstone .tell{margin:0;min-height:1.3em;font-size:.9rem;color:${P.ember};text-align:center;scroll-margin:28px}
  .ow-sunstone .law{margin:0;font-size:.86rem;line-height:1.45;color:${P.boneDim};max-width:64ch;align-self:center}
  .ow-sunstone .law b{color:${P.bone};font-weight:600}
  /* the shell sets \`#app *{min-width:0}\`, which outranks a bare class rule and
     flattens every touch target; this re-asserts the 44 px floor at equal weight */
  #app .ow-sunstone button{min-width:44px}`;
  wrap.appendChild(style);

  // ---- state ----
  const truth = solve(instance); // view-only: which blades flicker
  let needle = mod(instance.arcStart);
  let wet = null;
  let focused = -1;
  let showing = false;
  let touched = false;
  let demoT0 = 0;
  let raf = 0;
  let dragging = false;
  let lastTick = 0;

  // ---- layout + bake ----
  let LY = null;
  let bake = null;
  let cv = null;

  function layout() {
    const avail = Math.max(280, Math.min((root.clientWidth || 520) - 4, 520));
    const W = Math.round(avail);
    const railH = Math.round(W * 0.17);
    const H = railH + W;
    const s = Math.round(Math.min(38, Math.max(24, W * 0.075)));
    const crys = [0.18, 0.5, 0.82].map((f) => ({
      x: Math.round(W * f),
      y: Math.round(railH * 0.46 + Math.max(14, railH * 0.22) + s * 0.55),
    }));
    LY = { W, H, railH, cx: W / 2, cy: railH + W / 2, R: W / 2 - 10, s, crys };
    // the wide layout's left column is exactly the station: canvas + chrome
    wrap.style.setProperty('--ow9-col', `${W + 22}px`);
  }

  function rebake() {
    const off = art.makeCanvas(LY.W, LY.H);
    paintStation(art, off.ctx, LY, instance);
    bake = off.canvas;
  }

  const holder = document.createElement('div');
  holder.className = 'station';
  holder.tabIndex = 0;
  holder.setAttribute('role', 'slider');
  holder.setAttribute('aria-label', T('sliderAria'));
  holder.setAttribute('aria-valuemin', '0');
  holder.setAttribute('aria-valuemax', '63');

  function remakeCanvas() {
    if (cv) cv.canvas.remove();
    cv = art.makeCanvas(LY.W, LY.H);
    cv.canvas.setAttribute('aria-hidden', 'true');
    holder.appendChild(cv.canvas);
  }

  // ---- draw ----
  function draw() {
    const g = cv.ctx;
    const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
    g.clearRect(0, 0, LY.W, LY.H);
    g.drawImage(bake, 0, 0, LY.W, LY.H);
    // cords + crystals; a cord glints while its stone stands behind the needle
    for (let i = 0; i < 3; i++) {
      const c = LY.crys[i];
      const lit = focused === i;
      const glint = candidates(instance.readings[i]).indexOf(needle) >= 0;
      drawCord(g, P, c.x, LY.railH * 0.46, c.x + LY.s * 0.12, c.y - LY.s * 1.02, glint, art);
      drawCrystal(art, g, c.x, c.y, LY.s, lit, glint);
    }
    // the focused stone throws its two blades
    if (focused >= 0) {
      const isWet = focused === truth.wet;
      let alpha = 1;
      if (showing && !calm) {
        const dt = (typeof performance !== 'undefined' ? performance.now() : 0) - demoT0;
        alpha = Math.max(0, Math.min(1, (dt - 420) / 650));
        if (dt > 2400) alpha *= Math.max(0, 1 - (dt - 2400) / 550);
      }
      const [a, b] = candidates(instance.readings[focused]);
      drawBlade(art, g, LY, a, { alpha, wet: isWet, calm, t, phase: 0.9 });
      drawBlade(art, g, LY, b, { alpha, wet: isWet, calm, t, phase: 2.3 });
    }
    drawNeedle(art, g, LY, needle);
    if (showing) drawGhost(g, t);
  }

  // the showing: a ghost hand lifts the first stone — three seconds, skippable
  function drawGhost(g, t) {
    const c = LY.crys[0];
    const dt = calm ? 600 : (typeof performance !== 'undefined' ? performance.now() : 0) - demoT0;
    const slide = calm ? 0 : Math.max(0, 1 - dt / 500) * 26;
    const pulse = calm ? 0.75 : 0.6 + 0.25 * Math.sin(t * 5);
    g.save();
    g.globalAlpha = dt > 2500 && !calm ? Math.max(0, 1 - (dt - 2500) / 500) : 1;
    g.strokeStyle = `rgba(238,207,109,${pulse})`;
    g.lineWidth = 2;
    if (typeof g.setLineDash === 'function') g.setLineDash([6, 5]);
    g.strokeRect(c.x - LY.s * 1.35 + slide, c.y - LY.s * 1.45, LY.s * 2.7, LY.s * 2.9);
    if (typeof g.setLineDash === 'function') g.setLineDash([]);
    // a hand's worth of gold: three fingertips closing on the crystal's shoulder
    g.strokeStyle = `rgba(238,207,109,${pulse * 0.9})`;
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const fx = c.x + LY.s * (0.98 + k * 0.14) + slide;
      const fy = c.y - LY.s * 0.28 + k * LY.s * 0.4;
      g.beginPath();
      g.moveTo(fx + LY.s * 0.42, fy + LY.s * 0.1);
      g.quadraticCurveTo(fx + LY.s * 0.16, fy - LY.s * 0.04, fx, fy);
      g.stroke();
    }
    g.beginPath();
    g.arc(c.x + LY.s * 1.28 + slide, c.y + LY.s * 0.72, LY.s * 0.34, Math.PI * 0.95, Math.PI * 1.6);
    g.stroke();
    g.restore();
  }

  function ensureLoop() {
    if (typeof requestAnimationFrame !== 'function') return;
    const need = !calm && (showing || (focused >= 0 && focused === truth.wet));
    if (need && !raf) {
      const step = () => { raf = 0; draw(); ensureLoop(); };
      raf = requestAnimationFrame(step);
    }
  }

  // ---- DOM ----
  const plate = document.createElement('p');
  plate.className = 'plate';
  plate.textContent = T('plate');
  wrap.appendChild(plate);

  wrap.appendChild(holder);

  const dial = document.createElement('div');
  dial.className = 'dial';
  const bearing = document.createElement('div');
  bearing.className = 'bearing';
  bearing.setAttribute('aria-live', 'polite');
  const watchLine = document.createElement('div');
  watchLine.className = 'watch';
  watchLine.textContent = T('dayMark', {
    a: instance.arcStart, b: mod(instance.arcStart + ARC - 1), watch: T(watchKey(instance.arcStart)),
  });
  const say = document.createElement('p');
  say.className = 'say';
  say.setAttribute('aria-live', 'polite');
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'skip';
  skip.textContent = T('skip');
  skip.style.display = 'none';
  dial.appendChild(bearing);
  dial.appendChild(watchLine);
  dial.appendChild(say);
  dial.appendChild(skip);
  wrap.appendChild(dial);

  // the readings and controls live in a side column on wide viewports
  const side = document.createElement('div');
  side.className = 'side';
  wrap.appendChild(side);

  const h1 = document.createElement('h4');
  h1.textContent = T('heading');
  side.appendChild(h1);

  const rows = instance.readings.map((r, i) => {
    const row = document.createElement('div');
    row.className = 'stone';
    const [a, b] = candidates(r);
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', T('rowAria', { stone: stoneName(i), n: r, a, b }));
    const name = document.createElement('span');
    name.className = 'name';
    // the raw reading beside the pair it opens: the ±16 law legible on the board
    name.appendChild(Object.assign(document.createElement('span'), { textContent: `${stoneName(i)} ` }));
    name.appendChild(Object.assign(document.createElement('b'), { textContent: T('read', { n: r }) }));
    row.appendChild(name);
    const cands = candidates(r).map((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cand';
      btn.textContent = `${c}`;
      btn.setAttribute('aria-label', T('takeAria', { n: c, airt: pointName(c, Lp) }));
      btn.setAttribute('aria-pressed', 'false');
      on(btn, 'click', () => {
        takeTheChisel();
        needle = c;
        focused = i;
        audio.ui('tick');
        audio.ui('knock');
        ctx.note(T('noteBearing', { n: c, airt: pointName(c, Lp) }));
        refresh();
        ensureLoop();
      });
      row.appendChild(btn);
      return { b: btn, c };
    });
    const w = document.createElement('button');
    w.type = 'button';
    w.className = 'wet';
    w.textContent = T('wet');
    w.setAttribute('aria-label', T('wetAria', { stone: stoneName(i) }));
    w.setAttribute('aria-pressed', 'false');
    on(w, 'click', () => {
      takeTheChisel();
      wet = wet === i ? null : i;
      audio.ui('flip');
      ctx.note(wet === i ? T('noteWet', { stone: stoneName(i) }) : T('noteWetNone'));
      refresh();
    });
    row.appendChild(w);
    // focusing anywhere in the row lifts that stone to the sky
    on(row, 'focusin', () => { if (focused !== i) { focused = i; refresh(); ensureLoop(); } });
    on(row, 'pointerenter', () => { if (focused !== i) { focused = i; refresh(); ensureLoop(); } });
    return { row, cands, w, reading: r };
  });
  rows.forEach((r) => side.appendChild(r.row));

  const send = document.createElement('button');
  send.className = 'btn-carved send'; // one primary-action language: the carved gold plate
  send.type = 'button';
  send.textContent = T('submit');
  side.appendChild(send);

  // The shell's near-line sits below the fold on the taller locks; the sea
  // answers a wrong bearing where the player's eye already is.
  const tell = document.createElement('p');
  tell.className = 'tell';
  tell.setAttribute('aria-live', 'polite');
  side.appendChild(tell);

  const law = document.createElement('p');
  law.className = 'law';
  const lawParts = (Array.isArray(LB.lawParts) ? LB.lawParts : BOARD_EN.lawParts);
  for (const [text, strong] of lawParts) {
    const sub = text.split('{a}').join(String(instance.arcStart)).split('{b}').join(String(mod(instance.arcStart + ARC - 1)));
    law.appendChild(Object.assign(document.createElement(strong ? 'b' : 'span'), { textContent: sub }));
  }
  wrap.appendChild(law);

  // ---- behaviour ----
  const nearMapLocal = (I18N[lang] && I18N[lang].nearMap) || {};

  function refresh() {
    holder.setAttribute('aria-valuenow', String(needle));
    holder.setAttribute('aria-valuetext', T('valueText', { n: needle, airt: pointName(needle, Lp) }));
    const within = inArc(needle, instance.arcStart);
    bearing.textContent = T('bearing', { n: needle, airt: pointName(needle, Lp) }) + (within ? '' : T('outside'));
    bearing.style.color = within ? P.goldBright : P.blood;
    let agree = 0;
    rows.forEach((r, i) => {
      r.cands.forEach((c) => c.b.setAttribute('aria-pressed', String(c.c === needle)));
      r.w.setAttribute('aria-pressed', String(wet === i));
      const glint = candidates(instance.readings[i]).indexOf(needle) >= 0;
      if (glint) agree++;
      r.row.dataset.glint = glint ? '1' : '0';
      r.row.dataset.focus = focused === i ? '1' : '0';
    });
    if (!showing) {
      if (within && agree >= 2) say.textContent = T('agree', { n: needle });
      else if (focused >= 0) {
        const [a, b] = candidates(instance.readings[focused]);
        say.textContent = T('focusSay', { stone: stoneName(focused), a, b });
      } else say.textContent = '';
    }
    send.disabled = wet === null;
    draw();
  }

  // detent: the pointer seats point by point with a bone click
  function seat(az, silent) {
    if (az === needle) return;
    needle = az;
    const now = (typeof performance !== 'undefined' ? performance.now() : 0);
    if (!silent && now - lastTick > 45) { audio.ui('tick'); lastTick = now; }
    refresh();
  }

  function azAt(e) {
    const box = cv.canvas.getBoundingClientRect();
    const x = e.clientX - box.left - LY.cx;
    const y = e.clientY - box.top - LY.cy;
    return { az: mod(Math.round(((Math.atan2(y, x) + Math.PI / 2) / (Math.PI * 2)) * RING)), d: Math.hypot(x, y) };
  }

  function crystalAt(e) {
    const box = cv.canvas.getBoundingClientRect();
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    for (let i = 0; i < 3; i++) {
      const c = LY.crys[i];
      if (Math.abs(x - c.x) < LY.s * 1.6 && Math.abs(y - c.y) < LY.s * 1.7) return i;
    }
    return -1;
  }

  on(holder, 'pointerdown', (e) => {
    takeTheChisel();
    const hit = crystalAt(e);
    if (hit >= 0) {
      focused = focused === hit ? -1 : hit;
      audio.ui('slide');
      refresh();
      ensureLoop();
      return;
    }
    const { az, d } = azAt(e);
    if (d > LY.R * 1.12) return;
    dragging = true;
    try { holder.setPointerCapture(e.pointerId); } catch { /* older engines */ }
    seat(az);
  });
  on(holder, 'pointermove', (e) => {
    if (!dragging) return;
    seat(azAt(e).az);
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    audio.ui('knock'); // the pointer seats in its detent
    ctx.note(T('noteBearing', { n: needle, airt: pointName(needle, Lp) }));
  };
  on(holder, 'pointerup', endDrag);
  on(holder, 'pointercancel', endDrag);

  on(send, 'click', () => {
    if (wet === null) return;
    const res = ctx.submit({ azimuth: needle, wet }) || {};
    if (!res.ok) {
      tell.textContent = (res.near && nearMapLocal[res.near]) || res.near || T('noAnswer');
      if (tell.scrollIntoView) tell.scrollIntoView({ block: 'nearest' });
    }
  });

  const onKey = (e) => {
    if (e.target && e.target.tagName === 'BUTTON') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { takeTheChisel(); seat(mod(needle + 1)); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { takeTheChisel(); seat(mod(needle - 1)); e.preventDefault(); }
    else if (e.key >= '1' && e.key <= '3') { takeTheChisel(); wet = Number(e.key) - 1; refresh(); e.preventDefault(); }
  };
  on(wrap, 'keydown', onKey);

  // resize: rebake the station at the new width (the wood must never stretch)
  const onResize = () => {
    const before = LY.W;
    layout();
    if (Math.abs(LY.W - before) < 24) { layout(); return; }
    rebake();
    remakeCanvas();
    draw();
  };
  if (typeof window !== 'undefined') on(window, 'resize', onResize);

  // ---- the showing ----
  function endShowing(quiet) {
    if (!showing) return;
    showing = false;
    skip.style.display = 'none';
    focused = -1;
    if (!quiet) say.textContent = '';
    refresh();
  }
  function takeTheChisel() {
    if (touched) return;
    touched = true;
    if (showing) endShowing(true);
  }
  on(skip, 'click', (e) => { e.stopPropagation(); takeTheChisel(); refresh(); });
  function startShowing() {
    if (ctx.solved) return;
    showing = true;
    focused = 0;
    demoT0 = (typeof performance !== 'undefined' ? performance.now() : 0);
    skip.style.display = '';
    say.textContent = T('demoSay');
    later(() => endShowing(false), 3000);
    ensureLoop();
  }

  // ---- mount ----
  layout();
  rebake();
  remakeCanvas();
  root.appendChild(wrap);

  ctx.note(T('open1'));
  ctx.note(T('open2', { a: instance.arcStart, b: mod(instance.arcStart + ARC - 1) }));
  instance.readings.forEach((r, i) => {
    const [a, b] = candidates(r);
    ctx.note(T('noteStone', { stone: stoneName(i), n: r, a, b }));
  });
  if (ctx.solved) {
    needle = truth.azimuth;
    wet = truth.wet;
  }
  refresh();
  if (ctx.solved) send.disabled = true;
  startShowing();
  draw();

  return {
    unmount() {
      unbind();
      for (const t of timers) clearTimeout(t);
      if (raf) cancelAnimationFrame(raf);
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------- i18n
// Additive per-lock block (docs/CONTRACT.md §4.1 amendment). English lives in
// the frozen fields; `nearMap` keys are verify()'s canonical English lines.
const I18N = {
  es: {
    title: 'El Rumbo de la Piedra de Sol',
    epigraph: 'La piedra nunca señala al sol. Señala a un cuarto de anillo, y no dice nada de a qué lado.',
    hints: [
      'Una lectura no es un rumbo. Cada piedra ofrece dos, y quedan opuestos entre sí sobre el anillo.',
      'La marca del día parte cada par por la mitad: solo uno de los dos puede estar donde el sol se alza en esta guardia.',
      'Reduce las tres piedras a su rumbo dentro de la marca del día. Dos concordarán; la discordante bebió el mar.',
    ],
    nearMap: {
      'That bearing lies outside the day-mark. The sun is not behind you.':
        'Ese rumbo cae fuera de la marca del día. El sol no está a tu espalda.',
      'Only 0 of the three stones admit that bearing.': 'Ninguna de las tres piedras admite ese rumbo.',
      'Only 1 of the three stones admit that bearing.': 'Solo una de las tres piedras admite ese rumbo.',
      'Only 2 of the three stones admit that bearing.': 'Solo dos de las tres piedras admiten ese rumbo.',
    },
    board: {
      plate: 'Tres piedras hablan; una miente mojada. Fija el rumbo en que las dos honradas concuerdan — dentro de la mitad de la marca del día.',
      stoneNames: ['la piedra de proa', 'la piedra del mástil', 'la piedra del timón'],
      read: 'leyó {n}',
      wet: 'mojada',
      wetAria: 'señalar {stone} como la piedra mojada',
      takeAria: 'tomar el rumbo {n}, {airt}',
      rowAria: '{stone}, leyó {n}: el sol está en {a} o en {b}',
      heading: 'Tres lecturas — toma un rumbo, marca la piedra mojada',
      submit: 'Jurar el rumbo',
      bearing: 'Rumbo {n} — {airt}',
      outside: ' (fuera de la marca del día)',
      dayMark: 'Marca del día: del punto {a} al punto {b} — {watch}.',
      watchMorning: 'la guardia de la mañana',
      watchEvening: 'la guardia de la tarde',
      watchNoon: 'la guardia del mediodía',
      watchMidnight: 'la guardia de la medianoche',
      lawParts: [
        ['La piedra muestra el anillo de luz ', 0],
        ['a un cuarto del anillo — 16 puntos — del sol', 1],
        [', sin decir nunca de qué lado: cada lectura arroja ', 0],
        ['dos hojas opuestas entre sí', 1],
        ['. ', 0],
        ['La marca del día', 1],
        [' — el cielo pintado en la banda del horizonte, del punto {a} al punto {b} — es la mitad del anillo donde el sol se alza en esta guardia; conserva una hoja de cada par. ', 0],
        ['Una piedra se leyó mojada', 1],
        [' y no dice nada cierto. Nombra el rumbo del sol, y nombra la piedra arruinada.', 0],
      ],
      skip: 'Saltar la muestra',
      demoSay: 'Mira una vez: una piedra alzada arroja sus dos rumbos sobre la rosa como hojas de luz.',
      focusSay: '{stone} se alza al cielo — sus hojas caen en {a} y {b}.',
      agree: 'Dos cuerdas relucen: dos piedras respaldan el punto {n}.',
      noteBearing: 'Rumbo puesto en el punto {n} — {airt}.',
      noteWet: '{stone} queda señalada como corrupta.',
      noteWetNone: 'Ninguna piedra queda señalada como corrupta.',
      open1: 'La piedra de sol muestra la banda polarizada, a un cuarto de anillo del sol: cada lectura admite dos rumbos, opuestos entre sí.',
      open2: 'Marca del día: el sol está entre el punto {a} y el punto {b} del anillo.',
      noteStone: '{stone} marca {n} — el sol está en {a} o en {b}.',
      sliderAria: 'rumbo del sol en el anillo de 64 puntos',
      valueText: 'punto {n}, {airt}',
      noAnswer: 'El mar no responde a ese rumbo.',
      half: ' y media',
      airts: [
        'norte', 'norte cuarta al nordeste', 'nornordeste', 'nordeste cuarta al norte',
        'nordeste', 'nordeste cuarta al este', 'estenordeste', 'este cuarta al nordeste',
        'este', 'este cuarta al sudeste', 'estesudeste', 'sudeste cuarta al este',
        'sudeste', 'sudeste cuarta al sur', 'sudsudeste', 'sur cuarta al sudeste',
        'sur', 'sur cuarta al sudoeste', 'sudsudoeste', 'sudoeste cuarta al sur',
        'sudoeste', 'sudoeste cuarta al oeste', 'oestesudoeste', 'oeste cuarta al sudoeste',
        'oeste', 'oeste cuarta al noroeste', 'oestenoroeste', 'noroeste cuarta al oeste',
        'noroeste', 'noroeste cuarta al norte', 'nornoroeste', 'norte cuarta al noroeste',
      ],
    },
  },
  ca: {
    title: 'El Rumb de la Pedra de Sol',
    epigraph: 'La pedra mai no assenyala el sol. Assenyala a un quart d’anell, i no diu res de cap a quin costat.',
    hints: [
      'Una lectura no és un rumb. Cada pedra n’ofereix dos, i queden oposats entre si sobre l’anell.',
      'La marca del dia parteix cada parell per la meitat: només un dels dos pot ser on el sol s’alça en aquesta guàrdia.',
      'Redueix les tres pedres al seu rumb dins la marca del dia. Dues concordaran; la discordant va beure el mar.',
    ],
    nearMap: {
      'That bearing lies outside the day-mark. The sun is not behind you.':
        'Aquest rumb cau fora de la marca del dia. El sol no és a la teva esquena.',
      'Only 0 of the three stones admit that bearing.': 'Cap de les tres pedres no admet aquest rumb.',
      'Only 1 of the three stones admit that bearing.': 'Només una de les tres pedres admet aquest rumb.',
      'Only 2 of the three stones admit that bearing.': 'Només dues de les tres pedres admeten aquest rumb.',
    },
    board: {
      plate: 'Tres pedres parlen; una menteix mullada. Fixa el rumb en què les dues honrades concorden — dins la meitat de la marca del dia.',
      stoneNames: ['la pedra de proa', 'la pedra del pal', 'la pedra del timó'],
      read: 'va llegir {n}',
      wet: 'mullada',
      wetAria: 'assenyalar {stone} com la pedra mullada',
      takeAria: 'prendre el rumb {n}, {airt}',
      rowAria: '{stone}, va llegir {n}: el sol és a {a} o a {b}',
      heading: 'Tres lectures — pren un rumb, marca la pedra mullada',
      submit: 'Jurar el rumb',
      bearing: 'Rumb {n} — {airt}',
      outside: ' (fora de la marca del dia)',
      dayMark: 'Marca del dia: del punt {a} al punt {b} — {watch}.',
      watchMorning: 'la guàrdia del matí',
      watchEvening: 'la guàrdia del vespre',
      watchNoon: 'la guàrdia del migdia',
      watchMidnight: 'la guàrdia de la mitjanit',
      lawParts: [
        ['La pedra mostra l’anell de llum ', 0],
        ['a un quart de l’anell — 16 punts — del sol', 1],
        [', sense dir mai de quin costat: cada lectura llança ', 0],
        ['dues fulles oposades entre si', 1],
        ['. ', 0],
        ['La marca del dia', 1],
        [' — el cel pintat a la banda de l’horitzó, del punt {a} al punt {b} — és la meitat de l’anell on el sol s’alça en aquesta guàrdia; conserva una fulla de cada parell. ', 0],
        ['Una pedra es va llegir mullada', 1],
        [' i no diu res de cert. Anomena el rumb del sol, i anomena la pedra arruïnada.', 0],
      ],
      skip: 'Saltar la mostra',
      demoSay: 'Mira-ho un cop: una pedra alçada llança els seus dos rumbs sobre la rosa com fulles de llum.',
      focusSay: '{stone} s’alça al cel — les seves fulles cauen a {a} i {b}.',
      agree: 'Dues cordes llueixen: dues pedres avalen el punt {n}.',
      noteBearing: 'Rumb posat al punt {n} — {airt}.',
      noteWet: '{stone} queda assenyalada com a corrupta.',
      noteWetNone: 'Cap pedra no queda assenyalada com a corrupta.',
      open1: 'La pedra de sol mostra la banda polaritzada, a un quart d’anell del sol: cada lectura admet dos rumbs, oposats entre si.',
      open2: 'Marca del dia: el sol és entre el punt {a} i el punt {b} de l’anell.',
      noteStone: '{stone} marca {n} — el sol és a {a} o a {b}.',
      sliderAria: 'rumb del sol a l’anell de 64 punts',
      valueText: 'punt {n}, {airt}',
      noAnswer: 'El mar no respon a aquest rumb.',
      half: ' i mitja',
      airts: [
        'nord', 'nord quarta a nord-est', 'nord-nord-est', 'nord-est quarta a nord',
        'nord-est', 'nord-est quarta a est', 'est-nord-est', 'est quarta a nord-est',
        'est', 'est quarta a sud-est', 'est-sud-est', 'sud-est quarta a est',
        'sud-est', 'sud-est quarta a sud', 'sud-sud-est', 'sud quarta a sud-est',
        'sud', 'sud quarta a sud-oest', 'sud-sud-oest', 'sud-oest quarta a sud',
        'sud-oest', 'sud-oest quarta a oest', 'oest-sud-oest', 'oest quarta a sud-oest',
        'oest', 'oest quarta a nord-oest', 'oest-nord-oest', 'nord-oest quarta a oest',
        'nord-oest', 'nord-oest quarta a nord', 'nord-nord-oest', 'nord quarta a nord-oest',
      ],
    },
  },
};

export default {
  id: ID,
  ordinal: 9,
  tier: 3,
  title: 'The Sunstone Bearing',
  epigraph: 'The stone never points at the sun. It points a quarter-ring away, and says nothing about which side.',

  makePuzzle,
  solve,
  verify,
  wrongAnswers,
  shard: () => ({ ...SHARDS[ID] }),

  difficulty: { searchSpace: 192, minSteps: 23, estMinutes: 14 },

  hints: [
    'A reading is not a bearing. Every stone offers two, and they stand opposite each other on the ring.',
    'The day-mark cuts each pair in half: only one of the two can be where the sun stands at this watch.',
    'Reduce all three stones to their day-mark bearing. Two will agree; the odd one out drank the sea.',
  ],

  i18n: I18N,

  mount,
};
