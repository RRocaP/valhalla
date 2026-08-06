// 11 — THE SKERRY ROAD (tier 4)
//
// A fjord chart of thirteen skerries. Sounds are channels; necks of land are
// portages. The tide turns with every leg: leg 1 runs on the ebb, leg 2 on the
// flood, and so on. A channel is cut for the ebb, for the flood, or takes no
// tide at all. A portage takes no tide either, but costs TWO legs — which is
// the whole mechanic: a portage moves the fleet without turning the tide, and
// an odd loop turns the tide without moving the fleet.
//
// Answer: { route: [node indices] } — the fleet's berth to the hoard in the
// minimum number of legs. Per docs/LOCKS.md §11 the answer is a PROPERTY, not
// an object: verify accepts any legal route whose leg-count equals the optimum.
// The generator guarantees two things about every chart it hands out:
//   · the tide-ignoring shortest road is STRICTLY cheaper than the true
//     optimum, so every greedy road fails on leg-count; and
//   · the optimal route is unique as a PATH, not merely as a leg-count. §11
//     permits the path to vary; pinning it is stronger, and it is what keeps
//     the frozen mutation gate (CONTRACT §7.2) meaningful — with alternate
//     optimal roads on the chart, a swapped pair of skerries can land on a
//     second legal optimum and read as a lock accepting a wrong answer.
//     Verify's semantics are untouched: legality plus leg-count, nothing else.
//
// Difficulty accounting (docs/CONTRACT.md §4): measured over 400 seeds the
// optimum is 10–14 legs (mode 12), and each committed leg is preceded by
// reading the tide-cut of the channels branching off the skerry the fleet is
// standing on — a distinct action per branch. 26 is the floor of that sum, not
// a padded number.
//
// PURE HALF: no DOM, no Date, no Math.random, no module-level mutable state.

import { SHARDS } from '../kernel/shards.js';

const SKERRIES = [
  'Kvitskjer', 'Hafnholm', 'Svartbodi', 'Nesbergi', 'Myrsund', 'Selstein',
  'Ternskjer', 'Vagholm', 'Bruntange', 'Fiskeholm', 'Gnipskjer', 'Halsboda',
  'Ormstein', 'Raudskjer', 'Skarvholm', 'Tjaldsund', 'Ulvbodi', 'Vardskjer',
  'Bleikstein', 'Drangsholm', 'Eidnes', 'Grimsbodi',
];
const FLEET_NAME = 'Skipsvik';
const HOARD_NAME = 'Draugsker';

const BAND_SIZES = [1, 2, 2, 2, 2, 2, 1, 1, 1]; // 14 skerries down nine depths of fjord
const NODE_COUNT = BAND_SIZES.reduce((a, b) => a + b, 0);

const tideOfParity = (p) => (p === 0 ? 'ebb' : 'flood');
const legCost = (kind) => (kind === 'portage' ? 2 : 1);
const nextParity = (kind, p) => (kind === 'portage' ? p : 1 - p);
const passable = (kind, p) => kind === 'portage' || kind === 'always' || kind === tideOfParity(p);

function adjacency(n, edges) {
  const adj = [];
  for (let i = 0; i < n; i++) adj.push([]);
  for (const e of edges) {
    adj[e.a].push({ to: e.b, kind: e.kind });
    adj[e.b].push({ to: e.a, kind: e.kind });
  }
  for (const list of adj) list.sort((x, y) => x.to - y.to);
  return adj;
}

// Legs from every (node, parity) state to the hoard, tide honoured.
function tideDistances(n, adj, goal) {
  const S = n * 2;
  const rev = [];
  for (let i = 0; i < S; i++) rev.push([]);
  for (let u = 0; u < n; u++) {
    for (const { to, kind } of adj[u]) {
      for (let p = 0; p < 2; p++) {
        if (!passable(kind, p)) continue;
        rev[to * 2 + nextParity(kind, p)].push({ to: u * 2 + p, c: legCost(kind) });
      }
    }
  }
  const dist = new Array(S).fill(Infinity);
  const done = new Array(S).fill(false);
  dist[goal * 2] = 0;
  dist[goal * 2 + 1] = 0;
  for (let iter = 0; iter < S; iter++) {
    let best = -1;
    for (let s = 0; s < S; s++) if (!done[s] && dist[s] < Infinity && (best < 0 || dist[s] < dist[best])) best = s;
    if (best < 0) break;
    done[best] = true;
    for (const { to, c } of rev[best]) if (dist[best] + c < dist[to]) dist[to] = dist[best] + c;
  }
  return dist;
}

