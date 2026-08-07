// 04 — THE CLINKER STRAKES (tier 2, combination)
//
// Seven planks, seven sworn testimonies of the form "X laps Y" — X rests
// directly upon Y. One shipwright swears falsely. Name the false testimony and
// raise the stack from keel to sheer.
//
// ENTRY-CURVE AMENDMENT (docs/LOCKS.md): seven planks and seven testimonies,
// not nine. The liar-hunt insight is untouched — the ring still closes, the
// rivet law is still the only thing that breaks the tie — but the sort that
// follows it is shorter.
//
// THE TWO LAWS (stated plainly to the player in the journal):
//   lap law   — a strake laps the one below it and no other; seven planks, one stack.
//   rivet law — where two strakes lap, one rivet count is odd and the other even.
//
// Pure half: no DOM, no globals, no Math.random, no Date. Only the seeded rng.
//
// CONSTRUCTION. The six true adjacencies are given, plus one false claim that
// closes the ring: the keel-most plank is sworn to lap the sheer strake. The
// seven claims therefore form a seven-cycle, so *any* one of them may be struck
// out to leave exactly one legal stack — seven structurally identical
// candidates. Only the rivet law separates them: rivet counts alternate parity
// along the true stack, so the false claim joins two planks six apart (even
// distance, same parity — lawless), every true claim joins planks of opposite
// parity, and each of the six decoy stacks is a rotation of the truth that
// breaks parity exactly at its wrap. Exactly one (order, liar) pair survives.
// (The ring-closing lie is lawless only when the plank count is odd — seven is.)
//
// Difficulty accounting: seven testimonies each weighed against the rivet law,
// the false one marked, then seven planks raised into the stack — never fewer
// than twelve acts.

import { SHARDS } from '../kernel/shards.js';

const COUNT = 7;
const PERM_CAP = 5040; // 7! — the whole space, so the sweep is never truncated

const MARKS = [
  'the tarred plank', 'the pale plank', 'the knotted plank',
  'the scarfed plank', 'the salt-white plank', 'the resined plank',
  'the green plank', 'the split plank', 'the burnt plank',
];

const WRIGHTS = [
  'Ozurr', 'Hallvard', 'Steinn', 'Bjorn', 'Onund',
  'Thorir', 'Grim', 'Ketil', 'Sigurd',
];

const ODD_RIVETS = [7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31];
const EVEN_RIVETS = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];

// Every stack consistent with a set of lap claims. A claim forces adjacency, so
// the claims cut the planks into fragments and a stack is a concatenation of
// them; returns [] on a doubled claim or a closed ring.
function stacksFrom(claims, n) {
  const succ = new Array(n).fill(-1);
  const pred = new Array(n).fill(-1);
  for (const t of claims) {
    if (!Number.isInteger(t.over) || !Number.isInteger(t.under)) return [];
    if (t.over < 0 || t.over >= n || t.under < 0 || t.under >= n) return [];
    if (t.over === t.under) return [];
    if (succ[t.under] >= 0 || pred[t.over] >= 0) return [];
    succ[t.under] = t.over;
    pred[t.over] = t.under;
  }

  const frags = [];
  const used = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (pred[i] >= 0) continue;
    const frag = [];
    for (let x = i; x >= 0; x = succ[x]) {
      if (used[x]) return [];
      used[x] = true;
      frag.push(x);
    }
    frags.push(frag);
  }
  if (used.indexOf(false) >= 0) return []; // a ring survives

  const out = [];
  const walk = (left, acc) => {
    if (out.length > PERM_CAP) return;
    if (!left.length) { out.push(acc); return; }
    for (let i = 0; i < left.length; i++) {
      walk(left.slice(0, i).concat(left.slice(i + 1)), acc.concat(left[i]));
    }
  };
  walk(frags, []);
  return out;
}

function alternates(planks, order) {
  for (let i = 1; i < order.length; i++) {
    if (planks[order[i]].rivets % 2 === planks[order[i - 1]].rivets % 2) return false;
  }
  return true;
}

// All (order, liar) pairs answering both laws, over every possible liar.
function sweep(instance) {
  const n = instance.planks.length;
  const found = [];
  let legalDrops = 0;
  for (let k = 0; k < instance.testimonies.length; k++) {
    const rest = instance.testimonies.filter((_, i) => i !== k);
    const stacks = stacksFrom(rest, n);
    if (stacks.length) legalDrops++;
    for (const order of stacks) {
      if (alternates(instance.planks, order)) found.push({ liar: k, order });
    }
  }
  return { found, legalDrops };
}

function makePuzzle(rng) {
  const chain = rng.shuffle([0, 1, 2, 3, 4, 5, 6]); // keel -> sheer
  const marks = rng.shuffle(MARKS);
  const odd = rng.shuffle(ODD_RIVETS);
  const even = rng.shuffle(EVEN_RIVETS);
  const startOdd = rng.chance(0.5);

  const planks = new Array(COUNT);
  let oi = 0, ei = 0;
  chain.forEach((p, k) => {
    const wantOdd = startOdd ? k % 2 === 0 : k % 2 === 1;
    planks[p] = { mark: marks[p], rivets: wantOdd ? odd[oi++] : even[ei++] };
  });

  const claims = [];
  for (let k = 0; k < COUNT - 1; k++) claims.push({ over: chain[k + 1], under: chain[k] });
  claims.push({ over: chain[0], under: chain[COUNT - 1] }); // the ring-closing lie

  const wrights = rng.shuffle(WRIGHTS);
  const testimonies = rng.shuffle(claims).map((c, i) => ({ by: wrights[i], over: c.over, under: c.under }));

  const instance = { planks, testimonies };

  // Exhaustive uniqueness, and proof that the rivet law is genuinely needed.
  const { found, legalDrops } = sweep(instance);
  if (found.length !== 1) return makePuzzle(rng);
  if (legalDrops < 2) return makePuzzle(rng);

  return instance;
}

function solve(instance) {
  const { found } = sweep(instance);
  if (found.length !== 1) return { liar: -1, order: [] };
  return { liar: found[0].liar, order: found[0].order.slice() };
}

function verify(instance, answer) {
  try {
    if (!instance || !Array.isArray(instance.planks) || !Array.isArray(instance.testimonies)) return { ok: false };
    const n = instance.planks.length;
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
    const { order, liar } = answer;
    if (!Array.isArray(order) || order.length !== n) return { ok: false };
    if (!Number.isInteger(liar) || liar < 0 || liar >= instance.testimonies.length) return { ok: false };

    const pos = new Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      const v = order[i];
      if (!Number.isInteger(v) || v < 0 || v >= n || pos[v] >= 0) return { ok: false };
      pos[v] = i;
    }

    const accused = instance.testimonies[liar];
    const lawless = instance.planks[accused.over].rivets % 2 === instance.planks[accused.under].rivets % 2;

    const broken = instance.testimonies.some((t, i) => i !== liar && pos[t.over] !== pos[t.under] + 1);
    const parity = alternates(instance.planks, order);
    if (!broken && parity) return { ok: true };

    if (!lawless) return { ok: false, near: 'That testimony keeps the rivet law. It is no lie.' };
    if (!parity) return { ok: false, near: 'Two strakes of one parity lap in that stack. The rivets forbid it.' };

    const truth = solve(instance).order;
    let stand = 0;
    while (stand < n && order[stand] === truth[stand]) stand++;
    if (stand === 0) return { ok: false, near: 'The garboard is wrong. Nothing above it can stand.' };
    if (stand === 1) return { ok: false, near: 'One strake from the keel stands true. The next does not.' };
    return { ok: false, near: `${stand} strakes from the keel stand true. The next does not.` };
  } catch (e) {
    return { ok: false };
  }
}

function wrongAnswers(instance) {
  const right = solve(instance);
  const n = instance.planks.length;
  const pos = new Array(n).fill(-1);
  right.order.forEach((p, i) => { pos[p] = i; });
  const same = (a) => JSON.stringify(a.order) === JSON.stringify(right.order) && a.liar === right.liar;
  const out = [];

  // The six rotations: each strikes a true testimony and keeps the lie, which
  // is legal by the lap law and lawless by the rivets.
  instance.testimonies.forEach((t, i) => {
    if (i === right.liar) return;
    const m = pos[t.under];
    if (m < 0 || m >= n - 1) return;
    out.push({ order: right.order.slice(m + 1).concat(right.order.slice(0, m + 1)), liar: i });
  });

  // True stack, wrong accusation.
  const otherLiar = right.liar === 0 ? 1 : 0;
  out.push({ order: right.order.slice(), liar: otherLiar });

  // Right accusation, two strakes changed places.
  const swapped = right.order.slice();
  const t2 = swapped[2]; swapped[2] = swapped[3]; swapped[3] = t2;
  out.push({ order: swapped, liar: right.liar });

  // The stack raised upside down.
  out.push({ order: right.order.slice().reverse(), liar: right.liar });

  return out.filter((a) => !same(a));
}

// ------------------------------------------------------------------ the view
//
// THE SHIPWRIGHT'S BAY. The seven strakes stand in a building cradle — two
// carved stocks, cross-battens, wedges — with the finished hull ghosted behind
// them: stem and stern gathering the seven strake lines up out of the keel. The
// shape of the boat is the instruction; the plate only names the act. The seven
// testimonies hang from a wall rail as carved tally-boards, and the one the
// player calls false is BRANDED — blood pigment sunk into a struck gouge.
// Shavings, adze facets and scribe lines carry the dead stretches.
//
// Nothing below touches the pure half: the tally ("N joints lie fair") is
// derived in the view from the current stack against the instance's own
// testimonies and rivet counts — the two laws already carved on the board.

const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";
const MONO = "ui-monospace,'SF Mono',Menlo,monospace";

// Board copy. English is the source; es/ca live in the additive i18n block
// (docs/CONTRACT.md §4.1 amendment) and resolve through it at mount.
const BOARD_EN = {
  submit: 'Raise the stack',
  submitDone: 'The stack stands',
  solvedLine: 'The stack stands from keel to sheer, and the false oath is struck.',
  skip: 'Skip the showing',
  sheer: 'sheer',
  keel: 'keel',
  tally: '{n} of {j} joints lie fair',
  tallyNone: 'No joint lies fair yet',
  tallyAll: 'All {j} joints lie fair.',
  saysLabel: 'The seven testimonies, hung on the rail — brand the false one',
  stackLabel: 'The building cradle: the stack, sheer strake at the top, keel at the foot',
  swears: '{by} swears: {over} laps {under}.',
  rivets: '{a} over {b}',
  countLine: '{n} rivets',
  ariaSay: '{line} Rivets: {rivets}.',
  ariaSayBranded: '{line} Rivets: {rivets}. Branded false.',
  ariaPlank: '{mark}, {rivets} rivets, {place} strake from the keel',
  ariaLifted: ', lifted',
  ariaFair: ', its lap lies fair',
  struck: '{by}’s word is branded false and struck from the ledger.',
  lies: '{mark} lies {place} from the keel.',
  lifted: '{mark} is lifted. The arrows move it; space sets it down.',
  setDown: '{mark} is set down.',
  keysNote: 'By key: on the tally-boards, arrows walk and the walked board is branded; on the planks, '
    + 'space lifts, up and down move what is lifted, space sets it down.',
  openLaw: 'Lap law: a strake laps the one below it and no other. Rivet law: where two strakes lap, '
    + 'one rivet count is odd and the other even.',
  openSwear: '{by} swears: {over} ({a} rivets) laps {under} ({b} rivets).',
  places: ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth'],
};

