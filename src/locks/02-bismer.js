// 02 — THE BISMER SCALES (tier 1, teaching)
//
// Six sealed pouches of hacksilver, sworn to one weight. One was clipped and
// runs light. Two weighings are already carved into the ledger; name the pouch.
//
// ENTRY-CURVE AMENDMENT (docs/LOCKS.md): six pouches, not nine, and the sworn
// weights are small enough to reckon in the head. The mechanic, the answer
// shape and the uniqueness guarantee are untouched — only the instance is
// gentler, so a first-timer reads two tilts and names the pouch in about a
// minute and a half.
//
// Pure half: no DOM, no globals, no Math.random, no Date. Only the seeded rng.
//
// Uniqueness: each pouch is given a DISTINCT role pair from {left, aside,
// right} x {left, aside, right} across the two weighings, so the two recorded
// tilts separate every hypothesis. The six pairs are the nine-square grid minus
// one permutation's worth of cells, which leaves exactly two pouches in each
// pan and two set aside in each weighing — even pans, as a balance demands.
// makePuzzle still sweeps the candidates and requires exactly one to reproduce
// the ledger.
//
// Difficulty accounting: six sworn labels must be converted to ertog and two
// weighings read against them before the single naming — eight comparisons at
// the very least.

import { BY_CH, ORDER } from '../kernel/futhark.js';
import { SHARDS } from '../kernel/shards.js';

const COUNT = 6;
const ERTOG_PER_ORE = 3;
const ORE_PER_MARK = 8;
const ERTOG_PER_MARK = ERTOG_PER_ORE * ORE_PER_MARK; // 24
const SEALS = ORDER.slice(0, COUNT);
// Small sworn weights: at most one mark, so every label is a one-step reckoning.
const SWORN = [27, 30, 33];
const ORD_WORD = ['first', 'second'];

// left = -1, aside = 0, right = +1
function tiltUnder(weighing, light) {
  if (weighing.left.indexOf(light) >= 0) return 'right'; // the light pan rises
  if (weighing.right.indexOf(light) >= 0) return 'left';
  return 'level';
}

function consistent(instance, pouch) {
  return instance.weighings.every((w) => tiltUnder(w, pouch) === w.tilt);
}

function makePuzzle(rng) {
  const swornErtog = rng.pick(SWORN);

  const pouches = SEALS.map((seal) => {
    const mark = rng.range(0, Math.floor(swornErtog / ERTOG_PER_MARK));
    const rest = swornErtog - mark * ERTOG_PER_MARK;
    const ore = rng.range(0, Math.floor(rest / ERTOG_PER_ORE));
    const ertog = rest - ore * ERTOG_PER_ORE;
    return { seal, mark, ore, ertog };
  });

  // The labels must not all be written the same way — the mixed forms are the
  // reckoning this lock teaches.
  const forms = new Set(pouches.map((p) => `${p.mark}/${p.ore}/${p.ertog}`));
  if (forms.size < 2) return makePuzzle(rng);

  // Six distinct role pairs: the full 3x3 grid less one permutation's cells.
  // Row sums and column sums are then 2 apiece, so each weighing puts two
  // pouches in each pan and sets two aside.
  const sides = [-1, 0, 1];
  const dropped = rng.shuffle(sides);
  const pairs = [];
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) {
      if (dropped[a] === sides[b]) continue;
      pairs.push([sides[a], sides[b]]);
    }
  }
  const roles = rng.shuffle(pairs);
  const light = rng.int(COUNT);

  const weighings = [0, 1].map((w) => {
    const left = [], right = [], aside = [];
    for (let i = 0; i < COUNT; i++) {
      const r = roles[i][w];
      (r === -1 ? left : r === 1 ? right : aside).push(i);
    }
    const inst = { left, right, aside };
    return { ...inst, tilt: tiltUnder(inst, light) };
  });

  const instance = { swornErtog, pouches, weighings };

  // Exhaustive uniqueness over the six hypotheses.
  let hits = 0;
  for (let i = 0; i < COUNT; i++) if (consistent(instance, i)) hits++;
  if (hits !== 1) return makePuzzle(rng);

  return instance;
}

function solve(instance) {
  for (let i = 0; i < COUNT; i++) if (consistent(instance, i)) return { pouch: i };
  return { pouch: -1 };
}

function verify(instance, answer) {
  try {
    if (!instance || !Array.isArray(instance.pouches) || !Array.isArray(instance.weighings)) return { ok: false };
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
    const p = answer.pouch;
    if (!Number.isInteger(p) || p < 0 || p >= instance.pouches.length) return { ok: false };

    const bad = instance.weighings.findIndex((w) => tiltUnder(w, p) !== w.tilt);
    if (bad < 0) return { ok: true };
    return { ok: false, near: `The ${ORD_WORD[bad] || 'later'} weighing already clears that pouch.` };
  } catch (e) {
    return { ok: false };
  }
}

function wrongAnswers(instance) {
  const right = solve(instance).pouch;
  const out = [];
  for (let i = 0; i < COUNT; i++) if (i !== right) out.push({ pouch: i });
  // Six pouches leave only five namings that are wrong by deduction. The other
  // two ways a naming can miss are off the rack altogether — before the first
  // seal and past the last — and verify must refuse those just as flatly.
  out.push({ pouch: -1 }, { pouch: COUNT });
  return out;
}

// ------------------------------------------------------------------ the view
//
// The board is a merchant's weighing corner, not a diagram: two carved beams
// pivoting on turned posts over a counter, verdigris chains, hammered bronze
// pans holding sealed pouches, and the six pouches themselves hanging in a
// carved rack. Everything static is baked once per layout and blitted; only
// pans, pouches and marks repaint per interaction (docs/QUALITY.md latency).

const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";
const MONO = "ui-monospace,'SF Mono',Menlo,monospace";

// Board copy. English is the source; es/ca live in the additive i18n block
// (docs/CONTRACT.md §4.1 amendment) and are resolved through it at mount.
const BOARD_EN = {
  ask: 'Two weighings are sworn. Name the light pouch.',
  law: 'Every pouch is sworn to the same weight: {n} ertog — one mark is eight øre, one øre three ertog. One pouch was clipped, and runs light. The pan that sinks holds the heavier silver.',
  reckon: 'Reckon the labels in ertog',
  reckonBack: 'Read the labels as carved',
  help: 'Lift a pouch from the rack to name it. By key: arrows walk the rack, space names one, X strikes one out.',
  submit: 'Name the pouch',
  submitDone: 'The pouch is named',
  skip: 'Skip the showing',
  demoSay: 'Watch once: a pouch is lifted from the rack, and set back.',
  setAside: 'set aside',
  first: 'First',
  second: 'Second',
  cap: '{ord} weighing — {sink}',
  sinkLeft: 'the left pan sinks',
  sinkRight: 'the right pan sinks',
  sinkLevel: 'the beam hangs level',
  sankLeft: 'the left pan sank',
  sankRight: 'the right pan sank',
  sankLevel: 'the beam hung level',
  ariaWeighing: 'The {ord} weighing: left pan {left}; right pan {right}; set aside {aside}; {sink}.',
  ariaRule: 'The carved reckoning rule: one mark is eight øre, one øre three ertog, so one mark is twenty-four ertog.',
  ariaGroup: 'The six pouches on the merchant’s rack',
  ariaPouch: 'Pouch under the {name} seal, sworn {label}',
  ariaStruck: ', struck out',
  ariaNamed: ', named',
  namedLine: 'The pouch under the {name} seal is named.',
  struckLine: 'The {name} pouch is struck from the reckoning.',
  backLine: 'The {name} pouch is set back among the six.',
  reckonedLine: 'Reckoned in ertog, every pouch is sworn at {n}.',
  carvedLine: 'The labels stand as they were carved.',
  keysNote: 'By key: arrows walk the pouches; space or Enter names one; X strikes one from the reckoning.',
  openNine: 'Six pouches, each sworn at {n} ertog — one mark is eight øre, one øre three ertog.',
  openClip: 'One pouch was clipped and runs light. The pan that sinks holds the heavier silver.',
  openWeigh: '{ord} weighing — left: {left}; right: {right}; aside: {aside}. And {sank}.',
  solvedLine: 'The clipped silver lay under the {name} seal.',
  unitMark: 'mark',
  unitOre: 'øre',
  unitErtog: 'ertog',
};

// View-side colour math (the frozen art API exposes palette tokens, not maths).
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sa, sb) => Math.round(sa + (sb - sa) * t);
  const r = ch(pa >> 16, pb >> 16);
  const g = ch((pa >> 8) & 255, (pb >> 8) & 255);
  const bl = ch(pa & 255, pb & 255);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

