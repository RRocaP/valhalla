// The two floors of artifacts/wip-qplay/ink-targets.mjs (every canvas has ink;
// every interactive target is >= 44x44 CSS px), scoped to lock 14 and run
// through a wager-aware threshold pass.
//
// WHY A LOCAL COPY: the shared gate calls harness.mjs crossThreshold, which
// predates the threshold wager card (src/shell/screens/threshold.js showWager)
// and now times out for every lock, 6..15. Fixing the shared harness is not
// this lane's file. This runs the same assertions for board 14.
import { writeFileSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

async function crossThreshold(page) {
  const btn = page.locator('.screen-threshold button').first();
  await btn.waitFor({ timeout: 8000 });
  await btn.click();
  const wager = page.locator('.wager-continue');
  if (await wager.count() && await wager.isVisible().catch(() => false)) await wager.click();
  await page.waitForSelector('.screen-lid, .screen-finale', { timeout: 8000 });
}

const browser = await H.launch();
const rows = [];
let bad = 0;
for (const vp of [H.DESKTOP, H.PHONE]) {
  const page = await H.newPage(browser, vp);
  await H.boot(page, { save: H.saveWithOpenedUpTo(14) });
  await crossThreshold(page);
  await H.enterLock(page, 14);
  await H.answerDare(page);
  await page.waitForTimeout(450);
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
    const els = [...root.querySelectorAll('button,[role="option"],[role="slider"],[role="button"],a[href],input')];
    const small = els.map((e) => {
      const r = e.getBoundingClientRect();
      return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 16) };
    }).filter((o) => o.w > 0 && (o.w < 44 || o.h < 44));
    return { nCanvas: canvases.length, blank, nCtrl: els.length, under44: small.length, sample: small.slice(0, 4) };
  });
  rows.push({ vp: `${vp.width}x${vp.height}`, ord: 14, ...m });
  if (m.blank.length || m.under44) bad++;
  await page.context().close();
}
await browser.close();
writeFileSync('artifacts/wip-b14/ink-targets-14.json', JSON.stringify(rows, null, 1));
console.log('vp        lock canvases blank            ctrls under44 sample');
for (const r of rows) {
  console.log(`${r.vp.padEnd(9)} ${String(r.ord).padStart(3)}  ${String(r.nCanvas).padStart(5)}   ${JSON.stringify(r.blank).padEnd(16)} ${String(r.nCtrl).padStart(4)}  ${String(r.under44).padStart(4)}   ${JSON.stringify(r.sample)}`);
}
console.log(bad === 0 ? 'INK+TARGET FLOOR (lock 14): GREEN' : `INK+TARGET FLOOR (lock 14): ${bad} row(s) failing`);
process.exit(bad === 0 ? 0 : 1);
