// OW-B10: capture the ghost-hand showing mid-flight, and the reduced-motion
// static variant, at both viewports. Usage: node artifacts/wip-b10/showing.mjs <tag>
import { mkdirSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const tag = process.argv[2] || 'show';
mkdirSync('artifacts/wip-b10/shots', { recursive: true });

async function crossThreshold(page) {
  await page.locator('.screen-threshold button').first().click();
  const wager = page.locator('.wager-continue');
  if (await wager.count()) {
    await wager.waitFor({ state: 'visible', timeout: 5000 });
    await wager.click();
  }
  await page.waitForSelector('.screen-lid, .screen-finale', { timeout: 8000 });
}

const browser = await H.launch();
for (const [name, vp] of [['desk', H.DESKTOP], ['phone', H.PHONE]]) {
  for (const motion of ['no-preference', 'reduce']) {
    const page = await H.newPage(browser, vp, { reducedMotion: motion });
    await H.boot(page, { save: H.saveWithOpenedUpTo(10) });
    await crossThreshold(page);
    await H.enterLock(page, 10);
    await H.answerDare(page);
    await page.waitForTimeout(motion === 'reduce' ? 900 : 1500);
    const state = await page.evaluate(() => {
      const cv = document.querySelector('.ow10-showing');
      const skip = document.querySelector('.ow10-skip');
      let ink = 0;
      if (cv) {
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 8) ink++;
      }
      const sb = skip ? skip.getBoundingClientRect() : null;
      return {
        showing: !!cv, ink,
        skip: sb ? { w: +sb.width.toFixed(0), h: +sb.height.toFixed(0), text: skip.textContent } : null,
        pointerEvents: cv ? getComputedStyle(cv).pointerEvents : null,
      };
    });
    await page.screenshot({ path: `artifacts/wip-b10/shots/${tag}-${name}-${motion === 'reduce' ? 'calm' : 'motion'}.png` });
    console.log(`${name}/${motion}:`, JSON.stringify(state), 'errs', page.__errors.length);
    // the showing must be gone (and its canvas out of the DOM) by 3.4s
    await page.waitForTimeout(2600);
    const after = await page.evaluate(() => ({
      showing: !!document.querySelector('.ow10-showing'),
      skip: !!document.querySelector('.ow10-skip'),
      canvases: document.querySelectorAll('.lock-root canvas').length,
    }));
    console.log(`   after 3.4s:`, JSON.stringify(after));
    await page.context().close();
  }
}
await browser.close();
