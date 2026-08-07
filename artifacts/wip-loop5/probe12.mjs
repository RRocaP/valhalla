// OW-LOOP5 L12 probe: full-board capture + seated-hall state, both viewports.
// node artifacts/wip-loop5/probe12.mjs <tag>
import { mkdirSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const tag = process.argv[2] || 'now';
mkdirSync('artifacts/wip-loop5/shots', { recursive: true });

const browser = await H.launch();
for (const [name, vp] of [['desk', H.DESKTOP], ['phone', H.PHONE]]) {
  const page = await H.newPage(browser, vp);
  await H.boot(page, { save: H.saveWithOpenedUpTo(12) });
  await page.locator('.screen-threshold button').first().click();
  const wager = page.locator('.wager-continue');
  if (await wager.count()) await wager.click();
  await page.waitForSelector('.screen-lid', { timeout: 8000 });
  await H.enterLock(page, 12);
  await H.answerDare(page);
  await page.waitForTimeout(3800); // let the showing run out
  await page.screenshot({ path: `artifacts/wip-loop5/shots/${tag}-${name}-top.png` });
  await page.locator('#app').screenshot({ path: `artifacts/wip-loop5/shots/${tag}-${name}-full.png` });

  // seat four men + accuse one plaque, so tokens/benches/plaque states show
  await page.evaluate(() => {
    const chips = [...document.querySelectorAll('.ow12-chip')];
    const seats = [...document.querySelectorAll('.ow12-seat')];
    const seq = [[0, 0], [0, 4], [0, 1], [0, 6]];
    for (const [ci, si] of seq) {
      const chip = [...document.querySelectorAll('.ow12-chip')][ci];
      if (chip) chip.click();
      const seat = seats[si];
      if (seat) seat.click();
    }
    const pl = document.querySelectorAll('.ow12-boast')[2];
    if (pl) pl.click();
  });
  await page.waitForTimeout(700);
  await page.locator('#app').screenshot({ path: `artifacts/wip-loop5/shots/${tag}-${name}-seated.png` });
  await page.close();
}
await browser.close();
console.log('probe12 done:', tag);
