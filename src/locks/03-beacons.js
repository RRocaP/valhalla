// 03 — THE BEACON NIGHTS (tier 1, teaching)
//
// Three coastal beacons burn on their own reckonings. Each was last lit some
// nights ago. Set the dial to the next night on which all three burn together.
//
// Pure half: no DOM, no globals, no Math.random, no Date. Only the seeded rng.
//
// Uniqueness: the three cycles are pairwise coprime, so the dial (which caps at
// their product, the lcm) holds exactly one night satisfying all three
// congruences. makePuzzle sweeps every night on the dial and requires one.
//
// Difficulty accounting: three cycles to read, three offsets to turn into
// congruences, and the dial to walk — ten deliberate actions before the answer
// stands, and no fire is lit by guessing.

import { SHARDS } from '../kernel/shards.js';

const CYCLES = [3, 4, 5, 7, 9, 11, 13];
const MIN_DIAL = 250;

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

// Every pairwise-coprime triple whose product makes a dial worth walking.
const TRIPLES = (() => {
  const out = [];
  for (let i = 0; i < CYCLES.length; i++) {
    for (let j = i + 1; j < CYCLES.length; j++) {
      for (let k = j + 1; k < CYCLES.length; k++) {
        const [a, b, c] = [CYCLES[i], CYCLES[j], CYCLES[k]];
        if (gcd(a, b) !== 1 || gcd(a, c) !== 1 || gcd(b, c) !== 1) continue;
        if (a * b * c < MIN_DIAL) continue;
        out.push([a, b, c]);
      }
    }
  }
  return out;
})();

const HEADLANDS = [
  'Skarvholm', 'Eldsnes', 'Hafnaberg', 'Kolgrimsey',
  'Vindstad', 'Nordfell', 'Grimsholm', 'Selvik',
];

const burnsOn = (beacon, night) => (night + beacon.lastBurned) % beacon.cycle === 0;
const allBurn = (instance, night) => instance.beacons.every((b) => burnsOn(b, night));

function makePuzzle(rng) {
  const cycles = rng.shuffle(rng.pick(TRIPLES));
  const names = rng.shuffle(HEADLANDS).slice(0, 3);
  const dialMax = cycles[0] * cycles[1] * cycles[2];

  // The night is drawn first, then the offsets are derived from it, so the
  // answer is never tomorrow and never inside the first turn of the longest cycle.
  const lo = Math.max(31, 2 * Math.max(...cycles) + 1);
  const night = rng.range(lo, dialMax);

  const beacons = cycles.map((cycle, i) => ({
    name: names[i],
    cycle,
    lastBurned: ((-night % cycle) + cycle) % cycle, // nights ago; 0 = tonight
  }));

  const instance = { beacons, dialMax };

  // Exhaustive uniqueness across the whole dial.
  let hits = 0;
  for (let t = 1; t <= dialMax; t++) if (allBurn(instance, t)) hits++;
  if (hits !== 1) return makePuzzle(rng);

  return instance;
}

function solve(instance) {
  for (let t = 1; t <= instance.dialMax; t++) if (allBurn(instance, t)) return { night: t };
  return { night: -1 };
}

function verify(instance, answer) {
  try {
    if (!instance || !Array.isArray(instance.beacons) || !Number.isInteger(instance.dialMax)) return { ok: false };
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
    const t = answer.night;
    if (!Number.isInteger(t)) return { ok: false };
    if (t < 1 || t > instance.dialMax) return { ok: false, near: 'The dial does not reach that night.' };

    const lit = instance.beacons.filter((b) => burnsOn(b, t)).length;
    if (lit === instance.beacons.length) return { ok: true };
    if (lit === 0) return { ok: false, near: 'No fire answers that night.' };
    if (lit === 1) return { ok: false, near: 'One fire answers that night. Two stand dark.' };
    return { ok: false, near: 'Two fires answer that night. One stands dark.' };
  } catch (e) {
    return { ok: false };
  }
}

// Next night at or after 1 on which every beacon in `set` burns, or -1.
function nextFor(instance, set) {
  for (let t = 1; t <= instance.dialMax; t++) {
    if (set.every((i) => burnsOn(instance.beacons[i], t))) return t;
  }
  return -1;
}

