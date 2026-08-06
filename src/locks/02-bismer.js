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
  let keysSaid = false;
  let nearWeighing = -1; // the weighing that already clears a wrongly named pouch
  const struck = instance.pouches.map(() => false);

  // ---- frame -------------------------------------------------------------
  const wrap = node('div', `display:grid;gap:14px;font-family:${SERIF};color:${p.bone}`);
  const style = node('style');
  style.textContent = `
    .ow2-pouch{display:grid;gap:4px;justify-items:center;background:${p.oakDeep};border:1px solid ${p.oakLight};
      border-radius:4px;padding:8px 6px;min-width:88px;min-height:96px;cursor:pointer;font-family:${SERIF};
      color:${p.bone};font-size:13px;
      transition:transform .12s ease,border-color .12s ease,box-shadow .12s ease}
    .ow2-pouch:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    .ow2-pouch[aria-checked="true"]{border-color:${p.gold};background:${p.oak};
      transform:translateY(-2px);box-shadow:0 4px 8px rgba(12,9,6,.6)}
    .ow2-pouch[data-struck="1"]{opacity:.45;text-decoration:line-through}
    .ow2-act{font-family:${SERIF};font-size:16px;color:${p.bone};background:${p.oakDeep};
      border:1px solid ${p.gold};border-radius:3px;padding:12px 20px;min-height:44px;cursor:pointer}
    .ow2-act:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    .ow2-act[disabled]{opacity:.5;cursor:default}
    @media (prefers-reduced-motion: reduce){
      .ow2-pouch{transition:none}
      .ow2-pouch[aria-checked="true"]{transform:none}
    }
  `;
  wrap.append(style);

  const law = node('p', `margin:0;font-size:13px;color:${p.boneDim};line-height:1.5`,
    `Every pouch is sworn to the same weight: ${instance.swornErtog} ertog — one mark is eight øre, one øre three ertog. `
    + 'One pouch was clipped, and runs light. The pan that sinks holds the heavier silver.');

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
    return { gfx, w, k };
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

    // the post, carved and footed
    c.save();
    c.strokeStyle = p.tar;
    c.lineWidth = 5;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx + 1, cy + 1); c.lineTo(cx + 1, H - 15); c.stroke();
    c.strokeStyle = p.oakLight;
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, H - 16); c.stroke();
    c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(cx - 12, H - 15); c.lineTo(cx + 12, H - 15); c.stroke();
    c.restore();

    // the beam: dark under-stroke, gold over, bright streak — then the pivot nail
    c.save();
    c.lineCap = 'round';
    c.strokeStyle = p.tar;
    c.lineWidth = 6;
    c.beginPath(); c.moveTo(cx - arm + 1, cy + drop + 1.4); c.lineTo(cx + arm + 1, cy - drop + 1.4); c.stroke();
    const bg = c.createLinearGradient(cx - arm, cy + drop, cx + arm, cy - drop);
    bg.addColorStop(0, p.gold);
    bg.addColorStop(0.5, p.goldBright);
    bg.addColorStop(1, p.gold);
    c.strokeStyle = bg;
    c.lineWidth = 4;
    c.beginPath(); c.moveTo(cx - arm, cy + drop); c.lineTo(cx + arm, cy - drop); c.stroke();
    c.restore();
    art.ornament(c, 'nailhead', cx, cy, 11);

    // a hanging chain of four links, bronze gone green where the sea got at it
    const chain = (px, py0, py1, side) => {
      const links = 4;
      const step = (py1 - py0) / links;
      for (let i = 0; i < links; i++) {
        const ly = py0 + step * (i + 0.5);
        const worn = (i + side + view.k) % 3 === 0;
        c.save();
        c.strokeStyle = worn ? p.pineLight : p.gold;
        c.globalAlpha = worn ? 0.9 : 0.85;
        c.lineWidth = 1.6;
        c.beginPath();
        if (typeof c.ellipse === 'function') c.ellipse(px, ly, 2.2, Math.abs(step) * 0.42, 0, 0, Math.PI * 2);
        else c.arc(px, ly, 2.6, 0, Math.PI * 2);
        c.stroke();
        if (worn) {
          c.fillStyle = p.pine;
          c.globalAlpha = 0.5;
          c.beginPath(); c.arc(px + 1.1, ly + 1, 1.1, 0, Math.PI * 2); c.fill();
        }
        c.restore();
      }
    };

    const pan = (px, py, ids, side) => {
      chain(px, py, py + 20, side);
      // the pan: a shallow lit bowl
      c.save();
      c.beginPath();
      c.arc(px, py + 26, 16, Math.PI, 0, true);
      c.closePath();
      const pg = c.createLinearGradient(px, py + 26, px, py + 42);
      pg.addColorStop(0, mixHex(p.gold, p.goldBright, 0.3));
      pg.addColorStop(1, mixHex(p.gold, p.tar, 0.55));
      c.fillStyle = pg;
      c.fill();
      c.strokeStyle = p.tar;
      c.globalAlpha = 0.7;
      c.lineWidth = 1.2;
      c.stroke();
      c.globalAlpha = 1;
      c.strokeStyle = p.goldBright;
      c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(px - 16, py + 26); c.lineTo(px + 16, py + 26); c.stroke();
      c.restore();
      ids.forEach((id, k) => {
        art.drawRune(c, instance.pouches[id].seal, px - 21 + k * 15, py + 27, 13,
          { color: id === accused ? p.goldBright : p.bone });
      });
    };
    pan(cx - arm, cy + drop, w.left, 0);
    pan(cx + arm, cy - drop, w.right, 1);

    // the aside shelf
    c.save();
    c.fillStyle = p.boneDim;
    c.font = `12px ${SERIF}`;
    c.textAlign = 'center';
    c.fillText('set aside', cx, H - 30);
    c.strokeStyle = p.tar;
    c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(cx - 30, H - 8); c.lineTo(cx + 30, H - 8); c.stroke();
    c.strokeStyle = p.oakLight;
    c.globalAlpha = 0.5;
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(cx - 30, H - 6.6); c.lineTo(cx + 30, H - 6.6); c.stroke();
    c.restore();
    w.aside.forEach((id, k) => {
      art.drawRune(c, instance.pouches[id].seal, cx - 22 + k * 16, H - 24, 14,
        { color: id === accused ? p.goldBright : p.boneDim });
    });

    // near-miss: this weighing already cleared the named pouch
    if (view.k === nearWeighing) {
      c.save();
      c.strokeStyle = p.ember;
      c.lineWidth = 2;
      c.strokeRect(5.5, 5.5, W - 11, H - 11);
      c.restore();
    }
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
    const { w, h } = v.gfx;
    const named = v.i === accused;
    c.clearRect(0, 0, w, h);

    // the leather sack, gathered at the neck
    const bx = w / 2, neck = 9;
    c.save();
    c.beginPath();
    c.moveTo(bx - 6, neck);
    c.bezierCurveTo(bx - 17, neck + 8, bx - 16, h - 3, bx, h - 3);
    c.bezierCurveTo(bx + 16, h - 3, bx + 17, neck + 8, bx + 6, neck);
    c.closePath();
    const g = c.createLinearGradient(0, neck, 0, h);
    g.addColorStop(0, p.oakLight);
    g.addColorStop(1, p.oakDeep);
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = p.tar;
    c.lineWidth = 1.2;
    c.stroke();
    // gathered folds above the tie
    c.strokeStyle = p.oakLight;
    c.globalAlpha = 0.8;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(bx - 4, 3); c.lineTo(bx - 2, neck - 1);
    c.moveTo(bx + 1, 2); c.lineTo(bx + 1, neck - 1);
    c.moveTo(bx + 5, 4); c.lineTo(bx + 3, neck - 1);
    c.stroke();
    // the tie
    c.globalAlpha = 1;
    c.strokeStyle = named ? p.goldBright : p.gold;
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(bx - 7, neck); c.lineTo(bx + 7, neck); c.stroke();
    c.restore();

    // the wax seal, stamped with the pouch's rune
    const sy = neck + (h - 3 - neck) / 2 + 1;
    c.save();
    c.fillStyle = p.blood;
    c.beginPath(); c.arc(bx, sy, 10, 0, Math.PI * 2); c.fill();
    c.strokeStyle = named ? p.goldBright : p.tar;
    c.globalAlpha = named ? 0.9 : 0.5;
    c.lineWidth = 1.2;
    c.stroke();
    c.restore();
    art.drawRune(c, instance.pouches[v.i].seal, bx - 7, sy - 7, 14,
      { color: named ? p.goldBright : p.bone });
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
    nearWeighing = -1;
    pouchViews.forEach((v) => v.btn.setAttribute('tabindex', v.i === i ? '0' : '-1'));
    sfx('tick');
    render();
    const line = `The pouch under the ${sealName(i)} seal is named.`;
    status.textContent = line;
    say(line);
  }

  function strike(i) {
    struck[i] = !struck[i];
    nearWeighing = -1;
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
    on(v.btn, 'focus', () => {
      if (keysSaid) return;
      keysSaid = true;
      say('By key: arrows walk the pouches; space or Enter names one; X strikes one from the reckoning.');
    });
  });

  on(reckon, 'click', () => {
    inErtog = !inErtog;
    nearWeighing = -1;
    reckon.textContent = inErtog ? 'Read the labels as carved' : 'Reckon the labels in ertog';
    sfx('slide');
    render();
    const line = inErtog
      ? `Reckoned in ertog, every pouch is sworn at ${instance.swornErtog}.`
      : 'The labels stand as they were carved.';
    status.textContent = line;
    say(line);
  });

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
    if (ctx.solved || accused < 0) return;
    sfx('confirm');
    const sent = accused;
    let res;
    try { res = ctx.submit({ pouch: sent }); } catch (e) { return; }
    if (res && typeof res.then === 'function') res.then((r) => handle(r, sent), () => {});
    else handle(res, sent);
  });

  // ---- open the lock -----------------------------------------------------
  render();
  say(`Nine pouches, each sworn at ${instance.swornErtog} ertog — one mark is eight øre, one øre three ertog.`);
  say('One pouch was clipped and runs light. The pan that sinks holds the heavier silver.');
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
  epigraph: 'Nine pouches, one sworn weight — and one runs light. The beam has already spoken twice.',

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
