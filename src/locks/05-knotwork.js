// 05 — THE OSEBERG KNOT (tier 2, combination)
//
// A four-by-four panel of strand tiles. Carved tiles cannot be moved; the free
// tiles are crossings, and each may be laid either way — the standing band over
// the running band, or under it. Lay the panel so the whole weave is knotwork.
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
// Difficulty accounting: twelve free tiles, of which eleven are laid wrong at
// the start, plus tracing the band from a carved crossing and the closing
// oath — fourteen acts, and no fewer.

import { SHARDS } from '../kernel/shards.js';

const SIDE = 4;
const CELLS = SIDE * SIDE;
const PORTS = CELLS * 4;
const N = 0, E = 1, S = 2, W = 3;
const FREE_TILES = 12;
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
    if (crossCells.length <= FREE_TILES) continue; // at least one carved crossing

    // One of the two alternating layings is the truth.
    const g = rng.int(2);
    const truth = new Array(CELLS).fill(null);
    seq.forEach((s, q) => { if (q % 2 === g) truth[s.cell] = s.band; });

    const free = rng.shuffle(crossCells).slice(0, FREE_TILES).sort((a, b) => a - b);
    for (const i of crossCells) {
      if (free.indexOf(i) >= 0) continue;
      cells[i] = { kind: 'cross', carved: true, over: truth[i] };
    }

    // Laid wrong at the start in every place but one — never the plain inverse.
    const answer = free.map((cell) => truth[cell] === 'ns');
    const kept = rng.int(FREE_TILES);
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

const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";
const TILE = 90;
const PANEL = TILE * SIDE;

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
  for (let i = 0; i <= 12; i++) {
    const t = a0 + (a1 - a0) * (i / 12);
    pts.push([corner[0] + Math.cos(t) * (TILE / 2), corner[1] + Math.sin(t) * (TILE / 2)]);
  }
  return pts;
}

