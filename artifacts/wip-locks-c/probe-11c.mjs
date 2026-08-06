// How often is the optimal ROUTE unique (not just the leg-count)?
import { rng } from '../../src/kernel/rng.js';
import lock from '../../src/locks/11-skerry.js';
const cost = (k) => (k === 'portage' ? 2 : 1);
const flips = (k) => k !== 'portage';
const open = (k, p) => k === 'portage' || k === 'always' || k === (p === 0 ? 'ebb' : 'flood');

function distToGoal(inst) {
  const n = inst.nodes.length, D = new Array(n * 2).fill(Infinity);
  D[inst.goal * 2] = 0; D[inst.goal * 2 + 1] = 0;
  for (let r = 0; r < n * 4; r++) {
    let ch = false;
    for (const e of inst.edges) for (const [a, b] of [[e.a, e.b], [e.b, e.a]]) for (let p = 0; p < 2; p++) {
      if (!open(e.kind, p)) continue;
      const np = flips(e.kind) ? 1 - p : p;
      if (D[b * 2 + np] + cost(e.kind) < D[a * 2 + p]) { D[a * 2 + p] = D[b * 2 + np] + cost(e.kind); ch = true; }
    }
    if (!ch) break;
  }
  return D;
}
function countOptimal(inst) {
  const D = distToGoal(inst), n = inst.nodes.length;
  const adj = Array.from({ length: n }, () => []);
  for (const e of inst.edges) { adj[e.a].push({ to: e.b, kind: e.kind }); adj[e.b].push({ to: e.a, kind: e.kind }); }
  const memo = new Map();
  const go = (node, p) => {
    if (node === inst.goal) return 1;
    const k = node * 2 + p;
    if (memo.has(k)) return memo.get(k);
    let total = 0;
    for (const { to, kind } of adj[node]) {
      if (!open(kind, p)) continue;
      const np = flips(kind) ? 1 - p : p;
      if (D[to * 2 + np] + cost(kind) === D[k]) total += go(to, np);
    }
    memo.set(k, total);
    return total;
  };
  return go(inst.start, 0);
}
const N = Number(process.argv[2] || 200);
let unique = 0; const hist = new Map();
for (let s = 0; s < N; s++) {
  const inst = lock.makePuzzle(rng(`ow-11-skerry-${s}`));
  const c = countOptimal(inst);
  if (c === 1) unique++;
  const b = c === 1 ? '1' : c <= 3 ? '2-3' : c <= 10 ? '4-10' : '>10';
  hist.set(b, (hist.get(b) || 0) + 1);
}
console.log('seeds', N, 'unique optimal route:', unique, `(${(100 * unique / N).toFixed(1)}%)`, [...hist]);
