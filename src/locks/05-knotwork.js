// 05 — THE OSEBERG KNOT (tier 2, combination)
//
// A four-by-four panel of strand tiles. Carved tiles cannot be moved; the free
// tiles are crossings, and each may be laid either way — the standing band over
// the running band, or under it. Lay the panel so the whole weave is knotwork.
//
// ENTRY-CURVE AMENDMENT (docs/LOCKS.md): six to eight free crossings, not eight
// to twelve. The panel stays four-by-four and the aha is the same one — the
// weave law fixes every remaining tile once you find the band — but there are
// fewer toggles between seeing it and having it.
//
// THE TWO LAWS (stated plainly to the player in the journal):
//   band law  — one band, unbroken, runs the whole panel and returns to itself.
//   weave law — following that band, every crossing goes over, then under, then
//               over: never twice the same.
//
// Pure half: no DOM, no globals, no Math.random, no Date. Only the seeded rng.
//
// CONSTRUCTION. Cell kinds are 'cross' (bands north-south and west-east) and
// two bends; the frame joins the sixteen border ports in adjacent pairs at one
// of two offsets. Kinds and frame alone fix the weave's path, so the generator
// re-rolls until the panel is exactly one closed band over all sixty-four
// ports. A single closed band admits exactly two alternating layings (one the
// inverse of the other); the one or two carved crossings pin one of them, so
// exactly one laying of the free tiles answers both laws. Checked by the literal
// 2^free sweep.
//
// Difficulty accounting: the band must be walked through all sixteen tiles of
// the panel before a single crossing can be laid with confidence, and then the
// free tiles are laid (all but one start wrong) and the oath sworn — fourteen
// acts, and no fewer.

import { SHARDS } from '../kernel/shards.js';
import { rng } from '../kernel/rng.js';

const SIDE = 4;
const CELLS = SIDE * SIDE;
const PORTS = CELLS * 4;
const N = 0, E = 1, S = 2, W = 3;
const FREE_MIN = 6;   // ENTRY-CURVE AMENDMENT: one aha, fewer toggles
const FREE_MAX = 8;
const REROLL_CAP = 4000;

const portId = (cell, dir) => cell * 4 + dir;

const ARCS = {
  cross: [[N, S], [W, E]],
  bendA: [[N, W], [E, S]],
  bendB: [[N, E], [S, W]],
};

function arcPartner(kind, dir) {
  for (const [a, b] of ARCS[kind]) {
    if (a === dir) return b;
    if (b === dir) return a;
  }
  return -1;
}

// The sixteen border ports, clockwise from the north-west.
function borderRing() {
  const ring = [];
  for (let c = 0; c < SIDE; c++) ring.push(portId(c, N));
  for (let r = 0; r < SIDE; r++) ring.push(portId(r * SIDE + (SIDE - 1), E));
  for (let c = SIDE - 1; c >= 0; c--) ring.push(portId((SIDE - 1) * SIDE + c, S));
  for (let r = SIDE - 1; r >= 0; r--) ring.push(portId(r * SIDE, W));
  return ring;
}

export function buildLinks(border) {
  const links = new Array(PORTS).fill(-1);
  for (let r = 0; r < SIDE; r++) {
    for (let c = 0; c < SIDE; c++) {
      const cell = r * SIDE + c;
      if (c < SIDE - 1) {
        const a = portId(cell, E), b = portId(cell + 1, W);
        links[a] = b; links[b] = a;
      }
      if (r < SIDE - 1) {
        const a = portId(cell, S), b = portId(cell + SIDE, N);
        links[a] = b; links[b] = a;
      }
    }
  }
  const ring = borderRing();
  const off = border === 'B' ? 1 : 0;
  for (let k = 0; k < ring.length; k += 2) {
    const a = ring[(k + off) % ring.length], b = ring[(k + 1 + off) % ring.length];
    links[a] = b; links[b] = a;
  }
  return links;
}

// Follow the band from port 0. Returns whether it is one closed band over every
// port, and the order in which it meets the crossings.
export function traceBand(cells, links) {
  const seen = new Array(PORTS).fill(false);
  const seq = [];
  let p = 0;
  let count = 0;
  while (p >= 0 && !seen[p]) {
    const cell = p >> 2, dir = p & 3;
    const kind = cells[cell] && cells[cell].kind;
    if (!ARCS[kind]) return { single: false, seq: [] };
    const out = arcPartner(kind, dir);
    seen[p] = true;
    seen[portId(cell, out)] = true;
    count += 2;
    if (kind === 'cross') seq.push({ cell, band: (dir === N || dir === S) ? 'ns' : 'we' });
    p = links[portId(cell, out)];
  }
  return { single: count === PORTS && p === 0, seq };
}

// Number of places where the band goes over twice running (0 = lawful weave).
function weaveBreaks(seq, overOf) {
  const len = seq.length;
  if (!len || len % 2 !== 0) return len || 1;
  let breaks = 0;
  for (let q = 0; q < len; q++) {
    const a = seq[q], b = seq[(q + 1) % len];
    if ((overOf[a.cell] === a.band) === (overOf[b.cell] === b.band)) breaks++;
  }
  return breaks;
}

function overMap(instance, states) {
  const map = new Array(CELLS).fill(null);
  instance.cells.forEach((c, i) => { if (c.kind === 'cross' && c.carved) map[i] = c.over; });
  instance.free.forEach((cell, i) => { map[cell] = states[i] ? 'ns' : 'we'; });
  return map;
}

function seqOf(instance) {
  return traceBand(instance.cells, buildLinks(instance.border)).seq;
}

// Every laying of the free tiles that answers both laws (the literal sweep).
function validStates(instance) {
  const seq = seqOf(instance);
  const n = instance.free.length;
  const out = [];
  for (let mask = 0; mask < (1 << n); mask++) {
    const states = [];
    for (let i = 0; i < n; i++) states.push((mask >> i & 1) === 1);
    if (weaveBreaks(seq, overMap(instance, states)) === 0) out.push(states);
  }
  return out;
}

function makePuzzle(rng) {
  for (let attempt = 0; attempt < REROLL_CAP; attempt++) {
    const border = rng.chance(0.5) ? 'A' : 'B';
    const order = [];
    for (let i = 0; i < CELLS; i++) order.push(i);
    const bendCells = rng.shuffle(order).slice(0, rng.range(2, 3));

    const cells = [];
    for (let i = 0; i < CELLS; i++) cells.push({ kind: 'cross', carved: false });
    for (const i of bendCells) cells[i] = { kind: rng.chance(0.5) ? 'bendA' : 'bendB', carved: true };

    const links = buildLinks(border);
    const { single, seq } = traceBand(cells, links);
    if (!single) continue;

    // A single closed band always alternates; check it rather than trust it.
    const first = new Map();
    let lawful = true;
    seq.forEach((s, q) => {
      if (!first.has(s.cell)) first.set(s.cell, q);
      else if ((first.get(s.cell) % 2) === (q % 2)) lawful = false;
    });
    if (!lawful) continue;

    const crossCells = cells.map((c, i) => (c.kind === 'cross' ? i : -1)).filter((i) => i >= 0);
    const freeCount = rng.range(FREE_MIN, FREE_MAX);
    if (crossCells.length <= freeCount) continue; // at least one carved crossing

    // One of the two alternating layings is the truth.
    const g = rng.int(2);
    const truth = new Array(CELLS).fill(null);
    seq.forEach((s, q) => { if (q % 2 === g) truth[s.cell] = s.band; });

    const free = rng.shuffle(crossCells).slice(0, freeCount).sort((a, b) => a - b);
    for (const i of crossCells) {
      if (free.indexOf(i) >= 0) continue;
      cells[i] = { kind: 'cross', carved: true, over: truth[i] };
    }

    // Laid wrong at the start in every place but one — never the plain inverse.
    const answer = free.map((cell) => truth[cell] === 'ns');
    const kept = rng.int(freeCount);
    const initial = answer.map((v, i) => (i === kept ? v : !v));

    const instance = { border, cells, free, initial };

    const valid = validStates(instance);
    if (valid.length !== 1) continue;
    if (JSON.stringify(valid[0]) !== JSON.stringify(answer)) continue;

    return instance;
  }
  return makePuzzle(rng);
}

function solve(instance) {
  const valid = validStates(instance);
  return { states: valid.length ? valid[0] : [] };
}

function verify(instance, answer) {
  try {
    if (!instance || !Array.isArray(instance.cells) || !Array.isArray(instance.free)) return { ok: false };
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
    const states = answer.states;
    if (!Array.isArray(states) || states.length !== instance.free.length) return { ok: false };
    for (const s of states) if (typeof s !== 'boolean') return { ok: false };

    const seq = seqOf(instance);
    if (!seq.length) return { ok: false };
    const breaks = weaveBreaks(seq, overMap(instance, states));
    if (breaks === 0) return { ok: true };
    if (breaks === 1) return { ok: false, near: 'The band doubles over in one place.' };
    return { ok: false, near: `The band doubles over in ${breaks} places.` };
  } catch (e) {
    return { ok: false };
  }
}