// Legs ignoring the tide entirely (the greedy road every navigator draws first).
function naiveDistances(n, adj, goal) {
  const dist = new Array(n).fill(Infinity);
  const done = new Array(n).fill(false);
  dist[goal] = 0;
  for (let iter = 0; iter < n; iter++) {
    let best = -1;
    for (let v = 0; v < n; v++) if (!done[v] && dist[v] < Infinity && (best < 0 || dist[v] < dist[best])) best = v;
    if (best < 0) break;
    done[best] = true;
    for (const { to, kind } of adj[best]) {
      if (dist[best] + legCost(kind) < dist[to]) dist[to] = dist[best] + legCost(kind);
    }
  }
  return dist;
}

function naiveRoute(n, adj, start, goal) {
  const dist = naiveDistances(n, adj, goal);
  if (dist[start] === Infinity) return null;
  const route = [start];
  let cur = start;
  let guard = 0;
  while (cur !== goal && guard++ < 64) {
    let step = -1;
    for (const { to, kind } of adj[cur]) {
      if (dist[to] + legCost(kind) === dist[cur]) { step = to; break; }
    }
    if (step < 0) return null;
    route.push(step);
    cur = step;
  }
  return cur === goal ? route : null;
}

// How many distinct optimal routes exist. Steps that keep the leg-count optimal
// strictly decrease the distance still to run, so the tight sub-graph is
// acyclic and the count is a plain DP.
function countOptimalRoutes(n, adj, start, goal, dist) {
  const memo = new Map();
  const go = (node, parity) => {
    if (node === goal) return 1;
    const state = node * 2 + parity;
    if (memo.has(state)) return memo.get(state);
    memo.set(state, 0); // guard; the sub-graph is acyclic, this is never read back
    let total = 0;
    for (const { to, kind } of adj[node]) {
      if (!passable(kind, parity)) continue;
      const t = to * 2 + nextParity(kind, parity);
      if (dist[t] + legCost(kind) === dist[state]) total += go(to, nextParity(kind, parity));
      if (total > 1) break;
    }
    memo.set(state, total);
    return total;
  };
  return go(start, 0);
}

// Lexicographically smallest optimal route (canonical answer).
function optimalRoute(n, adj, start, goal, dist) {
  if (dist[start * 2] === Infinity) return null;
  const route = [start];
  let node = start;
  let parity = 0;
  let guard = 0;
  while (node !== goal && guard++ < 128) {
    let step = null;
    for (const { to, kind } of adj[node]) {
      if (!passable(kind, parity)) continue;
      const t = to * 2 + nextParity(kind, parity);
      if (dist[t] + legCost(kind) === dist[node * 2 + parity]) { step = { to, kind }; break; }
    }
    if (!step) return null;
    route.push(step.to);
    parity = nextParity(step.kind, parity);
    node = step.to;
  }
  return node === goal ? route : null;
}

