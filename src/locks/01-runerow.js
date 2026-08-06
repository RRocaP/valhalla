// 01 — THE RUNE ROW (tier 1, teaching)
//
// Sixteen carved staves of the Younger Futhark lie jumbled on the lid; three or
// four were struck from the wrong face (wend-runes). Restore the row.
//
// Pure half: no DOM, no globals, no Math.random, no Date. Only the seeded rng.
//
// Uniqueness (docs/LOCKS.md common law): the sixteen staves are pairwise
// distinct, so the futhark row admits exactly one placement, and each tile's
// face is fixed by whether it was carved backwards. makePuzzle asserts the
// distinctness that makes that argument exhaustive.
//
// Difficulty accounting: eight tiles are displaced and three or four are cut
// backwards; the optimal line is at least six slides plus the flips, and every
// tile must be read against the rail before it is judged.

import { BY_CH, FUTHARK, ORDER } from '../kernel/futhark.js';
import { SHARDS } from '../kernel/shards.js';

const N = 16;
const JUMBLED = 8;
// The three ættir of the Younger Futhark: six, five, five.
const AETTIR = [[0, 6], [6, 11], [11, 16]];
const AETT_WORD = ['first', 'second', 'third'];

const rd = (v) => Math.round(v * 1e4) / 1e4;
const segKey = (seg) => {
  const fwd = seg.map((p) => p.map(rd).join(',')).join(' ');
  const rev = seg.slice().reverse().map((p) => p.map(rd).join(',')).join(' ');
  return fwd < rev ? fwd : rev;
};
const shapeKey = (segs) => segs.map(segKey).sort().join('|');
const mirrorSegs = (segs) => segs.map((seg) => seg.map(([x, y]) => [1 - x, y]));

const SHAPES = FUTHARK.map((r) => shapeKey(r.segments));
const MIRRORED = FUTHARK.map((r) => shapeKey(mirrorSegs(r.segments)));

// A stave may be cut backwards only if its mirror is visibly other than itself
// and other than every stave in the row — otherwise the player could not tell.
export const WENDABLE = FUTHARK
  .filter((r, i) => MIRRORED[i] !== SHAPES[i] && !SHAPES.some((s, j) => j !== i && s === MIRRORED[i]))
  .map((r) => r.ch);

function makePuzzle(rng) {
  const all = [];
  for (let i = 0; i < N; i++) all.push(i);

  const chosen = rng.shuffle(all).slice(0, JUMBLED).sort((a, b) => a - b);
  let perm = chosen;
  for (let guard = 0; guard < 200; guard++) {
    perm = rng.shuffle(chosen);
    if (perm.every((p, k) => p !== chosen[k])) break;
  }

  const display = ORDER.slice();
  chosen.forEach((pos, k) => { display[pos] = ORDER[perm[k]]; });

  const wendable = display.map((ch, i) => (WENDABLE.indexOf(ch) >= 0 ? i : -1)).filter((i) => i >= 0);
  const wend = rng.shuffle(wendable).slice(0, rng.range(3, 4));

  const tiles = display.map((ch, i) => ({ ch, wend: wend.indexOf(i) >= 0 }));

  // Exhaustive uniqueness: sixteen distinct staves, so the row has one filling.
  const marks = new Set(tiles.map((t) => t.ch));
  if (marks.size !== N) return makePuzzle(rng);

  return { tiles };
}

function solve(instance) {
  const order = ORDER.map((ch) => instance.tiles.findIndex((t) => t.ch === ch));
  const flips = order.map((i) => !!instance.tiles[i].wend);
  return { flips, order };
}

function wrongPositions(instance, order, flips) {
  const wrong = [];
  for (let p = 0; p < N; p++) {
    const t = instance.tiles[order[p]];
    if (!t || t.ch !== ORDER[p] || flips[p] !== !!t.wend) wrong.push(p);
  }
  return wrong;
}

