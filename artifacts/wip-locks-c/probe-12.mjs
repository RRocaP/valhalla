import { rng } from '../../src/kernel/rng.js';
import lock from '../../src/locks/12-veitsla.js';
const N = Number(process.argv[2] || 60);
let t0 = Date.now(), degenerate = 0, minWrongs = 99, kinds = new Map();
for (let s = 0; s < N; s++) {
  const inst = lock.makePuzzle(rng(`ow-12-veitsla-${s}`));
  if (!inst.oaths.length) { degenerate++; continue; }
  for (const o of inst.oaths) kinds.set(o.kind, (kinds.get(o.kind) || 0) + 1);
  const ans = lock.solve(inst);
  if (!lock.verify(inst, ans).ok) { console.log('SOLVE FAIL', s, JSON.stringify(ans)); break; }
  const w = lock.wrongAnswers(inst);
  minWrongs = Math.min(minWrongs, w.length);
  for (const x of w) if (lock.verify(inst, x).ok) console.log('WRONG ACCEPTED', s, JSON.stringify(x));
}
console.log('seeds', N, 'degenerate', degenerate, 'min wrongs', minWrongs, 'ms', Date.now() - t0, 'per seed', ((Date.now()-t0)/N).toFixed(1));
console.log('oath kind mix', [...kinds]);
