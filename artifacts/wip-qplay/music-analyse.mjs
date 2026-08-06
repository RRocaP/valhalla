import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('artifacts/wip-qplay/music-long.json', 'utf8'));
const S = d.samples, src = d.src;
const dB = (x) => 20 * Math.log10(Math.max(x, 1e-9));
const at = (t) => S.filter(s => Math.abs(s.t - t) < 0.6);
const win = (a, b) => S.filter(s => s.t >= a && s.t < b);
const rms = (arr) => arr.length ? Math.sqrt(arr.reduce((s, x) => s + x.rms * x.rms, 0) / arr.length) : NaN;
const med = (arr) => { const v = arr.map(x=>x.rms).sort((a,b)=>a-b); return v.length? v[v.length>>1] : NaN; };

console.log('=== loop geometry (from the module\'s own AudioBufferSourceNode) ===');
console.log(` buffer ${src.bufferDuration.toFixed(3)}s @ ${src.sampleRate}Hz; loopStart ${src.loopStart.toFixed(3)}s  loopEnd ${src.loopEnd.toFixed(3)}s  length ${(src.loopEnd-src.loopStart).toFixed(2)}s`);
console.log(` seam, straight off the decoded buffer (200 ms windows):`);
console.log(`   pre-wrap RMS  ${src.seam.preWrapRms.toFixed(5)}  (${dB(src.seam.preWrapRms).toFixed(2)} dBFS)`);
console.log(`   post-wrap RMS ${src.seam.postWrapRms.toFixed(5)}  (${dB(src.seam.postWrapRms).toFixed(2)} dBFS)`);
console.log(`   step across the seam: ${(dB(src.seam.postWrapRms)-dB(src.seam.preWrapRms)).toFixed(2)} dB`);
console.log(`   mid-loop body RMS ${src.seam.bodyRms.toFixed(5)} (${dB(src.seam.bodyRms).toFixed(2)} dBFS)`);
console.log(`   sample discontinuity at the wrap: ${Math.abs(src.seam.firstSampleAfterWrap-src.seam.lastSampleBeforeWrap).toFixed(6)} (full scale 1.0)`);

const started = src.startedAtCtx, off = src.offset ?? 0;
const wraps = [];
for (let k = 1; k <= 3; k++) wraps.push(started + (src.loopEnd - off) + (k - 1) * (src.loopEnd - src.loopStart));
console.log('\n=== live mix across the wraps (AnalyserNode on the destination) ===');
console.log(' wrap#  ctxTime   RMS 4s before   RMS 4s after   step dB   min in +/-1s   gap?');
for (let i = 0; i < wraps.length; i++) {
  const w = wraps[i];
  const b4 = win(w - 4, w - 0.2), af = win(w + 0.2, w + 4);
  if (!b4.length || !af.length) { console.log(` ${i+1}      ${w.toFixed(1)}   (past end of run)`); continue; }
  const near = win(w - 1, w + 1);
  const mn = Math.min(...near.map(s => s.rms));
  console.log(` ${String(i+1).padEnd(5)}  ${w.toFixed(1).padStart(7)}   ${rms(b4).toFixed(5)}         ${rms(af).toFixed(5)}       ${(dB(rms(af))-dB(rms(b4))).toFixed(2).padStart(6)}    ${mn.toFixed(5)}     ${mn < 0.004 ? 'SILENCE' : 'no'}`);
}

console.log('\n=== drone -> music handoff ===');
const g = d.marks.find(m => m.label === 'gesture');
for (const [a,b,label] of [[0,2,'0-2s (drone alone)'],[2,4,'2-4s'],[4,6,'4-6s'],[6,10,'6-10s'],[10,20,'10-20s (music seated)'],[20,40,'20-40s']]) {
  const w = win(a,b); if (!w.length) continue;
  console.log(`  ${label.padEnd(24)} RMS ${rms(w).toFixed(5)}  (${dB(rms(w)).toFixed(1)} dBFS)  min ${Math.min(...w.map(s=>s.rms)).toFixed(5)}`);
}

console.log('\n=== ducks (motif / ui over the music) ===');
for (const m of d.marks.filter(m => m.label.startsWith('probe:'))) {
  const base = rms(win(m.t - 2.5, m.t - 0.2));
  const after = [];
  for (let k = 0; k < 24; k++) { const w = win(m.t + k*0.25, m.t + (k+1)*0.25); after.push(w.length ? rms(w) : NaN); }
  const trough = Math.min(...after.slice(0,8).filter(x=>!isNaN(x)));
  const back = after.findIndex((x,i) => i>1 && !isNaN(x) && x >= base*0.93);
  console.log(`  ${m.label.padEnd(34)} base ${base.toFixed(5)}  trough ${trough.toFixed(5)}  duck ${(dB(trough)-dB(base)).toFixed(2)} dB  recovered by +${back<0?'>6':(back*0.25).toFixed(2)}s`);
  console.log(`     250ms bins: ${after.slice(0,12).map(x=>isNaN(x)?'--':x.toFixed(4)).join(' ')}`);
}

console.log('\n=== level stability over the whole listen ===');
const mins = [];
for (let t = 20; t < S[S.length-1].t - 30; t += 30) { const w = win(t, t+30); if (w.length) mins.push([t, rms(w)]); }
console.log('  30s-window RMS: ' + mins.map(([t,r]) => `${t}s:${r.toFixed(4)}`).join('  '));
const vals = mins.map(x=>x[1]);
console.log(`  spread across the listen: ${(dB(Math.max(...vals))-dB(Math.min(...vals))).toFixed(2)} dB`);
const dead = S.filter(s => s.t > 15 && s.rms < 0.003);
console.log(`  samples below -50 dBFS after 15 s: ${dead.length} / ${S.filter(s=>s.t>15).length}`);
console.log(`  total listen: ${(S[S.length-1].t).toFixed(0)} s, ${S.length} samples, page errors ${d.errs.length}`);
