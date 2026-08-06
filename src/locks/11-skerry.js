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
// an object: verify accepts any legal route whose leg-count equals the
// optimum. The generator guarantees the tide-ignoring shortest road is
// strictly cheaper than the true optimum, so every greedy road fails on count.
//
// Difficulty accounting (docs/CONTRACT.md §4): measured over 400 seeds the
// optimum is 11–18 legs (typical 12–14), and reading a channel's tide-cut
// before committing to it is a distinct action on every branch the line
// actually touches. 26 is the floor of that sum, not a padded number.
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
    return { unmount() {} };
  },
};
