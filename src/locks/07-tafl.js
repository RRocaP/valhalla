// 07 — THE KING'S ROAD
//
// Brandubh, the seven-by-seven hnefatafl of the Irish and Norse boards, played
// from an endgame. You move the king's side; the attackers answer by a fixed,
// published policy. Get the king out in N moves.
//
// ===== THE RULESET (classic brandubh, weak king) — one law for the solver,
// ===== the verifier and the board you touch. No move is judged by any other.
//
//  R1. The board is 7x7. The throne stands at the centre (3,3). The four
//      corners are the exits.
//  R2. Every piece moves like a rook: orthogonally, any distance, through
//      empty squares only. Nothing jumps.
//  R3. The throne and the four corners are restricted. Only the king may stand
//      on one, and only the king may pass through one.
//  R4. Capture is custodial. After a piece lands, look along each of the four
//      orthogonal directions: an enemy standing adjacent is taken if the square
//      immediately beyond it holds a friend of the mover, or is a corner, or is
//      the throne while the throne stands empty. A piece that moves BETWEEN two
//      enemies of its own accord is never taken.
//  R5. The king is armed and is taken exactly as a soldier is — by two-sided
//      custodianship. (The weak-king brandubh reconstruction.) If the king
//      falls, the line is lost.
//  R6. The king's side wins the moment the king stands on any corner.
//  R7. The king's side moves first, then the attackers, alternating.
//
// ===== THE ATTACKER POLICY (frozen, deterministic, no search)
//
//  P1. If any attacker move captures, the attackers capture. Among capturing
//      moves: one that takes the king first; else the one taking the most
//      pieces; else row-major by `from`, then row-major by `to`.
//  P2. Otherwise the attackers play the move that leaves the king the longest
//      road: the move MAXIMISING the king's rook-move distance to the nearest
//      corner in the resulting position. A king with no road at all counts as
//      the longest road of all.
//  P3. Ties at either step are broken row-major by `from`, then by `to`.
//
// CONTRACT NOTE (recorded, not widened). docs/LOCKS.md §07 words step 2 as
// "minimise king's BFS distance to any edge exit". Read literally that is a
// cooperative opponent — the attackers would step aside and open the road, and
// no endgame could be set. The adversarial reading is implemented and stated
// above; it lives behind the single constant POLICY_SIGN, so a lead ruling can
// flip it in one line without touching anything else.
//
// Answer: { line: [[[r,c],[r,c]], ...] } — at most `limit` king-side moves.
// verify replays the line under this exact ruleset and accepts ANY line that
// wins inside the limit; the generator guarantees there is only one.

import { SHARDS } from '../kernel/shards.js';

const ID = '07-tafl';
const SIZE = 7;
const CELLS = SIZE * SIZE;
const THRONE = 24;
const CORNERS = Object.freeze([0, 6, 42, 48]);
const RESTRICTED = Object.freeze([0, 6, 42, 48, 24]);
const LIMIT = 3;

/** P2 orientation: +1 lengthens the king's road (adversarial), -1 shortens it. */
const POLICY_SIGN = 1;

const EMPTY = 0, ATTACKER = 1, DEFENDER = 2, KING = 3;

const rc = (i) => [Math.floor(i / SIZE), i % SIZE];
const ix = (r, c) => r * SIZE + c;
const isRestricted = (i) => RESTRICTED.indexOf(i) >= 0;
const isCorner = (i) => CORNERS.indexOf(i) >= 0;

/** RAYS[cell][dir] = cells outward from `cell`, nearest first */
const RAYS = Object.freeze((() => {
  const steps = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const all = [];
  for (let i = 0; i < CELLS; i++) {
    const [r, c] = rc(i);
    all.push(steps.map(([dr, dc]) => {
      const ray = [];
      let rr = r + dr, cc = c + dc;
      while (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE) { ray.push(ix(rr, cc)); rr += dr; cc += dc; }
      return Object.freeze(ray);
    }));
  }
  return all;
})());