function rgbaHex(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Deterministic per-index micro-noise (view-only; never touches the logic and
// never correlates with the answer — it is keyed on the rack position alone).
function noise(n) {
  let x = (n | 0) + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}

function labelOf(pouch) {
  const parts = [];
  if (pouch.mark) parts.push(`${pouch.mark} mark`);
  if (pouch.ore) parts.push(`${pouch.ore} øre`);
  if (pouch.ertog) parts.push(`${pouch.ertog} ertog`);
  return parts.length ? parts.join(' ') : '0 ertog';
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
  const nameOf = (ch) => (BY_CH[ch] ? BY_CH[ch].name : ch);
  const sealName = (i) => nameOf(instance.pouches[i].seal);
  const ordWord = (k) => (k === 0 ? T('first') : T('second'));
  const sinkWord = (t) => T(t === 'level' ? 'sinkLevel' : t === 'left' ? 'sinkLeft' : 'sinkRight');
  const sankWord = (t) => T(t === 'level' ? 'sankLevel' : t === 'left' ? 'sankLeft' : 'sankRight');

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

  // ---- state -------------------------------------------------------------
  let accused = ctx.solved ? solve(instance).pouch : -1;
  let inErtog = false;
  let keysSaid = false;
  let touched = false;                   // the player has taken a pouch in hand
  let nearWeighing = -1;                 // the weighing that already clears a named pouch
  const struck = instance.pouches.map(() => false);

  // ---- frame -------------------------------------------------------------
  const wrap = node('div', `display:grid;gap:9px;font-family:${SERIF};color:${p.bone};justify-items:stretch`);
  const style = node('style');
  style.textContent = `
    .ow2-plate{position:relative;display:grid;justify-items:center}
    .ow2-platewood{position:absolute;left:50%;top:0;transform:translateX(-50%);
      pointer-events:none;line-height:0}
    .ow2-ask{position:relative;margin:0;padding:11px 20px;text-align:center;font-size:16px;
      letter-spacing:.03em;color:${p.bone};line-height:1.35;
      text-shadow:-1px -1px 0 ${rgbaHex(p.tar, 0.85)},1px 1px 0 ${rgbaHex(p.goldBright, 0.2)}}
    .ow2-rack{position:relative;display:grid;justify-items:center;padding:13px 0 15px}
    .ow2-rackwood{position:absolute;pointer-events:none;line-height:0;z-index:0}
    .ow2-grid{position:relative;display:grid;justify-content:center;z-index:1}
    .ow2-pouch{position:relative;display:grid;gap:3px;justify-items:center;align-content:start;
      background:none;border:0;padding:0 0 5px;cursor:pointer;font-family:${SERIF};
      color:${p.bone};border-radius:7px;-webkit-tap-highlight-color:transparent}
    .ow2-pouch::after{content:'';position:absolute;left:16%;right:16%;top:var(--sh,70%);height:9px;
      border-radius:50%;pointer-events:none;z-index:0;opacity:.9;
      background:radial-gradient(closest-side,${rgbaHex(p.tar, 0.8)},${rgbaHex(p.tar, 0)});
      transition:opacity var(--settle,.42s) ease,transform var(--settle,.42s) ease}
    .ow2-gfx{position:relative;z-index:1;line-height:0;display:block;
      transition:transform var(--settle,.42s) cubic-bezier(.3,.05,.2,1)}
    .ow2-tag{position:relative;z-index:1;font-family:${MONO};font-size:11px;line-height:1.3;
      text-align:center;color:${p.bone};max-width:100%}
    .ow2-pouch:hover .ow2-gfx,.ow2-pouch:focus-visible .ow2-gfx{transform:translateY(-7px);
      transition:transform .19s cubic-bezier(.2,1.4,.45,1)}
    .ow2-pouch:hover::after,.ow2-pouch:focus-visible::after{opacity:.5;transform:scaleX(1.14)}
    .ow2-pouch:active .ow2-gfx{transform:translateY(-3px);transition-duration:.08s}
    .ow2-pouch[aria-checked="true"] .ow2-gfx{transform:translateY(-9px)}
    .ow2-pouch[aria-checked="true"]::after{opacity:.44;transform:scaleX(1.18)}
    .ow2-pouch[data-struck="1"] .ow2-tag{text-decoration:line-through;color:${p.boneDim}}
    .ow2-pouch:focus-visible{outline:2px solid ${p.goldBright};outline-offset:3px}
    .ow2-ghost{position:absolute;left:0;top:0;pointer-events:none;z-index:3;line-height:0}
    .ow2-act{font-family:${SERIF};font-size:15px;color:${p.boneDim};background:transparent;
      border:1px solid ${rgbaHex(p.oakLight, 0.9)};border-radius:3px;padding:11px 18px;
      min-height:44px;cursor:pointer}
    .ow2-act:hover{color:${p.bone};border-color:${p.oakLight}}
    .ow2-act:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    .ow2-act[disabled]{opacity:.5;cursor:default}
    .ow2-tools{display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap}
    @media (prefers-reduced-motion: reduce){
      .ow2-gfx,.ow2-pouch::after{transition:none}
      .ow2-pouch:hover .ow2-gfx,.ow2-pouch:focus-visible .ow2-gfx{transform:translateY(-5px)}
    }
  `;
  wrap.append(style);

  // (1) what the lock asks — one plain sentence, always visible, on a carved plate
  const askWrap = node('div');
  askWrap.className = 'ow2-plate';
  const askHost = node('div');
  askHost.className = 'ow2-platewood';
  askHost.setAttribute('aria-hidden', 'true');
  const ask = node('p', null, T('ask'));
  ask.className = 'ow2-ask';
  askWrap.append(askHost, ask);
  const askWood = { canvas: null, ctx: null, w: 0, h: 0 };

  const law = node('p', `margin:0;font-size:13px;color:${p.boneDim};line-height:1.5;text-align:center`,
    T('law', { n: instance.swornErtog }));

  const beams = node('div', 'display:flex;flex-wrap:wrap;gap:12px;justify-content:center');
  const beamViews = instance.weighings.map((w, k) => {
    const box = node('div', 'display:grid;gap:3px;justify-items:center');
    const host = node('div', 'line-height:0');
    const cap = node('p', `margin:0;font-size:12px;color:${p.boneDim}`,
      T('cap', { ord: ordWord(k), sink: sinkWord(w.tilt) }));
    box.append(host, cap);
    beams.append(box);
    return { host, gfx: { canvas: null, ctx: null, w: 0, h: 0 }, back: null, w, k };
  });

  const tools = node('div');
  tools.className = 'ow2-tools';
  const ruleHost = node('div', 'line-height:0');
  const rule = { canvas: null, ctx: null, w: 0, h: 0 };
  const reckon = node('button', null, T('reckon'));
  reckon.className = 'ow2-act';
  reckon.type = 'button';
  const skipBtn = node('button', null, T('skip'));
  skipBtn.className = 'ow2-act';
  skipBtn.type = 'button';
  skipBtn.style.display = 'none';
  tools.append(ruleHost, reckon, skipBtn);

  const rackWrap = node('div');
  rackWrap.className = 'ow2-rack';
  const rackHost = node('div');
  rackHost.className = 'ow2-rackwood';
  rackHost.setAttribute('aria-hidden', 'true');
  const rackWood = { canvas: null, ctx: null, w: 0, h: 0 };
  const grid = node('div');
  grid.className = 'ow2-grid';
  grid.setAttribute('role', 'radiogroup');
  grid.setAttribute('aria-label', T('ariaGroup'));
  const ghostHost = node('div');
  ghostHost.className = 'ow2-ghost';
  ghostHost.setAttribute('aria-hidden', 'true');
  ghostHost.style.display = 'none';
  const ghost = { canvas: null, ctx: null, w: 0, h: 0 };
  rackWrap.append(rackHost, grid, ghostHost);

  const help = node('p', `margin:0;font-size:13px;color:${p.boneDim};text-align:center;line-height:1.5`,
    T('help'));
  const status = node('p', `margin:0;min-height:20px;font-size:14px;color:${p.boneDim};text-align:center`);
  status.setAttribute('aria-live', 'polite');

  const submitBtn = node('button', null, T('submit'));
  submitBtn.className = 'btn-carved'; // one primary-action language: the carved gold plate
  submitBtn.type = 'button';
  // the grid parent stretches children edge-to-edge; the primary is a plate,
  // not a full-width slab (QUALITY_LOOP4 button discipline)
  submitBtn.style.justifySelf = 'center';
  submitBtn.disabled = true;

  // the help line stands directly over the rack it describes, so the board
  // runs unbroken into its controls (docs/QUALITY.md density rubric)
  wrap.append(askWrap, law, beams, tools, help, rackWrap, submitBtn, status);
  ctx.root.append(wrap);

  function fitCanvas(holder, target, w, h) {
    const fresh = art.makeCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
    if (target.canvas && target.canvas.parentNode === holder) holder.replaceChild(fresh.canvas, target.canvas);
    else holder.append(fresh.canvas);
    target.canvas = fresh.canvas;
    target.ctx = fresh.ctx;
    target.w = fresh.w;
    target.h = fresh.h;
    return target;
  }

  // ---- shared prop: a sealed leather pouch -------------------------------
  // Drawn at any size: gathered leather with its own grain and stitched seam,
  // a waxed cord, the ertog tally nicked into the belly, and the wax seal
  // stamped with the pouch's rune.
  function pouchGlyph(c, x, base, s, o) {
    const h = s * 1.34;
    const top = base - h;
    const neck = top + s * 0.34;
    const named = !!o.named;
    c.save();
    if (o.alpha != null) c.globalAlpha = o.alpha;
    // the named pouch is answered wherever it stands — rack, pan, or ledge
    if (named) art.glow(c, x, base - h * 0.46, s * 1.2, p.goldBright, 0.42);

    const body = (cc) => {
      cc.beginPath();
      cc.moveTo(x - s * 0.15, neck);
      cc.bezierCurveTo(x - s * 0.52, neck + s * 0.24, x - s * 0.47, base, x, base);
      cc.bezierCurveTo(x + s * 0.47, base, x + s * 0.52, neck + s * 0.24, x + s * 0.15, neck);
      cc.closePath();
    };
    body(c);
    const g = c.createLinearGradient(x - s * 0.42, top, x + s * 0.42, base);
    g.addColorStop(0, mixHex(p.oakLight, p.bone, o.dim ? 0.14 : 0.42));
    g.addColorStop(0.42, mixHex(p.oakLight, p.bone, o.dim ? 0.02 : 0.12));
    g.addColorStop(1, mixHex(p.oakDeep, p.oak, 0.5));
    c.fillStyle = g;
    c.fill();

    // leather grain + a stitched seam down the near side
    c.save();
    body(c);
    c.clip();
    for (let i = 0; i < 6; i++) {
      const t = (i + 1) / 7;
      c.strokeStyle = rgbaHex(i % 2 ? p.tar : p.bone, i % 2 ? 0.16 : 0.06);
      c.lineWidth = Math.max(0.5, s * 0.028);
      c.beginPath();
      c.moveTo(x - s * 0.5, neck + (base - neck) * t);
      c.quadraticCurveTo(x, neck + (base - neck) * (t + 0.07), x + s * 0.5, neck + (base - neck) * t);
      c.stroke();
    }
    c.strokeStyle = rgbaHex(p.bone, 0.2);
    c.lineWidth = Math.max(0.5, s * 0.03);
    if (c.setLineDash) c.setLineDash([s * 0.09, s * 0.09]);
    c.beginPath();
    c.moveTo(x - s * 0.34, neck + s * 0.12);
    c.quadraticCurveTo(x - s * 0.47, (neck + base) / 2, x - s * 0.3, base - s * 0.06);
    c.stroke();
    if (c.setLineDash) c.setLineDash([]);
    // the hearth catches the near shoulder
    const sheen = c.createRadialGradient(x - s * 0.24, neck + s * 0.2, 0, x - s * 0.2, neck + s * 0.25, s * 0.7);
    sheen.addColorStop(0, rgbaHex(p.bone, 0.16));
    sheen.addColorStop(1, rgbaHex(p.bone, 0));
    c.fillStyle = sheen;
    c.fillRect(x - s * 0.7, top, s * 1.4, h);
    c.restore();

    c.strokeStyle = rgbaHex(p.tar, 0.9);
    c.lineWidth = Math.max(0.6, s * 0.05);
    body(c);
    c.stroke();
    // rim light down the lit edge, so the leather lifts off its niche
    c.strokeStyle = rgbaHex(mixHex(p.bone, p.goldBright, 0.3), 0.34);
    c.lineWidth = Math.max(0.5, s * 0.035);
    c.beginPath();
    c.moveTo(x - s * 0.15, neck + s * 0.04);
    c.bezierCurveTo(x - s * 0.5, neck + s * 0.28, x - s * 0.45, base - s * 0.1, x - s * 0.16, base - s * 0.02);
    c.stroke();

    // gathered folds above the tie, and the waxed cord itself
    c.strokeStyle = rgbaHex(p.oakLight, 0.85);
    c.lineWidth = Math.max(0.5, s * 0.04);
    c.beginPath();
    c.moveTo(x - s * 0.12, top + s * 0.05); c.lineTo(x - s * 0.06, neck - s * 0.02);
    c.moveTo(x + s * 0.02, top); c.lineTo(x + s * 0.02, neck - s * 0.02);
    c.moveTo(x + s * 0.14, top + s * 0.06); c.lineTo(x + s * 0.08, neck - s * 0.02);
    c.stroke();
    c.strokeStyle = named ? p.goldBright : p.gold;
    c.lineWidth = Math.max(0.9, s * 0.075);
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x - s * 0.21, neck);
    c.quadraticCurveTo(x, neck + s * 0.05, x + s * 0.21, neck);
    c.stroke();
    c.lineWidth = Math.max(0.6, s * 0.04);
    c.beginPath();
    c.moveTo(x + s * 0.2, neck); c.lineTo(x + s * 0.33, neck + s * 0.16);
    c.stroke();

    // the ertog tally nicked into the belly (the label made physical)
    if (o.marks) {
      c.strokeStyle = rgbaHex(p.tar, 0.55);
      c.lineWidth = Math.max(0.5, s * 0.035);
      for (let i = 0; i < o.marks; i++) {
        const mx = x - s * 0.3 + i * s * 0.1;
        c.beginPath();
        c.moveTo(mx, base - s * 0.26); c.lineTo(mx + s * 0.03, base - s * 0.1);
        c.stroke();
      }
    }

    // the wax seal, pressed and stamped
    const sy = neck + (base - neck) * 0.48;
    const sr = s * 0.25;
    c.save();
    const wax = c.createRadialGradient(x - sr * 0.3, sy - sr * 0.35, sr * 0.1, x, sy, sr);
    wax.addColorStop(0, mixHex(p.blood, p.ember, 0.45));
    wax.addColorStop(0.6, p.blood);
    wax.addColorStop(1, mixHex(p.blood, p.tar, 0.55));
    c.fillStyle = wax;
    c.beginPath(); c.arc(x, sy, sr, 0, Math.PI * 2); c.fill();
    // squeezed rim: wax pushed out under the stamp
    c.strokeStyle = rgbaHex(mixHex(p.blood, p.bone, 0.25), 0.5);
    c.lineWidth = Math.max(0.5, sr * 0.16);
    c.beginPath(); c.arc(x, sy, sr * 0.92, Math.PI * 0.15, Math.PI * 1.1); c.stroke();
    c.strokeStyle = named ? p.goldBright : rgbaHex(p.tar, 0.75);
    c.lineWidth = Math.max(0.6, sr * 0.14);
    c.beginPath(); c.arc(x, sy, sr, 0, Math.PI * 2); c.stroke();
    c.restore();
    const rs = sr * 1.74;
    art.drawRune(c, o.seal, x - rs / 2, sy - rs / 2, rs, {
      color: named ? p.goldBright : o.dim ? p.boneDim : p.bone,
      weight: Math.max(1, rs / 6.4),
    });
    c.restore();
  }

  // ---- the weighing tableau ----------------------------------------------
  // Static half (boards, tray, counter, post, tool history) is baked per
  // layout; the moving half (beam, chains, pans, pouches, tongue) repaints.
  function bakeBack(view) {
    const { w: W, h: H } = view.gfx;
    const off = art.makeCanvas(W, H);
    const c = off.ctx;
    const S = W / 390;
    const band = Math.max(12, 17 * S);

    art.paintWood(c, W, H, 'bismer-corner', { vignette: 0.62 });
    art.tray(c, band, band, W - band * 2, H - band * 2, {
      band, seed: `bismer${view.k}`, ribbon: false, chipAlpha: 0.9,
    });

    const ox = band, oy = band, ow = W - band * 2, oh = H - band * 2;
    c.save();
    c.beginPath();
    c.rect(ox, oy, ow, oh);
    c.clip();

    const cx = W / 2;
    const counterY = oy + oh - 30 * S;

    // quiet tool history in the dead corners, held clear of the balance
    c.save();
    c.translate(ox, oy);
    art.wear(c, ow, oh, `bismer-w${view.k}`, {
      avoid: { x: ow * 0.18, y: 0, w: ow * 0.64, h: (counterY - oy) * 0.92 },
    });
    c.restore();

    // the counter: a sawn slab with its front edge in shadow
    const slab = c.createLinearGradient(0, counterY, 0, counterY + 14 * S);
    slab.addColorStop(0, mixHex(p.oak, p.oakLight, 0.5));
    slab.addColorStop(1, mixHex(p.oak, p.oakDeep, 0.3));
    c.fillStyle = slab;
    c.fillRect(ox, counterY, ow, oy + oh - counterY);
    c.fillStyle = rgbaHex(p.tar, 0.5);
    c.fillRect(ox, counterY + 13 * S, ow, oy + oh - counterY);
    c.strokeStyle = rgbaHex(p.tar, 0.8);
    c.lineWidth = Math.max(1, 1.5 * S);
    c.beginPath(); c.moveTo(ox, counterY); c.lineTo(ox + ow, counterY); c.stroke();
    c.strokeStyle = rgbaHex(mixHex(p.oakLight, p.goldBright, 0.3), 0.42);
    c.lineWidth = Math.max(0.8, 1.1 * S);
    c.beginPath(); c.moveTo(ox, counterY + 1.6 * S); c.lineTo(ox + ow, counterY + 1.6 * S); c.stroke();
    art.chipBorder(c, ox + 4 * S, counterY + 17 * S, ow - 8 * S, 8 * S, { size: Math.max(5, 7 * S), alpha: 0.5 });
    // the merchant's scribe line along the counter
    c.strokeStyle = rgbaHex(p.bone, 0.07);
    c.lineWidth = Math.max(0.6, 0.8 * S);
    c.beginPath();
    for (let x = ox + 6; x <= ox + ow - 6; x += 18) c.lineTo(x, counterY + 8 * S + Math.sin(x * 0.06) * 0.7);
    c.stroke();

    // the back wall carries the corner's working life: a hook rail along the
    // top, chalk tallies low on the boards. Quiet — never louder than a pan.
    c.save();
    c.strokeStyle = rgbaHex(p.tar, 0.5);
    c.lineWidth = Math.max(1, 1.6 * S);
    c.beginPath(); c.moveTo(ox + 6 * S, oy + 9 * S); c.lineTo(ox + ow - 6 * S, oy + 9 * S); c.stroke();
    c.strokeStyle = rgbaHex(p.oakLight, 0.3);
    c.lineWidth = Math.max(0.7, 1 * S);
    c.beginPath(); c.moveTo(ox + 6 * S, oy + 10.4 * S); c.lineTo(ox + ow - 6 * S, oy + 10.4 * S); c.stroke();
    for (let i = 0; i < 5; i++) {
      const hx = ox + ow * (0.1 + i * 0.2);
      c.strokeStyle = rgbaHex(p.tar, 0.45);
      c.lineWidth = Math.max(0.9, 1.4 * S);
      c.beginPath();
      c.moveTo(hx, oy + 9 * S);
      c.quadraticCurveTo(hx, oy + 16 * S, hx + 3.2 * S, oy + 16 * S);
      c.stroke();
    }
    c.globalAlpha = 0.5;
    for (let g = 0; g < 3; g++) {
      const gx = ox + ow * (0.06 + g * 0.055);
      const gy = oy + oh * 0.58;
      c.strokeStyle = rgbaHex(p.bone, 0.16);
      c.lineWidth = Math.max(0.7, 1 * S);
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.moveTo(gx + i * 2.6 * S, gy); c.lineTo(gx + i * 2.6 * S - 1.2 * S, gy + 11 * S);
        c.stroke();
      }
      c.beginPath();
      c.moveTo(gx - 2 * S, gy + 9 * S); c.lineTo(gx + 9 * S, gy + 1.5 * S);
      c.stroke();
    }
    c.restore();

    // the post: a turned column with ring cuts and a verdigris collar
    const pivotY = oy + 30 * S;
    const pw = 6 * S;
    const post = c.createLinearGradient(cx - pw, 0, cx + pw, 0);
    post.addColorStop(0, mixHex(p.oakDeep, p.tar, 0.3));
    post.addColorStop(0.35, mixHex(p.oakLight, p.bone, 0.1));
    post.addColorStop(1, mixHex(p.oakDeep, p.tar, 0.5));
    c.fillStyle = post;
    c.fillRect(cx - pw, pivotY, pw * 2, counterY - pivotY);
    c.strokeStyle = rgbaHex(p.tar, 0.8);
    c.lineWidth = Math.max(0.8, 1.1 * S);
    c.strokeRect(cx - pw, pivotY, pw * 2, counterY - pivotY);
    for (let i = 1; i <= 4; i++) {
      const ry = pivotY + (counterY - pivotY) * (i / 5);
      c.strokeStyle = rgbaHex(p.tar, 0.5);
      c.lineWidth = Math.max(0.7, 1 * S);
      c.beginPath(); c.moveTo(cx - pw, ry); c.lineTo(cx + pw, ry); c.stroke();
      c.strokeStyle = rgbaHex(p.goldBright, 0.14);
      c.beginPath(); c.moveTo(cx - pw, ry + 1.3 * S); c.lineTo(cx + pw, ry + 1.3 * S); c.stroke();
    }
    // verdigris collar
    const collarY = pivotY + (counterY - pivotY) * 0.32;
    c.fillStyle = rgbaHex(p.pine, 0.85);
    c.fillRect(cx - pw * 1.35, collarY, pw * 2.7, 5 * S);
    c.fillStyle = rgbaHex(p.pineLight, 0.6);
    c.fillRect(cx - pw * 1.35, collarY, pw * 2.7, 1.6 * S);
    // the foot block, seated on the counter
    c.fillStyle = mixHex(p.oak, p.oakLight, 0.35);
    c.fillRect(cx - pw * 3.2, counterY - 9 * S, pw * 6.4, 9 * S);
    c.strokeStyle = rgbaHex(p.tar, 0.85);
    c.lineWidth = Math.max(0.8, 1.2 * S);
    c.strokeRect(cx - pw * 3.2, counterY - 9 * S, pw * 6.4, 9 * S);
    c.strokeStyle = rgbaHex(p.goldBright, 0.18);
    c.beginPath();
    c.moveTo(cx - pw * 3.2, counterY - 8.2 * S); c.lineTo(cx + pw * 3.2, counterY - 8.2 * S);
    c.stroke();
    art.ornament(c, 'nailhead', cx - pw * 2.3, counterY - 4.5 * S, Math.max(4, 6 * S));
    art.ornament(c, 'nailhead', cx + pw * 2.3, counterY - 4.5 * S, Math.max(4, 6 * S));

    // the reading plate behind the pivot: a notched arc the tongue rides
    const arcR = 22 * S;
    c.save();
    c.strokeStyle = rgbaHex(p.tar, 0.65);
    c.lineWidth = Math.max(1.4, 3 * S);
    c.beginPath(); c.arc(cx, pivotY, arcR, Math.PI * 1.18, Math.PI * 1.82); c.stroke();
    c.strokeStyle = rgbaHex(mixHex(p.gold, p.pineLight, 0.35), 0.6);
    c.lineWidth = Math.max(0.9, 1.6 * S);
    c.beginPath(); c.arc(cx, pivotY, arcR, Math.PI * 1.18, Math.PI * 1.82); c.stroke();
    for (let i = -2; i <= 2; i++) {
      const a = -Math.PI / 2 + i * 0.2;
      const inner = i === 0 ? arcR - 6 * S : arcR - 3.4 * S;
      c.strokeStyle = rgbaHex(i === 0 ? p.goldBright : p.bone, i === 0 ? 0.85 : 0.34);
      c.lineWidth = Math.max(0.8, (i === 0 ? 1.6 : 1) * S);
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * inner, pivotY + Math.sin(a) * inner);
      c.lineTo(cx + Math.cos(a) * (arcR + 2 * S), pivotY + Math.sin(a) * (arcR + 2 * S));
      c.stroke();
    }
    c.restore();

    // the merchant's kit on the counter, left of the post: tally stick, cord
    // coil, wax stub — quiet, low-contrast, never competing with the pans
    c.save();
    c.globalAlpha = 0.75;
    const kx = ox + ow * 0.13;
    c.fillStyle = mixHex(p.oakLight, p.bone, 0.12);
    c.fillRect(kx - 22 * S, counterY - 4.5 * S, 44 * S, 4.5 * S);
    c.strokeStyle = rgbaHex(p.tar, 0.7);
    c.lineWidth = Math.max(0.6, 0.9 * S);
    c.strokeRect(kx - 22 * S, counterY - 4.5 * S, 44 * S, 4.5 * S);
    for (let i = 0; i < 9; i++) {
      c.beginPath();
      c.moveTo(kx - 19 * S + i * 4.6 * S, counterY - 4.2 * S);
      c.lineTo(kx - 19 * S + i * 4.6 * S, counterY - 1.4 * S);
      c.stroke();
    }
    const coilX = ox + ow * 0.26;
    for (let i = 0; i < 3; i++) {
      c.strokeStyle = rgbaHex(mixHex(p.oakLight, p.tar, 0.3), 0.8);
      c.lineWidth = Math.max(0.8, 1.6 * S);
      c.beginPath();
      c.ellipse(coilX, counterY - 3.5 * S, (8 - i * 2) * S, (3 - i * 0.7) * S, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();

    // the set-aside ledge, cut into the counter to the right of the post
    const asideW = Math.min(ow * 0.36, 126 * S);
    const asideX = Math.min(cx + 32 * S, ox + ow - 6 * S - asideW);
    c.save();
    c.fillStyle = rgbaHex(p.tar, 0.34);
    c.fillRect(asideX, counterY - 2 * S, asideW, 2.6 * S);
    art.insetFace(c, asideX, counterY - 34 * S, asideW, 34 * S, { depth: 0.3, lipLight: 0.16 });
    c.restore();
    art.carveText(c, T('setAside'), asideX + asideW / 2, counterY - 36 * S, Math.max(9, 11 * S), {
      align: 'center', depth: 0.75, color: p.boneDim, maxWidth: asideW,
    });

    c.restore();
    view.geo = { S, band, ox, oy, ow, oh, cx, counterY, pivotY, arcR, asideX, asideW };
    view.back = off.canvas;
  }

  function paintBeam(view) {
    if (!view.gfx.ctx || !view.back) return;
    const c = view.gfx.ctx;
    const { w: W, h: H } = view.gfx;
    const w = view.w;
    const { S, ox, oy, ow, oh, cx, counterY, pivotY, arcR, asideX, asideW } = view.geo;
    c.clearRect(0, 0, W, H);
    c.drawImage(view.back, 0, 0, W, H);

    c.save();
    c.beginPath();
    c.rect(ox, oy, ow, oh);
    c.clip();

    const arm = Math.min(ow * 0.335, 122 * S);
    const drop = w.tilt === 'level' ? 0 : (w.tilt === 'left' ? 22 * S : -22 * S);
    const panR = Math.min(arm * 0.28, 32 * S);
    const chainLen = 46 * S;

    // the beam: carved oak, iron-strapped, gold-capped
    const bx0 = cx - arm, by0 = pivotY + drop;
    const bx1 = cx + arm, by1 = pivotY - drop;
    const ang = Math.atan2(by1 - by0, bx1 - bx0);
    c.save();
    c.translate(cx, pivotY);
    c.rotate(ang);
    const bh = 7 * S;
    c.fillStyle = rgbaHex(p.tar, 0.55);
    c.fillRect(-arm, -bh / 2 + 2 * S, arm * 2, bh);
    const beamGrad = c.createLinearGradient(0, -bh / 2, 0, bh / 2);
    beamGrad.addColorStop(0, mixHex(p.oakLight, p.bone, 0.22));
    beamGrad.addColorStop(0.45, p.oakLight);
    beamGrad.addColorStop(1, mixHex(p.oakDeep, p.tar, 0.45));
    c.fillStyle = beamGrad;
    c.fillRect(-arm, -bh / 2, arm * 2, bh);
    c.strokeStyle = rgbaHex(p.tar, 0.85);
    c.lineWidth = Math.max(0.7, 1 * S);
    c.strokeRect(-arm, -bh / 2, arm * 2, bh);
    c.strokeStyle = rgbaHex(p.bone, 0.16);
    c.lineWidth = Math.max(0.5, 0.8 * S);
    for (let i = 0; i < 5; i++) {
      const gy = -bh / 2 + bh * ((i + 0.7) / 6);
      c.beginPath();
      c.moveTo(-arm + 4 * S, gy);
      c.lineTo(arm - 4 * S, gy + (i % 2 ? 0.6 : -0.6));
      c.stroke();
    }
    // iron straps and gold end caps
    for (const sx of [-arm + 9 * S, arm - 9 * S]) {
      c.fillStyle = rgbaHex(p.tar, 0.8);
      c.fillRect(sx - 2 * S, -bh / 2 - 1.2 * S, 4 * S, bh + 2.4 * S);
      c.fillStyle = rgbaHex(p.gold, 0.7);
      c.fillRect(sx - 2 * S, -bh / 2 - 1.2 * S, 4 * S, 1.4 * S);
    }
    for (const ex of [-arm, arm]) {
      const capG = c.createLinearGradient(0, -bh / 2, 0, bh / 2);
      capG.addColorStop(0, p.goldBright);
      capG.addColorStop(1, mixHex(p.gold, p.tar, 0.5));
      c.fillStyle = capG;
      c.fillRect(ex - (ex < 0 ? 0 : 5 * S), -bh / 2 - 1 * S, 5 * S, bh + 2 * S);
    }
    // the tongue, rigid with the beam: it leans toward the heavy side
    c.strokeStyle = rgbaHex(p.tar, 0.8);
    c.lineWidth = Math.max(1.6, 3.4 * S);
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -(arcR + 3 * S)); c.stroke();
    c.strokeStyle = w.tilt === 'level' ? p.goldBright : mixHex(p.gold, p.pineLight, 0.2);
    c.lineWidth = Math.max(1, 1.8 * S);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -(arcR + 3 * S)); c.stroke();
    c.fillStyle = w.tilt === 'level' ? p.goldBright : p.gold;
    c.beginPath(); c.arc(0, -(arcR + 3 * S), Math.max(1.6, 2.6 * S), 0, Math.PI * 2); c.fill();
    c.restore();

    // the pivot nail through the bracket
    art.ornament(c, 'nailhead', cx, pivotY, Math.max(7, 11 * S));

    // a hanging chain: three verdigris strands, links alternating in the round
    const chain = (px, py, side) => {
      for (const off of [-panR * 0.72, 0, panR * 0.72]) {
        const tx = px + off;
        const links = 5;
        for (let i = 0; i < links; i++) {
          const t0 = i / links, t1 = (i + 0.86) / links;
          const ax = px + (tx - px) * t0, ay = py + chainLen * t0;
          const bxp = px + (tx - px) * t1, byp = py + chainLen * t1;
          const worn = (i + side + view.k) % 3 === 0;
          c.save();
          c.strokeStyle = worn ? p.pineLight : mixHex(p.gold, p.pine, 0.4);
          c.globalAlpha = worn ? 0.95 : 0.85;
          c.lineWidth = Math.max(0.8, 1.5 * S);
          c.beginPath();
          if (typeof c.ellipse === 'function') {
            c.ellipse((ax + bxp) / 2, (ay + byp) / 2, i % 2 ? 2.4 * S : 1.2 * S,
              (byp - ay) * 0.5, 0, 0, Math.PI * 2);
          } else {
            c.arc((ax + bxp) / 2, (ay + byp) / 2, 2.2 * S, 0, Math.PI * 2);
          }
          c.stroke();
          if (worn) {
            c.fillStyle = rgbaHex(p.pine, 0.5);
            c.beginPath();
            c.arc((ax + bxp) / 2 + 0.9 * S, (ay + byp) / 2, 1 * S, 0, Math.PI * 2);
            c.fill();
          }
          c.restore();
        }
      }
    };

    const pan = (px, py, ids, side) => {
      const rimY = py + chainLen;
      const depth = panR * 0.52;
      // the pan's shadow on the counter — the sunk pan casts a tighter, darker one
      const near = 1 - Math.min(1, (counterY - rimY) / (oh * 0.9));
      c.save();
      c.fillStyle = rgbaHex(p.tar, 0.28 + 0.34 * near);
      c.beginPath();
      c.ellipse(px + 3 * S, counterY + 1.5 * S, panR * (1.5 - 0.45 * near), panR * (0.3 - 0.09 * near), 0, 0, Math.PI * 2);
      c.fill();
      c.restore();

      chain(px, py, side);

      // the hammered bronze dish
      c.save();
      c.beginPath();
      c.moveTo(px - panR, rimY);
      c.quadraticCurveTo(px, rimY + depth * 2.1, px + panR, rimY);
      c.closePath();
      const pg = c.createLinearGradient(px - panR * 0.4, rimY, px + panR * 0.5, rimY + depth);
      pg.addColorStop(0, mixHex(p.gold, p.goldBright, 0.55));
      pg.addColorStop(0.45, mixHex(p.gold, p.pine, 0.18));
      pg.addColorStop(1, mixHex(p.gold, p.tar, 0.62));
      c.fillStyle = pg;
      c.fill();
      // hammer facets
      c.save();
      c.clip();
      for (let i = 0; i < 16; i++) {
        const fx = px - panR + (i % 8) * (panR / 4) + (i > 7 ? panR / 8 : 0);
        const fy = rimY + (i > 7 ? depth * 0.9 : depth * 0.35);
        c.strokeStyle = rgbaHex(i % 2 ? p.goldBright : p.tar, i % 2 ? 0.28 : 0.3);
        c.lineWidth = Math.max(0.6, 1 * S);
        c.beginPath();
        c.arc(fx, fy, panR * 0.2, Math.PI * 0.15, Math.PI * 0.85);
        c.stroke();
      }
      // verdigris pooled at the bottom of the dish
      c.fillStyle = rgbaHex(p.pine, 0.3);
      c.beginPath();
      c.ellipse(px, rimY + depth * 1.55, panR * 0.6, depth * 0.4, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
      c.strokeStyle = rgbaHex(p.tar, 0.8);
      c.lineWidth = Math.max(0.8, 1.2 * S);
      c.beginPath();
      c.moveTo(px - panR, rimY);
      c.quadraticCurveTo(px, rimY + depth * 2.1, px + panR, rimY);
      c.stroke();
      // the rim, seen a little from above
      c.strokeStyle = p.goldBright;
      c.lineWidth = Math.max(1, 1.6 * S);
      c.beginPath();
      c.ellipse(px, rimY, panR, panR * 0.2, 0, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = rgbaHex(p.tar, 0.32);
      c.beginPath();
      c.ellipse(px, rimY, panR * 0.94, panR * 0.17, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
      // rivets where the chains bite
      for (const off of [-panR * 0.72, 0, panR * 0.72]) {
        art.ornament(c, 'nailhead', px + off, rimY, Math.max(3.5, 5 * S));
      }

      // the pouches riding in the pan
      ids.forEach((id, k) => {
        const gx = px + (k - (ids.length - 1) / 2) * (panR * 0.66);
        pouchGlyph(c, gx, rimY + panR * 0.14, panR * 0.62, {
          seal: instance.pouches[id].seal,
          named: id === accused,
          dim: struck[id],
          marks: instance.pouches[id].ertog,
        });
      });
    };

    pan(bx0, by0, w.left, 0);
    pan(bx1, by1, w.right, 1);

    // the three set aside, standing on the ledge
    w.aside.forEach((id, k) => {
      const gx = asideX + asideW * ((k + 0.5) / w.aside.length);
      pouchGlyph(c, gx, counterY - 3 * S, Math.min(asideW / w.aside.length * 0.74, 24 * S), {
        seal: instance.pouches[id].seal,
        named: id === accused,
        dim: struck[id],
        marks: instance.pouches[id].ertog,
      });
    });

    c.restore();

    // near-miss: this weighing already cleared the named pouch
    if (view.k === nearWeighing) {
      c.save();
      c.strokeStyle = p.ember;
      c.lineWidth = Math.max(1.6, 2.4 * S);
      c.strokeRect(ox + 2, oy + 2, ow - 4, oh - 4);
      c.globalAlpha = 0.35;
      c.strokeStyle = p.blood;
      c.lineWidth = Math.max(3, 5 * S);
      c.strokeRect(ox + 2, oy + 2, ow - 4, oh - 4);
      c.restore();
    }
  }

  // ---- the carved reckoning rule -----------------------------------------
  // Twenty-four ertog laid out under the eye: every third tick an øre, the
  // whole run one mark. The unit law made physical, next to its toggle.
  function paintRule() {
    if (!rule.ctx) return;
    const c = rule.ctx;
    const { w: W, h: H } = rule;
    c.clearRect(0, 0, W, H);
    art.paintPanel(c, 0, 0, W, H, { title: null, nails: false, wash: 0.5 });
    const x0 = 9, x1 = W - 9;
    const base = H - 11;
    const step = (x1 - x0) / ERTOG_PER_MARK;
    c.save();
    c.strokeStyle = rgbaHex(p.tar, 0.85);
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(x0, base); c.lineTo(x1, base); c.stroke();
    c.strokeStyle = rgbaHex(p.goldBright, 0.3);
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(x0, base + 1.3); c.lineTo(x1, base + 1.3); c.stroke();
    for (let i = 0; i <= ERTOG_PER_MARK; i++) {
      const x = x0 + step * i;
      const mark = i === 0 || i === ERTOG_PER_MARK;
      const ore = i % ERTOG_PER_ORE === 0;
      const len = mark ? 13 : ore ? 8 : 4.5;
      c.strokeStyle = rgbaHex(mark ? p.goldBright : ore ? p.bone : p.boneDim, mark ? 0.9 : ore ? 0.6 : 0.4);
      c.lineWidth = mark ? 2 : ore ? 1.3 : 1;
      c.beginPath(); c.moveTo(x, base); c.lineTo(x, base - len); c.stroke();
      if (!mark && ore) {
        c.strokeStyle = rgbaHex(p.tar, 0.55);
        c.beginPath(); c.moveTo(x - 0.9, base); c.lineTo(x - 0.9, base - len); c.stroke();
      }
    }
    c.restore();
    art.carveText(c, `1 ${T('unitMark')} = 8 ${T('unitOre')} = ${ERTOG_PER_MARK} ${T('unitErtog')}`,
      W / 2, 15, 11, { align: 'center', depth: 0.7, color: p.bone, maxWidth: W - 18 });
  }

  // ---- the rack ----------------------------------------------------------
  function paintRack(cells, pad) {
    if (!rackWood.ctx) return;
    const c = rackWood.ctx;
    const { w: W, h: H } = rackWood;
    c.clearRect(0, 0, W, H);
    art.paintWood(c, W, H, 'bismer-rack', { vignette: 0.5 });
    art.tray(c, pad * 0.62, pad * 0.62, W - pad * 1.24, H - pad * 1.24, {
      band: pad * 0.62, seed: 'bismer-rack', ribbon: W > 420, chipAlpha: 0.8,
    });

    // one shelf per row of niches, with the niche mouths cut into it
    const rows = [];
    for (const b of cells) {
      const hit = rows.find((r) => Math.abs(r.y - b.y) < 8);
      if (hit) hit.cells.push(b);
      else rows.push({ y: b.y, cells: [b] });
    }
    c.save();
    c.beginPath();
    c.rect(pad * 0.62, pad * 0.62, W - pad * 1.24, H - pad * 1.24);
    c.clip();
    for (const row of rows) {
      const bot = Math.max(...row.cells.map((b) => b.y + b.h));
      const left = Math.min(...row.cells.map((b) => b.x)) - 8;
      const right = Math.max(...row.cells.map((b) => b.x + b.w)) + 8;
      // the shelf board
      const g = c.createLinearGradient(0, bot - 5, 0, bot + 9);
      g.addColorStop(0, mixHex(p.oakLight, p.bone, 0.14));
      g.addColorStop(0.4, p.oakLight);
      g.addColorStop(1, mixHex(p.oakDeep, p.tar, 0.4));
      c.fillStyle = g;
      c.fillRect(left, bot - 4, right - left, 12);
      c.strokeStyle = rgbaHex(p.tar, 0.85);
      c.lineWidth = 1.2;
      c.strokeRect(left, bot - 4, right - left, 12);
      c.strokeStyle = rgbaHex(p.goldBright, 0.18);
      c.beginPath(); c.moveTo(left + 2, bot - 2.8); c.lineTo(right - 2, bot - 2.8); c.stroke();
      art.chipBorder(c, left + 5, bot + 4.5, right - left - 10, 4, { size: 7, alpha: 0.55 });
      // the niche each pouch hangs in: a shaded recess with a peg above
      for (const b of row.cells) {
        const nx = b.x + b.w * 0.06;
        const nw = b.w * 0.88;
        const ny = b.y - 3;
        const nh = bot - 4 - ny;
        if (nh <= 6) continue;
        c.save();
        c.fillStyle = rgbaHex(p.tar, 0.2);
        c.fillRect(nx, ny, nw, nh);
        art.insetFace(c, nx, ny, nw, nh, { depth: 0.42, lipLight: 0.2 });
        c.restore();
        c.strokeStyle = rgbaHex(p.tar, 0.6);
        c.lineWidth = 1;
        c.strokeRect(nx + 0.5, ny + 0.5, nw - 1, nh - 1);
        art.ornament(c, 'nailhead', nx + nw / 2, ny + 5, 6);
        // the written tag on the rack face under each niche
        c.strokeStyle = rgbaHex(p.bone, 0.1);
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(b.fx + 3, b.fb - 0.5); c.lineTo(b.fx + b.fw - 3, b.fb - 0.5);
        c.stroke();
      }
      // uprights between the niches
      for (let i = 1; i < row.cells.length; i++) {
        const ux = (row.cells[i - 1].x + row.cells[i - 1].w + row.cells[i].x) / 2;
        c.fillStyle = rgbaHex(p.oakDeep, 0.55);
        c.fillRect(ux - 2, row.cells[i].y - 4, 4, bot - row.cells[i].y);
        c.strokeStyle = rgbaHex(p.goldBright, 0.1);
        c.lineWidth = 1;
        c.beginPath(); c.moveTo(ux + 2, row.cells[i].y - 4); c.lineTo(ux + 2, bot - 4); c.stroke();
      }
      art.rosette(c, left + 6, bot + 2, 5, { alpha: 0.5 });
      art.rosette(c, right - 6, bot + 2, 5, { alpha: 0.5 });
    }
    // the margins are dead zone: they carry tool history, nothing louder
    const bb = {
      x: Math.min(...cells.map((b) => b.x)) - 4,
      y: Math.min(...cells.map((b) => b.y)) - 4,
    };
    bb.w = Math.max(...cells.map((b) => b.x + b.w)) - bb.x + 4;
    bb.h = Math.max(...cells.map((b) => b.y + b.h)) - bb.y + 12;
    art.wear(c, W, H, 'bismer-rackwear', { avoid: bb });
    c.restore();
  }

  // ---- one pouch in its niche --------------------------------------------
  function paintPouch(v) {
    if (!v.gfx.ctx) return;
    const c = v.gfx.ctx;
    const { w, h } = v.gfx;
    const named = v.i === accused;
    const out = struck[v.i];
    c.clearRect(0, 0, w, h);

    // (3) the carved tally notch at the head of the niche — this pouch's
    // standing in the reckoning, cut where the merchant would pin his mark
    const notchH = Math.max(10, h * 0.11);
    const base = h - 3;
    const s = Math.min(w * 0.74, (base - notchH - 6) * 0.8);

    // the pouch, hanging from its peg cord
    c.save();
    c.strokeStyle = rgbaHex(p.tar, 0.7);
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(w / 2, notchH + 2);
    c.lineTo(w / 2, base - s * 1.34 + 1);
    c.stroke();
    c.strokeStyle = rgbaHex(p.goldBright, 0.16);
    c.beginPath();
    c.moveTo(w / 2 + 1, notchH + 2);
    c.lineTo(w / 2 + 1, base - s * 1.34 + 1);
    c.stroke();
    c.restore();
    if (out) c.globalAlpha = 0.55;
    pouchGlyph(c, w / 2, base, s, {
      seal: instance.pouches[v.i].seal,
      named,
      dim: out,
      marks: instance.pouches[v.i].ertog,
    });
    c.globalAlpha = 1;

    if (out) {
      c.save();
      c.strokeStyle = rgbaHex(p.blood, 0.85);
      c.lineWidth = Math.max(2, s * 0.11);
      c.lineCap = 'round';
      const r = s * 0.5;
      c.beginPath();
      c.moveTo(w / 2 - r, base - s * 0.9); c.lineTo(w / 2 + r, base - s * 0.24);
      c.moveTo(w / 2 + r, base - s * 0.9); c.lineTo(w / 2 - r, base - s * 0.24);
      c.stroke();
      c.restore();
    }
    const nw = Math.max(24, w * 0.62);
    const nx = (w - nw) / 2;
    const ny = 1;
    c.save();
    c.fillStyle = rgbaHex(p.tar, 0.55);
    c.fillRect(nx, ny, nw, notchH);
    art.insetFace(c, nx, ny, nw, notchH, { depth: 0.6, lipLight: 0.22 });
    c.strokeStyle = rgbaHex(p.tar, 0.8);
    c.lineWidth = 1;
    c.strokeRect(nx + 0.5, ny + 0.5, nw - 1, notchH - 1);
    if (named) {
      c.fillStyle = rgbaHex(p.goldBright, 0.22);
      c.fillRect(nx + 1, ny + 1, nw - 2, notchH - 2);
      art.ornament(c, 'nailhead', w / 2, ny + notchH / 2, Math.max(6, notchH * 0.82));
    } else if (out) {
      c.strokeStyle = rgbaHex(p.blood, 0.8);
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(nx + 4, ny + 2.5); c.lineTo(nx + nw - 4, ny + notchH - 2.5);
      c.moveTo(nx + nw - 4, ny + 2.5); c.lineTo(nx + 4, ny + notchH - 2.5);
      c.stroke();
    } else {
      c.strokeStyle = rgbaHex(p.bone, 0.14);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(nx + 4, ny + notchH / 2); c.lineTo(nx + nw - 4, ny + notchH / 2);
      c.stroke();
    }
    c.restore();
  }

  const pouchViews = instance.pouches.map((pouch, i) => {
    const btn = node('div');
    btn.className = 'ow2-pouch';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('tabindex', i === 0 ? '0' : '-1');
    btn.style.setProperty('--settle', `${(0.36 + noise(i * 7 + 3) * 0.16).toFixed(3)}s`);
    const gfxHost = node('span');
    gfxHost.className = 'ow2-gfx';
    const tag = node('span');
    tag.className = 'ow2-tag';
    btn.append(gfxHost, tag);
    grid.append(btn);
    return { i, btn, gfxHost, gfx: { canvas: null, ctx: null, w: 0, h: 0 }, tag };
  });

  function render() {
    pouchViews.forEach((v) => {
      const pouch = instance.pouches[v.i];
      v.tag.textContent = inErtog ? `${instance.swornErtog} ertog` : labelOf(pouch);
      v.btn.setAttribute('aria-checked', v.i === accused ? 'true' : 'false');
      v.btn.dataset.struck = struck[v.i] ? '1' : '0';
      v.btn.setAttribute('aria-label',
        T('ariaPouch', { name: sealName(v.i), label: labelOf(pouch) })
        + (struck[v.i] ? T('ariaStruck') : '') + (v.i === accused ? T('ariaNamed') : ''));
      paintPouch(v);
    });
    beamViews.forEach(paintBeam);
    submitBtn.disabled = ctx.solved || accused < 0;
  }

  // ---- layout ------------------------------------------------------------
  const RACK_PAD = 16;

  function relayout() {
    // the wrap's own content box, not the root's padded clientWidth — the two
    // weighings must be able to stand side by side without wrapping
    const avail = Math.max(280, Math.round(wrap.getBoundingClientRect().width) || 360);
    const inner = Math.min(avail, 920);

    // the ask plate spans the board: a carved lintel over the corner
    ask.style.maxWidth = `${inner - 44}px`;
    fitCanvas(askHost, askWood, inner, Math.max(42, ask.getBoundingClientRect().height || 44));
    paintAskPlate();

    // the two weighings: side by side where there is room, stacked on a phone
    const two = inner >= 700;
    const bw = two ? Math.floor((inner - 14) / 2) : inner;
    const bh = Math.round(bw * 0.53);
    beamViews.forEach((view) => {
      fitCanvas(view.host, view.gfx, bw, bh);
      view.gfx.canvas.setAttribute('role', 'img');
      view.gfx.canvas.setAttribute('aria-label', T('ariaWeighing', {
        ord: ordWord(view.k),
        left: view.w.left.map(sealName).join(', '),
        right: view.w.right.map(sealName).join(', '),
        aside: view.w.aside.map(sealName).join(', '),
        sink: sinkWord(view.w.tilt),
      }));
      bakeBack(view);
    });

    fitCanvas(ruleHost, rule, Math.min(300, Math.max(190, inner * 0.34)), 42);
    rule.canvas.setAttribute('role', 'img');
    rule.canvas.setAttribute('aria-label', T('ariaRule'));
    paintRule();

    // the rack: six niches on one shelf where there is room, else three by three
    const cols = inner >= 660 ? COUNT : 3;
    const gap = cols === COUNT ? 6 : 10;
    const cellW = Math.max(64, Math.floor((inner - gap * (cols - 1)) / cols));
    grid.style.gridTemplateColumns = `repeat(${cols}, ${cellW}px)`;
    grid.style.gap = `${gap}px`;
    const cw = cellW - 4;
    const chh = Math.round(cw * (cols === COUNT ? 1.06 : 0.98));
    pouchViews.forEach((v) => {
      fitCanvas(v.gfxHost, v.gfx, cw, chh);
      v.gfx.canvas.setAttribute('aria-hidden', 'true');
      v.btn.style.setProperty('--sh', `${Math.round(chh * 0.79)}px`);
      v.tag.style.fontSize = cols === COUNT ? '11px' : '12px';
      v.tag.style.width = `${cellW}px`;
    });

    render();

    // the rack backdrop is measured off the real niches, so it can never drift
    const wr = rackWrap.getBoundingClientRect();
    const gr = grid.getBoundingClientRect();
    if (gr.width > 0) {
      fitCanvas(rackHost, rackWood, gr.width + RACK_PAD * 2, gr.height + RACK_PAD * 2);
      rackHost.style.left = `${Math.round(gr.left - wr.left - RACK_PAD)}px`;
      rackHost.style.top = `${Math.round(gr.top - wr.top - RACK_PAD)}px`;
      // the niches are measured off the pouch canvases, so the shelf lands
      // under the pouches and the written tags sit on the rack face below
      const cells = pouchViews.map((v) => {
        const b = v.gfx.canvas.getBoundingClientRect();
        const f = v.btn.getBoundingClientRect();
        return {
          x: b.left - gr.left + RACK_PAD, y: b.top - gr.top + RACK_PAD, w: b.width, h: b.height,
          fx: f.left - gr.left + RACK_PAD, fw: f.width, fb: f.bottom - gr.top + RACK_PAD,
        };
      });
      paintRack(cells, RACK_PAD);
    }
  }

  function paintAskPlate() {
    if (!askWood.ctx) return;
    const c = askWood.ctx;
    const { w: W, h: H } = askWood;
    c.clearRect(0, 0, W, H);
    art.paintPanel(c, 0, 0, W, H, { title: null, nails: false, wash: 0.55 });
    art.chipBorder(c, 6, 5, W - 12, H - 10, { size: Math.max(6, H * 0.2), alpha: 0.7 });
    const r = Math.min(11, H * 0.28);
    art.rosette(c, r + 5, H / 2, r, { alpha: 0.85 });
    art.rosette(c, W - r - 5, H / 2, r, { alpha: 0.85 });
    art.ornament(c, 'nailhead', 5, 5, 7);
    art.ornament(c, 'nailhead', W - 5, 5, 7);
    art.ornament(c, 'nailhead', 5, H - 5, 7);
    art.ornament(c, 'nailhead', W - 5, H - 5, 7);
  }

  // ---- (2) the showing: a ghost hand lifts a pouch and sets it back -------
  function paintGhost(stillDiagram) {
    if (!ghost.ctx) return;
    const c = ghost.ctx;
    const { w, h } = ghost;
    c.clearRect(0, 0, w, h);
    // a hand of gold reaching in from the right and closing on the cord: wrist,
    // palm, four fingers wrapping the neck, thumb under. The pouch stays visible.
    const ny = h * 0.34;
    const u = Math.min(w, h) * 0.095;
    const px = w * 0.5;
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    art.glow(c, px, ny, u * 4.4, p.goldBright, 0.3);
    c.strokeStyle = rgbaHex(p.goldBright, 0.4);
    c.lineWidth = u * 1.6;
    c.beginPath();
    c.moveTo(px + u * 4.6, ny - u * 2.4);
    c.lineTo(px + u * 1.7, ny - u * 0.4);
    c.stroke();
    c.fillStyle = rgbaHex(p.goldBright, 0.24);
    c.strokeStyle = rgbaHex(p.goldBright, 0.85);
    c.lineWidth = Math.max(1.2, u * 0.3);
    c.beginPath();
    c.moveTo(px + u * 0.5, ny - u * 1.6);
    c.quadraticCurveTo(px + u * 2.7, ny - u * 1.7, px + u * 2.6, ny + u * 0.3);
    c.quadraticCurveTo(px + u * 2.4, ny + u * 1.9, px + u * 0.3, ny + u * 1.6);
    c.quadraticCurveTo(px - u * 0.7, ny, px + u * 0.5, ny - u * 1.6);
    c.closePath();
    c.fill();
    c.stroke();
    c.lineWidth = Math.max(1.1, u * 0.44);
    for (let i = 0; i < 4; i++) {
      const fy = ny - u * 1.05 + i * u * 0.8;
      c.beginPath();
      c.moveTo(px + u * 2, fy);
      c.quadraticCurveTo(px - u * 0.9, fy + u * 0.12, px - u * 1.5, fy + u * 0.55);
      c.stroke();
    }
    c.lineWidth = Math.max(1.2, u * 0.5);
    c.beginPath();
    c.moveTo(px + u * 1.7, ny + u * 1.7);
    c.quadraticCurveTo(px + u * 0.1, ny + u * 2, px - u * 1.1, ny + u * 1.3);
    c.stroke();
    if (stillDiagram) {
      // reduced motion: the same lesson, held still — up, then back down
      c.strokeStyle = rgbaHex(p.goldBright, 0.9);
      c.lineWidth = 2;
      if (c.setLineDash) c.setLineDash([5, 4]);
      c.beginPath();
      c.moveTo(px - w * 0.34, h * 0.72); c.lineTo(px - w * 0.34, h * 0.2);
      c.moveTo(px + w * 0.34, h * 0.2); c.lineTo(px + w * 0.34, h * 0.72);
      c.stroke();
      if (c.setLineDash) c.setLineDash([]);
      for (const [ax, ay, dir] of [[px - w * 0.34, h * 0.2, -1], [px + w * 0.34, h * 0.72, 1]]) {
        c.beginPath();
        c.moveTo(ax - w * 0.05, ay + dir * h * 0.08);
        c.lineTo(ax, ay);
        c.lineTo(ax + w * 0.05, ay + dir * h * 0.08);
        c.stroke();
      }
    }
    c.restore();
  }

  function endShowing(quiet) {
    for (const m of motions) { try { m.cancel(); } catch (e) { /* already gone */ } }
    motions = [];
    if (ghostHost.style.display === 'none') return;
    ghostHost.style.display = 'none';
    skipBtn.style.display = 'none';
    if (!quiet && status.textContent === T('demoSay')) status.textContent = '';
  }

  function takeTheChisel() {
    if (touched) return;
    touched = true;
    endShowing(true);
  }

  function showTheWay() {
    if (ctx.solved || touched) return;
    const v = pouchViews[0];
    const wr = rackWrap.getBoundingClientRect();
    const b = v.gfxHost.getBoundingClientRect();
    if (!b.width || !wr.width) return;
    fitCanvas(ghostHost, ghost, b.width, b.height);
    paintGhost(calm);
    ghostHost.style.display = 'block';
    const x = Math.round(b.left - wr.left);
    const y = Math.round(b.top - wr.top);
    ghostHost.style.transform = `translate(${x}px,${y}px)`;
    skipBtn.style.display = '';
    status.textContent = T('demoSay');

    if (!calm && typeof ghostHost.animate === 'function') {
      const lift = Math.round(b.height * 0.22);
      const m = ghostHost.animate([
        { transform: `translate(${x}px,${y}px)`, opacity: 0 },
        { transform: `translate(${x}px,${y}px)`, opacity: 1, offset: 0.16 },
        { transform: `translate(${x}px,${y - lift}px)`, opacity: 1, offset: 0.44 },
        { transform: `translate(${x}px,${y - lift}px)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${x}px,${y}px)`, opacity: 1, offset: 0.86 },
        { transform: `translate(${x}px,${y}px)`, opacity: 0 },
      ], { duration: 2700, easing: 'ease-in-out' });
      motions.push(m);
      // the pouch itself answers the ghost, so the lesson is the real object
      if (typeof v.gfxHost.animate === 'function') {
        motions.push(v.gfxHost.animate([
          { transform: 'translateY(0)' },
          { transform: 'translateY(0)', offset: 0.16 },
          { transform: `translateY(${-lift}px)`, offset: 0.44 },
          { transform: `translateY(${-lift}px)`, offset: 0.6 },
          { transform: 'translateY(0)', offset: 0.86 },
          { transform: 'translateY(0)' },
        ], { duration: 2700, easing: 'ease-in-out' }));
      }
    }
    later(() => endShowing(false), 3000);
  }

  // ---- interaction -------------------------------------------------------
  function accuse(i) {
    takeTheChisel();
    accused = i;
    nearWeighing = -1;
    pouchViews.forEach((v) => v.btn.setAttribute('tabindex', v.i === i ? '0' : '-1'));
    sfx('tick');
    render();
    const line = T('namedLine', { name: sealName(i) });
    status.textContent = line;
    say(line);
  }

  function strike(i) {
    takeTheChisel();
    struck[i] = !struck[i];
    nearWeighing = -1;
    sfx(struck[i] ? 'knock' : 'tick');
    render();
    const line = struck[i]
      ? T('struckLine', { name: sealName(i) })
      : T('backLine', { name: sealName(i) });
    status.textContent = line;
    say(line);
  }

  pouchViews.forEach((v) => {
    on(v.btn, 'click', () => { if (!ctx.solved) accuse(v.i); });
    on(v.btn, 'keydown', (ev) => {
      if (ctx.solved) return;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
        ev.preventDefault();
        const n = pouchViews[(v.i + 1) % pouchViews.length];
        n.btn.focus(); accuse(n.i);
      } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        const n = pouchViews[(v.i - 1 + pouchViews.length) % pouchViews.length];
        n.btn.focus(); accuse(n.i);
      } else if (ev.key === ' ' || ev.key === 'Spacebar' || ev.key === 'Enter') {
        ev.preventDefault(); accuse(v.i);
      } else if (ev.key === 'x' || ev.key === 'X') {
        ev.preventDefault(); strike(v.i);
      }
    });
    on(v.btn, 'focus', () => {
      endShowing(true);
      if (keysSaid) return;
      keysSaid = true;
      say(T('keysNote'));
    });
  });

  on(reckon, 'click', () => {
    takeTheChisel();
    inErtog = !inErtog;
    nearWeighing = -1;
    reckon.textContent = inErtog ? T('reckonBack') : T('reckon');
    sfx('slide');
    render();
    const line = inErtog ? T('reckonedLine', { n: instance.swornErtog }) : T('carvedLine');
    status.textContent = line;
    say(line);
  });

  on(skipBtn, 'click', () => { takeTheChisel(); pouchViews[0].btn.focus(); });

  // The shell owns the shudder and the deny voice. The board's part is to show
  // WHERE: the weighing whose tilt already speaks against the named pouch.
  function handle(res, sent) {
    if (!res || res.ok) return;
    if (res.near) { status.textContent = res.near; say(res.near); }
    if (Number.isInteger(sent)) {
      nearWeighing = instance.weighings.findIndex((w) => tiltUnder(w, sent) !== w.tilt);
      if (nearWeighing >= 0) beamViews.forEach(paintBeam);
    }
  }

  on(submitBtn, 'click', () => {
    takeTheChisel();
    if (ctx.solved || accused < 0) return;
    sfx('confirm');
    const sent = accused;
    let res;
    try { res = ctx.submit({ pouch: sent }); } catch (e) { return; }
    if (res && typeof res.then === 'function') res.then((r) => handle(r, sent), () => {});
    else handle(res, sent);
  });

  let resizeTimer = 0;
  on(window, 'resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = later(relayout, 140);
  });

  // ---- open the lock -----------------------------------------------------
  relayout();
  later(relayout, 60);       // fonts settle, the ask plate takes its true height
  say(T('openNine', { n: instance.swornErtog }));
  say(T('openClip'));
  instance.weighings.forEach((w, k) => {
    say(T('openWeigh', {
      ord: ordWord(k),
      left: w.left.map(sealName).join(', '),
      right: w.right.map(sealName).join(', '),
      aside: w.aside.map(sealName).join(', '),
      sank: sankWord(w.tilt),
    }));
  });
  if (ctx.solved) {
    submitBtn.disabled = true;
    submitBtn.textContent = T('submitDone');
    status.textContent = T('solvedLine', { name: sealName(accused) });
  } else {
    later(showTheWay, 260);
  }

  return {
    unmount() {
      for (const off of cleanup) off();
      cleanup.length = 0;
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
      for (const m of motions) { try { m.cancel(); } catch (e) { /* already gone */ } }
      motions = [];
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    },
  };
}

