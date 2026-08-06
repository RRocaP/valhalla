// 08 — THE TWELVE PIECES
//
// The full twelve-coin problem dressed as hacksilver: twelve cut pieces lie on
// the thing-stone, one of them false — clipped light or salted heavy, and which
// way is not known. Three balance weighings were sworn before the assembly and
// are carved into the ledger. Name the false piece and its direction.
//
// SEPARATING DESIGN. Each piece i is given a side-vector v_i in {-1,0,+1}^3:
// v_i[w] = +1 on the left pan of weighing w, -1 on the right, 0 if withheld.
// A hypothesis (piece p, heavier b) produces the outcome vector
//   out[w] = v_p[w] * (b ? +1 : -1)          (+1 = left pan sinks)
// Two hypotheses are told apart exactly when their outcome vectors differ, so
// the design must have every v_i non-zero and no two of them equal or opposite.
// The generator does NOT trust that argument: it simulates all 24 hypotheses
// against the three weighings and demands 24 distinct outcome signatures.
//
// Balance: each weighing must carry the same count of pieces on both pans, so
// exactly one of the four all-three-weighings classes is withheld from the row.
//
// Answer: { piece: 0..11, heavier: boolean }.

import { SHARDS } from '../kernel/shards.js';
import { ORDER } from '../kernel/futhark.js';

const ID = '08-hacksilver';
const N = 12;

const MARKS = Object.freeze(ORDER.slice(0, N));

const CUTS = Object.freeze([
  'arm-ring cut', 'brooch tongue', 'ingot end', 'neck-ring twist',
  'coin, halved', 'thistle-brooch pin', 'rod length', 'bar shaving',
  'plait fragment', 'terminal knob', 'wire coil', 'strap mount',
]);

// the thirteen sign-classes of {-1,0,1}^3 \ {0}, first non-zero normalised to +1
const CLASSES = Object.freeze([
  [1, 0, 0], [0, 1, 0], [0, 0, 1],
  [1, 1, 0], [1, -1, 0], [1, 0, 1], [1, 0, -1], [0, 1, 1], [0, 1, -1],
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
]);
// only a class that appears in all three weighings may be withheld, otherwise
// some weighing is left with an odd number of pieces and cannot balance
const DROPPABLE = Object.freeze([9, 10, 11, 12]);

const TILT = Object.freeze(['right', 'level', 'left']); // index by out+1

// ---- pure helpers ----------------------------------------------------------

function outcome(vectors, piece, heavier) {
  const sign = heavier ? 1 : -1;
  return vectors[piece].map((s) => s * sign);
}

/** simulate every hypothesis; true when all 24 signatures are distinct */
export function isSeparating(vectors) {
  const seen = new Set();
  for (let p = 0; p < vectors.length; p++) {
    for (const heavier of [true, false]) {
      const sig = outcome(vectors, p, heavier).join(',');
      if (sig === '0,0,0' || seen.has(sig)) return false;
      seen.add(sig);
    }
  }
  return seen.size === vectors.length * 2;
}

function balanced(vectors) {
  for (let w = 0; w < 3; w++) {
    let sum = 0;
    for (const v of vectors) sum += v[w];
    if (sum !== 0) return false;
  }
  return true;
}

function buildWeighings(vectors) {
  const weighings = [];
  for (let w = 0; w < 3; w++) {
    const left = [];
    const right = [];
    vectors.forEach((v, i) => {
      if (v[w] === 1) left.push(i);
      else if (v[w] === -1) right.push(i);
    });
    weighings.push({ left, right });
  }
  return weighings;
}

// ---- generator -------------------------------------------------------------

function makePuzzle(rng) {
  let vectors = null;
  for (let attempt = 0; attempt < 4000 && !vectors; attempt++) {
    const drop = rng.pick(DROPPABLE);
    const kept = CLASSES.filter((_, i) => i !== drop);
    const signed = rng.shuffle(kept).map((v) => {
      const s = rng.chance(0.5) ? 1 : -1;
      return v.map((x) => x * s);
    });
    if (!balanced(signed)) continue;
    if (!isSeparating(signed)) continue;   // simulated, not assumed
    vectors = signed;
  }
  if (!vectors) {
    // deterministic fallback: the classic static design, still simulation-checked
    const kept = CLASSES.filter((_, i) => i !== 9);
    vectors = kept.map((v, i) => (i % 2 ? v.map((x) => -x) : v));
    if (!balanced(vectors) || !isSeparating(vectors)) vectors = CLASSES.slice(0, N);
  }

  const piece = rng.int(N);
  const heavier = rng.chance(0.5);
  const out = outcome(vectors, piece, heavier);
  const weighings = buildWeighings(vectors).map((w, i) => ({
    left: w.left, right: w.right, tilt: TILT[out[i] + 1],
  }));

  return {
    marks: MARKS.slice(),
    cuts: CUTS.slice(),
    weighings,
    hypotheses: N * 2,
  };
}