function wrongAnswers(instance) {
  const right = solve(instance).night;
  const cand = [
    right - 1, right + 1,
    nextFor(instance, [0]), nextFor(instance, [1]), nextFor(instance, [2]),
    nextFor(instance, [0, 1]), nextFor(instance, [0, 2]), nextFor(instance, [1, 2]),
    instance.dialMax,
    instance.beacons.reduce((s, b) => s + b.cycle, 0),
    right + instance.beacons[0].cycle,
    right - instance.beacons[1].cycle,
    right + instance.beacons[2].cycle,
  ];
  const out = [];
  const seen = new Set();
  for (const t of cand) {
    if (!Number.isInteger(t) || t === right || t < 1 || t > instance.dialMax || seen.has(t)) continue;
    seen.add(t);
    out.push({ night: t });
  }
  return out;
}

// ------------------------------------------------------------------ the view

const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";
const MONO = "ui-monospace,'SF Mono',Menlo,monospace";
const WINDOW = 31; // nights shown around the dial at once

function mount(ctx) {
  const art = ctx.art;
  const p = art.palette;
  const instance = ctx.instance;
  const fires = [p.blood, p.fjordLight, p.pineLight];

  const cleanup = [];
  const timers = [];
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
  let night = ctx.solved ? solve(instance).night : 1;
  const longest = Math.max(...instance.beacons.map((b) => b.cycle));
  let keysSaid = false;
  let flick = 0;          // ember flicker phase (rAF-driven, reduced-motion off)
  let detent = false;     // brief detent emphasis after each step of the dial
  let detentTimer = null;
  let nearDark = null;    // beacon indexes standing dark at the refused night

  const reduced = () => {
    try { return !!(globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  };
  // hash-flicker: cheap, stateless, different per flame
  const jit = (k) => {
    const x = Math.sin((flick * 0.61 + k * 12.9898) * 43758.5453);
    return x - Math.floor(x);
  };

  const wrap = node('div', `display:grid;gap:14px;justify-items:center;font-family:${SERIF};color:${p.bone}`);
  const style = node('style');
  style.textContent = `
    .ow3-dial{touch-action:none;cursor:grab;border-radius:50%;outline-offset:4px}
    .ow3-dial:focus-visible{outline:2px solid ${p.goldBright}}
    .ow3-dial[data-turning="1"]{cursor:grabbing}
    .ow3-act{font-family:${SERIF};font-size:16px;color:${p.bone};background:${p.oakDeep};
      border:1px solid ${p.gold};border-radius:3px;padding:12px 20px;min-height:44px;cursor:pointer}
    .ow3-act:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    .ow3-act[disabled]{opacity:.5;cursor:default}
    .ow3-row{display:flex;gap:10px;align-items:baseline;font-size:13px;color:${p.boneDim}}
  `;
  wrap.append(style);

  const law = node('p', `margin:0;font-size:13px;color:${p.boneDim};line-height:1.5;text-align:center`,
    `Tonight is night nought. The dial runs to night ${instance.dialMax}, and past that the whole pattern comes round again. `
    + 'Set it to the next night on which all three burn as one.');

  const gfx = art.makeCanvas(320, 320);
  gfx.canvas.className = 'ow3-dial';
  gfx.canvas.style.maxWidth = '100%';
  gfx.canvas.style.height = 'auto';
  gfx.canvas.setAttribute('tabindex', '0');
  gfx.canvas.setAttribute('role', 'slider');
  gfx.canvas.setAttribute('aria-label', 'The night dial');
  gfx.canvas.setAttribute('aria-valuemin', '1');
  gfx.canvas.setAttribute('aria-valuemax', String(instance.dialMax));

  const ledger = node('div', 'display:grid;gap:4px;justify-items:start');
  const ledgerRows = instance.beacons.map((b, i) => {
    const row = node('div');
    row.className = 'ow3-row';
    const swatch = node('span', `display:inline-block;width:10px;height:10px;border-radius:50%;background:${fires[i]}`);
    const text = node('span');
    row.append(swatch, text);
    ledger.append(row);
    return { text, b, i };
  });

  const help = node('p', `margin:0;font-size:13px;color:${p.boneDim};text-align:center`,
    `Turn the dial to the night. By key: arrows for one night, up and down for ten, page keys for ${longest}.`);
  const status = node('p', `margin:0;min-height:20px;font-size:14px;color:${p.boneDim};text-align:center`);
  status.setAttribute('aria-live', 'polite');

  const submitBtn = node('button', null, 'Set the dial');
  submitBtn.className = 'btn-carved'; // one primary-action language: the carved gold plate
  submitBtn.type = 'button';

  wrap.append(law, gfx.canvas, ledger, help, submitBtn, status);
  ctx.root.append(wrap);

  // ---- painting ----------------------------------------------------------
  const burnsHere = (b, t) => t >= 1 && (t + b.lastBurned) % b.cycle === 0;
  const litCount = (t) => instance.beacons.filter((b) => burnsHere(b, t)).length;

  // a small tongue of fire: base colour, gold heart, flicker-led sway
  function flame(c, x, y, s, colour, seed, glowR) {
    const sway = (jit(seed) - 0.5) * s * 0.5;
    const lift = 1 + (jit(seed + 7) - 0.5) * 0.28;
    if (glowR) {
      try { art.glow(c, x, y, glowR * (0.85 + jit(seed + 3) * 0.3), colour, 0.65 + jit(seed + 5) * 0.3); } catch (e) { /* stub */ }
    }
    c.save();
    c.beginPath();
    c.moveTo(x - s * 0.55, y + s * 0.5);
    c.quadraticCurveTo(x - s * 0.62, y - s * 0.15, x + sway * 0.4, y - s * 0.55 * lift);
    c.quadraticCurveTo(x + sway, y - s * 1.05 * lift, x + sway * 0.6, y - s * 0.5 * lift);
    c.quadraticCurveTo(x + s * 0.62, y - s * 0.1, x + s * 0.55, y + s * 0.5);
    c.closePath();
    c.fillStyle = colour;
    c.fill();
    c.beginPath();
    c.moveTo(x - s * 0.24, y + s * 0.42);
    c.quadraticCurveTo(x - s * 0.26, y - s * 0.05, x + sway * 0.5, y - s * 0.34 * lift);
    c.quadraticCurveTo(x + s * 0.26, y - s * 0.02, x + s * 0.24, y + s * 0.42);
    c.closePath();
    c.fillStyle = p.goldBright;
    c.fill();
    c.restore();
  }

  function paint() {
    const c = gfx.ctx;
    const W = gfx.w, H = gfx.h;
    const cx = W / 2, cy = H / 2;
    c.clearRect(0, 0, W, H);

    c.save();
    c.fillStyle = p.tar;
    c.beginPath();
    c.arc(cx, cy, 150, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = p.oakLight;
    c.lineWidth = 2;
    c.stroke();
    // the rim, nailed to the lid at the quarters
    c.strokeStyle = p.gold;
    c.globalAlpha = 0.5;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(cx, cy, 145, 0, Math.PI * 2);
    c.stroke();
    c.restore();
    for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
      art.ornament(c, 'nailhead', cx + Math.cos(a) * 149, cy + Math.sin(a) * 149, 9);
    }

    // one carved track per beacon, so each fire rides its own ring
    instance.beacons.forEach((b, i) => {
      const r = 108 - i * 22;
      c.save();
      c.strokeStyle = p.oakDeep;
      c.globalAlpha = 0.9;
      c.lineWidth = 1.6;
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = fires[i];
      c.globalAlpha = 0.22;
      c.lineWidth = 1;
      c.beginPath(); c.arc(cx, cy, r - 1.6, 0, Math.PI * 2); c.stroke();
      c.restore();
    });

    const step = (Math.PI * 2) / WINDOW;
    const half = (WINDOW - 1) / 2;

    for (let k = -half; k <= half; k++) {
      const t = night + k;
      if (t < 1 || t > instance.dialMax) continue;
      const a = -Math.PI / 2 + k * step;
      const cos = Math.cos(a), sin = Math.sin(a);

      c.save();
      const hot = k === 0 && detent;
      c.strokeStyle = k === 0 ? p.goldBright : p.oakLight;
      c.lineWidth = k === 0 ? (hot ? 3.5 : 2.5) : 1;
      c.beginPath();
      c.moveTo(cx + cos * 138, cy + sin * 138);
      c.lineTo(cx + cos * (k === 0 ? (hot ? 118 : 122) : 130), cy + sin * (k === 0 ? (hot ? 118 : 122) : 130));
      c.stroke();
      c.restore();

      instance.beacons.forEach((b, i) => {
        if (!burnsHere(b, t)) return;
        const r = 108 - i * 22;
        const fx = cx + cos * r, fy = cy + sin * r;
        c.save();
        c.fillStyle = fires[i];
        c.beginPath();
        c.arc(fx, fy, 4, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = p.goldBright;
        c.globalAlpha = k === 0 ? 0.95 : 0.7;
        c.beginPath();
        c.arc(fx, fy, 1.7, 0, Math.PI * 2);
        c.fill();
        c.restore();
      });

      if (litCount(t) === instance.beacons.length) {
        const g = 0.8 + jit(t) * 0.25;
        try { art.glow(c, cx + cos * 122, cy + sin * 122, 16, p.goldBright, g); } catch (e) { /* stub */ }
        c.save();
        c.strokeStyle = p.gold;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(cx + cos * 122, cy + sin * 122, 9, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }
    }

    // the north nail, and the reckoning at it
    c.save();
    c.fillStyle = p.gold;
    c.beginPath();
    c.moveTo(cx, cy - 152);
    c.lineTo(cx - 7, cy - 166);
    c.lineTo(cx + 7, cy - 166);
    c.closePath();
    c.fill();

    c.fillStyle = detent ? p.goldBright : p.bone;
    c.textAlign = 'center';
    c.font = `600 40px ${MONO}`;
    c.fillText(String(night), cx, cy + 6);
    c.fillStyle = p.boneDim;
    c.font = `13px ${SERIF}`;
    c.fillText('nights hence', cx, cy + 28);
    c.restore();

    // the three braziers: burning ones carry a living flame, dark ones a cold bowl
    instance.beacons.forEach((b, i) => {
      const x = cx - 34 + i * 34;
      const y = cy + 58;
      const lit = burnsHere(b, night);
      c.save();
      c.beginPath();
      c.arc(x, y + 3, 9, 0, Math.PI, false);
      c.closePath();
      c.fillStyle = lit ? p.oak : p.oakDeep;
      c.fill();
      c.strokeStyle = lit ? p.gold : p.oakLight;
      c.lineWidth = 1.5;
      c.stroke();
      c.restore();
      if (lit) {
        flame(c, x, y - 2, 8, fires[i], i * 31 + 5, 18);
      } else if (nearDark && nearDark.indexOf(i) >= 0) {
        c.save();
        c.strokeStyle = p.ember;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(x, y, 13, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }
    });
  }

  function describe() {
    const parts = instance.beacons.map((b) => `${b.name} ${burnsHere(b, night) ? 'burns' : 'is dark'}`);
    return `Night ${night} — ${parts.join(', ')}.`;
  }

  let noteTimer = null;
  function render(quiet) {
    paint();
    ledgerRows.forEach((r) => {
      const when = r.b.lastBurned === 0 ? 'burned tonight' : `burned ${r.b.lastBurned} night${r.b.lastBurned > 1 ? 's' : ''} ago`;
      const dark = nearDark && nearDark.indexOf(r.i) >= 0;
      r.text.textContent = `${r.b.name} — every ${r.b.cycle} nights, ${when}`
        + (burnsHere(r.b, night) ? ' · burning' : (dark ? ' · stands dark' : ''));
      r.text.style.color = dark ? p.bone : '';
      r.text.style.fontWeight = dark ? '600' : '';
    });
    gfx.canvas.setAttribute('aria-valuenow', String(night));
    gfx.canvas.setAttribute('aria-valuetext', describe());
    status.textContent = describe();
    if (quiet) return;
    if (noteTimer) clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { say(describe()); noteTimer = null; }, 600);
    timers.push(noteTimer);
  }

  function setNight(t) {
    const next = Math.max(1, Math.min(instance.dialMax, t));
    if (next === night) return;
    night = next;
    nearDark = null;
    sfx('tick');
    if (!reduced()) {
      detent = true;
      if (detentTimer) clearTimeout(detentTimer);
      detentTimer = setTimeout(() => { detent = false; detentTimer = null; paint(); }, 130);
    }
    render();
  }

  // ---- turning the dial --------------------------------------------------
  let turn = null;
  const angleAt = (ev) => {
    const r = gfx.canvas.getBoundingClientRect();
    return Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2));
  };

  on(gfx.canvas, 'pointerdown', (ev) => {
    if (ctx.solved) return;
    turn = { angle: angleAt(ev), carried: 0 };
    gfx.canvas.dataset.turning = '1';
    try { gfx.canvas.setPointerCapture(ev.pointerId); } catch (e) { /* mouse without capture */ }
  });
  on(gfx.canvas, 'pointermove', (ev) => {
    if (!turn) return;
    ev.preventDefault();
    const a = angleAt(ev);
    let d = a - turn.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    turn.angle = a;
    turn.carried += d / ((Math.PI * 2) / WINDOW);
    const steps = Math.trunc(turn.carried);
    if (steps) { turn.carried -= steps; setNight(night + steps); }
  });
  const stopTurn = (ev) => {
    if (!turn) return;
    turn = null;
    gfx.canvas.dataset.turning = '0';
    try { gfx.canvas.releasePointerCapture(ev.pointerId); } catch (e) { /* already gone */ }
    sfx('knock');
  };
  on(gfx.canvas, 'pointerup', stopTurn);
  on(gfx.canvas, 'pointercancel', stopTurn);

  on(gfx.canvas, 'keydown', (ev) => {
    if (ctx.solved) return;
    const keys = {
      ArrowRight: 1, ArrowLeft: -1, ArrowUp: 10, ArrowDown: -10,
      PageUp: longest, PageDown: -longest,
    };
    if (ev.key in keys) { ev.preventDefault(); setNight(night + keys[ev.key]); }
    else if (ev.key === 'Home') { ev.preventDefault(); setNight(1); }
    else if (ev.key === 'End') { ev.preventDefault(); setNight(instance.dialMax); }
    else if (ev.key === 'Enter') { ev.preventDefault(); submitBtn.click(); }
  });

  on(gfx.canvas, 'focus', () => {
    if (keysSaid) return;
    keysSaid = true;
    say(`By key: left and right walk one night; up and down leap ten; the page keys leap ${longest}; `
      + 'Home and End run to the dial’s ends; Enter sets the dial.');
  });

  // The shell owns the shudder and the deny voice. The board's part is to show
  // WHERE: the braziers standing dark on the refused night.
  function handle(res, sent) {
    if (!res || res.ok) return;
    if (Number.isInteger(sent) && sent === night) {
      nearDark = instance.beacons
        .map((b, i) => (burnsHere(b, night) ? -1 : i))
        .filter((i) => i >= 0);
      render(true);
    }
    if (res.near) { status.textContent = res.near; say(res.near); }
  }

  on(submitBtn, 'click', () => {
    if (ctx.solved) return;
    sfx('confirm');
    say(`The dial is set to night ${night}.`);
    const sent = night;
    let res;
    try { res = ctx.submit({ night: sent }); } catch (e) { return; }
    if (res && typeof res.then === 'function') res.then((r) => handle(r, sent), () => {});
    else handle(res, sent);
  });

  // ---- open the lock -----------------------------------------------------
  render(true);
  say('Three beacons, three reckonings: '
    + instance.beacons.map((b) => `${b.name} every ${b.cycle} nights, last burned ${b.lastBurned} nights ago`).join('; ')
    + `. The dial runs from night 1 to night ${instance.dialMax}.`);
  say('Sought: the next night on which all three burn as one.');
  if (ctx.solved) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'The dial is set';
    status.textContent = `All three burned together on night ${night}.`;
  }

  // the ember flicker — alive, calm, and absent under reduced motion
  let raf = 0;
  let lastFlick = 0;
  const canFlick = typeof globalThis.requestAnimationFrame === 'function'
    && typeof globalThis.cancelAnimationFrame === 'function' && !reduced();
  const breathe = (ts) => {
    if (ts - lastFlick >= 90) { lastFlick = ts; flick = (flick + 1) % 1024; paint(); }
    raf = globalThis.requestAnimationFrame(breathe);
  };
  if (canFlick) raf = globalThis.requestAnimationFrame(breathe);

  return {
    unmount() {
      for (const off of cleanup) off();
      cleanup.length = 0;
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
      if (noteTimer) clearTimeout(noteTimer);
      if (detentTimer) clearTimeout(detentTimer);
      if (raf) globalThis.cancelAnimationFrame(raf);
      raf = 0;
      turn = null;
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    },
  };
}

export default {
  id: '03-beacons',
  ordinal: 3,
  tier: 1,
  title: 'The Beacon Nights',
  epigraph: 'Three fires keep three reckonings. Once they burned as one.',

  makePuzzle,
  solve,
  verify,
  wrongAnswers,
  shard: () => ({ ...SHARDS['03-beacons'] }),

  difficulty: {
    searchSpace: 1287, // the longest dial: 9 x 11 x 13 nights
    minSteps: 10,
    estMinutes: 4,
  },

  hints: [
    'A fire that burned three nights past on a reckoning of five burns again in two.',
    'Take the longest reckoning first. Count only its nights, then try each against the second, and what survives against the third.',
    'Past the three reckonings multiplied the whole pattern comes round again. The night you want lies within one turn of that wheel.',
  ],

  mount,
};
