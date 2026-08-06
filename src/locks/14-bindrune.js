// 14 — THE BIND-RUNE SEAL (tier 4)
//
// One deep-cut figure on the hasp: the union of the canonical stroke segments
// (src/kernel/futhark.js, and nowhere else) of a secret five- or six-rune
// subset, all of them hung on the one common stave. Name the runes bound in it.
//
// THE LAW (both halves are enforced by verify):
//   1. Union — the strokes of the named runes must be exactly the carved
//      strokes. Not one stroke short, not one stroke over.
//   2. Minimality — no named rune may be dropped without losing a carved
//      stroke. A rune that adds nothing was never bound.
//
// SEGMENT IDENTITY: a segment is its exact kernel polyline. In the frozen
// futhark the ONLY segment shared between runes is the stave itself — every
// branch belongs to exactly one rune. Two consequences, both load-bearing:
//   · Uniqueness is structural. Every branch of the carving names its own rune,
//     so the generating subsets are exactly {core} and {core, ᛁ}, and the
//     single minimal one is the core. makePuzzle still runs the full 2^16
//     sweep of docs/LOCKS.md §14 to prove it per instance rather than assume it.
//   · TRAPS. ᛁ (íss) is the one rune the kernel data allows to be fully covered
//     by others — its lone stave is shared by all stave-bearing runes — so it
//     is always carved, always tempting, and always wrong, because it is always
//     removable. The generator additionally plants >= 2 one-stroke-short traps:
//     runes whose every branch but one is already carved (necessarily the
//     single-branch runes ᚦ ᚴ ᚾ ᛅ ᛚ that were not chosen). ᚢ and ᛋ carry no
//     stave at all and can never belong. This taxonomy is the amended §14.
//
// ANSWER: { runes: [chars, futhark-sorted] }. The sort is canonical form, not
// decoration — an unsorted correct set is rejected, which is also what makes a
// swapped-pair mutation of the answer fail.
//
// Difficulty accounting (docs/CONTRACT.md §4): all 16 candidates selected once
// to read their strokes against the carving (16), the 10–11 that over-carve
// deselected again (10), minimality re-checked on the survivors (5), sealing
// (1) = 32.
//
// PURE HALF: no DOM, no Date, no Math.random, no module-level mutable state.

import { FUTHARK, ORDER, STAVE } from '../kernel/futhark.js';
import { SHARDS } from '../kernel/shards.js';

const segKey = (seg) => JSON.stringify(seg);
const STAVE_KEY = segKey(STAVE);

// Bit index per distinct kernel segment (28 of them; the stave is bit 0).
const SEGMENTS = (() => {
  const keys = [STAVE_KEY];
  for (const r of FUTHARK) for (const s of r.segments) {
    const k = segKey(s);
    if (!keys.includes(k)) keys.push(k);
  }
  return keys;
})();
const SEG_BIT = new Map(SEGMENTS.map((k, i) => [k, i]));
const RUNE_MASK = Object.fromEntries(FUTHARK.map((r) => [
  r.ch,
  r.segments.reduce((m, s) => m | (1 << SEG_BIT.get(segKey(s))), 0),
]));
const ORDER_INDEX = Object.fromEntries(ORDER.map((ch, i) => [ch, i]));
const BRANCHES = Object.fromEntries(FUTHARK.map((r) => [
  r.ch,
  r.segments.filter((s) => segKey(s) !== STAVE_KEY).length,
]));
// Every rune hung on the common stave, minus ᛁ — which can never be part of an
// answer, since its stave is always carved by somebody else.
const POOL = ORDER.filter((ch) => (RUNE_MASK[ch] & 1) !== 0 && ch !== 'ᛁ');

const popcount = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
const sortRunes = (chars) => chars.slice().sort((a, b) => ORDER_INDEX[a] - ORDER_INDEX[b]);
const maskOf = (chars) => chars.reduce((m, ch) => m | (RUNE_MASK[ch] || 0), 0);

// docs/LOCKS.md §14: all 2^16 subsets of the row, every union, every minimal
// generating set.
function sweepSubsets(carved) {
  const runeMask = ORDER.map((ch) => RUNE_MASK[ch]);
  const total = 1 << 16;
  const union = new Int32Array(total);
  for (let s = 1; s < total; s++) {
    const low = s & -s;
    union[s] = union[s ^ low] | runeMask[31 - Math.clz32(low)];
  }
  const minimal = [];
  for (let s = 0; s < total; s++) {
    if (union[s] !== carved) continue;
    let isMinimal = true;
    for (let i = 0; i < 16 && isMinimal; i++) {
      if ((s & (1 << i)) !== 0 && union[s ^ (1 << i)] === carved) isMinimal = false;
    }
    if (isMinimal) minimal.push(ORDER.filter((_, i) => (s & (1 << i)) !== 0));
  }
  return minimal;
}