// ---------------------------------------------------------------------- i18n
// Additive per-lock block (docs/CONTRACT.md §4.1 amendment). English lives in
// the frozen fields above; `nearMap` keys are the canonical English near-lines.
// The weight units (mark, øre, ertog) are in-fiction artifacts and keep their
// tongue in every language; everything instructional localizes.
const I18N = {
  es: {
    title: 'La Balanza del Bismer',
    epigraph: 'Seis bolsas, un solo peso jurado — y una corre ligera. La balanza ya ha hablado dos veces.',
    hints: [
      'Todas las bolsas están juradas al mismo peso. Convierte las etiquetas a ertog antes de fiarte del ojo: ocho øre al marco, tres ertog al øre.',
      'El platillo que baja lleva la plata más pesada. Una balanza nivelada dice que la bolsa cercenada quedó apartada de esa pesada.',
      'Cada pesada corta las seis en tres: platillo izquierdo, platillo derecho, apartadas. Dos cortes dejan una sola bolsa en pie.',
    ],
    nearMap: {
      'The first weighing already clears that pouch.': 'La primera pesada ya deja limpia esa bolsa.',
      'The second weighing already clears that pouch.': 'La segunda pesada ya deja limpia esa bolsa.',
      'The later weighing already clears that pouch.': 'La pesada posterior ya deja limpia esa bolsa.',
    },
    board: {
      ask: 'Dos pesadas están juradas. Nombra la bolsa ligera.',
      law: 'Cada bolsa está jurada al mismo peso: {n} ertog — un marco son ocho øre, un øre tres ertog. Una bolsa fue cercenada y corre ligera. El platillo que baja lleva la plata más pesada.',
      reckon: 'Contar las etiquetas en ertog',
      reckonBack: 'Leer las etiquetas como fueron talladas',
      help: 'Levanta una bolsa del estante para nombrarla. Con el teclado: flechas para recorrer el estante, espacio para nombrar una, X para tacharla.',
      submit: 'Nombrar la bolsa',
      submitDone: 'La bolsa queda nombrada',
      skip: 'Saltar la muestra',
      demoSay: 'Mira una vez: una bolsa se levanta del estante y se vuelve a posar.',
      setAside: 'apartadas',
      first: 'Primera',
      second: 'Segunda',
      cap: '{ord} pesada — {sink}',
      sinkLeft: 'baja el platillo izquierdo',
      sinkRight: 'baja el platillo derecho',
      sinkLevel: 'el astil queda nivelado',
      sankLeft: 'bajó el platillo izquierdo',
      sankRight: 'bajó el platillo derecho',
      sankLevel: 'el astil quedó nivelado',
      ariaWeighing: 'La {ord} pesada: platillo izquierdo {left}; platillo derecho {right}; apartadas {aside}; {sink}.',
      ariaRule: 'La regla tallada de la cuenta: un marco son ocho øre, un øre tres ertog, así que un marco son veinticuatro ertog.',
      ariaGroup: 'Las seis bolsas en el estante del mercader',
      ariaPouch: 'Bolsa bajo el sello de {name}, jurada en {label}',
      ariaStruck: ', tachada',
      ariaNamed: ', nombrada',
      namedLine: 'Queda nombrada la bolsa bajo el sello de {name}.',
      struckLine: 'La bolsa de {name} queda tachada de la cuenta.',
      backLine: 'La bolsa de {name} vuelve entre las seis.',
      reckonedLine: 'Contadas en ertog, todas las bolsas están juradas en {n}.',
      carvedLine: 'Las etiquetas quedan como fueron talladas.',
      keysNote: 'Con el teclado: las flechas recorren las bolsas; el espacio o Intro nombra una; X la tacha de la cuenta.',
      openNine: 'Seis bolsas, cada una jurada en {n} ertog — un marco son ocho øre, un øre tres ertog.',
      openClip: 'Una bolsa fue cercenada y corre ligera. El platillo que baja lleva la plata más pesada.',
      openWeigh: '{ord} pesada — izquierda: {left}; derecha: {right}; apartadas: {aside}. Y {sank}.',
      solvedLine: 'La plata cercenada estaba bajo el sello de {name}.',
      unitMark: 'marco',
      unitOre: 'øre',
      unitErtog: 'ertog',
    },
  },
  ca: {
    title: 'La Balança del Bismer',
    epigraph: 'Sis bosses, un sol pes jurat — i una corre lleugera. La balança ja ha parlat dues vegades.',
    hints: [
      'Totes les bosses estan jurades al mateix pes. Passa les etiquetes a ertog abans de fiar-te de l’ull: vuit øre al marc, tres ertog a l’øre.',
      'El plat que baixa duu l’argent més pesant. Una balança anivellada diu que la bossa escapçada va quedar a part d’aquella pesada.',
      'Cada pesada talla les sis en tres: plat esquerre, plat dret, a part. Dos talls deixen una sola bossa dempeus.',
    ],
    nearMap: {
      'The first weighing already clears that pouch.': 'La primera pesada ja deixa neta aquella bossa.',
      'The second weighing already clears that pouch.': 'La segona pesada ja deixa neta aquella bossa.',
      'The later weighing already clears that pouch.': 'La pesada posterior ja deixa neta aquella bossa.',
    },
    board: {
      ask: 'Dues pesades estan jurades. Anomena la bossa lleugera.',
      law: 'Cada bossa està jurada al mateix pes: {n} ertog — un marc són vuit øre, un øre tres ertog. Una bossa va ser escapçada i corre lleugera. El plat que baixa duu l’argent més pesant.',
      reckon: 'Comptar les etiquetes en ertog',
      reckonBack: 'Llegir les etiquetes tal com van ser tallades',
      help: 'Alça una bossa del prestatge per anomenar-la. Amb el teclat: fletxes per recórrer el prestatge, espai per anomenar-ne una, X per ratllar-la.',
      submit: 'Anomenar la bossa',
      submitDone: 'La bossa queda anomenada',
      skip: 'Saltar la mostra',
      demoSay: 'Mira-ho un cop: una bossa s’alça del prestatge i es torna a posar.',
      setAside: 'a part',
      first: 'Primera',
      second: 'Segona',
      cap: '{ord} pesada — {sink}',
      sinkLeft: 'baixa el plat esquerre',
      sinkRight: 'baixa el plat dret',
      sinkLevel: 'la biga queda anivellada',
      sankLeft: 'va baixar el plat esquerre',
      sankRight: 'va baixar el plat dret',
      sankLevel: 'la biga va quedar anivellada',
      ariaWeighing: 'La {ord} pesada: plat esquerre {left}; plat dret {right}; a part {aside}; {sink}.',
      ariaRule: 'La regla tallada del compte: un marc són vuit øre, un øre tres ertog, així que un marc són vint-i-quatre ertog.',
      ariaGroup: 'Les sis bosses al prestatge del mercader',
      ariaPouch: 'Bossa sota el segell de {name}, jurada en {label}',
      ariaStruck: ', ratllada',
      ariaNamed: ', anomenada',
      namedLine: 'Queda anomenada la bossa sota el segell de {name}.',
      struckLine: 'La bossa de {name} queda ratllada del compte.',
      backLine: 'La bossa de {name} torna entre les nou.',
      reckonedLine: 'Comptades en ertog, totes les bosses estan jurades en {n}.',
      carvedLine: 'Les etiquetes queden tal com van ser tallades.',
      keysNote: 'Amb el teclat: les fletxes recorren les bosses; l’espai o Retorn n’anomena una; X la ratlla del compte.',
      openNine: 'Sis bosses, cadascuna jurada en {n} ertog — un marc són vuit øre, un øre tres ertog.',
      openClip: 'Una bossa va ser escapçada i corre lleugera. El plat que baixa duu l’argent més pesant.',
      openWeigh: '{ord} pesada — esquerra: {left}; dreta: {right}; a part: {aside}. I {sank}.',
      solvedLine: 'L’argent escapçat era sota el segell de {name}.',
      unitMark: 'marc',
      unitOre: 'øre',
      unitErtog: 'ertog',
    },
  },
};

export default {
  id: '02-bismer',
  ordinal: 2,
  tier: 1,
  title: 'The Bismer Scales',
  epigraph: 'Six pouches, one sworn weight — and one runs light. The beam has already spoken twice.',

  makePuzzle,
  solve,
  verify,
  wrongAnswers,
  shard: () => ({ ...SHARDS['02-bismer'] }),

  difficulty: {
    searchSpace: 6, // six hypotheses; the work is in the ledger, not the search
    minSteps: 8,   // six labels reckoned in ertog + two weighings read
    estMinutes: 2, // ENTRY-CURVE AMENDMENT: measured cold at about ninety seconds
  },

  hints: [
    'Every pouch is sworn to the same weight. Read the labels in ertog before you trust your eye: eight øre to the mark, three ertog to the øre.',
    'The pan that sinks holds the heavier silver. A level beam says the clipped pouch stood aside from that weighing.',
    'Each weighing cuts the six into three — left pan, right pan, set aside. Two cuts leave one pouch standing alone.',
  ],

  i18n: I18N,

  mount,
};
