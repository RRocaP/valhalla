// 01 — THE FIRST ÆTT (tier 1, teaching)
//
// The whole sixteen-stave row stands carved on the rail above: that rail is the
// law, and ten of its staves are already done. Only the FIRST ÆTT — ᚠᚢᚦᚬᚱᚴ, the
// six that name the fuþark — hangs loose on the bench below. Four or five of the
// six lie out of place and EXACTLY ONE was struck from the wrong face. Drag to
// reorder, tap to turn.
//
// Pure half: no DOM, no globals, no Math.random, no Date. Only the seeded rng.
//
// Uniqueness (docs/LOCKS.md common law): the six loose staves are pairwise
// distinct, so each is forced into its own slot of the rail's first stretch and
// each face is forced by whether it was carved backwards. makePuzzle proves it
// the blunt way — a full sweep of all 6! x 2^6 = 46,080 candidate answers
// through the same acceptance predicate `verify` uses.
//
// Difficulty accounting: four or five slides, one turn, and the setting of the
// row — six player actions on the optimal line, two minutes for a careful cold
// reader who has never seen a rune before.

import { BY_CH, FUTHARK, ORDER } from '../kernel/futhark.js';
import { SHARDS } from '../kernel/shards.js';

const ROW = 16;                    // staves carved on the rail
const N = 6;                       // staves that hang loose
const AETT = ORDER.slice(0, N);    // ᚠ ᚢ ᚦ ᚬ ᚱ ᚴ — the first ætt

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

// Every candidate answer, built once: 720 orders x 64 face-sets.
const PERMS = (() => {
  const out = [];
  const walk = (left, acc) => {
    if (!left.length) { out.push(acc); return; }
    for (let i = 0; i < left.length; i++) {
      walk(left.slice(0, i).concat(left.slice(i + 1)), acc.concat(left[i]));
    }
  };
  walk([0, 1, 2, 3, 4, 5], []);
  return out;
})();

const FACESETS = (() => {
  const out = [];
  for (let mask = 0; mask < (1 << N); mask++) {
    const f = [];
    for (let b = 0; b < N; b++) f.push(((mask >> b) & 1) === 1);
    out.push(f);
  }
  return out;
})();

// The one acceptance predicate. `verify` validates shape and then asks this;
// the generator's uniqueness sweep asks exactly the same question.
function fits(tiles, order, flips) {
  for (let p = 0; p < N; p++) {
    const t = tiles[order[p]];
    if (!t || t.ch !== AETT[p] || flips[p] !== !!t.wend) return false;
  }
  return true;
}

function countFits(tiles) {
  let n = 0;
  for (const order of PERMS) {
    for (const flips of FACESETS) if (fits(tiles, order, flips)) n++;
  }
  return n;
}

function makePuzzle(rng) {
  const places = [0, 1, 2, 3, 4, 5];
  const displaced = rng.range(4, 5);
  const kept = rng.shuffle(places).slice(0, N - displaced);
  const moving = places.filter((p) => kept.indexOf(p) < 0);

  // derange the movers: none of them may fall on its own slot
  let perm = moving;
  for (let guard = 0; guard < 200; guard++) {
    perm = rng.shuffle(moving);
    if (perm.every((q, k) => q !== moving[k])) break;
  }

  const layout = places.slice();                 // layout[p] = which stave lies at p
  moving.forEach((p, k) => { layout[p] = perm[k]; });

  // exactly one wend-rune, and only where the mirror can be told from the true cut
  const turnable = layout.map((r, i) => (WENDABLE.indexOf(AETT[r]) >= 0 ? i : -1)).filter((i) => i >= 0);
  const turned = rng.pick(turnable);

  const tiles = layout.map((r, i) => ({ ch: AETT[r], wend: i === turned }));

  const marks = new Set(tiles.map((t) => t.ch));
  const out = tiles.filter((t, p) => t.ch !== AETT[p]).length;
  const wend = tiles.filter((t) => t.wend).length;
  if (marks.size !== N || out < 4 || out > 5 || wend !== 1) return makePuzzle(rng);
  if (countFits(tiles) !== 1) return makePuzzle(rng);   // exhaustive, 46,080 candidates

  return { tiles };
}

function solve(instance) {
  const order = AETT.map((ch) => instance.tiles.findIndex((t) => t.ch === ch));
  const flips = order.map((i) => !!instance.tiles[i].wend);
  return { flips, order };
}

// Canonical English near-lines. A bounded set, so `i18n.nearMap` can carry all
// of them; docs/LOCKS.md asks these to name positions.
const NEAR = {
  faceOne: 'The row stands in order — one stave is still turned against the rail.',
  faceMany: 'The row stands in order, but more than one stave is turned against the rail.',
  none: 'Not even the first stave stands true.',
  run: [
    'The first stave stands true; its neighbour does not.',
    'The first two staves stand true; the third does not.',
    'The first three staves stand true; the fourth does not.',
    'The first four staves stand true; the fifth does not.',
  ],
};

export const NEAR_LINES = [NEAR.faceOne, NEAR.faceMany, NEAR.none, ...NEAR.run];

function standsTrue(tiles, order, flips, p) {
  const t = tiles[order[p]];
  return !!t && t.ch === AETT[p] && flips[p] === !!t.wend;
}

function nearLine(tiles, order, flips) {
  const placed = order.every((i, p) => tiles[i] && tiles[i].ch === AETT[p]);
  if (placed) {
    const turned = order.filter((i, p) => flips[p] !== !!tiles[i].wend).length;
    return turned === 1 ? NEAR.faceOne : NEAR.faceMany;
  }
  let run = 0;
  while (run < N && standsTrue(tiles, order, flips, run)) run++;
  // With the placement wrong somewhere, run can never reach 5: a permutation
  // cannot misplace exactly one stave. So run is 0..4 here.
  return run === 0 ? NEAR.none : NEAR.run[run - 1];
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

    if (fits(instance.tiles, order, flips)) return { ok: true };
    return { ok: false, near: nearLine(instance.tiles, order, flips) };
  } catch (e) {
    return { ok: false };
  }
}

