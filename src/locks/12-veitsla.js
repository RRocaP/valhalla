// 12 — THE FEAST BENCHES (tier 4)
//
// Eight chieftains, two facing benches of four. Nine oaths were sworn about the
// seating; exactly one of them is a drunken boast — false in the true hall.
// Seat the hall and name the boast.
//
// SEAT GEOMETRY (frozen in this module, stated plainly to the player):
//   bench A = seats 0,1,2,3 · bench B = seats 4,5,6,7, both read left to right
//   from the high seat. The man in seat i faces the man in seat i+4.
//
// OATH SEMANTICS (the only four kinds; all are symmetric in x,y except left-of):
//   opposite(x,y)     |seat(x) - seat(y)| === 4        — they face each other
//   not-adjacent(x,y) NOT(same bench AND |seat difference| === 1)  — a feud
//   left-of(x,y)      same bench AND seat(x) < seat(y) — x sits nearer the high
//                     seat than y; a gift-debt, not necessarily elbow to elbow
//   same-bench(x,y)   same bench
//
// CANONICALISATION (enforced in verify, so the canonical answer is unique):
// bench A is the bench holding the ALPHABETICALLY FIRST chieftain. Swapping the
// two benches wholesale preserves every oath kind, so it is the one symmetry of
// the hall and this rule kills it. No tie-break is needed: the eight names are
// ASCII with distinct initials, so `<` is a total order over the roster. (A
// left-right reflection is NOT a symmetry — any left-of oath forbids it.)
//
// UNIQUENESS: makePuzzle sweeps every seating against every candidate boast —
// docs/LOCKS.md §12's 8!·9 — pruned to the 4·7! canonical seatings, since the
// discarded half is exactly the bench-swap image. A hypothesis (S,k) is valid
// iff every oath but k holds in S and oath k is false in S. Exactly one valid
// pair is required. Because uniqueness holds, verify can check the property
// instead of storing the answer in the instance.
//
// DECOYS: canonical seatings that break exactly one NON-boast oath. Under
// uniqueness such a seating must also break the boast (otherwise it would be a
// second valid pair), so decoys are the two-violation near-misses that satisfy
// seven of the nine sworn oaths. >= 3 are required.
//
// Difficulty accounting (docs/CONTRACT.md §4): 9 oath inspections + 8
// placements + at least one full re-seating pass to test a second boast
// hypothesis (8) + naming the boast + sealing = 28.
//
// PURE HALF: no DOM, no Date, no Math.random, no module-level mutable state.

import { SHARDS } from '../kernel/shards.js';

const ROSTER = [
  'Arnfast', 'Bjolan', 'Dagfinn', 'Eyvind', 'Gunnstein', 'Hjalti', 'Ketil',
  'Ljot', 'Nokkvi', 'Ragnvald', 'Sigtrygg', 'Thorfast', 'Ulfar', 'Vigdis',
];

const KINDS = ['opposite', 'not-adjacent', 'left-of', 'same-bench'];
const benchOf = (seat) => (seat < 4 ? 0 : 1);

function holds(c, pos) {
  const a = pos[c.x];
  const b = pos[c.y];
  switch (c.kind) {
    case 'opposite': return Math.abs(a - b) === 4;
    case 'not-adjacent': return !(benchOf(a) === benchOf(b) && Math.abs(a - b) === 1);
    case 'left-of': return benchOf(a) === benchOf(b) && a < b;
    case 'same-bench': return benchOf(a) === benchOf(b);
    default: return false;
  }
}

function violations(constraints, pos) {
  let mask = 0;
  for (let i = 0; i < constraints.length; i++) if (!holds(constraints[i], pos)) mask |= 1 << i;
  return mask;
}

const popcount = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };

const CANONICAL_COUNT = 20160; // 4 · 7! — the alphabetically-first chieftain sits on bench A

// Every canonical seating, flat: seat of person p in seating i is flat[i*8 + p].
function canonicalSeatings() {
  const flat = new Int8Array(CANONICAL_COUNT * 8);
  const pos = new Int8Array(8);
  const used = new Uint8Array(8);
  let w = 0;
  (function rec(person) {
    if (person === 8) { flat.set(pos, w); w += 8; return; }
    for (let s = 0; s < 8; s++) {
      if (used[s] || (person === 0 && s >= 4)) continue;
      used[s] = 1;
      pos[person] = s;
      rec(person + 1);
      used[s] = 0;
    }
  })(0);
  return flat;
}

function holdsRaw(kind, a, b) {
  switch (kind) {
    case 'opposite': return Math.abs(a - b) === 4;
    case 'not-adjacent': return !(benchOf(a) === benchOf(b) && Math.abs(a - b) === 1);
    case 'left-of': return benchOf(a) === benchOf(b) && a < b;
    case 'same-bench': return benchOf(a) === benchOf(b);
    default: return false;
  }
}

// Tightest kinds first, so the live list collapses in the first passes. The bit
// index of an oath is always its DISPLAY index — only the scan order changes.
const STRENGTH = { opposite: 0, 'left-of': 1, 'same-bench': 2, 'not-adjacent': 3 };

// Live-list sweep of the whole canonical hall. Any seating that breaks three or
// more oaths can never be a solution or a decoy, so it leaves the list for good.
function sweepHall(oaths, flat) {
  const seatings = flat || canonicalSeatings();
  let live = new Int32Array(CANONICAL_COUNT);
  for (let i = 0; i < CANONICAL_COUNT; i++) live[i] = i;
  let n = CANONICAL_COUNT;
  const masks = new Int32Array(CANONICAL_COUNT);
  const order = oaths.map((o, i) => i).sort((a, b) => STRENGTH[oaths[a].kind] - STRENGTH[oaths[b].kind]);
  for (const oi of order) {
    const o = oaths[oi];
    const bit = 1 << oi;
    let w = 0;
    for (let k = 0; k < n; k++) {
      const idx = live[k];
      const base = idx * 8;
      let m = masks[idx];
      if (!holdsRaw(o.kind, seatings[base + o.x], seatings[base + o.y])) m |= bit;
      if (popcount(m) > 2) continue;
      masks[idx] = m;
      live[w++] = idx;
    }
    n = w;
  }
  const solutions = [];
  const nearMisses = [];
  for (let k = 0; k < n; k++) {
    const idx = live[k];
    const mask = masks[idx];
    const bits = popcount(mask);
    if (bits > 2) continue;
    const pos = Array.from(seatings.subarray(idx * 8, idx * 8 + 8));
    if (bits === 1) solutions.push({ pos, boast: Math.log2(mask) | 0 });
    else if (bits === 2) nearMisses.push({ pos, mask });
  }
  return { solutions, nearMisses };
}

function decoysFor(nearMisses, boast) {
  const bit = 1 << boast;
  return nearMisses.filter((n) => (n.mask & bit) !== 0);
}

function textFor(kind, x, y, names) {
  const X = names[x];
  const Y = names[y];
  switch (kind) {
    case 'opposite': return `${X} swore he took his meat across the boards from ${Y}.`;
    case 'not-adjacent': return `${X} and ${Y} are at feud: they did not touch elbows.`;
    case 'left-of': return `${X} sat on the same bench as ${Y}, nearer the high seat.`;
    default: return `${X} and ${Y} shared one bench.`;
  }
}

function makeConstraint(r, names, pos, wantTrue) {
  for (let tries = 0; tries < 60; tries++) {
    const kind = r.pick(KINDS);
    const x = r.int(8);
    let y = r.int(8);
    if (x === y) y = (y + 1 + r.int(7)) % 8;
    const c = { kind, x, y };
    if (holds(c, pos) !== wantTrue) continue;
    return { ...c, text: textFor(kind, x, y, names) };
  }
  return null;
}

const oathKey = (c) => (c.kind === 'left-of'
  ? `${c.kind}:${c.x}:${c.y}`
  : `${c.kind}:${Math.min(c.x, c.y)}:${Math.max(c.x, c.y)}`);

// Nine oaths around a true seating: one boast, then eight sworn truths, each
// picked from a sample of candidates for how many RIVAL halls it kills. Random
// oaths almost never pin a hall down to one seating; chosen ones do.
function buildOaths(r, names, pos, flat) {
  const boast = makeConstraint(r, names, pos, false);
  if (!boast) return null;
  const seen = new Set([oathKey(boast)]);
  const truths = [];

  const live = new Int32Array(CANONICAL_COUNT);
  for (let i = 0; i < CANONICAL_COUNT; i++) live[i] = i;
  let n = CANONICAL_COUNT;
  const cnt = new Uint8Array(CANONICAL_COUNT);
  const brokenBy = (c, base) => (holdsRaw(c.kind, flat[base + c.x], flat[base + c.y]) ? 0 : 1);

  const apply = (c) => {
    let w = 0;
    for (let k = 0; k < n; k++) {
      const idx = live[k];
      const v = cnt[idx] + brokenBy(c, idx * 8);
      if (v > 2) continue;
      cnt[idx] = v;
      live[w++] = idx;
    }
    n = w;
  };
  const rivals = (c) => {
    const stride = Math.max(1, Math.floor(n / 4000));
    let count = 0;
    for (let k = 0; k < n; k += stride) {
      const idx = live[k];
      if (cnt[idx] + brokenBy(c, idx * 8) <= 1) count++;
    }
    return count;
  };

  apply(boast);
  for (let step = 0; step < 8; step++) {
    let best = null;
    let bestScore = Infinity;
    for (let t = 0; t < 12; t++) {
      const cand = makeConstraint(r, names, pos, true);
      if (!cand || seen.has(oathKey(cand))) continue;
      const s = rivals(cand);
      if (s < bestScore) { bestScore = s; best = cand; }
    }
    if (!best) return null;
    seen.add(oathKey(best));
    truths.push(best);
    apply(best);
  }
  const at = r.int(9);
  return { oaths: truths.slice(0, at).concat([boast], truths.slice(at)), boastIndex: at };
}

function seatingToBenches(pos, names) {
  const seats = new Array(8);
  for (let person = 0; person < 8; person++) seats[pos[person]] = names[person];
  return [seats.slice(0, 4), seats.slice(4, 8)];
}

function benchesToPos(benches, names) {
  const pos = new Array(names.length).fill(-1);
  for (let b = 0; b < 2; b++) {
    for (let i = 0; i < 4; i++) {
      const person = names.indexOf(benches[b][i]);
      if (person < 0 || pos[person] !== -1) return null;
      pos[person] = b * 4 + i;
    }
  }
  return pos.every((p) => p >= 0) ? pos : null;
}

// ------------------------------------------------------------------ the view
//
// The hall at feast. Two facing benches of carved plank with wear-polished
// seats, the eight chieftains as painted shield-tokens (an abstract knot
// device and a nailed name plaque each), and the nine sworn oaths as an
// oath-board of carved plaques above the benches.
//
// BotW law: seating a token shows its consequence AT ONCE. Every plaque whose
// two men are both seated glows warm when its oath holds and smoulders red
// when it is broken; plaques still waiting on a man stay cold. The deduction
// verb is watching the board react, not re-reading nine sentences. The plaque
// you accuse takes a mead-stain brand and keeps it, so the drunken boast is
// visually distinct from the eight sober oaths for the rest of the hall.