function verify(instance, answer) {
  try {
    if (!instance || !Array.isArray(instance.tiles) || instance.tiles.length !== N) return { ok: false };
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
    const { order, flips } = answer;
    if (!Array.isArray(order) || !Array.isArray(flips)) return { ok: false };
    if (order.length !== N || flips.length !== N) return { ok: false };
    const seen = new Set();
    for (const v of order) {
      if (!Number.isInteger(v) || v < 0 || v >= N || seen.has(v)) return { ok: false };
      seen.add(v);
    }
    for (const f of flips) if (typeof f !== 'boolean') return { ok: false };

    const wrong = wrongPositions(instance, order, flips);
    if (!wrong.length) return { ok: true };

    const placedRight = order.every((i, p) => instance.tiles[i].ch === ORDER[p]);
    if (placedRight) return { ok: false, near: 'The row stands in order, but a stave still faces the wrong hand.' };

    const whole = AETTIR
      .map((a, k) => (wrong.some((p) => p >= a[0] && p < a[1]) ? null : AETT_WORD[k]))
      .filter(Boolean);
    if (!whole.length) return { ok: false, near: 'No ætt stands whole.' };
    if (whole.length === 1) return { ok: false, near: `The ${whole[0]} ætt stands true. The rest does not.` };
    return { ok: false, near: `The ${whole[0]} and ${whole[1]} ættir stand true. The rest does not.` };
  } catch (e) {
    return { ok: false };
  }
}

function wrongAnswers(instance) {
  const right = solve(instance);
  const out = [];
  const push = (a) => {
    if (JSON.stringify(a.order) !== JSON.stringify(right.order) ||
        JSON.stringify(a.flips) !== JSON.stringify(right.flips)) out.push(a);
  };
  const idn = [];
  for (let i = 0; i < N; i++) idn.push(i);

  push({ order: right.order.slice(), flips: right.flips.map(() => false) });
  push({ order: right.order.slice(), flips: right.flips.map(() => true) });
  push({ order: right.order.slice(), flips: right.flips.map((f, i) => (i === right.flips.indexOf(true) ? !f : f)) });
  push({ order: idn.slice(), flips: idn.map((i) => !!instance.tiles[i].wend) });
  push({ order: idn.slice().reverse(), flips: idn.map(() => false) });
  push({ order: right.order.slice().reverse(), flips: right.flips.slice().reverse() });
  push({ order: right.order.slice(), flips: right.flips.map((f, i) => right.flips[(i + 1) % N]) });
  const swapped = right.order.slice();
  const tmp = swapped[3]; swapped[3] = swapped[4]; swapped[4] = tmp;
  push({ order: swapped, flips: right.flips.slice() });
  return out;
}

// ------------------------------------------------------------------ the view

const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";
const PLACE = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth',
  'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth'];

