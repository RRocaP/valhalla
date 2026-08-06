// scratch probe: distribution of lock 11 instances over many seeds
import { rng } from '../../src/kernel/rng.js';
import lock from '../../src/locks/11-skerry.js';

const N = Number(process.argv[2] || 300);
const hist = new Map();
let minOpt = 1e9, maxOpt = 0, gapSum = 0, worstGap = 1e9, t0 = Date.now();
let wrongsMin = 99;
for (let s = 0; s < N; s++) {
  const inst = lock.makePuzzle(rng(`ow-11-skerry-${s}`));
  const ans = lock.solve(inst);
  const v = lock.verify(inst, ans);
  if (!v.ok) { console.log('SOLVE FAIL seed', s, JSON.stringify(ans).slice(0, 120)); break; }
  hist.set(inst.optimum, (hist.get(inst.optimum) || 0) + 1);
  minOpt = Math.min(minOpt, inst.optimum);
  maxOpt = Math.max(maxOpt, inst.optimum);
  const gap = inst.optimum - inst.naiveLegs;
  gapSum += gap; worstGap = Math.min(worstGap, gap);
  const wrongs = lock.wrongAnswers(inst);
  wrongsMin = Math.min(wrongsMin, wrongs.length);
  for (const w of wrongs) if (lock.verify(inst, w).ok) console.log('WRONG ACCEPTED seed', s, JSON.stringify(w));
  if (ans.route.length < 2) console.log('degenerate route seed', s);
}
console.log('seeds', N, 'optimum min/max', minOpt, maxOpt, 'avg greedy gap', (gapSum / N).toFixed(2), 'worst gap', worstGap);
console.log('min wrongs', wrongsMin, 'ms', Date.now() - t0);
console.log('optimum histogram', [...hist.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' '));
