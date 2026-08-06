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

  mount(ctx) {
    const art = ctx.art;
    const p = art.palette;
    const inst = ctx.instance;
    const self = this;

    const cleanup = [];
    const on = (el, ev, fn, opts) => {
      el.addEventListener(ev, fn, opts);
      cleanup.push(() => el.removeEventListener(ev, fn, opts));
    };
    const sfx = (k) => { try { ctx.audio && ctx.audio.ui && ctx.audio.ui(k); } catch (e) { /* silent hall */ } };
    const say = (t) => { try { ctx.note && ctx.note(t); } catch (e) { /* no journal */ } };
    const node = (tag, css, text) => {
      const n = document.createElement(tag);
      if (css) n.style.cssText = css;
      if (text != null) n.textContent = text;
      return n;
    };

    const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";
    const names = inst.names;

    // ---- state: seats[0..7] hold a chieftain index or -1 ------------------
    const seats = new Array(8).fill(-1);
    let boast = -1;
    let held = -1;
    if (ctx.solved) {
      const truth = self.solve(inst);
      truth.benches[0].concat(truth.benches[1]).forEach((nm, s) => { seats[s] = names.indexOf(nm); });
      boast = truth.boast;
    }
    const seatedOf = (person) => seats.indexOf(person);

    // ---- frame -----------------------------------------------------------
    const wrap = node('div', `display:grid;gap:12px;font-family:${SERIF};color:${p.bone}`);
    const style = node('style');
    style.textContent = `
      .ow12-act{font-family:${SERIF};font-size:15px;color:${p.bone};background:${p.oakDeep};
        border:1px solid ${p.gold};border-radius:3px;padding:11px 16px;min-height:44px;cursor:pointer}
      .ow12-act:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow12-act[disabled]{opacity:.45;cursor:default}
      .ow12-bench{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
      .ow12-seat{font-family:${SERIF};font-size:15px;color:${p.bone};background:${p.oakDeep};
        border:1px solid ${p.oakLight};border-radius:3px;min-height:56px;padding:8px 6px;cursor:pointer;
        display:flex;align-items:center;justify-content:center;text-align:center}
      .ow12-seat:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow12-seat[data-empty="1"]{color:${p.boneDim};border-style:dashed}
      .ow12-seat[data-target="1"]{border-color:${p.goldBright};box-shadow:inset 0 0 0 1px ${p.gold}}
      .ow12-chip{font-family:${SERIF};font-size:15px;color:${p.bone};background:${p.oak};
        border:1px solid ${p.oakLight};border-radius:3px;min-height:44px;padding:10px 14px;cursor:grab;touch-action:none}
      .ow12-chip:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow12-chip[data-held="1"]{border-color:${p.goldBright};color:${p.goldBright};cursor:grabbing}
      .ow12-oath{display:flex;gap:10px;align-items:center;justify-content:space-between;
        border-bottom:1px solid ${p.oakDeep};padding:7px 0}
      .ow12-oathtext{font-size:14.5px;color:${p.bone};max-width:52ch}
      .ow12-boast{font-family:${SERIF};font-size:13px;color:${p.boneDim};background:none;
        border:1px solid ${p.oakLight};border-radius:999px;padding:8px 14px;min-height:44px;cursor:pointer;white-space:nowrap}
      .ow12-boast:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow12-boast[aria-pressed="true"]{border-color:${p.blood};color:${p.bone};background:${p.blood}}
    `;
    wrap.append(style);

    const hall = art.makeCanvas(720, 250);
    hall.canvas.style.cssText = 'width:100%;height:auto;display:block;border-radius:4px';
    hall.canvas.setAttribute('role', 'img');

    const benchALabel = node('p', `margin:0;font-size:13px;color:${p.boneDim};letter-spacing:.06em`, 'The near bench — high seat at the left');
    const benchA = node('div');
    benchA.className = 'ow12-bench';
    const boards = node('p', `margin:2px 0;text-align:center;font-size:12.5px;color:${p.boneDim};letter-spacing:.14em`, '— the boards —');
    const benchB = node('div');
    benchB.className = 'ow12-bench';
    const benchBLabel = node('p', `margin:0;font-size:13px;color:${p.boneDim};letter-spacing:.06em`, 'The far bench — high seat at the left, each man facing the one above him');

    const seatBtns = [];
    for (let s = 0; s < 8; s++) {
      const b = node('button');
      b.className = 'ow12-seat';
      b.type = 'button';
      seatBtns.push(b);
      (s < 4 ? benchA : benchB).append(b);
      on(b, 'click', () => touchSeat(s));
    }

    const rosterLabel = node('p', `margin:0;font-size:13px;color:${p.boneDim};letter-spacing:.06em`, 'Still standing');
    const roster = node('div', 'display:flex;gap:8px;flex-wrap:wrap;min-height:48px');
    const chipBtns = names.map((nm, person) => {
      const b = node('button', null, nm);
      b.className = 'ow12-chip';
      b.type = 'button';
      on(b, 'click', () => liftPerson(person));
      on(b, 'pointerdown', (ev) => { dragFrom = { person, x: ev.clientX, y: ev.clientY }; });
      return b;
    });

    const oathsLabel = node('p', `margin:0;font-size:13px;color:${p.boneDim};letter-spacing:.06em`,
      'Nine oaths were sworn. Mark the one you take for a drunken boast.');
    const oathList = node('div', 'display:grid');
    const boastBtns = inst.oaths.map((o, k) => {
      const row = node('div');
      row.className = 'ow12-oath';
      const t = node('span', null, o.text);
      t.className = 'ow12-oathtext';
      const b = node('button', null, 'the boast');
      b.className = 'ow12-boast';
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', `Call this oath the boast: ${o.text}`);
      on(b, 'click', () => {
        if (ctx.solved) return;
        boast = boast === k ? -1 : k;
        sfx(boast === k ? 'flip' : 'knock');
        say(boast === k ? `Named a boast: ${o.text}` : 'The accusation is withdrawn.');
        render('');
      });
      row.append(t, b);
      oathList.append(row);
      return b;
    });

    const help = node('p', `margin:0;font-size:12.5px;color:${p.boneDim};max-width:62ch`,
      'Tap a man, then tap a seat — or drag him there. Tap a seated man to lift him again. '
      + `The hall is written down from whichever bench holds ${names[0]}, so either side may be the near one.`);

    const actions = node('div', 'display:flex;gap:9px;flex-wrap:wrap;align-items:center');
    const clearBtn = node('button', null, 'Clear the hall');
    const swearBtn = node('button', null, 'Swear the seating');
    for (const b of [clearBtn, swearBtn]) { b.className = 'ow12-act'; b.type = 'button'; }
    actions.append(clearBtn, swearBtn);

    const status = node('p', `margin:0;min-height:20px;font-size:14px;color:${p.boneDim}`);
    status.setAttribute('aria-live', 'polite');

    wrap.append(hall.canvas, benchALabel, benchA, boards, benchB, benchBLabel,
      rosterLabel, roster, oathsLabel, oathList, help, actions, status);
    ctx.root.append(wrap);

    // ---- drag ------------------------------------------------------------
    let dragFrom = null;
    on(document, 'pointerup', (ev) => {
      if (!dragFrom || ctx.solved) { dragFrom = null; return; }
      const moved = Math.hypot(ev.clientX - dragFrom.x, ev.clientY - dragFrom.y) > 8;
      const person = dragFrom.person;
      dragFrom = null;
      if (!moved) return;
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      const seat = seatBtns.indexOf(target);
      if (seat >= 0) { held = person; placeAt(seat); }
    });

    // ---- interaction -----------------------------------------------------
    function liftPerson(person) {
      if (ctx.solved) return;
      held = held === person ? -1 : person;
      sfx('tick');
      render(held < 0 ? '' : `${names[held]} is on his feet.`);
    }
    function touchSeat(s) {
      if (ctx.solved) return;
      if (held < 0) {
        if (seats[s] < 0) { sfx('deny'); return; }
        held = seats[s];
        seats[s] = -1;
        sfx('tick');
        render(`${names[held]} is on his feet.`);
        return;
      }
      placeAt(s);
    }
    function placeAt(s) {
      const person = held;
      const previous = seats[s];
      const from = seatedOf(person);
      if (from >= 0) seats[from] = previous;      // straight swap between seats
      else if (previous >= 0) seats[s] = -1;      // the sitting man stands up
      seats[s] = person;
      held = previous >= 0 && from < 0 ? previous : -1;
      sfx('slide');
      say(`${names[person]} takes ${seatWord(s)}.`);
      render(held >= 0 ? `${names[held]} is on his feet.` : '');
    }
    const seatWord = (s) => `${s < 4 ? 'the near bench' : 'the far bench'}, seat ${(s % 4) + 1}`;

    // ---- painting --------------------------------------------------------
    function paint() {
      const c = hall.ctx;
      const W = hall.w;
      const H = hall.h;
      c.clearRect(0, 0, W, H);
      art.paintWood(c, W, H, 1202);
      art.paintPanel(c, 6, 6, W - 12, H - 12);
      const cellW = (W - 80) / 4;
      for (let s = 0; s < 8; s++) {
        const col = s % 4;
        const x = 40 + col * cellW + cellW / 2;
        const y = s < 4 ? 74 : H - 74;
        c.save();
        c.strokeStyle = p.oakLight;
        c.lineWidth = 2;
        c.beginPath();
        c.roundRect ? c.roundRect(x - cellW / 2 + 8, y - 26, cellW - 16, 52, 4)
          : c.rect(x - cellW / 2 + 8, y - 26, cellW - 16, 52);
        c.stroke();
        c.fillStyle = seats[s] >= 0 ? p.bone : p.boneDim;
        c.font = `${seats[s] >= 0 ? 15 : 13}px ${SERIF}`;
        c.textAlign = 'center';
        c.fillText(seats[s] >= 0 ? names[seats[s]] : 'empty', x, y + 5);
        c.restore();
        if (s < 4) {
          c.save();
          c.strokeStyle = p.oakDeep;
          c.lineWidth = 1;
          c.setLineDash([3, 5]);
          c.beginPath();
          c.moveTo(x, y + 30);
          c.lineTo(x, H - 108);
          c.stroke();
          c.restore();
        }
      }
      c.save();
      c.fillStyle = p.boneDim;
      c.font = `13px ${SERIF}`;
      c.textAlign = 'center';
      c.fillText('the boards', W / 2, H / 2 + 4);
      c.restore();
    }

    function hallWords() {
      const line = (b) => [0, 1, 2, 3].map((i) => (seats[b * 4 + i] >= 0 ? names[seats[b * 4 + i]] : '—')).join(', ');
      return `Near bench: ${line(0)}. Far bench: ${line(1)}.`
        + (boast >= 0 ? ` Named a boast: ${inst.oaths[boast].text}` : ' No oath is called a boast.');
    }

    function render(announce) {
      paint();
      hall.canvas.setAttribute('aria-label', hallWords());
      for (let s = 0; s < 8; s++) {
        const b = seatBtns[s];
        b.textContent = seats[s] >= 0 ? names[seats[s]] : `${seatWord(s)}`;
        b.dataset.empty = seats[s] >= 0 ? '0' : '1';
        b.dataset.target = held >= 0 && seats[s] < 0 ? '1' : '0';
        b.setAttribute('aria-label', seats[s] >= 0
          ? `${names[seats[s]]} sits on ${seatWord(s)}. Lift him.`
          : `Empty: ${seatWord(s)}.`);
      }
      roster.textContent = '';
      for (let person = 0; person < names.length; person++) {
        const b = chipBtns[person];
        b.dataset.held = held === person ? '1' : '0';
        if (seatedOf(person) < 0) roster.append(b);
      }
      if (held >= 0 && seatedOf(held) < 0) roster.append(chipBtns[held]);
      for (let k = 0; k < boastBtns.length; k++) boastBtns[k].setAttribute('aria-pressed', boast === k ? 'true' : 'false');
      swearBtn.disabled = !!ctx.solved || seats.some((s) => s < 0) || boast < 0;
      if (announce !== undefined) status.textContent = announce;
    }

    on(clearBtn, 'click', () => {
      if (ctx.solved) return;
      seats.fill(-1);
      held = -1;
      boast = -1;
      sfx('knock');
      say('The hall is cleared; every man back on his feet.');
      render('');
    });
    on(swearBtn, 'click', () => {
      if (ctx.solved || seats.some((s) => s < 0) || boast < 0) { sfx('deny'); return; }
      // The two benches are the same hall read from either side; write it down
      // from the bench holding the alphabetically-first chieftain (module header).
      const first = seats.indexOf(0);
      const order = first < 4 ? [0, 1] : [1, 0];
      const benches = order.map((b) => [0, 1, 2, 3].map((i) => names[seats[b * 4 + i]]));
      say(hallWords());
      const res = ctx.submit({ benches, boast }) || {};
      if (!res.ok) status.textContent = res.near || 'The hall does not stand under those oaths.';
    });

    if (ctx.solved) {
      clearBtn.disabled = true;
      swearBtn.disabled = true;
      for (const b of chipBtns) b.disabled = true;
      for (const b of seatBtns) b.disabled = true;
      for (const b of boastBtns) b.disabled = true;
    }

    say(`Eight chieftains: ${names.join(', ')}. Nine oaths are sworn, and one of them is a boast.`);
    render(ctx.solved ? 'The hall stands as it stood that night.' : '');

    return {
      unmount() {
        for (const f of cleanup) f();
        cleanup.length = 0;
        wrap.remove();
      },
    };
  },
};