function wrongAnswers(instance) {
  const right = solve(instance);
  const asFound = [0, 1, 2, 3, 4, 5];
  const turnedAt = right.flips.indexOf(true);
  const out = [];
  const seen = new Set([JSON.stringify(right)]);
  const push = (order, flips) => {
    const a = { flips, order };
    const k = JSON.stringify(a);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(a);
  };

  // the row set right, the mirror never noticed
  push(right.order.slice(), right.flips.map(() => false));
  // the row set right, every stave turned in doubt
  push(right.order.slice(), right.flips.map(() => true));
  // the row set right, the wrong stave turned
  push(right.order.slice(), asFound.map((p) => p === (turnedAt + 1) % N));
  // the row set right, one stave turned too many
  push(right.order.slice(), right.flips.map((f, p) => f || p === (turnedAt + 2) % N));
  // the row set right, the turn slid one place along the bench
  push(right.order.slice(), right.flips.map((f, p) => right.flips[(p + 1) % N]));
  // the staves left as they were found, the mirror alone corrected
  push(asFound.slice(), asFound.map((i) => !!instance.tiles[i].wend));
  // the staves left as they were found, nothing turned
  push(asFound.slice(), asFound.map(() => false));
  // two neighbours traded, the faces carried with them
  const swapped = right.order.slice();
  const swappedFlips = right.flips.slice();
  [swapped[2], swapped[3]] = [swapped[3], swapped[2]];
  [swappedFlips[2], swappedFlips[3]] = [swappedFlips[3], swappedFlips[2]];
  push(swapped, swappedFlips);
  // the ætt read from the wrong end
  push(right.order.slice().reverse(), right.flips.slice().reverse());

  return out;
}

// ------------------------------------------------------------------ the view

const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";

