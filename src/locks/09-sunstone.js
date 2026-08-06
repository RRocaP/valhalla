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

function drawRose(art, size, instance, needle) {
  const { canvas, ctx } = art.makeCanvas(size, size);
  const P = art.palette;
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.42;
  art.paintWood(ctx, size, size, 793);
  // day-mark arc
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  const a0 = (instance.arcStart / RING) * Math.PI * 2 - Math.PI / 2;
  const a1 = ((instance.arcStart + ARC) / RING) * Math.PI * 2 - Math.PI / 2;
  ctx.arc(cx, cy, R * 1.02, a0, a1);
  ctx.closePath();
  ctx.fillStyle = 'rgba(201,162,39,0.14)';
  ctx.fill();
  ctx.restore();
  for (let i = 0; i < RING; i++) {
    const ang = (i / RING) * Math.PI * 2 - Math.PI / 2;
    const major = i % 8 === 0;
    const r0 = R * (major ? 0.82 : i % 2 === 0 ? 0.9 : 0.94);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
    ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
    ctx.strokeStyle = major ? P.goldBright : P.boneDim;
    ctx.lineWidth = major ? 2 : 1;
    ctx.stroke();
  }
  instance.readings.forEach((r, i) => {
    const ang = (r / RING) * Math.PI * 2 - Math.PI / 2;
    art.glow(ctx, cx + Math.cos(ang) * R * 0.72, cy + Math.sin(ang) * R * 0.72, size * 0.05, P.fjordLight, 0.7);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(ang) * R * 0.72, cy + Math.sin(ang) * R * 0.72, 4, 0, Math.PI * 2);
    ctx.fillStyle = P.fjordLight;
    ctx.fill();
    ctx.fillStyle = P.boneDim;
    ctx.font = '11px ui-monospace,Menlo,monospace';
    ctx.fillText(String(i + 1), cx + Math.cos(ang) * R * 0.62 - 3, cy + Math.sin(ang) * R * 0.62 + 4);
  });
  if (needle !== null) {
    const ang = (needle / RING) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * R * 0.98, cy + Math.sin(ang) * R * 0.98);
    ctx.strokeStyle = P.gold;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
    art.glow(ctx, cx + Math.cos(ang) * R * 0.98, cy + Math.sin(ang) * R * 0.98, size * 0.06, P.goldBright, 0.9);
  }
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}

