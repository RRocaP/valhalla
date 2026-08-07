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
// ---- view --------------------------------------------------------------------
// The board is a captain's chart table. An oiled-vellum fjord chart lies pinned
// to the oak: water depth-shaded in fjord blues under hand-inked contours and
// soundings, skerries cut as rock hatchings with their names in a scribe hand,
// and every channel drawn as the passage it is — falling-tide glyphs on an
// ebb-cut sound, rising glyphs on a flood-cut one, a dotted sledge track over a
// portage. The tide is a moon-dial in the sheet's corner: it TURNS on every
// committed leg, and at the turn the sounds cut for the other tide close in
// front of you. The route is a tarred cord with a knot tied for each leg rowed
// and the ship token at its head.
//
// Nothing below touches the pure half. The par (instance.optimum) is never
// drawn, spoken or mirrored — the player counts knots, not the answer.

const SERIF = "'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif";

// Board copy. English is the source; es/ca live in the additive i18n block
// (docs/CONTRACT.md §4.1 amendment) and resolve through it at mount.
const BOARD_EN = {
  legend: 'Falling glyphs mark a sound cut for the ebb, rising glyphs one cut for the flood; a plain sounding takes any tide. A dotted sledge track is a portage — two legs of hauling, and the tide stands where it stood.',
  movesOpen: 'Water open from here',
  movesShut: 'No water opens on this tide',
  movesSailed: 'The road, as it was sailed',
  rowTo: 'Row to',
  haulTo: 'Haul over to',
  kindEbb: 'cut for the ebb',
  kindFlood: 'cut for the flood',
  kindAlways: 'takes any tide',
  kindPortage: 'a portage: two legs, and the tide does not turn',
  ebb: 'ebb',
  flood: 'flood',
  ebbMark: 'EBB',
  floodMark: 'FLOOD',
  legRuns: 'Leg {n} runs on the {tide}',
  knots0: 'No knot in the cord yet',
  knots1: 'One knot in the cord — one leg rowed',
  knotsN: '{n} knots in the cord — {n} legs rowed',
  back: 'Back one leg',
  reset: 'Cast off anew',
  seal: 'Seal the route',
  skip: 'Skip the showing',
  demoSay: 'Watch once: one leg is committed — the moon turns, and every sound cut for the other tide closes.',
  noLeg: 'The fleet lies at {name}. No leg is rowed.',
  fromRun: 'From {start}: {parts}. {n} legs rowed.',
  rowedTo: 'rowed to {name} on the {tide}',
  hauledTo: 'hauled over to {name}',
  legNote: 'Leg {n}: {what}.',
  atHoard: 'The fleet lies at {name}. Seal the route, or find a shorter one.',
  backNote: 'Backed water from {name}.',
  resetNote: 'Back to the moorings; the road is drawn again from the first ebb.',
  resetSay: 'The fleet lies at the moorings.',
  openNote: 'A chart of {n} skerries. The fleet lies at {fleet}; the hoard is on {hoard}. The tide turns with every leg — the first leg runs on the ebb.',
  solvedLine: 'The road stands sailed.',
  denyLine: 'The sea does not take that road.',
};

const I18N = {
  es: {
    title: 'El Camino de los Escollos',
    epigraph: 'El mar no guarda camino: lo presta,\nbajamar y pleamar. Navega tramo a tramo —\nlo que abre esta marea, la siguiente lo cierra.',
    hints: [
      'La marea cambia con cada tramo que confirmas. El primer tramo corre con el reflujo.',
      'Dos canales cortados para el reflujo no pueden tomarse uno tras otro — salvo que lo que quede entre ellos no atienda a marea alguna.',
      'Un varadero cuesta dos tramos y deja la marea exactamente donde estaba. Un lazo de tres tramos gira la marea y te deja donde estabas. Cuenta por pares, no por distancia.',
    ],
    nearMap: {
      'The fleet does not lie at that skerry.': 'La flota no está fondeada en ese escollo.',
      'The road stops short of the hoard.': 'El camino se queda corto ante el tesoro.',
      'The passage holds, but a shorter road exists.': 'El paso se sostiene, pero existe un camino más corto.',
    },
    board: {
      legend: 'Los signos que caen marcan un canal cortado para el reflujo; los que suben, uno cortado para el flujo; una sonda lisa atiende a cualquier marea. Una senda de trineo punteada es un varadero: dos tramos de arrastre, y la marea queda donde estaba.',
      movesOpen: 'Agua abierta desde aquí',
      movesShut: 'Ningún agua se abre con esta marea',
      movesSailed: 'El camino, tal como se navegó',
      rowTo: 'Remar a',
      haulTo: 'Arrastrar hasta',
      kindEbb: 'cortado para el reflujo',
      kindFlood: 'cortado para el flujo',
      kindAlways: 'atiende a cualquier marea',
      kindPortage: 'un varadero: dos tramos, y la marea no cambia',
      ebb: 'reflujo',
      flood: 'flujo',
      ebbMark: 'REFLUJO',
      floodMark: 'FLUJO',
      legRuns: 'El tramo {n} corre con el {tide}',
      knots0: 'Ningún nudo en el cabo todavía',
      knots1: 'Un nudo en el cabo — un tramo remado',
      knotsN: '{n} nudos en el cabo — {n} tramos remados',
      back: 'Deshacer un tramo',
      reset: 'Zarpar de nuevo',
      seal: 'Sellar la ruta',
      skip: 'Saltar la muestra',
      demoSay: 'Mira una vez: se confirma un tramo — la luna gira, y se cierra todo canal cortado para la otra marea.',
      noLeg: 'La flota está en {name}. No se ha remado ningún tramo.',
      fromRun: 'Desde {start}: {parts}. {n} tramos remados.',
      rowedTo: 'remado a {name} con el {tide}',
      hauledTo: 'arrastrado hasta {name}',
      legNote: 'Tramo {n}: {what}.',
      atHoard: 'La flota está en {name}. Sella la ruta, o encuentra una más corta.',
      backNote: 'Ciada desde {name}.',
      resetNote: 'De vuelta al fondeadero; el camino se traza otra vez desde el primer reflujo.',
      resetSay: 'La flota está en el fondeadero.',
      openNote: 'Una carta de {n} escollos. La flota está en {fleet}; el tesoro, en {hoard}. La marea cambia con cada tramo — el primero corre con el reflujo.',
      solvedLine: 'El camino queda navegado.',
      denyLine: 'El mar no admite ese camino.',
    },
  },
  ca: {
    title: 'El Camí dels Esculls',
    epigraph: 'El mar no guarda camí: el presta,\nmarea baixa i plena. Navega tram a tram —\nel que obre aquesta marea, la següent ho tanca.',
    hints: [
      'La marea gira amb cada tram que confirmes. El primer tram corre amb el reflux.',
      'Dos canals tallats per al reflux no es poden prendre l’un darrere l’altre — llevat que allò que hi ha entremig no atengui cap marea.',
      'Un varador costa dos trams i deixa la marea exactament on era. Un llaç de tres trams gira la marea i et deixa on eres. Compta per parells, no per distància.',
    ],
    nearMap: {
      'The fleet does not lie at that skerry.': 'La flota no fondeja en aquell escull.',
      'The road stops short of the hoard.': 'El camí es queda curt davant del tresor.',
      'The passage holds, but a shorter road exists.': 'El pas s’aguanta, però hi ha un camí més curt.',
    },
    board: {
      legend: 'Els signes que cauen marquen un canal tallat per al reflux; els que pugen, un de tallat per al flux; una sonda llisa atén qualsevol marea. Un camí de trineu puntejat és un varador: dos trams d’arrossegament, i la marea queda on era.',
      movesOpen: 'Aigua oberta des d’aquí',
      movesShut: 'Cap aigua no s’obre amb aquesta marea',
      movesSailed: 'El camí, tal com es va navegar',
      rowTo: 'Remar a',
      haulTo: 'Arrossegar fins a',
      kindEbb: 'tallat per al reflux',
      kindFlood: 'tallat per al flux',
      kindAlways: 'atén qualsevol marea',
      kindPortage: 'un varador: dos trams, i la marea no gira',
      ebb: 'reflux',
      flood: 'flux',
      ebbMark: 'REFLUX',
      floodMark: 'FLUX',
      legRuns: 'El tram {n} corre amb el {tide}',
      knots0: 'Cap nus al cap encara',
      knots1: 'Un nus al cap — un tram remat',
      knotsN: '{n} nusos al cap — {n} trams remats',
      back: 'Desfer un tram',
      reset: 'Salpar de nou',
      seal: 'Segellar la ruta',
      skip: 'Saltar la mostra',
      demoSay: 'Mira-ho un cop: es confirma un tram — la lluna gira, i es tanca tot canal tallat per a l’altra marea.',
      noLeg: 'La flota és a {name}. No s’ha remat cap tram.',
      fromRun: 'Des de {start}: {parts}. {n} trams remats.',
      rowedTo: 'remat a {name} amb el {tide}',
      hauledTo: 'arrossegat fins a {name}',
      legNote: 'Tram {n}: {what}.',
      atHoard: 'La flota és a {name}. Segella la ruta, o troba’n una de més curta.',
      backNote: 'Ciada des de {name}.',
      resetNote: 'De tornada a l’amarrador; el camí es torna a traçar des del primer reflux.',
      resetSay: 'La flota és a l’amarrador.',
      openNote: 'Una carta de {n} esculls. La flota és a {fleet}; el tresor, a {hoard}. La marea gira amb cada tram — el primer corre amb el reflux.',
      solvedLine: 'El camí queda navegat.',
      denyLine: 'El mar no admet aquell camí.',
    },
  },
};