const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";

// Board copy. English is the source; es/ca live in the additive i18n block
// (docs/CONTRACT.md §4.1 amendment) and are resolved through it at mount.
const BOARD_EN = {
  plate: 'Seat the eight so every sworn oath holds — save one, the drunken boast. Name it.',
  oathLabel: 'The oath-board — nine plaques, and one of them was sworn in drink',
  standing: 'Still standing',
  benchNear: 'the near bench',
  benchFar: 'the far bench',
  seatWord: '{bench}, seat {n}',
  boards: 'the boards',
  tally: '{n} of 9 oaths hold',
  tallyReady: '{n} of 9 oaths hold. Name the ninth and swear.',
  clear: 'Clear the hall',
  swear: 'Swear the seating',
  skip: 'Skip the showing',
  demoSay: 'Watch once: a man takes his seat, and the plaques answer.',
  help: 'Tap a man, then tap a seat — or drag him across. Tap a seated man to lift him again. Tap a plaque to call that oath the drunken boast.',
  law: 'Each man faces the man across the boards from him. The high seat is at the left of both benches.',
  onFeet: '{name} is on his feet.',
  takes: '{name} takes {seat}.',
  cleared: 'The hall is cleared; every man back on his feet.',
  named: 'Named a boast: {text}',
  withdrawn: 'The accusation is withdrawn.',
  solvedLine: 'The hall stands as it stood that night.',
  noStand: 'The hall does not stand under those oaths.',
  emptySeat: 'Empty: {seat}.',
  seatedAria: '{name} sits at {seat}. Lift him.',
  chipAria: 'Shield-token: {name}. Lift him to a seat.',
  stateHold: 'This oath holds.',
  stateBroken: 'This oath is broken.',
  statePending: 'This oath waits on men not yet seated.',
  accuseAria: 'Call this oath the boast: {text}',
  accuseHint: 'Call it the drunken boast.',
  accused: 'Called the drunken boast.',
  hallAria: 'Near bench: {a}. Far bench: {b}.',
  hallBoast: ' Named a boast: {text}',
  hallNoBoast: ' No oath is called a boast.',
  opening: 'Eight chieftains: {names}. Nine oaths are sworn, and one of them is a boast.',
  emptyDash: '—',
};

// Localized oath sentences. The pure half writes canonical English into
// `oath.text`; the view rebuilds the same sentence from {kind,x,y} so es/ca
// read in the player's tongue. `en` uses `oath.text` verbatim.
const OATH_TPL_EN = {
  opposite: '{x} swore he took his meat across the boards from {y}.',
  'not-adjacent': '{x} and {y} are at feud: they did not touch elbows.',
  'left-of': '{x} sat on the same bench as {y}, nearer the high seat.',
  'same-bench': '{x} and {y} shared one bench.',
};

// Eight shield devices: a closed parametric interlace (k lobes, a depth) over
// a painted field, each with its own paint division. Shape, field colour, ink
// colour and division together keep all eight distinct at thumbnail size.
const DEVICES = [
  { k: -2, a: 2.0, field: 'bone', ink: 'blood', split: 1 },
  { k: 3, a: 0.62, field: 'fjord', ink: 'bone', split: 0 },
  { k: -3, a: 1.35, field: 'pine', ink: 'goldBright', split: 2 },
  { k: 4, a: 0.55, field: 'blood', ink: 'bone', split: 3 },
  { k: -4, a: 1.1, field: 'oakDeep', ink: 'ember', split: 0 },
  { k: 5, a: 0.5, field: 'bone', ink: 'fjord', split: 3 },
  { k: -5, a: 0.95, field: 'gold', ink: 'tar', split: 2 },
  { k: 2, a: 0.72, field: 'boneDim', ink: 'pine', split: 1 },
];

const SEAT_W = 180;
const SEAT_H = 120;
const TOKEN_PX = 132;         // baked shield disc, blitted into seats and chips
const CHIP_W = 120;
const CHIP_H = 136;
const NARROW = '(max-width: 619px)';

// View-side colour maths (the frozen art API exposes palette tokens only).
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sa, sb) => Math.round(sa + (sb - sa) * t);
  const r = ch(pa >> 16, pb >> 16);
  const g = ch((pa >> 8) & 255, (pb >> 8) & 255);
  const bl = ch(pa & 255, pb & 255);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}