/** NEIGHBOURS[cell][dir] = [adjacent, beyond] or null when either falls off */
const ANVIL = Object.freeze((() => {
  const out = [];
  for (let i = 0; i < CELLS; i++) {
    out.push(RAYS[i].map((ray) => (ray.length >= 2 ? [ray[0], ray[1]] : null)));
  }
  return out;
})());

// ---- board state -----------------------------------------------------------

function toOcc(state) {
  const occ = new Uint8Array(CELLS);
  for (const a of state.attackers) occ[a] = ATTACKER;
  for (const d of state.defenders) occ[d] = DEFENDER;
  if (state.king >= 0) occ[state.king] = KING;
  return occ;
}

function cloneState(s) {
  return { king: s.king, defenders: s.defenders.slice(), attackers: s.attackers.slice() };
}

/** every legal move for `side`, row-major by from then to */
export function legalMoves(state, side) {
  const occ = toOcc(state);
  const pieces = side === 'king'
    ? (state.king >= 0 ? state.defenders.concat([state.king]) : state.defenders.slice())
    : state.attackers.slice();
  pieces.sort((a, b) => a - b);
  const moves = [];
  for (const from of pieces) {
    const isKing = from === state.king;
    const tos = [];
    for (const ray of RAYS[from]) {
      for (const to of ray) {
        if (occ[to] !== EMPTY) break;
        if (isRestricted(to) && !isKing) break;   // R3: blocks landing AND passage
        tos.push(to);
      }
    }
    tos.sort((a, b) => a - b);
    for (const to of tos) moves.push([from, to]);
  }
  return moves;
}

/** R4/R5 — the cells a piece of `side` takes by landing on `to`, read off `occ` */
function capturesOnOcc(occ, to, side) {
  const taken = [];
  for (const pair of ANVIL[to]) {
    if (!pair) continue;
    const [adj, beyond] = pair;
    const what = occ[adj];
    const isEnemy = side === 'king'
      ? what === ATTACKER
      : (what === DEFENDER || what === KING);
    if (!isEnemy) continue;
    const hostileSquare = isCorner(beyond) || (beyond === THRONE && occ[THRONE] === EMPTY);
    const friendBeyond = side === 'king'
      ? (occ[beyond] === DEFENDER || occ[beyond] === KING)
      : occ[beyond] === ATTACKER;
    if (hostileSquare || friendBeyond) taken.push(adj);
  }
  return taken;
}

/** R4/R5 — captures made by a piece of `side` landing on `to` */
function resolveCaptures(state, to, side) {
  const taken = capturesOnOcc(toOcc(state), to, side);
  if (!taken.length) return { state, taken };
  const next = cloneState(state);
  for (const t of taken) {
    if (t === next.king) next.king = -1;
    next.defenders = next.defenders.filter((d) => d !== t);
    next.attackers = next.attackers.filter((a) => a !== t);
  }
  return { state: next, taken };
}

export function applyMove(state, from, to, side) {
  const moved = cloneState(state);
  if (side === 'king') {
    if (from === moved.king) moved.king = to;
    else moved.defenders = moved.defenders.map((d) => (d === from ? to : d)).sort((a, b) => a - b);
  } else {
    moved.attackers = moved.attackers.map((a) => (a === from ? to : a)).sort((a, b) => a - b);
  }
  const { state: after, taken } = resolveCaptures(moved, to, side);
  after.defenders.sort((a, b) => a - b);
  after.attackers.sort((a, b) => a - b);
  return { state: after, taken };
}

/** rook-move distance from `king` to the nearest corner on `occ`; -1 = no road.
 *  `occ` is read-only here: the king's own square is restored before returning. */
function kingRoadOcc(occ, king) {
  if (king < 0) return -1;
  if (isCorner(king)) return 0;
  const standing = occ[king];
  occ[king] = EMPTY;
  const road = bfsRoad(occ, king);
  occ[king] = standing;
  return road;
}

