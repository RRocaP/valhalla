import { rng } from '../../src/kernel/rng.js';
import lock from '../../src/locks/12-veitsla.js';
const N = Number(process.argv[2] || 40);
let t0 = Date.now(), degenerate = 0, minWrongs = 99, kinds = new Map(), fails = 0;
for (let s = 0; s < N; s++) {
  const inst = lock.makePuzzle(rng(`ow-12-veitsla-${s}`));
  if (!inst.oaths.length) { degenerate++; continue; }
  for (const o of inst.oaths) kinds.set(o.kind, (kinds.get(o.kind) || 0) + 1);
  const ans = lock.solve(inst);
  if (!lock.verify(inst, ans).ok) { fails++; console.log('SOLVE FAIL', s); continue; }
  const w = lock.wrongAnswers(inst);
  minWrongs = Math.min(minWrongs, w.length);
  for (const x of w) if (lock.verify(inst, x).ok) console.log('WRONG ACCEPTED', s, JSON.stringify(x));
}
const ms = Date.now() - t0;
console.log('seeds', N, 'degenerate', degenerate, 'solveFails', fails, 'min wrongs', minWrongs, 'ms', ms, 'per seed', (ms / N).toFixed(1));
console.log('oath kind mix', [...kinds]);