function mount(ctx) {
  const art = ctx.art;
  const p = art.palette;
  const instance = ctx.instance;

  const cleanup = [];
  const timers = [];
  const on = (el, ev, fn, opts) => {
    el.addEventListener(ev, fn, opts);
    cleanup.push(() => el.removeEventListener(ev, fn, opts));
  };
  const sfx = (k) => { try { ctx.audio && ctx.audio.ui && ctx.audio.ui(k); } catch (e) { /* silent hall */ } };
  const say = (text) => { try { ctx.note && ctx.note(text); } catch (e) { /* no journal */ } };
  const reduced = () => {
    try { return !!(globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  };
  const node = (tag, css, text) => {
    const n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  };

  const where = (cell) => `row ${(cell >> 2) + 1}, stave ${(cell & 3) + 1}`;

  // ---- state -------------------------------------------------------------
  const seq = traceBand(instance.cells, buildLinks(instance.border)).seq;
  const states = ctx.solved ? solve(instance).states : instance.initial.slice();
  let focused = instance.free.length ? instance.free[0] : 0;
  let keysSaid = false;
  let pulse = -1;          // a just-laid crossing gleams for a breath
  let pulseTimer = null;
  let nearFault = null;    // [cellA, cellB]: the first doubling-over along the band

  const overNow = () => {
    const map = new Array(CELLS).fill(null);
    instance.cells.forEach((c, i) => { if (c.kind === 'cross' && c.carved) map[i] = c.over; });
    instance.free.forEach((cell, i) => { map[cell] = states[i] ? 'ns' : 'we'; });
    return map;
  };

  const wrap = node('div', `display:grid;gap:14px;justify-items:center;font-family:${SERIF};color:${p.bone}`);
  const style = node('style');
  style.textContent = `
    .ow5-panel{position:relative;width:100%;max-width:${PANEL}px}
    .ow5-cell{position:absolute;width:25%;height:25%;background:none;border:0;padding:0;margin:0;
      cursor:pointer;border-radius:3px}
    .ow5-cell:focus-visible{outline:2px solid ${p.goldBright};outline-offset:-3px}
    .ow5-cell[data-carved="1"]{cursor:default}
    .ow5-act{font-family:${SERIF};font-size:15px;color:${p.boneDim};background:transparent;
      border:1px solid rgba(90,58,30,.9);border-radius:3px;padding:11px 18px;min-height:44px;cursor:pointer}
    .ow5-act:hover{color:${p.bone};border-color:${p.oakLight}}
    .ow5-act:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    .ow5-act[disabled]{opacity:.5;cursor:default}
  `;
  wrap.append(style);

  const law = node('p', `margin:0;font-size:13px;color:${p.boneDim};line-height:1.5;text-align:center`,
    'One band runs the whole panel and returns to itself. Following it, every crossing goes over, then under, then over — never twice the same.');

  const panel = node('div');
  panel.className = 'ow5-panel';
  const gfx = art.makeCanvas(PANEL, PANEL);
  gfx.canvas.style.width = '100%';
  gfx.canvas.style.height = 'auto';
  gfx.canvas.setAttribute('aria-hidden', 'true');
  panel.append(gfx.canvas);

  const grid = node('div', 'position:absolute;inset:0');
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', 'The knot panel, four rows of four');
  panel.append(grid);

  const cellBtns = [];
  for (let cell = 0; cell < CELLS; cell++) {
    const btn = node('button');
    btn.className = 'ow5-cell';
    btn.type = 'button';
    btn.style.left = `${(cell & 3) * 25}%`;
    btn.style.top = `${(cell >> 2) * 25}%`;
    btn.setAttribute('tabindex', cell === focused ? '0' : '-1');
    grid.append(btn);
    cellBtns.push(btn);
  }

  const help = node('p', `margin:0;font-size:13px;color:${p.boneDim};text-align:center`,
    'Tap a crossing to lay it the other way. By key: arrows to walk the panel, space to lay a crossing, T to follow the band.');
  const status = node('p', `margin:0;min-height:20px;font-size:14px;color:${p.boneDim};text-align:center`);
  status.setAttribute('aria-live', 'polite');

  const actions = node('div', 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center');
  const traceBtn = node('button', null, 'Follow the band');
  traceBtn.className = 'ow5-act';
  traceBtn.type = 'button';
  const submitBtn = node('button', null, 'Bind the knot');
  submitBtn.className = 'btn-carved'; // one primary-action language: the carved gold plate
  submitBtn.type = 'button';
  actions.append(traceBtn, submitBtn);

  wrap.append(law, panel, help, actions, status);
  ctx.root.append(wrap);

  // ---- painting ----------------------------------------------------------
  function band(c, cell, dir, other, opts) {
    const x0 = (cell & 3) * TILE, y0 = (cell >> 2) * TILE;
    let pts = arcPoints(dir, other).map(([x, y]) => [x0 + x, y0 + y]);
    if (opts.gap) {
      // the band that runs under is cut at the crossing
      const half = Math.ceil(pts.length / 2);
      const a = pts.slice(0, half).map(([x, y]) => [x, y]);
      const b = pts.slice(half);
      const shrink = (seg, fromEnd) => {
        const cutFrom = fromEnd ? seg[0] : seg[seg.length - 1];
        const other2 = fromEnd ? seg[seg.length - 1] : seg[0];
        const dx = other2[0] - cutFrom[0], dy = other2[1] - cutFrom[1];
        const len = Math.hypot(dx, dy) || 1;
        const back = Math.min(11, len * 0.45);
        const moved = [cutFrom[0] + (dx / len) * back, cutFrom[1] + (dy / len) * back];
        return fromEnd ? [moved, other2] : [other2, moved];
      };
      pts = null;
      for (const seg of [shrink(a, false), shrink(b, true)]) {
        art.drawKnot(c, seg, { width: opts.width, color: opts.color });
      }
      return;
    }
    art.drawKnot(c, pts, { width: opts.width, color: opts.color });
  }

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
    c.clearRect(0, 0, PANEL, PANEL);
    art.paintWood(c, PANEL, PANEL, 5, {});
    art.paintPanel(c, 0, 0, PANEL, PANEL, { title: null });

    const map = overNow();
    const near = neighbours(focused);

    for (let cell = 0; cell < CELLS; cell++) {
      const kind = instance.cells[cell].kind;
      const carved = instance.cells[cell].carved;
      const lit = cell === focused;
      const colour = lit ? p.goldBright : (carved ? p.gold : p.bone);
      const x0 = (cell & 3) * TILE, y0 = (cell >> 2) * TILE;
      const cx = x0 + TILE / 2, cy = y0 + TILE / 2;

      if (kind === 'cross') {
        const nsOver = map[cell] === 'ns';
        band(c, cell, W, E, { width: 11, color: colour, gap: nsOver });
        band(c, cell, N, S, { width: 11, color: colour, gap: !nsOver });

        // sheen where the over-strand crests the crossing
        c.save();
        c.globalAlpha = 0.3;
        try { art.glow(c, cx, cy, 9, p.goldBright, 0.8); } catch (e) { /* stub */ }
        c.globalAlpha = 0.38;
        c.strokeStyle = p.goldBright;
        c.lineWidth = 2.4;
        c.lineCap = 'round';
        c.beginPath();
        if (nsOver) { c.moveTo(cx - 1.4, cy - 12); c.lineTo(cx - 1.4, cy + 9); }
        else { c.moveTo(cx - 12, cy - 1.4); c.lineTo(cx + 9, cy - 1.4); }
        c.stroke();
        c.restore();
      } else {
        const arcs = ARCS[kind];
        for (const [a, b] of arcs) band(c, cell, a, b, { width: 11, color: colour, gap: false });
      }

      if (carved) {
        for (const [dx, dy] of [[8, 8], [TILE - 8, 8], [8, TILE - 8], [TILE - 8, TILE - 8]]) {
          art.ornament(c, 'nailhead', x0 + dx, y0 + dy, 7);
        }
      }
      if (near.indexOf(cell) >= 0) {
        c.save();
        c.strokeStyle = p.ember;
        c.lineWidth = 2;
        c.setLineDash([5, 5]);
        c.strokeRect(x0 + 4.5, y0 + 4.5, TILE - 9, TILE - 9);
        c.restore();
      }
      if (cell === pulse) {
        try { art.glow(c, cx, cy, TILE * 0.34, p.goldBright, 0.5); } catch (e) { /* stub */ }
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

    // the panel nailed to the lid at its corners
    for (const [nx, ny] of [[10, 10], [PANEL - 10, 10], [10, PANEL - 10], [PANEL - 10, PANEL - 10]]) {
      art.ornament(c, 'nailhead', nx, ny, 9);
    }
  }

  function describeCell(cell) {
    const c = instance.cells[cell];
    if (c.kind !== 'cross') return `${where(cell)}: a carved bend.`;
    const map = overNow();
    const lie = map[cell] === 'ns' ? 'the standing band lies over' : 'the running band lies over';
    return `${where(cell)}: ${c.carved ? 'a carved crossing' : 'a crossing'}, ${lie}.`;
  }

  function render() {
    paint();
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
      const line = `${where(cell)} is carved. It cannot be laid otherwise.`;
      status.textContent = line;
      say(line);
      return;
    }
    states[k] = !states[k];
    nearFault = null;
    sfx('flip');
    if (!reduced()) {
      pulse = cell;
      if (pulseTimer) clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => { pulse = -1; pulseTimer = null; paint(); }, 160);
      timers.push(pulseTimer);
    }
    render();
    const line = describeCell(cell);
    status.textContent = line;
    say(line);
  }

  function trace(cell) {
    const near = neighbours(cell);
    if (!near.length) {
      const line = `${where(cell)} is a bend; the band only turns there.`;
      status.textContent = line;
      say(line);
      return;
    }
    sfx('slide');
    const line = `From ${where(cell)} the band runs on to ${near.map(where).join(', and to ')}.`;
    status.textContent = line;
    say(line);
  }

  function focus(cell) {
    focused = ((cell % CELLS) + CELLS) % CELLS;
    render();
    cellBtns[focused].focus();
  }

  cellBtns.forEach((btn, cell) => {
    on(btn, 'click', () => {
      focused = cell;
      render();
      if (!ctx.solved) toggle(cell);
    });
    on(btn, 'focus', () => {
      if (!keysSaid) {
        keysSaid = true;
        say('By key: arrows walk the panel; space or Enter lays a crossing the other way; T follows the band from the walked tile.');
      }
      if (focused !== cell) { focused = cell; render(); }
    });
    on(btn, 'keydown', (ev) => {
      const r = cell >> 2, col = cell & 3;
      if (ev.key === 'ArrowRight') { ev.preventDefault(); focus(r * SIDE + Math.min(SIDE - 1, col + 1)); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); focus(r * SIDE + Math.max(0, col - 1)); }
      else if (ev.key === 'ArrowDown') { ev.preventDefault(); focus(Math.min(SIDE - 1, r + 1) * SIDE + col); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); focus(Math.max(0, r - 1) * SIDE + col); }
      else if (ev.key === 't' || ev.key === 'T') { ev.preventDefault(); trace(cell); }
      else if (ev.key === ' ' || ev.key === 'Spacebar' || ev.key === 'Enter') {
        ev.preventDefault();
        if (!ctx.solved) toggle(cell);
      }
    });
  });

  on(traceBtn, 'click', () => trace(focused));

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
    sfx('confirm');
    let res;
    try { res = ctx.submit({ states: states.slice() }); } catch (e) { return; }
    if (res && typeof res.then === 'function') res.then(handle, () => {});
    else handle(res);
  });

  // ---- open the lock -----------------------------------------------------
  render();
  say(`A panel of sixteen tiles. ${instance.free.length} crossings may be laid either way; the rest are carved.`);
  say('The standing band runs north and south; the running band, west and east.');
  instance.cells.forEach((c, cell) => {
    if (c.kind === 'cross' && c.carved) say(`Carved: ${describeCell(cell)}`);
  });
  if (ctx.solved) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'The knot is bound';
    status.textContent = 'The band runs over and under without fault.';
  }

  return {
    unmount() {
      for (const off of cleanup) off();
      cleanup.length = 0;
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
      if (pulseTimer) clearTimeout(pulseTimer);
      pulseTimer = null;
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    },
  };
}

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
    searchSpace: 4096, // 2^12 layings of the free tiles
    minSteps: 14,
    estMinutes: 6,
  },

  hints: [
    'One band runs the whole panel and comes back to itself. Follow it from a carved crossing and do not lift your eye.',
    'Where the band meets itself it goes over, then under, then over again. Never twice the same.',
    'The carved crossings cannot be moved, and they set the count for every crossing that follows along the run. Begin at one and lay each crossing as the band demands.',
  ],

  mount,
};