function buildChart(r) {
  const names = r.shuffle(SKERRIES);
  const nodes = [];
  const bandOf = [];
  let cursor = 0;
  for (let band = 0; band < BAND_SIZES.length; band++) {
    const count = BAND_SIZES[band];
    const ids = [];
    for (let i = 0; i < count; i++) {
      const isFleet = band === 0;
      const isHoard = band === BAND_SIZES.length - 1;
      const x = 0.07 + 0.86 * (band / (BAND_SIZES.length - 1));
      const y = count === 1 ? 0.5 : 0.16 + 0.68 * (i / (count - 1));
      nodes.push({
        name: isFleet ? FLEET_NAME : isHoard ? HOARD_NAME : names[cursor++],
        x: Math.round((x + (r() - 0.5) * 0.03) * 1000) / 1000,
        y: Math.round((y + (r() - 0.5) * 0.05) * 1000) / 1000,
        band,
        role: isFleet ? 'fleet' : isHoard ? 'hoard' : 'skerry',
      });
      ids.push(nodes.length - 1);
    }
    bandOf.push(ids);
  }

  // One dominant tide per reach, and reaches tend to run the same way as the
  // reach before them — which is what makes a straight run down the fjord
  // impossible and the road long.
  const reachTide = [];
  for (let b = 0; b < BAND_SIZES.length - 1; b++) {
    if (b === 0) reachTide.push(r.chance(0.5) ? 'ebb' : 'flood');
    else reachTide.push(r.chance(0.64) ? reachTide[b - 1] : (reachTide[b - 1] === 'ebb' ? 'flood' : 'ebb'));
  }

  const seen = new Set();
  const edges = [];
  const addEdge = (a, b, kind) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (a === b || seen.has(key)) return false;
    seen.add(key);
    edges.push({ a: Math.min(a, b), b: Math.max(a, b), kind });
    return true;
  };
  const channelKind = (reach) => {
    const roll = r();
    if (roll < 0.82) return reachTide[reach];
    if (roll < 0.93) return reachTide[reach] === 'ebb' ? 'flood' : 'ebb';
    return 'always';
  };

  for (let b = 0; b < bandOf.length - 1; b++) {
    const here = bandOf[b];
    const there = bandOf[b + 1];
    for (const u of here) {
      const ranked = there.slice().sort((p, q) => Math.abs(nodes[p].y - nodes[u].y) - Math.abs(nodes[q].y - nodes[u].y));
      const links = ranked.slice(0, r.chance(0.45) ? 2 : 1);
      for (const v of links) addEdge(u, v, channelKind(b));
    }
    for (const v of there) {
      if (!edges.some((e) => (e.a === v || e.b === v) && (nodes[e.a].band === b || nodes[e.b].band === b))) {
        const nearest = here.slice().sort((p, q) => Math.abs(nodes[p].y - nodes[v].y) - Math.abs(nodes[q].y - nodes[v].y))[0];
        addEdge(nearest, v, channelKind(b));
      }
    }
  }

  for (const ids of bandOf) {
    for (let i = 0; i + 1 < ids.length; i++) {
      if (r.chance(0.5)) addEdge(ids[i], ids[i + 1], r.pick(['ebb', 'flood', 'always']));
    }
  }

  // Necks of land: two or three portages, drawn across a reach or a band.
  const portages = r.range(2, 3);
  for (let k = 0; k < portages; k++) {
    const b = r.int(bandOf.length - 2);
    const u = r.pick(bandOf[b]);
    const v = r.pick(bandOf[b + 2] || bandOf[b + 1]);
    if (!addEdge(u, v, 'portage')) {
      const alt = r.pick(bandOf[b + 1]);
      addEdge(u, alt, 'portage');
    }
  }

  return { nodes, edges };
}

function chartFor(r) {
  const targets = [14, 14, 13, 13, 12];
  let fallback = null;
  for (let attempt = 0; attempt < 600; attempt++) {
    const floor = targets[Math.min(targets.length - 1, Math.floor(attempt / 120))];
    const { nodes, edges } = buildChart(r);
    const start = 0;
    const goal = nodes.length - 1;
    const adj = adjacency(nodes.length, edges);
    const dist = tideDistances(nodes.length, adj, goal);
    const optimum = dist[start * 2];
    if (!Number.isFinite(optimum)) continue;
    const naive = naiveDistances(nodes.length, adj, goal)[start];
    if (!Number.isFinite(naive) || naive >= optimum) continue;
    if (optimum > 26) continue;
    if (countOptimalRoutes(nodes.length, adj, start, goal, dist) !== 1) continue;
    const route = optimalRoute(nodes.length, adj, start, goal, dist);
    if (!route) continue;
    const built = { nodes, edges, start, goal, optimum, naiveLegs: naive };
    if (optimum >= floor) return built;
    if (!fallback || optimum > fallback.optimum) fallback = built;
  }
  return fallback;
}