function mount(ctx) {
  const { root, instance, art, audio } = ctx;
  const P = art.palette;
  // every listener is tracked so unmount can take them all back down
  const bound = [];
  const on = (el, type, fn) => { el.addEventListener(type, fn); bound.push([el, type, fn]); };
  const unbind = () => { for (const [el, type, fn] of bound) el.removeEventListener(type, fn); bound.length = 0; };
  const wrap = document.createElement('div');
  wrap.className = 'ow-lock ow-sunstone';
  const style = document.createElement('style');
  style.textContent = `
  .ow-sunstone{display:flex;flex-direction:column;gap:.6rem;color:${P.bone};
    font-family:'Iowan Old Style',Palatino,Georgia,serif;align-items:stretch}
  .ow-sunstone .rose{align-self:center}
  .ow-sunstone .stone{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;
    background:${P.oakDeep};border:1px solid ${P.tar};border-radius:4px;padding:.35rem .5rem}
  .ow-sunstone .stone .name{min-width:8.5ch;font-size:.85rem}
  .ow-sunstone button{background:${P.oak};color:${P.bone};border:1px solid ${P.oakLight};border-radius:3px;
    min-height:44px;min-width:44px;padding:.2rem .5rem;font:inherit;cursor:pointer}
  .ow-sunstone button[aria-pressed="true"]{border-color:${P.goldBright};color:${P.goldBright};background:${P.oakLight}}
  .ow-sunstone button:focus-visible{outline:2px solid ${P.goldBright};outline-offset:2px}
  .ow-sunstone .wet[aria-pressed="true"]{border-color:${P.blood};color:${P.blood}}
  .ow-sunstone .bearing{font-family:ui-monospace,Menlo,monospace;color:${P.goldBright}}
  .ow-sunstone .send{background:${P.gold};color:${P.tar};font-weight:600}
  .ow-sunstone h4{margin:.1rem 0 0;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:${P.boneDim}}
  .ow-sunstone .law{margin:0;font-size:.86rem;line-height:1.45;color:${P.boneDim};max-width:64ch}
  .ow-sunstone .law b{color:${P.bone};font-weight:600}
  .ow-sunstone .tell{margin:0;min-height:1.3em;font-size:.9rem;color:${P.ember};scroll-margin:28px}
  /* the shell sets \`#app *{min-width:0}\`, which outranks a bare class rule and
     flattens every touch target; this re-asserts the 44 px floor at equal weight */
  #app .ow-sunstone button{min-width:44px}`;
  wrap.appendChild(style);

  let needle = mod(instance.arcStart);
  let wet = null;
  let roseEl = null;

  const roseHolder = document.createElement('div');
  roseHolder.className = 'rose';
  roseHolder.tabIndex = 0;
  roseHolder.setAttribute('role', 'slider');
  roseHolder.setAttribute('aria-label', 'sun bearing on the 64-point ring');
  roseHolder.setAttribute('aria-valuemin', '0');
  roseHolder.setAttribute('aria-valuemax', '63');
  wrap.appendChild(roseHolder);

  const bearing = document.createElement('div');
  bearing.className = 'bearing';
  bearing.setAttribute('aria-live', 'polite');
  wrap.appendChild(bearing);

  // The day-mark is what makes this bearing nameable at all; it may not live
  // only in the journal and in an unlabelled shading on the rose.
  const law = document.createElement('p');
  law.className = 'law';
  for (const [text, strong] of [
    ['The stone shows the ring of light ', 0],
    ['a quarter of the ring — 16 points — from the sun', 1],
    [', and never says which side, so each reading admits two bearings opposite each other. ', 0],
    ['The day-mark', 1],
    [' — the shaded half of the rose — is the half of the ring the sun stands in this watch: ', 0],
    [`point ${instance.arcStart} to point ${mod(instance.arcStart + ARC - 1)}`, 1],
    ['. It keeps one bearing out of each pair. ', 0],
    ['One of the three stones was read wet', 1],
    [' and says nothing true. Name the sun’s bearing, and name the ruined stone.', 0],
  ]) law.appendChild(Object.assign(document.createElement(strong ? 'b' : 'span'), { textContent: text }));
  wrap.appendChild(law);

  const h1 = document.createElement('h4');
  h1.textContent = 'Three readings — take a bearing, mark the wet stone';
  wrap.appendChild(h1);

  const rows = instance.readings.map((r, i) => {
    const row = document.createElement('div');
    row.className = 'stone';
    const name = document.createElement('span');
    name.className = 'name';
    // show the raw reading beside the pair it opens: the ±16 law has to be
    // legible on the board, not only in the journal
    name.textContent = `${instance.stones[i]} read ${r} →`;
    row.appendChild(name);
    const cands = candidates(r).map((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${c}`;
      b.setAttribute('aria-label', `take bearing ${c}, ${airt(c)}`);
      b.setAttribute('aria-pressed', 'false');
      on(b, 'click', () => {
        needle = c;
        audio.ui('slide');
        ctx.note(`Bearing set to point ${c} — ${airt(c)}.`);
        refresh();
      });
      row.appendChild(b);
      return { b, c };
    });
    const w = document.createElement('button');
    w.type = 'button';
    w.className = 'wet';
    w.textContent = 'wet';
    w.setAttribute('aria-label', `call ${instance.stones[i]} the wet stone`);
    w.setAttribute('aria-pressed', 'false');
    on(w, 'click', () => {
      wet = wet === i ? null : i;
      audio.ui('flip');
      ctx.note(wet === i ? `${instance.stones[i]} is called corrupt.` : 'No stone is called corrupt.');
      refresh();
    });
    row.appendChild(w);
    return { row, cands, w, reading: r };
  });
  rows.forEach((r) => wrap.appendChild(r.row));

  const send = document.createElement('button');
  send.className = 'send';
  send.type = 'button';
  send.textContent = 'Swear the bearing';
  wrap.appendChild(send);

  // The shell's near-line sits below the fold on the taller locks; the sea
  // answers a wrong bearing where the player's eye already is.
  const tell = document.createElement('p');
  tell.className = 'tell';
  tell.setAttribute('aria-live', 'polite');
  wrap.appendChild(tell);

  function refresh() {
    if (roseEl) roseEl.remove();
    roseEl = drawRose(art, 240, instance, needle);
    roseHolder.appendChild(roseEl);
    roseHolder.setAttribute('aria-valuenow', String(needle));
    roseHolder.setAttribute('aria-valuetext', `point ${needle}, ${airt(needle)}`);
    const within = inArc(needle, instance.arcStart);
    bearing.textContent = `Bearing ${needle} — ${airt(needle)}${within ? '' : '  (outside the day-mark)'}`;
    bearing.style.color = within ? P.goldBright : P.blood;
    rows.forEach((r, i) => {
      r.cands.forEach((c) => c.b.setAttribute('aria-pressed', String(c.c === needle)));
      r.w.setAttribute('aria-pressed', String(wet === i));
    });
    send.disabled = wet === null;
  }

  on(send, 'click', () => {
    if (wet === null) return;
    const res = ctx.submit({ azimuth: needle, wet }) || {};
    if (!res.ok) { tell.textContent = res.near || 'The sea does not answer to that bearing.'; if (tell.scrollIntoView) tell.scrollIntoView({ block: 'nearest' }); }
  });

  const onKey = (e) => {
    if (e.target && e.target.tagName === 'BUTTON') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { needle = mod(needle + 1); refresh(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { needle = mod(needle - 1); refresh(); e.preventDefault(); }
    else if (e.key >= '1' && e.key <= '3') { wet = Number(e.key) - 1; refresh(); e.preventDefault(); }
  };
  on(wrap, 'keydown', onKey);

  root.appendChild(wrap);
  ctx.note('The sunstone shows the polarised band, a quarter-ring from the sun: each reading admits two bearings, opposite one another.');
  ctx.note(`Day-mark: the sun stands between point ${instance.arcStart} and point ${mod(instance.arcStart + ARC - 1)} of the ring.`);
  instance.readings.forEach((r, i) => {
    const [a, b] = candidates(r);
    ctx.note(`${instance.stones[i]} reads ${r} — the sun lies at ${a} or ${b}.`);
  });
  if (ctx.solved) {
    const t = solve(instance);
    needle = t.azimuth;
    wet = t.wet;
    send.disabled = true;
  }
  refresh();

  return {
    unmount() {
      unbind();
      wrap.remove();
    },
  };
}

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

  mount,
};