// Canonical English near-lines returned by the pure half — listed so the
// i18n nearMap below can carry every one of them.
const NEAR_KEEPS = 'That testimony keeps the rivet law. It is no lie.';
const NEAR_PARITY = 'Two strakes of one parity lap in that stack. The rivets forbid it.';
const NEAR_GARBOARD = 'The garboard is wrong. Nothing above it can stand.';
const NEAR_ONE = 'One strake from the keel stands true. The next does not.';
const nearRun = (n) => `${n} strakes from the keel stand true. The next does not.`;

function mount(ctx) {
  const art = ctx.art;
  const p = art.palette;
  const instance = ctx.instance;

  const lang = ctx.lang || 'en';
  const LB = (I18N[lang] && I18N[lang].board) || {};
  const T = (k, params) => {
    let s = LB[k] != null ? LB[k] : BOARD_EN[k];
    if (typeof s !== 'string') return s;
    if (params) for (const kk of Object.keys(params)) s = s.split(`{${kk}}`).join(String(params[kk]));
    return s;
  };
  const PLACES = Array.isArray(LB.places) && LB.places.length === 9 ? LB.places : BOARD_EN.places;
  const MARKS_L = LB.marks || null;
  // The instance's own English mark stays the aria prefix in English (the e2e
  // label contract); es/ca swap in their own name on both surfaces at once.
  const markOf = (i) => (MARKS_L && MARKS_L[instance.planks[i].mark]) || instance.planks[i].mark;
  const NEARMAP = (I18N[lang] && I18N[lang].nearMap) || null;
  const localNear = (s) => (NEARMAP && NEARMAP[s]) || s;

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
  const reduced = () => {
    try { return !!(globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  };
  const calm = reduced();
  const node = (tag, css, text) => {
    const n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  };

  // Deterministic per-plank / per-board micro-noise (view-only).
  const h32 = (n) => {
    let x = (n | 0) + 0x9e3779b9;
    x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
    x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
    return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
  };

  // hex mixer for plank washes (the frozen art API exposes tokens, not colour math)
  const mixHex = (a, b, t) => {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const chn = (sa, sb) => Math.round(sa + (sb - sa) * t);
    const r = chn(pa >> 16, pb >> 16);
    const g = chn((pa >> 8) & 255, (pb >> 8) & 255);
    const bl = chn(pa & 255, pb & 255);
    return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
  };

  const roundPath = (c, x, y, w, h, r) => {
    const rr = Math.max(1, Math.min(r, Math.min(w, h) / 2));
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  };

  // A curled shaving off the adze — two lit ribbons round a tar core. The
  // signature of a floor that has been worked, laid only in the dead zones.
  const shaving = (c, x, y, len, curl, seed, alpha) => {
    c.save();
    c.globalAlpha = alpha;
    c.lineCap = 'round';
    for (const [off, col, wdt, a] of [
      [0, p.tar, 3.2, 0.55], [-0.9, mixHex(p.oakLight, p.bone, 0.35), 1.5, 0.62], [1.1, p.oakDeep, 1.1, 0.4],
    ]) {
      c.globalAlpha = alpha * a;
      c.strokeStyle = col;
      c.lineWidth = wdt;
      c.beginPath();
      c.moveTo(x, y + off);
      for (let i = 1; i <= 16; i++) {
        const t = i / 16;
        const rr = len * (1 - t * 0.62);
        const ang = curl * t * Math.PI * 1.7 + h32(seed) * 0.6;
        c.lineTo(x + Math.cos(ang) * rr * t * 1.5, y + off + Math.sin(ang) * rr * t * 0.62);
      }
      c.stroke();
    }
    c.restore();
  };

  // ---- state (visual stack runs sheer at the top, keel at the foot) -------
  const truth = ctx.solved ? solve(instance) : null;
  const stack = truth ? truth.order.slice().reverse() : instance.planks.map((_, i) => i);
  let accused = truth ? truth.liar : -1;
  let held = -1;
  let keysSaid = false;
  let touched = !!ctx.solved;
  let nearTest = -1;            // a testimony wrongly accused (it keeps the law)
  const nearPlank = new Map();  // plank id -> { tick, brk, tieT, tieB }

  // ---- the two laws, read off the board -----------------------------------
  // A joint LIES FAIR when a sworn testimony puts exactly this plank on exactly
  // that one, and the rivets alternate across the lap. Eight joints; the ring-
  // closing lie can never make one, because its two planks share a parity.
  const claimFor = (below, above) =>
    instance.testimonies.findIndex((t) => t.over === above && t.under === below);
  const jointFair = (below, above) => {
    if (claimFor(below, above) < 0) return false;
    return instance.planks[above].rivets % 2 !== instance.planks[below].rivets % 2;
  };
  // stack[i] sits ON stack[i + 1]
  const fairAbove = (place) => place > 0 && jointFair(stack[place], stack[place - 1]);
  const fairCount = () => {
    let n = 0;
    for (let i = 1; i < stack.length; i++) if (jointFair(stack[i], stack[i - 1])) n++;
    return n;
  };
  const JOINTS = COUNT - 1;

  // ---- frame --------------------------------------------------------------
  const wrap = node('div', `display:grid;gap:8px;font-family:${SERIF};color:${p.bone}`);
  const style = node('style');
  style.textContent = `
    .ow4-cols{display:grid;gap:16px;grid-template-columns:1fr;align-items:stretch}
    .ow4-bay{position:relative;display:flex;flex-direction:column;justify-content:center;padding:26px 0 22px}
    .ow4-baywood{position:absolute;inset:0;pointer-events:none;line-height:0}
    .ow4-rail{position:relative;display:grid;gap:7px;align-content:start;padding:7px 0 12px}
    .ow4-railwood{position:absolute;inset:0;pointer-events:none;line-height:0}
    .ow4-ghost{position:absolute;left:0;top:0;pointer-events:none;z-index:3;line-height:0}
    .ow4-say{position:relative;display:block;width:100%;text-align:left;font-family:${SERIF};
      font-size:13px;line-height:1.36;color:${p.bone};background:none;border:0;border-radius:4px;
      padding:8px 46px 9px 18px;min-height:44px;cursor:pointer;transform-origin:10px 8px;
      transition:transform .14s ease,filter .14s ease;
      filter:drop-shadow(0 3px 3px rgba(12,9,6,.55))}
    .ow4-say .ow4-saywood{position:absolute;inset:0;pointer-events:none;line-height:0;z-index:0}
    .ow4-say > span{position:relative;z-index:1}
    .ow4-say:focus-visible{outline:2px solid ${p.goldBright};outline-offset:3px}
    .ow4-say:hover{filter:drop-shadow(0 4px 5px rgba(12,9,6,.62))}
    .ow4-say[aria-checked="true"]{color:${p.boneDim}}
    .ow4-say[aria-checked="true"] .ow4-line{text-decoration:line-through;text-decoration-color:${p.blood}}
    .ow4-say[data-near="1"]{filter:drop-shadow(0 0 3px rgba(194,92,51,.75)) drop-shadow(0 3px 3px rgba(12,9,6,.55))}
    .ow4-plank{position:relative;display:block;width:100%;text-align:left;background:none;border:0;
      padding:0;cursor:grab;touch-action:none;border-radius:3px;font-family:${SERIF};color:${p.bone};
      min-height:46px;filter:drop-shadow(0 2px 2px rgba(12,9,6,.5));
      transition:transform .12s ease,filter .12s ease}
    .ow4-plank canvas{position:absolute;inset:0;pointer-events:none;z-index:0}
    .ow4-plank > span{position:relative;z-index:1;display:flex;justify-content:space-between;
      align-items:baseline;gap:8px;padding:6px 13px 18px;line-height:22px;font-size:13.5px;
      text-shadow:0 1px 0 rgba(12,9,6,.85)}
    .ow4-plank .ow4-count{font-size:12px;color:${p.boneDim};white-space:nowrap}
    .ow4-plank:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    .ow4-plank[data-held="1"]{cursor:grabbing;transform:translateY(-3px);
      filter:drop-shadow(0 7px 7px rgba(12,9,6,.7))}
    .ow4-skip{font-family:${SERIF};font-size:14px;color:${p.boneDim};background:transparent;
      border:1px solid rgba(90,58,30,.9);border-radius:3px;padding:11px 16px;min-height:44px;cursor:pointer}
    .ow4-skip:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    .ow4-end{position:absolute;left:0;right:0;margin:0;font-size:11.5px;color:${p.boneDim};
      letter-spacing:.16em;text-transform:uppercase;text-align:center;pointer-events:none;z-index:2}
    .ow4-end[data-at="sheer"]{top:7px}
    .ow4-end[data-at="keel"]{bottom:5px}
    @media (prefers-reduced-motion: reduce){
      .ow4-say,.ow4-plank{transition:none}
      .ow4-plank[data-held="1"]{transform:none}
    }
  `;
  wrap.append(style);


  const cols = node('div');
  cols.className = 'ow4-cols';

  const bayWrap = node('div');
  bayWrap.className = 'ow4-bay';
  const bayHost = node('div');
  bayHost.className = 'ow4-baywood';
  bayHost.setAttribute('aria-hidden', 'true');
  const bay = { canvas: null, ctx: null, w: 0, h: 0 };
  const sheerLab = node('p', null, T('sheer'));
  sheerLab.className = 'ow4-end';
  sheerLab.dataset.at = 'sheer';
  const keelLab = node('p', null, T('keel'));
  keelLab.className = 'ow4-end';
  keelLab.dataset.at = 'keel';
  const stackList = node('div', 'position:relative;display:grid;gap:5px;margin:0 auto');
  stackList.setAttribute('role', 'list');
  stackList.setAttribute('aria-label', T('stackLabel'));
  const ghostHost = node('div');
  ghostHost.className = 'ow4-ghost';
  ghostHost.setAttribute('aria-hidden', 'true');
  ghostHost.style.display = 'none';
  const ghost = { canvas: null, ctx: null, w: 0, h: 0 };
  bayWrap.append(bayHost, sheerLab, stackList, keelLab, ghostHost);

  const railWrap = node('div');
  railWrap.className = 'ow4-rail';
  const railHost = node('div');
  railHost.className = 'ow4-railwood';
  railHost.setAttribute('aria-hidden', 'true');
  const rail = { canvas: null, ctx: null, w: 0, h: 0 };
  const sayList = node('div', 'display:grid;gap:9px;align-content:start');
  sayList.setAttribute('role', 'radiogroup');
  sayList.setAttribute('aria-label', T('saysLabel'));
  railWrap.append(railHost, sayList);

  cols.append(bayWrap, railWrap);

  const tallyWrap = node('div', 'display:flex;gap:11px;align-items:center;justify-content:center;flex-wrap:wrap');
  const tallyGfx = art.makeCanvas(178, 24);
  tallyGfx.canvas.setAttribute('aria-hidden', 'true');
  // carved tally marks carry the sighted count; the words stay for readers
  const tallyText = node('p', null);
  tallyText.className = 'visually-hidden';
  tallyWrap.append(tallyGfx.canvas, tallyText);

  const status = node('p', `margin:0;min-height:20px;font-size:14px;color:${p.boneDim};text-align:center`);
  // visual echo only — the shell's .near-line is the single aria-live deny announcer (LOOP5 ruling)

  const actions = node('div', 'display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:center');
  const submitBtn = node('button', null, T('submit'));
  submitBtn.className = 'btn-carved'; // one primary-action language: the carved gold plate
  submitBtn.type = 'button';
  submitBtn.disabled = true;
  const skipBtn = node('button', null, T('skip'));
  skipBtn.className = 'ow4-skip';
  skipBtn.type = 'button';
  skipBtn.style.display = 'none';
  actions.append(submitBtn, skipBtn);

  wrap.append(cols, tallyWrap, actions, status);
  ctx.root.append(wrap);

  // ---- layout -------------------------------------------------------------
  let wide = false;
  let bayW = 320;
  let railW = 320;
  let plankW = 300;
  const PLANK_H = 46;
  const GUTTER = 34;          // the rail beam + its cords

  function measure() {
    const avail = Math.max(258, Math.min(820, (ctx.root.clientWidth || 384) - 24));
    wide = avail >= 640;
    bayW = wide ? Math.round(avail * 0.44) : avail;
    railW = wide ? avail - bayW - 16 : avail;
    plankW = Math.max(198, bayW - Math.max(32, Math.round(bayW * 0.15)) * 2);
    cols.style.gridTemplateColumns = wide ? `${bayW}px 1fr` : '1fr';
  }

  function fitCanvas(holder, target, w, h) {
    const W = Math.max(8, Math.round(w));
    const H = Math.max(8, Math.round(h));
    if (target.canvas && target.w === W && target.h === H && target.canvas.parentNode === holder) return target;
    const fresh = art.makeCanvas(W, H);
    fresh.canvas.setAttribute('aria-hidden', 'true');
    if (target.canvas && target.canvas.parentNode === holder) holder.replaceChild(fresh.canvas, target.canvas);
    else holder.append(fresh.canvas);
    target.canvas = fresh.canvas;
    target.ctx = fresh.ctx;
    target.w = W;
    target.h = H;
    return target;
  }

  // ---- the bay: cradle, ghosted hull, shavings -----------------------------
  let rowYs = [];       // plank row centres, bay-local
  let stackBox = null;  // the stack's box, bay-local

  function paintBay() {
    if (!bay.ctx || !stackBox) return;
    const c = bay.ctx;
    const { w, h } = bay;
    c.clearRect(0, 0, w, h);
    art.paintWood(c, w, h, 4042);
    c.save();
    c.fillStyle = 'rgba(12,9,6,.42)';
    c.fillRect(0, 0, w, h);
    c.restore();

    const cx = w / 2;
    const halfSpan = w * 0.455;
    // The ghost is a whole boat, not a copy of the stack: its sheer runs ABOVE
    // the top plank and its keel BELOW the bottom one, so the seven planks sit
    // inside the shape they are going to become.
    const midTop = stackBox.y - 17;
    const midBot = stackBox.y + stackBox.h + 15;
    const span = Math.max(20, midBot - midTop);
    const rise = Math.max(12, Math.min(midTop - 30, span * 0.46));
    const postTop = midTop - rise;
    const postSpan = span * 0.24;
    const endY = (i) => postTop + (i / (COUNT - 1)) * postSpan;
    const midY = (i) => midTop + (i / (COUNT - 1)) * span;
    const strakeY = (i, x) => {
      const u = Math.min(1, Math.abs(x - cx) / halfSpan);
      const k = u * u;
      return midY(i) * (1 - k) + endY(i) * k;
    };

    // THE GHOSTED HULL — the shape of the finished boat, cut faint. Stem and
    // stern gather all seven strakes up out of the keel; this is the silent
    // instruction, subordinate to every real thing on the board.
    c.save();
    c.lineCap = 'round';
    for (let i = 0; i < COUNT; i++) {
      const lead = i === 0 || i === COUNT - 1;
      for (const [col, wdt, alpha, dy] of lead
        ? [[p.tar, 4.2, 0.5, 1.3], [p.bone, 1.9, 0.26, 0]]
        : [[p.tar, 3, 0.3, 1.1], [p.bone, 1.2, 0.15, 0]]) {
        c.strokeStyle = col;
        c.lineWidth = wdt;
        c.globalAlpha = alpha;
        c.beginPath();
        for (let s = 0; s <= 40; s++) {
          const x = cx - halfSpan + (s / 40) * halfSpan * 2;
          const y = strakeY(i, x) + dy;
          if (s === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.stroke();
      }
    }
    // stem and stern posts, and the carved head each one carries
    for (const dir of [-1, 1]) {
      const x = cx + dir * halfSpan;
      for (const [col, wdt, alpha, dx] of [[p.tar, 4.4, 0.46, 1.2], [p.bone, 2, 0.26, 0]]) {
        c.strokeStyle = col;
        c.globalAlpha = alpha;
        c.lineWidth = wdt;
        c.beginPath();
        c.moveTo(x + dx * dir, endY(COUNT - 1) + 5);
        c.quadraticCurveTo(x + dir * 11 + dx * dir, endY(0) + 5, x + dir * 5 + dx * dir, endY(0) - 17);
        c.stroke();
        c.beginPath();
        c.arc(x + dir * 5, endY(0) - 22, 6, 0, Math.PI * 1.75);
        c.stroke();
      }
    }
    // the keel below the garboard, and the wale that ties the sheer
    for (const [i, off, alpha] of [[COUNT - 1, 7, 0.24], [0, -6, 0.2]]) {
      c.strokeStyle = p.bone;
      c.globalAlpha = alpha;
      c.lineWidth = 1.4;
      c.beginPath();
      for (let s = 0; s <= 34; s++) {
        const x = cx - halfSpan * 0.94 + (s / 34) * halfSpan * 1.88;
        const y = strakeY(i, x) + off;
        if (s === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
    c.restore();

    // waterline scribe: the setting-out the shipwright struck across the bay
    c.save();
    c.strokeStyle = 'rgba(233,220,195,.07)';
    c.lineWidth = 0.9;
    const wl = midY(COUNT - 2) + 6;
    c.beginPath();
    for (let x = 6; x <= w - 6; x += 22) c.lineTo(x, wl + Math.sin(x * 0.06) * 0.9);
    c.stroke();
    c.restore();

    // THE CRADLE — two carved stocks flanking the stack, cross-battened, wedged.
    const postW = Math.max(10, Math.min(15, (w - stackBox.w) / 2 - 14));
    const postTopY = stackBox.y - 9;
    const postH = stackBox.h + 20;
    for (const dir of [-1, 1]) {
      const px = dir < 0 ? stackBox.x - 7 - postW : stackBox.x + stackBox.w + 7;
      c.save();
      const g = c.createLinearGradient(px, 0, px + postW, 0);
      g.addColorStop(0, mixHex(p.oak, p.oakDeep, 0.35));
      g.addColorStop(0.34, p.oakLight);
      g.addColorStop(1, p.oakDeep);
      c.fillStyle = g;
      c.fillRect(px, postTopY, postW, postH);
      // grain down the stock
      c.lineWidth = 1;
      for (let k = 0; k < 5; k++) {
        const gx = px + 1.5 + h32(k * 13 + dir * 7) * (postW - 3);
        c.strokeStyle = k % 2 ? p.oakDeep : p.oakLight;
        c.globalAlpha = 0.16 + h32(k * 23) * 0.12;
        c.beginPath();
        c.moveTo(gx, postTopY + 2);
        c.bezierCurveTo(gx + 2, postTopY + postH * 0.4, gx - 2, postTopY + postH * 0.7, gx, postTopY + postH - 2);
        c.stroke();
      }
      c.globalAlpha = 1;
      c.strokeStyle = 'rgba(12,9,6,.9)';
      c.lineWidth = 1.4;
      c.strokeRect(px + 0.7, postTopY + 0.7, postW - 1.4, postH - 1.4);
      c.strokeStyle = 'rgba(238,207,109,.14)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(px + postW - 1.6, postTopY + 2); c.lineTo(px + postW - 1.6, postTopY + postH - 2);
      c.stroke();
      c.restore();
      if (typeof art.chipBorder === 'function' && postH > 90) {
        art.chipBorder(c, px + 2, postTopY + 6, postW - 4, postH - 12, { size: Math.max(5, postW * 0.42), alpha: 0.34 });
      }
      // iron pegs holding the stock, and the wedge driven under its foot
      for (const ry of [postTopY + 10, postTopY + postH / 2, postTopY + postH - 10]) {
        art.ornament(c, 'nailhead', px + postW / 2, ry, Math.max(6, postW * 0.55));
      }
      c.save();
      c.fillStyle = mixHex(p.oakLight, p.oakDeep, 0.3);
      c.beginPath();
      c.moveTo(px - dir * 2, postTopY + postH);
      c.lineTo(px + postW + dir * 5, postTopY + postH);
      c.lineTo(px + postW / 2, postTopY + postH + 9);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(12,9,6,.8)';
      c.lineWidth = 1;
      c.stroke();
      c.restore();
      if (typeof art.rosette === 'function' && postH > 150) {
        art.rosette(c, px + postW / 2, postTopY + postH * 0.26, Math.max(4.5, postW * 0.34), { alpha: 0.5 });
      }
    }

    // the sole-piece the keel rests on, and the raking braces off each stock —
    // a building cradle, not a picture frame
    c.save();
    const soleY = stackBox.y + stackBox.h + 5;
    const bx0 = stackBox.x - 9 - postW;
    const bx1 = stackBox.x + stackBox.w + 9 + postW;
    const sg = c.createLinearGradient(0, soleY, 0, soleY + 9);
    sg.addColorStop(0, p.oakLight);
    sg.addColorStop(0.4, p.oak);
    sg.addColorStop(1, p.oakDeep);
    c.fillStyle = sg;
    c.fillRect(bx0, soleY, bx1 - bx0, 9);
    c.strokeStyle = 'rgba(12,9,6,.88)';
    c.lineWidth = 1.2;
    c.strokeRect(bx0 + 0.6, soleY + 0.6, bx1 - bx0 - 1.2, 7.8);
    c.strokeStyle = 'rgba(238,207,109,.16)';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(bx0 + 3, soleY + 1.6); c.lineTo(bx1 - 3, soleY + 1.6); c.stroke();
    // raking braces: each stock is stayed back to the sole
    for (const dir of [-1, 1]) {
      const px = dir < 0 ? stackBox.x - 9 - postW / 2 : stackBox.x + stackBox.w + 9 + postW / 2;
      for (const [col, wdt, a] of [[p.tar, 6, 0.75], [mixHex(p.oak, p.oakLight, 0.5), 3.4, 0.9]]) {
        c.strokeStyle = col;
        c.lineWidth = wdt;
        c.globalAlpha = a;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(px, postTopY + postH * 0.36);
        c.lineTo(px + dir * (postW * 0.4 + Math.min(22, (w - stackBox.w) / 2 - postW - 12)), soleY - 1);
        c.stroke();
      }
      c.globalAlpha = 1;
      art.ornament(c, 'nailhead', px, postTopY + postH * 0.36, Math.max(6, postW * 0.5));
    }
    c.restore();

    // shavings and tool history in what is left
    const seedBase = 91;
    for (let k = 0; k < 7; k++) {
      const left = k % 2 === 0;
      const sx = left ? 4 + h32(seedBase + k) * Math.max(6, stackBox.x - 20)
        : stackBox.x + stackBox.w + 14 + h32(seedBase + k * 3) * Math.max(6, w - stackBox.x - stackBox.w - 22);
      const sy = h - 8 - h32(seedBase + k * 5) * Math.min(52, h * 0.16);
      shaving(c, sx, sy, 9 + h32(seedBase + k * 7) * 8, left ? 1 : -1, seedBase + k, 0.5);
    }
    for (let k = 0; k < 3; k++) {
      shaving(c, 6 + h32(k * 31) * (w - 14), 8 + h32(k * 37) * 16, 7 + h32(k * 41) * 5, k % 2 ? 1 : -1, k * 3, 0.35);
    }
    if (typeof art.wear === 'function') {
      art.wear(c, w, h, 4043, { avoid: { x: stackBox.x - 10, y: stackBox.y - 10, w: stackBox.w + 20, h: stackBox.h + 20 } });
    }
    // the bay's own edge, so the boards do not simply stop
    c.save();
    c.strokeStyle = 'rgba(12,9,6,.7)';
    c.lineWidth = 2;
    c.strokeRect(1, 1, w - 2, h - 2);
    c.restore();
  }

  // ---- the rail: a wall batten with iron pegs and hanging cords ------------
  let pegYs = [];

  function paintRail() {
    if (!rail.ctx) return;
    const c = rail.ctx;
    const { w, h } = rail;
    c.clearRect(0, 0, w, h);
    art.paintWood(c, w, h, 4044);
    c.save();
    c.fillStyle = 'rgba(12,9,6,.46)';
    c.fillRect(0, 0, w, h);
    c.restore();

    const bx = 5;
    const bw = 19;
    c.save();
    const g = c.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, mixHex(p.oak, p.oakDeep, 0.4));
    g.addColorStop(0.36, p.oakLight);
    g.addColorStop(1, p.oakDeep);
    c.fillStyle = g;
    c.fillRect(bx, 0, bw, h);
    c.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      const gx = bx + 1.6 + h32(k * 17 + 3) * (bw - 3.2);
      c.strokeStyle = k % 2 ? p.oakDeep : p.oakLight;
      c.globalAlpha = 0.15 + h32(k * 29) * 0.12;
      c.beginPath();
      c.moveTo(gx, 2);
      c.bezierCurveTo(gx + 2.4, h * 0.35, gx - 2.4, h * 0.7, gx, h - 2);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.strokeStyle = 'rgba(12,9,6,.9)';
    c.lineWidth = 1.4;
    c.strokeRect(bx + 0.7, 0.7, bw - 1.4, h - 1.4);
    c.strokeStyle = 'rgba(238,207,109,.15)';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(bx + bw - 1.6, 2); c.lineTo(bx + bw - 1.6, h - 2); c.stroke();
    c.restore();
    if (typeof art.chipBorder === 'function' && h > 120) {
      art.chipBorder(c, bx + 2, 8, bw - 4, h - 16, { size: 7.5, alpha: 0.34 });
    }

    // one iron peg per board, and the leather thong that carries it
    pegYs.forEach((py, i) => {
      art.ornament(c, 'nailhead', bx + bw / 2, py, 11);
      c.save();
      c.lineCap = 'round';
      for (const [col, wdt, a, off] of [[p.tar, 3.4, 0.62, 1], [mixHex(p.oakLight, p.bone, 0.2), 1.5, 0.5, 0]]) {
        c.strokeStyle = col;
        c.lineWidth = wdt;
        c.globalAlpha = a;
        c.beginPath();
        c.moveTo(bx + bw / 2 + 2, py + off);
        c.quadraticCurveTo(bx + bw + 6, py + 8 + off, GUTTER - 2, py + 6 + off + (i % 2 ? 1 : -1));
        c.stroke();
      }
      c.restore();
    });

    // shavings gathering at the foot of the wall, and the quiet tool history
    for (let k = 0; k < 5; k++) {
      shaving(c, 6 + h32(k * 13 + 5) * (GUTTER - 12), h - 8 - h32(k * 19) * Math.min(46, h * 0.12),
        7 + h32(k * 23) * 6, k % 2 ? 1 : -1, k * 11 + 2, 0.45);
    }
    if (typeof art.wear === 'function') {
      art.wear(c, w, h, 4045, { avoid: { x: GUTTER - 6, y: -10, w: w - GUTTER + 12, h: h + 20 } });
    }
    c.save();
    c.strokeStyle = 'rgba(12,9,6,.7)';
    c.lineWidth = 2;
    c.strokeRect(1, 1, w - 2, h - 2);
    c.restore();
  }

  // ---- the tally-boards ---------------------------------------------------
  const sayViews = instance.testimonies.map((t, k) => {
    const btn = node('button');
    btn.className = 'ow4-say';
    btn.type = 'button';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', 'false');
    btn.setAttribute('tabindex', k === 0 ? '0' : '-1');
    btn.style.transform = `rotate(${((h32(k * 71) - 0.5) * 1.1).toFixed(2)}deg)`;
    const woodHost = node('div');
    woodHost.className = 'ow4-saywood';
    woodHost.setAttribute('aria-hidden', 'true');
    const line = T('swears', { by: t.by, over: markOf(t.over), under: markOf(t.under) });
    const rivets = T('rivets', { a: instance.planks[t.over].rivets, b: instance.planks[t.under].rivets });
    const lineSpan = node('span', null, line);
    lineSpan.className = 'ow4-line';
    const holder = node('span');
    holder.append(lineSpan, node('span', `font-family:${MONO};font-size:12px;color:${p.boneDim}`, ' ' + rivets));
    btn.append(woodHost, holder);
    sayList.append(btn);
    return { k, btn, woodHost, gfx: { canvas: null, ctx: null, w: 0, h: 0 }, line, rivets, key: '' };
  });

  function paintSay(v) {
    if (!v.gfx.ctx) return;
    const isAccused = accused === v.k;
    const isNear = nearTest === v.k;
    const key = `${isAccused}|${isNear}|${v.gfx.w}x${v.gfx.h}`;
    if (v.key === key) return;
    v.key = key;
    const c = v.gfx.ctx;
    const { w, h } = v.gfx;
    c.clearRect(0, 0, w, h);

    // the board: ONE sawn slab of oak (not a wall — the shared paintWood lays
    // board courses, which at this size read as masonry), hung face-out
    c.save();
    roundPath(c, 0.5, 0.5, w - 1, h - 1, 4);
    c.clip();
    const base = c.createLinearGradient(0, 0, w * 0.35, h);
    base.addColorStop(0, mixHex(p.oak, p.oakLight, 0.34));
    base.addColorStop(0.55, p.oak);
    base.addColorStop(1, mixHex(p.oak, p.oakDeep, 0.6));
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    // grain running the board's length, with the wander of a riven face
    c.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      const gy = 2 + h32(v.k * 31 + k) * (h - 4);
      const sway = (h32(v.k * 37 + k) - 0.5) * 6;
      c.strokeStyle = k % 3 === 0 ? p.oakLight : p.oakDeep;
      c.globalAlpha = 0.12 + h32(v.k * 41 + k) * 0.13;
      c.lineWidth = 0.8 + h32(v.k * 43 + k) * 1.5;
      c.beginPath();
      c.moveTo(-3, gy);
      c.bezierCurveTo(w * 0.3, gy + sway, w * 0.7, gy - sway, w + 3, gy + sway * 0.4);
      c.stroke();
    }
    // adze facets: the broad planing sweeps, kept faint
    for (let k = 0; k < 3; k++) {
      c.strokeStyle = k % 2 ? p.oakLight : p.oakDeep;
      c.globalAlpha = 0.055 + h32(v.k * 47 + k) * 0.045;
      c.lineWidth = 9 + h32(v.k * 53 + k) * 6;
      const yy = 4 + h32(v.k * 59 + k) * (h - 8);
      c.beginPath();
      c.moveTo(-4, yy);
      c.quadraticCurveTo(w * 0.5, yy + (h32(v.k * 61 + k) - 0.5) * 8, w + 4, yy + (h32(v.k * 67 + k) - 0.5) * 6);
      c.stroke();
    }
    // pore stipple — the third material layer
    for (let k = 0; k < 46; k++) {
      c.fillStyle = h32(v.k * 71 + k) > 0.55 ? p.oakDeep : p.tar;
      c.globalAlpha = 0.08 + h32(v.k * 73 + k) * 0.13;
      c.fillRect(h32(v.k * 79 + k) * w, h32(v.k * 83 + k) * h, 1.2, 0.9);
    }
    // the light falls from upper-left, as it does everywhere in this hall
    c.globalAlpha = 1;
    const shade = c.createLinearGradient(0, 0, w * 0.2, h);
    shade.addColorStop(0, 'rgba(12,9,6,.02)');
    shade.addColorStop(0.55, 'rgba(12,9,6,.28)');
    shade.addColorStop(1, 'rgba(12,9,6,.5)');
    c.fillStyle = shade;
    c.fillRect(0, 0, w, h);
    c.restore();

    if (typeof art.chipBorder === 'function') {
      art.chipBorder(c, 4, 3.5, w - 8, h - 7, { size: 7.5, alpha: 0.6 });
    }
    if (typeof art.insetFace === 'function') {
      art.insetFace(c, 2, 2, w - 4, h - 4, { depth: 0.3, lipLight: 0.16 });
    }

    // the board's edge: tar seat, lit lower lip
    c.save();
    c.strokeStyle = 'rgba(12,9,6,.9)';
    c.lineWidth = 1.5;
    roundPath(c, 1, 1, w - 2, h - 2, 4);
    c.stroke();
    c.strokeStyle = 'rgba(238,207,109,.2)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(4, h - 2.2); c.lineTo(w - 4, h - 2.2);
    c.stroke();
    c.restore();

    // the ear the thong runs through, and the second peg-hole below it
    c.save();
    c.fillStyle = 'rgba(12,9,6,.85)';
    c.beginPath(); c.arc(9, 8, 3.1, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(238,207,109,.3)';
    c.lineWidth = 1;
    c.beginPath(); c.arc(9, 8.6, 3.4, 0.15, Math.PI - 0.15); c.stroke();
    c.restore();
    art.ornament(c, 'nailhead', w - 9, h - 8, 7);

    // tally notches down the left margin: this board is the wright's own count
    c.save();
    c.lineCap = 'round';
    const notches = Math.min(6, 2 + (v.k % 5));
    for (let i = 0; i < notches; i++) {
      const ny = 17 + i * ((h - 30) / Math.max(1, notches - 1 || 1));
      if (ny > h - 9) break;
      c.strokeStyle = 'rgba(12,9,6,.72)';
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(6, ny); c.lineTo(13, ny - 3.2); c.stroke();
      c.strokeStyle = 'rgba(238,207,109,.22)';
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(6, ny + 1.4); c.lineTo(13, ny - 1.8); c.stroke();
    }
    c.restore();

    // THE BRAND — a struck gouge with blood pigment sunk in it, the way the
    // Oseberg carvings kept their paint. Only the accused board wears it.
    if (isAccused) {
      c.save();
      c.fillStyle = p.blood;
      c.globalAlpha = 0.1;
      roundPath(c, 2, 2, w - 4, h - 4, 4);
      c.fill();
      c.globalAlpha = 1;
      const bx = w - 27;
      const by = h / 2;
      const rr = Math.min(13, h * 0.34);
      c.lineCap = 'round';
      for (const [col, wdt, a] of [[p.tar, 6.5, 0.85], [p.blood, 3.6, 1], [mixHex(p.blood, p.ember, 0.55), 1.3, 0.75]]) {
        c.strokeStyle = col;
        c.lineWidth = wdt;
        c.globalAlpha = a;
        c.beginPath();
        c.moveTo(bx - rr, by - rr * 0.8); c.lineTo(bx + rr, by + rr * 0.8);
        c.moveTo(bx + rr, by - rr * 0.8); c.lineTo(bx - rr, by + rr * 0.8);
        c.stroke();
      }
      // pigment that ran out of the cut
      c.globalAlpha = 0.5;
      c.fillStyle = p.blood;
      for (let k = 0; k < 5; k++) {
        c.beginPath();
        c.arc(bx - rr + h32(v.k * 53 + k) * rr * 2, by + rr * 0.8 + h32(v.k * 59 + k) * 5, 0.9 + h32(v.k * 61 + k), 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }

    // the WHERE mark: this oath keeps the rivet law, so it is no lie
    if (isNear) {
      c.save();
      c.lineCap = 'round';
      c.strokeStyle = p.tar;
      c.lineWidth = 5;
      roundPath(c, 2.5, 2.5, w - 5, h - 5, 4);
      c.stroke();
      c.strokeStyle = p.ember;
      c.lineWidth = 2.4;
      roundPath(c, 2.5, 2.5, w - 5, h - 5, 4);
      c.stroke();
      c.restore();
    }
  }

  function accuse(k) {
    accused = k;
    clearNear();
    sayViews.forEach((v) => {
      v.btn.setAttribute('aria-checked', v.k === k ? 'true' : 'false');
      v.btn.setAttribute('tabindex', v.k === k ? '0' : '-1');
      v.btn.setAttribute('aria-label',
        T(v.k === k ? 'ariaSayBranded' : 'ariaSay', { line: v.line, rivets: v.rivets }));
      paintSay(v);
    });
    sfx('knock');
    submitBtn.disabled = ctx.solved || accused < 0;
    const line = T('struck', { by: instance.testimonies[k].by });
    status.textContent = line;
    say(line);
  }

  sayViews.forEach((v) => {
    v.btn.setAttribute('aria-label', T('ariaSay', { line: v.line, rivets: v.rivets }));
    on(v.btn, 'click', () => { takeTheAdze(); if (!ctx.solved) accuse(v.k); });
    on(v.btn, 'keydown', (ev) => {
      if (ctx.solved) return;
      const n = sayViews.length;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') {
        ev.preventDefault(); takeTheAdze(); const x = sayViews[(v.k + 1) % n]; x.btn.focus(); accuse(x.k);
      } else if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') {
        ev.preventDefault(); takeTheAdze(); const x = sayViews[(v.k - 1 + n) % n]; x.btn.focus(); accuse(x.k);
      }
    });
    on(v.btn, 'focus', () => {
      if (keysSaid) return;
      keysSaid = true;
      say(T('keysNote'));
    });
  });

  // ---- the stack ----------------------------------------------------------
  const plankViews = instance.planks.map((plank, id) => {
    const btn = node('button');
    btn.className = 'ow4-plank';
    btn.type = 'button';
    btn.setAttribute('role', 'listitem');
    const text = node('span');
    const nameSpan = node('span');
    const countSpan = node('span');
    countSpan.className = 'ow4-count';
    text.append(nameSpan, countSpan);
    btn.append(text);
    return { id, btn, gfx: { canvas: null, ctx: null, w: 0, h: 0 }, nameSpan, countSpan, key: '' };
  });

  function clearNear() {
    if (nearTest < 0 && !nearPlank.size) return;
    nearTest = -1;
    nearPlank.clear();
    sayViews.forEach((sv) => { sv.btn.dataset.near = '0'; paintSay(sv); });
    render();
  }

  // a set-down plank slides home along its own grain
  function settle(btn) {
    if (calm || typeof btn.animate !== 'function') return;
    const m = btn.animate(
      [{ transform: 'translateX(-6px)' }, { transform: 'translateX(1.5px)' }, { transform: 'translateX(0)' }],
      { duration: 150, easing: 'ease-out' },
    );
    motions.push(m);
  }

  // each mark wears its name: tar wash, salt bloom, a knot, a scarf joint …
  function markFeature(c, v, x0, y0, x1, y1) {
    const kind = instance.planks[v.id].mark.split(' ')[1];
    const mw = x1 - x0, mh = y1 - y0, midY = (y0 + y1) / 2;
    c.save();
    if (kind === 'tarred') {
      c.fillStyle = p.tar; c.globalAlpha = 0.34; c.fillRect(x0, y0, mw, mh);
      c.globalAlpha = 0.5; c.lineWidth = 1; c.strokeStyle = p.tar;
      for (let k = 0; k < 6; k++) {
        const sx = x0 + h32(v.id * 17 + k) * mw;
        c.beginPath(); c.moveTo(sx, y0); c.lineTo(sx - 4, y1); c.stroke();
      }
    } else if (kind === 'pale') {
      c.fillStyle = p.bone; c.globalAlpha = 0.13; c.fillRect(x0, y0, mw, mh);
    } else if (kind === 'knotted') {
      const kx = x0 + mw * (0.55 + h32(v.id) * 0.3);
      c.strokeStyle = p.oakDeep; c.globalAlpha = 0.85; c.lineWidth = 1.3;
      for (const rr of [4, 7, 10]) {
        c.beginPath();
        if (typeof c.ellipse === 'function') c.ellipse(kx, midY, rr + 2, rr, 0.3, 0, Math.PI * 2);
        else c.arc(kx, midY, rr, 0, Math.PI * 2);
        c.stroke();
      }
      c.fillStyle = p.tar; c.beginPath(); c.arc(kx, midY, 2.4, 0, Math.PI * 2); c.fill();
    } else if (kind === 'scarfed') {
      const sx = x0 + mw * 0.66;
      c.strokeStyle = p.tar; c.globalAlpha = 0.8; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(sx, y0); c.lineTo(sx + 18, y1); c.stroke();
      c.strokeStyle = p.oakLight; c.globalAlpha = 0.5; c.lineWidth = 1;
      c.beginPath(); c.moveTo(sx + 1.8, y0); c.lineTo(sx + 19.8, y1); c.stroke();
    } else if (kind === 'salt-white') {
      c.fillStyle = p.bone;
      for (let k = 0; k < 40; k++) {
        c.globalAlpha = 0.1 + h32(v.id * 29 + k) * 0.22;
        const sx = x0 + h32(v.id * 31 + k) * mw;
        const sy = y0 + h32(v.id * 37 + k) * mh;
        c.beginPath(); c.arc(sx, sy, 0.7 + h32(v.id * 41 + k) * 0.9, 0, Math.PI * 2); c.fill();
      }
    } else if (kind === 'resined') {
      const rx = x0 + mw * 0.72;
      const g = c.createRadialGradient(rx, midY, 1, rx, midY, mw * 0.24);
      g.addColorStop(0, p.ember); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.22; c.fillStyle = g; c.fillRect(x0, y0, mw, mh);
      c.globalAlpha = 0.3; c.strokeStyle = p.goldBright; c.lineWidth = 1.1;
      c.beginPath(); c.moveTo(x0 + mw * 0.6, y0 + 2.5); c.lineTo(x0 + mw * 0.86, y0 + 2.5); c.stroke();
    } else if (kind === 'green') {
      c.fillStyle = p.pine; c.globalAlpha = 0.26; c.fillRect(x0, y0, mw, mh);
      c.fillStyle = p.pineLight; c.globalAlpha = 0.14; c.fillRect(x0, y0, mw, mh / 2);
    } else if (kind === 'split') {
      c.strokeStyle = p.tar; c.globalAlpha = 0.9; c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(x0 + mw * 0.42, midY - 1);
      for (let k = 1; k <= 6; k++) {
        c.lineTo(x0 + mw * (0.42 + (0.5 * k) / 6), midY - 1 + (h32(v.id * 43 + k) - 0.5) * 5);
      }
      c.stroke();
      c.strokeStyle = p.oakLight; c.globalAlpha = 0.35; c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(x0 + mw * 0.42, midY + 0.6);
      for (let k = 1; k <= 6; k++) {
        c.lineTo(x0 + mw * (0.42 + (0.5 * k) / 6), midY + 0.6 + (h32(v.id * 43 + k) - 0.5) * 5);
      }
      c.stroke();
    } else if (kind === 'burnt') {
      const g = c.createLinearGradient(x1 - mw * 0.26, 0, x1, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, p.tar);
      c.globalAlpha = 0.8; c.fillStyle = g; c.fillRect(x1 - mw * 0.26, y0, mw * 0.26, mh);
      c.fillStyle = p.ember;
      for (let k = 0; k < 5; k++) {
        c.globalAlpha = 0.4 + h32(v.id * 47 + k) * 0.3;
        c.beginPath();
        c.arc(x1 - mw * (0.2 + h32(v.id * 53 + k) * 0.07), y0 + 2 + h32(v.id * 59 + k) * (mh - 4), 1, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.restore();
  }

  function paintPlank(v) {
    if (!v.gfx.ctx) return;
    const flags = nearPlank.get(v.id);
    const place = stack.indexOf(v.id);
    const fair = fairAbove(place);
    const key = `${held === v.id}|${fair}|${v.gfx.w}x${v.gfx.h}|${flags ? `${flags.tick}${flags.brk}${flags.tieT}${flags.tieB}` : ''}`;
    if (v.key === key) return; // repaint only on a real state change
    v.key = key;

    const c = v.gfx.ctx;
    const { w, h } = v.gfx;
    const plank = instance.planks[v.id];
    const lifted = held === v.id;
    const x0 = 0, y0 = 3, x1 = w, y1 = h - 3;
    c.clearRect(0, 0, w, h);

    // the plank body, lit from above
    c.save();
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, lifted ? mixHex(p.oakLight, p.goldBright, 0.14) : p.oakLight);
    g.addColorStop(0.42, lifted ? p.oakLight : p.oak);
    g.addColorStop(1, p.oakDeep);
    c.fillStyle = g;
    c.fillRect(x0, y0, x1 - x0, y1 - y0);

    // grain running the plank's length
    c.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      const gy = y0 + 3 + h32(v.id * 11 + k) * (y1 - y0 - 6);
      const sway = (h32(v.id * 19 + k) - 0.5) * 5;
      c.strokeStyle = k % 2 ? p.oakDeep : p.oakLight;
      c.globalAlpha = 0.15 + h32(v.id * 23 + k) * 0.11;
      c.beginPath();
      c.moveTo(x0 + 2, gy);
      c.bezierCurveTo(w * 0.33, gy + sway, w * 0.66, gy - sway, x1 - 2, gy);
      c.stroke();
    }
    // pore stipple
    c.globalAlpha = 1;
    for (let k = 0; k < 34; k++) {
      c.fillStyle = h32(v.id * 67 + k) > 0.5 ? p.oakDeep : p.tar;
      c.globalAlpha = 0.1 + h32(v.id * 71 + k) * 0.14;
      c.fillRect(x0 + h32(v.id * 73 + k) * w, y0 + h32(v.id * 79 + k) * (y1 - y0), 1.1, 0.9);
    }
    c.globalAlpha = 1;
    c.restore();

    markFeature(c, v, x0, y0, x1, y1);

    // the name field: a planed patch the wright chalked, so the word sits on
    // wood that can carry it (contrast floor over every mark's own wash)
    c.save();
    const nf = c.createLinearGradient(0, y0, 0, y0 + 24);
    nf.addColorStop(0, 'rgba(12,9,6,.52)');
    nf.addColorStop(1, 'rgba(12,9,6,0)');
    c.fillStyle = nf;
    c.fillRect(x0, y0, x1 - x0, 24);
    c.restore();

    // clinker shading: the lap shadow above, the catch light below
    c.save();
    const lap = c.createLinearGradient(0, y0, 0, y0 + 7);
    lap.addColorStop(0, p.tar); lap.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = 0.55; c.fillStyle = lap; c.fillRect(x0, y0, x1 - x0, 7);
    c.globalAlpha = 0.5; c.strokeStyle = p.oakLight; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x0, y1 - 0.5); c.lineTo(x1, y1 - 0.5); c.stroke();
    c.globalAlpha = 0.9; c.strokeStyle = p.tar;
    c.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
    c.restore();

    // rivets: a cast shadow first, then the lit dome — set along the lap line
    const n = plank.rivets;
    const gap = (w - 14) / Math.max(1, n - 1);
    const ry = h - 11;
    for (let i = 0; i < n; i++) {
      const rx = 7 + gap * i;
      c.save();
      c.fillStyle = p.tar;
      c.globalAlpha = 0.55;
      c.beginPath(); c.arc(rx + 0.9, ry + 1.2, 2.2, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
      const dome = c.createRadialGradient(rx - 0.6, ry - 0.6, 0.2, rx, ry, 2.1);
      dome.addColorStop(0, lifted ? p.goldBright : mixHex(p.gold, p.goldBright, 0.5));
      dome.addColorStop(1, mixHex(p.gold, p.tar, 0.45));
      c.fillStyle = dome;
      c.beginPath(); c.arc(rx, ry, 2, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    // a joint that LIES FAIR: the lap above this plank is sworn and the rivets
    // alternate across it, so the seam catches gold along its upper arris.
    if (fair) {
      c.save();
      c.strokeStyle = p.tar; c.lineWidth = 3.2; c.globalAlpha = 0.8;
      c.beginPath(); c.moveTo(x0 + 4, y0 + 1.6); c.lineTo(x1 - 4, y0 + 1.6); c.stroke();
      c.strokeStyle = p.gold; c.lineWidth = 1.6; c.globalAlpha = 0.95;
      c.beginPath(); c.moveTo(x0 + 4, y0 + 1.6); c.lineTo(x1 - 4, y0 + 1.6); c.stroke();
      c.globalAlpha = 1;
      c.fillStyle = p.goldBright;
      for (const fx of [x0 + 7, x1 - 7]) { c.beginPath(); c.arc(fx, y0 + 1.6, 1.5, 0, Math.PI * 2); c.fill(); }
      c.restore();
    }

    // near-miss marks: gold tick for strakes standing true, ember for the fault
    // (every ember mark rides a tar under-stroke so it separates from the oak)
    if (flags) {
      c.save();
      const emberLine = (ax, ay, bx, by) => {
        c.lineCap = 'round';
        c.strokeStyle = p.tar; c.lineWidth = 4.5;
        c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
        c.strokeStyle = p.ember; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
      };
      if (flags.tieT) emberLine(x0 + 3, y0 + 1.5, x1 - 3, y0 + 1.5);
      if (flags.tieB) emberLine(x0 + 3, y1 - 1.5, x1 - 3, y1 - 1.5);
      if (flags.brk) {
        c.strokeStyle = p.tar; c.lineWidth = 4;
        c.strokeRect(x0 + 1.5, y0 + 1.5, x1 - x0 - 3, y1 - y0 - 3);
        c.strokeStyle = p.ember; c.lineWidth = 2;
        c.strokeRect(x0 + 1.5, y0 + 1.5, x1 - x0 - 3, y1 - y0 - 3);
      }
      if (flags.tick) {
        c.lineCap = 'round';
        c.strokeStyle = p.tar; c.lineWidth = 4;
        c.beginPath(); c.moveTo(x1 - 26, h / 2 + 1); c.lineTo(x1 - 22, h / 2 + 5); c.lineTo(x1 - 14, h / 2 - 6); c.stroke();
        c.strokeStyle = p.gold; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x1 - 26, h / 2 + 1); c.lineTo(x1 - 22, h / 2 + 5); c.lineTo(x1 - 14, h / 2 - 6); c.stroke();
      }
      c.restore();
    }
  }

  // ---- the tally: one notch per joint on the wright's stick ----------------
  function paintTally() {
    const c = tallyGfx.ctx;
    const { w, h } = tallyGfx;
    const n = ctx.solved ? JOINTS : fairCount();
    c.clearRect(0, 0, w, h);
    // the stick
    c.save();
    const g = c.createLinearGradient(0, 2, 0, h - 2);
    g.addColorStop(0, p.oakLight);
    g.addColorStop(0.5, p.oak);
    g.addColorStop(1, p.oakDeep);
    c.fillStyle = g;
    c.fillRect(2, 4, w - 4, h - 8);
    c.strokeStyle = 'rgba(12,9,6,.9)';
    c.lineWidth = 1.2;
    c.strokeRect(2.6, 4.6, w - 5.2, h - 9.2);
    c.strokeStyle = 'rgba(238,207,109,.16)';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(4, h - 5); c.lineTo(w - 4, h - 5); c.stroke();
    c.restore();
    // one notch per joint, cut when that joint lies fair
    for (let i = 0; i < JOINTS; i++) {
      const x = 12 + i * ((w - 24) / (JOINTS - 1));
      c.save();
      c.lineCap = 'round';
      c.strokeStyle = p.tar;
      c.lineWidth = 4;
      c.beginPath(); c.moveTo(x - 2.4, 7); c.lineTo(x + 2.4, h - 7); c.stroke();
      if (i < n) {
        c.strokeStyle = p.gold;
        c.lineWidth = 2.2;
        c.beginPath(); c.moveTo(x - 2.4, 7); c.lineTo(x + 2.4, h - 7); c.stroke();
        c.fillStyle = p.goldBright;
        c.beginPath(); c.arc(x + 2.4, h - 7, 1.4, 0, Math.PI * 2); c.fill();
      } else {
        c.strokeStyle = 'rgba(90,58,30,.85)';
        c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(x - 2, 8); c.lineTo(x + 2, h - 8); c.stroke();
      }
      c.restore();
    }
    tallyText.textContent = n === JOINTS ? T('tallyAll', { j: JOINTS })
      : (n === 0 ? T('tallyNone') : T('tally', { n, j: JOINTS }));
  }

  // Reordering must never cost the player their grip (CONTRACT §8): leave the
  // DOM alone when the stack already stands in order; when it must move,
  // re-appending drops focus and pointer capture in a real browser, so
  // restore both onto the same plank afterwards.
  function syncStack() {
    const want = stack.map((id) => plankViews[id].btn);
    const have = Array.from(stackList.children || []);
    if (have.length === want.length && want.every((b, i) => have[i] === b)) return;
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    for (const b of want) stackList.append(b);
    if (active && want.indexOf(active) >= 0) {
      try { active.focus({ preventScroll: true }); } catch (e) { try { active.focus(); } catch (e2) { /* headless */ } }
    }
    if (drag && drag.pointerId != null) {
      try { plankViews[drag.id].btn.setPointerCapture(drag.pointerId); } catch (e) { /* pointer gone */ }
    }
  }

  function render() {
    syncStack();
    stack.forEach((id, place) => {
      const v = plankViews[id];
      const plank = instance.planks[id];
      const fromKeel = stack.length - place;
      v.nameSpan.textContent = markOf(id);
      v.countSpan.textContent = T('countLine', { n: plank.rivets });
      v.btn.dataset.held = held === id ? '1' : '0';
      v.btn.setAttribute('aria-label',
        T('ariaPlank', { mark: markOf(id), rivets: plank.rivets, place: PLACES[fromKeel - 1] })
        + (held === id ? T('ariaLifted') : '')
        + (fairAbove(place) ? T('ariaFair') : ''));
      paintPlank(v);
    });
    paintTally();
    submitBtn.disabled = ctx.solved || accused < 0;
  }

  function moveTo(id, to) {
    const from = stack.indexOf(id);
    const target = Math.max(0, Math.min(stack.length - 1, to));
    if (from === target) return false;
    stack.splice(from, 1);
    stack.splice(target, 0, id);
    return true;
  }

  function reportMove(id) {
    const fromKeel = stack.length - stack.indexOf(id);
    const line = T('lies', { mark: markOf(id), place: PLACES[fromKeel - 1] });
    status.textContent = `${line} ${tallyText.textContent}`;
    say(line);
  }

  let drag = null;
  function nearestPlace(y) {
    let best = 0, bestD = Infinity;
    stack.forEach((id, place) => {
      const r = plankViews[id].btn.getBoundingClientRect();
      const d = Math.abs(y - (r.top + r.height / 2));
      if (d < bestD) { bestD = d; best = place; }
    });
    return best;
  }

  plankViews.forEach((v) => {
    on(v.btn, 'pointerdown', (ev) => {
      takeTheAdze();
      if (ctx.solved) return;
      drag = { id: v.id, y: ev.clientY, moved: false, pointerId: ev.pointerId };
      try { v.btn.setPointerCapture(ev.pointerId); } catch (e) { /* mouse without capture */ }
    });
    on(v.btn, 'pointermove', (ev) => {
      if (!drag || drag.id !== v.id) return;
      if (!drag.moved) {
        if (Math.abs(ev.clientY - drag.y) < 8) return;
        drag.moved = true;
        held = v.id;
        sfx('slide');
      }
      ev.preventDefault();
      if (moveTo(v.id, nearestPlace(ev.clientY))) { clearNear(); sfx('tick'); render(); }
    });
    const finish = (ev) => {
      if (!drag || drag.id !== v.id) return;
      const moved = drag.moved;
      drag = null;
      held = -1;
      try { v.btn.releasePointerCapture(ev.pointerId); } catch (e) { /* already gone */ }
      render();
      if (moved) { sfx('knock'); settle(v.btn); reportMove(v.id); }
    };
    on(v.btn, 'pointerup', finish);
    on(v.btn, 'pointercancel', () => { drag = null; held = -1; render(); });

    on(v.btn, 'keydown', (ev) => {
      if (ctx.solved) return;
      const place = stack.indexOf(v.id);
      const step = (d) => {
        if (held === v.id) {
          if (moveTo(v.id, place + d)) { clearNear(); sfx('slide'); render(); reportMove(v.id); }
          v.btn.focus();
        } else {
          const next = plankViews[stack[Math.max(0, Math.min(stack.length - 1, place + d))]];
          next.btn.focus();
          sfx('tick');
        }
      };
      if (ev.key === 'ArrowUp') { ev.preventDefault(); takeTheAdze(); step(-1); }
      else if (ev.key === 'ArrowDown') { ev.preventDefault(); takeTheAdze(); step(1); }
      else if (ev.key === ' ' || ev.key === 'Spacebar' || ev.key === 'Enter') {
        ev.preventDefault();
        takeTheAdze();
        const wasHeld = held === v.id;
        held = wasHeld ? -1 : v.id;
        sfx(wasHeld ? 'knock' : 'slide');
        render();
        if (wasHeld) settle(v.btn);
        status.textContent = wasHeld ? T('setDown', { mark: markOf(v.id) }) : T('lifted', { mark: markOf(v.id) });
      }
    });

    on(v.btn, 'focus', () => {
      if (keysSaid) return;
      keysSaid = true;
      say(T('keysNote'));
    });
  });

  // ---- the showing: a ghost hand lifts one plank a single place -----------
  // Three seconds, skippable, and answer-blind: it always lifts the plank that
  // stands second from the sheer into the place above it, so the demo teaches
  // the verb and never leaks the stack.
  function paintGhost() {
    if (!ghost.ctx) return;
    const c = ghost.ctx;
    const { w, h } = ghost;
    c.clearRect(0, 0, w, h);
    c.save();
    c.globalAlpha = 0.9;
    c.fillStyle = 'rgba(238,207,109,.2)';
    roundPath(c, 2, 2, w - 4, h - 4, 3);
    c.fill();
    c.strokeStyle = p.goldBright;
    c.lineWidth = 2;
    if (typeof c.setLineDash === 'function') c.setLineDash([6, 4]);
    roundPath(c, 2, 2, w - 4, h - 4, 3);
    c.stroke();
    if (typeof c.setLineDash === 'function') c.setLineDash([]);
    // the grip: a hand's worth of gold, and the way it means to go
    c.lineCap = 'round';
    c.strokeStyle = p.tar;
    c.lineWidth = 5;
    const ax = w / 2, ay = h / 2;
    c.beginPath();
    c.moveTo(ax, ay + 8); c.lineTo(ax, ay - 9);
    c.moveTo(ax - 6, ay - 3); c.lineTo(ax, ay - 10); c.lineTo(ax + 6, ay - 3);
    c.stroke();
    c.strokeStyle = p.goldBright;
    c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(ax, ay + 8); c.lineTo(ax, ay - 9);
    c.moveTo(ax - 6, ay - 3); c.lineTo(ax, ay - 10); c.lineTo(ax + 6, ay - 3);
    c.stroke();
    art.glow(c, ax, ay, w * 0.32, p.goldBright, 0.32);
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

  function takeTheAdze() {
    if (touched) return;
    touched = true;
    endShowing(true);
  }

  function showTheWay() {
    if (ctx.solved || touched || stack.length < 2) return;
    const srcBtn = plankViews[stack[1]].btn;
    const dstBtn = plankViews[stack[0]].btn;
    const bayRect = bayWrap.getBoundingClientRect();
    const a = srcBtn.getBoundingClientRect();
    const b = dstBtn.getBoundingClientRect();
    if (!a.width || !bayRect.width) return;

    fitCanvas(ghostHost, ghost, Math.round(a.width), Math.round(a.height));
    ghost.canvas.style.position = 'static';
    paintGhost();
    ghostHost.style.display = 'block';
    const x0 = Math.round(a.left - bayRect.left);
    const y0 = Math.round(a.top - bayRect.top);
    const y1 = Math.round(b.top - bayRect.top);
    ghostHost.style.transform = `translate(${x0}px,${y0}px)`;
    skipBtn.style.display = '';

    if (!calm && typeof ghostHost.animate === 'function') {
      const m = ghostHost.animate([
        { transform: `translate(${x0}px,${y0}px)`, opacity: 0 },
        { transform: `translate(${x0 - 5}px,${y0 - 7}px)`, opacity: 1, offset: 0.2 },
        { transform: `translate(${x0 - 5}px,${y1 - 7}px)`, opacity: 1, offset: 0.7 },
        { transform: `translate(${x0}px,${y1}px)`, opacity: 0.9, offset: 0.88 },
        { transform: `translate(${x0}px,${y1}px)`, opacity: 0 },
      ], { duration: 2600, easing: 'ease-in-out' });
      motions.push(m);
    } else {
      // reduced motion: the same lesson held still — the ghost stands in the
      // place the plank is meant to take, arrow up, and stays put.
      ghostHost.style.transform = `translate(${x0}px,${y1}px)`;
    }
    later(() => endShowing(false), 3000);
  }

  // The shell owns the shudder and the deny voice. The board's part is to show
  // WHERE, at the near-line's own grain: the wrongly accused oath, the lapped
  // pair the rivets forbid, or how far from the keel the stack stands true.
  function handle(res, sent) {
    if (!res || res.ok) return;
    if (sent) {
      nearPlank.clear();
      nearTest = -1;
      const t = instance.testimonies[sent.liar];
      const lawless = instance.planks[t.over].rivets % 2 === instance.planks[t.under].rivets % 2;
      const flagsOf = (id) => {
        if (!nearPlank.has(id)) nearPlank.set(id, { tick: false, brk: false, tieT: false, tieB: false });
        return nearPlank.get(id);
      };
      if (!lawless) {
        nearTest = sent.liar;
        sayViews[sent.liar].btn.dataset.near = '1';
      } else {
        let parityOk = true;
        for (let i = 1; i < sent.order.length; i++) {
          const below = sent.order[i - 1], above = sent.order[i];
          if (instance.planks[above].rivets % 2 === instance.planks[below].rivets % 2) {
            parityOk = false;
            flagsOf(above).tieB = true; // its lower edge meets the fault
            flagsOf(below).tieT = true; // its upper edge meets the fault
          }
        }
        if (parityOk) {
          const truthOrder = solve(instance).order;
          let stand = 0;
          while (stand < sent.order.length && sent.order[stand] === truthOrder[stand]) stand++;
          for (let i = 0; i < stand; i++) flagsOf(sent.order[i]).tick = true;
          if (stand < sent.order.length) flagsOf(sent.order[stand]).brk = true;
        }
      }
      sayViews.forEach((sv) => paintSay(sv));
      render();
    }
    if (res.near) {
      const line = localNear(res.near);
      status.textContent = line;
      say(line);
    }
  }

  on(submitBtn, 'click', () => {
    takeTheAdze();
    if (ctx.solved || accused < 0) return;
    sfx('confirm');
    const sent = { order: stack.slice().reverse(), liar: accused };
    let res;
    try { res = ctx.submit(sent); } catch (e) { return; }
    if (res && typeof res.then === 'function') res.then((r) => handle(r, sent), () => {});
    else handle(res, sent);
  });

  on(skipBtn, 'click', () => { takeTheAdze(); submitBtn.focus(); });

  // ---- layout, resize -----------------------------------------------------
  const raf = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : later(fn, 16));

  function relayout() {
    measure();
    stackList.style.width = `${plankW}px`;
    for (const v of plankViews) {
      fitCanvas(v.btn, v.gfx, plankW, PLANK_H);
      v.gfx.canvas.style.position = 'absolute';
      v.gfx.canvas.style.left = '0';
      v.gfx.canvas.style.top = '0';
      v.key = '';
      paintPlank(v);
    }

    // the bay's backdrop takes its geometry from the stack it holds
    const bayRect = bayWrap.getBoundingClientRect();
    const listRect = stackList.getBoundingClientRect();
    if (bayRect.width > 4 && bayRect.height > 4) {
      fitCanvas(bayHost, bay, bayRect.width, bayRect.height);
      stackBox = {
        x: listRect.left - bayRect.left,
        y: listRect.top - bayRect.top,
        w: listRect.width,
        h: listRect.height,
      };
      rowYs = stack.map((id) => {
        const r = plankViews[id].btn.getBoundingClientRect();
        return r.top + r.height / 2 - bayRect.top;
      });
      paintBay();
    }

    // each tally-board's own face, then the rail behind them
    for (const v of sayViews) {
      const r = v.btn.getBoundingClientRect();
      if (r.width > 4 && r.height > 4) {
        fitCanvas(v.woodHost, v.gfx, r.width, r.height);
        v.gfx.canvas.style.position = 'absolute';
        v.gfx.canvas.style.left = '0';
        v.gfx.canvas.style.top = '0';
        v.key = '';
        paintSay(v);
      }
    }
    const railRect = railWrap.getBoundingClientRect();
    if (railRect.width > 4 && railRect.height > 4) {
      fitCanvas(railHost, rail, railRect.width, railRect.height);
      pegYs = sayViews.map((v) => {
        const r = v.btn.getBoundingClientRect();
        return r.top + 9 - railRect.top;
      });
      paintRail();
    }
    sayList.style.marginLeft = `${GUTTER}px`;
    paintTally();
  }

  let resizeRaf = 0;
  const onResize = () => {
    if (resizeRaf) return;
    resizeRaf = raf(() => { resizeRaf = 0; relayout(); });
  };
  // headless harnesses stub `window` as bare globalThis, which carries no
  // event target; the board must mount there too (CONTRACT §7 purity gate)
  if (typeof globalThis.addEventListener === 'function') on(globalThis, 'resize', onResize);

  // ---- open the lock ------------------------------------------------------
  sayList.style.marginLeft = `${GUTTER}px`;
  render();
  relayout();
  // one more pass once the browser has settled the wrapped text heights
  raf(() => relayout());
  if (accused >= 0) accuse(accused);
  say(T('openLaw'));
  instance.testimonies.forEach((t) => {
    say(T('openSwear', {
      by: t.by,
      over: markOf(t.over),
      a: instance.planks[t.over].rivets,
      under: markOf(t.under),
      b: instance.planks[t.under].rivets,
    }));
  });
  if (ctx.solved) {
    submitBtn.disabled = true;
    submitBtn.textContent = T('submitDone');
    status.textContent = T('solvedLine');
  } else {
    later(() => { relayout(); showTheWay(); }, 60);
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

// es/ca live here (docs/CONTRACT.md §4.1 amendment). English stays in the
// frozen top-level fields; `verify()` keeps returning canonical English near
// lines and `nearMap` carries every one of them.
const I18N = {
  es: {
    title: 'Las Tracas a Tingladillo',
    epigraph: 'Siete tablas, siete juramentos — uno está podrido.\nArma el casco que exigen los seis veraces\ny marca la lengua que mintió.',
    hints: [
      'Una traca solapa la de debajo y ninguna otra. Siete tablas hacen una sola pila, de la quilla a la regala — y estos siete testimonios cierran un anillo, cosa que ninguna pila puede.',
      'Cuenta los roblones. Donde dos tracas solapan, una cuenta es impar y la otra par. Pesa cada testimonio contra esa ley.',
      'Tacha del registro el testimonio sin ley y jura por los otros seis. Lo que dejan es una pila y ninguna más.',
    ],
    nearMap: {
      [NEAR_KEEPS]: 'Ese testimonio respeta la ley de los roblones. No es mentira.',
      [NEAR_PARITY]: 'En esa pila solapan dos tracas de la misma paridad. Los roblones lo prohíben.',
      [NEAR_GARBOARD]: 'La aparadura está mal. Nada de lo que va encima puede sostenerse.',
      [NEAR_ONE]: 'Una traca desde la quilla se sostiene. La siguiente no.',
      [nearRun(2)]: 'Dos tracas desde la quilla se sostienen. La siguiente no.',
      [nearRun(3)]: 'Tres tracas desde la quilla se sostienen. La siguiente no.',
      [nearRun(4)]: 'Cuatro tracas desde la quilla se sostienen. La siguiente no.',
      [nearRun(5)]: 'Cinco tracas desde la quilla se sostienen. La siguiente no.',
      [nearRun(6)]: 'Seis tracas desde la quilla se sostienen. La siguiente no.',
      [nearRun(7)]: 'Siete tracas desde la quilla se sostienen. La siguiente no.',
      [nearRun(8)]: 'Ocho tracas desde la quilla se sostienen. La siguiente no.',
    },
    board: {
      submit: 'Levantar la pila',
      submitDone: 'La pila se sostiene',
      solvedLine: 'La pila se sostiene de la quilla a la regala, y el juramento falso queda tachado.',
      skip: 'Saltar la muestra',
      sheer: 'regala',
      keel: 'quilla',
      tally: '{n} de {j} juntas asientan bien',
      tallyNone: 'Ninguna junta asienta aún',
      tallyAll: 'Las {j} juntas asientan bien.',
      saysLabel: 'Los siete testimonios, colgados del listón — marca el falso',
      stackLabel: 'La cuna de armar: la pila, la regala arriba y la quilla al pie',
      swears: '{by} jura: {over} solapa {under}.',
      rivets: '{a} sobre {b}',
      countLine: '{n} roblones',
      ariaSay: '{line} Roblones: {rivets}.',
      ariaSayBranded: '{line} Roblones: {rivets}. Marcado como falso.',
      ariaPlank: '{mark}, {rivets} roblones, {place} traca desde la quilla',
      ariaLifted: ', alzada',
      ariaFair: ', su solape asienta bien',
      struck: 'La palabra de {by} queda marcada como falsa y tachada del registro.',
      lies: '{mark} queda {place} desde la quilla.',
      lifted: '{mark} queda alzada. Las flechas la mueven; el espacio la posa.',
      setDown: '{mark} queda posada.',
      keysNote: 'Con el teclado: en las tablas de cuentas, las flechas recorren y la recorrida queda marcada; '
        + 'en las tracas, el espacio alza, arriba y abajo mueven lo alzado, el espacio lo posa.',
      openLaw: 'Ley del solape: una traca solapa la de debajo y ninguna otra. Ley del roblón: donde dos tracas '
        + 'solapan, una cuenta es impar y la otra par.',
      openSwear: '{by} jura: {over} ({a} roblones) solapa {under} ({b} roblones).',
      places: ['primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta', 'séptima', 'octava', 'novena'],
      marks: {
        'the tarred plank': 'la traca embreada',
        'the pale plank': 'la traca pálida',
        'the knotted plank': 'la traca nudosa',
        'the scarfed plank': 'la traca empalmada',
        'the salt-white plank': 'la traca blanca de sal',
        'the resined plank': 'la traca resinada',
        'the green plank': 'la traca verde',
        'the split plank': 'la traca hendida',
        'the burnt plank': 'la traca quemada',
      },
    },
  },
  ca: {
    title: 'Les Traques a Tingladell',
    epigraph: 'Set taules, set juraments — un és podrit.\nArma el buc que exigeixen els sis verídics\ni marca la llengua que va mentir.',
    hints: [
      'Una traca encavalca la de sota i cap altra. Set taules fan una sola pila, de la quilla a la regala — i aquests set testimonis tanquen un anell, cosa que cap pila no pot.',
      'Compta els reblons. Allà on dues traques encavalquen, un compte és senar i l’altre parell. Pesa cada testimoni contra aquesta llei.',
      'Ratlla del registre el testimoni sense llei i jura pels altres sis. El que deixen és una pila i cap altra.',
    ],
    nearMap: {
      [NEAR_KEEPS]: 'Aquest testimoni respecta la llei dels reblons. No és cap mentida.',
      [NEAR_PARITY]: 'En aquesta pila encavalquen dues traques de la mateixa paritat. Els reblons ho prohibeixen.',
      [NEAR_GARBOARD]: 'La traca d’aparadura és equivocada. Res del que hi va damunt no s’aguanta.',
      [NEAR_ONE]: 'Una traca des de la quilla s’aguanta. La següent no.',
      [nearRun(2)]: 'Dues traques des de la quilla s’aguanten. La següent no.',
      [nearRun(3)]: 'Tres traques des de la quilla s’aguanten. La següent no.',
      [nearRun(4)]: 'Quatre traques des de la quilla s’aguanten. La següent no.',
      [nearRun(5)]: 'Cinc traques des de la quilla s’aguanten. La següent no.',
      [nearRun(6)]: 'Sis traques des de la quilla s’aguanten. La següent no.',
      [nearRun(7)]: 'Set traques des de la quilla s’aguanten. La següent no.',
      [nearRun(8)]: 'Vuit traques des de la quilla s’aguanten. La següent no.',
    },
    board: {
      submit: 'Aixecar la pila',
      submitDone: 'La pila s’aguanta',
      solvedLine: 'La pila s’aguanta de la quilla a la regala, i el jurament fals queda ratllat.',
      skip: 'Saltar la mostra',
      sheer: 'regala',
      keel: 'quilla',
      tally: '{n} de {j} juntes seuen bé',
      tallyNone: 'Cap junta no seu bé encara',
      tallyAll: 'Les {j} juntes seuen bé.',
      saysLabel: 'Els set testimonis, penjats del llistó — marca el fals',
      stackLabel: 'El bressol d’armar: la pila, la regala a dalt i la quilla al peu',
      swears: '{by} jura: {over} encavalca {under}.',
      rivets: '{a} sobre {b}',
      countLine: '{n} reblons',
      ariaSay: '{line} Reblons: {rivets}.',
      ariaSayBranded: '{line} Reblons: {rivets}. Marcat com a fals.',
      ariaPlank: '{mark}, {rivets} reblons, {place} traca des de la quilla',
      ariaLifted: ', alçada',
      ariaFair: ', el seu encavalcament seu bé',
      struck: 'La paraula de {by} queda marcada com a falsa i ratllada del registre.',
      lies: '{mark} queda {place} des de la quilla.',
      lifted: '{mark} queda alçada. Les fletxes la mouen; l’espai la posa.',
      setDown: '{mark} queda posada.',
      keysNote: 'Amb el teclat: a les posts de comptes, les fletxes recorren i la recorreguda queda marcada; '
        + 'a les traques, l’espai alça, amunt i avall mouen el que és alçat, l’espai ho posa.',
      openLaw: 'Llei de l’encavalcament: una traca encavalca la de sota i cap altra. Llei del rebló: allà on dues '
        + 'traques encavalquen, un compte és senar i l’altre parell.',
      openSwear: '{by} jura: {over} ({a} reblons) encavalca {under} ({b} reblons).',
      places: ['primera', 'segona', 'tercera', 'quarta', 'cinquena', 'sisena', 'setena', 'vuitena', 'novena'],
      marks: {
        'the tarred plank': 'la traca embreada',
        'the pale plank': 'la traca pàl·lida',
        'the knotted plank': 'la traca nuosa',
        'the scarfed plank': 'la traca empalmada',
        'the salt-white plank': 'la traca blanca de sal',
        'the resined plank': 'la traca resinada',
        'the green plank': 'la traca verda',
        'the split plank': 'la traca esberlada',
        'the burnt plank': 'la traca cremada',
      },
    },
  },
};

export default {
  id: '04-strakes',
  ordinal: 4,
  tier: 2,
  title: 'The Clinker Strakes',
  epigraph: 'Seven planks, seven oaths — one oath rots.\nBuild the hull the true six demand,\nand brand the tongue that lied.',

  makePuzzle,
  solve,
  verify,
  wrongAnswers,
  shard: () => ({ ...SHARDS['04-strakes'] }),

  difficulty: {
    searchSpace: 35280, // 7! stacks x 7 testimonies
    minSteps: 12,   // seven testimonies weighed + the false one marked + the stack raised
    estMinutes: 4,  // ENTRY-CURVE AMENDMENT: measured cold at about three and a half minutes
  },

  hints: [
    'A strake laps the one below it and no other. Seven planks make one stack, keel to sheer — and these seven testimonies make a ring, which no stack can.',
    'Count the rivets. Where two strakes lap, one count is odd and the other even. Weigh every testimony against that.',
    'Strike the lawless testimony from the ledger and swear by the other six. What they leave is one stack and no other.',
  ],

  i18n: I18N,

  mount,
};