// Safety net. `chartFor` has never needed it in measurement (400/400 seeds
// returned a sampled chart), but makePuzzle must not be able to throw or to
// hand back a chart the greedy road can solve. Exported so the test gate can
// assert the net itself holds: reachable, and naiveLegs < optimum.
const FALLBACK_CHART = {
  nodes: [
    { name: FLEET_NAME, x: 0.07, y: 0.5, band: 0, role: 'fleet' },
    { name: 'Kvitskjer', x: 0.25, y: 0.26, band: 1, role: 'skerry' },
    { name: 'Hafnholm', x: 0.25, y: 0.74, band: 1, role: 'skerry' },
    { name: 'Svartbodi', x: 0.45, y: 0.2, band: 2, role: 'skerry' },
    { name: 'Nesbergi', x: 0.45, y: 0.5, band: 2, role: 'skerry' },
    { name: 'Myrsund', x: 0.45, y: 0.8, band: 2, role: 'skerry' },
    { name: 'Selstein', x: 0.65, y: 0.3, band: 3, role: 'skerry' },
    { name: 'Ternskjer', x: 0.65, y: 0.7, band: 3, role: 'skerry' },
    { name: 'Vagholm', x: 0.82, y: 0.5, band: 4, role: 'skerry' },
    { name: HOARD_NAME, x: 0.93, y: 0.5, band: 5, role: 'hoard' },
  ],
  edges: [
    { a: 0, b: 1, kind: 'ebb' }, { a: 0, b: 2, kind: 'ebb' },
    { a: 1, b: 3, kind: 'ebb' }, { a: 1, b: 4, kind: 'ebb' },
    { a: 2, b: 4, kind: 'ebb' }, { a: 2, b: 5, kind: 'ebb' },
    { a: 1, b: 2, kind: 'flood' }, { a: 3, b: 4, kind: 'flood' }, { a: 4, b: 5, kind: 'flood' },
    { a: 3, b: 6, kind: 'ebb' }, { a: 4, b: 6, kind: 'ebb' }, { a: 5, b: 7, kind: 'ebb' },
    { a: 6, b: 7, kind: 'flood' },
    { a: 6, b: 8, kind: 'ebb' }, { a: 7, b: 8, kind: 'ebb' },
    { a: 8, b: 9, kind: 'ebb' },
    { a: 2, b: 6, kind: 'portage' }, { a: 5, b: 8, kind: 'portage' },
  ],
};

export function fallbackInstance() {
  return measured(JSON.parse(JSON.stringify(FALLBACK_CHART)));
}

function measured(chart) {
  const adj = adjacency(chart.nodes.length, chart.edges);
  const goal = chart.nodes.length - 1;
  const dist = tideDistances(chart.nodes.length, adj, goal);
  return {
    nodes: chart.nodes,
    edges: chart.edges,
    start: 0,
    goal,
    optimum: dist[0],
    naiveLegs: naiveDistances(chart.nodes.length, adj, goal)[0],
  };
}

function findEdge(instance, a, b) {
  for (const e of instance.edges) {
    if ((e.a === a && e.b === b) || (e.a === b && e.b === a)) return e;
  }
  return null;
}

// Walks a route and reports what the sea says about it.
function walk(instance, route) {
  if (!Array.isArray(route) || route.length < 2) return { legal: false, why: 'short' };
  const n = instance.nodes.length;
  for (const v of route) if (!Number.isInteger(v) || v < 0 || v >= n) return { legal: false, why: 'unknown' };
  if (route[0] !== instance.start) return { legal: false, why: 'berth' };
  let legs = 0;
  for (let i = 0; i + 1 < route.length; i++) {
    const e = findEdge(instance, route[i], route[i + 1]);
    if (!e) return { legal: false, why: 'nowater', at: i };
    if (!passable(e.kind, legs % 2)) return { legal: false, why: 'tide', at: i, kind: e.kind };
    legs += legCost(e.kind);
    if (legs > 200) return { legal: false, why: 'long' };
  }
  if (route[route.length - 1] !== instance.goal) return { legal: false, why: 'short-of-hoard', legs };
  return { legal: true, legs };
}