/** rook-move distance from the king's square to the nearest corner; -1 = no road */
export function kingRoad(state) {
  if (state.king < 0) return -1;
  return kingRoadOcc(toOcc(state), state.king);
}

function bfsRoad(occ, start) {
  const dist = new Int8Array(CELLS).fill(-1);
  dist[start] = 0;
  let frontier = [start];
  while (frontier.length) {
    const next = [];
    for (const cell of frontier) {
      for (const ray of RAYS[cell]) {
        for (const to of ray) {
          if (occ[to] !== EMPTY) break;
          if (dist[to] === -1) {
            dist[to] = dist[cell] + 1;
            if (isCorner(to)) return dist[to];
            next.push(to);
          }
        }
      }
    }
    frontier = next;
  }
  return -1;
}

// ---- the frozen attacker policy -------------------------------------------

export function attackerReply(state) {
  // Scored in place on one occupancy board: this is the hot path of the whole
  // lock, and cloning a state per candidate move dominated generation time.
  const occ = toOcc(state);
  const from0 = state.attackers.slice().sort((a, b) => a - b);
  let best = null;
  let bestA = -1, bestB = -1, bestC = -1;
  const tos = [];
  for (const from of from0) {
    occ[from] = EMPTY;
    tos.length = 0;
    for (const ray of RAYS[from]) {
      for (const to of ray) {
        if (occ[to] !== EMPTY) break;
        if (isRestricted(to)) break;              // R3: attackers neither land nor pass
        tos.push(to);
      }
    }
    tos.sort((x, y) => x - y);                    // P3 needs `to` row-major too
    for (const to of tos) {
      occ[to] = ATTACKER;
      const taken = capturesOnOcc(occ, to, 'attacker');
      let a, b, c;
      if (taken.length) {
        // P1: captures first — the king above all, then the count
        a = 2; b = taken.indexOf(state.king) >= 0 ? 1 : 0; c = taken.length;
      } else {
        // P2: no road (-1) counts as the longest road there is
        const road = kingRoadOcc(occ, state.king);
        a = 1; b = 0; c = POLICY_SIGN * (road === -1 ? 99 : road);
      }
      occ[to] = EMPTY;
      // P3: strict > keeps the first move in row-major from-then-to order
      if (best === null || a > bestA
        || (a === bestA && b > bestB)
        || (a === bestA && b === bestB && c > bestC)) {
        bestA = a; bestB = b; bestC = c;
        best = [from, to];
      }
    }
    occ[from] = ATTACKER;
  }
  return best;
}

// ---- search ----------------------------------------------------------------

/**
 * Every king-side line of at most `depth` moves that reaches a corner.
 * Stops once `cap` lines are found. Deterministic order.
 */
export function winningLines(state, depth, cap) {
  const found = [];
  const walk = (s, remaining, path) => {
    if (found.length >= cap || remaining === 0) return;
    if (remaining === 1) {
      // On the last move only the king can win, and only by landing on a corner.
      // Enumerated directly (same row-major `to` order the general path yields)
      // because this ply is where nearly all of the search time was spent.
      if (s.king < 0) return;
      const occ = toOcc(s);
      occ[s.king] = EMPTY;
      const exits = [];
      for (const ray of RAYS[s.king]) {
        for (const to of ray) {
          if (occ[to] !== EMPTY) break;           // the king may pass restricted squares
          if (isCorner(to)) exits.push(to);
        }
      }
      exits.sort((x, y) => x - y);
      for (const to of exits) {
        found.push(path.concat([[s.king, to]]));
        if (found.length >= cap) return;
      }
      return;
    }
    for (const [from, to] of legalMoves(s, 'king')) {
      const { state: after } = applyMove(s, from, to, 'king');
      const line = path.concat([[from, to]]);
      if (after.king >= 0 && isCorner(after.king)) { found.push(line); if (found.length >= cap) return; continue; }
      if (after.king < 0 || remaining === 1) continue;
      const reply = attackerReply(after);
      let next = after;
      if (reply) next = applyMove(after, reply[0], reply[1], 'attacker').state;
      if (next.king < 0) continue;
      walk(next, remaining - 1, line);
      if (found.length >= cap) return;
    }
  };
  walk(state, depth, []);
  return found;
}