function carvedMaskOf(instance) {
  let mask = 0;
  for (const seg of instance.segments) {
    const bit = SEG_BIT.get(segKey(seg));
    if (bit === undefined) return -1;
    mask |= 1 << bit;
  }
  return mask;
}

function trapsFor(chosen, carved) {
  const full = [];
  const oneShort = [];
  for (const ch of ORDER) {
    if (chosen.includes(ch)) continue;
    const outside = popcount(RUNE_MASK[ch] & ~carved);
    if (outside === 0) full.push(ch);
    else if (outside === 1) oneShort.push(ch);
  }
  return { full, oneShort };
}

export default {
  id: '14-bindrune',
  ordinal: 14,
  tier: 4,
  title: 'The Bind-Rune Seal',
  epigraph: 'Six names cut over one another on a single stave. The stave belongs to all of them and to none.',

  makePuzzle(rng) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const size = rng.chance(0.5) ? 5 : 6;
      const chosen = sortRunes(rng.shuffle(POOL).slice(0, size));
      const carved = maskOf(chosen);
      if (popcount(carved) < 10) continue;
      if (chosen.filter((ch) => BRANCHES[ch] === 2).length < 3) continue;
      const { full, oneShort } = trapsFor(chosen, carved);
      if (!full.includes('ᛁ') || oneShort.length < 2) continue;
      const minimal = sweepSubsets(carved);
      if (minimal.length !== 1 || minimal[0].join('') !== chosen.join('')) continue;
      const segments = SEGMENTS
        .filter((k, i) => (carved & (1 << i)) !== 0)
        .sort()
        .map((k) => JSON.parse(k));
      return { segments, candidates: ORDER.slice() };
    }
    // Unreachable in measurement; a bindrune of the six two-branch stave runes
    // always satisfies the law above.
    const chosen = sortRunes(['ᚠ', 'ᚬ', 'ᚱ', 'ᚼ', 'ᛏ', 'ᛒ']);
    const carved = maskOf(chosen);
    return {
      segments: SEGMENTS.filter((k, i) => (carved & (1 << i)) !== 0).sort().map((k) => JSON.parse(k)),
      candidates: ORDER.slice(),
    };
  },

  solve(instance) {
    const minimal = sweepSubsets(carvedMaskOf(instance));
    return { runes: minimal.length === 1 ? sortRunes(minimal[0]) : [] };
  },

  verify(instance, answer) {
    try {
      if (!instance || !answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
      const runes = answer.runes;
      if (!Array.isArray(runes) || runes.length < 2 || runes.length > 16) return { ok: false };
      if (!runes.every((ch) => typeof ch === 'string' && ORDER_INDEX[ch] !== undefined)) return { ok: false };
      if (new Set(runes).size !== runes.length) return { ok: false };
      for (let i = 1; i < runes.length; i++) {
        if (ORDER_INDEX[runes[i]] <= ORDER_INDEX[runes[i - 1]]) {
          return { ok: false, near: 'Name them in the order of the row, from ᚠ onward.' };
        }
      }
      const carved = carvedMaskOf(instance);
      if (carved < 0) return { ok: false };
      const mine = maskOf(runes);
      if ((mine & ~carved) !== 0) return { ok: false, near: 'Your runes cut strokes the seal does not carry.' };
      if ((carved & ~mine) !== 0) return { ok: false, near: 'Strokes in the seal that none of your runes account for.' };
      for (const ch of runes) {
        if (maskOf(runes.filter((r) => r !== ch)) === carved) {
          return { ok: false, near: 'One of those runes adds nothing the others have not already cut.' };
        }
      }
      return { ok: true };
    } catch {
      return { ok: false };
    }
  },

  wrongAnswers(instance) {
    const self = this;
    const carved = carvedMaskOf(instance);
    const minimal = sweepSubsets(carved);
    const out = [];
    const seen = new Set();
    if (minimal.length !== 1) return out;
    const truth = sortRunes(minimal[0]);
    const { oneShort } = trapsFor(truth, carved);
    const push = (runes) => {
      const ans = { runes };
      const key = JSON.stringify(ans);
      if (seen.has(key) || self.verify(instance, ans).ok) return;
      seen.add(key);
      out.push(ans);
    };

    push(sortRunes(truth.concat(['ᛁ'])));                       // the covered trap
    for (const t of oneShort.slice(0, 2)) push(sortRunes(truth.concat([t]))); // one stroke over
    push(truth.slice(0, -1));                                    // one stroke short
    push(truth.slice(1));
    push(sortRunes(truth.slice(0, -1).concat([oneShort[0] || 'ᛁ'])));
    push(truth.slice().reverse());                               // right set, wrong order
    push(sortRunes(truth.concat(['ᚢ'])));                        // no stave at all
    push(sortRunes(truth.concat(['ᛋ'])));
    push(POOL.slice());                                          // every stave rune
    return out;
  },

  shard() {
    return { ...SHARDS['14-bindrune'] };
  },

  difficulty: { searchSpace: 6.6e4, minSteps: 32, estMinutes: 22 },

  hints: [
    'Every stroke in the seal belongs to some rune. Find the rune that owns each stroke, and you have found the seal.',
    'The long stave down the middle belongs to every rune that hangs on it — so it names none of them. Judge a rune by its branches only.',
    'A rune that could be lifted out without the carving losing a single stroke was never bound in. That is the whole test, and it disqualifies the ice-rune every time.',
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
    const nameOf = (ch) => (FUTHARK.find((r) => r.ch === ch) || {}).name || ch;
    const carved = carvedMaskOf(inst);
    const chosen = new Set(ctx.solved ? self.solve(inst).runes : []);

    // ---- frame -----------------------------------------------------------
    const wrap = node('div', `display:grid;gap:12px;font-family:${SERIF};color:${p.bone}`);
    const style = node('style');
    style.textContent = `
      .ow14-act{font-family:${SERIF};font-size:15px;color:${p.bone};background:${p.oakDeep};
        border:1px solid ${p.gold};border-radius:3px;padding:11px 16px;min-height:44px;cursor:pointer}
      .ow14-act:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow14-act[disabled]{opacity:.45;cursor:default}
      .ow14-row{display:flex;gap:7px;flex-wrap:wrap;justify-content:center}
      .ow14-cand{background:${p.oakDeep};border:1px solid ${p.oakLight};border-radius:4px;
        padding:6px 4px 4px;min-width:50px;min-height:74px;cursor:pointer;display:grid;justify-items:center;gap:2px;line-height:0}
      .ow14-cand:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow14-cand[aria-pressed="true"]{border-color:${p.gold};background:${p.oak}}
      .ow14-tag{font-family:${SERIF};font-size:10.5px;color:${p.boneDim};line-height:1.3}
      .ow14-cand[aria-pressed="true"] .ow14-tag{color:${p.goldBright}}
    `;
    wrap.append(style);

    const seal = art.makeCanvas(430, 430);
    seal.canvas.style.cssText = 'width:100%;max-width:430px;height:auto;display:block;margin:0 auto;border-radius:4px';
    seal.canvas.setAttribute('role', 'img');

    const legend = node('p', `margin:0;font-size:12.5px;color:${p.boneDim};max-width:60ch;text-align:center`,
      'Gold: strokes your runes account for. Red: strokes your runes would cut that the seal does not carry. '
      + 'Pale: strokes of the seal still unaccounted.');

    const candLabel = node('p', `margin:0;font-size:13px;color:${p.boneDim};letter-spacing:.06em;text-align:center`,
      'The sixteen of the row');
    const cands = node('div');
    cands.className = 'ow14-row';

    const candBtns = inst.candidates.map((ch) => {
      const b = node('button');
      b.className = 'ow14-cand';
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      const mini = art.makeCanvas(34, 46);
      mini.canvas.style.cssText = 'width:34px;height:46px;display:block';
      const tag = node('span', null, nameOf(ch));
      tag.className = 'ow14-tag';
      b.append(mini.canvas, tag);
      on(b, 'click', () => toggle(ch));
      cands.append(b);
      return { ch, b, mini };
    });

    const actions = node('div', 'display:flex;gap:9px;flex-wrap:wrap;align-items:center;justify-content:center');
    const clearBtn = node('button', null, 'Lift them all out');
    const sealBtn = node('button', null, 'Name the bound runes');
    for (const b of [clearBtn, sealBtn]) { b.className = 'ow14-act'; b.type = 'button'; }
    actions.append(clearBtn, sealBtn);

    const status = node('p', `margin:0;min-height:20px;font-size:14px;color:${p.boneDim};text-align:center`);
    status.setAttribute('aria-live', 'polite');

    wrap.append(seal.canvas, legend, candLabel, cands, actions, status);
    ctx.root.append(wrap);

    // ---- painting --------------------------------------------------------
    function strokeSegs(c, segs, size, ox, oy, colour, width, dash) {
      c.save();
      c.strokeStyle = colour;
      c.lineWidth = width;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      if (dash) c.setLineDash(dash);
      for (const seg of segs) {
        c.beginPath();
        seg.forEach(([sx, sy], i) => (i ? c.lineTo(ox + sx * size, oy + sy * size) : c.moveTo(ox + sx * size, oy + sy * size)));
        c.stroke();
      }
      c.restore();
    }

    function paint() {
      const c = seal.ctx;
      const W = seal.w;
      const H = seal.h;
      c.clearRect(0, 0, W, H);
      art.paintWood(c, W, H, 1404);
      art.paintPanel(c, 6, 6, W - 12, H - 12);
      const size = Math.min(W, H) - 96;
      const ox = (W - size) / 2;
      const oy = (H - size) / 2;

      const mine = maskOf([...chosen]);
      const covered = [];
      const bare = [];
      for (const segStr of SEGMENTS) {
        const bit = SEG_BIT.get(segStr);
        if ((carved & (1 << bit)) === 0) continue;
        ((mine & (1 << bit)) !== 0 ? covered : bare).push(JSON.parse(segStr));
      }
      const over = [];
      for (const segStr of SEGMENTS) {
        const bit = SEG_BIT.get(segStr);
        if ((mine & (1 << bit)) !== 0 && (carved & (1 << bit)) === 0) over.push(JSON.parse(segStr));
      }

      strokeSegs(c, bare.concat(covered), size, ox, oy, p.tar, size / 16);          // the cut itself
      strokeSegs(c, bare, size, ox, oy, p.boneDim, size / 26);
      strokeSegs(c, covered, size, ox, oy, p.gold, size / 22);
      strokeSegs(c, over, size, ox, oy, p.blood, size / 26, [6, 5]);
      return { covered: covered.length, bare: bare.length, over: over.length };
    }

    function paintCandidates() {
      for (const { ch, mini } of candBtns) {
        mini.ctx.clearRect(0, 0, mini.w, mini.h);
        const picked = chosen.has(ch);
        art.drawRune(mini.ctx, ch, 4, 3, 40, { color: picked ? p.goldBright : p.boneDim });
      }
    }

    function toggle(ch) {
      if (ctx.solved) return;
      if (chosen.has(ch)) { chosen.delete(ch); sfx('knock'); } else { chosen.add(ch); sfx('tick'); }
      say(`${chosen.has(ch) ? 'Laid' : 'Lifted'} ${nameOf(ch)} ${chosen.has(ch) ? 'onto' : 'from'} the seal.`);
      render('');
    }

    function render(announce) {
      const count = paint();
      paintCandidates();
      const picked = sortRunes([...chosen]);
      const words = picked.length
        ? `Named: ${picked.map(nameOf).join(', ')}. `
        : 'No rune is named yet. ';
      const tally = `${count.covered} of the seal's ${count.covered + count.bare} strokes accounted for`
        + (count.over ? `, and ${count.over} stroke${count.over > 1 ? 's' : ''} cut that the seal does not carry.` : '.');
      seal.canvas.setAttribute('aria-label', words + tally);
      for (const { ch, b } of candBtns) {
        b.setAttribute('aria-pressed', chosen.has(ch) ? 'true' : 'false');
        b.setAttribute('aria-label', `${nameOf(ch)}${chosen.has(ch) ? ', named in the seal' : ''}`);
      }
      sealBtn.disabled = !!ctx.solved || chosen.size < 2;
      if (announce !== undefined) status.textContent = announce || tally;
    }

    on(clearBtn, 'click', () => {
      if (ctx.solved) return;
      chosen.clear();
      sfx('knock');
      say('Every rune lifted off the seal.');
      render('');
    });
    on(sealBtn, 'click', () => {
      if (ctx.solved || chosen.size < 2) { sfx('deny'); return; }
      const runes = sortRunes([...chosen]);
      say(`Named the bind-rune: ${runes.map(nameOf).join(', ')}.`);
      const res = ctx.submit({ runes }) || {};
      if (!res.ok) status.textContent = res.near || 'The seal does not answer to those names.';
    });

    if (ctx.solved) {
      clearBtn.disabled = true;
      sealBtn.disabled = true;
      for (const { b } of candBtns) b.disabled = true;
    }

    say(`A bind-rune of ${inst.segments.length} strokes on one stave. Name every rune bound in it — and no rune that is not.`);
    render(ctx.solved ? 'The seal is read.' : '');

    return {
      unmount() {
        for (const f of cleanup) f();
        cleanup.length = 0;
        wrap.remove();
      },
    };
  },
};
