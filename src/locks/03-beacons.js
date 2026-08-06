// 03 — THE BEACON NIGHTS (tier 1, teaching)
//
// Three coastal beacons burn on their own reckonings. Each was last lit some
// nights ago. Set the dial to the next night on which all three burn together.
//
// Pure half: no DOM, no globals, no Math.random, no Date. Only the seeded rng.
//
// Uniqueness: the three cycles are pairwise coprime, so the dial (which caps at
// their product, the lcm) holds exactly one night satisfying all three
// congruences. makePuzzle sweeps every night on the dial and requires one.
//
// Difficulty accounting: three cycles to read, three offsets to turn into
// congruences, and the dial to walk — ten deliberate actions before the answer
// stands, and no fire is lit by guessing.

import { SHARDS } from '../kernel/shards.js';

const CYCLES = [3, 4, 5, 7, 9, 11, 13];
const MIN_DIAL = 250;

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

// Every pairwise-coprime triple whose product makes a dial worth walking.
const TRIPLES = (() => {
  const out = [];
  for (let i = 0; i < CYCLES.length; i++) {
    for (let j = i + 1; j < CYCLES.length; j++) {
      for (let k = j + 1; k < CYCLES.length; k++) {
        const [a, b, c] = [CYCLES[i], CYCLES[j], CYCLES[k]];
        if (gcd(a, b) !== 1 || gcd(a, c) !== 1 || gcd(b, c) !== 1) continue;
        if (a * b * c < MIN_DIAL) continue;
        out.push([a, b, c]);
      }
    }
  }
  return out;
})();

const HEADLANDS = [
  'Skarvholm', 'Eldsnes', 'Hafnaberg', 'Kolgrimsey',
  'Vindstad', 'Nordfell', 'Grimsholm', 'Selvik',
];

const burnsOn = (beacon, night) => (night + beacon.lastBurned) % beacon.cycle === 0;
const allBurn = (instance, night) => instance.beacons.every((b) => burnsOn(b, night));

function makePuzzle(rng) {
  const cycles = rng.shuffle(rng.pick(TRIPLES));
  const names = rng.shuffle(HEADLANDS).slice(0, 3);
  const dialMax = cycles[0] * cycles[1] * cycles[2];

  // The night is drawn first, then the offsets are derived from it, so the
  // answer is never tomorrow and never inside the first turn of the longest cycle.
  const lo = Math.max(31, 2 * Math.max(...cycles) + 1);
  const night = rng.range(lo, dialMax);

  const beacons = cycles.map((cycle, i) => ({
    name: names[i],
    cycle,
    lastBurned: ((-night % cycle) + cycle) % cycle, // nights ago; 0 = tonight
  }));

  const instance = { beacons, dialMax };

  // Exhaustive uniqueness across the whole dial.
  let hits = 0;
  for (let t = 1; t <= dialMax; t++) if (allBurn(instance, t)) hits++;
  if (hits !== 1) return makePuzzle(rng);

  return instance;
}

function solve(instance) {
  for (let t = 1; t <= instance.dialMax; t++) if (allBurn(instance, t)) return { night: t };
  return { night: -1 };
}

function verify(instance, answer) {
  try {
    if (!instance || !Array.isArray(instance.beacons) || !Number.isInteger(instance.dialMax)) return { ok: false };
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
    const t = answer.night;
    if (!Number.isInteger(t)) return { ok: false };
    if (t < 1 || t > instance.dialMax) return { ok: false, near: 'The dial does not reach that night.' };

    const lit = instance.beacons.filter((b) => burnsOn(b, t)).length;
    if (lit === instance.beacons.length) return { ok: true };
    if (lit === 0) return { ok: false, near: 'No fire answers that night.' };
    if (lit === 1) return { ok: false, near: 'One fire answers that night. Two stand dark.' };
    return { ok: false, near: 'Two fires answer that night. One stands dark.' };
  } catch (e) {
    return { ok: false };
  }
}

// Next night at or after 1 on which every beacon in `set` burns, or -1.
function nextFor(instance, set) {
  for (let t = 1; t <= instance.dialMax; t++) {
    if (set.every((i) => burnsOn(instance.beacons[i], t))) return t;
  }
  return -1;
}

function wrongAnswers(instance) {
  const right = solve(instance).night;
  const cand = [
    right - 1, right + 1,
    nextFor(instance, [0]), nextFor(instance, [1]), nextFor(instance, [2]),
    nextFor(instance, [0, 1]), nextFor(instance, [0, 2]), nextFor(instance, [1, 2]),
    instance.dialMax,
    instance.beacons.reduce((s, b) => s + b.cycle, 0),
    right + instance.beacons[0].cycle,
    right - instance.beacons[1].cycle,
    right + instance.beacons[2].cycle,
  ];
  const out = [];
  const seen = new Set();
  for (const t of cand) {
    if (!Number.isInteger(t) || t === right || t < 1 || t > instance.dialMax || seen.has(t)) continue;
    seen.add(t);
    out.push({ night: t });
  }
  return out;
}

// ------------------------------------------------------------------ the view
//
// The board is a coast and a wheel. The coast is carved relief: three headlands
// rising out of a carved sea, a beacon tower on each — an iron fire-cage on a
// braced post — with the headland's reckoning cut into a plaque below it. The
// wheel is the night-dial: a bone index blade fixed at the top, moon phases
// riding the rim, and one carved orbit track per beacon, notched night by
// night, with an ember burning on every night that beacon's cycle fires.
//
// BotW law (docs/QUALITY.md progression-feel): turning the wheel IS the answer
// verb, so the wheel must answer like the answer. Each detent ticks and kicks
// the blade; the coast lights and dies live under the pointer; and a night that
// lights two of three burns them BOTH, visibly, so the near-miss teaches
// alignment by being watched rather than by being read.

const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";
const MONO = "ui-monospace,'SF Mono',Menlo,monospace";
const WINDOW = 31;             // nights carried on one turn of the wheel
const SYNODIC = 29.530588;     // the moon the wheel keeps
const TAU = Math.PI * 2;

// Board copy. English is the source; es/ca live in the additive i18n block
// (docs/CONTRACT.md §4.1 amendment) and are resolved through it at mount.
const BOARD_EN = {
  plate: 'Turn the dial to the next night all three fires burn together.',
  law: 'Tonight is night nought; the dial runs to night {max}.',
  keys: 'Drag the wheel, or use the arrow keys.',
  submit: 'Set the dial',
  submitDone: 'The dial is set',
  skip: 'Skip the showing',
  demoSay: 'Watch once: the wheel turns two nights, and the coast answers.',
  reckonings: 'THE RECKONINGS',
  thisNight: 'THIS NIGHT',
  everyN: 'every {n} nights',
  agoTonight: 'burned tonight',
  agoOne: 'burned 1 night ago',
  agoN: 'burned {n} nights ago',
  againIn: 'again in {n}',
  againNow: 'burning now',
  nightsHence: 'nights hence',
  tally0: 'NO FIRE',
  tally1: 'ONE OF THREE',
  tally2: 'TWO OF THREE',
  tally3: 'ALL THREE BURN',
  burns: '{name} burns',
  isDark: '{name} is dark',
  nightLine: 'Night {n} — {parts}.',
  solvedLine: 'All three burned together on night {n}.',
  setLine: 'The dial is set to night {n}.',
  ariaDial: 'The night dial',
  ariaCoast: 'The beacon coast. {list}',
  coastItem: '{name}, every {n} nights, {when}',
  keysNote: 'By key: left and right walk one night; up and down leap ten; the page keys leap {longest}; Home and End run to the dial’s ends; Enter sets the dial.',
  openLine: 'Three beacons, three reckonings: {list}. The dial runs from night 1 to night {max}.',
  soughtLine: 'Sought: the next night on which all three burn as one.',
};

// View-side colour maths (the frozen art API exposes palette tokens, not mixing).
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sa, sb) => Math.round(sa + (sb - sa) * t);
  const r = ch(pa >> 16, pb >> 16);
  const g = ch((pa >> 8) & 255, (pb >> 8) & 255);
  const bl = ch(pa & 255, pb & 255);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}
