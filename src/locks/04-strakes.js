// 04 — THE CLINKER STRAKES (tier 2, combination)
//
// Nine planks, nine sworn testimonies of the form "X laps Y" — X rests directly
// upon Y. One shipwright swears falsely. Name the false testimony and raise the
// stack from keel to sheer.
//
// THE TWO LAWS (stated plainly to the player in the journal):
//   lap law   — a strake laps the one below it and no other; nine planks, one stack.
//   rivet law — where two strakes lap, one rivet count is odd and the other even.
//
// Pure half: no DOM, no globals, no Math.random, no Date. Only the seeded rng.
//
// CONSTRUCTION. The eight true adjacencies are given, plus one false claim that
// closes the ring: the keel-most plank is sworn to lap the sheer strake. The
// nine claims therefore form a nine-cycle, so *any* one of them may be struck
// out to leave exactly one legal stack — nine structurally identical
// candidates. Only the rivet law separates them: rivet counts alternate parity
// along the true stack, so the false claim joins two planks eight apart (even
// distance, same parity — lawless), every true claim joins planks of opposite
// parity, and each of the eight decoy stacks is a rotation of the truth that
// breaks parity exactly at its wrap. Exactly one (order, liar) pair survives.
//
// Difficulty accounting: nine testimonies each weighed against the rivet law,
// the false one marked, then the stack raised — never fewer than twelve acts.

import { SHARDS } from '../kernel/shards.js';

const COUNT = 9;
const PERM_CAP = 5040;

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
  const chain = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]); // keel -> sheer
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

  // The eight rotations: each strikes a true testimony and keeps the lie, which
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

const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";
const MONO = "ui-monospace,'SF Mono',Menlo,monospace";
const PLACE = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth'];

