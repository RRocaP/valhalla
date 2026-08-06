// OW-B09 locale sanity: board 09 in es and ca (no #autotest, real lang path).
import * as H from '../wip-qplay/harness.mjs';

const browser = await H.launch();
for (const lang of ['es', 'ca']) {
  const page = await H.newPage(browser, H.PHONE);
  const save = JSON.parse(H.saveWithOpenedUpTo(9));
  save.settings.lang = lang;
  await H.boot(page, { save: JSON.stringify(save), hash: '' });
  await page.locator('.screen-threshold .btn-carved').first().click();
  const wager = page.locator('.wager-continue');
  try { await wager.waitFor({ state: 'visible', timeout: 2500 }); await wager.click(); } catch { /* none */ }
  await page.waitForSelector('.screen-lid', { timeout: 8000 });
  await page.locator('.medallion-hit').nth(8).click();
  await page.waitForSelector('.screen-lockroom', { timeout: 8000 });
  const dare = page.locator('.dare-card .btn-carved');
  if (await page.locator('.dare-card').count()) { await dare.click(); }
  await page.waitForSelector('.ow-sunstone', { timeout: 8000 });
  await page.waitForTimeout(3400);
  // focus the second stone so localized focus line + blades show
  await page.locator('.stone').nth(1).locator('.cand').first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `artifacts/wip-b09/shots/v4-${lang}-phone.png`, fullPage: false });
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(250);
  await page.screenshot({ path: `artifacts/wip-b09/shots/v4-${lang}-rows-phone.png` });
  await page.context().close();
}
await browser.close();
console.log('locale shots done');