function withA(hex, a) {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`;
}
// deterministic per-index noise — view-only, the pure half never sees it
function h32(n) {
  let x = (n | 0) + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}

function mount(ctx) {
  const art = ctx.art;
  const p = art.palette;
  const instance = ctx.instance;
  const lang = ctx.lang || 'en';
  const L = (I18N[lang] && I18N[lang].board) || {};
  const T = (key, params) => {
    let s = key in L ? L[key] : BOARD_EN[key];
    if (params) for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]));
    return s;
  };
  const fires = [p.blood, p.fjordLight, p.pineLight];
  const IRON = mixHex(p.tar, p.boneDim, 0.34);
  const IRON_LIT = mixHex(p.tar, p.boneDim, 0.62);
  const has = (k) => typeof art[k] === 'function';

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
  const now = () => (typeof performance === 'object' && performance && typeof performance.now === 'function'
    ? performance.now() : Date.now());

  const reduced = () => {
    try { return !!(globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  };
  const calm = reduced();

  // ---- state -------------------------------------------------------------
  let night = ctx.solved ? solve(instance).night : 1;
  const longest = Math.max(...instance.beacons.map((b) => b.cycle));
  let keysSaid = false;
  let flick = 0;            // ember flicker phase (rAF-driven, static when calm)
  let detentAt = -1e9;      // when the last detent landed
  let detentDir = 1;
  let nearDark = null;      // beacons standing dark at the refused night
  let touched = false;      // the player has taken the wheel
  const demo = { active: false, t0: 0, stepped: 0, still: false };

  // hash-flicker: cheap, stateless, different per flame
  const jit = (k) => {
    const x = Math.sin((flick * 0.61 + k * 12.9898) * 43758.5453);
    return x - Math.floor(x);
  };

  const burnsHere = (b, t) => t >= 1 && (t + b.lastBurned) % b.cycle === 0;
  const litCount = (t) => instance.beacons.filter((b) => burnsHere(b, t)).length;
  const litSet = (t) => instance.beacons.map((b, i) => (burnsHere(b, t) ? i : -1)).filter((i) => i >= 0);
  const phaseOf = (b, t) => ((t + b.lastBurned) % b.cycle + b.cycle) % b.cycle;
  const untilBurn = (b, t) => (b.cycle - phaseOf(b, t)) % b.cycle;
  const moonPhase = (t) => ((t % SYNODIC) + SYNODIC) % SYNODIC / SYNODIC;
  const whenText = (b) => (b.lastBurned === 0 ? T('agoTonight')
    : b.lastBurned === 1 ? T('agoOne') : T('agoN', { n: b.lastBurned }));

  // ---- sizing ------------------------------------------------------------
  const hostW = (() => {
    const raw = (ctx.root && ctx.root.clientWidth) || 0;
    const w = raw > 40 ? raw - 10 : (globalThis.innerWidth || 800) - 60;
    return Math.max(288, Math.min(756, Math.round(w)));
  })();
  const narrow = hostW < 470;
  const COAST_W = hostW;
  const COAST_H = narrow ? 158 : 164;
  const DIAL_W = hostW;
  const DIAL_H = narrow ? 282 : 292;
  const R = Math.round(DIAL_H / 2 - 10);            // the wheel's carved edge
  const DCX = DIAL_W / 2;
  const DCY = DIAL_H / 2;
  const FLANK = !narrow && DCX - R > 150;           // room for the side plaques
  const step = TAU / WINDOW;
  const half = (WINDOW - 1) / 2;

  // ---- DOM ---------------------------------------------------------------
  const wrap = node('div', `display:grid;gap:9px;justify-items:center;font-family:${SERIF};color:${p.bone}`);
  const style = node('style');
  style.textContent = `
    .ow3-dial{touch-action:none;cursor:grab;outline-offset:4px;border-radius:8px}
    .ow3-dial:focus-visible{outline:2px solid ${p.goldBright}}
    .ow3-dial[data-turning="1"]{cursor:grabbing}
    .ow3-coast{border-radius:6px}
    .ow3-plate{margin:0;width:100%;box-sizing:border-box;padding:9px 18px;text-align:center;border-radius:4px;
      font-size:15px;line-height:1.42;color:${p.bone};
      background:linear-gradient(180deg,${withA(p.tar, 0.58)},${withA(p.oakDeep, 0.44)});
      border:1px solid ${withA(p.gold, 0.34)};
      box-shadow:inset 0 1px 0 ${withA(p.bone, 0.1)},0 2px 7px ${withA(p.tar, 0.5)};
      text-shadow:0 -1px 0 ${withA(p.tar, 0.9)},0 1px 0 ${withA(p.goldBright, 0.18)}}
    .ow3-plate span{display:block;margin-top:5px;font-size:12.5px;line-height:1.4;color:${p.boneDim};text-shadow:none}
    .ow3-bar{display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap}
    .ow3-skip{font-family:${SERIF};font-size:14px;color:${p.boneDim};background:transparent;
      border:1px solid ${withA(p.oakLight, 0.9)};border-radius:3px;padding:0 16px;min-height:44px;min-width:44px;cursor:pointer}
    .ow3-skip:hover{color:${p.bone};border-color:${p.gold}}
    .ow3-skip:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
  `;
  wrap.append(style);

  const plate = node('p');
  plate.className = 'ow3-plate';
  plate.append(document.createTextNode(T('plate')));
  plate.append(node('span', null,
    `${T('law', { max: instance.dialMax })} ${T('keys', { longest })}`));

  const coast = art.makeCanvas(COAST_W, COAST_H);
  coast.canvas.className = 'ow3-coast';
  coast.canvas.style.maxWidth = '100%';
  coast.canvas.style.height = 'auto';
  coast.canvas.setAttribute('role', 'img');

  const gfx = art.makeCanvas(DIAL_W, DIAL_H);
  gfx.canvas.className = 'ow3-dial';
  gfx.canvas.style.maxWidth = '100%';
  gfx.canvas.style.height = 'auto';
  gfx.canvas.setAttribute('tabindex', '0');
  gfx.canvas.setAttribute('role', 'slider');
  gfx.canvas.setAttribute('aria-label', T('ariaDial'));
  gfx.canvas.setAttribute('aria-valuemin', '1');
  gfx.canvas.setAttribute('aria-valuemax', String(instance.dialMax));

  const submitBtn = node('button', null, T('submit'));
  submitBtn.className = 'btn-carved'; // one primary-action language: the carved gold plate
  submitBtn.type = 'button';
  const skipBtn = node('button', null, T('skip'));
  skipBtn.className = 'ow3-skip';
  skipBtn.type = 'button';
  skipBtn.style.display = 'none';
  const bar = node('div');
  bar.className = 'ow3-bar';
  bar.append(submitBtn, skipBtn);

  const status = node('p', `margin:0;min-height:20px;font-size:14px;color:${p.boneDim};text-align:center`);
  status.setAttribute('aria-live', 'polite');

  wrap.append(plate, coast.canvas, gfx.canvas, bar, status);
  ctx.root.append(wrap);

  // ---- carving primitives -------------------------------------------------

  // three-pass carved line: shade lip against the key, catch light with it,
  // crisp incision on top (the art module's carveStroke is internal to it)
  function carve(c, pathFn, width, opts = {}) {
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    c.translate(-0.9, -1.1);
    c.strokeStyle = withA(opts.shadow || p.tar, opts.shadowA ?? 0.55);
    c.lineWidth = width * 2.1;
    c.beginPath(); pathFn(c); c.stroke(); c.restore();
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    c.translate(0.9, 1.1);
    c.strokeStyle = withA(opts.lift || p.oakLight, opts.liftA ?? 0.4);
    c.lineWidth = width * 1.6;
    c.beginPath(); pathFn(c); c.stroke(); c.restore();
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = withA(opts.core || p.tar, opts.coreA ?? 0.9);
    c.lineWidth = width;
    c.beginPath(); pathFn(c); c.stroke(); c.restore();
  }

  // a carved bone moon: sunk socket, unlit body, lit face shaped by the phase,
  // a rim incision and two maria pits so it reads as ivory inlay, not a circle
  function moon(c, x, y, r, phase, opts = {}) {
    const a = opts.alpha ?? 1;
    c.save();
    c.globalAlpha = a;
    c.fillStyle = withA(p.tar, 0.75);
    c.beginPath(); c.arc(x + r * 0.06, y + r * 0.1, r * 1.16, 0, TAU); c.fill();
    const dark = mixHex(p.tar, p.fjord, 0.55);
    c.fillStyle = dark;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    const face = opts.face || p.bone;
    const k = Math.cos(phase * TAU);            // +1 new, -1 full
    c.save();
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
    c.fillStyle = face;
    c.beginPath();
    if (phase < 0.5) c.arc(x, y, r, -Math.PI / 2, Math.PI / 2);
    else c.arc(x, y, r, Math.PI / 2, -Math.PI / 2);
    c.closePath(); c.fill();
    c.fillStyle = k < 0 ? face : dark;
    c.beginPath();
    c.ellipse(x, y, Math.max(0.2, Math.abs(k) * r), r, 0, 0, TAU);
    c.fill();
    // earthshine: the unlit body is not a hole, it is ash-grey ivory
    c.globalAlpha = a * 0.11;
    c.fillStyle = face;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.globalAlpha = a;
    // the bright limb: the sunward edge of the lit face catches hardest
    c.strokeStyle = withA(mixHex(face, '#ffffff', 0.5), 0.9);
    c.lineWidth = Math.max(0.8, r * 0.14);
    c.beginPath();
    if (phase < 0.5) c.arc(x, y, r * 0.93, -Math.PI * 0.42, Math.PI * 0.42);
    else c.arc(x, y, r * 0.93, Math.PI * 0.58, Math.PI * 1.42);
    c.stroke();
    // maria: two shallow pits, only where the face is lit
    c.globalAlpha = a * 0.16;
    c.fillStyle = p.oakDeep;
    c.beginPath(); c.arc(x - r * 0.28, y - r * 0.2, r * 0.26, 0, TAU); c.fill();
    c.beginPath(); c.arc(x + r * 0.22, y + r * 0.3, r * 0.18, 0, TAU); c.fill();
    c.restore();
    carve(c, (g) => g.arc(x, y, r, 0, TAU), Math.max(0.7, r * 0.1), { liftA: 0.34 });
    c.restore();
  }

  // a tongue of fire: coloured body, gold heart, flicker-led sway
  function flame(c, x, y, s, colour, seed, glowR) {
    const sway = (jit(seed) - 0.5) * s * 0.5;
    const lift = 1 + (jit(seed + 7) - 0.5) * 0.28;
    if (glowR && has('glow')) {
      try { art.glow(c, x, y, glowR * (0.85 + jit(seed + 3) * 0.3), colour, 0.6 + jit(seed + 5) * 0.3); }
      catch (e) { /* stub */ }
    }
    c.save();
    c.beginPath();
    c.moveTo(x - s * 0.55, y + s * 0.5);
    c.quadraticCurveTo(x - s * 0.62, y - s * 0.15, x + sway * 0.4, y - s * 0.55 * lift);
    c.quadraticCurveTo(x + sway, y - s * 1.05 * lift, x + sway * 0.6, y - s * 0.5 * lift);
    c.quadraticCurveTo(x + s * 0.62, y - s * 0.1, x + s * 0.55, y + s * 0.5);
    c.closePath();
    c.fillStyle = colour;
    c.fill();
    c.beginPath();
    c.moveTo(x - s * 0.24, y + s * 0.42);
    c.quadraticCurveTo(x - s * 0.26, y - s * 0.05, x + sway * 0.5, y - s * 0.34 * lift);
    c.quadraticCurveTo(x + s * 0.26, y - s * 0.02, x + s * 0.24, y + s * 0.42);
    c.closePath();
    c.fillStyle = p.goldBright;
    c.fill();
    // sparks lifting off the cage
    c.globalAlpha = 0.7;
    for (let i = 0; i < 3; i++) {
      const q = jit(seed + 11 + i);
      c.fillStyle = i % 2 ? p.goldBright : p.ember;
      c.beginPath();
      c.arc(x + (q - 0.5) * s * 1.5, y - s * (1.1 + q * 1.5), Math.max(0.6, s * 0.09), 0, TAU);
      c.fill();
    }
    c.restore();
  }

  // an iron fire-cage: bowl, uprights, two hoops, rivets. Lit ones hold coals
  // and a flame; dark ones hold cold ash, so a dark beacon still reads as iron.
  function fireCage(c, x, y, s, lit, idx, opts = {}) {
    const w = s * 1.15;
    c.save();
    // bracket the cage hangs in
    c.strokeStyle = withA(IRON, 0.95);
    c.lineWidth = Math.max(1.2, s * 0.16);
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x - w * 0.5, y + s * 0.5); c.lineTo(x + w * 0.5, y + s * 0.5);
    c.stroke();
    // bowl
    c.beginPath();
    c.moveTo(x - w * 0.5, y - s * 0.15);
    c.quadraticCurveTo(x, y + s * 0.95, x + w * 0.5, y - s * 0.15);
    c.closePath();
    const bowl = c.createLinearGradient(x - w * 0.5, y - s * 0.3, x + w * 0.5, y + s * 0.7);
    bowl.addColorStop(0, IRON_LIT);
    bowl.addColorStop(0.45, IRON);
    bowl.addColorStop(1, p.tar);
    c.fillStyle = bowl;
    c.fill();
    c.strokeStyle = withA(p.tar, 0.9);
    c.lineWidth = Math.max(0.8, s * 0.1);
    c.stroke();
    // uprights of the cage
    c.strokeStyle = withA(IRON, 0.92);
    c.lineWidth = Math.max(0.9, s * 0.11);
    for (let i = -2; i <= 2; i++) {
      const fx = x + (i / 2) * w * 0.46;
      c.beginPath();
      c.moveTo(fx, y + s * 0.42 - Math.abs(i) * s * 0.1);
      c.lineTo(x + (i / 2) * w * 0.6, y - s * 0.72);
      c.stroke();
    }
    // hoops
    c.lineWidth = Math.max(0.8, s * 0.1);
    for (const hy of [y - s * 0.62, y - s * 0.14]) {
      c.beginPath();
      c.ellipse(x, hy, w * (hy < y - s * 0.4 ? 0.58 : 0.5), s * 0.16, 0, 0, TAU);
      c.stroke();
    }
    // lit arris on the rings so the iron catches the hearth
    c.strokeStyle = withA(p.boneDim, 0.4);
    c.lineWidth = Math.max(0.5, s * 0.055);
    c.beginPath();
    c.ellipse(x - s * 0.06, y - s * 0.66, w * 0.56, s * 0.15, 0, Math.PI * 0.9, Math.PI * 1.9);
    c.stroke();
    // rivets
    for (const [rx, ry] of [[x - w * 0.5, y - s * 0.14], [x + w * 0.5, y - s * 0.14]]) {
      c.fillStyle = IRON_LIT;
      c.beginPath(); c.arc(rx, ry, Math.max(0.9, s * 0.11), 0, TAU); c.fill();
      c.fillStyle = withA(p.tar, 0.7);
      c.beginPath(); c.arc(rx + 0.4, ry + 0.5, Math.max(0.4, s * 0.05), 0, TAU); c.fill();
    }
    // the fire itself
    if (lit) {
      for (let i = 0; i < 4; i++) {
        const q = jit(idx * 17 + i);
        c.fillStyle = mixHex(p.ember, p.goldBright, 0.25 + q * 0.5);
        c.beginPath();
        c.arc(x + (i - 1.5) * s * 0.26, y + s * 0.14 + (q - 0.5) * s * 0.1, s * 0.13, 0, TAU);
        c.fill();
      }
      flame(c, x, y - s * 0.1, s * 0.92, opts.colour || p.ember, idx * 31 + 5, s * 2.4);
    } else {
      c.fillStyle = withA(p.boneDim, 0.16);
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.arc(x + (i - 1) * s * 0.3, y + s * 0.16, s * 0.11, 0, TAU);
        c.fill();
      }
    }
    c.restore();
  }

  // ---- the coast ---------------------------------------------------------
  const M = narrow ? 11 : 15;
  const SX = M, SY = M, SW = COAST_W - M * 2, SH = COAST_H - M * 2;
  const horizon = SY + SH * 0.28;
  const shoreY = SY + SH * 0.56;
  const plaqTop = SY + SH * 0.595;
  const plaqH = SY + SH - plaqTop - 4;
  const stationX = [0.175, 0.5, 0.825].map((f) => SX + SW * f);
  const moonX = SX + SW * 0.945;
  const moonY = SY + SH * 0.115;
  const moonR = narrow ? 11 : 13;
  // plaque rows, measured from the plaque's own top
  const ROW = narrow
    ? { name: 12, size: 11.5, every: 23, ago: 33, mono: 9.5, tick: 45 }
    : { name: 13, size: 13.5, every: 24, ago: 33, mono: 10.5, tick: 46 };

  const landY = (x) => {
    let y = shoreY;
    for (let i = 0; i < 3; i++) {
      const d = (x - stationX[i]) / (SW * 0.115);
      y -= Math.exp(-d * d) * SH * 0.12;
    }
    return y + Math.sin((x - SX) * 0.07) * SH * 0.014 + Math.sin((x - SX) * 0.21) * SH * 0.006;
  };
  const towerH = SH * 0.30;
  const cageS = narrow ? 8.5 : 10;

  let coastSlab = null;
  function coastSlabFor() {
    if (coastSlab) return coastSlab;
    const off = art.makeCanvas(COAST_W, COAST_H);
    const c = off.ctx;
    art.paintWood(c, COAST_W, COAST_H, 331);
    if (has('hearth')) art.hearth(c, COAST_W, COAST_H, { strength: 0.5, y: 0.26 });
    // dead-zone law: the wood margin carries quiet tool history, never the scene
    if (has('wear')) art.wear(c, COAST_W, COAST_H, 'coast-03', { avoid: { x: SX - 3, y: SY - 3, w: SW + 6, h: SH + 6 } });
    if (has('chipBorder')) art.chipBorder(c, 4, 3, COAST_W - 8, COAST_H - 6, { size: Math.max(6, M * 0.62), alpha: 0.5 });
    if (has('rosette')) {
      for (const [rx, ry] of [[M * 0.52, M * 0.52], [COAST_W - M * 0.52, M * 0.52],
        [M * 0.52, COAST_H - M * 0.52], [COAST_W - M * 0.52, COAST_H - M * 0.52]]) {
        art.rosette(c, rx, ry, M * 0.44, { alpha: 0.8 });
      }
    }
    art.paintPanel(c, SX, SY, SW, SH, { seed: 'beacon-coast', wash: 0.72, nails: true });

    c.save();
    c.beginPath();
    c.rect(SX + 2, SY + 2, SW - 4, SH - 4);
    c.clip();

    // the night sky, cut deep, with star pricks
    const sky = c.createLinearGradient(0, SY, 0, horizon + 6);
    sky.addColorStop(0, withA(p.tar, 0.86));
    sky.addColorStop(1, withA(mixHex(p.tar, p.fjord, 0.55), 0.7));
    c.fillStyle = sky;
    c.fillRect(SX, SY, SW, horizon - SY + 6);
    for (let i = 0; i < 46; i++) {
      const sx = SX + h32(i * 3 + 1) * SW;
      const sy = SY + 4 + h32(i * 3 + 2) * (horizon - SY - 8);
      const s = 0.5 + h32(i * 3 + 3) * 1.2;
      if (Math.abs(sx - moonX) < moonR * 2.4 && Math.abs(sy - moonY) < moonR * 2.4) continue;
      c.fillStyle = withA(p.tar, 0.5);
      c.beginPath(); c.arc(sx + 0.4, sy + 0.5, s * 1.5, 0, TAU); c.fill();
      c.fillStyle = withA(p.bone, 0.32 + h32(i * 7) * 0.42);
      c.beginPath(); c.arc(sx, sy, s, 0, TAU); c.fill();
    }
    // the moon's glimmer path, carved down the water
    const glim = c.createLinearGradient(0, horizon, 0, shoreY + SH * 0.1);
    glim.addColorStop(0, withA(p.bone, 0.13));
    glim.addColorStop(1, withA(p.bone, 0));
    c.fillStyle = glim;
    c.beginPath();
    c.moveTo(moonX - 5, horizon);
    c.lineTo(moonX + 5, horizon);
    c.lineTo(moonX + SW * 0.06, shoreY + SH * 0.12);
    c.lineTo(moonX - SW * 0.06, shoreY + SH * 0.12);
    c.closePath();
    c.fill();

    // the sea: a deep field with carved swells at three depths
    const sea = c.createLinearGradient(0, horizon, 0, SY + SH);
    sea.addColorStop(0, withA(p.fjord, 0.62));
    sea.addColorStop(1, withA(p.tar, 0.86));
    c.fillStyle = sea;
    c.fillRect(SX, horizon, SW, SY + SH - horizon);
    for (let row = 0; row < 8; row++) {
      const t = row / 7;
      const y = horizon + 4 + t * (SH * 0.20);
      const amp = 1.1 + t * 2.4;
      const wl = 24 + t * 30;
      carve(c, (g) => {
        g.moveTo(SX, y);
        for (let x = SX; x <= SX + SW; x += 6) g.lineTo(x, y + Math.sin((x + row * 21) / wl) * amp);
      }, 0.9 + t * 0.8, { coreA: 0.42 + t * 0.24, liftA: 0.2 + t * 0.2, lift: p.fjordLight });
      // foam catching the moon on the crests of the nearer swells
      if (row >= 4) {
        c.save();
        c.strokeStyle = withA(p.bone, 0.09 + t * 0.12);
        c.lineWidth = 1.1;
        c.lineCap = 'round';
        for (let x = SX + 4; x < SX + SW - 4; x += 17) {
          const q = h32(row * 97 + x);
          if (q < 0.45) continue;
          const yy = y + Math.sin((x + row * 21) / wl) * amp - amp * 0.7;
          c.beginPath();
          c.moveTo(x, yy);
          c.lineTo(x + 4 + q * 7, yy - 0.5);
          c.stroke();
        }
        c.restore();
      }
    }
    // a lone knarr on the water, far out — scale for the coast
    {
      const bx = SX + SW * 0.335;
      const by = horizon + SH * 0.11;
      const bs = SH * 0.055;
      c.save();
      c.strokeStyle = withA(p.tar, 0.85);
      c.lineWidth = 1.1;
      c.fillStyle = withA(p.oakDeep, 0.9);
      c.beginPath();
      c.moveTo(bx - bs, by);
      c.quadraticCurveTo(bx, by + bs * 0.55, bx + bs, by);
      c.closePath(); c.fill(); c.stroke();
      c.beginPath();
      c.moveTo(bx, by); c.lineTo(bx, by - bs * 1.25);
      c.stroke();
      c.fillStyle = withA(p.boneDim, 0.5);
      c.beginPath();
      c.moveTo(bx - bs * 0.55, by - bs * 0.15);
      c.lineTo(bx + bs * 0.55, by - bs * 0.15);
      c.lineTo(bx, by - bs * 1.15);
      c.closePath(); c.fill();
      c.restore();
    }

    // the land: a carved relief mass, incised above, catching light below
    c.beginPath();
    c.moveTo(SX, SY + SH);
    for (let x = SX; x <= SX + SW; x += 4) c.lineTo(x, landY(x));
    c.lineTo(SX + SW, SY + SH);
    c.closePath();
    const land = c.createLinearGradient(0, shoreY - SH * 0.15, 0, SY + SH);
    land.addColorStop(0, mixHex(p.oak, p.oakLight, 0.3));
    land.addColorStop(0.45, p.oak);
    land.addColorStop(1, mixHex(p.oakDeep, p.tar, 0.45));
    c.fillStyle = land;
    c.fill();
    // grain running along the headlands
    c.save();
    c.clip();
    for (let i = 0; i < 34; i++) {
      const off2 = 3 + h32(i * 13 + 5) * (SH * 0.34);
      c.strokeStyle = withA(h32(i) > 0.6 ? p.oakLight : p.oakDeep, 0.14 + h32(i * 5) * 0.13);
      c.lineWidth = 0.7 + h32(i * 9) * 1.1;
      c.beginPath();
      const x0 = SX + h32(i * 3) * SW * 0.5;
      const x1 = x0 + SW * (0.2 + h32(i * 11) * 0.45);
      for (let x = x0; x <= x1; x += 7) c.lineTo(x, landY(x) + off2 + Math.sin(x * 0.06) * 1.2);
      c.stroke();
    }
    // strata: the headlands are cut rock, so the relief carries bedding lines
    for (let s = 1; s <= 4; s++) {
      const off2 = s * (SH * 0.038);
      carve(c, (g) => {
        g.moveTo(SX, landY(SX) + off2);
        for (let x = SX; x <= SX + SW; x += 6) g.lineTo(x, landY(x) + off2 + Math.sin(x * 0.09) * 1.3);
      }, 1.1, { coreA: 0.55, liftA: 0.4, lift: mixHex(p.oakLight, p.goldBright, 0.35) });
    }
    // chipped rock: scree along the shoulders of the headlands
    for (let i = 0; i < 34; i++) {
      const x = SX + h32(i * 31 + 7) * SW;
      const y = landY(x) + 3 + h32(i * 17 + 3) * (SH * 0.14);
      const s = 1.8 + h32(i * 5) * 2.8;
      c.save();
      c.fillStyle = withA(p.tar, 0.5);
      c.beginPath();
      c.moveTo(x, y - s); c.lineTo(x + s, y + s * 0.6); c.lineTo(x - s, y + s * 0.6);
      c.closePath(); c.fill();
      c.strokeStyle = withA(mixHex(p.oakLight, p.goldBright, 0.4), 0.36);
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(x - s, y + s * 0.6); c.lineTo(x + s, y + s * 0.6);
      c.lineTo(x, y - s);
      c.stroke();
      c.restore();
    }
    c.restore();
    // the coastline itself: incision above, catch light below
    carve(c, (g) => {
      g.moveTo(SX, landY(SX));
      for (let x = SX; x <= SX + SW; x += 4) g.lineTo(x, landY(x));
    }, 1.6, { coreA: 0.85, liftA: 0.55, lift: mixHex(p.oakLight, p.goldBright, 0.4) });
    // surf where the water meets the relief
    c.strokeStyle = withA(p.bone, 0.3);
    c.lineWidth = 1.3;
    c.beginPath();
    for (let x = SX; x <= SX + SW; x += 5) {
      const y = landY(x) + 1.5 + Math.sin(x * 0.32) * 1.3;
      if (x === SX) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
    c.strokeStyle = withA(p.bone, 0.12);
    c.lineWidth = 2.6;
    c.stroke();

    // the three towers: braced posts with the cage bracket, carved
    instance.beacons.forEach((b, i) => {
      const x = stationX[i];
      const base = landY(x) + 3;
      const top = base - towerH;
      c.save();
      // cast shadow down the headland
      c.fillStyle = withA(p.tar, 0.4);
      c.beginPath();
      c.ellipse(x + 5, base + 2, towerH * 0.16, towerH * 0.05, 0, 0, TAU);
      c.fill();
      // post
      c.beginPath();
      c.moveTo(x - 4.2, base); c.lineTo(x - 2.4, top);
      c.lineTo(x + 2.4, top); c.lineTo(x + 4.2, base);
      c.closePath();
      const postG = c.createLinearGradient(x - 5, 0, x + 5, 0);
      postG.addColorStop(0, mixHex(p.oakDeep, p.tar, 0.3));
      postG.addColorStop(0.4, p.oak);
      postG.addColorStop(1, mixHex(p.oakDeep, p.tar, 0.5));
      c.fillStyle = postG;
      c.fill();
      carve(c, (g) => {
        g.moveTo(x - 4.2, base); g.lineTo(x - 2.4, top);
        g.moveTo(x + 4.2, base); g.lineTo(x + 2.4, top);
      }, 1, { coreA: 0.7, liftA: 0.42, lift: mixHex(p.oakLight, p.goldBright, 0.25) });
      // braces
      c.strokeStyle = withA(p.oakDeep, 0.95);
      c.lineWidth = 2.4;
      const by0 = base - towerH * 0.22;
      c.beginPath();
      c.moveTo(x - 11, base); c.lineTo(x - 1.5, by0);
      c.moveTo(x + 11, base); c.lineTo(x + 1.5, by0);
      c.stroke();
      c.strokeStyle = withA(mixHex(p.oakLight, p.goldBright, 0.2), 0.34);
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(x - 11, base - 1); c.lineTo(x - 1.5, by0 - 1);
      c.moveTo(x + 11, base - 1); c.lineTo(x + 1.5, by0 - 1);
      c.stroke();
      if (has('ornament')) {
        art.ornament(c, 'nailhead', x - 1.4, by0 + 1, 4.6);
        art.ornament(c, 'nailhead', x + 1.4, base - towerH * 0.55, 4.2);
      }
      c.restore();
    });

    // the plaques: each headland's reckoning cut into the shore band
    const pw = Math.min(SW / 3 - (narrow ? 5 : 16), narrow ? 106 : 214);
    instance.beacons.forEach((b, i) => {
      const x = stationX[i] - pw / 2;
      const y = plaqTop;
      c.save();
      c.fillStyle = withA(p.tar, 0.56);
      c.beginPath();
      c.rect(x, y, pw, plaqH);
      c.fill();
      if (has('insetFace')) art.insetFace(c, x, y, pw, plaqH, { depth: 0.6, lip: 0.08 });
      c.strokeStyle = withA(p.gold, 0.3);
      c.lineWidth = 1;
      c.strokeRect(x + 1.5, y + 1.5, pw - 3, plaqH - 3);
      // the beacon's colour, struck as a paint pip in the groove
      c.fillStyle = fires[i];
      c.beginPath(); c.arc(x + 9, y + ROW.name - 4, 3.6, 0, TAU); c.fill();
      c.strokeStyle = withA(p.tar, 0.8);
      c.lineWidth = 0.9;
      c.stroke();
      art.carveText(c, b.name, x + 17, y + ROW.name, ROW.size, { depth: 0.75, maxWidth: pw - 24 });
      c.font = `${ROW.mono}px ${MONO}`;
      c.fillStyle = p.boneDim;
      c.textAlign = 'left';
      c.fillText(T('everyN', { n: b.cycle }), x + 8, y + ROW.every, pw - 14);
      c.fillText(whenText(b), x + 8, y + ROW.ago, pw - 14);
      // the scribe line the notches are struck against
      c.strokeStyle = withA(p.bone, 0.07);
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(x + 6, y + ROW.tick + 2.4); c.lineTo(x + pw - 6, y + ROW.tick + 2.4);
      c.stroke();
      c.restore();
    });
    c.restore();
    coastSlab = off.canvas;
    return coastSlab;
  }

  function paintCoast() {
    const c = coast.ctx;
    c.clearRect(0, 0, COAST_W, COAST_H);
    c.drawImage(coastSlabFor(), 0, 0, COAST_W, COAST_H);
    c.save();
    c.beginPath();
    c.rect(SX + 2, SY + 2, SW - 4, SH - 4);
    c.clip();

    // the moon of this night, over the water
    moon(c, moonX, moonY, moonR, moonPhase(night));

    // the fires. A beacon burning on this night burns for real, and its light
    // falls on its own post and on the water below it.
    instance.beacons.forEach((b, i) => {
      const x = stationX[i];
      const base = landY(x) + 3;
      const top = base - towerH;
      const lit = burnsHere(b, night);
      if (lit && has('glow')) {
        try {
          art.glow(c, x, top - cageS * 0.6, cageS * 6.2, mixHex(fires[i], p.goldBright, 0.45), 0.34);
          art.glow(c, x, base + 6, cageS * 3.2, p.ember, 0.14);
        } catch (e) { /* stub */ }
      }
      fireCage(c, x, top - cageS * 0.35, cageS, lit, i, { colour: mixHex(fires[i], p.ember, 0.35) });
      if (!lit && nearDark && nearDark.indexOf(i) >= 0) {
        c.save();
        c.strokeStyle = withA(p.ember, 0.85);
        c.lineWidth = 1.8;
        if (typeof c.setLineDash === 'function') c.setLineDash([4, 3]);
        c.beginPath();
        c.arc(x, top - cageS * 0.35, cageS * 2.1, 0, TAU);
        c.stroke();
        c.restore();
      }
    });

    // the notch strip on each plaque: one notch per night of the reckoning,
    // the burning notch struck gold, a bone marker on tonight's place
    const pw = Math.min(SW / 3 - (narrow ? 5 : 16), narrow ? 106 : 214);
    instance.beacons.forEach((b, i) => {
      const x0 = stationX[i] - pw / 2 + 8;
      const w = pw - 16;
      const y = plaqTop + ROW.tick;
      const per = w / b.cycle;
      const ph = phaseOf(b, night);
      for (let j = 0; j < b.cycle; j++) {
        const nx = x0 + per * (j + 0.5);
        const burn = j === 0;
        const here = j === ph;
        c.save();
        c.strokeStyle = burn ? withA(p.gold, 0.95) : withA(p.boneDim, here ? 0.75 : 0.34);
        c.lineWidth = burn || here ? 2 : 1.1;
        c.beginPath();
        c.moveTo(nx, y - (burn ? 5.5 : 3.6));
        c.lineTo(nx, y + (burn ? 2 : 1.4));
        c.stroke();
        c.restore();
        if (here) {
          c.save();
          c.fillStyle = burn ? p.goldBright : p.bone;
          c.beginPath();
          c.moveTo(nx, y - 5); c.lineTo(nx - 2.8, y - 8.4); c.lineTo(nx + 2.8, y - 8.4);
          c.closePath(); c.fill();
          c.restore();
        }
      }
      c.strokeStyle = withA(p.tar, 0.75);
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(x0, y + 2.4); c.lineTo(x0 + w, y + 2.4); c.stroke();
    });
    c.restore();
  }

  // ---- the wheel ---------------------------------------------------------
  // the wheel, read from its edge inward: chip-carved teeth, an iron band, the
  // ring of moons, the night notches, three orbit tracks, the hub recess
  const rTeeth = R * 0.955;
  const rBand = R * 0.945;
  const rMoon = R * 0.885;
  const rRim = R * 0.845;        // inner edge of the rim band = the face edge
  const rNotch = R * 0.835;      // where the night notches start
  const rTrack = [R * 0.675, R * 0.56, R * 0.445];
  const rHub = R * 0.375;
  const flankPad = 8;
  const flankW = DCX - R - flankPad * 2;
  const flankH = DIAL_H - 26;
  const flankY = 13;

  let dialSlab = null;
  function dialSlabFor() {
    if (dialSlab) return dialSlab;
    const off = art.makeCanvas(DIAL_W, DIAL_H);
    const c = off.ctx;
    art.paintWood(c, DIAL_W, DIAL_H, 585);
    if (has('hearth')) art.hearth(c, DIAL_W, DIAL_H, { strength: 0.55, y: 0.3 });
    if (has('wear')) {
      art.wear(c, DIAL_W, DIAL_H, 'dial-03', {
        avoid: { x: DCX - R - 6, y: DCY - R - 6, w: R * 2 + 12, h: R * 2 + 12 },
      });
    }
    if (has('chipBorder')) art.chipBorder(c, 4, 3, DIAL_W - 8, DIAL_H - 6, { size: 8, alpha: 0.42 });

    // the wheel: a turned oak disc seated in the boards
    c.save();
    c.fillStyle = withA(p.tar, 0.5);
    c.beginPath(); c.arc(DCX + 3, DCY + 5, R * 1.03, 0, TAU); c.fill();
    c.restore();
    const rimG = c.createLinearGradient(DCX - R, DCY - R, DCX + R * 0.6, DCY + R);
    rimG.addColorStop(0, mixHex(p.oak, p.oakLight, 0.5));
    rimG.addColorStop(0.5, p.oak);
    rimG.addColorStop(1, mixHex(p.oakDeep, p.tar, 0.4));
    c.save();
    c.fillStyle = rimG;
    c.beginPath(); c.arc(DCX, DCY, R, 0, TAU); c.fill();
    // grain running round the rim band
    c.beginPath(); c.arc(DCX, DCY, R, 0, TAU); c.clip();
    for (let i = 0; i < 40; i++) {
      const a0 = h32(i * 7 + 3) * TAU;
      const rr = rRim + h32(i * 5 + 1) * (R - rRim);
      c.strokeStyle = withA(h32(i) > 0.55 ? p.oakLight : p.oakDeep, 0.16 + h32(i * 3) * 0.12);
      c.lineWidth = 0.7 + h32(i * 11) * 1.2;
      c.beginPath();
      c.arc(DCX, DCY, rr, a0, a0 + 0.35 + h32(i * 13) * 0.7);
      c.stroke();
    }
    c.restore();
    // the sunken face — wood turned on a lathe, not a black void: base grade,
    // ring cuts left by the tool, a chatter pass, and the hearth spilling in
    const faceG = c.createRadialGradient(DCX - rRim * 0.3, DCY - rRim * 0.35, rRim * 0.1, DCX, DCY, rRim);
    faceG.addColorStop(0, withA(mixHex(p.tar, p.fjord, 0.34), 0.95));
    faceG.addColorStop(0.7, withA(mixHex(p.tar, p.oakDeep, 0.28), 0.97));
    faceG.addColorStop(1, withA(p.tar, 0.99));
    c.fillStyle = faceG;
    c.beginPath(); c.arc(DCX, DCY, rRim, 0, TAU); c.fill();
    c.save();
    c.beginPath(); c.arc(DCX, DCY, rRim, 0, TAU); c.clip();
    for (let i = 0; i < 26; i++) {                 // lathe ring cuts
      const rr = rHub * 0.6 + h32(i * 23 + 5) * (rRim - rHub * 0.6);
      c.strokeStyle = withA(h32(i * 3) > 0.5 ? p.oakLight : p.tar, 0.04 + h32(i * 7) * 0.05);
      c.lineWidth = 0.6 + h32(i * 11) * 1.4;
      c.beginPath(); c.arc(DCX, DCY, rr, 0, TAU); c.stroke();
    }
    for (let i = 0; i < 34; i++) {                 // chatter: short tool bites
      const a0 = h32(i * 41 + 9) * TAU;
      const rr = rHub * 0.8 + h32(i * 13 + 2) * (rRim - rHub * 0.8);
      c.strokeStyle = withA(p.bone, 0.028 + h32(i * 5) * 0.024);
      c.lineWidth = 0.7;
      c.beginPath(); c.arc(DCX, DCY, rr, a0, a0 + 0.08 + h32(i * 17) * 0.16); c.stroke();
    }
    for (let i = 0; i < 110; i++) {                // pores
      const a0 = h32(i * 61 + 1) * TAU;
      const rr = Math.sqrt(h32(i * 29 + 4)) * rRim;
      c.fillStyle = withA(p.tar, 0.24 + h32(i * 3) * 0.24);
      c.beginPath();
      c.arc(DCX + Math.cos(a0) * rr, DCY + Math.sin(a0) * rr, 0.5 + h32(i * 7) * 0.8, 0, TAU);
      c.fill();
    }
    if (has('hearth')) art.hearth(c, DIAL_W, DIAL_H, { strength: 0.2, x: 0.5, y: 0.32, r: 0.26 });
    c.restore();
    carve(c, (g) => g.arc(DCX, DCY, rRim, 0, TAU), 2.2, { liftA: 0.42, lift: mixHex(p.oakLight, p.goldBright, 0.3) });
    carve(c, (g) => g.arc(DCX, DCY, R, 0, TAU), 2, { liftA: 0.36 });
    // chip-carved wolf-tooth run round the rim — the carve standard, on a wheel
    {
      const teeth = 56;
      const s = R - rTeeth;
      for (let k = 0; k < teeth; k++) {
        const a0 = (k / teeth) * TAU;
        const a1 = ((k + 1) / teeth) * TAU;
        const am = (a0 + a1) / 2;
        const ro = R - 1.5;
        const ri = ro - (k % 2 ? s * 0.45 : s);
        c.save();
        c.fillStyle = withA(p.tar, 0.4);
        c.beginPath();
        c.moveTo(DCX + Math.cos(a0) * ro, DCY + Math.sin(a0) * ro);
        c.lineTo(DCX + Math.cos(a1) * ro, DCY + Math.sin(a1) * ro);
        c.lineTo(DCX + Math.cos(am) * ri, DCY + Math.sin(am) * ri);
        c.closePath();
        c.fill();
        c.strokeStyle = withA(mixHex(p.oakLight, p.goldBright, 0.3), 0.3);
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(DCX + Math.cos(a1) * ro, DCY + Math.sin(a1) * ro);
        c.lineTo(DCX + Math.cos(am) * ri, DCY + Math.sin(am) * ri);
        c.stroke();
        c.restore();
      }
    }
    // an iron band shrunk on over the rim, its upper arc catching the hearth
    c.save();
    c.strokeStyle = withA(IRON, 0.6);
    c.lineWidth = Math.max(2, R * 0.02);
    c.beginPath(); c.arc(DCX, DCY, rBand, 0, TAU); c.stroke();
    c.strokeStyle = withA(p.boneDim, 0.2);
    c.lineWidth = 1;
    c.beginPath(); c.arc(DCX, DCY, rBand + 1.2, Math.PI * 0.85, Math.PI * 1.95); c.stroke();
    c.restore();

    // the night notches: one cut per night the wheel carries
    for (let k = -half; k <= half; k++) {
      const a = -Math.PI / 2 + k * step;
      const cos = Math.cos(a), sin = Math.sin(a);
      const big = k % 5 === 0;
      c.save();
      c.strokeStyle = withA(p.boneDim, big ? 0.5 : 0.28);
      c.lineWidth = big ? 1.6 : 1;
      c.beginPath();
      c.moveTo(DCX + cos * rNotch, DCY + sin * rNotch);
      c.lineTo(DCX + cos * (rNotch - (big ? R * 0.075 : R * 0.045)), DCY + sin * (rNotch - (big ? R * 0.075 : R * 0.045)));
      c.stroke();
      c.strokeStyle = withA(p.tar, 0.8);
      c.lineWidth = big ? 1 : 0.6;
      c.beginPath();
      c.moveTo(DCX + cos * rNotch - 0.8, DCY + sin * rNotch - 0.9);
      c.lineTo(DCX + cos * (rNotch - R * 0.05) - 0.8, DCY + sin * (rNotch - R * 0.05) - 0.9);
      c.stroke();
      c.restore();
    }

    // one carved orbit track per beacon, each a real groove
    instance.beacons.forEach((b, i) => {
      const r = rTrack[i];
      carve(c, (g) => g.arc(DCX, DCY, r, 0, TAU), 1.7, {
        coreA: 0.9, liftA: 0.5, lift: mixHex(p.oakLight, p.goldBright, 0.35),
      });
      c.save();
      c.strokeStyle = withA(fires[i], 0.4);
      c.lineWidth = 1.2;
      c.beginPath(); c.arc(DCX, DCY, r - 1.5, 0, TAU); c.stroke();
      c.restore();
      // notch-marks on the track: a tick at every night the wheel carries
      for (let k = -half; k <= half; k++) {
        const a = -Math.PI / 2 + k * step;
        c.save();
        c.strokeStyle = withA(p.boneDim, 0.24);
        c.lineWidth = 0.9;
        c.beginPath();
        c.moveTo(DCX + Math.cos(a) * (r - 3), DCY + Math.sin(a) * (r - 3));
        c.lineTo(DCX + Math.cos(a) * (r + 3), DCY + Math.sin(a) * (r + 3));
        c.stroke();
        c.restore();
      }
    });

    // the hub: a recess for the reckoning
    c.save();
    const hubG = c.createRadialGradient(DCX - rHub * 0.3, DCY - rHub * 0.4, rHub * 0.1, DCX, DCY, rHub);
    hubG.addColorStop(0, withA(p.oakDeep, 0.95));
    hubG.addColorStop(1, withA(p.tar, 0.98));
    c.fillStyle = hubG;
    c.beginPath(); c.arc(DCX, DCY, rHub, 0, TAU); c.fill();
    c.restore();
    carve(c, (g) => g.arc(DCX, DCY, rHub, 0, TAU), 1.8, { liftA: 0.4, lift: mixHex(p.oakLight, p.goldBright, 0.35) });
    if (has('rosette')) {
      art.rosette(c, DCX, DCY + rHub * 0.62, rHub * 0.2, { alpha: 0.5 });
    }

    // the side plaques, on viewports that have the room
    if (FLANK) {
      const rx = DIAL_W - flankPad - flankW;
      art.paintPanel(c, flankPad, flankY, flankW, flankH, { seed: 'reckonings', wash: 0.68 });
      art.paintPanel(c, rx, flankY, flankW, flankH, { seed: 'this-night', wash: 0.68 });
      art.carveText(c, T('reckonings'), flankPad + flankW / 2, flankY + 26, 13,
        { align: 'center', depth: 0.8, letterSpacing: 1.6, maxWidth: flankW - 18 });
      art.carveText(c, T('thisNight'), rx + flankW / 2, flankY + 26, 13,
        { align: 'center', depth: 0.8, letterSpacing: 1.6, maxWidth: flankW - 18 });
      // a true-interlace rail under each header, then chip-carved runs down the
      // plaque walls: the dead-zone law wants quiet carving, not bare board
      for (const px of [flankPad, rx]) {
        if (has('ribbonRail')) art.ribbonRail(c, px + 16, flankY + 36, flankW - 32, { amp: 3.4, step: 15, alpha: 0.6 });
        if (has('chipBorder')) art.chipBorder(c, px + 7, flankY + 44, flankW - 14, flankH - 56, { size: 7, alpha: 0.34 });
        if (has('rosette')) {
          art.rosette(c, px + 15, flankY + flankH - 13, 6.5, { alpha: 0.5 });
          art.rosette(c, px + flankW - 15, flankY + flankH - 13, 6.5, { alpha: 0.5 });
        }
      }
      // the reckoning rows' furniture (the live values are painted each frame)
      const rowH = (flankH - 52) / 3;
      instance.beacons.forEach((b, i) => {
        const y = flankY + 48 + rowH * i;
        c.save();
        c.fillStyle = withA(p.tar, 0.4);
        c.fillRect(flankPad + 16, y, flankW - 32, rowH - 7);
        if (has('insetFace')) art.insetFace(c, flankPad + 16, y, flankW - 32, rowH - 7, { depth: 0.55 });
        c.strokeStyle = withA(p.gold, 0.2);
        c.lineWidth = 1;
        c.strokeRect(flankPad + 16.5, y + 0.5, flankW - 33, rowH - 8);
        c.restore();
      });
      // the watch's own recess, so the cages sit in something
      c.save();
      c.fillStyle = withA(p.tar, 0.4);
      c.fillRect(rx + 16, flankY + flankH - 82, flankW - 32, 66);
      if (has('insetFace')) art.insetFace(c, rx + 16, flankY + flankH - 82, flankW - 32, 66, { depth: 0.55 });
      c.strokeStyle = withA(p.gold, 0.2);
      c.lineWidth = 1;
      c.strokeRect(rx + 16.5, flankY + flankH - 81.5, flankW - 33, 65);
      c.restore();
    }
    dialSlab = off.canvas;
    return dialSlab;
  }

  // the bone index blade: fixed at the top, kicked by each detent
  function pointer(c, kick) {
    const a = -Math.PI / 2 + kick;
    c.save();
    c.translate(DCX, DCY);
    c.rotate(a + Math.PI / 2);
    const y0 = -R * 1.005;
    const y1 = -R * 0.585;
    const bw = Math.max(7, R * 0.077);
    // the shadow it throws on the wheel
    c.save();
    c.globalAlpha = 0.5;
    c.fillStyle = p.tar;
    c.beginPath();
    c.moveTo(-bw + 3, y0 + 3.5); c.lineTo(bw + 3, y0 + 3.5);
    c.lineTo(bw * 0.42 + 3, y1 + 3.5); c.lineTo(-bw * 0.42 + 3, y1 + 3.5);
    c.closePath(); c.fill();
    c.restore();
    // the blade
    const bg = c.createLinearGradient(-bw, 0, bw, 0);
    bg.addColorStop(0, mixHex(p.bone, p.oakDeep, 0.4));
    bg.addColorStop(0.32, p.bone);
    bg.addColorStop(0.62, mixHex(p.bone, p.goldBright, 0.12));
    bg.addColorStop(1, mixHex(p.bone, p.oakDeep, 0.55));
    c.fillStyle = bg;
    c.beginPath();
    c.moveTo(-bw, y0); c.lineTo(bw, y0);
    c.lineTo(bw * 0.4, y1 + bw); c.lineTo(0, y1); c.lineTo(-bw * 0.4, y1 + bw);
    c.closePath();
    c.fill();
    c.strokeStyle = withA(p.tar, 0.8);
    c.lineWidth = 1.1;
    c.stroke();
    // scrimshaw: a scribed spine and two cross-nicks down the bone
    c.strokeStyle = withA(p.oakDeep, 0.45);
    c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(0, y0 + 5); c.lineTo(0, y1 + 3); c.stroke();
    c.lineWidth = 0.7;
    for (const f of [0.3, 0.55]) {
      const yy = y0 + (y1 - y0) * f;
      const hw = bw * (1 - f * 0.5);
      c.beginPath(); c.moveTo(-hw * 0.7, yy); c.lineTo(hw * 0.7, yy); c.stroke();
    }
    // gold ferrule + rivets where it seats on the rim
    c.fillStyle = mixHex(p.gold, p.goldBright, 0.4);
    c.fillRect(-bw - 1.6, y0 - 2, bw * 2 + 3.2, 6.5);
    c.strokeStyle = withA(p.tar, 0.75);
    c.lineWidth = 1;
    c.strokeRect(-bw - 1.6, y0 - 2, bw * 2 + 3.2, 6.5);
    c.strokeStyle = withA(p.goldBright, 0.5);
    c.beginPath(); c.moveTo(-bw - 1, y0 - 1.2); c.lineTo(bw + 1, y0 - 1.2); c.stroke();
    c.fillStyle = withA(p.goldBright, 0.95);
    for (const dx of [-bw * 0.55, bw * 0.55]) {
      c.beginPath(); c.arc(dx, y0 + 1.2, 1.6, 0, TAU); c.fill();
    }
    c.restore();
  }

  function flankPaint(c) {
    if (!FLANK) return;
    const rowH = (flankH - 52) / 3;
    const lit = litSet(night);
    instance.beacons.forEach((b, i) => {
      const x = flankPad + 24;
      const y = flankY + 48 + rowH * i;
      const burning = lit.indexOf(i) >= 0;
      c.save();
      // the lamp
      if (burning && has('glow')) {
        try { art.glow(c, x + 4, y + 13, 13, fires[i], 0.75); } catch (e) { /* stub */ }
      }
      c.fillStyle = burning ? mixHex(fires[i], p.goldBright, 0.4) : withA(fires[i], 0.42);
      c.beginPath(); c.arc(x + 4, y + 13, 4.6, 0, TAU); c.fill();
      c.strokeStyle = withA(p.tar, 0.85);
      c.lineWidth = 1; c.stroke();
      art.carveText(c, b.name, x + 15, y + 18, 13, { depth: 0.6, maxWidth: flankW - 84 });
      c.font = `10px ${MONO}`;
      c.textAlign = 'right';
      c.fillStyle = p.boneDim;
      c.fillText(`×${b.cycle}`, flankPad + flankW - 24, y + 18);
      // the countdown run: this reckoning laid flat, tonight marked
      const runX = x;
      const runW = flankW - 52;
      const runY = y + rowH - 24;
      const per = runW / b.cycle;
      const ph = phaseOf(b, night);
      for (let j = 0; j < b.cycle; j++) {
        const nx = runX + per * (j + 0.5);
        const burn = j === 0;
        c.strokeStyle = burn ? withA(p.gold, 0.9) : withA(p.boneDim, j === ph ? 0.8 : 0.28);
        c.lineWidth = burn || j === ph ? 1.9 : 1;
        c.beginPath();
        c.moveTo(nx, runY - (burn ? 5 : 3.4));
        c.lineTo(nx, runY + 1.6);
        c.stroke();
        if (j === ph) {
          c.fillStyle = burning ? p.goldBright : p.bone;
          c.beginPath();
          c.moveTo(nx, runY - 6.8); c.lineTo(nx - 2.8, runY - 10.4); c.lineTo(nx + 2.8, runY - 10.4);
          c.closePath(); c.fill();
        }
      }
      c.strokeStyle = withA(p.tar, 0.7);
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(runX, runY + 2.6); c.lineTo(runX + runW, runY + 2.6); c.stroke();
      c.font = `10px ${MONO}`;
      c.textAlign = 'left';
      c.fillStyle = burning ? p.gold : p.boneDim;
      c.fillText(burning ? T('againNow') : T('againIn', { n: untilBurn(b, night) }), runX, runY + 15);
      c.restore();
    });

    // THIS NIGHT: the moon of the night, the tally, and the three cages
    const rx = DIAL_W - flankPad - flankW;
    const mid = rx + flankW / 2;
    moon(c, mid, flankY + 84, 28, moonPhase(night));
    const n = lit.length;
    const word = T(`tally${n}`);
    art.carveText(c, word, mid, flankY + 146, 15, {
      align: 'center', depth: 0.85, letterSpacing: 1.2, maxWidth: flankW - 26,
      color: n === 3 ? p.goldBright : n === 2 ? p.ember : p.boneDim,
    });
    instance.beacons.forEach((b, i) => {
      const x = mid + (i - 1) * Math.min(56, (flankW - 44) / 3);
      const y = flankY + flankH - 56;
      fireCage(c, x, y, 11, lit.indexOf(i) >= 0, 100 + i, { colour: mixHex(fires[i], p.ember, 0.35) });
      c.save();
      c.font = `9.5px ${MONO}`;
      c.textAlign = 'center';
      c.fillStyle = lit.indexOf(i) >= 0 ? p.bone : p.boneDim;
      c.fillText(b.name.slice(0, 9), x, y + 28);
      c.restore();
    });
  }

  function paintDial() {
    const c = gfx.ctx;
    c.clearRect(0, 0, DIAL_W, DIAL_H);
    c.drawImage(dialSlabFor(), 0, 0, DIAL_W, DIAL_H);

    // the embers: every night the wheel carries, on the track of every beacon
    // whose reckoning fires that night. This is the lesson — the alignment is
    // watched into being, not read.
    for (let k = -half; k <= half; k++) {
      const t = night + k;
      if (t < 1 || t > instance.dialMax) continue;
      const a = -Math.PI / 2 + k * step;
      const cos = Math.cos(a), sin = Math.sin(a);
      const lit = litSet(t);
      const near = lit.length === 2;
      const all = lit.length === instance.beacons.length;

      // a night that lights two of three brings its embers up: the near-miss
      // has to be seen to teach
      if (near || all) {
        c.save();
        c.strokeStyle = withA(all ? p.goldBright : p.ember, all ? 0.75 : 0.4);
        c.lineWidth = all ? 2 : 1.2;
        c.beginPath();
        const r0 = rTrack[Math.min(...lit)], r1 = rTrack[Math.max(...lit)];
        c.moveTo(DCX + cos * (r1 - 5), DCY + sin * (r1 - 5));
        c.lineTo(DCX + cos * (r0 + 5), DCY + sin * (r0 + 5));
        c.stroke();
        c.restore();
      }

      for (const i of lit) {
        const r = rTrack[i];
        const fx = DCX + cos * r, fy = DCY + sin * r;
        const swell = all ? 1.5 : near ? 1.28 : 1;
        if (has('glow') && (all || near || k === 0)) {
          try { art.glow(c, fx, fy, 9 * swell, fires[i], (all ? 0.8 : near ? 0.5 : 0.35)); } catch (e) { /* stub */ }
        }
        c.save();
        c.fillStyle = withA(p.tar, 0.85);
        c.beginPath(); c.arc(fx + 0.6, fy + 0.8, 4.9 * swell, 0, TAU); c.fill();
        c.fillStyle = fires[i];
        c.beginPath(); c.arc(fx, fy, 4.2 * swell, 0, TAU); c.fill();
        c.fillStyle = p.goldBright;
        c.globalAlpha = k === 0 ? 0.98 : 0.72;
        c.beginPath(); c.arc(fx - 0.4, fy - 0.5, 1.8 * swell, 0, TAU); c.fill();
        if (k === 0) {                            // the night under the blade
          c.globalAlpha = 0.85;
          c.strokeStyle = p.bone;
          c.lineWidth = 1;
          c.beginPath(); c.arc(fx, fy, 6.6 * swell, 0, TAU); c.stroke();
        }
        c.restore();
      }

      if (all) {
        const gx = DCX + cos * rNotch * 0.96, gy = DCY + sin * rNotch * 0.96;
        if (has('glow')) {
          try { art.glow(c, gx, gy, 17, p.goldBright, 0.75 + jit(t) * 0.25); } catch (e) { /* stub */ }
        }
        c.save();
        c.strokeStyle = p.gold;
        c.lineWidth = 2;
        c.beginPath(); c.arc(gx, gy, 9, 0, TAU); c.stroke();
        c.restore();
      }
    }

    // moons riding the rim: the phase of the night in each carved socket
    for (let k = -12; k <= 12; k += 6) {
      const t = night + k;
      if (t < 1 || t > instance.dialMax) continue;
      const a = -Math.PI / 2 + k * step;
      const mr = k === 0 ? R * 0.075 : R * 0.055;
      moon(c, DCX + Math.cos(a) * rMoon, DCY + Math.sin(a) * rMoon, mr, moonPhase(t),
        { alpha: k === 0 ? 1 : 0.74 });
    }

    // the reckoning at the hub
    const kickAge = (now() - detentAt) / 190;
    const kick = kickAge < 1 ? detentDir * 0.055 * (1 - kickAge) * (1 - kickAge) : 0;
    const hot = kickAge < 0.7;
    const c2 = c;
    art.carveText(c2, String(night), DCX, DCY + rHub * 0.12, Math.round(rHub * 0.78), {
      align: 'center', depth: 0.95, color: hot ? p.goldBright : p.bone, maxWidth: rHub * 1.6,
    });
    c2.save();
    c2.textAlign = 'center';
    c2.font = `${Math.max(10, Math.round(rHub * 0.2))}px ${SERIF}`;
    c2.fillStyle = p.boneDim;
    c2.fillText(T('nightsHence'), DCX, DCY + rHub * 0.46);
    const n = litCount(night);
    c2.font = `${Math.max(9, Math.round(rHub * 0.17))}px ${MONO}`;
    c2.fillStyle = n === 3 ? p.goldBright : n === 2 ? p.ember : withA(p.boneDim, 0.75);
    c2.fillText(T(`tally${n}`), DCX, DCY + rHub * 0.78);
    c2.restore();

    pointer(c, kick);
    flankPaint(c);
    if (demo.active) paintGhost(c);
  }

  // ---- the showing: three seconds of a ghost hand on the rim --------------
  function paintGhost(c) {
    const spent = demo.still ? 0.55 : Math.min(1, (now() - demo.t0) / 2400);
    const a0 = -Math.PI / 2 - 0.34;
    const ang = a0 + spent * step * 2;
    const gx = DCX + Math.cos(ang) * R * 0.9;
    const gy = DCY + Math.sin(ang) * R * 0.9;
    c.save();
    // the arc the hand travels, dashed — struck across the dark face where it
    // reads, not lost against the rim
    const arcR = R * 0.76;
    c.strokeStyle = withA(p.goldBright, 0.7);
    c.lineWidth = 2.4;
    if (typeof c.setLineDash === 'function') c.setLineDash([5, 4]);
    c.beginPath();
    c.arc(DCX, DCY, arcR, a0 - 0.06, a0 + step * 2 + 0.06);
    c.stroke();
    if (typeof c.setLineDash === 'function') c.setLineDash([]);
    // arrowhead at the far end
    const ae = a0 + step * 2 + 0.06;
    const ex = DCX + Math.cos(ae) * arcR, ey = DCY + Math.sin(ae) * arcR;
    c.translate(ex, ey);
    c.rotate(ae + Math.PI / 2);
    c.fillStyle = withA(p.goldBright, 0.95);
    c.beginPath();
    c.moveTo(0, 9); c.lineTo(-6, -5); c.lineTo(6, -5);
    c.closePath(); c.fill();
    c.restore();
    // the hand: a gold grip mark and two knuckle cuts
    c.save();
    if (has('glow')) { try { art.glow(c, gx, gy, 26, p.goldBright, 0.4); } catch (e) { /* stub */ } }
    c.fillStyle = withA(p.goldBright, 0.32);
    c.beginPath(); c.ellipse(gx, gy, 15, 11, ang, 0, TAU); c.fill();
    c.strokeStyle = withA(p.goldBright, 0.85);
    c.lineWidth = 2;
    c.beginPath(); c.ellipse(gx, gy, 15, 11, ang, 0, TAU); c.stroke();
    c.lineWidth = 1.4;
    for (let i = -1; i <= 1; i++) {
      c.beginPath();
      c.arc(gx + Math.cos(ang) * i * 6, gy + Math.sin(ang) * i * 6, 4.4, ang - 2.4, ang + 0.6);
      c.stroke();
    }
    c.restore();
  }

  function endShowing(quiet) {
    if (!demo.active) return;
    demo.active = false;
    skipBtn.style.display = 'none';
    if (!quiet) status.textContent = describe();
    paintDial();
  }

  function showTheWay() {
    if (ctx.solved || touched) return;
    demo.active = true;
    demo.still = calm;
    demo.t0 = now();
    demo.stepped = 0;
    skipBtn.style.display = '';
    status.textContent = T('demoSay');
    say(T('demoSay'));
    if (calm) {
      // reduced motion: the same lesson held still — the grip, the arc, and the
      // two nights already walked
      setNight(night + 2);
      paintDial();
      later(() => endShowing(false), 3000);
      return;
    }
    later(() => endShowing(false), 3000);
  }

  function tickDemo() {
    if (!demo.active || demo.still) return;
    const spent = (now() - demo.t0) / 2400;
    if (demo.stepped < 1 && spent > 0.34) { demo.stepped = 1; setNight(night + 1, true); }
    else if (demo.stepped < 2 && spent > 0.68) { demo.stepped = 2; setNight(night + 1, true); }
  }

  // ---- render ------------------------------------------------------------
  function describe() {
    const parts = instance.beacons
      .map((b) => (burnsHere(b, night) ? T('burns', { name: b.name }) : T('isDark', { name: b.name })));
    return T('nightLine', { n: night, parts: parts.join(', ') });
  }

  let noteTimer = null;
  function render(quiet) {
    paintCoast();
    paintDial();
    gfx.canvas.setAttribute('aria-valuenow', String(night));
    gfx.canvas.setAttribute('aria-valuetext', describe());
    status.textContent = describe();
    if (quiet) return;
    if (noteTimer) clearTimeout(noteTimer);
    noteTimer = later(() => { say(describe()); noteTimer = null; }, 600);
  }

  function setNight(t, quiet) {
    const next = Math.max(1, Math.min(instance.dialMax, t));
    if (next === night) return;
    detentDir = next > night ? 1 : -1;
    night = next;
    nearDark = null;
    sfx('tick');
    if (!calm) detentAt = now();
    render(quiet);
  }

  function takeTheWheel() {
    if (touched) return;
    touched = true;
    endShowing(true);
  }

  // ---- turning the wheel -------------------------------------------------
  let turn = null;
  const angleAt = (ev) => {
    const r = gfx.canvas.getBoundingClientRect();
    return Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2));
  };

  on(gfx.canvas, 'pointerdown', (ev) => {
    if (ctx.solved) return;
    takeTheWheel();
    turn = { angle: angleAt(ev), carried: 0 };
    gfx.canvas.dataset.turning = '1';
    try { gfx.canvas.setPointerCapture(ev.pointerId); } catch (e) { /* mouse without capture */ }
  });
  on(gfx.canvas, 'pointermove', (ev) => {
    if (!turn) return;
    ev.preventDefault();
    const a = angleAt(ev);
    let d = a - turn.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    turn.angle = a;
    turn.carried += d / step;
    const steps = Math.trunc(turn.carried);
    if (steps) { turn.carried -= steps; setNight(night + steps); }
  });
  const stopTurn = (ev) => {
    if (!turn) return;
    turn = null;
    gfx.canvas.dataset.turning = '0';
    try { gfx.canvas.releasePointerCapture(ev.pointerId); } catch (e) { /* already gone */ }
    sfx('knock');
  };
  on(gfx.canvas, 'pointerup', stopTurn);
  on(gfx.canvas, 'pointercancel', stopTurn);

  on(gfx.canvas, 'keydown', (ev) => {
    if (ctx.solved) return;
    const keys = {
      ArrowRight: 1, ArrowLeft: -1, ArrowUp: 10, ArrowDown: -10,
      PageUp: longest, PageDown: -longest,
    };
    if (ev.key in keys) { ev.preventDefault(); takeTheWheel(); setNight(night + keys[ev.key]); }
    else if (ev.key === 'Home') { ev.preventDefault(); takeTheWheel(); setNight(1); }
    else if (ev.key === 'End') { ev.preventDefault(); takeTheWheel(); setNight(instance.dialMax); }
    else if (ev.key === 'Enter') { ev.preventDefault(); submitBtn.click(); }
  });

  on(gfx.canvas, 'focus', () => {
    if (keysSaid) return;
    keysSaid = true;
    say(T('keysNote', { longest }));
  });

  on(skipBtn, 'click', () => { takeTheWheel(); gfx.canvas.focus(); });

  // The shell owns the shudder and the deny voice. The board's part is to show
  // WHERE: the cages standing dark on the refused night.
  function handle(res, sent) {
    if (!res || res.ok) return;
    if (Number.isInteger(sent) && sent === night) {
      nearDark = instance.beacons
        .map((b, i) => (burnsHere(b, night) ? -1 : i))
        .filter((i) => i >= 0);
      render(true);
    }
    if (res.near) { status.textContent = res.near; say(res.near); }
  }

  on(submitBtn, 'click', () => {
    if (ctx.solved) return;
    takeTheWheel();
    sfx('confirm');
    say(T('setLine', { n: night }));
    const sent = night;
    let res;
    try { res = ctx.submit({ night: sent }); } catch (e) { return; }
    if (res && typeof res.then === 'function') res.then((r) => handle(r, sent), () => {});
    else handle(res, sent);
  });

  // ---- open the lock -----------------------------------------------------
  coast.canvas.setAttribute('aria-label', T('ariaCoast', {
    list: instance.beacons.map((b) => T('coastItem', { name: b.name, n: b.cycle, when: whenText(b) })).join('; '),
  }));
  render(true);
  say(T('openLine', {
    list: instance.beacons.map((b) => T('coastItem', { name: b.name, n: b.cycle, when: whenText(b) })).join('; '),
    max: instance.dialMax,
  }));
  say(T('soughtLine'));
  if (ctx.solved) {
    submitBtn.disabled = true;
    submitBtn.textContent = T('submitDone');
    status.textContent = T('solvedLine', { n: night });
  } else {
    later(showTheWay, 520);
  }

  // the ember flicker — alive, calm, and absent under reduced motion. The loop
  // runs at frame rate while a detent or the showing is live (so the kick and
  // the ghost hand read), and drops to a 90ms ember cadence otherwise.
  let raf = 0;
  let lastFlick = 0;
  const canFlick = typeof globalThis.requestAnimationFrame === 'function'
    && typeof globalThis.cancelAnimationFrame === 'function' && !calm;
  const breathe = (ts) => {
    tickDemo();
    const busy = demo.active || (now() - detentAt) < 220;
    if (busy || ts - lastFlick >= 90) {
      if (!busy) lastFlick = ts;
      flick = (flick + (busy ? 0.25 : 1)) % 1024;
      paintCoast();
      paintDial();
    }
    raf = globalThis.requestAnimationFrame(breathe);
  };
  if (canFlick) raf = globalThis.requestAnimationFrame(breathe);

  return {
    unmount() {
      for (const off of cleanup) off();
      cleanup.length = 0;
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
      if (noteTimer) clearTimeout(noteTimer);
      if (raf) globalThis.cancelAnimationFrame(raf);
      raf = 0;
      turn = null;
      demo.active = false;
      coastSlab = null;
      dialSlab = null;
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    },
  };
}

// ---------------------------------------------------------------------- i18n
// Additive per-lock block (docs/CONTRACT.md §4.1 amendment). English lives in
// the frozen fields above; `nearMap` keys are the canonical English near-lines
// returned by verify().
const I18N = {
  es: {
    title: 'Las Noches de las Almenaras',
    epigraph: 'Tres fuegos guardan tres cuentas. Una vez ardieron como uno.',
    hints: [
      'Un fuego que ardió hace tres noches con una cuenta de cinco vuelve a arder dentro de dos.',
      'Toma primero la cuenta más larga. Cuenta solo sus noches, luego prueba cada una contra la segunda, y lo que sobreviva contra la tercera.',
      'Pasadas las tres cuentas multiplicadas, el patrón entero vuelve a empezar. La noche que buscas cae dentro de una vuelta de esa rueda.',
    ],
    nearMap: {
      'The dial does not reach that night.': 'El disco no llega hasta esa noche.',
      'No fire answers that night.': 'Ningún fuego responde esa noche.',
      'One fire answers that night. Two stand dark.': 'Un fuego responde esa noche. Dos quedan a oscuras.',
      'Two fires answer that night. One stands dark.': 'Dos fuegos responden esa noche. Uno queda a oscuras.',
    },
    board: {
      plate: 'Gira el disco hasta la próxima noche en que los tres fuegos ardan juntos.',
      law: 'Esta noche es la noche cero; el disco llega hasta la noche {max}.',
      keys: 'Arrastra la rueda, o usa las flechas.',
      submit: 'Fijar el disco',
      submitDone: 'El disco queda fijado',
      skip: 'Saltar la muestra',
      demoSay: 'Mira una vez: la rueda gira dos noches, y la costa responde.',
      reckonings: 'LAS CUENTAS',
      thisNight: 'ESTA NOCHE',
      everyN: 'cada {n} noches',
      agoTonight: 'ardió esta noche',
      agoOne: 'ardió hace 1 noche',
      agoN: 'ardió hace {n} noches',
      againIn: 'otra vez en {n}',
      againNow: 'ardiendo ahora',
      nightsHence: 'noches por delante',
      tally0: 'NINGÚN FUEGO',
      tally1: 'UNO DE TRES',
      tally2: 'DOS DE TRES',
      tally3: 'LOS TRES ARDEN',
      burns: '{name} arde',
      isDark: '{name} está a oscuras',
      nightLine: 'Noche {n} — {parts}.',
      solvedLine: 'Los tres ardieron juntos la noche {n}.',
      setLine: 'El disco queda fijado en la noche {n}.',
      ariaDial: 'El disco de las noches',
      ariaCoast: 'La costa de las almenaras. {list}',
      coastItem: '{name}, cada {n} noches, {when}',
      keysNote: 'Con el teclado: izquierda y derecha andan una noche; arriba y abajo saltan diez; las teclas de página saltan {longest}; Inicio y Fin corren a los extremos del disco; Intro fija el disco.',
      openLine: 'Tres almenaras, tres cuentas: {list}. El disco corre de la noche 1 a la noche {max}.',
      soughtLine: 'Se busca: la próxima noche en que las tres ardan como una.',
    },
  },
  ca: {
    title: 'Les Nits de les Talaies',
    epigraph: 'Tres focs guarden tres comptes. Un cop van cremar com un de sol.',
    hints: [
      'Un foc que va cremar fa tres nits amb un compte de cinc torna a cremar d’aquí a dues.',
      'Pren primer el compte més llarg. Compta’n només les nits, després prova cadascuna contra el segon, i el que sobrevisqui contra el tercer.',
      'Passats els tres comptes multiplicats, el patró sencer torna a començar. La nit que busques cau dins d’una volta d’aquella roda.',
    ],
    nearMap: {
      'The dial does not reach that night.': 'El disc no arriba fins aquella nit.',
      'No fire answers that night.': 'Cap foc no respon aquella nit.',
      'One fire answers that night. Two stand dark.': 'Un foc respon aquella nit. Dos queden a les fosques.',
      'Two fires answer that night. One stands dark.': 'Dos focs responen aquella nit. Un queda a les fosques.',
    },
    board: {
      plate: 'Gira el disc fins a la propera nit en què els tres focs cremin alhora.',
      law: 'Aquesta nit és la nit zero; el disc arriba fins a la nit {max}.',
      keys: 'Arrossega la roda, o fes servir les fletxes.',
      submit: 'Fixar el disc',
      submitDone: 'El disc queda fixat',
      skip: 'Saltar la mostra',
      demoSay: 'Mira-ho un cop: la roda gira dues nits, i la costa respon.',
      reckonings: 'ELS COMPTES',
      thisNight: 'AQUESTA NIT',
      everyN: 'cada {n} nits',
      agoTonight: 'va cremar aquesta nit',
      agoOne: 'va cremar fa 1 nit',
      agoN: 'va cremar fa {n} nits',
      againIn: 'un altre cop en {n}',
      againNow: 'cremant ara',
      nightsHence: 'nits endavant',
      tally0: 'CAP FOC',
      tally1: 'UN DE TRES',
      tally2: 'DOS DE TRES',
      tally3: 'ELS TRES CREMEN',
      burns: '{name} crema',
      isDark: '{name} és a les fosques',
      nightLine: 'Nit {n} — {parts}.',
      solvedLine: 'Els tres van cremar alhora la nit {n}.',
      setLine: 'El disc queda fixat a la nit {n}.',
      ariaDial: 'El disc de les nits',
      ariaCoast: 'La costa de les talaies. {list}',
      coastItem: '{name}, cada {n} nits, {when}',
      keysNote: 'Amb el teclat: esquerra i dreta caminen una nit; amunt i avall salten deu; les tecles de pàgina salten {longest}; Inici i Fi corren als extrems del disc; Retorn fixa el disc.',
      openLine: 'Tres talaies, tres comptes: {list}. El disc va de la nit 1 a la nit {max}.',
      soughtLine: 'Es busca: la propera nit en què les tres cremin com una de sola.',
    },
  },
};

export default {
  id: '03-beacons',
  ordinal: 3,
  tier: 1,
  title: 'The Beacon Nights',
  epigraph: 'Three fires keep three reckonings. Once they burned as one.',

  makePuzzle,
  solve,
  verify,
  wrongAnswers,
  shard: () => ({ ...SHARDS['03-beacons'] }),

  difficulty: {
    searchSpace: 1287, // the longest dial: 9 x 11 x 13 nights
    minSteps: 10,
    estMinutes: 4,
  },

  hints: [
    'A fire that burned three nights past on a reckoning of five burns again in two.',
    'Take the longest reckoning first. Count only its nights, then try each against the second, and what survives against the third.',
    'Past the three reckonings multiplied the whole pattern comes round again. The night you want lies within one turn of that wheel.',
  ],

  i18n: I18N,

  mount,
};