function wrongAnswers(instance) {
  const right = solve(instance).states;
  const key = JSON.stringify(right);
  const out = [];
  const push = (states) => { if (JSON.stringify(states) !== key) out.push({ states }); };

  push(right.map((s) => !s));
  push(right.map(() => true));
  push(right.map(() => false));
  push(instance.free.map((cell) => cell % 2 === 0));
  push(instance.free.map((cell) => (((cell >> 2) + (cell & 3)) % 2) === 0));
  push(instance.initial.slice());
  for (const i of [0, right.length >> 1, right.length - 1]) {
    push(right.map((s, j) => (j === i ? !s : s)));
  }

  const seen = new Set();
  return out.filter((a) => {
    const k = JSON.stringify(a.states);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
// ------------------------------------------------------------------ the view
//
// The panel is a woodcarver's work in progress, clamped in its tray on the
// bench. Carved crossings are FINISHED — cut deep, gold cord in the groove,
// old pigment surviving in the shadow, nailed down. Free crossings are still
// only CHALK: setting-out lines on raw planed oak, hatched where the chisel has
// yet to go. Turning one lays that chalk the other way, and the band gleams
// along the whole stretch that now reads as one piece — which is how the panel
// teaches unicursality without a sentence. The tally rail under the work counts
// the pieces the weave still reads as; one band is the goal.

const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";
const TILE = 88;
const PANEL = TILE * SIDE;
const PIP_SLOTS = 14;

// Both form factors are first-class, so the bench comes two ways: laid wide
// with the tools to either hand, or stood tall with the tools along the near
// edge. Same tile size in both, so the touch target never shrinks.
const BENCH = {
  wide: { w: 760, h: 438, px: 204, py: 20, rail: { x: 200, y: 398, w: PANEL + 8, h: 32 } },
  tall: { w: 392, h: 566, px: 20, py: 24, rail: { x: 16, y: 524, w: PANEL + 8, h: 32 } },
};

// View-side colour maths (the frozen art API hands over tokens, not a mixer).
function hexToRgb(h) {
  const v = parseInt(h.slice(1), 16);
  return [v >> 16 & 255, v >> 8 & 255, v & 255];
}
function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const ch = (i) => Math.round(A[i] + (B[i] - A[i]) * t);
  return `#${((ch(0) << 16) | (ch(1) << 8) | ch(2)).toString(16).padStart(6, '0')}`;
}

// Port midpoints inside a cell, and the arc that joins a pair of them.
function arcPoints(dir, other) {
  const mid = { [N]: [TILE / 2, 0], [E]: [TILE, TILE / 2], [S]: [TILE / 2, TILE], [W]: [0, TILE / 2] };
  const a = mid[dir], b = mid[other];
  if ((dir === N && other === S) || (dir === S && other === N)
    || (dir === E && other === W) || (dir === W && other === E)) return [a, b];

  const corner = [
    (dir === E || other === E) ? TILE : 0,
    (dir === S || other === S) ? TILE : 0,
  ];
  const pts = [];
  const a0 = Math.atan2(a[1] - corner[1], a[0] - corner[0]);
  let a1 = Math.atan2(b[1] - corner[1], b[0] - corner[0]);
  while (a1 - a0 > Math.PI) a1 -= Math.PI * 2;
  while (a0 - a1 > Math.PI) a1 += Math.PI * 2;
  for (let i = 0; i <= 14; i++) {
    const t = a0 + (a1 - a0) * (i / 14);
    pts.push([corner[0] + Math.cos(t) * (TILE / 2), corner[1] + Math.sin(t) * (TILE / 2)]);
  }
  return pts;
}

// Resample a polyline to roughly even steps, so cutting and gleaming along it
// behave the same on straights and on bends.
function densify(pts, step) {
  if (pts.length < 2) return pts.slice();
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / step));
    for (let k = 1; k <= n; k++) out.push([x0 + (x1 - x0) * (k / n), y0 + (y1 - y0) * (k / n)]);
  }
  return out;
}

// The band that runs UNDER is cut around the crossing — a real hole in the
// cord, not a redraw order. Returns the surviving stretches.
// Push the ends that sit on a tile boundary a little past it, so a cord meets
// its neighbour under the join instead of showing two round caps as a knuckle.
function extendEnds(pts, amount, x0, y0) {
  if (pts.length < 2) return pts;
  const out = pts.map((q) => q.slice());
  const onEdge = ([x, y]) => {
    const u = x - x0, v = y - y0;
    return u < 0.7 || v < 0.7 || u > TILE - 0.7 || v > TILE - 0.7;
  };
  const push = (i, j) => {
    const a = out[i], b = out[j];
    const dx = a[0] - b[0], dy = a[1] - b[1];
    const len = Math.hypot(dx, dy) || 1;
    out[i] = [a[0] + (dx / len) * amount, a[1] + (dy / len) * amount];
  };
  if (onEdge(out[0])) push(0, 1);
  const n = out.length - 1;
  if (onEdge(out[n])) push(n, n - 1);
  return out;
}

function cutAround(pts, cx, cy, r) {
  const d = densify(pts, 3);
  const runs = [];
  let cur = [];
  for (const q of d) {
    if (Math.hypot(q[0] - cx, q[1] - cy) < r) {
      if (cur.length > 1) runs.push(cur);
      cur = [];
    } else cur.push(q);
  }
  if (cur.length > 1) runs.push(cur);
  return runs;
}

function polyLen(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return cum;
}

