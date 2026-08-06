// OW-B10: the teaching frame — some lines bound, some not. Seats the true
// verse, then crosses the two opening halves of rests 1 and 2 so the board
// shows lit and dead marks side by side. Usage: node artifacts/wip-b10/partial.mjs <tag>
import { mkdirSync } from 'node:fs';
import * as H from '../wip-qplay/harness.mjs';

const tag = process.argv[2] || 'partial';
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
  const page = await H.newPage(browser, vp);
  await H.boot(page, { save: H.saveWithOpenedUpTo(10) });
  await crossThreshold(page);
  await H.enterLock(page, 10);
  await H.answerDare(page);
  await page.waitForTimeout(3600);

  const { answer, texts } = await page.evaluate(() => {
    const ow = window.__OW;
    const l = ow.locks.find((x) => x.id === '10-drottkvaett');
    const inst = ow.instanceOf('10-drottkvaett');
    return { answer: l.solve(inst), texts: inst.fragments.map((f) => f.text) };
  });
  const root = page.locator('.lock-root');
  const seat = async (fragIdx, slot) => {
    const text = texts[fragIdx];
    const re = new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\d+$`);
    await root.locator('.frag').filter({ hasText: re }).first().click();
    await root.locator('.slot').nth(slot).click();
  };
  // rests 3 and 4 true; rests 1 and 2 with their opening halves crossed
  for (const line of [2, 3]) for (const half of [0, 1]) await seat(answer.lines[line][half], line * 2 + half);
  await seat(answer.lines[0][1], 1);
  await seat(answer.lines[1][1], 3);
  await seat(answer.lines[1][0], 0);
  await seat(answer.lines[0][0], 2);
  await page.waitForTimeout(320);
  await page.screenshot({ path: `artifacts/wip-b10/shots/${tag}-${name}.png` });
  const tally = await page.evaluate(() => document.querySelector('.ow10-tally').textContent);
  console.log(`${name}: tally="${tally}" errs=${page.__errors.length}`, page.__errors.slice(0, 2));
  await page.context().close();
}
await browser.close();