// Board copy. English is the source; es/ca live in the additive i18n block
// (docs/CONTRACT.md §4.1 amendment) and are resolved through it at mount.
const BOARD_EN = {
  railLaw: 'The rail is the law',
  looseLaw: 'These six hang loose. Lay them under the rail’s first six.',
  help: 'Drag a stave into its place. Tap a stave to turn it over. By key: arrows walk the six, space lifts and sets down, F turns a stave over.',
  submit: 'Set the ætt',
  submitDone: 'The ætt stands',
  solvedLine: 'The first ætt stands as it was cut.',
  tally: '{n} of six staves stand true',
  tallyAll: 'All six staves stand true. Set the ætt.',
  skip: 'Skip the showing',
  demoSay: 'Watch once: a loose stave goes to its gap under the rail.',
  lifted: '{name} is lifted. Arrows move it; space sets it down.',
  setDown: '{name} is set down in the {place} place.',
  slid: '{name} slides from the {from} place to the {to}.',
  turned: 'The {place} stave turns: {name} {facing}.',
  landed: '{name} settles into its place under the rail.',
  facingTrue: 'stands upright',
  facingBack: 'faces backwards',
  ariaTile: '{place} place: {name}, {facing}',
  ariaLifted: ', lifted',
  ariaSeated: ', standing true under the rail',
  ariaRail: 'The carved rail, sixteen staves: {names}. Its first six — {first} — are the stretch that hangs loose below.',
  ariaRow: 'The six loose staves, left to right',
  keysNote: 'By key: arrows walk the six; space lifts a stave and sets it down; F or Enter turns it over; Home and End run to the ends.',
  openLaw: 'The rail carries the whole row: {names}.',
  openLoose: 'Only the first ætt hangs loose — {first}. The other ten stand carved and done.',
  openMirror: 'One of the six was struck from the wrong face and reads backwards against the rail. Turn it over.',
  places: ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'],
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
  const PLACE = (Array.isArray(L.places) && L.places.length === N) ? L.places : BOARD_EN.places;
  const nameOf = (ch) => (BY_CH[ch] ? BY_CH[ch].name : ch);

  const cleanup = [];
  const timers = [];
  let motions = [];
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
  const flip = instance.tiles.map((t) => (solved ? !!t.wend : false));
  let held = -1;
  let keysSaid = false;
  let touched = false;                  // the player has taken the chisel
  const gleaming = instance.tiles.map(() => false);
  let nearAt = -1;                      // first faulty place after a wrong setting
  let nearRun = 0;                      // places that stood true in that setting

  const seatedAt = (place) => {
    const t = instance.tiles[row[place]];
    return t.ch === AETT[place] && flip[row[place]] === !!t.wend;
  };
  const tally = () => {
    let n = 0;
    for (let q = 0; q < N; q++) if (seatedAt(q)) n++;
    return n;
  };

  // ---- frame -------------------------------------------------------------
  const wrap = node('div', `display:grid;gap:12px;font-family:${SERIF};color:${p.bone};justify-items:stretch`);

  const style = node('style');
  style.textContent = `
    .ow1-tile{background:none;border:0;padding:0;cursor:grab;touch-action:none;border-radius:5px;
      display:block;line-height:0;outline-offset:3px;position:relative;
      transition:transform .12s ease,filter .12s ease}
    .ow1-tile:focus-visible{outline:2px solid ${p.goldBright}}
    .ow1-tile[data-held="1"]{cursor:grabbing;transform:translateY(-5px)}
    .ow1-tile[data-yearn="1"]{animation:ow1-yearn 2.4s ease-in-out infinite}
    @keyframes ow1-yearn{0%,72%,100%{transform:translateY(0)}80%{transform:translateY(-6px)}88%{transform:translateY(-2px)}}
    .ow1-bed{position:relative;display:grid;justify-items:center}
    .ow1-bedwood{position:absolute;left:50%;transform:translateX(-50%);pointer-events:none;line-height:0}
    .ow1-row{position:relative;display:flex;justify-content:center;align-items:flex-end}
    .ow1-ghost{position:absolute;left:0;top:0;pointer-events:none;z-index:2}
    .ow1-act{font-family:${SERIF};font-size:16px;color:${p.bone};background:${p.oakDeep};
      border:1px solid ${p.gold};border-radius:3px;padding:12px 22px;min-height:44px;cursor:pointer}
    .ow1-act:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    .ow1-act[disabled]{opacity:.5;cursor:default}
    .ow1-skip{font-family:${SERIF};font-size:14px;color:${p.boneDim};background:transparent;
      border:1px solid rgba(90,58,30,.9);border-radius:3px;padding:11px 16px;min-height:44px;cursor:pointer}
    .ow1-skip:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    @media (prefers-reduced-motion: reduce){
      .ow1-tile{transition:none}
      .ow1-tile[data-held="1"]{transform:none}
      .ow1-tile[data-yearn="1"]{animation:none}
    }
  `;
  wrap.append(style);

  const railLabel = node('p', `margin:0;font-size:13px;color:${p.boneDim};letter-spacing:.06em;text-align:center`,
    T('railLaw'));
  const rail = { canvas: null, ctx: null, w: 0, h: 0 };
  const railHost = node('div', 'display:block;line-height:0');

  const bed = node('div');
  bed.className = 'ow1-bed';
  const bedWood = { canvas: null, ctx: null, w: 0, h: 0 };
  const bedHost = node('div');
  bedHost.className = 'ow1-bedwood';
  const rowWrap = node('div');
  rowWrap.className = 'ow1-row';
  rowWrap.setAttribute('role', 'list');
  rowWrap.setAttribute('aria-label', T('ariaRow'));
  bed.append(bedHost, rowWrap);

  const looseLabel = node('p', `margin:0;font-size:13px;color:${p.boneDim};text-align:center`, T('looseLaw'));

  const tallyWrap = node('div', 'display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap');
  const tallyGfx = art.makeCanvas(150, 22);
  tallyGfx.canvas.setAttribute('aria-hidden', 'true');
  const tallyText = node('p', `margin:0;font-size:14px;color:${p.boneDim}`);
  tallyWrap.append(tallyGfx.canvas, tallyText);

  const help = node('p', `margin:0;font-size:13px;color:${p.boneDim};text-align:center;line-height:1.5`, T('help'));

  const status = node('p', `margin:0;min-height:20px;font-size:14px;color:${p.boneDim};text-align:center`);
  status.setAttribute('aria-live', 'polite');

  const actions = node('div', 'display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:center');
  const submitBtn = node('button', null, T('submit'));
  submitBtn.className = 'ow1-act';
  submitBtn.type = 'button';
  const skipBtn = node('button', null, T('skip'));
  skipBtn.className = 'ow1-skip';
  skipBtn.type = 'button';
  skipBtn.style.display = 'none';
  actions.append(submitBtn, skipBtn);

  wrap.append(railLabel, railHost, bed, looseLabel, tallyWrap, help, actions, status);
  ctx.root.append(wrap);

  // ---- layout ------------------------------------------------------------
  // Phone and desk are the same board at two pitches: the rail always carries
  // all sixteen on one line, the six loose staves always clear 44px.
  let tileW = 60;
  let tileH = 82;
  let gap = 8;

  function measure() {
    const avail = Math.max(280, Math.min(760, ctx.root.clientWidth || 360));
    gap = avail < 420 ? 6 : 10;
    tileW = Math.max(46, Math.min(84, Math.floor((avail - gap * (N - 1) - 8) / N)));
    tileH = Math.round(tileW * 1.36);
    return avail;
  }

  function fitCanvas(holder, target, w, h, cls) {
    const fresh = art.makeCanvas(w, h);
    if (cls) fresh.canvas.className = cls;
    if (target.canvas && target.canvas.parentNode === holder) holder.replaceChild(fresh.canvas, target.canvas);
    else holder.append(fresh.canvas);
    target.canvas = fresh.canvas;
    target.ctx = fresh.ctx;
    target.w = fresh.w;
    target.h = fresh.h;
    return target;
  }

  // ---- painting: the rail ------------------------------------------------
  const railRuneAt = (i) => {
    const inset = Math.max(10, rail.w * 0.022);
    const pitch = (rail.w - inset * 2) / ROW;
    return { x: inset + pitch * i, pitch };
  };

  function paintRail() {
    if (!rail.ctx) return;
    const c = rail.ctx;
    const W = rail.w;
    const H = rail.h;
    c.clearRect(0, 0, W, H);
    art.paintPanel(c, 0, 0, W, H, { title: null });
    if (typeof art.chipBorder === 'function' && W > 300) {
      art.chipBorder(c, 9, 7, W - 18, H - 30, { size: Math.max(7, W / 74), alpha: 0.5 });
    }

    const { pitch } = railRuneAt(0);
    const size = Math.min(pitch * 0.82, H * 0.46);
    const runeY = H * 0.24 - size * 0.12;

    // the ten that stand done: cut shallow, receding, and underlined once
    for (let i = N; i < ROW; i++) {
      const { x } = railRuneAt(i);
      c.save();
      c.globalAlpha = 0.62;
      art.drawRune(c, ORDER[i], x + (pitch - size) / 2, runeY, size, { color: p.boneDim });
      c.restore();
    }
    c.save();
    c.strokeStyle = p.oakLight;
    c.globalAlpha = 0.5;
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(railRuneAt(N).x + 2, runeY + size + 5);
    c.lineTo(railRuneAt(ROW).x - 2, runeY + size + 5);
    c.stroke();
    c.restore();

    // the first stretch: deep cut, worn pigment in the groove, hearth on the lip
    for (let i = 0; i < N; i++) {
      const { x } = railRuneAt(i);
      const rx = x + (pitch - size) / 2;
      c.save();
      c.globalAlpha = 0.45;
      art.drawRune(c, ORDER[i], rx - 0.6, runeY + 0.6, size, { color: p.blood, weight: size / 5.6 });
      c.restore();
      art.drawRune(c, ORDER[i], rx, runeY, size, { color: p.bone, weight: size / 6.4 });
    }

    // the span bracket: this stretch, and only this stretch, is the work
    const bx0 = railRuneAt(0).x + 1;
    const bx1 = railRuneAt(N).x - 1;
    const by = runeY + size + 8;
    c.save();
    c.strokeStyle = p.tar;
    c.lineWidth = 3.4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(bx0, by + 7); c.lineTo(bx0, by + 1.6); c.lineTo(bx1, by + 1.6); c.lineTo(bx1, by + 7);
    c.stroke();
    c.strokeStyle = p.gold;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(bx0, by + 6); c.lineTo(bx0, by); c.lineTo(bx1, by); c.lineTo(bx1, by + 6);
    c.stroke();
    c.restore();
    art.ornament(c, 'nailhead', bx0, by + 8.5, 7);
    art.ornament(c, 'nailhead', bx1, by + 8.5, 7);

    // six chisel chevrons, one under each loose stave: this stretch drops below
    const cy = H - 8;
    const cw = Math.max(4.5, Math.min(9, pitch * 0.22));
    for (let i = 0; i < N; i++) {
      const cx = railRuneAt(i).x + pitch / 2;
      c.save();
      c.strokeStyle = p.tar;
      c.lineWidth = cw * 0.44;
      c.lineCap = 'round';
      c.beginPath(); c.moveTo(cx - cw, cy - cw * 0.82); c.lineTo(cx, cy + 0.6); c.lineTo(cx + cw, cy - cw * 0.82); c.stroke();
      c.strokeStyle = p.goldBright;
      c.lineWidth = cw * 0.26;
      c.beginPath(); c.moveTo(cx - cw, cy - cw * 0.94); c.lineTo(cx, cy - 0.5); c.lineTo(cx + cw, cy - cw * 0.94); c.stroke();
      c.restore();
    }

    // after a wrong setting: gold ticks under the stretch that stood true,
    // one ember tick under the first place that did not
    if (nearAt >= 0) {
      for (let i = 0; i < N; i++) {
        if (i > nearAt) break;
        const { x } = railRuneAt(i);
        c.save();
        c.fillStyle = p.tar;
        c.fillRect(x + 2, by + 11, pitch - 4, 4.4);
        c.fillStyle = i < nearRun ? p.gold : p.ember;
        c.fillRect(x + 2.5, by + 11.6, pitch - 5, 2.6);
        c.restore();
      }
    }

    for (const [nx, ny] of [[12, 11], [W - 12, 11]]) art.ornament(c, 'nailhead', nx, ny, 8);
  }

  // ---- painting: the bench the staves rest on ----------------------------
  function paintBed() {
    if (!bedWood.ctx) return;
    const c = bedWood.ctx;
    const W = bedWood.w;
    const H = bedWood.h;
    c.clearRect(0, 0, W, H);

    const top = Math.max(10, H * 0.14);
    // contact shadow: the bench presses onto the boards of the room
    c.save();
    c.fillStyle = `rgba(12,9,6,.5)`;
    c.fillRect(6, H - 7, W - 12, 6);
    c.globalAlpha = 0.5;
    c.fillRect(11, H - 4, W - 22, 4);
    c.restore();

    // the plank
    const g = c.createLinearGradient(0, top, 0, H - 8);
    g.addColorStop(0, mixHex(p.oak, p.oakLight, 0.72));
    g.addColorStop(0.5, mixHex(p.oak, p.oakLight, 0.24));
    g.addColorStop(1, mixHex(p.oak, p.oakDeep, 0.55));
    c.save();
    c.fillStyle = g;
    c.fillRect(4, top, W - 8, H - top - 8);
    // grain running the length of the bench
    c.lineWidth = 1;
    for (let k = 0; k < 16; k++) {
      const gy = top + 4 + h32(k * 31) * (H - top - 16);
      const dark = h32(k * 7 + 3) > 0.35;
      c.strokeStyle = dark ? p.oakDeep : p.oakLight;
      c.globalAlpha = dark ? 0.24 : 0.14;
      c.beginPath();
      c.moveTo(6 + h32(k * 11) * W * 0.2, gy);
      c.lineTo(W * (0.55 + h32(k * 13) * 0.42), gy + (h32(k * 17) - 0.5) * 3);
      c.stroke();
    }
    c.restore();

    // the groove the staves stand in: a long shallow recess with a lit lower lip
    c.save();
    const rg = c.createLinearGradient(0, top, 0, top + 14);
    rg.addColorStop(0, `rgba(12,9,6,.62)`);
    rg.addColorStop(1, `rgba(12,9,6,0)`);
    c.fillStyle = rg;
    c.fillRect(4, top, W - 8, 14);
    c.strokeStyle = `rgba(238,207,109,.22)`;
    c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(8, H - 9.4); c.lineTo(W - 8, H - 9.4); c.stroke();
    c.restore();

    if (typeof art.chipBorder === 'function' && W > 300) {
      art.chipBorder(c, 8, top + 3, W - 16, H - top - 15, { size: Math.max(7, W / 76), alpha: 0.38 });
    }

    art.ornament(c, 'nailhead', 14, H - 14, 7);
    art.ornament(c, 'nailhead', W - 14, H - 14, 7);
  }

  // ---- painting: one loose stave ----------------------------------------
  const tiles = instance.tiles.map((t, id) => {
    const btn = node('button');
    btn.className = 'ow1-tile';
    btn.type = 'button';
    btn.setAttribute('role', 'listitem');
    return { id, btn, gfx: { canvas: null, ctx: null, w: 0, h: 0 }, key: '' };
  });

  function paintTile(tile) {
    if (!tile.gfx.ctx) return;
    const t = instance.tiles[tile.id];
    const place = row.indexOf(tile.id);
    const facing = t.wend !== flip[tile.id];
    const lifted = held === tile.id;
    const seated = seatedAt(place);
    const gleam = gleaming[tile.id];
    const key = `${facing}|${lifted}|${seated}|${gleam}|${tile.gfx.w}`;
    if (tile.key === key) return;                    // repaint only on real change
    tile.key = key;

    const c = tile.gfx.ctx;
    const { w, h } = tile.gfx;
    c.clearRect(0, 0, w, h);

    const pad = 3;
    const bx = pad;
    const by = pad;
    const bw = w - pad * 2;
    const bh = h - pad * 2 - 5;

    // the stave's own shadow on the bench — this is a thing that sits
    c.save();
    c.fillStyle = `rgba(12,9,6,${lifted ? 0.5 : 0.62})`;
    c.beginPath();
    if (typeof c.ellipse === 'function') c.ellipse(w / 2, h - (lifted ? 1.5 : 3.5), bw * 0.44, 3.4, 0, 0, Math.PI * 2);
    else c.arc(w / 2, h - 3.5, bw * 0.4, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // bone tablet: sea-worn walrus ivory, warm where the hearth reaches it
    c.save();
    const bg = c.createLinearGradient(bx, by, bx + bw * 0.4, by + bh);
    bg.addColorStop(0, mixHex(p.bone, '#ffffff', 0.18));
    bg.addColorStop(0.5, p.bone);
    bg.addColorStop(1, mixHex(p.boneDim, p.oakLight, 0.34));
    c.fillStyle = bg;
    c.beginPath();
    const r = 4;
    c.moveTo(bx + r, by);
    c.arcTo(bx + bw, by, bx + bw, by + bh, r);
    c.arcTo(bx + bw, by + bh, bx, by + bh, r);
    c.arcTo(bx, by + bh, bx, by, r);
    c.arcTo(bx, by, bx + bw, by, r);
    c.closePath();
    c.fill();
    c.save();
    c.clip();
    // bone pores and hairline cracks, mirrored when the stave is turned
    for (let k = 0; k < 9; k++) {
      const px = bx + h32(tile.id * 17 + k) * bw;
      const py = by + h32(tile.id * 23 + k) * bh;
      c.fillStyle = mixHex(p.boneDim, p.oakLight, 0.5);
      c.globalAlpha = 0.14 + h32(tile.id * 5 + k) * 0.16;
      c.beginPath();
      c.arc(facing ? bx + bw - (px - bx) : px, py, 0.6 + h32(k * 3 + tile.id) * 1.1, 0, Math.PI * 2);
      c.fill();
    }
    for (let k = 0; k < 3; k++) {
      const gx = bx + 4 + h32(tile.id * 29 + k) * (bw - 8);
      c.strokeStyle = mixHex(p.boneDim, p.tar, 0.25);
      c.globalAlpha = 0.13 + h32(tile.id * 3 + k) * 0.08;
      c.lineWidth = 0.9;
      c.beginPath();
      const sx = facing ? bx + bw - (gx - bx) : gx;
      c.moveTo(sx, by + 5);
      c.quadraticCurveTo(sx + (h32(k + tile.id) - 0.5) * 6, by + bh / 2, sx, by + bh - 5);
      c.stroke();
    }
    c.restore();
    // chip-carved bevel: lit on the hearth side, shaded away from it
    c.globalAlpha = 1;
    c.strokeStyle = `rgba(255,255,255,.4)`;
    c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(bx + 1.4, by + bh - 2); c.lineTo(bx + 1.4, by + 1.4); c.lineTo(bx + bw - 2, by + 1.4); c.stroke();
    c.strokeStyle = `rgba(12,9,6,.42)`;
    c.beginPath(); c.moveTo(bx + bw - 1.4, by + 2); c.lineTo(bx + bw - 1.4, by + bh - 1.4); c.lineTo(bx + 2, by + bh - 1.4); c.stroke();
    c.strokeStyle = `rgba(12,9,6,.55)`;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(bx + r, by);
    c.arcTo(bx + bw, by, bx + bw, by + bh, r);
    c.arcTo(bx + bw, by + bh, bx, by + bh, r);
    c.arcTo(bx, by + bh, bx, by, r);
    c.arcTo(bx, by, bx + bw, by, r);
    c.closePath();
    c.stroke();
    c.restore();

    // the cut itself: worn red pigment in the groove, chisel-dark over it
    const size = Math.min(bw - 12, bh - 16);
    const rx = bx + (bw - size) / 2;
    const ry = by + (bh - size) / 2;
    c.save();
    c.globalAlpha = 0.5;
    art.drawRune(c, t.ch, rx - 0.7, ry + 0.7, size, { color: p.blood, mirror: facing, weight: size / 5.2 });
    c.restore();
    art.drawRune(c, t.ch, rx, ry, size, {
      color: lifted ? mixHex(p.tar, p.gold, 0.45) : mixHex(p.tar, p.oakDeep, 0.35),
      mirror: facing,
      weight: size / 6,
    });

    // a struck notch on the foot, on the side the stave faces — the physical tell
    c.save();
    c.fillStyle = `rgba(12,9,6,.5)`;
    const nx = facing ? bx + bw - 11 : bx + 7;
    c.beginPath();
    c.moveTo(nx, by + bh - 4.5); c.lineTo(nx + 4, by + bh - 4.5); c.lineTo(nx + 2, by + bh - 1); c.closePath();
    c.fill();
    c.restore();

    // seated: a gold seam along the foot, the stave has found its slot
    if (seated) {
      c.save();
      c.strokeStyle = p.gold;
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(bx + 3, by + bh + 1.6); c.lineTo(bx + bw - 3, by + bh + 1.6); c.stroke();
      c.restore();
    }
    if (gleam) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      art.glow(c, w / 2, by + bh / 2, bw * 0.85, p.goldBright, 0.5);
      c.restore();
    }
  }

  // ---- painting: the tally ----------------------------------------------
  function paintTally() {
    const c = tallyGfx.ctx;
    const { w, h } = tallyGfx;
    const n = tally();
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < N; i++) {
      const x = 11 + i * 25.6;
      const y = h / 2;
      c.save();
      c.fillStyle = `rgba(12,9,6,.62)`;
      c.beginPath(); c.arc(x + 0.8, y + 1, 7.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = i < n ? p.gold : mixHex(p.oakDeep, p.oak, 0.5);
      c.beginPath(); c.arc(x, y, 6.6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = i < n ? p.goldBright : `rgba(90,58,30,.9)`;
      c.lineWidth = 1.2;
      c.stroke();
      if (i < n) {
        c.fillStyle = `rgba(238,207,109,.85)`;
        c.beginPath(); c.arc(x - 1.8, y - 2.2, 2.1, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
    tallyText.textContent = n === N ? T('tallyAll') : T('tally', { n });
  }

  // ---- DOM order ---------------------------------------------------------
  // Reordering must never cost the player their grip (CONTRACT §8): leave the
  // DOM alone when the order already stands; when it must move, re-appending
  // drops focus and pointer capture in a real browser, so restore both.
  function syncRow() {
    const want = row.map((id) => tiles[id].btn);
    const have = Array.from(rowWrap.children || []);
    if (have.length === want.length && want.every((b, i) => have[i] === b)) return;
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    for (const b of want) rowWrap.append(b);
    if (active && want.indexOf(active) >= 0) {
      try { active.focus({ preventScroll: true }); } catch (e) { try { active.focus(); } catch (e2) { /* headless */ } }
    }
    if (drag && drag.pointerId != null) {
      try { tiles[drag.id].btn.setPointerCapture(drag.pointerId); } catch (e) { /* pointer gone */ }
    }
  }

  function render() {
    syncRow();
    row.forEach((id, place) => {
      const tile = tiles[id];
      const t = instance.tiles[id];
      const facing = t.wend !== flip[id] ? T('facingBack') : T('facingTrue');
      tile.btn.dataset.held = held === id ? '1' : '0';
      tile.btn.setAttribute('aria-label',
        T('ariaTile', { place: PLACE[place], name: nameOf(t.ch), facing })
        + (seatedAt(place) ? T('ariaSeated') : '')
        + (held === id ? T('ariaLifted') : ''));
      paintTile(tile);
    });
    paintTally();
    submitBtn.disabled = !!ctx.solved;
  }

  // The set of staves standing true right now — taken before a move so the one
  // that just clicked home can be named.
  const seatedIds = () => {
    const s = new Set();
    for (let q = 0; q < N; q++) if (seatedAt(q)) s.add(row[q]);
    return s;
  };

  // A stave that lands true clicks home: sound, a gold seam, and a brief gleam.
  function settleReport(before) {
    const now = seatedIds();
    if (now.size <= before.size) return -1;
    let landed = -1;
    for (const id of now) if (!before.has(id)) { landed = id; break; }
    if (landed >= 0) {
      gleaming[landed] = true;
      tiles[landed].key = '';
      later(() => { gleaming[landed] = false; tiles[landed].key = ''; paintTile(tiles[landed]); }, 200);
    }
    sfx(now.size === N ? 'confirm' : 'knock');
    return landed;
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

  function clearMarks() {
    if (nearAt < 0) return;
    nearAt = -1;
    nearRun = 0;
    paintRail();
  }

  function reportMove(id, from, before) {
    const to = row.indexOf(id);
    const t = instance.tiles[id];
    const landed = settleReport(before);
    render();
    const line = landed >= 0
      ? T('landed', { name: nameOf(instance.tiles[landed].ch) })
      : T('slid', { name: nameOf(t.ch), from: PLACE[from], to: PLACE[to] });
    status.textContent = `${line} ${tallyText.textContent}`;
    say(line);
  }

  function doFlip(id) {
    const before = seatedIds();
    flip[id] = !flip[id];
    clearMarks();
    const t = instance.tiles[id];
    const facing = t.wend !== flip[id] ? T('facingBack') : T('facingTrue');
    sfx('flip');
    const landed = settleReport(before);
    render();
    const line = landed >= 0
      ? T('landed', { name: nameOf(instance.tiles[landed].ch) })
      : T('turned', { place: PLACE[row.indexOf(id)], name: nameOf(t.ch), facing });
    status.textContent = `${line} ${tallyText.textContent}`;
    say(line);
  }

  // ---- pointer: drag to reorder, tap to turn ------------------------------
  let drag = null;

  function nearestPlace(x, y) {
    let best = 0;
    let bestD = Infinity;
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
      takeTheChisel();
      if (ctx.solved) return;
      drag = { id: tile.id, x: ev.clientX, y: ev.clientY, moved: false, from: row.indexOf(tile.id), before: seatedIds(), pointerId: ev.pointerId };
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
      const before = drag.before;
      drag = null;
      held = -1;
      try { tile.btn.releasePointerCapture(ev.pointerId); } catch (e) { /* already gone */ }
      if (wasMoved) reportMove(tile.id, from, before);
      else doFlip(tile.id);
    };
    on(tile.btn, 'pointerup', finish);
    on(tile.btn, 'pointercancel', () => { drag = null; held = -1; render(); });

    on(tile.btn, 'keydown', (ev) => {
      takeTheChisel();
      if (ctx.solved) return;
      const place = row.indexOf(tile.id);
      const step = (d) => {
        if (held === tile.id) {
          const before = seatedIds();
          if (moveTo(tile.id, place + d)) { clearMarks(); sfx('slide'); reportMove(tile.id, place, before); }
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
      else if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown' || ev.key === 'f' || ev.key === 'F' || ev.key === 'Enter') {
        ev.preventDefault(); doFlip(tile.id);
      } else if (ev.key === ' ' || ev.key === 'Spacebar') {
        ev.preventDefault();
        held = held === tile.id ? -1 : tile.id;
        sfx(held === tile.id ? 'slide' : 'knock');
        render();
        status.textContent = held === tile.id
          ? T('lifted', { name: nameOf(instance.tiles[tile.id].ch) })
          : T('setDown', { name: nameOf(instance.tiles[tile.id].ch), place: PLACE[place] });
      }
    });

    on(tile.btn, 'focus', () => {
      if (keysSaid) return;
      keysSaid = true;
      say(T('keysNote'));
    });
  });

  // ---- the showing: three seconds of a ghost hand, then the chisel is yours
  const ghost = { canvas: null, ctx: null, w: 0, h: 0 };
  const ghostHost = node('div');
  ghostHost.className = 'ow1-ghost';
  ghostHost.setAttribute('aria-hidden', 'true');
  ghostHost.style.display = 'none';
  rowWrap.append(ghostHost);

  const firstStray = () => {
    for (let q = 0; q < N; q++) if (instance.tiles[row[q]].ch !== AETT[q]) return q;
    return -1;
  };
  const homeOf = (place) => AETT.indexOf(instance.tiles[row[place]].ch);

  function paintGhost() {
    if (!ghost.ctx) return;
    const c = ghost.ctx;
    const { w, h } = ghost;
    c.clearRect(0, 0, w, h);
    c.save();
    c.globalAlpha = 0.85;
    c.strokeStyle = p.goldBright;
    c.lineWidth = 2;
    if (typeof c.setLineDash === 'function') c.setLineDash([5, 4]);
    c.strokeRect(3, 3, w - 6, h - 11);
    if (typeof c.setLineDash === 'function') c.setLineDash([]);
    // a hand's worth of gold: the grip mark and two knuckle cuts
    c.fillStyle = `rgba(238,207,109,.28)`;
    c.fillRect(3, 3, w - 6, h - 11);
    art.glow(c, w / 2, h / 2, w * 0.6, p.goldBright, 0.35);
    c.restore();
  }

  function endShowing(quiet) {
    if (ghostHost.style.display === 'none') return;
    for (const m of motions) { try { m.cancel(); } catch (e) { /* already gone */ } }
    motions = [];
    ghostHost.style.display = 'none';
    skipBtn.style.display = 'none';
    if (!quiet) status.textContent = '';
  }

  function takeTheChisel() {
    if (touched) return;
    touched = true;
    endShowing(true);
    for (const tile of tiles) tile.btn.dataset.yearn = '0';
  }

  function showTheWay() {
    if (ctx.solved || touched) return;
    const from = firstStray();
    if (from < 0) return;
    const to = homeOf(from);
    if (to < 0 || to === from) return;
    const srcBtn = tiles[row[from]].btn;
    const dstBtn = tiles[row[to]].btn;
    const bedRect = rowWrap.getBoundingClientRect();
    const a = srcBtn.getBoundingClientRect();
    const b = dstBtn.getBoundingClientRect();
    if (!a.width || !bedRect.width) return;

    fitCanvas(ghostHost, ghost, Math.round(a.width), Math.round(a.height), null);
    paintGhost();
    ghostHost.style.display = 'block';
    ghostHost.style.transform = `translate(${Math.round(a.left - bedRect.left)}px,${Math.round(a.top - bedRect.top)}px)`;
    skipBtn.style.display = '';
    status.textContent = T('demoSay');

    if (!calm && typeof ghostHost.animate === 'function') {
      const x0 = a.left - bedRect.left;
      const x1 = b.left - bedRect.left;
      const y = a.top - bedRect.top;
      const m = ghostHost.animate([
        { transform: `translate(${x0}px,${y}px)`, opacity: 0 },
        { transform: `translate(${x0}px,${y - 8}px)`, opacity: 1, offset: 0.18 },
        { transform: `translate(${x1}px,${y - 8}px)`, opacity: 1, offset: 0.72 },
        { transform: `translate(${x1}px,${y}px)`, opacity: 0.9, offset: 0.86 },
        { transform: `translate(${x1}px,${y}px)`, opacity: 0 },
      ], { duration: 2600, easing: 'ease-in-out' });
      motions.push(m);
    } else {
      // reduced motion: the same lesson held still — a ghost over the gap
      ghostHost.style.transform = `translate(${Math.round(b.left - bedRect.left)}px,${Math.round(b.top - bedRect.top)}px)`;
    }
    later(() => { endShowing(false); armYearn(); }, 3000);
  }

  function armYearn() {
    if (touched || calm || ctx.solved) return;
    const from = firstStray();
    if (from < 0) return;
    tiles[row[from]].btn.dataset.yearn = '1';
  }

  // ---- submit ------------------------------------------------------------
  function answer() {
    return { flips: row.map((id) => !!flip[id]), order: row.slice() };
  }

  // The shell owns the shudder and the deny voice. The board's part is to show
  // WHERE the row disagrees — at the near-line's own grain, the place.
  function handle(res, sent) {
    if (!res || res.ok) return;
    if (res.near) { status.textContent = res.near; say(res.near); }
    if (sent) {
      let run = 0;
      while (run < N && standsTrue(instance.tiles, sent.order, sent.flips, run)) run++;
      nearRun = run;
      nearAt = Math.min(run, N - 1);
      paintRail();
    }
  }

  on(submitBtn, 'click', () => {
    takeTheChisel();
    if (ctx.solved) return;
    sfx('confirm');
    const sent = answer();
    let res;
    try { res = ctx.submit(sent); } catch (e) { return; }
    if (res && typeof res.then === 'function') res.then((r) => handle(r, sent), () => {});
    else handle(res, sent);
  });

  on(skipBtn, 'click', () => { takeTheChisel(); submitBtn.focus(); });

  // ---- layout, resize ----------------------------------------------------
  function relayout() {
    const avail = measure();
    fitCanvas(railHost, rail, avail, Math.max(84, Math.round(avail * 0.17)), null);
    rail.canvas.style.width = '100%';
    rail.canvas.style.height = 'auto';
    rail.canvas.setAttribute('role', 'img');
    rail.canvas.setAttribute('aria-label', T('ariaRail', {
      names: ORDER.map(nameOf).join(', '),
      first: AETT.map(nameOf).join(', '),
    }));

    rowWrap.style.gap = `${gap}px`;
    // the bench canvas is out of flow; the row's own bottom padding is what
    // reserves its apron, so nothing below the board is ever overlapped
    rowWrap.style.padding = `${Math.round(tileH * 0.16)}px 6px 48px`;
    for (const tile of tiles) {
      fitCanvas(tile.btn, tile.gfx, tileW, tileH, null);
      tile.key = '';
    }
    const bedW = Math.min(avail, Math.round(tileW * N + gap * (N - 1) + 40));
    fitCanvas(bedHost, bedWood, bedW, Math.round(tileH * 0.42) + 42, null);
    bedHost.style.top = `${Math.round(tileH * 0.74)}px`;
    paintRail();
    paintBed();
    render();
  }

  let resizeRaf = 0;
  const onResize = () => {
    if (resizeRaf) return;
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 32);
    resizeRaf = raf(() => { resizeRaf = 0; relayout(); });
  };
  on(window, 'resize', onResize);

  // ---- open the lock -----------------------------------------------------
  relayout();
  say(T('openLaw', { names: ORDER.map(nameOf).join(', ') }));
  say(T('openLoose', { first: AETT.map(nameOf).join(', ') }));
  say(T('openMirror'));
  if (ctx.solved) {
    submitBtn.disabled = true;
    submitBtn.textContent = T('submitDone');
    status.textContent = T('solvedLine');
    touched = true;
  } else {
    later(() => {
      const first = tiles[row[0]];
      if (first) first.btn.setAttribute('tabindex', '0');
      showTheWay();
    }, 0);
  }

  return {
    unmount() {
      for (const off of cleanup) off();
      cleanup.length = 0;
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
      for (const m of motions) { try { m.cancel(); } catch (e) { /* already gone */ } }
      motions = [];
      if (resizeRaf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(resizeRaf);
      resizeRaf = 0;
      drag = null;
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    },
  };
}

// ---------------------------------------------------------------------- i18n
// Additive per-lock block (docs/CONTRACT.md §4.1 amendment). English lives in
// the frozen fields above; `nearMap` keys are the canonical English near-lines.
const I18N = {
  es: {
    title: 'La Primera Ætt',
    epigraph: 'La hilera entera ya está tallada arriba. Solo sus seis primeras penden sueltas, y una fue cortada por la cara equivocada.',
    hints: [
      'Nada se te oculta. El listón de arriba ya lleva el orden verdadero; las seis de abajo solo han de tenderse bajo su primer tramo.',
      'Una de ellas no casará con el listón la pongas donde la pongas: fue golpeada por la cara equivocada y se lee al revés. Tócala para volverla.',
      'Lee cada asta contra el listón antes de moverla. Cinco casan tal como están; la sexta es el espejo de su asta — vuélvela, y luego tiende las seis en el orden del listón.',
    ],
    nearMap: {
      [NEAR.faceOne]: 'La hilera guarda el orden — pero un asta sigue vuelta contra el listón.',
      [NEAR.faceMany]: 'La hilera guarda el orden, pero más de un asta está vuelta contra el listón.',
      [NEAR.none]: 'Ni siquiera la primera asta se sostiene.',
      [NEAR.run[0]]: 'La primera asta se sostiene; su vecina no.',
      [NEAR.run[1]]: 'Las dos primeras astas se sostienen; la tercera no.',
      [NEAR.run[2]]: 'Las tres primeras astas se sostienen; la cuarta no.',
      [NEAR.run[3]]: 'Las cuatro primeras astas se sostienen; la quinta no.',
    },
    board: {
      railLaw: 'El listón es la ley',
      looseLaw: 'Estas seis penden sueltas. Tiéndelas bajo las seis primeras del listón.',
      help: 'Arrastra un asta a su sitio. Tócala para volverla. Con el teclado: flechas para recorrer las seis, espacio para alzarla y posarla, F para volverla.',
      submit: 'Asentar la ætt',
      submitDone: 'La ætt se sostiene',
      solvedLine: 'La primera ætt se sostiene tal como fue tallada.',
      tally: '{n} de seis astas se sostienen',
      tallyAll: 'Las seis astas se sostienen. Asienta la ætt.',
      skip: 'Saltar la muestra',
      demoSay: 'Mira una vez: un asta suelta va a su hueco bajo el listón.',
      lifted: '{name} queda alzada. Las flechas la mueven; el espacio la posa.',
      setDown: '{name} queda posada en el {place} lugar.',
      slid: '{name} se desliza del {from} lugar al {to}.',
      turned: 'El {place} asta se vuelve: {name} {facing}.',
      landed: '{name} se asienta en su sitio bajo el listón.',
      facingTrue: 'queda derecha',
      facingBack: 'mira al revés',
      ariaTile: '{place} lugar: {name}, {facing}',
      ariaLifted: ', alzada',
      ariaSeated: ', asentada bajo el listón',
      ariaRail: 'El listón tallado, dieciséis astas: {names}. Sus seis primeras — {first} — son el tramo que pende suelto abajo.',
      ariaRow: 'Las seis astas sueltas, de izquierda a derecha',
      keysNote: 'Con el teclado: las flechas recorren las seis; el espacio alza un asta y la posa; F o Intro la vuelve; Inicio y Fin corren a los extremos.',
      openLaw: 'El listón lleva la hilera entera: {names}.',
      openLoose: 'Solo la primera ætt pende suelta — {first}. Las otras diez quedan talladas y hechas.',
      openMirror: 'Una de las seis fue golpeada por la cara equivocada y se lee al revés contra el listón. Vuélvela.',
      places: ['primer', 'segundo', 'tercer', 'cuarto', 'quinto', 'sexto'],
    },
  },
  ca: {
    title: 'La Primera Ætt',
    epigraph: 'La filera sencera ja està tallada a dalt. Només les sis primeres pengen soltes, i una va ser tallada per la cara equivocada.',
    hints: [
      'No se t’amaga res. El llistó de dalt ja duu l’ordre veritable; les sis de sota només s’han d’estendre sota el seu primer tram.',
      'Una d’elles no lligarà amb el llistó la posis on la posis: va ser colpida per la cara equivocada i es llegeix a l’inrevés. Toca-la per girar-la.',
      'Llegeix cada asta contra el llistó abans de moure-la. Cinc lliguen tal com són; la sisena és el mirall de la seva asta — gira-la, i després estén les sis en l’ordre del llistó.',
    ],
    nearMap: {
      [NEAR.faceOne]: 'La filera guarda l’ordre — però una asta encara és girada contra el llistó.',
      [NEAR.faceMany]: 'La filera guarda l’ordre, però més d’una asta és girada contra el llistó.',
      [NEAR.none]: 'Ni tan sols la primera asta s’aguanta.',
      [NEAR.run[0]]: 'La primera asta s’aguanta; la seva veïna no.',
      [NEAR.run[1]]: 'Les dues primeres astes s’aguanten; la tercera no.',
      [NEAR.run[2]]: 'Les tres primeres astes s’aguanten; la quarta no.',
      [NEAR.run[3]]: 'Les quatre primeres astes s’aguanten; la cinquena no.',
    },
    board: {
      railLaw: 'El llistó és la llei',
      looseLaw: 'Aquestes sis pengen soltes. Estén-les sota les sis primeres del llistó.',
      help: 'Arrossega una asta al seu lloc. Toca-la per girar-la. Amb el teclat: fletxes per recórrer les sis, espai per alçar-la i posar-la, F per girar-la.',
      submit: 'Assentar l’ætt',
      submitDone: 'L’ætt s’aguanta',
      solvedLine: 'La primera ætt s’aguanta tal com va ser tallada.',
      tally: '{n} de sis astes s’aguanten',
      tallyAll: 'Les sis astes s’aguanten. Assenta l’ætt.',
      skip: 'Saltar la mostra',
      demoSay: 'Mira-ho un cop: una asta solta va al seu buit sota el llistó.',
      lifted: '{name} queda alçada. Les fletxes la mouen; l’espai la posa.',
      setDown: '{name} queda posada al {place} lloc.',
      slid: '{name} llisca del {from} lloc al {to}.',
      turned: 'La {place} asta es gira: {name} {facing}.',
      landed: '{name} s’assenta al seu lloc sota el llistó.',
      facingTrue: 'queda dreta',
      facingBack: 'mira a l’inrevés',
      ariaTile: '{place} lloc: {name}, {facing}',
      ariaLifted: ', alçada',
      ariaSeated: ', assentada sota el llistó',
      ariaRail: 'El llistó tallat, setze astes: {names}. Les sis primeres — {first} — són el tram que penja solt a sota.',
      ariaRow: 'Les sis astes soltes, d’esquerra a dreta',
      keysNote: 'Amb el teclat: les fletxes recorren les sis; l’espai alça una asta i la posa; F o Retorn la gira; Inici i Fi corren als extrems.',
      openLaw: 'El llistó duu la filera sencera: {names}.',
      openLoose: 'Només la primera ætt penja solta — {first}. Les altres deu queden tallades i fetes.',
      openMirror: 'Una de les sis va ser colpida per la cara equivocada i es llegeix a l’inrevés contra el llistó. Gira-la.',
      places: ['primer', 'segon', 'tercer', 'quart', 'cinquè', 'sisè'],
    },
  },
};

export default {
  id: '01-runerow',
  ordinal: 1,
  tier: 1,
  title: 'The First Ætt',
  epigraph: 'The whole row stands carved above. Only its first six hang loose, and one was cut from the wrong face.',

  makePuzzle,
  solve,
  verify,
  wrongAnswers,
  shard: () => ({ ...SHARDS['01-runerow'] }),

  difficulty: {
    searchSpace: 46080, // 6! orders x 2^6 faces
    minSteps: 6,
    estMinutes: 2,
  },

  hints: [
    'Nothing here is hidden. The rail above already carries the true order; the six below need only be laid under its first stretch.',
    'One of the six will match no stave on the rail however you place it: it was struck from the wrong face and reads backwards. Tap it to turn it over.',
    'Read each stave against the rail before you move it. Five match as they stand; the sixth is its stave’s mirror — turn it, then lay the six in the rail’s order.',
  ],

  i18n: I18N,

  mount,
};