/** king moves that shorten the king's road — the moves a player reaches for */
export function naturalFirstMoves(state) {
  const before = kingRoad(state);
  const out = [];
  for (const [from, to] of legalMoves(state, 'king')) {
    if (from !== state.king) continue;
    const { state: after } = applyMove(state, from, to, 'king');
    if (after.king < 0) { out.push([from, to]); continue; }
    const road = kingRoad(after);
    if (road !== -1 && road < before) out.push([from, to]);
  }
  return out;
}

// ---- generator -------------------------------------------------------------

function placement(rng) {
  const free = [];
  for (let i = 0; i < CELLS; i++) if (!isRestricted(i)) free.push(i);
  const bag = rng.shuffle(free);
  const king = bag[0];
  if (isCorner(king)) return null;
  const nDef = rng.range(1, 2);
  const nAtk = rng.range(3, 5);
  const defenders = bag.slice(1, 1 + nDef).sort((a, b) => a - b);
  const attackers = bag.slice(1 + nDef, 1 + nDef + nAtk).sort((a, b) => a - b);
  return { king, defenders, attackers };
}

/**
 * Every structural mutation of an answer that scripts/verify.mjs can produce:
 * a swap inside any array of length > 1 (the line itself, a move's from/to, a
 * cell's row/column) and any integer leaf moved by 1..3 either way. The
 * generator rejects a position if ANY of these still wins — verify keeps its
 * contracted meaning (accept any winning line) and the instance is what
 * guarantees there is only one.
 */
export function mutantsOf(answer) {
  const out = [];
  const clone = () => JSON.parse(JSON.stringify(answer));
  const n = answer.line.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const c = clone();
      [c.line[i], c.line[j]] = [c.line[j], c.line[i]];
      out.push(c);
    }
    const swapEnds = clone();
    [swapEnds.line[i][0], swapEnds.line[i][1]] = [swapEnds.line[i][1], swapEnds.line[i][0]];
    out.push(swapEnds);
    for (let k = 0; k < 2; k++) {
      const c = clone();
      [c.line[i][k][0], c.line[i][k][1]] = [c.line[i][k][1], c.line[i][k][0]];
      out.push(c);
      for (let a = 0; a < 2; a++) {
        for (const d of [-3, -2, -1, 1, 2, 3]) {
          const m = clone();
          m.line[i][k][a] += d;
          out.push(m);
        }
      }
    }
  }
  return out;
}

function shape(state, traps) {
  return {
    size: SIZE,
    king: state.king,
    defenders: state.defenders.slice(),
    attackers: state.attackers.slice(),
    throne: THRONE,
    corners: CORNERS.slice(),
    limit: LIMIT,
    traps,
  };
}

/**
 * A candidate position, or null. `maxRoads` caps how many winning lines the
 * position may admit — docs/LOCKS.md §07 permits any number (verify accepts any
 * winning line and wrongAnswers supplies losing ones), but few roads make a
 * better lock, so generation tries hard for a tight position before settling.
 */
function candidate(rng, maxRoads) {
  const state = placement(rng);
  if (!state) return null;
  const road = kingRoad(state);
  if (road !== 2 && road !== 3) return null;                        // a real but short road
  if (attackerReply(state) === null) return null;
  if (winningLines(state, LIMIT - 1, 1).length !== 0) return null;  // must not fall in two
  const wins = winningLines(state, LIMIT, maxRoads + 1);
  if (!wins.length || wins.length > maxRoads) return null;
  const firstKey = String(wins[0][0]);
  const traps = naturalFirstMoves(state).filter((m) => String(m) !== firstKey);
  if (traps.length < 2) return null;                                // two inviting refutations
  const instance = shape(state, traps.length);
  const answer = { line: wins[0].map(([from, to]) => [rc(from), rc(to)]) };
  // No structural mutation of the canonical line may also win. verify keeps its
  // contracted meaning; the instance is what makes the mutation gate safe.
  if (mutantsOf(answer).some((m) => verify(instance, m).ok)) return null;
  return instance;
}

