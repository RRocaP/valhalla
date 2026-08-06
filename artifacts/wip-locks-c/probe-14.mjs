import { rng } from '../../src/kernel/rng.js';
import lock from '../../src/locks/14-bindrune.js';
const N = Number(process.argv[2] || 40);
let t0 = Date.now(), minWrongs = 99, sizes = new Map(), segs = [];
for (let s = 0; s < N; s++) {
  const inst = lock.makePuzzle(rng(`ow-14-bindrune-${s}`));
  segs.push(inst.segments.length);
  const ans = lock.solve(inst);
  sizes.set(ans.runes.length, (sizes.get(ans.runes.length) || 0) + 1);
  if (!lock.verify(inst, ans).ok) { console.log('SOLVE FAIL', s, ans); continue; }
  const w = lock.wrongAnswers(inst);
  minWrongs = Math.min(minWrongs, w.length);
  for (const x of w) if (lock.verify(inst, x).ok) console.log('WRONG ACCEPTED', s, JSON.stringify(x));
  if (s === 0) console.log('sample answer', ans.runes.join(' '), '| carved segments', inst.segments.length);
}
const ms = Date.now() - t0;
console.log('seeds', N, 'min wrongs', minWrongs, 'answer sizes', [...sizes], 'segments min/max', Math.min(...segs), Math.max(...segs));
console.log('ms', ms, 'per seed', (ms/N).toFixed(1));
