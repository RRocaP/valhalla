// OW-B03 feedback moments: the showing (ghost hand mid-sweep), the refused
// night (dark cages ringed), and the night all three burn (the aligned wheel).
// Usage: node artifacts/wip-b03/moments.mjs <tag>
import { mkdirSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const tag = process.argv[2] || 'now';
mkdirSync('artifacts/wip-b03/shots', { recursive: true });

async function cross(page) {
  await page.locator('.threshold-actions button').first().click();
  const wager = page.locator('.wager-card .wager-continue');
  if (await wager.count()) await wager.click({ timeout: 4000 }).catch(() => {});
  await page.waitForSelector('.screen-lid, .screen-finale', { timeout: 8000 });
}

const browser = await H.launch();
for (const [name, vp] of [['desk', H.DESKTOP], ['phone', H.PHONE]]) {
  // ---- the showing, caught mid-sweep
  {
    const page = await H.newPage(browser, vp);
    await H.boot(page, { save: H.saveWithOpenedUpTo(3) });
    await cross(page);
    await H.enterLock(page, 3);
    await H.answerDare(page);
    await page.waitForTimeout(1150);
    await page.screenshot({ path: `artifacts/wip-b03/shots/${tag}-${name}-showing.png` });
    await page.context().close();
  }
  // ---- a refused night, then the true night
  const page = await H.newPage(browser, vp);
  await H.boot(page, { save: H.saveWithOpenedUpTo(3) });
  await cross(page);
  await H.enterLock(page, 3);
  await H.answerDare(page);
  await page.waitForTimeout(3600);

  const dial = page.locator('.lock-root canvas[role="slider"]');
  await dial.focus();
  const answer = await page.evaluate(() => window.__OW.answerOf('03-beacons'));

  // walk to a night one short of the answer (guaranteed a refusal), submit
  const target = (answer && answer.night) || null;
  const walk = async (n) => {
    await page.keyboard.press('Home');
    let left = n - 1;
    while (left >= 10) { await page.keyboard.press('ArrowUp'); left -= 10; }
    while (left >= 1) { await page.keyboard.press('ArrowRight'); left -= 1; }
  };
  if (target) {
    await walk(target - 1);
    await page.locator('.lock-root button.btn-carved').click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `artifacts/wip-b03/shots/${tag}-${name}-refused.png` });
    await dial.focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `artifacts/wip-b03/shots/${tag}-${name}-aligned.png` });
  }
  console.log(`${name}: answer night ${target}; errors ${page.__errors.length}`);
  await page.context().close();
}
await browser.close();