/** the tilt weighing w would show if (piece, heavier) were the truth */
function predict(weighing, piece, heavier) {
  const onLeft = weighing.left.indexOf(piece) >= 0;
  const onRight = weighing.right.indexOf(piece) >= 0;
  if (!onLeft && !onRight) return 'level';
  const sinksLeft = onLeft === heavier;   // left+heavy sinks left; right+light sinks left
  return sinksLeft ? 'left' : 'right';
}

function consistent(instance, piece, heavier) {
  let agree = 0;
  for (const w of instance.weighings) {
    if (predict(w, piece, heavier) === w.tilt) agree++;
  }
  return agree;
}

function solve(instance) {
  for (let p = 0; p < N; p++) {
    for (const heavier of [true, false]) {
      if (consistent(instance, p, heavier) === 3) return { piece: p, heavier };
    }
  }
  return { piece: 0, heavier: true };
}

function verify(instance, answer) {
  if (!instance || !Array.isArray(instance.weighings)) return { ok: false };
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
  const { piece, heavier } = answer;
  if (typeof piece !== 'number' || !Number.isInteger(piece) || piece < 0 || piece >= N) return { ok: false };
  if (typeof heavier !== 'boolean') return { ok: false };
  const agree = consistent(instance, piece, heavier);
  if (agree === 3) return { ok: true };
  return { ok: false, near: `Your naming disagrees with ${3 - agree} of the three sworn weighings.` };
}

function wrongAnswers(instance) {
  const truth = solve(instance);
  const out = [{ piece: truth.piece, heavier: !truth.heavier }];
  for (let p = 0; p < N && out.length < 10; p++) {
    if (p === truth.piece) continue;
    out.push({ piece: p, heavier: true });
    if (out.length < 10) out.push({ piece: p, heavier: false });
  }
  return out;
}

// ---- view ------------------------------------------------------------------

function runeChip(art, ch, size) {
  const { canvas, ctx } = art.makeCanvas(size * 0.8, size);
  art.drawRune(ctx, ch, 0, 0, size, { color: art.palette.bone });
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}

