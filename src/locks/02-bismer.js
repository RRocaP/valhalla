// 02 — THE BISMER SCALES (tier 1, teaching)
//
// Nine sealed pouches of hacksilver, sworn to one weight. One was clipped and
// runs light. Two weighings are already carved into the ledger; name the pouch.
//
// Pure half: no DOM, no globals, no Math.random, no Date. Only the seeded rng.
//
// Uniqueness: each pouch is given a distinct role pair from {left, aside,
// right} x {left, aside, right} across the two weighings, so the two recorded
// tilts separate all nine hypotheses. makePuzzle sweeps the nine candidates and
// requires exactly one to reproduce the ledger.
//
// Difficulty accounting: nine sworn labels must be converted to ertog and two
// weighings read against them before the single naming — eight comparisons at
// the very least.

import { BY_CH, ORDER } from '../kernel/futhark.js';
import { SHARDS } from '../kernel/shards.js';

const COUNT = 9;
const ERTOG_PER_ORE = 3;
const ORE_PER_MARK = 8;
const ERTOG_PER_MARK = ERTOG_PER_ORE * ORE_PER_MARK; // 24
const SEALS = ORDER.slice(0, COUNT);
const SWORN = [36, 39, 42, 45, 48, 51];
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

  const pairs = [];
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) pairs.push([a, b]);
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

  // Exhaustive uniqueness over the nine hypotheses.
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
  return out;
}

// ------------------------------------------------------------------ the view

