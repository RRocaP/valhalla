// Independent brute-force check of lock 12: full 8! x 9 sweep, no module internals.
import { rng } from '../../src/kernel/rng.js';
import lock from '../../src/locks/12-veitsla.js';

const benchOf = (s) => (s < 4 ? 0 : 1);
function holds(c, pos) {
  const a = pos[c.x], b = pos[c.y];
  if (c.kind === 'opposite') return Math.abs(a - b) === 4;
  if (c.kind === 'not-adjacent') return !(benchOf(a) === benchOf(b) && Math.abs(a - b) === 1);
  if (c.kind === 'left-of') return benchOf(a) === benchOf(b) && a < b;
  if (c.kind === 'same-bench') return benchOf(a) === benchOf(b);
  return false;
}
function* perms(arr) {
  if (arr.length <= 1) { yield arr; return; }
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of perms(rest)) yield [arr[i]].concat(p);
  }
}
const N = Number(process.argv[2] || 20);
let worstDecoy = 99, allUnique = true, canonAll = 0;
for (let s = 0; s < N; s++) {
  const inst = lock.makePuzzle(rng(`ow-12-veitsla-${s}`));
  const sols = [], near = [];
  for (const pos of perms([0,1,2,3,4,5,6,7])) {
    let mask = 0;
    for (let i = 0; i < inst.oaths.length; i++) if (!holds(inst.oaths[i], pos)) mask |= 1 << i;
    let bits = 0, m = mask; while (m) { m &= m - 1; bits++; }
    const canonical = pos[0] < 4;                       // person 0 = alphabetically first
    if (bits === 1) { canonAll++; if (canonical) sols.push({ pos, k: Math.log2(mask) | 0 }); }
    else if (bits === 2 && canonical) near.push(mask);
  }
  if (sols.length !== 1) { allUnique = false; console.log('NOT UNIQUE seed', s, sols.length); continue; }
  const k = sols[0].k;
  const decoys = near.filter((m) => (m & (1 << k)) !== 0).length;
  worstDecoy = Math.min(worstDecoy, decoys);
  // module's own solve must equal the brute-force answer
  const ans = lock.solve(inst);
  const seats = new Array(8);
  for (let p = 0; p < 8; p++) seats[sols[0].pos[p]] = inst.names[p];
  const expect = JSON.stringify({ benches: [seats.slice(0,4), seats.slice(4)], boast: k });
  if (JSON.stringify(ans) !== expect) console.log('SOLVE MISMATCH seed', s, ans, expect);
}
console.log('seeds', N, 'all unique (canonical):', allUnique, 'min decoys:', worstDecoy,
  '| total 1-violation seatings incl. bench-swap images:', canonAll, '(expect 2x seeds)');
