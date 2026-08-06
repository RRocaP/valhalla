// The ink + 44px floor of artifacts/wip-qplay/ink-targets.mjs, applied to
// board 02 at both viewports. Needed because that script's crossThreshold()
// predates the shell's wager card and cannot reach any lock room right now
// (harness is QA-owned; see the handoff). Same assertions, same thresholds,
// plus an unmount check: leave the lock and come back, console must stay clean.
import { writeFileSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const browser = await H.launch();
const rows = [];
let bad = 0;
for (const vp of [H.DESKTOP, H.PHONE]) {
  const page = await H.newPage(browser, vp);
  await H.boot(page, { save: H.saveWithOpenedUpTo(2) });
  await page.locator('.threshold-actions button').first().click();
  const wager = page.locator('.wager-layer .wager-continue');
  if (await wager.isVisible().catch(() => false)) await wager.click();
  await page.waitForSelector('.screen-lid', { timeout: 8000 });
  await H.enterLock(page, 2);
  await H.answerDare(page);
  await page.waitForTimeout(600);

  const m = await page.evaluate(() => {
    const root = document.querySelector('.lock-root');
    const canvases = [...root.querySelectorAll('canvas')];
    const blank = [];
    for (const c of canvases) {
      if (!c.width || !c.height) { blank.push('zero-sized'); continue; }
      let ink = 0;
      try {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 8) { ink++; if (ink > 20) break; }
      } catch (e) { ink = -1; }
      if (ink >= 0 && ink <= 20) blank.push(`${c.width}x${c.height} ink=${ink}`);
    }
    const els = [...root.querySelectorAll('button,[role="option"],[role="radio"],[role="slider"],[role="button"],a[href],input')];
    const small = els.map((e) => {
      const r = e.getBoundingClientRect();
      return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 16) };
    }).filter((o) => o.w > 0 && (o.w < 44 || o.h < 44));
    return { nCanvas: canvases.length, blank, nCtrl: els.length, under44: small.length, sample: small.slice(0, 4) };
  });

  // unmount: back to the lid and in again — no listener/timer must survive
  await page.locator('.screen-lockroom .btn-quiet, .screen-lockroom button').first().click().catch(() => {});
  await page.waitForTimeout(400);
  await H.enterLock(page, 2).catch(() => {});
  await H.answerDare(page);
  await page.waitForTimeout(900);
  const roots = await page.evaluate(() => document.querySelectorAll('.ow2-grid').length);

  rows.push({ vp: `${vp.width}x${vp.height}`, ...m, gridsAfterRemount: roots, errors: page.__errors.slice() });
  if (m.blank.length || m.under44 || roots !== 1 || page.__errors.length) bad++;
  await page.context().close();
}
await browser.close();
writeFileSync('artifacts/wip-b02/ink-targets-02.json', JSON.stringify(rows, null, 1));
for (const r of rows) {
  console.log(`${r.vp}  canvases=${r.nCanvas} blank=${JSON.stringify(r.blank)} ctrls=${r.nCtrl} under44=${r.under44} `
    + `gridsAfterRemount=${r.gridsAfterRemount} errors=${r.errors.length} ${JSON.stringify(r.sample)}`);
}
console.log(bad === 0 ? 'BOARD 02 INK+TARGET FLOOR: GREEN' : `BOARD 02 INK+TARGET FLOOR: ${bad} row(s) failing`);
process.exit(bad === 0 ? 0 : 1);
