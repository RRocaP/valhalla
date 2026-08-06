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
  const node = (tag, css, text) => {
    const n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  };

  // ---- state (visual stack runs sheer at the top, keel at the foot) -------
  const truth = ctx.solved ? solve(instance) : null;
  const stack = truth ? truth.order.slice().reverse() : instance.planks.map((_, i) => i);
  let accused = truth ? truth.liar : -1;
  let held = -1;

  const wrap = node('div', `display:grid;gap:14px;font-family:${SERIF};color:${p.bone}`);
  const style = node('style');
  style.textContent = `
    .ow4-cols{display:grid;gap:16px;grid-template-columns:1fr}
    @media (min-width:760px){.ow4-cols{grid-template-columns:1fr 1fr}}
    .ow4-say{display:block;width:100%;text-align:left;font-family:${SERIF};font-size:14px;line-height:1.45;
      color:${p.bone};background:${p.oakDeep};border:1px solid ${p.oakLight};border-radius:3px;
      padding:10px 12px;min-height:44px;cursor:pointer}
    .ow4-say:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    .ow4-say[aria-checked="true"]{border-color:${p.blood};color:${p.boneDim};text-decoration:line-through}
    .ow4-plank{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:0;
      padding:2px;cursor:grab;touch-action:none;border-radius:3px;font-family:${SERIF};color:${p.bone}}
    .ow4-plank:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    .ow4-plank[data-held="1"]{cursor:grabbing}
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
  submitBtn.className = 'ow4-act';
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
    return { id, btn, gfx, text };
  });

  function paintPlank(v) {
    const c = v.gfx.ctx;
    const { w, h } = v.gfx;
    const plank = instance.planks[v.id];
    c.clearRect(0, 0, w, h);
    c.save();
    c.fillStyle = held === v.id ? p.oakLight : p.oak;
    c.fillRect(0, 6, w, h - 12);
    c.strokeStyle = p.tar;
    c.lineWidth = 1;
    c.strokeRect(0.5, 6.5, w - 1, h - 13);
    c.fillStyle = held === v.id ? p.goldBright : p.gold;
    const n = plank.rivets;
    const gap = (w - 12) / Math.max(1, n - 1);
    for (let i = 0; i < n; i++) {
      c.beginPath();
      c.arc(6 + gap * i, h / 2, 1.8, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  function render() {
    stack.forEach((id, place) => {
      const v = plankViews[id];
      stackList.append(v.btn);
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
      drag = { id: v.id, y: ev.clientY, moved: false };
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
      if (moveTo(v.id, nearestPlace(ev.clientY))) { sfx('tick'); render(); }
    });
    const finish = (ev) => {
      if (!drag || drag.id !== v.id) return;
      const moved = drag.moved;
      drag = null;
      held = -1;
      try { v.btn.releasePointerCapture(ev.pointerId); } catch (e) { /* already gone */ }
      render();
      if (moved) { sfx('knock'); reportMove(v.id); }
    };
    on(v.btn, 'pointerup', finish);
    on(v.btn, 'pointercancel', () => { drag = null; held = -1; render(); });

    on(v.btn, 'keydown', (ev) => {
      if (ctx.solved) return;
      const place = stack.indexOf(v.id);
      const step = (d) => {
        if (held === v.id) {
          if (moveTo(v.id, place + d)) { sfx('slide'); render(); reportMove(v.id); }
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
        held = held === v.id ? -1 : v.id;
        sfx(held === v.id ? 'slide' : 'knock');
        render();
        status.textContent = held === v.id
          ? `${markOf(v.id)} is lifted. The arrows move it; space sets it down.`
          : `${markOf(v.id)} is set down.`;
      }
    });
  });

  function handle(res) {
    if (!res || res.ok) return;
    if (res.near) { status.textContent = res.near; say(res.near); }
  }

  on(submitBtn, 'click', () => {
    if (ctx.solved || accused < 0) return;
    sfx('confirm');
    let res;
    try { res = ctx.submit({ order: stack.slice().reverse(), liar: accused }); } catch (e) { return; }
    if (res && typeof res.then === 'function') res.then(handle, () => {});
    else handle(res);
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