export default {
  id: '11-skerry',
  ordinal: 11,
  tier: 4,
  title: 'The Skerry Road',
  epigraph: 'The sea keeps no road; it lends one,\nebb then flood. Sail leg by leg —\nwhat this tide opens, the next will close.',

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
  i18n: I18N,

  mount(ctx) {
    const art = ctx.art;
    const p = art.palette;
    const inst = ctx.instance;
    const self = this;

    const lang = ctx.lang || 'en';
    const L = (I18N[lang] && I18N[lang].board) || {};
    const T = (key, params) => {
      let s = key in L ? L[key] : BOARD_EN[key];
      if (params) for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]));
      return s;
    };
    const NEARS = (I18N[lang] && I18N[lang].nearMap) || {};
    const localNear = (t) => (t && NEARS[t]) || t;

    const cleanup = [];
    const timers = [];
    let frameId = 0;
    const on = (el, ev, fn, opts) => {
      el.addEventListener(ev, fn, opts);
      cleanup.push(() => el.removeEventListener(ev, fn, opts));
    };
    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const sfx = (k) => { try { ctx.audio && ctx.audio.ui && ctx.audio.ui(k); } catch (e) { /* silent hall */ } };
    const say = (t) => { try { ctx.note && ctx.note(t); } catch (e) { /* no journal */ } };
    const node = (tag, css, text) => {
      const n = document.createElement(tag);
      if (css) n.style.cssText = css;
      if (text != null) n.textContent = text;
      return n;
    };
    const calm = (() => {
      try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
      catch (e) { return false; }
    })();
    const RAF = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null;
    const CAF = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null;
    const clock = () => {
      try { return performance.now(); } catch (e) { return 0; }
    };

    // ---- view-side colour + noise (the frozen art API exposes tokens, not maths)
    const hx = (h) => { const n = parseInt(String(h).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const mixHex = (a, b, t) => {
      const A = hx(a);
      const B = hx(b);
      const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
      return `#${((c[0] << 16) | (c[1] << 8) | c[2]).toString(16).padStart(6, '0')}`;
    };
    const rgba = (h, a) => { const [r, g, b] = hx(h); return `rgba(${r},${g},${b},${a})`; };
    const h32 = (n) => {
      let x = (n | 0) + 0x9e3779b9;
      x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
      x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
      return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
    };
    const nz = (a, b) => h32(a * 7349 + b * 92821 + 1103);

    // the chart's inks, all struck from the frozen palette. The sheet is OILED
    // vellum — amber and half-translucent, not paper — so it sits in the same
    // hearth light as the oak it is pinned to.
    const VELLUM = mixHex(p.bone, p.oak, 0.54);
    const VELLUM_LIT = mixHex(p.bone, p.oak, 0.42);
    const VELLUM_EDGE = mixHex(p.bone, p.oak, 0.86);
    const INK = mixHex(p.tar, p.oakDeep, 0.28);
    const INK_SOFT = mixHex(p.tar, VELLUM, 0.34);
    const ROCK = mixHex(VELLUM, p.oakDeep, 0.36);
    const KIND_INK = {
      ebb: mixHex(p.fjord, p.tar, 0.34),
      flood: mixHex(p.pine, p.tar, 0.2),
      always: INK_SOFT,
      portage: mixHex(p.gold, p.tar, 0.44),
    };
    const KIND_WORD = { ebb: 'kindEbb', flood: 'kindFlood', always: 'kindAlways', portage: 'kindPortage' };
    const nameOf = (i) => inst.nodes[i].name;
    const tideWord = (parity) => T(parity === 0 ? 'ebb' : 'flood');

    // ---- state --------------------------------------------------------------
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
      const from = head();
      for (const e of inst.edges) {
        const to = e.a === from ? e.b : e.b === from ? e.a : -1;
        if (to < 0 || !passable(e.kind, parity())) continue;
        out.push({ to, kind: e.kind });
      }
      return out.sort((x, y) => x.to - y.to);
    };

    let dispPhase = parity();          // the moon-dial's drawn tide, 0 ebb .. 1 flood
    let tideAnim = null;               // { from, to, t0 } while the dial turns
    let closeFlash = null;             // { t0, edges } the sounds that just shut
    let demo = null;                   // the showing
    let touched = ctx.solved;          // the player has taken the tiller

    // ---- frame --------------------------------------------------------------
    const wrap = node('div', `display:grid;gap:10px;font-family:${SERIF};color:${p.bone}`);
    const style = node('style');
    style.textContent = `
      .ow11-act{font-family:${SERIF};font-size:15px;color:${p.bone};background:${p.oakDeep};
        border:1px solid ${p.gold};border-radius:3px;padding:11px 16px;min-height:44px;min-width:44px;cursor:pointer}
      .ow11-act:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow11-act[disabled]{opacity:.45;cursor:default}
      .ow11-leg{font-family:${SERIF};font-size:15px;text-align:left;color:${p.bone};
        background:linear-gradient(180deg,${rgba(p.oak, 0.85)},${rgba(p.oakDeep, 0.95)});
        border:1px solid ${p.oakLight};border-left:4px solid ${p.gold};
        border-radius:3px;padding:10px 14px;min-height:44px;cursor:pointer;width:100%}
      .ow11-leg:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
      .ow11-leg:hover{border-color:${p.gold}}
      .ow11-tide{display:inline-flex;align-items:center;gap:8px;font-size:14px;color:${p.bone};
        border:1px solid ${rgba(p.gold, 0.45)};border-radius:999px;padding:6px 14px;min-height:34px;
        background:${rgba(p.oakDeep, 0.7)}}
      .ow11-dot{width:11px;height:11px;border-radius:50%;display:inline-block;
        box-shadow:0 0 6px ${rgba(p.goldBright, 0.35)}}
      .ow11-knots{display:inline-flex;align-items:center;gap:9px;font-size:13.5px;color:${p.boneDim}}
      /* the chart table's apron: the controls sit ON linen-toothed board, not
         on a flat stretch of nothing (docs/QUALITY.md dead-zone law) */
      .ow11-apron{background:
          repeating-linear-gradient(180deg,transparent 0 2px,${rgba(p.bone, 0.11)} 2px 3px),
          repeating-linear-gradient(90deg,transparent 0 2px,${rgba(p.tar, 0.16)} 2px 3px),
          linear-gradient(180deg,${rgba(p.oak, 0.5)},${rgba(p.oakDeep, 0.66)});
        border:1px solid ${rgba(p.oakLight, 0.85)};border-radius:4px;padding:10px 12px;
        box-shadow:inset 0 1px 0 ${rgba(p.bone, 0.1)},inset 0 -2px 3px ${rgba(p.tar, 0.5)},0 2px 0 ${rgba(p.tar, 0.5)}}
      .ow11-skip{font-family:${SERIF};font-size:14px;color:${p.boneDim};background:transparent;
        border:1px solid ${rgba(p.oakLight, 0.9)};border-radius:3px;padding:11px 16px;min-height:44px;min-width:44px;cursor:pointer}
      .ow11-skip:focus-visible{outline:2px solid ${p.goldBright};outline-offset:2px}
    `;
    wrap.append(style);


    const chartHost = node('div', 'line-height:0;display:block');
    let chart = null;

    const meter = node('div', 'display:flex;gap:12px;flex-wrap:wrap;align-items:center');
    meter.className = 'ow11-apron';
    const tidePill = node('div');
    tidePill.className = 'ow11-tide';
    const tideDot = node('span');
    tideDot.className = 'ow11-dot';
    const tideText = node('span', null, '');
    tidePill.append(tideDot, tideText);
    const knotWrap = node('div');
    knotWrap.className = 'ow11-knots';
    const knotGfx = art.makeCanvas(132, 24);
    knotGfx.canvas.setAttribute('aria-hidden', 'true');
    knotGfx.canvas.style.cssText = 'display:block';
    const knotText = node('span', null, '');
    knotWrap.append(knotGfx.canvas, knotText);
    meter.append(tidePill, knotWrap);

    const movesLabel = node('p', `margin:0;font-size:13px;color:${p.boneDim};letter-spacing:.06em`, T('movesOpen'));
    const moves = node('div', 'display:grid;gap:7px');

    const actions = node('div', 'display:flex;gap:9px;flex-wrap:wrap;align-items:center');
    actions.className = 'ow11-apron';
    const backBtn = node('button', null, T('back'));
    const resetBtn = node('button', null, T('reset'));
    const sealBtn = node('button', null, T('seal'));
    for (const b of [backBtn, resetBtn, sealBtn]) { b.className = 'ow11-act'; b.type = 'button'; }
    const skipBtn = node('button', null, T('skip'));
    skipBtn.className = 'ow11-skip';
    skipBtn.type = 'button';
    skipBtn.style.display = 'none';
    actions.append(backBtn, resetBtn, sealBtn, skipBtn);

    const status = node('p', `margin:0;min-height:20px;font-size:14px;color:${p.boneDim};scroll-margin:28px`);
    // visual echo only — the shell's .near-line is the single aria-live deny announcer (LOOP5 ruling)

    const waters = node('div', 'display:grid;gap:9px');
    waters.className = 'ow11-apron';
    waters.append(movesLabel, moves);

    wrap.append(chartHost, meter, waters, actions, status);
    ctx.root.append(wrap);

    // ---- chart geometry -----------------------------------------------------
    let CH = { w: 720, h: 470, portrait: false, m: 26, padX: 70, padY: 60 };
    function layout() {
      const avail = Math.max(280, Math.min(960, Math.round(ctx.root.clientWidth || 720)));
      const portrait = avail < 560;
      const w = avail;
      const h = Math.round(portrait ? w * 1.46 : w * 0.66);
      const m = Math.round(Math.min(w, h) * 0.042);
      const padX = Math.round(m + w * (portrait ? 0.14 : 0.075));
      const padY = Math.round(m + h * (portrait ? 0.065 : 0.135));
      CH = { w, h, portrait, m, padX, padY };
    }
    const sx = (i) => {
      const n = inst.nodes[i];
      return CH.padX + (CH.portrait ? n.y : n.x) * (CH.w - CH.padX * 2);
    };
    const sy = (i) => {
      const n = inst.nodes[i];
      return CH.padY + (CH.portrait ? n.x : n.y) * (CH.h - CH.padY * 2);
    };
    const nodeR = (i) => {
      const base = Math.max(7, Math.min(13, CH.w * 0.0145));
      return inst.nodes[i].role === 'skerry' ? base : base * 1.45;
    };
    const nameSize = () => Math.max(10.5, Math.min(14, CH.w * 0.0165));

    function edgeGeom(e) {
      const ax = sx(e.a);
      const ay = sy(e.a);
      const bx = sx(e.b);
      const by = sy(e.b);
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const bow = (nz(e.a * 37 + e.b * 11, 3) - 0.5) * Math.min(22, len * 0.1);
      return { ax, ay, bx, by, cx: (ax + bx) / 2 - (dy / len) * bow, cy: (ay + by) / 2 + (dx / len) * bow, len };
    }
    const onEdge = (g, t) => {
      const u = 1 - t;
      return {
        x: u * u * g.ax + 2 * u * t * g.cx + t * t * g.bx,
        y: u * u * g.ay + 2 * u * t * g.cy + t * t * g.by,
      };
    };
    const edgeAngle = (g, t) => {
      const a = onEdge(g, Math.max(0, t - 0.03));
      const b = onEdge(g, Math.min(1, t + 0.03));
      return Math.atan2(b.y - a.y, b.x - a.x);
    };

    // ---- the sheet, its free water, and what furnishes it -------------------
    function deckle() {
      // an aged sheet: the edge wanders, so the vellum never reads as a CSS box
      const x0 = CH.m;
      const y0 = CH.m;
      const x1 = CH.w - CH.m;
      const y1 = CH.h - CH.m;
      const pts = [];
      const run = (fx, fy, n, k) => {
        for (let i = 0; i < n; i++) {
          const t = i / n;
          const w = (nz(k, i) - 0.5) * 5 + (nz(k + 9, i * 3) - 0.5) * 2.2;
          pts.push(fx(t, w));
        }
      };
      const steps = 34;
      run((t, w) => ({ x: x0 + (x1 - x0) * t, y: y0 + w }), 0, steps, 1);
      run((t, w) => ({ x: x1 + w, y: y0 + (y1 - y0) * t }), 0, steps, 2);
      run((t, w) => ({ x: x1 - (x1 - x0) * t, y: y1 + w }), 0, steps, 3);
      run((t, w) => ({ x: x0 + w, y: y1 - (y1 - y0) * t }), 0, steps, 4);
      return pts;
    }
    const sheetPath = (c, pts) => {
      c.beginPath();
      c.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
      c.closePath();
    };

    function obstacles() {
      const pts = [];
      for (const e of inst.edges) {
        const g = edgeGeom(e);
        for (let t = 0; t <= 1.0001; t += 0.1) { const q = onEdge(g, t); pts.push({ x: q.x, y: q.y, r: 8 }); }
      }
      for (let i = 0; i < inst.nodes.length; i++) {
        pts.push({ x: sx(i), y: sy(i), r: nodeR(i) + nameSize() * 1.6 });
      }
      return pts;
    }
    const clearAt = (obs, x, y) => {
      let d = Math.min(x - CH.m, y - CH.m, CH.w - CH.m - x, CH.h - CH.m - y);
      for (const q of obs) {
        const dd = Math.hypot(q.x - x, q.y - y) - q.r;
        if (dd < d) d = dd;
      }
      return d;
    };

    // Furniture goes wherever the water is genuinely empty, measured — so the
    // dead-zone law holds for every seed, not just the ones I looked at.
    // depth numbers belong on water. This is the same test the chart is drawn
    // with, so a sounding can never end up inked on a hillside.
    function inWater(S, x, y) {
      const along = CH.portrait ? y : x;
      const cross = CH.portrait ? x : y;
      const a0 = CH.m;
      const a1 = (CH.portrait ? CH.h : CH.w) - CH.m;
      const t = Math.max(0, Math.min(1, (along - a0) / (a1 - a0))) * (S.near.length - 1);
      const i = Math.min(S.near.length - 2, Math.floor(t));
      const f = t - i;
      const at = (line) => {
        const u = CH.portrait ? line[i].x : line[i].y;
        const v = CH.portrait ? line[i + 1].x : line[i + 1].y;
        return u + (v - u) * f;
      };
      return cross > at(S.near) + 3 && cross < at(S.far) - 3;
    }

    function furnish() {
      const obs = obstacles();
      const S = shores();
      const step = Math.max(12, Math.round(Math.min(CH.w, CH.h) / 34));
      const cells = [];
      for (let y = CH.m + step; y < CH.h - CH.m; y += step) {
        for (let x = CH.m + step; x < CH.w - CH.m; x += step) cells.push({ x, y, d: clearAt(obs, x, y) });
      }
      cells.sort((u, v) => v.d - u.d);
      const taken = [];
      const take = (want, minD) => {
        for (const c of cells) {
          if (c.d < minD) break;
          let ok = true;
          for (const t of taken) if (Math.hypot(t.x - c.x, t.y - c.y) < t.r + want) { ok = false; break; }
          if (!ok) continue;
          taken.push({ x: c.x, y: c.y, r: want });
          return { x: c.x, y: c.y, r: want };
        }
        return null;
      };

      const dialR = Math.max(28, Math.min(52, Math.min(CH.w, CH.h) * 0.082));
      // the dial belongs in a corner; take the corner with the freest water
      const inset = dialR + CH.m + 8;
      const corners = [
        { x: CH.w - inset, y: inset }, { x: inset, y: inset },
        { x: CH.w - inset, y: CH.h - inset }, { x: inset, y: CH.h - inset },
      ].map((q) => ({ ...q, d: clearAt(obs, q.x, q.y) }));
      corners.sort((u, v) => v.d - u.d);
      const dial = { x: corners[0].x, y: corners[0].y, r: dialR };
      taken.push({ x: dial.x, y: dial.y, r: dialR + 12 });

      const roseR = Math.max(24, Math.min(58, Math.min(CH.w, CH.h) * 0.09));
      const rose = take(roseR + 6, roseR * 0.72) || { x: CH.w * 0.5, y: CH.h * 0.5, r: roseR * 0.7 };
      rose.r = Math.min(roseR, Math.max(20, rose.r - 4));
      // both of these draw WIDER than a circle of their own radius, so the spot
      // they reserve is the one they actually cover
      const divR = roseR * 0.62;
      const dividers = take(divR * 2.1, roseR * 0.42);
      if (dividers) dividers.r = divR;
      const cartR = roseR * 0.6;
      const cartouche = take(Math.min(CH.w * 0.2, cartR * 2.2) + 10, roseR * 0.4);
      if (cartouche) cartouche.r = cartR;

      // soundings: the scribe's depth numbers, scattered over open water
      const soundings = [];
      for (const c of cells) {
        if (c.d < 13 || c.d > 74 || !inWater(S, c.x, c.y)) continue;
        let ok = true;
        for (const s of soundings) if (Math.hypot(s.x - c.x, s.y - c.y) < step * 2.1) { ok = false; break; }
        if (!ok) continue;
        for (const t of taken) if (Math.hypot(t.x - c.x, t.y - c.y) < t.r + 12) { ok = false; break; }
        if (!ok) continue;
        soundings.push({ x: c.x, y: c.y, v: 2 + Math.round(c.d / 5 + nz(Math.round(c.x), Math.round(c.y)) * 3) });
        if (soundings.length >= 34) break;
      }
      // shoals: stipple where the water shallows against the rocks
      const shoals = [];
      for (const c of cells) {
        if (c.d < 3 || c.d > 13 || !inWater(S, c.x, c.y)) continue;
        let ok = true;
        for (const s of shoals) if (Math.hypot(s.x - c.x, s.y - c.y) < step * 1.4) { ok = false; break; }
        if (ok) shoals.push({ x: c.x, y: c.y });
        if (shoals.length >= 30) break;
      }
      // deep pools: the fjord's own bottom, darkest where the water is widest
      const pools = cells.slice(0, 6).map((c) => ({ x: c.x, y: c.y, r: Math.max(30, c.d * 1.7) }));

      return { sheet: deckle(), shores: S, dial, rose, dividers, cartouche, soundings, shoals, pools, obs };
    }

    // The fjord has two shores. Everything between them is water; everything
    // outside is land, and the chart reads as a COAST rather than a blue box.
    function shores() {
      const cross = CH.portrait ? CH.w : CH.h;
      const along = CH.portrait ? CH.h : CH.w;
      const band = Math.max(15, ((CH.portrait ? CH.padX : CH.padY) - CH.m) * 0.55);
      const a0 = CH.m;
      const a1 = along - CH.m;
      const N = 28;
      const near = [];
      const far = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const a = a0 + (a1 - a0) * t;
        const u = CH.m + band + Math.sin(t * 7.3) * band * 0.3 + (nz(i, 91) - 0.5) * band * 0.55;
        const v = cross - CH.m - band - Math.sin(t * 5.7 + 1.1) * band * 0.3 - (nz(i, 92) - 0.5) * band * 0.55;
        near.push(CH.portrait ? { x: u, y: a } : { x: a, y: u });
        far.push(CH.portrait ? { x: v, y: a } : { x: a, y: v });
      }
      return { near, far, band };
    }
    const waterPath = (c, S) => {
      c.beginPath();
      c.moveTo(S.near[0].x, S.near[0].y);
      for (const q of S.near) c.lineTo(q.x, q.y);
      for (let i = S.far.length - 1; i >= 0; i--) c.lineTo(S.far[i].x, S.far[i].y);
      c.closePath();
    };
    const landPath = (c, line, outward) => {
      // the shore, closed back over the sheet's edge on the seaward-away side
      c.beginPath();
      c.moveTo(line[0].x, line[0].y);
      for (const q of line) c.lineTo(q.x, q.y);
      const last = line[line.length - 1];
      if (CH.portrait) {
        c.lineTo(outward < 0 ? -8 : CH.w + 8, last.y);
        c.lineTo(outward < 0 ? -8 : CH.w + 8, line[0].y);
      } else {
        c.lineTo(last.x, outward < 0 ? -8 : CH.h + 8);
        c.lineTo(line[0].x, outward < 0 ? -8 : CH.h + 8);
      }
      c.closePath();
    };

    // ---- baked layers -------------------------------------------------------
    // base  = table + sheet + water + contours + soundings (under the channels)
    // lanes = the channels, one bake per tide, so a turn is one blit
    // top   = skerries + names + rose + dividers + cartouche + vignette
    let baked = null;
    const teeth = {};

    // the vellum's own tooth, baked once per variant and blitted over the sheet
    function toothTile(size, k) {
      if (teeth[k]) return teeth[k];
      const off = art.makeCanvas(size, size);
      const c = off.ctx;
      for (let i = 0; i < 900; i++) {
        const dark = nz(i + k * 977, 71) > 0.48;
        c.fillStyle = rgba(dark ? p.oakDeep : p.bone, 0.09 + nz(i + k * 977, 72) * 0.13);
        c.fillRect(nz(i + k * 977, 73) * size, nz(i + k * 977, 74) * size, 1, 1);
      }
      teeth[k] = off.canvas;
      return off.canvas;
    }

    function bakeBase(F) {
      const off = art.makeCanvas(CH.w, CH.h);
      const c = off.ctx;
      art.paintWood(c, CH.w, CH.h, 1101);
      if (typeof art.wear === 'function') {
        art.wear(c, CH.w, CH.h, 11, { avoid: { x: CH.m - 2, y: CH.m - 2, w: CH.w - CH.m * 2 + 4, h: CH.h - CH.m * 2 + 4 } });
      }

      // the sheet lies on the table: contact shadow, then vellum
      c.save();
      c.translate(2.5, 4);
      sheetPath(c, F.sheet);
      c.fillStyle = rgba(p.tar, 0.55);
      c.fill();
      c.restore();

      c.save();
      sheetPath(c, F.sheet);
      c.clip();
      const field = c.createLinearGradient(0, CH.m, CH.w, CH.h);
      field.addColorStop(0, VELLUM_LIT);
      field.addColorStop(0.52, VELLUM);
      field.addColorStop(1, mixHex(VELLUM, p.oakDeep, 0.08));
      c.fillStyle = field;
      c.fillRect(0, 0, CH.w, CH.h);

      // layer 1 — the oil soak: broad warm blotches where the sheet drank
      for (let i = 0; i < 16; i++) {
        const x = nz(i, 1) * CH.w;
        const y = nz(i, 2) * CH.h;
        const r = 26 + nz(i, 3) * 90;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba(mixHex(VELLUM, p.ember, 0.18), 0.11 + nz(i, 4) * 0.07));
        g.addColorStop(1, rgba(p.ember, 0));
        c.fillStyle = g;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // layer 2 — the skin the sheet was: laid lines, follicle tooth, foxing.
      // The tooth is a baked tile blitted over the whole sheet at two offsets;
      // per-pixel speckle over a sheet this size would stall the board open.
      c.strokeStyle = rgba(p.oakDeep, 0.12);
      c.lineWidth = 1;
      for (let y = CH.m; y < CH.h - CH.m; y += 3) {
        c.beginPath();
        c.moveTo(CH.m, y + nz(y, 5) * 0.9);
        c.lineTo(CH.w - CH.m, y + nz(y, 6) * 0.9);
        c.stroke();
      }
      c.strokeStyle = rgba(p.bone, 0.085);
      c.lineWidth = 1;
      for (let y = CH.m + 1.4; y < CH.h - CH.m; y += 3) {
        c.beginPath();
        c.moveTo(CH.m, y + nz(y, 15) * 0.9);
        c.lineTo(CH.w - CH.m, y + nz(y, 16) * 0.9);
        c.stroke();
      }
      c.strokeStyle = rgba(p.oakDeep, 0.09);
      c.lineWidth = 1;
      for (let x = CH.m; x < CH.w - CH.m; x += 11) {
        c.beginPath();
        c.moveTo(x, CH.m);
        c.lineTo(x + (nz(x, 7) - 0.5) * 6, CH.h - CH.m);
        c.stroke();
      }
      for (let k = 0; k < 2; k++) {
        const tile = toothTile(48, k);
        for (let y = 0; y < CH.h; y += 48) {
          for (let x = 0; x < CH.w; x += 48) c.drawImage(tile, x - k * 24, y - k * 17, 48, 48);
        }
      }
      // foxing: the small dark blooms age leaves in a skin
      for (let i = 0; i < 40; i++) {
        const x = nz(i, 61) * CH.w;
        const y = nz(i, 62) * CH.h;
        const r = 2 + nz(i, 63) * 7;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba(mixHex(p.oakDeep, p.ember, 0.35), 0.26));
        g.addColorStop(1, rgba(p.oakDeep, 0));
        c.fillStyle = g;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      }

      // layer 3 — the water, tinted in fjord blue and deepening off the rocks.
      // Held inside the two shores so the sheet stays oiled vellum at its edges.
      c.save();
      waterPath(c, F.shores);
      c.clip();
      c.fillStyle = rgba(p.fjord, 0.34);
      c.fillRect(0, 0, CH.w, CH.h);
      for (const q of F.pools) {
        const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r);
        g.addColorStop(0, rgba(p.fjord, 0.34));
        g.addColorStop(0.62, rgba(p.fjord, 0.15));
        g.addColorStop(1, rgba(p.fjord, 0));
        c.fillStyle = g;
        c.fillRect(q.x - q.r, q.y - q.r, q.r * 2, q.r * 2);
      }
      for (let i = 0; i < inst.nodes.length; i++) {
        const x = sx(i);
        const y = sy(i);
        const r = nodeR(i) * 4.1;
        const g = c.createRadialGradient(x, y, nodeR(i), x, y, r);
        g.addColorStop(0, rgba(mixHex(p.fjordLight, p.bone, 0.62), 0.36));
        g.addColorStop(1, rgba(p.fjordLight, 0));
        c.fillStyle = g;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // the engraver's sea: fine wave hatching combed through the open water,
      // combed tighter where the water shallows against a rock
      c.lineWidth = 0.9;
      for (let i = 0; i < inst.nodes.length; i++) {
        const x = sx(i);
        const y = sy(i);
        const r0 = nodeR(i) * 1.45;
        for (let ring = 0; ring < 4; ring++) {
          const rr = r0 + ring * nodeR(i) * 0.52;
          const n = Math.max(10, Math.round(rr * 0.85));
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2 + nz(i * 5 + ring, k) * 0.2;
            const px = x + Math.cos(a) * rr;
            const py = y + Math.sin(a) * rr * 0.92;
            c.strokeStyle = rgba(p.fjord, 0.3 - ring * 0.055);
            c.beginPath();
            c.moveTo(px - 2.6, py);
            c.quadraticCurveTo(px, py - 1.5, px + 2.6, py);
            c.stroke();
          }
        }
      }
      for (const q of F.pools) {
        c.strokeStyle = rgba(p.fjord, 0.13);
        for (let yy = q.y - q.r; yy < q.y + q.r; yy += 5) {
          const half = Math.sqrt(Math.max(0, q.r * q.r - (yy - q.y) * (yy - q.y)));
          if (half < 6) continue;
          c.beginPath();
          c.moveTo(q.x - half, yy + nz(Math.round(yy), 81) * 1.2);
          c.lineTo(q.x + half, yy + nz(Math.round(yy), 82) * 1.2);
          c.stroke();
        }
      }

      // hand-inked depth contours: rings off every rock, plus long fathom lines
      c.lineWidth = 0.9;
      for (let i = 0; i < inst.nodes.length; i++) {
        const x = sx(i);
        const y = sy(i);
        for (let ring = 0; ring < 2; ring++) {
          const rr = nodeR(i) * (2.15 + ring * 1.35);
          c.strokeStyle = rgba(p.fjord, 0.5 - ring * 0.14);
          c.beginPath();
          for (let a = 0; a <= 40; a++) {
            const th = (a / 40) * Math.PI * 2;
            const w = rr * (1 + (nz(i * 17 + ring * 5, a) - 0.5) * 0.16);
            const px = x + Math.cos(th) * w;
            const py = y + Math.sin(th) * w * 0.9;
            if (a === 0) c.moveTo(px, py); else c.lineTo(px, py);
          }
          c.closePath();
          c.stroke();
        }
      }
      for (let k = 0; k < 7; k++) {
        c.strokeStyle = rgba(p.fjord, 0.3);
        c.lineWidth = 0.9;
        c.beginPath();
        for (let s = 0; s <= 40; s++) {
          const t = s / 40;
          const long = CH.m + t * (CH.w - CH.m * 2);
          const base = CH.m + ((k + 0.6) / 7.5) * (CH.h - CH.m * 2);
          const wob = Math.sin(t * 6.1 + k * 1.9) * 18 + (nz(k, s) - 0.5) * 9;
          if (s === 0) c.moveTo(long, base + wob); else c.lineTo(long, base + wob);
        }
        c.stroke();
      }
      c.restore();

      // layer 4 — the two shores: warm land, contour ticks, and the coastline
      // fringed the way an engraver fringes one, hatching into the water
      for (const [line, outward] of [[F.shores.near, -1], [F.shores.far, 1]]) {
        c.save();
        landPath(c, line, outward);
        c.clip();
        c.fillStyle = rgba(mixHex(VELLUM_LIT, p.ember, 0.1), 0.62);
        c.fillRect(0, 0, CH.w, CH.h);
        // land relief: quiet ridge ticks, held low against the water's ink
        for (let i = 0; i < 150; i++) {
          const x = nz(i, outward > 0 ? 101 : 102) * CH.w;
          const y = nz(i, outward > 0 ? 103 : 104) * CH.h;
          c.strokeStyle = rgba(INK, 0.16 + nz(i, 105) * 0.12);
          c.lineWidth = 0.9;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + 3 + nz(i, 106) * 4, y - 2.5 - nz(i, 107) * 3);
          c.stroke();
        }
        c.restore();
        // the coast itself
        c.save();
        c.strokeStyle = rgba(INK, 0.85);
        c.lineWidth = 1.6;
        c.lineJoin = 'round';
        c.beginPath();
        c.moveTo(line[0].x, line[0].y);
        for (const q of line) c.lineTo(q.x, q.y);
        c.stroke();
        for (let i = 1; i < line.length; i++) {
          const a = Math.atan2(line[i].y - line[i - 1].y, line[i].x - line[i - 1].x) + (Math.PI / 2) * -outward;
          for (let k = 0; k < 3; k++) {
            const t = k / 3;
            const px = line[i - 1].x + (line[i].x - line[i - 1].x) * t;
            const py = line[i - 1].y + (line[i].y - line[i - 1].y) * t;
            const len = 3 + nz(i * 3 + k, 108) * 4;
            c.strokeStyle = rgba(INK, 0.4);
            c.lineWidth = 0.8;
            c.beginPath();
            c.moveTo(px, py);
            c.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
            c.stroke();
          }
        }
        c.restore();
      }

      // soundings and shoal stipple — the scribe's own filling of dead water
      c.textAlign = 'center';
      c.font = `italic ${Math.max(8.5, nameSize() - 3)}px ${SERIF}`;
      for (const s of F.soundings) {
        c.fillStyle = rgba(INK, 0.62);
        c.fillText(String(s.v), s.x, s.y);
      }
      for (const s of F.shoals) {
        for (let i = 0; i < 11; i++) {
          c.fillStyle = rgba(INK, 0.4);
          c.beginPath();
          c.arc(s.x + (nz(i, Math.round(s.x)) - 0.5) * 15, s.y + (nz(i, Math.round(s.y)) - 0.5) * 15, 0.95, 0, Math.PI * 2);
          c.fill();
        }
      }

      // rhumb lines from the rose: a portolan's web, held under the puzzle
      if (F.rose) {
        c.save();
        c.strokeStyle = rgba(INK, 0.16);
        c.lineWidth = 0.8;
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          c.beginPath();
          c.moveTo(F.rose.x, F.rose.y);
          c.lineTo(F.rose.x + Math.cos(a) * CH.w * 1.6, F.rose.y + Math.sin(a) * CH.w * 1.6);
          c.stroke();
        }
        c.restore();
      }

      // aged edge: the sheet burns dark where it was handled
      const edge = c.createLinearGradient(0, 0, 0, CH.h);
      edge.addColorStop(0, rgba(VELLUM_EDGE, 0.5));
      edge.addColorStop(0.16, rgba(VELLUM_EDGE, 0));
      edge.addColorStop(0.84, rgba(VELLUM_EDGE, 0));
      edge.addColorStop(1, rgba(VELLUM_EDGE, 0.55));
      c.fillStyle = edge;
      c.fillRect(0, 0, CH.w, CH.h);
      const edge2 = c.createLinearGradient(0, 0, CH.w, 0);
      edge2.addColorStop(0, rgba(VELLUM_EDGE, 0.5));
      edge2.addColorStop(0.14, rgba(VELLUM_EDGE, 0));
      edge2.addColorStop(0.86, rgba(VELLUM_EDGE, 0));
      edge2.addColorStop(1, rgba(VELLUM_EDGE, 0.5));
      c.fillStyle = edge2;
      c.fillRect(0, 0, CH.w, CH.h);
      // two folds, and the light catching their ridges
      for (const fx of [0.34, 0.71]) {
        const x = CH.m + fx * (CH.w - CH.m * 2);
        c.strokeStyle = rgba(p.oakDeep, 0.16);
        c.lineWidth = 2.2;
        c.beginPath();
        c.moveTo(x, CH.m);
        c.lineTo(x + (nz(Math.round(fx * 100), 12) - 0.5) * 6, CH.h - CH.m);
        c.stroke();
        c.strokeStyle = rgba(p.bone, 0.12);
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x + 1.6, CH.m);
        c.lineTo(x + 1.6 + (nz(Math.round(fx * 100), 12) - 0.5) * 6, CH.h - CH.m);
        c.stroke();
      }
      c.restore();

      // the sheet's own edge and the pins that hold it to the table
      c.save();
      sheetPath(c, F.sheet);
      c.strokeStyle = rgba(p.oakDeep, 0.5);
      c.lineWidth = 1.4;
      c.stroke();
      c.restore();
      if (typeof art.ornament === 'function') {
        for (const q of [[CH.m + 7, CH.m + 7], [CH.w - CH.m - 7, CH.m + 7], [CH.m + 7, CH.h - CH.m - 7], [CH.w - CH.m - 7, CH.h - CH.m - 7]]) {
          art.ornament(c, 'nailhead', q[0], q[1], Math.max(6, CH.m * 0.42));
        }
      }
      return off.canvas;
    }

    // one tide's worth of channels
    function bakeLanes(par) {
      const off = art.makeCanvas(CH.w, CH.h);
      const c = off.ctx;
      for (const e of inst.edges) {
        const g = edgeGeom(e);
        const open = passable(e.kind, par);
        drawChannel(c, e, g, open, 1);
      }
      return off.canvas;
    }

    // a channel: the water it opens, its ink, and the tide it answers to
    function drawChannel(c, e, g, open, alpha) {
      const ink = KIND_INK[e.kind];
      c.save();
      c.globalAlpha = alpha * (open ? 1 : 0.3);
      const curve = (cc) => {
        cc.beginPath();
        cc.moveTo(g.ax, g.ay);
        cc.quadraticCurveTo(g.cx, g.cy, g.bx, g.by);
      };
      if (e.kind === 'portage') {
        // a neck of land: a dotted sledge track with its skids
        c.strokeStyle = rgba(mixHex(ROCK, p.oakDeep, 0.2), 0.5);
        c.lineWidth = 7;
        c.lineCap = 'round';
        curve(c);
        c.stroke();
        c.setLineDash([2.5, 5.5]);
        c.strokeStyle = rgba(ink, 0.95);
        c.lineWidth = 2;
        curve(c);
        c.stroke();
        c.setLineDash([]);
        const ties = Math.max(3, Math.round(g.len / 26));
        for (let i = 1; i < ties; i++) {
          const t = i / ties;
          const q = onEdge(g, t);
          const a = edgeAngle(g, t) + Math.PI / 2;
          c.strokeStyle = rgba(ink, 0.6);
          c.lineWidth = 1.4;
          c.beginPath();
          c.moveTo(q.x - Math.cos(a) * 4.5, q.y - Math.sin(a) * 4.5);
          c.lineTo(q.x + Math.cos(a) * 4.5, q.y + Math.sin(a) * 4.5);
          c.stroke();
        }
      } else {
        // open water: the sound itself, then the ink that names its tide
        if (open) {
          c.strokeStyle = rgba(mixHex(p.fjordLight, p.bone, 0.6), 0.3);
          c.lineWidth = 9;
          c.lineCap = 'round';
          curve(c);
          c.stroke();
          c.strokeStyle = rgba(mixHex(p.fjordLight, p.bone, 0.85), 0.26);
          c.lineWidth = 4;
          curve(c);
          c.stroke();
        }
        c.strokeStyle = rgba(ink, open ? 0.98 : 0.85);
        c.lineWidth = 2.6;
        c.lineCap = 'round';
        curve(c);
        c.stroke();
        c.strokeStyle = rgba(p.bone, open ? 0.16 : 0.06);
        c.lineWidth = 0.9;
        c.beginPath();
        c.moveTo(g.ax, g.ay - 1.2);
        c.quadraticCurveTo(g.cx, g.cy - 1.2, g.bx, g.by - 1.2);
        c.stroke();
      }

      // the tide glyphs: a bar with the water falling under it, or rising over
      const marks = Math.max(1, Math.min(4, Math.round(g.len / 62)));
      for (let i = 0; i < marks; i++) {
        const t = (i + 1) / (marks + 1);
        const q = onEdge(g, t);
        const a = edgeAngle(g, t) + Math.PI / 2;
        const ox = Math.cos(a) * 9;
        const oy = Math.sin(a) * 9;
        tideGlyph(c, e.kind, q.x + ox, q.y + oy, Math.max(5, Math.min(8, CH.w * 0.0095)), ink);
      }
      if (!open) {
        // shut on this tide: the sound is struck out where it crosses
        const q = onEdge(g, 0.5);
        c.strokeStyle = rgba(p.blood, 0.72);
        c.lineWidth = 2;
        c.lineCap = 'round';
        const s = 5.5;
        c.beginPath();
        c.moveTo(q.x - s, q.y - s);
        c.lineTo(q.x + s, q.y + s);
        c.moveTo(q.x + s, q.y - s);
        c.lineTo(q.x - s, q.y + s);
        c.stroke();
      }
      c.restore();
    }

    function tideGlyph(c, kind, x, y, s, ink) {
      c.save();
      c.strokeStyle = rgba(ink, 0.95);
      c.fillStyle = rgba(ink, 0.95);
      c.lineWidth = 1.3;
      c.lineCap = 'round';
      if (kind === 'ebb' || kind === 'flood') {
        const down = kind === 'ebb';
        // the sea-line
        c.beginPath();
        c.moveTo(x - s, y + (down ? -s * 0.55 : s * 0.55));
        c.lineTo(x + s, y + (down ? -s * 0.55 : s * 0.55));
        c.stroke();
        // and the water leaving it, or coming to it
        c.beginPath();
        if (down) {
          c.moveTo(x, y - s * 0.35);
          c.lineTo(x, y + s * 0.55);
          c.moveTo(x - s * 0.5, y + s * 0.05);
          c.lineTo(x, y + s * 0.6);
          c.lineTo(x + s * 0.5, y + s * 0.05);
        } else {
          c.moveTo(x, y + s * 0.35);
          c.lineTo(x, y - s * 0.55);
          c.moveTo(x - s * 0.5, y - s * 0.05);
          c.lineTo(x, y - s * 0.6);
          c.lineTo(x + s * 0.5, y - s * 0.05);
        }
        c.stroke();
      } else if (kind === 'always') {
        // no tide to answer to: a plain sounding cross
        c.beginPath();
        c.moveTo(x - s * 0.6, y);
        c.lineTo(x + s * 0.6, y);
        c.moveTo(x, y - s * 0.6);
        c.lineTo(x, y + s * 0.6);
        c.stroke();
        c.beginPath();
        c.arc(x, y, s * 0.22, 0, Math.PI * 2);
        c.fill();
      } else {
        // a sledge over the neck
        c.beginPath();
        c.moveTo(x - s * 0.7, y + s * 0.4);
        c.lineTo(x + s * 0.7, y + s * 0.4);
        c.moveTo(x - s * 0.45, y + s * 0.4);
        c.lineTo(x - s * 0.2, y - s * 0.4);
        c.lineTo(x + s * 0.6, y - s * 0.4);
        c.stroke();
      }
      c.restore();
    }

    function bakeTop(F) {
      const off = art.makeCanvas(CH.w, CH.h);
      const c = off.ctx;
      c.save();
      sheetPath(c, F.sheet);
      c.clip();

      if (F.rose) compassRose(c, F.rose.x, F.rose.y, F.rose.r);
      if (F.dividers) dividers(c, F.dividers.x, F.dividers.y, F.dividers.r);
      if (F.cartouche) cartouche(c, F.cartouche.x, F.cartouche.y, F.cartouche.r);

      for (let i = 0; i < inst.nodes.length; i++) skerry(c, i);
      placeNames(c);

      // the hearth reaches the table too — one light concept everywhere
      if (typeof art.hearth === 'function') art.hearth(c, CH.w, CH.h, { strength: 0.16, y: 0.24 });
      const vig = c.createRadialGradient(CH.w * 0.5, CH.h * 0.46, Math.min(CH.w, CH.h) * 0.2, CH.w * 0.5, CH.h * 0.5, Math.max(CH.w, CH.h) * 0.7);
      vig.addColorStop(0, rgba(p.tar, 0));
      vig.addColorStop(1, rgba(p.tar, 0.62));
      c.fillStyle = vig;
      c.fillRect(0, 0, CH.w, CH.h);
      c.restore();
      return off.canvas;
    }

    // an inked rock: irregular, hatched away from the light, named beside it
    function skerry(c, i) {
      const n = inst.nodes[i];
      const x = sx(i);
      const y = sy(i);
      const r = nodeR(i);
      const verts = [];
      const sides = 11;
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        const rr = r * (0.74 + nz(i * 13 + k, 21) * 0.62);
        verts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * 0.88 });
      }
      const path = (cc) => {
        cc.beginPath();
        cc.moveTo(verts[0].x, verts[0].y);
        for (let k = 1; k < verts.length; k++) cc.lineTo(verts[k].x, verts[k].y);
        cc.closePath();
      };
      c.save();
      // the rock's shadow on the water
      c.save();
      c.translate(1.6, 2.2);
      path(c);
      c.fillStyle = rgba(p.tar, 0.34);
      c.fill();
      c.restore();

      path(c);
      c.fillStyle = ROCK;
      c.fill();
      // hachures, laid away from the above-left key
      c.save();
      path(c);
      c.clip();
      c.strokeStyle = rgba(INK, 0.55);
      c.lineWidth = 0.9;
      for (let k = -14; k < 14; k++) {
        c.beginPath();
        c.moveTo(x - r * 1.6 + k * 2.6, y + r * 1.6);
        c.lineTo(x - r * 0.2 + k * 2.6, y - r * 1.6);
        c.stroke();
      }
      const lit = c.createLinearGradient(x - r, y - r, x + r, y + r);
      lit.addColorStop(0, rgba(p.bone, 0.3));
      lit.addColorStop(0.6, rgba(p.bone, 0));
      c.fillStyle = lit;
      c.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
      c.restore();

      path(c);
      c.strokeStyle = rgba(INK, 0.9);
      c.lineWidth = 1.5;
      c.stroke();

      if (n.role === 'fleet') {
        art.glow(c, x, y, r * 2.6, p.ember, 0.4);
        longship(c, x, y - r * 0.15, CH.portrait ? Math.PI / 2 : 0, r * 1.5, { hull: mixHex(p.oakLight, p.tar, 0.35), trim: p.ember, moored: true });
      } else if (n.role === 'hoard') {
        art.glow(c, x, y, r * 2.8, p.gold, 0.5);
        c.save();
        c.strokeStyle = rgba(p.gold, 0.95);
        c.lineWidth = 2.6;
        c.lineCap = 'round';
        const s = r * 0.78;
        c.beginPath();
        c.moveTo(x - s, y - s);
        c.lineTo(x + s, y + s);
        c.moveTo(x + s, y - s);
        c.lineTo(x - s, y + s);
        c.stroke();
        c.strokeStyle = rgba(p.goldBright, 0.5);
        c.lineWidth = 1;
        c.beginPath();
        c.arc(x, y, r * 1.5, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }
      c.restore();
    }

    // names in a scribe hand, laid where they do not foul another name
    function placeNames(c) {
      const size = nameSize();
      c.font = `italic ${size}px ${SERIF}`;
      const boxes = [];
      const order = inst.nodes.map((n, i) => i).sort((a, b) => {
        const ra = inst.nodes[a].role === 'skerry' ? 1 : 0;
        const rb = inst.nodes[b].role === 'skerry' ? 1 : 0;
        return ra - rb;
      });
      for (const i of order) {
        const n = inst.nodes[i];
        const x = sx(i);
        const y = sy(i);
        const r = nodeR(i);
        let wide = size * 0.5 * n.name.length;
        try { wide = Math.max(wide, c.measureText(n.name).width); } catch (e) { /* stub metrics */ }
        const half = wide / 2 + 3;
        const gap = r + size * 0.85;
        const spots = [
          { x, y: y + gap + size * 0.2, a: 'center' },
          { x, y: y - gap, a: 'center' },
          { x: x + r + 5 + half, y: y + size * 0.34, a: 'center' },
          { x: x - r - 5 - half, y: y + size * 0.34, a: 'center' },
          { x, y: y + gap + size * 1.25, a: 'center' },
          { x, y: y - gap - size * 1.05, a: 'center' },
        ];
        let put = spots[0];
        for (const s of spots) {
          const box = { x: s.x - half, y: s.y - size, w: half * 2, h: size * 1.35 };
          if (box.x < CH.m + 2 || box.x + box.w > CH.w - CH.m - 2 || box.y < CH.m || box.y + box.h > CH.h - CH.m) continue;
          let clash = false;
          for (const b of boxes) {
            if (box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y) { clash = true; break; }
          }
          if (!clash) { put = s; boxes.push(box); break; }
        }
        if (put === spots[0]) boxes.push({ x: put.x - half, y: put.y - size, w: half * 2, h: size * 1.35 });

        const key = n.role !== 'skerry';
        c.save();
        c.translate(put.x, put.y);
        c.rotate((nz(i, 31) - 0.5) * 0.055);
        c.textAlign = 'center';
        c.font = `italic ${key ? size * 1.12 : size}px ${SERIF}`;
        // ink bleed: a wet under-stroke, the pen stroke over it
        c.fillStyle = rgba(p.bone, 0.4);
        c.fillText(n.name, 0.7, 0.9);
        c.fillStyle = key ? mixHex(INK, p.blood, 0.42) : INK;
        c.fillText(n.name, 0, 0);
        if (key) {
          c.strokeStyle = rgba(mixHex(INK, p.blood, 0.42), 0.55);
          c.lineWidth = 0.9;
          c.beginPath();
          c.moveTo(-size * 1.6, size * 0.34);
          c.lineTo(size * 1.6, size * 0.34);
          c.stroke();
        }
        c.restore();
      }
    }

    function compassRose(c, x, y, r) {
      c.save();
      c.strokeStyle = rgba(INK, 0.5);
      c.lineWidth = 1.1;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.arc(x, y, r * 0.72, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = rgba(INK, 0.42);
      c.lineWidth = 0.9;
      for (let k = 0; k < 32; k++) {
        const a = (k / 32) * Math.PI * 2;
        const inn = k % 4 === 0 ? 0.78 : 0.9;
        c.beginPath();
        c.moveTo(x + Math.cos(a) * r * inn, y + Math.sin(a) * r * inn);
        c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        c.stroke();
      }
      const point = (a, len, fill) => {
        const tipX = x + Math.cos(a) * len;
        const tipY = y + Math.sin(a) * len;
        const lx = x + Math.cos(a + Math.PI / 2) * len * 0.14;
        const ly = y + Math.sin(a + Math.PI / 2) * len * 0.14;
        const rx = x + Math.cos(a - Math.PI / 2) * len * 0.14;
        const ry = y + Math.sin(a - Math.PI / 2) * len * 0.14;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(lx, ly);
        c.lineTo(tipX, tipY);
        c.closePath();
        c.fillStyle = rgba(INK, 0.72);
        c.fill();
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(rx, ry);
        c.lineTo(tipX, tipY);
        c.closePath();
        c.fillStyle = fill;
        c.fill();
      };
      for (let k = 0; k < 8; k++) point((k / 8) * Math.PI * 2 + Math.PI / 8, r * 0.5, rgba(p.bone, 0.3));
      for (let k = 0; k < 4; k++) point((k / 4) * Math.PI * 2, r * 0.94, rgba(p.bone, 0.42));
      point(-Math.PI / 2, r * 0.94, rgba(p.goldBright, 0.75));
      if (typeof art.drawRune === 'function') {
        const s = r * 0.34;
        art.drawRune(c, 'ᛏ', x - s / 2, y - r * 1.02 - s, s, { color: mixHex(p.gold, p.tar, 0.25), weight: Math.max(1.2, s / 8) });
      }
      c.fillStyle = rgba(INK, 0.85);
      c.beginPath();
      c.arc(x, y, r * 0.09, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    // a pair of brass dividers laid down across the open water
    function dividers(c, x, y, r) {
      const len = r * 1.9;
      const spread = 0.42;
      const ang = -0.6 + (nz(Math.round(x), Math.round(y)) - 0.5) * 1.6;
      c.save();
      c.translate(x, y);
      c.rotate(ang);
      c.save();
      c.translate(2.5, 3.5);
      c.strokeStyle = rgba(p.tar, 0.3);
      c.lineWidth = 4;
      c.lineCap = 'round';
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(Math.sin(spread * s) * len, Math.cos(spread) * len);
        c.stroke();
      }
      c.restore();
      for (const s of [-1, 1]) {
        const ex = Math.sin(spread * s) * len;
        const ey = Math.cos(spread) * len;
        const g = c.createLinearGradient(0, 0, ex, ey);
        g.addColorStop(0, rgba(p.goldBright, 0.9));
        g.addColorStop(0.5, rgba(p.gold, 0.85));
        g.addColorStop(1, rgba(mixHex(p.gold, p.tar, 0.55), 0.9));
        c.strokeStyle = g;
        c.lineWidth = 3.4;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(ex, ey);
        c.stroke();
        c.strokeStyle = rgba(p.tar, 0.8);
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(ex * 0.86, ey * 0.86);
        c.lineTo(ex, ey);
        c.stroke();
      }
      const hub = c.createRadialGradient(-1.4, -1.6, 0, 0, 0, r * 0.24);
      hub.addColorStop(0, rgba(p.goldBright, 1));
      hub.addColorStop(1, rgba(mixHex(p.gold, p.tar, 0.5), 1));
      c.fillStyle = hub;
      c.beginPath();
      c.arc(0, 0, r * 0.2, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = rgba(p.tar, 0.7);
      c.lineWidth = 1;
      c.stroke();
      c.restore();
    }

    // the chart's title block, with the scale of sea-miles beneath it
    function cartouche(c, x, y, r) {
      const w = Math.min(CH.w * 0.4, r * 4.4);
      const h = r * 1.7;
      // the block is wider than the spot it was granted: keep it on the sheet
      const cx = Math.max(CH.m + w / 2 + 5, Math.min(CH.w - CH.m - w / 2 - 5, x));
      const cy = Math.max(CH.m + h / 2 + 5, Math.min(CH.h - CH.m - h / 2 - 5, y));
      c.save();
      c.translate(cx, cy);
      c.rotate((nz(Math.round(x), 7) - 0.5) * 0.05);
      c.fillStyle = rgba(p.bone, 0.09);
      c.fillRect(-w / 2, -h / 2, w, h);
      c.strokeStyle = rgba(INK, 0.5);
      c.lineWidth = 1.2;
      c.strokeRect(-w / 2, -h / 2, w, h);
      c.strokeStyle = rgba(INK, 0.3);
      c.lineWidth = 0.8;
      c.strokeRect(-w / 2 + 3.5, -h / 2 + 3.5, w - 7, h - 7);
      c.textAlign = 'center';
      const fs = Math.max(9, Math.min(13, w * 0.075));
      c.font = `${fs}px ${SERIF}`;
      c.fillStyle = rgba(INK, 0.85);
      c.fillText(`${nameOf(inst.start)} · ${nameOf(inst.goal)}`, 0, -h * 0.1);
      // the scale bar: alternating fathoms, ticked
      const bw = w * 0.62;
      const by = h * 0.24;
      for (let k = 0; k < 6; k++) {
        c.fillStyle = rgba(INK, k % 2 ? 0.72 : 0.16);
        c.fillRect(-bw / 2 + (bw / 6) * k, by, bw / 6, 4);
      }
      c.strokeStyle = rgba(INK, 0.6);
      c.lineWidth = 0.9;
      c.strokeRect(-bw / 2, by, bw, 4);
      c.restore();
    }

    // ---- the tarred cord, its knots, and the ship at its head ---------------
    function routePoints(r) {
      const pts = [];
      for (let i = 0; i + 1 < r.length; i++) {
        const e = findEdge(inst, r[i], r[i + 1]);
        if (!e) break;
        const g = e.a === r[i] ? edgeGeom(e) : (() => { const q = edgeGeom(e); return { ax: q.bx, ay: q.by, cx: q.cx, cy: q.cy, bx: q.ax, by: q.ay, len: q.len }; })();
        const from = i === 0 ? 0 : 1;
        for (let s = from; s <= 12; s++) pts.push(onEdge(g, s / 12));
      }
      if (!pts.length && r.length) pts.push({ x: sx(r[0]), y: sy(r[0]) });
      return pts;
    }

    function drawCord(c, pts, opts) {
      if (pts.length < 2) return;
      const width = (opts && opts.width) || Math.max(4.4, CH.w * 0.0068);
      const alpha = (opts && opts.alpha) != null ? opts.alpha : 1;
      // tarred HEMP, not tar: the cord has to read against dark water
      const tone = (opts && opts.tone) || mixHex(p.tar, p.oakLight, 0.5);
      const line = (cc) => {
        cc.beginPath();
        cc.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) cc.lineTo(pts[i].x, pts[i].y);
      };
      c.save();
      c.globalAlpha = alpha;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.strokeStyle = rgba(p.tar, 0.75);
      c.lineWidth = width + 4.6;
      c.save();
      c.translate(1.2, 2);
      line(c);
      c.stroke();
      c.restore();
      c.strokeStyle = rgba(p.tar, 0.85);
      c.lineWidth = width + 2;
      line(c);
      c.stroke();
      c.strokeStyle = rgba(tone, 0.98);
      c.lineWidth = width;
      line(c);
      c.stroke();
      // two strands laid up: the cord is spun, not drawn
      for (const off of [-1, 1]) {
        c.strokeStyle = rgba(off < 0 ? mixHex(tone, p.goldBright, 0.62) : mixHex(tone, p.tar, 0.45), 0.8);
        c.lineWidth = width * 0.34;
        c.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const a = i * 0.9;
          const px = pts[i].x + Math.cos(a) * width * 0.26 * off;
          const py = pts[i].y + Math.sin(a) * width * 0.26 * off;
          if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
        }
        c.stroke();
      }
      c.restore();
    }

    // an overhand knot: one leg rowed, tied where it was rowed
    function tieKnot(c, x, y, r, alpha) {
      c.save();
      c.globalAlpha = alpha == null ? 1 : alpha;
      c.translate(x, y);
      // seated in its own shadow so a knot reads as tied, not printed
      c.strokeStyle = rgba(p.tar, 0.85);
      c.lineWidth = r * 0.78;
      c.lineCap = 'round';
      for (const loop of [-1, 1]) {
        c.beginPath();
        c.arc(loop * r * 0.3, 0, r * 0.66, loop < 0 ? -0.7 : Math.PI * 0.5, loop < 0 ? Math.PI * 1.5 : Math.PI * 2.35);
        c.stroke();
      }
      c.strokeStyle = rgba(mixHex(p.tar, p.oakLight, 0.55), 0.98);
      c.lineWidth = r * 0.46;
      for (const loop of [-1, 1]) {
        c.beginPath();
        c.arc(loop * r * 0.3, 0, r * 0.66, loop < 0 ? -0.7 : Math.PI * 0.5, loop < 0 ? Math.PI * 1.5 : Math.PI * 2.35);
        c.stroke();
      }
      c.strokeStyle = rgba(p.goldBright, 0.5);
      c.lineWidth = r * 0.17;
      c.beginPath();
      c.arc(-r * 0.3, -r * 0.12, r * 0.66, -0.95, 0.25);
      c.stroke();
      c.restore();
    }

    function longship(c, x, y, ang, size, opts) {
      const hull = (opts && opts.hull) || p.tar;
      const trim = (opts && opts.trim) || p.gold;
      c.save();
      c.translate(x, y);
      c.rotate(ang);
      c.save();
      c.translate(1.4, 2.4);
      c.fillStyle = rgba(p.tar, 0.35);
      c.beginPath();
      c.moveTo(-size, 0);
      c.quadraticCurveTo(0, size * 0.75, size, 0);
      c.quadraticCurveTo(0, size * 0.24, -size, 0);
      c.fill();
      c.restore();
      // hull
      c.beginPath();
      c.moveTo(-size, 0);
      c.quadraticCurveTo(0, size * 0.72, size, 0);
      c.quadraticCurveTo(0, size * 0.2, -size, 0);
      c.fillStyle = hull;
      c.fill();
      c.strokeStyle = rgba(p.tar, 0.9);
      c.lineWidth = Math.max(0.8, size * 0.1);
      c.stroke();
      // stem and stern posts, curling
      c.strokeStyle = rgba(trim, 0.95);
      c.lineWidth = Math.max(1, size * 0.14);
      c.lineCap = 'round';
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(size * s, 0);
        c.quadraticCurveTo(size * 1.28 * s, -size * 0.42, size * 0.86 * s, -size * 0.72);
        c.stroke();
      }
      // shield row
      for (let k = -2; k <= 2; k++) {
        c.fillStyle = rgba(k % 2 ? p.bone : trim, 0.8);
        c.beginPath();
        c.arc(k * size * 0.3, size * 0.12, size * 0.13, 0, Math.PI * 2);
        c.fill();
      }
      if (!(opts && opts.moored)) {
        // mast and sail, drawing
        c.strokeStyle = rgba(p.tar, 0.9);
        c.lineWidth = Math.max(0.9, size * 0.11);
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(0, -size * 1.15);
        c.stroke();
        c.beginPath();
        c.moveTo(0, -size * 1.05);
        c.quadraticCurveTo(size * 0.72, -size * 0.62, 0, -size * 0.2);
        c.closePath();
        c.fillStyle = rgba(p.bone, 0.78);
        c.fill();
        c.strokeStyle = rgba(p.blood, 0.55);
        c.lineWidth = Math.max(0.7, size * 0.08);
        c.beginPath();
        c.moveTo(0, -size * 0.82);
        c.lineTo(size * 0.4, -size * 0.66);
        c.stroke();
      } else {
        c.strokeStyle = rgba(p.tar, 0.85);
        c.lineWidth = Math.max(0.8, size * 0.1);
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(0, -size * 0.7);
        c.stroke();
      }
      c.restore();
    }

    // ---- the moon-dial: the tide, and the only thing that teaches it --------
    function drawDial(c, D, phase, legNo) {
      const r = D.r;
      c.save();
      c.translate(D.x, D.y);
      // set into the vellum
      c.fillStyle = rgba(p.tar, 0.4);
      c.beginPath();
      c.arc(1.5, 2.5, r, 0, Math.PI * 2);
      c.fill();
      const face = c.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r);
      face.addColorStop(0, mixHex(p.fjord, p.tar, 0.42));
      face.addColorStop(1, mixHex(p.tar, p.fjord, 0.2));
      c.fillStyle = face;
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.fill();
      // stars in the dial's night
      for (let i = 0; i < 14; i++) {
        const a = nz(i, 41) * Math.PI * 2;
        const rr = r * (0.2 + nz(i, 42) * 0.62);
        c.fillStyle = rgba(p.bone, 0.16 + nz(i, 43) * 0.3);
        c.beginPath();
        c.arc(Math.cos(a) * rr, Math.sin(a) * rr - r * 0.12, 0.9, 0, Math.PI * 2);
        c.fill();
      }
      // brass ring with its ticks
      const ring = c.createLinearGradient(-r, -r, r, r);
      ring.addColorStop(0, p.goldBright);
      ring.addColorStop(0.45, p.gold);
      ring.addColorStop(1, mixHex(p.gold, p.tar, 0.6));
      c.strokeStyle = ring;
      c.lineWidth = Math.max(2.4, r * 0.1);
      c.beginPath();
      c.arc(0, 0, r - r * 0.05, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = rgba(p.goldBright, 0.5);
      c.lineWidth = 1;
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const inn = k % 6 === 0 ? 0.74 : 0.84;
        c.beginPath();
        c.moveTo(Math.cos(a) * r * inn, Math.sin(a) * r * inn);
        c.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92);
        c.stroke();
      }
      // the sea-line across the dial, and the two stations it runs between
      c.strokeStyle = rgba(p.fjordLight, 0.6);
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(-r * 0.82, r * 0.22);
      c.lineTo(r * 0.82, r * 0.22);
      c.stroke();
      c.font = `${Math.max(7, r * 0.2)}px ${SERIF}`;
      c.textAlign = 'center';
      c.fillStyle = rgba(p.bone, phase < 0.5 ? 0.95 : 0.42);
      c.fillText(T('ebbMark'), -r * 0.45, r * 0.56);
      c.fillStyle = rgba(p.bone, phase >= 0.5 ? 0.95 : 0.42);
      c.fillText(T('floodMark'), r * 0.45, r * 0.56);

      // the moon rides from the ebb station over the top to the flood station
      const a = Math.PI * (1 - phase);
      const mx = Math.cos(a) * r * 0.58;
      const my = r * 0.22 - Math.sin(a) * r * 0.56;
      const mr = Math.max(4.5, r * 0.19);
      // the hand that follows it
      c.strokeStyle = rgba(p.goldBright, 0.85);
      c.lineWidth = Math.max(1.4, r * 0.055);
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(0, r * 0.22);
      c.lineTo(mx, my);
      c.stroke();
      art.glow(c, mx, my, mr * 2.6, p.goldBright, 0.34);
      c.fillStyle = mixHex(p.bone, p.goldBright, 0.3);
      c.beginPath();
      c.arc(mx, my, mr, 0, Math.PI * 2);
      c.fill();
      // the terminator flips as the moon crosses: waning on the ebb, waxing on the flood
      c.save();
      c.beginPath();
      c.arc(mx, my, mr, 0, Math.PI * 2);
      c.clip();
      c.fillStyle = rgba(mixHex(p.fjord, p.tar, 0.5), 0.88);
      c.beginPath();
      c.arc(mx + (phase < 0.5 ? -1 : 1) * mr * (0.62 - Math.abs(phase - 0.5) * 0.5), my, mr * 0.96, 0, Math.PI * 2);
      c.fill();
      c.restore();
      c.fillStyle = rgba(p.oakDeep, 0.3);
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.arc(mx + (nz(i, 51) - 0.5) * mr, my + (nz(i, 52) - 0.5) * mr, mr * 0.16, 0, Math.PI * 2);
        c.fill();
      }
      c.strokeStyle = rgba(p.tar, 0.7);
      c.lineWidth = 1;
      c.beginPath();
      c.arc(mx, my, mr, 0, Math.PI * 2);
      c.stroke();

      // the leg the dial stands for, struck under the glass
      c.fillStyle = rgba(p.goldBright, 0.85);
      c.font = `${Math.max(8, r * 0.26)}px ui-monospace,'SF Mono',Menlo,monospace`;
      c.textAlign = 'center';
      c.fillText(String(legNo), 0, -r * 0.34);
      c.restore();
    }

    // ---- painting -----------------------------------------------------------
    function bake() {
      const key = `${CH.w}x${CH.h}`;
      if (baked && baked.key === key) return baked;
      const F = furnish();
      baked = { key, F, base: bakeBase(F), top: bakeTop(F), lanes: [bakeLanes(0), bakeLanes(1)] };
      return baked;
    }

    function paint() {
      if (!chart) return;
      const c = chart.ctx;
      const B = bake();
      c.clearRect(0, 0, CH.w, CH.h);
      c.drawImage(B.base, 0, 0, CH.w, CH.h);
      c.drawImage(B.lanes[dispPhase < 0.5 ? 0 : 1], 0, 0, CH.w, CH.h);

      // the sounds that shut on this turn get one blood-bright beat
      if (closeFlash) {
        const k = 1 - closeFlash.t;
        c.save();
        c.globalAlpha = Math.max(0, k) * 0.85;
        for (const e of closeFlash.edges) {
          const g = edgeGeom(e);
          const q = onEdge(g, 0.5);
          art.glow(c, q.x, q.y, 15 + (1 - k) * 10, p.blood, 0.55);
        }
        c.restore();
      }

      c.drawImage(B.top, 0, 0, CH.w, CH.h);

      // the road so far: a tarred cord, one knot for every leg rowed
      if (route.length > 1) {
        const pts = routePoints(route);
        drawCord(c, pts, {});
        const kr = Math.max(4.6, CH.w * 0.0105);
        for (let i = 0; i + 1 < route.length; i++) {
          const e = findEdge(inst, route[i], route[i + 1]);
          if (!e) break;
          // a knot for every leg: a portage is two, so it ties one at the neck
          if (e.kind === 'portage') {
            const q = onEdge(edgeGeom(e), 0.5);
            tieKnot(c, q.x, q.y, kr, 1);
          }
          tieKnot(c, sx(route[i + 1]), sy(route[i + 1]), kr, 1);
        }
      }

      // the head of the road: the fleet, and where it stands
      const h = head();
      const hx0 = sx(h);
      const hy0 = sy(h);
      art.glow(c, hx0, hy0, nodeR(h) * 2.4, p.goldBright, 0.5);
      let ang = CH.portrait ? Math.PI / 2 : 0;
      if (route.length > 1) {
        const prev = route[route.length - 2];
        ang = Math.atan2(hy0 - sy(prev), hx0 - sx(prev));
      }
      if (route.length > 1 || ctx.solved) longship(c, hx0, hy0 - nodeR(h) * 0.5, ang, Math.max(8, CH.w * 0.0145), { hull: mixHex(p.oakLight, p.tar, 0.3), trim: p.goldBright });

      // the showing: a ghost hand sails one leg, and the tide answers
      if (demo) paintDemo(c);

      const legNo = legsOf(route) + 1;
      drawDial(c, B.F.dial, dispPhase, ctx.solved ? legsOf(route) : legNo);
    }

    function paintDemo(c) {
      const g = demo.geom;
      const t = Math.max(0, Math.min(1, (demo.ms - 250) / 1050));
      const pts = [];
      for (let s = 0; s <= 12; s++) pts.push(onEdge(g, (s / 12) * t));
      c.save();
      c.globalAlpha = demo.fade;
      if (t > 0.02) drawCord(c, pts, { tone: mixHex(p.tar, p.goldBright, 0.35), alpha: 0.75 });
      const q = onEdge(g, t);
      if (t >= 1) tieKnot(c, q.x, q.y, Math.max(3.4, CH.w * 0.0075), 0.9);
      const size = Math.max(8, CH.w * 0.0145);
      longship(c, q.x, q.y - size * 0.4, edgeAngle(g, Math.max(0.02, t)), size, { hull: rgba(p.goldBright, 0.7), trim: p.goldBright });
      // the hand that holds it: a ghost of gold, palm and thumb and three
      // fingers closed on the ship — unmistakable at a glance, gone in three
      // seconds
      const hx0 = q.x + size * 0.55;
      const hy0 = q.y - size * 2.3;
      art.glow(c, hx0, hy0, size * 3.2, p.goldBright, 0.55);
      c.globalAlpha = demo.fade * 0.8;
      c.fillStyle = rgba(p.goldBright, 0.6);
      c.strokeStyle = rgba(mixHex(p.gold, p.tar, 0.35), 0.75);
      c.lineWidth = Math.max(1, size * 0.12);
      const blob = (bx, by, rx, ry, rot) => {
        c.beginPath();
        c.ellipse(bx, by, rx, ry, rot, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      };
      blob(hx0, hy0 - size * 0.1, size * 0.86, size * 1.12, 0.28);
      blob(hx0 - size * 0.86, hy0 + size * 0.16, size * 0.34, size * 0.66, -0.55);
      for (let k = 0; k < 3; k++) {
        blob(hx0 - size * (0.42 - k * 0.42), hy0 - size * (1.02 - k * 0.1), size * 0.24, size * 0.5, 0.2 + k * 0.12);
      }
      // the wrist trailing off into the hearth-light
      const cuff = c.createLinearGradient(hx0, hy0 - size * 0.4, hx0 + size * 1.6, hy0 - size * 2.1);
      cuff.addColorStop(0, rgba(p.goldBright, 0.5));
      cuff.addColorStop(1, rgba(p.goldBright, 0));
      c.fillStyle = cuff;
      c.beginPath();
      c.ellipse(hx0 + size * 0.8, hy0 - size * 1.1, size * 0.62, size * 1.25, -0.7, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    // ---- animation ----------------------------------------------------------
    function tick() {
      frameId = 0;
      const t = clock();
      let more = false;
      if (tideAnim) {
        const k = Math.min(1, (t - tideAnim.t0) / 420);
        const e = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2;
        dispPhase = tideAnim.from + (tideAnim.to - tideAnim.from) * e;
        if (k >= 1) { dispPhase = tideAnim.to; tideAnim = null; } else more = true;
      }
      if (closeFlash) {
        closeFlash.t = Math.min(1, (t - closeFlash.t0) / 620);
        if (closeFlash.t >= 1) closeFlash = null; else more = true;
      }
      if (demo) {
        demo.ms = t - demo.t0;
        demo.fade = demo.ms < 260 ? demo.ms / 260 : demo.ms > 2740 ? Math.max(0, (3000 - demo.ms) / 260) : 1;
        if (demo.ms > 1600 && !demo.turned) {
          demo.turned = true;
          turnTide(1 - demo.par, demo.par);
          sfx('flip');
        }
        if (demo.ms >= 3000) { endShowing(false); } else more = true;
      }
      paint();
      if (more && RAF && !frameId) frameId = RAF(tick);
    }
    const kick = () => { if (RAF && !frameId) frameId = RAF(tick); };

    function turnTide(to, from) {
      const shut = [];
      for (const e of inst.edges) if (passable(e.kind, from) && !passable(e.kind, to)) shut.push(e);
      if (calm || !RAF) {
        dispPhase = to;
        return;
      }
      tideAnim = { from: dispPhase, to, t0: clock() };
      if (shut.length) closeFlash = { t0: clock() + 180, t: 0, edges: shut };
      kick();
    }

    // ---- the showing --------------------------------------------------------
    function pickShowing() {
      const first = self.solve(inst).route;
      const avoid = first.length > 1 ? first[1] : -1;
      const open = [];
      for (const e of inst.edges) {
        const to = e.a === inst.start ? e.b : e.b === inst.start ? e.a : -1;
        if (to < 0 || !passable(e.kind, 0) || e.kind === 'portage') continue;
        open.push({ e, to });
      }
      if (!open.length) return null;
      const pick = open.find((o) => o.to !== avoid) || open[0];
      const g = edgeGeom(pick.e);
      return pick.e.a === inst.start
        ? { geom: g, kind: pick.e.kind }
        : { geom: { ax: g.bx, ay: g.by, cx: g.cx, cy: g.cy, bx: g.ax, by: g.ay, len: g.len }, kind: pick.e.kind };
    }

    function showTheWay() {
      if (ctx.solved || touched) return;
      const pick = pickShowing();
      if (!pick) return;
      demo = { geom: pick.geom, kind: pick.kind, ms: 0, t0: clock(), fade: 1, par: 0, turned: false };
      skipBtn.style.display = '';
      status.textContent = T('demoSay');
      if (calm || !RAF) {
        // the same lesson held still: the leg sailed, the moon turned, the
        // sounds cut for the ebb struck out
        demo.ms = 1800;
        demo.turned = true;
        dispPhase = 1;
        paint();
        later(() => endShowing(false), 3000);
        return;
      }
      kick();
    }

    function endShowing(quiet) {
      if (!demo) return;
      demo = null;
      skipBtn.style.display = 'none';
      tideAnim = null;
      closeFlash = null;
      dispPhase = parity();
      if (!quiet) status.textContent = '';
      paint();
    }

    function takeTheTiller() {
      touched = true;
      endShowing(true);
    }

    // ---- text mirror + render ----------------------------------------------
    function routeWords() {
      if (route.length < 2) return T('noLeg', { name: nameOf(inst.start) });
      const parts = [];
      let legs = 0;
      for (let i = 0; i + 1 < route.length; i++) {
        const e = findEdge(inst, route[i], route[i + 1]);
        parts.push(e.kind === 'portage'
          ? T('hauledTo', { name: nameOf(route[i + 1]) })
          : T('rowedTo', { name: nameOf(route[i + 1]), tide: tideWord(legs % 2) }));
        legs += legCost(e.kind);
      }
      return T('fromRun', { start: nameOf(inst.start), parts: parts.join(', '), n: legs });
    }

    function paintKnotTally(legs) {
      const c = knotGfx.ctx;
      const W = knotGfx.w;
      const H = knotGfx.h;
      c.clearRect(0, 0, W, H);
      c.save();
      c.strokeStyle = rgba(p.tar, 0.85);
      c.lineWidth = 3;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(4, H / 2);
      c.lineTo(W - 4, H / 2);
      c.stroke();
      c.strokeStyle = rgba(p.oakLight, 0.5);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(4, H / 2 - 1.2);
      c.lineTo(W - 4, H / 2 - 1.2);
      c.stroke();
      const show = Math.min(legs, 14);
      for (let i = 0; i < show; i++) {
        tieKnot(c, 9 + i * ((W - 18) / 13), H / 2, 4.6, 1);
      }
      if (legs > show) {
        c.fillStyle = rgba(p.boneDim, 0.9);
        c.font = `11px ui-monospace,'SF Mono',Menlo,monospace`;
        c.textAlign = 'right';
        c.fillText(`+${legs - show}`, W - 2, H / 2 + 4);
      }
      c.restore();
    }

    function render(announce) {
      if (!tideAnim && !demo) dispPhase = parity();
      paint();
      const legs = legsOf(route);
      const par = parity();
      tideDot.style.background = par === 0 ? p.fjordLight : p.pineLight;
      tideText.textContent = T('legRuns', { n: legs + 1, tide: tideWord(par) });
      paintKnotTally(legs);
      knotText.textContent = legs === 0 ? T('knots0') : legs === 1 ? T('knots1') : T('knotsN', { n: legs });
      chart.canvas.setAttribute('aria-label', routeWords());

      moves.textContent = '';
      if (ctx.solved) {
        movesLabel.textContent = T('movesSailed');
      } else {
        const list = nextMoves();
        movesLabel.textContent = list.length ? T('movesOpen') : T('movesShut');
        for (const m of list) {
          const verb = m.kind === 'portage' ? T('haulTo') : T('rowTo');
          const b = node('button', null, `${verb} ${nameOf(m.to)} — ${T(KIND_WORD[m.kind])}`);
          b.className = 'ow11-leg';
          b.type = 'button';
          on(b, 'click', () => step(m.to));
          moves.append(b);
        }
      }
      if (announce != null) status.textContent = announce;
    }

    function step(to) {
      if (ctx.solved) return;
      const from = head();
      const e = findEdge(inst, from, to);
      if (!e || !passable(e.kind, parity())) { sfx('deny'); return; }
      takeTheTiller();
      const legNo = legsOf(route) + 1;
      const before = parity();
      route.push(to);
      const after = parity();
      sfx(e.kind === 'portage' ? 'slide' : 'tick');
      say(T('legNote', {
        n: legNo,
        what: e.kind === 'portage' ? T('hauledTo', { name: nameOf(to) }) : T('rowedTo', { name: nameOf(to), tide: tideWord((legNo - 1) % 2) }),
      }));
      if (after !== before) turnTide(after, before);
      render(to === inst.goal ? T('atHoard', { name: nameOf(to) }) : '');
    }

    // ---- layout + input -----------------------------------------------------
    function relayout() {
      layout();
      const fresh = art.makeCanvas(CH.w, CH.h);
      fresh.canvas.style.cssText = 'width:100%;height:auto;display:block;border-radius:4px;touch-action:manipulation;cursor:pointer';
      fresh.canvas.setAttribute('role', 'img');
      if (chart && chart.canvas && chart.canvas.remove) chart.canvas.remove();
      chartHost.append(fresh.canvas);
      chart = fresh;
      on(fresh.canvas, 'click', hit);
      baked = null;
      render(null);
    }

    const hit = (ev) => {
      if (ctx.solved || !chart) return;
      const box = chart.canvas.getBoundingClientRect();
      if (!box.width) return;
      const scale = CH.w / box.width;
      const x = (ev.clientX - box.left) * scale;
      const y = (ev.clientY - box.top) * scale;
      let best = -1;
      let bestD = Math.max(24, CH.w * 0.036);
      for (let i = 0; i < inst.nodes.length; i++) {
        const d = Math.hypot(sx(i) - x, sy(i) - y);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best >= 0) step(best);
    };

    let resizeRaf = 0;
    const onResize = () => {
      if (resizeRaf) return;
      const r = RAF || ((fn) => setTimeout(fn, 32));
      resizeRaf = r(() => { resizeRaf = 0; relayout(); });
    };

    relayout();
    if (typeof window !== 'undefined' && window && window.addEventListener) on(window, 'resize', onResize);

    on(backBtn, 'click', () => {
      if (ctx.solved || route.length < 2) { sfx('deny'); return; }
      takeTheTiller();
      const before = parity();
      const gone = route.pop();
      const after = parity();
      sfx('knock');
      say(T('backNote', { name: nameOf(gone) }));
      if (after !== before) turnTide(after, before);
      render('');
    });
    on(resetBtn, 'click', () => {
      if (ctx.solved) return;
      takeTheTiller();
      const before = parity();
      route = [inst.start];
      sfx('knock');
      say(T('resetNote'));
      if (parity() !== before) turnTide(parity(), before);
      render(T('resetSay'));
    });
    on(sealBtn, 'click', () => {
      if (ctx.solved) return;
      takeTheTiller();
      const answer = { route: route.slice() };
      say(routeWords());
      const res = ctx.submit(answer) || {};
      if (!res.ok) {
        status.textContent = localNear(res.near) || T('denyLine');
        if (status.scrollIntoView) status.scrollIntoView({ block: 'nearest' });
      }
    });
    on(skipBtn, 'click', () => {
      if (!demo) return;
      endShowing(false);
    });

    if (ctx.solved) {
      backBtn.disabled = true;
      resetBtn.disabled = true;
      sealBtn.disabled = true;
    }

    say(T('openNote', { n: inst.nodes.length, fleet: nameOf(inst.start), hoard: nameOf(inst.goal) }));
    say(T('legend'));
    render(ctx.solved ? T('solvedLine') : '');
    if (!ctx.solved) later(showTheWay, 0);

    return {
      unmount() {
        for (const f of cleanup) f();
        cleanup.length = 0;
        for (const t of timers) clearTimeout(t);
        timers.length = 0;
        if (frameId && CAF) CAF(frameId);
        frameId = 0;
        if (resizeRaf && CAF) CAF(resizeRaf);
        resizeRaf = 0;
        demo = null;
        tideAnim = null;
        closeFlash = null;
        baked = null;
        wrap.remove();
      },
    };
  },
};