function makePuzzle(rng) {
  for (let tight = 0; tight < 1500; tight++) {
    const found = candidate(rng, 2);
    if (found) return found;
  }
  for (;;) {
    const found = candidate(rng, 64);
    if (found) return found;
  }
}

export const stateOf = (instance) => ({
  king: instance.king,
  defenders: instance.defenders.slice(),
  attackers: instance.attackers.slice(),
});

function solve(instance) {
  const found = winningLines(stateOf(instance), instance.limit, 1);
  const line = found[0] || [];
  return { line: line.map(([from, to]) => [rc(from), rc(to)]) };
}

const validCell = (p) => Array.isArray(p) && p.length === 2
  && Number.isInteger(p[0]) && Number.isInteger(p[1])
  && p[0] >= 0 && p[0] < SIZE && p[1] >= 0 && p[1] < SIZE;

function verify(instance, answer) {
  if (!instance || !Array.isArray(instance.attackers)) return { ok: false };
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
  const line = answer.line;
  if (!Array.isArray(line) || line.length === 0 || line.length > instance.limit) return { ok: false };

  let state = stateOf(instance);
  for (let m = 0; m < line.length; m++) {
    const move = line[m];
    if (!Array.isArray(move) || move.length !== 2) return { ok: false };
    if (!validCell(move[0]) || !validCell(move[1])) return { ok: false };
    const from = ix(move[0][0], move[0][1]);
    const to = ix(move[1][0], move[1][1]);
    const legal = legalMoves(state, 'king').some((mv) => mv[0] === from && mv[1] === to);
    if (!legal) return { ok: false, near: `Move ${m + 1} is not a move the king's side can make.` };
    const stepped = applyMove(state, from, to, 'king');
    state = stepped.state;
    if (state.king >= 0 && isCorner(state.king)) return { ok: true };
    if (state.king < 0) return { ok: false, near: `The king was lost on move ${m + 1}.` };
    const reply = attackerReply(state);
    if (reply) state = applyMove(state, reply[0], reply[1], 'attacker').state;
    if (state.king < 0) return { ok: false, near: `The attackers took the king after move ${m + 1}.` };
  }
  return { ok: false, near: 'The line runs out and the king still stands short of a corner.' };
}

function wrongAnswers(instance) {
  const state = stateOf(instance);
  const truth = winningLines(state, instance.limit, 1)[0] || [];
  const truthKey = JSON.stringify(truth);
  const out = [];
  const asAnswer = (line) => ({ line: line.map(([from, to]) => [rc(from), rc(to)]) });

  // losing continuations behind every first move that is not the one road out
  const firsts = legalMoves(state, 'king');
  for (const first of firsts) {
    if (out.length >= 10) break;
    if (JSON.stringify([first]) === JSON.stringify(truth.slice(0, 1))) continue;
    const line = [first];
    let s = applyMove(state, first[0], first[1], 'king').state;
    if (s.king >= 0 && isCorner(s.king)) continue;             // cannot happen, but never offer a win
    for (let step = 1; step < instance.limit && s.king >= 0; step++) {
      const reply = attackerReply(s);
      if (reply) s = applyMove(s, reply[0], reply[1], 'attacker').state;
      if (s.king < 0) break;
      // press on toward the nearest corner: the greedy line a player would try
      const natural = naturalFirstMoves(s);
      const next = natural[0] || legalMoves(s, 'king')[0];
      if (!next) break;
      line.push(next);
      s = applyMove(s, next[0], next[1], 'king').state;
      if (s.king >= 0 && isCorner(s.king)) break;
    }
    if (JSON.stringify(line) === truthKey) continue;
    const candidate = asAnswer(line);
    if (verify(instance, candidate).ok) continue;              // only ever offer losing lines
    if (out.some((o) => JSON.stringify(o) === JSON.stringify(candidate))) continue;
    out.push(candidate);
  }
  // the true road cut short, and the true road with its last move undone
  if (truth.length > 1) {
    const short = asAnswer(truth.slice(0, truth.length - 1));
    if (!verify(instance, short).ok) out.push(short);
  }
  // top up with near-misses of the canonical road; the generator has already
  // proved every one of these loses, so the supply is guaranteed
  if (out.length < 8 && truth.length) {
    for (const m of mutantsOf(asAnswer(truth))) {
      if (out.length >= 8) break;
      if (verify(instance, m).ok) continue;
      if (out.some((o) => JSON.stringify(o) === JSON.stringify(m))) continue;
      out.push(m);
    }
  }
  return out.slice(0, 10);
}