function sliceByLen(pts, cum, l0, l1) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    if (cum[i] < l0 || cum[i] > l1) continue;
    out.push(pts[i]);
  }
  return out;
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

  const cleanup = [];
  const timers = [];
  const on = (el, ev, fn, opts) => {
    el.addEventListener(ev, fn, opts);
    cleanup.push(() => el.removeEventListener(ev, fn, opts));
  };
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const sfx = (k) => { try { ctx.audio && ctx.audio.ui && ctx.audio.ui(k); } catch (e) { /* silent hall */ } };
  const say = (text) => { try { ctx.note && ctx.note(text); } catch (e) { /* no journal */ } };
  const reduced = () => {
    try { return !!(globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  };
  const wideBench = () => {
    try { return !!(globalThis.matchMedia && globalThis.matchMedia('(min-width: 640px)').matches); } catch (e) { return true; }
  };
  const node = (tag, css, text) => {
    const n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  };

  const where = (cell) => T('where', { r: (cell >> 2) + 1, c: (cell & 3) + 1 });

  const B = wideBench() ? BENCH.wide : BENCH.tall;
  const PBOX = { x: B.px, y: B.py, w: PANEL, h: PANEL };

  // ---- state -------------------------------------------------------------
  const links = buildLinks(instance.border);
  const seq = traceBand(instance.cells, links).seq;
  const states = ctx.solved ? solve(instance).states : instance.initial.slice();
  let focused = instance.free.length ? instance.free[0] : 0;
  let keysSaid = false;
  let touched = false;
  let demoCell = -1;         // the showing previews a turn without spending it
  let nearFault = null;      // [cellA, cellB]: the first doubling-over along the band
  let gleam = null;
  let rafId = 0;

  const overNow = () => {
    const map = new Array(CELLS).fill(null);
    instance.cells.forEach((c, i) => { if (c.kind === 'cross' && c.carved) map[i] = c.over; });
    instance.free.forEach((cell, i) => {
      const s = cell === demoCell ? !states[i] : states[i];
      map[cell] = s ? 'ns' : 'we';
    });
    return map;
  };

  // Walk the band exactly as traceBand does, keeping the geometry of every
  // step, so a stretch of the run can be drawn as one continuous path.
  const walk = (() => {
    const steps = [];
    const stepOfSeq = [];
    const seen = new Array(PORTS).fill(false);
    let q = 0;
    while (q >= 0 && !seen[q]) {
      const cell = q >> 2, dir = q & 3;
      const kind = instance.cells[cell].kind;
      const out = arcPartner(kind, dir);
      if (out < 0) break;
      seen[q] = true;
      seen[portId(cell, out)] = true;
      if (kind === 'cross') stepOfSeq.push(steps.length);
      const x0 = B.px + (cell & 3) * TILE, y0 = B.py + (cell >> 2) * TILE;
      steps.push(arcPoints(dir, out).map(([x, y]) => [x0 + x, y0 + y]));
      q = links[portId(cell, out)];
    }
    return { steps, stepOfSeq };
  })();

  // Where the band doubles over: the seq indices after which the run is cut.
  function breaksOf(map) {
    const n = seq.length;
    const brk = [];
    for (let i = 0; i < n; i++) {
      const a = seq[i], b = seq[(i + 1) % n];
      if ((map[a.cell] === a.band) === (map[b.cell] === b.band)) brk.push(i);
    }
    return brk;
  }

  const bandCount = () => (breaksOf(overNow()).length || 1);

  // The lawful stretch that carries seq index q0 — the piece the eye reads as
  // one band through that crossing.
  function runAround(q0, brk) {
    const n = seq.length;
    if (!brk.length) return { from: 0, to: n - 1 };
    const isBreak = new Uint8Array(n);
    for (const i of brk) isBreak[i] = 1;
    let a = q0, b = q0, guard = 0;
    while (!isBreak[(a - 1 + n) % n] && guard++ < n) a = (a - 1 + n) % n;
    guard = 0;
    while (!isBreak[b] && guard++ < n) b = (b + 1) % n;
    return { from: a, to: b };
  }

  function runPolyline(from, to) {
    const { steps, stepOfSeq } = walk;
    if (!steps.length || !stepOfSeq.length) return [];
    const s0 = stepOfSeq[from % stepOfSeq.length];
    const s1 = stepOfSeq[to % stepOfSeq.length];
    const pts = [];
    let i = s0;
    let guard = 0;
    for (;;) {
      const seg = steps[i];
      for (const q of seg) {
        const last = pts[pts.length - 1];
        if (!last || Math.hypot(last[0] - q[0], last[1] - q[1]) > 0.5) pts.push(q);
      }
      if (i === s1 || guard++ > steps.length) break;
      i = (i + 1) % steps.length;
    }
    return pts;
  }

  // The stretches a turn at `cell` re-reads: one per appearance on the band.
  function runsThrough(cell, map) {
    const brk = breaksOf(map);
    const out = [];
    const seenKey = new Set();
    seq.forEach((s, q) => {
      if (s.cell !== cell) return;
      const r = runAround(q, brk);
      const k = `${r.from}:${r.to}`;
      if (seenKey.has(k)) return;
      seenKey.add(k);
      out.push(runPolyline(r.from, r.to));
    });
    return out.filter((a) => a.length > 1);
  }

  // ---- the room ----------------------------------------------------------
  const wrap = node('div', `display:grid;gap:9px;justify-items:stretch;font-family:${SERIF};color:${p.bone}`);
  const style = node('style');
  style.textContent = `
    .ow5-plate{margin:0;text-align:center;font-size:15px;line-height:1.4;color:${p.bone};
      padding:8px 20px;border-radius:4px;
      background:linear-gradient(168deg,rgba(90,58,30,.72),rgba(58,36,18,.8) 55%,rgba(34,21,7,.86));
      border:1px solid rgba(12,9,6,.9);
      box-shadow:0 4px 10px rgba(12,9,6,.5),inset 0 1px 0 rgba(233,220,195,.14),inset 0 -2px 3px rgba(12,9,6,.6);
      text-shadow:-1px -1px 0 rgba(12,9,6,.85),1px 1px 0 rgba(238,207,109,.18)}
    .ow5-panel{position:relative;width:100%;max-width:900px}
    .ow5-panel canvas{display:block;width:100%;height:auto}
    .ow5-cell{position:absolute;background:none;border:0;padding:0;margin:0;
      cursor:pointer;border-radius:3px}
    .ow5-cell:focus-visible{outline:2px solid ${p.goldBright};outline-offset:-3px}
    .ow5-cell[data-carved="1"]{cursor:default}
    .ow5-ghost{position:absolute;pointer-events:none;border-radius:6px;
      border:2px dashed ${p.goldBright};background:rgba(238,207,109,.16);
      box-shadow:0 0 18px rgba(238,207,109,.35),inset 0 0 12px rgba(238,207,109,.25)}
    .ow5-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:center;
      padding:9px 12px;border-radius:4px;
      background:
        repeating-linear-gradient(135deg,rgba(12,9,6,.5) 0 5px,rgba(90,58,30,.34) 5px 10px) top/100% 7px no-repeat,
        repeating-linear-gradient(45deg,rgba(12,9,6,.5) 0 5px,rgba(90,58,30,.34) 5px 10px) bottom/100% 7px no-repeat,
        linear-gradient(174deg,rgba(90,58,30,.6),rgba(58,36,18,.68) 55%,rgba(34,21,7,.76));
      border:1px solid rgba(12,9,6,.9);
      box-shadow:0 4px 10px rgba(12,9,6,.45),inset 0 1px 0 rgba(233,220,195,.13),inset 0 -2px 3px rgba(12,9,6,.55)}
    .ow5-act{font-family:${SERIF};font-size:15px;color:${p.boneDim};background:transparent;
      border:1px solid rgba(90,58,30,.9);border-radius:3px;padding:11px 18px;min-height:44px;cursor:pointer}
    .ow5-act:hover{color:${p.bone};border-color:${p.oakLight}}
    .ow5-act:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    .ow5-act[disabled]{opacity:.5;cursor:default}
  `;
  wrap.append(style);

  const plate = node('p', null, T('plate'));
  plate.className = 'ow5-plate';

  const panel = node('div');
  panel.className = 'ow5-panel';
  // the work's box inside the bench, in bench units — read by the density gate
  // so the dead-zone law is measured over the bench, not over the room.
  panel.dataset.box = [B.px, B.py, PANEL, PANEL, B.w, B.h].join(',');
  const gfx = art.makeCanvas(B.w, B.h);
  // makeCanvas writes inline pixel sizes; the bench fills whatever width the
  // room gives it, so the tiles scale with the panel and never fall under 44px.
  gfx.canvas.style.width = '100%';
  gfx.canvas.style.height = 'auto';
  gfx.canvas.setAttribute('aria-hidden', 'true');
  panel.append(gfx.canvas);

  const grid = node('div', 'position:absolute;inset:0');
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', T('ariaGrid'));
  panel.append(grid);

  const pct = (v, whole) => `${(v / whole) * 100}%`;
  const cellBtns = [];
  for (let cell = 0; cell < CELLS; cell++) {
    const btn = node('button');
    btn.className = 'ow5-cell';
    btn.type = 'button';
    btn.style.left = pct(B.px + (cell & 3) * TILE, B.w);
    btn.style.top = pct(B.py + (cell >> 2) * TILE, B.h);
    btn.style.width = pct(TILE, B.w);
    btn.style.height = pct(TILE, B.h);
    btn.setAttribute('tabindex', cell === focused ? '0' : '-1');
    grid.append(btn);
    cellBtns.push(btn);
  }

  const ghost = node('div');
  ghost.className = 'ow5-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.display = 'none';
  panel.append(ghost);

  const actions = node('div');
  actions.className = 'ow5-actions';
  const traceBtn = node('button', null, T('trace'));
  traceBtn.className = 'ow5-act';
  traceBtn.type = 'button';
  const skipBtn = node('button', null, T('skip'));
  skipBtn.className = 'ow5-act';
  skipBtn.type = 'button';
  skipBtn.style.display = 'none';
  const submitBtn = node('button', null, T('submit'));
  submitBtn.className = 'btn-carved'; // one primary-action language: the carved gold plate
  submitBtn.type = 'button';
  actions.append(traceBtn, submitBtn, skipBtn);

  const tally = node('p', `margin:0;font-size:14px;color:${p.bone};text-align:center`);
  tally.setAttribute('aria-live', 'polite');
  const status = node('p', `margin:0;font-size:14px;color:${p.boneDim};text-align:center`);
  status.setAttribute('aria-live', 'polite');
  const law = node('p', `margin:0;font-size:13px;color:${p.boneDim};line-height:1.5;text-align:center`,
    `${T('law')} ${T('help')}`);

  // status before tally in the DOM: the reactive line is the board's first
  // polite live region (the lane's feel-gate reads it as such).
  wrap.append(plate, panel, actions, status, tally, law);
  ctx.root.append(wrap);

  // ---- the bench, baked once --------------------------------------------
  const R = rng(`ow5:bench:${instance.border}:${instance.free.join(',')}`);

  function cord(c, pts, opt) {
    if (!pts || pts.length < 2) return;
    const w = opt.width;
    const path = (cc) => {
      cc.beginPath();
      cc.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) cc.lineTo(pts[i][0], pts[i][1]);
    };
    c.save();
    // butt caps: cell cords abut exactly at the tile line (no cap bead, no
    // stacked alpha), and where a band runs UNDER it ends square against the
    // other — which is how real interlace is cut.
    c.lineCap = 'butt';
    c.lineJoin = 'round';
    if (opt.chalk) {
      // setting-out chalk: pale, flat, no depth — nothing is cut here yet
      c.strokeStyle = mix(p.bone, p.oak, 0.34);
      c.lineWidth = w * 0.78;
      path(c); c.stroke();
      c.strokeStyle = mix(p.bone, p.oakLight, 0.12);
      c.lineWidth = Math.max(1, w * 0.2);
      c.translate(-1.1, -1.4);
      path(c); c.stroke();
    } else {
      // finished cut: tar socket, gold cord, surviving pigment, lip light
      c.save();
      c.translate(1, 1.5);
      c.strokeStyle = p.tar;
      c.lineWidth = w * 1.34;
      path(c); c.stroke();
      c.restore();
      const g = c.createLinearGradient(pts[0][0] - w, pts[0][1] - w, pts[pts.length - 1][0] + w, pts[pts.length - 1][1] + w);
      g.addColorStop(0, mix(opt.color, p.goldBright, 0.5));
      g.addColorStop(0.52, opt.color);
      g.addColorStop(1, mix(opt.color, p.tar, 0.42));
      c.strokeStyle = g;
      c.lineWidth = w;
      path(c); c.stroke();
      if (opt.pigment) {
        c.strokeStyle = rgba(opt.pigment, 0.3);
        c.lineWidth = Math.max(1.2, w * 0.3);
        c.save();
        c.translate(1.4, 1.8);
        path(c); c.stroke();
        c.restore();
      }
      c.strokeStyle = rgba(p.goldBright, 0.42);
      c.lineWidth = Math.max(1, w * 0.2);
      c.save();
      c.translate(-0.9, -1.4);
      path(c); c.stroke();
      c.restore();
    }
    c.restore();
  }

  // --- the tools that are resting between cuts ---------------------------
  function mallet(c, x, y, ang, s) {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.fillStyle = rgba(p.tar, 0.5);
    c.beginPath();
    c.ellipse(4, 6, 62 * s, 20 * s, 0, 0, Math.PI * 2);
    c.fill();
    // handle: tapered ash, hooped where the hand wore it
    const hg = c.createLinearGradient(0, -7 * s, 0, 8 * s);
    hg.addColorStop(0, mix(p.oakLight, p.bone, 0.34));
    hg.addColorStop(0.5, p.oakLight);
    hg.addColorStop(1, mix(p.oak, p.tar, 0.4));
    c.fillStyle = hg;
    c.beginPath();
    c.moveTo(6 * s, -7 * s); c.lineTo(84 * s, -5.4 * s);
    c.lineTo(84 * s, 5.4 * s); c.lineTo(6 * s, 7 * s);
    c.closePath();
    c.fill();
    c.strokeStyle = rgba(p.tar, 0.7);
    c.lineWidth = 1.1;
    c.stroke();
    for (let i = 0; i < 4; i++) {
      c.strokeStyle = rgba(p.tar, 0.24);
      c.beginPath();
      c.moveTo((26 + i * 15) * s, -6 * s);
      c.lineTo((26 + i * 15) * s, 6 * s);
      c.stroke();
    }
    // head: end-grain beech, chamfered, struck faces bruised
    const bg = c.createLinearGradient(-34 * s, -22 * s, 6 * s, 22 * s);
    bg.addColorStop(0, mix(p.oakLight, p.bone, 0.28));
    bg.addColorStop(0.55, p.oakLight);
    bg.addColorStop(1, mix(p.oak, p.tar, 0.5));
    c.fillStyle = bg;
    c.beginPath();
    c.moveTo(-38 * s, -19 * s); c.lineTo(14 * s, -22 * s);
    c.lineTo(14 * s, 22 * s); c.lineTo(-38 * s, 19 * s);
    c.closePath();
    c.fill();
    c.strokeStyle = rgba(p.tar, 0.82);
    c.lineWidth = 1.3;
    c.stroke();
    c.strokeStyle = rgba(p.tar, 0.45);
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      c.ellipse(-12 * s, 0, (5 + i * 4.6) * s, (5 + i * 5.2) * s, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.strokeStyle = rgba(p.bone, 0.16);
    c.beginPath();
    c.moveTo(-37 * s, -17 * s); c.lineTo(13 * s, -20 * s);
    c.stroke();
    for (let i = 0; i < 7; i++) {
      c.fillStyle = rgba(p.tar, 0.16 + R() * 0.14);
      c.beginPath();
      c.ellipse((-36 + R() * 10) * s, (-16 + R() * 32) * s, 2.4 * s, 1.5 * s, R(), 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  function chisel(c, x, y, ang, s, kind) {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.fillStyle = rgba(p.tar, 0.45);
    c.beginPath();
    c.ellipse(3, 5, 62 * s, 8 * s, 0, 0, Math.PI * 2);
    c.fill();
    // blade
    const steel = c.createLinearGradient(0, -6 * s, 0, 6 * s);
    steel.addColorStop(0, mix(p.bone, p.fjordLight, 0.3));
    steel.addColorStop(0.4, mix(p.boneDim, p.tar, 0.42));
    steel.addColorStop(1, mix(p.tar, p.fjord, 0.35));
    c.fillStyle = steel;
    c.beginPath();
    if (kind === 'skew') {
      c.moveTo(-58 * s, -3.2 * s); c.lineTo(-46 * s, -5.4 * s);
      c.lineTo(4 * s, -5.4 * s); c.lineTo(4 * s, 5.4 * s); c.lineTo(-52 * s, 5.4 * s);
    } else {
      c.moveTo(-58 * s, -4.4 * s); c.lineTo(4 * s, -5.6 * s);
      c.lineTo(4 * s, 5.6 * s); c.lineTo(-58 * s, 4.4 * s);
    }
    c.closePath();
    c.fill();
    c.strokeStyle = rgba(p.tar, 0.8);
    c.lineWidth = 1;
    c.stroke();
    // the bevel catches the hearth
    c.strokeStyle = rgba(p.bone, 0.55);
    c.lineWidth = Math.max(1, 1.7 * s);
    c.beginPath();
    if (kind === 'gouge') {
      c.moveTo(-56 * s, -1.6 * s);
      c.quadraticCurveTo(-30 * s, -3.4 * s, 2 * s, -2.2 * s);
    } else {
      c.moveTo(-55 * s, -2 * s); c.lineTo(2 * s, -2.8 * s);
    }
    c.stroke();
    c.strokeStyle = rgba(p.bone, 0.85);
    c.lineWidth = Math.max(1, 1.2 * s);
    c.beginPath();
    c.moveTo(-58 * s, kind === 'skew' ? -3.2 * s : -4.4 * s);
    c.lineTo(-58 * s, kind === 'skew' ? 4 * s : 4.4 * s);
    c.stroke();
    // ferrule
    const fg = c.createLinearGradient(0, -8 * s, 0, 8 * s);
    fg.addColorStop(0, p.goldBright);
    fg.addColorStop(0.5, p.gold);
    fg.addColorStop(1, mix(p.gold, p.tar, 0.6));
    c.fillStyle = fg;
    c.fillRect(4 * s, -7.4 * s, 12 * s, 14.8 * s);
    c.strokeStyle = rgba(p.tar, 0.8);
    c.strokeRect(4 * s, -7.4 * s, 12 * s, 14.8 * s);
    // handle: turned ash with a hoop
    const hg = c.createLinearGradient(0, -9 * s, 0, 9 * s);
    hg.addColorStop(0, mix(p.oakLight, p.bone, 0.3));
    hg.addColorStop(0.5, p.oakLight);
    hg.addColorStop(1, mix(p.oak, p.tar, 0.45));
    c.fillStyle = hg;
    c.beginPath();
    c.moveTo(16 * s, -7.6 * s);
    c.quadraticCurveTo(44 * s, -10.4 * s, 58 * s, -6.4 * s);
    c.quadraticCurveTo(64 * s, -3 * s, 64 * s, 0);
    c.quadraticCurveTo(64 * s, 3 * s, 58 * s, 6.4 * s);
    c.quadraticCurveTo(44 * s, 10.4 * s, 16 * s, 7.6 * s);
    c.closePath();
    c.fill();
    c.strokeStyle = rgba(p.tar, 0.75);
    c.lineWidth = 1.1;
    c.stroke();
    c.strokeStyle = rgba(p.tar, 0.3);
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.moveTo((26 + i * 12) * s, -8 * s);
      c.quadraticCurveTo((28 + i * 12) * s, 0, (26 + i * 12) * s, 8 * s);
      c.stroke();
    }
    c.strokeStyle = rgba(p.bone, 0.18);
    c.beginPath();
    c.moveTo(18 * s, -6.4 * s);
    c.quadraticCurveTo(44 * s, -8.8 * s, 57 * s, -5 * s);
    c.stroke();
    c.restore();
  }

  function shaving(c, x, y, ang, s) {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.strokeStyle = rgba(mix(p.oakLight, p.bone, 0.5), 0.4);
    c.lineWidth = Math.max(1.4, 3 * s);
    c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i <= 46; i++) {
      const t = i / 46;
      const r = 4 * s + t * 17 * s;
      const a = t * Math.PI * 3.1;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r * 0.52;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
    c.strokeStyle = rgba(p.tar, 0.24);
    c.lineWidth = Math.max(1, 1.4 * s);
    c.stroke();
    c.restore();
  }

  function chips(c, x, y, w, h, n) {
    for (let i = 0; i < n; i++) {
      const cx = x + R() * w, cy = y + R() * h;
      const sz = 1.4 + R() * 3.4;
      c.save();
      c.translate(cx, cy);
      c.rotate(R() * Math.PI);
      c.fillStyle = rgba(mix(p.oakLight, p.bone, 0.42), 0.24 + R() * 0.26);
      c.beginPath();
      c.moveTo(-sz, 0); c.lineTo(0, -sz * 0.5); c.lineTo(sz, sz * 0.3); c.lineTo(0, sz * 0.6);
      c.closePath();
      c.fill();
      c.fillStyle = rgba(p.tar, 0.26);
      c.fillRect(-sz * 0.4, sz * 0.5, sz * 1.2, 0.9);
      c.restore();
    }
  }

  function chalkStub(c, x, y, ang, s) {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.fillStyle = rgba(p.bone, 0.1);
    c.beginPath();
    c.ellipse(0, 2, 20 * s, 7 * s, 0, 0, Math.PI * 2);
    c.fill();
    const g = c.createLinearGradient(0, -4 * s, 0, 4 * s);
    g.addColorStop(0, rgba(p.bone, 0.95));
    g.addColorStop(1, rgba(p.boneDim, 0.75));
    c.fillStyle = g;
    c.fillRect(-13 * s, -4 * s, 26 * s, 8 * s);
    c.strokeStyle = rgba(p.tar, 0.4);
    c.lineWidth = 1;
    c.strokeRect(-13 * s, -4 * s, 26 * s, 8 * s);
    c.fillStyle = rgba(p.bone, 0.5);
    c.beginPath();
    c.moveTo(13 * s, -4 * s); c.lineTo(18 * s, 0); c.lineTo(13 * s, 4 * s);
    c.closePath();
    c.fill();
    c.restore();
  }

  // The dead-zone law: every empty stretch of bench carries quiet tool history.
  // Jittered over a grid so no featureless region survives, held low enough to
  // stay subordinate to the work.
  function benchLitter(c, box, cols, rows) {
    const cw = box.w / cols, ch = box.h / rows;
    for (let ry = 0; ry < rows; ry++) {
      for (let cx = 0; cx < cols; cx++) {
        const x = box.x + cw * (cx + 0.15 + R() * 0.7);
        const y = box.y + ch * (ry + 0.15 + R() * 0.7);
        const pick = R();
        c.save();
        if (pick < 0.26) {
          // gouge scoop: a shallow flute with a lit lower lip
          const w = 12 + R() * 16, h = 4 + R() * 4, a = R() * Math.PI;
          c.translate(x, y); c.rotate(a);
          c.fillStyle = rgba(p.tar, 0.32);
          c.beginPath(); c.ellipse(0, 0, w / 2, h, 0, 0, Math.PI * 2); c.fill();
          c.strokeStyle = rgba(mix(p.oakLight, p.bone, 0.45), 0.26);
          c.lineWidth = 1.1;
          c.beginPath(); c.ellipse(0, 1.2, w / 2, h, 0, 0, Math.PI); c.stroke();
        } else if (pick < 0.46) {
          // chisel stab marks, struck in a short row
          const n = 2 + Math.floor(R() * 3), a = R() * Math.PI;
          c.translate(x, y); c.rotate(a);
          for (let i = 0; i < n; i++) {
            c.strokeStyle = rgba(p.tar, 0.38);
            c.lineWidth = 1.8;
            c.beginPath(); c.moveTo(i * 6, 0); c.lineTo(i * 6, 7 + R() * 5); c.stroke();
            c.strokeStyle = rgba(p.oakLight, 0.24);
            c.beginPath(); c.moveTo(i * 6 + 1.1, 0.6); c.lineTo(i * 6 + 1.1, 7); c.stroke();
          }
        } else if (pick < 0.62) {
          // a scribed setting-out line with its tick
          const len = 24 + R() * 40, a = (R() - 0.5) * 0.6;
          c.translate(x, y); c.rotate(a);
          c.strokeStyle = rgba(p.bone, 0.16);
          c.lineWidth = 1;
          c.beginPath(); c.moveTo(-len / 2, 0); c.lineTo(len / 2, 0); c.stroke();
          c.strokeStyle = rgba(p.tar, 0.32);
          c.beginPath(); c.moveTo(0, -4); c.lineTo(0, 4); c.stroke();
        } else if (pick < 0.76) {
          // chips of waste, caught where they fell
          chips(c, x - 12, y - 9, 24, 18, 3 + Math.floor(R() * 3));
        } else if (pick < 0.86) {
          // an iron pin left in the wood
          try { art.ornament(c, 'nailhead', x, y, 4 + R() * 2.5); } catch (e) { /* stub */ }
        } else if (pick < 0.94) {
          // a knot in the board, ringed
          c.fillStyle = rgba(p.tar, 0.4);
          c.beginPath(); c.ellipse(x, y, 4 + R() * 3, 3 + R() * 2, R(), 0, Math.PI * 2); c.fill();
          c.strokeStyle = rgba(p.oakDeep, 0.3);
          c.lineWidth = 1;
          for (let i = 1; i < 3; i++) {
            c.beginPath(); c.ellipse(x, y, (4 + i * 3.5), (3 + i * 2.6), 0, 0, Math.PI * 2); c.stroke();
          }
        } else {
          // an old oil ring where a stone or a cup stood
          c.strokeStyle = rgba(p.ember, 0.2);
          c.lineWidth = 2.2;
          c.beginPath(); c.arc(x, y, 9 + R() * 7, 0, Math.PI * 2); c.stroke();
        }
        c.restore();
      }
    }
  }

  // The bench top was worked flat by hand: overlapping adze scallops, each a
  // dark leading edge and a lit trailing one. Covers every bare stretch at a
  // contrast that is legible up close and invisible from across the room.
  function adzedField(c, box) {
    const stepX = 26, stepY = 15;
    c.save();
    c.beginPath();
    c.rect(box.x, box.y, box.w, box.h);
    c.clip();
    for (let y = box.y; y < box.y + box.h + stepY; y += stepY) {
      const off = ((y / stepY) | 0) % 2 ? stepX / 2 : 0;
      for (let x = box.x - stepX; x < box.x + box.w + stepX; x += stepX) {
        const px = x + off + (R() - 0.5) * 4;
        const py = y + (R() - 0.5) * 3;
        const w = stepX * (0.9 + R() * 0.3);
        c.strokeStyle = rgba(p.tar, 0.24 + R() * 0.08);
        c.lineWidth = 1.7;
        c.beginPath();
        c.arc(px, py - 7, w * 0.62, Math.PI * 0.22, Math.PI * 0.78);
        c.stroke();
        c.strokeStyle = rgba(mix(p.oakLight, p.bone, 0.5), 0.18 + R() * 0.07);
        c.lineWidth = 1.4;
        c.beginPath();
        c.arc(px, py - 8.6, w * 0.62, Math.PI * 0.26, Math.PI * 0.74);
        c.stroke();
      }
    }
    c.restore();
  }

  function trySquare(c, x, y, ang, s) {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.fillStyle = rgba(p.tar, 0.42);
    c.fillRect(-2, 4, 78 * s, 8 * s);
    // steel blade
    const st = c.createLinearGradient(0, -5 * s, 0, 5 * s);
    st.addColorStop(0, mix(p.bone, p.fjordLight, 0.35));
    st.addColorStop(1, mix(p.tar, p.fjord, 0.4));
    c.fillStyle = st;
    c.fillRect(0, -3.4 * s, 76 * s, 6.8 * s);
    c.strokeStyle = rgba(p.tar, 0.85);
    c.lineWidth = 1;
    c.strokeRect(0, -3.4 * s, 76 * s, 6.8 * s);
    c.strokeStyle = rgba(p.bone, 0.5);
    for (let i = 1; i < 7; i++) {
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(i * 10 * s, -3.4 * s);
      c.lineTo(i * 10 * s, (i % 2 ? -0.6 : 0.6) * s);
      c.stroke();
    }
    // stock: oak, brass-faced
    const wg = c.createLinearGradient(0, -14 * s, 0, 14 * s);
    wg.addColorStop(0, mix(p.oakLight, p.bone, 0.3));
    wg.addColorStop(1, mix(p.oak, p.tar, 0.5));
    c.fillStyle = wg;
    c.fillRect(-14 * s, -14 * s, 14 * s, 28 * s);
    c.strokeStyle = rgba(p.tar, 0.85);
    c.strokeRect(-14 * s, -14 * s, 14 * s, 28 * s);
    c.fillStyle = rgba(p.gold, 0.7);
    c.fillRect(-2.6 * s, -14 * s, 2.6 * s, 28 * s);
    c.strokeStyle = rgba(p.goldBright, 0.4);
    c.beginPath(); c.moveTo(-13 * s, -12.6 * s); c.lineTo(-3 * s, -12.6 * s); c.stroke();
    c.restore();
  }

  function whetstone(c, x, y, ang, s) {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.fillStyle = rgba(p.tar, 0.45);
    c.beginPath(); c.ellipse(2, 4, 26 * s, 10 * s, 0, 0, Math.PI * 2); c.fill();
    const g = c.createLinearGradient(0, -8 * s, 0, 8 * s);
    g.addColorStop(0, mix(p.boneDim, p.fjordLight, 0.3));
    g.addColorStop(0.55, mix(p.boneDim, p.tar, 0.5));
    g.addColorStop(1, mix(p.tar, p.fjord, 0.5));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-24 * s, -7 * s); c.lineTo(24 * s, -8 * s);
    c.lineTo(24 * s, 8 * s); c.lineTo(-24 * s, 7 * s);
    c.closePath();
    c.fill();
    c.strokeStyle = rgba(p.tar, 0.8);
    c.lineWidth = 1.1;
    c.stroke();
    // the hollow honed into its face, still wet with oil
    c.strokeStyle = rgba(p.bone, 0.2);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-18 * s, -1.5 * s);
    c.quadraticCurveTo(0, 2.5 * s, 18 * s, -1.5 * s);
    c.stroke();
    c.strokeStyle = rgba(p.goldBright, 0.16);
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(-22 * s, -5.6 * s); c.lineTo(22 * s, -6.4 * s); c.stroke();
    c.restore();
  }

  function tools(c) {
    // the bench's own edge is carved too — a chip-run round the boards and an
    // interlace rail worked into each margin, so no stretch is bare
    if (typeof art.chipBorder === 'function') {
      art.chipBorder(c, 8, 8, B.w - 16, B.h - 16, { size: 9, alpha: 0.7 });
    }
    // No interlace on the bench: the ribbon is the PUZZLE's language and must
    // not be echoed beside it. The margins carry tool history instead.
    if (B === BENCH.wide) {
      adzedField(c, { x: 4, y: 4, w: 196, h: 430 });
      adzedField(c, { x: 560, y: 4, w: 196, h: 430 });
      benchLitter(c, { x: 6, y: 6, w: 192, h: 426 }, 5, 11);
      benchLitter(c, { x: 562, y: 6, w: 192, h: 426 }, 5, 11);
      trySquare(c, 26, 64, 0.22, 1.0);
      chisel(c, 96, 176, -1.28, 1.0, 'firmer');
      mallet(c, 98, 316, -0.36, 1.0);
      shaving(c, 40, 246, 0.4, 1.1);
      shaving(c, 150, 410, -0.25, 0.95);
      chisel(c, 662, 146, 1.22, 1.0, 'gouge');
      chisel(c, 706, 166, 1.3, 0.92, 'skew');
      whetstone(c, 668, 296, -0.16, 1.05);
      chalkStub(c, 610, 356, -0.5, 1.05);
      shaving(c, 700, 404, -0.3, 0.95);
      chips(c, 566, 20, 186, 400, 30);
      chips(c, 8, 20, 186, 400, 30);
    } else {
      adzedField(c, { x: 4, y: 388, w: 384, h: 130 });
      benchLitter(c, { x: 6, y: 392, w: 380, h: 122 }, 7, 3);
      benchLitter(c, { x: 6, y: 6, w: 380, h: 14 }, 6, 1);
      mallet(c, 82, 434, -0.14, 0.8);
      chisel(c, 258, 412, 0.1, 0.8, 'firmer');
      chisel(c, 268, 458, -0.08, 0.76, 'gouge');
      trySquare(c, 300, 492, -0.5, 0.62);
      whetstone(c, 96, 494, 0.12, 0.8);
      chalkStub(c, 178, 500, -0.2, 0.9);
      shaving(c, 186, 452, 0.5, 0.85);
      chips(c, 10, 388, 372, 126, 34);
    }
  }

  // the counting rail: pieces the weave still reads as, one band the goal
  function tallyRail(c, count) {
    const r = B.rail;
    c.save();
    c.fillStyle = rgba(p.tar, 0.42);
    c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = rgba(p.tar, 0.9);
    c.lineWidth = 1.6;
    c.strokeRect(r.x + 0.8, r.y + 0.8, r.w - 1.6, r.h - 1.6);
    c.strokeStyle = rgba(p.goldBright, 0.16);
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(r.x + 2, r.y + r.h - 2);
    c.lineTo(r.x + r.w - 2, r.y + r.h - 2);
    c.stroke();
    if (typeof art.chipBorder === 'function') {
      art.chipBorder(c, r.x + 3, r.y + 3, r.w - 6, r.h - 6, { size: 7, alpha: 0.5 });
    }
    // the goal mark: one closed ring at the head of the rail
    const gy = r.y + r.h / 2;
    const gx = r.x + 15;
    const done = count <= 1;
    c.strokeStyle = done ? p.goldBright : rgba(p.boneDim, 0.5);
    c.lineWidth = done ? 2.6 : 1.6;
    c.beginPath();
    c.arc(gx, gy, 8.5, 0, Math.PI * 2);
    c.stroke();
    if (done) {
      try { art.glow(c, gx, gy, 15, p.goldBright, 0.75); } catch (e) { /* stub */ }
    }
    const first = r.x + 34;
    const span = r.w - 44;
    const step = span / PIP_SLOTS;
    for (let i = 0; i < PIP_SLOTS; i++) {
      const x = first + step * (i + 0.5);
      const lit = i < count;
      c.beginPath();
      c.arc(x, gy + 1.4, 5.2, 0, Math.PI * 2);
      c.fillStyle = rgba(p.tar, 0.72);
      c.fill();
      if (!lit) continue;
      const pg = c.createRadialGradient(x - 1.6, gy - 2.4, 0.6, x, gy, 5.6);
      pg.addColorStop(0, p.goldBright);
      pg.addColorStop(1, mix(p.gold, p.tar, 0.55));
      c.fillStyle = pg;
      c.beginPath();
      c.arc(x, gy, 5, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = rgba(p.tar, 0.85);
      c.lineWidth = 1;
      c.stroke();
    }
    if (count > PIP_SLOTS) {
      c.fillStyle = rgba(p.ember, 0.8);
      c.beginPath();
      c.arc(r.x + r.w - 7, gy, 3, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  let slab = null;
  function slabFor() {
    if (slab) return slab;
    const off = art.makeCanvas(B.w, B.h);
    const c = off.ctx;
    art.paintWood(c, B.w, B.h, 505, {});
    // bench boards: two joints running the length, the near edge chamfered
    c.save();
    const seams = B === BENCH.wide ? [122, 300] : [150, 330];
    for (const sy of seams) {
      c.strokeStyle = rgba(p.tar, 0.6);
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, sy); c.lineTo(B.w, sy); c.stroke();
      c.strokeStyle = rgba(p.oakLight, 0.2);
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, sy + 1.6); c.lineTo(B.w, sy + 1.6); c.stroke();
    }
    const edge = c.createLinearGradient(0, B.h - 16, 0, B.h);
    edge.addColorStop(0, rgba(p.tar, 0));
    edge.addColorStop(1, rgba(p.tar, 0.55));
    c.fillStyle = edge;
    c.fillRect(0, B.h - 16, B.w, 16);
    // bench-dog hole, and a hold-fast burn ring
    const dog = B === BENCH.wide ? [44, 208] : [356, 200];
    c.fillStyle = rgba(p.tar, 0.85);
    c.beginPath();
    c.ellipse(dog[0], dog[1], 7, 9, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = rgba(p.oakLight, 0.3);
    c.lineWidth = 1.2;
    c.beginPath();
    c.ellipse(dog[0], dog[1] - 1, 7, 9, 0, Math.PI, Math.PI * 2);
    c.stroke();
    c.restore();
    // the hall's one light concept falls across the bench too, so the tool
    // history sits in the same hearth as everything else and reads as CUT
    if (typeof art.hearth === 'function') {
      art.hearth(c, B.w, B.h, { x: 0.5, y: 0.28, r: 0.72, strength: 0.85 });
    }
    if (typeof art.wear === 'function') art.wear(c, B.w, B.h, `ow5:${instance.border}`, { avoid: PBOX });
    tools(c);
    // the work, clamped in its carved tray
    if (typeof art.tray === 'function') {
      art.tray(c, PBOX.x, PBOX.y, PBOX.w, PBOX.h, { seed: `ow5:${instance.border}`, ribbon: true, band: 20 });
    }
    // the panel's own board: a paler oak than the bench, cut across the grain
    c.save();
    c.beginPath();
    c.rect(PBOX.x, PBOX.y, PBOX.w, PBOX.h);
    c.clip();
    art.paintWood(c, B.w, B.h, 5, {});
    c.fillStyle = rgba(p.bone, 0.045);
    c.fillRect(PBOX.x, PBOX.y, PBOX.w, PBOX.h);
    // the carver's setting-out grid, scribed before any cut
    c.strokeStyle = rgba(p.bone, 0.09);
    c.lineWidth = 0.8;
    for (let k = 0; k <= SIDE; k++) {
      c.beginPath();
      c.moveTo(PBOX.x + k * TILE, PBOX.y); c.lineTo(PBOX.x + k * TILE, PBOX.y + PANEL); c.stroke();
      c.beginPath();
      c.moveTo(PBOX.x, PBOX.y + k * TILE); c.lineTo(PBOX.x + PANEL, PBOX.y + k * TILE); c.stroke();
    }
    c.restore();
    // the clamps that hold it down
    for (const [cx, cy, a] of [[PBOX.x, PBOX.y + PANEL * 0.5, Math.PI], [PBOX.x + PANEL, PBOX.y + PANEL * 0.5, 0]]) {
      c.save();
      c.translate(cx, cy);
      c.rotate(a);
      c.fillStyle = rgba(p.tar, 0.5);
      c.fillRect(-4, -19, 26, 38);
      const g = c.createLinearGradient(0, -18, 0, 18);
      g.addColorStop(0, mix(p.boneDim, p.tar, 0.3));
      g.addColorStop(0.5, mix(p.tar, p.fjord, 0.4));
      g.addColorStop(1, p.tar);
      c.fillStyle = g;
      c.fillRect(-6, -17, 24, 34);
      c.strokeStyle = rgba(p.tar, 0.9);
      c.lineWidth = 1.2;
      c.strokeRect(-6, -17, 24, 34);
      c.strokeStyle = rgba(p.bone, 0.3);
      c.beginPath(); c.moveTo(-5, -15.5); c.lineTo(17, -15.5); c.stroke();
      c.restore();
      try { art.ornament(c, 'nailhead', cx + (a ? -9 : 9), cy, 8); } catch (e) { /* stub */ }
    }
    slab = off.canvas;
    return slab;
  }

  // ---- the weave, rebaked on every change --------------------------------
  const PIGMENTS = [p.blood, p.fjord, p.pine];
  let weave = null;

  function tileFace(c, cell, carved) {
    const x0 = B.px + (cell & 3) * TILE, y0 = B.py + (cell >> 2) * TILE;
    if (carved) {
      // finished ground: waste chopped away, the surface fallen into shadow
      c.save();
      c.fillStyle = rgba(p.tar, 0.36);
      c.fillRect(x0 + 1, y0 + 1, TILE - 2, TILE - 2);
      c.restore();
      if (typeof art.insetFace === 'function') {
        art.insetFace(c, x0 + 1, y0 + 1, TILE - 2, TILE - 2, { depth: 0.55, lip: 0.07, lipLight: 0.2 });
      }
    } else {
      // pending ground: raw planed oak, hatched where the chisel has to go
      c.save();
      c.fillStyle = rgba(p.bone, 0.085);
      c.fillRect(x0 + 1, y0 + 1, TILE - 2, TILE - 2);
      c.beginPath();
      c.rect(x0 + 1, y0 + 1, TILE - 2, TILE - 2);
      c.clip();
      c.strokeStyle = rgba(p.bone, 0.1);
      c.lineWidth = 1;
      for (let k = -TILE; k < TILE; k += 11) {
        c.beginPath();
        c.moveTo(x0 + k, y0);
        c.lineTo(x0 + k + TILE, y0 + TILE);
        c.stroke();
      }
      c.restore();
      // the chalk register tick: this one is still the carver's to decide
      c.save();
      c.strokeStyle = rgba(p.bone, 0.26);
      c.lineWidth = 1.3;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(x0 + TILE - 12, y0 + TILE - 7); c.lineTo(x0 + TILE - 5, y0 + TILE - 7);
      c.moveTo(x0 + TILE - 8.5, y0 + TILE - 10.5); c.lineTo(x0 + TILE - 8.5, y0 + TILE - 3.5);
      c.stroke();
      c.restore();
    }
  }

  function bakeWeave() {
    const off = art.makeCanvas(B.w, B.h);
    const c = off.ctx;
    // cords run a little past their tile so neighbours meet under the join;
    // the panel's own edge still stops the weave dead.
    c.save();
    c.beginPath();
    c.rect(PBOX.x, PBOX.y, PBOX.w, PBOX.h);
    c.clip();
    const map = overNow();
    for (let cell = 0; cell < CELLS; cell++) {
      const kind = instance.cells[cell].kind;
      const carved = instance.cells[cell].carved;
      tileFace(c, cell, carved);
      const x0 = B.px + (cell & 3) * TILE, y0 = B.py + (cell >> 2) * TILE;
      const cx = x0 + TILE / 2, cy = y0 + TILE / 2;
      const at = (dir, other) => extendEnds(
        arcPoints(dir, other).map(([x, y]) => [x0 + x, y0 + y]), 0.6, x0, y0,
      );
      const opt = carved
        ? { width: 15, color: p.gold, pigment: PIGMENTS[cell % 3] }
        : { width: 15, color: p.bone, chalk: true };

      if (kind === 'cross') {
        const nsOver = map[cell] === 'ns';
        const over = at(nsOver ? N : W, nsOver ? S : E);
        const under = at(nsOver ? W : N, nsOver ? E : S);
        for (const run of cutAround(under, cx, cy, 11)) cord(c, run, opt);
        cord(c, over, opt);
        // the crest where the over-band rides the other
        c.save();
        c.globalAlpha = carved ? 0.42 : 0.28;
        c.strokeStyle = p.goldBright;
        c.lineWidth = 2.2;
        c.lineCap = 'round';
        c.beginPath();
        if (nsOver) { c.moveTo(cx - 2.2, cy - 13); c.lineTo(cx - 2.2, cy + 10); }
        else { c.moveTo(cx - 13, cy - 2.2); c.lineTo(cx + 10, cy - 2.2); }
        c.stroke();
        c.restore();
      } else {
        for (const [a, b] of ARCS[kind]) cord(c, at(a, b), opt);
      }
      if (carved) {
        for (const [dx, dy] of [[9, 9], [TILE - 9, 9], [9, TILE - 9], [TILE - 9, TILE - 9]]) {
          try { art.ornament(c, 'nailhead', x0 + dx, y0 + dy, 6.5); } catch (e) { /* stub */ }
        }
      }
    }
    c.restore();
    weave = off.canvas;
  }

  // ---- the gleam ---------------------------------------------------------
  function strokeRun(c, pts, width, colour, alpha) {
    if (!pts || pts.length < 2) return;
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.globalAlpha = alpha;
    c.strokeStyle = colour;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.stroke();
    c.restore();
  }

  // Cause and effect, made plain: the rest of the work falls back for a breath
  // while the stretch that now reads as ONE piece runs alight from end to end.
  function drawGleam(c) {
    if (!gleam) return;
    const f = gleam.fade;
    c.save();
    c.fillStyle = rgba(p.tar, 0.22 * f);
    c.fillRect(PBOX.x, PBOX.y, PBOX.w, PBOX.h);
    c.restore();
    const hot = mix(p.goldBright, p.bone, 0.5);
    for (const run of gleam.runs) {
      const { pts, cum, total } = run;
      strokeRun(c, pts, 32, p.goldBright, 0.16 * f);
      if (gleam.prog >= 1) {
        strokeRun(c, pts, 19, p.goldBright, 0.36 * f);
        strokeRun(c, pts, 8, hot, 0.92 * f);
        continue;
      }
      const head = total * gleam.prog;
      const lit = sliceByLen(pts, cum, 0, head);
      strokeRun(c, lit, 19, p.goldBright, 0.3 * f);
      strokeRun(c, lit, 7.5, p.goldBright, 0.55 * f);
      strokeRun(c, sliceByLen(pts, cum, Math.max(0, head - total * 0.3), head), 8, hot, 0.95 * f);
      const tip = sliceByLen(pts, cum, Math.max(0, head - 7), head);
      if (tip.length) {
        try { art.glow(c, tip[tip.length - 1][0], tip[tip.length - 1][1], 22, p.goldBright, 0.9 * f); } catch (e) { /* stub */ }
      }
    }
  }

  function stopGleam() {
    if (rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
    rafId = 0;
    gleam = null;
  }

  function runGleam(polys) {
    const runs = polys.filter((a) => a.length > 1).map((pts) => {
      const cum = polyLen(pts);
      return { pts, cum, total: cum[cum.length - 1] || 1 };
    });
    if (!runs.length) return;
    stopGleam();
    const calm = reduced();
    gleam = { runs, prog: calm ? 1 : 0, fade: 1 };
    if (calm || typeof requestAnimationFrame !== 'function') {
      // reduced motion: the same lesson held still, then let go
      paint();
      later(() => { gleam = null; paint(); }, 1400);
      return;
    }
    const DUR = 760, HOLD = 420;
    let t0 = 0;
    const frame = (now) => {
      if (!gleam) return;
      if (!t0) t0 = now;
      const dt = now - t0;
      if (dt <= DUR) gleam.prog = dt / DUR;
      else {
        gleam.prog = 1;
        gleam.fade = Math.max(0, 1 - (dt - DUR) / HOLD);
      }
      paint();
      if (dt >= DUR + HOLD) { gleam = null; rafId = 0; paint(); return; }
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
  }

  // ---- painting ----------------------------------------------------------
  function neighbours(cell) {
    const out = [];
    seq.forEach((s, q) => {
      if (s.cell !== cell) return;
      out.push(seq[(q + 1) % seq.length].cell, seq[(q - 1 + seq.length) % seq.length].cell);
    });
    return out.filter((x) => x !== cell);
  }

  function paint() {
    const c = gfx.ctx;
    c.clearRect(0, 0, B.w, B.h);
    c.drawImage(slabFor(), 0, 0, B.w, B.h);
    if (!weave) bakeWeave();
    c.drawImage(weave, 0, 0, B.w, B.h);
    drawGleam(c);

    for (let cell = 0; cell < CELLS; cell++) {
      const x0 = B.px + (cell & 3) * TILE, y0 = B.py + (cell >> 2) * TILE;
      if (cell === focused) {
        c.save();
        c.strokeStyle = p.goldBright;
        c.lineWidth = 2.2;
        c.lineCap = 'round';
        const k = 13;
        for (const [ox, oy, dx, dy] of [[3, 3, 1, 1], [TILE - 3, 3, -1, 1], [3, TILE - 3, 1, -1], [TILE - 3, TILE - 3, -1, -1]]) {
          c.beginPath();
          c.moveTo(x0 + ox, y0 + oy + dy * k);
          c.lineTo(x0 + ox, y0 + oy);
          c.lineTo(x0 + ox + dx * k, y0 + oy);
          c.stroke();
        }
        c.restore();
      }
      if (nearFault && nearFault.indexOf(cell) >= 0) {
        c.save();
        c.strokeStyle = p.tar;
        c.lineWidth = 4.5;
        c.strokeRect(x0 + 2.5, y0 + 2.5, TILE - 5, TILE - 5);
        c.strokeStyle = p.ember;
        c.lineWidth = 2.5;
        c.strokeRect(x0 + 2.5, y0 + 2.5, TILE - 5, TILE - 5);
        c.restore();
      }
    }
    tallyRail(c, bandCount());
  }

  function describeCell(cell) {
    const c = instance.cells[cell];
    if (c.kind !== 'cross') return T('describeBend', { where: where(cell) });
    const map = overNow();
    return T('describeCross', {
      where: where(cell),
      kind: T(c.carved ? 'kindCarved' : 'kindFree'),
      lie: T(map[cell] === 'ns' ? 'lieNs' : 'lieWe'),
    });
  }

  function tellTally() {
    const n = bandCount();
    tally.textContent = n <= 1 ? T('tallyOne') : T('tallyMany', { n });
  }

  function render() {
    paint();
    tellTally();
    for (let cell = 0; cell < CELLS; cell++) {
      const c = instance.cells[cell];
      cellBtns[cell].dataset.carved = c.carved ? '1' : '0';
      cellBtns[cell].setAttribute('tabindex', cell === focused ? '0' : '-1');
      cellBtns[cell].setAttribute('aria-label', describeCell(cell));
    }
  }

  function toggle(cell) {
    const k = instance.free.indexOf(cell);
    if (k < 0) {
      sfx('deny');
      const line = T('carvedDeny', { where: where(cell) });
      status.textContent = line;
      say(line);
      return;
    }
    states[k] = !states[k];
    nearFault = null;
    sfx('flip');
    bakeWeave();
    render();
    runGleam(runsThrough(cell, overNow()));
    const line = describeCell(cell);
    status.textContent = line;
    say(line);
  }

  function trace(cell) {
    const near = neighbours(cell);
    if (!near.length) {
      const line = T('bendSay', { where: where(cell) });
      status.textContent = line;
      say(line);
      return;
    }
    sfx('slide');
    runGleam(runsThrough(cell, overNow()));
    const line = T('traceSay', { where: where(cell), list: near.map(where).join(T('joiner')) });
    status.textContent = line;
    say(line);
  }

  function focus(cell) {
    focused = ((cell % CELLS) + CELLS) % CELLS;
    render();
    cellBtns[focused].focus();
  }

  // ---- the showing: one turn, and the gleam runs further ------------------
  function endShowing(quiet) {
    if (demoCell < 0 && ghost.style.display === 'none') return;
    demoCell = -1;
    ghost.style.display = 'none';
    skipBtn.style.display = 'none';
    stopGleam();
    bakeWeave();
    render();
    if (!quiet) status.textContent = '';
  }

  function takeTheChisel() {
    if (touched) return;
    touched = true;
    endShowing(true);
  }

  // the turn that buys the longest lawful stretch — the clearest lesson
  function bestDemoCell() {
    let best = -1, bestLen = -1;
    instance.free.forEach((cell, k) => {
      const map = overNow();
      map[cell] = !states[k] ? 'ns' : 'we';
      const brk = breaksOf(map);
      let len = 0;
      seq.forEach((s, q) => {
        if (s.cell !== cell) return;
        const r = runAround(q, brk);
        const n = seq.length;
        const span = ((r.to - r.from + n) % n) + 1;
        if (span > len) len = span;
      });
      if (len > bestLen) { bestLen = len; best = cell; }
    });
    return best;
  }

  function showTheWay() {
    if (ctx.solved || touched || !instance.free.length) return;
    const cell = bestDemoCell();
    if (cell < 0) return;
    ghost.style.left = pct(B.px + (cell & 3) * TILE, B.w);
    ghost.style.top = pct(B.py + (cell >> 2) * TILE, B.h);
    ghost.style.width = pct(TILE, B.w);
    ghost.style.height = pct(TILE, B.h);
    ghost.style.display = 'block';
    skipBtn.style.display = '';
    status.textContent = T('demoSay');
    say(T('demoSay'));
    demoCell = cell;
    bakeWeave();
    render();
    runGleam(runsThrough(cell, overNow()));
    later(() => endShowing(false), 3000);
  }

  // ---- wiring ------------------------------------------------------------
  cellBtns.forEach((btn, cell) => {
    on(btn, 'click', () => {
      takeTheChisel();
      focused = cell;
      render();
      if (!ctx.solved) toggle(cell);
    });
    on(btn, 'focus', () => {
      if (!keysSaid) {
        keysSaid = true;
        say(T('keysNote'));
      }
      if (focused !== cell) { focused = cell; render(); }
    });
    on(btn, 'keydown', (ev) => {
      const r = cell >> 2, col = cell & 3;
      if (ev.key === 'ArrowRight') { ev.preventDefault(); focus(r * SIDE + Math.min(SIDE - 1, col + 1)); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); focus(r * SIDE + Math.max(0, col - 1)); }
      else if (ev.key === 'ArrowDown') { ev.preventDefault(); focus(Math.min(SIDE - 1, r + 1) * SIDE + col); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); focus(Math.max(0, r - 1) * SIDE + col); }
      else if (ev.key === 't' || ev.key === 'T') { ev.preventDefault(); takeTheChisel(); trace(cell); }
      else if (ev.key === ' ' || ev.key === 'Spacebar' || ev.key === 'Enter') {
        ev.preventDefault();
        takeTheChisel();
        if (!ctx.solved) toggle(cell);
      }
    });
  });

  on(traceBtn, 'click', () => { takeTheChisel(); trace(focused); });
  on(skipBtn, 'click', () => { takeTheChisel(); submitBtn.focus(); });

  // The shell owns the shudder and the deny voice. The board's part is to show
  // WHERE the run first goes wrong — only the first doubling-over, so the
  // marks lead the eye back to the band instead of solving it.
  function handle(res) {
    if (!res || res.ok) return;
    const map = overNow();
    for (let q = 0; q < seq.length; q++) {
      const a = seq[q], b = seq[(q + 1) % seq.length];
      if ((map[a.cell] === a.band) === (map[b.cell] === b.band)) {
        nearFault = [a.cell, b.cell];
        break;
      }
    }
    if (nearFault) paint();
    if (res.near) { status.textContent = res.near; say(res.near); }
  }

  on(submitBtn, 'click', () => {
    if (ctx.solved) return;
    takeTheChisel();
    sfx('confirm');
    let res;
    try { res = ctx.submit({ states: states.slice() }); } catch (e) { return; }
    if (res && typeof res.then === 'function') res.then(handle, () => {});
    else handle(res);
  });

  // ---- open the lock -----------------------------------------------------
  bakeWeave();
  render();
  say(T('openPanel', { n: instance.free.length }));
  say(T('openBands'));
  instance.cells.forEach((c, cell) => {
    if (c.kind === 'cross' && c.carved) say(T('openCarved', { desc: describeCell(cell) }));
  });
  if (ctx.solved) {
    submitBtn.disabled = true;
    submitBtn.textContent = T('submitDone');
    status.textContent = T('solvedLine');
    touched = true;
  } else {
    later(showTheWay, 320);
  }

  return {
    unmount() {
      for (const off of cleanup) off();
      cleanup.length = 0;
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
      stopGleam();
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    },
  };
}

// ---------------------------------------------------------------------- copy
// English is the source; es/ca live in the additive per-lock i18n block
// (docs/CONTRACT.md §4.1 amendment) and are resolved through it at mount.
const BOARD_EN = {
  plate: 'Turn the free crossings until one unbroken band runs the whole panel, over-under all the way.',
  law: 'One band runs the whole panel and returns to itself. Following it, every crossing goes over, then under, then over — never twice the same.',
  help: 'Tap a crossing to lay it the other way. By key: arrows to walk the panel, space to lay a crossing, T to follow the band.',
  trace: 'Follow the band',
  submit: 'Bind the knot',
  submitDone: 'The knot is bound',
  skip: 'Skip the showing',
  demoSay: 'Watch once: one crossing turns, and the gleam runs further along the band.',
  solvedLine: 'The band runs over and under without fault.',
  tallyOne: 'The weave reads as one band. Bind the knot.',
  tallyMany: 'The weave reads as {n} bands.',
  carvedDeny: '{where} is carved. It cannot be laid otherwise.',
  bendSay: '{where} is a bend; the band only turns there.',
  traceSay: 'From {where} the band runs on to {list}.',
  joiner: ', and to ',
  describeBend: '{where}: a carved bend.',
  describeCross: '{where}: {kind}, {lie}.',
  kindCarved: 'a carved crossing',
  kindFree: 'a crossing',
  lieNs: 'the standing band lies over',
  lieWe: 'the running band lies over',
  keysNote: 'By key: arrows walk the panel; space or Enter lays a crossing the other way; T follows the band from the walked tile.',
  openPanel: 'A panel of sixteen tiles. {n} crossings may be laid either way; the rest are carved.',
  openBands: 'The standing band runs north and south; the running band, west and east.',
  openCarved: 'Carved: {desc}',
  where: 'row {r}, stave {c}',
  ariaGrid: 'The knot panel, four rows of four',
};

const NEAR_ONE = 'The band doubles over in one place.';
const nearMany = (n) => `The band doubles over in ${n} places.`;

const I18N = {
  es: {
    title: 'El Nudo de Oseberg',
    epigraph: 'Una sola banda, y sin fin. Va por encima donde iba por debajo.',
    hints: [
      'Una sola banda recorre el panel entero y vuelve sobre sí misma. Síguela desde un cruce tallado y no levantes la vista.',
      'Donde la banda se encuentra consigo misma va por encima, luego por debajo, luego por encima. Nunca dos veces igual.',
      'Los cruces tallados no se mueven, y son ellos los que fijan la cuenta de cada cruce que sigue por el recorrido. Empieza en uno y tiende cada cruce como la banda lo pida.',
    ],
    nearMap: {
      [NEAR_ONE]: 'La banda se dobla sobre sí misma en un punto.',
      [nearMany(2)]: 'La banda se dobla sobre sí misma en 2 puntos.',
      [nearMany(3)]: 'La banda se dobla sobre sí misma en 3 puntos.',
      [nearMany(4)]: 'La banda se dobla sobre sí misma en 4 puntos.',
      [nearMany(5)]: 'La banda se dobla sobre sí misma en 5 puntos.',
      [nearMany(6)]: 'La banda se dobla sobre sí misma en 6 puntos.',
      [nearMany(7)]: 'La banda se dobla sobre sí misma en 7 puntos.',
      [nearMany(8)]: 'La banda se dobla sobre sí misma en 8 puntos.',
      [nearMany(9)]: 'La banda se dobla sobre sí misma en 9 puntos.',
      [nearMany(10)]: 'La banda se dobla sobre sí misma en 10 puntos.',
      [nearMany(11)]: 'La banda se dobla sobre sí misma en 11 puntos.',
      [nearMany(12)]: 'La banda se dobla sobre sí misma en 12 puntos.',
    },
    board: {
      plate: 'Gira los cruces libres hasta que una sola banda sin quiebro recorra todo el panel, por encima y por debajo hasta el final.',
      law: 'Una sola banda recorre el panel entero y vuelve sobre sí misma. Siguiéndola, cada cruce va por encima, luego por debajo, luego por encima — nunca dos veces igual.',
      help: 'Toca un cruce para tenderlo del otro modo. Con el teclado: flechas para recorrer el panel, espacio para tender un cruce, T para seguir la banda.',
      trace: 'Seguir la banda',
      submit: 'Atar el nudo',
      submitDone: 'El nudo queda atado',
      skip: 'Saltar la muestra',
      demoSay: 'Mira una vez: un cruce se gira, y el brillo corre más lejos por la banda.',
      solvedLine: 'La banda corre por encima y por debajo sin falta.',
      tallyOne: 'El tejido se lee como una sola banda. Ata el nudo.',
      tallyMany: 'El tejido se lee como {n} bandas.',
      carvedDeny: '{where} está tallado. No puede tenderse de otro modo.',
      bendSay: '{where} es un codo; allí la banda solo tuerce.',
      traceSay: 'Desde {where} la banda sigue hasta {list}.',
      joiner: ', y hasta ',
      describeBend: '{where}: un codo tallado.',
      describeCross: '{where}: {kind}, {lie}.',
      kindCarved: 'un cruce tallado',
      kindFree: 'un cruce',
      lieNs: 'la banda en pie queda por encima',
      lieWe: 'la banda corrida queda por encima',
      keysNote: 'Con el teclado: las flechas recorren el panel; espacio o Intro tiende un cruce del otro modo; T sigue la banda desde la casilla recorrida.',
      openPanel: 'Un panel de dieciséis casillas. {n} cruces pueden tenderse de cualquier modo; los demás están tallados.',
      openBands: 'La banda en pie corre de norte a sur; la banda corrida, de oeste a este.',
      openCarved: 'Tallado: {desc}',
      where: 'fila {r}, asta {c}',
      ariaGrid: 'El panel del nudo, cuatro filas de cuatro',
    },
  },
  ca: {
    title: 'El Nus d’Oseberg',
    epigraph: 'Una sola banda, i sense fi. Va per damunt on anava per sota.',
    hints: [
      'Una sola banda recorre el plafó sencer i torna sobre si mateixa. Segueix-la des d’un creuament tallat i no aixequis la vista.',
      'On la banda es troba amb ella mateixa va per damunt, després per sota, després per damunt. Mai dues vegades igual.',
      'Els creuaments tallats no es mouen, i són ells els que fixen el compte de cada creuament que segueix pel recorregut. Comença en un i estén cada creuament com la banda demani.',
    ],
    nearMap: {
      [NEAR_ONE]: 'La banda es doblega sobre si mateixa en un punt.',
      [nearMany(2)]: 'La banda es doblega sobre si mateixa en 2 punts.',
      [nearMany(3)]: 'La banda es doblega sobre si mateixa en 3 punts.',
      [nearMany(4)]: 'La banda es doblega sobre si mateixa en 4 punts.',
      [nearMany(5)]: 'La banda es doblega sobre si mateixa en 5 punts.',
      [nearMany(6)]: 'La banda es doblega sobre si mateixa en 6 punts.',
      [nearMany(7)]: 'La banda es doblega sobre si mateixa en 7 punts.',
      [nearMany(8)]: 'La banda es doblega sobre si mateixa en 8 punts.',
      [nearMany(9)]: 'La banda es doblega sobre si mateixa en 9 punts.',
      [nearMany(10)]: 'La banda es doblega sobre si mateixa en 10 punts.',
      [nearMany(11)]: 'La banda es doblega sobre si mateixa en 11 punts.',
      [nearMany(12)]: 'La banda es doblega sobre si mateixa en 12 punts.',
    },
    board: {
      plate: 'Gira els creuaments lliures fins que una sola banda sense trencament recorri tot el plafó, per damunt i per sota fins al final.',
      law: 'Una sola banda recorre el plafó sencer i torna sobre si mateixa. Seguint-la, cada creuament va per damunt, després per sota, després per damunt — mai dues vegades igual.',
      help: 'Toca un creuament per estendre’l de l’altra manera. Amb el teclat: fletxes per recórrer el plafó, espai per estendre un creuament, T per seguir la banda.',
      trace: 'Segueix la banda',
      submit: 'Lligar el nus',
      submitDone: 'El nus queda lligat',
      skip: 'Saltar la mostra',
      demoSay: 'Mira-ho un cop: un creuament es gira, i la lluïssor corre més lluny per la banda.',
      solvedLine: 'La banda corre per damunt i per sota sense falta.',
      tallyOne: 'El teixit es llegeix com una sola banda. Lliga el nus.',
      tallyMany: 'El teixit es llegeix com {n} bandes.',
      carvedDeny: '{where} està tallat. No es pot estendre d’una altra manera.',
      bendSay: '{where} és un colze; allà la banda només gira.',
      traceSay: 'Des de {where} la banda segueix fins a {list}.',
      joiner: ', i fins a ',
      describeBend: '{where}: un colze tallat.',
      describeCross: '{where}: {kind}, {lie}.',
      kindCarved: 'un creuament tallat',
      kindFree: 'un creuament',
      lieNs: 'la banda dreta queda per damunt',
      lieWe: 'la banda correguda queda per damunt',
      keysNote: 'Amb el teclat: les fletxes recorren el plafó; espai o Retorn estén un creuament de l’altra manera; T segueix la banda des de la casella recorreguda.',
      openPanel: 'Un plafó de setze caselles. {n} creuaments es poden estendre de qualsevol manera; la resta estan tallats.',
      openBands: 'La banda dreta corre de nord a sud; la banda correguda, d’oest a est.',
      openCarved: 'Tallat: {desc}',
      where: 'fila {r}, asta {c}',
      ariaGrid: 'El plafó del nus, quatre files de quatre',
    },
  },
};

export default {
  id: '05-knotwork',
  ordinal: 5,
  tier: 2,
  title: 'The Oseberg Knot',
  epigraph: 'One band, and no end to it. It goes over where it went under.',

  makePuzzle,
  solve,
  verify,
  wrongAnswers,
  shard: () => ({ ...SHARDS['05-knotwork'] }),

  difficulty: {
    searchSpace: 256, // 2^8 layings of the free tiles, at the widest
    minSteps: 14,   // sixteen tiles walked to find the band, then the tiles laid and sworn
    estMinutes: 5,  // ENTRY-CURVE AMENDMENT: measured cold at about four minutes
  },

  hints: [
    'One band runs the whole panel and comes back to itself. Follow it from a carved crossing and do not lift your eye.',
    'Where the band meets itself it goes over, then under, then over again. Never twice the same.',
    'The carved crossings cannot be moved, and they set the count for every crossing that follows along the run. Begin at one and lay each crossing as the band demands.',
  ],

  i18n: I18N,

  mount,
};
