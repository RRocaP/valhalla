import { rng } from '../../src/kernel/rng.js';
import lock from '../../src/locks/13-althing.js';
const N = Number(process.argv[2] || 60);
let t0 = Date.now(), degenerate = 0, minWrongs = 99, stCount = [], kinds = new Map();
for (let s = 0; s < N; s++) {
  const inst = lock.makePuzzle(rng(`ow-13-althing-${s}`));
  if (!inst.statements.length) { degenerate++; continue; }
  stCount.push(inst.statements.length);
  for (const st of inst.statements) kinds.set(st.kind, (kinds.get(st.kind) || 0) + 1);
  const ans = lock.solve(inst);
  if (!lock.verify(inst, ans).ok) { console.log('SOLVE FAIL', s); continue; }
  const w = lock.wrongAnswers(inst);
  minWrongs = Math.min(minWrongs, w.length);
  for (const x of w) if (lock.verify(inst, x).ok) console.log('WRONG ACCEPTED', s, JSON.stringify(x));
}
const ms = Date.now() - t0;
console.log('seeds', N, 'degenerate', degenerate, 'min wrongs', minWrongs, 'ms', ms, 'per seed', (ms/N).toFixed(1));
console.log('statements min/max', Math.min(...stCount), Math.max(...stCount), 'kinds', [...kinds]);