// ---- view ------------------------------------------------------------------

function mount(ctx) {
  const { root, instance, art, audio } = ctx;
  const P = art.palette;
  const reduced = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // every listener is tracked so unmount can take them all back down
  const bound = [];
  const on = (el, type, fn) => { el.addEventListener(type, fn); bound.push([el, type, fn]); };
  const unbind = () => { for (const [el, type, fn] of bound) el.removeEventListener(type, fn); bound.length = 0; };

  const wrap = document.createElement('div');
  wrap.className = 'ow-lock ow-tafl';
  const style = document.createElement('style');
  style.textContent = `
  .ow-tafl{display:flex;flex-direction:column;gap:.55rem;color:${P.bone};
    font-family:'Iowan Old Style',Palatino,Georgia,serif;align-items:stretch}
  .ow-tafl .board{align-self:center;position:relative;touch-action:manipulation}
  .ow-tafl .board:focus-visible{outline:2px solid ${P.goldBright};outline-offset:3px}
  .ow-tafl .bar{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap}
  .ow-tafl button{background:${P.oak};color:${P.bone};border:1px solid ${P.oakLight};border-radius:3px;
    min-height:44px;padding:.2rem .6rem;font:inherit;cursor:pointer}
  .ow-tafl button:focus-visible{outline:2px solid ${P.goldBright};outline-offset:2px}
  .ow-tafl button[disabled]{opacity:.45;cursor:default}
  .ow-tafl .send{background:${P.gold};color:${P.tar};font-weight:600;border:none}
  .ow-tafl .say{font-size:.85rem;color:${P.boneDim};min-height:2.4em}`;
  wrap.appendChild(style);

  const SQ = 40;
  const PAD = 8;
  const dim = SQ * SIZE + PAD * 2;
  const holder = document.createElement('div');
  holder.className = 'board';
  holder.tabIndex = 0;
  holder.setAttribute('role', 'application');
  holder.setAttribute('aria-label', 'brandubh board, 7 by 7');
  wrap.appendChild(holder);

  const say = document.createElement('div');
  say.className = 'say';
  say.setAttribute('aria-live', 'polite');
  wrap.appendChild(say);

  const bar = document.createElement('div');
  bar.className = 'bar';
  const undo = document.createElement('button');
  undo.type = 'button';
  undo.textContent = 'Take back';
  const send = document.createElement('button');
  send.type = 'button';
  send.className = 'send';
  send.textContent = 'Swear the road';
  bar.appendChild(undo);
  bar.appendChild(send);
  wrap.appendChild(bar);

  let state = stateOf(instance);
  let line = [];
  let selected = -1;
  let cursor = instance.king;
  let history = [];
  let canvasEl = null;
  let raf = 0;
  let anim = null;

  const cellName = (i) => {
    const [r, c] = rc(i);
    return `${'abcdefg'[c]}${SIZE - r}`;
  };

  function targets() {
    if (selected < 0) return [];
    return legalMoves(state, 'king').filter((m) => m[0] === selected).map((m) => m[1]);
  }

  function draw() {
    if (canvasEl) canvasEl.remove();
    const { canvas, ctx: g } = art.makeCanvas(dim, dim);
    canvasEl = canvas;
    canvas.setAttribute('aria-hidden', 'true');
    art.paintWood(g, dim, dim, 1066);
    const hits = targets();
    for (let i = 0; i < CELLS; i++) {
      const [r, c] = rc(i);
      const x = PAD + c * SQ;
      const y = PAD + r * SQ;
      art.paintPanel(g, x + 1, y + 1, SQ - 2, SQ - 2, {});
      if (isCorner(i) || i === THRONE) {
        g.strokeStyle = P.gold;
        g.lineWidth = 1;
        g.strokeRect(x + 5, y + 5, SQ - 10, SQ - 10);
      }
      if (hits.indexOf(i) >= 0) {
        g.beginPath();
        g.arc(x + SQ / 2, y + SQ / 2, 5, 0, Math.PI * 2);
        g.fillStyle = P.pineLight;
        g.fill();
      }
      if (i === cursor) {
        g.strokeStyle = P.goldBright;
        g.lineWidth = 2;
        g.strokeRect(x + 2, y + 2, SQ - 4, SQ - 4);
      }
    }
    const dot = (i, colour, r0) => {
      const [r, c] = rc(i);
      const x = PAD + c * SQ + SQ / 2;
      const y = PAD + r * SQ + SQ / 2;
      art.glow(g, x, y, r0 * 1.8, colour, 0.5);
      g.beginPath();
      g.arc(x, y, r0, 0, Math.PI * 2);
      g.fillStyle = colour;
      g.fill();
      g.strokeStyle = P.tar;
      g.lineWidth = 1.5;
      g.stroke();
    };
    for (const a of state.attackers) dot(a, P.tar, SQ * 0.3);
    for (const d of state.defenders) dot(d, P.bone, SQ * 0.28);
    if (state.king >= 0) {
      dot(state.king, P.gold, SQ * 0.34);
      const [r, c] = rc(state.king);
      art.drawRune(g, 'ᛏ', PAD + c * SQ + SQ * 0.32, PAD + r * SQ + SQ * 0.22, SQ * 0.5, { color: P.tar });
    }
    if (selected >= 0) {
      const [r, c] = rc(selected);
      g.strokeStyle = P.goldBright;
      g.lineWidth = 2;
      g.strokeRect(PAD + c * SQ + 3, PAD + r * SQ + 3, SQ - 6, SQ - 6);
    }
    holder.appendChild(canvas);
  }

  function status(extra) {
    const road = kingRoad(state);
    say.textContent = `${extra ? extra + ' ' : ''}Move ${line.length} of ${instance.limit}. `
      + (state.king < 0 ? 'The king has fallen — take the move back.'
        : `King on ${cellName(state.king)}; ${road === -1 ? 'no road to a corner' : `${road} move${road === 1 ? '' : 's'} of open road`}.`);
  }

  function playAttacker(after) {
    const reply = attackerReply(after);
    if (!reply) { state = after; finish(''); return; }
    const step = applyMove(after, reply[0], reply[1], 'attacker');
    const tell = `Attacker ${cellName(reply[0])}–${cellName(reply[1])}`
      + (step.taken.length ? `, taking ${step.taken.map(cellName).join(' and ')}` : '') + '.';
    const commit = () => {
      state = step.state;
      ctx.note(tell);
      audio.ui(step.taken.length ? 'deny' : 'slide');
      finish(tell);
    };
    if (reduced) { state = after; commit(); return; }
    state = after;
    draw();
    anim = setTimeout(commit, 260);
  }

  function finish(tell) {
    anim = null;
    draw();
    status(tell);
    send.disabled = line.length === 0;
    undo.disabled = line.length === 0;
  }

  function doMove(from, to) {
    if (anim) return;
    history.push({ state: cloneState(state), line: line.slice() });
    const step = applyMove(state, from, to, 'king');
    line = line.concat([[from, to]]);
    selected = -1;
    ctx.note(`King's side ${cellName(from)}–${cellName(to)}`
      + (step.taken.length ? `, taking ${step.taken.map(cellName).join(' and ')}` : '') + '.');
    audio.ui('knock');
    if (step.state.king >= 0 && isCorner(step.state.king)) {
      state = step.state;
      ctx.note(`The king stands on ${cellName(state.king)}. The road is open.`);
      finish('The king is out.');
      return;
    }
    if (line.length >= instance.limit) { state = step.state; finish('The last move is spent.'); return; }
    playAttacker(step.state);
  }

  function click(e) {
    const box = canvasEl.getBoundingClientRect();
    const c = Math.floor((e.clientX - box.left - PAD) / SQ);
    const r = Math.floor((e.clientY - box.top - PAD) / SQ);
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return;
    activate(ix(r, c));
  }

  function activate(cell) {
    if (anim) return;
    cursor = cell;
    if (selected >= 0 && targets().indexOf(cell) >= 0) { doMove(selected, cell); return; }
    const mine = cell === state.king || state.defenders.indexOf(cell) >= 0;
    selected = mine && selected !== cell ? cell : -1;
    if (selected >= 0) {
      audio.ui('tick');
      ctx.note(`Lifted the ${selected === state.king ? 'king' : 'defender'} on ${cellName(selected)}; it may go to ${targets().map(cellName).join(', ') || 'nowhere'}.`);
    }
    draw();
    status('');
  }

  on(holder, 'click', click);
  const onKey = (e) => {
    const [r, c] = rc(cursor);
    let next = cursor;
    if (e.key === 'ArrowUp') next = ix(Math.max(0, r - 1), c);
    else if (e.key === 'ArrowDown') next = ix(Math.min(SIZE - 1, r + 1), c);
    else if (e.key === 'ArrowLeft') next = ix(r, Math.max(0, c - 1));
    else if (e.key === 'ArrowRight') next = ix(r, Math.min(SIZE - 1, c + 1));
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(cursor); return; }
    else if (e.key === 'Escape') { selected = -1; draw(); return; }
    else return;
    e.preventDefault();
    cursor = next;
    draw();
  };
  on(holder, 'keydown', onKey);

  on(undo, 'click', () => {
    if (anim || !history.length) return;
    const back = history.pop();
    state = back.state;
    line = back.line;
    selected = -1;
    audio.ui('flip');
    ctx.note('The move is taken back.');
    finish('Taken back.');
  });

  on(send, 'click', () => {
    if (!line.length) return;
    ctx.submit({ line: line.map(([from, to]) => [rc(from), rc(to)]) });
  });

  root.appendChild(wrap);
  ctx.note(`Brandubh endgame. The king's side moves first; the attackers answer by their published policy. The king must stand on a corner within ${instance.limit} moves.`);
  ctx.note(`King on ${cellName(instance.king)}; defenders on ${instance.defenders.map(cellName).join(', ') || 'none'}; attackers on ${instance.attackers.map(cellName).join(', ')}.`);
  if (ctx.solved) {
    send.disabled = true;
    undo.disabled = true;
  }
  finish('');

  return {
    unmount() {
      unbind();
      if (anim) clearTimeout(anim);
      if (raf) cancelAnimationFrame(raf);
      wrap.remove();
    },
  };
}

export default {
  id: ID,
  ordinal: 7,
  tier: 3,
  title: 'The King’s Road',
  epigraph: 'The board is small and the corners are far. Every road but one is a trap.',

  makePuzzle,
  solve,
  verify,
  wrongAnswers,
  shard: () => ({ ...SHARDS[ID] }),

  difficulty: { searchSpace: 1.5e5, minSteps: 19, estMinutes: 11 },

  hints: [
    'The attackers do not think. They capture when they can, and otherwise they lengthen your road — always the same way, every time.',
    'The move that shortens the king’s road most is the move that hands them a capture. Count what stands beyond the square you land on.',
    'Play the move their policy cannot answer, not the move that gains the most ground. Their reply is fixed — read it out before you commit to anything.',
  ],

  mount,
};