function mount(ctx) {
  const { root, instance, art, audio } = ctx;
  const P = art.palette;
  const wrap = document.createElement('div');
  wrap.className = 'ow-lock ow-hacksilver';
  const style = document.createElement('style');
  style.textContent = `
  .ow-hacksilver{display:flex;flex-direction:column;gap:.7rem;color:${P.bone};
    font-family:'Iowan Old Style',Palatino,Georgia,serif}
  .ow-hacksilver .scale{background:${P.oakDeep};border:1px solid ${P.tar};border-radius:4px;padding:.45rem .55rem}
  .ow-hacksilver .pans{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
  .ow-hacksilver .pan{display:flex;gap:.15rem;align-items:center;background:${P.oak};
    border:1px solid ${P.oakLight};border-radius:3px;padding:.15rem .3rem;min-height:38px}
  .ow-hacksilver .pan.down{border-color:${P.gold};box-shadow:inset 0 -3px 0 ${P.gold}}
  .ow-hacksilver .verdict{font-size:.8rem;color:${P.boneDim};margin-top:.25rem}
  .ow-hacksilver .dial{display:flex;flex-wrap:wrap;gap:.3rem}
  .ow-hacksilver button{background:${P.oak};color:${P.bone};border:1px solid ${P.oakLight};
    border-radius:3px;min-height:44px;min-width:44px;font:inherit;cursor:pointer;padding:.2rem .4rem}
  .ow-hacksilver button[aria-pressed="true"]{border-color:${P.goldBright};background:${P.oakLight};color:${P.goldBright}}
  .ow-hacksilver button:focus-visible{outline:2px solid ${P.goldBright};outline-offset:2px}
  .ow-hacksilver .send{background:${P.gold};color:${P.tar};font-weight:600}
  .ow-hacksilver h4{margin:.2rem 0 0;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:${P.boneDim}}
  .ow-hacksilver .accused{font-size:.85rem;color:${P.goldBright};min-height:1.3em}`;
  wrap.appendChild(style);

  const tiltWord = { left: 'the left pan sank', right: 'the right pan sank', level: 'the beam stood level' };

  instance.weighings.forEach((w, i) => {
    const box = document.createElement('div');
    box.className = 'scale';
    const head = document.createElement('h4');
    head.textContent = `Weighing ${['first', 'second', 'third'][i]}`;
    box.appendChild(head);
    const pans = document.createElement('div');
    pans.className = 'pans';
    const makePan = (ids, side) => {
      const el = document.createElement('div');
      el.className = 'pan' + (w.tilt === side ? ' down' : '');
      ids.forEach((id) => el.appendChild(runeChip(art, instance.marks[id], 22)));
      el.setAttribute('aria-label', `${side} pan: ${ids.map((id) => instance.cuts[id]).join(', ')}`);
      return el;
    };
    pans.appendChild(makePan(w.left, 'left'));
    const vs = document.createElement('span');
    vs.textContent = '⚖';
    vs.setAttribute('aria-hidden', 'true');
    pans.appendChild(vs);
    pans.appendChild(makePan(w.right, 'right'));
    box.appendChild(pans);
    const verdict = document.createElement('div');
    verdict.className = 'verdict';
    verdict.textContent = `Sworn: ${tiltWord[w.tilt]}.`;
    box.appendChild(verdict);
    wrap.appendChild(box);
  });

  const h1 = document.createElement('h4');
  h1.textContent = 'Accusation — name the piece';
  wrap.appendChild(h1);
  const dial = document.createElement('div');
  dial.className = 'dial';
  dial.setAttribute('role', 'radiogroup');
  dial.setAttribute('aria-label', 'the twelve pieces');
  wrap.appendChild(dial);

  const h2 = document.createElement('h4');
  h2.textContent = 'and the direction of its fault';
  wrap.appendChild(h2);
  const dirs = document.createElement('div');
  dirs.className = 'dial';
  wrap.appendChild(dirs);

  const accused = document.createElement('div');
  accused.className = 'accused';
  accused.setAttribute('aria-live', 'polite');
  wrap.appendChild(accused);

  const send = document.createElement('button');
  send.className = 'send';
  send.type = 'button';
  send.textContent = 'Swear the accusation';
  send.disabled = true;
  wrap.appendChild(send);

  let piece = null;
  let heavier = null;

  const pieceBtns = instance.marks.map((ch, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', 'false');
    b.setAttribute('aria-label', `${instance.cuts[i]}`);
    b.appendChild(runeChip(art, ch, 22));
    b.addEventListener('click', () => {
      piece = i;
      audio.ui('knock');
      ctx.note(`Accusation laid on the ${instance.cuts[i]}.`);
      refresh();
    });
    dial.appendChild(b);
    return b;
  });

  const dirBtns = [['heavy — salted', true], ['light — clipped', false]].map(([label, val]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      heavier = val;
      audio.ui('flip');
      ctx.note(`The fault is called ${val ? 'heavy' : 'light'}.`);
      refresh();
    });
    dirs.appendChild(b);
    return { b, val };
  });

  function refresh() {
    pieceBtns.forEach((b, i) => b.setAttribute('aria-checked', String(i === piece)));
    dirBtns.forEach((d) => d.b.setAttribute('aria-pressed', String(heavier === d.val)));
    const ready = piece !== null && heavier !== null;
    send.disabled = !ready;
    accused.textContent = ready
      ? `You name the ${instance.cuts[piece]} — ${heavier ? 'salted heavy' : 'clipped light'}.`
      : 'Name a piece and the direction of its fault.';
  }

  send.addEventListener('click', () => {
    if (piece === null || heavier === null) return;
    ctx.submit({ piece, heavier });
  });

  const onKey = (e) => {
    if (e.target && e.target.tagName === 'BUTTON') return;
    const n = Number(e.key);
    if (n >= 1 && n <= 9) { piece = n - 1; refresh(); e.preventDefault(); return; }
    if (e.key === 'h') { heavier = true; refresh(); e.preventDefault(); }
    if (e.key === 'l') { heavier = false; refresh(); e.preventDefault(); }
  };
  wrap.addEventListener('keydown', onKey);

  root.appendChild(wrap);
  ctx.note('Twelve cut pieces; one is false, heavy or light, and nobody swore which.');
  instance.weighings.forEach((w, i) => {
    ctx.note(`Weighing ${i + 1}: ${w.left.map((id) => instance.cuts[id]).join(' + ')} against ${w.right.map((id) => instance.cuts[id]).join(' + ')} — ${tiltWord[w.tilt]}.`);
  });
  if (ctx.solved) {
    const t = solve(instance);
    piece = t.piece;
    heavier = t.heavier;
    send.disabled = true;
  }
  refresh();

  return {
    unmount() {
      wrap.removeEventListener('keydown', onKey);
      wrap.remove();
    },
  };
}

export default {
  id: ID,
  ordinal: 8,
  tier: 3,
  title: 'The Twelve Pieces',
  epigraph: 'One of these was cut by a liar. The beam remembers; it does not speak.',

  makePuzzle,
  solve,
  verify,
  wrongAnswers,
  shard: () => ({ ...SHARDS[ID] }),

  difficulty: { searchSpace: 24, minSteps: 21, estMinutes: 13 },

  hints: [
    'Twenty-four namings are possible — twelve pieces, each false in two directions. Three weighings can part twenty-seven.',
    'A piece withheld from a weighing cannot tilt it. Read each level beam as hard evidence, not as silence.',
    'Take one weighing at a time and strike out every naming it contradicts. What survives all three is the only oath you can swear.',
  ],

  mount,
};
