// Near-line audit: for every wrongAnswer the lock itself offers (the shapes a
// real player produces), what does the player read back? Run against the real
// bundled modules in the browser.
import { writeFileSync } from 'node:fs';
import * as H from './harness.mjs';

const browser = await H.launch();
const page = await H.newPage(browser, H.DESKTOP);
await H.boot(page, { save: H.saveWithOpenedUpTo(1) });

const data = await page.evaluate(() => {
  const out = [];
  for (const lock of window.__OW.locks) {
    const inst = window.__OW.instanceOf(lock.id);
    const truth = lock.solve(inst);
    const wrongs = lock.wrongAnswers(inst) || [];
    const lines = wrongs.map((w) => {
      const r = lock.verify(inst, w);
      return { ok: !!r.ok, near: r.near === undefined ? null : r.near };
    });
    // junk shapes a fumbling player can also produce
    const junk = [null, {}, [], { nonsense: 1 }].map((w) => {
      let r;
      try { r = lock.verify(inst, w); } catch (e) { r = { threw: String(e) }; }
      return { input: JSON.stringify(w), ok: !!r.ok, near: r.near === undefined ? null : r.near, threw: r.threw || null };
    });
    out.push({
      id: lock.id, ordinal: lock.ordinal, title: lock.title,
      epigraph: lock.epigraph, hints: lock.hints, difficulty: lock.difficulty,
      truth: JSON.stringify(truth).slice(0, 200),
      nWrongs: wrongs.length,
      distinctNear: [...new Set(lines.map((l) => l.near))],
      nullNear: lines.filter((l) => l.near === null || l.near === '').length,
      lines, junk,
    });
  }
  return out;
});

writeFileSync('artifacts/wip-qplay/near-audit.json', JSON.stringify(data, null, 1));
for (const d of data) {
  if (d.ordinal < 6) continue;
  console.log(`\n===== ${d.ordinal} ${d.title} =====`);
  console.log(`wrongAnswers: ${d.nWrongs}   near-lines missing: ${d.nullNear}   distinct: ${d.distinctNear.length}`);
  d.distinctNear.forEach((n) => console.log('   • ' + (n === null ? '(NO NEAR LINE)' : n)));
  console.log('  junk shapes:');
  d.junk.forEach((j) => console.log(`   ${j.input} -> ok=${j.ok} near=${JSON.stringify(j.near)} threw=${j.threw}`));
  console.log('  hints:');
  d.hints.forEach((h, i) => console.log(`   ${i + 1}. ${h}`));
}
await browser.close();