function mount(ctx) {
  const art = ctx.art;
  const p = art.palette;
  const instance = ctx.instance;
  const nameOf = (ch) => (BY_CH[ch] ? BY_CH[ch].name : ch);

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

  // Deterministic per-tile micro-noise (view-only; the pure half never sees it).
  const h32 = (n) => {
    let x = (n | 0) + 0x9e3779b9;
    x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
    x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
    return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
  };

  // ---- state -------------------------------------------------------------
  const solved = ctx.solved ? solve(instance) : null;
  const row = solved ? solved.order.slice() : instance.tiles.map((t, i) => i);
  const flip = instance.tiles.map((t, i) => (solved ? !!t.wend : false));
  let held = -1;
  let keysSaid = false;

  // ---- frame -------------------------------------------------------------
  const wrap = node('div', `display:grid;gap:14px;font-family:${SERIF};color:${p.bone}`);

  const style = node('style');
  style.textContent = `
    .ow1-tile{background:none;border:0;padding:0;cursor:grab;touch-action:none;border-radius:4px;
      display:block;line-height:0;outline-offset:3px;
      filter:drop-shadow(0 2px 2px rgba(12,9,6,.55));
      transition:transform .12s ease,filter .12s ease}
    .ow1-tile:focus-visible{outline:2px solid ${p.goldBright}}
    .ow1-tile[data-held="1"]{cursor:grabbing;transform:translateY(-4px);
      filter:drop-shadow(0 7px 7px rgba(12,9,6,.7))}
    .ow1-act{font-family:${SERIF};font-size:16px;color:${p.bone};background:${p.oakDeep};
      border:1px solid ${p.gold};border-radius:3px;padding:12px 20px;min-height:44px;cursor:pointer}
    .ow1-act:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    .ow1-act[disabled]{opacity:.5;cursor:default}
    @media (prefers-reduced-motion: reduce){
      .ow1-tile{transition:none}
      .ow1-tile[data-held="1"]{transform:none}
    }
  `;
  wrap.append(style);

  const railLabel = node('p', `margin:0;font-size:13px;color:${p.boneDim};letter-spacing:.08em`,
    'The row as it should stand');
  const rail = art.makeCanvas(640, 76);
  rail.canvas.style.width = '100%';
  rail.canvas.style.height = 'auto';
  rail.canvas.setAttribute('role', 'img');
  rail.canvas.setAttribute('aria-label', 'The carved rail: ' + ORDER.map(nameOf).join(', ')
    + '. Three ættir: staves one to six, seven to eleven, twelve to sixteen.');

  const rowWrap = node('div', 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center');
  rowWrap.setAttribute('role', 'list');
  rowWrap.setAttribute('aria-label', 'The sixteen tiles, left to right');

  const helpText = 'Drag a tile to move it. Tap a tile to turn it over. '
    + 'By key: arrows to walk the row, space to lift and set down, F to turn a tile over.';
  const help = node('p', `margin:0;font-size:13px;color:${p.boneDim}`, helpText);

  const status = node('p', `margin:0;min-height:20px;font-size:14px;color:${p.boneDim}`);
  status.setAttribute('aria-live', 'polite');

  const actions = node('div', 'display:flex;gap:10px;flex-wrap:wrap;align-items:center');
  const submitBtn = node('button', null, 'Set the row');
  submitBtn.className = 'ow1-act';
  submitBtn.type = 'button';
  actions.append(submitBtn);

  wrap.append(railLabel, rail.canvas, rowWrap, help, actions, status);
  ctx.root.append(wrap);

  // ---- painting ----------------------------------------------------------
  // Faint surviving pigment, one colour per ætt — the Oseberg way: paint
  // lives on in the grooves. Doubles as the map for the near-spoken ættir.
  const AETT_TINT = [p.blood, p.fjord, p.pine];
  let nearMarks = null; // [true|false ×3] after a near-miss; any touch clears it

  const gapX = (rail.w - 16) / 16;
  const regionSpan = (k) => {
    const [a, b] = AETTIR[k];
    return [8 + gapX * a + 2, 8 + gapX * b - 2];
  };

  function paintRail() {
    const c = rail.ctx;
    c.clearRect(0, 0, rail.w, rail.h);
    art.paintPanel(c, 0, 0, rail.w, rail.h, { title: null });

    // worn pigment bands, one per ætt
    for (let k = 0; k < 3; k++) {
      const [x0, x1] = regionSpan(k);
      c.save();
      c.globalAlpha = 0.13;
      c.fillStyle = AETT_TINT[k];
      c.fillRect(x0, 11, x1 - x0, rail.h - 22);
      c.restore();
    }

    // carved divider notches between the ættir
    for (const b of [AETTIR[1][0], AETTIR[2][0]]) {
      const x = 8 + gapX * b;
      c.save();
      c.strokeStyle = p.tar;
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(x - 0.8, 14); c.lineTo(x - 0.8, rail.h - 14); c.stroke();
      c.strokeStyle = p.oakLight;
      c.lineWidth = 1;
      c.globalAlpha = 0.55;
      c.beginPath(); c.moveTo(x + 0.8, 14); c.lineTo(x + 0.8, rail.h - 14); c.stroke();
      c.restore();
    }

    const size = 44;
    for (let i = 0; i < 16; i++) {
      art.drawRune(c, ORDER[i], 8 + gapX * i + (gapX - size) / 2, (rail.h - size) / 2, size,
        { color: p.boneDim });
    }

    // after a near-miss: gold under the ættir that stand, ember under the rest
    if (nearMarks) {
      for (let k = 0; k < 3; k++) {
        const [x0, x1] = regionSpan(k);
        c.save();
        c.globalAlpha = 0.9;
        c.fillStyle = nearMarks[k] ? p.gold : p.ember;
        c.fillRect(x0, rail.h - 10, x1 - x0, 2.5);
        c.restore();
      }
    }

    // nailheads holding the rail to the lid
    for (const [nx, ny] of [[13, 13], [rail.w - 13, 13], [13, rail.h - 13], [rail.w - 13, rail.h - 13]]) {
      art.ornament(c, 'nailhead', nx, ny, 8);
    }
  }

  function clearMarks() {
    if (!nearMarks) return;
    nearMarks = null;
    paintRail();
  }

  const tiles = instance.tiles.map((t, id) => {
    const btn = node('button');
    btn.className = 'ow1-tile';
    btn.type = 'button';
    btn.setAttribute('role', 'listitem');
    const gfx = art.makeCanvas(46, 60);
    btn.append(gfx.canvas);
    return { id, btn, gfx, key: '' };
  });

  function paintTile(tile) {
    const t = instance.tiles[tile.id];
    const facing = t.wend !== flip[tile.id];
    const lifted = held === tile.id;
    const key = `${facing}|${lifted}`;
    if (tile.key === key) return; // repaint only on a real state change
    tile.key = key;

    const c = tile.gfx.ctx;
    const { w, h } = tile.gfx;
    c.clearRect(0, 0, w, h);
    art.paintPanel(c, 0, 0, w, h, { title: null });

    // vertical grain showing through the tablet's face
    c.save();
    c.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      const gx = 10 + h32(tile.id * 7 + k) * (w - 20);
      const sway = (h32(tile.id * 13 + k) - 0.5) * 5;
      c.strokeStyle = p.oakLight;
      c.globalAlpha = 0.10 + h32(tile.id * 3 + k) * 0.08;
      c.beginPath();
      c.moveTo(gx, 8);
      c.quadraticCurveTo(gx + sway, h / 2, gx, h - 8);
      c.stroke();
    }
    c.restore();

    // worn red paint in the groove, then the bone cut over it
    const size = h - 18;
    const x = (w - size) / 2;
    c.save();
    c.globalAlpha = 0.42;
    art.drawRune(c, t.ch, x - 0.5, 9.5, size, { color: p.blood, mirror: facing, weight: size / 6.2 });
    c.restore();
    art.drawRune(c, t.ch, x, 9, size, { color: lifted ? p.goldBright : p.bone, mirror: facing });

    // nailheads pinning the tile's corners
    for (const [nx, ny] of [[8, 8], [w - 8, 8], [8, h - 8], [w - 8, h - 8]]) {
      art.ornament(c, 'nailhead', nx, ny, 6);
    }
  }

  function render() {
    row.forEach((id, place) => {
      const tile = tiles[id];
      rowWrap.append(tile.btn);
      const t = instance.tiles[id];
      const facing = t.wend !== flip[id] ? 'facing backwards' : 'standing upright';
      tile.btn.dataset.held = held === id ? '1' : '0';
      tile.btn.setAttribute('aria-label',
        `${PLACE[place]} place: ${nameOf(t.ch)}, ${facing}` + (held === id ? ', lifted' : ''));
      paintTile(tile);
    });
  }

  // ---- moves -------------------------------------------------------------
  function moveTo(id, to) {
    const from = row.indexOf(id);
    const target = Math.max(0, Math.min(row.length - 1, to));
    if (from === target) return false;
    row.splice(from, 1);
    row.splice(target, 0, id);
    return true;
  }

  function reportMove(id, from) {
    const to = row.indexOf(id);
    const t = instance.tiles[id];
    const line = `${nameOf(t.ch)} slides from the ${PLACE[from]} place to the ${PLACE[to]}.`;
    status.textContent = line;
    say(line);
  }

  function doFlip(id) {
    flip[id] = !flip[id];
    clearMarks();
    const t = instance.tiles[id];
    const facing = t.wend !== flip[id] ? 'faces backwards' : 'stands upright';
    const line = `The ${PLACE[row.indexOf(id)]} tile turns: ${nameOf(t.ch)} ${facing}.`;
    sfx('flip');
    render();
    status.textContent = line;
    say(line);
  }

  // ---- pointer: drag to reorder, tap to turn ------------------------------
  let drag = null;

  function nearestPlace(x, y) {
    let best = 0, bestD = Infinity;
    row.forEach((id, place) => {
      const r = tiles[id].btn.getBoundingClientRect();
      const dx = x - (r.left + r.width / 2);
      const dy = y - (r.top + r.height / 2);
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = place; }
    });
    return best;
  }

  tiles.forEach((tile) => {
    on(tile.btn, 'pointerdown', (ev) => {
      if (ctx.solved) return;
      drag = { id: tile.id, x: ev.clientX, y: ev.clientY, moved: false, from: row.indexOf(tile.id) };
      try { tile.btn.setPointerCapture(ev.pointerId); } catch (e) { /* mouse without capture */ }
    });

    on(tile.btn, 'pointermove', (ev) => {
      if (!drag || drag.id !== tile.id) return;
      if (!drag.moved) {
        if (Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) < 8) return;
        drag.moved = true;
        held = tile.id;
        sfx('slide');
      }
      const place = nearestPlace(ev.clientX, ev.clientY);
      if (moveTo(tile.id, place)) { clearMarks(); sfx('tick'); render(); }
      ev.preventDefault();
    });

    const finish = (ev) => {
      if (!drag || drag.id !== tile.id) return;
      const wasMoved = drag.moved;
      const from = drag.from;
      drag = null;
      held = -1;
      try { tile.btn.releasePointerCapture(ev.pointerId); } catch (e) { /* already gone */ }
      if (wasMoved) { sfx('knock'); render(); reportMove(tile.id, from); } else { doFlip(tile.id); }
    };
    on(tile.btn, 'pointerup', finish);
    on(tile.btn, 'pointercancel', () => { drag = null; held = -1; render(); });

    on(tile.btn, 'keydown', (ev) => {
      if (ctx.solved) return;
      const place = row.indexOf(tile.id);
      const step = (d) => {
        if (held === tile.id) {
          const from = place;
          if (moveTo(tile.id, place + d)) { clearMarks(); sfx('slide'); render(); reportMove(tile.id, from); }
          tile.btn.focus();
        } else {
          const next = tiles[row[Math.max(0, Math.min(row.length - 1, place + d))]];
          next.btn.focus();
          sfx('tick');
        }
      };
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); step(-1); }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); step(1); }
      else if (ev.key === 'Home') { ev.preventDefault(); step(-row.length); }
      else if (ev.key === 'End') { ev.preventDefault(); step(row.length); }
      else if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown' || ev.key === 'f' || ev.key === 'F') {
        ev.preventDefault(); doFlip(tile.id);
      } else if (ev.key === ' ' || ev.key === 'Spacebar') {
        ev.preventDefault();
        held = held === tile.id ? -1 : tile.id;
        sfx(held === tile.id ? 'slide' : 'knock');
        render();
        const line = held === tile.id
          ? `${nameOf(instance.tiles[tile.id].ch)} is lifted. Arrows move it; space sets it down.`
          : `${nameOf(instance.tiles[tile.id].ch)} is set down in the ${PLACE[place]} place.`;
        status.textContent = line;
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        doFlip(tile.id);
      }
    });

    on(tile.btn, 'focus', () => {
      if (keysSaid) return;
      keysSaid = true;
      say('By key: arrows walk the row; space lifts a tile and sets it down; '
        + 'F or Enter turns it over; Home and End run to the row’s ends.');
    });
  });

  // ---- submit ------------------------------------------------------------
  function answer() {
    return { order: row.slice(), flips: row.map((id) => !!flip[id]) };
  }

  // The shell owns the shudder and the deny voice. The board's part is to show
  // WHERE the row disagrees — at the near-line's own grain, the ætt.
  function handle(res, sent) {
    if (!res || res.ok) return;
    if (res.near) { status.textContent = res.near; say(res.near); }
    if (sent) {
      const wrong = wrongPositions(instance, sent.order, sent.flips);
      nearMarks = AETTIR.map(([a, b]) => !wrong.some((q) => q >= a && q < b));
      paintRail();
    }
  }

  on(submitBtn, 'click', () => {
    if (ctx.solved) return;
    sfx('confirm');
    const sent = answer();
    let res;
    try { res = ctx.submit(sent); } catch (e) { return; }
    if (res && typeof res.then === 'function') res.then((r) => handle(r, sent), () => {});
    else handle(res, sent);
  });

  // ---- open the lock -----------------------------------------------------
  paintRail();
  render();
  say('The rail carries the row: ' + ORDER.map(nameOf).join(', ') + '.');
  say('Three ættir divide the rail — six staves, then five, then five. The paint marks them.');
  say('Sixteen tiles lie below, and some were struck from the wrong face.');
  if (ctx.solved) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'The row stands';
    status.textContent = 'The row stands as it was cut.';
  } else {
    later(() => { const first = tiles[row[0]]; if (first) first.btn.setAttribute('tabindex', '0'); }, 0);
  }

  return {
    unmount() {
      for (const off of cleanup) off();
      cleanup.length = 0;
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
      drag = null;
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    },
  };
}

export default {
  id: '01-runerow',
  ordinal: 1,
  tier: 1,
  title: 'The Rune Row',
  epigraph: 'Sixteen staves stand in one order. The carver\'s hand slipped, or lied.',

  makePuzzle,
  solve,
  verify,
  wrongAnswers,
  shard: () => ({ ...SHARDS['01-runerow'] }),

  difficulty: {
    searchSpace: 1.4e18, // 16! orders x 2^16 faces
    minSteps: 8,
    estMinutes: 2,
  },

  hints: [
    'The carver scattered the row. He did not change it — the futhark keeps one order, and it is cut along the rail.',
    'Some staves were struck from the wrong face. A stave that faces the wrong hand matches nothing on the rail.',
    'Judge a tile\'s face before its place. Then set the ættir in turn: six, five, five.',
  ],

  mount,
};
