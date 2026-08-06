// Real-input drive of board 14 through the FROZEN e2e driver contract
// (tests/e2e/helpers.mjs '14-bindrune': click .ow14-cand by candidate index,
// then the button "Name the bound runes"), at both viewports.
//
// WHY A LOCAL DRIVE: journey.spec.mjs currently fails at lock 1 on an
// unexpected .dare-card from another lane's duel change, so the full-journey
// gate cannot speak for board 14 right now. This exercises exactly board 14's
// half of that gate: same selectors, same order, real clicks, clean console.
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
let bad = 0;
for (const [vpName, vp] of [['desk', H.DESKTOP], ['phone', H.PHONE]]) {
  const page = await H.newPage(browser, vp);
  await H.boot(page, { save: H.saveWithOpenedUpTo(14) });
  await crossThreshold(page);
  await H.enterLock(page, 14);
  await H.answerDare(page);
  const { answer, instance } = await page.evaluate(() => ({
    answer: window.__OW.answerOf('14-bindrune'),
    instance: window.__OW.instanceOf('14-bindrune'),
  }));
  const root = page.locator('.lock-root');
  // the driver contract, verbatim
  for (const ch of answer.runes) {
    await root.locator('.ow14-cand').nth(instance.candidates.indexOf(ch)).click();
  }
  await root.getByRole('button', { name: 'Name the bound runes', exact: true }).click();
  let opened = true;
  try {
    await page.waitForSelector('.ceremony-overlay', { timeout: 8000 });
  } catch (e) { opened = false; }
  const solvedInSave = await page.evaluate(() => window.__OW.save.opened.includes('14-bindrune'));
  const errs = page.__errors.filter((t) => !/\/(music|credits)\.mp3/.test(t));
  const ok = opened && solvedInSave && errs.length === 0;
  if (!ok) bad++;
  console.log(`${vpName}: runes=${answer.runes.length} ceremony=${opened} saved=${solvedInSave} errors=${errs.length} -> ${ok ? 'PASS' : 'FAIL'}`);
  if (errs.length) console.log('   ', errs.slice(0, 3));
  await page.context().close();
}
await browser.close();
console.log(bad === 0 ? 'DRIVER CONTRACT (lock 14): GREEN' : `DRIVER CONTRACT (lock 14): ${bad} viewport(s) failing`);
process.exit(bad === 0 ? 0 : 1);
