// OW-B04 driver-contract check: replays the tests/e2e/helpers.mjs '04-strakes'
// driver EXACTLY (aria-label `${mark},` prefix + Space-lift / Arrow-move /
// Space-settle + [role=radio].ow4-say + 'Raise the stack') with real input on
// both viewports. Stands in for journey.spec.mjs while the shared
// beginFromThreshold helper is blocked by another lane's wager gate.
import * as H from '../wip-qplay/harness.mjs';

const browser = await H.launch();
let bad = 0;
for (const [name, vp] of [['desk', H.DESKTOP], ['phone', H.PHONE]]) {
  const page = await H.newPage(browser, vp);
  await H.boot(page, { save: H.saveWithOpenedUpTo(4) });
  await page.locator('.screen-threshold button').first().click();
  const wager = page.getByRole('button', { name: 'Take the wager', exact: true });
  if (await wager.count()) await wager.first().click().catch(() => {});
  await page.waitForSelector('.screen-lid', { timeout: 8000 });
  await H.enterLock(page, 4);
  await H.answerDare(page);

  const { answer, instance } = await page.evaluate((id) => ({
    answer: window.__OW.answerOf(id),
    instance: window.__OW.instanceOf(id),
  }), '04-strakes');

  const root = page.locator('.lock-root');
  const planks = root.locator('.ow4-plank');
  const markOf = (id) => instance.planks[id].mark;
  const domIndexOf = async (id) => {
    const labels = await planks.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || ''));
    return labels.findIndex((l) => l.startsWith(markOf(id) + ','));
  };

  const targetStack = answer.order.slice().reverse();
  const t0 = Date.now();
  for (let pos = 0; pos < targetStack.length; pos++) {
    const id = targetStack[pos];
    let cur = await domIndexOf(id);
    if (cur < 0) { console.log(`${name}: NO aria-label starting with "${markOf(id)},"`); bad++; break; }
    if (cur === pos) continue;
    await planks.nth(cur).click();
    await page.keyboard.press('Space');
    while (cur > pos) { await page.keyboard.press('ArrowUp'); cur--; }
    await page.keyboard.press('Space');
    const now = await domIndexOf(id);
    if (now !== pos) { console.log(`${name}: ${markOf(id)} landed at ${now}, wanted ${pos}`); bad++; break; }
  }
  const tally = await root.locator('p').filter({ hasText: /joints lie fair/ }).first().textContent().catch(() => '');
  await root.locator('[role="radio"].ow4-say').nth(answer.liar).click();
  await root.getByRole('button', { name: 'Raise the stack', exact: true }).click();
  await page.waitForTimeout(700);

  const solved = await page.evaluate(() => {
    const s = window.__OW && window.__OW.save;
    return !!(s && s.opened.includes('04-strakes'));
  });
  const errs = page.__errors.slice();
  console.log(`${name}: keyboard path ${Date.now() - t0}ms · tally-before-brand "${(tally || '').trim()}" · solved=${solved} · errors=${errs.length}`);
  if (!solved) bad++;
  if (errs.length) { bad++; console.log('   ', errs.slice(0, 3)); }
  await page.context().close();
}
await browser.close();
console.log(bad === 0 ? 'DRIVER CONTRACT: GREEN (both viewports)' : `DRIVER CONTRACT: ${bad} failure(s)`);
process.exit(bad === 0 ? 0 : 1);