function rgbaHex(hex, alpha) {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${alpha})`;
}

// Deterministic view-only micro-noise (the pure half never sees it).
function h32(n) {
  let x = (n | 0) + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}

function mount(ctx) {
  const art = ctx.art;
  const p = art.palette;
  const inst = ctx.instance;
  const lang = ctx.lang || 'en';
  const L = (I18N[lang] && I18N[lang].board) || {};
  const T = (key, params) => {
    let s = key in L ? L[key] : BOARD_EN[key];
    if (params) for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]));
    return s;
  };
  const names = inst.names;

  const cleanup = [];
  const timers = [];
  let motions = [];
  const on = (el, ev, fn, opts) => {
    el.addEventListener(ev, fn, opts);
    cleanup.push(() => el.removeEventListener(ev, fn, opts));
  };
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const sfx = (k) => { try { ctx.audio && ctx.audio.ui && ctx.audio.ui(k); } catch (e) { /* silent hall */ } };
  const say = (t) => { try { ctx.note && ctx.note(t); } catch (e) { /* no journal */ } };
  const node = (tag, css, text) => {
    const n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  };
  const mq = (q) => {
    try { return !!(globalThis.matchMedia && globalThis.matchMedia(q).matches); }
    catch (e) { return false; }
  };
  const calm = () => mq('(prefers-reduced-motion: reduce)');
  const narrow = () => mq(NARROW);

  const oathText = (o) => (lang === 'en'
    ? o.text
    : ((I18N[lang] && I18N[lang].oaths) || OATH_TPL_EN)[o.kind]
      .split('{x}').join(names[o.x]).split('{y}').join(names[o.y]));

  // ---- state: seats[0..7] hold a chieftain index or -1 -------------------
  const seats = new Array(8).fill(-1);
  let boast = -1;
  let held = -1;
  let vertical = narrow();
  if (ctx.solved) {
    const { solutions } = sweepHall(inst.oaths);
    if (solutions.length === 1) {
      solutions[0].pos.forEach((seat, person) => { seats[seat] = person; });
      boast = solutions[0].boast;
    }
  }
  const seatedOf = (person) => seats.indexOf(person);
  const posOf = () => {
    const pos = new Array(8).fill(-1);
    for (let s = 0; s < 8; s++) if (seats[s] >= 0) pos[seats[s]] = s;
    return pos;
  };
  // 'hold' | 'broken' | 'pending' — the continuously visible constraint state
  const oathStateIn = (pos, k) => {
    const o = inst.oaths[k];
    const a = pos[o.x];
    const b = pos[o.y];
    if (a < 0 || b < 0) return 'pending';
    return holdsRaw(o.kind, a, b) ? 'hold' : 'broken';
  };
  let demoPos = null;                                 // the showing's hypothetical hall
  const liveStates = () => {
    const pos = posOf();
    if (demoPos) for (let q = 0; q < 8; q++) if (pos[q] < 0 && demoPos[q] >= 0) pos[q] = demoPos[q];
    return inst.oaths.map((o, k) => oathStateIn(pos, k));
  };

  const benchWord = (s) => (s < 4 ? T('benchNear') : T('benchFar'));
  const seatWord = (s) => T('seatWord', { bench: benchWord(s), n: (s % 4) + 1 });

  // ---- frame -------------------------------------------------------------
  const wrap = node('div', `display:grid;gap:11px;font-family:${SERIF};color:${p.bone}`);
  wrap.className = 'ow12-wrap';
  const style = node('style');
  style.textContent = `
    .ow12-slab{position:absolute;inset:0;line-height:0;pointer-events:none;border-radius:3px;overflow:hidden}
    .ow12-slab canvas{display:block}
    .ow12-plate{position:relative;padding:13px 18px;border-radius:4px;
      background:linear-gradient(168deg,${rgbaHex(p.oakLight, 0.5)},${rgbaHex(p.oak, 0.62)} 55%,${rgbaHex(p.oakDeep, 0.72)});
      box-shadow:0 3px 7px ${rgbaHex(p.tar, 0.5)},inset 0 1px 0 ${rgbaHex(p.bone, 0.1)}}
    .ow12-platetext{position:relative;margin:0;font-size:15.5px;line-height:1.45;color:${p.bone};
      text-shadow:0 -1px 0 ${rgbaHex(p.tar, 0.85)},0 1px 0 ${rgbaHex(p.goldBright, 0.18)}}
    .ow12-cap{margin:0;font-size:12px;color:${p.boneDim};letter-spacing:.13em;text-transform:uppercase}
    .ow12-board{display:grid;gap:7px;grid-template-columns:1fr}
    @media (min-width:620px){.ow12-board{grid-template-columns:1fr 1fr 1fr}}
    .ow12-boast{position:relative;display:block;width:100%;text-align:left;font-family:${SERIF};
      font-size:13.5px;line-height:1.36;color:${p.bone};border-radius:3px;cursor:pointer;
      min-height:60px;padding:10px 12px 10px 34px;
      background:linear-gradient(170deg,${rgbaHex(p.oakLight, 0.34)},${rgbaHex(p.oakDeep, 0.7)});
      border:1px solid ${rgbaHex(p.tar, 0.85)};
      box-shadow:0 2px 4px ${rgbaHex(p.tar, 0.55)},inset 0 1px 0 ${rgbaHex(p.bone, 0.08)};
      transition:transform .12s ease,border-color .18s ease}
    .ow12-boast:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    .ow12-boast[data-state="hold"]{border-color:${rgbaHex(p.gold, 0.75)}}
    .ow12-boast[data-state="broken"]{border-color:${rgbaHex(p.blood, 0.9)}}
    .ow12-boast[aria-pressed="true"]{border-color:${p.ember}}
    .ow12-boasttext{position:relative;display:block}
    .ow12-hall{position:relative;display:grid;gap:9px;padding:10px;border-radius:5px;
      grid-template-columns:1fr;
      background:radial-gradient(120% 80% at 50% 46%,${rgbaHex(p.ember, 0.13)},rgba(0,0,0,0) 70%),
        linear-gradient(180deg,${rgbaHex(p.oakDeep, 0.55)},${rgbaHex(p.tar, 0.6)});
      box-shadow:inset 0 2px 8px ${rgbaHex(p.tar, 0.75)},0 4px 10px ${rgbaHex(p.tar, 0.45)}}
    .ow12-bench{display:grid;gap:0;grid-template-columns:repeat(4,1fr)}
    .ow12-boardsrow{position:relative;min-height:58px}
    @media (max-width:619px){
      .ow12-wrap{display:grid}
      .ow12-plate{order:1}
      .ow12-hallwrap{order:2}
      .ow12-rostercap{order:3}
      .ow12-roster{order:4}
      .ow12-tallybox{order:5}
      .ow12-actions{order:6}
      .ow12-status{order:7}
      .ow12-oathcap{order:8}
      .ow12-board{order:9}
      .ow12-help{order:10}
      .ow12-boast{font-size:13px;padding:9px 10px 9px 30px;min-height:56px}
      .ow12-hall{grid-template-columns:1fr 34px 1fr;align-items:start}
      .ow12-bench{grid-template-columns:1fr;grid-template-rows:repeat(4,auto)}
      .ow12-boardsrow{min-height:0;align-self:stretch}
    }
    .ow12-seat>.ow12-slab,.ow12-chip>.ow12-slab{z-index:-1}
    .ow12-seat,.ow12-chip{position:relative;isolation:isolate;box-sizing:border-box;
      display:grid;align-content:end;justify-items:center;
      padding:0;border:0;background:none;cursor:pointer;border-radius:4px;overflow:hidden;
      font-family:${SERIF};color:${p.tar};font-weight:600;letter-spacing:.01em;line-height:1.05;
      white-space:nowrap;text-shadow:0 1px 0 ${rgbaHex(p.bone, 0.5)};
      transition:transform .12s ease}
    .ow12-seat{aspect-ratio:${SEAT_W} / ${SEAT_H};padding-bottom:.44em;touch-action:manipulation;
      filter:drop-shadow(0 2px 3px ${rgbaHex(p.tar, 0.5)})}
    .ow12-chip{aspect-ratio:${CHIP_W} / ${CHIP_H};padding-bottom:.94em;touch-action:none;
      filter:drop-shadow(0 3px 4px ${rgbaHex(p.tar, 0.55)})}
    .ow12-seat:focus-visible,.ow12-chip:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    .ow12-seat[data-target="1"]{transform:translateY(-2px)}
    .ow12-seat[data-ghost="1"]{opacity:.72}
    .ow12-roster{position:relative;display:flex;gap:7px;flex-wrap:wrap;min-height:96px;
      align-items:flex-start;padding:9px 10px;border-radius:4px;
      background:linear-gradient(180deg,${rgbaHex(p.oakDeep, 0.5)},${rgbaHex(p.tar, 0.55)});
      box-shadow:inset 0 2px 6px ${rgbaHex(p.tar, 0.7)}}
    .ow12-chip{width:clamp(78px,11.5vw,112px);cursor:grab}
    .ow12-chip[data-held="1"]{cursor:grabbing;transform:translateY(-5px)}
    .ow12-chip[data-yearn="1"]{animation:ow12-yearn 2.6s ease-in-out infinite}
    @keyframes ow12-yearn{0%,74%,100%{transform:translateY(0)}82%{transform:translateY(-5px)}90%{transform:translateY(-2px)}}
    .ow12-ghost{position:absolute;left:0;top:0;z-index:3;pointer-events:none;line-height:0}
    .ow12-tallybox{position:relative;line-height:0}
    .ow12-tallybox canvas{display:block;width:100%;height:auto;max-width:520px}
    .ow12-act{font-family:${SERIF};font-size:15px;color:${p.bone};background:${p.oakDeep};
      border:1px solid ${rgbaHex(p.gold, 0.8)};border-radius:3px;padding:11px 18px;min-height:44px;cursor:pointer}
    .ow12-act:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    .ow12-act[disabled]{opacity:.45;cursor:default}
    @media (prefers-reduced-motion: reduce){
      .ow12-seat,.ow12-chip,.ow12-boast{transition:none}
      .ow12-chip[data-yearn="1"]{animation:none}
      .ow12-chip[data-held="1"],.ow12-seat[data-target="1"]{transform:none}
    }
  `;
  wrap.append(style);

  // ---- measured backdrop slabs -------------------------------------------
  // A slab is a canvas painted to whatever box its host element takes, so the
  // carved furniture follows the layout instead of a fixed strip. Canvases are
  // only created once the host has a real box (nothing zero-sized is minted).
  const slabs = [];
  function slabOn(host, painter) {
    const holder = node('span');
    holder.className = 'ow12-slab';
    holder.setAttribute('aria-hidden', 'true');
    host.append(holder);
    const s = { holder, painter, c: null, ctx: null, w: 0, h: 0 };
    slabs.push(s);
    return s;
  }
  // The holder is inset:0 inside its host, so its own box IS the box the
  // backdrop must fill — no border/padding arithmetic to drift out of date.
  function fitSlab(s) {
    const box = s.holder.getBoundingClientRect();
    const w = Math.max(1, Math.round(box.width));
    const h = Math.max(1, Math.round(box.height));
    if (!box.width || !box.height) return false;
    if (s.c && s.w === w && s.h === h) return false;
    const fresh = art.makeCanvas(w, h);
    if (s.c && s.c.parentNode === s.holder) s.holder.replaceChild(fresh.canvas, s.c);
    else s.holder.append(fresh.canvas);
    s.c = fresh.canvas;
    s.ctx = fresh.ctx;
    s.w = w;
    s.h = h;
    return true;
  }

  // ---- the comprehension plate -------------------------------------------
  const plate = node('div');
  plate.className = 'ow12-plate';
  const plateSlab = slabOn(plate, (s) => paintPlaque(s, { tone: 'plate' }));
  const plateText = node('p', null, T('plate'));
  plateText.className = 'ow12-platetext';
  plate.append(plateText);

  // ---- the oath-board ----------------------------------------------------
  const oathCap = node('p', null, T('oathLabel'));
  oathCap.className = 'ow12-cap ow12-oathcap';
  const oathBoard = node('div');
  oathBoard.className = 'ow12-board';
  const plaques = inst.oaths.map((o, k) => {
    const btn = node('button');
    btn.className = 'ow12-boast';
    btn.type = 'button';
    btn.setAttribute('aria-pressed', 'false');
    const line = oathText(o);
    const span = node('span', null, line);
    span.className = 'ow12-boasttext';
    const s = slabOn(btn, null);
    btn.append(span);
    const v = { k, btn, span, slab: s, line, state: 'pending' };
    s.painter = (sl) => paintPlaque(sl, { tone: 'oath', state: v.state, accused: boast === k, k });
    oathBoard.append(btn);
    on(btn, 'click', () => {
      if (ctx.solved) return;
      const nowOn = boast !== k;
      boast = nowOn ? k : -1;
      sfx(nowOn ? 'flip' : 'knock');
      say(nowOn ? T('named', { text: line }) : T('withdrawn'));
      render(nowOn ? T('named', { text: line }) : T('withdrawn'));
    });
    return v;
  });

  // ---- the hall ----------------------------------------------------------
  const hall = node('div');
  hall.className = 'ow12-hall ow12-hallwrap';
  hall.setAttribute('role', 'group');
  const benchA = node('div');
  benchA.className = 'ow12-bench';
  const boardsRow = node('div');
  boardsRow.className = 'ow12-boardsrow';
  const boardsSlab = slabOn(boardsRow, paintBoards);
  const benchB = node('div');
  benchB.className = 'ow12-bench';
  hall.append(benchA, boardsRow, benchB);

  // seat DOM order is seat order 0..7 — the e2e driver indexes .ow12-seat by it
  const seatViews = [];
  for (let s = 0; s < 8; s++) {
    const btn = node('button');
    btn.className = 'ow12-seat';
    btn.type = 'button';
    (s < 4 ? benchA : benchB).append(btn);
    const v = { s, btn, key: '' };
    v.slab = slabOn(btn, () => paintSeat(v, true));
    seatViews.push(v);
    on(btn, 'click', () => touchSeat(s));
    on(btn, 'pointerdown', (ev) => {
      if (ctx.solved || seats[s] < 0) return;
      dragFrom = { person: seats[s], from: s, x: ev.clientX, y: ev.clientY };
    });
  }

  // ---- the roster --------------------------------------------------------
  const rosterCap = node('p', null, T('standing'));
  rosterCap.className = 'ow12-cap ow12-rostercap';
  const roster = node('div');
  roster.className = 'ow12-roster';
  const rosterSlab = slabOn(roster, paintShelf);
  const tokenCache = names.map((nm, person) => bakeToken(person));
  const chipViews = names.map((nm, person) => {
    const btn = node('button', null, nm);   // exact text: both drivers' handle
    btn.className = 'ow12-chip';
    btn.type = 'button';
    btn.setAttribute('aria-label', T('chipAria', { name: nm }));
    const v = { person, btn, key: '' };
    v.slab = slabOn(btn, () => paintChip(v, true));
    on(btn, 'click', () => liftPerson(person));
    on(btn, 'pointerdown', (ev) => {
      if (ctx.solved) return;
      dragFrom = { person, from: -1, x: ev.clientX, y: ev.clientY };
    });
    return v;
  });

  // ---- tally, actions, status --------------------------------------------
  const tallyBox = node('div');
  tallyBox.className = 'ow12-tallybox';
  const tally = art.makeCanvas(520, 58);
  tally.canvas.style.cssText = 'display:block;width:100%;height:auto;max-width:520px';
  tally.canvas.setAttribute('role', 'img');
  tallyBox.append(tally.canvas);

  const actions = node('div', 'display:flex;gap:9px;flex-wrap:wrap;align-items:center');
  actions.className = 'ow12-actions';
  const clearBtn = node('button', null, T('clear'));
  clearBtn.className = 'ow12-act';
  clearBtn.type = 'button';
  const swearBtn = node('button', null, T('swear'));
  swearBtn.className = 'btn-carved';   // one primary-action language: the carved gold plate
  swearBtn.type = 'button';
  const skipBtn = node('button', null, T('skip'));
  skipBtn.className = 'ow12-act';
  skipBtn.type = 'button';
  skipBtn.style.display = 'none';
  actions.append(clearBtn, swearBtn, skipBtn);

  const status = node('p', `margin:0;min-height:20px;font-size:14px;color:${p.boneDim};scroll-margin:28px`);
  status.className = 'ow12-status';
  status.setAttribute('aria-live', 'polite');
  const help = node('p', `margin:0;font-size:12.5px;line-height:1.5;color:${p.boneDim};max-width:70ch`,
    `${T('law')} ${T('help')}`);
  help.className = 'ow12-help';

  wrap.append(plate, oathCap, oathBoard, hall, rosterCap, roster,
    tallyBox, actions, status, help);
  ctx.root.append(wrap);

  // ---- painting: the shield-tokens ---------------------------------------
  // Baked once each: a planked shield face, a painted field, a real over/under
  // interlace device (drawKnot cuts the gaps from the geometry), an iron rim
  // with nailheads and a domed boss. Blitted wherever the man appears.
  function bakeToken(person) {
    const off = art.makeCanvas(TOKEN_PX, TOKEN_PX);
    const c = off.ctx;
    const d = DEVICES[person % DEVICES.length];
    const cx = TOKEN_PX / 2;
    const cy = TOKEN_PX / 2;
    const R = TOKEN_PX * 0.45;
    const field = p[d.field];
    const ink = p[d.ink];

    c.save();
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.clip();

    // 1. the boards behind the paint — a shield is planks, not a disc
    c.fillStyle = mixHex(p.oak, p.oakDeep, 0.3);
    c.fillRect(0, 0, TOKEN_PX, TOKEN_PX);
    for (let i = 0; i < 5; i++) {
      const x = (TOKEN_PX / 5) * i;
      c.strokeStyle = rgbaHex(p.tar, 0.5);
      c.lineWidth = 1.3;
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, TOKEN_PX); c.stroke();
      c.strokeStyle = rgbaHex(p.oakLight, 0.24);
      c.beginPath(); c.moveTo(x + 1.4, 0); c.lineTo(x + 1.4, TOKEN_PX); c.stroke();
    }
    for (let i = 0; i < 26; i++) {
      const x = h32(person * 41 + i) * TOKEN_PX;
      c.strokeStyle = rgbaHex(i % 3 ? p.oakDeep : p.oakLight, 0.12 + h32(person * 53 + i) * 0.1);
      c.lineWidth = 0.7 + h32(person * 59 + i) * 0.9;
      c.beginPath();
      c.moveTo(x, 0);
      c.bezierCurveTo(x + 3, TOKEN_PX * 0.35, x - 3, TOKEN_PX * 0.65, x + 1, TOKEN_PX);
      c.stroke();
    }

    // 2. the paint: worn linseed colour that survives in the grain
    const paintField = (x, y, w, h, hex, alpha) => {
      c.globalAlpha = alpha;
      c.fillStyle = hex;
      c.fillRect(x, y, w, h);
      c.globalAlpha = 1;
    };
    const S = TOKEN_PX;
    if (d.split === 0) paintField(0, 0, S, S, field, 0.82);
    else if (d.split === 1) {
      paintField(0, 0, S / 2, S, field, 0.86);
      paintField(S / 2, 0, S / 2, S, mixHex(field, p.tar, 0.42), 0.8);
    } else if (d.split === 2) {
      paintField(0, 0, S, S / 2, field, 0.86);
      paintField(0, S / 2, S, S / 2, mixHex(field, p.tar, 0.42), 0.8);
    } else {
      paintField(0, 0, S / 2, S / 2, field, 0.86);
      paintField(S / 2, S / 2, S / 2, S / 2, field, 0.86);
      paintField(S / 2, 0, S / 2, S / 2, mixHex(field, p.tar, 0.5), 0.82);
      paintField(0, S / 2, S / 2, S / 2, mixHex(field, p.tar, 0.5), 0.82);
    }
    // paint wear: the grain shows through where hands and shield-walls rubbed
    for (let i = 0; i < 34; i++) {
      const x = h32(person * 67 + i) * S;
      const y = h32(person * 71 + i) * S;
      c.globalAlpha = 0.05 + h32(person * 73 + i) * 0.09;
      c.fillStyle = p.oakDeep;
      c.beginPath();
      c.ellipse(x, y, 2 + h32(person * 79 + i) * 7, 1 + h32(person * 83 + i) * 3, h32(person * 89 + i) * 3, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // 3. the boss, under the device so the strand laces over it
    const bossR = R * 0.2;
    const bossG = c.createRadialGradient(cx - bossR * 0.4, cy - bossR * 0.45, bossR * 0.1, cx, cy, bossR * 1.2);
    bossG.addColorStop(0, mixHex(p.boneDim, p.bone, 0.5));
    bossG.addColorStop(0.5, mixHex(p.oakLight, p.tar, 0.55));
    bossG.addColorStop(1, p.tar);
    c.fillStyle = bossG;
    c.beginPath(); c.arc(cx, cy, bossR, 0, Math.PI * 2); c.fill();

    // 4. the device: a closed parametric interlace, real over/under
    const N = 72;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2;
      const rad = R * 0.74 / (1 + d.a);
      pts.push([
        cx + rad * (Math.cos(t) + d.a * Math.cos(d.k * t)),
        cy + rad * (Math.sin(t) + d.a * Math.sin(d.k * t)),
      ]);
    }
    art.drawKnot(c, pts, { width: Math.max(3.2, R * 0.115), color: ink, gapAtCrossings: R * 0.24 });
    c.restore();

    // 5. iron rim, eight nailheads, seated shadow inside the rim
    c.save();
    const rimW = R * 0.15;
    const rimG = c.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    rimG.addColorStop(0, mixHex(p.boneDim, p.oakLight, 0.55));
    rimG.addColorStop(0.5, mixHex(p.oakLight, p.tar, 0.6));
    rimG.addColorStop(1, p.tar);
    c.strokeStyle = rimG;
    c.lineWidth = rimW;
    c.beginPath(); c.arc(cx, cy, R - rimW / 2, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = rgbaHex(p.tar, 0.85);
    c.lineWidth = 1.3;
    c.beginPath(); c.arc(cx, cy, R - rimW, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = rgbaHex(p.bone, 0.16);
    c.lineWidth = 1;
    c.beginPath(); c.arc(cx, cy, R - rimW * 0.24, Math.PI * 0.9, Math.PI * 1.8); c.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      art.ornament(c, 'nailhead', cx + Math.cos(a) * (R - rimW * 0.55), cy + Math.sin(a) * (R - rimW * 0.55), rimW * 0.78);
    }
    c.restore();
    return off.canvas;
  }

  // ---- painting: the bench planks -----------------------------------------
  // One offscreen per bench in the current orientation; each seat blits its
  // own slice, so the grain, the rails and the wear run true across all four
  // seats instead of restarting at every button.
  const benchBake = [null, null];
  function bakeBench(b) {
    const w = vertical ? SEAT_W : SEAT_W * 4;
    const h = vertical ? SEAT_H * 4 : SEAT_H;
    const off = art.makeCanvas(w, h);
    const c = off.ctx;
    const seed = 1200 + b * 7;
    art.paintWood(c, w, h, seed, { vignette: 0.35 });

    // two long boards make the bench: the seam runs its whole length
    const seamAt = vertical ? w * 0.58 : h * 0.58;
    c.save();
    c.strokeStyle = rgbaHex(p.tar, 0.7);
    c.lineWidth = 2;
    c.beginPath();
    if (vertical) { c.moveTo(seamAt, 0); c.lineTo(seamAt, h); } else { c.moveTo(0, seamAt); c.lineTo(w, seamAt); }
    c.stroke();
    c.strokeStyle = rgbaHex(p.oakLight, 0.3);
    c.lineWidth = 1;
    c.beginPath();
    if (vertical) { c.moveTo(seamAt + 1.6, 0); c.lineTo(seamAt + 1.6, h); } else { c.moveTo(0, seamAt + 1.6); c.lineTo(w, seamAt + 1.6); }
    c.stroke();
    c.restore();

    // the four wear-polished seats: generations sat here
    for (let i = 0; i < 4; i++) {
      const cx = vertical ? w * 0.5 : (i + 0.5) * SEAT_W;
      const cy = vertical ? (i + 0.5) * SEAT_H : h * 0.5;
      const rx = SEAT_W * 0.27;
      const ry = SEAT_H * 0.3;
      const pol = c.createRadialGradient(cx, cy - ry * 0.2, rx * 0.1, cx, cy, rx * 1.5);
      pol.addColorStop(0, rgbaHex(p.bone, 0.13));
      pol.addColorStop(0.55, rgbaHex(p.oakLight, 0.09));
      pol.addColorStop(1, rgbaHex(p.bone, 0));
      c.fillStyle = pol;
      c.beginPath(); c.ellipse(cx, cy, rx * 1.5, ry * 1.5, 0, 0, Math.PI * 2); c.fill();
      // the seat's carved socket ring
      c.strokeStyle = rgbaHex(p.tar, 0.5);
      c.lineWidth = 1.6;
      c.beginPath(); c.ellipse(cx, cy + 2, rx, ry, 0, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = rgbaHex(p.oakLight, 0.24);
      c.lineWidth = 1;
      c.beginPath(); c.ellipse(cx, cy + 3.4, rx, ry, 0, 0, Math.PI * 2); c.stroke();
      // the ordinal, scored where the carpenter numbered the places
      c.save();
      c.globalAlpha = 0.3;
      art.carveText(c, String(i + 1), cx - rx - 12, cy - ry - 4, 15, { color: p.boneDim, depth: 0.8, align: 'center' });
      c.restore();
    }

    // rails: chip-carved wolf-tooth along the outer edge, interlace inboard
    const railLen = vertical ? h : w;
    c.save();
    if (vertical) { c.translate(w - 9, 0); c.rotate(Math.PI / 2); } else { c.translate(0, h - 9); }
    art.ribbonRail(c, 10, 0, railLen - 20, { amp: 3.4, step: 19, alpha: 0.62 });
    c.restore();
    art.chipBorder(c, 3, 3, w - 6, h - 6, { size: 7, alpha: 0.62 });

    // joints marked at the bench ends
    art.rosette(c, 12, 12, 8, { alpha: 0.5 });
    art.rosette(c, w - 12, h - 12, 8, { alpha: 0.5 });

    // dead-zone law: quiet incidental history between the seats — spilled-mead
    // ring stains and knife-scored initials, held below the puzzle's contrast
    for (let i = 0; i < 5; i++) {
      const gx = vertical ? w * (0.12 + h32(seed * 3 + i) * 0.76) : SEAT_W * (i * 0.92 + 0.36);
      const gy = vertical ? SEAT_H * (i * 0.92 + 0.3) : h * (0.12 + h32(seed * 5 + i) * 0.76);
      meadRing(c, gx, gy, 9 + h32(seed * 7 + i) * 7, 0.11 + h32(seed * 11 + i) * 0.05);
    }
    for (let i = 0; i < 4; i++) {
      const gx = vertical ? w * (0.16 + h32(seed * 13 + i) * 0.68) : SEAT_W * (i + 0.14) + h32(seed * 17 + i) * 26;
      const gy = vertical ? SEAT_H * (i + 0.16) + h32(seed * 19 + i) * 20 : h * (0.14 + h32(seed * 23 + i) * 0.16);
      knifeMark(c, gx, gy, 11 + h32(seed * 29 + i) * 5, seed * 31 + i);
    }
    art.wear(c, w, h, `bench:${seed}`);
    return off.canvas;
  }

  // a ring left by a horn set down in its own spill
  function meadRing(c, x, y, r, alpha) {
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = mixHex(p.ember, p.tar, 0.5);
    c.lineWidth = 2.2;
    c.beginPath(); c.ellipse(x, y, r, r * 0.82, 0.2, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = alpha * 0.55;
    c.lineWidth = 1;
    c.beginPath(); c.ellipse(x + 1, y + 1, r * 0.72, r * 0.6, 0.2, 0, Math.PI * 2); c.stroke();
    c.fillStyle = mixHex(p.ember, p.oakDeep, 0.62);
    c.globalAlpha = alpha * 0.4;
    c.beginPath(); c.ellipse(x, y, r * 0.92, r * 0.76, 0.2, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  // knife-scored strokes: somebody idled a blade against the plank
  function knifeMark(c, x, y, size, seed) {
    c.save();
    c.lineCap = 'round';
    const strokes = 3 + Math.floor(h32(seed) * 3);
    for (let i = 0; i < strokes; i++) {
      const a = -Math.PI / 2 + (h32(seed * 3 + i) - 0.5) * 1.5;
      const len = size * (0.5 + h32(seed * 5 + i) * 0.7);
      const sx = x + (h32(seed * 7 + i) - 0.5) * size;
      const sy = y + (h32(seed * 11 + i) - 0.5) * size * 0.5;
      c.strokeStyle = rgbaHex(p.tar, 0.2);
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(sx, sy);
      c.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len);
      c.stroke();
      c.strokeStyle = rgbaHex(p.oakLight, 0.11);
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(sx + 0.9, sy + 0.9);
      c.lineTo(sx + Math.cos(a) * len + 0.9, sy + Math.sin(a) * len + 0.9);
      c.stroke();
    }
    c.restore();
  }

  // ---- painting: the boards (the table between the benches) ---------------
  function paintBoards(s) {
    const c = s.ctx;
    const w = s.w;
    const h = s.h;
    c.clearRect(0, 0, w, h);
    art.paintWood(c, w, h, 1244, { vignette: 0.5 });
    c.save();
    c.fillStyle = rgbaHex(p.tar, 0.32);
    c.fillRect(0, 0, w, h);
    c.restore();
    // trestle planks running the table's length
    const along = vertical ? h : w;
    const across = vertical ? w : h;
    for (let i = 1; i < 3; i++) {
      const t = (across / 3) * i;
      c.strokeStyle = rgbaHex(p.tar, 0.65);
      c.lineWidth = 1.6;
      c.beginPath();
      if (vertical) { c.moveTo(t, 0); c.lineTo(t, h); } else { c.moveTo(0, t); c.lineTo(w, t); }
      c.stroke();
      c.strokeStyle = rgbaHex(p.oakLight, 0.2);
      c.lineWidth = 1;
      c.beginPath();
      if (vertical) { c.moveTo(t + 1.3, 0); c.lineTo(t + 1.3, h); } else { c.moveTo(0, t + 1.3); c.lineTo(w, t + 1.3); }
      c.stroke();
    }
    // hearth pool: the one warm key every screen shares
    art.glow(c, w / 2, h / 2, Math.max(w, h) * 0.45, p.ember, 0.16);
    // the four sightlines — a man faces the man across the boards from him
    c.save();
    c.strokeStyle = rgbaHex(p.goldBright, 0.18);
    c.lineWidth = 1.1;
    if (typeof c.setLineDash === 'function') c.setLineDash([4, 6]);
    for (let i = 0; i < 4; i++) {
      const t = along * ((i + 0.5) / 4);
      c.beginPath();
      if (vertical) { c.moveTo(0, t); c.lineTo(w, t); } else { c.moveTo(t, 0); c.lineTo(t, h); }
      c.stroke();
    }
    if (typeof c.setLineDash === 'function') c.setLineDash([]);
    c.restore();
    // spilled mead and idle knifework on the boards themselves
    for (let i = 0; i < 6; i++) {
      meadRing(c, w * (0.08 + h32(900 + i) * 0.84), h * (0.16 + h32(950 + i) * 0.68),
        7 + h32(980 + i) * 9, 0.12 + h32(1010 + i) * 0.06);
    }
    for (let i = 0; i < 3; i++) {
      knifeMark(c, w * (0.12 + h32(1100 + i) * 0.76), h * (0.2 + h32(1150 + i) * 0.6), 12, 1200 + i);
    }
    if (!vertical && w > 240) {
      c.save();
      c.globalAlpha = 0.4;
      art.carveText(c, T('boards'), w / 2, h * 0.62, Math.min(15, h * 0.3), {
        color: p.boneDim, depth: 0.85, align: 'center', letterSpacing: 3, maxWidth: w * 0.5,
      });
      c.restore();
    }
    art.wear(c, w, h, 'boards', { avoid: { x: w * 0.3, y: h * 0.3, w: w * 0.4, h: h * 0.4 } });
    art.chipBorder(c, 2, 2, w - 4, h - 4, { size: 6, alpha: 0.5 });
  }

  // The floor by the door: a worn board where men stand waiting for a seat.
  // Dead-zone law — quiet tool history at low contrast, never competing.
  function paintShelf(sl) {
    const c = sl.ctx;
    const w = sl.w;
    const h = sl.h;
    c.clearRect(0, 0, w, h);
    art.paintWood(c, w, h, 1288, { vignette: 0.55 });
    c.save();
    c.fillStyle = rgbaHex(p.tar, 0.4);
    c.fillRect(0, 0, w, h);
    c.restore();
    for (let i = 1; i < 4; i++) {
      const y = (h / 4) * i;
      c.strokeStyle = rgbaHex(p.tar, 0.55);
      c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
      c.strokeStyle = rgbaHex(p.oakLight, 0.18);
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, y + 1.2); c.lineTo(w, y + 1.2); c.stroke();
    }
    for (let i = 0; i < 5; i++) {
      meadRing(c, w * (0.06 + h32(1400 + i) * 0.9), h * (0.14 + h32(1450 + i) * 0.74),
        8 + h32(1500 + i) * 8, 0.1 + h32(1550 + i) * 0.05);
    }
    for (let i = 0; i < 4; i++) {
      knifeMark(c, w * (0.1 + h32(1600 + i) * 0.84), h * (0.2 + h32(1650 + i) * 0.6), 12, 1700 + i);
    }
    art.wear(c, w, h, 'shelf12');
    art.chipBorder(c, 2, 2, w - 4, h - 4, { size: 6, alpha: 0.5 });
    art.rosette(c, 12, h - 12, 8, { alpha: 0.4 });
    art.rosette(c, w - 12, h - 12, 8, { alpha: 0.4 });
  }

  // ---- painting: the seats ------------------------------------------------
  function paintSeat(v, force) {
    if (!v.slab.ctx) return;
    const real = seats[v.s];
    const shown = real >= 0 ? real : (demoPos ? demoPos.indexOf(v.s) : -1);
    const occupant = shown;
    const ghosted = real < 0 && shown >= 0;
    const key = `${occupant}|${ghosted ? 'g' : 's'}|${held >= 0 && occupant < 0 ? 1 : 0}|${vertical ? 1 : 0}|${v.slab.w}`;
    if (!force && v.key === key && v.baked === benchBake[v.s < 4 ? 0 : 1]) return;
    v.key = key;
    v.baked = benchBake[v.s < 4 ? 0 : 1];
    const c = v.slab.ctx;
    c.clearRect(0, 0, v.slab.w, v.slab.h);
    c.save();
    c.scale(v.slab.w / SEAT_W, v.slab.h / SEAT_H);
    const b = v.s < 4 ? 0 : 1;
    const i = v.s % 4;
    if (benchBake[b]) {
      // the whole plank, offset by this seat's slice: the grain, the rails and
      // the wear run true across all four seats instead of restarting at each
      if (vertical) c.drawImage(benchBake[b], 0, -i * SEAT_H, SEAT_W, SEAT_H * 4);
      else c.drawImage(benchBake[b], -i * SEAT_W, 0, SEAT_W * 4, SEAT_H);
    }
    const cx = SEAT_W / 2;
    const cy = SEAT_H * 0.42;
    if (occupant >= 0) {
      // seated: the token casts its own shadow into the polished well
      c.save();
      c.fillStyle = rgbaHex(p.tar, 0.55);
      c.beginPath();
      c.ellipse(cx + 4, cy + SEAT_H * 0.3, SEAT_W * 0.2, SEAT_H * 0.075, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
      const R = SEAT_H * 0.72;
      if (ghosted) c.globalAlpha = 0.55;
      c.drawImage(tokenCache[occupant], cx - R / 2, cy - R / 2, R, R);
      c.globalAlpha = 1;
      namePlaque(c, 26, 92, 128, 22, 700 + v.s * 13, false, ghosted);
    } else {
      // empty: the socket falls away, and lights when a man is on his feet
      c.save();
      c.fillStyle = rgbaHex(p.tar, 0.38);
      c.beginPath();
      c.ellipse(cx, cy + 4, SEAT_W * 0.24, SEAT_H * 0.19, 0, 0, Math.PI * 2);
      c.fill();
      art.insetFace(c, 14, 12, SEAT_W - 28, SEAT_H - 24, { depth: 0.42, lip: 0.06 });
      if (held >= 0) {
        art.glow(c, cx, cy + 4, SEAT_W * 0.3, p.goldBright, 0.28);
        c.strokeStyle = rgbaHex(p.goldBright, 0.75);
        c.lineWidth = 1.6;
        if (typeof c.setLineDash === 'function') c.setLineDash([5, 4]);
        c.beginPath();
        c.ellipse(cx, cy + 4, SEAT_W * 0.24, SEAT_H * 0.19, 0, 0, Math.PI * 2);
        c.stroke();
        if (typeof c.setLineDash === 'function') c.setLineDash([]);
      }
      c.restore();
      namePlaque(c, 26, 92, 128, 22, 700 + v.s * 13, true);
    }
    c.restore();
  }

  // the roster token: the same shield, standing rather than seated
  function paintChip(v, force) {
    if (!v.slab.ctx) return;
    const key = `${v.slab.w}`;
    if (!force && v.key === key) return;
    v.key = key;
    const c = v.slab.ctx;
    c.clearRect(0, 0, v.slab.w, v.slab.h);
    c.save();
    c.scale(v.slab.w / CHIP_W, v.slab.h / CHIP_H);
    c.fillStyle = rgbaHex(p.tar, 0.5);
    c.beginPath();
    c.ellipse(CHIP_W / 2 + 3, CHIP_H * 0.78, CHIP_W * 0.3, CHIP_H * 0.055, 0, 0, Math.PI * 2);
    c.fill();
    c.drawImage(tokenCache[v.person], 6, 4, CHIP_W - 12, CHIP_W - 12);
    namePlaque(c, 8, 100, CHIP_W - 16, 28, 400 + v.person * 17);
    c.restore();
  }

  // a bone plaque nailed to the wood — the DOM name sits over it, so the
  // lettering stays crisp type at any width and the plaque stays carved
  function namePlaque(c, x, y, w, h, seed, blank, ghosted) {
    c.save();
    if (ghosted) c.globalAlpha = 0.55;
    const g = c.createLinearGradient(0, y, 0, y + h);
    if (blank) {
      g.addColorStop(0, rgbaHex(p.tar, 0.34));
      g.addColorStop(0.6, rgbaHex(p.oakDeep, 0.18));
      g.addColorStop(1, rgbaHex(p.oakLight, 0.12));
    } else {
      g.addColorStop(0, mixHex(p.bone, p.oakLight, 0.22));
      g.addColorStop(0.55, mixHex(p.boneDim, p.oakLight, 0.3));
      g.addColorStop(1, mixHex(p.boneDim, p.tar, 0.4));
    }
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
    if (!blank) {
      for (let i = 0; i < 9; i++) {
        const gx = x + h32(seed * 13 + i * 29) * w;
        c.strokeStyle = rgbaHex(p.oakDeep, 0.1);
        c.lineWidth = 0.7;
        c.beginPath(); c.moveTo(gx, y + 1); c.lineTo(gx + 2, y + h - 1); c.stroke();
      }
    }
    c.strokeStyle = rgbaHex(p.tar, blank ? 0.5 : 0.85);
    c.lineWidth = blank ? 1 : 1.2;
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    c.strokeStyle = rgbaHex(p.bone, blank ? 0.09 : 0.3);
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(x + 1, y + h - 1.5); c.lineTo(x + w - 1, y + h - 1.5); c.stroke();
    if (!blank) {
      art.ornament(c, 'nailhead', x + 6, y + h / 2, 3.4);
      art.ornament(c, 'nailhead', x + w - 6, y + h / 2, 3.4);
    }
    c.restore();
  }

  // ---- painting: the plaques ---------------------------------------------
  // The oath-board's state is the puzzle's feedback channel: warm gold light
  // pooling out of a plaque means its oath holds, a red smoulder in the grain
  // means it is broken, cold means it still waits on a man.
  function paintPlaque(s, opts) {
    const c = s.ctx;
    const w = s.w;
    const h = s.h;
    c.clearRect(0, 0, w, h);
    const seed = opts.tone === 'plate' ? 'plate12' : `oath12:${opts.k}`;
    art.paintWood(c, w, h, seed, { vignette: 0.4 });
    c.save();
    c.fillStyle = rgbaHex(p.oakDeep, opts.tone === 'plate' ? 0.34 : 0.44);
    c.fillRect(0, 0, w, h);
    c.restore();

    const state = opts.state || 'plate';
    if (state === 'hold') {
      art.glow(c, 17, h / 2, Math.max(w, h) * 0.6, p.goldBright, 0.3);
      c.save();
      c.strokeStyle = rgbaHex(p.goldBright, 0.5);
      c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(17, 11); c.lineTo(17, h - 11); c.stroke();
      c.restore();
    } else if (state === 'broken') {
      art.glow(c, 17, h / 2, Math.max(w, h) * 0.62, p.blood, 0.42);
      art.glow(c, 17, h / 2, Math.max(w, h) * 0.3, p.ember, 0.3);
      c.save();
      // a smouldering split in the grain, ember at its lips
      c.strokeStyle = rgbaHex(p.tar, 0.9);
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(17, 10);
      for (let i = 1; i <= 5; i++) c.lineTo(17 + (h32(opts.k * 17 + i) - 0.5) * 7, 10 + ((h - 20) * i) / 5);
      c.stroke();
      c.strokeStyle = rgbaHex(p.ember, 0.75);
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(18, 10);
      for (let i = 1; i <= 5; i++) c.lineTo(18 + (h32(opts.k * 17 + i) - 0.5) * 7, 10 + ((h - 20) * i) / 5);
      c.stroke();
      c.restore();
    } else if (state === 'pending') {
      c.save();
      c.strokeStyle = rgbaHex(p.oakLight, 0.36);
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(17, 13); c.lineTo(17, h - 13); c.stroke();
      c.restore();
    }

    if (opts.accused) {
      // the mead-stain brand: an oath sworn in drink, and it keeps the mark
      c.save();
      const st = c.createLinearGradient(0, 0, w, h);
      st.addColorStop(0, rgbaHex(mixHex(p.ember, p.oakDeep, 0.55), 0.42));
      st.addColorStop(0.6, rgbaHex(mixHex(p.blood, p.oakDeep, 0.4), 0.34));
      st.addColorStop(1, rgbaHex(p.tar, 0.3));
      c.fillStyle = st;
      c.fillRect(0, 0, w, h);
      meadRing(c, w * 0.78, h * 0.42, Math.min(h * 0.44, 22), 0.5);
      meadRing(c, w * 0.9, h * 0.72, Math.min(h * 0.3, 15), 0.38);
      c.strokeStyle = rgbaHex(p.ember, 0.85);
      c.lineWidth = 2;
      c.strokeRect(1.5, 1.5, w - 3, h - 3);
      c.restore();
    }

    art.chipBorder(c, 2, 2, w - 4, h - 4, { size: 6, alpha: opts.tone === 'plate' ? 0.7 : 0.55 });
    if (opts.tone === 'plate') {
      art.ribbonRail(c, 14, h - 7, Math.max(40, w - 28), { amp: 2.6, step: 17, alpha: 0.5 });
      art.rosette(c, 12, 12, 7, { alpha: 0.45 });
      art.rosette(c, w - 12, 12, 7, { alpha: 0.45 });
      art.wear(c, w, h, 'plate12', { avoid: { x: 24, y: 6, w: w - 48, h: h - 12 } });
    } else {
      art.wear(c, w, h, seed, { avoid: { x: 28, y: 4, w: w - 34, h: h - 8 } });
    }
    // the carved lip that seats the plaque in the board
    c.save();
    c.strokeStyle = rgbaHex(p.tar, 0.85);
    c.lineWidth = 1.4;
    c.strokeRect(0.7, 0.7, w - 1.4, h - 1.4);
    c.strokeStyle = rgbaHex(p.bone, 0.1);
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(2, h - 1.6); c.lineTo(w - 2, h - 1.6); c.stroke();
    c.restore();
  }

  // ---- painting: the carved tally -----------------------------------------
  function paintTally() {
    const c = tally.ctx;
    const W = tally.w;
    const H = tally.h;
    const states = liveStates();
    const n = states.filter((x) => x === 'hold').length;
    c.clearRect(0, 0, W, H);
    art.paintWood(c, W, H, 'tally12', { vignette: 0.45 });
    c.save();
    c.fillStyle = rgbaHex(p.oakDeep, 0.4);
    c.fillRect(0, 0, W, H);
    c.restore();
    art.chipBorder(c, 2, 2, W - 4, H - 4, { size: 6, alpha: 0.55 });
    // nine notches, cut and gold-filled as the oaths come true
    const x0 = 18;
    const pitch = 19;
    for (let i = 0; i < 9; i++) {
      const x = x0 + i * pitch;
      const top = 13;
      const bot = H - 14;
      c.save();
      c.lineCap = 'round';
      // the cut itself, in every notch
      c.strokeStyle = rgbaHex(p.tar, 0.92);
      c.lineWidth = 5;
      c.beginPath(); c.moveTo(x, top); c.lineTo(x - 4, bot); c.stroke();
      if (i < n) {
        art.glow(c, x - 2, H / 2, 11, p.goldBright, 0.5);
        c.strokeStyle = p.goldBright;
        c.lineWidth = 3.2;
        c.beginPath(); c.moveTo(x, top); c.lineTo(x - 4, bot); c.stroke();
        c.strokeStyle = rgbaHex(p.bone, 0.85);
        c.lineWidth = 1.1;
        c.beginPath(); c.moveTo(x - 0.8, top + 1); c.lineTo(x - 4.8, bot - 1); c.stroke();
      } else {
        c.strokeStyle = rgbaHex(p.oakLight, 0.42);
        c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(x + 1, top + 0.8); c.lineTo(x - 3, bot); c.stroke();
      }
      c.restore();
    }
    const ready = n === 8;
    const line = ready ? T('tallyReady', { n }) : T('tally', { n });
    const tx = x0 + 9 * pitch + 10;
    art.carveText(c, line, tx, H * 0.63, 16, {
      color: ready ? p.goldBright : p.bone, depth: 0.85, maxWidth: W - tx - 14,
    });
    tally.canvas.setAttribute('aria-label', line);
  }

  // ---- layout: fit every measured slab to its host ------------------------
  let layoutRaf = 0;
  function layout() {
    layoutRaf = 0;
    const wasVertical = vertical;
    vertical = narrow();
    if (!benchBake[0] || wasVertical !== vertical) {
      benchBake[0] = bakeBench(0);
      benchBake[1] = bakeBench(1);
      for (const v of seatViews) v.key = '';
    }
    render(undefined);          // chips only enter the DOM here — measure after
    // the name plaques carry DOM type, sized to the box the grid actually gave
    const seatBox = seatViews[0].btn.getBoundingClientRect();
    if (seatBox.width) {
      const px = Math.max(10.5, Math.min(15.5, seatBox.width * 0.098));
      for (const v of seatViews) v.btn.style.fontSize = `${px}px`;
    }
    const chipBox = chipViews[0].btn.getBoundingClientRect();
    if (chipBox.width) {
      const px = Math.max(9.5, Math.min(14, chipBox.width * 0.125));
      for (const v of chipViews) v.btn.style.fontSize = `${px}px`;
    }
    for (const s of slabs) if (fitSlab(s) && s.ctx) s.painter(s);
  }
  const scheduleLayout = () => {
    if (layoutRaf) return;
    layoutRaf = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame(layout) : later(layout, 16);
  };

  // ---- interaction --------------------------------------------------------
  let dragFrom = null;
  on(document, 'pointerup', (ev) => {
    const d = dragFrom;
    dragFrom = null;
    if (!d || ctx.solved) return;
    if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) <= 8) return;   // a tap, not a drag
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    const seatEl = el && el.closest ? el.closest('.ow12-seat') : null;
    if (!seatEl) return;
    const seat = seatViews.findIndex((v) => v.btn === seatEl);
    if (seat < 0) return;
    takeTheChisel();
    if (d.from >= 0) seats[d.from] = -1;
    held = d.person;
    placeAt(seat);
  });

  function liftPerson(person) {
    if (ctx.solved) return;
    takeTheChisel();
    held = held === person ? -1 : person;
    sfx('tick');
    render(held < 0 ? '' : T('onFeet', { name: names[held] }));
  }
  function touchSeat(s) {
    if (ctx.solved) return;
    takeTheChisel();
    if (held < 0) {
      if (seats[s] < 0) { sfx('deny'); return; }
      held = seats[s];
      seats[s] = -1;
      sfx('tick');
      render(T('onFeet', { name: names[held] }));
      return;
    }
    placeAt(s);
  }
  function placeAt(s) {
    const person = held;
    const previous = seats[s];
    const from = seatedOf(person);
    const before = liveStates().filter((x) => x === 'hold').length;
    if (from >= 0) seats[from] = previous;        // straight swap between seats
    else if (previous >= 0) seats[s] = -1;        // the sitting man stands up
    seats[s] = person;
    held = previous >= 0 && from < 0 ? previous : -1;
    sfx('slide');
    say(T('takes', { name: names[person], seat: seatWord(s) }));
    render(held >= 0 ? T('onFeet', { name: names[held] }) : '');
    const after = liveStates().filter((x) => x === 'hold').length;
    if (after > before) later(() => sfx('tick'), 90);
  }

  // ---- render -------------------------------------------------------------
  function hallWords() {
    const line = (b) => [0, 1, 2, 3]
      .map((i) => (seats[b * 4 + i] >= 0 ? names[seats[b * 4 + i]] : T('emptyDash'))).join(', ');
    return T('hallAria', { a: line(0), b: line(1) })
      + (boast >= 0 ? T('hallBoast', { text: plaques[boast].line }) : T('hallNoBoast'));
  }

  function render(announce) {
    const states = liveStates();
    for (const v of seatViews) {
      paintSeat(v);
      const real = seats[v.s];
      const occupant = real >= 0 ? real : (demoPos ? demoPos.indexOf(v.s) : -1);
      v.btn.dataset.ghost = real < 0 && occupant >= 0 ? '1' : '0';
      const label = occupant >= 0 ? names[occupant] : '';
      if (v.btn.textContent !== label || v.slab.holder.parentNode !== v.btn) {
        v.btn.textContent = label;                       // this drops the children
        if (typeof v.btn.insertBefore === 'function' && v.btn.firstChild) {
          v.btn.insertBefore(v.slab.holder, v.btn.firstChild);
        } else v.btn.append(v.slab.holder);
      }
      v.btn.dataset.target = held >= 0 && real < 0 ? '1' : '0';
      v.btn.setAttribute('aria-label', real >= 0
        ? T('seatedAria', { name: names[real], seat: seatWord(v.s) })
        : T('emptySeat', { seat: seatWord(v.s) }));
    }
    for (const v of chipViews) if (v.btn.parentNode === roster) roster.removeChild(v.btn);
    for (const v of chipViews) {
      v.btn.dataset.held = held === v.person ? '1' : '0';
      paintChip(v);
      if (seatedOf(v.person) < 0) roster.append(v.btn);
    }
    if (held >= 0 && seatedOf(held) < 0) roster.append(chipViews[held].btn);
    for (const v of plaques) {
      const next = states[v.k];
      const changed = v.state !== next || v.accusedShown !== (boast === v.k);
      v.state = next;
      v.accusedShown = boast === v.k;
      v.btn.dataset.state = next;
      v.btn.setAttribute('aria-pressed', boast === v.k ? 'true' : 'false');
      v.btn.setAttribute('aria-label', `${T('accuseAria', { text: v.line })} `
        + `${T(next === 'hold' ? 'stateHold' : next === 'broken' ? 'stateBroken' : 'statePending')} `
        + (boast === v.k ? T('accused') : T('accuseHint')));
      if (changed && v.slab.ctx) {
        v.slab.painter(v.slab);
        if (!calm() && typeof v.btn.animate === 'function') {
          try { motions.push(v.btn.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-2px)' }, { transform: 'translateY(0)' }], { duration: 210, easing: 'ease-out' })); }
          catch (e) { /* no WAAPI */ }
        }
      }
    }
    paintTally();
    hall.setAttribute('aria-label', hallWords());
    swearBtn.disabled = !!ctx.solved || seats.some((s) => s < 0) || boast < 0;
    if (announce !== undefined) status.textContent = announce;
  }

  // ---- the showing: a ghost hand seats one man, the plaques answer ---------
  const demoPair = [inst.oaths.length ? inst.oaths[0].x : 0, inst.oaths.length ? inst.oaths[0].y : 1];
  const demoSeatB = 4;                       // across the boards from seat 0
  const demoStart = (() => {
    const q = new Array(8).fill(-1);
    q[demoPair[0]] = 0;
    return q;
  })();
  const ghostHost = node('div');
  ghostHost.className = 'ow12-ghost';
  ghostHost.setAttribute('aria-hidden', 'true');
  ghostHost.style.display = 'none';
  hall.append(ghostHost);
  const ghost = art.makeCanvas(96, 96);
  ghost.canvas.style.cssText = 'display:block;width:100%;height:100%';
  ghostHost.append(ghost.canvas);
  paintGhost();
  let touched = !!ctx.solved;

  function paintGhost() {
    const c = ghost.ctx;
    c.clearRect(0, 0, 96, 96);
    c.save();
    art.glow(c, 48, 48, 44, p.goldBright, 0.5);
    c.globalAlpha = 0.9;
    c.drawImage(tokenCache[demoPair[1]], 10, 10, 76, 76);
    c.globalAlpha = 1;
    c.strokeStyle = p.goldBright;
    c.lineWidth = 2;
    if (typeof c.setLineDash === 'function') c.setLineDash([6, 4]);
    c.beginPath(); c.arc(48, 48, 41, 0, Math.PI * 2); c.stroke();
    if (typeof c.setLineDash === 'function') c.setLineDash([]);
    c.restore();
  }

  function endShowing(quiet) {
    if (ghostHost.style.display === 'none') return;
    for (const m of motions) { try { m.cancel(); } catch (e) { /* already gone */ } }
    motions = [];
    ghostHost.style.display = 'none';
    skipBtn.style.display = 'none';
    demoPos = null;
    render(quiet ? undefined : '');
  }

  function takeTheChisel() {
    if (touched) return;
    touched = true;
    endShowing(true);
    for (const v of chipViews) v.btn.dataset.yearn = '0';
  }

  function showTheWay() {
    if (ctx.solved || touched) return;
    const chipBox = chipViews[demoPair[1]].btn.getBoundingClientRect();
    const seatBox = seatViews[demoSeatB].btn.getBoundingClientRect();
    const hallBox = hall.getBoundingClientRect();
    if (!chipBox.width || !seatBox.width || !hallBox.width) return;
    const size = Math.min(seatBox.width * 0.5, 78);
    ghostHost.style.width = `${size}px`;
    ghostHost.style.height = `${size}px`;
    const x0 = chipBox.left + chipBox.width / 2 - hallBox.left - size / 2;
    const y0 = chipBox.top + chipBox.width / 2 - hallBox.top - size / 2;
    const x1 = seatBox.left + seatBox.width / 2 - hallBox.left - size / 2;
    const y1 = seatBox.top + seatBox.height * 0.42 - hallBox.top - size / 2;
    ghostHost.style.display = 'block';
    ghostHost.style.transform = `translate(${Math.round(x1)}px,${Math.round(y1)}px)`;
    skipBtn.style.display = '';
    status.textContent = T('demoSay');
    demoPos = demoStart.slice();
    render(undefined);

    // The showing has to make an oath RESOLVE, and an oath needs both its men
    // seated: the first sits as a ghost from the start, the hand carries the
    // second, and on his landing the plaques answer.
    const preview = () => {
      demoPos = demoStart.slice();
      demoPos[demoPair[1]] = demoSeatB;
      render(undefined);
    };
    if (!calm() && typeof ghostHost.animate === 'function') {
      try {
        const m = ghostHost.animate([
          { transform: `translate(${x0}px,${y0}px)`, opacity: 0 },
          { transform: `translate(${x0}px,${y0 - 10}px)`, opacity: 1, offset: 0.16 },
          { transform: `translate(${x1}px,${y1 - 10}px)`, opacity: 1, offset: 0.6 },
          { transform: `translate(${x1}px,${y1}px)`, opacity: 1, offset: 0.72 },
          { transform: `translate(${x1}px,${y1}px)`, opacity: 0 },
        ], { duration: 2500, easing: 'ease-in-out' });
        motions.push(m);
      } catch (e) { /* no WAAPI: the static variant below still teaches it */ }
      later(preview, 1800);
    } else {
      preview();   // reduced motion: the ghost rests in the seat, plaques lit
    }
    later(() => endShowing(false), 3000);
  }

  // ---- wiring -------------------------------------------------------------
  on(clearBtn, 'click', () => {
    if (ctx.solved) return;
    takeTheChisel();
    seats.fill(-1);
    held = -1;
    boast = -1;
    sfx('knock');
    say(T('cleared'));
    render('');
  });
  on(skipBtn, 'click', () => { takeTheChisel(); status.textContent = ''; });
  on(swearBtn, 'click', () => {
    if (ctx.solved || seats.some((s) => s < 0) || boast < 0) { sfx('deny'); return; }
    // The two benches are the same hall read from either side; write it down
    // from the bench holding the alphabetically-first chieftain (module header).
    const first = seats.indexOf(0);
    const order = first < 4 ? [0, 1] : [1, 0];
    const benches = order.map((b) => [0, 1, 2, 3].map((i) => names[seats[b * 4 + i]]));
    say(hallWords());
    const res = ctx.submit({ benches, boast }) || {};
    if (!res.ok) {
      status.textContent = res.near || T('noStand');
      if (status.scrollIntoView) status.scrollIntoView({ block: 'nearest' });
    }
  });
  if (globalThis.window && globalThis.window.addEventListener) on(globalThis.window, 'resize', scheduleLayout);

  if (ctx.solved) {
    clearBtn.disabled = true;
    swearBtn.disabled = true;
    for (const v of chipViews) v.btn.disabled = true;
    for (const v of seatViews) v.btn.disabled = true;
    for (const v of plaques) v.btn.disabled = true;
  }

  say(T('opening', { names: names.join(', ') }));
  layout();
  render(ctx.solved ? T('solvedLine') : '');
  if (!ctx.solved) later(showTheWay, 260);
  else later(scheduleLayout, 0);

  return {
    unmount() {
      for (const f of cleanup) f();
      cleanup.length = 0;
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
      for (const m of motions) { try { m.cancel(); } catch (e) { /* already gone */ } }
      motions = [];
      if (layoutRaf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(layoutRaf);
      layoutRaf = 0;
      dragFrom = null;
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------- i18n
// Additive per-lock block (docs/CONTRACT.md §4.1 amendment). English lives in
// the frozen fields above; `nearMap` keys are the canonical English near-lines
// returned by verify(). The nine oath sentences are rebuilt from {kind,x,y}
// through `oaths`, so the board reads in the player's tongue.
const I18N = {
  es: {
    title: 'Los Bancos del Convite',
    epigraph: 'La cerveza juró nueve juramentos en aquella mesa. Ocho de ellos estaban sobrios.',
    hints: [
      'Nueve hombres juraron. Uno estaba bebido. Los otros ocho concuerdan entre sí — y con una sola disposición del salón.',
      'Toma un juramento y dalo por la bravata: táchalo y mira si los ocho restantes pueden sentar el salón siquiera. La mayoría no puede.',
      'Empieza por los juramentos más fuertes. Un hombre puesto al otro lado de la mesa queda fijado en ambos bancos a la vez, y una enemistad te dice dónde NO está un hombre.',
    ],
    nearMap: {
      'Not one oath is broken in that hall. One of them must be.': 'En ese salón no se rompe ni un juramento. Uno de ellos ha de romperse.',
      'The oath you named as the boast still stands in that hall.': 'El juramento que señalaste como bravata sigue en pie en ese salón.',
      'More than one oath falls, and only one man was drunk.': 'Cae más de un juramento, y solo un hombre estaba bebido.',
    },
    oaths: {
      opposite: '{x} juró que comió su carne al otro lado de la mesa, frente a {y}.',
      'not-adjacent': '{x} e {y} están enemistados: no se rozaron los codos.',
      'left-of': '{x} se sentó en el mismo banco que {y}, más cerca del asiento alto.',
      'same-bench': '{x} e {y} compartieron un mismo banco.',
    },
    board: {
      plate: 'Sienta a los ocho de modo que se sostenga cada juramento — salvo uno, la bravata del bebido. Nómbrala.',
      oathLabel: 'El tablón de juramentos — nueve placas, y una se juró en la bebida',
      standing: 'Aún en pie',
      benchNear: 'el banco cercano',
      benchFar: 'el banco lejano',
      seatWord: '{bench}, asiento {n}',
      boards: 'la mesa',
      tally: '{n} de 9 juramentos se sostienen',
      tallyReady: '{n} de 9 juramentos se sostienen. Nombra el noveno y jura.',
      clear: 'Vaciar el salón',
      swear: 'Jurar la disposición',
      skip: 'Saltar la muestra',
      demoSay: 'Mira una vez: un hombre toma asiento y las placas responden.',
      help: 'Toca a un hombre y luego un asiento — o arrástralo. Toca a un hombre sentado para levantarlo. Toca una placa para llamar bravata a ese juramento.',
      law: 'Cada hombre queda frente al que tiene al otro lado de la mesa. El asiento alto está a la izquierda en ambos bancos.',
      onFeet: '{name} queda en pie.',
      takes: '{name} toma {seat}.',
      cleared: 'El salón queda vacío; todos de nuevo en pie.',
      named: 'Bravata señalada: {text}',
      withdrawn: 'Se retira la acusación.',
      solvedLine: 'El salón se sostiene tal como se sostuvo aquella noche.',
      noStand: 'El salón no se sostiene bajo esos juramentos.',
      emptySeat: 'Vacío: {seat}.',
      seatedAria: '{name} está sentado en {seat}. Levántalo.',
      chipAria: 'Escudo de {name}. Levántalo hacia un asiento.',
      stateHold: 'Este juramento se sostiene.',
      stateBroken: 'Este juramento está roto.',
      statePending: 'Este juramento espera a hombres aún sin sentar.',
      accuseAria: 'Llama bravata a este juramento: {text}',
      accuseHint: 'Llámalo la bravata del bebido.',
      accused: 'Señalado como bravata del bebido.',
      hallAria: 'Banco cercano: {a}. Banco lejano: {b}.',
      hallBoast: ' Bravata señalada: {text}',
      hallNoBoast: ' Ningún juramento está señalado como bravata.',
      opening: 'Ocho caudillos: {names}. Se juraron nueve juramentos, y uno de ellos es una bravata.',
      emptyDash: '—',
    },
  },
  ca: {
    title: 'Els Bancs del Convit',
    epigraph: 'La cervesa va jurar nou juraments en aquella taula. Vuit d’ells estaven sobris.',
    hints: [
      'Nou homes van jurar. Un anava begut. Els altres vuit concorden entre ells — i amb una sola disposició de la sala.',
      'Pren un jurament i dona’l per la bravata: ratlla’l i mira si els vuit restants poden asseure la sala ni que sigui. La majoria no poden.',
      'Comença pels juraments més forts. Un home posat a l’altre costat de la taula queda fixat als dos bancs alhora, i una enemistat et diu on NO és un home.',
    ],
    nearMap: {
      'Not one oath is broken in that hall. One of them must be.': 'En aquella sala no es trenca ni un jurament. Un d’ells s’ha de trencar.',
      'The oath you named as the boast still stands in that hall.': 'El jurament que has assenyalat com a bravata encara s’aguanta en aquella sala.',
      'More than one oath falls, and only one man was drunk.': 'Cau més d’un jurament, i només un home anava begut.',
    },
    oaths: {
      opposite: '{x} va jurar que va menjar la carn a l’altre costat de la taula, davant de {y}.',
      'not-adjacent': '{x} i {y} estan enemistats: no es van fregar els colzes.',
      'left-of': '{x} va seure al mateix banc que {y}, més a prop del seient alt.',
      'same-bench': '{x} i {y} van compartir un mateix banc.',
    },
    board: {
      plate: 'Asseu els vuit de manera que s’aguanti cada jurament — llevat d’un, la bravata del begut. Anomena-la.',
      oathLabel: 'El tauler de juraments — nou plaques, i una es va jurar beguda',
      standing: 'Encara drets',
      benchNear: 'el banc del davant',
      benchFar: 'el banc del fons',
      seatWord: '{bench}, seient {n}',
      boards: 'la taula',
      tally: '{n} de 9 juraments s’aguanten',
      tallyReady: '{n} de 9 juraments s’aguanten. Anomena el novè i jura.',
      clear: 'Buidar la sala',
      swear: 'Jurar la disposició',
      skip: 'Saltar la mostra',
      demoSay: 'Mira-ho un cop: un home pren seient i les plaques responen.',
      help: 'Toca un home i després un seient — o arrossega’l. Toca un home assegut per alçar-lo. Toca una placa per anomenar bravata aquell jurament.',
      law: 'Cada home queda davant del qui té a l’altre costat de la taula. El seient alt és a l’esquerra dels dos bancs.',
      onFeet: '{name} queda dret.',
      takes: '{name} pren {seat}.',
      cleared: 'La sala queda buida; tothom dret de nou.',
      named: 'Bravata assenyalada: {text}',
      withdrawn: 'Es retira l’acusació.',
      solvedLine: 'La sala s’aguanta tal com s’aguantava aquella nit.',
      noStand: 'La sala no s’aguanta sota aquells juraments.',
      emptySeat: 'Buit: {seat}.',
      seatedAria: '{name} seu a {seat}. Alça’l.',
      chipAria: 'Escut de {name}. Alça’l cap a un seient.',
      stateHold: 'Aquest jurament s’aguanta.',
      stateBroken: 'Aquest jurament està trencat.',
      statePending: 'Aquest jurament espera homes encara no asseguts.',
      accuseAria: 'Anomena bravata aquest jurament: {text}',
      accuseHint: 'Anomena’l la bravata del begut.',
      accused: 'Assenyalat com a bravata del begut.',
      hallAria: 'Banc del davant: {a}. Banc del fons: {b}.',
      hallBoast: ' Bravata assenyalada: {text}',
      hallNoBoast: ' Cap jurament no està assenyalat com a bravata.',
      opening: 'Vuit cabdills: {names}. Es van jurar nou juraments, i un d’ells és una bravata.',
      emptyDash: '—',
    },
  },
};

export default {
  id: '12-veitsla',
  ordinal: 12,
  tier: 4,
  title: 'The Feast Benches',
  epigraph: 'Ale swore nine oaths at that table. Eight of them were sober.',

  makePuzzle(rng) {
    const names = rng.shuffle(ROSTER).slice(0, 8).sort();
    const flat = canonicalSeatings();
    const strip = (built) => ({
      names,
      oaths: built.oaths.map((o) => ({ kind: o.kind, x: o.x, y: o.y, text: o.text })),
    });
    let unique = null; // a hall that is unique but short of decoys — the soft fallback
    for (let attempt = 0; attempt < 40; attempt++) {
      const pos = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
      if (pos[0] >= 4) for (let p = 0; p < 8; p++) pos[p] = (pos[p] + 4) % 8; // canonicalise
      for (let re = 0; re < 4; re++) {
        const built = buildOaths(rng, names, pos, flat);
        if (!built) continue;
        const { solutions, nearMisses } = sweepHall(built.oaths, flat);
        if (solutions.length !== 1 || solutions[0].boast !== built.boastIndex) continue;
        if (decoysFor(nearMisses, built.boastIndex).length >= 3) return strip(built);
        if (!unique) unique = built;
      }
    }
    return strip(unique || { oaths: [] });
  },

  solve(instance) {
    const { solutions } = sweepHall(instance.oaths);
    if (solutions.length !== 1) return { benches: [[], []], boast: -1 };
    return {
      benches: seatingToBenches(solutions[0].pos, instance.names),
      boast: solutions[0].boast,
    };
  },

  verify(instance, answer) {
    try {
      if (!instance || !answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
      const { benches, boast } = answer;
      if (!Array.isArray(benches) || benches.length !== 2) return { ok: false };
      if (!benches.every((b) => Array.isArray(b) && b.length === 4 && b.every((s) => typeof s === 'string'))) return { ok: false };
      if (!Number.isInteger(boast) || boast < 0 || boast >= instance.oaths.length) return { ok: false };
      const seated = benches[0].concat(benches[1]);
      if (new Set(seated).size !== 8) return { ok: false };
      if (!seated.every((n) => instance.names.includes(n))) return { ok: false };
      if (!benches[0].includes(instance.names[0])) {
        return { ok: false, near: `The hall is read from the bench that holds ${instance.names[0]}.` };
      }
      const pos = benchesToPos(benches, instance.names);
      if (!pos) return { ok: false };
      const mask = violations(instance.oaths, pos);
      if (mask === 1 << boast) return { ok: true };
      if (mask === 0) return { ok: false, near: 'Not one oath is broken in that hall. One of them must be.' };
      if ((mask & (1 << boast)) === 0) return { ok: false, near: 'The oath you named as the boast still stands in that hall.' };
      return { ok: false, near: 'More than one oath falls, and only one man was drunk.' };
    } catch {
      return { ok: false };
    }
  },

  wrongAnswers(instance) {
    const self = this;
    const { solutions, nearMisses } = sweepHall(instance.oaths);
    const out = [];
    const seen = new Set();
    if (!solutions.length) return out;
    const truth = solutions[0];
    const push = (benches, boast) => {
      const ans = { benches, boast };
      const key = JSON.stringify(ans);
      if (seen.has(key) || self.verify(instance, ans).ok) return;
      seen.add(key);
      out.push(ans);
    };

    for (const d of decoysFor(nearMisses, truth.boast).slice(0, 4)) {
      push(seatingToBenches(d.pos, instance.names), truth.boast);
    }
    const trueBenches = seatingToBenches(truth.pos, instance.names);
    for (let k = 0; k < instance.oaths.length && out.length < 9; k++) {
      if (k !== truth.boast) push([trueBenches[0].slice(), trueBenches[1].slice()], k);
    }
    push([trueBenches[1].slice(), trueBenches[0].slice()], truth.boast); // benches swapped
    const swapped = [trueBenches[0].slice(), trueBenches[1].slice()];
    [swapped[0][0], swapped[0][3]] = [swapped[0][3], swapped[0][0]];
    push(swapped, truth.boast);
    push([trueBenches[0].slice().reverse(), trueBenches[1].slice()], truth.boast);
    return out;
  },

  shard() {
    return { ...SHARDS['12-veitsla'] };
  },

  difficulty: { searchSpace: 3.6e5, minSteps: 28, estMinutes: 18 },

  hints: [
    'Nine men swore. One was in his cups. The other eight agree with each other — and with one seating only.',
    'Take an oath and assume it is the boast: strike it out, then see whether the remaining eight can seat the hall at all. Most of them cannot.',
    'Work from the strongest oaths first. A man set across the boards is set on both benches at once, and a feud tells you where a man is not.',
  ],

  i18n: I18N,

  mount,
};