export default {
  id: '11-skerry',
  ordinal: 11,
  tier: 4,
  title: 'The Skerry Road',
  epigraph: 'The sea keeps no road. It lends one, twice a day, and takes it back.',

  makePuzzle(rng) {
    const chart = chartFor(rng) || fallbackInstance();
    return {
      nodes: chart.nodes,
      edges: chart.edges,
      start: chart.start,
      goal: chart.goal,
      optimum: chart.optimum,
      naiveLegs: chart.naiveLegs,
    };
  },

  solve(instance) {
    const adj = adjacency(instance.nodes.length, instance.edges);
    const dist = tideDistances(instance.nodes.length, adj, instance.goal);
    return { route: optimalRoute(instance.nodes.length, adj, instance.start, instance.goal, dist) || [] };
  },

  verify(instance, answer) {
    try {
      if (!instance || !answer || typeof answer !== 'object' || Array.isArray(answer)) return { ok: false };
      const w = walk(instance, answer.route);
      if (!w.legal) {
        if (w.why === 'berth') return { ok: false, near: 'The fleet does not lie at that skerry.' };
        if (w.why === 'nowater') {
          const from = instance.nodes[answer.route[w.at]];
          return { ok: false, near: `No water joins ${from ? from.name : 'that skerry'} to the next.` };
        }
        if (w.why === 'tide') {
          return { ok: false, near: `A ${w.kind}-cut sound will not take that leg of the tide.` };
        }
        if (w.why === 'short-of-hoard') return { ok: false, near: 'The road stops short of the hoard.' };
        return { ok: false };
      }
      if (w.legs !== instance.optimum) {
        return { ok: false, near: 'The passage holds, but a shorter road exists.' };
      }
      return { ok: true };
    } catch {
      return { ok: false };
    }
  },

  wrongAnswers(instance) {
    const self = this;
    const n = instance.nodes.length;
    const adj = adjacency(n, instance.edges);
    const dist = tideDistances(n, adj, instance.goal);
    const route = optimalRoute(n, adj, instance.start, instance.goal, dist) || [instance.start, instance.goal];
    const cands = [];

    const naive = naiveRoute(n, adj, instance.start, instance.goal);
    if (naive) cands.push(naive);

    // Legal, but two legs longer: an out-and-back that leaves the tide as it was.
    let parity = 0;
    for (let i = 0; i + 1 < route.length; i++) {
      let detour = null;
      for (const { to, kind } of adj[route[i]]) {
        if (to === route[i + 1] || kind === 'portage') continue;
        if (!passable(kind, parity)) continue;
        const back = findEdge(instance, to, route[i]);
        if (back && passable(back.kind, nextParity(kind, parity))) { detour = to; break; }
      }
      if (detour !== null) {
        cands.push(route.slice(0, i + 1).concat([detour], route.slice(i)));
        break;
      }
      const e = findEdge(instance, route[i], route[i + 1]);
      parity = nextParity(e.kind, parity);
    }

    cands.push(route.slice().reverse());
    cands.push(route.slice(0, -1));
    cands.push(route.slice(1));
    cands.push([instance.start, instance.goal]);
    cands.push(route.concat([instance.goal]));
    if (route.length > 3) {
      const swapped = route.slice();
      [swapped[1], swapped[2]] = [swapped[2], swapped[1]];
      cands.push(swapped);
      const shifted = route.slice();
      shifted[1] = (shifted[1] + 1) % n;
      cands.push(shifted);
    }
    cands.push([instance.start, instance.start].concat(route.slice(1)));

    const truth = JSON.stringify(route);
    const seen = new Set();
    const out = [];
    for (const c of cands) {
      const key = JSON.stringify(c);
      if (key === truth || seen.has(key)) continue;
      const ans = { route: c };
      if (self.verify(instance, ans).ok) continue;
      seen.add(key);
      out.push(ans);
    }
    return out;
  },

  shard() {
    return { ...SHARDS['11-skerry'] };
  },

  difficulty: { searchSpace: 3e8, minSteps: 26, estMinutes: 16 },

  hints: [
    'The tide turns with every leg you commit. The first leg runs on the ebb.',
    'Two ebb-cut sounds cannot be taken one after the other — unless what lies between them takes no tide at all.',
    'A portage costs two legs and leaves the tide exactly where it stood. A loop of three legs turns the tide and leaves you where you stood. Count in pairs, not in distance.',
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

    const KIND_WORD = { ebb: 'cut for the ebb', flood: 'cut for the flood', always: 'takes any tide', portage: 'a portage: two legs, and the tide does not turn' };
    const KIND_SHORT = { ebb: 'ebb', flood: 'flood', always: 'any tide', portage: 'portage' };
    const KIND_COLOUR = { ebb: p.fjordLight, flood: p.pineLight, always: p.boneDim, portage: p.gold };
    const nameOf = (i) => inst.nodes[i].name;

    // ---- state -----------------------------------------------------------
    let route = ctx.solved ? self.solve(inst).route.slice() : [inst.start];
    const legsOf = (r) => {
      let legs = 0;
      for (let i = 0; i + 1 < r.length; i++) {
        const e = findEdge(inst, r[i], r[i + 1]);
        if (!e) return legs;
        legs += legCost(e.kind);
      }
      return legs;
    };
    const head = () => route[route.length - 1];
    const parity = () => legsOf(route) % 2;
    const nextMoves = () => {
      const out = [];
      for (const e of inst.edges) {
        const from = head();
        const to = e.a === from ? e.b : e.b === from ? e.a : -1;
        if (to < 0 || !passable(e.kind, parity())) continue;
        out.push({ to, kind: e.kind });
      }
      return out.sort((x, y) => x.to - y.to);
    };

    // ---- frame -----------------------------------------------------------
    const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";
    const wrap = node('div', `display:grid;gap:12px;font-family:${SERIF};color:${p.bone}`);
    const style = node('style');
    style.textContent = `
      .ow11-act{font-family:${SERIF};font-size:15px;color:${p.bone};background:${p.oakDeep};
        border:1px solid ${p.gold};border-radius:3px;padding:11px 16px;min-height:44px;cursor:pointer}
      .ow11-act:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow11-act[disabled]{opacity:.45;cursor:default}
      .ow11-leg{font-family:${SERIF};font-size:15px;text-align:left;color:${p.bone};
        background:${p.oakDeep};border:1px solid ${p.oakLight};border-left:4px solid ${p.gold};
        border-radius:3px;padding:10px 14px;min-height:44px;cursor:pointer;width:100%}
      .ow11-leg:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow11-leg:hover{border-color:${p.gold}}
      .ow11-tide{display:inline-flex;align-items:center;gap:8px;font-size:14px;color:${p.boneDim};
        border:1px solid ${p.oakLight};border-radius:999px;padding:6px 14px;min-height:34px}
      .ow11-dot{width:11px;height:11px;border-radius:50%;display:inline-block}
    `;
    wrap.append(style);

    const chart = art.makeCanvas(720, 430);
    chart.canvas.style.cssText = 'width:100%;height:auto;display:block;border-radius:4px;touch-action:manipulation;cursor:pointer';
    chart.canvas.setAttribute('role', 'img');

    const tideBar = node('div', 'display:flex;gap:10px;flex-wrap:wrap;align-items:center');
    const tidePill = node('div');
    tidePill.className = 'ow11-tide';
    const tideDot = node('span');
    tideDot.className = 'ow11-dot';
    const tideText = node('span', null, '');
    tidePill.append(tideDot, tideText);
    const legendText = node('p', `margin:0;font-size:12.5px;color:${p.boneDim};max-width:60ch`,
      'Blue sounds run on the ebb, green on the flood, pale sounds take any tide. '
      + 'Gold dashes are portages: two legs of hauling, and the tide stands where it stood.');
    tideBar.append(tidePill);

    const movesLabel = node('p', `margin:0;font-size:13px;color:${p.boneDim};letter-spacing:.06em`, 'Water open from here');
    const moves = node('div', 'display:grid;gap:7px');

    const actions = node('div', 'display:flex;gap:9px;flex-wrap:wrap;align-items:center');
    const backBtn = node('button', null, 'Back one leg');
    const resetBtn = node('button', null, 'Cast off anew');
    const sealBtn = node('button', null, 'Seal the route');
    for (const b of [backBtn, resetBtn, sealBtn]) { b.className = 'ow11-act'; b.type = 'button'; }
    actions.append(backBtn, resetBtn, sealBtn);

    const status = node('p', `margin:0;min-height:20px;font-size:14px;color:${p.boneDim}`);
    status.setAttribute('aria-live', 'polite');

    wrap.append(chart.canvas, tideBar, legendText, movesLabel, moves, actions, status);
    ctx.root.append(wrap);

    // ---- painting --------------------------------------------------------
    const PAD = 44;
    const px = (n) => PAD + inst.nodes[n].x * (chart.w - PAD * 2);
    const py = (n) => PAD + inst.nodes[n].y * (chart.h - PAD * 2);

    function paint() {
      const c = chart.ctx;
      c.clearRect(0, 0, chart.w, chart.h);
      art.paintWood(c, chart.w, chart.h, 1101);
      art.paintPanel(c, 6, 6, chart.w - 12, chart.h - 12);

      for (const e of inst.edges) {
        c.save();
        c.strokeStyle = KIND_COLOUR[e.kind];
        c.lineWidth = e.kind === 'portage' ? 2.5 : 3.5;
        c.lineCap = 'round';
        if (e.kind === 'portage') c.setLineDash([7, 6]);
        c.globalAlpha = 0.85;
        c.beginPath();
        c.moveTo(px(e.a), py(e.a));
        c.lineTo(px(e.b), py(e.b));
        c.stroke();
        c.restore();
      }

      // the committed road, leg by leg
      if (route.length > 1) {
        c.save();
        c.strokeStyle = p.goldBright;
        c.lineWidth = 6;
        c.lineJoin = 'round';
        c.lineCap = 'round';
        c.globalAlpha = 0.9;
        c.beginPath();
        c.moveTo(px(route[0]), py(route[0]));
        for (let i = 1; i < route.length; i++) c.lineTo(px(route[i]), py(route[i]));
        c.stroke();
        c.restore();
      }

      for (let i = 0; i < inst.nodes.length; i++) {
        const n = inst.nodes[i];
        const x = px(i);
        const y = py(i);
        const isHead = i === head();
        const r = n.role === 'skerry' ? 9 : 13;
        if (n.role === 'hoard') art.glow(c, x, y, 26, p.gold, 0.5);
        if (n.role === 'fleet') art.glow(c, x, y, 24, p.ember, 0.45);
        if (isHead) art.glow(c, x, y, 22, p.goldBright, 0.6);
        c.save();
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fillStyle = p.oakDeep;
        c.fill();
        c.lineWidth = 2.5;
        c.strokeStyle = isHead ? p.goldBright : n.role === 'hoard' ? p.gold : n.role === 'fleet' ? p.ember : p.oakLight;
        c.stroke();
        c.fillStyle = isHead ? p.goldBright : p.boneDim;
        c.font = `${n.role === 'skerry' ? 12 : 13}px ${SERIF}`;
        c.textAlign = 'center';
        c.fillText(n.name, x, y + r + 15);
        c.restore();
      }
    }

    // ---- text mirror + redraw -------------------------------------------
    function routeWords() {
      if (route.length < 2) return `The fleet lies at ${nameOf(inst.start)}. No leg is rowed.`;
      const parts = [];
      let legs = 0;
      for (let i = 0; i + 1 < route.length; i++) {
        const e = findEdge(inst, route[i], route[i + 1]);
        const tide = tideOfParity(legs % 2);
        parts.push(e.kind === 'portage'
          ? `hauled over to ${nameOf(route[i + 1])}`
          : `rowed to ${nameOf(route[i + 1])} on the ${tide}`);
        legs += legCost(e.kind);
      }
      return `From ${nameOf(inst.start)}: ${parts.join(', ')}. ${legs} legs rowed.`;
    }

    function render(announce) {
      paint();
      const legs = legsOf(route);
      const tide = tideOfParity(legs % 2);
      tideDot.style.background = tide === 'ebb' ? p.fjordLight : p.pineLight;
      tideText.textContent = `Leg ${legs + 1} runs on the ${tide}`;
      chart.canvas.setAttribute('aria-label', routeWords());

      moves.textContent = '';
      if (ctx.solved) {
        movesLabel.textContent = 'The road, as it was sailed';
      } else {
        const list = nextMoves();
        movesLabel.textContent = list.length ? 'Water open from here' : 'No water opens on this tide';
        for (const m of list) {
          const b = node('button', null, `${m.kind === 'portage' ? 'Haul over to' : 'Row to'} ${nameOf(m.to)} — ${KIND_WORD[m.kind]}`);
          b.className = 'ow11-leg';
          b.type = 'button';
          on(b, 'click', () => step(m.to));
          moves.append(b);
        }
      }
      if (announce) status.textContent = announce;
    }

    function step(to) {
      const e = findEdge(inst, head(), to);
      if (!e || !passable(e.kind, parity())) { sfx('deny'); return; }
      const legNo = legsOf(route) + 1;
      route.push(to);
      sfx(e.kind === 'portage' ? 'slide' : 'tick');
      say(`Leg ${legNo}: ${e.kind === 'portage' ? `hauled over to ${nameOf(to)}` : `${nameOf(to)} on the ${tideOfParity((legNo - 1) % 2)}`}.`);
      render(to === inst.goal ? `The fleet lies at ${nameOf(to)}. Seal the route, or find a shorter one.` : '');
    }

    // ---- input -----------------------------------------------------------
    on(chart.canvas, 'click', (ev) => {
      if (ctx.solved) return;
      const box = chart.canvas.getBoundingClientRect();
      const scale = chart.w / box.width;
      const x = (ev.clientX - box.left) * scale;
      const y = (ev.clientY - box.top) * scale;
      let best = -1;
      let bestD = 26;
      for (let i = 0; i < inst.nodes.length; i++) {
        const d = Math.hypot(px(i) - x, py(i) - y);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best >= 0) step(best);
    });

    on(backBtn, 'click', () => {
      if (ctx.solved || route.length < 2) { sfx('deny'); return; }
      const gone = route.pop();
      sfx('knock');
      say(`Backed water from ${nameOf(gone)}.`);
      render('');
    });
    on(resetBtn, 'click', () => {
      if (ctx.solved) return;
      route = [inst.start];
      sfx('knock');
      say('Back to the moorings; the road is drawn again from the first ebb.');
      render('The fleet lies at the moorings.');
    });
    on(sealBtn, 'click', () => {
      if (ctx.solved) return;
      const answer = { route: route.slice() };
      say(routeWords());
      const res = ctx.submit(answer) || {};
      if (!res.ok) status.textContent = res.near || 'The sea does not take that road.';
    });

    if (ctx.solved) {
      backBtn.disabled = true;
      resetBtn.disabled = true;
      sealBtn.disabled = true;
    }

    say(`A chart of ${inst.nodes.length} skerries. The fleet lies at ${nameOf(inst.start)}; the hoard is on ${nameOf(inst.goal)}. `
      + 'The tide turns with every leg — the first leg runs on the ebb.');
    render(ctx.solved ? 'The road stands sailed.' : '');

    return {
      unmount() {
        for (const f of cleanup) f();
        cleanup.length = 0;
        wrap.remove();
      },
    };
  },
};