function mount(ctx) {
  const art = ctx.art;
  const p = art.palette;
  const instance = ctx.instance;
  const markOf = (i) => instance.planks[i].mark;

  const cleanup = [];
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

  // Deterministic per-plank micro-noise (view-only).
  const h32 = (n) => {
    let x = (n | 0) + 0x9e3779b9;
    x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
    x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
    return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
  };

  // ---- state (visual stack runs sheer at the top, keel at the foot) -------
  const truth = ctx.solved ? solve(instance) : null;
  const stack = truth ? truth.order.slice().reverse() : instance.planks.map((_, i) => i);
  let accused = truth ? truth.liar : -1;
  let held = -1;
  let keysSaid = false;
  let nearTest = -1;            // a testimony wrongly accused (it keeps the law)
  const nearPlank = new Map();  // plank id -> { tick, brk, tieT, tieB }

  const wrap = node('div', `display:grid;gap:14px;font-family:${SERIF};color:${p.bone}`);
  const style = node('style');
  style.textContent = `
    .ow4-cols{display:grid;gap:16px;grid-template-columns:1fr}
    @media (min-width:760px){.ow4-cols{grid-template-columns:1fr 1fr}}
    .ow4-say{display:block;width:100%;text-align:left;font-family:${SERIF};font-size:14px;line-height:1.45;
      color:${p.bone};background:${p.oakDeep};border:1px solid ${p.oakLight};border-radius:3px;
      padding:10px 12px;min-height:44px;cursor:pointer;transition:border-color .12s ease}
    .ow4-say:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    .ow4-say[aria-checked="true"]{border-color:${p.blood};color:${p.boneDim};text-decoration:line-through}
    .ow4-say[data-near="1"]{border-color:${p.ember}}
    .ow4-plank{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:0;
      padding:2px;cursor:grab;touch-action:none;border-radius:3px;font-family:${SERIF};color:${p.bone};
      filter:drop-shadow(0 2px 2px rgba(12,9,6,.5));
      transition:transform .12s ease,filter .12s ease}
    .ow4-plank:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    .ow4-plank[data-held="1"]{cursor:grabbing;transform:translateY(-2px);
      filter:drop-shadow(0 6px 6px rgba(12,9,6,.65))}
    @media (prefers-reduced-motion: reduce){
      .ow4-say,.ow4-plank{transition:none}
      .ow4-plank[data-held="1"]{transform:none}
    }
    .ow4-act{font-family:${SERIF};font-size:16px;color:${p.bone};background:${p.oakDeep};
      border:1px solid ${p.gold};border-radius:3px;padding:12px 20px;min-height:44px;cursor:pointer}
    .ow4-act:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    .ow4-act[disabled]{opacity:.5;cursor:default}
    .ow4-end{font-size:12px;color:${p.boneDim};letter-spacing:.12em;text-transform:uppercase}
  `;
  wrap.append(style);

  const law = node('p', `margin:0;font-size:13px;color:${p.boneDim};line-height:1.5`,
    'Lap law: a strake laps the one below it and no other. Nine planks, one stack. '
    + 'Rivet law: where two strakes lap, one rivet count is odd and the other even. One testimony is false.');

  const cols = node('div');
  cols.className = 'ow4-cols';

  const sayList = node('div', 'display:grid;gap:6px;align-content:start');
  sayList.setAttribute('role', 'radiogroup');
  sayList.setAttribute('aria-label', 'The nine testimonies — choose the false one');

  const stackBox = node('div', 'display:grid;gap:6px;align-content:start');
  const stackList = node('div', 'display:grid;gap:3px');
  stackList.setAttribute('role', 'list');
  stackList.setAttribute('aria-label', 'The stack, sheer strake at the top, keel at the foot');
  stackBox.append(node('p', null, 'sheer'), stackList, node('p', null, 'keel'));
  stackBox.children[0].className = 'ow4-end';
  stackBox.children[2].className = 'ow4-end';

  cols.append(sayList, stackBox);

  const help = node('p', `margin:0;font-size:13px;color:${p.boneDim}`,
    'Drag a plank to move it, or lift it with space and move it with the up and down arrows. '
    + 'Choose the false testimony on the left.');
  const status = node('p', `margin:0;min-height:20px;font-size:14px;color:${p.boneDim}`);
  status.setAttribute('aria-live', 'polite');

  const submitBtn = node('button', null, 'Raise the stack');
  submitBtn.className = 'btn-carved'; // one primary-action language: the carved gold plate
  submitBtn.type = 'button';
  submitBtn.disabled = true;

  wrap.append(law, cols, help, submitBtn, status);
  ctx.root.append(wrap);

  // ---- testimonies -------------------------------------------------------
  const sayViews = instance.testimonies.map((t, k) => {
    const btn = node('button');
    btn.className = 'ow4-say';
    btn.type = 'button';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('tabindex', k === 0 ? '0' : '-1');
    const line = `${t.by} swears: ${markOf(t.over)} laps ${markOf(t.under)}.`;
    const rivets = `${instance.planks[t.over].rivets} over ${instance.planks[t.under].rivets}`;
    btn.append(node('span', null, line), node('span', `font-family:${MONO};font-size:12px;color:${p.boneDim}`, ' ' + rivets));
    sayList.append(btn);
    return { k, btn, line, rivets };
  });

  function accuse(k) {
    accused = k;
    clearNear();
    sayViews.forEach((v) => {
      v.btn.setAttribute('aria-checked', v.k === k ? 'true' : 'false');
      v.btn.setAttribute('tabindex', v.k === k ? '0' : '-1');
      v.btn.setAttribute('aria-label', v.line + ' Rivets: ' + v.rivets + (v.k === k ? '. Sworn false.' : '.'));
    });
    sfx('knock');
    submitBtn.disabled = ctx.solved || accused < 0;
    const line = `${instance.testimonies[k].by}'s word is struck from the ledger.`;
    status.textContent = line;
    say(line);
  }

  sayViews.forEach((v) => {
    on(v.btn, 'click', () => { if (!ctx.solved) accuse(v.k); });
    on(v.btn, 'keydown', (ev) => {
      if (ctx.solved) return;
      const n = sayViews.length;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') {
        ev.preventDefault(); const x = sayViews[(v.k + 1) % n]; x.btn.focus(); accuse(x.k);
      } else if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') {
        ev.preventDefault(); const x = sayViews[(v.k - 1 + n) % n]; x.btn.focus(); accuse(x.k);
      }
    });
    on(v.btn, 'focus', () => {
      if (keysSaid) return;
      keysSaid = true;
      say('By key: on the testimonies, arrows walk and the walked one is accused; on the planks, '
        + 'space lifts, up and down move what is lifted, space sets it down.');
    });
  });

  // ---- the stack ---------------------------------------------------------
  const plankViews = instance.planks.map((plank, id) => {
    const btn = node('button');
    btn.className = 'ow4-plank';
    btn.type = 'button';
    btn.setAttribute('role', 'listitem');
    const gfx = art.makeCanvas(200, 30);
    gfx.canvas.style.maxWidth = '100%';
    const text = node('span', 'font-size:13px;line-height:1.2');
    btn.append(gfx.canvas, text);
    return { id, btn, gfx, text, key: '' };
  });

  function clearNear() {
    if (nearTest < 0 && !nearPlank.size) return;
    nearTest = -1;
    nearPlank.clear();
    sayViews.forEach((sv) => { sv.btn.dataset.near = '0'; });
    render();
  }

  // a set-down plank slides home along its own grain
  function settle(btn) {
    if (reduced() || typeof btn.animate !== 'function') return;
    btn.animate(
      [{ transform: 'translateX(-6px)' }, { transform: 'translateX(1.5px)' }, { transform: 'translateX(0)' }],
      { duration: 150, easing: 'ease-out' },
    );
  }

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

  // each mark wears its name: tar wash, salt bloom, a knot, a scarf joint …
  function markFeature(c, v, x0, y0, x1, y1) {
    const kind = instance.planks[v.id].mark.split(' ')[1];
    const mw = x1 - x0, mh = y1 - y0, midY = (y0 + y1) / 2;
    c.save();
    if (kind === 'tarred') {
      c.fillStyle = p.tar; c.globalAlpha = 0.34; c.fillRect(x0, y0, mw, mh);
      c.globalAlpha = 0.5; c.lineWidth = 1; c.strokeStyle = p.tar;
      for (let k = 0; k < 4; k++) {
        const sx = x0 + h32(v.id * 17 + k) * mw;
        c.beginPath(); c.moveTo(sx, y0); c.lineTo(sx - 3, y1); c.stroke();
      }
    } else if (kind === 'pale') {
      c.fillStyle = p.bone; c.globalAlpha = 0.13; c.fillRect(x0, y0, mw, mh);
    } else if (kind === 'knotted') {
      const kx = x0 + mw * (0.3 + h32(v.id) * 0.4);
      c.strokeStyle = p.oakDeep; c.globalAlpha = 0.85; c.lineWidth = 1.2;
      for (const rr of [3.4, 5.6]) {
        c.beginPath();
        if (typeof c.ellipse === 'function') c.ellipse(kx, midY, rr + 1.4, rr, 0.3, 0, Math.PI * 2);
        else c.arc(kx, midY, rr, 0, Math.PI * 2);
        c.stroke();
      }
      c.fillStyle = p.tar; c.beginPath(); c.arc(kx, midY, 2.1, 0, Math.PI * 2); c.fill();
    } else if (kind === 'scarfed') {
      const sx = x0 + mw * 0.34;
      c.strokeStyle = p.tar; c.globalAlpha = 0.8; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(sx, y0); c.lineTo(sx + 14, y1); c.stroke();
      c.strokeStyle = p.oakLight; c.globalAlpha = 0.5; c.lineWidth = 1;
      c.beginPath(); c.moveTo(sx + 1.6, y0); c.lineTo(sx + 15.6, y1); c.stroke();
    } else if (kind === 'salt-white') {
      c.fillStyle = p.bone;
      for (let k = 0; k < 26; k++) {
        c.globalAlpha = 0.1 + h32(v.id * 29 + k) * 0.22;
        const sx = x0 + h32(v.id * 31 + k) * mw;
        const sy = y0 + h32(v.id * 37 + k) * mh;
        c.beginPath(); c.arc(sx, sy, 0.7 + h32(v.id * 41 + k) * 0.8, 0, Math.PI * 2); c.fill();
      }
    } else if (kind === 'resined') {
      const rx = x0 + mw * 0.6;
      const g = c.createRadialGradient(rx, midY, 1, rx, midY, mw * 0.3);
      g.addColorStop(0, p.ember); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.2; c.fillStyle = g; c.fillRect(x0, y0, mw, mh);
      c.globalAlpha = 0.28; c.strokeStyle = p.goldBright; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x0 + mw * 0.45, y0 + 2); c.lineTo(x0 + mw * 0.78, y0 + 2); c.stroke();
    } else if (kind === 'green') {
      c.fillStyle = p.pine; c.globalAlpha = 0.26; c.fillRect(x0, y0, mw, mh);
      c.fillStyle = p.pineLight; c.globalAlpha = 0.14; c.fillRect(x0, y0, mw, mh / 2);
    } else if (kind === 'split') {
      c.strokeStyle = p.tar; c.globalAlpha = 0.9; c.lineWidth = 1.3;
      c.beginPath();
      c.moveTo(x0, midY - 1);
      for (let k = 1; k <= 5; k++) {
        c.lineTo(x0 + (mw * 0.52 * k) / 5, midY - 1 + (h32(v.id * 43 + k) - 0.5) * 4);
      }
      c.stroke();
    } else if (kind === 'burnt') {
      const g = c.createLinearGradient(x1 - mw * 0.3, 0, x1, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, p.tar);
      c.globalAlpha = 0.78; c.fillStyle = g; c.fillRect(x1 - mw * 0.3, y0, mw * 0.3, mh);
      c.fillStyle = p.ember;
      for (let k = 0; k < 3; k++) {
        c.globalAlpha = 0.4 + h32(v.id * 47 + k) * 0.3;
        c.beginPath();
        c.arc(x1 - mw * (0.22 + h32(v.id * 53 + k) * 0.08), y0 + 2 + h32(v.id * 59 + k) * (mh - 4), 0.9, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.restore();
  }

  function paintPlank(v) {
    const flags = nearPlank.get(v.id);
    const key = `${held === v.id}|${flags ? `${flags.tick}${flags.brk}${flags.tieT}${flags.tieB}` : ''}`;
    if (v.key === key) return; // repaint only on a real state change
    v.key = key;

    const c = v.gfx.ctx;
    const { w, h } = v.gfx;
    const plank = instance.planks[v.id];
    const lifted = held === v.id;
    const x0 = 0, y0 = 4, x1 = w, y1 = h - 4;
    c.clearRect(0, 0, w, h);

    // the plank body, lit from above
    c.save();
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, lifted ? mixHex(p.oakLight, p.goldBright, 0.12) : p.oakLight);
    g.addColorStop(0.45, lifted ? p.oakLight : p.oak);
    g.addColorStop(1, p.oakDeep);
    c.fillStyle = g;
    c.fillRect(x0, y0, x1 - x0, y1 - y0);

    // grain running the plank's length
    c.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      const gy = y0 + 4 + h32(v.id * 11 + k) * (y1 - y0 - 8);
      const sway = (h32(v.id * 19 + k) - 0.5) * 4;
      c.strokeStyle = k % 2 ? p.oakDeep : p.oakLight;
      c.globalAlpha = 0.16 + h32(v.id * 23 + k) * 0.1;
      c.beginPath();
      c.moveTo(x0 + 2, gy);
      c.bezierCurveTo(w * 0.33, gy + sway, w * 0.66, gy - sway, x1 - 2, gy);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.restore();

    markFeature(c, v, x0, y0, x1, y1);

    // clinker shading: the lap shadow above, the catch light below
    c.save();
    const lap = c.createLinearGradient(0, y0, 0, y0 + 6);
    lap.addColorStop(0, p.tar); lap.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = 0.55; c.fillStyle = lap; c.fillRect(x0, y0, x1 - x0, 6);
    c.globalAlpha = 0.5; c.strokeStyle = p.oakLight; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x0, y1 - 0.5); c.lineTo(x1, y1 - 0.5); c.stroke();
    c.globalAlpha = 0.9; c.strokeStyle = p.tar;
    c.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
    c.restore();

    // rivets: a cast shadow first, then the lit dome
    const n = plank.rivets;
    const gap = (w - 12) / Math.max(1, n - 1);
    for (let i = 0; i < n; i++) {
      const rx = 6 + gap * i, ry = h / 2;
      c.save();
      c.fillStyle = p.tar;
      c.globalAlpha = 0.55;
      c.beginPath(); c.arc(rx + 0.9, ry + 1.2, 2.1, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
      const dome = c.createRadialGradient(rx - 0.6, ry - 0.6, 0.2, rx, ry, 2);
      dome.addColorStop(0, lifted ? p.goldBright : mixHex(p.gold, p.goldBright, 0.5));
      dome.addColorStop(1, mixHex(p.gold, p.tar, 0.45));
      c.fillStyle = dome;
      c.beginPath(); c.arc(rx, ry, 1.9, 0, Math.PI * 2); c.fill();
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
        c.beginPath(); c.moveTo(x0 + 5, h / 2 + 2); c.lineTo(x0 + 8, h / 2 + 5); c.lineTo(x0 + 13, h / 2 - 4); c.stroke();
        c.strokeStyle = p.gold; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x0 + 5, h / 2 + 2); c.lineTo(x0 + 8, h / 2 + 5); c.lineTo(x0 + 13, h / 2 - 4); c.stroke();
      }
      c.restore();
    }
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
      v.text.textContent = `${plank.mark} · ${plank.rivets} rivets`;
      v.btn.dataset.held = held === id ? '1' : '0';
      v.btn.setAttribute('aria-label',
        `${plank.mark}, ${plank.rivets} rivets, ${PLACE[fromKeel - 1]} strake from the keel`
        + (held === id ? ', lifted' : ''));
      paintPlank(v);
    });
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
    const line = `${markOf(id)} lies ${PLACE[fromKeel - 1]} from the keel.`;
    status.textContent = line;
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
      if (ev.key === 'ArrowUp') { ev.preventDefault(); step(-1); }
      else if (ev.key === 'ArrowDown') { ev.preventDefault(); step(1); }
      else if (ev.key === ' ' || ev.key === 'Spacebar' || ev.key === 'Enter') {
        ev.preventDefault();
        const wasHeld = held === v.id;
        held = wasHeld ? -1 : v.id;
        sfx(wasHeld ? 'knock' : 'slide');
        render();
        if (wasHeld) settle(v.btn);
        status.textContent = wasHeld
          ? `${markOf(v.id)} is set down.`
          : `${markOf(v.id)} is lifted. The arrows move it; space sets it down.`;
      }
    });

    on(v.btn, 'focus', () => {
      if (keysSaid) return;
      keysSaid = true;
      say('By key: on the testimonies, arrows walk and the walked one is accused; on the planks, '
        + 'space lifts, up and down move what is lifted, space sets it down.');
    });
  });

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
      render();
    }
    if (res.near) { status.textContent = res.near; say(res.near); }
  }

  on(submitBtn, 'click', () => {
    if (ctx.solved || accused < 0) return;
    sfx('confirm');
    const sent = { order: stack.slice().reverse(), liar: accused };
    let res;
    try { res = ctx.submit(sent); } catch (e) { return; }
    if (res && typeof res.then === 'function') res.then((r) => handle(r, sent), () => {});
    else handle(res, sent);
  });

  // ---- open the lock -----------------------------------------------------
  render();
  if (accused >= 0) accuse(accused);
  say('Lap law: a strake laps the one below it and no other. Rivet law: where two strakes lap, one rivet count is odd and the other even.');
  instance.testimonies.forEach((t) => {
    say(`${t.by} swears: ${markOf(t.over)} (${instance.planks[t.over].rivets} rivets) laps `
      + `${markOf(t.under)} (${instance.planks[t.under].rivets} rivets).`);
  });
  if (ctx.solved) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'The stack stands';
    status.textContent = 'The stack stands from keel to sheer, and the false oath is struck.';
  }

  return {
    unmount() {
      for (const off of cleanup) off();
      cleanup.length = 0;
      drag = null;
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    },
  };
}

export default {
  id: '04-strakes',
  ordinal: 4,
  tier: 2,
  title: 'The Clinker Strakes',
  epigraph: 'Nine planks, and nine men who swear. One swears falsely.',

  makePuzzle,
  solve,
  verify,
  wrongAnswers,
  shard: () => ({ ...SHARDS['04-strakes'] }),

  difficulty: {
    searchSpace: 3265920, // 9! stacks x 9 testimonies
    minSteps: 12,
    estMinutes: 5,
  },

  hints: [
    'A strake laps the one below it and no other. Nine planks make one stack, keel to sheer — and these nine testimonies make a ring, which no stack can.',
    'Count the rivets. Where two strakes lap, one count is odd and the other even. Weigh every testimony against that.',
    'Strike the lawless testimony from the ledger and swear by the other eight. What they leave is one stack and no other.',
  ],

  mount,
};