const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";
const MONO = "ui-monospace,'SF Mono',Menlo,monospace";

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
  const nameOf = (ch) => (BY_CH[ch] ? BY_CH[ch].name : ch);
  const sealName = (i) => nameOf(instance.pouches[i].seal);

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

  // ---- state -------------------------------------------------------------
  let accused = ctx.solved ? solve(instance).pouch : -1;
  let inErtog = false;
  const struck = instance.pouches.map(() => false);

  // ---- frame -------------------------------------------------------------
  const wrap = node('div', `display:grid;gap:14px;font-family:${SERIF};color:${p.bone}`);
  const style = node('style');
  style.textContent = `
    .ow2-pouch{display:grid;gap:4px;justify-items:center;background:${p.oakDeep};border:1px solid ${p.oakLight};
      border-radius:4px;padding:8px 6px;min-width:88px;min-height:96px;cursor:pointer;font-family:${SERIF};
      color:${p.bone};font-size:13px}
    .ow2-pouch:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    .ow2-pouch[aria-checked="true"]{border-color:${p.gold};background:${p.oak}}
    .ow2-pouch[data-struck="1"]{opacity:.45;text-decoration:line-through}
    .ow2-act{font-family:${SERIF};font-size:16px;color:${p.bone};background:${p.oakDeep};
      border:1px solid ${p.gold};border-radius:3px;padding:12px 20px;min-height:44px;cursor:pointer}
    .ow2-act:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    .ow2-act[disabled]{opacity:.5;cursor:default}
  `;
  wrap.append(style);

  const law = node('p', `margin:0;font-size:13px;color:${p.boneDim};line-height:1.5`,
    `Every pouch is sworn to the same weight: ${instance.swornErtog} ertog. `
    + 'One mark is eight øre; one øre is three ertog. The pan that sinks holds the heavier silver.');

  const beams = node('div', 'display:flex;flex-wrap:wrap;gap:12px;justify-content:center');
  const beamViews = instance.weighings.map((w, k) => {
    const box = node('div', 'display:grid;gap:4px;justify-items:center');
    const gfx = art.makeCanvas(300, 130);
    gfx.canvas.style.maxWidth = '100%';
    gfx.canvas.setAttribute('role', 'img');
    const sink = w.tilt === 'level' ? 'the beam hangs level' : `the ${w.tilt} pan sinks`;
    gfx.canvas.setAttribute('aria-label',
      `The ${k === 0 ? 'first' : 'second'} weighing: left pan ${w.left.map((i) => sealName(i)).join(', ')}; `
      + `right pan ${w.right.map((i) => sealName(i)).join(', ')}; `
      + `set aside ${w.aside.map((i) => sealName(i)).join(', ')}; ${sink}.`);
    const cap = node('p', `margin:0;font-size:12px;color:${p.boneDim}`,
      `${k === 0 ? 'First' : 'Second'} weighing — ${sink}`);
    box.append(gfx.canvas, cap);
    beams.append(box);
    return { gfx, w };
  });

  const reckon = node('button', null, 'Reckon the labels in ertog');
  reckon.className = 'ow2-act';
  reckon.type = 'button';

  const grid = node('div', 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center');
  grid.setAttribute('role', 'radiogroup');
  grid.setAttribute('aria-label', 'The nine pouches');

  const help = node('p', `margin:0;font-size:13px;color:${p.boneDim}`,
    'Choose the clipped pouch. By key: arrows to walk the pouches, space to name one, X to strike one out.');
  const status = node('p', `margin:0;min-height:20px;font-size:14px;color:${p.boneDim}`);
  status.setAttribute('aria-live', 'polite');

  const submitBtn = node('button', null, 'Name the pouch');
  submitBtn.className = 'ow2-act';
  submitBtn.type = 'button';
  submitBtn.disabled = true;

  wrap.append(law, beams, reckon, grid, help, submitBtn, status);
  ctx.root.append(wrap);

  // ---- painting ----------------------------------------------------------
  function paintBeam(view) {
    const { ctx: c, w: W, h: H } = view.gfx;
    const w = view.w;
    c.clearRect(0, 0, W, H);
    art.paintPanel(c, 0, 0, W, H, { title: null });

    const cx = W / 2, cy = 44, arm = 92;
    const drop = w.tilt === 'level' ? 0 : (w.tilt === 'left' ? 16 : -16);

    c.save();
    c.strokeStyle = p.oakLight;
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx, H - 16);
    c.stroke();

    c.strokeStyle = p.gold;
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(cx - arm, cy + drop);
    c.lineTo(cx + arm, cy - drop);
    c.stroke();
    c.restore();

    const pan = (px, py, ids) => {
      c.save();
      c.strokeStyle = p.oakLight;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(px, py + 20);
      c.stroke();
      c.beginPath();
      c.arc(px, py + 26, 16, Math.PI, 0, true);
      c.strokeStyle = p.gold;
      c.stroke();
      c.restore();
      ids.forEach((id, k) => {
        art.drawRune(c, instance.pouches[id].seal, px - 24 + k * 17, py + 26, 16,
          { color: id === accused ? p.goldBright : p.bone });
      });
    };
    pan(cx - arm, cy + drop, w.left);
    pan(cx + arm, cy - drop, w.right);

    c.save();
    c.fillStyle = p.boneDim;
    c.font = `12px ${SERIF}`;
    c.textAlign = 'center';
    c.fillText('set aside', cx, H - 26);
    c.restore();
    w.aside.forEach((id, k) => {
      art.drawRune(c, instance.pouches[id].seal, cx - 24 + k * 17, H - 22, 15,
        { color: id === accused ? p.goldBright : p.boneDim });
    });
  }

  const pouchViews = instance.pouches.map((pouch, i) => {
    const btn = node('div');
    btn.className = 'ow2-pouch';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('tabindex', i === 0 ? '0' : '-1');
    const gfx = art.makeCanvas(40, 40);
    const text = node('span', `font-family:${MONO};font-size:12px;text-align:center`);
    btn.append(gfx.canvas, text);
    grid.append(btn);
    return { i, btn, gfx, text };
  });

  function paintPouch(v) {
    const c = v.gfx.ctx;
    c.clearRect(0, 0, v.gfx.w, v.gfx.h);
    art.drawRune(c, instance.pouches[v.i].seal, 6, 2, 36,
      { color: v.i === accused ? p.goldBright : p.bone });
  }

  function render() {
    pouchViews.forEach((v) => {
      const pouch = instance.pouches[v.i];
      v.text.textContent = inErtog ? `${instance.swornErtog} ertog` : labelOf(pouch);
      v.btn.setAttribute('aria-checked', v.i === accused ? 'true' : 'false');
      v.btn.dataset.struck = struck[v.i] ? '1' : '0';
      v.btn.setAttribute('aria-label',
        `Pouch under the ${sealName(v.i)} seal, sworn ${labelOf(pouch)}`
        + (struck[v.i] ? ', struck out' : '') + (v.i === accused ? ', named' : ''));
      paintPouch(v);
    });
    beamViews.forEach(paintBeam);
    submitBtn.disabled = ctx.solved || accused < 0;
  }

  function accuse(i) {
    accused = i;
    pouchViews.forEach((v) => v.btn.setAttribute('tabindex', v.i === i ? '0' : '-1'));
    sfx('tick');
    render();
    const line = `The pouch under the ${sealName(i)} seal is named.`;
    status.textContent = line;
    say(line);
  }

  function strike(i) {
    struck[i] = !struck[i];
    sfx(struck[i] ? 'knock' : 'tick');
    render();
    const line = struck[i]
      ? `The ${sealName(i)} pouch is struck from the reckoning.`
      : `The ${sealName(i)} pouch is set back among the nine.`;
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
  });

  on(reckon, 'click', () => {
    inErtog = !inErtog;
    reckon.textContent = inErtog ? 'Read the labels as carved' : 'Reckon the labels in ertog';
    sfx('slide');
    render();
    const line = inErtog
      ? `Reckoned in ertog, every pouch is sworn at ${instance.swornErtog}.`
      : 'The labels stand as they were carved.';
    status.textContent = line;
    say(line);
  });

  function handle(res) {
    if (!res || res.ok) return;
    if (res.near) { status.textContent = res.near; say(res.near); }
  }

  on(submitBtn, 'click', () => {
    if (ctx.solved || accused < 0) return;
    sfx('confirm');
    let res;
    try { res = ctx.submit({ pouch: accused }); } catch (e) { return; }
    if (res && typeof res.then === 'function') res.then(handle, () => {});
    else handle(res);
  });

  // ---- open the lock -----------------------------------------------------
  render();
  say(`Nine pouches, each sworn at ${instance.swornErtog} ertog — one mark is eight øre, one øre three ertog.`);
  instance.weighings.forEach((w, k) => {
    const sink = w.tilt === 'level' ? 'the beam hung level' : `the ${w.tilt} pan sank`;
    say(`${k === 0 ? 'First' : 'Second'} weighing — left: ${w.left.map((i) => sealName(i)).join(', ')}; `
      + `right: ${w.right.map((i) => sealName(i)).join(', ')}; `
      + `aside: ${w.aside.map((i) => sealName(i)).join(', ')}. And ${sink}.`);
  });
  if (ctx.solved) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'The pouch is named';
    status.textContent = `The clipped silver lay under the ${sealName(accused)} seal.`;
  }

  return {
    unmount() {
      for (const off of cleanup) off();
      cleanup.length = 0;
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    },
  };
}

export default {
  id: '02-bismer',
  ordinal: 2,
  tier: 1,
  title: 'The Bismer Scales',
  epigraph: 'Nine pouches, one sworn weight. The beam has already spoken twice.',

  makePuzzle,
  solve,
  verify,
  wrongAnswers,
  shard: () => ({ ...SHARDS['02-bismer'] }),

  difficulty: {
    searchSpace: 9, // nine hypotheses; the work is in the ledger, not the search
    minSteps: 8,
    estMinutes: 3,
  },

  hints: [
    'Every pouch is sworn to the same weight. Read the labels in ertog before you trust your eye: eight øre to the mark, three ertog to the øre.',
    'The pan that sinks holds the heavier silver. A level beam says the clipped pouch stood aside from that weighing.',
    'Each weighing cuts the nine into three — left pan, right pan, set aside. Two cuts leave one pouch standing alone.',
  ],

  mount,
};
